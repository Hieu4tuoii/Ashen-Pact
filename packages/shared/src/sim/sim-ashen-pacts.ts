import {
  ALL_ASHEN_PACT_IDS,
  ASHEN_PACTS,
  ASHEN_RELICS,
  PACT_TO_RELIC_ID,
  RELIC_TO_PACT_ID,
} from '../data/ashen-pacts.js';
import type { AshenPactId, AshenRelicId } from '../data/types.js';
import type { DungeonRoomNode } from './dungeon-gen.js';
import type { WorldSim } from './world-sim.js';
import type { SimNpcState, SimPlayerState } from './world-sim-types.js';

export const MAX_AWAKENED_RELICS_PER_RUN = 3;

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
