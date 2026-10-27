import { distance } from '../math/vec2.js';
import { SHOT_FLAG } from '../protocol/messages.js';
import { computeHazardDamage } from './sim-tactical-physics.js';
import type { SimEnemyState, SimProjectileState, SimPropState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const BIOME2_ICE_INERTIA_MULT = 1.5;
export const BIOME2_WALL_SLAM_CHILL_RADIUS = 64;
export const GLACIAL_BARRICADE_SHATTER_RADIUS = 72;
export const GLACIAL_BARRICADE_FREEZE_SEC = 1.5;
export const GLACIAL_SPIKE_TTL_SEC = 4.0;
export const CRYO_PRISM_FAN_SPREAD_RAD = 0.34; // ~19.5 degrees total spread (±9.75 deg)

/**
 * Biome 2 Survival Law ("Quán Tính Băng Vĩnh Cửu"):
 * Every Wall-Slam in Biome 2 pulses a cryo wave (r = 64px) applying 1 stack of Chill to nearby enemies.
 */
export function triggerBiome2WallSlamCryoPulse(
  sim: WorldSim,
  slammedEnemy: SimEnemyState,
  attackerId: number,
): void {
  if (sim.map.biome !== 2 && sim.currentBiome !== 2) return;

  for (let i = 0; i < sim.enemies.length; i++) {
    const other = sim.enemies[i]!;
    if (other.hp <= 0 || other.isDummy || other.aiState === 'spawning') continue;
    if (
      distance(slammedEnemy.x, slammedEnemy.y, other.x, other.y) <=
      BIOME2_WALL_SLAM_CHILL_RADIUS + other.radius
    ) {
      sim.applyElementStatusToEnemy(other, 'chill', 8, attackerId);
      if (other.hp > 0 && other.chillStacks < 1 && other.frozenTimer <= 0) {
        other.chillStacks = 1;
        other.chillTimer = Math.max(other.chillTimer, 3.0);
      }
    }
  }
}

/**
 * Biome 2 Prop 1 — glacial_barricade:
 * When Dash-Kicked into an enemy or wall, shatters into 3 glacial_spike pillars (ttlSec = 4.0s,
 * blocksMovement = true, blocksEnemyProjectiles = true), dealing Dmg_Hazard and freezing enemies (1.5s) in r = 72px.
 */
export function shatterGlacialBarricade(
  sim: WorldSim,
  barricade: SimPropState,
  slideAngle: number,
  ownerId = sim.player.id,
): void {
  if (barricade.hp <= 0) return;
  barricade.hp = 0;
  barricade.destructible = false;
  barricade.blocksMovement = false;
  barricade.blocksEnemyProjectiles = false;

  sim.events.push({
    kind: 'prop_destroyed',
    propId: barricade.id,
    propKind: barricade.kind,
    x: barricade.x,
    y: barricade.y,
  });
  sim.events.push({
    kind: 'explosion',
    x: barricade.x,
    y: barricade.y,
    radius: GLACIAL_BARRICADE_SHATTER_RADIUS,
    damage: 28,
    sourceDefId: 'glacial_barricade',
  });

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning') continue;
    if (distance(barricade.x, barricade.y, e.x, e.y) <= GLACIAL_BARRICADE_SHATTER_RADIUS + e.radius) {
      const dmg = computeHazardDamage(e, sim.currentFloor, 28);
      e.hp = Math.max(0, e.hp - dmg);
      e.hitFlashTimer = 0.14;
      e.lastHitDmg = dmg;
      e.frozenTimer = Math.max(e.frozenTimer, GLACIAL_BARRICADE_FREEZE_SEC);
      e.chillTimer = 0;
      e.chillStacks = 0;
      e.vx = 0;
      e.vy = 0;
      e.kbVx = 0;
      e.kbVy = 0;
      sim.events.push({
        kind: 'damage_dealt',
        targetId: e.id,
        targetKind: 'enemy',
        x: e.x,
        y: e.y,
        amount: dmg,
        isCrit: false,
        hitArmor: false,
        element: 'chill',
        knockbackX: 0,
        knockbackY: 0,
      });
      sim.events.push({
        kind: 'status_applied',
        targetId: e.id,
        status: 'freeze',
        x: e.x,
        y: e.y,
      });
      sim.checkBossPhaseTransitions(e);
      if (e.hp <= 0) sim.handleEnemyKilled(e, ownerId);
    }
  }

  // Spawn 3 glacial_spike pillars in a perpendicular line across the shatter point
  const backX = -Math.cos(slideAngle) * 20;
  const backY = -Math.sin(slideAngle) * 20;
  const perpX = -Math.sin(slideAngle);
  const perpY = Math.cos(slideAngle);
  const offsets = [-28, 0, 28] as const;
  for (const offset of offsets) {
    const sx = barricade.x + backX + perpX * offset;
    const sy = barricade.y + backY + perpY * offset;
    const spike = sim.spawnProp('glacial_spike', sx, sy);
    spike.ttlSec = GLACIAL_SPIKE_TTL_SEC;
    spike.blocksMovement = true;
    spike.blocksEnemyProjectiles = true;
  }
}

function findDensestEnemyClusterAngle(sim: WorldSim, fromX: number, fromY: number, fallbackAngle: number): number {
  let bestEnemy: SimEnemyState | null = null;
  let bestClusterSize = -1;
  let bestDist = Infinity;

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning') continue;
    let count = 0;
    for (let j = 0; j < sim.enemies.length; j++) {
      const other = sim.enemies[j]!;
      if (other.hp <= 0 || other.isDummy || other.aiState === 'spawning') continue;
      if (distance(e.x, e.y, other.x, other.y) <= 140) {
        count += 1;
      }
    }
    const d = distance(fromX, fromY, e.x, e.y);
    if (count > bestClusterSize || (count === bestClusterSize && d < bestDist)) {
      bestClusterSize = count;
      bestDist = d;
      bestEnemy = e;
    }
  }

  if (!bestEnemy) return fallbackAngle;
  return Math.atan2(bestEnemy.y - fromY, bestEnemy.x - fromX);
}

/**
 * Biome 2 Prop 3 — cryo_prism_pillar:
 * - If splitGeneration === 0: refracts into 3 Chill fan rays (+20% Additive DMG, splitGeneration = 1,
 *   SHOT_FLAG.DYNAMIC_BOUNCE) aimed toward the densest enemy cluster.
 * - If splitGeneration >= 1: does NOT spawn children; instead redirects toward the cluster, boosts
 *   damage by +20%, imbues 'chill', and adds +1 bounceRemaining (clamped to <= 4).
 */
export function refractProjectileThroughCryoPrism(
  sim: WorldSim,
  b: SimProjectileState,
  prism: SimPropState,
): boolean {
  if (b.team !== 'player' || b.hitEntityIds.includes(prism.id)) return false;

  b.hitEntityIds.push(prism.id);
  b.passedThroughCoverOrPrism = true;
  prism.hitFlashTimer = 0.16;

  const clusterAngle = findDensestEnemyClusterAngle(sim, prism.x, prism.y, b.angle);
  const boostedDamage = Math.max(1, Math.round(b.damage * 1.2));
  const speed = Math.max(420, Math.hypot(b.vx, b.vy));

  if ((b.splitGeneration ?? 0) === 0) {
    const prevIds = new Set(sim.projectiles.map((p) => p.id));
    const origTtl = Math.max(b.ttlSec, 1.35);
    b.ttlSec = 0;

    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      eventId: sim.nextVolleyEventId++,
      ownerId: b.ownerId,
      team: 'player',
      weaponId: b.weaponId ?? 'hunter_crossbow',
      x: prism.x + Math.cos(clusterAngle) * (prism.radius + b.radius + 3),
      y: prism.y + Math.sin(clusterAngle) * (prism.radius + b.radius + 3),
      angle: clusterAngle,
      pelletCount: 3,
      spreadRad: CRYO_PRISM_FAN_SPREAD_RAD,
      speed,
      damage: boostedDamage,
      critChance: b.isCrit ? 1 : 0,
      knockback: b.knockback,
      radius: b.radius,
      ttlSec: origTtl,
      pierceCount: b.pierceRemaining,
      bounceCount: Math.min(4, Math.max(1, b.bounceRemaining)),
      element: 'chill',
      seed: ((sim.tick + 1) * 2654435761) >>> 0,
      shotFlags: (b.shotFlags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE,
      replacedProjectileId: b.id,
      procCoefficient: b.procCoefficient,
    });

    const rayAngles = [
      clusterAngle - CRYO_PRISM_FAN_SPREAD_RAD * 0.5,
      clusterAngle,
      clusterAngle + CRYO_PRISM_FAN_SPREAD_RAD * 0.5,
    ];
    let rayIdx = 0;
    for (let i = 0; i < sim.projectiles.length; i++) {
      const child = sim.projectiles[i]!;
      if (!prevIds.has(child.id)) {
        const exactAng = rayAngles[rayIdx] ?? clusterAngle;
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

  // splitGeneration >= 1: anti-infinite-split rule — boost damage +20% and +1 bounce (<= 4) without splitting
  b.damage = boostedDamage;
  b.element = 'chill';
  b.bounceRemaining = Math.min(4, (b.bounceRemaining ?? 0) + 1);
  b.shotFlags = (b.shotFlags ?? 0) | SHOT_FLAG.DYNAMIC_BOUNCE;
  b.angle = clusterAngle;
  b.vx = Math.cos(clusterAngle) * speed;
  b.vy = Math.sin(clusterAngle) * speed;
  b.x = prism.x + Math.cos(clusterAngle) * (prism.radius + b.radius + 3);
  b.y = prism.y + Math.sin(clusterAngle) * (prism.radius + b.radius + 3);
  b.ttlSec = Math.max(b.ttlSec, 1.2);
  return true;
}

export function updateP1CTacticalProps(sim: WorldSim, dtSec: number): void {
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0) continue;

    if (prop.ttlSec !== undefined && prop.ttlSec > 0) {
      prop.ttlSec -= dtSec;
      if (prop.ttlSec <= 0) {
        prop.hp = 0;
        sim.events.push({
          kind: 'prop_destroyed',
          propId: prop.id,
          propKind: prop.kind,
          x: prop.x,
          y: prop.y,
        });
      }
    }
  }
}
