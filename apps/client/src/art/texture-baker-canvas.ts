import type Phaser from 'phaser';

export function bakeCustomCanvas(
  scene: Phaser.Scene,
  key: string,
  worldW: number,
  worldH: number,
  scale: number,
  drawFn: (ctx: CanvasRenderingContext2D) => void,
): void {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(worldW * scale);
  canvas.height = Math.ceil(worldH * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(worldW / 2, worldH / 2);
  drawFn(ctx);
  ctx.restore();

  registerCanvasTexture(scene, key, canvas);
}

export function registerCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
): void {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
}
