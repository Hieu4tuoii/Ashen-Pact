import { ArenaMap, TILE_SIZE, type SimPlayerState, type SimPropState } from '@ashen-pact/shared';
import Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import type { InteractableLightEntry } from '../src/fx/lighting-config.js';
import { LightingPipeline } from '../src/fx/lighting-pipeline.js';
import { graphicsSettings } from '../src/ui/graphics-settings.js';

function makeProp(
  id: number,
  kind: 'torch_brazier' | 'glow_mushroom',
  x: number,
  y: number,
): SimPropState {
  return {
    id,
    kind,
    x,
    y,
    radius: 14,
    hp: 999,
    maxHp: 999,
    destructible: false,
    explosive: false,
    blocksMovement: kind === 'torch_brazier',
    lightRadius: kind === 'torch_brazier' ? 185 : 95,
    lightColorHex: kind === 'torch_brazier' ? '#FACC15' : '#4ADE80',
    hitFlashTimer: 0,
    fuseTimer: 0,
  };
}

function createLightingHarness() {
  const glowImages: Array<{
    x: number;
    y: number;
    visible: boolean;
  }> = [];

  const createMockImage = (x = 0, y = 0) => {
    const img = {
      x,
      y,
      visible: true,
      setOrigin: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setBlendMode: vi.fn().mockReturnThis(),
      setVisible: vi.fn((v: boolean) => {
        img.visible = v;
        return img;
      }),
      setPosition: vi.fn((nx: number, ny: number) => {
        img.x = nx;
        img.y = ny;
        return img;
      }),
      setScale: vi.fn().mockReturnThis(),
      setTint: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setTexture: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };
    return img;
  };

  const mockLightmapRt = {
    width: 480,
    height: 270,
    setOrigin: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setBlendMode: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    clear: vi.fn(),
    fill: vi.fn(),
    beginDraw: vi.fn(),
    batchDraw: vi.fn(),
    endDraw: vi.fn(),
    destroy: vi.fn(),
    texture: { renderTarget: { setAutoResize: vi.fn() } },
  };

  const mockGraphics = {
    setDepth: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeRect: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    lineBetween: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };

  const mockScene = {
    game: {
      renderer: new (Phaser.Renderer.WebGL.WebGLRenderer as unknown as new () => object)(),
    },
    textures: {
      exists: vi.fn(() => true),
    },
    make: {
      image: vi.fn(() => createMockImage()),
    },
    add: {
      renderTexture: vi.fn(() => mockLightmapRt),
      image: vi.fn((x: number, y: number, key: string) => {
        const img = createMockImage(x, y);
        if (key === 'fx_light_radial') {
          glowImages.push(img);
        }
        return img;
      }),
      graphics: vi.fn(() => mockGraphics),
    },
    cameras: {
      main: {
        width: 1500,
        height: 900,
        zoom: 1,
        zoomX: 1,
        zoomY: 1,
        scrollX: 0,
        scrollY: 0,
        worldView: { x: 0, y: 0, width: 1500, height: 900 },
        setPostPipeline: vi.fn(),
        removePostPipeline: vi.fn(),
        getPostPipeline: vi.fn(() => []),
      },
    },
  } as unknown as Phaser.Scene;

  const pipeline = new LightingPipeline(mockScene, 1);
  return { pipeline, mockLightmapRt, glowImages };
}

function createClearArenaMap(): ArenaMap {
  const map = new ArenaMap({ cols: 36, rows: 22, includePillars: false, seed: 1337, biome: 1 });
  for (let ty = 1; ty < map.rows - 1; ty++) {
    for (let tx = 1; tx < map.cols - 1; tx++) {
      map.tiles[ty * map.cols + tx] = 'floor';
      map.surfaces[ty * map.cols + tx] = 'none';
    }
  }
  return map;
}

const mockPlayer = {
  x: 17 * TILE_SIZE,
  y: 5 * TILE_SIZE,
  hp: 6,
  maxHp: 6,
  dashTimer: 0,
  skillActiveTimer: 0,
  aimAngle: 0,
} as unknown as SimPlayerState;

describe('Torch Brazier Lighting Consistency Across Viewport Distance', () => {
  afterEach(() => {
    graphicsSettings.setQuality('high');
  });

  it('keeps all visible torch_brazier props lit on low quality regardless of distance to camera center or player', () => {
    graphicsSettings.setQuality('low');
    const { pipeline, mockLightmapRt, glowImages } = createLightingHarness();
    const map = createClearArenaMap();

    // Place 4 braziers inside a 36x22 room viewport (camera centered near top half)
    const braziers: SimPropState[] = [
      makeProp(1, 'torch_brazier', 6 * TILE_SIZE, 4 * TILE_SIZE),
      makeProp(2, 'torch_brazier', 28 * TILE_SIZE, 4 * TILE_SIZE),
      makeProp(3, 'torch_brazier', 6 * TILE_SIZE, 18 * TILE_SIZE),
      makeProp(4, 'torch_brazier', 28 * TILE_SIZE, 18 * TILE_SIZE),
    ];

    pipeline.update({
      dtSec: 0.016,
      playerPos: { x: 17 * TILE_SIZE, y: 5 * TILE_SIZE },
      player: mockPlayer,
      simulatedPlayers: [],
      enemies: [],
      projectiles: [],
      props: braziers,
      map,
      trauma: 0,
      inHub: false,
    });

    // Every visible torch_brazier emits light on the lightmap AND activates outer/inner ADD glow sprites
    expect(mockLightmapRt.batchDraw).toHaveBeenCalledTimes(4);
    const visibleGlows = glowImages.filter((g) => g.visible);
    expect(visibleGlows).toHaveLength(8);
    for (const brazier of braziers) {
      const atBrazier = visibleGlows.filter((g) => g.x === brazier.x && g.y === brazier.y);
      expect(atBrazier).toHaveLength(2);
    }
    expect(pipeline.getActiveLightCount()).toBeLessThanOrEqual(12);
    pipeline.destroy();
  });

  it('lights all 6 boss-room torch_braziers even when glow_mushrooms appear earlier in props on low quality while respecting maxLights <= 12', () => {
    graphicsSettings.setQuality('low');
    const { pipeline, mockLightmapRt, glowImages } = createLightingHarness();
    const map = createClearArenaMap();

    const mushrooms: SimPropState[] = [
      makeProp(10, 'glow_mushroom', 8 * TILE_SIZE, 8 * TILE_SIZE),
      makeProp(11, 'glow_mushroom', 12 * TILE_SIZE, 8 * TILE_SIZE),
      makeProp(12, 'glow_mushroom', 16 * TILE_SIZE, 8 * TILE_SIZE),
      makeProp(13, 'glow_mushroom', 20 * TILE_SIZE, 8 * TILE_SIZE),
    ];
    const braziers: SimPropState[] = [
      makeProp(20, 'torch_brazier', 6 * TILE_SIZE, 4 * TILE_SIZE),
      makeProp(21, 'torch_brazier', 18 * TILE_SIZE, 4 * TILE_SIZE),
      makeProp(22, 'torch_brazier', 28 * TILE_SIZE, 4 * TILE_SIZE),
      makeProp(23, 'torch_brazier', 6 * TILE_SIZE, 18 * TILE_SIZE),
      makeProp(24, 'torch_brazier', 18 * TILE_SIZE, 18 * TILE_SIZE),
      makeProp(25, 'torch_brazier', 28 * TILE_SIZE, 18 * TILE_SIZE),
    ];
    const interactableLights: InteractableLightEntry[] = [
      { x: 18 * TILE_SIZE, y: 11 * TILE_SIZE, radius: 90, colorNum: 0xfacc15, alpha: 0.3 },
      { x: 19 * TILE_SIZE, y: 11 * TILE_SIZE, radius: 90, colorNum: 0x38bdf8, alpha: 0.3 },
      { x: 20 * TILE_SIZE, y: 11 * TILE_SIZE, radius: 90, colorNum: 0x4ade80, alpha: 0.3 },
      { x: 21 * TILE_SIZE, y: 11 * TILE_SIZE, radius: 90, colorNum: 0xf472b6, alpha: 0.3 },
    ];

    pipeline.update({
      dtSec: 0.016,
      playerPos: { x: 18 * TILE_SIZE, y: 5 * TILE_SIZE },
      player: mockPlayer,
      simulatedPlayers: [],
      enemies: [],
      projectiles: [],
      props: [...mushrooms, ...braziers],
      interactableLights,
      map,
      trauma: 0,
      inHub: false,
    });

    const visibleGlows = glowImages.filter((g) => g.visible);
    expect(visibleGlows).toHaveLength(12);
    for (const brazier of braziers) {
      const atBrazier = visibleGlows.filter((g) => g.x === brazier.x && g.y === brazier.y);
      expect(atBrazier).toHaveLength(2);
    }
    expect(mockLightmapRt.batchDraw.mock.calls.length).toBeGreaterThanOrEqual(6);
    expect(pipeline.getActiveLightCount()).toBeLessThanOrEqual(12);
    pipeline.destroy();
  });
});
