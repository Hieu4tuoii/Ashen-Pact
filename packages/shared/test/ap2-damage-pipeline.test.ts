import { describe, expect, it } from 'vitest';
import {
  ADDITIVE_POOL_HARD_CAP_MULT,
  ADDITIVE_POOL_SOFT_CAP_MULT,
  ADDITIVE_POOL_SOFT_CAP_THRESHOLD,
  BOSS_SINGLE_HIT_MAX_MULT,
  ENEMY_VULN_HARD_CAP_MULT,
  MAX_BOUNCE_COUNT,
  MAX_PELLETS_PER_TRIGGER,
  MAX_SPLIT_GENERATION,
  SHATTER_BOSS_CAP_MULT,
  SHATTER_REGULAR_MULT,
  WorldSim,
  clampBounceCount,
  clampPelletsPerTrigger,
  computeAdditiveBonusSum,
  computeAdditivePoolMultiplier,
  computeAdditivePoolSum,
  computeEnemyVulnerabilityMultiplier,
  computeReactionMultiplier,
  computeReactionShatterMultiplier,
  computeThreeBucketDamage,
  computeUpgradeMultiplier,
  evaluateThreeBucketDamageBreakdown,
  resolveProjectileSplitInSim,
  scaleBlessingDamage,
  trySplitProjectile,
} from '../src/index.js';

describe('AP2 Phase P1B.4 — 3-Bucket Damage Pipeline & Anti-Explosion Property-Based Audit', () => {
  it('computes Upgrade Multiplier M_upgrade (1.00x .. 1.60x) and Blessing Floor Scaling M_floor(F)', () => {
    expect(computeUpgradeMultiplier(-1)).toBeCloseTo(1.0, 5);
    expect(computeUpgradeMultiplier(0)).toBeCloseTo(1.0, 5);
    expect(computeUpgradeMultiplier(1)).toBeCloseTo(1.2, 5);
    expect(computeUpgradeMultiplier(2)).toBeCloseTo(1.4, 5);
    expect(computeUpgradeMultiplier(3)).toBeCloseTo(1.6, 5);
    expect(computeUpgradeMultiplier(5)).toBeCloseTo(1.6, 5);

    // scaleBlessingDamage(baseDmg, F) = round(baseDmg * (1 + 0.22 * (F - 1)))
    expect(scaleBlessingDamage(20, 1)).toBe(20); // 20 * 1.00 = 20
    expect(scaleBlessingDamage(20, 2)).toBe(24); // 20 * 1.22 = 24.4 -> 24
    expect(scaleBlessingDamage(20, 3)).toBe(29); // 20 * 1.44 = 28.8 -> 29
    expect(scaleBlessingDamage(20, 6)).toBe(42); // 20 * 2.10 = 42
  });

  it('enforces Additive Pool Soft Cap (2.80x at S > 1.80 with 0.35x slope) and Hard Cap (3.80x)', () => {
    expect(ADDITIVE_POOL_SOFT_CAP_THRESHOLD).toBe(1.8);
    expect(ADDITIVE_POOL_SOFT_CAP_MULT).toBe(2.8);
    expect(ADDITIVE_POOL_HARD_CAP_MULT).toBe(3.8);

    // Linear region: S <= 1.80 -> M = 1 + S
    expect(computeAdditivePoolMultiplier(0)).toBeCloseTo(1.0, 5);
    expect(computeAdditivePoolMultiplier(0.5)).toBeCloseTo(1.5, 5);
    expect(computeAdditivePoolMultiplier(1.2)).toBeCloseTo(2.2, 5);
    expect(computeAdditivePoolMultiplier(1.8)).toBeCloseTo(2.8, 5);

    // Soft-cap region: S > 1.80 -> M = 2.80 + 0.35 * (S - 1.80)
    expect(computeAdditivePoolMultiplier(2.8)).toBeCloseTo(3.15, 5);
    expect(computeAdditivePoolMultiplier(3.8)).toBeCloseTo(3.5, 5);

    // Hard-cap region: capped strictly at 3.80
    expect(computeAdditivePoolMultiplier(4.8)).toBeCloseTo(3.8, 5);
    expect(computeAdditivePoolMultiplier(10.0)).toBeCloseTo(3.8, 5);

    // Structured input sum check
    const sum = computeAdditivePoolSum({
      finaleShot: true, // +0.50
      overclockedShot: true, // +0.45
      overheatOrange: true, // +0.25
      bounceCount: 4, // +1.40
      shieldBonusAdd: 0.75, // +0.75
      zoneImbued: true, // +0.15
      prismSplit: true, // +0.20
      pactBonusAdd: 0.5, // +0.50
      relicBonusAdd: 0.4, // +0.40
    });
    expect(computeAdditiveBonusSum({ finaleShot: true })).toBeCloseTo(0.5, 5);
    expect(sum).toBeCloseTo(4.6, 5);
    expect(computeAdditivePoolMultiplier(sum)).toBeLessThanOrEqual(3.8);
    expect(computeAdditivePoolMultiplier(sum)).toBeCloseTo(2.8 + 0.35 * (4.6 - 1.8), 5);

    // Exhaustive sweep across S in [-0.9, 20.0]
    for (let step = -90; step <= 2000; step++) {
      const s = Number((step / 100).toFixed(2));
      const m = computeAdditivePoolMultiplier(s);
      expect(m).toBeLessThanOrEqual(3.8);
      if (s <= 1.8) {
        expect(m).toBeCloseTo(Math.max(0.1, 1 + s), 5);
      } else {
        expect(m).toBeCloseTo(Math.min(3.8, 2.8 + 0.35 * (s - 1.8)), 5);
      }
    }
  });

  it('enforces Enemy Vulnerability Bucket Cap (<= 1.75x) and Reaction Shatter Caps (2.0x regular/Elite, 1.35x Boss)', () => {
    expect(ENEMY_VULN_HARD_CAP_MULT).toBe(1.75);
    expect(SHATTER_REGULAR_MULT).toBe(2.0);
    expect(SHATTER_BOSS_CAP_MULT).toBe(1.35);
    expect(BOSS_SINGLE_HIT_MAX_MULT).toBe(18.0);

    expect(computeEnemyVulnerabilityMultiplier({})).toBeCloseTo(1.0, 5);
    expect(computeEnemyVulnerabilityMultiplier({ marked: true })).toBeCloseTo(1.25, 5);
    expect(
      computeEnemyVulnerabilityMultiplier({ marked: true, superconduct: true }),
    ).toBeCloseTo(1.5, 5);
    expect(
      computeEnemyVulnerabilityMultiplier({
        marked: true,
        superconduct: true,
        caustic: true,
      }),
    ).toBeCloseTo(1.75, 5);
    // Adding bossArmorBreak (+0.40) on top of 1.75 stays hard-capped at 1.75
    expect(
      computeEnemyVulnerabilityMultiplier({
        marked: true,
        superconduct: true,
        caustic: true,
        bossArmorBreak: true,
      }),
    ).toBeCloseTo(1.75, 5);

    expect(computeReactionMultiplier('none', false)).toBe(1.0);
    expect(computeReactionMultiplier('shatter', false)).toBe(2.0);
    expect(computeReactionMultiplier('shatter', true)).toBe(1.35);
    expect(computeReactionShatterMultiplier(false, false)).toBe(1.0);
    expect(computeReactionShatterMultiplier(true, false)).toBe(2.0);
    expect(computeReactionShatterMultiplier(true, true)).toBe(1.35);
  });

  it('enforces splitGeneration (0 -> 1 max), MAX_PELLETS_PER_TRIGGER = 9, and MAX_BOUNCE_COUNT = 4 without recursive bullet explosion', () => {
    expect(MAX_SPLIT_GENERATION).toBe(1);
    expect(MAX_PELLETS_PER_TRIGGER).toBe(9);
    expect(MAX_BOUNCE_COUNT).toBe(4);

    expect(clampPelletsPerTrigger(1)).toBe(1);
    expect(clampPelletsPerTrigger(9)).toBe(9);
    expect(clampPelletsPerTrigger(15)).toBe(9);
    expect(clampBounceCount(2)).toBe(2);
    expect(clampBounceCount(9)).toBe(4);

    const sim = new WorldSim({
      seed: 4401,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    // 1. Trigger pull with pelletCount = 14 is clamped to MAX_PELLETS_PER_TRIGGER (9) and bounceCount = 7 is clamped to MAX_BOUNCE_COUNT (4)
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: sim.player.id,
      team: 'player',
      weaponId: 'rivet_gun',
      x: 200,
      y: 200,
      angle: 0,
      pelletCount: 14,
      spreadRad: 0.3,
      speed: 500,
      damage: 20,
      radius: 5,
      knockback: 40,
      pierceCount: 1,
      bounceCount: 7,
      ttlSec: 1.0,
      element: 'none',
      critChance: 0,
      amplifiedByShield: false,
      seed: 101,
    });
    expect(sim.projectiles.length).toBe(MAX_PELLETS_PER_TRIGGER);
    expect(sim.projectiles[0]!.bounceRemaining).toBe(MAX_BOUNCE_COUNT);
    expect(sim.projectiles[0]!.splitGeneration).toBe(0);

    // 2. Clear and spawn 1 primary projectile (splitGeneration = 0, bounceRemaining = 2)
    sim.projectiles.length = 0;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: sim.player.id,
      team: 'player',
      weaponId: 'rivet_gun',
      x: 240,
      y: 240,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 500,
      damage: 20,
      radius: 5,
      knockback: 40,
      pierceCount: 1,
      bounceCount: 2,
      ttlSec: 1.0,
      element: 'none',
      critChance: 0,
      amplifiedByShield: false,
      seed: 202,
    });
    const rootProj = sim.projectiles[0]!;
    expect(rootProj.splitGeneration).toBe(0);

    // Passing through first splitter (e.g. cryo_prism_pillar / table_tech_prism_split) spawns split children with splitGeneration = 1
    const firstSplit = trySplitProjectile(sim, rootProj, 2, 0.35);
    expect(firstSplit.didSplit).toBe(true);
    expect(firstSplit.spawnedProjectiles.length).toBe(2);
    for (const child of firstSplit.spawnedProjectiles) {
      expect(child.splitGeneration).toBe(1);
    }

    // Passing ANY splitGeneration === 1 projectile through a second splitter MUST NEVER spawn children;
    // instead it only grants +20% Additive Damage (prismBonusAdd += 0.20) and +1 bounceRemaining (clamped to MAX_BOUNCE_COUNT = 4)
    const childProj = firstSplit.spawnedProjectiles[0]!;
    const dmgBeforeSecondPrism = childProj.damage;
    const bounceBeforeSecondPrism = childProj.bounceRemaining;
    const prismBonusBefore = childProj.prismBonusAdd ?? 0;
    const countBeforeSecondPrism = sim.projectiles.length;

    const secondSplit = trySplitProjectile(sim, childProj, 3, 0.4);
    expect(secondSplit.didSplit).toBe(false);
    expect(secondSplit.spawnedProjectiles.length).toBe(0);
    expect(sim.projectiles.length).toBe(countBeforeSecondPrism);
    expect(childProj.splitGeneration).toBe(1);
    expect(childProj.prismBonusAdd).toBeCloseTo(prismBonusBefore + 0.2, 5);
    expect(childProj.damage).toBe(Math.round(dmgBeforeSecondPrism * 1.2));
    expect(childProj.bounceRemaining).toBe(
      Math.min(MAX_BOUNCE_COUNT, bounceBeforeSecondPrism + 1),
    );
    expect(resolveProjectileSplitInSim(sim, childProj, 2, 0.35).didSplit).toBe(false);
  });

  it('exhaustively audits 4,608+ combinations of all 3 buckets to prove M_AdditivePool <= 3.80, M_EnemyVuln <= 1.75, and Boss Single-Hit <= 18.0x Base Damage', () => {
    const baseDamages = [10, 38, 68];
    const upgradeLevels = [0, 1, 2, 3];
    const finaleFlags = [false, true];
    const overclockFlags = [false, true];
    const overheatFlags = [false, true];
    const bounceCounts = [0, 2, 4, 6];
    const shieldBonuses = [0, 0.45, 0.75];
    const pactRelicExtras = [0, 0.65, 2.5];
    const critFlags = [false, true];
    const vulnStates = [
      { marked: false, superconduct: false, caustic: false, bossArmorBreak: false },
      { marked: true, superconduct: true, caustic: false, bossArmorBreak: false },
      { marked: true, superconduct: true, caustic: true, bossArmorBreak: true },
    ];
    const shatterFlags = [false, true];
    const bossFlags = [false, true];

    let combinationsChecked = 0;
    let violations = 0;

    for (const baseDamage of baseDamages) {
      for (const upgradeLevel of upgradeLevels) {
        for (const finaleShot of finaleFlags) {
          for (const overclockedShot of overclockFlags) {
            for (const overheatOrange of overheatFlags) {
              for (const bounceCount of bounceCounts) {
                for (const shieldBonusAdd of shieldBonuses) {
                  for (const extraAdd of pactRelicExtras) {
                    for (const isCrit of critFlags) {
                      for (const vuln of vulnStates) {
                        for (const shatter of shatterFlags) {
                          for (const isBoss of bossFlags) {
                            combinationsChecked += 1;
                            const input = {
                              baseDamage,
                              upgradeLevel,
                              additive: {
                                finaleShot,
                                overclockedShot,
                                overheatOrange,
                                bounceCount,
                                shieldBonusAdd,
                                zoneImbued: extraAdd > 0,
                                prismSplit: extraAdd > 1.0,
                                pactBonusAdd: extraAdd * 0.5,
                                relicBonusAdd: extraAdd * 0.5,
                              },
                              isCrit,
                              vulnerability: vuln,
                              shatter,
                              isBoss,
                            };
                            const breakdown = evaluateThreeBucketDamageBreakdown(input);

                            if (breakdown.upgradeMult > 1.6 + 1e-9) violations += 1;
                            if (breakdown.additiveMult > ADDITIVE_POOL_HARD_CAP_MULT + 1e-9) {
                              violations += 1;
                            }
                            if (breakdown.vulnMult > ENEMY_VULN_HARD_CAP_MULT + 1e-9) {
                              violations += 1;
                            }

                            if (isBoss) {
                              if (breakdown.reactionMult > SHATTER_BOSS_CAP_MULT + 1e-9) {
                                violations += 1;
                              }
                              if (breakdown.totalMultiplier > BOSS_SINGLE_HIT_MAX_MULT + 1e-9) {
                                violations += 1;
                              }
                              if (
                                breakdown.finalDamage >
                                Math.round(baseDamage * BOSS_SINGLE_HIT_MAX_MULT)
                              ) {
                                violations += 1;
                              }
                            }

                            const directDmg = computeThreeBucketDamage(input);
                            if (directDmg !== breakdown.finalDamage) violations += 1;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(violations).toBe(0);
    expect(combinationsChecked).toBeGreaterThanOrEqual(4_000);
  });

  it('enforces Shatter 2.0x on regular enemies and 1.35x + <= 18.0x ceiling on Bosses in live WorldSim.applyDamageToEnemy', () => {
    const sim = new WorldSim({
      seed: 4402,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const p = sim.player;
    const regularEnemy = sim.spawnEnemy('wild_boar', 360, 260, true);
    regularEnemy.hp = 500;
    regularEnemy.maxHp = 500;
    regularEnemy.frozenTimer = 1.5;

    sim.applyDamageToEnemy(regularEnemy, 20, false, 'none', 0, 0, true, p.id);
    // 20 * 2.0 (Shatter on regular enemy) = 40
    expect(500 - regularEnemy.hp).toBe(40);

    const boss = sim.spawnEnemy('forge_titan', 460, 260, true);
    boss.hp = 10000;
    boss.maxHp = 10000;
    boss.shieldArmor = 0;
    boss.frozenTimer = 1.5;
    boss.markedTimer = 5.0;
    boss.superconductTimer = 5.0;
    boss.aiState = 'stunned'; // Overload stunned (+50% vuln)

    // Even with Marked (+25%) + Superconduct (+30%) + Stunned (+50%) -> Vuln capped at 1.75x,
    // and Shatter on Boss capped at 1.35x -> 100 * 1.75 * 1.35 = 236.25 -> 236
    sim.applyDamageToEnemy(boss, 100, true, 'none', 0, 0, true, p.id);
    const bossLoss = 10000 - boss.hp;
    expect(bossLoss).toBe(Math.round(100 * 1.75 * 1.35));
    expect(bossLoss).toBeLessThanOrEqual(100 * BOSS_SINGLE_HIT_MAX_MULT);
  });
});
