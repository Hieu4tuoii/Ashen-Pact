import type Phaser from 'phaser';
import type { PropKind, SurfaceKind } from '@ashen-pact/shared';
import { PLAYER_SLOT_COLORS } from './palette.js';
import { renderShapeCommand } from './primitives.js';
import {
  ALL_SAMPLE_RIGS,
  type EntityRigDef,
  type RigPartDef,
  WEAPON_VECTOR_DEFS,
  type WeaponVectorDef,
} from './rig-defs.js';
import { bakeCustomCanvas, registerCanvasTexture } from './texture-baker-canvas.js';
import { bakeCrosshair, bakeLightRadialBrush, bakeProjectilesAndFx } from './texture-baker-fx.js';
import { bakePortalsAndDoors } from './texture-baker-portals-doors.js';
import { bakeProps } from './texture-baker-props.js';
import { bakeSurfaces, drawSurfaceTile } from './texture-baker-surfaces.js';
import {
  bakeBiomeTile,
  bakeCrackedWallTile,
  bakePillarTile,
  bakeWallAoOverlay,
  bakeWallTile,
} from './texture-baker-tiles.js';

/**
 * DPR-aware procedural texture baker.
 * Bakes vector primitives once into high-DPI WebGL textures so runtime entities,
 * weapons, projectiles, autotiled walls, interactive surfaces, props, decals, and particles
 * render as hardware-batched Sprites at 60 FPS with razor-sharp outlines at 1080p & 1440p.
 */
export class TextureBaker {
  private static currentBakeScale = 0;
  private static fullBakeScale = 0;

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

  public static getFullRigTextureKey(rigId: string): string {
    return `rig_full_${rigId}`;
  }

  public static getShadowTextureKey(rigId: string): string {
    return `rig_shadow_${rigId}`;
  }

  public static getPlayerRingTextureKey(slot: 1 | 2 | 3 | 4): string {
    return `player_ring_${slot}`;
  }

  public static getBiomeTileTextureKey(biome: 0 | 1 | 2 | 3, variant = 0): string {
    return `biome_tile_${biome}_${variant % 8}`;
  }

  public static getWallTileTextureKey(biome: 0 | 1 | 2 | 3 = 1, mask = 0): string {
    return mask === 0 ? `biome_wall_${biome}` : `biome_wall_${biome}_${mask & 15}`;
  }

  public static getPillarTileTextureKey(biome: 0 | 1 | 2 | 3 = 1, mask = 0): string {
    return mask === 0 ? `biome_pillar_${biome}` : `biome_pillar_${biome}_${mask & 15}`;
  }

  public static getCrackedWallTextureKey(biome: 0 | 1 | 2 | 3 = 1): string {
    return `biome_cracked_wall_${biome}`;
  }

  public static getWallAoTextureKey(aoMask: number): string {
    return `wall_ao_${aoMask & 7}`;
  }

  public static getSurfaceTextureKey(surface: Exclude<SurfaceKind, 'none'>): string {
    return `surface_${surface}`;
  }

  public static getPropTextureKey(
    kind: PropKind,
    coverState?: 'low' | 'flipped' | 'sliding' | 'fallen',
  ): string {
    if (kind === 'moss_table') {
      if (coverState === 'flipped') return 'prop_moss_table_flipped';
      if (coverState === 'sliding') return 'prop_moss_table_sliding';
      return 'prop_moss_table';
    }
    if (kind === 'rotten_totem_pillar' && coverState === 'fallen') {
      return 'prop_rotten_totem_pillar_fallen';
    }
    if (kind === 'glacial_barricade') {
      return coverState === 'flipped' ? 'prop_moss_table_flipped' : 'prop_crystal_pillar';
    }
    if (kind === 'sliding_ice_block') return 'prop_push_block';
    if (kind === 'cryo_prism_pillar') return 'prop_crystal_pillar';
    if (kind === 'forge_blast_shield') {
      return coverState === 'flipped' ? 'prop_moss_table_flipped' : 'prop_moss_table';
    }
    if (kind === 'pneumatic_press') return 'prop_ancient_mechanism';
    if (kind === 'slag_crucible') return 'prop_explosive_barrel';
    return `prop_${kind}`;
  }

  public static getWeaponTextureKey(weaponId: string): string {
    return `weapon_vec_${weaponId}`;
  }

  public static getChestTextureKey(rarity: string, opened: boolean): string {
    return `chest_${opened ? 'open' : 'closed'}_${rarity}`;
  }

  public static bakeGalleryPage1(scene: Phaser.Scene, cameraZoom = 1.5): number {
    const targetScale = this.computeBakeScale(cameraZoom);
    if (this.currentBakeScale === targetScale && scene.textures.exists('player_ring_1')) {
      return this.currentBakeScale;
    }
    this.currentBakeScale = targetScale;

    for (const rig of ALL_SAMPLE_RIGS) {
      if (
        rig.id === 'vanguard' ||
        rig.id === 'ranger' ||
        rig.id === 'elementalist' ||
        rig.id === 'druid' ||
        rig.id === 'engineer' ||
        rig.id === 'goblin_shooter'
      ) {
        this.bakeRig(scene, rig, targetScale);
      }
    }
    for (const wKey of ['knight_sword', 'hunter_crossbow', 'rivet_gun'] as const) {
      const wDef = WEAPON_VECTOR_DEFS[wKey];
      if (wDef) this.bakeWeapon(scene, wDef, targetScale);
    }

    for (const slot of [1, 2, 3, 4] as const) {
      this.bakePlayerRing(scene, slot, targetScale);
    }
    for (const biome of [0, 1, 2, 3] as const) {
      for (let v = 0; v < 8; v++) {
        this.bakeBiomeTile(scene, biome, v, targetScale);
      }
    }
    return targetScale;
  }

  public static bakeAll(scene: Phaser.Scene, cameraZoom = 1.5, force = false): number {
    const targetScale = this.computeBakeScale(cameraZoom);
    if (
      !force &&
      this.fullBakeScale === targetScale &&
      scene.textures.exists('player_ring_1') &&
      scene.textures.exists('ui_crosshair') &&
      scene.textures.exists('fx_light_radial') &&
      scene.textures.exists('fx_impact_ring') &&
      scene.textures.exists('chest_closed_legendary') &&
      scene.textures.exists('portal_pedestal_base') &&
      scene.textures.exists('portal_particle_mote') &&
      scene.textures.exists('door_frame_ns_0') &&
      scene.textures.exists('door_unlock_spark') &&
      scene.textures.exists('biome_tile_0_0')
    ) {
      this.currentBakeScale = targetScale;
      return this.currentBakeScale;
    }

    this.currentBakeScale = targetScale;
    this.fullBakeScale = targetScale;

    for (const rig of ALL_SAMPLE_RIGS) {
      this.bakeRig(scene, rig, targetScale);
    }

    for (const weaponDef of Object.values(WEAPON_VECTOR_DEFS)) {
      this.bakeWeapon(scene, weaponDef, targetScale);
    }

    for (const slot of [1, 2, 3, 4] as const) {
      this.bakePlayerRing(scene, slot, targetScale);
    }

    for (const biome of [0, 1, 2, 3] as const) {
      for (let v = 0; v < 8; v++) {
        this.bakeBiomeTile(scene, biome, v, targetScale);
      }
      for (let mask = 0; mask < 16; mask++) {
        this.bakeWallTile(scene, biome, mask, targetScale);
        this.bakePillarTile(scene, biome, mask, targetScale);
      }
      this.bakeCrackedWallTile(scene, biome, targetScale);
    }

    for (let aoMask = 1; aoMask <= 7; aoMask++) {
      this.bakeWallAoOverlay(scene, aoMask, targetScale);
    }

    this.bakeSurfaces(scene, targetScale);
    this.bakeProps(scene, targetScale);
    this.bakePortalsAndDoors(scene, targetScale);
    this.bakeProjectilesAndFx(scene, targetScale);
    if (!scene.textures.exists('fx_light_radial')) {
      this.bakeLightRadialBrush(scene);
    }
    this.bakeCrosshair(scene, targetScale);

    return targetScale;
  }

  private static bakeRig(scene: Phaser.Scene, rig: EntityRigDef, scale: number): void {
    this.bakeShadow(scene, rig, scale);
    this.bakeFullRigComposite(scene, rig, scale);
    for (const part of rig.parts) {
      this.bakeRigPart(scene, rig.id, part, scale);
    }
  }

  private static drawSoftEllipticalShadow(
    ctx: CanvasRenderingContext2D,
    shadowRx: number,
    shadowRy: number,
  ): void {
    ctx.save();
    ctx.scale(shadowRx, shadowRy);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.15);
    grad.addColorStop(0, 'rgba(11, 9, 14, 0.54)');
    grad.addColorStop(0.58, 'rgba(11, 9, 14, 0.34)');
    grad.addColorStop(0.85, 'rgba(11, 9, 14, 0.12)');
    grad.addColorStop(1, 'rgba(11, 9, 14, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private static bakeFullRigComposite(scene: Phaser.Scene, rig: EntityRigDef, scale: number): void {
    const key = this.getFullRigTextureKey(rig.id);
    const compScale = Math.min(2, scale);
    const worldW = Math.max(68, rig.worldWidth + 28);
    const worldH = Math.max(64, rig.worldHeight + 28);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(worldW * compScale);
    canvas.height = Math.ceil(worldH * compScale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.scale(compScale, compScale);
    ctx.translate(worldW * 0.5, worldH * 0.78);

    this.drawSoftEllipticalShadow(ctx, rig.shadowRx, rig.shadowRy);

    const sortedParts = [...rig.parts].sort((a, b) => a.zIndex - b.zIndex);
    for (const part of sortedParts) {
      ctx.save();
      ctx.translate(part.offsetX, part.offsetY);
      for (const cmd of part.shapes) {
        renderShapeCommand(ctx, cmd);
      }
      ctx.restore();
    }

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  private static bakeShadow(scene: Phaser.Scene, rig: EntityRigDef, scale: number): void {
    const key = this.getShadowTextureKey(rig.id);
    const w = Math.ceil((rig.shadowRx * 2.4 + 8) * scale);
    const h = Math.ceil((rig.shadowRy * 2.4 + 8) * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(w / (2 * scale), h / (2 * scale));

    this.drawSoftEllipticalShadow(ctx, rig.shadowRx, rig.shadowRy);

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

  private static bakeWeapon(scene: Phaser.Scene, weaponDef: WeaponVectorDef, scale: number): void {
    const key = this.getWeaponTextureKey(weaponDef.id);
    const pad = 8;
    const worldW = weaponDef.width + pad * 2;
    const worldH = weaponDef.height + pad * 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(worldW * scale);
    canvas.height = Math.ceil(worldH * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(worldW * weaponDef.originX, worldH * weaponDef.originY);

    for (const cmd of weaponDef.shapes) {
      renderShapeCommand(ctx, cmd);
    }

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  private static bakePlayerRing(scene: Phaser.Scene, slot: 1 | 2 | 3 | 4, scale: number): void {
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

    // 1. Soft radial gradient inner glow
    ctx.save();
    ctx.scale(rx, ry);
    const glow = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1.08);
    glow.addColorStop(0, `${color}38`);
    glow.addColorStop(0.75, `${color}12`);
    glow.addColorStop(1, `${color}00`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 1.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Softened dark outer halo
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = 'rgba(20, 16, 25, 0.65)';
    ctx.stroke();

    // 3. Harmonious slot-colored ring + 4 subtle cardinal ticks
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-rx - 1.5, 0);
    ctx.lineTo(-rx + 2.2, 0);
    ctx.moveTo(rx - 2.2, 0);
    ctx.lineTo(rx + 1.5, 0);
    ctx.moveTo(0, -ry - 1.2);
    ctx.lineTo(0, -ry + 1.8);
    ctx.moveTo(0, ry - 1.8);
    ctx.lineTo(0, ry + 1.2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  public static bakeBiomeTile(
    scene: Phaser.Scene,
    biome: 0 | 1 | 2 | 3,
    variant: number,
    scale: number,
  ): void {
    bakeBiomeTile(scene, biome, variant, scale);
  }

  public static bakeWallTile(
    scene: Phaser.Scene,
    biome: 0 | 1 | 2 | 3,
    mask: number,
    scale: number,
  ): void {
    bakeWallTile(scene, biome, mask, scale);
  }

  public static bakePillarTile(
    scene: Phaser.Scene,
    biome: 0 | 1 | 2 | 3,
    mask: number,
    scale: number,
  ): void {
    bakePillarTile(scene, biome, mask, scale);
  }

  public static bakeCrackedWallTile(scene: Phaser.Scene, biome: 0 | 1 | 2 | 3, scale: number): void {
    bakeCrackedWallTile(scene, biome, scale);
  }

  public static bakeWallAoOverlay(scene: Phaser.Scene, aoMask: number, scale: number): void {
    bakeWallAoOverlay(scene, aoMask, scale);
  }

  public static bakeSurfaces(scene: Phaser.Scene, scale: number): void {
    bakeSurfaces(scene, scale);
  }

  public static drawSurfaceTile(
    ctx: CanvasRenderingContext2D,
    surface: Exclude<SurfaceKind, 'none'>,
    surfaceMask: number,
    dx: number,
    dy: number,
    cellPx: number,
    variant = 0,
    biome: 0 | 1 | 2 | 3 = 1,
  ): void {
    drawSurfaceTile(ctx, surface, surfaceMask, dx, dy, cellPx, variant, biome);
  }

  public static bakeProps(scene: Phaser.Scene, scale: number): void {
    bakeProps(scene, scale);
  }

  public static bakePortalsAndDoors(scene: Phaser.Scene, scale: number): void {
    bakePortalsAndDoors(scene, scale);
  }

  public static bakeLightRadialBrush(scene: Phaser.Scene): void {
    bakeLightRadialBrush(scene);
  }

  public static bakeProjectilesAndFx(scene: Phaser.Scene, scale: number): void {
    bakeProjectilesAndFx(scene, scale);
  }

  public static bakeCrosshair(scene: Phaser.Scene, scale: number): void {
    bakeCrosshair(scene, scale);
  }

  public static bakeCustomCanvas(
    scene: Phaser.Scene,
    key: string,
    worldW: number,
    worldH: number,
    scale: number,
    drawFn: (ctx: CanvasRenderingContext2D) => void,
  ): void {
    bakeCustomCanvas(scene, key, worldW, worldH, scale, drawFn);
  }

  public static registerCanvasTexture(
    scene: Phaser.Scene,
    key: string,
    canvas: HTMLCanvasElement,
  ): void {
    registerCanvasTexture(scene, key, canvas);
  }
}
