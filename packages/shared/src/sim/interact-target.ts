import { distance } from '../math/vec2.js';
import { isFlippableBarricadeProp } from './sim-tactical-physics.js';
import type {
  SimChestState,
  SimDoorState,
  SimHubStatue,
  SimNpcState,
  SimPlayerState,
  SimPropState,
  SimWorldItemState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const INTERACT_RANGE = 64;
export const REVIVE_INTERACT_RANGE = 52;
export const FLIP_COVER_INTERACT_RANGE = 52;
export const INTERACT_HYSTERESIS = 8;

export const INTERACT_RANGE_OFFSETS = {
  hub_statue: 8,
  ancient_mechanism: 10,
  chest: 0,
  world_item: 0,
  shrine: 8,
  portal: 8,
  door: 8,
} as const;

export const INTERACT_PRIORITY_ORDER = [
  'hub_statue',
  'ancient_mechanism',
  'chest',
  'world_item',
  'shrine',
  'portal',
  'door',
] as const;

export type InteractTargetKind =
  | 'revive'
  | 'flip_cover'
  | (typeof INTERACT_PRIORITY_ORDER)[number];

export type InteractTargetResult =
  | {
      kind: 'revive';
      key: string;
      x: number;
      y: number;
      distance: number;
      player: SimPlayerState;
    }
  | {
      kind: 'flip_cover';
      key: string;
      x: number;
      y: number;
      distance: number;
      prop: SimPropState;
    }
  | {
      kind: 'hub_statue';
      key: string;
      x: number;
      y: number;
      distance: number;
      statue: SimHubStatue;
    }
  | {
      kind: 'ancient_mechanism';
      key: string;
      x: number;
      y: number;
      distance: number;
      prop: SimPropState;
    }
  | {
      kind: 'chest';
      key: string;
      x: number;
      y: number;
      distance: number;
      chest: SimChestState;
    }
  | {
      kind: 'world_item';
      key: string;
      x: number;
      y: number;
      distance: number;
      item: SimWorldItemState;
    }
  | {
      kind: 'shrine';
      key: string;
      x: number;
      y: number;
      distance: number;
      npc: SimNpcState;
    }
  | {
      kind: 'portal';
      key: string;
      x: number;
      y: number;
      distance: number;
    }
  | {
      kind: 'door';
      key: string;
      x: number;
      y: number;
      distance: number;
      door: SimDoorState;
    };

export interface FindInteractTargetOptions {
  currentTargetKey?: string | null;
  hysteresis?: number;
  requireAffordable?: boolean;
}

/**
 * Shared deterministic interactable target resolver used by both simulation (`interactWithNearest`)
 * and client UI (single-pill `[E]` prompt, Weapon Comparison Card, and outline highlight).
 *
 * Selects the **closest eligible candidate** within the highest-priority category that has at
 * least one eligible candidate in range, with optional hysteresis (`8u` default) on `currentTargetKey`.
 */
export function findInteractTarget(
  sim: WorldSim,
  playerId: number = sim.player.id,
  options?: FindInteractTargetOptions,
): InteractTargetResult | null {
  const actor =
    sim.getPlayerById(playerId) ?? (playerId === sim.player.id ? sim.player : undefined);
  if (!actor || actor.lifeState !== 'alive') {
    return null;
  }

  const currentKey = options?.currentTargetKey ?? null;
  const hysteresis = options?.hysteresis ?? INTERACT_HYSTERESIS;
  const requireAffordable = options?.requireAffordable ?? false;

  // Priority 1: Downed Ally Revive (r <= 52px)
  {
    let bestAlly: SimPlayerState | null = null;
    let bestDist = Infinity;
    let bestKey = '';

    const allPlayers = sim.getAllPlayers();
    for (let i = 0; i < allPlayers.length; i++) {
      const ally = allPlayers[i]!;
      if (ally.id === actor.id || ally.lifeState !== 'downed') continue;
      const key = `revive:${ally.id}`;
      const maxRange = REVIVE_INTERACT_RANGE + (currentKey === key ? hysteresis : 0);
      const d = distance(actor.x, actor.y, ally.x, ally.y);
      if (d <= maxRange && d < bestDist) {
        bestDist = d;
        bestAlly = ally;
        bestKey = key;
      }
    }

    if (bestAlly) {
      return {
        kind: 'revive',
        key: bestKey,
        x: bestAlly.x,
        y: bestAlly.y,
        distance: bestDist,
        player: bestAlly,
      };
    }
  }

  // Priority 2: Flippable Barricade in 'low' state (r <= 52px)
  {
    let bestProp: SimPropState | null = null;
    let bestDist = Infinity;
    let bestKey = '';

    for (let i = 0; i < sim.props.length; i++) {
      const prop = sim.props[i]!;
      if (prop.hp <= 0 || prop.coverState !== 'low' || !isFlippableBarricadeProp(prop.kind)) {
        continue;
      }
      const key = `flip_cover:${prop.id}`;
      const maxRange = FLIP_COVER_INTERACT_RANGE + (currentKey === key ? hysteresis : 0);
      const d = distance(actor.x, actor.y, prop.x, prop.y);
      if (d <= maxRange && d < bestDist) {
        bestDist = d;
        bestProp = prop;
        bestKey = key;
      }
    }

    if (bestProp) {
      return {
        kind: 'flip_cover',
        key: bestKey,
        x: bestProp.x,
        y: bestProp.y,
        distance: bestDist,
        prop: bestProp,
      };
    }
  }

  // 0. Hub Character Statues
  if (sim.inHub) {
    const baseRange = INTERACT_RANGE + INTERACT_RANGE_OFFSETS.hub_statue;
    let bestStatue: SimHubStatue | null = null;
    let bestDist = Infinity;
    let bestKey = '';

    for (let i = 0; i < sim.hubStatues.length; i++) {
      const statue = sim.hubStatues[i]!;
      const key = `hub_statue:${statue.characterId}`;
      const maxRange = baseRange + (currentKey === key ? hysteresis : 0);
      const d = distance(actor.x, actor.y, statue.x, statue.y);
      if (d <= maxRange && d < bestDist) {
        bestDist = d;
        bestStatue = statue;
        bestKey = key;
      }
    }

    if (bestStatue) {
      return {
        kind: 'hub_statue',
        key: bestKey,
        x: bestStatue.x,
        y: bestStatue.y,
        distance: bestDist,
        statue: bestStatue,
      };
    }
  }

  // 1. Ancient Mechanism (Engineer Passive)
  const hasEngineerInParty =
    actor.characterId === 'engineer' ||
    sim
      .getAllPlayers()
      .some((ally) => ally.characterId === 'engineer' && ally.lifeState === 'alive');

  if (hasEngineerInParty) {
    const baseRange = INTERACT_RANGE + INTERACT_RANGE_OFFSETS.ancient_mechanism;
    let bestProp: SimPropState | null = null;
    let bestDist = Infinity;
    let bestKey = '';

    for (let i = 0; i < sim.props.length; i++) {
      const prop = sim.props[i]!;
      if (prop.kind !== 'ancient_mechanism' || prop.repaired) continue;
      const key = `ancient_mechanism:${prop.id}`;
      const maxRange = baseRange + (currentKey === key ? hysteresis : 0);
      const d = distance(actor.x, actor.y, prop.x, prop.y);
      if (d <= maxRange && d < bestDist) {
        bestDist = d;
        bestProp = prop;
        bestKey = key;
      }
    }

    if (bestProp) {
      return {
        kind: 'ancient_mechanism',
        key: bestKey,
        x: bestProp.x,
        y: bestProp.y,
        distance: bestDist,
        prop: bestProp,
      };
    }
  }

  // 2. Unopened Chests
  {
    const baseRange = INTERACT_RANGE + INTERACT_RANGE_OFFSETS.chest;
    let bestChest: SimChestState | null = null;
    let bestDist = Infinity;
    let bestKey = '';

    for (let i = 0; i < sim.chests.length; i++) {
      const chest = sim.chests[i]!;
      if (chest.opened) continue;
      const key = `chest:${chest.id}`;
      const maxRange = baseRange + (currentKey === key ? hysteresis : 0);
      const d = distance(actor.x, actor.y, chest.x, chest.y);
      if (d <= maxRange && d < bestDist) {
        bestDist = d;
        bestChest = chest;
        bestKey = key;
      }
    }

    if (bestChest) {
      return {
        kind: 'chest',
        key: bestKey,
        x: bestChest.x,
        y: bestChest.y,
        distance: bestDist,
        chest: bestChest,
      };
    }
  }

  // 3. World Items (Weapons, Health Potions, Armor Upgrades, Merchant Shop Items)
  {
    const baseRange = INTERACT_RANGE + INTERACT_RANGE_OFFSETS.world_item;
    const lockActive = (actor.weaponPickupLockTimer ?? 0) > 0;
    let bestItem: SimWorldItemState | null = null;
    let bestDist = Infinity;
    let bestKey = '';

    for (let i = 0; i < sim.worldItems.length; i++) {
      const item = sim.worldItems[i]!;
      if (item.pickedUp) continue;
      if (
        item.ownerPlayerId !== undefined &&
        item.ownerPlayerId !== 0 &&
        item.ownerPlayerId !== actor.id
      ) {
        continue;
      }
      if (item.kind === 'weapon') {
        const droppedRecentlyByActor =
          item.droppedByPlayerId === actor.id &&
          (lockActive ||
            (item.droppedAtTick !== undefined && sim.tick - item.droppedAtTick < 18));
        if (lockActive || droppedRecentlyByActor) {
          continue;
        }
      }
      if (requireAffordable && item.costGold > 0 && !actor.godMode && actor.gold < item.costGold) {
        continue;
      }

      const key = `world_item:${item.id}`;
      const maxRange = baseRange + (currentKey === key ? hysteresis : 0);
      const d = distance(actor.x, actor.y, item.x, item.y);
      if (d <= maxRange && d < bestDist) {
        bestDist = d;
        bestItem = item;
        bestKey = key;
      }
    }

    if (bestItem) {
      return {
        kind: 'world_item',
        key: bestKey,
        x: bestItem.x,
        y: bestItem.y,
        distance: bestDist,
        item: bestItem,
      };
    }
  }

  // 4. Ancient Shrine
  {
    const baseRange = INTERACT_RANGE + INTERACT_RANGE_OFFSETS.shrine;
    let bestShrine: SimNpcState | null = null;
    let bestDist = Infinity;
    let bestKey = '';

    for (let i = 0; i < sim.npcEntities.length; i++) {
      const npc = sim.npcEntities[i]!;
      if (npc.kind !== 'shrine' || npc.interacted) continue;
      if (requireAffordable) {
        const costGold = npc.costGold ?? 25;
        if (!actor.godMode && actor.gold < costGold && actor.hp <= npc.costHp) {
          continue;
        }
      }
      const key = `shrine:${npc.id}`;
      const maxRange = baseRange + (currentKey === key ? hysteresis : 0);
      const d = distance(actor.x, actor.y, npc.x, npc.y);
      if (d <= maxRange && d < bestDist) {
        bestDist = d;
        bestShrine = npc;
        bestKey = key;
      }
    }

    if (bestShrine) {
      return {
        kind: 'shrine',
        key: bestKey,
        x: bestShrine.x,
        y: bestShrine.y,
        distance: bestDist,
        npc: bestShrine,
      };
    }
  }

  // 5. Active Portal
  if (sim.portalActive) {
    const key = 'portal:active';
    const maxRange =
      INTERACT_RANGE + INTERACT_RANGE_OFFSETS.portal + (currentKey === key ? hysteresis : 0);
    const d = distance(actor.x, actor.y, sim.portalX, sim.portalY);
    if (d <= maxRange) {
      return {
        kind: 'portal',
        key,
        x: sim.portalX,
        y: sim.portalY,
        distance: d,
      };
    }
  }

  // 6. Unlocked Doors
  {
    const baseRange = INTERACT_RANGE + INTERACT_RANGE_OFFSETS.door;
    let bestDoor: SimDoorState | null = null;
    let bestDist = Infinity;
    let bestKey = '';

    for (let i = 0; i < sim.doors.length; i++) {
      const door = sim.doors[i]!;
      if (door.locked) continue;
      const key = `door:${door.dir}`;
      const maxRange = baseRange + (currentKey === key ? hysteresis : 0);
      const d = distance(actor.x, actor.y, door.x, door.y);
      if (d <= maxRange && d < bestDist) {
        bestDist = d;
        bestDoor = door;
        bestKey = key;
      }
    }

    if (bestDoor) {
      return {
        kind: 'door',
        key: bestKey,
        x: bestDoor.x,
        y: bestDoor.y,
        distance: bestDist,
        door: bestDoor,
      };
    }
  }

  return null;
}
