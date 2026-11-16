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

export function createMockText(initialText = '') {
  let content = initialText;
  let color = '#ffffff';
  let posX = 0;
  let posY = 0;
  let scaleX = 1;
  let scaleY = 1;
  let alpha = 1;
  let visible = false;
  let active = false;
  return {
    get text() {
      return content;
    },
    set text(v: string) {
      content = v;
    },
    get width() {
      return Math.max(24, (content?.length ?? 0) * 8);
    },
    get height() {
      return 16;
    },
    get x() {
      return posX;
    },
    set x(v: number) {
      posX = v;
    },
    get y() {
      return posY;
    },
    set y(v: number) {
      posY = v;
    },
    get scaleX() {
      return scaleX;
    },
    set scaleX(v: number) {
      scaleX = v;
    },
    get scaleY() {
      return scaleY;
    },
    set scaleY(v: number) {
      scaleY = v;
    },
    get alpha() {
      return alpha;
    },
    set alpha(v: number) {
      alpha = v;
    },
    get visible() {
      return visible;
    },
    set visible(v: boolean) {
      visible = v;
    },
    get active() {
      return active;
    },
    set active(v: boolean) {
      active = v;
    },
    style: { color, resolution: 1 },
    setResolution: vi.fn((r: number) => {
      // no-op
    }),
    setText: vi.fn((t: string) => {
      content = String(t);
    }),
    setColor: vi.fn((c: string) => {
      color = c;
    }),
    setPosition: vi.fn((x: number, y: number) => {
      posX = x;
      posY = y;
    }),
    setScale: vi.fn((sx: number, sy?: number) => {
      scaleX = sx;
      scaleY = sy ?? sx;
    }),
    setAlpha: vi.fn((a: number) => {
      alpha = a;
    }),
    setVisible: vi.fn((v: boolean) => {
      visible = v;
    }),
    setActive: vi.fn((v: boolean) => {
      active = v;
    }),
    setDepth: vi.fn(),
    setOrigin: vi.fn(),
    getBounds: vi.fn(() => ({
      x: posX - Math.max(24, (content?.length ?? 0) * 8) * 0.5,
      y: posY - 8,
      width: Math.max(24, (content?.length ?? 0) * 8),
      height: 16,
    })),
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
    activeFloorTeleportFolds: [],
    perimeterRingFreePool: [],
    arcRibbonFreePool: [],
    floorFoldFreePool: [],
    floorFoldGraphics: {
      clear: vi.fn(),
      lineStyle: vi.fn(),
      strokeEllipse: vi.fn(),
    },
    localPlayerPos: { x: 0, y: 0 },
    muzzleVariantCounter: 0,
    muzzleFlipCounter: 0,
    decalWriteCursor: 0,
    activeDecalCount: 0,
    hitStopRemainingMs: 0,
    bossKillSlowMoTimer: 0,
    bossKillFlashTimer: 0,
    bossKillSequenceState: null,
    triggerBossKillSequence(
      x: number,
      y: number,
      biome: 1 | 2 | 3 = 1,
      bossId?: number,
      defId?: string,
    ) {
      mgr.bossKillSequenceState = {
        active: true,
        x,
        y,
        biome,
        elapsedSec: 0,
        beat2Spawned: false,
        bossId,
        defId,
      };
    },
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
    activeTeamComboFootRings: [],
    teamComboFootRingFreePool: [],
    getActiveDamagePopupCount: () => {
      let count = 0;
      for (let i = 0; i < mgr.damagePool.length; i++) {
        if (mgr.damagePool[i]!.active) count += 1;
      }
      return count;
    },
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

  for (let i = 0; i < 48; i++) {
    mgr.damagePool.push({
      text: createMockText() as never,
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      ttl: 0.65,
      baseScale: 1,
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
    activeFloorTeleportFolds: [] as Array<{ active: boolean; x: number; y: number; age: number; ttl: number }>,
    floorFoldFreePool: [] as Array<{ active: boolean; x: number; y: number; age: number; ttl: number }>,
    spawnArcaneTeleportFold: vi.fn((x: number, y: number) => {
      fx.lastTeleportFoldPos = { x, y };
      if (Array.isArray(fx.activeFloorTeleportFolds)) {
        fx.activeFloorTeleportFolds.push({ active: true, x, y, age: 0, ttl: 0.32 });
      }
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
