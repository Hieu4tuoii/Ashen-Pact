import type { ElementType } from '../data/types.js';
import { angleDiff, circleVsCircle, clamp, distance } from '../math/vec2.js';
import {
  isFlippableBarricadeProp,
  isKickableProp,
  resolveEnemyChasmRingOut,
} from './sim-tactical-physics.js';
import { pointToSegmentDist } from './sim-weapon-specials-rare.js';
import { processMeleeParryDeflect } from './sim-weapon-specials.js';
import type {
  SimEnemyState,
  SimFlameFissureState,
  SimPlayerState,
  SimProjectileState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const EMERALD_BOOMERANG_OUTBOUND_SPEED = 640;
export const EMERALD_BOOMERANG_RETURN_SPEED = 680;
export const EMERALD_BOOMERANG_MAX_DIST = 280;
export const EMERALD_BOOMERANG_RADIUS = 20;
export const EMERALD_BOOMERANG_SPIN_RADIUS = 56;
export const EMERALD_BOOMERANG_SPIN_TICKS = 24;
export const EMERALD_BOOMERANG_SPIN_PULSE_INTERVAL_TICKS = 9;
export const EMERALD_BOOMERANG_PULL_DIST = 42;
export const EMERALD_BOOMERANG_DEFLECT_CAP = 3;
export const EMERALD_BOOMERANG_DEFLECT_SPEED = 760;

export const BERSERKER_BLOODLUST_MAX_STACKS = 5;
export const BERSERKER_BLOODLUST_DURATION_SEC = 4.0;
export const BERSERKER_BLOODLUST_AS_PER_STACK = 0.07;
export const BERSERKER_UNARMORED_AS_BONUS = 0.15;
export const BERSERKER_GUILLOTINE_LEAP_DIST = 96;
export const BERSERKER_FISSURE_LENGTH = 160;
export const BERSERKER_FISSURE_WIDTH = 36;
export const BERSERKER_FISSURE_DURATION_SEC = 2.5;
export const BERSERKER_FISSURE_TICK_TICKS = 30;
export const BERSERKER_FISSURE_TICK_DMG = 10;

export function applySafeMeleeLunge(sim: WorldSim, p: SimPlayerState, lungeDist: number): void {
  if (sim.stressTestActive || lungeDist <= 0) return;
  const steps = Math.max(4, Math.ceil(lungeDist / 6));
  const stepX = (Math.cos(p.aimAngle) * lungeDist) / steps;
  const stepY = (Math.sin(p.aimAngle) * lungeDist) / steps;
  for (let s = 0; s < steps; s++) {
    const candX = p.x + stepX;
    const candY = p.y + stepY;
    if (sim.map.getSurfaceAtWorld(candX, candY) === 'chasm') {
      break;
    }
    const res = sim.map.resolveCircleCollision(candX, candY, p.radius, false);
    if (sim.map.getSurfaceAtWorld(res.x, res.y) === 'chasm') {
      break;
    }
    p.x = res.x;
    p.y = res.y;
    sim.resolvePropMovementCollision(p);
    if (res.collided) {
      break;
    }
  }
}

export function spawnEmeraldCleaverBoomerang(
  sim: WorldSim,
  p: SimPlayerState,
  damage: number,
  critChance: number,
  element: ElementType,
  shotFlags: number,
  halfArc = (67.5 * Math.PI) / 180,
  meleeRange = 92,
): void {
  const boomerangDamage = Math.max(32, damage);
  const boomerangElement: ElementType = element === 'none' ? 'poison' : element;
  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: p.id,
    team: 'player',
    weaponId: 'emerald_cleaver_boomerang',
    x: p.x,
    y: p.y,
    angle: p.aimAngle,
    pelletCount: 1,
    spreadRad: 0,
    speed: EMERALD_BOOMERANG_OUTBOUND_SPEED,
    damage: boomerangDamage,
    radius: EMERALD_BOOMERANG_RADIUS,
    knockback: 180,
    pierceCount: 99,
    bounceCount: 0,
    ttlSec: 3.0,
    element: boomerangElement,
    critChance,
    amplifiedByShield: false,
    seed: (sim.rng.nextUint32() ^ 0x51c3b2a9) >>> 0,
    shotFlags,
    originX: p.x,
    originY: p.y,
    boomerangPhase: 'outbound',
    boomerangSpinTicks: 0,
    boomerangDeflectedCount: 0,
  });
  const spawned = sim.projectiles[sim.projectiles.length - 1];
  if (spawned && spawned.weaponId === 'emerald_cleaver_boomerang') {
    spawned.boomerangPhase = 'outbound';
    spawned.boomerangSpinTicks = 0;
    spawned.boomerangDeflectedCount = 0;
    for (let i = 0; i < sim.enemies.length; i++) {
      const enemy = sim.enemies[i]!;
      if (enemy.hp <= 0) continue;
      const d = distance(p.x, p.y, enemy.x, enemy.y);
      if (
        d <= EMERALD_BOOMERANG_RADIUS + enemy.radius + 16 ||
        (d <= meleeRange + enemy.radius &&
          Math.abs(angleDiff(Math.atan2(enemy.y - p.y, enemy.x - p.x), p.aimAngle)) <= halfArc)
      ) {
        spawned.hitEntityIds.push(enemy.id);
      }
    }
  }
}

export function updateEmeraldCleaverBoomerang(
  sim: WorldSim,
  b: SimProjectileState,
  dtSec: number,
): void {
  const phase = b.boomerangPhase ?? 'outbound';
  b.boomerangPhase = phase;

  if (phase === 'outbound') {
    b.x += b.vx * dtSec;
    b.y += b.vy * dtSec;

    if (!sim.stressTestActive && sim.props.length > 0) {
      const owner = sim.getPlayerById(b.ownerId) ?? sim.player;
      for (let k = 0; k < sim.props.length; k++) {
        const prop = sim.props[k]!;
        if (prop.hp <= 0 || prop.coverState === 'sliding') continue;
        if (circleVsCircle(b, prop)) {
          if (isFlippableBarricadeProp(prop.kind) && isKickableProp(prop)) {
            sim.kickProp(prop, owner, b.angle);
            continue;
          }
          if (!prop.destructible) continue;
          prop.fallAngle = b.angle;
          sim.damageProp(prop, b.damage, b.element);
        }
      }
    }

    const originX = b.originX ?? b.x;
    const originY = b.originY ?? b.y;
    const wallHit = sim.map.checkProjectileWallHit(b.x, b.y, b.radius);
    const distFromOrigin = distance(originX, originY, b.x, b.y);
    let reachedApex = false;

    if (wallHit.hit) {
      b.x = wallHit.resolvedX;
      b.y = wallHit.resolvedY;
      reachedApex = true;
    } else if (distFromOrigin >= EMERALD_BOOMERANG_MAX_DIST) {
      b.x = originX + Math.cos(b.angle) * EMERALD_BOOMERANG_MAX_DIST;
      b.y = originY + Math.sin(b.angle) * EMERALD_BOOMERANG_MAX_DIST;
      reachedApex = true;
    }

    const candidates = sim.enemySpatialGrid.queryCircle(
      b.x,
      b.y,
      b.radius,
      sim.queryEnemyScratch,
    );
    for (let j = 0; j < candidates.length; j++) {
      const enemy = candidates[j]!;
      if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
      if (b.hitEntityIds.includes(enemy.id)) continue;
      if (circleVsCircle(b, enemy)) {
        b.hitEntityIds.push(enemy.id);
        sim.applyDamageToEnemy(
          enemy,
          b.damage,
          b.isCrit,
          'poison',
          b.angle,
          b.knockback,
          false,
          b.ownerId,
        );
      }
    }

    if (reachedApex) {
      b.vx = 0;
      b.vy = 0;
      b.boomerangPhase = 'spinning';
      b.boomerangSpinTicks = 0;
      b.boomerangDeflectedCount = 0;
      b.hitEntityIds.length = 0;
    }
    return;
  }

  if (phase === 'spinning') {
    const spinTicks = (b.boomerangSpinTicks ?? 0) + 1;
    b.boomerangSpinTicks = spinTicks;

    // Deflect up to 3 enemy bullets total during spin
    let deflectedSoFar = b.boomerangDeflectedCount ?? 0;
    if (deflectedSoFar < EMERALD_BOOMERANG_DEFLECT_CAP) {
      const deflectedIds: number[] = [];
      for (let i = 0; i < sim.projectiles.length; i++) {
        if (deflectedSoFar >= EMERALD_BOOMERANG_DEFLECT_CAP) break;
        const eb = sim.projectiles[i]!;
        if (eb.ttlSec <= 0 || eb.team !== 'enemy' || eb.parryDeflected) continue;
        if (distance(b.x, b.y, eb.x, eb.y) <= EMERALD_BOOMERANG_SPIN_RADIUS + eb.radius) {
          eb.team = 'player';
          eb.ownerId = b.ownerId;
          eb.parryDeflected = true;
          eb.kinematicMode = undefined;
          eb.initialSpeed = undefined;
          eb.targetSpeed = undefined;
          eb.kinematicRate = undefined;
          eb.kinematicDelaySec = undefined;
          eb.kinematicElapsedSec = 0;
          eb.angularVelRad = undefined;
          eb.bulletShape = undefined;
          eb.angle = b.angle;
          eb.vx = Math.cos(b.angle) * EMERALD_BOOMERANG_DEFLECT_SPEED;
          eb.vy = Math.sin(b.angle) * EMERALD_BOOMERANG_DEFLECT_SPEED;
          eb.damage = Math.max(24, Math.round(eb.damage * 2.2));
          eb.ttlSec = Math.max(eb.ttlSec, 0.85);
          eb.hitEntityIds.length = 0;
          deflectedSoFar += 1;
          deflectedIds.push(eb.id);
        }
      }
      b.boomerangDeflectedCount = deflectedSoFar;
      if (deflectedIds.length > 0 && !sim.stressTestActive) {
        sim.events.push({
          kind: 'projectiles_destroyed',
          ids: deflectedIds,
        });
        sim.events.push({
          kind: 'melee_parry_deflect',
          playerId: b.ownerId,
          weaponId: 'emerald_cleaver',
          x: b.x,
          y: b.y,
          angle: b.angle,
          deflectedCount: deflectedIds.length,
          ids: deflectedIds,
        });
      }
    }

    // Pulse Poison damage in r=56px every 9 ticks (0.15s)
    if (spinTicks === 1 || (spinTicks - 1) % EMERALD_BOOMERANG_SPIN_PULSE_INTERVAL_TICKS === 0) {
      const candidates = sim.enemySpatialGrid.queryCircle(
        b.x,
        b.y,
        EMERALD_BOOMERANG_SPIN_RADIUS,
        sim.queryEnemyScratch,
      );
      for (let j = 0; j < candidates.length; j++) {
        const enemy = candidates[j]!;
        if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
        if (b.hitEntityIds.includes(enemy.id)) continue;
        if (distance(b.x, b.y, enemy.x, enemy.y) <= EMERALD_BOOMERANG_SPIN_RADIUS + enemy.radius) {
          b.hitEntityIds.push(enemy.id);
          const hitAngle = Math.atan2(enemy.y - b.y, enemy.x - b.x);
          sim.applyDamageToEnemy(
            enemy,
            b.damage,
            b.isCrit,
            'poison',
            hitAngle,
            120,
            false,
            b.ownerId,
          );
        }
      }
    }

    if (spinTicks >= EMERALD_BOOMERANG_SPIN_TICKS) {
      b.boomerangPhase = 'returning';
      b.hitEntityIds.length = 0;
      b.ttlSec = Math.max(b.ttlSec, 1.5);
    }
    return;
  }

  // phase === 'returning'
  const owner = sim.getPlayerById(b.ownerId) ?? sim.player;
  const dx = owner.x - b.x;
  const dy = owner.y - b.y;
  const distToOwner = Math.hypot(dx, dy);
  const stepDist = EMERALD_BOOMERANG_RETURN_SPEED * dtSec;
  const returnAngle = Math.atan2(dy, dx);
  b.angle = returnAngle;
  b.vx = Math.cos(returnAngle) * EMERALD_BOOMERANG_RETURN_SPEED;
  b.vy = Math.sin(returnAngle) * EMERALD_BOOMERANG_RETURN_SPEED;

  if (distToOwner <= Math.max(24, stepDist)) {
    b.x = owner.x;
    b.y = owner.y;
    b.ttlSec = 0;
  } else {
    b.x += b.vx * dtSec;
    b.y += b.vy * dtSec;
  }

  const candidates = sim.enemySpatialGrid.queryCircle(
    b.x,
    b.y,
    b.radius,
    sim.queryEnemyScratch,
  );
  for (let j = 0; j < candidates.length; j++) {
    const enemy = candidates[j]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    if (b.hitEntityIds.includes(enemy.id)) continue;
    if (circleVsCircle(b, enemy)) {
      b.hitEntityIds.push(enemy.id);
      const toOwnerAngle = Math.atan2(owner.y - enemy.y, owner.x - enemy.x);
      sim.applyDamageToEnemy(
        enemy,
        b.damage,
        b.isCrit,
        'poison',
        toOwnerAngle,
        0,
        false,
        b.ownerId,
      );
      if (enemy.hp > 0) {
        const pullDist = Math.min(
          EMERALD_BOOMERANG_PULL_DIST,
          distance(enemy.x, enemy.y, owner.x, owner.y),
        );
        const nextX = enemy.x + Math.cos(toOwnerAngle) * pullDist;
        const nextY = enemy.y + Math.sin(toOwnerAngle) * pullDist;
        const resolved = sim.map.resolveCircleCollision(nextX, nextY, enemy.radius, true);
        enemy.x = resolved.x;
        enemy.y = resolved.y;
        if (!sim.stressTestActive) {
          sim.resolvePropMovementCollision(enemy);
          const postCol = sim.map.resolveCircleCollision(enemy.x, enemy.y, enemy.radius, true);
          enemy.x = postCol.x;
          enemy.y = postCol.y;
        }
        resolveEnemyChasmRingOut(sim, enemy);
      }
    }
  }
}

export function computeBerserkerAxeFireRateMultiplier(p: SimPlayerState): number {
  const stacks = clamp(p.berserkerBloodlustStacks ?? 0, 0, BERSERKER_BLOODLUST_MAX_STACKS);
  const bloodlustBonus = stacks * BERSERKER_BLOODLUST_AS_PER_STACK;
  const unarmoredBonus = p.armor <= 0 ? BERSERKER_UNARMORED_AS_BONUS : 0;
  return 1 + bloodlustBonus + unarmoredBonus;
}

export function applyBerserkerAxeHitBloodlust(
  p: SimPlayerState,
  hitAny: boolean,
  baseFireRate: number,
  convergenceMult: number,
  wasFinisher: boolean,
  comboRecoverySec: number,
): void {
  if (hitAny) {
    p.berserkerBloodlustStacks = Math.min(
      BERSERKER_BLOODLUST_MAX_STACKS,
      (p.berserkerBloodlustStacks ?? 0) + 1,
    );
    p.berserkerBloodlustTimer = BERSERKER_BLOODLUST_DURATION_SEC;
  }
  const mult = computeBerserkerAxeFireRateMultiplier(p);
  const effectiveFireRate = baseFireRate * convergenceMult * mult;
  p.fireCooldownTimer = 1 / effectiveFireRate + (wasFinisher ? comboRecoverySec : 0);
}

function shatterEnemyShieldForGuillotine(sim: WorldSim, p: SimPlayerState, enemy: SimEnemyState): void {
  const hadShield =
    enemy.shieldArmor > 0 ||
    enemy.defId === 'iron_shielder' ||
    enemy.defId === 'ice_golem' ||
    enemy.eliteModifier === 'shield';
  enemy.shieldArmor = 0;
  enemy.shieldBrokenTimer = 4.0;
  if (hadShield && !sim.stressTestActive) {
    sim.events.push({
      kind: 'armor_broken',
      targetKind: 'enemy',
      targetId: enemy.id,
      playerId: p.id,
      x: enemy.x,
      y: enemy.y,
    });
  }
}

export function triggerBerserkerGuillotineFinisher(
  sim: WorldSim,
  p: SimPlayerState,
  halfArc: number,
  meleeRange: number,
  damage: number,
): number {
  // 1. Leap up to 96px forward along aimAngle, clamped safely against walls and chasm tiles
  applySafeMeleeLunge(sim, p, BERSERKER_GUILLOTINE_LEAP_DIST);

  // 2. Grant 0.18s Parry Deflect window (max 3 bullets deflected at 760 px/s)
  p.meleeParryWindowTimer = 0.18;
  p.parriedCountCurrentWindow = 0;
  const deflected = processMeleeParryDeflect(sim, p);

  const x1 = p.x;
  const y1 = p.y;
  const x2 = x1 + Math.cos(p.aimAngle) * BERSERKER_FISSURE_LENGTH;
  const y2 = y1 + Math.sin(p.aimAngle) * BERSERKER_FISSURE_LENGTH;
  const halfWidth = BERSERKER_FISSURE_WIDTH * 0.5;

  // 3. Shatter front shields (iron_shielder, ice_golem, shield elites) BEFORE the 52 DMG overhead cleave lands
  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    const dist = distance(p.x, p.y, enemy.x, enemy.y);
    const inCone =
      dist <= meleeRange + enemy.radius &&
      Math.abs(angleDiff(Math.atan2(enemy.y - p.y, enemy.x - p.x), p.aimAngle)) <= halfArc;
    const inFissure =
      pointToSegmentDist(enemy.x, enemy.y, x1, y1, x2, y2) <= halfWidth + enemy.radius;
    if (inCone || inFissure) {
      shatterEnemyShieldForGuillotine(sim, p, enemy);
    }
  }

  // 4. Spawn 160px x 36px Flame Fissure for 2.5s (ticks every 0.50s / 30 ticks for 10 DMG Burn)
  const fissure: SimFlameFissureState = {
    id: sim.nextEntityId++,
    ownerPlayerId: p.id,
    x1,
    y1,
    x2,
    y2,
    angle: p.aimAngle,
    length: BERSERKER_FISSURE_LENGTH,
    width: BERSERKER_FISSURE_WIDTH,
    ttlSec: BERSERKER_FISSURE_DURATION_SEC,
    maxTtlSec: BERSERKER_FISSURE_DURATION_SEC,
    tickTimer: 0.5,
    ticksElapsed: 0,
    damage: BERSERKER_FISSURE_TICK_DMG,
  };
  sim.flameFissures.push(fissure);

  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'berserker_guillotine_slam',
      playerId: p.id,
      x: x1,
      y: y1,
      x2,
      y2,
      angle: p.aimAngle,
      length: BERSERKER_FISSURE_LENGTH,
      width: BERSERKER_FISSURE_WIDTH,
      damage,
      alertTextVi: 'ĐOẠN ĐẦU ĐÀI!',
    });
  }
  return deflected;
}

export function updateFlameFissures(sim: WorldSim, dtSec: number): void {
  if (sim.flameFissures.length === 0) return;
  for (let i = sim.flameFissures.length - 1; i >= 0; i--) {
    const f = sim.flameFissures[i]!;
    f.ttlSec -= dtSec;
    f.tickTimer -= dtSec;
    f.ticksElapsed += 1;

    if (f.ticksElapsed > 0 && f.ticksElapsed % BERSERKER_FISSURE_TICK_TICKS === 0) {
      f.tickTimer = 0.5;
      const halfWidth = f.width * 0.5;
      for (let j = 0; j < sim.enemies.length; j++) {
        const enemy = sim.enemies[j]!;
        if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
        const d = pointToSegmentDist(enemy.x, enemy.y, f.x1, f.y1, f.x2, f.y2);
        if (d <= halfWidth + enemy.radius) {
          if (enemy.burnTimer <= 0) {
            enemy.burnTickTimer = 0.5;
          }
          enemy.burnTimer = Math.max(enemy.burnTimer, 3.0);
          sim.applyDotDamageToEnemy(enemy, f.damage, 'burn');
        }
      }
    }

    if (f.ttlSec <= 1e-6 || f.ticksElapsed >= 150) {
      sim.flameFissures.splice(i, 1);
    }
  }
}
