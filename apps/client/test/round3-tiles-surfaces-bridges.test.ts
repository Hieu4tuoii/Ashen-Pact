import {
  ArenaMap,
  AUTOTILE_EAST,
  AUTOTILE_NORTH,
  AUTOTILE_SOUTH,
  AUTOTILE_WEST,
  TILE_SIZE,
  WALL_AO_NORTH,
  WALL_AO_NORTH_WEST,
  WALL_AO_WEST,
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
import {
  drawBridgeOverChasmOverlay,
  drawSurfaceTile,
  hasChasmAlongAxisWithin3,
  traceOrganicPoolPath,
} from '../src/art/texture-baker-surfaces.js';
import {
  bakePillarTile,
  bakeWallAoOverlay,
  bakeWallTile,
} from '../src/art/texture-baker-tiles.js';
import type { ArenaTileVisual, GameScene } from '../src/scenes/GameScene.js';
import { renderTileCellToCompositeImpl } from '../src/scenes/game-scene/arena-tiles.js';

interface RecordedOp {
  type:
    | 'fillRect'
    | 'strokeRect'
    | 'clearRect'
    | 'fill'
    | 'stroke'
    | 'arc'
    | 'arcTo'
    | 'ellipse'
    | 'moveTo'
    | 'lineTo'
    | 'quadraticCurveTo'
    | 'rect'
    | 'clip'
    | 'beginPath'
    | 'closePath'
    | 'save'
    | 'restore'
    | 'scale'
    | 'translate'
    | 'drawImage';
  args: number[];
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  globalAlpha?: number;
  pathPoints?: Array<[number, number]>;
}

interface RecordedGradient {
  kind: 'linear' | 'radial';
  args: number[];
  stops: Array<[number, string]>;
}

function createFullRecordingCanvas2D() {
  const ops: RecordedOp[] = [];
  const gradients: RecordedGradient[] = [];
  let fillStyle = '#000000';
  let strokeStyle = '#000000';
  let lineWidth = 1;
  let globalAlpha = 1;
  let currentPath: Array<[number, number]> = [];
  const stack: Array<{
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    globalAlpha: number;
  }> = [];

  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string | object) {
      fillStyle = typeof v === 'string' ? v : '[gradient]';
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(v: string | object) {
      strokeStyle = typeof v === 'string' ? v : '[gradient]';
    },
    get lineWidth() {
      return lineWidth;
    },
    set lineWidth(v: number) {
      lineWidth = Number(v);
    },
    get globalAlpha() {
      return globalAlpha;
    },
    set globalAlpha(v: number) {
      globalAlpha = Number(v);
    },
    lineCap: 'butt',
    lineJoin: 'miter',
    save: () => {
      stack.push({ fillStyle, strokeStyle, lineWidth, globalAlpha });
      ops.push({ type: 'save', args: [] });
    },
    restore: () => {
      const s = stack.pop();
      if (s) {
        fillStyle = s.fillStyle;
        strokeStyle = s.strokeStyle;
        lineWidth = s.lineWidth;
        globalAlpha = s.globalAlpha;
      }
      ops.push({ type: 'restore', args: [] });
    },
    scale: (sx: number, sy: number) => {
      ops.push({ type: 'scale', args: [sx, sy] });
    },
    translate: (dx: number, dy: number) => {
      ops.push({ type: 'translate', args: [dx, dy] });
    },
    clearRect: (x: number, y: number, w: number, h: number) => {
      ops.push({ type: 'clearRect', args: [x, y, w, h] });
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      ops.push({
        type: 'fillRect',
        args: [x, y, w, h],
        fillStyle,
        globalAlpha,
      });
    },
    strokeRect: (x: number, y: number, w: number, h: number) => {
      ops.push({
        type: 'strokeRect',
        args: [x, y, w, h],
        strokeStyle,
        lineWidth,
        globalAlpha,
      });
    },
    beginPath: () => {
      currentPath = [];
      ops.push({ type: 'beginPath', args: [] });
    },
    closePath: () => {
      ops.push({ type: 'closePath', args: [] });
    },
    moveTo: (x: number, y: number) => {
      currentPath.push([x, y]);
      ops.push({ type: 'moveTo', args: [x, y] });
    },
    lineTo: (x: number, y: number) => {
      currentPath.push([x, y]);
      ops.push({ type: 'lineTo', args: [x, y] });
    },
    quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => {
      currentPath.push([cpx, cpy], [x, y]);
      ops.push({ type: 'quadraticCurveTo', args: [cpx, cpy, x, y] });
    },
    arc: (x: number, y: number, r: number, s: number, e: number) => {
      ops.push({ type: 'arc', args: [x, y, r, s, e], fillStyle, strokeStyle });
    },
    arcTo: (x1: number, y1: number, x2: number, y2: number, r: number) => {
      ops.push({ type: 'arcTo', args: [x1, y1, x2, y2, r] });
    },
    ellipse: (
      x: number,
      y: number,
      rx: number,
      ry: number,
      rot: number,
      s: number,
      e: number,
    ) => {
      ops.push({
        type: 'ellipse',
        args: [x, y, rx, ry, rot, s, e],
        fillStyle,
        globalAlpha,
      });
    },
    rect: (x: number, y: number, w: number, h: number) => {
      ops.push({ type: 'rect', args: [x, y, w, h] });
    },
    clip: () => {
      ops.push({ type: 'clip', args: [] });
    },
    fill: () => {
      ops.push({
        type: 'fill',
        args: [],
        fillStyle,
        globalAlpha,
        pathPoints: [...currentPath],
      });
    },
    stroke: () => {
      ops.push({
        type: 'stroke',
        args: [],
        strokeStyle,
        lineWidth,
        globalAlpha,
        pathPoints: [...currentPath],
      });
    },
    drawImage: (_img: unknown, dx: number, dy: number, dw: number, dh: number) => {
      ops.push({ type: 'drawImage', args: [dx, dy, dw, dh] });
    },
    createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
      const g: RecordedGradient = { kind: 'linear', args: [x0, y0, x1, y1], stops: [] };
      gradients.push(g);
      return {
        addColorStop: (offset: number, color: string) => {
          g.stops.push([offset, color]);
        },
      };
    },
    createRadialGradient: (
      x0: number,
      y0: number,
      r0: number,
      x1: number,
      y1: number,
      r1: number,
    ) => {
      const g: RecordedGradient = {
        kind: 'radial',
        args: [x0, y0, r0, x1, y1, r1],
        stops: [],
      };
      gradients.push(g);
      return {
        addColorStop: (offset: number, color: string) => {
          g.stops.push([offset, color]);
        },
      };
    },
  } as unknown as CanvasRenderingContext2D;

  return { ctx, ops, gradients };
}

function withMockDocumentCanvas<T>(
  fn: (getLastCanvas: () => ReturnType<typeof createFullRecordingCanvas2D> | null) => T,
): T {
  let lastRec: ReturnType<typeof createFullRecordingCanvas2D> | null = null;
  const prevDoc = globalThis.document;
  globalThis.document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        const rec = createFullRecordingCanvas2D();
        lastRec = rec;
        return {
          width: 32,
          height: 32,
          getContext: () => rec.ctx,
        };
      }
      return {};
    },
  } as unknown as Document;

  try {
    return fn(() => lastRec);
  } finally {
    globalThis.document = prevDoc;
  }
}

function createMockPhaserScene(): Phaser.Scene {
  return {
    textures: {
      exists: () => false,
      remove: () => {},
      addCanvas: () => {},
    },
  } as unknown as Phaser.Scene;
}

describe('Round 3 Milestone M2_r3 — F16 (Walls, Parapets, Miters, Void Casing, AO, Pillars) & F17 (Seamless Hazards, Concave Shorelines, Chasm & Multi-Axis Bridges)', () => {
  describe('Item 1: bakeWallTile Parapet Coping on !hasS Tiles & Open Seam Strokes', () => {
    it('draws 4u parapet coping clamped to capBottom (20u when !hasS, 32u when hasS) and open seam strokes only along exposed edges without strokeRect(4,4,24,24)', () => {
      const scene = createMockPhaserScene();

      withMockDocumentCanvas((getLast) => {
        // Case A: !hasS (m = AUTOTILE_NORTH = 1 -> exposed W and E, !hasS -> capBottom = 20)
        bakeWallTile(scene, 1, AUTOTILE_NORTH, 1);
        const recNoSouth = getLast()!;
        expect(recNoSouth).not.toBeNull();

        // Must never emit closed strokeRect(4, 4, 24, 24)
        expect(recNoSouth.ops.some((o) => o.type === 'strokeRect')).toBe(false);

        // Must draw W coping (0, 0, 4, 20) and E coping (28, 0, 4, 20) in env.wallFront
        const westCoping = recNoSouth.ops.find(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === ENV_PALETTE[1].wallFront.toUpperCase() &&
            o.args[0] === 0 &&
            o.args[1] === 0 &&
            o.args[2] === 4 &&
            o.args[3] === 20,
        );
        const eastCoping = recNoSouth.ops.find(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === ENV_PALETTE[1].wallFront.toUpperCase() &&
            o.args[0] === 28 &&
            o.args[1] === 0 &&
            o.args[2] === 4 &&
            o.args[3] === 20,
        );
        expect(westCoping).toBeDefined();
        expect(eastCoping).toBeDefined();

        // Open seam stroke along x=4 and x=28 up to y=20 (capBottom)
        const seamStroke = recNoSouth.ops.find(
          (o) =>
            o.type === 'stroke' &&
            o.strokeStyle?.toUpperCase() === ENV_PALETTE[1].seam.toUpperCase() &&
            Math.abs((o.lineWidth ?? 0) - 1.1) < 0.01,
        );
        expect(seamStroke).toBeDefined();
        expect(seamStroke!.pathPoints).toEqual([
          [4, 0],
          [4, 20],
          [28, 0],
          [28, 20],
        ]);

        // Case B: hasS (m = AUTOTILE_SOUTH = 4 -> !hasN, !hasW, !hasE, capBottom = 32)
        bakeWallTile(scene, 2, AUTOTILE_SOUTH, 1);
        const recWithSouth = getLast()!;
        expect(recWithSouth.ops.some((o) => o.type === 'strokeRect')).toBe(false);
        expect(
          recWithSouth.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              o.args[0] === 0 &&
              o.args[1] === 0 &&
              o.args[2] === 32 &&
              o.args[3] === 4,
          ),
        ).toBe(true);
        expect(
          recWithSouth.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              o.args[0] === 0 &&
              o.args[1] === 0 &&
              o.args[2] === 4 &&
              o.args[3] === 32,
          ),
        ).toBe(true);
      });
    });
  });

  describe('Item 2: bakeWallTile Subtle North Cliff Mortar Weathering (No #F59E42 in Hub)', () => {
    it('never uses bright orange #F59E42 on Hub (biome 0) walls and renders low-alpha (0.24..0.25) stepped mortar courses with biome-distinct tones on biomes 1..3', () => {
      const scene = createMockPhaserScene();

      withMockDocumentCanvas((getLast) => {
        for (let m = 0; m < 16; m++) {
          bakeWallTile(scene, 0, m, 1);
          const recHub = getLast()!;
          const usesOrange = recHub.ops.some(
            (o) =>
              o.fillStyle?.toUpperCase() === '#F59E42' ||
              o.strokeStyle?.toUpperCase() === '#F59E42',
          );
          expect(usesOrange, `Hub wall mask ${m} must not use #F59E42`).toBe(false);
        }

        // Verify low-alpha stepped mortar weathering on !hasS for Biomes 1, 2, 3 and pairwise distinct color signatures
        const colorSigs: string[] = [];
        for (const biome of [1, 2, 3] as const) {
          bakeWallTile(scene, biome, AUTOTILE_EAST | AUTOTILE_WEST, 1);
          const rec = getLast()!;
          const mortarStroke = rec.ops.find(
            (o) =>
              o.type === 'stroke' &&
              o.strokeStyle?.toUpperCase() === ENV_PALETTE[biome].seam.toUpperCase() &&
              Math.abs((o.globalAlpha ?? 0) - 0.25) < 0.01,
          );
          expect(mortarStroke).toBeDefined();

          const colors = new Set<string>();
          for (const op of rec.ops) {
            if (op.fillStyle) colors.add(op.fillStyle.toUpperCase());
            if (op.strokeStyle) colors.add(op.strokeStyle.toUpperCase());
          }
          colorSigs.push([...colors].sort().join(','));
        }
        expect(colorSigs[0]).not.toBe(colorSigs[1]);
        expect(colorSigs[1]).not.toBe(colorSigs[2]);
      });
    });
  });

  describe('Item 3: 4x4 & 4x12 Concave-Corner Parapet Miters & Stepped Concave Corners (autotileMask !== 15)', () => {
    it('draws aligned 4x4 (NE/NW) and 4x12 at y=20..32 (SE/SW) miters on both autotileMask === 15 and stepped walls (autotileMask !== 15) while preserving T5-WB-17', () => {
      const map = new ArenaMap({ cols: 12, rows: 12, includePillars: false, seed: 42, biome: 2 });
      // Carve a stepped wall at (5, 5) where N (5,4) and E (6,5) are wall, W (4,5) and S (5,6) are floor, and NE (6,4) is floor
      for (let ty = 1; ty < 11; ty++) {
        for (let tx = 1; tx < 11; tx++) {
          map.tiles[ty * map.cols + tx] = 'floor';
        }
      }
      map.tiles[5 * map.cols + 5] = 'wall';
      map.tiles[4 * map.cols + 5] = 'wall'; // N is solid
      map.tiles[5 * map.cols + 6] = 'wall'; // E is solid
      // (6, 4) NE is floor -> stepped concave NE corner with autotileMask = AUTOTILE_NORTH | AUTOTILE_EAST = 3 (!== 15)

      const scale = 2;
      const { ctx, ops } = createFullRecordingCanvas2D();
      const mockScene = {
        map,
        tileCompositeScale: scale,
        lastRenderedBiome: 2 as const,
        drawSourceKeyToCtx: () => {},
      } as unknown as GameScene;

      const steppedWallVisual: ArenaTileVisual = {
        tx: 5,
        ty: 5,
        kind: 'wall',
        variant: 0,
        distToWall: 0,
        autotileMask: AUTOTILE_NORTH | AUTOTILE_EAST, // 3 !== 15
        aoMask: 0,
        surface: 'none',
        surfaceMask: 0,
      };

      renderTileCellToCompositeImpl.call(mockScene, ctx, steppedWallVisual, scale, 2);

      const dx = 5 * TILE_SIZE * scale;
      const dy = 5 * TILE_SIZE * scale;

      // 1. Preserves T5-WB-17 7*scale x 6*scale fillRect
      expect(
        ops.some(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === ENV_PALETTE[2].wallFront.toUpperCase() &&
            o.args[2] === 7 * scale &&
            o.args[3] === 6 * scale,
        ),
      ).toBe(true);

      // 2. Restores margin with env.wallTop and draws exact 4x4 miter at (dx + 28*scale, dy, 4*scale, 4*scale)
      expect(
        ops.some(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === ENV_PALETTE[2].wallTop.toUpperCase() &&
            o.args[0] === dx + 25 * scale &&
            o.args[1] === dy &&
            o.args[2] === 3 * scale &&
            o.args[3] === 6 * scale,
        ),
      ).toBe(true);
      expect(
        ops.some(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === ENV_PALETTE[2].wallFront.toUpperCase() &&
            o.args[0] === dx + 28 * scale &&
            o.args[1] === dy &&
            o.args[2] === 4 * scale &&
            o.args[3] === 4 * scale,
        ),
      ).toBe(true);

      // Now test SE concave corner (S and E solid, SE floor) -> 4x12 at y = 20..32
      map.tiles[6 * map.cols + 5] = 'wall'; // S is solid
      const recSE = createFullRecordingCanvas2D();
      renderTileCellToCompositeImpl.call(
        mockScene,
        recSE.ctx,
        {
          ...steppedWallVisual,
          autotileMask: AUTOTILE_SOUTH | AUTOTILE_EAST, // 6 !== 15
        },
        scale,
        2,
      );
      expect(
        recSE.ops.some(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === ENV_PALETTE[2].wallFront.toUpperCase() &&
            o.args[0] === dx + 28 * scale &&
            o.args[1] === dy + 20 * scale &&
            o.args[2] === 4 * scale &&
            o.args[3] === 12 * scale,
        ),
      ).toBe(true);
    });
  });

  describe('Item 4: Diagonal Exterior Void Corner Shadows & Map-Border Outer Contours', () => {
    it('draws 6x6 env.shadow, 2x2 INK_DARK, and 1x1 env.seam corner dot on Exterior Void tiles diagonally adjacent to a 90° convex active-wall corner, and draws outer contours on map-border walls', () => {
      const map = new ArenaMap({ cols: 16, rows: 16, includePillars: false, seed: 7, biome: 1 });
      // Fill top-left 6x6 block with wall so (0..3, 0..3) are Exterior Void, (4, 4) is a 90° convex active-wall corner,
      // and (3, 3) is an Exterior Void tile whose ONLY active-wall neighbor is diagonal SE at (4, 4)
      for (let ty = 1; ty < 15; ty++) {
        for (let tx = 1; tx < 15; tx++) {
          map.tiles[ty * map.cols + tx] = tx <= 4 || ty <= 4 ? 'wall' : 'floor';
        }
      }

      const scale = 2;
      const cellPx = TILE_SIZE * scale;
      const { ctx, ops } = createFullRecordingCanvas2D();
      const mockScene = {
        map,
        tileCompositeScale: scale,
        lastRenderedBiome: 1 as const,
        drawSourceKeyToCtx: () => {},
      } as unknown as GameScene;

      // Render Exterior Void tile (3, 3) -> diagonal SE neighbor (4, 4) is active wall
      renderTileCellToCompositeImpl.call(
        mockScene,
        ctx,
        {
          tx: 3,
          ty: 3,
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

      const dx = 3 * cellPx;
      const dy = 3 * cellPx;

      // 6x6 shadow at SE corner
      expect(
        ops.some(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === ENV_PALETTE[1].shadow.toUpperCase() &&
            o.globalAlpha === 0.65 &&
            o.args[0] === dx + cellPx - 6 * scale &&
            o.args[1] === dy + cellPx - 6 * scale &&
            o.args[2] === 6 * scale &&
            o.args[3] === 6 * scale,
        ),
      ).toBe(true);

      // 2x2 INK_DARK at SE corner
      expect(
        ops.some(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === PALETTE.INK_DARK.toUpperCase() &&
            o.args[0] === dx + cellPx - 2 * scale &&
            o.args[1] === dy + cellPx - 2 * scale &&
            o.args[2] === 2 * scale &&
            o.args[3] === 2 * scale,
        ),
      ).toBe(true);

      // 1x1 env.seam corner dot at (dx + cellPx - 3*scale, dy + cellPx - 3*scale)
      expect(
        ops.some(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === ENV_PALETTE[1].seam.toUpperCase() &&
            o.args[0] === dx + cellPx - 3 * scale &&
            o.args[1] === dy + cellPx - 3 * scale &&
            o.args[2] === 1 * scale &&
            o.args[3] === 1 * scale,
        ),
      ).toBe(true);

      // Branch B: Map-border active wall at (8, 0) (ty === 0, where (8, 1) is floor) receives voidN outer contour strokes
      map.tiles[1 * map.cols + 8] = 'floor';
      const recBorder = createFullRecordingCanvas2D();
      renderTileCellToCompositeImpl.call(
        mockScene,
        recBorder.ctx,
        {
          tx: 8,
          ty: 0,
          kind: 'wall',
          variant: 0,
          distToWall: 0,
          autotileMask: AUTOTILE_EAST | AUTOTILE_WEST,
          aoMask: 0,
          surface: 'none',
          surfaceMask: 0,
        },
        scale,
        1,
      );
      expect(
        recBorder.ops.some(
          (o) =>
            o.type === 'stroke' &&
            o.strokeStyle?.toUpperCase() === ENV_PALETTE[1].seam.toUpperCase() &&
            o.lineWidth === 1 * scale,
        ),
      ).toBe(true);
      expect(
        recBorder.ops.some(
          (o) =>
            o.type === 'stroke' &&
            o.strokeStyle?.toUpperCase() === PALETTE.INK_DARK.toUpperCase() &&
            o.lineWidth === 1.5 * scale,
        ),
      ).toBe(true);
    });
  });

  describe('Item 5: Convex-Corner-Only 14x14 Wall AO & AO Suppression on Chasm/Emissive Surfaces', () => {
    it('draws the 14x14 diagonal corner gradient ONLY when aoMask === WALL_AO_NORTH_WEST (4), and skips wall_ao on chasm, lava, burning_oil, and burning_grass', () => {
      const scene = createMockPhaserScene();

      withMockDocumentCanvas((getLast) => {
        for (let aoMask = 1; aoMask <= 7; aoMask++) {
          bakeWallAoOverlay(scene, aoMask, 1);
          const rec = getLast()!;
          expect(rec.gradients.length).toBeGreaterThanOrEqual(1);
          const hasCorner14x14 = rec.gradients.some(
            (g) => g.args[2] === 14 && g.args[3] === 14,
          );
          if (aoMask === WALL_AO_NORTH_WEST) {
            expect(hasCorner14x14).toBe(true);
          } else {
            expect(
              hasCorner14x14,
              `aoMask=${aoMask} (with N or W bit) must not draw 14x14 corner blotch`,
            ).toBe(false);
          }
        }
      });

      // Verify arena-tiles.ts skips wall_ao on chasm, lava, burning_oil, burning_grass
      const map = new ArenaMap({ cols: 10, rows: 10, includePillars: false, seed: 1, biome: 1 });
      for (const suppressedSurface of ['chasm', 'lava', 'burning_oil', 'burning_grass'] as const) {
        const drawnKeys: string[] = [];
        const { ctx } = createFullRecordingCanvas2D();
        const mockScene = {
          map,
          tileCompositeScale: 1,
          lastRenderedBiome: 1 as const,
          drawSourceKeyToCtx: (_c: CanvasRenderingContext2D, key: string) => {
            drawnKeys.push(key);
          },
        } as unknown as GameScene;

        renderTileCellToCompositeImpl.call(
          mockScene,
          ctx,
          {
            tx: 2,
            ty: 2,
            kind: 'floor',
            variant: 0,
            distToWall: 1,
            autotileMask: 0,
            aoMask: WALL_AO_NORTH | WALL_AO_WEST,
            surface: suppressedSurface,
            surfaceMask: 15,
          },
          1,
          1,
        );
        expect(drawnKeys.some((k) => k.startsWith('wall_ao_'))).toBe(false);
      }

      // Dry floor ('none') still draws wall_ao
      const dryKeys: string[] = [];
      const { ctx: dryCtx } = createFullRecordingCanvas2D();
      renderTileCellToCompositeImpl.call(
        {
          map,
          tileCompositeScale: 1,
          lastRenderedBiome: 1 as const,
          drawSourceKeyToCtx: (_c: CanvasRenderingContext2D, key: string) => {
            dryKeys.push(key);
          },
        } as unknown as GameScene,
        dryCtx,
        {
          tx: 2,
          ty: 2,
          kind: 'floor',
          variant: 0,
          distToWall: 1,
          autotileMask: 0,
          aoMask: WALL_AO_NORTH,
          surface: 'none',
          surfaceMask: 0,
        },
        1,
        1,
      );
      expect(dryKeys).toContain(`wall_ao_${WALL_AO_NORTH}`);
    });
  });

  describe('Item 6: bakePillarTile & arena-tiles.ts Non-2x2 Pillar Medallion Prevention', () => {
    it('draws circular rune medallions ONLY on pure 2x2 corner masks (3, 6, 9, 12) and m === 0 in bakePillarTile, and overpaints corner medallions on incomplete/non-2x2 pillars in arena-tiles.ts', () => {
      const scene = createMockPhaserScene();

      withMockDocumentCanvas((getLast) => {
        const medallionMasks = new Set([0, 3, 6, 9, 12]);
        for (let m = 0; m < 16; m++) {
          bakePillarTile(scene, 1, m, 1);
          const rec = getLast()!;
          const arcCount = rec.ops.filter((o) => o.type === 'arc').length;
          if (medallionMasks.has(m)) {
            expect(arcCount, `Mask ${m} should draw circular medallion`).toBeGreaterThanOrEqual(2);
          } else {
            expect(arcCount, `Non-corner mask ${m} must not draw circular medallion`).toBe(0);
          }
        }
      });

      // Test arena-tiles.ts complete 2x2 pillar quad vs 2x4 pillar (PRISM_LABYRINTH) vs 1-tile C-wall corner
      const map = new ArenaMap({ cols: 16, rows: 16, includePillars: false, seed: 9, biome: 2 });
      for (let i = 0; i < map.tiles.length; i++) map.tiles[i] = 'floor';

      // Complete 2x2 pillar quad at (3,3)..(4,4)
      map.tiles[3 * 16 + 3] = 'pillar';
      map.tiles[3 * 16 + 4] = 'pillar';
      map.tiles[4 * 16 + 3] = 'pillar';
      map.tiles[4 * 16 + 4] = 'pillar';

      // 2x4 pillar at (8,3)..(9,6) -> top row (8,3) has mask 6, but (8,4) has mask 7 (not 3)
      for (let py = 3; py <= 6; py++) {
        map.tiles[py * 16 + 8] = 'pillar';
        map.tiles[py * 16 + 9] = 'pillar';
      }

      const scale = 2;
      const mockScene = {
        map,
        tileCompositeScale: scale,
        lastRenderedBiome: 2 as const,
        drawSourceKeyToCtx: () => {},
      } as unknown as GameScene;

      // 1. True 2x2 pillar at (3, 3) with mask 6 -> must NOT overpaint corner medallion
      const rec2x2 = createFullRecordingCanvas2D();
      renderTileCellToCompositeImpl.call(
        mockScene,
        rec2x2.ctx,
        {
          tx: 3,
          ty: 3,
          kind: 'pillar',
          variant: 0,
          distToWall: 0,
          autotileMask: 6,
          aoMask: 0,
          surface: 'none',
          surfaceMask: 0,
        },
        scale,
        2,
      );
      expect(rec2x2.ops.filter((o) => o.type === 'fillRect').length).toBe(0);

      // 2. 2x4 pillar top-left at (8, 3) with mask 6 -> NOT a 2x2 quad, MUST overpaint 8.5*scale corner and draw centered stone relief
      const rec2x4 = createFullRecordingCanvas2D();
      renderTileCellToCompositeImpl.call(
        mockScene,
        rec2x4.ctx,
        {
          tx: 8,
          ty: 3,
          kind: 'pillar',
          variant: 0,
          distToWall: 0,
          autotileMask: 6,
          aoMask: 0,
          surface: 'none',
          surfaceMask: 0,
        },
        scale,
        2,
      );
      expect(
        rec2x4.ops.some(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === ENV_PALETTE[2].wallTop.toUpperCase() &&
            o.args[2] === 8.5 * scale &&
            o.args[3] === 8.5 * scale,
        ),
      ).toBe(true);
      expect(
        rec2x4.ops.some(
          (o) =>
            o.type === 'stroke' &&
            o.strokeStyle?.toUpperCase() === ENV_PALETTE[2].seam.toUpperCase(),
        ),
      ).toBe(true);
    });
  });

  describe('Item 7: Seamless burning_oil & burning_grass Without 32x32 Radial Gradient Waffle Grid', () => {
    it('uses uniform base fills (#7C2D12 / #6E332B), 0 radial gradients, translucent (0.35) interior ember glow ellipses, and v-varied flames', () => {
      for (const [surface, expectedBase] of [
        ['burning_oil', '#7C2D12'],
        ['burning_grass', '#6E332B'],
      ] as const) {
        const rec0 = createFullRecordingCanvas2D();
        drawSurfaceTile(rec0.ctx, surface, 15, 0, 0, 32, 0, 1);

        // Zero radial/linear gradients (no 32x32 dark-edged waffle grid)
        expect(rec0.gradients.length).toBe(0);

        // Uniform base fill
        expect(
          rec0.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              o.fillStyle?.toUpperCase() === expectedBase &&
              o.args[2] === 32 &&
              o.args[3] === 32,
          ),
        ).toBe(true);

        // Translucent interior ember glow ellipses at alpha 0.35
        expect(
          rec0.ops.some(
            (o) => o.type === 'ellipse' && Math.abs((o.globalAlpha ?? 0) - 0.35) < 0.01,
          ),
        ).toBe(true);

        // Flame colors present
        const colors = new Set(
          rec0.ops.map((o) => (o.fillStyle ?? o.strokeStyle ?? '').toUpperCase()),
        );
        expect(colors.has('#DC2626')).toBe(true);
        expect(colors.has('#F97316')).toBe(true);
        expect(colors.has('#FACC15')).toBe(true);
        expect(colors.has('#F4F1EA')).toBe(true);
      }
    });
  });

  describe('Item 8: Seamless Lava/Ice/Water/ElectrifiedWater/Oil/Grass, Edge-Gated Fissures, Aligned Waves & Concave Corner Shorelines', () => {
    it('eliminates linear gradient banding on lava, ice, water, and electrified_water, gates Voronoi fissures on connected edges, and aligns shoreline waves', () => {
      // 1. traceOrganicPoolPath contract preserved
      const recPool0 = createFullRecordingCanvas2D();
      traceOrganicPoolPath(recPool0.ctx, 0, 2.6);
      expect(recPool0.ops.filter((o) => o.type === 'arcTo').length).toBe(4);
      const recPool15 = createFullRecordingCanvas2D();
      traceOrganicPoolPath(recPool15.ctx, 15, 2.6);
      expect(recPool15.ops.filter((o) => o.type === 'arcTo').length).toBe(0);

      // 2. Lava & Ice: 0 linear gradients, fissures gated on hasW/hasE/hasN/hasS
      for (const surface of ['lava', 'ice'] as const) {
        const recIsolated = createFullRecordingCanvas2D();
        drawSurfaceTile(recIsolated.ctx, surface, 0, 0, 0, 32, 2, 1);
        expect(recIsolated.gradients.length).toBe(0);
        // When surfaceMask === 0 (!hasW, !hasE, !hasN, !hasS), no moveTo(0, 16) or lineTo(32, 16)
        expect(
          recIsolated.ops.some(
            (o) => o.type === 'moveTo' && o.args[0] === 0 && o.args[1] === 16,
          ),
        ).toBe(false);
        expect(
          recIsolated.ops.some(
            (o) => o.type === 'lineTo' && o.args[0] === 32 && o.args[1] === 16,
          ),
        ).toBe(false);

        const recConnected = createFullRecordingCanvas2D();
        drawSurfaceTile(recConnected.ctx, surface, 15, 0, 0, 32, 2, 1);
        expect(recConnected.gradients.length).toBe(0);
        expect(
          recConnected.ops.some(
            (o) => o.type === 'moveTo' && o.args[0] === 0 && o.args[1] === 16,
          ),
        ).toBe(true);
        expect(
          recConnected.ops.some(
            (o) => o.type === 'lineTo' && o.args[0] === 32 && o.args[1] === 16,
          ),
        ).toBe(true);
      }

      // 3. Water & Electrified Water: 0 linear gradients, aligned quadraticCurveTo on exposed organic edges
      for (const surface of ['water', 'electrified_water'] as const) {
        const rec = createFullRecordingCanvas2D();
        drawSurfaceTile(rec.ctx, surface, AUTOTILE_SOUTH | AUTOTILE_EAST, 0, 0, 32, 1, 1);
        expect(rec.gradients.length).toBe(0);
        // Base fill + clip + 2 shoreline layers all use quadraticCurveTo on exposed N and W edges
        expect(
          rec.ops.filter((o) => o.type === 'quadraticCurveTo').length,
        ).toBeGreaterThanOrEqual(6);
      }
    });

    it('draws a 2.6*scale x 2.6*scale concave inner-corner shoreline cap in arena-tiles.ts when two adjacent cardinal bits are set and the diagonal neighbor is dry floor', () => {
      const map = new ArenaMap({ cols: 10, rows: 10, includePillars: false, seed: 3, biome: 1 });
      // L-shaped lava pool around (4, 4): (4,4), (4,5) S, and (5,4) E are lava, but (5,5) SE is 'none'
      map.setSurface(4, 4, 'lava', 0, true);
      map.setSurface(4, 5, 'lava', 0, true);
      map.setSurface(5, 4, 'lava', 0, true);
      map.setSurface(5, 5, 'none', 0, true);

      const scale = 2;
      const cellPx = TILE_SIZE * scale;
      const { ctx, ops } = createFullRecordingCanvas2D();
      const mockScene = {
        map,
        tileCompositeScale: scale,
        lastRenderedBiome: 1 as const,
        drawSourceKeyToCtx: () => {},
      } as unknown as GameScene;

      renderTileCellToCompositeImpl.call(
        mockScene,
        ctx,
        {
          tx: 4,
          ty: 4,
          kind: 'floor',
          variant: 0,
          distToWall: 3,
          autotileMask: 0,
          aoMask: 0,
          surface: 'lava',
          surfaceMask: AUTOTILE_SOUTH | AUTOTILE_EAST,
        },
        scale,
        1,
      );

      const dx = 4 * cellPx;
      const dy = 4 * cellPx;
      const cap = 2.6 * scale;

      expect(
        ops.some(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === '#1F1614' &&
            Math.abs(o.args[0]! - (dx + cellPx - cap)) < 0.01 &&
            Math.abs(o.args[1]! - (dy + cellPx - cap)) < 0.01 &&
            Math.abs(o.args[2]! - cap) < 0.01 &&
            Math.abs(o.args[3]! - cap) < 0.01,
        ),
      ).toBe(true);
    });
  });

  describe('Item 9: Chasm Top-Corner Strata Clipping, Vein Alpha 0.25 & Wall-to-Chasm Lip Suppression', () => {
    it('clips northern chasm horizontal rock courses to [1.8, 3.2, 4.6] insets on top-left/top-right corners, sets vein alpha to 0.25, and overpaints floor lips adjacent to solid walls', () => {
      const recTopLeft = createFullRecordingCanvas2D();
      // Top-left chasm corner: hasS | hasE (!hasN, !hasW)
      drawSurfaceTile(
        recTopLeft.ctx,
        'chasm',
        AUTOTILE_SOUTH | AUTOTILE_EAST,
        0,
        0,
        32,
        0,
        2,
      );

      // Horizontal northern courses at y=0, 4.5, 9.0 must start at x = 1.8, 3.2, 4.6 (not 0)
      expect(
        recTopLeft.ops.some(
          (o) =>
            o.type === 'fillRect' &&
            Math.abs(o.args[0]! - 1.8) < 0.01 &&
            o.args[1] === 0 &&
            Math.abs(o.args[2]! - 30.2) < 0.01 &&
            o.args[3] === 4.5,
        ),
      ).toBe(true);
      expect(
        recTopLeft.ops.some(
          (o) =>
            o.type === 'fillRect' &&
            Math.abs(o.args[0]! - 3.2) < 0.01 &&
            o.args[1] === 4.5 &&
            Math.abs(o.args[2]! - 28.8) < 0.01 &&
            o.args[3] === 4.5,
        ),
      ).toBe(true);
      expect(
        recTopLeft.ops.some(
          (o) =>
            o.type === 'fillRect' &&
            Math.abs(o.args[0]! - 4.6) < 0.01 &&
            o.args[1] === 9.0 &&
            Math.abs(o.args[2]! - 27.4) < 0.01 &&
            o.args[3] === 4.0,
        ),
      ).toBe(true);

      // Northern vein stroke uses globalAlpha === 0.25
      const veinStroke = recTopLeft.ops.find(
        (o) =>
          o.type === 'stroke' &&
          o.strokeStyle?.toUpperCase() === '#22D3EE' &&
          Math.abs((o.globalAlpha ?? 0) - 0.25) < 0.01,
      );
      expect(veinStroke).toBeDefined();

      // Verify wall-to-chasm floor lip suppression in arena-tiles.ts
      const map = new ArenaMap({ cols: 10, rows: 10, includePillars: false, seed: 5, biome: 2 });
      map.tiles[1 * 10 + 3] = 'wall'; // Solid wall North of (3, 2)
      map.setSurface(3, 2, 'chasm', 0, true);

      const scale = 2;
      const cellPx = TILE_SIZE * scale;
      const { ctx, ops } = createFullRecordingCanvas2D();
      renderTileCellToCompositeImpl.call(
        {
          map,
          tileCompositeScale: scale,
          lastRenderedBiome: 2 as const,
          drawSourceKeyToCtx: () => {},
        } as unknown as GameScene,
        ctx,
        {
          tx: 3,
          ty: 2,
          kind: 'floor',
          variant: 0,
          distToWall: 1,
          autotileMask: 0,
          aoMask: 0,
          surface: 'chasm',
          surfaceMask: AUTOTILE_SOUTH | AUTOTILE_EAST | AUTOTILE_WEST,
        },
        scale,
        2,
      );

      expect(
        ops.some(
          (o) =>
            o.type === 'fillRect' &&
            o.fillStyle?.toUpperCase() === '#243B47' &&
            o.args[0] === 3 * cellPx &&
            o.args[1] === 2 * cellPx &&
            o.args[2] === cellPx &&
            Math.abs(o.args[3]! - 2.2 * scale) < 0.01,
        ),
      ).toBe(true);
    });
  });

  describe('Item 10: Multi-Axis (N-S / E-W) Chasm Bridges Without Internal Rail Bars', () => {
    it('renders E-W and N-S bridge orientations with outer-only chasm guardrails and preserves >= 8 ops / >= 3 colors on middle bridge lanes', () => {
      // 1. Middle lane of E-W bridge (hasChasmN = false, hasChasmS = false)
      const recMidEW = createFullRecordingCanvas2D();
      drawBridgeOverChasmOverlay(recMidEW.ctx, 0, 0, 32, false, false, 1);
      expect(recMidEW.ops.length).toBeGreaterThanOrEqual(8);
      const midColors = new Set(
        recMidEW.ops
          .map((o) => o.fillStyle ?? o.strokeStyle)
          .filter((c): c is string => Boolean(c)),
      );
      expect(midColors.size).toBeGreaterThanOrEqual(3);
      // Must NOT draw full-width 32px internal rail bars at y = 2.5 or y = 27.3
      expect(
        recMidEW.ops.some(
          (o) => o.type === 'fillRect' && o.args[2] === 32 && o.args[3] === 2.2,
        ),
      ).toBe(false);

      // 2. Vertical N-S bridge West column (hasChasmW = true, hasChasmE = false, isVerticalBridge = true)
      const recWestNS = createFullRecordingCanvas2D();
      drawBridgeOverChasmOverlay(recWestNS.ctx, 0, 0, 32, false, false, 2, true, false, true);
      // Horizontal planks (moveTo(1, 6) -> lineTo(31, 6))
      expect(
        recWestNS.ops.some(
          (o) => o.type === 'moveTo' && o.args[0] === 1 && o.args[1] === 6,
        ),
      ).toBe(true);
      // West vertical guardrail (0, 0, 4.2, 32), no East guardrail
      expect(
        recWestNS.ops.some(
          (o) =>
            o.type === 'fillRect' &&
            o.args[0] === 0 &&
            o.args[1] === 0 &&
            Math.abs(o.args[2]! - 4.2) < 0.01 &&
            o.args[3] === 32,
        ),
      ).toBe(true);
      expect(
        recWestNS.ops.some(
          (o) => o.type === 'fillRect' && Math.abs(o.args[0]! - 27.8) < 0.01 && o.args[3] === 32,
        ),
      ).toBe(false);

      // 3. End-to-end 3-tile vertical N-S catwalk in arena-tiles.ts (cols x = 6, 7, 8 flanked by chasm at x = 5 and x = 9)
      const map = new ArenaMap({ cols: 14, rows: 14, includePillars: false, seed: 11, biome: 2 });
      for (let ty = 3; ty <= 9; ty++) {
        map.setSurface(5, ty, 'chasm', 0, true);
        map.setSurface(9, ty, 'chasm', 0, true);
        for (const bx of [6, 7, 8]) {
          map.tiles[ty * map.cols + bx] = 'floor';
          map.setSurface(bx, ty, 'none', 0, true);
        }
      }

      expect(hasChasmAlongAxisWithin3(map, 7, 6, -1, 0)).toBe(true);
      expect(hasChasmAlongAxisWithin3(map, 7, 6, 1, 0)).toBe(true);

      // Render middle column (7, 6) of the N-S catwalk -> vertical orientation (horizontal planks), 0 guardrails
      const recCatwalkMid = createFullRecordingCanvas2D();
      renderTileCellToCompositeImpl.call(
        {
          map,
          tileCompositeScale: 1,
          lastRenderedBiome: 2 as const,
          drawSourceKeyToCtx: () => {},
        } as unknown as GameScene,
        recCatwalkMid.ctx,
        {
          tx: 7,
          ty: 6,
          kind: 'floor',
          variant: 0,
          distToWall: 4,
          autotileMask: 0,
          aoMask: 0,
          surface: 'none',
          surfaceMask: 0,
        },
        1,
        2,
      );
      expect(
        recCatwalkMid.ops.some(
          (o) => o.type === 'moveTo' && o.args[0] === 1 && o.args[1] === 6,
        ),
      ).toBe(true);
      expect(recCatwalkMid.ops.some((o) => o.type === 'strokeRect')).toBe(false);
    });
  });
});
