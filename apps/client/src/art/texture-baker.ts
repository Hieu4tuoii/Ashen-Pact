import type Phaser from 'phaser';
import { SeededRandom } from '@ashen-pact/shared';
import { BIOME_THEMES, PALETTE, PLAYER_SLOT_COLORS } from './palette.js';
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
 * weapons, projectiles, walls, crosshairs, and particles render as hardware-batched Sprites
 * at 60 FPS with razor-sharp outlines at 1080p & 1440p.
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

  public static getWallTileTextureKey(biome: 1 | 2 | 3 = 1): string {
    return `biome_wall_${biome}`;
  }

  public static getPillarTileTextureKey(biome: 1 | 2 | 3 = 1): string {
    return `biome_pillar_${biome}`;
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
      scene.textures.exists('ui_crosshair')
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
      for (let v = 0; v < 4; v++) {
        this.bakeBiomeTile(scene, biome, v, targetScale);
      }
      this.bakeWallTile(scene, biome, targetScale);
      this.bakePillarTile(scene, biome, targetScale);
    }

    this.bakeProjectilesAndFx(scene, targetScale);
    this.bakeCrosshair(scene, targetScale);

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

    ctx.beginPath();
    ctx.moveTo(3.5, 24);
    ctx.lineTo(3.5, 3.5);
    ctx.lineTo(24, 3.5);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = theme.floorHighlight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

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

  private static bakeWallTile(scene: Phaser.Scene, biome: 1 | 2 | 3, scale: number): void {
    const key = this.getWallTileTextureKey(biome);
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

    // 3D beveled stone wall cap
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_MID,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.ASH_GRAY,
        outlineColor: PALETTE.INK_DARK,
        outlineWidth: 2.0,
      },
      (c) => traceRoundedRect(c, 1.5, 1.5, size - 3, size - 6, 4),
      { cx: 16, cy: 13, rx: 14, ry: 12 },
    );

    // Moss / rune accent on wall top
    ctx.beginPath();
    ctx.arc(9, 9, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = BIOME_THEMES[biome].floorHighlight;
    ctx.fill();

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  private static bakePillarTile(scene: Phaser.Scene, biome: 1 | 2 | 3, scale: number): void {
    const key = this.getPillarTileTextureKey(biome);
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(size * scale);
    canvas.height = Math.ceil(size * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.scale(scale, scale);

    ctx.fillStyle = PALETTE.INK_DARK;
    ctx.fillRect(0, 0, size, size);

    outlined(
      ctx,
      {
        fill: PALETTE.WARM_STONE,
        shade: PALETTE.ASH_GRAY,
        highlight: PALETTE.BONE_WHITE,
        outlineColor: PALETTE.INK_DARK,
        outlineWidth: 2.2,
      },
      (c) => traceRoundedRect(c, 2, 2, size - 4, size - 5, 5),
      { cx: 16, cy: 14, rx: 13, ry: 12 },
    );

    // Glowing rune core in pillar stone
    ctx.beginPath();
    ctx.arc(16, 14, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = BIOME_THEMES[biome].accentGlow;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();

    ctx.restore();
    this.registerCanvasTexture(scene, key, canvas);
  }

  private static bakeProjectilesAndFx(scene: Phaser.Scene, scale: number): void {
    // 1. Player Projectile Bolt (distinct bright cyan/gold elongated dart with dark outline)
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

    // 2. Player Shotgun Pellet (golden hot slug)
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

    // 3. Enemy Projectile Orb (Section 3.7: high saturation crimson, thick dark outline + bright core + outer glow)
    this.bakeCustomCanvas(scene, 'proj_enemy_orb', 24, 24, scale, (ctx) => {
      // Soft outer crimson glow
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

      // Bright white-gold core
      ctx.beginPath();
      ctx.arc(-1, -1, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.BONE_WHITE;
      ctx.fill();
    });

    // 4. Melee Slash Crescent Arc (fx_slash_arc)
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

    // 5. Impact Spark Star (fx_spark)
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

    // 6. Muzzle Flash (fx_muzzle_flash)
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

    // 7. Ejected Brass Shell Casing (fx_shell_casing)
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

    // 8. Dash / Footstep Dust Puff (fx_dust_puff)
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

    // 9. Energy Orb Pickup (fx_pickup_energy)
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

    // 10. Gold Coin Pickup (fx_pickup_gold)
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
  }

  private static bakeCrosshair(scene: Phaser.Scene, scale: number): void {
    this.bakeCustomCanvas(scene, 'ui_crosshair', 32, 32, scale, (ctx) => {
      // Outer ring with dark outline
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

      // 4 crisp reticle ticks
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

      // Center precision dot
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
