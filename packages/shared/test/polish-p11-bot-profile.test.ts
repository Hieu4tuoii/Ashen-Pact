import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  formatMarkdownReport,
  measureBiomeDifficultyProgression,
  measureCombatRoomClearSec,
  runBalanceHarness,
  simulateBossEncounter,
} from '../../../tools/balance-harness.js';
import {
  AVERAGE_PLAYER_BOT_PROFILE,
  computeDistributionStats,
  createBotBrainState,
  stepHonestPlayerBot,
} from '../../../tools/bot-profile.js';
import { INPUT_BUTTON, SIM_STEP_SEC, WEAPONS, WorldSim } from '../src/index.js';

describe('Phase P11 — Locked Average Player Bot Profile & Honest Simulation Primitives (Spec 3.10)', () => {
  it('defines and freezes AVERAGE_PLAYER_BOT_PROFILE with Spec 3.10 parameters and 30 unique seeds', () => {
    expect(Object.isFrozen(AVERAGE_PLAYER_BOT_PROFILE)).toBe(true);
    expect(Object.isFrozen(AVERAGE_PLAYER_BOT_PROFILE.seeds)).toBe(true);

    expect(AVERAGE_PLAYER_BOT_PROFILE.aimAccuracy).toBe(0.7);
    expect(AVERAGE_PLAYER_BOT_PROFILE.aimAccuracy).toBeGreaterThanOrEqual(0.65);
    expect(AVERAGE_PLAYER_BOT_PROFILE.aimAccuracy).toBeLessThanOrEqual(0.75);

    expect(AVERAGE_PLAYER_BOT_PROFILE.reactionDelaySec).toBe(0.25);
    expect(AVERAGE_PLAYER_BOT_PROFILE.reactionDelaySec).toBeGreaterThanOrEqual(0.2);
    expect(AVERAGE_PLAYER_BOT_PROFILE.reactionDelaySec).toBeLessThanOrEqual(0.3);

    expect(AVERAGE_PLAYER_BOT_PROFILE.dashDodgeProbability).toBe(0.65);
    expect(AVERAGE_PLAYER_BOT_PROFILE.dashDodgeProbability).toBeGreaterThanOrEqual(0.6);
    expect(AVERAGE_PLAYER_BOT_PROFILE.dashDodgeProbability).toBeLessThanOrEqual(0.7);

    expect(AVERAGE_PLAYER_BOT_PROFILE.godMode).toBe(false);
    expect(AVERAGE_PLAYER_BOT_PROFILE.seeds.length).toBe(30);

    const uniqueSeeds = new Set(AVERAGE_PLAYER_BOT_PROFILE.seeds);
    expect(uniqueSeeds.size).toBe(30);
  });

  it('computes p10, p50 (median), p90, mean, min, and max accurately via computeDistributionStats', () => {
    const sample = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const stats = computeDistributionStats(sample);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(100);
    expect(stats.mean).toBe(55);
    expect(stats.p50).toBe(55);
    expect(stats.p10).toBeGreaterThanOrEqual(10);
    expect(stats.p10).toBeLessThanOrEqual(20);
    expect(stats.p90).toBeGreaterThanOrEqual(90);
    expect(stats.p90).toBeLessThanOrEqual(100);

    const emptyStats = computeDistributionStats([]);
    expect(emptyStats).toEqual({
      mean: 0,
      p10: 0,
      p50: 0,
      p90: 0,
      min: 0,
      max: 0,
    });
  });

  it('never enables godMode and swaps to backup weapon when active weapon is locked out by reload/overheat', () => {
    const sim = new WorldSim({
      seed: 10101,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.selectCharacter(sim.player.id, 'ranger');
    const p = sim.player;
    p.x = 340;
    p.y = 270;
    p.weaponSlots = ['solar_archon_staff', 'hunter_crossbow'];
    p.activeWeaponSlot = 0;
    p.overheatLockTimer = 1.5;

    const enemy = sim.spawnEnemy('goblin_shooter', 500, 270, true);
    enemy.hp = 500;
    enemy.maxHp = 500;

    const brain = createBotBrainState(p.id, 10101);
    const pkt = stepHonestPlayerBot(
      sim,
      p,
      brain,
      AVERAGE_PLAYER_BOT_PROFILE,
      SIM_STEP_SEC,
      1,
    );

    expect(p.godMode).toBe(false);
    expect(pkt.weaponSlotSelect).toBe(1);
    expect(WEAPONS[p.weaponSlots[1]!]!.cadenceKind).toBe('CLIP_RELOAD');
  });

  it('enforces reactionDelaySec (250ms) before reacting to a new threat and rolls dashDodgeProbability (65%) deterministically', () => {
    const sim = new WorldSim({
      seed: 20202,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.selectCharacter(sim.player.id, 'ranger');
    const p = sim.player;
    p.x = 360;
    p.y = 300;

    const boar = sim.spawnEnemy('wild_boar', 415, 300, true);
    boar.aiState = 'telegraph';
    boar.stateTimer = 0.65;
    boar.telegraphDurationSec = 0.7;

    const brain = createBotBrainState(p.id, 20202);
    // Force deterministic roll that succeeds (< 0.65) once reaction delay elapses
    brain.rngState = 1234567;

    // During first 14 ticks (~0.233s < 0.25s reactionDelaySec), bot has NOT finished reacting yet
    let dashedBeforeReaction = false;
    for (let t = 1; t <= 14; t++) {
      const pkt = stepHonestPlayerBot(
        sim,
        p,
        brain,
        AVERAGE_PLAYER_BOT_PROFILE,
        SIM_STEP_SEC,
        t,
      );
      if ((pkt.buttons & INPUT_BUTTON.DASH) !== 0) {
        dashedBeforeReaction = true;
      }
    }
    expect(dashedBeforeReaction).toBe(false);

    // Count dash dodge decisions across 100 distinct threat events to verify ~65% probability (within 55%..75%)
    let dashCount = 0;
    const trials = 120;
    for (let i = 0; i < trials; i++) {
      const trialBrain = createBotBrainState(p.id, 5000 + i * 97);
      p.dashCooldownTimer = 0;
      boar.aiState = 'telegraph';
      boar.stateTimer = 0.65;
      // Advance past 0.25s reaction delay (16 ticks = 0.266s)
      let dashedInTrial = false;
      for (let t = 1; t <= 17; t++) {
        const pkt = stepHonestPlayerBot(
          sim,
          p,
          trialBrain,
          AVERAGE_PLAYER_BOT_PROFILE,
          SIM_STEP_SEC,
          t,
        );
        if ((pkt.buttons & INPUT_BUTTON.DASH) !== 0) {
          dashedInTrial = true;
          break;
        }
      }
      if (dashedInTrial) {
        dashCount += 1;
      }
    }
    const observedRate = dashCount / trials;
    expect(observedRate).toBeGreaterThanOrEqual(0.55);
    expect(observedRate).toBeLessThanOrEqual(0.75);
  });

  it('applies aim dispersion matching aimAccuracy (~70% on-target, ~30% missed angle)', () => {
    const sim = new WorldSim({
      seed: 30303,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.selectCharacter(sim.player.id, 'ranger');
    const p = sim.player;
    p.x = 300;
    p.y = 300;

    const target = sim.spawnEnemy('goblin_shooter', 500, 300, true);
    target.hp = 9999;
    target.maxHp = 9999;

    const brain = createBotBrainState(p.id, 30303);
    let onTargetSamples = 0;
    const totalSamples = 240;

    for (let s = 1; s <= totalSamples; s++) {
      // Force aim re-sample each step
      brain.aimUpdateTimer = 0;
      const pkt = stepHonestPlayerBot(
        sim,
        p,
        brain,
        AVERAGE_PLAYER_BOT_PROFILE,
        SIM_STEP_SEC,
        s,
      );
      // True angle to target at (500, 300) from (300, 300) is 0 rad;
      // On-target error is within <= 0.09 rad, while missed shots have >= 0.22 rad dispersion
      if (Math.abs(pkt.aimAngle) <= 0.12) {
        onTargetSamples += 1;
      }
    }

    const onTargetRatio = onTargetSamples / totalSamples;
    expect(onTargetRatio).toBeGreaterThanOrEqual(0.62);
    expect(onTargetRatio).toBeLessThanOrEqual(0.78);
  });

  it('removes all fake multipliers (encounterScale, roomFactor, godMode = true) from balance-simulations.ts and balance-harness.ts', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const simSrc = fs.readFileSync(
      path.resolve(testDir, '../../../tools/balance-simulations.ts'),
      'utf8',
    );
    const harnessSrc = fs.readFileSync(
      path.resolve(testDir, '../../../tools/balance-harness.ts'),
      'utf8',
    );

    expect(simSrc).not.toContain('encounterScale');
    expect(simSrc).not.toContain('roomFactor');
    expect(simSrc).not.toMatch(/\.godMode\s*=\s*true/);
    expect(harnessSrc).not.toContain('1.5625');

    const roomSample = measureCombatRoomClearSec(1, 101, 1);
    expect(roomSample.clearSec).toBeGreaterThan(0);
    expect(roomSample.hpAndArmorLostPct).toBeGreaterThanOrEqual(0);
    expect(roomSample.hpAndArmorLostPct).toBeLessThanOrEqual(100);
    expect(roomSample.downedCount).toBeGreaterThanOrEqual(0);

    const bossSample = simulateBossEncounter(1, 'ranger', 101, undefined, 'spore_king');
    expect(bossSample.durationSec).toBeGreaterThan(0);
    expect(bossSample.maxSingleHitFraction).toBeGreaterThanOrEqual(0);

    const biomeRows = measureBiomeDifficultyProgression([101, 202]);
    expect(biomeRows.length).toBe(3);
    expect(biomeRows[0]!.difficultyIndex).toBe(1);

    const smokeReport = runBalanceHarness({ seedsPerConfig: 2 });
    expect(smokeReport.seedsUsed.length).toBe(2);
    expect(smokeReport.enemyTtkStats.p50).toBeGreaterThan(0);
    expect(smokeReport.combatRoomSecStats.p50).toBeGreaterThan(0);
    expect(smokeReport.bossBiomeRows.length).toBe(3);
    expect(formatMarkdownReport(smokeReport)).toContain('AVERAGE_PLAYER_BOT_PROFILE');
  });
});
