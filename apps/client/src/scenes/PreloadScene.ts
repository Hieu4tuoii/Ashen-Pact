import Phaser from 'phaser';
import {
  VIETNAMESE_VERIFICATION_STRING,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { TextureBaker } from '../art/texture-baker.js';
import { zzfx } from '../audio/zzfx.js';
import {
  installDebugHotkeyListener,
  isDebugUiEnabled,
  isTestHooksEnabled,
} from '../core/debug-flag.js';
import { isHeadlessAutomation } from '../core/software-gl.js';
import { getVisualQueryConfig } from '../core/visual-query.js';
import { initGlobalDebugState } from '../ui/debug-overlay.js';
import { getLoadingScreen, type LoadingStageId } from '../ui/loading-screen.js';
import { resolveBootGameSceneInitData } from './game-scene/sanctuary-lobby-ui.js';

function waitNextPaint(delayMs = 16): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  public create(): void {
    installDebugHotkeyListener();
    const debug = initGlobalDebugState();
    debug.scene = 'PreloadScene';
    const loadingScreen = getLoadingScreen();

    const zoom = Math.min(
      this.scale.width / WORLD_VIEW_WIDTH,
      this.scale.height / WORLD_VIEW_HEIGHT,
    );

    const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
    const params = new URLSearchParams(search);
    const isLoadingPreview = params.get('loadingPreview') === '1';
    const previewStageParam = params.get('loadingStage') as LoadingStageId | null;
    const isFastAutomatedBoot =
      !isLoadingPreview &&
      (isTestHooksEnabled() || isHeadlessAutomation() || getVisualQueryConfig().freeze);

    const loadAllFontSubsets = async (): Promise<void> => {
      loadingScreen.setStage('fonts');
      if (typeof document === 'undefined' || !('fonts' in document)) {
        return;
      }
      const sampleText = `${VIETNAMESE_VERIFICATION_STRING} ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`;
      const weights = [400, 600, 700, 800];
      await Promise.all(
        weights.map((w) => document.fonts.load(`${w} 16px "Be Vietnam Pro"`, sampleText)),
      );
      const allFaces = Array.from(document.fonts);
      if (allFaces.length > 0) {
        await Promise.all(allFaces.map((face) => face.load()));
      }
      await document.fonts.ready;
      const facesAfter = Array.from(document.fonts);
      debug.fontsLoaded =
        facesAfter.length > 0 && facesAfter.every((face) => face.status === 'loaded');
    };

    const sfxWarmup = Promise.race([
      zzfx.preloadSamples(),
      new Promise<void>((resolveTimer) => setTimeout(resolveTimer, 600)),
    ]);

    const runBootPipeline = async (): Promise<void> => {
      if (isLoadingPreview && typeof document !== 'undefined') {
        document.getElementById('ashen-loading-screen')?.classList.add('no-transitions');
      }
      try {
        await loadAllFontSubsets();
        if (isLoadingPreview && previewStageParam) {
          loadingScreen.setStage(previewStageParam);
          return;
        }
        loadingScreen.setStage('audio');
        await sfxWarmup;
      } catch {
        // Proceed with procedural baking even if font/audio warmup encounters browser restrictions
      }

      if (isLoadingPreview && previewStageParam) {
        loadingScreen.setStage(previewStageParam);
        return;
      }

      const allowSceneShortcuts = isDebugUiEnabled() || isTestHooksEnabled();
      const route = resolveBootGameSceneInitData(search, allowSceneShortcuts);

      if (route.targetScene === 'ArtGalleryScene') {
        loadingScreen.setStage('rigs', 75);
        if (!isFastAutomatedBoot) {
          await waitNextPaint(16);
        }
        TextureBaker.bakeGalleryPage1(this, zoom);
        loadingScreen.setStage('ready', 100);
        if (isLoadingPreview) {
          return;
        }
        this.scene.start('ArtGalleryScene');
        loadingScreen.complete(isFastAutomatedBoot);
        return;
      }

      if (isFastAutomatedBoot) {
        loadingScreen.setStage('rigs');
        loadingScreen.setStage('world');
        loadingScreen.setStage('shaders');
        TextureBaker.bakeAll(this, zoom, true);
        loadingScreen.setStage('ready', 100);
        this.scene.start('GameScene', route.initData);
        loadingScreen.complete(true);
        return;
      }

      // Interactive browser session: progressive multi-frame texture baking with live loading UI updates
      loadingScreen.setStage('rigs');
      await waitNextPaint(18);
      TextureBaker.bakeStageRigsAndArsenal(this, zoom);

      loadingScreen.setStage('world');
      await waitNextPaint(18);
      TextureBaker.bakeStageWorldAndPortals(this, zoom);

      loadingScreen.setStage('shaders');
      await waitNextPaint(18);
      TextureBaker.bakeStageShadersAndVfx(this, zoom, true);

      loadingScreen.setStage('ready', 100);
      if (isLoadingPreview) {
        return;
      }
      await waitNextPaint(90);
      this.scene.start('GameScene', route.initData);
      loadingScreen.complete(false);
    };

    void runBootPipeline();
  }
}
