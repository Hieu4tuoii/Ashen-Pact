import { describe, expect, it } from 'vitest';
import {
  ArenaMap,
  DASH_COOLDOWN_SEC,
  DASH_IFRAME_SEC,
  ENEMY_SPAWN_WARMUP_SEC,
  INPUT_BUTTON,
  LocalTransport,
  PHASE1_SAMPLE_ENEMIES,
  PHASE1_SAMPLE_WEAPONS,
  SIM_STEP_MS,
  SIM_STEP_SEC,
  SpatialHashGrid,
  WorldSim,
  resolveCircleVsAABB,
} from '../src/index.js';

describe('Phase 1 — SpatialHashGrid & Tile-AABB Collision', () => {
  it('inserts entities across cell boundaries and queries unique matches accurately', () => {
    const grid = new SpatialHashGrid<{ id: number; x: number; y: number; radius: number }>(64);
    grid.insert({ id: 1, x: 60, y: 60, radius: 14 }); // spans (0,0) and (1,1)
    grid.insert({ id: 2, x: 90, y: 65, radius: 12 });
    grid.insert({ id: 3, x: 420, y: 420, radius: 15 });

    const hits = grid.queryCircle(72, 62, 16);
    const ids = hits.map((h) => h.id).sort();
    expect(ids).toEqual([1, 2]);

    grid.clear();
    expect(grid.getActiveCellCount()).toBe(0);
    expect(grid.queryCircle(72, 62, 16)).toHaveLength(0);
  });

  it('resolves circle vs AABB penetration and slides smoothly along ArenaMap walls', () => {
    const box = { minX: 100, minY: 100, maxX: 132, maxY: 132 };
    const res = resolveCircleVsAABB(92, 116, 12, box);
    expect(res.collided).toBe(true);
    expect(res.x).toBeCloseTo(88, 3);
    expect(res.y).toBeCloseTo(116, 3);
    expect(res.normalX).toBe(-1);

    const map = new ArenaMap({ cols: 24, rows: 16, includePillars: true });
    // Attempt to push player into left border wall (x < 32 + radius)
    const wallSlide = map.resolveCircleCollision(20, 200, 13);
    expect(wallSlide.collided).toBe(true);
    expect(wallSlide.x).toBeGreaterThanOrEqual(32 + 13);
    expect(wallSlide.y).toBeCloseTo(200, 3);
  });
});

describe('Phase 1 — Player Movement, Acceleration, Dash i-frames & LocalTransport', () => {
  it('accelerates smoothly to maxSpeed, stops cleanly, and responds on the very first frame', () => {
    const transport = new LocalTransport({
      seed: 101,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });

    const startPos = transport.getInterpolatedPlayerPos();
    transport.sendInput({
      seq: 1,
      tick: 1,
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
    });

    // Step 1 frame at 60Hz (16.67ms) -> must respond immediately (< 1 frame latency)
    transport.step(SIM_STEP_MS);
    const afterFrame1 = transport.getInterpolatedPlayerPos();
    expect(afterFrame1.x).toBeGreaterThan(startPos.x);
    expect(transport.getSim().player.vx).toBeGreaterThan(0);

    // Hold right for 6 ticks (~0.1s) -> reaches full Vanguard speed (171 u/s)
    for (let i = 0; i < 6; i++) {
      transport.step(SIM_STEP_MS);
    }
    expect(transport.getSim().player.vx).toBeCloseTo(171, 1);

    // Release movement keys -> decelerates cleanly to 0 within 4 ticks (~0.06s)
    transport.sendInput({
      seq: 2,
      tick: 8,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
    });
    for (let i = 0; i < 4; i++) {
      transport.step(SIM_STEP_MS);
    }
    expect(transport.getSim().player.vx).toBe(0);
  });

  it('produces monotonic, jitter-free interpolated positions at 144Hz (6.944ms steps)', () => {
    const transport = new LocalTransport({
      seed: 202,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });

    transport.sendInput({
      seq: 1,
      tick: 1,
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
    });

    const dt144 = 1000 / 144;
    let prevX = transport.getInterpolatedPlayerPos().x;

    for (let frame = 0; frame < 30; frame++) {
      transport.step(dt144);
      const currX = transport.getInterpolatedPlayerPos().x;
      expect(currX).toBeGreaterThan(prevX);
      prevX = currX;
    }
  });

  it('grants dash speed burst and 0.2s i-frame invulnerability with 1.2s cooldown', () => {
    const sim = new WorldSim({
      seed: 303,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });

    sim.setPlayerInput({
      seq: 1,
      tick: 1,
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.DASH,
    });
    sim.step(SIM_STEP_SEC);

    expect(sim.player.dashTimer).toBeGreaterThan(0);
    expect(sim.player.invulnerableTimer).toBeCloseTo(DASH_IFRAME_SEC, 3);
    expect(sim.player.dashCooldownTimer).toBeCloseTo(DASH_COOLDOWN_SEC, 3);
    expect(sim.player.vx).toBeGreaterThan(400);

    // Damage during dash i-frames is completely ignored
    const damaged = sim.applyDamageToPlayer(3, Math.PI, 150);
    expect(damaged).toBe(false);
    expect(sim.player.armor).toBe(6);
    expect(sim.player.hp).toBe(8);
  });
});

describe('Phase 1 — HP, Armor Regen (Thiết Vệ 2.0s), Knockback & 4 Sample Weapons', () => {
  it('absorbs damage with Armor before HP and regenerates Armor after 2.0s delay', () => {
    const sim = new WorldSim({
      seed: 404,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
      autoRevivePlayer: false,
    });

    // Hit for 4 damage -> Armor drops from 6 to 2, HP stays 8
    expect(sim.applyDamageToPlayer(4, 0, 120)).toBe(true);
    expect(sim.player.armor).toBe(2);
    expect(sim.player.hp).toBe(8);
    expect(sim.player.kbVx).toBeGreaterThan(0);

    // Wait 1.5s -> Armor still 2 (delay is 2.0s)
    for (let i = 0; i < 90; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.player.armor).toBe(2);

    // Wait another 1.6s (total 3.1s > 2.0s delay + 1.0s regen) -> Armor regenerates to 3
    for (let i = 0; i < 96; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.player.armor).toBe(3);

    // Hit for 5 damage -> absorbs remaining 3 Armor and deals 2 HP damage (HP 8 -> 6)
    expect(sim.applyDamageToPlayer(5, 0, 100)).toBe(true);
    expect(sim.player.armor).toBe(0);
    expect(sim.player.hp).toBe(6);
  });

  it('cycles all 4 sample weapons, destroys enemy bullets with Knight Sword, and fires projectiles', () => {
    const sim = new WorldSim({
      seed: 505,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });

    expect(sim.player.weaponSlots).toEqual([...PHASE1_SAMPLE_WEAPONS]);
    const target = sim.spawnEnemy('goblin_shooter', sim.player.x + 36, sim.player.y, true);

    // Spawn an incoming enemy bullet right in front of the player
    sim.projectiles.push({
      id: 999,
      ownerId: target.id,
      team: 'enemy',
      weaponId: 'goblin_bow',
      prevX: sim.player.x + 24,
      prevY: sim.player.y,
      x: sim.player.x + 24,
      y: sim.player.y,
      vx: -200,
      vy: 0,
      angle: Math.PI,
      radius: 5,
      damage: 1,
      isCrit: false,
      knockback: 50,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 2,
      element: 'none',
      amplifiedByShield: false,
      hitEntityIds: [],
    });

    // 1. Swing Knight Sword (slot 0) -> damages enemy AND destroys enemy bullet
    sim.setPlayerInput({
      seq: 1,
      tick: 1,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
      weaponSlotSelect: 0,
    });
    sim.step(SIM_STEP_SEC);

    expect(target.hp).toBeLessThan(target.maxHp);
    expect(target.kbVx).toBeGreaterThan(0);
    expect(sim.projectiles.filter((b) => b.team === 'enemy')).toHaveLength(0);

    // 2. Switch to Scrap Shotgun (slot 2) -> fires 5 pellets and costs 3 energy
    const energyBefore = sim.player.energy;
    sim.player.fireCooldownTimer = 0;
    sim.setPlayerInput({
      seq: 2,
      tick: 2,
      moveX: 0,
      moveY: 0,
      aimAngle: -Math.PI / 2,
      buttons: INPUT_BUTTON.FIRE,
      weaponSlotSelect: 2,
    });
    sim.step(SIM_STEP_SEC);

    expect(sim.getActiveWeaponId()).toBe('scrap_shotgun');
    expect(sim.player.energy).toBe(energyBefore - 3);
    expect(sim.projectiles.filter((b) => b.team === 'player')).toHaveLength(5);
  });
});

describe('Phase 1 — 3 Sample Enemies (Ranged, Charger, Exploder) AI & Telegraphs', () => {
  it('spawns all 3 sample enemies with 0.8s magic circle warmup, telegraphs, and executes attacks', () => {
    const sim = new WorldSim({
      seed: 606,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });

    expect(PHASE1_SAMPLE_ENEMIES).toEqual(['goblin_shooter', 'wild_boar', 'spore_bomber']);

    // 1. Goblin Shooter warmup -> telegraph -> 3-bullet spread
    const goblin = sim.spawnEnemy('goblin_shooter', sim.player.x + 180, sim.player.y, false);
    expect(goblin.aiState).toBe('spawning');
    for (let i = 0; i < Math.ceil(ENEMY_SPAWN_WARMUP_SEC / SIM_STEP_SEC) + 1; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(goblin.aiState).not.toBe('spawning');

    goblin.attackCooldownTimer = 0;
    sim.step(SIM_STEP_SEC);
    expect(goblin.aiState).toBe('telegraph');

    // Step through 0.5s telegraph -> spawns 3 enemy bullets
    for (let i = 0; i < 32; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.projectiles.filter((b) => b.ownerId === goblin.id)).toHaveLength(3);

    // 2. Wild Boar telegraph (0.7s) -> high-speed charge
    const boar = sim.spawnEnemy('wild_boar', sim.player.x + 160, sim.player.y + 60, true);
    boar.attackCooldownTimer = 0;
    sim.step(SIM_STEP_SEC);
    expect(boar.aiState).toBe('telegraph');

    for (let i = 0; i < 44; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(boar.aiState).toBe('attack');
    expect(Math.hypot(boar.vx, boar.vy)).toBeCloseTo(380, 0);

    // 3. Spore Bomber telegraph (0.6s) -> AoE explosion
    const bomber = sim.spawnEnemy('spore_bomber', sim.player.x + 36, sim.player.y, true);
    sim.step(SIM_STEP_SEC);
    expect(bomber.aiState).toBe('telegraph');

    for (let i = 0; i < 38; i++) {
      sim.step(SIM_STEP_SEC);
    }
    const events = sim.consumeEvents();
    expect(events.some((ev) => ev.kind === 'explosion')).toBe(true);
  });
});
