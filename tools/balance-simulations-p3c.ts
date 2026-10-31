import {
  ALL_WEAPON_IDS, type AshenRelicId, BOSS_SINGLE_HIT_MAX_MULT, type BlessingId,
  CHARACTERS, type CharacterId, type DuoBoonId, type ElementType, INPUT_BUTTON,
  SIM_STEP_SEC, WEAPONS, type WeaponCadenceKind, type WeaponMutatorId,
  type WeaponRarity, WorldSim, equipPlayerWeaponSlot, isMutatorCompatibleWithWeapon,
} from '../packages/shared/src/index.js';
import { CHARACTER_LIST, simulateBossFight } from './balance-simulations.js';
import {
  AVERAGE_PLAYER_BOT_PROFILE, computeDistributionStats, createBotBrainState,
  type DistributionStats, stepHonestPlayerBot,
} from './bot-profile.js';

export interface WeaponCadenceBalanceRow {
  weaponId: string;
  nameVi: string;
  rarity: WeaponRarity;
  cadenceKind: WeaponCadenceKind;
  isStarter: boolean;
  normalDps: number;
  activeDps: number;
  activeGainPct: number;
  targetNormalDps: number;
  targetActiveDps: number;
}

export interface ClassCoopRunRow {
  characterId: CharacterId;
  nameVi: string;
  roleVi: string;
  runsPerMode: number;
  totalRuns: number;
  winRate1PPct: number;
  winRate2PPct: number;
  winRate4PPct: number;
  overallWinRatePct: number;
  avgClearSec1P: number;
  avgClearSec2P: number;
  avgClearSec4P: number;
  stats1PSec: DistributionStats;
  stats2PSec: DistributionStats;
  stats4PSec: DistributionStats;
}

export const STARTER_WEAPON_IDS = [
  'knight_sword',
  'hunter_crossbow',
  'apprentice_staff',
  'thorn_staff',
  'rivet_gun',
] as const;

export const P3C_ORDERED_WEAPON_IDS = [
  // 5 Common Starters
  'knight_sword',
  'hunter_crossbow',
  'apprentice_staff',
  'thorn_staff',
  'rivet_gun',
  // 3 Uncommon
  'scrap_shotgun',
  'gale_smg',
  'frag_launcher',
  // 4 Rare
  'tesla_carbine',
  'seed_gun',
  'tether_staff',
  'focus_laser',
  // 3 Epic
  'emerald_cleaver',
  'void_staff',
  'berserker_axe',
  // 3 Legendary
  'solar_archon_staff',
  'magma_cannon',
  'thunder_hammer',
] as const;

export const WEAPON_TARGET_DPS_SPEC_3_3: Record<
  string,
  { readonly targetNormalDps: number; readonly targetActiveDps: number }
> = {
  knight_sword: { targetNormalDps: 31, targetActiveDps: 41 },
  hunter_crossbow: { targetNormalDps: 30, targetActiveDps: 41 },
  apprentice_staff: { targetNormalDps: 30, targetActiveDps: 40 },
  thorn_staff: { targetNormalDps: 29, targetActiveDps: 40 },
  rivet_gun: { targetNormalDps: 31, targetActiveDps: 41 },
  scrap_shotgun: { targetNormalDps: 41, targetActiveDps: 53 },
  gale_smg: { targetNormalDps: 40, targetActiveDps: 52 },
  frag_launcher: { targetNormalDps: 42, targetActiveDps: 54 },
  tesla_carbine: { targetNormalDps: 51, targetActiveDps: 68 },
  seed_gun: { targetNormalDps: 48, targetActiveDps: 64 },
  tether_staff: { targetNormalDps: 49, targetActiveDps: 66 },
  focus_laser: { targetNormalDps: 52, targetActiveDps: 68 },
  emerald_cleaver: { targetNormalDps: 64, targetActiveDps: 84 },
  void_staff: { targetNormalDps: 65, targetActiveDps: 83 },
  berserker_axe: { targetNormalDps: 68, targetActiveDps: 88 },
  solar_archon_staff: { targetNormalDps: 82, targetActiveDps: 108 },
  magma_cannon: { targetNormalDps: 79, targetActiveDps: 104 },
  thunder_hammer: { targetNormalDps: 81, targetActiveDps: 106 },
};

/**
 * Simulates a single weapon's sustained DPS in WorldSim (`godMode: false`) under either:
 * - `activeMode = false` (Normal DPS: continuous firing without [R] Perfect Reload / Tactical Vent,
 *   basic 1-2 melee swings without 3rd-hit Finisher / Parry Deflect, no early Airburst / Implosion release)
 * - `activeMode = true` (Active [R] / Finisher DPS: hitting [R] Perfect Reload in the 45%-70% Golden Window,
 *   hitting [R] Tactical Vent in the 65%-95% Orange Heat Zone, full 3-hit Melee Combo Finisher + Parry Deflect,
 *   and Hold-and-Release Airburst / Implosion).
 */
export function simulateSingleWeaponCadenceDps(
  weaponId: string,
  activeMode: boolean,
  seeds: readonly number[] = AVERAGE_PLAYER_BOT_PROFILE.seeds.slice(0, 4),
): number {
  const w = WEAPONS[weaponId];
  if (!w) return 0;

  const sampleSeeds = seeds.length > 0 ? seeds.slice(0, Math.min(4, seeds.length)) : [101];
  const durationSec = 18;
  const totalTicks = durationSec * 60;
  let totalDamageDealt = 0;

  for (const seed of sampleSeeds) {
    const sim = new WorldSim({
      seed,
      autoRevivePlayer: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.selectCharacter(sim.player.id, 'vanguard');
    const p = sim.player;
    p.godMode = false;
    p.activeImbueElement = 'none';
    equipPlayerWeaponSlot(p, 0, weaponId);
    equipPlayerWeaponSlot(p, 1, weaponId);
    p.activeWeaponSlot = 0;

    const isMelee = w.category === 'melee';
    const targetX = weaponId === 'tesla_carbine' ? sim.map.width - 104 : 520;
    const targetY = 320;
    const dist = isMelee
      ? Math.min(42, (w.range ?? 56) - 10)
      : weaponId === 'scrap_shotgun'
        ? activeMode
          ? 76
          : 108
        : weaponId === 'gale_smg'
          ? activeMode
            ? 84
            : 145
          : weaponId === 'void_staff' || weaponId === 'frag_launcher'
            ? 145
            : weaponId === 'solar_archon_staff'
              ? 185
              : 135;

    const target = sim.spawnEnemy('spore_king', targetX, targetY, true);
    target.hp = 999999;
    target.maxHp = 999999;
    target.isDummy = true;

    const subTarget =
      weaponId === 'tesla_carbine' || weaponId === 'tether_staff'
        ? sim.spawnEnemy('wild_boar', targetX, targetY + 52, true)
        : null;
    if (subTarget) {
      subTarget.hp = 999999;
      subTarget.maxHp = 999999;
      subTarget.isDummy = true;
    }

    let releaseHoldCooldown = 0;
    let comboParrySpawned = false;
    let comboCycleCount = 0;

    for (let t = 0; t < totalTicks; t++) {
      p.godMode = false;
      const effectiveDist =
        weaponId === 'berserker_axe' && activeMode && p.meleeComboStep === 2
          ? 122
          : dist;
      p.x = targetX - effectiveDist;
      p.y = targetY;
      p.aimAngle = 0;
      p.aimWorldX = targetX;
      p.aimWorldY = targetY;

      target.x = targetX;
      target.y = targetY;
      target.vx = 0;
      target.vy = 0;
      target.kbVx = 0;
      target.kbVy = 0;
      target.bossBurrowed = false;
      target.aiState = 'idle';
      target.stateTimer = 99;
      target.attackCooldownTimer = 99;
      // Prevent cross-shot elemental reaction cascades on the stationary DPS dummy
      target.burnTimer = 0;
      target.chillTimer = 0;
      target.chillStacks = 0;
      target.frozenTimer = 0;
      target.shockTimer = 0;
      target.poisonTimer = 0;
      target.poisonStacks = 0;
      target.lastElementApplied = 'none';

      if (subTarget) {
        subTarget.x = targetX;
        subTarget.y = targetY + 52;
        subTarget.vx = 0;
        subTarget.vy = 0;
        subTarget.kbVx = 0;
        subTarget.kbVy = 0;
        subTarget.aiState = 'idle';
        subTarget.stateTimer = 99;
        subTarget.attackCooldownTimer = 99;
        subTarget.burnTimer = 0;
        subTarget.chillTimer = 0;
        subTarget.shockTimer = 0;
        subTarget.poisonTimer = 0;
      }

      if (weaponId === 'magma_cannon' && sim.magmaTrails.length > 1) {
        const nearSeg = sim.magmaTrails.find(
          (seg) => Math.abs((seg.x1 + seg.x2) * 0.5 - targetX) <= 36,
        );
        if (nearSeg) {
          sim.magmaTrails.length = 0;
          sim.magmaTrails.push(nearSeg);
        }
      }

      let buttons = INPUT_BUTTON.FIRE;

      if (!activeMode) {
        // Normal mode: no [R] reload/vent, tap-fire crossbow, basic melee strikes without Finisher/Parry
        if (weaponId === 'hunter_crossbow' && p.fireCooldownTimer > SIM_STEP_SEC * 1.5) {
          buttons = 0;
        }
        if (isMelee && p.meleeComboStep === 2 && weaponId !== 'thunder_hammer') {
          p.meleeComboStep = 0;
        }
      } else {
        // Active [R] / Combo mode
        if (w.cadenceKind === 'CLIP_RELOAD') {
          const progress =
            p.reloadTimer > 0 && p.reloadDuration > 0
              ? 1 - p.reloadTimer / p.reloadDuration
              : 0;
          if (
            !p.reloadLockout &&
            progress >= 0.46 &&
            progress <= 0.66 &&
            ((p.lastButtons ?? 0) & INPUT_BUTTON.RELOAD_VENT) === 0
          ) {
            buttons |= INPUT_BUTTON.RELOAD_VENT;
          }
        } else if (w.cadenceKind === 'HEAT_VENT') {
          const ventThreshold = weaponId === 'apprentice_staff' ? 84 : 82;
          if (
            p.overheatLockTimer <= 0 &&
            p.weaponHeat >= ventThreshold &&
            p.weaponHeat <= 95 &&
            ((p.lastButtons ?? 0) & INPUT_BUTTON.RELOAD_VENT) === 0
          ) {
            buttons |= INPUT_BUTTON.RELOAD_VENT;
          }
        } else if (w.cadenceKind === 'MELEE_COMBO') {
          if (p.meleeComboStep !== 2) {
            comboParrySpawned = false;
          } else if (!comboParrySpawned && p.fireCooldownTimer <= SIM_STEP_SEC * 1.2) {
            comboParrySpawned = true;
            comboCycleCount += 1;
            if (comboCycleCount % 3 === 1) {
              // Spawn 1 grazing enemy projectile in the melee parry arc for Parry Deflect
              sim.spawnDeterministicVolley({
                kind: 'bullet_volley_spawned',
                tick: sim.tick,
                ownerId: target.id,
                team: 'enemy',
                weaponId: 'goblin_bow',
                x: p.x + 28,
                y: p.y + 18,
                angle: -Math.PI * 0.5,
                pelletCount: 1,
                spreadRad: 0,
                speed: 12,
                damage: 1,
                radius: 4,
                knockback: 0,
                pierceCount: 0,
                bounceCount: 0,
                ttlSec: 0.2,
                element: 'none',
                critChance: 0,
                amplifiedByShield: false,
                seed: sim.rng.nextUint32(),
              });
            }
          }
        }

        // Hold-and-Release Airburst (frag_launcher) & Implosion (void_staff)
        if (weaponId === 'frag_launcher') {
          const grenadeNearTarget = sim.projectiles.some(
            (b) =>
              b.team === 'player' &&
              b.ownerId === p.id &&
              b.weaponId === 'frag_launcher' &&
              b.ttlSec > 0 &&
              Math.hypot(b.x - targetX, b.y - targetY) <= 36,
          );
          if (grenadeNearTarget && releaseHoldCooldown <= 0) {
            buttons &= ~INPUT_BUTTON.FIRE;
            releaseHoldCooldown = 3;
          } else if (releaseHoldCooldown > 0) {
            releaseHoldCooldown -= 1;
          }
        } else if (weaponId === 'void_staff') {
          if (t % 36 === 0) {
            sim.spawnDeterministicVolley({
              kind: 'bullet_volley_spawned',
              tick: sim.tick,
              ownerId: target.id,
              team: 'enemy',
              weaponId: 'goblin_bow',
              x: targetX - 24,
              y: targetY + 42,
              angle: Math.PI * 0.5,
              pelletCount: 1,
              spreadRad: 0.1,
              speed: 15,
              damage: 1,
              radius: 4,
              knockback: 0,
              pierceCount: 0,
              bounceCount: 0,
              ttlSec: 0.45,
              element: 'none',
              critChance: 0,
              amplifiedByShield: false,
              seed: sim.rng.nextUint32(),
            });
          }
          const readyVoidOrb = sim.projectiles.some(
            (b) =>
              b.team === 'player' &&
              b.ownerId === p.id &&
              b.weaponId === 'void_staff' &&
              b.ttlSec > 0 &&
              (b.voidOrbFlightTicks ?? 0) >= 48 &&
              Math.hypot(b.x - targetX, b.y - targetY) <= 95,
          );
          if (readyVoidOrb && releaseHoldCooldown <= 0) {
            buttons &= ~INPUT_BUTTON.FIRE;
            releaseHoldCooldown = 3;
          } else if (releaseHoldCooldown > 0) {
            releaseHoldCooldown -= 1;
          }
        }
      }

      sim.setPlayerInput({
        seq: t + 1,
        tick: t + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        aimWorldX: targetX,
        aimWorldY: targetY,
        buttons,
      });
      sim.step(SIM_STEP_SEC);
    }

    totalDamageDealt += sim.runStats.damageDealt;
  }

  const rawDps = totalDamageDealt / (sampleSeeds.length * durationSec);
  return Math.round(rawDps * 10) / 10;
}

/**
 * Measures all 18 unique weapons (`ALL_WEAPON_IDS`) in WorldSim (`godMode: false`)
 * comparing sustained Normal DPS vs Active `[R]` / Finisher DPS against Spec 3.3 targets,
 * and computes `starterWeaponDpsSpreadPct` across the 5 starter weapons.
 */
export function measureAll18WeaponsDps(
  seeds: readonly number[] = AVERAGE_PLAYER_BOT_PROFILE.seeds,
): {
  rows: WeaponCadenceBalanceRow[];
  starterWeaponDpsSpreadPct: number;
  simulationsRun: number;
} {
  const starterSet = new Set<string>(STARTER_WEAPON_IDS);
  const orderedIds: string[] = [...P3C_ORDERED_WEAPON_IDS];
  for (const wid of ALL_WEAPON_IDS) {
    if (!orderedIds.includes(wid)) {
      orderedIds.push(wid);
    }
  }

  const rows: WeaponCadenceBalanceRow[] = [];
  const sampleCount = Math.max(1, Math.min(4, seeds.length));
  let simulationsRun = 0;

  for (const wid of orderedIds) {
    const w = WEAPONS[wid];
    if (!w) continue;

    const normalDps = simulateSingleWeaponCadenceDps(wid, false, seeds);
    const activeDps = simulateSingleWeaponCadenceDps(wid, true, seeds);
    simulationsRun += sampleCount * 2;

    const activeGainPct =
      Math.round(((activeDps - normalDps) / Math.max(1e-4, normalDps)) * 1000) / 10;
    const targetSpec = WEAPON_TARGET_DPS_SPEC_3_3[wid] ?? {
      targetNormalDps: normalDps,
      targetActiveDps: activeDps,
    };

    rows.push({
      weaponId: wid,
      nameVi: w.nameVi,
      rarity: w.rarity,
      cadenceKind: w.cadenceKind,
      isStarter: starterSet.has(wid),
      normalDps,
      activeDps,
      activeGainPct,
      targetNormalDps: targetSpec.targetNormalDps,
      targetActiveDps: targetSpec.targetActiveDps,
    });
  }

  const starterRows = rows.filter((r) => r.isStarter);
  const starterActiveVals = starterRows.map((r) => r.activeDps);
  const meanStarterActive =
    starterActiveVals.reduce((acc, v) => acc + v, 0) / Math.max(1, starterActiveVals.length);
  const maxStarterDiff = Math.max(
    ...starterActiveVals.map((v) => Math.abs(v - meanStarterActive)),
  );
  const starterWeaponDpsSpreadPct =
    Math.round((maxStarterDiff / Math.max(1e-4, meanStarterActive)) * 1000) / 10;

  return {
    rows,
    starterWeaponDpsSpreadPct,
    simulationsRun,
  };
}

function buildClassCoopRoster(
  primaryChar: CharacterId,
  playerCount: 1 | 2 | 4,
): readonly CharacterId[] {
  if (playerCount === 1) {
    return [primaryChar];
  }
  if (playerCount === 2) {
    const preferredPartner: Record<CharacterId, CharacterId> = {
      vanguard: 'elementalist',
      ranger: 'druid',
      elementalist: 'engineer',
      druid: 'ranger',
      engineer: 'elementalist',
    };
    return [primaryChar, preferredPartner[primaryChar]];
  }
  const preferred4PRoster: Record<CharacterId, readonly CharacterId[]> = {
    vanguard: ['vanguard', 'ranger', 'elementalist', 'druid'],
    ranger: ['ranger', 'elementalist', 'engineer', 'druid'],
    elementalist: ['elementalist', 'vanguard', 'druid', 'engineer'],
    druid: ['druid', 'vanguard', 'ranger', 'elementalist'],
    engineer: ['engineer', 'vanguard', 'elementalist', 'druid'],
  };
  return preferred4PRoster[primaryChar];
}

/**
 * Simulates all 5 Classes (`vanguard`, `ranger`, `elementalist`, `druid`, `engineer`)
 * across Solo `1P`, Co-op `2P`, and Co-op `4P` using `AVERAGE_PLAYER_BOT_PROFILE`
 * (`godMode: false`, 50% Perfect Reload/Vent, 40% Flip Cover + Dash-Kick, 3-6s Boss Armor Break)
 * over `>= 30` deterministic seeds (`LOCKED_30_SEEDS` by default).
 */
export function measureAll5ClassesCoopRuns(
  seeds: readonly number[] = AVERAGE_PLAYER_BOT_PROFILE.seeds,
  precomputedSoloByChar?: ReadonlyMap<
    CharacterId,
    { winRatePct: number; avgSec: number; durationStats: DistributionStats }
  >,
): {
  rows: ClassCoopRunRow[];
  classWinRateSpreadPct: number;
  simulationsRun: number;
} {
  const effectiveSeeds = seeds.length > 0 ? seeds : AVERAGE_PLAYER_BOT_PROFILE.seeds;
  const rows: ClassCoopRunRow[] = [];
  let simulationsRun = 0;

  for (const cid of CHARACTER_LIST) {
    const cDef = CHARACTERS[cid];
    const preSolo = precomputedSoloByChar?.get(cid);
    const res1P = preSolo ?? simulateBossFight(1, cid, effectiveSeeds, [cid], 'spore_king');
    if (!preSolo) {
      simulationsRun += effectiveSeeds.length;
    }

    const roster2P = buildClassCoopRoster(cid, 2);
    const res2P = simulateBossFight(2, cid, effectiveSeeds, roster2P, 'spore_king');
    simulationsRun += effectiveSeeds.length;

    const roster4P = buildClassCoopRoster(cid, 4);
    const res4P = simulateBossFight(4, cid, effectiveSeeds, roster4P, 'spore_king');
    simulationsRun += effectiveSeeds.length;

    const overallWinRatePct =
      Math.round(((res1P.winRatePct + res2P.winRatePct + res4P.winRatePct) / 3) * 10) / 10;

    rows.push({
      characterId: cid,
      nameVi: cDef.nameVi,
      roleVi: cDef.titleVi,
      runsPerMode: effectiveSeeds.length,
      totalRuns: effectiveSeeds.length * 3,
      winRate1PPct: res1P.winRatePct,
      winRate2PPct: res2P.winRatePct,
      winRate4PPct: res4P.winRatePct,
      overallWinRatePct,
      avgClearSec1P: res1P.avgSec,
      avgClearSec2P: res2P.avgSec,
      avgClearSec4P: res4P.avgSec,
      stats1PSec: res1P.durationStats,
      stats2PSec: res2P.durationStats,
      stats4PSec: res4P.durationStats,
    });
  }

  const winRates = rows.map((r) => r.overallWinRatePct);
  const meanWinRate = winRates.reduce((acc, v) => acc + v, 0) / Math.max(1, winRates.length);
  const maxWinRateDeviation = Math.max(...winRates.map((v) => Math.abs(v - meanWinRate)));
  const classWinRateSpreadPct = Math.round(maxWinRateDeviation * 10) / 10;

  return {
    rows,
    classWinRateSpreadPct,
    simulationsRun,
  };
}

export interface LateGameSynergyLoadoutSpec {
  id: string;
  labelVi: string;
  characterId: CharacterId;
  imbueElement: ElementType;
  primaryWeaponId: string;
  secondaryWeaponId: string;
  mutators: readonly [WeaponMutatorId, WeaponMutatorId];
  blessings: readonly BlessingId[];
  duoBoons: readonly [DuoBoonId, DuoBoonId];
  relics: readonly [AshenRelicId, AshenRelicId];
}

export interface LateGameSynergyBossRow {
  loadoutId: string;
  labelVi: string;
  characterId: CharacterId;
  primaryWeaponId: string;
  runs: number;
  avgSec: number;
  durationStats: DistributionStats;
  winRatePct: number;
  maxPlayerHitDamage: number;
  bossSingleHitCapDamage: number;
  singleHitCapRespected: boolean;
  maxSingleHitFraction: number;
  zeroOneShots: boolean;
  godModeAlwaysFalse: boolean;
}

export const LATE_GAME_SYNERGY_LOADOUTS: readonly LateGameSynergyLoadoutSpec[] = [
  {
    id: 'overload_supernova',
    labelVi: 'Loadout A — Hỏa + Lôi Quá Tải / Siêu Tân Tinh',
    characterId: 'elementalist',
    imbueElement: 'burn',
    primaryWeaponId: 'solar_archon_staff',
    secondaryWeaponId: 'tesla_carbine',
    mutators: ['mutator_finale_jolt', 'mutator_holo_decoy_gun'],
    blessings: ['table_tech_rocket', 'table_tech_magnet_snare', 'dash_thunder_decoy', 'reload_tediore_chuck', 'bullet_ricochet_boom', 'bullet_wall_tether'],
    duoBoons: ['duo_plasma_overload_star', 'duo_magnetic_bastion_ring'],
    relics: ['relic_black_crystal_heart', 'relic_perpetual_core'],
  },
  {
    id: 'cryo_superconduct_ricochet',
    labelVi: 'Loadout B — Băng + Lôi Siêu Dẫn / Lăng Kính Nảy',
    characterId: 'ranger',
    imbueElement: 'chill',
    primaryWeaponId: 'hunter_crossbow',
    secondaryWeaponId: 'tesla_carbine',
    mutators: ['mutator_prism_splitter', 'mutator_boomerang_core'],
    blessings: ['table_tech_blank_nova', 'table_tech_prism_split', 'dash_tidal_ram', 'reload_frost_nova', 'reload_caustic_pod', 'bullet_split_bounce'],
    duoBoons: ['duo_cryo_shatter_spires', 'duo_superconduct_rail'],
    relics: ['relic_ancient_geometry_eye', 'relic_executioner_scythe'],
  },
  {
    id: 'tactical_slam_cyclone',
    labelVi: 'Loadout C — Hỏa + Độc Xung Kích / Lốc Xoáy Napalm',
    characterId: 'vanguard',
    imbueElement: 'burn',
    primaryWeaponId: 'magma_cannon',
    secondaryWeaponId: 'seed_gun',
    mutators: ['mutator_gravity_singularity', 'mutator_elemental_infusion'],
    blessings: ['table_tech_billiard_master', 'table_tech_toxic_shrapnel', 'dash_venom_wake', 'dash_phase_blade', 'reload_repulsor_shock', 'bullet_heavy_pinball'],
    duoBoons: ['duo_superheated_cyclone', 'duo_napalm_chain_plague'],
    relics: ['relic_blood_oath_tether', 'relic_master_forge_seal'],
  },
];

export function measureLateGameSynergyFloor6Boss(
  seeds: readonly number[] = AVERAGE_PLAYER_BOT_PROFILE.seeds,
  maxSeeds = 10,
): { rows: LateGameSynergyBossRow[]; minAvgSec: number; simulationsRun: number } {
  const rawSeeds = seeds.length > 0 ? seeds : AVERAGE_PLAYER_BOT_PROFILE.seeds;
  const effectiveSeeds = rawSeeds.slice(0, Math.min(rawSeeds.length, maxSeeds));
  const rows: LateGameSynergyBossRow[] = [];
  let simulationsRun = 0;

  for (const loadout of LATE_GAME_SYNERGY_LOADOUTS) {
    for (const mutId of loadout.mutators) {
      if (!isMutatorCompatibleWithWeapon(mutId, loadout.primaryWeaponId)) {
        throw new Error(`Incompatible mutator ${mutId} on ${loadout.primaryWeaponId}`);
      }
    }
    const baseDmg = Math.max(WEAPONS[loadout.primaryWeaponId]!.damage, WEAPONS[loadout.secondaryWeaponId]!.damage);
    const bossSingleHitCapDamage = Math.round(baseDmg * BOSS_SINGLE_HIT_MAX_MULT);
    const durations: number[] = [];
    let wins = 0;
    let maxPlayerHitDamage = 0;
    let maxSingleHitFraction = 0;
    let godModeAlwaysFalse = true;

    for (const seed of effectiveSeeds) {
      simulationsRun += 1;
      const sim = new WorldSim({
        seed, biome: 3, playerCount: 1, autoRevivePlayer: false,
        spawnInitialWave: false, includeTrainingDummy: false, includeProps: true, autoRespawnWaves: false,
      });
      sim.selectCharacter(sim.player.id, loadout.characterId);
      sim.advanceToFloor(6);
      const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss') ?? sim.dungeon.rooms[0]!;
      sim.enterRoom(bossRoom.id);

      const pl = sim.player;
      pl.godMode = false;
      pl.activeImbueElement = loadout.imbueElement;
      equipPlayerWeaponSlot(pl, 0, loadout.primaryWeaponId);
      equipPlayerWeaponSlot(pl, 1, loadout.secondaryWeaponId);
      sim.equipWeaponSlot(0);
      pl.weaponUpgradeLevels = { 0: 3, 1: 2 };
      pl.weaponMutators = { 0: [...loadout.mutators], 1: [] };
      for (const bId of loadout.blessings) sim.applyBuffEffects(bId, pl.id);
      for (const dId of loadout.duoBoons) sim.applyBuffEffects(dId, pl.id);
      pl.awakenedRelicIds = [...loadout.relics];
      pl.maxArmor += 5;
      pl.armor = pl.maxArmor;
      pl.maxHp += 3;
      pl.hp = pl.maxHp;
      pl.moveSpeed = Math.round(pl.moveSpeed * 1.16);
      pl.armorRegenDelaySec = Math.max(1.2, pl.armorRegenDelaySec - 0.3);
      pl.statsDamageTaken = 0;
      sim.drainEvents();

      let boss = sim.getActiveBoss();
      if (!boss || boss.defId !== 'forge_titan') {
        sim.enemies.length = 0;
        boss = sim.spawnEnemy('forge_titan', sim.map.width * 0.68, sim.map.height * 0.5, false);
      }

      const brain = createBotBrainState(pl.id, seed);
      let prevDmgTaken = pl.statsDamageTaken ?? 0;
      let ticks = 0;
      const maxTicks = 60 * 180;

      while (boss.hp > 0 && sim.runState !== 'defeat' && pl.lifeState === 'alive' && pl.hp > 0 && ticks < maxTicks) {
        if (pl.godMode !== false) godModeAlwaysFalse = false;
        sim.setPlayerInput(stepHonestPlayerBot(sim, pl, brain, AVERAGE_PLAYER_BOT_PROFILE, SIM_STEP_SEC, ticks + 1));
        sim.step(SIM_STEP_SEC);
        ticks += 1;
        if (pl.godMode !== false) godModeAlwaysFalse = false;

        const nowDmg = pl.statsDamageTaken ?? 0;
        if (nowDmg > prevDmgTaken) {
          const frac = (nowDmg - prevDmgTaken) / Math.max(1, pl.maxHp + pl.maxArmor);
          if (frac > maxSingleHitFraction) maxSingleHitFraction = frac;
        }
        prevDmgTaken = nowDmg;

        const envBossHazardDmg = Math.round(0.06 * boss.maxHp);
        const evs = sim.drainEvents();
        for (let i = 0; i < evs.length; i++) {
          const ev = evs[i]!;
          if (ev.kind === 'damage_dealt' && ev.targetKind === 'enemy' && ev.targetId === boss.id) {
            const isEnvHazard = ev.element === 'none' && ev.knockbackX === 0 && ev.knockbackY === 0 && ev.amount === envBossHazardDmg;
            if (!isEnvHazard && ev.amount > maxPlayerHitDamage) maxPlayerHitDamage = ev.amount;
          }
        }
      }

      if (boss.hp <= 0) wins += 1;
      durations.push(Math.round(ticks * SIM_STEP_SEC * 100) / 100);
    }

    const durationStats = computeDistributionStats(durations);
    rows.push({
      loadoutId: loadout.id, labelVi: loadout.labelVi, characterId: loadout.characterId,
      primaryWeaponId: loadout.primaryWeaponId, runs: effectiveSeeds.length,
      avgSec: durationStats.p50, durationStats,
      winRatePct: Math.round((wins / effectiveSeeds.length) * 1000) / 10,
      maxPlayerHitDamage, bossSingleHitCapDamage,
      singleHitCapRespected: maxPlayerHitDamage <= bossSingleHitCapDamage,
      maxSingleHitFraction: Math.round(maxSingleHitFraction * 1000) / 1000,
      zeroOneShots: maxSingleHitFraction < 0.85, godModeAlwaysFalse,
    });
  }

  const minAvgSec = rows.reduce((m, r) => Math.min(m, r.avgSec), Infinity);
  return { rows, minAvgSec: Number.isFinite(minAvgSec) ? minAvgSec : 0, simulationsRun };
}
