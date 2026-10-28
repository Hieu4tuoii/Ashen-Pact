import { angleDiff, clamp, normalizeAngle } from '../math/vec2.js';
import { TILE_SIZE } from '../protocol/messages.js';
import type { SimEnemyState, SimPlayerState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const LEAD_FACTOR_REGULAR = 0.35;
export const LEAD_FACTOR_ELITE_OR_BOSS = 0.65;
export const MAX_PREDICTIVE_LEAD_TIME_SEC = 0.65;
export const MAX_PREDICTIVE_LEAD_ANGLE_RAD = (28 * Math.PI) / 180; // ~0.488692 rad (0.49 rad)
export const SIGHTLINE_TELEGRAPH_WINDOW_SEC = 0.35;

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
