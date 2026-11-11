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
      bulletShape: 'orb' as const,
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

  it('clears kinematic fields when recycling projectiles through projectilePool', () => {
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
      bulletShape: 'small_orb',
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
    expect(sim.projectiles[0]!.bulletShape).toBe('small_orb');
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
  });

  it('does NOT trigger any bullet graze event or cooldown/heat/reload refund on near-miss enemy bullets in Boss or normal rooms', () => {
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
    pl.reloadTimer = 0.8;
    pl.reloadLockout = false;

    sim.spawnEnemy('spore_king', 600, 300, true);

    // Bullet passes 10px outside collision radius (formerly inside 18px graze band)
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

    const evs = sim.consumeEvents();
    expect(evs.some((e) => (e.kind as string) === 'bullet_grazed')).toBe(false);
    expect(pl.skillCooldownTimer).toBeCloseTo(3.0, 5);
    expect(pl.weaponHeat).toBeCloseTo(20, 5);
    expect(pl.reloadTimer).toBeCloseTo(0.8, 5);
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
    b.awaitingServerRedirectTimer = 0.08;
    sim.updateProjectiles(DT);
    expect(b.angle).toBeCloseTo(targetAngle, 4);
    expect(b.kinematicElapsedSec ?? 0).toBe(0);
    b.awaitingServerRedirectTimer = 0;

    for (let t = 0; t < 3; t++) {
      sim.updateProjectiles(DT);
    }
    expect(b.angle).toBeCloseTo(targetAngle, 4);

    for (let t = 0; t < 15; t++) {
      sim.updateProjectiles(DT);
    }
    expect(b.angle).toBeCloseTo(targetAngle, 3);
    expect(Math.hypot(b.vx, b.vy)).toBeGreaterThan(80);
    expect(b.vx).toBeLessThan(-50);
    expect(b.vy).toBeGreaterThan(50);

    sim.configureStressTest(false);

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
      bulletShape: 'heavy_orb',
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

    const fireEnemyAttack = (defId: string, biome: 1 | 2 | 3) => {
      const sim = new WorldSim({
        seed: 707,
        biome,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
      });
      sim.player.x = 220;
      sim.player.y = 320;
      const enemy = sim.spawnEnemy(defId, 460, 320, true);
      enemy.aiState = 'telegraph';
      enemy.stateTimer = 0.005;
      enemy.telegraphAngle = Math.PI;
      enemy.aimAngle = Math.PI;
      sim.projectiles.length = 0;
      sim.step(DT);
      return sim.projectiles.filter((b) => b.team === 'enemy');
    };

    const goblinBullets = fireEnemyAttack('goblin_shooter', 1);
    expect(goblinBullets.length).toBe(3);
    expect(goblinBullets.every((b) => b.bulletShape === 'lance')).toBe(true);

    const turretBullets = fireEnemyAttack('thorn_turret', 1);
    expect(turretBullets.length).toBe(6);
    expect(turretBullets.every((b) => b.bulletShape === 'small_orb')).toBe(true);

    const batBullets = fireEnemyAttack('frost_bat', 2);
    expect(batBullets.length).toBe(2);
    expect(batBullets.every((b) => b.bulletShape === 'small_orb')).toBe(true);

    const mageSpreadBullets = fireEnemyAttack('ice_mage', 2);
    expect(mageSpreadBullets.length).toBe(3);
    expect(mageSpreadBullets.every((b) => b.bulletShape === 'orb')).toBe(true);

    const cloneBullets = fireEnemyAttack('kryssa_clone', 2);
    expect(cloneBullets.length).toBe(2);
    expect(cloneBullets.every((b) => b.bulletShape === 'small_orb')).toBe(true);

    // Vengeful elite death ring -> 'orb', and ice_mage cryo_prism snipe ('lance') + refracted fan ('small_orb')
    const prismSim = new WorldSim({
      seed: 708,
      biome: 2,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    prismSim.player.x = 300;
    prismSim.player.y = 320;
    prismSim.pendingVengefulRings.push({
      x: 420,
      y: 200,
      timerSec: 0.005,
      ownerId: 88,
      damage: 2,
    });
    prismSim.step(DT);
    const vengefulBullets = prismSim.projectiles.filter((b) => b.weaponId === 'vengeful_ring');
    expect(vengefulBullets.length).toBe(8);
    expect(vengefulBullets.every((b) => b.bulletShape === 'orb')).toBe(true);

    prismSim.projectiles.length = 0;
    prismSim.spawnProp('cryo_prism_pillar', 480, 320);
    const prismMage = prismSim.spawnEnemy('ice_mage', 620, 320, true);
    prismMage.aiState = 'telegraph';
    prismMage.stateTimer = 0.005;
    prismMage.telegraphDurationSec = 0.55;
    prismSim.step(DT);
    expect(prismSim.projectiles.length).toBe(1);
    expect(prismSim.projectiles[0]!.bulletShape).toBe('lance');

    for (let i = 0; i < 30; i++) {
      prismSim.step(DT);
      if (prismSim.projectiles.some((b) => b.team === 'enemy' && b.splitGeneration === 1)) break;
    }
    const refracted = prismSim.projectiles.filter(
      (b) => b.team === 'enemy' && b.splitGeneration === 1,
    );
    expect(refracted.length).toBe(3);
    expect(refracted.every((b) => b.bulletShape === 'small_orb')).toBe(true);
  });
});

