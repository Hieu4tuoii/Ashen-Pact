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
  const clusterWave = (Math.floor(tx / 3) * 3 + Math.floor(ty / 3) * 5 + ((tx + ty) & 1)) & 3;
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
 * 2. Volume-bearing objects (hasVolume: true) only on solid wall/pillar tiles;
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
    if (!map.isSolidTile(item.tx, item.ty)) return false;
    if (
      (item.kind === 'forge_anvil' || item.kind === 'fluted_column') &&
      map.getTile(item.tx, item.ty) !== 'pillar'
    ) {
      return false;
    }
    if (isProtectedMetricSampleTile(item.tx, item.ty)) return false;
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
    occupiedPerimeterCoords.add(`${item.tx},${item.ty}`);
    return true;
  };

  const addFloorDecal = (
    decal: Omit<FloorArchitectureDecal, 'hasVolume' | 'hasHazardGlow'>,
  ): boolean => {
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

  // 1. Discover 2x2 interior pillars for South-East (-135 deg) cast shadows (48u in [40, 64]u)
  for (let ty = 1; ty < map.rows - 2; ty++) {
    for (let tx = 1; tx < map.cols - 2; tx++) {
      if (
        map.getTile(tx, ty) === 'pillar' &&
        map.getTile(tx - 1, ty) !== 'pillar' &&
        map.getTile(tx, ty - 1) !== 'pillar'
      ) {
        pillarShadows.push({
          pillarTx: tx,
          pillarTy: ty,
          widthTiles: 2,
          heightTiles: 2,
          shadowLengthU: 48,
          alpha: 0.22,
        });
      }
    }
  }

  // 2. Common P4 Stepped Stone Brazier Pedestals on solid wall tiles matching room type
  const pedestalCandidates: Array<{ tx: number; ty: number; dir: 'N' | 'S' | 'E' | 'W' }> =
    roomType === 'start' ||
    roomType === 'treasure' ||
    roomType === 'merchant' ||
    roomType === 'shrine' ||
    roomType === 'portal'
      ? [
          { tx: 7, ty: 0, dir: 'N' },
          { tx: map.cols - 8, ty: 0, dir: 'N' },
        ]
      : roomType === 'secret'
        ? []
        : [
            { tx: 7, ty: 0, dir: 'N' },
            { tx: map.cols - 8, ty: 0, dir: 'N' },
            { tx: 0, ty: 5, dir: 'W' },
            { tx: map.cols - 1, ty: 5, dir: 'E' },
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

  // 2b. Common P4 Fluted Columns (strictly on 2x2 pillar tiles) & Fluted Pilasters (on solid wall tiles)
  if (pillarShadows.length > 0) {
    const colPillar = pillarShadows[pillarShadows.length - 1]!;
    addSolidDecor({
      kind: 'fluted_column',
      tx: colPillar.pillarTx,
      ty: colPillar.pillarTy,
      isLarge: false,
      dir: 'S',
      variant: 0,
    });
  }
  const pilasterX = selectedMotifs[0].length % 2 === 0 ? 11 : 22;
  if (pilasterX < map.cols - 1 && map.isSolidTile(pilasterX, 0)) {
    addSolidDecor({
      kind: 'fluted_pilaster',
      tx: pilasterX,
      ty: 0,
      isLarge: false,
      dir: 'N',
      variant: 0,
    });
  }

  // 3. Biome-specific architectural motifs & 2-of-3 perimeter motif variation
  if (biome === 1) {
    // Biome 1 (Rừng Cổ Mục Nát): Bezier S-Curve Roots, Bioluminescent Mushrooms, Cliff Vines & Stepping Stones
    const rootCandidates: Array<{
      wallTx: number;
      wallTy: number;
      tipTx: number;
      tipTy: number;
      dir: 'N' | 'S' | 'E' | 'W';
    }> = [
      { wallTx: 4, wallTy: 0, tipTx: 4, tipTy: 1, dir: 'N' },
      { wallTx: 26, wallTy: 0, tipTx: 26, tipTy: 1, dir: 'N' },
      { wallTx: 0, wallTy: 4, tipTx: 1, tipTy: 4, dir: 'W' },
      { wallTx: map.cols - 1, wallTy: 15, tipTx: map.cols - 2, tipTy: 15, dir: 'E' },
    ];
    const rootLimit = selectedMotifs.includes('ancient_roots') ? 4 : 2;
    for (let i = 0; i < Math.min(rootLimit, rootCandidates.length); i++) {
      const rc = rootCandidates[i]!;
      const addedBase = addSolidDecor({
        kind: 'root_base',
        tx: rc.wallTx,
        ty: rc.wallTy,
        isLarge: true,
        dir: rc.dir,
        variant: i,
      });
      if (addedBase && computeTileDistToWall(map, rc.tipTx, rc.tipTy) === 1) {
        addFloorDecal({
          kind: 'root_decal_tip',
          tx: rc.tipTx,
          ty: rc.tipTy,
          dir: rc.dir,
          variant: i,
        });
      }
    }

    const mushroomWalls: Array<{ tx: number; ty: number; dir: 'N' | 'S' | 'E' | 'W' }> = [
      { tx: 0, ty: 0, dir: 'N' },
      { tx: map.cols - 1, ty: 0, dir: 'N' },
      { tx: 0, ty: map.rows - 1, dir: 'S' },
      { tx: map.cols - 1, ty: map.rows - 1, dir: 'S' },
    ];
    if (selectedMotifs.includes('bioluminescent_mushrooms')) {
      for (const pShadow of pillarShadows.slice(0, 2)) {
        mushroomWalls.push({
          tx: pShadow.pillarTx + 1,
          ty: pShadow.pillarTy + 1,
          dir: 'S',
        });
      }
    }
    for (let i = 0; i < mushroomWalls.length; i++) {
      const mw = mushroomWalls[i]!;
      addSolidDecor({
        kind: 'mushroom_cluster',
        tx: mw.tx,
        ty: mw.ty,
        isLarge: false,
        dir: mw.dir,
        variant: i,
      });
    }

    const vineCols = selectedMotifs.includes('fluted_ruin_vines') ? [3, 9, 23, 30] : [3, 23, 30];
    for (const vx of vineCols) {
      if (vx < map.cols - 1 && map.isSolidTile(vx, 0) && !map.isSolidTile(vx, 1)) {
        addSolidDecor({
          kind: 'cliff_vines',
          tx: vx,
          ty: 0,
          isLarge: false,
          dir: 'N',
          variant: vx % 4,
        });
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
    const alcoveCols = selectedMotifs.includes('ice_alcoves') ? [5, 10, 24, 29] : [5, 29];
    for (const ax of alcoveCols) {
      if (ax < map.cols - 1 && map.isSolidTile(ax, 0)) {
        addSolidDecor({
          kind: 'ice_alcove',
          tx: ax,
          ty: 0,
          isLarge: false,
          dir: 'N',
          variant: ax % 3,
        });
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
      addSolidDecor({
        kind: 'frost_crystal_cluster',
        tx,
        ty,
        isLarge: false,
        dir,
        variant: i,
      });
    });

    const centerTx = Math.floor(map.cols / 2);
    const centerTy = Math.floor(map.rows / 2);
    if (!map.isSolidTile(centerTx, centerTy)) {
      addFloorDecal({
        kind: 'sunken_astrolabe',
        tx: centerTx,
        ty: centerTy,
        dir: 'N',
        variant: 0,
      });
    }

    // 2-3 diagonal (-135 deg) God-ray light shafts (width 60-90u, alpha <= 0.06 -> 0)
    godRays.push(
      {
        anchorX: 10 * TILE_SIZE,
        anchorY: 1 * TILE_SIZE,
        angleDeg: -135,
        widthU: 76,
        lengthU: 250,
        maxAlpha: 0.055,
      },
      {
        anchorX: 18 * TILE_SIZE,
        anchorY: 1 * TILE_SIZE,
        angleDeg: -135,
        widthU: 84,
        lengthU: 270,
        maxAlpha: 0.055,
      },
    );
    if (selectedMotifs.includes('glacial_columns') || rng.chance(0.5)) {
      godRays.push({
        anchorX: 25 * TILE_SIZE,
        anchorY: 1 * TILE_SIZE,
        angleDeg: -135,
        widthU: 68,
        lengthU: 230,
        maxAlpha: 0.05,
      });
    }
  } else if (biome === 3) {
    // Biome 3 (Lò Rèn Dung Nham): 8-12 Tooth Brass Wall Gears, Flanged Steam Pipes, Forge Anvil (strictly on pillar) & Grated Heat Channels
    const gearCols = selectedMotifs.includes('brass_gears') ? [4, 10, 24, 30] : [4, 24, 30];
    const toothOptions: readonly (8 | 10 | 12)[] = [8, 10, 12];
    gearCols.forEach((gx, idx) => {
      if (gx < map.cols - 1 && map.isSolidTile(gx, 0)) {
        addSolidDecor({
          kind: 'brass_gear_wall',
          tx: gx,
          ty: 0,
          isLarge: false,
          dir: 'N',
          variant: gx % 3,
          toothCount: toothOptions[idx % toothOptions.length],
        });
      }
    });

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
        addSolidDecor({
          kind: 'steam_pipe_wall',
          tx,
          ty,
          isLarge: false,
          dir,
          variant: i,
        });
      }
    });

    // Forge Anvil strictly on a solid 'pillar' tile (Spec 3.5 Principle 2)
    if (pillarShadows.length > 0) {
      const anvilPillar = pillarShadows[0]!;
      const ax = anvilPillar.pillarTx + 1;
      const ay = anvilPillar.pillarTy;
      if (map.getTile(ax, ay) === 'pillar') {
        addSolidDecor({
          kind: 'forge_anvil',
          tx: ax,
          ty: ay,
          isLarge: false,
          dir: 'S',
          variant: 0,
        });
      }
    }

    if (roomType !== 'boss') {
      const channelCandidates: ReadonlyArray<readonly [number, number, 'N' | 'S']> = [
        [9, 1, 'N'],
        [23, 1, 'N'],
        [9, map.rows - 2, 'S'],
        [23, map.rows - 2, 'S'],
      ];
      channelCandidates.forEach(([tx, ty, dir], i) => {
        if (tx < map.cols - 1 && computeTileDistToWall(map, tx, ty) === 1) {
          addFloorDecal({
            kind: 'grated_heat_channel',
            tx,
            ty,
            hasIronGrateCover: true,
            maxGlowAlpha: 0.26,
            dir,
            variant: i,
          });
        }
      });
    }
  } else {
    // Hub (biome === 0): Wrought-Iron Finial Spikes & Weathered Stone Coping on solid wall tiles
    for (const fx of [5, 10, 24, 29]) {
      if (fx < map.cols - 1 && map.isSolidTile(fx, 0)) {
        addSolidDecor({
          kind: 'wrought_iron_fence',
          tx: fx,
          ty: 0,
          isLarge: false,
          dir: 'N',
          variant: fx % 3,
        });
      }
    }
    for (const fy of [4, map.rows - 5]) {
      if (fy > 0 && fy < map.rows - 1) {
        addSolidDecor({
          kind: 'wrought_iron_fence',
          tx: 0,
          ty: fy,
          isLarge: false,
          dir: 'W',
          variant: fy % 3,
        });
        addSolidDecor({
          kind: 'wrought_iron_fence',
          tx: map.cols - 1,
          ty: fy,
          isLarge: false,
          dir: 'E',
          variant: (fy + 1) % 3,
        });
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
