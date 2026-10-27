import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export type StripStageKind =
  | 'windup_hold'
  | 'trigger'
  | 'active'
  | 'sub_impact'
  | 'apex'
  | 'settled';

export type RoiResolutionMode =
  | 'level1_fixed_all'
  | 'level2_per_sheet'
  | 'level3_per_frame_follow';

export interface ApexEventSpec {
  simEventKind?: string | readonly string[];
  simEventPredicate?: (ev: Record<string, unknown>) => boolean;
  alertSubstring?: string;
  occurrence?: 'first' | 'last' | number;
  toleranceTicks?: number;
}

export interface ActionRoiConfig {
  mode?: 'fixed_union' | 'fixed_screen';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  enemyKinds?: readonly string[];
  propKinds?: readonly string[];
  includeProjectiles?: 'none' | 'player_and_parried' | 'all_focused';
  sceneCategory?: 'combat_physics' | 'microbar_ui';
  minNetWorldDisplacementPx?: number;
}

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EmittedSimEventRecord {
  simTick: number;
  rafStep: number;
  frameIndex: number;
  simEventKind?: string;
  eventPayload?: Record<string, unknown>;
  alertLabel?: string;
  x?: number;
  y?: number;
}

export interface ExternalStateMutationRecord {
  stepFromFrame: number;
  simTick: number;
  entityKey: string;
  field: string;
  afterPrevStepValue: unknown;
  beforeNextStepValue: unknown;
}

export interface TrackedActorBoundsRecord {
  actorKey: string;
  kind: 'player' | 'enemy' | 'prop' | 'projectile' | 'rivet' | 'blossom';
  defIdOrKind: string;
  worldX: number;
  worldY: number;
  hp: number;
  alive: boolean;
  inChasm: boolean;
  visible: boolean;
  screenBounds: ScreenRect;
}

export interface FloatingAlertBoundsRecord {
  label: string;
  isNumericOnly: boolean;
  age: number;
  ttl: number;
  screenBounds: ScreenRect;
}

export interface KeyframeTraceRecord {
  frameIndex: number;
  frameLabel: string;
  stage: StripStageKind;
  customLabel?: string;
  simTick: number;
  deltaTicks: number;
  rafStepsTaken: number;
  hitStopActive: boolean;
  maxInSimStepWorldPx: number;
  stateChangedInStep: boolean;
  changedScreenPixels: number;
  roiRect: ScreenRect;
  roiWorldCenter: { x: number; y: number };
  playerStateSummary: string;
  targetDeltaPosSummary: string;
  actors: TrackedActorBoundsRecord[];
  alerts: FloatingAlertBoundsRecord[];
  minFrameActorContainmentRatio: number;
}

export interface AnimationGateThresholds {
  maxInSimStepWorldPx: number;
  minChangedScreenPixelsCombat: number;
  minChangedScreenPixelsMicrobar: number;
  minActorContainmentRatio: number;
  minNetWorldDisplacementPx: number;
}

export const DEFAULT_ANIMATION_GATE_THRESHOLDS: AnimationGateThresholds = {
  maxInSimStepWorldPx: 96,
  minChangedScreenPixelsCombat: 120,
  minChangedScreenPixelsMicrobar: 24,
  minActorContainmentRatio: 0.85,
  minNetWorldDisplacementPx: 18,
};

export interface AnimationGatesInput {
  sceneId: string;
  frameCount: 8 | 12;
  heroFrameIndex: number;
  apexEventSpec?: ApexEventSpec;
  actionRoi?: ActionRoiConfig;
  emittedSimEvents: EmittedSimEventRecord[];
  externalStateMutations: ExternalStateMutationRecord[];
  keyframes: KeyframeTraceRecord[];
  requiresNetDisplacement?: boolean;
}

export interface AnimationGatesEvaluationResult {
  passed: boolean;
  mode: 'WARN_ONLY' | 'HARD_ASSERT';
  failedGates: string[];
  warnings: string[];
  gates: {
    gate1ApexEvent: {
      passed: boolean;
      preF1Clean: boolean;
      matchedTick: number | null;
      heroTick: number;
      apexTickDelta: number | null;
      toleranceTicks: number;
      reason: string;
    };
    gate2StateIntegrityAndVelocity: {
      passed: boolean;
      externalMutationCount: number;
      maxInSimStepWorldPx: number;
      reason: string;
    };
    gate3StageActivityAndPixelDiff: {
      passed: boolean;
      frozenSteps: number[];
      minActiveStepChangedPixels: number;
      reason: string;
    };
    gate4AlertOverlapAndContainment: {
      passed: boolean;
      nonNumericAlertOverlapCount: number;
      numericAlertOverlapWarnings: number;
      minActorContainmentRatio: number;
      reason: string;
    };
    gate5NetDisplacement: {
      passed: boolean;
      applicable: boolean;
      maxNetWorldDisplacementPx: number;
      requiredMinWorldPx: number;
      reason: string;
    };
  };
}

const PHYSICS_DISPLACEMENT_SCENE_PATTERNS = [
  'dash-kick',
  'wall-slam',
  'ring-out',
  'thorn-pull',
  'tether-pull',
  'shotgun-wallslam',
  'gale-vent',
  'laser-railgun',
  'cleaver-boomerang',
  'void-implosion',
  'axe-guillotine',
  'solar-supernova',
  'magma-geysers',
  'hammer-thunder',
];

export function isPhysicsDisplacementScene(sceneId: string): boolean {
  return PHYSICS_DISPLACEMENT_SCENE_PATTERNS.some((p) => sceneId.includes(p));
}

export function computeRectIntersectionArea(a: ScreenRect, b: ScreenRect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

export function computeActorContainmentRatio(bounds: ScreenRect, roiRect: ScreenRect): number {
  const area = Math.max(0, bounds.width) * Math.max(0, bounds.height);
  if (area <= 0) return 1;
  return computeRectIntersectionArea(bounds, roiRect) / area;
}

function clampRoiRect(
  centerX: number,
  centerY: number,
  roiW: number,
  roiH: number,
  screenW: number,
  screenH: number,
): ScreenRect {
  const x = Math.max(0, Math.min(screenW - roiW, Math.round(centerX - roiW * 0.5)));
  const y = Math.max(0, Math.min(screenH - roiH, Math.round(centerY - roiH * 0.5)));
  return { x, y, width: roiW, height: roiH };
}

function collectFrameActorScreenBoxes(
  kf: KeyframeTraceRecord,
  actionRoi?: ActionRoiConfig,
): ScreenRect[] {
  const boxes: ScreenRect[] = [];
  const enemyKinds = actionRoi?.enemyKinds;
  const propKinds = actionRoi?.propKinds;
  const projMode = actionRoi?.includeProjectiles ?? 'player_and_parried';
  const playerActor = kf.actors.find((a) => a.kind === 'player');

  for (const actor of kf.actors) {
    if (!actor.alive || actor.inChasm || !actor.visible) continue;
    if (actor.kind === 'enemy' && enemyKinds && enemyKinds.length > 0) {
      if (!enemyKinds.includes(actor.defIdOrKind)) continue;
    }
    if (actor.kind === 'prop') {
      if (propKinds !== undefined) {
        if (!propKinds.includes(actor.defIdOrKind)) continue;
      } else if (
        playerActor &&
        Math.hypot(actor.worldX - playerActor.worldX, actor.worldY - playerActor.worldY) > 180
      ) {
        continue;
      }
    }
    if (actor.kind === 'projectile') {
      if (projMode === 'none') continue;
    }
    if (actor.screenBounds.width > 0 && actor.screenBounds.height > 0) {
      boxes.push(actor.screenBounds);
    }
  }
  return boxes;
}

function collectFrameTrackedScreenBoxes(
  kf: KeyframeTraceRecord,
  actionRoi?: ActionRoiConfig,
): ScreenRect[] {
  const boxes = collectFrameActorScreenBoxes(kf, actionRoi);
  for (const alert of kf.alerts) {
    if (!alert.isNumericOnly && alert.age <= alert.ttl * 0.75) {
      if (alert.screenBounds.width > 0 && alert.screenBounds.height > 0) {
        boxes.push(alert.screenBounds);
      }
    }
  }
  return boxes;
}

function computeUnionBox(boxes: ScreenRect[]): ScreenRect | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function fitRoiRectWithActorPriority(
  actorUnion: ScreenRect | null,
  fullUnion: ScreenRect | null,
  roiW: number,
  roiH: number,
  screenW: number,
  screenH: number,
): ScreenRect {
  const hasAlertTop =
    Boolean(actorUnion && fullUnion && fullUnion.y < actorUnion.y - 4);
  const cx = fullUnion ? fullUnion.x + fullUnion.width * 0.5 : screenW * 0.5;
  const cy = fullUnion
    ? fullUnion.y + fullUnion.height * 0.5 - (hasAlertTop ? 0 : 12)
    : screenH * 0.5 - 12;
  const rect = clampRoiRect(cx, cy, roiW, roiH, screenW, screenH);
  if (actorUnion && actorUnion.width <= roiW - 8 && actorUnion.height <= roiH - 8) {
    const minX = Math.max(0, actorUnion.x + actorUnion.width + 4 - roiW);
    const maxX = Math.min(screenW - roiW, actorUnion.x - 4);
    if (minX <= maxX) {
      rect.x = Math.round(Math.max(minX, Math.min(maxX, rect.x)));
    }
    const minY = Math.max(0, actorUnion.y + actorUnion.height + 4 - roiH);
    const maxY = Math.min(screenH - roiH, actorUnion.y - 4);
    if (minY <= maxY) {
      rect.y = Math.round(Math.max(minY, Math.min(maxY, rect.y)));
    }
  }
  return rect;
}

export function resolveActionRoiRects(
  keyframes: KeyframeTraceRecord[],
  actionRoi?: ActionRoiConfig,
  screenW = 1920,
  screenH = 1080,
): { roiMode: RoiResolutionMode; roiRects: ScreenRect[] } {
  const roiW = actionRoi?.width ?? 640;
  const roiH = actionRoi?.height ?? 360;

  if (actionRoi?.mode === 'fixed_screen' && actionRoi.x !== undefined && actionRoi.y !== undefined) {
    const fixed = clampRoiRect(
      actionRoi.x + roiW * 0.5,
      actionRoi.y + roiH * 0.5,
      roiW,
      roiH,
      screenW,
      screenH,
    );
    const rects = keyframes.map(() => ({ ...fixed }));
    applyRoiContainmentToKeyframes(keyframes, rects, actionRoi);
    return { roiMode: 'level1_fixed_all', roiRects: rects };
  }

  const perFrameActorBoxes = keyframes.map((kf) => collectFrameActorScreenBoxes(kf, actionRoi));
  const perFrameBoxes = keyframes.map((kf) => collectFrameTrackedScreenBoxes(kf, actionRoi));
  const fullActorUnion = computeUnionBox(perFrameActorBoxes.flat());
  const fullUnion = computeUnionBox(perFrameBoxes.flat());

  if (
    !fullActorUnion ||
    (fullActorUnion.width <= roiW - 12 && fullActorUnion.height <= roiH - 12)
  ) {
    const fixed = fitRoiRectWithActorPriority(
      fullActorUnion,
      fullUnion,
      roiW,
      roiH,
      screenW,
      screenH,
    );
    const rects = keyframes.map(() => ({ ...fixed }));
    applyRoiContainmentToKeyframes(keyframes, rects, actionRoi);
    return { roiMode: 'level1_fixed_all', roiRects: rects };
  }

  // Check Level 2: Per-Sheet Fixed ROI (groups of 4 frames)
  const sheetCount = Math.ceil(keyframes.length / 4);
  const sheetActorUnions: Array<ScreenRect | null> = [];
  const sheetUnions: Array<ScreenRect | null> = [];
  let level2Fits = true;
  for (let s = 0; s < sheetCount; s++) {
    const chunkActors = perFrameActorBoxes.slice(s * 4, s * 4 + 4).flat();
    const chunkBoxes = perFrameBoxes.slice(s * 4, s * 4 + 4).flat();
    const ua = computeUnionBox(chunkActors);
    const u = computeUnionBox(chunkBoxes);
    sheetActorUnions.push(ua);
    sheetUnions.push(u);
    if (ua && (ua.width > roiW - 8 || ua.height > roiH - 8)) {
      level2Fits = false;
    }
  }

  if (level2Fits) {
    const rects = keyframes.map((_, idx) => {
      const s = Math.floor(idx / 4);
      return fitRoiRectWithActorPriority(
        sheetActorUnions[s] ?? null,
        sheetUnions[s] ?? null,
        roiW,
        roiH,
        screenW,
        screenH,
      );
    });
    applyRoiContainmentToKeyframes(keyframes, rects, actionRoi);
    return { roiMode: 'level2_per_sheet', roiRects: rects };
  }

  // Level 3: Per-Frame Clamped Follow ROI
  const rects = keyframes.map((_, idx) => {
    const ua = computeUnionBox(perFrameActorBoxes[idx] ?? []);
    const u = computeUnionBox(perFrameBoxes[idx] ?? []);
    return fitRoiRectWithActorPriority(ua, u, roiW, roiH, screenW, screenH);
  });
  applyRoiContainmentToKeyframes(keyframes, rects, actionRoi);
  return { roiMode: 'level3_per_frame_follow', roiRects: rects };
}

function applyRoiContainmentToKeyframes(
  keyframes: KeyframeTraceRecord[],
  roiRects: ScreenRect[],
  actionRoi?: ActionRoiConfig,
): void {
  for (let k = 0; k < keyframes.length; k++) {
    const kf = keyframes[k]!;
    const rect = roiRects[k]!;
    kf.roiRect = { ...rect };
    const boxes = collectFrameActorScreenBoxes(kf, actionRoi);
    let minRatio = 1.0;
    for (const b of boxes) {
      const r = computeActorContainmentRatio(b, rect);
      if (r < minRatio) minRatio = r;
    }
    kf.minFrameActorContainmentRatio = Number(minRatio.toFixed(4));
  }
}

export function cropPngSubRect(png: PNG, rect: ScreenRect): Buffer {
  const w = Math.max(1, Math.min(png.width, Math.floor(rect.width)));
  const h = Math.max(1, Math.min(png.height, Math.floor(rect.height)));
  const x0 = Math.max(0, Math.min(png.width - w, Math.floor(rect.x)));
  const y0 = Math.max(0, Math.min(png.height - h, Math.floor(rect.y)));
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const srcStart = ((y0 + y) * png.width + x0) * 4;
    const dstStart = y * w * 4;
    png.data.copy(out, dstStart, srcStart, srcStart + w * 4);
  }
  return out;
}

export function computeCroppedRoiPixelDiff(
  bufPrev: Buffer,
  bufCurr: Buffer,
  roiRectCurr: ScreenRect,
  threshold = 0.08,
): number {
  const pngA = PNG.sync.read(bufPrev);
  const pngB = PNG.sync.read(bufCurr);
  const w = Math.max(1, Math.min(pngA.width, Math.floor(roiRectCurr.width)));
  const h = Math.max(1, Math.min(pngA.height, Math.floor(roiRectCurr.height)));
  const cropA = cropPngSubRect(pngA, roiRectCurr);
  const cropB = cropPngSubRect(pngB, roiRectCurr);
  return pixelmatch(cropA, cropB, undefined, w, h, { threshold });
}

function matchesApexEventSpec(ev: EmittedSimEventRecord, spec: ApexEventSpec): boolean {
  if (spec.simEventKind) {
    const kinds = Array.isArray(spec.simEventKind) ? spec.simEventKind : [spec.simEventKind];
    if (!ev.simEventKind || !kinds.includes(ev.simEventKind)) {
      return false;
    }
    if (spec.simEventPredicate && !spec.simEventPredicate(ev.eventPayload ?? {})) {
      return false;
    }
    return true;
  }
  if (spec.alertSubstring) {
    return Boolean(ev.alertLabel && ev.alertLabel.includes(spec.alertSubstring));
  }
  return false;
}

export function evaluateAnimationGates(
  input: AnimationGatesInput,
  mode: 'WARN_ONLY' | 'HARD_ASSERT' = 'HARD_ASSERT',
  options?: {
    thresholds?: Partial<AnimationGateThresholds>;
    throwOnFail?: boolean;
  },
): AnimationGatesEvaluationResult {
  const thresholds: AnimationGateThresholds = {
    ...DEFAULT_ANIMATION_GATE_THRESHOLDS,
    ...(options?.thresholds ?? {}),
  };

  const failedGates: string[] = [];
  const warnings: string[] = [];

  // 1. Gate 1: Apex Event & Pre-F1 Cleanliness
  const heroKf = input.keyframes[input.heroFrameIndex];
  const heroTick = heroKf?.simTick ?? 0;
  const spec = input.apexEventSpec;
  const toleranceTicks = spec?.toleranceTicks ?? 2;

  const f1IsWindup = input.keyframes[0]?.stage === 'windup_hold';
  const apexFrames = input.keyframes.filter((k) => k.stage === 'apex');
  const uniqueHeroApex =
    apexFrames.length === 1 && apexFrames[0]?.frameIndex === input.heroFrameIndex;

  const matchingEvents = spec
    ? input.emittedSimEvents.filter((ev) => matchesApexEventSpec(ev, spec))
    : [];
  const prematureEvents = matchingEvents.filter((ev) => ev.frameIndex <= 0);
  const postF1Events = matchingEvents.filter((ev) => ev.frameIndex > 0);

  let selectedEvent: EmittedSimEventRecord | undefined;
  if (postF1Events.length > 0) {
    const occ = spec?.occurrence ?? 'first';
    if (occ === 'first') selectedEvent = postF1Events[0];
    else if (occ === 'last') selectedEvent = postF1Events[postF1Events.length - 1];
    else if (typeof occ === 'number') selectedEvent = postF1Events[Math.max(0, occ - 1)];
  }

  const preF1Clean = f1IsWindup && uniqueHeroApex && prematureEvents.length === 0;
  const matchedTick = selectedEvent ? selectedEvent.simTick : null;
  const apexTickDelta = matchedTick !== null ? Math.abs(heroTick - matchedTick) : null;
  const gate1Passed =
    preF1Clean &&
    (!spec || (matchedTick !== null && apexTickDelta !== null && apexTickDelta <= toleranceTicks));

  let gate1Reason = 'OK';
  if (!f1IsWindup) {
    gate1Reason = `F1 stage must be 'windup_hold', got '${input.keyframes[0]?.stage}'`;
  } else if (!uniqueHeroApex) {
    gate1Reason = `Exactly one frame at heroFrameIndex=${input.heroFrameIndex} must have stage='apex'`;
  } else if (prematureEvents.length > 0) {
    gate1Reason = `Premature apexEvent emitted at or before F1 (tick=${prematureEvents[0]?.simTick})`;
  } else if (spec && matchedTick === null) {
    gate1Reason = `Expected apexEvent (${JSON.stringify(spec.simEventKind ?? spec.alertSubstring)}) never emitted after F1`;
  } else if (spec && apexTickDelta !== null && apexTickDelta > toleranceTicks) {
    gate1Reason = `Hero frame tick (${heroTick}) drifted by ${apexTickDelta} ticks from apexEvent tick (${matchedTick}) > tolerance (${toleranceTicks})`;
  }

  if (!gate1Passed) {
    failedGates.push('gate1ApexEvent');
  }

  // 2. Gate 2: State Integrity Outside transport.step() & In-Sim Step Velocity
  const externalMutationCount = input.externalStateMutations.length;
  const maxInSimStepWorldPx = Math.max(
    0,
    ...input.keyframes.map((k) => k.maxInSimStepWorldPx ?? 0),
  );
  const gate2Passed =
    externalMutationCount === 0 && maxInSimStepWorldPx <= thresholds.maxInSimStepWorldPx;
  let gate2Reason = 'OK';
  if (externalMutationCount > 0) {
    const m0 = input.externalStateMutations[0]!;
    gate2Reason = `Detected ${externalMutationCount} external state mutation(s) outside transport.step(), e.g. ${m0.entityKey}.${m0.field}: ${String(m0.afterPrevStepValue)} -> ${String(m0.beforeNextStepValue)} at F${m0.stepFromFrame + 1}->F${m0.stepFromFrame + 2}`;
  } else if (maxInSimStepWorldPx > thresholds.maxInSimStepWorldPx) {
    gate2Reason = `maxInSimStepWorldPx (${maxInSimStepWorldPx.toFixed(1)}) exceeded threshold (${thresholds.maxInSimStepWorldPx})`;
  }
  if (!gate2Passed) {
    failedGates.push('gate2StateIntegrityAndVelocity');
  }

  // 3. Gate 3: Stage-Aware Activity & Pixel Diff Gate
  const isMicrobarScene =
    input.actionRoi?.sceneCategory === 'microbar_ui' ||
    input.sceneId.includes('microbar') ||
    input.sceneId.includes('heat-vent');
  const minRequiredPixels = isMicrobarScene
    ? thresholds.minChangedScreenPixelsMicrobar
    : thresholds.minChangedScreenPixelsCombat;

  const frozenSteps: number[] = [];
  let minActiveStepChangedPixels = Infinity;
  for (let i = 1; i < input.keyframes.length; i++) {
    const kf = input.keyframes[i]!;
    const requiresMotion =
      kf.stage === 'trigger' ||
      kf.stage === 'active' ||
      kf.stage === 'sub_impact' ||
      kf.stage === 'apex';
    if (requiresMotion && !kf.hitStopActive) {
      if (kf.changedScreenPixels < minActiveStepChangedPixels) {
        minActiveStepChangedPixels = kf.changedScreenPixels;
      }
      if (!kf.stateChangedInStep || kf.changedScreenPixels < minRequiredPixels) {
        frozenSteps.push(i);
      }
    }
  }
  if (!Number.isFinite(minActiveStepChangedPixels)) {
    minActiveStepChangedPixels = 0;
  }
  const gate3Passed = frozenSteps.length === 0;
  const gate3Reason = gate3Passed
    ? 'OK'
    : `Frozen/under-threshold active step(s) at destination frame(s): ${frozenSteps.map((idx) => `F${idx + 1} (stage=${input.keyframes[idx]?.stage}, stateChanged=${input.keyframes[idx]?.stateChangedInStep}, dPx=${input.keyframes[idx]?.changedScreenPixels} < ${minRequiredPixels})`).join(', ')}`;
  if (!gate3Passed) {
    failedGates.push('gate3StageActivityAndPixelDiff');
  }

  // 4. Gate 4: Zero Alert Overlap & Per-Actor Containment Gate
  let nonNumericAlertOverlapCount = 0;
  let numericAlertOverlapWarnings = 0;
  let minActorContainmentRatio = 1.0;

  for (const kf of input.keyframes) {
    if (kf.minFrameActorContainmentRatio < minActorContainmentRatio) {
      minActorContainmentRatio = kf.minFrameActorContainmentRatio;
    }
    const actorBoxes = collectFrameActorScreenBoxes(kf, input.actionRoi);
    for (const box of actorBoxes) {
      const ratio = computeActorContainmentRatio(box, kf.roiRect);
      if (ratio < minActorContainmentRatio) {
        minActorContainmentRatio = Number(ratio.toFixed(4));
      }
    }

    const alerts = kf.alerts;
    for (let a = 0; a < alerts.length; a++) {
      for (let b = a + 1; b < alerts.length; b++) {
        const alA = alerts[a]!;
        const alB = alerts[b]!;
        const paddedA: ScreenRect = {
          x: alA.screenBounds.x,
          y: alA.screenBounds.y - 2,
          width: alA.screenBounds.width,
          height: alA.screenBounds.height + 4,
        };
        const paddedB: ScreenRect = {
          x: alB.screenBounds.x,
          y: alB.screenBounds.y - 2,
          width: alB.screenBounds.width,
          height: alB.screenBounds.height + 4,
        };
        if (computeRectIntersectionArea(paddedA, paddedB) > 0) {
          if (!alA.isNumericOnly && !alB.isNumericOnly) {
            nonNumericAlertOverlapCount += 1;
          } else {
            numericAlertOverlapWarnings += 1;
            warnings.push(
              `[${kf.frameLabel}] Numeric/text alert overlap between "${alA.label}" and "${alB.label}"`,
            );
          }
        }
      }
    }
  }

  const gate4Passed =
    nonNumericAlertOverlapCount === 0 &&
    minActorContainmentRatio >= thresholds.minActorContainmentRatio;
  let gate4Reason = 'OK';
  if (nonNumericAlertOverlapCount > 0) {
    gate4Reason = `Detected ${nonNumericAlertOverlapCount} text-on-text floating alert overlap(s)`;
  } else if (minActorContainmentRatio < thresholds.minActorContainmentRatio) {
    gate4Reason = `minActorContainmentRatio (${minActorContainmentRatio.toFixed(3)}) < threshold (${thresholds.minActorContainmentRatio})`;
  }
  if (!gate4Passed) {
    failedGates.push('gate4AlertOverlapAndContainment');
  }

  // 5. Gate 5: Net Kinematic Displacement Gate (world px)
  const applicable =
    input.requiresNetDisplacement ?? isPhysicsDisplacementScene(input.sceneId);
  const requiredMinWorldPx =
    input.actionRoi?.minNetWorldDisplacementPx ?? thresholds.minNetWorldDisplacementPx;

  let maxNetWorldDisplacementPx = 0;
  const f1Actors = new Map<string, { x: number; y: number }>();
  for (const actor of input.keyframes[0]?.actors ?? []) {
    if (actor.kind === 'enemy' || actor.kind === 'prop' || actor.kind === 'player') {
      f1Actors.set(actor.actorKey, { x: actor.worldX, y: actor.worldY });
    }
  }
  for (let k = 1; k < input.keyframes.length; k++) {
    for (const actor of input.keyframes[k]?.actors ?? []) {
      const origin = f1Actors.get(actor.actorKey);
      if (origin) {
        const dist = Math.hypot(actor.worldX - origin.x, actor.worldY - origin.y);
        if (dist > maxNetWorldDisplacementPx) {
          maxNetWorldDisplacementPx = dist;
        }
      }
    }
  }
  // Include terminal positions from ring_out / wall_slam / entity_killed events if enemy was removed
  for (const ev of input.emittedSimEvents) {
    if (
      (ev.simEventKind === 'ring_out' ||
        ev.simEventKind === 'wall_slam' ||
        ev.simEventKind === 'entity_killed') &&
      typeof ev.x === 'number' &&
      typeof ev.y === 'number'
    ) {
      const enemyId = ev.eventPayload?.['enemyId'] ?? ev.eventPayload?.['entityId'];
      if (enemyId !== undefined) {
        const origin = f1Actors.get(`enemy:${String(enemyId)}`);
        if (origin) {
          const dist = Math.hypot(ev.x - origin.x, ev.y - origin.y);
          if (dist > maxNetWorldDisplacementPx) {
            maxNetWorldDisplacementPx = dist;
          }
        }
      }
    }
  }

  maxNetWorldDisplacementPx = Number(maxNetWorldDisplacementPx.toFixed(2));
  const gate5Passed = !applicable || maxNetWorldDisplacementPx >= requiredMinWorldPx;
  const gate5Reason = gate5Passed
    ? 'OK'
    : `maxNetWorldDisplacementPx (${maxNetWorldDisplacementPx} world px) < required (${requiredMinWorldPx} world px)`;
  if (!gate5Passed) {
    failedGates.push('gate5NetDisplacement');
  }

  const passed = failedGates.length === 0;
  const result: AnimationGatesEvaluationResult = {
    passed,
    mode,
    failedGates,
    warnings,
    gates: {
      gate1ApexEvent: {
        passed: gate1Passed,
        preF1Clean,
        matchedTick,
        heroTick,
        apexTickDelta,
        toleranceTicks,
        reason: gate1Reason,
      },
      gate2StateIntegrityAndVelocity: {
        passed: gate2Passed,
        externalMutationCount,
        maxInSimStepWorldPx,
        reason: gate2Reason,
      },
      gate3StageActivityAndPixelDiff: {
        passed: gate3Passed,
        frozenSteps,
        minActiveStepChangedPixels,
        reason: gate3Reason,
      },
      gate4AlertOverlapAndContainment: {
        passed: gate4Passed,
        nonNumericAlertOverlapCount,
        numericAlertOverlapWarnings,
        minActorContainmentRatio,
        reason: gate4Reason,
      },
      gate5NetDisplacement: {
        passed: gate5Passed,
        applicable,
        maxNetWorldDisplacementPx,
        requiredMinWorldPx,
        reason: gate5Reason,
      },
    },
  };

  if (mode === 'HARD_ASSERT' && options?.throwOnFail && !passed) {
    const details = [
      !gate1Passed ? `Gate 1 (Apex Event): ${gate1Reason}` : null,
      !gate2Passed ? `Gate 2 (State Integrity & Velocity): ${gate2Reason}` : null,
      !gate3Passed ? `Gate 3 (Stage Activity & Pixel Diff): ${gate3Reason}` : null,
      !gate4Passed ? `Gate 4 (Alert Overlap & Containment): ${gate4Reason}` : null,
      !gate5Passed ? `Gate 5 (Net Kinematic Displacement): ${gate5Reason}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
    throw new Error(`[AnimationGates HARD_ASSERT Failed for ${input.sceneId}] ${details}`);
  }

  return result;
}

export function formatTelemetrySummaryMarkdown(
  input: AnimationGatesInput,
  evalResult: AnimationGatesEvaluationResult,
  roiMode: RoiResolutionMode,
): string {
  const g = evalResult.gates;
  const lines: string[] = [
    `# Telemetry Summary: \`${input.sceneId}\``,
    ``,
    `- **Frames:** \`${input.frameCount}\` | **Hero Frame:** \`F${input.heroFrameIndex + 1}\` (index \`${input.heroFrameIndex}\`) | **ROI Mode:** \`${roiMode}\` | **Mode:** \`${evalResult.mode}\` | **Verdict:** **${evalResult.passed ? 'PASS' : 'FAIL'}**`,
    `- **Gate 1 (Apex Event):** ${g.gate1ApexEvent.passed ? 'PASS' : 'FAIL'} (heroTick=${g.gate1ApexEvent.heroTick}, matchedTick=${g.gate1ApexEvent.matchedTick ?? 'none'}, delta=${g.gate1ApexEvent.apexTickDelta ?? 'N/A'}, preF1Clean=${g.gate1ApexEvent.preF1Clean}) — ${g.gate1ApexEvent.reason}`,
    `- **Gate 2 (State Integrity):** ${g.gate2StateIntegrityAndVelocity.passed ? 'PASS' : 'FAIL'} (externalMutations=${g.gate2StateIntegrityAndVelocity.externalMutationCount}, maxStepWorldPx=${g.gate2StateIntegrityAndVelocity.maxInSimStepWorldPx.toFixed(1)}) — ${g.gate2StateIntegrityAndVelocity.reason}`,
    `- **Gate 3 (Stage Activity):** ${g.gate3StageActivityAndPixelDiff.passed ? 'PASS' : 'FAIL'} (minActiveChangedPx=${g.gate3StageActivityAndPixelDiff.minActiveStepChangedPixels}) — ${g.gate3StageActivityAndPixelDiff.reason}`,
    `- **Gate 4 (Alerts & Containment):** ${g.gate4AlertOverlapAndContainment.passed ? 'PASS' : 'FAIL'} (textOverlaps=${g.gate4AlertOverlapAndContainment.nonNumericAlertOverlapCount}, minContainment=${g.gate4AlertOverlapAndContainment.minActorContainmentRatio.toFixed(3)}) — ${g.gate4AlertOverlapAndContainment.reason}`,
    `- **Gate 5 (Net Displacement):** ${g.gate5NetDisplacement.passed ? 'PASS' : 'FAIL'} (maxNetWorldPx=${g.gate5NetDisplacement.maxNetWorldDisplacementPx}px) — ${g.gate5NetDisplacement.reason}`,
    ``,
    `| Frame | Tick (Δt) | Stage | HitStop | Player State | Target ΔPos | Active Alerts | ROI Δpx | Containment |`,
    `| :--- | :---: | :---: | :---: | :--- | :--- | :--- | :---: | :---: |`,
  ];

  for (const kf of input.keyframes) {
    const heroBadge = kf.frameIndex === input.heroFrameIndex ? ' ★ HERO' : '';
    const alertsStr =
      kf.alerts.length > 0 ? kf.alerts.map((a) => `"${a.label}"`).join(', ') : '-';
    lines.push(
      `| **${kf.frameLabel}${heroBadge}** | \`${kf.simTick} (+${kf.deltaTicks}t)\` | \`${kf.stage}\` | \`${kf.hitStopActive ? 'YES' : 'no'}\` | ${kf.playerStateSummary} | ${kf.targetDeltaPosSummary} | ${alertsStr} | \`${kf.changedScreenPixels}\` | \`${kf.minFrameActorContainmentRatio.toFixed(2)}\` |`,
    );
  }

  return lines.join('\n') + '\n';
}
