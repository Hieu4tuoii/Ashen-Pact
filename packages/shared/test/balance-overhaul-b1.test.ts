import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  DASH_COOLDOWN_SEC,
  DASH_IFRAME_SEC,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  TILE_SIZE,
  WEAPONS,
  WorldSim,
  generateDungeonFloor,
} from '../src/index.js';

describe('Phase B1 — Combat & Economy Balance Overhaul', () => {
  it('B1.1: triggers defeat on lethal damage in Solo Dungeon when autoRevivePlayer is false, while still auto-reviving in Hub', () => {
    const soloSim = new WorldSim({
      seed: 1001,
      startInHub: false,
      autoRevivePlayer: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    expect(soloSim.inHub).toBe(false);
    soloSim.player.armor = 0;
    soloSim.applyDamageToPlayer(soloSim.player.hp + 5, 0, 0);
    expect(soloSim.player.hp).toBe(0);
    expect(soloSim.runState).toBe('defeat');

    const hubSim = new WorldSim({
      seed: 1002,
      startInHub: true,
      autoRevivePlayer: false,
    });
    expect(hubSim.inHub).toBe(true);
    hubSim.player.armor = 0;
    hubSim.applyDamageToPlayer(hubSim.player.hp + 5, 0, 0);
    expect(hubSim.runState).toBe('playing');
    expect(hubSim.player.hp).toBe(hubSim.player.maxHp);
    expect(hubSim.player.armor).toBe(hubSim.player.maxArmor);
  });

  it('B1.2: enforces AP2 weapon cadence metadata and zero energy orb drops', () => {
    // 1. Weapon cadence metadata replaces legacy energyCost
    expect(WEAPONS.rivet_gun!.cadenceKind).toBe('CLIP_RELOAD');
    expect(WEAPONS.knight_sword!.cadenceKind).toBe('MELEE_COMBO');
    expect(WEAPONS.scrap_shotgun!.cadenceKind).toBe('CLIP_RELOAD');
    expect(WEAPONS.gale_smg!.cadenceKind).toBe('HEAT_VENT');
    expect(WEAPONS.tesla_carbine!.cadenceKind).toBe('CLIP_RELOAD');
    expect(WEAPONS.solar_archon_staff!.cadenceKind).toBe('HEAT_VENT');
    expect(WEAPONS.magma_cannon!.cadenceKind).toBe('CLIP_RELOAD');

    const sim = new WorldSim({
      seed: 1003,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    // 2. No enemies or chests ever drop energy pickups
    sim.pickups.length = 0;
    const clone = sim.spawnEnemy('kryssa_clone', 400, 300, true);
    sim.applyDamageToEnemy(clone, 999, false, 'none', 0, 0);
    const guardian = sim.spawnEnemy('spore_guardian', 420, 300, true);
    sim.applyDamageToEnemy(guardian, 999, false, 'none', 0, 0);
    const elite = sim.spawnEnemy('goblin_shooter', 400, 300, true, 'fast');
    sim.applyDamageToEnemy(elite, 9999, false, 'none', 0, 0);
    const boss = sim.spawnEnemy('spore_king', 400, 300, true);
    sim.applyDamageToEnemy(boss, 99999, false, 'none', 0, 0);
    const chest = sim.spawnChest(400, 300, 'rare', 'tesla_carbine');
    sim.openChest(chest);
    expect(sim.pickups.filter((pk) => (pk.kind as string) === 'energy')).toHaveLength(0);
  });

  it('B1.3: enforces reduced gold drop tables and scaled Merchant & Shrine prices', () => {
    const sim = new WorldSim({
      seed: 1004,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    // 1. Summoned enemies drop 0 gold
    sim.pickups.length = 0;
    for (const defId of ['mini_slime', 'kryssa_clone', 'spore_guardian'] as const) {
      const e = sim.spawnEnemy(defId, 400, 300, true);
      sim.applyDamageToEnemy(e, 999, false, 'none', 0, 0);
    }
    expect(sim.pickups.filter((pk) => pk.kind === 'gold')).toHaveLength(0);

    // 2. Elite drops 6-9 gold total
    for (let i = 0; i < 20; i++) {
      sim.pickups.length = 0;
      const elite = sim.spawnEnemy('goblin_shooter', 400, 300, true, 'fast');
      sim.applyDamageToEnemy(elite, 9999, false, 'none', 0, 0);
      const goldTotal = sim.pickups
        .filter((pk) => pk.kind === 'gold')
        .reduce((s, o) => s + o.amount, 0);
      expect(goldTotal).toBeGreaterThanOrEqual(6);
      expect(goldTotal).toBeLessThanOrEqual(9);
    }

    // 3. Boss drops 20-25 gold total
    for (let i = 0; i < 20; i++) {
      sim.pickups.length = 0;
      const boss = sim.spawnEnemy('spore_king', 400, 300, true);
      sim.applyDamageToEnemy(boss, 99999, false, 'none', 0, 0);
      const goldTotal = sim.pickups
        .filter((pk) => pk.kind === 'gold')
        .reduce((s, o) => s + o.amount, 0);
      expect(goldTotal).toBeGreaterThanOrEqual(20);
      expect(goldTotal).toBeLessThanOrEqual(25);
    }

    // 4. Chest drops 6-10 gold total
    for (let i = 0; i < 20; i++) {
      sim.pickups.length = 0;
      const chest = sim.spawnChest(400, 300, 'rare', 'tesla_carbine');
      sim.openChest(chest);
      const goldTotal = sim.pickups
        .filter((pk) => pk.kind === 'gold')
        .reduce((s, o) => s + o.amount, 0);
      expect(goldTotal).toBeGreaterThanOrEqual(6);
      expect(goldTotal).toBeLessThanOrEqual(10);
    }

    // 5. Merchant prices on Floor 1 vs Floor 2
    const floor1 = generateDungeonFloor(4242, 1, 1, 1);
    const shop1 = floor1.rooms.find((r) => r.type === 'merchant')!;
    const byKind1 = Object.fromEntries(shop1.shopOffers.map((it) => [it.kind, it.costGold]));
    expect(byKind1.health_potion).toBe(30);
    expect(byKind1.weapon).toBe(55);
    expect(byKind1.armor_upgrade).toBe(65);

    const floor2 = generateDungeonFloor(4242, 2, 1, 1);
    const shop2 = floor2.rooms.find((r) => r.type === 'merchant')!;
    const byKind2 = Object.fromEntries(shop2.shopOffers.map((it) => [it.kind, it.costGold]));
    expect(byKind2.health_potion).toBe(38);
    expect(byKind2.weapon).toBe(106);
    expect(byKind2.armor_upgrade).toBe(81);

    // 6. Shrine costs 40 Gold
    const shrineRoom = sim.dungeon.rooms.find((r) => r.type === 'shrine')!;
    sim.enterRoom(shrineRoom.id);
    const shrine = sim.npcEntities.find((n) => n.kind === 'shrine')!;
    expect(shrine.costGold).toBe(40);
    expect(shrine.dialogueVi).toContain('40 Xu');
  });

  it('B1.4: updates Character HP/Armor/Regen, Dash cooldown/i-frame, 0.35s hit i-frame, Knight Sword stats, and 0.35s lava tick', () => {
    expect(CHARACTERS.vanguard.hp).toBe(6);
    expect(CHARACTERS.vanguard.armor).toBe(5);
    expect(CHARACTERS.vanguard.armorRegenDelaySec).toBeCloseTo(3.0, 2);
    expect(CHARACTERS.vanguard.armorRegenPerSec).toBeCloseTo(0.65, 2);

    expect(CHARACTERS.engineer.hp).toBe(6);
    expect(CHARACTERS.engineer.armor).toBe(4);
    expect(CHARACTERS.engineer.armorRegenDelaySec).toBeCloseTo(5.2, 2);
    expect(CHARACTERS.engineer.armorRegenPerSec).toBeCloseTo(0.65, 2);

    expect(CHARACTERS.ranger.hp).toBe(5);
    expect(CHARACTERS.ranger.armor).toBe(3);
    expect(CHARACTERS.ranger.armorRegenDelaySec).toBeCloseTo(5.2, 2);
    expect(CHARACTERS.ranger.armorRegenPerSec).toBeCloseTo(0.65, 2);

    expect(CHARACTERS.druid.hp).toBe(5);
    expect(CHARACTERS.druid.armor).toBe(3);
    expect(CHARACTERS.druid.armorRegenDelaySec).toBeCloseTo(5.2, 2);
    expect(CHARACTERS.druid.armorRegenPerSec).toBeCloseTo(0.65, 2);

    expect(CHARACTERS.elementalist.hp).toBe(4);
    expect(CHARACTERS.elementalist.armor).toBe(2);
    expect(CHARACTERS.elementalist.armorRegenDelaySec).toBeCloseTo(5.2, 2);
    expect(CHARACTERS.elementalist.armorRegenPerSec).toBeCloseTo(0.65, 2);

    expect(DASH_IFRAME_SEC).toBeCloseTo(0.16, 3);
    expect(DASH_COOLDOWN_SEC).toBeCloseTo(1.85, 3);

    expect(WEAPONS.knight_sword!.fireRate).toBeCloseTo(1.75, 3);
    expect(WEAPONS.knight_sword!.spreadDeg).toBe(85);

    const sim = new WorldSim({
      seed: 1005,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    // Hit i-frame is 0.35s
    sim.applyDamageToPlayer(1, 0, 50);
    expect(sim.player.invulnerableTimer).toBeCloseTo(0.35, 3);

    // Dash cooldown is DASH_COOLDOWN_SEC
    sim.player.dashCooldownTimer = 0;
    sim.player.dashTimer = 0;
    sim.setPlayerInput({
      seq: 1,
      tick: 1,
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.DASH,
    });
    sim.step(SIM_STEP_SEC);
    expect(sim.player.dashCooldownTimer).toBeCloseTo(DASH_COOLDOWN_SEC, 3);

    // Lava surface triggers burn after 0.35s (22 ticks = 0.366s)
    sim.player.dashTimer = 0;
    sim.player.vx = 0;
    sim.player.vy = 0;
    sim.player.kbVx = 0;
    sim.player.kbVy = 0;
    sim.player.burnTimer = 0;
    sim.player.surfaceTickTimer = 0;
    const tx = Math.floor(sim.player.x / TILE_SIZE);
    const ty = Math.floor(sim.player.y / TILE_SIZE);
    sim.map.setSurface(tx, ty, 'lava', 10, true);
    sim.setPlayerInput({
      seq: 2,
      tick: 2,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
    });
    for (let i = 0; i < 22; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.player.burnTimer).toBeGreaterThan(0);
  });

  it('B1.5: spawns 4-6 enemies per wave across 2-3 waves at perimeter/quadrant points >= 140px from player and overlaps waves at 9.5s', () => {
    const floor1 = generateDungeonFloor(5050, 1, 1, 1);
    const normalCombatRooms = floor1.rooms.filter((r) => r.type === 'combat' && !r.isChallenge);
    for (const r of normalCombatRooms) {
      expect(r.wavesTotal).toBeGreaterThanOrEqual(2);
      expect(r.wavesTotal).toBeLessThanOrEqual(3);
      for (const w of r.waves) {
        expect(w.enemies.length).toBeGreaterThanOrEqual(4);
        expect(w.enemies.length).toBeLessThanOrEqual(6);
      }
    }

    // Floor 2 challenge room final wave has >= 2 elites and escort enemies
    const floor2 = generateDungeonFloor(5050, 2, 1, 1);
    const challenge2 = floor2.rooms.find((r) => r.isChallenge)!;
    const finalWave = challenge2.waves[challenge2.waves.length - 1]!;
    expect(finalWave.enemies.filter((e) => e.isElite).length).toBeGreaterThanOrEqual(2);
    expect(finalWave.enemies.length).toBeGreaterThanOrEqual(5);
    expect(finalWave.enemies.length).toBeLessThanOrEqual(7);

    // Spawn positions are distributed across quadrants and >= 140px from alive player
    const sim = new WorldSim({
      seed: 5050,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat' && !r.isChallenge)!;
    sim.enterRoom(combatRoom.id);

    const wave1 = sim.enemies.filter((e) => !e.isDummy && e.waveIndex === 1);
    expect(wave1.length).toBeGreaterThanOrEqual(4);
    expect(wave1.length).toBeLessThanOrEqual(6);
    const cx = sim.map.width * 0.5;
    let leftHalfCount = 0;
    let rightHalfCount = 0;
    for (const e of wave1) {
      const distToPlayer = Math.hypot(e.x - sim.player.x, e.y - sim.player.y);
      expect(distToPlayer).toBeGreaterThanOrEqual(140 - 1e-3);
      if (e.x < cx) leftHalfCount += 1;
      else rightHalfCount += 1;
    }
    expect(leftHalfCount).toBeGreaterThan(0);
    expect(rightHalfCount).toBeGreaterThan(0);

    // Wave overlap triggers at 9.5s even if all enemies in wave 1 are still alive
    sim.waveElapsedSec = 9.45;
    sim.step(0.1);
    expect(combatRoom.wavesSpawned).toBe(2);
  });

  it('B1.6: Shrine restores armor & weapon clip/heat without dropping a free weapon, and normal combat rooms spawn chests with ~45% probability', () => {
    const sim = new WorldSim({
      seed: 6060,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });
    const shrineRoom = sim.dungeon.rooms.find((r) => r.type === 'shrine')!;
    sim.enterRoom(shrineRoom.id);
    const shrine = sim.npcEntities.find((n) => n.kind === 'shrine')!;

    sim.player.armor = 1;
    sim.player.clipAmmo = 0;
    sim.player.gold = 50;
    sim.player.x = shrine.x;
    sim.player.y = shrine.y;
    expect(sim.interactWithNearest()).toBe(true);
    expect(sim.player.gold).toBe(10); // 50 - 40 = 10
    expect(sim.player.armor).toBe(sim.player.maxArmor);
    expect(sim.player.clipAmmo).toBe(sim.player.clipMax);
    expect(sim.worldItems.filter((it) => it.kind === 'weapon')).toHaveLength(0);

    // Normal combat room chest chance ~45% vs Challenge room 100%
    let normalChests = 0;
    const trials = 120;
    for (let i = 0; i < trials; i++) {
      const trialSim = new WorldSim({
        seed: 7000 + i * 19,
        spawnInitialWave: false,
        includeTrainingDummy: false,
      });
      const normalRoom = trialSim.dungeon.rooms.find((r) => r.type === 'combat' && !r.isChallenge)!;
      trialSim.enterRoom(normalRoom.id);
      trialSim.skipCurrentRoomWaves();
      if (trialSim.chests.length > 0) {
        normalChests += 1;
      }

      const challengeRoom = trialSim.dungeon.rooms.find((r) => r.isChallenge)!;
      trialSim.enterRoom(challengeRoom.id);
      trialSim.skipCurrentRoomWaves();
      expect(trialSim.chests.length).toBe(1);
    }
    expect(normalChests).toBeGreaterThanOrEqual(35);
    expect(normalChests).toBeLessThanOrEqual(75);
  });
});
