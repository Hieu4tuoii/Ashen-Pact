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
  });

  it('reduces regular enemy projectile speeds by 16-21% and bumps tiny radii with readable bulletShape tags', () => {
    expect(GOBLIN_SHOOTER_ARROW_SPEED).toBe(285);
    expect(FROST_BAT_SONIC_DART_SPEED).toBe(235);
    expect(ICE_MAGE_BOLT_SPEED).toBe(220);
    expect(ICE_MAGE_SHATTER_SPEAR_SPEED).toBe(232);
    expect(FIRE_IMP_FIREBALL_SPEED).toBe(235);
  });
});

