import type { ElementType } from '../data/types.js';
import { clamp, distance } from '../math/vec2.js';
import { TILE_SIZE } from '../protocol/messages.js';
import { findNearestWalkablePoint } from './arena-room-archetypes.js';
import {
  resolveEnemyChasmRingOut,
  triggerEnemyWallSlam,
  triggerGrassPollenSpeedBoost,
  triggerMeleeKickProps,
} from './sim-tactical-physics.js';
import { pointToSegmentDist } from './sim-weapon-specials-rare.js';
import { processMeleeParryDeflect } from './sim-weapon-specials.js';
import type {
  BulletVolleySpawnEvent,
  SimEnemyState,
  SimLightningPillarState,
  SimMagmaTrailSegmentState,
  SimPlayerState,
  SimProjectileState,
  SimSolarFireZoneState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const SOLAR_ORBIT_RADIUS = 48;
export const SOLAR_ORBIT_SPEED_RAD = 3.2;
export const SOLAR_ORB_RADIUS = 14;
export const SOLAR_ORB_CONTACT_DMG = 12;
export const SOLAR_ORB_ICD_TICKS = 24;
export const SOLAR_CONVERGE_DEFAULT_DIST = 240;
export const SOLAR_CONVERGE_BURST_RADIUS = 52;
export const SOLAR_SUPERNOVA_DEFAULT_DIST = 220;
export const SOLAR_SUPERNOVA_DMG = 68;
export const SOLAR_SUPERNOVA_RADIUS = 120;
export const SOLAR_SUPERNOVA_KB = 240;
export const SOLAR_SUPERNOVA_CLEAR_RADIUS = 80;
export const SOLAR_FIRE_ZONE_RADIUS = 96;
export const SOLAR_FIRE_ZONE_DURATION_SEC = 3.5;
export const SOLAR_FIRE_ZONE_TICK_TICKS = 30;
export const SOLAR_FIRE_ZONE_TICK_DMG = 12;

export const MAGMA_BOULDER_RADIUS = 20;
export const MAGMA_BOULDER_SPEED = 420;
export const MAGMA_BOULDER_KB = 280;
export const MAGMA_TRAIL_WIDTH = 48;
export const MAGMA_TRAIL_DURATION_SEC = 3.5;
export const MAGMA_TRAIL_TICK_TICKS = 30;
export const MAGMA_TRAIL_TICK_DMG = 10;
export const MAGMA_GEYSER_COUNT = 4;
export const MAGMA_GEYSER_DMG = 22;
export const MAGMA_GEYSER_RADIUS = 56;
export const MAGMA_GEYSER_KB = 180;

export const THUNDER_HAMMER_PILLAR_OFFSET = 72;
export const THUNDER_HAMMER_PILLAR_DURATION_SEC = 3.0;
export const THUNDER_HAMMER_STRIKE_RADIUS = 110;
export const THUNDER_HAMMER_STRIKE_DMG = 54;
export const THUNDER_HAMMER_STRIKE_KB = 320;
export const THUNDER_HAMMER_STRIKE_STUN_SEC = 0.6;
export const THUNDER_HAMMER_PILLAR_PULSE_TICKS = 30;
export const THUNDER_HAMMER_PILLAR_PULSE_DMG = 14;

export function getSolarMiniSunPositions(
  p: SimPlayerState,
): Array<{ x: number; y: number; angle: number; index: number }> {
  const baseAngle = p.solarOrbitAngle ?? 0;
  const step = (Math.PI * 2) / 3;
  return [0, 1, 2].map((index) => {
    const angle = baseAngle + index * step;
    return { x: p.x + Math.cos(angle) * SOLAR_ORBIT_RADIUS, y: p.y + Math.sin(angle) * SOLAR_ORBIT_RADIUS, angle, index };
  });
}

export function updateSolarArchonMiniSunsForPlayer(sim: WorldSim, p: SimPlayerState, dtSec: number): void {
  if (p.lifeState !== 'alive' || p.hp <= 0) return;
  const activeWepId = p.weaponSlots[p.activeWeaponSlot ?? 0] ?? p.weaponSlots[0] ?? 'knight_sword';
  if (activeWepId !== 'solar_archon_staff') return;

  p.solarOrbitAngle = (p.solarOrbitAngle ?? 0) + SOLAR_ORBIT_SPEED_RAD * dtSec;
  const suns = getSolarMiniSunPositions(p);
  p.solarOrbHitTickByEnemy ??= {};

  for (let sIdx = 0; sIdx < suns.length; sIdx++) {
    const sun = suns[sIdx]!;
    for (let eIdx = 0; eIdx < sim.enemies.length; eIdx++) {
      const enemy = sim.enemies[eIdx]!;
      if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
      if (distance(sun.x, sun.y, enemy.x, enemy.y) <= enemy.radius + SOLAR_ORB_RADIUS) {
        const key = `${sIdx}_${enemy.id}`;
        if (sim.tick >= (p.solarOrbHitTickByEnemy[key] ?? -999)) {
          p.solarOrbHitTickByEnemy[key] = sim.tick + SOLAR_ORB_ICD_TICKS;
          const hitAng = distance(sun.x, sun.y, enemy.x, enemy.y) > 1e-4 ? Math.atan2(enemy.y - sun.y, enemy.x - sun.x) : p.aimAngle;
          sim.applyDamageToEnemy(enemy, SOLAR_ORB_CONTACT_DMG, false, 'burn', hitAng, 60, false, p.id, true);
          if (enemy.hp > 0) {
            enemy.burnTimer = Math.max(enemy.burnTimer, 3.0);
            sim.applyElementStatusToEnemy(enemy, 'burn', SOLAR_ORB_CONTACT_DMG, p.id);
          }
        }
      }
    }
  }
}

export function resolveSolarArchonTargetPoint(
  p: SimPlayerState,
  defaultDist: number,
): { x: number; y: number; hasExplicitAimTarget: boolean } {
  if (
    typeof p.aimWorldX === 'number' &&
    typeof p.aimWorldY === 'number' &&
    Number.isFinite(p.aimWorldX) &&
    Number.isFinite(p.aimWorldY) &&
    distance(p.x, p.y, p.aimWorldX, p.aimWorldY) > 8
  ) {
    return { x: p.aimWorldX, y: p.aimWorldY, hasExplicitAimTarget: true };
  }
  return { x: p.x + Math.cos(p.aimAngle) * defaultDist, y: p.y + Math.sin(p.aimAngle) * defaultDist, hasExplicitAimTarget: false };
}

export function spawnSolarArchonConvergingVolley(
  sim: WorldSim,
  p: SimPlayerState,
  baseDmg: number,
  critChance: number,
  shotElement: ElementType,
  shieldBoost: boolean,
  shotFlags: number,
  mutatorVolleyFields?: Pick<BulletVolleySpawnEvent, 'clusterMortarLob' | 'secondaryInfusedElement'>,
): SimProjectileState[] {
  const target = resolveSolarArchonTargetPoint(p, SOLAR_CONVERGE_DEFAULT_DIST);
  const suns = getSolarMiniSunPositions(p);
  const elem: ElementType = shotElement !== 'none' ? shotElement : 'burn';
  const speed = 530;
  const spawned: SimProjectileState[] = [];

  for (let k = 0; k < suns.length; k++) {
    const sun = suns[k]!;
    const rayAngle = Math.atan2(target.y - sun.y, target.x - sun.x);
    const distToTarget = Math.max(24, distance(sun.x, sun.y, target.x, target.y));
    const volleyEv: BulletVolleySpawnEvent = {
      kind: 'bullet_volley_spawned', tick: sim.tick, ownerId: p.id, team: 'player', weaponId: 'solar_archon_staff',
      x: sun.x, y: sun.y, angle: rayAngle, pelletCount: 1, spreadRad: 0, speed, damage: baseDmg, radius: 6,
      knockback: 140, pierceCount: 99, bounceCount: 2, ttlSec: Math.max(1.2, distToTarget / speed + 0.65),
      element: elem, critChance, amplifiedByShield: shieldBoost, seed: sim.rng.nextUint32(),
      shotFlags, flags: shotFlags, originX: sun.x, originY: sun.y,
      convergeTargetX: target.x, convergeTargetY: target.y, solarRayIndex: k, hasExplicitAimTarget: target.hasExplicitAimTarget,
      clusterMortarLob: mutatorVolleyFields?.clusterMortarLob,
      secondaryInfusedElement: mutatorVolleyFields?.secondaryInfusedElement,
    };
    sim.spawnDeterministicVolley(volleyEv);
    const eventKey = (volleyEv.eventId ?? 1) & 0x3fffff;
    for (let idx = sim.projectiles.length - 1; idx >= 0; idx--) {
      const proj = sim.projectiles[idx]!;
      if ((proj.id >>> 6) !== eventKey) break;
      spawned.push(proj);
    }
  }
  return spawned;
}

export function triggerSolarConvergeBurst(sim: WorldSim, b: SimProjectileState, burstX = b.x, burstY = b.y): number {
  if (b.solarConvergeBurstTriggered) return 0;
  b.solarConvergeBurstTriggered = true;

  const elem: ElementType = b.element !== 'none' ? b.element : 'burn';
  let hitCount = 0;

  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    if (distance(burstX, burstY, enemy.x, enemy.y) <= SOLAR_CONVERGE_BURST_RADIUS + enemy.radius) {
      hitCount += 1;
      if (b.hitEntityIds.includes(enemy.id)) continue;
      b.hitEntityIds.push(enemy.id);
      const hitAng = distance(burstX, burstY, enemy.x, enemy.y) > 1e-4 ? Math.atan2(enemy.y - burstY, enemy.x - burstX) : b.angle;
      sim.applyDamageToEnemy(enemy, b.damage, b.isCrit, elem, hitAng, b.knockback, false, b.ownerId, false);
      if (enemy.hp > 0) {
        enemy.burnTimer = Math.max(enemy.burnTimer, 3.0);
        sim.applyElementStatusToEnemy(enemy, 'burn', b.damage, b.ownerId);
      }
    }
  }

  if (!sim.stressTestActive) {
    sim.events.push({ kind: 'explosion', x: burstX, y: burstY, radius: SOLAR_CONVERGE_BURST_RADIUS, damage: b.damage, sourceDefId: 'solar_archon_staff' });
    sim.events.push({ kind: 'solar_converge_burst', playerId: b.ownerId, x: burstX, y: burstY, radius: SOLAR_CONVERGE_BURST_RADIUS, damage: b.damage, rayIndex: b.solarRayIndex });
  }
  return hitCount;
}

export function triggerSolarArchonSupernovaVent(sim: WorldSim, pOrPlayerId: SimPlayerState | number): number {
  const p = typeof pOrPlayerId === 'number' ? (sim.getPlayerById(pOrPlayerId) ?? sim.player) : pOrPlayerId;
  const slot = p.activeWeaponSlot ?? 0;

  p.weaponHeat = 0;
  if (Array.isArray(p.weaponSlotHeat)) p.weaponSlotHeat[slot] = 0;
  p.ventCooldownTimer = 0.25;
  p.fireCooldownTimer = Math.max(p.fireCooldownTimer, 0.25);
  triggerGrassPollenSpeedBoost(sim, p);

  const target = resolveSolarArchonTargetPoint(p, SOLAR_SUPERNOVA_DEFAULT_DIST);
  const targetX = target.x;
  const targetY = target.y;

  const destroyedIds: number[] = [];
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
    if (
      distance(targetX, targetY, b.x, b.y) <= SOLAR_SUPERNOVA_RADIUS + b.radius ||
      distance(p.x, p.y, b.x, b.y) <= SOLAR_SUPERNOVA_CLEAR_RADIUS + b.radius
    ) {
      b.ttlSec = 0;
      destroyedIds.push(b.id);
    }
  }
  if (destroyedIds.length > 0) sim.recordDestroyedProjectiles(destroyedIds);

  let hitCount = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    if (distance(targetX, targetY, enemy.x, enemy.y) <= SOLAR_SUPERNOVA_RADIUS + enemy.radius) {
      hitCount += 1;
      const hitAng = distance(targetX, targetY, enemy.x, enemy.y) > 1e-4 ? Math.atan2(enemy.y - targetY, enemy.x - targetX) : p.aimAngle;
      sim.applyDamageToEnemy(enemy, SOLAR_SUPERNOVA_DMG, false, 'burn', hitAng, SOLAR_SUPERNOVA_KB, true, p.id, false);
      if (enemy.hp > 0) {
        enemy.burnTimer = Math.max(enemy.burnTimer, 3.0);
        sim.applyElementStatusToEnemy(enemy, 'burn', SOLAR_SUPERNOVA_DMG, p.id);
      }
    }
  }

  sim.map.igniteSurfaceInRadius(targetX, targetY, SOLAR_FIRE_ZONE_RADIUS);
  const fireZone: SimSolarFireZoneState = {
    id: ++sim.nextEntityId, ownerPlayerId: p.id, x: targetX, y: targetY, radius: SOLAR_FIRE_ZONE_RADIUS,
    ttlSec: SOLAR_FIRE_ZONE_DURATION_SEC, maxTtlSec: SOLAR_FIRE_ZONE_DURATION_SEC, tickTimer: 0.5, ticksElapsed: 0, damage: SOLAR_FIRE_ZONE_TICK_DMG,
  };
  sim.solarFireZones.push(fireZone);

  if (!sim.stressTestActive) {
    sim.events.push({ kind: 'explosion', x: targetX, y: targetY, radius: SOLAR_SUPERNOVA_RADIUS, damage: SOLAR_SUPERNOVA_DMG, sourceDefId: 'solar_archon_staff' });
    sim.events.push({
      kind: 'solar_supernova', playerId: p.id, x: targetX, y: targetY, radius: SOLAR_SUPERNOVA_RADIUS, damage: SOLAR_SUPERNOVA_DMG,
      zoneRadius: SOLAR_FIRE_ZONE_RADIUS, zoneDurationSec: SOLAR_FIRE_ZONE_DURATION_SEC, bulletsCleared: destroyedIds.length, alertTextVi: 'SIÊU TÂN TINH HỘI TỤ!',
    });
  }
  return hitCount;
}

function isImmobileMagmaTarget(enemy: SimEnemyState): boolean {
  return enemy.isBoss || enemy.defId === 'thorn_turret' || enemy.defId === 'spore_guardian' || enemy.defId === 'ice_prison' || enemy.defId === 'forge_energy_core';
}

export function appendMagmaTrailSegment(sim: WorldSim, ownerPlayerId: number, x1: number, y1: number, x2: number, y2: number): void {
  if (distance(x1, y1, x2, y2) < 2) return;
  if (sim.magmaTrails.length >= 48) {
    sim.magmaTrails.shift();
  }
  const seg: SimMagmaTrailSegmentState = {
    id: ++sim.nextEntityId, ownerPlayerId, x1, y1, x2, y2, width: MAGMA_TRAIL_WIDTH,
    ttlSec: MAGMA_TRAIL_DURATION_SEC, maxTtlSec: MAGMA_TRAIL_DURATION_SEC, tickTimer: 0.5, ticksElapsed: 0, damage: MAGMA_TRAIL_TICK_DMG,
  };
  sim.magmaTrails.push(seg);

  const owner = sim.getPlayerById(ownerPlayerId) ?? sim.player;
  const tx = Math.floor(x2 / TILE_SIZE);
  const ty = Math.floor(y2 / TILE_SIZE);
  if (!sim.map.isSolidTile(tx, ty) && sim.map.getSurface(tx, ty) !== 'chasm' && distance(owner.x, owner.y, x2, y2) > owner.radius + 26) {
    sim.map.setSurface(tx, ty, 'lava', MAGMA_TRAIL_DURATION_SEC);
  }
}

export function finalizeMagmaCannonBoulderOnStop(sim: WorldSim, b: SimProjectileState, stopX: number, stopY: number): void {
  const lastX = b.trailLastX ?? b.originX ?? b.prevX;
  const lastY = b.trailLastY ?? b.originY ?? b.prevY;
  appendMagmaTrailSegment(sim, b.ownerId, lastX, lastY, stopX, stopY);
  b.trailLastX = stopX;
  b.trailLastY = stopY;

  for (let i = 0; i < b.hitEntityIds.length; i++) {
    const enemy = sim.enemies.find((e) => e.id === b.hitEntityIds[i]);
    if (!enemy || enemy.hp <= 0 || isImmobileMagmaTarget(enemy)) continue;
    if (distance(stopX, stopY, enemy.x, enemy.y) <= b.radius + enemy.radius + 42) {
      enemy.kbVx = Math.cos(b.angle) * MAGMA_BOULDER_KB;
      enemy.kbVy = Math.sin(b.angle) * MAGMA_BOULDER_KB;
      enemy.lastHitPlayerId = b.ownerId;
      if ((enemy.wallSlamCooldownTimer ?? 0) <= 0) {
        triggerEnemyWallSlam(sim, enemy, undefined, MAGMA_BOULDER_KB);
      }
    }
  }
}

export function updateLegendaryProjectileInFlight(sim: WorldSim, b: SimProjectileState, dtSec: number): boolean {
  if (b.team !== 'player' || b.ttlSec <= 0) return false;

  if (b.weaponId === 'solar_archon_staff') {
    if (!b.solarConvergeBurstTriggered && typeof b.convergeTargetX === 'number' && typeof b.convergeTargetY === 'number') {
      const toTargetX = b.convergeTargetX - b.x;
      const toTargetY = b.convergeTargetY - b.y;
      const distToTarget = Math.hypot(toTargetX, toTargetY);
      const stepDist = Math.hypot(b.vx, b.vy) * dtSec;
      const dot = toTargetX * b.vx + toTargetY * b.vy;
      if (distToTarget <= Math.max(10, stepDist * 1.1) || dot <= 0) {
        b.x = b.convergeTargetX;
        b.y = b.convergeTargetY;
        const hits = triggerSolarConvergeBurst(sim, b, b.x, b.y);
        const owner = sim.getPlayerById(b.ownerId) ?? sim.player;
        const hasDistantEnemyAlongAim =
          !b.hasExplicitAimTarget &&
          hits === 0 &&
          sim.enemies.some(
            (e) => e.hp > 0 && e.aiState !== 'spawning' && !e.bossBurrowed && distance(owner.x, owner.y, e.x, e.y) > SOLAR_CONVERGE_DEFAULT_DIST + 40,
          );
        if (!hasDistantEnemyAlongAim) {
          b.ttlSec = 0;
          return true;
        }
        const spd = Math.hypot(b.vx, b.vy) || 530;
        b.angle = owner.aimAngle;
        b.vx = Math.cos(owner.aimAngle) * spd;
        b.vy = Math.sin(owner.aimAngle) * spd;
      }
    }
    return false;
  }

  if (b.weaponId === 'magma_cannon') {
    const lastX = b.trailLastX ?? b.originX ?? b.prevX;
    const lastY = b.trailLastY ?? b.originY ?? b.prevY;
    if (distance(lastX, lastY, b.x, b.y) >= 16) {
      appendMagmaTrailSegment(sim, b.ownerId, lastX, lastY, b.x, b.y);
      b.trailLastX = b.x;
      b.trailLastY = b.y;
    }

    const cos = Math.cos(b.angle);
    const sin = Math.sin(b.angle);
    for (let i = 0; i < b.hitEntityIds.length; i++) {
      const enemy = sim.enemies.find((e) => e.id === b.hitEntityIds[i]);
      if (!enemy || enemy.hp <= 0 || enemy.aiState === 'spawning' || isImmobileMagmaTarget(enemy)) continue;
      if (distance(b.x, b.y, enemy.x, enemy.y) <= b.radius + enemy.radius + 36) {
        const carryX = b.x + cos * (b.radius + enemy.radius * 0.65);
        const carryY = b.y + sin * (b.radius + enemy.radius * 0.65);
        enemy.kbVx = cos * MAGMA_BOULDER_KB;
        enemy.kbVy = sin * MAGMA_BOULDER_KB;
        enemy.lastHitPlayerId = b.ownerId;
        const col = sim.map.resolveCircleCollision(carryX, carryY, enemy.radius, true);
        enemy.x = col.x;
        enemy.y = col.y;
        if (col.collided && (enemy.wallSlamCooldownTimer ?? 0) <= 0) {
          triggerEnemyWallSlam(sim, enemy, undefined, MAGMA_BOULDER_KB);
        }
        if (!sim.stressTestActive && enemy.hp > 0) resolveEnemyChasmRingOut(sim, enemy);
      }
    }
  }
  return false;
}

export function triggerMagmaCannonGeyserEruption(sim: WorldSim, pOrPlayerId: SimPlayerState | number): number {
  const p = typeof pOrPlayerId === 'number' ? (sim.getPlayerById(pOrPlayerId) ?? sim.player) : pOrPlayerId;
  const activeSegments = sim.magmaTrails.filter((seg) => seg.ownerPlayerId === p.id && seg.ttlSec > 0);
  const geysers: Array<{ x: number; y: number; radius: number; damage: number }> = [];

  if (activeSegments.length > 0) {
    let totalLen = 0;
    const lengths = activeSegments.map((seg) => {
      const len = Math.max(1, distance(seg.x1, seg.y1, seg.x2, seg.y2));
      totalLen += len;
      return len;
    });
    for (let k = 0; k < MAGMA_GEYSER_COUNT; k++) {
      const targetDist = ((k + 0.5) / MAGMA_GEYSER_COUNT) * totalLen;
      let accum = 0;
      let gx = activeSegments[activeSegments.length - 1]!.x2;
      let gy = activeSegments[activeSegments.length - 1]!.y2;
      for (let i = 0; i < activeSegments.length; i++) {
        const seg = activeSegments[i]!;
        const len = lengths[i]!;
        if (accum + len >= targetDist || i === activeSegments.length - 1) {
          const t = clamp((targetDist - accum) / len, 0, 1);
          gx = seg.x1 + (seg.x2 - seg.x1) * t;
          gy = seg.y1 + (seg.y2 - seg.y1) * t;
          break;
        }
        accum += len;
      }
      geysers.push({ x: gx, y: gy, radius: MAGMA_GEYSER_RADIUS, damage: MAGMA_GEYSER_DMG });
    }
  } else {
    for (let k = 0; k < MAGMA_GEYSER_COUNT; k++) {
      const dist = 65 + k * 60;
      const col = sim.map.resolveCircleCollision(p.x + Math.cos(p.aimAngle) * dist, p.y + Math.sin(p.aimAngle) * dist, 12, false);
      geysers.push({ x: col.x, y: col.y, radius: MAGMA_GEYSER_RADIUS, damage: MAGMA_GEYSER_DMG });
    }
  }

  const hitEnemyIds = new Set<number>();
  for (let gIdx = 0; gIdx < geysers.length; gIdx++) {
    const g = geysers[gIdx]!;
    if (!sim.stressTestActive) {
      sim.events.push({ kind: 'explosion', x: g.x, y: g.y, radius: g.radius, damage: g.damage, sourceDefId: 'magma_cannon' });
    }
    for (let i = 0; i < sim.enemies.length; i++) {
      const enemy = sim.enemies[i]!;
      if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed || hitEnemyIds.has(enemy.id)) continue;
      if (distance(g.x, g.y, enemy.x, enemy.y) <= g.radius + enemy.radius) {
        hitEnemyIds.add(enemy.id);
        const hitAng = distance(g.x, g.y, enemy.x, enemy.y) > 1e-4 ? Math.atan2(enemy.y - g.y, enemy.x - g.x) : p.aimAngle;
        sim.applyDamageToEnemy(enemy, g.damage, false, 'burn', hitAng, MAGMA_GEYSER_KB, true, p.id, true);
        if (enemy.hp > 0) {
          enemy.burnTimer = Math.max(enemy.burnTimer, 3.0);
          sim.applyElementStatusToEnemy(enemy, 'burn', g.damage, p.id);
        }
      }
    }
  }

  if (!sim.stressTestActive) {
    sim.events.push({ kind: 'magma_geyser_eruption', playerId: p.id, geysers, damage: MAGMA_GEYSER_DMG, radius: MAGMA_GEYSER_RADIUS, alertTextVi: 'VÒI DUNG NHAM PHUN TRÀO!' });
  }
  return hitEnemyIds.size;
}

export function triggerThunderHammerFinisher(
  sim: WorldSim,
  p: SimPlayerState,
  damage = THUNDER_HAMMER_STRIKE_DMG,
  hitEnemyIdsOut?: Set<number>,
): number {
  const rawX = p.x + Math.cos(p.aimAngle) * THUNDER_HAMMER_PILLAR_OFFSET;
  const rawY = p.y + Math.sin(p.aimAngle) * THUNDER_HAMMER_PILLAR_OFFSET;
  const col = sim.map.resolveCircleCollision(rawX, rawY, 16, false);
  const safePt = sim.map.getSurfaceAtWorld(col.x, col.y) === 'chasm' ? findNearestWalkablePoint(sim.map, col.x, col.y, 16) : col;
  const pillarX = safePt.x;
  const pillarY = safePt.y;

  p.meleeParryWindowTimer = 0.18;
  p.parriedCountCurrentWindow = 0;
  let deflectedCount = processMeleeParryDeflect(sim, p);

  if (p.parriedCountCurrentWindow < 3) {
    const extraDeflectedIds: number[] = [];
    for (let i = 0; i < sim.projectiles.length; i++) {
      if (p.parriedCountCurrentWindow >= 3) break;
      const b = sim.projectiles[i]!;
      if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
      if (distance(pillarX, pillarY, b.x, b.y) <= THUNDER_HAMMER_STRIKE_RADIUS + b.radius) {
        b.ttlSec = 0;
        extraDeflectedIds.push(b.id);
        p.parriedCountCurrentWindow += 1;
        deflectedCount += 1;

        const deflectVolley: BulletVolleySpawnEvent = {
          kind: 'bullet_volley_spawned', tick: sim.tick, ownerId: p.id, team: 'player', weaponId: 'knight_sword_parry',
          x: b.x, y: b.y, angle: p.aimAngle, pelletCount: 1, spreadRad: 0, muzzleOffset: 0, speed: 760, damage,
          radius: 7, knockback: 240, pierceCount: 0, bounceCount: 0, ttlSec: 0.9, element: 'shock',
          critChance: 0.22, amplifiedByShield: false, seed: sim.rng.nextUint32(), shotFlags: 0, flags: 0, explosionRadius: 36,
        };
        sim.spawnDeterministicVolley(deflectVolley, true);
      }
    }
    if (extraDeflectedIds.length > 0) {
      sim.recordDestroyedProjectiles(extraDeflectedIds);
      if (!sim.stressTestActive) {
        sim.events.push({
          kind: 'melee_parry_deflect', playerId: p.id, weaponId: 'thunder_hammer',
          x: pillarX, y: pillarY, angle: p.aimAngle, deflectedCount: extraDeflectedIds.length, ids: extraDeflectedIds,
        });
      }
    }
  }

  triggerMeleeKickProps(sim, p, Math.PI, THUNDER_HAMMER_STRIKE_RADIUS, p.aimAngle);

  const strikes = [0, 1, 2].map((idx) => {
    const ang = p.aimAngle + (idx - 1) * ((Math.PI * 2) / 3);
    const offset = idx === 1 ? 0 : 28;
    return { x: pillarX + Math.cos(ang) * offset, y: pillarY + Math.sin(ang) * offset, radius: THUNDER_HAMMER_STRIKE_RADIUS, damage };
  });

  const stunDur = THUNDER_HAMMER_STRIKE_STUN_SEC + 1 / 60;
  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    const alreadyHitBySwing = Boolean(hitEnemyIdsOut?.has(enemy.id));
    const inStrikeRadius = distance(pillarX, pillarY, enemy.x, enemy.y) <= THUNDER_HAMMER_STRIKE_RADIUS + enemy.radius;
    if (!alreadyHitBySwing && !inStrikeRadius) continue;

    hitEnemyIdsOut?.add(enemy.id);
    if (!alreadyHitBySwing) {
      const hitAng = distance(pillarX, pillarY, enemy.x, enemy.y) > 1e-4 ? Math.atan2(enemy.y - pillarY, enemy.x - pillarX) : p.aimAngle;
      sim.applyDamageToEnemy(enemy, damage, false, 'shock', hitAng, THUNDER_HAMMER_STRIKE_KB, true, p.id, false);
    }

    if (enemy.hp > 0) {
      enemy.shockTimer = Math.max(enemy.shockTimer, 3.0);
      enemy.stunTimer = Math.max(enemy.stunTimer ?? 0, stunDur);
      if (!enemy.isBoss) {
        enemy.aiState = 'stunned';
        enemy.stateTimer = Math.max(enemy.stateTimer, stunDur);
        enemy.vx = 0;
        enemy.vy = 0;
      }
    }
  }

  const pillar: SimLightningPillarState = {
    id: ++sim.nextEntityId,
    ownerPlayerId: p.id,
    x: pillarX,
    y: pillarY,
    radius: THUNDER_HAMMER_STRIKE_RADIUS,
    ttlSec: THUNDER_HAMMER_PILLAR_DURATION_SEC,
    maxTtlSec: THUNDER_HAMMER_PILLAR_DURATION_SEC,
    tickTimer: 0.5,
    ticksElapsed: 0,
    damage: THUNDER_HAMMER_PILLAR_PULSE_DMG,
  };
  sim.lightningPillars.push(pillar);

  if (!sim.stressTestActive) {
    sim.events.push({ kind: 'thunder_hammer_pillar', playerId: p.id, x: pillarX, y: pillarY, radius: THUNDER_HAMMER_STRIKE_RADIUS, damage, strikes, deflectedCount, alertTextVi: 'CỘT LÔI ĐÌNH!' });
  }
  return deflectedCount;
}

const _magmaTickHitEnemyIds = new Set<number>();

export function updateLegendaryWeaponHazards(sim: WorldSim, dtSec: number): void {
  if (sim.solarFireZones.length > 0) {
    let writeIdx = 0;
    for (let i = 0; i < sim.solarFireZones.length; i++) {
      const z = sim.solarFireZones[i]!;
      z.ttlSec -= dtSec;
      z.tickTimer -= dtSec;
      z.ticksElapsed += 1;

      if (z.ticksElapsed > 0 && z.ticksElapsed % SOLAR_FIRE_ZONE_TICK_TICKS === 0) {
        z.tickTimer = 0.5;
        for (let j = 0; j < sim.enemies.length; j++) {
          const enemy = sim.enemies[j]!;
          if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
          if (distance(z.x, z.y, enemy.x, enemy.y) <= z.radius + enemy.radius) {
            if (enemy.burnTimer <= 0) enemy.burnTickTimer = 0.5;
            enemy.burnTimer = Math.max(enemy.burnTimer, 3.0);
            sim.applyDotDamageToEnemy(enemy, z.damage, 'burn');
          }
        }
      }
      if (z.ttlSec > 1e-6 && z.ticksElapsed < 210) {
        sim.solarFireZones[writeIdx++] = z;
      }
    }
    sim.solarFireZones.length = writeIdx;
  }

  if (sim.magmaTrails.length > 0) {
    _magmaTickHitEnemyIds.clear();
    let writeIdx = 0;
    for (let i = 0; i < sim.magmaTrails.length; i++) {
      const seg = sim.magmaTrails[i]!;
      seg.ttlSec -= dtSec;
      seg.tickTimer -= dtSec;
      seg.ticksElapsed += 1;

      if (seg.ticksElapsed > 0 && seg.ticksElapsed % MAGMA_TRAIL_TICK_TICKS === 0) {
        seg.tickTimer = 0.5;
        const halfWidth = seg.width * 0.5;
        for (let j = 0; j < sim.enemies.length; j++) {
          const enemy = sim.enemies[j]!;
          if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed || _magmaTickHitEnemyIds.has(enemy.id)) continue;
          if (pointToSegmentDist(enemy.x, enemy.y, seg.x1, seg.y1, seg.x2, seg.y2) <= halfWidth + enemy.radius) {
            _magmaTickHitEnemyIds.add(enemy.id);
            if (enemy.burnTimer <= 0) enemy.burnTickTimer = 0.5;
            enemy.burnTimer = Math.max(enemy.burnTimer, 3.0);
            sim.applyDotDamageToEnemy(enemy, seg.damage, 'burn');
          }
        }
      }
      if (seg.ttlSec > 1e-6 && seg.ticksElapsed < 210) {
        sim.magmaTrails[writeIdx++] = seg;
      }
    }
    sim.magmaTrails.length = writeIdx;
  }

  if (sim.lightningPillars.length > 0) {
    let writeIdx = 0;
    for (let i = 0; i < sim.lightningPillars.length; i++) {
      const pillar = sim.lightningPillars[i]!;
      pillar.ttlSec -= dtSec;
      pillar.tickTimer -= dtSec;
      pillar.ticksElapsed += 1;

      if (pillar.ticksElapsed > 0 && pillar.ticksElapsed % THUNDER_HAMMER_PILLAR_PULSE_TICKS === 0) {
        pillar.tickTimer = 0.5;
        for (let j = 0; j < sim.enemies.length; j++) {
          const enemy = sim.enemies[j]!;
          if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
          if (distance(pillar.x, pillar.y, enemy.x, enemy.y) <= pillar.radius + enemy.radius) {
            enemy.shockTimer = Math.max(enemy.shockTimer, 3.0);
            sim.applyDotDamageToEnemy(enemy, pillar.damage, 'shock');
            if (!sim.stressTestActive) {
              sim.events.push({ kind: 'chain_lightning', fromX: pillar.x, fromY: pillar.y, toX: enemy.x, toY: enemy.y });
            }
          }
        }
      }
      if (pillar.ttlSec > 1e-6 && pillar.ticksElapsed < 180) {
        sim.lightningPillars[writeIdx++] = pillar;
      }
    }
    sim.lightningPillars.length = writeIdx;
  }
}

export function copyLegendaryVolleyFieldsToProjectile(ev: BulletVolleySpawnEvent, proj: SimProjectileState): void {
  proj.convergeTargetX = ev.convergeTargetX;
  proj.convergeTargetY = ev.convergeTargetY;
  proj.solarRayIndex = ev.solarRayIndex;
  proj.solarConvergeBurstTriggered = false;
  proj.hasExplicitAimTarget = ev.hasExplicitAimTarget;
  proj.trailLastX = ev.originX ?? ev.x;
  proj.trailLastY = ev.originY ?? ev.y;
}
