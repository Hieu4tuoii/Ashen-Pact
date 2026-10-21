import { type CardinalDir, clamp, type RoomType } from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { ENV_PALETTE, hexToNum } from '../art/palette.js';

export const PORTAL_VORTEX_PIPELINE_KEY = 'PortalVortexPipeline';
export const DOOR_BARRIER_PIPELINE_KEY = 'DoorBarrierPipeline';
export const PORTAL_BURST_DURATION_SEC = 0.72;
export const PORTAL_ENTER_DURATION_SEC = 0.3;
export const DOOR_UNLOCK_DISSOLVE_DURATION_SEC = 0.38;
export const DOOR_COMBAT_LOCKUP_DURATION_SEC = 0.25;

export type PortalVisualMode =
  | 'hidden'
  | 'dungeon_inactive'
  | 'dungeon_active'
  | 'hub_waiting'
  | 'hub_ready';

export interface ResolvePortalVisualStateParams {
  inHub: boolean;
  hubReady: boolean;
  portalActive: boolean;
  roomType: RoomType;
  quality: 'high' | 'medium' | 'low';
  elapsedSec?: number;
  burstProgress?: number;
}

export interface PortalVisualState {
  visible: boolean;
  mode: PortalVisualMode;
  useShader: boolean;
  outerColorHex: string;
  outerColorNum: number;
  outerRgb: readonly [number, number, number];
  coreColorHex: string;
  coreColorNum: number;
  coreRgb: readonly [number, number, number];
  rimColorHex: string;
  rimColorNum: number;
  rimRgb: readonly [number, number, number];
  runeTintNum: number;
  runeAlpha: number;
  spinSpeedRadPerSec: number;
  coreSpinSpeedRadPerSec: number;
  activityLevel: number;
  pulseIntensity: number;
  burstProgress: number;
  vortexAlpha: number;
  vortexScale: number;
  particleCount: number;
  rayCount: number;
}

export interface PortalShaderUniformState {
  time: number;
  spinSpeed: number;
  activity: number;
  pulse: number;
  burstProgress: number;
  outerRgb: readonly [number, number, number];
  coreRgb: readonly [number, number, number];
  rimRgb: readonly [number, number, number];
}

export type PortalShaderSprite = Phaser.GameObjects.Sprite & {
  __portalUniforms?: PortalShaderUniformState;
};

export interface DoorShaderUniformState {
  time: number;
  lockupProgress: number;
  dissolveProgress: number;
  isVertical: number;
  primaryRgb: readonly [number, number, number];
  rimRgb: readonly [number, number, number];
}

export type DoorShaderSprite = Phaser.GameObjects.Sprite & {
  __doorUniforms?: DoorShaderUniformState;
};

function hexToRgbTuple(hex: string): readonly [number, number, number] {
  const num = hexToNum(hex);
  return [((num >> 16) & 0xff) / 255, ((num >> 8) & 0xff) / 255, (num & 0xff) / 255] as const;
}

interface PortalPreset {
  visible: boolean;
  mode: PortalVisualMode;
  useShader: boolean;
  outerColorHex: string;
  coreColorHex: string;
  rimColorHex: string;
  runeTintNum: number;
  runeAlpha: number;
  spinSpeedRadPerSec: number;
  coreSpinSpeedRadPerSec: number;
  activityLevel: number;
  pulseIntensity: number;
  burstProgress: number;
  vortexAlpha: number;
  vortexScale: number;
  particleCount: number;
  rayCount: number;
}

function buildPortalState(p: PortalPreset): PortalVisualState {
  return {
    ...p,
    outerColorNum: hexToNum(p.outerColorHex),
    outerRgb: hexToRgbTuple(p.outerColorHex),
    coreColorNum: hexToNum(p.coreColorHex),
    coreRgb: hexToRgbTuple(p.coreColorHex),
    rimColorNum: hexToNum(p.rimColorHex),
    rimRgb: hexToRgbTuple(p.rimColorHex),
  };
}

export function resolvePortalVisualState(
  params: ResolvePortalVisualStateParams,
): PortalVisualState {
  const {
    inHub,
    hubReady,
    portalActive,
    roomType,
    quality,
    elapsedSec = 1.0,
    burstProgress = 0,
  } = params;
  const clampedBurst = clamp(burstProgress, 0, 1);
  const pulseWave = 0.5 + 0.5 * Math.sin(elapsedSec * 3.2);
  const useShader = quality !== 'low';
  const activeParticles = quality === 'low' ? 0 : quality === 'medium' ? 8 : 12;
  const activeRays = quality === 'low' ? 0 : 4;

  if (!inHub && !portalActive && roomType !== 'portal') {
    return buildPortalState({
      visible: false,
      mode: 'hidden',
      useShader: false,
      outerColorHex: '#4C3D63',
      coreColorHex: '#6D5B87',
      rimColorHex: '#7E6B9B',
      runeTintNum: 0x7e6b9b,
      runeAlpha: 0,
      spinSpeedRadPerSec: 0,
      coreSpinSpeedRadPerSec: 0,
      activityLevel: 0,
      pulseIntensity: 0,
      burstProgress: 0,
      vortexAlpha: 0,
      vortexScale: 0,
      particleCount: 0,
      rayCount: 0,
    });
  }
  if (inHub && hubReady) {
    return buildPortalState({
      visible: true,
      mode: 'hub_ready',
      useShader,
      outerColorHex: '#F59E42',
      coreColorHex: '#FEF08A',
      rimColorHex: '#FACC15',
      runeTintNum: 0xfacc15,
      runeAlpha: clamp(0.88 + 0.1 * pulseWave, 0.78, 1.0),
      spinSpeedRadPerSec: 2.8,
      coreSpinSpeedRadPerSec: -4.1,
      activityLevel: 1.0,
      pulseIntensity: pulseWave,
      burstProgress: clampedBurst,
      vortexAlpha: 0.98,
      vortexScale: 1.02 + 0.04 * Math.sin(elapsedSec * 4.2),
      particleCount: activeParticles,
      rayCount: activeRays,
    });
  }
  if (inHub) {
    return buildPortalState({
      visible: true,
      mode: 'hub_waiting',
      useShader,
      outerColorHex: '#64748B',
      coreColorHex: '#38BDF8',
      rimColorHex: '#94A3B8',
      runeTintNum: 0x7dd3fc,
      runeAlpha: clamp(0.62 + 0.12 * pulseWave, 0.52, 0.78),
      spinSpeedRadPerSec: 1.4,
      coreSpinSpeedRadPerSec: -2.1,
      activityLevel: 0.68,
      pulseIntensity: pulseWave * 0.75,
      burstProgress: clampedBurst,
      vortexAlpha: 0.84,
      vortexScale: 0.96 + 0.025 * Math.sin(elapsedSec * 2.8),
      particleCount: quality === 'low' ? 0 : 6,
      rayCount: quality === 'low' ? 0 : 2,
    });
  }
  if (portalActive) {
    const burstBoost = clampedBurst > 0 ? Math.sin(clampedBurst * Math.PI) * 0.18 : 0;
    return buildPortalState({
      visible: true,
      mode: 'dungeon_active',
      useShader,
      outerColorHex: '#A855F7',
      coreColorHex: '#22D3EE',
      rimColorHex: '#CFFAFE',
      runeTintNum: 0xc084fc,
      runeAlpha: clamp(0.86 + 0.12 * pulseWave, 0.76, 1.0),
      spinSpeedRadPerSec: 2.6,
      coreSpinSpeedRadPerSec: -3.8,
      activityLevel: 1.0,
      pulseIntensity: pulseWave,
      burstProgress: clampedBurst,
      vortexAlpha: 0.96,
      vortexScale: 1.0 + 0.045 * Math.sin(elapsedSec * 4.0) + burstBoost,
      particleCount: activeParticles,
      rayCount: activeRays,
    });
  }
  return buildPortalState({
    visible: true,
    mode: 'dungeon_inactive',
    useShader,
    outerColorHex: '#4C3D63',
    coreColorHex: '#6D5B87',
    rimColorHex: '#7E6B9B',
    runeTintNum: 0x7e6b9b,
    runeAlpha: clamp(0.36 + 0.08 * pulseWave, 0.28, 0.48),
    spinSpeedRadPerSec: 0.65,
    coreSpinSpeedRadPerSec: -0.95,
    activityLevel: 0.35,
    pulseIntensity: pulseWave * 0.35,
    burstProgress: 0,
    vortexAlpha: 0.62,
    vortexScale: 0.91 + 0.015 * Math.sin(elapsedSec * 1.8),
    particleCount: quality === 'low' ? 0 : 4,
    rayCount: 0,
  });
}

export interface PortalAnimState {
  wasPortalActive: boolean;
  lastRoomKey: string;
  burstTimerSec: number;
  burstActive: boolean;
  pendingBurstTrigger: boolean;
  enterTimerSec: number;
  enterActive: boolean;
  enterStartX: number;
  enterStartY: number;
  enterTargetX: number;
  enterTargetY: number;
}

export interface PortalAnimStepResult {
  burstTriggered: boolean;
  burstProgress: number;
  shockwaveRadius: number;
  shockwaveAlpha: number;
  flashAlpha: number;
  enterActive: boolean;
  enterCompleted: boolean;
  enterProgress: number;
  playerX: number;
  playerY: number;
  playerScaleX: number;
  playerScaleY: number;
  playerRotationRad: number;
  playerAlpha: number;
  enterFlashAlpha: number;
}

export function createPortalAnimState(): PortalAnimState {
  return {
    wasPortalActive: false,
    lastRoomKey: '',
    burstTimerSec: 0,
    burstActive: false,
    pendingBurstTrigger: false,
    enterTimerSec: 0,
    enterActive: false,
    enterStartX: 0,
    enterStartY: 0,
    enterTargetX: 0,
    enterTargetY: 0,
  };
}

export function triggerPortalActivationBurstState(state: PortalAnimState): void {
  state.burstActive = true;
  state.burstTimerSec = 0;
  state.pendingBurstTrigger = true;
}

export function triggerPortalEnterSequenceState(
  state: PortalAnimState,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
): void {
  state.enterActive = true;
  state.enterTimerSec = 0;
  state.enterStartX = startX;
  state.enterStartY = startY;
  state.enterTargetX = targetX;
  state.enterTargetY = targetY;
}

export function stepPortalAnimState(
  state: PortalAnimState,
  params: { dtSec: number; roomKey: string; portalActive: boolean; inHub: boolean },
): PortalAnimStepResult {
  const { dtSec, roomKey, portalActive, inHub } = params;
  const safeDt = Math.max(0, dtSec);
  let burstTriggered = false;

  if (state.lastRoomKey !== roomKey) {
    state.lastRoomKey = roomKey;
    state.wasPortalActive = portalActive;
    if (!state.pendingBurstTrigger) {
      state.burstActive = false;
      state.burstTimerSec = 0;
    }
  } else if (!inHub && !state.wasPortalActive && portalActive) {
    state.wasPortalActive = true;
    state.burstActive = true;
    state.burstTimerSec = 0;
    burstTriggered = true;
  } else {
    state.wasPortalActive = portalActive;
  }
  if (state.pendingBurstTrigger) {
    burstTriggered = true;
    state.pendingBurstTrigger = false;
  }

  let burstProgress = 0;
  let shockwaveRadius = 0;
  let shockwaveAlpha = 0;
  let flashAlpha = 0;
  if (state.burstActive) {
    state.burstTimerSec += safeDt;
    if (state.burstTimerSec >= PORTAL_BURST_DURATION_SEC) {
      state.burstActive = false;
      state.burstTimerSec = 0;
    } else {
      burstProgress = clamp(state.burstTimerSec / PORTAL_BURST_DURATION_SEC, 0, 1);
      shockwaveRadius = 18 + (1 - Math.pow(1 - burstProgress, 2.4)) * 84;
      shockwaveAlpha = clamp((1 - burstProgress) * 0.92, 0, 0.92);
      flashAlpha =
        burstProgress < 0.25
          ? clamp((burstProgress / 0.25) * 0.85, 0, 0.85)
          : clamp(((1 - burstProgress) / 0.75) * 0.85, 0, 0.85);
    }
  }

  let enterActive = state.enterActive;
  let enterCompleted = false;
  let enterProgress = 0;
  let playerX = state.enterStartX;
  let playerY = state.enterStartY;
  let playerScaleX = 1;
  let playerScaleY = 1;
  let playerRotationRad = 0;
  let playerAlpha = 1;
  let enterFlashAlpha = 0;
  if (state.enterActive) {
    state.enterTimerSec += safeDt;
    if (state.enterTimerSec >= PORTAL_ENTER_DURATION_SEC) {
      state.enterActive = false;
      state.enterTimerSec = PORTAL_ENTER_DURATION_SEC;
      enterActive = false;
      enterCompleted = true;
      enterProgress = 1;
    } else {
      enterProgress = clamp(state.enterTimerSec / PORTAL_ENTER_DURATION_SEC, 0, 1);
    }
    const pullT = 1 - Math.pow(1 - enterProgress, 2.2);
    const spiralAngle = enterProgress * Math.PI * 3.0;
    playerX =
      state.enterStartX +
      (state.enterTargetX - state.enterStartX) * pullT +
      Math.cos(spiralAngle) * (1 - pullT) * 10 * enterProgress;
    playerY =
      state.enterStartY +
      (state.enterTargetY - state.enterStartY) * pullT -
      Math.sin(enterProgress * Math.PI) * 9;
    playerScaleX = Math.max(0.12, 1 - enterProgress * 0.86);
    playerScaleY = Math.max(0.18, 1 + Math.sin(enterProgress * Math.PI) * 0.56 - enterProgress * 0.42);
    playerRotationRad = enterProgress * enterProgress * Math.PI * 2.6;
    playerAlpha = clamp(1 - Math.max(0, (enterProgress - 0.52) / 0.48), 0.08, 1);
    enterFlashAlpha = clamp(Math.sin(enterProgress * Math.PI) * 0.9, 0, 0.9);
  }

  return {
    burstTriggered,
    burstProgress,
    shockwaveRadius,
    shockwaveAlpha,
    flashAlpha,
    enterActive,
    enterCompleted,
    enterProgress,
    playerX,
    playerY,
    playerScaleX,
    playerScaleY,
    playerRotationRad,
    playerAlpha,
    enterFlashAlpha,
  };
}

export interface ResolveDoorVisualStateParams {
  dir: CardinalDir;
  locked: boolean;
  biome: 0 | 1 | 2 | 3;
  inHub?: boolean;
  quality: 'high' | 'medium' | 'low';
  dissolveProgress?: number;
  lockupProgress?: number;
  elapsedSec?: number;
}

export interface DoorVisualState {
  dir: CardinalDir;
  orientation: 'ns' | 'ew';
  isVertical: boolean;
  frameTextureKey: string;
  barrierTextureKey: string;
  openArchTextureKey: string;
  frameRotationRad: 0;
  barrierRotationRad: 0;
  useShader: boolean;
  barrierVisible: boolean;
  barrierAlpha: number;
  openArchVisible: boolean;
  openArchAlpha: number;
  openArchTintNum: number;
  lampColorNum: number;
  lampAlpha: number;
  dissolveProgress: number;
  lockupProgress: number;
  dustParticleCount: number;
}

export function resolveDoorVisualState(params: ResolveDoorVisualStateParams): DoorVisualState {
  const {
    dir,
    locked,
    biome,
    inHub = false,
    quality,
    dissolveProgress = locked ? 0 : 1,
    lockupProgress = 1,
    elapsedSec = 1.0,
  } = params;
  const effectiveBiome: 0 | 1 | 2 | 3 = inHub ? 0 : biome;
  const orientation: 'ns' | 'ew' = dir === 'N' || dir === 'S' ? 'ns' : 'ew';
  const useShader = quality !== 'low';
  const clampedDissolve = clamp(dissolveProgress, 0, 1);
  const clampedLockup = clamp(lockupProgress, 0, 1);
  const isDissolving = !locked && clampedDissolve < 1;
  const pulse = 0.5 + 0.5 * Math.sin(elapsedSec * 3.4);
  const accentNum = hexToNum(ENV_PALETTE[effectiveBiome].accent);

  return {
    dir,
    orientation,
    isVertical: orientation === 'ew',
    frameTextureKey: `door_frame_${orientation}_${effectiveBiome}`,
    barrierTextureKey: `door_barrier_${orientation}`,
    openArchTextureKey: `door_open_arch_${orientation}`,
    frameRotationRad: 0,
    barrierRotationRad: 0,
    useShader,
    barrierVisible: locked || isDissolving,
    barrierAlpha: locked
      ? clamp(0.84 + 0.08 * pulse, 0.72, 0.95) * (useShader ? 1 : clampedLockup)
      : clamp(1 - clampedDissolve, 0, 1) * 0.9,
    openArchVisible: !locked && (!isDissolving || clampedDissolve > 0.2),
    openArchAlpha: !locked
      ? clamp((isDissolving ? (clampedDissolve - 0.2) / 0.8 : 1) * (0.66 + 0.1 * pulse), 0, 0.82)
      : 0,
    openArchTintNum: accentNum,
    lampColorNum: locked ? 0xef4444 : accentNum,
    lampAlpha: locked ? clamp(0.78 + 0.16 * pulse, 0.65, 0.96) : 0.72,
    dissolveProgress: locked ? 0 : clampedDissolve,
    lockupProgress: locked ? clampedLockup : 1,
    dustParticleCount: locked && quality !== 'low' ? 4 : 0,
  };
}

export interface DoorAnimState {
  wasLocked: boolean;
  dissolveTimerSec: number;
  dissolveActive: boolean;
  pendingUnlockSparks: boolean;
  lockupTimerSec: number;
  lockupActive: boolean;
  pendingLockupSound: boolean;
}

export interface DoorAnimStepResult {
  dissolveActive: boolean;
  dissolveProgress: number;
  emitUnlockSparks: boolean;
  lockupActive: boolean;
  lockupProgress: number;
  emitLockupSound: boolean;
}

export function createDoorAnimState(initialLocked: boolean): DoorAnimState {
  return {
    wasLocked: initialLocked,
    dissolveTimerSec: initialLocked ? 0 : DOOR_UNLOCK_DISSOLVE_DURATION_SEC,
    dissolveActive: false,
    pendingUnlockSparks: false,
    lockupTimerSec: DOOR_COMBAT_LOCKUP_DURATION_SEC,
    lockupActive: false,
    pendingLockupSound: false,
  };
}

export function triggerDoorUnlockDissolveState(state: DoorAnimState): void {
  state.wasLocked = false;
  state.dissolveActive = true;
  state.dissolveTimerSec = 0;
  state.pendingUnlockSparks = true;
  state.lockupActive = false;
}

export function triggerDoorCombatLockupState(state: DoorAnimState): void {
  state.wasLocked = true;
  state.lockupActive = true;
  state.lockupTimerSec = 0;
  state.pendingLockupSound = true;
  state.dissolveActive = false;
}

export function stepDoorAnimState(
  state: DoorAnimState,
  params: { dtSec: number; locked: boolean },
): DoorAnimStepResult {
  const { dtSec, locked } = params;
  const safeDt = Math.max(0, dtSec);
  if (state.wasLocked && !locked) triggerDoorUnlockDissolveState(state);
  else if (!state.wasLocked && locked) triggerDoorCombatLockupState(state);

  const emitUnlockSparks = state.pendingUnlockSparks;
  state.pendingUnlockSparks = false;
  const emitLockupSound = state.pendingLockupSound;
  state.pendingLockupSound = false;

  let dissolveProgress = locked ? 0 : 1;
  if (state.dissolveActive) {
    state.dissolveTimerSec += safeDt;
    if (state.dissolveTimerSec >= DOOR_UNLOCK_DISSOLVE_DURATION_SEC) {
      state.dissolveActive = false;
      state.dissolveTimerSec = DOOR_UNLOCK_DISSOLVE_DURATION_SEC;
      dissolveProgress = 1;
    } else {
      dissolveProgress = clamp(state.dissolveTimerSec / DOOR_UNLOCK_DISSOLVE_DURATION_SEC, 0, 1);
    }
  }

  let lockupProgress = 1;
  if (state.lockupActive) {
    state.lockupTimerSec += safeDt;
    if (state.lockupTimerSec >= DOOR_COMBAT_LOCKUP_DURATION_SEC) {
      state.lockupActive = false;
      state.lockupTimerSec = DOOR_COMBAT_LOCKUP_DURATION_SEC;
      lockupProgress = 1;
    } else {
      lockupProgress = clamp(state.lockupTimerSec / DOOR_COMBAT_LOCKUP_DURATION_SEC, 0, 1);
    }
  }

  return {
    dissolveActive: state.dissolveActive,
    dissolveProgress,
    emitUnlockSparks,
    lockupActive: state.lockupActive,
    lockupProgress,
    emitLockupSound,
  };
}

export const PORTAL_VORTEX_FRAG = [
  '#ifdef GL_FRAGMENT_PRECISION_HIGH',
  'precision highp float;',
  '#else',
  'precision mediump float;',
  '#endif',
  'uniform sampler2D uMainSampler;',
  'varying vec2 outTexCoord;',
  'varying float outTintEffect;',
  'varying vec4 outTint;',
  'uniform float uTime, uSpinSpeed, uActivity, uPulse, uBurstProgress;',
  'uniform vec3 uOuterColor, uCoreColor, uRimColor;',
  'float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
  'void main(){',
  '  vec2 uv = outTexCoord * 2.0 - 1.0;',
  '  float r = length(uv);',
  '  if (r > 0.98) { gl_FragColor = vec4(0.0); return; }',
  '  float theta = atan(uv.y, uv.x);',
  '  float spin = uTime * uSpinSpeed;',
  '  float logR = log(max(r, 0.045));',
  '  float spiralA = sin(theta * 3.0 - logR * 6.5 - spin * 1.35);',
  '  float spiralB = cos(theta * 5.0 + r * 9.0 + spin * 0.85);',
  '  float swirlCell = hash21(floor(vec2(r * 10.0 - uTime * 1.2, (theta + 3.14159) * 3.5)));',
  '  float swirlWave = 0.5 + 0.5 * (spiralA * 0.65 + spiralB * 0.35 + (swirlCell - 0.5) * 0.25);',
  '  float coreMask = smoothstep(0.42, 0.04, r) * (0.75 + 0.25 * uPulse);',
  '  float rimRing = smoothstep(0.64, 0.78, r) * smoothstep(0.95, 0.80, r);',
  '  float runeSegmented = rimRing * (0.65 + 0.35 * sin(theta * 8.0 + spin * 0.5));',
  '  float burstRingPos = mix(0.16, 0.94, uBurstProgress);',
  '  float burstWave = uBurstProgress > 0.001 ? smoothstep(0.11, 0.0, abs(r - burstRingPos)) * (1.0 - uBurstProgress) * 1.4 : 0.0;',
  '  vec3 col = mix(uOuterColor * 0.55, uOuterColor * 1.25, swirlWave);',
  '  col = mix(col, uCoreColor, clamp(coreMask + swirlWave * 0.32 * (1.0 - r), 0.0, 1.0));',
  '  col += uRimColor * (runeSegmented * 0.75 + coreMask * 0.55 + burstWave);',
  '  col *= (0.55 + 0.55 * uActivity) * (0.92 + 0.14 * uPulse);',
  '  float discEdge = smoothstep(0.96, 0.72, r);',
  '  float texAlpha = texture2D(uMainSampler, outTexCoord).a;',
  '  float alpha = clamp(max(discEdge * 0.92, texAlpha * 0.85) * outTint.a, 0.0, 1.0);',
  '  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);',
  '}',
].join('\n');

export const DOOR_BARRIER_FRAG = [
  '#ifdef GL_FRAGMENT_PRECISION_HIGH',
  'precision highp float;',
  '#else',
  'precision mediump float;',
  '#endif',
  'uniform sampler2D uMainSampler;',
  'varying vec2 outTexCoord;',
  'varying float outTintEffect;',
  'varying vec4 outTint;',
  'uniform float uTime, uLockupProgress, uDissolveProgress, uIsVertical;',
  'uniform vec3 uPrimaryColor, uRimColor;',
  'float hash21(vec2 p){p=fract(p*vec2(234.17,567.89));p+=dot(p,p+34.12);return fract(p.x*p.y);}',
  'float valueNoise(vec2 p){',
  '  vec2 i=floor(p), f=fract(p), u=f*f*(3.0-2.0*f);',
  '  return mix(mix(hash21(i),hash21(i+vec2(1.0,0.0)),u.x),mix(hash21(i+vec2(0.0,1.0)),hash21(i+vec2(1.0,1.0)),u.x),u.y);',
  '}',
  'float hexDist(vec2 p){p=abs(p);return max(dot(p,normalize(vec2(1.0,1.73205))),p.x);}',
  'float hexGridEdge(vec2 uv){',
  '  vec2 r=vec2(1.0,1.73205), h=r*0.5, a=mod(uv,r)-h, b=mod(uv-h,r)-h;',
  '  vec2 gv = dot(a,a) < dot(b,b) ? a : b;',
  '  return smoothstep(0.11, 0.02, 0.5 - hexDist(gv));',
  '}',
  'void main(){',
  '  vec4 baseTex = texture2D(uMainSampler, outTexCoord);',
  '  if (baseTex.a < 0.02) { gl_FragColor = vec4(0.0); return; }',
  '  float erectCoord = 1.0 - outTexCoord.y;',
  '  if (uLockupProgress < 0.999 && erectCoord > uLockupProgress) { gl_FragColor = vec4(0.0); return; }',
  '  float lockupLeadBeam = uLockupProgress < 0.999 ? smoothstep(0.12, 0.0, abs(erectCoord - uLockupProgress)) : 0.0;',
  '  vec2 aspectUv = uIsVertical > 0.5 ? vec2(outTexCoord.x * 4.2, outTexCoord.y * 6.8) : vec2(outTexCoord.x * 6.8, outTexCoord.y * 4.2);',
  '  float n = valueNoise(aspectUv * 1.45 + vec2(0.0, uTime * 0.4));',
  '  float centerBias = 1.0 - length(outTexCoord - vec2(0.5)) * 0.45;',
  '  float dissolveField = clamp(n * 0.75 + centerBias * 0.25, 0.0, 1.0);',
  '  if (uDissolveProgress > 0.001 && dissolveField < uDissolveProgress * 1.08) { gl_FragColor = vec4(0.0); return; }',
  '  float dissolveEdge = uDissolveProgress > 0.001 ? smoothstep(0.15, 0.0, dissolveField - uDissolveProgress * 1.08) : 0.0;',
  '  vec2 hexUv = aspectUv * 1.35 + vec2(0.0, -uTime * 0.55);',
  '  float hexLine = hexGridEdge(hexUv);',
  '  float scanWave = 0.5 + 0.5 * sin(outTexCoord.y * 12.0 - uTime * 3.8);',
  '  float borderGlow = smoothstep(0.28, 0.48, max(abs(outTexCoord.x - 0.5), abs(outTexCoord.y - 0.5)));',
  '  vec3 col = mix(uPrimaryColor * 0.52, uPrimaryColor * 1.18, hexLine * 0.72 + scanWave * 0.28);',
  '  col = mix(col, baseTex.rgb, 0.42);',
  '  col += uPrimaryColor * borderGlow * 0.45 + vec3(1.0, 0.78, 0.78) * lockupLeadBeam * 0.95;',
  '  col = mix(col, uRimColor, dissolveEdge);',
  '  float alpha = clamp(baseTex.a * (0.76 + hexLine * 0.18 + dissolveEdge * 0.24 + lockupLeadBeam * 0.22) * outTint.a, 0.0, 1.0);',
  '  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);',
  '}',
].join('\n');

export function createPortalVortexPipeline(
  game: Phaser.Game,
  phaserNs: typeof Phaser,
): Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  class PortalVortexPipeline extends phaserNs.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(g: Phaser.Game) {
      super({ game: g, name: PORTAL_VORTEX_PIPELINE_KEY, fragShader: PORTAL_VORTEX_FRAG });
    }
    public override onBind(gameObject?: Phaser.GameObjects.GameObject): void {
      super.onBind(gameObject);
      if (this.vertexCount > 0) this.flush();
      const u = (gameObject as PortalShaderSprite | undefined)?.__portalUniforms;
      this.set1f('uTime', u?.time ?? 1.0);
      this.set1f('uSpinSpeed', u?.spinSpeed ?? 2.6);
      this.set1f('uActivity', u?.activity ?? 1.0);
      this.set1f('uPulse', u?.pulse ?? 0.5);
      this.set1f('uBurstProgress', u?.burstProgress ?? 0.0);
      this.set3f('uOuterColor', u?.outerRgb[0] ?? 0.66, u?.outerRgb[1] ?? 0.33, u?.outerRgb[2] ?? 0.97);
      this.set3f('uCoreColor', u?.coreRgb[0] ?? 0.13, u?.coreRgb[1] ?? 0.83, u?.coreRgb[2] ?? 0.93);
      this.set3f('uRimColor', u?.rimRgb[0] ?? 0.81, u?.rimRgb[1] ?? 0.98, u?.rimRgb[2] ?? 1.0);
    }
  }
  return new PortalVortexPipeline(game);
}

export function createDoorBarrierPipeline(
  game: Phaser.Game,
  phaserNs: typeof Phaser,
): Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  class DoorBarrierPipeline extends phaserNs.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(g: Phaser.Game) {
      super({ game: g, name: DOOR_BARRIER_PIPELINE_KEY, fragShader: DOOR_BARRIER_FRAG });
    }
    public override onBind(gameObject?: Phaser.GameObjects.GameObject): void {
      super.onBind(gameObject);
      if (this.vertexCount > 0) this.flush();
      const u = (gameObject as DoorShaderSprite | undefined)?.__doorUniforms;
      this.set1f('uTime', u?.time ?? 1.0);
      this.set1f('uLockupProgress', u?.lockupProgress ?? 1.0);
      this.set1f('uDissolveProgress', u?.dissolveProgress ?? 0.0);
      this.set1f('uIsVertical', u?.isVertical ?? 0.0);
      this.set3f('uPrimaryColor', u?.primaryRgb[0] ?? 0.86, u?.primaryRgb[1] ?? 0.15, u?.primaryRgb[2] ?? 0.15);
      this.set3f('uRimColor', u?.rimRgb[0] ?? 0.98, u?.rimRgb[1] ?? 0.75, u?.rimRgb[2] ?? 0.14);
    }
  }
  return new DoorBarrierPipeline(game);
}

export function ensurePortalAndDoorPipelinesRegistered(
  game: Phaser.Game,
  phaserNs: typeof Phaser,
): boolean {
  const renderer = game.renderer;
  if (!(renderer instanceof phaserNs.Renderer.WebGL.WebGLRenderer)) return false;
  if (!renderer.pipelines.has(PORTAL_VORTEX_PIPELINE_KEY)) {
    renderer.pipelines.add(PORTAL_VORTEX_PIPELINE_KEY, createPortalVortexPipeline(game, phaserNs));
  }
  if (!renderer.pipelines.has(DOOR_BARRIER_PIPELINE_KEY)) {
    renderer.pipelines.add(DOOR_BARRIER_PIPELINE_KEY, createDoorBarrierPipeline(game, phaserNs));
  }
  return true;
}

export interface PortalDoorParticlePose {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  alpha: number;
}

export function computePortalSpiralParticlePose(
  index: number,
  count: number,
  elapsedSec: number,
  spinSpeedRadPerSec: number,
  portalX: number,
  portalY: number,
): PortalDoorParticlePose {
  const safeCount = Math.max(1, count);
  const u = (((elapsedSec * 0.75 + index / safeCount) % 1) + 1) % 1;
  const radius = 32 - u * 28;
  const angle =
    (index / safeCount) * Math.PI * 2 + elapsedSec * spinSpeedRadPerSec * 1.15 + u * 2.8;
  const scale = clamp(0.45 + (1 - u) * 0.65, 0.35, 1.15);
  return {
    x: portalX + Math.cos(angle) * radius,
    y: portalY + Math.sin(angle) * radius * 0.88,
    scaleX: scale,
    scaleY: scale,
    rotation: angle + Math.PI * 0.5,
    alpha: clamp(Math.sin(u * Math.PI) * 0.88, 0.08, 0.9),
  };
}

export function computePortalEnergyRayPose(
  index: number,
  count: number,
  elapsedSec: number,
  portalX: number,
  portalY: number,
): PortalDoorParticlePose {
  const safeCount = Math.max(1, count);
  const phase = (((elapsedSec * 0.85 + index / safeCount) % 1) + 1) % 1;
  const offsetX =
    (index - (safeCount - 1) * 0.5) * 14 + Math.sin(elapsedSec * 2.1 + index * 1.7) * 3;
  const sinPhase = Math.sin(phase * Math.PI);
  return {
    x: portalX + offsetX,
    y: portalY + 2 - phase * 34,
    scaleX: 0.75 + 0.25 * sinPhase,
    scaleY: 0.65 + 0.55 * sinPhase,
    rotation: 0,
    alpha: clamp(sinPhase * 0.72, 0.06, 0.75),
  };
}

export function computeDoorMotePose(
  index: number,
  orientation: 'ns' | 'ew',
  doorX: number,
  doorY: number,
  locked: boolean,
  dissolveActive: boolean,
  dissolveProgress: number,
  elapsedSec: number,
): PortalDoorParticlePose {
  if (dissolveActive) {
    const angle = (index / 4) * Math.PI * 2 + 0.4 + dissolveProgress * 1.2;
    const dist = 8 + dissolveProgress * 28;
    const scale = clamp(1.15 - dissolveProgress * 0.65, 0.35, 1.2);
    return {
      x: doorX + Math.cos(angle) * dist,
      y: doorY + Math.sin(angle) * dist,
      scaleX: scale,
      scaleY: scale,
      rotation: angle,
      alpha: clamp((1 - dissolveProgress) * 0.95, 0.05, 0.95),
    };
  }
  if (locked) {
    if (index < 2) {
      const sign = index === 0 ? -1 : 1;
      const dx = orientation === 'ns' ? sign * 24 : 0;
      const dy = orientation === 'ns' ? -2 : sign * 24;
      const pulse = Math.sin(elapsedSec * 4.2 + index * 1.5);
      const scale = 0.85 + 0.15 * pulse;
      return {
        x: doorX + dx,
        y: doorY + dy,
        scaleX: scale,
        scaleY: scale,
        rotation: elapsedSec * 1.2,
        alpha: clamp(0.78 + 0.14 * pulse, 0.62, 0.94),
      };
    }
    const barOffset = (index === 2 ? -10 : 10) + Math.sin(elapsedSec * 2.8 + index) * 4;
    const dx = orientation === 'ns' ? barOffset : 0;
    const dy = orientation === 'ns' ? 0 : barOffset;
    const scale = 0.65 + 0.1 * Math.sin(elapsedSec * 3.4 + index);
    return {
      x: doorX + dx,
      y: doorY + dy,
      scaleX: scale,
      scaleY: scale,
      rotation: -elapsedSec * 1.5,
      alpha: clamp(0.48 + 0.18 * Math.sin(elapsedSec * 3.1 + index), 0.25, 0.7),
    };
  }
  const phase = (((elapsedSec * 0.55 + index * 0.25) % 1) + 1) % 1;
  const spread = (index - 1.5) * 11;
  const drift = (0.5 - phase) * 14;
  const dx = orientation === 'ns' ? spread : drift;
  const dy = orientation === 'ns' ? drift : spread;
  const sinPhase = Math.sin(phase * Math.PI);
  const scale = 0.55 + 0.35 * sinPhase;
  return {
    x: doorX + dx,
    y: doorY + dy,
    scaleX: scale,
    scaleY: scale,
    rotation: elapsedSec * 0.9 + index,
    alpha: clamp(sinPhase * 0.62, 0.08, 0.65),
  };
}
