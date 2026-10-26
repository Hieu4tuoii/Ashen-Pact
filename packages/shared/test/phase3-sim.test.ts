import { describe, expect, it } from 'vitest';
import {
  BIOME1_COMBAT_ENEMIES,
  ELITE_MODIFIERS,
  ENEMIES,
  FLOOR_BUFF_LIST,
  INPUT_BUTTON,
  PHASE3_WEAPON_IDS,
  WEAPONS,
  WorldSim,
  generateDungeonFloor,
  verifyDungeonConnectivity,
} from '../src/index.js';

describe('Phase 3 Dungeon Generation & Connectivity', () => {
  it('generates 100% connected 10-room dungeons across 50 seeds on Floor 1 and Floor 2', () => {
    for (let s = 1; s <= 50; s++) {
      const seed = s * 1337;
      const floor1 = generateDungeonFloor(seed, 1, 1);
      const v1 = verifyDungeonConnectivity(floor1);
      expect(v1.valid).toBe(true);
      expect(v1.totalRooms).toBe(10);
      expect(v1.reachableCount).toBe(10);
      expect(v1.hasAllRoomTypes).toBe(true);
      expect(v1.bidirectionalLinks).toBe(true);
      expect(floor1.rooms.some((r) => r.type === 'start')).toBe(true);
      expect(floor1.rooms.some((r) => r.type === 'treasure')).toBe(true);
      expect(floor1.rooms.some((r) => r.type === 'merchant')).toBe(true);
      expect(floor1.rooms.some((r) => r.type === 'shrine')).toBe(true);
      expect(floor1.rooms.some((r) => r.type === 'secret')).toBe(true);
      expect(floor1.rooms.some((r) => r.type === 'portal')).toBe(true);
      expect(floor1.rooms.filter((r) => r.type === 'combat').length).toBeGreaterThanOrEqual(4);

      const floor2 = generateDungeonFloor(seed + 7919, 2, 1);
      const v2 = verifyDungeonConnectivity(floor2);
      expect(v2.valid).toBe(true);
      expect(v2.reachableCount).toBe(10);
      expect(floor2.rooms.some((r) => r.type === 'boss')).toBe(true);
    }
  });
});

describe('Phase 3 Weapons, Enemies, Elites & Boss Mục Vương', () => {
  it('defines 14 weapons across all 5 rarities and allows firing each', () => {
    expect(PHASE3_WEAPON_IDS.length).toBe(14);
    const rarities = new Set(PHASE3_WEAPON_IDS.map((id) => WEAPONS[id]!.rarity));
    expect(rarities.has('common')).toBe(true);
    expect(rarities.has('uncommon')).toBe(true);
    expect(rarities.has('rare')).toBe(true);
    expect(rarities.has('epic')).toBe(true);
    expect(rarities.has('legendary')).toBe(true);

    const sim = new WorldSim({ seed: 12345, spawnInitialWave: false });
    sim.player.godMode = true;
    let seq = 1;
    for (const weaponId of PHASE3_WEAPON_IDS) {
      sim.player.weaponSlots[0] = weaponId;
      sim.equipWeaponSlot(0);
      sim.player.fireCooldownTimer = 0;
      sim.player.energy = sim.player.maxEnergy;
      expect(sim.getActiveWeaponId()).toBe(weaponId);

      sim.setPlayerInput({
        seq: seq++,
        tick: sim.tick,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.FIRE,
        weaponSlotSelect: null,
      });
      sim.step(1 / 60);
    }
  });

  it('supports all 6 Biome 1 combat enemies including Green Slime split, Shaman heal & Thorn Turret burst', () => {
    expect(BIOME1_COMBAT_ENEMIES).toEqual([
      'goblin_shooter',
      'green_slime',
      'spore_bomber',
      'wild_boar',
      'goblin_shaman',
      'thorn_turret',
    ]);

    const sim = new WorldSim({
      seed: 2026,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });
    sim.player.godMode = true;

    // 1. Green Slime splits into 2 mini_slime on death
    const slime = sim.spawnEnemy('green_slime', sim.player.x + 48, sim.player.y, true);
    sim.player.weaponSlots[0] = 'emerald_cleaver';
    sim.equipWeaponSlot(0);
    let seq = 1;
    for (let i = 0; i < 60; i++) {
      const aimAngle = Math.atan2(slime.y - sim.player.y, slime.x - sim.player.x);
      sim.setPlayerInput({
        seq: seq++,
        tick: sim.tick,
        moveX: 0,
        moveY: 0,
        aimAngle,
        buttons: INPUT_BUTTON.FIRE,
        weaponSlotSelect: null,
      });
      sim.step(1 / 60);
      if (slime.hp <= 0) break;
    }
    expect(slime.hp).toBe(0);
    const miniSlimes = sim.enemies.filter((e) => e.defId === 'mini_slime' && e.hp > 0);
    expect(miniSlimes.length).toBe(2);

    // 2. Goblin Shaman heals wounded allies (and poison reduces healing by 50%)
    sim.enemies.length = 0;
    const boar = sim.spawnEnemy('wild_boar', 480, 480, true);
    boar.hp = 15;
    const shaman = sim.spawnEnemy('goblin_shaman', 520, 480, true);
    shaman.attackCooldownTimer = 0;
    sim.setPlayerInput({
      seq: seq++,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
      weaponSlotSelect: null,
    });
    for (let i = 0; i < 40; i++) {
      sim.step(1 / 60);
    }
    expect(boar.hp).toBeGreaterThan(15);

    // 3. Thorn Turret fires 6-thorn radial burst
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    const turret = sim.spawnEnemy('thorn_turret', sim.player.x + 150, sim.player.y, true);
    turret.attackCooldownTimer = 0;
    for (let i = 0; i < 60; i++) {
      sim.step(1 / 60);
    }
    const enemyProjectiles = sim.projectiles.filter((p) => p.team === 'enemy');
    expect(enemyProjectiles.length).toBeGreaterThanOrEqual(6);
  });

  it('spawns Elite enemies with all 4 modifiers (fast, shield, explosive_death, regen)', () => {
    const sim = new WorldSim({ seed: 3030, spawnInitialWave: false, includeTrainingDummy: false });
    for (const mod of ELITE_MODIFIERS) {
      const elite = sim.spawnEnemy('goblin_shooter', 450, 450, true, mod);
      expect(elite.isElite).toBe(true);
      expect(elite.eliteModifier).toBe(mod);
      expect(elite.maxHp).toBeGreaterThan(ENEMIES.goblin_shooter!.hp);
      if (mod === 'shield') {
        expect(elite.maxShieldArmor).toBeGreaterThan(0);
      }
    }
  });

  it('runs Boss Mục Vương Nấm Độc through Phase 1 -> Phase 2 -> Phase 3 -> Victory', () => {
    const sim = new WorldSim({
      seed: 7777,
      campaignMaxFloors: 2,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    sim.player.godMode = true;
    sim.advanceToFloor(2);
    const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss');
    expect(bossRoom).toBeDefined();

    sim.enterRoom(bossRoom!.id);
    // Advance past 0.8s summoning portal
    for (let i = 0; i < 60; i++) {
      sim.step(1 / 60);
    }

    const boss = sim.getActiveBoss();
    expect(boss).not.toBeNull();
    expect(boss!.defId).toBe('spore_king');
    expect(boss!.bossPhase).toBe(1);

    sim.player.weaponSlots[0] = 'solar_archon_staff';
    sim.equipWeaponSlot(0);
    let seq = 1;

    // Damage boss below 66% -> Phase 2
    for (let i = 0; i < 2400 && boss!.hp > boss!.maxHp * 0.62; i++) {
      sim.player.energy = sim.player.maxEnergy;
      const aimAngle = Math.atan2(boss!.y - sim.player.y, boss!.x - sim.player.x);
      sim.setPlayerInput({
        seq: seq++,
        tick: sim.tick,
        moveX: 0,
        moveY: 0,
        aimAngle,
        buttons: INPUT_BUTTON.FIRE,
        weaponSlotSelect: null,
      });
      sim.step(1 / 60);
    }
    expect(boss!.bossPhase).toBeGreaterThanOrEqual(2);

    // Wait out burrow if burrowed, then damage below 33% -> Phase 3
    for (let i = 0; i < 2400 && boss!.hp > boss!.maxHp * 0.28; i++) {
      sim.player.energy = sim.player.maxEnergy;
      const aimAngle = Math.atan2(boss!.y - sim.player.y, boss!.x - sim.player.x);
      sim.setPlayerInput({
        seq: seq++,
        tick: sim.tick,
        moveX: 0,
        moveY: 0,
        aimAngle,
        buttons: INPUT_BUTTON.FIRE,
        weaponSlotSelect: null,
      });
      sim.step(1 / 60);
    }
    expect(boss!.bossPhase).toBe(3);
    // Phase 3 creates toxic swamp border around outer interior tiles
    expect(sim.map.getSurfaceAtWorld(64, 64)).toBe('poison_swamp');

    // Finish off Boss -> Victory & Legendary chest
    for (let i = 0; i < 3600 && boss!.hp > 0; i++) {
      sim.player.energy = sim.player.maxEnergy;
      const aimAngle = Math.atan2(boss!.y - sim.player.y, boss!.x - sim.player.x);
      sim.setPlayerInput({
        seq: seq++,
        tick: sim.tick,
        moveX: 0,
        moveY: 0,
        aimAngle,
        buttons: INPUT_BUTTON.FIRE,
        weaponSlotSelect: null,
      });
      sim.step(1 / 60);
    }
    expect(boss!.hp).toBe(0);
    // Kill any remaining summoned mini_slimes to trigger room clear -> victory
    sim.skipCurrentRoomWaves();
    expect(sim.runState).toBe('victory');
    expect(sim.chests.some((c) => c.rarity === 'legendary')).toBe(true);
  });

  it('supports Room transitions, Chest, Merchant, Shrine, Secret room & Floor Buffs', () => {
    expect(FLOOR_BUFF_LIST.length).toBeGreaterThanOrEqual(6);
    const sim = new WorldSim({ seed: 9999, spawnInitialWave: false });
    const treasureRoom = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
    sim.enterRoom(treasureRoom.id);
    expect(sim.chests.length).toBe(1);
    const chest = sim.chests[0]!;
    sim.player.x = chest.x;
    sim.player.y = chest.y;
    expect(sim.interactWithNearest()).toBe(true);
    expect(chest.opened).toBe(true);
    expect(sim.worldItems.length).toBeGreaterThanOrEqual(1);

    // Merchant room purchase
    const merchantRoom = sim.dungeon.rooms.find((r) => r.type === 'merchant')!;
    sim.enterRoom(merchantRoom.id);
    expect(sim.worldItems.length).toBe(3);
    sim.player.gold = 200;
    const shopItem = sim.worldItems[0]!;
    sim.player.x = shopItem.x;
    sim.player.y = shopItem.y;
    expect(sim.interactWithNearest()).toBe(true);
    expect(shopItem.pickedUp).toBe(true);

    // Shrine room interaction
    const shrineRoom = sim.dungeon.rooms.find((r) => r.type === 'shrine')!;
    sim.enterRoom(shrineRoom.id);
    const shrine = sim.npcEntities.find((n) => n.kind === 'shrine')!;
    expect(shrine).toBeDefined();
    sim.player.x = shrine.x;
    sim.player.y = shrine.y;
    expect(sim.interactWithNearest()).toBe(true);
    expect(shrine.interacted).toBe(true);

    // Portal room -> clear wave -> Buff Choice -> Floor 2
    const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal')!;
    sim.enterRoom(portalRoom.id);
    sim.skipCurrentRoomWaves();
    expect(sim.portalActive).toBe(true);
    sim.player.x = sim.portalX;
    sim.player.y = sim.portalY;
    expect(sim.interactWithNearest()).toBe(true);
    expect(sim.runState).toBe('buff_choice');
    expect(sim.pendingBuffChoices.length).toBe(3);

    const chosenBuff = sim.pendingBuffChoices[0]!;
    expect(sim.selectFloorBuff(chosenBuff)).toBe(true);
    expect(sim.currentFloor).toBe(2);
    expect(sim.activeBuffIds).toContain(chosenBuff);
  });

  it('auto-plays a full Floor 1 -> Buff Selection -> Floor 2 + Boss Mục Vương run via botAutoPlayActive', () => {
    const sim = new WorldSim({ seed: 202603, campaignMaxFloors: 2, autoRespawnWaves: false });
    sim.botAutoPlayActive = true;
    // Equip a strong ranged weapon for fast deterministic bot clear
    sim.player.weaponSlots[1] = 'solar_archon_staff';

    for (let tick = 0; tick < 12000 && sim.runState !== 'victory'; tick++) {
      sim.step(1 / 60);
    }

    expect(sim.currentFloor).toBe(2);
    expect(sim.runState).toBe('victory');
    expect(sim.runStats.bossesKilled).toBeGreaterThanOrEqual(1);
    expect(sim.runStats.roomsCleared).toBeGreaterThanOrEqual(3);
  });

  it('persists Merchant shop offers, Treasure chest drops, and Shrine blessings across room re-entries', () => {
    const sim = new WorldSim({ seed: 7777, spawnInitialWave: false });
    const merchantRoom = sim.dungeon.rooms.find((r) => r.type === 'merchant')!;
    const treasureRoom = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
    const shrineRoom = sim.dungeon.rooms.find((r) => r.type === 'shrine')!;

    // 1. Enter Merchant room, buy Armor Upgrade (+2 maxArmor, cost 65 Gold), leave and re-enter -> remains purchased
    sim.enterRoom(merchantRoom.id);
    expect(sim.worldItems.length).toBe(3);
    const armorOffer = sim.worldItems.find((it) => it.kind === 'armor_upgrade')!;
    expect(armorOffer).toBeDefined();
    const prevMaxArmor = sim.player.maxArmor;
    sim.player.gold = 120;
    expect(sim.pickupOrBuyWorldItem(armorOffer)).toBe(true);
    expect(sim.player.maxArmor).toBe(prevMaxArmor + 2);
    expect(sim.player.gold).toBe(55);

    const initialOfferIds = sim.worldItems.map((it) => it.id);
    sim.enterRoom(0);
    sim.enterRoom(merchantRoom.id);
    expect(sim.worldItems.map((it) => it.id)).toEqual(initialOfferIds);
    expect(sim.worldItems.find((it) => it.kind === 'armor_upgrade')?.pickedUp).toBe(true);

    // 2. Open Treasure chest, leave room without picking up weapon, re-enter -> weapon still on floor
    sim.enterRoom(treasureRoom.id);
    expect(sim.chests.length).toBe(1);
    expect(sim.openChest(sim.chests[0]!)).toBe(true);
    expect(sim.worldItems.length).toBe(1);
    const droppedWepId = sim.worldItems[0]!.weaponId;
    sim.enterRoom(0);
    sim.enterRoom(treasureRoom.id);
    expect(sim.chests.length).toBe(1);
    expect(sim.chests[0]!.opened).toBe(true);
    expect(sim.worldItems.length).toBe(1);
    expect(sim.worldItems[0]!.weaponId).toBe(droppedWepId);

    // 3. Shrine exchanges 40 Gold when player has gold, grants floor buff + +15 maxEnergy (no free weapon drop)
    sim.enterRoom(shrineRoom.id);
    const shrine = sim.npcEntities.find((n) => n.kind === 'shrine')!;
    const goldBefore = sim.player.gold;
    const hpBefore = sim.player.hp;
    const maxEnergyBefore = sim.player.maxEnergy;
    expect(sim.activateShrine(shrine)).toBe(true);
    expect(sim.player.gold).toBe(goldBefore - 40);
    expect(sim.player.hp).toBe(hpBefore);
    expect(sim.player.maxEnergy).toBe(maxEnergyBefore + 15);
    expect(sim.activeBuffIds.length).toBeGreaterThanOrEqual(1);
    expect(sim.worldItems.length).toBe(0);
  });

  it('applies eagle_precision, ricochet_mastery, gale_reflex, vanguard_fortress, and vanguard_charge buffs accurately', () => {
    const sim = new WorldSim({
      seed: 4242,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    sim.player.weaponSlots = ['rusty_pistol'];
    sim.player.activeWeaponSlot = 0;

    // 1. Apply gale_reflex, eagle_precision, ricochet_mastery
    sim.selectFloorBuff('gale_reflex');
    sim.selectFloorBuff('eagle_precision');
    sim.selectFloorBuff('ricochet_mastery');
    sim.advanceToFloor(1);
    sim.enemies.length = 0;
    sim.props.length = 0;

    sim.setPlayerInput({
      seq: 1,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
      weaponSlotSelect: null,
    });
    sim.step(1 / 60);

    expect(sim.projectiles.length).toBe(1);
    const bullet = sim.projectiles[0]!;
    const baseWep = WEAPONS.rusty_pistol!;
    expect(bullet.pierceRemaining).toBe(baseWep.pierceCount + 1);
    expect(bullet.bounceRemaining).toBe(baseWep.bounceCount + 1);
    expect(bullet.damage).toBeGreaterThanOrEqual(Math.round(baseWep.damage * 1.2));
    // gale_reflex reduces fireCooldownTimer by 1.22x fireRate
    expect(sim.player.fireCooldownTimer).toBeLessThan(1 / baseWep.fireRate);

    // 2. Test vanguard_fortress 360-degree shield block from behind player
    sim.selectFloorBuff('vanguard_fortress');
    sim.player.aimAngle = 0; // aiming East
    sim.player.skillActiveTimer = 2.0;
    const storedBefore = sim.player.shieldStoredBullets;
    // Spawn enemy projectile behind player (West of player, moving East into player back)
    sim.projectiles.push({
      id: 9999,
      ownerId: 500,
      team: 'enemy',
      weaponId: 'goblin_bow',
      prevX: sim.player.x - 32,
      prevY: sim.player.y,
      x: sim.player.x - 32,
      y: sim.player.y,
      vx: 200,
      vy: 0,
      angle: 0,
      radius: 5,
      damage: 2,
      isCrit: false,
      knockback: 20,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 1.0,
      element: 'none',
      amplifiedByShield: false,
      hitEntityIds: [],
    });
    sim.step(1 / 60);
    expect(sim.player.shieldStoredBullets).toBe(storedBefore + 1);

    // 3. Test vanguard_charge forward dash on shield shockwave release
    sim.selectFloorBuff('vanguard_charge');
    sim.player.x = 300;
    sim.player.y = 260;
    sim.player.skillActiveTimer = 1.5;
    const startX = sim.player.x;
    sim.setPlayerInput({
      seq: 2,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SKILL,
      weaponSlotSelect: null,
    });
    sim.step(1 / 60);
    expect(sim.player.x).toBeGreaterThan(startX + 60);
  });
});
