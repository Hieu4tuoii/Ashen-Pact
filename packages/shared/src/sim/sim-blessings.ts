import { scaleBlessingDamage } from '../data/blessings.js';
import { angleDiff, distance } from '../math/vec2.js';
import { SHOT_FLAG } from '../protocol/messages.js';
import { clampBounceCount } from './sim-damage-pipeline.js';
import {
  BIOME2_ICE_INERTIA_MULT,
  clearEnemyProjectilesAroundProp,
  computeWallSlamDamage,
  FLIP_COVER_MICRO_BLANK_RADIUS,
  isFlippableBarricadeProp,
} from './sim-tactical-physics.js';
import {
  hasPlayerBlessing,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
  type SimPropState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const TABLE_TECH_ROCKET_BASE_DMG = 26;
export const TABLE_TECH_ROCKET_SPEED = 520;
export const TABLE_TECH_ROCKET_SLAM_ICD_SEC = 0.6;
export const TABLE_TECH_ROCKET_KICK_SPEED = 620;
export const TABLE_TECH_ROCKET_BLAST_BASE_DMG = 60;
export const TABLE_TECH_ROCKET_BLAST_RADIUS = 104;

export const TABLE_TECH_BLANK_NOVA_RADIUS = 160;
export const TABLE_TECH_BLANK_NOVA_FREEZE_SEC = 1.5;

export const TABLE_TECH_PRISM_SPLIT_HALF_ANGLE_RAD = (12 * Math.PI) / 180;
export const TABLE_TECH_PRISM_SPLIT_ADDITIVE_BONUS = 0.2;
export const TABLE_TECH_PRISM_SLAM_BASE_DMG = 22;

export const TABLE_TECH_BILLIARD_SPEED_MULT = 1.35;
export const TABLE_TECH_BILLIARD_MIN_BOUNCES = 3;
export const TABLE_TECH_BILLIARD_SLAM_DMG_MULT = 1.4;

export function findNearestAliveCombatEnemy(
  sim: WorldSim,
  x: number,
  y: number,
  excludeEnemyId?: number,
): SimEnemyState | null {
  let best: SimEnemyState | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (
      e.hp <= 0 ||
      e.isDummy ||
      e.aiState === 'spawning' ||
      e.bossBurrowed ||
      e.id === excludeEnemyId
    ) {
      continue;
    }
    const d = distance(x, y, e.x, e.y);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

export function spawnTableTechHomingRockets(
  sim: WorldSim,
  actor: SimPlayerState,
  originX: number,
  originY: number,
  excludeEnemyId?: number,
): number {
  const rocketDmg = scaleBlessingDamage(TABLE_TECH_ROCKET_BASE_DMG, sim.currentFloor);
  const nearest = findNearestAliveCombatEnemy(sim, originX, originY, excludeEnemyId);
  const fallbackAngle =
    distance(originX, originY, actor.x, actor.y) > 4
      ? Math.atan2(actor.y - originY, actor.x - originX)
      : actor.aimAngle;
  const baseAngle = nearest
    ? Math.atan2(nearest.y - originY, nearest.x - originX)
    : fallbackAngle;
  const spreadRad = 0.24;
  const shotFlags = SHOT_FLAG.DYNAMIC_BOUNCE;
  const prevIds = new Set(sim.projectiles.map((p) => p.id));

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    eventId: sim.nextVolleyEventId++,
    ownerId: actor.id,
    team: 'player',
    weaponId: 'table_tech_rocket',
    x: originX,
    y: originY,
    angle: baseAngle,
    pelletCount: 2,
    spreadRad,
    speed: TABLE_TECH_ROCKET_SPEED,
    damage: rocketDmg,
    radius: 7,
    knockback: 150,
    pierceCount: 0,
    bounceCount: 0,
    ttlSec: 1.8,
    element: 'burn',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    shotFlags,
    flags: shotFlags,
    explosionRadius: 42,
    guaranteedElementalProc: true,
    originX,
    originY,
  });

  let spawnedCount = 0;
  for (let i = 0; i < sim.projectiles.length; i++) {
    const p = sim.projectiles[i]!;
    if (!prevIds.has(p.id)) {
      if (excludeEnemyId !== undefined && !p.hitEntityIds.includes(excludeEnemyId)) {
        p.hitEntityIds.push(excludeEnemyId);
      }
      spawnedCount += 1;
    }
  }
  return spawnedCount;
}

export function updateTableTechRocketProjectilesInFlight(
  sim: WorldSim,
  b: SimProjectileState,
  dtSec: number,
): void {
  if (b.team !== 'player' || b.weaponId !== 'table_tech_rocket' || b.ttlSec <= 0) return;
  const target = findNearestAliveCombatEnemy(sim, b.x, b.y);
  if (!target) return;

  const desiredAngle = Math.atan2(target.y - b.y, target.x - b.x);
  const diff = angleDiff(desiredAngle, b.angle);
  const maxTurn = 14 * dtSec;
  const turn = Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
  b.angle += turn;
  const speed = Math.hypot(b.vx, b.vy) || TABLE_TECH_ROCKET_SPEED;
  b.vx = Math.cos(b.angle) * speed;
  b.vy = Math.sin(b.angle) * speed;
}

export function detonateRocketChargedBarricade(
  sim: WorldSim,
  prop: SimPropState,
  ownerId = prop.slideOwnerPlayerId ?? sim.player.id,
): void {
  if (prop.hp <= 0 && !prop.rocketCharged) return;
  prop.hp = 0;
  prop.destructible = false;
  prop.blocksMovement = false;
  prop.blocksEnemyProjectiles = false;
  prop.rocketCharged = false;

  const blastDmg = scaleBlessingDamage(TABLE_TECH_ROCKET_BLAST_BASE_DMG, sim.currentFloor);
  sim.map.igniteSurfaceInRadius(prop.x, prop.y, TABLE_TECH_ROCKET_BLAST_RADIUS);

  sim.events.push({
    kind: 'prop_destroyed',
    propId: prop.id,
    propKind: prop.kind,
    x: prop.x,
    y: prop.y,
  });
  sim.events.push({
    kind: 'explosion',
    x: prop.x,
    y: prop.y,
    radius: TABLE_TECH_ROCKET_BLAST_RADIUS,
    damage: blastDmg,
    sourceDefId: 'table_tech_rocket',
  });

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) continue;
    if (distance(prop.x, prop.y, e.x, e.y) <= TABLE_TECH_ROCKET_BLAST_RADIUS + e.radius) {
      const hitAng =
        distance(prop.x, prop.y, e.x, e.y) > 1e-4
          ? Math.atan2(e.y - prop.y, e.x - prop.x)
          : 0;
      sim.applyDamageToEnemy(e, blastDmg, false, 'burn', hitAng, 220, true, ownerId);
      if (e.hp > 0) {
        e.burnTimer = Math.max(e.burnTimer, 3.0);
        sim.applyElementStatusToEnemy(e, 'burn', blastDmg, ownerId);
      }
    }
  }
}

export function triggerTableTechBlankNova(
  sim: WorldSim,
  centerX: number,
  centerY: number,
  _actor: SimPlayerState,
  skipFreezeEnemyId?: number,
): number {
  const cleared = clearEnemyProjectilesAroundProp(
    sim,
    centerX,
    centerY,
    TABLE_TECH_BLANK_NOVA_RADIUS,
  );

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (
      e.hp <= 0 ||
      e.isDummy ||
      e.aiState === 'spawning' ||
      e.bossBurrowed ||
      e.id === skipFreezeEnemyId
    ) {
      continue;
    }
    if (distance(centerX, centerY, e.x, e.y) <= TABLE_TECH_BLANK_NOVA_RADIUS + e.radius) {
      e.frozenTimer = Math.max(e.frozenTimer, TABLE_TECH_BLANK_NOVA_FREEZE_SEC);
      e.chillTimer = 0;
      e.chillStacks = 0;
      e.vx = 0;
      e.vy = 0;
      if (!sim.stressTestActive) {
        sim.events.push({
          kind: 'status_applied',
          targetId: e.id,
          status: 'frozen',
          x: e.x,
          y: e.y,
        });
      }
    }
  }
  return cleared;
}

export function refractProjectileThroughPrismBarricade(
  sim: WorldSim,
  b: SimProjectileState,
  prop: SimPropState,
): boolean {
  if (
    b.team !== 'player' ||
    prop.coverState !== 'flipped' ||
    !prop.prismAuraActive ||
    b.hitEntityIds.includes(prop.id) ||
    b.weaponId === 'void_staff' ||
    b.weaponId === 'emerald_cleaver_boomerang'
  ) {
    return false;
  }

  b.hitEntityIds.push(prop.id);
  b.passedThroughCoverOrPrism = true;
  prop.hitFlashTimer = Math.max(prop.hitFlashTimer, 0.12);

  const nextPrismAdd = Number(
    ((b.prismBonusAdd ?? 0) + TABLE_TECH_PRISM_SPLIT_ADDITIVE_BONUS).toFixed(4),
  );
  const boostedDamage = Math.max(
    1,
    Math.round(b.damage * (1 + TABLE_TECH_PRISM_SPLIT_ADDITIVE_BONUS)),
  );

  // One-Split Rule: splitGeneration >= 1 MUST NOT spawn new child rays!
  if ((b.splitGeneration ?? 0) >= 1) {
    b.splitGeneration = 1;
    b.prismBonusAdd = nextPrismAdd;
    b.damage = boostedDamage;
    b.element = 'shock';
    b.bounceRemaining = clampBounceCount((b.bounceRemaining ?? 0) + 1);
    b.shotFlags = (b.shotFlags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE;
    return false;
  }

  const origId = b.id;
  const baseAngle = b.angle;
  const speed = Math.max(420, Math.hypot(b.vx, b.vy));
  const origTtl = Math.max(b.ttlSec, 1.2);
  const preservedHits = [...b.hitEntityIds];
  const prevIds = new Set(sim.projectiles.map((p) => p.id));

  b.ttlSec = 0;

  const shotFlags = (b.shotFlags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE;
  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    eventId: sim.nextVolleyEventId++,
    ownerId: b.ownerId,
    team: 'player',
    weaponId: b.weaponId,
    x: prop.x + Math.cos(baseAngle) * (prop.radius + b.radius + 2),
    y: prop.y + Math.sin(baseAngle) * (prop.radius + b.radius + 2),
    angle: baseAngle,
    pelletCount: 2,
    spreadRad: TABLE_TECH_PRISM_SPLIT_HALF_ANGLE_RAD * 2,
    speed,
    damage: boostedDamage,
    radius: b.radius,
    knockback: b.knockback,
    pierceCount: b.pierceRemaining,
    bounceCount: clampBounceCount(b.bounceRemaining),
    ttlSec: origTtl,
    element: 'shock',
    critChance: b.isCrit ? 1 : 0,
    amplifiedByShield: Boolean(b.amplifiedByShield),
    seed: sim.rng.nextUint32(),
    shotFlags,
    flags: shotFlags,
    replacedProjectileId: origId,
    explosionRadius: b.explosionRadius,
    guaranteedElementalProc: b.guaranteedElementalProc,
  });

  const rayAngles = [
    baseAngle - TABLE_TECH_PRISM_SPLIT_HALF_ANGLE_RAD,
    baseAngle + TABLE_TECH_PRISM_SPLIT_HALF_ANGLE_RAD,
  ];
  let rayIdx = 0;
  for (let i = 0; i < sim.projectiles.length; i++) {
    const child = sim.projectiles[i]!;
    if (!prevIds.has(child.id)) {
      const exactAngle = rayAngles[rayIdx] ?? baseAngle;
      rayIdx += 1;
      child.angle = exactAngle;
      child.vx = Math.cos(exactAngle) * speed;
      child.vy = Math.sin(exactAngle) * speed;
      child.isCrit = b.isCrit;
      child.element = 'shock';
      child.splitGeneration = 1;
      child.prismBonusAdd = nextPrismAdd;
      child.passedThroughCoverOrPrism = true;
      child.shotFlags = shotFlags;
      for (const hid of preservedHits) {
        if (!child.hitEntityIds.includes(hid)) {
          child.hitEntityIds.push(hid);
        }
      }
    }
  }
  return true;
}

export function spawnTableTechPrismSlamRays(
  sim: WorldSim,
  actor: SimPlayerState,
  originX: number,
  originY: number,
  excludeEnemyId?: number,
): number {
  const rayDmg = scaleBlessingDamage(TABLE_TECH_PRISM_SLAM_BASE_DMG, sim.currentFloor);
  const nearest = findNearestAliveCombatEnemy(sim, originX, originY, excludeEnemyId);
  const fallbackAngle =
    distance(originX, originY, actor.x, actor.y) > 4
      ? Math.atan2(actor.y - originY, actor.x - originX)
      : actor.aimAngle;
  const baseAngle = nearest
    ? Math.atan2(nearest.y - originY, nearest.x - originX)
    : fallbackAngle;
  const speed = 560;
  const shotFlags = SHOT_FLAG.DYNAMIC_BOUNCE;
  const prevIds = new Set(sim.projectiles.map((p) => p.id));

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    eventId: sim.nextVolleyEventId++,
    ownerId: actor.id,
    team: 'player',
    weaponId: 'table_tech_prism_split',
    x: originX,
    y: originY,
    angle: baseAngle,
    pelletCount: 2,
    spreadRad: TABLE_TECH_PRISM_SPLIT_HALF_ANGLE_RAD * 2,
    speed,
    damage: rayDmg,
    radius: 5,
    knockback: 120,
    pierceCount: 1,
    bounceCount: 1,
    ttlSec: 1.2,
    element: 'shock',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    shotFlags,
    flags: shotFlags,
    guaranteedElementalProc: true,
    originX,
    originY,
  });

  const rayAngles = [
    baseAngle - TABLE_TECH_PRISM_SPLIT_HALF_ANGLE_RAD,
    baseAngle + TABLE_TECH_PRISM_SPLIT_HALF_ANGLE_RAD,
  ];
  let rayIdx = 0;
  for (let i = 0; i < sim.projectiles.length; i++) {
    const child = sim.projectiles[i]!;
    if (!prevIds.has(child.id)) {
      const exactAngle = rayAngles[rayIdx] ?? baseAngle;
      rayIdx += 1;
      child.angle = exactAngle;
      child.vx = Math.cos(exactAngle) * speed;
      child.vy = Math.sin(exactAngle) * speed;
      child.splitGeneration = 1;
      child.prismBonusAdd = TABLE_TECH_PRISM_SPLIT_ADDITIVE_BONUS;
      child.passedThroughCoverOrPrism = true;
      child.element = 'shock';
      child.shotFlags = shotFlags;
      if (excludeEnemyId !== undefined && !child.hitEntityIds.includes(excludeEnemyId)) {
        child.hitEntityIds.push(excludeEnemyId);
      }
    }
  }
  return rayIdx;
}

export function applyFlipCoverTableTechBlessings(
  sim: WorldSim,
  prop: SimPropState,
  actor: SimPlayerState,
): { blankRadius: number; extraBulletsCleared: number } {
  prop.flippedByPlayerId = actor.id;
  let blankRadius = FLIP_COVER_MICRO_BLANK_RADIUS;
  let extraBulletsCleared = 0;

  if (hasPlayerBlessing(actor, 'table_tech_prism_split')) {
    prop.prismAuraActive = true;
    prop.lightRadius = Math.max(prop.lightRadius, 85);
    prop.lightColorHex = '#34D399';
  }
  if (hasPlayerBlessing(actor, 'table_tech_rocket')) {
    spawnTableTechHomingRockets(sim, actor, prop.x, prop.y);
  }
  if (hasPlayerBlessing(actor, 'table_tech_blank_nova')) {
    blankRadius = TABLE_TECH_BLANK_NOVA_RADIUS;
    prop.microBlankRadius = TABLE_TECH_BLANK_NOVA_RADIUS;
    extraBulletsCleared = triggerTableTechBlankNova(sim, prop.x, prop.y, actor);
  }
  return { blankRadius, extraBulletsCleared };
}

export function applyKickPropTableTechBlessings(
  sim: WorldSim,
  prop: SimPropState,
  actor: SimPlayerState,
  baseSpeed: number,
  onIce: boolean,
): number {
  let effectiveBase = baseSpeed;
  if (isFlippableBarricadeProp(prop.kind) && hasPlayerBlessing(actor, 'table_tech_rocket')) {
    prop.rocketCharged = true;
    effectiveBase = Math.max(effectiveBase, TABLE_TECH_ROCKET_KICK_SPEED);
  }
  let speed = onIce ? effectiveBase * BIOME2_ICE_INERTIA_MULT : effectiveBase;

  if (hasPlayerBlessing(actor, 'table_tech_billiard_master')) {
    speed *= TABLE_TECH_BILLIARD_SPEED_MULT;
    prop.bouncesRemaining = Math.max(
      prop.bouncesRemaining ?? 0,
      TABLE_TECH_BILLIARD_MIN_BOUNCES,
    );
  }
  if (hasPlayerBlessing(actor, 'table_tech_blank_nova') && isFlippableBarricadeProp(prop.kind)) {
    triggerTableTechBlankNova(sim, prop.x, prop.y, actor);
  }
  return speed;
}

export function triggerTableTechOnWallSlamOrStagger(
  sim: WorldSim,
  actor: SimPlayerState,
  x: number,
  y: number,
  skipFreezeEnemyId?: number,
  slammedEnemyId?: number,
): void {
  if (hasPlayerBlessing(actor, 'table_tech_rocket')) {
    if ((actor.tableTechRocketIcdTimer ?? 0) <= 0) {
      actor.tableTechRocketIcdTimer = TABLE_TECH_ROCKET_SLAM_ICD_SEC;
      spawnTableTechHomingRockets(sim, actor, x, y, slammedEnemyId);
    }
  }
  if (hasPlayerBlessing(actor, 'table_tech_blank_nova')) {
    triggerTableTechBlankNova(sim, x, y, actor, skipFreezeEnemyId);
  }
  if (hasPlayerBlessing(actor, 'table_tech_prism_split')) {
    spawnTableTechPrismSlamRays(sim, actor, x, y, slammedEnemyId);
  }
}

export function triggerBossStaggerBurst(
  sim: WorldSim,
  boss: SimEnemyState,
  attackerPlayerId = boss.lastHitPlayerId ?? sim.player.id,
): boolean {
  if (!boss.isBoss || boss.hp <= 0) return false;
  boss.bossStaggerAccum = 0;
  boss.stunTimer = Math.max(boss.stunTimer ?? 0, 0.5);
  boss.aiState = 'stunned';
  boss.stateTimer = Math.max(boss.stateTimer, 0.5);
  boss.vx = 0;
  boss.vy = 0;

  const attacker = sim.getPlayerById(attackerPlayerId) ?? sim.player;
  const rawSlam = computeWallSlamDamage(boss, sim.currentFloor);
  const slamDmg = hasPlayerBlessing(attacker, 'table_tech_billiard_master')
    ? Math.round(rawSlam * TABLE_TECH_BILLIARD_SLAM_DMG_MULT)
    : rawSlam;

  boss.hp = Math.max(0, boss.hp - slamDmg);
  boss.hitFlashTimer = 0.14;
  sim.events.push({
    kind: 'damage_dealt',
    targetId: boss.id,
    targetKind: 'enemy',
    x: boss.x,
    y: boss.y,
    amount: slamDmg,
    isCrit: false,
    hitArmor: false,
    element: 'none',
    knockbackX: 0,
    knockbackY: 0,
  });
  sim.events.push({
    kind: 'wall_slam',
    enemyId: boss.id,
    x: boss.x,
    y: boss.y,
    damage: slamDmg,
    shattered: false,
  });

  triggerTableTechOnWallSlamOrStagger(sim, attacker, boss.x, boss.y, undefined, boss.id);
  sim.checkBossPhaseTransitions(boss);
  if (boss.hp <= 0) {
    sim.handleEnemyKilled(boss, attacker.id);
  }
  return true;
}
