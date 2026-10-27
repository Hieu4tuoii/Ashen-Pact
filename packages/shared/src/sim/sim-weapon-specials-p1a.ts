import type { ElementType } from '../data/types.js';
import { distance, isCircleInCone } from '../math/vec2.js';
import { INPUT_BUTTON, SHOT_FLAG } from '../protocol/messages.js';
import { resolveEnemyChasmRingOut } from './sim-tactical-physics.js';
import {
  pointToSegmentDist,
  triggerSeedGunHarvestBloom,
} from './sim-weapon-specials-rare.js';
import { triggerVoidStaffImplosion } from './sim-weapon-specials-p1b-ranged.js';
import {
  detonatePlayerMagneticRivets,
  plantMagneticRivet,
  triggerTeslaFinaleChainLightning,
} from './sim-weapon-specials.js';
import {
  type BulletVolleySpawnEvent,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export * from './sim-weapon-specials-rare.js';
export * from './sim-weapon-specials-p1b-ranged.js';

export const CROSSBOW_MAX_STUCK_ARROWS = 4;
export const CROSSBOW_RIP_DMG_PER_ARROW = 6;
export const CROSSBOW_RIP_SLOW_SEC = 1.5;

export const THORN_STAFF_MAX_THORNS = 5;
export const THORN_STAFF_BLOOM_DMG_PER_THORN = 7;
export const THORN_STAFF_FINALE_PULL_DIST = 90;

export const SCRAP_SHOTGUN_POINT_BLANK_DIST = 96;
export const SCRAP_SHOTGUN_POINT_BLANK_MULT = 1.35;
export const SCRAP_SHOTGUN_SHELL_EJECT_DMG = 16;
export const SCRAP_SHOTGUN_SHELL_EJECT_STUN_SEC = 0.3;

export const GALE_SMG_SPINUP_DURATION_SEC = 1.2;
export const GALE_SMG_MIN_FIRE_RATE = 6.0;
export const GALE_SMG_MAX_FIRE_RATE = 10.5;
export const GALE_SMG_WIND_BLADE_DMG = 14;
export const GALE_SMG_WIND_BLADE_KB = 140;
export const GALE_SMG_CYCLONE_RADIUS = 96;
export const GALE_SMG_CYCLONE_DMG = 24;

export const FRAG_LAUNCHER_MAIN_BLAST_RADIUS = 68;
export const FRAG_LAUNCHER_AIRBURST_RADIUS = 104;
export const FRAG_LAUNCHER_SUB_COUNT = 5;
export const FRAG_LAUNCHER_SUB_DMG = 6;
export const FRAG_LAUNCHER_MAX_SUB_HITS_PER_TARGET = 2;

/**
 * Hunter Crossbow (Nỏ Săn Hàn Thiết):
 * Rips all embedded arrows from living enemies, dealing 6 DMG * stuckArrows
 * and applying a 30% movement slow for 1.5s.
 */
export function triggerCrossbowBarbedRip(
  sim: WorldSim,
  pOrPlayerId: SimPlayerState | number,
): number {
  const p =
    typeof pOrPlayerId === 'number'
      ? (sim.getPlayerById(pOrPlayerId) ?? sim.player)
      : pOrPlayerId;
  const targetIds: number[] = [];
  let totalArrows = 0;

  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    const arrows = Math.min(CROSSBOW_MAX_STUCK_ARROWS, enemy.stuckArrows ?? 0);
    if (arrows <= 0) continue;

    enemy.stuckArrows = 0;
    targetIds.push(enemy.id);
    totalArrows += arrows;

    const ripDmg = arrows * CROSSBOW_RIP_DMG_PER_ARROW;
    const pullAngle = Math.atan2(p.y - enemy.y, p.x - enemy.x);

    sim.applyDamageToEnemy(
      enemy,
      ripDmg,
      false,
      'none',
      pullAngle,
      45,
      false,
      p.id,
      true,
    );

    if (enemy.hp > 0) {
      enemy.chillTimer = Math.max(enemy.chillTimer, CROSSBOW_RIP_SLOW_SEC);
      enemy.slowTimer = Math.max(enemy.slowTimer ?? 0, CROSSBOW_RIP_SLOW_SEC);
      if (!sim.stressTestActive) {
        sim.events.push({
          kind: 'status_applied',
          targetId: enemy.id,
          status: 'chill',
          x: enemy.x,
          y: enemy.y,
        });
      }
    }
  }

  if (totalArrows > 0 && !sim.stressTestActive) {
    sim.events.push({
      kind: 'crossbow_rip',
      playerId: p.id,
      targetIds,
      totalArrows,
      x: p.x,
      y: p.y,
    });
  }

  return totalArrows;
}

export const triggerHunterCrossbowBarbedRip = triggerCrossbowBarbedRip;

/**
 * Thorn Staff (Trượng Dây Gai Cộng Sinh):
 * Detonates all embedded Parasitic Thorns on living enemies for 7 Poison DMG * parasiticThorns.
 */
export function detonateParasiticThorns(
  sim: WorldSim,
  pOrPlayerId: SimPlayerState | number,
): number {
  const p =
    typeof pOrPlayerId === 'number'
      ? (sim.getPlayerById(pOrPlayerId) ?? sim.player)
      : pOrPlayerId;
  const targetIds: number[] = [];
  let totalThorns = 0;

  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    const thorns = Math.min(THORN_STAFF_MAX_THORNS, enemy.parasiticThorns ?? 0);
    if (thorns <= 0) continue;

    enemy.parasiticThorns = 0;
    targetIds.push(enemy.id);
    totalThorns += thorns;

    const bloomDmg = thorns * THORN_STAFF_BLOOM_DMG_PER_THORN;
    sim.applyDamageToEnemy(
      enemy,
      bloomDmg,
      false,
      'poison',
      0,
      0,
      false,
      p.id,
      true,
    );
  }

  if (totalThorns > 0 && !sim.stressTestActive) {
    sim.events.push({
      kind: 'thorn_bloom',
      playerId: p.id,
      targetIds,
      totalThorns,
      x: p.x,
      y: p.y,
    });
  }

  return totalThorns;
}

/**
 * Thorn Staff 5th Shot (Finale Shot):
 * Yanks the furthest hit enemy 90px backward toward the front of the player
 * (supporting Chasm Ring-Out!) and blooms all Parasitic Thorns.
 */
export function resolveThornStaffFinalePullAndBloom(
  sim: WorldSim,
  b: SimProjectileState,
): void {
  if (b.finaleResolved) return;
  b.finaleResolved = true;

  const owner = sim.getPlayerById(b.ownerId) ?? sim.player;
  let furthestEnemy: SimEnemyState | null = null;
  let furthestDist = -1;

  for (let i = 0; i < b.hitEntityIds.length; i++) {
    const hitId = b.hitEntityIds[i]!;
    const enemy = sim.enemies.find((e) => e.id === hitId);
    if (!enemy || enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) {
      continue;
    }
    const d = distance(owner.x, owner.y, enemy.x, enemy.y);
    if (d > furthestDist) {
      furthestDist = d;
      furthestEnemy = enemy;
    }
  }

  if (furthestEnemy) {
    const isImmobile =
      furthestEnemy.defId === 'thorn_turret' ||
      furthestEnemy.defId === 'spore_guardian' ||
      furthestEnemy.defId === 'ice_prison' ||
      furthestEnemy.defId === 'forge_energy_core';

    if (!isImmobile) {
      const dx = owner.x - furthestEnemy.x;
      const dy = owner.y - furthestEnemy.y;
      const dist = Math.hypot(dx, dy);
      const minFrontDist = owner.radius + furthestEnemy.radius + 4;
      const pullDist = Math.min(
        THORN_STAFF_FINALE_PULL_DIST,
        Math.max(0, dist - minFrontDist),
      );
      const dirX = dist > 1e-4 ? dx / dist : -Math.cos(b.angle);
      const dirY = dist > 1e-4 ? dy / dist : -Math.sin(b.angle);

      const pulledCol = sim.map.resolveCircleCollision(
        furthestEnemy.x + dirX * pullDist,
        furthestEnemy.y + dirY * pullDist,
        furthestEnemy.radius,
        true,
      );
      furthestEnemy.x = pulledCol.x;
      furthestEnemy.y = pulledCol.y;
      furthestEnemy.kbVx = dirX * 160;
      furthestEnemy.kbVy = dirY * 160;
      furthestEnemy.lastHitPlayerId = owner.id;

      if (!sim.stressTestActive) {
        resolveEnemyChasmRingOut(sim, furthestEnemy);
      }
    }
  }

  detonateParasiticThorns(sim, owner);
}

export function handleProjectileExpiredWeaponSpecials(
  sim: WorldSim,
  b: SimProjectileState,
): void {
  if (b.team === 'player') {
    const isFinale = ((b.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT) !== 0;
    if (b.weaponId === 'hunter_crossbow' && isFinale && !b.finaleResolved) {
      b.finaleResolved = true;
      triggerCrossbowBarbedRip(sim, sim.getPlayerById(b.ownerId) ?? sim.player);
    } else if (b.weaponId === 'thorn_staff' && isFinale) {
      resolveThornStaffFinalePullAndBloom(sim, b);
    }
  }

  if (b.weaponId === 'void_staff') {
    triggerVoidStaffImplosion(sim, b, b.x, b.y, false);
    return;
  }

  if (b.weaponId === 'seed_gun') {
    sim.spawnSeedGunLifeBlossom(b.ownerId, b.x, b.y);
    if (((b.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT) !== 0 && !b.finaleResolved) {
      b.finaleResolved = true;
      triggerSeedGunHarvestBloom(sim, b.ownerId);
    }
  } else if (
    b.weaponId === 'frag_launcher' ||
    b.weaponId === 'magma_cannon' ||
    b.weaponId === 'dwarf_mortar' ||
    (b.explosionRadius ?? 0) > 0
  ) {
    sim.triggerLauncherProjectileExplosion(b, b.x, b.y);
  }
}

export function handleProjectileWallHitWeaponSpecials(
  sim: WorldSim,
  b: SimProjectileState,
  hitX: number,
  hitY: number,
): void {
  if (b.team === 'player') {
    const isFinale = ((b.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT) !== 0;
    if (b.weaponId === 'rivet_gun') {
      plantMagneticRivet(sim, b.ownerId, hitX, hitY, null, null);
      if (isFinale) {
        detonatePlayerMagneticRivets(sim, b.ownerId, false);
      }
    } else if (b.weaponId === 'hunter_crossbow' && isFinale && !b.finaleResolved) {
      b.finaleResolved = true;
      triggerCrossbowBarbedRip(sim, sim.getPlayerById(b.ownerId) ?? sim.player);
    } else if (b.weaponId === 'thorn_staff' && isFinale) {
      resolveThornStaffFinalePullAndBloom(sim, b);
    }
  }

  if (b.weaponId === 'void_staff') {
    triggerVoidStaffImplosion(sim, b, hitX, hitY, false);
    return;
  }

  if (b.weaponId === 'seed_gun') {
    sim.spawnSeedGunLifeBlossom(b.ownerId, hitX, hitY);
    if (((b.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT) !== 0 && !b.finaleResolved) {
      b.finaleResolved = true;
      triggerSeedGunHarvestBloom(sim, b.ownerId);
    }
  } else if (
    b.weaponId === 'frag_launcher' ||
    b.weaponId === 'magma_cannon' ||
    b.weaponId === 'dwarf_mortar' ||
    (b.explosionRadius ?? 0) > 0
  ) {
    sim.triggerLauncherProjectileExplosion(b, hitX, hitY);
  }
}

export function handleProjectileEnemyHitWeaponSpecials(
  sim: WorldSim,
  b: SimProjectileState,
  enemy: SimEnemyState,
): void {
  const isFinale = ((b.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT) !== 0;

  if (b.weaponId === 'rivet_gun') {
    plantMagneticRivet(sim, b.ownerId, enemy.x, enemy.y, enemy.id, null);
    if (isFinale) {
      detonatePlayerMagneticRivets(sim, b.ownerId, false);
    }
  } else if (b.weaponId === 'tesla_carbine' && isFinale && b.hitEntityIds.length === 1) {
    triggerTeslaFinaleChainLightning(sim, b, enemy);
  } else if (b.weaponId === 'hunter_crossbow') {
    enemy.stuckArrows = Math.min(
      CROSSBOW_MAX_STUCK_ARROWS,
      (enemy.stuckArrows ?? 0) + 1,
    );
    if (isFinale && !b.finaleResolved) {
      const hasMoreTargetsAhead =
        b.pierceRemaining > 0 &&
        sim.enemies.some(
          (other) =>
            other.hp > 0 &&
            other.aiState !== 'spawning' &&
            !other.bossBurrowed &&
            !b.hitEntityIds.includes(other.id) &&
            pointToSegmentDist(
              other.x,
              other.y,
              b.x,
              b.y,
              b.x + Math.cos(b.angle) * 260,
              b.y + Math.sin(b.angle) * 260,
            ) <=
              other.radius + b.radius + 8,
        );
      if (!hasMoreTargetsAhead) {
        b.finaleResolved = true;
        triggerCrossbowBarbedRip(sim, sim.getPlayerById(b.ownerId) ?? sim.player);
      }
    }
  } else if (b.weaponId === 'thorn_staff') {
    enemy.parasiticThorns = Math.min(
      THORN_STAFF_MAX_THORNS,
      (enemy.parasiticThorns ?? 0) + 1,
    );
  }

  if (b.weaponId === 'seed_gun') {
    sim.spawnSeedGunLifeBlossom(b.ownerId, enemy.x, enemy.y);
    if (isFinale && !b.finaleResolved) {
      b.finaleResolved = true;
      triggerSeedGunHarvestBloom(sim, b.ownerId);
    }
  } else if (
    b.weaponId === 'frag_launcher' ||
    b.weaponId === 'magma_cannon' ||
    (b.explosionRadius ?? 0) > 0
  ) {
    sim.triggerLauncherProjectileExplosion(b, enemy.x, enemy.y);
  }
}

export const handlePlayerProjectileEnemyHitWeaponSpecials =
  handleProjectileEnemyHitWeaponSpecials;

/**
 * Scrap Shotgun Perfect Reload [R]:
 * Ejects 2 red-hot shells forward along aimAngle dealing 16 Burn DMG + 0.3s stun.
 */
export function triggerScrapShotgunPerfectReload(
  sim: WorldSim,
  pOrPlayerId: SimPlayerState | number,
): number {
  const p =
    typeof pOrPlayerId === 'number'
      ? (sim.getPlayerById(pOrPlayerId) ?? sim.player)
      : pOrPlayerId;
  const halfArc = (60 * Math.PI) / 180;
  const shellRange = 110;
  let hitCount = 0;

  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, shellRange, enemy)) {
      hitCount += 1;
      const hitAng = Math.atan2(enemy.y - p.y, enemy.x - p.x);
      sim.applyDamageToEnemy(
        enemy,
        SCRAP_SHOTGUN_SHELL_EJECT_DMG,
        false,
        'burn',
        hitAng,
        95,
        false,
        p.id,
        true,
      );
      if (enemy.hp > 0) {
        const stunDur = SCRAP_SHOTGUN_SHELL_EJECT_STUN_SEC + 1 / 60;
        enemy.stunTimer = Math.max(enemy.stunTimer ?? 0, stunDur);
        if (!enemy.isBoss) {
          enemy.aiState = 'stunned';
          enemy.stateTimer = Math.max(enemy.stateTimer, stunDur);
          enemy.vx = 0;
          enemy.vy = 0;
        }
      }
    }
  }

  return hitCount;
}

/**
 * Gale SMG Orange Heat 6th Shot:
 * Launches a Piercing Wind Blade (14 DMG, kb = 140, pierces lined-up enemies).
 */
export function spawnGaleSmgWindBlade(
  sim: WorldSim,
  p: SimPlayerState,
  shotElement: ElementType,
  critChance: number,
  shotFlags: number,
): void {
  const spawnX = p.x + Math.cos(p.aimAngle) * 18;
  const spawnY = p.y + Math.sin(p.aimAngle) * 18;
  const bladeVolley: BulletVolleySpawnEvent = {
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: p.id,
    team: 'player',
    weaponId: 'gale_smg_wind_blade',
    x: spawnX,
    y: spawnY,
    angle: p.aimAngle,
    pelletCount: 1,
    spreadRad: 0,
    speed: 620,
    damage: GALE_SMG_WIND_BLADE_DMG,
    radius: 12,
    knockback: GALE_SMG_WIND_BLADE_KB,
    pierceCount: 4,
    bounceCount: 0,
    ttlSec: 0.5,
    element: shotElement,
    critChance,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    shotFlags,
    flags: shotFlags,
  };
  sim.spawnDeterministicVolley(bladeVolley, true);
}

/**
 * Gale SMG Tactical Vent [R]:
 * Explodes Cyclone (r = 96px, 24 DMG), destroys enemy bullets in radius,
 * and blasts nearby enemies outward with high knockback for Wall-Slam.
 */
export function triggerGaleSmgTacticalVent(sim: WorldSim, p: SimPlayerState): void {
  const destroyedIds: number[] = [];
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
    if (distance(p.x, p.y, b.x, b.y) <= GALE_SMG_CYCLONE_RADIUS + b.radius) {
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

  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'explosion',
      x: p.x,
      y: p.y,
      radius: GALE_SMG_CYCLONE_RADIUS,
      damage: GALE_SMG_CYCLONE_DMG,
      sourceDefId: 'gale_smg',
    });
  }

  const elem: ElementType = p.activeImbueElement !== 'none' ? p.activeImbueElement : 'none';
  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    if (distance(p.x, p.y, enemy.x, enemy.y) <= GALE_SMG_CYCLONE_RADIUS + enemy.radius) {
      const ang =
        distance(p.x, p.y, enemy.x, enemy.y) > 1e-4
          ? Math.atan2(enemy.y - p.y, enemy.x - p.x)
          : p.aimAngle;
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.stunTimer = Math.max(enemy.stunTimer ?? 0, 0.25);
      sim.applyDamageToEnemy(
        enemy,
        GALE_SMG_CYCLONE_DMG,
        false,
        elem,
        ang,
        420,
        true,
        p.id,
        true,
      );
    }
  }
}

/**
 * Frag Launcher Hold-and-Release Airburst:
 * While holding FIRE, arms any in-flight frag_launcher grenade; when releasing FIRE
 * mid-flight, immediately detonates it as an Airburst (r = 104px, bypasses front shields).
 */
export function checkAndTriggerFragLauncherAirburst(
  sim: WorldSim,
  p: SimPlayerState,
  buttons: number,
): void {
  const holdingFire = (buttons & INPUT_BUTTON.FIRE) !== 0;
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team !== 'player' || b.ownerId !== p.id || b.weaponId !== 'frag_launcher' || b.ttlSec <= 0) {
      continue;
    }
    if (holdingFire) {
      b.armedForAirburst = true;
    } else if (b.armedForAirburst) {
      b.explosionRadius = FRAG_LAUNCHER_AIRBURST_RADIUS;
      b.airburstBypassShield = true;
      b.ttlSec = 0;
      sim.triggerLauncherProjectileExplosion(b, b.x, b.y);
    }
  }
}

/**
 * Spawns 5 Frag Launcher submunitions (6 DMG each, max 2 hits per target from the same grenade).
 */
export function spawnFragLauncherSubmunitions(
  sim: WorldSim,
  b: SimProjectileState,
  x: number,
  y: number,
): void {
  const explosionId = ++sim.nextEntityId;
  let targetAngle = b.angle;
  let nearestDist = 140;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
    const d = distance(x, y, e.x, e.y);
    if (d < nearestDist) {
      nearestDist = d;
      if (d > 1e-4) {
        targetAngle = Math.atan2(e.y - y, e.x - x);
      }
    }
  }

  const subVolley: BulletVolleySpawnEvent = {
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: b.ownerId,
    team: 'player',
    weaponId: 'frag_launcher_sub',
    x,
    y,
    angle: targetAngle,
    pelletCount: FRAG_LAUNCHER_SUB_COUNT,
    spreadRad: 0.65,
    speed: 340,
    damage: FRAG_LAUNCHER_SUB_DMG,
    radius: 10,
    knockback: 60,
    pierceCount: 2,
    bounceCount: 0,
    ttlSec: 0.35,
    element: 'none',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    airburstBypassShield: Boolean(b.airburstBypassShield),
    parentExplosionId: explosionId,
  };
  sim.spawnDeterministicVolley(subVolley, true);
}

export function canApplyFragSubmunitionHit(
  b: SimProjectileState,
  enemy: SimEnemyState,
): boolean {
  if (b.weaponId !== 'frag_launcher_sub') return true;
  const expId = b.parentExplosionId ?? 0;
  enemy.submunitionHitsByExplosion ??= {};
  const hits = enemy.submunitionHitsByExplosion[expId] ?? 0;
  if (hits >= FRAG_LAUNCHER_MAX_SUB_HITS_PER_TARGET) {
    return false;
  }
  enemy.submunitionHitsByExplosion[expId] = hits + 1;
  return true;
}

const _hitDmgAngleScratch = { damage: 0, hitAngle: 0 };

export function resolvePlayerProjectileHitDamageAndAngle(
  sim: WorldSim,
  b: SimProjectileState,
  enemy: SimEnemyState,
): { damage: number; hitAngle: number } {
  let damage = b.damage;
  if (b.weaponId === 'scrap_shotgun') {
    const owner = sim.getPlayerById(b.ownerId) ?? sim.player;
    const origX = b.originX ?? owner.x;
    const origY = b.originY ?? owner.y;
    if (distance(origX, origY, enemy.x, enemy.y) <= SCRAP_SHOTGUN_POINT_BLANK_DIST) {
      damage = Math.round(b.damage * SCRAP_SHOTGUN_POINT_BLANK_MULT);
    }
  }
  _hitDmgAngleScratch.damage = damage;
  _hitDmgAngleScratch.hitAngle = b.airburstBypassShield ? enemy.aimAngle : b.angle;
  return _hitDmgAngleScratch;
}



