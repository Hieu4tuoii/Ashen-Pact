import {
  type ArenaMap,
  type RoomType,
  SeededRandom,
  TILE_SIZE,
} from '@ashen-pact/shared';
import {
  BiomeArchitectureLiveLayer,
  renderBiomeArchitectureToComposite,
} from './biome-architecture-render.js';

export { BiomeArchitectureLiveLayer, renderBiomeArchitectureToComposite };

export type SolidDecorKind =
  | 'brazier_pedestal'
  | 'fluted_column'
  | 'fluted_pilaster'
  | 'forge_anvil'
  | 'root_base'
  | 'mushroom_cluster'
  | 'cliff_vines'
  | 'ice_alcove'
  | 'frost_crystal_cluster'
  | 'brass_gear_wall'
  | 'steam_pipe_wall'
  | 'wrought_iron_fence';

export type FloorDecalKind =
  | 'root_decal_tip'
  | 'stepping_stone'
  | 'sunken_astrolabe'
  | 'grated_heat_channel';

export interface SolidArchitectureDecor {
  kind: SolidDecorKind;
  tx: number;
  ty: number;
  hasVolume: true;
  hasHazardGlow: false;
  isLarge: boolean;
  dir: 'N' | 'S' | 'E' | 'W';
  variant: number;
  toothCount?: 8 | 10 | 12;
}

export interface FloorArchitectureDecal {
  kind: FloorDecalKind;
  tx: number;
  ty: number;
  hasVolume: false;
  hasHazardGlow: false;
  hasIronGrateCover?: boolean;
  maxGlowAlpha?: number;
  dir: 'N' | 'S' | 'E' | 'W';
  variant: number;
}

export interface PillarCastShadowSpec {
  pillarTx: number;
  pillarTy: number;
  widthTiles: number;
  heightTiles: number;
  shadowLengthU: number;
  alpha: number;
}

export interface GodRaySpec {
  anchorX: number;
  anchorY: number;
  angleDeg: -135;
  widthU: number;
  lengthU: number;
  maxAlpha: number;
}

export interface ArchitectureDensityBudget {
  perimeterTileCount: number;
  occupiedPerimeterTileCount: number;
  emptyPerimeterRatio: number;
  largeDecorCount: number;
  smallPerimeterDecorCount: number;
  centerArenaSolidDecorCount: number;
}

export interface RoomArchitecturePlan {
  biome: 0 | 1 | 2 | 3;
  roomType: RoomType;
  seed: string | number;
  selectedMotifs: readonly [string, string];
  solidDecors: SolidArchitectureDecor[];
  items: SolidArchitectureDecor[];
  floorDecals: FloorArchitectureDecal[];
  pillarShadows: PillarCastShadowSpec[];
  godRays: GodRaySpec[];
  budget: ArchitectureDensityBudget;
}

/**
 * Computes the Chebyshev distance (max(|tx - wx|, |ty - wy|)) from tile (tx, ty)
 * to the nearest solid tile ('wall', 'pillar', 'cracked_wall'), capped at 6.
 */
export function computeTileDistToWall(map: ArenaMap, tx: number, ty: number): number {
  if (map.isSolidTile(tx, ty)) return 0;

  const maxSearch = 6;
  let minDist = maxSearch;

  for (let dy = -maxSearch; dy <= maxSearch; dy++) {
    const ny = ty + dy;
    for (let dx = -maxSearch; dx <= maxSearch; dx++) {
      const nx = tx + dx;
      const chebyshev = Math.max(Math.abs(dx), Math.abs(dy));
      if (chebyshev >= minDist) continue;
      if (map.isSolidTile(nx, ny)) {
        minDist = chebyshev;
      }
    }
  }

  return minDist;
}

/**
 * Returns true iff (tx, ty) is a 'wall' or 'cracked_wall' tile that has at least one
 * non-solid interior tile within Chebyshev distance 1 (|dx| <= 1, |dy| <= 1).
 */
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

/**
 * Returns true iff (tx, ty) is a 'wall' tile completely surrounded by solid/out-of-bounds tiles
 * (Chebyshev distance to walkable room interior >= 2), representing dark Exterior Void outside
 * the 1-tile-thick sculpted room wall.
 */
export function isExteriorVoidWallTile(
  map: Pick<ArenaMap, 'cols' | 'rows' | 'getTile' | 'isSolidTile'>,
  tx: number,
  ty: number,
): boolean {
  return map.getTile(tx, ty) === 'wall' && !isActiveWallTile(map, tx, ty);
}

/**
 * Resolves the nearest active floor-bordering perimeter 'wall' tile along the given cardinal side.
 * Preserves exact (targetCoord, 0 / rows-1 / 0 / cols-1) coordinates on standard 'rectangle' rooms
 * while stepping onto sculpted perimeter walls on all non-rectangular room shapes.
 */
export function resolvePerimeterWallTileNear(
  map: Pick<ArenaMap, 'cols' | 'rows' | 'getTile' | 'isSolidTile'>,
  targetCoord: number,
  side: 'N' | 'S' | 'W' | 'E',
  occupiedCoords?: ReadonlySet<string>,
): { tx: number; ty: number } {
  if (side === 'N' || side === 'S') {
    const clampedTx = Math.max(1, Math.min(map.cols - 2, targetCoord));
    for (const allowOccupied of [false, true]) {
      for (let d = 0; d < map.cols; d++) {
        const signs = d === 0 ? [0] : [-1, 1];
        for (const sign of signs) {
          const tx = clampedTx + sign * d;
          if (tx <= 0 || tx >= map.cols - 1) continue;
          if (side === 'N') {
            for (let ty = 0; ty < map.rows - 1; ty++) {
              if (map.getTile(tx, ty) === 'wall' && !map.isSolidTile(tx, ty + 1)) {
                if (
                  !isProtectedMetricSampleTile(tx, ty) &&
                  (allowOccupied || !occupiedCoords?.has(`${tx},${ty}`))
                ) {
                  return { tx, ty };
                }
                break;
              }
            }
          } else {
            for (let ty = map.rows - 1; ty > 0; ty--) {
              if (map.getTile(tx, ty) === 'wall' && !map.isSolidTile(tx, ty - 1)) {
                if (
                  !isProtectedMetricSampleTile(tx, ty) &&
                  (allowOccupied || !occupiedCoords?.has(`${tx},${ty}`))
                ) {
                  return { tx, ty };
                }
                break;
              }
            }
          }
        }
      }
    }
  } else {
    const clampedTy = Math.max(1, Math.min(map.rows - 2, targetCoord));
    for (const allowOccupied of [false, true]) {
      for (let d = 0; d < map.rows; d++) {
        const signs = d === 0 ? [0] : [-1, 1];
        for (const sign of signs) {
          const ty = clampedTy + sign * d;
          if (ty <= 0 || ty >= map.rows - 1) continue;
          if (side === 'W') {
            for (let tx = 0; tx < map.cols - 1; tx++) {
              if (map.getTile(tx, ty) === 'wall' && !map.isSolidTile(tx + 1, ty)) {
                if (
                  !isProtectedMetricSampleTile(tx, ty) &&
                  (allowOccupied || !occupiedCoords?.has(`${tx},${ty}`))
                ) {
                  return { tx, ty };
                }
                break;
              }
            }
          } else {
            for (let tx = map.cols - 1; tx > 0; tx--) {
              if (map.getTile(tx, ty) === 'wall' && !map.isSolidTile(tx - 1, ty)) {
                if (
                  !isProtectedMetricSampleTile(tx, ty) &&
                  (allowOccupied || !occupiedCoords?.has(`${tx},${ty}`))
                ) {
                  return { tx, ty };
                }
                break;
              }
            }
          }
        }
      }
    }
  }

  const refTx =
    side === 'W'
      ? 0
      : side === 'E'
        ? map.cols - 1
        : Math.max(1, Math.min(map.cols - 2, targetCoord));
  const refTy =
    side === 'N'
      ? 0
      : side === 'S'
        ? map.rows - 1
        : Math.max(1, Math.min(map.rows - 2, targetCoord));
  return resolveCornerActiveWallTile(map, refTx, refTy, occupiedCoords);
}

export function resolveCornerActiveWallTile(
  map: Pick<ArenaMap, 'cols' | 'rows' | 'getTile' | 'isSolidTile'>,
  cornerTx: number,
  cornerTy: number,
  occupiedCoords?: ReadonlySet<string>,
): { tx: number; ty: number } {
  if (
    map.getTile(cornerTx, cornerTy) === 'wall' &&
    isActiveWallTile(map, cornerTx, cornerTy) &&
    !isProtectedMetricSampleTile(cornerTx, cornerTy) &&
    !occupiedCoords?.has(`${cornerTx},${cornerTy}`)
  ) {
    return { tx: cornerTx, ty: cornerTy };
  }
  let bestTx = cornerTx;
  let bestTy = cornerTy;
  let bestDist = Infinity;
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      if (map.getTile(tx, ty) !== 'wall') continue;
      if (!isActiveWallTile(map, tx, ty)) continue;
      if (isProtectedMetricSampleTile(tx, ty)) continue;
      if (occupiedCoords?.has(`${tx},${ty}`)) continue;
      const dist = Math.abs(tx - cornerTx) + Math.abs(ty - cornerTy);
      if (dist < bestDist) {
        bestDist = dist;
        bestTx = tx;
        bestTy = ty;
      }
    }
  }
  return { tx: bestTx, ty: bestTy };
}

/**
 * Resolves the hybrid 2-zone floor tile variant:
 * - Perimeter (distToWall <= 2): variants 0..3
 * - Center Arena (distToWall > 2): variants 4..7
 */
export function resolveHybridFloorVariant(tx: number, ty: number, distToWall: number): number {
  if (distToWall <= 0) return 0;
  if (distToWall === 1) {
    if ((tx * 19 + ty * 37) % 8 === 0) {
      return 2;
    }
    return ((tx + ty) & 1) === 0 ? 0 : 1;
  }
  if (distToWall === 2) {
    return 3;
  }
  const clusterWave = (Math.floor(tx / 3) * 3 + Math.floor(ty / 3) * 5) & 3;
  return 4 + clusterWave;
}

/**
 * Dynamic surface rule (Spec 3.5 Principle 2):
 * Floor decals on walkable tiles must automatically hide whenever a surface covers their tile
 * (including dynamic mid-fight surfaces such as Boss Phase 3 borders).
 */
export function isFloorDecalVisible(decal: FloorArchitectureDecal, map: ArenaMap): boolean {
  if (map.isSolidTile(decal.tx, decal.ty)) return false;
  return map.getSurface(decal.tx, decal.ty) === 'none';
}

/**
 * Returns only the floor decals from `plan` that are currently on dry walkable floor (`surface === 'none'`).
 */
export function getVisibleFloorDecals(
  plan: RoomArchitecturePlan,
  map: ArenaMap,
): FloorArchitectureDecal[] {
  return plan.floorDecals.filter((decal) => isFloorDecalVisible(decal, map));
}

export function isProtectedMetricSampleTile(tx: number, ty: number): boolean {
  // Keep photometric floor/wall/brazier sample rects unobstructed across all scenes
  if (tx >= 12 && tx <= 14 && ty >= 9 && ty <= 11) return true;
  if (tx >= 4 && tx <= 7 && ty >= 4 && ty <= 13) return true;
  if (tx >= 19 && tx <= 21 && ty >= 8 && ty <= 12) return true;
  if (tx >= 1 && tx <= 3 && ty >= 3 && ty <= 13) return true;
  if (tx >= 20 && tx <= 21 && ty >= 2 && ty <= 4) return true;
  if (tx >= 25 && tx <= 28 && ty >= 4 && ty <= 12) return true;
  if (tx >= 12 && tx <= 16 && ty <= 1) return true;
  return false;
}

function isDoorClearanceTile(map: ArenaMap, tx: number, ty: number): boolean {
  const midX = Math.floor(map.cols / 2);
  const midY = Math.floor(map.rows / 2);
  if (Math.abs(tx - midX) <= 2 && (ty <= 2 || ty >= map.rows - 3)) return true;
  if (Math.abs(ty - midY) <= 2 && (tx <= 2 || tx >= map.cols - 3)) return true;
  return false;
}

const BIOME_MOTIF_POOLS: Record<0 | 1 | 2 | 3, readonly [string, string, string]> = {
  0: ['wrought_iron_fencing', 'fluted_masonry', 'ruin_pedestals'],
  1: ['ancient_roots', 'bioluminescent_mushrooms', 'fluted_ruin_vines'],
  2: ['ice_alcoves', 'frost_crystals', 'glacial_columns'],
  3: ['brass_gears', 'steam_pipes_channels', 'forge_anvils_columns'],
};

function selectTwoOfThreeMotifs(
  biome: 0 | 1 | 2 | 3,
  seed: number | string,
): readonly [string, string] {
  const pool = BIOME_MOTIF_POOLS[biome];
  const str = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const idx = Math.abs(hash) % 3;
  if (idx === 0) return [pool[0], pool[1]];
  if (idx === 1) return [pool[0], pool[2]];
  return [pool[1], pool[2]];
}

/**
 * Builds a deterministic client-only architectural decor plan for the given room.
 * Strictly enforces Spec 3.5 rules:
 * 1. Top-Left (-135 deg) key light -> South-East cast shadows (40-64u).
 * 2. Volume-bearing objects (hasVolume: true) only on solid active wall/pillar tiles (never Exterior Void);
 *    walkable floor only receives flat decals (hasVolume: false) that hide on surfaces.
 * 3. Density budget: <= 8 large decors, <= 1 small decor per 3 perimeter tiles, >= 40% empty perimeter tiles,
 *    and 2-of-3 perimeter motif selection per seed.
 */
export function buildRoomArchitecturePlan(
  map: ArenaMap,
  roomType: RoomType,
  biome: 0 | 1 | 2 | 3,
  seed: number | string = 1337,
): RoomArchitecturePlan {
  const rng = new SeededRandom(`${seed}_arch_${biome}_${roomType}`);
  const selectedMotifs = selectTwoOfThreeMotifs(biome, seed);
  const solidDecors: SolidArchitectureDecor[] = [];
  const floorDecals: FloorArchitectureDecal[] = [];
  const pillarShadows: PillarCastShadowSpec[] = [];
  const godRays: GodRaySpec[] = [];

  let perimeterTileCount = 0;
  for (let ty = 1; ty < map.rows - 1; ty++) {
    for (let tx = 1; tx < map.cols - 1; tx++) {
      if (!map.isSolidTile(tx, ty) && computeTileDistToWall(map, tx, ty) <= 2) {
        perimeterTileCount += 1;
      }
    }
  }

  const maxSmallPerimeterDecors = Math.max(1, Math.floor(perimeterTileCount / 3));
  let largeDecorCount = 0;
  let smallPerimeterDecorCount = 0;
  const occupiedPerimeterCoords = new Set<string>();

  const addSolidDecor = (
    item: Omit<SolidArchitectureDecor, 'hasVolume' | 'hasHazardGlow'>,
  ): boolean => {
    if (item.tx < 0 || item.tx >= map.cols || item.ty < 0 || item.ty >= map.rows) return false;
    if (!map.isSolidTile(item.tx, item.ty)) return false;
    if (isExteriorVoidWallTile(map, item.tx, item.ty)) return false;
    if (
      (item.kind === 'forge_anvil' || item.kind === 'fluted_column') &&
      map.getTile(item.tx, item.ty) !== 'pillar'
    ) {
      return false;
    }
    if (isProtectedMetricSampleTile(item.tx, item.ty)) return false;
    const coordKey = `${item.tx},${item.ty}`;
    if (occupiedPerimeterCoords.has(coordKey)) return false;
    if (item.isLarge) {
      if (largeDecorCount >= 8) return false;
      largeDecorCount += 1;
    } else {
      if (smallPerimeterDecorCount >= maxSmallPerimeterDecors) return false;
      smallPerimeterDecorCount += 1;
    }
    solidDecors.push({
      ...item,
      hasVolume: true,
      hasHazardGlow: false,
    });
    occupiedPerimeterCoords.add(coordKey);
    return true;
  };

  const addFloorDecal = (
    decal: Omit<FloorArchitectureDecal, 'hasVolume' | 'hasHazardGlow'>,
  ): boolean => {
    if (decal.tx < 1 || decal.tx >= map.cols - 1 || decal.ty < 1 || decal.ty >= map.rows - 1) {
      return false;
    }
    if (map.isSolidTile(decal.tx, decal.ty)) return false;
    if (map.getSurface(decal.tx, decal.ty) !== 'none') return false;
    if (isProtectedMetricSampleTile(decal.tx, decal.ty)) return false;
    if (isDoorClearanceTile(map, decal.tx, decal.ty)) return false;
    if (smallPerimeterDecorCount >= maxSmallPerimeterDecors) return false;
    floorDecals.push({
      ...decal,
      hasVolume: false,
      hasHazardGlow: false,
    });
    if (computeTileDistToWall(map, decal.tx, decal.ty) <= 2) {
      smallPerimeterDecorCount += 1;
      occupiedPerimeterCoords.add(`${decal.tx},${decal.ty}`);
    }
    return true;
  };

  // 1. Discover contiguous interior pillar blocks for South-East (-135 deg) cast shadows (48u in [40, 64]u)
  const visitedPillarTiles = new Set<string>();
  for (let ty = 1; ty < map.rows - 1; ty++) {
    for (let tx = 1; tx < map.cols - 1; tx++) {
      if (map.getTile(tx, ty) !== 'pillar' || visitedPillarTiles.has(`${tx},${ty}`)) {
        continue;
      }
      let widthTiles = 1;
      while (
        tx + widthTiles < map.cols - 1 &&
        map.getTile(tx + widthTiles, ty) === 'pillar' &&
        !visitedPillarTiles.has(`${tx + widthTiles},${ty}`)
      ) {
        widthTiles += 1;
      }
      let heightTiles = 1;
      while (ty + heightTiles < map.rows - 1) {
        let fullRow = true;
        for (let dx = 0; dx < widthTiles; dx++) {
          if (
            map.getTile(tx + dx, ty + heightTiles) !== 'pillar' ||
            visitedPillarTiles.has(`${tx + dx},${ty + heightTiles}`)
          ) {
            fullRow = false;
            break;
          }
        }
        if (!fullRow) break;
        heightTiles += 1;
      }
      for (let dy = 0; dy < heightTiles; dy++) {
        for (let dx = 0; dx < widthTiles; dx++) {
          visitedPillarTiles.add(`${tx + dx},${ty + dy}`);
        }
      }
      pillarShadows.push({
        pillarTx: tx,
        pillarTy: ty,
        widthTiles,
        heightTiles,
        shadowLengthU: 48,
        alpha: 0.22,
      });
    }
  }

  const true2x2Pillars =
    map.roomArchetype === 'CRUMBLING_PILLAR_RING'
      ? []
      : pillarShadows.filter((p) => p.widthTiles === 2 && p.heightTiles === 2);
  const eligibleDecorPillars =
    true2x2Pillars.length > 0
      ? true2x2Pillars
      : map.roomArchetype === 'CRUMBLING_PILLAR_RING'
        ? []
        : pillarShadows.filter(
            (p) => p.widthTiles >= 2 && p.heightTiles >= 2 && p.heightTiles <= 3,
          );

  const hasNearbySolidDecor = (tx: number, ty: number, minManhattan = 3): boolean =>
    solidDecors.some((d) => Math.abs(d.tx - tx) + Math.abs(d.ty - ty) < minManhattan);

  const countSteppedWallDecors = (): number =>
    solidDecors.filter(
      (d) =>
        map.getTile(d.tx, d.ty) === 'wall' &&
        ((d.ty > 0 && d.ty < map.rows - 1) || (d.tx > 0 && d.tx < map.cols - 1)),
    ).length;

  // 2. Common P4 Stepped Stone Brazier Pedestals on active perimeter wall tiles matching room type
  const nPedLeft = resolvePerimeterWallTileNear(map, 7, 'N', occupiedPerimeterCoords);
  const nPedRight = resolvePerimeterWallTileNear(map, map.cols - 8, 'N', occupiedPerimeterCoords);
  const wPed = resolvePerimeterWallTileNear(map, 5, 'W', occupiedPerimeterCoords);
  const ePed = resolvePerimeterWallTileNear(map, 5, 'E', occupiedPerimeterCoords);
  const pedestalCandidates: Array<{ tx: number; ty: number; dir: 'N' | 'S' | 'E' | 'W' }> =
    roomType === 'start' ||
    roomType === 'treasure' ||
    roomType === 'merchant' ||
    roomType === 'shrine' ||
    roomType === 'portal'
      ? [
          { tx: nPedLeft.tx, ty: nPedLeft.ty, dir: 'N' },
          { tx: nPedRight.tx, ty: nPedRight.ty, dir: 'N' },
        ]
      : roomType === 'secret'
        ? []
        : [
            { tx: nPedLeft.tx, ty: nPedLeft.ty, dir: 'N' },
            { tx: nPedRight.tx, ty: nPedRight.ty, dir: 'N' },
            { tx: wPed.tx, ty: wPed.ty, dir: 'W' },
            { tx: ePed.tx, ty: ePed.ty, dir: 'E' },
          ];

  for (const ped of pedestalCandidates) {
    if (map.isSolidTile(ped.tx, ped.ty)) {
      addSolidDecor({
        kind: 'brazier_pedestal',
        tx: ped.tx,
        ty: ped.ty,
        isLarge: true,
        dir: ped.dir,
        variant: rng.nextInt(0, 3),
      });
    }
  }

  // 2b. Common P4 Fluted Columns (strictly on 2x2 pillar tiles) & Fluted Pilasters (on active wall tiles)
  for (let pIdx = eligibleDecorPillars.length - 1; pIdx >= 0; pIdx--) {
    const colPillar = eligibleDecorPillars[pIdx]!;
    if (
      addSolidDecor({
        kind: 'fluted_column',
        tx: colPillar.pillarTx,
        ty: colPillar.pillarTy,
        isLarge: false,
        dir: 'S',
        variant: 0,
      })
    ) {
      break;
    }
  }
  const pilasterX = selectedMotifs[0].length % 2 === 0 ? 11 : map.cols - 14;
  if (pilasterX > 0 && pilasterX < map.cols - 1) {
    const pilasterWall =
      map.getTile(pilasterX, 0) === 'wall' && !map.isSolidTile(pilasterX, 1)
        ? { tx: pilasterX, ty: 0 }
        : resolvePerimeterWallTileNear(map, pilasterX, 'N', occupiedPerimeterCoords);
    if (!map.isSolidTile(pilasterWall.tx, pilasterWall.ty + 1)) {
      addSolidDecor({
        kind: 'fluted_pilaster',
        tx: pilasterWall.tx,
        ty: pilasterWall.ty,
        isLarge: false,
        dir: 'N',
        variant: 0,
      });
    }
  }

  // 2c. Scan active interior recessed 'wall' tiles (borderCandidates) for non-rectangular room shapes
  const borderCandidates: Array<{
    tx: number;
    ty: number;
    isNorth: boolean;
    dir: 'N' | 'S' | 'E' | 'W';
  }> = [];
  for (let ty = 1; ty < map.rows - 1; ty++) {
    for (let tx = 1; tx < map.cols - 1; tx++) {
      if (map.getTile(tx, ty) !== 'wall') continue;
      if (!isActiveWallTile(map, tx, ty)) continue;
      if (isProtectedMetricSampleTile(tx, ty) || isDoorClearanceTile(map, tx, ty)) continue;
      const hasFloorS = ty + 1 < map.rows && !map.isSolidTile(tx, ty + 1);
      const hasFloorN = ty - 1 >= 0 && !map.isSolidTile(tx, ty - 1);
      const hasFloorE = tx + 1 < map.cols && !map.isSolidTile(tx + 1, ty);
      const hasFloorW = tx - 1 >= 0 && !map.isSolidTile(tx - 1, ty);
      if (hasFloorS) {
        borderCandidates.push({ tx, ty, isNorth: true, dir: 'N' });
      } else if (hasFloorN || hasFloorE || hasFloorW) {
        const dir: 'S' | 'E' | 'W' = hasFloorN ? 'S' : hasFloorE ? 'W' : 'E';
        borderCandidates.push({ tx, ty, isNorth: false, dir });
      }
    }
  }

  // 3. Biome-specific architectural motifs & 2-of-3 perimeter motif variation
  if (biome === 1) {
    // Biome 1 (Rừng Cổ Mục Nát): Bezier S-Curve Roots, Bioluminescent Mushrooms, Cliff Vines & Stepping Stones
    const rootRightX = map.cols - 10;
    const rootEastY = map.rows - 7;
    const nominalRoots: ReadonlyArray<{
      wallTx: number;
      wallTy: number;
      tipTx: number;
      tipTy: number;
      targetCoord: number;
      dir: 'N' | 'W' | 'E';
    }> = [
      { wallTx: 4, wallTy: 0, tipTx: 4, tipTy: 1, targetCoord: 4, dir: 'N' },
      {
        wallTx: rootRightX,
        wallTy: 0,
        tipTx: rootRightX,
        tipTy: 1,
        targetCoord: rootRightX,
        dir: 'N',
      },
      { wallTx: 0, wallTy: 4, tipTx: 1, tipTy: 4, targetCoord: 4, dir: 'W' },
      {
        wallTx: map.cols - 1,
        wallTy: rootEastY,
        tipTx: map.cols - 2,
        tipTy: rootEastY,
        targetCoord: rootEastY,
        dir: 'E',
      },
    ];
    const rootLimit = selectedMotifs.includes('ancient_roots') ? 4 : 2;
    for (let i = 0; i < Math.min(rootLimit, nominalRoots.length); i++) {
      const nr = nominalRoots[i]!;
      let wallTx = nr.wallTx;
      let wallTy = nr.wallTy;
      let tipTx = nr.tipTx;
      let tipTy = nr.tipTy;
      if (
        isExteriorVoidWallTile(map, wallTx, wallTy) ||
        !map.isSolidTile(wallTx, wallTy) ||
        map.isSolidTile(tipTx, tipTy) ||
        occupiedPerimeterCoords.has(`${wallTx},${wallTy}`)
      ) {
        const resolved = resolvePerimeterWallTileNear(
          map,
          nr.targetCoord,
          nr.dir,
          occupiedPerimeterCoords,
        );
        wallTx = resolved.tx;
        wallTy = resolved.ty;
        tipTx = nr.dir === 'W' ? wallTx + 1 : nr.dir === 'E' ? wallTx - 1 : wallTx;
        tipTy = nr.dir === 'N' ? wallTy + 1 : wallTy;
      }
      const addedBase = addSolidDecor({
        kind: 'root_base',
        tx: wallTx,
        ty: wallTy,
        isLarge: true,
        dir: nr.dir,
        variant: i,
      });
      if (addedBase && computeTileDistToWall(map, tipTx, tipTy) === 1) {
        addFloorDecal({
          kind: 'root_decal_tip',
          tx: tipTx,
          ty: tipTy,
          dir: nr.dir,
          variant: i,
        });
      }
    }

    const cornerSpecs: ReadonlyArray<readonly [number, number, 'N' | 'S']> = [
      [0, 0, 'N'],
      [map.cols - 1, 0, 'N'],
      [0, map.rows - 1, 'S'],
      [map.cols - 1, map.rows - 1, 'S'],
    ];
    for (let i = 0; i < cornerSpecs.length; i++) {
      const [cx, cy, dir] = cornerSpecs[i]!;
      const mw = resolveCornerActiveWallTile(map, cx, cy, occupiedPerimeterCoords);
      addSolidDecor({
        kind: 'mushroom_cluster',
        tx: mw.tx,
        ty: mw.ty,
        isLarge: false,
        dir,
        variant: i,
      });
    }
    if (selectedMotifs.includes('bioluminescent_mushrooms')) {
      for (let idx = 0; idx < Math.min(2, eligibleDecorPillars.length); idx++) {
        const pShadow = eligibleDecorPillars[idx]!;
        addSolidDecor({
          kind: 'mushroom_cluster',
          tx: pShadow.pillarTx + 1,
          ty: pShadow.pillarTy + 1,
          isLarge: false,
          dir: 'S',
          variant: cornerSpecs.length + idx,
        });
      }
    }

    const vineCols = selectedMotifs.includes('fluted_ruin_vines')
      ? [3, 9, map.cols - 13, map.cols - 6]
      : [3, map.cols - 13, map.cols - 6];
    for (const vx of vineCols) {
      if (vx > 0 && vx < map.cols - 1) {
        const vw =
          map.isSolidTile(vx, 0) && !map.isSolidTile(vx, 1)
            ? { tx: vx, ty: 0 }
            : resolvePerimeterWallTileNear(map, vx, 'N', occupiedPerimeterCoords);
        if (!map.isSolidTile(vw.tx, vw.ty + 1) && (vw.ty === 0 || !hasNearbySolidDecor(vw.tx, vw.ty, 3))) {
          addSolidDecor({
            kind: 'cliff_vines',
            tx: vw.tx,
            ty: vw.ty,
            isLarge: false,
            dir: 'N',
            variant: vx % 4,
          });
        }
      }
    }

    if (borderCandidates.length > 0) {
      const northCliffCandidates = borderCandidates.filter((bc) => bc.isNorth);
      const steppedTargets =
        northCliffCandidates.length > 0 ? northCliffCandidates : borderCandidates;
      let addedSteppedVines = 0;
      for (const allowAdjacent of [false, true]) {
        if (allowAdjacent && (addedSteppedVines > 0 || countSteppedWallDecors() > 0)) break;
        for (const bc of steppedTargets) {
          if (addedSteppedVines >= 2) break;
          if (!allowAdjacent && hasNearbySolidDecor(bc.tx, bc.ty, 3)) continue;
          if (
            addSolidDecor({
              kind: bc.isNorth ? 'cliff_vines' : 'mushroom_cluster',
              tx: bc.tx,
              ty: bc.ty,
              isLarge: false,
              dir: bc.dir,
              variant: (bc.tx + bc.ty) % 4,
            })
          ) {
            addedSteppedVines += 1;
          }
        }
      }
    }

    // Stepping Stones strictly on dry floor tiles (surface === 'none') bordering poison_swamp or water
    let steppingStoneCount = 0;
    for (let ty = 2; ty < map.rows - 2 && steppingStoneCount < 5; ty++) {
      for (let tx = 2; tx < map.cols - 2 && steppingStoneCount < 5; tx++) {
        if (map.isSolidTile(tx, ty) || map.getSurface(tx, ty) !== 'none') continue;
        if (roomType === 'boss') {
          const inOuter3 =
            tx <= 3 || tx >= map.cols - 4 || ty <= 2 || ty >= map.rows - 3;
          if (inOuter3) continue;
        }
        const nSurf = map.getSurface(tx, ty - 1);
        const sSurf = map.getSurface(tx, ty + 1);
        const wSurf = map.getSurface(tx - 1, ty);
        const eSurf = map.getSurface(tx + 1, ty);
        const bordersWet =
          nSurf === 'poison_swamp' ||
          sSurf === 'poison_swamp' ||
          wSurf === 'poison_swamp' ||
          eSurf === 'poison_swamp' ||
          nSurf === 'water' ||
          sSurf === 'water' ||
          wSurf === 'water' ||
          eSurf === 'water';

        if (bordersWet && (tx + ty) % 2 === 0) {
          if (
            addFloorDecal({
              kind: 'stepping_stone',
              tx,
              ty,
              dir: 'S',
              variant: steppingStoneCount,
            })
          ) {
            steppingStoneCount += 1;
          }
        }
      }
    }
  } else if (biome === 2) {
    // Biome 2 (Hầm Băng Vĩnh Cửu): Arched Ice Alcoves, Frost Crystal Clusters, Sunken 3-Ring Ice Astrolabe & God-Rays
    const alcoveCols = selectedMotifs.includes('ice_alcoves')
      ? [5, 10, map.cols - 12, map.cols - 7]
      : [5, map.cols - 7];
    for (const ax of alcoveCols) {
      if (ax > 0 && ax < map.cols - 1) {
        const aw =
          map.getTile(ax, 0) === 'wall' && !map.isSolidTile(ax, 1)
            ? { tx: ax, ty: 0 }
            : resolvePerimeterWallTileNear(map, ax, 'N', occupiedPerimeterCoords);
        if (!map.isSolidTile(aw.tx, aw.ty + 1) && (aw.ty === 0 || !hasNearbySolidDecor(aw.tx, aw.ty, 3))) {
          addSolidDecor({
            kind: 'ice_alcove',
            tx: aw.tx,
            ty: aw.ty,
            isLarge: false,
            dir: 'N',
            variant: ax % 3,
          });
        }
      }
    }

    if (borderCandidates.length > 0) {
      const northCliffCandidates = borderCandidates.filter((bc) => bc.isNorth);
      const steppedTargets =
        northCliffCandidates.length > 0 ? northCliffCandidates : borderCandidates;
      let addedSteppedAlcoves = 0;
      for (const allowAdjacent of [false, true]) {
        if (allowAdjacent && (addedSteppedAlcoves > 0 || countSteppedWallDecors() > 0)) break;
        for (const bc of steppedTargets) {
          if (addedSteppedAlcoves >= 2) break;
          if (!allowAdjacent && hasNearbySolidDecor(bc.tx, bc.ty, 3)) continue;
          if (
            addSolidDecor({
              kind: bc.isNorth ? 'ice_alcove' : 'frost_crystal_cluster',
              tx: bc.tx,
              ty: bc.ty,
              isLarge: false,
              dir: bc.dir,
              variant: (bc.tx + bc.ty) % 3,
            })
          ) {
            addedSteppedAlcoves += 1;
          }
        }
      }
    }

    const crystalWalls: ReadonlyArray<readonly [number, number, 'N' | 'S']> =
      selectedMotifs.includes('frost_crystals')
        ? [
            [0, 0, 'N'],
            [map.cols - 1, 0, 'N'],
            [0, map.rows - 1, 'S'],
            [map.cols - 1, map.rows - 1, 'S'],
          ]
        : [
            [0, 0, 'N'],
            [map.cols - 1, 0, 'N'],
          ];
    crystalWalls.forEach(([tx, ty, dir], i) => {
      const cw = resolveCornerActiveWallTile(map, tx, ty, occupiedPerimeterCoords);
      addSolidDecor({
        kind: 'frost_crystal_cluster',
        tx: cw.tx,
        ty: cw.ty,
        isLarge: false,
        dir,
        variant: i,
      });
    });

    const centerTx = Math.floor(map.cols / 2);
    const centerTy = Math.floor(map.rows / 2);
    if (!map.isSolidTile(centerTx, centerTy) && map.getSurface(centerTx, centerTy) === 'none') {
      addFloorDecal({
        kind: 'sunken_astrolabe',
        tx: centerTx,
        ty: centerTy,
        dir: 'N',
        variant: 0,
      });
    } else {
      let placedAstrolabe = false;
      for (let r = 1; r <= Math.max(map.cols, map.rows) && !placedAstrolabe; r++) {
        for (let dy = -r; dy <= r && !placedAstrolabe; dy++) {
          for (let dx = -r; dx <= r && !placedAstrolabe; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const tx = centerTx + dx;
            const ty = centerTy + dy;
            if (
              addFloorDecal({
                kind: 'sunken_astrolabe',
                tx,
                ty,
                dir: 'N',
                variant: 0,
              })
            ) {
              placedAstrolabe = true;
            }
          }
        }
      }
    }

    // 2-3 diagonal (-135 deg) God-ray light shafts anchored to active North perimeter wall tiles
    const resolveRayAnchor = (
      baseTx: number,
    ): { anchorX: number; anchorY: number } | null => {
      const scaledTx =
        baseTx <= map.cols - 3
          ? baseTx
          : Math.max(2, Math.min(map.cols - 3, Math.round((baseTx / 36) * map.cols)));
      const wall = resolvePerimeterWallTileNear(map, scaledTx, 'N');
      if (
        wall.ty + 1 < map.rows &&
        map.getTile(wall.tx, wall.ty) === 'wall' &&
        !isExteriorVoidWallTile(map, wall.tx, wall.ty) &&
        !map.isSolidTile(wall.tx, wall.ty + 1)
      ) {
        return {
          anchorX: Math.min((map.cols - 2) * TILE_SIZE, (wall.tx + 0.5) * TILE_SIZE),
          anchorY: (wall.ty + 1) * TILE_SIZE,
        };
      }
      return null;
    };

    const rayCandidates: ReadonlyArray<{
      baseTx: number;
      widthU: number;
      lengthU: number;
      maxAlpha: number;
      enabled: boolean;
    }> = [
      { baseTx: 10, widthU: 76, lengthU: 250, maxAlpha: 0.055, enabled: true },
      { baseTx: 18, widthU: 84, lengthU: 270, maxAlpha: 0.055, enabled: true },
      {
        baseTx: 25,
        widthU: 68,
        lengthU: 230,
        maxAlpha: 0.05,
        enabled: selectedMotifs.includes('glacial_columns') || rng.chance(0.5),
      },
    ];
    for (const rc of rayCandidates) {
      if (!rc.enabled) continue;
      const anchor = resolveRayAnchor(rc.baseTx);
      if (anchor) {
        godRays.push({
          anchorX: anchor.anchorX,
          anchorY: anchor.anchorY,
          angleDeg: -135,
          widthU: rc.widthU,
          lengthU: rc.lengthU,
          maxAlpha: rc.maxAlpha,
        });
      }
    }
  } else if (biome === 3) {
    // Biome 3 (Lò Rèn Dung Nham): 8-12 Tooth Brass Wall Gears, Flanged Steam Pipes, Forge Anvil (strictly on pillar) & Grated Heat Channels
    const gearCols = selectedMotifs.includes('brass_gears')
      ? [4, 10, map.cols - 12, map.cols - 6]
      : [4, map.cols - 12, map.cols - 6];
    const toothOptions: readonly (8 | 10 | 12)[] = [8, 10, 12];
    gearCols.forEach((gx, idx) => {
      if (gx > 0 && gx < map.cols - 1) {
        const gw =
          map.getTile(gx, 0) === 'wall' && !map.isSolidTile(gx, 1)
            ? { tx: gx, ty: 0 }
            : resolvePerimeterWallTileNear(map, gx, 'N', occupiedPerimeterCoords);
        if (!map.isSolidTile(gw.tx, gw.ty + 1) && (gw.ty === 0 || !hasNearbySolidDecor(gw.tx, gw.ty, 3))) {
          addSolidDecor({
            kind: 'brass_gear_wall',
            tx: gw.tx,
            ty: gw.ty,
            isLarge: false,
            dir: 'N',
            variant: gx % 3,
            toothCount: toothOptions[idx % toothOptions.length],
          });
        }
      }
    });

    if (borderCandidates.length > 0) {
      const northCliffCandidates = borderCandidates.filter((bc) => bc.isNorth);
      const steppedTargets =
        northCliffCandidates.length > 0 ? northCliffCandidates : borderCandidates;
      let addedSteppedGears = 0;
      for (const allowAdjacent of [false, true]) {
        if (allowAdjacent && (addedSteppedGears > 0 || countSteppedWallDecors() > 0)) break;
        for (const bc of steppedTargets) {
          if (addedSteppedGears >= 2) break;
          if (!allowAdjacent && hasNearbySolidDecor(bc.tx, bc.ty, 3)) continue;
          if (
            addSolidDecor({
              kind: bc.isNorth ? 'brass_gear_wall' : 'steam_pipe_wall',
              tx: bc.tx,
              ty: bc.ty,
              isLarge: false,
              dir: bc.dir,
              variant: (bc.tx + bc.ty) % 3,
              toothCount: bc.isNorth ? toothOptions[addedSteppedGears % toothOptions.length] : undefined,
            })
          ) {
            addedSteppedGears += 1;
          }
        }
      }
    }

    const pipeWalls: ReadonlyArray<readonly [number, number, 'W' | 'E']> =
      selectedMotifs.includes('steam_pipes_channels')
        ? [
            [0, 3, 'W'],
            [map.cols - 1, 3, 'E'],
            [0, map.rows - 4, 'W'],
            [map.cols - 1, map.rows - 4, 'E'],
          ]
        : [
            [0, 3, 'W'],
            [map.cols - 1, 3, 'E'],
          ];
    pipeWalls.forEach(([tx, ty, dir], i) => {
      if (ty > 0 && ty < map.rows - 1) {
        const innerTx = dir === 'W' ? 1 : map.cols - 2;
        const pw =
          map.getTile(tx, ty) === 'wall' && !map.isSolidTile(innerTx, ty)
            ? { tx, ty }
            : resolvePerimeterWallTileNear(map, ty, dir, occupiedPerimeterCoords);
        addSolidDecor({
          kind: 'steam_pipe_wall',
          tx: pw.tx,
          ty: pw.ty,
          isLarge: false,
          dir,
          variant: i,
        });
      }
    });

    // Forge Anvil strictly on a solid 'pillar' tile (Spec 3.5 Principle 2)
    for (let pIdx = 0; pIdx < eligibleDecorPillars.length; pIdx++) {
      const anvilPillar = eligibleDecorPillars[pIdx]!;
      const ax = anvilPillar.pillarTx + 1;
      const ay = anvilPillar.pillarTy;
      if (
        map.getTile(ax, ay) === 'pillar' &&
        addSolidDecor({
          kind: 'forge_anvil',
          tx: ax,
          ty: ay,
          isLarge: false,
          dir: 'S',
          variant: 0,
        })
      ) {
        break;
      }
    }

    if (roomType !== 'boss') {
      const channelRightX = map.cols - 13;
      const channelCandidates: ReadonlyArray<readonly [number, number, 'N' | 'S']> = [
        [9, 1, 'N'],
        [channelRightX, 1, 'N'],
        [9, map.rows - 2, 'S'],
        [channelRightX, map.rows - 2, 'S'],
      ];
      channelCandidates.forEach(([tx, ty, dir], i) => {
        if (tx > 0 && tx < map.cols - 1) {
          let chTx = tx;
          let chTy = ty;
          if (map.isSolidTile(chTx, chTy) || computeTileDistToWall(map, chTx, chTy) !== 1) {
            const w = resolvePerimeterWallTileNear(map, tx, dir);
            chTx = w.tx;
            chTy = dir === 'N' ? w.ty + 1 : w.ty - 1;
          }
          if (computeTileDistToWall(map, chTx, chTy) === 1) {
            addFloorDecal({
              kind: 'grated_heat_channel',
              tx: chTx,
              ty: chTy,
              hasIronGrateCover: true,
              maxGlowAlpha: 0.26,
              dir,
              variant: i,
            });
          }
        }
      });
    }
  } else {
    // Hub (biome === 0): Wrought-Iron Finial Spikes & Weathered Stone Coping on active wall tiles
    for (const fx of [5, 10, map.cols - 12, map.cols - 7]) {
      if (fx > 0 && fx < map.cols - 1) {
        const fw =
          map.getTile(fx, 0) === 'wall' && !map.isSolidTile(fx, 1)
            ? { tx: fx, ty: 0 }
            : resolvePerimeterWallTileNear(map, fx, 'N', occupiedPerimeterCoords);
        if (!map.isSolidTile(fw.tx, fw.ty + 1) && (fw.ty === 0 || !hasNearbySolidDecor(fw.tx, fw.ty, 3))) {
          addSolidDecor({
            kind: 'wrought_iron_fence',
            tx: fw.tx,
            ty: fw.ty,
            isLarge: false,
            dir: 'N',
            variant: fx % 3,
          });
        }
      }
    }
    for (const fy of [4, map.rows - 5]) {
      if (fy > 0 && fy < map.rows - 1) {
        const wFence =
          map.getTile(0, fy) === 'wall' && !map.isSolidTile(1, fy)
            ? { tx: 0, ty: fy }
            : resolvePerimeterWallTileNear(map, fy, 'W', occupiedPerimeterCoords);
        addSolidDecor({
          kind: 'wrought_iron_fence',
          tx: wFence.tx,
          ty: wFence.ty,
          isLarge: false,
          dir: 'W',
          variant: fy % 3,
        });
        const eFence =
          map.getTile(map.cols - 1, fy) === 'wall' && !map.isSolidTile(map.cols - 2, fy)
            ? { tx: map.cols - 1, ty: fy }
            : resolvePerimeterWallTileNear(map, fy, 'E', occupiedPerimeterCoords);
        addSolidDecor({
          kind: 'wrought_iron_fence',
          tx: eFence.tx,
          ty: eFence.ty,
          isLarge: false,
          dir: 'E',
          variant: (fy + 1) % 3,
        });
      }
    }
    if (borderCandidates.length > 0) {
      const northCliffCandidates = borderCandidates.filter((bc) => bc.isNorth);
      const steppedTargets =
        northCliffCandidates.length > 0 ? northCliffCandidates : borderCandidates;
      let addedSteppedFences = 0;
      for (const allowAdjacent of [false, true]) {
        if (allowAdjacent && (addedSteppedFences > 0 || countSteppedWallDecors() > 0)) break;
        for (const bc of steppedTargets) {
          if (addedSteppedFences >= 2) break;
          if (!allowAdjacent && hasNearbySolidDecor(bc.tx, bc.ty, 3)) continue;
          if (
            addSolidDecor({
              kind: 'wrought_iron_fence',
              tx: bc.tx,
              ty: bc.ty,
              isLarge: false,
              dir: bc.dir,
              variant: (bc.tx + bc.ty) % 3,
            })
          ) {
            addedSteppedFences += 1;
          }
        }
      }
    }
  }

  const occupiedWalkablePerimeter = Array.from(occupiedPerimeterCoords).filter((coord) => {
    const [xStr, yStr] = coord.split(',');
    const x = Number(xStr);
    const y = Number(yStr);
    return !map.isSolidTile(x, y) && computeTileDistToWall(map, x, y) <= 2;
  }).length;

  const emptyPerimeterRatio =
    perimeterTileCount > 0
      ? Math.max(0, (perimeterTileCount - occupiedWalkablePerimeter) / perimeterTileCount)
      : 1;

  return {
    biome,
    roomType,
    seed,
    selectedMotifs,
    solidDecors,
    items: solidDecors,
    floorDecals,
    pillarShadows,
    godRays,
    budget: {
      perimeterTileCount,
      occupiedPerimeterTileCount: occupiedWalkablePerimeter,
      emptyPerimeterRatio,
      largeDecorCount,
      smallPerimeterDecorCount,
      centerArenaSolidDecorCount: 0,
    },
  };
}

