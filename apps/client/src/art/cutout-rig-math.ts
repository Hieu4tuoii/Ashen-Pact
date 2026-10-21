import { dampLerp } from './easing.js';
import type { EntityRigDef, RigPartDef, RigPartId } from './rig-defs.js';

export type RigAnimState =
  | 'idle'
  | 'run'
  | 'attack'
  | 'hurt'
  | 'dash'
  | 'cast'
  | 'downed'
  | 'revive';

export const STATE_CROSSFADE_DURATION_SEC = 0.12;

const ALL_PART_IDS: readonly RigPartId[] = [
  'backAccessory',
  'legLeft',
  'legRight',
  'torso',
  'head',
  'armLeft',
  'weapon',
  'armRight',
];

export interface PartTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface RigPoseSnapshot {
  bodyY: number;
  bodyScaleX: number;
  bodyScaleY: number;
  bodyRotation: number;
  shadowScale: number;
  eyeBlinkScaleY: number;
  parts: Record<RigPartId, PartTransform>;
}

export interface StateCrossfadeController {
  currentState: RigAnimState;
  prevState: RigAnimState;
  crossfadeElapsedSec: number;
  crossfadeDurationSec: number;
  fromPose: RigPoseSnapshot | null;
}

export interface BackAccessorySpringState {
  angle: number;
  angularVel: number;
  offsetX: number;
  velX: number;
  offsetY: number;
  velY: number;
}

export interface WeaponRecoilSpringState {
  displacement: number;
  velocity: number;
  angleKick: number;
  angularVel: number;
}

export interface EnemyArchetypeMotionModifiers {
  scaleXMult: number;
  scaleYMult: number;
  bodyYOffset: number;
  telegraphTorsoRotOffset: number;
  telegraphArmRaiseOffset: number;
  cadenceMult: number;
  strideBounceMult: number;
}

export interface EvaluateRigPoseParams {
  def: EntityRigDef;
  animState: RigAnimState;
  animTime: number;
  localAim: number;
  moveLeanRad: number;
  recoilSpring: WeaponRecoilSpringState;
  backSpring: BackAccessorySpringState;
  meleeSwingOffsetRad: number;
  telegraphProgress: number;
  reviveProgress: number;
  phaseSeed: number;
}

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function smoothstep01(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

export function createStateCrossfadeController(
  initialState: RigAnimState = 'idle',
): StateCrossfadeController {
  return {
    currentState: initialState,
    prevState: initialState,
    crossfadeElapsedSec: STATE_CROSSFADE_DURATION_SEC,
    crossfadeDurationSec: STATE_CROSSFADE_DURATION_SEC,
    fromPose: null,
  };
}

export function cloneRigPoseSnapshot(pose: RigPoseSnapshot): RigPoseSnapshot {
  const parts = {} as Record<RigPartId, PartTransform>;
  for (const id of ALL_PART_IDS) parts[id] = { ...pose.parts[id] };
  return { ...pose, parts };
}

export function transitionRigAnimState(
  ctrl: StateCrossfadeController,
  nextState: RigAnimState,
  currentBlendedPose: RigPoseSnapshot,
): void {
  if (nextState === ctrl.currentState) return;
  ctrl.fromPose = cloneRigPoseSnapshot(currentBlendedPose);
  ctrl.prevState = ctrl.currentState;
  ctrl.currentState = nextState;
  ctrl.crossfadeElapsedSec = 0;
}

export function stepStateCrossfade(ctrl: StateCrossfadeController, dtSec: number): number {
  if (!ctrl.fromPose) return 1;
  ctrl.crossfadeElapsedSec = Math.min(
    ctrl.crossfadeDurationSec,
    ctrl.crossfadeElapsedSec + Math.max(0, dtSec),
  );
  const rawT =
    ctrl.crossfadeDurationSec > 0 ? ctrl.crossfadeElapsedSec / ctrl.crossfadeDurationSec : 1;
  return smoothstep01(rawT);
}

export function blendRigPoseSnapshots(
  fromPose: RigPoseSnapshot,
  toPose: RigPoseSnapshot,
  alpha01: number,
): RigPoseSnapshot {
  const t = clamp(alpha01, 0, 1);
  if (t <= 0) return cloneRigPoseSnapshot(fromPose);
  if (t >= 1) return cloneRigPoseSnapshot(toPose);

  const parts = {} as Record<RigPartId, PartTransform>;
  for (const id of ALL_PART_IDS) {
    const a = fromPose.parts[id];
    const b = toPose.parts[id];
    parts[id] = {
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      rotation: lerpAngle(a.rotation, b.rotation, t),
      scaleX: lerp(a.scaleX, b.scaleX, t),
      scaleY: lerp(a.scaleY, b.scaleY, t),
    };
  }
  return {
    bodyY: lerp(fromPose.bodyY, toPose.bodyY, t),
    bodyScaleX: lerp(fromPose.bodyScaleX, toPose.bodyScaleX, t),
    bodyScaleY: lerp(fromPose.bodyScaleY, toPose.bodyScaleY, t),
    bodyRotation: lerpAngle(fromPose.bodyRotation, toPose.bodyRotation, t),
    shadowScale: lerp(fromPose.shadowScale, toPose.shadowScale, t),
    eyeBlinkScaleY: lerp(fromPose.eyeBlinkScaleY, toPose.eyeBlinkScaleY, t),
    parts,
  };
}

export function computeTargetTorsoLean(moveDirX: number): number {
  return clamp(moveDirX, -1, 1) * 0.16;
}

export function stepTorsoMoveLean(currentLeanRad: number, moveDirX: number, dtSec: number): number {
  return dampLerp(currentLeanRad, computeTargetTorsoLean(moveDirX), 14, Math.max(0, dtSec));
}

export function computeEyeBlinkPeriodSec(phaseSeed = 0): number {
  const hash = Math.abs(Math.sin(phaseSeed * 12.9898 + 4.1414) * 43758.5453) % 1;
  return 3.4 + hash * 1.2;
}

export function computeEyeBlinkScaleY(animTime: number, phaseSeed = 0): number {
  const period = computeEyeBlinkPeriodSec(phaseSeed);
  const blinkDuration = 0.11;
  const blinkStart = 1.12 + ((Math.abs(Math.sin(phaseSeed * 7.13 + 1.37) * 1000) % 1) * 0.32);
  const cycleTime = ((animTime % period) + period) % period;
  if (cycleTime < blinkStart || cycleTime > blinkStart + blinkDuration) return 1.0;
  const u = (cycleTime - blinkStart) / blinkDuration;
  return Math.max(0.08, 1.0 - Math.sin(u * Math.PI) * 0.92);
}

export function computeHeadAimOffset(localAim: number): {
  offsetX: number;
  offsetY: number;
  rotation: number;
} {
  return {
    offsetX: Math.cos(localAim) * 1.35,
    offsetY: Math.sin(localAim) * 0.72,
    rotation: Math.sin(localAim) * 0.12,
  };
}

export function createBackAccessorySpringState(): BackAccessorySpringState {
  return { angle: 0, angularVel: 0, offsetX: 0, velX: 0, offsetY: 0, velY: 0 };
}

function stepSpringScalar(
  pos: number,
  vel: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): [number, number] {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const subDt = dt / steps;
  let p = pos;
  let v = vel;
  for (let i = 0; i < steps; i++) {
    v += ((target - p) * stiffness - v * damping) * subDt;
    p += v * subDt;
  }
  return [p, v];
}

export function stepBackAccessorySpring(
  state: BackAccessorySpringState,
  params: {
    moveVx: number;
    moveVy: number;
    bodyBounceVelY: number;
    facingSign: number;
    isDashing: boolean;
    animState: RigAnimState;
    dtSec: number;
  },
): BackAccessorySpringState {
  const dt = clamp(params.dtSec, 0, 0.05);
  if (dt <= 0) return state;

  const localVx = params.moveVx * (params.facingSign >= 0 ? 1 : -1);
  const normVx = clamp(localVx / 160, -1.5, 1.5);
  const normVy = clamp((params.moveVy + params.bodyBounceVelY) / 140, -1.5, 1.5);
  const dashBoost = params.isDashing || params.animState === 'dash' ? 1.45 : 1.0;
  const runBias = params.animState === 'run' || Math.abs(normVx) > 0.08 ? -0.9 : 0;

  const targetOffsetX = clamp((-normVx * 2.1 + runBias) * dashBoost, -4.2, 2.2);
  const targetOffsetY = clamp(-normVy * 1.4 - Math.abs(normVx) * 0.45, -2.6, 2.2);
  const targetAngle = clamp(
    (-normVx * 0.24 + runBias * 0.14 - normVy * 0.08) * dashBoost,
    -0.52,
    0.34,
  );

  const [angle, angularVel] = stepSpringScalar(state.angle, state.angularVel, targetAngle, 155, 10.5, dt);
  const [offsetX, velX] = stepSpringScalar(state.offsetX, state.velX, targetOffsetX, 155, 10.5, dt);
  const [offsetY, velY] = stepSpringScalar(state.offsetY, state.velY, targetOffsetY, 155, 10.5, dt);
  return { angle, angularVel, offsetX, velX, offsetY, velY };
}

export function createWeaponRecoilSpringState(): WeaponRecoilSpringState {
  return { displacement: 0, velocity: 0, angleKick: 0, angularVel: 0 };
}

export function triggerWeaponRecoilImpulse(
  state: WeaponRecoilSpringState,
  strength = 5,
): WeaponRecoilSpringState {
  const kick = clamp(strength, 1, 10);
  return {
    displacement: Math.min(8.5, state.displacement + kick * 0.85),
    velocity: 18 * (kick / 5),
    angleKick: Math.max(-0.38, state.angleKick - 0.16 * (kick / 5)),
    angularVel: -1.8 * (kick / 5),
  };
}

export function stepWeaponRecoilSpring(
  state: WeaponRecoilSpringState,
  dtSec: number,
): WeaponRecoilSpringState {
  const dt = clamp(dtSec, 0, 0.05);
  if (dt <= 0) return state;
  const [displacement, velocity] = stepSpringScalar(state.displacement, state.velocity, 0, 240, 17, dt);
  const [angleKick, angularVel] = stepSpringScalar(state.angleKick, state.angularVel, 0, 220, 16, dt);
  return { displacement, velocity, angleKick, angularVel };
}

export function computeEnemyArchetypeMotion(
  rigId: string,
  animState: RigAnimState,
  animTime: number,
  telegraphProgress: number,
): EnemyArchetypeMotionModifiers {
  let scaleXMult = 1;
  let scaleYMult = 1;
  let bodyYOffset = 0;
  let telegraphTorsoRotOffset = 0;
  let telegraphArmRaiseOffset = 0;
  let cadenceMult = 1;
  let strideBounceMult = 1;

  if (rigId === 'green_slime' || rigId === 'mini_slime') {
    const jellyWave = Math.sin(animTime * 6.5);
    scaleXMult = 1 + jellyWave * 0.09;
    scaleYMult = 1 - jellyWave * 0.09;
    bodyYOffset = -Math.abs(Math.sin(animTime * 3.25)) * 1.8;
  } else if (rigId === 'frost_bat' || rigId === 'snow_spirit' || rigId === 'welder_drone') {
    bodyYOffset = -3.2 + Math.sin(animTime * 5.8) * 1.4;
    cadenceMult = 1.25;
    strideBounceMult = 0.45;
  } else if (
    rigId === 'coal_golem' ||
    rigId === 'ice_golem' ||
    rigId === 'iron_shielder' ||
    rigId === 'forge_titan' ||
    rigId === 'spore_king'
  ) {
    cadenceMult = 0.76;
    strideBounceMult = 1.22;
    if (animState === 'idle') {
      const heavyBreath = Math.sin(animTime * 2.8);
      scaleXMult = 1 + heavyBreath * 0.025;
      scaleYMult = 1 - heavyBreath * 0.025;
    }
  }

  if (telegraphProgress > 0) {
    const tp = clamp(telegraphProgress, 0, 1);
    if (rigId === 'spore_bomber' || rigId === 'snow_spirit') {
      const swell = Math.sin(animTime * 28) * 0.08 + tp * 0.22;
      scaleXMult *= 1 + swell;
      scaleYMult *= 1 + swell;
    } else {
      scaleXMult *= 1 + tp * 0.11;
      scaleYMult *= 1 - tp * 0.13;
      telegraphTorsoRotOffset = -tp * 0.24;
      telegraphArmRaiseOffset = -tp * 3.2;
    }
  }

  return {
    scaleXMult,
    scaleYMult,
    bodyYOffset,
    telegraphTorsoRotOffset,
    telegraphArmRaiseOffset,
    cadenceMult,
    strideBounceMult,
  };
}

function addPartOffset(p: PartTransform, dx: number, dy: number, rot: number, sx = 1, sy = 1): void {
  p.x += dx;
  p.y += dy;
  p.rotation = rot;
  p.scaleX = sx;
  p.scaleY = sy;
}

export function evaluateRigPose(params: EvaluateRigPoseParams): RigPoseSnapshot {
  const {
    def,
    animState,
    animTime,
    localAim,
    moveLeanRad,
    recoilSpring,
    backSpring,
    meleeSwingOffsetRad,
    telegraphProgress,
    reviveProgress,
    phaseSeed,
  } = params;

  const partMap = new Map<RigPartId, RigPartDef>();
  for (const p of def.parts) partMap.set(p.id, p);
  const getBase = (id: RigPartId): PartTransform => {
    const d = partMap.get(id);
    return { x: d?.offsetX ?? 0, y: d?.offsetY ?? 0, rotation: 0, scaleX: 1, scaleY: 1 };
  };
  const parts: Record<RigPartId, PartTransform> = {
    backAccessory: getBase('backAccessory'),
    legLeft: getBase('legLeft'),
    legRight: getBase('legRight'),
    torso: getBase('torso'),
    head: getBase('head'),
    armLeft: getBase('armLeft'),
    weapon: getBase('weapon'),
    armRight: getBase('armRight'),
  };

  const arch = computeEnemyArchetypeMotion(def.id, animState, animTime, telegraphProgress);
  const eyeBlinkScaleY = computeEyeBlinkScaleY(animTime, phaseSeed);
  const headAim = computeHeadAimOffset(localAim);
  const cosAim = Math.cos(localAim);
  const sinAim = Math.sin(localAim);
  const recoilX = -cosAim * recoilSpring.displacement;
  const recoilY = -sinAim * recoilSpring.displacement;
  const weaponAimRot = localAim + recoilSpring.angleKick + meleeSwingOffsetRad;

  let bodyY = arch.bodyYOffset;
  let bodyScaleX = arch.scaleXMult;
  let bodyScaleY = arch.scaleYMult;
  let bodyRotation = 0;
  let shadowScale = 1;

  const omegaIdle = (Math.PI * 2) / 1.6;
  const sIdle = Math.sin(animTime * omegaIdle);
  const sIdleDelayed = Math.sin(animTime * omegaIdle - 0.4);

  if (animState === 'idle') {
    shadowScale = 1 - sIdle * 0.03;
    addPartOffset(parts.torso, 0, sIdle * 1.2, moveLeanRad * 0.6 + arch.telegraphTorsoRotOffset, 1 - sIdle * 0.02, 1 + sIdle * 0.03);
    addPartOffset(parts.head, headAim.offsetX, sIdleDelayed * 1.5 + headAim.offsetY + (1 - eyeBlinkScaleY) * 0.85, headAim.rotation + moveLeanRad * 0.35, 1, 1 - (1 - eyeBlinkScaleY) * 0.1);
    addPartOffset(parts.armLeft, 0, sIdle * 0.9 + arch.telegraphArmRaiseOffset, sIdle * 0.06 - arch.telegraphTorsoRotOffset * 0.6);
    addPartOffset(parts.backAccessory, backSpring.offsetX, sIdleDelayed * 1.0 + backSpring.offsetY, sIdleDelayed * 0.04 + backSpring.angle);
    addPartOffset(parts.weapon, recoilX, sIdle * 0.8 + recoilY, weaponAimRot + sIdle * 0.03);
    addPartOffset(parts.armRight, cosAim * 1.1 + recoilX * 0.72, sIdle * 0.8 + sinAim * 0.9 + recoilY * 0.72 + arch.telegraphArmRaiseOffset, localAim * 0.82 + meleeSwingOffsetRad * 0.78 + recoilSpring.angleKick * 0.65);
  } else if (animState === 'run') {
    const phase = animTime * ((Math.PI * 2) / 0.38) * arch.cadenceMult;
    const swing = Math.sin(phase);
    const bounce = -Math.abs(Math.sin(phase)) * 3.2 * arch.strideBounceMult;
    const squash = Math.cos(phase * 2);
    bodyY += bounce;
    shadowScale = 1 + bounce * 0.025;
    addPartOffset(parts.torso, 0, 0, 0.12 + moveLeanRad + arch.telegraphTorsoRotOffset, 1 - squash * 0.04, 1 + squash * 0.05);
    addPartOffset(parts.head, 1.0 + headAim.offsetX, Math.sin(phase - 0.3) * 1.1 + headAim.offsetY + (1 - eyeBlinkScaleY) * 0.75, 0.05 + Math.sin(phase) * 0.05 + headAim.rotation + moveLeanRad * 0.35, 1, 1 - (1 - eyeBlinkScaleY) * 0.09);
    addPartOffset(parts.legLeft, -swing * 2.5, -Math.max(0, swing) * 1.9, swing * 0.56);
    addPartOffset(parts.legRight, swing * 2.5, -Math.max(0, -swing) * 1.9, -swing * 0.56);
    addPartOffset(parts.armLeft, swing * 1.5, arch.telegraphArmRaiseOffset, -swing * 0.34);
    addPartOffset(parts.backAccessory, -1.4 + backSpring.offsetX, backSpring.offsetY, -0.16 + Math.sin(phase - 0.5) * 0.14 + backSpring.angle);
    addPartOffset(parts.weapon, -swing * 1.0 + recoilX, recoilY, weaponAimRot - swing * 0.08);
    addPartOffset(parts.armRight, -swing * 0.9 + cosAim * 1.1 + recoilX * 0.72, sinAim * 0.9 + recoilY * 0.72, localAim * 0.82 - swing * 0.1 + meleeSwingOffsetRad * 0.78 + recoilSpring.angleKick * 0.65);
  } else if (animState === 'attack') {
    const pulse = Math.sin(animTime * 16) * 0.5 + 0.5;
    const thrustDist = 3.6 + pulse * 1.2;
    bodyY += -0.8;
    bodyScaleX *= 1.05;
    bodyScaleY *= 0.96;
    addPartOffset(parts.torso, 1.4, 0, 0.21 + pulse * 0.05 + moveLeanRad);
    addPartOffset(parts.head, 1.6 + headAim.offsetX, headAim.offsetY, 0.09 + headAim.rotation);
    addPartOffset(parts.legLeft, -1.8, 0, 0.28);
    addPartOffset(parts.legRight, 2.0, 0, -0.26);
    addPartOffset(parts.armLeft, -2.2, 0.6, -0.42);
    addPartOffset(parts.backAccessory, -2.0 + backSpring.offsetX, backSpring.offsetY, -0.28 + backSpring.angle);
    addPartOffset(parts.weapon, cosAim * thrustDist + recoilX, sinAim * thrustDist + recoilY, weaponAimRot + 0.08);
    addPartOffset(parts.armRight, cosAim * (thrustDist * 0.78) + recoilX * 0.75, sinAim * (thrustDist * 0.78) + recoilY * 0.75, localAim * 0.92 + meleeSwingOffsetRad * 0.85 + 0.1);
  } else if (animState === 'hurt') {
    const shudder = Math.sin(animTime * 34) * 0.6;
    bodyY += -0.6;
    bodyScaleX *= 0.94;
    bodyScaleY *= 1.07;
    addPartOffset(parts.torso, -3.2 + shudder, 0.8, -0.24);
    addPartOffset(parts.head, -3.8 + shudder, -1.0, -0.28);
    addPartOffset(parts.legLeft, -0.8, 0, -0.18);
    addPartOffset(parts.legRight, 1.2, 0, 0.22);
    addPartOffset(parts.armLeft, -2.4, -1.8, -0.52);
    addPartOffset(parts.armRight, -2.0, -1.4, -0.38);
    addPartOffset(parts.weapon, -2.2, -1.2, localAim - 0.35);
    addPartOffset(parts.backAccessory, 1.2 + backSpring.offsetX, 0, 0.22 + backSpring.angle);
  } else if (animState === 'dash') {
    bodyY += -1.8;
    bodyScaleX *= 1.16;
    bodyScaleY *= 0.86;
    shadowScale = 0.88;
    addPartOffset(parts.torso, 2.2, 0, 0.28 + Math.max(0, moveLeanRad));
    addPartOffset(parts.head, 2.6 + headAim.offsetX, 0.6 + headAim.offsetY, 0.14 + headAim.rotation);
    addPartOffset(parts.legLeft, -3.2, -1.4, 0.62);
    addPartOffset(parts.legRight, -2.2, -1.0, 0.46);
    addPartOffset(parts.armLeft, -2.6, 0.8, 0.48);
    addPartOffset(parts.backAccessory, -3.0 + backSpring.offsetX, -0.8 + backSpring.offsetY, -0.42 + backSpring.angle);
    addPartOffset(parts.weapon, 1.8 + recoilX, 0.4 + recoilY, weaponAimRot + 0.12);
    addPartOffset(parts.armRight, 1.5 + cosAim * 1.2, 0.4 + sinAim * 0.8, localAim * 0.88 + 0.14);
  } else if (animState === 'cast') {
    const hoverWave = Math.sin(animTime * 8);
    bodyY += -2.8 + hoverWave * 0.8;
    bodyScaleX *= 0.97;
    bodyScaleY *= 1.05;
    shadowScale = 0.84;
    addPartOffset(parts.torso, 0, -1.2, -0.06 + moveLeanRad * 0.4);
    addPartOffset(parts.head, headAim.offsetX * 0.8, -1.6, -0.1 + headAim.rotation * 0.6);
    addPartOffset(parts.legLeft, 0, 0.8, 0.14);
    addPartOffset(parts.legRight, 0, 1.2, 0.22);
    addPartOffset(parts.armLeft, -1.2, -4.2 + hoverWave * 0.5, -0.74);
    addPartOffset(parts.armRight, 1.2, -4.2 + hoverWave * 0.5, -0.68);
    addPartOffset(parts.weapon, 0.8, -4.6 + hoverWave * 0.6, -0.58 + hoverWave * 0.08);
    addPartOffset(parts.backAccessory, 0, -1.2 + backSpring.offsetY, -0.18 + hoverWave * 0.1 + backSpring.angle);
  } else if (animState === 'downed') {
    const weakBreath = Math.sin(animTime * 2.4);
    bodyY += 2.2;
    bodyScaleX *= 1.06;
    bodyScaleY *= 0.74;
    bodyRotation = 0.34;
    shadowScale = 1.12;
    addPartOffset(parts.torso, 0, 2.4 + weakBreath * 0.4, 0.26);
    addPartOffset(parts.head, 1.4, 3.2 + weakBreath * 0.5, 0.32);
    addPartOffset(parts.legLeft, -1.6, 0, 0.42);
    addPartOffset(parts.legRight, 1.0, 0, -0.28);
    addPartOffset(parts.armLeft, 0, 2.2, 0.35);
    addPartOffset(parts.armRight, 0, 2.4, 0.28);
    addPartOffset(parts.weapon, 0, 3.0, 0.45);
  } else if (animState === 'revive') {
    const p = clamp(reviveProgress, 0, 1);
    const pulse = Math.sin(animTime * 10) * 0.4;
    bodyY += -1.8 - p * 1.6 + pulse;
    bodyScaleX *= 0.96;
    bodyScaleY *= 0.88 + p * 0.16;
    bodyRotation = (1 - p) * 0.14;
    shadowScale = 0.92;
    addPartOffset(parts.torso, 0, -1.0 - p * 1.2, -0.05);
    addPartOffset(parts.head, 0, -1.4 - p * 1.2, -0.12);
    addPartOffset(parts.armLeft, 0, -2.4 - p * 1.8, -0.48);
    addPartOffset(parts.armRight, 0, -2.4 - p * 1.8, -0.45);
    addPartOffset(parts.weapon, 0, -2.2 - p * 1.5, localAim * 0.5 - 0.3);
  }

  return { bodyY, bodyScaleX, bodyScaleY, bodyRotation, shadowScale, eyeBlinkScaleY, parts };
}
