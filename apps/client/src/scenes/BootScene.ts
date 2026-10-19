import Phaser from 'phaser';
import { initGlobalDebugState } from '../ui/debug-overlay.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  public create(): void {
    const debug = initGlobalDebugState();
    debug.scene = 'BootScene';
    this.scene.start('PreloadScene');
  }
}
