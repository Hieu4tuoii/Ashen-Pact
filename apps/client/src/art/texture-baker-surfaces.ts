import type Phaser from 'phaser';
import {
  AUTOTILE_EAST,
  AUTOTILE_NORTH,
  AUTOTILE_SOUTH,
  AUTOTILE_WEST,
  type SurfaceKind,
} from '@ashen-pact/shared';
import { PALETTE } from './palette.js';
import { outlined, tracePolygon, traceRoundedRect } from './primitives.js';
import { bakeCustomCanvas } from './texture-baker-canvas.js';

export function bakeSurfaces(scene: Phaser.Scene, scale: number): void {
  // 1. Water
  bakeCustomCanvas(scene, 'surface_water', 32, 32, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'surface_electrified_water', 32, 32, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'surface_oil', 32, 32, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'surface_burning_oil', 32, 32, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'surface_grass', 32, 32, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'surface_burning_grass', 32, 32, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'surface_ash', 32, 32, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'surface_poison_swamp', 32, 32, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'surface_lava', 32, 32, scale, (ctx) => {
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
  bakeCustomCanvas(scene, 'surface_ice', 32, 32, scale, (ctx) => {
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

  // 11. Chasm (Biome 2 Frozen Abyss Pit)
  bakeCustomCanvas(scene, 'surface_chasm', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.INK_DEEP,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.COBALT_SHADE,
        outlineWidth: 2.0,
      },
      (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 4),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    ctx.strokeStyle = PALETTE.ABYSS_BLUE;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-10, -10, 20, 20);
  });

  // 12. Conveyor Belt (Biome 3 Molten Forge Mechanical Belt)
  bakeCustomCanvas(scene, 'surface_conveyor', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_DARK,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.BRASS_CORE,
        outlineWidth: 1.8,
      },
      (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 3.5),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    for (const cx of [-6, 3]) {
      ctx.beginPath();
      ctx.moveTo(cx - 3, -7);
      ctx.lineTo(cx + 3, 0);
      ctx.lineTo(cx - 3, 7);
      ctx.strokeStyle = PALETTE.SOLAR_GOLD;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  });
}

/**
 * Draws a neighbor-aware interactive surface cell directly onto the arena composite canvas
 * so multi-tile pools (water, oil, grass, swamp, lava, ice, chasm, conveyor) join seamlessly without grid seams.
 */
export function drawSurfaceTile(
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
    case 'chasm':
      fill = PALETTE.INK_DEEP;
      rim = PALETTE.COBALT_SHADE;
      shade = PALETTE.INK_DARK;
      break;
    case 'conveyor':
      fill = PALETTE.STEEL_DARK;
      rim = PALETTE.BRASS_CORE;
      shade = PALETTE.SLATE_DARK;
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
    case 'chasm': {
      ctx.strokeStyle = PALETTE.ABYSS_BLUE;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(6, 6, 20, 20);
      break;
    }
    case 'conveyor': {
      for (const cx of [10, 20]) {
        ctx.beginPath();
        ctx.moveTo(cx - 2.5, 9);
        ctx.lineTo(cx + 2.5, 16);
        ctx.lineTo(cx - 2.5, 23);
        ctx.strokeStyle = PALETTE.SOLAR_GOLD;
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
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
