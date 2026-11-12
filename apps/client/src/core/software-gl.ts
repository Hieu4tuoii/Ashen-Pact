import type Phaser from 'phaser';
import { getVisualQueryConfig } from './visual-query.js';

export interface SoftwareGlGameFlags {
  __isSoftwareGl?: boolean;
  __softwareLogicOnlyStep?: boolean;
  __forceNextSoftwareRender?: boolean;
}

export interface SoftwareGlSubstepperOptions {
  isAutomated?: boolean;
  now?: () => number;
}

type SubsteppedScene = Phaser.Scene & {
  __swRenderedOnce?: boolean;
  __swShutdownBound?: boolean;
  coopMode?: 'solo' | 'host' | 'join';
  keys?: Partial<
    Record<'W' | 'A' | 'S' | 'D' | 'SPACE' | 'SHIFT' | 'Q' | 'E' | 'R', { isDown?: boolean }>
  >;
  transport?: {
    getSim?: () => {
      inHub?: boolean;
      stressTestActive?: boolean;
      getAllPlayers?: () => Array<{ lifeState?: string }>;
    };
  };
};

interface StepCheckpoint {
  time: number;
  totalSteps: number;
}

export const SOFTWARE_GL_RENDER_INTERVAL_MS = {
  solo: 650,
  host: 2200,
  join: 2800,
} as const;

const TARGET_STEP_MS = 1000 / 60;
const IDLE_JOIN_STEP_MS = TARGET_STEP_MS * 3;
const MAX_SOLO_RENDER_CATCHUP_STEPS = 28;
const MAX_HOST_RENDER_CATCHUP_STEPS = 24;
const MAX_JOIN_RENDER_CATCHUP_STEPS = 3;
const MAX_TIMER_CATCHUP_STEPS = 5;
const CATCHUP_CPU_BUDGET_MS = 24;
const SOLO_POST_RENDER_BUDGET_MS = 90;
const MAX_CLOCK_DRIFT_MS = 450;
const STEP_WINDOW_MAX_STEPS = 18;

export function isHeadlessAutomation(
  nav: { webdriver?: boolean } | null | undefined = typeof navigator !== 'undefined'
    ? navigator
    : null,
): boolean {
  return Boolean(nav?.webdriver);
}

export function detectSoftwareGlContext(
  gl: WebGLRenderingContext | WebGL2RenderingContext | null | undefined,
): boolean {
  if (!gl || typeof gl.getParameter !== 'function') return false;
  try {
    const dbg =
      typeof gl.getExtension === 'function' ? gl.getExtension('WEBGL_debug_renderer_info') : null;
    const unmasked = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '') : '';
    const base = String(gl.getParameter(gl.RENDERER) ?? '');
    return /swiftshader|llvmpipe|softpipe|software/i.test(`${unmasked} ${base}`);
  } catch {
    return false;
  }
}

export function resolveSoftwareGlRenderIntervalMs(
  coopMode: 'solo' | 'host' | 'join' = 'solo',
): number {
  if (coopMode === 'join') return SOFTWARE_GL_RENDER_INTERVAL_MS.join;
  if (coopMode === 'host') return SOFTWARE_GL_RENDER_INTERVAL_MS.host;
  return SOFTWARE_GL_RENDER_INTERVAL_MS.solo;
}

/**
 * Synchronizes a Phaser 2D Camera's internal transform matrix and midPoint from its current
 * zoom/scroll/viewport WITHOUT calling `cam.preRender()` (which wipes `cam.renderList` used by
 * `InputPlugin.sortGameObjects` between rendered frames).
 */
export function syncCameraMatrix(cam: Phaser.Cameras.Scene2D.Camera | undefined): void {
  const raw = cam as unknown as
    | {
        x: number;
        y: number;
        width: number;
        height: number;
        originX: number;
        originY: number;
        rotation: number;
        zoomX: number;
        zoomY: number;
        scrollX: number;
        scrollY: number;
        midPoint?: { set: (x: number, y: number) => void };
        matrix?: {
          applyITRS: (x: number, y: number, r: number, sx: number, sy: number) => void;
          translate: (x: number, y: number) => void;
        };
      }
    | undefined;
  if (!raw?.matrix) return;
  const originX = raw.width * raw.originX;
  const originY = raw.height * raw.originY;
  raw.midPoint?.set(raw.scrollX + raw.width * 0.5, raw.scrollY + raw.height * 0.5);
  raw.matrix.applyITRS(
    Math.floor(raw.x + originX + 0.5),
    Math.floor(raw.y + originY + 0.5),
    raw.rotation,
    raw.zoomX,
    raw.zoomY,
  );
  raw.matrix.translate(-originX, -originY);
}

/**
 * Flushes pending interactive insertions/removals in `scene.input` and appends any visible
 * interactive descendants (including interactive sub-Containers) of `container` onto
 * `scene.cameras.main.renderList` in bottom-to-top visual order so `InputPlugin.sortGameObjects`
 * ranks modal buttons above modal backdrop blockers and background HUD buttons immediately.
 */
export function flushSceneInteractiveContainer(
  scene: Phaser.Scene | undefined,
  container?: Phaser.GameObjects.Container,
): void {
  if (!scene) return;
  if (scene.game) {
    const flags = scene.game as Phaser.Game & SoftwareGlGameFlags;
    if (flags.__isSoftwareGl) {
      flags.__forceNextSoftwareRender = true;
    }
  }
  (scene.input as unknown as { preUpdate?: () => void })?.preUpdate?.();
  if (!container || container.visible === false) return;
  const renderList = (
    scene.cameras?.main as unknown as { renderList?: Phaser.GameObjects.GameObject[] } | undefined
  )?.renderList;
  if (!Array.isArray(renderList)) return;
  const appendTree = (node: Phaser.GameObjects.GameObject): void => {
    if ((node as { visible?: boolean }).visible === false) return;
    if ((node as { input?: unknown }).input) {
      renderList.push(node);
    }
    if ('list' in node && Array.isArray((node as Phaser.GameObjects.Container).list)) {
      for (const child of (node as Phaser.GameObjects.Container).list) {
        appendTree(child);
      }
    }
  };
  appendTree(container);
}

function markSceneRenderedOnce(scene: SubsteppedScene): void {
  scene.__swRenderedOnce = true;
  if (!scene.__swShutdownBound) {
    scene.__swShutdownBound = true;
    scene.events?.once?.('shutdown', () => {
      scene.__swRenderedOnce = false;
      scene.__swShutdownBound = false;
    });
  }
}

/**
 * Strictly under headless browser automation (`navigator.webdriver === true`) on CPU-only
 * software WebGL rasterizers (e.g. headless Chromium SwiftShader / Mesa llvmpipe), keeps
 * Phaser's fixed-60Hz scene & input simulation ticking smoothly between finite periodic WebGL
 * renders while reporting real measured wall-clock step throughput on `game.loop.delta`.
 * Complete no-op on real non-automated browsers (`navigator.webdriver === false`), hardware GPUs,
 * and `?freeze=1` deterministic RAF gating.
 */
export function installSoftwareGlSubstepper(
  game: Phaser.Game,
  options?: SoftwareGlSubstepperOptions,
): void {
  const automatedAtInstall = options?.isAutomated ?? isHeadlessAutomation();
  if (!automatedAtInstall) return;

  const attach = (): void => {
    if (!(options?.isAutomated ?? isHeadlessAutomation())) return;

    const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined;
    const gl = renderer && 'gl' in renderer ? renderer.gl : null;
    if (!detectSoftwareGlContext(gl)) return;

    const flags = game as Phaser.Game & SoftwareGlGameFlags;
    flags.__isSoftwareGl = true;
    flags.__softwareLogicOnlyStep = false;
    flags.__forceNextSoftwareRender = false;

    if (getVisualQueryConfig().freeze) return;

    const nowFn = options?.now ?? (() => performance.now());
    let simClockMs = nowFn();
    let lastRenderFinishAt = 0;
    let lastVisualStateKey = '';
    let totalStepsExecuted = 0;
    let currentMeasuredStepDelta = TARGET_STEP_MS;
    const checkpoints: StepCheckpoint[] = [];

    const syncLoopDelta = (fallbackNow?: number): void => {
      let delta = currentMeasuredStepDelta;
      if (checkpoints.length === 1 && fallbackNow !== undefined) {
        delta = Math.max(0.5, fallbackNow - checkpoints[0]!.time);
      }
      const loopObj = game.loop as unknown as { delta?: number } | undefined;
      if (loopObj) {
        loopObj.delta = delta;
      }
    };

    const resetStepMetrics = (anchorNow: number): void => {
      simClockMs = anchorNow;
      totalStepsExecuted = 0;
      currentMeasuredStepDelta = TARGET_STEP_MS;
      checkpoints.length = 0;
      checkpoints.push({ time: anchorNow, totalSteps: 0 });
    };

    const recordCompletedBurst = (stepsInBurst: number, completedAt: number): void => {
      if (stepsInBurst <= 0) return;
      if (checkpoints.length === 0) {
        checkpoints.push({
          time: completedAt - stepsInBurst * TARGET_STEP_MS,
          totalSteps: 0,
        });
      }
      totalStepsExecuted += stepsInBurst;
      checkpoints.push({ time: completedAt, totalSteps: totalStepsExecuted });
      while (
        checkpoints.length > 2 &&
        totalStepsExecuted - checkpoints[0]!.totalSteps > STEP_WINDOW_MAX_STEPS
      ) {
        checkpoints.shift();
      }
      const oldest = checkpoints[0]!;
      const latest = checkpoints[checkpoints.length - 1]!;
      const elapsedWallMs = Math.max(0.5, latest.time - oldest.time);
      const stepsExecuted = Math.max(1, latest.totalSteps - oldest.totalSteps);
      currentMeasuredStepDelta = elapsedWallMs / stepsExecuted;
      syncLoopDelta(completedAt);
    };

    const loopWithCallback = game.loop as unknown as
      | { running?: boolean; delta?: number; callback?: (time: number, delta: number) => void }
      | undefined;
    const origStep = game.step.bind(game);

    const readVisualStateKey = (gs?: SubsteppedScene): string => {
      if (typeof window === 'undefined') return '';
      const dbg = (window as unknown as { __GAME_DEBUG__?: Record<string, unknown> }).__GAME_DEBUG__;
      if (!dbg) return '';
      const anyDowned = Boolean(
        gs?.transport
          ?.getSim?.()
          ?.getAllPlayers?.()
          ?.some((p) => p.lifeState === 'downed'),
      );
      return `${dbg.inHub}|${dbg.currentRoomType}|${dbg.currentFloor}|${dbg.bossActive}|${dbg.runState}|${dbg.invitePanelVisible}|${dbg.emoteWheelOpen}|${dbg.overlayVisible}|${dbg.pauseModalOpen}|${dbg.settingsModalOpen}|${dbg.controlsModalOpen}|${dbg.creditsModalOpen}|${dbg.weaponComparisonVisible}|${dbg.playerCharacterId}|${dbg.language}|${anyDowned}`;
    };

    const runLogicOnlyStep = (now: number, dt: number): void => {
      flags.__softwareLogicOnlyStep = true;
      try {
        syncLoopDelta(now);
        if (
          typeof window !== 'undefined' &&
          game.scale &&
          (window.innerWidth !== game.scale.width || window.innerHeight !== game.scale.height)
        ) {
          game.scale.dirty = true;
        }
        game.events.emit('prestep', now, dt);
        (game.input as unknown as { preRender?: () => void })?.preRender?.();
        game.events.emit('step', now, dt);
        game.scene.update(now, dt);
        for (const sKey of ['GameScene', 'HudScene', 'ArtGalleryScene'] as const) {
          const sc = game.scene?.getScene(sKey);
          if (sc && sc.scene.isActive()) {
            syncCameraMatrix(sc.cameras?.main);
          }
        }
        const gs = game.scene?.getScene('GameScene') as SubsteppedScene | undefined;
        if (gs && gs.scene.isActive()) {
          const curKey = readVisualStateKey(gs);
          if (curKey.length > 0 && lastVisualStateKey.length > 0 && curKey !== lastVisualStateKey) {
            flags.__forceNextSoftwareRender = true;
          }
        }
        game.events.emit('poststep', now, dt);
        (game.scene as unknown as { isProcessing: boolean }).isProcessing = false;
      } finally {
        flags.__softwareLogicOnlyStep = false;
      }
    };

    let resizeOccurred = false;
    let postResizeRenderPending = false;
    const onScaleResize = (): void => {
      resizeOccurred = true;
      postResizeRenderPending = true;
      flags.__forceNextSoftwareRender = true;
    };
    (
      game.scale as unknown as { on?: (ev: string, fn: () => void) => void } | undefined
    )?.on?.('resize', onScaleResize);

    const runDueLogicSteps = (
      maxSteps: number,
      existingStepsInBurst = 0,
      stepIntervalMs = TARGET_STEP_MS,
      cpuBudgetMs = CATCHUP_CPU_BUDGET_MS,
    ): void => {
      const burstStartAt = nowFn();
      let executed = 0;
      while (executed < maxSteps && nowFn() - simClockMs >= stepIntervalMs) {
        const stepStart = nowFn();
        simClockMs += stepIntervalMs;
        runLogicOnlyStep(stepStart, stepIntervalMs);
        executed += 1;
        const stepEnd = nowFn();
        if (stepEnd - burstStartAt >= cpuBudgetMs) {
          break;
        }
      }
      const finishAt = nowFn();
      const maxDriftMs = stepIntervalMs > TARGET_STEP_MS ? stepIntervalMs * 2 : MAX_CLOCK_DRIFT_MS;
      if (finishAt - simClockMs > maxDriftMs) {
        simClockMs = finishAt;
      }
      const totalBurstSteps = existingStepsInBurst + executed;
      if (totalBurstSteps > 0) {
        const subTickJitterMs = Math.min(Math.max(0, finishAt - simClockMs), stepIntervalMs);
        recordCompletedBurst(totalBurstSteps, finishAt - subTickJitterMs);
      }
    };

    const getActiveSubsteppedScene = (): {
      gs?: SubsteppedScene;
      gsActive: boolean;
      gallery?: SubsteppedScene;
      galleryActive: boolean;
      activeScene?: SubsteppedScene;
    } => {
      const gs = game.scene?.getScene('GameScene') as SubsteppedScene | undefined;
      const gallery = game.scene?.getScene('ArtGalleryScene') as SubsteppedScene | undefined;
      const gsActive = Boolean(gs && gs.scene.isActive());
      const galleryActive = Boolean(gallery && gallery.scene.isActive());
      const activeScene = gsActive ? gs : galleryActive ? gallery : undefined;
      return { gs, gsActive, gallery, galleryActive, activeScene };
    };

    let deferredStateRenderDueAt = 0;

    const hasActiveJoinInput = (gs?: SubsteppedScene): boolean => {
      const k = gs?.keys;
      if (
        k &&
        (k.W?.isDown ||
          k.A?.isDown ||
          k.S?.isDown ||
          k.D?.isDown ||
          k.SPACE?.isDown ||
          k.SHIFT?.isDown ||
          k.Q?.isDown ||
          k.E?.isDown ||
          k.R?.isDown)
      ) {
        return true;
      }
      return Boolean(gs?.input?.activePointer?.isDown);
    };

    const getMultiTabJoinStaggerMs = (): number => {
      if (typeof window === 'undefined') return 0;
      const dbg = (
        window as unknown as {
          __GAME_DEBUG__?: { playerSlot?: number; coopPlayerCount?: number };
        }
      ).__GAME_DEBUG__;
      if (!dbg || (dbg.coopPlayerCount ?? 1) < 2) return 0;
      const slot = typeof dbg.playerSlot === 'number' ? dbg.playerSlot : 2;
      return Math.max(1, slot - 1) * 280;
    };

    const customStep = (time: number, rawDelta: number): void => {
      if (getVisualQueryConfig().freeze) {
        flags.__softwareLogicOnlyStep = false;
        origStep(time, rawDelta);
        return;
      }
      const now = nowFn();
      const { gs, gsActive, activeScene } = getActiveSubsteppedScene();
      const coopMode = gsActive ? (gs?.coopMode ?? 'solo') : 'solo';
      const idleJoin = coopMode === 'join' && !hasActiveJoinInput(gs);
      const stepIntervalMs = idleJoin ? IDLE_JOIN_STEP_MS : TARGET_STEP_MS;
      const curStateKey = gsActive ? readVisualStateKey(gs) : '';
      const rawStateChanged =
        gsActive && curStateKey.length > 0 && curStateKey !== lastVisualStateKey;
      const joinStaggerMs = coopMode === 'join' ? getMultiTabJoinStaggerMs() : 0;

      let stateChanged = rawStateChanged;
      if (rawStateChanged && joinStaggerMs > 0) {
        if (deferredStateRenderDueAt === 0) {
          deferredStateRenderDueAt = now + joinStaggerMs;
        }
        stateChanged = now >= deferredStateRenderDueAt;
        if (!stateChanged) {
          flags.__forceNextSoftwareRender = false;
        }
      } else {
        deferredStateRenderDueAt = 0;
      }

      const minRenderGapMs = resolveSoftwareGlRenderIntervalMs(coopMode) + joinStaggerMs;
      const scaleDirty =
        resizeOccurred ||
        postResizeRenderPending ||
        Boolean(game.scale?.dirty) ||
        (typeof window !== 'undefined' &&
          Boolean(game.scale) &&
          (window.innerWidth !== game.scale.width || window.innerHeight !== game.scale.height));

      if (
        activeScene &&
        activeScene.__swRenderedOnce === true &&
        !scaleDirty &&
        !flags.__forceNextSoftwareRender &&
        !stateChanged &&
        lastRenderFinishAt > 0 &&
        now - lastRenderFinishAt < minRenderGapMs
      ) {
        runDueLogicSteps(MAX_TIMER_CATCHUP_STEPS, 0, stepIntervalMs);
        syncLoopDelta(nowFn());
        return;
      }

      const wasRenderedOnce = Boolean(activeScene?.__swRenderedOnce);
      const hadScaleDirtyBeforeStep = scaleDirty;
      deferredStateRenderDueAt = 0;
      flags.__forceNextSoftwareRender = false;
      flags.__softwareLogicOnlyStep = false;
      if (gsActive) {
        lastVisualStateKey = curStateKey;
      }

      if (wasRenderedOnce && !hadScaleDirtyBeforeStep) {
        syncLoopDelta(now);
        simClockMs += stepIntervalMs;
      } else {
        const loopObj = game.loop as unknown as { delta?: number } | undefined;
        if (loopObj) {
          loopObj.delta = stepIntervalMs;
        }
      }

      origStep(now, stepIntervalMs);

      const renderFinishAt = nowFn();
      lastRenderFinishAt = renderFinishAt;
      const resizedDuringRender =
        hadScaleDirtyBeforeStep || resizeOccurred || postResizeRenderPending;
      resizeOccurred = false;
      postResizeRenderPending = false;
      if (resizedDuringRender) {
        flags.__forceNextSoftwareRender = false;
      }

      if (activeScene) {
        markSceneRenderedOnce(activeScene);
        if (!wasRenderedOnce || resizedDuringRender) {
          resetStepMetrics(renderFinishAt);
        } else {
          const maxRenderCatchup =
            coopMode === 'join'
              ? MAX_JOIN_RENDER_CATCHUP_STEPS
              : coopMode === 'host'
                ? MAX_HOST_RENDER_CATCHUP_STEPS
                : MAX_SOLO_RENDER_CATCHUP_STEPS;
          const renderCatchupBudget =
            coopMode === 'solo' ? SOLO_POST_RENDER_BUDGET_MS : CATCHUP_CPU_BUDGET_MS;
          runDueLogicSteps(maxRenderCatchup, 1, stepIntervalMs, renderCatchupBudget);
        }
      } else {
        resetStepMetrics(renderFinishAt);
      }

      const hud = game.scene?.getScene('HudScene');
      (hud?.input as unknown as { preUpdate?: () => void })?.preUpdate?.();
    };

    game.step = customStep;
    if (loopWithCallback?.running) {
      loopWithCallback.callback = customStep;
    }

    const intervalId = globalThis.setInterval(() => {
      if ((game as unknown as { pendingDestroy?: boolean }).pendingDestroy) {
        globalThis.clearInterval(intervalId);
        return;
      }
      if (
        game.isPaused ||
        !game.loop?.running ||
        getVisualQueryConfig().freeze ||
        (typeof document !== 'undefined' && document.hidden)
      ) {
        resetStepMetrics(nowFn());
        return;
      }
      if (resizeOccurred) {
        resizeOccurred = false;
        resetStepMetrics(nowFn());
        return;
      }
      const { gs, gsActive, activeScene } = getActiveSubsteppedScene();
      if (!activeScene || !activeScene.__swRenderedOnce) {
        resetStepMetrics(nowFn());
        return;
      }

      const coopMode = gsActive ? (gs?.coopMode ?? 'solo') : 'solo';
      const idleJoin = coopMode === 'join' && !hasActiveJoinInput(gs);
      const stepIntervalMs = idleJoin ? IDLE_JOIN_STEP_MS : TARGET_STEP_MS;
      runDueLogicSteps(MAX_TIMER_CATCHUP_STEPS, 0, stepIntervalMs);
    }, 16);

    game.events.once('destroy', () => {
      globalThis.clearInterval(intervalId);
      (
        game.scale as unknown as { off?: (ev: string, fn: () => void) => void } | undefined
      )?.off?.('resize', onScaleResize);
    });
  };

  if (game.isBooted) {
    attach();
  } else {
    game.events.once('ready', attach);
  }
}
