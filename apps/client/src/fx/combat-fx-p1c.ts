import {
  CRYO_PRISM_FAN_SPREAD_RAD,
  FORGE_BLAST_SHIELD_WAVE_HALF_WIDTH,
  GLACIAL_BARRICADE_SHATTER_RADIUS,
  PNEUMATIC_PRESS_CRUSH_RADIUS,
  PNEUMATIC_PRESS_SENSOR_RADIUS,
  SLAG_CRUCIBLE_CARPET_LENGTH,
  TILE_SIZE,
  clamp,
  getConveyorVelocityAtWorld,
  type SimEvent,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { PALETTE } from '../art/palette.js';
import { zzfx } from '../audio/zzfx.js';
import type { CombatFxManager } from './combat-fx.js';
import {
  type Batch2SceneContext,
  type TransientWeaponV2Shape,
  type WeaponV2OverlayState,
  getWeaponV2OverlayState,
} from './combat-fx-weapons-v2.js';

export type P1CTacticalVfxKind =
  | 'glacial_shatter_spikes'
  | 'prism_refract_flash'
  | 'pneumatic_press_slam'
  | 'slag_lava_carpet'
  | 'forge_fire_wave';

function pushP1CShape(state: WeaponV2OverlayState, shape: TransientWeaponV2Shape): void {
  if (state.shapes.length >= 64) state.shapes.shift();
  state.shapes.push(shape);
}

export function spawnGlacialShatterSpikesVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  angle = 0,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushP1CShape(state, {
    kind: 'glacial_shatter_spikes',
    x,
    y,
    radius: GLACIAL_BARRICADE_SHATTER_RADIUS,
    angle,
    color: 0x38bdf8,
    ttlSec: 0.45,
    maxTtlSec: 0.45,
  });
  fx?.spawnElementalBurst('shatter', x, y, GLACIAL_BARRICADE_SHATTER_RADIUS);
}

export function spawnPrismRefractFlashVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  angle = 0,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushP1CShape(state, {
    kind: 'prism_refract_flash',
    x,
    y,
    radius: 78,
    angle,
    color: 0x67e8f9,
    ttlSec: 0.36,
    maxTtlSec: 0.36,
  });
  fx?.spawnHitSparks(x, y, angle, { isCrit: true, element: 'chill', count: 8 });
}

export function spawnPneumaticPressSlamVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushP1CShape(state, {
    kind: 'pneumatic_press_slam',
    x,
    y,
    radius: PNEUMATIC_PRESS_CRUSH_RADIUS,
    color: 0xf97316,
    ttlSec: 0.48,
    maxTtlSec: 0.48,
  });
  fx?.spawnExplosion(x, y, PNEUMATIC_PRESS_CRUSH_RADIUS * 0.85);
}

export function spawnSlagLavaCarpetVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  angle = 0,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushP1CShape(state, {
    kind: 'slag_lava_carpet',
    x,
    y,
    x2: x + Math.cos(angle) * SLAG_CRUCIBLE_CARPET_LENGTH,
    y2: y + Math.sin(angle) * SLAG_CRUCIBLE_CARPET_LENGTH,
    radius: 28,
    angle,
    color: 0xf97316,
    ttlSec: 0.55,
    maxTtlSec: 0.55,
  });
  fx?.spawnExplosion(x, y, 56);
}

export function handleP1CSimEvent(
  scene: Batch2SceneContext & object,
  ev: SimEvent,
  sim: WorldSim,
  isStress: boolean,
  allowStressSfx: boolean,
): boolean {
  if (ev.kind === 'explosion') {
    if (ev.sourceDefId === 'glacial_barricade') {
      if (!isStress) {
        spawnGlacialShatterSpikesVfx(scene, scene.fx, ev.x, ev.y, sim.player.aimAngle);
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 130, PALETTE.CYAN_FROST, 0.9, 0.28);
      }
      if (allowStressSfx) {
        zzfx.play('shatter_ice', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }
    if (ev.sourceDefId === 'pneumatic_press') {
      if (!isStress) {
        spawnPneumaticPressSlamVfx(scene, scene.fx, ev.x, ev.y);
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 150, PALETTE.FLAME_ORANGE, 0.95, 0.32);
      }
      if (allowStressSfx) {
        zzfx.play('hammer_slam', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }
    if (ev.sourceDefId === 'slag_crucible') {
      if (!isStress) {
        const spillAngle =
          Math.hypot(ev.x - sim.player.x, ev.y - sim.player.y) > 1
            ? Math.atan2(ev.y - sim.player.y, ev.x - sim.player.x)
            : sim.player.aimAngle;
        spawnSlagLavaCarpetVfx(scene, scene.fx, ev.x, ev.y, spillAngle);
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 160, PALETTE.FLAME_ORANGE, 0.92, 0.35);
      }
      if (allowStressSfx) {
        zzfx.play('barrel_explosion', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }
  }

  if (
    ev.kind === 'bullet_volley_spawned' &&
    ev.replacedProjectileId !== undefined &&
    ev.pelletCount === 3 &&
    ev.element === 'chill'
  ) {
    if (!isStress) {
      spawnPrismRefractFlashVfx(scene, scene.fx, ev.x, ev.y, ev.angle);
      scene.lighting?.spawnTransientLight(ev.x, ev.y, 120, PALETTE.CYAN_FROST, 0.88, 0.22);
    }
    if (allowStressSfx) {
      zzfx.play('bullet_deflect', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
    }
    return false;
  }

  return false;
}

export function drawP1CActiveOverlays(
  g: Phaser.GameObjects.Graphics,
  sim: WorldSim | undefined,
  clockSec: number,
): void {
  if (!sim || sim.stressTestActive) return;

  // 1. Conveyor Reversal Warning Chevrons (1.2s flashing indicator before 8.0s factory reversal)
  const warnTimer = sim.map.conveyorWarningTimer ?? 0;
  if (warnTimer > 0) {
    const flashOn = Math.floor(clockSec * 10) % 2 === 0;
    const alpha = flashOn ? 0.88 : 0.35;
    const col = flashOn ? 0xfacc15 : 0xf97316;
    for (let ty = 1; ty < sim.map.rows - 1; ty += 1) {
      for (let tx = 2; tx < sim.map.cols - 2; tx += 3) {
        if (sim.map.getSurface(tx, ty) !== 'conveyor') continue;
        const cx = tx * TILE_SIZE + TILE_SIZE * 0.5;
        const cy = ty * TILE_SIZE + TILE_SIZE * 0.5;
        const curVel = getConveyorVelocityAtWorld(sim.map, cx, cy);
        // Point chevron in the UPCOMING reversed direction!
        const nextSign = curVel >= 0 ? -1 : 1;
        g.lineStyle(2.4, col, alpha);
        g.beginPath();
        g.moveTo(cx - nextSign * 5, cy - 6);
        g.lineTo(cx + nextSign * 6, cy);
        g.lineTo(cx - nextSign * 5, cy + 6);
        g.strokePath();
      }
    }
  }

  // 2. Active P1C Props Overlays (pneumatic_press sensor/windup, forge_blast_shield 88px fire wave, sliding_ice_block wake)
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0) continue;

    if (prop.kind === 'pneumatic_press') {
      const pState = prop.pressState ?? 'idle';
      if (pState === 'windup') {
        const t = clamp(1 - (prop.pressTimer ?? 0) / 0.35, 0, 1);
        g.fillStyle(0xef4444, 0.18 + t * 0.22);
        g.fillCircle(prop.x, prop.y, PNEUMATIC_PRESS_CRUSH_RADIUS);
        g.lineStyle(3.0, 0xfacc15, 0.92);
        g.strokeCircle(prop.x, prop.y, PNEUMATIC_PRESS_CRUSH_RADIUS * (1 - t * 0.35));
        g.lineStyle(2.2, 0xef4444, 0.9);
        g.strokeCircle(prop.x, prop.y, PNEUMATIC_PRESS_CRUSH_RADIUS);
      } else if (pState === 'cooldown') {
        g.lineStyle(1.6, 0x64748b, 0.45);
        g.strokeCircle(prop.x, prop.y, PNEUMATIC_PRESS_SENSOR_RADIUS);
      } else {
        const pulse = 0.42 + Math.sin(clockSec * 6 + prop.id) * 0.14;
        g.lineStyle(1.8, 0xf97316, pulse);
        g.strokeCircle(prop.x, prop.y, PNEUMATIC_PRESS_SENSOR_RADIUS);
      }
    } else if (prop.kind === 'forge_blast_shield' && prop.coverState === 'sliding') {
      const ang = Math.atan2(prop.vy ?? 0, prop.vx ?? 1);
      const r = FORGE_BLAST_SHIELD_WAVE_HALF_WIDTH;
      g.lineStyle(7, 0xf97316, 0.78);
      g.beginPath();
      g.arc(prop.x, prop.y, r, ang - 1.15, ang + 1.15, false);
      g.strokePath();
      g.lineStyle(3.2, 0xfef08a, 0.95);
      g.beginPath();
      g.arc(prop.x, prop.y, r - 4, ang - 1.0, ang + 1.0, false);
      g.strokePath();
    } else if (
      (prop.kind === 'sliding_ice_block' || prop.kind === 'glacial_barricade') &&
      prop.coverState === 'sliding'
    ) {
      const ang = Math.atan2(prop.vy ?? 0, prop.vx ?? 1);
      const tailX = prop.x - Math.cos(ang) * 28;
      const tailY = prop.y - Math.sin(ang) * 28;
      g.lineStyle(4.5, 0x67e8f9, 0.72);
      g.beginPath();
      g.moveTo(prop.x, prop.y);
      g.lineTo(tailX, tailY);
      g.strokePath();
    }
  }
}

export function drawP1CTransientShape(
  g: Phaser.GameObjects.Graphics,
  s: TransientWeaponV2Shape,
  progress: number,
  alpha: number,
): boolean {
  if (s.kind === 'glacial_shatter_spikes') {
    const r = s.radius * (0.35 + progress * 0.65);
    g.lineStyle(3.4 * alpha, 0x38bdf8, alpha * 0.9);
    g.strokeCircle(s.x, s.y, r);
    g.lineStyle(2.0 * alpha, 0xe0f2fe, alpha);
    for (let k = 0; k < 6; k++) {
      const a = (s.angle ?? 0) + (k * Math.PI) / 3;
      g.beginPath();
      g.moveTo(s.x + Math.cos(a) * 10, s.y + Math.sin(a) * 10);
      g.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
      g.strokePath();
    }
    return true;
  }
  if (s.kind === 'prism_refract_flash') {
    const baseAng = s.angle ?? 0;
    const len = s.radius * (0.5 + progress * 0.7);
    const rayOffsets = [-CRYO_PRISM_FAN_SPREAD_RAD * 0.5, 0, CRYO_PRISM_FAN_SPREAD_RAD * 0.5];
    for (const off of rayOffsets) {
      const a = baseAng + off;
      g.lineStyle(4.2 * alpha, 0x38bdf8, alpha * 0.85);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x + Math.cos(a) * len, s.y + Math.sin(a) * len);
      g.strokePath();
      g.lineStyle(1.8 * alpha, 0xffffff, alpha);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x + Math.cos(a) * len, s.y + Math.sin(a) * len);
      g.strokePath();
    }
    g.lineStyle(2.4, 0x67e8f9, alpha);
    g.strokeCircle(s.x, s.y, 16 + progress * 14);
    return true;
  }
  if (s.kind === 'pneumatic_press_slam') {
    const r = s.radius * (0.45 + progress * 0.65);
    g.fillStyle(0xf97316, alpha * 0.26);
    g.fillCircle(s.x, s.y, r);
    g.lineStyle(4.5 * alpha, 0xf97316, alpha * 0.92);
    g.strokeCircle(s.x, s.y, r);
    g.lineStyle(2.2 * alpha, 0xfef08a, alpha);
    g.strokeCircle(s.x, s.y, r * 0.72);
    return true;
  }
  if (s.kind === 'slag_lava_carpet' && s.x2 !== undefined && s.y2 !== undefined) {
    g.lineStyle(44 * (0.6 + progress * 0.4), 0xea580c, alpha * 0.42);
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(s.x2, s.y2);
    g.strokePath();
    g.lineStyle(22 * (0.6 + progress * 0.4), 0xfacc15, alpha * 0.65);
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(s.x2, s.y2);
    g.strokePath();
    return true;
  }
  return false;
}
