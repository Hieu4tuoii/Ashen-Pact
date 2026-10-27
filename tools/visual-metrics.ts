import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
export {
  type ActionRoiConfig,
  type AnimationGatesEvaluationResult,
  type AnimationGatesInput,
  type AnimationGateThresholds,
  type ApexEventSpec,
  computeActorContainmentRatio,
  computeCroppedRoiPixelDiff,
  computeRectIntersectionArea,
  cropPngSubRect,
  DEFAULT_ANIMATION_GATE_THRESHOLDS,
  type EmittedSimEventRecord,
  evaluateAnimationGates,
  type ExternalStateMutationRecord,
  type FloatingAlertBoundsRecord,
  formatTelemetrySummaryMarkdown,
  isPhysicsDisplacementScene,
  type KeyframeTraceRecord,
  resolveActionRoiRects,
  type RoiResolutionMode,
  type ScreenRect,
  type StripStageKind,
  type TrackedActorBoundsRecord,
} from './visual-animation-gates.js';
export {
  drawBitmapString,
  renderOverviewGridStrip,
  renderRoiSheets1to1,
} from './visual-strip-renderer.js';

export interface SampleRect {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RegionMetrics {
  meanL: number;
  p5L: number;
  p95L: number;
  deltaL: number;
  minL: number;
  maxL: number;
  meanS: number;
  contrastWithInkDark: number;
  sampleCount: number;
  clipWhiteRatio?: number;
}

export interface SceneEnvironmentSummary {
  floorMeanL: number;
  floorDeltaL: number;
  centerDeltaL: number;
  floorMeanS: number;
  contrastWithInkDark: number;
  minLitFloorL: number;
  minCornerL: number;
  cornerRetentionRatio: number;
  cornerToUnlitRatio: number;
  brazierLightPoolDeltaL: number;
  brazierToFloorDeltaL: number;
  clipWhiteRatio: number;
}

export interface SceneManifestEntry {
  id?: string;
  name?: string;
  image?: string;
  file?: string;
  litImage?: string;
  unlitImage?: string;
  unlitFile?: string;
  sampleRects?: SampleRect[];
}

export interface SceneManifest {
  scenes?: SceneManifestEntry[] | Record<string, SceneManifestEntry>;
  [key: string]: unknown;
}

/**
 * Converts standard sRGB channels (0-255) to CIE L* lightness (0-100).
 * Uses CIE 1931 D65 illuminant relative luminance Y with exact standard sRGB linearization.
 */
export function srgbToCieL(r: number, g: number, b: number): number {
  const toLinear = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);

  // D65 relative luminance Y
  const y = 0.2126729 * rLin + 0.7151522 * gLin + 0.072175 * bLin;

  // CIELAB standard piecewise function
  // epsilon = (6/29)^3 = 216 / 24389
  // kappa = (29/3)^3 = 24389 / 27
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;

  return y > epsilon ? 116 * Math.cbrt(y) - 16 : kappa * y;
}

/**
 * INK_DARK reference color: #141019 = rgb(20, 16, 25)
 */
export const INK_DARK_L = srgbToCieL(0x14, 0x10, 0x19);

/**
 * Converts sRGB channels (0-255) to HSL saturation S (0-1).
 * Returns exact 0 for achromatic grays (r === g && g === b) including pure black and white.
 */
export function srgbToHslSaturation(r: number, g: number, b: number): number {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  if (delta === 0) {
    return 0;
  }

  const lightness = (max + min) / 2;
  return lightness > 0.5 ? delta / (2 - 2 * lightness) : delta / (2 * lightness);
}

/**
 * Computes the p-th percentile (0 <= p <= 1) of a pre-sorted array of numbers using linear interpolation.
 */
function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (sorted.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const weight = rank - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

/**
 * Analyzes rectangular sampling regions of a PNG buffer.
 * Clamps regions to image bounds, throws if clamped region is empty.
 */
export function analyzePngBufferRegions(
  pngBuffer: Buffer,
  regions: SampleRect[],
): Record<string, RegionMetrics> {
  const png = PNG.sync.read(pngBuffer);
  const { width, height, data } = png;
  const result: Record<string, RegionMetrics> = {};

  for (const region of regions) {
    const x1 = Math.max(0, Math.min(width, Math.floor(region.x)));
    const y1 = Math.max(0, Math.min(height, Math.floor(region.y)));
    const x2 = Math.max(0, Math.min(width, Math.floor(region.x + region.width)));
    const y2 = Math.max(0, Math.min(height, Math.floor(region.y + region.height)));

    if (x2 <= x1 || y2 <= y1) {
      throw new Error(
        `Sample region "${region.name}" is empty after clamping to image bounds (${width}x${height}): clamped to [${x1},${y1},${x2},${y2}]`,
      );
    }

    const lValues: number[] = [];
    let sumL = 0;
    let sumS = 0;
    let minL = Infinity;
    let maxL = -Infinity;
    let clipWhiteCount = 0;

    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx]!;
        const g = data[idx + 1]!;
        const b = data[idx + 2]!;

        if (r >= 254 && g >= 254 && b >= 254) {
          clipWhiteCount += 1;
        }

        const l = srgbToCieL(r, g, b);
        const s = srgbToHslSaturation(r, g, b);

        lValues.push(l);
        sumL += l;
        sumS += s;
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
      }
    }

    const sampleCount = lValues.length;
    lValues.sort((a, b) => a - b);

    const meanL = sumL / sampleCount;
    const meanS = sumS / sampleCount;
    const p5L = computePercentile(lValues, 0.05);
    const p95L = computePercentile(lValues, 0.95);
    const deltaL = p95L - p5L;
    const contrastWithInkDark = meanL - INK_DARK_L;
    const clipWhiteRatio = sampleCount > 0 ? clipWhiteCount / sampleCount : 0;

    result[region.name] = {
      meanL,
      p5L,
      p95L,
      deltaL,
      minL,
      maxL,
      meanS,
      contrastWithInkDark,
      sampleCount,
      clipWhiteRatio,
    };
  }

  return result;
}

/**
 * Reads a PNG file from disk and analyzes its regions.
 */
export function analyzePngFileRegions(
  filePath: string,
  regions: SampleRect[],
): Record<string, RegionMetrics> {
  const buf = fs.readFileSync(filePath);
  return analyzePngBufferRegions(buf, regions);
}

/**
 * Compares two PNG buffers pixel-by-pixel with optional masking rectangles.
 * Returns pixel mismatch count, total pixels, diff ratio, and a diff PNG buffer.
 */
export function comparePngBuffers(
  bufA: Buffer,
  bufB: Buffer,
  maskRects?: SampleRect[],
): {
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  diffPngBuffer: Buffer;
} {
  const pngA = PNG.sync.read(bufA);
  const pngB = PNG.sync.read(bufB);

  if (pngA.width !== pngB.width || pngA.height !== pngB.height) {
    throw new Error(
      `Image dimension mismatch: bufA is ${pngA.width}x${pngA.height}, bufB is ${pngB.width}x${pngB.height}`,
    );
  }

  const { width, height } = pngA;
  const totalPixels = width * height;

  const dataA = Buffer.from(pngA.data);
  const dataB = Buffer.from(pngB.data);

  if (maskRects && maskRects.length > 0) {
    for (const rect of maskRects) {
      const x1 = Math.max(0, Math.min(width, Math.floor(rect.x)));
      const y1 = Math.max(0, Math.min(height, Math.floor(rect.y)));
      const x2 = Math.max(0, Math.min(width, Math.floor(rect.x + rect.width)));
      const y2 = Math.max(0, Math.min(height, Math.floor(rect.y + rect.height)));

      for (let y = y1; y < y2; y++) {
        for (let x = x1; x < x2; x++) {
          const idx = (y * width + x) * 4;
          dataB[idx] = dataA[idx]!;
          dataB[idx + 1] = dataA[idx + 1]!;
          dataB[idx + 2] = dataA[idx + 2]!;
          dataB[idx + 3] = dataA[idx + 3]!;
        }
      }
    }
  }

  const diffPng = new PNG({ width, height });
  const diffPixels = pixelmatch(dataA, dataB, diffPng.data, width, height, { threshold: 0.1 });
  const diffRatio = totalPixels > 0 ? diffPixels / totalPixels : 0;
  const diffPngBuffer = PNG.sync.write(diffPng);

  return {
    diffPixels,
    totalPixels,
    diffRatio,
    diffPngBuffer,
  };
}

/**
 * Reads two PNG files from disk and compares them.
 */
export function comparePngFiles(
  filePathA: string,
  filePathB: string,
  maskRects?: SampleRect[],
): {
  diffPixels: number;
  totalPixels: number;
  diffRatio: number;
  diffPngBuffer: Buffer;
} {
  const bufA = fs.readFileSync(filePathA);
  const bufB = fs.readFileSync(filePathB);
  return comparePngBuffers(bufA, bufB, maskRects);
}

/**
 * Converts a PNG buffer to grayscale using standard ITU-R BT.601 luma weights.
 */
export function convertPngBufferToGrayscale(pngBuffer: Buffer): Buffer {
  const png = PNG.sync.read(pngBuffer);
  const { width, height, data } = png;
  const outPng = new PNG({ width, height });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    outPng.data[i] = gray;
    outPng.data[i + 1] = gray;
    outPng.data[i + 2] = gray;
    outPng.data[i + 3] = a;
  }

  return PNG.sync.write(outPng);
}

/**
 * Stitches multiple PNG buffers side-by-side horizontally.
 */
export function stitchPngBuffersHorizontal(buffers: Buffer[]): Buffer {
  if (buffers.length === 0) {
    throw new Error('stitchPngBuffersHorizontal requires at least one buffer');
  }

  const pngs = buffers.map((b) => PNG.sync.read(b));
  let totalWidth = 0;
  let maxHeight = 0;

  for (const p of pngs) {
    totalWidth += p.width;
    if (p.height > maxHeight) {
      maxHeight = p.height;
    }
  }

  const stitched = new PNG({ width: totalWidth, height: maxHeight });
  stitched.data.fill(0);

  let xOffset = 0;
  for (const p of pngs) {
    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) {
        const srcIdx = (y * p.width + x) * 4;
        const dstIdx = (y * totalWidth + (xOffset + x)) * 4;
        stitched.data[dstIdx] = p.data[srcIdx]!;
        stitched.data[dstIdx + 1] = p.data[srcIdx + 1]!;
        stitched.data[dstIdx + 2] = p.data[srcIdx + 2]!;
        stitched.data[dstIdx + 3] = p.data[srcIdx + 3]!;
      }
    }
    xOffset += p.width;
  }

  return PNG.sync.write(stitched);
}

/**
 * Computes high-level scene environment summary metrics from unlit and lit region metric maps.
 */
export function computeSceneEnvironmentSummary(
  unlitRegions: Record<string, RegionMetrics>,
  litRegions: Record<string, RegionMetrics>,
): SceneEnvironmentSummary {
  const unlitFloor =
    unlitRegions['floor_all'] ?? unlitRegions['floor_center'] ?? Object.values(unlitRegions)[0];
  const litFloor =
    litRegions['floor_all'] ?? litRegions['floor_center'] ?? Object.values(litRegions)[0];

  const floorMeanL = unlitFloor?.meanL ?? litFloor?.meanL ?? 0;

  const centerDeltaL =
    unlitRegions['center_arena']?.deltaL ??
    unlitRegions['floor_center']?.deltaL ??
    litRegions['center_arena']?.deltaL ??
    litRegions['floor_center']?.deltaL ??
    (unlitFloor?.deltaL ?? litFloor?.deltaL ?? 0);

  let floorDeltaL = unlitFloor?.deltaL ?? litFloor?.deltaL ?? 0;
  if (unlitRegions['floor_all']) {
    floorDeltaL = unlitRegions['floor_all'].deltaL;
  } else {
    const floorSampleRegions = Object.entries(unlitRegions)
      .filter(
        ([k]) => k === 'floor_center' || k === 'floor_perimeter' || k.startsWith('corner_'),
      )
      .map(([, v]) => v);
    if (floorSampleRegions.length > 0) {
      const maxP95 = Math.max(...floorSampleRegions.map((r) => r.p95L));
      const minP5 = Math.min(...floorSampleRegions.map((r) => r.p5L));
      floorDeltaL = maxP95 - minP5;
    } else if (litRegions['floor_all']) {
      floorDeltaL = litRegions['floor_all'].deltaL;
    }
  }

  const floorMeanS = unlitFloor?.meanS ?? litFloor?.meanS ?? 0;
  const contrastWithInkDark =
    unlitFloor?.contrastWithInkDark ?? litFloor?.contrastWithInkDark ?? 0;

  const minLitFloorL = litFloor?.minL ?? 0;

  // Corner retention ratio: ratio of lit corner lightness to unlit corner (or floor) lightness
  const cornerKeys = [
    ...new Set([
      ...Object.keys(litRegions).filter((k) => k.startsWith('corner_')),
      ...Object.keys(unlitRegions).filter((k) => k.startsWith('corner_')),
    ]),
  ];

  let cornerRetentionRatio = 1;
  let minCornerL = litFloor?.meanL ?? 0;
  if (cornerKeys.length > 0) {
    const litCornerVals = cornerKeys
      .map((k) => litRegions[k]?.meanL)
      .filter((v): v is number => typeof v === 'number');
    const unlitCornerVals = cornerKeys
      .map((k) => unlitRegions[k]?.meanL)
      .filter((v): v is number => typeof v === 'number');

    if (litCornerVals.length > 0) {
      minCornerL = Math.min(...litCornerVals);
    }

    const avgLitCorner =
      litCornerVals.length > 0
        ? litCornerVals.reduce((a, b) => a + b, 0) / litCornerVals.length
        : litFloor?.meanL ?? 0;
    const avgUnlitCorner =
      unlitCornerVals.length > 0
        ? unlitCornerVals.reduce((a, b) => a + b, 0) / unlitCornerVals.length
        : unlitFloor?.meanL ?? avgLitCorner;

    cornerRetentionRatio = avgUnlitCorner > 0 ? avgLitCorner / avgUnlitCorner : 1;
  }

  // Brazier pool delta L: difference between brazier pool meanL and lit floor meanL
  const brazierPool = litRegions['brazier_pool'];
  const brazierLightPoolDeltaL = brazierPool
    ? brazierPool.meanL - (litFloor?.meanL ?? 0)
    : 0;

  let totalLitSamples = 0;
  let totalClipWhite = 0;
  for (const reg of Object.values(litRegions)) {
    totalLitSamples += reg.sampleCount;
    totalClipWhite += (reg.clipWhiteRatio ?? 0) * reg.sampleCount;
  }
  const clipWhiteRatio = totalLitSamples > 0 ? totalClipWhite / totalLitSamples : 0;

  return {
    floorMeanL,
    floorDeltaL,
    centerDeltaL,
    floorMeanS,
    contrastWithInkDark,
    minLitFloorL,
    minCornerL,
    cornerRetentionRatio,
    cornerToUnlitRatio: cornerRetentionRatio,
    brazierLightPoolDeltaL,
    brazierToFloorDeltaL: brazierLightPoolDeltaL,
    clipWhiteRatio,
  };
}

/**
 * CLI runner: reads <shotDir>/scene-manifest.json and outputs <shotDir>/metrics.json.
 */
export function runCli(args: string[] = process.argv.slice(2)): void {
  const dirIdx = args.indexOf('--dir');
  const shotDir = dirIdx !== -1 && args[dirIdx + 1] ? args[dirIdx + 1]! : '.';
  const manifestPath = path.resolve(shotDir, 'scene-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`[visual-metrics] scene-manifest.json not found in ${path.resolve(shotDir)}`);
    process.exit(1);
  }

  const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as SceneManifest;
  const entries: SceneManifestEntry[] = Array.isArray(manifestContent.scenes)
    ? manifestContent.scenes
    : manifestContent.scenes && typeof manifestContent.scenes === 'object'
      ? Object.entries(manifestContent.scenes).map(([id, entry]) => ({ id, ...entry }))
      : Array.isArray(manifestContent)
        ? (manifestContent as SceneManifestEntry[])
        : [];

  const metricsOutput: Record<
    string,
    {
      lit?: Record<string, RegionMetrics>;
      unlit?: Record<string, RegionMetrics>;
      summary?: SceneEnvironmentSummary;
    }
  > = {};

  for (const entry of entries) {
    const sceneId = entry.id ?? entry.name ?? 'unknown';
    const litFile = entry.file ?? entry.image ?? entry.litImage ?? `${sceneId}.png`;
    const litPath = path.resolve(shotDir, litFile);

    const rects = entry.sampleRects ?? [];
    if (rects.length === 0) continue;

    let litRegions: Record<string, RegionMetrics> | undefined;
    if (fs.existsSync(litPath)) {
      litRegions = analyzePngFileRegions(litPath, rects);
    }

    const unlitFile = entry.unlitFile ?? entry.unlitImage ?? `${sceneId}-unlit.png`;
    const unlitPath = path.resolve(shotDir, unlitFile);
    let unlitRegions: Record<string, RegionMetrics> | undefined;
    if (fs.existsSync(unlitPath)) {
      unlitRegions = analyzePngFileRegions(unlitPath, rects);
    }

    let summary: SceneEnvironmentSummary | undefined;
    if (litRegions && unlitRegions) {
      summary = computeSceneEnvironmentSummary(unlitRegions, litRegions);
    } else if (litRegions) {
      summary = computeSceneEnvironmentSummary(litRegions, litRegions);
    }

    metricsOutput[sceneId] = {
      ...(litRegions ? { lit: litRegions } : {}),
      ...(unlitRegions ? { unlit: unlitRegions } : {}),
      ...(summary ? { summary } : {}),
    };
  }

  const outPath = path.resolve(shotDir, 'metrics.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), scenes: metricsOutput }, null, 2),
    'utf8',
  );
  console.log(`[visual-metrics] Wrote metrics for ${Object.keys(metricsOutput).length} scenes to ${outPath}`);
}

if (process.argv[1]) {
  try {
    const currentPath = fileURLToPath(import.meta.url);
    const invokedPath = path.resolve(process.argv[1]);
    if (currentPath === invokedPath || invokedPath.endsWith('visual-metrics.ts')) {
      runCli();
    }
  } catch {
    // ignore if url resolution fails in special environments
  }
}
