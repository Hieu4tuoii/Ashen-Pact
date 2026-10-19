import type Phaser from 'phaser';
import { SeededRandom } from '@ashen-pact/shared';
import { BIOME_THEMES, PALETTE, PLAYER_SLOT_COLORS } from './palette.js';
import { outlined, renderShapeCommand, traceRoundedRect } from './primitives.js';
import { ALL_SAMPLE_RIGS, type EntityRigDef, type RigPartDef } from './rig-defs.js';

/**
 * DPR-aware procedural texture baker.
 * Bakes vector primitives once into high-DPI WebGL textures so runtime entities
 * render as hardware-batched Sprites at 60 FPS with razor-sharp outlines at 1080p & 1440p.
 */
export class TextureBaker {
  private static currentBakeScale = 0;

  public static computeBakeScale(cameraZoom = 1.5): number {
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1;
    // Supersampling factor 2.5x (clamped 4..8) guarantees zero upscaling even on zoomed gallery previews at 1080p & 1440p
    return Math.max(4, Math.min(8, Math.ceil(cameraZoom * dpr * 2.5)));
  }

  public static getBakeScale(): number {
    return this.currentBakeScale || 4;
  }

  public static getPartTextureKey(rigId: string, partId: string): string {
    return `rig_${rigId}_${partId}`;
  }

  public static getShadowTextureKey(rigId: string): string {
    return `rig_shadow_${rigId}`;
  }

  public static getPlayerRingTextureKey(slot: 1 | 2 | 3 | 4): string {
    return `player_ring_${slot}`;
  }

  public static getBiomeTileTextureKey(biome: 1 | 2 | 3, variant = 0): string {
    return `biome_tile_${biome}_${variant}`;
  }

  public static bakeAll(scene: Phaser.Scene, cameraZoom = 1.5, force = false): number {
    const targetScale = this.computeBakeScale(cameraZoom);
    if (!force && this.currentBakeScale === targetScale && scene.textures.exists('player_ring_1')) {
      return this.currentBakeScale;
    }

    this.currentBakeScale = targetScale;

    for (const rig of ALL_SAMPLE_RIGS) {
      this.bakeRig(scene, rig, targetScale);
    }

    for (const slot of [1, 2, 3, 4] as const) {
      this.bakePlayerRing(scene, slot, targetScale);
    }

    for (const biome of [1, 2, 3] as const) {
      for (let v = 0; v < 4; v++) {
        this.bakeBiomeTile(scene, biome, v, targetScale);
      }
    }

    return targetScale;
  }

  private static bakeRig(scene: Phaser.Scene, rig: EntityRigDef, scale: number): void {
    this.bakeShadow(scene, rig, scale);
    for (const part of rig.parts) {
      this.bakeRigPart(scene, rig.id, part, scale);
    }
  }

  private static bakeShadow(scene: Phaser.Scene, rig: EntityRigDef, scale: number): void {
    const key = this.getShadowTextureKey(rig.id);
    const w = Math.ceil((rig.shadowRx * 2 + 8) * scale);
    const h = Math.ceil((rig.shadowRy * 2 + 8) * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(w / (2 * scale), h / (2 * scale));

    ctx.beginPath();
    ctx.ellipse(0, 0, rig.shadowRx, rig.shadowRy, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(11, 9, 14, 0.45)';
    ctx.fill();

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  private static bakeRigPart(
    scene: Phaser.Scene,
    rigId: string,
    part: RigPartDef,
    scale: number,
  ): void {
    const key = this.getPartTextureKey(rigId, part.id);
    const pad = 8;
    const worldW = part.width + pad * 2;
    const worldH = part.height + pad * 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(worldW * scale);
    canvas.height = Math.ceil(worldH * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(worldW * part.originX, worldH * part.originY);

    for (const cmd of part.shapes) {
      renderShapeCommand(ctx, cmd);
    }

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  private static bakePlayerRing(
    scene: Phaser.Scene,
    slot: 1 | 2 | 3 | 4,
    scale: number,
  ): void {
    const key = this.getPlayerRingTextureKey(slot);
    const rx = 18;
    const ry = 8.5;
    const worldW = rx * 2 + 12;
    const worldH = ry * 2 + 12;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(worldW * scale);
    canvas.height = Math.ceil(worldH * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const color = PLAYER_SLOT_COLORS[slot].hex;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(worldW / 2, worldH / 2);

    // Outer dark outline ring
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 4.2;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();

    // Main player slot ring
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = color;
    ctx.stroke();

    // Subtle inner fill
    ctx.fillStyle = `${color}28`;
    ctx.fill();

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  private static bakeBiomeTile(
    scene: Phaser.Scene,
    biome: 1 | 2 | 3,
    variant: number,
    scale: number,
  ): void {
    const key = this.getBiomeTileTextureKey(biome, variant);
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(size * scale);
    canvas.height = Math.ceil(size * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const theme = BIOME_THEMES[biome];
    const rng = new SeededRandom(`tile_${biome}_${variant}`);

    ctx.save();
    ctx.scale(scale, scale);

    // Base mortar background
    ctx.fillStyle = theme.bgDark;
    ctx.fillRect(0, 0, size, size);

    // Beveled stone/ice/forge slab using outlined() pipeline
    outlined(
      ctx,
      {
        fill: theme.floorBase,
        shade: theme.floorShade,
        outlineColor: PALETTE.INK_DARK,
        outlineWidth: 1.4,
      },
      (c) => traceRoundedRect(c, 1.2, 1.2, size - 2.4, size - 2.4, 3.5),
      { cx: 16, cy: 16, rx: 14, ry: 14 },
    );

    // Subtle top-left bevel edge highlight
    ctx.beginPath();
    ctx.moveTo(3.5, 24);
    ctx.lineTo(3.5, 3.5);
    ctx.lineTo(24, 3.5);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = theme.floorHighlight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Seeded surface details (moss/cracks/crystals/embers)
    if (variant % 2 === 0) {
      const cx = rng.nextFloat(9, 23);
      const cy = rng.nextFloat(9, 23);
      ctx.beginPath();
      ctx.arc(cx, cy, rng.nextFloat(1.4, 2.2), 0, Math.PI * 2);
      ctx.fillStyle = theme.accentGlow;
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(rng.nextFloat(7, 13), rng.nextFloat(7, 13));
      ctx.lineTo(rng.nextFloat(14, 19), rng.nextFloat(14, 19));
      ctx.lineTo(rng.nextFloat(19, 25), rng.nextFloat(12, 23));
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  private static registerCanvasTexture(
    scene: Phaser.Scene,
    key: string,
    canvas: HTMLCanvasElement,
  ): void {
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    scene.textures.addCanvas(key, canvas);
  }
}
