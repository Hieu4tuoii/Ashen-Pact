import type { WeaponMutatorId } from '../data/types.js';
import { MAX_MUTATORS_PER_WEAPON_SLOT } from '../data/weapon-mutators.js';
import { MAX_WEAPON_SLOTS, WEAPONS, estimateWeaponDps } from '../data/weapons.js';
import { distance } from '../math/vec2.js';
import { INPUT_BUTTON } from '../protocol/messages.js';
import { findNextWalkableWaypoint } from './arena-room-archetypes.js';
import { FLIP_COVER_INTERACT_RANGE } from './interact-target.js';
import {
  isBossBiomeToyProp,
  triggerBossPhaseSupplyDrop,
} from './sim-boss-armor-break.js';
import {
  WEAPON_SALVAGE_MAX_DIST,
} from './sim-secret-and-workshop.js';
import {
  PNEUMATIC_PRESS_CRUSH_RADIUS,
  PNEUMATIC_PRESS_SENSOR_RADIUS,
  isCircularKickableToyProp,
  isFlippableBarricadeProp,
  kickProp,
} from './sim-tactical-physics.js';
import {
  activateDaedalusAnvilImpl,
  activateUpgradeAnvilImpl,
  getClipReloadGoldenWindow,
  getHeatVentOrangeZone,
  hasPlayerUsedAnvil,
} from './sim-weapon-mutators.js';
import type {
  SimEnemyState,
  SimPlayerState,
  SimPropState,
  SimWorldItemState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export interface BotTacticalCadenceState {
  reloadCycleActive: boolean;
  reloadCycleConsumed: boolean;
  reloadCycleSuccess: boolean;
  lastReloadTimer: number;
  heatCycleActive: boolean;
  heatCycleConsumed: boolean;
  heatCycleSuccess: boolean;
  lastWeaponHeat: number;
  activeCoverOpportunityKey: number;
  coverKickApproved: boolean;
  coverKickConsumed: boolean;
  bossArmorShellElapsedSec: number;
  lockedBossBreakPropId: number;
}

export function createBotTacticalCadenceState(): BotTacticalCadenceState {
  return {
    reloadCycleActive: false,
    reloadCycleConsumed: false,
    reloadCycleSuccess: false,
    lastReloadTimer: 0,
    heatCycleActive: false,
    heatCycleConsumed: false,
    heatCycleSuccess: false,
    lastWeaponHeat: 0,
    activeCoverOpportunityKey: 0,
    coverKickApproved: false,
    coverKickConsumed: false,
    bossArmorShellElapsedSec: 0,
    lockedBossBreakPropId: 0,
  };
}

/**
 * Rolls deterministically once per CLIP_RELOAD cycle or once per HEAT_VENT orange-zone entry
 * and returns INPUT_BUTTON.RELOAD_VENT with probability `perfectReloadSuccessRate` (0.50).
 */
export function stepBotReloadVentCadence(
  player: SimPlayerState,
  state: BotTacticalCadenceState,
  perfectReloadSuccessRate: number,
  nextFloat: () => number,
): number {
  const slot = player.activeWeaponSlot ?? 0;
  const activeWepId = player.weaponSlots[slot] ?? player.weaponSlots[0] ?? 'knight_sword';
  const activeWep = WEAPONS[activeWepId];
  const prevReloadHeld = ((player.lastButtons ?? 0) & INPUT_BUTTON.RELOAD_VENT) !== 0;

  if (player.reloadTimer > 0 && player.reloadDuration > 0) {
    state.heatCycleActive = false;
    state.lastWeaponHeat = 0;

    if (!state.reloadCycleActive || player.reloadTimer > state.lastReloadTimer + 1e-4) {
      state.reloadCycleActive = true;
      state.reloadCycleConsumed = false;
      state.reloadCycleSuccess = nextFloat() < perfectReloadSuccessRate;
    }
    state.lastReloadTimer = player.reloadTimer;

    if (!player.reloadLockout && !state.reloadCycleConsumed) {
      const progress = 1 - player.reloadTimer / player.reloadDuration;
      const { min: winMin, max: winMax } = getClipReloadGoldenWindow(player);
      if (progress >= winMin + 0.02 && progress <= winMax - 0.02 && !prevReloadHeld) {
        state.reloadCycleConsumed = true;
        if (state.reloadCycleSuccess) {
          return INPUT_BUTTON.RELOAD_VENT;
        }
      }
    }
    return 0;
  }

  state.reloadCycleActive = false;
  state.lastReloadTimer = 0;

  if (activeWep?.cadenceKind === 'HEAT_VENT') {
    const { min: orangeMin, max: orangeMax } = getHeatVentOrangeZone(player);
    if (
      player.overheatLockTimer <= 0 &&
      (player.ventCooldownTimer ?? 0) <= 0 &&
      player.weaponHeat >= orangeMin &&
      player.weaponHeat <= orangeMax
    ) {
      if (!state.heatCycleActive || player.weaponHeat < state.lastWeaponHeat - 5) {
        state.heatCycleActive = true;
        state.heatCycleConsumed = false;
        state.heatCycleSuccess = nextFloat() < perfectReloadSuccessRate;
      }
      state.lastWeaponHeat = player.weaponHeat;

      if (!state.heatCycleConsumed && !prevReloadHeld) {
        state.heatCycleConsumed = true;
        if (state.heatCycleSuccess) {
          return INPUT_BUTTON.RELOAD_VENT;
        }
      }
      return 0;
    }

    if (player.weaponHeat < orangeMin || player.overheatLockTimer > 0) {
      state.heatCycleActive = false;
      state.lastWeaponHeat = player.weaponHeat;
    }
  }

  return 0;
}

export interface TacticalOverrideAction {
  moveX: number;
  moveY: number;
  aimAngle: number;
  buttons: number;
}

/**
 * Evaluates whether to flip a nearby barricade [E] and Dash-Kick a tactical prop into an enemy
 * with `tacticalCoverKickProbability` (0.40) when enemy projectiles are approaching.
 */
export function computeTacticalCoverKickInput(
  sim: WorldSim,
  player: SimPlayerState,
  target: SimEnemyState | null,
  nearbyBulletCount: number,
  detectedThreatKey: number,
  state: BotTacticalCadenceState,
  tacticalCoverKickProbability: number,
  nextFloat: () => number,
): TacticalOverrideAction | null {
  if (!target || target.isBoss || Boolean(sim.getActiveBoss()) || nearbyBulletCount <= 0) {
    if (player.dashTimer <= 0) {
      state.activeCoverOpportunityKey = 0;
      state.coverKickApproved = false;
      state.coverKickConsumed = false;
    }
    return null;
  }

  let bestProp: SimPropState | null = null;
  let bestDist = 96;
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (
      prop.hp <= 0 ||
      prop.state === 'broken' ||
      prop.coverState === 'fallen' ||
      prop.coverState === 'sliding'
    ) {
      continue;
    }
    const validKind =
      isFlippableBarricadeProp(prop.kind) || isCircularKickableToyProp(prop.kind);
    if (!validKind) continue;
    const d = distance(player.x, player.y, prop.x, prop.y);
    if (d <= bestDist) {
      bestDist = d;
      bestProp = prop;
    }
  }

  if (!bestProp) {
    state.activeCoverOpportunityKey = 0;
    state.coverKickApproved = false;
    state.coverKickConsumed = false;
    return null;
  }

  const opportunityKey = bestProp.id * 97 + (detectedThreatKey || 1);
  if (state.activeCoverOpportunityKey !== opportunityKey) {
    state.activeCoverOpportunityKey = opportunityKey;
    state.coverKickApproved = nextFloat() < tacticalCoverKickProbability;
    state.coverKickConsumed = false;
  }

  if (!state.coverKickApproved) {
    return null;
  }
  if (state.coverKickConsumed && player.dashTimer <= 0) {
    return null;
  }

  const kickAngle = Math.atan2(target.y - bestProp.y, target.x - bestProp.x);
  const distToProp = distance(player.x, player.y, bestProp.x, bestProp.y);
  let moveX = (bestProp.x - player.x) / Math.max(1, distToProp);
  let moveY = (bestProp.y - player.y) / Math.max(1, distToProp);
  let buttons = INPUT_BUTTON.FIRE;

  if (distToProp < 10 && bestProp.coverState === 'low') {
    moveX = -Math.cos(kickAngle);
    moveY = -Math.sin(kickAngle);
  } else if (distToProp <= FLIP_COVER_INTERACT_RANGE) {
    if (player.dashCooldownTimer <= 0 && distToProp >= 10) {
      buttons |= INPUT_BUTTON.DASH;
      state.coverKickConsumed = true;
    }
  }

  return {
    moveX,
    moveY,
    aimAngle: kickAngle,
    buttons,
  };
}

function isValidBossArmorBreakProp(prop: SimPropState, boss: SimEnemyState): boolean {
  if (
    prop.hp <= 0 ||
    prop.state === 'broken' ||
    prop.coverState === 'fallen' ||
    prop.coverState === 'sliding'
  ) {
    return false;
  }
  if (boss.defId === 'spore_king') {
    return prop.kind === 'moss_table' || prop.kind === 'volatile_spore_pod';
  }
  if (boss.defId === 'kryssa_ice_queen') {
    return prop.kind === 'glacial_barricade' || prop.kind === 'sliding_ice_block';
  }
  if (boss.defId === 'forge_titan') {
    if (prop.kind === 'slag_crucible') {
      return distance(prop.x, prop.y, boss.x, boss.y) <= 185 + boss.radius;
    }
    return prop.kind === 'forge_blast_shield' || prop.kind === 'coal_bomb';
  }
  return isFlippableBarricadeProp(prop.kind) || isBossBiomeToyProp(prop.kind);
}

export function hasClearPropSlidePathToBoss(
  sim: WorldSim,
  prop: SimPropState,
  boss: SimEnemyState,
): boolean {
  const dx = boss.x - prop.x;
  const dy = boss.y - prop.y;
  const totalDist = Math.hypot(dx, dy);
  if (totalDist <= prop.radius + boss.radius + 8) return true;
  if (prop.kind === 'slag_crucible' && totalDist > 185 + boss.radius) return false;

  const ux = dx / totalDist;
  const uy = dy / totalDist;
  const standoffX = prop.x - ux * 32;
  const standoffY = prop.y - uy * 32;
  if (
    sim.map.resolveCircleCollision(standoffX, standoffY, 12, true).collided ||
    sim.map.getSurfaceAtWorld(standoffX, standoffY) === 'chasm'
  ) {
    return false;
  }

  const hitCheckRadius = Math.max(8, prop.radius - 2);
  for (let d = 20; d < totalDist - boss.radius - 8; d += 16) {
    const px = prop.x + ux * d;
    const py = prop.y + uy * d;
    if (sim.map.resolveCircleCollision(px, py, hitCheckRadius, true).collided) {
      return false;
    }
    for (let i = 0; i < sim.props.length; i++) {
      const other = sim.props[i]!;
      if (other.id === prop.id || other.hp <= 0 || !other.blocksMovement) continue;
      const hitR =
        other.kind === 'rotten_totem_pillar'
          ? prop.radius + Math.max(other.radius, 36)
          : prop.radius + other.radius;
      if (Math.hypot(other.x - px, other.y - py) <= hitR) {
        return false;
      }
    }
  }
  return true;
}

function selectBestBossArmorBreakProp(
  sim: WorldSim,
  player: SimPlayerState,
  boss: SimEnemyState,
): SimPropState | null {
  let bestProp: SimPropState | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (!isValidBossArmorBreakProp(prop, boss)) continue;
    const dPlayer = distance(player.x, player.y, prop.x, prop.y);
    if (prop.kind === 'coal_bomb' && prop.fuseTimer > 0 && prop.fuseTimer < 0.45 && dPlayer > 52) {
      continue;
    }
    const dBoss = distance(prop.x, prop.y, boss.x, boss.y);
    const clearPath = hasClearPropSlidePathToBoss(sim, prop, boss);
    const kindBonus =
      prop.kind === 'forge_blast_shield'
        ? -140
        : isFlippableBarricadeProp(prop.kind)
          ? -40
          : 0;
    const score = dPlayer + dBoss * 0.25 + (clearPath ? 0 : 2500) + kindBonus;
    if (score < bestScore) {
      bestScore = score;
      bestProp = prop;
    }
  }
  return bestProp;
}

/**
 * Steers the player to the nearest Barricade / Biome Toy (or Pneumatic Press), flips if needed,
 * and executes Dash-Kick to shatter the Boss's armor within `bossArmorBreakWindowSec` ([3.0, 6.0]s).
 */
export function computeBossArmorBreakInput(
  sim: WorldSim,
  player: SimPlayerState,
  activeBoss: SimEnemyState | null | undefined,
  dtSec: number,
  state: BotTacticalCadenceState,
  reactionDelaySec: number,
  bossArmorBreakWindowSec: readonly [number, number] = [3.0, 6.0],
): TacticalOverrideAction | null {
  if (!activeBoss || !activeBoss.bossArmorShellActive || activeBoss.hp <= 0) {
    state.bossArmorShellElapsedSec = 0;
    state.lockedBossBreakPropId = 0;
    return null;
  }

  // In Co-op, only one designated alive player leaves formation to kick the armor-break prop
  if (sim.getActivePlayerCount() > 1) {
    const designated = sim.getAllPlayers().find((pl) => pl.lifeState === 'alive' && pl.hp > 0);
    if (designated && designated.id !== player.id) {
      return null;
    }
  }

  state.bossArmorShellElapsedSec += dtSec;
  if (state.bossArmorShellElapsedSec < reactionDelaySec) {
    return null;
  }

  const minBreakSec = bossArmorBreakWindowSec[0];
  const prop = selectBestBossArmorBreakProp(sim, player, activeBoss);
  if (!prop && sim.pendingBossSupplyDrops.length === 0) {
    triggerBossPhaseSupplyDrop(sim, activeBoss);
  }

  if (!prop) {
    const press = sim.props.find(
      (p) =>
        p.kind === 'pneumatic_press' &&
        p.hp > 0 &&
        (p.pressState ?? 'idle') === 'idle' &&
        distance(p.x, p.y, activeBoss.x, activeBoss.y) <=
          PNEUMATIC_PRESS_CRUSH_RADIUS + activeBoss.radius + 24,
    );
    if (press) {
      const dPress = distance(player.x, player.y, press.x, press.y);
      const readyForPress = state.bossArmorShellElapsedSec >= Math.max(0.5, minBreakSec - 0.35);
      const targetDist = readyForPress ? PNEUMATIC_PRESS_SENSOR_RADIUS - 8 : PNEUMATIC_PRESS_CRUSH_RADIUS + 24;
      const angToPress = Math.atan2(press.y - player.y, press.x - player.x);
      const moveScale = dPress > targetDist ? 1 : -1;
      return {
        moveX: Math.cos(angToPress) * moveScale,
        moveY: Math.sin(angToPress) * moveScale,
        aimAngle: Math.atan2(activeBoss.y - player.y, activeBoss.x - player.x),
        buttons: 0,
      };
    }

    const pending = sim.pendingBossSupplyDrops[0];
    if (pending) {
      const wp = findNextWalkableWaypoint(sim.map, player.x, player.y, pending.x - 32, pending.y);
      const ang = Math.atan2(wp.y - player.y, wp.x - player.x);
      return {
        moveX: Math.cos(ang),
        moveY: Math.sin(ang),
        aimAngle: Math.atan2(activeBoss.y - player.y, activeBoss.x - player.x),
        buttons: 0,
      };
    }
    return null;
  }

  const kickAngle = Math.atan2(activeBoss.y - prop.y, activeBoss.x - prop.x);
  const standoffDist = player.radius + prop.radius + 4;
  const rawStandoffX = prop.x - Math.cos(kickAngle) * standoffDist;
  const rawStandoffY = prop.y - Math.sin(kickAngle) * standoffDist;
  const colStandoff = sim.map.resolveCircleCollision(rawStandoffX, rawStandoffY, player.radius, false);
  const standoffX = colStandoff.x;
  const standoffY = colStandoff.y;

  const distToProp = distance(player.x, player.y, prop.x, prop.y);
  const distToStandoff = distance(player.x, player.y, standoffX, standoffY);

  const urgentCoalBomb =
    prop.kind === 'coal_bomb' && prop.fuseTimer > 0 && prop.fuseTimer <= 0.65;
  const readyToKick =
    state.bossArmorShellElapsedSec >= minBreakSec + 0.05 || urgentCoalBomb;

  let moveX = 0;
  let moveY = 0;
  let aimAngle = kickAngle;
  let buttons = 0;

  if (readyToKick && distToProp <= 48 && distToProp >= 10) {
    moveX = (prop.x - player.x) / distToProp;
    moveY = (prop.y - player.y) / distToProp;
    aimAngle = kickAngle;
    if (player.dashCooldownTimer <= 0) {
      buttons |= INPUT_BUTTON.DASH;
    } else if (state.bossArmorShellElapsedSec >= minBreakSec + 0.45 && distToProp <= 38) {
      kickProp(sim, prop, player, kickAngle);
    }
  } else {
    const wp = findNextWalkableWaypoint(sim.map, player.x, player.y, standoffX, standoffY);
    if (distToStandoff > 4) {
      const ang = Math.atan2(wp.y - player.y, wp.x - player.x);
      moveX = Math.cos(ang);
      moveY = Math.sin(ang);
    }
    // Avoid blocking props (including the target prop before readyToKick)
    for (let i = 0; i < sim.props.length; i++) {
      const other = sim.props[i]!;
      if (other.hp <= 0 || !other.blocksMovement) continue;
      const dx = other.x - player.x;
      const dy = other.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d <= player.radius + other.radius + 22 && dx * moveX + dy * moveY > 0) {
        const side = dx * moveY - dy * moveX >= 0 ? -1 : 1;
        moveX += -moveY * side * 1.35;
        moveY += moveX * side * 1.35;
      }
    }
    const len = Math.hypot(moveX, moveY);
    if (len > 1e-4) {
      moveX /= len;
      moveY /= len;
    }
  }

  return {
    moveX,
    moveY,
    aimAngle,
    buttons,
  };
}

function shouldBotPickupFreeWeapon(p: SimPlayerState, it: SimWorldItemState, currentTick: number): boolean {
  if (
    it.pickedUp ||
    it.costGold !== 0 ||
    it.isHubRackItem ||
    (it.ownerPlayerId !== undefined && it.ownerPlayerId !== 0 && it.ownerPlayerId !== p.id)
  ) {
    return false;
  }
  if (it.kind !== 'weapon' || !it.weaponId || p.weaponSlots.includes(it.weaponId)) {
    return false;
  }
  if (
    it.droppedByPlayerId === p.id &&
    it.droppedAtTick !== undefined &&
    currentTick - it.droppedAtTick < 600
  ) {
    return false;
  }
  const wDef = WEAPONS[it.weaponId];
  if (!wDef) return false;
  const candDps = estimateWeaponDps(it.weaponId);

  if (p.weaponSlots.length < MAX_WEAPON_SLOTS) {
    const slot0Id = p.weaponSlots[0];
    if (!slot0Id) return true;
    const slot0Def = WEAPONS[slot0Id];
    if (wDef.category === 'melee' && slot0Def?.category !== 'melee') {
      return candDps > estimateWeaponDps(slot0Id);
    }
    return candDps >= estimateWeaponDps(slot0Id) || wDef.category !== slot0Def?.category;
  }

  if (wDef.category === 'melee') {
    const slot0Def = WEAPONS[p.weaponSlots[0] ?? ''];
    return slot0Def?.category === 'melee' && candDps > estimateWeaponDps(p.weaponSlots[0]!);
  }
  const rangedSlotIdx = p.weaponSlots.length > 1 ? 1 : 0;
  return candDps > estimateWeaponDps(p.weaponSlots[rangedSlotIdx]!);
}

/**
 * Out-of-combat room progression for `stepBotAutoPlayImpl`:
 * 1) Resolves pending mutator / pact modal choices
 * 2) Opens unopened chests
 * 3) Picks up desirable free ground weapons
 * 4) Salvages spare ground weapons by holding INPUT_BUTTON.DROP_WEAPON ([X]) for 0.5s (30 ticks)
 * 5) Interacts with daedalus_anvil (odd floor) or upgrade_anvil (even floor)
 * 6) Interacts with shrine (Ashen Pact Altar)
 * 7) Buys affordable items at merchant
 */
export function stepBotOutOfCombatRoomActions(
  sim: WorldSim,
  p: SimPlayerState,
  steerBotToPoint: (tx: number, ty: number) => void,
  onOverrideInput?: (input: TacticalOverrideAction) => void,
): boolean {
  for (const pl of sim.getAllPlayers()) {
    const mutChoices =
      pl.mutatorChoices ??
      (pl as SimPlayerState & { pendingMutatorChoices?: WeaponMutatorId[] }).pendingMutatorChoices;
    if (mutChoices && mutChoices.length > 0) {
      sim.selectWeaponMutator(mutChoices[0]!, pl.id);
    }
    if (pl.pactChoices && pl.pactChoices.length > 0) {
      const choice = pl.hp <= 2 ? 'decline' : pl.pactChoices[0]!;
      sim.selectAshenPact(choice, pl.id);
    }
  }

  // 1. Open unopened chests in current room
  const unopenedChest = sim.chests.find((c) => !c.opened);
  if (unopenedChest) {
    const d = distance(p.x, p.y, unopenedChest.x, unopenedChest.y);
    if (d <= 56) {
      sim.openChest(unopenedChest);
    } else {
      steerBotToPoint(unopenedChest.x, unopenedChest.y);
    }
    return true;
  }

  // 2. Pick up desirable free weapons on the ground
  const freeUpgradeWeapon = sim.worldItems.find((it) =>
    shouldBotPickupFreeWeapon(p, it, sim.tick),
  );
  if (freeUpgradeWeapon) {
    const d = distance(p.x, p.y, freeUpgradeWeapon.x, freeUpgradeWeapon.y);
    if (d <= 56) {
      if (p.weaponSlots.length >= MAX_WEAPON_SLOTS && freeUpgradeWeapon.weaponId) {
        const wDef = WEAPONS[freeUpgradeWeapon.weaponId];
        const targetSlot = wDef?.category === 'melee' ? 0 : Math.min(1, p.weaponSlots.length - 1);
        sim.equipWeaponSlot(targetSlot);
      }
      sim.pickupOrBuyWorldItem(freeUpgradeWeapon, p);
    } else {
      steerBotToPoint(freeUpgradeWeapon.x, freeUpgradeWeapon.y);
    }
    return true;
  }

  // 3. Salvage spare free ground weapons by holding DROP_WEAPON ([X]) for 0.5s (30 ticks)
  const spareGroundWeapon = sim.worldItems.find(
    (it) =>
      !it.pickedUp &&
      it.costGold === 0 &&
      it.kind === 'weapon' &&
      !it.isHubRackItem &&
      (it.ownerPlayerId === undefined || it.ownerPlayerId === 0 || it.ownerPlayerId === p.id),
  );
  if (spareGroundWeapon) {
    const d = distance(p.x, p.y, spareGroundWeapon.x, spareGroundWeapon.y);
    if (d <= WEAPON_SALVAGE_MAX_DIST - 4) {
      const salvageInput: TacticalOverrideAction = {
        moveX: 0,
        moveY: 0,
        aimAngle: p.aimAngle,
        buttons: INPUT_BUTTON.DROP_WEAPON,
      };
      sim.setPlayerInput({
        seq: sim.tick,
        tick: sim.tick,
        ...salvageInput,
        weaponSlotSelect: null,
      });
      onOverrideInput?.(salvageInput);
    } else {
      steerBotToPoint(spareGroundWeapon.x, spareGroundWeapon.y);
    }
    return true;
  }

  // 4. Interact with Daedalus Anvil (odd floors) or Upgrade Anvil (even floors)
  const room = sim.getCurrentRoom();
  const unusedAnvil = sim.npcEntities.find((n) => {
    if (n.kind !== 'daedalus_anvil' && n.kind !== 'upgrade_anvil') return false;
    if (hasPlayerUsedAnvil(n, room, p.id)) return false;
    const slot = p.activeWeaponSlot ?? 0;
    if (n.kind === 'daedalus_anvil') {
      return (p.weaponMutators?.[slot]?.length ?? 0) < MAX_MUTATORS_PER_WEAPON_SLOT;
    }
    return (p.weaponUpgradeLevels?.[slot] ?? 0) < 3;
  });
  if (unusedAnvil) {
    const d = distance(p.x, p.y, unusedAnvil.x, unusedAnvil.y);
    if (d <= 58) {
      if (unusedAnvil.kind === 'daedalus_anvil') {
        activateDaedalusAnvilImpl(sim, unusedAnvil, p);
        if (p.mutatorChoices && p.mutatorChoices.length > 0) {
          sim.selectWeaponMutator(p.mutatorChoices[0]!, p.id);
        }
      } else {
        activateUpgradeAnvilImpl(sim, unusedAnvil, p);
      }
    } else {
      steerBotToPoint(unusedAnvil.x, unusedAnvil.y);
    }
    return true;
  }

  // 5. Activate Shrine (Ashen Pact Altar) if present
  const unusedShrine = sim.npcEntities.find(
    (n) =>
      n.kind === 'shrine' &&
      !n.interacted &&
      !n.usedByPlayerIds?.includes(p.id) &&
      p.activePactId === null,
  );
  if (unusedShrine) {
    const d = distance(p.x, p.y, unusedShrine.x, unusedShrine.y);
    if (d <= 58) {
      sim.activateShrine(unusedShrine, p);
      if (p.pactChoices && p.pactChoices.length > 0) {
        const choice = p.hp <= 2 ? 'decline' : p.pactChoices[0]!;
        sim.selectAshenPact(choice, p.id);
      }
    } else {
      steerBotToPoint(unusedShrine.x, unusedShrine.y);
    }
    return true;
  }

  // 6. Buy affordable upgrades/items at Merchant
  const affordableShopItem = sim.worldItems.find((it) => {
    if (it.pickedUp || it.costGold <= 0 || p.gold < it.costGold) return false;
    if (
      it.ownerPlayerId !== undefined &&
      it.ownerPlayerId !== 0 &&
      it.ownerPlayerId !== p.id
    ) {
      return false;
    }
    if (it.kind === 'weapon_upgrade') {
      return (p.weaponUpgradeLevels?.[p.activeWeaponSlot ?? 0] ?? 0) < 3;
    }
    if (it.kind === 'armor_upgrade' || it.kind === 'blessing_scroll') {
      return true;
    }
    if (it.kind === 'health_potion') {
      return p.hp < p.maxHp || p.armor < p.maxArmor || room.type === 'merchant';
    }
    if (it.kind === 'weapon' && it.weaponId) {
      if (p.weaponSlots.includes(it.weaponId)) return false;
      const curId = p.weaponSlots[p.activeWeaponSlot] ?? p.weaponSlots[0] ?? 'knight_sword';
      return estimateWeaponDps(it.weaponId) > estimateWeaponDps(curId);
    }
    return false;
  });
  if (affordableShopItem) {
    const d = distance(p.x, p.y, affordableShopItem.x, affordableShopItem.y);
    if (d <= 56) {
      sim.pickupOrBuyWorldItem(affordableShopItem, p);
    } else {
      steerBotToPoint(affordableShopItem.x, affordableShopItem.y);
    }
    return true;
  }

  return false;
}
