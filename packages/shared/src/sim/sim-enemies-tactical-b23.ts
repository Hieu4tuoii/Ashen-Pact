import { angleDiff, distance } from '../math/vec2.js';
import {
  MAX_TACTICAL_PROPS_PER_ROOM,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
  type SimPropState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const SNOW_SPIRIT_ICE_BLOCK_HP = 120;
export const SNOW_SPIRIT_ICE_BLOCK_RADIUS = 22;
export const BABY_YETI_ICE_BLOCK_SEARCH_RADIUS = 220;
export const BABY_YETI_PUSH_SPEED = 460;
export const COUNTER_ICE_KICK_SPEED = 600;
export const COUNTER_ICE_KICK_MIN_DAMAGE = 95;
export const ICE_MAGE_PRISM_SEARCH_RADIUS = 320;
export const ICE_MAGE_PRISM_FAN_HALF_ANGLE_RAD = (25 * Math.PI) / 180;
export const ICE_MAGE_PRISM_FAN_SPREAD_RAD = (50 * Math.PI) / 180;
export const ICE_GOLEM_FRONT_CONE_RAD = 1.15;
export const ICE_GOLEM_SHIELD_BROKEN_SEC = 8.0;
export const ICE_GOLEM_SHATTER_STUN_SEC = 1.2;
export const ICE_GOLEM_SHATTER_DAMAGE = 70;

function pointToSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 0.000001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

/**
 * Biome 2 `snow_spirit`: Crystallizes into an intact `sliding_ice_block` (`hp = 120`, `radius = 22`)
 * at `(e.x, e.y)` when killed or self-detonating so the player can Dash-Kick it into enemies.
 */
export function spawnSnowSpiritIceBlockOnDeath(sim: WorldSim, e: SimEnemyState): SimPropState | null {
  if (e.defId !== 'snow_spirit' || e.crystallizedIceBlockSpawned || sim.stressTestActive) return null;
  e.crystallizedIceBlockSpawned = true;

  if (sim.props.length >= MAX_TACTICAL_PROPS_PER_ROOM) {
    const brokenIdx = sim.props.findIndex((p) => p.hp <= 0 || p.state === 'broken');
    if (brokenIdx >= 0) sim.props.splice(brokenIdx, 1);
  }

  const block = sim.spawnProp('sliding_ice_block', e.x, e.y);
  block.x = e.x; block.y = e.y;
  block.state = 'intact'; block.coverState = undefined;
  block.hp = SNOW_SPIRIT_ICE_BLOCK_HP; block.maxHp = SNOW_SPIRIT_ICE_BLOCK_HP;
  block.radius = SNOW_SPIRIT_ICE_BLOCK_RADIUS;
  block.destructible = true; block.blocksMovement = true;
  block.bouncesRemaining = 1; block.enemyPushed = false;
  return block;
}

/**
 * Biome 2 `baby_yeti`: Moves toward an intact stationary `sliding_ice_block` within 220px
 * and pushes it sliding along the floor at 460 px/s (`enemyPushed = true`) toward the player.
 */
export function tryBabyYetiPushIceBlock(
  sim: WorldSim,
  e: SimEnemyState,
  targetPlayer: Pick<SimPlayerState, 'x' | 'y'>,
): boolean {
  if (e.defId !== 'baby_yeti' || e.hp <= 0) return false;

  let bestBlock: SimPropState | null = null;
  let bestDist = BABY_YETI_ICE_BLOCK_SEARCH_RADIUS;
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (
      prop.kind !== 'sliding_ice_block' ||
      prop.hp <= 0 ||
      prop.state === 'broken' ||
      prop.state === 'sliding' ||
      prop.coverState === 'sliding' ||
      prop.enemyPushed
    ) {
      continue;
    }
    const d = distance(e.x, e.y, prop.x, prop.y);
    if (d <= bestDist) {
      bestDist = d;
      bestBlock = prop;
    }
  }
  if (!bestBlock) return false;

  if (bestDist <= e.radius + bestBlock.radius + 16) {
    const aim = Math.atan2(targetPlayer.y - bestBlock.y, targetPlayer.x - bestBlock.x);
    bestBlock.state = 'sliding'; bestBlock.coverState = 'sliding';
    bestBlock.blocksMovement = false; bestBlock.blocksEnemyProjectiles = false;
    bestBlock.vx = Math.cos(aim) * BABY_YETI_PUSH_SPEED;
    bestBlock.vy = Math.sin(aim) * BABY_YETI_PUSH_SPEED;
    bestBlock.enemyPushed = true; bestBlock.pushedByEnemyId = e.id;
    bestBlock.kickedByPlayerId = undefined; bestBlock.slideOwnerPlayerId = undefined;
    bestBlock.counterDeflected = false; bestBlock.iceSpeedBoostApplied = true;
    bestBlock.hitEnemyIds = [];

    e.aimAngle = aim; e.aiState = 'cooldown'; e.stateTimer = 0.35;
    e.vx = 0; e.vy = 0;
    return true;
  }

  const toBlockAng = Math.atan2(bestBlock.y - e.y, bestBlock.x - e.x);
  e.aimAngle = toBlockAng;
  e.vx = Math.cos(toBlockAng) * e.moveSpeed;
  e.vy = Math.sin(toBlockAng) * e.moveSpeed;
  return true;
}

/**
 * Biome 2 `baby_yeti` counterplay: Reverses an `enemyPushed` sliding ice block at 600 px/s
 * (`enemyPushed = false`, `kickedByPlayerId = player.id`) on Dash-Kick or Melee swing / Parry Deflect.
 */
export function counterDeflectEnemySlidingIceBlock(
  sim: WorldSim,
  prop: SimPropState,
  player: Pick<SimPlayerState, 'id' | 'x' | 'y' | 'aimAngle'>,
  customAngle?: number,
): boolean {
  if (prop.kind !== 'sliding_ice_block' || prop.hp <= 0 || !prop.enemyPushed) return false;

  const pusher = prop.pushedByEnemyId
    ? sim.enemies.find((m) => m.id === prop.pushedByEnemyId && m.hp > 0)
    : undefined;
  const angleToPusher = pusher ? Math.atan2(pusher.y - prop.y, pusher.x - prop.x) : undefined;
  const rawAim = customAngle ?? player.aimAngle;
  const counterAngle =
    angleToPusher !== undefined && Math.abs(angleDiff(rawAim, angleToPusher)) <= Math.PI * 0.65
      ? angleToPusher
      : rawAim;

  prop.enemyPushed = false;
  prop.kickedByPlayerId = player.id;
  prop.slideOwnerPlayerId = player.id;
  prop.counterDeflected = true;
  prop.state = 'sliding'; prop.coverState = 'sliding';
  prop.blocksMovement = false; prop.blocksEnemyProjectiles = false;
  prop.vx = Math.cos(counterAngle) * COUNTER_ICE_KICK_SPEED;
  prop.vy = Math.sin(counterAngle) * COUNTER_ICE_KICK_SPEED;
  prop.iceSpeedBoostApplied = true;
  prop.hitEnemyIds = [];
  prop.lastCombatText = 'COUNTER ICE KICK!';

  sim.events.push({
    kind: 'prop_kicked', propId: prop.id, playerId: player.id,
    x: prop.x, y: prop.y, vx: prop.vx, vy: prop.vy,
  });
  return true;
}

export function stepEnemyPushedIceBlockCollisions(
  sim: WorldSim,
  prop: SimPropState,
  oldX: number,
  oldY: number,
  nextX: number,
  nextY: number,
): 'deflected' | 'destroyed' | 'sliding' {
  const allPlayers = sim.getAllPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const pl = allPlayers[i]!;
    if (pl.lifeState !== 'alive' || pl.hp <= 0) continue;
    const dist = pointToSegDist(pl.x, pl.y, oldX, oldY, nextX, nextY);
    if ((pl.dashTimer > 0 || pl.meleeParryWindowTimer > 0) && dist <= prop.radius + pl.radius + 16) {
      counterDeflectEnemySlidingIceBlock(sim, prop, pl);
      return 'deflected';
    }
    if (dist <= prop.radius + pl.radius) {
      const slideAngle = Math.atan2(prop.vy ?? 0, prop.vx ?? 1);
      pl.chillTimer = Math.max(pl.chillTimer, 2.0);
      sim.applyDamageToPlayer(2, slideAngle, 220, 'sliding_ice_block', pl);
      return 'destroyed';
    }
  }

  const col = sim.map.resolveCircleCollision(nextX, nextY, prop.radius, true);
  prop.x = col.x; prop.y = col.y;
  return col.collided ? 'destroyed' : 'sliding';
}

export function isPrismLineBlockedByFlippedBarricade(
  sim: Pick<WorldSim, 'props'>,
  fromX: number,
  fromY: number,
  prism: Pick<SimPropState, 'id' | 'x' | 'y' | 'radius'>,
): boolean {
  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    if (p.id === prism.id || p.hp <= 0) continue;
    const isFlippedBarricade =
      (p.kind === 'glacial_barricade' || p.kind === 'moss_table' || p.kind === 'forge_blast_shield') &&
      (p.coverState === 'flipped' || p.state === 'flipped' || Boolean(p.blocksEnemyProjectiles));
    if (isFlippedBarricade && pointToSegDist(p.x, p.y, fromX, fromY, prism.x, prism.y) <= p.radius + 10) {
      return true;
    }
  }
  return false;
}

export function findIceMageTargetPrism(
  sim: Pick<WorldSim, 'props'>,
  e: Pick<SimEnemyState, 'x' | 'y'>,
  requireUnblocked = false,
): SimPropState | null {
  let bestPrism: SimPropState | null = null;
  let bestDist = ICE_MAGE_PRISM_SEARCH_RADIUS;
  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    if (p.kind !== 'cryo_prism_pillar' || p.hp <= 0 || p.state === 'broken') continue;
    const d = distance(e.x, e.y, p.x, p.y);
    if (d <= bestDist) {
      if (requireUnblocked && isPrismLineBlockedByFlippedBarricade(sim, e.x, e.y, p)) continue;
      bestDist = d;
      bestPrism = p;
    }
  }
  return bestPrism;
}

export function fireIceMagePrismShotOrVolley(
  sim: WorldSim,
  e: SimEnemyState,
  _targetPlayer: Pick<SimPlayerState, 'x' | 'y' | 'vx' | 'vy'>,
): void {
  const prism = findIceMageTargetPrism(sim, e, false);
  if (prism) {
    const angleToPrism = Math.atan2(prism.y - e.y, prism.x - e.x);
    e.telegraphAngle = angleToPrism; e.aimAngle = angleToPrism;
    const savedMod = e.eliteModifier;
    if (savedMod === 'volley') e.eliteModifier = null;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned', tick: sim.tick, ownerId: e.id, team: 'enemy', weaponId: 'frost_orb',
      x: e.x + Math.cos(angleToPrism) * 16, y: e.y + Math.sin(angleToPrism) * 16, angle: angleToPrism,
      pelletCount: 1, spreadRad: 0, speed: 280, damage: e.damage, radius: 6, knockback: 85,
      pierceCount: 0, bounceCount: 0, ttlSec: 2.3, element: 'chill', critChance: 0,
      amplifiedByShield: false, seed: sim.rng.nextUint32(),
    });
    e.eliteModifier = savedMod;
    return;
  }

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned', tick: sim.tick, ownerId: e.id, team: 'enemy', weaponId: 'frost_orb',
    x: e.x + Math.cos(e.telegraphAngle) * 16, y: e.y + Math.sin(e.telegraphAngle) * 16, angle: e.telegraphAngle,
    pelletCount: 3, spreadRad: 0.96, speed: 265, damage: e.damage, radius: 6, knockback: 85,
    pierceCount: 0, bounceCount: 0, ttlSec: 2.3, element: 'chill', critChance: 0,
    amplifiedByShield: false, seed: sim.rng.nextUint32(),
  });
}

export function refractEnemyProjectileThroughCryoPrism(
  sim: WorldSim,
  b: SimProjectileState,
  prism: SimPropState,
): boolean {
  if (
    b.team !== 'enemy' ||
    (b.splitGeneration ?? 0) >= 1 ||
    b.hitEntityIds.includes(prism.id) ||
    prism.hp <= 0 ||
    prism.state === 'broken'
  ) {
    return false;
  }

  const owner = sim.enemies.find((e) => e.id === b.ownerId);
  const fromX = owner ? owner.x : (b.originX ?? b.prevX);
  const fromY = owner ? owner.y : (b.originY ?? b.prevY);
  if (isPrismLineBlockedByFlippedBarricade(sim, fromX, fromY, prism)) {
    b.ttlSec = 0;
    return true;
  }

  b.hitEntityIds.push(prism.id);
  b.ttlSec = 0;
  prism.hitFlashTimer = 0.16;

  const targetPl = sim.findNearestAlivePlayer(prism.x, prism.y);
  const centerAngle = Math.atan2(targetPl.y - prism.y, targetPl.x - prism.x);
  const speed = Math.max(265, Math.hypot(b.vx, b.vy));
  const prevIds = new Set(sim.projectiles.map((p) => p.id));

  const savedMod = owner?.eliteModifier ?? null;
  if (owner && savedMod === 'volley') owner.eliteModifier = null;

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned', tick: sim.tick, eventId: sim.nextVolleyEventId++,
    ownerId: b.ownerId, team: 'enemy', weaponId: b.weaponId || 'frost_orb',
    x: prism.x + Math.cos(centerAngle) * (prism.radius + b.radius + 4),
    y: prism.y + Math.sin(centerAngle) * (prism.radius + b.radius + 4),
    angle: centerAngle, pelletCount: 3, spreadRad: ICE_MAGE_PRISM_FAN_SPREAD_RAD,
    speed, damage: b.damage, critChance: 0, knockback: b.knockback, radius: b.radius,
    ttlSec: 2.2, pierceCount: 0, bounceCount: 0, element: 'chill',
    amplifiedByShield: false, seed: sim.rng.nextUint32(), replacedProjectileId: b.id,
  });
  if (owner) owner.eliteModifier = savedMod;

  const rayAngles = [
    centerAngle - ICE_MAGE_PRISM_FAN_HALF_ANGLE_RAD,
    centerAngle,
    centerAngle + ICE_MAGE_PRISM_FAN_HALF_ANGLE_RAD,
  ];
  let rayIdx = 0;
  for (let i = 0; i < sim.projectiles.length; i++) {
    const child = sim.projectiles[i]!;
    if (!prevIds.has(child.id)) {
      const exactAng = rayAngles[rayIdx] ?? centerAngle;
      rayIdx += 1;
      child.angle = exactAng;
      child.vx = Math.cos(exactAng) * speed;
      child.vy = Math.sin(exactAng) * speed;
      child.splitGeneration = 1;
      child.passedThroughCoverOrPrism = true;
      child.hitEntityIds.push(prism.id);
    }
  }
  return true;
}

export function shatterIceGolemArmor(
  sim: WorldSim,
  e: SimEnemyState,
  attackerId = sim.player.id,
): boolean {
  if (e.defId !== 'ice_golem' || e.hp <= 0) return false;

  e.shieldBrokenTimer = ICE_GOLEM_SHIELD_BROKEN_SEC;
  e.shieldArmor = 0;
  e.stunTimer = Math.max(e.stunTimer ?? 0, ICE_GOLEM_SHATTER_STUN_SEC);
  e.aiState = 'stunned';
  e.stateTimer = Math.max(e.stateTimer, ICE_GOLEM_SHATTER_STUN_SEC);
  e.vx = 0; e.vy = 0;
  e.lastCombatText = 'ICE ARMOR SHATTERED!';

  const shatterDmg = ICE_GOLEM_SHATTER_DAMAGE;
  e.hp = Math.max(0, e.hp - shatterDmg);
  e.hitFlashTimer = 0.16;
  e.lastHitDmg = Math.max(e.lastHitDmg ?? 0, shatterDmg);

  sim.events.push({ kind: 'armor_broken', targetKind: 'enemy', targetId: e.id, x: e.x, y: e.y });
  sim.events.push({ kind: 'status_applied', targetId: e.id, status: 'shatter', x: e.x, y: e.y });
  sim.events.push({
    kind: 'damage_dealt', targetId: e.id, targetKind: 'enemy', x: e.x, y: e.y,
    amount: shatterDmg, isCrit: true, hitArmor: false, element: 'chill', knockbackX: 0, knockbackY: 0,
  });
  sim.triggerElementalReaction(e, 'shatter', shatterDmg, e.lastElementOwnerId || attackerId, attackerId);
  if (e.hp <= 0) sim.handleEnemyKilled(e, attackerId);
  return true;
}
