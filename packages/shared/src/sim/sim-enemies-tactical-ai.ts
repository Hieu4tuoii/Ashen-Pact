import { angleDiff, clamp, distance, normalizeAngle } from '../math/vec2.js';
import { TILE_SIZE } from '../protocol/messages.js';
import { collapseRottenTotemPillar, computeHazardDamage } from './sim-tactical-physics.js';
import type { SimEnemyState, SimPlayerState, SimPropState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export * from './sim-enemies-tactical-b23.js';

export const LEAD_FACTOR_REGULAR = 0.35;
export const LEAD_FACTOR_ELITE_OR_BOSS = 0.65;
export const MAX_PREDICTIVE_LEAD_TIME_SEC = 0.65;
export const MAX_PREDICTIVE_LEAD_ANGLE_RAD = (28 * Math.PI) / 180; // ~0.488692 rad (0.49 rad)
export const SIGHTLINE_TELEGRAPH_WINDOW_SEC = 0.35;

export const GOBLIN_SHOOTER_COVER_SEARCH_RADIUS = 220;
export const GOBLIN_SHOOTER_ARROW_SPEED = 360;
export const GOBLIN_SHOOTER_SPREAD_RAD = 0.11;
export const KICKED_SPORE_BOMBER_SPEED = 520;
export const KICKED_SPORE_EXPLOSION_RADIUS = 95;
export const KICKED_SPORE_EXPLOSION_DAMAGE = 75;
export const SHAMAN_TOTEM_LINK_RADIUS = 220;
export const SHAMAN_TOTEM_DMG_MULT = 0.6;
export const SHAMAN_TOTEM_BACKLASH_STUN_SEC = 1.2;
export const SHAMAN_TOTEM_BACKLASH_DMG = 28;

/**
 * Bounded Predictive Lead Aiming (Spec Rev 4 Section 6.1):
 * Predicts target movement using `timeToHit = min(0.65, distToTarget / max(1, projectileSpeed))`
 * and `leadFactor` (0.35 for regular enemies, 0.65 for Elite/Boss), clamping the angular
 * deviation from `directAngle` strictly within `[-maxLeadAngleRad, +maxLeadAngleRad]` (±28°).
 */
export function computePredictiveLeadAimAngle(
  enemy: Pick<
    SimEnemyState,
    'x' | 'y' | 'isElite' | 'isBoss' | 'steamBlindTimer' | 'strafeSign'
  >,
  targetPlayer: Pick<SimPlayerState, 'x' | 'y' | 'vx' | 'vy'>,
  projectileSpeed: number,
  leadFactor?: number,
  maxLeadAngleRad: number = MAX_PREDICTIVE_LEAD_ANGLE_RAD,
  jitterRad = 0,
): number {
  const distToTarget = Math.hypot(targetPlayer.x - enemy.x, targetPlayer.y - enemy.y);
  const directAngle = Math.atan2(targetPlayer.y - enemy.y, targetPlayer.x - enemy.x);
  const effectiveSpeed = Math.max(1, projectileSpeed);
  const timeToHit = Math.min(MAX_PREDICTIVE_LEAD_TIME_SEC, distToTarget / effectiveSpeed);
  const resolvedLeadFactor =
    leadFactor ??
    (enemy.isBoss || enemy.isElite ? LEAD_FACTOR_ELITE_OR_BOSS : LEAD_FACTOR_REGULAR);
  const predX = targetPlayer.x + targetPlayer.vx * timeToHit * resolvedLeadFactor;
  const predY = targetPlayer.y + targetPlayer.vy * timeToHit * resolvedLeadFactor;
  const rawLeadAngle = Math.atan2(predY - enemy.y, predX - enemy.x);
  const delta = clamp(
    angleDiff(rawLeadAngle, directAngle),
    -maxLeadAngleRad,
    maxLeadAngleRad,
  );
  const steamOffset =
    enemy.steamBlindTimer && enemy.steamBlindTimer > 0
      ? 0.52 * (enemy.strafeSign || 1)
      : 0;
  return normalizeAngle(directAngle + delta + jitterRad + steamOffset);
}

export const computeLeadAimAngle = computePredictiveLeadAimAngle;

const TAUNT_TARGET_SCRATCH: Pick<SimPlayerState, 'x' | 'y' | 'vx' | 'vy'> = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
};

/**
 * Resolves the effective aim target for an enemy (accounting for Druid's Sacred Tree taunt within 170u).
 */
export function resolveEnemyAimTarget(
  sim: WorldSim,
  e: SimEnemyState,
  fallbackPlayer?: SimPlayerState,
): Pick<SimPlayerState, 'x' | 'y' | 'vx' | 'vy'> {
  if (!e.isBoss && sim.summons.length > 0) {
    for (let sIdx = 0; sIdx < sim.summons.length; sIdx++) {
      const sum = sim.summons[sIdx]!;
      if (sum.kind === 'sacred_tree' && sum.hp > 0 && sum.ttlSec > 0) {
        const dx = sum.x - e.x;
        const dy = sum.y - e.y;
        if (dx * dx + dy * dy <= 170 * 170) {
          TAUNT_TARGET_SCRATCH.x = sum.x;
          TAUNT_TARGET_SCRATCH.y = sum.y;
          return TAUNT_TARGET_SCRATCH;
        }
      }
    }
  }
  return fallbackPlayer ?? sim.findNearestAlivePlayer(e.x, e.y);
}

/**
 * Updates an enemy's predictive telegraph sightline and locks the angle during the final 0.35s window
 * before firing so players have a fair, deterministic counterplay window to Dash or flip cover.
 */
export function updateEnemyPredictiveSightline(
  _sim: WorldSim,
  e: SimEnemyState,
  targetPlayer: Pick<SimPlayerState, 'x' | 'y' | 'vx' | 'vy'>,
  projectileSpeed: number,
  leadFactor?: number,
): number {
  if (e.aiState !== 'telegraph' || e.stateTimer <= 0) {
    e.leadSightlineActive = false;
    return e.telegraphAngle;
  }

  if (e.stateTimer > SIGHTLINE_TELEGRAPH_WINDOW_SEC) {
    const angle = computePredictiveLeadAimAngle(
      e,
      targetPlayer,
      projectileSpeed,
      leadFactor,
    );
    e.telegraphAngle = angle;
    e.aimAngle = angle;
    e.leadSightlineActive = false;
    return angle;
  }

  if (!e.leadSightlineActive) {
    const lockedAngle = computePredictiveLeadAimAngle(
      e,
      targetPlayer,
      projectileSpeed,
      leadFactor,
    );
    e.telegraphAngle = lockedAngle;
    e.leadSightlineAngle = lockedAngle;
    e.aimAngle = lockedAngle;
    e.leadSightlineActive = true;
  } else if (e.leadSightlineAngle !== undefined) {
    e.telegraphAngle = e.leadSightlineAngle;
    e.aimAngle = e.leadSightlineAngle;
  }

  return e.telegraphAngle;
}

/**
 * Steps a ranged enemy's telegraph state with predictive lead tracking (> 0.35s) and sightline lock (<= 0.35s).
 * Returns true when `stateTimer` reaches `<= 0` (ready to fire).
 */
export function stepEnemyTelegraphSightline(
  sim: WorldSim,
  e: SimEnemyState,
  targetPlayer: Pick<SimPlayerState, 'x' | 'y' | 'vx' | 'vy'>,
  projectileSpeed: number,
  dtSec: number,
  leadFactor?: number,
): boolean {
  e.vx = 0;
  e.vy = 0;
  updateEnemyPredictiveSightline(sim, e, targetPlayer, projectileSpeed, leadFactor);
  e.stateTimer -= dtSec;
  if (
    e.stateTimer > 0 &&
    e.stateTimer <= SIGHTLINE_TELEGRAPH_WINDOW_SEC &&
    !e.leadSightlineActive
  ) {
    updateEnemyPredictiveSightline(sim, e, targetPlayer, projectileSpeed, leadFactor);
  }
  e.aimAngle = e.telegraphAngle;
  if (e.stateTimer <= 0) {
    e.leadSightlineActive = false;
    return true;
  }
  return false;
}

/**
 * Lightweight raycast along `angle` from `(startX, startY)` up to `maxDist`, stopping at the
 * first solid wall/pillar tile or projectile-blocking tactical cover prop (`coverState === 'flipped'`).
 */
export function raycastSightlineDistance(
  sim: Pick<WorldSim, 'map' | 'props'>,
  startX: number,
  startY: number,
  angle: number,
  maxDist: number,
): number {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const stepPx = 4;
  const cols = sim.map.cols;
  const rows = sim.map.rows;
  const tiles = sim.map.tiles;
  const props = sim.props;

  for (let d = stepPx; d <= maxDist; d += stepPx) {
    const px = startX + cos * d;
    const py = startY + sin * d;
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) {
      return Math.max(0, d - stepPx);
    }
    if (tiles[ty * cols + tx] !== 'floor') {
      return Math.max(0, d - stepPx * 0.5);
    }
    for (let i = 0; i < props.length; i++) {
      const prop = props[i]!;
      if (prop.hp <= 0) continue;
      if (prop.coverState !== 'flipped' && !prop.blocksEnemyProjectiles) continue;
      const dx = px - prop.x;
      const dy = py - prop.y;
      const hitR = prop.radius + 2;
      if (dx * dx + dy * dy <= hitR * hitR) {
        return Math.max(0, d - stepPx * 0.5);
      }
    }
  }

  return maxDist;
}

const COVER_POINT_SCRATCH = { x: 0, y: 0 };

/**
 * Biome 1 `goblin_shooter` terrain cover seeker:
 * 1) Finds nearest intact `moss_table` within 220px and computes a cover position on the opposite side from `targetPlayer`.
 * 2) Otherwise finds the nearest `'grass'` surface tile within 220px.
 */
export function findGoblinShooterCoverPoint(
  sim: WorldSim,
  e: Pick<SimEnemyState, 'x' | 'y' | 'radius'>,
  targetPlayer: Pick<SimPlayerState, 'x' | 'y'>,
): { x: number; y: number } | null {
  let bestProp: SimPropState | null = null;
  let bestPropDist = GOBLIN_SHOOTER_COVER_SEARCH_RADIUS;
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (
      prop.kind !== 'moss_table' ||
      prop.hp <= 0 ||
      prop.coverState === 'sliding' ||
      prop.coverState === 'flipped'
    ) {
      continue;
    }
    const d = distance(e.x, e.y, prop.x, prop.y);
    if (d <= bestPropDist) {
      bestPropDist = d;
      bestProp = prop;
    }
  }
  if (bestProp) {
    const awayAngle = Math.atan2(bestProp.y - targetPlayer.y, bestProp.x - targetPlayer.x);
    const offset = bestProp.radius + e.radius + 4;
    COVER_POINT_SCRATCH.x = bestProp.x + Math.cos(awayAngle) * offset;
    COVER_POINT_SCRATCH.y = bestProp.y + Math.sin(awayAngle) * offset;
    return COVER_POINT_SCRATCH;
  }

  const centerTx = Math.floor(e.x / TILE_SIZE);
  const centerTy = Math.floor(e.y / TILE_SIZE);
  const tileRadius = Math.ceil(GOBLIN_SHOOTER_COVER_SEARCH_RADIUS / TILE_SIZE);
  let bestGrassX = 0;
  let bestGrassY = 0;
  let bestGrassDist = GOBLIN_SHOOTER_COVER_SEARCH_RADIUS;
  let foundGrass = false;

  const minTy = Math.max(1, centerTy - tileRadius);
  const maxTy = Math.min(sim.map.rows - 2, centerTy + tileRadius);
  const minTx = Math.max(1, centerTx - tileRadius);
  const maxTx = Math.min(sim.map.cols - 2, centerTx + tileRadius);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (sim.map.getSurface(tx, ty) !== 'grass') continue;
      const wx = tx * TILE_SIZE + TILE_SIZE * 0.5;
      const wy = ty * TILE_SIZE + TILE_SIZE * 0.5;
      const d = distance(e.x, e.y, wx, wy);
      if (d <= bestGrassDist) {
        bestGrassDist = d;
        bestGrassX = wx;
        bestGrassY = wy;
        foundGrass = true;
      }
    }
  }

  if (foundGrass) {
    COVER_POINT_SCRATCH.x = bestGrassX;
    COVER_POINT_SCRATCH.y = bestGrassY;
    return COVER_POINT_SCRATCH;
  }
  return null;
}

/**
 * Fires Goblin Shooter's 3-arrow volley: 2 straight arrows (`directAngle +/- 0.11`) + 1 predictive lead arrow (`leadAngle`).
 */
export function fireGoblinShooterVolley(
  sim: WorldSim,
  e: SimEnemyState,
  aimTarget: Pick<SimPlayerState, 'x' | 'y' | 'vx' | 'vy'>,
): void {
  const directAngle = Math.atan2(aimTarget.y - e.y, aimTarget.x - e.x);
  const leadAngle =
    e.leadSightlineAngle ??
    computePredictiveLeadAimAngle(e, aimTarget, GOBLIN_SHOOTER_ARROW_SPEED, 0.35);

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: e.id,
    team: 'enemy',
    weaponId: 'goblin_bow',
    x: e.x + Math.cos(directAngle) * 14,
    y: e.y + Math.sin(directAngle) * 14,
    angle: directAngle,
    pelletCount: 2,
    spreadRad: GOBLIN_SHOOTER_SPREAD_RAD * 2,
    speed: GOBLIN_SHOOTER_ARROW_SPEED,
    damage: e.damage,
    radius: 5,
    knockback: 90,
    pierceCount: 0,
    bounceCount: 0,
    ttlSec: 2.0,
    element: 'none',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
  });

  const savedMod = e.eliteModifier;
  if (savedMod === 'volley') e.eliteModifier = null;
  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: e.id,
    team: 'enemy',
    weaponId: 'goblin_bow',
    x: e.x + Math.cos(leadAngle) * 14,
    y: e.y + Math.sin(leadAngle) * 14,
    angle: leadAngle,
    pelletCount: 1,
    spreadRad: 0,
    speed: GOBLIN_SHOOTER_ARROW_SPEED,
    damage: e.damage,
    radius: 5,
    knockback: 90,
    pierceCount: 0,
    bounceCount: 0,
    ttlSec: 2.0,
    element: 'none',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
  });
  e.eliteModifier = savedMod;
}

/**
 * Biome 1 `wild_boar` terrain interaction:
 * Charging (`aiState === 'attack'`) into an intact `rotten_totem_pillar` collapses the pillar
 * onto the boar, dealing >= 48 true hazard damage and stunning the boar for 1.5s.
 */
export function checkWildBoarPillarCrash(sim: WorldSim, e: SimEnemyState): boolean {
  if (e.defId !== 'wild_boar' || e.hp <= 0 || e.aiState !== 'attack') return false;

  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (
      prop.kind !== 'rotten_totem_pillar' ||
      prop.hp <= 0 ||
      prop.coverState === 'fallen' ||
      prop.state === 'broken'
    ) {
      continue;
    }
    if (distance(e.x, e.y, prop.x, prop.y) <= e.radius + prop.radius + 8) {
      const fallAngle =
        Math.hypot(e.vx, e.vy) > 1 ? Math.atan2(e.vy, e.vx) : e.telegraphAngle;
      const hpBefore = e.hp;
      collapseRottenTotemPillar(sim, prop, fallAngle, sim.player.id);
      prop.state = 'broken';
      prop.coverState = 'fallen';
      prop.hp = 0;

      const minCrashDmg = Math.max(
        48,
        computeHazardDamage(e, sim.currentFloor, 28),
        Math.round(e.maxHp * 0.35),
      );
      const alreadyDealt = Math.max(0, hpBefore - e.hp);
      if (alreadyDealt < minCrashDmg) {
        const extraDmg = minCrashDmg - alreadyDealt;
        e.hp = Math.max(0, e.hp - extraDmg);
        e.hitFlashTimer = 0.16;
        e.lastHitDmg = minCrashDmg;
        sim.events.push({
          kind: 'damage_dealt',
          targetId: e.id,
          targetKind: 'enemy',
          x: e.x,
          y: e.y,
          amount: extraDmg,
          isCrit: false,
          hitArmor: false,
          element: 'none',
          knockbackX: 0,
          knockbackY: 0,
        });
      }

      e.stunTimer = Math.max(e.stunTimer ?? 0, 1.5);
      e.aiState = 'stunned';
      e.stateTimer = 1.5;
      e.vx = 0;
      e.vy = 0;
      if (e.hp <= 0) {
        sim.handleEnemyKilled(e, sim.player.id);
      }
      return true;
    }
  }
  return false;
}

/**
 * Biome 1 `spore_bomber` counterplay:
 * Punts a telegraphing `spore_bomber` backward at 520 px/s (`kickedSporeBomber = true`)
 * so it flies into enemy ranks and detonates (r = 95px) without damaging the kicking player.
 */
export function kickSporeBomber(
  _sim: WorldSim,
  e: SimEnemyState,
  player: Pick<SimPlayerState, 'id' | 'x' | 'y'>,
  kickAngle?: number,
): boolean {
  if (e.defId !== 'spore_bomber' || e.hp <= 0 || e.aiState !== 'telegraph') {
    return false;
  }
  const angle =
    kickAngle !== undefined ? kickAngle : Math.atan2(e.y - player.y, e.x - player.x);
  const vx = Math.cos(angle) * KICKED_SPORE_BOMBER_SPEED;
  const vy = Math.sin(angle) * KICKED_SPORE_BOMBER_SPEED;

  e.kickedSporeBomber = true;
  e.kickedByPlayerId = player.id;
  e.kbVx = vx;
  e.kbVy = vy;
  e.vx = 0;
  e.vy = 0;
  e.kickedVelX = vx;
  e.kickedVelY = vy;
  e.stateTimer = Math.min(e.stateTimer > 0 ? e.stateTimer : 0.28, 0.28);
  e.telegraphRadius = KICKED_SPORE_EXPLOSION_RADIUS;
  return true;
}

/**
 * Steps a punted `spore_bomber` flying at 520 px/s and triggers detonation on enemy/wall/prop impact or timer expiry.
 */
export function stepKickedSporeBomber(
  sim: WorldSim,
  e: SimEnemyState,
  dtSec: number,
): boolean {
  if (!e.kickedSporeBomber || e.hp <= 0) return false;

  const vx = e.kickedVelX ?? e.kbVx;
  const vy = e.kickedVelY ?? e.kbVy;
  e.kbVx = vx;
  e.kbVy = vy;
  e.vx = 0;
  e.vy = 0;

  const nextX = e.x + vx * dtSec;
  const nextY = e.y + vy * dtSec;
  e.stateTimer -= dtSec;

  let shouldDetonate = e.stateTimer <= 0;

  if (!shouldDetonate) {
    for (let i = 0; i < sim.enemies.length; i++) {
      const other = sim.enemies[i]!;
      if (other.id === e.id || other.hp <= 0 || other.aiState === 'spawning') continue;
      if (distance(nextX, nextY, other.x, other.y) <= e.radius + other.radius + 6) {
        shouldDetonate = true;
        break;
      }
    }
  }

  if (!shouldDetonate) {
    const col = sim.map.resolveCircleCollision(nextX, nextY, e.radius, true);
    if (col.collided) {
      shouldDetonate = true;
    }
  }

  if (!shouldDetonate) {
    for (let i = 0; i < sim.props.length; i++) {
      const prop = sim.props[i]!;
      if (prop.hp <= 0 || !prop.blocksMovement) continue;
      if (distance(nextX, nextY, prop.x, prop.y) <= e.radius + prop.radius + 4) {
        shouldDetonate = true;
        break;
      }
    }
  }

  if (shouldDetonate) {
    e.x = nextX;
    e.y = nextY;
    e.kbVx = 0;
    e.kbVy = 0;
    sim.detonateSporeBomber(e);
    return true;
  }

  return true;
}

/**
 * Biome 1 `goblin_shaman`: Plants a Ward Totem (`shaman_totem`) tactical prop near the shaman if none is currently active for it.
 */
export function spawnShamanTotem(sim: WorldSim, shaman: SimEnemyState): SimPropState | null {
  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    if (
      p.kind === 'shaman_totem' &&
      p.hp > 0 &&
      p.state !== 'broken' &&
      (p.linkedShamanId === shaman.id || distance(p.x, p.y, shaman.x, shaman.y) <= SHAMAN_TOTEM_LINK_RADIUS)
    ) {
      return p;
    }
  }

  const spawnAngle = shaman.aimAngle || 0;
  const tx = shaman.x + Math.cos(spawnAngle) * 36;
  const ty = shaman.y + Math.sin(spawnAngle) * 36;
  const totem = sim.spawnProp('shaman_totem', tx, ty);
  totem.hp = 65;
  totem.maxHp = 65;
  totem.radius = 18;
  totem.state = 'intact';
  totem.linkedShamanId = shaman.id;
  return totem;
}

/**
 * Returns `0.60` (40% damage reduction) if `enemy` is a non-boss enemy within `220px` of an intact `shaman_totem`, else `1.0`.
 */
export function getShamanTotemDamageMultiplier(
  sim: Pick<WorldSim, 'props'>,
  enemy: Pick<SimEnemyState, 'x' | 'y' | 'radius' | 'isBoss' | 'hp'>,
): number {
  if (enemy.isBoss || enemy.hp <= 0) return 1.0;
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.kind !== 'shaman_totem' || prop.hp <= 0 || prop.state === 'broken') continue;
    if (distance(prop.x, prop.y, enemy.x, enemy.y) <= SHAMAN_TOTEM_LINK_RADIUS + enemy.radius) {
      return SHAMAN_TOTEM_DMG_MULT;
    }
  }
  return 1.0;
}

/**
 * Triggers the 1.2s backlash stun and 28 shock/backlash damage on all enemies linked to `totem` within 220px when broken.
 */
export function triggerShamanTotemBacklash(
  sim: WorldSim,
  totem: SimPropState,
  attackerId = sim.player.id,
): number {
  if (totem.state === 'broken') return 0;
  totem.hp = 0;
  totem.state = 'broken';
  totem.blocksMovement = false;
  totem.destructible = false;

  let stunnedCount = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.defId === 'ashen_executioner') continue;
    if (distance(totem.x, totem.y, e.x, e.y) <= SHAMAN_TOTEM_LINK_RADIUS + e.radius) {
      e.stunTimer = Math.max(e.stunTimer ?? 0, SHAMAN_TOTEM_BACKLASH_STUN_SEC);
      if (!e.isBoss) {
        e.aiState = 'stunned';
        e.stateTimer = Math.max(e.stateTimer, SHAMAN_TOTEM_BACKLASH_STUN_SEC);
        e.vx = 0;
        e.vy = 0;
      }
      e.hp = Math.max(0, e.hp - SHAMAN_TOTEM_BACKLASH_DMG);
      e.hitFlashTimer = 0.14;
      e.lastHitDmg = SHAMAN_TOTEM_BACKLASH_DMG;
      sim.events.push({
        kind: 'damage_dealt',
        targetId: e.id,
        targetKind: 'enemy',
        x: e.x,
        y: e.y,
        amount: SHAMAN_TOTEM_BACKLASH_DMG,
        isCrit: false,
        hitArmor: false,
        element: 'shock',
        knockbackX: 0,
        knockbackY: 0,
      });
      sim.events.push({
        kind: 'status_applied',
        targetId: e.id,
        status: 'shock',
        x: e.x,
        y: e.y,
      });
      if (e.hp <= 0) {
        sim.handleEnemyKilled(e, attackerId);
      }
      stunnedCount++;
    }
  }
  return stunnedCount;
}
