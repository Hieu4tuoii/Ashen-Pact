import { scaleBlessingDamage } from '../data/blessings.js';
import type { ElementType } from '../data/types.js';
import { WEAPONS } from '../data/weapons.js';
import { angleDiff, clamp, distance } from '../math/vec2.js';
import { SHOT_FLAG, TILE_SIZE } from '../protocol/messages.js';
import { clampBounceCount } from './sim-damage-pipeline.js';
import {
  isEligibleOrbitReturnWeapon,
  tryPlantWallTetherPylonOnWallHit,
} from './sim-blessings-p4a.js';
import {
  isCircularKickableToyProp,
  isFlippableBarricadeProp,
  triggerEnemyWallSlam,
} from './sim-tactical-physics.js';
import {
  type BulletVolleySpawnEvent,
  hasPlayerBlessing,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
  type SimPropState,
  type SimSkillZoneState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const BULLET_SPLIT_BOUNCE_HALF_ANGLE_RAD = (18 * Math.PI) / 180;
export const BULLET_SPLIT_BOUNCE_DMG_RATIO = 0.7;
export const BULLET_RICOCHET_BOOM_BASE_DMG = 24;
export const BULLET_RICOCHET_BOOM_RADIUS = 64;
export const BULLET_RICOCHET_BOOM_KB = 200;
export const BULLET_RICOCHET_BOOM_ICD_SEC = 0.2;
export const BULLET_HEAVY_PINBALL_KB_MULT = 1.5;
export const BULLET_HEAVY_PINBALL_REBOUND_RATIO = 0.85;
export const BULLET_HEAVY_PINBALL_REBOUND_SEC = 0.45;
export const BULLET_HEAVY_PINBALL_COLLIDE_STUN_SEC = 0.8;
export const BULLET_HEAVY_PINBALL_COLLIDE_BASE_DMG = 18;
export const BULLET_COOP_ARC_RELAY_PASS_RADIUS = 56;
export const BULLET_COOP_ARC_RELAY_ZAP_RANGE = 180;
export const BULLET_COOP_ARC_RELAY_BASE_DMG = 20;
export const BULLET_COOP_ARC_RELAY_ICD_SEC = 0.3;

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-8) return distance(px, py, x1, y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

export function tickPlayerBulletModBlessingTimers(p: SimPlayerState, dtSec: number): void {
  if ((p.ricochetBoomIcdTimer ?? 0) > 0) {
    const next = (p.ricochetBoomIcdTimer ?? 0) - dtSec;
    p.ricochetBoomIcdTimer = next <= 1e-6 ? 0 : next;
  }
  if ((p.coopArcRelayIcdTimer ?? 0) > 0) {
    const next = (p.coopArcRelayIcdTimer ?? 0) - dtSec;
    p.coopArcRelayIcdTimer = next <= 1e-6 ? 0 : next;
  }
}

export function applyBulletModBlessingsOnVolleySpawn(sim: WorldSim, ev: BulletVolleySpawnEvent): void {
  if (ev.team !== 'player' || ev.replacedProjectileId !== undefined) return;
  const owner = ev.ownerId === sim.player.id ? sim.player : sim.getPlayerById(ev.ownerId);
  if (!owner) return;
  const isNonBouncingSpecial =
    ev.weaponId === 'void_staff' || ev.weaponId === 'emerald_cleaver_boomerang' ||
    ev.weaponId === 'reload_tediore_chuck' || ev.weaponId === 'table_tech_rocket' ||
    ev.weaponId === 'relic_perpetual_core_rocket' || ev.weaponId === 'vanguard_bastion_prism' ||
    ev.weaponId === 'dash_phase_blade' || ev.weaponId === 'holster_surge_bolt' ||
    ev.weaponId === 'table_tech_toxic_shrapnel';
  const hasRicochetPactOrRelic =
    owner.activePactId === 'pact_ricochet_vow' ||
    (Array.isArray(owner.awakenedRelicIds) &&
      owner.awakenedRelicIds.includes('relic_ancient_geometry_eye'));
  if (!isNonBouncingSpecial) {
    let bonusBounces = 0;
    if (hasPlayerBlessing(owner, 'bullet_split_bounce')) bonusBounces += 1;
    if (hasRicochetPactOrRelic) bonusBounces += 1;
    if (bonusBounces > 0) {
      ev.bounceCount = clampBounceCount((ev.bounceCount ?? 0) + bonusBounces);
      const nextFlags = (ev.shotFlags ?? ev.flags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE;
      ev.shotFlags = nextFlags;
      ev.flags = nextFlags;
    }
  }
  if (!ev.orbitReturned && hasPlayerBlessing(owner, 'bullet_orbit_return') && isEligibleOrbitReturnWeapon(ev.weaponId)) {
    const nextFlags = (ev.shotFlags ?? ev.flags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE;
    ev.shotFlags = nextFlags;
    ev.flags = nextFlags;
  }
}

export function triggerBulletRicochetBoom(sim: WorldSim, b: SimProjectileState, hitX: number, hitY: number): boolean {
  if (b.team !== 'player') return false;
  const owner = sim.getPlayerById(b.ownerId);
  if (!owner || !hasPlayerBlessing(owner, 'bullet_ricochet_boom') || (owner.ricochetBoomIcdTimer ?? 0) > 0) return false;

  owner.ricochetBoomIcdTimer = BULLET_RICOCHET_BOOM_ICD_SEC;
  const procCoeff = b.procCoefficient ?? 1.0;
  const boomDmg = Math.max(1, Math.round(scaleBlessingDamage(BULLET_RICOCHET_BOOM_BASE_DMG, sim.currentFloor) * procCoeff));
  sim.map.igniteSurfaceInRadius(hitX, hitY, BULLET_RICOCHET_BOOM_RADIUS);
  sim.events.push({
    kind: 'explosion', x: hitX, y: hitY, radius: BULLET_RICOCHET_BOOM_RADIUS,
    damage: boomDmg, sourceDefId: 'bullet_ricochet_boom',
  });

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) continue;
    const d = distance(hitX, hitY, e.x, e.y);
    if (d <= BULLET_RICOCHET_BOOM_RADIUS + e.radius) {
      const hitAng = d > 1e-4 ? Math.atan2(e.y - hitY, e.x - hitX) : b.angle + Math.PI;
      e.lastHitPlayerId = owner.id;
      sim.applyDamageToEnemy(e, boomDmg, false, 'burn', hitAng, BULLET_RICOCHET_BOOM_KB, true, owner.id);
      if (e.hp > 0) {
        e.burnTimer = Math.max(e.burnTimer, 3.0);
        sim.applyElementStatusToEnemy(e, 'burn', boomDmg, owner.id);
      }
      if (e.hp > 0 && !e.isBoss) {
        e.kbVx = Math.cos(hitAng) * BULLET_RICOCHET_BOOM_KB;
        e.kbVy = Math.sin(hitAng) * BULLET_RICOCHET_BOOM_KB;
        const col = sim.map.resolveCircleCollision(e.x + Math.cos(hitAng) * 14, e.y + Math.sin(hitAng) * 14, e.radius, true);
        e.x = col.x;
        e.y = col.y;
        if (col.collided) triggerEnemyWallSlam(sim, e, undefined, BULLET_RICOCHET_BOOM_KB);
      }
    }
  }
  return true;
}

function spawnSplitTwinProjectiles(
  sim: WorldSim, b: SimProjectileState, spawnX: number, spawnY: number, centerAngle: number,
  halfAngleRad: number, childDmg: number, nextBounce: number, amplifiedByShield: boolean, procRatio: number,
): void {
  const speed = Math.max(420, Math.hypot(b.vx, b.vy));
  const origId = b.id;
  const origTtl = Math.max(0.45, b.ttlSec);
  const preservedHits = b.hitEntityIds.length > 0 ? [...b.hitEntityIds] : null;
  const shotFlags = (b.shotFlags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE;
  b.ttlSec = 0;

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned', tick: sim.tick, eventId: sim.nextVolleyEventId++,
    ownerId: b.ownerId, team: 'player', weaponId: b.weaponId,
    x: spawnX, y: spawnY, angle: centerAngle, pelletCount: 2, spreadRad: halfAngleRad * 2,
    speed, damage: childDmg, radius: b.radius, knockback: b.knockback,
    pierceCount: b.pierceRemaining, bounceCount: nextBounce, ttlSec: origTtl,
    element: b.element, critChance: b.isCrit ? 1 : 0, amplifiedByShield,
    seed: sim.rng.nextUint32(), shotFlags, flags: shotFlags, replacedProjectileId: origId,
    explosionRadius: b.explosionRadius, guaranteedElementalProc: b.guaranteedElementalProc,
  });

  const len = sim.projectiles.length;
  const startIdx = Math.max(0, len - 2);
  for (let i = startIdx; i < len; i++) {
    const child = sim.projectiles[i]!;
    if (child.id === origId) continue;
    const exactAngle = i === len - 2 ? centerAngle - halfAngleRad : centerAngle + halfAngleRad;
    child.angle = exactAngle;
    child.vx = Math.cos(exactAngle) * speed;
    child.vy = Math.sin(exactAngle) * speed;
    child.isCrit = b.isCrit;
    child.splitGeneration = 1;
    child.amplifiedByShield = amplifiedByShield;
    child.passedThroughCoverOrPrism = true;
    child.bouncesDone = (b.bouncesDone ?? 0) + 1;
    child.shotFlags = shotFlags;
    child.procCoefficient = (b.procCoefficient ?? 1.0) * procRatio;
    if (preservedHits) {
      for (let h = 0; h < preservedHits.length; h++) {
        const hid = preservedHits[h]!;
        if (!child.hitEntityIds.includes(hid)) child.hitEntityIds.push(hid);
      }
    }
  }
}

export function trySplitBounceOnObstacleHit(
  sim: WorldSim, b: SimProjectileState, hitX: number, hitY: number, centerAngle: number, consumeBounce: boolean,
): boolean {
  if (b.team !== 'player') return false;
  const owner = sim.getPlayerById(b.ownerId);
  if (!owner || !hasPlayerBlessing(owner, 'bullet_split_bounce')) return false;
  if (b.weaponId === 'void_staff' || b.weaponId === 'emerald_cleaver_boomerang' || b.weaponId === 'reload_tediore_chuck') {
    return false;
  }
  // STRICT ONE-SPLIT RULE: splitGeneration >= 1 MUST NEVER spawn new child projectiles!
  if ((b.splitGeneration ?? 0) >= 1) {
    b.splitGeneration = 1;
    return false;
  }
  if (consumeBounce && b.bounceRemaining <= 0) return false;

  const nextBounce = clampBounceCount(consumeBounce ? b.bounceRemaining - 1 : b.bounceRemaining);
  const childDmg = Math.max(1, Math.round(b.damage * BULLET_SPLIT_BOUNCE_DMG_RATIO));
  spawnSplitTwinProjectiles(
    sim, b, hitX + Math.cos(centerAngle) * 4, hitY + Math.sin(centerAngle) * 4,
    centerAngle, BULLET_SPLIT_BOUNCE_HALF_ANGLE_RAD, childDmg, nextBounce,
    Boolean(b.amplifiedByShield), BULLET_SPLIT_BOUNCE_DMG_RATIO,
  );
  return true;
}

export function triggerRangerArrowVolleyWallBlast(sim: WorldSim, b: SimProjectileState, hitX: number, hitY: number): boolean {
  if (b.team !== 'player' || b.weaponId !== 'predator_arrow') return false;
  const owner = sim.getPlayerById(b.ownerId);
  if (!owner || !hasPlayerBlessing(owner, 'ranger_arrow_volley')) return false;

  const blastRadius = 72;
  const blastDmg = scaleBlessingDamage(18, sim.currentFloor);
  sim.events.push({
    kind: 'explosion', x: hitX, y: hitY, radius: blastRadius, damage: blastDmg, sourceDefId: 'ranger_arrow_volley',
  });
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) continue;
    const d = distance(hitX, hitY, e.x, e.y);
    if (d <= blastRadius + e.radius) {
      e.markedTimer = Math.max(e.markedTimer, 6.0);
      e.markedByPlayerId = owner.id;
      if (!sim.stressTestActive) {
        sim.events.push({ kind: 'status_applied', targetId: e.id, status: 'marked', x: e.x, y: e.y });
      }
      const hitAng = d > 1e-4 ? Math.atan2(e.y - hitY, e.x - hitX) : b.angle + Math.PI;
      sim.applyDamageToEnemy(e, blastDmg, false, b.element, hitAng, 120, false, owner.id);
    }
  }
  return true;
}

export function handlePlayerProjectileWallHitBlessingsAndSkills(
  sim: WorldSim, b: SimProjectileState, resolvedX: number, resolvedY: number, normalX: number, normalY: number,
): boolean {
  if (b.team !== 'player') return false;
  tryPlantWallTetherPylonOnWallHit(sim, b, resolvedX, resolvedY, normalX, normalY);
  if (b.bounceRemaining > 0) {
    triggerBulletRicochetBoom(sim, b, resolvedX, resolvedY);
    const reflectAngle = Math.atan2(normalY !== 0 ? -b.vy : b.vy, normalX !== 0 ? -b.vx : b.vx);
    if (trySplitBounceOnObstacleHit(sim, b, resolvedX, resolvedY, reflectAngle, true)) return true;
  } else {
    triggerRangerArrowVolleyWallBlast(sim, b, resolvedX, resolvedY);
  }
  return false;
}

export function handlePlayerProjectileBarricadeHitBlessings(sim: WorldSim, b: SimProjectileState, prop: SimPropState): boolean {
  if (b.team !== 'player' || b.hitEntityIds.includes(prop.id)) return false;
  triggerBulletRicochetBoom(sim, b, prop.x, prop.y);
  if (!prop.prismAuraActive && trySplitBounceOnObstacleHit(sim, b, prop.x, prop.y, b.angle, false)) return true;
  return false;
}

export function onEnemyWallSlamHeavyPinball(
  sim: WorldSim, attacker: SimPlayerState, e: SimEnemyState, preSlamVx: number, preSlamVy: number,
): boolean {
  if (!hasPlayerBlessing(attacker, 'bullet_heavy_pinball') || e.hp <= 0 || e.isBoss) return false;
  if (Math.hypot(preSlamVx, preSlamVy) <= 1e-4) return false;

  e.kbVx = -preSlamVx * BULLET_HEAVY_PINBALL_REBOUND_RATIO;
  e.kbVy = -preSlamVy * BULLET_HEAVY_PINBALL_REBOUND_RATIO;
  e.pinballReboundTimer = BULLET_HEAVY_PINBALL_REBOUND_SEC;
  e.pinballAttackerId = attacker.id;
  e.pinballHitEnemyIds = [];

  const reboundAng = Math.atan2(e.kbVy, e.kbVx);
  const nudged = sim.map.resolveCircleCollision(e.x + Math.cos(reboundAng) * 6, e.y + Math.sin(reboundAng) * 6, e.radius, true);
  e.x = nudged.x;
  e.y = nudged.y;
  return true;
}

export function updateEnemyHeavyPinballAndTimers(sim: WorldSim, e: SimEnemyState, dtSec: number): void {
  if ((e.tidalRamTimer ?? 0) > 0) {
    const nextTidal = (e.tidalRamTimer ?? 0) - dtSec;
    e.tidalRamTimer = nextTidal <= 1e-6 ? 0 : nextTidal;
    if (e.tidalRamTimer <= 0) e.tidalRamByPlayerId = 0;
  }
  if ((e.fenceSlow50Timer ?? 0) > 0) {
    const nextFence = (e.fenceSlow50Timer ?? 0) - dtSec;
    e.fenceSlow50Timer = nextFence <= 1e-6 ? 0 : nextFence;
  }
  if ((e.pinballReboundTimer ?? 0) <= 0) return;

  const nextPinball = (e.pinballReboundTimer ?? 0) - dtSec;
  e.pinballReboundTimer = nextPinball <= 1e-6 ? 0 : nextPinball;
  if (e.hp <= 0) return;

  if (!Array.isArray(e.pinballHitEnemyIds)) e.pinballHitEnemyIds = [];
  const attackerId = e.pinballAttackerId ?? e.lastHitPlayerId ?? sim.player.id;
  const collideDmg = scaleBlessingDamage(BULLET_HEAVY_PINBALL_COLLIDE_BASE_DMG, sim.currentFloor);

  for (let j = 0; j < sim.enemies.length; j++) {
    const other = sim.enemies[j]!;
    if (
      other.id === e.id || other.hp <= 0 || other.isDummy ||
      other.aiState === 'spawning' || other.bossBurrowed || e.pinballHitEnemyIds.includes(other.id)
    ) {
      continue;
    }
    if (pointToSegmentDist(other.x, other.y, e.prevX, e.prevY, e.x, e.y) <= e.radius + other.radius + 4) {
      e.pinballHitEnemyIds.push(other.id);
      const hitAng = Math.atan2(other.y - e.y, other.x - e.x);
      sim.applyDamageToEnemy(other, collideDmg, false, 'none', hitAng, 140, true, attackerId);
      sim.applyDamageToEnemy(e, collideDmg, false, 'none', hitAng + Math.PI, 0, false, attackerId);

      e.stunTimer = Math.max(e.stunTimer ?? 0, BULLET_HEAVY_PINBALL_COLLIDE_STUN_SEC);
      if (!e.isBoss && e.hp > 0) {
        e.aiState = 'stunned';
        e.stateTimer = Math.max(e.stateTimer, BULLET_HEAVY_PINBALL_COLLIDE_STUN_SEC);
      }
      other.stunTimer = Math.max(other.stunTimer ?? 0, BULLET_HEAVY_PINBALL_COLLIDE_STUN_SEC);
      if (!other.isBoss && other.hp > 0) {
        other.aiState = 'stunned';
        other.stateTimer = Math.max(other.stateTimer, BULLET_HEAVY_PINBALL_COLLIDE_STUN_SEC);
      }
    }
  }
}

function fireCoopArcRelayFromAnchor(sim: WorldSim, owner: SimPlayerState, anchorX: number, anchorY: number, procCoeff = 1.0): boolean {
  let nearest: SimEnemyState | null = null;
  let bestDist = BULLET_COOP_ARC_RELAY_ZAP_RANGE;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) continue;
    const d = distance(anchorX, anchorY, e.x, e.y);
    if (d <= bestDist + e.radius) {
      bestDist = d;
      nearest = e;
    }
  }
  if (!nearest) return false;

  owner.coopArcRelayIcdTimer = BULLET_COOP_ARC_RELAY_ICD_SEC;
  const arcDmg = Math.max(1, Math.round(scaleBlessingDamage(BULLET_COOP_ARC_RELAY_BASE_DMG, sim.currentFloor) * procCoeff));
  const zapAng = Math.atan2(nearest.y - anchorY, nearest.x - anchorX);
  sim.events.push({ kind: 'chain_lightning', fromX: anchorX, fromY: anchorY, toX: nearest.x, toY: nearest.y });
  sim.applyDamageToEnemy(nearest, arcDmg, false, 'shock', zapAng, 80, false, owner.id);
  if (nearest.hp > 0) sim.applyElementStatusToEnemy(nearest, 'shock', arcDmg, owner.id);
  return true;
}

function tryArcRelayAlongSegment(
  sim: WorldSim, owner: SimPlayerState, x1: number, y1: number, x2: number, y2: number,
  passRadius: number, procCoeff: number, allPlayers: SimPlayerState[],
): boolean {
  for (let i = 0; i < allPlayers.length; i++) {
    const ally = allPlayers[i]!;
    if (ally.id === owner.id || ally.lifeState !== 'alive' || ally.hp <= 0) continue;
    if (pointToSegmentDist(ally.x, ally.y, x1, y1, x2, y2) <= passRadius) {
      if (fireCoopArcRelayFromAnchor(sim, owner, ally.x, ally.y, procCoeff)) return true;
    }
  }
  for (let i = 0; i < sim.summons.length; i++) {
    const s = sim.summons[i]!;
    if (s.hp <= 0 || s.ttlSec <= 0 || s.kind === 'life_blossom') continue;
    if (pointToSegmentDist(s.x, s.y, x1, y1, x2, y2) <= passRadius) {
      if (fireCoopArcRelayFromAnchor(sim, owner, s.x, s.y, procCoeff)) return true;
    }
  }
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0 || prop.coverState !== 'flipped' || !isFlippableBarricadeProp(prop.kind)) continue;
    if (pointToSegmentDist(prop.x, prop.y, x1, y1, x2, y2) <= passRadius) {
      if (fireCoopArcRelayFromAnchor(sim, owner, prop.x, prop.y, procCoeff)) return true;
    }
  }
  return false;
}

export function tryTriggerCoopArcRelayForProjectile(sim: WorldSim, b: SimProjectileState, allPlayers: SimPlayerState[]): boolean {
  const owner = b.ownerId === sim.player.id ? sim.player : sim.getPlayerById(b.ownerId);
  if (!owner || owner.blessingIds.length === 0 || (owner.coopArcRelayIcdTimer ?? 0) > 0 || !hasPlayerBlessing(owner, 'bullet_coop_arc_relay')) {
    return false;
  }
  return tryArcRelayAlongSegment(
    sim, owner, b.prevX, b.prevY, b.x, b.y,
    BULLET_COOP_ARC_RELAY_PASS_RADIUS + b.radius, b.procCoefficient ?? 1.0, allPlayers,
  );
}

export function tryTriggerCoopArcRelayForMelee(sim: WorldSim, p: SimPlayerState, meleeRange: number): boolean {
  if (!hasPlayerBlessing(p, 'bullet_coop_arc_relay') || (p.coopArcRelayIcdTimer ?? 0) > 0) return false;
  const tipX = p.x + Math.cos(p.aimAngle) * meleeRange;
  const tipY = p.y + Math.sin(p.aimAngle) * meleeRange;
  return tryArcRelayAlongSegment(sim, p, p.x, p.y, tipX, tipY, BULLET_COOP_ARC_RELAY_PASS_RADIUS, 1.0, sim.getAllPlayers());
}

export function applyPlayerProjectileMidFlightSynergiesAndBlessings(
  sim: WorldSim,
  b: SimProjectileState,
  allPlayers: SimPlayerState[],
  hasArcRelayBlessing = true,
  hasActiveVanguardShield = true,
): boolean {
  if (hasArcRelayBlessing) {
    tryTriggerCoopArcRelayForProjectile(sim, b, allPlayers);
  }

  // 1. Vanguard Shield Co-op Synergy & vanguard_bastion_prism ally bullet split
  if (hasActiveVanguardShield && !b.amplifiedByShield && b.weaponId !== 'vanguard_bastion_prism') {
    const shieldMaxR = 42 + b.radius;
    const shieldMaxRSq = shieldMaxR * shieldMaxR;
    for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
      const pl = allPlayers[pIdx]!;
      if (pl.lifeState !== 'alive' || pl.characterId !== 'vanguard' || pl.skillActiveTimer <= 0) continue;
      const dx = b.x - pl.x;
      const dy = b.y - pl.y;
      if (dx * dx + dy * dy <= shieldMaxRSq) {
        const angFromVanguard = Math.atan2(dy, dx);
        const hasBastionPrism = hasPlayerBlessing(pl, 'vanguard_bastion_prism');
        const halfShieldArc = hasBastionPrism ? Math.PI : (65 * Math.PI) / 180;
        if (Math.abs(angleDiff(angFromVanguard, pl.aimAngle)) <= halfShieldArc) {
          b.amplifiedByShield = true;
          b.damage = Math.round(b.damage * 1.3);
          b.pierceRemaining += 1;
          if (hasBastionPrism && b.weaponId !== 'void_staff' && b.weaponId !== 'emerald_cleaver_boomerang') {
            if ((b.splitGeneration ?? 0) >= 1) {
              b.splitGeneration = 1;
              b.bounceRemaining = clampBounceCount((b.bounceRemaining ?? 0) + 1);
              b.shotFlags = (b.shotFlags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE;
              break;
            }
            spawnSplitTwinProjectiles(
              sim, b, b.x, b.y, b.angle, (12 * Math.PI) / 180,
              b.damage, clampBounceCount(b.bounceRemaining), true, 1.0,
            );
            return true;
          }
          break;
        }
      }
    }
  }

  // 2. Elementalist Skill Zone Synergy
  for (let zIdx = 0; zIdx < sim.skillZones.length; zIdx++) {
    const z = sim.skillZones[zIdx]!;
    if (z.ttlSec <= 0) continue;
    const zdx = b.x - z.x;
    const zdy = b.y - z.y;
    if (zdx * zdx + zdy * zdy <= z.radius * z.radius && !b.hitEntityIds.includes(z.id)) {
      b.hitEntityIds.push(z.id);
      b.imbuedByZone = true;
      b.imbuedOwnerId = z.ownerPlayerId;
      if (b.element === 'none') {
        b.element = z.element;
        if (z.secondaryElement && z.secondaryElement !== 'none') b.imbuedSecondaryElement = z.secondaryElement;
      } else {
        b.imbuedElement = z.element;
        if (z.secondaryElement && z.secondaryElement !== 'none') b.imbuedSecondaryElement = z.secondaryElement;
      }
      b.damage = Math.round(b.damage * 1.15);
    }
  }

  // 3. Engineer Tesla Turret Co-op Synergy & Druid Sacred Grove Canopy (+1 Smart Bounce)
  for (let sIdx = 0; sIdx < sim.summons.length; sIdx++) {
    const sum = sim.summons[sIdx]!;
    if (sum.hp <= 0 || sum.ttlSec <= 0) continue;
    const sdx = b.x - sum.x;
    const sdy = b.y - sum.y;
    const sDistSq = sdx * sdx + sdy * sdy;
    if (sum.kind === 'tesla_turret' && b.weaponId !== 'tesla_turret' && b.weaponId !== 'ancient_turret') {
      const hitR = sum.radius + b.radius + 6;
      if (sDistSq <= hitR * hitR && !b.hitEntityIds.includes(sum.id)) {
        b.hitEntityIds.push(sum.id);
        sum.charge = Math.min(100, sum.charge + (b.element !== 'none' ? 50 : 35));
        if (sum.charge >= 100) sim.triggerTeslaEmpBlast(sum);
      }
    } else if (sum.kind === 'sacred_tree' && !b.passedThroughCoverOrPrism && sum.sacredGrove) {
      if (sDistSq <= sum.auraRadius * sum.auraRadius && !b.hitEntityIds.includes(sum.id)) {
        b.hitEntityIds.push(sum.id);
        b.bounceRemaining = clampBounceCount((b.bounceRemaining ?? 0) + 1);
        b.passedThroughCoverOrPrism = true;
        b.shotFlags = (b.shotFlags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE;
      }
    }
  }
  return false;
}

export function tryBlockOrReflectEnemyProjectileByVanguardShield(
  sim: WorldSim, b: SimProjectileState, allPlayers: SimPlayerState[], midFlightDestroyedIds: number[],
): boolean {
  const outerMaxR = 38 + b.radius;
  const outerMaxRSq = outerMaxR * outerMaxR;
  for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
    const pl = allPlayers[pIdx]!;
    if (pl.lifeState !== 'alive' || pl.characterId !== 'vanguard' || pl.skillActiveTimer <= 0) continue;
    const dx = b.x - pl.x;
    const dy = b.y - pl.y;
    const pdx = b.x - pl.prevX;
    const pdy = b.y - pl.prevY;
    const dToPlayerSq = dx * dx + dy * dy;
    const dToPrevSq = pdx * pdx + pdy * pdy;
    if (dToPlayerSq > outerMaxRSq && dToPrevSq > outerMaxRSq) continue;
    const hasFortress = hasPlayerBlessing(pl, 'vanguard_bastion_prism');
    const shieldRadius = hasFortress ? 34 : 38;
    const maxR = shieldRadius + b.radius;
    const maxRSq = maxR * maxR;
    const minR = pl.radius * 0.5;
    const minRSq = minR * minR;
    const halfShieldArc = hasFortress ? Math.PI : (60 * Math.PI) / 180;
    const inCurrCone =
      dToPlayerSq <= maxRSq && dToPlayerSq >= minRSq &&
      Math.abs(angleDiff(Math.atan2(dy, dx), pl.aimAngle)) <= halfShieldArc;
    const inPrevCone =
      dToPrevSq <= maxRSq && dToPrevSq >= minRSq &&
      Math.abs(angleDiff(Math.atan2(pdy, pdx), pl.aimAngle)) <= halfShieldArc;
    if (inCurrCone || inPrevCone) {
      b.ttlSec = 0;
      midFlightDestroyedIds.push(b.id);
      pl.shieldStoredBullets += 1;
      const activeWepId = pl.weaponSlots[pl.activeWeaponSlot] ?? pl.weaponSlots[0] ?? 'knight_sword';
      const activeWep = WEAPONS[activeWepId];
      if (activeWep?.cadenceKind === 'HEAT_VENT') pl.weaponHeat = Math.max(0, pl.weaponHeat - 15);
      else if (pl.clipMax > 0) pl.clipAmmo = Math.min(pl.clipMax, pl.clipAmmo + 1);
      pl.vanguardShieldBonusAdd = Math.min(0.75, (pl.vanguardShieldBonusAdd ?? 0) + 0.15);
      sim.events.push({
        kind: 'projectile_impact', x: b.x, y: b.y, angle: b.angle, team: 'enemy',
        hitWall: false, destroyedByMelee: false, blockedByShield: true, isCrit: false,
      });

      if (hasFortress) {
        const reflectDmg = scaleBlessingDamage(20, sim.currentFloor);
        const ownerEnemy = sim.enemies.find((e) => e.id === b.ownerId && e.hp > 0);
        const reflectAng = ownerEnemy ? Math.atan2(ownerEnemy.y - b.y, ownerEnemy.x - b.x) : b.angle + Math.PI;
        const speed = Math.max(540, Math.hypot(b.vx, b.vy) * 1.35);
        sim.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned', tick: sim.tick, eventId: sim.nextVolleyEventId++,
          ownerId: pl.id, team: 'player', weaponId: 'vanguard_bastion_prism',
          x: b.x, y: b.y, angle: reflectAng, pelletCount: 1, spreadRad: 0,
          speed, damage: reflectDmg, radius: 6, knockback: 150, pierceCount: 0,
          bounceCount: 0, ttlSec: 1.1, element: 'burn', critChance: 0,
          amplifiedByShield: true, seed: sim.rng.nextUint32(),
        });
      }
      return true;
    }
  }
  return false;
}

export function propagateRangerPreyChainDamageAndKnockback(
  sim: WorldSim, enemy: SimEnemyState, dmg: number, hitAngleRad: number,
  kbX: number, kbY: number, attackerPlayerId: number, attackerPl: SimPlayerState, isChainDamage: boolean,
): void {
  if (isChainDamage || enemy.markedTimer <= 0) return;
  const markOwner = enemy.markedByPlayerId > 0 ? sim.getPlayerById(enemy.markedByPlayerId) : attackerPl;
  if (!hasPlayerBlessing(markOwner, 'ranger_prey_chain') && !hasPlayerBlessing(attackerPl, 'ranger_prey_chain')) return;

  const chainAmt = Math.max(1, Math.round(dmg * 0.35));
  let chained = 0;
  for (let i = 0; i < sim.enemies.length && chained < 3; i++) {
    const other = sim.enemies[i]!;
    if (other.id === enemy.id || other.hp <= 0 || other.aiState === 'spawning') continue;
    if (distance(enemy.x, enemy.y, other.x, other.y) <= 220) {
      chained += 1;
      other.markedTimer = Math.max(other.markedTimer, 4.0);
      other.markedByPlayerId = enemy.markedByPlayerId || attackerPlayerId;
      sim.applyDamageToEnemy(other, chainAmt, false, 'none', hitAngleRad, 0, false, attackerPlayerId, true);
      if (other.hp > 0 && !other.isBoss) {
        other.kbVx += kbX * 0.65;
        other.kbVy += kbY * 0.65;
      }
    }
  }
}

export function spawnElementalistOrbSkillZones(
  sim: WorldSim, p: SimPlayerState, orbEl: ElementType, nextEl: ElementType, durationSec: number,
): void {
  const hasVortex = hasPlayerBlessing(p, 'elementalist_vortex');
  const hasDual = hasPlayerBlessing(p, 'elementalist_twin_orbit');
  const zoneRadius = 76;
  const baseX = clamp(p.x + Math.cos(p.aimAngle) * 115, TILE_SIZE * 2, sim.map.width - TILE_SIZE * 2);
  const baseY = clamp(p.y + Math.sin(p.aimAngle) * 115, TILE_SIZE * 2, sim.map.height - TILE_SIZE * 2);

  if (!hasDual) {
    sim.skillZones.push({
      id: ++sim.nextEntityId, ownerPlayerId: p.id, x: baseX, y: baseY, radius: zoneRadius,
      ttlSec: durationSec, maxTtlSec: durationSec, tickTimer: 0.45,
      element: orbEl, secondaryElement: 'none', vortex: hasVortex,
    });
    sim.applyElementAtWorldPoint(baseX, baseY, orbEl, 58);
    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp > 0 && distance(baseX, baseY, e.x, e.y) <= zoneRadius + e.radius) {
        sim.applyDamageToEnemy(e, 18, true, orbEl, Math.atan2(e.y - baseY, e.x - baseX), 140, true, p.id);
      }
    }
    return;
  }

  const perpAngle = p.aimAngle + Math.PI * 0.5;
  const cx = clamp(baseX, TILE_SIZE * 2 + 80, sim.map.width - TILE_SIZE * 2 - 80);
  const cy = clamp(baseY, TILE_SIZE * 2 + 80, sim.map.height - TILE_SIZE * 2 - 80);
  const x1 = cx - Math.cos(perpAngle) * 80;
  const y1 = cy - Math.sin(perpAngle) * 80;
  const x2 = cx + Math.cos(perpAngle) * 80;
  const y2 = cy + Math.sin(perpAngle) * 80;
  const id1 = ++sim.nextEntityId;
  const id2 = ++sim.nextEntityId;

  sim.skillZones.push(
    {
      id: id1, ownerPlayerId: p.id, x: x1, y: y1, radius: zoneRadius,
      ttlSec: durationSec, maxTtlSec: durationSec, tickTimer: 0.45,
      element: orbEl, secondaryElement: nextEl, vortex: hasVortex, linkedZoneId: id2,
    },
    {
      id: id2, ownerPlayerId: p.id, x: x2, y: y2, radius: zoneRadius,
      ttlSec: durationSec, maxTtlSec: durationSec, tickTimer: 0.45,
      element: nextEl, secondaryElement: 'none', vortex: hasVortex, linkedZoneId: id1, isTwinSecondary: true,
    },
  );
  sim.applyElementAtWorldPoint(x1, y1, orbEl, 58);
  sim.applyElementAtWorldPoint(x2, y2, nextEl, 58);
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0) continue;
    if (distance(x1, y1, e.x, e.y) <= zoneRadius + e.radius) {
      sim.applyDamageToEnemy(e, 18, true, orbEl, Math.atan2(e.y - y1, e.x - x1), 140, true, p.id);
    } else if (distance(x2, y2, e.x, e.y) <= zoneRadius + e.radius) {
      sim.applyDamageToEnemy(e, 18, true, nextEl, Math.atan2(e.y - y2, e.x - x2), 140, true, p.id);
    }
  }
}

export function updateElementalistVortexPropsAndTwinBeam(
  sim: WorldSim, z: SimSkillZoneState, dtSec: number, didTickThisStep: boolean,
): void {
  if (z.vortex) {
    const pullRadius = Math.max(150, z.radius + 60);
    const propPullSpeed = 125 * dtSec;
    for (let k = 0; k < sim.props.length; k++) {
      const prop = sim.props[k]!;
      if (prop.hp <= 0 || prop.coverState === 'sliding' || !isCircularKickableToyProp(prop.kind)) continue;
      const d = distance(z.x, z.y, prop.x, prop.y);
      if (d > 10 && d <= pullRadius) {
        const col = sim.map.resolveCircleCollision(
          prop.x + ((z.x - prop.x) / d) * propPullSpeed,
          prop.y + ((z.y - prop.y) / d) * propPullSpeed,
          prop.radius,
        );
        prop.x = col.x;
        prop.y = col.y;
      }
    }
  }

  if (didTickThisStep && z.linkedZoneId && !z.isTwinSecondary) {
    const partner = sim.skillZones.find((o) => o.id === z.linkedZoneId && o.ttlSec > 0);
    if (partner) {
      const beamDmg = scaleBlessingDamage(12, sim.currentFloor);
      sim.events.push({ kind: 'chain_lightning', fromX: z.x, fromY: z.y, toX: partner.x, toY: partner.y });
      const beamAng = Math.atan2(partner.y - z.y, partner.x - z.x);
      for (let j = 0; j < sim.enemies.length; j++) {
        const e = sim.enemies[j]!;
        if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
        if (pointToSegmentDist(e.x, e.y, z.x, z.y, partner.x, partner.y) <= e.radius + 24) {
          sim.applyDamageToEnemy(e, beamDmg, false, z.element, beamAng, 25, false, z.ownerPlayerId);
          if (e.hp > 0 && partner.element !== 'none') {
            sim.applyElementStatusToEnemy(e, partner.element, beamDmg, z.ownerPlayerId);
          }
        }
      }
    }
  }
}
