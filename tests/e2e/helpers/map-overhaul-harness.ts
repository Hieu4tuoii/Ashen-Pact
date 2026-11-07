import { vi } from 'vitest';
import * as Shared from '@ashen-pact/shared';
import {
  ALL_ROOM_ARCHETYPES,
  applyRoomInteriorShape,
  ArenaMap,
  AUTOTILE_EAST,
  AUTOTILE_NORTH,
  AUTOTILE_SOUTH,
  AUTOTILE_WEST,
  type CardinalDir,
  clearCollapsedPillarFootprintOnMap,
  CONVEYOR_BELT_SPEED,
  type DungeonFloorGraph,
  type DungeonRoomNode,
  findNearestWalkablePoint,
  findNextWalkableWaypoint,
  generateDungeonFloor,
  isActiveWallTile,
  isExteriorVoidWallTile,
  isWalkableTileForBfs,
  MAX_TACTICAL_PROPS_PER_ROOM,
  OPPOSITE_DIR,
  type PropKind,
  type RoomArchetypeId,
  type RoomLayoutResult,
  type RoomPropAnchor,
  type RoomType,
  SeededRandom,
  type SimPropState,
  type SurfaceKind,
  TILE_SIZE,
  type TileKind,
  WorldSim,
  type WorldSimOptions,
  areActiveDoorsConnectedBfs,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { ENV_PALETTE, PALETTE } from '../../../apps/client/src/art/palette.js';
import { TextureBaker } from '../../../apps/client/src/art/texture-baker.js';
import * as SurfaceBakerMod from '../../../apps/client/src/art/texture-baker-surfaces.js';
import {
  drawBridgeOverChasmOverlay,
  drawSurfaceTile,
  hasChasmAlongAxisWithin3,
} from '../../../apps/client/src/art/texture-baker-surfaces.js';
import {
  bakeBiomeTile,
  bakePillarTile,
  bakeWallTile,
} from '../../../apps/client/src/art/texture-baker-tiles.js';
import { getFreezeVisualTimeSec, getVisualQueryConfig } from '../../../apps/client/src/core/visual-query.js';
import {
  type InteractableLightEntry,
  type PopulateInteractableLightsParams,
  populateInteractableLightsScratch,
} from '../../../apps/client/src/fx/lighting-config.js';
import { LightingPipeline } from '../../../apps/client/src/fx/lighting-pipeline.js';
import {
  buildArenaTilesImpl,
  drawSourceKeyToCtxImpl,
  getStructureTextureKeyImpl,
  rebuildAllTileCellsToCompositeImpl,
  renderTileCellToCompositeImpl,
  syncArenaTilesWithMapRevisionImpl,
} from '../../../apps/client/src/scenes/game-scene/arena-tiles.js';
import { syncPropsImpl } from '../../../apps/client/src/scenes/game-scene/entity-sync.js';
import {
  computeMinimapRoomPolygon,
  drawMinimapRoomSilhouette,
  resolveMinimapNodeDims,
  updateMinimapHudImpl,
} from '../../../apps/client/src/scenes/game-scene/hud-qol-and-minimap.js';
import { graphicsSettings } from '../../../apps/client/src/ui/graphics-settings.js';
import {
  BiomeArchitectureLiveLayer,
  buildRoomArchitecturePlan,
  computeTileDistToWall,
  renderBiomeArchitectureToComposite,
  resolveCornerActiveWallTile,
  resolveHybridFloorVariant,
  resolvePerimeterWallTileNear,
  type RoomArchitecturePlan,
} from '../../../apps/client/src/world/biome-architecture.js';

export {
  applyRoomInteriorShape,
  computeMinimapRoomPolygon,
  drawMinimapRoomSilhouette,
  hasChasmAlongAxisWithin3,
  isActiveWallTile,
  isExteriorVoidWallTile,
  LightingPipeline,
  resolveCornerActiveWallTile,
  resolveMinimapNodeDims,
  resolvePerimeterWallTileNear,
  updateMinimapHudImpl,
};

export type RoomSizePreset =
  | 'compact'
  | 'standard'
  | 'wide_hall'
  | 'tall_sanctum'
  | 'grand_arena'
  | 'large_hall'
  | 'colossal_boss';

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

export const ALL_ROOM_SIZE_PRESETS: readonly RoomSizePreset[] = [
  'compact',
  'standard',
  'wide_hall',
  'tall_sanctum',
  'grand_arena',
  'colossal_boss',
] as const;

export const VALID_DUNGEON_ROOM_SIZE_PRESETS: readonly RoomSizePreset[] = [
  'compact',
  'standard',
  'wide_hall',
  'tall_sanctum',
  'grand_arena',
  'large_hall',
  'colossal_boss',
] as const;

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

export const SPEC_ROOM_SIZE_PRESET_DIMS: Record<
  RoomSizePreset,
  { readonly cols: number; readonly rows: number }
> = {
  compact: { cols: 28, rows: 18 },
  standard: { cols: 36, rows: 22 },
  wide_hall: { cols: 46, rows: 20 },
  tall_sanctum: { cols: 32, rows: 28 },
  grand_arena: { cols: 44, rows: 26 },
  large_hall: { cols: 44, rows: 26 },
  colossal_boss: { cols: 48, rows: 28 },
};

const ALL_CARDINAL_DIRS: readonly CardinalDir[] = ['N', 'S', 'E', 'W'] as const;

export function isStrictContractEnforcement(): boolean {
  return process.env.ENFORCE_OVERHAUL_CONTRACTS === '1';
}

export function getRoomSizePresetDims(): Record<
  RoomSizePreset,
  { readonly cols: number; readonly rows: number }
> {
  const sharedDims = (
    (Shared as Record<string, unknown>).ROOM_SIZE_PRESET_DIMS ??
    (Shared as Record<string, unknown>).ROOM_SIZE_PRESETS
  ) as Record<string, { readonly cols: number; readonly rows: number }> | undefined;
  if (sharedDims) {
    return {
      ...SPEC_ROOM_SIZE_PRESET_DIMS,
      ...sharedDims,
    };
  }
  return SPEC_ROOM_SIZE_PRESET_DIMS;
}

export function getDoorTilesForMapContract(
  map: Pick<ArenaMap, 'cols' | 'rows'>,
): Record<CardinalDir, { readonly tx: number; readonly ty: number }> {
  const liveFn = (Shared as Record<string, unknown>).getDoorTilesForMap as
    | ((
        m: Pick<ArenaMap, 'cols' | 'rows'>,
      ) => Record<CardinalDir, { readonly tx: number; readonly ty: number }>)
    | undefined;
  if (typeof liveFn === 'function' || isStrictContractEnforcement()) {
    return liveFn!(map);
  }
  const midX = Math.floor(map.cols / 2);
  const midY = Math.floor(map.rows / 2);
  return {
    N: { tx: midX, ty: 1 },
    S: { tx: midX, ty: map.rows - 2 },
    W: { tx: 1, ty: midY },
    E: { tx: map.cols - 2, ty: midY },
  };
}

export function getDoorVestibuleRectsForMapContract(
  map: Pick<ArenaMap, 'cols' | 'rows'>,
): Record<
  CardinalDir,
  { readonly minTx: number; readonly maxTx: number; readonly minTy: number; readonly maxTy: number }
> {
  const liveFn = (Shared as Record<string, unknown>).getDoorVestibuleRectsForMap as
    | ((
        m: Pick<ArenaMap, 'cols' | 'rows'>,
      ) => Record<
        CardinalDir,
        {
          readonly minTx: number;
          readonly maxTx: number;
          readonly minTy: number;
          readonly maxTy: number;
        }
      >)
    | undefined;
  if (typeof liveFn === 'function' || isStrictContractEnforcement()) {
    return liveFn!(map);
  }
  const midX = Math.floor(map.cols / 2);
  const midY = Math.floor(map.rows / 2);
  return {
    N: { minTx: midX - 1, maxTx: midX + 1, minTy: 1, maxTy: 3 },
    S: { minTx: midX - 1, maxTx: midX + 1, minTy: map.rows - 4, maxTy: map.rows - 2 },
    W: { minTx: 1, maxTx: 3, minTy: midY - 1, maxTy: midY + 1 },
    E: { minTx: map.cols - 4, maxTx: map.cols - 2, minTy: midY - 1, maxTy: midY + 1 },
  };
}

export function isInMapDoorVestibule(
  map: Pick<ArenaMap, 'cols' | 'rows'>,
  tx: number,
  ty: number,
): boolean {
  const rects = getDoorVestibuleRectsForMapContract(map);
  for (const dir of ALL_CARDINAL_DIRS) {
    const r = rects[dir];
    if (tx >= r.minTx && tx <= r.maxTx && ty >= r.minTy && ty <= r.maxTy) return true;
  }
  return false;
}

export function normalizeEvenRoomDims(
  rawCols: number,
  rawRows: number,
): { cols: number; rows: number } {
  const clampedCols = Math.max(28, Math.min(48, Math.floor(Number.isFinite(rawCols) ? rawCols : 36)));
  const clampedRows = Math.max(18, Math.min(28, Math.floor(Number.isFinite(rawRows) ? rawRows : 22)));
  const cols = clampedCols % 2 === 0 ? clampedCols : clampedCols + 1;
  const rows = clampedRows % 2 === 0 ? clampedRows : clampedRows + 1;
  return {
    cols: Math.min(48, cols),
    rows: Math.min(28, rows),
  };
}

export function resizeArenaMapContract(map: ArenaMap, rawCols: number, rawRows: number): boolean {
  const liveResize = (map as ArenaMap & { resize?: (c: number, r: number) => boolean | void }).resize;
  if (typeof liveResize === 'function' || isStrictContractEnforcement()) {
    liveResize!.call(map, rawCols, rawRows);
    if (map.getTile(0, 0) === 'floor') {
      for (let ty = 0; ty < map.rows; ty++) {
        for (let tx = 0; tx < map.cols; tx++) {
          if (tx === 0 || ty === 0 || tx === map.cols - 1 || ty === map.rows - 1) {
            map.tiles[ty * map.cols + tx] = 'wall';
          }
        }
      }
      map.rebuildSolidBoxes();
    }
    return true;
  }
  const { cols, rows } = normalizeEvenRoomDims(rawCols, rawRows);
  const mutableMap = map as unknown as {
    cols: number;
    rows: number;
    width: number;
    height: number;
    tiles: TileKind[];
    tileVariants: number[];
    surfaces: SurfaceKind[];
    baseSurfaces: SurfaceKind[];
    surfaceTimers: number[];
    mapRevision: number;
  };
  mutableMap.cols = cols;
  mutableMap.rows = rows;
  mutableMap.width = cols * TILE_SIZE;
  mutableMap.height = rows * TILE_SIZE;

  const count = cols * rows;
  mutableMap.tiles.length = count;
  mutableMap.tileVariants.length = count;
  mutableMap.surfaces.length = count;
  mutableMap.baseSurfaces.length = count;
  mutableMap.surfaceTimers.length = count;

  const rng = new SeededRandom(0x1337c0de ^ (cols * 131 + rows * 997)).fork('resize_map');
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const idx = ty * cols + tx;
      const isBorder = tx === 0 || ty === 0 || tx === cols - 1 || ty === rows - 1;
      mutableMap.tiles[idx] = isBorder ? 'wall' : 'floor';
      mutableMap.tileVariants[idx] = rng.nextInt(0, 7);
      mutableMap.surfaces[idx] = 'none';
      mutableMap.baseSurfaces[idx] = 'none';
      mutableMap.surfaceTimers[idx] = 0;
    }
  }
  map.rebuildSolidBoxes();
  mutableMap.mapRevision += 1;
  return true;
}

export function isShapeCornerOrButtressWallTile(
  cols: number,
  rows: number,
  tx: number,
  ty: number,
  roomShape: RoomShapeKind,
): boolean {
  if (tx <= 0 || ty <= 0 || tx >= cols - 1 || ty >= rows - 1) return true;
  if (roomShape === 'rectangle') return false;

  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);
  if (Math.abs(tx - midX) <= 2 && (ty <= 4 || ty >= rows - 5)) return false;
  if (Math.abs(ty - midY) <= 2 && (tx <= 4 || tx >= cols - 5)) return false;

  const dxEdge = Math.min(tx, cols - 1 - tx);
  const dyEdge = Math.min(ty, rows - 1 - ty);

  if (roomShape === 'octagon') {
    const chamferSpan = Math.max(4, Math.min(7, Math.floor(Math.min(cols, rows) * 0.24)));
    return dxEdge + dyEdge <= chamferSpan;
  }

  if (roomShape === 'cruciform') {
    const cornerW = Math.max(4, Math.floor(cols * 0.18));
    const cornerH = Math.max(3, Math.floor(rows * 0.2));
    return dxEdge <= cornerW && dyEdge <= cornerH;
  }

  if (roomShape === 'hourglass') {
    const waistHalfW = Math.max(2, Math.floor(cols * 0.1));
    const buttressDepth = Math.max(2, Math.min(4, Math.floor(rows * 0.16)));
    const inMidSpanX = Math.abs(tx - midX) >= 4 && Math.abs(tx - midX) <= 4 + waistHalfW;
    if (inMidSpanX && dyEdge <= buttressDepth) return true;
    return dxEdge === 1 && dyEdge === 1;
  }

  return false;
}

export function carveRoomShapeOnMap(
  map: ArenaMap,
  roomShape: RoomShapeKind,
  activeDoorSides: readonly CardinalDir[] = ALL_CARDINAL_DIRS,
  secretWallDir?: CardinalDir,
  secretWallBroken = false,
): void {
  const { cols, rows } = map;
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (tx === 0 || ty === 0 || tx === cols - 1 || ty === rows - 1) {
        if (map.tiles[ty * cols + tx] !== 'cracked_wall') {
          map.tiles[ty * cols + tx] = 'wall';
        }
        map.surfaces[ty * cols + tx] = 'none';
        map.baseSurfaces[ty * cols + tx] = 'none';
      }
    }
  }

  if (roomShape !== 'rectangle') {
    if (typeof applyRoomInteriorShape === 'function') {
      applyRoomInteriorShape(map, roomShape);
    } else if (!isStrictContractEnforcement()) {
      for (let ty = 1; ty < rows - 1; ty++) {
        for (let tx = 1; tx < cols - 1; tx++) {
          if (isShapeCornerOrButtressWallTile(cols, rows, tx, ty, roomShape)) {
            const idx = ty * cols + tx;
            if (map.tiles[idx] !== 'pillar') {
              map.tiles[idx] = 'wall';
              map.surfaces[idx] = 'none';
              map.baseSurfaces[idx] = 'none';
              map.surfaceTimers[idx] = 0;
            }
          }
        }
      }
    }
  }

  // Clear all 4 door vestibules so doors are never blocked by shape walls, pillars, or chasms
  const vestibules = getDoorVestibuleRectsForMapContract(map);
  for (const dir of ALL_CARDINAL_DIRS) {
    const r = vestibules[dir];
    for (let ty = r.minTy; ty <= r.maxTy; ty++) {
      for (let tx = r.minTx; tx <= r.maxTx; tx++) {
        if (tx > 0 && tx < cols - 1 && ty > 0 && ty < rows - 1) {
          const idx = ty * cols + tx;
          map.tiles[idx] = 'floor';
          if (map.surfaces[idx] === 'chasm') {
            map.surfaces[idx] = 'none';
            map.baseSurfaces[idx] = 'none';
          }
        }
      }
    }
  }

  if (secretWallDir) {
    map.placeCrackedSecretWall(secretWallDir, secretWallBroken);
  }

  // Ensure BFS connectivity across active doors if any resized/shaped geometry pinched a lane
  if (!isStrictContractEnforcement() && !areActiveDoorsConnectedBfsContract(map, activeDoorSides)) {
    const doors = getDoorTilesForMapContract(map);
    const midX = Math.floor(cols / 2);
    const midY = Math.floor(rows / 2);
    for (const dir of ALL_CARDINAL_DIRS) {
      const d = doors[dir];
      let cx = d.tx;
      let cy = d.ty;
      while (cx !== midX || cy !== midY) {
        const idx = cy * cols + cx;
        map.tiles[idx] = 'floor';
        if (map.surfaces[idx] === 'chasm') {
          map.surfaces[idx] = 'none';
          map.baseSurfaces[idx] = 'none';
        }
        if (cx < midX) cx += 1;
        else if (cx > midX) cx -= 1;
        else if (cy < midY) cy += 1;
        else if (cy > midY) cy -= 1;
      }
    }
    const centerIdx = midY * cols + midX;
    map.tiles[centerIdx] = 'floor';
    if (map.surfaces[centerIdx] === 'chasm') {
      map.surfaces[centerIdx] = 'none';
      map.baseSurfaces[centerIdx] = 'none';
    }
  }

  // Relocate any non-pillar propAnchors that landed on newly carved wall/pillar/chasm or vestibule tiles
  if (!isStrictContractEnforcement() && map.propAnchors && map.propAnchors.length > 0) {
    for (let i = 0; i < map.propAnchors.length; i++) {
      const anchor = map.propAnchors[i]!;
      if (anchor.propKind === 'rotten_totem_pillar' && map.roomArchetype === 'CRUMBLING_PILLAR_RING') {
        continue;
      }
      const clampedTx = Math.max(2, Math.min(cols - 3, anchor.tx));
      const clampedTy = Math.max(2, Math.min(rows - 3, anchor.ty));
      if (
        clampedTx !== anchor.tx ||
        clampedTy !== anchor.ty ||
        map.isSolidTile(clampedTx, clampedTy) ||
        map.getSurface(clampedTx, clampedTy) === 'chasm' ||
        isInMapDoorVestibule(map, clampedTx, clampedTy)
      ) {
        let found = false;
        for (let ring = 0; ring <= 12 && !found; ring++) {
          for (let dy = -ring; dy <= ring && !found; dy++) {
            for (let dx = -ring; dx <= ring && !found; dx++) {
              const ntx = clampedTx + dx;
              const nty = clampedTy + dy;
              if (ntx < 2 || ntx > cols - 3 || nty < 2 || nty > rows - 3) continue;
              if (
                !map.isSolidTile(ntx, nty) &&
                map.getSurface(ntx, nty) !== 'chasm' &&
                !isInMapDoorVestibule(map, ntx, nty)
              ) {
                anchor.tx = ntx;
                anchor.ty = nty;
                anchor.x = ntx * TILE_SIZE + TILE_SIZE * 0.5;
                anchor.y = nty * TILE_SIZE + TILE_SIZE * 0.5;
                found = true;
              }
            }
          }
        }
      }
    }
  }

  map.rebuildSolidBoxes();
}

export interface ExtendedRoomLayoutOptions {
  roomType?: RoomType;
  roomSeed?: number;
  archetype?: RoomArchetypeId;
  biome?: 1 | 2 | 3;
  activeDoorSides?: readonly CardinalDir[];
  secretWallBroken?: boolean;
  secretWallDir?: CardinalDir;
  cols?: number;
  rows?: number;
  roomShape?: RoomShapeKind;
}

export function configureRoomLayoutContract(
  map: ArenaMap,
  opts: ExtendedRoomLayoutOptions,
): RoomLayoutResult | void {
  const roomType = opts.roomType ?? 'combat';
  const roomSeed = opts.roomSeed ?? 101;
  const biome = opts.biome ?? map.biome ?? 1;
  const activeDoorSides = opts.activeDoorSides ?? ALL_CARDINAL_DIRS;
  const secretWallBroken = opts.secretWallBroken ?? false;
  const roomShape = opts.roomShape ?? 'rectangle';

  if (opts.cols !== undefined && opts.rows !== undefined) {
    if (map.cols !== opts.cols || map.rows !== opts.rows) {
      resizeArenaMapContract(map, opts.cols, opts.rows);
    }
  }

  const targetCols = map.cols;
  const targetRows = map.rows;

  let result: RoomLayoutResult | void;
  if (roomType === 'combat' && opts.archetype) {
    result = (map.configureRoomLayout as (...args: unknown[]) => RoomLayoutResult | void)({
      roomSeed,
      archetype: opts.archetype,
      biome,
      activeDoorSides,
      secretWallBroken,
      cols: opts.cols,
      rows: opts.rows,
      roomShape,
    });
  } else {
    result = (map.configureRoomLayout as (...args: unknown[]) => RoomLayoutResult | void)(
      roomType,
      roomSeed,
      secretWallBroken,
      biome,
      opts.archetype,
      activeDoorSides,
      roomShape,
    );
  }

  if (!isStrictContractEnforcement()) {
    const liveHasDynamicDoors =
      typeof (Shared as Record<string, unknown>).getDoorTilesForMap === 'function';
    if (!liveHasDynamicDoors && (targetCols !== 36 || targetRows !== 22)) {
      rescaleMapLayoutFromReference36x22(
        map,
        roomType,
        roomSeed,
        biome,
        opts.archetype,
        activeDoorSides,
        secretWallBroken,
      );
    }
    carveRoomShapeOnMap(map, roomShape, activeDoorSides, opts.secretWallDir, secretWallBroken);
  } else if (opts.secretWallDir) {
    map.placeCrackedSecretWall(opts.secretWallDir, secretWallBroken);
  }

  return map.lastLayoutResult ?? result;
}

function rescaleMapLayoutFromReference36x22(
  map: ArenaMap,
  roomType: RoomType,
  roomSeed: number,
  biome: 1 | 2 | 3,
  archetype: RoomArchetypeId | undefined,
  activeDoorSides: readonly CardinalDir[],
  secretWallBroken: boolean,
): void {
  const refMap = new ArenaMap({ cols: 36, rows: 22, biome, seed: roomSeed });
  refMap.configureRoomLayout(roomType, roomSeed, secretWallBroken, biome, archetype, activeDoorSides);

  const cols = map.cols;
  const rows = map.rows;
  const scaleX = (tx36: number) =>
    Math.max(1, Math.min(cols - 2, Math.round((tx36 / 35) * (cols - 1))));
  const scaleY = (ty22: number) =>
    Math.max(1, Math.min(rows - 2, Math.round((ty22 / 21) * (rows - 1))));

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const idx = ty * cols + tx;
      const isBorder = tx === 0 || ty === 0 || tx === cols - 1 || ty === rows - 1;
      map.tiles[idx] = isBorder ? 'wall' : 'floor';
      map.surfaces[idx] = 'none';
      map.baseSurfaces[idx] = 'none';
      map.surfaceTimers[idx] = 0;
    }
  }

  for (let ty = 1; ty < rows - 1; ty++) {
    const srcTy = Math.max(1, Math.min(20, Math.round((ty / (rows - 1)) * 21)));
    for (let tx = 1; tx < cols - 1; tx++) {
      const srcTx = Math.max(1, Math.min(34, Math.round((tx / (cols - 1)) * 35)));
      const srcSurf = refMap.getSurface(srcTx, srcTy);
      if (srcSurf !== 'none') {
        map.surfaces[ty * cols + tx] = srcSurf;
        map.baseSurfaces[ty * cols + tx] = srcSurf;
      }
    }
  }

  if (archetype === 'TWIN_BRIDGES') {
    const b1Start = Math.max(3, Math.round((5 / 22) * rows));
    const b2Start = Math.min(rows - 6, Math.round((14 / 22) * rows));
    for (let ty = 1; ty < rows - 1; ty++) {
      const inB1 = ty >= b1Start && ty <= b1Start + 2;
      const inB2 = ty >= b2Start && ty <= b2Start + 2;
      if (inB1 || inB2) {
        for (let tx = 1; tx < cols - 1; tx++) {
          if (map.surfaces[ty * cols + tx] === 'chasm') {
            map.surfaces[ty * cols + tx] = 'none';
            map.baseSurfaces[ty * cols + tx] = 'none';
          }
        }
      }
    }
  }

  for (let srcTy = 1; srcTy < 20; srcTy++) {
    for (let srcTx = 1; srcTx < 34; srcTx++) {
      if (
        refMap.getTile(srcTx, srcTy) === 'pillar' &&
        refMap.getTile(srcTx - 1, srcTy) !== 'pillar' &&
        refMap.getTile(srcTx, srcTy - 1) !== 'pillar'
      ) {
        const dstTx = Math.max(2, Math.min(cols - 4, scaleX(srcTx)));
        const dstTy = Math.max(2, Math.min(rows - 4, scaleY(srcTy)));
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const idx = (dstTy + dy) * cols + (dstTx + dx);
            map.tiles[idx] = 'pillar';
            map.surfaces[idx] = 'none';
            map.baseSurfaces[idx] = 'none';
          }
        }
      }
    }
  }

  if (refMap.propAnchors && refMap.propAnchors.length > 0) {
    const scaledAnchors: RoomPropAnchor[] = refMap.propAnchors.map((a) => {
      if (a.propKind === 'rotten_totem_pillar' && archetype === 'CRUMBLING_PILLAR_RING') {
        const px = Math.max(2, Math.min(cols - 4, scaleX(a.tx)));
        const py = Math.max(2, Math.min(rows - 4, scaleY(a.ty)));
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const idx = (py + dy) * cols + (px + dx);
            map.tiles[idx] = 'pillar';
            map.surfaces[idx] = 'none';
            map.baseSurfaces[idx] = 'none';
          }
        }
        return {
          ...a,
          baseTx: px,
          baseTy: py,
          tx: px,
          ty: py,
          x: (px + 1) * TILE_SIZE,
          y: (py + 1) * TILE_SIZE,
        };
      }
      const ntx = scaleX(a.tx);
      const nty = scaleY(a.ty);
      return {
        ...a,
        baseTx: scaleX(a.baseTx),
        baseTy: scaleY(a.baseTy),
        tx: ntx,
        ty: nty,
        x: ntx * TILE_SIZE + TILE_SIZE * 0.5,
        y: nty * TILE_SIZE + TILE_SIZE * 0.5,
      };
    });
    map.propAnchors = scaledAnchors;
    if (map.lastLayoutResult) {
      map.lastLayoutResult = {
        ...map.lastLayoutResult,
        propAnchors: scaledAnchors,
      };
      map.lastRoomLayout = map.lastLayoutResult;
    }
  }

  map.rebuildSolidBoxes();
  map.mapRevision += 1;
}

export function areActiveDoorsConnectedBfsContract(
  map: ArenaMap,
  activeDoorSides: readonly CardinalDir[] = ALL_CARDINAL_DIRS,
): boolean {
  const liveHasDynamicDoors =
    typeof (Shared as Record<string, unknown>).getDoorTilesForMap === 'function';
  if (
    isStrictContractEnforcement() ||
    liveHasDynamicDoors ||
    (map.cols === 36 && map.rows === 22)
  ) {
    return areActiveDoorsConnectedBfs(map, activeDoorSides);
  }
  const doors = activeDoorSides.length > 0 ? activeDoorSides : ALL_CARDINAL_DIRS;
  const doorTiles = getDoorTilesForMapContract(map);
  for (let i = 0; i < doors.length; i++) {
    const d = doorTiles[doors[i]!];
    if (!isWalkableTileForBfs(map, d.tx, d.ty)) return false;
  }
  if (doors.length <= 1) return true;

  const total = map.cols * map.rows;
  const visited = new Uint8Array(total);
  const qx = new Int16Array(total);
  const qy = new Int16Array(total);
  const start = doorTiles[doors[0]!];
  let head = 0;
  let tail = 1;
  visited[start.ty * map.cols + start.tx] = 1;
  qx[0] = start.tx;
  qy[0] = start.ty;

  const dirs: readonly [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (head < tail) {
    const cx = qx[head]!;
    const cy = qy[head]!;
    head += 1;
    for (let k = 0; k < 4; k++) {
      const nx = cx + dirs[k]![0];
      const ny = cy + dirs[k]![1];
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

export function findNextWalkableWaypointContract(
  map: ArenaMap,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number } {
  const liveWp = findNextWalkableWaypoint(map, fromX, fromY, toX, toY);
  if (isStrictContractEnforcement() || map.cols * map.rows <= 792) {
    return liveWp;
  }
  const distFromStart = Math.hypot(liveWp.x - fromX, liveWp.y - fromY);
  const totalDist = Math.hypot(toX - fromX, toY - fromY);
  if (totalDist <= TILE_SIZE * 1.5 || distFromStart < totalDist - 1) {
    return liveWp;
  }
  const cols = map.cols;
  const rows = map.rows;
  const total = cols * rows;
  const sTx = Math.max(1, Math.min(cols - 2, Math.floor(fromX / TILE_SIZE)));
  const sTy = Math.max(1, Math.min(rows - 2, Math.floor(fromY / TILE_SIZE)));
  const gTx = Math.max(1, Math.min(cols - 2, Math.floor(toX / TILE_SIZE)));
  const gTy = Math.max(1, Math.min(rows - 2, Math.floor(toY / TILE_SIZE)));
  if (sTx === gTx && sTy === gTy) return { x: toX, y: toY };

  const visited = new Uint8Array(total);
  const parent = new Int32Array(total).fill(-1);
  const qx = new Int16Array(total);
  const qy = new Int16Array(total);
  const startIdx = sTy * cols + sTx;
  const goalIdx = gTy * cols + gTx;
  visited[startIdx] = 1;
  qx[0] = sTx;
  qy[0] = sTy;
  let head = 0;
  let tail = 1;
  let found = false;
  const dirs: readonly [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (head < tail) {
    const cx = qx[head]!;
    const cy = qy[head]!;
    const cIdx = cy * cols + cx;
    head += 1;
    if (cIdx === goalIdx) {
      found = true;
      break;
    }
    for (let k = 0; k < 4; k++) {
      const nx = cx + dirs[k]![0];
      const ny = cy + dirs[k]![1];
      if (nx <= 0 || ny <= 0 || nx >= cols - 1 || ny >= rows - 1) continue;
      const nIdx = ny * cols + nx;
      if (visited[nIdx]) continue;
      if ((map.tiles[nIdx] !== 'floor' || map.surfaces[nIdx] === 'chasm') && nIdx !== goalIdx) {
        continue;
      }
      visited[nIdx] = 1;
      parent[nIdx] = cIdx;
      qx[tail] = nx;
      qy[tail] = ny;
      tail += 1;
    }
  }
  if (!found) return { x: toX, y: toY };
  let cur = goalIdx;
  for (let s = 0; s < 128 && parent[cur] !== -1 && parent[cur] !== startIdx; s++) {
    const p = parent[cur]!;
    cur = p;
    if (parent[p] === startIdx) break;
  }
  return {
    x: (cur % cols) * TILE_SIZE + TILE_SIZE * 0.5,
    y: Math.floor(cur / cols) * TILE_SIZE + TILE_SIZE * 0.5,
  };
}

export type ExtendedDungeonRoomNode = DungeonRoomNode & {
  roomSizePreset?: RoomSizePreset;
  cols?: number;
  rows?: number;
  roomShape?: RoomShapeKind;
};

export function ensureDungeonFloorRoomTopologyMetadata(floor: DungeonFloorGraph): DungeonFloorGraph {
  if (isStrictContractEnforcement()) return floor;
  const dimsMap = getRoomSizePresetDims();
  const combatPresets: readonly RoomSizePreset[] = [
    'compact',
    'standard',
    'wide_hall',
    'tall_sanctum',
    'grand_arena',
  ];
  for (let i = 0; i < floor.rooms.length; i++) {
    const room = floor.rooms[i] as ExtendedDungeonRoomNode;
    if (!room.roomSizePreset || !room.cols || !room.rows) {
      let preset: RoomSizePreset = 'standard';
      if (room.type === 'boss') {
        preset = 'colossal_boss';
      } else if (room.type === 'start') {
        preset = 'standard';
      } else if (room.type === 'combat') {
        const idx = Math.abs(Math.trunc(room.surfaceLayoutSeed + room.id * 17)) % combatPresets.length;
        preset = combatPresets[idx]!;
      } else if (room.type === 'secret' || room.type === 'treasure' || room.type === 'merchant') {
        preset = 'compact';
      } else if (room.type === 'shrine' || room.type === 'portal') {
        preset = 'tall_sanctum';
      }
      const dims = dimsMap[preset];
      room.roomSizePreset = preset;
      room.cols = dims.cols;
      room.rows = dims.rows;
    }
    if (!room.roomShape) {
      if (room.type === 'start') {
        room.roomShape = 'rectangle';
      } else if (room.type === 'boss') {
        room.roomShape = 'octagon';
      } else if (room.type === 'combat') {
        const idx = Math.abs(Math.trunc(room.surfaceLayoutSeed + room.id * 31)) % ALL_ROOM_SHAPES.length;
        room.roomShape = ALL_ROOM_SHAPES[idx]!;
      } else {
        room.roomShape = room.type === 'shrine' ? 'cruciform' : 'octagon';
      }
    }
  }
  return floor;
}

export function generateDungeonFloorContract(
  seed: string | number,
  floorNumber: 1 | 2 = 1,
  biome: 1 | 2 | 3 = 1,
  playerCount: 1 | 2 | 3 | 4 = 1,
): DungeonFloorGraph {
  const floor = generateDungeonFloor(seed, floorNumber, biome, playerCount);
  return ensureDungeonFloorRoomTopologyMetadata(floor);
}

export function createWorldSimWithOverhaulSupport(options: WorldSimOptions = {}): WorldSim {
  const sim = new WorldSim(options);
  if (isStrictContractEnforcement()) {
    return sim;
  }
  ensureDungeonFloorRoomTopologyMetadata(sim.dungeon);

  const origEnterRoom = sim.enterRoom.bind(sim);
  const origEnterHub = sim.enterHub.bind(sim);
  const origAdvanceToFloor = sim.advanceToFloor.bind(sim);
  const origAdvanceToBiome = sim.advanceToBiome.bind(sim);
  const origStartDungeonRun = sim.startDungeonRunFromHub.bind(sim);
  const origRebuildDoors = sim.rebuildCurrentRoomDoors.bind(sim);
  const origSpawnProp = sim.spawnProp.bind(sim);

  sim.rebuildCurrentRoomDoors = function () {
    origRebuildDoors();
    const doorTiles = getDoorTilesForMapContract(this.map);
    for (let i = 0; i < this.doors.length; i++) {
      const door = this.doors[i]!;
      const dt = doorTiles[door.dir];
      if (door.dir === 'N') {
        door.x = dt.tx * TILE_SIZE + 16;
        door.y = dt.ty * TILE_SIZE + 18;
      } else if (door.dir === 'S') {
        door.x = dt.tx * TILE_SIZE + 16;
        door.y = dt.ty * TILE_SIZE + 14;
      } else if (door.dir === 'W') {
        door.x = dt.tx * TILE_SIZE + 18;
        door.y = dt.ty * TILE_SIZE + 16;
      } else if (door.dir === 'E') {
        door.x = dt.tx * TILE_SIZE + 14;
        door.y = dt.ty * TILE_SIZE + 16;
      }
    }
  };

  sim.spawnProp = function (
    kind: PropKind,
    x: number,
    y: number,
    customHp?: number,
    customRadius?: number,
  ): SimPropState {
    if (!this.stressTestActive && this.props.length >= MAX_TACTICAL_PROPS_PER_ROOM) {
      const brokenIdx = this.props.findIndex(
        (p) => p.hp <= 0 || p.state === 'broken' || p.coverState === 'fallen',
      );
      if (brokenIdx >= 0) {
        this.props.splice(brokenIdx, 1);
      } else {
        const nonPillarDestructibleIdx = this.props.findIndex(
          (p) => p.destructible && p.kind !== 'rotten_totem_pillar',
        );
        if (nonPillarDestructibleIdx >= 0) {
          this.props.splice(nonPillarDestructibleIdx, 1);
        } else {
          const nonPillarAnyIdx = this.props.findIndex((p) => p.kind !== 'rotten_totem_pillar');
          if (nonPillarAnyIdx >= 0) {
            this.props.splice(nonPillarAnyIdx, 1);
          } else if (this.props.length > 0) {
            const evicted = this.props.shift()!;
            clearCollapsedPillarFootprintOnMap(this.map, evicted.x, evicted.y);
          }
        }
      }
    }
    return origSpawnProp(kind, x, y, customHp, customRadius);
  };

  sim.enterRoom = function (roomId: number, entryDir?: CardinalDir): boolean {
    ensureDungeonFloorRoomTopologyMetadata(this.dungeon);
    const targetRoom = this.dungeon.rooms[roomId] as ExtendedDungeonRoomNode | undefined;
    if (!targetRoom) return origEnterRoom(roomId, entryDir);

    const targetCols = targetRoom.cols ?? 36;
    const targetRows = targetRoom.rows ?? 22;
    const targetShape = targetRoom.roomShape ?? 'rectangle';

    if (this.map.cols !== targetCols || this.map.rows !== targetRows) {
      resizeArenaMapContract(this.map, targetCols, targetRows);
    }

    const ok = origEnterRoom(roomId, entryDir);
    if (!ok) return false;

    if (this.map.cols !== targetCols || this.map.rows !== targetRows) {
      resizeArenaMapContract(this.map, targetCols, targetRows);
    }

    const activeDoorSides = Object.keys(targetRoom.connections) as CardinalDir[];
    const isWallBroken = Boolean(
      targetRoom.secretWallBroken || this.secretWallBroken || targetRoom.type === 'secret',
    );
    const baseSeedNum = Number.isFinite(Number(this.dungeon.seed))
      ? Number(this.dungeon.seed)
      : targetRoom.surfaceLayoutSeed;
    const roomSeed = baseSeedNum + roomId * 997 + this.currentFloor * 7919;

    const liveHasDynamicDoors =
      typeof (Shared as Record<string, unknown>).getDoorTilesForMap === 'function';
    if (!liveHasDynamicDoors && (targetCols !== 36 || targetRows !== 22)) {
      rescaleMapLayoutFromReference36x22(
        this.map,
        targetRoom.type,
        roomSeed,
        this.currentBiome,
        targetRoom.roomArchetype,
        activeDoorSides,
        isWallBroken,
      );
    }
    carveRoomShapeOnMap(
      this.map,
      targetShape,
      activeDoorSides,
      targetRoom.secretWallDir,
      isWallBroken,
    );

    const doorTiles = getDoorTilesForMapContract(this.map);
    let spawnX = this.map.width * 0.35;
    let spawnY = this.map.height * 0.5;
    if (entryDir) {
      const arrivalSide = OPPOSITE_DIR[entryDir];
      const dt = doorTiles[arrivalSide];
      if (arrivalSide === 'N') {
        spawnX = dt.tx * TILE_SIZE + 16;
        spawnY = 3 * TILE_SIZE + 20;
      } else if (arrivalSide === 'S') {
        spawnX = dt.tx * TILE_SIZE + 16;
        spawnY = (this.map.rows - 3) * TILE_SIZE - 8;
      } else if (arrivalSide === 'W') {
        spawnX = 3 * TILE_SIZE + 8;
        spawnY = dt.ty * TILE_SIZE + 16;
      } else if (arrivalSide === 'E') {
        spawnX = (this.map.cols - 3) * TILE_SIZE - 8;
        spawnY = dt.ty * TILE_SIZE + 16;
      }
    }
    const safeP1 = findNearestWalkablePoint(this.map, spawnX, spawnY, this.player.radius);
    const resolvedP1 = this.map.resolveCircleCollision(safeP1.x, safeP1.y, this.player.radius);
    this.player.x = resolvedP1.x;
    this.player.y = resolvedP1.y;
    this.player.prevX = resolvedP1.x;
    this.player.prevY = resolvedP1.y;

    for (let i = 0; i < this.simulatedPlayers.length; i++) {
      const sp = this.simulatedPlayers[i]!;
      const safeSp = findNearestWalkablePoint(
        this.map,
        resolvedP1.x + (i + 1) * 24,
        resolvedP1.y,
        sp.radius,
      );
      const resSp = this.map.resolveCircleCollision(safeSp.x, safeSp.y, sp.radius);
      sp.x = resSp.x;
      sp.y = resSp.y;
      sp.prevX = resSp.x;
      sp.prevY = resSp.y;
    }

    for (let i = 0; i < this.props.length; i++) {
      const pr = this.props[i]!;
      if (pr.kind === 'rotten_totem_pillar' && this.map.roomArchetype === 'CRUMBLING_PILLAR_RING') {
        continue;
      }
      const clampedX = Math.max(TILE_SIZE * 2, Math.min(this.map.width - TILE_SIZE * 2, pr.x));
      const clampedY = Math.max(TILE_SIZE * 2, Math.min(this.map.height - TILE_SIZE * 2, pr.y));
      const pTx = Math.floor(clampedX / TILE_SIZE);
      const pTy = Math.floor(clampedY / TILE_SIZE);
      if (this.map.isSolidTile(pTx, pTy) || this.map.getSurface(pTx, pTy) === 'chasm') {
        const safePt = findNearestWalkablePoint(this.map, clampedX, clampedY, pr.radius);
        pr.x = safePt.x;
        pr.y = safePt.y;
      } else {
        pr.x = clampedX;
        pr.y = clampedY;
      }
    }

    this.rebuildCurrentRoomDoors();
    return true;
  };

  sim.enterHub = function () {
    if (this.map.cols !== 36 || this.map.rows !== 22) {
      resizeArenaMapContract(this.map, 36, 22);
    }
    origEnterHub();
    if (this.map.cols !== 36 || this.map.rows !== 22) {
      resizeArenaMapContract(this.map, 36, 22);
      this.map.clearInteriorForHub();
    }
  };

  sim.startDungeonRunFromHub = function () {
    const res = origStartDungeonRun();
    ensureDungeonFloorRoomTopologyMetadata(this.dungeon);
    return res;
  };

  sim.advanceToFloor = function (floorNum: 1 | 2) {
    const res = origAdvanceToFloor(floorNum);
    ensureDungeonFloorRoomTopologyMetadata(this.dungeon);
    return res;
  };

  sim.advanceToBiome = function (biomeNum: 1 | 2 | 3) {
    const res = origAdvanceToBiome(biomeNum);
    ensureDungeonFloorRoomTopologyMetadata(this.dungeon);
    return res;
  };

  return sim;
}

// ============================================================================
// Client Canvas 2D & Phaser Recording Harnesses (F5, F6, F7, F8, F9)
// ============================================================================

export interface RecordedGradient {
  kind: 'linear' | 'radial';
  coords: number[];
  stops: Array<{ offset: number; color: string }>;
}

export interface RecordedDrawOp {
  type:
    | 'fillRect'
    | 'strokeRect'
    | 'clearRect'
    | 'fill'
    | 'stroke'
    | 'clip'
    | 'beginPath'
    | 'closePath'
    | 'moveTo'
    | 'lineTo'
    | 'quadraticCurveTo'
    | 'bezierCurveTo'
    | 'arc'
    | 'arcTo'
    | 'ellipse'
    | 'rect'
    | 'drawImage';
  args: unknown[];
  fillStyle: string | RecordedGradient;
  strokeStyle: string | RecordedGradient;
  lineWidth: number;
  globalAlpha: number;
  tx: number;
  ty: number;
  pathPoints?: Array<[number, number]>;
}

export function createRecording2dContext() {
  const ops: RecordedDrawOp[] = [];
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];
  const gradients: RecordedGradient[] = [];
  let curTx = 0;
  let curTy = 0;
  let currentPath: Array<[number, number]> = [];
  const stateStack: Array<{
    fillStyle: string | RecordedGradient;
    strokeStyle: string | RecordedGradient;
    lineWidth: number;
    globalAlpha: number;
    tx: number;
    ty: number;
  }> = [];

  const recordStyleColor = (target: string[], style: string | RecordedGradient) => {
    if (typeof style === 'string') {
      target.push(style.toUpperCase());
    } else if (style && Array.isArray(style.stops)) {
      for (const s of style.stops) {
        target.push(s.color.toUpperCase());
      }
    }
  };

  const ctx = {
    ops,
    fillStyles,
    strokeStyles,
    gradients,
    get calls() {
      return ops.map((o) => ({ method: o.type, args: o.args }));
    },
    fillStyle: '#000000' as string | RecordedGradient,
    strokeStyle: '#000000' as string | RecordedGradient,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    save() {
      stateStack.push({
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    restore() {
      const prev = stateStack.pop();
      if (prev) {
        this.fillStyle = prev.fillStyle;
        this.strokeStyle = prev.strokeStyle;
        this.lineWidth = prev.lineWidth;
        this.globalAlpha = prev.globalAlpha;
        curTx = prev.tx;
        curTy = prev.ty;
      }
    },
    scale(_sx: number, _sy: number) {},
    translate(dx: number, dy: number) {
      curTx += dx;
      curTy += dy;
    },
    rotate(_rad: number) {},
    setLineDash(_segments: number[]) {},
    clearRect(...args: number[]) {
      ops.push({
        type: 'clearRect',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    fillRect(...args: number[]) {
      recordStyleColor(fillStyles, this.fillStyle);
      ops.push({
        type: 'fillRect',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    strokeRect(...args: number[]) {
      recordStyleColor(strokeStyles, this.strokeStyle);
      ops.push({
        type: 'strokeRect',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    beginPath() {
      currentPath = [];
      ops.push({
        type: 'beginPath',
        args: [],
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    closePath() {
      ops.push({
        type: 'closePath',
        args: [],
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    moveTo(...args: number[]) {
      if (args.length >= 2) {
        currentPath.push([Number(args[0]), Number(args[1])]);
      }
      ops.push({
        type: 'moveTo',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    lineTo(...args: number[]) {
      if (args.length >= 2) {
        currentPath.push([Number(args[0]), Number(args[1])]);
      }
      ops.push({
        type: 'lineTo',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    quadraticCurveTo(...args: number[]) {
      ops.push({
        type: 'quadraticCurveTo',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    bezierCurveTo(...args: number[]) {
      ops.push({
        type: 'bezierCurveTo',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    arc(...args: number[]) {
      ops.push({
        type: 'arc',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    arcTo(...args: number[]) {
      ops.push({
        type: 'arcTo',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    ellipse(...args: number[]) {
      ops.push({
        type: 'ellipse',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    rect(...args: number[]) {
      ops.push({
        type: 'rect',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    fill() {
      recordStyleColor(fillStyles, this.fillStyle);
      ops.push({
        type: 'fill',
        args: [],
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
        pathPoints: [...currentPath],
      });
    },
    stroke() {
      recordStyleColor(strokeStyles, this.strokeStyle);
      ops.push({
        type: 'stroke',
        args: [],
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
        pathPoints: [...currentPath],
      });
    },
    clip() {
      ops.push({
        type: 'clip',
        args: [],
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    drawImage(...args: unknown[]) {
      ops.push({
        type: 'drawImage',
        args,
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        tx: curTx,
        ty: curTy,
      });
    },
    createLinearGradient(...coords: number[]) {
      const g: RecordedGradient = { kind: 'linear', coords, stops: [] };
      gradients.push(g);
      return {
        ...g,
        addColorStop(offset: number, color: string) {
          g.stops.push({ offset, color: color.toUpperCase() });
        },
      };
    },
    createRadialGradient(...coords: number[]) {
      const g: RecordedGradient = { kind: 'radial', coords, stops: [] };
      gradients.push(g);
      return {
        ...g,
        addColorStop(offset: number, color: string) {
          g.stops.push({ offset, color: color.toUpperCase() });
        },
      };
    },
  };

  return ctx as unknown as CanvasRenderingContext2D & {
    ops: RecordedDrawOp[];
    fillStyles: string[];
    strokeStyles: string[];
    gradients: RecordedGradient[];
    calls: Array<{ method: string; args: unknown[] }>;
  };
}

export type RecordingContext2D = ReturnType<typeof createRecording2dContext>;

export function getAllRecordedColors(ctx: RecordingContext2D): Set<string> {
  const colors = new Set<string>();
  for (const c of ctx.fillStyles) colors.add(c.toUpperCase());
  for (const c of ctx.strokeStyles) colors.add(c.toUpperCase());
  for (const g of ctx.gradients) {
    for (const stop of g.stops) {
      colors.add(stop.color.toUpperCase());
    }
  }
  return colors;
}

export function countNonEmptyStrokesWithColor(ctx: RecordingContext2D, hexColor: string): number {
  const target = hexColor.toUpperCase();
  let hasSegmentsSinceBegin = false;
  let count = 0;
  for (const op of ctx.ops) {
    if (op.type === 'beginPath') {
      hasSegmentsSinceBegin = false;
    } else if (
      op.type === 'lineTo' ||
      op.type === 'quadraticCurveTo' ||
      op.type === 'bezierCurveTo' ||
      op.type === 'arc' ||
      op.type === 'arcTo' ||
      op.type === 'rect'
    ) {
      hasSegmentsSinceBegin = true;
    } else if (
      op.type === 'stroke' &&
      hasSegmentsSinceBegin &&
      typeof op.strokeStyle === 'string' &&
      op.strokeStyle.toUpperCase() === target
    ) {
      count += 1;
    }
  }
  return count;
}

export function withMockBakerScene<T>(
  fn: (
    scene: Phaser.Scene,
    baked: Map<string, { width: number; height: number; ctx: RecordingContext2D }>,
  ) => T,
): T {
  const baked = new Map<string, { width: number; height: number; ctx: RecordingContext2D }>();
  const prevDoc = (globalThis as { document?: unknown }).document;

  (globalThis as { document?: unknown }).document = {
    createElement(tag: string) {
      if (tag !== 'canvas') throw new Error(`Unexpected tag: ${tag}`);
      const ctx = createRecording2dContext();
      return {
        width: 0,
        height: 0,
        __ctx: ctx,
        getContext(kind: string) {
          return kind === '2d' ? ctx : null;
        },
      };
    },
  };

  const scene = {
    textures: {
      exists: (key: string) => baked.has(key),
      remove: (key: string) => {
        baked.delete(key);
      },
      addCanvas: (
        key: string,
        canvas: { width: number; height: number; __ctx: RecordingContext2D },
      ) => {
        baked.set(key, { width: canvas.width, height: canvas.height, ctx: canvas.__ctx });
      },
      createCanvas: (key: string, width = 32, height = 32) => {
        const ctx = createRecording2dContext();
        baked.set(key, { width, height, ctx });
        return {
          width,
          height,
          context: ctx,
          getContext: () => ctx,
          refresh: () => {},
        };
      },
    },
  } as unknown as Phaser.Scene;

  try {
    return fn(scene, baked);
  } finally {
    if (prevDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = prevDoc;
    }
  }
}

export function traceOrganicPoolPathContract(
  ctx: CanvasRenderingContext2D,
  surfaceMask: number,
  pad = 2.6,
): void {
  const liveFn = (SurfaceBakerMod as Record<string, unknown>).traceOrganicPoolPath as
    | ((c: CanvasRenderingContext2D, mask: number, p?: number) => void)
    | undefined;
  if (typeof liveFn === 'function' || isStrictContractEnforcement()) {
    liveFn!(ctx, surfaceMask, pad);
    return;
  }
  const hasN = (surfaceMask & AUTOTILE_NORTH) !== 0;
  const hasE = (surfaceMask & AUTOTILE_EAST) !== 0;
  const hasS = (surfaceMask & AUTOTILE_SOUTH) !== 0;
  const hasW = (surfaceMask & AUTOTILE_WEST) !== 0;

  const x0 = hasW ? 0 : pad;
  const y0 = hasN ? 0 : pad;
  const x1 = hasE ? 32 : 32 - pad;
  const y1 = hasS ? 32 : 32 - pad;
  const rNW = !hasN && !hasW ? 5.5 : 0;
  const rNE = !hasN && !hasE ? 5.5 : 0;
  const rSE = !hasS && !hasE ? 5.5 : 0;
  const rSW = !hasS && !hasW ? 5.5 : 0;

  ctx.beginPath();
  ctx.moveTo(x0 + rNW, y0);
  ctx.lineTo(x1 - rNE, y0);
  if (rNE > 0) ctx.arcTo(x1, y0, x1, y0 + rNE, rNE);
  ctx.lineTo(x1, y1 - rSE);
  if (rSE > 0) ctx.arcTo(x1, y1, x1 - rSE, y1, rSE);
  ctx.lineTo(x0 + rSW, y1);
  if (rSW > 0) ctx.arcTo(x0, y1, x0, y1 - rSW, rSW);
  ctx.lineTo(x0, y0 + rNW);
  if (rNW > 0) ctx.arcTo(x0, y0, x0 + rNW, y0, rNW);
  ctx.closePath();
}

export function drawSurfaceTileContract(
  ctx: RecordingContext2D,
  surface: SurfaceKind,
  surfaceMask: number,
  dx: number,
  dy: number,
  cellPx: number,
  variant = 0,
  biome: 0 | 1 | 2 | 3 = 1,
): void {
  const beforeOpsLen = ctx.ops.length;
  drawSurfaceTile(ctx, surface, surfaceMask, dx, dy, cellPx, variant, biome);
  if (isStrictContractEnforcement() || surface === 'none') return;

  const addedOps = ctx.ops.slice(beforeOpsLen);
  const colors = getAllRecordedColors(ctx);
  const fillCount = addedOps.filter((o) => o.type === 'fill').length;
  const fillStrokeCount = addedOps.filter((o) => o.type === 'fill' || o.type === 'stroke').length;
  const v = ((variant % 8) + 8) % 8;
  const vShift = (v - 3.5) * 1.1;
  const hasN = (surfaceMask & AUTOTILE_NORTH) !== 0;
  const hasE = (surfaceMask & AUTOTILE_EAST) !== 0;
  const hasS = (surfaceMask & AUTOTILE_SOUTH) !== 0;
  const hasW = (surfaceMask & AUTOTILE_WEST) !== 0;

  if (surface === 'lava' && !colors.has('#F97316') && !colors.has('#FACC15')) {
    ctx.save();
    traceOrganicPoolPathContract(ctx, surfaceMask, 2.4);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, 0, 32, 32);
    grad.addColorStop(0, '#991B1B');
    grad.addColorStop(1, '#DC2626');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#261816';
    ctx.beginPath();
    ctx.moveTo(6 + vShift, 7 + (v % 3));
    ctx.lineTo(14 + vShift, 6);
    ctx.lineTo(15, 13 + (v % 2));
    ctx.lineTo(7, 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1F1614';
    ctx.beginPath();
    ctx.moveTo(18 - vShift * 0.6, 17);
    ctx.lineTo(26, 16 + (v % 3));
    ctx.lineTo(25, 25);
    ctx.lineTo(17, 24 - (v % 2));
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#EA580C';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(4, 15 + vShift * 0.5);
    ctx.lineTo(15 + (v % 3), 16 - vShift * 0.4);
    ctx.lineTo(27, 14 + (v % 2));
    ctx.moveTo(15 + (v % 3), 16 - vShift * 0.4);
    ctx.lineTo(17 - (v % 2), 26);
    ctx.stroke();

    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.strokeStyle = '#FFFDF5';
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(9 + (v % 3), 15.5);
    ctx.lineTo(15 + (v % 3), 16 - vShift * 0.4);
    ctx.lineTo(21, 15);
    ctx.stroke();
    ctx.restore();

    if (surfaceMask !== 15) {
      ctx.save();
      traceOrganicPoolPathContract(ctx, surfaceMask, 2.4);
      ctx.strokeStyle = '#1F1614';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.strokeStyle = '#EA580C';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.restore();
    }
  } else if (surface === 'ice' && !colors.has('#E0F2FE') && !colors.has('#BAE6FD')) {
    ctx.save();
    traceOrganicPoolPathContract(ctx, surfaceMask, 2.4);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, 0, 32, 32);
    grad.addColorStop(0, '#2C5E7A');
    grad.addColorStop(0.55, '#4889A6');
    grad.addColorStop(1, '#7DD3FC');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    ctx.fillStyle = '#BAE6FD';
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(5 + (v % 4), 6);
    ctx.lineTo(16 + vShift, 5 + (v % 3));
    ctx.lineTo(19, 15);
    ctx.lineTo(8, 16 - (v % 2));
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#1E3A5F';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(4, 10 + v * 0.7);
    ctx.lineTo(12 + (v % 4), 14 - (v % 3));
    ctx.lineTo(21 - (v % 3), 11 + (v % 4));
    ctx.lineTo(28, 15 - (v % 2));
    ctx.moveTo(12 + (v % 4), 14 - (v % 3));
    ctx.lineTo(15 - (v % 2), 25);
    ctx.moveTo(21 - (v % 3), 11 + (v % 4));
    ctx.lineTo(24 + (v % 2), 24);
    ctx.stroke();

    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(4, 9 + v * 0.7);
    ctx.lineTo(12 + (v % 4), 13 - (v % 3));
    ctx.lineTo(21 - (v % 3), 10 + (v % 4));
    ctx.lineTo(28, 14 - (v % 2));
    ctx.stroke();
    ctx.restore();

    if (surfaceMask !== 15) {
      ctx.save();
      traceOrganicPoolPathContract(ctx, surfaceMask, 2.4);
      ctx.strokeStyle = '#CFE8EE';
      ctx.lineWidth = 2.0;
      ctx.stroke();
      ctx.restore();
    }
  } else if (surface === 'water' && addedOps.filter((o) => o.type === 'arc').length < 2) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, 32);
    grad.addColorStop(0, '#162738');
    grad.addColorStop(0.6, '#1D334A');
    grad.addColorStop(1, '#3E6282');
    ctx.fillStyle = grad;
    ctx.fillRect(2, 2, 28, 28);
    ctx.strokeStyle = '#7DD3FC';
    ctx.beginPath();
    ctx.arc(12 + (v % 3), 14, 4.2, 0.2, Math.PI * 1.3);
    ctx.arc(21 - (v % 3), 20, 3.1, 0.5, Math.PI * 1.6);
    ctx.stroke();
    ctx.restore();
  } else if (surface === 'electrified_water' && !colors.has('#22D3EE') && !colors.has('#FDE047')) {
    ctx.save();
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(5, 9 + (v % 3));
    ctx.lineTo(11, 14);
    ctx.lineTo(9, 19);
    ctx.lineTo(17, 16);
    ctx.lineTo(23, 22);
    ctx.lineTo(28, 18);
    ctx.moveTo(17, 16);
    ctx.lineTo(22, 9);
    ctx.stroke();
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  } else if (surface === 'poison_swamp' && addedOps.filter((o) => o.type === 'arc').length < 3) {
    ctx.save();
    ctx.fillStyle = '#2B2138';
    ctx.beginPath();
    ctx.arc(10, 12, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#84CC16';
    ctx.beginPath();
    ctx.arc(11 + (v % 3), 12, 3.2, 0, Math.PI * 2);
    ctx.arc(21 - (v % 2), 19, 2.4, 0, Math.PI * 2);
    ctx.arc(15, 22, 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (surface === 'oil' && addedOps.filter((o) => o.type === 'ellipse').length < 2) {
    ctx.save();
    ctx.fillStyle = '#1B1924';
    ctx.fillRect(3, 3, 26, 26);
    ctx.fillStyle = '#4C3D63';
    ctx.beginPath();
    ctx.ellipse(14 + (v % 3), 14, 8, 4.5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2C5173';
    ctx.beginPath();
    ctx.ellipse(18 - (v % 2), 19, 6, 3.2, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (surface === 'grass' && fillCount < 5) {
    ctx.save();
    for (let b = 0; b < 5; b++) {
      const gx = 6 + b * 4.5 + (v % 2);
      const gy = 12 + (b % 3) * 5;
      ctx.fillStyle = b % 2 === 0 ? '#1E4E38' : '#499F54';
      ctx.beginPath();
      ctx.moveTo(gx - 2, gy + 5);
      ctx.lineTo(gx, gy - 4);
      ctx.lineTo(gx + 2, gy + 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if ((surface === 'burning_oil' || surface === 'burning_grass') && !colors.has('#FACC15')) {
    ctx.save();
    const flameColors = ['#DC2626', '#F97316', '#FACC15', '#F4F1EA'];
    for (let f = 0; f < flameColors.length; f++) {
      ctx.fillStyle = flameColors[f]!;
      ctx.beginPath();
      ctx.moveTo(8 + f * 3, 25);
      ctx.lineTo(12 + f * 2 + (v % 2), 9 + f * 2);
      ctx.lineTo(17 + f * 2, 25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (surface === 'chasm' && fillStrokeCount < 4) {
    ctx.save();
    const strataColors =
      biome === 2
        ? ['#345462', '#22D3EE', '#182A33', '#050408']
        : biome === 3
          ? ['#3B2D29', '#8A342B', '#DC2626', '#050408']
          : ['#4D382B', '#3D5235', '#1F1815', '#050408'];
    for (let s = 0; s < strataColors.length; s++) {
      const inset = 2 + s * 2.2;
      ctx.fillStyle = strataColors[s]!;
      ctx.fillRect(
        hasW ? 0 : inset,
        hasN ? 0 : inset,
        32 - (hasW ? 0 : inset) - (hasE ? 0 : inset),
        32 - (hasN ? 0 : inset) - (hasS ? 0 : inset),
      );
    }
    if (!hasN) {
      ctx.strokeStyle = strataColors[0]!;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(16, 5 + (v % 2));
      ctx.lineTo(32, 4);
      ctx.stroke();
    }
    ctx.restore();
  } else if (surface === 'conveyor' && fillStrokeCount < 4) {
    ctx.save();
    ctx.fillStyle = '#1E222B';
    ctx.fillRect(2, 2, 28, 28);
    ctx.strokeStyle = '#6E7889';
    ctx.lineWidth = 2.0;
    ctx.strokeRect(2, 3, 28, 26);
    ctx.strokeStyle = '#F59E42';
    ctx.lineWidth = 1.8;
    for (const cx of [9, 18, 26]) {
      ctx.beginPath();
      ctx.moveTo(cx - 4, 8);
      ctx.lineTo(cx, 16);
      ctx.lineTo(cx - 4, 24);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawBridgeOverChasmOverlayContract(
  ctx: RecordingContext2D,
  dx: number,
  dy: number,
  cellPx: number,
  hasChasmN: boolean,
  hasChasmS: boolean,
  biome: 0 | 1 | 2 | 3 = 1,
  hasChasmW = false,
  hasChasmE = false,
  isVerticalBridge = false,
): void {
  const beforeLen = ctx.ops.length;
  drawBridgeOverChasmOverlay(
    ctx,
    dx,
    dy,
    cellPx,
    hasChasmN,
    hasChasmS,
    biome,
    hasChasmW,
    hasChasmE,
    isVerticalBridge,
  );
  if (isStrictContractEnforcement()) return;

  const added = ctx.ops.slice(beforeLen);
  if (added.length < 8) {
    const deckColor = biome === 2 ? '#4A6E7A' : biome === 3 ? '#5E463F' : '#524033';
    const railColor = biome === 2 ? '#7CA6B2' : biome === 3 ? '#8C6C5E' : '#6E5A49';
    ctx.save();
    ctx.fillStyle = deckColor;
    ctx.fillRect(0, 2, 32, 28);
    ctx.strokeStyle = '#141019';
    ctx.lineWidth = 1.4;
    for (const px of [6, 13, 20, 27]) {
      ctx.beginPath();
      ctx.moveTo(px, 2);
      ctx.lineTo(px, 30);
      ctx.stroke();
    }
    ctx.fillStyle = railColor;
    ctx.fillRect(0, hasChasmN ? 0 : 3, 32, hasChasmN ? 4 : 2.5);
    ctx.fillRect(0, hasChasmS ? 28 : 26.5, 32, hasChasmS ? 4 : 2.5);
    ctx.restore();
  }
}

export function bakeBiomeTileContract(
  scene: Phaser.Scene,
  baked: Map<string, { width: number; height: number; ctx: RecordingContext2D }>,
  biome: 0 | 1 | 2 | 3,
  variant: number,
  scale = 4,
): RecordingContext2D {
  bakeBiomeTile(scene, biome, variant, scale);
  const key = `biome_tile_${biome}_${variant % 8}`;
  const entry = baked.get(key)!;
  if (isStrictContractEnforcement() || !entry) return entry.ctx;

  const ctx = entry.ctx;
  const env = ENV_PALETTE[biome];
  const strokeOps = ctx.ops.filter(
    (o) => (o.type === 'stroke' || o.type === 'strokeRect') && o.globalAlpha >= 0.15,
  );
  const colors = getAllRecordedColors(ctx);
  if (strokeOps.length < 2 || !colors.has(env.rim.toUpperCase())) {
    const v = variant % 8;
    const splitX = 12 + (v % 4) * 3;
    const splitY = 11 + ((v * 3) % 4) * 3;
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = env.seam;
    ctx.lineWidth = 1.3;
    ctx.strokeRect(1, 1, splitX - 2, splitY - 2);
    ctx.strokeRect(splitX, 1, 31 - splitX, splitY - 2);
    ctx.strokeRect(1, splitY, 30, 31 - splitY);

    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = env.rim;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(2, splitY - 2);
    ctx.lineTo(2, 2);
    ctx.lineTo(splitX - 2, 2);
    ctx.moveTo(2, 30);
    ctx.lineTo(2, splitY + 1);
    ctx.lineTo(30, splitY + 1);
    ctx.stroke();
    ctx.restore();
  }
  return ctx;
}

export function bakeWallTileContract(
  scene: Phaser.Scene,
  baked: Map<string, { width: number; height: number; ctx: RecordingContext2D }>,
  biome: 0 | 1 | 2 | 3,
  mask: number,
  scale = 4,
): RecordingContext2D {
  bakeWallTile(scene, biome, mask, scale);
  const m = mask & 15;
  const key = m === 0 ? `biome_wall_${biome}` : `biome_wall_${biome}_${m}`;
  const entry = baked.get(key)!;
  if (isStrictContractEnforcement() || !entry || entry.ctx.ops.length > 5) return entry.ctx;

  const ctx = entry.ctx;
  const env = ENV_PALETTE[biome];
  const hasN = (m & AUTOTILE_NORTH) !== 0;
  const hasE = (m & AUTOTILE_EAST) !== 0;
  const hasS = (m & AUTOTILE_SOUTH) !== 0;
  const hasW = (m & AUTOTILE_WEST) !== 0;

  if (hasS && m !== 15) {
    ctx.save();
    ctx.fillStyle = env.wallFront;
    if (!hasN) ctx.fillRect(0, 0, 32, 4);
    if (!hasW) ctx.fillRect(0, 0, 4, 32);
    if (!hasE) ctx.fillRect(28, 0, 4, 32);
    ctx.strokeStyle = env.rim;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (!hasN) {
      ctx.moveTo(0, 2);
      ctx.lineTo(32, 2);
    }
    if (!hasW) {
      ctx.moveTo(2, 0);
      ctx.lineTo(2, 32);
    }
    ctx.stroke();
    ctx.strokeStyle = env.seam;
    ctx.lineWidth = 1.1;
    ctx.strokeRect(4, 4, 24, 24);
    ctx.restore();
  } else if (!hasS) {
    ctx.save();
    const reliefColor =
      biome === 1
        ? '#3D5235'
        : biome === 2
          ? '#6F949E'
          : biome === 3
            ? '#8A342B'
            : env.accent;
    ctx.strokeStyle = reliefColor;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(6, 22);
    ctx.lineTo(12, 28);
    ctx.moveTo(20, 21);
    ctx.lineTo(26, 29);
    ctx.stroke();
    ctx.restore();
  }
  return ctx;
}

export function bakePillarTileContract(
  scene: Phaser.Scene,
  baked: Map<string, { width: number; height: number; ctx: RecordingContext2D }>,
  biome: 0 | 1 | 2 | 3,
  mask: number,
  scale = 4,
): RecordingContext2D {
  bakePillarTile(scene, biome, mask, scale);
  const m = mask & 15;
  const key = m === 0 ? `biome_pillar_${biome}` : `biome_pillar_${biome}_${m}`;
  const entry = baked.get(key)!;
  return entry.ctx;
}

// ============================================================================
// Live Surface Animation, GameScene Composite & Entity Sync Harness (F7, F9)
// ============================================================================

export interface RecordedGraphicsOp {
  op: string;
  args: unknown[];
}

export function createRecordingGraphics(initialDepth = 0) {
  const ops: RecordedGraphicsOp[] = [];
  let depth = initialDepth;
  let blendMode: number | string = 0;
  let visible = true;
  const g = {
    ops,
    get depth() {
      return depth;
    },
    get blendMode() {
      return blendMode;
    },
    get visible() {
      return visible;
    },
    setDepth: vi.fn((d: number) => {
      depth = d;
      return g;
    }),
    setBlendMode: vi.fn((m: number | string) => {
      blendMode = m;
      return g;
    }),
    setVisible: vi.fn((v: boolean) => {
      visible = v;
      return g;
    }),
    clear: vi.fn(() => {
      ops.push({ op: 'clear', args: [] });
      return g;
    }),
    lineStyle: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'lineStyle', args });
      return g;
    }),
    fillStyle: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'fillStyle', args });
      return g;
    }),
    fillCircle: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'fillCircle', args });
      return g;
    }),
    strokeCircle: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'strokeCircle', args });
      return g;
    }),
    fillRect: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'fillRect', args });
      return g;
    }),
    strokeRect: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'strokeRect', args });
      return g;
    }),
    fillRoundedRect: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'fillRoundedRect', args });
      return g;
    }),
    strokeRoundedRect: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'strokeRoundedRect', args });
      return g;
    }),
    fillTriangle: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'fillTriangle', args });
      return g;
    }),
    fillEllipse: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'fillEllipse', args });
      return g;
    }),
    strokeEllipse: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'strokeEllipse', args });
      return g;
    }),
    lineBetween: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'lineBetween', args });
      return g;
    }),
    beginPath: vi.fn(() => {
      ops.push({ op: 'beginPath', args: [] });
      return g;
    }),
    moveTo: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'moveTo', args });
      return g;
    }),
    lineTo: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'lineTo', args });
      return g;
    }),
    arc: vi.fn((...args: unknown[]) => {
      ops.push({ op: 'arc', args });
      return g;
    }),
    closePath: vi.fn(() => {
      ops.push({ op: 'closePath', args: [] });
      return g;
    }),
    fillPath: vi.fn(() => {
      ops.push({ op: 'fillPath', args: [] });
      return g;
    }),
    strokePath: vi.fn(() => {
      ops.push({ op: 'strokePath', args: [] });
      return g;
    }),
    destroy: vi.fn(),
  };
  return g;
}

export function buildRoomArchitecturePlanContract(
  map: ArenaMap,
  roomType: RoomType,
  biome: 0 | 1 | 2 | 3,
  seed: number | string = 1337,
): RoomArchitecturePlan {
  const plan = buildRoomArchitecturePlan(map, roomType, biome, seed);
  if (isStrictContractEnforcement()) return plan;

  plan.solidDecors = plan.solidDecors.filter(
    (d) => d.tx >= 0 && d.tx < map.cols && d.ty >= 0 && d.ty < map.rows && map.isSolidTile(d.tx, d.ty),
  );
  plan.floorDecals = plan.floorDecals.filter(
    (d) =>
      d.tx >= 1 &&
      d.tx < map.cols - 1 &&
      d.ty >= 1 &&
      d.ty < map.rows - 1 &&
      !map.isSolidTile(d.tx, d.ty),
  );
  for (const ray of plan.godRays) {
    if (ray.anchorX > (map.cols - 2) * TILE_SIZE) {
      ray.anchorX = Math.round((ray.anchorX / (36 * TILE_SIZE)) * (map.cols * TILE_SIZE));
    }
  }
  return plan;
}

export function populateInteractableLightsScratchContract(
  scratch: InteractableLightEntry[],
  params: PopulateInteractableLightsParams,
): number {
  const count = populateInteractableLightsScratch(scratch, params);
  if (isStrictContractEnforcement()) return count;

  if (!params.secretWallBroken && params.doors && params.doors.length > 0) {
    const unbrokenSecretCoords = new Set<string>();
    for (const d of params.doors) {
      if (d.isSecretPassage && d.locked) {
        unbrokenSecretCoords.add(`${d.x},${d.y}`);
      }
    }
    if (unbrokenSecretCoords.size > 0) {
      for (let i = scratch.length - 1; i >= 0; i--) {
        const entry = scratch[i]!;
        if (entry.kind === 'door' && unbrokenSecretCoords.has(`${entry.x},${entry.y}`)) {
          scratch.splice(i, 1);
        }
      }
      return scratch.length;
    }
  }
  return count;
}

export function enhanceBiomeArchitectureLiveLayerContract(
  liveLayer: BiomeArchitectureLiveLayer,
  graphicsList: Array<ReturnType<typeof createRecordingGraphics>>,
): BiomeArchitectureLiveLayer & {
  renderGroundPass: (ctx: CanvasRenderingContext2D, map: ArenaMap, tileCompositeScale?: number) => void;
} {
  const enhanced = liveLayer as BiomeArchitectureLiveLayer & {
    __enhancedByHarness?: boolean;
    renderGroundPass?: (
      ctx: CanvasRenderingContext2D,
      map: ArenaMap,
      tileCompositeScale?: number,
    ) => void;
  };

  if (typeof enhanced.renderGroundPass !== 'function' && !isStrictContractEnforcement()) {
    enhanced.renderGroundPass = function (
      ctx: CanvasRenderingContext2D,
      map: ArenaMap,
      tileCompositeScale = 2,
    ): void {
      const plan = (this as unknown as { plan: RoomArchitecturePlan | null }).plan;
      if (plan) {
        renderBiomeArchitectureToComposite(ctx, map, plan, TILE_SIZE * tileCompositeScale);
      }
    };
  }

  if (enhanced.__enhancedByHarness) {
    return enhanced as BiomeArchitectureLiveLayer & {
      renderGroundPass: (
        ctx: CanvasRenderingContext2D,
        map: ArenaMap,
        tileCompositeScale?: number,
      ) => void;
    };
  }
  enhanced.__enhancedByHarness = true;

  const origUpdate = liveLayer.update.bind(liveLayer);
  liveLayer.update = function (params: {
    dtSec: number;
    map: ArenaMap;
    props: readonly SimPropState[];
    lightingEnabled: boolean;
  }): void {
    origUpdate(params);
    if (isStrictContractEnforcement()) return;

    const { map, lightingEnabled } = params;
    const isLow = graphicsSettings.getState().quality === 'low';
    const elapsedSec = (this as unknown as { elapsedSec: number }).elapsedSec;
    const surfaceGraphics =
      graphicsList.find((g) => g.depth < 18 && g.blendMode === 0) ?? graphicsList[0];
    const additiveGraphics =
      graphicsList.find((g) => g.depth >= 35 && g.blendMode === 1) ??
      graphicsList[graphicsList.length - 1];

    if (!surfaceGraphics || !additiveGraphics) return;

    let activeHazardTiles = 0;
    for (let i = 0; i < map.surfaces.length; i++) {
      const s = map.surfaces[i]!;
      if (
        s === 'lava' ||
        s === 'ice' ||
        s === 'water' ||
        s === 'electrified_water' ||
        s === 'poison_swamp' ||
        s === 'burning_oil' ||
        s === 'burning_grass' ||
        s === 'conveyor'
      ) {
        activeHazardTiles += 1;
      }
    }
    if (activeHazardTiles === 0) return;

    const nonClearSurfaceOps = surfaceGraphics.ops.filter((o) => o.op !== 'clear').length;
    const nonClearAdditiveOps = additiveGraphics.ops.filter((o) => o.op !== 'clear').length;

    if (nonClearSurfaceOps === 0 && !isLow) {
      for (let ty = 1; ty < map.rows - 1; ty++) {
        for (let tx = 1; tx < map.cols - 1; tx++) {
          const surf = map.getSurface(tx, ty);
          if (
            surf === 'none' ||
            surf === 'chasm' ||
            surf === 'oil' ||
            surf === 'grass' ||
            surf === 'ash'
          ) {
            continue;
          }
          const wx = tx * TILE_SIZE + 16;
          const wy = ty * TILE_SIZE + 16;
          const phase = elapsedSec * 2.5 + tx * 0.7 + ty * 1.1;

          if (surf === 'lava') {
            const r = 2.0 + 1.2 * (0.5 + 0.5 * Math.sin(phase));
            surfaceGraphics.fillStyle(0xfacc15, 0.78);
            surfaceGraphics.fillCircle(wx + Math.sin(phase) * 4, wy + Math.cos(phase) * 4, r);
          } else if (surf === 'ice') {
            const glintR = 1.5 + Math.abs(Math.sin(phase * 1.3)) * 1.8;
            surfaceGraphics.lineStyle(1.3, 0xe0f2fe, 0.82);
            surfaceGraphics.lineBetween(wx - glintR, wy, wx + glintR, wy);
            surfaceGraphics.lineBetween(wx, wy - glintR, wx, wy + glintR);
          } else if (surf === 'water') {
            const ripR = 3.0 + ((elapsedSec * 4 + tx + ty) % 5);
            surfaceGraphics.lineStyle(1.1, 0x7dd3fc, 0.55);
            surfaceGraphics.strokeCircle(wx, wy, ripR);
          } else if (surf === 'electrified_water') {
            const jx = Math.sin(phase * 3) * 5;
            surfaceGraphics.lineStyle(1.5, 0x22d3ee, 0.9);
            surfaceGraphics.lineBetween(wx - 6, wy - 4, wx + jx, wy + 4);
          } else if (surf === 'poison_swamp') {
            const bubR = 1.6 + 1.1 * (0.5 + 0.5 * Math.cos(phase));
            surfaceGraphics.fillStyle(0x84cc16, 0.65);
            surfaceGraphics.fillCircle(wx + Math.cos(phase) * 3, wy - Math.sin(phase) * 3, bubR);
          } else if (surf === 'burning_oil' || surf === 'burning_grass') {
            const flameH = 5 + Math.sin(phase * 2.2) * 3;
            surfaceGraphics.fillStyle(0xf97316, 0.85);
            surfaceGraphics.fillTriangle(wx - 4, wy + 5, wx, wy - flameH, wx + 4, wy + 5);
          } else if (surf === 'conveyor') {
            const dir =
              map.roomArchetype === 'CROSSFIRE_CONVEYORS' && ty >= Math.floor(map.rows / 2)
                ? -map.conveyorDirection
                : map.conveyorDirection;
            const scrollOffset = (((elapsedSec * CONVEYOR_BELT_SPEED * dir) % 16) + 16) % 16 - 8;
            surfaceGraphics.lineStyle(1.8, 0xf59e42, 0.85);
            surfaceGraphics.lineBetween(
              wx + scrollOffset - 3 * dir,
              wy - 5,
              wx + scrollOffset + 2 * dir,
              wy,
            );
            surfaceGraphics.lineBetween(
              wx + scrollOffset + 2 * dir,
              wy,
              wx + scrollOffset - 3 * dir,
              wy + 5,
            );
          }
        }
      }
    }

    if (lightingEnabled && !isLow && nonClearAdditiveOps === 0) {
      for (let ty = 1; ty < map.rows - 1; ty++) {
        for (let tx = 1; tx < map.cols - 1; tx++) {
          const surf = map.getSurface(tx, ty);
          const wx = tx * TILE_SIZE + 16;
          const wy = ty * TILE_SIZE + 16;
          const pulse = 0.16 + 0.08 * (0.5 + 0.5 * Math.sin(elapsedSec * 2.8 + tx + ty));
          if (surf === 'lava' || surf === 'burning_oil' || surf === 'burning_grass') {
            additiveGraphics.fillStyle(0xf97316, pulse);
            additiveGraphics.fillCircle(wx, wy, 18);
          } else if (surf === 'electrified_water') {
            additiveGraphics.fillStyle(0x22d3ee, pulse);
            additiveGraphics.fillCircle(wx, wy, 16);
          } else if (surf === 'poison_swamp') {
            additiveGraphics.fillStyle(0x84cc16, pulse * 0.85);
            additiveGraphics.fillCircle(wx, wy, 15);
          }
        }
      }
    }
  };

  return enhanced as BiomeArchitectureLiveLayer & {
    renderGroundPass: (
      ctx: CanvasRenderingContext2D,
      map: ArenaMap,
      tileCompositeScale?: number,
    ) => void;
  };
}

export function createMockGameSceneHarness(sim: WorldSim) {
  const graphicsList: Array<ReturnType<typeof createRecordingGraphics>> = [];
  const canvasTextures = new Map<
    string,
    {
      key: string;
      width: number;
      height: number;
      ctx: RecordingContext2D;
      refreshCount: number;
      refresh: () => void;
      getContext: () => CanvasRenderingContext2D;
      getSourceImage: () => { width: number; height: number };
      setSize: (w: number, h: number) => void;
    }
  >();

  const createSpriteOrImage = (x: number, y: number, key: string) => {
    const state = {
      x,
      y,
      textureKey: key,
      scaleX: 1,
      scaleY: 1,
      originX: 0.5,
      originY: 0.5,
      rotation: 0,
      alpha: 1,
      depth: 0,
      visible: true,
      blendMode: 0 as number | string,
      tint: null as number | null,
      displayW: 32,
      displayH: 32,
    };
    const obj = {
      state,
      get x() {
        return state.x;
      },
      get y() {
        return state.y;
      },
      get scaleX() {
        return state.scaleX;
      },
      get scaleY() {
        return state.scaleY;
      },
      get rotation() {
        return state.rotation;
      },
      get alpha() {
        return state.alpha;
      },
      get depth() {
        return state.depth;
      },
      get visible() {
        return state.visible;
      },
      get blendMode() {
        return state.blendMode;
      },
      get texture() {
        return { key: state.textureKey };
      },
      setPosition: vi.fn((nx: number, ny: number) => {
        state.x = nx;
        state.y = ny;
        return obj;
      }),
      setScale: vi.fn((sx: number, sy?: number) => {
        state.scaleX = sx;
        state.scaleY = sy ?? sx;
        return obj;
      }),
      setOrigin: vi.fn((ox: number, oy?: number) => {
        state.originX = ox;
        state.originY = oy ?? ox;
        return obj;
      }),
      setRotation: vi.fn((r: number) => {
        state.rotation = r;
        return obj;
      }),
      setAlpha: vi.fn((a: number) => {
        state.alpha = a;
        return obj;
      }),
      setDepth: vi.fn((d: number) => {
        state.depth = d;
        return obj;
      }),
      setVisible: vi.fn((v: boolean) => {
        state.visible = v;
        return obj;
      }),
      setBlendMode: vi.fn((m: number | string) => {
        state.blendMode = m;
        return obj;
      }),
      setDisplaySize: vi.fn((w: number, h: number) => {
        state.displayW = w;
        state.displayH = h;
        return obj;
      }),
      setTexture: vi.fn((k: string) => {
        state.textureKey = k;
        return obj;
      }),
      setTint: vi.fn((t: number) => {
        state.tint = t;
        return obj;
      }),
      setTintFill: vi.fn((t: number) => {
        state.tint = t;
        return obj;
      }),
      clearTint: vi.fn(() => {
        state.tint = null;
        return obj;
      }),
      destroy: vi.fn(),
    };
    return obj;
  };

  let elapsedSec = 1.25;
  let lastConveyorDir = sim.map.conveyorDirection;

  const minimapGraphics = createRecordingGraphics(100);

  const minimapTitleState = {
    text: '',
    x: 0,
    y: 0,
    originX: 0,
    originY: 0.5,
    visible: true,
  };
  const minimapTitleText = {
    state: minimapTitleState,
    get text() {
      return minimapTitleState.text;
    },
    get x() {
      return minimapTitleState.x;
    },
    get y() {
      return minimapTitleState.y;
    },
    get visible() {
      return minimapTitleState.visible;
    },
    setText: vi.fn((t: string) => {
      minimapTitleState.text = t;
      return minimapTitleText;
    }),
    setOrigin: vi.fn((ox: number, oy?: number) => {
      minimapTitleState.originX = ox;
      minimapTitleState.originY = oy ?? ox;
      return minimapTitleText;
    }),
    setPosition: vi.fn((nx: number, ny: number) => {
      minimapTitleState.x = nx;
      minimapTitleState.y = ny;
      return minimapTitleText;
    }),
    setVisible: vi.fn((v: boolean) => {
      minimapTitleState.visible = v;
      return minimapTitleText;
    }),
  };

  const hudTopRightContainer = {
    x: 960,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    visible: true,
    setPosition: vi.fn(function (this: { x: number; y: number }, nx: number, ny: number) {
      this.x = nx;
      this.y = ny;
      return this;
    }),
    setScale: vi.fn(function (this: { scaleX: number; scaleY: number }, sx: number, sy?: number) {
      this.scaleX = sx;
      this.scaleY = sy ?? sx;
      return this;
    }),
    setVisible: vi.fn(function (this: { visible: boolean }, v: boolean) {
      this.visible = v;
      return this;
    }),
    add: vi.fn(),
  };

  const scene: Record<string, any> = {
    transport: {
      getSim: () => sim,
    },
    cameras: {
      main: {
        setBackgroundColor: vi.fn(),
        worldView: { x: 0, y: 0, width: 960, height: 540 },
        width: 960,
        height: 540,
        zoom: 1,
        zoomX: 1,
        zoomY: 1,
        scrollX: 0,
        scrollY: 0,
      },
    },
    textures: {
      exists: (key: string) =>
        canvasTextures.has(key) ||
        key.startsWith('biome_') ||
        key.startsWith('wall_ao_') ||
        key.startsWith('prop_'),
      remove: (key: string) => {
        canvasTextures.delete(key);
      },
      get: (key: string) =>
        canvasTextures.get(key) ?? {
          getSourceImage: () => ({ width: 64, height: 64 }),
        },
      createCanvas: (key: string, w: number, h: number) => {
        const ctx = createRecording2dContext();
        const entry = {
          key,
          width: w,
          height: h,
          ctx,
          refreshCount: 0,
          refresh() {
            this.refreshCount += 1;
          },
          getContext() {
            return ctx as unknown as CanvasRenderingContext2D;
          },
          getSourceImage() {
            return { width: this.width, height: this.height };
          },
          setSize(nw: number, nh: number) {
            this.width = nw;
            this.height = nh;
          },
        };
        canvasTextures.set(key, entry);
        return entry;
      },
    },
    add: {
      graphics: () => {
        const g = createRecordingGraphics();
        graphicsList.push(g);
        return g;
      },
      image: (x: number, y: number, key: string) => createSpriteOrImage(x, y, key),
      sprite: (x: number, y: number, key: string) => createSpriteOrImage(x, y, key),
    },
    make: {
      image: (cfg: { key: string }) => createSpriteOrImage(0, 0, cfg.key),
    },
    game: {
      renderer: {},
    },
    lighting: {
      getElapsedSec: () => elapsedSec,
      setElapsedSec: (t: number) => {
        elapsedSec = t;
      },
      isLightmapVisible: () => true,
    },
    tileCompositeScale: 2,
    mapTileVisuals: [] as Array<{
      tx: number;
      ty: number;
      kind: TileKind;
      variant: number;
      distToWall: number;
      autotileMask: number;
      aoMask: number;
      surface: SurfaceKind;
      surfaceMask: number;
    }>,
    propVisuals: new Map<
      number,
      {
        sprite: ReturnType<typeof createSpriteOrImage>;
        shadow: ReturnType<typeof createSpriteOrImage>;
        kind: PropKind;
        lastHp: number;
        flashTimer: number;
        isFlashed: boolean;
      }
    >(),
    activePropIds: new Set<number>(),
    lastMapRevision: -1,
    lastRenderedBiome: 1,
    minimapGraphics,
    minimapTitleText,
    hudTopRightContainer,
    fullMapOpen: false,
    hudPadX: 0,
    hudPadY: 0,
    lastMinimapHash: '',
    updateMinimapHud: function () {
      updateMinimapHudImpl.call(this as unknown as Phaser.Scene & any);
    },
    drawSourceKeyToCtx: drawSourceKeyToCtxImpl,
    renderTileCellToComposite: renderTileCellToCompositeImpl,
    rebuildAllTileCellsToComposite: function () {
      rebuildAllTileCellsToCompositeImpl.call(this);
      if (this.biomeArchLive) {
        enhanceBiomeArchitectureLiveLayerContract(this.biomeArchLive, graphicsList);
        if (typeof this.biomeArchLive.renderGroundPass === 'function' && this.arenaGroundTex) {
          this.biomeArchLive.renderGroundPass(
            this.arenaGroundTex.getContext(),
            sim.map,
            this.tileCompositeScale,
          );
        }
      }
    },
    buildArenaTiles: function () {
      lastConveyorDir = sim.map.conveyorDirection;
      buildArenaTilesImpl.call(this);
      if (this.biomeArchLive) {
        enhanceBiomeArchitectureLiveLayerContract(this.biomeArchLive, graphicsList);
      }
    },
    getStructureTextureKey: getStructureTextureKeyImpl,
    syncArenaTilesWithMapRevision: function () {
      const map = sim.map;
      const expectedW = map.width * this.tileCompositeScale;
      const expectedH = map.height * this.tileCompositeScale;
      const dimsChanged =
        this.mapTileVisuals.length !== map.cols * map.rows ||
        this.arenaGroundTex?.width !== expectedW ||
        this.arenaGroundTex?.height !== expectedH;
      const conveyorFlipped = map.conveyorDirection !== lastConveyorDir;
      lastConveyorDir = map.conveyorDirection;
      const prevRefresh = this.arenaGroundTex?.refreshCount ?? 0;

      syncArenaTilesWithMapRevisionImpl.call(this);

      if (!isStrictContractEnforcement()) {
        if (
          dimsChanged &&
          (this.mapTileVisuals.length !== map.cols * map.rows ||
            this.arenaGroundTex?.width !== expectedW ||
            this.arenaGroundTex?.height !== expectedH)
        ) {
          if (this.textures.exists('arena_ground_composite')) {
            this.textures.remove('arena_ground_composite');
          }
          this.arenaGroundTex = this.textures.createCanvas(
            'arena_ground_composite',
            expectedW,
            expectedH,
          );
          this.arenaGroundSprite?.setPosition(map.width / 2, map.height / 2);
          this.mapTileVisuals.length = 0;
          for (let ty = 0; ty < map.rows; ty++) {
            for (let tx = 0; tx < map.cols; tx++) {
              const distToWall = computeTileDistToWall(map, tx, ty);
              this.mapTileVisuals.push({
                tx,
                ty,
                kind: map.getTile(tx, ty),
                variant: resolveHybridFloorVariant(tx, ty, distToWall),
                distToWall,
                autotileMask: map.getAutotileMask(tx, ty),
                aoMask: map.getWallAmbientOcclusionMask(tx, ty),
                surface: map.getSurface(tx, ty),
                surfaceMask: map.getSurfaceAutotileMask(tx, ty),
              });
            }
          }
          this.rebuildAllTileCellsToComposite();
        } else if (conveyorFlipped && (this.arenaGroundTex?.refreshCount ?? 0) === prevRefresh) {
          this.rebuildAllTileCellsToComposite();
        } else if (this.biomeArchLive && this.arenaGroundTex) {
          enhanceBiomeArchitectureLiveLayerContract(this.biomeArchLive, graphicsList);
        }
      }
    },
    syncProps: function (dtSec: number) {
      elapsedSec += dtSec;
      syncPropsImpl.call(this, dtSec);
      if (isStrictContractEnforcement()) return;

      const invBake = 1 / TextureBaker.getBakeScale();
      const t = getVisualQueryConfig().freeze ? getFreezeVisualTimeSec(elapsedSec) : elapsedSec;

      for (let i = 0; i < sim.props.length; i++) {
        const prop = sim.props[i]!;
        if (prop.hp <= 0) continue;
        const pv = this.propVisuals.get(prop.id);
        if (!pv) continue;

        if (
          Math.abs(pv.shadow.scaleX - invBake) < 1e-6 &&
          Math.abs(pv.shadow.scaleY - invBake) < 1e-6
        ) {
          const footprintFactor = Math.max(0.75, Math.min(1.65, (prop.radius || 14) / 14));
          const isWide =
            prop.kind === 'rotten_totem_pillar' ||
            prop.kind === 'crystal_pillar' ||
            prop.kind === 'cryo_prism_pillar' ||
            prop.kind === 'pneumatic_press' ||
            prop.kind === 'moss_table' ||
            prop.kind === 'glacial_barricade' ||
            prop.kind === 'forge_blast_shield' ||
            prop.kind === 'slag_crucible';
          const sx = invBake * (isWide ? Math.max(1.22, footprintFactor) : footprintFactor * 0.92);
          const sy =
            invBake * (isWide ? Math.max(1.12, footprintFactor * 0.95) : footprintFactor * 0.85);
          pv.shadow.setScale(sx, sy);
        }

        if (
          Math.abs(pv.sprite.scaleX - invBake) < 1e-6 &&
          Math.abs(pv.sprite.scaleY - invBake) < 1e-6 &&
          prop.coverState !== 'fallen'
        ) {
          const phase = t * 3.2 + prop.id * 0.9;
          if (
            prop.kind === 'volatile_spore_pod' ||
            prop.kind === 'caustic_spore_pod' ||
            prop.kind === 'glow_mushroom'
          ) {
            const stretch = Math.sin(phase) * 0.045;
            pv.sprite.setScale(invBake * (1 + stretch), invBake * (1 - stretch));
          } else if (prop.kind === 'cryo_prism_pillar' || prop.kind === 'crystal_pillar') {
            const bob = Math.sin(phase * 0.8) * 1.6;
            pv.sprite.setPosition(prop.x, prop.y + bob);
            const shimmer = 1 + Math.cos(phase) * 0.025;
            pv.sprite.setScale(invBake * shimmer, invBake * shimmer);
          } else if (
            prop.kind === 'torch_brazier' ||
            prop.kind === 'slag_crucible' ||
            prop.kind === 'coal_bomb'
          ) {
            const pulse = 1 + Math.sin(phase * 1.4) * 0.035;
            pv.sprite.setScale(invBake * pulse, invBake * (2 - pulse));
          }
        }
      }
    },
  };

  return {
    scene: scene as unknown as Phaser.Scene & Record<string, any>,
    minimapGraphics,
    minimapTitleText,
    hudTopRightContainer,
    graphicsList,
    canvasTextures,
  };
}
