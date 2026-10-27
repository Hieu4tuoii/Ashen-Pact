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
} from './arena-room-archetypes-p1c.js';
import type { DungeonRoomNode } from './dungeon-gen.js';
import type { PropKind } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export {
  clearCollapsedPillarFootprintOnMap,
  CONVEYOR_BELT_SPEED,
  CRUMBLING_RING_PILLAR_RECTS,
  getConveyorVelocityAtWorld,
};

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

const bfsVisitedScratch = new Uint8Array(36 * 22);
const bfsQueueXScratch = new Int16Array(36 * 22);
const bfsQueueYScratch = new Int16Array(36 * 22);
const bfsParentScratch = new Int16Array(36 * 22);

export function selectBiome1RoomArchetype(roomSeed: number, roomIndex = 0): RoomArchetypeId {
  const normalized = Math.abs(Math.trunc(roomSeed) + Math.trunc(roomIndex));
  return PHASE0B_ROOM_ARCHETYPES[normalized % PHASE0B_ROOM_ARCHETYPES.length]!;
}

export const selectCombatRoomArchetype = selectBiome1RoomArchetype;

export function isInDoorVestibule(tx: number, ty: number): boolean {
  for (const dir of DEFAULT_DOORS) {
    const r = DOOR_VESTIBULE_RECTS[dir];
    if (tx >= r.minTx && tx <= r.maxTx && ty >= r.minTy && ty <= r.maxTy) return true;
  }
  return false;
}

export const isInDoorClearanceZone = isInDoorVestibule;

export function isWalkableTileForBfs(map: ArenaMap, tx: number, ty: number): boolean {
  if (tx <= 0 || ty <= 0 || tx >= map.cols - 1 || ty >= map.rows - 1) return false;
  return !map.isSolidTile(tx, ty) && map.getSurface(tx, ty) !== 'chasm';
}

export function areActiveDoorsConnectedBfs(
  map: ArenaMap,
  activeDoorSides: readonly CardinalDir[] = DEFAULT_DOORS,
): boolean {
  const doors = activeDoorSides.length > 0 ? activeDoorSides : DEFAULT_DOORS;
  for (let i = 0; i < doors.length; i++) {
    const d = DOOR_TILES[doors[i]!];
    if (!isWalkableTileForBfs(map, d.tx, d.ty)) return false;
  }
  if (doors.length <= 1) return true;

  const total = map.cols * map.rows;
  const visited = total <= bfsVisitedScratch.length ? bfsVisitedScratch : new Uint8Array(total);
  const qx = total <= bfsQueueXScratch.length ? bfsQueueXScratch : new Int16Array(total);
  const qy = total <= bfsQueueYScratch.length ? bfsQueueYScratch : new Int16Array(total);
  visited.fill(0, 0, total);

  const start = DOOR_TILES[doors[0]!];
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
    const d = DOOR_TILES[doors[i]!];
    if (!visited[d.ty * map.cols + d.tx]) return false;
  }
  return true;
}

export function findNearestWalkablePoint(
  map: ArenaMap,
  worldX: number,
  worldY: number,
  radius = 14,
): { x: number; y: number } {
  const sTx = Math.max(1, Math.min(map.cols - 2, Math.floor(worldX / TILE_SIZE)));
  const sTy = Math.max(1, Math.min(map.rows - 2, Math.floor(worldY / TILE_SIZE)));
  if (isWalkableTileForBfs(map, sTx, sTy) && !map.checkProjectileWallHit(worldX, worldY, radius).hit) {
    return { x: worldX, y: worldY };
  }
  for (let ring = 1; ring <= 12; ring++) {
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
  return { x: 10 * TILE_SIZE + 16, y: 11 * TILE_SIZE + 16 };
}

export function findNextWalkableWaypoint(
  map: ArenaMap,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number } {
  const sTx = Math.max(1, Math.min(map.cols - 2, Math.floor(fromX / TILE_SIZE)));
  const sTy = Math.max(1, Math.min(map.rows - 2, Math.floor(fromY / TILE_SIZE)));
  const gTx = Math.max(1, Math.min(map.cols - 2, Math.floor(toX / TILE_SIZE)));
  const gTy = Math.max(1, Math.min(map.rows - 2, Math.floor(toY / TILE_SIZE)));
  if (sTx === gTx && sTy === gTy) return { x: toX, y: toY };
  const total = map.cols * map.rows;
  bfsVisitedScratch.fill(0, 0, total);
  bfsParentScratch.fill(-1, 0, total);
  const startIdx = sTy * map.cols + sTx;
  const goalIdx = gTy * map.cols + gTx;
  let head = 0;
  let tail = 1;
  bfsVisitedScratch[startIdx] = 1;
  bfsQueueXScratch[0] = sTx;
  bfsQueueYScratch[0] = sTy;
  let found = false;
  while (head < tail) {
    const cx = bfsQueueXScratch[head]!;
    const cy = bfsQueueYScratch[head]!;
    const cIdx = cy * map.cols + cx;
    head += 1;
    if (cIdx === goalIdx) {
      found = true;
      break;
    }
    for (let k = 0; k < 4; k++) {
      const nx = cx + CARDINAL_DIRS[k]![0];
      const ny = cy + CARDINAL_DIRS[k]![1];
      if (!isWalkableTileForBfs(map, nx, ny) && !(nx === gTx && ny === gTy)) continue;
      const nIdx = ny * map.cols + nx;
      if (bfsVisitedScratch[nIdx]) continue;
      bfsVisitedScratch[nIdx] = 1;
      bfsParentScratch[nIdx] = cIdx;
      bfsQueueXScratch[tail] = nx;
      bfsQueueYScratch[tail] = ny;
      tail += 1;
    }
  }
  if (!found) return { x: toX, y: toY };
  let cur = goalIdx;
  for (let s = 0; s < 64 && bfsParentScratch[cur] !== -1 && bfsParentScratch[cur] !== startIdx; s++) {
    const p = bfsParentScratch[cur]!;
    cur = p;
    if (bfsParentScratch[p] === startIdx) break;
  }
  return { x: (cur % map.cols) * TILE_SIZE + TILE_SIZE * 0.5, y: Math.floor(cur / map.cols) * TILE_SIZE + TILE_SIZE * 0.5 };
}

function setPillarRect(map: ArenaMap, startTx: number, startTy: number, w: number, h: number): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tx = startTx + dx;
      const ty = startTy + dy;
      if (tx > 0 && tx < map.cols - 1 && ty > 0 && ty < map.rows - 1) {
        const idx = ty * map.cols + tx;
        map.tiles[idx] = 'pillar';
        map.surfaces[idx] = 'none';
        map.baseSurfaces[idx] = 'none';
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

function buildTwinBridgesGeometry(map: ArenaMap, biome: 1 | 2 | 3, flipX: boolean, flipY: boolean): BaseAnchorSpec[] {
  const kinds = getBiomeTacticalPropKinds(biome);
  setPillarRect(map, 8, 3, 2, 1);
  setPillarRect(map, 26, 18, 2, 1);
  for (let ty = 1; ty <= map.rows - 2; ty++) {
    if ((ty >= 5 && ty <= 7) || (ty >= 14 && ty <= 16)) continue;
    const cols =
      ty <= 3 || ty >= 18
        ? [14, 15, 21, 22]
        : ty === 4 || ty === 17
          ? [14, 15, 16, 20, 21, 22]
          : [15, 16, 17, 18, 19, 20];
    for (const tx of cols) map.setSurface(tx, ty, 'chasm', 0, true);
  }
  const westTopSurf: SurfaceKind = biome === 2 ? 'ice' : biome === 3 ? 'conveyor' : 'grass';
  const eastTopSurf: SurfaceKind = biome === 2 ? 'water' : biome === 3 ? 'lava' : 'water';
  const westBotSurf: SurfaceKind = biome === 2 ? 'water' : biome === 3 ? 'oil' : 'poison_swamp';
  const eastBotSurf: SurfaceKind = biome === 2 ? 'ice' : biome === 3 ? 'conveyor' : 'grass';
  const topY = flipY ? 15 : 4;
  const botY = flipY ? 4 : 15;
  map.fillSurfaceRect(flipX ? 28 : 4, topY, 4, 2, westTopSurf);
  map.fillSurfaceRect(flipX ? 4 : 28, topY, 4, 2, eastTopSurf);
  map.fillSurfaceRect(flipX ? 28 : 4, botY, 4, 2, westBotSurf);
  map.fillSurfaceRect(flipX ? 4 : 28, botY, 4, 2, eastBotSurf);
  return [
    { id: 'tb_barricade_w_n', role: 'barricade', propKind: kinds.barricade, tx: 11, ty: 6 },
    { id: 'tb_barricade_e_s', role: 'barricade', propKind: kinds.barricade, tx: 24, ty: 15 },
    { id: 'tb_hazard_w', role: 'hazard', propKind: kinds.hazard, tx: 11, ty: 14 },
    { id: 'tb_hazard_e', role: 'hazard', propKind: kinds.hazard, tx: 24, ty: 7 },
    { id: 'tb_pillar_w', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 6, ty: 10 },
    { id: 'tb_pillar_e', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 29, ty: 11 },
    { id: 'tb_accent_nw', role: 'accent', propKind: 'glow_mushroom', tx: 6, ty: 5 },
    { id: 'tb_accent_se', role: 'accent', propKind: 'glow_mushroom', tx: 29, ty: 16 },
    { id: 'tb_mech', role: 'mechanism', propKind: 'ancient_mechanism', tx: 10, ty: 11 },
  ];
}

function buildGauntletChokepointGeometry(map: ArenaMap, biome: 1 | 2 | 3, flipX: boolean, flipY: boolean): BaseAnchorSpec[] {
  const kinds = getBiomeTacticalPropKinds(biome);
  setPillarRect(map, 9, 4, 3, 3);
  setPillarRect(map, 8, 5, 1, 2);
  setPillarRect(map, 24, 4, 3, 3);
  setPillarRect(map, 27, 5, 1, 2);
  setPillarRect(map, 9, 15, 3, 3);
  setPillarRect(map, 8, 15, 1, 2);
  setPillarRect(map, 24, 15, 3, 3);
  setPillarRect(map, 27, 15, 1, 2);
  setPillarRect(map, flipX ? 21 : 13, flipY ? 14 : 7, 2, 1);
  setPillarRect(map, flipX ? 13 : 21, flipY ? 7 : 14, 2, 1);
  if (biome === 2) {
    map.fillSurfaceRect(14, 3, 4, 2, 'ice');
    map.fillSurfaceRect(19, 3, 4, 2, 'water');
    map.fillSurfaceRect(14, 17, 4, 2, 'ice');
    map.fillSurfaceRect(2, 2, 2, 1, 'chasm');
  } else if (biome === 3) {
    map.fillSurfaceRect(13, 3, 10, 2, 'conveyor');
    map.fillSurfaceRect(13, 17, 10, 2, 'conveyor');
    map.fillSurfaceRect(4, 7, 3, 3, 'lava');
    map.fillSurfaceRect(29, 12, 3, 3, 'oil');
  } else {
    map.fillSurfaceRect(14, 3, 4, 2, 'water');
    map.fillSurfaceRect(19, 3, 4, 2, 'grass');
    map.fillSurfaceRect(14, 17, 4, 2, 'poison_swamp');
    map.fillSurfaceRect(19, 17, 4, 2, 'oil');
  }
  return [
    { id: 'gc_barricade_w', role: 'barricade', propKind: kinds.barricade, tx: 6, ty: 10 },
    { id: 'gc_barricade_e', role: 'barricade', propKind: kinds.barricade, tx: 29, ty: 11 },
    { id: 'gc_hazard_nw', role: 'hazard', propKind: kinds.hazard, tx: 15, ty: 6 },
    { id: 'gc_hazard_se', role: 'hazard', propKind: kinds.hazard, tx: 20, ty: 15 },
    { id: 'gc_pillar_sw', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 6, ty: 15 },
    { id: 'gc_pillar_ne', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 29, ty: 6 },
    { id: 'gc_accent_nw', role: 'accent', propKind: 'glow_mushroom', tx: 5, ty: 5 },
    { id: 'gc_accent_se', role: 'accent', propKind: 'glow_mushroom', tx: 30, ty: 16 },
    { id: 'gc_mech', role: 'mechanism', propKind: 'ancient_mechanism', tx: 15, ty: 11 },
  ];
}

function buildCentralBastionGeometry(map: ArenaMap, biome: 1 | 2 | 3, flipX: boolean, flipY: boolean): BaseAnchorSpec[] {
  const kinds = getBiomeTacticalPropKinds(biome);
  setPillarRect(map, 8, 3, 2, 1);
  setPillarRect(map, 26, 18, 2, 1);
  for (let ty = 8; ty <= 13; ty++) {
    for (let tx = 15; tx <= 20; tx++) {
      if (tx === 15 || tx === 20 || ty === 8 || ty === 13) map.tiles[ty * map.cols + tx] = 'pillar';
    }
  }
  const gates =
    flipX !== flipY
      ? ([[17, 8], [18, 8], [17, 13], [18, 13]] as const)
      : ([[15, 10], [15, 11], [20, 10], [20, 11]] as const);
  for (const [tx, ty] of gates) map.tiles[ty * map.cols + tx] = 'floor';
  if (biome === 2) {
    map.fillSurfaceRect(12, 3, 5, 3, 'ice');
    map.fillSurfaceRect(19, 3, 5, 3, 'water');
    map.fillSurfaceRect(12, 16, 5, 3, 'ice');
    map.fillSurfaceRect(2, 2, 2, 1, 'chasm');
  } else if (biome === 3) {
    map.fillSurfaceRect(12, 4, 12, 2, 'conveyor');
    map.fillSurfaceRect(12, 16, 12, 2, 'conveyor');
    map.fillSurfaceRect(4, 5, 3, 3, 'lava');
    map.fillSurfaceRect(28, 14, 3, 3, 'oil');
  } else {
    map.fillSurfaceRect(12, 3, 4, 3, 'water');
    map.fillSurfaceRect(20, 3, 4, 3, 'grass');
    map.fillSurfaceRect(12, 16, 4, 3, 'poison_swamp');
    map.fillSurfaceRect(20, 16, 4, 3, 'oil');
  }
  return [
    { id: 'cb_barricade_w', role: 'barricade', propKind: kinds.barricade, tx: 12, ty: 10 },
    { id: 'cb_barricade_e', role: 'barricade', propKind: kinds.barricade, tx: 23, ty: 11 },
    { id: 'cb_barricade_n', role: 'barricade', propKind: kinds.barricade, tx: 17, ty: 6 },
    { id: 'cb_barricade_s', role: 'barricade', propKind: kinds.barricade, tx: 18, ty: 15 },
    { id: 'cb_hazard_nw', role: 'hazard', propKind: kinds.hazard, tx: 11, ty: 6 },
    { id: 'cb_hazard_se', role: 'hazard', propKind: kinds.hazard, tx: 24, ty: 15 },
    { id: 'cb_pillar_sw', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 6, ty: 15 },
    { id: 'cb_pillar_ne', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 29, ty: 6 },
    { id: 'cb_mech', role: 'mechanism', propKind: 'ancient_mechanism', tx: 17, ty: 10 },
  ];
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
  const isValidAnchorTile = (tx: number, ty: number): boolean => {
    if (tx < 3 || tx > map.cols - 4 || ty < 3 || ty > map.rows - 4) return false;
    if (map.isSolidTile(tx, ty) || map.getSurface(tx, ty) === 'chasm' || isInDoorVestibule(tx, ty)) return false;
    if (archetype === 'TWIN_BRIDGES' && tx >= 13 && tx <= 22) return false;
    for (let i = 0; i < anchors.length; i++) {
      if (Math.abs(anchors[i]!.tx - tx) <= 1 && Math.abs(anchors[i]!.ty - ty) <= 1) return false;
    }
    return true;
  };
  for (let i = 0; i < baseSpecs.length; i++) {
    const spec = baseSpecs[i]!;
    if (spec.noJitter) {
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
    const mirroredTx = flipX ? map.cols - 1 - spec.tx : spec.tx;
    const mirroredTy = flipY ? map.rows - 1 - spec.ty : spec.ty;
    const startOffsetIdx = rng.nextInt(0, JITTER_OFFSETS.length - 2);
    let chosenTx = mirroredTx;
    let chosenTy = mirroredTy;
    let chosenDx = 0;
    let chosenDy = 0;
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
        break;
      }
    }
    anchors.push({
      id: spec.id, slotIndex: i, role: spec.role, propKind: spec.propKind,
      baseTx: mirroredTx, baseTy: mirroredTy, tx: chosenTx, ty: chosenTy,
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
  sim.spawnProp('torch_brazier', 7 * TILE_SIZE + 18, 4 * TILE_SIZE + 20);
  sim.spawnProp('torch_brazier', 28 * TILE_SIZE + 14, 4 * TILE_SIZE + 20);
  sim.spawnProp('torch_brazier', 7 * TILE_SIZE + 18, 17 * TILE_SIZE + 12);
  if (keepFourthBrazier) sim.spawnProp('torch_brazier', 28 * TILE_SIZE + 14, 17 * TILE_SIZE + 12);
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
  const roomSeed = Math.trunc(opts.roomSeed);
  const archetype = opts.archetype;
  const biome: 1 | 2 | 3 = opts.biome ?? map.biome ?? 1;
  const activeDoorSides =
    opts.activeDoorSides && opts.activeDoorSides.length > 0 ? opts.activeDoorSides : DEFAULT_DOORS;
  const flipX = (roomSeed & 1) !== 0;
  const flipY = (roomSeed & 2) !== 0;
  map.biome = biome;
  map.conveyorDirection = 1;
  map.conveyorCycleTimer = 0;
  map.conveyorWarningTimer = 0;
  map.roomArchetype = archetype;
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
  for (const dir of new Set<CardinalDir>([...DEFAULT_DOORS, ...activeDoorSides])) {
    const rect = DOOR_VESTIBULE_RECTS[dir];
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
    bridgeRows: archetype === 'TWIN_BRIDGES' ? [[5, 7], [14, 16]] : [],
    propAnchors,
  };
  map.propAnchors = propAnchors;
  map.lastLayoutResult = result;
  map.lastRoomLayout = result;
  map.rebuildSolidBoxes();
  map.mapRevision += 1;
  return result;
}
