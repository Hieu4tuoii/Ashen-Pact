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
        fill: '#1D334A',
        shade: '#162738',
        highlight: '#4B7294',
        outlineWidth: 1.6,
      },
      (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 5),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    ctx.beginPath();
    ctx.arc(-4, -3, 4.5, 0, Math.PI * 1.4);
    ctx.strokeStyle = '#4B7294';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  });

  // 2. Electrified Water
  bakeCustomCanvas(scene, 'surface_electrified_water', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#234463',
        shade: '#1A334B',
        highlight: '#6BA2C9',
        outlineWidth: 1.8,
      },
      (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 5),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(-2, -1);
    ctx.lineTo(-5, 4);
    ctx.lineTo(9, 8);
    ctx.strokeStyle = '#A89B42';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.stroke();
  });

  // 3. Oil
  bakeCustomCanvas(scene, 'surface_oil', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#262333',
        shade: '#1B1924',
        highlight: '#3B2D29',
        outlineWidth: 1.8,
      },
      (c) => traceRoundedRect(c, -14, -14, 28, 28, 6),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    ctx.beginPath();
    ctx.ellipse(-3, -3, 6.5, 3.2, -0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#363047';
    ctx.fill();
  });

  // 4. Burning Oil
  bakeCustomCanvas(scene, 'surface_burning_oil', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#8F452C',
        shade: '#632E1D',
        highlight: '#AD623B',
        outlineWidth: 2.0,
      },
      (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 6),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    tracePolygon(ctx, [
      { x: -6, y: 6 },
      { x: -2, y: -8 },
      { x: 2, y: -1 },
      { x: 6, y: -9 },
      { x: 9, y: 6 },
    ]);
    ctx.fillStyle = '#AD623B';
    ctx.fill();
  });

  // 5. Grass
  bakeCustomCanvas(scene, 'surface_grass', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#2C4736',
        shade: '#23382B',
        highlight: '#3D6149',
        outlineWidth: 1.6,
      },
      (c) => traceRoundedRect(c, -14, -14, 28, 28, 5),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    for (const ox of [-6, 1, 7]) {
      tracePolygon(ctx, [
        { x: ox - 2.2, y: 5 },
        { x: ox, y: -5 },
        { x: ox + 2.2, y: 5 },
      ]);
      ctx.fillStyle = '#466E53';
      ctx.fill();
    }
  });

  // 6. Burning Grass
  bakeCustomCanvas(scene, 'surface_burning_grass', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#6E332B',
        shade: '#4A2420',
        highlight: '#8F4738',
        outlineWidth: 1.8,
      },
      (c) => traceRoundedRect(c, -14, -14, 28, 28, 5),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    for (const ox of [-5, 3]) {
      tracePolygon(ctx, [
        { x: ox - 2.6, y: 5 },
        { x: ox, y: -6 },
        { x: ox + 2.6, y: 5 },
      ]);
      ctx.fillStyle = '#9E5B3E';
      ctx.fill();
    }
  });

  // 7. Ash
  bakeCustomCanvas(scene, 'surface_ash', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#332E36',
        shade: '#221E24',
        highlight: '#423C46',
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
        fill: '#3B2D4A',
        shade: '#2B2138',
        highlight: '#4E6B48',
        outlineWidth: 1.8,
      },
      (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 6),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    for (const [bx, by, br] of [
      [-5, -3, 3.0],
      [5, 4, 2.3],
    ] as const) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = '#526B47';
      ctx.fill();
    }
  });

  // 9. Lava
  bakeCustomCanvas(scene, 'surface_lava', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#8A342B',
        shade: '#59201B',
        highlight: '#A85236',
        outlineWidth: 2.0,
      },
      (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 5),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(0, 2);
    ctx.lineTo(9, -4);
    ctx.strokeStyle = '#A85236';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();
  });

  // 10. Ice
  bakeCustomCanvas(scene, 'surface_ice', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#4F7A8A',
        shade: '#3D606E',
        highlight: '#739EAE',
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
    ctx.strokeStyle = '#6892A3';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  });

  // 11. Chasm (Biome 2 Frozen Abyss Pit)
  bakeCustomCanvas(scene, 'surface_chasm', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#11131A',
        shade: PALETTE.INK_DARK,
        highlight: '#1D2230',
        outlineWidth: 2.0,
      },
      (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 4),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    ctx.strokeStyle = '#1D2230';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-10, -10, 20, 20);
  });

  // 12. Conveyor Belt (Biome 3 Molten Forge Mechanical Belt)
  bakeCustomCanvas(scene, 'surface_conveyor', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#343A45',
        shade: '#232730',
        highlight: '#7F6559',
        outlineWidth: 1.8,
      },
      (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 3.5),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    for (const cx of [-6, 3]) {
      ctx.beginPath();
      ctx.moveTo(cx - 3, -6);
      ctx.lineTo(cx + 3, 0);
      ctx.lineTo(cx - 3, 6);
      ctx.strokeStyle = '#525A69';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  });
}

function isOrganicShorelineSurface(surface: Exclude<SurfaceKind, 'none'>): boolean {
  return (
    surface === 'water' ||
    surface === 'electrified_water' ||
    surface === 'poison_swamp' ||
    surface === 'grass' ||
    surface === 'burning_grass' ||
    surface === 'ice'
  );
}

/**
 * Draws a neighbor-aware interactive surface cell directly onto the arena composite canvas:
 * - Desaturated surface fills (~30% reduced saturation) and interior patterns with deltaL <= 10
 * - P1 Organic 2-layer curved shoreline on exposed edges of water, electrified_water, poison_swamp, grass, burning_grass, ice
 * - P3 Beveled 4u basalt stone conduit curb (#7F6559 / #3B2D29) on exposed edges of lava, oil, burning_oil, conveyor, chasm, ash
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
  const hasE = (maskHas(surfaceMask, AUTOTILE_EAST));
  const hasS = (maskHas(surfaceMask, AUTOTILE_SOUTH));
  const hasW = (maskHas(surfaceMask, AUTOTILE_WEST));

  const organic = isOrganicShorelineSurface(surface);

  let fill = '#1D334A';
  let outerBank = '#2A4763';
  let innerLip = '#4B7294';
  let detailColor = '#3B5C7A';

  switch (surface) {
    case 'water':
      fill = '#1D334A';
      outerBank = '#263B52';
      innerLip = '#3E6282';
      detailColor = '#32516E';
      break;
    case 'electrified_water':
      fill = '#234463';
      outerBank = '#2C5173';
      innerLip = '#5687AD';
      detailColor = '#8F853B';
      break;
    case 'poison_swamp':
      fill = '#3B2D4A';
      outerBank = '#2D3B36';
      innerLip = '#496146';
      detailColor = '#4D6347';
      break;
    case 'grass':
      fill = '#2C4736';
      outerBank = '#253B2D';
      innerLip = '#3B5E47';
      detailColor = '#41664D';
      break;
    case 'burning_grass':
      fill = '#6E332B';
      outerBank = '#4F2621';
      innerLip = '#8A4538';
      detailColor = '#96543B';
      break;
    case 'ice':
      fill = '#4F7A8A';
      outerBank = '#3E616E';
      innerLip = '#6A94A3';
      detailColor = '#618999';
      break;
    case 'lava':
      fill = '#8A342B';
      outerBank = '#7F6559';
      innerLip = '#3B2D29';
      detailColor = '#A34E35';
      break;
    case 'oil':
      fill = '#262333';
      outerBank = '#7F6559';
      innerLip = '#3B2D29';
      detailColor = '#353047';
      break;
    case 'burning_oil':
      fill = '#8F452C';
      outerBank = '#7F6559';
      innerLip = '#3B2D29';
      detailColor = '#A85E3A';
      break;
    case 'conveyor':
      fill = '#343A45';
      outerBank = '#7F6559';
      innerLip = '#3B2D29';
      detailColor = '#4E5666';
      break;
    case 'chasm':
      fill = '#11131A';
      outerBank = '#7F6559';
      innerLip = '#3B2D29';
      detailColor = '#1C202E';
      break;
    case 'ash':
      fill = '#332E36';
      outerBank = '#7F6559';
      innerLip = '#3B2D29';
      detailColor = '#413B45';
      break;
  }

  const padN = hasN ? 0 : organic ? 2.2 : 3.6;
  const padE = hasE ? 0 : organic ? 2.2 : 3.6;
  const padS = hasS ? 0 : organic ? 2.2 : 3.6;
  const padW = hasW ? 0 : organic ? 2.2 : 3.6;

  const sx = padW;
  const sy = padN;
  const sw = 32 - padW - padE;
  const sh = 32 - padN - padS;

  ctx.save();
  ctx.translate(dx, dy);
  ctx.scale(scale, scale);

  // 1. Base desaturated surface fill
  ctx.fillStyle = fill;
  ctx.fillRect(sx, sy, sw, sh);

  // 2. Interior details (kept strictly within deltaL <= 10 of fill)
  const ox = ((variant % 3) - 1) * 1.6;
  const oy = ((Math.floor(variant / 3) % 3) - 1) * 1.4;

  ctx.save();
  ctx.beginPath();
  ctx.rect(sx, sy, sw, sh);
  ctx.clip();

  switch (surface) {
    case 'water': {
      ctx.beginPath();
      ctx.arc(14 + ox, 15 + oy, 4.0, 0.15, Math.PI * 1.25);
      ctx.strokeStyle = detailColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      break;
    }
    case 'electrified_water': {
      ctx.beginPath();
      ctx.moveTo(8 + ox, 11 + oy);
      ctx.lineTo(15, 15);
      ctx.lineTo(13, 20);
      ctx.lineTo(23 + ox, 23 + oy);
      ctx.strokeStyle = detailColor;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.stroke();
      break;
    }
    case 'poison_swamp': {
      for (const [bx, by, br] of [
        [11 + ox, 13 + oy, 2.8],
        [21 - ox, 20 - oy, 2.2],
      ] as const) {
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = detailColor;
        ctx.fill();
      }
      break;
    }
    case 'grass': {
      for (const gx of [10, 17, 23]) {
        tracePolygon(ctx, [
          { x: gx + ox - 2.0, y: 21 + oy },
          { x: gx + ox, y: 11 + oy },
          { x: gx + ox + 2.0, y: 21 + oy },
        ]);
        ctx.fillStyle = detailColor;
        ctx.fill();
      }
      break;
    }
    case 'burning_grass': {
      for (const gx of [11, 20]) {
        tracePolygon(ctx, [
          { x: gx + ox - 2.4, y: 21 },
          { x: gx + ox, y: 10 },
          { x: gx + ox + 2.4, y: 21 },
        ]);
        ctx.fillStyle = detailColor;
        ctx.fill();
      }
      break;
    }
    case 'ice': {
      ctx.beginPath();
      ctx.moveTo(9 + ox, 21);
      ctx.lineTo(21 + ox, 9);
      ctx.moveTo(14 + ox, 23);
      ctx.lineTo(24 + ox, 13);
      ctx.strokeStyle = detailColor;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.stroke();
      break;
    }
    case 'lava': {
      ctx.beginPath();
      ctx.moveTo(8 + ox, 12 + oy);
      ctx.lineTo(16, 18 + oy);
      ctx.lineTo(24 - ox, 13 + oy);
      ctx.strokeStyle = detailColor;
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.stroke();
      break;
    }
    case 'oil': {
      ctx.beginPath();
      ctx.ellipse(13 + ox, 14 + oy, 5.8, 2.8, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = detailColor;
      ctx.fill();
      break;
    }
    case 'burning_oil': {
      tracePolygon(ctx, [
        { x: 10 + ox, y: 21 },
        { x: 14 + ox, y: 10 },
        { x: 18 + ox, y: 16 },
        { x: 22 + ox, y: 9 },
        { x: 24 + ox, y: 21 },
      ]);
      ctx.fillStyle = detailColor;
      ctx.fill();
      break;
    }
    case 'conveyor': {
      for (const cx of [10, 20]) {
        ctx.beginPath();
        ctx.moveTo(cx - 2.4, 10);
        ctx.lineTo(cx + 2.4, 16);
        ctx.lineTo(cx - 2.4, 22);
        ctx.strokeStyle = detailColor;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
      break;
    }
    case 'chasm': {
      ctx.strokeStyle = detailColor;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(7, 7, 18, 18);
      break;
    }
    case 'ash':
      break;
  }
  ctx.restore();

  // 3. Exposed Edge Architecture: P1 Organic 2-Layer Curved Shoreline vs P3 4u Basalt Conduit Curb
  if (organic) {
    // P1: 2-layer organic curved shoreline along exposed edges
    const waveOffset = ((variant & 1) === 0 ? 1 : -1) * 1.1;

    // Layer 1: Outer damp bank (3.2u)
    ctx.strokeStyle = outerBank;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (!hasN) {
      ctx.moveTo(sx, sy + 0.8);
      ctx.quadraticCurveTo(16, sy + 0.8 + waveOffset, sx + sw, sy + 0.8);
    }
    if (!hasS) {
      ctx.moveTo(sx, sy + sh - 0.8);
      ctx.quadraticCurveTo(16, sy + sh - 0.8 - waveOffset, sx + sw, sy + sh - 0.8);
    }
    if (!hasW) {
      ctx.moveTo(sx + 0.8, sy);
      ctx.quadraticCurveTo(sx + 0.8 + waveOffset, 16, sx + 0.8, sy + sh);
    }
    if (!hasE) {
      ctx.moveTo(sx + sw - 0.8, sy);
      ctx.quadraticCurveTo(sx + sw - 0.8 - waveOffset, 16, sx + sw - 0.8, sy + sh);
    }
    ctx.stroke();

    // Layer 2: Inner foam / moss / frost shoreline lip (1.6u)
    ctx.strokeStyle = innerLip;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (!hasN) {
      ctx.moveTo(sx + 0.5, sy + 2.2);
      ctx.quadraticCurveTo(16, sy + 2.2 + waveOffset, sx + sw - 0.5, sy + 2.2);
    }
    if (!hasS) {
      ctx.moveTo(sx + 0.5, sy + sh - 2.2);
      ctx.quadraticCurveTo(16, sy + sh - 2.2 - waveOffset, sx + sw - 0.5, sy + sh - 2.2);
    }
    if (!hasW) {
      ctx.moveTo(sx + 2.2, sy + 0.5);
      ctx.quadraticCurveTo(sx + 2.2 + waveOffset, 16, sx + 2.2, sy + sh - 0.5);
    }
    if (!hasE) {
      ctx.moveTo(sx + sw - 2.2, sy + 0.5);
      ctx.quadraticCurveTo(sx + sw - 2.2 - waveOffset, 16, sx + sw - 2.2, sy + sh - 0.5);
    }
    ctx.stroke();
  } else {
    // P3: Beveled 4u basalt stone conduit curb (#7F6559 top cap / #3B2D29 inner wall)
    const curbTop = '#7F6559';
    const curbFront = '#3B2D29';
    const curbJoint = '#1F1614';

    if (!hasN) {
      ctx.fillStyle = curbTop;
      ctx.fillRect(0, 0, 32, 2.4);
      ctx.fillStyle = curbFront;
      ctx.fillRect(0, 2.4, 32, 1.6);
      ctx.strokeStyle = curbJoint;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(16, 4.0);
      ctx.stroke();
    }
    if (!hasS) {
      ctx.fillStyle = curbFront;
      ctx.fillRect(0, 28.0, 32, 1.6);
      ctx.fillStyle = curbTop;
      ctx.fillRect(0, 29.6, 32, 2.4);
      ctx.strokeStyle = curbJoint;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(16, 28.0);
      ctx.lineTo(16, 32);
      ctx.stroke();
    }
    if (!hasW) {
      ctx.fillStyle = curbTop;
      ctx.fillRect(0, 0, 2.4, 32);
      ctx.fillStyle = curbFront;
      ctx.fillRect(2.4, 0, 1.6, 32);
      ctx.strokeStyle = curbJoint;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(4.0, 16);
      ctx.stroke();
    }
    if (!hasE) {
      ctx.fillStyle = curbFront;
      ctx.fillRect(28.0, 0, 1.6, 32);
      ctx.fillStyle = curbTop;
      ctx.fillRect(29.6, 0, 2.4, 32);
      ctx.strokeStyle = curbJoint;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(28.0, 16);
      ctx.lineTo(32, 16);
      ctx.stroke();
    }

    // Crisp outer contour on exposed conduit curb edges
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (!hasN) {
      ctx.moveTo(0, 0.7);
      ctx.lineTo(32, 0.7);
    }
    if (!hasS) {
      ctx.moveTo(0, 31.3);
      ctx.lineTo(32, 31.3);
    }
    if (!hasW) {
      ctx.moveTo(0.7, 0);
      ctx.lineTo(0.7, 32);
    }
    if (!hasE) {
      ctx.moveTo(31.3, 0);
      ctx.lineTo(31.3, 32);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function maskHas(mask: number, bit: number): boolean {
  return (mask & bit) !== 0;
}
