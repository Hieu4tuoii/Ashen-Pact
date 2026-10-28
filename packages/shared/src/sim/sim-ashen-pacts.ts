import {
  ALL_ASHEN_PACT_IDS,
  ASHEN_PACTS,
  ASHEN_RELICS,
  PACT_TO_RELIC_ID,
  RELIC_TO_PACT_ID,
  scaleRelicDamage,
} from '../data/ashen-pacts.js';
import type { AshenPactId, AshenRelicId } from '../data/types.js';
import { clamp, distance } from '../math/vec2.js';
import type { DungeonRoomNode } from './dungeon-gen.js';
import {
  ASHEN_EXECUTIONER_BASE_SPEED,
  ASHEN_EXECUTIONER_COOP_SPEED_MULT,
  ASHEN_EXECUTIONER_TARGET_SWITCH_SEC,
  ASHEN_EXECUTIONER_TELEGRAPH_SEC,
  ASHEN_EXECUTIONER_WAVE_COOLDOWN_SEC,
  ASHEN_EXECUTIONER_WAVE_DAMAGE,
  ASHEN_EXECUTIONER_WAVE_SPEED,
  EXECUTIONER_SCYTHE_BASE_DAMAGE,
  EXECUTIONER_SCYTHE_EXECUTE_THRESHOLD,
  EXECUTIONER_SCYTHE_ICD_SEC,
  EXECUTIONER_SCYTHE_RADIUS,
  VOLATILE_ARSENAL_BOSS_MORPH_INTERVAL_SEC,
  VOLATILE_ARSENAL_KEEP_MORPHED_WINDOW_SEC,
  applyRicochetVowOrGeometryEyeDamageMultiplier,
  applyRicochetVowOrGeometryEyeWallSlamBonus,
  applyRicochetVowTacticalPropBonus,
  despawnAshenExecutioners,
  getVolatileArsenalRarityPool,
  morphAllVolatileArsenalPlayers,
  morphPlayerVolatileArsenalWeapon,
  purifyVolatileArsenalIntoMasterForgeSeal,
  syncAshenExecutionerInRoom,
  tryKeepVolatileMorphedWeaponOnInteract,
  tryTriggerExecutionerScytheSlash,
  updateAshenExecutionerAI,
} from './sim-ashen-pacts-combat.js';
import type { WorldSim } from './world-sim.js';
import type { SimEnemyState, SimNpcState, SimPlayerState } from './world-sim-types.js';

export {
  ASHEN_EXECUTIONER_BASE_SPEED,
  ASHEN_EXECUTIONER_COOP_SPEED_MULT,
  ASHEN_EXECUTIONER_TARGET_SWITCH_SEC,
  ASHEN_EXECUTIONER_TELEGRAPH_SEC,
  ASHEN_EXECUTIONER_WAVE_COOLDOWN_SEC,
  ASHEN_EXECUTIONER_WAVE_DAMAGE,
  ASHEN_EXECUTIONER_WAVE_SPEED,
  EXECUTIONER_SCYTHE_BASE_DAMAGE,
  EXECUTIONER_SCYTHE_EXECUTE_THRESHOLD,
  EXECUTIONER_SCYTHE_ICD_SEC,
  EXECUTIONER_SCYTHE_RADIUS,
  VOLATILE_ARSENAL_BOSS_MORPH_INTERVAL_SEC,
  VOLATILE_ARSENAL_KEEP_MORPHED_WINDOW_SEC,
  applyRicochetVowOrGeometryEyeDamageMultiplier,
  applyRicochetVowOrGeometryEyeWallSlamBonus,
  applyRicochetVowTacticalPropBonus,
  despawnAshenExecutioners,
  getVolatileArsenalRarityPool,
  morphAllVolatileArsenalPlayers,
  morphPlayerVolatileArsenalWeapon,
  purifyVolatileArsenalIntoMasterForgeSeal,
  syncAshenExecutionerInRoom,
  tryKeepVolatileMorphedWeaponOnInteract,
  tryTriggerExecutionerScytheSlash,
  updateAshenExecutionerAI,
};

export const MAX_AWAKENED_RELICS_PER_RUN = 3;

export const SOUL_CHAIN_MAX_DIST = 260;
export const SOUL_CHAIN_DRAIN_INTERVAL_SEC = 2.5;
export const BLOOD_OATH_BASE_DPS = 22;
export const BLOOD_OATH_TICK_INTERVAL_SEC = 0.25;
export const BLOOD_OATH_BEAM_HALF_WIDTH = 14;

export const SHATTERED_GLASS_MOVE_SPEED_MULT = 1.2;
export const BLACK_CRYSTAL_REGEN_DELAY_PENALTY_SEC = 0.8;
export const BLACK_CRYSTAL_ADDITIVE_BONUS = 0.65;

export const SEARING_TRIGGER_EXTRA_LOCKOUT_SEC = 0.4;
export const PERPETUAL_CORE_WINDOW_EXPAND_RATIO = 0.25;
export const PERPETUAL_CORE_ROCKET_COUNT = 3;
export const PERPETUAL_CORE_ROCKET_BASE_DMG = 20;
export const PERPETUAL_CORE_ROCKET_SPEED = 540;

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
  if (lenSq <= 1e-8) return distance(px, py, x1, y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

export function hasPlayerActivePact(
  p: SimPlayerState | undefined | null,
  pactId: AshenPactId,
): boolean {
  return Boolean(p && p.activePactId === pactId);
}

export function hasPlayerAwakenedRelic(
  p: SimPlayerState | undefined | null,
  relicId: AshenRelicId,
): boolean {
  return Boolean(p && Array.isArray(p.awakenedRelicIds) && p.awakenedRelicIds.includes(relicId));
}

export function hasPlayerUsedAshenAltar(
  shrine: SimNpcState,
  room: DungeonRoomNode | undefined,
  playerId: number,
): boolean {
  if (shrine.usedByPlayerIds?.includes(playerId)) return true;
  if (room?.shrineUsedByPlayerIds?.includes(playerId)) return true;
  if (shrine.interacted && (!shrine.usedByPlayerIds || shrine.usedByPlayerIds.length === 0)) {
    return true;
  }
  return false;
}

export function getAvailableAshenPactPoolForPlayer(p: SimPlayerState): AshenPactId[] {
  const takenPacts = new Set<AshenPactId>();
  if (p.activePactId) {
    takenPacts.add(p.activePactId);
  }
  if (Array.isArray(p.awakenedRelicIds)) {
    for (let i = 0; i < p.awakenedRelicIds.length; i++) {
      const relicId = p.awakenedRelicIds[i]!;
      const originPact = RELIC_TO_PACT_ID[relicId];
      if (originPact) {
        takenPacts.add(originPact);
      }
    }
  }
  return ALL_ASHEN_PACT_IDS.filter((id) => !takenPacts.has(id));
}

export function activateAshenPactAltarImpl(
  sim: WorldSim,
  shrine: SimNpcState,
  actor: SimPlayerState = sim.player,
): boolean {
  if (!actor || shrine.kind !== 'shrine' || actor.lifeState !== 'alive') return false;
  const room = sim.getCurrentRoom();

  if (hasPlayerUsedAshenAltar(shrine, room, actor.id) || actor.activePactId !== null) {
    return false;
  }
  if (actor.pactChoices && actor.pactChoices.length > 0) {
    return true;
  }

  // Restore armor, weapon clip, reload state, and heat on Altar interaction
  actor.armor = actor.maxArmor;
  actor.clipAmmo = actor.clipMax;
  actor.reloadTimer = 0;
  actor.reloadLockout = false;
  actor.weaponHeat = 0;
  actor.overheatLockTimer = 0;

  // Roll 2 distinct Pacts from ALL_ASHEN_PACT_IDS not yet taken in this run
  const candidates = [...getAvailableAshenPactPoolForPlayer(actor)];
  const choices: AshenPactId[] = [];
  while (choices.length < 2 && candidates.length > 0) {
    const idx = sim.rng.nextInt(0, candidates.length - 1);
    choices.push(candidates[idx]!);
    candidates.splice(idx, 1);
  }
  actor.pactChoices = choices;

  shrine.usedByPlayerIds ??= [];
  if (!shrine.usedByPlayerIds.includes(actor.id)) {
    shrine.usedByPlayerIds.push(actor.id);
  }
  if (room) {
    room.shrineUsedByPlayerIds ??= [];
    if (!room.shrineUsedByPlayerIds.includes(actor.id)) {
      room.shrineUsedByPlayerIds.push(actor.id);
    }
  }

  const alivePlayers = sim.getAllPlayers().filter((pl) => pl.lifeState === 'alive');
  shrine.interacted =
    alivePlayers.length > 0 &&
    alivePlayers.every((pl) => Boolean(shrine.usedByPlayerIds?.includes(pl.id)));
  if (room) {
    room.shrineUsed = shrine.interacted;
  }

  shrine.dialogueVi = 'Tế Đàn Khế Ước Tro Tàn: Chọn Khế Ước hoặc Khước Từ!';
  sim.events.push({
    kind: 'shrine_blessing',
    x: shrine.x,
    y: shrine.y,
    rewardTextVi: shrine.dialogueVi,
  });
  return true;
}

export function selectAshenPactImpl(
  sim: WorldSim,
  pactIdOrDecline: AshenPactId | 'decline',
  playerId?: number,
): boolean {
  const p = playerId !== undefined ? (sim.getPlayerById(playerId) ?? sim.player) : sim.player;
  if (!p) return false;

  if (pactIdOrDecline === 'decline') {
    p.pactChoices = [];
    sim.events.push({
      kind: 'shrine_blessing',
      x: p.x,
      y: p.y,
      rewardTextVi: 'Khước từ Khế Ước Tro Tàn',
    });
    return true;
  }

  const pactDef = ASHEN_PACTS[pactIdOrDecline];
  if (!pactDef) return false;
  if (p.activePactId !== null) return false;
  if (p.pactChoices && p.pactChoices.length > 0 && !p.pactChoices.includes(pactIdOrDecline)) {
    return false;
  }

  const correspondingRelic = PACT_TO_RELIC_ID[pactIdOrDecline];
  if (p.awakenedRelicIds.includes(correspondingRelic)) return false;
  if (p.awakenedRelicIds.length >= MAX_AWAKENED_RELICS_PER_RUN) return false;

  p.activePactId = pactIdOrDecline;
  p.pactChoices = [];

  if (pactIdOrDecline === 'pact_soul_chain') {
    p.soulChainTargetId = null;
    p.soulChainTargetKind = null;
    p.soulChainStretchTimer = 0;
  } else if (pactIdOrDecline === 'pact_shattered_glass') {
    const reducedMax = Math.max(1, Math.floor(p.maxArmor * 0.5));
    p.shatteredGlassArmorReduction = p.maxArmor - reducedMax;
    p.maxArmor = reducedMax;
    p.armor = Math.min(p.armor, p.maxArmor);
  } else if (pactIdOrDecline === 'pact_volatile_arsenal') {
    const slot = p.activeWeaponSlot ?? 0;
    p.pactVolatileSlot = slot;
    p.pactOriginalWeaponId = p.weaponSlots[slot] ?? p.weaponSlots[0] ?? 'rivet_gun';
    p.volatileArsenalBossTimer = 0;
    p.pactKeepMorphedWeaponId = null;
    p.pactKeepMorphedTimer = 0;
  } else if (pactIdOrDecline === 'pact_ashen_hunted') {
    syncAshenExecutionerInRoom(sim);
  }

  sim.events.push({
    kind: 'pact_signed',
    playerId: p.id,
    pactId: pactIdOrDecline,
    nameVi: pactDef.nameVi,
    x: p.x,
    y: p.y,
  });
  return true;
}

export function purifyAshenPactsOnBossDefeated(sim: WorldSim): number {
  let purifiedCount = 0;
  const allPlayers = sim.getAllPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const p = allPlayers[i]!;
    if (p.activePactId === null) continue;
    const pactId = p.activePactId;
    const relicId = PACT_TO_RELIC_ID[pactId];
    p.activePactId = null;

    if (pactId === 'pact_soul_chain') {
      p.soulChainStretchTimer = 0;
      p.bloodOathTickTimer = 0;
    } else if (pactId === 'pact_shattered_glass') {
      p.maxArmor += p.shatteredGlassArmorReduction ?? 0;
      p.shatteredGlassArmorReduction = 0;
      p.armor = p.maxArmor;
      p.armorRegenDelaySec = Number(
        (p.armorRegenDelaySec + BLACK_CRYSTAL_REGEN_DELAY_PENALTY_SEC).toFixed(2),
      );
    } else if (pactId === 'pact_volatile_arsenal') {
      purifyVolatileArsenalIntoMasterForgeSeal(sim, p);
    } else if (pactId === 'pact_ashen_hunted') {
      p.executionerScytheIcdTimer = 0;
      despawnAshenExecutioners(sim);
    }

    if (relicId && !p.awakenedRelicIds.includes(relicId)) {
      p.awakenedRelicIds.push(relicId);
    }
    const relicDef = ASHEN_RELICS[relicId];
    sim.events.push({
      kind: 'relic_awakened',
      playerId: p.id,
      pactId,
      relicId,
      nameVi: relicDef?.nameVi ?? relicId,
      x: p.x,
      y: p.y,
    });
    purifiedCount += 1;
  }
  return purifiedCount;
}

export function getAshenPactMoveSpeedMultiplier(p: SimPlayerState): number {
  return hasPlayerActivePact(p, 'pact_shattered_glass') ? SHATTERED_GLASS_MOVE_SPEED_MULT : 1.0;
}

export function applySearingTriggerOnMissedReload(p: SimPlayerState): void {
  if (!hasPlayerActivePact(p, 'pact_searing_trigger')) return;
  p.armor = Math.max(0, p.armor - 1);
  p.armorRegenTimer = p.armorRegenDelaySec;
  p.armorRegenAccum = 0;
  p.reloadTimer += SEARING_TRIGGER_EXTRA_LOCKOUT_SEC;
  p.reloadDuration += SEARING_TRIGGER_EXTRA_LOCKOUT_SEC;
  p.fireCooldownTimer = Math.max(p.fireCooldownTimer, SEARING_TRIGGER_EXTRA_LOCKOUT_SEC);
}

export function applySearingTriggerOnOverheat(p: SimPlayerState): void {
  if (!hasPlayerActivePact(p, 'pact_searing_trigger')) return;
  p.armor = Math.max(0, p.armor - 1);
  p.armorRegenTimer = p.armorRegenDelaySec;
  p.armorRegenAccum = 0;
  p.overheatLockTimer += SEARING_TRIGGER_EXTRA_LOCKOUT_SEC;
  p.fireCooldownTimer = Math.max(p.fireCooldownTimer, SEARING_TRIGGER_EXTRA_LOCKOUT_SEC);
}

export function consumeBlackCrystalEmpowermentForShot(p: SimPlayerState): boolean {
  if (!p.blackCrystalEmpoweredNextShot) return false;
  p.blackCrystalEmpoweredNextShot = false;
  return true;
}

export function spawnPerpetualCoreAshenRockets(sim: WorldSim, p: SimPlayerState): number {
  const rocketDmg = scaleRelicDamage(PERPETUAL_CORE_ROCKET_BASE_DMG, sim.currentFloor);
  const aliveEnemies: SimEnemyState[] = [];
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (!e.isDummy && e.hp > 0 && !e.bossBurrowed) {
      aliveEnemies.push(e);
    }
  }
  aliveEnemies.sort((a, b) => distance(p.x, p.y, a.x, a.y) - distance(p.x, p.y, b.x, b.y));

  const nearest = aliveEnemies[0];
  const baseAngle = nearest
    ? Math.atan2(nearest.y - p.y, nearest.x - p.x)
    : p.aimAngle;
  const prevIds = new Set(sim.projectiles.map((pr) => pr.id));

  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    eventId: sim.nextVolleyEventId++,
    ownerId: p.id,
    team: 'player',
    weaponId: 'relic_perpetual_core_rocket',
    x: p.x,
    y: p.y,
    angle: baseAngle,
    pelletCount: PERPETUAL_CORE_ROCKET_COUNT,
    spreadRad: 0.28,
    speed: PERPETUAL_CORE_ROCKET_SPEED,
    damage: rocketDmg,
    radius: 7,
    knockback: 140,
    pierceCount: 0,
    bounceCount: 0,
    ttlSec: 1.8,
    element: 'burn',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    guaranteedElementalProc: true,
    originX: p.x,
    originY: p.y,
  });

  let spawnedIdx = 0;
  for (let i = 0; i < sim.projectiles.length; i++) {
    const proj = sim.projectiles[i]!;
    if (!prevIds.has(proj.id)) {
      if (aliveEnemies.length > 0) {
        const target = aliveEnemies[spawnedIdx % aliveEnemies.length]!;
        const fanOffset =
          aliveEnemies.length === 1 ? (spawnedIdx - 1) * 0.06 : 0;
        const ang = Math.atan2(target.y - p.y, target.x - p.x) + fanOffset;
        proj.angle = ang;
        proj.vx = Math.cos(ang) * PERPETUAL_CORE_ROCKET_SPEED;
        proj.vy = Math.sin(ang) * PERPETUAL_CORE_ROCKET_SPEED;
      } else {
        const fanAng = p.aimAngle + (spawnedIdx - 1) * 0.2;
        proj.angle = fanAng;
        proj.vx = Math.cos(fanAng) * PERPETUAL_CORE_ROCKET_SPEED;
        proj.vy = Math.sin(fanAng) * PERPETUAL_CORE_ROCKET_SPEED;
      }
      spawnedIdx += 1;
    }
  }
  return spawnedIdx;
}

export function onPlayerReloadVentOrMeleeFinisherAshenRelics(
  sim: WorldSim,
  p: SimPlayerState,
  triggerKind: 'perfect_reload' | 'tactical_vent' | 'melee_finisher',
  hitAnyEnemy = true,
): void {
  if (hasPlayerAwakenedRelic(p, 'relic_black_crystal_heart')) {
    p.blackCrystalEmpoweredNextShot = true;
  }
  if (hasPlayerAwakenedRelic(p, 'relic_perpetual_core')) {
    if (triggerKind !== 'melee_finisher' || hitAnyEnemy) {
      spawnPerpetualCoreAshenRockets(sim, p);
    }
  }
}

export function updatePlayerAshenPactAndRelicPassives(
  sim: WorldSim,
  p: SimPlayerState,
  dtSec: number,
): void {
  if (p.lifeState !== 'alive' || p.hp <= 0) return;

  if ((p.pactKeepMorphedTimer ?? 0) > 0) {
    p.pactKeepMorphedTimer = Math.max(0, (p.pactKeepMorphedTimer ?? 0) - dtSec);
    if (p.pactKeepMorphedTimer <= 0) {
      p.pactKeepMorphedWeaponId = null;
    }
  }
  if ((p.executionerScytheIcdTimer ?? 0) > 0) {
    p.executionerScytheIcdTimer = Math.max(0, (p.executionerScytheIcdTimer ?? 0) - dtSec);
  }

  if (hasPlayerActivePact(p, 'pact_volatile_arsenal')) {
    const room = sim.getCurrentRoom();
    const inBossFight =
      (room && room.type === 'boss' && !room.cleared) || sim.getActiveBoss() !== null;
    if (inBossFight) {
      p.volatileArsenalBossTimer = (p.volatileArsenalBossTimer ?? 0) + dtSec;
      while (p.volatileArsenalBossTimer + 1e-6 >= VOLATILE_ARSENAL_BOSS_MORPH_INTERVAL_SEC) {
        p.volatileArsenalBossTimer = Math.max(
          0,
          p.volatileArsenalBossTimer - VOLATILE_ARSENAL_BOSS_MORPH_INTERVAL_SEC,
        );
        morphPlayerVolatileArsenalWeapon(sim, p);
      }
    } else {
      p.volatileArsenalBossTimer = 0;
    }
  }

  const allPlayers = sim.getAllPlayers();

  // 1. Full-Biome Trial: pact_soul_chain
  if (hasPlayerActivePact(p, 'pact_soul_chain')) {
    let targetX = 0;
    let targetY = 0;
    let targetId: number | null = null;
    let targetKind: 'player' | 'enemy' | null = null;
    let bestAllyDist = Infinity;

    for (let i = 0; i < allPlayers.length; i++) {
      const other = allPlayers[i]!;
      if (other.id === p.id || other.lifeState !== 'alive') continue;
      const d = distance(p.x, p.y, other.x, other.y);
      if (d < bestAllyDist) {
        bestAllyDist = d;
        targetX = other.x;
        targetY = other.y;
        targetId = other.id;
        targetKind = 'player';
      }
    }

    if (targetId === null) {
      let bestMaxHp = -1;
      let bestEnemyDist = Infinity;
      for (let i = 0; i < sim.enemies.length; i++) {
        const e = sim.enemies[i]!;
        if (e.isDummy || e.defId === 'ashen_executioner' || e.hp <= 0 || e.bossBurrowed) continue;
        const d = distance(p.x, p.y, e.x, e.y);
        if (e.maxHp > bestMaxHp || (e.maxHp === bestMaxHp && d < bestEnemyDist)) {
          bestMaxHp = e.maxHp;
          bestEnemyDist = d;
          targetX = e.x;
          targetY = e.y;
          targetId = e.id;
          targetKind = 'enemy';
        }
      }
    }

    p.soulChainTargetId = targetId;
    p.soulChainTargetKind = targetKind;

    if (targetId !== null) {
      const dist = distance(p.x, p.y, targetX, targetY);
      if (dist > SOUL_CHAIN_MAX_DIST) {
        p.soulChainStretchTimer = (p.soulChainStretchTimer ?? 0) + dtSec;
        while (p.soulChainStretchTimer + 1e-6 >= SOUL_CHAIN_DRAIN_INTERVAL_SEC) {
          p.soulChainStretchTimer = Math.max(
            0,
            p.soulChainStretchTimer - SOUL_CHAIN_DRAIN_INTERVAL_SEC,
          );
          p.armor = Math.max(0, p.armor - 1);
          p.armorRegenTimer = p.armorRegenDelaySec;
          p.armorRegenAccum = 0;
        }
      } else {
        p.soulChainStretchTimer = 0;
      }
    } else {
      p.soulChainStretchTimer = 0;
    }
  }

  // 2. Awakened Relic: relic_blood_oath_tether
  if (hasPlayerAwakenedRelic(p, 'relic_blood_oath_tether')) {
    p.soulChainStretchTimer = 0;
    let tetherX = 0;
    let tetherY = 0;
    let tetherId: number | null = null;
    let tetherKind: 'player' | 'enemy' | null = null;
    let bestAllyDist = SOUL_CHAIN_MAX_DIST;

    for (let i = 0; i < allPlayers.length; i++) {
      const other = allPlayers[i]!;
      if (other.id === p.id || other.lifeState !== 'alive') continue;
      const d = distance(p.x, p.y, other.x, other.y);
      if (d <= bestAllyDist) {
        bestAllyDist = d;
        tetherX = other.x;
        tetherY = other.y;
        tetherId = other.id;
        tetherKind = 'player';
      }
    }

    if (tetherId === null) {
      let bestEnemyDist = SOUL_CHAIN_MAX_DIST;
      for (let i = 0; i < sim.enemies.length; i++) {
        const e = sim.enemies[i]!;
        if (e.isDummy || e.defId === 'ashen_executioner' || e.hp <= 0 || e.bossBurrowed) continue;
        const d = distance(p.x, p.y, e.x, e.y);
        if (d <= bestEnemyDist) {
          bestEnemyDist = d;
          tetherX = e.x;
          tetherY = e.y;
          tetherId = e.id;
          tetherKind = 'enemy';
        }
      }
    }

    if (!hasPlayerActivePact(p, 'pact_soul_chain')) {
      p.soulChainTargetId = tetherId;
      p.soulChainTargetKind = tetherKind;
    }

    if (tetherId !== null) {
      p.bloodOathTickTimer = (p.bloodOathTickTimer ?? 0) + dtSec;
      while (p.bloodOathTickTimer + 1e-6 >= BLOOD_OATH_TICK_INTERVAL_SEC) {
        p.bloodOathTickTimer = Math.max(0, p.bloodOathTickTimer - BLOOD_OATH_TICK_INTERVAL_SEC);
        const scaledDps = scaleRelicDamage(BLOOD_OATH_BASE_DPS, sim.currentFloor);
        const tickDmg = Math.max(1, Math.round(scaledDps * BLOOD_OATH_TICK_INTERVAL_SEC));
        for (let i = 0; i < sim.enemies.length; i++) {
          const e = sim.enemies[i]!;
          if (e.hp <= 0 || e.defId === 'ashen_executioner' || e.bossBurrowed) continue;
          if (
            pointToSegmentDist(e.x, e.y, p.x, p.y, tetherX, tetherY) <=
            e.radius + BLOOD_OATH_BEAM_HALF_WIDTH
          ) {
            sim.applyDamageToEnemy(e, tickDmg, false, 'burn', e.aimAngle, 20, false, p.id, true);
            if (e.hp > 0) {
              e.burnTimer = Math.max(e.burnTimer, 2.0);
              e.shockTimer = Math.max(e.shockTimer, 0.8);
              if (!sim.stressTestActive) {
                sim.events.push({
                  kind: 'status_applied',
                  targetId: e.id,
                  status: 'shock',
                  x: e.x,
                  y: e.y,
                });
              }
            }
          }
        }
      }
    } else {
      p.bloodOathTickTimer = 0;
    }
  }
}
