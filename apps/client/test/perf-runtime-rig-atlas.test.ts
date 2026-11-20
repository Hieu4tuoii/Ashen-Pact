import { WorldSim } from '@ashen-pact/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockPostFXPipeline {
    public game: unknown;
    public name: string;
    constructor(config: { game: unknown; name: string }) {
      this.game = config.game;
      this.name = config.name;
    }
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
    GameObjects: { Container: class {} },
    BlendModes: { NORMAL: 0, ADD: 1, MULTIPLY: 2, SCREEN: 3 },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Math: {
      Clamp: (v: number, min: number, max: number) => Math.max(min, Math.min(max, v)),
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
  return { default: PhaserMock, ...PhaserMock };
});

import type Phaser from 'phaser';
import { CutoutRig } from '../src/art/cutout-rig.js';
import { GOBLIN_SHOOTER_RIG_DEF, VANGUARD_RIG_DEF } from '../src/art/rig-defs.js';
import { bakeCustomCanvas } from '../src/art/texture-baker-canvas.js';
import {
  computeTotalVramBytes,
  isPreExistingNonVfxWorldOrRigTextureKey,
  listRegisteredCustomTextureKeys,
} from '../src/art/texture-baker-fx.js';
import * as TextureBakerModule from '../src/art/texture-baker.js';
import { TextureBaker } from '../src/art/texture-baker.js';
import { applyCameraViewportImpl } from '../src/scenes/game-scene/arena-tiles.js';
import { syncPropsImpl } from '../src/scenes/game-scene/entity-sync.js';

interface RecordedFrame {
  name: number | string;
  sourceIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RegisteredTexRecord {
  width: number;
  height: number;
  frames: RecordedFrame[];
  refreshCount: number;
}

interface MockSpriteRecord {
  x: number;
  y: number;
  key: string;
  texture: { key: string };
  frame: { name: string | undefined };
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
  depth: number;
  visible: boolean;
  active: boolean;
  setOrigin: ReturnType<typeof vi.fn>;
  setScale: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setRotation: ReturnType<typeof vi.fn>;
  setAlpha: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  setBlendMode: ReturnType<typeof vi.fn>;
  setTexture: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  setActive: ReturnType<typeof vi.fn>;
  setTint: ReturnType<typeof vi.fn>;
  setTintFill: ReturnType<typeof vi.fn>;
  clearTint: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

const ORIGINAL_DOCUMENT = (globalThis as { document?: unknown }).document;
const ORIGINAL_WINDOW = (globalThis as { window?: unknown }).window;

afterEach(() => {
  if (ORIGINAL_DOCUMENT === undefined) {
    delete (globalThis as { document?: unknown }).document;
  } else {
    (globalThis as { document?: unknown }).document = ORIGINAL_DOCUMENT;
  }
  if (ORIGINAL_WINDOW === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = ORIGINAL_WINDOW;
  }
});

function createMock2dContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  };
}

function createMockSprite(x: number, y: number, tex: string, frame?: string): MockSpriteRecord {
  const s: MockSpriteRecord = {
    x,
    y,
    key: tex,
    texture: { key: tex },
    frame: { name: frame },
    originX: 0.5,
    originY: 0.5,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    alpha: 1,
    depth: 0,
    visible: true,
    active: true,
    setOrigin: vi.fn((ox: number, oy?: number) => {
      s.originX = ox;
      s.originY = oy ?? ox;
      return s;
    }),
    setScale: vi.fn((sx: number, sy?: number) => {
      s.scaleX = sx;
      s.scaleY = sy ?? sx;
      return s;
    }),
    setPosition: vi.fn((nx: number, ny: number) => {
      s.x = nx;
      s.y = ny;
      return s;
    }),
    setRotation: vi.fn((r: number) => {
      s.rotation = r;
      return s;
    }),
    setAlpha: vi.fn((a: number) => {
      s.alpha = a;
      return s;
    }),
    setDepth: vi.fn((d: number) => {
      s.depth = d;
      return s;
    }),
    setBlendMode: vi.fn(() => s),
    setTexture: vi.fn((nextTex: string, nextFrame?: string) => {
      s.key = nextTex;
      s.texture.key = nextTex;
      s.frame.name = nextFrame;
      return s;
    }),
    setVisible: vi.fn((v: boolean) => {
      s.visible = v;
      return s;
    }),
    setActive: vi.fn((a: boolean) => {
      s.active = a;
      return s;
    }),
    setTint: vi.fn(() => s),
    setTintFill: vi.fn(() => s),
    clearTint: vi.fn(() => s),
    destroy: vi.fn(),
  };
  return s;
}

function createMockContainer(x = 0, y = 0) {
  const children: unknown[] = [];
  const c = {
    x,
    y,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    alpha: 1,
    depth: 0,
    visible: true,
    children,
    add: vi.fn((child: unknown) => {
      children.push(child);
      return c;
    }),
    addAt: vi.fn((child: unknown, idx: number) => {
      children.splice(idx, 0, child);
      return c;
    }),
    setPosition: vi.fn((nx: number, ny: number) => {
      c.x = nx;
      c.y = ny;
      return c;
    }),
    setScale: vi.fn((sx: number, sy?: number) => {
      c.scaleX = sx;
      c.scaleY = sy ?? sx;
      return c;
    }),
    setRotation: vi.fn((r: number) => {
      c.rotation = r;
      return c;
    }),
    setAlpha: vi.fn((a: number) => {
      c.alpha = a;
      return c;
    }),
    setVisible: vi.fn((v: boolean) => {
      c.visible = v;
      return c;
    }),
    setDepth: vi.fn((d: number) => {
      c.depth = d;
      return c;
    }),
    destroy: vi.fn(),
  };
  return c;
}

function createMockBakerAndSpriteScene() {
  const registered = new Map<string, RegisteredTexRecord>();
  const createdSprites: MockSpriteRecord[] = [];
  const getContextCalls: Array<unknown[]> = [];

  (globalThis as { document?: unknown }).document = {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`Unexpected tag: ${tag}`);
      return {
        width: 0,
        height: 0,
        getContext: (...args: unknown[]) => {
          getContextCalls.push(args);
          if (args[0] === '2d') {
            return createMock2dContext();
          }
          return null;
        },
      };
    },
  };

  const buildTexObj = (key: string, rec: RegisteredTexRecord) => {
    const framesRecord: Record<string | number, unknown> = {
      __BASE: { x: 0, y: 0, w: rec.width, h: rec.height },
    };
    for (const f of rec.frames) {
      framesRecord[f.name] = f;
    }
    const texObj = {
      key,
      frames: framesRecord,
      width: rec.width,
      height: rec.height,
      source: [{ width: rec.width, height: rec.height }],
      getSourceImage: () => ({ width: rec.width, height: rec.height }),
      refresh: vi.fn(() => {
        rec.refreshCount += 1;
        return texObj;
      }),
      add: (
        name: number | string,
        sourceIndex: number,
        x: number,
        y: number,
        w: number,
        h: number,
      ) => {
        const frameObj: RecordedFrame = { name, sourceIndex, x, y, w, h };
        rec.frames.push(frameObj);
        texObj.frames[name] = frameObj;
        return frameObj;
      },
    };
    return texObj;
  };

  const scene = {
    registered,
    createdSprites,
    getContextCalls,
    textures: {
      exists: (key: string) => registered.has(key),
      remove: (key: string) => {
        registered.delete(key);
      },
      getTextureKeys: () => Array.from(registered.keys()),
      addCanvas: (key: string, canvas: { width: number; height: number }) => {
        const rec: RegisteredTexRecord = {
          width: canvas.width,
          height: canvas.height,
          frames: [],
          refreshCount: 0,
        };
        registered.set(key, rec);
        return buildTexObj(key, rec);
      },
      get: (key: string) => {
        const rec = registered.get(key);
        return rec ? buildTexObj(key, rec) : undefined;
      },
    },
    add: {
      container: vi.fn((x = 0, y = 0) => createMockContainer(x, y)),
      sprite: vi.fn((x: number, y: number, tex: string, frame?: string) => {
        const sp = createMockSprite(x, y, tex, frame);
        createdSprites.push(sp);
        return sp;
      }),
    },
  };

  return scene;
}

describe('Task 5 — Shared Runtime Sprite Atlas for CutoutRig Parts, Weapons & Props', () => {
  it('1. packs rigs, weapons, shadows, player rings, and props into <= 3 POT 2048x2048 atlas_rig_prop_* pages with +2px gutters and keeps VRAM within [14.7 MB, 24.95 MB]', () => {
    const mockScene = createMockBakerAndSpriteScene();
    const phaserScene = mockScene as unknown as Phaser.Scene;

    expect((TextureBakerModule as Record<string, unknown>).RIG_PROP_ATLAS_PREFIX).toBe(
      'atlas_rig_prop_',
    );

    TextureBaker.bakeAll(phaserScene, 1.5, true);

    const resolveAtlasBinding = (
      TextureBaker as unknown as {
        resolveAtlasBinding: (
          scene: Phaser.Scene | undefined,
          logicalKey: string,
        ) => { textureKey: string; frameName?: string };
      }
    ).resolveAtlasBinding;
    expect(typeof resolveAtlasBinding).toBe('function');

    // Legacy string key getters remain 100% intact
    expect(TextureBaker.getPartTextureKey('vanguard', 'torso')).toBe('rig_vanguard_torso');
    expect(TextureBaker.getPartTextureKey('goblin_shooter', 'head')).toBe(
      'rig_goblin_shooter_head',
    );
    expect(TextureBaker.getWeaponTextureKey('knight_sword')).toBe('weapon_vec_knight_sword');
    expect(TextureBaker.getShadowTextureKey('vanguard')).toBe('rig_shadow_vanguard');
    expect(TextureBaker.getPlayerRingTextureKey(1)).toBe('player_ring_1');
    expect(TextureBaker.getPropTextureKey('wooden_crate')).toBe('prop_wooden_crate');

    const sampleLogicalKeys = [
      TextureBaker.getPartTextureKey('vanguard', 'torso'),
      TextureBaker.getPartTextureKey('goblin_shooter', 'head'),
      TextureBaker.getFullRigTextureKey('goblin_shooter'),
      TextureBaker.getWeaponTextureKey('knight_sword'),
      TextureBaker.getShadowTextureKey('vanguard'),
      TextureBaker.getPlayerRingTextureKey(1),
      'prop_shadow',
      TextureBaker.getPropTextureKey('wooden_crate'),
      TextureBaker.getPropTextureKey('moss_table', 'flipped'),
      TextureBaker.getSecretChallengeCrystalTextureKey(false),
    ];

    for (const key of sampleLogicalKeys) {
      const binding = resolveAtlasBinding.call(TextureBaker, phaserScene, key);
      expect(binding.textureKey.startsWith('atlas_rig_prop_')).toBe(true);
      expect(binding.frameName).toBe(key);
      const pageRec = mockScene.registered.get(binding.textureKey);
      expect(pageRec).toBeDefined();
      expect(pageRec!.frames.some((f) => f.name === key)).toBe(true);
    }

    const allRegisteredKeys = listRegisteredCustomTextureKeys(phaserScene);
    const atlasPageKeys = allRegisteredKeys.filter((k) => k.startsWith('atlas_rig_prop_'));
    expect(atlasPageKeys.length).toBeGreaterThanOrEqual(1);
    expect(atlasPageKeys.length).toBeLessThanOrEqual(3);

    // Standalone rig_*, weapon_vec_*, player_ring_*, and prop_* textures are consolidated into atlas_rig_prop_*
    const leftoverStandaloneRigOrPropKeys = allRegisteredKeys.filter(
      (k) =>
        k.startsWith('rig_') ||
        k.startsWith('weapon_vec_') ||
        k.startsWith('player_ring_') ||
        k.startsWith('prop_'),
    );
    expect(leftoverStandaloneRigOrPropKeys).toEqual([]);

    // Every atlas page is POT <= 2048x2048 and every packed frame maintains a >= 2px non-overlapping gutter
    for (const pageKey of atlasPageKeys) {
      const page = mockScene.registered.get(pageKey)!;
      expect(page.width).toBeGreaterThan(0);
      expect(page.height).toBeGreaterThan(0);
      expect(page.width).toBeLessThanOrEqual(2048);
      expect(page.height).toBeLessThanOrEqual(2048);
      expect(page.width & (page.width - 1)).toBe(0);
      expect(page.height & (page.height - 1)).toBe(0);
      expect(page.frames.length).toBeGreaterThan(0);

      for (let i = 0; i < page.frames.length; i++) {
        const a = page.frames[i]!;
        expect(a.w).toBeGreaterThan(0);
        expect(a.h).toBeGreaterThan(0);
        expect(a.x).toBeGreaterThanOrEqual(2);
        expect(a.y).toBeGreaterThanOrEqual(2);
        expect(a.x + a.w + 2).toBeLessThanOrEqual(page.width);
        expect(a.y + a.h + 2).toBeLessThanOrEqual(page.height);

        for (let j = i + 1; j < page.frames.length; j++) {
          const b = page.frames[j]!;
          const separatedBy2pxGutter =
            a.x + a.w + 2 <= b.x ||
            b.x + b.w + 2 <= a.x ||
            a.y + a.h + 2 <= b.y ||
            b.y + b.h + 2 <= a.y;
          expect(
            separatedBy2pxGutter,
            `Frames ${String(a.name)} and ${String(b.name)} on ${pageKey} violate 2px gutter`,
          ).toBe(true);
        }
      }
    }

    // VRAM ledger contract: atlas_rig_prop_* is classified as pre-existing non-VFX rig/prop texture
    expect(isPreExistingNonVfxWorldOrRigTextureKey('atlas_rig_prop_0')).toBe(true);
    const totalVram = computeTotalVramBytes(phaserScene);
    expect(totalVram).toBeGreaterThan(14_700_000);
    expect(totalVram).toBeLessThanOrEqual(24_950_000);
  });

  it('2. binds CutoutRig, syncPropsImpl, and applyCameraViewportImpl sprites to (atlasKey, frameName) and falls back cleanly on minimal mock scenes', () => {
    const bakedScene = createMockBakerAndSpriteScene();
    const phaserBakedScene = bakedScene as unknown as Phaser.Scene;
    TextureBaker.bakeAll(phaserBakedScene, 1.5, true);

    bakedScene.createdSprites.length = 0;
    const heroRig = new CutoutRig(phaserBakedScene, 240, 260, VANGUARD_RIG_DEF, {
      playerSlot: 1,
    });
    heroRig.setEquippedWeapon('knight_sword');

    // Ring (1) + shadow (1) + 8 articulated parts = 10 sprites, all bound to the same shared atlas page
    expect(bakedScene.createdSprites).toHaveLength(10);
    const sharedAtlasKey = bakedScene.createdSprites[0]!.texture.key;
    expect(sharedAtlasKey.startsWith('atlas_rig_prop_')).toBe(true);

    for (const sp of bakedScene.createdSprites) {
      expect(sp.texture.key).toBe(sharedAtlasKey);
      expect(sp.frame.name).toBeDefined();
    }
    const boundFrameNames = bakedScene.createdSprites.map((sp) => sp.frame.name);
    expect(boundFrameNames).toContain('player_ring_1');
    expect(boundFrameNames).toContain('rig_shadow_vanguard');
    expect(boundFrameNames).toContain('rig_vanguard_torso');
    expect(boundFrameNames).toContain('weapon_vec_knight_sword');

    // Switching player slot and refreshing baked textures preserves shared atlas binding
    heroRig.setPlayerSlot(3);
    heroRig.refreshBakedTextures();
    expect(bakedScene.createdSprites.some((sp) => sp.frame.name === 'player_ring_3')).toBe(true);
    for (const sp of bakedScene.createdSprites) {
      expect(sp.texture.key).toBe(sharedAtlasKey);
    }

    // Fast-composite enemy rig also binds to atlas_rig_prop_*
    bakedScene.createdSprites.length = 0;
    const fastEnemyRig = new CutoutRig(phaserBakedScene, 300, 300, GOBLIN_SHOOTER_RIG_DEF, {
      fastComposite: true,
    });
    expect(fastEnemyRig.isFastComposite()).toBe(true);
    const compSprite = bakedScene.createdSprites.find(
      (sp) => sp.frame.name === 'rig_full_goblin_shooter',
    );
    expect(compSprite).toBeDefined();
    expect(compSprite!.texture.key.startsWith('atlas_rig_prop_')).toBe(true);

    // syncPropsImpl & applyCameraViewportImpl bind props, shadows, and HUD weapon icons to atlas_rig_prop_*
    const sim = new WorldSim({ seed: 505, startInHub: false });
    sim.props.length = 0;
    const table = sim.spawnProp('moss_table', 320, 280);
    const weaponIcon = createMockSprite(0, 0, '');
    const gameSceneStub = {
      add: bakedScene.add,
      textures: bakedScene.textures,
      scale: { width: 1920, height: 1080 },
      cameras: {
        main: {
          setZoom: vi.fn(),
          centerOn: vi.fn(),
          width: 960,
          height: 540,
        },
      },
      transport: { getSim: () => sim },
      activePropIds: new Set<number>(),
      propVisuals: new Map<
        number,
        {
          sprite: MockSpriteRecord;
          shadow: MockSpriteRecord;
          kind: string;
          lastHp: number;
          flashTimer: number;
          isFlashed: boolean;
        }
      >(),
      pushBlockVisuals: new Map(),
      pushBlockSyncGeneration: 0,
      playerRig: heroRig,
      coOpPlayerVisuals: new Map(),
      hubStatueRigs: new Map(),
      hubGuideTexts: [],
      enemyRigs: new Map(),
      rebuildAllTileCellsToComposite: vi.fn(),
      projectileSprites: new Map(),
      projectileSpritePool: [],
      pickupSprites: new Map(),
      pickupSpritePool: [],
      weaponIconSprites: [weaponIcon],
      textObjects: [],
      pingVisuals: new Map(),
      lastViewportW: 0,
      lastViewportH: 0,
      lastAppliedDpr: 0,
      camFocusX: 480,
      camFocusY: 270,
    };

    syncPropsImpl.call(gameSceneStub as never, 1 / 60);
    const pv = gameSceneStub.propVisuals.get(table.id)!;
    expect(pv).toBeDefined();
    expect(pv.sprite.texture.key.startsWith('atlas_rig_prop_')).toBe(true);
    expect(pv.sprite.frame.name).toBe('prop_moss_table');
    expect(pv.shadow.texture.key.startsWith('atlas_rig_prop_')).toBe(true);
    expect(pv.shadow.frame.name).toBe('prop_shadow');

    sim.flipCoverProp(table, sim.player);
    syncPropsImpl.call(gameSceneStub as never, 1 / 60);
    expect(pv.sprite.texture.key.startsWith('atlas_rig_prop_')).toBe(true);
    expect(pv.sprite.frame.name).toBe('prop_moss_table_flipped');

    // Simulate viewport/DPR change triggering applyCameraViewportImpl texture refresh
    (globalThis as { window?: unknown }).window = {
      devicePixelRatio: 2,
      location: { search: '' },
    };
    applyCameraViewportImpl.call(gameSceneStub as never);
    expect(pv.sprite.texture.key.startsWith('atlas_rig_prop_')).toBe(true);
    expect(pv.sprite.frame.name).toBe('prop_moss_table');
    expect(pv.shadow.texture.key.startsWith('atlas_rig_prop_')).toBe(true);
    expect(pv.shadow.frame.name).toBe('prop_shadow');
    expect(weaponIcon.texture.key.startsWith('atlas_rig_prop_')).toBe(true);
    expect(weaponIcon.frame.name).toBe(
      TextureBaker.getWeaponTextureKey(sim.player.weaponSlots[0]!),
    );

    // Fallback check: minimal mock scene WITHOUT atlas_rig_prop_* binds directly to logicalKey
    const minimalSprites: MockSpriteRecord[] = [];
    const minimalScene = {
      add: {
        container: vi.fn((x = 0, y = 0) => createMockContainer(x, y)),
        sprite: vi.fn((x: number, y: number, tex: string, frame?: string) => {
          const sp = createMockSprite(x, y, tex, frame);
          minimalSprites.push(sp);
          return sp;
        }),
      },
    } as unknown as Phaser.Scene;

    const fallbackRig = new CutoutRig(minimalScene, 100, 100, VANGUARD_RIG_DEF, {
      playerSlot: 2,
    });
    fallbackRig.setEquippedWeapon('knight_sword');
    expect(minimalSprites).toHaveLength(10);
    for (const sp of minimalSprites) {
      expect(sp.texture.key.startsWith('atlas_rig_prop_')).toBe(false);
      expect(sp.frame.name).toBeUndefined();
    }
    expect(minimalSprites.map((sp) => sp.texture.key)).toContain('player_ring_2');
    expect(minimalSprites.map((sp) => sp.texture.key)).toContain('rig_shadow_vanguard');
    expect(minimalSprites.map((sp) => sp.texture.key)).toContain('rig_vanguard_torso');
    expect(minimalSprites.map((sp) => sp.texture.key)).toContain('weapon_vec_knight_sword');
  });

  it('3. creates 2D canvas contexts without { willReadFrequently: true } in bakeCustomCanvas and rig baking', () => {
    const mockScene = createMockBakerAndSpriteScene();
    const phaserScene = mockScene as unknown as Phaser.Scene;

    bakeCustomCanvas(phaserScene, 'fx_test_probe', 24, 24, 4, (ctx) => {
      ctx.fillRect(-4, -4, 8, 8);
    });
    TextureBaker.bakeStageRigsAndArsenal(phaserScene, 1.5);

    const calls2d = mockScene.getContextCalls.filter((args) => args[0] === '2d');
    expect(calls2d.length).toBeGreaterThan(10);
    for (const args of calls2d) {
      expect(args).toEqual(['2d']);
    }
  });

  it('4. packs progressive two-stage boot (bakeStageRigsAndArsenal -> bakeStageWorldAndPortals) into <= 3 shared atlas_rig_prop_* pages and hits cache on subsequent bakeAll', () => {
    const mockScene = createMockBakerAndSpriteScene();
    const phaserScene = mockScene as unknown as Phaser.Scene;

    TextureBaker.bakeStageRigsAndArsenal(phaserScene, 1.5);
    TextureBaker.bakeStageWorldAndPortals(phaserScene, 1.5);
    TextureBaker.bakeStageShadersAndVfx(phaserScene, 1.5, true);

    const allKeys = listRegisteredCustomTextureKeys(phaserScene);
    const atlasPages = allKeys.filter((k) => k.startsWith('atlas_rig_prop_'));
    expect(atlasPages.length).toBeGreaterThanOrEqual(1);
    expect(atlasPages.length).toBeLessThanOrEqual(3);

    const ringBinding = TextureBaker.resolveAtlasBinding(phaserScene, 'player_ring_1');
    const crateBinding = TextureBaker.resolveAtlasBinding(phaserScene, 'prop_wooden_crate');
    const anvilBinding = TextureBaker.resolveAtlasBinding(phaserScene, 'prop_daedalus_anvil');
    expect(ringBinding.textureKey.startsWith('atlas_rig_prop_')).toBe(true);
    expect(ringBinding.frameName).toBe('player_ring_1');
    expect(crateBinding.textureKey.startsWith('atlas_rig_prop_')).toBe(true);
    expect(crateBinding.frameName).toBe('prop_wooden_crate');
    expect(anvilBinding.textureKey.startsWith('atlas_rig_prop_')).toBe(true);
    expect(anvilBinding.frameName).toBe('prop_daedalus_anvil');

    // Subsequent non-forced bakeAll at same zoom/DPR hits cache without re-creating contexts
    const contextCallsBefore = mockScene.getContextCalls.length;
    TextureBaker.bakeAll(phaserScene, 1.5, false);
    expect(mockScene.getContextCalls.length).toBe(contextCallsBefore);
  });
});
