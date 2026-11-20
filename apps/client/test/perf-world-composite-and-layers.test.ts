import { ArenaMap, type SimPropState, TILE_SIZE, WorldSim } from '@ashen-pact/shared';
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

import { PALETTE } from '../src/art/palette.js';
import type { ArenaTileVisual, GameScene } from '../src/scenes/GameScene.js';
import { syncArenaTilesWithMapRevisionImpl } from '../src/scenes/game-scene/arena-tiles.js';
import { SanctuaryVisualLayer } from '../src/scenes/game-scene/sanctuary-architecture.js';
import { graphicsSettings } from '../src/ui/graphics-settings.js';
import {
  buildRoomArchitecturePlan,
  computeTileDistToWall,
  getVisibleFloorDecals,
  isActiveWallTile,
  isExteriorVoidWallTile,
  resolveHybridFloorVariant,
} from '../src/world/biome-architecture.js';
import {
  BiomeArchitectureLiveLayer,
  mergeExteriorVoidRowSpans,
  renderBiomeArchitectureToComposite,
} from '../src/world/biome-architecture-render.js';

function carveShapeWallsIfNeeded(map: ArenaMap, shape: 'l_shape' | 'donut_ring' | 'cruciform'): void {
  const midX = Math.floor(map.cols / 2);
  const midY = Math.floor(map.rows / 2);
  const isDoorVestibule = (tx: number, ty: number): boolean => {
    if (Math.abs(tx - midX) <= 1 && (ty <= 3 || ty >= map.rows - 4)) return true;
    if (Math.abs(ty - midY) <= 1 && (tx <= 3 || tx >= map.cols - 4)) return true;
    return false;
  };
  const setWall = (tx: number, ty: number): void => {
    if (tx <= 0 || ty <= 0 || tx >= map.cols - 1 || ty >= map.rows - 1) return;
    if (isDoorVestibule(tx, ty)) return;
    const idx = ty * map.cols + tx;
    map.tiles[idx] = 'wall';
    map.surfaces[idx] = 'none';
    map.baseSurfaces[idx] = 'none';
  };

  let voidCount = 0;
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      if (isExteriorVoidWallTile(map, tx, ty)) voidCount += 1;
    }
  }
  if (voidCount > 0) return;

  if (shape === 'l_shape') {
    for (let ty = 1; ty <= midY - 3; ty++) {
      for (let tx = midX + 5; tx < map.cols - 1; tx++) {
        setWall(tx, ty);
      }
    }
  } else if (shape === 'donut_ring') {
    for (let ty = midY - 2; ty <= midY + 2; ty++) {
      for (let tx = midX - 4; tx <= midX + 3; tx++) {
        setWall(tx, ty);
      }
    }
  } else {
    const cw = Math.max(6, Math.floor(map.cols * 0.22));
    const ch = Math.max(4, Math.floor(map.rows * 0.22));
    for (let ty = 1; ty < map.rows - 1; ty++) {
      for (let tx = 1; tx < map.cols - 1; tx++) {
        if ((tx <= cw || tx >= map.cols - 1 - cw) && (ty <= ch || ty >= map.rows - 1 - ch)) {
          setWall(tx, ty);
        }
      }
    }
  }
  map.rebuildSolidBoxes();
}

function createSculptedMap(shape: 'l_shape' | 'donut_ring' | 'cruciform'): ArenaMap {
  const map = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome: 1 });
  map.configureRoomLayout('combat', 1337, false, 1, {
    roomShape: shape as unknown as ArenaMap['roomShape'],
    roomSizePreset: 'standard',
    cols: 36,
    rows: 22,
  });
  (map as { roomShape: string }).roomShape = shape;
  carveShapeWallsIfNeeded(map, shape);
  return map;
}

/**
 * Reference per-pixel occupancy oracle: a pixel (px, py) inside an Exterior Void tile
 * is masked iff no active wall tile is within 6px horizontally AND 6px vertically
 * (i.e. preserving the exact 6px cardinal & 6x6 diagonal casing margin around active walls).
 */
function buildReferenceVoidPixelOccupancy(map: ArenaMap): {
  grid: Uint8Array;
  perTileRectCount: number;
} {
  const grid = new Uint8Array(map.width * map.height);
  let perTileRectCount = 0;

  const paintRect = (rx: number, ry: number, rw: number, rh: number): void => {
    for (let y = ry; y < ry + rh; y++) {
      const rowOff = y * map.width;
      for (let x = rx; x < rx + rw; x++) {
        grid[rowOff + x] = 1;
      }
    }
  };

  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      if (!isExteriorVoidWallTile(map, tx, ty)) continue;
      const ox = tx * TILE_SIZE;
      const oy = ty * TILE_SIZE;
      const adjN = ty > 0 && isActiveWallTile(map, tx, ty - 1);
      const adjS = ty + 1 < map.rows && isActiveWallTile(map, tx, ty + 1);
      const adjW = tx > 0 && isActiveWallTile(map, tx - 1, ty);
      const adjE = tx + 1 < map.cols && isActiveWallTile(map, tx + 1, ty);
      const diagNW = !adjN && !adjW && tx > 0 && ty > 0 && isActiveWallTile(map, tx - 1, ty - 1);
      const diagNE =
        !adjN && !adjE && tx + 1 < map.cols && ty > 0 && isActiveWallTile(map, tx + 1, ty - 1);
      const diagSW =
        !adjS && !adjW && tx > 0 && ty + 1 < map.rows && isActiveWallTile(map, tx - 1, ty + 1);
      const diagSE =
        !adjS &&
        !adjE &&
        tx + 1 < map.cols &&
        ty + 1 < map.rows &&
        isActiveWallTile(map, tx + 1, ty + 1);

      const inW = adjW ? 6 : 0;
      const inE = adjE ? 6 : 0;
      const inN = adjN || diagNW || diagNE ? 6 : 0;
      const inS = adjS || diagSW || diagSE ? 6 : 0;
      paintRect(ox + inW, oy + inN, TILE_SIZE - inW - inE, TILE_SIZE - inN - inS);
      perTileRectCount += 1;

      if (!adjN && (diagNW || diagNE)) {
        const tx0 = ox + (adjW || diagNW ? 6 : 0);
        const tx1 = ox + TILE_SIZE - (adjE || diagNE ? 6 : 0);
        if (tx1 > tx0) {
          paintRect(tx0, oy, tx1 - tx0, 6);
          perTileRectCount += 1;
        }
      }
      if (!adjS && (diagSW || diagSE)) {
        const bx0 = ox + (adjW || diagSW ? 6 : 0);
        const bx1 = ox + TILE_SIZE - (adjE || diagSE ? 6 : 0);
        if (bx1 > bx0) {
          paintRect(bx0, oy + TILE_SIZE - 6, bx1 - bx0, 6);
          perTileRectCount += 1;
        }
      }
    }
  }

  return { grid, perTileRectCount };
}

interface RecordedGraphicsCall {
  op: string;
  args: number[];
}

function createSpyGraphics(withGenerateTexture?: (key: string, w: number, h: number) => void) {
  const ops: RecordedGraphicsCall[] = [];
  const commandBuffer: number[] = [];
  const g = {
    x: 0,
    y: 0,
    depth: 0,
    blendMode: 0,
    visible: true,
    destroyed: false,
    ops,
    commandBuffer,
    clear: vi.fn(() => {
      ops.push({ op: 'clear', args: [] });
      commandBuffer.length = 0;
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
    setVisible: vi.fn((v: boolean) => {
      g.visible = v;
      return g;
    }),
    fillStyle: vi.fn((color: number, alpha = 1) => {
      ops.push({ op: 'fillStyle', args: [color, alpha] });
      commandBuffer.push(1, color, alpha);
      return g;
    }),
    lineStyle: vi.fn((width: number, color: number, alpha = 1) => {
      ops.push({ op: 'lineStyle', args: [width, color, alpha] });
      commandBuffer.push(2, width, color, alpha);
      return g;
    }),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push({ op: 'fillRect', args: [x, y, w, h] });
      commandBuffer.push(3, x, y, w, h);
      return g;
    }),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push({ op: 'strokeRect', args: [x, y, w, h] });
      commandBuffer.push(4, x, y, w, h);
      return g;
    }),
    fillRoundedRect: vi.fn((x: number, y: number, w: number, h: number, r = 0) => {
      ops.push({ op: 'fillRoundedRect', args: [x, y, w, h, r] });
      commandBuffer.push(5, x, y, w, h, r);
      return g;
    }),
    strokeRoundedRect: vi.fn((x: number, y: number, w: number, h: number, r = 0) => {
      ops.push({ op: 'strokeRoundedRect', args: [x, y, w, h, r] });
      commandBuffer.push(6, x, y, w, h, r);
      return g;
    }),
    fillCircle: vi.fn((x: number, y: number, r: number) => {
      ops.push({ op: 'fillCircle', args: [x, y, r] });
      commandBuffer.push(7, x, y, r);
      return g;
    }),
    strokeCircle: vi.fn((x: number, y: number, r: number) => {
      ops.push({ op: 'strokeCircle', args: [x, y, r] });
      commandBuffer.push(8, x, y, r);
      return g;
    }),
    fillEllipse: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push({ op: 'fillEllipse', args: [x, y, w, h] });
      commandBuffer.push(9, x, y, w, h);
      return g;
    }),
    strokeEllipse: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push({ op: 'strokeEllipse', args: [x, y, w, h] });
      commandBuffer.push(10, x, y, w, h);
      return g;
    }),
    fillTriangle: vi.fn(
      (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
        ops.push({ op: 'fillTriangle', args: [x0, y0, x1, y1, x2, y2] });
        commandBuffer.push(11, x0, y0, x1, y1, x2, y2);
        return g;
      },
    ),
    strokeTriangle: vi.fn(
      (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
        ops.push({ op: 'strokeTriangle', args: [x0, y0, x1, y1, x2, y2] });
        commandBuffer.push(12, x0, y0, x1, y1, x2, y2);
        return g;
      },
    ),
    lineBetween: vi.fn((x0: number, y0: number, x1: number, y1: number) => {
      ops.push({ op: 'lineBetween', args: [x0, y0, x1, y1] });
      commandBuffer.push(13, x0, y0, x1, y1);
      return g;
    }),
    beginPath: vi.fn(() => {
      ops.push({ op: 'beginPath', args: [] });
      commandBuffer.push(14);
      return g;
    }),
    moveTo: vi.fn((x: number, y: number) => {
      ops.push({ op: 'moveTo', args: [x, y] });
      commandBuffer.push(15, x, y);
      return g;
    }),
    lineTo: vi.fn((x: number, y: number) => {
      ops.push({ op: 'lineTo', args: [x, y] });
      commandBuffer.push(16, x, y);
      return g;
    }),
    arc: vi.fn((x: number, y: number, r: number, s: number, e: number) => {
      ops.push({ op: 'arc', args: [x, y, r, s, e] });
      commandBuffer.push(17, x, y, r, s, e);
      return g;
    }),
    closePath: vi.fn(() => {
      ops.push({ op: 'closePath', args: [] });
      commandBuffer.push(18);
      return g;
    }),
    fillPath: vi.fn(() => {
      ops.push({ op: 'fillPath', args: [] });
      commandBuffer.push(19);
      return g;
    }),
    strokePath: vi.fn(() => {
      ops.push({ op: 'strokePath', args: [] });
      commandBuffer.push(20);
      return g;
    }),
    destroy: vi.fn(() => {
      g.destroyed = true;
      commandBuffer.length = 0;
    }),
    ...(withGenerateTexture
      ? {
          generateTexture: vi.fn((key: string, w: number, h: number) => {
            withGenerateTexture(key, w, h);
            return g;
          }),
        }
      : {}),
  };
  return g;
}

describe('Task 2 — Static Layer Rasterization, Earcut-Free Motes, Decal Cache & Dirty-Box texSubImage2D', () => {
  it('1. mergeExteriorVoidRowSpans coalesces row spans by >= 65% with 100% pixel-identical coverage and BiomeArchitectureLiveLayer bakes voidMask onto a static CanvasTexture', () => {
    for (const shape of ['l_shape', 'donut_ring', 'cruciform'] as const) {
      const map = createSculptedMap(shape);
      let voidTileCount = 0;
      for (let ty = 0; ty < map.rows; ty++) {
        for (let tx = 0; tx < map.cols; tx++) {
          if (isExteriorVoidWallTile(map, tx, ty)) voidTileCount += 1;
        }
      }
      expect(voidTileCount).toBeGreaterThan(0);

      const { grid: expectedGrid, perTileRectCount } = buildReferenceVoidPixelOccupancy(map);
      const mergedSpans = mergeExteriorVoidRowSpans(map);

      // Must reduce rectangle count by at least 65% vs per-tile emission
      expect(mergedSpans.length).toBeLessThanOrEqual(Math.floor(voidTileCount * 0.35));
      expect(mergedSpans.length).toBeLessThanOrEqual(Math.floor(perTileRectCount * 0.35));

      // Verify exact 1:1 non-overlapping pixel occupancy across map.width x map.height
      const actualGrid = new Uint8Array(map.width * map.height);
      let overlapPixels = 0;
      for (const span of mergedSpans) {
        expect(span.width).toBeGreaterThan(0);
        expect(span.height).toBeGreaterThan(0);
        expect(span.x).toBeGreaterThanOrEqual(0);
        expect(span.y).toBeGreaterThanOrEqual(0);
        expect(span.x + span.width).toBeLessThanOrEqual(map.width);
        expect(span.y + span.height).toBeLessThanOrEqual(map.height);
        for (let y = span.y; y < span.y + span.height; y++) {
          const rowOff = y * map.width;
          for (let x = span.x; x < span.x + span.width; x++) {
            if (actualGrid[rowOff + x] !== 0) overlapPixels += 1;
            actualGrid[rowOff + x] = 1;
          }
        }
      }
      expect(overlapPixels).toBe(0);

      let mismatchPixels = 0;
      for (let i = 0; i < expectedGrid.length; i++) {
        if (actualGrid[i] !== expectedGrid[i]) mismatchPixels += 1;
      }
      expect(mismatchPixels).toBe(0);
    }

    // Verify BiomeArchitectureLiveLayer rasterizes merged spans onto '__biome_void_mask_tex__' + Image at depth 36.2
    const lMap = createSculptedMap('l_shape');
    const plan = buildRoomArchitecturePlan(lMap, 'combat', 1, 1337);
    const createdGraphics: ReturnType<typeof createSpyGraphics>[] = [];
    const createdImages: Array<{
      x: number;
      y: number;
      key: string;
      originX: number;
      originY: number;
      depth: number;
      visible: boolean;
      destroyed: boolean;
    }> = [];
    const canvasFillRects: Array<[number, number, number, number]> = [];
    const registeredTextures = new Set<string>();
    let fillStyleDrawn = '';

    const mockScene = {
      textures: {
        exists: vi.fn((k: string) => registeredTextures.has(k)),
        remove: vi.fn((k: string) => {
          registeredTextures.delete(k);
        }),
        createCanvas: vi.fn((k: string, w: number, h: number) => {
          registeredTextures.add(k);
          const ctx = {
            fillStyle: '#000000',
            clearRect: vi.fn(),
            fillRect: vi.fn((x: number, y: number, rw: number, rh: number) => {
              fillStyleDrawn = String(ctx.fillStyle);
              canvasFillRects.push([x, y, rw, rh]);
            }),
          };
          return {
            key: k,
            width: w,
            height: h,
            getContext: () => ctx,
            refresh: vi.fn(),
          };
        }),
      },
      add: {
        graphics: vi.fn(() => {
          const g = createSpyGraphics();
          createdGraphics.push(g);
          return g;
        }),
        image: vi.fn((x: number, y: number, key: string) => {
          const img = {
            x,
            y,
            key,
            originX: 0.5,
            originY: 0.5,
            depth: 0,
            visible: true,
            destroyed: false,
            setOrigin: vi.fn((ox: number, oy = ox) => {
              img.originX = ox;
              img.originY = oy;
              return img;
            }),
            setPosition: vi.fn((nx: number, ny: number) => {
              img.x = nx;
              img.y = ny;
              return img;
            }),
            setDepth: vi.fn((d: number) => {
              img.depth = d;
              return img;
            }),
            setVisible: vi.fn((v: boolean) => {
              img.visible = v;
              return img;
            }),
            setTexture: vi.fn((nk: string) => {
              img.key = nk;
              return img;
            }),
            destroy: vi.fn(() => {
              img.destroyed = true;
            }),
          };
          createdImages.push(img);
          return img;
        }),
      },
    } as unknown as Phaser.Scene;

    const liveLayer = new BiomeArchitectureLiveLayer(mockScene);
    liveLayer.setPlan(plan);
    liveLayer.update({ dtSec: 0.016, map: lMap, props: [], lightingEnabled: true });

    const voidMaskGraphics = createdGraphics[3]!;
    expect(voidMaskGraphics.visible).toBe(false);
    expect(voidMaskGraphics.commandBuffer.length).toBe(0);

    expect(registeredTextures.has('__biome_void_mask_tex__')).toBe(true);
    expect(fillStyleDrawn.toUpperCase()).toBe(PALETTE.INK_DEEP.toUpperCase());
    expect(canvasFillRects.length).toBe(mergeExteriorVoidRowSpans(lMap).length);

    const voidMaskImg = createdImages.find((img) => img.key === '__biome_void_mask_tex__');
    expect(voidMaskImg).toBeDefined();
    expect(voidMaskImg!.originX).toBe(0);
    expect(voidMaskImg!.originY).toBe(0);
    expect(voidMaskImg!.x).toBe(0);
    expect(voidMaskImg!.y).toBe(0);
    expect(voidMaskImg!.depth).toBeCloseTo(36.2, 5);
    expect(voidMaskImg!.visible).toBe(true);

    liveLayer.destroy();
    expect(voidMaskImg!.destroyed).toBe(true);
    expect(registeredTextures.has('__biome_void_mask_tex__')).toBe(false);
  });

  it('2. BiomeArchitectureLiveLayer.update emits 0 tiny fillCircle calls for embers, motes, and hazard glints/bubbles while emitting Earcut-free additive primitives', () => {
    graphicsSettings.setQuality('high');
    const createdGraphics: ReturnType<typeof createSpyGraphics>[] = [];
    const mockScene = {
      textures: { exists: vi.fn(() => true) },
      add: {
        graphics: vi.fn(() => {
          const g = createSpyGraphics();
          createdGraphics.push(g);
          return g;
        }),
      },
    } as unknown as Phaser.Scene;

    const map = new ArenaMap({ cols: 36, rows: 22, includePillars: false, seed: 2026, biome: 1 });
    for (let tx = 10; tx <= 13; tx++) {
      map.setSurface(tx, 10, 'burning_oil', 5.0, false);
      map.setSurface(tx, 11, 'electrified_water', 5.0, false);
      map.setSurface(tx, 12, 'poison_swamp', 0, true);
      map.setSurface(tx, 13, 'lava', 0, true);
    }

    const plan = buildRoomArchitecturePlan(map, 'combat', 1, 2026);
    const liveLayer = new BiomeArchitectureLiveLayer(mockScene);
    liveLayer.setPlan(plan);

    const braziers: SimPropState[] = [
      {
        id: 1,
        kind: 'torch_brazier',
        x: 6 * TILE_SIZE + 16,
        y: 5 * TILE_SIZE + 16,
        hp: 100,
        maxHp: 100,
        radius: 14,
        blocksProjectiles: false,
        blocksMovement: true,
      },
      {
        id: 2,
        kind: 'torch_brazier',
        x: 29 * TILE_SIZE + 16,
        y: 5 * TILE_SIZE + 16,
        hp: 100,
        maxHp: 100,
        radius: 14,
        blocksProjectiles: false,
        blocksMovement: true,
      },
      {
        id: 3,
        kind: 'torch_brazier',
        x: 6 * TILE_SIZE + 16,
        y: 16 * TILE_SIZE + 16,
        hp: 100,
        maxHp: 100,
        radius: 14,
        blocksProjectiles: false,
        blocksMovement: true,
      },
      {
        id: 4,
        kind: 'torch_brazier',
        x: 29 * TILE_SIZE + 16,
        y: 16 * TILE_SIZE + 16,
        hp: 100,
        maxHp: 100,
        radius: 14,
        blocksProjectiles: false,
        blocksMovement: true,
      },
    ];

    liveLayer.update({
      dtSec: 0.016,
      map,
      props: braziers,
      lightingEnabled: true,
    });

    const gearGraphics = createdGraphics[0]!;
    const additiveGraphics = createdGraphics[2]!;

    // 0 tiny fillCircle calls (r < 3.0px: embers 1.1..1.65, motes 1.1..1.35, hazard glints 2.2..2.6, bubbles 1.4..2.5)
    const tinyAdditiveCircles = additiveGraphics.ops.filter(
      (o) => o.op === 'fillCircle' && o.args[2]! < 3.0,
    );
    const tinyGearCircles = gearGraphics.ops.filter(
      (o) => o.op === 'fillCircle' && o.args[2]! < 3.0,
    );
    expect(tinyAdditiveCircles).toHaveLength(0);
    expect(tinyGearCircles).toHaveLength(0);

    // Must emit Earcut-free fillRect / fillTriangle geometry on additiveGraphics and keep it visible
    const earcutFreeAdditivePrims = additiveGraphics.ops.filter(
      (o) => o.op === 'fillRect' || o.op === 'fillTriangle',
    );
    expect(earcutFreeAdditivePrims.length).toBeGreaterThanOrEqual(40);
    expect(additiveGraphics.visible).toBe(true);

    // When lightingEnabled is false and no braziers emit additive light, additiveGraphics hides cleanly
    liveLayer.update({
      dtSec: 0.016,
      map,
      props: braziers,
      lightingEnabled: false,
    });
    expect(additiveGraphics.commandBuffer.length).toBe(0);
    expect(additiveGraphics.visible).toBe(false);
  });

  it('3. getVisibleFloorDecals caches the filtered array per (plan, mapRevision) and invalidates immediately on map.setSurface', () => {
    const map = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome: 3 });
    map.configureRoomLayout('combat', 1337, false, 3);
    const plan = buildRoomArchitecturePlan(map, 'combat', 3, 1337);
    expect(plan.floorDecals.length).toBeGreaterThan(0);

    const first = getVisibleFloorDecals(plan, map);
    const second = getVisibleFloorDecals(plan, map);
    expect(first.length).toBeGreaterThan(0);
    // Exact reference equality: zero .filter() allocation on unchanged mapRevision
    expect(second).toBe(first);

    const targetDecal = first[0]!;
    const prevRev = map.mapRevision;
    map.setSurface(targetDecal.tx, targetDecal.ty, 'burning_oil', 5.0, false);
    expect(map.mapRevision).toBeGreaterThan(prevRev);

    const third = getVisibleFloorDecals(plan, map);
    expect(third).not.toBe(first);
    expect(third.length).toBe(first.length - 1);
    expect(third.includes(targetDecal)).toBe(false);

    const fourth = getVisibleFloorDecals(plan, map);
    expect(fourth).toBe(third);
  });

  it('4. SanctuaryVisualLayer bakes static floor into an Image at depth 6, clears & hides floorGraphics, and falls back gracefully when generateTexture is absent', () => {
    // Subcase A: Real Phaser runtime with floorGraphics.generateTexture + scene.add.image
    const bakedTextures = new Map<string, { width: number; height: number; bakedCommands: number }>();
    const createdGraphicsA: ReturnType<typeof createSpyGraphics>[] = [];
    const createdImagesA: Array<{
      x: number;
      y: number;
      key: string;
      originX: number;
      originY: number;
      depth: number;
      visible: boolean;
      destroyed: boolean;
      setDepth: ReturnType<typeof vi.fn>;
    }> = [];

    const mockSceneBaked = {
      textures: {
        exists: vi.fn((k: string) => bakedTextures.has(k)),
        remove: vi.fn((k: string) => {
          bakedTextures.delete(k);
        }),
      },
      add: {
        graphics: vi.fn(() => {
          const g = createSpyGraphics((key, w, h) => {
            bakedTextures.set(key, {
              width: w,
              height: h,
              bakedCommands: g.commandBuffer.length,
            });
          });
          createdGraphicsA.push(g);
          return g;
        }),
        image: vi.fn((x: number, y: number, key: string) => {
          const img = {
            x,
            y,
            key,
            originX: 0.5,
            originY: 0.5,
            depth: 0,
            visible: true,
            destroyed: false,
            setOrigin: vi.fn((ox: number, oy = ox) => {
              img.originX = ox;
              img.originY = oy;
              return img;
            }),
            setPosition: vi.fn((nx: number, ny: number) => {
              img.x = nx;
              img.y = ny;
              return img;
            }),
            setDepth: vi.fn((d: number) => {
              img.depth = d;
              return img;
            }),
            setVisible: vi.fn((v: boolean) => {
              img.visible = v;
              return img;
            }),
            setTexture: vi.fn((nk: string) => {
              img.key = nk;
              return img;
            }),
            destroy: vi.fn(() => {
              img.destroyed = true;
            }),
          };
          createdImagesA.push(img);
          return img;
        }),
      },
    } as unknown as Phaser.Scene;

    const sim = new WorldSim({
      seed: 'sanctuary-bake-test',
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    sim.enterHub();

    const bakedLayer = new SanctuaryVisualLayer(mockSceneBaked);
    const [floorGA, dynamicGA] = createdGraphicsA as [
      ReturnType<typeof createSpyGraphics>,
      ReturnType<typeof createSpyGraphics>,
    ];

    bakedLayer.sync(sim, 0.016, 1.0);

    const bakedMeta = bakedTextures.get('__sanctuary_static_floor__');
    expect(bakedMeta).toBeDefined();
    expect(bakedMeta!.width).toBe(sim.map.width);
    expect(bakedMeta!.height).toBe(sim.map.height);
    expect(bakedMeta!.bakedCommands).toBeGreaterThan(100);

    // floorGraphics MUST be cleared & hidden after baking so 0 static Graphics commands run per frame
    expect(floorGA.visible).toBe(false);
    expect(floorGA.commandBuffer.length).toBe(0);
    expect(dynamicGA.visible).toBe(true);

    expect(createdImagesA).toHaveLength(1);
    const staticImg = createdImagesA[0]!;
    expect(staticImg.key).toBe('__sanctuary_static_floor__');
    expect(staticImg.originX).toBe(0);
    expect(staticImg.originY).toBe(0);
    expect(staticImg.x).toBe(0);
    expect(staticImg.y).toBe(0);
    expect(staticImg.depth).toBe(6);
    expect(staticImg.visible).toBe(true);

    // Subsequent Hub frame does not re-bake or re-call setDepth
    staticImg.setDepth.mockClear();
    bakedLayer.sync(sim, 0.016, 1.05);
    expect(
      (floorGA as unknown as { generateTexture: ReturnType<typeof vi.fn> }).generateTexture,
    ).toHaveBeenCalledTimes(1);
    expect(staticImg.setDepth).not.toHaveBeenCalled();
    expect(floorGA.visible).toBe(false);

    // Leaving Hub hides staticFloorImage
    sim.startDungeonRunFromHub();
    bakedLayer.sync(sim, 0.016, 1.1);
    expect(staticImg.visible).toBe(false);
    expect(dynamicGA.visible).toBe(false);

    // destroy() cleans up staticFloorImage and texture
    bakedLayer.destroy();
    expect(staticImg.destroyed).toBe(true);
    expect(bakedTextures.has('__sanctuary_static_floor__')).toBe(false);

    // Subcase B: Minimal test mock without generateTexture or make.renderTexture -> graceful fallback
    const createdGraphicsB: ReturnType<typeof createSpyGraphics>[] = [];
    const minimalScene = {
      add: {
        graphics: vi.fn(() => {
          const g = createSpyGraphics();
          createdGraphicsB.push(g);
          return g;
        }),
      },
    } as unknown as Phaser.Scene;

    sim.enterHub();
    const fallbackLayer = new SanctuaryVisualLayer(minimalScene);
    fallbackLayer.sync(sim, 0.016, 1.0);
    expect(createdGraphicsB[0]!.visible).toBe(true);
    expect(createdGraphicsB[0]!.commandBuffer.length).toBeGreaterThan(100);
  });

  it('5. syncArenaTilesWithMapRevisionImpl re-renders only expanded dirty tile box, clips renderGroundPass, and uploads via gl.texSubImage2D with refresh() fallback', () => {
    const sim = new WorldSim({ seed: 1337, biome: 1, spawnInitialWave: false });
    sim.enterRoom(sim.dungeon.startRoomId);
    const map = sim.map;
    const scale = 2;
    const expectedW = map.width * scale;
    const expectedH = map.height * scale;

    const mapTileVisuals: ArenaTileVisual[] = [];
    for (let ty = 0; ty < map.rows; ty++) {
      for (let tx = 0; tx < map.cols; tx++) {
        const distToWall = computeTileDistToWall(map, tx, ty);
        mapTileVisuals.push({
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

    // Verify renderBiomeArchitectureToComposite clips to clipRectWorld and skips out-of-bounds items
    const plan = buildRoomArchitecturePlan(map, 'combat', 2, 1337);
    const clipOps: Array<{ op: string; args: number[] }> = [];
    const spyCtx = {
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      globalAlpha: 1,
      save: vi.fn(() => clipOps.push({ op: 'save', args: [] })),
      restore: vi.fn(() => clipOps.push({ op: 'restore', args: [] })),
      scale: vi.fn((sx: number, sy: number) => clipOps.push({ op: 'scale', args: [sx, sy] })),
      translate: vi.fn((dx: number, dy: number) => clipOps.push({ op: 'translate', args: [dx, dy] })),
      rotate: vi.fn(),
      beginPath: vi.fn(() => clipOps.push({ op: 'beginPath', args: [] })),
      closePath: vi.fn(),
      rect: vi.fn((x: number, y: number, w: number, h: number) =>
        clipOps.push({ op: 'rect', args: [x, y, w, h] }),
      ),
      clip: vi.fn(() => clipOps.push({ op: 'clip', args: [] })),
      fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
        clipOps.push({ op: 'fillRect', args: [x, y, w, h] }),
      ),
      strokeRect: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    } as unknown as CanvasRenderingContext2D;

    renderBiomeArchitectureToComposite(spyCtx, map, plan, TILE_SIZE * scale, {
      x: 9 * TILE_SIZE,
      y: 9 * TILE_SIZE,
      width: 3 * TILE_SIZE,
      height: 3 * TILE_SIZE,
    });
    expect(clipOps[0]).toEqual({ op: 'save', args: [] });
    expect(clipOps[1]).toEqual({ op: 'beginPath', args: [] });
    expect(clipOps[2]).toEqual({
      op: 'rect',
      args: [9 * TILE_SIZE * scale, 9 * TILE_SIZE * scale, 3 * TILE_SIZE * scale, 3 * TILE_SIZE * scale],
    });
    expect(clipOps[3]).toEqual({ op: 'clip', args: [] });
    // Perimeter solidDecors at tx=0 / ty=0 must have been culled (zero translate(0, *) calls)
    expect(clipOps.some((o) => o.op === 'translate' && (o.args[0] === 0 || o.args[1] === 0))).toBe(
      false,
    );

    // Now test syncArenaTilesWithMapRevisionImpl with WebGL handles + mock patch canvas document
    const prevDoc = globalThis.document;
    const patchDrawCalls: number[][] = [];
    globalThis.document = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') {
          const c = {
            width: 0,
            height: 0,
            getContext: () => ({
              clearRect: vi.fn(),
              drawImage: vi.fn(
                (
                  _src: unknown,
                  sx: number,
                  sy: number,
                  sw: number,
                  sh: number,
                  dx: number,
                  dy: number,
                  dw: number,
                  dh: number,
                ) => {
                  patchDrawCalls.push([sx, sy, sw, sh, dx, dy, dw, dh]);
                },
              ),
            }),
          };
          return c;
        }
        return {};
      }),
    } as unknown as Document;

    try {
      const mockWebGLTex = { id: 'arena-webgl-tex' };
      const mockGl = {
        TEXTURE_2D: 0x0de1,
        TEXTURE_BINDING_2D: 0x8069,
        RGBA: 0x1908,
        UNSIGNED_BYTE: 0x1401,
        UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
        UNPACK_FLIP_Y_WEBGL: 0x9240,
        isContextLost: vi.fn(() => false),
        getParameter: vi.fn(() => null),
        bindTexture: vi.fn(),
        pixelStorei: vi.fn(),
        texSubImage2D: vi.fn(),
        texImage2D: vi.fn(),
      };

      const groundCanvas = { width: expectedW, height: expectedH };
      const groundCtx = {} as CanvasRenderingContext2D;
      const mockArenaGroundTex = {
        width: expectedW,
        height: expectedH,
        canvas: groundCanvas,
        getCanvas: () => groundCanvas,
        getContext: () => groundCtx,
        source: [
          {
            glTexture: {
              gl: mockGl,
              webGLTexture: mockWebGLTex,
              pma: true,
              flipY: false,
            } as unknown,
          },
        ],
        refresh: vi.fn(),
      };

      const renderedTiles: Array<[number, number]> = [];
      const renderGroundPassSpy = vi.fn();
      const effectiveBiome: 0 | 1 | 2 | 3 = sim.inHub ? 0 : sim.currentBiome;

      const mockGameScene = {
        transport: { getSim: () => sim },
        tileCompositeScale: scale,
        mapTileVisuals,
        arenaGroundTex: mockArenaGroundTex,
        lastRenderedBiome: effectiveBiome,
        lastConveyorDirection: map.conveyorDirection,
        lastMapRevision:
          effectiveBiome * 10000000 +
          sim.currentFloor * 1000000 +
          sim.currentRoomId * 10000 +
          map.mapRevision,
        renderTileCellToComposite: vi.fn((tile: ArenaTileVisual) => {
          renderedTiles.push([tile.tx, tile.ty]);
        }),
        rebuildAllTileCellsToComposite: vi.fn(),
        biomeArchLive: {
          renderGroundPass: renderGroundPassSpy,
        },
      } as unknown as GameScene;

      // Change 1 interior tile at (10, 10) -> dirty box expanded by 1 tile = [9..11] x [9..11] (9 tiles)
      map.setSurface(10, 10, 'burning_oil', 5.0, false);
      syncArenaTilesWithMapRevisionImpl.call(mockGameScene);

      expect(mockGameScene.rebuildAllTileCellsToComposite).not.toHaveBeenCalled();
      // Must re-render all 9 tiles in [9..11] x [9..11], NOT all 792 tiles
      expect(renderedTiles).toHaveLength(9);
      for (let ty = 9; ty <= 11; ty++) {
        for (let tx = 9; tx <= 11; tx++) {
          expect(renderedTiles).toContainEqual([tx, ty]);
        }
      }

      // renderGroundPass must receive tight clipRectWorld [288, 288, 96, 96]
      expect(renderGroundPassSpy).toHaveBeenCalledTimes(1);
      expect(renderGroundPassSpy).toHaveBeenCalledWith(groundCtx, map, scale, {
        x: 9 * TILE_SIZE,
        y: 9 * TILE_SIZE,
        width: 3 * TILE_SIZE,
        height: 3 * TILE_SIZE,
      });

      // WebGL sub-rect upload via gl.texSubImage2D (NOT full-canvas refresh/texImage2D)
      const px = 9 * TILE_SIZE * scale;
      const py = 9 * TILE_SIZE * scale;
      const pw = 3 * TILE_SIZE * scale;
      const ph = 3 * TILE_SIZE * scale;
      expect(patchDrawCalls).toEqual([[px, py, pw, ph, 0, 0, pw, ph]]);
      expect(mockGl.pixelStorei).toHaveBeenCalledWith(mockGl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      expect(mockGl.texSubImage2D).toHaveBeenCalledTimes(1);
      expect(mockGl.texSubImage2D).toHaveBeenCalledWith(
        mockGl.TEXTURE_2D,
        0,
        px,
        py,
        mockGl.RGBA,
        mockGl.UNSIGNED_BYTE,
        expect.objectContaining({ width: pw, height: ph }),
      );
      expect(mockArenaGroundTex.refresh).not.toHaveBeenCalled();

      // Fallback check: when WebGL handles are absent, falls back to arenaGroundTex.refresh()
      mockArenaGroundTex.source[0]!.glTexture = null;
      renderedTiles.length = 0;
      map.setSurface(15, 10, 'ice', 5.0, false);
      syncArenaTilesWithMapRevisionImpl.call(mockGameScene);

      expect(renderedTiles).toHaveLength(9);
      expect(mockArenaGroundTex.refresh).toHaveBeenCalledTimes(1);

      // Same-dimension room transition check (e.g. 36x22 -> 36x22 with <= 64 changed tiles):
      // MUST run rebuildAllTileCellsToComposite() (updating RoomArchitecturePlan & clearing old decals/shadows),
      // never taking the clipped intra-room dirty-box shortcut.
      renderedTiles.length = 0;
      renderGroundPassSpy.mockClear();
      mockArenaGroundTex.refresh.mockClear();
      sim.currentRoomId += 1;
      map.setSurface(18, 10, 'poison_swamp', 0, true);
      syncArenaTilesWithMapRevisionImpl.call(mockGameScene);

      expect(mockGameScene.rebuildAllTileCellsToComposite).toHaveBeenCalledTimes(1);
      expect(renderedTiles).toHaveLength(0);
      expect(renderGroundPassSpy).not.toHaveBeenCalled();

      // Same-dimension room transition with 0 tile/surface differences MUST also trigger full rebuild
      sim.currentRoomId += 1;
      syncArenaTilesWithMapRevisionImpl.call(mockGameScene);
      expect(mockGameScene.rebuildAllTileCellsToComposite).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.document = prevDoc;
    }
  });

  it('6. pads dirty sub-rect by +-2 tiles on structural kind changes (wall -> floor) vs +-1 tile on surface-only changes and restores WebGL PMA state', () => {
    const sim = new WorldSim({ seed: 2027, biome: 1, spawnInitialWave: false });
    sim.enterRoom(sim.dungeon.startRoomId);
    const map = sim.map;
    // Seed an interior wall tile at (14, 10) before building initial mapTileVisuals
    map.setTile(14, 10, 'wall');
    map.rebuildSolidBoxes();

    const scale = 2;
    const expectedW = map.width * scale;
    const expectedH = map.height * scale;

    const mapTileVisuals: ArenaTileVisual[] = [];
    for (let ty = 0; ty < map.rows; ty++) {
      for (let tx = 0; tx < map.cols; tx++) {
        const distToWall = computeTileDistToWall(map, tx, ty);
        mapTileVisuals.push({
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

    const prevDoc = globalThis.document;
    globalThis.document = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              clearRect: vi.fn(),
              drawImage: vi.fn(),
            }),
          };
        }
        return {};
      }),
    } as unknown as Document;

    try {
      const mockWebGLTex = { id: 'arena-webgl-tex-pad' };
      const mockGl = {
        TEXTURE_2D: 0x0de1,
        TEXTURE_BINDING_2D: 0x8069,
        RGBA: 0x1908,
        UNSIGNED_BYTE: 0x1401,
        UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
        UNPACK_FLIP_Y_WEBGL: 0x9240,
        isContextLost: vi.fn(() => false),
        getParameter: vi.fn(() => null),
        bindTexture: vi.fn(),
        pixelStorei: vi.fn(),
        texSubImage2D: vi.fn(),
      };

      const groundCanvas = { width: expectedW, height: expectedH };
      const groundCtx = {} as CanvasRenderingContext2D;
      const glTexWrapper = {
        gl: mockGl,
        webGLTexture: mockWebGLTex,
        pma: false,
        flipY: false,
      };
      const mockArenaGroundTex = {
        width: expectedW,
        height: expectedH,
        canvas: groundCanvas,
        getCanvas: () => groundCanvas,
        getContext: () => groundCtx,
        source: [{ glTexture: glTexWrapper as unknown }],
        refresh: vi.fn(),
      };

      const renderedTiles: Array<[number, number]> = [];
      const renderGroundPassSpy = vi.fn();
      const effectiveBiome: 0 | 1 | 2 | 3 = sim.inHub ? 0 : sim.currentBiome;

      const mockGameScene = {
        transport: { getSim: () => sim },
        tileCompositeScale: scale,
        mapTileVisuals,
        arenaGroundTex: mockArenaGroundTex,
        lastRenderedBiome: effectiveBiome,
        lastConveyorDirection: map.conveyorDirection,
        lastRenderedRoomKey: `${effectiveBiome}:${sim.currentFloor}:${sim.currentRoomId}`,
        lastMapRevision:
          effectiveBiome * 10000000 +
          sim.currentFloor * 1000000 +
          sim.currentRoomId * 10000 +
          map.mapRevision,
        renderTileCellToComposite: vi.fn((tile: ArenaTileVisual) => {
          renderedTiles.push([tile.tx, tile.ty]);
        }),
        rebuildAllTileCellsToComposite: vi.fn(),
        biomeArchLive: {
          renderGroundPass: renderGroundPassSpy,
        },
      } as unknown as GameScene;

      // 1. Surface-only change at (8, 10) -> +-1 tile pad ([7..9] x [9..11] = 3x3 = 9 tiles)
      map.setSurface(8, 10, 'burning_oil', 5.0, false);
      syncArenaTilesWithMapRevisionImpl.call(mockGameScene);

      expect(renderedTiles).toHaveLength(9);
      expect(renderGroundPassSpy).toHaveBeenLastCalledWith(groundCtx, map, scale, {
        x: 7 * TILE_SIZE,
        y: 9 * TILE_SIZE,
        width: 3 * TILE_SIZE,
        height: 3 * TILE_SIZE,
      });
      expect(mockGl.texSubImage2D).toHaveBeenLastCalledWith(
        mockGl.TEXTURE_2D,
        0,
        7 * TILE_SIZE * scale,
        9 * TILE_SIZE * scale,
        mockGl.RGBA,
        mockGl.UNSIGNED_BYTE,
        expect.objectContaining({ width: 3 * TILE_SIZE * scale, height: 3 * TILE_SIZE * scale }),
      );
      // Verify pma=false sets UNPACK_PREMULTIPLY_ALPHA_WEBGL=false before upload and restores true after
      const pmaCalls = mockGl.pixelStorei.mock.calls.filter(
        (c) => c[0] === mockGl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
      );
      expect(pmaCalls).toEqual([
        [mockGl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false],
        [mockGl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true],
      ]);

      // 2. Structural kind change (wall -> floor) at (14, 10) -> +-2 tile pad ([12..16] x [8..12] = 5x5 = 25 tiles)
      renderedTiles.length = 0;
      renderGroundPassSpy.mockClear();
      mockGl.texSubImage2D.mockClear();

      map.setTile(14, 10, 'floor');
      map.rebuildSolidBoxes();
      syncArenaTilesWithMapRevisionImpl.call(mockGameScene);

      expect(mockGameScene.rebuildAllTileCellsToComposite).not.toHaveBeenCalled();
      expect(renderedTiles).toHaveLength(25);
      for (let ty = 8; ty <= 12; ty++) {
        for (let tx = 12; tx <= 16; tx++) {
          expect(renderedTiles).toContainEqual([tx, ty]);
        }
      }
      expect(renderGroundPassSpy).toHaveBeenCalledTimes(1);
      expect(renderGroundPassSpy).toHaveBeenCalledWith(groundCtx, map, scale, {
        x: 12 * TILE_SIZE,
        y: 8 * TILE_SIZE,
        width: 5 * TILE_SIZE,
        height: 5 * TILE_SIZE,
      });
      expect(mockGl.texSubImage2D).toHaveBeenCalledTimes(1);
      expect(mockGl.texSubImage2D).toHaveBeenCalledWith(
        mockGl.TEXTURE_2D,
        0,
        12 * TILE_SIZE * scale,
        8 * TILE_SIZE * scale,
        mockGl.RGBA,
        mockGl.UNSIGNED_BYTE,
        expect.objectContaining({ width: 5 * TILE_SIZE * scale, height: 5 * TILE_SIZE * scale }),
      );
    } finally {
      globalThis.document = prevDoc;
    }
  });
});
