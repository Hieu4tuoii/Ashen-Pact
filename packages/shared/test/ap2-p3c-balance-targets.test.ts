import { beforeAll, describe, expect, it } from 'vitest';
import {
  type BalanceHarnessReport,
  STARTER_WEAPON_IDS,
  runBalanceHarness,
} from '../../../tools/balance-harness.js';
import { AVERAGE_PLAYER_BOT_PROFILE } from '../../../tools/bot-profile.js';
import { ALL_WEAPON_IDS } from '../src/index.js';

describe('AP2 Phase P3C.3 — Quantitative Balance Targets (18 Weapons, 5 Classes, 3 Bosses, Spec 3.10)', () => {
  let report: BalanceHarnessReport;

  beforeAll(() => {
    expect(AVERAGE_PLAYER_BOT_PROFILE.godMode).toBe(false);
    expect(AVERAGE_PLAYER_BOT_PROFILE.seeds.length).toBe(30);
    report = runBalanceHarness();
  }, 300_000);

  it('(1) keeps DPS spread across the 5 starter weapons < 5.0% and ensures all 18 weapons gain DPS with Active [R] / Finisher', () => {
    expect(report.weaponCadenceRows.length).toBe(ALL_WEAPON_IDS.length);
    expect(report.weaponCadenceRows.length).toBe(18);

    const starterRows = report.weaponCadenceRows.filter((r) => r.isStarter);
    expect(starterRows.map((r) => r.weaponId).sort()).toEqual([...STARTER_WEAPON_IDS].sort());

    for (const row of report.weaponCadenceRows) {
      expect(row.normalDps).toBeGreaterThan(0);
      expect(row.activeDps).toBeGreaterThan(row.normalDps);
      expect(row.activeGainPct).toBeGreaterThan(0);
    }

    expect(report.starterWeaponDpsSpreadPct).toBeLessThan(5.0);
  });

  it('(2) keeps winrate spread across all 5 classes <= 6.0% over 1P, 2P, and 4P (30 seeds per mode)', () => {
    expect(report.classCoopRows.length).toBe(5);
    for (const cRow of report.classCoopRows) {
      expect(cRow.runsPerMode).toBe(30);
      expect(cRow.totalRuns).toBe(90);
      expect(cRow.overallWinRatePct).toBeGreaterThan(0);
    }
    expect(report.classWinRateSpreadPct).toBeLessThanOrEqual(6.0);
  });

  it('(3) enforces 60-120s kill times (1P vs 4P delta <= 20%), target Solo winrates (B1 80-95%, B2 70-90%, B3 60-85%), and zero one-shots across all 3 Bosses', () => {
    expect(report.bossBiomeRows.length).toBe(3);

    const b1 = report.bossBiomeRows.find((b) => b.bossId === 'spore_king')!;
    const b2 = report.bossBiomeRows.find((b) => b.bossId === 'kryssa_ice_queen')!;
    const b3 = report.bossBiomeRows.find((b) => b.bossId === 'forge_titan')!;
    expect(b1).toBeDefined();
    expect(b2).toBeDefined();
    expect(b3).toBeDefined();

    for (const boss of [b1, b2, b3]) {
      expect(boss.avg1PSec).toBeGreaterThanOrEqual(60.0);
      expect(boss.avg1PSec).toBeLessThanOrEqual(120.0);
      expect(boss.avg4PSec).toBeGreaterThanOrEqual(60.0);
      expect(boss.avg4PSec).toBeLessThanOrEqual(120.0);
      expect(boss.delta1Pvs4PPct).toBeLessThanOrEqual(20.0);
      expect(boss.zeroOneShots).toBe(true);
      expect(boss.maxSingleHitFraction).toBeLessThan(0.85);
    }

    expect(b1.winRate1PPct).toBeGreaterThanOrEqual(80.0);
    expect(b1.winRate1PPct).toBeLessThanOrEqual(95.0);

    expect(b2.winRate1PPct).toBeGreaterThanOrEqual(70.0);
    expect(b2.winRate1PPct).toBeLessThanOrEqual(90.0);

    expect(b3.winRate1PPct).toBeGreaterThanOrEqual(60.0);
    expect(b3.winRate1PPct).toBeLessThanOrEqual(85.0);
  });

  it('(4) satisfies all Spec 3.10 & Phase P3C quantitative targets with allTargetsPassed === true', () => {
    expect(report.seedsUsed.length).toBe(30);

    // 1. Starter weapon enemy TTK: 0.6s - 1.5s
    expect(report.enemyTtkStats.p50).toBeGreaterThanOrEqual(0.6);
    expect(report.enemyTtkStats.p50).toBeLessThanOrEqual(1.5);

    // 2. Combat room clear duration (1-4P): 35s - 70s
    expect(report.combatRoomSecStats.p50).toBeGreaterThanOrEqual(35.0);
    expect(report.combatRoomSecStats.p50).toBeLessThanOrEqual(70.0);

    // 3. Biome 1 Solo HP + Armor lost per combat room: 25% - 50%
    expect(report.b1HpArmorLostPctStats.p50).toBeGreaterThanOrEqual(25.0);
    expect(report.b1HpArmorLostPctStats.p50).toBeLessThanOrEqual(50.0);

    // 6. Biome difficulty progression: +20% - +25% per biome
    expect(report.biome2IncreasePct).toBeGreaterThanOrEqual(20.0);
    expect(report.biome2IncreasePct).toBeLessThanOrEqual(25.0);
    expect(report.biome3IncreasePct).toBeGreaterThanOrEqual(20.0);
    expect(report.biome3IncreasePct).toBeLessThanOrEqual(25.0);

    // 7. Survivability (4 - 10 hits) & 3 DPS-character spread (<= 15%) & all 5 solo boss clear
    expect(report.minHitsSurvived).toBeGreaterThanOrEqual(4);
    expect(report.maxHitsSurvived).toBeLessThanOrEqual(10);
    expect(report.dps3CharSpreadPct).toBeLessThanOrEqual(15.0);
    expect(report.all5SoloBossWin).toBe(true);

    // Master gate flag
    expect(report.allTargetsPassed).toBe(true);
  });
});
