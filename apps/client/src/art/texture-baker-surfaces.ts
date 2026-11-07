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

  // 11. Chasm (Biome 1 Deep Root Abyss + Biome 2/3 variants)
  bakeCustomCanvas(scene, 'surface_chasm', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#09070d',
        shade: PALETTE.INK_DARK,
        highlight: '#2B3731',
        outlineWidth: 2.0,
      },
      (c) => traceRoundedRect(c, -14.5, -14.5, 29, 29, 4),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    ctx.strokeStyle = '#4D382B';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-12, -13);
    ctx.quadraticCurveTo(-6, -7, -2, -9);
    ctx.moveTo(11, 13);
    ctx.quadraticCurveTo(5, 7, 1, 10);
    ctx.stroke();
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

export function traceOrganicPoolPath(
  ctx: CanvasRenderingContext2D,
  surfaceMask: number,
  pad = 2.6,
): void {
  const hasN = (surfaceMask & AUTOTILE_NORTH) !== 0;
  const hasE = (surfaceMask & AUTOTILE_EAST) !== 0;
  const hasS = (surfaceMask & AUTOTILE_SOUTH) !== 0;
  const hasW = (surfaceMask & AUTOTILE_WEST) !== 0;

  const x0 = hasW ? 0 : pad;
  const y0 = hasN ? 0 : pad;
  const x1 = hasE ? 32 : 32 - pad;
  const y1 = hasS ? 32 : 32 - pad;
  const rNW = !hasN && !hasW ? 5.5 : 0;
  const rNE = !hasN && !hasE ? 5.5 : 0;
  const rSE = !hasS && !hasE ? 5.5 : 0;
  const rSW = !hasS && !hasW ? 5.5 : 0;

  ctx.beginPath();
  ctx.moveTo(x0 + rNW, y0);
  ctx.lineTo(x1 - rNE, y0);
  if (rNE > 0) ctx.arcTo(x1, y0, x1, y0 + rNE, rNE);
  ctx.lineTo(x1, y1 - rSE);
  if (rSE > 0) ctx.arcTo(x1, y1, x1 - rSE, y1, rSE);
  ctx.lineTo(x0 + rSW, y1);
  if (rSW > 0) ctx.arcTo(x0, y1, x0, y1 - rSW, rSW);
  ctx.lineTo(x0, y0 + rNW);
  if (rNW > 0) ctx.arcTo(x0, y0, x0 + rNW, y0, rNW);
  ctx.closePath();
}

function traceExposedOrganicShorelineRim(
  ctx: CanvasRenderingContext2D,
  surfaceMask: number,
  pad = 2.4,
): void {
  const hasN = (surfaceMask & AUTOTILE_NORTH) !== 0;
  const hasE = (surfaceMask & AUTOTILE_EAST) !== 0;
  const hasS = (surfaceMask & AUTOTILE_SOUTH) !== 0;
  const hasW = (surfaceMask & AUTOTILE_WEST) !== 0;

  const x0 = hasW ? 0 : pad;
  const y0 = hasN ? 0 : pad;
  const x1 = hasE ? 32 : 32 - pad;
  const y1 = hasS ? 32 : 32 - pad;
  const rNW = !hasN && !hasW ? 5.5 : 0;
  const rNE = !hasN && !hasE ? 5.5 : 0;
  const rSE = !hasS && !hasE ? 5.5 : 0;
  const rSW = !hasS && !hasW ? 5.5 : 0;

  ctx.beginPath();
  if (!hasN) {
    ctx.moveTo(x0 + rNW, y0);
    ctx.lineTo(x1 - rNE, y0);
  }
  if (rNE > 0) {
    if (hasN) ctx.moveTo(x1 - rNE, y0);
    ctx.arcTo(x1, y0, x1, y0 + rNE, rNE);
  }
  if (!hasE) {
    if (rNE === 0) ctx.moveTo(x1, y0);
    ctx.lineTo(x1, y1 - rSE);
  }
  if (rSE > 0) {
    if (hasE) ctx.moveTo(x1, y1 - rSE);
    ctx.arcTo(x1, y1, x1 - rSE, y1, rSE);
  }
  if (!hasS) {
    if (rSE === 0) ctx.moveTo(x1, y1);
    ctx.lineTo(x0 + rSW, y1);
  }
  if (rSW > 0) {
    if (hasS) ctx.moveTo(x0 + rSW, y1);
    ctx.arcTo(x0, y1, x0, y1 - rSW, rSW);
  }
  if (!hasW) {
    if (rSW === 0) ctx.moveTo(x0, y1);
    ctx.lineTo(x0, y0 + rNW);
  }
  if (rNW > 0) {
    if (hasW) ctx.moveTo(x0, y0 + rNW);
    ctx.arcTo(x0, y0, x0 + rNW, y0, rNW);
  }
}

function isOrganicShorelineSurface(surface: Exclude<SurfaceKind, 'none'>): boolean {
  return (
    surface === 'water' ||
    surface === 'electrified_water' ||
    surface === 'poison_swamp' ||
    surface === 'oil' ||
    surface === 'burning_oil' ||
    surface === 'grass' ||
    surface === 'burning_grass' ||
    surface === 'ash' ||
    surface === 'ice' ||
    surface === 'lava'
  );
}

/**
 * Draws a neighbor-aware interactive surface cell directly onto the arena composite canvas:
 * - Multi-layered volcanic magma ('lava') and translucent glacial crystal ('ice') with non-pinching organic pool paths
 * - Bathymetric water, branching electric arcs, toxic swamp bubbles, iridescent oil, volumetric grass tufts,
 *   multi-layered flames, biome-specific subterranean chasm cliff strata, and industrial conveyor chevrons
 */
export function drawSurfaceTile(
  ctx: CanvasRenderingContext2D,
  surface: SurfaceKind,
  surfaceMask: number,
  dx: number,
  dy: number,
  cellPx: number,
  variant = 0,
  biome: 0 | 1 | 2 | 3 = 1,
): void {
  if (surface === 'none') return;

  const scale = cellPx / 32;
  const v = ((variant % 8) + 8) % 8;
  const vShift = (v - 3.5) * 1.1;
  const hasN = (surfaceMask & AUTOTILE_NORTH) !== 0;
  const hasE = maskHas(surfaceMask, AUTOTILE_EAST);
  const hasS = maskHas(surfaceMask, AUTOTILE_SOUTH);
  const hasW = maskHas(surfaceMask, AUTOTILE_WEST);

  ctx.save();
  ctx.translate(dx, dy);
  ctx.scale(scale, scale);

  if (surface === 'lava') {
    ctx.save();
    traceOrganicPoolPath(ctx, surfaceMask, 2.4);
    ctx.clip();

    // Seamless magma bed: uniform #991B1B edge tone at 0 and 32 with soft interior #DC2626 glow (no diagonal linear gradient banding)
    ctx.fillStyle = '#991B1B';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#DC2626';
    ctx.globalAlpha = 0.38;
    ctx.beginPath();
    ctx.ellipse(
      16 + ((v % 3) - 1) * 1.4,
      16 + (((v >> 1) % 3) - 1) * 1.4,
      10.5,
      9.5,
      0.15 * ((v % 3) - 1),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Varied irregular polygonal cooled basalt crust plates across variants 0..7
    const cx1 = 5 + ((v * 3) % 7);
    const cy1 = 5 + ((v * 5) % 6);
    ctx.fillStyle = '#261816';
    ctx.beginPath();
    ctx.moveTo(cx1, cy1 + 2);
    ctx.lineTo(cx1 + 6 + (v % 3), cy1);
    ctx.lineTo(cx1 + 9, cy1 + 5 + (v % 2));
    ctx.lineTo(cx1 + 4, cy1 + 8);
    ctx.lineTo(cx1 - 1, cy1 + 6);
    ctx.closePath();
    ctx.fill();

    const cx2 = 16 + ((v * 5) % 6);
    const cy2 = 15 + ((v * 3) % 6);
    ctx.fillStyle = '#1F1614';
    ctx.beginPath();
    ctx.moveTo(cx2, cy2 + 1);
    ctx.lineTo(cx2 + 7, cy2 - 1 + (v % 2));
    ctx.lineTo(cx2 + 8 - (v % 2), cy2 + 6);
    ctx.lineTo(cx2 + 2, cy2 + 8);
    ctx.lineTo(cx2 - 2, cy2 + 5);
    ctx.closePath();
    ctx.fill();

    // Organic Voronoi magma fissure network connecting across connected cardinal midpoints (16) and terminating inside exposed rims
    const jx1 = 11 + ((v * 3) % 5) - 2;
    const jy1 = 12 + ((v * 5) % 5) - 2;
    const jx2 = 21 - ((v * 3) % 5) + 2;
    const jy2 = 19 - ((v * 2) % 5) + 2;
    const westX = hasW ? 0 : 6 + (v % 3);
    const eastX = hasE ? 32 : 26 - (v % 3);
    const northY = hasN ? 0 : 6 + ((v >> 1) % 3);
    const southY = hasS ? 32 : 26 - ((v >> 1) % 3);

    const traceFissures = () => {
      ctx.beginPath();
      ctx.moveTo(westX, 16);
      ctx.lineTo(jx1, jy1);
      ctx.lineTo(jx2, jy2);
      ctx.lineTo(eastX, 16);
      if (v % 2 === 0) {
        ctx.moveTo(jx1, jy1);
        ctx.lineTo(16, northY);
        ctx.moveTo(jx2, jy2);
        ctx.lineTo(16, southY);
      } else {
        ctx.moveTo(jx2, jy2);
        ctx.lineTo(16, northY);
        ctx.moveTo(jx1, jy1);
        ctx.lineTo(16, southY);
      }
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#EA580C';
    ctx.lineWidth = 2.6;
    traceFissures();
    ctx.stroke();

    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 1.7;
    ctx.stroke();

    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 0.95;
    ctx.stroke();

    ctx.strokeStyle = '#FFFDF5';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(jx1, jy1);
    ctx.lineTo(jx2, jy2);
    ctx.stroke();
    ctx.restore();

    if (surfaceMask !== 15) {
      ctx.save();
      traceExposedOrganicShorelineRim(ctx, surfaceMask, 2.4);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1F1614';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.strokeStyle = '#EA580C';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  if (surface === 'ice') {
    ctx.save();
    traceOrganicPoolPath(ctx, surfaceMask, 2.4);
    ctx.clip();

    // Seamless glacial crystal base: uniform #3B7290 border tone with soft interior #2C5E7A / #4889A6 depth
    ctx.fillStyle = '#3B7290';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#2C5E7A';
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    ctx.ellipse(
      14 + ((v % 3) - 1) * 1.3,
      15 + (((v >> 1) % 3) - 1) * 1.3,
      10.5,
      9.0,
      0.18 * ((v % 3) - 1),
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = '#4889A6';
    ctx.beginPath();
    ctx.ellipse(
      18 - ((v % 3) - 1) * 1.2,
      17 - (((v >> 1) % 3) - 1) * 1.2,
      8.5,
      7.0,
      -0.15 * ((v % 3) - 1),
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Subtle sub-surface frost sheen (#7DD3FC) and polygonal crystalline facet (#BAE6FD)
    ctx.fillStyle = '#7DD3FC';
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.moveTo(2 + (v % 4), 18 - (v % 3));
    ctx.lineTo(15 + vShift, 4 + (v % 4));
    ctx.lineTo(29 - (v % 3), 14 + (v % 3));
    ctx.lineTo(18 - (v % 4), 28 - (v % 2));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#BAE6FD';
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(6 + ((v * 3) % 6), 5 + (v % 3));
    ctx.lineTo(19 + (v % 4), 7 + ((v * 2) % 4));
    ctx.lineTo(16 - (v % 3), 17 + (v % 3));
    ctx.lineTo(7 + (v % 2), 14 - (v % 2));
    ctx.closePath();
    ctx.fill();

    // Continuous Voronoi pressure-crack network meeting at connected edge midpoints (16) and terminating inside exposed rims
    const nx1 = 10 + ((v * 3) % 6);
    const ny1 = 10 + ((v * 5) % 5);
    const nx2 = 22 - ((v * 3) % 5);
    const ny2 = 20 - ((v * 2) % 5);
    const westX = hasW ? 0 : 6 + (v % 3);
    const eastX = hasE ? 32 : 26 - (v % 3);
    const northY = hasN ? 0 : 6 + ((v >> 1) % 3);
    const southY = hasS ? 32 : 26 - ((v >> 1) % 3);

    ctx.globalAlpha = 0.52;
    ctx.strokeStyle = '#1E3A5F';
    ctx.lineWidth = 1.15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(westX, 16);
    ctx.lineTo(nx1, ny1);
    ctx.lineTo(nx2, ny2);
    ctx.lineTo(eastX, 16);
    if ((v & 1) === 0) {
      ctx.moveTo(nx1, ny1);
      ctx.lineTo(16, northY);
      ctx.moveTo(nx2, ny2);
      ctx.lineTo(16, southY);
    } else {
      ctx.moveTo(nx2, ny2);
      ctx.lineTo(16, northY);
      ctx.moveTo(nx1, ny1);
      ctx.lineTo(16, southY);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(westX, 15.3);
    ctx.lineTo(nx1, ny1 - 0.7);
    ctx.lineTo(nx2, ny2 - 0.7);
    ctx.lineTo(eastX, 15.3);
    ctx.stroke();
    ctx.restore();

    if (surfaceMask !== 15) {
      ctx.save();
      traceExposedOrganicShorelineRim(ctx, surfaceMask, 2.4);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#CFE8EE';
      ctx.lineWidth = 2.0;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  const organic = isOrganicShorelineSurface(surface);

  let fill = '#1D334A';
  let outerBank = '#2A4763';
  let innerLip = '#4B7294';

  switch (surface) {
    case 'water':
      fill = '#1D334A';
      outerBank = '#263B52';
      innerLip = '#3E6282';
      break;
    case 'electrified_water':
      fill = '#234463';
      outerBank = '#2C5173';
      innerLip = '#5687AD';
      break;
    case 'poison_swamp':
      fill = '#3B2D4A';
      outerBank = '#2D3B36';
      innerLip = '#496146';
      break;
    case 'grass':
      fill = '#2C4736';
      outerBank = '#253B2D';
      innerLip = '#3B5E47';
      break;
    case 'burning_grass':
      fill = '#6E332B';
      outerBank = '#4F2621';
      innerLip = '#8A4538';
      break;
    case 'oil':
      fill = '#1B1924';
      outerBank = '#2A2438';
      innerLip = '#3B2D29';
      break;
    case 'burning_oil':
      fill = '#7C2D12';
      outerBank = '#3B2019';
      innerLip = '#8F452C';
      break;
    case 'conveyor':
      fill = '#343A45';
      outerBank = '#7F6559';
      innerLip = '#3B2D29';
      break;
    case 'chasm':
      if (biome === 2) {
        fill = '#09131c';
        outerBank = '#4A6E7A';
        innerLip = '#243B47';
      } else if (biome === 3) {
        fill = '#120807';
        outerBank = '#5E463F';
        innerLip = '#3B2D29';
      } else {
        fill = '#09070d';
        outerBank = '#4D5D53';
        innerLip = '#2B3731';
      }
      break;
    case 'ash':
      fill = '#332E36';
      outerBank = '#252129';
      innerLip = '#423C46';
      break;
  }

  const basePad = surface === 'chasm' ? 1.2 : organic ? 2.2 : 3.2;
  const padN = hasN ? 0 : basePad;
  const padE = hasE ? 0 : basePad;
  const padS = hasS ? 0 : basePad;
  const padW = hasW ? 0 : basePad;

  const sx = padW;
  const sy = padN;
  const sw = 32 - padW - padE;
  const sh = 32 - padN - padS;

  const rNW = organic && !hasN && !hasW ? 9 : 0;
  const rNE = organic && !hasN && !hasE ? 9 : 0;
  const rSE = organic && !hasS && !hasE ? 9 : 0;
  const rSW = organic && !hasS && !hasW ? 9 : 0;

  const waveOffset = organic && surfaceMask !== 15 ? ((v & 1) === 0 ? 1 : -1) * 0.9 : 0;

  // 1. Base surface fill
  ctx.fillStyle = fill;
  traceOrganicSurfaceRect(
    ctx,
    sx,
    sy,
    sw,
    sh,
    rNW,
    rNE,
    rSE,
    rSW,
    hasN,
    hasE,
    hasS,
    hasW,
    waveOffset,
  );
  ctx.fill();

  // 2. Interior details
  const ox = ((v % 3) - 1) * 1.6;
  const oy = ((Math.floor(v / 3) % 3) - 1) * 1.4;

  ctx.save();
  traceOrganicSurfaceRect(
    ctx,
    sx,
    sy,
    sw,
    sh,
    rNW,
    rNE,
    rSE,
    rSW,
    hasN,
    hasE,
    hasS,
    hasW,
    waveOffset,
  );
  ctx.clip();

  switch (surface) {
    case 'water': {
      // Seamless #1D334A border tone with soft interior bathymetric depth patch (no horizontal linear gradient banding)
      ctx.fillStyle = '#1D334A';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#162738';
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(
        16 + ox,
        16 + oy,
        10.5,
        8.5,
        0.15 * ((v % 3) - 1),
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Separate beginPath/stroke per ripple arc so Canvas 2D never joins them with a straight line
      ctx.strokeStyle = '#7DD3FC';
      ctx.lineWidth = 1.1;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(9 + ((v * 3) % 7), 11 + (v % 4), 3.6, 0.25, Math.PI * 1.15);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(21 - ((v * 2) % 6), 21 - (v % 4), 2.8, Math.PI * 0.85, Math.PI * 1.75);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
      break;
    }
    case 'electrified_water': {
      // Seamless #234463 border tone with soft interior depth patch and edge-connected lightning arcs
      ctx.fillStyle = '#234463';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#1A334B';
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.ellipse(
        16 - ox,
        16 + oy,
        10.5,
        8.5,
        -0.15 * ((v % 3) - 1),
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.globalAlpha = 1.0;

      const lx = (v % 3) * 1.5 - 1.5;
      const ly = ((v >> 1) % 3) * 1.5 - 1.5;
      const startX = hasW ? 0 : 4 + lx;
      const startY = hasW ? 16 : 10 + (v % 4);
      const endX = hasE ? 32 : 28;
      const endY = hasE ? 16 : 17 - (v % 3);
      const branchX = hasN ? 16 : 22 + lx;
      const branchY = hasN ? 0 : 8 + (v % 3);
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(11 - ly, 14 + lx);
      ctx.lineTo(9 + ly, 19 - lx);
      ctx.lineTo(17, 15 + ly);
      ctx.lineTo(23 - lx, 22);
      ctx.lineTo(endX, endY);
      ctx.moveTo(17, 15 + ly);
      ctx.lineTo(branchX, branchY);
      if (hasS) {
        ctx.moveTo(9 + ly, 19 - lx);
        ctx.lineTo(16, 32);
      }
      ctx.stroke();
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 0.85;
      ctx.stroke();
      break;
    }
    case 'poison_swamp': {
      // Mottled dark toxic mire patches
      ctx.fillStyle = '#2B2138';
      ctx.beginPath();
      ctx.ellipse(11 + ox, 12 + oy, 7.5, 5.2, 0.3 * (v % 3), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#32452E';
      ctx.beginPath();
      ctx.ellipse(21 - ox, 20 - oy, 6.5, 4.5, -0.25 * (v % 3), 0, Math.PI * 2);
      ctx.fill();

      // Separate beginPath/stroke per bubble ring so no connecting straight lines are drawn
      ctx.strokeStyle = '#84CC16';
      ctx.lineWidth = 1.1;
      ctx.globalAlpha = 0.72;
      const b1x = 8 + ((v * 3) % 7);
      const b1y = 9 + ((v * 5) % 6);
      ctx.beginPath();
      ctx.arc(b1x, b1y, 2.5, 0, Math.PI * 2);
      ctx.stroke();

      const b2x = 22 - ((v * 3) % 6);
      const b2y = 18 + (v % 5);
      ctx.beginPath();
      ctx.arc(b2x, b2y, 1.9, 0, Math.PI * 2);
      ctx.stroke();

      const b3x = 14 + ((v * 2) % 5);
      const b3y = 23 - (v % 4);
      ctx.beginPath();
      ctx.arc(b3x, b3y, 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
      break;
    }
    case 'grass': {
      const clusterOffsets: ReadonlyArray<readonly [number, number]> = [
        [6, 9],
        [12, 19],
        [16, 11],
        [21, 21],
        [26, 13],
      ];
      for (let b = 0; b < 5; b++) {
        const [baseX, baseY] = clusterOffsets[(b + v) % 5]!;
        const gx = baseX + (((v * 3 + b * 5) % 5) - 2) * 1.1;
        const gy = baseY + (((v * 5 + b * 3) % 5) - 2) * 1.1;
        const h = 4.2 + ((v + b) % 3) * 0.9;
        ctx.fillStyle = b % 2 === 0 ? '#1E4E38' : '#499F54';
        ctx.beginPath();
        ctx.moveTo(gx - 2, gy + 4.5);
        ctx.lineTo(gx + (b % 2 === 0 ? -0.7 : 0.7), gy - h);
        ctx.lineTo(gx + 2, gy + 4.5);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'oil': {
      ctx.fillStyle = '#1B1924';
      ctx.fillRect(0, 0, 32, 32);
      const sheenShiftX = (hasE ? 2.5 : 0) - (hasW ? 2.5 : 0);
      const sheenShiftY = (hasS ? 2.5 : 0) - (hasN ? 2.5 : 0);
      ctx.fillStyle = '#362B48';
      ctx.beginPath();
      ctx.ellipse(
        13 + ox + sheenShiftX,
        14 + oy + sheenShiftY * 0.6,
        9.5 + (hasE || hasW ? 2.5 : 0),
        5.5 + (hasN || hasS ? 1.2 : 0),
        0.22 * ((v % 3) - 1),
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = '#263E57';
      ctx.beginPath();
      ctx.ellipse(
        19 - ox + sheenShiftX * 0.6,
        19 - oy + sheenShiftY,
        7.2 + (hasE || hasW ? 1.8 : 0),
        4.2 + (hasN || hasS ? 1.5 : 0),
        -0.2 * ((v % 3) - 1),
        0,
        Math.PI * 2,
      );
      ctx.fill();
      break;
    }
    case 'burning_oil':
    case 'burning_grass': {
      // Seamless uniform ember bed (no per-tile radial-gradient dark edge grid) + soft interior glow patches
      ctx.fillStyle = surface === 'burning_oil' ? '#7C2D12' : '#6E332B';
      ctx.fillRect(0, 0, 32, 32);

      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.ellipse(
        14 + ox * 1.2,
        17 + oy * 1.1,
        8.5 + (v % 3),
        6.5 + ((v >> 1) % 3),
        0.2 * ((v % 3) - 1),
        0,
        Math.PI * 2,
      );
      ctx.fill();

      ctx.fillStyle = '#EA580C';
      ctx.beginPath();
      ctx.ellipse(
        18 - ox * 1.1,
        15 - oy * 1.2,
        6.0 + ((v + 1) % 3),
        4.8 + (v % 2),
        -0.25 * ((v % 3) - 1),
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.globalAlpha = 1.0;

      const flameColors = ['#DC2626', '#F97316', '#FACC15', '#F4F1EA'];
      const basePositions: ReadonlyArray<readonly [number, number, number]> = [
        [7 + ((v * 3) % 6), 24 - (v % 4), 8.5 + (v % 3)],
        [15 + ox * 1.4, 22 + oy * 1.2, 10.5 + ((v >> 1) % 3)],
        [23 - ((v * 2) % 6), 25 - ((v >> 1) % 4), 8.0 + ((v + 1) % 3)],
        [14 + ((v & 1) ? 2.5 : -2.5), 21 - (v % 2), 5.5 + (v % 2)],
      ];
      for (let f = 0; f < flameColors.length; f++) {
        const [fx, fy, fh] = basePositions[f]!;
        const w = 3.8 - f * 0.65;
        const lean = (((v + f) % 3) - 1) * 1.4;
        ctx.fillStyle = flameColors[f]!;
        ctx.beginPath();
        ctx.moveTo(fx - w, fy);
        ctx.quadraticCurveTo(fx - w * 0.5, fy - fh * 0.55, fx + lean, fy - fh);
        ctx.quadraticCurveTo(fx + w * 0.5, fy - fh * 0.55, fx + w, fy);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'conveyor': {
      const x0 = hasW ? 0 : 2;
      const x1 = hasE ? 32 : 30;
      ctx.fillStyle = '#1E222B';
      ctx.fillRect(x0, 2, x1 - x0, 28);
      ctx.strokeStyle = '#6E7889';
      ctx.lineWidth = 2.0;
      ctx.strokeRect(x0, 3, x1 - x0, 26);

      // Subtle static belt slats/chevrons (live directional chevrons are rendered over the track by BiomeArchitectureLiveLayer)
      ctx.strokeStyle = '#F59E42';
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const cx of [9, 18, 26]) {
        ctx.beginPath();
        ctx.moveTo(cx - 3, 9);
        ctx.lineTo(cx, 16);
        ctx.lineTo(cx - 3, 23);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
      break;
    }
    case 'chasm': {
      const strataColors =
        biome === 2
          ? ['#345462', '#243B47', '#182A33', '#050408']
          : biome === 3
            ? ['#4A352F', '#8A342B', '#2A120E', '#050408']
            : ['#4D382B', '#3D5235', '#1F1815', '#050408'];

      // Deep abyssal void base
      ctx.fillStyle = '#050408';
      ctx.fillRect(0, 0, 32, 32);

      // 3/4 perspective receding subterranean cliff strata along exposed North/West/East/South edges
      for (let s = 0; s < strataColors.length; s++) {
        const topDepth = hasN ? 0 : 3.5 + s * 3.2;
        const sideDepth = 1.8 + s * 1.4;
        const botDepth = hasS ? 0 : 1.5 + s * 1.1;
        const rx = hasW ? 0 : sideDepth;
        const ry = hasN ? 0 : topDepth;
        const rw = Math.max(2, 32 - rx - (hasE ? 0 : sideDepth));
        const rh = Math.max(2, 32 - ry - botDepth);
        ctx.fillStyle = strataColors[s]!;
        ctx.fillRect(rx, ry, rw, rh);
      }

      if (!hasN) {
        // Horizontal rock courses on the 3/4 northern subterranean cliff wall, clipped to West/East side strata
        const c0x = hasW ? 0 : 1.8;
        const c0w = Math.max(2, 32 - c0x - (hasE ? 0 : 1.8));
        ctx.fillStyle = strataColors[0]!;
        ctx.fillRect(c0x, 0, c0w, 4.5);

        const c1x = hasW ? 0 : 3.2;
        const c1w = Math.max(2, 32 - c1x - (hasE ? 0 : 3.2));
        ctx.fillStyle = strataColors[1]!;
        ctx.fillRect(c1x, 4.5, c1w, 4.5);

        const c2x = hasW ? 0 : 4.6;
        const c2w = Math.max(2, 32 - c2x - (hasE ? 0 : 4.6));
        ctx.fillStyle = strataColors[2]!;
        ctx.fillRect(c2x, 9.0, c2w, 4.0);

        const vx0 = hasW ? 0 : 3.2;
        const vx1 = hasE ? 32 : 28.8;
        ctx.strokeStyle = biome === 2 ? '#22D3EE' : biome === 3 ? '#DC2626' : strataColors[0]!;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(vx0, 4.5);
        ctx.lineTo(16, 5.5 + (v % 2));
        ctx.lineTo(vx1, 4.5);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      } else if (biome === 2) {
        // Record glacial cyan crystal vein in deep chasm
        ctx.strokeStyle = '#22D3EE';
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(8, 12);
        ctx.lineTo(14, 16);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      } else if (biome === 3) {
        ctx.strokeStyle = '#DC2626';
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(10, 14);
        ctx.lineTo(18, 18);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      if (biome <= 1) {
        // Biome 1 Deep Root Abyss: gnarled roots clinging to exposed cliff edges
        ctx.strokeStyle = '#4D382B';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (!hasN) {
          ctx.moveTo(8 + ox, 3);
          ctx.quadraticCurveTo(11, 9, 9, 13);
          ctx.moveTo(22 - ox, 3);
          ctx.quadraticCurveTo(19, 8, 21, 12);
        }
        if (!hasS) {
          ctx.moveTo(10 - ox, 29);
          ctx.quadraticCurveTo(13, 23, 11, 19);
        }
        if (!hasW) {
          ctx.moveTo(3, 10 + oy);
          ctx.quadraticCurveTo(9, 13, 12, 11);
        }
        if (!hasE) {
          ctx.moveTo(29, 20 - oy);
          ctx.quadraticCurveTo(23, 17, 20, 19);
        }
        ctx.stroke();
      }
      break;
    }
    case 'ash':
      break;
  }
  ctx.restore();

  // 3. Exposed Edge Architecture: P1 Organic 2-Layer Curved Shoreline vs P3 Conduit Curb / Chasm Lip
  if (organic) {
    if (surfaceMask !== 15) {
      // P1: 2-layer organic curved shoreline along exposed edges & rounded outer corners only
      const waveOffset = ((v & 1) === 0 ? 1 : -1) * 0.9;

      // Layer 1: Outer damp bank (2.8u)
      ctx.strokeStyle = outerBank;
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      traceOrganicShorelineLayer(
        ctx,
        sx,
        sy,
        sw,
        sh,
        hasN,
        hasE,
        hasS,
        hasW,
        rNW,
        rNE,
        rSE,
        rSW,
        0.8,
        waveOffset,
      );
      ctx.stroke();

      // Layer 2: Inner foam / moss / frost shoreline lip (1.4u)
      ctx.strokeStyle = innerLip;
      ctx.lineWidth = 1.4;
      traceOrganicShorelineLayer(
        ctx,
        sx,
        sy,
        sw,
        sh,
        hasN,
        hasE,
        hasS,
        hasW,
        rNW,
        rNE,
        rSE,
        rSW,
        2.0,
        waveOffset,
      );
      ctx.stroke();
    }
  } else if (surface === 'chasm') {
    // Natural stone cliff lip along exposed chasm edges only
    if (surfaceMask !== 15) {
      ctx.fillStyle = outerBank;
      if (!hasN) ctx.fillRect(0, 0, 32, 2.2);
      if (!hasS) ctx.fillRect(0, 29.8, 32, 2.2);
      if (!hasW) ctx.fillRect(0, 0, 2.2, 32);
      if (!hasE) ctx.fillRect(29.8, 0, 2.2, 32);

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
  } else {
    // Conveyor belt side rails along exposed North/South/West/East edges
    const curbTop = '#7F6559';
    const curbFront = '#3B2D29';
    if (!hasN) {
      ctx.fillStyle = curbTop;
      ctx.fillRect(0, 0, 32, 2.2);
      ctx.fillStyle = curbFront;
      ctx.fillRect(0, 2.2, 32, 1.4);
    }
    if (!hasS) {
      ctx.fillStyle = curbFront;
      ctx.fillRect(0, 28.4, 32, 1.4);
      ctx.fillStyle = curbTop;
      ctx.fillRect(0, 29.8, 32, 2.2);
    }
    if (!hasW) {
      ctx.fillStyle = curbTop;
      ctx.fillRect(0, 0, 2.2, 32);
    }
    if (!hasE) {
      ctx.fillStyle = curbTop;
      ctx.fillRect(29.8, 0, 2.2, 32);
    }
  }

  ctx.restore();
}

function traceOrganicSurfaceRect(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  rNW: number,
  rNE: number,
  rSE: number,
  rSW: number,
  hasN = true,
  hasE = true,
  hasS = true,
  hasW = true,
  waveOffset = 0,
): void {
  ctx.beginPath();
  ctx.moveTo(sx + rNW, sy);
  if (!hasN && waveOffset !== 0) {
    ctx.quadraticCurveTo(16, sy + waveOffset, sx + sw - rNE, sy);
  } else {
    ctx.lineTo(sx + sw - rNE, sy);
  }
  if (rNE > 0) {
    ctx.arcTo(sx + sw, sy, sx + sw, sy + rNE, rNE);
  }
  if (!hasE && waveOffset !== 0) {
    ctx.quadraticCurveTo(sx + sw - waveOffset, 16, sx + sw, sy + sh - rSE);
  } else {
    ctx.lineTo(sx + sw, sy + sh - rSE);
  }
  if (rSE > 0) {
    ctx.arcTo(sx + sw, sy + sh, sx + sw - rSE, sy + sh, rSE);
  }
  if (!hasS && waveOffset !== 0) {
    ctx.quadraticCurveTo(16, sy + sh - waveOffset, sx + rSW, sy + sh);
  } else {
    ctx.lineTo(sx + rSW, sy + sh);
  }
  if (rSW > 0) {
    ctx.arcTo(sx, sy + sh, sx, sy + sh - rSW, rSW);
  }
  if (!hasW && waveOffset !== 0) {
    ctx.quadraticCurveTo(sx + waveOffset, 16, sx, sy + rNW);
  } else {
    ctx.lineTo(sx, sy + rNW);
  }
  if (rNW > 0) {
    ctx.arcTo(sx, sy, sx + rNW, sy, rNW);
  }
  ctx.closePath();
}

function traceOrganicShorelineLayer(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  hasN: boolean,
  hasE: boolean,
  hasS: boolean,
  hasW: boolean,
  rNW: number,
  rNE: number,
  rSE: number,
  rSW: number,
  inset: number,
  waveOffset: number,
): void {
  ctx.beginPath();
  if (!hasN) {
    const x0 = sx + (rNW > 0 ? rNW : 0);
    const x1 = sx + sw - (rNE > 0 ? rNE : 0);
    ctx.moveTo(x0, sy + inset);
    ctx.quadraticCurveTo(16, sy + inset + waveOffset, x1, sy + inset);
  }
  if (!hasS) {
    const x0 = sx + (rSW > 0 ? rSW : 0);
    const x1 = sx + sw - (rSE > 0 ? rSE : 0);
    ctx.moveTo(x0, sy + sh - inset);
    ctx.quadraticCurveTo(16, sy + sh - inset - waveOffset, x1, sy + sh - inset);
  }
  if (!hasW) {
    const y0 = sy + (rNW > 0 ? rNW : 0);
    const y1 = sy + sh - (rSW > 0 ? rSW : 0);
    ctx.moveTo(sx + inset, y0);
    ctx.quadraticCurveTo(sx + inset + waveOffset, 16, sx + inset, y1);
  }
  if (!hasE) {
    const y0 = sy + (rNE > 0 ? rNE : 0);
    const y1 = sy + sh - (rSE > 0 ? rSE : 0);
    ctx.moveTo(sx + sw - inset, y0);
    ctx.quadraticCurveTo(sx + sw - inset - waveOffset, 16, sx + sw - inset, y1);
  }
  if (rNW > 0) {
    const r = Math.max(1.5, rNW - inset);
    ctx.moveTo(sx + inset, sy + rNW);
    ctx.arcTo(sx + inset, sy + inset, sx + rNW, sy + inset, r);
  }
  if (rNE > 0) {
    const r = Math.max(1.5, rNE - inset);
    ctx.moveTo(sx + sw - rNE, sy + inset);
    ctx.arcTo(sx + sw - inset, sy + inset, sx + sw - inset, sy + rNE, r);
  }
  if (rSE > 0) {
    const r = Math.max(1.5, rSE - inset);
    ctx.moveTo(sx + sw - inset, sy + sh - rSE);
    ctx.arcTo(sx + sw - inset, sy + sh - inset, sx + sw - rSE, sy + sh - inset, r);
  }
  if (rSW > 0) {
    const r = Math.max(1.5, rSW - inset);
    ctx.moveTo(sx + rSW, sy + sh - inset);
    ctx.arcTo(sx + inset, sy + sh - inset, sx + inset, sy + sh - rSW, r);
  }
}

function maskHas(mask: number, bit: number): boolean {
  return (mask & bit) !== 0;
}

export interface BridgeTileLookup {
  cols?: number;
  rows?: number;
  width?: number;
  height?: number;
  getTile?: (tx: number, ty: number) => string;
  getSurface?: (tx: number, ty: number) => string;
  tiles?: ReadonlyArray<{ kind: string; surface: string } | string>;
}

function readLookupCell(
  grid: BridgeTileLookup,
  tx: number,
  ty: number,
): { kind: string; surface: string } | null {
  const cols = grid.cols ?? grid.width ?? 0;
  const rows = grid.rows ?? grid.height ?? 0;
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return null;
  if (typeof grid.getTile === 'function' && typeof grid.getSurface === 'function') {
    return { kind: grid.getTile(tx, ty), surface: grid.getSurface(tx, ty) };
  }
  if (grid.tiles) {
    const raw = grid.tiles[ty * cols + tx];
    if (raw && typeof raw === 'object') return raw;
  }
  return null;
}

export function hasChasmAlongAxisWithin3(
  grid: BridgeTileLookup,
  tx: number,
  ty: number,
  dx: number,
  dy: number,
): boolean {
  for (let step = 1; step <= 4; step++) {
    const c = readLookupCell(grid, tx + dx * step, ty + dy * step);
    if (!c) return false;
    if (c.surface === 'chasm') return true;
    if (c.kind !== 'floor' || c.surface !== 'none') return false;
  }
  return false;
}

export function isBridgeFloorTileOverChasm(
  grid: BridgeTileLookup,
  tx: number,
  ty: number,
): boolean {
  const cell = readLookupCell(grid, tx, ty);
  if (!cell || cell.kind !== 'floor' || cell.surface !== 'none') return false;

  const hasChasmN = hasChasmAlongAxisWithin3(grid, tx, ty, 0, -1);
  const hasChasmS = hasChasmAlongAxisWithin3(grid, tx, ty, 0, 1);
  if (hasChasmN && hasChasmS) {
    return true;
  }

  const hasChasmW = hasChasmAlongAxisWithin3(grid, tx, ty, -1, 0);
  const hasChasmE = hasChasmAlongAxisWithin3(grid, tx, ty, 1, 0);
  return hasChasmW && hasChasmE;
}

export function drawBridgeOverChasmOverlay(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  cellPx: number,
  hasChasmN: boolean,
  hasChasmS: boolean,
  biome: 0 | 1 | 2 | 3 = 1,
  hasChasmW = false,
  hasChasmE = false,
  isVerticalBridge = false,
): void {
  const scale = cellPx / 32;
  ctx.save();
  ctx.translate(dx, dy);
  ctx.scale(scale, scale);

  const deckColor = biome === 2 ? '#4A6E7A' : biome === 3 ? '#5E463F' : '#524033';
  const plankSeam = biome === 2 ? '#2B4652' : biome === 3 ? '#2B1E1B' : '#2E221B';
  const railColor = biome === 2 ? '#7CA6B2' : biome === 3 ? '#8C6C5E' : '#6E5A49';
  const vertical = isVerticalBridge || ((hasChasmW || hasChasmE) && !hasChasmN && !hasChasmS);

  if (vertical) {
    // North-South catwalk orientation: horizontal planks across walkway, vertical center beam, W/E guardrails
    ctx.fillStyle = deckColor;
    ctx.globalAlpha = 0.86;
    ctx.fillRect(1, 0, 30, 32);

    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = '#141019';
    ctx.lineWidth = 1.4;
    for (const py of [6, 13, 20, 27]) {
      ctx.beginPath();
      ctx.moveTo(1, py);
      ctx.lineTo(31, py);
      ctx.stroke();
    }

    ctx.strokeStyle = plankSeam;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(16, 32);
    ctx.stroke();

    // Recessed center-beam bolt heads in railColor (no internal rail bars)
    ctx.fillStyle = railColor;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(15.2, 3, 1.6, 1.6);
    ctx.fillRect(15.2, 27.4, 1.6, 1.6);
    ctx.globalAlpha = 0.92;

    if (hasChasmW) {
      ctx.fillStyle = railColor;
      ctx.fillRect(0, 0, 4.2, 32);
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 1.3;
      ctx.strokeRect(0.5, 0.5, 3.4, 31);
    }
    if (hasChasmE) {
      ctx.fillStyle = railColor;
      ctx.fillRect(27.8, 0, 4.2, 32);
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 1.3;
      ctx.strokeRect(28.1, 0.5, 3.4, 31);
    }
  } else {
    // East-West bridge orientation: vertical planks across walkway, horizontal center beam, N/S guardrails
    ctx.fillStyle = deckColor;
    ctx.globalAlpha = 0.86;
    ctx.fillRect(0, 1, 32, 30);

    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = '#141019';
    ctx.lineWidth = 1.4;
    for (const px of [6, 13, 20, 27]) {
      ctx.beginPath();
      ctx.moveTo(px, 1);
      ctx.lineTo(px, 31);
      ctx.stroke();
    }

    ctx.strokeStyle = plankSeam;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(32, 16);
    ctx.stroke();

    // Recessed center-beam bolt heads in railColor (no internal rail bars when hasChasmN/S is false)
    ctx.fillStyle = railColor;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(3, 15.2, 1.6, 1.6);
    ctx.fillRect(27.4, 15.2, 1.6, 1.6);
    ctx.globalAlpha = 0.92;

    if (hasChasmN) {
      ctx.fillStyle = railColor;
      ctx.fillRect(0, 0, 32, 4.2);
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 1.3;
      ctx.strokeRect(0.5, 0.5, 31, 3.4);
    }
    if (hasChasmS) {
      ctx.fillStyle = railColor;
      ctx.fillRect(0, 27.8, 32, 4.2);
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 1.3;
      ctx.strokeRect(0.5, 28.1, 31, 3.4);
    }
  }
  ctx.restore();
}
