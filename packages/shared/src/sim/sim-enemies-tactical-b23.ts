import { angleDiff, distance } from '../math/vec2.js';
import { tryTriggerToxicShrapnelOnPropBreak } from './sim-blessings-p4a.js';
import { tryBreakBossArmorWithKickedProp } from './sim-boss-armor-break.js';
import {
  MAX_TACTICAL_PROPS_PER_ROOM,
  type SimEnemyState,
  type SimPendingMortarStrike,
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

export const COAL_BOMB_HP = 50;
export const COAL_BOMB_RADIUS = 18;
export const COAL_BOMB_FUSE_SEC = 2.0;
export const COAL_BOMB_KICK_SPEED = 560;
export const COAL_BOMB_BLAST_RADIUS = 96;
export const COAL_BOMB_BLAST_DAMAGE = 85;

export const IRON_SHIELDER_FRONT_CONE_RAD = 1.15;
export const IRON_SHIELDER_ARC_RADIUS = 160;
export const IRON_SHIELDER_CLOSE_ARC_RADIUS = 120;
export const IRON_SHIELDER_ARC_HALF_ANGLE_RAD = (65 * Math.PI) / 180;
export const IRON_SHIELDER_ARC_DAMAGE = 45;
export const IRON_SHIELDER_ARC_STUN_SEC = 1.4;
export const IRON_SHIELDER_SELF_STUN_SEC = 1.0;
export const IRON_SHIELDER_SHIELD_BROKEN_SEC = 3.0;

export const FROST_BAT_SONIC_DART_SPEED = 235;
export const ICE_MAGE_BOLT_SPEED = 220;
export const ICE_MAGE_SHATTER_SPEAR_SPEED = 232;
export const FIRE_IMP_FIREBALL_SPEED = 235;

export const DWARF_MORTAR_RADIUS = 56;
export const DWARF_MORTAR_FLIGHT_SEC = 0.85;
export const DWARF_MORTAR_SPEED_REF = 215;

export const WELDER_DRONE_EMP_RADIUS = 110;
export const WELDER_DRONE_EMP_DAMAGE = 35;
export const WELDER_DRONE_EMP_STUN_SEC = 1.5;
export const WELDER_DRONE_EMP_SHIELD_BROKEN_SEC = 5.0;

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

  let activeIceBlocks = 0;
  let oldestIceIdx = -1;
  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    if (p.kind === 'sliding_ice_block' && p.hp > 0 && p.state !== 'broken') {
      if (oldestIceIdx < 0) oldestIceIdx = i;
      activeIceBlocks += 1;
    }
  }
  if (activeIceBlocks >= 4 && oldestIceIdx >= 0) {
    sim.props.splice(oldestIceIdx, 1);
  } else if (sim.props.length >= MAX_TACTICAL_PROPS_PER_ROOM) {
    const evictIdx = sim.props.findIndex(
      (p) => p.hp <= 0 || p.state === 'broken' || p.kind === 'sliding_ice_block' || p.kind === 'shaman_totem',
    );
    if (evictIdx >= 0) sim.props.splice(evictIdx, 1);
    else return null;
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
  targetPlayer?: Pick<SimPlayerState, 'x' | 'y'>,
): boolean {
  if (e.defId !== 'baby_yeti' || e.hp <= 0 || sim.props.length === 0) return false;

  let bestBlock: SimPropState | null = null;
  let bestDistSq = BABY_YETI_ICE_BLOCK_SEARCH_RADIUS * BABY_YETI_ICE_BLOCK_SEARCH_RADIUS;
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
    const dx = prop.x - e.x;
    const dy = prop.y - e.y;
    const dSq = dx * dx + dy * dy;
    if (dSq <= bestDistSq) {
      bestDistSq = dSq;
      bestBlock = prop;
    }
  }
  if (!bestBlock) return false;

  const pushContactR = e.radius + bestBlock.radius + 16;
  if (bestDistSq <= pushContactR * pushContactR) {
    const resolvedTarget = targetPlayer ?? sim.findNearestAlivePlayer(e.x, e.y);
    const aim = Math.atan2(resolvedTarget.y - bestBlock.y, resolvedTarget.x - bestBlock.x);
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
  let bestDistSq = ICE_MAGE_PRISM_SEARCH_RADIUS * ICE_MAGE_PRISM_SEARCH_RADIUS;
  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    if (p.kind !== 'cryo_prism_pillar' || p.hp <= 0 || p.state === 'broken') continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dSq = dx * dx + dy * dy;
    if (dSq <= bestDistSq) {
      if (requireUnblocked && isPrismLineBlockedByFlippedBarricade(sim, e.x, e.y, p)) continue;
      bestDistSq = dSq;
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
      pelletCount: 1, spreadRad: 0, speed: ICE_MAGE_SHATTER_SPEAR_SPEED, damage: e.damage, radius: 6.6, bulletShape: 'lance', knockback: 85,
      pierceCount: 0, bounceCount: 0, ttlSec: 2.3, element: 'chill', critChance: 0,
      amplifiedByShield: false, seed: sim.rng.nextUint32(),
    });
    e.eliteModifier = savedMod;
    return;
  }

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned', tick: sim.tick, ownerId: e.id, team: 'enemy', weaponId: 'frost_orb',
    x: e.x + Math.cos(e.telegraphAngle) * 16, y: e.y + Math.sin(e.telegraphAngle) * 16, angle: e.telegraphAngle,
    pelletCount: 3, spreadRad: 0.96, speed: ICE_MAGE_BOLT_SPEED, damage: e.damage, radius: 6.6, bulletShape: 'diamond', knockback: 85,
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
  const speed = Math.max(ICE_MAGE_BOLT_SPEED, Math.hypot(b.vx, b.vy));
  const prevIds = new Set(sim.projectiles.map((p) => p.id));

  const savedMod = owner?.eliteModifier ?? null;
  if (owner && savedMod === 'volley') owner.eliteModifier = null;

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned', tick: sim.tick, eventId: sim.nextVolleyEventId++,
    ownerId: b.ownerId, team: 'enemy', weaponId: b.weaponId || 'frost_orb',
    x: prism.x + Math.cos(centerAngle) * (prism.radius + b.radius + 4),
    y: prism.y + Math.sin(centerAngle) * (prism.radius + b.radius + 4),
    angle: centerAngle, pelletCount: 3, spreadRad: ICE_MAGE_PRISM_FAN_SPREAD_RAD,
    speed, damage: b.damage, critChance: 0, knockback: b.knockback, radius: b.radius, bulletShape: 'diamond',
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

/**
 * Biome 3 `coal_golem`: Drops an intact `coal_bomb` tactical prop (`fuseTimer = 2.0s`, `radius = 18`)
 * at `(e.x, e.y)` when killed so the player can Dash-Kick or melee-kick it at 560 px/s into enemy ranks.
 */
export function spawnCoalBombOnDeath(sim: WorldSim, e: SimEnemyState): SimPropState | null {
  if (e.defId !== 'coal_golem' || e.coalBombSpawned || sim.stressTestActive) return null;
  e.coalBombSpawned = true;

  if (sim.props.length >= MAX_TACTICAL_PROPS_PER_ROOM) {
    const brokenIdx = sim.props.findIndex(
      (p) => p.hp <= 0 || p.state === 'broken' || p.kind === 'coal_bomb' || p.kind === 'sliding_ice_block',
    );
    if (brokenIdx >= 0) sim.props.splice(brokenIdx, 1);
    else return null;
  }

  const bomb = sim.spawnProp('coal_bomb', e.x, e.y);
  bomb.x = e.x; bomb.y = e.y;
  bomb.radius = COAL_BOMB_RADIUS;
  bomb.hp = COAL_BOMB_HP; bomb.maxHp = COAL_BOMB_HP;
  bomb.fuseTimer = COAL_BOMB_FUSE_SEC;
  bomb.state = 'intact'; bomb.coverState = undefined;
  bomb.destructible = true; bomb.explosive = true; bomb.blocksMovement = true;
  bomb.enemyPushed = false;
  return bomb;
}

export function detonateCoalBomb(sim: WorldSim, bomb: SimPropState): number {
  if (bomb.kind !== 'coal_bomb' || (bomb.hp <= 0 && bomb.fuseTimer <= 0 && !bomb.explosive)) {
    return 0;
  }
  bomb.hp = 0;
  bomb.fuseTimer = 0;
  bomb.explosive = false;
  bomb.state = 'broken';
  bomb.blocksMovement = false;
  bomb.destructible = false;
  bomb.lastCombatText = 'COAL BOMB BLAST!';

  const ownerId = bomb.slideOwnerPlayerId ?? bomb.kickedByPlayerId ?? sim.player.id;
  sim.events.push({ kind: 'prop_destroyed', propId: bomb.id, propKind: bomb.kind, x: bomb.x, y: bomb.y });
  sim.events.push({
    kind: 'explosion', x: bomb.x, y: bomb.y,
    radius: COAL_BOMB_BLAST_RADIUS, damage: COAL_BOMB_BLAST_DAMAGE, sourceDefId: 'coal_bomb',
  });
  sim.events.push({ kind: 'hit_stop', durationMs: 40, trauma: 0.4 });
  sim.map.igniteSurfaceInRadius(bomb.x, bomb.y, COAL_BOMB_BLAST_RADIUS);
  tryTriggerToxicShrapnelOnPropBreak(sim, bomb, ownerId);

  let hitCount = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.defId === 'ashen_executioner' || e.aiState === 'spawning') continue;
    if (distance(bomb.x, bomb.y, e.x, e.y) <= COAL_BOMB_BLAST_RADIUS + e.radius) {
      if (
        e.defId === 'forge_titan' &&
        e.bossArmorBreakTriggeredTick !== sim.tick &&
        Boolean(bomb.kickedByPlayerId || bomb.slideOwnerPlayerId)
      ) {
        tryBreakBossArmorWithKickedProp(sim, e, bomb, ownerId);
      }
      if (e.bossArmorBreakTriggeredTick === sim.tick) {
        if (e.hp > 0) {
          e.burnTimer = Math.max(e.burnTimer, 3.0);
          e.burnStacks = Math.max(1, e.burnStacks ?? 1);
          if (e.burnTickTimer <= 0) e.burnTickTimer = 0.5;
        }
        hitCount += 1;
        continue;
      }
      const hpBefore = e.hp;
      const pushAng = Math.atan2(e.y - bomb.y, e.x - bomb.x);
      const alreadySlideHit = Boolean(bomb.hitEnemyIds?.includes(e.id));
      sim.applyDamageToEnemy(
        e,
        COAL_BOMB_BLAST_DAMAGE,
        true,
        'burn',
        pushAng,
        240,
        true,
        ownerId,
        false,
        alreadySlideHit ? 0 : 1.0,
        !alreadySlideHit && Boolean(bomb.kickedByPlayerId || bomb.slideOwnerPlayerId),
      );
      const dealt = hpBefore - e.hp;
      if (e.hp > 0 && dealt < COAL_BOMB_BLAST_DAMAGE) {
        const extra = COAL_BOMB_BLAST_DAMAGE - dealt;
        e.hp = Math.max(0, e.hp - extra);
        if (e.hp <= 0) sim.handleEnemyKilled(e, ownerId);
      }
      if (e.hp > 0) {
        e.burnTimer = Math.max(e.burnTimer, 3.0);
        e.burnStacks = Math.max(1, e.burnStacks ?? 1);
        if (e.burnTickTimer <= 0) e.burnTickTimer = 0.5;
      }
      e.lastCombatText = 'COAL BOMB BLAST!';
      hitCount += 1;
    }
  }
  return hitCount;
}

export function stepCoalBombsAndDetonate(sim: WorldSim, dtSec: number): number {
  let detonated = 0;
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.kind !== 'coal_bomb' || prop.hp <= 0) continue;
    if (prop.fuseTimer > 0) {
      prop.fuseTimer -= dtSec;
      if (prop.fuseTimer <= 1e-6) {
        detonateCoalBomb(sim, prop);
        detonated += 1;
      }
    }
  }
  return detonated;
}

/**
 * Biome 3 `iron_shielder`: When hit on the frontal iron shield by a `shock` attack,
 * conducts electricity and discharges a lightning arc cone behind the shield (`r = 160px`, `±65°`
 * behind `aimAngle + Math.PI` and within `120px` around `iron_shielder`), dealing >= 45 Shock damage
 * and stunning (`stunTimer >= 1.4s`, `aiState = 'stunned'`) all enemies hiding behind the shield.
 */
export function triggerIronShielderShockArc(
  sim: WorldSim,
  shielder: SimEnemyState,
  attackerId = sim.player.id,
): number {
  if (shielder.defId !== 'iron_shielder') return 0;

  const backAngle = shielder.aimAngle + Math.PI;
  shielder.stunTimer = Math.max(shielder.stunTimer ?? 0, IRON_SHIELDER_SELF_STUN_SEC);
  shielder.aiState = 'stunned';
  shielder.stateTimer = Math.max(shielder.stateTimer, IRON_SHIELDER_SELF_STUN_SEC);
  shielder.shieldBrokenTimer = Math.max(shielder.shieldBrokenTimer ?? 0, IRON_SHIELDER_SHIELD_BROKEN_SEC);
  shielder.vx = 0; shielder.vy = 0;
  shielder.lastCombatText = 'SHIELD SHOCK ARC!';
  shielder.shockArcVisualTimer = 0.45;
  shielder.shockArcVisualAngle = backAngle;

  let arcHitCount = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const other = sim.enemies[i]!;
    if (
      other.id === shielder.id ||
      other.hp <= 0 ||
      other.isDummy ||
      other.defId === 'ashen_executioner' ||
      other.aiState === 'spawning'
    ) {
      continue;
    }
    const d = distance(shielder.x, shielder.y, other.x, other.y);
    const ang = Math.atan2(other.y - shielder.y, other.x - shielder.x);
    const inRearCone =
      d <= IRON_SHIELDER_ARC_RADIUS + other.radius &&
      Math.abs(angleDiff(ang, backAngle)) <= IRON_SHIELDER_ARC_HALF_ANGLE_RAD;
    const inCloseRadius = d <= IRON_SHIELDER_CLOSE_ARC_RADIUS + other.radius;
    if (!inRearCone && !inCloseRadius) continue;

    other.hp = Math.max(0, other.hp - IRON_SHIELDER_ARC_DAMAGE);
    other.hitFlashTimer = 0.16;
    other.lastHitDmg = Math.max(other.lastHitDmg ?? 0, IRON_SHIELDER_ARC_DAMAGE);
    other.shockTimer = Math.max(other.shockTimer, IRON_SHIELDER_ARC_STUN_SEC);
    other.stunTimer = Math.max(other.stunTimer ?? 0, IRON_SHIELDER_ARC_STUN_SEC);
    if (!other.isBoss) {
      other.aiState = 'stunned';
      other.stateTimer = Math.max(other.stateTimer, IRON_SHIELDER_ARC_STUN_SEC);
      other.vx = 0; other.vy = 0;
    }
    other.lastCombatText = 'SHIELD SHOCK ARC!';

    sim.events.push({
      kind: 'chain_lightning',
      fromX: shielder.x, fromY: shielder.y, toX: other.x, toY: other.y,
    });
    sim.events.push({
      kind: 'damage_dealt', targetId: other.id, targetKind: 'enemy', x: other.x, y: other.y,
      amount: IRON_SHIELDER_ARC_DAMAGE, isCrit: true, hitArmor: false, element: 'shock',
      knockbackX: 0, knockbackY: 0,
    });
    sim.events.push({
      kind: 'status_applied', targetId: other.id, status: 'shock', x: other.x, y: other.y,
    });
    if (other.hp <= 0) sim.handleEnemyKilled(other, attackerId);
    arcHitCount += 1;
  }
  return arcHitCount;
}

/**
 * Biome 3 `dwarf_cannon`: Fires a `Lobbed Mortar` arcing over low/flipped cover,
 * creating a red floor target indicator (`r = 56px`, `timer = 0.85s`) at the predictive target position.
 */
export function fireDwarfCannonLobbedMortar(
  sim: WorldSim,
  e: SimEnemyState,
  targetPlayer: Pick<SimPlayerState, 'x' | 'y' | 'vx' | 'vy'>,
): SimPendingMortarStrike {
  const distToTarget = Math.hypot(targetPlayer.x - e.x, targetPlayer.y - e.y);
  const timeToHit = Math.min(0.65, distToTarget / DWARF_MORTAR_SPEED_REF);
  const leadFactor = e.isBoss || e.isElite ? 0.65 : 0.35;
  const predDx = targetPlayer.x + (targetPlayer.vx ?? 0) * timeToHit * leadFactor - e.x;
  const predDy = targetPlayer.y + (targetPlayer.vy ?? 0) * timeToHit * leadFactor - e.y;
  const predDist = Math.hypot(predDx, predDy);
  const directAngle = Math.atan2(targetPlayer.y - e.y, targetPlayer.x - e.x);
  const rawLeadAngle = Math.atan2(predDy, predDx);
  const maxLeadRad = (28 * Math.PI) / 180;
  const clampedLeadAngle =
    e.leadSightlineAngle ??
    directAngle + Math.max(-maxLeadRad, Math.min(maxLeadRad, angleDiff(rawLeadAngle, directAngle)));

  const rawX = e.x + Math.cos(clampedLeadAngle) * predDist;
  const rawY = e.y + Math.sin(clampedLeadAngle) * predDist;
  const col = sim.map.resolveCircleCollision(rawX, rawY, 16, true);

  const strike: SimPendingMortarStrike = {
    id: ++sim.nextEntityId,
    ownerId: e.id,
    x: col.x,
    y: col.y,
    radius: DWARF_MORTAR_RADIUS,
    timer: DWARF_MORTAR_FLIGHT_SEC,
    maxTimer: DWARF_MORTAR_FLIGHT_SEC,
    startX: e.x,
    startY: e.y,
    damage: Math.max(2, e.damage),
  };
  sim.pendingMortarStrikes.push(strike);
  return strike;
}

export function stepPendingMortarStrikes(sim: WorldSim, dtSec: number): number {
  if (sim.empBlastVisualRings.length > 0) {
    let empWrite = 0;
    for (let i = 0; i < sim.empBlastVisualRings.length; i++) {
      const ring = sim.empBlastVisualRings[i]!;
      ring.timer -= dtSec;
      if (ring.timer > 1e-6) {
        sim.empBlastVisualRings[empWrite++] = ring;
      }
    }
    sim.empBlastVisualRings.length = empWrite;
  }

  if (sim.pendingMortarStrikes.length === 0) return 0;

  let detonatedCount = 0;
  let writeIdx = 0;
  let allPlayers: SimPlayerState[] | null = null;

  for (let i = 0; i < sim.pendingMortarStrikes.length; i++) {
    const strike = sim.pendingMortarStrikes[i]!;
    strike.timer -= dtSec;
    if (strike.timer > 1e-6) {
      sim.pendingMortarStrikes[writeIdx++] = strike;
      continue;
    }

    detonatedCount += 1;
    sim.map.igniteSurfaceInRadius(strike.x, strike.y, Math.min(48, strike.radius));
    if (!sim.stressTestActive) {
      sim.events.push({
        kind: 'explosion',
        x: strike.x,
        y: strike.y,
        radius: strike.radius,
        damage: strike.damage,
        sourceDefId: 'dwarf_mortar',
      });
    }

    allPlayers ??= sim.getAllPlayers();
    for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
      const pl = allPlayers[pIdx]!;
      if (pl.lifeState !== 'alive' || pl.hp <= 0) continue;
      const dx = pl.x - strike.x;
      const dy = pl.y - strike.y;
      const hitR = strike.radius + pl.radius;
      if (dx * dx + dy * dy <= hitR * hitR) {
        const pushAng = Math.atan2(dy, dx);
        const damaged = sim.applyDamageToPlayer(strike.damage, pushAng, 160, 'dwarf_mortar', pl);
        if (damaged) {
          pl.burnTimer = Math.max(pl.burnTimer, 1.8);
        }
      }
    }
  }

  sim.pendingMortarStrikes.length = writeIdx;
  return detonatedCount;
}

/**
 * Biome 3 `welder_drone`: Crashes on death and triggers an `EMP Blast` (`r = 110px`),
 * stripping `shieldArmor` (`shieldArmor = 0`, `shieldBrokenTimer >= 5.0`), dealing >= 35 shock damage,
 * and stunning (`stunTimer >= 1.5s`, `aiState = 'stunned'`) all nearby enemies within 110px.
 */
export function triggerWelderDroneEmpBlastOnDeath(
  sim: WorldSim,
  drone: SimEnemyState,
  killerPlayerId = sim.player.id,
): number {
  if (drone.defId !== 'welder_drone' || drone.empBlastTriggered || sim.stressTestActive) return 0;
  drone.empBlastTriggered = true;
  drone.lastCombatText = 'EMP BLAST!';

  sim.empBlastVisualRings.push({
    id: ++sim.nextEntityId,
    x: drone.x,
    y: drone.y,
    radius: WELDER_DRONE_EMP_RADIUS,
    timer: 0.45,
    maxTimer: 0.45,
  });
  sim.events.push({
    kind: 'emp_blast',
    x: drone.x,
    y: drone.y,
    radius: WELDER_DRONE_EMP_RADIUS,
    bulletsCleared: 0,
  });

  let stunnedCount = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const other = sim.enemies[i]!;
    if (
      other.id === drone.id ||
      other.hp <= 0 ||
      other.isDummy ||
      other.defId === 'ashen_executioner' ||
      other.aiState === 'spawning'
    ) {
      continue;
    }
    if (distance(drone.x, drone.y, other.x, other.y) <= WELDER_DRONE_EMP_RADIUS + other.radius) {
      if (other.shieldArmor > 0) {
        other.shieldArmor = 0;
        sim.events.push({
          kind: 'armor_broken',
          targetKind: 'enemy',
          targetId: other.id,
          x: other.x,
          y: other.y,
        });
      }
      other.shieldArmor = 0;
      other.shieldBrokenTimer = Math.max(other.shieldBrokenTimer ?? 0, WELDER_DRONE_EMP_SHIELD_BROKEN_SEC);
      other.hp = Math.max(0, other.hp - WELDER_DRONE_EMP_DAMAGE);
      other.hitFlashTimer = 0.16;
      other.lastHitDmg = Math.max(other.lastHitDmg ?? 0, WELDER_DRONE_EMP_DAMAGE);
      other.shockTimer = Math.max(other.shockTimer, WELDER_DRONE_EMP_STUN_SEC);
      other.stunTimer = Math.max(other.stunTimer ?? 0, WELDER_DRONE_EMP_STUN_SEC);
      if (!other.isBoss) {
        other.aiState = 'stunned';
        other.stateTimer = Math.max(other.stateTimer, WELDER_DRONE_EMP_STUN_SEC);
        other.vx = 0; other.vy = 0;
      }
      other.lastCombatText = 'EMP BLAST!';

      sim.events.push({
        kind: 'damage_dealt', targetId: other.id, targetKind: 'enemy', x: other.x, y: other.y,
        amount: WELDER_DRONE_EMP_DAMAGE, isCrit: false, hitArmor: false, element: 'shock',
        knockbackX: 0, knockbackY: 0,
      });
      sim.events.push({
        kind: 'status_applied', targetId: other.id, status: 'shock', x: other.x, y: other.y,
      });
      if (other.hp <= 0) sim.handleEnemyKilled(other, killerPlayerId);
      stunnedCount += 1;
    }
  }
  return stunnedCount;
}
