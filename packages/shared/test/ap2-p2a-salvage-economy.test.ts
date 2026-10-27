import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  MERCHANT_BASE_PRICES,
  NetworkTransport,
  SIM_STEP_SEC,
  WEAPON_SALVAGE_GOLD,
  WEAPONS,
   type WeaponRarity,
  WorldSim,
  computeMerchantOfferCost,
  encodeWorldSnapshot,
  findSalvageableWeaponNearPlayer,
  generateDungeonFloor,
} from '../src/index.js';

describe('AP2 Phase P2A.3 — 0.5s Weapon Salvage Hold, Flawless Room Bonus & Merchant Economy', () => {
  it('1. salvages dropped weapon (costGold === 0) after holding DROP_WEAPON for 0.50s (30 ticks) out of combat within 48px across all 5 rarities without dropping equipped weapon', () => {
    expect(WEAPON_SALVAGE_GOLD).toEqual({
      common: 10,
      uncommon: 15,
      rare: 22,
      epic: 30,
      legendary: 45,
    });

    const raritySamples: Array<{ rarity: WeaponRarity; weaponId: string; expectedGold: number }> = [
      { rarity: 'common', weaponId: 'rivet_gun', expectedGold: 10 },
      { rarity: 'uncommon', weaponId: 'scrap_shotgun', expectedGold: 15 },
      { rarity: 'rare', weaponId: 'tesla_carbine', expectedGold: 22 },
      { rarity: 'epic', weaponId: 'frag_launcher', expectedGold: 30 },
      { rarity: 'legendary', weaponId: 'solar_archon_staff', expectedGold: 45 },
    ];

    const sim = new WorldSim({
      seed: 202610,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const p1 = sim.player;
    p1.weaponSlots = ['knight_sword', 'gale_smg'];
    p1.activeWeaponSlot = 1;
    p1.gold = 0;

    let seq = 1;
    let cumulativeGold = 0;

    for (const sample of raritySamples) {
      const wepDef = WEAPONS[sample.weaponId]!;
      const groundItem = sim.spawnWorldItem({
        kind: 'weapon',
        weaponId: wepDef.id,
        rarity: sample.rarity,
        nameVi: wepDef.nameVi,
        costGold: 0,
        healAmount: 0,
        x: p1.x + 24,
        y: p1.y,
      });

      expect(findSalvageableWeaponNearPlayer(sim, p1, 48)?.id).toBe(groundItem.id);

      // Hold DROP_WEAPON for 15 ticks (0.25s), then release -> must reset timer and NOT salvage or drop equipped weapon
      for (let t = 0; t < 15; t++) {
        sim.setPlayerInput({
          seq: seq++,
          tick: sim.tick + 1,
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          buttons: INPUT_BUTTON.DROP_WEAPON,
        });
        sim.step(SIM_STEP_SEC);
      }
      expect(p1.salvageHoldTimer).toBeCloseTo(0.25, 2);
      expect(p1.salvageTargetItemId).toBe(groundItem.id);
      expect(groundItem.pickedUp).toBe(false);
      expect(p1.weaponSlots).toEqual(['knight_sword', 'gale_smg']);

      // Release button for 1 tick -> resets progress
      sim.setPlayerInput({
        seq: seq++,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
      });
      sim.step(SIM_STEP_SEC);
      expect(p1.salvageHoldTimer).toBe(0);
      expect(p1.salvageTargetItemId).toBe(0);

      // Hold DROP_WEAPON continuously for 30 ticks (0.50s) -> salvages weapon!
      sim.consumeEvents();
      for (let t = 0; t < 30; t++) {
        sim.setPlayerInput({
          seq: seq++,
          tick: sim.tick + 1,
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          buttons: INPUT_BUTTON.DROP_WEAPON,
        });
        sim.step(SIM_STEP_SEC);
      }

      cumulativeGold += sample.expectedGold;
      expect(p1.gold).toBe(cumulativeGold);
      expect(sim.runStats.goldEarned).toBe(cumulativeGold);
      expect(groundItem.pickedUp).toBe(true);
      expect(sim.worldItems.some((it) => it.id === groundItem.id)).toBe(false);
      expect(p1.weaponSlots).toEqual(['knight_sword', 'gale_smg']);
      expect(p1.salvageHoldTimer).toBe(0);
      expect(p1.salvageTargetItemId).toBe(0);

      const events = sim.consumeEvents();
      const salvageEvt = events.find((e) => e.kind === 'weapon_salvaged');
      expect(salvageEvt).toBeDefined();
      if (salvageEvt && salvageEvt.kind === 'weapon_salvaged') {
        expect(salvageEvt.playerId).toBe(p1.id);
        expect(salvageEvt.itemId).toBe(groundItem.id);
        expect(salvageEvt.weaponId).toBe(wepDef.id);
        expect(salvageEvt.rarity).toBe(sample.rarity);
        expect(salvageEvt.goldEarned).toBe(sample.expectedGold);
      }

      // Release button before next iteration
      sim.setPlayerInput({
        seq: seq++,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
      });
      sim.step(SIM_STEP_SEC);
    }
  });

  it('2. blocks weapon salvage during combat, on priced shop items (costGold > 0), beyond 48px, or on another player instanced drop, and syncs salvageHoldTimer via snapshot', () => {
    const sim = new WorldSim({
      seed: 202611,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Liệp Ưng P2', 2);
    p1.weaponSlots = ['knight_sword', 'gale_smg'];
    p1.activeWeaponSlot = 1;
    p1.gold = 0;
    p2.gold = 0;

    const freeBow = sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: 'hunter_crossbow',
      rarity: 'uncommon',
      nameVi: WEAPONS.hunter_crossbow!.nameVi,
      costGold: 0,
      healAmount: 0,
      x: p1.x + 20,
      y: p1.y,
    });

    // 1. Live enemy in room blocks salvage
    const enemy = sim.spawnEnemy('goblin_shooter', p1.x + 220, p1.y, true);
    expect(findSalvageableWeaponNearPlayer(sim, p1, 48)).toBeUndefined();

    // Remove live enemy -> salvage target is available again
    sim.enemies.length = 0;
    expect(findSalvageableWeaponNearPlayer(sim, p1, 48)?.id).toBe(freeBow.id);

    // 2. Distance > 48px cannot be salvaged
    freeBow.x = p1.x + 60;
    expect(findSalvageableWeaponNearPlayer(sim, p1, 48)).toBeUndefined();

    // 3. Priced item (costGold > 0) cannot be salvaged
    freeBow.x = p1.x + 20;
    freeBow.costGold = 55;
    expect(findSalvageableWeaponNearPlayer(sim, p1, 48)).toBeUndefined();

    // 4. Instanced item owned by P2 cannot be salvaged by P1, but can be salvaged by P2
    freeBow.costGold = 0;
    freeBow.ownerPlayerId = p2.id;
    expect(findSalvageableWeaponNearPlayer(sim, p1, 48)).toBeUndefined();

    p2.x = freeBow.x;
    p2.y = freeBow.y;
    expect(findSalvageableWeaponNearPlayer(sim, p2, 48)?.id).toBe(freeBow.id);

    // Step 12 ticks of P2 holding DROP_WEAPON and verify snapshot syncs salvageHoldTimer
    for (let t = 0; t < 12; t++) {
      sim.setCoopPlayerInput(p2.id, {
        seq: t + 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.DROP_WEAPON,
      });
      sim.step(SIM_STEP_SEC);
    }
    expect(p2.salvageHoldTimer).toBeCloseTo(0.2, 2);

    const snap = encodeWorldSnapshot(sim, []);
    const clientTransport = new NetworkTransport({
      seed: 202611,
      startInHub: false,
      localPlayerId: 2,
      localPlayerSlot: 2,
      wifiProfile: 'off',
    });
    clientTransport.receiveSnapshot(snap);
    const clientP2 = clientTransport.getLocalPlayerState();
    expect(clientP2.salvageHoldTimer).toBeCloseTo(0.2, 2);
    expect(clientP2.salvageTargetItemId).toBe(freeBow.id);

    // Finish remaining 18 ticks -> P2 gets +15 Gold, P1 gets 0 Gold
    for (let t = 12; t < 30; t++) {
      sim.setCoopPlayerInput(p2.id, {
        seq: t + 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.DROP_WEAPON,
      });
      sim.step(SIM_STEP_SEC);
    }
    expect(p2.gold).toBe(15);
    expect(p1.gold).toBe(0);
    expect(enemy.hp).toBeGreaterThan(0);
  });

  it('3. awards +10 Gold Flawless Room Bonus (flawless_room_cleared) per undamaged player on clearing combat/portal/boss rooms and forfeits bonus if HP or Armor damage was taken', () => {
    const sim = new WorldSim({
      seed: 202612,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Liệp Ưng P2', 2);

    const combatRooms = sim.dungeon.rooms.filter((r) => r.type === 'combat' && !r.isChallenge);
    const roomA = combatRooms[0]!;
    const roomB = combatRooms[1]!;

    // Room A: neither P1 nor P2 takes damage -> both receive +10 Gold flawless bonus
    sim.enterRoom(roomA.id);
    expect(p1.tookDamageInCurrentRoom).toBe(false);
    expect(p2.tookDamageInCurrentRoom).toBe(false);
    p1.gold = 0;
    p2.gold = 0;
    sim.consumeEvents();

    sim.skipCurrentRoomWaves();
    // Filter out any enemy gold drops (not collected yet) — player.gold only has the flawless bonus!
    expect(p1.gold).toBe(10);
    expect(p2.gold).toBe(10);

    const eventsA = sim.consumeEvents();
    const flawlessEventsA = eventsA.filter((e) => e.kind === 'flawless_room_cleared');
    expect(flawlessEventsA).toHaveLength(2);
    for (const ev of flawlessEventsA) {
      if (ev.kind === 'flawless_room_cleared') {
        expect(ev.goldBonus).toBe(10);
        expect(ev.labelVi).toBe('+10 VÀNG HOÀN HẢO!');
      }
    }

    // Room B: P1 takes 1 Armor damage before room clear; P2 takes 0 damage -> only P2 gets +10 Gold!
    sim.enterRoom(roomB.id);
    expect(p1.tookDamageInCurrentRoom).toBe(false);
    expect(p2.tookDamageInCurrentRoom).toBe(false);

    sim.applyDamageToPlayer(1, 0, 0, 'enemy', p1);
    expect(p1.tookDamageInCurrentRoom).toBe(true);
    expect(p2.tookDamageInCurrentRoom).toBe(false);

    p1.gold = 0;
    p2.gold = 0;
    sim.consumeEvents();

    sim.skipCurrentRoomWaves();
    expect(p1.gold).toBe(0);
    expect(p2.gold).toBe(10);

    const eventsB = sim.consumeEvents();
    const flawlessEventsB = eventsB.filter((e) => e.kind === 'flawless_room_cleared');
    expect(flawlessEventsB).toHaveLength(1);
    if (flawlessEventsB[0]?.kind === 'flawless_room_cleared') {
      expect(flawlessEventsB[0].playerId).toBe(p2.id);
    }
  });

  it('4. standardizes Merchant pricing across Floors 1..6 and supports buying blessing_scroll (68G) and weapon_upgrade (75G)', () => {
    expect(MERCHANT_BASE_PRICES).toEqual({
      health_potion: 32,
      armor_upgrade: 32,
      weapon: 55,
      blessing_scroll: 68,
      weapon_upgrade: 75,
    });

    const expectedByFloor: Record<
      number,
      {
        health_potion: number;
        armor_upgrade: number;
        weapon: number;
        blessing_scroll: number;
        weapon_upgrade: number;
      }
    > = {
      1: { health_potion: 32, armor_upgrade: 32, weapon: 55, blessing_scroll: 68, weapon_upgrade: 75 },
      2: { health_potion: 35, armor_upgrade: 35, weapon: 61, blessing_scroll: 75, weapon_upgrade: 83 },
      3: { health_potion: 38, armor_upgrade: 38, weapon: 66, blessing_scroll: 82, weapon_upgrade: 90 },
      4: { health_potion: 42, armor_upgrade: 42, weapon: 72, blessing_scroll: 88, weapon_upgrade: 98 },
      5: { health_potion: 45, armor_upgrade: 45, weapon: 77, blessing_scroll: 95, weapon_upgrade: 105 },
      6: { health_potion: 48, armor_upgrade: 48, weapon: 83, blessing_scroll: 102, weapon_upgrade: 113 },
    };

    for (let globalFloor = 1; globalFloor <= 6; globalFloor++) {
      const exp = expectedByFloor[globalFloor]!;
      expect(computeMerchantOfferCost(MERCHANT_BASE_PRICES.health_potion, globalFloor)).toBe(
        exp.health_potion,
      );
      expect(computeMerchantOfferCost(MERCHANT_BASE_PRICES.armor_upgrade, globalFloor)).toBe(
        exp.armor_upgrade,
      );
      expect(computeMerchantOfferCost(MERCHANT_BASE_PRICES.weapon, globalFloor)).toBe(exp.weapon);
      expect(computeMerchantOfferCost(MERCHANT_BASE_PRICES.blessing_scroll, globalFloor)).toBe(
        exp.blessing_scroll,
      );
      expect(computeMerchantOfferCost(MERCHANT_BASE_PRICES.weapon_upgrade, globalFloor)).toBe(
        exp.weapon_upgrade,
      );

      const biome = (Math.ceil(globalFloor / 2) as 1 | 2 | 3);
      const localFloor: 1 | 2 = globalFloor % 2 === 1 ? 1 : 2;
      const floorGraph = generateDungeonFloor(9000 + globalFloor, localFloor, biome, 1);
      const merchant = floorGraph.rooms.find((r) => r.type === 'merchant')!;
      const byKind = Object.fromEntries(merchant.shopOffers.map((o) => [o.kind, o.costGold]));
      expect(byKind.health_potion).toBe(exp.health_potion);
      expect(byKind.armor_upgrade).toBe(exp.armor_upgrade);
      expect(byKind.weapon).toBe(exp.weapon);
      expect(byKind.blessing_scroll).toBe(exp.blessing_scroll);
      expect(byKind.weapon_upgrade).toBe(exp.weapon_upgrade);
    }

    // Verify purchasing blessing_scroll and weapon_upgrade in Merchant room on Floor 1
    const sim = new WorldSim({
      seed: 202613,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const merchantRoom = sim.dungeon.rooms.find((r) => r.type === 'merchant')!;
    sim.enterRoom(merchantRoom.id);

    const blessingOffer = sim.worldItems.find((it) => it.kind === 'blessing_scroll')!;
    const upgradeOffer = sim.worldItems.find((it) => it.kind === 'weapon_upgrade')!;
    expect(blessingOffer).toBeDefined();
    expect(upgradeOffer).toBeDefined();
    expect(blessingOffer.costGold).toBe(68);
    expect(upgradeOffer.costGold).toBe(75);

    sim.player.gold = 200;
    const blessingsBefore = sim.player.blessingIds.length;
    expect(sim.pickupOrBuyWorldItem(blessingOffer, sim.player)).toBe(true);
    expect(sim.player.gold).toBe(200 - 68);
    expect(sim.player.blessingIds.length).toBe(blessingsBefore + 1);

    const slot = sim.player.activeWeaponSlot;
    const levelBefore = sim.player.weaponUpgradeLevels?.[slot] ?? 0;
    expect(sim.pickupOrBuyWorldItem(upgradeOffer, sim.player)).toBe(true);
    expect(sim.player.gold).toBe(200 - 68 - 75);
    expect(sim.player.weaponUpgradeLevels?.[slot]).toBe(levelBefore + 1);
  });
});
