import { describe, expect, it } from 'vitest';
import {
  ALL_CHARACTER_IDS,
  CHARACTERS,
  MAX_WEAPON_SLOTS,
  PHASE1_SAMPLE_WEAPONS,
  SIM_STEP_SEC,
  WEAPONS,
  WorldSim,
  encodeWorldSnapshot,
  estimateSnapshotBytes,
  estimateWeaponDps,
} from '../src/index.js';

describe('Phase P2 — 2-Slot Weapon System, Dropped Weapons, Pickup Lock & Hub Rack', () => {
  it('1. enforces MAX_WEAPON_SLOTS === 2 and starts all 5 characters with [starterWeaponId, rusty_pistol]', () => {
    expect(MAX_WEAPON_SLOTS).toBe(2);
    expect(PHASE1_SAMPLE_WEAPONS).toEqual(['knight_sword', 'rusty_pistol']);
    expect(estimateWeaponDps('knight_sword')).toBeGreaterThan(0);
    expect(estimateWeaponDps('unknown_weapon')).toBe(0);

    const sim = new WorldSim({
      seed: 101,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    expect(sim.player.weaponSlots).toEqual(['knight_sword', 'rusty_pistol']);

    for (const charId of ALL_CHARACTER_IDS) {
      sim.selectCharacter(sim.player.id, charId, true);
      const expectedStarter = CHARACTERS[charId].starterWeaponId;
      expect(sim.player.weaponSlots).toEqual([expectedStarter, 'rusty_pistol']);
      expect(sim.player.weaponSlots).toHaveLength(MAX_WEAPON_SLOTS);
    }
  });

  it('2. swaps full 2-slot inventory on ground pickup, removes picked item, spawns old weapon at exact item coords, and emits weapon_dropped + weapon_swapped with playerId', () => {
    const sim = new WorldSim({
      seed: 202,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    sim.consumeEvents();

    expect(sim.player.weaponSlots).toEqual(['knight_sword', 'rusty_pistol']);
    sim.equipWeaponSlot(1);
    sim.consumeEvents();

    const bowDef = WEAPONS.hunter_crossbow!;
    const groundItem = sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: bowDef.id,
      rarity: bowDef.rarity,
      nameVi: bowDef.nameVi,
      costGold: 0,
      healAmount: 0,
      x: 320,
      y: 240,
    });

    const picked = sim.pickupOrBuyWorldItem(groundItem, sim.player);
    expect(picked).toBe(true);
    expect(sim.player.weaponSlots).toEqual(['knight_sword', 'hunter_crossbow']);
    expect(sim.player.weaponSlots).toHaveLength(2);
    expect(groundItem.pickedUp).toBe(true);
    expect(sim.worldItems.includes(groundItem)).toBe(false);

    const droppedPistol = sim.worldItems.find((it) => it.weaponId === 'rusty_pistol');
    expect(droppedPistol).toBeDefined();
    expect(droppedPistol!.costGold).toBe(0);
    expect(droppedPistol!.ownerPlayerId).toBeUndefined();
    expect(droppedPistol!.x).toBe(320);
    expect(droppedPistol!.y).toBe(240);
    expect(droppedPistol!.droppedByPlayerId).toBe(sim.player.id);

    const events = sim.consumeEvents();
    const dropEvt = events.find((e) => e.kind === 'weapon_dropped');
    const swapEvt = events.find((e) => e.kind === 'weapon_swapped');
    expect(dropEvt).toBeDefined();
    if (dropEvt && dropEvt.kind === 'weapon_dropped') {
      expect(dropEvt.playerId).toBe(sim.player.id);
      expect(dropEvt.weaponId).toBe('rusty_pistol');
      expect(dropEvt.x).toBe(320);
      expect(dropEvt.y).toBe(240);
    }
    expect(swapEvt).toBeDefined();
    if (swapEvt && swapEvt.kind === 'weapon_swapped') {
      expect(swapEvt.playerId).toBe(sim.player.id);
      expect(swapEvt.weaponId).toBe('hunter_crossbow');
      expect(swapEvt.slot).toBe(1);
    }
  });

  it('3. purchases weapon at Merchant when full (2/2), marks shop offer purchased, deducts gold, and spawns old weapon as free shared worldItem at shop offer position', () => {
    const sim = new WorldSim({
      seed: 303,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const merchantRoom = sim.dungeon.rooms.find((r) => r.type === 'merchant')!;
    sim.enterRoom(merchantRoom.id);

    const weaponItem = sim.worldItems.find((it) => it.kind === 'weapon' && it.costGold > 0)!;
    expect(weaponItem).toBeDefined();
    const offerX = weaponItem.x;
    const offerY = weaponItem.y;
    const cost = weaponItem.costGold;

    sim.player.gold = cost + 20;
    sim.player.activeWeaponSlot = 1; // rusty_pistol

    const bought = sim.pickupOrBuyWorldItem(weaponItem, sim.player);
    expect(bought).toBe(true);
    expect(sim.player.gold).toBe(20);
    expect(weaponItem.pickedUp).toBe(true);

    if (weaponItem.offerId) {
      const offer = merchantRoom.shopOffers.find((o) => o.id === weaponItem.offerId);
      expect(offer?.purchased).toBe(true);
    }

    const droppedOld = sim.worldItems.find(
      (it) => !it.pickedUp && it.weaponId === 'rusty_pistol' && it.costGold === 0,
    );
    expect(droppedOld).toBeDefined();
    expect(droppedOld!.ownerPlayerId).toBeUndefined();
    expect(droppedOld!.x).toBe(offerX);
    expect(droppedOld!.y).toBe(offerY);
  });

  it('4. enforces 0.3s (18 ticks) pickup lock for dropper while allowing teammate immediate pickup or dropper pickup after 18 ticks', () => {
    const sim = new WorldSim({
      seed: 404,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'P2', 2);

    const bowDef = WEAPONS.hunter_crossbow!;
    const item = sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: bowDef.id,
      rarity: bowDef.rarity,
      nameVi: bowDef.nameVi,
      costGold: 0,
      healAmount: 0,
      x: p1.x,
      y: p1.y,
    });

    p1.activeWeaponSlot = 1;
    expect(sim.pickupOrBuyWorldItem(item, p1)).toBe(true);

    const dropped = sim.worldItems.find((it) => it.weaponId === 'rusty_pistol')!;
    expect(dropped).toBeDefined();

    // Within < 18 ticks (e.g. 5 ticks), P1 cannot re-pickup the dropped weapon directly or via interactWithNearest
    for (let i = 0; i < 5; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.pickupOrBuyWorldItem(dropped, p1)).toBe(false);
    expect(sim.interactWithNearest(p1)).toBe(false);

    // Co-op teammate P2 can pick up the dropped weapon immediately even while P1's lock is active!
    p2.weaponSlots = ['hunter_crossbow', 'gale_smg'];
    p2.activeWeaponSlot = 1;
    p2.x = dropped.x;
    p2.y = dropped.y;
    expect(sim.pickupOrBuyWorldItem(dropped, p2)).toBe(true);
    expect(p2.weaponSlots[1]).toBe('rusty_pistol');

    // Now P2 dropped 'gale_smg' at dropped.x, dropped.y; test P2 waiting >= 18 ticks to pick it back up
    const droppedByP2 = sim.worldItems.find((it) => it.weaponId === 'gale_smg')!;
    expect(droppedByP2).toBeDefined();
    expect(sim.pickupOrBuyWorldItem(droppedByP2, p2)).toBe(false);

    for (let i = 0; i < 18; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.pickupOrBuyWorldItem(droppedByP2, p2)).toBe(true);
    expect(p2.weaponSlots[1]).toBe('gale_smg');
  });

  it('5. converts P1 old weapon into a shared worldItem when P1 picks up instanced chest loot in co-op', () => {
    const sim = new WorldSim({
      seed: 505,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'elementalist', 'P2', 2);

    const chest = sim.spawnChest(300, 260, 'rare', 'tesla_carbine');
    expect(sim.openChest(chest)).toBe(true);

    const p1Instanced = sim.worldItems.find((it) => it.ownerPlayerId === p1.id)!;
    expect(p1Instanced).toBeDefined();
    // P2 cannot pick up P1's instanced chest drop directly
    expect(sim.pickupOrBuyWorldItem(p1Instanced, p2)).toBe(false);

    // P1 (full 2/2) picks up P1's instanced chest weapon -> P1's old weapon ('rusty_pistol') drops as a SHARED worldItem
    p1.activeWeaponSlot = 1;
    expect(sim.pickupOrBuyWorldItem(p1Instanced, p1)).toBe(true);

    const sharedOldWeapon = sim.worldItems.find(
      (it) => it.weaponId === 'rusty_pistol' && !it.pickedUp,
    );
    expect(sharedOldWeapon).toBeDefined();
    expect(sharedOldWeapon!.ownerPlayerId).toBeUndefined();

    // P2 can pick up P1's dropped old weapon!
    p2.weaponSlots = ['apprentice_staff', 'gale_smg'];
    p2.activeWeaponSlot = 1;
    expect(sim.pickupOrBuyWorldItem(sharedOldWeapon!, p2)).toBe(true);
    expect(p2.weaponSlots[1]).toBe('rusty_pistol');
  });

  it('6. keeps worldItems count and snapshot byte size bounded across 200 consecutive weapon swaps', () => {
    const sim = new WorldSim({
      seed: 606,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const wepDef = WEAPONS.hunter_crossbow!;
    sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: wepDef.id,
      rarity: wepDef.rarity,
      nameVi: wepDef.nameVi,
      costGold: 0,
      healAmount: 0,
      x: sim.player.x,
      y: sim.player.y,
    });

    sim.player.activeWeaponSlot = 1;
    let bytesAfterFirstSwap = 0;
    let jsonLenAfterFirstSwap = 0;

    for (let swapIdx = 0; swapIdx < 200; swapIdx++) {
      for (let t = 0; t < 18; t++) {
        sim.step(SIM_STEP_SEC);
      }
      sim.consumeEvents();
      const targetItem = sim.worldItems.find((it) => !it.offerId)!;
      expect(targetItem).toBeDefined();
      expect(sim.pickupOrBuyWorldItem(targetItem, sim.player)).toBe(true);
      sim.consumeEvents();

      if (swapIdx === 0) {
        const snap1 = encodeWorldSnapshot(sim, []);
        bytesAfterFirstSwap = estimateSnapshotBytes(snap1);
        jsonLenAfterFirstSwap = JSON.stringify(snap1).length;
      }
    }

    const nonOfferItems = sim.worldItems.filter((it) => !it.offerId);
    expect(nonOfferItems).toHaveLength(1);

    const snap200 = encodeWorldSnapshot(sim, []);
    const bytesAfter200Swaps = estimateSnapshotBytes(snap200);
    const jsonLenAfter200Swaps = JSON.stringify(snap200).length;
    expect(bytesAfter200Swaps - bytesAfterFirstSwap).toBeLessThanOrEqual(64);
    expect(jsonLenAfter200Swaps - jsonLenAfterFirstSwap).toBeLessThanOrEqual(64);
  });

  it('7. persists dropped weapons in the start room (room.id === 0) across room transitions', () => {
    const sim = new WorldSim({
      seed: 707,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    expect(sim.currentRoomId).toBe(0);

    const dropped = sim.dropActiveWeapon(sim.player.id);
    expect(dropped).not.toBeNull();
    const droppedWeaponId = dropped!.weaponId;

    const otherRoom = sim.dungeon.rooms.find((r) => r.id !== 0)!;
    expect(sim.enterRoom(otherRoom.id)).toBe(true);
    expect(sim.currentRoomId).toBe(otherRoom.id);

    // Return to start room (id === 0)
    expect(sim.enterRoom(0)).toBe(true);
    expect(sim.currentRoomId).toBe(0);

    const restored = sim.worldItems.find((it) => it.weaponId === droppedWeaponId && !it.pickedUp);
    expect(restored).toBeDefined();
  });

  it('8. auto-replenishes Hub weapon rack on pickup, clears Hub items on run start, and prevents bot autoplay from looping on dropped or lower-DPS weapons', () => {
    const sim = new WorldSim({
      seed: 808,
      startInHub: true,
    });
    expect(sim.inHub).toBe(true);

    const initialRackItems = sim.worldItems.filter((it) => it.isHubRackItem);
    expect(initialRackItems).toHaveLength(4);

    // Pick up hunter_crossbow from the Hub rack while full (2/2)
    const rackBow = initialRackItems.find((it) => it.weaponId === 'hunter_crossbow')!;
    expect(rackBow).toBeDefined();
    const rackX = rackBow.x;
    const rackY = rackBow.y;

    sim.player.activeWeaponSlot = 1;
    expect(sim.pickupOrBuyWorldItem(rackBow, sim.player)).toBe(true);

    // Hub rack still has 4 active rack weapons including a replenished hunter_crossbow at (rackX, rackY)
    const replenishedRackItems = sim.worldItems.filter((it) => it.isHubRackItem && !it.pickedUp);
    expect(replenishedRackItems).toHaveLength(4);
    const replenishedBow = replenishedRackItems.find((it) => it.weaponId === 'hunter_crossbow');
    expect(replenishedBow).toBeDefined();
    expect(replenishedBow!.x).toBe(rackX);
    expect(replenishedBow!.y).toBe(rackY);

    // Starting dungeon run from Hub clears all Hub rack and dropped items
    sim.startDungeonRunFromHub();
    expect(sim.inHub).toBe(false);
    expect(sim.worldItems.filter((it) => it.isHubRackItem)).toHaveLength(0);

    // Bot autoplay check: does not pick up a weapon it just dropped or a lower-DPS weapon
    sim.enemies.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.player.weaponSlots = ['knight_sword', 'solar_archon_staff'];
    sim.player.activeWeaponSlot = 1;

    // Spawn a low-DPS pistol right at player position and a weapon dropped by player
    const pistolDef = WEAPONS.rusty_pistol!;
    sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: pistolDef.id,
      rarity: pistolDef.rarity,
      nameVi: pistolDef.nameVi,
      costGold: 0,
      healAmount: 0,
      x: sim.player.x,
      y: sim.player.y,
    });
    const bowDef = WEAPONS.hunter_crossbow!;
    sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: bowDef.id,
      rarity: bowDef.rarity,
      nameVi: bowDef.nameVi,
      costGold: 0,
      healAmount: 0,
      x: sim.player.x,
      y: sim.player.y,
      droppedByPlayerId: sim.player.id,
      droppedAtTick: sim.tick,
    });

    sim.stepBotAutoPlay(SIM_STEP_SEC);
    expect(sim.player.weaponSlots).toEqual(['knight_sword', 'solar_archon_staff']);
  });
});
