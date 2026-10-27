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
        map.tiles[idx] = 'pillar';
        map.surfaces[idx] = 'none';
        map.baseSurfaces[idx] = 'none';
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
 *   - Upper 3-tile belt (ty <= 10, i.e. ty: 6..8) flows East (+110 px/s * map.conveyorDirection).
 *   - Lower 3-tile belt (ty >= 11, i.e. ty: 13..15) flows West (-110 px/s * map.conveyorDirection).
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
  const laneSign = map.roomArchetype === 'CROSSFIRE_CONVEYORS' && ty >= 11 ? -1 : 1;
  return laneSign * map.conveyorDirection * CONVEYOR_BELT_SPEED;
}

/**
 * 1. CROSSFIRE_CONVEYORS (Dây Chuyền Giao Lộ Tốc Độ Cao):
 * Two 3-tile-wide parallel conveyor lanes across the room:
 * - ty: 6..8 flowing East (+110 px/s)
 * - ty: 13..15 flowing West (-110 px/s)
 */
export function buildCrossfireConveyorsGeometry(
  map: ArenaMap,
  biome: 1 | 2 | 3,
  flipX: boolean,
  flipY: boolean,
): BaseP1CAnchorSpec[] {
  const kinds = getBiomePropKinds(biome);

  // Corner structural pillars framing the factory lanes
  setPillarRect(map, 4, 3, 2, 2);
  setPillarRect(map, 30, 3, 2, 2);
  setPillarRect(map, 4, 17, 2, 2);
  setPillarRect(map, 30, 17, 2, 2);
  // Central divider bollards between the two conveyor lanes (ty: 10..11)
  setPillarRect(map, flipX ? 23 : 11, 10, 2, 2);
  setPillarRect(map, flipX ? 11 : 23, 10, 2, 2);

  // Two parallel 3-tile-wide conveyor belts (tx: 5..30, ty: 6..8 and ty: 13..15)
  map.fillSurfaceRect(5, 6, 26, 3, 'conveyor');
  map.fillSurfaceRect(5, 13, 26, 3, 'conveyor');

  // Side hazard accents outside the belts
  const accentSurf: SurfaceKind = biome === 2 ? 'ice' : biome === 3 ? 'lava' : 'oil';
  map.fillSurfaceRect(flipX ? 25 : 7, flipY ? 17 : 3, 4, 2, accentSurf);
  map.fillSurfaceRect(flipX ? 7 : 25, flipY ? 3 : 17, 4, 2, biome === 2 ? 'water' : 'oil');

  return [
    { id: 'cc_barricade_nw', role: 'barricade', propKind: kinds.barricade, tx: 10, ty: 5 },
    { id: 'cc_barricade_ne', role: 'barricade', propKind: kinds.barricade, tx: 25, ty: 5 },
    { id: 'cc_barricade_sw', role: 'barricade', propKind: kinds.barricade, tx: 10, ty: 16 },
    { id: 'cc_barricade_se', role: 'barricade', propKind: kinds.barricade, tx: 25, ty: 16 },
    { id: 'cc_hazard_top', role: 'hazard', propKind: kinds.hazard, tx: 14, ty: 7 },
    { id: 'cc_hazard_bot', role: 'hazard', propKind: kinds.hazard, tx: 21, ty: 14 },
    { id: 'cc_pillar_mid_w', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 15, ty: 10 },
    { id: 'cc_pillar_mid_e', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 20, ty: 11 },
    { id: 'cc_mech', role: 'mechanism', propKind: 'ancient_mechanism', tx: 17, ty: 10 },
  ];
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

  // 5 staggered 2x4 cover walls in a quincunx checkerboard pattern
  const wShift = flipX ? 1 : 0;
  const hShift = flipY ? 1 : 0;
  setPillarRect(map, 9 + wShift, 4 + hShift, 2, 4);
  setPillarRect(map, 24 + wShift, 4 + hShift, 2, 4);
  setPillarRect(map, 17, 9, 2, 4);
  setPillarRect(map, 9 + wShift, 13 + hShift, 2, 4);
  setPillarRect(map, 24 + wShift, 13 + hShift, 2, 4);

  if (biome === 2) {
    map.fillSurfaceRect(12, 4, 4, 3, 'ice');
    map.fillSurfaceRect(20, 4, 4, 3, 'ice');
    map.fillSurfaceRect(12, 15, 4, 3, 'ice');
    map.fillSurfaceRect(20, 15, 4, 3, 'water');
  } else if (biome === 3) {
    map.fillSurfaceRect(12, 4, 4, 2, 'conveyor');
    map.fillSurfaceRect(20, 15, 4, 2, 'conveyor');
    map.fillSurfaceRect(4, 6, 3, 3, 'lava');
    map.fillSurfaceRect(29, 13, 3, 3, 'oil');
  } else {
    map.fillSurfaceRect(12, 4, 4, 3, 'grass');
    map.fillSurfaceRect(20, 4, 4, 3, 'water');
    map.fillSurfaceRect(12, 15, 4, 3, 'poison_swamp');
    map.fillSurfaceRect(20, 15, 4, 3, 'oil');
  }

  return [
    { id: 'pl_pillar_nw', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 14, ty: 6 },
    { id: 'pl_pillar_ne', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 21, ty: 6 },
    { id: 'pl_pillar_sw', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 14, ty: 15 },
    { id: 'pl_pillar_se', role: 'pillar_toy', propKind: kinds.pillarToy, tx: 21, ty: 15 },
    { id: 'pl_barricade_w', role: 'barricade', propKind: kinds.barricade, tx: 13, ty: 10 },
    { id: 'pl_barricade_e', role: 'barricade', propKind: kinds.barricade, tx: 22, ty: 11 },
    { id: 'pl_hazard_w', role: 'hazard', propKind: kinds.hazard, tx: 6, ty: 10 },
    { id: 'pl_hazard_e', role: 'hazard', propKind: kinds.hazard, tx: 29, ty: 11 },
    { id: 'pl_mech', role: 'mechanism', propKind: 'ancient_mechanism', tx: 17, ty: 6 },
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

  for (const [px, py] of CRUMBLING_RING_PILLAR_RECTS) {
    setPillarRect(map, px, py, 2, 2);
  }

  // Central arena floor surface accents
  if (biome === 2) {
    map.fillSurfaceRect(15, 9, 6, 4, 'ice');
  } else if (biome === 3) {
    map.fillSurfaceRect(15, 8, 6, 2, 'conveyor');
    map.fillSurfaceRect(15, 12, 6, 2, 'conveyor');
  } else {
    map.fillSurfaceRect(15, 9, 3, 4, 'grass');
    map.fillSurfaceRect(18, 9, 3, 4, 'oil');
  }
  void flipX;
  void flipY;

  const ringPillarAnchors: BaseP1CAnchorSpec[] = CRUMBLING_RING_PILLAR_RECTS.map(
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

  return [
    ...ringPillarAnchors,
    {
      id: 'cpr_barricade_n',
      role: 'barricade',
      propKind: kinds.barricade,
      tx: 17,
      ty: 5,
      noJitter: true,
    },
    {
      id: 'cpr_barricade_s',
      role: 'barricade',
      propKind: kinds.barricade,
      tx: 18,
      ty: 16,
      noJitter: true,
    },
    {
      id: 'cpr_barricade_w',
      role: 'barricade',
      propKind: kinds.barricade,
      tx: 11,
      ty: 8,
      noJitter: true,
    },
    {
      id: 'cpr_barricade_e',
      role: 'barricade',
      propKind: kinds.barricade,
      tx: 24,
      ty: 13,
      noJitter: true,
    },
    { id: 'cpr_hazard_nw', role: 'hazard', propKind: kinds.hazard, tx: 6, ty: 6 },
    { id: 'cpr_hazard_se', role: 'hazard', propKind: kinds.hazard, tx: 29, ty: 15 },
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
