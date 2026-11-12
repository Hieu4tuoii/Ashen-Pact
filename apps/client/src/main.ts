import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import Phaser from 'phaser';
import { PALETTE } from './art/palette.js';
import { installSoftwareGlSubstepper } from './core/software-gl.js';
import { ArtGalleryScene } from './scenes/ArtGalleryScene.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { initGlobalDebugState } from './ui/debug-overlay.js';

initGlobalDebugState();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: PALETTE.INK_DEEP,
  banner: false,
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth || 1920,
    height: window.innerHeight || 1080,
  },
  scene: [BootScene, PreloadScene, GameScene, HudScene, ArtGalleryScene],
};

export const game = new Phaser.Game(config);
installSoftwareGlSubstepper(game);
