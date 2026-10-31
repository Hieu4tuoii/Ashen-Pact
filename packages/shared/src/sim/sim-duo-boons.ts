import { scaleBlessingDamage } from '../data/blessings.js';
import type { DuoBoonId, ElementalReactionId } from '../data/types.js';
import { angleDiff, clamp, distance } from '../math/vec2.js';
import { SHOT_FLAG } from '../protocol/messages.js';
import { isFlippableBarricadeProp } from './sim-tactical-physics.js';
import {
  MAX_TACTICAL_PROPS_PER_ROOM,
  hasPlayerDuoBoon,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
  type SimPropState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const SUPERHEATED_CYCLONE_SPEED = 140;
export const SUPERHEATED_CYCLONE_BASE_DPS = 14;
export const SUPERHEATED_CYCLONE_TTL_SEC = 4.0;
export const SUPERHEATED_CYCLONE_AURA_RADIUS = 56;
export const MAX_CYCLONES_PER_PLAYER = 3;

export const CRYO_SHATTER_SPIRE_COUNT = 4;
export const CRYO_SHATTER_SPIRE_TTL_SEC = 4.0;
export const CRYO_SHATTER_SPIRE_BLAST_RADIUS = 80;
export const CRYO_SHATTER_SPIRE_BASE_DMG = 34;
export const CRYO_SHATTER_SPIRE_FREEZE_SEC = 1.2;

export const SUPERCONDUCT_RAIL_RADIUS = 100;

export const NAPALM_PLAGUE_SPREAD_RADIUS = 160;
export const NAPALM_PLAGUE_BLAST_RADIUS = 110;
export const NAPALM_PLAGUE_BASE_DMG = 32;
export const NAPALM_PLAGUE_TTL_SEC = 5.0;

export const PLASMA_OVERLOAD_STAR_SPEED = 420;
export const PLASMA_OVERLOAD_STAR_BOUNCES = 3;
export const PLASMA_OVERLOAD_STAR_BASE_DMG = 30;
export const PLASMA_OVERLOAD_STAR_ICD_SEC = 0.35;

export const MAGNETIC_BASTION_MAX_DIST = 220;
export const MAGNETIC_BASTION_BASE_DPS = 28;
export const MAGNETIC_BASTION_WIRE_HALF_WIDTH = 14;

const SUPERCONDUCT_RAIL_EXCLUDED_WEAPONS: ReadonlySet<string> = new Set<string>([
  'knight_sword',
  'knight_sword_wave',
  'knight_sword_parry',
  'ruby_sword_wave',
  'berserker_axe',
  'thunder_hammer',
  'shockwave_edge_blade',
  'dash_phase_blade',
  'emerald_cleaver',
  'emerald_cleaver_boomerang',
  'mutator_boomerang_saw',
  'void_staff',
  'tediore_chuck',
  'reload_tediore_chuck',
  'table_tech_rocket',
  'relic_perpetual_core_rocket',
  'vanguard_bastion_prism',
  'holster_surge_bolt',
  'table_tech_toxic_shrapnel',
  'duo_plasma_overload_star',
]);

let activeDuoReactionWeaponId: string | undefined;
let isProcessingNapalmQueue = false;
const napalmDetonationQueue: Array<{ enemy: SimEnemyState; ownerId: number }> = [];
const zappedEnemyIdsScratch = new Set<number>();

export function setActiveDuoReactionWeaponId(weaponId: string | undefined): void {
  activeDuoReactionWeaponId = weaponId;
}

export function anyPlayerHasDuoBoon(sim: WorldSim, id: DuoBoonId): SimPlayerState | null {
  if (hasPlayerDuoBoon(sim.player, id)) return sim.player;
  for (let i = 0; i < sim.simulatedPlayers.length; i++) {
    const sp = sim.simulatedPlayers[i]!;
    if (hasPlayerDuoBoon(sp, id)) return sp;
  }
  return null;
}

function resolveReactionDuoOwner(
  sim: WorldSim,
  duoId: DuoBoonId,
  triggerPlayerId: number,
  primerPlayerId: number,
): SimPlayerState | null {
  if (triggerPlayerId > 0) {
    const triggerPl = sim.getPlayerById(triggerPlayerId);
    if (hasPlayerDuoBoon(triggerPl, duoId)) return triggerPl!;
  }
  if (primerPlayerId > 0 && primerPlayerId !== triggerPlayerId) {
    const primerPl = sim.getPlayerById(primerPlayerId);
    if (hasPlayerDuoBoon(primerPl, duoId)) return primerPl!;
  }
  return null;
}

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

function spawnSuperheatedCyclone(sim: WorldSim, owner: SimPlayerState, x: number, y: number): void {
  let ownerCount = 0;
  let oldestIdx = -1;
  let lowestTtl = Infinity;
  for (let i = 0; i < sim.summons.length; i++) {
    const s = sim.summons[i]!;
    if (
      s.kind === 'superheated_cyclone' &&
      s.ownerPlayerId === owner.id &&
      s.ttlSec > 0 &&
      s.hp > 0
    ) {
      ownerCount += 1;
      if (s.ttlSec < lowestTtl) {
        lowestTtl = s.ttlSec;
        oldestIdx = i;
      }
    }
  }
  if (ownerCount >= MAX_CYCLONES_PER_PLAYER && oldestIdx >= 0) {
    sim.summons.splice(oldestIdx, 1);
  }

  const col = sim.map.resolveCircleCollision(x, y, 14, true);
  sim.summons.push({
    id: ++sim.nextEntityId,
    ownerPlayerId: owner.id,
    kind: 'superheated_cyclone',
    nameVi: 'Lốc Xoáy Nước Sôi',
    x: col.x,
    y: col.y,
    radius: 14,
    auraRadius: SUPERHEATED_CYCLONE_AURA_RADIUS,
    hp: 9999,
    maxHp: 9999,
    ttlSec: SUPERHEATED_CYCLONE_TTL_SEC,
    maxTtlSec: SUPERHEATED_CYCLONE_TTL_SEC,
    tickTimer: 0.1,
    healsRemaining: 0,
    charge: 0,
    poisonRoots: false,
    selfDestruct: false,
    rootedEnemyIds: [],
  });
}

function findSafeCryoSpirePosition(
  sim: WorldSim,
  cx: number,
  cy: number,
  baseAngle: number,
  ringRadius: number,
  spireRadius: number,
  allPlayers: readonly SimPlayerState[],
): { x: number; y: number } {
  const candidateAngles = [baseAngle, baseAngle + 0.45, baseAngle - 0.45, baseAngle + Math.PI];
  for (let aIdx = 0; aIdx < candidateAngles.length; aIdx++) {
    const ang = candidateAngles[aIdx]!;
    const rawX = cx + Math.cos(ang) * ringRadius;
    const rawY = cy + Math.sin(ang) * ringRadius;
    const col = sim.map.resolveCircleCollision(rawX, rawY, spireRadius, true);
    let sx = col.x;
    let sy = col.y;

    for (let pass = 0; pass < 2; pass++) {
      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const pl = allPlayers[pIdx]!;
        if (pl.lifeState !== 'alive') continue;
        const minClear = pl.radius + spireRadius + 6.5;
        const d = distance(pl.x, pl.y, sx, sy);
        if (d < minClear) {
          const pushAng = d > 1e-3 ? Math.atan2(sy - pl.y, sx - pl.x) : ang;
          const pushedX = pl.x + Math.cos(pushAng) * (minClear + 1.5);
          const pushedY = pl.y + Math.sin(pushAng) * (minClear + 1.5);
          const pushedCol = sim.map.resolveCircleCollision(pushedX, pushedY, spireRadius, true);
          sx = pushedCol.x;
          sy = pushedCol.y;
        }
      }
    }

    let clearOfAllPlayers = true;
    for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
      const pl = allPlayers[pIdx]!;
      if (pl.lifeState !== 'alive') continue;
      if (distance(pl.x, pl.y, sx, sy) < pl.radius + spireRadius + 6) {
        clearOfAllPlayers = false;
        break;
      }
    }
    if (clearOfAllPlayers) {
      return { x: sx, y: sy };
    }
  }

  // Fallback: place radially outside the nearest alive player's clearance ring
  const refPl = sim.findNearestAlivePlayer(cx, cy);
  const fallbackDist = refPl.radius + spireRadius + 10;
  for (let k = 0; k < 8; k++) {
    const ang = baseAngle + k * (Math.PI * 0.25);
    const col = sim.map.resolveCircleCollision(
      refPl.x + Math.cos(ang) * fallbackDist,
      refPl.y + Math.sin(ang) * fallbackDist,
      spireRadius,
      true,
    );
    if (distance(refPl.x, refPl.y, col.x, col.y) >= refPl.radius + spireRadius + 6) {
      return { x: col.x, y: col.y };
    }
  }
  return { x: cx, y: cy };
}

function spawnCryoShatterSpires(
  sim: WorldSim,
  owner: SimPlayerState,
  enemy: SimEnemyState,
): void {
  if ((enemy.cryoSpireIcdTimer ?? 0) > 0) return;
  enemy.cryoSpireIcdTimer = 0.25;

  let aliveProps = 0;
  for (let i = 0; i < sim.props.length; i++) {
    if (sim.props[i]!.hp > 0) aliveProps += 1;
  }
  const availableSlots = Math.max(0, MAX_TACTICAL_PROPS_PER_ROOM - aliveProps);
  const spawnCount = Math.min(CRYO_SHATTER_SPIRE_COUNT, availableSlots);
  if (spawnCount <= 0) return;

  const allPlayers = sim.getAllPlayers();
  const ringRadius = Math.max(40, enemy.radius + 28);
  const estSpireRadius = 14;

  for (let k = 0; k < spawnCount; k++) {
    const baseAngle = Math.PI * 0.25 + k * (Math.PI * 0.5);
    const pos = findSafeCryoSpirePosition(
      sim,
      enemy.x,
      enemy.y,
      baseAngle,
      ringRadius,
      estSpireRadius,
      allPlayers,
    );
    const spire = sim.spawnProp('glacial_spike', pos.x, pos.y);
    spire.cryoShatterSpire = true;
    spire.ownerPlayerId = owner.id;
    spire.ttlSec = CRYO_SHATTER_SPIRE_TTL_SEC;
    spire.blocksMovement = true;
    spire.blocksEnemyProjectiles = true;
    spire.destructible = true;

    // Final exact-radius guard against trapping any alive player
    for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
      const pl = allPlayers[pIdx]!;
      if (pl.lifeState !== 'alive') continue;
      const minDist = pl.radius + spire.radius + 6;
      const d = distance(pl.x, pl.y, spire.x, spire.y);
      if (d < minDist) {
        const pushAng = d > 1e-3 ? Math.atan2(spire.y - pl.y, spire.x - pl.x) : baseAngle;
        const safe = findSafeCryoSpirePosition(
          sim,
          pl.x,
          pl.y,
          pushAng,
          minDist + 2,
          spire.radius,
          allPlayers,
        );
        spire.x = safe.x;
        spire.y = safe.y;
      }
    }
  }
}

function splashNapalmPlagueOnToxicBlast(
  sim: WorldSim,
  owner: SimPlayerState,
  originEnemy: SimEnemyState,
): void {
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (
      e.hp <= 0 ||
      e.isDummy ||
      e.defId === 'ashen_executioner' ||
      e.aiState === 'spawning' ||
      e.bossBurrowed
    ) {
      continue;
    }
    if (distance(originEnemy.x, originEnemy.y, e.x, e.y) <= NAPALM_PLAGUE_SPREAD_RADIUS + e.radius) {
      e.napalmPlagueTimer = NAPALM_PLAGUE_TTL_SEC;
      e.napalmPlagueOwnerId = owner.id;
      e.napalmPlagueDetonated = false;
    }
  }
}

function launchPlasmaOverloadStar(
  sim: WorldSim,
  owner: SimPlayerState,
  enemy: SimEnemyState,
): void {
  if ((owner.plasmaStarIcdTimer ?? 0) > 0) return;
  owner.plasmaStarIcdTimer = PLASMA_OVERLOAD_STAR_ICD_SEC;

  const dToEnemy = distance(owner.x, owner.y, enemy.x, enemy.y);
  const fireAngle =
    dToEnemy > 2 ? Math.atan2(enemy.y - owner.y, enemy.x - owner.x) : owner.aimAngle;
  const col = sim.map.resolveCircleCollision(enemy.x, enemy.y, 8, true);
  const starDmg = scaleBlessingDamage(PLASMA_OVERLOAD_STAR_BASE_DMG, sim.currentFloor);
  const shotFlags = SHOT_FLAG.DYNAMIC_BOUNCE;

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    eventId: sim.nextVolleyEventId++,
    ownerId: owner.id,
    team: 'player',
    weaponId: 'duo_plasma_overload_star',
    x: col.x,
    y: col.y,
    angle: fireAngle,
    pelletCount: 1,
    spreadRad: 0,
    speed: PLASMA_OVERLOAD_STAR_SPEED,
    damage: starDmg,
    radius: 8,
    knockback: 90,
    pierceCount: 24,
    bounceCount: PLASMA_OVERLOAD_STAR_BOUNCES,
    ttlSec: 3.5,
    element: 'shock',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    shotFlags,
    flags: shotFlags,
  });
}

export function handleDuoBoonOnElementalReaction(
  sim: WorldSim,
  enemy: SimEnemyState,
  reaction: ElementalReactionId,
  _damage: number,
  primerPlayerId: number,
  triggerPlayerId: number,
  sourceWeaponId?: string,
): void {
  if (sim.stressTestActive) return;
  const resolvedWeaponId = sourceWeaponId ?? activeDuoReactionWeaponId;

  switch (reaction) {
    case 'vaporize': {
      const owner = resolveReactionDuoOwner(
        sim,
        'duo_superheated_cyclone',
        triggerPlayerId,
        primerPlayerId,
      );
      if (owner) {
        spawnSuperheatedCyclone(sim, owner, enemy.x, enemy.y);
      }
      break;
    }
    case 'shatter': {
      const owner = resolveReactionDuoOwner(
        sim,
        'duo_cryo_shatter_spires',
        triggerPlayerId,
        primerPlayerId,
      );
      if (owner) {
        spawnCryoShatterSpires(sim, owner, enemy);
      }
      break;
    }
    case 'toxic_blast': {
      const owner = resolveReactionDuoOwner(
        sim,
        'duo_napalm_chain_plague',
        triggerPlayerId,
        primerPlayerId,
      );
      if (owner) {
        splashNapalmPlagueOnToxicBlast(sim, owner, enemy);
      }
      break;
    }
    case 'overload': {
      if (resolvedWeaponId === 'duo_plasma_overload_star') {
        break;
      }
      const owner = resolveReactionDuoOwner(
        sim,
        'duo_plasma_overload_star',
        triggerPlayerId,
        primerPlayerId,
      );
      if (owner) {
        launchPlasmaOverloadStar(sim, owner, enemy);
      }
      break;
    }
    default:
      break;
  }
}

export function handleDuoBoonOnEnemyKilled(
  sim: WorldSim,
  enemy: SimEnemyState,
  killerPlayerId: number,
): void {
  if (sim.stressTestActive) return;
  if (enemy.napalmPlagueDetonated || (enemy.napalmPlagueTimer ?? 0) <= 0) return;

  const ownerId = enemy.napalmPlagueOwnerId || killerPlayerId || sim.player.id;
  enemy.napalmPlagueDetonated = true;
  enemy.napalmPlagueTimer = 0;
  napalmDetonationQueue.push({ enemy, ownerId });

  if (isProcessingNapalmQueue) return;
  isProcessingNapalmQueue = true;

  try {
    while (napalmDetonationQueue.length > 0) {
      const current = napalmDetonationQueue.shift()!;
      const src = current.enemy;
      const blastOwnerId = current.ownerId;
      const blastDmg = scaleBlessingDamage(NAPALM_PLAGUE_BASE_DMG, sim.currentFloor);

      sim.map.igniteSurfaceInRadius(src.x, src.y, 52);
      sim.events.push({
        kind: 'explosion',
        x: src.x,
        y: src.y,
        radius: NAPALM_PLAGUE_BLAST_RADIUS,
        damage: blastDmg,
        sourceDefId: 'duo_napalm_chain_plague',
      });

      for (let i = 0; i < sim.enemies.length; i++) {
        const other = sim.enemies[i]!;
        if (
          other.id === src.id ||
          other.hp <= 0 ||
          other.isDummy ||
          other.defId === 'ashen_executioner' ||
          other.aiState === 'spawning' ||
          other.bossBurrowed
        ) {
          continue;
        }
        const d = distance(src.x, src.y, other.x, other.y);
        if (d <= NAPALM_PLAGUE_BLAST_RADIUS + other.radius) {
          const hitAng = d > 1e-3 ? Math.atan2(other.y - src.y, other.x - src.x) : 0;
          sim.applyDamageToEnemy(
            other,
            blastDmg,
            false,
            'burn',
            hitAng,
            140,
            false,
            blastOwnerId,
            true,
          );
        }
      }
    }
  } finally {
    napalmDetonationQueue.length = 0;
    isProcessingNapalmQueue = false;
  }
}

export function tryDetonateCryoShatterSpireOnKickOrSlide(
  sim: WorldSim,
  prop: SimPropState,
  actorPlayerId: number,
): boolean {
  if (!prop.cryoShatterSpire || prop.hp <= 0) return false;

  const ownerId = actorPlayerId || prop.ownerPlayerId || sim.player.id;
  const blastDmg = scaleBlessingDamage(CRYO_SHATTER_SPIRE_BASE_DMG, sim.currentFloor);

  prop.hp = 0;
  prop.state = 'broken';
  prop.destructible = false;
  prop.blocksMovement = false;
  prop.blocksEnemyProjectiles = false;

  sim.map.freezeSurfaceInRadius(prop.x, prop.y, 48);
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
    radius: CRYO_SHATTER_SPIRE_BLAST_RADIUS,
    damage: blastDmg,
    sourceDefId: 'duo_cryo_shatter_spire',
  });

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (
      e.hp <= 0 ||
      e.isDummy ||
      e.defId === 'ashen_executioner' ||
      e.aiState === 'spawning' ||
      e.bossBurrowed
    ) {
      continue;
    }
    const d = distance(prop.x, prop.y, e.x, e.y);
    if (d <= CRYO_SHATTER_SPIRE_BLAST_RADIUS + e.radius) {
      const hitAng = d > 1e-3 ? Math.atan2(e.y - prop.y, e.x - prop.x) : 0;
      sim.applyDamageToEnemy(e, blastDmg, false, 'chill', hitAng, 165, false, ownerId, true);
      if (e.hp > 0) {
        const freezeDur = e.isBoss ? 0.6 : CRYO_SHATTER_SPIRE_FREEZE_SEC;
        e.frozenTimer = Math.max(e.frozenTimer, freezeDur);
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
  }
  return true;
}

function findSuperconductMagneticTarget(
  sim: WorldSim,
  b: SimProjectileState,
): SimEnemyState | null {
  if (
    b.team !== 'player' ||
    ((b.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE) === 0 ||
    b.superconductRailRedirected ||
    b.ttlSec <= 0 ||
    (b.awaitingServerRedirectTimer ?? 0) > 0 ||
    SUPERCONDUCT_RAIL_EXCLUDED_WEAPONS.has(b.weaponId)
  ) {
    return null;
  }
  const speed = Math.hypot(b.vx, b.vy);
  if (speed <= 1) return null;

  const owner = sim.getPlayerById(b.ownerId);
  if (!hasPlayerDuoBoon(owner, 'duo_superconduct_rail')) return null;

  let bestEnemy: SimEnemyState | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (
      e.hp <= 0 ||
      e.isDummy ||
      e.defId === 'ashen_executioner' ||
      e.aiState === 'spawning' ||
      e.bossBurrowed ||
      e.superconductTimer <= 0 ||
      b.hitEntityIds.includes(e.id)
    ) {
      continue;
    }
    const d = distance(b.x, b.y, e.x, e.y);
    if (d <= SUPERCONDUCT_RAIL_RADIUS && d > e.radius + b.radius && d < bestDist) {
      bestDist = d;
      bestEnemy = e;
    }
  }

  if (!bestEnemy) return null;
  const currentAngle = Math.atan2(b.vy, b.vx);
  const targetAngle = Math.atan2(bestEnemy.y - b.y, bestEnemy.x - b.x);
  if (Math.abs(angleDiff(currentAngle, targetAngle)) <= 0.03) {
    return null;
  }
  return bestEnemy;
}

export function tryRedirectSuperconductRailServer(
  sim: WorldSim,
  b: SimProjectileState,
): boolean {
  if (sim.stressTestActive) return false;
  const target = findSuperconductMagneticTarget(sim, b);
  if (!target) return false;

  const targetAngle = Math.atan2(target.y - b.y, target.x - b.x);
  const speed = Math.max(360, Math.hypot(b.vx, b.vy));
  const origId = b.id;
  const remTtl = Math.max(0.35, b.ttlSec);
  const shotFlags = (b.shotFlags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE;
  b.ttlSec = 0;

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    eventId: sim.nextVolleyEventId++,
    ownerId: b.ownerId,
    team: 'player',
    weaponId: b.weaponId,
    x: b.x,
    y: b.y,
    angle: targetAngle,
    pelletCount: 1,
    spreadRad: 0,
    speed,
    damage: b.damage,
    radius: b.radius,
    knockback: b.knockback,
    pierceCount: b.pierceRemaining,
    bounceCount: b.bounceRemaining,
    bouncesDone: b.bouncesDone ?? 0,
    ttlSec: remTtl,
    element: b.element,
    critChance: b.isCrit ? 1 : 0,
    amplifiedByShield: b.amplifiedByShield,
    seed: sim.rng.nextUint32(),
    shotFlags,
    flags: shotFlags,
    replacedProjectileId: origId,
    explosionRadius: b.explosionRadius,
    guaranteedElementalProc: b.guaranteedElementalProc,
    originX: b.originX,
    originY: b.originY,
    gravitySingularityShot: b.gravitySingularityShot,
    chainHarpoonShot: b.chainHarpoonShot,
    bypassFrontShield: b.bypassFrontShield,
    secondaryInfusedElement: b.secondaryInfusedElement,
    splitGeneration: b.splitGeneration,
    superconductRailRedirected: true,
  });
  return true;
}

export function tryHoldSuperconductRailClient(
  sim: WorldSim,
  b: SimProjectileState,
): boolean {
  if (((b.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE) === 0) return false;
  const target = findSuperconductMagneticTarget(sim, b);
  if (!target) return false;

  b.vx = 0;
  b.vy = 0;
  b.awaitingServerRedirectTimer = 0.12;
  return true;
}

export function tryBouncePlasmaOverloadStarOnWall(
  sim: WorldSim,
  b: SimProjectileState,
  resolvedX: number,
  resolvedY: number,
  normalX: number,
  normalY: number,
): boolean {
  if (b.weaponId !== 'duo_plasma_overload_star' || b.bounceRemaining <= 0) {
    return false;
  }

  let nvx = b.vx;
  let nvy = b.vy;
  if (normalX !== 0) nvx = -nvx;
  if (normalY !== 0) nvy = -nvy;
  if (normalX === 0 && normalY === 0) {
    nvx = -nvx;
    nvy = -nvy;
  }
  const nextAngle = Math.atan2(nvy, nvx);
  const speed = Math.hypot(nvx, nvy) || PLASMA_OVERLOAD_STAR_SPEED;
  const origId = b.id;
  const remTtl = Math.max(0.45, b.ttlSec);
  const nextBounces = b.bounceRemaining - 1;
  const nextBouncesDone = (b.bouncesDone ?? 0) + 1;
  const shotFlags = (b.shotFlags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE;
  b.ttlSec = 0;

  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'projectile_impact',
      x: resolvedX,
      y: resolvedY,
      angle: b.angle,
      team: 'player',
      hitWall: true,
      destroyedByMelee: false,
      blockedByShield: false,
      isCrit: b.isCrit,
      element: b.element,
    });
  }

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    eventId: sim.nextVolleyEventId++,
    ownerId: b.ownerId,
    team: 'player',
    weaponId: 'duo_plasma_overload_star',
    x: resolvedX + Math.cos(nextAngle) * 2,
    y: resolvedY + Math.sin(nextAngle) * 2,
    angle: nextAngle,
    pelletCount: 1,
    spreadRad: 0,
    speed,
    damage: b.damage,
    radius: b.radius,
    knockback: b.knockback,
    pierceCount: b.pierceRemaining,
    bounceCount: nextBounces,
    bouncesDone: nextBouncesDone,
    ttlSec: remTtl,
    element: b.element,
    critChance: b.isCrit ? 1 : 0,
    amplifiedByShield: b.amplifiedByShield,
    seed: sim.rng.nextUint32(),
    shotFlags,
    flags: shotFlags,
    replacedProjectileId: origId,
  });
  return true;
}

export function updateDuoBoons(sim: WorldSim, dtSec: number): void {
  const allPlayers = sim.getAllPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const p = allPlayers[i]!;
    if ((p.plasmaStarIcdTimer ?? 0) > 0) {
      const next = (p.plasmaStarIcdTimer ?? 0) - dtSec;
      p.plasmaStarIcdTimer = next <= 1e-6 ? 0 : next;
    }
  }

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0) continue;
    if ((e.napalmPlagueTimer ?? 0) > 0) {
      const next = (e.napalmPlagueTimer ?? 0) - dtSec;
      e.napalmPlagueTimer = next <= 1e-6 ? 0 : next;
    }
    if ((e.cryoSpireIcdTimer ?? 0) > 0) {
      const next = (e.cryoSpireIcdTimer ?? 0) - dtSec;
      e.cryoSpireIcdTimer = next <= 1e-6 ? 0 : next;
    }
  }

  // 1. Update homing superheated_cyclone summons (TTL is already stepped in updateSkillZonesAndSummons)
  if (sim.summons.length > 0) {
    const cycloneTickDmg = Math.max(
      1,
      Math.round(scaleBlessingDamage(SUPERHEATED_CYCLONE_BASE_DPS, sim.currentFloor) * 0.25),
    );
    for (let i = 0; i < sim.summons.length; i++) {
      const s = sim.summons[i]!;
      if (s.kind !== 'superheated_cyclone' || s.ttlSec <= 0 || s.hp <= 0) continue;

      let nearest: SimEnemyState | null = null;
      let nearestDist = Infinity;
      for (let j = 0; j < sim.enemies.length; j++) {
        const e = sim.enemies[j]!;
        if (
          e.hp <= 0 ||
          e.isDummy ||
          e.defId === 'ashen_executioner' ||
          e.aiState === 'spawning' ||
          e.bossBurrowed
        ) {
          continue;
        }
        const d = distance(s.x, s.y, e.x, e.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = e;
        }
      }

      if (nearest && nearestDist > 2) {
        const stepPx = Math.min(nearestDist, SUPERHEATED_CYCLONE_SPEED * dtSec);
        const ang = Math.atan2(nearest.y - s.y, nearest.x - s.x);
        const col = sim.map.resolveCircleCollision(
          s.x + Math.cos(ang) * stepPx,
          s.y + Math.sin(ang) * stepPx,
          s.radius,
          true,
        );
        s.x = col.x;
        s.y = col.y;
      }

      s.tickTimer -= dtSec;
      if (s.tickTimer <= 0) {
        s.tickTimer += 0.25;
        for (let j = 0; j < sim.enemies.length; j++) {
          const e = sim.enemies[j]!;
          if (
            e.hp <= 0 ||
            e.isDummy ||
            e.defId === 'ashen_executioner' ||
            e.aiState === 'spawning' ||
            e.bossBurrowed
          ) {
            continue;
          }
          const d = distance(s.x, s.y, e.x, e.y);
          if (d <= s.auraRadius + e.radius) {
            e.steamBlindTimer = Math.max(e.steamBlindTimer, 1.5);
            const hitAng = d > 1e-3 ? Math.atan2(e.y - s.y, e.x - s.x) : 0;
            sim.applyDamageToEnemy(
              e,
              cycloneTickDmg,
              false,
              'none',
              hitAng,
              12,
              false,
              s.ownerPlayerId,
              true,
            );
          }
        }
      }
    }
  }

  // 2. Update duo_magnetic_bastion_ring electric arcs between flipped barricades within <= 220px
  const bastionOwner = anyPlayerHasDuoBoon(sim, 'duo_magnetic_bastion_ring');
  if (!bastionOwner || sim.tick % 15 !== 0 || sim.props.length < 2) return;

  const flippedBarricades: SimPropState[] = [];
  for (let i = 0; i < sim.props.length; i++) {
    const pr = sim.props[i]!;
    if (pr.hp > 0 && pr.coverState === 'flipped' && isFlippableBarricadeProp(pr.kind)) {
      flippedBarricades.push(pr);
    }
  }
  if (flippedBarricades.length < 2) return;

  const arcTickDmg = Math.max(
    1,
    Math.round(scaleBlessingDamage(MAGNETIC_BASTION_BASE_DPS, sim.currentFloor) * 0.25),
  );
  zappedEnemyIdsScratch.clear();

  for (let i = 0; i < flippedBarricades.length; i++) {
    const a = flippedBarricades[i]!;
    for (let j = i + 1; j < flippedBarricades.length; j++) {
      const b = flippedBarricades[j]!;
      if (distance(a.x, a.y, b.x, b.y) > MAGNETIC_BASTION_MAX_DIST) continue;

      let ownerId = bastionOwner.id;
      const plA = a.flippedByPlayerId ? sim.getPlayerById(a.flippedByPlayerId) : null;
      const plB = b.flippedByPlayerId ? sim.getPlayerById(b.flippedByPlayerId) : null;
      if (hasPlayerDuoBoon(plA, 'duo_magnetic_bastion_ring')) {
        ownerId = plA!.id;
      } else if (hasPlayerDuoBoon(plB, 'duo_magnetic_bastion_ring')) {
        ownerId = plB!.id;
      }
      const wireAngle = Math.atan2(b.y - a.y, b.x - a.x);

      for (let k = 0; k < sim.enemies.length; k++) {
        const e = sim.enemies[k]!;
        if (
          e.hp <= 0 ||
          e.isDummy ||
          e.defId === 'ashen_executioner' ||
          e.aiState === 'spawning' ||
          e.bossBurrowed ||
          zappedEnemyIdsScratch.has(e.id)
        ) {
          continue;
        }
        if (
          pointToSegmentDist(e.x, e.y, a.x, a.y, b.x, b.y) <=
          MAGNETIC_BASTION_WIRE_HALF_WIDTH + e.radius
        ) {
          zappedEnemyIdsScratch.add(e.id);
          sim.applyDamageToEnemy(e, arcTickDmg, false, 'shock', wireAngle, 20, false, ownerId, true);
        }
      }
    }
  }
}
