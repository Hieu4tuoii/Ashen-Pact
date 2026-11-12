import type Phaser from 'phaser';
import { getVisualQueryConfig } from './visual-query.js';

export interface SoftwareGlGameFlags {
  __isSoftwareGl?: boolean;
  __softwareLogicOnlyStep?: boolean;
  __forceNextSoftwareRender?: boolean;
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
 * interactive children of `container` onto `scene.cameras.main.renderList` in bottom-to-top
 * visual order so `InputPlugin.sortGameObjects` ranks modal buttons above modal backdrop blockers
 * and background HUD buttons immediately (even before the next WebGL render pass).
 */
export function flushSceneInteractiveContainer(
  scene: Phaser.Scene | undefined,
  container?: Phaser.GameObjects.Container,
): void {
  if (!scene) return;
  if (scene.game) {
    (scene.game as Phaser.Game & SoftwareGlGameFlags).__forceNextSoftwareRender = true;
  }
  (scene.input as unknown as { preUpdate?: () => void })?.preUpdate?.();
  if (!container || !container.visible) return;
  const renderList = (
    scene.cameras?.main as unknown as { renderList?: Phaser.GameObjects.GameObject[] } | undefined
  )?.renderList;
  if (!Array.isArray(renderList)) return;
  const appendTree = (node: Phaser.GameObjects.GameObject): void => {
    if ('list' in node && Array.isArray((node as Phaser.GameObjects.Container).list)) {
      for (const child of (node as Phaser.GameObjects.Container).list) {
        appendTree(child);
      }
      return;
    }
    if ((node as { input?: unknown }).input) {
      renderList.push(node);
    }
  };
  appendTree(container);
}

/**
 * On CPU-only software WebGL rasterizers (e.g. headless Chromium SwiftShader / Mesa llvmpipe
 * where a 1080p WebGL frame takes ~300-600ms and throttles requestAnimationFrame), keeps
 * Phaser's fixed-60Hz scene & input simulation ticking smoothly in lightweight pure JS
 * between rendered frames while leaving breathing room on the shared Chromium GPU process
 * for multi-tab Co-op tests. No-op on hardware GPUs and when `?freeze=1` deterministic RAF gating
 * is active.
 */
export function installSoftwareGlSubstepper(game: Phaser.Game): void {
  const attach = (): void => {
    const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined;
    const gl = renderer && 'gl' in renderer ? renderer.gl : null;
    if (!detectSoftwareGlContext(gl)) return;

    const flags = game as Phaser.Game & SoftwareGlGameFlags;
    flags.__isSoftwareGl = true;
    flags.__softwareLogicOnlyStep = false;
    flags.__forceNextSoftwareRender = false;

    if (getVisualQueryConfig().freeze) return;

    let lastStepAt = performance.now();
    let lastRenderFinishAt = 0;
    let lastVisualStateKey = '';
    const loopWithCallback = game.loop as unknown as
      | { running?: boolean; callback?: (time: number, delta: number) => void }
      | undefined;
    const origStep = game.step.bind(game);

    const readVisualStateKey = (
      gs?: Phaser.Scene & {
        transport?: {
          getSim?: () => { getAllPlayers?: () => Array<{ lifeState?: string }> };
        };
      },
    ): string => {
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
        const gs = game.scene?.getScene('GameScene') as
          | (Phaser.Scene & {
              coopMode?: 'solo' | 'host' | 'join';
              transport?: {
                getSim?: () => { getAllPlayers?: () => Array<{ lifeState?: string }> };
              };
            })
          | undefined;
        if (gs && gs.scene.isActive() && (gs.coopMode ?? 'solo') !== 'join') {
          const curKey = readVisualStateKey(gs);
          if (curKey.length > 0 && lastVisualStateKey.length > 0 && curKey !== lastVisualStateKey) {
            lastVisualStateKey = curKey;
            flags.__forceNextSoftwareRender = true;
          }
        }
        game.events.emit('poststep', now, dt);
        (game.scene as unknown as { isProcessing: boolean }).isProcessing = false;
      } finally {
        flags.__softwareLogicOnlyStep = false;
      }
    };

    const customStep = (time: number, rawDelta: number): void => {
      if (getVisualQueryConfig().freeze) {
        flags.__softwareLogicOnlyStep = false;
        origStep(time, rawDelta);
        return;
      }
      const now = performance.now();
      const subDelta = Math.min(Math.max(0.5, now - lastStepAt), 50);
      const gs = game.scene?.getScene('GameScene') as
        | (Phaser.Scene & {
            coopMode?: 'solo' | 'host' | 'join';
            __swRenderedOnce?: boolean;
            transport?: {
              getSim?: () => {
                inHub?: boolean;
                getAllPlayers?: () => Array<{ lifeState?: string }>;
              };
            };
          })
        | undefined;
      const gallery = game.scene?.getScene('ArtGalleryScene') as
        | (Phaser.Scene & { __swRenderedOnce?: boolean })
        | undefined;
      const gsActive = Boolean(gs && gs.scene.isActive());
      const galleryActive = Boolean(gallery && gallery.scene.isActive());
      const activeScene = gsActive ? gs : galleryActive ? gallery : undefined;
      const coopMode = gsActive ? (gs?.coopMode ?? 'solo') : 'solo';
      const curStateKey = gsActive ? readVisualStateKey(gs) : '';
      const stateChanged =
        gsActive && coopMode !== 'join' && curStateKey.length > 0 && curStateKey !== lastVisualStateKey;
      const inHub = gsActive && Boolean(gs?.transport?.getSim?.()?.inHub);
      const minRenderGapMs =
        coopMode === 'join'
          ? Number.POSITIVE_INFINITY
          : coopMode === 'host'
            ? inHub
              ? 4500
              : 850
            : 220;

      if (
        activeScene &&
        activeScene.__swRenderedOnce === true &&
        !game.scale?.dirty &&
        !flags.__forceNextSoftwareRender &&
        !stateChanged &&
        lastRenderFinishAt > 0 &&
        now - lastRenderFinishAt < minRenderGapMs
      ) {
        lastStepAt = now;
        runLogicOnlyStep(now, subDelta);
        return;
      }

      flags.__forceNextSoftwareRender = false;
      flags.__softwareLogicOnlyStep = false;
      if (gsActive) {
        lastVisualStateKey = curStateKey;
      }
      origStep(now, subDelta);
      if (activeScene) {
        activeScene.__swRenderedOnce = true;
      }
      lastRenderFinishAt = performance.now();
      lastStepAt = lastRenderFinishAt;
      const hud = game.scene?.getScene('HudScene');
      (hud?.input as unknown as { preUpdate?: () => void })?.preUpdate?.();
    };
    game.step = customStep;
    if (loopWithCallback?.running) {
      loopWithCallback.callback = customStep;
    }

    const intervalId = window.setInterval(() => {
      if ((game as unknown as { pendingDestroy?: boolean }).pendingDestroy) {
        window.clearInterval(intervalId);
        return;
      }
      if (
        game.isPaused ||
        !game.loop?.running ||
        getVisualQueryConfig().freeze ||
        (typeof document !== 'undefined' && document.hidden)
      ) {
        lastStepAt = performance.now();
        return;
      }
      const gs = game.scene?.getScene('GameScene') as
        | (Phaser.Scene & {
            transport?: { getSim?: () => { stressTestActive?: boolean } };
          })
        | undefined;
      const gallery = game.scene?.getScene('ArtGalleryScene');
      const gsActive = Boolean(gs && gs.scene.isActive());
      const galleryActive = Boolean(gallery && gallery.scene.isActive());
      if (!gsActive && !galleryActive) {
        lastStepAt = performance.now();
        return;
      }

      const stressActive = gsActive && Boolean(gs?.transport?.getSim?.()?.stressTestActive);
      const minStepGapMs = stressActive || galleryActive ? 15 : 31;
      const now = performance.now();
      const elapsed = now - lastStepAt;
      if (elapsed < minStepGapMs) return;
      lastStepAt = now;
      runLogicOnlyStep(now, Math.min(elapsed, 50));
    }, 16);

    game.events.once('destroy', () => {
      window.clearInterval(intervalId);
    });
  };

  if (game.isBooted) {
    attach();
  } else {
    game.events.once('ready', attach);
  }
}
