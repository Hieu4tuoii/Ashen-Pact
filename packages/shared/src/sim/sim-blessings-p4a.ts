import { scaleBlessingDamage } from '../data/blessings.js';
import { clamp, distance } from '../math/vec2.js';
import { TILE_SIZE } from '../protocol/messages.js';
import { findNearestWalkablePoint } from './arena-room-archetypes.js';
import {
  hasPlayerBlessing,
  MAX_DEPLOYABLES_PER_PLAYER,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
  type SimPropState,
  type SimSummonState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const TOXIC_SHRAPNEL_BASE_DMG = 20;
export const TOXIC_SHRAPNEL_SPINE_COUNT = 8;
export const TOXIC_SHRAPNEL_SPINE_SPEED = 460;
export const TOXIC_SHRAPNEL_SPINE_TTL_SEC = 0.55;
export const TOXIC_SHRAPNEL_PUDDLE_SEC = 3.5;
export const TOXIC_SHRAPNEL_WALL_SLAM_ICD_SEC = 0.35;

export const MAGNET_SNARE_RANGE = 180;
export const MAGNET_SNARE_MAX_TARGETS = 4;
export const MAGNET_SNARE_STUN_SEC = 0.8;

export const THUNDER_DECOY_MAX_PER_PLAYER = 2;
export const THUNDER_DECOY_TTL_SEC = 1.5;
export const THUNDER_DECOY_RADIUS = 16;
export const THUNDER_DECOY_TAUNT_RADIUS = 220;
export const THUNDER_DECOY_BLAST_RADIUS = 88;
export const THUNDER_DECOY_BASE_DMG = 36;

export const DASH_PHASE_BLADE_WINDOW_SEC = 1.2;
export const DASH_PHASE_BLADE_BASE_DMG = 28;
export const DASH_PHASE_BLADE_SPEED = 560;
export const DASH_PHASE_BLADE_TTL_SEC = 0.34;
export const DASH_PHASE_BLADE_RADIUS = 18;
export const DASH_PHASE_BLADE_PIERCE = 8;
export const DASH_PHASE_BLADE_KB = 160;

const TOXIC_SHRAPNEL_PROP_KINDS = new Set<string>([
  'moss_table', 'glacial_barricade', 'forge_blast_shield', 'volatile_spore_pod',
  'caustic_spore_pod', 'sliding_ice_block', 'explosive_barrel', 'slag_crucible',
  'coal_bomb', 'wooden_crate', 'clay_vase', 'rotten_totem_pillar',
]);

const MAGNET_SNARE_LATERAL_OFFSETS = [-10, 10, -4, 4] as const;

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-8) return distance(px, py, x1, y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

export function enforcePlayerDeployableCap(sim: WorldSim, playerId: number, slotsNeeded = 1): void {
  for (let i = sim.summons.length - 1; i >= 0; i--) {
    const s = sim.summons[i]!;
    if (s.ownerPlayerId === playerId && (s.hp <= 0 || s.ttlSec <= 0)) sim.summons.splice(i, 1);
  }
  for (let i = sim.magneticRivets.length - 1; i >= 0; i--) {
    const r = sim.magneticRivets[i]!;
    if (r.ownerPlayerId === playerId && r.ttlSec <= 0) sim.magneticRivets.splice(i, 1);
  }
  const needed = Math.max(0, Math.floor(slotsNeeded));
  const countOwned = (): number =>
    sim.summons.filter((s) => s.ownerPlayerId === playerId).length +
    sim.magneticRivets.filter((r) => r.ownerPlayerId === playerId).length;

  while (countOwned() + needed > MAX_DEPLOYABLES_PER_PLAYER) {
    const rivetIdx = sim.magneticRivets.findIndex((r) => r.ownerPlayerId === playerId);
    if (rivetIdx >= 0) {
      sim.magneticRivets.splice(rivetIdx, 1);
      continue;
    }
    let summonIdx = sim.summons.findIndex((s) => s.ownerPlayerId === playerId && Number.isFinite(s.ttlSec));
    if (summonIdx < 0) summonIdx = sim.summons.findIndex((s) => s.ownerPlayerId === playerId);
    if (summonIdx >= 0) {
      sim.summons.splice(summonIdx, 1);
      continue;
    }
    break;
  }
}

export function stepP4APlayerBlessingTimers(p: SimPlayerState, dtSec: number): void {
  if ((p.dashPhaseBladeTimer ?? 0) > 0) {
    const next = (p.dashPhaseBladeTimer ?? 0) - dtSec;
    p.dashPhaseBladeTimer = next <= 1e-6 ? 0 : next;
  }
  if ((p.toxicShrapnelIcdTimer ?? 0) > 0) {
    const next = (p.toxicShrapnelIcdTimer ?? 0) - dtSec;
    p.toxicShrapnelIcdTimer = next <= 1e-6 ? 0 : next;
  }
  if ((p.holsterSurgeIcdTimer ?? 0) > 0) {
    const next = (p.holsterSurgeIcdTimer ?? 0) - dtSec;
    p.holsterSurgeIcdTimer = next <= 1e-6 ? 0 : next;
  }
}

function laySafePoisonSwampPuddle(sim: WorldSim, originX: number, originY: number, durationSec = TOXIC_SHRAPNEL_PUDDLE_SEC): void {
  const centerTx = Math.floor(originX / TILE_SIZE);
  const centerTy = Math.floor(originY / TILE_SIZE);
  const offsets: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < offsets.length; i++) {
    const tx = centerTx + offsets[i]![0];
    const ty = centerTy + offsets[i]![1];
    if (tx < 0 || ty < 0 || tx >= sim.map.cols || ty >= sim.map.rows) continue;
    if (sim.map.isSolidTile(tx, ty) || sim.map.getSurface(tx, ty) === 'chasm') continue;
    sim.map.setSurface(tx, ty, 'poison_swamp', durationSec, false);
  }
}

function fireToxicShrapnelBurst(sim: WorldSim, owner: SimPlayerState, originX: number, originY: number): void {
  const spineDmg = scaleBlessingDamage(TOXIC_SHRAPNEL_BASE_DMG, sim.currentFloor);
  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned', tick: sim.tick, ownerId: owner.id, team: 'player',
    weaponId: 'table_tech_toxic_shrapnel', x: originX, y: originY, angle: 0,
    pelletCount: TOXIC_SHRAPNEL_SPINE_COUNT, spreadRad: 0, radialStepRad: Math.PI / 4,
    speed: TOXIC_SHRAPNEL_SPINE_SPEED, damage: spineDmg, radius: 5, knockback: 90,
    pierceCount: 1, bounceCount: 0, ttlSec: TOXIC_SHRAPNEL_SPINE_TTL_SEC,
    element: 'poison', critChance: 0, amplifiedByShield: false, seed: sim.rng.nextUint32(),
  });
  laySafePoisonSwampPuddle(sim, originX, originY, TOXIC_SHRAPNEL_PUDDLE_SEC);
}

function resolveToxicShrapnelPropOwner(sim: WorldSim, prop: SimPropState, attackerPlayerId?: number): SimPlayerState | null {
  const candidateIds = [
    attackerPlayerId, prop.lastDamagedByPlayerId, prop.slideOwnerPlayerId,
    prop.kickedByPlayerId, prop.flippedByPlayerId,
  ];
  for (let i = 0; i < candidateIds.length; i++) {
    const cid = candidateIds[i];
    if (!cid || cid <= 0) continue;
    const pl = sim.getPlayerById(cid);
    if (pl && hasPlayerBlessing(pl, 'table_tech_toxic_shrapnel')) return pl;
  }
  const allPlayers = sim.getAllPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const pl = allPlayers[i]!;
    if (pl.lifeState === 'alive' && hasPlayerBlessing(pl, 'table_tech_toxic_shrapnel')) return pl;
  }
  return null;
}

export function tryTriggerToxicShrapnelOnPropBreak(sim: WorldSim, prop: SimPropState, attackerPlayerId?: number): boolean {
  if (prop.toxicShrapnelTriggered || !TOXIC_SHRAPNEL_PROP_KINDS.has(prop.kind as string)) return false;
  const owner = resolveToxicShrapnelPropOwner(sim, prop, attackerPlayerId);
  if (!owner) return false;
  prop.toxicShrapnelTriggered = true;
  fireToxicShrapnelBurst(sim, owner, prop.x, prop.y);
  return true;
}

export function tryTriggerToxicShrapnelOnWallSlam(sim: WorldSim, owner: SimPlayerState, originX: number, originY: number): boolean {
  if (!hasPlayerBlessing(owner, 'table_tech_toxic_shrapnel') || (owner.toxicShrapnelIcdTimer ?? 0) > 0) return false;
  owner.toxicShrapnelIcdTimer = TOXIC_SHRAPNEL_WALL_SLAM_ICD_SEC;
  fireToxicShrapnelBurst(sim, owner, originX, originY);
  return true;
}

function isMagnetSnareEligibleEnemy(e: SimEnemyState, excludeEnemyId?: number): boolean {
  if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) return false;
  if (excludeEnemyId !== undefined && e.id === excludeEnemyId) return false;
  return (
    e.defId !== 'ashen_executioner' && e.defId !== 'thorn_turret' &&
    e.defId !== 'spore_guardian' && e.defId !== 'ice_prison' && e.defId !== 'forge_energy_core'
  );
}

function isSafeSnareFloorSpot(sim: WorldSim, px: number, py: number, radius: number, avoidProp?: SimPropState): boolean {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= sim.map.cols || ty >= sim.map.rows) return false;
  if (sim.map.isSolidTile(tx, ty)) return false;
  if (sim.map.getSurface(tx, ty) === 'chasm' || sim.map.getSurfaceAtWorld(px, py) === 'chasm') return false;
  const probe = Math.max(2, radius * 0.7);
  if (
    sim.map.getSurfaceAtWorld(px + probe, py) === 'chasm' ||
    sim.map.getSurfaceAtWorld(px - probe, py) === 'chasm' ||
    sim.map.getSurfaceAtWorld(px, py + probe) === 'chasm' ||
    sim.map.getSurfaceAtWorld(px, py - probe) === 'chasm'
  ) {
    return false;
  }
  if (sim.map.checkProjectileWallHit(px, py, Math.max(2, radius - 2)).hit) return false;
  if (avoidProp && avoidProp.hp > 0 && avoidProp.blocksMovement) {
    if (distance(px, py, avoidProp.x, avoidProp.y) < avoidProp.radius + radius + 0.5) return false;
  }
  return true;
}

function resolveSafeMagnetSnareSpot(
  sim: WorldSim,
  rawX: number,
  rawY: number,
  enemy: SimEnemyState,
  avoidProp?: SimPropState,
): { x: number; y: number } {
  const col = sim.map.resolveCircleCollision(rawX, rawY, enemy.radius, false);
  let candX = col.x;
  let candY = col.y;
  if (avoidProp && avoidProp.hp > 0 && avoidProp.blocksMovement) {
    const minSep = avoidProp.radius + enemy.radius + 2;
    const d = distance(candX, candY, avoidProp.x, avoidProp.y);
    if (d < minSep) {
      const ang = d > 1e-4 ? Math.atan2(candY - avoidProp.y, candX - avoidProp.x) : 0;
      const pushed = sim.map.resolveCircleCollision(
        avoidProp.x + Math.cos(ang) * minSep,
        avoidProp.y + Math.sin(ang) * minSep,
        enemy.radius,
        false,
      );
      candX = pushed.x;
      candY = pushed.y;
    }
  }
  if (isSafeSnareFloorSpot(sim, candX, candY, enemy.radius, avoidProp)) return { x: candX, y: candY };

  if (avoidProp) {
    const ringR = avoidProp.radius + enemy.radius + 6;
    let bestSpot: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (let dir = 0; dir < 8; dir++) {
      const ang = (dir * Math.PI) / 4;
      const rCol = sim.map.resolveCircleCollision(
        avoidProp.x + Math.cos(ang) * ringR,
        avoidProp.y + Math.sin(ang) * ringR,
        enemy.radius,
        false,
      );
      if (isSafeSnareFloorSpot(sim, rCol.x, rCol.y, enemy.radius, avoidProp)) {
        const dToRaw = distance(rCol.x, rCol.y, rawX, rawY);
        if (dToRaw < bestDist) {
          bestDist = dToRaw;
          bestSpot = { x: rCol.x, y: rCol.y };
        }
      }
    }
    if (bestSpot) return bestSpot;
  }

  if (isSafeSnareFloorSpot(sim, enemy.x, enemy.y, enemy.radius, avoidProp)) return { x: enemy.x, y: enemy.y };
  return findNearestWalkablePoint(sim.map, enemy.x, enemy.y, enemy.radius);
}

function collectNearestSnareTargets(sim: WorldSim, originX: number, originY: number, excludeEnemyId?: number): SimEnemyState[] {
  const candidates: Array<{ enemy: SimEnemyState; dist: number }> = [];
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (!isMagnetSnareEligibleEnemy(e, excludeEnemyId)) continue;
    const d = distance(originX, originY, e.x, e.y);
    if (d <= MAGNET_SNARE_RANGE) candidates.push({ enemy: e, dist: d });
  }
  candidates.sort((a, b) => a.dist - b.dist || a.enemy.id - b.enemy.id);
  return candidates.slice(0, MAGNET_SNARE_MAX_TARGETS).map((c) => c.enemy);
}

function applyMagnetSnareStunAndShock(sim: WorldSim, owner: SimPlayerState, e: SimEnemyState): void {
  e.kbVx = 0; e.kbVy = 0; e.vx = 0; e.vy = 0;
  e.stunTimer = Math.max(e.stunTimer ?? 0, MAGNET_SNARE_STUN_SEC);
  if (!e.isBoss) {
    e.aiState = 'stunned';
    e.stateTimer = Math.max(e.stateTimer, MAGNET_SNARE_STUN_SEC);
  }
  sim.applyElementStatusToEnemy(e, 'shock', 8, owner.id);
  if (e.hp > 0) e.shockTimer = Math.max(e.shockTimer, 0.5);
}

export function triggerTableTechMagnetSnareOnFlip(sim: WorldSim, prop: SimPropState, owner: SimPlayerState): number {
  if (!hasPlayerBlessing(owner, 'table_tech_magnet_snare')) return 0;
  const targets = collectNearestSnareTargets(sim, prop.x, prop.y);
  if (targets.length === 0) return 0;

  const dirX = Math.cos(owner.aimAngle);
  const dirY = Math.sin(owner.aimAngle);
  const perpX = -dirY;
  const perpY = dirX;

  for (let i = 0; i < targets.length; i++) {
    const e = targets[i]!;
    const lateral = targets.length === 1 ? 0 : (MAGNET_SNARE_LATERAL_OFFSETS[i] ?? 0);
    const frontDist = prop.radius + e.radius + 6;
    const safe = resolveSafeMagnetSnareSpot(
      sim,
      prop.x + dirX * frontDist + perpX * lateral,
      prop.y + dirY * frontDist + perpY * lateral,
      e,
      prop,
    );
    e.x = safe.x;
    e.y = safe.y;
    applyMagnetSnareStunAndShock(sim, owner, e);
  }
  return targets.length;
}

export function triggerTableTechMagnetSnareOnWallSlam(
  sim: WorldSim,
  owner: SimPlayerState,
  centerX: number,
  centerY: number,
  slammedEnemyId?: number,
): number {
  if (!hasPlayerBlessing(owner, 'table_tech_magnet_snare')) return 0;
  const targets = collectNearestSnareTargets(sim, centerX, centerY, slammedEnemyId);
  if (targets.length === 0) return 0;

  const anchor = findNearestWalkablePoint(sim.map, centerX, centerY, 14);
  const perpX = -Math.sin(owner.aimAngle);
  const perpY = Math.cos(owner.aimAngle);

  for (let i = 0; i < targets.length; i++) {
    const e = targets[i]!;
    const lateral = targets.length === 1 ? 0 : (MAGNET_SNARE_LATERAL_OFFSETS[i] ?? 0);
    const safe = resolveSafeMagnetSnareSpot(sim, anchor.x + perpX * lateral, anchor.y + perpY * lateral, e);
    e.x = safe.x;
    e.y = safe.y;
    applyMagnetSnareStunAndShock(sim, owner, e);
  }
  return targets.length;
}

export function spawnDashThunderDecoy(sim: WorldSim, p: SimPlayerState, startX: number, startY: number): SimSummonState | null {
  if (!hasPlayerBlessing(p, 'dash_thunder_decoy')) return null;

  while (
    sim.summons.filter((s) => s.ownerPlayerId === p.id && s.kind === 'thunder_decoy').length >=
    THUNDER_DECOY_MAX_PER_PLAYER
  ) {
    const oldestIdx = sim.summons.findIndex((s) => s.ownerPlayerId === p.id && s.kind === 'thunder_decoy');
    if (oldestIdx < 0) break;
    sim.summons.splice(oldestIdx, 1);
  }

  enforcePlayerDeployableCap(sim, p.id, 1);

  const decoy: SimSummonState = {
    id: ++sim.nextEntityId, ownerPlayerId: p.id, kind: 'thunder_decoy', nameVi: 'Tượng Bóng Sét',
    x: startX, y: startY, radius: THUNDER_DECOY_RADIUS, auraRadius: THUNDER_DECOY_TAUNT_RADIUS,
    hp: 999, maxHp: 999, ttlSec: THUNDER_DECOY_TTL_SEC, maxTtlSec: THUNDER_DECOY_TTL_SEC,
    tickTimer: THUNDER_DECOY_TTL_SEC, healsRemaining: 0, charge: 0,
    poisonRoots: false, selfDestruct: false, rootedEnemyIds: [],
  };
  sim.summons.push(decoy);
  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'summon_spawned', summonId: decoy.id, summonKind: 'thunder_decoy',
      ownerPlayerId: p.id, x: startX, y: startY,
    });
  }
  return decoy;
}

export function triggerP4ADashStartBlessings(sim: WorldSim, p: SimPlayerState, startX: number, startY: number): void {
  spawnDashThunderDecoy(sim, p, startX, startY);
  if (hasPlayerBlessing(p, 'dash_phase_blade')) {
    p.dashPhaseBladeTimer = DASH_PHASE_BLADE_WINDOW_SEC;
  }
}

export function resolveEnemyTargetWithThunderDecoy(
  sim: WorldSim,
  e: SimEnemyState,
  defaultTargetX: number,
  defaultTargetY: number,
): { x: number; y: number } {
  if (e.isBoss || sim.summons.length === 0) return { x: defaultTargetX, y: defaultTargetY };
  let bestDecoy: SimSummonState | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < sim.summons.length; i++) {
    const sum = sim.summons[i]!;
    if (sum.kind !== 'thunder_decoy' || sum.hp <= 0 || sum.ttlSec <= 0) continue;
    const d = distance(e.x, e.y, sum.x, sum.y);
    if (d <= THUNDER_DECOY_TAUNT_RADIUS && d < bestDist) {
      bestDist = d;
      bestDecoy = sum;
    }
  }
  return bestDecoy ? { x: bestDecoy.x, y: bestDecoy.y } : { x: defaultTargetX, y: defaultTargetY };
}

export function detonateThunderDecoy(
  sim: WorldSim,
  decoy: SimSummonState,
  inProjectileLoop = false,
  triggerBullet?: SimProjectileState,
): void {
  if (decoy.hp <= 0) return;
  decoy.hp = 0;
  decoy.ttlSec = 0;

  const dmg = scaleBlessingDamage(THUNDER_DECOY_BASE_DMG, sim.currentFloor);
  const destroyedIds: number[] = [];
  if (triggerBullet && triggerBullet.ttlSec > 0) {
    triggerBullet.ttlSec = 0;
    destroyedIds.push(triggerBullet.id);
  }

  for (let i = sim.projectiles.length - 1; i >= 0; i--) {
    const eb = sim.projectiles[i]!;
    if (eb.team !== 'enemy') continue;
    if (distance(decoy.x, decoy.y, eb.x, eb.y) <= THUNDER_DECOY_BLAST_RADIUS + eb.radius) {
      if (eb.ttlSec > 0) {
        eb.ttlSec = 0;
        destroyedIds.push(eb.id);
      }
      if (!inProjectileLoop) {
        sim.projectiles.splice(i, 1);
        sim.releaseProjectileToPool(eb);
      }
    }
  }

  if (destroyedIds.length > 0 && !sim.stressTestActive) {
    sim.events.push({ kind: 'projectiles_destroyed', ids: destroyedIds });
  }

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) continue;
    const d = distance(decoy.x, decoy.y, e.x, e.y);
    if (d <= THUNDER_DECOY_BLAST_RADIUS + e.radius) {
      const hitAng = d > 1e-4 ? Math.atan2(e.y - decoy.y, e.x - decoy.x) : 0;
      e.lastHitPlayerId = decoy.ownerPlayerId;
      sim.applyDamageToEnemy(e, dmg, false, 'shock', hitAng, 140, false, decoy.ownerPlayerId);
    }
  }

  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'explosion', x: decoy.x, y: decoy.y,
      radius: THUNDER_DECOY_BLAST_RADIUS, damage: dmg, sourceDefId: 'dash_thunder_decoy',
    });
  }
}

export function tryDetonateThunderDecoyOnEnemyBullet(sim: WorldSim, b: SimProjectileState): boolean {
  if (b.team !== 'enemy' || b.ttlSec <= 0 || sim.summons.length === 0) return false;
  for (let sIdx = 0; sIdx < sim.summons.length; sIdx++) {
    const sum = sim.summons[sIdx]!;
    if (sum.kind === 'thunder_decoy' && sum.hp > 0 && sum.ttlSec > 0) {
      if (distance(b.x, b.y, sum.x, sum.y) <= b.radius + sum.radius + 4) {
        sim.summons.splice(sIdx, 1);
        detonateThunderDecoy(sim, sum, true, b);
        return true;
      }
    }
  }
  return false;
}

export function tryConsumeAndSpawnDashPhaseBlade(sim: WorldSim, p: SimPlayerState): boolean {
  if ((p.dashPhaseBladeTimer ?? 0) <= 0 || !hasPlayerBlessing(p, 'dash_phase_blade')) return false;
  p.dashPhaseBladeTimer = 0;
  const dmg = scaleBlessingDamage(DASH_PHASE_BLADE_BASE_DMG, sim.currentFloor);
  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned', tick: sim.tick, ownerId: p.id, team: 'player',
    weaponId: 'dash_phase_blade', x: p.x, y: p.y, angle: p.aimAngle, muzzleOffset: 14,
    pelletCount: 1, spreadRad: 0, speed: DASH_PHASE_BLADE_SPEED, damage: dmg,
    radius: DASH_PHASE_BLADE_RADIUS, knockback: DASH_PHASE_BLADE_KB,
    pierceCount: DASH_PHASE_BLADE_PIERCE, bounceCount: 0, ttlSec: DASH_PHASE_BLADE_TTL_SEC,
    element: 'none', critChance: 0, amplifiedByShield: false, seed: sim.rng.nextUint32(),
  });
  return true;
}

export function clearEnemyBulletsAlongPhaseBlade(sim: WorldSim, b: SimProjectileState, destroyedOut: number[]): number {
  if (b.team !== 'player' || b.weaponId !== 'dash_phase_blade' || b.ttlSec <= 0) return 0;
  let cleared = 0;
  for (let i = 0; i < sim.projectiles.length; i++) {
    const eb = sim.projectiles[i]!;
    if (eb.team !== 'enemy' || eb.ttlSec <= 0) continue;
    if (pointToSegmentDist(eb.x, eb.y, b.prevX, b.prevY, b.x, b.y) <= b.radius + eb.radius + 10) {
      eb.ttlSec = 0;
      destroyedOut.push(eb.id);
      cleared++;
    }
  }
  return cleared;
}
