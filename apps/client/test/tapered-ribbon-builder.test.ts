import { describe, expect, it } from 'vitest';
import {
  fillTaperedArcRibbon,
  fillTaperedLightningBolt,
  fillTaperedQuadraticBezier,
  MAX_RIBBON_PTS,
  SCRATCH_HW,
  SCRATCH_PX,
  SCRATCH_PY,
  strokeCutoutQuadStripFromScratch,
} from '../src/fx/tapered-ribbon-builder.js';

interface TriangleCall {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface StyleCall {
  color: number;
  alpha: number;
}

function createRecordingGraphicsMock() {
  const fillTriangleCalls: TriangleCall[] = [];
  const fillStyleCalls: StyleCall[] = [];
  const fillPointsCalls: unknown[] = [];
  const strokeCircleCalls: unknown[] = [];
  const lineBetweenCalls: unknown[] = [];
  const strokePointsCalls: unknown[] = [];

  const mock = {
    fillTriangleCalls,
    fillStyleCalls,
    fillPointsCalls,
    strokeCircleCalls,
    lineBetweenCalls,
    strokePointsCalls,
    fillStyle(color: number, alpha = 1) {
      fillStyleCalls.push({ color, alpha });
      return mock;
    },
    fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) {
      fillTriangleCalls.push({ x0, y0, x1, y1, x2, y2 });
      return mock;
    },
    fillPoints(...args: unknown[]) {
      fillPointsCalls.push(args);
      return mock;
    },
    strokePoints(...args: unknown[]) {
      strokePointsCalls.push(args);
      return mock;
    },
    strokeCircle(...args: unknown[]) {
      strokeCircleCalls.push(args);
      return mock;
    },
    lineBetween(...args: unknown[]) {
      lineBetweenCalls.push(args);
      return mock;
    },
  };
  return mock;
}

describe('tapered-ribbon-builder', () => {
  it('exports fixed scratch buffers with MAX_RIBBON_PTS = 20', () => {
    expect(MAX_RIBBON_PTS).toBe(20);
    expect(SCRATCH_PX).toBeInstanceOf(Float32Array);
    expect(SCRATCH_PY).toBeInstanceOf(Float32Array);
    expect(SCRATCH_HW).toBeInstanceOf(Float32Array);
    expect(SCRATCH_PX.length).toBe(20);
    expect(SCRATCH_PY.length).toBe(20);
    expect(SCRATCH_HW.length).toBe(20);
  });

  it('early returns when ptCount < 2 or alpha <= 0.005', () => {
    const gfx = createRecordingGraphicsMock();
    strokeCutoutQuadStripFromScratch(gfx as never, 1, 0x38bdf8, 0.9, 1.8);
    expect(gfx.fillTriangleCalls.length).toBe(0);
    expect(gfx.fillStyleCalls.length).toBe(0);

    strokeCutoutQuadStripFromScratch(gfx as never, 5, 0x38bdf8, 0.004, 1.8);
    expect(gfx.fillTriangleCalls.length).toBe(0);
    expect(gfx.fillStyleCalls.length).toBe(0);
  });

  it('renders a 2-point tapered needle via the diamond branch (4 fillTriangle calls, zero fillPoints/strokeCircle)', () => {
    const gfx = createRecordingGraphicsMock();
    SCRATCH_PX[0] = 100;
    SCRATCH_PY[0] = 100;
    SCRATCH_HW[0] = 0;
    SCRATCH_PX[1] = 140;
    SCRATCH_PY[1] = 100;
    SCRATCH_HW[1] = 0;
    strokeCutoutQuadStripFromScratch(gfx as never, 2, 0x38bdf8, 0.9, 1.8);

    expect(gfx.fillTriangleCalls.length).toBe(4);
    expect(gfx.fillStyleCalls[0]?.color).toBe(0x141019);
    expect(gfx.fillStyleCalls[1]?.color).toBe(0x38bdf8);
    // Tip0 extends backward along -X by 1.8 * 1.35 = 2.43px -> x = 97.57; Tip1 extends forward to 142.43
    const xs = gfx.fillTriangleCalls.flatMap((c) => [c.x0, c.x1, c.x2]);
    expect(Math.min(...xs)).toBeCloseTo(100 - 1.8 * 1.35, 2);
    expect(Math.max(...xs)).toBeCloseTo(140 + 1.8 * 1.35, 2);
    expect(gfx.fillPointsCalls.length).toBe(0);
    expect(gfx.strokeCircleCalls.length).toBe(0);
    expect(gfx.lineBetweenCalls.length).toBe(0);
  });

  it('skips ink pass when inkPadPx <= 0 on 2-point diamond needle', () => {
    const gfx = createRecordingGraphicsMock();
    SCRATCH_PX[0] = 50;
    SCRATCH_PY[0] = 50;
    SCRATCH_HW[0] = 2;
    SCRATCH_PX[1] = 90;
    SCRATCH_PY[1] = 50;
    SCRATCH_HW[1] = 2;
    strokeCutoutQuadStripFromScratch(gfx as never, 2, 0x38bdf8, 0.9, 0);

    expect(gfx.fillTriangleCalls.length).toBe(2);
    expect(gfx.fillStyleCalls.length).toBe(1);
    expect(gfx.fillStyleCalls[0]?.color).toBe(0x38bdf8);
  });

  it('adds pointed tangent needle caps on N>=3 arcs and clamps lightning kinks < 28 deg deterministically', () => {
    const gfx = createRecordingGraphicsMock();
    fillTaperedArcRibbon(gfx as never, 200, 200, 56, 0, Math.PI * 0.5, 4.0, 0x22c55e, 0.9, 8, 1.8);
    // 8 segments * 2 tris = 16 body tris + 2 needle caps = 18 ink tris + 16 core tris = 34
    expect(gfx.fillTriangleCalls.length).toBe(34);

    const gfxBoltA = createRecordingGraphicsMock();
    const gfxBoltB = createRecordingGraphicsMock();
    fillTaperedLightningBolt(gfxBoltA as never, 0, 0, 120, 0, 2.8, 0x38bdf8, 1.0, 42, 6, 1.8);
    fillTaperedLightningBolt(gfxBoltB as never, 0, 0, 120, 0, 2.8, 0x38bdf8, 1.0, 42, 6, 1.8);
    expect(gfxBoltA.fillTriangleCalls).toEqual(gfxBoltB.fillTriangleCalls);
  });

  it('renders fillTaperedArcRibbon with 1:1 radius accuracy and sinusoidal tapering', () => {
    const gfx = createRecordingGraphicsMock();
    const cx = 150;
    const cy = 120;
    const radius = 48;
    fillTaperedArcRibbon(gfx as never, cx, cy, radius, 0, Math.PI, 3.5, 0x38bdf8, 0.8, 8, 1.8);

    // Verify 9 points in scratch buffer match exact arc radius
    for (let i = 0; i <= 8; i++) {
      const dist = Math.hypot(SCRATCH_PX[i]! - cx, SCRATCH_PY[i]! - cy);
      expect(dist).toBeCloseTo(radius, 3);
    }
    // Half-width at ends must taper to 0
    expect(SCRATCH_HW[0]).toBeCloseTo(0, 4);
    expect(SCRATCH_HW[8]).toBeCloseTo(0, 4);
    // Half-width at midpoint (i = 4) must reach peak
    expect(SCRATCH_HW[4]).toBeCloseTo(3.5, 3);
  });

  it('renders fillTaperedQuadraticBezier with correct quadratic curve interpolation', () => {
    const gfx = createRecordingGraphicsMock();
    fillTaperedQuadraticBezier(
      gfx as never,
      0,
      0,
      50,
      100,
      100,
      0,
      1.0,
      4.0,
      0.0,
      0xf97316,
      0.9,
      8,
      1.8,
    );

    // 8 segments * 2 = 16 ink + 1 end cap (since HW[8] <= 0.05, HW[0] = 1.0 > 0.05) = 17 ink + 16 core = 33
    expect(gfx.fillTriangleCalls.length).toBe(33);
    // Verify start, mid, end points
    expect(SCRATCH_PX[0]).toBeCloseTo(0, 3);
    expect(SCRATCH_PY[0]).toBeCloseTo(0, 3);
    expect(SCRATCH_HW[0]).toBeCloseTo(1.0, 3);

    // At t = 0.5: px = 0.25 * 0 + 0.5 * 50 + 0.25 * 100 = 50
    // py = 0.25 * 0 + 0.5 * 100 + 0.25 * 0 = 50
    expect(SCRATCH_PX[4]).toBeCloseTo(50, 3);
    expect(SCRATCH_PY[4]).toBeCloseTo(50, 3);

    expect(SCRATCH_PX[8]).toBeCloseTo(100, 3);
    expect(SCRATCH_PY[8]).toBeCloseTo(0, 3);
    expect(SCRATCH_HW[8]).toBeCloseTo(0.0, 3);
  });

  it('guarantees geometric kink angle < 28 deg and non-collinear across multiple seeds and segment counts', () => {
    const testSeeds = [1, 7, 42, 101, 777, 9999, 123456];
    const segmentCounts = [4, 6, 8, 10];
    const MAX_ALLOWED_KINK_RAD = (28 * Math.PI) / 180;

    for (const seed of testSeeds) {
      for (const segs of segmentCounts) {
        const gfx = createRecordingGraphicsMock();
        fillTaperedLightningBolt(gfx as never, 10, 20, 210, 140, 3.0, 0x38bdf8, 1.0, seed, segs, 1.8);

        const ptCount = segs + 1;
        let hasNonZeroKink = false;

        // Check every interior vertex i = 1..ptCount - 2
        for (let i = 1; i < ptCount - 1; i++) {
          const v0x = SCRATCH_PX[i]! - SCRATCH_PX[i - 1]!;
          const v0y = SCRATCH_PY[i]! - SCRATCH_PY[i - 1]!;
          const v1x = SCRATCH_PX[i + 1]! - SCRATCH_PX[i]!;
          const v1y = SCRATCH_PY[i + 1]! - SCRATCH_PY[i]!;

          const len0 = Math.hypot(v0x, v0y);
          const len1 = Math.hypot(v1x, v1y);
          expect(len0).toBeGreaterThan(0.01);
          expect(len1).toBeGreaterThan(0.01);

          const dot = (v0x * v1x + v0y * v1y) / (len0 * len1);
          const clampedDot = Math.max(-1, Math.min(1, dot));
          const turnAngleRad = Math.acos(clampedDot);

          // Strictly < 28°
          expect(turnAngleRad).toBeLessThan(MAX_ALLOWED_KINK_RAD);

          // Non-collinear (actually zig-zags)
          if (turnAngleRad > 0.02) {
            hasNonZeroKink = true;
          }
        }

        expect(hasNonZeroKink).toBe(true);
      }
    }
  });

  it('clamps ptCount and segments to MAX_RIBBON_PTS safely', () => {
    const gfx = createRecordingGraphicsMock();
    // Pass 50 segments
    fillTaperedArcRibbon(gfx as never, 100, 100, 40, 0, Math.PI, 2.0, 0x38bdf8, 1.0, 50, 1.8);
    // segments clamped to 19 -> 19 segments * 2 = 38 + 2 needle caps = 40 ink + 38 core = 78
    expect(gfx.fillTriangleCalls.length).toBe(78);
  });
});
