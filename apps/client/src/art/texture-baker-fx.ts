import type Phaser from 'phaser';
import { PALETTE, type PaletteHex } from './palette.js';
import { outlined, tracePolygon, traceRoundedRect } from './primitives.js';
import { bakeCustomCanvas, registerCanvasTexture } from './texture-baker-canvas.js';

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
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.48, 'rgba(255, 255, 255, 0.82)');
  grad.addColorStop(0.78, 'rgba(255, 255, 255, 0.38)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  registerCanvasTexture(scene, 'fx_light_radial', canvas);
}

export function bakeProjectilesAndFx(scene: Phaser.Scene, scale: number): void {
  // 1. Player Projectile Bolt (default cyan/gold)
  bakeCustomCanvas(scene, 'proj_player_bolt', 24, 14, scale, (ctx) => {
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
    bakeCustomCanvas(scene, key, 24, 14, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'proj_player_pellet', 18, 18, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'proj_enemy_orb', 24, 24, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'proj_stress_orb', 16, 16, stressScale, (ctx) => {
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

  bakeCustomCanvas(scene, 'proj_stress_enemy', 18, 18, stressScale, (ctx) => {
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

  bakeCustomCanvas(scene, 'proj_stress_player', 20, 12, stressScale, (ctx) => {
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
  bakeCustomCanvas(scene, 'fx_slash_arc', 110, 110, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'fx_spark', 18, 18, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'fx_muzzle_flash', 28, 24, scale, (ctx) => {
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

  // 11. Persistent Floor Decals (Scorch, Splatter, Frost, Debris)
  bakeCustomCanvas(scene, 'fx_decal_scorch', 42, 42, scale, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 13, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20, 16, 25, 0.68)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 7.5, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(11, 9, 14, 0.85)';
    ctx.fill();
  });

  bakeCustomCanvas(scene, 'fx_decal_splatter', 28, 28, scale, (ctx) => {
    ctx.fillStyle = 'rgba(30, 78, 56, 0.72)';
    ctx.beginPath();
    ctx.ellipse(-2, 1, 8, 5.5, 0.3, 0, Math.PI * 2);
    ctx.arc(6, -3, 3.5, 0, Math.PI * 2);
    ctx.arc(-6, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  bakeCustomCanvas(scene, 'fx_decal_frost', 32, 32, scale, (ctx) => {
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

  bakeCustomCanvas(scene, 'fx_ambient_mist', 64, 32, scale, (ctx) => {
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
    grad.addColorStop(0, 'rgba(167, 243, 208, 0.18)');
    grad.addColorStop(1, 'rgba(167, 243, 208, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 12, 0, 0, Math.PI * 2);
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
