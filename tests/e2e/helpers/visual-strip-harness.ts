import type { Page } from '@playwright/test';
import {
  type ActionRoiConfig,
  type AnimationGatesEvaluationResult,
  type AnimationGatesInput,
  type ApexEventSpec,
  type EmittedSimEventRecord,
  type ExternalStateMutationRecord,
  type FloatingAlertBoundsRecord,
  type KeyframeTraceRecord,
  type RoiResolutionMode,
  type ScreenRect,
  type StripStageKind,
  type TrackedActorBoundsRecord,
  computeCroppedRoiPixelDiff,
  convertPngBufferToGrayscale,
  evaluateAnimationGates,
  formatTelemetrySummaryMarkdown,
  renderOverviewGridStrip,
  renderRoiSheets1to1,
  resolveActionRoiRects,
} from '../../../tools/visual-metrics.js';
import {
  type BrowserStripHarnessState,
  installSceneStripInstrumentation,
  markPostWarmupStart,
  markPostWarmupStartTick,
  queueStepInput,
  triggerDash,
  triggerFireWeapon,
  triggerInteract,
  triggerReloadVent,
  type WhitelistInputSpec,
} from './strip-browser-instrumentation.js';

export type {
  ActionRoiConfig,
  AnimationGatesEvaluationResult,
  AnimationGatesInput,
  ApexEventSpec,
  BrowserStripHarnessState,
  EmittedSimEventRecord,
  ExternalStateMutationRecord,
  FloatingAlertBoundsRecord,
  KeyframeTraceRecord,
  RoiResolutionMode,
  ScreenRect,
  StripStageKind,
  TrackedActorBoundsRecord,
  WhitelistInputSpec,
};

export {
  installSceneStripInstrumentation,
  markPostWarmupStart,
  markPostWarmupStartTick,
  queueStepInput,
  triggerDash,
  triggerFireWeapon,
  triggerInteract,
  triggerReloadVent,
};

export interface StripKeyframeStep {
  stepCount: number;
  stepMode?: 'sim_ticks' | 'raf_frames';
  stage: StripStageKind;
  label?: string;
  beforeStep?: (page: Page) => Promise<void>;
}

export interface CapturedAnimatedSceneResult {
  litBuffer: Buffer;
  unlitBuffer?: Buffer;
  stripBuffer: Buffer;
  roiSheets: Array<{ sheetIndex: number; pngBuffer: Buffer }>;
  roiMode: RoiResolutionMode;
  telemetryInput: AnimationGatesInput;
  gateReport: AnimationGatesEvaluationResult;
  telemetrySummaryMd: string;
  perTickTraceHash: string;
}

export interface StripCaptureSceneOpts {
  id: string;
  captureUnlit?: boolean;
  grayscaleFrom?: string;
  frameCount?: 8 | 12;
  stripFramesPerStep?: number;
  stripSchedule?: readonly (number | StripKeyframeStep)[];
  heroFrameIndex?: number;
  apexEvent?: ApexEventSpec;
  actionRoi?: ActionRoiConfig;
  assertApexFlash?: boolean;
  gateMode?: 'WARN_ONLY' | 'HARD_ASSERT';
  setSceneLightingAndRenderStaticFrame: (page: Page, enabled: boolean) => Promise<void>;
}

function normalizeStripSchedule(opts: StripCaptureSceneOpts): {
  frameCount: 8 | 12;
  heroFrameIndex: number;
  steps: StripKeyframeStep[];
} {
  const frameCount: 8 | 12 = opts.frameCount ?? 8;
  if (frameCount === 12 && opts.heroFrameIndex === undefined) {
    throw new Error(`Scene "${opts.id}" has frameCount=12 and must explicitly specify heroFrameIndex.`);
  }
  const heroFrameIndex = opts.heroFrameIndex ?? 4;
  const defaultStepCount = opts.stripFramesPerStep ?? 2;
  const rawSchedule =
    opts.stripSchedule && opts.stripSchedule.length === frameCount
      ? opts.stripSchedule
      : Array.from({ length: frameCount }, (_, idx) => (idx === 0 ? 0 : defaultStepCount));

  const steps: StripKeyframeStep[] = rawSchedule.map((entry, idx) => {
    if (typeof entry === 'object' && entry !== null) {
      return {
        stepCount: idx === 0 ? 0 : entry.stepCount,
        stepMode: entry.stepMode ?? 'sim_ticks',
        stage: entry.stage,
        label: entry.label,
        beforeStep: entry.beforeStep,
      };
    }
    const stepCount = idx === 0 ? 0 : Number(entry);
    let stage: StripStageKind = 'active';
    if (idx === 0 || idx === 1) stage = 'windup_hold';
    else if (idx === 2) stage = 'trigger';
    else if (idx === heroFrameIndex) stage = 'apex';
    else if (idx === heroFrameIndex + 1) stage = 'sub_impact';
    else if (idx > heroFrameIndex + 1) stage = 'settled';
    return { stepCount, stepMode: 'sim_ticks', stage, label: stage.toUpperCase() };
  });

  return { frameCount, heroFrameIndex, steps };
}

async function advanceStripStep(
  page: Page,
  step: StripKeyframeStep,
  frameIdx: number,
): Promise<{ deltaTicks: number; rafStepsTaken: number; stateChangedInStep: boolean }> {
  await page.evaluate((idx) => {
    const win = window as unknown as { __STRIP_HARNESS__?: BrowserStripHarnessState };
    if (win.__STRIP_HARNESS__) {
      win.__STRIP_HARNESS__.currentFrameIndex = idx;
      win.__STRIP_HARNESS__.lastStepMaxWorldDispPx = 0;
    }
  }, frameIdx);

  if (step.beforeStep) {
    await step.beforeStep(page);
  }
  if (step.stepCount <= 0) {
    return { deltaTicks: 0, rafStepsTaken: 0, stateChangedInStep: true };
  }
  const mode = step.stepMode ?? 'sim_ticks';
  return page.evaluate(
    async ({ count, stepMode }) => {
      const win = window as unknown as {
        __STEP_RAF_FRAMES__?: (n: number) => Promise<void>;
        __GAME_TRANSPORT__?: { getSim: () => { tick: number } };
        __STRIP_HARNESS__?: BrowserStripHarnessState;
      };
      const stepFn = win.__STEP_RAF_FRAMES__;
      const sim = win.__GAME_TRANSPORT__?.getSim();
      const h = win.__STRIP_HARNESS__;
      if (!stepFn || !sim || !h) {
        return { deltaTicks: 0, rafStepsTaken: 0, stateChangedInStep: false };
      }
      const startTick = sim.tick;
      const startHash = h.computeStateHash();
      let rafCount = 0;

      if (stepMode === 'raf_frames') {
        await stepFn(count);
        rafCount = count;
      } else {
        const targetTick = startTick + count;
        const maxRaf = count * 8 + 16;
        while (sim.tick < targetTick && rafCount < maxRaf) {
          await stepFn(1);
          rafCount += 1;
        }
      }
      const endHash = h.computeStateHash();
      return {
        deltaTicks: sim.tick - startTick,
        rafStepsTaken: rafCount,
        stateChangedInStep: endHash !== startHash || sim.tick !== startTick,
      };
    },
    { count: step.stepCount, stepMode: mode },
  );
}

export async function captureAnimatedStripAndHeroScene(
  page: Page,
  opts: StripCaptureSceneOpts,
): Promise<CapturedAnimatedSceneResult> {
  await installSceneStripInstrumentation(page);
  const { frameCount, heroFrameIndex, steps } = normalizeStripSchedule(opts);
  const actionRoi: ActionRoiConfig = {
    mode: 'fixed_union',
    width: 640,
    height: 360,
    includeProjectiles: 'player_and_parried',
    ...(opts.actionRoi ?? {}),
  };

  await page.evaluate(() => {
    const win = window as unknown as {
      __CAPTURE_STRIP_ACTIVE__?: boolean;
      __STRIP_STEP_TICKS__?: number;
      __STRIP_HARNESS__?: BrowserStripHarnessState;
    };
    win.__CAPTURE_STRIP_ACTIVE__ = true;
    win.__STRIP_STEP_TICKS__ = 0;
    if (win.__STRIP_HARNESS__) {
      win.__STRIP_HARNESS__.captureActive = true;
      win.__STRIP_HARNESS__.currentFrameIndex = 0;
      win.__STRIP_HARNESS__.lastPostStepStateHash = win.__STRIP_HARNESS__.computeStateHash();
      win.__STRIP_HARNESS__.lastStepMaxWorldDispPx = 0;
    }
  });

  const frameBuffers: Buffer[] = [];
  const keyframes: KeyframeTraceRecord[] = [];
  let litBuffer: Buffer | undefined;
  let unlitBuffer: Buffer | undefined;

  for (let idx = 0; idx < frameCount; idx += 1) {
    const step = steps[idx]!;
    let stepStats = { deltaTicks: 0, rafStepsTaken: 0, stateChangedInStep: true };
    if (idx > 0) {
      stepStats = await advanceStripStep(page, step, idx);
    }

    const shotBuf = await page.screenshot({ type: 'png' });
    frameBuffers.push(shotBuf);

    const kf = await page.evaluate(
      ({ fIdx, stg, cLabel, dTicks, rafSteps, stChanged, incProj, eKinds, pKinds }) => {
        const win = window as unknown as { __STRIP_HARNESS__?: BrowserStripHarnessState };
        return win.__STRIP_HARNESS__!.collectKeyframeTrace(
          fIdx, stg, cLabel, dTicks, rafSteps, stChanged, incProj, eKinds, pKinds,
        );
      },
      {
        fIdx: idx,
        stg: step.stage,
        cLabel: step.label,
        dTicks: stepStats.deltaTicks,
        rafSteps: stepStats.rafStepsTaken,
        stChanged: stepStats.stateChangedInStep,
        incProj: actionRoi.includeProjectiles ?? 'player_and_parried',
        eKinds: actionRoi.enemyKinds,
        pKinds: actionRoi.propKinds,
      },
    );
    keyframes.push(kf);

    if (idx === heroFrameIndex) {
      litBuffer = opts.grayscaleFrom ? convertPngBufferToGrayscale(shotBuf) : shotBuf;
      if (opts.captureUnlit) {
        const readSnap = () =>
          page.evaluate(() => {
            const win = window as unknown as {
              __STRIP_HARNESS__?: BrowserStripHarnessState;
              __STRIP_STEP_TICKS__?: number;
              __PHASER_GAME__?: { scene: { getScene: (k: string) => Record<string, unknown> | undefined } };
            };
            const gs = win.__PHASER_GAME__?.scene.getScene('GameScene');
            const cam = (gs?.cameras as { main?: { scrollX: number; scrollY: number } })?.main;
            return {
              scrollX: cam?.scrollX ?? 0,
              scrollY: cam?.scrollY ?? 0,
              stateHash: win.__STRIP_HARNESS__?.computeStateHash() ?? '',
              stripTicks: win.__STRIP_STEP_TICKS__ ?? 0,
            };
          });
        const preSnap = await readSnap();
        await opts.setSceneLightingAndRenderStaticFrame(page, false);
        unlitBuffer = await page.screenshot({ type: 'png' });
        await opts.setSceneLightingAndRenderStaticFrame(page, true);
        const postSnap = await readSnap();
        if (
          Math.abs(postSnap.scrollX - preSnap.scrollX) > 1e-4 ||
          Math.abs(postSnap.scrollY - preSnap.scrollY) > 1e-4 ||
          postSnap.stateHash !== preSnap.stateHash ||
          postSnap.stripTicks !== preSnap.stripTicks
        ) {
          throw new Error(`Unlit capture mutated camera or simulation state in "${opts.id}"`);
        }
      }
    }
  }

  const logs = await page.evaluate(() => {
    const win = window as unknown as {
      __CAPTURE_STRIP_ACTIVE__?: boolean;
      __STRIP_HARNESS__?: BrowserStripHarnessState;
    };
    win.__CAPTURE_STRIP_ACTIVE__ = false;
    const h = win.__STRIP_HARNESS__;
    if (h) h.captureActive = false;
    return {
      emittedSimEvents: h?.emittedSimEvents ?? [],
      externalStateMutations: h?.externalStateMutations ?? [],
    };
  });

  const { roiMode } = resolveActionRoiRects(keyframes, actionRoi);

  for (let idx = 0; idx < keyframes.length; idx += 1) {
    const kf = keyframes[idx]!;
    if (idx === 0) {
      kf.changedScreenPixels = 0;
    } else {
      kf.changedScreenPixels = computeCroppedRoiPixelDiff(
        frameBuffers[idx - 1]!,
        frameBuffers[idx]!,
        kf.roiRect,
      );
    }
  }

  const roiSheetBuffers = renderRoiSheets1to1(frameBuffers, keyframes, heroFrameIndex, roiMode);
  const roiSheets = roiSheetBuffers.map((pngBuffer, idx) => ({
    sheetIndex: idx + 1,
    pngBuffer,
  }));
  const stripBuffer = renderOverviewGridStrip(frameBuffers, keyframes, heroFrameIndex);

  const telemetryInput: AnimationGatesInput = {
    sceneId: opts.id,
    frameCount,
    heroFrameIndex,
    apexEventSpec: opts.apexEvent,
    actionRoi,
    emittedSimEvents: logs.emittedSimEvents,
    externalStateMutations: logs.externalStateMutations,
    keyframes,
  };

  const gateMode: 'WARN_ONLY' | 'HARD_ASSERT' =
    opts.gateMode ?? (process.env['ASHEN_ANIM_GATE_MODE'] === 'WARN_ONLY' ? 'WARN_ONLY' : 'HARD_ASSERT');
  const gateReport = evaluateAnimationGates(telemetryInput, gateMode);
  const telemetrySummaryMd = formatTelemetrySummaryMarkdown(telemetryInput, gateReport, roiMode);

  const perTickTraceHash = JSON.stringify(
    keyframes.map((k) => ({
      i: k.frameIndex,
      t: k.simTick,
      dt: k.deltaTicks,
      p: k.playerStateSummary,
      a: k.actors.map((ac) => [ac.actorKey, Math.round(ac.worldX * 100), Math.round(ac.worldY * 100), ac.hp]),
    })),
  );

  return {
    litBuffer: litBuffer ?? frameBuffers[0]!,
    unlitBuffer,
    stripBuffer,
    roiSheets,
    roiMode,
    telemetryInput,
    gateReport,
    telemetrySummaryMd,
    perTickTraceHash,
  };
}
