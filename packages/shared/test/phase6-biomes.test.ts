import { describe, expect, it } from 'vitest';
import {
  ALL_BOSS_IDS,
  ALL_WEAPON_IDS,
  BIOME2_COMBAT_ENEMIES,
  BIOME3_COMBAT_ENEMIES,
  ENEMIES,
  INPUT_BUTTON,
  PHASE3_WEAPON_IDS,
  PHASE6_WEAPON_IDS,
  SIM_STEP_SEC,
  TILE_SIZE,
  WEAPONS,
  WorldSim,
} from '../src/index.js';

describe('Phase 6 — Biomes 2 & 3, 18 Weapons, Co-op Mechanics & Bosses Kryssa / Forge Titan', () => {
  it('defines 18 weapons across 5 rarities while preserving Phase 3 10-weapon compatibility', () => {
    expect(PHASE3_WEAPON_IDS).toHaveLength(10);
    expect(PHASE6_WEAPON_IDS).toHaveLength(8);
    expect(ALL_WEAPON_IDS).toHaveLength(18);

    const rarities = new Set<string>();
    for (const id of ALL_WEAPON_IDS) {
      const w = WEAPONS[id];
      expect(w, `Weapon ${id} must exist`).toBeDefined();
      expect(w!.nameVi.length).toBeGreaterThan(2);
      expect(w!.damage).toBeGreaterThan(0);
      rarities.add(w!.rarity);
    }
    expect(rarities.size).toBe(5);
    expect(WEAPONS.seed_gun).toBeDefined();
    expect(WEAPONS.tether_staff).toBeDefined();
  });

  it('implements Co-op Seed Gun (life_blossom healing + poison) and Tether Staff (electric link beam)', () => {
    const sim = new WorldSim({
      seed: 601,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    // 1. Seed Gun spawns a blooming Life Blossom that heals damaged allies and poisons nearby enemies
    const p1 = sim.player;
    p1.x = 320;
    p1.y = 320;
    p1.hp = Math.max(1, p1.maxHp - 3);
    p1.weaponSlots[0] = 'seed_gun';
    p1.activeWeaponSlot = 0;

    const p2 = sim.addCoopPlayer(2, 'druid', 'Ally P2', 2);
    p2.x = 385;
    p2.y = 320;
    p2.hp = Math.max(1, p2.maxHp - 3);

    const target = sim.spawnEnemy('ice_golem', 390, 320, true);
    target.hp = 300;
    target.maxHp = 300;

    const initialP2Hp = p2.hp;
    for (let i = 0; i < 95; i++) {
      target.x = 390;
      target.y = 320;
      sim.setPlayerInput({
        seq: i + 1,
        tick: i + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: i === 0 ? INPUT_BUTTON.FIRE : 0,
      });
      sim.step(SIM_STEP_SEC);
    }

    const blossom = sim.summons.find((s) => s.kind === 'life_blossom');
    expect(blossom).toBeDefined();
    expect(p2.hp).toBeGreaterThan(initialP2Hp);
    expect(target.poisonTimer).toBeGreaterThan(0);

    // 2. Tether Staff links P1 and P2 with an arc beam that shocks enemies crossing the line
    p1.weaponSlots[0] = 'tether_staff';
    p1.fireCooldownTimer = 0;
    p1.x = 300;
    p1.y = 320;
    p2.x = 500;
    p2.y = 320;

    const crossingEnemy = sim.spawnEnemy('fire_imp', 400, 320, true);
    crossingEnemy.hp = 150;
    crossingEnemy.maxHp = 150;
    const hpBeforeTether = crossingEnemy.hp;

    for (let i = 0; i < 30; i++) {
      crossingEnemy.x = 400;
      crossingEnemy.y = 320;
      sim.setPlayerInput({
        seq: 200 + i,
        tick: 200 + i,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: i === 0 ? INPUT_BUTTON.FIRE : 0,
      });
      sim.step(SIM_STEP_SEC);
    }

    expect(sim.tetherBeams.length).toBeGreaterThan(0);
    expect(crossingEnemy.hp).toBeLessThan(hpBeforeTether);
    expect(crossingEnemy.shockTimer).toBeGreaterThan(0);
  });

  it('implements Biome 2 (Frozen Depths) surfaces, 5 enemy types, Ice Golem directional front shield, and Snow Spirit freeze burst', () => {
    expect(BIOME2_COMBAT_ENEMIES).toEqual([
      'frost_bat',
      'baby_yeti',
      'ice_mage',
      'ice_golem',
      'snow_spirit',
    ]);

    const sim = new WorldSim({
      seed: 602,
      biome: 2,
      mapConfig: { includeSurfaces: true, biome: 2 },
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    expect(sim.currentBiome).toBe(2);
    expect(sim.map.biome).toBe(2);
    sim.map.configureRoomLayout('combat', 602, true);

    // Verify Biome 2 combat room surfaces include ice and chasm
    let iceCount = 0;
    let chasmCount = 0;
    for (let s = 0; s < sim.map.surfaces.length; s++) {
      if (sim.map.surfaces[s] === 'ice') iceCount++;
      if (sim.map.surfaces[s] === 'chasm') chasmCount++;
    }
    expect(iceCount).toBeGreaterThan(0);
    expect(chasmCount).toBeGreaterThan(0);

    // Verify Ice Golem directional front shield reduces frontal hits by 78% vs flanking back hits
    const golem = sim.spawnEnemy('ice_golem', 450, 320, true);
    golem.hp = 500;
    golem.maxHp = 500;
    golem.aimAngle = Math.PI; // Facing left (towards X < 450)

    // Frontal shot traveling right (hitAngleRad = 0 -> incoming from Math.PI = left) hits the front shield
    const hp0 = golem.hp;
    sim.applyDamageToEnemy(golem, 50, false, 'none', 0, 0, false, sim.player.id);
    const frontalDmg = hp0 - golem.hp;

    // Flanking shot traveling left (hitAngleRad = Math.PI -> incoming from 0 = right/behind) bypasses front shield
    const hp1 = golem.hp;
    sim.applyDamageToEnemy(golem, 50, false, 'none', Math.PI, 0, false, sim.player.id);
    const backstabDmg = hp1 - golem.hp;

    expect(frontalDmg).toBeLessThan(backstabDmg * 0.35);
    expect(backstabDmg).toBe(50);

    // Verify Snow Spirit frost nova freezes nearby water/ground and chills players when detonating
    sim.player.x = 420;
    sim.player.y = 320;
    sim.player.invulnerableTimer = 0;
    const spirit = sim.spawnEnemy('snow_spirit', 432, 320, true);
    spirit.attackCooldownTimer = 0;
    for (let i = 0; i < 55; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(spirit.hp).toBe(0);
    expect(sim.player.chillTimer).toBeGreaterThan(0);
  });

  it('implements Boss Kryssa Ice Queen 3 phases, crystal pillar laser reflection, shadowless illusion clones, blizzard veil, and ice prison rescue', () => {
    const sim = new WorldSim({
      seed: 603,
      biome: 2,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const p1 = sim.player;
    p1.godMode = true;
    p1.x = 280;
    p1.y = 320;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Teammate P2', 2);
    p2.godMode = true;
    p2.x = 280;
    p2.y = 380;

    // 1. Crystal Pillar reflects Frost Laser projectiles
    const pillar = sim.spawnProp('crystal_pillar', 420, 320);
    expect(pillar.kind).toBe('crystal_pillar');

    const boss = sim.spawnEnemy('kryssa_ice_queen', 620, 320, true);
    expect(boss.isBoss).toBe(true);
    expect(boss.bossPhase).toBe(1);

    // Trigger Phase 2 (<= 66% HP) -> spawns shadowless mirror clones (kryssa_clone with isIllusion: true)
    sim.applyDamageToEnemy(boss, Math.ceil(boss.maxHp * 0.36), false, 'none', 0, 0, false, p1.id);
    expect(boss.bossPhase).toBe(2);
    boss.aiState = 'idle';
    boss.attackCooldownTimer = 0;
    boss.bossAttackCycle = 0; // cycle % 3 === 0 refreshes mirror clones
    for (let i = 0; i < 65; i++) {
      sim.step(SIM_STEP_SEC);
    }
    const clone = sim.enemies.find((e) => e.defId === 'kryssa_clone');
    expect(clone).toBeDefined();
    expect(ENEMIES.kryssa_clone?.isIllusion).toBe(true);
    expect(clone!.maxHp).toBeLessThanOrEqual(30);

    // Trigger Phase 3 (<= 33% HP) -> activates Blizzard Veil + Ice Prison encasing a player
    sim.applyDamageToEnemy(boss, Math.ceil(boss.maxHp * 0.36), false, 'none', 0, 0, false, p1.id);
    expect(boss.bossPhase).toBe(3);
    expect(sim.blizzardVeilActive).toBe(true);

    boss.aiState = 'idle';
    boss.attackCooldownTimer = 0;
    boss.bossAttackCycle = 1; // cycle % 3 === 1 triggers Ice Prison
    for (let i = 0; i < 65; i++) {
      sim.step(SIM_STEP_SEC);
    }

    const prison = sim.enemies.find((e) => e.defId === 'ice_prison' && e.hp > 0);
    expect(prison).toBeDefined();
    const trappedPlayer = [p1, p2].find((pl) => (pl.encasedInIceTimer ?? 0) > 0);
    expect(trappedPlayer).toBeDefined();

    // Teammate destroys the Ice Prison -> immediately frees the trapped player!
    sim.applyDamageToEnemy(prison!, 999, true, 'burn', 0, 0, true, p1.id);
    expect(prison!.hp).toBe(0);
    expect(trappedPlayer!.encasedInIceTimer ?? 0).toBe(0);
  });

  it('implements Biome 3 (Molten Forge) conveyor belts, 5 enemy types, Coal Golem death lava, Welder Drone shield link, and Iron Shielder armor', () => {
    expect(BIOME3_COMBAT_ENEMIES).toEqual([
      'fire_imp',
      'dwarf_cannon',
      'coal_golem',
      'welder_drone',
      'iron_shielder',
    ]);

    const sim = new WorldSim({
      seed: 604,
      biome: 3,
      mapConfig: { includeSurfaces: true, biome: 3 },
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    expect(sim.currentBiome).toBe(3);
    expect(sim.map.biome).toBe(3);

    // Verify Conveyor Belt pushes entities and supports direction reversal
    const convTx = 14;
    const convTy = 6;
    sim.map.setSurface(convTx, convTy, 'conveyor');
    sim.player.x = convTx * TILE_SIZE + 16;
    sim.player.y = convTy * TILE_SIZE + 16;
    const startX = sim.player.x;
    sim.step(SIM_STEP_SEC);
    expect(sim.player.x).toBeGreaterThan(startX);

    sim.map.reverseConveyorDirection();
    expect(sim.map.conveyorDirection).toBe(-1);
    const revStartX = sim.player.x;
    sim.step(SIM_STEP_SEC);
    expect(sim.player.x).toBeLessThan(revStartX);

    // Verify Coal Golem leaves a molten lava hazard tile on death
    const coalX = 18 * TILE_SIZE + 16;
    const coalY = 10 * TILE_SIZE + 16;
    sim.map.setSurface(18, 10, 'none');
    const coalGolem = sim.spawnEnemy('coal_golem', coalX, coalY, true);
    sim.applyDamageToEnemy(coalGolem, 999, false, 'none', 0, 0, false, sim.player.id);
    expect(sim.map.getSurfaceAtWorld(coalX, coalY)).toBe('lava');

    // Verify Welder Drone grants shieldArmor to nearby allies
    const imp = sim.spawnEnemy('fire_imp', 520, 320, true);
    const drone = sim.spawnEnemy('welder_drone', 550, 320, true);
    drone.attackCooldownTimer = 0;
    for (let i = 0; i < 65; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(imp.shieldArmor).toBeGreaterThan(0);

    // Verify Iron Shielder reduces frontal damage by 80%
    const shielder = sim.spawnEnemy('iron_shielder', 600, 420, true);
    shielder.hp = 500;
    shielder.maxHp = 500;
    shielder.aimAngle = Math.PI;
    const shHp0 = shielder.hp;
    sim.applyDamageToEnemy(shielder, 50, false, 'none', 0, 0, false, sim.player.id);
    const frontHit = shHp0 - shielder.hp;
    expect(frontHit).toBeLessThanOrEqual(12);
  });

  it('implements Boss Forge Titan shockwave rings (Dash i-frame dodge), dual Energy Core 3s/6s overload stun (x1.5 damage), and Phase 3 360 flame sweep', () => {
    expect(ALL_BOSS_IDS).toEqual(['spore_king', 'kryssa_ice_queen', 'forge_titan']);

    const sim = new WorldSim({
      seed: 605,
      biome: 3,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const p1 = sim.player;
    p1.x = 340;
    p1.y = 320;
    const titan = sim.spawnEnemy('forge_titan', 580, 320, true);
    expect(titan.isBoss).toBe(true);

    // 1. Hammer Slam spawns expanding Shockwave Ring & reverses Conveyor direction
    const initialConvDir = sim.map.conveyorDirection;
    titan.aiState = 'idle';
    titan.attackCooldownTimer = 0;
    titan.bossAttackCycle = 0; // Hammer shockwave cycle
    for (let i = 0; i < 75; i++) {
      // Player dashes with i-frames while shockwave expands
      p1.invulnerableTimer = 0.25;
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.map.conveyorDirection).toBe(-initialConvDir);
    expect(sim.shockwaveRings.length).toBeGreaterThan(0);
    expect(p1.hp).toBe(p1.maxHp); // Unharmed thanks to Dash i-frames!

    // 2. Phase 2 exposes 2 Forge Energy Cores; breaking both within window stuns Forge Titan and amplifies damage x1.5
    sim.applyDamageToEnemy(titan, Math.ceil(titan.maxHp * 0.36), false, 'none', 0, 0, false, p1.id);
    expect(titan.bossPhase).toBe(2);
    const cores = sim.enemies.filter((e) => e.defId === 'forge_energy_core' && e.hp > 0);
    expect(cores.length).toBe(2);

    // Destroy Core 1 -> starts synchronization window timer
    sim.applyDamageToEnemy(cores[0]!, 999, true, 'shock', 0, 0, true, p1.id);
    expect(sim.titanCoreWindowTimer).toBeGreaterThan(0);

    // Destroy Core 2 within window -> Forge Titan enters Overload Stun ('stunned')!
    sim.applyDamageToEnemy(cores[1]!, 999, true, 'shock', 0, 0, true, p1.id);
    expect(titan.aiState).toBe('stunned');

    // Verify x1.5 Overload vulnerability damage multiplier while stunned
    titan.superconductTimer = 0; // Isolate the x1.5 overload multiplier
    const hpBeforeStunHit = titan.hp;
    sim.applyDamageToEnemy(titan, 40, false, 'none', 0, 0, false, p1.id);
    expect(hpBeforeStunHit - titan.hp).toBe(60); // 40 * 1.5 = 60!
  });

  it('supports Co-op Dual Pressure Plates (with Solo pushable stone block) and full 6-Floor 3-Biome campaign progression', () => {
    const sim = new WorldSim({
      seed: 606,
      campaignMaxFloors: 6,
      spawnInitialWave: true,
      includeTrainingDummy: false,
    });

    // Enter Treasure Room where Co-op Dual Pressure Plates & Solo Push Block spawn
    const treasureRoom = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
    expect(treasureRoom).toBeDefined();
    sim.enterRoom(treasureRoom.id);

    expect(sim.pressurePlates).toHaveLength(2);
    expect(sim.pushBlocks.length).toBeGreaterThanOrEqual(1);
    expect(sim.coopPuzzleCompleted).toBe(false);

    // Move push block onto Plate 2 and player onto Plate 1
    const plate1 = sim.pressurePlates[0]!;
    const plate2 = sim.pressurePlates[1]!;
    const block = sim.pushBlocks[0]!;
    block.x = plate2.x;
    block.y = plate2.y;
    sim.player.x = plate1.x;
    sim.player.y = plate1.y;

    const chestsBefore = sim.chests.length;
    sim.step(SIM_STEP_SEC);
    expect(sim.coopPuzzleCompleted).toBe(true);
    expect(sim.chests.length).toBe(chestsBefore + 1);

    // Verify 6-Floor progression across Biome 1 (Floors 1-2), Biome 2 (Floors 3-4), and Biome 3 (Floors 5-6)
    sim.advanceToFloor(3);
    expect(sim.currentFloor).toBe(3);
    expect(sim.currentBiome).toBe(2);

    sim.advanceToFloor(4);
    expect(sim.currentFloor).toBe(4);
    expect(sim.currentBiome).toBe(2);
    const bossRoom4 = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
    expect(bossRoom4.waves[0]?.enemies.some((s) => s.defId === 'kryssa_ice_queen')).toBe(true);

    sim.advanceToFloor(5);
    expect(sim.currentFloor).toBe(5);
    expect(sim.currentBiome).toBe(3);

    sim.advanceToFloor(6);
    expect(sim.currentFloor).toBe(6);
    expect(sim.currentBiome).toBe(3);
    const bossRoom6 = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
    expect(bossRoom6.waves[0]?.enemies.some((s) => s.defId === 'forge_titan')).toBe(true);
  });

  it('launches 3 moving lightning projectiles on Thunder Hammer swing and cleans up Ice Prison on Kryssa death', () => {
    const sim = new WorldSim({
      seed: 909,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    sim.player.weaponSlots = ['thunder_hammer'];
    sim.player.activeWeaponSlot = 0;

    sim.setPlayerInput({
      seq: 1,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
      weaponSlotSelect: null,
    });
    sim.step(SIM_STEP_SEC);

    const bolts = sim.projectiles.filter((b) => b.weaponId === 'thunder_hammer');
    expect(bolts).toHaveLength(3);
    for (const bolt of bolts) {
      expect(Math.hypot(bolt.vx, bolt.vy)).toBeGreaterThanOrEqual(500);
      expect(bolt.element).toBe('shock');
    }

    // Spawn Kryssa + Ice Prison + Clone and verify killing Kryssa frees trapped player and clears blizzard
    const kryssa = sim.spawnEnemy('kryssa_ice_queen', 480, 180, true);
    const clone = sim.spawnEnemy('kryssa_clone', 380, 180, true);
    const prison = sim.spawnEnemy('ice_prison', sim.player.x, sim.player.y, true);
    sim.player.encasedInIceTimer = 5.0;
    sim.player.icePrisonId = prison.id;
    sim.blizzardVeilActive = true;

    sim.applyDamageToEnemy(kryssa, 99999, true, 'burn', 0, 0, true, sim.player.id);
    expect(kryssa.hp).toBe(0);
    expect(clone.hp).toBe(0);
    expect(prison.hp).toBe(0);
    expect(sim.player.encasedInIceTimer).toBe(0);
    expect(sim.blizzardVeilActive).toBe(false);
  });

  it('defaults campaignMaxFloors to 6 in Solo/Hub runs so defeating Floor 2 Boss (Màn 1) advances to Biome 2 instead of ending in early victory', () => {
    const sim = new WorldSim({
      seed: 607,
      spawnInitialWave: true,
      includeTrainingDummy: false,
    });

    // Default campaign must be 6 floors (3 biomes x 2 floors)
    expect(sim.campaignMaxFloors).toBe(6);
    expect(sim.currentFloor).toBe(1);
    expect(sim.currentBiome).toBe(1);

    // Advance to Floor 2 (Biome 1 Boss floor) and enter Boss room
    sim.advanceToFloor(2);
    const bossRoom2 = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
    sim.enterRoom(bossRoom2.id);
    for (let i = 0; i < 60; i++) {
      sim.step(SIM_STEP_SEC);
    }
    const sporeKing = sim.enemies.find((e) => e.defId === 'spore_king')!;
    expect(sporeKing).toBeDefined();

    // Defeat Boss Mục Vương on Floor 2 -> must NOT trigger victory yet!
    sim.applyDamageToEnemy(sporeKing, 99999, true, 'burn', 0, 0, true, sim.player.id);
    sim.skipCurrentRoomWaves();

    expect(bossRoom2.cleared).toBe(true);
    expect(sim.portalActive).toBe(true);
    expect(sim.runState).toBe('playing');

    // Enter portal on Floor 2 -> choose buff -> advance to Floor 3 (Biome 2)
    sim.player.x = sim.portalX;
    sim.player.y = sim.portalY;
    expect(sim.enterPortal()).toBe(true);
    expect(sim.runState).toBe('buff_choice');
    expect(sim.selectFloorBuff(sim.player.buffChoices[0]!)).toBe(true);
    expect(sim.currentFloor).toBe(3);
    expect(sim.currentBiome).toBe(2);
    expect(sim.runState).toBe('playing');

    // Advance to Floor 4 (Biome 2 Boss floor), defeat Kryssa -> still playing, then portal to Floor 5 (Biome 3)
    sim.advanceToFloor(4);
    const bossRoom4 = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
    sim.enterRoom(bossRoom4.id);
    sim.skipCurrentRoomWaves();
    expect(bossRoom4.cleared).toBe(true);
    expect(sim.portalActive).toBe(true);
    expect(sim.runState).toBe('playing');

    sim.player.x = sim.portalX;
    sim.player.y = sim.portalY;
    expect(sim.enterPortal()).toBe(true);
    expect(sim.selectFloorBuff(sim.player.buffChoices[0]!)).toBe(true);
    expect(sim.currentFloor).toBe(5);
    expect(sim.currentBiome).toBe(3);

    // Advance to Floor 6 (Biome 3 Final Boss floor), defeat Forge Titan -> NOW victory triggers!
    sim.advanceToFloor(6);
    const bossRoom6 = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
    sim.enterRoom(bossRoom6.id);
    sim.skipCurrentRoomWaves();
    expect(bossRoom6.cleared).toBe(true);
    expect(sim.runState).toBe('victory');
  });
});

