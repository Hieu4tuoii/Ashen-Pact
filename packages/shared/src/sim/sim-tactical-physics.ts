import { ENEMIES } from '../data/enemies.js';
import { angleDiff, distance } from '../math/vec2.js';
import {
  clearCollapsedPillarFootprintOnMap,
  findNearestWalkablePoint,
  getConveyorVelocityAtWorld,
} from './arena-room-archetypes.js';
import {
  BIOME2_ICE_INERTIA_MULT,
  refractProjectileThroughCryoPrism,
  shatterGlacialBarricade,
  triggerBiome2WallSlamCryoPulse,
  updateP1CTacticalProps,
} from './sim-tactical-physics-p1c.js';
import type { WorldSim } from './world-sim.js';
import type { PropKind, SimEnemyState, SimPlayerState, SimPropState } from './world-sim-types.js';

export {
  BIOME2_ICE_INERTIA_MULT,
  refractProjectileThroughCryoPrism,
  shatterGlacialBarricade,
  triggerBiome2WallSlamCryoPulse,
  updateP1CTacticalProps,
};

export const FLIPPABLE_BARRICADE_KINDS: readonly PropKind[] = ['moss_table', 'glacial_barricade', 'forge_blast_shield'] as const;
export const CIRCULAR_KICKABLE_TOY_KINDS: readonly PropKind[] = ['explosive_barrel', 'volatile_spore_pod', 'sliding_ice_block', 'slag_crucible'] as const;
export const FLIP_COVER_MICRO_BLANK_RADIUS = 56;
export const FLIP_COVER_MICRO_BLANK_DURATION_SEC = 0.15;
export const FLIP_COVER_KNOCKBACK_RADIUS = 64;
export const FLIP_COVER_KNOCKBACK_SPEED = 180;
export const DASH_KICK_DOT_THRESHOLD = 0.45;
export const SLIDING_PROP_DEFAULT_SPEED = 520;
export const SLIDING_ICE_BLOCK_SPEED = 600;
export const SLIDING_PROP_ENEMY_KB_SPEED = 260;
export const SLIDING_PROP_ENEMY_STUN_SEC = 1.0;
export const WALL_SLAM_SPEED_THRESHOLD = 120;
export const WALL_SLAM_COOLDOWN_SEC = 0.35;
export const WALL_SLAM_STUN_SEC = 0.4;
export const BIOME1_POLLEN_SPEED_BOOST_DURATION_SEC = 2.0;
export const BIOME1_POLLEN_SPEED_MULTIPLIER = 1.25;
export const MOSS_TABLE_POLLEN_ARMOR_RADIUS = 72;
export const VOLATILE_SPORE_POD_BLAST_RADIUS = 96;
export const VOLATILE_SPORE_POD_ROOT_SEC = 1.2;
export const ROTTEN_TOTEM_FALL_LENGTH = 160;
export const ROTTEN_TOTEM_FALL_WIDTH = 56;
export const ROTTEN_TOTEM_STUN_SEC = 1.5;

export function isFlippableBarricadeProp(kind: PropKind): boolean {
  return kind === 'moss_table' || kind === 'glacial_barricade' || kind === 'forge_blast_shield';
}

export function isCircularKickableToyProp(kind: PropKind): boolean {
  return kind === 'explosive_barrel' || kind === 'volatile_spore_pod' || kind === 'sliding_ice_block' || kind === 'slag_crucible';
}

export function isKickableProp(prop: Pick<SimPropState, 'kind' | 'coverState' | 'hp'>): boolean {
  if (prop.hp <= 0 || prop.coverState === 'sliding' || prop.coverState === 'fallen') return false;
  return isCircularKickableToyProp(prop.kind) || (isFlippableBarricadeProp(prop.kind) && prop.coverState === 'flipped');
}

export function getFlippedBarricadeHp(kind: PropKind): number {
  if (kind === 'glacial_barricade') return 65;
  if (kind === 'forge_blast_shield') return 85;
  return 60;
}

export interface TacticalPropSpawnSpec {
  radius: number;
  hp: number;
  destructible: boolean;
  explosive: boolean;
  blocksMovement: boolean;
  lightRadius: number;
  lightColorHex: string;
  coverState?: 'low' | 'flipped' | 'sliding' | 'fallen';
  blocksEnemyProjectiles?: boolean;
  bouncesRemaining?: number;
  ttlSec?: number;
}

export function getTacticalPropSpawnSpec(kind: PropKind): TacticalPropSpawnSpec | null {
  if (isFlippableBarricadeProp(kind)) {
    return { radius: 18, hp: getFlippedBarricadeHp(kind), destructible: false, explosive: false, blocksMovement: false, lightRadius: 0, lightColorHex: '#94A3B8', coverState: 'low', blocksEnemyProjectiles: false };
  }
  switch (kind) {
    case 'volatile_spore_pod':
      return { radius: 16, hp: 25, destructible: true, explosive: true, blocksMovement: true, lightRadius: 80, lightColorHex: '#84CC16' };
    case 'glacial_spike':
      return { radius: 14, hp: 45, destructible: true, explosive: false, blocksMovement: true, lightRadius: 55, lightColorHex: '#38BDF8', blocksEnemyProjectiles: true, ttlSec: 4.0 };
    case 'sliding_ice_block':
      return { radius: 16, hp: 40, destructible: true, explosive: false, blocksMovement: true, lightRadius: 65, lightColorHex: '#38BDF8', bouncesRemaining: 1 };
    case 'slag_crucible':
      return { radius: 15, hp: 20, destructible: true, explosive: true, blocksMovement: true, lightRadius: 95, lightColorHex: '#F97316' };
    case 'rotten_totem_pillar':
      return { radius: 20, hp: 45, destructible: true, explosive: false, blocksMovement: true, lightRadius: 90, lightColorHex: '#A3E635' };
    case 'cryo_prism_pillar':
      return { radius: 18, hp: 80, destructible: true, explosive: false, blocksMovement: true, lightRadius: 90, lightColorHex: '#67E8F9' };
    case 'pneumatic_press':
      return { radius: 20, hp: 9999, destructible: false, explosive: false, blocksMovement: true, lightRadius: 70, lightColorHex: '#FB923C' };
    default:
      return null;
  }
}

export function computeFloorScalingMultiplier(globalFloor: number): number {
  return 1 + 0.22 * (Math.max(1, globalFloor || 1) - 1);
}

export function computeKickSlideDamage(enemy: Pick<SimEnemyState, 'maxHp' | 'isElite' | 'isBoss'>, globalFloor: number): number {
  const floorMult = computeFloorScalingMultiplier(globalFloor);
  const alphaKick = enemy.isBoss ? 0.015 : enemy.isElite ? 0.05 : 0.10;
  return Math.round(20 * floorMult + alphaKick * enemy.maxHp);
}

export function computeWallSlamDamage(
  enemy: Pick<SimEnemyState, 'maxHp' | 'isElite' | 'isBoss' | 'lastHitDmg'>,
  globalFloor: number,
): number {
  const floorMult = computeFloorScalingMultiplier(globalFloor);
  const alphaSlam = enemy.isBoss ? 0.01 : enemy.isElite ? 0.04 : 0.08;
  return Math.round(14 * floorMult + 0.30 * Math.max(0, enemy.lastHitDmg ?? 0) + alphaSlam * enemy.maxHp);
}

export function computeHazardDamage(enemy: Pick<SimEnemyState, 'maxHp' | 'isBoss'>, globalFloor: number, baseHazardDmg = 28): number {
  if (enemy.isBoss) return Math.round(0.06 * enemy.maxHp);
  return Math.round(baseHazardDmg * computeFloorScalingMultiplier(globalFloor) + 0.20 * enemy.maxHp);
}

export function triggerGrassPollenSpeedBoost(sim: WorldSim, player: SimPlayerState = sim.player): boolean {
  if (sim.map.isBossRoom || sim.map.getSurfaceAtWorld(player.x, player.y) !== 'grass') return false;
  player.pollenSpeedBoostTimer = BIOME1_POLLEN_SPEED_BOOST_DURATION_SEC;
  if (!sim.stressTestActive) sim.events.push({ kind: 'grass_rustle', x: player.x, y: player.y });
  return true;
}

export function triggerMossTablePollenArmorBurst(sim: WorldSim, prop: SimPropState): number {
  let healedCount = 0;
  for (const pl of sim.getAllPlayers()) {
    if (pl.lifeState !== 'alive' || pl.hp <= 0) continue;
    if (distance(prop.x, prop.y, pl.x, pl.y) <= MOSS_TABLE_POLLEN_ARMOR_RADIUS + pl.radius) {
      pl.armor = Math.min(pl.maxArmor, pl.armor + 1);
      healedCount++;
    }
  }
  return healedCount;
}

export function detonateVolatileSporePod(sim: WorldSim, pod: SimPropState): void {
  if (pod.hp <= 0 && !pod.explosive) return;
  pod.hp = 0;
  pod.fuseTimer = 0;
  pod.explosive = false;

  const ownerId = pod.slideOwnerPlayerId ?? sim.player.id;
  sim.events.push({ kind: 'prop_destroyed', propId: pod.id, propKind: pod.kind, x: pod.x, y: pod.y });
  sim.events.push({ kind: 'explosion', x: pod.x, y: pod.y, radius: VOLATILE_SPORE_POD_BLAST_RADIUS, damage: 12, sourceDefId: 'volatile_spore_pod' });

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.aiState === 'spawning') continue;
    if (distance(pod.x, pod.y, e.x, e.y) <= VOLATILE_SPORE_POD_BLAST_RADIUS + e.radius) {
      e.rootedTimer = Math.max(e.rootedTimer, VOLATILE_SPORE_POD_ROOT_SEC);
      e.vx = 0; e.vy = 0;
      sim.events.push({ kind: 'status_applied', targetId: e.id, status: 'rooted', x: e.x, y: e.y });
      sim.applyElementStatusToEnemy(e, 'poison', 12, ownerId);
      if (e.hp > 0 && e.poisonTimer <= 0) {
        e.poisonTimer = 4.0; e.poisonStacks = Math.max(1, e.poisonStacks); e.poisonTickTimer = 0.6;
      }
    }
  }
}

export function collapseRottenTotemPillar(sim: WorldSim, pillar: SimPropState, fallAngle?: number, attackerId = sim.player.id): boolean {
  if (pillar.coverState === 'fallen') return false;
  const resolvedAngle =
    fallAngle ??
    pillar.fallAngle ??
    (distance(pillar.x, pillar.y, sim.player.x, sim.player.y) > 0.001
      ? Math.atan2(pillar.y - sim.player.y, pillar.x - sim.player.x)
      : sim.player.aimAngle);

  pillar.hp = 0; pillar.destructible = false; pillar.blocksMovement = false; pillar.blocksEnemyProjectiles = false;
  pillar.coverState = 'fallen'; pillar.fallAngle = resolvedAngle;
  clearCollapsedPillarFootprintOnMap(sim.map, pillar.x, pillar.y);
  sim.events.push({ kind: 'prop_destroyed', propId: pillar.id, propKind: pillar.kind, x: pillar.x, y: pillar.y });

  const dirX = Math.cos(resolvedAngle);
  const dirY = Math.sin(resolvedAngle);
  const halfWidth = ROTTEN_TOTEM_FALL_WIDTH * 0.5;

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy) continue;
    const relX = e.x - pillar.x;
    const relY = e.y - pillar.y;
    const along = relX * dirX + relY * dirY;
    const signedPerp = -relX * dirY + relY * dirX;
    const clampedAlong = Math.max(0, Math.min(ROTTEN_TOTEM_FALL_LENGTH, along));
    const clampedPerp = Math.max(-halfWidth, Math.min(halfWidth, signedPerp));
    if (along >= 0 && Math.hypot(along - clampedAlong, signedPerp - clampedPerp) <= e.radius) {
      const dmg = computeHazardDamage(e, sim.currentFloor, 28);
      e.hp = Math.max(0, e.hp - dmg); e.hitFlashTimer = 0.14; e.lastHitDmg = dmg;
      e.stunTimer = Math.max(e.stunTimer ?? 0, ROTTEN_TOTEM_STUN_SEC);
      e.aiState = 'stunned'; e.stateTimer = Math.max(e.stateTimer, ROTTEN_TOTEM_STUN_SEC);
      e.vx = 0; e.vy = 0;
      sim.events.push({
        kind: 'damage_dealt', targetId: e.id, targetKind: 'enemy', x: e.x, y: e.y,
        amount: dmg, isCrit: false, hitArmor: false, element: 'none', knockbackX: 0, knockbackY: 0,
      });
      sim.checkBossPhaseTransitions(e);
      if (e.hp <= 0) sim.handleEnemyKilled(e, attackerId);
    }
  }
  return true;
}

export function clearEnemyProjectilesAroundProp(sim: WorldSim, x: number, y: number, radius: number): number {
  const destroyedIds: number[] = [];
  for (let i = sim.projectiles.length - 1; i >= 0; i--) {
    const proj = sim.projectiles[i]!;
    if (proj.team !== 'enemy') continue;
    if (distance(proj.x, proj.y, x, y) <= radius + proj.radius) {
      destroyedIds.push(proj.id);
      sim.projectiles.splice(i, 1);
      sim.releaseProjectileToPool(proj);
    }
  }
  if (destroyedIds.length > 0) sim.events.push({ kind: 'projectiles_destroyed', ids: destroyedIds });
  return destroyedIds.length;
}

export function flipCoverProp(sim: WorldSim, prop: SimPropState, actor: SimPlayerState = sim.player): boolean {
  if (prop.hp <= 0 || !isFlippableBarricadeProp(prop.kind) || prop.coverState !== 'low') return false;

  const flippedHp = getFlippedBarricadeHp(prop.kind);
  prop.coverState = 'flipped'; prop.blocksMovement = true; prop.blocksEnemyProjectiles = true; prop.destructible = true;
  prop.hp = flippedHp; prop.maxHp = flippedHp; prop.microBlankTimer = FLIP_COVER_MICRO_BLANK_DURATION_SEC;

  const bulletsCleared = clearEnemyProjectilesAroundProp(sim, prop.x, prop.y, FLIP_COVER_MICRO_BLANK_RADIUS);

  for (const e of sim.enemies) {
    if (e.hp <= 0) continue;
    const dist = distance(e.x, e.y, prop.x, prop.y);
    if (dist <= FLIP_COVER_KNOCKBACK_RADIUS + e.radius) {
      const ang = dist > 0.001 ? Math.atan2(e.y - prop.y, e.x - prop.x) : actor.aimAngle;
      e.kbVx += Math.cos(ang) * FLIP_COVER_KNOCKBACK_SPEED;
      e.kbVy += Math.sin(ang) * FLIP_COVER_KNOCKBACK_SPEED;
      const minDist = prop.radius + e.radius;
      if (dist < minDist) {
        const pushOut = minDist - dist + 1;
        e.x += Math.cos(ang) * pushOut;
        e.y += Math.sin(ang) * pushOut;
      }
    }
  }

  sim.events.push({
    kind: 'cover_flipped', propId: prop.id, playerId: actor.id, x: prop.x, y: prop.y,
    radius: FLIP_COVER_MICRO_BLANK_RADIUS, bulletsCleared,
  });
  return true;
}

export function flipCoverPropImpl(this: WorldSim, prop: SimPropState, actor: SimPlayerState = this.player): boolean {
  return flipCoverProp(this, prop, actor);
}

export function kickProp(sim: WorldSim, prop: SimPropState, actor: SimPlayerState = sim.player, customAngle?: number): boolean {
  if (!isKickableProp(prop)) return false;
  const slideAngle = customAngle ?? actor.aimAngle;
  const baseSpeed = prop.kind === 'sliding_ice_block' ? SLIDING_ICE_BLOCK_SPEED : SLIDING_PROP_DEFAULT_SPEED;
  const onIce =
    sim.map.getSurfaceAtWorld(prop.x, prop.y) === 'ice' ||
    sim.map.getSurfaceAtWorld(actor.x, actor.y) === 'ice';
  const speed = onIce ? baseSpeed * BIOME2_ICE_INERTIA_MULT : baseSpeed;

  prop.coverState = 'sliding'; prop.blocksMovement = false; prop.blocksEnemyProjectiles = false;
  prop.vx = Math.cos(slideAngle) * speed; prop.vy = Math.sin(slideAngle) * speed;
  prop.iceSpeedBoostApplied = onIce;
  prop.slideOwnerPlayerId = actor.id; prop.hitEnemyIds = [];
  if (prop.kind === 'sliding_ice_block' && prop.bouncesRemaining === undefined) prop.bouncesRemaining = 1;

  sim.events.push({ kind: 'prop_kicked', propId: prop.id, playerId: actor.id, x: prop.x, y: prop.y, vx: prop.vx, vy: prop.vy });
  return true;
}

export function kickPropImpl(this: WorldSim, prop: SimPropState, actor: SimPlayerState = this.player, customAngle?: number): boolean {
  return kickProp(this, prop, actor, customAngle);
}

export function triggerMeleeKickProps(sim: WorldSim, player: SimPlayerState, halfArc: number, range: number, attackAngle = player.aimAngle): number {
  let kickedCount = 0;
  for (const prop of sim.props) {
    if (!isKickableProp(prop)) continue;
    const dist = distance(player.x, player.y, prop.x, prop.y);
    if (dist > range + prop.radius) continue;
    const angToProp = Math.atan2(prop.y - player.y, prop.x - player.x);
    if (dist <= player.radius + prop.radius + 8 || Math.abs(angleDiff(attackAngle, angToProp)) <= halfArc) {
      if (kickProp(sim, prop, player, attackAngle)) kickedCount++;
    }
  }
  return kickedCount;
}

function isPlayerEntity(entity: { x: number; y: number; radius: number }): entity is SimPlayerState {
  return 'dashTimer' in entity && 'aimAngle' in entity && 'weaponSlots' in entity;
}

function isEnemyEntity(entity: { x: number; y: number; radius: number }): entity is SimEnemyState {
  return 'defId' in entity && 'aiState' in entity && 'kbVx' in entity;
}

export function resolvePropMovementCollision(sim: WorldSim, entity: { x: number; y: number; radius: number }): void {
  if (sim.props.length === 0) return;
  const asPlayer = isPlayerEntity(entity) ? entity : null;
  const asEnemy = asPlayer ? null : isEnemyEntity(entity) ? entity : null;

  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0 || prop.coverState === 'sliding' || prop.coverState === 'fallen') continue;

    const dx = entity.x - prop.x;
    const dy = entity.y - prop.y;
    const minDist = entity.radius + prop.radius;
    const distSq = dx * dx + dy * dy;
    if (distSq >= minDist * minDist) continue;
    const dist = Math.sqrt(distSq);

    if (asPlayer && asPlayer.dashTimer > 0) {
      if (isCircularKickableToyProp(prop.kind)) {
        kickProp(sim, prop, asPlayer, asPlayer.aimAngle);
        continue;
      }
      if (isFlippableBarricadeProp(prop.kind) && prop.coverState === 'flipped') {
        const toPropLen = Math.max(0.0001, dist);
        const toPropX = (prop.x - asPlayer.x) / toPropLen;
        const toPropY = (prop.y - asPlayer.y) / toPropLen;
        const dashLen = Math.hypot(asPlayer.dashDirX, asPlayer.dashDirY);
        const dashDirX = dashLen > 0.0001 ? asPlayer.dashDirX / dashLen : Math.cos(asPlayer.aimAngle);
        const dashDirY = dashLen > 0.0001 ? asPlayer.dashDirY / dashLen : Math.sin(asPlayer.aimAngle);
        if (dashDirX * toPropX + dashDirY * toPropY >= DASH_KICK_DOT_THRESHOLD) {
          kickProp(sim, prop, asPlayer, asPlayer.aimAngle);
          continue;
        }
      }
    }

    if (!prop.blocksMovement) continue;

    if (asEnemy) {
      const kbSpeed = Math.hypot(asEnemy.kbVx, asEnemy.kbVy);
      if (kbSpeed >= WALL_SLAM_SPEED_THRESHOLD && (asEnemy.wallSlamCooldownTimer ?? 0) <= 0) {
        triggerEnemyWallSlam(sim, asEnemy, prop);
        if (prop.hp <= 0) continue;
      }
    }

    if (dist > 0.0001) {
      const push = minDist - dist;
      entity.x += (dx / dist) * push;
      entity.y += (dy / dist) * push;
    } else {
      entity.x += minDist;
    }
  }
}

export function resolvePropMovementCollisionImpl(this: WorldSim, entity: { x: number; y: number; radius: number }): void {
  resolvePropMovementCollision(this, entity);
}

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 0.000001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

function destroyTacticalProp(sim: WorldSim, prop: SimPropState): void {
  if (prop.kind === 'volatile_spore_pod') {
    detonateVolatileSporePod(sim, prop);
    return;
  }
  if (prop.kind === 'glacial_barricade') {
    shatterGlacialBarricade(
      sim,
      prop,
      Math.atan2(prop.vy ?? 0, prop.vx ?? 1),
      prop.slideOwnerPlayerId ?? sim.player.id,
    );
    return;
  }
  prop.destructible = true;
  if (prop.hp <= 0) prop.hp = 1;
  sim.damageProp(prop, prop.hp + 999, prop.explosive ? 'burn' : 'none');
}

export function updateSlidingPropsImpl(this: WorldSim, dtSec: number): void {
  updateP1CTacticalProps(this, dtSec);
  for (let i = 0; i < this.props.length; i++) {
    const prop = this.props[i]!;
    if (prop.hp <= 0) continue;

    if ((prop.microBlankTimer ?? 0) > 0 && prop.coverState === 'flipped') {
      prop.microBlankTimer = Math.max(0, (prop.microBlankTimer ?? 0) - dtSec);
      clearEnemyProjectilesAroundProp(this, prop.x, prop.y, FLIP_COVER_MICRO_BLANK_RADIUS);
    }

    if (prop.coverState !== 'sliding') continue;

    if (!prop.iceSpeedBoostApplied && this.map.getSurfaceAtWorld(prop.x, prop.y) === 'ice') {
      prop.vx = (prop.vx ?? 0) * BIOME2_ICE_INERTIA_MULT;
      prop.vy = (prop.vy ?? 0) * BIOME2_ICE_INERTIA_MULT;
      prop.iceSpeedBoostApplied = true;
    }

    const vx = prop.vx ?? 0;
    const vy = prop.vy ?? 0;
    const speed = Math.hypot(vx, vy);
    if (speed <= 1) {
      destroyTacticalProp(this, prop);
      continue;
    }

    const oldX = prop.x;
    const oldY = prop.y;
    const convVx = getConveyorVelocityAtWorld(this.map, prop.x, prop.y);
    const nextX = oldX + (vx + convVx) * dtSec;
    const nextY = oldY + vy * dtSec;
    const slideAngle = Math.atan2(vy, vx);
    const ownerId = prop.slideOwnerPlayerId ?? this.player.id;
    if (!prop.hitEnemyIds) prop.hitEnemyIds = [];

    let detonatedOnEnemy = false;
    for (const e of this.enemies) {
      if (e.hp <= 0 || prop.hitEnemyIds.includes(e.id)) continue;
      if (pointToSegmentDist(e.x, e.y, oldX, oldY, nextX, nextY) <= prop.radius + e.radius) {
        prop.hitEnemyIds.push(e.id);
        const dmg = computeKickSlideDamage(e, this.currentFloor);
        const kbSpeed =
          this.map.getSurfaceAtWorld(e.x, e.y) === 'ice'
            ? SLIDING_PROP_ENEMY_KB_SPEED * BIOME2_ICE_INERTIA_MULT
            : SLIDING_PROP_ENEMY_KB_SPEED;
        this.applyDamageToEnemy(e, dmg, false, 'none', slideAngle, kbSpeed, true, ownerId);
        e.kbVx = Math.cos(slideAngle) * kbSpeed;
        e.kbVy = Math.sin(slideAngle) * kbSpeed;
        e.stunTimer = Math.max(e.stunTimer ?? 0, SLIDING_PROP_ENEMY_STUN_SEC);
        if (!e.isBoss && e.hp > 0) {
          e.aiState = 'stunned';
          e.stateTimer = Math.max(e.stateTimer, SLIDING_PROP_ENEMY_STUN_SEC);
        }
        if (prop.kind === 'volatile_spore_pod') {
          prop.x = e.x;
          prop.y = e.y;
          detonateVolatileSporePod(this, prop);
          detonatedOnEnemy = true;
          break;
        }
        if (prop.kind === 'glacial_barricade') {
          prop.x = e.x;
          prop.y = e.y;
          shatterGlacialBarricade(this, prop, slideAngle, ownerId);
          detonatedOnEnemy = true;
          break;
        }
      }
    }
    if (detonatedOnEnemy) continue;

    let hitPropObstacle = false;
    for (const other of this.props) {
      if (other.id === prop.id || other.hp <= 0 || !other.blocksMovement) continue;
      const hitRadius = other.kind === 'rotten_totem_pillar' ? prop.radius + Math.max(other.radius, 36) : prop.radius + other.radius;
      if (pointToSegmentDist(other.x, other.y, oldX, oldY, nextX, nextY) <= hitRadius) {
        hitPropObstacle = true;
        if (other.kind === 'rotten_totem_pillar') collapseRottenTotemPillar(this, other, slideAngle, ownerId);
        break;
      }
    }

    const col = this.map.resolveCircleCollision(nextX, nextY, prop.radius, true);
    prop.x = col.x;
    prop.y = col.y;

    if (col.collided || hitPropObstacle) {
      if ((prop.bouncesRemaining ?? 0) > 0) {
        prop.bouncesRemaining = (prop.bouncesRemaining ?? 0) - 1;
        prop.hitEnemyIds = [];
        if (Math.abs(col.normalX) > 0.1) prop.vx = -vx;
        if (Math.abs(col.normalY) > 0.1) prop.vy = -vy;
        if (Math.abs(col.normalX) <= 0.1 && Math.abs(col.normalY) <= 0.1) {
          prop.vx = -vx;
          prop.vy = -vy;
        }
      } else {
        destroyTacticalProp(this, prop);
      }
    }
  }
}

export function triggerEnemyWallSlam(sim: WorldSim, e: SimEnemyState, hitProp?: SimPropState, preStepKbSpeed?: number): boolean {
  if (e.hp <= 0 || e.isDummy) return false;
  const kbSpeed = Math.max(Math.hypot(e.kbVx, e.kbVy), preStepKbSpeed ?? 0);
  if (kbSpeed < WALL_SLAM_SPEED_THRESHOLD || (e.wallSlamCooldownTimer ?? 0) <= 0 === false) return false;

  const slamImpactAngle =
    Math.hypot(e.kbVx, e.kbVy) > 0.001
      ? Math.atan2(e.kbVy, e.kbVx)
      : hitProp
        ? Math.atan2(hitProp.y - e.y, hitProp.x - e.x)
        : 0;

  e.wallSlamCooldownTimer = e.isBoss ? 2.5 : WALL_SLAM_COOLDOWN_SEC;
  const slamDmg = computeWallSlamDamage(e, sim.currentFloor);
  const attackerId = e.lastHitPlayerId ?? sim.player.id;

  if (e.isBoss) {
    e.bossStaggerAccum = (e.bossStaggerAccum ?? 0) + 1;
  } else {
    e.stunTimer = Math.max(e.stunTimer ?? 0, WALL_SLAM_STUN_SEC);
    e.aiState = 'stunned'; e.stateTimer = Math.max(e.stateTimer, WALL_SLAM_STUN_SEC);
    e.vx = 0; e.vy = 0;
  }

  let shattered = false;
  if (e.frozenTimer > 0) {
    shattered = true; e.frozenTimer = 0; e.chillTimer = 0; e.chillStacks = 0;
    sim.events.push({ kind: 'status_applied', targetId: e.id, status: 'shatter', x: e.x, y: e.y });
  }

  if (!e.bossBurrowed && !(e.isBoss && (e.bossPhaseTransitionTimer ?? 0) > 0)) {
    const effectiveSlamDmg = e.isBoss && sim.hasActiveBossGuardians() ? Math.max(1, Math.round(slamDmg * 0.35)) : slamDmg;
    e.hp = Math.max(0, e.hp - effectiveSlamDmg); e.hitFlashTimer = 0.12;
    sim.events.push({
      kind: 'damage_dealt', targetId: e.id, targetKind: 'enemy', x: e.x, y: e.y,
      amount: effectiveSlamDmg, isCrit: false, hitArmor: false, element: 'none', knockbackX: 0, knockbackY: 0,
    });
  }

  sim.events.push({ kind: 'wall_slam', enemyId: e.id, x: e.x, y: e.y, damage: slamDmg, shattered });
  triggerBiome2WallSlamCryoPulse(sim, e, attackerId);
  if (shattered && e.hp > 0) {
    sim.triggerElementalReaction(e, 'shatter', Math.max(18, Math.round(slamDmg * 1.35)), e.lastElementOwnerId || attackerId, attackerId);
  }
  if (e.hp <= 0) sim.handleEnemyKilled(e, attackerId);
  if (hitProp && hitProp.destructible && hitProp.hp > 0) {
    if (hitProp.kind === 'rotten_totem_pillar') collapseRottenTotemPillar(sim, hitProp, slamImpactAngle, attackerId);
    else sim.damageProp(hitProp, 25, 'none');
  }
  e.kbVx *= 0.25; e.kbVy *= 0.25;
  return true;
}

export function resolveEnemyChasmRingOut(sim: WorldSim, e: SimEnemyState): boolean {
  if (e.hp <= 0 || e.isDummy || e.isBoss) return false;
  if (sim.map.getSurfaceAtWorld(e.x, e.y) !== 'chasm') return false;
  const def = ENEMIES[e.defId];
  if (def?.flying) return false;

  const safePt = findNearestWalkablePoint(sim.map, e.x, e.y, e.radius);
  const attackerId = e.lastHitPlayerId ?? sim.player.id;

  if (e.isElite) {
    const ringOutDmg = Math.max(1, Math.round(0.30 * e.maxHp));
    e.hp = Math.max(0, e.hp - ringOutDmg); e.hitFlashTimer = 0.14;
    e.x = safePt.x; e.y = safePt.y; e.prevX = safePt.x; e.prevY = safePt.y;
    e.kbVx = 0; e.kbVy = 0; e.vx = 0; e.vy = 0;
    e.stunTimer = Math.max(e.stunTimer ?? 0, 1.0); e.aiState = 'stunned'; e.stateTimer = Math.max(e.stateTimer, 1.0);
    sim.events.push({ kind: 'ring_out', enemyId: e.id, x: safePt.x, y: safePt.y, isElite: true, damage: ringOutDmg });
    if (e.hp <= 0) sim.handleEnemyKilled(e, attackerId);
    return true;
  }

  const ringOutDmg = e.hp;
  const chasmX = e.x; const chasmY = e.y;
  const pickupsBefore = sim.pickups.length;
  const worldItemsBefore = sim.worldItems.length;

  e.hp = 0; e.kbVx = 0; e.kbVy = 0; e.vx = 0; e.vy = 0;
  e.x = safePt.x; e.y = safePt.y;

  sim.events.push({ kind: 'ring_out', enemyId: e.id, x: chasmX, y: chasmY, isElite: false, damage: ringOutDmg });
  sim.handleEnemyKilled(e, attackerId);

  for (let i = pickupsBefore; i < sim.pickups.length; i++) {
    const p = sim.pickups[i]!;
    const pPt = findNearestWalkablePoint(sim.map, p.x, p.y, 6);
    p.x = pPt.x; p.y = pPt.y; p.prevX = pPt.x; p.prevY = pPt.y; p.vx = 0; p.vy = 0;
  }
  for (let i = worldItemsBefore; i < sim.worldItems.length; i++) {
    const wi = sim.worldItems[i]!;
    const wPt = findNearestWalkablePoint(sim.map, wi.x, wi.y, 8);
    wi.x = wPt.x; wi.y = wPt.y; wi.fromX = wPt.x; wi.fromY = wPt.y;
  }

  e.x = chasmX; e.y = chasmY;
  return true;
}
