import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import {
  analyzePngBufferRegions,
  comparePngBuffers,
  computeSceneEnvironmentSummary,
  convertPngBufferToGrayscale,
  srgbToCieL,
  srgbToHslSaturation,
  stitchPngBuffersHorizontal,
} from '../../../tools/visual-metrics.js';

function makeTestPng(
  width: number,
  height: number,
  pixelFn: (x: number, y: number) => [number, number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const [r, g, b, a] = pixelFn(x, y);
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

describe('visual-metrics color math & PNG analyzers', () => {
  it('computes accurate CIE L* and HSL saturation S for known reference sRGB colors', () => {
    expect(srgbToCieL(0, 0, 0)).toBeCloseTo(0, 3);
    expect(srgbToCieL(255, 255, 255)).toBeCloseTo(100, 2);
    // INK_DARK #141019 = (20, 16, 25) -> L* ~ 5.25
    const inkL = srgbToCieL(0x14, 0x10, 0x19);
    expect(inkL).toBeGreaterThan(4.5);
    expect(inkL).toBeLessThan(6.0);

    expect(srgbToHslSaturation(0, 0, 0)).toBe(0);
    expect(srgbToHslSaturation(255, 255, 255)).toBe(0);
    expect(srgbToHslSaturation(128, 128, 128)).toBe(0);
    expect(srgbToHslSaturation(255, 0, 0)).toBeCloseTo(1, 5);
  });

  it('analyzes rectangular regions, clamps out-of-bounds rects, and throws on empty regions', () => {
    // Top half #3D4F47 (61, 79, 71), bottom half #303E38 (48, 62, 56)
    const buf = makeTestPng(20, 20, (_x, y) =>
      y < 10 ? [0x3d, 0x4f, 0x47, 255] : [0x30, 0x3e, 0x38, 255],
    );
    const res = analyzePngBufferRegions(buf, [
      { name: 'top', x: 0, y: 0, width: 20, height: 10 },
      { name: 'all', x: -5, y: 0, width: 30, height: 25 },
    ]);
    expect(res.top!.deltaL).toBeCloseTo(0, 3);
    expect(res.top!.meanL).toBeGreaterThan(30);
    expect(res.top!.meanS).toBeLessThan(0.2);
    expect(res.all!.deltaL).toBeGreaterThan(5);
    expect(res.all!.sampleCount).toBe(400);

    expect(() =>
      analyzePngBufferRegions(buf, [{ name: 'outside', x: 50, y: 50, width: 10, height: 10 }]),
    ).toThrow(/empty/i);
  });

  it('compares PNG buffers with optional maskRects and stitches strips / converts grayscale', () => {
    const bufA = makeTestPng(16, 16, () => [40, 60, 80, 255]);
    const bufB = makeTestPng(16, 16, (x, y) =>
      x < 4 && y < 4 ? [250, 20, 20, 255] : [40, 60, 80, 255],
    );

    const unmasked = comparePngBuffers(bufA, bufB);
    expect(unmasked.diffPixels).toBe(16);
    expect(unmasked.diffRatio).toBeCloseTo(16 / 256, 5);

    const masked = comparePngBuffers(bufA, bufB, [
      { name: 'hudMask', x: 0, y: 0, width: 4, height: 4 },
    ]);
    expect(masked.diffPixels).toBe(0);
    expect(masked.diffRatio).toBe(0);

    const grayBuf = convertPngBufferToGrayscale(bufB);
    const grayPng = PNG.sync.read(grayBuf);
    expect(grayPng.data[0]).toBe(grayPng.data[1]);
    expect(grayPng.data[1]).toBe(grayPng.data[2]);

    const stripBuf = stitchPngBuffersHorizontal([bufA, bufB]);
    const stripPng = PNG.sync.read(stripBuf);
    expect(stripPng.width).toBe(32);
    expect(stripPng.height).toBe(16);
  });

  it('computes environment summary metrics from unlit and lit region tables', () => {
    const unlit = {
      floor_all: { meanL: 32, p5L: 27, p95L: 36, deltaL: 9, minL: 26, maxL: 37, meanS: 0.14, contrastWithInkDark: 26.7, sampleCount: 100 },
      center_arena: { meanL: 32, p5L: 29, p95L: 34, deltaL: 5, minL: 28, maxL: 35, meanS: 0.13, contrastWithInkDark: 26.7, sampleCount: 100 },
      corner_tl: { meanL: 32, p5L: 30, p95L: 34, deltaL: 4, minL: 30, maxL: 34, meanS: 0.14, contrastWithInkDark: 26.7, sampleCount: 50 },
    };
    const lit = {
      floor_all: { meanL: 28, p5L: 24, p95L: 32, deltaL: 8, minL: 22, maxL: 33, meanS: 0.14, contrastWithInkDark: 22.7, sampleCount: 100 },
      center_arena: { meanL: 28, p5L: 25, p95L: 30, deltaL: 5, minL: 24, maxL: 31, meanS: 0.13, contrastWithInkDark: 22.7, sampleCount: 100 },
      corner_tl: { meanL: 27.5, p5L: 26, p95L: 29, deltaL: 3, minL: 25, maxL: 29, meanS: 0.14, contrastWithInkDark: 22.2, sampleCount: 50 },
      brazier_pool: { meanL: 39, p5L: 35, p95L: 43, deltaL: 8, minL: 34, maxL: 44, meanS: 0.25, contrastWithInkDark: 33.7, sampleCount: 50 },
    };
    const summary = computeSceneEnvironmentSummary(unlit, lit);
    expect(summary.floorMeanL).toBe(32);
    expect(summary.floorDeltaL).toBe(9);
    expect(summary.centerDeltaL).toBe(5);
    expect(summary.cornerRetentionRatio).toBeCloseTo(27.5 / 32, 3);
    expect(summary.brazierLightPoolDeltaL).toBeCloseTo(39 - 28, 3);
  });

  it('computes centerDeltaL from floor_center and whole-floor floorDeltaL across floor_center + corner_* when floor_all is absent', () => {
    const unlit = {
      floor_center: { meanL: 32, p5L: 30, p95L: 35, deltaL: 5, minL: 29.5, maxL: 35.5, meanS: 0.14, contrastWithInkDark: 26.7, sampleCount: 100 },
      corner_tl: { meanL: 30, p5L: 26, p95L: 34, deltaL: 8, minL: 25, maxL: 35, meanS: 0.15, contrastWithInkDark: 24.7, sampleCount: 50 },
      corner_br: { meanL: 33, p5L: 28, p95L: 37, deltaL: 9, minL: 27, maxL: 38, meanS: 0.14, contrastWithInkDark: 27.7, sampleCount: 50 },
    };
    const lit = {
      floor_center: { meanL: 29, p5L: 27, p95L: 32, deltaL: 5, minL: 26, maxL: 33, meanS: 0.14, contrastWithInkDark: 23.7, sampleCount: 100 },
      corner_tl: { meanL: 26, p5L: 23, p95L: 29, deltaL: 6, minL: 22, maxL: 30, meanS: 0.15, contrastWithInkDark: 20.7, sampleCount: 50 },
      corner_br: { meanL: 28, p5L: 25, p95L: 31, deltaL: 6, minL: 24, maxL: 32, meanS: 0.14, contrastWithInkDark: 22.7, sampleCount: 50 },
      brazier_pool: { meanL: 38, p5L: 34, p95L: 42, deltaL: 8, minL: 33, maxL: 43, meanS: 0.24, contrastWithInkDark: 32.7, sampleCount: 50 },
    };
    const summary = computeSceneEnvironmentSummary(unlit, lit);
    expect(summary.floorMeanL).toBe(32);
    expect(summary.centerDeltaL).toBe(5);
    expect(summary.floorDeltaL).toBe(37 - 26); // max(p95L) - min(p5L) = 11
    expect(summary.brazierToFloorDeltaL).toBeCloseTo(38 - 29, 3);
  });
});
