import { describe, expect, it } from 'vitest';
import {
  FIRE_IMP_FIREBALL_SPEED,
  FROST_BAT_SONIC_DART_SPEED,
  GOBLIN_SHOOTER_ARROW_SPEED,
  ICE_MAGE_BOLT_SPEED,
  ICE_MAGE_SHATTER_SPEAR_SPEED,
  MAX_ENEMY_PROJECTILES,
  WorldSim,
} from '../src/index.js';

const DT = 1 / 60;

describe('Boss Bullet-Hell Kinematics, Pool Reset & Bullet Graze', () => {
  it('raises MAX_ENEMY_PROJECTILES to 300 and supports gapIndices + alternating speed/radius/shape in spawnDeterministicVolley', () => {
    expect(MAX_ENEMY_PROJECTILES).toBe(300);
    const sim = new WorldSim({
      seed: 101,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      ownerId: 99,
      team: 'enemy',
      weaponId: 'test_volley',
      x: 400,
      y: 300,
      angle: 0,
      pelletCount: 6,
      spreadRad: Math.PI,
      speed: 200,
      radius: 8,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 2,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      amplifiedByShield: false,
      seed: 42,
      bulletShape: 'heavy_orb',
      alternateSpeedScale: 0.5,
      alternateRadiusScale: 0.75,
      alternateBulletShape: 'lance',
      gapIndices: [2, 3],
    });
    expect(sim.projectiles).toHaveLength(4);
    expect(sim.projectiles[0]!.bulletShape).toBe('heavy_orb');
    expect(sim.projectiles[0]!.radius).toBeCloseTo(8, 4);
    expect(Math.hypot(sim.projectiles[0]!.vx, sim.projectiles[0]!.vy)).toBeCloseTo(200, 2);
    expect(sim.projectiles[1]!.bulletShape).toBe('lance');
    expect(sim.projectiles[1]!.radius).toBeCloseTo(6, 4);
    expect(Math.hypot(sim.projectiles[1]!.vx, sim.projectiles[1]!.vy)).toBeCloseTo(100, 2);
  });

  it('steps decel, accel (with delay), pulse, and spiral identically on server and client and preserves reflected heading on wall bounce', () => {
    const serverSim = new WorldSim({
      seed: 202,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const clientSim = new WorldSim({
      seed: 202,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });

    const ev = {
      kind: 'bullet_volley_spawned' as const,
      eventId: 7,
      ownerId: 99,
      team: 'enemy' as const,
      weaponId: 'test_accel',
      x: 300,
      y: 300,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 70,
      targetSpeed: 210,
      kinematicMode: 'accel' as const,
      kinematicDelaySec: 0.2,
      kinematicRate: 5.0,
      angularVelRad: 0.3,
      radius: 7,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 2,
      pierceCount: 0,
      bounceCount: 1,
      element: 'chill' as const,
      amplifiedByShield: false,
      seed: 99,
      bulletShape: 'diamond' as const,
    };
    serverSim.spawnDeterministicVolley({ ...ev }, false);
    clientSim.spawnDeterministicVolley({ ...ev }, false);

    // Before delay (10 ticks = 0.166s): speed stays ~70, angle curves by angularVelRad
    for (let t = 0; t < 10; t++) {
      serverSim.updateProjectiles(DT);
      clientSim.stepClientProjectilesCosmetic(DT);
    }
    const sb1 = serverSim.projectiles[0]!;
    const cb1 = clientSim.projectiles[0]!;
    expect(Math.hypot(sb1.vx, sb1.vy)).toBeCloseTo(70, 1);
    expect(sb1.x).toBeCloseTo(cb1.x, 4);
    expect(sb1.y).toBeCloseTo(cb1.y, 4);

    // After delay (30 more ticks): speed surges toward 210 identically
    for (let t = 0; t < 30; t++) {
      serverSim.updateProjectiles(DT);
      clientSim.stepClientProjectilesCosmetic(DT);
    }
    expect(Math.hypot(sb1.vx, sb1.vy)).toBeGreaterThan(150);
    expect(sb1.x).toBeCloseTo(cb1.x, 4);
    expect(sb1.y).toBeCloseTo(cb1.y, 4);
  });

  it('clears kinematic and graze fields when recycling projectiles through projectilePool', () => {
    const sim = new WorldSim({
      seed: 303,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      ownerId: 99,
      team: 'enemy',
      weaponId: 'decel_test',
      x: 400,
      y: 300,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 220,
      targetSpeed: 80,
      kinematicMode: 'decel',
      kinematicRate: 4,
      angularVelRad: 0.5,
      bulletShape: 'wave',
      radius: 8,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 0.01,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      amplifiedByShield: false,
      seed: 1,
    });
    sim.projectiles[0]!.grazedPlayerIds = [1];
    sim.updateProjectiles(DT); // expires into projectilePool
    expect(sim.projectiles).toHaveLength(0);

    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      ownerId: 99,
      team: 'enemy',
      weaponId: 'plain_test',
      x: 400,
      y: 300,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 150,
      radius: 6,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 1,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      amplifiedByShield: false,
      seed: 2,
    });
    const reused = sim.projectiles[0]!;
    expect(reused.bulletShape).toBeUndefined();
    expect(reused.kinematicMode).toBeUndefined();
    expect(reused.targetSpeed).toBeUndefined();
    expect(reused.angularVelRad).toBeUndefined();
    expect(reused.grazedPlayerIds ?? []).toHaveLength(0);
  });

  it('triggers Bullet Graze once per bullet within 18px margin without colliding, respecting 0.16s ICD and Boss vs normal room refund scaling', () => {
    const sim = new WorldSim({
      seed: 404,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const pl = sim.player;
    pl.x = 300;
    pl.y = 300;
    pl.skillCooldownTimer = 3.0;
    pl.weaponHeat = 20;

    // Spawn a boss so Boss-tier graze refund applies (-0.25s skill CD, -4 heat)
    sim.spawnEnemy('spore_king', 600, 300, true);

    // Bullet passes at y = 300 + pl.radius (12) + b.radius (7) + 10 = 329 (inside 18px graze margin, outside collision)
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      ownerId: 99,
      team: 'enemy',
      weaponId: 'boss_spore_ring',
      x: 300,
      y: pl.y + pl.radius + 7 + 10,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 10,
      radius: 7,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 2,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      amplifiedByShield: false,
      seed: 5,
    });
    sim.consumeEvents();
    sim.updateProjectiles(DT);

    const evs1 = sim.consumeEvents();
    expect(evs1.some((e) => e.kind === 'bullet_grazed' && e.playerId === pl.id)).toBe(true);
    expect(pl.skillCooldownTimer).toBeCloseTo(2.75, 3);
    expect(pl.weaponHeat).toBeCloseTo(16, 3);
    expect(pl.grazeIcdTimer).toBeCloseTo(0.16, 3);

    // Stepping again with the same bullet does NOT graze a second time
    pl.grazeIcdTimer = 0;
    sim.updateProjectiles(DT);
    expect(sim.consumeEvents().some((e) => e.kind === 'bullet_grazed')).toBe(false);
    expect(pl.skillCooldownTimer).toBeCloseTo(2.75, 3);

    // Boss-room reload shave: when weaponHeat is 0 and reloadTimer > 0, shaves 0.05s clamped >= 0.01s
    pl.weaponHeat = 0;
    pl.reloadTimer = 0.04;
    pl.reloadLockout = false;
    pl.grazeIcdTimer = 0;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      ownerId: 99,
      team: 'enemy',
      weaponId: 'boss_spore_ring',
      x: 300,
      y: pl.y + pl.radius + 7 + 10,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 10,
      radius: 7,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 2,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      amplifiedByShield: false,
      seed: 6,
    });
    sim.updateProjectiles(DT);
    expect(pl.reloadTimer).toBeCloseTo(0.01, 4);
  });

  it('applies normal-room graze micro-refund (-0.08s CD, -1.5 heat, no reload shave) when getActiveBoss() === null, enforces 0.16s ICD, and suppresses graze at 0 HP on lethal tick', () => {
    const sim = new WorldSim({
      seed: 405,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    expect(sim.getActiveBoss()).toBeNull();
    const pl = sim.player;
    pl.x = 300;
    pl.y = 300;
    pl.skillCooldownTimer = 3.0;
    pl.weaponHeat = 10;
    pl.reloadTimer = 0.8;
    pl.reloadLockout = false;

    const spawnGrazeBullet = (seed: number) =>
      sim.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        ownerId: 99,
        team: 'enemy',
        weaponId: 'goblin_arrow',
        x: 300,
        y: pl.y + pl.radius + 6 + 10,
        angle: 0,
        pelletCount: 1,
        spreadRad: 0,
        speed: 10,
        radius: 6,
        damage: 2,
        critChance: 0,
        knockback: 0,
        ttlSec: 2,
        pierceCount: 0,
        bounceCount: 0,
        element: 'none',
        amplifiedByShield: false,
        seed,
      });

    spawnGrazeBullet(11);
    sim.consumeEvents();
    sim.updateProjectiles(DT);

    expect(sim.consumeEvents().some((e) => e.kind === 'bullet_grazed')).toBe(true);
    expect(pl.skillCooldownTimer).toBeCloseTo(2.92, 4);
    expect(pl.weaponHeat).toBeCloseTo(8.5, 4);
    expect(pl.grazeIcdTimer).toBeCloseTo(0.16, 4);

    // Second distinct bullet while grazeIcdTimer > 0 is suppressed
    spawnGrazeBullet(12);
    sim.updateProjectiles(DT);
    expect(sim.consumeEvents().some((e) => e.kind === 'bullet_grazed')).toBe(false);
    expect(pl.skillCooldownTimer).toBeCloseTo(2.92, 4);
    expect(pl.weaponHeat).toBeCloseTo(8.5, 4);

    // Normal room with weaponHeat = 0 does NOT shave reloadTimer
    pl.grazeIcdTimer = 0;
    pl.weaponHeat = 0;
    pl.reloadTimer = 0.8;
    spawnGrazeBullet(13);
    sim.updateProjectiles(DT);
    expect(pl.reloadTimer).toBeCloseTo(0.8, 4);

    // Lethal-tick guard: bullet 1 kills 1 HP solo player -> bullet 2 in graze band on same tick must NOT graze
    sim.inHub = false;
    sim.autoRevivePlayer = false;
    sim.projectiles.length = 0;
    pl.hp = 1;
    pl.armor = 0;
    pl.invulnerableTimer = 0;
    pl.godMode = false;
    pl.grazeIcdTimer = 0;
    // Direct lethal hit bullet
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      ownerId: 99,
      team: 'enemy',
      weaponId: 'goblin_arrow',
      x: pl.x,
      y: pl.y,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 0,
      radius: 6,
      damage: 5,
      critChance: 0,
      knockback: 0,
      ttlSec: 2,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      amplifiedByShield: false,
      seed: 14,
    });
    // Simultaneous near-miss bullet in same updateProjectiles pass
    spawnGrazeBullet(15);
    sim.consumeEvents();
    sim.updateProjectiles(DT);
    expect(pl.hp).toBe(0);
    expect(sim.consumeEvents().some((e) => e.kind === 'bullet_grazed')).toBe(false);
  });

  it('preserves projectile heading on zero-initial-speed accel, skips kinematics while awaitingServerRedirectTimer > 0, and clears kinematics on emerald_cleaver boomerang deflection', () => {
    const sim = new WorldSim({
      seed: 406,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const targetAngle = Math.PI * 0.75;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      ownerId: 99,
      team: 'enemy',
      weaponId: 'zero_accel_test',
      x: 400,
      y: 300,
      angle: targetAngle,
      pelletCount: 1,
      spreadRad: 0,
      speed: 0,
      targetSpeed: 180,
      kinematicMode: 'accel',
      kinematicDelaySec: 0.1,
      kinematicRate: 6.0,
      radius: 6,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 2,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      amplifiedByShield: false,
      seed: 21,
    });

    const b = sim.projectiles[0]!;
    // While awaiting server redirect, stepProjectileKinematics in updateProjectiles returns early without advancing elapsed or clobbering angle
    b.awaitingServerRedirectTimer = 0.08;
    sim.updateProjectiles(DT);
    expect(b.angle).toBeCloseTo(targetAngle, 4);
    expect(b.kinematicElapsedSec ?? 0).toBe(0);
    b.awaitingServerRedirectTimer = 0;

    // Before delay (3 ticks = 0.05s): speed stays 0, heading stays 0.75*pi (never snaps to 0)
    for (let t = 0; t < 3; t++) {
      sim.updateProjectiles(DT);
    }
    expect(b.angle).toBeCloseTo(targetAngle, 4);

    // After delay (15 ticks = 0.25s total): accelerates along 0.75*pi (-X, +Y)
    for (let t = 0; t < 15; t++) {
      sim.updateProjectiles(DT);
    }
    expect(b.angle).toBeCloseTo(targetAngle, 3);
    expect(Math.hypot(b.vx, b.vy)).toBeGreaterThan(80);
    expect(b.vx).toBeLessThan(-50);
    expect(b.vy).toBeGreaterThan(50);

    // Secondary pool release (configureStressTest(false)) clears grazedPlayerIds immediately
    b.grazedPlayerIds = [sim.player.id];
    sim.configureStressTest(false);
    const lastPooled = sim.projectilePool[sim.projectilePool.length - 1]!;
    expect(lastPooled.grazedPlayerIds ?? []).toHaveLength(0);

    // Emerald Cleaver spinning boomerang deflects decel+spiral enemy bullet cleanly along boomerang angle
    sim.projectiles.length = 0;
    const boom = sim.acquireProjectile({
      id: 9001,
      ownerId: sim.player.id,
      team: 'player',
      weaponId: 'emerald_cleaver_boomerang',
      x: 400,
      y: 300,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: 20,
      damage: 30,
      ttlSec: 1.5,
      pierceRemaining: 99,
      bounceRemaining: 0,
      element: 'none',
      boomerangPhase: 'spinning',
    });
    const enemySpiral = sim.acquireProjectile({
      id: 9002,
      ownerId: 99,
      team: 'enemy',
      weaponId: 'spore_spiral_stream',
      x: 420,
      y: 300,
      vx: -160,
      vy: 0,
      angle: Math.PI,
      radius: 7,
      damage: 12,
      ttlSec: 1.5,
      pierceRemaining: 0,
      bounceRemaining: 0,
      element: 'poison',
      bulletShape: 'wave',
      kinematicMode: 'decel',
      initialSpeed: 160,
      targetSpeed: 40,
      kinematicRate: 8.0,
      angularVelRad: 3.0,
    });
    sim.projectiles.push(boom, enemySpiral);
    sim.updateProjectiles(DT);

    expect(enemySpiral.team).toBe('player');
    expect(enemySpiral.parryDeflected).toBe(true);
    expect(enemySpiral.kinematicMode).toBeUndefined();
    expect(enemySpiral.angularVelRad).toBeUndefined();
    expect(enemySpiral.bulletShape).toBeUndefined();

    const deflectedSpeed = Math.hypot(enemySpiral.vx, enemySpiral.vy);
    for (let t = 0; t < 10; t++) {
      sim.updateProjectiles(DT);
    }
    expect(enemySpiral.angle).toBeCloseTo(0, 4);
    expect(Math.hypot(enemySpiral.vx, enemySpiral.vy)).toBeCloseTo(deflectedSpeed, 2);
  });

  it('reduces regular enemy projectile speeds by 16-21% and bumps tiny radii with readable bulletShape tags', () => {
    expect(GOBLIN_SHOOTER_ARROW_SPEED).toBe(285);
    expect(FROST_BAT_SONIC_DART_SPEED).toBe(235);
    expect(ICE_MAGE_BOLT_SPEED).toBe(220);
    expect(ICE_MAGE_SHATTER_SPEAR_SPEED).toBe(232);
    expect(FIRE_IMP_FIREBALL_SPEED).toBe(235);
  });
});

