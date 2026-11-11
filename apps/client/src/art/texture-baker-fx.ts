import type Phaser from 'phaser';
import { PALETTE, type PaletteHex } from './palette.js';
import { outlined, tracePolygon, traceRoundedRect } from './primitives.js';
import { bakeCustomCanvas, registerCanvasTexture } from './texture-baker-canvas.js';

export const ENEMY_BULLET_VISUAL_SPEC = {
  fill: PALETTE.CRIMSON_BRIGHT,
  core: PALETTE.BONE_WHITE,
  outlineColor: PALETTE.INK_DARK,
  outlineWidth: 1.5,
  coreRadius: 2.6,
  stressCoreRadius: 2.2,
  depth: 60,
  neverTintByElement: true,
} as const;

export const BAKED_FX_TEXTURE_KEYS = [
  'fx_light_radial',
  'proj_player_bolt',
  'proj_player_burn',
  'proj_player_chill',
  'proj_player_shock',
  'proj_player_poison',
  'proj_player_pellet',
  'proj_knight_sword_wave',
  'proj_enemy_orb',
  'proj_enemy_wave',
  'proj_enemy_lance',
  'proj_enemy_diamond',
  'proj_enemy_heavy_orb',
  'proj_enemy_ring_bolt',
  'fx_enemy_bullet_glow',
  'proj_stress_orb',
  'proj_stress_enemy',
  'proj_stress_player',
  'fx_slash_arc',
  'fx_spark',
  'fx_spark_trail',
  'fx_impact_ring',
  'fx_shockwave_ring',
  'fx_muzzle_flash',
  'fx_muzzle_core',
  'fx_shell_casing',
  'fx_dust_puff',
  'fx_pickup_energy',
  'fx_pickup_gold',
  'fx_decal_scorch',
  'fx_decal_splatter',
  'fx_decal_frost',
  'fx_ember_mote',
  'fx_ambient_leaf',
  'fx_ambient_firefly',
  'fx_ambient_snow',
  'fx_wood_shard',
  'fx_ice_shard',
  'fx_afterimage_vanguard',
  'fx_rarity_beam',
  'fx_sparkle_mote',
] as const;

/**
 * Bakes the soft radial falloff light brush texture used by the dynamic RenderTexture Lightmap.
 */
export function bakeLightRadialBrush(scene: Phaser.Scene): void {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 2, half, half, half);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.6)');
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  registerCanvasTexture(scene, 'fx_light_radial', canvas);
}

export function bakeProjectilesAndFx(scene: Phaser.Scene, scale: number): void {
  // 1. Player Projectile Bolt (Chiaroscuro +X spearhead: dark shear tail + vivid sheath + #FFFDF5 needle spine)
  bakeCustomCanvas(scene, 'proj_player_bolt', 26, 14, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.CYAN_FROST,
        shade: PALETTE.AZURE_CORE,
        highlight: PALETTE.BONE_WHITE,
        outlineWidth: 1.8,
      },
      (c) =>
        tracePolygon(c, [
          { x: -10.5, y: 0 },
          { x: -4.5, y: -3.4 },
          { x: 4.5, y: -3.8 },
          { x: 10.8, y: 0 },
          { x: 4.5, y: 3.8 },
          { x: -4.5, y: 3.4 },
        ]),
      { cx: 1, cy: 0, rx: 9, ry: 3.8 },
    );
    ctx.fillStyle = '#0C0918';
    tracePolygon(ctx, [
      { x: -7.5, y: 0 },
      { x: -1.5, y: -1.7 },
      { x: 4.0, y: 0 },
      { x: -1.5, y: 1.7 },
    ]);
    ctx.fill();
    ctx.fillStyle = PALETTE.BONE_WHITE;
    tracePolygon(ctx, [
      { x: -2.0, y: 0 },
      { x: 4.8, y: -1.4 },
      { x: 10.2, y: 0 },
      { x: 4.8, y: 1.4 },
    ]);
    ctx.fill();
  });

  // Elemental Player Bolts (Burn, Chill, Shock, Poison — Chiaroscuro dark channel + razor core)
  const elemSkins: readonly [string, PaletteHex, PaletteHex, PaletteHex, string][] = [
    ['proj_player_burn', PALETTE.FLAME_ORANGE, PALETTE.MAGMA_RED, PALETTE.SOLAR_GOLD, '#17050B'],
    ['proj_player_chill', PALETTE.CYAN_FROST, PALETTE.COBALT_SHADE, PALETTE.ICE_WHITE, '#041020'],
    ['proj_player_shock', PALETTE.VOLT_YELLOW, PALETTE.BRASS_CORE, PALETTE.BONE_WHITE, '#0A061D'],
    ['proj_player_poison', PALETTE.LIME_GLOW, PALETTE.TOXIC_PURPLE, PALETTE.MINT_LIGHT, '#091408'],
  ];
  for (const [key, fill, shade, highlight, darkVein] of elemSkins) {
    bakeCustomCanvas(scene, key, 26, 14, scale, (ctx) => {
      outlined(
        ctx,
        { fill, shade, highlight, outlineWidth: 1.8 },
        (c) =>
          tracePolygon(c, [
            { x: -10.5, y: 0 },
            { x: -4.5, y: -3.5 },
            { x: 4.5, y: -4.0 },
            { x: 11.0, y: 0 },
            { x: 4.5, y: 4.0 },
            { x: -4.5, y: 3.5 },
          ]),
        { cx: 1, cy: 0, rx: 9, ry: 4 },
      );
      ctx.fillStyle = darkVein;
      tracePolygon(ctx, [
        { x: -7.5, y: 0 },
        { x: -1.5, y: -1.8 },
        { x: 4.2, y: 0 },
        { x: -1.5, y: 1.8 },
      ]);
      ctx.fill();
      ctx.fillStyle = PALETTE.BONE_WHITE;
      tracePolygon(ctx, [
        { x: -1.5, y: 0 },
        { x: 5.0, y: -1.4 },
        { x: 10.4, y: 0 },
        { x: 5.0, y: 1.4 },
      ]);
      ctx.fill();
    });
  }

  // 2. Player Shotgun Pellet (Diamond-faceted +X slug distinct from round enemy orbs)
  bakeCustomCanvas(scene, 'proj_player_pellet', 18, 16, scale, (ctx) => {
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
          { x: -6.2, y: 0 },
          { x: -1.2, y: -4.2 },
          { x: 6.4, y: 0 },
          { x: -1.2, y: 4.2 },
        ]),
      { cx: 0, cy: 0, rx: 6, ry: 4.2 },
    );
    ctx.fillStyle = PALETTE.BONE_WHITE;
    tracePolygon(ctx, [
      { x: -1.5, y: 0 },
      { x: 1.8, y: -1.6 },
      { x: 5.4, y: 0 },
      { x: 1.8, y: 1.6 },
    ]);
    ctx.fill();
  });

  const drawEmissiveEnemyShape = (
    ctx: CanvasRenderingContext2D,
    tracePath: (c: CanvasRenderingContext2D) => void,
    opts: {
      outlineWidth?: number;
      focusX?: number;
      focusY?: number;
      innerR?: number;
      outerR: number;
      midStopColor?: string;
      rimStopColor?: string;
    },
  ): void => {
    const ow = opts.outlineWidth ?? 1.25;
    const fx = opts.focusX ?? 0;
    const fy = opts.focusY ?? 0;
    const ir = opts.innerR ?? 1.1;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. Tight shape-conforming neon rim (~1.8u max hug around silhouette — zero wide fog cloud)
    tracePath(ctx);
    ctx.lineWidth = (ow + 1.8) * 2;
    ctx.strokeStyle = 'rgba(255, 34, 84, 0.16)';
    ctx.stroke();

    tracePath(ctx);
    ctx.lineWidth = (ow + 0.75) * 2;
    ctx.strokeStyle = 'rgba(255, 76, 116, 0.46)';
    ctx.stroke();

    // 2. Crisp dark ruby-ink containment border so stacked volleys never blur together
    tracePath(ctx);
    ctx.lineWidth = ow * 2;
    ctx.strokeStyle = '#1C060E';
    ctx.stroke();

    // 3. Self-luminous internal plasma fill (white-gold core -> hot coral -> electric crimson, no dark cel shadow)
    ctx.save();
    tracePath(ctx);
    ctx.clip();
    const plasma = ctx.createRadialGradient(fx, fy, ir, fx, fy, opts.outerR);
    plasma.addColorStop(0, '#FFFFFF');
    plasma.addColorStop(0.28, '#FFF2B2');
    plasma.addColorStop(0.56, opts.midStopColor ?? '#FF5876');
    plasma.addColorStop(0.86, opts.rimStopColor ?? '#FF1E48');
    plasma.addColorStop(1, '#CC1034');
    ctx.fillStyle = plasma;
    ctx.fillRect(fx - opts.outerR - 8, fy - opts.outerR - 8, (opts.outerR + 8) * 2, (opts.outerR + 8) * 2);
    ctx.restore();

    ctx.restore();
  };

  // 3. Enemy Projectile Orb (Luminous concentric plasma bullseye: tight neon rim + crisp dark border + incandescent white-gold core)
  bakeCustomCanvas(scene, 'proj_enemy_orb', 28, 28, scale, (ctx) => {
    drawEmissiveEnemyShape(
      ctx,
      (c) => {
        c.beginPath();
        c.arc(0, 0, 6.8, 0, Math.PI * 2);
        c.closePath();
      },
      { outerR: 7.0, innerR: 1.2 },
    );

    ctx.beginPath();
    ctx.arc(0, 0, ENEMY_BULLET_VISUAL_SPEC.coreRadius + 1.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 234, 158, 0.88)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, ENEMY_BULLET_VISUAL_SPEC.coreRadius + 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  });

  // 3.1 Enemy Crescent Wave ('proj_enemy_wave' — shape-hugging plasma crescent, zero circular fog in hollow pocket)
  bakeCustomCanvas(scene, 'proj_enemy_wave', 34, 32, scale, (ctx) => {
    drawEmissiveEnemyShape(
      ctx,
      (c) => {
        c.beginPath();
        c.arc(-3.5, 0, 11.8, -Math.PI * 0.44, Math.PI * 0.44, false);
        c.arc(-7.8, 0, 8.8, Math.PI * 0.37, -Math.PI * 0.37, true);
        c.closePath();
      },
      { focusX: 5.0, focusY: 0, innerR: 1.2, outerR: 10.6 },
    );

    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 234, 158, 0.88)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(-3.3, 0, 10.5, -Math.PI * 0.35, Math.PI * 0.35, false);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(-3.2, 0, 10.5, -Math.PI * 0.32, Math.PI * 0.32, false);
    ctx.stroke();
  });

  // 3.2 Enemy Spearhead Lance ('proj_enemy_lance')
  bakeCustomCanvas(scene, 'proj_enemy_lance', 32, 26, scale, (ctx) => {
    drawEmissiveEnemyShape(
      ctx,
      (c) =>
        tracePolygon(c, [
          { x: -11.0, y: 0 },
          { x: -4.2, y: -4.8 },
          { x: 5.2, y: -3.6 },
          { x: 11.8, y: 0 },
          { x: 5.2, y: 3.6 },
          { x: -4.2, y: 4.8 },
        ]),
      { focusX: 2.0, focusY: 0, innerR: 1.0, outerR: 10.8 },
    );

    ctx.fillStyle = 'rgba(255, 234, 158, 0.88)';
    tracePolygon(ctx, [
      { x: -6.2, y: 0 },
      { x: 2.2, y: -2.6 },
      { x: 10.4, y: 0 },
      { x: 2.2, y: 2.6 },
    ]);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    tracePolygon(ctx, [
      { x: -4.4, y: 0 },
      { x: 2.6, y: -1.7 },
      { x: 9.8, y: 0 },
      { x: 2.6, y: 1.7 },
    ]);
    ctx.fill();
  });

  // 3.3 Enemy Faceted Diamond ('proj_enemy_diamond')
  bakeCustomCanvas(scene, 'proj_enemy_diamond', 28, 26, scale, (ctx) => {
    drawEmissiveEnemyShape(
      ctx,
      (c) =>
        tracePolygon(c, [
          { x: -9.5, y: 0 },
          { x: 0, y: -6.2 },
          { x: 9.8, y: 0 },
          { x: 0, y: 6.2 },
        ]),
      { focusX: 0.2, focusY: 0, innerR: 1.0, outerR: 8.8 },
    );

    ctx.fillStyle = 'rgba(255, 234, 158, 0.88)';
    tracePolygon(ctx, [
      { x: -6.0, y: 0 },
      { x: 0, y: -3.6 },
      { x: 6.4, y: 0 },
      { x: 0, y: 3.6 },
    ]);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    tracePolygon(ctx, [
      { x: -4.3, y: 0 },
      { x: 0, y: -2.5 },
      { x: 4.8, y: 0 },
      { x: 0, y: 2.5 },
    ]);
    ctx.fill();
  });

  // 3.4 Enemy Heavy Core Orb ('proj_enemy_heavy_orb')
  bakeCustomCanvas(scene, 'proj_enemy_heavy_orb', 32, 32, scale, (ctx) => {
    drawEmissiveEnemyShape(
      ctx,
      (c) => {
        c.beginPath();
        c.arc(0, 0, 8.6, 0, Math.PI * 2);
        c.closePath();
      },
      {
        outlineWidth: 1.4,
        innerR: 1.8,
        outerR: 8.8,
        midStopColor: '#FF7043',
        rimStopColor: '#FF244C',
      },
    );

    ctx.strokeStyle = '#FFD166';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(0, 0, 5.9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 236, 168, 0.9)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  });

  // 3.5 Enemy Ring Bolt ('proj_enemy_ring_bolt' — spiked plasma chakram torus with 4 crisp cardinal notches)
  bakeCustomCanvas(scene, 'proj_enemy_ring_bolt', 30, 30, scale, (ctx) => {
    // 4 cardinal outer chakram fins
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI * 0.5;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const px = -sa;
      const py = ca;
      drawEmissiveEnemyShape(
        ctx,
        (c) =>
          tracePolygon(c, [
            { x: ca * 5.6 + px * 2.2, y: sa * 5.6 + py * 2.2 },
            { x: ca * 10.3, y: sa * 10.3 },
            { x: ca * 5.6 - px * 2.2, y: sa * 5.6 - py * 2.2 },
          ]),
        { outlineWidth: 1.15, focusX: ca * 7.2, focusY: sa * 7.2, innerR: 0.5, outerR: 3.6 },
      );
    }

    drawEmissiveEnemyShape(
      ctx,
      (c) => {
        c.beginPath();
        c.arc(0, 0, 7.2, 0, Math.PI * 2);
        c.closePath();
      },
      { outlineWidth: 1.25, innerR: 2.2, outerR: 7.4 },
    );

    // 4 crisp white-hot cardinal notches across the torus rim
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 4.4, Math.sin(a) * 4.4);
      ctx.lineTo(Math.cos(a) * 8.5, Math.sin(a) * 8.5);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 3.9, 0, Math.PI * 2);
    ctx.fillStyle = '#1C060E';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 3.0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 234, 158, 0.9)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  });

  // 3.6 Core-Locked Additive Plasma Shimmer ('fx_enemy_bullet_glow' — rendered at depth 61 above core, zero wide haze)
  bakeCustomCanvas(scene, 'fx_enemy_bullet_glow', 32, 32, scale, (ctx) => {
    const grad = ctx.createRadialGradient(0, 0, 1.2, 0, 0, 14);
    grad.addColorStop(0, 'rgba(255, 250, 220, 0.82)');
    grad.addColorStop(0.28, 'rgba(255, 82, 112, 0.44)');
    grad.addColorStop(0.58, 'rgba(255, 34, 78, 0.14)');
    grad.addColorStop(1, 'rgba(255, 34, 78, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3a. Knight Sword / Gale Wind Blade Crescent Wave Projectile (+X 1:1 Chiaroscuro razor crescent)
  bakeCustomCanvas(scene, 'proj_knight_sword_wave', 40, 36, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.SOLAR_GOLD,
        shade: PALETTE.FLAME_ORANGE,
        highlight: PALETTE.BONE_WHITE,
        outlineWidth: 1.7,
      },
      (c) => {
        c.beginPath();
        c.arc(-4, 0, 15, -Math.PI * 0.45, Math.PI * 0.45, false);
        c.arc(-9.5, 0, 11.8, Math.PI * 0.39, -Math.PI * 0.39, true);
        c.closePath();
      },
      { cx: 4, cy: 0, rx: 11, ry: 14 },
    );
    ctx.strokeStyle = '#141019';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-5.6, 0, 13.0, -Math.PI * 0.33, Math.PI * 0.33, false);
    ctx.stroke();

    ctx.strokeStyle = PALETTE.BONE_WHITE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-3.8, 0, 14.5, -Math.PI * 0.38, Math.PI * 0.38, false);
    ctx.stroke();
  });

  // 3b. Native 1080p Stress Projectile textures (2x native scale, distinct silhouettes for enemy vs player)
  const stressScale = Math.min(2, scale);
  bakeCustomCanvas(scene, 'proj_stress_orb', 16, 16, stressScale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.ICE_WHITE,
        shade: PALETTE.CYAN_FROST,
        highlight: PALETTE.BONE_WHITE,
        outlineColor: PALETTE.INK_DARK,
        outlineWidth: 1.8,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 4.8, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 4.5, ry: 4.5 },
    );
  });

  bakeCustomCanvas(scene, 'proj_stress_enemy', 18, 18, stressScale, (ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232, 69, 69, 0.36)';
    ctx.fill();
    outlined(
      ctx,
      {
        fill: ENEMY_BULLET_VISUAL_SPEC.fill,
        shade: PALETTE.RUBY_CORE,
        highlight: PALETTE.CRIMSON_BRIGHT,
        outlineColor: ENEMY_BULLET_VISUAL_SPEC.outlineColor,
        outlineWidth: ENEMY_BULLET_VISUAL_SPEC.outlineWidth,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 5.2, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 5, ry: 5 },
    );
    ctx.beginPath();
    ctx.arc(0, 0, ENEMY_BULLET_VISUAL_SPEC.stressCoreRadius + 0.7, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.RUBY_DARK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, ENEMY_BULLET_VISUAL_SPEC.stressCoreRadius, 0, Math.PI * 2);
    ctx.fillStyle = ENEMY_BULLET_VISUAL_SPEC.core;
    ctx.fill();
  });

  bakeCustomCanvas(scene, 'proj_stress_player', 22, 12, stressScale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.ICE_WHITE,
        shade: PALETTE.SILVER_BRIGHT,
        highlight: PALETTE.BONE_WHITE,
        outlineColor: PALETTE.INK_DARK,
        outlineWidth: 1.7,
      },
      (c) =>
        tracePolygon(c, [
          { x: -8.5, y: 0 },
          { x: -3.5, y: -2.8 },
          { x: 3.5, y: -3.1 },
          { x: 8.8, y: 0 },
          { x: 3.5, y: 3.1 },
          { x: -3.5, y: 2.8 },
        ]),
      { cx: 0, cy: 0, rx: 7, ry: 3.1 },
    );
  });

  // 4. Melee Slash Crescent Arc (+X 1:1 tapered razor arc, BlendMode.ADD)
  bakeCustomCanvas(scene, 'fx_slash_arc', 110, 110, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.SILVER_BRIGHT,
        shade: PALETTE.CYAN_FROST,
        highlight: PALETTE.BONE_WHITE,
        outlineColor: PALETTE.INK_DARK,
        outlineWidth: 1.6,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 46, -1.02, 1.02, false);
        c.arc(-9, 0, 36, 0.96, -0.96, true);
        c.closePath();
      },
      { cx: 24, cy: 0, rx: 24, ry: 40 },
    );
  });

  // 5. Impact Spark Star (Anisotropic 4-point needle star, BlendMode.ADD)
  bakeCustomCanvas(scene, 'fx_spark', 18, 18, scale, (ctx) => {
    const glow = ctx.createRadialGradient(0, 0, 0.3, 0, 0, 6.8);
    glow.addColorStop(0, 'rgba(255, 253, 245, 0.95)');
    glow.addColorStop(0.45, 'rgba(255, 255, 255, 0.36)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 6.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.BONE_WHITE;
    tracePolygon(ctx, [
      { x: -7.2, y: 0 },
      { x: -1.1, y: -1.1 },
      { x: 0, y: -6.2 },
      { x: 1.1, y: -1.1 },
      { x: 7.2, y: 0 },
      { x: 1.1, y: 1.1 },
      { x: 0, y: 6.2 },
      { x: -1.1, y: 1.1 },
    ]);
    ctx.fill();
  });

  // 5b. Directional Elongated Spark Trail (28x10, BlendMode.ADD)
  bakeCustomCanvas(scene, 'fx_spark_trail', 28, 10, scale, (ctx) => {
    const tailGrad = ctx.createLinearGradient(-13.5, 0, 12.5, 0);
    tailGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    tailGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
    tailGrad.addColorStop(0.88, 'rgba(255, 253, 245, 0.98)');
    tailGrad.addColorStop(1, 'rgba(255, 253, 245, 1)');
    ctx.fillStyle = tailGrad;
    tracePolygon(ctx, [
      { x: -13.5, y: 0 },
      { x: 2.5, y: -2.6 },
      { x: 12.8, y: 0 },
      { x: 2.5, y: 2.6 },
    ]);
    ctx.fill();

    ctx.fillStyle = PALETTE.BONE_WHITE;
    tracePolygon(ctx, [
      { x: -3.5, y: 0 },
      { x: 4.5, y: -1.2 },
      { x: 12.4, y: 0 },
      { x: 4.5, y: 1.2 },
    ]);
    ctx.fill();
  });

  // 5c. Expanding Hit Impact Ring (40x40, hollow C-notched razor rim, BlendMode.ADD)
  bakeCustomCanvas(scene, 'fx_impact_ring', 40, 40, scale, (ctx) => {
    const radGrad = ctx.createRadialGradient(0, 0, 9, 0, 0, 17.5);
    radGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    radGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.08)');
    radGrad.addColorStop(0.88, 'rgba(255, 253, 245, 0.92)');
    radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 17.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = PALETTE.BONE_WHITE;
    ctx.lineWidth = 1.6;
    for (let s = 0; s < 3; s++) {
      const a0 = (s * Math.PI * 2) / 3 + 0.14;
      ctx.beginPath();
      ctx.arc(0, 0, 14.4, a0, a0 + 1.65);
      ctx.stroke();
    }
  });

  // 5d. Elemental Combo & Explosion Segmented Razor Shockwave Ring (96x96, 100% hollow center, BlendMode.ADD)
  bakeCustomCanvas(scene, 'fx_shockwave_ring', 96, 96, scale, (ctx) => {
    const halo = ctx.createRadialGradient(0, 0, 26, 0, 0, 44);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0)');
    halo.addColorStop(0.68, 'rgba(255, 255, 255, 0.06)');
    halo.addColorStop(0.86, 'rgba(255, 253, 245, 0.85)');
    halo.addColorStop(0.95, 'rgba(255, 255, 255, 0.25)');
    halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();

    // 4 broken C-arc razor crests (never continuous wagon-wheel!)
    ctx.strokeStyle = PALETTE.BONE_WHITE;
    ctx.lineWidth = 2.1;
    for (let s = 0; s < 4; s++) {
      const a0 = (s * Math.PI) / 2 + 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, 38.0, a0, a0 + 1.24);
      ctx.stroke();
    }

    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 34.5, Math.sin(a) * 34.5);
      ctx.lineTo(Math.cos(a) * 42.5, Math.sin(a) * 42.5);
      ctx.stroke();
    }
  });

  // 6. Muzzle Flash Outer Star Cone (+X anisotropic spear, BlendMode.ADD)
  bakeCustomCanvas(scene, 'fx_muzzle_flash', 32, 24, scale, (ctx) => {
    ctx.fillStyle = PALETTE.SOLAR_GOLD;
    tracePolygon(ctx, [
      { x: -7.5, y: 0 },
      { x: -2.0, y: -3.2 },
      { x: 4.5, y: -8.8 },
      { x: 2.8, y: -2.0 },
      { x: 14.2, y: 0 },
      { x: 2.8, y: 2.0 },
      { x: 4.5, y: 8.8 },
      { x: -2.0, y: 3.2 },
    ]);
    ctx.fill();
  });

  // 6b. Muzzle Flash Inner White-Gold Core Flare (24x18, BlendMode.ADD)
  bakeCustomCanvas(scene, 'fx_muzzle_core', 24, 18, scale, (ctx) => {
    ctx.fillStyle = PALETTE.BONE_WHITE;
    tracePolygon(ctx, [
      { x: -5.0, y: 0 },
      { x: 0.5, y: -1.8 },
      { x: 2.8, y: -5.4 },
      { x: 3.6, y: -1.4 },
      { x: 10.8, y: 0 },
      { x: 3.6, y: 1.4 },
      { x: 2.8, y: 5.4 },
      { x: 0.5, y: 1.8 },
    ]);
    ctx.fill();
  });

  // 7. Ejected Brass Shell Casing
  bakeCustomCanvas(scene, 'fx_shell_casing', 12, 8, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'fx_dust_puff', 20, 20, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'fx_pickup_energy', 18, 18, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'fx_pickup_gold', 18, 18, scale, (ctx) => {
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

  // 11. Persistent 1:1 Top-Down Floor Decals (Scorch, Splatter, Frost — zero 3/4 squash!)
  bakeCustomCanvas(scene, 'fx_decal_scorch', 44, 44, scale, (ctx) => {
    const charGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 18);
    charGrad.addColorStop(0, 'rgba(11, 9, 14, 0.22)');
    charGrad.addColorStop(0.58, 'rgba(20, 16, 25, 0.56)');
    charGrad.addColorStop(0.84, 'rgba(23, 5, 11, 0.45)');
    charGrad.addColorStop(1, 'rgba(20, 16, 25, 0)');
    ctx.fillStyle = charGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(11, 9, 14, 0.72)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      const a = (i * Math.PI * 2) / 7 + 0.25;
      const r0 = 5.5 + (i % 2) * 2.5;
      const r1 = 15.5 + (i % 3) * 2.0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a + 0.14) * ((r0 + r1) * 0.5), Math.sin(a + 0.14) * ((r0 + r1) * 0.5));
      ctx.lineTo(Math.cos(a - 0.08) * r1, Math.sin(a - 0.08) * r1);
      ctx.stroke();
    }
  });

  bakeCustomCanvas(scene, 'fx_decal_splatter', 30, 30, scale, (ctx) => {
    ctx.fillStyle = 'rgba(20, 68, 48, 0.68)';
    ctx.beginPath();
    ctx.arc(-1.5, 0.5, 6.2, 0, Math.PI * 2);
    ctx.arc(6.5, -3.5, 3.2, 0, Math.PI * 2);
    ctx.arc(-6.5, -4.2, 2.4, 0, Math.PI * 2);
    ctx.arc(3.8, 5.8, 2.6, 0, Math.PI * 2);
    ctx.arc(-5.2, 5.2, 1.9, 0, Math.PI * 2);
    ctx.fill();
  });

  bakeCustomCanvas(scene, 'fx_decal_frost', 36, 36, scale, (ctx) => {
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.62)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4;
      const len = i % 2 === 0 ? 14 : 10.5;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(a) * len, -Math.sin(a) * len);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 12. Clear Biome Ambient Particles (Zero Fog: NO fx_ambient_mist!)
  // Biome 3: Small <= 4px un-outlined warm rising ember mote (never white core + dark outline!)
  bakeCustomCanvas(scene, 'fx_ember_mote', 8, 8, scale, (ctx) => {
    const grad = ctx.createRadialGradient(0, 0, 0.2, 0, 0, 1.75);
    grad.addColorStop(0, 'rgba(254, 240, 138, 0.96)');
    grad.addColorStop(0.55, 'rgba(251, 146, 60, 0.82)');
    grad.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1.75, 0, Math.PI * 2);
    ctx.fill();
  });

  // Biome 1: Forest leaf
  bakeCustomCanvas(scene, 'fx_ambient_leaf', 14, 14, scale, (ctx) => {
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

  // Biome 1: Un-outlined glowing firefly mote (BlendMode.ADD)
  bakeCustomCanvas(scene, 'fx_ambient_firefly', 12, 12, scale, (ctx) => {
    const grad = ctx.createRadialGradient(0, 0, 0.3, 0, 0, 4.6);
    grad.addColorStop(0, 'rgba(254, 240, 138, 0.98)');
    grad.addColorStop(0.45, 'rgba(163, 230, 53, 0.68)');
    grad.addColorStop(1, 'rgba(74, 222, 128, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Biome 2: Soft round un-outlined 2-4px snowflake
  bakeCustomCanvas(scene, 'fx_ambient_snow', 10, 10, scale, (ctx) => {
    const grad = ctx.createRadialGradient(0, 0, 0.25, 0, 0, 2.2);
    grad.addColorStop(0, 'rgba(255, 253, 245, 0.96)');
    grad.addColorStop(0.65, 'rgba(224, 242, 254, 0.72)');
    grad.addColorStop(1, 'rgba(186, 230, 253, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });

  bakeCustomCanvas(scene, 'fx_wood_shard', 14, 10, scale, (ctx) => {
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

  bakeCustomCanvas(scene, 'fx_ice_shard', 14, 14, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'fx_afterimage_vanguard', 36, 44, scale, (ctx) => {
    ctx.fillStyle = PALETTE.ICE_WHITE;
    traceRoundedRect(ctx, -10, -18, 20, 16, 7);
    ctx.fill();
    traceRoundedRect(ctx, -9, -2, 18, 15, 5);
    ctx.fill();
  });

  // 14. Phase P6 Soul Knight-Style Vertical Rarity Light Beam (32x128, BlendModes.ADD)
  bakeCustomCanvas(scene, 'fx_rarity_beam', 32, 128, scale, (ctx) => {
    const outerGrad = ctx.createLinearGradient(0, 54, 0, -60);
    outerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    outerGrad.addColorStop(0.42, 'rgba(255, 255, 255, 0.45)');
    outerGrad.addColorStop(0.82, 'rgba(255, 255, 255, 0.12)');
    outerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.moveTo(-7.5, 54);
    ctx.lineTo(-3.2, -60);
    ctx.lineTo(3.2, -60);
    ctx.lineTo(7.5, 54);
    ctx.closePath();
    ctx.fill();

    const coreGrad = ctx.createLinearGradient(0, 54, 0, -54);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    coreGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.68)');
    coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(-2.3, 54);
    ctx.lineTo(0, -54);
    ctx.lineTo(2.3, 54);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(0, 54);
    ctx.scale(13, 4.8);
    const baseGrad = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
    baseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    baseGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.48)');
    baseGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 15. Phase P6 Borderless 4-Point Diamond Sparkle Mote for Rare+ Closed Chests
  bakeCustomCanvas(scene, 'fx_sparkle_mote', 16, 16, scale, (ctx) => {
    const haloGrad = ctx.createRadialGradient(0, 0, 0.4, 0, 0, 6.2);
    haloGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    haloGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.38)');
    haloGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    tracePolygon(ctx, [
      { x: -5.5, y: 0 },
      { x: -1.2, y: -1.2 },
      { x: 0, y: -5.5 },
      { x: 1.2, y: -1.2 },
      { x: 5.5, y: 0 },
      { x: 1.2, y: 1.2 },
      { x: 0, y: 5.5 },
      { x: -1.2, y: 1.2 },
    ]);
    ctx.fill();
  });
}

export function bakeCrosshair(scene: Phaser.Scene, scale: number): void {
  bakeCustomCanvas(scene, 'ui_crosshair', 32, 32, scale, (ctx) => {
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
