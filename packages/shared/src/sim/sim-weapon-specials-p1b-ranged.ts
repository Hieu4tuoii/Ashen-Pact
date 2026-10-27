import type { ElementType } from '../data/types.js';
import { angleDiff, clamp, distance } from '../math/vec2.js';
import { INPUT_BUTTON, TILE_SIZE } from '../protocol/messages.js';
import {
   resolveEnemyChasmRingOut,
  triggerGrassPollenSpeedBoost,
} from './sim-tactical-physics.js';
import { pointToSegmentDist } from './sim-weapon-specials-rare.js';
import type {
  SimEnemyState,
  SimPlayerState,
  SimProjectileState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const FOCUS_LASER_RANGE = 520;
export const FOCUS_LASER_REFRACT_RANGE = 360;
export const FOCUS_LASER_REFRACT_SPREAD_RAD = 0.32;
export const FOCUS_LASER_MIN_DMG = 4;
export const FOCUS_LASER_MAX_DMG = 11;
export const FOCUS_LASER_MIN_WIDTH = 6;
export const FOCUS_LASER_MAX_WIDTH = 16;
export const FOCUS_LASER_RAILGUN_DMG = 46;
export const FOCUS_LASER_RAILGUN_KB = 240;
export const FOCUS_LASER_RAILGUN_WIDTH = 28;
export const FOCUS_LASER_VENT_CLEAR_RADIUS = 56;

export const VOID_STAFF_SPEED = 320;
export const VOID_STAFF_RANGE = 360;
export const VOID_STAFF_PULL_RADIUS = 110;
export const VOID_STAFF_PULSE_INTERVAL_SEC = 0.2;
export const VOID_STAFF_PULSE_INTERVAL_TICKS = 12;
export const VOID_STAFF_PULSE_DMG = 12;
export const VOID_STAFF_PULL_SPEED = 90;
export const VOID_STAFF_MAX_SWALLOWED_BULLETS = 6;
export const VOID_STAFF_IMPLOSION_BASE_DMG = 52;
export const VOID_STAFF_BONUS_DMG_PER_BULLET = 6;
export const VOID_STAFF_IMPLOSION_PULL_DIST = 42;

const _laserHitEnemyIds = new Set<number>();

export function computeFocusLaserTickDamage(heat: number): number {
  return Math.round(
    FOCUS_LASER_MIN_DMG +
      (FOCUS_LASER_MAX_DMG - FOCUS_LASER_MIN_DMG) * clamp(heat / 95, 0, 1),
  );
}

export function computeFocusLaserBeamWidth(heat: number): number {
  return (
    FOCUS_LASER_MIN_WIDTH +
    (FOCUS_LASER_MAX_WIDTH - FOCUS_LASER_MIN_WIDTH) * clamp(heat / 95, 0, 1)
  );
}

function raycastSolidArenaWall(
  sim: WorldSim,
  startX: number,
  startY: number,
  angle: number,
  maxRange: number,
): { endX: number; endY: number; length: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const step = 4;
  let lastX = startX;
  let lastY = startY;
  let lastDist = 0;

  for (let d = step; d <= maxRange; d += step) {
    const cx = startX + cos * d;
    const cy = startY + sin * d;
    const tx = Math.floor(cx / TILE_SIZE);
    const ty = Math.floor(cy / TILE_SIZE);
    if (sim.map.isSolidTile(tx, ty)) {
      if (sim.map.getTile(tx, ty) === 'cracked_wall') {
        if (sim.map.destroyCrackedWall(tx, ty)) {
          sim.secretWallBroken = true;
          sim.rebuildCurrentRoomDoors();
          sim.events.push({
            kind: 'cracked_wall_broken',
            tx,
            ty,
            x: tx * TILE_SIZE + 16,
            y: ty * TILE_SIZE + 16,
          });
        }
      }
      return { endX: lastX, endY: lastY, length: lastDist };
    }
    lastX = cx;
    lastY = cy;
    lastDist = d;
  }

  return {
    endX: startX + cos * maxRange,
    endY: startY + sin * maxRange,
    length: maxRange,
  };
}

function findLaserRefractionPoint(
  sim: WorldSim,
  p: SimPlayerState,
  startX: number,
  startY: number,
  wallEndX: number,
  wallEndY: number,
  beamRadius: number,
): { refracted: boolean; x: number; y: number } {
  const cos = Math.cos(p.aimAngle);
  const sin = Math.sin(p.aimAngle);
  let bestDist = Infinity;
  let refractX = 0;
  let refractY = 0;

  // 1. Check cryo_prism_pillar props along the primary beam segment
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0 || prop.kind !== 'cryo_prism_pillar') continue;
    const dx = prop.x - startX;
    const dy = prop.y - startY;
    const proj = dx * cos + dy * sin;
    if (proj <= 0) continue;
    const segDist = pointToSegmentDist(prop.x, prop.y, startX, startY, wallEndX, wallEndY);
    if (segDist <= prop.radius + beamRadius + 6 && proj < bestDist) {
      bestDist = proj;
      refractX = prop.x;
      refractY = prop.y;
      prop.hitFlashTimer = Math.max(prop.hitFlashTimer, 0.16);
    }
  }

  // 2. Check active Vanguard shields (ally or self)
  const allPlayers = sim.getAllPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const pl = allPlayers[i]!;
    if (pl.lifeState !== 'alive' || pl.characterId !== 'vanguard' || pl.skillActiveTimer <= 0) {
      continue;
    }
    if (pl.id === p.id) {
      const selfShieldDist = 24;
      if (selfShieldDist < bestDist) {
        bestDist = selfShieldDist;
        refractX = startX + cos * selfShieldDist;
        refractY = startY + sin * selfShieldDist;
      }
    } else {
      const dx = pl.x - startX;
      const dy = pl.y - startY;
      const proj = dx * cos + dy * sin;
      if (proj <= 0) continue;
      const segDist = pointToSegmentDist(pl.x, pl.y, startX, startY, wallEndX, wallEndY);
      const halfShieldArc = pl.blessingIds.includes('vanguard_bastion_prism')
        ? Math.PI
        : (65 * Math.PI) / 180;
      if (
        segDist <= 38 + beamRadius &&
        Math.abs(angleDiff(p.aimAngle, pl.aimAngle)) <= halfShieldArc + 0.5 &&
        proj < bestDist
      ) {
        bestDist = proj;
        refractX = pl.x;
        refractY = pl.y;
      }
    }
  }

  if (bestDist < Infinity) {
    return { refracted: true, x: refractX, y: refractY };
  }
  return { refracted: false, x: wallEndX, y: wallEndY };
}

function applyLaserSegmentHits(
  sim: WorldSim,
  p: SimPlayerState,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rayAngle: number,
  beamHalfWidth: number,
  damage: number,
  critChance: number,
  element: ElementType,
  knockback: number,
  isHeavy: boolean,
): number {
  let hitCount = 0;

  if (!sim.stressTestActive) {
    for (let i = 0; i < sim.props.length; i++) {
      const prop = sim.props[i]!;
      if (
        !prop.destructible ||
        prop.hp <= 0 ||
        prop.coverState === 'sliding' ||
        prop.blocksEnemyProjectiles ||
        prop.kind === 'cryo_prism_pillar'
      ) {
        continue;
      }
      if (pointToSegmentDist(prop.x, prop.y, x1, y1, x2, y2) <= prop.radius + beamHalfWidth) {
        prop.fallAngle = rayAngle;
        sim.damageProp(prop, damage, element);
      }
    }
  }

  let effectiveDamage = damage;
  if (sim.skillZones.length > 0) {
    for (let zIdx = 0; zIdx < sim.skillZones.length; zIdx++) {
      const z = sim.skillZones[zIdx]!;
      if (z.ttlSec <= 0) continue;
      if (pointToSegmentDist(z.x, z.y, x1, y1, x2, y2) <= z.radius + beamHalfWidth) {
        effectiveDamage = Math.round(effectiveDamage * 1.15);
        break;
      }
    }
  }

  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (
      enemy.hp <= 0 ||
      enemy.aiState === 'spawning' ||
      enemy.bossBurrowed ||
      _laserHitEnemyIds.has(enemy.id)
    ) {
      continue;
    }
    if (pointToSegmentDist(enemy.x, enemy.y, x1, y1, x2, y2) <= enemy.radius + beamHalfWidth) {
      _laserHitEnemyIds.add(enemy.id);
      hitCount += 1;
      const isCrit = critChance >= 1 ? true : critChance > 0 ? sim.rng.chance(critChance) : false;
      const finalDmg = isCrit ? Math.round(effectiveDamage * 1.5) : effectiveDamage;
      sim.applyDamageToEnemy(
        enemy,
        finalDmg,
        isCrit,
        element,
        rayAngle,
        knockback,
        isHeavy,
        p.id,
        false,
      );
    }
  }

  return hitCount;
}

/**
 * Focus Laser (Súng Tia Hội Tụ — Rare, HEAT_VENT):
 * Fires a continuous 520px Hitscan Laser Beam stopped by solid arena walls.
 * Scales damage linearly from 4 (0% heat) to 11 (95%+ heat) and increases beam width.
 * Refracts into 3 fan beams (0, -0.32, +0.32 rad, 360px range) on cryo_prism_pillar or active Vanguard shield.
 */
export function fireFocusLaserHitscanBeam(
  sim: WorldSim,
  p: SimPlayerState,
  heatBeforeShot: number,
  critChance: number,
  shotElement: ElementType = 'burn',
  additiveDmgBonus = 0,
): number {
  const baseTickDmg = computeFocusLaserTickDamage(heatBeforeShot);
  const tickDmg = Math.max(1, Math.round(baseTickDmg * (1 + additiveDmgBonus)));
  const beamWidth = computeFocusLaserBeamWidth(heatBeforeShot);
  const beamHalfWidth = Math.max(4, beamWidth * 0.5);
  const elem: ElementType = shotElement !== 'none' ? shotElement : 'burn';

  const startX = p.x;
  const startY = p.y;
  const primaryWallRay = raycastSolidArenaWall(
    sim,
    startX,
    startY,
    p.aimAngle,
    FOCUS_LASER_RANGE,
  );

  const refraction = findLaserRefractionPoint(
    sim,
    p,
    startX,
    startY,
    primaryWallRay.endX,
    primaryWallRay.endY,
    beamHalfWidth,
  );

  _laserHitEnemyIds.clear();
  let totalHits = applyLaserSegmentHits(
    sim,
    p,
    startX,
    startY,
    refraction.x,
    refraction.y,
    p.aimAngle,
    beamHalfWidth,
    tickDmg,
    critChance,
    elem,
    50,
    false,
  );

  let refractedRays:
    | Array<{ x1: number; y1: number; x2: number; y2: number; angle: number }>
    | undefined;

  if (refraction.refracted) {
    refractedRays = [];
    const offsets = [0, -FOCUS_LASER_REFRACT_SPREAD_RAD, FOCUS_LASER_REFRACT_SPREAD_RAD];
    for (let rIdx = 0; rIdx < offsets.length; rIdx++) {
      const fanAngle = p.aimAngle + offsets[rIdx]!;
      const fanRay = raycastSolidArenaWall(
        sim,
        refraction.x,
        refraction.y,
        fanAngle,
        FOCUS_LASER_REFRACT_RANGE,
      );
      refractedRays.push({
        x1: refraction.x,
        y1: refraction.y,
        x2: fanRay.endX,
        y2: fanRay.endY,
        angle: fanAngle,
      });
      totalHits += applyLaserSegmentHits(
        sim,
        p,
        refraction.x,
        refraction.y,
        fanRay.endX,
        fanRay.endY,
        fanAngle,
        beamHalfWidth,
        tickDmg,
        critChance,
        elem,
        50,
        false,
      );
    }
  }

  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'focus_laser_beam',
      playerId: p.id,
      x1: startX,
      y1: startY,
      x2: refraction.x,
      y2: refraction.y,
      angle: p.aimAngle,
      width: beamWidth,
      damage: tickDmg,
      heat: heatBeforeShot,
      refractedRays,
    });
  }

  _laserHitEnemyIds.clear();
  return totalHits;
}

/**
 * Focus Laser Tactical Vent [R] (65%–95% Orange Heat):
 * Resets weaponHeat to 0, sets ventCooldownTimer = 0.25, clears nearby enemy bullets (r = 56px),
 * and fires an instant 520px full-room piercing Railgun Beam (width = 28px, 46 Fire DMG, kb = 240, applies burn).
 */
export function triggerFocusLaserRailgunVent(
  sim: WorldSim,
  pOrPlayerId: SimPlayerState | number,
): number {
  const p =
    typeof pOrPlayerId === 'number'
      ? (sim.getPlayerById(pOrPlayerId) ?? sim.player)
      : pOrPlayerId;
  const slot = p.activeWeaponSlot ?? 0;

  p.weaponHeat = 0;
  if (Array.isArray(p.weaponSlotHeat)) {
    p.weaponSlotHeat[slot] = 0;
  }
  p.ventCooldownTimer = 0.25;
  p.fireCooldownTimer = Math.max(p.fireCooldownTimer, 0.25);
  triggerGrassPollenSpeedBoost(sim, p);

  // 1. Clear nearby enemy bullets within r = 56px
  const destroyedIds: number[] = [];
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
    if (distance(p.x, p.y, b.x, b.y) <= FOCUS_LASER_VENT_CLEAR_RADIUS + b.radius) {
      b.ttlSec = 0;
      destroyedIds.push(b.id);
    }
  }
  if (destroyedIds.length > 0) {
    sim.recordDestroyedProjectiles(destroyedIds);
  }

  // 2. Fire 520px full-room piercing Railgun Beam along p.aimAngle (width = 28px -> halfWidth = 14px)
  const x1 = p.x;
  const y1 = p.y;
  const x2 = x1 + Math.cos(p.aimAngle) * FOCUS_LASER_RANGE;
  const y2 = y1 + Math.sin(p.aimAngle) * FOCUS_LASER_RANGE;
  const railgunHalfWidth = FOCUS_LASER_RAILGUN_WIDTH * 0.5;

  _laserHitEnemyIds.clear();
  let hitCount = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    if (pointToSegmentDist(enemy.x, enemy.y, x1, y1, x2, y2) <= enemy.radius + railgunHalfWidth) {
      _laserHitEnemyIds.add(enemy.id);
      hitCount += 1;
      sim.applyDamageToEnemy(
        enemy,
        FOCUS_LASER_RAILGUN_DMG,
        false,
        'burn',
        p.aimAngle,
        FOCUS_LASER_RAILGUN_KB,
        true,
        p.id,
        false,
      );
      if (enemy.hp > 0) {
        enemy.burnTimer = Math.max(enemy.burnTimer, 3.0);
        sim.applyElementStatusToEnemy(enemy, 'burn', FOCUS_LASER_RAILGUN_DMG, p.id);
      }
    }
  }
  _laserHitEnemyIds.clear();

  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'focus_laser_railgun',
      playerId: p.id,
      x1,
      y1,
      x2,
      y2,
      angle: p.aimAngle,
      width: FOCUS_LASER_RAILGUN_WIDTH,
      damage: FOCUS_LASER_RAILGUN_DMG,
      alertTextVi: 'RAILGUN XẢ ÁP!',
    });
  }

  return hitCount;
}

function swallowEnemyBulletsNearVoidOrb(sim: WorldSim, b: SimProjectileState, x: number, y: number): void {
  const swallowedIds: number[] = [];
  for (let i = 0; i < sim.projectiles.length; i++) {
    const eb = sim.projectiles[i]!;
    if (eb.team !== 'enemy' || eb.ttlSec <= 0) continue;
    if (distance(x, y, eb.x, eb.y) <= VOID_STAFF_PULL_RADIUS + eb.radius) {
      eb.ttlSec = 0;
      b.swallowedBullets = Math.min(
        VOID_STAFF_MAX_SWALLOWED_BULLETS,
        (b.swallowedBullets ?? 0) + 1,
      );
      swallowedIds.push(eb.id);
    }
  }
  if (swallowedIds.length > 0) {
    sim.recordDestroyedProjectiles(swallowedIds);
  }
}

function isImmobileVoidTarget(enemy: SimEnemyState): boolean {
  return (
    enemy.isBoss ||
    enemy.defId === 'thorn_turret' ||
    enemy.defId === 'spore_guardian' ||
    enemy.defId === 'ice_prison' ||
    enemy.defId === 'forge_energy_core'
  );
}

/**
 * Void Staff Hold-and-Release Implosion check:
 * Arms the in-flight Singularity Orb after >= 2 ticks while holding FIRE,
 * and triggers Void Implosion when FIRE is released.
 */
export function checkAndTriggerVoidStaffImplosion(
  sim: WorldSim,
  p: SimPlayerState,
  buttons: number,
): void {
  const holdingFire = (buttons & INPUT_BUTTON.FIRE) !== 0;
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team !== 'player' || b.ownerId !== p.id || b.weaponId !== 'void_staff' || b.ttlSec <= 0) {
      continue;
    }
    if (holdingFire) {
      b.firedWhileHoldingFire = true;
      if ((b.voidOrbFlightTicks ?? 0) >= 1) {
        b.armedForReleaseImplosion = true;
      }
    } else if (b.armedForReleaseImplosion) {
      triggerVoidStaffImplosion(sim, b, b.x, b.y, true);
    }
  }
}

/**
 * Updates an in-flight Void Staff Singularity Orb:
 * - Swallows enemy projectiles within r = 110px (recording projectiles_destroyed),
 * - Pulls non-boss enemies toward the orb center (~90 px/s, respecting resolveCircleCollision),
 * - Every 0.20s (12 ticks) pulses 12 Poison DMG to enemies within r = 110px.
 */
export function updateVoidStaffOrbInFlight(
  sim: WorldSim,
  b: SimProjectileState,
  dtSec: number,
): void {
  if (b.ttlSec <= 0 || b.finaleResolved) return;

  b.voidOrbFlightTicks = (b.voidOrbFlightTicks ?? 0) + 1;
  b.voidPulseTimer = (b.voidPulseTimer ?? 0) + dtSec;

  const owner = sim.getPlayerById(b.ownerId) ?? sim.player;
  const ownerButtons = owner.lastButtons ?? (owner.id === sim.player.id ? sim.currentInput.buttons : 0);
  const holdingFire = (ownerButtons & INPUT_BUTTON.FIRE) !== 0;

  if (holdingFire) {
    b.firedWhileHoldingFire = true;
    if (b.voidOrbFlightTicks >= 2) {
      b.armedForReleaseImplosion = true;
    }
  } else if (b.armedForReleaseImplosion) {
    triggerVoidStaffImplosion(sim, b, b.x, b.y, true);
    return;
  }

  // 1. Swallow enemy projectiles within r = 110px
  swallowEnemyBulletsNearVoidOrb(sim, b, b.x, b.y);

  // 2. Pull non-boss enemies toward the orb center (~90 px/s step)
  const pullStep = VOID_STAFF_PULL_SPEED * dtSec;
  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    const d = distance(b.x, b.y, enemy.x, enemy.y);
    if (d <= VOID_STAFF_PULL_RADIUS + enemy.radius && d > 1e-4 && !isImmobileVoidTarget(enemy)) {
      const step = Math.min(pullStep, d);
      const nextX = enemy.x + ((b.x - enemy.x) / d) * step;
      const nextY = enemy.y + ((b.y - enemy.y) / d) * step;
      const col = sim.map.resolveCircleCollision(nextX, nextY, enemy.radius, true);
      enemy.x = col.x;
      enemy.y = col.y;
      if (!sim.stressTestActive) {
        resolveEnemyChasmRingOut(sim, enemy);
      }
    }
  }

  // 3. Every 0.20s (12 ticks), pulse 12 Poison DMG to all enemies within r = 110px
  if (
    b.voidOrbFlightTicks % VOID_STAFF_PULSE_INTERVAL_TICKS === 0 ||
    b.voidPulseTimer >= VOID_STAFF_PULSE_INTERVAL_SEC - 1e-6
  ) {
    b.voidPulseTimer = Math.max(0, b.voidPulseTimer - VOID_STAFF_PULSE_INTERVAL_SEC);
    const pulseDmg = b.damage > 0 ? b.damage : VOID_STAFF_PULSE_DMG;
    const elem: ElementType = b.element !== 'none' ? b.element : 'poison';

    for (let i = 0; i < sim.enemies.length; i++) {
      const enemy = sim.enemies[i]!;
      if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
      if (distance(b.x, b.y, enemy.x, enemy.y) <= VOID_STAFF_PULL_RADIUS + enemy.radius) {
        const pullAng = Math.atan2(b.y - enemy.y, b.x - enemy.x);
        sim.applyDamageToEnemy(
          enemy,
          pulseDmg,
          b.isCrit,
          elem,
          pullAng,
          0,
          false,
          b.ownerId,
          true,
        );
        if (enemy.hp > 0) {
          sim.applyElementStatusToEnemy(enemy, 'poison', pulseDmg, b.ownerId);
        }
      }
    }
  }
}

/**
 * Void Staff Implosion (Hold-and-Release FIRE or max range / wall hit):
 * - Swallows any remaining enemy bullets in r = 110px,
 * - Pulls enemies within r = 110px tightly toward the orb center (up to 42px in-step pull),
 * - Deals 52 + 6 * min(6, swallowedBullets) Poison DMG (up to 88 DMG Poison),
 * - Emits void_implosion & explosion events with 'HỐ ĐEN SỤP ĐỔ!' alert when triggered by release or with swallowed bullets.
 */
export function triggerVoidStaffImplosion(
  sim: WorldSim,
  b: SimProjectileState,
  x = b.x,
  y = b.y,
  triggeredByRelease = Boolean(b.armedForReleaseImplosion),
): number {
  if (b.finaleResolved) return 0;
  b.finaleResolved = true;
  b.ttlSec = 0;

  swallowEnemyBulletsNearVoidOrb(sim, b, x, y);

  const swallowed = clamp(b.swallowedBullets ?? 0, 0, VOID_STAFF_MAX_SWALLOWED_BULLETS);
  const implosionDamage =
    VOID_STAFF_IMPLOSION_BASE_DMG + VOID_STAFF_BONUS_DMG_PER_BULLET * swallowed;
  const elem: ElementType = b.element !== 'none' ? b.element : 'poison';

  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    const d = distance(x, y, enemy.x, enemy.y);
    if (d <= VOID_STAFF_PULL_RADIUS + enemy.radius) {
      if (d > 1e-4 && !isImmobileVoidTarget(enemy)) {
        const pullDist = Math.min(VOID_STAFF_IMPLOSION_PULL_DIST, d);
        const nextX = enemy.x + ((x - enemy.x) / d) * pullDist;
        const nextY = enemy.y + ((y - enemy.y) / d) * pullDist;
        const col = sim.map.resolveCircleCollision(nextX, nextY, enemy.radius, true);
        enemy.x = col.x;
        enemy.y = col.y;
        if (!sim.stressTestActive) {
          resolveEnemyChasmRingOut(sim, enemy);
        }
      }
      const pullAng = d > 1e-4 ? Math.atan2(y - enemy.y, x - enemy.x) : b.angle;
      sim.applyDamageToEnemy(
        enemy,
        implosionDamage,
        b.isCrit,
        elem,
        pullAng,
        65,
        true,
        b.ownerId,
        true,
      );
      if (enemy.hp > 0) {
        sim.applyElementStatusToEnemy(enemy, 'poison', implosionDamage, b.ownerId);
      }
    }
  }

  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'explosion',
      x,
      y,
      radius: VOID_STAFF_PULL_RADIUS,
      damage: implosionDamage,
      sourceDefId: 'void_staff',
    });
    sim.events.push({
      kind: 'void_implosion',
      playerId: b.ownerId,
      x,
      y,
      radius: VOID_STAFF_PULL_RADIUS,
      damage: implosionDamage,
      swallowedBullets: swallowed,
      triggeredByRelease,
      alertTextVi: triggeredByRelease || swallowed > 0 ? 'HỐ ĐEN SỤP ĐỔ!' : undefined,
    });
  }

  return implosionDamage;
}
