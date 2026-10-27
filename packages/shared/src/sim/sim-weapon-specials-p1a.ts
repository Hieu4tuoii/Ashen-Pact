import { distance } from '../math/vec2.js';
import { SHOT_FLAG } from '../protocol/messages.js';
import { resolveEnemyChasmRingOut } from './sim-tactical-physics.js';
import {
  detonatePlayerMagneticRivets,
  plantMagneticRivet,
  triggerTeslaFinaleChainLightning,
} from './sim-weapon-specials.js';
import type {
  SimEnemyState,
  SimPlayerState,
  SimProjectileState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const CROSSBOW_MAX_STUCK_ARROWS = 4;
export const CROSSBOW_RIP_DMG_PER_ARROW = 6;
export const CROSSBOW_RIP_SLOW_SEC = 1.5;

export const THORN_STAFF_MAX_THORNS = 5;
export const THORN_STAFF_BLOOM_DMG_PER_THORN = 7;
export const THORN_STAFF_FINALE_PULL_DIST = 90;

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
  if (lenSq <= 1e-6) {
    return distance(px, py, x1, y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

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

  if (b.weaponId === 'seed_gun') {
    sim.spawnSeedGunLifeBlossom(b.ownerId, b.x, b.y);
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

  if (b.weaponId === 'seed_gun') {
    sim.spawnSeedGunLifeBlossom(b.ownerId, hitX, hitY);
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

