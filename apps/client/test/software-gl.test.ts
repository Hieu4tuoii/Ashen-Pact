import type Phaser from 'phaser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  detectSoftwareGlContext,
  flushSceneInteractiveContainer,
  installSoftwareGlSubstepper,
  isHeadlessAutomation,
  resolveSoftwareGlRenderIntervalMs,
  SOFTWARE_GL_RENDER_INTERVAL_MS,
  type SoftwareGlGameFlags,
} from '../src/core/software-gl.js';
import { DebugOverlay, initGlobalDebugState } from '../src/ui/debug-overlay.js';
import { graphicsSettings } from '../src/ui/graphics-settings.js';

function createMockGl(rendererName: string, unmaskedName = rendererName): WebGLRenderingContext {
  const ext = { UNMASKED_RENDERER_WEBGL: 0x9246 };
  return {
    RENDERER: 0x1f01,
    getExtension: (name: string) => (name === 'WEBGL_debug_renderer_info' ? ext : null),
    getParameter: (pname: number) => {
      if (pname === 0x9246) return unmaskedName;
      if (pname === 0x1f01) return rendererName;
      return '';
    },
  } as unknown as WebGLRenderingContext;
}

function createEventBus() {
  const onceHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    emit: (event: string, ...args: unknown[]) => {
      const list = onceHandlers.get(event);
      if (!list) return;
      onceHandlers.delete(event);
      for (const fn of list) fn(...args);
    },
    once: (event: string, fn: (...args: unknown[]) => void) => {
      const list = onceHandlers.get(event) ?? [];
      list.push(fn);
      onceHandlers.set(event, list);
    },
  };
}

interface MockHarnessOptions {
  glRenderer?: string;
  coopMode?: 'solo' | 'host' | 'join';
  galleryActive?: boolean;
  onOrigStep?: () => void;
  onSceneUpdate?: (now: number, dt: number) => void;
}

function createMockGameHarness(opts: MockHarnessOptions = {}) {
  const gameEvents = createEventBus();
  const gsEvents = createEventBus();
  const galleryEvents = createEventBus();

  let gsActive = !opts.galleryActive;
  let galleryActive = Boolean(opts.galleryActive);

  const gameScene = {
    coopMode: opts.coopMode ?? 'solo',
    events: gsEvents,
    cameras: { main: {} },
    scene: {
      key: 'GameScene',
      isActive: () => gsActive,
    },
    transport: {
      getSim: () => ({
        inHub: true,
        stressTestActive: false,
        getAllPlayers: () => [{ lifeState: 'alive' }],
      }),
    },
  };

  const galleryScene = {
    events: galleryEvents,
    cameras: { main: {} },
    scene: {
      key: 'ArtGalleryScene',
      isActive: () => galleryActive,
    },
  };

  const hudPreUpdate = vi.fn();
  const hudScene = {
    cameras: { main: {} },
    input: { preUpdate: hudPreUpdate },
    scene: {
      key: 'HudScene',
      isActive: () => true,
    },
  };

  const origStepCalls: Array<{ time: number; delta: number; loopDelta: number }> = [];
  const sceneUpdateCalls: Array<{ time: number; delta: number; loopDelta: number }> = [];

  const loop = {
    running: true,
    delta: 16.67,
    callback: undefined as ((time: number, delta: number) => void) | undefined,
  };

  const origStep = vi.fn((time: number, delta: number) => {
    origStepCalls.push({ time, delta, loopDelta: loop.delta });
    opts.onOrigStep?.();
  });
  loop.callback = origStep;

  const game = {
    isBooted: true,
    isPaused: false,
    renderer: {
      gl: createMockGl(
        opts.glRenderer ?? 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))',
      ),
    },
    loop,
    scale: { width: 1920, height: 1080, dirty: false },
    events: gameEvents,
    input: { preRender: vi.fn() },
    step: origStep,
    scene: {
      isProcessing: false,
      update: vi.fn((time: number, delta: number) => {
        sceneUpdateCalls.push({ time, delta, loopDelta: loop.delta });
        opts.onSceneUpdate?.(time, delta);
      }),
      getScene: (key: string) => {
        if (key === 'GameScene') return gameScene;
        if (key === 'ArtGalleryScene') return galleryScene;
        if (key === 'HudScene') return hudScene;
        return undefined;
      },
    },
  } as unknown as Phaser.Game & SoftwareGlGameFlags;

  return {
    game,
    gameScene: gameScene as typeof gameScene & { __swRenderedOnce?: boolean },
    galleryScene: galleryScene as typeof galleryScene & { __swRenderedOnce?: boolean },
    gsEvents,
    galleryEvents,
    gameEvents,
    origStep,
    origStepCalls,
    sceneUpdateCalls,
    hudPreUpdate,
    setSceneActive: (next: { gs?: boolean; gallery?: boolean }) => {
      if (typeof next.gs === 'boolean') gsActive = next.gs;
      if (typeof next.gallery === 'boolean') galleryActive = next.gallery;
    },
  };
}

describe('software-gl automation guard, render pacing, step delta & hit-test helpers', () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it('gates substepper strictly behind navigator.webdriver === true and software WebGL contexts', () => {
    expect(isHeadlessAutomation({ webdriver: false })).toBe(false);
    expect(isHeadlessAutomation(null)).toBe(false);
    expect(isHeadlessAutomation({ webdriver: true })).toBe(true);

    expect(detectSoftwareGlContext(createMockGl('SwiftShader Device'))).toBe(true);
    expect(detectSoftwareGlContext(createMockGl('llvmpipe (LLVM 15.0.6, 256 bits)'))).toBe(true);
    expect(detectSoftwareGlContext(createMockGl('NVIDIA GeForce RTX 4070'))).toBe(false);

    // Human browser (navigator.webdriver === false) with SwiftShader MUST NOT install substepper
    Object.defineProperty(globalThis, 'navigator', {
      value: { webdriver: false },
      configurable: true,
      writable: true,
    });
    const humanHarness = createMockGameHarness({ glRenderer: 'SwiftShader Device' });
    const stepBefore = humanHarness.game.step;
    installSoftwareGlSubstepper(humanHarness.game);

    expect(humanHarness.game.__isSoftwareGl).toBeUndefined();
    expect(humanHarness.game.step).toBe(stepBefore);
    humanHarness.game.step(16, 16);
    humanHarness.game.step(32, 16);
    expect(humanHarness.origStep).toHaveBeenCalledTimes(2);

    // Automated browser (navigator.webdriver === true) with hardware GPU MUST NOT install substepper
    Object.defineProperty(globalThis, 'navigator', {
      value: { webdriver: true },
      configurable: true,
      writable: true,
    });
    const hwHarness = createMockGameHarness({ glRenderer: 'NVIDIA GeForce RTX 4070' });
    const hwStepBefore = hwHarness.game.step;
    installSoftwareGlSubstepper(hwHarness.game);
    expect(hwHarness.game.__isSoftwareGl).toBeUndefined();
    expect(hwHarness.game.step).toBe(hwStepBefore);
  });

  it('uses finite render intervals for solo, host, and join and renders join immediately on stateChanged', () => {
    expect(Number.isFinite(resolveSoftwareGlRenderIntervalMs('solo'))).toBe(true);
    expect(Number.isFinite(resolveSoftwareGlRenderIntervalMs('host'))).toBe(true);
    expect(Number.isFinite(resolveSoftwareGlRenderIntervalMs('join'))).toBe(true);
    expect(resolveSoftwareGlRenderIntervalMs('join')).toBe(SOFTWARE_GL_RENDER_INTERVAL_MS.join);
    expect(resolveSoftwareGlRenderIntervalMs('host')).toBe(SOFTWARE_GL_RENDER_INTERVAL_MS.host);
    expect(resolveSoftwareGlRenderIntervalMs('join')).toBeLessThanOrEqual(3000);

    const debugState: Record<string, unknown> = {
      inHub: true,
      currentRoomType: 'hub',
      currentFloor: 1,
      bossActive: false,
      runState: 'playing',
      invitePanelVisible: false,
      emoteWheelOpen: false,
      overlayVisible: false,
      pauseModalOpen: false,
      settingsModalOpen: false,
      controlsModalOpen: false,
      creditsModalOpen: false,
      weaponComparisonVisible: false,
      playerCharacterId: 'vanguard',
      language: 'vi',
    };
    Object.defineProperty(globalThis, 'window', {
      value: {
        innerWidth: 1920,
        innerHeight: 1080,
        location: { search: '' },
        __GAME_DEBUG__: debugState,
      },
      configurable: true,
      writable: true,
    });

    let nowMs = 1000;
    const harness = createMockGameHarness({ coopMode: 'join' });
    installSoftwareGlSubstepper(harness.game, { isAutomated: true, now: () => nowMs });

    // Frame 1 renders immediately on join
    harness.game.step(nowMs, 16.67);
    expect(harness.origStep).toHaveBeenCalledTimes(1);
    expect(harness.gameScene.__swRenderedOnce).toBe(true);

    // Within join interval (< 750ms), steps run logic without freezing or skipping forever
    nowMs += 200;
    harness.game.step(nowMs, 200);
    expect(harness.origStep).toHaveBeenCalledTimes(1);
    expect(harness.sceneUpdateCalls.length).toBeGreaterThan(0);

    // Elapsed >= 750ms triggers a finite periodic full WebGL render for join!
    nowMs += SOFTWARE_GL_RENDER_INTERVAL_MS.join;
    harness.game.step(nowMs, 200);
    expect(harness.origStep).toHaveBeenCalledTimes(2);

    // Visual state change on join (e.g. entering Floor 1 from Hub) triggers immediate full render (< 750ms)
    nowMs += 50;
    debugState.inHub = false;
    harness.game.step(nowMs, 50);
    expect(harness.origStep).toHaveBeenCalledTimes(3);

    harness.gameEvents.emit('destroy');
  });

  it('measures real wall-clock step delta (~16.67ms at 60Hz vs >25ms when CPU stalls) and never spoofs DebugOverlay FPS', () => {
    let nowMs = 0;
    let simulatedLogicCostMs = 0.5;
    const simulatedRenderCostMs = 180;

    const harness = createMockGameHarness({
      coopMode: 'solo',
      onOrigStep: () => {
        nowMs += simulatedRenderCostMs;
      },
      onSceneUpdate: () => {
        nowMs += simulatedLogicCostMs;
      },
    });

    installSoftwareGlSubstepper(harness.game, { isAutomated: true, now: () => nowMs });

    // Initial Frame 1 render
    harness.game.step(nowMs, 16.67);

    // Run ~1 second of normal 60Hz wall-clock operation with periodic 180ms SwiftShader renders
    for (let tick = 0; tick < 40; tick++) {
      nowMs += 16.2;
      vi.advanceTimersByTime(16);
      if (tick === 15 || tick === 32) {
        // Simulate Phaser TimeStep overwriting loop.delta with raw 220ms RAF delta right before step
        harness.game.loop.delta = 220;
        harness.game.step(nowMs, 220);
      }
    }

    expect(harness.game.loop.delta).toBeGreaterThan(15);
    expect(harness.game.loop.delta).toBeLessThan(18.5);

    // Now simulate a genuine CPU stall where every logic step takes 35ms of CPU wall time
    simulatedLogicCostMs = 35;
    for (let tick = 0; tick < 65; tick++) {
      nowMs += 5;
      vi.advanceTimersByTime(16);
    }

    expect(harness.game.loop.delta).toBeGreaterThan(25);
    harness.gameEvents.emit('destroy');

    // Verify DebugOverlay honestly reports low FPS and drives updateAutoQualityMonitor when frame deltas are slow
    graphicsSettings.resetDefaults();
    expect(graphicsSettings.getState().quality).toBe('high');

    const mockText = {
      text: '',
      setResolution: vi.fn(),
      setText: vi.fn(),
    };
    const mockScene = {
      scene: { key: 'GameScene', isActive: () => true },
      children: { length: 20 },
      cameras: { main: { worldView: { x: 0, y: 0, width: 960, height: 540 } } },
      events: { once: vi.fn() },
      add: {
        container: () => ({
          visible: false,
          setDepth: vi.fn().mockReturnThis(),
          add: vi.fn().mockReturnThis(),
          setVisible: vi.fn(),
          setPosition: vi.fn(),
        }),
        graphics: () => ({
          fillStyle: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          fillRoundedRect: vi.fn().mockReturnThis(),
          strokeRoundedRect: vi.fn().mockReturnThis(),
        }),
        text: () => mockText,
      },
      game: {
        __isSoftwareGl: true,
        loop: { delta: 50 },
        renderer: { drawCount: 12 },
      },
    } as unknown as Phaser.Scene;

    const debugState = initGlobalDebugState();
    debugState.coopMode = 'solo';
    debugState.stressTestActive = false;

    const overlay = new DebugOverlay(mockScene, false);
    for (let frame = 0; frame < 65; frame++) {
      overlay.update({ entityCount: 5, bulletCount: 0, tick: frame });
    }

    expect(debugState.fps).toBeCloseTo(20, 0);
    expect(graphicsSettings.getState().quality).toBe('medium');
    overlay.destroy();
    graphicsSettings.resetDefaults();
  });

  it('resets __swRenderedOnce on GameScene and ArtGalleryScene shutdown so restarts render Frame 1 immediately', () => {
    let nowMs = 500;
    const harness = createMockGameHarness({ coopMode: 'solo' });
    installSoftwareGlSubstepper(harness.game, { isAutomated: true, now: () => nowMs });

    harness.game.step(nowMs, 16.67);
    expect(harness.origStep).toHaveBeenCalledTimes(1);
    expect(harness.gameScene.__swRenderedOnce).toBe(true);

    // Shutting down GameScene resets __swRenderedOnce so restart renders immediately even 20ms later
    harness.gsEvents.emit('shutdown');
    expect(harness.gameScene.__swRenderedOnce).toBe(false);

    nowMs += 20;
    harness.game.step(nowMs, 16.67);
    expect(harness.origStep).toHaveBeenCalledTimes(2);
    expect(harness.gameScene.__swRenderedOnce).toBe(true);

    // Switch to ArtGalleryScene, verify initial render + shutdown reset there too
    harness.setSceneActive({ gs: false, gallery: true });
    nowMs += 20;
    harness.game.step(nowMs, 16.67);
    expect(harness.origStep).toHaveBeenCalledTimes(3);
    expect(harness.galleryScene.__swRenderedOnce).toBe(true);

    harness.galleryEvents.emit('shutdown');
    expect(harness.galleryScene.__swRenderedOnce).toBe(false);

    harness.gameEvents.emit('destroy');
  });

  it('flushes visible interactive sub-Containers and leaves while skipping hidden branches', () => {
    const preUpdate = vi.fn();
    const renderList: unknown[] = ['existing_hud_btn'];
    const scene = {
      game: { __isSoftwareGl: true } as SoftwareGlGameFlags,
      input: { preUpdate },
      cameras: { main: { renderList } },
    } as unknown as Phaser.Scene;

    const blocker = { name: 'blocker', visible: true, input: { enabled: true } };
    const hiddenLeaf = { name: 'hidden_leaf', visible: false, input: { enabled: true } };
    const hiddenSubChild = { name: 'hidden_sub_child', visible: true, input: { enabled: true } };
    const hiddenSubContainer = {
      name: 'hidden_sub_container',
      visible: false,
      input: { enabled: true },
      list: [hiddenSubChild],
    };
    const visibleSubChild = { name: 'visible_sub_child', visible: true, input: { enabled: true } };
    const nonInteractiveDeco = { name: 'deco_text', visible: true };
    const interactiveSubContainer = {
      name: 'interactive_pill_container',
      visible: true,
      input: { enabled: true },
      list: [nonInteractiveDeco, hiddenLeaf, visibleSubChild],
    };

    const modalRoot = {
      visible: true,
      list: [blocker, hiddenSubContainer, interactiveSubContainer],
    } as unknown as Phaser.GameObjects.Container;

    flushSceneInteractiveContainer(scene, modalRoot);

    expect(preUpdate).toHaveBeenCalledTimes(1);
    expect((scene.game as SoftwareGlGameFlags).__forceNextSoftwareRender).toBe(true);
    expect(renderList).toEqual([
      'existing_hud_btn',
      blocker,
      interactiveSubContainer,
      visibleSubChild,
    ]);

    // Hidden root container should not append anything
    const hiddenRoot = {
      visible: false,
      list: [blocker],
    } as unknown as Phaser.GameObjects.Container;
    flushSceneInteractiveContainer(scene, hiddenRoot);
    expect(renderList).toHaveLength(4);
  });
});
