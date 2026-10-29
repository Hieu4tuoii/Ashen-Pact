import { scaleBlessingDamage } from '../data/blessings.js';
import { WEAPONS } from '../data/weapons.js';
import { angleDiff, clamp, distance } from '../math/vec2.js';
import { SHOT_FLAG, TILE_SIZE } from '../protocol/messages.js';
import { findNearestWalkablePoint } from './arena-room-archetypes.js';
import { tickPlayerBulletModBlessingTimers } from './sim-blessings-bullet-skills.js';
import {
  stepP4APlayerBlessingTimers,
  triggerP4ADashStartBlessings,
} from './sim-blessings-p4a.js';
import {
  clearEnemyProjectilesAroundProp,
  triggerEnemyWallSlam,
} from './sim-tactical-physics.js';
import {
  DASH_COOLDOWN_SEC,
  hasPlayerBlessing,
  type SimEnemyState,
  type SimPlayerState,
  type SimPropState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-8) return distance(px, py, x1, y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

export const DASH_TIDAL_RAM_BASE_DMG = 20;
export const DASH_TIDAL_RAM_KB = 280;
export const DASH_TIDAL_RAM_REFUND_RATIO = 0.6;
export const DASH_TIDAL_RAM_ICD_SEC = 1.2;

export const DASH_VENOM_WAKE_DURATION_SEC = 3.5;
export const DASH_VENOM_WAKE_AMMO_REFUND_RATIO = 0.5;
export const DASH_VENOM_WAKE_HEAT_VENT = 40;

export const DASH_FLAME_SHACKLE_RADIUS = 88;
export const DASH_FLAME_SHACKLE_BASE_DMG = 24;

export const DASH_RELOAD_ACROBAT_ADVANCE_RATIO = 0.4;
export const DASH_RELOAD_ACROBAT_HEAT_THRESHOLD = 50;
export const DASH_RELOAD_ACROBAT_HEAT_COOL = 35;
export const ACROBAT_RELOAD_WINDOW_MIN = 0.35;
export const ACROBAT_RELOAD_WINDOW_MAX = 0.8;
export const ACROBAT_VENT_ORANGE_MIN = 55;
export const ACROBAT_VENT_ORANGE_MAX = 95;

export const RELOAD_BLESSING_GUN_ICD_SEC = 1.5;
export const RELOAD_BLESSING_MELEE_ICD_SEC = 2.0;

export const RELOAD_TEDIORE_CHUCK_BASE_DMG = 18;
export const RELOAD_TEDIORE_CHUCK_PER_SHOT_DMG = 4;
export const RELOAD_TEDIORE_CHUCK_SPEED = 520;
export const RELOAD_TEDIORE_CHUCK_BLAST_RADIUS = 76;

export const RELOAD_FROST_NOVA_RADIUS = 110;
export const RELOAD_FROST_NOVA_BASE_DMG = 22;

export const RELOAD_MAGNET_VORTEX_ANCHOR_DIST = 140;
export const RELOAD_MAGNET_VORTEX_RADIUS = 135;
export const RELOAD_MAGNET_VORTEX_DURATION_SEC = 0.8;
export const RELOAD_MAGNET_VORTEX_BASE_DMG = 16;

export const RELOAD_REPULSOR_CONE_DEG = 140;
export const RELOAD_REPULSOR_HALF_ARC_RAD = ((RELOAD_REPULSOR_CONE_DEG * 0.5) * Math.PI) / 180;
export const RELOAD_REPULSOR_RADIUS = 165;
export const RELOAD_REPULSOR_BASE_DMG = 20;
export const RELOAD_REPULSOR_KB = 280;

export type ReloadVentFinisherTriggerKind = 'perfect_reload' | 'tactical_vent' | 'melee_finisher';

export interface ReloadVentFinisherOptions {
  shotsFired?: number;
  hitAny?: boolean;
  bulletsDestroyed?: number;
}

export function tickPlayerDashAndReloadBlessingTimers(p: SimPlayerState, dtSec: number): void {
  tickPlayerBulletModBlessingTimers(p, dtSec);
  stepP4APlayerBlessingTimers(p, dtSec);
  if ((p.dashTidalRamIcdTimer ?? 0) > 0) {
    const next = (p.dashTidalRamIcdTimer ?? 0) - dtSec;
    p.dashTidalRamIcdTimer = next <= 1e-6 ? 0 : next;
  }
  if ((p.reloadBlessingIcdTimer ?? 0) > 0) {
    const next = (p.reloadBlessingIcdTimer ?? 0) - dtSec;
    p.reloadBlessingIcdTimer = next <= 1e-6 ? 0 : next;
  }
}

export function triggerDashReloadAcrobatOnDash(p: SimPlayerState): boolean {
  if (!hasPlayerBlessing(p, 'dash_reload_acrobat')) return false;
  let triggered = false;
  if (p.reloadTimer > 0 && p.reloadDuration > 0) {
    p.reloadTimer = Math.max(
      0.05,
      p.reloadTimer - DASH_RELOAD_ACROBAT_ADVANCE_RATIO * p.reloadDuration,
    );
    p.acrobatExpandedWindow = true;
    triggered = true;
  }
  if (p.weaponHeat >= DASH_RELOAD_ACROBAT_HEAT_THRESHOLD) {
    p.weaponHeat = Math.max(0, p.weaponHeat - DASH_RELOAD_ACROBAT_HEAT_COOL);
    const slot = p.activeWeaponSlot ?? 0;
    if (Array.isArray(p.weaponSlotHeat)) {
      p.weaponSlotHeat[slot] = p.weaponHeat;
    }
    p.acrobatExpandedWindow = true;
    triggered = true;
  }
  return triggered;
}

export function onPlayerDashStarted(sim: WorldSim, p: SimPlayerState): void {
  p.dashHitEnemyIds = [];
  p.dashVenomWakeTriggeredThisDash = false;
  p.dashFlameShackleEnemyIds = [];
  triggerDashReloadAcrobatOnDash(p);
  if (hasPlayerBlessing(p, 'dash_venom_wake')) {
    layPoisonSwampAtWorldPoint(sim, p.x, p.y);
  }
  triggerP4ADashStartBlessings(sim, p, p.x, p.y);
}

export function onPlayerDashStep(
  sim: WorldSim,
  p: SimPlayerState,
  prevX: number,
  prevY: number,
): void {
  if (hasPlayerBlessing(p, 'dash_tidal_ram')) {
    triggerDashTidalRamStep(sim, p, prevX, prevY);
  }
  if (hasPlayerBlessing(p, 'dash_venom_wake')) {
    triggerDashVenomWakeStep(sim, p, prevX, prevY);
  }
  if (hasPlayerBlessing(p, 'dash_flame_shackle')) {
    triggerDashFlameShackle(sim, p, prevX, prevY);
  }
}

export function triggerDashTidalRamStep(
  sim: WorldSim,
  p: SimPlayerState,
  prevX: number,
  prevY: number,
): number {
  if (!hasPlayerBlessing(p, 'dash_tidal_ram')) return 0;
  if (!Array.isArray(p.dashHitEnemyIds)) {
    p.dashHitEnemyIds = [];
  }
  const dashDirX = p.dashDirX || Math.cos(p.aimAngle);
  const dashDirY = p.dashDirY || Math.sin(p.aimAngle);
  const dashAng = Math.atan2(dashDirY, dashDirX);
  const ramDmg = scaleBlessingDamage(DASH_TIDAL_RAM_BASE_DMG, sim.currentFloor);
  const lookAheadX = p.x + dashDirX * 22;
  const lookAheadY = p.y + dashDirY * 22;

  let hitCount = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed || e.isBoss) {
      continue;
    }

    if (p.dashHitEnemyIds.includes(e.id)) {
      // Sustain tidal wave push along dash path until enemy hits a wall
      if ((e.wallSlamCooldownTimer ?? 0) <= 0) {
        e.kbVx = dashDirX * DASH_TIDAL_RAM_KB;
        e.kbVy = dashDirY * DASH_TIDAL_RAM_KB;
        e.lastHitPlayerId = p.id;
        const carryX = e.x + dashDirX * 10;
        const carryY = e.y + dashDirY * 10;
        const col = sim.map.resolveCircleCollision(carryX, carryY, e.radius, true);
        if (!col.collided) {
          e.x = col.x;
          e.y = col.y;
        }
      }
      continue;
    }

    const segDist = Math.min(
      pointToSegmentDist(e.x, e.y, prevX, prevY, p.x, p.y),
      pointToSegmentDist(e.x, e.y, p.x, p.y, lookAheadX, lookAheadY),
    );
    if (segDist <= p.radius + e.radius + 14) {
      p.dashHitEnemyIds.push(e.id);
      e.tidalRamByPlayerId = p.id;
      e.tidalRamTimer = 1.0;
      e.lastHitPlayerId = p.id;
      sim.applyDamageToEnemy(e, ramDmg, false, 'chill', dashAng, DASH_TIDAL_RAM_KB, true, p.id);
      if (e.hp > 0) {
        e.kbVx = dashDirX * DASH_TIDAL_RAM_KB;
        e.kbVy = dashDirY * DASH_TIDAL_RAM_KB;
      }
      hitCount += 1;
    }
  }
  return hitCount;
}

export function onEnemyWallSlamDashBlessings(
  _sim: WorldSim,
  attacker: SimPlayerState,
  e: SimEnemyState,
): boolean {
  if (!hasPlayerBlessing(attacker, 'dash_tidal_ram')) return false;
  if ((attacker.dashTidalRamIcdTimer ?? 0) > 0) return false;
  const rammedByAttacker =
    e.isBoss ||
    e.tidalRamByPlayerId === attacker.id ||
    Boolean(attacker.dashHitEnemyIds && attacker.dashHitEnemyIds.includes(e.id));
  if (!rammedByAttacker) return false;

  attacker.dashCooldownTimer = Math.max(
    0,
    attacker.dashCooldownTimer - DASH_COOLDOWN_SEC * DASH_TIDAL_RAM_REFUND_RATIO,
  );
  attacker.dashTidalRamIcdTimer = DASH_TIDAL_RAM_ICD_SEC;
  e.tidalRamByPlayerId = 0;
  e.tidalRamTimer = 0;
  return true;
}

function layPoisonSwampAtWorldPoint(sim: WorldSim, x: number, y: number): void {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  sim.map.setSurface(tx, ty, 'poison_swamp', DASH_VENOM_WAKE_DURATION_SEC, false);
}

export function triggerDashVenomWakeCadenceRefund(p: SimPlayerState): boolean {
  if (!hasPlayerBlessing(p, 'dash_venom_wake')) return false;
  if (p.dashVenomWakeTriggeredThisDash) return false;
  p.dashVenomWakeTriggeredThisDash = true;

  const slot = p.activeWeaponSlot ?? 0;
  const activeWepId = p.weaponSlots[slot] ?? p.weaponSlots[0] ?? 'knight_sword';
  const wep = WEAPONS[activeWepId];
  const clipMax = p.clipMax > 0 ? p.clipMax : (wep?.clipSize ?? 0);

  if (clipMax > 0) {
    const addAmmo = Math.max(1, Math.ceil(clipMax * DASH_VENOM_WAKE_AMMO_REFUND_RATIO));
    p.clipAmmo = Math.min(clipMax, p.clipAmmo + addAmmo);
    if (Array.isArray(p.weaponSlotClipAmmo)) {
      p.weaponSlotClipAmmo[slot] = p.clipAmmo;
    }
    if (p.clipAmmo >= clipMax) {
      p.reloadTimer = 0;
      p.reloadLockout = false;
    }
  }

  if (p.weaponHeat > 0 || wep?.cadenceKind === 'HEAT_VENT') {
    p.weaponHeat = Math.max(0, p.weaponHeat - DASH_VENOM_WAKE_HEAT_VENT);
    if (Array.isArray(p.weaponSlotHeat)) {
      p.weaponSlotHeat[slot] = p.weaponHeat;
    }
  }
  return true;
}

export function onPlayerDashKickProp(_sim: WorldSim, p: SimPlayerState): boolean {
  if (p.dashTimer <= 0 || !hasPlayerBlessing(p, 'dash_venom_wake')) return false;
  return triggerDashVenomWakeCadenceRefund(p);
}

export function triggerDashVenomWakeStep(
  sim: WorldSim,
  p: SimPlayerState,
  prevX: number,
  prevY: number,
): void {
  if (!hasPlayerBlessing(p, 'dash_venom_wake')) return;
  layPoisonSwampAtWorldPoint(sim, prevX, prevY);
  layPoisonSwampAtWorldPoint(sim, (prevX + p.x) * 0.5, (prevY + p.y) * 0.5);
  layPoisonSwampAtWorldPoint(sim, p.x, p.y);

  const dashDirX = p.dashDirX || Math.cos(p.aimAngle);
  const dashDirY = p.dashDirY || Math.sin(p.aimAngle);
  const lookAheadX = p.x + dashDirX * 20;
  const lookAheadY = p.y + dashDirY * 20;

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) continue;
    const segDist = Math.min(
      pointToSegmentDist(e.x, e.y, prevX, prevY, p.x, p.y),
      pointToSegmentDist(e.x, e.y, p.x, p.y, lookAheadX, lookAheadY),
    );
    if (segDist <= p.radius + e.radius + 16) {
      e.poisonTimer = Math.max(e.poisonTimer, 4.0);
      sim.applyElementStatusToEnemy(e, 'poison', 8, p.id);
      triggerDashVenomWakeCadenceRefund(p);
    }
  }
}

function findNearestObstacleForFlameShackle(
  sim: WorldSim,
  e: SimEnemyState,
): { x: number; y: number; prop?: SimPropState } | null {
  let bestX = 0;
  let bestY = 0;
  let bestDist = Infinity;
  let bestProp: SimPropState | undefined;

  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0) continue;
    if (prop.coverState !== 'flipped' && !prop.blocksMovement) continue;
    const d = distance(e.x, e.y, prop.x, prop.y) - prop.radius;
    if (d < bestDist) {
      bestDist = d;
      bestX = prop.x;
      bestY = prop.y;
      bestProp = prop;
    }
  }

  const centerTx = Math.floor(e.x / TILE_SIZE);
  const centerTy = Math.floor(e.y / TILE_SIZE);
  const searchRadiusTiles = 8;
  for (let ty = centerTy - searchRadiusTiles; ty <= centerTy + searchRadiusTiles; ty++) {
    for (let tx = centerTx - searchRadiusTiles; tx <= centerTx + searchRadiusTiles; tx++) {
      if (tx < 0 || ty < 0 || tx >= sim.map.cols || ty >= sim.map.rows) continue;
      const tile = sim.map.getTile(tx, ty);
      if (tile !== 'wall' && tile !== 'pillar') continue;
      const tileMinX = tx * TILE_SIZE;
      const tileMaxX = tileMinX + TILE_SIZE;
      const tileMinY = ty * TILE_SIZE;
      const tileMaxY = tileMinY + TILE_SIZE;
      const clampedX = clamp(e.x, tileMinX, tileMaxX);
      const clampedY = clamp(e.y, tileMinY, tileMaxY);
      const d = distance(e.x, e.y, clampedX, clampedY);
      if (d < bestDist) {
        bestDist = d;
        bestX = (tx + 0.5) * TILE_SIZE;
        bestY = (ty + 0.5) * TILE_SIZE;
        bestProp = undefined;
      }
    }
  }

  if (!Number.isFinite(bestDist)) return null;
  return { x: bestX, y: bestY, prop: bestProp };
}

export function triggerDashFlameShackle(
  sim: WorldSim,
  p: SimPlayerState,
  prevX = p.x,
  prevY = p.y,
): boolean {
  if (!hasPlayerBlessing(p, 'dash_flame_shackle')) return false;
  if (!Array.isArray(p.dashFlameShackleEnemyIds)) {
    p.dashFlameShackleEnemyIds = [];
  }
  if (p.dashFlameShackleEnemyIds.length > 0) return false;

  let nearestEnemy: SimEnemyState | null = null;
  let nearestDist = Infinity;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) continue;
    const d = Math.min(
      distance(p.x, p.y, e.x, e.y),
      pointToSegmentDist(e.x, e.y, prevX, prevY, p.x, p.y),
    );
    if (d <= DASH_FLAME_SHACKLE_RADIUS + e.radius && d < nearestDist) {
      nearestDist = d;
      nearestEnemy = e;
    }
  }
  if (!nearestEnemy) return false;

  const obstacle = findNearestObstacleForFlameShackle(sim, nearestEnemy);
  if (!obstacle) return false;

  p.dashFlameShackleEnemyIds.push(nearestEnemy.id);
  const yankAngle = Math.atan2(obstacle.y - nearestEnemy.y, obstacle.x - nearestEnemy.x);
  const fireDmg = scaleBlessingDamage(DASH_FLAME_SHACKLE_BASE_DMG, sim.currentFloor);

  nearestEnemy.lastHitPlayerId = p.id;
  sim.applyDamageToEnemy(nearestEnemy, fireDmg, false, 'burn', yankAngle, 300, true, p.id);
  if (nearestEnemy.hp > 0) {
    nearestEnemy.burnTimer = Math.max(nearestEnemy.burnTimer, 3.0);
    sim.applyElementStatusToEnemy(nearestEnemy, 'burn', fireDmg, p.id);
  }
  if (nearestEnemy.hp <= 0) return true;

  const targetX = obstacle.x - Math.cos(yankAngle) * (nearestEnemy.radius + 2);
  const targetY = obstacle.y - Math.sin(yankAngle) * (nearestEnemy.radius + 2);
  const col = sim.map.resolveCircleCollision(targetX, targetY, nearestEnemy.radius, true);
  nearestEnemy.x = col.x;
  nearestEnemy.y = col.y;
  nearestEnemy.kbVx = Math.cos(yankAngle) * 300;
  nearestEnemy.kbVy = Math.sin(yankAngle) * 300;
  nearestEnemy.wallSlamCooldownTimer = 0;
  triggerEnemyWallSlam(sim, nearestEnemy, obstacle.prop, 300);
  return true;
}

function hasAnyReloadVentFinisherBlessing(p: SimPlayerState): boolean {
  return (
    hasPlayerBlessing(p, 'reload_tediore_chuck') ||
    hasPlayerBlessing(p, 'reload_frost_nova') ||
    hasPlayerBlessing(p, 'reload_magnet_vortex') ||
    hasPlayerBlessing(p, 'reload_repulsor_shock')
  );
}

function isEnemyStatusAfflicted(e: SimEnemyState): boolean {
  return (
    e.burnTimer > 0 ||
    e.chillTimer > 0 ||
    e.chillStacks > 0 ||
    e.frozenTimer > 0 ||
    e.poisonTimer > 0 ||
    e.shockTimer > 0 ||
    e.markedTimer > 0 ||
    e.superconductTimer > 0 ||
    e.rootedTimer > 0 ||
    e.steamBlindTimer > 0
  );
}

export function triggerReloadVentOrFinisherBlessings(
  sim: WorldSim,
  p: SimPlayerState,
  triggerKind: ReloadVentFinisherTriggerKind,
  options?: ReloadVentFinisherOptions,
): boolean {
  // STRICT HARD PROHIBITION: 3rd Melee Combo swing into empty air MUST NOT trigger Group 3!
  if (triggerKind === 'melee_finisher') {
    const hitAny = Boolean(options?.hitAny);
    const bulletsDestroyed = options?.bulletsDestroyed ?? 0;
    if (!hitAny && bulletsDestroyed <= 0) {
      return false;
    }
  }

  if (!hasAnyReloadVentFinisherBlessing(p)) return false;
  if ((p.reloadBlessingIcdTimer ?? 0) > 0) return false;

  p.reloadBlessingIcdTimer =
    triggerKind === 'melee_finisher'
      ? RELOAD_BLESSING_MELEE_ICD_SEC
      : RELOAD_BLESSING_GUN_ICD_SEC;

  const shotsFired =
    typeof options?.shotsFired === 'number' && options.shotsFired > 0
      ? options.shotsFired
      : triggerKind === 'melee_finisher'
        ? 4
        : triggerKind === 'tactical_vent'
          ? Math.max(1, Math.round((p.weaponHeat || 75) / 15))
          : Math.max(1, p.clipMax > p.clipAmmo ? p.clipMax - p.clipAmmo : p.clipMax || 6);

  if (hasPlayerBlessing(p, 'reload_tediore_chuck')) {
    const chuckDmg = scaleBlessingDamage(
      RELOAD_TEDIORE_CHUCK_BASE_DMG + RELOAD_TEDIORE_CHUCK_PER_SHOT_DMG * shotsFired,
      sim.currentFloor,
    );
    const spawnX = p.x + Math.cos(p.aimAngle) * 6;
    const spawnY = p.y + Math.sin(p.aimAngle) * 6;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      eventId: sim.nextVolleyEventId++,
      ownerId: p.id,
      team: 'player',
      weaponId: 'reload_tediore_chuck',
      x: spawnX,
      y: spawnY,
      angle: p.aimAngle,
      pelletCount: 1,
      spreadRad: 0,
      speed: RELOAD_TEDIORE_CHUCK_SPEED,
      damage: chuckDmg,
      radius: 6,
      knockback: 180,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 0.9,
      element: 'burn',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      shotFlags: SHOT_FLAG.FINALE_SHOT,
      flags: SHOT_FLAG.FINALE_SHOT,
      explosionRadius: RELOAD_TEDIORE_CHUCK_BLAST_RADIUS,
      guaranteedElementalProc: true,
      originX: p.x,
      originY: p.y,
    });
  }

  if (hasPlayerBlessing(p, 'reload_frost_nova')) {
    clearEnemyProjectilesAroundProp(sim, p.x, p.y, RELOAD_FROST_NOVA_RADIUS);
    sim.map.freezeSurfaceInRadius(p.x, p.y, RELOAD_FROST_NOVA_RADIUS);
    const novaDmg = scaleBlessingDamage(RELOAD_FROST_NOVA_BASE_DMG, sim.currentFloor);
    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) continue;
      const d = distance(p.x, p.y, e.x, e.y);
      if (d <= RELOAD_FROST_NOVA_RADIUS + e.radius) {
        const hitAng = d > 1e-4 ? Math.atan2(e.y - p.y, e.x - p.x) : p.aimAngle;
        sim.applyDamageToEnemy(e, novaDmg, false, 'chill', hitAng, 140, false, p.id);
        if (e.hp > 0) {
          sim.applyElementStatusToEnemy(e, 'chill', novaDmg, p.id);
        }
      }
    }
  }

  if (hasPlayerBlessing(p, 'reload_magnet_vortex')) {
    const rawAnchorX = p.x + Math.cos(p.aimAngle) * RELOAD_MAGNET_VORTEX_ANCHOR_DIST;
    const rawAnchorY = p.y + Math.sin(p.aimAngle) * RELOAD_MAGNET_VORTEX_ANCHOR_DIST;
    const safePt = findNearestWalkablePoint(sim.map, rawAnchorX, rawAnchorY, 10);
    const anchorX = safePt.x;
    const anchorY = safePt.y;
    const vortexDmg = scaleBlessingDamage(RELOAD_MAGNET_VORTEX_BASE_DMG, sim.currentFloor);

    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) continue;
      const d = distance(anchorX, anchorY, e.x, e.y);
      if (d <= RELOAD_MAGNET_VORTEX_RADIUS + e.radius) {
        const pullAng = d > 1e-4 ? Math.atan2(anchorY - e.y, anchorX - e.x) : p.aimAngle;
        sim.applyDamageToEnemy(e, vortexDmg, false, 'shock', pullAng, 0, false, p.id);
        if (e.hp > 0 && d > 12) {
          const pullStep = Math.min(d - 10, e.isBoss ? 14 : 26);
          const col = sim.map.resolveCircleCollision(
            e.x + Math.cos(pullAng) * pullStep,
            e.y + Math.sin(pullAng) * pullStep,
            e.radius,
          );
          e.x = col.x;
          e.y = col.y;
        }
      }
    }

    sim.skillZones.push({
      id: sim.nextEntityId++,
      ownerPlayerId: p.id,
      x: anchorX,
      y: anchorY,
      radius: RELOAD_MAGNET_VORTEX_RADIUS,
      ttlSec: RELOAD_MAGNET_VORTEX_DURATION_SEC,
      maxTtlSec: RELOAD_MAGNET_VORTEX_DURATION_SEC,
      tickTimer: 99,
      element: 'shock',
      secondaryElement: 'none',
      vortex: true,
    });
  }

  if (hasPlayerBlessing(p, 'reload_repulsor_shock')) {
    const repulsorDmg = scaleBlessingDamage(RELOAD_REPULSOR_BASE_DMG, sim.currentFloor);
    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) continue;
      const d = distance(p.x, p.y, e.x, e.y);
      if (d > RELOAD_REPULSOR_RADIUS + e.radius) continue;
      const angToEnemy = d > 1e-4 ? Math.atan2(e.y - p.y, e.x - p.x) : p.aimAngle;
      if (
        d > p.radius + e.radius + 8 &&
        Math.abs(angleDiff(angToEnemy, p.aimAngle)) > RELOAD_REPULSOR_HALF_ARC_RAD
      ) {
        continue;
      }

      const wasAfflicted = isEnemyStatusAfflicted(e);
      const kbSpeed = wasAfflicted ? 320 : RELOAD_REPULSOR_KB;
      e.lastHitPlayerId = p.id;
      sim.applyDamageToEnemy(e, repulsorDmg, false, 'none', angToEnemy, kbSpeed, true, p.id);
      if (e.hp > 0 && !e.isBoss) {
        e.kbVx = Math.cos(angToEnemy) * kbSpeed;
        e.kbVy = Math.sin(angToEnemy) * kbSpeed;
        if (wasAfflicted) {
          const shoveX = e.x + Math.cos(angToEnemy) * 16;
          const shoveY = e.y + Math.sin(angToEnemy) * 16;
          const col = sim.map.resolveCircleCollision(shoveX, shoveY, e.radius, true);
          e.x = col.x;
          e.y = col.y;
          if (col.collided) {
            triggerEnemyWallSlam(sim, e, undefined, kbSpeed);
          }
        }
      }
    }
  }

  return true;
}
