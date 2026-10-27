import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import {
  analyzePngBufferRegions,
  comparePngBuffers,
  computeSceneEnvironmentSummary,
  convertPngBufferToGrayscale,
  evaluateAnimationGates,
  renderOverviewGridStrip,
  renderRoiSheets1to1,
  resolveActionRoiRects,
  srgbToCieL,
  srgbToHslSaturation,
  stitchPngBuffersHorizontal,
  type AnimationGatesInput,
  type KeyframeTraceRecord,
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

function makeValidBaselineGatesInput(): AnimationGatesInput {
  const stages = [
    'windup_hold',
    'windup_hold',
    'trigger',
    'active',
    'apex',
    'sub_impact',
    'settled',
    'settled',
  ] as const;

  const keyframes: KeyframeTraceRecord[] = stages.map((stage, idx) => ({
    frameIndex: idx,
    frameLabel: `F${idx + 1}`,
    stage,
    simTick: 10 + idx * 2,
    deltaTicks: idx === 0 ? 0 : 2,
    rafStepsTaken: idx === 0 ? 0 : 2,
    hitStopActive: false,
    maxInSimStepWorldPx: idx === 0 ? 0 : 8.5,
    stateChangedInStep: idx > 0,
    changedScreenPixels: idx === 0 ? 0 : 1200,
    roiRect: { x: 480, y: 260, width: 640, height: 360 },
    roiWorldCenter: { x: 400, y: 220 },
    playerStateSummary: 'alive | clip:5/6',
    targetDeltaPosSummary: `dx:${idx * 8}px`,
    actors: [
      {
        actorKey: 'player',
        kind: 'player',
        defIdOrKind: 'vanguard',
        worldX: 360 + idx * 2,
        worldY: 220,
        hp: 6,
        alive: true,
        inChasm: false,
        visible: true,
        screenBounds: { x: 600, y: 360, width: 48, height: 56 },
      },
      {
        actorKey: 'enemy:201',
        kind: 'enemy',
        defIdOrKind: 'goblin_shooter',
        worldX: 420 + idx * 8,
        worldY: 220,
        hp: 50,
        alive: true,
        inChasm: false,
        visible: true,
        screenBounds: { x: 720 + idx * 16, y: 360, width: 44, height: 52 },
      },
    ],
    alerts:
      idx === 4
        ? [
            {
              label: 'ĐẬP TƯỜNG!',
              isNumericOnly: false,
              age: 0.05,
              ttl: 0.8,
              screenBounds: { x: 760, y: 310, width: 110, height: 22 },
            },
          ]
        : [],
    minFrameActorContainmentRatio: 1.0,
  }));

  return {
    sceneId: 'ap2-dash-kick-wall-slam',
    frameCount: 8,
    heroFrameIndex: 4,
    apexEventSpec: {
      simEventKind: 'wall_slam',
      toleranceTicks: 2,
    },
    emittedSimEvents: [
      {
        simTick: 18,
        rafStep: 8,
        frameIndex: 4,
        simEventKind: 'wall_slam',
        eventPayload: { enemyId: 201, damage: 42 },
        x: 452,
        y: 220,
      },
    ],
    externalStateMutations: [],
    keyframes,
    requiresNetDisplacement: true,
  };
}

describe('Animation & Moment Verification Engine 2.6 — 5 Negative Fixtures', () => {
  it('passes all 5 gates on a clean baseline trace', () => {
    const input = makeValidBaselineGatesInput();
    const res = evaluateAnimationGates(input, 'HARD_ASSERT');
    expect(res.passed).toBe(true);
    expect(res.failedGates).toEqual([]);
  });

  it('fixture-gate1-premature-or-missed-apex: fails Gate 1 when apexEvent fires at F1 or drifts > toleranceTicks from heroFrameIndex', () => {
    const prematureInput = makeValidBaselineGatesInput();
    prematureInput.emittedSimEvents = [
      {
        simTick: 10,
        rafStep: 0,
        frameIndex: 0, // F1 premature climax!
        simEventKind: 'wall_slam',
      },
      ...prematureInput.emittedSimEvents,
    ];
    expect(() => evaluateAnimationGates(prematureInput, 'HARD_ASSERT', { throwOnFail: true })).toThrow(
      /Gate 1/i,
    );

    const driftedInput = makeValidBaselineGatesInput();
    driftedInput.emittedSimEvents = [
      {
        simTick: 25, // Hero frame is at tick 18 -> delta = 7 > 2 ticks
        rafStep: 15,
        frameIndex: 7,
        simEventKind: 'wall_slam',
      },
    ];
    const driftedRes = evaluateAnimationGates(driftedInput, 'WARN_ONLY');
    expect(driftedRes.gates.gate1ApexEvent.passed).toBe(false);
    expect(driftedRes.failedGates).toContain('gate1ApexEvent');
  });

  it('fixture-gate2-external-state-mutation: fails Gate 2 when script mutates enemy.x or player.weaponHeat outside transport.step()', () => {
    const mutatedInput = makeValidBaselineGatesInput();
    mutatedInput.externalStateMutations = [
      {
        stepFromFrame: 2,
        simTick: 14,
        entityKey: 'enemy:201',
        field: 'x',
        afterPrevStepValue: 436,
        beforeNextStepValue: 451,
      },
    ];
    expect(() => evaluateAnimationGates(mutatedInput, 'HARD_ASSERT', { throwOnFail: true })).toThrow(
      /Gate 2/i,
    );
    const res = evaluateAnimationGates(mutatedInput, 'WARN_ONLY');
    expect(res.gates.gate2StateIntegrityAndVelocity.passed).toBe(false);
  });

  it('fixture-gate3-frozen-active-step: fails Gate 3 when target stage is active, !hitStopActive, and state/pixels are frozen', () => {
    const frozenInput = makeValidBaselineGatesInput();
    frozenInput.keyframes[3] = {
      ...frozenInput.keyframes[3]!,
      stage: 'active',
      hitStopActive: false,
      stateChangedInStep: false,
      changedScreenPixels: 0,
    };
    expect(() => evaluateAnimationGates(frozenInput, 'HARD_ASSERT', { throwOnFail: true })).toThrow(
      /Gate 3/i,
    );
    const res = evaluateAnimationGates(frozenInput, 'WARN_ONLY');
    expect(res.gates.gate3StageActivityAndPixelDiff.passed).toBe(false);
  });

  it('fixture-gate4-alert-overlap-and-clipped-actor: fails Gate 4 when two non-numeric alerts overlap or a live actor is clipped (containment = 0.5)', () => {
    const overlapInput = makeValidBaselineGatesInput();
    overlapInput.keyframes[4]!.alerts = [
      {
        label: 'ĐẬP TƯỜNG!',
        isNumericOnly: false,
        age: 0.05,
        ttl: 0.8,
        screenBounds: { x: 760, y: 310, width: 110, height: 22 },
      },
      {
        label: 'CHOÁNG!',
        isNumericOnly: false,
        age: 0.05,
        ttl: 0.8,
        screenBounds: { x: 780, y: 318, width: 90, height: 22 },
      },
    ];
    expect(() => evaluateAnimationGates(overlapInput, 'HARD_ASSERT', { throwOnFail: true })).toThrow(
      /Gate 4/i,
    );

    const clippedInput = makeValidBaselineGatesInput();
    // Place enemy half outside the right edge of roiRect (480 + 640 = 1120)
    clippedInput.keyframes[5]!.actors[1]!.screenBounds = {
      x: 1098,
      y: 360,
      width: 44,
      height: 52,
    };
    clippedInput.keyframes[5]!.minFrameActorContainmentRatio = 0.5;
    const clippedRes = evaluateAnimationGates(clippedInput, 'WARN_ONLY');
    expect(clippedRes.gates.gate4AlertOverlapAndContainment.passed).toBe(false);
  });

  it('fixture-gate5-insufficient-net-displacement: fails Gate 5 when physics scene actor only jitters in place (maxNetWorldDisplacementPx = 3)', () => {
    const jitterInput = makeValidBaselineGatesInput();
    for (let k = 0; k < jitterInput.keyframes.length; k++) {
      const kf = jitterInput.keyframes[k]!;
      kf.actors[0]!.worldX = 360 + (k % 2);
      kf.actors[1]!.worldX = 420 + (k % 2) * 3;
      kf.actors[1]!.worldY = 220;
    }
    jitterInput.emittedSimEvents = [
      {
        simTick: 18,
        rafStep: 8,
        frameIndex: 4,
        simEventKind: 'wall_slam',
        eventPayload: { enemyId: 201, damage: 42 },
        x: 423,
        y: 220,
      },
    ];
    expect(() => evaluateAnimationGates(jitterInput, 'HARD_ASSERT', { throwOnFail: true })).toThrow(
      /Gate 5/i,
    );
    const res = evaluateAnimationGates(jitterInput, 'WARN_ONLY');
    expect(res.gates.gate5NetDisplacement.passed).toBe(false);
    expect(res.gates.gate5NetDisplacement.maxNetWorldDisplacementPx).toBeLessThanOrEqual(3);
  });

  it('resolves Fixed Union ROI and renders 1280x760 1:1 ROI sheets + 1920x580 / 1920x870 overview strips', () => {
    const input = makeValidBaselineGatesInput();
    const { roiMode, roiRects } = resolveActionRoiRects(input.keyframes, undefined, 64, 48);
    expect(roiMode).toBe('level1_fixed_all');
    expect(roiRects).toHaveLength(8);

    // Create 8 small synthetic 1920x1080 buffers only when testing exact dimensions;
    // here we use 640x360 ROI on a 640x360 buffer for fast unit test verification
    const fastFrames = Array.from({ length: 8 }, (_, idx) =>
      makeTestPng(640, 360, () => [20 + idx * 10, 40, 60, 255]),
    );
    for (const kf of input.keyframes) {
      kf.roiRect = { x: 0, y: 0, width: 640, height: 360 };
    }
    const roiSheets = renderRoiSheets1to1(fastFrames, input.keyframes, 4, 'level1_fixed_all');
    expect(roiSheets).toHaveLength(2);
    const sheet1 = PNG.sync.read(roiSheets[0]!);
    expect(sheet1.width).toBe(1280);
    expect(sheet1.height).toBe(760);

    const overview8 = PNG.sync.read(renderOverviewGridStrip(fastFrames, input.keyframes, 4));
    expect(overview8.width).toBe(1920);
    expect(overview8.height).toBe(580);
  });
});
