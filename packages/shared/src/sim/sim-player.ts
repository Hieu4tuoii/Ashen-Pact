import { CHARACTERS } from '../data/characters.js';
import type { ElementType } from '../data/types.js';
import { WEAPONS } from '../data/weapons.js';
import { approach, clamp, distance, isCircleInCone } from '../math/vec2.js';
import { INPUT_BUTTON, type PlayerInputPacket, TILE_SIZE } from '../protocol/messages.js';
import type { SurfaceKind } from './arena-map.js';
import { DASH_DURATION_SEC, DASH_IFRAME_SEC, DASH_COOLDOWN_SEC, DASH_SPEED_MULTIPLIER, MELEE_RANGE, type SimPlayerState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

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
    } else if (p.activeWeaponSlot !== selectedSlot) {
      p.activeWeaponSlot = selectedSlot;
      p.fireCooldownTimer = Math.min(p.fireCooldownTimer, 0.08);
      this.events.push({
        kind: 'weapon_swapped',
        playerId: p.id,
        weaponId: p.weaponSlots[selectedSlot]!,
        slot: selectedSlot,
      });
    }
  } else if (justPressed & INPUT_BUTTON.SWAP) {
    if (p.id === this.player.id) {
      this.cycleWeapon(1);
    } else if (p.weaponSlots.length > 1) {
      p.activeWeaponSlot = (p.activeWeaponSlot + 1) % p.weaponSlots.length;
      p.fireCooldownTimer = Math.min(p.fireCooldownTimer, 0.08);
      this.events.push({
        kind: 'weapon_swapped',
        playerId: p.id,
        weaponId: p.weaponSlots[p.activeWeaponSlot]!,
        slot: p.activeWeaponSlot,
      });
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

  if (p.energyRegenDelayTimer > 0) {
    const nextEnergyDelay = p.energyRegenDelayTimer - dtSec;
    p.energyRegenDelayTimer = nextEnergyDelay < 1e-6 ? 0 : nextEnergyDelay;
  } else if (p.energy < p.maxEnergy) {
    const regenMult = this.activeBuffIds.includes('arcane_wellspring') ? 1.5 : 1.0;
    p.energyRegenAccum += dtSec * 1.5 * regenMult;
    if (p.energyRegenAccum + 1e-6 >= 1) {
      const gain = Math.floor(p.energyRegenAccum + 1e-6);
      p.energyRegenAccum = Math.max(0, p.energyRegenAccum - gain);
      p.energy = Math.min(p.maxEnergy, p.energy + gain);
    }
  }
  if (p.energy >= p.maxEnergy) {
    p.energyRegenAccum = 0;
  }

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
    const dashCd = this.activeBuffIds.includes('gale_reflex')
      ? DASH_COOLDOWN_SEC * 0.82
      : DASH_COOLDOWN_SEC;
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

  // Surface speed & friction modifiers (oil slows by 15%, ice reduces traction)
  let speedMult = 1.0;
  if (surf === 'oil' || surf === 'poison_swamp') speedMult *= 0.85;
  if (p.chillTimer > 0) speedMult *= 0.7;

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

  const conveyorVx = surf === 'conveyor' ? this.map.conveyorDirection * 62 : 0;
  const prevSafeX = p.x;
  const prevSafeY = p.y;
  const nextX = p.x + (p.vx + p.kbVx + conveyorVx) * dtSec;
  const nextY = p.y + (p.vy + p.kbVy) * dtSec;
  const col = this.map.resolveCircleCollision(nextX, nextY, p.radius);
  p.x = col.x;
  p.y = col.y;
  this.resolvePropMovementCollision(p);

  // Chasm hazard (Biome 2): walking onto a chasm tile without dashing pushes back to safe ledge and deals 1 damage
  const nextSurf = this.map.getSurfaceAtWorld(p.x, p.y);
  if (
    surf !== 'chasm' &&
    nextSurf === 'chasm' &&
    p.dashTimer <= 0 &&
    !this.botAutoPlayActive &&
    !this.stressTestActive
  ) {
    const chasmCenterX = Math.floor(p.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE * 0.5;
    const chasmCenterY = Math.floor(p.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE * 0.5;
    const pushAng = Math.atan2(prevSafeY - chasmCenterY, prevSafeX - chasmCenterX);
    p.x = prevSafeX;
    p.y = prevSafeY;
    this.applyDamageToPlayer(1, pushAng, 60, 'chasm', p);
    p.kbVx = 0;
    p.kbVy = 0;
  }

  if (surf === 'grass' && Math.hypot(p.vx, p.vy) > 25 && p.grassRustleCooldown <= 0) {
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

export function tryFireActiveWeaponImpl(this: WorldSim, p: SimPlayerState = this.player): void {
  const weaponId = p.weaponSlots[p.activeWeaponSlot] ?? p.weaponSlots[0] ?? 'knight_sword';
  const w = WEAPONS[weaponId];
  if (!w) return;

  const cost = p.godMode ? 0 : w.energyCost;
  if (p.energy < cost) {
    return;
  }

  const hasGaleReflex = this.activeBuffIds.includes('gale_reflex');
  const hasEaglePrecision = this.activeBuffIds.includes('eagle_precision');
  const hasRicochetMastery = this.activeBuffIds.includes('ricochet_mastery');

  if (cost > 0) {
    p.energy = Math.max(0, p.energy - cost);
    p.energyRegenDelayTimer = 2.0;
    p.energyRegenAccum = 0;
  }
  const effectiveFireRate = w.fireRate * (hasGaleReflex ? 1.22 : 1);
  p.fireCooldownTimer = 1 / effectiveFireRate;
  p.recoilTimer = 0.12;
  const shotElement: ElementType =
    p.activeImbueElement !== 'none' ? p.activeImbueElement : w.element;

  if (w.category === 'melee') {
    const arcRad = (w.spreadDeg * Math.PI) / 180;
    const halfArc = arcRad / 2;
    const meleeRange =
      w.id === 'thunder_hammer'
        ? MELEE_RANGE + 20
        : w.id === 'berserker_axe'
          ? MELEE_RANGE + 10
          : MELEE_RANGE;
    let bulletsDestroyed = 0;

    if (w.destroysEnemyBullets) {
      this.rebuildEnemyBulletSpatialGrid();
      const nearbyBullets = this.bulletSpatialGrid.queryCircle(
        p.x,
        p.y,
        meleeRange + 12,
        this.queryBulletScratch,
      );
      for (let i = 0; i < nearbyBullets.length; i++) {
        const b = nearbyBullets[i]!;
        if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
        if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, meleeRange + 8, b)) {
          b.ttlSec = 0;
          bulletsDestroyed += 1;
          const shieldActive = p.characterId === 'vanguard' && p.skillActiveTimer > 0;
          if (shieldActive) {
            p.shieldStoredBullets += 1;
            p.energy = Math.min(p.maxEnergy, p.energy + 1);
          }
          this.events.push({
            kind: 'projectile_impact',
            x: b.x,
            y: b.y,
            angle: p.aimAngle,
            team: 'enemy',
            hitWall: false,
            destroyedByMelee: true,
            blockedByShield: shieldActive,
            isCrit: false,
          });
        }
      }
    }

    // Hit props in melee cone
    const baseMeleeDmg = hasEaglePrecision ? Math.round(w.damage * 1.2) : w.damage;
    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i]!;
      if (!prop.destructible || prop.hp <= 0) continue;
      if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, meleeRange + 6, prop)) {
        this.damageProp(prop, baseMeleeDmg, shotElement);
      }
    }

    // Hit enemies in melee cone
    const baseCrit = CHARACTERS[p.characterId]?.baseCritChance ?? 0.05;
    const critChance = clamp(baseCrit + w.critChance + (hasEaglePrecision ? 0.18 : 0), 0, 1);
    let hitAny = false;
    let anyCrit = false;
    const meleeEnemyCount = this.enemies.length;
    for (let i = 0; i < meleeEnemyCount; i++) {
      const e = this.enemies[i]!;
      if (e.hp <= 0 || e.aiState === 'spawning') continue;
      if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, meleeRange, e)) {
        const isCrit = this.rng.chance(critChance);
        const dmg = isCrit ? Math.round(baseMeleeDmg * 1.5) : baseMeleeDmg;
        const hitAngle = Math.atan2(e.y - p.y, e.x - p.x);
        this.applyDamageToEnemy(e, dmg, isCrit, shotElement, hitAngle, w.knockback, true, p.id);
        hitAny = true;
        if (isCrit) anyCrit = true;
      }
    }

    // Legendary Thunder Hammer launches 3 piercing lightning bolts forward on each swing!
    if (w.id === 'thunder_hammer') {
      this.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: this.tick,
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
        knockback: w.knockback * 0.7,
        pierceCount: 2,
        bounceCount: 0,
        ttlSec: 0.85,
        element: 'shock',
        critChance,
        amplifiedByShield: false,
        seed: this.rng.nextUint32(),
      });
    }

    // Vanguard Shield Wall Synergy: Melee swings while Tường Khiên Hồng Ngọc is active launch a 200u Ruby Sword Wave!
    const isVanguardSwordWave = p.characterId === 'vanguard' && p.skillActiveTimer > 0;
    if (isVanguardSwordWave) {
      const waveHalfArc = (32 * Math.PI) / 180;
      const waveRange = 200;
      let waveElement: ElementType = shotElement;
      let waveSecondaryElement: ElementType = 'none';
      let waveImbueOwnerId = p.id;
      let waveDmgMult = 1.15;

      // If the 200u Ruby Sword Wave passes through an Elementalist Skill Zone, imbue +15% damage & element!
      for (let zIdx = 0; zIdx < this.skillZones.length; zIdx++) {
        const z = this.skillZones[zIdx]!;
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

      const waveEnemyCount = this.enemies.length;
      for (let i = 0; i < waveEnemyCount; i++) {
        const e = this.enemies[i]!;
        if (e.hp <= 0 || e.aiState === 'spawning') continue;
        // Enemies already hit in the inner meleeRange cone don't take double damage, only enemies in (meleeRange..200u]
        if (
          !isCircleInCone(p.x, p.y, p.aimAngle, halfArc, meleeRange, e) &&
          isCircleInCone(p.x, p.y, p.aimAngle, waveHalfArc, waveRange, e)
        ) {
          const isCrit = this.rng.chance(critChance);
          const rawWaveDmg = Math.round(baseMeleeDmg * waveDmgMult);
          const dmg = isCrit ? Math.round(rawWaveDmg * 1.5) : rawWaveDmg;
          const hitAngle = Math.atan2(e.y - p.y, e.x - p.x);
          if (waveSecondaryElement !== 'none') {
            this.applyElementStatusToEnemy(e, waveSecondaryElement, dmg, waveImbueOwnerId);
          }
          const effectiveAttackerId =
            waveImbueOwnerId !== p.id && e.lastElementOwnerId === p.id ? waveImbueOwnerId : p.id;
          this.applyDamageToEnemy(
            e,
            dmg,
            isCrit,
            waveElement,
            hitAngle,
            w.knockback * 0.85,
            true,
            effectiveAttackerId,
          );
          hitAny = true;
          if (isCrit) anyCrit = true;
        }
      }
    }

    this.events.push({
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
      this.events.push({
        kind: 'hit_stop',
        durationMs: anyCrit ? 50 : 35,
        trauma: anyCrit ? 0.36 : 0.24,
      });
    }
    return;
  }

  const pellets = Math.max(1, w.pelletCount);
  const spreadRad = (w.spreadDeg * Math.PI) / 180;
  const shieldBoost = p.characterId === 'vanguard' && p.skillActiveTimer > 0;
  const muzzleDist = 18;
  const spawnX = p.x + Math.cos(p.aimAngle) * muzzleDist;
  const spawnY = p.y + Math.sin(p.aimAngle) * muzzleDist;
  const baseCrit = CHARACTERS[p.characterId]?.baseCritChance ?? 0.05;
  const rawWeaponDmg = hasEaglePrecision ? Math.round(w.damage * 1.2) : w.damage;
  const baseDmg = shieldBoost ? Math.round(rawWeaponDmg * 1.3) : rawWeaponDmg;
  const critChance = clamp(baseCrit + w.critChance + (hasEaglePrecision ? 0.18 : 0), 0, 1);

  // Co-op Weapon: Trượng Liên Kết (tether_staff) links player with nearest ally or summon/anchor!
  if (w.id === 'tether_staff') {
    const allPlayers = this.getAllPlayers();
    let bestAlly: SimPlayerState | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < allPlayers.length; i++) {
      const cand = allPlayers[i]!;
      if (cand.id === p.id || cand.lifeState !== 'alive') continue;
      const d = distance(p.x, p.y, cand.x, cand.y);
      if (d < bestDist) {
        bestDist = d;
        bestAlly = cand;
      }
    }

    let targetKind: 'player' | 'summon' = 'player';
    let targetEntityId = 0;
    let x2 = p.x + Math.cos(p.aimAngle) * 165;
    let y2 = p.y + Math.sin(p.aimAngle) * 165;

    if (bestAlly) {
      targetKind = 'player';
      targetEntityId = bestAlly.id;
      x2 = bestAlly.x;
      y2 = bestAlly.y;
    } else {
      const activeSummon = this.summons.find((s) => s.hp > 0 && s.ttlSec > 0);
      if (activeSummon) {
        targetKind = 'summon';
        targetEntityId = activeSummon.id;
        x2 = activeSummon.x;
        y2 = activeSummon.y;
      } else {
        targetKind = 'summon';
        targetEntityId = 0;
        const col = this.map.resolveCircleCollision(x2, y2, 10);
        x2 = col.x;
        y2 = col.y;
      }
    }

    const existingBeam = this.tetherBeams.find((b) => b.ownerPlayerId === p.id);
    if (existingBeam) {
      existingBeam.targetKind = targetKind;
      existingBeam.targetEntityId = targetEntityId;
      existingBeam.x1 = p.x;
      existingBeam.y1 = p.y;
      existingBeam.x2 = x2;
      existingBeam.y2 = y2;
      existingBeam.ttlSec = 3.2;
      existingBeam.damage = Math.max(8, Math.round(baseDmg * 0.85));
    } else {
      this.tetherBeams.push({
        id: ++this.nextPuzzleEntityId,
        ownerPlayerId: p.id,
        targetEntityId,
        targetKind,
        x1: p.x,
        y1: p.y,
        x2,
        y2,
        ttlSec: 3.2,
        tickTimer: 0.1,
        damage: Math.max(8, Math.round(baseDmg * 0.85)),
      });
    }
  }

  this.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: this.tick,
    ownerId: p.id,
    team: 'player',
    weaponId: w.id,
    x: spawnX,
    y: spawnY,
    angle: p.aimAngle,
    pelletCount: pellets,
    spreadRad,
    speed: w.projectileSpeed,
    damage: baseDmg,
    radius: w.category === 'shotgun' ? 4.5 : w.category === 'launcher' ? 7 : 5,
    knockback: w.knockback,
    pierceCount: w.pierceCount + (shieldBoost ? 1 : 0) + (hasRicochetMastery ? 1 : 0),
    bounceCount: w.bounceCount + (hasRicochetMastery ? 1 : 0),
    ttlSec: w.category === 'shotgun' ? 0.55 : w.category === 'laser' ? 1.0 : 1.4,
    element: shotElement,
    critChance,
    amplifiedByShield: shieldBoost,
    seed: this.rng.nextUint32(),
  });
}
