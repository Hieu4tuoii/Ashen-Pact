import { TILE_SIZE } from '../protocol/messages.js';
import type { ArenaMap, SurfaceKind } from './arena-map.js';
import type { PropKind } from './world-sim-types.js';

export const CONVEYOR_BELT_SPEED = 110;

export interface BaseP1CAnchorSpec {
  id: string;
  role: 'barricade' | 'hazard' | 'pillar_toy' | 'accent' | 'mechanism';
  propKind: PropKind;
  tx: number;
  ty: number;
  exactX?: number;
  exactY?: number;
  noJitter?: boolean;
}

function setPillarRect(
  map: ArenaMap,
  startTx: number,
  startTy: number,
  w: number,
  h: number,
): void {
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

function getBiomePropKinds(biome: 1 | 2 | 3): {
  barricade: PropKind;
  hazard: PropKind;
  pillarToy: PropKind;
} {
  if (biome === 2) {
    return {
      barricade: 'glacial_barricade',
      hazard: 'sliding_ice_block',
      pillarToy: 'cryo_prism_pillar',
    };
  }
  if (biome === 3) {
    return {
      barricade: 'forge_blast_shield',
      hazard: 'slag_crucible',
      pillarToy: 'pneumatic_press',
    };
  }
  return {
    barricade: 'moss_table',
    hazard: 'volatile_spore_pod',
    pillarToy: 'rotten_totem_pillar',
  };
}

/**
 * Computes the horizontal conveyor belt velocity (px/s) at world position (worldX, worldY):
 * - Returns 0 if the tile surface at (worldX, worldY) is not 'conveyor'.
 * - In CROSSFIRE_CONVEYORS:
 *   - Upper 3-tile belt (ty < midY, e.g. ty: 6..8 on 36x22) flows East (+110 px/s * map.conveyorDirection).
 *   - Lower 3-tile belt (ty >= midY, e.g. ty: 13..15 on 36x22) flows West (-110 px/s * map.conveyorDirection).
 * - In other archetypes: flows in +110 px/s * map.conveyorDirection.
 */
export function getConveyorVelocityAtWorld(
  map: ArenaMap,
  worldX: number,
  worldY: number,
): number {
  const tx = Math.floor(worldX / TILE_SIZE);
  const ty = Math.floor(worldY / TILE_SIZE);
  if (map.getSurface(tx, ty) !== 'conveyor') return 0;
  const midY = Math.floor(map.rows / 2);
  const laneSign = map.roomArchetype === 'CROSSFIRE_CONVEYORS' && ty >= midY ? -1 : 1;
  return laneSign * map.conveyorDirection * CONVEYOR_BELT_SPEED;
}

/**
 * 1. CROSSFIRE_CONVEYORS (Dây Chuyền Giao Lộ Tốc Độ Cao):
 * Two 3-tile-wide parallel conveyor lanes across the room:
 * - Upper belt flowing East (+110 px/s)
 * - Lower belt flowing West (-110 px/s)
 */
export function buildCrossfireConveyorsGeometry(
  map: ArenaMap,
  biome: 1 | 2 | 3,
  flipX: boolean,
  flipY: boolean,
): BaseP1CAnchorSpec[] {
  const kinds = getBiomePropKinds(biome);
  const cols = map.cols;
  const rows = map.rows;
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);
  const topLaneY = midY - 5;
  const botLaneY = midY + 2;
  const beltW = Math.max(8, cols - 10);
  const cornerTopY = Math.max(2, topLaneY - 3);
  const cornerBotY = Math.min(rows - 4, botLaneY + 4);

  // Corner structural pillars framing the factory lanes
  setPillarRect(map, 4, cornerTopY, 2, 2);
  setPillarRect(map, cols - 6, cornerTopY, 2, 2);
  setPillarRect(map, 4, cornerBotY, 2, 2);
  setPillarRect(map, cols - 6, cornerBotY, 2, 2);
  // Central divider bollards between the two conveyor lanes
  const bollardLeftX = midX - 7;
  const bollardRightX = cols - 2 - bollardLeftX;
  setPillarRect(map, flipX ? bollardRightX : bollardLeftX, midY - 1, 2, 2);
  setPillarRect(map, flipX ? bollardLeftX : bollardRightX, midY - 1, 2, 2);

  // Two parallel 3-tile-wide conveyor belts
  map.fillSurfaceRect(5, topLaneY, beltW, 3, 'conveyor');
  map.fillSurfaceRect(5, botLaneY, beltW, 3, 'conveyor');

  // Side hazard accents outside the belts
  const accentSurf: SurfaceKind = biome === 2 ? 'ice' : biome === 3 ? 'lava' : 'oil';
  const accentRightX = cols - 11;
  map.fillSurfaceRect(flipX ? accentRightX : 7, flipY ? cornerBotY : cornerTopY, 4, 2, accentSurf);
  map.fillSurfaceRect(
    flipX ? 7 : accentRightX,
    flipY ? cornerTopY : cornerBotY,
    4,
    2,
    biome === 2 ? 'water' : 'oil',
  );

  const barLeftX = Math.max(6, midX - 8);
  const barRightX = cols - 1 - barLeftX;
  return [
    { id: 'cc_barricade_nw', role: 'barricade', propKind: kinds.barricade, tx: barLeftX, ty: topLaneY - 1 },
    { id: 'cc_barricade_ne', role: 'barricade', propKind: kinds.barricade, tx: barRightX, ty: topLaneY - 1 },
    { id: 'cc_barricade_sw', role: 'barricade', propKind: kinds.barricade, tx: barLeftX, ty: botLaneY + 3 },
    { id: 'cc_barricade_se', role: 'barricade', propKind: kinds.barricade, tx: barRightX, ty: botLaneY + 3 },
    { id: 'cc_hazard_top', role: 'hazard', propKind: kinds.hazard, tx: midX - 4, ty: topLaneY + 1 },
    { id: 'cc_hazard_bot', role: 'hazard', propKind: kinds.hazard, tx: midX + 3, ty: botLaneY + 1 },
    { id: 'cc_pillar_mid_w', role: 'pillar_toy', propKind: kinds.pillarToy, tx: midX - 3, ty: midY - 1 },
    { id: 'cc_pillar_mid_e', role: 'pillar_toy', propKind: kinds.pillarToy, tx: midX + 2, ty: midY },
    { id: 'cc_mech', role: 'mechanism', propKind: 'ancient_mechanism', tx: midX - 1, ty: midY - 1 },
  ];
}

function isInPrismDoorVestibule(map: ArenaMap, tx: number, ty: number): boolean {
  const midX = Math.floor(map.cols / 2);
  const midY = Math.floor(map.rows / 2);
  if ((ty <= 3 || ty >= map.rows - 4) && tx >= midX - 1 && tx <= midX + 1) return true;
  if ((tx <= 3 || tx >= map.cols - 4) && ty >= midY - 1 && ty <= midY + 1) return true;
  return false;
}

function placePrismPillar2x4(map: ArenaMap, targetX: number, targetY: number): void {
  const canPlaceAt = (px: number, py: number, requireMoat: boolean): boolean => {
    if (px < 2 || py < 2 || px + 1 > map.cols - 3 || py + 3 > map.rows - 3) return false;
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const tx = px + dx;
        const ty = py + dy;
        if (
          map.getTile(tx, ty) !== 'floor' ||
          map.getSurface(tx, ty) === 'chasm' ||
          isInPrismDoorVestibule(map, tx, ty)
        ) {
          return false;
        }
      }
    }
    if (requireMoat) {
      for (let dy = -1; dy <= 4; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          if (dx >= 0 && dx < 2 && dy >= 0 && dy < 4) continue;
          const tx = px + dx;
          const ty = py + dy;
          if (tx <= 0 || ty <= 0 || tx >= map.cols - 1 || ty >= map.rows - 1) return false;
          if (map.getTile(tx, ty) !== 'floor' || map.getSurface(tx, ty) === 'chasm') return false;
        }
      }
    }
    return true;
  };

  if (canPlaceAt(targetX, targetY, false)) {
    setPillarRect(map, targetX, targetY, 2, 4);
    return;
  }
  const maxRing = Math.max(map.cols, map.rows);
  for (const requireMoat of [true, false]) {
    for (let ring = 1; ring <= maxRing; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const cx = targetX + dx;
          const cy = targetY + dy;
          if (canPlaceAt(cx, cy, requireMoat)) {
            setPillarRect(map, cx, cy, 2, 4);
            return;
          }
        }
      }
    }
  }
}

/**
 * 2. PRISM_LABYRINTH (Mê Cung Khúc Xạ So Le):
 * 5 staggered 2x4 cover walls in a checkerboard pattern across the room,
 * interleaved with cryo_prism_pillar / rotten_totem_pillar / pneumatic_press.
 */
export function buildPrismLabyrinthGeometry(
  map: ArenaMap,
  biome: 1 | 2 | 3,
  flipX: boolean,
  flipY: boolean,
): BaseP1CAnchorSpec[] {
  const kinds = getBiomePropKinds(biome);
  const cols = map.cols;
  const rows = map.rows;
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);

  // 5 staggered 2x4 cover walls in a quincunx checkerboard pattern
  const wShift = flipX ? 1 : 0;
  const hShift = rows >= 20 ? (flipY ? 1 : 0) : 0;
  const leftWallX = Math.max(6, Math.round((9 * cols) / 36));
  const rightWallX = cols - 3 - leftWallX;
  const topWallY = rows >= 20 ? Math.max(4, Math.floor(rows * 0.18)) : 3;
  const botWallY = rows - 5 - topWallY;

  placePrismPillar2x4(map, leftWallX + wShift, topWallY + hShift);
  placePrismPillar2x4(map, rightWallX + wShift, topWallY + hShift);
  placePrismPillar2x4(map, midX - 1, midY - 2);
  placePrismPillar2x4(map, leftWallX + wShift, botWallY + hShift);
  placePrismPillar2x4(map, rightWallX + wShift, botWallY + hShift);

  const surfLeftX = midX - 6;
  const surfRightX = midX + 2;
  const surfTopY = topWallY;
  const surfBotY = rows - 3 - topWallY;
  if (biome === 2) {
    map.fillSurfaceRect(surfLeftX, surfTopY, 4, 3, 'ice');
    map.fillSurfaceRect(surfRightX, surfTopY, 4, 3, 'ice');
    map.fillSurfaceRect(surfLeftX, surfBotY, 4, 3, 'ice');
    map.fillSurfaceRect(surfRightX, surfBotY, 4, 3, 'water');
  } else if (biome === 3) {
    map.fillSurfaceRect(surfLeftX, surfTopY, 4, 2, 'conveyor');
    map.fillSurfaceRect(surfRightX, surfBotY, 4, 2, 'conveyor');
    map.fillSurfaceRect(4, topWallY + 2, 3, 3, 'lava');
    map.fillSurfaceRect(cols - 7, botWallY, 3, 3, 'oil');
  } else {
    map.fillSurfaceRect(surfLeftX, surfTopY, 4, 3, 'grass');
    map.fillSurfaceRect(surfRightX, surfTopY, 4, 3, 'water');
    map.fillSurfaceRect(surfLeftX, surfBotY, 4, 3, 'poison_swamp');
    map.fillSurfaceRect(surfRightX, surfBotY, 4, 3, 'oil');
  }

  const flankX = Math.max(5, leftWallX - 3);
  const anchorTopY = topWallY + 2;
  const anchorBotY = rows - 1 - anchorTopY;
  return [
    { id: 'pl_pillar_nw', role: 'pillar_toy', propKind: kinds.pillarToy, tx: midX - 4, ty: anchorTopY },
    { id: 'pl_pillar_ne', role: 'pillar_toy', propKind: kinds.pillarToy, tx: midX + 3, ty: anchorTopY },
    { id: 'pl_pillar_sw', role: 'pillar_toy', propKind: kinds.pillarToy, tx: midX - 4, ty: anchorBotY },
    { id: 'pl_pillar_se', role: 'pillar_toy', propKind: kinds.pillarToy, tx: midX + 3, ty: anchorBotY },
    { id: 'pl_barricade_w', role: 'barricade', propKind: kinds.barricade, tx: midX - 5, ty: midY - 1 },
    { id: 'pl_barricade_e', role: 'barricade', propKind: kinds.barricade, tx: midX + 4, ty: midY },
    { id: 'pl_hazard_w', role: 'hazard', propKind: kinds.hazard, tx: flankX, ty: midY - 1 },
    { id: 'pl_hazard_e', role: 'hazard', propKind: kinds.hazard, tx: cols - 1 - flankX, ty: midY },
    { id: 'pl_mech', role: 'mechanism', propKind: 'ancient_mechanism', tx: midX - 1, ty: anchorTopY },
  ];
}

export const CRUMBLING_RING_PILLAR_RECTS: readonly [number, number][] = [
  [13, 5],
  [21, 5],
  [9, 10],
  [25, 10],
  [13, 15],
  [21, 15],
] as const;

export function getCrumblingRingPillarRectsForMap(
  map: Pick<ArenaMap, 'cols' | 'rows'>,
): readonly [number, number][] {
  const midX = Math.floor(map.cols / 2);
  const midY = Math.floor(map.rows / 2);
  const topRingY = Math.max(4, midY - 6);
  const botRingY = map.rows - 2 - topRingY;
  const innerLeftX = midX - 5;
  const innerRightX = midX + 3;
  const outerLeftX = Math.max(6, midX - 9);
  const outerRightX = map.cols - 2 - outerLeftX;
  return [
    [innerLeftX, topRingY],
    [innerRightX, topRingY],
    [outerLeftX, midY - 1],
    [outerRightX, midY - 1],
    [innerLeftX, botRingY],
    [innerRightX, botRingY],
  ];
}

/**
 * 3. CRUMBLING_PILLAR_RING (Vòng Tròn Sáu Cột Sập):
 * 6 large 2x2 pillars arranged in a hexagon around the center of the room,
 * accompanied by 4 flippable barricades in the gaps between pillars.
 */
export function buildCrumblingPillarRingGeometry(
  map: ArenaMap,
  biome: 1 | 2 | 3,
  flipX: boolean,
  flipY: boolean,
): BaseP1CAnchorSpec[] {
  const kinds = getBiomePropKinds(biome);
  const midX = Math.floor(map.cols / 2);
  const midY = Math.floor(map.rows / 2);
  const ringRects = getCrumblingRingPillarRectsForMap(map);

  for (const [px, py] of ringRects) {
    setPillarRect(map, px, py, 2, 2);
  }

  // Central arena floor surface accents
  if (biome === 2) {
    map.fillSurfaceRect(midX - 3, midY - 2, 6, 4, 'ice');
  } else if (biome === 3) {
    map.fillSurfaceRect(midX - 3, midY - 3, 6, 2, 'conveyor');
    map.fillSurfaceRect(midX - 3, midY + 1, 6, 2, 'conveyor');
  } else {
    map.fillSurfaceRect(midX - 3, midY - 2, 3, 4, 'grass');
    map.fillSurfaceRect(midX, midY - 2, 3, 4, 'oil');
  }
  void flipX;
  void flipY;

  const ringPillarAnchors: BaseP1CAnchorSpec[] = ringRects.map(
    ([px, py], idx) => ({
      id: `cpr_ring_pillar_${idx + 1}`,
      role: 'pillar_toy',
      propKind: 'rotten_totem_pillar',
      tx: px,
      ty: py,
      exactX: (px + 1) * TILE_SIZE,
      exactY: (py + 1) * TILE_SIZE,
      noJitter: true,
    }),
  );

  const topRingY = ringRects[0]![1];
  const botRingY = ringRects[4]![1];
  const innerLeftX = ringRects[0]![0];
  const innerRightX = ringRects[1]![0];
  const outerLeftX = ringRects[2]![0];
  const flankX = Math.max(5, outerLeftX - 3);

  return [
    ...ringPillarAnchors,
    {
      id: 'cpr_barricade_n',
      role: 'barricade',
      propKind: kinds.barricade,
      tx: midX - 1,
      ty: topRingY,
      noJitter: true,
    },
    {
      id: 'cpr_barricade_s',
      role: 'barricade',
      propKind: kinds.barricade,
      tx: midX,
      ty: botRingY + 1,
      noJitter: true,
    },
    {
      id: 'cpr_barricade_w',
      role: 'barricade',
      propKind: kinds.barricade,
      tx: innerLeftX - 2,
      ty: midY - 3,
      noJitter: true,
    },
    {
      id: 'cpr_barricade_e',
      role: 'barricade',
      propKind: kinds.barricade,
      tx: innerRightX + 3,
      ty: midY + 2,
      noJitter: true,
    },
    { id: 'cpr_hazard_nw', role: 'hazard', propKind: kinds.hazard, tx: flankX, ty: topRingY + 1 },
    { id: 'cpr_hazard_se', role: 'hazard', propKind: kinds.hazard, tx: map.cols - 1 - flankX, ty: botRingY },
  ];
}

/**
 * Clears the 2x2 solid 'pillar' tiles belonging to a collapsed hexagonal ring pillar,
 * opening up the room space and rebuilding solid collision boxes.
 */
export function clearCollapsedPillarFootprintOnMap(
  map: ArenaMap,
  worldX: number,
  worldY: number,
): number {
  const centerTx = Math.floor(worldX / TILE_SIZE);
  const centerTy = Math.floor(worldY / TILE_SIZE);
  let cleared = 0;

  for (let dy = -2; dy <= 1; dy++) {
    for (let dx = -2; dx <= 1; dx++) {
      const tx = centerTx + dx;
      const ty = centerTy + dy;
      if (tx <= 0 || ty <= 0 || tx >= map.cols - 1 || ty >= map.rows - 1) continue;
      const tileCx = tx * TILE_SIZE + TILE_SIZE * 0.5;
      const tileCy = ty * TILE_SIZE + TILE_SIZE * 0.5;
      if (Math.hypot(tileCx - worldX, tileCy - worldY) <= TILE_SIZE * 1.25) {
        if (map.getTile(tx, ty) === 'pillar') {
          map.tiles[ty * map.cols + tx] = 'floor';
          cleared += 1;
        }
      }
    }
  }

  if (cleared > 0) {
    map.rebuildSolidBoxes();
    map.mapRevision += 1;
  }
  return cleared;
}
