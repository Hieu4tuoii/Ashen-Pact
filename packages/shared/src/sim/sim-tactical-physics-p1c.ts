import { distance } from '../math/vec2.js';
import { SHOT_FLAG, TILE_SIZE } from '../protocol/messages.js';
import {
  computeHazardDamage,
  computeKickSlideDamage,
  SLIDING_PROP_ENEMY_KB_SPEED,
  SLIDING_PROP_ENEMY_STUN_SEC,
} from './sim-tactical-physics.js';
import type {
  SimEnemyState,
  SimPlayerState,
  SimProjectileState,
  SimPropState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const BIOME2_ICE_INERTIA_MULT = 1.5;
export const BIOME2_WALL_SLAM_CHILL_RADIUS = 64;
export const GLACIAL_BARRICADE_SHATTER_RADIUS = 72;
export const GLACIAL_BARRICADE_FREEZE_SEC = 1.5;
export const GLACIAL_SPIKE_TTL_SEC = 4.0;
export const CRYO_PRISM_FAN_SPREAD_RAD = 0.34;

export const CONVEYOR_CYCLE_PERIOD_SEC = 8.0;
export const CONVEYOR_WARNING_LEAD_SEC = 1.2;
export const BIOME3_HEAT_GAIN_MULT = 1.15;
export const BIOME3_TACTICAL_VENT_RADIUS = 110;
export const FORGE_BLAST_SHIELD_WAVE_HALF_WIDTH = 44; // 88px wide Fire Wave
export const PNEUMATIC_PRESS_SENSOR_RADIUS = 56;
export const PNEUMATIC_PRESS_CRUSH_RADIUS = 68;
export const PNEUMATIC_PRESS_WINDUP_SEC = 0.35;
export const PNEUMATIC_PRESS_COOLDOWN_SEC = 4.0;
export const SLAG_CRUCIBLE_CARPET_LENGTH = 192;

function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 0.000001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

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

  // Compact any already-destroyed props (including this shattered barricade) before spawning 3 spikes
  let writeIdx = 0;
  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    if (p.hp > 0) {
      sim.props[writeIdx++] = p;
    }
  }
  sim.props.length = writeIdx;

  const backX = -Math.cos(slideAngle) * 20;
  const backY = -Math.sin(slideAngle) * 20;
  const perpX = -Math.sin(slideAngle);
  const perpY = Math.cos(slideAngle);
  const offsets = [-28, 0, 28] as const;
  for (const offset of offsets) {
    const sx = barricade.x + backX + perpX * offset;
    const sy = barricade.y + backY + perpY * offset;
    const spike = sim.spawnProp('glacial_spike', sx, sy);
    if (spike.kind === 'glacial_spike') {
      spike.ttlSec = GLACIAL_SPIKE_TTL_SEC;
      spike.blocksMovement = true;
      spike.blocksEnemyProjectiles = true;
    }
  }
}

function findDensestEnemyClusterAngle(
  sim: WorldSim,
  fromX: number,
  fromY: number,
  fallbackAngle: number,
): number {
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
      critChance: 0,
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
        child.isCrit = b.isCrit;
        child.splitGeneration = 1;
        child.passedThroughCoverOrPrism = true;
        child.hitEntityIds.push(prism.id);
      }
    }
    return true;
  }

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

/**
 * Biome 3 Survival Law ("Nhịp Đập Lò Nung"):
 * In Biome 3, Tactical Vent [R] clears enemy projectiles and pulses in a 1.5x wider radius (r = 110px).
 */
export function triggerBiome3TacticalVentPulse(sim: WorldSim, p: SimPlayerState): void {
  if (sim.map.biome !== 3 && sim.currentBiome !== 3) return;

  const destroyedIds: number[] = [];
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
    if (distance(p.x, p.y, b.x, b.y) <= BIOME3_TACTICAL_VENT_RADIUS + b.radius) {
      b.ttlSec = 0;
      destroyedIds.push(b.id);
    }
  }
  if (destroyedIds.length > 0 && !sim.stressTestActive) {
    sim.events.push({
      kind: 'projectiles_destroyed',
      ids: destroyedIds,
    });
  }
}

/**
 * Biome 3 Prop 1 — forge_blast_shield:
 * When Dash-Kicked, projects an 88px-wide Fire Wave (halfWidth = 44px) along its slide path,
 * igniting oil/grass and burning enemies in the corridor.
 */
export function applyForgeBlastShieldFireWave(
  sim: WorldSim,
  prop: SimPropState,
  oldX: number,
  oldY: number,
  nextX: number,
  nextY: number,
  slideAngle: number,
  ownerId: number,
): void {
  if (prop.kind !== 'forge_blast_shield') return;

  sim.map.igniteSurfaceInRadius(nextX, nextY, FORGE_BLAST_SHIELD_WAVE_HALF_WIDTH);
  if (!prop.hitEnemyIds) prop.hitEnemyIds = [];

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || prop.hitEnemyIds.includes(e.id)) continue;
    if (segDist(e.x, e.y, oldX, oldY, nextX, nextY) <= FORGE_BLAST_SHIELD_WAVE_HALF_WIDTH + e.radius) {
      prop.hitEnemyIds.push(e.id);
      const dmg = computeKickSlideDamage(e, sim.currentFloor);
      sim.applyDamageToEnemy(
        e,
        dmg,
        false,
        'burn',
        slideAngle,
        SLIDING_PROP_ENEMY_KB_SPEED,
        true,
        ownerId,
      );
      if (e.hp > 0) {
        e.burnTimer = Math.max(e.burnTimer, 3.0);
        sim.applyElementStatusToEnemy(e, 'burn', dmg, ownerId);
      }
      e.kbVx = Math.cos(slideAngle) * SLIDING_PROP_ENEMY_KB_SPEED;
      e.kbVy = Math.sin(slideAngle) * SLIDING_PROP_ENEMY_KB_SPEED;
      e.stunTimer = Math.max(e.stunTimer ?? 0, SLIDING_PROP_ENEMY_STUN_SEC);
      if (!e.isBoss && e.hp > 0) {
        e.aiState = 'stunned';
        e.stateTimer = Math.max(e.stateTimer, SLIDING_PROP_ENEMY_STUN_SEC);
      }
    }
  }
}

/**
 * Biome 3 Prop 3 — slag_crucible:
 * When Dash-Kicked or shot to 0 HP, spills a 192px-long Molten Lava Carpet burning a row of enemies.
 */
export function spillSlagCrucibleLavaCarpet(
  sim: WorldSim,
  crucible: SimPropState,
  spillAngle?: number,
  ownerId = sim.player.id,
): void {
  if (crucible.hp <= 0 && !crucible.explosive) return;
  crucible.hp = 0;
  crucible.fuseTimer = 0;
  crucible.explosive = false;

  const resolvedAngle =
    spillAngle ??
    crucible.fallAngle ??
    (Math.hypot(crucible.vx ?? 0, crucible.vy ?? 0) > 1
      ? Math.atan2(crucible.vy ?? 0, crucible.vx ?? 0)
      : distance(crucible.x, crucible.y, sim.player.x, sim.player.y) > 0.001
        ? Math.atan2(crucible.y - sim.player.y, crucible.x - sim.player.x)
        : sim.player.aimAngle);

  sim.events.push({
    kind: 'prop_destroyed',
    propId: crucible.id,
    propKind: crucible.kind,
    x: crucible.x,
    y: crucible.y,
  });
  sim.events.push({
    kind: 'explosion',
    x: crucible.x,
    y: crucible.y,
    radius: 64,
    damage: 28,
    sourceDefId: 'slag_crucible',
  });

  const dirX = Math.cos(resolvedAngle);
  const dirY = Math.sin(resolvedAngle);
  const endX = crucible.x + dirX * SLAG_CRUCIBLE_CARPET_LENGTH;
  const endY = crucible.y + dirY * SLAG_CRUCIBLE_CARPET_LENGTH;

  // Lay down 192px molten lava carpet across floor tiles
  for (let d = 0; d <= SLAG_CRUCIBLE_CARPET_LENGTH; d += 24) {
    const px = crucible.x + dirX * d;
    const py = crucible.y + dirY * d;
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
      if (!sim.map.isSolidTile(tx, ty) && sim.map.getSurface(tx, ty) !== 'chasm') {
        sim.map.setSurface(tx, ty, 'lava', 6.0);
      }
    }
  }

  // Burn and damage enemies along the 192px x 56px molten corridor
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning') continue;
    if (segDist(e.x, e.y, crucible.x, crucible.y, endX, endY) <= 28 + e.radius) {
      const dmg = computeHazardDamage(e, sim.currentFloor, 26);
      e.hp = Math.max(0, e.hp - dmg);
      e.hitFlashTimer = 0.14;
      e.lastHitDmg = dmg;
      e.burnTimer = Math.max(e.burnTimer, 3.5);
      sim.events.push({
        kind: 'damage_dealt',
        targetId: e.id,
        targetKind: 'enemy',
        x: e.x,
        y: e.y,
        amount: dmg,
        isCrit: false,
        hitArmor: false,
        element: 'burn',
        knockbackX: 0,
        knockbackY: 0,
      });
      if (e.hp > 0) {
        sim.applyElementStatusToEnemy(e, 'burn', dmg, ownerId);
      } else {
        sim.handleEnemyKilled(e, ownerId);
      }
    }
  }
}

function triggerPneumaticPressSlam(sim: WorldSim, press: SimPropState): void {
  press.pressState = 'cooldown';
  press.pressTimer = PNEUMATIC_PRESS_COOLDOWN_SEC;
  press.hitFlashTimer = 0.25;

  sim.events.push({
    kind: 'explosion',
    x: press.x,
    y: press.y,
    radius: PNEUMATIC_PRESS_CRUSH_RADIUS,
    damage: 45,
    sourceDefId: 'pneumatic_press',
  });
  sim.events.push({
    kind: 'hit_stop',
    durationMs: 35,
    trauma: 0.35,
  });

  // 1. Crush enemies and break Boss armor inside PNEUMATIC_PRESS_CRUSH_RADIUS
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning') continue;
    if (distance(press.x, press.y, e.x, e.y) <= PNEUMATIC_PRESS_CRUSH_RADIUS + e.radius) {
      const dmg = computeHazardDamage(e, sim.currentFloor, 36);
      e.hp = Math.max(0, e.hp - dmg);
      e.hitFlashTimer = 0.18;
      e.lastHitDmg = dmg;
      e.stunTimer = Math.max(e.stunTimer ?? 0, 1.5);
      if (e.isBoss) {
        e.bossStaggerAccum = (e.bossStaggerAccum ?? 0) + 1;
        if (e.shieldArmor > 0) {
          e.shieldArmor = 0;
          sim.events.push({
            kind: 'armor_broken',
            targetKind: 'enemy',
            targetId: e.id,
            x: e.x,
            y: e.y,
          });
        }
      } else {
        e.aiState = 'stunned';
        e.stateTimer = Math.max(e.stateTimer, 1.5);
      }
      e.vx = 0;
      e.vy = 0;
      sim.events.push({
        kind: 'damage_dealt',
        targetId: e.id,
        targetKind: 'enemy',
        x: e.x,
        y: e.y,
        amount: dmg,
        isCrit: true,
        hitArmor: false,
        element: 'none',
        knockbackX: 0,
        knockbackY: 0,
      });
      sim.checkBossPhaseTransitions(e);
      if (e.hp <= 0) sim.handleEnemyKilled(e, sim.player.id);
    }
  }

  // 2. Push players safely to the rim with 0 damage!
  const allPlayers = sim.getAllPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const pl = allPlayers[i]!;
    if (pl.lifeState !== 'alive' || pl.hp <= 0) continue;
    const d = distance(press.x, press.y, pl.x, pl.y);
    if (d < PNEUMATIC_PRESS_CRUSH_RADIUS + pl.radius) {
      const ang = d > 0.001 ? Math.atan2(pl.y - press.y, pl.x - press.x) : 0;
      const safeDist = PNEUMATIC_PRESS_CRUSH_RADIUS + pl.radius + 4;
      const col = sim.map.resolveCircleCollision(
        press.x + Math.cos(ang) * safeDist,
        press.y + Math.sin(ang) * safeDist,
        pl.radius,
        false,
      );
      pl.x = col.x;
      pl.y = col.y;
    }
  }
}

export function updateP1CTacticalProps(sim: WorldSim, dtSec: number): void {
  // 1. Biome 3 Factory Conveyor Cycle (8.0s period, 1.2s warning before reversal)
  if (
    !sim.stressTestActive &&
    (sim.map.biome === 3 ||
      sim.currentBiome === 3 ||
      sim.map.roomArchetype === 'CROSSFIRE_CONVEYORS')
  ) {
    const cycleNext = (sim.map.conveyorCycleTimer ?? 0) + dtSec;
    if (cycleNext >= CONVEYOR_CYCLE_PERIOD_SEC) {
      const remainder = cycleNext - CONVEYOR_CYCLE_PERIOD_SEC;
      sim.map.reverseConveyorDirection();
      sim.map.conveyorCycleTimer = remainder;
      sim.map.conveyorWarningTimer = 0;
    } else if (cycleNext >= CONVEYOR_CYCLE_PERIOD_SEC - CONVEYOR_WARNING_LEAD_SEC) {
      sim.map.conveyorCycleTimer = cycleNext;
      sim.map.conveyorWarningTimer = Math.max(0.01, CONVEYOR_CYCLE_PERIOD_SEC - cycleNext);
    } else {
      sim.map.conveyorCycleTimer = cycleNext;
      sim.map.conveyorWarningTimer = 0;
    }
  }

  // 2. Update glacial_spike TTL and pneumatic_press sensor / windup / slam / cooldown
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
        continue;
      }
    }

    if (prop.kind === 'pneumatic_press') {
      const state = prop.pressState ?? 'idle';
      if (state === 'cooldown') {
        prop.pressTimer = Math.max(0, (prop.pressTimer ?? 0) - dtSec);
        if (prop.pressTimer <= 0) {
          prop.pressState = 'idle';
        }
      } else if (state === 'windup') {
        prop.pressTimer = (prop.pressTimer ?? PNEUMATIC_PRESS_WINDUP_SEC) - dtSec;
        if (prop.pressTimer <= 0) {
          triggerPneumaticPressSlam(sim, prop);
        }
      } else {
        let triggered = false;
        for (let eIdx = 0; eIdx < sim.enemies.length; eIdx++) {
          const e = sim.enemies[eIdx]!;
          if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning') continue;
          if (distance(prop.x, prop.y, e.x, e.y) <= PNEUMATIC_PRESS_SENSOR_RADIUS + e.radius) {
            triggered = true;
            break;
          }
        }
        if (!triggered) {
          for (let pIdx = 0; pIdx < sim.props.length; pIdx++) {
            const other = sim.props[pIdx]!;
            if (other.id === prop.id || other.hp <= 0 || other.coverState !== 'sliding') continue;
            if (
              distance(prop.x, prop.y, other.x, other.y) <=
              PNEUMATIC_PRESS_SENSOR_RADIUS + other.radius
            ) {
              triggered = true;
              break;
            }
          }
        }
        if (triggered) {
          prop.pressState = 'windup';
          prop.pressTimer = PNEUMATIC_PRESS_WINDUP_SEC;
        }
      }
    }
  }
}
