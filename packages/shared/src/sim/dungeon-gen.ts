import { SeededRandom } from '../core/prng.js';
import {
  BIOME1_COMBAT_ENEMIES,
  BIOME2_COMBAT_ENEMIES,
  BIOME3_COMBAT_ENEMIES,
  FLOOR_BUFFS,
} from '../data/enemies.js';
import { COOP_SCALING } from '../data/scaling.js';
import type {
  CardinalDir,
  EliteModifier,
  RoomDiscoveryState,
  RoomType,
  WeaponRarity,
} from '../data/types.js';
import { PHASE3_WEAPON_IDS, WEAPONS } from '../data/weapons.js';

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
  isChallenge?: boolean;
  currentWaveSpawnedCount?: number;
}

export interface DungeonFloorGraph {
  seed: string | number;
  biome: 1 | 2 | 3;
  floorNumber: 1 | 2;
  globalFloorNumber?: number;
  playerCount?: 1 | 2 | 3 | 4;
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
  'volley',
  'vengeful',
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

export const BIOME_NAMES_VI: Record<1 | 2 | 3, string> = {
  1: 'Rừng Mục Cổ Đại',
  2: 'Hầm Băng Vĩnh Cửu',
  3: 'Lò Rèn Dung Nham',
};

export const BIOME_BOSS_IDS: Record<1 | 2 | 3, string> = {
  1: 'spore_king',
  2: 'kryssa_ice_queen',
  3: 'forge_titan',
};

export const BIOME_BOSS_ROOM_NAMES_VI: Record<1 | 2 | 3, string> = {
  1: 'Phòng Boss — Mục Vương',
  2: 'Phòng Boss — Băng Hậu Kryssa',
  3: 'Phòng Boss — Titan Lò Rèn',
};

export function rollWeaponForRarity(
  rng: SeededRandom,
  targetRarity: WeaponRarity,
  biome: 1 | 2 | 3 = 1,
): string {
  const poolIds = biome === 1 ? PHASE3_WEAPON_IDS : Object.keys(WEAPONS);
  const matching = poolIds
    .map((id) => WEAPONS[id]!)
    .filter((w) => w && w.rarity === targetRarity && w.id !== 'knight_sword');
  if (matching.length > 0) {
    return rng.pick(matching).id;
  }
  return 'tesla_carbine';
}

/**
 * Generates a deterministic 10-room procedural dungeon floor (within the 7..10 rooms spec)
 * with guaranteed cardinal connectivity, secret room behind a cracked wall, 4 combat rooms
 * (3 standard + 1 Challenge Room) with Biome 1/2/3 enemies & Elites, treasure chest,
 * merchant shop, ancient shrine, and portal/boss room.
 */
export function generateDungeonFloor(
  seed: string | number,
  floorNumber: 1 | 2 = 1,
  biome: 1 | 2 | 3 = 1,
  playerCount: 1 | 2 | 3 | 4 = 1,
): DungeonFloorGraph {
  const localFloor: 1 | 2 = floorNumber % 2 === 0 ? 2 : 1;
  const rng = new SeededRandom(seed).fork(`dungeon_b${biome}_f${localFloor}`);

  const gridMap = new Map<string, number>();
  const coordKey = (gx: number, gy: number) => `${gx},${gy}`;

  const rooms: DungeonRoomNode[] = [];

  const createEmptyNode = (
    id: number,
    gx: number,
    gy: number,
    type: RoomType,
  ): DungeonRoomNode => ({
    id,
    gx,
    gy,
    type,
    nameVi: type === 'boss' ? BIOME_BOSS_ROOM_NAMES_VI[biome] : ROOM_TYPE_NAMES_VI[type],
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
  exitRoom.type = localFloor === 1 ? 'portal' : 'boss';
  exitRoom.nameVi =
    exitRoom.type === 'boss' ? BIOME_BOSS_ROOM_NAMES_VI[biome] : ROOM_TYPE_NAMES_VI[exitRoom.type];

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

  // 5b. Attach 1 Challenge Combat Room (id = 9) using a forked RNG so rooms 0..8 layout is 100% preserved
  const challengeRng = rng.fork('challenge_combat_room');
  const firstCombatId = rooms.find((r) => r.type === 'combat')?.id ?? -1;
  const preferredParentIds = [
    ...rooms
      .filter((r) => r.type === 'shrine' || r.type === 'merchant' || r.type === 'treasure')
      .map((r) => r.id),
    ...rooms.filter((r) => r.type === 'combat' && r.id !== firstCombatId).map((r) => r.id),
    ...rooms.filter((r) => r.id !== 1).map((r) => r.id),
  ];
  for (const pId of preferredParentIds) {
    const parent = rooms[pId];
    if (!parent) continue;
    const openDirs = allDirs.filter((d) => {
      if (pId === 0 && d === 'N') return false;
      const nx = parent.gx + DIR_OFFSET[d].dx;
      const ny = parent.gy + DIR_OFFSET[d].dy;
      return nx >= 0 && nx <= 6 && ny >= 0 && ny <= 6 && !gridMap.has(coordKey(nx, ny));
    });
    if (openDirs.length === 0) continue;
    const chosenDir = challengeRng.pick(openDirs);
    const nx = parent.gx + DIR_OFFSET[chosenDir].dx;
    const ny = parent.gy + DIR_OFFSET[chosenDir].dy;
    const newId = rooms.length;
    const child: DungeonRoomNode = {
      id: newId,
      gx: nx,
      gy: ny,
      type: 'combat',
      nameVi: 'Phòng Thử Thách',
      isChallenge: true,
      distanceFromStart: parent.distanceFromStart + 1,
      connections: {},
      secretWallBroken: false,
      discovery: pId === 0 ? 'discovered' : 'hidden',
      cleared: false,
      waves: [],
      wavesSpawned: 0,
      wavesTotal: 3,
      chestOpened: false,
      shopOffers: [],
      shrineUsed: false,
      surfaceLayoutSeed: challengeRng.nextInt(1000, 999999),
    };
    rooms.push(child);
    gridMap.set(coordKey(nx, ny), newId);
    linkRooms(pId, newId, chosenDir);
    break;
  }

  // 6. Populate content for each room type
  let combatRoomIndex = 0;
  for (const room of rooms) {
    if (room.type === 'secret') {
      room.waves = [];
      room.wavesTotal = 0;
      room.chestRarity = localFloor === 2 ? 'legendary' : 'epic';
      room.chestWeaponId = rollWeaponForRarity(rng, room.chestRarity, biome);
    } else if (room.type === 'treasure') {
      room.waves = [];
      room.wavesTotal = 0;
      const rarities: readonly WeaponRarity[] =
        localFloor === 2 ? ['rare', 'epic', 'legendary'] : ['uncommon', 'rare', 'epic'];
      room.chestRarity = rng.pick(rarities);
      room.chestWeaponId = rollWeaponForRarity(rng, room.chestRarity, biome);
    } else if (room.type === 'merchant') {
      room.waves = [];
      room.wavesTotal = 0;
      const floorScale = 1 + (localFloor - 1) * 0.25;
      const shopRarity: WeaponRarity = localFloor === 2 ? 'epic' : 'rare';
      const shopWeaponId = rollWeaponForRarity(rng, shopRarity, biome);
      const wDef = WEAPONS[shopWeaponId]!;
      room.shopOffers = [
        {
          id: 'offer_potion',
          kind: 'health_potion',
          nameVi: 'Bình Máu Rừng Cổ (+3 HP)',
          descriptionVi: 'Hồi phục ngay 3 HP cho người chơi.',
          costGold: Math.round(30 * floorScale),
          purchased: false,
        },
        {
          id: `offer_weapon_${shopWeaponId}`,
          kind: 'weapon',
          nameVi: wDef.nameVi,
          descriptionVi: `Vũ khí ${wDef.rarity.toUpperCase()} · DMG ${wDef.damage}`,
          costGold: Math.round((shopRarity === 'epic' ? 85 : 55) * floorScale),
          weaponId: shopWeaponId,
          rarity: shopRarity,
          purchased: false,
        },
        {
          id: 'offer_armor',
          kind: 'armor_upgrade',
          nameVi: 'Giáp Cổ Ngữ (+2 Giáp)',
          descriptionVi: 'Tăng +2 Giáp tối đa và hồi đầy Giáp.',
          costGold: Math.round(65 * floorScale),
          purchased: false,
        },
      ];
    } else if (room.type === 'shrine') {
      room.waves = [];
      room.wavesTotal = 0;
      const buffKeys = Object.keys(FLOOR_BUFFS);
      room.shrineBlessingId = rng.pick(buffKeys);
    } else if (room.type === 'combat') {
      if (room.isChallenge) {
        room.nameVi = 'Phòng Thử Thách';
        room.waves = generateRoomWaves(
          challengeRng,
          3,
          localFloor,
          4,
          true,
          playerCount,
          biome,
          true,
        );
        room.wavesTotal = room.waves.length;
        room.chestRarity = localFloor === 2 ? 'legendary' : 'epic';
        room.chestWeaponId = rollWeaponForRarity(challengeRng, room.chestRarity, biome);
      } else {
        combatRoomIndex += 1;
        const waveCount = localFloor === 1 && combatRoomIndex === 1 ? 2 : 3;
        room.waves = generateRoomWaves(
          rng,
          waveCount,
          localFloor,
          combatRoomIndex,
          false,
          playerCount,
          biome,
          false,
        );
        room.wavesTotal = room.waves.length;
      }
    } else if (room.type === 'portal') {
      // Floor 1 Portal Guardian Room: 2 waves (with guaranteed Elite guardian on Wave 2), then portal unlocks!
      room.cleared = false;
      room.waves = generateRoomWaves(rng, 2, localFloor, 3, true, playerCount, biome, false);
      room.wavesTotal = room.waves.length;
    } else if (room.type === 'boss') {
      // Floor 2 Boss Room: Biome Boss + Legendary reward chest on clear
      room.cleared = false;
      room.chestRarity = 'legendary';
      room.chestWeaponId =
        biome === 2 ? 'thunder_hammer' : biome === 3 ? 'magma_cannon' : 'solar_archon_staff';
      room.waves = [
        {
          waveIndex: 1,
          enemies: [
            {
              defId: BIOME_BOSS_IDS[biome],
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
    floorNumber: localFloor,
    globalFloorNumber: (biome - 1) * 2 + localFloor,
    playerCount,
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
  playerCount: 1 | 2 | 3 | 4 = 1,
  biome: 1 | 2 | 3 = 1,
  guaranteeEliteEveryWave = false,
): DungeonWaveDef[] {
  const waves: DungeonWaveDef[] = [];
  const tier = COOP_SCALING[playerCount] ?? COOP_SCALING[1];
  const enemyPool: readonly string[] =
    biome === 2
      ? BIOME2_COMBAT_ENEMIES
      : biome === 3
        ? BIOME3_COMBAT_ENEMIES
        : BIOME1_COMBAT_ENEMIES;

  for (let w = 1; w <= waveCount; w++) {
    const baseEnemyCount = Math.max(
      4,
      Math.round(Math.min(11, 7 + Math.floor((w + floorNumber) * 0.8)) * 0.5),
    );
    const enemyCount =
      playerCount === 1
        ? baseEnemyCount
        : Math.max(baseEnemyCount, Math.round(baseEnemyCount * tier.waveCountMultiplier));
    const enemies: DungeonEnemySpawnDef[] = [];

    for (let i = 0; i < enemyCount; i++) {
      // Ensure all biome enemy types appear across waves
      const poolIdx = (roomDifficultyIndex * 2 + w + i) % enemyPool.length;
      const defId = i === 0 ? enemyPool[poolIdx]! : rng.pick(enemyPool);

      const isFinalWaveFirstEnemy = w === waveCount && i === 0;
      const eliteChance = tier.eliteChance + (floorNumber === 2 ? 0.05 : 0);
      const isElite =
        defId !== 'thorn_turret' &&
        ((guaranteeEliteEveryWave && i === 0) ||
          (guaranteeEliteOnFinalWave && isFinalWaveFirstEnemy) ||
          (isFinalWaveFirstEnemy && roomDifficultyIndex >= 2) ||
          rng.chance(eliteChance));

      enemies.push({
        defId,
        isElite,
        eliteModifier: isElite ? rng.pick(ELITE_MODIFIERS) : null,
      });
    }

    if (guaranteeEliteEveryWave && !enemies.some((e) => e.isElite) && enemies.length > 0) {
      const nonTurret = enemies.find((e) => e.defId !== 'thorn_turret') ?? enemies[0]!;
      nonTurret.isElite = true;
      nonTurret.eliteModifier = rng.pick(ELITE_MODIFIERS);
    }

    // On deeper floors (floor 2 or Biome 2-3), final wave of Elite/Challenge or Portal room spawns 2 Elites + 2 escort enemies
    if (
      (floorNumber >= 2 || biome >= 2) &&
      (guaranteeEliteOnFinalWave || guaranteeEliteEveryWave) &&
      w === waveCount
    ) {
      let currentElites = enemies.filter((e) => e.isElite).length;
      for (let i = 0; i < enemies.length && currentElites < 2; i++) {
        const cand = enemies[i]!;
        if (!cand.isElite && cand.defId !== 'thorn_turret') {
          cand.isElite = true;
          cand.eliteModifier = rng.pick(ELITE_MODIFIERS);
          currentElites += 1;
        }
      }
      for (let esc = 0; esc < 1; esc++) {
        enemies.push({
          defId: enemyPool[(roomDifficultyIndex + w + esc) % enemyPool.length]!,
          isElite: false,
          eliteModifier: null,
        });
      }
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
