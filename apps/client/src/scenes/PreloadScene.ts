import Phaser from 'phaser';
import {
  VIETNAMESE_VERIFICATION_STRING,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { TextureBaker } from '../art/texture-baker.js';
import {
  installDebugHotkeyListener,
  isDebugUiEnabled,
  isTestHooksEnabled,
} from '../core/debug-flag.js';
import { initGlobalDebugState } from '../ui/debug-overlay.js';
import { resolveBootGameSceneInitData } from './game-scene/sanctuary-lobby-ui.js';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  public create(): void {
    installDebugHotkeyListener();
    const debug = initGlobalDebugState();
    debug.scene = 'PreloadScene';

    const zoom = Math.min(
      this.scale.width / WORLD_VIEW_WIDTH,
      this.scale.height / WORLD_VIEW_HEIGHT,
    );

    const finalizeLoad = () => {
      const allowSceneShortcuts = isDebugUiEnabled() || isTestHooksEnabled();
      const route = resolveBootGameSceneInitData(window.location.search, allowSceneShortcuts);
      if (route.targetScene === 'ArtGalleryScene') {
        TextureBaker.bakeGalleryPage1(this, zoom);
        this.scene.start('ArtGalleryScene');
      } else {
        TextureBaker.bakeAll(this, zoom, true);
        this.scene.start('GameScene', route.initData);
      }
    };

    const loadAllFontSubsets = async (): Promise<void> => {
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

    loadAllFontSubsets()
      .then(() => finalizeLoad())
      .catch(() => finalizeLoad());
  }
}
