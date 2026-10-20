import {
  type ArenaMap,
  type RoomType,
  SeededRandom,
  TILE_SIZE,
} from '@ashen-pact/shared';
import { ENV_PALETTE, PALETTE } from '../art/palette.js';

export type SolidDecorKind =
  | 'brazier_pedestal'
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
  isLarge: boolean;
  dir: 'N' | 'S' | 'E' | 'W';
  variant: number;
}

export interface FloorArchitectureDecal {
  kind: FloorDecalKind;
  tx: number;
  ty: number;
  hasVolume: false;
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
  solidDecors: SolidArchitectureDecor[];
  floorDecals: FloorArchitectureDecal[];
  pillarShadows: PillarCastShadowSpec[];
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
 *   - distToWall === 1: variant 2 (recessed iron drainage grate) every 8th hash, else alternating 0 (1x1 slab) & 1 (2x2 paver)
 *   - distToWall === 2: variant 3 (transition slab with faded mortar seams)
 * - Center Arena (distToWall > 2): variants 4..7 (smooth monolithic floor with 3-4 tile cluster wave)
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

function isProtectedMetricSampleTile(tx: number, ty: number): boolean {
  // Keep photometric floor/wall sample rects unobstructed across all scenes
  if (tx >= 12 && tx <= 14 && ty >= 9 && ty <= 11) return true;
  if (tx >= 5 && tx <= 7 && ty >= 5 && ty <= 11) return true;
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

/**
 * Builds a deterministic client-only architectural decor plan for the given room.
 * Strictly enforces Spec 3.5 rules:
 * 1. Top-Left (-135 deg) key light -> South-East cast shadows.
 * 2. Volume-bearing objects (hasVolume: true) only on solid wall/pillar tiles;
 *    walkable floor only receives flat decals (hasVolume: false) that hide on surfaces.
 * 3. Density budget: <= 8 large decors, <= 1 small decor per 3 perimeter tiles, >= 40% empty perimeter tiles.
 */
export function buildRoomArchitecturePlan(
  map: ArenaMap,
  roomType: RoomType,
  biome: 0 | 1 | 2 | 3,
  seed: number | string = 1337,
): RoomArchitecturePlan {
  const rng = new SeededRandom(`${seed}_arch_${biome}_${roomType}`);
  const solidDecors: SolidArchitectureDecor[] = [];
  const floorDecals: FloorArchitectureDecal[] = [];
  const pillarShadows: PillarCastShadowSpec[] = [];

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

  const addSolidDecor = (item: SolidArchitectureDecor): boolean => {
    if (!map.isSolidTile(item.tx, item.ty)) return false;
    if (isProtectedMetricSampleTile(item.tx, item.ty)) return false;
    if (item.isLarge) {
      if (largeDecorCount >= 8) return false;
      largeDecorCount += 1;
    } else {
      if (smallPerimeterDecorCount >= maxSmallPerimeterDecors) return false;
      smallPerimeterDecorCount += 1;
    }
    solidDecors.push(item);
    occupiedPerimeterCoords.add(`${item.tx},${item.ty}`);
    return true;
  };

  const addFloorDecal = (decal: FloorArchitectureDecal): boolean => {
    if (map.isSolidTile(decal.tx, decal.ty)) return false;
    if (map.getSurface(decal.tx, decal.ty) !== 'none') return false;
    if (isProtectedMetricSampleTile(decal.tx, decal.ty)) return false;
    if (isDoorClearanceTile(map, decal.tx, decal.ty)) return false;
    if (smallPerimeterDecorCount >= maxSmallPerimeterDecors) return false;
    floorDecals.push(decal);
    if (computeTileDistToWall(map, decal.tx, decal.ty) <= 2) {
      smallPerimeterDecorCount += 1;
      occupiedPerimeterCoords.add(`${decal.tx},${decal.ty}`);
    }
    return true;
  };

  // 1. Discover 2x2 interior pillars for South-East (-135 deg) cast shadows
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
          shadowLengthU: 44,
          alpha: 0.22,
        });
      }
    }
  }

  // 2. Common P4 Stepped Stone Brazier Pedestals on solid wall tiles
  const pedestalCandidates: Array<{ tx: number; ty: number; dir: 'N' | 'S' | 'E' | 'W' }> =
    roomType === 'start' || roomType === 'treasure' || roomType === 'merchant' || roomType === 'shrine'
      ? [
          { tx: 7, ty: 0, dir: 'N' },
          { tx: map.cols - 8, ty: 0, dir: 'N' },
        ]
      : roomType === 'boss'
        ? [
            { tx: 6, ty: 0, dir: 'N' },
            { tx: map.cols - 7, ty: 0, dir: 'N' },
            { tx: 0, ty: 5, dir: 'W' },
            { tx: map.cols - 1, ty: 5, dir: 'E' },
          ]
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
        hasVolume: true,
        isLarge: true,
        dir: ped.dir,
        variant: rng.nextInt(0, 3),
      });
    }
  }

  // 3. Biome-specific architectural motifs
  if (biome === 1) {
    // Biome 1 (Rừng Cổ Mục Nát) — Golden Room:
    // A. Bezier S-Curve Ancient Roots on wall tiles with flat 2u floor decal tips on distToWall === 1
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

    for (let i = 0; i < rootCandidates.length; i++) {
      const rc = rootCandidates[i]!;
      const addedBase = addSolidDecor({
        kind: 'root_base',
        tx: rc.wallTx,
        ty: rc.wallTy,
        hasVolume: true,
        isLarge: true,
        dir: rc.dir,
        variant: i,
      });
      if (addedBase && computeTileDistToWall(map, rc.tipTx, rc.tipTy) === 1) {
        addFloorDecal({
          kind: 'root_decal_tip',
          tx: rc.tipTx,
          ty: rc.tipTy,
          hasVolume: false,
          dir: rc.dir,
          variant: i,
        });
      }
    }

    // B. Bioluminescent Mushroom Clusters on wall corners & pillar bases (solid tiles only)
    const mushroomWalls: Array<{ tx: number; ty: number; dir: 'N' | 'S' | 'E' | 'W' }> = [
      { tx: 0, ty: 0, dir: 'N' },
      { tx: map.cols - 1, ty: 0, dir: 'N' },
      { tx: 0, ty: map.rows - 1, dir: 'S' },
      { tx: map.cols - 1, ty: map.rows - 1, dir: 'S' },
    ];
    for (const pShadow of pillarShadows.slice(0, 2)) {
      mushroomWalls.push({
        tx: pShadow.pillarTx + 1,
        ty: pShadow.pillarTy + 1,
        dir: 'S',
      });
    }
    for (let i = 0; i < mushroomWalls.length; i++) {
      const mw = mushroomWalls[i]!;
      addSolidDecor({
        kind: 'mushroom_cluster',
        tx: mw.tx,
        ty: mw.ty,
        hasVolume: true,
        isLarge: false,
        dir: mw.dir,
        variant: i,
      });
    }

    // C. Cliff Vines on North Wall South Cliff Face (!hasS)
    for (const vx of [3, 9, 23, 30]) {
      if (vx < map.cols - 1 && map.isSolidTile(vx, 0) && !map.isSolidTile(vx, 1)) {
        addSolidDecor({
          kind: 'cliff_vines',
          tx: vx,
          ty: 0,
          hasVolume: true,
          isLarge: false,
          dir: 'N',
          variant: vx % 4,
        });
      }
    }

    // D. Stepping Stones strictly on dry floor tiles (surface === 'none') bordering poison_swamp or water
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
              hasVolume: false,
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
    // Biome 2 (Hầm Băng Vĩnh Cửu): Arched Ice Alcoves, Frost Crystal Clusters & Sunken 3-Ring Ice Astrolabe
    for (const ax of [5, 10, 24, 29]) {
      if (ax < map.cols - 1 && map.isSolidTile(ax, 0)) {
        addSolidDecor({ kind: 'ice_alcove', tx: ax, ty: 0, hasVolume: true, isLarge: false, dir: 'N', variant: ax % 3 });
      }
    }
    const crystalWalls: ReadonlyArray<readonly [number, number, 'N' | 'S']> = [
      [0, 0, 'N'],
      [map.cols - 1, 0, 'N'],
      [0, map.rows - 1, 'S'],
      [map.cols - 1, map.rows - 1, 'S'],
    ];
    crystalWalls.forEach(([tx, ty, dir], i) => {
      addSolidDecor({ kind: 'frost_crystal_cluster', tx, ty, hasVolume: true, isLarge: false, dir, variant: i });
    });
    const centerTx = Math.floor(map.cols / 2);
    const centerTy = Math.floor(map.rows / 2);
    if (!map.isSolidTile(centerTx, centerTy)) {
      addFloorDecal({ kind: 'sunken_astrolabe', tx: centerTx, ty: centerTy, hasVolume: false, dir: 'N', variant: 0 });
    }
  } else if (biome === 3) {
    // Biome 3 (Lò Rèn Dung Nham): Brass Wall Gears, Flanged Steam Pipes & Grated Heat Channels
    for (const gx of [4, 10, 24, 30]) {
      if (gx < map.cols - 1 && map.isSolidTile(gx, 0)) {
        addSolidDecor({ kind: 'brass_gear_wall', tx: gx, ty: 0, hasVolume: true, isLarge: false, dir: 'N', variant: gx % 3 });
      }
    }
    const pipeWalls: ReadonlyArray<readonly [number, number, 'W' | 'E']> = [
      [0, 3, 'W'],
      [map.cols - 1, 3, 'E'],
      [0, map.rows - 4, 'W'],
      [map.cols - 1, map.rows - 4, 'E'],
    ];
    pipeWalls.forEach(([tx, ty, dir], i) => {
      if (ty > 0 && ty < map.rows - 1) {
        addSolidDecor({ kind: 'steam_pipe_wall', tx, ty, hasVolume: true, isLarge: false, dir, variant: i });
      }
    });
    if (roomType !== 'boss') {
      const channelCandidates: ReadonlyArray<readonly [number, number, 'N' | 'S']> = [
        [9, 1, 'N'],
        [23, 1, 'N'],
        [9, map.rows - 2, 'S'],
        [23, map.rows - 2, 'S'],
      ];
      channelCandidates.forEach(([tx, ty, dir], i) => {
        if (tx < map.cols - 1 && computeTileDistToWall(map, tx, ty) === 1) {
          addFloorDecal({ kind: 'grated_heat_channel', tx, ty, hasVolume: false, dir, variant: i });
        }
      });
    }
  } else {
    // Hub (biome === 0): Wrought-Iron Finial Spikes & Weathered Stone Coping on solid wall tiles
    for (const fx of [5, 10, 24, 29]) {
      if (fx < map.cols - 1 && map.isSolidTile(fx, 0)) {
        addSolidDecor({ kind: 'wrought_iron_fence', tx: fx, ty: 0, hasVolume: true, isLarge: false, dir: 'N', variant: fx % 3 });
      }
    }
    for (const fy of [4, map.rows - 5]) {
      if (fy > 0 && fy < map.rows - 1) {
        addSolidDecor({ kind: 'wrought_iron_fence', tx: 0, ty: fy, hasVolume: true, isLarge: false, dir: 'W', variant: fy % 3 });
        addSolidDecor({ kind: 'wrought_iron_fence', tx: map.cols - 1, ty: fy, hasVolume: true, isLarge: false, dir: 'E', variant: (fy + 1) % 3 });
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
    solidDecors,
    floorDecals,
    pillarShadows,
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

/**
 * Renders the room's architectural overlays (pillar South-East cast shadows,
 * flat floor decals on dry tiles, and wall/pillar architectural motifs)
 * onto the arena ground composite canvas.
 */
export function renderBiomeArchitectureToComposite(
  ctx: CanvasRenderingContext2D,
  map: ArenaMap,
  plan: RoomArchitecturePlan,
  cellPx: number,
): void {
  const scale = cellPx / TILE_SIZE;
  const env = ENV_PALETTE[plan.biome] ?? ENV_PALETTE[1];

  ctx.save();
  ctx.scale(scale, scale);

  // 1. Long South-East (-135 deg key light -> +45 deg SE) cast shadows from 2x2 interior pillars
  for (const shadow of plan.pillarShadows) {
    const px = shadow.pillarTx * TILE_SIZE;
    const py = shadow.pillarTy * TILE_SIZE;
    const pw = shadow.widthTiles * TILE_SIZE;
    const ph = shadow.heightTiles * TILE_SIZE;
    const len = shadow.shadowLengthU;

    ctx.save();
    ctx.beginPath();
    // Clip shadow strictly to walkable floor tiles within distToWall <= 2 around the pillar
    for (let ty = shadow.pillarTy; ty <= Math.min(map.rows - 2, shadow.pillarTy + 3); ty++) {
      for (let tx = shadow.pillarTx; tx <= Math.min(map.cols - 2, shadow.pillarTx + 3); tx++) {
        if (
          !map.isSolidTile(tx, ty) &&
          computeTileDistToWall(map, tx, ty) <= 2 &&
          !isProtectedMetricSampleTile(tx, ty)
        ) {
          ctx.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    ctx.clip();

    const grad = ctx.createLinearGradient(
      px + pw * 0.5,
      py + ph * 0.5,
      px + pw + len * 0.72,
      py + ph + len * 0.72,
    );
    grad.addColorStop(0, 'rgba(11, 9, 14, 0.22)');
    grad.addColorStop(1, 'rgba(11, 9, 14, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px + pw, py + 4);
    ctx.lineTo(px + pw + len * 0.72, py + 4 + len * 0.72);
    ctx.lineTo(px + 4 + len * 0.72, py + ph + len * 0.72);
    ctx.lineTo(px + 4, py + ph);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 2. Flat floor decals (only rendered if isFloorDecalVisible(decal, map) is true)
  for (const decal of plan.floorDecals) {
    if (!isFloorDecalVisible(decal, map)) continue;
    const ox = decal.tx * TILE_SIZE;
    const oy = decal.ty * TILE_SIZE;

    if (decal.kind === 'root_decal_tip') {
      // Flat 2u floor-decal root tip (no INK_DARK outline, no drop shadow, deltaL <= 6)
      ctx.save();
      ctx.translate(ox, oy);
      ctx.strokeStyle = '#34443D';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (decal.dir === 'N') {
        ctx.moveTo(14, 0);
        ctx.bezierCurveTo(12, 5, 19, 10, 16, 15);
      } else if (decal.dir === 'W') {
        ctx.moveTo(0, 15);
        ctx.bezierCurveTo(5, 13, 10, 19, 15, 16);
      } else {
        ctx.moveTo(TILE_SIZE, 16);
        ctx.bezierCurveTo(TILE_SIZE - 5, 14, TILE_SIZE - 10, 19, TILE_SIZE - 15, 16);
      }
      ctx.stroke();
      ctx.restore();
    } else if (decal.kind === 'stepping_stone') {
      // Asymmetric elliptical flat stepping stones (#485A51 / #33423B, deltaL <= 7, no INK_DARK outline)
      ctx.save();
      ctx.translate(ox + 16, oy + 16);
      const rot = ((decal.variant % 3) - 1) * 0.25;
      ctx.rotate(rot);
      ctx.fillStyle = '#33423B';
      ctx.beginPath();
      ctx.ellipse(-2, 1, 7.2, 4.6, 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#485A51';
      ctx.beginPath();
      ctx.ellipse(-2.5, 0.5, 6.0, 3.6, 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#43584E';
      ctx.beginPath();
      ctx.ellipse(5.5, -2.5, 3.8, 2.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (decal.kind === 'sunken_astrolabe') {
      // Sunken 3-Ring Ice Astrolabe (Biome 2, deltaL <= 6, clipped to dry Center Arena floor)
      ctx.save();
      ctx.beginPath();
      for (let ty = 3; ty < map.rows - 3; ty++) {
        for (let tx = 3; tx < map.cols - 3; tx++) {
          if (
            !map.isSolidTile(tx, ty) &&
            map.getSurface(tx, ty) === 'none' &&
            computeTileDistToWall(map, tx, ty) > 2 &&
            !isProtectedMetricSampleTile(tx, ty)
          ) {
            ctx.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }
      ctx.clip();

      const acx = map.width * 0.5;
      const acy = map.height * 0.5;
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = env.seam;
      ctx.lineWidth = 1.4;
      for (const r of [68, 114, 156]) {
        ctx.beginPath();
        ctx.arc(acx, acy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Off-center crescent inlay + 8 radial spokes
      ctx.beginPath();
      ctx.arc(acx - 14, acy - 10, 92, 0, Math.PI * 2);
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4;
        ctx.moveTo(acx + Math.cos(ang) * 32, acy + Math.sin(ang) * 32);
        ctx.lineTo(acx + Math.cos(ang) * 156, acy + Math.sin(ang) * 156);
      }
      ctx.stroke();
      ctx.restore();
    } else if (decal.kind === 'grated_heat_channel') {
      // Flat Grated Heat Channel on walkable perimeter tile (Biome 3, deltaL <= 7, no INK_DARK outline)
      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillStyle = '#3B2D29';
      ctx.fillRect(4, 8, 24, 16);
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = '#6E332B';
      ctx.fillRect(6, 10, 20, 12);
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = '#241F2E';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (const gx of [8, 12, 16, 20, 24]) {
        ctx.moveTo(gx, 9);
        ctx.lineTo(gx, 23);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3. Solid 3D architectural decor on wall & pillar tiles
  for (const item of plan.solidDecors) {
    if (!map.isSolidTile(item.tx, item.ty)) continue;
    const ox = item.tx * TILE_SIZE;
    const oy = item.ty * TILE_SIZE;

    ctx.save();
    ctx.translate(ox, oy);

    switch (item.kind) {
      case 'brazier_pedestal': {
        // Stepped stone pedestal on wall tile with 45-deg wrought-iron bracket arm
        ctx.fillStyle = env.wallFront;
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.lineWidth = 1.8;
        ctx.fillRect(6, 5, 20, 16);
        ctx.strokeRect(6, 5, 20, 16);

        ctx.fillStyle = env.wallTop;
        ctx.fillRect(8, 6, 16, 11);

        // Top-left (-135 deg) rim light on pedestal cap
        ctx.strokeStyle = env.rim;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(8.5, 16);
        ctx.lineTo(8.5, 6.5);
        ctx.lineTo(23.5, 6.5);
        ctx.stroke();

        // Wrought-iron bracket arm
        ctx.strokeStyle = PALETTE.SLATE_DARK;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(16, 11);
        ctx.lineTo(16, 26);
        ctx.stroke();

        ctx.fillStyle = PALETTE.SOLAR_GOLD;
        ctx.beginPath();
        ctx.arc(16, 14, 2.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'root_base': {
        // Thick woody Bezier S-curve root base on wall tile (#7D4B32 / #4E2F21 + #499F54 moss, 2.2u INK_DARK outline)
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        if (item.dir === 'N') {
          ctx.moveTo(8, 4);
          ctx.bezierCurveTo(22, 10, 8, 22, 14, 31);
        } else if (item.dir === 'W') {
          ctx.moveTo(4, 8);
          ctx.bezierCurveTo(12, 20, 22, 10, 31, 15);
        } else {
          ctx.moveTo(28, 8);
          ctx.bezierCurveTo(20, 20, 10, 10, 1, 16);
        }
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.lineWidth = 10.5;
        ctx.stroke();

        ctx.strokeStyle = PALETTE.LEATHER_DARK;
        ctx.lineWidth = 6.5;
        ctx.stroke();

        ctx.strokeStyle = PALETTE.LEATHER_MID;
        ctx.lineWidth = 3.8;
        ctx.stroke();

        // Moss patch on root shoulder
        ctx.fillStyle = PALETTE.GOBLIN_GREEN;
        ctx.beginPath();
        ctx.ellipse(14, 12, 3.8, 2.4, -0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'mushroom_cluster': {
        // 3 small bioluminescent mushroom caps (#84CC16 / #A7F3D0, soft alpha <= 0.25 glow)
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = PALETTE.LIME_GLOW;
        ctx.beginPath();
        ctx.arc(16, 15, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const caps: ReadonlyArray<readonly [number, number, number]> = [
          [13, 15, 3.4],
          [19, 13, 2.8],
          [17, 18, 2.2],
        ];
        for (const [cx, cy, cr] of caps) {
          ctx.beginPath();
          ctx.arc(cx, cy, cr, 0, Math.PI * 2);
          ctx.fillStyle = PALETTE.LIME_GLOW;
          ctx.fill();
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = PALETTE.INK_DARK;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx - cr * 0.28, cy - cr * 0.28, cr * 0.38, 0, Math.PI * 2);
          ctx.fillStyle = PALETTE.MINT_LIGHT;
          ctx.fill();
        }
        break;
      }

      case 'cliff_vines': {
        // Hanging moss vines on South Cliff Face (y = 18..30)
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(9, 19);
        ctx.quadraticCurveTo(12, 24, 10, 29);
        ctx.moveTo(21, 19);
        ctx.quadraticCurveTo(19, 23, 22, 27);
        ctx.stroke();

        ctx.strokeStyle = PALETTE.GOBLIN_GREEN;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        break;
      }

      case 'ice_alcove': {
        // Biome 2 arched ice alcove & faceted cyan crystal on North wall tiles
        ctx.beginPath();
        ctx.moveTo(7, 29);
        ctx.lineTo(7, 17);
        ctx.arc(16, 17, 9, Math.PI, 0);
        ctx.lineTo(25, 29);
        ctx.closePath();
        ctx.fillStyle = env.shadow;
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.stroke();

        // Hanging icicle spears inside alcove
        ctx.fillStyle = PALETTE.CYAN_FROST;
        ctx.beginPath();
        ctx.moveTo(11, 14);
        ctx.lineTo(13, 25);
        ctx.lineTo(15, 14);
        ctx.moveTo(17, 13);
        ctx.lineTo(19.5, 27);
        ctx.lineTo(22, 13);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = env.rim;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(12.2, 14.5);
        ctx.lineTo(13, 22);
        ctx.moveTo(18.2, 13.5);
        ctx.lineTo(19.2, 24);
        ctx.stroke();
        break;
      }

      case 'frost_crystal_cluster': {
        // Biome 2 faceted cyan crystal cluster on solid wall corners
        const spires: ReadonlyArray<readonly [number, number, number, number]> = [
          [11, 18, 8, 6],
          [17, 20, 18, 4],
          [21, 19, 25, 9],
        ];
        for (const [bx, by, tx, ty] of spires) {
          ctx.beginPath();
          ctx.moveTo(bx - 3, by);
          ctx.lineTo(tx, ty);
          ctx.lineTo(bx + 3, by);
          ctx.closePath();
          ctx.fillStyle = PALETTE.CYAN_FROST;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = PALETTE.INK_DARK;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(bx - 1.5, by - 1);
          ctx.lineTo(tx, ty + 1.5);
          ctx.strokeStyle = PALETTE.ICE_WHITE;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
        break;
      }

      case 'brass_gear_wall': {
        // Biome 3 bronze/brass toothed wall gear & flanged pipe on North wall tiles
        ctx.fillStyle = PALETTE.STEEL_DARK;
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.lineWidth = 1.6;
        ctx.fillRect(3, 13, 26, 5);
        ctx.strokeRect(3, 13, 26, 5);

        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const ang = (k * Math.PI) / 4 + item.variant * 0.2;
          ctx.moveTo(16 + Math.cos(ang) * 4, 15 + Math.sin(ang) * 4);
          ctx.lineTo(16 + Math.cos(ang) * 9.5, 15 + Math.sin(ang) * 9.5);
        }
        ctx.stroke();

        ctx.strokeStyle = PALETTE.BRASS_CORE;
        ctx.lineWidth = 2.0;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(16, 15, 6.8, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.BRONZE_SHADE;
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(16, 15, 3.0, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.COPPER_LIGHT;
        ctx.fill();
        break;
      }

      case 'steam_pipe_wall': {
        // Biome 3 flanged vertical steam pipe & brass valve on side wall tiles
        ctx.fillStyle = PALETTE.STEEL_DARK;
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.lineWidth = 1.6;
        ctx.fillRect(11, 3, 10, 26);
        ctx.strokeRect(11, 3, 10, 26);

        ctx.fillStyle = PALETTE.STEEL_LIGHT;
        ctx.fillRect(9, 7, 14, 3.5);
        ctx.fillRect(9, 21, 14, 3.5);

        ctx.beginPath();
        ctx.arc(16, 16, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.BRASS_CORE;
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'wrought_iron_fence': {
        // Hub / P4 wrought-iron finial spikes & weathered stone coping on wall tiles
        ctx.fillStyle = env.wallFront;
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.lineWidth = 1.6;
        ctx.fillRect(4, 14, 24, 5);
        ctx.strokeRect(4, 14, 24, 5);

        for (const sx of [8, 16, 24]) {
          ctx.beginPath();
          ctx.moveTo(sx - 2.2, 16);
          ctx.lineTo(sx, 5);
          ctx.lineTo(sx + 2.2, 16);
          ctx.closePath();
          ctx.fillStyle = PALETTE.SLATE_DARK;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = PALETTE.INK_DARK;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(sx - 0.8, 14);
          ctx.lineTo(sx, 7);
          ctx.strokeStyle = PALETTE.STEEL_LIGHT;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
        break;
      }

      default:
        break;
    }

    ctx.restore();
  }

  ctx.restore();
}
