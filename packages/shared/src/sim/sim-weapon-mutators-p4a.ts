import { scaleBlessingDamage } from '../data/blessings.js';
import type { ElementType } from '../data/types.js';
import { WEAPONS } from '../data/weapons.js';
import { circleVsCircle, distance } from '../math/vec2.js';
import { findNearestWalkablePoint } from './arena-room-archetypes.js';
import { enforcePlayerDeployableCap } from './sim-blessings-p4a.js';
import { MAX_PELLETS_PER_TRIGGER, computeUpgradeMultiplier } from './sim-damage-pipeline.js';
import { applyChainHarpoonOnHit, applyGravitySingularityOnHit, hasActiveWeaponMutator } from './sim-weapon-mutators.js';
import { ELEMENTALIST_ROTATION_ORDER, type SimEnemyState, type SimPlayerState, type SimProjectileState, type SimPropState, type SimSummonState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const HOLO_DECOY_TTL_SEC = 3.5;
export const HOLO_DECOY_RADIUS = 14;
export const HOLO_DECOY_AURA_RADIUS = 340;
export const HOLO_DECOY_INITIAL_TICK_SEC = 0.35;
export const HOLO_DECOY_FIRE_INTERVAL_SEC = 0.45;
export const HOLO_DECOY_DMG_RATIO = 0.4;
export const HOLO_DECOY_SHOT_SPEED = 560;
export const HOLO_DECOY_SHOT_TTL_SEC = 0.65;

export const CLUSTER_MORTAR_SUB_COUNT = 3;
export const CLUSTER_MORTAR_OFFSET_PX = 34;
export const CLUSTER_MORTAR_BLAST_RADIUS = 44;
export const CLUSTER_MORTAR_DMG_RATIO = 0.4;
export const CLUSTER_MORTAR_MAX_HITS_PER_TARGET = 2;

export const BOOMERANG_CORE_BASE_DMG = 32;
export const BOOMERANG_CORE_OUTBOUND_SPEED = 500;
export const BOOMERANG_CORE_RETURN_SPEED = 540;
export const BOOMERANG_CORE_MAX_OUTBOUND_DIST = 200;
export const BOOMERANG_CORE_RADIUS = 16;
export const BOOMERANG_CORE_PIERCE = 12;
export const BOOMERANG_CORE_TTL_SEC = 1.4;

const CLUSTER_MORTAR_COVER_PROP_KINDS = new Set<string>([
  'moss_table', 'glacial_barricade', 'forge_blast_shield', 'wooden_crate', 'clay_vase', 'slag_crucible',
]);

const clusterMortarVolleyBudgets = new WeakMap<WorldSim, Map<number, number>>();

function getClusterMortarVolleyBudgetMap(sim: WorldSim): Map<number, number> {
  let map = clusterMortarVolleyBudgets.get(sim);
  if (!map) {
    map = new Map<number, number>();
    clusterMortarVolleyBudgets.set(sim, map);
  } else if (map.size > 64) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) map.delete(oldestKey);
  }
  return map;
}

function resolvePlayerActiveWeaponElement(p: SimPlayerState, wepId: string): ElementType {
  if (p.activeImbueElement !== 'none') return p.activeImbueElement;
  if (wepId === 'apprentice_staff') {
    const count = p.apprenticeStaffShotCount ?? p.staffShotCounter ?? 0;
    return count > 0
      ? (ELEMENTALIST_ROTATION_ORDER[(count - 1) % ELEMENTALIST_ROTATION_ORDER.length] ?? 'burn')
      : 'burn';
  }
  return WEAPONS[wepId]?.element ?? 'none';
}

export function trySpawnHoloDecoyOnReloadOrVent(
  sim: WorldSim,
  p: SimPlayerState,
): SimSummonState | null {
  if (p.lifeState !== 'alive' || !hasActiveWeaponMutator(p, 'mutator_holo_decoy_gun')) return null;
  for (let i = sim.summons.length - 1; i >= 0; i--) {
    const existing = sim.summons[i]!;
    if (existing.kind === 'holo_decoy_turret' && existing.ownerPlayerId === p.id) {
      sim.summons.splice(i, 1);
    }
  }
  enforcePlayerDeployableCap(sim, p.id, 1);

  const decoy: SimSummonState = {
    id: ++sim.nextEntityId, kind: 'holo_decoy_turret', ownerPlayerId: p.id, nameVi: 'Bóng Pháo Ảnh',
    x: p.x, y: p.y, radius: HOLO_DECOY_RADIUS, hp: 999, maxHp: 999,
    ttlSec: HOLO_DECOY_TTL_SEC, maxTtlSec: HOLO_DECOY_TTL_SEC, tickTimer: HOLO_DECOY_INITIAL_TICK_SEC,
    auraRadius: HOLO_DECOY_AURA_RADIUS, healsRemaining: 0, poisonRoots: false, selfDestruct: false,
    charge: p.activeWeaponSlot ?? 0, rootedEnemyIds: [],
  };
  sim.summons.push(decoy);
  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'summon_spawned', summonId: decoy.id, summonKind: 'holo_decoy_turret', ownerPlayerId: p.id, x: decoy.x, y: decoy.y,
    });
  }
  return decoy;
}

export function updateHoloDecoyTurretSummon(sim: WorldSim, s: SimSummonState, dtSec: number): void {
  const owner =
    s.ownerPlayerId === sim.player.id ? sim.player : sim.getPlayerById(s.ownerPlayerId);
  if (!owner) {
    s.ttlSec = 0;
    s.hp = 0;
    return;
  }

  s.tickTimer -= dtSec;
  if (s.tickTimer > 1e-6) return;
  s.tickTimer += HOLO_DECOY_FIRE_INTERVAL_SEC;
  if (s.tickTimer <= 0) s.tickTimer = HOLO_DECOY_FIRE_INTERVAL_SEC;

  let aimAngle = owner.aimAngle;
  if (owner.lifeState === 'alive') {
    if (
      typeof owner.aimWorldX === 'number' &&
      typeof owner.aimWorldY === 'number' &&
      Number.isFinite(owner.aimWorldX) &&
      Number.isFinite(owner.aimWorldY) &&
      distance(s.x, s.y, owner.aimWorldX, owner.aimWorldY) > 12
    ) {
      aimAngle = Math.atan2(owner.aimWorldY - s.y, owner.aimWorldX - s.x);
    }
  } else {
    let bestDist = Infinity;
    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed || e.defId === 'ashen_executioner') continue;
      const d = distance(s.x, s.y, e.x, e.y);
      if (d <= s.auraRadius && d < bestDist) {
        bestDist = d;
        aimAngle = Math.atan2(e.y - s.y, e.x - s.x);
      }
    }
  }

  const activeSlot = owner.activeWeaponSlot ?? 0;
  const wepId =
    owner.weaponSlots[activeSlot] ?? owner.weaponSlots[s.charge] ?? owner.weaponSlots[0] ?? 'rivet_gun';
  const wep = WEAPONS[wepId];
  const upgradeLv = owner.weaponUpgradeLevels?.[activeSlot] ?? 0;
  const auxDmg = Math.max(
    1,
    Math.round((wep?.damage ?? 10) * computeUpgradeMultiplier(upgradeLv) * HOLO_DECOY_DMG_RATIO),
  );
  const element = resolvePlayerActiveWeaponElement(owner, wepId);

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned', tick: sim.tick, ownerId: owner.id, team: 'player', weaponId: 'holo_decoy_shot',
    x: s.x, y: s.y, angle: aimAngle, pelletCount: 1, spreadRad: 0, speed: HOLO_DECOY_SHOT_SPEED,
    damage: auxDmg, radius: 5, knockback: 45, pierceCount: 0, bounceCount: 0, ttlSec: HOLO_DECOY_SHOT_TTL_SEC,
    element, critChance: 0, amplifiedByShield: false, seed: sim.rng.nextUint32(),
  });
}

export function shouldClusterMortarSkipCoverProp(b: SimProjectileState, prop: SimPropState): boolean {
  if (!b.clusterMortarLob || b.team !== 'player' || (b.splitGeneration ?? 0) >= 1) return false;
  return (
    CLUSTER_MORTAR_COVER_PROP_KINDS.has(prop.kind) ||
    Boolean(prop.blocksEnemyProjectiles) ||
    prop.coverState === 'low' ||
    prop.coverState === 'flipped'
  );
}

export function detonateClusterMortarOnImpact(
  sim: WorldSim,
  b: SimProjectileState,
  impactX: number,
  impactY: number,
): void {
  if (!b.clusterMortarLob || b.team !== 'player' || (b.splitGeneration ?? 0) >= 1) return;
  b.clusterMortarLob = false;
  b.pierceRemaining = 0;
  b.ttlSec = 0;

  const volleyEventId = b.id >>> 6;
  const volleyBudgets = getClusterMortarVolleyBudgetMap(sim);
  const used = volleyBudgets.get(volleyEventId) ?? 0;
  const allowed = Math.min(CLUSTER_MORTAR_SUB_COUNT, Math.max(0, MAX_PELLETS_PER_TRIGGER - used));
  if (allowed <= 0) return;
  volleyBudgets.set(volleyEventId, used + allowed);

  const clusterDmg = Math.max(1, Math.round(b.damage * CLUSTER_MORTAR_DMG_RATIO));
  const targetHitCounts = new Map<number, number>();

  for (let c = 0; c < allowed; c++) {
    const offsetAng = b.angle + (c * Math.PI * 2) / CLUSTER_MORTAR_SUB_COUNT;
    const rawX = impactX + Math.cos(offsetAng) * CLUSTER_MORTAR_OFFSET_PX;
    const rawY = impactY + Math.sin(offsetAng) * CLUSTER_MORTAR_OFFSET_PX;
    const wallClamped = sim.map.resolveCircleCollision(rawX, rawY, 8, false);
    const pt =
      sim.map.getSurfaceAtWorld(wallClamped.x, wallClamped.y) === 'chasm'
        ? findNearestWalkablePoint(sim.map, wallClamped.x, wallClamped.y, 8)
        : wallClamped;

    if (b.element !== 'none') sim.applyElementAtWorldPoint(pt.x, pt.y, b.element, 24);

    for (let i = 0; i < sim.enemies.length; i++) {
      const enemy = sim.enemies[i]!;
      if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed || enemy.defId === 'ashen_executioner') {
        continue;
      }
      const d = distance(pt.x, pt.y, enemy.x, enemy.y);
      if (d <= CLUSTER_MORTAR_BLAST_RADIUS + enemy.radius) {
        const hits = targetHitCounts.get(enemy.id) ?? 0;
        if (hits >= CLUSTER_MORTAR_MAX_HITS_PER_TARGET) continue;
        targetHitCounts.set(enemy.id, hits + 1);
        const hitAng = d > 1e-4 ? Math.atan2(enemy.y - pt.y, enemy.x - pt.x) : offsetAng;
        sim.applyDamageToEnemy(enemy, clusterDmg, false, b.element, hitAng, 85, false, b.ownerId, true);
      }
    }

    if (!sim.stressTestActive) {
      sim.events.push({
        kind: 'explosion',
        x: pt.x,
        y: pt.y,
        radius: CLUSTER_MORTAR_BLAST_RADIUS,
        damage: clusterDmg,
        sourceDefId: 'mutator_cluster_mortar',
      });
      sim.events.push({
        kind: 'projectile_impact',
        x: pt.x,
        y: pt.y,
        angle: offsetAng,
        team: 'player',
        hitWall: false,
        destroyedByMelee: false,
        blockedByShield: false,
        isCrit: false,
        element: b.element,
      });
    }
  }
}

export function tryLaunchBoomerangCoreSawOnReloadOrVent(sim: WorldSim, p: SimPlayerState): void {
  if (p.lifeState !== 'alive' || !hasActiveWeaponMutator(p, 'mutator_boomerang_core')) return;
  const activeSlot = p.activeWeaponSlot ?? 0;
  const wepId = p.weaponSlots[activeSlot] ?? p.weaponSlots[0] ?? 'rivet_gun';
  const element = resolvePlayerActiveWeaponElement(p, wepId);
  const sawDmg = scaleBlessingDamage(BOOMERANG_CORE_BASE_DMG, sim.currentFloor);

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned', tick: sim.tick, ownerId: p.id, team: 'player', weaponId: 'mutator_boomerang_saw',
    x: p.x, y: p.y, originX: p.x, originY: p.y, angle: p.aimAngle, pelletCount: 1, spreadRad: 0,
    speed: BOOMERANG_CORE_OUTBOUND_SPEED, damage: sawDmg, radius: BOOMERANG_CORE_RADIUS, knockback: 120,
    pierceCount: BOOMERANG_CORE_PIERCE, bounceCount: 0, ttlSec: BOOMERANG_CORE_TTL_SEC,
    element, critChance: 0, amplifiedByShield: false, seed: sim.rng.nextUint32(), boomerangPhase: 'outbound',
  });
}

function sliceEnemiesWithBoomerangCoreSaw(sim: WorldSim, b: SimProjectileState): void {
  const candidates = sim.enemySpatialGrid.queryCircle(b.x, b.y, b.radius, sim.queryEnemyScratch);
  for (let i = 0; i < candidates.length; i++) {
    const enemy = candidates[i]!;
    if (
      enemy.hp <= 0 ||
      enemy.defId === 'ashen_executioner' ||
      enemy.aiState === 'spawning' ||
      enemy.bossBurrowed ||
      b.hitEntityIds.includes(enemy.id) ||
      !circleVsCircle(b, enemy)
    ) {
      continue;
    }
    b.hitEntityIds.push(enemy.id);
    const d = distance(b.x, b.y, enemy.x, enemy.y);
    const hitAng = d > 1e-4 ? Math.atan2(enemy.y - b.y, enemy.x - b.x) : b.angle;
    sim.applyDamageToEnemy(enemy, b.damage, b.isCrit, b.element, hitAng, b.knockback, false, b.ownerId);
    if (!sim.stressTestActive) {
      sim.events.push({
        kind: 'projectile_impact',
        x: b.x,
        y: b.y,
        angle: b.angle,
        team: 'player',
        hitWall: false,
        destroyedByMelee: false,
        blockedByShield: false,
        isCrit: b.isCrit,
        element: b.element,
      });
    }
    if (b.pierceRemaining > 0) {
      b.pierceRemaining -= 1;
    } else {
      if (b.boomerangPhase === 'returning') b.ttlSec = 0;
      break;
    }
  }
}

function advanceBoomerangCoreSawMotion(
  sim: WorldSim,
  b: SimProjectileState,
  dtSec: number,
  applyDamage: boolean,
): void {
  b.prevX = b.x;
  b.prevY = b.y;
  const owner = b.ownerId === sim.player.id ? sim.player : sim.getPlayerById(b.ownerId);

  if (b.boomerangPhase !== 'returning') {
    b.x += b.vx * dtSec;
    b.y += b.vy * dtSec;
    const originX = b.originX ?? b.prevX;
    const originY = b.originY ?? b.prevY;
    const wallHit = sim.map.checkProjectileWallHit(b.x, b.y, b.radius);
    const traveled = distance(originX, originY, b.x, b.y);

    if (wallHit.hit) {
      b.x = wallHit.resolvedX;
      b.y = wallHit.resolvedY;
    } else if (traveled > BOOMERANG_CORE_MAX_OUTBOUND_DIST && traveled > 1e-4) {
      const ratio = BOOMERANG_CORE_MAX_OUTBOUND_DIST / traveled;
      b.x = originX + (b.x - originX) * ratio;
      b.y = originY + (b.y - originY) * ratio;
    }

    if (applyDamage) sliceEnemiesWithBoomerangCoreSaw(sim, b);
    if (wallHit.hit || traveled >= BOOMERANG_CORE_MAX_OUTBOUND_DIST) {
      b.boomerangPhase = 'returning';
      b.hitEntityIds.length = 0;
      b.pierceRemaining = Math.max(b.pierceRemaining, BOOMERANG_CORE_PIERCE);
      b.ttlSec = Math.max(b.ttlSec, 1.0);
    }
    return;
  }

  if (!owner || owner.lifeState !== 'alive') {
    b.x += b.vx * dtSec;
    b.y += b.vy * dtSec;
    if (applyDamage) sliceEnemiesWithBoomerangCoreSaw(sim, b);
    return;
  }

  const dx = owner.x - b.x;
  const dy = owner.y - b.y;
  const distToOwner = Math.hypot(dx, dy);
  const catchDist = owner.radius + 12;
  if (distToOwner <= catchDist) {
    if (applyDamage) sliceEnemiesWithBoomerangCoreSaw(sim, b);
    b.ttlSec = 0;
    return;
  }

  const retAng = Math.atan2(dy, dx);
  const stepDist = Math.min(distToOwner, BOOMERANG_CORE_RETURN_SPEED * dtSec);
  b.angle = retAng;
  b.vx = Math.cos(retAng) * BOOMERANG_CORE_RETURN_SPEED;
  b.vy = Math.sin(retAng) * BOOMERANG_CORE_RETURN_SPEED;
  b.x += Math.cos(retAng) * stepDist;
  b.y += Math.sin(retAng) * stepDist;

  if (applyDamage) sliceEnemiesWithBoomerangCoreSaw(sim, b);
  if (distance(owner.x, owner.y, b.x, b.y) <= catchDist) b.ttlSec = 0;
}

export function stepBoomerangCoreSawProjectile(sim: WorldSim, b: SimProjectileState, dtSec: number): void {
  advanceBoomerangCoreSawMotion(sim, b, dtSec, true);
}

export function stepBoomerangCoreSawCosmetic(sim: WorldSim, b: SimProjectileState, dtSec: number): void {
  advanceBoomerangCoreSawMotion(sim, b, dtSec, false);
}

export function triggerP4AMutatorsOnReloadOrVent(sim: WorldSim, p: SimPlayerState): void {
  trySpawnHoloDecoyOnReloadOrVent(sim, p);
  tryLaunchBoomerangCoreSawOnReloadOrVent(sim, p);
}

export function resolveOffhandWeaponElement(p: SimPlayerState): ElementType {
  const otherSlot = 1 - (p.activeWeaponSlot ?? 0);
  const otherWeaponId = p.weaponSlots?.[otherSlot];
  if (!otherWeaponId) return 'none';
  if (otherWeaponId === 'apprentice_staff') {
    const count = p.apprenticeStaffShotCount ?? p.staffShotCounter ?? 0;
    return count > 0
      ? (ELEMENTALIST_ROTATION_ORDER[(count - 1) % ELEMENTALIST_ROTATION_ORDER.length] ?? 'burn')
      : 'burn';
  }
  return WEAPONS[otherWeaponId]?.element ?? 'none';
}

export function resolveSecondaryInfusedElementForShot(
  p: SimPlayerState,
  isEmpoweredShot: boolean,
): ElementType | undefined {
  if (!isEmpoweredShot || !hasActiveWeaponMutator(p, 'mutator_elemental_infusion')) return undefined;
  const elem = resolveOffhandWeaponElement(p);
  return elem !== 'none' ? elem : undefined;
}

export function applyP4AMutatorsToSpawnedProjectiles(
  p: SimPlayerState,
  isEmpoweredShot: boolean,
  projectiles: SimProjectileState[],
  startIndex: number,
): void {
  const lob = hasActiveWeaponMutator(p, 'mutator_cluster_mortar');
  const infused = resolveSecondaryInfusedElementForShot(p, isEmpoweredShot);
  if (!lob && !infused) return;
  for (let i = startIndex; i < projectiles.length; i++) {
    const proj = projectiles[i]!;
    if (lob && (proj.splitGeneration ?? 0) === 0) proj.clusterMortarLob = true;
    if (infused) proj.secondaryInfusedElement = infused;
  }
}

export function applyElementalInfusionOnEnemyHit(
  sim: WorldSim,
  enemy: SimEnemyState,
  primaryElement: ElementType,
  secondaryElement: ElementType | undefined,
  hitDamage: number,
  attackerPlayerId: number,
  procCoefficient = 1.0,
): void {
  if (!secondaryElement || secondaryElement === 'none' || secondaryElement === primaryElement || enemy.hp <= 0) {
    return;
  }
  const infusedHitDmg = Math.max(1, Math.round(hitDamage * procCoefficient));
  sim.applyElementStatusToEnemy(enemy, secondaryElement, infusedHitDmg, attackerPlayerId);
}

export function applyElementalInfusionOnMeleeFinisher(
  sim: WorldSim,
  p: SimPlayerState,
  primaryElement: ElementType,
  baseMeleeDmg: number,
  finisherHitEnemyIds: Iterable<number>,
): void {
  if (!hasActiveWeaponMutator(p, 'mutator_elemental_infusion')) return;
  const secondaryElem = resolveOffhandWeaponElement(p);
  if (secondaryElem === 'none' || secondaryElem === primaryElement) return;
  for (const hitId of finisherHitEnemyIds) {
    const enemy = sim.enemies.find((e) => e.id === hitId);
    if (enemy && enemy.hp > 0) {
      applyElementalInfusionOnEnemyHit(sim, enemy, primaryElement, secondaryElem, baseMeleeDmg, p.id, 1.0);
    }
  }
}

export function applyWeaponMutatorsOnEnemyHit(
  sim: WorldSim,
  b: SimProjectileState,
  enemy: SimEnemyState,
  hitDamage: number,
  attackerPlayerId: number,
): void {
  if (b.gravitySingularityShot) applyGravitySingularityOnHit(sim, b, enemy);
  if (b.chainHarpoonShot) applyChainHarpoonOnHit(sim, b, enemy);
  if (b.secondaryInfusedElement) {
    applyElementalInfusionOnEnemyHit(
      sim, enemy, b.element, b.secondaryInfusedElement, hitDamage, attackerPlayerId, b.procCoefficient ?? 1.0,
    );
  }
  if (b.clusterMortarLob && (b.splitGeneration ?? 0) === 0) {
    detonateClusterMortarOnImpact(sim, b, b.x, b.y);
  }
}
