import { WorldSim, type SimSummonState } from '@ashen-pact/shared';
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('../src/art/cutout-rig-math.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/art/cutout-rig-math.js')>();
  return {
    ...actual,
    evaluateRigPose: vi.fn(actual.evaluateRigPose),
  };
});

import {
  blendRigPoseSnapshots,
  cloneRigPoseSnapshot,
  createBackAccessorySpringState,
  createEmptyRigPoseSnapshot,
  createWeaponRecoilSpringState,
  evaluateRigPose,
  type RigAnimState,
  stepBackAccessorySpring,
  stepBackAccessorySpringInPlace,
  stepMeleeLungeGlideOffset,
  stepMeleeLungeGlideOffsetInPlace,
  stepWeaponRecoilSpring,
  stepWeaponRecoilSpringInPlace,
} from '../src/art/cutout-rig-math.js';
import { CutoutRig } from '../src/art/cutout-rig.js';
import {
  COAL_GOLEM_RIG_DEF,
  FROST_BAT_RIG_DEF,
  GREEN_SLIME_RIG_DEF,
  RIG_DEFS_BY_ID,
  VANGUARD_RIG_DEF,
} from '../src/art/rig-defs.js';
import { createPortalAnimState, type DoorShaderSprite } from '../src/fx/portal-door-shaders.js';
import {
  setBlendModeIfChanged,
  setDepthIfChanged,
  syncEnemyRigsImpl,
  syncFragFuseWheelsImpl,
  syncProjectilesAndPickupsImpl,
  updatePlayerOverheadUiImpl,
} from '../src/scenes/game-scene/entity-sync.js';
import { syncDoorVisualsImpl } from '../src/scenes/game-scene/portal-door-sync.js';
import {
  syncRoomEntitiesImpl,
  syncSummonCutoutVisuals,
} from '../src/scenes/game-scene/room-entities-sync.js';

function createMockSprite(initialTex = '') {
  const s = {
    key: initialTex,
    texture: { key: initialTex },
    frame: { name: undefined as string | undefined },
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    depth: 0,
    blendMode: 0,
    visible: true,
    active: true,
    currentTint: null as number | null,
    pipeline: null as { name: string } | null,
    setOrigin: vi.fn(() => s),
    setScale: vi.fn((sx: number, sy?: number) => {
      s.scaleX = sx;
      s.scaleY = sy ?? sx;
      return s;
    }),
    setPosition: vi.fn((x: number, y: number) => {
      s.x = x;
      s.y = y;
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
    setBlendMode: vi.fn((m: number) => {
      s.blendMode = m;
      return s;
    }),
    setTexture: vi.fn((tex: string, frame?: string) => {
      s.key = tex;
      s.texture.key = tex;
      s.frame.name = frame;
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
    setTint: vi.fn((c: number) => {
      s.currentTint = c;
      return s;
    }),
    setTintFill: vi.fn((c: number) => {
      s.currentTint = c;
      return s;
    }),
    clearTint: vi.fn(() => {
      s.currentTint = null;
      return s;
    }),
    setDisplaySize: vi.fn(() => s),
    setPipeline: vi.fn((name: string) => {
      s.pipeline = { name };
      return s;
    }),
    resetPipeline: vi.fn(() => {
      s.pipeline = null;
      return s;
    }),
    destroy: vi.fn(),
  };
  return s;
}

function createMockContainer(x = 0, y = 0) {
  const c = {
    x,
    y,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    alpha: 1,
    depth: 0,
    visible: true,
    add: vi.fn(() => c),
    addAt: vi.fn(() => c),
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

function createMockText(initialText = '', initialColor = '#ffffff') {
  const style = { color: initialColor, wordWrapWidth: undefined as number | undefined };
  const t = {
    text: initialText,
    style,
    x: 0,
    y: 0,
    alpha: 1,
    depth: 0,
    visible: true,
    setText: vi.fn((v: string) => {
      t.text = v;
      return t;
    }),
    setColor: vi.fn((c: string) => {
      style.color = c;
      return t;
    }),
    setOrigin: vi.fn(() => t),
    setScale: vi.fn(() => t),
    setAlpha: vi.fn((a: number) => {
      t.alpha = a;
      return t;
    }),
    setPosition: vi.fn((x: number, y: number) => {
      t.x = x;
      t.y = y;
      return t;
    }),
    setDepth: vi.fn((d: number) => {
      t.depth = d;
      return t;
    }),
    setVisible: vi.fn((v: boolean) => {
      t.visible = v;
      return t;
    }),
    destroy: vi.fn(),
  };
  return t;
}

describe('Task 3 — Zero-Alloc CutoutRig, setDepth Sort Guard, Frustum Culling & Projectile Spec Caching', () => {
  describe('1. Zero-Alloc evaluateRigPose & blendRigPoseSnapshots', () => {
    it('mutates out snapshot in-place with identical transforms across all states & archetypes while keeping omitted-out isolated', () => {
      const out = createEmptyRigPoseSnapshot();
      const torsoRef = out.parts.torso;
      const weaponRef = out.parts.weapon;

      const states: RigAnimState[] = [
        'idle',
        'run',
        'attack',
        'hurt',
        'dash',
        'cast',
        'downed',
        'revive',
      ];
      const defs = [
        VANGUARD_RIG_DEF,
        GREEN_SLIME_RIG_DEF,
        FROST_BAT_RIG_DEF,
        COAL_GOLEM_RIG_DEF,
        RIG_DEFS_BY_ID.spore_bomber!,
      ];

      for (const def of defs) {
        for (const animState of states) {
          const params = {
            def,
            animState,
            animTime: 0.73,
            localAim: 0.42,
            moveLeanRad: 0.09,
            recoilSpring: { displacement: 1.4, velocity: -3.2, angleKick: -0.08, angularVel: 0.4 },
            backSpring: {
              angle: -0.11,
              angularVel: 0.25,
              offsetX: -1.1,
              velX: 0.5,
              offsetY: -0.4,
              velY: 0.2,
            },
            meleeSwingOffsetRad: 0.18,
            telegraphProgress: 0.45,
            reviveProgress: 0.55,
            phaseSeed: 0.37,
          };

          const fresh = evaluateRigPose(params);
          const inPlace = evaluateRigPose(params, out);

          expect(inPlace).toBe(out);
          expect(inPlace.parts.torso).toBe(torsoRef);
          expect(inPlace.parts.weapon).toBe(weaponRef);
          expect(inPlace).toEqual(fresh);
        }
      }

      // Calling evaluateRigPose without `out` returns distinct isolated snapshots
      const snapA = evaluateRigPose({
        def: VANGUARD_RIG_DEF,
        animState: 'idle',
        animTime: 0.2,
        localAim: 0,
        moveLeanRad: 0,
        recoilSpring: createWeaponRecoilSpringState(),
        backSpring: createBackAccessorySpringState(),
        meleeSwingOffsetRad: 0,
        telegraphProgress: 0,
        reviveProgress: 0,
        phaseSeed: 0,
      });
      const torsoRotBefore = snapA.parts.torso.rotation;
      const snapB = evaluateRigPose({
        def: VANGUARD_RIG_DEF,
        animState: 'dash',
        animTime: 0.8,
        localAim: 0.6,
        moveLeanRad: 0.14,
        recoilSpring: createWeaponRecoilSpringState(),
        backSpring: createBackAccessorySpringState(),
        meleeSwingOffsetRad: 0,
        telegraphProgress: 0,
        reviveProgress: 0,
        phaseSeed: 0,
      });
      expect(snapA).not.toBe(snapB);
      expect(snapA.parts.torso).not.toBe(snapB.parts.torso);
      expect(snapA.parts.torso.rotation).toBe(torsoRotBefore);

      // blendRigPoseSnapshots & cloneRigPoseSnapshot mutate `out` in-place and match fresh values
      const blendOut = createEmptyRigPoseSnapshot();
      const blendTorsoRef = blendOut.parts.torso;
      for (const alpha of [0, 0.5, 1]) {
        const freshBlend = blendRigPoseSnapshots(snapA, snapB, alpha);
        const inPlaceBlend = blendRigPoseSnapshots(snapA, snapB, alpha, blendOut);
        expect(inPlaceBlend).toBe(blendOut);
        expect(inPlaceBlend.parts.torso).toBe(blendTorsoRef);
        expect(inPlaceBlend).toEqual(freshBlend);
      }

      const cloneOut = createEmptyRigPoseSnapshot();
      const cloned = cloneRigPoseSnapshot(snapB, cloneOut);
      expect(cloned).toBe(cloneOut);
      expect(cloned).toEqual(snapB);
    });

    it('constructs 0 new Map() instances across 100 evaluateRigPose(params, out) calls', () => {
      const out = createEmptyRigPoseSnapshot();
      const params = {
        def: VANGUARD_RIG_DEF,
        animState: 'run' as const,
        animTime: 0.1,
        localAim: 0.25,
        moveLeanRad: 0.08,
        recoilSpring: createWeaponRecoilSpringState(),
        backSpring: createBackAccessorySpringState(),
        meleeSwingOffsetRad: 0,
        telegraphProgress: 0,
        reviveProgress: 0,
        phaseSeed: 0.5,
      };

      const mapSpy = vi.spyOn(globalThis, 'Map');
      try {
        for (let i = 0; i < 100; i++) {
          params.animTime += 1 / 60;
          evaluateRigPose(params, out);
        }
        expect(mapSpy).toHaveBeenCalledTimes(0);
      } finally {
        mapSpy.mockRestore();
      }
    });

    it('steps backAccessory, weaponRecoil, and meleeLungeGlide in-place with identical math to pure helpers', () => {
      const pureBack = createBackAccessorySpringState();
      const inPlaceBack = createBackAccessorySpringState();
      const backParams = {
        moveVx: 150,
        moveVy: -40,
        bodyBounceVelY: -10,
        facingSign: 1,
        isDashing: true,
        animState: 'dash' as const,
        dtSec: 1 / 60,
      };
      const nextPureBack = stepBackAccessorySpring(pureBack, backParams);
      const retBack = stepBackAccessorySpringInPlace(inPlaceBack, backParams);
      expect(retBack).toBe(inPlaceBack);
      expect(inPlaceBack).toEqual(nextPureBack);
      expect(pureBack.offsetX).toBe(0);

      const pureRecoil = { displacement: 4.5, velocity: 12, angleKick: -0.2, angularVel: -1.1 };
      const inPlaceRecoil = { ...pureRecoil };
      const nextPureRecoil = stepWeaponRecoilSpring(pureRecoil, 1 / 60);
      const retRecoil = stepWeaponRecoilSpringInPlace(inPlaceRecoil, 1 / 60);
      expect(retRecoil).toBe(inPlaceRecoil);
      expect(inPlaceRecoil).toEqual(nextPureRecoil);
      expect(pureRecoil.displacement).toBe(4.5);

      const pureLunge = stepMeleeLungeGlideOffset(24, -16, 1 / 60);
      const inPlaceLunge = { x: 24, y: -16 };
      const retLunge = stepMeleeLungeGlideOffsetInPlace(inPlaceLunge, 1 / 60);
      expect(retLunge).toBe(inPlaceLunge);
      expect(inPlaceLunge).toEqual(pureLunge);
    });

    it('caches tint state and silhouette inversion on CutoutRig so steady-state frames emit 0 tint calls', () => {
      const createdSprites: Array<ReturnType<typeof createMockSprite>> = [];
      const mockScene = {
        add: {
          container: (x = 0, y = 0) => createMockContainer(x, y),
          sprite: (_x: number, _y: number, key: string) => {
            const s = createMockSprite(key);
            createdSprites.push(s);
            return s;
          },
        },
      };

      const rig = new CutoutRig(mockScene as never, 120, 140, VANGUARD_RIG_DEF);
      const torso = createdSprites.find((s) => s.key.includes('torso'))!;
      const legLeft = createdSprites.find((s) => s.key.includes('legLeft'))!;

      // Chill applied on frame 1 -> tints legs once; frames 2..5 -> 0 additional setTint/clearTint calls
      rig.setElementalStatusTint(0xcfe8ee);
      rig.update(1 / 60);
      expect(legLeft.currentTint).toBe(0xcfe8ee);
      legLeft.setTint.mockClear();
      torso.clearTint.mockClear();

      for (let f = 0; f < 5; f++) {
        rig.update(1 / 60);
      }
      expect(legLeft.setTint).not.toHaveBeenCalled();
      expect(torso.clearTint).not.toHaveBeenCalled();

      // Silhouette inversion during Beat 1 -> applies setTintFill once, skips repeated identical calls
      rig.applySilhouetteInversion(0x141019);
      expect(torso.setTintFill).toHaveBeenCalledTimes(1);
      rig.applySilhouetteInversion(0x141019);
      rig.applySilhouetteInversion(0x141019);
      expect(torso.setTintFill).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. setDepthIfChanged & setBlendModeIfChanged DisplayList Sort Guards', () => {
    it('skips setDepth when sprite.depth already matches and invokes setDepth when depth changes', () => {
      const sprite = createMockSprite('fx_enemy_bullet_glow');
      sprite.depth = 59;
      sprite.setDepth.mockClear();

      setDepthIfChanged(sprite, 59);
      expect(sprite.setDepth).not.toHaveBeenCalled();

      setDepthIfChanged(sprite, 60);
      expect(sprite.setDepth).toHaveBeenCalledTimes(1);
      expect(sprite.setDepth).toHaveBeenCalledWith(60);
      expect(sprite.depth).toBe(60);

      setDepthIfChanged(sprite, 60);
      expect(sprite.setDepth).toHaveBeenCalledTimes(1);
    });

    it('skips setBlendMode when blendMode already matches and invokes setBlendMode on change', () => {
      const sprite = createMockSprite('fx_light_radial');
      sprite.blendMode = 1;
      sprite.setBlendMode.mockClear();

      setBlendModeIfChanged(sprite, 1);
      expect(sprite.setBlendMode).not.toHaveBeenCalled();

      setBlendModeIfChanged(sprite, 0);
      expect(sprite.setBlendMode).toHaveBeenCalledTimes(1);
      expect(sprite.setBlendMode).toHaveBeenCalledWith(0);
    });

    it('guards summon shadow, base, and head setDepth across steady-state frames in syncSummonCutoutVisuals', () => {
      const created: Array<ReturnType<typeof createMockSprite>> = [];
      const mockScene = {
        add: {
          sprite: vi.fn((_x: number, _y: number, tex: string) => {
            const s = createMockSprite(tex);
            created.push(s);
            return s;
          }),
        },
        summonVisuals: new Map(),
        summonSpritePool: [],
        groundHazardGraphics: undefined,
      };

      const summon: SimSummonState = {
        id: 7,
        kind: 'tesla_turret',
        ownerPlayerId: 1,
        x: 240,
        y: 220,
        hp: 40,
        maxHp: 40,
        ttlSec: 8,
        auraRadius: 96,
        tickTimer: 0.4,
      };

      syncSummonCutoutVisuals(mockScene as never, [summon], 1, 0.8);
      const vis = mockScene.summonVisuals.get(7)!;
      expect(vis).toBeDefined();

      vis.shadow.setDepth.mockClear();
      vis.base.setDepth.mockClear();
      vis.head!.setDepth.mockClear();

      for (let frame = 2; frame <= 6; frame++) {
        syncSummonCutoutVisuals(mockScene as never, [summon], 1, 1 / 60);
      }
      expect(vis.shadow.setDepth).not.toHaveBeenCalled();
      expect(vis.base.setDepth).not.toHaveBeenCalled();
      expect(vis.head!.setDepth).not.toHaveBeenCalled();
    });
  });

  describe('3. Projectile Spec Caching & Overhead UI Guard in entity-sync', () => {
    it('does NOT call entry.glowSprite.setDepth, entry.sprite.setTexture, or resolveProjectileRenderSpec on frames 2-10 of an unchanged bullet', () => {
      const sim = new WorldSim({
        seed: 12345,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
      });
      sim.projectiles.push({
        id: 42,
        ownerId: 99,
        team: 'enemy',
        weaponId: 'enemy_lance',
        bulletShape: 'lance',
        x: 320,
        y: 260,
        prevX: 316,
        prevY: 260,
        vx: 220,
        vy: 0,
        angle: 0,
        radius: 6,
        damage: 2,
        critChance: 0,
        knockback: 0,
        ttlSec: 2,
        pierceCount: 0,
        bounceCount: 0,
        amplifiedByShield: false,
        hitTargetIds: [],
      });

      let elapsed = 0.5;
      const mockScene = {
        transport: {
          getSim: () => sim,
          getInterpolatedProjectilePos: (
            b: { x: number; y: number },
            out: { x: number; y: number },
          ) => {
            out.x = b.x;
            out.y = b.y;
            return out;
          },
          getInterpolatedPickupPos: (
            p: { x: number; y: number },
            out: { x: number; y: number },
          ) => {
            out.x = p.x;
            out.y = p.y;
            return out;
          },
        },
        cameras: { main: { worldView: { x: 0, y: 0, width: 960, height: 540 } } },
        lighting: { getElapsedSec: () => elapsed, isLightmapVisible: () => true },
        add: {
          sprite: vi.fn((_x: number, _y: number, tex: string, frame?: string) => {
            const s = createMockSprite(tex);
            s.frame.name = frame;
            return s;
          }),
          image: vi.fn((_x: number, _y: number, tex: string) => createMockSprite(tex)),
        },
        projectileSprites: new Map(),
        projectileSpritePool: [],
        pickupSprites: new Map(),
        pickupSpritePool: [],
        activeProjIds: new Set<number>(),
        activePickupIds: new Set<number>(),
        entityPosScratch: { x: 0, y: 0 },
      };

      // Frame 1: initial bind & render
      syncProjectilesAndPickupsImpl.call(mockScene as never);
      const entry = mockScene.projectileSprites.get(42) as {
        sprite: ReturnType<typeof createMockSprite>;
        glowSprite: ReturnType<typeof createMockSprite>;
      };
      expect(entry).toBeDefined();
      expect(entry.sprite.depth).toBe(60);
      expect(entry.glowSprite.depth).toBe(59);

      entry.glowSprite.setDepth.mockClear();
      entry.sprite.setDepth.mockClear();
      entry.sprite.setTexture.mockClear();

      // Frames 2-10: bullet moves across the room with unchanged spec inputs
      for (let frame = 2; frame <= 10; frame++) {
        sim.projectiles[0]!.x += 4;
        elapsed += 1 / 60;
        syncProjectilesAndPickupsImpl.call(mockScene as never);
      }

      expect(entry.glowSprite.setDepth).not.toHaveBeenCalled();
      expect(entry.sprite.setDepth).not.toHaveBeenCalled();
      expect(entry.sprite.setTexture).not.toHaveBeenCalled();
      expect(entry.sprite.x).toBe(320 + 9 * 4);
    });

    it('guards emoteBg.clear() when no emote is active and clears once on emote expiry', () => {
      const sim = new WorldSim({
        seed: 777,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
      });
      const nameLabel = createMockText();
      const emoteLabel = createMockText();
      const emoteBg = {
        clear: vi.fn(),
        fillStyle: vi.fn(),
        lineStyle: vi.fn(),
        fillRoundedRect: vi.fn(),
        strokeRoundedRect: vi.fn(),
      };
      const mockScene = {
        transport: { getSim: () => sim },
        cameras: { main: { worldView: { x: 0, y: 0, width: 960, height: 540 } } },
      };

      // Idle frames without emote -> 0 clear() calls
      sim.player.emoteTimer = 0;
      updatePlayerOverheadUiImpl.call(
        mockScene as never,
        sim.player,
        200,
        200,
        nameLabel as never,
        emoteLabel as never,
        emoteBg as never,
      );
      updatePlayerOverheadUiImpl.call(
        mockScene as never,
        sim.player,
        200,
        200,
        nameLabel as never,
        emoteLabel as never,
        emoteBg as never,
      );
      expect(emoteBg.clear).not.toHaveBeenCalled();

      // Emote active -> draws & clears each active frame
      sim.player.emoteTimer = 1.0;
      sim.player.emoteId = 1;
      updatePlayerOverheadUiImpl.call(
        mockScene as never,
        sim.player,
        200,
        200,
        nameLabel as never,
        emoteLabel as never,
        emoteBg as never,
      );
      expect(emoteBg.clear).toHaveBeenCalledTimes(1);

      // Emote expires -> clears once, then stays quiescent
      emoteBg.clear.mockClear();
      sim.player.emoteTimer = 0;
      updatePlayerOverheadUiImpl.call(
        mockScene as never,
        sim.player,
        200,
        200,
        nameLabel as never,
        emoteLabel as never,
        emoteBg as never,
      );
      expect(emoteBg.clear).toHaveBeenCalledTimes(1);

      updatePlayerOverheadUiImpl.call(
        mockScene as never,
        sim.player,
        200,
        200,
        nameLabel as never,
        emoteLabel as never,
        emoteBg as never,
      );
      expect(emoteBg.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Offscreen Enemy Frustum Culling & Offscreen Door Culling', () => {
    it('hides alive enemy 300px outside worldView and skips evaluateRigPose via advanceClockOnly, then restores visible & pose on entering worldView + 64px', () => {
      const sim = new WorldSim({
        seed: 2026,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
      });
      sim.stressTestActive = false;

      // Ensure a single alive enemy positioned 300px right of worldView (0..960 -> x = 1260)
      sim.enemies.length = 0;
      const enemy = sim.spawnEnemy('goblin_shooter', 1260, 270, true);
      enemy.aiState = 'chase';
      enemy.vx = -80;
      enemy.vy = 0;

      const mockScene = {
        transport: {
          getSim: () => sim,
          getInterpolatedEnemyPos: (
            e: { x: number; y: number },
            out: { x: number; y: number },
          ) => {
            out.x = e.x;
            out.y = e.y;
            return out;
          },
        },
        cameras: { main: { worldView: { x: 0, y: 0, width: 960, height: 540 } } },
        camFocusX: 480,
        camFocusY: 270,
        add: {
          container: vi.fn((x = 0, y = 0) => createMockContainer(x, y)),
          sprite: vi.fn((_x: number, _y: number, tex: string) => createMockSprite(tex)),
        },
        enemyRigs: new Map<number, CutoutRig>(),
        activeEnemyIds: new Set<number>(),
        entityPosScratch: { x: 0, y: 0 },
        resolveEnemyStatusTint: () => null,
        fx: {
          spawnFootstepDust: vi.fn(),
          bossKillSequenceState: null,
        },
      };

      const evalMock = vi.mocked(evaluateRigPose);
      evalMock.mockClear();

      // Frame 1: enemy is at x = 1260 (300px outside 0..960 worldView)
      syncEnemyRigsImpl.call(mockScene as never, 1 / 60);
      const rig = mockScene.enemyRigs.get(enemy.id)!;
      expect(rig).toBeDefined();
      expect(rig.container.visible).toBe(false);
      expect(evalMock).not.toHaveBeenCalled();
      const offscreenAnimTime = rig.getAnimTime();
      expect(offscreenAnimTime).toBeGreaterThan(0);

      // Frame 2: still offscreen -> advances clock without evaluateRigPose
      syncEnemyRigsImpl.call(mockScene as never, 1 / 60);
      expect(rig.container.visible).toBe(false);
      expect(evalMock).not.toHaveBeenCalled();
      expect(rig.getAnimTime()).toBeGreaterThan(offscreenAnimTime);

      // Frame 3: enemy enters worldView + 64px (x = 960 + 64 = 1024 <= 960 + 72)
      enemy.x = 960 + 64;
      syncEnemyRigsImpl.call(mockScene as never, 1 / 60);
      expect(rig.container.visible).toBe(true);
      expect(evalMock).toHaveBeenCalledTimes(1);
    });

    it('frustum-culls offscreen door barrier uniform & mote updates when >80px outside worldView and restores when in view', () => {
      const sim = new WorldSim({
        seed: 4040,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
      });
      sim.doors = [
        {
          dir: 'E',
          x: 1120,
          y: 270,
          locked: true,
          targetRoomId: 2,
          targetRoomType: 'combat',
        },
      ];

      const mockScene = {
        game: { renderer: null },
        transport: { getSim: () => sim },
        cameras: { main: { worldView: { x: 0, y: 0, width: 960, height: 540 } } },
        lighting: { isLightmapVisible: () => true, spawnTransientLight: vi.fn() },
        add: {
          sprite: vi.fn((_x: number, _y: number, tex: string) => createMockSprite(tex)),
          image: vi.fn((_x: number, _y: number, tex: string) => createMockSprite(tex)),
          text: vi.fn((_x: number, _y: number, txt: string) => createMockText(txt)),
        },
        portalDoorAnimClockSec: 1.5,
        portalAnimState: createPortalAnimState(),
        lastDoorRoomKey: `${sim.currentFloor}_${sim.currentRoomId}`,
        activeDoorKeys: new Set<string>(),
        doorSprites: new Map(),
      };

      // Frame 1: door at x = 1120 is 160px outside 0..960 (> 80px margin) and not in transition burst
      syncDoorVisualsImpl.call(mockScene as never, 1 / 60, null);
      const key = `${sim.currentFloor}_${sim.currentRoomId}_E`;
      const entry = mockScene.doorSprites.get(key)!;
      expect(entry).toBeDefined();
      expect(entry.barrierSprite.visible).toBe(false);
      expect(entry.moteSprites.every((m: { visible: boolean }) => !m.visible)).toBe(true);

      // Frame 2: camera pans so door enters worldView + 80px (worldView.x = 100 -> right = 1060, +80 = 1140 >= 1120)
      mockScene.cameras.main.worldView.x = 100;
      syncDoorVisualsImpl.call(mockScene as never, 1 / 60, null);
      expect(entry.barrierSprite.visible).toBe(true);
      expect(entry.moteSprites.some((m: { visible: boolean }) => m.visible)).toBe(true);
      void (entry.barrierSprite as unknown as DoorShaderSprite).__doorUniforms;
    });

    it('re-evaluates projectile render spec on pool recycle, skips syncFragFuseWheelsImpl without frag_launcher, and guards secret_challenge_crystal setColor', () => {
      // 1. Stateless mock fallback on setDepthIfChanged (no .depth property)
      const stateless = { setDepth: vi.fn() };
      setDepthIfChanged(stateless, 41.5);
      setDepthIfChanged(stateless, 41.5);
      expect(stateless.setDepth).toHaveBeenCalledTimes(1);
      setDepthIfChanged(stateless, 42);
      expect(stateless.setDepth).toHaveBeenCalledTimes(2);

      // 2. Projectile pool recycle rebinds spec cleanly for a new bullet ID & weapon
      const sim = new WorldSim({
        seed: 5150,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
      });
      sim.projectiles.push({
        id: 42,
        ownerId: 99,
        team: 'enemy',
        weaponId: 'enemy_lance',
        bulletShape: 'lance',
        x: 300,
        y: 260,
        prevX: 300,
        prevY: 260,
        vx: 180,
        vy: 0,
        angle: 0,
        radius: 6,
        damage: 2,
        critChance: 0,
        knockback: 0,
        ttlSec: 2,
        pierceCount: 0,
        bounceCount: 0,
        amplifiedByShield: false,
        hitTargetIds: [],
      });

      const projScene = {
        transport: {
          getSim: () => sim,
          getInterpolatedProjectilePos: (
            b: { x: number; y: number },
            out: { x: number; y: number },
          ) => {
            out.x = b.x;
            out.y = b.y;
            return out;
          },
          getInterpolatedPickupPos: (
            p: { x: number; y: number },
            out: { x: number; y: number },
          ) => {
            out.x = p.x;
            out.y = p.y;
            return out;
          },
        },
        cameras: { main: { worldView: { x: 0, y: 0, width: 960, height: 540 } } },
        lighting: { getElapsedSec: () => 0.5, isLightmapVisible: () => true },
        add: {
          sprite: vi.fn((_x: number, _y: number, tex: string, frame?: string) => {
            const s = createMockSprite(tex);
            s.frame.name = frame;
            return s;
          }),
          image: vi.fn((_x: number, _y: number, tex: string) => createMockSprite(tex)),
        },
        projectileSprites: new Map(),
        projectileSpritePool: [],
        pickupSprites: new Map(),
        pickupSpritePool: [],
        activeProjIds: new Set<number>(),
        activePickupIds: new Set<number>(),
        entityPosScratch: { x: 0, y: 0 },
      };

      syncProjectilesAndPickupsImpl.call(projScene as never);
      const pooledCandidate = projScene.projectileSprites.get(42)!;
      sim.projectiles.length = 0;
      syncProjectilesAndPickupsImpl.call(projScene as never);
      expect(projScene.projectileSpritePool).toHaveLength(1);

      sim.projectiles.push({
        id: 99,
        ownerId: sim.player.id,
        team: 'player',
        weaponId: 'scrap_shotgun',
        x: 340,
        y: 260,
        prevX: 340,
        prevY: 260,
        vx: 300,
        vy: 0,
        angle: 0,
        radius: 4,
        damage: 5,
        critChance: 0,
        knockback: 0,
        ttlSec: 1.5,
        pierceCount: 0,
        bounceCount: 0,
        amplifiedByShield: false,
        hitTargetIds: [],
      });
      syncProjectilesAndPickupsImpl.call(projScene as never);
      const rebound = projScene.projectileSprites.get(99)!;
      expect(rebound).toBe(pooledCandidate);
      expect(rebound.textureKey).toBe('proj_player_pellet');
      expect(rebound.sprite.depth).toBe(41);

      // 3. syncFragFuseWheelsImpl skips projectile scan unless frag_launcher is held
      sim.player.weaponSlots = ['knight_sword', 'auto_rifle'];
      const fuseScene = {
        fragFuseWheelSprites: new Map(),
        fragFuseWheelFreePool: [],
        fragFuseWheelSyncGen: 0,
        lighting: { getElapsedSec: () => 1.0 },
        add: { sprite: vi.fn((_x: number, _y: number, tex: string) => createMockSprite(tex)) },
      };
      syncFragFuseWheelsImpl.call(fuseScene as never, sim);
      expect(fuseScene.fragFuseWheelSyncGen).toBe(0);

      // 4. secret_challenge_crystal world label does NOT call setColor on steady-state frames
      sim.inHub = false;
      sim.hubStatues = [];
      sim.chests = [];
      sim.worldItems = [];
      sim.pings = [];
      sim.summons = [];
      sim.npcEntities = [
        {
          id: 501,
          kind: 'secret_challenge_crystal',
          x: 620,
          y: 270,
          interacted: false,
        },
      ];
      sim.player.x = 120;
      sim.player.y = 270;

      const roomScene = {
        transport: { getSim: () => sim },
        cameras: { main: { worldView: { x: 0, y: 0, width: 960, height: 540 } } },
        lighting: { isLightmapVisible: () => true, getElapsedSec: () => 1.0 },
        fullMapOpen: false,
        pauseModalOpen: false,
        settingsModal: undefined,
        invitePanelVisible: false,
        interactPromptState: { currentTargetKey: null, alpha: 0, cachedSpec: null },
        currentInteractTarget: null,
        interactPromptVisuals: undefined,
        interactHighlightGraphics: undefined,
        interactFootRingGraphics: undefined,
        summonVisuals: new Map(),
        summonSpritePool: [],
        hubStatueRigs: new Map(),
        hubGuideTexts: [],
        activePingIds: new Set<number>(),
        pingVisuals: new Map(),
        activeChestIds: new Set<number>(),
        chestSprites: new Map(),
        chestGlowSprites: new Map(),
        chestSparkleSprites: new Map(),
        activeWorldItemIds: new Set<number>(),
        worldItemSprites: new Map(),
        activeNpcIds: new Set<number>(),
        npcVisuals: new Map(),
        syncPortalVisuals: vi.fn(),
        syncDoorVisuals: vi.fn(),
        add: {
          sprite: vi.fn((_x: number, _y: number, tex: string) => createMockSprite(tex)),
          image: vi.fn((_x: number, _y: number, tex: string) => createMockSprite(tex)),
          text: vi.fn(
            (_x: number, _y: number, txt: string, style?: { color?: string }) =>
              createMockText(txt, style?.color ?? '#ffffff'),
          ),
        },
      };

      syncRoomEntitiesImpl.call(roomScene as never, 1 / 60);
      const crystalEntry = roomScene.npcVisuals.get(501) as {
        label: ReturnType<typeof createMockText>;
      };
      expect(crystalEntry).toBeDefined();
      crystalEntry.label.setColor.mockClear();
      crystalEntry.label.setText.mockClear();

      for (let f = 0; f < 5; f++) {
        syncRoomEntitiesImpl.call(roomScene as never, 1 / 60);
      }
      expect(crystalEntry.label.setColor).not.toHaveBeenCalled();
      expect(crystalEntry.label.setText).not.toHaveBeenCalled();
    });
  });
});
