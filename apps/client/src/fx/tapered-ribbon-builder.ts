import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../art/palette.js';

export const MAX_RIBBON_PTS = 20 as const;

export const SCRATCH_PX = new Float32Array(MAX_RIBBON_PTS);
export const SCRATCH_PY = new Float32Array(MAX_RIBBON_PTS);
export const SCRATCH_HW = new Float32Array(MAX_RIBBON_PTS);

const SCRATCH_NX = new Float32Array(MAX_RIBBON_PTS);
const SCRATCH_NY = new Float32Array(MAX_RIBBON_PTS);

const DEFAULT_INK_COLOR_NUM = hexToNum(PALETTE.INK_DARK);
const DEFAULT_INK_PAD_PX = 1.8;
const TIP_NEEDLE_EXT_RATIO = 1.35;
const KINK_CLAMP_ANGLE_RAD = (6.75 * Math.PI) / 180;
const TAN_KINK_CLAMP = Math.tan(KINK_CLAMP_ANGLE_RAD);

function hashSeedIndex(seed: number, index: number): number {
  let h = ((seed | 0) ^ Math.imul(index | 0, 0x9e3779b9)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Renders a tapered 2D quad strip using module-static scratch buffers.
 * Never performs heap allocations.
 * Pass 0: Outline ink (#141019) with pointed needle tip extensions (if inkPadPx > 0).
 * Pass 1: Core fill triangles.
 */
export function strokeCutoutQuadStripFromScratch(
  gfx: Phaser.GameObjects.Graphics,
  ptCount: number,
  fillColorNum: number,
  alpha: number,
  inkPadPx: number = DEFAULT_INK_PAD_PX,
  inkColorNum: number = DEFAULT_INK_COLOR_NUM,
): void {
  const n = Math.min(Math.floor(ptCount), MAX_RIBBON_PTS);
  if (!Number.isFinite(ptCount) || !(n >= 2) || alpha <= 0.005) {
    return;
  }

  // --- n === 2: Diamond needle branch ---
  if (n === 2) {
    const p0x = SCRATCH_PX[0]!;
    const p0y = SCRATCH_PY[0]!;
    const p1x = SCRATCH_PX[1]!;
    const p1y = SCRATCH_PY[1]!;

    const dx = p1x - p0x;
    const dy = p1y - p0y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) {
      return;
    }

    const tx = dx / len;
    const ty = dy / len;
    const nx = -ty;
    const ny = tx;

    const mx = 0.5 * (p0x + p1x);
    const my = 0.5 * (p0y + p1y);
    const midHw = Math.max(1.2, 0.5 * (SCRATCH_HW[0]! + SCRATCH_HW[1]!));

    // Pass 0: Ink diamond
    if (inkPadPx > 0) {
      gfx.fillStyle(inkColorNum, alpha);
      const tipExt = inkPadPx * TIP_NEEDLE_EXT_RATIO;
      const tip0x = p0x - tx * tipExt;
      const tip0y = p0y - ty * tipExt;
      const tip1x = p1x + tx * tipExt;
      const tip1y = p1y + ty * tipExt;

      const outMidHw = midHw + inkPadPx;
      const midPlusX = mx + nx * outMidHw;
      const midPlusY = my + ny * outMidHw;
      const midMinusX = mx - nx * outMidHw;
      const midMinusY = my - ny * outMidHw;

      gfx.fillTriangle(tip0x, tip0y, midPlusX, midPlusY, midMinusX, midMinusY);
      gfx.fillTriangle(tip1x, tip1y, midMinusX, midMinusY, midPlusX, midPlusY);
    }

    // Pass 1: Core diamond
    gfx.fillStyle(fillColorNum, alpha);
    const corePlusX = mx + nx * midHw;
    const corePlusY = my + ny * midHw;
    const coreMinusX = mx - nx * midHw;
    const coreMinusY = my - ny * midHw;

    gfx.fillTriangle(p0x, p0y, corePlusX, corePlusY, coreMinusX, coreMinusY);
    gfx.fillTriangle(p1x, p1y, coreMinusX, coreMinusY, corePlusX, corePlusY);
    return;
  }

  // --- n >= 3: Pointed scalar quad-strip ---
  // 1. Find unit tangent at start (tx0, ty0)
  let tx0 = 1;
  let ty0 = 0;
  for (let j = 0; j < n - 1; j++) {
    const dx = SCRATCH_PX[j + 1]! - SCRATCH_PX[j]!;
    const dy = SCRATCH_PY[j + 1]! - SCRATCH_PY[j]!;
    const len = Math.hypot(dx, dy);
    if (len >= 1e-4) {
      tx0 = dx / len;
      ty0 = dy / len;
      break;
    }
  }

  // 2. Find unit tangent at end (txLast, tyLast)
  let txLast = tx0;
  let tyLast = ty0;
  for (let j = n - 2; j >= 0; j--) {
    const dx = SCRATCH_PX[j + 1]! - SCRATCH_PX[j]!;
    const dy = SCRATCH_PY[j + 1]! - SCRATCH_PY[j]!;
    const len = Math.hypot(dx, dy);
    if (len >= 1e-4) {
      txLast = dx / len;
      tyLast = dy / len;
      break;
    }
  }

  // 3. Compute smoothed normalized vertex normals
  SCRATCH_NX[0] = -ty0;
  SCRATCH_NY[0] = tx0;
  SCRATCH_NX[n - 1] = -tyLast;
  SCRATCH_NY[n - 1] = txLast;

  for (let i = 1; i < n - 1; i++) {
    const dx0 = SCRATCH_PX[i]! - SCRATCH_PX[i - 1]!;
    const dy0 = SCRATCH_PY[i]! - SCRATCH_PY[i - 1]!;
    const len0 = Math.hypot(dx0, dy0);

    const dx1 = SCRATCH_PX[i + 1]! - SCRATCH_PX[i]!;
    const dy1 = SCRATCH_PY[i + 1]! - SCRATCH_PY[i]!;
    const len1 = Math.hypot(dx1, dy1);

    if (len0 >= 1e-4 && len1 >= 1e-4) {
      const t0x = dx0 / len0;
      const t0y = dy0 / len0;
      const t1x = dx1 / len1;
      const t1y = dy1 / len1;
      const smx = t0x + t1x;
      const smy = t0y + t1y;
      const smLen = Math.hypot(smx, smy);
      if (smLen >= 1e-4) {
        SCRATCH_NX[i] = -smy / smLen;
        SCRATCH_NY[i] = smx / smLen;
      } else {
        SCRATCH_NX[i] = -t0y;
        SCRATCH_NY[i] = t0x;
      }
    } else if (len0 >= 1e-4) {
      SCRATCH_NX[i] = -dy0 / len0;
      SCRATCH_NY[i] = dx0 / len0;
    } else if (len1 >= 1e-4) {
      SCRATCH_NX[i] = -dy1 / len1;
      SCRATCH_NY[i] = dx1 / len1;
    } else {
      SCRATCH_NX[i] = SCRATCH_NX[0]!;
      SCRATCH_NY[i] = SCRATCH_NY[0]!;
    }
  }

  // Pass 0: Outset ink quads + needle caps
  if (inkPadPx > 0) {
    gfx.fillStyle(inkColorNum, alpha);

    // Body quad triangles: (n - 1) * 2
    for (let i = 0; i < n - 1; i++) {
      const pad0 = SCRATCH_HW[i]! + inkPadPx;
      const pad1 = SCRATCH_HW[i + 1]! + inkPadPx;
      const l0x = SCRATCH_PX[i]! + SCRATCH_NX[i]! * pad0;
      const l0y = SCRATCH_PY[i]! + SCRATCH_NY[i]! * pad0;
      const r0x = SCRATCH_PX[i]! - SCRATCH_NX[i]! * pad0;
      const r0y = SCRATCH_PY[i]! - SCRATCH_NY[i]! * pad0;
      const l1x = SCRATCH_PX[i + 1]! + SCRATCH_NX[i + 1]! * pad1;
      const l1y = SCRATCH_PY[i + 1]! + SCRATCH_NY[i + 1]! * pad1;
      const r1x = SCRATCH_PX[i + 1]! - SCRATCH_NX[i + 1]! * pad1;
      const r1y = SCRATCH_PY[i + 1]! - SCRATCH_NY[i + 1]! * pad1;

      gfx.fillTriangle(l0x, l0y, r0x, r0y, l1x, l1y);
      gfx.fillTriangle(l1x, l1y, r0x, r0y, r1x, r1y);
    }

    // Start needle cap
    if (SCRATCH_HW[0]! <= 0.05) {
      const pad0 = SCRATCH_HW[0]! + inkPadPx;
      const tip0x = SCRATCH_PX[0]! - tx0 * inkPadPx * TIP_NEEDLE_EXT_RATIO;
      const tip0y = SCRATCH_PY[0]! - ty0 * inkPadPx * TIP_NEEDLE_EXT_RATIO;
      const p0PlusX = SCRATCH_PX[0]! + SCRATCH_NX[0]! * pad0;
      const p0PlusY = SCRATCH_PY[0]! + SCRATCH_NY[0]! * pad0;
      const p0MinusX = SCRATCH_PX[0]! - SCRATCH_NX[0]! * pad0;
      const p0MinusY = SCRATCH_PY[0]! - SCRATCH_NY[0]! * pad0;
      gfx.fillTriangle(tip0x, tip0y, p0PlusX, p0PlusY, p0MinusX, p0MinusY);
    }

    // End needle cap
    const last = n - 1;
    if (SCRATCH_HW[last]! <= 0.05) {
      const padLast = SCRATCH_HW[last]! + inkPadPx;
      const tipLastX = SCRATCH_PX[last]! + txLast * inkPadPx * TIP_NEEDLE_EXT_RATIO;
      const tipLastY = SCRATCH_PY[last]! + tyLast * inkPadPx * TIP_NEEDLE_EXT_RATIO;
      const pLastMinusX = SCRATCH_PX[last]! - SCRATCH_NX[last]! * padLast;
      const pLastMinusY = SCRATCH_PY[last]! - SCRATCH_NY[last]! * padLast;
      const pLastPlusX = SCRATCH_PX[last]! + SCRATCH_NX[last]! * padLast;
      const pLastPlusY = SCRATCH_PY[last]! + SCRATCH_NY[last]! * padLast;
      gfx.fillTriangle(tipLastX, tipLastY, pLastMinusX, pLastMinusY, pLastPlusX, pLastPlusY);
    }
  }

  // Pass 1: Core quad triangles: (n - 1) * 2
  gfx.fillStyle(fillColorNum, alpha);
  for (let i = 0; i < n - 1; i++) {
    const hw0 = SCRATCH_HW[i]!;
    const hw1 = SCRATCH_HW[i + 1]!;
    const l0x = SCRATCH_PX[i]! + SCRATCH_NX[i]! * hw0;
    const l0y = SCRATCH_PY[i]! + SCRATCH_NY[i]! * hw0;
    const r0x = SCRATCH_PX[i]! - SCRATCH_NX[i]! * hw0;
    const r0y = SCRATCH_PY[i]! - SCRATCH_NY[i]! * hw0;
    const l1x = SCRATCH_PX[i + 1]! + SCRATCH_NX[i + 1]! * hw1;
    const l1y = SCRATCH_PY[i + 1]! + SCRATCH_NY[i + 1]! * hw1;
    const r1x = SCRATCH_PX[i + 1]! - SCRATCH_NX[i + 1]! * hw1;
    const r1y = SCRATCH_PY[i + 1]! - SCRATCH_NY[i + 1]! * hw1;

    gfx.fillTriangle(l0x, l0y, r0x, r0y, l1x, l1y);
    gfx.fillTriangle(l1x, l1y, r0x, r0y, r1x, r1y);
  }
}

/**
 * Evaluates and draws a tapered quadratic Bezier ribbon with zero heap allocations.
 * Half-width is quadratically interpolated between start, mid, and end.
 */
export function fillTaperedQuadraticBezier(
  gfx: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  startHalfWidthPx: number,
  midHalfWidthPx: number,
  endHalfWidthPx: number,
  fillColorNum: number,
  alpha: number,
  segments: number = 8,
  inkPadPx: number = DEFAULT_INK_PAD_PX,
): void {
  if (alpha <= 0.005) {
    return;
  }
  const safeSegs = Math.max(2, Math.min(Math.floor(segments), MAX_RIBBON_PTS - 1));
  const ptCount = safeSegs + 1;

  for (let i = 0; i < ptCount; i++) {
    const t = i / safeSegs;
    const u = 1 - t;
    const u2 = u * u;
    const twoUt = 2 * u * t;
    const t2 = t * t;

    SCRATCH_PX[i] = u2 * x0 + twoUt * cx + t2 * x2;
    SCRATCH_PY[i] = u2 * y0 + twoUt * cy + t2 * y2;
    SCRATCH_HW[i] = u2 * startHalfWidthPx + twoUt * midHalfWidthPx + t2 * endHalfWidthPx;
  }

  strokeCutoutQuadStripFromScratch(gfx, ptCount, fillColorNum, alpha, inkPadPx);
}

/**
 * Evaluates and draws a circular arc ribbon with sinusoidal tapering (0 at ends, peak at center).
 * Accurate 1:1 radius with zero heap allocations.
 */
export function fillTaperedArcRibbon(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radiusPx: number,
  startAngleRad: number,
  endAngleRad: number,
  peakHalfWidthPx: number,
  fillColorNum: number,
  alpha: number,
  segments: number = 8,
  inkPadPx: number = DEFAULT_INK_PAD_PX,
): void {
  if (alpha <= 0.005) {
    return;
  }
  const safeSegs = Math.max(2, Math.min(Math.floor(segments), MAX_RIBBON_PTS - 1));
  const ptCount = safeSegs + 1;

  for (let i = 0; i < ptCount; i++) {
    const u = i / safeSegs;
    const theta = startAngleRad + u * (endAngleRad - startAngleRad);
    SCRATCH_PX[i] = cx + Math.cos(theta) * radiusPx;
    SCRATCH_PY[i] = cy + Math.sin(theta) * radiusPx;
    SCRATCH_HW[i] = Math.sin(Math.PI * u) * peakHalfWidthPx;
  }

  strokeCutoutQuadStripFromScratch(gfx, ptCount, fillColorNum, alpha, inkPadPx);
}

/**
 * Evaluates and draws a deterministic lightning bolt ribbon with true < 28° interior kink angle clamping.
 * Zero Math.random() calls and zero heap allocations.
 */
export function fillTaperedLightningBolt(
  gfx: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  peakHalfWidthPx: number,
  fillColorNum: number,
  alpha: number,
  seed: number,
  segments: number = 6,
  inkPadPx: number = DEFAULT_INK_PAD_PX,
): void {
  if (alpha <= 0.005) {
    return;
  }
  const dx = x1 - x0;
  const dy = y1 - y0;
  const totalLen = Math.hypot(dx, dy);
  if (totalLen < 1e-4) {
    return;
  }

  const safeSegs = Math.max(2, Math.min(Math.floor(segments), MAX_RIBBON_PTS - 1));
  const ptCount = safeSegs + 1;

  const bx = dx / totalLen;
  const by = dy / totalLen;
  const nx = -by;
  const ny = bx;

  const segLen = totalLen / safeSegs;
  // Perpendicular offset is clamped to <= segLen * tan(6.75°) so turn angle is strictly < 28°
  const maxD = segLen * TAN_KINK_CLAMP;

  SCRATCH_PX[0] = x0;
  SCRATCH_PY[0] = y0;
  SCRATCH_HW[0] = 0;

  for (let i = 1; i < safeSegs; i++) {
    const u = i / safeSegs;
    const baseX = x0 + bx * (u * totalLen);
    const baseY = y0 + by * (u * totalLen);

    const h = hashSeedIndex(seed, i);
    const frac = (h >>> 0) / 4294967296;

    let sign = i % 2 === 1 ? 1 : -1;
    if ((seed & 1) !== 0) {
      sign = -sign;
    }

    // Factor in [0.45, 0.95] guarantees non-collinear zig-zag and strict |d| <= maxD
    const factor = 0.45 + 0.5 * frac;
    const d = sign * factor * maxD;

    SCRATCH_PX[i] = baseX + nx * d;
    SCRATCH_PY[i] = baseY + ny * d;
    SCRATCH_HW[i] = Math.sin(Math.PI * u) * peakHalfWidthPx;
  }

  SCRATCH_PX[safeSegs] = x1;
  SCRATCH_PY[safeSegs] = y1;
  SCRATCH_HW[safeSegs] = 0;

  strokeCutoutQuadStripFromScratch(gfx, ptCount, fillColorNum, alpha, inkPadPx);
}
