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
    for (const ax of [5, 10, 24, 29]) {
      if (ax < map.cols - 1 && map.isSolidTile(ax, 0)) {
        addSolidDecor({
          kind: 'ice_alcove',
          tx: ax,
          ty: 0,
          hasVolume: true,
          isLarge: false,
          dir: 'N',
          variant: ax % 3,
        });
      }
    }
  } else if (biome === 3) {
    for (const gx of [4, 10, 24, 30]) {
      if (gx < map.cols - 1 && map.isSolidTile(gx, 0)) {
        addSolidDecor({
          kind: 'brass_gear_wall',
          tx: gx,
          ty: 0,
          hasVolume: true,
          isLarge: false,
          dir: 'N',
          variant: gx % 3,
        });
      }
    }
  } else {
    for (const fx of [5, 10, 24, 29]) {
      if (fx < map.cols - 1 && map.isSolidTile(fx, 0)) {
        addSolidDecor({
          kind: 'wrought_iron_fence',
          tx: fx,
          ty: 0,
          hasVolume: true,
          isLarge: false,
          dir: 'N',
          variant: fx % 3,
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

      default:
        break;
    }

    ctx.restore();
  }

  ctx.restore();
}
