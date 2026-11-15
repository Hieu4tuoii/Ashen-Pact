import type Phaser from 'phaser';
import { PALETTE, type PaletteHex } from './palette.js';
import { outlined, tracePolygon, traceRoundedRect } from './primitives.js';
import { bakeCustomCanvas, registerCanvasTexture } from './texture-baker-canvas.js';
import { SHADER_FX_TEXTURE_KEYS } from './texture-baker-shader-fx.js';

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
  'proj_enemy_small_orb',
  'proj_enemy_orb',
  'proj_enemy_heavy_orb',
  'proj_enemy_lance',
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
  // 1. Player Projectile Bolt (Cutout 2.0 directional +X spearhead: L:W >= 1.8:1, 1.6px #141019 ink)
  bakeCustomCanvas(scene, 'proj_player_bolt', 28, 14, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.CYAN_FROST,
        shade: PALETTE.AZURE_CORE,
        highlight: '#F4F1EA',
        outlineColor: '#141019',
        outlineWidth: 1.6,
      },
      (c) =>
        tracePolygon(c, [
          { x: -11.5, y: 0 },
          { x: -5.0, y: -3.4 },
          { x: 5.0, y: -3.8 },
          { x: 12.0, y: 0 },
          { x: 5.0, y: 3.8 },
          { x: -5.0, y: 3.4 },
        ]),
      { cx: 1, cy: 0, rx: 10, ry: 3.8 },
    );
    ctx.fillStyle = '#141019';
    tracePolygon(ctx, [
      { x: -8.0, y: 0 },
      { x: -1.5, y: -1.7 },
      { x: 4.5, y: 0 },
      { x: -1.5, y: 1.7 },
    ]);
    ctx.fill();
    ctx.fillStyle = '#F4F1EA';
    tracePolygon(ctx, [
      { x: -2.0, y: 0 },
      { x: 5.5, y: -1.4 },
      { x: 11.4, y: 0 },
      { x: 5.5, y: 1.4 },
    ]);
    ctx.fill();
  });

  // Elemental Player Bolts (Burn, Chill, Shock, Poison — Cutout 2.0 directional +X, 1.6px #141019 ink)
  const elemSkins: readonly [string, PaletteHex, PaletteHex, PaletteHex, string][] = [
    ['proj_player_burn', PALETTE.FLAME_ORANGE, PALETTE.MAGMA_RED, PALETTE.SOLAR_GOLD, '#17050B'],
    ['proj_player_chill', PALETTE.CYAN_FROST, PALETTE.COBALT_SHADE, PALETTE.ICE_WHITE, '#041020'],
    ['proj_player_shock', PALETTE.VOLT_YELLOW, PALETTE.BRASS_CORE, PALETTE.BONE_WHITE, '#0A061D'],
    ['proj_player_poison', PALETTE.LIME_GLOW, PALETTE.TOXIC_PURPLE, PALETTE.MINT_LIGHT, '#091408'],
  ];
  for (const [key, fill, shade, highlight, darkVein] of elemSkins) {
    bakeCustomCanvas(scene, key, 28, 14, scale, (ctx) => {
      outlined(
        ctx,
        { fill, shade, highlight, outlineColor: '#141019', outlineWidth: 1.6 },
        (c) =>
          tracePolygon(c, [
            { x: -11.5, y: 0 },
            { x: -5.0, y: -3.5 },
            { x: 5.0, y: -4.0 },
            { x: 12.0, y: 0 },
            { x: 5.0, y: 4.0 },
            { x: -5.0, y: 3.5 },
          ]),
        { cx: 1, cy: 0, rx: 10, ry: 4 },
      );
      ctx.fillStyle = darkVein;
      tracePolygon(ctx, [
        { x: -8.0, y: 0 },
        { x: -1.5, y: -1.8 },
        { x: 4.5, y: 0 },
        { x: -1.5, y: 1.8 },
      ]);
      ctx.fill();
      ctx.fillStyle = '#F4F1EA';
      tracePolygon(ctx, [
        { x: -1.5, y: 0 },
        { x: 5.5, y: -1.4 },
        { x: 11.4, y: 0 },
        { x: 5.5, y: 1.4 },
      ]);
      ctx.fill();
    });
  }

  // 2. Player Shotgun Pellet (Elongated diamond-faceted +X slug distinct from round enemy orbs, L:W >= 1.8:1, 1.6px #141019 ink)
  bakeCustomCanvas(scene, 'proj_player_pellet', 22, 11, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.SOLAR_GOLD,
        shade: PALETTE.FLAME_ORANGE,
        highlight: '#F4F1EA',
        outlineColor: '#141019',
        outlineWidth: 1.6,
      },
      (c) =>
        tracePolygon(c, [
          { x: -8.5, y: 0 },
          { x: -1.5, y: -4.2 },
          { x: 8.8, y: 0 },
          { x: -1.5, y: 4.2 },
        ]),
      { cx: 0, cy: 0, rx: 8.5, ry: 4.2 },
    );
    ctx.fillStyle = '#F4F1EA';
    tracePolygon(ctx, [
      { x: -2.0, y: 0 },
      { x: 2.2, y: -1.6 },
      { x: 7.6, y: 0 },
      { x: 2.2, y: 1.6 },
    ]);
    ctx.fill();
  });

  // 3.0 Enemy Compact Bead Orb ('proj_enemy_small_orb' — fast curtain bead: #E84545 body + 1.5u #141019 outline + #FFFDF5 pin-core)
  bakeCustomCanvas(scene, 'proj_enemy_small_orb', 24, 24, scale, (ctx) => {
    const halo = ctx.createRadialGradient(0, 0, 3.4, 0, 0, 7.6);
    halo.addColorStop(0, 'rgba(255, 85, 115, 0.22)');
    halo.addColorStop(1, 'rgba(232, 69, 69, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    outlined(
      ctx,
      {
        fill: ENEMY_BULLET_VISUAL_SPEC.fill,
        shade: PALETTE.RUBY_CORE,
        highlight: '#FF758F',
        outlineColor: ENEMY_BULLET_VISUAL_SPEC.outlineColor,
        outlineWidth: ENEMY_BULLET_VISUAL_SPEC.outlineWidth,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 5.2, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 5.2, ry: 5.2 },
    );

    ctx.beginPath();
    ctx.arc(0, 0, 3.0, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.RUBY_DARK;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 2.1, 0, Math.PI * 2);
    ctx.fillStyle = ENEMY_BULLET_VISUAL_SPEC.core;
    ctx.fill();
  });

  // 3.1 Enemy Projectile Orb (INVIOLABLE high-contrast concentric bullseye: #E84545 body + 1.5u #141019 outline + centered #FFFDF5 core + clean subtle rim)
  bakeCustomCanvas(scene, 'proj_enemy_orb', 28, 28, scale, (ctx) => {
    const halo = ctx.createRadialGradient(0, 0, 4.5, 0, 0, 9.6);
    halo.addColorStop(0, 'rgba(255, 85, 115, 0.28)');
    halo.addColorStop(0.6, 'rgba(232, 69, 69, 0.12)');
    halo.addColorStop(1, 'rgba(232, 69, 69, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, 9.6, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    outlined(
      ctx,
      {
        fill: ENEMY_BULLET_VISUAL_SPEC.fill,
        shade: PALETTE.RUBY_CORE,
        highlight: '#FF758F',
        outlineColor: ENEMY_BULLET_VISUAL_SPEC.outlineColor,
        outlineWidth: ENEMY_BULLET_VISUAL_SPEC.outlineWidth,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 6.8, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 6.6, ry: 6.6 },
    );

    ctx.beginPath();
    ctx.arc(0, 0, ENEMY_BULLET_VISUAL_SPEC.coreRadius + 1.1, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.RUBY_DARK;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, ENEMY_BULLET_VISUAL_SPEC.coreRadius + 0.2, 0, Math.PI * 2);
    ctx.fillStyle = ENEMY_BULLET_VISUAL_SPEC.core;
    ctx.fill();
  });

  // 3.2 Enemy Heavy Core Orb ('proj_enemy_heavy_orb')
  bakeCustomCanvas(scene, 'proj_enemy_heavy_orb', 32, 32, scale, (ctx) => {
    const halo = ctx.createRadialGradient(0, 0, 5.5, 0, 0, 11.6);
    halo.addColorStop(0, 'rgba(255, 110, 80, 0.30)');
    halo.addColorStop(0.6, 'rgba(232, 69, 69, 0.14)');
    halo.addColorStop(1, 'rgba(232, 69, 69, 0)');
    ctx.beginPath();
    ctx.arc(0, 0, 11.6, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.fill();

    outlined(
      ctx,
      {
        fill: ENEMY_BULLET_VISUAL_SPEC.fill,
        shade: PALETTE.RUBY_CORE,
        highlight: '#FF8FA3',
        outlineColor: ENEMY_BULLET_VISUAL_SPEC.outlineColor,
        outlineWidth: 1.8,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 8.6, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 8.5, ry: 8.5 },
    );

    ctx.strokeStyle = '#FFB703';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 5.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
    ctx.fillStyle = ENEMY_BULLET_VISUAL_SPEC.core;
    ctx.fill();
  });

  // 3.3 Enemy Streamlined Teardrop Lance ('proj_enemy_lance' — round-nosed +X teardrop bolt)
  bakeCustomCanvas(scene, 'proj_enemy_lance', 30, 22, scale, (ctx) => {
    const halo = ctx.createRadialGradient(1.5, 0, 2.6, 1.5, 0, 9.2);
    halo.addColorStop(0, 'rgba(255, 92, 122, 0.22)');
    halo.addColorStop(1, 'rgba(232, 69, 69, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(1.5, 0, 9.2, 0, Math.PI * 2);
    ctx.fill();

    outlined(
      ctx,
      {
        fill: ENEMY_BULLET_VISUAL_SPEC.fill,
        shade: PALETTE.RUBY_CORE,
        highlight: '#FF758F',
        outlineColor: ENEMY_BULLET_VISUAL_SPEC.outlineColor,
        outlineWidth: ENEMY_BULLET_VISUAL_SPEC.outlineWidth,
      },
      (c) => {
        c.beginPath();
        c.arc(4.2, 0, 4.4, -Math.PI * 0.42, Math.PI * 0.42, false);
        c.arc(-8.8, 0, 1.6, Math.PI * 0.58, -Math.PI * 0.58, false);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 9.5, ry: 4.4 },
    );

    ctx.fillStyle = ENEMY_BULLET_VISUAL_SPEC.core;
    ctx.beginPath();
    ctx.arc(4.0, 0, 2.2, -Math.PI * 0.45, Math.PI * 0.45, false);
    ctx.lineTo(-4.2, 0);
    ctx.closePath();
    ctx.fill();
  });

  // 3.6 Clean Subtle Emissive Halo for Enemy Bullets ('fx_enemy_bullet_glow')
  bakeCustomCanvas(scene, 'fx_enemy_bullet_glow', 36, 36, scale, (ctx) => {
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 15.5);
    grad.addColorStop(0, 'rgba(255, 235, 242, 0.58)');
    grad.addColorStop(0.32, 'rgba(255, 68, 102, 0.28)');
    grad.addColorStop(0.68, 'rgba(232, 69, 69, 0.08)');
    grad.addColorStop(1, 'rgba(232, 69, 69, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 15.5, 0, Math.PI * 2);
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
        highlight: '#F4F1EA',
        outlineColor: '#141019',
        outlineWidth: 1.6,
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

// ---------------------------------------------------------------------------
// Cutout 2.0 Kit Atlas (fx_cutout_kit_512) & Elemental Reaction Mini-Strips
// ---------------------------------------------------------------------------

export const CUTOUT_KIT_ATLAS_KEY = 'fx_cutout_kit_512' as const;
export const CUTOUT_KIT_BAKE_SCALE = 3 as const;

export const ALL_CUTOUT_KIT_FRAME_KEYS = [
  // Category 1: 4 Neutral Multi-Band 4f Bursts
  'fx_micro_burst_4f',
  'fx_small_burst_4f',
  'fx_mid_burst_4f',
  'fx_compact_burst_4f',
  // Category 2: 8 Summon Sprites
  'summon_sacred_tree',
  'summon_tesla_base',
  'summon_tesla_head',
  'summon_holo_base',
  'summon_holo_head',
  'summon_thunder_decoy',
  'summon_life_blossom',
  'summon_wall_tether_pylon',
  // Category 3: Heroic & Boss Kit
  'prop_cryo_spire',
  'fx_thrown_thunder_hammer',
  'fx_parry_winged_crest',
  'fx_cutout_crescent',
  'item_life_seed',
  'fx_boss_shell_plate',
  // Category 4: Aux Projectiles & Prop Attachments
  'proj_mutator_boomerang_saw',
  'proj_dash_phase_blade',
  'proj_cluster_mortar_lob',
  'proj_holster_surge_bolt',
  'proj_holo_decoy_shot',
  'proj_gale_wind_blade',
  'proj_relic_perpetual_rocket',
  'proj_table_tech_rocket',
  'proj_reload_tediore_chuck',
  'fx_solar_mini_sun',
  'fx_frag_fuse_wheel',
  'prop_rocket_nozzle',
  'prop_cryo_node',
  // Category 5: Peripheral Status (2f), Badges, Shards & Micro-Motes
  'status_burn_2f',
  'status_chill_2f',
  'status_shock_2f',
  'status_poison_2f',
  'status_freeze_cuff',
  'status_badge_burn_9x9',
  'status_badge_chill_9x9',
  'status_badge_shock_9x9',
  'status_badge_poison_9x9',
  'duo_rail_lock_10x10',
  'fx_wood_shard',
  'fx_ceramic_shard',
  'fx_stone_chip',
  'fx_ice_shard_decal',
  'fx_rim_glint',
  'fx_pellet_dent',
  'fx_muzzle_thorn_barb',
  'fx_seed_heal_wisp',
  'fx_overheat_puff',
  'fx_rivet_hex_head',
] as const;

export type CutoutKitFrameKey = (typeof ALL_CUTOUT_KIT_FRAME_KEYS)[number];

export interface CutoutKitFrameSpec {
  key: CutoutKitFrameKey;
  x: number;
  y: number;
  w: number;
  h: number;
  worldW: number;
  worldH: number;
  frameCount: 1 | 2 | 4;
  canonicalRadiusPx?: number;
}

interface RawKitSpec {
  worldW: number;
  worldH: number;
  frameCount: 1 | 2 | 4;
  canonicalRadiusPx?: number;
  overrideW?: number;
  overrideH?: number;
}

const RAW_CUTOUT_KIT_SPECS: Record<CutoutKitFrameKey, RawKitSpec> = {
  // Category 1: 4 Neutral Multi-Band 4f Bursts
  fx_micro_burst_4f: { worldW: 8, worldH: 8, frameCount: 4, canonicalRadiusPx: 11.0 },
  fx_small_burst_4f: { worldW: 12, worldH: 12, frameCount: 4, canonicalRadiusPx: 16.0 },
  fx_mid_burst_4f: { worldW: 16, worldH: 16, frameCount: 4, canonicalRadiusPx: 21.3 },
  fx_compact_burst_4f: { worldW: 20, worldH: 20, frameCount: 4, canonicalRadiusPx: 31.2, overrideW: 256, overrideH: 64 },
  // Category 2: 8 Summon Sprites
  summon_sacred_tree: { worldW: 38, worldH: 42, frameCount: 1 },
  summon_tesla_base: { worldW: 28, worldH: 24, frameCount: 1 },
  summon_tesla_head: { worldW: 26, worldH: 18, frameCount: 1 },
  summon_holo_base: { worldW: 28, worldH: 28, frameCount: 1 },
  summon_holo_head: { worldW: 26, worldH: 18, frameCount: 1 },
  summon_thunder_decoy: { worldW: 28, worldH: 34, frameCount: 1 },
  summon_life_blossom: { worldW: 26, worldH: 26, frameCount: 1 },
  summon_wall_tether_pylon: { worldW: 24, worldH: 28, frameCount: 1 },
  // Category 3: Heroic & Boss Kit
  prop_cryo_spire: { worldW: 26, worldH: 38, frameCount: 1 },
  fx_thrown_thunder_hammer: { worldW: 28, worldH: 28, frameCount: 1 },
  fx_parry_winged_crest: { worldW: 32, worldH: 16, frameCount: 1 },
  fx_cutout_crescent: { worldW: 14, worldH: 14, frameCount: 1 },
  item_life_seed: { worldW: 18, worldH: 20, frameCount: 1 },
  fx_boss_shell_plate: { worldW: 14, worldH: 8, frameCount: 1 },
  // Category 4: Aux Projectiles & Prop Attachments
  proj_mutator_boomerang_saw: { worldW: 24, worldH: 24, frameCount: 1 },
  proj_dash_phase_blade: { worldW: 26, worldH: 12, frameCount: 1 },
  proj_cluster_mortar_lob: { worldW: 12, worldH: 10, frameCount: 1 },
  proj_holster_surge_bolt: { worldW: 18, worldH: 8, frameCount: 1 },
  proj_holo_decoy_shot: { worldW: 18, worldH: 8, frameCount: 1 },
  proj_gale_wind_blade: { worldW: 18, worldH: 9, frameCount: 1 },
  proj_relic_perpetual_rocket: { worldW: 16, worldH: 8, frameCount: 1 },
  proj_table_tech_rocket: { worldW: 14, worldH: 7, frameCount: 1 },
  proj_reload_tediore_chuck: { worldW: 14, worldH: 10, frameCount: 1 },
  fx_solar_mini_sun: { worldW: 12, worldH: 12, frameCount: 1 },
  fx_frag_fuse_wheel: { worldW: 14, worldH: 14, frameCount: 1 },
  prop_rocket_nozzle: { worldW: 10, worldH: 6, frameCount: 1 },
  prop_cryo_node: { worldW: 6, worldH: 6, frameCount: 1 },
  // Category 5: Peripheral Status (2f), Badges, Shards & Micro-Motes
  status_burn_2f: { worldW: 12, worldH: 15, frameCount: 2 },
  status_chill_2f: { worldW: 13, worldH: 9, frameCount: 2 },
  status_shock_2f: { worldW: 15, worldH: 9, frameCount: 2 },
  status_poison_2f: { worldW: 10, worldH: 10, frameCount: 2 },
  status_freeze_cuff: { worldW: 14, worldH: 8, frameCount: 1 },
  status_badge_burn_9x9: { worldW: 9, worldH: 9, frameCount: 1 },
  status_badge_chill_9x9: { worldW: 9, worldH: 9, frameCount: 1 },
  status_badge_shock_9x9: { worldW: 9, worldH: 9, frameCount: 1 },
  status_badge_poison_9x9: { worldW: 9, worldH: 9, frameCount: 1 },
  duo_rail_lock_10x10: { worldW: 10, worldH: 10, frameCount: 1 },
  fx_wood_shard: { worldW: 6, worldH: 6, frameCount: 1 },
  fx_ceramic_shard: { worldW: 6, worldH: 6, frameCount: 1 },
  fx_stone_chip: { worldW: 6, worldH: 6, frameCount: 1 },
  fx_ice_shard_decal: { worldW: 6, worldH: 6, frameCount: 1 },
  fx_rim_glint: { worldW: 6, worldH: 4, frameCount: 1 },
  fx_pellet_dent: { worldW: 8, worldH: 6, frameCount: 1 },
  fx_muzzle_thorn_barb: { worldW: 12, worldH: 6, frameCount: 1 },
  fx_seed_heal_wisp: { worldW: 8, worldH: 8, frameCount: 1 },
  fx_overheat_puff: { worldW: 6, worldH: 6, frameCount: 1 },
  fx_rivet_hex_head: { worldW: 8, worldH: 8, frameCount: 1 },
};

function computeCutoutKitLayout(): Record<CutoutKitFrameKey, CutoutKitFrameSpec> {
  const items = ALL_CUTOUT_KIT_FRAME_KEYS.map((key) => {
    const raw = RAW_CUTOUT_KIT_SPECS[key];
    const w = raw.overrideW ?? (3 * raw.worldW + 4) * raw.frameCount;
    const h = raw.overrideH ?? (3 * raw.worldH + 4);
    return { key, ...raw, w, h };
  });

  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w || a.key.localeCompare(b.key));

  let curX = 0;
  let curY = 0;
  let rowH = 0;
  const layout: Partial<Record<CutoutKitFrameKey, CutoutKitFrameSpec>> = {};

  for (const item of sorted) {
    if (curX + item.w > 512) {
      curX = 0;
      curY += rowH;
      rowH = 0;
    }
    layout[item.key] = {
      key: item.key,
      x: curX,
      y: curY,
      w: item.w,
      h: item.h,
      worldW: item.worldW,
      worldH: item.worldH,
      frameCount: item.frameCount,
      canonicalRadiusPx: item.canonicalRadiusPx,
    };
    curX += item.w;
    if (item.h > rowH) rowH = item.h;
  }

  return layout as Record<CutoutKitFrameKey, CutoutKitFrameSpec>;
}

const CUTOUT_KIT_LAYOUT = computeCutoutKitLayout();

export function getCutoutKitFrameSpec(frame: CutoutKitFrameKey): CutoutKitFrameSpec {
  const spec = CUTOUT_KIT_LAYOUT[frame];
  if (!spec) {
    throw new Error(`Unknown CutoutKitFrameKey: ${frame}`);
  }
  return spec;
}

export const ELEMENTAL_REACTION_STRIP_KEYS = [
  'fx_react_vapor_puff',
  'fx_react_shatter_pane',
  'fx_react_superconduct_cross',
  'fx_react_toxic_glob',
  'fx_react_paralysis_x',
  'fx_react_overload_star',
] as const;

export type ElementalReactionStripKey = (typeof ELEMENTAL_REACTION_STRIP_KEYS)[number];

const SMALL_SHADER_KEYS = [
  'fx_sh_cone_blast',
  'fx_sh_muzzle_burst',
  'fx_sh_hit_spark',
  'fx_sh_aegis_crest',
  'fx_sh_falcon_sonic',
  'fx_sh_arcane_sigil',
  'fx_sh_muzzle_arcane',
] as const;

export const EXISTING_GAME_ATLASES_VRAM_BYTES = 10_092_480; // Spec Section 4.2 Row 7 (10,200,000 B - 107,520 B)

export function computeTotalVramBytes(scene: Phaser.Scene): number {
  let totalBytes = EXISTING_GAME_ATLASES_VRAM_BYTES;
  const texMgr = scene.textures as unknown as {
    getTextureKeys?: () => string[];
    list?: Record<
      string,
      {
        getSourceImage?: () => { width: number; height: number };
        source?: Array<{ width: number; height: number }>;
        width?: number;
        height?: number;
      }
    >;
    get?: (key: string) =>
      | {
          getSourceImage?: () => { width: number; height: number };
          source?: Array<{ width: number; height: number }>;
          width?: number;
          height?: number;
        }
      | undefined;
    exists?: (key: string) => boolean;
  };

  const getTex = (key: string) => (texMgr.get ? texMgr.get(key) : texMgr.list?.[key]);
  const hasTex = (key: string) =>
    texMgr.exists ? texMgr.exists(key) : Boolean(texMgr.list && key in texMgr.list);

  // 1, 3, 4. 24 Shader Strips (7 small 256x128 + 15 medium 512x256 + 2 large 1024x512)
  for (const key of SHADER_FX_TEXTURE_KEYS) {
    const tex = getTex(key);
    if (!tex) continue;
    const src = tex.getSourceImage ? tex.getSourceImage() : tex.source?.[0];
    const w = src?.width ?? tex.width ?? 0;
    const h = src?.height ?? tex.height ?? 0;
    totalBytes += w * h * 4;
  }

  // 2. Mipmap pyramid for the 7 small shader strips (7 * 10,923 texels * 4 B = 305,844 B)
  for (const smallKey of SMALL_SHADER_KEYS) {
    if (hasTex(smallKey)) {
      totalBytes += 43_692;
    }
  }

  // 5. 6 Elemental Reaction Mini-Strips (6 * 256x64 * 4 B = 393,216 B)
  for (const key of ELEMENTAL_REACTION_STRIP_KEYS) {
    const tex = getTex(key);
    if (!tex) continue;
    const src = tex.getSourceImage ? tex.getSourceImage() : tex.source?.[0];
    const w = src?.width ?? tex.width ?? 0;
    const h = src?.height ?? tex.height ?? 0;
    totalBytes += w * h * 4;
  }

  // 6. Cutout 2.0 Kit Atlas (fx_cutout_kit_512: 512x512 * 4 B = 1,048,576 B)
  if (hasTex(CUTOUT_KIT_ATLAS_KEY)) {
    const tex = getTex(CUTOUT_KIT_ATLAS_KEY);
    if (tex) {
      const src = tex.getSourceImage ? tex.getSourceImage() : tex.source?.[0];
      const w = src?.width ?? tex.width ?? 0;
      const h = src?.height ?? tex.height ?? 0;
      totalBytes += w * h * 4;
    }
  }

  // Legacy godray shaft if present before Track A removal (96x280 * 4 B = 107,520 B)
  if (hasTex('arch_b2_godray_shaft')) {
    const tex = getTex('arch_b2_godray_shaft');
    if (tex) {
      const src = tex.getSourceImage ? tex.getSourceImage() : tex.source?.[0];
      const w = src?.width ?? tex.width ?? 96;
      const h = src?.height ?? tex.height ?? 280;
      totalBytes += w * h * 4;
    }
  }

  return totalBytes;
}

export function bakeCutoutKit512(scene: Phaser.Scene): void {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  for (const key of ALL_CUTOUT_KIT_FRAME_KEYS) {
    const spec = getCutoutKitFrameSpec(key);
    const cellW = spec.w / spec.frameCount;
    const cellH = spec.h;

    for (let f = 0; f < spec.frameCount; f++) {
      const cellX = spec.x + f * cellW;
      const cellY = spec.y;
      ctx.save();
      // Enforce +2px transparent border invariant strictly via clipping
      ctx.beginPath();
      ctx.rect(cellX + 2, cellY + 2, cellW - 4, cellH - 4);
      ctx.clip();
      ctx.translate(cellX + cellW / 2, cellY + cellH / 2);
      drawCutoutKitSprite(ctx, key, f, cellW - 4, cellH - 4);
      ctx.restore();
    }
  }

  if (scene.textures.exists(CUTOUT_KIT_ATLAS_KEY)) {
    scene.textures.remove(CUTOUT_KIT_ATLAS_KEY);
  }
  const tex = scene.textures.addCanvas(CUTOUT_KIT_ATLAS_KEY, canvas);
  if (!tex) return;

  for (const key of ALL_CUTOUT_KIT_FRAME_KEYS) {
    const spec = getCutoutKitFrameSpec(key);
    const cellW = spec.w / spec.frameCount;
    const cellH = spec.h;

    tex.add(key, 0, spec.x, spec.y, cellW, cellH);

    if (spec.frameCount > 1) {
      for (let f = 0; f < spec.frameCount; f++) {
        tex.add(`${key}_${f}`, 0, spec.x + f * cellW, spec.y, cellW, cellH);
      }
    }
  }
}

export function bakeElementalReactionMiniStrips(scene: Phaser.Scene): void {
  for (const key of ELEMENTAL_REACTION_STRIP_KEYS) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    for (let f = 0; f < 4; f++) {
      ctx.save();
      // Clip to inner 60x60 cell (+2px transparent padding)
      ctx.beginPath();
      ctx.rect(f * 64 + 2, 2, 60, 60);
      ctx.clip();
      ctx.translate(f * 64 + 32, 32);
      drawElementalReactionFrame(ctx, key, f);
      ctx.restore();
    }

    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
    const tex = scene.textures.addCanvas(key, canvas);
    if (!tex) continue;
    for (let f = 0; f < 4; f++) {
      tex.add(f, 0, f * 64, 0, 64, 64);
      tex.add(String(f), 0, f * 64, 0, 64, 64);
    }
  }
}

function drawCutoutKitSprite(
  ctx: CanvasRenderingContext2D,
  key: CutoutKitFrameKey,
  frame: number,
  maxW: number,
  maxH: number,
): void {
  const ink = '#141019';
  const highlight = '#F4F1EA';

  switch (key) {
    // -------------------------------------------------------------------------
    // Category 1: 4 Multi-Band Bursts (4f)
    // -------------------------------------------------------------------------
    case 'fx_micro_burst_4f':
    case 'fx_small_burst_4f':
    case 'fx_mid_burst_4f':
    case 'fx_compact_burst_4f': {
      const isCompact = key === 'fx_compact_burst_4f';
      const baseR = isCompact ? 26.0 : Math.min(maxW, maxH) * 0.46;
      const inkWidth = isCompact ? 1.25 : 1.6;

      if (frame === 0) {
        // Initial core spark
        const r = baseR * 0.42;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = highlight;
        ctx.fill();
        ctx.lineWidth = inkWidth;
        ctx.strokeStyle = ink;
        ctx.stroke();

        ctx.fillStyle = PALETTE.SOLAR_GOLD;
        for (let i = 0; i < 4; i++) {
          const ang = (i * Math.PI) / 2;
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * r * 0.7, Math.sin(ang) * r * 0.7, r * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (frame === 1) {
        // Expanding notched shock ring
        const r = baseR * 0.72;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const rad = i % 2 === 0 ? r : r * 0.78;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = PALETTE.SILVER_BRIGHT;
        ctx.fill();
        ctx.lineWidth = inkWidth;
        ctx.strokeStyle = ink;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = highlight;
        ctx.fill();
      } else if (frame === 2) {
        // Apex perforated burst ring with eroded core
        const r = baseR * 0.96;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.ICE_WHITE;
        ctx.fill();
        ctx.lineWidth = inkWidth;
        ctx.strokeStyle = ink;
        ctx.stroke();

        // Eroded dark cavity
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = highlight;
        ctx.fill();
      } else {
        // Fragmented dissipating motes
        const r = baseR * 1.0;
        ctx.globalAlpha = 0.7;
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3 + 0.26;
          const px = Math.cos(a) * r * 0.85;
          const py = Math.sin(a) * r * 0.85;
          ctx.beginPath();
          ctx.arc(px, py, baseR * 0.16, 0, Math.PI * 2);
          ctx.fillStyle = PALETTE.SILVER_BRIGHT;
          ctx.fill();
          ctx.lineWidth = inkWidth * 0.9;
          ctx.strokeStyle = ink;
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
      }
      break;
    }

    // -------------------------------------------------------------------------
    // Category 2: 8 Summon Sprites (1f)
    // -------------------------------------------------------------------------
    case 'summon_sacred_tree': {
      // Ancient gnarled tree trunk + foliage crown
      const trunkW = maxW * 0.26;
      const trunkH = maxH * 0.54;
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-trunkW / 2, 0, trunkW, trunkH);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.strokeRect(-trunkW / 2, 0, trunkW, trunkH);

      // Canopy foliage discs
      const crownR = maxW * 0.38;
      ctx.beginPath();
      ctx.arc(0, -maxH * 0.2, crownR, 0, Math.PI * 2);
      ctx.fillStyle = '#15803D';
      ctx.fill();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-crownR * 0.2, -maxH * 0.28, crownR * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = '#22C55E';
      ctx.fill();

      // Mystic rune core
      ctx.beginPath();
      ctx.arc(0, -maxH * 0.15, crownR * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.VOLT_YELLOW;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'summon_tesla_base': {
      // Tripod pedestal with brass coils
      const bw = maxW * 0.78;
      const bh = maxH * 0.44;
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fillRect(-bw / 2, 0, bw, bh);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.strokeRect(-bw / 2, 0, bw, bh);

      // Brass insulator rings
      ctx.fillStyle = PALETTE.BRASS_CORE;
      ctx.fillRect(-bw * 0.36, -bh * 0.5, bw * 0.72, bh * 0.5);
      ctx.strokeRect(-bw * 0.36, -bh * 0.5, bw * 0.72, bh * 0.5);
      break;
    }

    case 'summon_tesla_head': {
      // Rotating electrode dome + antennae
      const r = maxH * 0.38;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.CYAN_FROST;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.25, r * 0.32, 0, Math.PI * 2);
      ctx.fill();

      // Dual electrodes
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(-r * 1.3, -r * 0.6);
      ctx.lineTo(-r * 0.6, 0);
      ctx.moveTo(r * 1.3, -r * 0.6);
      ctx.lineTo(r * 0.6, 0);
      ctx.stroke();
      break;
    }

    case 'summon_holo_base': {
      // Hexagonal emitter dish
      const r = Math.min(maxW, maxH) * 0.44;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = '#1E293B';
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.CYAN_FROST;
      ctx.fill();
      break;
    }

    case 'summon_holo_head': {
      // Projector lens + projection fan
      const w = maxW * 0.74;
      const h = maxH * 0.54;
      ctx.fillStyle = '#0891B2';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.strokeRect(-w / 2, -h / 2, w, h);

      ctx.fillStyle = highlight;
      ctx.fillRect(-w * 0.3, -h * 0.3, w * 0.6, h * 0.6);
      break;
    }

    case 'summon_thunder_decoy': {
      // Dummy puppet silhouette with thunder chest emblem
      const pw = maxW * 0.58;
      const ph = maxH * 0.72;
      ctx.fillStyle = '#A16207';
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);

      // Thunder bolt glyph
      ctx.fillStyle = PALETTE.VOLT_YELLOW;
      ctx.beginPath();
      ctx.moveTo(-pw * 0.15, -ph * 0.28);
      ctx.lineTo(pw * 0.2, -ph * 0.05);
      ctx.lineTo(-pw * 0.05, 0);
      ctx.lineTo(pw * 0.15, ph * 0.28);
      ctx.lineTo(-pw * 0.2, ph * 0.05);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'summon_life_blossom': {
      // 5-petal healing flower
      const r = Math.min(maxW, maxH) * 0.42;
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const px = Math.cos(a) * r * 0.52;
        const py = Math.sin(a) * r * 0.52;
        ctx.beginPath();
        ctx.arc(px, py, r * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = '#22C55E';
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = ink;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.SOLAR_GOLD;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'summon_wall_tether_pylon': {
      // Spire pylon with tether node
      const pw = maxW * 0.52;
      const ph = maxH * 0.76;
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);

      ctx.beginPath();
      ctx.arc(0, 0, pw * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.CYAN_FROST;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    // -------------------------------------------------------------------------
    // Category 3: Heroic & Boss Kit (1f)
    // -------------------------------------------------------------------------
    case 'prop_cryo_spire': {
      // Crystalline stalagmite
      const sw = maxW * 0.64;
      const sh = maxH * 0.84;
      ctx.beginPath();
      ctx.moveTo(0, -sh / 2);
      ctx.lineTo(sw / 2, sh / 2);
      ctx.lineTo(-sw / 2, sh / 2);
      ctx.closePath();
      ctx.fillStyle = PALETTE.CYAN_FROST;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -sh / 2);
      ctx.lineTo(sw * 0.22, sh / 2);
      ctx.lineTo(0, sh / 2);
      ctx.closePath();
      ctx.fillStyle = highlight;
      ctx.fill();
      break;
    }

    case 'fx_thrown_thunder_hammer': {
      // Heavy war hammer
      const hw = maxW * 0.72;
      const hh = maxH * 0.52;
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fillRect(-hw / 2, -hh / 2, hw, hh);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.strokeRect(-hw / 2, -hh / 2, hw, hh);

      ctx.fillStyle = PALETTE.VOLT_YELLOW;
      ctx.fillRect(-hw * 0.2, -hh * 0.3, hw * 0.4, hh * 0.6);

      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(0, hh / 2);
      ctx.lineTo(0, maxH * 0.44);
      ctx.stroke();
      break;
    }

    case 'fx_parry_winged_crest': {
      // Dual golden aegis wings
      const ww = maxW * 0.88;
      const wh = maxH * 0.64;
      ctx.beginPath();
      ctx.moveTo(0, wh / 2);
      ctx.quadraticCurveTo(ww * 0.5, 0, ww / 2, -wh / 2);
      ctx.quadraticCurveTo(ww * 0.2, -wh * 0.2, 0, -wh * 0.1);
      ctx.quadraticCurveTo(-ww * 0.2, -wh * 0.2, -ww / 2, -wh / 2);
      ctx.quadraticCurveTo(-ww * 0.5, 0, 0, wh / 2);
      ctx.closePath();
      ctx.fillStyle = PALETTE.SOLAR_GOLD;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.arc(0, 0, wh * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'fx_cutout_crescent': {
      // Sharp razor crescent arc
      const r = Math.min(maxW, maxH) * 0.42;
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI * 0.4, Math.PI * 0.4, false);
      ctx.arc(-r * 0.4, 0, r * 0.75, Math.PI * 0.35, -Math.PI * 0.35, true);
      ctx.closePath();
      ctx.fillStyle = highlight;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'item_life_seed': {
      // Glowing seed pod + leaf sprout
      const r = Math.min(maxW, maxH) * 0.36;
      ctx.beginPath();
      ctx.arc(0, r * 0.2, r, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.SOLAR_GOLD;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      // Leaf sprout
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.75, r * 0.34, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#22C55E';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'fx_boss_shell_plate': {
      // Chitinous armor carapace plate
      const pw = maxW * 0.78;
      const ph = maxH * 0.56;
      ctx.beginPath();
      ctx.ellipse(0, 0, pw / 2, ph / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#831843';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.fillStyle = highlight;
      ctx.fillRect(-pw * 0.22, -ph * 0.12, pw * 0.44, ph * 0.24);
      break;
    }

    // -------------------------------------------------------------------------
    // Category 4: Aux Projectiles & Prop Attachments (1f)
    // -------------------------------------------------------------------------
    case 'proj_mutator_boomerang_saw': {
      // 6-toothed circular saw disc
      const r = Math.min(maxW, maxH) * 0.44;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const x1 = Math.cos(a) * r;
        const y1 = Math.sin(a) * r;
        const x2 = Math.cos(a + 0.35) * (r * 0.72);
        const y2 = Math.sin(a + 0.35) * (r * 0.72);
        if (i === 0) ctx.moveTo(x1, y1);
        else ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.fillStyle = PALETTE.SILVER_BRIGHT;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fill();
      break;
    }

    case 'proj_dash_phase_blade': {
      // Directional +X energy dagger
      const bw = maxW * 0.84;
      const bh = maxH * 0.42;
      ctx.beginPath();
      ctx.moveTo(-bw / 2, -bh / 2);
      ctx.lineTo(bw * 0.3, -bh / 2);
      ctx.lineTo(bw / 2, 0);
      ctx.lineTo(bw * 0.3, bh / 2);
      ctx.lineTo(-bw / 2, bh / 2);
      ctx.closePath();
      ctx.fillStyle = PALETTE.TOXIC_PURPLE;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.fillStyle = highlight;
      ctx.fillRect(-bw * 0.25, -bh * 0.15, bw * 0.5, bh * 0.3);
      break;
    }

    case 'proj_cluster_mortar_lob': {
      // Oval mortar canister with fuse
      const mw = maxW * 0.62;
      const mh = maxH * 0.58;
      ctx.beginPath();
      ctx.ellipse(0, 0, mw / 2, mh / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.fillStyle = PALETTE.FLAME_ORANGE;
      ctx.beginPath();
      ctx.arc(mw * 0.38, 0, mw * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'proj_holster_surge_bolt':
    case 'proj_holo_decoy_shot': {
      // Directional +X energy needle
      const nw = maxW * 0.84;
      const nh = maxH * 0.38;
      ctx.beginPath();
      ctx.moveTo(-nw / 2, 0);
      ctx.lineTo(-nw * 0.3, -nh / 2);
      ctx.lineTo(nw / 2, 0);
      ctx.lineTo(-nw * 0.3, nh / 2);
      ctx.closePath();
      ctx.fillStyle = key === 'proj_holster_surge_bolt' ? PALETTE.CYAN_FROST : PALETTE.ICE_WHITE;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'proj_gale_wind_blade': {
      // Aerodynamic wind scythe
      const gw = maxW * 0.82;
      ctx.beginPath();
      ctx.arc(0, 0, gw * 0.45, -Math.PI * 0.35, Math.PI * 0.35, false);
      ctx.arc(-gw * 0.3, 0, gw * 0.35, Math.PI * 0.3, -Math.PI * 0.3, true);
      ctx.closePath();
      ctx.fillStyle = PALETTE.CYAN_FROST;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'proj_relic_perpetual_rocket':
    case 'proj_table_tech_rocket': {
      // Micro rocket with warhead
      const rw = maxW * 0.78;
      const rh = maxH * 0.42;
      ctx.fillStyle = PALETTE.STEEL_LIGHT;
      ctx.fillRect(-rw / 2, -rh / 2, rw * 0.65, rh);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.strokeRect(-rw / 2, -rh / 2, rw * 0.65, rh);

      // Nose cone
      ctx.beginPath();
      ctx.moveTo(rw * 0.15, -rh / 2);
      ctx.lineTo(rw / 2, 0);
      ctx.lineTo(rw * 0.15, rh / 2);
      ctx.closePath();
      ctx.fillStyle = key === 'proj_relic_perpetual_rocket' ? PALETTE.MAGMA_RED : PALETTE.FLAME_ORANGE;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'proj_reload_tediore_chuck': {
      // Thrown weapon frame with hazard stripes
      const cw = maxW * 0.74;
      const ch = maxH * 0.58;
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.strokeRect(-cw / 2, -ch / 2, cw, ch);

      ctx.fillStyle = PALETTE.FLAME_ORANGE;
      ctx.fillRect(-cw * 0.25, -ch * 0.25, cw * 0.5, ch * 0.5);
      break;
    }

    case 'fx_solar_mini_sun': {
      // Radiant mini sun orb
      const r = Math.min(maxW, maxH) * 0.42;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rad = i % 2 === 0 ? r : r * 0.65;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = PALETTE.SOLAR_GOLD;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = highlight;
      ctx.fill();
      break;
    }

    case 'fx_frag_fuse_wheel': {
      // 4-toothed cogwheel
      const r = Math.min(maxW, maxH) * 0.42;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rad = i % 2 === 0 ? r : r * 0.72;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'prop_rocket_nozzle': {
      // Bell exhaust nozzle
      const nw = maxW * 0.68;
      const nh = maxH * 0.54;
      ctx.beginPath();
      ctx.moveTo(-nw / 2, -nh / 4);
      ctx.lineTo(nw / 2, -nh / 2);
      ctx.lineTo(nw / 2, nh / 2);
      ctx.lineTo(-nw / 2, nh / 4);
      ctx.closePath();
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'prop_cryo_node': {
      // Micro hex stud
      const r = Math.min(maxW, maxH) * 0.42;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.CYAN_FROST;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    // -------------------------------------------------------------------------
    // Category 5: Peripheral Status (2f), Badges, Shards & Micro-Motes
    // -------------------------------------------------------------------------
    case 'status_burn_2f': {
      // Dancing flame tongue
      const fw = maxW * 0.64;
      const fh = maxH * 0.78;
      const curl = frame === 0 ? fw * 0.2 : -fw * 0.2;
      ctx.beginPath();
      ctx.moveTo(-fw / 2, fh / 2);
      ctx.quadraticCurveTo(curl, 0, 0, -fh / 2);
      ctx.quadraticCurveTo(curl * 1.5, 0, fw / 2, fh / 2);
      ctx.closePath();
      ctx.fillStyle = PALETTE.FLAME_ORANGE;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, fh * 0.15, fw * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.SOLAR_GOLD;
      ctx.fill();
      break;
    }

    case 'status_chill_2f': {
      // Twinkling snowflake
      const r = Math.min(maxW, maxH) * 0.42;
      const rot = frame === 0 ? 0 : Math.PI / 6;
      ctx.save();
      ctx.rotate(rot);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = ink;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * -r, Math.sin(a) * -r);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.CYAN_FROST;
      ctx.fill();
      ctx.restore();
      break;
    }

    case 'status_shock_2f': {
      // Zigzag lightning arc
      const sw = maxW * 0.62;
      const sh = maxH * 0.76;
      const dy = frame === 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(-sw / 2, -sh * 0.3 * dy);
      ctx.lineTo(-sw * 0.1, -sh * 0.45 * dy);
      ctx.lineTo(0, 0);
      ctx.lineTo(sw * 0.2, -sh * 0.1 * dy);
      ctx.lineTo(sw / 2, sh * 0.4 * dy);
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.lineWidth = 1.2;
      ctx.strokeStyle = PALETTE.VOLT_YELLOW;
      ctx.stroke();
      break;
    }

    case 'status_poison_2f': {
      // Toxic bubbling vesicle
      const r = Math.min(maxW, maxH) * (frame === 0 ? 0.36 : 0.44);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.LIME_GLOW;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(r * 0.35, -r * 0.35, r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.TOXIC_PURPLE;
      ctx.fill();
      break;
    }

    case 'status_freeze_cuff': {
      // Ice shackle cuff
      const cw = maxW * 0.74;
      const ch = maxH * 0.52;
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.strokeRect(-cw / 2, -ch / 2, cw, ch);

      ctx.fillStyle = PALETTE.CYAN_FROST;
      ctx.fillRect(-cw * 0.32, -ch * 0.2, cw * 0.64, ch * 0.4);
      break;
    }

    case 'status_badge_burn_9x9':
    case 'status_badge_chill_9x9':
    case 'status_badge_shock_9x9':
    case 'status_badge_poison_9x9': {
      // 9x9 status badge diamond
      const r = Math.min(maxW, maxH) * 0.44;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      const fillCol =
        key === 'status_badge_burn_9x9'
          ? PALETTE.MAGMA_RED
          : key === 'status_badge_chill_9x9'
            ? PALETTE.CYAN_FROST
            : key === 'status_badge_shock_9x9'
              ? PALETTE.VOLT_YELLOW
              : PALETTE.LIME_GLOW;
      ctx.fillStyle = fillCol;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'duo_rail_lock_10x10': {
      // Interlocking clamp brackets
      const s = Math.min(maxW, maxH) * 0.42;
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.strokeRect(-s, -s, s * 2, s * 2);

      ctx.fillStyle = PALETTE.SOLAR_GOLD;
      ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
      break;
    }

    case 'fx_wood_shard':
    case 'fx_ceramic_shard':
    case 'fx_stone_chip':
    case 'fx_ice_shard_decal': {
      // Material break shards (<= 6x6)
      const r = Math.min(maxW, maxH) * 0.42;
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.5);
      ctx.lineTo(r * 0.2, -r);
      ctx.lineTo(r, r * 0.7);
      ctx.closePath();
      const fillCol =
        key === 'fx_wood_shard'
          ? '#92400E'
          : key === 'fx_ceramic_shard'
            ? '#DC2626'
            : key === 'fx_stone_chip'
              ? '#52525B'
              : PALETTE.CYAN_FROST;
      ctx.fillStyle = fillCol;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'fx_rim_glint': {
      // Specular 4-point star glint
      const rw = maxW * 0.45;
      const rh = maxH * 0.35;
      ctx.beginPath();
      ctx.moveTo(0, -rh);
      ctx.lineTo(rw * 0.3, 0);
      ctx.lineTo(0, rh);
      ctx.lineTo(-rw * 0.3, 0);
      ctx.closePath();
      ctx.fillStyle = highlight;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'fx_pellet_dent': {
      // Bullet dent crater
      const r = Math.min(maxW, maxH) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#18181B';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'fx_muzzle_thorn_barb': {
      // Curved thorn barb
      const w = maxW * 0.78;
      const h = maxH * 0.48;
      ctx.beginPath();
      ctx.moveTo(-w / 2, h / 2);
      ctx.quadraticCurveTo(0, 0, w / 2, -h / 2);
      ctx.quadraticCurveTo(0, h * 0.2, -w / 2, h / 2);
      ctx.closePath();
      ctx.fillStyle = '#15803D';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'fx_seed_heal_wisp': {
      // Healing mote wisp
      const r = Math.min(maxW, maxH) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#22C55E';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.fillStyle = highlight;
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.25, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'fx_overheat_puff': {
      // Exhaust smoke puff
      const r = Math.min(maxW, maxH) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#71717A';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'fx_rivet_hex_head': {
      // Hex rivet bolt head
      const r = Math.min(maxW, maxH) * 0.42;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.fillStyle = PALETTE.STEEL_LIGHT;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

function drawElementalReactionFrame(
  ctx: CanvasRenderingContext2D,
  key: ElementalReactionStripKey,
  frame: number,
): void {
  const ink = '#141019';
  const highlight = '#F4F1EA';
  const progress = frame / 3;
  const baseR = 12 + progress * 14;

  switch (key) {
    case 'fx_react_vapor_puff': {
      // Steam/vapor puff cloud rising
      ctx.beginPath();
      ctx.arc(0, -progress * 6, baseR, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.ICE_WHITE;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-baseR * 0.3, -progress * 6 - baseR * 0.2, baseR * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = highlight;
      ctx.fill();
      break;
    }

    case 'fx_react_shatter_pane': {
      // Shattering ice pane shards
      const r = baseR;
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.7);
      ctx.lineTo(r * 0.8, -r * 0.6);
      ctx.lineTo(r, r * 0.8);
      ctx.lineTo(-r * 0.6, r);
      ctx.closePath();
      ctx.fillStyle = PALETTE.CYAN_FROST;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      if (frame >= 2) {
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(0, r);
        ctx.moveTo(-r, 0);
        ctx.lineTo(r, 0);
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = ink;
        ctx.stroke();
      }
      break;
    }

    case 'fx_react_superconduct_cross': {
      // 4-point electrical diamond cross
      const rx = baseR * 1.1;
      const ry = baseR * 0.45;
      ctx.beginPath();
      ctx.moveTo(0, -rx);
      ctx.lineTo(ry, 0);
      ctx.lineTo(0, rx);
      ctx.lineTo(-ry, 0);
      ctx.closePath();
      ctx.fillStyle = PALETTE.VOLT_YELLOW;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-rx, 0);
      ctx.lineTo(0, ry);
      ctx.lineTo(rx, 0);
      ctx.lineTo(0, -ry);
      ctx.closePath();
      ctx.fillStyle = PALETTE.CYAN_FROST;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ink;
      ctx.stroke();
      break;
    }

    case 'fx_react_toxic_glob': {
      // Acid poison glob expanding & popping
      ctx.beginPath();
      ctx.arc(0, 0, baseR * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.LIME_GLOW;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-baseR * 0.3, -baseR * 0.25, baseR * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.TOXIC_PURPLE;
      ctx.fill();
      break;
    }

    case 'fx_react_paralysis_x': {
      // Electric X-burst
      const arm = baseR * 0.95;
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(-arm, -arm);
      ctx.lineTo(arm, arm);
      ctx.moveTo(arm, -arm);
      ctx.lineTo(-arm, arm);
      ctx.stroke();

      ctx.lineWidth = 1.4;
      ctx.strokeStyle = PALETTE.VOLT_YELLOW;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, baseR * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = highlight;
      ctx.fill();
      break;
    }

    case 'fx_react_overload_star': {
      // Overload fiery starburst
      const r = baseR;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rad = i % 2 === 0 ? r : r * 0.5;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = PALETTE.FLAME_ORANGE;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = ink;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = highlight;
      ctx.fill();
      break;
    }
  }
}
