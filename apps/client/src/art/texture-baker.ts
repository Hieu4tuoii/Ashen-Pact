import type Phaser from 'phaser';
import {
  AUTOTILE_EAST,
  AUTOTILE_NORTH,
  AUTOTILE_SOUTH,
  AUTOTILE_WEST,
  type PropKind,
  SeededRandom,
  type SurfaceKind,
  WALL_AO_NORTH,
  WALL_AO_NORTH_WEST,
  WALL_AO_WEST,
} from '@ashen-pact/shared';
import { BIOME_THEMES, PALETTE, type PaletteHex, PLAYER_SLOT_COLORS } from './palette.js';
import { outlined, renderShapeCommand, tracePolygon, traceRoundedRect } from './primitives.js';
import {
  ALL_SAMPLE_RIGS,
  type EntityRigDef,
  type RigPartDef,
  WEAPON_VECTOR_DEFS,
  type WeaponVectorDef,
} from './rig-defs.js';

/**
 * DPR-aware procedural texture baker.
 * Bakes vector primitives once into high-DPI WebGL textures so runtime entities,
 * weapons, projectiles, autotiled walls, interactive surfaces, props, decals, and particles
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

  public static getFullRigTextureKey(rigId: string): string {
    return `rig_full_${rigId}`;
  }

  public static getShadowTextureKey(rigId: string): string {
    return `rig_shadow_${rigId}`;
  }

  public static getPlayerRingTextureKey(slot: 1 | 2 | 3 | 4): string {
    return `player_ring_${slot}`;
  }

  public static getBiomeTileTextureKey(biome: 1 | 2 | 3, variant = 0): string {
    return `biome_tile_${biome}_${variant % 8}`;
  }

  public static getWallTileTextureKey(biome: 1 | 2 | 3 = 1, mask = 0): string {
    return mask === 0 ? `biome_wall_${biome}` : `biome_wall_${biome}_${mask & 15}`;
  }

  public static getPillarTileTextureKey(biome: 1 | 2 | 3 = 1, mask = 0): string {
    return mask === 0 ? `biome_pillar_${biome}` : `biome_pillar_${biome}_${mask & 15}`;
  }

  public static getCrackedWallTextureKey(biome: 1 | 2 | 3 = 1): string {
    return `biome_cracked_wall_${biome}`;
  }

  public static getWallAoTextureKey(aoMask: number): string {
    return `wall_ao_${aoMask & 7}`;
  }

  public static getSurfaceTextureKey(surface: Exclude<SurfaceKind, 'none'>): string {
    return `surface_${surface}`;
  }

  public static getPropTextureKey(kind: PropKind): string {
    return `prop_${kind}`;
  }

  public static getWeaponTextureKey(weaponId: string): string {
    return `weapon_vec_${weaponId}`;
  }

  public static bakeAll(scene: Phaser.Scene, cameraZoom = 1.5, force = false): number {
    const targetScale = this.computeBakeScale(cameraZoom);
    if (
      !force &&
      this.currentBakeScale === targetScale &&
      scene.textures.exists('player_ring_1') &&
      scene.textures.exists('ui_crosshair') &&
      scene.textures.exists('fx_light_radial')
    ) {
      return this.currentBakeScale;
    }

    this.currentBakeScale = targetScale;

    for (const rig of ALL_SAMPLE_RIGS) {
      this.bakeRig(scene, rig, targetScale);
    }

    for (const weaponDef of Object.values(WEAPON_VECTOR_DEFS)) {
      this.bakeWeapon(scene, weaponDef, targetScale);
    }

    for (const slot of [1, 2, 3, 4] as const) {
      this.bakePlayerRing(scene, slot, targetScale);
    }

    for (const biome of [1, 2, 3] as const) {
      const variantCount = biome === 1 ? 8 : 4;
      for (let v = 0; v < variantCount; v++) {
        this.bakeBiomeTile(scene, biome, v, targetScale);
      }
      if (biome === 1) {
        for (let mask = 0; mask < 16; mask++) {
          this.bakeWallTile(scene, biome, mask, targetScale);
          this.bakePillarTile(scene, biome, mask, targetScale);
        }
        this.bakeCrackedWallTile(scene, biome, targetScale);
      } else {
        this.bakeWallTile(scene, biome, 0, targetScale);
        this.bakePillarTile(scene, biome, 0, targetScale);
      }
    }

    for (let aoMask = 1; aoMask <= 7; aoMask++) {
      this.bakeWallAoOverlay(scene, aoMask, targetScale);
    }

    this.bakeSurfaces(scene, targetScale);
    this.bakeProps(scene, targetScale);
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

  private static bakeFullRigComposite(
    scene: Phaser.Scene,
    rig: EntityRigDef,
    scale: number,
  ): void {
    const key = this.getFullRigTextureKey(rig.id);
    const compScale = Math.min(2, scale);
    const worldW = 68;
    const worldH = 64;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(worldW * compScale);
    canvas.height = Math.ceil(worldH * compScale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.scale(compScale, compScale);
    ctx.translate(worldW * 0.5, worldH * 0.78);

    ctx.beginPath();
    ctx.ellipse(0, 0, rig.shadowRx, rig.shadowRy, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(11, 9, 14, 0.48)';
    ctx.fill();

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
    ctx.fillStyle = 'rgba(11, 9, 14, 0.48)';
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

  private static bakeWeapon(
    scene: Phaser.Scene,
    weaponDef: WeaponVectorDef,
    scale: number,
  ): void {
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

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 4.2;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = color;
    ctx.stroke();

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

    ctx.fillStyle = theme.bgDark;
    ctx.fillRect(0, 0, size, size);

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

    // Top-left rim light bevel
    ctx.beginPath();
    ctx.moveTo(3.5, 24);
    ctx.lineTo(3.5, 3.5);
    ctx.lineTo(24, 3.5);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = theme.floorHighlight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Seeded procedural floor detail per variant (0..7)
    const detailMode = variant % 4;
    if (detailMode === 0) {
      // Bioluminescent spore / crystal speck
      const cx = rng.nextFloat(9, 23);
      const cy = rng.nextFloat(9, 23);
      ctx.beginPath();
      ctx.arc(cx, cy, rng.nextFloat(1.5, 2.3), 0, Math.PI * 2);
      ctx.fillStyle = theme.accentGlow;
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();
    } else if (detailMode === 1) {
      // Jagged stone fracture line
      ctx.beginPath();
      ctx.moveTo(rng.nextFloat(7, 13), rng.nextFloat(7, 13));
      ctx.lineTo(rng.nextFloat(14, 19), rng.nextFloat(14, 19));
      ctx.lineTo(rng.nextFloat(19, 25), rng.nextFloat(12, 23));
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (detailMode === 2) {
      // Small moss tuft / stone pebbles
      for (let i = 0; i < 2; i++) {
        const px = rng.nextFloat(8, 24);
        const py = rng.nextFloat(8, 24);
        ctx.beginPath();
        ctx.ellipse(px, py, 2.2, 1.5, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = theme.floorHighlight;
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.stroke();
      }
    } else {
      // Subtle recessed stone paver seam
      ctx.strokeStyle = theme.floorShade;
      ctx.lineWidth = 1.0;
      ctx.strokeRect(8, 8, 16, 16);
    }

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  /**
   * Bakes neighbor-aware autotiled wall tile with 2.5D south cliff face and top-left bevels.
   */
  private static bakeWallTile(
    scene: Phaser.Scene,
    biome: 1 | 2 | 3,
    mask: number,
    scale: number,
  ): void {
    const key = this.getWallTileTextureKey(biome, mask);
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(size * scale);
    canvas.height = Math.ceil(size * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const hasN = (mask & AUTOTILE_NORTH) !== 0;
    const hasE = (mask & AUTOTILE_EAST) !== 0;
    const hasS = (mask & AUTOTILE_SOUTH) !== 0;
    const hasW = (mask & AUTOTILE_WEST) !== 0;

    ctx.save();
    ctx.scale(scale, scale);

    ctx.fillStyle = BIOME_THEMES[biome].floorBase;
    ctx.fillRect(0, 0, size, size);

    const padN = hasN ? 0 : 1.5;
    const padW = hasW ? 0 : 1.5;
    const padE = hasE ? 0 : 1.5;
    // When South is floor (!hasS), expose a 7u tall 3D stone cliff face at the bottom of the wall tile
    const cliffH = hasS ? 0 : 7;
    const padS = hasS ? 0 : cliffH + 1.5;

    const capX = padW;
    const capY = padN;
    const capW = size - padW - padE;
    const capH = size - padN - padS;

    // 1. Fill top stone cap
    ctx.fillStyle = PALETTE.SLATE_MID;
    ctx.fillRect(capX, capY, capW, capH);

    // 2. Subtle top-left directional bevel & bottom-right shade
    if (!hasN) {
      ctx.fillStyle = PALETTE.ASH_GRAY;
      ctx.fillRect(capX, capY, capW, 3.2);
    }
    if (!hasW) {
      ctx.fillStyle = PALETTE.ASH_GRAY;
      ctx.fillRect(capX, capY, 3.2, capH);
    }
    if (!hasE) {
      ctx.fillStyle = PALETTE.SLATE_DARK;
      ctx.fillRect(capX + capW - 2.8, capY, 2.8, capH);
    }
    if (!hasS) {
      ctx.fillStyle = PALETTE.SLATE_DARK;
      ctx.fillRect(capX, capY + capH - 2.5, capW, 2.5);
    }

    // 3. Continuous stone block mortar seams across connected wall tiles
    ctx.strokeStyle = PALETTE.SLATE_DARK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (capY < 13 && capY + capH > 15) {
      ctx.moveTo(capX, 14);
      ctx.lineTo(capX + capW, 14);
    }
    ctx.moveTo(16, capY);
    ctx.lineTo(16, Math.min(capY + capH, 14));
    if (capY + capH > 14) {
      ctx.moveTo(8, Math.max(capY, 14));
      ctx.lineTo(8, capY + capH);
      ctx.moveTo(24, Math.max(capY, 14));
      ctx.lineTo(24, capY + capH);
    }
    ctx.stroke();

    // 4. Moss / rune accent on wall top
    ctx.beginPath();
    ctx.arc(11, 9, 2.1, 0, Math.PI * 2);
    ctx.fillStyle = BIOME_THEMES[biome].floorHighlight;
    ctx.fill();

    // 5. 3D South Cliff Face when South is exposed (!hasS)
    if (!hasS) {
      const cliffY = size - cliffH - 1.5;
      ctx.fillStyle = PALETTE.SLATE_DARK;
      ctx.fillRect(capX, cliffY, capW, cliffH);
      ctx.fillStyle = PALETTE.INK_DEEP;
      ctx.fillRect(capX, cliffY + cliffH - 2, capW, 2);

      // Vertical stone mortar joints on cliff face
      ctx.beginPath();
      ctx.moveTo(11, cliffY + 0.5);
      ctx.lineTo(11, cliffY + cliffH - 0.5);
      ctx.moveTo(22, cliffY + 0.5);
      ctx.lineTo(22, cliffY + cliffH - 0.5);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();
    }

    // 6. Top-left directional rim highlight on exposed N/W edges
    ctx.beginPath();
    if (!hasW) {
      ctx.moveTo(capX + 1.8, capY + capH - 1);
      ctx.lineTo(capX + 1.8, capY + 1.8);
    }
    if (!hasN) {
      ctx.moveTo(capX + 1.8, capY + 1.8);
      ctx.lineTo(capX + capW - 1, capY + 1.8);
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.WARM_STONE;
    ctx.stroke();

    // 7. Crisp dark outlines ONLY along exposed non-connected edges
    ctx.beginPath();
    if (!hasN) {
      ctx.moveTo(capX, capY);
      ctx.lineTo(capX + capW, capY);
    }
    if (!hasW) {
      ctx.moveTo(capX, capY);
      ctx.lineTo(capX, hasS ? size : size - 1.5);
    }
    if (!hasE) {
      ctx.moveTo(capX + capW, capY);
      ctx.lineTo(capX + capW, hasS ? size : size - 1.5);
    }
    if (!hasS) {
      const cliffY = size - cliffH - 1.5;
      // Ridge line between cap and South cliff
      ctx.moveTo(capX, cliffY);
      ctx.lineTo(capX + capW, cliffY);
      // Bottom base outline of South cliff
      ctx.moveTo(capX, size - 1.5);
      ctx.lineTo(capX + capW, size - 1.5);
    }
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  private static bakePillarTile(
    scene: Phaser.Scene,
    biome: 1 | 2 | 3,
    mask: number,
    scale: number,
  ): void {
    const key = this.getPillarTileTextureKey(biome, mask);
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(size * scale);
    canvas.height = Math.ceil(size * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const hasN = (mask & AUTOTILE_NORTH) !== 0;
    const hasE = (mask & AUTOTILE_EAST) !== 0;
    const hasS = (mask & AUTOTILE_SOUTH) !== 0;
    const hasW = (mask & AUTOTILE_WEST) !== 0;

    ctx.save();
    ctx.scale(scale, scale);

    // Underlying biome floor in exposed margin
    ctx.fillStyle = BIOME_THEMES[biome].floorBase;
    ctx.fillRect(0, 0, size, size);

    const padN = hasN ? 0 : 2;
    const padW = hasW ? 0 : 2;
    const padE = hasE ? 0 : 2;
    const cliffH = hasS ? 0 : 6.5;
    const padS = hasS ? 0 : cliffH + 1.5;

    const capX = padW;
    const capY = padN;
    const capW = size - padW - padE;
    const capH = size - padN - padS;

    // 1. Monolithic pillar top surface
    ctx.fillStyle = PALETTE.WARM_STONE;
    ctx.fillRect(capX, capY, capW, capH);

    // 2. Exposed bevels (top-left Bone White highlight, bottom-right Ash Gray shade)
    if (!hasN) {
      ctx.fillStyle = PALETTE.BONE_WHITE;
      ctx.fillRect(capX, capY, capW, 3.2);
    }
    if (!hasW) {
      ctx.fillStyle = PALETTE.BONE_WHITE;
      ctx.fillRect(capX, capY, 3.2, capH);
    }
    if (!hasE) {
      ctx.fillStyle = PALETTE.ASH_GRAY;
      ctx.fillRect(capX + capW - 3, capY, 3, capH);
    }
    if (!hasS) {
      ctx.fillStyle = PALETTE.ASH_GRAY;
      ctx.fillRect(capX, capY + capH - 2.8, capW, 2.8);
    }

    // 3. Carved inner frame on pillar cap
    const inN = hasN ? 0 : capY + 5;
    const inW = hasW ? 0 : capX + 5;
    const inE = hasE ? size : capX + capW - 5;
    const inS = hasS ? size : capY + capH - 5;
    ctx.strokeStyle = PALETTE.SLATE_MID;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (!hasN) {
      ctx.moveTo(inW, inN);
      ctx.lineTo(inE, inN);
    }
    if (!hasW) {
      ctx.moveTo(inW, inN);
      ctx.lineTo(inW, inS);
    }
    if (!hasE) {
      ctx.moveTo(inE, inN);
      ctx.lineTo(inE, inS);
    }
    if (!hasS) {
      ctx.moveTo(inW, inS);
      ctx.lineTo(inE, inS);
    }
    ctx.stroke();

    // 4. Unified central rune medallion at the shared center of a 2x2 pillar (or tile center if 1x1)
    const runeCx = hasE && !hasW ? size : hasW && !hasE ? 0 : 16;
    const runeCy = hasS && !hasN ? size : hasN && !hasS ? 0 : 13;
    ctx.save();
    ctx.beginPath();
    ctx.rect(capX, capY, capW, capH);
    ctx.clip();

    ctx.beginPath();
    ctx.arc(runeCx, runeCy, 7.2, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.SLATE_DARK;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(runeCx, runeCy, 4.4, 0, Math.PI * 2);
    ctx.fillStyle = BIOME_THEMES[biome].accentGlow;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();
    ctx.restore();

    // 5. 3D South Cliff Face when !hasS
    if (!hasS) {
      const cliffY = size - cliffH - 1.5;
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fillRect(capX, cliffY, capW, cliffH);
      ctx.fillStyle = PALETTE.SLATE_DARK;
      ctx.fillRect(capX, cliffY + cliffH - 2, capW, 2);

      // Vertical fluting lines on pillar cliff face
      ctx.beginPath();
      ctx.moveTo(10, cliffY + 0.5);
      ctx.lineTo(10, cliffY + cliffH - 0.5);
      ctx.moveTo(22, cliffY + 0.5);
      ctx.lineTo(22, cliffY + cliffH - 0.5);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();
    }

    // 6. Dark outlines ONLY along exposed edges of the pillar
    ctx.beginPath();
    if (!hasN) {
      ctx.moveTo(capX, capY);
      ctx.lineTo(capX + capW, capY);
    }
    if (!hasW) {
      ctx.moveTo(capX, capY);
      ctx.lineTo(capX, hasS ? size : size - 1.5);
    }
    if (!hasE) {
      ctx.moveTo(capX + capW, capY);
      ctx.lineTo(capX + capW, hasS ? size : size - 1.5);
    }
    if (!hasS) {
      const cliffY = size - cliffH - 1.5;
      ctx.moveTo(capX, cliffY);
      ctx.lineTo(capX + capW, cliffY);
      ctx.moveTo(capX, size - 1.5);
      ctx.lineTo(capX + capW, size - 1.5);
    }
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  private static bakeCrackedWallTile(
    scene: Phaser.Scene,
    biome: 1 | 2 | 3,
    scale: number,
  ): void {
    const key = this.getCrackedWallTextureKey(biome);
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(size * scale);
    canvas.height = Math.ceil(size * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.scale(scale, scale);

    ctx.fillStyle = PALETTE.INK_DEEP;
    ctx.fillRect(0, 0, size, size);

    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_MID,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.WARM_STONE,
        outlineColor: PALETTE.INK_DARK,
        outlineWidth: 2.0,
      },
      (c) => traceRoundedRect(c, 1.5, 1.5, size - 3, size - 6, 3),
      { cx: 16, cy: 13, rx: 14, ry: 12 },
    );

    // Glowing secret fracture fissures indicating destructible wall
    ctx.beginPath();
    ctx.moveTo(8, 5);
    ctx.lineTo(15, 12);
    ctx.lineTo(12, 20);
    ctx.lineTo(21, 25);
    ctx.moveTo(15, 12);
    ctx.lineTo(24, 9);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.lineWidth = 1.4;
    ctx.strokeStyle = PALETTE.SOLAR_GOLD;
    ctx.stroke();

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  /**
   * Bakes directional ambient occlusion / drop-shadow overlay cast by North, West, and North-West walls.
   */
  private static bakeWallAoOverlay(scene: Phaser.Scene, aoMask: number, scale: number): void {
    const key = this.getWallAoTextureKey(aoMask);
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(size * scale);
    canvas.height = Math.ceil(size * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.scale(scale, scale);

    if (aoMask & WALL_AO_NORTH) {
      const gradN = ctx.createLinearGradient(0, 0, 0, 13);
      gradN.addColorStop(0, 'rgba(11, 9, 14, 0.52)');
      gradN.addColorStop(1, 'rgba(11, 9, 14, 0)');
      ctx.fillStyle = gradN;
      ctx.fillRect(0, 0, size, 13);
    }

    if (aoMask & WALL_AO_WEST) {
      const gradW = ctx.createLinearGradient(0, 0, 11, 0);
      gradW.addColorStop(0, 'rgba(11, 9, 14, 0.44)');
      gradW.addColorStop(1, 'rgba(11, 9, 14, 0)');
      ctx.fillStyle = gradW;
      ctx.fillRect(0, 0, 11, size);
    }

    if (
      (aoMask & WALL_AO_NORTH_WEST) &&
      !(aoMask & WALL_AO_NORTH) &&
      !(aoMask & WALL_AO_WEST)
    ) {
      const gradNW = ctx.createRadialGradient(0, 0, 1, 0, 0, 13);
      gradNW.addColorStop(0, 'rgba(11, 9, 14, 0.45)');
      gradNW.addColorStop(1, 'rgba(11, 9, 14, 0)');
      ctx.fillStyle = gradNW;
      ctx.fillRect(0, 0, 13, 13);
    }

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  private static bakeSurfaces(scene: Phaser.Scene, scale: number): void {
    // 1. Water
    this.bakeCustomCanvas(scene, 'surface_water', 32, 32, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.ABYSS_BLUE,
          shade: PALETTE.COBALT_SHADE,
          highlight: PALETTE.CYAN_FROST,
          outlineWidth: 1.6,
        },
        (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 5),
        { cx: 0, cy: 0, rx: 14, ry: 14 },
      );
      ctx.beginPath();
      ctx.arc(-4, -3, 4.5, 0, Math.PI * 1.4);
      ctx.strokeStyle = PALETTE.ICE_WHITE;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });

    // 2. Electrified Water
    this.bakeCustomCanvas(scene, 'surface_electrified_water', 32, 32, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.AZURE_CORE,
          shade: PALETTE.COBALT_SHADE,
          highlight: PALETTE.CYAN_FROST,
          outlineWidth: 1.8,
        },
        (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 5),
        { cx: 0, cy: 0, rx: 14, ry: 14 },
      );
      // Jagged lightning arc on water surface
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.lineTo(-2, -1);
      ctx.lineTo(-5, 4);
      ctx.lineTo(9, 8);
      ctx.strokeStyle = PALETTE.VOLT_YELLOW;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.stroke();
    });

    // 3. Oil (iridescent dark petroleum sheen instead of flat black)
    this.bakeCustomCanvas(scene, 'surface_oil', 32, 32, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.SLATE_MID,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.TOXIC_PURPLE,
          outlineWidth: 1.8,
        },
        (c) => traceRoundedRect(c, -14, -14, 28, 28, 6),
        { cx: 0, cy: 0, rx: 14, ry: 14 },
      );
      ctx.beginPath();
      ctx.ellipse(-3, -3, 6.5, 3.2, -0.35, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.TOXIC_PURPLE;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(4, 4, 4.5, 2.0, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.COBALT_SHADE;
      ctx.fill();
    });

    // 4. Burning Oil
    this.bakeCustomCanvas(scene, 'surface_burning_oil', 32, 32, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.FLAME_ORANGE,
          shade: PALETTE.MAGMA_RED,
          highlight: PALETTE.SOLAR_GOLD,
          outlineWidth: 2.0,
        },
        (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 6),
        { cx: 0, cy: 0, rx: 14, ry: 14 },
      );
      tracePolygon(ctx, [
        { x: -6, y: 6 },
        { x: -2, y: -9 },
        { x: 2, y: -1 },
        { x: 6, y: -10 },
        { x: 9, y: 6 },
      ]);
      ctx.fillStyle = PALETTE.SOLAR_GOLD;
      ctx.fill();
    });

    // 5. Grass
    this.bakeCustomCanvas(scene, 'surface_grass', 32, 32, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.FOREST_SHADE,
          shade: PALETTE.MOSS_DARK,
          highlight: PALETTE.GOBLIN_GREEN,
          outlineWidth: 1.6,
        },
        (c) => traceRoundedRect(c, -14, -14, 28, 28, 5),
        { cx: 0, cy: 0, rx: 14, ry: 14 },
      );
      // Stylized grass blades
      for (const ox of [-6, 1, 7]) {
        tracePolygon(ctx, [
          { x: ox - 2.5, y: 6 },
          { x: ox, y: -6 },
          { x: ox + 2.5, y: 6 },
        ]);
        ctx.fillStyle = PALETTE.LIME_GLOW;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.stroke();
      }
    });

    // 6. Burning Grass
    this.bakeCustomCanvas(scene, 'surface_burning_grass', 32, 32, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.MAGMA_RED,
          shade: PALETTE.FORGE_DARK,
          highlight: PALETTE.FLAME_ORANGE,
          outlineWidth: 1.8,
        },
        (c) => traceRoundedRect(c, -14, -14, 28, 28, 5),
        { cx: 0, cy: 0, rx: 14, ry: 14 },
      );
      for (const ox of [-5, 3]) {
        tracePolygon(ctx, [
          { x: ox - 3, y: 6 },
          { x: ox, y: -8 },
          { x: ox + 3, y: 6 },
        ]);
        ctx.fillStyle = PALETTE.SOLAR_GOLD;
        ctx.fill();
      }
    });

    // 7. Ash
    this.bakeCustomCanvas(scene, 'surface_ash', 32, 32, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.SLATE_DARK,
          shade: PALETTE.INK_DEEP,
          highlight: PALETTE.ASH_GRAY,
          outlineWidth: 1.4,
        },
        (c) => traceRoundedRect(c, -13, -13, 26, 26, 6),
        { cx: 0, cy: 0, rx: 13, ry: 13 },
      );
    });

    // 8. Poison Swamp
    this.bakeCustomCanvas(scene, 'surface_poison_swamp', 32, 32, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.TOXIC_PURPLE,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.ELECTRIC_VIOLET,
          outlineWidth: 1.8,
        },
        (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 6),
        { cx: 0, cy: 0, rx: 14, ry: 14 },
      );
      for (const [bx, by, br] of [
        [-5, -3, 3.2],
        [5, 4, 2.5],
      ] as const) {
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.LIME_GLOW;
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.stroke();
      }
    });

    // 9. Lava
    this.bakeCustomCanvas(scene, 'surface_lava', 32, 32, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.MAGMA_RED,
          shade: PALETTE.FORGE_DARK,
          highlight: PALETTE.FLAME_ORANGE,
          outlineWidth: 2.0,
        },
        (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 5),
        { cx: 0, cy: 0, rx: 14, ry: 14 },
      );
      ctx.beginPath();
      ctx.moveTo(-9, -6);
      ctx.lineTo(0, 2);
      ctx.lineTo(9, -4);
      ctx.strokeStyle = PALETTE.SOLAR_GOLD;
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.stroke();
    });

    // 10. Ice
    this.bakeCustomCanvas(scene, 'surface_ice', 32, 32, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.CYAN_FROST,
          shade: PALETTE.AZURE_CORE,
          highlight: PALETTE.ICE_WHITE,
          outlineWidth: 1.7,
        },
        (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 5),
        { cx: 0, cy: 0, rx: 14, ry: 14 },
      );
      ctx.beginPath();
      ctx.moveTo(-8, 6);
      ctx.lineTo(6, -8);
      ctx.moveTo(-2, 8);
      ctx.lineTo(9, -3);
      ctx.strokeStyle = PALETTE.BONE_WHITE;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.stroke();
    });
  }

  /**
   * Draws a neighbor-aware interactive surface cell directly onto the arena composite canvas
   * so multi-tile pools (water, oil, grass, swamp, lava, ice) join seamlessly without grid seams.
   */
  public static drawSurfaceTile(
    ctx: CanvasRenderingContext2D,
    surface: Exclude<SurfaceKind, 'none'>,
    surfaceMask: number,
    dx: number,
    dy: number,
    cellPx: number,
    variant = 0,
  ): void {
    const scale = cellPx / 32;
    const hasN = (surfaceMask & AUTOTILE_NORTH) !== 0;
    const hasE = (surfaceMask & AUTOTILE_EAST) !== 0;
    const hasS = (surfaceMask & AUTOTILE_SOUTH) !== 0;
    const hasW = (surfaceMask & AUTOTILE_WEST) !== 0;

    let fill: string = PALETTE.ABYSS_BLUE;
    let rim: string = PALETTE.CYAN_FROST;
    let shade: string = PALETTE.COBALT_SHADE;

    switch (surface) {
      case 'water':
        fill = PALETTE.ABYSS_BLUE;
        rim = PALETTE.CYAN_FROST;
        shade = PALETTE.COBALT_SHADE;
        break;
      case 'electrified_water':
        fill = PALETTE.AZURE_CORE;
        rim = PALETTE.VOLT_YELLOW;
        shade = PALETTE.COBALT_SHADE;
        break;
      case 'oil':
        fill = '#262038';
        rim = '#4C3D73';
        shade = PALETTE.SLATE_DARK;
        break;
      case 'burning_oil':
        fill = PALETTE.FLAME_ORANGE;
        rim = PALETTE.SOLAR_GOLD;
        shade = PALETTE.MAGMA_RED;
        break;
      case 'grass':
        fill = PALETTE.FOREST_SHADE;
        rim = PALETTE.GOBLIN_GREEN;
        shade = PALETTE.MOSS_DARK;
        break;
      case 'burning_grass':
        fill = PALETTE.MAGMA_RED;
        rim = PALETTE.FLAME_ORANGE;
        shade = PALETTE.FORGE_DARK;
        break;
      case 'ash':
        fill = PALETTE.SLATE_DARK;
        rim = PALETTE.ASH_GRAY;
        shade = PALETTE.INK_DEEP;
        break;
      case 'poison_swamp':
        fill = PALETTE.TOXIC_PURPLE;
        rim = PALETTE.ELECTRIC_VIOLET;
        shade = PALETTE.SLATE_DARK;
        break;
      case 'lava':
        fill = PALETTE.MAGMA_RED;
        rim = PALETTE.SOLAR_GOLD;
        shade = PALETTE.FORGE_DARK;
        break;
      case 'ice':
        fill = PALETTE.CYAN_FROST;
        rim = PALETTE.ICE_WHITE;
        shade = PALETTE.AZURE_CORE;
        break;
    }

    const padN = hasN ? 0 : 2.5;
    const padE = hasE ? 0 : 2.5;
    const padS = hasS ? 0 : 2.5;
    const padW = hasW ? 0 : 2.5;

    const sx = padW;
    const sy = padN;
    const sw = 32 - padW - padE;
    const sh = 32 - padN - padS;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.scale(scale, scale);

    // 1. Base surface fill
    ctx.fillStyle = fill;
    ctx.fillRect(sx, sy, sw, sh);

    // 2. Exposed shoreline / rim inner bevel & shade
    if (!hasN) {
      ctx.fillStyle = rim;
      ctx.fillRect(sx, sy, sw, 2.4);
    }
    if (!hasW) {
      ctx.fillStyle = rim;
      ctx.fillRect(sx, sy, 2.4, sh);
    }
    if (!hasS) {
      ctx.fillStyle = shade;
      ctx.fillRect(sx, sy + sh - 2.4, sw, 2.4);
    }
    if (!hasE) {
      ctx.fillStyle = shade;
      ctx.fillRect(sx + sw - 2.4, sy, 2.4, sh);
    }

    // 3. Surface interior details (seeded by variant)
    const ox = ((variant % 3) - 1) * 1.8;
    const oy = ((Math.floor(variant / 3) % 3) - 1) * 1.5;

    switch (surface) {
      case 'water': {
        ctx.beginPath();
        ctx.arc(13 + ox, 14 + oy, 4.2, 0.1, Math.PI * 1.3);
        ctx.strokeStyle = PALETTE.ICE_WHITE;
        ctx.lineWidth = 1.3;
        ctx.stroke();
        break;
      }
      case 'electrified_water': {
        ctx.beginPath();
        ctx.moveTo(7 + ox, 10 + oy);
        ctx.lineTo(15, 15);
        ctx.lineTo(12, 20);
        ctx.lineTo(25 + ox, 24 + oy);
        ctx.strokeStyle = PALETTE.VOLT_YELLOW;
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.stroke();
        break;
      }
      case 'oil': {
        ctx.beginPath();
        ctx.ellipse(13 + ox, 13 + oy, 6.2, 3.0, -0.35, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.TOXIC_PURPLE;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(20 - ox, 20 - oy, 4.5, 2.1, 0.25, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.COBALT_SHADE;
        ctx.fill();
        break;
      }
      case 'burning_oil': {
        tracePolygon(ctx, [
          { x: 10 + ox, y: 22 },
          { x: 14 + ox, y: 8 },
          { x: 18 + ox, y: 15 },
          { x: 22 + ox, y: 7 },
          { x: 25 + ox, y: 22 },
        ]);
        ctx.fillStyle = PALETTE.SOLAR_GOLD;
        ctx.fill();
        break;
      }
      case 'grass': {
        for (const gx of [10, 17, 23]) {
          tracePolygon(ctx, [
            { x: gx + ox - 2.3, y: 22 + oy },
            { x: gx + ox, y: 10 + oy },
            { x: gx + ox + 2.3, y: 22 + oy },
          ]);
          ctx.fillStyle = PALETTE.LIME_GLOW;
          ctx.fill();
          ctx.lineWidth = 1.1;
          ctx.strokeStyle = PALETTE.INK_DARK;
          ctx.stroke();
        }
        break;
      }
      case 'burning_grass': {
        for (const gx of [11, 20]) {
          tracePolygon(ctx, [
            { x: gx + ox - 2.8, y: 22 },
            { x: gx + ox, y: 8 },
            { x: gx + ox + 2.8, y: 22 },
          ]);
          ctx.fillStyle = PALETTE.SOLAR_GOLD;
          ctx.fill();
        }
        break;
      }
      case 'poison_swamp': {
        for (const [bx, by, br] of [
          [11 + ox, 13 + oy, 3.0],
          [21 - ox, 20 - oy, 2.4],
        ] as const) {
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fillStyle = PALETTE.LIME_GLOW;
          ctx.fill();
          ctx.lineWidth = 1.1;
          ctx.strokeStyle = PALETTE.INK_DARK;
          ctx.stroke();
        }
        break;
      }
      case 'lava': {
        ctx.beginPath();
        ctx.moveTo(7 + ox, 11 + oy);
        ctx.lineTo(16, 18 + oy);
        ctx.lineTo(25 - ox, 12 + oy);
        ctx.strokeStyle = PALETTE.SOLAR_GOLD;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.stroke();
        break;
      }
      case 'ice': {
        ctx.beginPath();
        ctx.moveTo(8 + ox, 22);
        ctx.lineTo(22 + ox, 8);
        ctx.moveTo(14 + ox, 24);
        ctx.lineTo(25 + ox, 13);
        ctx.strokeStyle = PALETTE.BONE_WHITE;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();
        break;
      }
      case 'ash':
        break;
    }

    // 4. Outer dark border ONLY on exposed shoreline edges
    ctx.beginPath();
    if (!hasN) {
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + sw, sy);
    }
    if (!hasS) {
      ctx.moveTo(sx, sy + sh);
      ctx.lineTo(sx + sw, sy + sh);
    }
    if (!hasW) {
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + sh);
    }
    if (!hasE) {
      ctx.moveTo(sx + sw, sy);
      ctx.lineTo(sx + sw, sy + sh);
    }
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();

    ctx.restore();
  }

  private static bakeProps(scene: Phaser.Scene, scale: number): void {
    // 1. Wooden Crate
    this.bakeCustomCanvas(scene, 'prop_wooden_crate', 36, 36, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: PALETTE.LEATHER_LIGHT,
          outlineWidth: 2.5,
        },
        (c) => traceRoundedRect(c, -13, -13, 26, 26, 3.5),
        { cx: 0, cy: 0, rx: 13, ry: 13 },
      );
      // Cross brace
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(10, 10);
      ctx.moveTo(10, -10);
      ctx.lineTo(-10, 10);
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();
    });

    // 2. Clay Vase
    this.bakeCustomCanvas(scene, 'prop_clay_vase', 32, 34, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.LEATHER_LIGHT,
          shade: PALETTE.LEATHER_MID,
          highlight: PALETTE.COPPER_LIGHT,
          outlineWidth: 2.5,
        },
        (c) => {
          c.beginPath();
          c.ellipse(0, 2, 10, 11, 0, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 0, cy: 2, rx: 10, ry: 11 },
      );
      outlined(
        ctx,
        {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.BRASS_CORE,
          outlineWidth: 2.0,
        },
        (c) => traceRoundedRect(c, -6.5, -11, 13, 5, 2),
        { cx: 0, cy: -8.5, rx: 6.5, ry: 2.5 },
      );
    });

    // 3. Explosive Barrel
    this.bakeCustomCanvas(scene, 'prop_explosive_barrel', 36, 38, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.RUBY_CORE,
          shade: PALETTE.RUBY_DARK,
          highlight: PALETTE.CRIMSON_BRIGHT,
          outlineWidth: 2.5,
        },
        (c) => traceRoundedRect(c, -12, -14, 24, 28, 6),
        { cx: 0, cy: 0, rx: 12, ry: 14 },
      );
      // Iron bands
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fillRect(-11.5, -8, 23, 3);
      ctx.fillRect(-11.5, 5, 23, 3);
      // Glowing hazard core
      ctx.beginPath();
      ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.SOLAR_GOLD;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();
    });

    // 4. Torch Brazier
    this.bakeCustomCanvas(scene, 'prop_torch_brazier', 34, 38, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.STEEL_DARK,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.STEEL_LIGHT,
          outlineWidth: 2.4,
        },
        (c) => {
          c.beginPath();
          c.arc(0, 3, 10, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 0, cy: 3, rx: 10, ry: 10 },
      );
      outlined(
        ctx,
        {
          fill: PALETTE.FLAME_ORANGE,
          shade: PALETTE.MAGMA_RED,
          highlight: PALETTE.SOLAR_GOLD,
          outlineWidth: 2.0,
        },
        (c) =>
          tracePolygon(c, [
            { x: -7, y: 3 },
            { x: -4, y: -9 },
            { x: 0, y: -14 },
            { x: 5, y: -8 },
            { x: 7, y: 3 },
          ]),
        { cx: 0, cy: -4, rx: 7, ry: 9 },
      );
    });

    // 5. Bioluminescent Glow Mushroom
    this.bakeCustomCanvas(scene, 'prop_glow_mushroom', 32, 32, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.LIME_GLOW,
          shade: PALETTE.GOBLIN_GREEN,
          highlight: PALETTE.MINT_LIGHT,
          outlineWidth: 2.2,
        },
        (c) => {
          c.beginPath();
          c.arc(-2, -2, 8.5, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: -2, cy: -2, rx: 8.5, ry: 8.5 },
      );
      outlined(
        ctx,
        {
          fill: PALETTE.CYAN_FROST,
          shade: PALETTE.AZURE_CORE,
          highlight: PALETTE.ICE_WHITE,
          outlineWidth: 1.8,
        },
        (c) => {
          c.beginPath();
          c.arc(6, 4, 5.2, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 6, cy: 4, rx: 5.2, ry: 5.2 },
      );
    });
  }

  /**
   * Bakes the soft radial falloff light brush texture used by the dynamic RenderTexture Lightmap.
   */
  private static bakeLightRadialBrush(scene: Phaser.Scene): void {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 2, half, half, half);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.65)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    this.registerCanvasTexture(scene, 'fx_light_radial', canvas);
  }

  private static bakeProjectilesAndFx(scene: Phaser.Scene, scale: number): void {
    // 1. Player Projectile Bolt (default cyan/gold)
    this.bakeCustomCanvas(scene, 'proj_player_bolt', 24, 14, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.CYAN_FROST,
          shade: PALETTE.AZURE_CORE,
          highlight: PALETTE.BONE_WHITE,
          outlineWidth: 2.2,
        },
        (c) =>
          tracePolygon(c, [
            { x: -8, y: -3.2 },
            { x: 4, y: -3.8 },
            { x: 9.5, y: 0 },
            { x: 4, y: 3.8 },
            { x: -8, y: 3.2 },
          ]),
        { cx: 0, cy: 0, rx: 8, ry: 4 },
      );
    });

    // Elemental Player Bolts (Burn, Chill, Shock, Poison)
    const elemSkins: readonly [string, PaletteHex, PaletteHex, PaletteHex][] = [
      ['proj_player_burn', PALETTE.FLAME_ORANGE, PALETTE.MAGMA_RED, PALETTE.SOLAR_GOLD],
      ['proj_player_chill', PALETTE.CYAN_FROST, PALETTE.COBALT_SHADE, PALETTE.ICE_WHITE],
      ['proj_player_shock', PALETTE.VOLT_YELLOW, PALETTE.BRASS_CORE, PALETTE.BONE_WHITE],
      ['proj_player_poison', PALETTE.LIME_GLOW, PALETTE.TOXIC_PURPLE, PALETTE.MINT_LIGHT],
    ];
    for (const [key, fill, shade, highlight] of elemSkins) {
      this.bakeCustomCanvas(scene, key, 24, 14, scale, (ctx) => {
        outlined(
          ctx,
          { fill, shade, highlight, outlineWidth: 2.2 },
          (c) =>
            tracePolygon(c, [
              { x: -8, y: -3.4 },
              { x: 4, y: -4.0 },
              { x: 10, y: 0 },
              { x: 4, y: 4.0 },
              { x: -8, y: 3.4 },
            ]),
          { cx: 0, cy: 0, rx: 8, ry: 4 },
        );
      });
    }

    // 2. Player Shotgun Pellet
    this.bakeCustomCanvas(scene, 'proj_player_pellet', 18, 18, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.FLAME_ORANGE,
          highlight: PALETTE.BONE_WHITE,
          outlineWidth: 2.2,
        },
        (c) => {
          c.beginPath();
          c.arc(0, 0, 4.8, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 0, cy: 0, rx: 5, ry: 5 },
      );
    });

    // 3. Enemy Projectile Orb (high saturation crimson, thick dark outline + bright core + outer glow)
    this.bakeCustomCanvas(scene, 'proj_enemy_orb', 24, 24, scale, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232, 69, 69, 0.35)';
      ctx.fill();

      outlined(
        ctx,
        {
          fill: PALETTE.CRIMSON_BRIGHT,
          shade: PALETTE.RUBY_CORE,
          highlight: PALETTE.SOLAR_GOLD,
          outlineColor: PALETTE.INK_DARK,
          outlineWidth: 2.6,
        },
        (c) => {
          c.beginPath();
          c.arc(0, 0, 6.2, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 0, cy: 0, rx: 6, ry: 6 },
      );

      ctx.beginPath();
      ctx.arc(-1, -1, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.BONE_WHITE;
      ctx.fill();
    });

    // 3b. Native 1080p Stress Projectile textures (2x native scale, distinct silhouettes for enemy vs player)
    const stressScale = Math.min(2, scale);
    this.bakeCustomCanvas(scene, 'proj_stress_orb', 16, 16, stressScale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.ICE_WHITE,
          shade: PALETTE.CYAN_FROST,
          highlight: PALETTE.BONE_WHITE,
          outlineColor: PALETTE.INK_DARK,
          outlineWidth: 2.0,
        },
        (c) => {
          c.beginPath();
          c.arc(0, 0, 4.8, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 0, cy: 0, rx: 4.5, ry: 4.5 },
      );
    });

    this.bakeCustomCanvas(scene, 'proj_stress_enemy', 18, 18, stressScale, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232, 69, 69, 0.36)';
      ctx.fill();
      outlined(
        ctx,
        {
          fill: PALETTE.CRIMSON_BRIGHT,
          shade: PALETTE.RUBY_CORE,
          highlight: PALETTE.SOLAR_GOLD,
          outlineColor: PALETTE.INK_DARK,
          outlineWidth: 2.2,
        },
        (c) => {
          c.beginPath();
          c.arc(0, 0, 5.2, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 0, cy: 0, rx: 5, ry: 5 },
      );
      ctx.beginPath();
      ctx.arc(-0.8, -0.8, 2.0, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.BONE_WHITE;
      ctx.fill();
    });

    this.bakeCustomCanvas(scene, 'proj_stress_player', 20, 12, stressScale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.ICE_WHITE,
          shade: PALETTE.SILVER_BRIGHT,
          highlight: PALETTE.BONE_WHITE,
          outlineColor: PALETTE.INK_DARK,
          outlineWidth: 2.0,
        },
        (c) =>
          tracePolygon(c, [
            { x: -6.5, y: -2.8 },
            { x: 3.5, y: -3.2 },
            { x: 8.2, y: 0 },
            { x: 3.5, y: 3.2 },
            { x: -6.5, y: 2.8 },
          ]),
        { cx: 0, cy: 0, rx: 6.5, ry: 3.2 },
      );
    });

    // 4. Melee Slash Crescent Arc
    this.bakeCustomCanvas(scene, 'fx_slash_arc', 110, 110, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.SILVER_BRIGHT,
          shade: PALETTE.CYAN_FROST,
          highlight: PALETTE.BONE_WHITE,
          outlineColor: PALETTE.INK_DARK,
          outlineWidth: 2.2,
        },
        (c) => {
          c.beginPath();
          c.arc(0, 0, 46, -0.95, 0.95, false);
          c.arc(-8, 0, 34, 0.95, -0.95, true);
          c.closePath();
        },
        { cx: 24, cy: 0, rx: 24, ry: 40 },
      );
    });

    // 5. Impact Spark Star
    this.bakeCustomCanvas(scene, 'fx_spark', 18, 18, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.BONE_WHITE,
          outlineColor: PALETTE.INK_DARK,
          outlineWidth: 1.5,
        },
        (c) =>
          tracePolygon(c, [
            { x: -6, y: 0 },
            { x: -1.5, y: -1.8 },
            { x: 0, y: -5 },
            { x: 1.5, y: -1.8 },
            { x: 6, y: 0 },
            { x: 1.5, y: 1.8 },
            { x: 0, y: 5 },
            { x: -1.5, y: 1.8 },
          ]),
        { cx: 0, cy: 0, rx: 6, ry: 5 },
      );
    });

    // 6. Muzzle Flash
    this.bakeCustomCanvas(scene, 'fx_muzzle_flash', 28, 24, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.FLAME_ORANGE,
          highlight: PALETTE.BONE_WHITE,
          outlineWidth: 1.8,
        },
        (c) =>
          tracePolygon(c, [
            { x: -6, y: -4 },
            { x: 4, y: -8 },
            { x: 2, y: -2 },
            { x: 11, y: 0 },
            { x: 2, y: 2 },
            { x: 4, y: 8 },
            { x: -6, y: 4 },
          ]),
        { cx: 2, cy: 0, rx: 8, ry: 7 },
      );
    });

    // 7. Ejected Brass Shell Casing
    this.bakeCustomCanvas(scene, 'fx_shell_casing', 12, 8, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.BRASS_CORE,
          outlineWidth: 1.3,
        },
        (c) => traceRoundedRect(c, -3.5, -1.8, 7, 3.6, 1),
        { cx: 0, cy: 0, rx: 3.5, ry: 1.8 },
      );
    });

    // 8. Dash / Footstep Dust Puff
    this.bakeCustomCanvas(scene, 'fx_dust_puff', 20, 20, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.BONE_WHITE,
          shade: PALETTE.WARM_STONE,
          outlineWidth: 1.5,
        },
        (c) => {
          c.beginPath();
          c.arc(0, 0, 5.5, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 0, cy: 0, rx: 5.5, ry: 5.5 },
      );
    });

    // 9. Energy Orb Pickup
    this.bakeCustomCanvas(scene, 'fx_pickup_energy', 18, 18, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.AZURE_CORE,
          shade: PALETTE.COBALT_SHADE,
          highlight: PALETTE.ICE_WHITE,
          outlineWidth: 1.8,
        },
        (c) => {
          c.beginPath();
          c.arc(0, 0, 4.8, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 0, cy: 0, rx: 5, ry: 5 },
      );
    });

    // 10. Gold Coin Pickup
    this.bakeCustomCanvas(scene, 'fx_pickup_gold', 18, 18, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.BRASS_CORE,
          highlight: PALETTE.BONE_WHITE,
          outlineWidth: 1.8,
        },
        (c) => {
          c.beginPath();
          c.arc(0, 0, 5.2, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 0, cy: 0, rx: 5, ry: 5 },
      );
    });

    // 11. Persistent Floor Decals (Scorch, Splatter, Frost, Debris)
    this.bakeCustomCanvas(scene, 'fx_decal_scorch', 42, 42, scale, (ctx) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 13, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20, 16, 25, 0.68)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 7.5, -0.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(11, 9, 14, 0.85)';
      ctx.fill();
    });

    this.bakeCustomCanvas(scene, 'fx_decal_splatter', 28, 28, scale, (ctx) => {
      ctx.fillStyle = 'rgba(30, 78, 56, 0.72)';
      ctx.beginPath();
      ctx.ellipse(-2, 1, 8, 5.5, 0.3, 0, Math.PI * 2);
      ctx.arc(6, -3, 3.5, 0, Math.PI * 2);
      ctx.arc(-6, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    this.bakeCustomCanvas(scene, 'fx_decal_frost', 32, 32, scale, (ctx) => {
      ctx.strokeStyle = 'rgba(207, 250, 254, 0.65)';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * 11, -Math.sin(a) * 11);
        ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.stroke();
      }
    });

    // 12. Ambient Forest Leaf & Mist & Shards
    this.bakeCustomCanvas(scene, 'fx_ambient_leaf', 14, 14, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.LIME_GLOW,
          shade: PALETTE.GOBLIN_GREEN,
          outlineWidth: 1.2,
        },
        (c) =>
          tracePolygon(c, [
            { x: -4.5, y: 0 },
            { x: 0, y: -2.8 },
            { x: 4.5, y: 0 },
            { x: 0, y: 2.8 },
          ]),
        { cx: 0, cy: 0, rx: 4.5, ry: 2.8 },
      );
    });

    this.bakeCustomCanvas(scene, 'fx_ambient_mist', 64, 32, scale, (ctx) => {
      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
      grad.addColorStop(0, 'rgba(167, 243, 208, 0.18)');
      grad.addColorStop(1, 'rgba(167, 243, 208, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    this.bakeCustomCanvas(scene, 'fx_wood_shard', 14, 10, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: PALETTE.LEATHER_LIGHT,
          outlineWidth: 1.4,
        },
        (c) =>
          tracePolygon(c, [
            { x: -5, y: -2 },
            { x: 5, y: -1.5 },
            { x: 3, y: 2.2 },
            { x: -4, y: 1.8 },
          ]),
        { cx: 0, cy: 0, rx: 5, ry: 2 },
      );
    });

    this.bakeCustomCanvas(scene, 'fx_ice_shard', 14, 14, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.CYAN_FROST,
          shade: PALETTE.AZURE_CORE,
          highlight: PALETTE.ICE_WHITE,
          outlineWidth: 1.4,
        },
        (c) =>
          tracePolygon(c, [
            { x: -5, y: 0 },
            { x: 0, y: -3.5 },
            { x: 5, y: 0 },
            { x: 0, y: 3.5 },
          ]),
        { cx: 0, cy: 0, rx: 5, ry: 3.5 },
      );
    });

    // 13. Dash Afterimage Silhouette
    this.bakeCustomCanvas(scene, 'fx_afterimage_vanguard', 36, 44, scale, (ctx) => {
      ctx.fillStyle = PALETTE.ICE_WHITE;
      traceRoundedRect(ctx, -10, -18, 20, 16, 7);
      ctx.fill();
      traceRoundedRect(ctx, -9, -2, 18, 15, 5);
      ctx.fill();
    });
  }

  private static bakeCrosshair(scene: Phaser.Scene, scale: number): void {
    this.bakeCustomCanvas(scene, 'ui_crosshair', 32, 32, scale, (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      ctx.lineWidth = 3.8;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = PALETTE.CYAN_FROST;
      ctx.stroke();

      const dirs: readonly [number, number][] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dy] of dirs) {
        ctx.beginPath();
        ctx.moveTo(dx * 5.5, dy * 5.5);
        ctx.lineTo(dx * 13, dy * 13);
        ctx.lineWidth = 3.8;
        ctx.lineCap = 'round';
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(dx * 5.5, dy * 5.5);
        ctx.lineTo(dx * 13, dy * 13);
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.strokeStyle = PALETTE.SOLAR_GOLD;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(0, 0, 2.0, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.BONE_WHITE;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();
    });
  }

  private static bakeCustomCanvas(
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
