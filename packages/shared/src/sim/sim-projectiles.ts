import { BIOME_SCALING } from '../data/scaling.js';
import { angleDiff, circleVsCircle, distance } from '../math/vec2.js';
import { SHOT_FLAG, TILE_SIZE } from '../protocol/messages.js';
import { clampBounceCount, clampPelletsPerTrigger } from './sim-damage-pipeline.js';
import {
  applyBulletModBlessingsOnVolleySpawn, clearEnemyBulletsAlongPhaseBlade,
  applyPlayerProjectileMidFlightSynergiesAndBlessings, tryDetonateThunderDecoyOnEnemyBullet,
  handlePlayerProjectileBarricadeHitBlessings, shouldCatchReturnedOrbitProjectile, tryHoldClientOrbitReturnAtMaxRange, tryRedirectProjectileOrbitReturnOnExpiry,
  handlePlayerProjectileWallHitBlessingsAndSkills,
  refractProjectileThroughPrismBarricade,
  tryBlockOrReflectEnemyProjectileByVanguardShield,
  updateTableTechRocketProjectilesInFlight,
} from './sim-blessings.js';
import { spawnSeedGunLifeBlossomImpl, triggerLauncherProjectileExplosionImpl } from './sim-player.js';
import { setActiveDuoReactionWeaponId, tryBouncePlasmaOverloadStarOnWall, tryHoldSuperconductRailClient, tryRedirectSuperconductRailServer } from './sim-duo-boons.js';
import { refractEnemyProjectileThroughCryoPrism } from './sim-enemies-tactical-ai.js';
import { tryChargeGlacialBarricadeWithCryoLaser } from './sim-boss-armor-break.js';
import { refractProjectileThroughCryoPrism } from './sim-tactical-physics-p1c.js';
import {
  canApplyFragSubmunitionHit,
  copyLegendaryVolleyFieldsToProjectile,
  detonatePlayerMagneticRivets,
  handlePlayerProjectileEnemyHitWeaponSpecials,
  handleProjectileExpiredWeaponSpecials,
  handleProjectileWallHitWeaponSpecials,
  plantMagneticRivet,
  resolvePlayerProjectileHitDamageAndAngle,
  tryTeslaSmartWallBounce,
  updateEmeraldCleaverBoomerang,
  updateLegendaryProjectileInFlight,
  updateVoidStaffOrbInFlight,
} from './sim-weapon-specials.js';
import {
  applyWeaponMutatorsOnEnemyHit,
  detonateClusterMortarOnImpact,
  shouldClusterMortarSkipCoverProp,
  stepBoomerangCoreSawCosmetic,
  stepBoomerangCoreSawProjectile,
} from './sim-weapon-mutators.js';
import {
  type BulletVolleySpawnEvent,
  MAX_ENEMY_PROJECTILES,
  MAX_PLAYER_PROJECTILES,
  type SimProjectileState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export { spawnSeedGunLifeBlossomImpl, triggerLauncherProjectileExplosionImpl };

function pushImpactEvent(
  sim: WorldSim,
  x: number,
  y: number,
  angle: number,
  team: 'player' | 'enemy',
  hitWall: boolean,
  blockedByShield: boolean,
  isCrit: boolean,
  element?: SimProjectileState['element'],
): void {
  sim.events.push({
    kind: 'projectile_impact',
    x,
    y,
    angle,
    team,
    hitWall,
    destroyedByMelee: false,
    blockedByShield,
    isCrit,
    ...(element !== undefined ? { element } : {}),
  });
}

export function spawnDeterministicVolleyImpl(this: WorldSim, ev: BulletVolleySpawnEvent, emitEvents = true): void {
  if (ev.eventId === undefined || ev.eventId <= 0) {
    ev.eventId = this.nextVolleyEventId++;
  }
  applyBulletModBlessingsOnVolleySpawn(this, ev);
  const resolvedFlags = ev.shotFlags ?? ev.flags ?? 0;
  ev.shotFlags = resolvedFlags;
  ev.flags = resolvedFlags;
  this.volleyRng.setState(ev.seed || 0x6d2b79f5);
  const volleyRng = this.volleyRng;
  let pellets = ev.team === 'player' ? clampPelletsPerTrigger(ev.pelletCount) : Math.max(1, ev.pelletCount);
  let spreadRad = ev.spreadRad;
  let radialStepRad = ev.radialStepRad;
  let speed = ev.speed;

  if (ev.team === 'enemy') {
    const biomeScale = BIOME_SCALING[this.currentBiome] ?? BIOME_SCALING[1];
    if (ev.weaponId !== 'vengeful_ring' && ev.weaponId !== 'ashen_executioner_wave') {
      speed = Math.min(390, Math.round(speed * biomeScale.projectileSpeedMultiplier));
    }
    const ownerEnemy = this.enemies.find((e) => e.id === ev.ownerId);
    if (ownerEnemy?.isElite && ownerEnemy.eliteModifier === 'volley') {
      pellets += 2;
      if (radialStepRad !== undefined && radialStepRad !== 0) {
        radialStepRad = (Math.PI * 2) / pellets;
      } else if (spreadRad < 0.36) {
        spreadRad = Math.max(0.36, spreadRad * 2);
      }
    }
  }

  if (emitEvents && !this.stressTestActive) {
    this.events.push(ev);
  }

  const teamCap = ev.team === 'player' ? MAX_PLAYER_PROJECTILES : MAX_ENEMY_PROJECTILES;

  for (let i = 0; i < pellets; i++) {
    let shotAngle = ev.angle;
    if (radialStepRad !== undefined && radialStepRad !== 0) {
      shotAngle = ev.angle + i * radialStepRad;
    } else if (pellets > 1) {
      const t = i / (pellets - 1) - 0.5;
      const jitter =
        ev.team === 'player' ? volleyRng.nextFloat(-spreadRad * 0.12, spreadRad * 0.12) : 0;
      shotAngle = ev.angle + t * spreadRad + jitter;
    } else if (spreadRad > 0) {
      shotAngle = ev.angle + volleyRng.nextFloat(-spreadRad * 0.5, spreadRad * 0.5);
    }

    const bx =
      ev.muzzleOffset && ev.muzzleOffset > 0
        ? ev.x + Math.cos(shotAngle) * ev.muzzleOffset
        : ev.x;
    const by =
      ev.muzzleOffset && ev.muzzleOffset > 0
        ? ev.y + Math.sin(shotAngle) * ev.muzzleOffset
        : ev.y;

    let isCrit = false;
    let finalDmg = ev.damage;
    if (ev.critChance >= 1) {
      isCrit = true;
    } else if (ev.critChance > 0) {
      isCrit = volleyRng.chance(ev.critChance);
      if (isCrit) {
        finalDmg = Math.round(ev.damage * 1.5);
      }
    }

    if (!this.stressTestActive && this.projectiles.length >= teamCap) {
      let teamCount = 0;
      let oldestTeamIdx = -1;
      for (let pIdx = 0; pIdx < this.projectiles.length; pIdx++) {
        if (this.projectiles[pIdx]!.team === ev.team) {
          if (oldestTeamIdx === -1) oldestTeamIdx = pIdx;
          teamCount++;
        }
      }
      if (teamCount >= teamCap && oldestTeamIdx >= 0) {
        const [evicted] = this.projectiles.splice(oldestTeamIdx, 1);
        if (evicted) {
          evicted.ttlSec = 0;
          evicted.hitEntityIds.length = 0;
          this.projectilePool.push(evicted);
        }
      }
    }

    const deterministicId = (((ev.eventId ?? 1) & 0x3fffff) << 6) | (i & 0x3f);

    const proj = this.acquireProjectile({
      id: deterministicId, ownerId: ev.ownerId, team: ev.team, weaponId: ev.weaponId,
      x: bx, y: by, vx: Math.cos(shotAngle) * speed, vy: Math.sin(shotAngle) * speed, angle: shotAngle,
      radius: ev.radius, damage: finalDmg, isCrit, knockback: ev.knockback,
      pierceRemaining: ev.pierceCount,
      bounceRemaining: ev.team === 'player' ? clampBounceCount(ev.bounceCount) : ev.bounceCount,
      ttlSec: ev.ttlSec,
      element: ev.element, amplifiedByShield: ev.amplifiedByShield, shotFlags: ev.shotFlags ?? 0,
      splitGeneration: ev.splitGeneration ?? 0, awaitingServerRedirectTimer: 0, explosionRadius: ev.explosionRadius,
      guaranteedElementalProc: ev.guaranteedElementalProc, originX: ev.originX, originY: ev.originY,
      armedForAirburst: ev.armedForAirburst, airburstBypassShield: ev.airburstBypassShield,
      parentExplosionId: ev.parentExplosionId, firedWhileHoldingFire: ev.firedWhileHoldingFire,
      gravitySingularityShot: ev.gravitySingularityShot,
      chainHarpoonShot: ev.chainHarpoonShot,
      bypassFrontShield: ev.bypassFrontShield,
      bouncesDone: ev.bouncesDone ?? 0, orbitReturned: Boolean(ev.orbitReturned), boomerangPhase: ev.boomerangPhase,
      clusterMortarLob: (ev.splitGeneration ?? 0) === 0 ? ev.clusterMortarLob : undefined, secondaryInfusedElement: ev.secondaryInfusedElement, superconductRailRedirected: Boolean(ev.superconductRailRedirected),
    });
    copyLegendaryVolleyFieldsToProjectile(ev, proj);
    this.projectiles.push(proj);

    if (emitEvents && !this.stressTestActive) {
      this.events.push({
        kind: 'projectile_spawned', projectileId: proj.id, weaponId: ev.weaponId, team: ev.team, x: bx, y: by, angle: shotAngle,
      });
    }
  }
}

const midFlightDestroyedScratch: number[] = [];

export function updateProjectilesImpl(this: WorldSim, dtSec: number): void {
  if (this.projectiles.length === 0) return;
  this.rebuildEnemySpatialGrid();
  const allPlayers = this.getAllPlayers();
  let stressImpactEventsThisTick = 0;
  midFlightDestroyedScratch.length = 0;
  let hasAliveProps = false;
  let hasActiveVanguardShield = false;
  let hasArcRelayBlessing = false;
  if (!this.stressTestActive) {
    for (let k = 0; k < this.props.length; k++) {
      if (this.props[k]!.hp > 0) {
        hasAliveProps = true;
        break;
      }
    }
    for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
      const pl = allPlayers[pIdx]!;
      if (pl.lifeState === 'alive' && pl.characterId === 'vanguard' && pl.skillActiveTimer > 0) {
        hasActiveVanguardShield = true;
      }
      if (pl.blessingIds.length > 0 && pl.blessingIds.includes('bullet_coop_arc_relay')) {
        hasArcRelayBlessing = true;
      }
    }
  }
  const hasMidFlightSynergy =
    hasActiveVanguardShield ||
    hasArcRelayBlessing ||
    this.skillZones.length > 0 ||
    this.summons.length > 0;

  for (let i = 0; i < this.projectiles.length; i++) {
    const b = this.projectiles[i]!;
    if (b.ttlSec <= 0) continue;

    b.ttlSec -= dtSec;
    if (b.ttlSec <= 0) {
      if (b.element !== 'none') {
        this.applyElementAtWorldPoint(b.x, b.y, b.element, 20);
      }
      if (!tryRedirectProjectileOrbitReturnOnExpiry(this, b)) {
        detonateClusterMortarOnImpact(this, b, b.x, b.y);
        handleProjectileExpiredWeaponSpecials(this, b);
      }
      continue;
    }

    if (b.weaponId === 'emerald_cleaver_boomerang') {
      updateEmeraldCleaverBoomerang(this, b, dtSec);
      continue;
    }
    if (b.weaponId === 'mutator_boomerang_saw') {
      stepBoomerangCoreSawProjectile(this, b, dtSec);
      continue;
    }

    if (b.weaponId === 'table_tech_rocket') {
      updateTableTechRocketProjectilesInFlight(this, b, dtSec);
    }
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx * dtSec;
    b.y += b.vy * dtSec;
    if (b.team === 'player' && tryRedirectSuperconductRailServer(this, b)) continue;
    if (updateLegendaryProjectileInFlight(this, b, dtSec)) continue;
    // Elemental projectiles flying over interactive surfaces can ignite/freeze/electrify them!
    if (
      !this.stressTestActive &&
      (b.element === 'burn' || b.element === 'chill' || b.element === 'shock')
    ) {
      const surfUnder = this.map.getSurfaceAtWorld(b.x, b.y);
      if (
        (b.element === 'burn' &&
          (surfUnder === 'oil' || surfUnder === 'grass' || surfUnder === 'ice')) ||
        (b.element === 'chill' && (surfUnder === 'water' || surfUnder === 'burning_oil')) ||
        (b.element === 'shock' && surfUnder === 'water')
      ) {
        this.applyElementAtWorldPoint(b.x, b.y, b.element, 18);
      }
    }

    // 1. Check wall/pillar collision
    const wallHit = this.map.checkProjectileWallHit(b.x, b.y, b.radius);
    if (wallHit.hit && b.weaponId !== 'ashen_executioner_wave') {
      if (
        wallHit.hitTx >= 0 &&
        this.map.getTile(wallHit.hitTx, wallHit.hitTy) === 'cracked_wall' &&
        (b.isCrit || b.element === 'burn')
      ) {
        if (this.map.destroyCrackedWall(wallHit.hitTx, wallHit.hitTy)) {
          this.secretWallBroken = true;
          this.rebuildCurrentRoomDoors();
          this.events.push({
            kind: 'cracked_wall_broken',
            tx: wallHit.hitTx,
            ty: wallHit.hitTy,
            x: wallHit.hitTx * TILE_SIZE + 16,
            y: wallHit.hitTy * TILE_SIZE + 16,
          });
        }
      }

      if (b.clusterMortarLob && (b.splitGeneration ?? 0) === 0) {
        b.ttlSec = 0;
        if (b.element !== 'none') {
          this.applyElementAtWorldPoint(wallHit.resolvedX, wallHit.resolvedY, b.element, 24);
        }
        detonateClusterMortarOnImpact(this, b, wallHit.resolvedX, wallHit.resolvedY);
        handleProjectileWallHitWeaponSpecials(this, b, wallHit.resolvedX, wallHit.resolvedY);
        if (!this.stressTestActive || stressImpactEventsThisTick < 3) {
          stressImpactEventsThisTick += 1;
          pushImpactEvent(this, wallHit.resolvedX, wallHit.resolvedY, b.angle, b.team, true, false, b.isCrit, b.element);
        }
        continue;
      }

      if (b.team === 'player' && tryBouncePlasmaOverloadStarOnWall(this, b, wallHit.resolvedX, wallHit.resolvedY, wallHit.normalX, wallHit.normalY)) continue;
      if (
        handlePlayerProjectileWallHitBlessingsAndSkills(
          this,
          b,
          wallHit.resolvedX,
          wallHit.resolvedY,
          wallHit.normalX,
          wallHit.normalY,
        )
      ) {
        continue;
      }

      if (
        b.team === 'player' &&
        tryTeslaSmartWallBounce(
          this,
          b,
          wallHit.resolvedX,
          wallHit.resolvedY,
          wallHit.normalX,
          wallHit.normalY,
        )
      ) {
        continue;
      }

      if (b.bounceRemaining > 0) {
        b.bounceRemaining -= 1;
        b.bouncesDone = (b.bouncesDone ?? 0) + 1;
        b.x = wallHit.resolvedX;
        b.y = wallHit.resolvedY;
        if (wallHit.normalX !== 0) b.vx = -b.vx;
        if (wallHit.normalY !== 0) b.vy = -b.vy;
        b.angle = Math.atan2(b.vy, b.vx);
        if (b.weaponId === 'frag_launcher') {
          b.ttlSec = Math.min(b.ttlSec, 0.22);
        }
      } else {
        b.ttlSec = 0;
        if (b.element !== 'none') {
          this.applyElementAtWorldPoint(wallHit.resolvedX, wallHit.resolvedY, b.element, 24);
        }
        detonateClusterMortarOnImpact(this, b, wallHit.resolvedX, wallHit.resolvedY);
        handleProjectileWallHitWeaponSpecials(this, b, wallHit.resolvedX, wallHit.resolvedY);
        if (!this.stressTestActive || stressImpactEventsThisTick < 3) {
          stressImpactEventsThisTick += 1;
          pushImpactEvent(this, wallHit.resolvedX, wallHit.resolvedY, b.angle, b.team, true, false, b.isCrit, b.element);
        }
        continue;
      }
    }

    // 2. Check destructible / refractive props collision
    if (hasAliveProps) {
      let hitProp = false;
      for (let k = 0; k < this.props.length; k++) {
        const prop = this.props[k]!;
        if (prop.hp <= 0 || shouldClusterMortarSkipCoverProp(b, prop)) continue;
        // Boss Kryssa's ice laser refracts off indestructible Crystal Pillars toward the nearest player!
        if (prop.kind === 'crystal_pillar' && circleVsCircle(b, prop)) {
          if (!b.hitEntityIds.includes(prop.id)) {
            b.hitEntityIds.push(prop.id);
            b.passedThroughCoverOrPrism = true;
            b.bouncesDone = (b.bouncesDone ?? 0) + 1;
            prop.hitFlashTimer = 0.16;
            const spd = Math.hypot(b.vx, b.vy) || 350;
            const nearestPl = this.findNearestAlivePlayer(prop.x, prop.y);
            const refractAng =
              b.weaponId === 'kryssa_ice_beam'
                ? Math.atan2(nearestPl.y - prop.y, nearestPl.x - prop.x)
                : b.angle + Math.PI * 0.65;
            b.angle = refractAng;
            b.vx = Math.cos(refractAng) * spd;
            b.vy = Math.sin(refractAng) * spd;
            b.x = prop.x + Math.cos(refractAng) * (prop.radius + b.radius + 3);
            b.y = prop.y + Math.sin(refractAng) * (prop.radius + b.radius + 3);
            b.ttlSec = Math.max(b.ttlSec, 1.4);
          }
          continue;
        }
        if (!prop.destructible || prop.coverState === 'sliding') continue;
        if (prop.kind === 'cryo_prism_pillar' && circleVsCircle(b, prop)) {
          if (b.team === 'player') {
            if (refractProjectileThroughCryoPrism(this, b, prop) && b.ttlSec <= 0) {
              hitProp = true;
              break;
            }
            continue;
          }
          if (refractEnemyProjectileThroughCryoPrism(this, b, prop) && b.ttlSec <= 0) {
            hitProp = true;
            break;
          }
          continue;
        }
        if (prop.blocksEnemyProjectiles && b.team === 'player') {
          if (!b.hitEntityIds.includes(prop.id) && circleVsCircle(b, prop)) {
            if (handlePlayerProjectileBarricadeHitBlessings(this, b, prop) && b.ttlSec <= 0) {
              hitProp = true;
              break;
            }
            if (refractProjectileThroughPrismBarricade(this, b, prop) && b.ttlSec <= 0) {
              hitProp = true;
              break;
            }
            b.passedThroughCoverOrPrism = true;
            b.bouncesDone = (b.bouncesDone ?? 0) + 1;
          }
          continue;
        }
        if (
          b.team === 'enemy' &&
          prop.coverState === 'flipped' &&
          (prop.microBlankTimer ?? 0) > 0 &&
          distance(b.x, b.y, prop.x, prop.y) <= (prop.microBlankRadius ?? 56) + b.radius
        ) {
          tryChargeGlacialBarricadeWithCryoLaser(prop, b.weaponId);
          b.ttlSec = 0;
          hitProp = true;
          break;
        }
        if (!b.hitEntityIds.includes(prop.id) && circleVsCircle(b, prop)) {
          prop.fallAngle = b.angle;
          if (b.team === 'player') prop.lastDamagedByPlayerId = b.ownerId;
          if (b.team === 'enemy') tryChargeGlacialBarricadeWithCryoLaser(prop, b.weaponId);
          this.damageProp(prop, b.damage, b.element);
          if (b.weaponId === 'void_staff') continue;
          if (b.team === 'player' && b.weaponId === 'rivet_gun') {
            plantMagneticRivet(this, b.ownerId, b.x, b.y, null, prop.id);
            if (((b.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT) !== 0) {
              detonatePlayerMagneticRivets(this, b.ownerId, false);
            }
          }
          b.ttlSec = 0;
          hitProp = true;
          pushImpactEvent(this, b.x, b.y, b.angle, b.team, false, false, b.isCrit, b.element);
          break;
        }
      }
      if (hitProp) continue;
    }

    // 3. Player projectile vs Allies/Synergies & Enemies
    if (b.team === 'player') {
      if (b.orbitReturned && shouldCatchReturnedOrbitProjectile(this, b, midFlightDestroyedScratch)) continue;
      if (b.weaponId === 'dash_phase_blade') clearEnemyBulletsAlongPhaseBlade(this, b, midFlightDestroyedScratch);
      if (
        hasMidFlightSynergy &&
        applyPlayerProjectileMidFlightSynergiesAndBlessings(
          this,
          b,
          allPlayers,
          hasArcRelayBlessing,
          hasActiveVanguardShield,
        )
      ) {
        continue;
      }

      if (b.weaponId === 'void_staff') {
        updateVoidStaffOrbInFlight(this, b, dtSec);
        continue;
      }

      const candidates = this.enemySpatialGrid.queryCircle(
        b.x,
        b.y,
        b.radius,
        this.queryEnemyScratch,
      );
      for (let j = 0; j < candidates.length; j++) {
        const enemy = candidates[j]!;
        if (
          enemy.hp <= 0 ||
          enemy.defId === 'ashen_executioner' ||
          enemy.aiState === 'spawning' ||
          enemy.bossBurrowed
        ) {
          continue;
        }
        if (b.hitEntityIds.includes(enemy.id)) continue;

        if (circleVsCircle(b, enemy)) {
          b.hitEntityIds.push(enemy.id);
          if (!canApplyFragSubmunitionHit(b, enemy)) {
            continue;
          }

          // Predator Arrow skill marks the target for 6s (+25% damage from all sources)
          if (b.weaponId === 'predator_arrow') {
            enemy.markedTimer = 6.0;
            enemy.markedByPlayerId = b.ownerId;
            if (!this.stressTestActive) {
              this.events.push({
                kind: 'status_applied',
                targetId: enemy.id,
                status: 'marked',
                x: enemy.x,
                y: enemy.y,
              });
            }
          }

          let effectiveAttackerId = b.ownerId;
          let hitDmg = 0;
          setActiveDuoReactionWeaponId(b.weaponId);
          try {
            if (b.imbuedByZone) {
              const zoneOwnerId = b.imbuedOwnerId ?? b.ownerId;
              if (b.imbuedElement && b.imbuedElement !== 'none') {
                this.applyElementStatusToEnemy(enemy, b.imbuedElement, b.damage, zoneOwnerId);
              }
              if (b.imbuedSecondaryElement && b.imbuedSecondaryElement !== 'none') {
                this.applyElementStatusToEnemy(
                  enemy,
                  b.imbuedSecondaryElement,
                  b.damage,
                  zoneOwnerId,
                );
              }
            }

            effectiveAttackerId =
              b.imbuedByZone &&
              b.imbuedOwnerId &&
              !b.imbuedElement &&
              enemy.lastElementOwnerId === b.ownerId &&
              b.imbuedOwnerId !== b.ownerId
                ? b.imbuedOwnerId
                : b.ownerId;

            const resolvedHit = resolvePlayerProjectileHitDamageAndAngle(this, b, enemy);
            hitDmg = resolvedHit.damage;
            this.applyDamageToEnemy(
              enemy,
              hitDmg,
              b.isCrit,
              b.element,
              resolvedHit.hitAngle,
              b.knockback,
              b.weaponId === 'predator_arrow' ||
                b.weaponId === 'ruby_sword_wave' ||
                b.weaponId === 'knight_sword_wave' ||
                b.weaponId === 'frag_launcher' ||
                b.weaponId === 'magma_cannon',
              effectiveAttackerId,
              false,
              b.procCoefficient ?? 1.0,
              false,
            );
          } finally {
            setActiveDuoReactionWeaponId(undefined);
          }

          handlePlayerProjectileEnemyHitWeaponSpecials(this, b, enemy);
          applyWeaponMutatorsOnEnemyHit(this, b, enemy, hitDmg, effectiveAttackerId);

          if (!this.stressTestActive || stressImpactEventsThisTick < 4) {
            stressImpactEventsThisTick += 1;
            pushImpactEvent(this, b.x, b.y, b.angle, 'player', false, false, b.isCrit, b.element);
            if (!this.stressTestActive) {
              this.events.push({
                kind: 'hit_stop',
                durationMs: b.isCrit ? 45 : 30,
                trauma: b.isCrit ? 0.28 : 0.14,
              });
            }
          }

          if (b.pierceRemaining > 0) {
            b.pierceRemaining -= 1;
          } else {
            b.ttlSec = 0;
            break;
          }
        }
      }
    } else {
      // 4. Enemy projectile vs Vanguard Shield, Druid Sacred Tree, or any alive Player
      if (
        hasActiveVanguardShield &&
        tryBlockOrReflectEnemyProjectileByVanguardShield(this, b, allPlayers, midFlightDestroyedScratch)
      ) {
        continue;
      }

      // Check Sacred Tree blocking enemy projectiles
      if (this.summons.length > 0) {
        if (tryDetonateThunderDecoyOnEnemyBullet(this, b)) continue;
        let blockedBySummon = false;
        for (let sIdx = 0; sIdx < this.summons.length; sIdx++) {
          const sum = this.summons[sIdx]!;
          if (
            (sum.kind === 'sacred_tree' || sum.kind === 'tesla_turret') &&
            sum.hp > 0 &&
            sum.ttlSec > 0
          ) {
            if (circleVsCircle(b, sum)) {
              b.ttlSec = 0;
              midFlightDestroyedScratch.push(b.id);
              sum.hp = Math.max(0, sum.hp - b.damage * (sum.kind === 'tesla_turret' ? 3 : 1));
              pushImpactEvent(this, b.x, b.y, b.angle, 'enemy', false, true, false);
              blockedBySummon = true;
              break;
            }
          }
        }
        if (blockedBySummon) continue;
      }

      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const pl = allPlayers[pIdx]!;
        if (pl.lifeState !== 'alive' || b.hitEntityIds.includes(pl.id)) continue;
        if (circleVsCircle(b, pl)) {
          b.hitEntityIds.push(pl.id);
          if (b.pierceRemaining > 0 && b.weaponId !== 'dwarf_mortar') {
            b.pierceRemaining -= 1;
          } else {
            b.ttlSec = 0;
          }
          let damaged = false;
          if (b.weaponId === 'dwarf_mortar') {
            damaged = pl.invulnerableTimer <= 0 && !pl.godMode;
            this.triggerLauncherProjectileExplosion(b, pl.x, pl.y);
          } else {
            damaged = this.applyDamageToPlayer(b.damage, b.angle, b.knockback, b.weaponId, pl);
          }
          if (damaged) {
            if (b.element === 'chill') {
              pl.chillTimer = Math.max(pl.chillTimer, 2.0);
            } else if (b.element === 'burn') {
              pl.burnTimer = Math.max(pl.burnTimer, 1.6);
            }
          }
          if (!this.stressTestActive) {
            pushImpactEvent(this, b.x, b.y, b.angle, 'enemy', false, false, false);
          }
          break;
        }
      }
    }
  }

  if (midFlightDestroyedScratch.length > 0 && !this.stressTestActive) {
    this.events.push({
      kind: 'projectiles_destroyed',
      ids: midFlightDestroyedScratch.slice(),
    });
  }

  let projWriteIdx = 0;
  for (let i = 0; i < this.projectiles.length; i++) {
    const b = this.projectiles[i]!;
    if (b.ttlSec > 0) {
      this.projectiles[projWriteIdx++] = b;
    } else {
      b.hitEntityIds.length = 0;
      this.projectilePool.push(b);
    }
  }
  this.projectiles.length = projWriteIdx;
}

export function stepClientProjectilesCosmeticImpl(this: WorldSim, dtSec: number): void {
  if (this.projectiles.length === 0) return;

  this.rebuildEnemySpatialGrid();
  const allPlayers = this.getAllPlayers();

  for (let i = 0; i < this.projectiles.length; i++) {
    const b = this.projectiles[i]!;
    if (b.ttlSec <= 0) continue;

    b.prevX = b.x;
    b.prevY = b.y;

    if ((b.awaitingServerRedirectTimer ?? 0) > 0) {
      b.awaitingServerRedirectTimer = Math.max(0, (b.awaitingServerRedirectTimer ?? 0) - dtSec);
      if (b.awaitingServerRedirectTimer <= 0) {
        b.ttlSec = 0;
      }
      continue;
    }

    b.ttlSec -= dtSec;
    if (b.ttlSec <= 0 && !tryHoldClientOrbitReturnAtMaxRange(this, b)) continue;
    if (b.weaponId === 'mutator_boomerang_saw') { stepBoomerangCoreSawCosmetic(this, b, dtSec); continue; }

    b.x += b.vx * dtSec;
    b.y += b.vy * dtSec;
    if (b.orbitReturned && shouldCatchReturnedOrbitProjectile(this, b)) continue;
    if (b.team === 'player' && tryHoldSuperconductRailClient(this, b)) continue;

    // 1. Wall / Pillar collision & ricochet bounce
    const wallHit = this.map.checkProjectileWallHit(b.x, b.y, b.radius);
    if (wallHit.hit) {
      if (((b.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE) !== 0) {
        b.x = wallHit.resolvedX;
        b.y = wallHit.resolvedY;
        b.vx = 0;
        b.vy = 0;
        b.awaitingServerRedirectTimer = 0.12;
        continue;
      }
      if (b.bounceRemaining > 0) {
        b.bounceRemaining -= 1;
        b.x = wallHit.resolvedX;
        b.y = wallHit.resolvedY;
        if (wallHit.normalX !== 0) b.vx = -b.vx;
        if (wallHit.normalY !== 0) b.vy = -b.vy;
        b.angle = Math.atan2(b.vy, b.vx);
        if (b.weaponId === 'frag_launcher') {
          b.ttlSec = Math.min(b.ttlSec, 0.22);
        }
      } else {
        b.ttlSec = 0;
        pushImpactEvent(this, wallHit.resolvedX, wallHit.resolvedY, b.angle, b.team, true, false, b.isCrit, b.element);
        continue;
      }
    }

    // 2. Destructible prop cosmetic hit prediction
    if (this.props.length > 0) {
      let hitProp = false;
      for (let k = 0; k < this.props.length; k++) {
        const prop = this.props[k]!;
        if (prop.hp <= 0 || shouldClusterMortarSkipCoverProp(b, prop)) continue;
        if (prop.kind === 'crystal_pillar' && circleVsCircle(b, prop)) {
          if (((b.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE) !== 0) {
            b.vx = 0;
            b.vy = 0;
            b.awaitingServerRedirectTimer = 0.12;
            hitProp = true;
            break;
          }
          continue;
        }
        if (!prop.destructible || prop.coverState === 'sliding') continue;
        if (prop.blocksEnemyProjectiles && b.team === 'player') {
          if (prop.prismAuraActive && circleVsCircle(b, prop) && ((b.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE) !== 0) {
            b.vx = 0; b.vy = 0; b.awaitingServerRedirectTimer = 0.12; hitProp = true; break;
          }
          continue;
        }
        if (
          b.team === 'enemy' &&
          prop.coverState === 'flipped' &&
          (prop.microBlankTimer ?? 0) > 0 &&
          distance(b.x, b.y, prop.x, prop.y) <= (prop.microBlankRadius ?? 56) + b.radius
        ) {
          b.ttlSec = 0; hitProp = true; break;
        }
        if (!b.hitEntityIds.includes(prop.id) && circleVsCircle(b, prop)) {
          if (((b.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE) !== 0) {
            b.vx = 0;
            b.vy = 0;
            b.awaitingServerRedirectTimer = 0.12;
            hitProp = true;
            break;
          }
          prop.hitFlashTimer = Math.max(prop.hitFlashTimer, 0.1);
          b.ttlSec = 0;
          hitProp = true;
          pushImpactEvent(this, b.x, b.y, b.angle, b.team, false, false, b.isCrit, b.element);
          break;
        }
      }
      if (hitProp) continue;
    }

    // 3. Player projectile vs Enemy cosmetic hit prediction
    if (b.team === 'player') {
      if (b.weaponId === 'void_staff') continue;

      const candidates = this.enemySpatialGrid.queryCircle(
        b.x,
        b.y,
        b.radius,
        this.queryEnemyScratch,
      );
      for (let j = 0; j < candidates.length; j++) {
        const enemy = candidates[j]!;
        if (
          enemy.hp <= 0 ||
          enemy.defId === 'ashen_executioner' ||
          enemy.aiState === 'spawning' ||
          enemy.bossBurrowed
        ) {
          continue;
        }
        if (b.hitEntityIds.includes(enemy.id)) continue;

        if (circleVsCircle(b, enemy)) {
          b.hitEntityIds.push(enemy.id);
          enemy.hitFlashTimer = Math.max(enemy.hitFlashTimer, 0.12);
          this.events.push({
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

          if (b.pierceRemaining > 0) {
            b.pierceRemaining -= 1;
          } else {
            b.ttlSec = 0;
            break;
          }
        }
      }
    } else {
      // 4. Enemy projectile vs Vanguard shield or alive Player cosmetic hit prediction
      let blocked = false;
      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const pl = allPlayers[pIdx]!;
        if (pl.lifeState !== 'alive') continue;
        if (pl.characterId === 'vanguard' && pl.skillActiveTimer > 0) {
          const shieldRadius = 38;
          const dToPlayer = distance(b.x, b.y, pl.x, pl.y);
          if (dToPlayer <= shieldRadius + b.radius && dToPlayer >= pl.radius * 0.5) {
            const angleFromPlayer = Math.atan2(b.y - pl.y, b.x - pl.x);
            const halfShieldArc = pl.blessingIds.includes('vanguard_bastion_prism')
              ? Math.PI
              : (60 * Math.PI) / 180;
            if (Math.abs(angleDiff(angleFromPlayer, pl.aimAngle)) <= halfShieldArc) {
              b.ttlSec = 0;
              this.events.push({
                kind: 'projectile_impact',
                x: b.x,
                y: b.y,
                angle: b.angle,
                team: 'enemy',
                hitWall: false,
                destroyedByMelee: false,
                blockedByShield: true,
                isCrit: false,
              });
              blocked = true;
              break;
            }
          }
        }
      }
      if (blocked) continue;

      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const pl = allPlayers[pIdx]!;
        if (pl.lifeState !== 'alive' || b.hitEntityIds.includes(pl.id)) continue;
        if (circleVsCircle(b, pl)) {
          b.hitEntityIds.push(pl.id);
          if (b.pierceRemaining > 0 && b.weaponId !== 'dwarf_mortar') {
            b.pierceRemaining -= 1;
          } else {
            b.ttlSec = 0;
          }
          this.events.push({
            kind: 'projectile_impact',
            x: b.x,
            y: b.y,
            angle: b.angle,
            team: 'enemy',
            hitWall: false,
            destroyedByMelee: false,
            blockedByShield: false,
            isCrit: false,
          });
          break;
        }
      }
    }
  }

  let projWriteIdx = 0;
  for (let i = 0; i < this.projectiles.length; i++) {
    const b = this.projectiles[i]!;
    if (b.ttlSec > 0) {
      this.projectiles[projWriteIdx++] = b;
    } else {
      b.hitEntityIds.length = 0;
      this.projectilePool.push(b);
    }
  }
  this.projectiles.length = projWriteIdx;
}

export function acquireProjectileImpl(this: WorldSim,
  init: Omit<SimProjectileState, 'prevX' | 'prevY' | 'hitEntityIds'>,
): SimProjectileState {
  const legacyInit = init as Omit<SimProjectileState, 'prevX' | 'prevY' | 'hitEntityIds'> & {
    ttl?: number;
    pierce?: number;
    bounces?: number;
  };
  const resolvedTtl = init.ttlSec ?? legacyInit.ttl ?? 1.2;
  const resolvedPierce = init.pierceRemaining ?? legacyInit.pierce ?? 0;
  const resolvedBounce = init.bounceRemaining ?? legacyInit.bounces ?? 0;
  const resolvedAngle = init.angle ?? Math.atan2(init.vy ?? 0, init.vx ?? 0);
  const pooled = this.projectilePool.pop();
  if (pooled) {
    pooled.id = init.id; pooled.ownerId = init.ownerId; pooled.team = init.team;
    pooled.weaponId = init.weaponId ?? 'rivet_gun';
    pooled.prevX = init.x; pooled.prevY = init.y; pooled.x = init.x; pooled.y = init.y;
    pooled.vx = init.vx; pooled.vy = init.vy; pooled.angle = resolvedAngle;
    pooled.radius = init.radius; pooled.damage = init.damage; pooled.isCrit = init.isCrit ?? false;
    pooled.knockback = init.knockback ?? 0; pooled.pierceRemaining = resolvedPierce;
    pooled.bounceRemaining = resolvedBounce; pooled.ttlSec = resolvedTtl;
    pooled.element = init.element ?? 'none'; pooled.amplifiedByShield = init.amplifiedByShield ?? false;
    pooled.shotFlags = init.shotFlags ?? 0; pooled.splitGeneration = init.splitGeneration ?? 0;
    pooled.procCoefficient = init.procCoefficient ?? 1.0; pooled.heavyPinballApplied = init.heavyPinballApplied ?? false;
    pooled.prismBonusAdd = init.prismBonusAdd ?? 0;
    pooled.awaitingServerRedirectTimer = init.awaitingServerRedirectTimer ?? 0;
    pooled.imbuedByZone = init.imbuedByZone; pooled.imbuedElement = init.imbuedElement;
    pooled.imbuedSecondaryElement = init.imbuedSecondaryElement; pooled.imbuedOwnerId = init.imbuedOwnerId;
    pooled.explosionRadius = init.explosionRadius;
    pooled.passedThroughCoverOrPrism = init.passedThroughCoverOrPrism;
    pooled.parryDeflected = init.parryDeflected; pooled.guaranteedElementalProc = init.guaranteedElementalProc;
    pooled.finaleResolved = false; pooled.originX = init.originX; pooled.originY = init.originY;
    pooled.armedForAirburst = init.armedForAirburst; pooled.airburstBypassShield = init.airburstBypassShield;
    pooled.parentExplosionId = init.parentExplosionId; pooled.swallowedBullets = init.swallowedBullets ?? 0;
    pooled.voidOrbFlightTicks = init.voidOrbFlightTicks ?? 0; pooled.voidPulseTimer = init.voidPulseTimer ?? 0;
    pooled.armedForReleaseImplosion = init.armedForReleaseImplosion ?? false;
    pooled.firedWhileHoldingFire = init.firedWhileHoldingFire ?? false;
    pooled.convergeTargetX = init.convergeTargetX; pooled.convergeTargetY = init.convergeTargetY;
    pooled.solarRayIndex = init.solarRayIndex; pooled.solarConvergeBurstTriggered = false;
    pooled.hasExplicitAimTarget = init.hasExplicitAimTarget;
    pooled.gravitySingularityShot = init.gravitySingularityShot;
    pooled.chainHarpoonShot = init.chainHarpoonShot;
    pooled.bypassFrontShield = init.bypassFrontShield;
    pooled.bouncesDone = init.bouncesDone ?? 0; pooled.orbitReturned = Boolean(init.orbitReturned); pooled.orbitReturnTicks = 0; pooled.clientHeldAtMaxRange = false; pooled.boomerangPhase = init.boomerangPhase; pooled.clusterMortarLob = init.clusterMortarLob; pooled.secondaryInfusedElement = init.secondaryInfusedElement; pooled.superconductRailRedirected = Boolean(init.superconductRailRedirected);
    pooled.trailLastX = init.originX ?? init.x; pooled.trailLastY = init.originY ?? init.y;
    pooled.hitEntityIds.length = 0;
    return pooled;
  }
  return {
    ...init,
    weaponId: init.weaponId ?? 'rivet_gun',
    angle: resolvedAngle,
    knockback: init.knockback ?? 0,
    pierceRemaining: resolvedPierce,
    bounceRemaining: resolvedBounce,
    bouncesDone: init.bouncesDone ?? 0,
    ttlSec: resolvedTtl,
    amplifiedByShield: init.amplifiedByShield ?? false,
    prevX: init.x,
    prevY: init.y,
    hitEntityIds: [],
  };
}
