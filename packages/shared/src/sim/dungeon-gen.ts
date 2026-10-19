import { SeededRandom } from '../core/prng.js';
import { BIOME1_COMBAT_ENEMIES, FLOOR_BUFFS } from '../data/enemies.js';
import type {
  CardinalDir,
  EliteModifier,
  RoomDiscoveryState,
  RoomType,
  WeaponRarity,
} from '../data/types.js';
import { WEAPONS } from '../data/weapons.js';

export const OPPOSITE_DIR: Record<CardinalDir, CardinalDir> = {
  N: 'S',
  E: 'W',
  S: 'N',
  W: 'E',
};

export const DIR_OFFSET: Record<CardinalDir, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
};

export interface DungeonEnemySpawnDef {
  defId: string;
  isElite: boolean;
  eliteModifier: EliteModifier | null;
}

export interface DungeonWaveDef {
  waveIndex: number;
  enemies: DungeonEnemySpawnDef[];
}

export interface ShopOfferDef {
  id: string;
  kind: 'health_potion' | 'weapon' | 'armor_upgrade';
  nameVi: string;
  descriptionVi: string;
  costGold: number;
  weaponId?: string;
  rarity?: WeaponRarity;
  purchased: boolean;
}

export interface DungeonRoomNode {
  id: number;
  gx: number;
  gy: number;
  type: RoomType;
  nameVi: string;
  distanceFromStart: number;
  connections: Partial<Record<CardinalDir, number>>;
  secretWallDir?: CardinalDir;
  secretWallBroken: boolean;
  discovery: RoomDiscoveryState;
  cleared: boolean;
  waves: DungeonWaveDef[];
  wavesSpawned: number;
  wavesTotal: number;
  chestRarity?: WeaponRarity;
  chestWeaponId?: string;
  chestOpened: boolean;
  shopOffers: ShopOfferDef[];
  shrineBlessingId?: string;
  shrineUsed: boolean;
  surfaceLayoutSeed: number;
}

export interface DungeonFloorGraph {
  seed: string | number;
  biome: 1 | 2 | 3;
  floorNumber: 1 | 2;
  rooms: DungeonRoomNode[];
  startRoomId: number;
  exitRoomId: number;
  secretRoomId: number;
}

const ELITE_MODIFIERS: readonly EliteModifier[] = [
  'fast',
  'shield',
  'explosive_death',
  'regen',
] as const;

export const ROOM_TYPE_NAMES_VI: Record<RoomType, string> = {
  start: 'Phòng Khởi Đầu',
  combat: 'Phòng Chiến Đấu',
  treasure: 'Phòng Kho Báu',
  merchant: 'Phòng Thương Nhân',
  shrine: 'Phòng Tượng Thần',
  secret: 'Phòng Bí Mật',
  portal: 'Phòng Cổng Dịch Chuyển',
  boss: 'Phòng Boss — Mục Vương',
};

export function rollWeaponForRarity(rng: SeededRandom, targetRarity: WeaponRarity): string {
  const matching = Object.values(WEAPONS).filter(
    (w) => w.rarity === targetRarity && w.id !== 'knight_sword',
  );
  if (matching.length > 0) {
    return rng.pick(matching).id;
  }
  return 'frost_scepter';
}

/**
 * Generates a deterministic 9-room procedural dungeon floor (within the 7..10 rooms spec)
 * with guaranteed cardinal connectivity, secret room behind a cracked wall, combat waves
 * with Biome 1 enemies & Elites, treasure chest, merchant shop, ancient shrine, and portal/boss room.
 */
export function generateDungeonFloor(
  seed: string | number,
  floorNumber: 1 | 2 = 1,
  biome: 1 | 2 | 3 = 1,
): DungeonFloorGraph {
  const rng = new SeededRandom(seed).fork(`dungeon_b${biome}_f${floorNumber}`);

  const gridMap = new Map<string, number>();
  const coordKey = (gx: number, gy: number) => `${gx},${gy}`;

  const rooms: DungeonRoomNode[] = [];

  const createEmptyNode = (id: number, gx: number, gy: number, type: RoomType): DungeonRoomNode => ({
    id,
    gx,
    gy,
    type,
    nameVi: ROOM_TYPE_NAMES_VI[type],
    distanceFromStart: 0,
    connections: {},
    secretWallBroken: false,
    discovery: 'hidden',
    cleared: false,
    waves: [],
    wavesSpawned: 0,
    wavesTotal: 1,
    chestOpened: false,
    shopOffers: [],
    shrineUsed: false,
    surfaceLayoutSeed: rng.nextInt(1000, 999999),
  });

  const linkRooms = (aId: number, bId: number, dirFromAToB: CardinalDir) => {
    const roomA = rooms[aId]!;
    const roomB = rooms[bId]!;
    roomA.connections[dirFromAToB] = bId;
    roomB.connections[OPPOSITE_DIR[dirFromAToB]] = aId;
  };

  // 1. Place Start Room at (3, 3) (id = 0)
  const startNode = createEmptyNode(0, 3, 3, 'start');
  startNode.discovery = 'cleared';
  startNode.cleared = true;
  startNode.secretWallDir = 'N';
  rooms.push(startNode);
  gridMap.set(coordKey(3, 3), 0);

  // 2. Place Secret Room at (3, 2) (id = 1, directly North of Start behind cracked_wall at (18, 0))
  const secretNode = createEmptyNode(1, 3, 2, 'secret');
  secretNode.cleared = true;
  secretNode.discovery = 'hidden';
  rooms.push(secretNode);
  gridMap.set(coordKey(3, 2), 1);
  linkRooms(0, 1, 'N');

  // 3. Grow 7 main-branch rooms from Start using E, S, W and subsequent cardinal expansions (total = 9 rooms)
  const targetTotalRooms = 9;
  const expandableIds: number[] = [0];
  const allDirs: readonly CardinalDir[] = ['E', 'S', 'W', 'N'];

  while (rooms.length < targetTotalRooms) {
    const parentId = rng.pick(expandableIds);
    const parent = rooms[parentId]!;

    // Shuffle directions deterministically
    const candidateDirs: CardinalDir[] = [];
    for (let i = 0; i < allDirs.length; i++) {
      const d = allDirs[i]!;
      if (parentId === 0 && d === 'N') continue; // North of Start is reserved for Secret Room
      const nx = parent.gx + DIR_OFFSET[d].dx;
      const ny = parent.gy + DIR_OFFSET[d].dy;
      if (nx < 0 || nx > 6 || ny < 0 || ny > 6) continue;
      if (!gridMap.has(coordKey(nx, ny))) {
        candidateDirs.push(d);
      }
    }

    if (candidateDirs.length === 0) {
      // Fallback: find any existing non-secret node with an open neighbor
      let foundFallback = false;
      for (let rId = 0; rId < rooms.length; rId++) {
        if (rId === 1) continue;
        const rNode = rooms[rId]!;
        for (const d of allDirs) {
          if (rId === 0 && d === 'N') continue;
          const nx = rNode.gx + DIR_OFFSET[d].dx;
          const ny = rNode.gy + DIR_OFFSET[d].dy;
          if (nx >= 0 && nx <= 6 && ny >= 0 && ny <= 6 && !gridMap.has(coordKey(nx, ny))) {
            const newId = rooms.length;
            const child = createEmptyNode(newId, nx, ny, 'combat');
            rooms.push(child);
            gridMap.set(coordKey(nx, ny), newId);
            linkRooms(rId, newId, d);
            expandableIds.push(newId);
            foundFallback = true;
            break;
          }
        }
        if (foundFallback) break;
      }
      if (!foundFallback) break;
      continue;
    }

    const chosenDir = rng.pick(candidateDirs);
    const nx = parent.gx + DIR_OFFSET[chosenDir].dx;
    const ny = parent.gy + DIR_OFFSET[chosenDir].dy;
    const newId = rooms.length;
    const child = createEmptyNode(newId, nx, ny, 'combat');
    rooms.push(child);
    gridMap.set(coordKey(nx, ny), newId);
    linkRooms(parentId, newId, chosenDir);
    expandableIds.push(newId);
  }

  // 4. Compute BFS distance from Start Room (ignoring secret room edge for main progression depth)
  const visited = new Set<number>([0, 1]);
  const queue: number[] = [0];
  rooms[1]!.distanceFromStart = 1;

  while (queue.length > 0) {
    const curId = queue.shift()!;
    const cur = rooms[curId]!;
    for (const d of allDirs) {
      const nextId = cur.connections[d];
      if (nextId !== undefined && !visited.has(nextId)) {
        visited.add(nextId);
        rooms[nextId]!.distanceFromStart = cur.distanceFromStart + 1;
        queue.push(nextId);
      }
    }
  }

  // Ensure start room's immediate non-secret neighbors are 'discovered' in Fog of War
  for (const d of ['E', 'S', 'W'] as const) {
    const nId = startNode.connections[d];
    if (nId !== undefined && rooms[nId]) {
      rooms[nId]!.discovery = 'discovered';
    }
  }

  // 5. Assign room types among non-start, non-secret rooms (ids 2..rooms.length-1)
  const mainRoomIds = rooms
    .filter((r) => r.id >= 2)
    .sort((a, b) => b.distanceFromStart - a.distanceFromStart || b.id - a.id)
    .map((r) => r.id);

  // Farthest room is Exit ('portal' on Floor 1, 'boss' on Floor 2)
  const exitRoomId = mainRoomIds[0]!;
  const exitRoom = rooms[exitRoomId]!;
  exitRoom.type = floorNumber === 1 ? 'portal' : 'boss';
  exitRoom.nameVi = ROOM_TYPE_NAMES_VI[exitRoom.type];

  // Remaining rooms for special rooms + combat rooms
  const remainingIds = mainRoomIds.slice(1);
  // Keep at least one immediate neighbor of start (distanceFromStart === 1) as a combat room
  const startNeighborId = remainingIds.find((id) => rooms[id]?.distanceFromStart === 1);
  const poolForSpecials = remainingIds.filter((id) => id !== startNeighborId);
  for (let i = poolForSpecials.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    const tmp = poolForSpecials[i]!;
    poolForSpecials[i] = poolForSpecials[j]!;
    poolForSpecials[j] = tmp;
  }
  const orderedIds =
    startNeighborId !== undefined ? [...poolForSpecials, startNeighborId] : poolForSpecials;

  const specialTypes: RoomType[] = ['treasure', 'merchant', 'shrine'];
  for (let i = 0; i < specialTypes.length && i < orderedIds.length; i++) {
    const rId = orderedIds[i]!;
    const sType = specialTypes[i]!;
    const room = rooms[rId]!;
    room.type = sType;
    room.nameVi = ROOM_TYPE_NAMES_VI[sType];
    room.cleared = true; // Non-combat special rooms don't lock doors
  }

  // Remaining rooms stay 'combat'
  for (let i = specialTypes.length; i < orderedIds.length; i++) {
    const rId = orderedIds[i]!;
    const room = rooms[rId]!;
    room.type = 'combat';
    room.nameVi = ROOM_TYPE_NAMES_VI.combat;
    room.cleared = false;
  }

  // 6. Populate content for each room type
  let combatRoomIndex = 0;
  for (const room of rooms) {
    if (room.type === 'secret') {
      room.waves = [];
      room.wavesTotal = 0;
      room.chestRarity = floorNumber === 2 ? 'legendary' : 'epic';
      room.chestWeaponId = rollWeaponForRarity(rng, room.chestRarity);
    } else if (room.type === 'treasure') {
      room.waves = [];
      room.wavesTotal = 0;
      const rarities: readonly WeaponRarity[] =
        floorNumber === 2 ? ['rare', 'epic', 'legendary'] : ['uncommon', 'rare', 'epic'];
      room.chestRarity = rng.pick(rarities);
      room.chestWeaponId = rollWeaponForRarity(rng, room.chestRarity);
    } else if (room.type === 'merchant') {
      room.waves = [];
      room.wavesTotal = 0;
      const shopRarity: WeaponRarity = floorNumber === 2 ? 'epic' : 'rare';
      const shopWeaponId = rollWeaponForRarity(rng, shopRarity);
      const wDef = WEAPONS[shopWeaponId]!;
      room.shopOffers = [
        {
          id: 'offer_potion',
          kind: 'health_potion',
          nameVi: 'Bình Máu Rừng Cổ (+3 HP)',
          descriptionVi: 'Hồi phục ngay 3 HP cho người chơi.',
          costGold: 15,
          purchased: false,
        },
        {
          id: `offer_weapon_${shopWeaponId}`,
          kind: 'weapon',
          nameVi: wDef.nameVi,
          descriptionVi: `Vũ khí ${wDef.rarity.toUpperCase()} · DMG ${wDef.damage}`,
          costGold: floorNumber === 2 ? 40 : 28,
          weaponId: shopWeaponId,
          rarity: shopRarity,
          purchased: false,
        },
        {
          id: 'offer_armor',
          kind: 'armor_upgrade',
          nameVi: 'Giáp Cổ Ngữ (+2 Giáp)',
          descriptionVi: 'Tăng +2 Giáp tối đa và hồi đầy Giáp.',
          costGold: 30,
          purchased: false,
        },
      ];
    } else if (room.type === 'shrine') {
      room.waves = [];
      room.wavesTotal = 0;
      const buffKeys = Object.keys(FLOOR_BUFFS);
      room.shrineBlessingId = rng.pick(buffKeys);
    } else if (room.type === 'combat') {
      combatRoomIndex += 1;
      const waveCount = combatRoomIndex >= 2 || floorNumber === 2 ? 3 : 2;
      room.waves = generateRoomWaves(rng, waveCount, floorNumber, combatRoomIndex);
      room.wavesTotal = room.waves.length;
    } else if (room.type === 'portal') {
      // Floor 1 Portal Guardian Room: 2 waves (with guaranteed Elite guardian on Wave 2), then portal unlocks!
      room.cleared = false;
      room.waves = generateRoomWaves(rng, 2, floorNumber, 3, true);
      room.wavesTotal = room.waves.length;
    } else if (room.type === 'boss') {
      // Floor 2 Boss Room: Boss Mục Vương Nấm Độc + Legendary reward chest on clear
      room.cleared = false;
      room.chestRarity = 'legendary';
      room.chestWeaponId = 'solar_archon_staff';
      room.waves = [
        {
          waveIndex: 1,
          enemies: [
            {
              defId: 'spore_king',
              isElite: false,
              eliteModifier: null,
            },
          ],
        },
      ];
      room.wavesTotal = room.waves.length;
    } else {
      room.waves = [];
      room.wavesTotal = 0;
    }
  }

  return {
    seed,
    biome,
    floorNumber,
    rooms,
    startRoomId: 0,
    exitRoomId,
    secretRoomId: 1,
  };
}

function generateRoomWaves(
  rng: SeededRandom,
  waveCount: number,
  floorNumber: 1 | 2,
  roomDifficultyIndex: number,
  guaranteeEliteOnFinalWave = false,
): DungeonWaveDef[] {
  const waves: DungeonWaveDef[] = [];

  for (let w = 1; w <= waveCount; w++) {
    const enemyCount = Math.min(5, 3 + Math.floor((w + floorNumber - 1) / 2));
    const enemies: DungeonEnemySpawnDef[] = [];

    for (let i = 0; i < enemyCount; i++) {
      // Ensure all 6 Biome 1 enemy types appear across waves
      const poolIdx = (roomDifficultyIndex * 2 + w + i) % BIOME1_COMBAT_ENEMIES.length;
      const defId =
        i === 0 ? BIOME1_COMBAT_ENEMIES[poolIdx]! : rng.pick(BIOME1_COMBAT_ENEMIES);

      const isFinalWaveFirstEnemy = w === waveCount && i === 0;
      const eliteChance = floorNumber === 2 ? 0.25 : 0.16;
      const isElite =
        defId !== 'thorn_turret' &&
        ((guaranteeEliteOnFinalWave && isFinalWaveFirstEnemy) ||
          (isFinalWaveFirstEnemy && roomDifficultyIndex >= 2) ||
          rng.chance(eliteChance));

      enemies.push({
        defId,
        isElite,
        eliteModifier: isElite ? rng.pick(ELITE_MODIFIERS) : null,
      });
    }

    waves.push({
      waveIndex: w,
      enemies,
    });
  }

  return waves;
}

/**
 * Verifies that a generated DungeonFloorGraph is 100% connected via cardinal links,
 * has bidirectional doors, and includes all required room types.
 */
export function verifyDungeonConnectivity(floor: DungeonFloorGraph): {
  valid: boolean;
  reachableCount: number;
  totalRooms: number;
  hasAllRoomTypes: boolean;
  bidirectionalLinks: boolean;
} {
  const visited = new Set<number>();
  const queue: number[] = [floor.startRoomId];
  visited.add(floor.startRoomId);

  let bidirectionalLinks = true;
  const allDirs: readonly CardinalDir[] = ['N', 'E', 'S', 'W'];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const room = floor.rooms[currId];
    if (!room) continue;

    for (const d of allDirs) {
      const neighborId = room.connections[d];
      if (neighborId === undefined) continue;
      const neighbor = floor.rooms[neighborId];
      if (!neighbor || neighbor.connections[OPPOSITE_DIR[d]] !== currId) {
        bidirectionalLinks = false;
      }
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  const typesPresent = new Set(floor.rooms.map((r) => r.type));
  const expectedExitType: RoomType = floor.floorNumber === 1 ? 'portal' : 'boss';
  const hasAllRoomTypes =
    typesPresent.has('start') &&
    typesPresent.has('combat') &&
    typesPresent.has('treasure') &&
    typesPresent.has('merchant') &&
    typesPresent.has('shrine') &&
    typesPresent.has('secret') &&
    typesPresent.has(expectedExitType);

  const valid =
    visited.size === floor.rooms.length &&
    floor.rooms.length >= 7 &&
    floor.rooms.length <= 10 &&
    hasAllRoomTypes &&
    bidirectionalLinks;

  return {
    valid,
    reachableCount: visited.size,
    totalRooms: floor.rooms.length,
    hasAllRoomTypes,
    bidirectionalLinks,
  };
}
