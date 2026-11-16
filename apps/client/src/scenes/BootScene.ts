import Phaser from 'phaser';
import { initGlobalDebugState } from '../ui/debug-overlay.js';
import { getLoadingScreen } from '../ui/loading-screen.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public create(): void {
    const debug = initGlobalDebugState();
    debug.scene = 'BootScene';
    const loadingScreen = getLoadingScreen();
    loadingScreen.setStage('boot', 20);
    this.scene.start('PreloadScene');
  }
}
