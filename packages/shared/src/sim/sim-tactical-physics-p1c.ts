import { distance } from '../math/vec2.js';
import { TILE_SIZE } from '../protocol/messages.js';
import { applyRicochetVowTacticalPropBonus } from './sim-ashen-pacts.js';
import { tryTriggerToxicShrapnelOnPropBreak } from './sim-blessings-p4a.js';
import {
  FORGE_TITAN_ARMOR_BREAK_STUN_SEC,
  addBossStaggerAccum,
  triggerBossArmorBreak,
  tryBreakBossArmorWithKickedProp,
} from './sim-boss-armor-break.js';
import { shatterIceGolemArmor } from './sim-enemies-tactical-ai.js';
import {
  clampBossPlayerHitDamage,
  dampenBossMultiProcDamage,
} from './sim-damage-pipeline.js';
import {
  computeFloorScalingMultiplier,
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
  tryTriggerToxicShrapnelOnPropBreak(sim, barricade, ownerId);

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

  const owner = sim.getPlayerById(ownerId) ?? sim.player;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (
      e.hp <= 0 ||
      e.isDummy ||
      e.defId === 'ashen_executioner' ||
      e.aiState === 'spawning' ||
      e.bossArmorBreakTriggeredTick === sim.tick
    ) {
      continue;
    }
    if (distance(barricade.x, barricade.y, e.x, e.y) <= GLACIAL_BARRICADE_SHATTER_RADIUS + e.radius) {
      const dmg = applyRicochetVowTacticalPropBonus(
        owner,
        computeHazardDamage(e, sim.currentFloor, 28),
      );
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
        status: 'frozen',
        x: e.x,
        y: e.y,
      });
      if (e.defId === 'ice_golem' && e.hp > 0) {
        shatterIceGolemArmor(sim, e, ownerId);
      }
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

export const CRYO_OBELISK_PULSE_RADIUS = 72;
export const CRYO_OBELISK_PULSE_DAMAGE = 14;
export const CRYO_OBELISK_PULSE_CHILL_SEC = 2.0;
export const CRYO_OBELISK_PULSE_COOLDOWN_SEC = 1.2;

/**
 * Biome 2 Prop 3 — cryo_prism_pillar (Cryo Tuning Obelisk):
 * When struck by a player projectile or focus_laser, emits an enemy-only Chill resonance pulse:
 * radius = 72px, 14 Chill damage + 2.0s 'chill' (1 stack), 1.20s ICD per prop, 0 friendly-fire, 0 RNG calls.
 */
export function triggerCryoTuningObeliskPulse(
  sim: WorldSim,
  obelisk: SimPropState,
  ownerPlayerId?: number,
): boolean {
  obelisk.hitFlashTimer = 0.16;
  if ((obelisk.prismPulseCooldownSec ?? 0) > 0) {
    return false;
  }
  obelisk.prismPulseCooldownSec = CRYO_OBELISK_PULSE_COOLDOWN_SEC;
  sim.events.push({
    kind: 'explosion',
    x: obelisk.x,
    y: obelisk.y,
    radius: CRYO_OBELISK_PULSE_RADIUS,
    damage: CRYO_OBELISK_PULSE_DAMAGE,
    sourceDefId: 'cryo_prism_pillar',
  });

  const r = CRYO_OBELISK_PULSE_RADIUS;
  const dmg = CRYO_OBELISK_PULSE_DAMAGE;
  const chillSec = CRYO_OBELISK_PULSE_CHILL_SEC;

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning') continue;
    if (distance(obelisk.x, obelisk.y, e.x, e.y) <= r + e.radius) {
      const hitAng = Math.atan2(e.y - obelisk.y, e.x - obelisk.x);
      sim.applyDamageToEnemy(
        e,
        dmg,
        false,
        'chill',
        hitAng,
        0,
        false,
        ownerPlayerId ?? sim.player.id,
      );
      e.chillTimer = chillSec;
      e.chillStacks = 1;
    }
  }
  return true;
}

export function refractProjectileThroughCryoPrism(
  sim: WorldSim,
  b: SimProjectileState,
  prism: SimPropState,
): boolean {
  if (b.team !== 'player' || b.hitEntityIds.includes(prism.id)) return false;
  b.hitEntityIds.push(prism.id);
  b.ttlSec = 0;
  triggerCryoTuningObeliskPulse(sim, prism, b.ownerId);
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

  const waveOwner = sim.getPlayerById(ownerId) ?? sim.player;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.defId === 'ashen_executioner' || prop.hitEnemyIds.includes(e.id)) continue;
    if (segDist(e.x, e.y, oldX, oldY, nextX, nextY) <= FORGE_BLAST_SHIELD_WAVE_HALF_WIDTH + e.radius) {
      prop.hitEnemyIds.push(e.id);
      if (tryBreakBossArmorWithKickedProp(sim, e, prop, ownerId)) {
        e.burnTimer = Math.max(e.burnTimer, 3.0);
        if (e.burnTickTimer <= 0) e.burnTickTimer = 0.5;
        prop.x = e.x;
        prop.y = e.y;
        prop.hp = 0;
        prop.destructible = false;
        prop.blocksMovement = false;
        prop.blocksEnemyProjectiles = false;
        prop.state = 'broken';
        prop.coverState = 'fallen';
        tryTriggerToxicShrapnelOnPropBreak(sim, prop, ownerId);
        sim.events.push({
          kind: 'prop_destroyed',
          propId: prop.id,
          propKind: prop.kind,
          x: e.x,
          y: e.y,
        });
        return;
      }
      const dmg = applyRicochetVowTacticalPropBonus(
        waveOwner,
        computeKickSlideDamage(e, sim.currentFloor),
      );
      sim.applyDamageToEnemy(
        e,
        dmg,
        false,
        'burn',
        slideAngle,
        SLIDING_PROP_ENEMY_KB_SPEED,
        true,
        ownerId,
        false,
        1.0,
        true,
      );
      if (e.hp > 0) {
        e.burnTimer = Math.max(e.burnTimer, 3.0);
        sim.applyElementStatusToEnemy(e, 'burn', dmg, ownerId);
      }
      const waveKb = e.isBoss ? SLIDING_PROP_ENEMY_KB_SPEED * 0.2 : SLIDING_PROP_ENEMY_KB_SPEED;
      e.kbVx = Math.cos(slideAngle) * waveKb;
      e.kbVy = Math.sin(slideAngle) * waveKb;
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
  tryTriggerToxicShrapnelOnPropBreak(sim, crucible, ownerId);

  // Burn and damage enemies along the 192px x 56px molten corridor
  const carpetOwner = sim.getPlayerById(ownerId) ?? sim.player;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy || e.defId === 'ashen_executioner' || e.aiState === 'spawning') continue;
    if (segDist(e.x, e.y, crucible.x, crucible.y, endX, endY) <= 28 + e.radius) {
      if (
        Boolean(crucible.kickedByPlayerId || spillAngle !== undefined) &&
        tryBreakBossArmorWithKickedProp(sim, e, crucible, ownerId)
      ) {
        e.burnTimer = Math.max(e.burnTimer, 3.5);
        if (e.burnTickTimer <= 0) e.burnTickTimer = 0.5;
        continue;
      }
      if (e.bossArmorBreakTriggeredTick === sim.tick) {
        e.burnTimer = Math.max(e.burnTimer, 3.5);
        if (e.burnTickTimer <= 0) e.burnTickTimer = 0.5;
        continue;
      }
      const rawHazardDmg = computeHazardDamage(e, sim.currentFloor, 26);
      const dmg = e.isBoss
        ? Math.max(
            1,
            Math.round(
              dampenBossMultiProcDamage(
                sim.tick,
                e,
                clampBossPlayerHitDamage(
                  carpetOwner,
                  Math.round(26 * computeFloorScalingMultiplier(sim.currentFloor)),
                ),
              ),
            ),
          )
        : applyRicochetVowTacticalPropBonus(carpetOwner, rawHazardDmg);
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
        if (e.isBoss && Boolean(crucible.kickedByPlayerId || spillAngle !== undefined)) {
          addBossStaggerAccum(sim, e, 0, 1.0, true, carpetOwner);
        }
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
      if (e.isBoss && (e.defId === 'forge_titan' || e.bossArmorShellActive)) {
        e.bossStaggerAccum = (e.bossStaggerAccum ?? 0) + 1;
        if (e.shieldArmor > 0) {
          e.shieldArmor = 0;
        }
        triggerBossArmorBreak(
          sim,
          e,
          sim.player.id,
          e.defId === 'forge_titan' ? FORGE_TITAN_ARMOR_BREAK_STUN_SEC : undefined,
          e.defId === 'forge_titan' ? 'THERMAL ARMOR OVERLOAD!' : undefined,
        );
        continue;
      }
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

    if (prop.prismPulseCooldownSec !== undefined && prop.prismPulseCooldownSec > 0) {
      prop.prismPulseCooldownSec = Math.max(0, prop.prismPulseCooldownSec - dtSec);
    }

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
