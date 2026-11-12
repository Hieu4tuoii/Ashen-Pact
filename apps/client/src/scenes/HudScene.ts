import { WORLD_VIEW_HEIGHT, WORLD_VIEW_WIDTH } from '@ashen-pact/shared';
import Phaser from 'phaser';
import { syncCameraMatrix } from '../core/software-gl.js';
import { computeUniformViewportMetrics } from '../fx/lighting-config.js';

export class HudScene extends Phaser.Scene {
  public viewW = WORLD_VIEW_WIDTH;
  public viewH = WORLD_VIEW_HEIGHT;
  public padX = 0;
  public padY = 0;

  constructor() {
    super({ key: 'HudScene' });
  }

  public create(): void {
    this.applyViewport();
  }

  public attachGameScene(): void {
    this.children.removeAll(true);
    this.applyViewport();
  }

  public detachGameScene(): void {
    this.children.removeAll(true);
  }

  public applyViewport(): void {
    const w = Math.max(320, this.scale?.width || window.innerWidth || 1920);
    const h = Math.max(240, this.scale?.height || window.innerHeight || 1080);
    const m = computeUniformViewportMetrics(w, h);
    this.viewW = m.viewW;
    this.viewH = m.viewH;
    this.padX = m.padX;
    this.padY = m.padY;
    const cam = this.cameras?.main;
    if (cam) {
      cam.setZoom(m.zoom);
      cam.centerOn(WORLD_VIEW_WIDTH * 0.5, WORLD_VIEW_HEIGHT * 0.5);
      syncCameraMatrix(cam);
    }
  }
}
