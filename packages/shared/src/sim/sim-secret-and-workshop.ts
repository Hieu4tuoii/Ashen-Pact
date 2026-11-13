import { FLOOR_BUFF_LIST } from '../data/enemies.js';
import type { WeaponRarity } from '../data/types.js';
import { MAX_WEAPON_SLOTS, WEAPONS } from '../data/weapons.js';
import { clamp, distance } from '../math/vec2.js';
import { TILE_SIZE } from '../protocol/messages.js';
import { findNearestWalkablePoint } from './arena-room-archetypes.js';
import type { DungeonRoomNode } from './dungeon-gen.js';
import { syncActiveWeaponCadenceState } from './sim-coop-hub.js';
import { spawnSecretChallengeCrystal } from './sim-secret-arena.js';
import { isFlippableBarricadeProp, isCircularKickableToyProp } from './sim-tactical-physics.js';
import type { PropKind, SimChestState, SimPlayerState, SimWorldItemState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const WEAPON_SALVAGE_HOLD_SEC = 0.5;
export const WEAPON_SALVAGE_MAX_DIST = 48;

export const WEAPON_SALVAGE_GOLD: Record<WeaponRarity, number> = {
  common: 10,
  uncommon: 15,
  rare: 22,
  epic: 30,
  legendary: 45,
};

export function findSalvageableWeaponNearPlayer(
  sim: WorldSim,
  p: SimPlayerState,
  maxDist = WEAPON_SALVAGE_MAX_DIST,
): SimWorldItemState | undefined {
  if (
    sim.inHub ||
    p.lifeState !== 'alive' ||
    sim.enemies.some((e) => !e.isDummy && e.hp > 0)
  ) {
    return undefined;
  }
  let bestItem: SimWorldItemState | undefined;
  let bestDist = maxDist;
  for (let i = 0; i < sim.worldItems.length; i++) {
    const item = sim.worldItems[i]!;
    if (
      item.kind !== 'weapon' ||
      item.pickedUp ||
      item.costGold > 0 ||
      item.isHubRackItem
    ) {
      continue;
    }
    if (
      item.ownerPlayerId !== undefined &&
      item.ownerPlayerId !== 0 &&
      item.ownerPlayerId !== p.id
    ) {
      continue;
    }
    const d = distance(p.x, p.y, item.x, item.y);
    if (d <= bestDist) {
      bestDist = d;
      bestItem = item;
    }
  }
  return bestItem;
}

export function salvageWorldWeaponItem(
  sim: WorldSim,
  p: SimPlayerState,
  salvageTarget: SimWorldItemState,
): number {
  salvageTarget.pickedUp = true;
  const idx = sim.worldItems.indexOf(salvageTarget);
  if (idx >= 0) {
    sim.worldItems.splice(idx, 1);
  }
  if (!sim.inHub) {
    sim.roomItemsByRoomId.set(sim.currentRoomId, [...sim.worldItems]);
  }
  const goldEarned = WEAPON_SALVAGE_GOLD[salvageTarget.rarity] ?? 10;
  p.gold += goldEarned;
  sim.runStats.goldEarned += goldEarned;
  p.salvageHoldTimer = 0;
  p.salvageTargetItemId = 0;
  sim.events.push({
    kind: 'weapon_salvaged',
    playerId: p.id,
    itemId: salvageTarget.id,
    weaponId: salvageTarget.weaponId ?? 'knight_sword',
    rarity: salvageTarget.rarity,
    goldEarned,
    x: salvageTarget.x,
    y: salvageTarget.y,
  });
  return goldEarned;
}

export function spawnCoopPressurePlatePuzzleImpl(this: WorldSim, roomId = this.currentRoomId): void {
  const cx = this.map.width * 0.5;
  const cy = this.map.height * 0.5;
  this.coopPuzzleCompleted = this.completedPuzzleRoomIds.has(roomId);
  const plateWest = findNearestWalkablePoint(this.map, cx - 110, cy - 118, 20);
  const plateEast = findNearestWalkablePoint(this.map, cx + 110, cy - 118, 20);
  this.pressurePlates = [
    {
      id: ++this.nextPuzzleEntityId,
      x: plateWest.x,
      y: plateWest.y,
      radius: 20,
      pressed: this.coopPuzzleCompleted,
    },
    {
      id: ++this.nextPuzzleEntityId,
      x: plateEast.x,
      y: plateEast.y,
      radius: 20,
      pressed: this.coopPuzzleCompleted,
    },
  ];
  this.pushBlocks = [];
  if (this.getActivePlayerCount() === 1) {
    const blockPos = this.coopPuzzleCompleted
      ? plateEast
      : findNearestWalkablePoint(this.map, cx + 110, cy - 58, 15);
    this.pushBlocks.push({
      id: ++this.nextPuzzleEntityId,
      x: blockPos.x,
      y: blockPos.y,
      radius: 15,
    });
  }
}

export function ensureSecretWallKickableProp(sim: WorldSim, room: DungeonRoomNode): void {
  if (!room.secretWallDir || room.type === 'secret' || room.secretWallBroken || sim.secretWallBroken) {
    return;
  }
  const cw = sim.map.getCrackedWallTileForDir(room.secretWallDir);
  const wallX = cw.tx * TILE_SIZE + TILE_SIZE * 0.5;
  const wallY = cw.ty * TILE_SIZE + TILE_SIZE * 0.5;
  const hasNearbyKickable = sim.props.some(
    (p) =>
      p.hp > 0 &&
      (isFlippableBarricadeProp(p.kind) || isCircularKickableToyProp(p.kind)) &&
      distance(p.x, p.y, wallX, wallY) <= 185,
  );
  if (hasNearbyKickable) return;

  const midX = Math.floor(sim.map.cols / 2);
  const midY = Math.floor(sim.map.rows / 2);
  const targetX =
    room.secretWallDir === 'W'
      ? 4 * TILE_SIZE + 16
      : room.secretWallDir === 'E'
        ? (sim.map.cols - 5) * TILE_SIZE + 16
        : midX * TILE_SIZE + 16;
  const targetY =
    room.secretWallDir === 'N'
      ? 4 * TILE_SIZE + 16
      : room.secretWallDir === 'S'
        ? (sim.map.rows - 5) * TILE_SIZE + 16
        : midY * TILE_SIZE + 16;
  const safePt = findNearestWalkablePoint(sim.map, targetX, targetY, 18);
  const barricadeKind: PropKind =
    sim.currentBiome === 2
      ? 'glacial_barricade'
      : sim.currentBiome === 3
        ? 'forge_blast_shield'
        : 'moss_table';
  sim.spawnProp(barricadeKind, safePt.x, safePt.y);
}

export function populateSecretRoomContents(
  sim: WorldSim,
  room: DungeonRoomNode,
  hasSavedState: boolean,
): void {
  const cx = sim.map.width * 0.5;
  const cy = sim.map.height * 0.5;
  sim.secretWallBroken = true;
  room.secretWallBroken = true;

  sim.spawnProp('crystal_pillar', cx - 105, cy - 55);
  sim.spawnProp('crystal_pillar', cx + 105, cy - 55);
  sim.spawnProp('glow_mushroom', cx - 95, cy + 55);
  sim.spawnProp('glow_mushroom', cx + 95, cy + 55);
  spawnSecretChallengeCrystal(sim, room);

  if (!hasSavedState && !room.chestOpened) {
    const rarity: WeaponRarity =
      room.chestRarity === 'rare' || room.chestRarity === 'epic'
        ? room.chestRarity
        : sim.rng.chance(0.5)
          ? 'epic'
          : 'rare';
    sim.spawnChest(cx, cy - 10, rarity, room.chestWeaponId ?? undefined);

    // 2 Gold Crystal clusters (+15 Gold each = +30 Gold total per player, instanced in Co-op)
    const allPlayers = sim.getAllPlayers();
    const isCoop = allPlayers.length > 1;
    const clusterPositions: readonly [number, number][] = [
      [cx - 48, cy + 38],
      [cx + 48, cy + 38],
    ];
    for (const pl of allPlayers) {
      for (let i = 0; i < clusterPositions.length; i++) {
        const [gx, gy] = clusterPositions[i]!;
        const safeGoldPt = findNearestWalkablePoint(sim.map, gx, gy, 10);
        sim.pickups.push(
          sim.acquirePickup({
            id: ++sim.nextEntityId,
            kind: 'gold',
            x: safeGoldPt.x,
            y: safeGoldPt.y,
            vx: 0,
            vy: 0,
            amount: 15,
            ttlSec: 60,
            ownerPlayerId: isCoop ? pl.id : undefined,
          }),
        );
      }
    }
  }
}

export function openChestImpl(this: WorldSim, chest: SimChestState): boolean {
  if (chest.opened || this.secretTrialActive) return false;
  chest.opened = true;
  const room = this.getCurrentRoom();
  room.chestOpened = true;
  this.runStats.chestsOpened += 1;

  const wep = WEAPONS[chest.droppedWeaponId] ?? WEAPONS.gale_smg!;
  const allPlayers = this.getAllPlayers();

  if (allPlayers.length > 1) {
    for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
      const p = allPlayers[pIdx]!;
      const instancedWepId =
        pIdx === 0 ? wep.id : this.rollRandomWeaponByRarities([chest.rarity, wep.rarity]);
      const rolledWep = WEAPONS[instancedWepId];
      const instancedWep =
        rolledWep && (chest.rarity !== 'legendary' || rolledWep.rarity === 'legendary')
          ? rolledWep
          : wep;
      const offsetX = (pIdx - (allPlayers.length - 1) * 0.5) * 34;
      this.spawnWorldItem({
        kind: 'weapon',
        weaponId: instancedWep.id,
        rarity: instancedWep.rarity,
        nameVi: instancedWep.nameVi,
        costGold: 0,
        healAmount: 0,
        x: chest.x + offsetX,
        y: chest.y + 28,
        fromX: chest.x,
        fromY: chest.y - 6,
        droppedAtTick: this.tick,
        ownerPlayerId: p.id,
      });

      const totalGold = this.rng.nextInt(6, 10);
      const gold1 = Math.floor(totalGold / 2);
      const gold2 = totalGold - gold1;
      for (let i = 0; i < 2; i++) {
        const ang = -Math.PI * 0.5 + (i === 0 ? -0.5 : 0.5) + pIdx * 0.25;
        this.pickups.push(
          this.acquirePickup({
            id: ++this.nextEntityId,
            kind: 'gold',
            x: chest.x,
            y: chest.y,
            vx: Math.cos(ang) * 95,
            vy: Math.sin(ang) * 95,
            amount: i === 0 ? gold1 : gold2,
            ttlSec: 20,
            ownerPlayerId: p.id,
          }),
        );
      }
    }
  } else {
    this.spawnWorldItem({
      kind: 'weapon',
      weaponId: wep.id,
      rarity: wep.rarity,
      nameVi: wep.nameVi,
      costGold: 0,
      healAmount: 0,
      x: chest.x,
      y: chest.y + 28,
      fromX: chest.x,
      fromY: chest.y - 6,
      droppedAtTick: this.tick,
    });

    const totalGold = this.rng.nextInt(6, 10);
    const gold1 = Math.floor(totalGold / 2);
    const gold2 = totalGold - gold1;
    for (let i = 0; i < 2; i++) {
      const ang = -Math.PI * 0.5 + (i === 0 ? -0.5 : 0.5);
      this.pickups.push(
        this.acquirePickup({
          id: ++this.nextEntityId,
          kind: 'gold',
          x: chest.x,
          y: chest.y,
          vx: Math.cos(ang) * 95,
          vy: Math.sin(ang) * 95,
          amount: i === 0 ? gold1 : gold2,
          ttlSec: 20,
        }),
      );
    }
  }

  this.roomChestsByRoomId.set(room.id, [...this.chests]);
  this.roomItemsByRoomId.set(room.id, [...this.worldItems]);

  this.events.push({
    kind: 'chest_opened',
    chestId: chest.id,
    rarity: chest.rarity,
    weaponId: wep.id,
    x: chest.x,
    y: chest.y,
  });
  return true;
}

export function pickupOrBuyWorldItemImpl(
  this: WorldSim,
  item: SimWorldItemState,
  collector: SimPlayerState = this.player,
): boolean {
  if (item.pickedUp || collector.lifeState !== 'alive') return false;
  if (
    item.ownerPlayerId !== undefined &&
    item.ownerPlayerId !== 0 &&
    item.ownerPlayerId !== collector.id
  ) {
    return false;
  }

  if (item.kind === 'weapon') {
    const lockActive = (collector.weaponPickupLockTimer ?? 0) > 0;
    const droppedRecentlyByCollector =
      item.droppedByPlayerId === collector.id &&
      (lockActive ||
        (item.droppedAtTick !== undefined && this.tick - item.droppedAtTick < 18));
    if (droppedRecentlyByCollector || (lockActive && item.isHubRackItem)) {
      return false;
    }
  }

  if (item.kind === 'weapon_upgrade') {
    const slot = collector.activeWeaponSlot ?? 0;
    if ((collector.weaponUpgradeLevels?.[slot] ?? 0) >= 3) {
      return false;
    }
  }

  if (item.costGold > 0) {
    if (collector.gold >= item.costGold) {
      collector.gold -= item.costGold;
    } else if (!collector.godMode) {
      return false;
    } else {
      collector.gold = 0;
    }
    this.events.push({
      kind: 'item_purchased',
      itemId: item.id,
      nameVi: item.nameVi,
      costGold: item.costGold,
      x: item.x,
      y: item.y,
    });
  }

  item.pickedUp = true;
  const room = this.getCurrentRoom();
  if (item.offerId) {
    const offer = room.shopOffers.find((o) => o.id === item.offerId);
    if (offer) offer.purchased = true;
  } else {
    const idx = this.worldItems.indexOf(item);
    if (idx >= 0) {
      this.worldItems.splice(idx, 1);
    }
  }

  if (this.inHub && item.isHubRackItem && item.weaponId) {
    this.spawnWorldItem({
      kind: 'weapon',
      weaponId: item.weaponId,
      rarity: item.rarity,
      nameVi: item.nameVi,
      costGold: 0,
      healAmount: 0,
      x: item.x,
      y: item.y,
      isHubRackItem: true,
      droppedByPlayerId: collector.id,
      droppedAtTick: this.tick,
    });
  }

  if (item.kind === 'health_potion') {
    collector.hp = Math.min(collector.maxHp, collector.hp + item.healAmount);
    collector.armor = Math.min(collector.maxArmor, collector.armor + 2);
    if (!this.inHub) {
      this.roomItemsByRoomId.set(room.id, [...this.worldItems]);
    }
    return true;
  }

  if (item.kind === 'blessing_scroll') {
    const available = FLOOR_BUFF_LIST.filter(
      (b) =>
        !collector.blessingIds.includes(b.id) &&
        (b.category === 'general' || b.characterId === collector.characterId),
    ).map((b) => b.id);
    const pool =
      available.length > 0
        ? available
        : FLOOR_BUFF_LIST.filter((b) => !collector.blessingIds.includes(b.id)).map((b) => b.id);
    if (pool.length > 0) {
      const chosen = this.rng.pick(pool);
      this.applyBuffEffects(chosen, collector.id);
    }
    if (!this.inHub) {
      this.roomItemsByRoomId.set(room.id, [...this.worldItems]);
    }
    return true;
  }

  if (item.kind === 'weapon_upgrade') {
    const slot = collector.activeWeaponSlot ?? 0;
    collector.weaponUpgradeLevels ??= { 0: 0, 1: 0 };
    const current = collector.weaponUpgradeLevels[slot] ?? 0;
    collector.weaponUpgradeLevels[slot] = Math.min(3, current + 1);
    if (!this.inHub) {
      this.roomItemsByRoomId.set(room.id, [...this.worldItems]);
    }
    return true;
  }

  if (item.kind === 'weapon' && item.weaponId && WEAPONS[item.weaponId]) {
    collector.weaponPickupLockTimer = 0.3;
    const existingIdx = collector.weaponSlots.indexOf(item.weaponId);
    if (existingIdx >= 0) {
      if (collector.id === this.player.id) {
        this.equipWeaponSlot(existingIdx);
      } else if (collector.activeWeaponSlot !== existingIdx) {
        collector.activeWeaponSlot = existingIdx;
        this.events.push({
          kind: 'weapon_swapped',
          playerId: collector.id,
          weaponId: item.weaponId,
          slot: existingIdx,
        });
      }
    } else if (collector.weaponSlots.length < MAX_WEAPON_SLOTS) {
      collector.weaponSlots.push(item.weaponId);
      const newSlot = collector.weaponSlots.length - 1;
      if (collector.id === this.player.id) {
        this.equipWeaponSlot(newSlot);
      } else {
        collector.activeWeaponSlot = newSlot;
        this.events.push({
          kind: 'weapon_swapped',
          playerId: collector.id,
          weaponId: item.weaponId,
          slot: newSlot,
        });
      }
    } else {
      const activeIdx = clamp(collector.activeWeaponSlot, 0, collector.weaponSlots.length - 1);
      const oldWeaponId = collector.weaponSlots[activeIdx]!;
      if (this.inHub && item.isHubRackItem) {
        const dropPos = this.map.resolveCircleCollision(
          collector.x + Math.cos(collector.aimAngle) * 28,
          collector.y + Math.sin(collector.aimAngle) * 28,
          15,
        );
        this.spawnDroppedWeapon(
          oldWeaponId,
          dropPos.x,
          dropPos.y,
          collector.id,
          collector.x,
          collector.y,
        );
      } else {
        this.spawnDroppedWeapon(
          oldWeaponId,
          item.x,
          item.y,
          collector.id,
          collector.x,
          collector.y,
        );
      }
      collector.weaponSlots[activeIdx] = item.weaponId;
      collector.activeWeaponSlot = activeIdx;
      this.events.push({
        kind: 'weapon_swapped',
        playerId: collector.id,
        weaponId: item.weaponId,
        slot: activeIdx,
      });
    }
    syncActiveWeaponCadenceState(collector);
    if (!this.inHub) {
      this.roomItemsByRoomId.set(room.id, [...this.worldItems]);
    }
    return true;
  }
  if (!this.inHub) {
    this.roomItemsByRoomId.set(room.id, [...this.worldItems]);
  }
  return false;
}
