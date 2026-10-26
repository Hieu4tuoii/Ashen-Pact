import { BIOME_SCALING } from '../data/scaling.js';
import { WEAPONS } from '../data/weapons.js';
import { angleDiff, circleVsCircle, distance } from '../math/vec2.js';
import { SHOT_FLAG, TILE_SIZE } from '../protocol/messages.js';
import {
  type BulletVolleySpawnEvent,
  MAX_ENEMY_PROJECTILES,
  MAX_PLAYER_PROJECTILES,
  type SimProjectileState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export function spawnDeterministicVolleyImpl(this: WorldSim, ev: BulletVolleySpawnEvent, emitEvents = true): void {
  if (ev.eventId === undefined || ev.eventId <= 0) {
    ev.eventId = this.nextVolleyEventId++;
  }
  this.volleyRng.setState(ev.seed || 0x6d2b79f5);
  const volleyRng = this.volleyRng;
  let pellets = Math.max(1, ev.pelletCount);
  let spreadRad = ev.spreadRad;
  let radialStepRad = ev.radialStepRad;
  let speed = ev.speed;

  if (ev.team === 'enemy') {
    const biomeScale = BIOME_SCALING[this.currentBiome] ?? BIOME_SCALING[1];
    if (ev.weaponId !== 'vengeful_ring') {
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

    if (!this.stressTestActive) {
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
      id: deterministicId,
      ownerId: ev.ownerId,
      team: ev.team,
      weaponId: ev.weaponId,
      x: bx,
      y: by,
      vx: Math.cos(shotAngle) * speed,
      vy: Math.sin(shotAngle) * speed,
      angle: shotAngle,
      radius: ev.radius,
      damage: finalDmg,
      isCrit,
      knockback: ev.knockback,
      pierceRemaining: ev.pierceCount,
      bounceRemaining: ev.bounceCount,
      ttlSec: ev.ttlSec,
      element: ev.element,
      amplifiedByShield: ev.amplifiedByShield,
      shotFlags: ev.shotFlags ?? 0,
      splitGeneration: 0,
      awaitingServerRedirectTimer: 0,
    });

    this.projectiles.push(proj);

    if (emitEvents && !this.stressTestActive) {
      this.events.push({
        kind: 'projectile_spawned',
        projectileId: proj.id,
        weaponId: ev.weaponId,
        team: ev.team,
        x: bx,
        y: by,
        angle: shotAngle,
      });
    }
  }
}

export function spawnSeedGunLifeBlossomImpl(this: WorldSim, ownerId: number, x: number, y: number): void {
  if (this.stressTestActive) return;
  const blossoms = this.summons.filter(
    (s) => s.kind === 'life_blossom' && s.hp > 0 && s.ttlSec > 0,
  );
  if (blossoms.length >= 3) {
    blossoms[0]!.ttlSec = 0;
  }
  const col = this.map.resolveCircleCollision(x, y, 14);
  this.summons.push({
    id: ++this.nextPuzzleEntityId,
    ownerPlayerId: ownerId,
    kind: 'life_blossom',
    nameVi: 'Hoa Sinh Mệnh',
    x: col.x,
    y: col.y,
    radius: 14,
    auraRadius: 92,
    hp: 30,
    maxHp: 30,
    ttlSec: 6.5,
    maxTtlSec: 6.5,
    tickTimer: 0.4,
    healsRemaining: 4,
    charge: 0,
    poisonRoots: false,
    selfDestruct: false,
    rootedEnemyIds: [],
  });
}

export function triggerLauncherProjectileExplosionImpl(this: WorldSim, b: SimProjectileState, x: number, y: number): void {
  if (this.stressTestActive) return;
  const blastR = 64;
  if (b.element === 'burn') {
    this.map.igniteSurfaceInRadius(x, y, blastR);
  }
  this.events.push({
    kind: 'explosion',
    x,
    y,
    radius: blastR,
    damage: b.damage,
    sourceDefId: b.weaponId,
  });

  if (b.team === 'player') {
    const blastDmg = Math.max(6, Math.round(b.damage * 0.65));
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (
        e.hp <= 0 ||
        e.aiState === 'spawning' ||
        e.bossBurrowed ||
        b.hitEntityIds.includes(e.id)
      ) {
        continue;
      }
      if (distance(x, y, e.x, e.y) <= blastR + e.radius) {
        const ang = Math.atan2(e.y - y, e.x - x);
        this.applyDamageToEnemy(e, blastDmg, false, b.element, ang, 160, true, b.ownerId);
      }
    }
  } else {
    const allPlayers = this.getAllPlayers();
    for (let i = 0; i < allPlayers.length; i++) {
      const pl = allPlayers[i]!;
      if (pl.lifeState !== 'alive') continue;
      if (distance(x, y, pl.x, pl.y) <= blastR + pl.radius) {
        const ang = Math.atan2(pl.y - y, pl.x - x);
        this.applyDamageToPlayer(b.damage, ang, 180, b.weaponId, pl);
      }
    }
  }
}

export function updateProjectilesImpl(this: WorldSim, dtSec: number): void {
  const allPlayers = this.getAllPlayers();
  let stressImpactEventsThisTick = 0;

  for (let i = 0; i < this.projectiles.length; i++) {
    const b = this.projectiles[i]!;
    if (b.ttlSec <= 0) continue;

    b.ttlSec -= dtSec;
    if (b.ttlSec <= 0) {
      if (b.element !== 'none') {
        this.applyElementAtWorldPoint(b.x, b.y, b.element, 20);
      }
      if (b.weaponId === 'seed_gun') {
        this.spawnSeedGunLifeBlossom(b.ownerId, b.x, b.y);
      } else if (
        b.weaponId === 'frag_launcher' ||
        b.weaponId === 'magma_cannon' ||
        b.weaponId === 'dwarf_mortar'
      ) {
        this.triggerLauncherProjectileExplosion(b, b.x, b.y);
      }
      continue;
    }

    b.x += b.vx * dtSec;
    b.y += b.vy * dtSec;

    // Elemental projectiles flying over interactive surfaces can ignite/freeze/electrify them!
    if (!this.stressTestActive && b.element !== 'none') {
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
    if (wallHit.hit) {
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

      if (b.bounceRemaining > 0) {
        b.bounceRemaining -= 1;
        b.x = wallHit.resolvedX;
        b.y = wallHit.resolvedY;
        if (wallHit.normalX !== 0) b.vx = -b.vx;
        if (wallHit.normalY !== 0) b.vy = -b.vy;
        b.angle = Math.atan2(b.vy, b.vx);
      } else {
        b.ttlSec = 0;
        if (b.element !== 'none') {
          this.applyElementAtWorldPoint(wallHit.resolvedX, wallHit.resolvedY, b.element, 24);
        }
        if (b.weaponId === 'seed_gun') {
          this.spawnSeedGunLifeBlossom(b.ownerId, wallHit.resolvedX, wallHit.resolvedY);
        } else if (
          b.weaponId === 'frag_launcher' ||
          b.weaponId === 'magma_cannon' ||
          b.weaponId === 'dwarf_mortar'
        ) {
          this.triggerLauncherProjectileExplosion(b, wallHit.resolvedX, wallHit.resolvedY);
        }
        if (!this.stressTestActive || stressImpactEventsThisTick < 3) {
          stressImpactEventsThisTick += 1;
          this.events.push({
            kind: 'projectile_impact',
            x: wallHit.resolvedX,
            y: wallHit.resolvedY,
            angle: b.angle,
            team: b.team,
            hitWall: true,
            destroyedByMelee: false,
            blockedByShield: false,
            isCrit: b.isCrit,
            element: b.element,
          });
        }
        continue;
      }
    }

    // 2. Check destructible / refractive props collision
    if (!this.stressTestActive && this.props.length > 0) {
      let hitProp = false;
      for (let k = 0; k < this.props.length; k++) {
        const prop = this.props[k]!;
        if (prop.hp <= 0) continue;
        // Boss Kryssa's ice laser refracts off indestructible Crystal Pillars toward the nearest player!
        if (prop.kind === 'crystal_pillar' && circleVsCircle(b, prop)) {
          if (!b.hitEntityIds.includes(prop.id)) {
            b.hitEntityIds.push(prop.id);
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
        if (!prop.destructible) continue;
        if (circleVsCircle(b, prop)) {
          this.damageProp(prop, b.damage, b.element);
          b.ttlSec = 0;
          hitProp = true;
          this.events.push({
            kind: 'projectile_impact',
            x: b.x,
            y: b.y,
            angle: b.angle,
            team: b.team,
            hitWall: false,
            destroyedByMelee: false,
            blockedByShield: false,
            isCrit: b.isCrit,
            element: b.element,
          });
          break;
        }
      }
      if (hitProp) continue;
    }

    // 3. Player projectile vs Allies/Synergies & Enemies
    if (b.team === 'player') {
      // 3a. Vanguard Shield Co-op Synergy: Ally bullets passing through active Vanguard shield get +30% damage & +1 pierce
      if (!b.amplifiedByShield) {
        for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
          const pl = allPlayers[pIdx]!;
          if (
            pl.lifeState !== 'alive' ||
            pl.characterId !== 'vanguard' ||
            pl.skillActiveTimer <= 0
          ) {
            continue;
          }
          const dToVanguard = distance(b.x, b.y, pl.x, pl.y);
          if (dToVanguard <= 42 + b.radius) {
            const angFromVanguard = Math.atan2(b.y - pl.y, b.x - pl.x);
            const halfShieldArc = pl.blessingIds.includes('vanguard_bastion_prism')
              ? Math.PI
              : (65 * Math.PI) / 180;
            if (Math.abs(angleDiff(angFromVanguard, pl.aimAngle)) <= halfShieldArc) {
              b.amplifiedByShield = true;
              b.damage = Math.round(b.damage * 1.3);
              b.pierceRemaining += 1;
              break;
            }
          }
        }
      }

      // 3b. Elementalist Skill Zone Synergy: Bullets passing through an Elemental Orb Zone get imbued + 15% damage
      if (this.skillZones.length > 0) {
        for (let zIdx = 0; zIdx < this.skillZones.length; zIdx++) {
          const z = this.skillZones[zIdx]!;
          if (z.ttlSec <= 0 || b.hitEntityIds.includes(z.id)) continue;
          if (distance(b.x, b.y, z.x, z.y) <= z.radius) {
            b.hitEntityIds.push(z.id);
            b.imbuedByZone = true;
            b.imbuedOwnerId = z.ownerPlayerId;
            if (b.element === 'none') {
              b.element = z.element;
              if (z.secondaryElement && z.secondaryElement !== 'none') {
                b.imbuedSecondaryElement = z.secondaryElement;
              }
            } else {
              b.imbuedElement = z.element;
              if (z.secondaryElement && z.secondaryElement !== 'none') {
                b.imbuedSecondaryElement = z.secondaryElement;
              }
            }
            b.damage = Math.round(b.damage * 1.15);
          }
        }
      }

      // 3c. Engineer Tesla Turret Co-op Synergy: Shooting a Tesla Turret charges its EMP!
      if (
        this.summons.length > 0 &&
        b.weaponId !== 'tesla_turret' &&
        b.weaponId !== 'ancient_turret'
      ) {
        for (let sIdx = 0; sIdx < this.summons.length; sIdx++) {
          const sum = this.summons[sIdx]!;
          if (sum.kind !== 'tesla_turret' || sum.hp <= 0 || sum.ttlSec <= 0) continue;
          if (b.hitEntityIds.includes(sum.id)) continue;
          if (distance(b.x, b.y, sum.x, sum.y) <= sum.radius + b.radius + 6) {
            b.hitEntityIds.push(sum.id);
            sum.charge = Math.min(100, sum.charge + (b.element !== 'none' ? 50 : 35));
            if (sum.charge >= 100) {
              this.triggerTeslaEmpBlast(sum);
            }
          }
        }
      }

      const candidates = this.enemySpatialGrid.queryCircle(
        b.x,
        b.y,
        b.radius,
        this.queryEnemyScratch,
      );
      for (let j = 0; j < candidates.length; j++) {
        const enemy = candidates[j]!;
        if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
        if (b.hitEntityIds.includes(enemy.id)) continue;

        if (circleVsCircle(b, enemy)) {
          b.hitEntityIds.push(enemy.id);

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

          const effectiveAttackerId =
            b.imbuedByZone &&
            b.imbuedOwnerId &&
            !b.imbuedElement &&
            enemy.lastElementOwnerId === b.ownerId &&
            b.imbuedOwnerId !== b.ownerId
              ? b.imbuedOwnerId
              : b.ownerId;

          this.applyDamageToEnemy(
            enemy,
            b.damage,
            b.isCrit,
            b.element,
            b.angle,
            b.knockback,
            b.weaponId === 'predator_arrow' ||
              b.weaponId === 'ruby_sword_wave' ||
              b.weaponId === 'frag_launcher' ||
              b.weaponId === 'magma_cannon',
            effectiveAttackerId,
          );

          if (b.weaponId === 'seed_gun') {
            this.spawnSeedGunLifeBlossom(b.ownerId, enemy.x, enemy.y);
          } else if (b.weaponId === 'frag_launcher' || b.weaponId === 'magma_cannon') {
            this.triggerLauncherProjectileExplosion(b, enemy.x, enemy.y);
          }

          if (!this.stressTestActive || stressImpactEventsThisTick < 4) {
            stressImpactEventsThisTick += 1;
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
      let blockedByAnyShield = false;
      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const pl = allPlayers[pIdx]!;
        if (pl.lifeState !== 'alive') continue;
        if (pl.characterId === 'vanguard' && pl.skillActiveTimer > 0) {
          const hasFortress = pl.blessingIds.includes('vanguard_bastion_prism');
          const shieldRadius = hasFortress ? 32 : 38;
          const dToPlayer = distance(b.x, b.y, pl.x, pl.y);
          if (dToPlayer <= shieldRadius + b.radius && dToPlayer >= pl.radius * 0.5) {
            const angleFromPlayer = Math.atan2(b.y - pl.y, b.x - pl.x);
            const halfShieldArc = hasFortress ? Math.PI : (60 * Math.PI) / 180;
            if (Math.abs(angleDiff(angleFromPlayer, pl.aimAngle)) <= halfShieldArc) {
              b.ttlSec = 0;
              pl.shieldStoredBullets += 1;
              const activeWepId =
                pl.weaponSlots[pl.activeWeaponSlot] ?? pl.weaponSlots[0] ?? 'knight_sword';
              const activeWep = WEAPONS[activeWepId];
              if (activeWep?.cadenceKind === 'HEAT_VENT') {
                pl.weaponHeat = Math.max(0, pl.weaponHeat - 15);
              } else if (pl.clipMax > 0) {
                pl.clipAmmo = Math.min(pl.clipMax, pl.clipAmmo + 1);
              }
              pl.vanguardShieldBonusAdd = Math.min(0.75, (pl.vanguardShieldBonusAdd ?? 0) + 0.15);
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
              blockedByAnyShield = true;
              break;
            }
          }
        }
      }
      if (blockedByAnyShield) continue;

      // Check Sacred Tree blocking enemy projectiles
      if (this.summons.length > 0) {
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
              sum.hp = Math.max(0, sum.hp - b.damage * (sum.kind === 'tesla_turret' ? 3 : 1));
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
              blockedBySummon = true;
              break;
            }
          }
        }
        if (blockedBySummon) continue;
      }

      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const pl = allPlayers[pIdx]!;
        if (pl.lifeState !== 'alive') continue;
        if (circleVsCircle(b, pl)) {
          b.ttlSec = 0;
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
          }
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
    if (b.ttlSec <= 0) continue;

    b.x += b.vx * dtSec;
    b.y += b.vy * dtSec;

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
      } else {
        b.ttlSec = 0;
        this.events.push({
          kind: 'projectile_impact',
          x: wallHit.resolvedX,
          y: wallHit.resolvedY,
          angle: b.angle,
          team: b.team,
          hitWall: true,
          destroyedByMelee: false,
          blockedByShield: false,
          isCrit: b.isCrit,
          element: b.element,
        });
        continue;
      }
    }

    // 2. Destructible prop cosmetic hit prediction
    if (this.props.length > 0) {
      let hitProp = false;
      for (let k = 0; k < this.props.length; k++) {
        const prop = this.props[k]!;
        if (prop.hp <= 0) continue;
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
        if (!prop.destructible) continue;
        if (circleVsCircle(b, prop)) {
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
          this.events.push({
            kind: 'projectile_impact',
            x: b.x,
            y: b.y,
            angle: b.angle,
            team: b.team,
            hitWall: false,
            destroyedByMelee: false,
            blockedByShield: false,
            isCrit: b.isCrit,
            element: b.element,
          });
          break;
        }
      }
      if (hitProp) continue;
    }

    // 3. Player projectile vs Enemy cosmetic hit prediction
    if (b.team === 'player') {
      const candidates = this.enemySpatialGrid.queryCircle(
        b.x,
        b.y,
        b.radius,
        this.queryEnemyScratch,
      );
      for (let j = 0; j < candidates.length; j++) {
        const enemy = candidates[j]!;
        if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
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
        if (pl.lifeState !== 'alive') continue;
        if (circleVsCircle(b, pl)) {
          b.ttlSec = 0;
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
  const pooled = this.projectilePool.pop();
  if (pooled) {
    pooled.id = init.id;
    pooled.ownerId = init.ownerId;
    pooled.team = init.team;
    pooled.weaponId = init.weaponId;
    pooled.prevX = init.x;
    pooled.prevY = init.y;
    pooled.x = init.x;
    pooled.y = init.y;
    pooled.vx = init.vx;
    pooled.vy = init.vy;
    pooled.angle = init.angle;
    pooled.radius = init.radius;
    pooled.damage = init.damage;
    pooled.isCrit = init.isCrit;
    pooled.knockback = init.knockback;
    pooled.pierceRemaining = init.pierceRemaining;
    pooled.bounceRemaining = init.bounceRemaining;
    pooled.ttlSec = init.ttlSec;
    pooled.element = init.element;
    pooled.amplifiedByShield = init.amplifiedByShield;
    pooled.shotFlags = init.shotFlags ?? 0;
    pooled.splitGeneration = init.splitGeneration ?? 0;
    pooled.awaitingServerRedirectTimer = init.awaitingServerRedirectTimer ?? 0;
    pooled.imbuedByZone = init.imbuedByZone;
    pooled.imbuedElement = init.imbuedElement;
    pooled.imbuedSecondaryElement = init.imbuedSecondaryElement;
    pooled.imbuedOwnerId = init.imbuedOwnerId;
    pooled.hitEntityIds.length = 0;
    return pooled;
  }
  return {
    ...init,
    prevX: init.x,
    prevY: init.y,
    hitEntityIds: [],
  };
}
