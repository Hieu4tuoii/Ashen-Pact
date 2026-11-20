import {
  ArenaMap,
  TILE_SIZE,
  WorldSim,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
} from '@ashen-pact/shared';
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
    GameObjects: { Container: class {} },
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
  return {
    default: PhaserMock,
    ...PhaserMock,
  };
});

import { CUTOUT_KIT_ATLAS_KEY } from '../src/art/texture-baker-fx.js';
import { ZzfxSynth } from '../src/audio/zzfx.js';
import {
  activateParticle,
  CombatFxManager,
  routeCutoutBurstByRadius,
} from '../src/fx/combat-fx.js';
import { syncBatch1WeaponRoomEntities } from '../src/fx/combat-fx-weapons-p1a-entities.js';
import { getWeaponV2OverlayState } from '../src/fx/combat-fx-weapons-v2.js';
import {
  getBiomePostFxFragForTest,
  LightingPipeline,
} from '../src/fx/lighting-pipeline.js';
import { syncRoomEntitiesImpl } from '../src/scenes/game-scene/room-entities-sync.js';
import {
  drawEnemyHealthAndStatusBarImpl,
  renderTelegraphsAndShieldImpl,
} from '../src/scenes/game-scene/telegraphs-and-overlays.js';
import { graphicsSettings } from '../src/ui/graphics-settings.js';

function createTrackedMockSprite(x = 0, y = 0, initialTexture = '') {
  const sprite = {
    x,
    y,
    textureKey: initialTexture,
    frame: undefined as string | number | undefined,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    depth: 0,
    visible: true,
    active: true,
    blendMode: 'NORMAL' as string | number,
    tint: null as number | null,
    setTexture: vi.fn((key: string, frame?: string | number) => {
      sprite.textureKey = key;
      if (frame !== undefined) sprite.frame = frame;
      return sprite;
    }),
    setFrame: vi.fn((frame: string | number) => {
      sprite.frame = frame;
      return sprite;
    }),
    setPosition: vi.fn((nx: number, ny: number) => {
      sprite.x = nx;
      sprite.y = ny;
      return sprite;
    }),
    setRotation: vi.fn((r: number) => {
      sprite.rotation = r;
      return sprite;
    }),
    setScale: vi.fn((sx: number, sy?: number) => {
      sprite.scaleX = sx;
      sprite.scaleY = sy ?? sx;
      return sprite;
    }),
    setAlpha: vi.fn((a: number) => {
      sprite.alpha = a;
      return sprite;
    }),
    setDepth: vi.fn((d: number) => {
      sprite.depth = d;
      return sprite;
    }),
    setVisible: vi.fn((v: boolean) => {
      sprite.visible = v;
      return sprite;
    }),
    setActive: vi.fn((v: boolean) => {
      sprite.active = v;
      return sprite;
    }),
    setBlendMode: vi.fn((m: string | number) => {
      sprite.blendMode = m;
      return sprite;
    }),
    setTint: vi.fn((t: number) => {
      sprite.tint = t;
      return sprite;
    }),
    clearTint: vi.fn(() => {
      sprite.tint = null;
      return sprite;
    }),
    setOrigin: vi.fn(() => sprite),
    destroy: vi.fn(),
  };
  return sprite;
}

function createCommandBufferGraphics() {
  const commandBuffer: number[] = [];
  const pushOp = () => {
    commandBuffer.push(1);
    return g;
  };
  const g = {
    commandBuffer,
    visible: true,
    depth: 0,
    clear: vi.fn(() => {
      commandBuffer.length = 0;
      return g;
    }),
    setVisible: vi.fn((v: boolean) => {
      g.visible = v;
      return g;
    }),
    setDepth: vi.fn((d: number) => {
      g.depth = d;
      return g;
    }),
    fillStyle: vi.fn(pushOp),
    lineStyle: vi.fn(pushOp),
    fillRect: vi.fn(pushOp),
    strokeRect: vi.fn(pushOp),
    fillRoundedRect: vi.fn(pushOp),
    strokeRoundedRect: vi.fn(pushOp),
    fillCircle: vi.fn(pushOp),
    strokeCircle: vi.fn(pushOp),
    strokeEllipse: vi.fn(pushOp),
    fillEllipse: vi.fn(pushOp),
    fillTriangle: vi.fn(pushOp),
    strokeTriangle: vi.fn(pushOp),
    lineBetween: vi.fn(pushOp),
    beginPath: vi.fn(pushOp),
    moveTo: vi.fn(pushOp),
    lineTo: vi.fn(pushOp),
    arc: vi.fn(pushOp),
    closePath: vi.fn(pushOp),
    fillPath: vi.fn(pushOp),
    strokePath: vi.fn(pushOp),
    destroy: vi.fn(),
  };
  return g;
}

function createMockPhaserText(initialText = '') {
  let content = initialText;
  const style = { color: '#fffdf5', resolution: 2 };
  const txt = {
    get text() {
      return content;
    },
    set text(v: string) {
      content = v;
    },
    get width() {
      return Math.max(24, content.length * 8);
    },
    get height() {
      return 16;
    },
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    visible: false,
    active: false,
    depth: 80,
    style,
    setOrigin: vi.fn(() => txt),
    setVisible: vi.fn((v: boolean) => {
      txt.visible = v;
      return txt;
    }),
    setActive: vi.fn((v: boolean) => {
      txt.active = v;
      return txt;
    }),
    setDepth: vi.fn((d: number) => {
      txt.depth = d;
      return txt;
    }),
    setResolution: vi.fn((r: number) => {
      style.resolution = r;
      return txt;
    }),
    setText: vi.fn((v: string) => {
      content = String(v);
      return txt;
    }),
    setColor: vi.fn((c: string) => {
      style.color = c;
      return txt;
    }),
    setPosition: vi.fn((nx: number, ny: number) => {
      txt.x = nx;
      txt.y = ny;
      return txt;
    }),
    setScale: vi.fn((sx: number, sy?: number) => {
      txt.scaleX = sx;
      txt.scaleY = sy ?? sx;
      return txt;
    }),
    setAlpha: vi.fn((a: number) => {
      txt.alpha = a;
      return txt;
    }),
  };
  return txt;
}

afterEach(() => {
  graphicsSettings.setQuality('high');
  vi.restoreAllMocks();
});

describe('Task 4 — CombatFxManager Pools, World Overlay Consolidation, Lighting Surface Cache & Cached Procedural Audio', () => {
  describe('1. CombatFxManager pool footprint, flipbook frame guard & idle Graphics hiding', () => {
    function buildMockFxScene() {
      const createdSprites: ReturnType<typeof createTrackedMockSprite>[] = [];
      const createdGraphics: ReturnType<typeof createCommandBufferGraphics>[] = [];
      const createdTexts: ReturnType<typeof createMockPhaserText>[] = [];
      const mockScene = {
        add: {
          sprite: vi.fn((x: number, y: number, key: string) => {
            const spr = createTrackedMockSprite(x, y, key);
            createdSprites.push(spr);
            return spr;
          }),
          graphics: vi.fn(() => {
            const gfx = createCommandBufferGraphics();
            createdGraphics.push(gfx);
            return gfx;
          }),
          text: vi.fn((_x: number, _y: number, initial: string) => {
            const t = createMockPhaserText(initial);
            createdTexts.push(t);
            return t;
          }),
        },
      } as unknown as Phaser.Scene;
      return { mockScene, createdSprites, createdGraphics, createdTexts };
    }

    it('creates at most 32 casing shadow sprites for a 300-slot particle pool while attaching a visible depth-19 shadowSprite to fx_shell_casing', () => {
      const { mockScene, createdSprites } = buildMockFxScene();
      const fx = new CombatFxManager(mockScene, 300, 48, 120, 24, 96);

      const shadowSprites = createdSprites.filter(
        (s) => s.textureKey === 'fx_dust_puff' && s.depth === 19,
      );
      expect(shadowSprites.length).toBeGreaterThan(0);
      expect(shadowSprites.length).toBeLessThanOrEqual(32);

      // Total sprites = 120 decals + 24 afterimages + 300 particles + <=32 casing shadows + 96 ambient = <= 572 (down from 840)
      expect(createdSprites.length).toBeLessThanOrEqual(572);

      fx.spawnMuzzleFlashAndCasing(240, 180, 0, false, false, 'rivet_gun');
      const casing = fx.particlePool.find(
        (p) => p.active && p.textureKey === 'fx_shell_casing',
      );
      expect(casing).toBeDefined();
      expect(casing!.hasGroundShadow).toBe(true);
      expect(casing!.shadowSprite).toBeDefined();
      expect(casing!.shadowSprite!.visible).toBe(true);
      expect(casing!.shadowSprite!.depth).toBe(19);
      expect(fx.getActiveParticleCount()).toBeGreaterThanOrEqual(3);

      // Expire all particles and verify O(1) active count drops back to 0 and shadow hides
      const boundShadow = casing!.shadowSprite!;
      fx.update(1.0);
      expect(fx.getActiveParticleCount()).toBe(0);
      expect(boundShadow.visible).toBe(false);
    });

    it('calls sprite.setFrame only on initial spawn across 6 sub-steps on subframe 0, and once when advancing to subframe 1', () => {
      const { mockScene } = buildMockFxScene();
      const fx = new CombatFxManager(mockScene, 32, 16, 16, 8, 16);

      const burstSlot = routeCutoutBurstByRadius(fx, 300, 220, 20, 'fx_sh_nova_solar', {
        ttlSec: 0.2,
      });
      expect(burstSlot).not.toBeNull();
      const spr = burstSlot!.sprite as unknown as ReturnType<typeof createTrackedMockSprite>;
      expect(spr.setFrame).toHaveBeenCalledTimes(1);
      expect(spr.frame).toBe('fx_small_burst_4f_0');

      spr.setFrame.mockClear();

      // 6 steps * 0.005s = 0.030s < 0.050s (ttl 0.20s / 4 frames), stays on subframe 0
      for (let step = 0; step < 6; step++) {
        fx.update(0.005);
      }
      expect(spr.setFrame).toHaveBeenCalledTimes(0);

      // Advance past 0.050s into subframe 1 (0.030 + 0.025 = 0.055s)
      fx.update(0.025);
      expect(spr.setFrame).toHaveBeenCalledTimes(1);
      expect(spr.frame).toBe('fx_small_burst_4f_1');

      // Another small step still inside subframe 1 (0.055 + 0.010 = 0.065s < 0.100s) -> 0 extra setFrame calls
      spr.setFrame.mockClear();
      fx.update(0.01);
      expect(spr.setFrame).toHaveBeenCalledTimes(0);

      // Also verify activateParticle guards redundant setDepth & setBlendMode on reuse
      const slot0 = fx.particlePool[0]!;
      const spr0 = slot0.sprite as unknown as ReturnType<typeof createTrackedMockSprite>;
      activateParticle(slot0, {
        textureKey: 'fx_spark',
        x: 100,
        y: 100,
        ttl: 0.2,
        startScale: 1,
        endScale: 0.5,
        blendMode: 'ADD',
        depth: 55,
      });
      spr0.setDepth.mockClear();
      spr0.setBlendMode.mockClear();
      activateParticle(slot0, {
        textureKey: 'fx_spark',
        x: 120,
        y: 120,
        ttl: 0.2,
        startScale: 1,
        endScale: 0.5,
        blendMode: 'ADD',
        depth: 55,
      });
      expect(spr0.setDepth).not.toHaveBeenCalled();
      expect(spr0.setBlendMode).not.toHaveBeenCalled();
    });

    it('keeps idle underActorGraphics, weaponRibbonGraphics, and floorFoldGraphics hidden and skips redundant .clear() calls while empty', () => {
      const { mockScene } = buildMockFxScene();
      const fx = new CombatFxManager(mockScene, 32, 16, 16, 8, 16);

      const uag = fx.underActorGraphics as unknown as ReturnType<typeof createCommandBufferGraphics>;
      const wrg = fx.weaponRibbonGraphics as unknown as ReturnType<typeof createCommandBufferGraphics>;
      const ffg = fx.floorFoldGraphics as unknown as ReturnType<typeof createCommandBufferGraphics>;

      uag.clear.mockClear();
      wrg.clear.mockClear();
      ffg.clear.mockClear();

      // Run 4 quiet frames with 0 active ribbons/arcs/folds
      for (let i = 0; i < 4; i++) {
        fx.update(0.016);
      }

      expect(uag.visible).toBe(false);
      expect(wrg.visible).toBe(false);
      expect(ffg.visible).toBe(false);
      expect(uag.clear).toHaveBeenCalledTimes(0);
      expect(wrg.clear).toHaveBeenCalledTimes(0);
      expect(ffg.clear).toHaveBeenCalledTimes(0);

      // Spawn chain lightning + teleport fold + perimeter ring -> layers unhide while active
      fx.spawnChainLightningArc(100, 100, 200, 160);
      fx.spawnArcaneTeleportFold(150, 150);
      fx.activePerimeterRings.push({
        active: true,
        x: 150,
        y: 150,
        targetRadiusPx: 60,
        currentRadiusPx: 20,
        colorNum: 0x38bdf8,
        alpha: 0.9,
        age: 0,
        ttl: 0.2,
      });

      fx.update(0.016);
      expect(uag.visible).toBe(true);
      expect(wrg.visible).toBe(true);
      expect(ffg.visible).toBe(true);

      // Advance past TTL -> clears once to flush expired geometry and hides again; subsequent idle frames do 0 clears
      fx.update(0.5);
      expect(uag.visible).toBe(false);
      expect(wrg.visible).toBe(false);
      expect(ffg.visible).toBe(false);

      uag.clear.mockClear();
      wrg.clear.mockClear();
      ffg.clear.mockClear();
      fx.update(0.016);
      fx.update(0.016);
      expect(uag.clear).toHaveBeenCalledTimes(0);
      expect(wrg.clear).toHaveBeenCalledTimes(0);
      expect(ffg.clear).toHaveBeenCalledTimes(0);
    });

    it('preserves startScale/endScale on single-frame CUTOUT_KIT_ATLAS_KEY particles across refreshResolution while rescaling bakeScale-dependent particles', () => {
      const { mockScene } = buildMockFxScene();
      const fx = new CombatFxManager(mockScene, 16, 8, 8, 4, 16);

      const kitSlot = fx.particlePool[0]!;
      activateParticle(kitSlot, {
        textureKey: CUTOUT_KIT_ATLAS_KEY,
        frameName: 'fx_arc_crescent_cut',
        x: 200,
        y: 200,
        ttl: 0.25,
        startScale: 1 / 3,
        endScale: 0.5,
      });
      expect(kitSlot.frameCount).toBe(1);

      const directKitSlot = fx.particlePool[1]!;
      activateParticle(directKitSlot, {
        textureKey: CUTOUT_KIT_ATLAS_KEY,
        frameName: 'fx_arc_crescent_cut',
        x: 210,
        y: 200,
        ttl: 0.25,
        startScale: 1 / 3,
        endScale: 0.45,
      });
      directKitSlot.frameCount = undefined;

      const bakedSlot = fx.particlePool[2]!;
      activateParticle(bakedSlot, {
        textureKey: 'fx_spark',
        x: 220,
        y: 200,
        ttl: 0.25,
        startScale: 0.5,
        endScale: 0.25,
      });

      // Simulate zoom/DPI resize from bakeScale 2 -> 4 (scaleRatio = 2 / 4 = 0.5)
      fx.refreshResolution(4, 2);

      // Fixed-3x CUTOUT_KIT_ATLAS_KEY single-frame particles preserve exact scales
      expect(kitSlot.startScale).toBeCloseTo(1 / 3, 6);
      expect(kitSlot.endScale).toBeCloseTo(0.5, 6);
      expect(directKitSlot.startScale).toBeCloseTo(1 / 3, 6);
      expect(directKitSlot.endScale).toBeCloseTo(0.45, 6);

      // bakeScale-dependent particle rescales by prevScale / bakeScale = 0.5
      expect(bakedSlot.startScale).toBeCloseTo(0.25, 6);
      expect(bakedSlot.endScale).toBeCloseTo(0.125, 6);
    });
  });

  describe('2. World Overlay Consolidation & Earcut-Free Enemy HP/Status Bars', () => {
    it('interpolates each projectile at most once per renderTelegraphsAndShieldImpl pass, avoids duplicate syncBatch1WeaponRoomEntities, and pools tetherBeams in place', () => {
      const sim = new WorldSim({ seed: 4242, biome: 1 });
      sim.enterRoom(sim.dungeon.startRoomId);
      sim.enemies.length = 0;

      for (let i = 0; i < 4; i++) {
        sim.projectiles.push({
          id: 100 + i,
          ownerId: sim.player.id,
          team: 'player',
          weaponId: 'rivet_gun',
          x: 200 + i * 24,
          y: 220,
          vx: 420,
          vy: 0,
          angle: 0,
          radius: 5,
          damage: 12,
          ttlSec: 0.8,
          pierceRemaining: 0,
          bouncesRemaining: 0,
          element: 'none',
          isCrit: false,
          colorHex: '#38BDF8',
        } as SimProjectileState);
      }

      sim.tetherBeams.push({
        id: 1,
        ownerPlayerId: sim.player.id,
        targetEntityId: 99,
        targetKind: 'prop',
        x1: 200,
        y1: 200,
        x2: 320,
        y2: 240,
        damage: 10,
        ttlSec: 0.5,
        tickTimer: 0.1,
      });

      // Verify syncBatch1WeaponRoomEntities mutates pooled tether snapshot entries in place
      const standaloneKey = {};
      syncBatch1WeaponRoomEntities(standaloneKey, sim);
      const firstBeamRef = getWeaponV2OverlayState(standaloneKey).lastTetherSnapshot[0];
      expect(firstBeamRef).toBeDefined();
      sim.tetherBeams[0]!.x2 = 360;
      syncBatch1WeaponRoomEntities(standaloneKey, sim);
      const secondBeamRef = getWeaponV2OverlayState(standaloneKey).lastTetherSnapshot[0];
      expect(secondBeamRef).toBe(firstBeamRef);
      expect(secondBeamRef!.x2).toBe(360);

      const getInterpolatedProjectilePos = vi.fn(
        (b: SimProjectileState, out?: { x: number; y: number }) => {
          const target = out ?? { x: 0, y: 0 };
          target.x = b.x + 2;
          target.y = b.y + 1;
          return target;
        },
      );

      const telegraphGraphics = createCommandBufferGraphics();
      const groundHazardGraphics = createCommandBufferGraphics();
      const enemyGroundTelegraphGfx = createCommandBufferGraphics();
      const icePrisonRearGraphics = createCommandBufferGraphics();
      const bastionRearGraphics = createCommandBufferGraphics();
      const icePrisonFrontGraphics = createCommandBufferGraphics();
      const bastionFrontGraphics = createCommandBufferGraphics();
      const bossOverGraphics = createCommandBufferGraphics();
      const bossFractureGraphics = createCommandBufferGraphics();
      const bossOverheadStunGraphics = createCommandBufferGraphics();
      const executionerWaveGraphics = createCommandBufferGraphics();
      const underActorGraphics = createCommandBufferGraphics();
      const weaponRibbonGraphics = createCommandBufferGraphics();

      const mockScene = {
        game: { loop: { frame: 101 } },
        coopMode: 'solo',
        pauseModalOpen: false,
        fullMapOpen: false,
        roomTeleportAnimTimer: 0,
        roomTeleportAnimDuration: 0.28,
        entityPosScratch: { x: 0, y: 0 },
        interactPromptState: { currentTargetKey: null },
        currentInteractTarget: null,
        summonVisuals: new Map(),
        summonSpritePool: [],
        chestSprites: new Map(),
        worldItemSprites: new Map(),
        npcRigs: new Map(),
        hubStatueRigs: new Map(),
        hubStationSprites: new Map(),
        pressurePlateSprites: new Map(),
        pushBlockSprites: new Map(),
        secretCrystalSprite: null,
        secretCrystalLabel: null,
        telegraphGraphics,
        groundHazardGraphics,
        enemyGroundTelegraphGfx,
        icePrisonRearGraphics,
        bastionRearGraphics,
        icePrisonFrontGraphics,
        bastionFrontGraphics,
        bossOverGraphics,
        bossFractureGraphics,
        bossOverheadStunGraphics,
        executionerWaveGraphics,
        underActorGraphics,
        weaponRibbonGraphics,
        drawEnemyHealthAndStatusBar: vi.fn(),
        lighting: {
          isLightmapVisible: () => true,
          getElapsedSec: () => 1.0,
        },
        fx: {
          bossKillSequenceState: null,
          underActorGraphics,
          weaponRibbonGraphics,
        },
        cameras: {
          main: {
            worldView: { x: 0, y: 0, width: 960, height: 540 },
          },
        },
        transport: {
          getSim: () => sim,
          getInterpolatedProjectilePos,
          getInterpolatedEnemyPos: (e: SimEnemyState, out?: { x: number; y: number }) => {
            const target = out ?? { x: 0, y: 0 };
            target.x = e.x;
            target.y = e.y;
            return target;
          },
          getInterpolatedSimPlayerPos: (pl: SimPlayerState, out?: { x: number; y: number }) => {
            const target = out ?? { x: 0, y: 0 };
            target.x = pl.x;
            target.y = pl.y;
            return target;
          },
        },
      };

      // Simulate syncRoomEntitiesImpl having already synced on frame 101
      syncBatch1WeaponRoomEntities(mockScene, sim);
      const syncedBeamBeforeOverlay = getWeaponV2OverlayState(mockScene).lastTetherSnapshot[0]!;
      // Mutate tether x2 WITHOUT advancing sim.tick or game.loop.frame; duplicate sync inside renderTelegraphsAndShieldImpl must be skipped
      sim.tetherBeams[0]!.x2 = 999;

      renderTelegraphsAndShieldImpl.call(mockScene as never, sim.player.x + 1, sim.player.y + 1);

      expect(getInterpolatedProjectilePos).toHaveBeenCalledTimes(sim.projectiles.length);
      expect(syncedBeamBeforeOverlay.x2).toBe(360);

      // Unused split-depth overlay layers with empty commandBuffers are hidden at end of pass
      expect(icePrisonRearGraphics.visible).toBe(false);
      expect(bastionRearGraphics.visible).toBe(false);
      expect(bossFractureGraphics.visible).toBe(false);
      expect(executionerWaveGraphics.visible).toBe(false);
      // telegraphGraphics drew tether beam -> remains visible
      expect(telegraphGraphics.visible).toBe(true);
      void syncRoomEntitiesImpl;
    });

    it('draws enemy health and status bars with 0 fillRoundedRect and 0 fillCircle calls', () => {
      const g = createCommandBufferGraphics();
      const enemy = {
        id: 7,
        defId: 'goblin_warrior',
        x: 300,
        y: 240,
        hp: 45,
        maxHp: 100,
        shieldArmor: 20,
        maxShieldArmor: 40,
        isBoss: false,
        isElite: true,
        burnTimer: 2.0,
        chillStacks: 1,
        frozenTimer: 1.2,
        shockTimer: 1.5,
        poisonStacks: 2,
        superconductTimer: 2.0,
        markedTimer: 3.0,
      } as unknown as SimEnemyState;

      drawEnemyHealthAndStatusBarImpl.call({} as never, g as never, 300, 210, enemy);

      expect(g.fillRoundedRect).toHaveBeenCalledTimes(0);
      expect(g.fillCircle).toHaveBeenCalledTimes(0);
      expect(g.strokeCircle).toHaveBeenCalledTimes(0);
      expect(g.fillRect.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(g.fillTriangle.mock.calls.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('3. LightingPipeline surface light cache & BIOME_POSTFX_FRAG luma threshold', () => {
    function createLightingSceneHarness() {
      const makeMockImage = (x = 0, y = 0) => {
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

      const lightmapRt = {
        width: 480,
        height: 270,
        visible: true,
        setOrigin: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setBlendMode: vi.fn().mockReturnThis(),
        setVisible: vi.fn((v: boolean) => {
          lightmapRt.visible = v;
          return lightmapRt;
        }),
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

      const rimGfx = createCommandBufferGraphics();
      const scene = {
        game: {
          renderer: new (Phaser.Renderer.WebGL.WebGLRenderer as unknown as new () => object)(),
        },
        textures: { exists: vi.fn(() => true) },
        make: { image: vi.fn(() => makeMockImage()) },
        add: {
          renderTexture: vi.fn(() => lightmapRt),
          image: vi.fn((x: number, y: number) => makeMockImage(x, y)),
          graphics: vi.fn(() => rimGfx),
        },
        cameras: {
          main: {
            width: 960,
            height: 540,
            zoom: 1,
            zoomX: 1,
            zoomY: 1,
            scrollX: 0,
            scrollY: 0,
            worldView: { x: 0, y: 0, width: 960, height: 540 },
            setPostPipeline: vi.fn(),
            removePostPipeline: vi.fn(),
            getPostPipeline: vi.fn(() => []),
          },
        },
      } as unknown as Phaser.Scene;

      return { lighting: new LightingPipeline(scene, 1), lightmapRt, rimGfx };
    }

    it('scans map.getSurface only on frame 1 across 10 unchanged-revision frames and re-scans immediately on mapRevision increment', () => {
      const { lighting, lightmapRt } = createLightingSceneHarness();
      const map = new ArenaMap({ cols: 30, rows: 20, includePillars: false, seed: 99, biome: 1 });
      map.setSurface(6, 6, 'lava');
      map.setSurface(8, 6, 'burning_oil');

      const getSurfaceSpy = vi.spyOn(map, 'getSurface');
      const mockPlayer = {
        x: 6 * TILE_SIZE,
        y: 6 * TILE_SIZE,
        hp: 6,
        maxHp: 6,
        dashTimer: 0,
        skillActiveTimer: 0,
        aimAngle: 0,
      } as unknown as SimPlayerState;

      // Frame 1: populates surface light cache for current map.mapRevision
      lighting.update({
        dtSec: 1 / 60,
        playerPos: { x: mockPlayer.x, y: mockPlayer.y },
        player: mockPlayer,
        simulatedPlayers: [],
        enemies: [],
        projectiles: [],
        props: [],
        map,
        trauma: 0,
      });
      expect(getSurfaceSpy.mock.calls.length).toBeGreaterThan(0);
      expect(lightmapRt.batchDraw.mock.calls.length).toBe(2);

      // Frames 2..10 with unchanged mapRevision -> 0 map.getSurface calls, still draws the 2 glowing surface lights
      getSurfaceSpy.mockClear();
      for (let frame = 2; frame <= 10; frame++) {
        lightmapRt.batchDraw.mockClear();
        lighting.update({
          dtSec: 1 / 60,
          playerPos: { x: mockPlayer.x, y: mockPlayer.y },
          player: mockPlayer,
          simulatedPlayers: [],
          enemies: [],
          projectiles: [],
          props: [],
          map,
          trauma: 0,
        });
        expect(lightmapRt.batchDraw.mock.calls.length).toBe(2);
      }
      expect(getSurfaceSpy).toHaveBeenCalledTimes(0);

      // Increment mapRevision via setSurface -> invalidates cache immediately on next update
      map.setSurface(10, 8, 'electrified_water');
      lightmapRt.batchDraw.mockClear();
      lighting.update({
        dtSec: 1 / 60,
        playerPos: { x: mockPlayer.x, y: mockPlayer.y },
        player: mockPlayer,
        simulatedPlayers: [],
        enemies: [],
        projectiles: [],
        props: [],
        map,
        trauma: 0,
      });
      expect(getSurfaceSpy.mock.calls.length).toBeGreaterThan(0);
      expect(lightmapRt.batchDraw.mock.calls.length).toBe(3);
    });

    it('raises BIOME_POSTFX_FRAG bloom luma early-out to 0.68 while preserving smoothstep(0.22, 0.48, centerLuma)', () => {
      const frag = getBiomePostFxFragForTest();
      expect(frag).toContain('if (centerLuma > 0.68)');
      expect(frag).toContain('smoothstep(0.22, 0.48, centerLuma)');
    });
  });

  describe('4. ZzfxSynth cached unit-gain procedural AudioBuffer & center-pan skip', () => {
    function createMockWebAudio() {
      const sources: Array<{
        buffer: AudioBuffer | null;
        playbackRate: { value: number };
        onended: (() => void) | null;
        disconnect: ReturnType<typeof vi.fn>;
      }> = [];
      const gains: Array<{
        gain: { value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn> };
        disconnect: ReturnType<typeof vi.fn>;
      }> = [];
      const panners: Array<{
        pan: { value: number };
        disconnect: ReturnType<typeof vi.fn>;
      }> = [];

      const ctx = {
        state: 'running' as AudioContextState,
        currentTime: 2.0,
        sampleRate: 32000,
        destination: { kind: 'destination' },
        resume: vi.fn().mockResolvedValue(undefined),
        createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
          const chData = Array.from({ length: channels }, () => new Float32Array(length));
          return {
            numberOfChannels: channels,
            length,
            sampleRate,
            duration: length / sampleRate,
            getChannelData: (c: number) => chData[c]!,
          } as unknown as AudioBuffer;
        }),
        createBufferSource: vi.fn(() => {
          const src = {
            buffer: null as AudioBuffer | null,
            playbackRate: { value: 1 },
            onended: null as (() => void) | null,
            connect: vi.fn((dest: unknown) => dest),
            disconnect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(() => {
              if (src.onended) src.onended();
            }),
          };
          sources.push(src);
          return src as unknown as AudioBufferSourceNode;
        }),
        createGain: vi.fn(() => {
          const g = {
            gain: {
              value: 1,
              setValueAtTime: vi.fn(),
              linearRampToValueAtTime: vi.fn(),
            },
            connect: vi.fn((dest: unknown) => dest),
            disconnect: vi.fn(),
          };
          gains.push(g);
          return g as unknown as GainNode;
        }),
        createStereoPanner: vi.fn(() => {
          const p = {
            pan: { value: 0 },
            connect: vi.fn((dest: unknown) => dest),
            disconnect: vi.fn(),
          };
          panners.push(p);
          return p as unknown as StereoPannerNode;
        }),
      };

      return { ctx: ctx as unknown as AudioContext, rawCtx: ctx, sources, gains, panners };
    }

    it('synthesizes procedural fallback AudioBuffer only once across 5 plays of the same SfxId, skips createStereoPanner at pan === 0, and disconnects ended nodes', () => {
      const synth = new ZzfxSynth();
      const { ctx, rawCtx, sources, gains, panners } = createMockWebAudio();
      synth.setAudioContextForTest(ctx);

      let nowMs = 5_000;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        nowMs += 250;
        return nowMs;
      });

      // Play procedural fallback 'shoot_pistol' 5 times with pan === 0 (worldX === cameraCenterX)
      for (let i = 0; i < 5; i++) {
        synth.play('shoot_pistol', 440, 440, 270, 270);
      }

      expect(rawCtx.createBuffer).toHaveBeenCalledTimes(1);
      expect(sources.length).toBe(5);
      const firstBuffer = sources[0]!.buffer;
      expect(firstBuffer).not.toBeNull();
      for (let i = 1; i < 5; i++) {
        expect(sources[i]!.buffer).toBe(firstBuffer);
      }

      // pan === 0 must skip StereoPannerNode allocation
      expect(rawCtx.createStereoPanner).toHaveBeenCalledTimes(0);
      expect(panners.length).toBe(0);

      // Non-zero pan still creates a StereoPannerNode and disconnects on end
      synth.play('shoot_pistol', 700, 440, 270, 270);
      expect(rawCtx.createBuffer).toHaveBeenCalledTimes(1);
      expect(rawCtx.createStereoPanner).toHaveBeenCalledTimes(1);
      expect(panners[0]!.pan.value).toBeGreaterThan(0.4);

      sources[5]!.onended?.();
      expect(sources[5]!.disconnect).toHaveBeenCalledTimes(1);
      expect(gains[5]!.disconnect).toHaveBeenCalledTimes(1);
      expect(panners[0]!.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
