import { i18n, WorldSim } from '@ashen-pact/shared';
import { vi } from 'vitest';
import { CombatFxManager, type PooledParticle } from '../../src/fx/combat-fx.js';

export function createMockSprite() {
  const state = {
    textureKey: '',
    frame: 0 as number | string | undefined,
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    depth: 45,
    visible: false,
    active: false,
    blendMode: 'NORMAL' as string | number,
    tint: null as number | null,
  };
  return {
    state,
    get depth() {
      return state.depth;
    },
    get visible() {
      return state.visible;
    },
    get rotation() {
      return state.rotation;
    },
    set rotation(v: number) {
      state.rotation = v;
    },
    get scaleX() {
      return state.scaleX;
    },
    setTexture: vi.fn((key: string, frame?: number | string) => {
      state.textureKey = key;
      if (frame !== undefined) state.frame = frame;
    }),
    setFrame: vi.fn((frame: number | string) => {
      state.frame = frame;
    }),
    setPosition: vi.fn((x: number, y: number) => {
      state.x = x;
      state.y = y;
    }),
    setRotation: vi.fn((r: number) => {
      state.rotation = r;
    }),
    setScale: vi.fn((sx: number, sy?: number) => {
      state.scaleX = sx;
      state.scaleY = sy ?? sx;
    }),
    setAlpha: vi.fn((a: number) => {
      state.alpha = a;
    }),
    setDepth: vi.fn((d: number) => {
      state.depth = d;
    }),
    setVisible: vi.fn((v: boolean) => {
      state.visible = v;
    }),
    setActive: vi.fn((v: boolean) => {
      state.active = v;
    }),
    setBlendMode: vi.fn((m: string | number) => {
      state.blendMode = m;
    }),
    setTint: vi.fn((t: number) => {
      state.tint = t;
    }),
    clearTint: vi.fn(() => {
      state.tint = null;
    }),
  };
}

export function createHeadlessFxManager(particleSlots = 64): CombatFxManager {
  const mgr = Object.create(CombatFxManager.prototype) as CombatFxManager;
  Object.assign(mgr, {
    particlePool: [] as PooledParticle[],
    damagePool: [],
    decalPool: [],
    afterimagePool: [],
    ambientPool: [],
    lightningPool: [],
    lightningGraphics: {
      clear: vi.fn(),
      lineStyle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
    },
    underActorGraphics: {
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      lineStyle: vi.fn(),
      strokeCircle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      arc: vi.fn(),
      fillTriangle: vi.fn(),
    },
    weaponRibbonGraphics: {
      clear: vi.fn(),
      fillStyle: vi.fn(),
      lineStyle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      fillTriangle: vi.fn(),
    },
    lastHitSparkTimeByTargetId: new Map<number, number>(),
    activePerimeterRings: [],
    activeArcRibbons: [],
    perimeterRingFreePool: [],
    arcRibbonFreePool: [],
    localPlayerPos: { x: 0, y: 0 },
    muzzleVariantCounter: 0,
    muzzleFlipCounter: 0,
    decalWriteCursor: 0,
    activeDecalCount: 0,
    hitStopRemainingMs: 0,
    bossKillSlowMoTimer: 0,
    bossKillFlashTimer: 0,
    trauma: 0,
    shakeTime: 0,
    popupSpreadIndex: 0,
    currentBiome: 1,
    allowFreezeAmbientMotion: false,
    torchPositions: [],
    totalHitStopsTriggered: 0,
    totalShakesTriggered: 0,
    totalSparksSpawned: 0,
    totalDamagePopupsSpawned: 0,
    totalDecalsSpawned: 0,
    totalAfterimagesSpawned: 0,
    activeReactionBanner: null,
    activeWorldReactionPopupSlot: null,
  });

  for (let i = 0; i < particleSlots; i++) {
    const sprite = createMockSprite();
    const shadowSprite = createMockSprite();
    mgr.particlePool.push({
      sprite: sprite as never,
      shadowSprite: shadowSprite as never,
      textureKey: 'fx_spark',
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      vr: 0,
      age: 0,
      ttl: 0.3,
      startScale: 1,
      endScale: 1,
      startAlpha: 1,
      gravityY: 0,
      damping: 0,
      blendMode: 'ADD',
      easeCurve: 'linear',
      scaleRatioY: 1,
      alignToVelocity: false,
      hasGroundShadow: false,
      frameCount: 1,
      preserveFlipbookAlpha: false,
    });
  }
  return mgr;
}

export function createTestCombatFx(options?: { localPlayerPos?: { x: number; y: number } }): { fx: CombatFxManager } {
  const fx = createHeadlessFxManager(64);
  if (options?.localPlayerPos) {
    fx.setLocalPlayerPosition(options.localPlayerPos.x, options.localPlayerPos.y);
  }
  for (let i = 0; i < 32; i++) {
    const sprite = createMockSprite();
    fx.decalPool.push({
      sprite: sprite as never,
      textureKey: 'fx_decal_scorch',
      active: false,
    });
  }
  return { fx };
}

export function createTeleportTestScene(): {
  scene: Record<string, unknown>;
  fx: Record<string, unknown>;
  sim: WorldSim;
} {
  i18n.setLocale('vi');
  const sim = new WorldSim({ seed: 7777, biome: 1 });
  sim.enterRoom(sim.dungeon.startRoomId);
  const startRoom = sim.getCurrentRoom()!;
  startRoom.cleared = true;
  sim.enemies.length = 0;

  if (sim.currentRoomId === 2) {
    const otherRoom = sim.dungeon.rooms.find((r) => r && r.id !== 2);
    if (otherRoom) {
      sim.enterRoom(otherRoom.id);
      const cur = sim.getCurrentRoom();
      if (cur) cur.cleared = true;
      sim.enemies.length = 0;
    }
  }

  if (sim.dungeon.rooms[2]) {
    sim.dungeon.rooms[2].discovery = 'visited';
    sim.dungeon.rooms[2].cleared = true;
  }
  if (sim.doors) {
    for (const d of sim.doors) {
      d.locked = false;
    }
  }

  const fx: Record<string, unknown> = {
    lastTeleportFoldPos: undefined as { x: number; y: number } | undefined,
    lastFloatingAlertText: undefined as string | undefined,
    spawnArcaneTeleportFold: vi.fn((x: number, y: number) => {
      fx.lastTeleportFoldPos = { x, y };
    }),
    spawnFloatingAlert: vi.fn((x: number, y: number, text: string) => {
      fx.lastFloatingAlertText = text;
    }),
    resetRoomTransientState: vi.fn(),
    spawnChestOpenBurst: vi.fn(),
    addTrauma: vi.fn(),
    spawnShaderNova: vi.fn(),
  };

  const scene: Record<string, unknown> = {
    transport: {
      getSim: () => sim,
      consumeEvents: () => [],
    },
    fx,
    lighting: {
      spawnTransientLight: vi.fn(),
    },
    fullMapOpen: true,
    triggerIrisTransition: vi.fn(),
    roomTeleportAnimTimer: 0,
    roomTeleportAnimDuration: 0.28,
    lastMinimapHash: '',
    syncArenaTilesWithMapRevision: vi.fn(),
  };

  return { scene, fx, sim };
}
