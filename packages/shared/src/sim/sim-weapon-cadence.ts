import { CHARACTERS } from '../data/characters.js';
import type { ElementType } from '../data/types.js';
import { WEAPONS } from '../data/weapons.js';
import { clamp } from '../math/vec2.js';
import { INPUT_BUTTON, SHOT_FLAG } from '../protocol/messages.js';
import { syncActiveWeaponCadenceState } from './sim-coop-hub.js';
import {
  BLACK_CRYSTAL_ADDITIVE_BONUS,
  applySearingTriggerOnMissedReload,
  applySearingTriggerOnOverheat,
  consumeBlackCrystalEmpowermentForShot,
  onPlayerReloadVentOrMeleeFinisherAshenRelics,
} from './sim-ashen-pacts.js';
import {
  ACROBAT_VENT_ORANGE_MAX,
  ACROBAT_VENT_ORANGE_MIN,
  triggerReloadVentOrFinisherBlessings,
  tryConsumeAndSpawnDashPhaseBlade,
  trySpawnCausticSporePod,
  tryTriggerHolsterSurgeOnWeaponSwap,
} from './sim-blessings.js';
import {
  clampPelletsPerTrigger,
  computeAdditivePoolMultiplier,
  computeUpgradeMultiplier,
} from './sim-damage-pipeline.js';
import {
  applyFinaleJoltSafeRecoil,
  getClipReloadGoldenWindow,
  getHeatVentOrangeZone,
  hasActiveWeaponMutator,
  spawnShockwaveEdgeBlade,
  triggerFinaleJoltVentBurst,
} from './sim-weapon-mutators.js';
import {
  resolveMeleeConeHitsAndSynergies,
  upsertTetherStaffBeam,
} from './sim-player.js';
import {
  BIOME3_HEAT_GAIN_MULT,
  triggerBiome3TacticalVentPulse,
  triggerGrassPollenSpeedBoost,
} from './sim-tactical-physics.js';
import {
  FRAG_LAUNCHER_MAIN_BLAST_RADIUS,
  GALE_SMG_MAX_FIRE_RATE,
  GALE_SMG_MIN_FIRE_RATE,
  GALE_SMG_SPINUP_DURATION_SEC,
  MAGMA_BOULDER_RADIUS,
  applyBerserkerAxeHitBloodlust,
  applySafeMeleeLunge,
  checkAndTriggerFragLauncherAirburst,
  checkAndTriggerVoidStaffImplosion,
  detonateParasiticThorns,
  detonatePlayerMagneticRivets,
  fireFocusLaserHitscanBeam,
  processMeleeParryDeflect,
  spawnEmeraldCleaverBoomerang,
  spawnGaleSmgWindBlade,
  spawnKnightSwordCrescentWave,
  spawnSolarArchonConvergingVolley,
  triggerApprenticeStaffTacticalVent,
  triggerBerserkerGuillotineFinisher,
  triggerFocusLaserRailgunVent,
  triggerGaleSmgTacticalVent,
  triggerHunterCrossbowBarbedRip,
  triggerMagmaCannonGeyserEruption,
  triggerScrapShotgunPerfectReload,
  triggerSeedGunHarvestBloom,
  triggerSolarArchonSupernovaVent,
  triggerTetherStaffTacticalVent,
  triggerThunderHammerFinisher,
  updateSolarArchonMiniSunsForPlayer,
} from './sim-weapon-specials.js';
import {
  ELEMENTALIST_ROTATION_ORDER,
  MELEE_RANGE,
  type SimPlayerState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const HOLSTER_AUTO_RELOAD_SEC = 2.0;
export const HEAT_DECAY_PER_SEC = 28;
export const HEAT_ORANGE_MIN = 65;
export const HEAT_ORANGE_MAX = 95;
export const OVERHEAT_LOCK_DURATION_SEC = 1.1;
export const TACTICAL_VENT_COOLDOWN_SEC = 0.25;
export const PERFECT_RELOAD_WINDOW_MIN = 0.45;
export const PERFECT_RELOAD_WINDOW_MAX = 0.7;
export const MELEE_COMBO_RESET_SEC = 0.9;
export const MELEE_PARRY_WINDOW_SEC = 0.18;
export const MELEE_LUNGE_DISTANCE = 24;

export function equipPlayerWeaponSlot(
  p: SimPlayerState,
  slot: number,
  weaponId: string,
): void {
  if (slot < 0 || slot > 1) return;
  p.weaponSlots[slot] = weaponId;
  const wep = WEAPONS[weaponId];
  const clipMax = wep?.clipSize ?? 0;

  if (!Array.isArray(p.weaponSlotClipAmmo)) {
    p.weaponSlotClipAmmo = [0, 0];
  }
  if (!Array.isArray(p.weaponSlotHeat)) {
    p.weaponSlotHeat = [0, 0];
  }
  if (!Array.isArray(p.holsterReloadTimers)) {
    p.holsterReloadTimers = [0, 0];
  }

  p.weaponSlotClipAmmo[slot] = clipMax;
  p.weaponSlotHeat[slot] = 0;
  p.holsterReloadTimers[slot] = 0;

  if (p.activeWeaponSlot === slot) {
    syncActiveWeaponCadenceState(p);
  }
}

export function switchPlayerWeaponSlot(
  sim: WorldSim,
  p: SimPlayerState,
  slotIndex: number,
): void {
  if (slotIndex < 0 || slotIndex >= p.weaponSlots.length) return;
  if (!Array.isArray(p.weaponSlotClipAmmo)) {
    p.weaponSlotClipAmmo = [p.clipAmmo, -1];
  }
  if (!Array.isArray(p.weaponSlotHeat)) {
    p.weaponSlotHeat = [p.weaponHeat, 0];
  }
  if (!Array.isArray(p.holsterReloadTimers)) {
    p.holsterReloadTimers = [0, 0];
  }

  if (p.activeWeaponSlot !== slotIndex) {
    const prevSlot = p.activeWeaponSlot;
    p.weaponSlotClipAmmo[prevSlot] = p.clipAmmo;
    p.weaponSlotHeat[prevSlot] = p.weaponHeat;
    p.holsterReloadTimers[prevSlot] = 0;

    p.activeWeaponSlot = slotIndex;
    p.fireCooldownTimer = Math.min(p.fireCooldownTimer, 0.08);

    const prevWepId = p.weaponSlots[prevSlot] ?? p.weaponSlots[0] ?? 'knight_sword';
    const newWepId = p.weaponSlots[slotIndex] ?? p.weaponSlots[0] ?? 'knight_sword';
    const newWep = WEAPONS[newWepId];
    p.clipMax = newWep?.clipSize ?? 0;
    p.reloadDuration = newWep?.reloadDurationSec ?? 0;

    const savedAmmo = p.weaponSlotClipAmmo[slotIndex];
    if (typeof savedAmmo === 'number' && savedAmmo >= 0 && savedAmmo <= p.clipMax) {
      p.clipAmmo = savedAmmo;
    } else {
      p.clipAmmo = p.clipMax;
      p.weaponSlotClipAmmo[slotIndex] = p.clipMax;
    }

    if (prevWepId !== newWepId) {
      p.weaponHeat = p.weaponSlotHeat[slotIndex] ?? 0;
      p.overheatLockTimer = 0;
    }
    p.reloadTimer = 0;
    p.reloadLockout = false;
    p.overclockedNextShot = false;
    p.ventCooldownTimer = 0;
    p.meleeComboStep = 0;
    p.meleeComboResetTimer = 0;
    p.meleeParryWindowTimer = 0;
    p.bonusBounceCurrentClip = 0;
    p.parriedCountCurrentWindow = 0;
    p.fireHoldTimer = 0;
    p.crossbowChargeTimer = 0;
    p.holsterReloadTimers[slotIndex] = 0;

    sim.events.push({
      kind: 'weapon_swapped',
      playerId: p.id,
      weaponId: newWepId,
      slot: slotIndex,
    });
    tryTriggerHolsterSurgeOnWeaponSwap(sim, p, prevSlot, slotIndex);
  } else {
    const wep = WEAPONS[p.weaponSlots[slotIndex] ?? p.weaponSlots[0] ?? 'knight_sword'];
    if (
      p.clipMax !== (wep?.clipSize ?? 0) ||
      (p.reloadTimer <= 0 && p.reloadDuration !== (wep?.reloadDurationSec ?? 0))
    ) {
      syncActiveWeaponCadenceState(p);
    }
  }
}

function applyMeleeLunge(sim: WorldSim, p: SimPlayerState, lungeDist: number): void {
  if (sim.stressTestActive) return;
  applySafeMeleeLunge(sim, p, lungeDist);
  sim.resolvePropMovementCollision(p);
}

export function updatePlayerWeaponCadence(
  sim: WorldSim,
  p: SimPlayerState,
  justPressed: number,
  buttons: number,
  dtSec: number,
): void {
  if (!Array.isArray(p.weaponSlotClipAmmo)) {
    p.weaponSlotClipAmmo = [p.clipAmmo, -1];
  }
  if (!Array.isArray(p.weaponSlotHeat)) {
    p.weaponSlotHeat = [p.weaponHeat, 0];
  }
  if (!Array.isArray(p.holsterReloadTimers)) {
    p.holsterReloadTimers = [0, 0];
  }

  const slot = p.activeWeaponSlot ?? 0;
  const activeWepId = p.weaponSlots[slot] ?? p.weaponSlots[0] ?? 'knight_sword';
  const w = WEAPONS[activeWepId];

  // Auto-initialize clipMax if weaponSlots was mutated directly by caller/test
  if (w) {
    if (w.cadenceKind === 'CLIP_RELOAD') {
      if (p.clipMax !== w.clipSize) {
        p.clipMax = w.clipSize;
        if (p.clipAmmo <= 0 || p.clipAmmo > p.clipMax) {
          p.clipAmmo = p.clipMax;
        }
      }
      if (p.reloadDuration <= 0 && w.reloadDurationSec > 0) {
        p.reloadDuration = w.reloadDurationSec;
      }
    } else {
      p.clipMax = 0;
      p.clipAmmo = 0;
      p.reloadTimer = 0;
      p.reloadDuration = 0;
    }
  }

  // Keep current slot state mirrored for holster tracking
  p.weaponSlotClipAmmo[slot] = p.clipAmmo;
  p.weaponSlotHeat[slot] = p.weaponHeat;

  // 1. Holster Auto-Reload (2.0s) for inactive slot
  const otherSlot = 1 - slot;
  const otherWepId = p.weaponSlots[otherSlot];
  if (otherWepId) {
    const otherWep = WEAPONS[otherWepId];
    if (otherWep) {
      if (otherWep.cadenceKind === 'CLIP_RELOAD') {
        const stowedAmmo = p.weaponSlotClipAmmo[otherSlot];
        const effectiveStowed =
          typeof stowedAmmo === 'number' && stowedAmmo >= 0 ? stowedAmmo : otherWep.clipSize;
        if (effectiveStowed < otherWep.clipSize) {
          p.holsterReloadTimers[otherSlot] = (p.holsterReloadTimers[otherSlot] ?? 0) + dtSec;
          if ((p.holsterReloadTimers[otherSlot] ?? 0) >= HOLSTER_AUTO_RELOAD_SEC) {
            p.weaponSlotClipAmmo[otherSlot] = otherWep.clipSize;
          }
        }
      } else if (otherWep.cadenceKind === 'HEAT_VENT') {
        const stowedHeat = p.weaponSlotHeat[otherSlot] ?? 0;
        if (stowedHeat > 0) {
          p.holsterReloadTimers[otherSlot] = (p.holsterReloadTimers[otherSlot] ?? 0) + dtSec;
          if ((p.holsterReloadTimers[otherSlot] ?? 0) >= HOLSTER_AUTO_RELOAD_SEC) {
            p.weaponSlotHeat[otherSlot] = 0;
          }
        }
      }
    }
  }

  // 2. Process rising edge of [R] (INPUT_BUTTON.RELOAD_VENT)
  if (justPressed & INPUT_BUTTON.RELOAD_VENT) {
    if (p.reloadTimer > 0 && p.reloadDuration > 0) {
      if (!p.reloadLockout) {
        const progress = 1 - p.reloadTimer / p.reloadDuration;
        const { min: winMin, max: winMax } = getClipReloadGoldenWindow(p);
        p.acrobatExpandedWindow = false;
        if (progress >= winMin && progress <= winMax) {
          const fullClip = p.clipMax > 0 ? p.clipMax : (w?.clipSize ?? 6);
          const shotsFiredBeforeReload = Math.max(
            1,
            fullClip > p.clipAmmo ? fullClip - p.clipAmmo : fullClip,
          );
          p.clipAmmo = fullClip;
          p.weaponSlotClipAmmo[slot] = p.clipAmmo;
          p.reloadTimer = 0;
          p.reloadLockout = false;
          p.overclockedNextShot = true;
          triggerGrassPollenSpeedBoost(sim, p);
          sim.events.push({
            kind: 'perfect_reload',
            playerId: p.id,
            weaponId: w?.id ?? activeWepId,
            x: p.x,
            y: p.y,
          });
          if (w?.id === 'rivet_gun') {
            detonatePlayerMagneticRivets(sim, p.id, true);
          } else if (w?.id === 'tesla_carbine') {
            p.bonusBounceCurrentClip = 1;
          } else if (w?.id === 'hunter_crossbow') {
            triggerHunterCrossbowBarbedRip(sim, p.id);
          } else if (w?.id === 'thorn_staff') {
            detonateParasiticThorns(sim, p.id);
          } else if (w?.id === 'scrap_shotgun') {
            triggerScrapShotgunPerfectReload(sim, p);
          } else if (w?.id === 'seed_gun') {
            triggerSeedGunHarvestBloom(sim, p);
          } else if (w?.id === 'magma_cannon') {
            triggerMagmaCannonGeyserEruption(sim, p);
          }
          triggerReloadVentOrFinisherBlessings(sim, p, 'perfect_reload', {
            shotsFired: shotsFiredBeforeReload,
          });
          onPlayerReloadVentOrMeleeFinisherAshenRelics(sim, p, 'perfect_reload', true);
        } else {
          p.reloadLockout = true;
          applySearingTriggerOnMissedReload(p);
        }
      }
    } else if (w?.cadenceKind === 'HEAT_VENT') {
      const { min: baseOrangeMin, max: baseOrangeMax } = getHeatVentOrangeZone(p);
      const orangeMin = p.acrobatExpandedWindow
        ? Math.min(ACROBAT_VENT_ORANGE_MIN, baseOrangeMin)
        : baseOrangeMin;
      const orangeMax = p.acrobatExpandedWindow
        ? Math.max(ACROBAT_VENT_ORANGE_MAX, baseOrangeMax)
        : baseOrangeMax;
      p.acrobatExpandedWindow = false;
      if (
        p.overheatLockTimer <= 0 &&
        p.weaponHeat >= orangeMin &&
        p.weaponHeat <= orangeMax
      ) {
        const shotsFiredFromVent = Math.max(1, Math.round(p.weaponHeat / 15));
        p.weaponHeat = 0;
        p.weaponSlotHeat[slot] = 0;
        p.ventEmpoweredNextShot = true;
        p.ventCooldownTimer = TACTICAL_VENT_COOLDOWN_SEC;
        p.fireCooldownTimer = Math.max(p.fireCooldownTimer, TACTICAL_VENT_COOLDOWN_SEC);
        triggerGrassPollenSpeedBoost(sim, p);
        triggerBiome3TacticalVentPulse(sim, p);
        sim.events.push({
          kind: 'tactical_vent',
          playerId: p.id,
          weaponId: w.id,
          x: p.x,
          y: p.y,
        });
        if (w.id === 'apprentice_staff') {
          triggerApprenticeStaffTacticalVent(sim, p);
        } else if (w.id === 'gale_smg') {
          triggerGaleSmgTacticalVent(sim, p);
        } else if (w.id === 'tether_staff') {
          triggerTetherStaffTacticalVent(sim, p);
        } else if (w.id === 'focus_laser') {
          triggerFocusLaserRailgunVent(sim, p);
        } else if (w.id === 'solar_archon_staff') {
          triggerSolarArchonSupernovaVent(sim, p);
        }
        triggerFinaleJoltVentBurst(sim, p, w.id);
        triggerReloadVentOrFinisherBlessings(sim, p, 'tactical_vent', {
          shotsFired: shotsFiredFromVent,
        });
        onPlayerReloadVentOrMeleeFinisherAshenRelics(sim, p, 'tactical_vent', true);
      }
    } else if (p.reloadTimer <= 0 && p.clipMax > 0 && p.clipAmmo < p.clipMax) {
      const dur =
        p.reloadDuration > 0
          ? p.reloadDuration
          : w?.reloadDurationSec && w.reloadDurationSec > 0
            ? w.reloadDurationSec
            : 1.0;
      p.reloadDuration = dur;
      p.reloadTimer = dur;
      p.reloadLockout = false;
    }
  } else if ((p.ventCooldownTimer ?? 0) > 0) {
    const nextVent = (p.ventCooldownTimer ?? 0) - dtSec;
    p.ventCooldownTimer = nextVent <= 1e-6 ? 0 : nextVent;
  }

  // 3. Advance active reload timer
  if (p.reloadTimer > 0) {
    const nextReload = p.reloadTimer - dtSec;
    if (nextReload <= 1e-6) {
      p.reloadTimer = 0;
      p.reloadLockout = false;
      p.acrobatExpandedWindow = false;
      p.clipAmmo = p.clipMax;
      p.weaponSlotClipAmmo[slot] = p.clipAmmo;
      p.bonusBounceCurrentClip = 0;
    } else {
      p.reloadTimer = nextReload;
    }
  }

  // 4. Advance HEAT_VENT overheat lock & passive cooling (28%/s when not firing)
  if (w?.cadenceKind === 'HEAT_VENT') {
    if (p.overheatLockTimer > 0) {
      const nextLock = p.overheatLockTimer - dtSec;
      if (nextLock <= 1e-6) {
        p.overheatLockTimer = 0;
        p.weaponHeat = 0;
        p.weaponSlotHeat[slot] = 0;
      } else {
        p.overheatLockTimer = nextLock;
      }
    } else if ((buttons & INPUT_BUTTON.FIRE) === 0 && p.weaponHeat > 0) {
      p.weaponHeat = Math.max(0, p.weaponHeat - HEAT_DECAY_PER_SEC * dtSec);
      p.weaponSlotHeat[slot] = p.weaponHeat;
    }
  }

  // 5. Advance MELEE_COMBO parry window & combo reset timer
  if (p.meleeParryWindowTimer > 0) {
    const deflectedNow = processMeleeParryDeflect(sim, p);
    if (deflectedNow > 0) {
      triggerReloadVentOrFinisherBlessings(sim, p, 'melee_finisher', {
        hitAny: false,
        bulletsDestroyed: deflectedNow,
      });
    }
    const nextParry = p.meleeParryWindowTimer - dtSec;
    p.meleeParryWindowTimer = nextParry <= 1e-6 ? 0 : nextParry;
  }
  if (p.meleeComboResetTimer > 0) {
    const nextReset = p.meleeComboResetTimer - dtSec;
    if (nextReset <= 1e-6) {
      p.meleeComboResetTimer = 0;
      p.meleeComboStep = 0;
    } else {
      p.meleeComboResetTimer = nextReset;
    }
  }
  if ((p.berserkerBloodlustTimer ?? 0) > 0) {
    const nextBloodlust = (p.berserkerBloodlustTimer ?? 0) - dtSec;
    if (nextBloodlust <= 1e-6) {
      p.berserkerBloodlustTimer = 0;
      p.berserkerBloodlustStacks = 0;
    } else {
      p.berserkerBloodlustTimer = nextBloodlust;
    }
  }

  if ((buttons & INPUT_BUTTON.FIRE) !== 0 && p.reloadTimer <= 0) {
    p.fireHoldTimer = (p.fireHoldTimer ?? 0) + dtSec;
    p.crossbowChargeTimer = (p.crossbowChargeTimer ?? 0) + dtSec;
  } else {
    p.fireHoldTimer = 0;
    p.crossbowChargeTimer = 0;
  }
  p.lastButtons = buttons;
  if (activeWepId === 'frag_launcher' || otherWepId === 'frag_launcher') {
    checkAndTriggerFragLauncherAirburst(sim, p, buttons);
  }
  if (activeWepId === 'void_staff' || otherWepId === 'void_staff') {
    checkAndTriggerVoidStaffImplosion(sim, p, buttons);
  }
  updateSolarArchonMiniSunsForPlayer(sim, p, dtSec);
}

export function tryFireActiveWeaponImpl(
  this: WorldSim,
  p: SimPlayerState = this.player,
): void {
  const slot = p.activeWeaponSlot ?? 0;
  const weaponId = p.weaponSlots[slot] ?? p.weaponSlots[0] ?? 'knight_sword';
  const w = WEAPONS[weaponId];
  if (!w) return;

  // Enforce CLIP_RELOAD & HEAT_VENT firing gates
  if (w.cadenceKind === 'CLIP_RELOAD') {
    if (p.reloadTimer > 0) {
      return;
    }
    if (p.clipMax !== w.clipSize) {
      p.clipMax = w.clipSize;
      if (p.clipAmmo <= 0 || p.clipAmmo > p.clipMax) {
        p.clipAmmo = p.clipMax;
      }
    }
    if (p.clipAmmo <= 0) {
      p.reloadDuration = w.reloadDurationSec > 0 ? w.reloadDurationSec : 1.0;
      p.reloadTimer = p.reloadDuration;
      p.reloadLockout = false;
      return;
    }
  } else if (w.cadenceKind === 'HEAT_VENT') {
    if (p.overheatLockTimer > 0) {
      return;
    }
  }

  let shotFlags = 0;
  const shieldBonusBeforeShot = p.vanguardShieldBonusAdd ?? 0;
  const wasBlackCrystalEmpowered = consumeBlackCrystalEmpowermentForShot(p);
  let additiveDmgBonus =
    shieldBonusBeforeShot + (wasBlackCrystalEmpowered ? BLACK_CRYSTAL_ADDITIVE_BONUS : 0);
  p.vanguardShieldBonusAdd = 0;
  const heatBeforeShot = p.weaponHeat;

  let fireRateMult = p.elementalConvergenceTimer > 0 ? 1.2 : 1.0;
  if (hasActiveWeaponMutator(p, 'mutator_finale_jolt')) {
    fireRateMult *= 1.2;
  }
  let isFinaleShot = false;
  let wasOverclocked = false;
  const wasVentEmpowered = Boolean(p.ventEmpoweredNextShot);
  p.ventEmpoweredNextShot = false;
  let inOrangeZoneBeforeShot = false;

  if (w.cadenceKind === 'CLIP_RELOAD') {
    if (p.overclockedNextShot) {
      p.overclockedNextShot = false;
      wasOverclocked = true;
      shotFlags |= SHOT_FLAG.OVERCLOCKED_SHOT;
      additiveDmgBonus += 0.45;
    }
    if (p.clipAmmo === 1) {
      isFinaleShot = true;
      shotFlags |= SHOT_FLAG.FINALE_SHOT;
      additiveDmgBonus += 0.5;
    }
    p.clipAmmo = Math.max(0, p.clipAmmo - 1);
    if (Array.isArray(p.weaponSlotClipAmmo)) {
      p.weaponSlotClipAmmo[slot] = p.clipAmmo;
    }
    if (p.clipAmmo === 0) {
      p.reloadDuration =
        p.reloadDuration > 0
          ? p.reloadDuration
          : w.reloadDurationSec > 0
            ? w.reloadDurationSec
            : 1.0;
      p.reloadTimer = p.reloadDuration;
      p.reloadLockout = false;
    }
  } else if (w.cadenceKind === 'HEAT_VENT') {
    if (wasVentEmpowered) {
      shotFlags |= SHOT_FLAG.OVERCLOCKED_SHOT;
      additiveDmgBonus += 0.9;
    }
    const { min: orangeMin, max: orangeMax } = getHeatVentOrangeZone(p);
    if (p.weaponHeat >= orangeMin && p.weaponHeat <= orangeMax) {
      inOrangeZoneBeforeShot = true;
      fireRateMult *= 1.25;
      additiveDmgBonus += 0.25;
    }
    const heatGain =
      (w.heatPerShot || 0) *
      (this.map.biome === 3 || this.currentBiome === 3 ? BIOME3_HEAT_GAIN_MULT : 1.0);
    p.weaponHeat = Math.min(100, p.weaponHeat + heatGain);
    if (Array.isArray(p.weaponSlotHeat)) {
      p.weaponSlotHeat[slot] = p.weaponHeat;
    }
    if (p.weaponHeat >= 100) {
      p.overheatLockTimer = OVERHEAT_LOCK_DURATION_SEC;
      applySearingTriggerOnOverheat(p);
    }
  }

  const spinUpT =
    w.id === 'gale_smg' ? clamp((p.fireHoldTimer ?? 0) / GALE_SMG_SPINUP_DURATION_SEC, 0, 1) : 0;
  const baseFireRate =
    w.id === 'gale_smg'
      ? GALE_SMG_MIN_FIRE_RATE + (GALE_SMG_MAX_FIRE_RATE - GALE_SMG_MIN_FIRE_RATE) * spinUpT
      : w.fireRate;
  const effectiveFireRate = Math.max(0.2, baseFireRate * fireRateMult);
  p.fireCooldownTimer = 1 / effectiveFireRate;
  p.recoilTimer = 0.12;
  const upgradeMult = computeUpgradeMultiplier(p.weaponUpgradeLevels?.[slot] ?? 0);

  let shotElement: ElementType =
    p.activeImbueElement !== 'none'
      ? p.activeImbueElement
      : w.id === 'scrap_shotgun' && isFinaleShot
        ? 'burn'
        : w.element;

  tryConsumeAndSpawnDashPhaseBlade(this, p);
  if (w.category === 'melee') {
    const comboStep = p.meleeComboStep ?? 0;
    const arcRad = (w.spreadDeg * Math.PI) / 180;
    const halfArc = arcRad / 2;
    const rawMeleeRange =
      w.id === 'thunder_hammer'
        ? MELEE_RANGE + 20
        : (w.range ?? (w.id === 'berserker_axe' ? MELEE_RANGE + 10 : MELEE_RANGE));
    const meleeRange = hasActiveWeaponMutator(p, 'mutator_shockwave_edge')
      ? Math.round(rawMeleeRange * 1.3)
      : rawMeleeRange;

    const stepBaseDmg =
      w.comboDamages?.[comboStep] ??
      (comboStep === 2 ? Math.round(w.damage * 1.7) : comboStep === 1 ? Math.round(w.damage * 1.15) : w.damage);
    const stepKnockback = w.comboKnockbacks?.[comboStep] ?? w.knockback;
    const baseMeleeDmg = Math.max(
      1,
      Math.round(stepBaseDmg * upgradeMult * computeAdditivePoolMultiplier(additiveDmgBonus)),
    );
    const baseCrit = p.critChance ?? CHARACTERS[p.characterId]?.baseCritChance ?? 0.05;
    const critChance = clamp(baseCrit + w.critChance, 0, 1);
    let bulletsDestroyed = 0;

    if (hasActiveWeaponMutator(p, 'mutator_shockwave_edge')) {
      spawnShockwaveEdgeBlade(this, p, w, baseMeleeDmg, shotElement, critChance);
    }

    const finisherHitEnemyIds = new Set<number>();
    if (comboStep === 0 || comboStep === 1) {
      applyMeleeLunge(this, p, MELEE_LUNGE_DISTANCE);
      p.meleeComboStep = (comboStep + 1) as 0 | 1 | 2;
      p.meleeComboResetTimer = MELEE_COMBO_RESET_SEC;
    } else {
      p.fireCooldownTimer += w.comboRecoverySec ?? 0.25;
      p.meleeComboStep = 0;
      p.meleeComboResetTimer = 0;
      if (w.id === 'berserker_axe') {
        bulletsDestroyed += triggerBerserkerGuillotineFinisher(this, p, halfArc, meleeRange, baseMeleeDmg);
      } else if (w.id === 'thunder_hammer') {
        bulletsDestroyed += triggerThunderHammerFinisher(this, p, baseMeleeDmg, finisherHitEnemyIds);
      } else {
        p.meleeParryWindowTimer = MELEE_PARRY_WINDOW_SEC;
        p.parriedCountCurrentWindow = 0;
        bulletsDestroyed += processMeleeParryDeflect(this, p);
        if (w.id === 'knight_sword') {
          spawnKnightSwordCrescentWave(this, p, baseMeleeDmg, critChance, shotElement, shotFlags);
        }
      }
    }

    const hitAny = resolveMeleeConeHitsAndSynergies(
      this, p, w, arcRad, halfArc, meleeRange, baseMeleeDmg, stepKnockback, critChance, shotElement, shotFlags, bulletsDestroyed, finisherHitEnemyIds, wasBlackCrystalEmpowered,
    );
    if (comboStep === 2) {
      triggerReloadVentOrFinisherBlessings(this, p, 'melee_finisher', {
        hitAny,
        bulletsDestroyed,
      });
      onPlayerReloadVentOrMeleeFinisherAshenRelics(this, p, 'melee_finisher', hitAny);
    }
    if (comboStep === 2 && w.id === 'emerald_cleaver') {
      spawnEmeraldCleaverBoomerang(
        this,
        p,
        baseMeleeDmg,
        critChance,
        shotElement,
        shotFlags,
      );
    }
    if (w.id === 'berserker_axe') {
      applyBerserkerAxeHitBloodlust(
        p,
        hitAny,
        w.fireRate,
        fireRateMult,
        comboStep === 2,
        w.comboRecoverySec ?? 0.25,
      );
    }
    return;
  }

  // Ranged weapons
  let pellets = Math.max(1, w.pelletCount);
  let spreadRad = (w.spreadDeg * Math.PI) / 180;
  const finaleJoltBurst =
    hasActiveWeaponMutator(p, 'mutator_finale_jolt') && (isFinaleShot || wasVentEmpowered);
  if (finaleJoltBurst) {
    additiveDmgBonus += 0.4;
    pellets = Math.max(3, pellets);
    spreadRad = Math.max(spreadRad, 0.2);
  }
  const shieldBoost = p.characterId === 'vanguard' && p.skillActiveTimer > 0;
  const muzzleDist = w.id === 'thorn_staff' ? 0 : 18;
  const spawnX = p.x + Math.cos(p.aimAngle) * muzzleDist;
  const spawnY = p.y + Math.sin(p.aimAngle) * muzzleDist;
  const baseCrit = typeof p.critChance === 'number' ? p.critChance : (CHARACTERS[p.characterId]?.baseCritChance ?? 0.05);
  const critChance = typeof p.critChance === 'number' && p.critChance === 0 ? 0 : clamp(baseCrit + w.critChance, 0, 1);

  let rawWeaponDmg = w.damage;
  let projRadius =
    w.id === 'thorn_staff' || w.id === 'void_staff'
      ? 12
      : w.category === 'shotgun'
        ? 4.5
        : w.category === 'launcher'
          ? 7
          : 5;
  let explosionRadius: number | undefined;
  let bounceCount = w.bounceCount;
  let pierceCount = w.pierceCount;
  let knockback = w.knockback;
  const projTtl =
    w.id === 'thorn_staff'
      ? 0.205
      : w.id === 'void_staff'
        ? (w.range ?? 360) / w.projectileSpeed
        : w.category === 'shotgun'
          ? 0.55
          : w.category === 'laser'
            ? 1.0
            : 1.4;

  if (w.id === 'hunter_crossbow') {
    const holdSec = Math.max(p.crossbowChargeTimer ?? 0, p.fireHoldTimer ?? 0);
    if (holdSec >= (w.chargedHoldSec ?? 0.35)) {
      rawWeaponDmg = w.chargedDamage ?? 22;
      pierceCount = Math.max(2, w.chargedPierceCount ?? 2);
      knockback = w.chargedKnockback ?? 220;
    }
    if (isFinaleShot) {
      additiveDmgBonus = Math.max(0, additiveDmgBonus - 0.5);
    }
    p.crossbowChargeTimer = 0;
    p.fireHoldTimer = 0;
  } else if (w.id === 'thorn_staff' && isFinaleShot) {
    rawWeaponDmg = w.finaleDamage ?? 17;
    additiveDmgBonus = Math.max(0, additiveDmgBonus - 0.5);
    knockback = 0;
  } else if (w.id === 'rivet_gun' && isFinaleShot) {
    // Rivet Gun Finale Shot (6th round) deals 15 base damage and triggers the electric rivet web on impact
    rawWeaponDmg = w.finaleDamage ?? 15;
    additiveDmgBonus = Math.max(0, additiveDmgBonus - 0.5);
  } else if (w.id === 'apprentice_staff') {
    const prevShots =
      typeof p.apprenticeStaffShotCount === 'number'
        ? p.apprenticeStaffShotCount
        : (p.staffShotCounter ?? 0);
    const nextShots = prevShots + 1;
    p.staffShotCounter = nextShots;
    p.apprenticeStaffShotCount = nextShots;
    const rotOrder = ELEMENTALIST_ROTATION_ORDER;
    const rotElem = rotOrder[(nextShots - 1) % rotOrder.length] ?? 'burn';
    p.activeImbueElement = rotElem;
    shotElement = rotElem;
    if (nextShots % 3 === 0) {
      // Every 3rd consecutive shot is a Large Orb (17 DMG, explodes r = 56px)
      rawWeaponDmg = 17;
      projRadius = 9;
      explosionRadius = 56;
    }
  } else if (w.id === 'tesla_carbine') {
    shotFlags |= SHOT_FLAG.DYNAMIC_BOUNCE;
    bounceCount = w.bounceCount + (p.bonusBounceCurrentClip ?? 0);
  }
  if (
    p.blessingIds.includes('table_tech_prism_split') ||
    p.blessingIds.includes('bullet_split_bounce') ||
    p.blessingIds.includes('bullet_orbit_return') ||
    this.props.some((pr) => pr.hp > 0 && (pr.kind === 'cryo_prism_pillar' || pr.prismAuraActive))
  ) {
    shotFlags |= SHOT_FLAG.DYNAMIC_BOUNCE;
  }
  if (w.id === 'frag_launcher') {
    explosionRadius = FRAG_LAUNCHER_MAIN_BLAST_RADIUS;
  } else if (w.id === 'void_staff' && isFinaleShot) {
    additiveDmgBonus = Math.max(0, additiveDmgBonus - 0.5);
  } else if (w.id === 'magma_cannon') {
    projRadius = MAGMA_BOULDER_RADIUS;
    if (isFinaleShot) {
      additiveDmgBonus = Math.max(0, additiveDmgBonus - 0.5);
    }
  }

  if (w.id === 'focus_laser') {
    fireFocusLaserHitscanBeam(
      this,
      p,
      heatBeforeShot,
      critChance,
      shotElement,
      shieldBonusBeforeShot + (wasBlackCrystalEmpowered ? BLACK_CRYSTAL_ADDITIVE_BONUS : 0),
    );
    return;
  }

  const shieldAdjustedDmg =
    (shieldBoost ? Math.round(rawWeaponDmg * 1.3) : rawWeaponDmg) * upgradeMult;
  const additiveMult = computeAdditivePoolMultiplier(additiveDmgBonus);
  let baseDmg =
    w.id === 'gale_smg'
      ? Math.max(1, Number((shieldAdjustedDmg * additiveMult).toFixed(2)))
      : Math.max(1, Math.round(shieldAdjustedDmg * additiveMult));

  if (hasActiveWeaponMutator(p, 'mutator_prism_splitter')) {
    baseDmg = Math.max(1, Math.round(baseDmg * 0.8));
    pellets = clampPelletsPerTrigger(Math.max(3, pellets * 3));
    spreadRad = Math.max(spreadRad, 0.22);
  }

  if (w.id === 'tether_staff') {
    upsertTetherStaffBeam(this, p, baseDmg);
    return;
  }
  if (w.id === 'solar_archon_staff') {
    spawnSolarArchonConvergingVolley(this, p, baseDmg, critChance, shotElement, shieldBoost, shotFlags);
    if (isFinaleShot) trySpawnCausticSporePod(this, p, true);
    return;
  }

  const empoweredForMutator = isFinaleShot || wasOverclocked || wasVentEmpowered;
  const gravitySingularityShot =
    hasActiveWeaponMutator(p, 'mutator_gravity_singularity') && empoweredForMutator;
  const chainHarpoonShot =
    hasActiveWeaponMutator(p, 'mutator_chain_harpoon') && empoweredForMutator;
  const bypassFrontShield =
    wasBlackCrystalEmpowered ||
    (hasActiveWeaponMutator(p, 'mutator_thermal_meltdown') &&
      (empoweredForMutator || inOrangeZoneBeforeShot));

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
    radius: projRadius,
    knockback,
    pierceCount: pierceCount + (shieldBoost ? 1 : 0),
    bounceCount,
    ttlSec: projTtl,
    element: shotElement,
    critChance,
    amplifiedByShield: shieldBoost,
    seed: this.rng.nextUint32(),
    shotFlags,
    flags: shotFlags,
    explosionRadius,
    guaranteedElementalProc: isFinaleShot,
    originX: p.x,
    originY: p.y,
    armedForAirburst: w.id === 'frag_launcher' && (this.currentInput.buttons & INPUT_BUTTON.FIRE) !== 0,
    firedWhileHoldingFire:
      w.id === 'void_staff' && (((p.lastButtons ?? this.currentInput.buttons) & INPUT_BUTTON.FIRE) !== 0),
    gravitySingularityShot: gravitySingularityShot || undefined,
    chainHarpoonShot: chainHarpoonShot || undefined,
    bypassFrontShield: bypassFrontShield || undefined,
  });

  if (isFinaleShot) trySpawnCausticSporePod(this, p, true);

  if (finaleJoltBurst) {
    applyFinaleJoltSafeRecoil(this, p, p.aimAngle, 48);
  }

  if (w.id === 'magma_cannon' && isFinaleShot) {
    triggerMagmaCannonGeyserEruption(this, p);
  }

  if (w.id === 'gale_smg') {
    if (inOrangeZoneBeforeShot) {
      const nextCount = (p.galeOrangeShotCounter ?? 0) + 1;
      p.galeOrangeShotCounter = nextCount;
      if (nextCount % 6 === 0) {
        spawnGaleSmgWindBlade(this, p, shotElement, critChance, shotFlags);
      }
    } else {
      p.galeOrangeShotCounter = 0;
    }
  }
}
