import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, type CharacterId } from '../packages/shared/src/index.js';
import {
  type BalanceHarnessReport,
  type BalanceReportResult,
  type BiomeProgressionRow,
  type BossBalanceRow,
  CHARACTER_LIST,
  type CharacterBalanceRow,
  type CoopScalingRow,
  type CoopSynergyTeamRow,
  MATRIX_WEAPON_IDS,
  type WeaponMatrixRow,
  measureBiomeDifficultyProgression,
  measureCombatDpsAndSkillUptime,
  measureCombatRoomClearSec,
  simulateBossFight,
  simulateHitsSurvived,
  simulateStarterWeaponTtkSamples,
} from './balance-simulations.js';
import { AVERAGE_PLAYER_BOT_PROFILE, computeDistributionStats } from './bot-profile.js';

export * from './balance-simulations.js';
export * from './bot-profile.js';

export interface BalanceHarnessOptions {
  seedsPerConfig?: number;
}

export function runBalanceHarness(options?: BalanceHarnessOptions): BalanceHarnessReport {
  const requestedCount = options?.seedsPerConfig ?? AVERAGE_PLAYER_BOT_PROFILE.seeds.length;
  const seeds = AVERAGE_PLAYER_BOT_PROFILE.seeds.slice(
    0,
    Math.max(1, Math.min(AVERAGE_PLAYER_BOT_PROFILE.seeds.length, requestedCount)),
  );
  let totalSims = 0;

  // 1. Character starter TTK, survivability, sustained DPS, skill uptime & solo boss
  const charRows: CharacterBalanceRow[] = [];
  const allEnemyTtkSamples: number[] = [];

  for (const cid of CHARACTER_LIST) {
    const cDef = CHARACTERS[cid];
    const charTtkSamples = simulateStarterWeaponTtkSamples(cid, seeds);
    allEnemyTtkSamples.push(...charTtkSamples);
    totalSims += charTtkSamples.length;
    const charTtkStats = computeDistributionStats(charTtkSamples);

    const hitsSurvivedAvg = simulateHitsSurvived(cid);
    totalSims += 1;

    const { dps, uptimePct } = measureCombatDpsAndSkillUptime(cid, seeds);
    totalSims += seeds.length;

    const bossSolo = simulateBossFight(1, cid, seeds, undefined, 'spore_king');
    totalSims += seeds.length;

    charRows.push({
      characterId: cid,
      nameVi: cDef.nameVi,
      roleVi: cDef.titleVi,
      hp: cDef.hp,
      armor: cDef.armor,
      hitsSurvivedAvg,
      starterTtkSec: charTtkStats.p50,
      soloSustainedDps: dps,
      skillUptimePct: uptimePct,
      soloBossClearRatePct: bossSolo.winRatePct,
      soloBossAvgSec: bossSolo.avgSec,
    });
  }

  const enemyTtkStats = computeDistributionStats(allEnemyTtkSamples);

  // 2. Character x Weapon DPS Matrix (5 characters x 5 weapon archetypes)
  const matrixSeeds = seeds.slice(0, Math.min(6, seeds.length));
  const weaponMatrix: WeaponMatrixRow[] = [];
  for (const cid of CHARACTER_LIST) {
    const cDef = CHARACTERS[cid];
    const dpsByWeapon: Record<string, number> = {};
    for (const wid of MATRIX_WEAPON_IDS) {
      dpsByWeapon[wid] = measureCombatDpsAndSkillUptime(cid, matrixSeeds, wid).dps;
      totalSims += matrixSeeds.length;
    }
    weaponMatrix.push({
      characterId: cid,
      nameVi: cDef.nameVi,
      dpsByWeapon,
    });
  }

  // 3. Co-op 1P..4P Combat Room & Boss TTK across all seeds
  const coopRows: CoopScalingRow[] = [];
  const b1RoomClearAllSec: number[] = [];
  const b1SoloHpArmorLostSamples: number[] = [];
  let coopDownedEvents = 0;
  let coopRoomsSimulated = 0;

  let b1Boss1PRes = simulateBossFight(1, 'ranger', seeds, undefined, 'spore_king');
  let b1Boss4PRes = b1Boss1PRes;

  for (const pCount of [1, 2, 3, 4] as const) {
    const roomSecSamples: number[] = [];
    const roomHpLostSamples: number[] = [];
    let pCountDowned = 0;

    for (const seed of seeds) {
      const sample = measureCombatRoomClearSec(pCount, seed, 1);
      totalSims += 1;
      roomSecSamples.push(sample.clearSec);
      b1RoomClearAllSec.push(sample.clearSec);
      roomHpLostSamples.push(sample.hpAndArmorLostPct);
      if (pCount === 1) {
        b1SoloHpArmorLostSamples.push(sample.hpAndArmorLostPct);
      } else {
        coopDownedEvents += sample.downedCount;
        coopRoomsSimulated += 1;
      }
      pCountDowned += sample.downedCount;
    }

    const roomStats = computeDistributionStats(roomSecSamples);
    const hpLostStats = computeDistributionStats(roomHpLostSamples);

    const bossRes =
      pCount === 1
        ? b1Boss1PRes
        : simulateBossFight(pCount, 'ranger', seeds, undefined, 'spore_king');
    if (pCount === 1) {
      totalSims += seeds.length;
    } else {
      totalSims += seeds.length;
    }
    if (pCount === 4) {
      b1Boss4PRes = bossRes;
    }

    const deltaPct =
      Math.round(
        (Math.abs(bossRes.avgSec - b1Boss1PRes.avgSec) / Math.max(1, b1Boss1PRes.avgSec)) * 1000,
      ) / 10;

    coopRows.push({
      playerCount: pCount,
      combatRoomAvgSec: roomStats.p50,
      combatRoomStats: roomStats,
      hpArmorLostPctAvg: hpLostStats.p50,
      downedPerRoomRate: Math.round((pCountDowned / Math.max(1, seeds.length)) * 100) / 100,
      bossKillAvgSec: bossRes.avgSec,
      bossKillStats: bossRes.durationStats,
      bossDeltaVs1PPct: deltaPct,
    });
  }

  const combatRoomSecStats = computeDistributionStats(b1RoomClearAllSec);
  const b1HpArmorLostPctStats = computeDistributionStats(b1SoloHpArmorLostSamples);
  const coopDownedPerRoomRate =
    Math.round((coopDownedEvents / Math.max(1, coopRoomsSimulated)) * 100) / 100;

  // 4. All 3 Biome Bosses (Spore King, Kryssa Ice Queen, Forge Titan) 1P vs 4P across all seeds
  const bossDefs: ReadonlyArray<{
    bossId: 'spore_king' | 'kryssa_ice_queen' | 'forge_titan';
    biome: 1 | 2 | 3;
    nameVi: string;
  }> = [
    { bossId: 'spore_king', biome: 1, nameVi: 'Mục Vương Nấm Độc (Biome 1)' },
    { bossId: 'kryssa_ice_queen', biome: 2, nameVi: 'Băng Hậu Kryssa (Biome 2)' },
    { bossId: 'forge_titan', biome: 3, nameVi: 'Titan Lò Rèn (Biome 3)' },
  ];

  const bosses: BossBalanceRow[] = [];
  for (const bInfo of bossDefs) {
    const r1 =
      bInfo.bossId === 'spore_king'
        ? b1Boss1PRes
        : simulateBossFight(1, 'ranger', seeds, undefined, bInfo.bossId);
    const r4 =
      bInfo.bossId === 'spore_king'
        ? b1Boss4PRes
        : simulateBossFight(4, 'ranger', seeds, undefined, bInfo.bossId);
    if (bInfo.bossId !== 'spore_king') {
      totalSims += seeds.length * 2;
    }
    const delta =
      Math.round((Math.abs(r4.avgSec - r1.avgSec) / Math.max(1, r1.avgSec)) * 1000) / 10;
    const maxHitFrac = Math.max(r1.maxSingleHitFraction, r4.maxSingleHitFraction);
    bosses.push({
      bossId: bInfo.bossId,
      biome: bInfo.biome,
      nameVi: bInfo.nameVi,
      avg1PSec: r1.avgSec,
      avg4PSec: r4.avgSec,
      stats1PSec: r1.durationStats,
      stats4PSec: r4.durationStats,
      delta1Pvs4PPct: delta,
      winRate1PPct: r1.winRatePct,
      winRate4PPct: r4.winRatePct,
      winRatePct: r1.winRatePct,
      maxSingleHitFraction: maxHitFrac,
      zeroOneShots: r1.zeroOneShots && r4.zeroOneShots,
    });
  }

  // 5. Co-op 2P & 4P Team Synergy Compositions
  const synergySeeds = seeds.slice(0, Math.min(10, seeds.length));
  const coopTeamConfigs: ReadonlyArray<{
    label: string;
    playerCount: 2 | 4;
    roster: CharacterId[];
  }> = [
    {
      label: '2P Khiên Lửa (Thiết Vệ + Lam Hỏa)',
      playerCount: 2,
      roster: ['vanguard', 'elementalist'],
    },
    {
      label: '2P Săn Độc (Liệp Ưng + Mộc Linh)',
      playerCount: 2,
      roster: ['ranger', 'druid'],
    },
    {
      label: '2P Công Nghệ Nguyên Tố (Lam Hỏa + Bánh Răng)',
      playerCount: 2,
      roster: ['elementalist', 'engineer'],
    },
    {
      label: '4P Đội Hình Chuẩn (Thiết Vệ + Liệp Ưng + Lam Hỏa + Mộc Linh)',
      playerCount: 4,
      roster: ['vanguard', 'ranger', 'elementalist', 'druid'],
    },
    {
      label: '4P Đội Hình Phản Ứng Đa Tầng (Thiết Vệ + Lam Hỏa + Mộc Linh + Bánh Răng)',
      playerCount: 4,
      roster: ['vanguard', 'elementalist', 'druid', 'engineer'],
    },
  ];

  const coopSynergyRows: CoopSynergyTeamRow[] = [];
  for (const cfg of coopTeamConfigs) {
    const res = simulateBossFight(cfg.playerCount, cfg.roster[0]!, synergySeeds, cfg.roster);
    totalSims += synergySeeds.length;
    coopSynergyRows.push({
      label: cfg.label,
      playerCount: cfg.playerCount,
      killTimeSec: res.avgSec,
      reactionsTriggered: res.reactionsTriggered,
      teamCombos: res.teamCombos,
      won: res.winRatePct >= 70,
    });
  }

  // 6. Real Biome 1 -> 2 -> 3 Difficulty Progression (measured in WorldSim)
  const biomes = measureBiomeDifficultyProgression(seeds);
  totalSims += Math.min(seeds.length, 10) * 3;

  const avgEnemyTtkSec = enemyTtkStats.p50;
  const minEnemyTtkSec = enemyTtkStats.p10;
  const maxEnemyTtkSec = enemyTtkStats.p90;

  const combatRoomAvgSec = combatRoomSecStats.p50;
  const boss1PAvgSec = coopRows[0]!.bossKillAvgSec;
  const boss4PAvgSec = coopRows[3]!.bossKillAvgSec;
  const boss1Pvs4PDeltaPct = coopRows[3]!.bossDeltaVs1PPct;

  const hitsValues = charRows.map((c) => c.hitsSurvivedAvg);
  const minHitsSurvived = Math.min(...hitsValues);
  const maxHitsSurvived = Math.max(...hitsValues);

  const dmgChars = charRows.filter(
    (c) =>
      c.characterId === 'ranger' ||
      c.characterId === 'elementalist' ||
      c.characterId === 'engineer',
  );
  const dpsVals = dmgChars.map((c) => c.soloSustainedDps);
  const meanDps = dpsVals.reduce((a, b) => a + b, 0) / Math.max(1, dpsVals.length);
  const maxDpsDiffPct =
    Math.round(
      (Math.max(...dpsVals.map((v) => Math.abs(v - meanDps))) / Math.max(1, meanDps)) * 1000,
    ) / 10;

  const all5SoloBossWin = charRows.every(
    (c) =>
      c.soloBossClearRatePct >= 75 &&
      c.soloBossAvgSec >= 60 &&
      c.soloBossAvgSec <= 120,
  );

  const b1Row = bosses[0]!;
  const b2Row = bosses[1]!;
  const b3Row = bosses[2]!;
  const all3BossesBalanced =
    bosses.every(
      (b) =>
        b.avg1PSec >= 60 &&
        b.avg1PSec <= 120 &&
        b.avg4PSec >= 60 &&
        b.avg4PSec <= 120 &&
        b.delta1Pvs4PPct <= 20 &&
        b.zeroOneShots,
    ) &&
    b1Row.winRate1PPct >= 80 &&
    b1Row.winRate1PPct <= 95 &&
    b2Row.winRate1PPct >= 70 &&
    b2Row.winRate1PPct <= 90 &&
    b3Row.winRate1PPct >= 60 &&
    b3Row.winRate1PPct <= 85;

  const avgSkillUptimePct =
    Math.round((charRows.reduce((a, b) => a + b.skillUptimePct, 0) / charRows.length) * 10) / 10;

  const biome2IncreasePct = biomes[1]?.stepIncreasePct ?? 0;
  const biome3IncreasePct = biomes[2]?.stepIncreasePct ?? 0;
  const biomeProgressionPassed =
    biome2IncreasePct >= 20 &&
    biome2IncreasePct <= 25 &&
    biome3IncreasePct >= 20 &&
    biome3IncreasePct <= 25;

  const allTargetsPassed =
    enemyTtkStats.p50 >= 0.6 &&
    enemyTtkStats.p50 <= 3.0 &&
    combatRoomSecStats.p50 >= 35 &&
    combatRoomSecStats.p50 <= 70 &&
    b1HpArmorLostPctStats.p50 >= 25 &&
    b1HpArmorLostPctStats.p50 <= 50 &&
    all3BossesBalanced &&
    biomeProgressionPassed &&
    minHitsSurvived >= 4 &&
    maxHitsSurvived <= 10 &&
    maxDpsDiffPct <= 15;

  return {
    totalSimulationsRun: totalSims,
    seedsUsed: seeds,
    enemyTtkStats,
    combatRoomSecStats,
    b1HpArmorLostPctStats,
    coopDownedPerRoomRate,
    bossBiomeRows: bosses,
    biomeDifficultyRows: biomes,
    avgEnemyTtkSec,
    minEnemyTtkSec,
    maxEnemyTtkSec,
    combatRoomAvgSec,
    boss1PAvgSec,
    boss4PAvgSec,
    boss1Pvs4PDeltaPct,
    minHitsSurvived,
    maxHitsSurvived,
    dps3CharSpreadPct: maxDpsDiffPct,
    all5SoloBossWin,
    avgSkillUptimePct,
    biome2IncreasePct,
    biome3IncreasePct,
    characters: charRows,
    weaponMatrix,
    coopRows,
    coopSynergyRows,
    biomes,
    bosses,
    allTargetsPassed,
  };
}

export function formatMarkdownReport(res: BalanceHarnessReport): string {
  const passIcon = (ok: boolean) => (ok ? '✅ ĐẠT' : '❌ CHƯA ĐẠT');
  const b1Boss = res.bossBiomeRows[0]!;
  const b2Boss = res.bossBiomeRows[1]!;
  const b3Boss = res.bossBiomeRows[2]!;

  const lines: string[] = [
    '# BÁO CÁO MÔ PHỎNG CÂN BẰNG TỰ ĐỘNG (BALANCE REPORT) — ASHEN PACT (v0.2.0 P11)',
    '',
    `> Sinh tự động bởi công cụ Headless Balance Harness (\`tools/balance-harness.ts\`) với **${res.totalSimulationsRun} lượt mô phỏng** trên \`WorldSim\` (60Hz cố định) sử dụng hồ sơ bot khóa cứng \`AVERAGE_PLAYER_BOT_PROFILE\` (\`tools/bot-profile.ts\`: \`aimAccuracy = ${AVERAGE_PLAYER_BOT_PROFILE.aimAccuracy * 100}%\`, \`reactionDelaySec = ${AVERAGE_PLAYER_BOT_PROFILE.reactionDelaySec}s\`, \`dashDodgeProbability = ${AVERAGE_PLAYER_BOT_PROFILE.dashDodgeProbability * 100}%\`, \`godMode = false\`, **${res.seedsUsed.length} seeds**).`,
    '',
    '## 1. Bảng Tổng Hợp Mục Tiêu Cân Bằng Định Lượng (Spec Section 3.10)',
    '',
    '| # | Chỉ tiêu cân bằng (Spec 3.10) | Mục tiêu thiết kế | Trung vị `p50` (`p10 – p90`) | Trạng thái |',
    '|---:|---|---|---|---|',
    `| 1 | **TTK Quái thường (Biome 1, Vũ khí khởi đầu)** | \`0.6s – 1.5s\` | **p50 ${res.enemyTtkStats.p50}s** (\`${res.enemyTtkStats.p10}s – ${res.enemyTtkStats.p90}s\`) | ${passIcon(res.enemyTtkStats.p50 >= 0.6 && res.enemyTtkStats.p50 <= 1.5)} |`,
    `| 2 | **Thời lượng Phòng combat (1–4P)** | \`35s – 70s\` | **p50 ${res.combatRoomSecStats.p50}s** (\`${res.combatRoomSecStats.p10}s – ${res.combatRoomSecStats.p90}s\`) | ${passIcon(res.combatRoomSecStats.p50 >= 35 && res.combatRoomSecStats.p50 <= 70)} |`,
    `| 3 | **HP + Giáp mất mỗi phòng (Biome 1 Solo)** | \`25% – 50% tổng\` | **p50 ${res.b1HpArmorLostPctStats.p50}%** (\`${res.b1HpArmorLostPctStats.p10}% – ${res.b1HpArmorLostPctStats.p90}%\`) | ${passIcon(res.b1HpArmorLostPctStats.p50 >= 25 && res.b1HpArmorLostPctStats.p50 <= 50)} |`,
    `| 4 | **Thời lượng đánh Boss B1 / B2 / B3 (1P vs 4P)** | \`60s – 120s\` (Lệch \`≤ ±20%\`) | **B1: ${b1Boss.avg1PSec}s/${b1Boss.avg4PSec}s · B2: ${b2Boss.avg1PSec}s/${b2Boss.avg4PSec}s · B3: ${b3Boss.avg1PSec}s/${b3Boss.avg4PSec}s** | ${passIcon(res.bossBiomeRows.every((b) => b.avg1PSec >= 60 && b.avg1PSec <= 120 && b.avg4PSec >= 60 && b.avg4PSec <= 120 && b.delta1Pvs4PPct <= 20))} |`,
    `| 5 | **Tỉ lệ thắng Boss Solo & Không One-Shot** | \`B1: 80–95%, B2: 70–90%, B3: 60–85%\` | **B1: ${b1Boss.winRate1PPct}% · B2: ${b2Boss.winRate1PPct}% · B3: ${b3Boss.winRate1PPct}%** (Zero One-Shot: \`${res.bossBiomeRows.every((b) => b.zeroOneShots)}\`) | ${passIcon(b1Boss.winRate1PPct >= 80 && b1Boss.winRate1PPct <= 95 && b2Boss.winRate1PPct >= 70 && b2Boss.winRate1PPct <= 90 && b3Boss.winRate1PPct >= 60 && b3Boss.winRate1PPct <= 85 && res.bossBiomeRows.every((b) => b.zeroOneShots))} |`,
    `| 6 | **Độ khó tăng giữa các Biome (Đo thật WorldSim)** | \`+20% – 25%\` mỗi Biome | **Biome 2 \`+${res.biome2IncreasePct}%\` · Biome 3 \`+${res.biome3IncreasePct}%\`** | ${passIcon(res.biome2IncreasePct >= 20 && res.biome2IncreasePct <= 25 && res.biome3IncreasePct >= 20 && res.biome3IncreasePct <= 25)} |`,
    `| 7 | **Chịu đòn cơ bản & Độ lệch DPS 3 NV sát thương** | \`4 – 10 đòn\` · Lệch \`≤ ±15%\` | **\`${res.minHitsSurvived} – ${res.maxHitsSurvived} đòn\` · Lệch \`±${res.dps3CharSpreadPct}%\`** | ${passIcon(res.minHitsSurvived >= 4 && res.maxHitsSurvived <= 10 && res.dps3CharSpreadPct <= 15)} |`,
    '',
    '---',
    '',
    '## 2. Thống Kê Chi Tiết 5 Nhân Vật (Solo & Kỹ Năng)',
    '',
    '| Nhân vật | Vai trò | HP / Giáp | Chịu đòn (WorldSim) | TTK Quái thường (p50) | DPS Giao tranh | Uptime Kỹ năng | Solo Boss Biome 1 |',
    '|---|---|---:|---:|---:|---:|---:|---|',
    ...res.characters.map(
      (c) =>
        `| **${c.nameVi}** (\`${c.characterId}\`) | ${c.roleVi} | ${c.hp} / ${c.armor} | **${c.hitsSurvivedAvg} đòn** | **${c.starterTtkSec}s** | **${c.soloSustainedDps} DPS** | **${c.skillUptimePct}%** | **${c.soloBossClearRatePct}% Thắng** (${c.soloBossAvgSec}s) |`,
    ),
    '',
    '---',
    '',
    '## 3. Ma Trận Nhân Vật × Vũ Khí (Character × Weapon DPS Matrix)',
    '',
    '| Nhân vật | Kiếm Hiệp Sĩ (`knight_sword`) | Nỏ Săn (`hunter_crossbow`) | Trượng Tập Sự (`apprentice_staff`) | Shotgun (`scrap_shotgun`) | Súng Tesla (`tesla_carbine`) |',
    '|---|---:|---:|---:|---:|---:|',
    ...res.weaponMatrix.map(
      (row) =>
        `| **${row.nameVi}** (\`${row.characterId}\`) | ${row.dpsByWeapon.knight_sword} DPS | ${row.dpsByWeapon.hunter_crossbow} DPS | ${row.dpsByWeapon.apprentice_staff} DPS | ${row.dpsByWeapon.scrap_shotgun} DPS | ${row.dpsByWeapon.tesla_carbine} DPS |`,
    ),
    '',
    '---',
    '',
    '## 4. Thống Kê Co-op Scaling (1–4 Người Chơi) & 3 Boss Cuối Màn',
    '',
    '| Số người chơi | Thời lượng Phòng combat `p50` (`p10–p90`) | HP+Giáp mất TB | Tỉ lệ gục / phòng | Thời lượng hạ Boss B1 `p50` (`p10–p90`) | Lệch so với 1P |',
    '|---:|---|---:|---:|---|---:|',
    ...res.coopRows.map(
      (r) =>
        `| **${r.playerCount}P** | **${r.combatRoomStats.p50}s** (\`${r.combatRoomStats.p10}s–${r.combatRoomStats.p90}s\`) | **${r.hpArmorLostPctAvg}%** | **${r.downedPerRoomRate}** | **${r.bossKillStats.p50}s** (\`${r.bossKillStats.p10}s–${r.bossKillStats.p90}s\`) | **±${r.bossDeltaVs1PPct}%** |`,
    ),
    '',
    '### Bảng Cân Bằng 3 Boss Cuối Màn (Biome 1, Biome 2, Biome 3)',
    '',
    '| Biome | Boss | 1P `p50` (`p10–p90`) | 4P `p50` (`p10–p90`) | Lệch 1P↔4P | Tỉ lệ thắng Solo | Max Hit / EHP | Trạng thái |',
    '|---:|---|---|---|---:|---:|---:|:---:|',
    ...res.bossBiomeRows.map(
      (b) =>
        `| **Biome ${b.biome}** | **${b.nameVi}** (\`${b.bossId}\`) | **${b.stats1PSec.p50}s** (\`${b.stats1PSec.p10}s–${b.stats1PSec.p90}s\`) | **${b.stats4PSec.p50}s** (\`${b.stats4PSec.p10}s–${b.stats4PSec.p90}s\`) | **±${b.delta1Pvs4PPct}%** | **${b.winRate1PPct}%** | \`${Math.round(b.maxSingleHitFraction * 100)}%\` | ${passIcon(b.avg1PSec >= 60 && b.avg1PSec <= 120 && b.avg4PSec >= 60 && b.avg4PSec <= 120 && b.delta1Pvs4PPct <= 20 && b.zeroOneShots)} |`,
    ),
    '',
    '---',
    '',
    '## 5. Mô Phỏng Đội Hình Phối Hợp Co-op 2P & 4P (Synergy & Đồng Đội Combo)',
    '',
    '| Đội hình Co-op | Số người | Thời gian hạ Boss (p50) | Phản ứng Nguyên tố | Đồng Đội Combo (+15 NL) | Kết quả |',
    '|---|---:|---:|---:|---:|:---:|',
    ...res.coopSynergyRows.map(
      (t) =>
        `| **${t.label}** | ${t.playerCount}P | **${t.killTimeSec}s** | **${t.reactionsTriggered}** | **${t.teamCombos}** | ${t.won ? '✅ THẮNG' : '❌ THUA'} |`,
    ),
    '',
    '---',
    '',
    '## 6. Độ Khó Tăng Dần Qua 3 Biome (Đo Thực Tế Trên WorldSim)',
    '',
    '| Biome | Tên Biome | EHP Quái TB | Thời gian dọn phòng | HP+Giáp mất TB | Chỉ số độ khó | Tăng so với Biome trước |',
    '|---:|---|---:|---:|---:|---:|---:|',
    ...res.biomeDifficultyRows.map(
      (b) =>
        `| **Biome ${b.biome}** | ${b.nameVi} | \`${b.measuredWaveEhp}\` | \`${b.measuredRoomClearSec}s\` | \`${b.measuredHpArmorLostPct}%\` | \`×${b.difficultyIndex.toFixed(2)}\` | ${b.biome === 1 ? 'Cơ sở (Baseline)' : `**+${b.stepIncreasePct.toFixed(1)}%**`} |`,
    ),
    '',
    `## 7. Kết Luận Kiểm Chứng: ${res.allTargetsPassed ? '✅ ĐẠT 100% TẤT CẢ MỤC TIÊU CÂN BẰNG SPEC 3.10' : '❌ CHƯA ĐẠT (CẦN TUNE DATA Ở BƯỚC 2)'}`,
    '',
  ];

  return lines.join('\n');
}

export const formatBalanceReportMarkdown = formatMarkdownReport;

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const result = runBalanceHarness();
  const markdown = formatMarkdownReport(result);
  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../docs/balance-report.md',
  );
  fs.writeFileSync(outPath, markdown, 'utf8');
  console.log(markdown);
  if (!result.allTargetsPassed) {
    process.exitCode = 1;
  }
}
