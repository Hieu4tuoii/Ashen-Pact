import { ENEMIES } from '../data/enemies.js';
import type { ElementType } from '../data/types.js';
import { approach, distance, distanceSq } from '../math/vec2.js';
import { BIOME_SCALING, COOP_SCALING } from '../data/scaling.js';
import type { SurfaceKind } from './arena-map.js';
import { getConveyorVelocityAtWorld } from './arena-room-archetypes.js';
import { updateEnemyHeavyPinballAndTimers } from './sim-blessings.js';
import { resolveEnemyChasmRingOut, triggerEnemyWallSlam } from './sim-tactical-physics.js';
import { updateLegendaryWeaponHazards } from './sim-weapon-specials-p1b-legendary.js';
import { updateFlameFissures, updateTetherStaffBeams } from './sim-weapon-specials.js';
import type { SimPlayerState, SimEnemyState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export function updatePhase6MechanicsImpl(this: WorldSim, dtSec: number): void {
  const allPlayers = this.getAllPlayers();

  // 1. Pushable stone blocks (Solo alternative for 2-player pressure plates)
  for (let i = 0; i < this.pushBlocks.length; i++) {
    const block = this.pushBlocks[i]!;

    // Check if the block is already within capture range of a pressure plate
    let lockedPlate: { x: number; y: number } | null = null;
    for (let k = 0; k < this.pressurePlates.length; k++) {
      const plate = this.pressurePlates[k]!;
      if (distance(block.x, block.y, plate.x, plate.y) <= 22) {
        lockedPlate = plate;
        break;
      }
    }

    if (lockedPlate) {
      // Once seated onto a pressure plate, snap firmly onto the plate center and lock in place
      block.x = approach(block.x, lockedPlate.x, 320 * dtSec);
      block.y = approach(block.y, lockedPlate.y, 320 * dtSec);
      continue;
    }

    for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
      const pl = allPlayers[pIdx]!;
      if (pl.lifeState !== 'alive') continue;
      const dx = block.x - pl.x;
      const dy = block.y - pl.y;
      const d = Math.hypot(dx, dy);
      const minDist = pl.radius + block.radius + 4;
      if (d > 0.001 && d < minDist) {
        let dirX = dx / d;
        let dirY = dy / d;

        // Blend with player velocity direction to prevent circle-on-circle lateral slip
        const vLen = Math.hypot(pl.vx, pl.vy);
        if (vLen > 10) {
          const vxN = pl.vx / vLen;
          const vyN = pl.vy / vLen;
          if (vxN * dirX + vyN * dirY > -0.25) {
            dirX = dirX * 0.3 + vxN * 0.7;
            dirY = dirY * 0.3 + vyN * 0.7;
          }
        }

        // Magnetic guidance toward the nearest unpressed pressure plate within 160u
        let nearestPlate: { x: number; y: number } | null = null;
        let nearestPlateDist = 160;
        for (let k = 0; k < this.pressurePlates.length; k++) {
          const plate = this.pressurePlates[k]!;
          const pd = distance(block.x, block.y, plate.x, plate.y);
          if (pd < nearestPlateDist) {
            nearestPlateDist = pd;
            nearestPlate = plate;
          }
        }
        if (nearestPlate && nearestPlateDist > 0.5) {
          const toPlateX = (nearestPlate.x - block.x) / nearestPlateDist;
          const toPlateY = (nearestPlate.y - block.y) / nearestPlateDist;
          if (dirX * toPlateX + dirY * toPlateY > -0.35) {
            dirX = dirX * 0.4 + toPlateX * 0.6;
            dirY = dirY * 0.4 + toPlateY * 0.6;
          }
        }

        const dirLen = Math.hypot(dirX, dirY) || 1;
        dirX /= dirLen;
        dirY /= dirLen;

        const push = Math.max((minDist - d) * 1.25, Math.min(vLen, 220) * dtSec);
        const col = this.map.resolveCircleCollision(
          block.x + dirX * push,
          block.y + dirY * push,
          block.radius,
        );
        block.x = col.x;
        block.y = col.y;
      }
    }

    // Snap onto a nearby pressure plate center if pushed within 26u
    for (let k = 0; k < this.pressurePlates.length; k++) {
      const plate = this.pressurePlates[k]!;
      if (distance(block.x, block.y, plate.x, plate.y) <= 26) {
        block.x = approach(block.x, plate.x, 260 * dtSec);
        block.y = approach(block.y, plate.y, 260 * dtSec);
      }
    }
  }

  // 2. Co-op Dual Pressure Plates -> Unlock Bonus Co-op Treasure Chest
  if (this.pressurePlates.length > 0) {
    let allPressed = true;
    for (let i = 0; i < this.pressurePlates.length; i++) {
      const plate = this.pressurePlates[i]!;
      if (this.coopPuzzleCompleted) {
        plate.pressed = true;
        continue;
      }
      let pressed = false;
      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const pl = allPlayers[pIdx]!;
        if (
          pl.lifeState === 'alive' &&
          distance(plate.x, plate.y, pl.x, pl.y) <= plate.radius + pl.radius + 4
        ) {
          pressed = true;
          break;
        }
      }
      if (!pressed) {
        for (let bIdx = 0; bIdx < this.pushBlocks.length; bIdx++) {
          const blk = this.pushBlocks[bIdx]!;
          if (distance(plate.x, plate.y, blk.x, blk.y) <= plate.radius + blk.radius) {
            pressed = true;
            break;
          }
        }
      }
      if (!pressed) {
        for (let sIdx = 0; sIdx < this.summons.length; sIdx++) {
          const sum = this.summons[sIdx]!;
          if (
            sum.hp > 0 &&
            sum.ttlSec > 0 &&
            distance(plate.x, plate.y, sum.x, sum.y) <= plate.radius + sum.radius
          ) {
            pressed = true;
            break;
          }
        }
      }
      plate.pressed = pressed;
      if (!pressed) allPressed = false;
    }

    if (allPressed && !this.coopPuzzleCompleted && this.pressurePlates.length >= 2) {
      this.coopPuzzleCompleted = true;
      this.completedPuzzleRoomIds.add(this.currentRoomId);
      const cx = this.map.width * 0.5;
      const cy = this.map.height * 0.5 - 118;
      this.spawnChest(cx, cy, 'epic');
      this.roomChestsByRoomId.set(this.currentRoomId, [...this.chests]);
      this.events.push({
        kind: 'coop_puzzle_solved',
        roomId: this.currentRoomId,
        x: cx,
        y: cy,
      });
    }
  }

  // 3. Boss Forge Titan Expanding Shockwave Rings (players can Dash through with i-frames!)
  if (this.shockwaveRings.length > 0) {
    let ringWrite = 0;
    for (let i = 0; i < this.shockwaveRings.length; i++) {
      const ring = this.shockwaveRings[i]!;
      ring.radius += ring.speed * dtSec;
      if (ring.radius >= ring.maxRadius) continue;

      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const pl = allPlayers[pIdx]!;
        if (pl.lifeState !== 'alive' || ring.hitPlayerIds.includes(pl.id)) continue;
        const d = distance(ring.x, ring.y, pl.x, pl.y);
        if (
          (pl.dashTimer > 0 || pl.invulnerableTimer > 0) &&
          d >= ring.radius - ring.thickness &&
          d <= ring.radius + ring.thickness + 68
        ) {
          ring.hitPlayerIds.push(pl.id);
          continue;
        }
        if (d >= ring.radius - 12 && d <= ring.radius + pl.radius) {
          ring.hitPlayerIds.push(pl.id);
          // Dashing or invulnerable players pass right through the shockwave ring unharmed!
          if (pl.dashTimer <= 0 && pl.invulnerableTimer <= 0) {
            const pushAng = Math.atan2(pl.y - ring.y, pl.x - ring.x);
            this.applyDamageToPlayer(ring.damage, pushAng, 210, 'forge_titan_shockwave', pl);
          }
        }
      }
      this.shockwaveRings[ringWrite++] = ring;
    }
    this.shockwaveRings.length = ringWrite;
  }

  // 4. Co-op Weapon Tether Beams (tether_staff: High-Voltage Cutting Beam linking player to anchor)
  updateTetherStaffBeams(this, dtSec);
  updateFlameFissures(this, dtSec);
  updateLegendaryWeaponHazards(this, dtSec);

  // 5. Boss Forge Titan Phase 2 Dual Energy Core synchronization window (3s Co-op / 6s Solo)
  if (this.titanCoreWindowTimer > 0) {
    this.titanCoreWindowTimer = Math.max(0, this.titanCoreWindowTimer - dtSec);
    if (this.titanCoreWindowTimer <= 0) {
      const titan = this.enemies.find((e) => e.defId === 'forge_titan' && e.hp > 0);
      const remainingCores = this.enemies.filter(
        (e) => e.defId === 'forge_energy_core' && e.hp > 0,
      );
      if (titan && titan.bossPhase === 2 && remainingCores.length === 1) {
        // Window expired before second core was destroyed -> respawn first core at 50% HP
        const survivor = remainingCores[0]!;
        const spawnLeft = survivor.x >= titan.x;
        const respawned = this.spawnEnemy(
          'forge_energy_core',
          titan.x + (spawnLeft ? -115 : 115),
          titan.y,
          true,
        );
        respawned.hp = Math.max(10, Math.round(respawned.maxHp * 0.5));
      }
      this.titanFirstCoreBrokenId = 0;
    }
  }
}

export function findNearestAlivePlayerImpl(this: WorldSim, x: number, y: number): SimPlayerState {
  if (this.stressTestActive || this.simulatedPlayers.length === 0) {
    return this.player;
  }
  let best = this.player;
  let bestDistSq =
    this.player.lifeState === 'alive' && this.player.hp > 0
      ? distanceSq(x, y, this.player.x, this.player.y)
      : Infinity;
  for (let i = 0; i < this.simulatedPlayers.length; i++) {
    const candidate = this.simulatedPlayers[i]!;
    if (candidate.lifeState !== 'alive' || candidate.hp <= 0) continue;
    const dSq = distanceSq(x, y, candidate.x, candidate.y);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = candidate;
    }
  }
  return best;
}

export function getCoopEnemyCooldownScaleImpl(this: WorldSim): number {
  const pCount = this.getActivePlayerCount();
  if (pCount <= 1 || this.stressTestActive) return 1.0;
  const bonus = COOP_SCALING[pCount].enemyFireRateBonus;
  return 1 / (1 + bonus);
}

export function updateEnemiesImpl(this: WorldSim, dtSec: number): void {
  // Process pending Vengeful Elite death-ring telegraphs (0.5s warning -> 8 slow radial bullets)
  if (this.pendingVengefulRings.length > 0) {
    let ringWrite = 0;
    for (let rIdx = 0; rIdx < this.pendingVengefulRings.length; rIdx++) {
      const ring = this.pendingVengefulRings[rIdx]!;
      ring.timerSec -= dtSec;
      if (ring.timerSec > 0) {
        this.pendingVengefulRings[ringWrite++] = ring;
      } else if (!this.stressTestActive || this.projectiles.length < 660) {
        this.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: this.tick,
          ownerId: ring.ownerId,
          team: 'enemy',
          weaponId: 'vengeful_ring',
          x: ring.x,
          y: ring.y,
          angle: 0,
          pelletCount: 8,
          spreadRad: 0,
          radialStepRad: Math.PI / 4,
          muzzleOffset: 10,
          speed: 175,
          damage: ring.damage,
          radius: 6,
          knockback: 90,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 2.2,
          element: 'none',
          critChance: 0,
          amplifiedByShield: false,
          seed: this.rng.nextUint32(),
        });
      }
    }
    this.pendingVengefulRings.length = ringWrite;
  }

  for (let i = 0; i < this.enemies.length; i++) {
    const e = this.enemies[i]!;
    if (e.hp <= 0) continue;

    if (e.hitFlashTimer > 0) {
      e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dtSec);
    }
    if (e.attackCooldownTimer > 0) {
      e.attackCooldownTimer = Math.max(0, e.attackCooldownTimer - dtSec);
    }
    if ((e.bossFreezeDrTimer ?? 0) > 0) {
      e.bossFreezeDrTimer = Math.max(0, (e.bossFreezeDrTimer ?? 0) - dtSec);
      if (e.bossFreezeDrTimer <= 0) {
        e.bossFreezeCountWindow = 0;
      }
    }
    if (e.shockTimer > 0) {
      e.shockTimer = Math.max(0, e.shockTimer - dtSec);
    }
    if (e.grassRustleCooldown > 0) {
      e.grassRustleCooldown = Math.max(0, e.grassRustleCooldown - dtSec);
    }
    if (e.markedTimer > 0) {
      e.markedTimer = Math.max(0, e.markedTimer - dtSec);
      if (e.markedTimer <= 0) e.markedByPlayerId = 0;
    }
    if (e.superconductTimer > 0) {
      e.superconductTimer = Math.max(0, e.superconductTimer - dtSec);
    }
    if ((e.shieldBrokenTimer ?? 0) > 0) {
      e.shieldBrokenTimer = Math.max(0, (e.shieldBrokenTimer ?? 0) - dtSec);
    }
    if (e.rootedTimer > 0) {
      e.rootedTimer = Math.max(0, e.rootedTimer - dtSec);
      e.rootTimer = e.rootedTimer;
    }
    if (e.steamBlindTimer > 0) {
      e.steamBlindTimer = Math.max(0, e.steamBlindTimer - dtSec);
    }
    if ((e.wallSlamCooldownTimer ?? 0) > 0) {
      e.wallSlamCooldownTimer = Math.max(0, (e.wallSlamCooldownTimer ?? 0) - dtSec);
    }
    if ((e.stunTimer ?? 0) > 0) {
      e.stunTimer = Math.max(0, (e.stunTimer ?? 0) - dtSec);
    }
    if ((e.slowTimer ?? 0) > 0) {
      e.slowTimer = Math.max(0, (e.slowTimer ?? 0) - dtSec);
    }

    // Decay knockback (preserving pre-decay speed for Wall-Slam threshold checks)
    const preDecayKbSpeed = Math.hypot(e.kbVx, e.kbVy);
    const kbDecay = Math.exp(-12 * dtSec);
    e.kbVx *= kbDecay;
    e.kbVy *= kbDecay;
    if (Math.abs(e.kbVx) < 1) e.kbVx = 0;
    if (Math.abs(e.kbVy) < 1) e.kbVy = 0;

    // Update Elemental Status Timers & Surface interactions
    const surf = this.map.getSurfaceAtWorld(e.x, e.y);
    this.updateEnemyStatusAndSurface(e, surf, dtSec);
    if (e.hp <= 0) continue;

    if (e.isDummy) {
      // Poison blocks healing! Dummy only regenerates when not poisoned
      if (e.hp < e.maxHp && e.poisonTimer <= 0) {
        e.hp = e.maxHp;
      }
      continue;
    }

    if (e.aiState === 'spawning') {
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        e.aiState = 'move';
        e.stateTimer = 0;
      }
      continue;
    }

    // Track Boss combat elapsed time & Soft Enrage after 90s (every 15s cooldown x0.93 down to x0.75)
    if (e.isBoss) {
      e.bossCombatElapsedSec = (e.bossCombatElapsedSec ?? 0) + dtSec;
      const elapsed = e.bossCombatElapsedSec;
      if (elapsed >= 90) {
        const newLevel = Math.min(4, Math.floor((elapsed - 90) / 15) + 1);
        if (newLevel > (e.bossEnrageLevel ?? 0)) {
          e.bossEnrageLevel = newLevel;
          this.events.push({
            kind: 'boss_enraged',
            enemyId: e.id,
            enrageLevel: newLevel,
            x: e.x,
            y: e.y,
          });
        }
      }
    }

    // Dramatic 1.2s Boss Phase Transition roar/invulnerability pause
    if (e.aiState === 'idle') {
      e.bossPhaseTransitionTimer = 0;
    } else if ((e.bossPhaseTransitionTimer ?? 0) > 0) {
      e.bossPhaseTransitionTimer = Math.max(0, (e.bossPhaseTransitionTimer ?? 0) - dtSec);
      e.vx = 0;
      e.vy = 0;
      if (e.bossPhaseTransitionTimer > 0) {
        continue;
      }
    }

    // Frozen enemies cannot move or execute AI (unless currently flying under high knockback >= 120)
    if (e.frozenTimer > 0) {
      e.vx = 0;
      e.vy = 0;
      e.frozenTimer = Math.max(0, e.frozenTimer - dtSec);
      if (preDecayKbSpeed < 120) {
        continue;
      }
    }

    // Elite Regen modifier: regenerates 4 HP/sec if not poisoned
    if (e.isElite && e.eliteModifier === 'regen' && e.hp < e.maxHp && e.poisonTimer <= 0 && e.frozenTimer <= 0) {
      e.regenAccum += dtSec * 4;
      if (e.regenAccum >= 1) {
        const healPts = Math.floor(e.regenAccum);
        e.regenAccum -= healPts;
        e.hp = Math.min(e.maxHp, e.hp + healPts);
      }
    }

    const targetPlayer = this.findNearestAlivePlayer(e.x, e.y);
    let targetX = targetPlayer.x;
    let targetY = targetPlayer.y;

    // Druid's Sacred Tree taunts nearby non-boss enemies within 170u
    if (!e.isBoss && this.summons.length > 0) {
      for (let sIdx = 0; sIdx < this.summons.length; sIdx++) {
        const sum = this.summons[sIdx]!;
        if (sum.kind === 'sacred_tree' && sum.hp > 0 && sum.ttlSec > 0) {
          if (distance(e.x, e.y, sum.x, sum.y) <= 170) {
            targetX = sum.x;
            targetY = sum.y;
            break;
          }
        }
      }
    }

    if (e.frozenTimer > 0) {
      e.vx = 0;
      e.vy = 0;
    } else if (e.aiState === 'stunned') {
      e.vx = 0;
      e.vy = 0;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0 && (e.stunTimer ?? 0) <= 0) {
        e.aiState = 'cooldown';
        e.stateTimer = 0.6;
      }
    } else if ((e.stunTimer ?? 0) > 0 && !e.isBoss) {
      e.vx = 0;
      e.vy = 0;
    } else {
      if (e.aiState === 'chase') {
        e.aiState = 'move';
      }
      const dx = targetX - e.x;
      const dy = targetY - e.y;
      const distToPlayer = Math.hypot(dx, dy);
      let angleToPlayer = Math.atan2(dy, dx);
      // Vaporize Steam Blindness causes enemies to misaim by ~30 degrees!
      if (e.steamBlindTimer > 0) {
        angleToPlayer += 0.52 * e.strafeSign;
      }

      if (e.defId === 'goblin_shooter') {
        this.updateGoblinShooterAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'wild_boar') {
        this.updateWildBoarAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'spore_bomber') {
        this.updateSporeBomberAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'green_slime' || e.defId === 'mini_slime') {
        this.updateSlimeAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'goblin_shaman') {
        this.updateGoblinShamanAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'thorn_turret' || e.defId === 'spore_guardian') {
        this.updateThornTurretAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'spore_king') {
        this.updateBossSporeKingAI(e, targetPlayer, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'frost_bat') {
        this.updateFrostBatAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'baby_yeti') {
        this.updateBabyYetiAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'ice_mage') {
        this.updateIceMageAI(e, targetPlayer, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'ice_golem') {
        this.updateIceGolemAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'snow_spirit') {
        this.updateSnowSpiritAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'kryssa_clone') {
        this.updateKryssaCloneAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'kryssa_ice_queen') {
        this.updateBossKryssaAI(e, targetPlayer, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'fire_imp') {
        this.updateFireImpAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'dwarf_cannon') {
        this.updateDwarfCannonAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'coal_golem') {
        this.updateCoalGolemAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'welder_drone') {
        this.updateWelderDroneAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'iron_shielder') {
        this.updateIronShielderAI(e, distToPlayer, angleToPlayer, dtSec);
      } else if (e.defId === 'forge_titan') {
        this.updateBossForgeTitanAI(e, targetPlayer, distToPlayer, angleToPlayer, dtSec);
      }
    }

    // Stationary turrets, guardian mushrooms, ice prisons, energy cores, or enemies rooted by Druid cannot move
    const isStationaryDef =
      e.defId === 'thorn_turret' ||
      e.defId === 'spore_guardian' ||
      e.defId === 'ice_prison' ||
      e.defId === 'forge_energy_core';
    if (isStationaryDef || e.rootedTimer > 0) {
      e.vx = 0;
      e.vy = 0;
      e.kbVx = 0;
      e.kbVy = 0;
    }

    // Apply Chill (-30% or -50% laser fence) and Oil (-15%) movement speed modifiers
    let speedMult = 1.0;
    if ((e.fenceSlow50Timer ?? 0) > 0) speedMult *= 0.5;
    else if (e.chillTimer > 0 || (e.slowTimer ?? 0) > 0) speedMult *= 0.7;
    if ((surf === 'oil' || surf === 'poison_swamp') && !e.isBoss && !ENEMIES[e.defId]?.flying) {
      speedMult *= 0.85;
    }
    e.vx *= speedMult;
    e.vy *= speedMult;

    // Soft separation between nearby enemies
    const nearby = this.enemySpatialGrid.queryCircle(
      e.x,
      e.y,
      e.radius + 18,
      this.queryEnemyScratch,
    );
    let sepX = 0;
    let sepY = 0;
    if (!isStationaryDef && !e.bossBurrowed && e.rootedTimer <= 0) {
      for (let j = 0; j < nearby.length; j++) {
        const other = nearby[j]!;
        if (other.id === e.id || other.hp <= 0) continue;
        const odx = e.x - other.x;
        const ody = e.y - other.y;
        const d = Math.hypot(odx, ody);
        const minSep = e.radius + other.radius + 4;
        if (d > 0.001 && d < minSep) {
          const push = ((minSep - d) / minSep) * 90;
          sepX += (odx / d) * push;
          sepY += (ody / d) * push;
        }
      }
    }

    const conveyorPushX =
      surf === 'conveyor' && !isStationaryDef && !e.isBoss && !ENEMIES[e.defId]?.flying
        ? getConveyorVelocityAtWorld(this.map, e.x, e.y)
        : 0;

    const kbSpeed = Math.hypot(e.kbVx, e.kbVy);
    const nextX = e.x + (e.vx + e.kbVx + sepX + conveyorPushX) * dtSec;
    const nextY = e.y + (e.vy + e.kbVy + sepY) * dtSec;
    const ignoreChasm = Boolean(
      e.isBoss || ENEMIES[e.defId]?.flying || kbSpeed >= 25 || surf === 'chasm',
    );
    const col = this.map.resolveCircleCollision(nextX, nextY, e.radius, ignoreChasm);
    let wallCollided = col.collided;
    e.x = col.x;
    e.y = col.y;
    if (!this.stressTestActive && e.defId !== 'ice_prison' && this.props.length > 0) {
      const prePropX = e.x;
      const prePropY = e.y;
      this.resolvePropMovementCollision(e);
      for (let pIdx = 0; pIdx < this.props.length; pIdx++) {
        const prop = this.props[pIdx]!;
        if (prop.hp <= 0 || prop.kind !== 'ancient_mechanism') continue;
        const dx = e.x - prop.x;
        const dy = e.y - prop.y;
        const minDist = e.radius + prop.radius;
        const dSq = dx * dx + dy * dy;
        if (dSq < minDist * minDist && dSq > 1e-6) {
          const d = Math.sqrt(dSq);
          e.x += (dx / d) * (minDist - d);
          e.y += (dy / d) * (minDist - d);
        }
      }
      if (e.x !== prePropX || e.y !== prePropY) {
        const postPropCol = this.map.resolveCircleCollision(e.x, e.y, e.radius, ignoreChasm);
        e.x = postPropCol.x;
        e.y = postPropCol.y;
        if (postPropCol.collided) {
          wallCollided = true;
        }
      }
    }

    if (!this.stressTestActive && wallCollided && preDecayKbSpeed >= 120 && (e.wallSlamCooldownTimer ?? 0) <= 0) {
      let nearbyRingPillar: (typeof this.props)[number] | undefined;
      for (let pIdx = 0; pIdx < this.props.length; pIdx++) {
        const p = this.props[pIdx]!;
        if (
          p.hp > 0 &&
          p.kind === 'rotten_totem_pillar' &&
          p.coverState !== 'fallen' &&
          distance(e.x, e.y, p.x, p.y) <= e.radius + 48
        ) {
          nearbyRingPillar = p;
          break;
        }
      }
      triggerEnemyWallSlam(this, e, nearbyRingPillar, preDecayKbSpeed);
      if (e.hp <= 0) continue;
    }

    updateEnemyHeavyPinballAndTimers(this, e, dtSec);
    if (e.hp <= 0) continue;

    if (!this.stressTestActive && resolveEnemyChasmRingOut(this, e)) {
      if (e.hp <= 0) continue;
    }

    if (surf === 'grass' && Math.hypot(e.vx, e.vy) > 25 && e.grassRustleCooldown <= 0) {
      e.grassRustleCooldown = 0.35;
      if (!this.stressTestActive) {
        this.events.push({ kind: 'grass_rustle', x: e.x, y: e.y });
      }
    }

    if (
      (e.defId === 'wild_boar' || e.defId === 'baby_yeti') &&
      e.aiState === 'attack' &&
      wallCollided
    ) {
      e.aiState = 'stunned';
      e.stateTimer = 0.5;
      e.vx = 0;
      e.vy = 0;
      e.attackCooldownTimer =
        (ENEMIES[e.defId]?.attackCooldownSec ?? 2.5) * this.getEnemyCooldownScale(false);
      this.events.push({
        kind: 'hit_stop',
        durationMs: 30,
        trauma: 0.25,
      });
    }
  }

  let writeIdx = 0;
  for (let i = 0; i < this.enemies.length; i++) {
    const e = this.enemies[i]!;
    if (e.hp > 0) {
      this.enemies[writeIdx++] = e;
    }
  }
  this.enemies.length = writeIdx;
}

export function getEnemyCooldownScaleImpl(this: WorldSim, isBoss: boolean): number {
  const count = this.getActivePlayerCount();
  const scaling = COOP_SCALING[count];
  const biomeTier = BIOME_SCALING[this.currentBiome] ?? BIOME_SCALING[1];
  const rate = isBoss ? 1 + scaling.enemyFireRateBonus * 0.75 : 1 + scaling.enemyFireRateBonus;
  let cdScale = (1 / Math.max(1, rate)) * (isBoss ? 1.0 : biomeTier.cooldownScale);
  if (isBoss) {
    const boss = this.enemies.find((m) => m.isBoss && m.hp > 0);
    const elapsed = boss?.bossCombatElapsedSec ?? 0;
    if (elapsed >= 90) {
      const steps = Math.floor((elapsed - 90) / 15) + 1;
      const enrageMult = Math.max(0.75, Math.pow(0.93, steps));
      cdScale *= enrageMult;
    }
  }
  return cdScale;
}

export function updateEnemyStatusAndSurfaceImpl(
  this: WorldSim,
  e: SimEnemyState,
  surf: SurfaceKind,
  dtSec: number,
): void {
  if (surf === 'water') {
    e.burnTimer = 0;
  } else if (surf === 'burning_oil' || surf === 'burning_grass' || surf === 'lava') {
    if (e.burnTimer <= 0) {
      e.burnTickTimer = 0.25;
    }
    e.burnTimer = Math.max(e.burnTimer, 2.5);
  } else if (surf === 'poison_swamp' && !e.isBoss && e.defId !== 'spore_bomber') {
    if (e.poisonTimer <= 0) {
      e.poisonTickTimer = 0.3;
    }
    e.poisonTimer = Math.max(e.poisonTimer, 3.0);
    e.poisonStacks = Math.max(1, e.poisonStacks);
  } else if (surf === 'electrified_water') {
    e.surfaceTickTimer += dtSec;
    if (e.surfaceTickTimer >= 0.5) {
      e.surfaceTickTimer = 0;
      e.shockTimer = 0.45;
      this.applyDotDamageToEnemy(e, 4, 'shock');
      if (e.hp <= 0) return;
    }
  }

  if (e.burnTimer > 0) {
    e.burnTimer = Math.max(0, e.burnTimer - dtSec);
    if (!this.stressTestActive && (surf === 'oil' || surf === 'grass' || (surf === 'poison_swamp' && !this.map.isBossRoom))) {
      this.map.igniteSurfaceInRadius(e.x, e.y, 18);
    }
    e.burnTickTimer -= dtSec;
    if (e.burnTickTimer <= 0) {
      e.burnTickTimer = 0.5;
      this.applyDotDamageToEnemy(e, 3, 'burn');
      if (e.hp <= 0) return;
    }
  }

  if (e.chillTimer > 0) {
    e.chillTimer = Math.max(0, e.chillTimer - dtSec);
    if (e.chillTimer <= 0) {
      e.chillStacks = 0;
    }
  }

  if (e.poisonTimer > 0) {
    e.poisonTimer = Math.max(0, e.poisonTimer - dtSec);
    e.poisonTickTimer -= dtSec;
    if (e.poisonTickTimer <= 0) {
      e.poisonTickTimer = 0.6;
      this.applyDotDamageToEnemy(e, 2 * Math.max(1, e.poisonStacks), 'poison');
      if (e.hp <= 0) return;
    }
    if (e.poisonTimer <= 0) {
      e.poisonStacks = 0;
    }
  }
}

export function applyDotDamageToEnemyImpl(
  this: WorldSim,
  enemy: SimEnemyState,
  amount: number,
  element: ElementType,
  emitEvent = true,
): void {
  if (
    enemy.hp <= 0 ||
    enemy.bossBurrowed ||
    (enemy.isBoss &&
      (enemy.bossPhaseTransitionTimer ?? 0) > 0 &&
      enemy.aiState !== 'stunned' &&
      amount < enemy.maxHp * 0.3)
  ) {
    return;
  }
  let effectiveAmount = amount;
  if (enemy.isBoss && this.hasActiveBossGuardians()) {
    effectiveAmount = Math.max(1, Math.round(effectiveAmount * 0.35));
  }
  if (this.stressTestActive && enemy.hp <= effectiveAmount + 20) {
    enemy.hp = enemy.maxHp;
    return;
  }
  enemy.hp = Math.max(0, enemy.hp - effectiveAmount);
  this.recordDamageHistory(effectiveAmount);
  this.runStats.damageDealt += effectiveAmount;
  const ownerPl = this.getPlayerById(enemy.lastElementOwnerId || this.player.id) ?? this.player;
  ownerPl.statsDamageDealt = (ownerPl.statsDamageDealt ?? 0) + effectiveAmount;
  this.checkBossPhaseTransitions(enemy);

  if (emitEvent && !this.stressTestActive) {
    this.events.push({
      kind: 'damage_dealt',
      targetId: enemy.id,
      targetKind: 'enemy',
      x: enemy.x,
      y: enemy.y,
      amount,
      isCrit: false,
      hitArmor: false,
      element,
      knockbackX: 0,
      knockbackY: 0,
    });
  }

  if (enemy.hp <= 0 && !enemy.isDummy) {
    this.handleEnemyKilled(enemy, ownerPl.id);
  }
}

function clearBossNearbyProjectiles(sim: WorldSim, bossX: number, bossY: number, radius = 140): void {
  const players = sim.getAllPlayers();
  const destroyedIds: number[] = [];
  let writeIdx = 0;
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    const nearAlivePlayer =
      b.team === 'enemy' &&
      players.some((pl) => pl.lifeState === 'alive' && distance(pl.x, pl.y, b.x, b.y) <= radius);
    if (nearAlivePlayer) {
      destroyedIds.push(b.id);
      b.ttlSec = 0;
      b.hitEntityIds.length = 0;
      sim.projectilePool.push(b);
    } else {
      sim.projectiles[writeIdx++] = b;
    }
  }
  sim.projectiles.length = writeIdx;
  if (destroyedIds.length > 0 && !sim.stressTestActive) {
    sim.events.push({
      kind: 'projectiles_destroyed',
      ids: destroyedIds,
    });
  }

  // Reward all alive players with an instant cadence refill / heat vent on boss phase transition
  for (let pIdx = 0; pIdx < players.length; pIdx++) {
    const pl = players[pIdx]!;
    if (pl.lifeState !== 'alive') continue;
    pl.clipAmmo = pl.clipMax;
    pl.reloadTimer = 0;
    pl.reloadLockout = false;
    pl.weaponHeat = 0;
    pl.overheatLockTimer = 0;
  }

  // Drop phase-break sustain orb (1 Life Seed) around Boss position with outward scatter velocity
  const baseAng = sim.rng.nextFloat(-Math.PI, Math.PI);
  sim.pickups.push(
    sim.acquirePickup({
      id: ++sim.nextEntityId,
      kind: 'life_seed',
      x: bossX,
      y: bossY,
      vx: Math.cos(baseAng) * 85,
      vy: Math.sin(baseAng) * 85,
      amount: 1,
      ttlSec: 22,
    }),
  );
}

export function checkBossPhaseTransitionsImpl(this: WorldSim, e: SimEnemyState): void {
  if (!e.isBoss || e.hp <= 0) return;
  const hpRatio = e.hp / e.maxHp;

  if (hpRatio <= 0.66 && e.bossPhase === 1) {
    e.bossPhase = 2;
    e.bossPhaseTransitionTimer = 1.2;
    e.attackCooldownTimer = 0;
    e.aiState = 'telegraph';
    e.stateTimer = Math.max(0.55, e.telegraphDurationSec);
    e.telegraphAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    e.vx = 0;
    e.vy = 0;
    e.bossBurrowed = false;
    clearBossNearbyProjectiles(this, e.x, e.y, 140);
    if (e.defId === 'kryssa_ice_queen') {
      this.spawnKryssaMirrorClones(e);
    } else if (e.defId === 'forge_titan') {
      this.spawnForgeTitanEnergyCores(e);
    }
    if (this.getActivePlayerCount() >= 3 && e.defId !== 'spore_king') {
      this.spawnBossGuardianMushrooms();
    }
    this.events.push({
      kind: 'boss_phase_changed',
      enemyId: e.id,
      phase: 2,
      x: e.x,
      y: e.y,
    });
    this.events.push({
      kind: 'hit_stop',
      durationMs: 90,
      trauma: 0.72,
    });
  }

  if (hpRatio <= 0.33 && e.bossPhase < 3) {
    e.bossPhase = 3;
    e.bossPhaseTransitionTimer = 1.2;
    e.attackCooldownTimer = 0;
    e.aiState = 'telegraph';
    e.stateTimer = Math.max(0.55, e.telegraphDurationSec);
    e.telegraphAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    e.vx = 0;
    e.vy = 0;
    e.bossBurrowed = false;
    clearBossNearbyProjectiles(this, e.x, e.y, 140);
    if (e.defId === 'kryssa_ice_queen') {
      this.blizzardVeilActive = true;
      this.map.applyBossPhase3BlizzardBorder();
      if (this.getActivePlayerCount() >= 3) {
        this.spawnBossGuardianMushrooms();
      }
    } else if (e.defId === 'forge_titan') {
      this.map.applyBossPhase3LavaBorder();
    } else {
      this.map.applyBossPhase3ToxicBorder();
    }
    this.events.push({
      kind: 'boss_phase_changed',
      enemyId: e.id,
      phase: 3,
      x: e.x,
      y: e.y,
    });
    this.events.push({
      kind: 'hit_stop',
      durationMs: 110,
      trauma: 0.85,
    });
  }
}
