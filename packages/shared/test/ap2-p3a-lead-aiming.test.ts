import { describe, expect, it } from 'vitest';
import {
  LEAD_FACTOR_ELITE_OR_BOSS,
  LEAD_FACTOR_REGULAR,
  MAX_PREDICTIVE_LEAD_ANGLE_RAD,
  MAX_PREDICTIVE_LEAD_TIME_SEC,
  SIGHTLINE_TELEGRAPH_WINDOW_SEC,
  WorldSim,
  angleDiff,
  computeLeadAimAngle,
  computePredictiveLeadAimAngle,
  normalizeAngle,
  raycastSightlineDistance,
  updateEnemyPredictiveSightline,
} from '../src/index.js';

describe('AP2 Phase 3A — Task 1 (P3A.1): Bounded Predictive Lead Aiming & 0.35s Sightline Telegraph', () => {
  it('P3A.1a: exports exact Spec Rev 4 Section 6.1 constants', () => {
    expect(LEAD_FACTOR_REGULAR).toBe(0.35);
    expect(LEAD_FACTOR_ELITE_OR_BOSS).toBe(0.65);
    expect(MAX_PREDICTIVE_LEAD_TIME_SEC).toBe(0.65);
    expect(MAX_PREDICTIVE_LEAD_ANGLE_RAD).toBeCloseTo((28 * Math.PI) / 180, 6);
    expect(SIGHTLINE_TELEGRAPH_WINDOW_SEC).toBe(0.35);
  });

  it('P3A.1b: aims directly at a stationary target (vx = 0, vy = 0)', () => {
    const enemy = {
      x: 200,
      y: 200,
      isElite: false,
      isBoss: false,
      steamBlindTimer: 0,
      strafeSign: 1,
    };
    const target = {
      x: 420,
      y: 310,
      vx: 0,
      vy: 0,
    };
    const directAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
    const angle = computePredictiveLeadAimAngle(enemy, target, 250);
    expect(angle).toBeCloseTo(directAngle, 6);
    expect(computeLeadAimAngle(enemy, target, 250)).toBeCloseTo(directAngle, 6);
  });

  it('P3A.1c: computes predictive lead angle for regular (0.35) and elite/boss (0.65) enemies using timeToHit = min(0.65, dist / speed)', () => {
    const enemyRegular = {
      x: 200,
      y: 300,
      isElite: false,
      isBoss: false,
      steamBlindTimer: 0,
      strafeSign: 1,
    };
    const enemyElite = {
      ...enemyRegular,
      isElite: true,
    };
    const enemyBoss = {
      ...enemyRegular,
      isBoss: true,
    };
    const target = {
      x: 325, // dist = 125
      y: 300,
      vx: 0,
      vy: 140, // moving downward
    };
    const projectileSpeed = 250; // timeToHit = min(0.65, 125 / 250) = 0.5s

    const directAngle = 0;
    const expectedRegPredY = 300 + 140 * 0.5 * 0.35; // 324.5
    const expectedRegAngle = Math.atan2(expectedRegPredY - 300, 325 - 200);

    const expectedElitePredY = 300 + 140 * 0.5 * 0.65; // 345.5
    const expectedEliteAngle = Math.atan2(expectedElitePredY - 300, 325 - 200);

    const regAngle = computePredictiveLeadAimAngle(enemyRegular, target, projectileSpeed);
    const eliteAngle = computePredictiveLeadAimAngle(enemyElite, target, projectileSpeed);
    const bossAngle = computePredictiveLeadAimAngle(enemyBoss, target, projectileSpeed);

    expect(regAngle).toBeGreaterThan(directAngle);
    expect(regAngle).toBeCloseTo(expectedRegAngle, 6);
    expect(eliteAngle).toBeGreaterThan(regAngle);
    expect(eliteAngle).toBeCloseTo(expectedEliteAngle, 6);
    expect(bossAngle).toBeCloseTo(expectedEliteAngle, 6);

    // Also verify timeToHit cap at 0.65s when target is very far
    const farTarget = {
      x: 700, // dist = 500 -> 500 / 250 = 2.0s -> capped at 0.65s
      y: 300,
      vx: 0,
      vy: 120,
    };
    const expectedFarPredY = 300 + 120 * 0.65 * 0.35;
    const expectedFarAngle = Math.atan2(expectedFarPredY - 300, 500);
    expect(computePredictiveLeadAimAngle(enemyRegular, farTarget, projectileSpeed)).toBeCloseTo(
      expectedFarAngle,
      6,
    );
  });

  it('P3A.1d: clamps lead angle delta strictly to ±28° (MAX_PREDICTIVE_LEAD_ANGLE_RAD), including across the -π / +π boundary', () => {
    const enemy = {
      x: 300,
      y: 300,
      isElite: true,
      isBoss: false,
      steamBlindTimer: 0,
      strafeSign: 1,
    };
    // Close target moving extremely fast perpendicular to line of sight
    const closeFastTarget = {
      x: 340,
      y: 300,
      vx: 0,
      vy: 900,
    };
    const clampedPos = computePredictiveLeadAimAngle(enemy, closeFastTarget, 150);
    expect(clampedPos).toBeCloseTo(MAX_PREDICTIVE_LEAD_ANGLE_RAD, 6);

    const closeFastNegTarget = {
      x: 340,
      y: 300,
      vx: 0,
      vy: -900,
    };
    const clampedNeg = computePredictiveLeadAimAngle(enemy, closeFastNegTarget, 150);
    expect(clampedNeg).toBeCloseTo(-MAX_PREDICTIVE_LEAD_ANGLE_RAD, 6);

    // Custom maxLeadAngleRad
    const customMax = 0.25;
    expect(
      computePredictiveLeadAimAngle(enemy, closeFastTarget, 150, undefined, customMax),
    ).toBeCloseTo(customMax, 6);

    // Wrap across +π / -π boundary (target to the left of enemy, directAngle ~ 3.05 rad)
    const dist = 50;
    const directAngle = 3.05;
    const wrapTarget = {
      x: enemy.x + Math.cos(directAngle) * dist,
      y: enemy.y + Math.sin(directAngle) * dist,
      // Tangent vector pointing counter-clockwise (increasing angle past +π into negative radians)
      vx: -Math.sin(directAngle) * 900,
      vy: Math.cos(directAngle) * 900,
    };
    const wrappedAngle = computePredictiveLeadAimAngle(enemy, wrapTarget, 150);
    const expectedWrapped = normalizeAngle(directAngle + MAX_PREDICTIVE_LEAD_ANGLE_RAD);
    expect(angleDiff(wrappedAngle, expectedWrapped)).toBeCloseTo(0, 6);
    expect(angleDiff(wrappedAngle, directAngle)).toBeCloseTo(MAX_PREDICTIVE_LEAD_ANGLE_RAD, 6);

    // Wrap in the opposite direction from -3.05 rad across -π into positive radians
    const negDirectAngle = -3.05;
    const wrapNegTarget = {
      x: enemy.x + Math.cos(negDirectAngle) * dist,
      y: enemy.y + Math.sin(negDirectAngle) * dist,
      // Tangent vector pointing clockwise (decreasing angle past -π into positive radians)
      vx: Math.sin(negDirectAngle) * 900,
      vy: -Math.cos(negDirectAngle) * 900,
    };
    const wrappedNegAngle = computePredictiveLeadAimAngle(enemy, wrapNegTarget, 150);
    const expectedWrappedNeg = normalizeAngle(negDirectAngle - MAX_PREDICTIVE_LEAD_ANGLE_RAD);
    expect(angleDiff(wrappedNegAngle, expectedWrappedNeg)).toBeCloseTo(0, 6);
    expect(angleDiff(wrappedNegAngle, negDirectAngle)).toBeCloseTo(
      -MAX_PREDICTIVE_LEAD_ANGLE_RAD,
      6,
    );
  });

  it('P3A.1e: applies jitterRad and steamBlindTimer offset cleanly', () => {
    const enemy = {
      x: 200,
      y: 200,
      isElite: false,
      isBoss: false,
      steamBlindTimer: 1.5,
      strafeSign: -1,
    };
    const target = {
      x: 350,
      y: 200,
      vx: 0,
      vy: 0,
    };
    const jitter = 0.08;
    const angle = computePredictiveLeadAimAngle(
      enemy,
      target,
      250,
      undefined,
      MAX_PREDICTIVE_LEAD_ANGLE_RAD,
      jitter,
    );
    expect(angle).toBeCloseTo(jitter + 0.52 * -1, 6);
  });

  it('P3A.1f: tracks predictive angle while stateTimer > 0.35 and locks telegraphAngle during the final 0.35s sightline window', () => {
    const sim = new WorldSim({
      seed: 3001,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    const p = sim.player;
    p.x = 400;
    p.y = 300;
    p.vx = 0;
    p.vy = 160;

    const shooter = sim.spawnEnemy('goblin_shooter', 200, 300, true);
    shooter.aiState = 'telegraph';
    shooter.telegraphDurationSec = 0.65;
    shooter.stateTimer = 0.5; // > 0.35s: tracking phase

    updateEnemyPredictiveSightline(sim, shooter, p, 250);
    expect(shooter.leadSightlineActive).toBe(false);
    const angleWhileTracking1 = shooter.telegraphAngle;
    expect(angleWhileTracking1).toBeGreaterThan(0);

    // Player reverses direction while still > 0.35s -> telegraphAngle updates to track new velocity
    p.vy = -160;
    shooter.stateTimer = 0.42;
    updateEnemyPredictiveSightline(sim, shooter, p, 250);
    expect(shooter.leadSightlineActive).toBe(false);
    const angleWhileTracking2 = shooter.telegraphAngle;
    expect(angleWhileTracking2).toBeLessThan(0);

    // Enter final 0.35s sightline lock window (stateTimer <= 0.35)
    shooter.stateTimer = 0.34;
    updateEnemyPredictiveSightline(sim, shooter, p, 250);
    expect(shooter.leadSightlineActive).toBe(true);
    const lockedAngle = shooter.telegraphAngle;
    expect(shooter.leadSightlineAngle).toBeCloseTo(lockedAngle, 6);
    expect(shooter.aimAngle).toBeCloseTo(lockedAngle, 6);

    // Player violently changes velocity and position during the locked 0.35s window -> angle MUST remain locked!
    p.vx = 220;
    p.vy = 260;
    p.x = 460;
    p.y = 420;
    shooter.stateTimer = 0.18;
    updateEnemyPredictiveSightline(sim, shooter, p, 250);
    expect(shooter.leadSightlineActive).toBe(true);
    expect(shooter.telegraphAngle).toBeCloseTo(lockedAngle, 6);
    expect(shooter.leadSightlineAngle).toBeCloseTo(lockedAngle, 6);

    // Leaving telegraph state resets leadSightlineActive to false
    shooter.aiState = 'cooldown';
    updateEnemyPredictiveSightline(sim, shooter, p, 250);
    expect(shooter.leadSightlineActive).toBe(false);
  });

  it('P3A.1g: raycastSightlineDistance stops at solid walls and flipped tactical cover props', () => {
    const sim = new WorldSim({
      seed: 3002,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    const fullDist = raycastSightlineDistance(sim, 200, 300, 0, 260);
    expect(fullDist).toBeCloseTo(260, 1);

    // Place a flipped cover table directly in the sightline at x = 310, y = 300
    const table = sim.spawnProp('moss_table', 310, 300);
    table.coverState = 'low';
    table.blocksEnemyProjectiles = false;
    // Low cover does not block sightline
    expect(raycastSightlineDistance(sim, 200, 300, 0, 260)).toBeCloseTo(260, 1);

    // Flipping the cover blocks the sightline before reaching 260
    table.coverState = 'flipped';
    table.blocksEnemyProjectiles = true;
    const blockedDist = raycastSightlineDistance(sim, 200, 300, 0, 260);
    expect(blockedDist).toBeLessThan(120);
    expect(blockedDist).toBeGreaterThan(70);
  });

  it('P3A.1h: integrates predictive lead aiming and 0.35s sightline lock into ranged enemy and boss AI telegraphs', () => {
    const sim = new WorldSim({
      seed: 3003,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    const p = sim.player;
    p.x = 420;
    p.y = 300;
    p.vx = 0;
    p.vy = 160; // Strafing downward

    const shooter = sim.spawnEnemy('goblin_shooter', 200, 300, true);
    shooter.attackCooldownTimer = 0;
    shooter.telegraphDurationSec = 0.55;

    // 1. Trigger telegraph entry -> telegraphAngle leads downward (> 0) and is not locked yet (> 0.35s)
    sim.updateEnemies(1 / 60);
    expect(shooter.aiState).toBe('telegraph');
    expect(shooter.stateTimer).toBeGreaterThan(0.35);
    expect(shooter.leadSightlineActive).toBe(false);
    expect(shooter.telegraphAngle).toBeGreaterThan(0.05);

    // 2. Step until shooter.stateTimer <= 0.35 -> sightline locks
    while (shooter.stateTimer > 0.35) {
      sim.updateEnemies(1 / 60);
    }
    expect(shooter.leadSightlineActive).toBe(true);
    const lockedAngle = shooter.telegraphAngle;

    // 3. Player reverses direction during final 0.35s window -> lockedAngle does NOT change and volley fires along lockedAngle
    p.vy = -220;
    p.y = 210;
    while (shooter.aiState === 'telegraph') {
      expect(shooter.telegraphAngle).toBeCloseTo(lockedAngle, 6);
      sim.updateEnemies(1 / 60);
    }
    expect(shooter.aiState).toBe('cooldown');
    expect(shooter.leadSightlineActive).toBe(false);
    const middleArrow = sim.projectiles.find(
      (b) => b.ownerId === shooter.id && Math.abs(angleDiff(b.angle, lockedAngle)) < 0.01,
    );
    expect(middleArrow).toBeDefined();
  });
});
