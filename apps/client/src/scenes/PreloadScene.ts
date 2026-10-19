import Phaser from 'phaser';
import {
  VIETNAMESE_VERIFICATION_STRING,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
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
      const coopParam = params.get('coop')?.toLowerCase();
      const joinRoomId = params.get('join');
      const hubParam = params.get('hub');
      const galleryParam = params.get('gallery');

      if (
        requestedScene === 'gallery' ||
        requestedScene === 'artgallery' ||
        galleryParam === '1'
      ) {
        this.scene.start('ArtGalleryScene');
      } else if (requestedScene === 'menu') {
        this.scene.start('MenuScene');
      } else if (
        coopParam === 'host' ||
        coopParam === 'join' ||
        joinRoomId ||
        window.location.port === '2567'
      ) {
        this.scene.start('GameScene', {
          coopMode: coopParam === 'host' ? 'host' : 'join',
          roomId: joinRoomId ?? undefined,
          displayName: params.get('name') ?? undefined,
          serverUrl: params.get('server') ?? undefined,
        });
      } else if (requestedScene === 'game' || hubParam === '1') {
        this.scene.start('GameScene');
      } else {
        this.scene.start('MenuScene');
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
