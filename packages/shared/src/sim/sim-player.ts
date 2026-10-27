import type { ElementType, WeaponStatsDef } from '../data/types.js';
import { approach, distance, isCircleInCone } from '../math/vec2.js';
import { INPUT_BUTTON, type PlayerInputPacket, TILE_SIZE } from '../protocol/messages.js';
import type { SurfaceKind } from './arena-map.js';
import { findNearestWalkablePoint, getConveyorVelocityAtWorld } from './arena-room-archetypes.js';
import {
  onPlayerDashStarted,
  onPlayerDashStep,
  tickPlayerDashAndReloadBlessingTimers,
} from './sim-blessings.js';
import {
  BIOME1_POLLEN_SPEED_MULTIPLIER,
  triggerGrassPollenSpeedBoost,
  triggerMeleeKickProps,
} from './sim-tactical-physics.js';
import {
  switchPlayerWeaponSlot,
  tryFireActiveWeaponImpl,
  updatePlayerWeaponCadence,
} from './sim-weapon-cadence.js';
import {
  FRAG_LAUNCHER_MAIN_BLAST_RADIUS,
  spawnFragLauncherSubmunitions,
  spawnSeedGunLifeBud,
  upsertTetherStaffBeamImpl,
} from './sim-weapon-specials.js';
import {
  DASH_COOLDOWN_SEC,
  DASH_DURATION_SEC,
  DASH_IFRAME_SEC,
  DASH_SPEED_MULTIPLIER,
  type SimPlayerState,
  type SimProjectileState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export { tryFireActiveWeaponImpl };

export function updatePlayerImpl(this: WorldSim, dtSec: number): void {
  const inp = this.currentInput;
  const justPressed = (inp.buttons & ~this.prevButtons) | this.latchedButtons;
  const selectedSlot = this.latchedWeaponSlot ?? inp.weaponSlotSelect;
  this.updateSinglePlayerState(this.player, inp, justPressed, selectedSlot ?? null, dtSec);
}

export function updateSinglePlayerStateImpl(this: WorldSim,
  p: SimPlayerState,
  inp: PlayerInputPacket,
  justPressed: number,
  selectedSlot: number | null,
  dtSec: number,
): void {
  p.aimAngle = inp.aimAngle;
  const aimInp = inp as PlayerInputPacket & { aimWorldX?: number; aimWorldY?: number };
  if (typeof aimInp.aimWorldX === 'number' && typeof aimInp.aimWorldY === 'number') {
    p.aimWorldX = aimInp.aimWorldX;
    p.aimWorldY = aimInp.aimWorldY;
  }

  if (p.emoteTimer > 0) {
    p.emoteTimer = Math.max(0, p.emoteTimer - dtSec);
    if (p.emoteTimer <= 0) {
      p.emoteId = null;
    }
  }
  if ((p.weaponPickupLockTimer ?? 0) > 0) {
    const nextLock = (p.weaponPickupLockTimer ?? 0) - dtSec;
    p.weaponPickupLockTimer = nextLock < 1e-6 ? 0 : nextLock;
  }

  if (justPressed & INPUT_BUTTON.PING) {
    const px =
      typeof inp.pingWorldX === 'number' ? inp.pingWorldX : p.x + Math.cos(p.aimAngle) * 110;
    const py =
      typeof inp.pingWorldY === 'number' ? inp.pingWorldY : p.y + Math.sin(p.aimAngle) * 110;
    this.triggerPing(p.id, px, py);
  }

  if (justPressed & INPUT_BUTTON.READY) {
    if (this.inHub) {
      this.togglePlayerReady(p.id);
    }
  }

  if (justPressed & INPUT_BUTTON.DROP_WEAPON) {
    this.dropActiveWeapon(p.id);
  }

  // Downed or Ghost players can only move slowly (crawl/float) and Ping/Emote
  if (p.lifeState !== 'alive') {
    let dirX = inp.moveX;
    let dirY = inp.moveY;
    const len = Math.hypot(dirX, dirY);
    if (len > 1e-4) {
      dirX /= len;
      dirY /= len;
    } else {
      dirX = 0;
      dirY = 0;
    }
    const crawlSpeed = p.lifeState === 'downed' ? 38 : p.moveSpeed * 0.85;
    p.vx = dirX * crawlSpeed;
    p.vy = dirY * crawlSpeed;
    const col = this.map.resolveCircleCollision(p.x + p.vx * dtSec, p.y + p.vy * dtSec, p.radius);
    p.x = col.x;
    p.y = col.y;
    return;
  }

  // Phase 6 Kryssa Phase 3 Ice Prison: encased players must be freed by teammates or solo button mashing
  if (p.icePrisonId && p.icePrisonId > 0) {
    const prison = this.enemies.find((e) => e.id === p.icePrisonId && e.hp > 0);
    if (!prison) {
      p.icePrisonId = 0;
      p.encasedInIceTimer = 0;
    } else {
      p.x = prison.x;
      p.y = prison.y;
      p.vx = 0;
      p.vy = 0;
      if (p.dashCooldownTimer > 0) p.dashCooldownTimer = Math.max(0, p.dashCooldownTimer - dtSec);
      if (p.invulnerableTimer > 0) p.invulnerableTimer = Math.max(0, p.invulnerableTimer - dtSec);
      if (p.hurtFlashTimer > 0) p.hurtFlashTimer = Math.max(0, p.hurtFlashTimer - dtSec);
      if (p.skillCooldownTimer > 0) p.skillCooldownTimer = Math.max(0, p.skillCooldownTimer - dtSec);
      p.encasedInIceTimer = Math.max(0, (p.encasedInIceTimer ?? 4.5) - dtSec);
      const struggling =
        justPressed !== 0 ||
        Math.hypot(inp.moveX, inp.moveY) > 0.1 ||
        (inp.buttons & (INPUT_BUTTON.FIRE | INPUT_BUTTON.DASH | INPUT_BUTTON.INTERACT)) !== 0;
      if (struggling || this.getActivePlayerCount() === 1) {
        const breakRate = this.getActivePlayerCount() === 1 ? 26 : 12;
        const mashBonus = justPressed !== 0 ? 7 : 0;
        prison.hp = Math.max(0, prison.hp - (breakRate * dtSec + mashBonus));
        if (prison.hp <= 0) {
          this.handleEnemyKilled(prison);
          p.icePrisonId = 0;
          p.encasedInIceTimer = 0;
          return;
        }
      }
      if ((p.encasedInIceTimer ?? 0) <= 0) {
        prison.hp = 0;
        this.handleEnemyKilled(prison);
        p.icePrisonId = 0;
        p.encasedInIceTimer = 0;
        this.applyDamageToPlayer(1, 0, 80, 'ice_prison', p);
      }
      return;
    }
  }

  if (
    typeof selectedSlot === 'number' &&
    selectedSlot >= 0 &&
    selectedSlot < p.weaponSlots.length
  ) {
    if (p.id === this.player.id) {
      this.equipWeaponSlot(selectedSlot);
    } else {
      switchPlayerWeaponSlot(this, p, selectedSlot);
    }
  } else if (justPressed & INPUT_BUTTON.SWAP) {
    if (p.id === this.player.id) {
      this.cycleWeapon(1);
    } else if (p.weaponSlots.length > 1) {
      switchPlayerWeaponSlot(this, p, (p.activeWeaponSlot + 1) % p.weaponSlots.length);
    }
  }

  if (justPressed & INPUT_BUTTON.INTERACT) {
    this.interactWithNearest(p);
  }

  if (p.dashCooldownTimer > 0) p.dashCooldownTimer = Math.max(0, p.dashCooldownTimer - dtSec);
  if (p.invulnerableTimer > 0) p.invulnerableTimer = Math.max(0, p.invulnerableTimer - dtSec);
  if (p.hurtFlashTimer > 0) p.hurtFlashTimer = Math.max(0, p.hurtFlashTimer - dtSec);
  if (p.fireCooldownTimer > 0) p.fireCooldownTimer = Math.max(0, p.fireCooldownTimer - dtSec);
  if (p.recoilTimer > 0) p.recoilTimer = Math.max(0, p.recoilTimer - dtSec);
  if (p.skillCooldownTimer > 0) p.skillCooldownTimer = Math.max(0, p.skillCooldownTimer - dtSec);
  if (p.grassRustleCooldown > 0)
    p.grassRustleCooldown = Math.max(0, p.grassRustleCooldown - dtSec);
  const hadConvergenceBeforeTick = p.elementalConvergenceTimer > 0;
  if (p.elementalConvergenceTimer > 0) {
    const nextConv = p.elementalConvergenceTimer - dtSec;
    p.elementalConvergenceTimer = nextConv < 1e-6 ? 0 : nextConv;
  }
  if ((p.pollenSpeedBoostTimer ?? 0) > 0) {
    const nextPollen = (p.pollenSpeedBoostTimer ?? 0) - dtSec;
    p.pollenSpeedBoostTimer = nextPollen < 1e-6 ? 0 : nextPollen;
  }
  if ((p.seedGunHealIcdTimer ?? 0) > 0) {
    const nextSeedIcd = (p.seedGunHealIcdTimer ?? 0) - dtSec;
    p.seedGunHealIcdTimer = nextSeedIcd < 1e-6 ? 0 : nextSeedIcd;
  }
  if ((p.tableTechRocketIcdTimer ?? 0) > 0) {
    const nextRocketIcd = (p.tableTechRocketIcdTimer ?? 0) - dtSec;
    p.tableTechRocketIcdTimer = nextRocketIcd < 1e-6 ? 0 : nextRocketIcd;
  }
  tickPlayerDashAndReloadBlessingTimers(p, dtSec);
  updatePlayerWeaponCadence(this, p, justPressed, inp.buttons, dtSec);

  // Engineer passive: allies within 4 tiles (128u) regenerate armor 15% faster!
  let hasNearbyEngineer = p.characterId === 'engineer' && p.lifeState === 'alive';
  if (!hasNearbyEngineer && !this.stressTestActive) {
    if (
      this.player.characterId === 'engineer' &&
      this.player.lifeState === 'alive' &&
      distance(p.x, p.y, this.player.x, this.player.y) <= TILE_SIZE * 4
    ) {
      hasNearbyEngineer = true;
    } else {
      for (let i = 0; i < this.simulatedPlayers.length; i++) {
        const ally = this.simulatedPlayers[i]!;
        if (
          ally.characterId === 'engineer' &&
          ally.lifeState === 'alive' &&
          distance(p.x, p.y, ally.x, ally.y) <= TILE_SIZE * 4
        ) {
          hasNearbyEngineer = true;
          break;
        }
      }
    }
  }
  const armorRegenRate = p.armorRegenPerSec * (hasNearbyEngineer ? 1.15 : 1.0);

  if (p.armorRegenTimer > 0) {
    const nextArmorDelay = p.armorRegenTimer - dtSec;
    p.armorRegenTimer = nextArmorDelay < 1e-6 ? 0 : nextArmorDelay;
    p.armorRegenAccum = 0;
  } else if (p.armor < p.maxArmor && p.hp > 0) {
    p.armorRegenAccum += dtSec * armorRegenRate;
    if (p.armorRegenAccum + 1e-6 >= 1) {
      const pts = Math.floor(p.armorRegenAccum + 1e-6);
      p.armorRegenAccum = Math.max(0, p.armorRegenAccum - pts);
      p.armor = Math.min(p.maxArmor, p.armor + pts);
    }
  }

  // Surface under player
  const surf = this.map.getSurfaceAtWorld(p.x, p.y);
  this.updatePlayerSurfaceAndStatus(p, surf, dtSec);

  let dirX = inp.moveX;
  let dirY = inp.moveY;
  if (this.stressTestActive && dirX === 0 && dirY === 0) {
    const orbitAng = this.tick * 0.035;
    dirX = Math.cos(orbitAng);
    dirY = Math.sin(orbitAng);
    p.aimAngle = orbitAng + Math.PI * 0.5;
  }

  const len = Math.hypot(dirX, dirY);
  if (len > 1e-4) {
    dirX /= len;
    dirY /= len;
  } else {
    dirX = 0;
    dirY = 0;
  }

  const triggerDash =
    (justPressed & INPUT_BUTTON.DASH) !== 0 ||
    (this.stressTestActive && p.dashCooldownTimer <= 0 && this.tick % 90 === 0);

  if (triggerDash && p.dashCooldownTimer <= 0 && p.dashTimer <= 0) {
    const dashCd = DASH_COOLDOWN_SEC;
    p.dashTimer = DASH_DURATION_SEC;
    p.invulnerableTimer = Math.max(p.invulnerableTimer, DASH_IFRAME_SEC);
    p.dashCooldownTimer = dashCd;
    if (dirX !== 0 || dirY !== 0) {
      p.dashDirX = dirX;
      p.dashDirY = dirY;
    } else {
      p.dashDirX = Math.cos(p.aimAngle);
      p.dashDirY = Math.sin(p.aimAngle);
    }
    const dashSpeed = p.moveSpeed * DASH_SPEED_MULTIPLIER;
    p.vx = p.dashDirX * dashSpeed;
    p.vy = p.dashDirY * dashSpeed;
    if (surf === 'grass') {
      triggerGrassPollenSpeedBoost(this, p);
    }
    onPlayerDashStarted(this, p);
    this.events.push({
      kind: 'dash_started',
      playerId: p.id,
      x: p.x,
      y: p.y,
      dirX: p.dashDirX,
      dirY: p.dashDirY,
    });
  }

  if (justPressed & INPUT_BUTTON.SKILL) {
    this.activateCharacterSkill(p);
  }

  if (p.skillActiveTimer > 0) {
    p.skillActiveTimer -= dtSec;
    if (p.skillActiveTimer <= 0) {
      if (p.characterId === 'vanguard') {
        this.releaseVanguardShieldShockwave(p);
      } else {
        p.skillActiveTimer = 0;
      }
    }
  }

  // Surface speed & friction modifiers (oil slows by 15%, ice reduces traction; Elemental Convergence grants +20% speed)
  let speedMult = hadConvergenceBeforeTick || p.elementalConvergenceTimer > 0 ? 1.2 : 1.0;
  const activeWepId = p.weaponSlots[p.activeWeaponSlot ?? 0] ?? p.weaponSlots[0] ?? 'knight_sword';
  if (
    activeWepId === 'gale_smg' &&
    (inp.buttons & INPUT_BUTTON.FIRE) !== 0 &&
    p.overheatLockTimer <= 0
  ) {
    speedMult *= 1.15;
  }
  if ((p.pollenSpeedBoostTimer ?? 0) > 0) speedMult *= BIOME1_POLLEN_SPEED_MULTIPLIER;
  if (surf === 'oil' || surf === 'poison_swamp') speedMult *= 0.85;
  if (p.chillTimer > 0) speedMult *= 0.7;

  const wasDashingThisStep = p.dashTimer > 0;
  const preMoveX = p.x;
  const preMoveY = p.y;

  if (p.dashTimer > 0) {
    p.dashTimer = Math.max(0, p.dashTimer - dtSec);
    const dashSpeed = p.moveSpeed * DASH_SPEED_MULTIPLIER;
    p.vx = p.dashDirX * dashSpeed;
    p.vy = p.dashDirY * dashSpeed;
  } else {
    const effectiveSpeed = p.moveSpeed * speedMult;
    const targetVx = dirX * effectiveSpeed;
    const targetVy = dirY * effectiveSpeed;
    let accelRate = dirX !== 0 || dirY !== 0 ? effectiveSpeed / 0.055 : effectiveSpeed / 0.045;
    if (surf === 'ice') {
      accelRate *= dirX !== 0 || dirY !== 0 ? 0.32 : 0.16;
    }
    const maxDeltaV = accelRate * dtSec;
    p.vx = approach(p.vx, targetVx, maxDeltaV);
    p.vy = approach(p.vy, targetVy, maxDeltaV);
  }

  const kbDecay = Math.exp(-14 * dtSec);
  p.kbVx *= kbDecay;
  p.kbVy *= kbDecay;
  if (Math.abs(p.kbVx) < 1) p.kbVx = 0;
  if (Math.abs(p.kbVy) < 1) p.kbVy = 0;

  const conveyorVx = getConveyorVelocityAtWorld(this.map, p.x, p.y);
  const nextX = p.x + (p.vx + p.kbVx + conveyorVx) * dtSec;
  const nextY = p.y + (p.vy + p.kbVy) * dtSec;
  const col = this.map.resolveCircleCollision(
    nextX,
    nextY,
    p.radius,
    wasDashingThisStep || p.dashTimer > 0 || surf === 'chasm',
  );
  p.x = col.x;
  p.y = col.y;
  if (!this.stressTestActive) this.resolvePropMovementCollision(p);
  if (wasDashingThisStep) {
    onPlayerDashStep(this, p, preMoveX, preMoveY);
  }

  if (!this.stressTestActive && p.dashTimer <= 0 && this.map.getSurfaceAtWorld(p.x, p.y) === 'chasm') {
    const safePt = findNearestWalkablePoint(this.map, p.x, p.y, p.radius);
    p.x = safePt.x;
    p.y = safePt.y;
  }

  if (!this.stressTestActive && surf === 'grass' && Math.hypot(p.vx, p.vy) > 25 && p.grassRustleCooldown <= 0) {
    p.grassRustleCooldown = 0.22;
    this.events.push({ kind: 'grass_rustle', x: p.x, y: p.y });
  }

  if (
    !this.stressTestActive &&
    this.doorTransitionCooldown <= 0 &&
    this.portalActive &&
    (dirX !== 0 || dirY !== 0) &&
    distance(p.x, p.y, this.portalX, this.portalY) <= 26
  ) {
    if (this.inHub) {
      p.ready = true;
      if (this.areAllPlayersReady() || p.slot === 1) {
        this.startDungeonRunFromHub();
      }
    } else if (
      !this.hasActiveCombatEnemies() &&
      (this.runState === 'playing' || (this.runState === 'victory' && this.currentFloor < 6))
    ) {
      this.enterPortal();
    }
  }

  if (inp.buttons & INPUT_BUTTON.FIRE && p.fireCooldownTimer <= 0 && p.hp > 0) {
    this.tryFireActiveWeapon(p);
  }

  if (
    !this.inHub &&
    !this.stressTestActive &&
    this.doorTransitionCooldown <= 0 &&
    !this.hasActiveCombatEnemies()
  ) {
    for (let i = 0; i < this.doors.length; i++) {
      const door = this.doors[i]!;
      if (door.locked) continue;
      if (distance(p.x, p.y, door.x, door.y) <= 44) {
        const movingIntoDoor =
          (door.dir === 'N' && dirY < -0.3) ||
          (door.dir === 'S' && dirY > 0.3) ||
          (door.dir === 'W' && dirX < -0.3) ||
          (door.dir === 'E' && dirX > 0.3);
        if (movingIntoDoor) {
          this.enterRoom(door.targetRoomId, door.dir);
          break;
        }
      }
    }
  }
}

export function updateSimulatedPlayersImpl(this: WorldSim, dtSec: number): void {
  if (!this.stressTestActive) {
    for (let i = 0; i < this.simulatedPlayers.length; i++) {
      const sp = this.simulatedPlayers[i]!;
      const entry = this.coopPlayerInputs.get(sp.id);
      if (entry) {
        const justPressed = (entry.current.buttons & ~entry.prevButtons) | entry.latchedButtons;
        const selectedSlot = entry.latchedWeaponSlot ?? entry.current.weaponSlotSelect;
        this.updateSinglePlayerState(sp, entry.current, justPressed, selectedSlot ?? null, dtSec);
        entry.prevButtons = entry.current.buttons;
        entry.latchedButtons = 0;
        entry.latchedWeaponSlot = null;
      }
    }
    return;
  }

  const cx = this.map.width * 0.5;
  const cy = this.map.height * 0.5;

  for (let i = 0; i < this.simulatedPlayers.length; i++) {
    const sp = this.simulatedPlayers[i]!;
    const phase = this.tick * 0.03 + (i + 1) * 2.09;
    const targetX = cx + Math.cos(phase) * 220;
    const targetY = cy + Math.sin(phase * 1.3) * 140;
    const dx = targetX - sp.x;
    const dy = targetY - sp.y;
    const dist = Math.hypot(dx, dy);

    sp.aimAngle = phase + Math.PI * 0.5;
    if (sp.dashCooldownTimer > 0)
      sp.dashCooldownTimer = Math.max(0, sp.dashCooldownTimer - dtSec);
    if (sp.dashTimer > 0) {
      sp.dashTimer = Math.max(0, sp.dashTimer - dtSec);
      sp.vx = sp.dashDirX * sp.moveSpeed * DASH_SPEED_MULTIPLIER;
      sp.vy = sp.dashDirY * sp.moveSpeed * DASH_SPEED_MULTIPLIER;
    } else if (sp.dashCooldownTimer <= 0 && (this.tick + i * 31) % 95 === 0) {
      sp.dashTimer = DASH_DURATION_SEC;
      sp.dashCooldownTimer = DASH_COOLDOWN_SEC;
      sp.dashDirX = dist > 1 ? dx / dist : 1;
      sp.dashDirY = dist > 1 ? dy / dist : 0;
      this.events.push({
        kind: 'dash_started',
        playerId: sp.id,
        x: sp.x,
        y: sp.y,
        dirX: sp.dashDirX,
        dirY: sp.dashDirY,
      });
    } else if (dist > 4) {
      sp.vx = (dx / dist) * sp.moveSpeed;
      sp.vy = (dy / dist) * sp.moveSpeed;
    } else {
      sp.vx = 0;
      sp.vy = 0;
    }

    const col = this.map.resolveCircleCollision(
      sp.x + sp.vx * dtSec,
      sp.y + sp.vy * dtSec,
      sp.radius,
    );
    sp.x = col.x;
    sp.y = col.y;
  }
}

export function updatePlayerSurfaceAndStatusImpl(this: WorldSim, p: SimPlayerState, surf: SurfaceKind, dtSec: number): void {
  if (surf === 'water') {
    p.burnTimer = 0;
    p.surfaceTickTimer = 0;
  } else if (
    (surf === 'burning_oil' || surf === 'burning_grass' || surf === 'lava') &&
    p.dashTimer <= 0
  ) {
    p.surfaceTickTimer += dtSec;
    if (p.surfaceTickTimer >= 0.35) {
      p.surfaceTickTimer = 0;
      p.burnTimer = Math.max(p.burnTimer, 1.6);
    }
  } else if (surf === 'poison_swamp' && p.dashTimer <= 0) {
    p.surfaceTickTimer += dtSec;
    if (p.surfaceTickTimer >= 1.35) {
      p.surfaceTickTimer = 0;
      p.poisonTimer = Math.max(p.poisonTimer, 2.0);
    }
  } else if (surf === 'electrified_water' && p.dashTimer <= 0) {
    p.surfaceTickTimer += dtSec;
    if (p.surfaceTickTimer >= 0.75) {
      p.surfaceTickTimer = 0;
      this.applyDamageToPlayer(1, 0, 20, 'electrified_water', p);
    }
  } else {
    p.surfaceTickTimer = Math.max(0, p.surfaceTickTimer - dtSec * 2);
  }

  if (p.burnTimer > 0) {
    p.burnTimer = Math.max(0, p.burnTimer - dtSec);
    p.burnTickTimer += dtSec;
    if (p.burnTickTimer >= 0.8) {
      p.burnTickTimer = 0;
      this.applyDamageToPlayer(1, 0, 10, 'burn', p);
    }
  }
  if (p.poisonTimer > 0) {
    p.poisonTimer = Math.max(0, p.poisonTimer - dtSec);
    p.poisonTickTimer += dtSec;
    if (p.poisonTickTimer >= 1.0) {
      p.poisonTickTimer = 0;
      this.applyDamageToPlayer(1, 0, 10, 'poison', p);
    }
  }
  if (p.chillTimer > 0) {
    p.chillTimer = Math.max(0, p.chillTimer - dtSec);
  }
}

export function spawnSeedGunLifeBlossomImpl(
  this: WorldSim,
  ownerId: number,
  x: number,
  y: number,
): void {
  spawnSeedGunLifeBud(this, ownerId, x, y);
}

export function triggerLauncherProjectileExplosionImpl(
  this: WorldSim,
  b: SimProjectileState,
  x: number,
  y: number,
): void {
  if (this.stressTestActive || b.finaleResolved) return;
  b.finaleResolved = true;
  const blastR =
    b.explosionRadius && b.explosionRadius > 0
      ? b.explosionRadius
      : b.weaponId === 'frag_launcher'
        ? FRAG_LAUNCHER_MAIN_BLAST_RADIUS
        : 64;
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
    const isFullBlastWeapon =
      b.weaponId === 'apprentice_staff' ||
      b.weaponId === 'knight_sword_parry' ||
      b.weaponId === 'frag_launcher' ||
      b.weaponId === 'reload_tediore_chuck';
    const blastDmg = isFullBlastWeapon ? b.damage : Math.max(6, Math.round(b.damage * 0.65));
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
        const ang = b.airburstBypassShield ? e.aimAngle : Math.atan2(e.y - y, e.x - x);
        this.applyDamageToEnemy(e, blastDmg, false, b.element, ang, 160, true, b.ownerId);
      }
    }
    if (b.weaponId === 'frag_launcher') {
      spawnFragLauncherSubmunitions(this, b, x, y);
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

export function resolveMeleeConeHitsAndSynergies(
  sim: WorldSim,
  p: SimPlayerState,
  w: WeaponStatsDef,
  arcRad: number,
  halfArc: number,
  meleeRange: number,
  baseMeleeDmg: number,
  stepKnockback: number,
  critChance: number,
  shotElement: ElementType,
  shotFlags: number,
  bulletsDestroyed: number,
  alreadyHitEnemyIds?: Set<number>,
): boolean {
  triggerMeleeKickProps(sim, p, halfArc, meleeRange + 6, p.aimAngle);
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (!prop.destructible || prop.hp <= 0 || prop.coverState === 'sliding') continue;
    if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, meleeRange + 6, prop)) {
      prop.fallAngle = p.aimAngle;
      sim.damageProp(prop, baseMeleeDmg, shotElement);
    }
  }

  const swingHitEnemyIds = alreadyHitEnemyIds ?? new Set<number>();
  let hitAny = swingHitEnemyIds.size > 0;
  let anyCrit = false;
  const meleeEnemyCount = sim.enemies.length;
  for (let i = 0; i < meleeEnemyCount; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.aiState === 'spawning' || swingHitEnemyIds.has(e.id)) continue;
    if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, meleeRange, e)) {
      const isCrit = sim.rng.chance(critChance);
      const dmg = isCrit ? Math.round(baseMeleeDmg * 1.5) : baseMeleeDmg;
      const hitAngle = Math.atan2(e.y - p.y, e.x - p.x);
      sim.applyDamageToEnemy(e, dmg, isCrit, shotElement, hitAngle, stepKnockback, true, p.id);
      swingHitEnemyIds.add(e.id);
      hitAny = true;
      if (isCrit) anyCrit = true;
    }
  }

  if (w.id === 'thunder_hammer') {
    const startIdx = sim.projectiles.length;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: p.id,
      team: 'player',
      weaponId: w.id,
      x: p.x + Math.cos(p.aimAngle) * 18,
      y: p.y + Math.sin(p.aimAngle) * 18,
      angle: p.aimAngle,
      pelletCount: 3,
      spreadRad: 0.42,
      speed: w.projectileSpeed || 540,
      damage: Math.round(baseMeleeDmg * 0.75),
      radius: 6,
      knockback: stepKnockback * 0.7,
      pierceCount: 2,
      bounceCount: 0,
      ttlSec: 0.85,
      element: 'shock',
      critChance,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      shotFlags,
      flags: shotFlags,
    });
    for (let bIdx = startIdx; bIdx < sim.projectiles.length; bIdx++) {
      const bolt = sim.projectiles[bIdx]!;
      for (const hitId of swingHitEnemyIds) {
        if (!bolt.hitEntityIds.includes(hitId)) bolt.hitEntityIds.push(hitId);
      }
      for (let eIdx = 0; eIdx < meleeEnemyCount; eIdx++) {
        const e = sim.enemies[eIdx]!;
        if (distance(p.x, p.y, e.x, e.y) <= meleeRange + e.radius + 16 && !bolt.hitEntityIds.includes(e.id)) {
          bolt.hitEntityIds.push(e.id);
        }
      }
    }
  }

  const isVanguardSwordWave = p.characterId === 'vanguard' && p.skillActiveTimer > 0;
  if (isVanguardSwordWave) {
    const waveHalfArc = (32 * Math.PI) / 180;
    const waveRange = 200;
    let waveElement: ElementType = shotElement;
    let waveSecondaryElement: ElementType = 'none';
    let waveImbueOwnerId = p.id;
    let waveDmgMult = 1.15;

    for (let zIdx = 0; zIdx < sim.skillZones.length; zIdx++) {
      const z = sim.skillZones[zIdx]!;
      if (z.ttlSec <= 0) continue;
      if (isCircleInCone(p.x, p.y, p.aimAngle, waveHalfArc, waveRange, z)) {
        waveDmgMult *= 1.15;
        waveImbueOwnerId = z.ownerPlayerId;
        if (waveElement === 'none') {
          waveElement = z.element;
          if (z.secondaryElement && z.secondaryElement !== 'none') {
            waveSecondaryElement = z.secondaryElement;
          }
        } else {
          waveSecondaryElement = z.element;
        }
        break;
      }
    }

    const waveEnemyCount = sim.enemies.length;
    for (let i = 0; i < waveEnemyCount; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0 || e.aiState === 'spawning') continue;
      if (
        !isCircleInCone(p.x, p.y, p.aimAngle, halfArc, meleeRange, e) &&
        isCircleInCone(p.x, p.y, p.aimAngle, waveHalfArc, waveRange, e)
      ) {
        const isCrit = sim.rng.chance(critChance);
        const rawWaveDmg = Math.round(baseMeleeDmg * waveDmgMult);
        const dmg = isCrit ? Math.round(rawWaveDmg * 1.5) : rawWaveDmg;
        const hitAngle = Math.atan2(e.y - p.y, e.x - p.x);
        if (waveSecondaryElement !== 'none') {
          sim.applyElementStatusToEnemy(e, waveSecondaryElement, dmg, waveImbueOwnerId);
        }
        const effectiveAttackerId =
          waveImbueOwnerId !== p.id && e.lastElementOwnerId === p.id ? waveImbueOwnerId : p.id;
        sim.applyDamageToEnemy(
          e,
          dmg,
          isCrit,
          waveElement,
          hitAngle,
          stepKnockback * 0.85,
          true,
          effectiveAttackerId,
        );
        hitAny = true;
        if (isCrit) anyCrit = true;
      }
    }
  }

  sim.events.push({
    kind: 'melee_swing',
    playerId: p.id,
    weaponId: w.id,
    x: p.x,
    y: p.y,
    angle: p.aimAngle,
    arcRad,
    range: isVanguardSwordWave ? 200 : meleeRange,
    bulletsDestroyed,
  });

  if (hitAny) {
    sim.events.push({
      kind: 'hit_stop',
      durationMs: anyCrit ? 50 : 35,
      trauma: anyCrit ? 0.36 : 0.24,
    });
  }
  return hitAny;
}

export function upsertTetherStaffBeam(
  sim: WorldSim,
  p: SimPlayerState,
  baseDmg: number,
): void {
  upsertTetherStaffBeamImpl(sim, p, baseDmg);
}
