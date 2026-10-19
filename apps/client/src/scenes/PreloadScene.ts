import Phaser from 'phaser';
import { WORLD_VIEW_HEIGHT, WORLD_VIEW_WIDTH } from '@ashen-pact/shared';
import { TextureBaker } from '../art/texture-baker.js';
import { initGlobalDebugState } from '../ui/debug-overlay.js';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  public create(): void {
    const debug = initGlobalDebugState();
    debug.scene = 'PreloadScene';

    const zoom = Math.min(
      this.scale.width / WORLD_VIEW_WIDTH,
      this.scale.height / WORLD_VIEW_HEIGHT,
    );

    const finalizeLoad = () => {
      TextureBaker.bakeAll(this, zoom, true);

      const params = new URLSearchParams(window.location.search);
      const requestedScene = params.get('scene')?.toLowerCase();

      if (requestedScene === 'gallery' || requestedScene === 'artgallery') {
        this.scene.start('ArtGalleryScene');
      } else if (requestedScene === 'game') {
        this.scene.start('GameScene');
      } else {
        this.scene.start('MenuScene');
      }
    };

    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => finalizeLoad()).catch(() => finalizeLoad());
    } else {
      finalizeLoad();
    }
  }
}
