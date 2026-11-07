import {
  ArenaMap,
  ROOM_SIZE_PRESET_DIMS,
  type RoomSizePreset,
  type SimPropState,
  TILE_SIZE,
  WorldSim,
} from '@ashen-pact/shared';
import Phaser from 'phaser';
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
  class MockWebGLRenderer {
    public pipelines = {
      has: vi.fn(() => true),
      addPostPipeline: vi.fn(),
    };
  }
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

import { hexToNum, PALETTE } from '../src/art/palette.js';
import { LightingPipeline } from '../src/fx/lighting-pipeline.js';

const LIGHTMAP_RES_SCALE = 0.25;
import type { GameScene, PropVisual } from '../src/scenes/GameScene.js';
import { syncPropsImpl } from '../src/scenes/game-scene/entity-sync.js';
import {
  resolveMinimapNodeDims,
  updateMinimapHudImpl,
} from '../src/scenes/game-scene/hud-qol-and-minimap.js';
import { graphicsSettings } from '../src/ui/graphics-settings.js';
import { UI_THEME } from '../src/ui/theme.js';
import {
  BiomeArchitectureLiveLayer,
  buildRoomArchitecturePlan,
  isActiveWallTile,
  isExteriorVoidWallTile,
  renderBiomeArchitectureToComposite,
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

interface RecordedGraphicsOp {
  op:
    | 'clear'
    | 'fillStyle'
    | 'lineStyle'
    | 'fillRect'
    | 'strokeRect'
    | 'fillCircle'
    | 'strokeCircle'
    | 'fillTriangle'
    | 'lineBetween'
    | 'beginPath'
    | 'moveTo'
    | 'lineTo'
    | 'closePath'
    | 'fillPath'
    | 'strokePath';
  args: number[];
}

interface MockGraphics {
  depth: number;
  blendMode: number;
  visible: boolean;
  ops: RecordedGraphicsOp[];
  clear: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  setBlendMode: ReturnType<typeof vi.fn>;
  setScrollFactor: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  fillStyle: ReturnType<typeof vi.fn>;
  lineStyle: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  strokeRect: ReturnType<typeof vi.fn>;
  fillCircle: ReturnType<typeof vi.fn>;
  strokeCircle: ReturnType<typeof vi.fn>;
  fillTriangle: ReturnType<typeof vi.fn>;
  lineBetween: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  closePath: ReturnType<typeof vi.fn>;
  fillPath: ReturnType<typeof vi.fn>;
  strokePath: ReturnType<typeof vi.fn>;
  fillPoints: ReturnType<typeof vi.fn>;
  strokePoints: ReturnType<typeof vi.fn>;
  fillRoundedRect: ReturnType<typeof vi.fn>;
  strokeRoundedRect: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function createMockGraphics(): MockGraphics {
  const g: MockGraphics = {
    depth: 0,
    blendMode: 0,
    visible: true,
    ops: [],
    clear: vi.fn(() => {
      g.ops.push({ op: 'clear', args: [] });
      return g;
    }),
    setDepth: vi.fn((d: number) => {
      g.depth = d;
      return g;
    }),
    setBlendMode: vi.fn((m: number) => {
      g.blendMode = m;
      return g;
    }),
    setScrollFactor: vi.fn(() => g),
    setVisible: vi.fn((v: boolean) => {
      g.visible = v;
      return g;
    }),
    fillStyle: vi.fn((color: number, alpha = 1) => {
      g.ops.push({ op: 'fillStyle', args: [color, alpha] });
      return g;
    }),
    lineStyle: vi.fn((width: number, color: number, alpha = 1) => {
      g.ops.push({ op: 'lineStyle', args: [width, color, alpha] });
      return g;
    }),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      g.ops.push({ op: 'fillRect', args: [x, y, w, h] });
      return g;
    }),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) => {
      g.ops.push({ op: 'strokeRect', args: [x, y, w, h] });
      return g;
    }),
    fillCircle: vi.fn((x: number, y: number, r: number) => {
      g.ops.push({ op: 'fillCircle', args: [x, y, r] });
      return g;
    }),
    strokeCircle: vi.fn((x: number, y: number, r: number) => {
      g.ops.push({ op: 'strokeCircle', args: [x, y, r] });
      return g;
    }),
    fillTriangle: vi.fn(
      (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
        g.ops.push({ op: 'fillTriangle', args: [x0, y0, x1, y1, x2, y2] });
        return g;
      },
    ),
    lineBetween: vi.fn((x0: number, y0: number, x1: number, y1: number) => {
      g.ops.push({ op: 'lineBetween', args: [x0, y0, x1, y1] });
      return g;
    }),
    beginPath: vi.fn(() => {
      g.ops.push({ op: 'beginPath', args: [] });
      return g;
    }),
    moveTo: vi.fn((x: number, y: number) => {
      g.ops.push({ op: 'moveTo', args: [x, y] });
      return g;
    }),
    lineTo: vi.fn((x: number, y: number) => {
      g.ops.push({ op: 'lineTo', args: [x, y] });
      return g;
    }),
    closePath: vi.fn(() => {
      g.ops.push({ op: 'closePath', args: [] });
      return g;
    }),
    fillPath: vi.fn(() => {
      g.ops.push({ op: 'fillPath', args: [] });
      return g;
    }),
    strokePath: vi.fn(() => {
      g.ops.push({ op: 'strokePath', args: [] });
      return g;
    }),
    fillPoints: vi.fn(() => g),
    strokePoints: vi.fn(() => g),
    fillRoundedRect: vi.fn((x: number, y: number, w: number, h: number) => {
      g.ops.push({ op: 'fillRect', args: [x, y, w, h] });
      return g;
    }),
    strokeRoundedRect: vi.fn((x: number, y: number, w: number, h: number) => {
      g.ops.push({ op: 'strokeRect', args: [x, y, w, h] });
      return g;
    }),
    arc: vi.fn(() => g),
    destroy: vi.fn(),
  };
  return g;
}

interface RecordedCanvas2DOp {
  op: 'rect' | 'fillRect' | 'strokeRect' | 'arc' | 'moveTo' | 'lineTo' | 'bezierCurveTo' | 'fill' | 'stroke' | 'clip';
  args: number[];
  tx: number;
  ty: number;
  fillStyle: string | object;
  strokeStyle: string | object;
}

function createRecordingCanvas2D(): {
  ctx: CanvasRenderingContext2D;
  ops: RecordedCanvas2DOp[];
} {
  const ops: RecordedCanvas2DOp[] = [];
  let curTx = 0;
  let curTy = 0;
  let curFillStyle: string | object = '#000000';
  let curStrokeStyle: string | object = '#000000';
  const stack: Array<{
    tx: number;
    ty: number;
    fillStyle: string | object;
    strokeStyle: string | object;
  }> = [];

  const ctx = {
    get fillStyle() {
      return curFillStyle;
    },
    set fillStyle(v: string | object) {
      curFillStyle = v;
    },
    get strokeStyle() {
      return curStrokeStyle;
    },
    set strokeStyle(v: string | object) {
      curStrokeStyle = v;
    },
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    save: vi.fn(() => {
      stack.push({
        tx: curTx,
        ty: curTy,
        fillStyle: curFillStyle,
        strokeStyle: curStrokeStyle,
      });
    }),
    restore: vi.fn(() => {
      const s = stack.pop();
      if (s) {
        curTx = s.tx;
        curTy = s.ty;
        curFillStyle = s.fillStyle;
        curStrokeStyle = s.strokeStyle;
      }
    }),
    scale: vi.fn(),
    translate: vi.fn((dx: number, dy: number) => {
      curTx += dx;
      curTy += dy;
    }),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(() => {
      ops.push({
        op: 'clip',
        args: [],
        tx: curTx,
        ty: curTy,
        fillStyle: curFillStyle,
        strokeStyle: curStrokeStyle,
      });
    }),
    rect: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push({
        op: 'rect',
        args: [x, y, w, h],
        tx: curTx,
        ty: curTy,
        fillStyle: curFillStyle,
        strokeStyle: curStrokeStyle,
      });
    }),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push({
        op: 'fillRect',
        args: [x, y, w, h],
        tx: curTx,
        ty: curTy,
        fillStyle: curFillStyle,
        strokeStyle: curStrokeStyle,
      });
    }),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push({
        op: 'strokeRect',
        args: [x, y, w, h],
        tx: curTx,
        ty: curTy,
        fillStyle: curFillStyle,
        strokeStyle: curStrokeStyle,
      });
    }),
    arc: vi.fn((x: number, y: number, r: number, start: number, end: number) => {
      ops.push({
        op: 'arc',
        args: [x, y, r, start, end],
        tx: curTx,
        ty: curTy,
        fillStyle: curFillStyle,
        strokeStyle: curStrokeStyle,
      });
    }),
    ellipse: vi.fn(),
    moveTo: vi.fn((x: number, y: number) => {
      ops.push({
        op: 'moveTo',
        args: [x, y],
        tx: curTx,
        ty: curTy,
        fillStyle: curFillStyle,
        strokeStyle: curStrokeStyle,
      });
    }),
    lineTo: vi.fn((x: number, y: number) => {
      ops.push({
        op: 'lineTo',
        args: [x, y],
        tx: curTx,
        ty: curTy,
        fillStyle: curFillStyle,
        strokeStyle: curStrokeStyle,
      });
    }),
    bezierCurveTo: vi.fn(
      (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) => {
        ops.push({
          op: 'bezierCurveTo',
          args: [cp1x, cp1y, cp2x, cp2y, x, y],
          tx: curTx,
          ty: curTy,
          fillStyle: curFillStyle,
          strokeStyle: curStrokeStyle,
        });
      },
    ),
    quadraticCurveTo: vi.fn(),
    fill: vi.fn(() => {
      ops.push({
        op: 'fill',
        args: [],
        tx: curTx,
        ty: curTy,
        fillStyle: curFillStyle,
        strokeStyle: curStrokeStyle,
      });
    }),
    stroke: vi.fn(() => {
      ops.push({
        op: 'stroke',
        args: [],
        tx: curTx,
        ty: curTy,
        fillStyle: curFillStyle,
        strokeStyle: curStrokeStyle,
      });
    }),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;

  return { ctx, ops };
}

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
  return map;
}

describe('Round 3 (F18) — WebGL Lightmap Resize, Exterior Void Masking, Dynamic Pillar Shadows, Grounded Braziers & Minimap Corridor Clipping', () => {
  describe('1. WebGL RenderTarget.resize Fix in LightingPipeline', () => {
    it('enables webglRt.setAutoResize(true) before lightmapRt.resize(rtW, rtH) and resets it to false in update() and syncPostFxPipeline()', () => {
      graphicsSettings.setQuality('high');
      const autoResizeHistory: boolean[] = [];
      const webglRenderTarget = {
        autoResize: false,
        width: 480,
        height: 270,
        setAutoResize: vi.fn((val: boolean) => {
          webglRenderTarget.autoResize = val;
          autoResizeHistory.push(val);
        }),
      };

      const mockLightmapRt = {
        width: 480,
        height: 270,
        originX: 0,
        originY: 0,
        scaleX: 2,
        scaleY: 2,
        texture: {
          renderTarget: webglRenderTarget,
        },
        setOrigin: vi.fn((ox: number, oy: number) => {
          mockLightmapRt.originX = ox;
          mockLightmapRt.originY = oy;
          return mockLightmapRt;
        }),
        setScale: vi.fn((s: number) => {
          mockLightmapRt.scaleX = s;
          mockLightmapRt.scaleY = s;
          return mockLightmapRt;
        }),
        setDepth: vi.fn(() => mockLightmapRt),
        setBlendMode: vi.fn(() => mockLightmapRt),
        setVisible: vi.fn(() => mockLightmapRt),
        setPosition: vi.fn(() => mockLightmapRt),
        resize: vi.fn((w: number, h: number) => {
          mockLightmapRt.width = w;
          mockLightmapRt.height = h;
          // Simulate Phaser 3.90 RenderTarget.resize(w, h) which only resizes the WebGL FBO if autoResize is true
          if (webglRenderTarget.autoResize) {
            webglRenderTarget.width = w;
            webglRenderTarget.height = h;
          }
          return mockLightmapRt;
        }),
        clear: vi.fn(),
        fill: vi.fn(),
        beginDraw: vi.fn(),
        batchDraw: vi.fn(),
        endDraw: vi.fn(),
        destroy: vi.fn(),
      };

      const makeMockImage = () => ({
        visible: true,
        setOrigin: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setBlendMode: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setTint: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setTexture: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      });

      const mockScene = {
        game: {
          renderer: new (Phaser.Renderer.WebGL.WebGLRenderer as unknown as new () => object)(),
        },
        textures: {
          exists: vi.fn(() => true),
        },
        make: {
          image: vi.fn(() => makeMockImage()),
        },
        add: {
          renderTexture: vi.fn(() => mockLightmapRt),
          image: vi.fn(() => makeMockImage()),
          graphics: vi.fn(() => createMockGraphics()),
        },
        cameras: {
          main: {
            width: 1920,
            height: 1080,
            zoom: 1.38,
            zoomX: 1.38,
            zoomY: 1.38,
            scrollX: 120,
            scrollY: 80,
            worldView: { x: 120, y: 80, width: 1920 / 1.38, height: 1080 / 1.38 },
            setPostPipeline: vi.fn(),
            removePostPipeline: vi.fn(),
            getPostPipeline: vi.fn(() => []),
          },
        },
      } as unknown as Phaser.Scene;

      const pipeline = new LightingPipeline(mockScene, 1);
      const sim = new WorldSim({ seed: 1337, biome: 1 });

      pipeline.update({
        dtSec: 0.016,
        playerPos: { x: sim.player.x, y: sim.player.y },
        player: sim.player,
        simulatedPlayers: [],
        enemies: [],
        projectiles: [],
        props: sim.props,
        map: sim.map,
        trauma: 0,
        inHub: false,
      });

      const expectedCoverW = Math.ceil(1920 / 1.38 + 128);
      const expectedCoverH = Math.ceil(1080 / 1.38 + 128);
      const highLightmapScale = LIGHTMAP_RES_SCALE * graphicsSettings.getBudget().lightmapScale;
      const expectedRtW = Math.round(expectedCoverW * highLightmapScale);
      const expectedRtH = Math.round(expectedCoverH * highLightmapScale);

      expect(autoResizeHistory).toEqual([true, false]);
      expect(webglRenderTarget.autoResize).toBe(false);
      expect(webglRenderTarget.width).toBe(expectedRtW);
      expect(webglRenderTarget.height).toBe(expectedRtH);
      expect(mockLightmapRt.setOrigin).toHaveBeenCalledWith(0, 0);
      expect(mockLightmapRt.scaleX).toBeCloseTo(1 / highLightmapScale, 5);

      // Verify syncPostFxPipeline also enables autoResize when quality / lightmapScale changes
      autoResizeHistory.length = 0;
      graphicsSettings.setQuality('medium');
      pipeline.syncPostFxPipeline();
      expect(autoResizeHistory).toEqual([true, false]);
      expect(webglRenderTarget.autoResize).toBe(false);
      expect(webglRenderTarget.width).toBe(
        Math.round(expectedCoverW * LIGHTMAP_RES_SCALE * graphicsSettings.getBudget().lightmapScale),
      );
      graphicsSettings.setQuality('high');
    });
  });

  describe('2. Exterior Void Light, God-Ray & Dust Mote Masking + Soft Brazier Core', () => {
    it('anchors Biome 2 God-Rays strictly to active North perimeter wall tiles with non-solid south floor across all 10 room shapes', () => {
      for (const shape of ALL_10_SHAPES) {
        const map = createConfiguredShapeMap(shape, 'standard', 2, 1337);
        const plan = buildRoomArchitecturePlan(map, 'combat', 2, 1337);
        expect(plan.godRays.length).toBeGreaterThanOrEqual(2);

        for (const ray of plan.godRays) {
          const wallTx = Math.floor(ray.anchorX / TILE_SIZE);
          const floorTy = Math.round(ray.anchorY / TILE_SIZE);
          const wallTy = floorTy - 1;
          expect(wallTy).toBeGreaterThanOrEqual(0);
          expect(floorTy).toBeLessThan(map.rows);
          expect(map.getTile(wallTx, wallTy)).toBe('wall');
          expect(isExteriorVoidWallTile(map, wallTx, wallTy)).toBe(false);
          expect(map.isSolidTile(wallTx, floorTy)).toBe(false);
        }
      }
    });

    it('creates voidMaskGraphics at depth 36.2 after additiveGraphics, masks Exterior Void cells with 6px active-wall inset, skips dust motes in solid/void cells, and draws soft 0.025/0.04 brazier flame core', () => {
      graphicsSettings.setQuality('high');
      const graphicsList: MockGraphics[] = [];
      const mockScene = {
        textures: {
          exists: vi.fn(() => true),
        },
        add: {
          graphics: vi.fn(() => {
            const g = createMockGraphics();
            graphicsList.push(g);
            return g;
          }),
          image: vi.fn(() => ({
            visible: false,
            setOrigin: vi.fn().mockReturnThis(),
            setRotation: vi.fn().mockReturnThis(),
            setBlendMode: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            setPosition: vi.fn().mockReturnThis(),
            setDisplaySize: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
        },
      } as unknown as Phaser.Scene;

      const liveLayer = new BiomeArchitectureLiveLayer(mockScene);
      expect(graphicsList.length).toBe(4);
      // T3-CF-15 invariant: graphicsList[0] must remain gearGraphics (depth 14)
      expect(graphicsList[0]!.depth).toBe(14);
      expect(graphicsList[1]!.depth).toBe(31);
      expect(graphicsList[2]!.depth).toBe(35.5);
      expect(graphicsList[2]!.blendMode).toBe(1);
      // voidMaskGraphics is graphicsList[3] at depth 36.2 with NORMAL blendMode
      const voidMaskGraphics = graphicsList[3]!;
      expect(voidMaskGraphics.depth).toBeCloseTo(36.2, 5);
      expect(voidMaskGraphics.blendMode).toBe(0);

      const map = createConfiguredShapeMap('cruciform', 'standard', 1, 1337);
      const plan = buildRoomArchitecturePlan(map, 'combat', 1, 1337);
      liveLayer.setPlan(plan);

      // Place a torch_brazier near a corner cutout so some orbiting dust mote angles fall into solid/Exterior Void tiles
      const brazierProp: SimPropState = {
        id: 1,
        kind: 'torch_brazier',
        x: 9 * TILE_SIZE + 16,
        y: 5 * TILE_SIZE + 16,
        hp: 100,
        maxHp: 100,
        radius: 14,
        blocksProjectiles: false,
         blocksMovement: true,
      };

      liveLayer.update({
        dtSec: 0.016,
        map,
        props: [brazierProp],
        lightingEnabled: true,
      });

      // Verify voidMaskGraphics filled Exterior Void cells with PALETTE.INK_DEEP (0x0b090e) and 6px inset along active walls
      const voidFillStyles = voidMaskGraphics.ops.filter((o) => o.op === 'fillStyle');
      expect(voidFillStyles.length).toBeGreaterThan(0);
      expect(voidFillStyles[0]!.args[0]).toBe(hexToNum(PALETTE.INK_DEEP));

      const voidRects = voidMaskGraphics.ops.filter((o) => o.op === 'fillRect');
      expect(voidRects.length).toBeGreaterThan(0);
      // Find an Exterior Void tile that borders an active wall tile on the South or East and verify 6px inset
      for (let ty = 0; ty < map.rows; ty++) {
        for (let tx = 0; tx < map.cols; tx++) {
          if (!isExteriorVoidWallTile(map, tx, ty)) continue;
          const adjS = ty + 1 < map.rows && isActiveWallTile(map, tx, ty + 1);
          const adjE = tx + 1 < map.cols && isActiveWallTile(map, tx + 1, ty);
          if (adjS || adjE) {
            const ox = tx * TILE_SIZE;
            const oy = ty * TILE_SIZE;
            const matchingRect = voidRects.find(
              (r) =>
                r.args[0]! >= ox &&
                r.args[0]! < ox + TILE_SIZE &&
                r.args[1]! >= oy &&
                r.args[1]! < oy + TILE_SIZE,
            );
            expect(matchingRect).toBeDefined();
            if (adjE) {
              expect(matchingRect!.args[0]! + matchingRect!.args[2]!).toBeLessThanOrEqual(
                ox + TILE_SIZE - 6,
              );
            }
            if (adjS) {
              expect(matchingRect!.args[1]! + matchingRect!.args[3]!).toBeLessThanOrEqual(
                oy + TILE_SIZE - 6,
              );
            }
          }
        }
      }

      // Verify soft brazier flame core alphas (0.025 and 0.04) and dust mote filtering on additiveGraphics
      const additiveGraphics = graphicsList[2]!;
      const hasCore025 = additiveGraphics.ops.some(
        (o, idx) =>
          o.op === 'fillStyle' &&
          Math.abs(o.args[1]! - 0.025) < 1e-6 &&
          additiveGraphics.ops[idx + 1]?.op === 'fillCircle' &&
          Math.abs(additiveGraphics.ops[idx + 1]!.args[2]! - 5.5) < 1e-6,
      );
      const hasCore04 = additiveGraphics.ops.some(
        (o, idx) =>
          o.op === 'fillStyle' &&
          Math.abs(o.args[1]! - 0.04) < 1e-6 &&
          additiveGraphics.ops[idx + 1]?.op === 'fillCircle' &&
          Math.abs(additiveGraphics.ops[idx + 1]!.args[2]! - 3.0) < 1e-6,
      );
      expect(hasCore025).toBe(true);
      expect(hasCore04).toBe(true);

      // Every drawn dust mote (r in [1.1, 1.35]) must lie strictly on a non-solid, non-Exterior-Void tile
      for (const op of additiveGraphics.ops) {
        if (op.op === 'fillCircle') {
          const [mx, my, mr] = op.args;
          if (mr! >= 1.05 && mr! <= 1.4 && Math.hypot(mx! - brazierProp.x, my! - brazierProp.y) >= 20) {
            const mtx = Math.floor(mx! / TILE_SIZE);
            const mty = Math.floor(my! / TILE_SIZE);
            expect(map.isSolidTile(mtx, mty)).toBe(false);
            expect(isExteriorVoidWallTile(map, mtx, mty)).toBe(false);
          }
        }
      }

      // Verify destroy() cleans up voidMaskGraphics (T2-F7-05 invariant)
      liveLayer.destroy();
      for (const g of graphicsList) {
        expect(g.destroy).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('3. Dynamic Contiguous pillarShadows, Dry-Floor Clipping & True 2x2 Pillar Decors', () => {
    it('computes contiguous widthTiles and heightTiles for 2x1, 2x4, and 2x2 pillars without duplicate shadows and clips shadows to dry floor', () => {
      const map = new ArenaMap({ cols: 36, rows: 22, includePillars: false, seed: 901, biome: 2 });
      // Clear interior to floor
      for (let ty = 1; ty < map.rows - 1; ty++) {
        for (let tx = 1; tx < map.cols - 1; tx++) {
          map.tiles[ty * map.cols + tx] = 'floor';
          map.surfaces[ty * map.cols + tx] = 'none';
        }
      }
      // 1) A 2x1 horizontal pillar at (6, 5)..(7, 5)
      map.tiles[5 * map.cols + 6] = 'pillar';
      map.tiles[5 * map.cols + 7] = 'pillar';
      // 2) A 2x4 vertical prism pillar at (14, 5)..(15, 8)
      for (let dy = 0; dy < 4; dy++) {
        map.tiles[(5 + dy) * map.cols + 14] = 'pillar';
        map.tiles[(5 + dy) * map.cols + 15] = 'pillar';
      }
      // 3) A true 2x2 pillar at (22, 5)..(23, 6) (outside protected sample rects)
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          map.tiles[(5 + dy) * map.cols + (22 + dx)] = 'pillar';
        }
      }
      // Place ice surface south-east of the 2x4 pillar at (16, 8) and (16, 9)
      map.setSurface(16, 8, 'ice', 0, true);
      map.setSurface(16, 9, 'lava', 0, true);
      map.rebuildSolidBoxes();

      const plan = buildRoomArchitecturePlan(map, 'combat', 3, 901);
      expect(plan.pillarShadows.length).toBe(3);

      const p2x1 = plan.pillarShadows.find((p) => p.pillarTx === 6 && p.pillarTy === 5)!;
      const p2x4 = plan.pillarShadows.find((p) => p.pillarTx === 14 && p.pillarTy === 5)!;
      const p2x2 = plan.pillarShadows.find((p) => p.pillarTx === 22 && p.pillarTy === 5)!;
      expect(p2x1).toMatchObject({ widthTiles: 2, heightTiles: 1 });
      expect(p2x4).toMatchObject({ widthTiles: 2, heightTiles: 4 });
      expect(p2x2).toMatchObject({ widthTiles: 2, heightTiles: 2 });

      // Only the true 2x2 pillar at (22, 5) should receive fluted_column and forge_anvil
      const colDecor = plan.solidDecors.find((d) => d.kind === 'fluted_column')!;
      const anvilDecor = plan.solidDecors.find((d) => d.kind === 'forge_anvil')!;
      expect(colDecor).toBeDefined();
      expect(colDecor.tx).toBe(22);
      expect(colDecor.ty).toBe(5);
      expect(anvilDecor).toBeDefined();
      expect(anvilDecor.tx).toBe(23);
      expect(anvilDecor.ty).toBe(5);

      // Render to composite and verify dry-floor shadow clipping + 2x2 Top-Cap centering
      const { ctx, ops } = createRecordingCanvas2D();
      renderBiomeArchitectureToComposite(ctx, map, plan, TILE_SIZE);

      const clipRects = ops.filter((o) => o.op === 'rect');
      // Neither the ice tile (16, 8) nor the lava tile (16, 9) may appear in any shadow clip rect
      expect(
        clipRects.some(
          (r) => r.args[0] === 16 * TILE_SIZE && (r.args[1] === 8 * TILE_SIZE || r.args[1] === 9 * TILE_SIZE),
        ),
      ).toBe(false);
      // Dry floor tile (15, 9) at row 9 (pillarTy + heightTiles = 5 + 4 = 9) MUST be included for the 2x4 pillar
      expect(
        clipRects.some((r) => r.args[0] === 15 * TILE_SIZE && r.args[1] === 9 * TILE_SIZE),
      ).toBe(true);

      // Verify fluted_column is translated by (+16, +6) from (22 * 32, 5 * 32)
      const colArc = ops.find(
        (o) =>
          o.op === 'arc' &&
          o.args[0] === 16 &&
          o.args[1] === 14 &&
          o.tx === 22 * TILE_SIZE + 16 &&
          o.ty === 5 * TILE_SIZE + 6,
      );
      expect(colArc).toBeDefined();

      // Verify forge_anvil is translated by (-16, +6) from (23 * 32, 5 * 32)
      const anvilBase = ops.find(
        (o) =>
          o.op === 'fillRect' &&
          o.args[0] === 9 &&
          o.args[1] === 16 &&
          o.tx === 23 * TILE_SIZE - 16 &&
          o.ty === 5 * TILE_SIZE + 6,
      );
      expect(anvilBase).toBeDefined();
    });

    it('excludes CRUMBLING_PILLAR_RING from pillar top-cap decors to prevent triple-stacking with rotten_totem_pillar', () => {
      const map = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome: 1 });
      map.configureRoomLayout('combat', 1337, false, 1);
      map.roomArchetype = 'CRUMBLING_PILLAR_RING';
      const plan = buildRoomArchitecturePlan(map, 'combat', 1, 1337);
      expect(plan.solidDecors.some((d) => d.kind === 'fluted_column')).toBe(false);
      expect(plan.solidDecors.some((d) => d.kind === 'forge_anvil')).toBe(false);
    });
  });

  describe('4. Grounded Floor Braziers, Wall-Only Hanging Rods, Direction-Aware Wall Decors & Unobstructed Astrolabe', () => {
    it('enables shadow.setVisible(true) for floor torch_brazier props in syncPropsImpl', () => {
      const propVisuals = new Map<number, PropVisual>();
      const activePropIds = new Set<number>();
      const createdSprites: Array<{
        x: number;
        y: number;
        tex: string;
        visible: boolean;
        setVisible: ReturnType<typeof vi.fn>;
      }> = [];

      const props: SimPropState[] = [
        {
          id: 10,
          kind: 'torch_brazier',
          x: 242,
          y: 148,
          hp: 100,
          maxHp: 100,
          radius: 14,
          blocksProjectiles: false,
          blocksMovement: true,
        },
      ];

      const mockScene = {
        propVisuals,
        activePropIds,
        transport: {
          getSim: () => ({ props }),
        },
        textures: {
          exists: vi.fn(() => true),
        },
        add: {
          sprite: vi.fn((x: number, y: number, tex: string) => {
            const s = {
              x,
              y,
              tex,
              visible: false,
              scaleX: 1,
              scaleY: 1,
              angle: 0,
              depth: 0,
              texture: { key: tex },
              setPosition: vi.fn((nx: number, ny: number) => {
                s.x = nx;
                s.y = ny;
                return s;
              }),
              setScale: vi.fn((sx: number, sy?: number) => {
                s.scaleX = sx;
                s.scaleY = sy ?? sx;
                return s;
              }),
              setDepth: vi.fn((d: number) => {
                s.depth = d;
                return s;
              }),
              setVisible: vi.fn((v: boolean) => {
                s.visible = v;
                return s;
              }),
              setTexture: vi.fn((k: string) => {
                s.texture.key = k;
                return s;
              }),
              setAngle: vi.fn((a: number) => {
                s.angle = a;
                return s;
              }),
              setTintFill: vi.fn(),
              clearTint: vi.fn(),
              destroy: vi.fn(),
            };
            createdSprites.push(s);
            return s;
          }),
        },
      } as unknown as GameScene;

      syncPropsImpl.call(mockScene, 0.016);
      const pv = propVisuals.get(10)!;
      expect(pv).toBeDefined();
      expect(pv.shadow.setVisible).toHaveBeenCalledWith(true);
      expect((pv.shadow as unknown as { visible: boolean }).visible).toBe(true);
    });

    it('draws 45-deg hanging iron rods in bracketGraphics ONLY when torch_brazier has a solid wall/pillar directly North', () => {
      graphicsSettings.setQuality('high');
      const graphicsList: MockGraphics[] = [];
      const mockScene = {
        textures: { exists: vi.fn(() => true) },
        add: {
          graphics: vi.fn(() => {
            const g = createMockGraphics();
            graphicsList.push(g);
            return g;
          }),
          image: vi.fn(() => ({
            visible: false,
            setOrigin: vi.fn().mockReturnThis(),
            setRotation: vi.fn().mockReturnThis(),
            setBlendMode: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            setPosition: vi.fn().mockReturnThis(),
            setDisplaySize: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          })),
        },
      } as unknown as Phaser.Scene;

      const liveLayer = new BiomeArchitectureLiveLayer(mockScene);
      const map = new ArenaMap({ cols: 36, rows: 22, includePillars: false, seed: 42, biome: 1 });
      const plan = buildRoomArchitecturePlan(map, 'combat', 1, 42);
      liveLayer.setPlan(plan);

      const bracketGraphics = graphicsList[1]!;
      // Free-standing floor brazier at tile (8, 5) where (8, 4) is walkable floor -> 0 bracket lines
      const floorBrazier: SimPropState = {
        id: 1,
        kind: 'torch_brazier',
        x: 8 * TILE_SIZE + 16,
        y: 5 * TILE_SIZE + 16,
        hp: 100,
        maxHp: 100,
        radius: 14,
        blocksProjectiles: false,
        blocksMovement: true,
      };
      liveLayer.update({ dtSec: 0.016, map, props: [floorBrazier], lightingEnabled: true });
      expect(bracketGraphics.ops.filter((o) => o.op === 'lineBetween').length).toBe(0);

      // Wall-hung brazier at tile (8, 1) where (8, 0) is solid North wall -> 3 bracket lines
      const wallBrazier: SimPropState = {
        ...floorBrazier,
        id: 2,
        x: 8 * TILE_SIZE + 16,
        y: 1 * TILE_SIZE + 16,
      };
      liveLayer.update({ dtSec: 0.016, map, props: [wallBrazier], lightingEnabled: true });
      expect(bracketGraphics.ops.filter((o) => o.op === 'lineBetween').length).toBe(3);
    });

    it('orients W/E wrought_iron_fence and brazier_pedestal vertically, keeps steam_pipe_wall/root_base in y=2..19 Top Cap, and skips obstructed sunken_astrolabe', () => {
      const map = createConfiguredShapeMap('u_shape', 'standard', 3, 1337);
      const planB3 = buildRoomArchitecturePlan(map, 'combat', 3, 1337);

      // Verify stepped brass_gear_wall items on u_shape are spaced apart (not 3 adjacent tiles)
      const gears = planB3.solidDecors.filter((d) => d.kind === 'brass_gear_wall');
      for (let i = 0; i < gears.length; i++) {
        for (let j = i + 1; j < gears.length; j++) {
          const dist = Math.abs(gears[i]!.tx - gears[j]!.tx) + Math.abs(gears[i]!.ty - gears[j]!.ty);
          expect(dist).toBeGreaterThanOrEqual(3);
        }
      }

      // Verify steam_pipe_wall stays within Top Cap (y = 3..19)
      const { ctx: ctxB3, ops: opsB3 } = createRecordingCanvas2D();
      renderBiomeArchitectureToComposite(ctxB3, map, planB3, TILE_SIZE);
      const pipeItem = planB3.solidDecors.find((d) => d.kind === 'steam_pipe_wall')!;
      expect(pipeItem).toBeDefined();
      const pipeRects = opsB3.filter(
        (o) =>
          o.op === 'fillRect' &&
          o.tx === pipeItem.tx * TILE_SIZE &&
          o.ty === pipeItem.ty * TILE_SIZE,
      );
      expect(pipeRects.length).toBeGreaterThanOrEqual(3);
      for (const r of pipeRects) {
        expect(r.args[1]! + r.args[3]!).toBeLessThanOrEqual(19);
      }

      // Verify Hub (biome 0) W/E wrought_iron_fence uses vertical 5x24 rail
      const planHub = buildRoomArchitecturePlan(map, 'combat', 0, 1337);
      const westFence = planHub.solidDecors.find(
        (d) => d.kind === 'wrought_iron_fence' && (d.dir === 'W' || d.dir === 'E'),
      )!;
      expect(westFence).toBeDefined();
      const { ctx: ctxHub, ops: opsHub } = createRecordingCanvas2D();
      renderBiomeArchitectureToComposite(ctxHub, map, planHub, TILE_SIZE);
      const verticalFenceRail = opsHub.find(
        (o) =>
          o.op === 'fillRect' &&
          o.tx === westFence.tx * TILE_SIZE &&
          o.ty === westFence.ty * TILE_SIZE &&
          o.args[2] === 5 &&
          o.args[3] === 24,
      );
      expect(verticalFenceRail).toBeDefined();

      // Verify sunken_astrolabe is skipped when central floor is split by a central chasm (TWIN_BRIDGES)
      const chasmMap = new ArenaMap({ cols: 36, rows: 22, includePillars: false, seed: 55, biome: 2 });
      for (let ty = 1; ty < chasmMap.rows - 1; ty++) {
        chasmMap.setSurface(17, ty, 'chasm', 0, true);
        chasmMap.setSurface(18, ty, 'chasm', 0, true);
      }
      const planChasmB2 = buildRoomArchitecturePlan(chasmMap, 'combat', 2, 55);
      expect(planChasmB2.floorDecals.some((d) => d.kind === 'sunken_astrolabe')).toBe(true);
      const { ctx: ctxChasm, ops: opsChasm } = createRecordingCanvas2D();
      renderBiomeArchitectureToComposite(ctxChasm, chasmMap, planChasmB2, TILE_SIZE);
      const astrolabeArcsChasm = opsChasm.filter(
        (o) => o.op === 'arc' && o.tx === 0 && o.ty === 0 && o.args[2]! > 30,
      );
      expect(astrolabeArcsChasm.length).toBe(0);

      // Verify sunken_astrolabe IS drawn when central floor is open and dry
      const openMap = new ArenaMap({ cols: 36, rows: 22, includePillars: false, seed: 55, biome: 2 });
      const planOpenB2 = buildRoomArchitecturePlan(openMap, 'combat', 2, 55);
      const { ctx: ctxOpen, ops: opsOpen } = createRecordingCanvas2D();
      renderBiomeArchitectureToComposite(ctxOpen, openMap, planOpenB2, TILE_SIZE);
      const astrolabeArcsOpen = opsOpen.filter(
        (o) => o.op === 'arc' && o.tx === 0 && o.ty === 0 && o.args[2]! > 30,
      );
      expect(astrolabeArcsOpen.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('5. Minimap Corridor Edge Clipping & Compact Player Dot Sizing / donut_ring Clamping', () => {
    it('clips horizontal and vertical corridor fillRect segments to outer room node borders and scales/clamps compact player dot on donut_ring', () => {
      const sim = new WorldSim({ seed: 1337, biome: 1 });
      sim.enterRoom(sim.dungeon.startRoomId);
      const currentRoom = sim.getCurrentRoom()!;
      currentRoom.roomShape = 'donut_ring';
      currentRoom.roomSizePreset = 'standard';
      currentRoom.cols = 36;
      currentRoom.rows = 22;
      (sim.map as { roomShape?: string }).roomShape = 'donut_ring';

      // Place player near the inner monolith edge so raw dotX would land inside the donut hole
      sim.player.x = sim.map.width * 0.5 - 64;
      sim.player.y = sim.map.height * 0.5;

      const g = createMockGraphics();
      const mockScene = {
        fullMapOpen: false,
        minimapGraphics: g,
        minimapTitleText: {
          setText: vi.fn(),
          setColor: vi.fn(),
          setOrigin: vi.fn(),
          setPosition: vi.fn(),
          setVisible: vi.fn(),
        },
        transport: {
          getSim: () => sim,
        },
      } as unknown as GameScene;

      updateMinimapHudImpl.call(mockScene);

      // Compute expected layout coordinates in compact mode
      const rooms = sim.dungeon.rooms;
      let minGx = Infinity;
      let maxGx = -Infinity;
      let minGy = Infinity;
      let maxGy = -Infinity;
      for (const r of rooms) {
        if (r.gx < minGx) minGx = r.gx;
        if (r.gx > maxGx) maxGx = r.gx;
        if (r.gy < minGy) minGy = r.gy;
        if (r.gy > maxGy) maxGy = r.gy;
      }
      const spanX = Math.max(1, maxGx - minGx + 1);
      const spanY = Math.max(1, maxGy - minGy + 1);
      const panelW = 172;
      const panelH = 102;
      const panelX = 960 - panelW - 14;
      const panelY = 14;
      const cellStep = Math.min(
        24,
        Math.floor((panelW - 24) / spanX),
        Math.floor((panelH - 22) / spanY),
      );
      const originX = panelX + (panelW - (spanX - 1) * cellStep) * 0.5;
      const originY = panelY + (panelH - (spanY - 1) * cellStep) * 0.5;

      const cx = originX + (currentRoom.gx - minGx) * cellStep;
      const cy = originY + (currentRoom.gy - minGy) * cellStep;
      const { nodeW, nodeH } = resolveMinimapNodeDims(cellStep, 'standard', 36, 22);

      // 1) Verify corridor fillRects never cover room center (cx, cy)
      const corridorRects: number[][] = [];
      for (let i = 1; i < g.ops.length; i++) {
        const prev = g.ops[i - 1]!;
        const cur = g.ops[i]!;
        if (
          prev.op === 'fillStyle' &&
          prev.args[0] === UI_THEME.panelBorderHighlight &&
          Math.abs(prev.args[1]! - 0.82) < 1e-4 &&
          cur.op === 'fillRect'
        ) {
          corridorRects.push(cur.args);
        }
      }
      expect(corridorRects.length).toBeGreaterThan(0);
      for (const [rx, ry, rw, rh] of corridorRects) {
        const containsCenter =
          cx > rx! + 0.1 && cx < rx! + rw! - 0.1 && cy > ry! + 0.1 && cy < ry! + rh! - 0.1;
        expect(containsCenter).toBe(false);
      }

      // 2) Verify compact player dot uses dotR = 1.4 (outline 2.1) when Math.min(nodeW, nodeH) <= 12
      // and is clamped outside the donut_ring inner hole
      let goldDot: number[] | undefined;
      let outlineDot: number[] | undefined;
      for (let i = 1; i < g.ops.length; i++) {
        const prev = g.ops[i - 1]!;
        const cur = g.ops[i]!;
        if (prev.op === 'fillStyle' && cur.op === 'fillCircle') {
          if (prev.args[0] === UI_THEME.status.goldBright) {
            goldDot = cur.args;
          } else if (prev.args[0] === UI_THEME.inkDeep) {
            outlineDot = cur.args;
          }
        }
      }
      expect(goldDot).toBeDefined();
      expect(outlineDot).toBeDefined();
      if (Math.min(nodeW, nodeH) <= 12) {
        expect(goldDot![2]).toBeCloseTo(1.4, 5);
        expect(outlineDot![2]).toBeCloseTo(2.1, 5);
      }
      const holeHalfW = Math.max(3, nodeW * 0.38) * 0.5;
      expect(Math.abs(goldDot![0]! - cx)).toBeGreaterThanOrEqual(holeHalfW);
    });
  });
});
