import { scaleBlessingDamage } from '../data/blessings.js';
import { WEAPONS } from '../data/weapons.js';
import { clamp, distance } from '../math/vec2.js';
import { SHOT_FLAG, TILE_SIZE } from '../protocol/messages.js';
import { findNearestWalkablePoint } from './arena-room-archetypes.js';
import {
  enforcePlayerDeployableCap,
  tryTriggerToxicShrapnelOnPropBreak,
} from './sim-blessings-p4a.js';
import {
  hasPlayerBlessing,
  MAX_TACTICAL_PROPS_PER_ROOM,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
  type SimPropState,
  type SimSummonState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const CAUSTIC_POD_RADIUS = 14;
export const CAUSTIC_POD_ROLL_SPEED = 240;
export const CAUSTIC_POD_ROLL_DIST = 120;
export const CAUSTIC_POD_TTL_SEC = 8.0;
export const CAUSTIC_POD_BLAST_RADIUS = 96;
export const CAUSTIC_POD_BASE_DMG = 38;
export const CAUSTIC_POD_SWAMP_SEC = 4.0;
export const CAUSTIC_POD_VULN_SEC = 5.0;
export const CAUSTIC_POD_FINALE_ICD_SEC = 0.4;

export const HOLSTER_SURGE_ICD_SEC = 2.0;
export const HOLSTER_SURGE_BASE_DMG = 26;
export const HOLSTER_SURGE_BOLT_SPEED = 820;
export const HOLSTER_SURGE_BOLT_TTL_SEC = 0.32;
export const HOLSTER_SURGE_BOLT_RADIUS = 10;
export const HOLSTER_SURGE_BOLT_PIERCE = 8;

export const WALL_TETHER_MAX_PYLONS_PER_PLAYER = 2;
export const WALL_TETHER_TTL_SEC = 4.5;
export const WALL_TETHER_RADIUS = 10;
export const WALL_TETHER_AURA_RADIUS = 360;
export const WALL_TETHER_TICK_SEC = 0.25;
export const WALL_TETHER_BASE_DPS = 26;
export const WALL_TETHER_WIRE_HALF_WIDTH = 10;

export const ORBIT_RETURN_DMG_RATIO = 0.45;
export const ORBIT_RETURN_CLIENT_HOLD_SEC = 0.12;
export const ORBIT_RETURN_CATCH_PAD_PX = 10;
export const ORBIT_RETURN_MIN_CATCH_TICKS = 2;

const ORBIT_RETURN_EXCLUDED_WEAPON_IDS = new Set<string>([
  'void_staff',
  'emerald_cleaver',
  'emerald_cleaver_boomerang',
  'knight_sword',
  'knight_sword_wave',
  'knight_sword_parry',
  'ruby_sword_wave',
  'berserker_axe',
  'thunder_hammer',
  'shockwave_edge_blade',
  'dash_phase_blade',
  'mutator_boomerang_saw',
  'tediore_chuck',
  'reload_tediore_chuck',
  'holster_surge_bolt',
  'table_tech_rocket',
  'table_tech_toxic_shrapnel',
  'table_tech_prism_split',
  'relic_perpetual_core_rocket',
  'vanguard_bastion_prism',
]);

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

export function stepP4AEnemyBlessingTimers(e: SimEnemyState, dtSec: number): void {
  if ((e.causticVulnTimer ?? 0) > 0) {
    const next = (e.causticVulnTimer ?? 0) - dtSec;
    e.causticVulnTimer = next <= 1e-6 ? 0 : next;
  }
}

function evictPropForRoomTacticalCap(sim: WorldSim): void {
  for (let i = sim.props.length - 1; i >= 0; i--) {
    const pr = sim.props[i]!;
    if (pr.hp <= 0 && pr.destructible) {
      sim.props.splice(i, 1);
    }
  }
  while (sim.props.length >= MAX_TACTICAL_PROPS_PER_ROOM) {
    let evictIdx = sim.props.findIndex(
      (pr) => pr.kind === 'caustic_spore_pod' || pr.kind === 'glacial_spike',
    );
    if (evictIdx < 0) {
      evictIdx = sim.props.findIndex(
        (pr) =>
          pr.destructible &&
          pr.kind !== 'ancient_mechanism' &&
          pr.kind !== 'daedalus_anvil' &&
          pr.kind !== 'upgrade_anvil',
      );
    }
    if (evictIdx < 0) break;
    sim.props.splice(evictIdx, 1);
  }
}

export function trySpawnCausticSporePod(
  sim: WorldSim,
  p: SimPlayerState,
  isFinaleShot = false,
): SimPropState | null {
  if (p.lifeState !== 'alive' || !hasPlayerBlessing(p, 'reload_caustic_pod')) return null;
  if (isFinaleShot) {
    if ((p.causticPodFinaleIcdTimer ?? 0) > 0) return null;
    p.causticPodFinaleIcdTimer = CAUSTIC_POD_FINALE_ICD_SEC;
  }

  evictPropForRoomTacticalCap(sim);

  const cosA = Math.cos(p.aimAngle);
  const sinA = Math.sin(p.aimAngle);
  const rawX = p.x + cosA * 20;
  const rawY = p.y + sinA * 20;
  const spawnPt = findNearestWalkablePoint(sim.map, rawX, rawY, CAUSTIC_POD_RADIUS);

  const pod: SimPropState = {
    id: ++sim.nextEntityId,
    kind: 'caustic_spore_pod',
    x: spawnPt.x,
    y: spawnPt.y,
    radius: CAUSTIC_POD_RADIUS,
    hp: 1,
    maxHp: 1,
    destructible: true,
    explosive: true,
    blocksMovement: false,
    lightRadius: 72,
    lightColorHex: '#84CC16',
    hitFlashTimer: 0,
    fuseTimer: 0,
    state: 'intact',
    vx: cosA * CAUSTIC_POD_ROLL_SPEED,
    vy: sinA * CAUSTIC_POD_ROLL_SPEED,
    causticRollRemainingPx: CAUSTIC_POD_ROLL_DIST,
    ownerPlayerId: p.id,
    slideOwnerPlayerId: p.id,
    ttlSec: CAUSTIC_POD_TTL_SEC,
  };
  sim.props.push(pod);

  // Prevent same-tick muzzle projectiles from immediately popping the newly launched pod
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (
      b.team === 'player' &&
      b.ownerId === p.id &&
      distance(b.x, b.y, pod.x, pod.y) <= b.radius + pod.radius + 20 &&
      !b.hitEntityIds.includes(pod.id)
    ) {
      b.hitEntityIds.push(pod.id);
    }
  }
  return pod;
}

export function stepCausticSporePodRoll(sim: WorldSim, dtSec: number): void {
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.kind !== 'caustic_spore_pod' || prop.hp <= 0) continue;
    if (prop.coverState === 'sliding') {
      prop.causticRollRemainingPx = 0;
      continue;
    }
    const rem = prop.causticRollRemainingPx ?? 0;
    if (rem <= 0) continue;

    const vx = prop.vx ?? 0;
    const vy = prop.vy ?? 0;
    const speed = Math.hypot(vx, vy);
    if (speed <= 1e-4) {
      prop.vx = 0;
      prop.vy = 0;
      prop.causticRollRemainingPx = 0;
      continue;
    }

    const stepDist = Math.min(rem, speed * dtSec);
    const nextX = prop.x + (vx / speed) * stepDist;
    const nextY = prop.y + (vy / speed) * stepDist;

    if (sim.map.getSurfaceAtWorld(nextX, nextY) === 'chasm') {
      prop.vx = 0;
      prop.vy = 0;
      prop.causticRollRemainingPx = 0;
      continue;
    }

    const col = sim.map.resolveCircleCollision(nextX, nextY, prop.radius, false);
    prop.x = col.x;
    prop.y = col.y;
    const nextRem = rem - stepDist;
    if (col.collided || nextRem <= 1e-4) {
      prop.vx = 0;
      prop.vy = 0;
      prop.causticRollRemainingPx = 0;
    } else {
      prop.causticRollRemainingPx = nextRem;
    }
  }
}

function layCausticAcidSwampInRadius(
  sim: WorldSim,
  originX: number,
  originY: number,
  radiusPx: number,
): void {
  const minTx = Math.max(0, Math.floor((originX - radiusPx) / TILE_SIZE));
  const maxTx = Math.min(sim.map.cols - 1, Math.floor((originX + radiusPx) / TILE_SIZE));
  const minTy = Math.max(0, Math.floor((originY - radiusPx) / TILE_SIZE));
  const maxTy = Math.min(sim.map.rows - 1, Math.floor((originY + radiusPx) / TILE_SIZE));
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (sim.map.isSolidTile(tx, ty) || sim.map.getSurface(tx, ty) === 'chasm') continue;
      const cx = (tx + 0.5) * TILE_SIZE;
      const cy = (ty + 0.5) * TILE_SIZE;
      if (distance(originX, originY, cx, cy) <= radiusPx + TILE_SIZE * 0.35) {
        sim.map.setSurface(tx, ty, 'poison_swamp', CAUSTIC_POD_SWAMP_SEC, false);
      }
    }
  }
}

export function detonateCausticSporePod(
  sim: WorldSim,
  pod: SimPropState,
  attackerPlayerId?: number,
): boolean {
  if (pod.kind !== 'caustic_spore_pod') return false;
  if (pod.hp <= 0 && !pod.explosive) return false;

  pod.hp = 0;
  pod.explosive = false;
  pod.destructible = false;
  pod.blocksMovement = false;
  pod.state = 'broken';
  pod.coverState = undefined;
  pod.vx = 0;
  pod.vy = 0;
  pod.causticRollRemainingPx = 0;

  const ownerId =
    attackerPlayerId ??
    pod.kickedByPlayerId ??
    pod.slideOwnerPlayerId ??
    pod.ownerPlayerId ??
    pod.lastDamagedByPlayerId ??
    sim.player.id;

  tryTriggerToxicShrapnelOnPropBreak(sim, pod, ownerId);

  const blastDmg = scaleBlessingDamage(CAUSTIC_POD_BASE_DMG, sim.currentFloor);
  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'prop_destroyed',
      propId: pod.id,
      propKind: pod.kind,
      x: pod.x,
      y: pod.y,
    });
    sim.events.push({
      kind: 'explosion',
      x: pod.x,
      y: pod.y,
      radius: CAUSTIC_POD_BLAST_RADIUS,
      damage: blastDmg,
      sourceDefId: 'caustic_spore_pod',
    });
  }

  layCausticAcidSwampInRadius(sim, pod.x, pod.y, CAUSTIC_POD_BLAST_RADIUS);

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (
      e.hp <= 0 ||
      e.aiState === 'spawning' ||
      e.bossBurrowed ||
      e.defId === 'ashen_executioner'
    ) {
      continue;
    }
    const d = distance(pod.x, pod.y, e.x, e.y);
    if (d <= CAUSTIC_POD_BLAST_RADIUS + e.radius) {
      const hitAng = d > 1e-4 ? Math.atan2(e.y - pod.y, e.x - pod.x) : 0;
      sim.applyDamageToEnemy(e, blastDmg, false, 'poison', hitAng, 110, false, ownerId);
      if (e.hp > 0) {
        e.causticVulnTimer = Math.max(e.causticVulnTimer ?? 0, CAUSTIC_POD_VULN_SEC);
        if (e.poisonTimer <= 0) {
          e.poisonTimer = 4.0;
          e.poisonStacks = Math.max(1, e.poisonStacks);
          e.poisonTickTimer = 0.6;
        }
      }
    }
  }
  return true;
}

export function tryTriggerHolsterSurgeOnWeaponSwap(
  sim: WorldSim,
  p: SimPlayerState,
  prevSlot: number,
  nextSlot: number,
): boolean {
  if (
    prevSlot === nextSlot ||
    p.lifeState !== 'alive' ||
    !hasPlayerBlessing(p, 'reload_holster_surge') ||
    (p.holsterSurgeIcdTimer ?? 0) > 0
  ) {
    return false;
  }
  const prevWepId = p.weaponSlots[prevSlot];
  const nextWepId = p.weaponSlots[nextSlot];
  if (!prevWepId || !nextWepId) return false;

  p.holsterSurgeIcdTimer = HOLSTER_SURGE_ICD_SEC;

  const prevWeaponDef = WEAPONS[prevWepId];
  p.weaponSlotClipAmmo[prevSlot] = prevWeaponDef?.clipSize ?? 0;
  p.weaponSlotHeat[prevSlot] = 0;
  p.holsterReloadTimers[prevSlot] = 0;

  const boltDmg = scaleBlessingDamage(HOLSTER_SURGE_BASE_DMG, sim.currentFloor);
  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: p.id,
    team: 'player',
    weaponId: 'holster_surge_bolt',
    x: p.x,
    y: p.y,
    angle: p.aimAngle,
    muzzleOffset: 10,
    pelletCount: 1,
    spreadRad: 0,
    speed: HOLSTER_SURGE_BOLT_SPEED,
    damage: boltDmg,
    radius: HOLSTER_SURGE_BOLT_RADIUS,
    knockback: 110,
    pierceCount: HOLSTER_SURGE_BOLT_PIERCE,
    bounceCount: 0,
    ttlSec: HOLSTER_SURGE_BOLT_TTL_SEC,
    element: 'shock',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    guaranteedElementalProc: true,
  });
  return true;
}

export function tryPlantWallTetherPylonOnWallHit(
  sim: WorldSim,
  b: SimProjectileState,
  hitX: number,
  hitY: number,
  normalX: number,
  normalY: number,
): SimSummonState | null {
  if (b.team !== 'player') return null;
  if (((b.shotFlags ?? 0) & (SHOT_FLAG.FINALE_SHOT | SHOT_FLAG.OVERCLOCKED_SHOT)) === 0) {
    return null;
  }
  const owner = b.ownerId === sim.player.id ? sim.player : sim.getPlayerById(b.ownerId);
  if (!owner || owner.lifeState !== 'alive' || !hasPlayerBlessing(owner, 'bullet_wall_tether')) {
    return null;
  }

  let activePylons = sim.summons.filter(
    (s) =>
      s.ownerPlayerId === owner.id &&
      s.kind === 'wall_tether_pylon' &&
      s.hp > 0 &&
      s.ttlSec > 0,
  );
  while (activePylons.length >= WALL_TETHER_MAX_PYLONS_PER_PLAYER) {
    const oldest = activePylons[0]!;
    const idx = sim.summons.indexOf(oldest);
    if (idx >= 0) sim.summons.splice(idx, 1);
    activePylons = sim.summons.filter(
      (s) =>
        s.ownerPlayerId === owner.id &&
        s.kind === 'wall_tether_pylon' &&
        s.hp > 0 &&
        s.ttlSec > 0,
    );
  }

  enforcePlayerDeployableCap(sim, owner.id, 1);

  const nudgedX = hitX + normalX * 6;
  const nudgedY = hitY + normalY * 6;
  const col = sim.map.resolveCircleCollision(nudgedX, nudgedY, WALL_TETHER_RADIUS, false);

  const pylon: SimSummonState = {
    id: ++sim.nextEntityId,
    ownerPlayerId: owner.id,
    kind: 'wall_tether_pylon',
    nameVi: 'Cọc Điện Cao Thế',
    x: col.x,
    y: col.y,
    radius: WALL_TETHER_RADIUS,
    hp: 999,
    maxHp: 999,
    ttlSec: WALL_TETHER_TTL_SEC,
    maxTtlSec: WALL_TETHER_TTL_SEC,
    auraRadius: WALL_TETHER_AURA_RADIUS,
    tickTimer: WALL_TETHER_TICK_SEC,
    healsRemaining: 0,
    charge: 0,
    poisonRoots: false,
    selfDestruct: false,
    rootedEnemyIds: [],
  };
  sim.summons.push(pylon);

  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'summon_spawned',
      summonId: pylon.id,
      summonKind: 'wall_tether_pylon',
      x: pylon.x,
      y: pylon.y,
      ownerPlayerId: owner.id,
    });
  }
  return pylon;
}

export function updateP4ASummonsAndTethers(sim: WorldSim, dtSec: number): void {
  if (sim.summons.length < 2) return;

  const pylonsByOwner = new Map<number, SimSummonState[]>();
  for (let i = 0; i < sim.summons.length; i++) {
    const s = sim.summons[i]!;
    if (s.kind !== 'wall_tether_pylon' || s.hp <= 0 || s.ttlSec <= 0) continue;
    let list = pylonsByOwner.get(s.ownerPlayerId);
    if (!list) {
      list = [];
      pylonsByOwner.set(s.ownerPlayerId, list);
    }
    list.push(s);
  }

  for (const [ownerId, pylons] of pylonsByOwner) {
    if (pylons.length < 2) continue;
    const p1 = pylons[0]!;
    const p2 = pylons[1]!;

    const prevTimer = p1.fenceTickTimer ?? WALL_TETHER_TICK_SEC;
    const nextTimer = prevTimer - dtSec;
    if (nextTimer > 1e-6) {
      p1.fenceTickTimer = nextTimer;
      continue;
    }
    p1.fenceTickTimer = nextTimer + WALL_TETHER_TICK_SEC;
    if (p1.fenceTickTimer <= 0) p1.fenceTickTimer = WALL_TETHER_TICK_SEC;

    const tickDmg = Math.max(
      1,
      Math.round(scaleBlessingDamage(WALL_TETHER_BASE_DPS, sim.currentFloor) * WALL_TETHER_TICK_SEC),
    );
    const wireAng = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (
        e.hp <= 0 ||
        e.aiState === 'spawning' ||
        e.bossBurrowed ||
        e.defId === 'ashen_executioner'
      ) {
        continue;
      }
      if (
        pointToSegmentDist(e.x, e.y, p1.x, p1.y, p2.x, p2.y) <=
        e.radius + WALL_TETHER_WIRE_HALF_WIDTH
      ) {
        sim.applyDamageToEnemy(
          e,
          tickDmg,
          false,
          'shock',
          wireAng,
          0,
          false,
          ownerId,
          false,
          0.25,
        );
        if (e.hp > 0 && e.shockTimer <= 0) {
          e.shockTimer = 0.6;
        }
      }
    }
  }
}

export function isEligibleOrbitReturnWeapon(weaponId: string): boolean {
  if (!weaponId || ORBIT_RETURN_EXCLUDED_WEAPON_IDS.has(weaponId)) return false;
  const def = WEAPONS[weaponId];
  if (def && def.category === 'melee') return false;
  return true;
}

export function tryRedirectProjectileOrbitReturnOnExpiry(
  sim: WorldSim,
  b: SimProjectileState,
): boolean {
  if (b.team !== 'player' || b.orbitReturned || !isEligibleOrbitReturnWeapon(b.weaponId)) {
    return false;
  }
  const owner = b.ownerId === sim.player.id ? sim.player : sim.getPlayerById(b.ownerId);
  if (
    !owner ||
    owner.lifeState !== 'alive' ||
    owner.hp <= 0 ||
    !hasPlayerBlessing(owner, 'bullet_orbit_return')
  ) {
    return false;
  }

  const dx = owner.x - b.x;
  const dy = owner.y - b.y;
  const distToOwner = Math.hypot(dx, dy);
  const returnAngle = distToOwner > 1e-4 ? Math.atan2(dy, dx) : b.angle + Math.PI;
  const speed = Math.max(320, Math.hypot(b.vx, b.vy));
  const returnTtl = clamp((distToOwner + 96) / speed, 0.25, 1.15);
  const returnDmg = Math.max(1, Math.round(b.damage * ORBIT_RETURN_DMG_RATIO));
  const shotFlags = (b.shotFlags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE;

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: b.ownerId,
    team: 'player',
    weaponId: b.weaponId,
    x: b.x,
    y: b.y,
    angle: returnAngle,
    muzzleOffset: 0,
    pelletCount: 1,
    spreadRad: 0,
    speed,
    damage: returnDmg,
    radius: b.radius,
    knockback: b.knockback,
    pierceCount: Math.max(1, b.pierceRemaining),
    bounceCount: 0,
    ttlSec: returnTtl,
    element: 'poison',
    critChance: b.isCrit ? 1 : 0,
    amplifiedByShield: b.amplifiedByShield,
    seed: sim.rng.nextUint32(),
    shotFlags,
    flags: shotFlags,
    replacedProjectileId: b.id,
    orbitReturned: true,
    guaranteedElementalProc: true,
    explosionRadius: b.explosionRadius,
    bypassFrontShield: b.bypassFrontShield,
  });
  return true;
}

export function shouldCatchReturnedOrbitProjectile(
  sim: WorldSim,
  b: SimProjectileState,
  destroyedScratch?: number[],
): boolean {
  if (!b.orbitReturned || b.team !== 'player') return false;
  const ticks = (b.orbitReturnTicks ?? 0) + 1;
  b.orbitReturnTicks = ticks;
  if (ticks < ORBIT_RETURN_MIN_CATCH_TICKS) return false;

  const owner = b.ownerId === sim.player.id ? sim.player : sim.getPlayerById(b.ownerId);
  if (!owner || owner.lifeState !== 'alive') return false;

  if (distance(owner.x, owner.y, b.x, b.y) <= owner.radius + ORBIT_RETURN_CATCH_PAD_PX) {
    b.ttlSec = 0;
    if (destroyedScratch && !sim.stressTestActive) {
      destroyedScratch.push(b.id);
    }
    return true;
  }
  return false;
}

export function tryHoldClientOrbitReturnAtMaxRange(
  sim: WorldSim,
  b: SimProjectileState,
): boolean {
  if (
    b.team !== 'player' ||
    b.orbitReturned ||
    b.clientHeldAtMaxRange ||
    ((b.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE) === 0 ||
    !isEligibleOrbitReturnWeapon(b.weaponId)
  ) {
    return false;
  }
  const owner = b.ownerId === sim.player.id ? sim.player : sim.getPlayerById(b.ownerId);
  if (!owner || !hasPlayerBlessing(owner, 'bullet_orbit_return')) return false;

  b.clientHeldAtMaxRange = true;
  b.vx = 0;
  b.vy = 0;
  b.awaitingServerRedirectTimer = ORBIT_RETURN_CLIENT_HOLD_SEC;
  b.ttlSec = ORBIT_RETURN_CLIENT_HOLD_SEC;
  return true;
}
