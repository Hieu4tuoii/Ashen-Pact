import {
  BIOME1_COMBAT_ENEMIES,
  BIOME2_COMBAT_ENEMIES,
  BIOME3_COMBAT_ENEMIES,
  ELITE_MODIFIERS,
  ENEMIES,
} from '../data/enemies.js';
import type { CardinalDir, EliteModifier } from '../data/types.js';
import { WEAPONS } from '../data/weapons.js';
import { COOP_SCALING } from '../data/scaling.js';
import { clamp, distance } from '../math/vec2.js';
import { TILE_SIZE } from '../protocol/messages.js';
import {
  type DungeonRoomNode,
  MERCHANT_BASE_PRICES,
  OPPOSITE_DIR,
  computeMerchantOfferCost,
} from './dungeon-gen.js';
import {
  findNearestWalkablePoint,
  selectCombatRoomArchetype,
  spawnCombatRoomArchetypeProps,
} from './arena-room-archetypes.js';
import {
  ensureSecretWallKickableProp,
  openChestImpl,
  pickupOrBuyWorldItemImpl,
  populateSecretRoomContents,
  spawnCoopPressurePlatePuzzleImpl,
} from './sim-secret-and-workshop.js';
import {
  despawnAshenExecutioners,
  morphAllVolatileArsenalPlayers,
  purifyAshenPactsOnBossDefeated,
  syncAshenExecutionerInRoom,
} from './sim-ashen-pacts.js';
import { populateTreasureForgeWorkshop } from './sim-weapon-mutators.js';
import { resetSecretSkillArenaState } from './sim-secret-arena.js';
import type { WorldSim } from './world-sim.js';

export { openChestImpl, pickupOrBuyWorldItemImpl, spawnCoopPressurePlatePuzzleImpl };

export function rebuildCurrentRoomDoorsImpl(this: WorldSim): void {
  this.doors.length = 0;
  if (this.inHub) return;
  const room = this.getCurrentRoom();
  const hasCombat = this.hasActiveCombatEnemies();

  for (const [dir, targetRoomId] of Object.entries(room.connections) as [
    CardinalDir,
    number | undefined,
  ][]) {
    if (targetRoomId === undefined) continue;
    const targetRoom = this.dungeon.rooms[targetRoomId];
    if (!targetRoom) continue;

    let x = this.map.width * 0.5;
    let y = this.map.height * 0.5;
    if (dir === 'N') {
      x = 18 * TILE_SIZE + 16;
      y = 1 * TILE_SIZE + 18;
    } else if (dir === 'S') {
      x = 18 * TILE_SIZE + 16;
      y = (this.map.rows - 2) * TILE_SIZE + 14;
    } else if (dir === 'W') {
      x = 1 * TILE_SIZE + 18;
      y = 11 * TILE_SIZE + 16;
    } else if (dir === 'E') {
      x = (this.map.cols - 2) * TILE_SIZE + 14;
      y = 11 * TILE_SIZE + 16;
    }

    const isSecretPassage = room.type === 'secret' || targetRoom.type === 'secret';
    const isWallBroken = Boolean(
      room.secretWallBroken || targetRoom.secretWallBroken || this.secretWallBroken,
    );
    const locked = isSecretPassage
      ? !isWallBroken || hasCombat || this.secretTrialActive
      : hasCombat || this.secretTrialActive || (!room.cleared && room.type !== 'start');

    this.doors.push({
      dir,
      targetRoomId,
      targetRoomType: targetRoom.type,
      x,
      y,
      radius: 26,
      locked,
      isSecretPassage,
    });
  }
}

export function enterRoomImpl(this: WorldSim, roomId: number, entryDir?: CardinalDir): boolean {
  const targetRoom = this.dungeon.rooms[roomId];
  if (!targetRoom) return false;
  this.inHub = false;

  const prevRoomId = this.currentRoomId;
  if (this.initializedRoomIds.has(this.currentRoomId)) {
    this.roomChestsByRoomId.set(this.currentRoomId, [...this.chests]);
    this.roomItemsByRoomId.set(this.currentRoomId, [...this.worldItems]);
  }

  this.currentRoomId = roomId;
  targetRoom.discovery = targetRoom.cleared ? 'cleared' : 'visited';
  for (const adjId of Object.values(targetRoom.connections)) {
    if (adjId !== undefined) {
      const adjRoom = this.dungeon.rooms[adjId];
      if (adjRoom && adjRoom.discovery === 'hidden' && adjRoom.type !== 'secret') {
        adjRoom.discovery = 'discovered';
      }
    }
  }

  // Clear transient entities from previous room
  this.enemies.length = 0;
  for (let i = 0; i < this.projectiles.length; i++) {
    const b = this.projectiles[i]!;
    b.ttlSec = 0;
    b.hitEntityIds.length = 0;
    this.projectilePool.push(b);
  }
  this.projectiles.length = 0;
  for (let i = 0; i < this.pickups.length; i++) {
    this.pickupPool.push(this.pickups[i]!);
  }
  this.pickups.length = 0;
  this.props.length = 0;
  this.summons.length = 0;
  this.skillZones.length = 0;
  this.chests.length = 0;
  this.worldItems.length = 0;
  this.npcEntities.length = 0;
  this.pressurePlates.length = 0;
  this.pushBlocks.length = 0;
  this.shockwaveRings.length = 0;
  this.tetherBeams.length = 0;
  this.magneticRivets.length = 0;
  this.flameFissures.length = 0;
  this.solarFireZones.length = 0;
  this.magmaTrails.length = 0;
  this.lightningPillars.length = 0;
  this.blizzardVeilActive = false;
  this.titanCoreWindowTimer = 0;
  this.titanFirstCoreBrokenId = 0;
  this.portalActive = false;
  this.waveRespawnTimer = 0;
  this.waveElapsedSec = 0;
  this.pendingVengefulRings.length = 0;
  this.pendingMortarStrikes.length = 0;
  this.empBlastVisualRings.length = 0;
  this.pendingBossSupplyDrops.length = 0;
  resetSecretSkillArenaState(this);
  this.doorTransitionCooldown = 0.55;

  for (const pl of this.getAllPlayers()) {
    pl.encasedInIceTimer = 0;
    pl.icePrisonId = 0;
    pl.seedGunRoomHealsUsed = 0;
    pl.salvageHoldTimer = 0;
    pl.salvageTargetItemId = 0;
    pl.tookDamageInCurrentRoom = false;
  }

  const isWallBroken = Boolean(
    targetRoom.secretWallBroken || this.secretWallBroken || targetRoom.type === 'secret',
  );
  const baseSeedNum = Number.isFinite(Number(this.dungeon.seed))
    ? Number(this.dungeon.seed)
    : targetRoom.surfaceLayoutSeed;
  const roomSeed = baseSeedNum + roomId * 997 + this.currentFloor * 7919;
  const activeDoorSides = Object.keys(targetRoom.connections) as CardinalDir[];
  if (targetRoom.type === 'combat') {
    const archetype = targetRoom.roomArchetype ?? selectCombatRoomArchetype(roomSeed);
    targetRoom.roomArchetype = archetype;
    this.roomArchetype = archetype;
    this.map.configureRoomLayout(
      targetRoom.type,
      roomSeed,
      isWallBroken,
      this.currentBiome,
      archetype,
      activeDoorSides,
    );
  } else {
    this.roomArchetype = undefined;
    this.map.configureRoomLayout(
      targetRoom.type,
      roomSeed,
      isWallBroken,
      this.currentBiome,
    );
  }
  this.map.placeCrackedSecretWall(targetRoom.secretWallDir, isWallBroken);

  // Position player(s) near the entrance door (opposite of entryDir)
  let spawnX = this.map.width * 0.35;
  let spawnY = this.map.height * 0.5;
  if (entryDir) {
    const arrivalSide = OPPOSITE_DIR[entryDir];
    if (arrivalSide === 'N') {
      spawnX = 18 * TILE_SIZE + 16;
      spawnY = 3 * TILE_SIZE + 20;
    } else if (arrivalSide === 'S') {
      spawnX = 18 * TILE_SIZE + 16;
      spawnY = (this.map.rows - 3) * TILE_SIZE - 8;
    } else if (arrivalSide === 'W') {
      spawnX = 3 * TILE_SIZE + 8;
      spawnY = 11 * TILE_SIZE + 16;
    } else if (arrivalSide === 'E') {
      spawnX = (this.map.cols - 3) * TILE_SIZE - 8;
      spawnY = 11 * TILE_SIZE + 16;
    }
  }
  const resolvedPos = this.map.resolveCircleCollision(spawnX, spawnY, this.player.radius);
  const hasCoopTeammates = !this.stressTestActive && this.simulatedPlayers.length > 0;
  const p1Pos = hasCoopTeammates
    ? this.map.resolveCircleCollision(resolvedPos.x - 95, resolvedPos.y - 48, this.player.radius)
    : resolvedPos;
  this.player.x = p1Pos.x;
  this.player.y = p1Pos.y;
  this.player.prevX = p1Pos.x;
  this.player.prevY = p1Pos.y;
  this.player.vx = 0;
  this.player.vy = 0;
  this.player.currentRoomId = roomId;

  // Teleport co-op teammates into the new room around the entrance!
  if (hasCoopTeammates) {
    const offsets: readonly [number, number][] = [
      [35, -48],
      [-95, 52],
      [35, 52],
      [0, -76],
    ];
    let anyTeleportedFromOutside = false;
    for (let i = 0; i < this.simulatedPlayers.length; i++) {
      const sp = this.simulatedPlayers[i]!;
      if (sp.currentRoomId !== roomId || prevRoomId !== roomId) {
        anyTeleportedFromOutside = true;
      }
      const [ox, oy] = offsets[i % offsets.length]!;
      const spPos = this.map.resolveCircleCollision(
        resolvedPos.x + ox,
        resolvedPos.y + oy,
        sp.radius,
      );
      sp.x = spPos.x;
      sp.y = spPos.y;
      sp.prevX = spPos.x;
      sp.prevY = spPos.y;
      sp.vx = 0;
      sp.vy = 0;
      sp.currentRoomId = roomId;
    }

    if (
      anyTeleportedFromOutside &&
      !targetRoom.cleared &&
      (targetRoom.type === 'combat' || targetRoom.type === 'portal' || targetRoom.type === 'boss')
    ) {
      this.events.push({
        kind: 'players_teleported_to_room',
        roomId: targetRoom.id,
        x: resolvedPos.x,
        y: resolvedPos.y,
      });
    }
  }

  this.populateRoomContents(targetRoom);
  this.initializedRoomIds.add(targetRoom.id);
  this.roomChestsByRoomId.set(targetRoom.id, [...this.chests]);
  this.roomItemsByRoomId.set(targetRoom.id, [...this.worldItems]);
  this.rebuildCurrentRoomDoors();

  this.events.push({
    kind: 'room_entered',
    roomId: targetRoom.id,
    roomType: targetRoom.type,
    floorNumber: this.currentFloor,
  });
  return true;
}

export function populateRoomContentsImpl(this: WorldSim, room: DungeonRoomNode): void {
  const cx = this.map.width * 0.5;
  const cy = this.map.height * 0.5;
  const hasSavedState =
    this.initializedRoomIds.has(room.id) &&
    (this.roomChestsByRoomId.has(room.id) || this.roomItemsByRoomId.has(room.id));

  if (hasSavedState) {
    const savedChests = this.roomChestsByRoomId.get(room.id);
    if (savedChests) this.chests.push(...savedChests);
    const savedItems = this.roomItemsByRoomId.get(room.id);
    if (savedItems) this.worldItems.push(...savedItems);
  }

  switch (room.type) {
    case 'start': {
      this.spawnTrainingDummy(210, 260);
      this.spawnDefaultArenaProps();
      if (!room.cleared) {
        this.spawnSampleWave();
      }
      break;
    }
    case 'combat': {
      spawnCombatRoomArchetypeProps(this, room);

      if (!room.cleared) {
        room.wavesSpawned = 0;
        room.wavesTotal = Math.max(2, room.waves.length || room.wavesTotal);
        this.spawnNextRoomWave();
      }
      break;
    }
    case 'treasure': {
      this.spawnProp('torch_brazier', cx - 175, cy - 80);
      this.spawnProp('torch_brazier', cx + 175, cy - 80);
      this.spawnProp('glow_mushroom', cx - 110, cy + 80);
      this.spawnProp('glow_mushroom', cx + 110, cy + 80);
      populateTreasureForgeWorkshop(this, room, hasSavedState);
      break;
    }
    case 'secret': {
      populateSecretRoomContents(this, room, hasSavedState);
      break;
    }
    case 'merchant': {
      this.spawnProp('torch_brazier', cx - 150, cy - 90);
      this.spawnProp('torch_brazier', cx + 150, cy - 90);
      this.npcEntities.push({
        id: ++this.nextEntityId,
        kind: 'merchant',
        nameVi: 'Thương Nhân Hắc Ám',
        dialogueVi: '“Vàng đổi lấy thần khí... chọn đi trước khi rừng sâu nuốt chửng ngươi!”',
        x: cx,
        y: cy - 72,
        radius: 18,
        interacted: false,
        costHp: 0,
      });
      if (!hasSavedState) {
        const positions: readonly [number, number][] = [
          [cx - 190, cy + 8],
          [cx - 95, cy + 28],
          [cx, cy + 40],
          [cx + 95, cy + 28],
          [cx + 190, cy + 8],
        ];
        if (room.shopOffers.length > 0) {
          for (let i = 0; i < room.shopOffers.length; i++) {
            const offer = room.shopOffers[i]!;
            const [ox, oy] = positions[i % positions.length]!;
            const item = this.spawnWorldItem({
              kind: offer.kind,
              weaponId: offer.weaponId,
              rarity:
                offer.rarity ??
                (offer.kind === 'weapon_upgrade'
                  ? 'legendary'
                  : offer.kind === 'blessing_scroll'
                    ? 'epic'
                    : offer.kind === 'armor_upgrade'
                      ? 'rare'
                      : 'uncommon'),
              nameVi: offer.nameVi,
              costGold: offer.costGold,
              healAmount: offer.kind === 'health_potion' ? 3 : 0,
              x: ox,
              y: oy,
              offerId: offer.id,
            });
            item.pickedUp = offer.purchased;
          }
        } else {
          const globalFloor = this.currentFloor;
          this.spawnWorldItem({
            kind: 'health_potion',
            rarity: 'uncommon',
            nameVi: 'Bình Máu Cổ Ngữ (+3 HP)',
            costGold: computeMerchantOfferCost(MERCHANT_BASE_PRICES.health_potion, globalFloor),
            healAmount: 3,
            x: cx - 190,
            y: cy + 8,
          });
          const rareWepId = this.rollRandomWeaponByRarities(['uncommon', 'rare']);
          const rareWep = WEAPONS[rareWepId]!;
          this.spawnWorldItem({
            kind: 'weapon',
            weaponId: rareWep.id,
            rarity: rareWep.rarity,
            nameVi: rareWep.nameVi,
            costGold: computeMerchantOfferCost(MERCHANT_BASE_PRICES.weapon, globalFloor),
            healAmount: 0,
            x: cx - 95,
            y: cy + 28,
          });
          this.spawnWorldItem({
            kind: 'armor_upgrade',
            rarity: 'rare',
            nameVi: 'Giáp Cổ Ngữ (+2 Giáp)',
            costGold: computeMerchantOfferCost(MERCHANT_BASE_PRICES.armor_upgrade, globalFloor),
            healAmount: 0,
            x: cx,
            y: cy + 40,
          });
          this.spawnWorldItem({
            kind: 'blessing_scroll',
            rarity: 'epic',
            nameVi: 'Thẻ Phước Lành Hành Động',
            costGold: computeMerchantOfferCost(MERCHANT_BASE_PRICES.blessing_scroll, globalFloor),
            healAmount: 0,
            x: cx + 95,
            y: cy + 28,
          });
          this.spawnWorldItem({
            kind: 'weapon_upgrade',
            rarity: 'legendary',
            nameVi: 'Đá Tinh Luyện Vũ Khí (+1 Cấp)',
            costGold: computeMerchantOfferCost(MERCHANT_BASE_PRICES.weapon_upgrade, globalFloor),
            healAmount: 0,
            x: cx + 190,
            y: cy + 8,
          });
        }
      }
      break;
    }
    case 'shrine': {
      this.spawnProp('glow_mushroom', cx - 110, cy - 75);
      this.spawnProp('glow_mushroom', cx + 110, cy - 75);
      this.spawnProp('torch_brazier', cx - 110, cy + 75);
      this.spawnProp('torch_brazier', cx + 110, cy + 75);
      const usedIds = room.shrineUsedByPlayerIds ? [...room.shrineUsedByPlayerIds] : [];
      room.shrineUsedByPlayerIds = usedIds;
      this.npcEntities.push({
        id: ++this.nextEntityId,
        kind: 'shrine',
        nameVi: 'Tế Đàn Khế Ước Tro Tàn',
        dialogueVi: room.shrineUsed
          ? 'Tế Đàn Khế Ước đã khắc ấn cổ ngữ.'
          : '[E] KÝ KHẾ ƯỚC TRO TÀN (THỬ THÁCH SUỐT BIOME)',
        x: cx,
        y: cy - 18,
        radius: 22,
        interacted: room.shrineUsed,
        costHp: 0,
        costGold: 0,
        usedByPlayerIds: usedIds,
      });
      break;
    }
    case 'portal': {
      this.spawnProp('torch_brazier', cx - 130, cy - 90);
      this.spawnProp('torch_brazier', cx + 130, cy - 90);
      this.portalX = cx;
      this.portalY = cy;
      this.doorTransitionCooldown = Math.max(this.doorTransitionCooldown, 0.75);
      if (!room.cleared) {
        room.wavesSpawned = 0;
        room.wavesTotal = Math.max(1, room.waves.length || room.wavesTotal);
        this.spawnNextRoomWave();
      } else {
        this.portalActive = true;
      }
      break;
    }
    case 'boss': {
      this.spawnProp('torch_brazier', 6 * TILE_SIZE, 4 * TILE_SIZE);
      this.spawnProp('torch_brazier', 18 * TILE_SIZE, 4 * TILE_SIZE);
      this.spawnProp('torch_brazier', 30 * TILE_SIZE, 4 * TILE_SIZE);
      this.spawnProp('torch_brazier', 6 * TILE_SIZE, 18 * TILE_SIZE);
      this.spawnProp('torch_brazier', 18 * TILE_SIZE, 18 * TILE_SIZE);
      this.spawnProp('torch_brazier', 30 * TILE_SIZE, 18 * TILE_SIZE);
      if (this.currentBiome === 2) {
        this.spawnProp('crystal_pillar', 11 * TILE_SIZE + 16, 6 * TILE_SIZE + 16);
        this.spawnProp('crystal_pillar', 25 * TILE_SIZE + 16, 6 * TILE_SIZE + 16);
        this.spawnProp('crystal_pillar', 11 * TILE_SIZE + 16, 16 * TILE_SIZE + 16);
        this.spawnProp('crystal_pillar', 25 * TILE_SIZE + 16, 16 * TILE_SIZE + 16);
      } else if (this.currentBiome === 3) {
        this.spawnProp('ancient_mechanism', 11 * TILE_SIZE + 16, 6 * TILE_SIZE + 16);
        this.spawnProp('ancient_mechanism', 25 * TILE_SIZE + 16, 16 * TILE_SIZE + 16);
      }
      this.portalX = cx;
      this.portalY = cy;
      this.doorTransitionCooldown = Math.max(this.doorTransitionCooldown, 0.75);
      if (!room.cleared) {
        room.wavesSpawned = 1;
        room.wavesTotal = 1;
        const bossDefId =
          this.currentBiome === 2
            ? 'kryssa_ice_queen'
            : this.currentBiome === 3
              ? 'forge_titan'
              : 'spore_king';
        this.spawnEnemy(bossDefId, this.map.width * 0.68, cy, false);
        syncAshenExecutionerInRoom(this);
      } else {
        this.portalActive = true;
      }
      break;
    }
  }
  ensureSecretWallKickableProp(this, room);
}

export function spawnNextRoomWaveImpl(this: WorldSim): void {
  const room = this.getCurrentRoom();
  room.wavesSpawned += 1;
  this.waveNumber += 1;
  this.waveElapsedSec = 0;
  if (room.wavesSpawned > 1) {
    morphAllVolatileArsenalPlayers(this);
  }

  const cx = this.map.width * 0.5;
  const cy = this.map.height * 0.5;
  const offsets: readonly [number, number][] = [
    [-240, -165],
    [240, -165],
    [240, 165],
    [-240, 165],
    [0, -180],
    [260, 0],
    [0, 180],
    [-260, 0],
    [-160, -115],
    [160, -115],
    [160, 115],
    [-160, 115],
  ];

  const alivePlayers = this.getAllPlayers().filter((pl) => pl.lifeState === 'alive' && pl.hp > 0);
  const selectSpawnPos = (i: number, defId: string, isElite: boolean): { x: number; y: number } => {
    const def = ENEMIES[defId];
    const radius = def ? (isElite ? Math.round(def.radius * 1.25) : def.radius) : 14;
    const jitterX = ((i % 3) - 1) * 10;
    const jitterY = ((Math.floor(i / 3) % 3) - 1) * 10;

    const qualifying: { x: number; y: number; minPlayerDist: number }[] = [];
    let bestFallback: { x: number; y: number; minPlayerDist: number } | null = null;

    for (let c = 0; c < offsets.length; c++) {
      const [ox, oy] = offsets[c]!;
      const rawX = clamp(
        cx + ox + jitterX,
        TILE_SIZE * 2.5,
        this.map.width - TILE_SIZE * 2.5,
      );
      const rawY = clamp(
        cy + oy + jitterY,
        TILE_SIZE * 2.5,
        this.map.height - TILE_SIZE * 2.5,
      );
      const resolved = this.map.resolveCircleCollision(rawX, rawY, radius);
      let candX = resolved.x;
      let candY = resolved.y;
      for (let iter = 0; iter < 2; iter++) {
        for (let pIdx = 0; pIdx < this.props.length; pIdx++) {
          const prop = this.props[pIdx]!;
          if (prop.hp <= 0 || (!prop.blocksMovement && prop.kind !== 'ancient_mechanism')) continue;
          const dx = candX - prop.x;
          const dy = candY - prop.y;
          const minDist = radius + prop.radius + 6;
          const dSq = dx * dx + dy * dy;
          if (dSq < minDist * minDist) {
            if (dSq > 1e-6) {
              const d = Math.sqrt(dSq);
              candX += (dx / d) * (minDist - d);
              candY += (dy / d) * (minDist - d);
            } else {
              candX += minDist;
            }
          }
        }
        const reCol = this.map.resolveCircleCollision(candX, candY, radius);
        candX = reCol.x;
        candY = reCol.y;
      }
      if (
        this.map.checkProjectileWallHit(candX, candY, radius - 0.5).hit ||
        this.map.getSurfaceAtWorld(candX, candY) === 'chasm'
      ) {
        continue;
      }
      let minPlayerDist = Infinity;
      for (let pIdx = 0; pIdx < alivePlayers.length; pIdx++) {
        const pl = alivePlayers[pIdx]!;
        const d = distance(candX, candY, pl.x, pl.y);
        if (d < minPlayerDist) {
          minPlayerDist = d;
        }
      }
      const cand = { x: candX, y: candY, minPlayerDist };
      if (!bestFallback || minPlayerDist > bestFallback.minPlayerDist) {
        bestFallback = cand;
      }
      if (minPlayerDist >= 140) {
        qualifying.push(cand);
      }
    }

    if (qualifying.length > 0) {
      const pick = qualifying[(i + room.wavesSpawned * 2 + room.id) % qualifying.length]!;
      return { x: pick.x, y: pick.y };
    }
    return bestFallback ? { x: bestFallback.x, y: bestFallback.y } : { x: cx + 180, y: cy };
  };

  let spawnedCount = 0;
  const waveDef = room.waves[room.wavesSpawned - 1];
  if (waveDef && waveDef.enemies.length > 0) {
    const currentPCount = this.getActivePlayerCount();
    const basePCount = this.dungeon.playerCount ?? currentPCount;
    const ratio =
      COOP_SCALING[currentPCount].waveCountMultiplier /
      Math.max(1, COOP_SCALING[basePCount].waveCountMultiplier);
    const effectiveCount =
      currentPCount === basePCount
        ? waveDef.enemies.length
        : Math.max(2, Math.round(waveDef.enemies.length * ratio));
    for (let i = 0; i < effectiveCount; i++) {
      const entry = waveDef.enemies[i % waveDef.enemies.length]!;
      const eliteMod: EliteModifier | null = entry.isElite
        ? (entry.eliteModifier ?? ELITE_MODIFIERS[(room.id + i) % ELITE_MODIFIERS.length]!)
        : null;
      const pos = selectSpawnPos(i, entry.defId, eliteMod !== null);
      const spawned = this.spawnEnemy(entry.defId, pos.x, pos.y, false, eliteMod);
      spawned.waveIndex = room.wavesSpawned;
      spawnedCount += 1;
    }
  } else {
    const combatPool =
      this.currentBiome === 2
        ? BIOME2_COMBAT_ENEMIES
        : this.currentBiome === 3
          ? BIOME3_COMBAT_ENEMIES
          : BIOME1_COMBAT_ENEMIES;
    const count = 4;
    for (let i = 0; i < count; i++) {
      const defId = combatPool[(room.id + room.wavesSpawned * 2 + i) % combatPool.length]!;
      const isEliteSlot =
        i === count - 1 && (room.wavesSpawned >= room.wavesTotal || room.type === 'portal');
      const eliteMod: EliteModifier | null = isEliteSlot
        ? ELITE_MODIFIERS[(room.id + this.currentFloor + i) % ELITE_MODIFIERS.length]!
        : null;
      const pos = selectSpawnPos(i, defId, eliteMod !== null);
      const spawned = this.spawnEnemy(defId, pos.x, pos.y, false, eliteMod);
      spawned.waveIndex = room.wavesSpawned;
      spawnedCount += 1;
    }
  }

  room.currentWaveSpawnedCount = spawnedCount;
  this.events.push({
    kind: 'wave_started',
    roomId: room.id,
    waveIndex: room.wavesSpawned,
    wavesTotal: room.wavesTotal,
    isChallenge: Boolean(room.isChallenge),
  });
  syncAshenExecutionerInRoom(this);
  this.rebuildCurrentRoomDoors();
}

export function onRoomClearedImpl(
  this: WorldSim,
  room: DungeonRoomNode = this.getCurrentRoom(),
): void {
  room.cleared = true;
  room.discovery = 'cleared';
  this.runStats.roomsCleared += 1;
  despawnAshenExecutioners(this);
  if (room.type !== 'boss') {
    morphAllVolatileArsenalPlayers(this);
  }
  const cx = this.map.width * 0.5;
  const cy = this.map.height * 0.5;

  const allPlayers = this.getAllPlayers();
  const isCombatRoom =
    room.type === 'combat' || room.type === 'portal' || room.type === 'boss';
  if (isCombatRoom) {
    for (const p of allPlayers) {
      if (p.lifeState === 'alive' && p.hp > 0 && !p.tookDamageInCurrentRoom) {
        p.gold += 10;
        this.runStats.goldEarned += 10;
        this.events.push({
          kind: 'flawless_room_cleared',
          playerId: p.id,
          goldBonus: 10,
          labelVi: '+10 VÀNG HOÀN HẢO!',
          x: p.x,
          y: p.y,
        });
      }
    }
  }
  for (const p of allPlayers) {
    p.encasedInIceTimer = 0;
    p.icePrisonId = 0;
    if (p.lifeState === 'ghost' || p.lifeState === 'downed') {
      p.lifeState = 'alive';
      p.downedTimer = 0;
      p.reviveProgress = 0;
      p.reviverPlayerId = null;
      p.hp = Math.max(2, Math.ceil(p.maxHp * 0.35));
      p.armor = Math.min(p.maxArmor, 2);
      p.invulnerableTimer = 1.5;
      this.events.push({
        kind: 'player_revived',
        playerId: p.id,
        reviverId: 0,
        x: p.x,
        y: p.y,
      });
    }
  }

  if (room.type === 'combat') {
    if (room.isChallenge || this.rng.chance(0.45)) {
      const rarity = room.chestRarity ?? this.rollChestRarity(0);
      const chestPos = findNearestWalkablePoint(this.map, cx, cy, 18);
      this.spawnChest(chestPos.x, chestPos.y, rarity, room.chestWeaponId ?? undefined);
    }
  } else if (room.type === 'portal') {
    this.portalActive = true;
    this.portalX = cx;
    this.portalY = cy;
    this.doorTransitionCooldown = Math.max(this.doorTransitionCooldown, 0.75);
  } else if (room.type === 'boss') {
    purifyAshenPactsOnBossDefeated(this);
    this.portalActive = true;
    this.portalX = cx;
    this.portalY = cy;
    this.doorTransitionCooldown = Math.max(this.doorTransitionCooldown, 0.75);
    this.blizzardVeilActive = false;
    const defaultLegWep =
      this.currentBiome === 2
        ? 'solar_archon_staff'
        : this.currentBiome === 3
          ? 'thunder_hammer'
          : 'solar_archon_staff';
    this.spawnChest(cx + 95, cy, 'legendary', room.chestWeaponId ?? defaultLegWep);
    if (this.currentFloor >= this.campaignMaxFloors) {
      this.runState = 'victory';
    }
  }

  this.roomChestsByRoomId.set(room.id, [...this.chests]);
  this.roomItemsByRoomId.set(room.id, [...this.worldItems]);
  this.rebuildCurrentRoomDoors();
  this.events.push({
    kind: 'room_cleared',
    roomId: room.id,
    roomType: room.type,
  });
}
