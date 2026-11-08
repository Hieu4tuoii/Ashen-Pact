import { SeededRandom } from '../core/prng.js';
import type { CardinalDir } from '../data/types.js';
import { TILE_SIZE } from '../protocol/messages.js';
import type { ArenaMap, SurfaceKind } from './arena-map.js';
import {
  buildCrossfireConveyorsGeometry,
  buildCrumblingPillarRingGeometry,
  buildPrismLabyrinthGeometry,
  clearCollapsedPillarFootprintOnMap,
  CONVEYOR_BELT_SPEED,
  CRUMBLING_RING_PILLAR_RECTS,
  getConveyorVelocityAtWorld,
  getCrumblingRingPillarRectsForMap,
} from './arena-room-archetypes-p1c.js';
import type { DungeonRoomNode } from './dungeon-gen.js';
import type { PropKind, SimPropState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export {
  clearCollapsedPillarFootprintOnMap,
  CONVEYOR_BELT_SPEED,
  CRUMBLING_RING_PILLAR_RECTS,
  getConveyorVelocityAtWorld,
  getCrumblingRingPillarRectsForMap,
};

export type RoomSizePreset =
  | 'compact'
  | 'standard'
  | 'wide_hall'
  | 'tall_sanctum'
  | 'grand_arena'
  | 'colossal_boss';

export const ROOM_SIZE_PRESET_DIMS: Record<
  RoomSizePreset,
  { readonly cols: number; readonly rows: number }
> = {
  compact: { cols: 28, rows: 18 },
  standard: { cols: 36, rows: 22 },
  wide_hall: { cols: 46, rows: 20 },
  tall_sanctum: { cols: 32, rows: 28 },
  grand_arena: { cols: 44, rows: 26 },
  colossal_boss: { cols: 48, rows: 28 },
} as const;

export const ROOM_SIZE_PRESETS = ROOM_SIZE_PRESET_DIMS;

export const ALL_ROOM_SIZE_PRESETS: readonly RoomSizePreset[] = [
  'compact',
  'standard',
  'wide_hall',
  'tall_sanctum',
  'grand_arena',
  'colossal_boss',
] as const;

export type RoomShapeKind =
  | 'rectangle'
  | 'octagon'
  | 'cruciform'
  | 'hourglass'
  | 'l_shape'
  | 't_shape'
  | 'u_shape'
  | 'donut_ring'
  | 'multi_chamber'
  | 'island_catwalk';
export type RoomInteriorShape = RoomShapeKind;

export const ALL_ROOM_SHAPES: readonly RoomShapeKind[] = [
  'rectangle',
  'octagon',
  'cruciform',
  'hourglass',
  'l_shape',
  't_shape',
  'u_shape',
  'donut_ring',
  'multi_chamber',
  'island_catwalk',
] as const;

export const ALL_ROOM_INTERIOR_SHAPES = ALL_ROOM_SHAPES;

export function isActiveWallTile(
  map: Pick<ArenaMap, 'cols' | 'rows' | 'getTile' | 'isSolidTile'>,
  tx: number,
  ty: number,
): boolean {
  const kind = map.getTile(tx, ty);
  if (kind !== 'wall' && kind !== 'cracked_wall') return false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx >= 0 && ny >= 0 && nx < map.cols && ny < map.rows) {
        if (!map.isSolidTile(nx, ny)) return true;
      }
    }
  }
  return false;
}

export function isExteriorVoidWallTile(
  map: Pick<ArenaMap, 'cols' | 'rows' | 'getTile' | 'isSolidTile'>,
  tx: number,
  ty: number,
): boolean {
  return map.getTile(tx, ty) === 'wall' && !isActiveWallTile(map, tx, ty);
}

export type RoomArchetypeId =
  | 'TWIN_BRIDGES'
  | 'GAUNTLET_CHOKEPOINT'
  | 'CENTRAL_BASTION'
  | 'CROSSFIRE_CONVEYORS'
  | 'PRISM_LABYRINTH'
  | 'CRUMBLING_PILLAR_RING';

export const PHASE0B_ROOM_ARCHETYPES: readonly RoomArchetypeId[] = [
  'GAUNTLET_CHOKEPOINT',
  'TWIN_BRIDGES',
  'CENTRAL_BASTION',
] as const;

export const P0B_COMBAT_ARCHETYPES = PHASE0B_ROOM_ARCHETYPES;

export const ALL_ROOM_ARCHETYPES: readonly RoomArchetypeId[] = [
  'TWIN_BRIDGES',
  'GAUNTLET_CHOKEPOINT',
  'CENTRAL_BASTION',
  'CROSSFIRE_CONVEYORS',
  'PRISM_LABYRINTH',
  'CRUMBLING_PILLAR_RING',
] as const;

export const DOOR_TILES: Record<CardinalDir, { readonly tx: number; readonly ty: number }> = {
  N: { tx: 18, ty: 1 },
  S: { tx: 18, ty: 20 },
  W: { tx: 1, ty: 11 },
  E: { tx: 34, ty: 11 },
};

export const DOOR_VESTIBULE_RECTS: Record<
  CardinalDir,
  { readonly minTx: number; readonly maxTx: number; readonly minTy: number; readonly maxTy: number }
> = {
  N: { minTx: 17, maxTx: 19, minTy: 1, maxTy: 3 },
  S: { minTx: 17, maxTx: 19, minTy: 18, maxTy: 20 },
  W: { minTx: 1, maxTx: 3, minTy: 10, maxTy: 12 },
  E: { minTx: 32, maxTx: 34, minTy: 10, maxTy: 12 },
};

export function getDoorTilesForMap(
  map: Pick<ArenaMap, 'cols' | 'rows'>,
): Record<CardinalDir, { readonly tx: number; readonly ty: number }> {
  const midX = Math.floor(map.cols / 2);
  const midY = Math.floor(map.rows / 2);
  return {
    N: { tx: midX, ty: 1 },
    S: { tx: midX, ty: map.rows - 2 },
    W: { tx: 1, ty: midY },
    E: { tx: map.cols - 2, ty: midY },
  };
}

export function getDoorVestibuleRectsForMap(
  map: Pick<ArenaMap, 'cols' | 'rows'>,
): Record<
  CardinalDir,
  { readonly minTx: number; readonly maxTx: number; readonly minTy: number; readonly maxTy: number }
> {
  const midX = Math.floor(map.cols / 2);
  const midY = Math.floor(map.rows / 2);
  return {
    N: { minTx: midX - 1, maxTx: midX + 1, minTy: 1, maxTy: 3 },
    S: { minTx: midX - 1, maxTx: midX + 1, minTy: map.rows - 4, maxTy: map.rows - 2 },
    W: { minTx: 1, maxTx: 3, minTy: midY - 1, maxTy: midY + 1 },
    E: { minTx: map.cols - 4, maxTx: map.cols - 2, minTy: midY - 1, maxTy: midY + 1 },
  };
}

export type RoomPropAnchorRole = 'barricade' | 'hazard' | 'pillar_toy' | 'accent' | 'mechanism';

export interface RoomPropAnchor {
  id: string;
  slotIndex: number;
  role: RoomPropAnchorRole;
  propKind: PropKind;
  baseTx: number;
  baseTy: number;
  tx: number;
  ty: number;
  jitterDx: number;
  jitterDy: number;
  x: number;
  y: number;
}

export interface RoomLayoutOptions {
  roomSeed: number;
  archetype: RoomArchetypeId;
  biome?: 1 | 2 | 3;
  activeDoorSides?: readonly CardinalDir[];
  secretWallBroken?: boolean;
  roomShape?: RoomShapeKind;
  roomSizePreset?: RoomSizePreset;
  cols?: number;
  rows?: number;
}

export interface RoomLayoutResult {
  archetype: RoomArchetypeId;
  roomSeed: number;
  biome: 1 | 2 | 3;
  flipX: boolean;
  flipY: boolean;
  activeDoorSides: readonly CardinalDir[];
  bridgeRows: readonly [number, number][];
  propAnchors: RoomPropAnchor[];
  roomShape: RoomShapeKind;
}

interface BaseAnchorSpec {
  id: string;
  role: RoomPropAnchorRole;
  propKind: PropKind;
  tx: number;
  ty: number;
  exactX?: number;
  exactY?: number;
  noJitter?: boolean;
}

const DEFAULT_DOORS: readonly CardinalDir[] = ['N', 'S', 'E', 'W'] as const;
const CARDINAL_DIRS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const JITTER_OFFSETS: readonly [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [2, 0], [-2, 0], [0, 2], [0, -2],
  [0, 0],
];

const MAX_BFS_TILES = 64 * 64;
const bfsVisitedScratch = new Uint8Array(MAX_BFS_TILES);
const bfsVisitStampScratch = new Int32Array(MAX_BFS_TILES);
let nextBfsVisitStamp = 1;
const bfsQueueXScratch = new Int16Array(MAX_BFS_TILES);
const bfsQueueYScratch = new Int16Array(MAX_BFS_TILES);
const bfsParentScratch = new Int16Array(MAX_BFS_TILES);
const bfsPropBlockedStampScratch = new Int32Array(MAX_BFS_TILES);

export function selectBiome1RoomArchetype(roomSeed: number, roomIndex = 0): RoomArchetypeId {
  const normalized = Math.abs(Math.trunc(roomSeed) + Math.trunc(roomIndex));
  return PHASE0B_ROOM_ARCHETYPES[normalized % PHASE0B_ROOM_ARCHETYPES.length]!;
}

export const selectCombatRoomArchetype = selectBiome1RoomArchetype;

export function isInDoorVestibule(
  tx: number,
  ty: number,
  map?: Pick<ArenaMap, 'cols' | 'rows'>,
): boolean {
  const rects = map ? getDoorVestibuleRectsForMap(map) : DOOR_VESTIBULE_RECTS;
  for (const dir of DEFAULT_DOORS) {
    const r = rects[dir];
    if (tx >= r.minTx && tx <= r.maxTx && ty >= r.minTy && ty <= r.maxTy) return true;
  }
  return false;
}

export const isInDoorClearanceZone = isInDoorVestibule;

export function isWalkableTileForBfs(map: ArenaMap, tx: number, ty: number): boolean {
  if (tx <= 0 || ty <= 0 || tx >= map.cols - 1 || ty >= map.rows - 1) return false;
  const idx = ty * map.cols + tx;
  return map.tiles[idx] === 'floor' && map.surfaces[idx] !== 'chasm';
}

export function areActiveDoorsConnectedBfs(
  map: ArenaMap,
  activeDoorSides: readonly CardinalDir[] = DEFAULT_DOORS,
): boolean {
  const doors = activeDoorSides.length > 0 ? activeDoorSides : DEFAULT_DOORS;
  const doorTiles = getDoorTilesForMap(map);
  for (let i = 0; i < doors.length; i++) {
    const d = doorTiles[doors[i]!];
    if (!isWalkableTileForBfs(map, d.tx, d.ty)) return false;
  }
  if (doors.length <= 1) return true;

  const total = map.cols * map.rows;
  const visited = total <= bfsVisitedScratch.length ? bfsVisitedScratch : new Uint8Array(total);
  const qx = total <= bfsQueueXScratch.length ? bfsQueueXScratch : new Int16Array(total);
  const qy = total <= bfsQueueYScratch.length ? bfsQueueYScratch : new Int16Array(total);
  visited.fill(0, 0, total);

  const start = doorTiles[doors[0]!];
  let head = 0;
  let tail = 1;
  visited[start.ty * map.cols + start.tx] = 1;
  qx[0] = start.tx;
  qy[0] = start.ty;

  while (head < tail) {
    const cx = qx[head]!;
    const cy = qy[head]!;
    head += 1;
    for (let k = 0; k < 4; k++) {
      const nx = cx + CARDINAL_DIRS[k]![0];
      const ny = cy + CARDINAL_DIRS[k]![1];
      if (!isWalkableTileForBfs(map, nx, ny)) continue;
      const nIdx = ny * map.cols + nx;
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;
      qx[tail] = nx;
      qy[tail] = ny;
      tail += 1;
    }
  }

  for (let i = 1; i < doors.length; i++) {
    const d = doorTiles[doors[i]!];
    if (!visited[d.ty * map.cols + d.tx]) return false;
  }
  return true;
}

export type NavBlockingPropLike = Pick<
  SimPropState,
  'x' | 'y' | 'radius' | 'hp' | 'blocksMovement' | 'coverState'
>;

export function isPointBlockedByStationaryProp(
  worldX: number,
  worldY: number,
  radius: number,
  props?: readonly NavBlockingPropLike[],
): boolean {
  if (!props || props.length === 0) return false;
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]!;
    if (prop.hp <= 0 || !prop.blocksMovement || prop.coverState === 'fallen') continue;
    const dx = worldX - prop.x;
    const dy = worldY - prop.y;
    const minD = radius + prop.radius + 2;
    if (dx * dx + dy * dy < minD * minD) return true;
  }
  return false;
}

function isWalkableTileWithChasmFlag(
  map: ArenaMap,
  tx: number,
  ty: number,
  ignoreChasm: boolean,
): boolean {
  if (tx <= 0 || ty <= 0 || tx >= map.cols - 1 || ty >= map.rows - 1) return false;
  const idx = ty * map.cols + tx;
  return map.tiles[idx] === 'floor' && (ignoreChasm || map.surfaces[idx] !== 'chasm');
}

function has8NeighborWalkableClearance(
  map: ArenaMap,
  tx: number,
  ty: number,
  ignoreChasm: boolean,
): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!isWalkableTileWithChasmFlag(map, tx + dx, ty + dy, ignoreChasm)) {
        return false;
      }
    }
  }
  return true;
}

export function hasClearWalkableCorridor(
  map: ArenaMap,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  radius = 14,
  props?: readonly NavBlockingPropLike[],
  ignoreChasm = false,
): boolean {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  if (dist <= 4) return true;
  const steps = Math.max(1, Math.ceil(dist / (TILE_SIZE * 0.5)));
  const hitRadius = Math.min(radius, 14);
  const endGraceDist = radius + 16;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const px = fromX + dx * t;
    const py = fromY + dy * t;
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (!isWalkableTileWithChasmFlag(map, tx, ty, ignoreChasm)) return false;
    const distFromEnd = dist * (1 - t);
    if (distFromEnd >= endGraceDist) {
      if (map.checkProjectileWallHit(px, py, hitRadius).hit) return false;
      if (isPointBlockedByStationaryProp(px, py, radius, props)) return false;
    }
  }
  return true;
}

export function findNearestWalkablePoint(
  map: ArenaMap,
  worldX: number,
  worldY: number,
  radius = 14,
  props?: readonly NavBlockingPropLike[],
  ignoreChasm = false,
): { x: number; y: number } {
  const sTx = Math.max(1, Math.min(map.cols - 2, Math.floor(worldX / TILE_SIZE)));
  const sTy = Math.max(1, Math.min(map.rows - 2, Math.floor(worldY / TILE_SIZE)));
  if (!props && !ignoreChasm && radius <= 16) {
    if (
      isWalkableTileForBfs(map, sTx, sTy) &&
      !map.checkProjectileWallHit(worldX, worldY, radius).hit
    ) {
      return { x: worldX, y: worldY };
    }
    const maxRingDefault = Math.max(map.cols, map.rows);
    for (let ring = 1; ring <= maxRingDefault; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const tx = sTx + dx;
          const ty = sTy + dy;
          if (!isWalkableTileForBfs(map, tx, ty)) continue;
          const cx = tx * TILE_SIZE + TILE_SIZE * 0.5;
          const cy = ty * TILE_SIZE + TILE_SIZE * 0.5;
          if (!map.checkProjectileWallHit(cx, cy, radius).hit) return { x: cx, y: cy };
        }
      }
    }
    const clampedDefault = Math.min(radius, TILE_SIZE * 0.5 - 1);
    for (let ring = 0; ring <= maxRingDefault; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const tx = sTx + dx;
          const ty = sTy + dy;
          if (!isWalkableTileForBfs(map, tx, ty)) continue;
          const cx = tx * TILE_SIZE + TILE_SIZE * 0.5;
          const cy = ty * TILE_SIZE + TILE_SIZE * 0.5;
          if (!map.checkProjectileWallHit(cx, cy, clampedDefault).hit) return { x: cx, y: cy };
        }
      }
    }
    const doors = getDoorTilesForMap(map);
    return { x: doors.W.tx * TILE_SIZE + 16, y: doors.W.ty * TILE_SIZE + 16 };
  }

  const rawTx = Math.floor(worldX / TILE_SIZE);
  const rawTy = Math.floor(worldY / TILE_SIZE);
  const hitCheckRadius = Math.max(1, Math.min(radius, 14) - 0.5);
  if (
    isWalkableTileWithChasmFlag(map, rawTx, rawTy, ignoreChasm) &&
    !map.checkProjectileWallHit(worldX, worldY, radius).hit &&
    !map.resolveCircleCollision(worldX, worldY, radius, ignoreChasm).collided &&
    !isPointBlockedByStationaryProp(worldX, worldY, radius, props)
  ) {
    return { x: worldX, y: worldY };
  }
  const maxRing = Math.max(map.cols, map.rows);

  // Pass 1: Full 8-neighbor clearance for large units (radius > 16) + uncollided circle + prop clearance
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const tx = sTx + dx;
        const ty = sTy + dy;
        if (!isWalkableTileWithChasmFlag(map, tx, ty, ignoreChasm)) continue;
        if (radius > 16 && !has8NeighborWalkableClearance(map, tx, ty, ignoreChasm)) continue;
        const cx = tx * TILE_SIZE + TILE_SIZE * 0.5;
        const cy = ty * TILE_SIZE + TILE_SIZE * 0.5;
        if (
          !map.checkProjectileWallHit(cx, cy, hitCheckRadius).hit &&
          !map.resolveCircleCollision(cx, cy, radius, ignoreChasm).collided &&
          !isPointBlockedByStationaryProp(cx, cy, radius, props)
        ) {
          return { x: cx, y: cy };
        }
      }
    }
  }

  // Pass 2: Resolved circle collision on verified walkable tile + prop clearance
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const tx = sTx + dx;
        const ty = sTy + dy;
        if (!isWalkableTileWithChasmFlag(map, tx, ty, ignoreChasm)) continue;
        const cx = tx * TILE_SIZE + TILE_SIZE * 0.5;
        const cy = ty * TILE_SIZE + TILE_SIZE * 0.5;
        const col = map.resolveCircleCollision(cx, cy, radius, ignoreChasm);
        const colTx = Math.floor(col.x / TILE_SIZE);
        const colTy = Math.floor(col.y / TILE_SIZE);
        if (
          isWalkableTileWithChasmFlag(map, colTx, colTy, ignoreChasm) &&
          !map.checkProjectileWallHit(col.x, col.y, hitCheckRadius).hit &&
          !isPointBlockedByStationaryProp(col.x, col.y, radius, props)
        ) {
          return { x: col.x, y: col.y };
        }
      }
    }
  }

  // Pass 3: Fallback ignoring props
  const clampedRadius = Math.min(radius, TILE_SIZE * 0.5 - 1);
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const tx = sTx + dx;
        const ty = sTy + dy;
        if (!isWalkableTileWithChasmFlag(map, tx, ty, ignoreChasm)) continue;
        const cx = tx * TILE_SIZE + TILE_SIZE * 0.5;
        const cy = ty * TILE_SIZE + TILE_SIZE * 0.5;
        const col = map.resolveCircleCollision(cx, cy, radius, ignoreChasm);
        const colTx = Math.floor(col.x / TILE_SIZE);
        const colTy = Math.floor(col.y / TILE_SIZE);
        if (
          isWalkableTileWithChasmFlag(map, colTx, colTy, ignoreChasm) &&
          !map.checkProjectileWallHit(col.x, col.y, clampedRadius).hit
        ) {
          return { x: col.x, y: col.y };
        }
        if (!map.checkProjectileWallHit(cx, cy, clampedRadius).hit) {
          return { x: cx, y: cy };
        }
      }
    }
  }
  const doors = getDoorTilesForMap(map);
  return { x: doors.W.tx * TILE_SIZE + 16, y: doors.W.ty * TILE_SIZE + 16 };
}

export function findNextWalkableWaypoint(
  map: ArenaMap,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  props?: readonly NavBlockingPropLike[],
  ignoreChasm = false,
  radius = 14,
): { x: number; y: number } {
  const cols = map.cols;
  const rows = map.rows;
  let targetX = toX;
  let targetY = toY;
  const sTx = Math.max(1, Math.min(cols - 2, Math.floor(fromX / TILE_SIZE)));
  const sTy = Math.max(1, Math.min(rows - 2, Math.floor(fromY / TILE_SIZE)));
  let gTx = Math.max(1, Math.min(cols - 2, Math.floor(targetX / TILE_SIZE)));
  let gTy = Math.max(1, Math.min(rows - 2, Math.floor(targetY / TILE_SIZE)));
  if (!isWalkableTileWithChasmFlag(map, gTx, gTy, ignoreChasm)) {
    const safeGoal = findNearestWalkablePoint(map, targetX, targetY, 4, props, ignoreChasm);
    targetX = safeGoal.x;
    targetY = safeGoal.y;
    gTx = Math.max(1, Math.min(cols - 2, Math.floor(targetX / TILE_SIZE)));
    gTy = Math.max(1, Math.min(rows - 2, Math.floor(targetY / TILE_SIZE)));
  }
  if (sTx === gTx && sTy === gTy) return { x: targetX, y: targetY };

  const startIdx = sTy * cols + sTx;
  const goalIdx = gTy * cols + gTx;
  const tiles = map.tiles;
  const surfaces = map.surfaces;

  const allocStamp = (): number => {
    let st = ++nextBfsVisitStamp;
    if (st >= 0x7ffffff0) {
      bfsVisitStampScratch.fill(0);
      bfsPropBlockedStampScratch.fill(0);
      nextBfsVisitStamp = 1;
      st = 1;
    }
    return st;
  };

  const stamp = allocStamp();
  let hasPropMask = false;
  if (props && props.length > 0) {
    const padExtra = Math.min(radius, 14);
    for (let i = 0; i < props.length; i++) {
      const prop = props[i]!;
      if (prop.hp <= 0 || !prop.blocksMovement || prop.coverState === 'fallen') continue;
      const pad = prop.radius + padExtra;
      const minTx = Math.max(1, Math.floor((prop.x - pad) / TILE_SIZE));
      const maxTx = Math.min(cols - 2, Math.floor((prop.x + pad) / TILE_SIZE));
      const minTy = Math.max(1, Math.floor((prop.y - pad) / TILE_SIZE));
      const maxTy = Math.min(rows - 2, Math.floor((prop.y + pad) / TILE_SIZE));
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          const idx = ty * cols + tx;
          if (idx === startIdx || idx === goalIdx) continue;
          const cx = tx * TILE_SIZE + TILE_SIZE * 0.5;
          const cy = ty * TILE_SIZE + TILE_SIZE * 0.5;
          const dx = cx - prop.x;
          const dy = cy - prop.y;
          if (dx * dx + dy * dy < pad * pad) {
            bfsPropBlockedStampScratch[idx] = stamp;
            hasPropMask = true;
          }
        }
      }
    }
  }

  const runBfs = (curStamp: number, usePropMask: boolean): boolean => {
    let head = 0;
    let tail = 1;
    bfsVisitStampScratch[startIdx] = curStamp;
    bfsParentScratch[startIdx] = -1;
    bfsQueueXScratch[0] = sTx;
    bfsQueueYScratch[0] = sTy;
    while (head < tail) {
      const cx = bfsQueueXScratch[head]!;
      const cy = bfsQueueYScratch[head]!;
      const cIdx = cy * cols + cx;
      head += 1;
      if (cIdx === goalIdx) return true;
      for (let k = 0; k < 4; k++) {
        const nx = cx + CARDINAL_DIRS[k]![0];
        const ny = cy + CARDINAL_DIRS[k]![1];
        if (nx <= 0 || ny <= 0 || nx >= cols - 1 || ny >= rows - 1) continue;
        const nIdx = ny * cols + nx;
        if (bfsVisitStampScratch[nIdx] === curStamp) continue;
        if (usePropMask && bfsPropBlockedStampScratch[nIdx] === stamp) continue;
        const walkable =
          tiles[nIdx] === 'floor' && (ignoreChasm || surfaces[nIdx] !== 'chasm');
        if (!walkable && nIdx !== goalIdx) continue;
        bfsVisitStampScratch[nIdx] = curStamp;
        bfsParentScratch[nIdx] = cIdx;
        bfsQueueXScratch[tail] = nx;
        bfsQueueYScratch[tail] = ny;
        tail += 1;
      }
    }
    return false;
  };

  let usedPropMask = hasPropMask;
  let found = runBfs(stamp, hasPropMask);
  if (!found && hasPropMask) {
    const fallbackStamp = allocStamp();
    usedPropMask = false;
    found = runBfs(fallbackStamp, false);
  }
  if (!found) return { x: targetX, y: targetY };

  let firstStep = goalIdx;
  let secondStep = goalIdx;
  for (
    let s = 0;
    s < 128 && bfsParentScratch[firstStep] !== -1 && bfsParentScratch[firstStep] !== startIdx;
    s++
  ) {
    secondStep = firstStep;
    firstStep = bfsParentScratch[firstStep]!;
  }

  let chosenIdx = firstStep;
  if (secondStep !== firstStep) {
    const tx2 = secondStep % cols;
    const ty2 = Math.floor(secondStep / cols);
    const isCollinear = tx2 === sTx || ty2 === sTy;
    const corner1Idx = ty2 * cols + sTx;
    const corner2Idx = sTy * cols + tx2;
    const cornersClear =
      isWalkableTileWithChasmFlag(map, sTx, ty2, ignoreChasm) &&
      isWalkableTileWithChasmFlag(map, tx2, sTy, ignoreChasm) &&
      (!usedPropMask ||
        (bfsPropBlockedStampScratch[corner1Idx] !== stamp &&
          bfsPropBlockedStampScratch[corner2Idx] !== stamp));
    if (isCollinear || cornersClear) {
      chosenIdx = secondStep;
    }
  }

  return {
    x: (chosenIdx % cols) * TILE_SIZE + TILE_SIZE * 0.5,
    y: Math.floor(chosenIdx / cols) * TILE_SIZE + TILE_SIZE * 0.5,
  };
}

function isInCrumblingRingPillarFootprint(
  map: Pick<ArenaMap, 'cols' | 'rows' | 'roomArchetype'>,
  tx: number,
  ty: number,
): boolean {
  if (map.roomArchetype !== 'CRUMBLING_PILLAR_RING') return false;
  const rects = getCrumblingRingPillarRectsForMap(map);
  for (const [px, py] of rects) {
    if (tx >= px && tx <= px + 1 && ty >= py && ty <= py + 1) return true;
  }
  return false;
}

/**
 * Carves deep, viewport-visible Enter-the-Gungeon style room geometry across all 10 RoomShapeKinds
 * ('rectangle', 'octagon', 'cruciform', 'hourglass', 'l_shape', 't_shape', 'u_shape',
 *  'donut_ring', 'multi_chamber', 'island_catwalk') while preserving all 4 cardinal door vestibules
 * and 100% BFS connectivity across all 6 combat archetypes.
 */
export function applyRoomInteriorShape(map: ArenaMap, shape: RoomInteriorShape = 'rectangle'): void {
  if (shape === 'rectangle') return;
  const cols = map.cols;
  const rows = map.rows;
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);
  const [[topStart, topEnd], [botStart, botEnd]] = computeTwinBridgesRows(rows);

  const carveWall = (tx: number, ty: number): void => {
    if (tx <= 0 || ty <= 0 || tx >= cols - 1 || ty >= rows - 1) return;
    if (isInDoorVestibule(tx, ty, map)) return;
    if (isInCrumblingRingPillarFootprint(map, tx, ty)) return;
    const idx = ty * cols + tx;
    map.tiles[idx] = 'wall';
    map.surfaces[idx] = 'none';
    map.baseSurfaces[idx] = 'none';
    map.surfaceTimers[idx] = 0;
  };

  if (shape === 'octagon') {
    if (map.isBossRoom) {
      const chamfer = Math.min(4, Math.max(2, Math.floor(Math.min(cols, rows) / 6)));
      for (let ty = 1; ty < rows - 1; ty++) {
        for (let tx = 1; tx < cols - 1; tx++) {
          const dx = Math.min(tx - 1, cols - 2 - tx);
          const dy = Math.min(ty - 1, rows - 2 - ty);
          const inCorner =
            dx + dy < 2 || (chamfer >= 3 && (dx === 0 || dy === 0) && dx + dy < chamfer);
          if (inCorner) {
            carveWall(tx, ty);
          }
        }
      }
      return;
    }
    const chamfer = Math.min(7, Math.max(5, Math.floor(Math.min(cols, rows) * 0.28)));
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        const dx = Math.min(tx - 1, cols - 2 - tx);
        const dy = Math.min(ty - 1, rows - 2 - ty);
        if (dx + dy < chamfer) {
          carveWall(tx, ty);
        }
      }
    }
    return;
  }

  if (shape === 'cruciform') {
    const cornerW = Math.min(midX - 6, Math.max(6, Math.floor(cols * 0.24)));
    const cornerH = Math.min(midY - 3, Math.max(4, Math.floor(rows * 0.25)));
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        const inCornerX = tx <= cornerW || tx >= cols - 1 - cornerW;
        const inCornerY = ty <= cornerH || ty >= rows - 1 - cornerH;
        if (inCornerX && inCornerY) {
          carveWall(tx, ty);
        }
      }
    }
    return;
  }

  if (shape === 'hourglass') {
    const waistH = Math.min(midY - 5, Math.max(4, Math.floor(rows * 0.25)));
    const waistOuterX = Math.min(midX - 4, Math.max(7, Math.floor(cols * 0.28)));
    const cornerChamfer = Math.min(5, Math.max(3, Math.floor(Math.min(cols, rows) * 0.20)));
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        const dx = Math.min(tx - 1, cols - 2 - tx);
        const dy = Math.min(ty - 1, rows - 2 - ty);
        if (dx + dy < cornerChamfer) {
          carveWall(tx, ty);
          continue;
        }
        const distFromMidX = Math.abs(tx - midX);
        const onTwinBridgeApproach =
          map.roomArchetype === 'TWIN_BRIDGES' &&
          distFromMidX <= 5 &&
          ((ty >= topStart + 1 && ty <= topEnd) || (ty >= botStart && ty <= botEnd - 1));
        const inWaistY = ty <= waistH || ty >= rows - 1 - waistH;
        if (inWaistY && !onTwinBridgeApproach && distFromMidX >= 3 && distFromMidX <= waistOuterX) {
          carveWall(tx, ty);
        }
      }
    }
    return;
  }

  if (shape === 'l_shape') {
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        const inNeQuadrant = tx >= midX + 5 && ty <= midY - 3;
        const inSwBevel = tx <= 3 && ty >= rows - 4 && (tx - 1) + (rows - 2 - ty) < 2;
        if (inNeQuadrant || inSwBevel) {
          carveWall(tx, ty);
        }
      }
    }
    return;
  }

  if (shape === 't_shape') {
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        const inSwQuadrant = tx <= midX - 6 && ty >= midY + 3;
        const inSeQuadrant = tx >= midX + 5 && ty >= midY + 3;
        if (inSwQuadrant || inSeQuadrant) {
          carveWall(tx, ty);
        }
      }
    }
    return;
  }

  if (shape === 'u_shape') {
    const courtH = Math.min(midY - 5, Math.max(4, Math.floor(rows * 0.25)));
    const courtOuterX = Math.min(midX - 4, Math.max(9, Math.floor(cols * 0.32)));
    const southBevel = Math.min(5, Math.max(3, Math.floor(Math.min(cols, rows) * 0.20)));
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        const dx = Math.min(tx - 1, cols - 2 - tx);
        const dy = Math.min(ty - 1, rows - 2 - ty);
        if (ty > midY && dx + dy < southBevel) {
          carveWall(tx, ty);
          continue;
        }
        const distFromMidX = Math.abs(tx - midX);
        const onTwinBridgeApproach =
          map.roomArchetype === 'TWIN_BRIDGES' &&
          distFromMidX <= 5 &&
          ty >= topStart + 1 &&
          ty <= topEnd;
        if (ty <= courtH && !onTwinBridgeApproach && distFromMidX >= 3 && distFromMidX <= courtOuterX) {
          carveWall(tx, ty);
          continue;
        }
        const inCenterBaffle =
          map.roomArchetype !== 'TWIN_BRIDGES' &&
          map.roomArchetype !== 'CENTRAL_BASTION' &&
          map.roomArchetype !== 'PRISM_LABYRINTH' &&
          tx >= midX - 2 &&
          tx <= midX + 1 &&
          ty >= midY - 2 &&
          ty <= midY - 1;
        if (inCenterBaffle) {
          carveWall(tx, ty);
        }
      }
    }
    return;
  }

  if (shape === 'donut_ring') {
    const outerChamfer = Math.min(6, Math.max(4, Math.round(Math.min(cols, rows) * 0.23)));
    const coreHalfW =
      map.roomArchetype === 'TWIN_BRIDGES'
        ? 3
        : Math.min(4, Math.max(3, Math.floor(cols * 0.10)));
    const coreHalfH = Math.min(3, Math.max(2, Math.floor(rows * 0.12)));
    const minCoreY =
      map.roomArchetype === 'TWIN_BRIDGES'
        ? Math.max(topEnd + 1, midY - coreHalfH)
        : midY - coreHalfH;
    const maxCoreY =
      map.roomArchetype === 'TWIN_BRIDGES'
        ? Math.min(botStart - 1, midY + coreHalfH - 1)
        : midY + coreHalfH - 1;
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        const dx = Math.min(tx - 1, cols - 2 - tx);
        const dy = Math.min(ty - 1, rows - 2 - ty);
        if (dx + dy < outerChamfer) {
          carveWall(tx, ty);
          continue;
        }
        const inPrismCenter =
          map.roomArchetype === 'PRISM_LABYRINTH' &&
          tx >= midX - 1 &&
          tx <= midX &&
          ty >= midY - 2 &&
          ty <= midY + 1;
        if (
          !inPrismCenter &&
          tx >= midX - coreHalfW &&
          tx <= midX + coreHalfW - 1 &&
          ty >= minCoreY &&
          ty <= maxCoreY
        ) {
          carveWall(tx, ty);
        }
      }
    }
    return;
  }

  if (shape === 'multi_chamber') {
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        const inNeQuadrant = tx >= midX + 5 && ty <= midY - 3;
        const inSwQuadrant = tx <= midX - 6 && ty >= midY + 3;
        const inNorthPartition = tx >= midX - 7 && tx <= midX - 6 && ty <= 2;
        const inSouthPartition = tx >= midX + 5 && tx <= midX + 6 && ty >= rows - 3;
        if (inNeQuadrant || inSwQuadrant || inNorthPartition || inSouthPartition) {
          carveWall(tx, ty);
        }
      }
    }
    return;
  }

  if (shape === 'island_catwalk') {
    const chamfer = Math.min(6, Math.max(4, Math.round(Math.min(cols, rows) * 0.24)));
    const moatW = Math.max(2, Math.floor(cols * 0.09));
    const moatH = Math.max(2, Math.floor(rows * 0.10));
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        const dx = Math.min(tx - 1, cols - 2 - tx);
        const dy = Math.min(ty - 1, rows - 2 - ty);
        if (dx + dy < chamfer) {
          carveWall(tx, ty);
          continue;
        }
        if (isInDoorVestibule(tx, ty, map)) continue;
        const onVerticalCatwalk = Math.abs(tx - midX) <= 1;
        const onHorizontalCatwalk = Math.abs(ty - midY) <= 1;
        const onTwinBridge =
          map.roomArchetype === 'TWIN_BRIDGES' &&
          ((ty >= topStart && ty <= topEnd) || (ty >= botStart && ty <= botEnd));
        if (onVerticalCatwalk || onHorizontalCatwalk || onTwinBridge) continue;
        const inMoat = dx < moatW || dy < moatH || dx + dy < chamfer + 2;
        if (inMoat && !map.isSolidTile(tx, ty)) {
          const idx = ty * cols + tx;
          map.surfaces[idx] = 'chasm';
          map.baseSurfaces[idx] = 'chasm';
          map.surfaceTimers[idx] = 0;
        }
      }
    }
  }
}

function setPillarRect(map: ArenaMap, startTx: number, startTy: number, w: number, h: number): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tx = startTx + dx;
      const ty = startTy + dy;
      if (tx > 0 && tx < map.cols - 1 && ty > 0 && ty < map.rows - 1) {
        const idx = ty * map.cols + tx;
        if (map.tiles[idx] !== 'wall') {
          map.tiles[idx] = 'pillar';
          map.surfaces[idx] = 'none';
          map.baseSurfaces[idx] = 'none';
        }
      }
    }
  }
}

function getBiomeTacticalPropKinds(biome: 1 | 2 | 3): {
  barricade: PropKind;
  hazard: PropKind;
  pillarToy: PropKind;
} {
  if (biome === 2) {
    return { barricade: 'glacial_barricade', hazard: 'sliding_ice_block', pillarToy: 'cryo_prism_pillar' };
  }
  if (biome === 3) {
    return { barricade: 'forge_blast_shield', hazard: 'slag_crucible', pillarToy: 'pneumatic_press' };
  }
  return { barricade: 'moss_table', hazard: 'volatile_spore_pod', pillarToy: 'rotten_totem_pillar' };
}

export function computeTwinBridgesRows(
  rows: number,
): readonly [[number, number], [number, number]] {
  const midY = Math.floor(rows / 2);
  const topStart = Math.max(4, midY - 6);
  const topEnd = topStart + 2;
  const botEnd = rows - 1 - topStart;
  const botStart = botEnd - 2;
  return [
    [topStart, topEnd],
    [botStart, botEnd],
  ];
}

function buildTwinBridgesGeometry(map: ArenaMap, biome: 1 | 2 | 3, flipX: boolean, flipY: boolean): BaseAnchorSpec[] {
  const kinds = getBiomeTacticalPropKinds(biome);
  const cols = map.cols;
  const rows = map.rows;
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);
  const [[topBridgeStart, topBridgeEnd], [botBridgeStart, botBridgeEnd]] = computeTwinBridgesRows(rows);

  const pLeftX = Math.max(5, Math.round((8 * cols) / 36));
  const pRightX = cols - 2 - pLeftX;
  setPillarRect(map, pLeftX, 3, 2, 1);
  setPillarRect(map, pRightX, rows - 4, 2, 1);

  for (let ty = 1; ty <= rows - 2; ty++) {
    if ((ty >= topBridgeStart && ty <= topBridgeEnd) || (ty >= botBridgeStart && ty <= botBridgeEnd)) {
      continue;
    }
    const isMidSpan = ty > topBridgeEnd && ty < botBridgeStart;
    const chasmCols =
      ty <= topBridgeStart - 2 || ty >= botBridgeEnd + 2
        ? [midX - 4, midX - 3, midX + 3, midX + 4]
        : ty === topBridgeStart - 1 || ty === botBridgeEnd + 1
          ? [midX - 4, midX - 3, midX - 2, midX + 2, midX + 3, midX + 4]
          : [midX - 3, midX - 2, midX - 1, midX, midX + 1, midX + 2];
    for (const tx of chasmCols) {
      if (tx > 0 && tx < cols - 1) {
        if (map.roomShape === 'donut_ring' && isMidSpan && map.getTile(tx, ty) === 'wall') {
          continue;
        }
        if (map.getTile(tx, ty) === 'wall') {
          map.tiles[ty * cols + tx] = 'floor';
        }
        map.setSurface(tx, ty, 'chasm', 0, true);
      }
    }
  }

  const westTopSurf: SurfaceKind = biome === 2 ? 'ice' : biome === 3 ? 'conveyor' : 'grass';
  const eastTopSurf: SurfaceKind = biome === 2 ? 'water' : biome === 3 ? 'lava' : 'water';
  const westBotSurf: SurfaceKind = biome === 2 ? 'water' : biome === 3 ? 'oil' : 'poison_swamp';
  const eastBotSurf: SurfaceKind = biome === 2 ? 'ice' : biome === 3 ? 'conveyor' : 'grass';
  const surfTopY = topBridgeStart - 1;
  const surfBotY = botBridgeEnd - 1;
  const topY = flipY ? surfBotY : surfTopY;
  const botY = flipY ? surfTopY : surfBotY;
  const surfLeftX = 4;
  const surfRightX = cols - 8;
  map.fillSurfaceRect(flipX ? surfRightX : surfLeftX, topY, 4, 2, westTopSurf);
  map.fillSurfaceRect(flipX ? surfLeftX : surfRightX, topY, 4, 2, eastTopSurf);
  map.fillSurfaceRect(flipX ? surfRightX : surfLeftX, botY, 4, 2, westBotSurf);
  map.fillSurfaceRect(flipX ? surfLeftX : surfRightX, botY, 4, 2, eastBotSurf);

  const innerWestX = midX - 7;
  const innerEastX = cols - 1 - innerWestX;
  const outerWestX = Math.max(4, Math.round((6 * cols) / 36));
  const outerEastX = cols - 1 - outerWestX;
  const topBridgeMidY = topBridgeStart + 1;
  const botBridgeMidY = botBridgeStart + 1;

  return [
    { id: 'tb_barricade_w_n', role: 'barricade', propKind: kinds.barricade, tx: innerWestX, ty: topBridgeMidY },
    { id: 'tb_barricade_e_s', role: 'barricade', propKind: kinds.barricade, tx: innerEastX, ty: botBridgeMidY },
    { id: 'tb_hazard_w', role: 'hazard', propKind: kinds.hazard, tx: innerWestX, ty: botBridgeStart },
    { id: 'tb_hazard_e', role: 'hazard', propKind: kinds.hazard, tx: innerEastX, ty: topBridgeEnd },
    { id: 'tb_pillar_w', role: 'pillar_toy', propKind: kinds.pillarToy, tx: outerWestX, ty: midY - 1 },
    { id: 'tb_pillar_e', role: 'pillar_toy', propKind: kinds.pillarToy, tx: outerEastX, ty: midY },
    { id: 'tb_accent_nw', role: 'accent', propKind: 'glow_mushroom', tx: outerWestX, ty: topBridgeStart },
    { id: 'tb_accent_se', role: 'accent', propKind: 'glow_mushroom', tx: outerEastX, ty: botBridgeEnd },
    { id: 'tb_mech', role: 'mechanism', propKind: 'ancient_mechanism', tx: innerWestX - 1, ty: midY },
  ];
}

function buildGauntletChokepointGeometry(map: ArenaMap, biome: 1 | 2 | 3, flipX: boolean, flipY: boolean): BaseAnchorSpec[] {
  const kinds = getBiomeTacticalPropKinds(biome);
  const cols = map.cols;
  const rows = map.rows;
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);

  const leftL = Math.max(7, Math.round((9 * cols) / 36));
  const rightL = cols - 3 - leftL;
  const topL = rows >= 20 ? Math.max(4, Math.round((4 * rows) / 22)) : 3;
  const botL = rows - 3 - topL;

  setPillarRect(map, leftL, topL, 3, 3);
  setPillarRect(map, leftL - 1, topL + 1, 1, 2);
  setPillarRect(map, rightL, topL, 3, 3);
  setPillarRect(map, rightL + 3, topL + 1, 1, 2);

  setPillarRect(map, leftL, botL, 3, 3);
  setPillarRect(map, leftL - 1, botL, 1, 2);
  setPillarRect(map, rightL, botL, 3, 3);
  setPillarRect(map, rightL + 3, botL, 1, 2);

  const innerLeftX = midX - 5;
  const innerRightX = cols - 2 - innerLeftX;
  const innerTopY = midY - 4;
  const innerBotY = rows - 1 - innerTopY;
  setPillarRect(map, flipX ? innerRightX : innerLeftX, flipY ? innerBotY : innerTopY, 2, 1);
  setPillarRect(map, flipX ? innerLeftX : innerRightX, flipY ? innerTopY : innerBotY, 2, 1);

  const topSurfY = Math.max(2, topL - 1);
  const botSurfY = Math.min(rows - 4, botL + 2);
  if (biome === 2) {
    map.fillSurfaceRect(midX - 4, topSurfY, 4, 2, 'ice');
    map.fillSurfaceRect(midX + 1, topSurfY, 4, 2, 'water');
    map.fillSurfaceRect(midX - 4, botSurfY, 4, 2, 'ice');
    map.fillSurfaceRect(2, 2, 2, 1, 'chasm');
  } else if (biome === 3) {
    map.fillSurfaceRect(midX - 5, topSurfY, 10, 2, 'conveyor');
    map.fillSurfaceRect(midX - 5, botSurfY, 10, 2, 'conveyor');
    map.fillSurfaceRect(4, midY - 4, 3, 3, 'lava');
    map.fillSurfaceRect(cols - 7, midY + 1, 3, 3, 'oil');
  } else {
    map.fillSurfaceRect(midX - 4, topSurfY, 4, 2, 'water');
    map.fillSurfaceRect(midX + 1, topSurfY, 4, 2, 'grass');
    map.fillSurfaceRect(midX - 4, botSurfY, 4, 2, 'poison_swamp');
    map.fillSurfaceRect(midX + 1, botSurfY, 4, 2, 'oil');
  }

  const flankX = Math.max(5, leftL - 3);
  const eastFlankX = cols - 1 - flankX;
  const accentW = Math.max(4, flankX - 1);
  const accentE = cols - 1 - accentW;
  const topAnchorY = topL + 2;
  const botAnchorY = rows - 1 - topAnchorY;

  return [
    { id: 'gc_barricade_w', role: 'barricade', propKind: kinds.barricade, tx: flankX, ty: midY - 1 },
    { id: 'gc_barricade_e', role: 'barricade', propKind: kinds.barricade, tx: eastFlankX, ty: midY },
    { id: 'gc_hazard_nw', role: 'hazard', propKind: kinds.hazard, tx: midX - 3, ty: topAnchorY },
    { id: 'gc_hazard_se', role: 'hazard', propKind: kinds.hazard, tx: midX + 2, ty: botAnchorY },
    { id: 'gc_pillar_sw', role: 'pillar_toy', propKind: kinds.pillarToy, tx: flankX, ty: botAnchorY },
    { id: 'gc_pillar_ne', role: 'pillar_toy', propKind: kinds.pillarToy, tx: eastFlankX, ty: topAnchorY },
    { id: 'gc_accent_nw', role: 'accent', propKind: 'glow_mushroom', tx: accentW, ty: topAnchorY - 1 },
    { id: 'gc_accent_se', role: 'accent', propKind: 'glow_mushroom', tx: accentE, ty: botAnchorY + 1 },
    { id: 'gc_mech', role: 'mechanism', propKind: 'ancient_mechanism', tx: midX - 3, ty: midY },
  ];
}

function buildCentralBastionGeometry(map: ArenaMap, biome: 1 | 2 | 3, flipX: boolean, flipY: boolean): BaseAnchorSpec[] {
  const kinds = getBiomeTacticalPropKinds(biome);
  const cols = map.cols;
  const rows = map.rows;
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);

  const pLeftX = Math.max(5, Math.round((8 * cols) / 36));
  const pRightX = cols - 2 - pLeftX;
  setPillarRect(map, pLeftX, 3, 2, 1);
  setPillarRect(map, pRightX, rows - 4, 2, 1);

  const boxMinX = midX - 3;
  const boxMaxX = midX + 2;
  const boxMinY = midY - 3;
  const boxMaxY = midY + 2;
  for (let ty = boxMinY; ty <= boxMaxY; ty++) {
    for (let tx = boxMinX; tx <= boxMaxX; tx++) {
      if (tx === boxMinX || tx === boxMaxX || ty === boxMinY || ty === boxMaxY) {
        const idx = ty * cols + tx;
        if (map.tiles[idx] !== 'wall') {
          map.tiles[idx] = 'pillar';
        }
      }
    }
  }
  if (map.roomShape !== 'donut_ring') {
    const gates =
      flipX !== flipY
        ? ([
            [midX - 1, boxMinY],
            [midX, boxMinY],
            [midX - 1, boxMaxY],
            [midX, boxMaxY],
          ] as const)
        : ([
            [boxMinX, midY - 1],
            [boxMinX, midY],
            [boxMaxX, midY - 1],
            [boxMaxX, midY],
          ] as const);
    for (const [tx, ty] of gates) map.tiles[ty * cols + tx] = 'floor';
  }

  const topSurfY = Math.max(2, boxMinY - 5);
  const botSurfY = Math.min(rows - 5, boxMaxY + 3);
  if (biome === 2) {
    map.fillSurfaceRect(midX - 6, topSurfY, 5, 3, 'ice');
    map.fillSurfaceRect(midX + 1, topSurfY, 5, 3, 'water');
    map.fillSurfaceRect(midX - 6, botSurfY, 5, 3, 'ice');
    map.fillSurfaceRect(2, 2, 2, 1, 'chasm');
  } else if (biome === 3) {
    map.fillSurfaceRect(midX - 6, Math.max(3, boxMinY - 4), 12, 2, 'conveyor');
    map.fillSurfaceRect(midX - 6, Math.min(rows - 4, boxMaxY + 3), 12, 2, 'conveyor');
    map.fillSurfaceRect(4, Math.max(3, boxMinY - 3), 3, 3, 'lava');
    map.fillSurfaceRect(cols - 8, Math.min(rows - 6, boxMaxY + 1), 3, 3, 'oil');
  } else {
    map.fillSurfaceRect(midX - 6, topSurfY, 4, 3, 'water');
    map.fillSurfaceRect(midX + 2, topSurfY, 4, 3, 'grass');
    map.fillSurfaceRect(midX - 6, botSurfY, 4, 3, 'poison_swamp');
    map.fillSurfaceRect(midX + 2, botSurfY, 4, 3, 'oil');
  }

  const flankX = Math.max(5, Math.round((6 * cols) / 36));
  const eastFlankX = cols - 1 - flankX;
  const barWestX = boxMinX - 3;
  const barEastX = boxMaxX + 3;
  const barNorthY = Math.max(4, boxMinY - 2);
  const barSouthY = Math.min(rows - 5, boxMaxY + 2);

  return [
    { id: 'cb_barricade_w', role: 'barricade', propKind: kinds.barricade, tx: barWestX, ty: midY - 1 },
    { id: 'cb_barricade_e', role: 'barricade', propKind: kinds.barricade, tx: barEastX, ty: midY },
    { id: 'cb_barricade_n', role: 'barricade', propKind: kinds.barricade, tx: midX - 1, ty: barNorthY },
    { id: 'cb_barricade_s', role: 'barricade', propKind: kinds.barricade, tx: midX, ty: barSouthY },
    { id: 'cb_hazard_nw', role: 'hazard', propKind: kinds.hazard, tx: barWestX - 1, ty: barNorthY },
    { id: 'cb_hazard_se', role: 'hazard', propKind: kinds.hazard, tx: barEastX + 1, ty: barSouthY },
    { id: 'cb_pillar_sw', role: 'pillar_toy', propKind: kinds.pillarToy, tx: flankX, ty: barSouthY },
    { id: 'cb_pillar_ne', role: 'pillar_toy', propKind: kinds.pillarToy, tx: eastFlankX, ty: barNorthY },
    { id: 'cb_mech', role: 'mechanism', propKind: 'ancient_mechanism', tx: midX - 1, ty: midY - 1 },
  ];
}

function isHazardOrMovingPropSurface(surface: SurfaceKind): boolean {
  return (
    surface === 'chasm' ||
    surface === 'lava' ||
    surface === 'ice' ||
    surface === 'conveyor' ||
    surface === 'burning_oil' ||
    surface === 'burning_grass' ||
    (surface as string).startsWith('conveyor_')
  );
}

function resolveJitteredPropAnchors(
  map: ArenaMap,
  archetype: RoomArchetypeId,
  baseSpecs: readonly BaseAnchorSpec[],
  roomSeed: number,
  flipX: boolean,
  flipY: boolean,
): RoomPropAnchor[] {
  const rng = new SeededRandom(roomSeed).fork(`prop_jitter_${archetype}`);
  const anchors: RoomPropAnchor[] = [];
  const midX = Math.floor(map.cols / 2);
  const maxRing = Math.max(map.cols, map.rows);
  const isValidAnchorTile = (tx: number, ty: number): boolean => {
    if (tx < 3 || tx > map.cols - 4 || ty < 3 || ty > map.rows - 4) return false;
    if (map.isSolidTile(tx, ty) || map.getSurface(tx, ty) !== 'none' || isInDoorVestibule(tx, ty, map)) {
      return false;
    }
    if (archetype === 'TWIN_BRIDGES' && tx >= midX - 5 && tx <= midX + 4) return false;
    for (let i = 0; i < anchors.length; i++) {
      if (Math.abs(anchors[i]!.tx - tx) <= 1 && Math.abs(anchors[i]!.ty - ty) <= 1) return false;
    }
    return true;
  };
  const isDryFallbackAnchorTile = (tx: number, ty: number): boolean => {
    if (tx < 2 || tx > map.cols - 3 || ty < 2 || ty > map.rows - 3) return false;
    if (map.isSolidTile(tx, ty) || map.getSurface(tx, ty) !== 'none' || isInDoorVestibule(tx, ty, map)) {
      return false;
    }
    for (let i = 0; i < anchors.length; i++) {
      if (anchors[i]!.tx === tx && anchors[i]!.ty === ty) return false;
    }
    return true;
  };
  const isSafeSurfaceFallbackAnchorTile = (tx: number, ty: number): boolean => {
    if (tx < 2 || tx > map.cols - 3 || ty < 2 || ty > map.rows - 3) return false;
    if (
      map.isSolidTile(tx, ty) ||
      isHazardOrMovingPropSurface(map.getSurface(tx, ty)) ||
      isInDoorVestibule(tx, ty, map)
    ) {
      return false;
    }
    for (let i = 0; i < anchors.length; i++) {
      if (anchors[i]!.tx === tx && anchors[i]!.ty === ty) return false;
    }
    return true;
  };
  const isFallbackAnchorTile = (tx: number, ty: number): boolean => {
    if (tx < 2 || tx > map.cols - 3 || ty < 2 || ty > map.rows - 3) return false;
    if (map.isSolidTile(tx, ty) || map.getSurface(tx, ty) === 'chasm' || isInDoorVestibule(tx, ty, map)) {
      return false;
    }
    for (let i = 0; i < anchors.length; i++) {
      if (anchors[i]!.tx === tx && anchors[i]!.ty === ty) return false;
    }
    return true;
  };
  const relocateOutwardFrom = (originTx: number, originTy: number, startRing: number): { tx: number; ty: number } => {
    for (let ring = startRing; ring <= maxRing; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const candTx = originTx + dx;
          const candTy = originTy + dy;
          if (isValidAnchorTile(candTx, candTy)) {
            return { tx: candTx, ty: candTy };
          }
        }
      }
    }
    for (let ring = 1; ring <= maxRing; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const candTx = originTx + dx;
          const candTy = originTy + dy;
          if (isDryFallbackAnchorTile(candTx, candTy)) {
            return { tx: candTx, ty: candTy };
          }
        }
      }
    }
    for (let ring = 1; ring <= maxRing; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const candTx = originTx + dx;
          const candTy = originTy + dy;
          if (isSafeSurfaceFallbackAnchorTile(candTx, candTy)) {
            return { tx: candTx, ty: candTy };
          }
        }
      }
    }
    for (let ring = 1; ring <= maxRing; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const candTx = originTx + dx;
          const candTy = originTy + dy;
          if (isFallbackAnchorTile(candTx, candTy)) {
            return { tx: candTx, ty: candTy };
          }
        }
      }
    }
    for (let ty = 2; ty <= map.rows - 3; ty++) {
      for (let tx = 2; tx <= map.cols - 3; tx++) {
        if (!map.isSolidTile(tx, ty) && map.getSurface(tx, ty) === 'none' && !isInDoorVestibule(tx, ty, map)) {
          return { tx, ty };
        }
      }
    }
    for (let ty = 2; ty <= map.rows - 3; ty++) {
      for (let tx = 2; tx <= map.cols - 3; tx++) {
        if (
          !map.isSolidTile(tx, ty) &&
          !isHazardOrMovingPropSurface(map.getSurface(tx, ty)) &&
          !isInDoorVestibule(tx, ty, map)
        ) {
          return { tx, ty };
        }
      }
    }
    for (let ty = 2; ty <= map.rows - 3; ty++) {
      for (let tx = 2; tx <= map.cols - 3; tx++) {
        if (!map.isSolidTile(tx, ty) && map.getSurface(tx, ty) !== 'chasm' && !isInDoorVestibule(tx, ty, map)) {
          return { tx, ty };
        }
      }
    }
    return { tx: originTx, ty: originTy };
  };

  for (let i = 0; i < baseSpecs.length; i++) {
    const spec = baseSpecs[i]!;
    if (spec.noJitter) {
      if (spec.id.startsWith('cpr_ring_pillar_')) {
        anchors.push({
          id: spec.id,
          slotIndex: i,
          role: spec.role,
          propKind: spec.propKind,
          baseTx: spec.tx,
          baseTy: spec.ty,
          tx: spec.tx,
          ty: spec.ty,
          jitterDx: 0,
          jitterDy: 0,
          x: spec.exactX ?? spec.tx * TILE_SIZE + TILE_SIZE * 0.5,
          y: spec.exactY ?? spec.ty * TILE_SIZE + TILE_SIZE * 0.5,
        });
        continue;
      }
      let chosenTx = spec.tx;
      let chosenTy = spec.ty;
      if (!isValidAnchorTile(chosenTx, chosenTy)) {
        const relocated = relocateOutwardFrom(spec.tx, spec.ty, 1);
        chosenTx = relocated.tx;
        chosenTy = relocated.ty;
      }
      anchors.push({
        id: spec.id,
        slotIndex: i,
        role: spec.role,
        propKind: spec.propKind,
        baseTx: chosenTx,
        baseTy: chosenTy,
        tx: chosenTx,
        ty: chosenTy,
        jitterDx: 0,
        jitterDy: 0,
        x: chosenTx === spec.tx && chosenTy === spec.ty && spec.exactX !== undefined
          ? spec.exactX
          : chosenTx * TILE_SIZE + TILE_SIZE * 0.5,
        y: chosenTx === spec.tx && chosenTy === spec.ty && spec.exactY !== undefined
          ? spec.exactY
          : chosenTy * TILE_SIZE + TILE_SIZE * 0.5,
      });
      continue;
    }
    const mirroredTx = flipX ? map.cols - 1 - spec.tx : spec.tx;
    const mirroredTy = flipY ? map.rows - 1 - spec.ty : spec.ty;
    const startOffsetIdx = rng.nextInt(0, JITTER_OFFSETS.length - 2);
    let baseTx = mirroredTx;
    let baseTy = mirroredTy;
    let chosenTx = mirroredTx;
    let chosenTy = mirroredTy;
    let chosenDx = 0;
    let chosenDy = 0;
    let foundValid = false;
    for (let attempt = 0; attempt < JITTER_OFFSETS.length; attempt++) {
      const [dx, dy] =
        attempt === JITTER_OFFSETS.length - 1
          ? [0, 0]
          : JITTER_OFFSETS[(startOffsetIdx + attempt) % (JITTER_OFFSETS.length - 1)]!;
      if (isValidAnchorTile(mirroredTx + dx, mirroredTy + dy)) {
        chosenTx = mirroredTx + dx;
        chosenTy = mirroredTy + dy;
        chosenDx = dx;
        chosenDy = dy;
        foundValid = true;
        break;
      }
      const targetSurface = map.getSurface(mirroredTx + dx, mirroredTy + dy);
      if (
        attempt === 0 &&
        (targetSurface === 'conveyor' || targetSurface === 'lava') &&
        isValidAnchorTile(mirroredTx, mirroredTy)
      ) {
        chosenTx = mirroredTx;
        chosenTy = mirroredTy;
        chosenDx = 0;
        chosenDy = 0;
        foundValid = true;
        break;
      }
    }
    if (!foundValid) {
      for (let dy = -2; dy <= 2 && !foundValid; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (isValidAnchorTile(mirroredTx + dx, mirroredTy + dy)) {
            chosenTx = mirroredTx + dx;
            chosenTy = mirroredTy + dy;
            chosenDx = dx;
            chosenDy = dy;
            foundValid = true;
            break;
          }
        }
      }
    }
    if (!foundValid) {
      const relocated = relocateOutwardFrom(mirroredTx, mirroredTy, 3);
      chosenTx = relocated.tx;
      chosenTy = relocated.ty;
      baseTx = chosenTx;
      baseTy = chosenTy;
      chosenDx = 0;
      chosenDy = 0;
    }
    anchors.push({
      id: spec.id, slotIndex: i, role: spec.role, propKind: spec.propKind,
      baseTx, baseTy, tx: chosenTx, ty: chosenTy,
      jitterDx: chosenDx, jitterDy: chosenDy,
      x: chosenTx * TILE_SIZE + TILE_SIZE * 0.5, y: chosenTy * TILE_SIZE + TILE_SIZE * 0.5,
    });
  }
  return anchors;
}

export function spawnCombatRoomArchetypeProps(sim: WorldSim, room: DungeonRoomNode): void {
  const firstCombatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat');
  const isPrimaryCombat = !firstCombatRoom || firstCombatRoom.id === room.id;
  const keepFourthBrazier = isPrimaryCombat || (Math.abs(Number(sim.dungeon.seed) + room.id) & 1) === 0;
  const bLeftX = Math.max(5, Math.round((7 * sim.map.cols) / 36));
  const bRightX = sim.map.cols - 1 - bLeftX;
  const bTopY = Math.max(3, Math.round((4 * sim.map.rows) / 22));
  const bBotY = sim.map.rows - 1 - bTopY;
  const maxRing = Math.max(sim.map.cols, sim.map.rows);
  const spawnBrazierSafe = (bx: number, by: number): void => {
    const tx = Math.max(1, Math.min(sim.map.cols - 2, Math.floor(bx / TILE_SIZE)));
    const ty = Math.max(1, Math.min(sim.map.rows - 2, Math.floor(by / TILE_SIZE)));
    if (
      !sim.map.isSolidTile(tx, ty) &&
      sim.map.getSurface(tx, ty) === 'none' &&
      !isInDoorVestibule(tx, ty, sim.map) &&
      !sim.map.checkProjectileWallHit(bx, by, 11).hit
    ) {
      sim.spawnProp('torch_brazier', bx, by);
      return;
    }
    for (let ring = 1; ring <= maxRing; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const candTx = tx + dx;
          const candTy = ty + dy;
          if (candTx < 2 || candTx > sim.map.cols - 3 || candTy < 2 || candTy > sim.map.rows - 3) continue;
          const cx = candTx * TILE_SIZE + TILE_SIZE * 0.5;
          const cy = candTy * TILE_SIZE + TILE_SIZE * 0.5;
          if (
            !sim.map.isSolidTile(candTx, candTy) &&
            sim.map.getSurface(candTx, candTy) === 'none' &&
            !isInDoorVestibule(candTx, candTy, sim.map) &&
            !sim.map.checkProjectileWallHit(cx, cy, 11).hit
          ) {
            sim.spawnProp('torch_brazier', cx, cy);
            return;
          }
        }
      }
    }
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const candTx = tx + dx;
          const candTy = ty + dy;
          if (candTx < 1 || candTx > sim.map.cols - 2 || candTy < 1 || candTy > sim.map.rows - 2) continue;
          const cx = candTx * TILE_SIZE + TILE_SIZE * 0.5;
          const cy = candTy * TILE_SIZE + TILE_SIZE * 0.5;
          if (
            !sim.map.isSolidTile(candTx, candTy) &&
            !isHazardOrMovingPropSurface(sim.map.getSurface(candTx, candTy)) &&
            !isInDoorVestibule(candTx, candTy, sim.map) &&
            !sim.map.checkProjectileWallHit(cx, cy, 11).hit
          ) {
            sim.spawnProp('torch_brazier', cx, cy);
            return;
          }
        }
      }
    }
    const safe = findNearestWalkablePoint(sim.map, bx, by, 12);
    sim.spawnProp('torch_brazier', safe.x, safe.y);
  };
  spawnBrazierSafe(bLeftX * TILE_SIZE + 18, bTopY * TILE_SIZE + 20);
  spawnBrazierSafe(bRightX * TILE_SIZE + 14, bTopY * TILE_SIZE + 20);
  spawnBrazierSafe(bLeftX * TILE_SIZE + 18, bBotY * TILE_SIZE + 12);
  if (keepFourthBrazier) spawnBrazierSafe(bRightX * TILE_SIZE + 14, bBotY * TILE_SIZE + 12);
  for (let i = 0; i < sim.map.propAnchors.length; i++) {
    const a = sim.map.propAnchors[i]!;
    sim.spawnProp(a.propKind, a.x, a.y);
  }
}

export function configureRoomLayout(
  map: ArenaMap,
  optsOrSeed: RoomLayoutOptions | number,
  archetypeArg?: RoomArchetypeId,
  biomeArg?: 1 | 2 | 3,
  activeDoorSidesArg?: readonly CardinalDir[],
): RoomLayoutResult {
  const opts: RoomLayoutOptions =
    typeof optsOrSeed === 'number'
      ? {
          roomSeed: optsOrSeed,
          archetype: archetypeArg ?? selectBiome1RoomArchetype(optsOrSeed),
          biome: biomeArg ?? map.biome,
          activeDoorSides: activeDoorSidesArg ?? DEFAULT_DOORS,
        }
      : optsOrSeed;
  if (opts.roomSizePreset) {
    map.roomSizePreset = opts.roomSizePreset;
  }
  const presetDims = opts.roomSizePreset ? ROOM_SIZE_PRESET_DIMS[opts.roomSizePreset] : undefined;
  const targetCols = opts.cols ?? presetDims?.cols;
  const targetRows = opts.rows ?? presetDims?.rows;
  if (targetCols && targetRows) {
    map.resize(targetCols, targetRows);
  }
  const roomSeed = Math.trunc(opts.roomSeed);
  const archetype = opts.archetype;
  const biome: 1 | 2 | 3 = opts.biome ?? map.biome ?? 1;
  const activeDoorSides =
    opts.activeDoorSides && opts.activeDoorSides.length > 0 ? opts.activeDoorSides : DEFAULT_DOORS;
  const roomShape: RoomShapeKind = opts.roomShape ?? map.roomShape ?? 'rectangle';
  const flipX = (roomSeed & 1) !== 0;
  const flipY = (roomSeed & 2) !== 0;
  map.biome = biome;
  map.conveyorDirection = 1;
  map.conveyorCycleTimer = 0;
  map.conveyorWarningTimer = 0;
  map.roomArchetype = archetype;
  map.roomShape = roomShape;
  const count = map.cols * map.rows;
  const rng = new SeededRandom(roomSeed).fork('room_combat');
  for (let i = 0; i < count; i++) {
    map.tiles[i] = 'floor';
    map.surfaces[i] = 'none';
    map.baseSurfaces[i] = 'none';
    map.surfaceTimers[i] = 0;
    map.tileVariants[i] = rng.nextInt(0, 7);
  }
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      if (tx === 0 || ty === 0 || tx === map.cols - 1 || ty === map.rows - 1) map.tiles[ty * map.cols + tx] = 'wall';
    }
  }
  applyRoomInteriorShape(map, roomShape);
  const baseSpecs =
    archetype === 'TWIN_BRIDGES'
      ? buildTwinBridgesGeometry(map, biome, flipX, flipY)
      : archetype === 'CENTRAL_BASTION'
        ? buildCentralBastionGeometry(map, biome, flipX, flipY)
        : archetype === 'CROSSFIRE_CONVEYORS'
           ? buildCrossfireConveyorsGeometry(map, biome, flipX, flipY)
          : archetype === 'PRISM_LABYRINTH'
            ? buildPrismLabyrinthGeometry(map, biome, flipX, flipY)
            : archetype === 'CRUMBLING_PILLAR_RING'
              ? buildCrumblingPillarRingGeometry(map, biome, flipX, flipY)
              : buildGauntletChokepointGeometry(map, biome, flipX, flipY);
  const vestibuleRects = getDoorVestibuleRectsForMap(map);
  for (const dir of new Set<CardinalDir>([...DEFAULT_DOORS, ...activeDoorSides])) {
    const rect = vestibuleRects[dir];
    for (let ty = rect.minTy; ty <= rect.maxTy; ty++) {
      for (let tx = rect.minTx; tx <= rect.maxTx; tx++) {
        const idx = ty * map.cols + tx;
        map.tiles[idx] = 'floor';
        map.surfaces[idx] = 'none';
        map.baseSurfaces[idx] = 'none';
        map.surfaceTimers[idx] = 0;
      }
    }
  }
  const propAnchors = resolveJitteredPropAnchors(map, archetype, baseSpecs, roomSeed, flipX, flipY);
  const result: RoomLayoutResult = {
    archetype, roomSeed, biome, flipX, flipY, activeDoorSides,
    bridgeRows: archetype === 'TWIN_BRIDGES' ? computeTwinBridgesRows(map.rows) : [],
    propAnchors,
    roomShape,
  };
  map.propAnchors = propAnchors;
  map.lastLayoutResult = result;
  map.lastRoomLayout = result;
  map.rebuildSolidBoxes();
  map.mapRevision += 1;
  return result;
}
