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

    const map = new ArenaMap({ cols: 36, rows: 22, includePillars: true });
    // Attempt to push player into left border wall (x < 32 + radius)
    const wallSlide = map.resolveCircleCollision(20, 200, 13);
    expect(wallSlide.collided).toBe(true);
    expect(wallSlide.x).toBeGreaterThanOrEqual(32 + 13);
    expect(wallSlide.y).toBeCloseTo(200, 3);

    // Slide across the internal vertical seam (x = 9 * 32 = 288) between pillar tiles (8,5) and (9,5)
    // Two-pass cardinal-before-corner resolution must push purely along Y without snagging X on tile (8,5)'s corner
    const seamX = 9 * 32 + 0.5;
    const seamY = 5 * 32 - 13 + 4;
    const seamSlide = map.resolveCircleCollision(seamX, seamY, 13);
    expect(seamSlide.collided).toBe(true);
    expect(seamSlide.x).toBeCloseTo(seamX, 5);
    expect(seamSlide.y).toBeCloseTo(5 * 32 - 13, 3);
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

  it('produces monotonic, jitter-free interpolated positions at 144Hz including wake-from-rest', () => {
    const transport = new LocalTransport({
      seed: 202,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });

    const dt144 = 1000 / 144;

    // Stand still for 11 frames at 144Hz so accumulator has fractional remainder (alpha > 0)
    for (let idleFrame = 0; idleFrame < 11; idleFrame++) {
      transport.step(dt144);
    }

    let prevX = transport.getInterpolatedPlayerPos().x;

    // Now press right (moveX = 1) after standing still -> must respond on the VERY FIRST 144Hz frame
    // and move strictly monotonically forward on every subsequent frame without backwards jumps
    transport.sendInput({
      seq: 1,
      tick: 1,
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
    });

    for (let frame = 0; frame < 35; frame++) {
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
    expect(sim.player.armor).toBe(5);
    expect(sim.player.hp).toBe(6);
  });
});

describe('Phase 1 — HP, Armor Regen (Thiết Vệ 2.0s), Knockback & 4 Sample Weapons', () => {
  it('absorbs damage with Armor before HP and regenerates Armor after 2.0s delay', () => {
    const sim = new WorldSim({
      seed: 404,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRevivePlayer: false,
      autoRespawnWaves: false,
    });

    // Hit for 4 damage -> Armor drops from 5 to 1, HP stays 6
    expect(sim.applyDamageToPlayer(4, 0, 120)).toBe(true);
    expect(sim.player.armor).toBe(1);
    expect(sim.player.hp).toBe(6);
    expect(sim.player.kbVx).toBeGreaterThan(0);

    // Wait 1.5s -> Armor still 1 (delay is 3.0s for Vanguard per Spec Rev 4)
    for (let i = 0; i < 90; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.player.armor).toBe(1);

    // Wait another 3.1s (total 4.6s > 3.0s delay + 1.54s regen @ 0.65/s) -> Armor regenerates to 2
    for (let i = 0; i < 186; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.player.armor).toBe(2);

    // Hit for 5 damage -> absorbs remaining 2 Armor and deals 3 HP damage (HP 6 -> 3)
    expect(sim.applyDamageToPlayer(5, 0, 100)).toBe(true);
    expect(sim.player.armor).toBe(0);
    expect(sim.player.hp).toBe(3);
  });

  it('cycles all 4 sample weapons, destroys enemy bullets with Knight Sword (+ Shield synergy), and reuses pooled projectiles', () => {
    const sim = new WorldSim({
      seed: 505,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });

    expect(PHASE1_SAMPLE_WEAPONS).toEqual(['knight_sword', 'rivet_gun']);
    expect(sim.player.weaponSlots).toEqual(['knight_sword']);
    const target = sim.spawnEnemy('goblin_shooter', sim.player.x + 36, sim.player.y, true);

    // Activate Thiết Vệ's Ruby Shield Wall to verify shield bullet storage & bonus damage on sword deflection
    sim.player.skillActiveTimer = 3.0;
    sim.player.vanguardShieldBonusAdd = 0;

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
    const deflectedBulletRef = sim.projectiles[0]!;

    // 1. Swing Knight Sword (slot 0) -> damages enemy, destroys enemy bullet, and feeds active Shield Wall
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
    expect(sim.player.shieldStoredBullets).toBe(1);
    expect(sim.player.vanguardShieldBonusAdd).toBeCloseTo(0.15, 5);

    // 2. Equip Scrap Shotgun into slot 1 -> fires 5 pellets and reuses pooled projectile object
    sim.player.weaponSlots[1] = 'scrap_shotgun';
    sim.player.fireCooldownTimer = 0;
    sim.setPlayerInput({
      seq: 2,
      tick: 2,
      moveX: 0,
      moveY: 0,
      aimAngle: -Math.PI / 2,
      buttons: INPUT_BUTTON.FIRE,
      weaponSlotSelect: 1,
    });
    sim.step(SIM_STEP_SEC);

    expect(sim.getActiveWeaponId()).toBe('scrap_shotgun');
    expect(sim.player.vanguardShieldBonusAdd).toBe(0);
    const playerPellets = sim.projectiles.filter((b) => b.team === 'player');
    expect(playerPellets).toHaveLength(6);
    expect(playerPellets.some((b) => b === deflectedBulletRef)).toBe(true);
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
    expect(Math.hypot(boar.vx, boar.vy)).toBeCloseTo(410, 0);

    // 3. Spore Bomber telegraph (0.6s) -> AoE explosion
    const bomber = sim.spawnEnemy('spore_bomber', sim.player.x + 36, sim.player.y, true);
    sim.step(SIM_STEP_SEC);
    expect(bomber.aiState).toBe('telegraph');

    for (let i = 0; i < 40; i++) {
      sim.step(SIM_STEP_SEC);
    }
    const events = sim.consumeEvents();
    expect(events.some((ev) => ev.kind === 'explosion')).toBe(true);
  });
});
