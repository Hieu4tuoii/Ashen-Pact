import { clamp } from '../math/vec2.js';
import type { BulletVolleySpawnEvent, SimProjectileState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const MAX_SPLIT_GENERATION = 1 as const;
export const MAX_PELLETS_PER_TRIGGER = 9 as const;
export const MAX_BOUNCE_COUNT = 4 as const;

export const ADDITIVE_POOL_SOFT_CAP_THRESHOLD = 1.8 as const;
export const ADDITIVE_POOL_SOFT_CAP_MULT = 2.8 as const;
export const ADDITIVE_POOL_SOFT_SLOPE = 0.35 as const;
export const ADDITIVE_POOL_HARD_CAP_MULT = 3.8 as const;

export const ENEMY_VULN_HARD_CAP_MULT = 1.75 as const;
export const SHATTER_REGULAR_MULT = 2.0 as const;
export const SHATTER_BOSS_CAP_MULT = 1.35 as const;
export const BOSS_SINGLE_HIT_MAX_MULT = 18.0 as const;

export interface AdditiveDamageBonusInput {
  finaleShot?: boolean | number;
  overclockedShot?: boolean | number;
  overheatOrange?: boolean | number;
  bounceCount?: number;
  shieldBonusAdd?: number;
  zoneImbued?: boolean | number;
  prismSplit?: boolean | number;
  pactBonusAdd?: number;
  relicBonusAdd?: number;
  otherBonusAdd?: number;
}

export interface EnemyVulnerabilityInput {
  marked?: boolean | number;
  superconduct?: boolean | number;
  caustic?: boolean | number;
  bossArmorBreak?: boolean | number;
  extraVulnAdd?: number;
}

export interface ThreeBucketDamageParams {
  baseDamage: number;
  upgradeLevel?: number;
  additive?: number | AdditiveDamageBonusInput;
  isCrit?: boolean;
  critMultiplier?: number;
  vulnerability?: number | EnemyVulnerabilityInput;
  reaction?: 'none' | 'shatter' | string;
  shatter?: boolean;
  isBoss?: boolean;
}

export interface ThreeBucketDamageBreakdown {
  finalDamage: number;
  totalMultiplier: number;
  upgradeMult: number;
  additiveMult: number;
  critMult: number;
  vulnMult: number;
  reactionMult: number;
}

export function clampPelletsPerTrigger(pelletCount: number): number {
  if (!Number.isFinite(pelletCount)) return 1;
  return clamp(Math.round(pelletCount), 1, MAX_PELLETS_PER_TRIGGER);
}

export function clampBounceCount(bounceCount: number): number {
  if (!Number.isFinite(bounceCount)) return 0;
  return clamp(Math.round(bounceCount), 0, MAX_BOUNCE_COUNT);
}

export function computeUpgradeMultiplier(upgradeLevel: number): number {
  const lvl = Number.isFinite(upgradeLevel) ? clamp(Math.round(upgradeLevel), 0, 3) : 0;
  return 1 + 0.2 * lvl;
}

export function computeAdditivePoolSum(input: number | AdditiveDamageBonusInput): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : 0;
  }
  const finale =
    typeof input.finaleShot === 'number' ? input.finaleShot : input.finaleShot ? 0.5 : 0;
  const overclock =
    typeof input.overclockedShot === 'number'
      ? input.overclockedShot
      : input.overclockedShot
        ? 0.45
        : 0;
  const overheat =
    typeof input.overheatOrange === 'number'
      ? input.overheatOrange
      : input.overheatOrange
        ? 0.25
        : 0;
  const bounces = clampBounceCount(input.bounceCount ?? 0);
  const bounceBonus = 0.35 * bounces;
  const shield = clamp(input.shieldBonusAdd ?? 0, 0, 0.75);
  const zone =
    typeof input.zoneImbued === 'number' ? input.zoneImbued : input.zoneImbued ? 0.15 : 0;
  const prism =
    typeof input.prismSplit === 'number' ? input.prismSplit : input.prismSplit ? 0.2 : 0;
  const pact = input.pactBonusAdd ?? 0;
  const relic = input.relicBonusAdd ?? 0;
  const other = input.otherBonusAdd ?? 0;
  return finale + overclock + overheat + bounceBonus + shield + zone + prism + pact + relic + other;
}

export const computeAdditiveBonusSum = computeAdditivePoolSum;

export function computeAdditivePoolMultiplier(
  sOrInput: number | AdditiveDamageBonusInput,
): number {
  const s = computeAdditivePoolSum(sOrInput);
  if (s <= ADDITIVE_POOL_SOFT_CAP_THRESHOLD) {
    return Math.min(ADDITIVE_POOL_HARD_CAP_MULT, Math.max(0.1, 1 + s));
  }
  const softCapped =
    ADDITIVE_POOL_SOFT_CAP_MULT +
    ADDITIVE_POOL_SOFT_SLOPE * (s - ADDITIVE_POOL_SOFT_CAP_THRESHOLD);
  return Math.min(ADDITIVE_POOL_HARD_CAP_MULT, softCapped);
}

export function computeEnemyVulnerabilityMultiplier(
  input: number | EnemyVulnerabilityInput,
): number {
  if (typeof input === 'number') {
    return clamp(input, 0.1, ENEMY_VULN_HARD_CAP_MULT);
  }
  const marked = typeof input.marked === 'number' ? input.marked : input.marked ? 0.25 : 0;
  const superconduct =
    typeof input.superconduct === 'number'
      ? input.superconduct
      : input.superconduct
        ? 0.25
        : 0;
  const caustic =
    typeof input.caustic === 'number' ? input.caustic : input.caustic ? 0.25 : 0;
  const bossArmorBreak =
    typeof input.bossArmorBreak === 'number'
      ? input.bossArmorBreak
      : input.bossArmorBreak
        ? 0.4
        : 0;
  const extra = input.extraVulnAdd ?? 0;
  const sum = marked + superconduct + caustic + bossArmorBreak + extra;
  return clamp(1 + sum, 0.1, ENEMY_VULN_HARD_CAP_MULT);
}

export function computeReactionShatterMultiplier(
  shatterOrReaction: boolean | 'none' | 'shatter' | string | undefined,
  isBoss = false,
): number {
  if (shatterOrReaction === true || shatterOrReaction === 'shatter') {
    return isBoss ? SHATTER_BOSS_CAP_MULT : SHATTER_REGULAR_MULT;
  }
  return 1.0;
}

export function computeReactionMultiplier(
  reaction: 'none' | 'shatter' | string | undefined,
  isBoss = false,
): number {
  return computeReactionShatterMultiplier(reaction, isBoss);
}

export function evaluateThreeBucketDamageBreakdown(
  params: ThreeBucketDamageParams,
): ThreeBucketDamageBreakdown {
  const upgradeMult = computeUpgradeMultiplier(params.upgradeLevel ?? 0);
  const additiveMult = computeAdditivePoolMultiplier(params.additive ?? 0);
  const critMult = params.isCrit ? (params.critMultiplier ?? 1.5) : 1.0;
  const vulnMult = computeEnemyVulnerabilityMultiplier(params.vulnerability ?? {});
  const isShatter = params.shatter === true || params.reaction === 'shatter';
  const reactionMult = computeReactionMultiplier(
    isShatter ? 'shatter' : params.reaction,
    Boolean(params.isBoss),
  );
  const rawTotal = upgradeMult * additiveMult * critMult * vulnMult * reactionMult;
  const totalMultiplier = params.isBoss
    ? Math.min(BOSS_SINGLE_HIT_MAX_MULT, rawTotal)
    : rawTotal;
  const finalDamage = Math.max(1, Math.round(params.baseDamage * totalMultiplier));

  return {
    finalDamage,
    totalMultiplier,
    upgradeMult,
    additiveMult,
    critMult,
    vulnMult,
    reactionMult,
  };
}

export function computeThreeBucketDamage(params: ThreeBucketDamageParams): number {
  return evaluateThreeBucketDamageBreakdown(params).finalDamage;
}

export function scaleBlessingDamage(baseDmg: number, globalFloor: number): number {
  const floor = Math.max(1, Math.round(Number.isFinite(globalFloor) ? globalFloor : 1));
  return Math.max(1, Math.round(baseDmg * (1 + 0.22 * (floor - 1))));
}

/**
 * Enforces Split Generation Cap (splitGeneration: 0 | 1):
 * - If proj.splitGeneration === 0: marks proj.splitGeneration = 1 and spawns child projectiles
 *   (also with splitGeneration = 1), capped so total pellets never exceed MAX_PELLETS_PER_TRIGGER = 9.
 * - If proj.splitGeneration >= 1: NEVER spawns child projectiles; instead grants +20% damage
 *   and +1 bounceRemaining (clamped to MAX_BOUNCE_COUNT = 4).
 */
export function resolveProjectileSplitInSim(
  sim: WorldSim,
  proj: SimProjectileState,
  requestedChildCount = 2,
  spreadRad = 0.35,
): { didSplit: boolean; spawnedProjectiles: SimProjectileState[] } {
  const currentGen = proj.splitGeneration ?? 0;
  if (currentGen >= MAX_SPLIT_GENERATION) {
    proj.splitGeneration = MAX_SPLIT_GENERATION;
    proj.prismBonusAdd = Number(((proj.prismBonusAdd ?? 0) + 0.2).toFixed(4));
    proj.damage = Math.max(1, Math.round(proj.damage * 1.2));
    proj.bounceRemaining = clampBounceCount((proj.bounceRemaining ?? 0) + 1);
    return { didSplit: false, spawnedProjectiles: [] };
  }

  proj.splitGeneration = MAX_SPLIT_GENERATION;
  const childCount = clamp(Math.round(requestedChildCount), 1, MAX_PELLETS_PER_TRIGGER - 1);
  const speed = Math.hypot(proj.vx, proj.vy) || 480;
  const startIdx = sim.projectiles.length;

  const volleyEv: BulletVolleySpawnEvent = {
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: proj.ownerId,
    team: proj.team,
    weaponId: proj.weaponId,
    x: proj.x,
    y: proj.y,
    angle: proj.angle,
    pelletCount: childCount,
    spreadRad,
    speed,
    damage: proj.damage,
    radius: proj.radius,
    knockback: proj.knockback,
    pierceCount: proj.pierceRemaining,
    bounceCount: clampBounceCount(proj.bounceRemaining),
    ttlSec: Math.max(0.25, proj.ttlSec),
    element: proj.element,
    critChance: proj.isCrit ? 1 : 0,
    amplifiedByShield: proj.amplifiedByShield,
    seed: sim.rng.nextUint32(),
    shotFlags: proj.shotFlags,
    flags: proj.shotFlags,
  };

  sim.spawnDeterministicVolley(volleyEv, true);
  const spawnedProjectiles: SimProjectileState[] = [];
  for (let i = startIdx; i < sim.projectiles.length; i++) {
    const child = sim.projectiles[i]!;
    child.splitGeneration = MAX_SPLIT_GENERATION;
    child.prismBonusAdd = proj.prismBonusAdd ?? 0;
    child.passedThroughCoverOrPrism = true;
    for (let h = 0; h < proj.hitEntityIds.length; h++) {
      const hid = proj.hitEntityIds[h]!;
      if (!child.hitEntityIds.includes(hid)) {
        child.hitEntityIds.push(hid);
      }
    }
    spawnedProjectiles.push(child);
  }

  return { didSplit: true, spawnedProjectiles };
}

export const trySplitProjectile = resolveProjectileSplitInSim;
