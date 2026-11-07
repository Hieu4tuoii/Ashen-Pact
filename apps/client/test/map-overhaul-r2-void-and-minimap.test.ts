import {
  ArenaMap,
  ROOM_SIZE_PRESET_DIMS,
  type RoomSizePreset,
  TILE_SIZE,
  WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockPostFXPipeline {
    public game: unknown;
    public name: string;
    constructor(config: { game: unknown; name: string }) {
      this.game = config.game;
      this.name = config.name;
    }
    set1f() {}
    set3f() {}
  }
  class MockSinglePipeline {
    public config: unknown;
    public vertexCount = 0;
    constructor(config: unknown) {
      this.config = config;
    }
    flush() {
      this.vertexCount = 0;
    }
    set1f() {}
    set3f() {}
  }
  class MockWebGLRenderer {}
  class MockScene {
    constructor(_config?: unknown) {}
  }
  const PhaserMock = {
    Scene: MockScene,
    BlendModes: {
      NORMAL: 0,
      ADD: 1,
      MULTIPLY: 2,
      SCREEN: 3,
    },
    Scenes: {
      Events: {
        SHUTDOWN: 'shutdown',
      },
    },
    Renderer: {
      WebGL: {
        WebGLRenderer: MockWebGLRenderer,
        Pipelines: {
          PostFXPipeline: MockPostFXPipeline,
          SinglePipeline: MockSinglePipeline,
        },
      },
    },
  };
  return {
    default: PhaserMock,
    ...PhaserMock,
  };
});
import { ENV_PALETTE, PALETTE } from '../src/art/palette.js';
import type { ArenaTileVisual, GameScene } from '../src/scenes/GameScene.js';
import { renderTileCellToCompositeImpl } from '../src/scenes/game-scene/arena-tiles.js';
import {
  computeMinimapRoomPolygon,
  drawMinimapRoomSilhouette,
  resolveMinimapNodeDims,
  updateMinimapHudImpl,
} from '../src/scenes/game-scene/hud-qol-and-minimap.js';
import { UI_THEME } from '../src/ui/theme.js';
import {
  buildRoomArchitecturePlan,
  computeTileDistToWall,
  isActiveWallTile,
  isExteriorVoidWallTile,
  isFloorDecalVisible,
  resolveCornerActiveWallTile,
  resolveHybridFloorVariant,
  resolvePerimeterWallTileNear,
} from '../src/world/biome-architecture.js';

const ALL_10_SHAPES = [
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

type CanonicalRoomShape = (typeof ALL_10_SHAPES)[number];

const ALL_6_PRESETS: readonly RoomSizePreset[] = [
  'compact',
  'standard',
  'wide_hall',
  'tall_sanctum',
  'grand_arena',
  'colossal_boss',
] as const;

function isDoorVestibuleTile(map: ArenaMap, tx: number, ty: number): boolean {
  const midX = Math.floor(map.cols / 2);
  const midY = Math.floor(map.rows / 2);
  if (Math.abs(tx - midX) <= 1 && (ty <= 3 || ty >= map.rows - 4)) return true;
  if (Math.abs(ty - midY) <= 1 && (tx <= 3 || tx >= map.cols - 4)) return true;
  return false;
}

function setWallCell(map: ArenaMap, tx: number, ty: number): void {
  if (tx <= 0 || ty <= 0 || tx >= map.cols - 1 || ty >= map.rows - 1) return;
  if (isDoorVestibuleTile(map, tx, ty)) return;
  const idx = ty * map.cols + tx;
  map.tiles[idx] = 'wall';
  map.surfaces[idx] = 'none';
  map.baseSurfaces[idx] = 'none';
}

/**
 * Configures an ArenaMap for any of the 10 room shapes and 6 size presets.
 * Uses ArenaMap.configureRoomLayout directly, and ensures deep shape carving is present
 * if shared sim is still mid-build for a newly added shape.
 */
function createConfiguredShapeMap(
  shape: CanonicalRoomShape,
  preset: RoomSizePreset = 'standard',
  biome: 1 | 2 | 3 = 1,
  seed = 1337,
): ArenaMap {
  const dims = ROOM_SIZE_PRESET_DIMS[preset];
  const map = new ArenaMap({
    cols: dims.cols,
    rows: dims.rows,
    includePillars: true,
    seed,
    biome,
  });
  map.configureRoomLayout('combat', seed, false, biome, {
    roomShape: shape as unknown as ArenaMap['roomShape'],
    roomSizePreset: preset,
    cols: dims.cols,
    rows: dims.rows,
  });
  (map as { roomShape: string }).roomShape = shape;
  map.roomSizePreset = preset;

  if (shape === 'rectangle') {
    return map;
  }

  let voidCount = 0;
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      if (isExteriorVoidWallTile(map, tx, ty)) {
        voidCount += 1;
      }
    }
  }

  if (voidCount === 0) {
    const cols = map.cols;
    const rows = map.rows;
    const midX = Math.floor(cols / 2);
    const midY = Math.floor(rows / 2);

    if (shape === 'octagon') {
      const chamfer = Math.max(5, Math.floor(Math.min(cols, rows) * 0.28));
      for (let ty = 1; ty < rows - 1; ty++) {
        for (let tx = 1; tx < cols - 1; tx++) {
          const dx = Math.min(tx - 1, cols - 2 - tx);
          const dy = Math.min(ty - 1, rows - 2 - ty);
          if (dx + dy < chamfer) setWallCell(map, tx, ty);
        }
      }
    } else if (shape === 'cruciform') {
      const cw = Math.max(6, Math.floor(cols * 0.22));
      const ch = Math.max(4, Math.floor(rows * 0.22));
      for (let ty = 1; ty < rows - 1; ty++) {
        for (let tx = 1; tx < cols - 1; tx++) {
          if ((tx <= cw || tx >= cols - 1 - cw) && (ty <= ch || ty >= rows - 1 - ch)) {
            setWallCell(map, tx, ty);
          }
        }
      }
    } else if (shape === 'hourglass') {
      const waistH = Math.max(4, Math.floor(rows * 0.22));
      const waistOuterX = Math.max(9, Math.floor(cols * 0.28));
      for (let ty = 1; ty < rows - 1; ty++) {
        if (ty <= waistH || ty >= rows - 1 - waistH) {
          for (let tx = 1; tx < cols - 1; tx++) {
            const distFromMidX = Math.abs(tx - midX);
            if (distFromMidX >= 3 && distFromMidX <= waistOuterX) {
              setWallCell(map, tx, ty);
            }
          }
        }
      }
    } else if (shape === 'l_shape') {
      for (let ty = 1; ty <= midY - 3; ty++) {
        for (let tx = midX + 5; tx < cols - 1; tx++) {
          setWallCell(map, tx, ty);
        }
      }
    } else if (shape === 't_shape') {
      for (let ty = midY + 3; ty < rows - 1; ty++) {
        for (let tx = 1; tx < cols - 1; tx++) {
          if (tx <= midX - 6 || tx >= midX + 5) {
            setWallCell(map, tx, ty);
          }
        }
      }
    } else if (shape === 'u_shape') {
      for (let ty = 1; ty <= midY - 2; ty++) {
        for (let tx = midX - 8; tx <= midX + 7; tx++) {
          if (Math.abs(tx - midX) >= 3) {
            setWallCell(map, tx, ty);
          }
        }
      }
    } else if (shape === 'donut_ring') {
      for (let ty = midY - 2; ty <= midY + 2; ty++) {
        for (let tx = midX - 4; tx <= midX + 3; tx++) {
          setWallCell(map, tx, ty);
        }
      }
    } else if (shape === 'multi_chamber') {
      for (let ty = 1; ty <= midY - 3; ty++) {
        for (let tx = midX + 5; tx < cols - 1; tx++) {
          setWallCell(map, tx, ty);
        }
      }
      for (let ty = midY + 3; ty < rows - 1; ty++) {
        for (let tx = 1; tx <= midX - 6; tx++) {
          setWallCell(map, tx, ty);
        }
      }
    } else if (shape === 'island_catwalk') {
      const chamfer = 4;
      for (let ty = 1; ty < rows - 1; ty++) {
        for (let tx = 1; tx < cols - 1; tx++) {
          const dx = Math.min(tx - 1, cols - 2 - tx);
          const dy = Math.min(ty - 1, rows - 2 - ty);
          if (dx + dy < chamfer) {
            setWallCell(map, tx, ty);
          } else if (
            (dx <= 2 || dy <= 2) &&
            Math.abs(tx - midX) > 1 &&
            Math.abs(ty - midY) > 1
          ) {
            if (map.getTile(tx, ty) === 'floor') {
              map.setSurface(tx, ty, 'chasm', 0, true);
            }
          }
        }
      }
    }
    map.rebuildSolidBoxes();
  }

  return map;
}

interface RecordedCanvasOp {
  op: 'fillRect' | 'clearRect' | 'stroke' | 'drawImage';
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  globalAlpha?: number;
  args: number[];
  pathPoints?: Array<[number, number]>;
}

function createRecordingCanvas2D(): {
  ctx: CanvasRenderingContext2D;
  ops: RecordedCanvasOp[];
} {
  const ops: RecordedCanvasOp[] = [];
  let currentFillStyle = '#000000';
  let currentStrokeStyle = '#000000';
  let currentLineWidth = 1;
  let currentGlobalAlpha = 1;
  let currentPath: Array<[number, number]> = [];
  const stateStack: Array<{
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    globalAlpha: number;
  }> = [];

  const ctx = {
    get fillStyle() {
      return currentFillStyle;
    },
    set fillStyle(val: string) {
      currentFillStyle = String(val);
    },
    get strokeStyle() {
      return currentStrokeStyle;
    },
    set strokeStyle(val: string) {
      currentStrokeStyle = String(val);
    },
    get lineWidth() {
      return currentLineWidth;
    },
    set lineWidth(val: number) {
      currentLineWidth = Number(val);
    },
    get globalAlpha() {
      return currentGlobalAlpha;
    },
    set globalAlpha(val: number) {
      currentGlobalAlpha = Number(val);
    },
    save: () => {
      stateStack.push({
        fillStyle: currentFillStyle,
        strokeStyle: currentStrokeStyle,
        lineWidth: currentLineWidth,
        globalAlpha: currentGlobalAlpha,
      });
    },
    restore: () => {
      const prev = stateStack.pop();
      if (prev) {
        currentFillStyle = prev.fillStyle;
        currentStrokeStyle = prev.strokeStyle;
        currentLineWidth = prev.lineWidth;
        currentGlobalAlpha = prev.globalAlpha;
      }
    },
    clearRect: (x: number, y: number, w: number, h: number) => {
      ops.push({ op: 'clearRect', args: [x, y, w, h] });
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      ops.push({
        op: 'fillRect',
        fillStyle: currentFillStyle,
        globalAlpha: currentGlobalAlpha,
        args: [x, y, w, h],
      });
    },
    beginPath: () => {
      currentPath = [];
    },
    moveTo: (x: number, y: number) => {
      currentPath.push([x, y]);
    },
    lineTo: (x: number, y: number) => {
      currentPath.push([x, y]);
    },
    stroke: () => {
      ops.push({
        op: 'stroke',
        strokeStyle: currentStrokeStyle,
        lineWidth: currentLineWidth,
        globalAlpha: currentGlobalAlpha,
        args: [],
        pathPoints: [...currentPath],
      });
    },
    drawImage: (_img: unknown, dx: number, dy: number, dw: number, dh: number) => {
      ops.push({
        op: 'drawImage',
        args: [dx, dy, dw, dh],
      });
    },
  } as unknown as CanvasRenderingContext2D;

  return { ctx, ops };
}

describe('Round 2 Client Overhaul — F12 (Exterior Void, Sculpted 1-Tile Walls, Concave Miters & Decors) & F13 (Minimap Silhouettes)', () => {
  describe('1. isActiveWallTile & isExteriorVoidWallTile Classification across all 10 Room Shapes', () => {
    it('classifies 0 Exterior Void tiles and 100% active perimeter walls on standard rectangle rooms', () => {
      const map = createConfiguredShapeMap('rectangle', 'standard', 1, 1337);
      let activeWallCount = 0;
      let voidWallCount = 0;

      for (let ty = 0; ty < map.rows; ty++) {
        for (let tx = 0; tx < map.cols; tx++) {
          if (map.getTile(tx, ty) === 'wall') {
            if (isExteriorVoidWallTile(map, tx, ty)) {
              voidWallCount += 1;
            }
            if (isActiveWallTile(map, tx, ty)) {
              activeWallCount += 1;
            }
          }
        }
      }

      expect(voidWallCount).toBe(0);
      expect(activeWallCount).toBe(2 * map.cols + 2 * (map.rows - 2));
      expect(resolvePerimeterWallTileNear(map, 7, 'N')).toEqual({ tx: 7, ty: 0 });
      expect(resolvePerimeterWallTileNear(map, 7, 'S')).toEqual({ tx: 7, ty: map.rows - 1 });
      expect(resolveCornerActiveWallTile(map, 0, 0)).toEqual({ tx: 0, ty: 0 });
    });

    it('partitions carved wall tiles into Exterior Void (dist >= 2) vs Active 1-Tile Sculpted Wall (dist === 1) across all 9 non-rectangular shapes', () => {
      const nonRectShapes = ALL_10_SHAPES.filter((s) => s !== 'rectangle');
      for (const shape of nonRectShapes) {
        const map = createConfiguredShapeMap(shape, 'standard', 1, 1337);
        let activeCount = 0;
        let voidCount = 0;

        for (let ty = 0; ty < map.rows; ty++) {
          for (let tx = 0; tx < map.cols; tx++) {
            const kind = map.getTile(tx, ty);
            if (kind === 'wall') {
              const isActive = isActiveWallTile(map, tx, ty);
              const isVoid = isExteriorVoidWallTile(map, tx, ty);
              expect(isActive).toBe(!isVoid);
              if (isActive) activeCount += 1;
              if (isVoid) voidCount += 1;
            } else {
              expect(isExteriorVoidWallTile(map, tx, ty)).toBe(false);
            }
          }
        }

        expect(activeCount, `Active wall count for ${shape}`).toBeGreaterThan(20);
        expect(voidCount, `Exterior void count for ${shape}`).toBeGreaterThan(0);
      }
    });
  });

  describe('2. buildRoomArchitecturePlan — 0 Decors in Exterior Void & Stepped Cliff Relief across all 10 Shapes & 4 Biomes', () => {
    it('places 0 solidDecors (plan.items) and 0 floorDecals in Exterior Void across all 10 shapes, 6 presets, and 4 biomes while satisfying P4/P5 density budgets', () => {
      for (const shape of ALL_10_SHAPES) {
        for (const biome of [0, 1, 2, 3] as const) {
          const simBiome: 1 | 2 | 3 = biome === 0 ? 1 : biome;
          const map = createConfiguredShapeMap(shape, 'standard', simBiome, 1337 + biome * 17);
          const roomType = biome === 0 ? 'start' : 'combat';
          const plan = buildRoomArchitecturePlan(map, roomType, biome, 1337 + biome * 17);

          expect(plan.items).toBe(plan.solidDecors);
          expect(plan.items.length).toBeGreaterThan(0);

          for (const item of plan.items) {
            expect(
              isExteriorVoidWallTile(map, item.tx, item.ty),
              `${shape} biome ${biome} solidDecor ${item.kind} at (${item.tx},${item.ty}) must not be in Exterior Void`,
            ).toBe(false);
            expect(map.isSolidTile(item.tx, item.ty)).toBe(true);
            if (item.kind !== 'forge_anvil' && item.kind !== 'fluted_column') {
              const tileKind = map.getTile(item.tx, item.ty);
              if (tileKind === 'wall') {
                expect(isActiveWallTile(map, item.tx, item.ty)).toBe(true);
              }
            }
          }

          for (const decal of plan.floorDecals) {
            expect(isExteriorVoidWallTile(map, decal.tx, decal.ty)).toBe(false);
            expect(map.isSolidTile(decal.tx, decal.ty)).toBe(false);
            expect(isFloorDecalVisible(decal, map)).toBe(true);
          }

          if (shape !== 'rectangle') {
            const steppedInteriorDecors = plan.items.filter(
              (d) =>
                map.getTile(d.tx, d.ty) === 'wall' &&
                ((d.ty > 0 && d.ty < map.rows - 1) || (d.tx > 0 && d.tx < map.cols - 1)),
            );
            expect(
              steppedInteriorDecors.length,
              `Sculpted shape ${shape} in biome ${biome} should have stepped-in interior wall decors`,
            ).toBeGreaterThan(0);

            if (shape !== 't_shape') {
              const steppedNorthDecors = plan.items.filter(
                (d) =>
                  d.ty > 0 &&
                  map.getTile(d.tx, d.ty) === 'wall' &&
                  !map.isSolidTile(d.tx, d.ty + 1),
              );
              expect(
                steppedNorthDecors.length,
                `Sculpted shape ${shape} in biome ${biome} should have stepped-in 3/4 South cliff decors`,
              ).toBeGreaterThan(0);
            }
          }

          expect(plan.budget.largeDecorCount).toBeLessThanOrEqual(8);
          expect(plan.budget.smallPerimeterDecorCount).toBeLessThanOrEqual(
            Math.floor(plan.budget.perimeterTileCount / 3),
          );
          expect(plan.budget.emptyPerimeterRatio).toBeGreaterThanOrEqual(0.4);
          expect(plan.budget.centerArenaSolidDecorCount).toBe(0);
        }
      }

      // Also verify across all 6 size presets
      for (const preset of ALL_6_PRESETS) {
        const map = createConfiguredShapeMap('cruciform', preset, 1, 2026);
        const plan = buildRoomArchitecturePlan(map, 'combat', 1, 2026);
        for (const item of plan.items) {
          expect(isExteriorVoidWallTile(map, item.tx, item.ty)).toBe(false);
        }
        expect(plan.budget.largeDecorCount).toBeLessThanOrEqual(8);
        expect(plan.budget.emptyPerimeterRatio).toBeGreaterThanOrEqual(0.4);
      }
    });
  });

  describe('3. renderTileCellToCompositeImpl — Exterior Void (#0B090E), Outer-Wall Casing & 90° Concave Parapet Miters', () => {
    it('fills Exterior Void cells with PALETTE.INK_DEEP (#0B090E) and draws outer-wall shadow, INK_DARK backing edge, and seam along active wall neighbors', () => {
      const map = createConfiguredShapeMap('cruciform', 'standard', 1, 1337);
      const scale = 2;
      const cellPx = TILE_SIZE * scale;

      // Find an Exterior Void tile that borders an Active Wall tile on at least one cardinal side
      let targetVoidTile: { tx: number; ty: number } | null = null;
      for (let ty = 0; ty < map.rows && !targetVoidTile; ty++) {
        for (let tx = 0; tx < map.cols && !targetVoidTile; tx++) {
          if (!isExteriorVoidWallTile(map, tx, ty)) continue;
          const bordersActive =
            (ty > 0 && isActiveWallTile(map, tx, ty - 1)) ||
            (ty + 1 < map.rows && isActiveWallTile(map, tx, ty + 1)) ||
            (tx > 0 && isActiveWallTile(map, tx - 1, ty)) ||
            (tx + 1 < map.cols && isActiveWallTile(map, tx + 1, ty));
          if (bordersActive) {
            targetVoidTile = { tx, ty };
          }
        }
      }
      expect(targetVoidTile).not.toBeNull();

      const { ctx, ops } = createRecordingCanvas2D();
      const drawnKeys: string[] = [];
      const mockScene = {
        map,
        tileCompositeScale: scale,
        lastRenderedBiome: 1 as const,
        drawSourceKeyToCtx: (_c: CanvasRenderingContext2D, key: string) => {
          drawnKeys.push(key);
        },
      } as unknown as GameScene;

      const visual: ArenaTileVisual = {
        tx: targetVoidTile!.tx,
        ty: targetVoidTile!.ty,
        kind: 'wall',
        variant: 0,
        distToWall: 0,
        autotileMask: 15,
        aoMask: 0,
        surface: 'none',
        surfaceMask: 0,
      };

      renderTileCellToCompositeImpl.call(mockScene, ctx, visual, scale, 1);

      // Must NOT draw baked wall texture on Exterior Void
      expect(drawnKeys.length).toBe(0);

      // Must fill entire 32x32*scale cell with PALETTE.INK_DEEP (#0B090E)
      const dx = visual.tx * cellPx;
      const dy = visual.ty * cellPx;
      const deepFill = ops.find(
        (o) =>
          o.op === 'fillRect' &&
          o.fillStyle?.toUpperCase() === PALETTE.INK_DEEP.toUpperCase() &&
          o.args[0] === dx &&
          o.args[1] === dy &&
          o.args[2] === cellPx &&
          o.args[3] === cellPx,
      );
      expect(deepFill).toBeDefined();

      // Must draw 6*scale ENV_PALETTE[1].shadow strip, 2*scale PALETTE.INK_DARK strip, and 1*scale ENV_PALETTE[1].seam stroke
      const shadowFill = ops.find(
        (o) =>
          o.op === 'fillRect' &&
          o.fillStyle?.toUpperCase() === ENV_PALETTE[1].shadow.toUpperCase() &&
          o.globalAlpha === 0.65,
      );
      expect(shadowFill).toBeDefined();

      const inkDarkFill = ops.find(
        (o) =>
          o.op === 'fillRect' &&
          o.fillStyle?.toUpperCase() === PALETTE.INK_DARK.toUpperCase() &&
          (o.args[2] === 2 * scale || o.args[3] === 2 * scale),
      );
      expect(inkDarkFill).toBeDefined();

      const seamStroke = ops.find(
        (o) =>
          o.op === 'stroke' &&
          o.strokeStyle?.toUpperCase() === ENV_PALETTE[1].seam.toUpperCase() &&
          o.lineWidth === 1 * scale,
      );
      expect(seamStroke).toBeDefined();
    });

    it('draws void-facing edge casing and 7x6 / 7x11 90° concave-corner parapet coping miters on active autotileMask===15 walls', () => {
      const map = createConfiguredShapeMap('cruciform', 'standard', 2, 1337);
      const scale = 2;

      // Find an active wall tile with autotileMask === 15 that borders Exterior Void AND has a diagonal floor neighbor
      let concaveWall: {
        tx: number;
        ty: number;
        floorNE: boolean;
        floorNW: boolean;
        floorSE: boolean;
        floorSW: boolean;
      } | null = null;

      for (let ty = 1; ty < map.rows - 1; ty++) {
        for (let tx = 1; tx < map.cols - 1; tx++) {
          if (!isActiveWallTile(map, tx, ty)) continue;
          if (map.getAutotileMask(tx, ty) !== 15) continue;
          const floorNE = !map.isSolidTile(tx + 1, ty - 1);
          const floorNW = !map.isSolidTile(tx - 1, ty - 1);
          const floorSE = !map.isSolidTile(tx + 1, ty + 1);
          const floorSW = !map.isSolidTile(tx - 1, ty + 1);
          if (floorNE || floorNW || floorSE || floorSW) {
            concaveWall = { tx, ty, floorNE, floorNW, floorSE, floorSW };
            break;
          }
        }
        if (concaveWall) break;
      }
      expect(concaveWall).not.toBeNull();

      const { ctx, ops } = createRecordingCanvas2D();
      const drawnKeys: string[] = [];
      const mockScene = {
        map,
        tileCompositeScale: scale,
        lastRenderedBiome: 2 as const,
        drawSourceKeyToCtx: (_c: CanvasRenderingContext2D, key: string) => {
          drawnKeys.push(key);
        },
      } as unknown as GameScene;

      const dist = computeTileDistToWall(map, concaveWall!.tx, concaveWall!.ty);
      const tileVisual: ArenaTileVisual = {
        tx: concaveWall!.tx,
        ty: concaveWall!.ty,
        kind: 'wall',
        variant: resolveHybridFloorVariant(concaveWall!.tx, concaveWall!.ty, dist),
        distToWall: dist,
        autotileMask: 15,
        aoMask: 0,
        surface: 'none',
        surfaceMask: 0,
      };

      renderTileCellToCompositeImpl.call(mockScene, ctx, tileVisual, scale, 2);

      // Must draw floor base + wall_2_15 texture
      expect(drawnKeys).toContain('biome_wall_2_15');

      // Must draw void-facing contour lines (env.seam + PALETTE.INK_DARK)
      const voidSeamStroke = ops.find(
        (o) =>
          o.op === 'stroke' &&
          o.strokeStyle?.toUpperCase() === ENV_PALETTE[2].seam.toUpperCase() &&
          o.lineWidth === 1 * scale,
      );
      expect(voidSeamStroke).toBeDefined();

      // Must draw 7x6 or 7x11 parapet coping miter in env.wallFront + INK_DARK 1.8*scale L-corner stroke
      const miterFill = ops.find(
        (o) =>
          o.op === 'fillRect' &&
          o.fillStyle?.toUpperCase() === ENV_PALETTE[2].wallFront.toUpperCase() &&
          o.args[2] === 7 * scale &&
          (o.args[3] === 6 * scale || o.args[3] === 11 * scale),
      );
      expect(miterFill).toBeDefined();

      const miterCornerStroke = ops.find(
        (o) =>
          o.op === 'stroke' &&
          o.strokeStyle?.toUpperCase() === PALETTE.INK_DARK.toUpperCase() &&
          Math.abs((o.lineWidth ?? 0) - 1.8 * scale) < 0.01,
      );
      expect(miterCornerStroke).toBeDefined();

      // Also verify NE/NW (7x6) vs SE/SW (7x11) explicitly by testing all 4 outer corners of a rectangle room
      const rectMap = createConfiguredShapeMap('rectangle', 'standard', 1, 1337);
      for (const [cx, cy, expectedH] of [
        [0, 0, 11 * scale], // SW-like / SE floor neighbor -> 7x11
        [rectMap.cols - 1, 0, 11 * scale], // SW floor neighbor -> 7x11
        [0, rectMap.rows - 1, 6 * scale], // NE floor neighbor -> 7x6
        [rectMap.cols - 1, rectMap.rows - 1, 6 * scale], // NW floor neighbor -> 7x6
      ] as const) {
        const rec = createRecordingCanvas2D();
        const sceneRect = {
          map: rectMap,
          tileCompositeScale: scale,
          drawSourceKeyToCtx: () => {},
        } as unknown as GameScene;
        renderTileCellToCompositeImpl.call(
          sceneRect,
          rec.ctx,
          {
            tx: cx,
            ty: cy,
            kind: 'wall',
            variant: 0,
            distToWall: 0,
            autotileMask: 15,
            aoMask: 0,
            surface: 'none',
            surfaceMask: 0,
          },
          scale,
          1,
        );
        const cornerMiter = rec.ops.find(
          (o) =>
            o.op === 'fillRect' &&
            o.fillStyle?.toUpperCase() === ENV_PALETTE[1].wallFront.toUpperCase() &&
            o.args[2] === 7 * scale &&
            o.args[3] === expectedH,
        );
        expect(cornerMiter, `Corner (${cx},${cy}) miter height ${expectedH}`).toBeDefined();
      }
    });
  });

  describe('4. resolveMinimapNodeDims — Proportional Node Sizing across all 6 RoomSizePresets', () => {
    it('scales (nodeW, nodeH) proportionally across compact, standard, wide_hall, tall_sanctum, grand_arena, and colossal_boss', () => {
      const cellStep = 40;
      const compact = resolveMinimapNodeDims(cellStep, 'compact', 28, 18);
      const standard = resolveMinimapNodeDims(cellStep, 'standard', 36, 22);
      const wideHall = resolveMinimapNodeDims(cellStep, 'wide_hall', 46, 20);
      const tallSanctum = resolveMinimapNodeDims(cellStep, 'tall_sanctum', 32, 28);
      const grandArena = resolveMinimapNodeDims(cellStep, 'grand_arena', 44, 26);
      const colossalBoss = resolveMinimapNodeDims(cellStep, 'colossal_boss', 48, 28);

      expect(compact.nodeW).toBeLessThan(standard.nodeW);
      expect(compact.nodeH).toBeLessThan(standard.nodeH);
      expect(wideHall.nodeW).toBeGreaterThan(standard.nodeW);
      expect(wideHall.nodeW).toBeGreaterThan(tallSanctum.nodeW);
      expect(tallSanctum.nodeH).toBeGreaterThan(standard.nodeH);
      expect(tallSanctum.nodeH).toBeGreaterThan(wideHall.nodeH);
      expect(grandArena.nodeW).toBeGreaterThan(standard.nodeW);
      expect(grandArena.nodeH).toBeGreaterThan(standard.nodeH);
      expect(colossalBoss.nodeW).toBeGreaterThanOrEqual(grandArena.nodeW);
      expect(colossalBoss.nodeH).toBeGreaterThanOrEqual(grandArena.nodeH);
    });
  });

  describe('5. computeMinimapRoomPolygon & drawMinimapRoomSilhouette — All 10 Canonical Shapes + Inner Topologies', () => {
    it('produces pairwise-distinct polygon vertex arrays with expected vertex counts across all 10 canonical RoomShapeKinds', () => {
      const expectedVertexCounts: Record<CanonicalRoomShape, number> = {
        rectangle: 4,
        l_shape: 6,
        octagon: 8,
        t_shape: 8,
        u_shape: 8,
        donut_ring: 8,
        island_catwalk: 8,
        multi_chamber: 10,
        cruciform: 12,
        hourglass: 12,
      };

      const serializedPolygons = new Set<string>();
      for (const shape of ALL_10_SHAPES) {
        const poly = computeMinimapRoomPolygon(shape, 100, 80, 36, 28, 0);
        expect(poly.length, `Vertex count for ${shape}`).toBe(expectedVertexCounts[shape]);
        const key = JSON.stringify(poly);
        expect(serializedPolygons.has(key), `Polygon for ${shape} must be unique`).toBe(false);
        serializedPolygons.add(key);
      }
      expect(serializedPolygons.size).toBe(10);

      // Verify orientation rotation for l_shape, t_shape, u_shape
      expect(computeMinimapRoomPolygon('l_shape', 0, 0, 30, 24, 0)).not.toEqual(
        computeMinimapRoomPolygon('l_shape', 0, 0, 30, 24, 1),
      );
      expect(computeMinimapRoomPolygon('t_shape', 0, 0, 30, 24, 0)).not.toEqual(
        computeMinimapRoomPolygon('t_shape', 0, 0, 30, 24, 1),
      );
      expect(computeMinimapRoomPolygon('u_shape', 0, 0, 30, 24, 0)).not.toEqual(
        computeMinimapRoomPolygon('u_shape', 0, 0, 30, 24, 1),
      );
    });

    it('renders inner hollow core for donut_ring, partition line for multi_chamber, and dark chasm moat + 20-vertex inner island/catwalk for island_catwalk', () => {
      const createMockGraphics = () => {
        const calls: Array<{ method: string; args: unknown[] }> = [];
        const g = {
          fillStyle: vi.fn((...args: unknown[]) => {
            calls.push({ method: 'fillStyle', args });
            return g;
          }),
          lineStyle: vi.fn((...args: unknown[]) => {
            calls.push({ method: 'lineStyle', args });
            return g;
          }),
          beginPath: vi.fn(() => {
            calls.push({ method: 'beginPath', args: [] });
            return g;
          }),
          moveTo: vi.fn((...args: unknown[]) => {
            calls.push({ method: 'moveTo', args });
            return g;
          }),
          lineTo: vi.fn((...args: unknown[]) => {
            calls.push({ method: 'lineTo', args });
            return g;
          }),
          closePath: vi.fn(() => {
            calls.push({ method: 'closePath', args: [] });
            return g;
          }),
          fillPath: vi.fn(() => {
            calls.push({ method: 'fillPath', args: [] });
            return g;
          }),
          strokePath: vi.fn(() => {
            calls.push({ method: 'strokePath', args: [] });
            return g;
          }),
          fillRect: vi.fn((...args: unknown[]) => {
            calls.push({ method: 'fillRect', args });
            return g;
          }),
          strokeRect: vi.fn((...args: unknown[]) => {
            calls.push({ method: 'strokeRect', args });
            return g;
          }),
        } as unknown as Phaser.GameObjects.Graphics;
        return { g, calls };
      };

      // 1. donut_ring: outer 8-vertex polygon + inner hole fillRect/strokeRect in UI_THEME.panelBgDark
      const donutRec = createMockGraphics();
      drawMinimapRoomSilhouette(donutRec.g, 'donut_ring', 50, 50, 32, 24, 0x1e3a2f, 0.96, 0xfacc15, 1.5);
      expect(donutRec.g.fillPath).toHaveBeenCalledTimes(1);
      expect(donutRec.g.fillRect).toHaveBeenCalledTimes(1);
      expect(donutRec.g.strokeRect).toHaveBeenCalledTimes(1);
      expect(
        donutRec.calls.some(
          (c) => c.method === 'fillStyle' && c.args[0] === UI_THEME.panelBgDark,
        ),
      ).toBe(true);

      // 2. multi_chamber: outer 10-vertex polygon + interior partition strokePath
      const multiRec = createMockGraphics();
      drawMinimapRoomSilhouette(multiRec.g, 'multi_chamber', 50, 50, 32, 24, 0x1e3a2f, 0.96, 0xfacc15, 1.5);
      expect(multiRec.g.fillPath).toHaveBeenCalledTimes(1);
      expect(multiRec.g.strokePath).toHaveBeenCalledTimes(2);

      // 3. island_catwalk: outer 8-vertex chasm moat in UI_THEME.inkDeep + inner 20-vertex cross-catwalk/island polygon
      const islandRec = createMockGraphics();
      drawMinimapRoomSilhouette(islandRec.g, 'island_catwalk', 50, 50, 32, 24, 0x1e3a2f, 0.96, 0xfacc15, 1.5);
      expect(islandRec.g.fillPath).toHaveBeenCalledTimes(2);
      expect(islandRec.g.strokePath).toHaveBeenCalledTimes(2);
      expect(islandRec.calls[0]).toEqual({
        method: 'fillStyle',
        args: [UI_THEME.inkDeep, expect.any(Number)],
      });
      // Outer 8 vertices (1 moveTo + 7 lineTo) + Inner 20 vertices (1 moveTo + 19 lineTo) = 26 lineTo calls
      expect(islandRec.g.lineTo).toHaveBeenCalledTimes(26);
    });
  });

  describe('6. updateMinimapHudImpl — Live Room Shape/Size Resolution & Real-Time Player Position Dot', () => {
    it('draws shaped room polygons, reflects live sim.map.roomShape and sim.map.cols×rows, and moves the player fillCircle dot when sim.player moves', () => {
      const sim = new WorldSim({ seed: 1337, biome: 1 });
      sim.enterRoom(sim.dungeon.startRoomId);

      const fillCircles: Array<{ x: number; y: number; r: number }> = [];
      let lineToCount = 0;
      const mockMinimapGraphics = {
        clear: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        fillRoundedRect: vi.fn().mockReturnThis(),
        strokeRoundedRect: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
        fillCircle: vi.fn((x: number, y: number, r: number) => {
          fillCircles.push({ x, y, r });
          return mockMinimapGraphics;
        }),
        strokeCircle: vi.fn().mockReturnThis(),
        fillTriangle: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
        beginPath: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        lineTo: vi.fn(() => {
          lineToCount += 1;
          return mockMinimapGraphics;
        }),
        arc: vi.fn().mockReturnThis(),
        closePath: vi.fn().mockReturnThis(),
        fillPath: vi.fn().mockReturnThis(),
        strokePath: vi.fn().mockReturnThis(),
      } as unknown as Phaser.GameObjects.Graphics;

      const mockTitleText = {
        text: '',
        setText: vi.fn(function (this: { text: string }, t: string) {
          this.text = t;
          return this;
        }),
        setOrigin: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
      };

      const mockScene = {
        transport: {
          getSim: () => sim,
        },
        minimapGraphics: mockMinimapGraphics,
        minimapTitleText: mockTitleText,
        fullMapOpen: false,
        hudPadX: 0,
        hudPadY: 0,
        lastMinimapHash: '',
      } as unknown as GameScene;

      // 1. Initial render with player near NW corner of a rectangle room
      (sim.map as { roomShape: string }).roomShape = 'rectangle';
      sim.player.x = TILE_SIZE * 4;
      sim.player.y = TILE_SIZE * 4;
      updateMinimapHudImpl.call(mockScene);

      expect(fillCircles.length).toBeGreaterThanOrEqual(2);
      const dotPosNW = fillCircles[fillCircles.length - 1]!;
      const rectLineToCount = lineToCount;

      // 2. Mutate live sim.map.roomShape to 'cruciform' (12 vertices instead of 4) and move player to SE corner
      fillCircles.length = 0;
      lineToCount = 0;
      (sim.map as { roomShape: string }).roomShape = 'cruciform';
      sim.map.cols = 46;
      sim.map.rows = 20;
      sim.map.width = 46 * TILE_SIZE;
      sim.map.height = 20 * TILE_SIZE;
      sim.map.mapRevision += 1;
      sim.player.x = sim.map.width - TILE_SIZE * 4;
      sim.player.y = sim.map.height - TILE_SIZE * 4;

      updateMinimapHudImpl.call(mockScene);

      expect(fillCircles.length).toBeGreaterThanOrEqual(2);
      const dotPosSE = fillCircles[fillCircles.length - 1]!;
      // Cruciform has 12 vertices vs rectangle's 4 vertices (+8 lineTo calls)
      expect(lineToCount).toBe(rectLineToCount + 8);
      // Player dot must move right and down when player moves from NW to SE
      expect(dotPosSE.x).toBeGreaterThan(dotPosNW.x);
      expect(dotPosSE.y).toBeGreaterThan(dotPosNW.y);
    });
  });
});
