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

const PRISM_RAY_OFFSETS = [-CRYO_PRISM_FAN_SPREAD_RAD * 0.5, 0, CRYO_PRISM_FAN_SPREAD_RAD * 0.5] as const;

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
    ttlSec: 0.42,
    maxTtlSec: 0.42,
  });
  if (fx?.spawnShaderNova) {
    fx.spawnShaderNova(x, y, GLACIAL_BARRICADE_SHATTER_RADIUS, 'fx_sh_nova_cryo');
    fx.spawnHitSparks?.(x, y, angle, { isCrit: true, element: 'chill', count: 7 });
  } else {
    fx?.spawnExplosionBurst(x, y, GLACIAL_BARRICADE_SHATTER_RADIUS, PALETTE.CYAN_FROST);
  }
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
    ttlSec: 0.34,
    maxTtlSec: 0.34,
  });
  fx?.spawnShaderCone?.(x, y, 78, angle);
  fx?.spawnShaderNova?.(x, y, 46, 'fx_sh_arcane_sigil', { tint: 0x67e8f9 });
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
    ttlSec: 0.44,
    maxTtlSec: 0.44,
  });
  if (fx?.spawnShaderNova) {
    fx.spawnShaderNova(x, y, PNEUMATIC_PRESS_CRUSH_RADIUS, 'fx_sh_geyser_plume');
    fx.spawnHitSparks?.(x, y, 0, { isCrit: true, element: 'burn', count: 8 });
  } else {
    fx?.spawnExplosionBurst(x, y, PNEUMATIC_PRESS_CRUSH_RADIUS * 0.85, PALETTE.FLAME_ORANGE);
  }
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
  if (fx?.spawnShaderNova) {
    fx.spawnShaderNova(x, y, 56, 'fx_sh_geyser_plume');
  } else {
    fx?.spawnExplosionBurst(x, y, 56, PALETTE.FLAME_ORANGE);
  }
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
        const pAim = sim.player?.aimAngle ?? 0;
        spawnGlacialShatterSpikesVfx(scene, scene.fx, ev.x, ev.y, pAim);
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 130, PALETTE.CYAN_FROST, 0.9, 0.28);
      }
      if (allowStressSfx) {
        zzfx.play('shatter', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }
    if (ev.sourceDefId === 'pneumatic_press') {
      if (!isStress) {
        spawnPneumaticPressSlamVfx(scene, scene.fx, ev.x, ev.y);
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 150, PALETTE.FLAME_ORANGE, 0.95, 0.32);
      }
      if (allowStressSfx) {
        zzfx.play('wall_slam', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }
    if (ev.sourceDefId === 'slag_crucible') {
      if (!isStress) {
        const px = sim.player?.x ?? ev.x;
        const py = sim.player?.y ?? ev.y;
        const pAim = sim.player?.aimAngle ?? 0;
        const spillAngle =
          Math.hypot(ev.x - px, ev.y - py) > 1
            ? Math.atan2(ev.y - py, ev.x - px)
            : pAim;
        spawnSlagLavaCarpetVfx(scene, scene.fx, ev.x, ev.y, spillAngle);
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 160, PALETTE.FLAME_ORANGE, 0.92, 0.35);
      }
      if (allowStressSfx) {
        zzfx.play('explosion', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
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
  groundG?: Phaser.GameObjects.Graphics,
): void {
  if (!sim || sim.stressTestActive) return;
  const floorG = groundG ?? g;

  // 1. Conveyor Reversal Warning Chevrons (1.2s flashing indicator before 8.0s factory reversal — depth 16 floor)
  const warnTimer = sim.map?.conveyorWarningTimer ?? 0;
  if (warnTimer > 0 && sim.map) {
    const flashOn = Math.floor(clockSec * 10) % 2 === 0;
    const alpha = flashOn ? 0.88 : 0.35;
    const col = flashOn ? 0xfacc15 : 0xf97316;
    for (let ty = 1; ty < sim.map.rows - 1; ty += 1) {
      for (let tx = 2; tx < sim.map.cols - 2; tx += 3) {
        if (sim.map.getSurface(tx, ty) !== 'conveyor') continue;
        const cx = tx * TILE_SIZE + TILE_SIZE * 0.5;
        const cy = ty * TILE_SIZE + TILE_SIZE * 0.5;
        const curVel = getConveyorVelocityAtWorld(sim.map, cx, cy);
        const nextSign = curVel >= 0 ? -1 : 1;
        floorG.lineStyle(3.8, 0x141019, alpha * 0.65);
        floorG.beginPath();
        floorG.moveTo(cx - nextSign * 5, cy - 6);
        floorG.lineTo(cx + nextSign * 6, cy);
        floorG.lineTo(cx - nextSign * 5, cy + 6);
        floorG.strokePath();
        floorG.lineStyle(2.2, col, alpha);
        floorG.beginPath();
        floorG.moveTo(cx - nextSign * 5, cy - 6);
        floorG.lineTo(cx + nextSign * 6, cy);
        floorG.lineTo(cx - nextSign * 5, cy + 6);
        floorG.strokePath();
      }
    }
  }

  // 2. Active P1C Props Overlays (pneumatic_press sensor/windup on floorG, forge_blast_shield 88px fire wave on g, sliding_ice_block wake)
  const props = sim.props ?? [];
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]!;
    if (prop.hp <= 0) continue;

    if (prop.kind === 'pneumatic_press') {
      const pState = prop.pressState ?? 'idle';
      if (pState === 'windup') {
        const t = clamp(1 - (prop.pressTimer ?? 0) / 0.35, 0, 1);
        floorG.fillStyle(0xe84545, 0.05 + t * 0.03);
        floorG.fillCircle(prop.x, prop.y, PNEUMATIC_PRESS_CRUSH_RADIUS);
        floorG.lineStyle(4.2, 0x141019, 0.72);
        floorG.strokeCircle(prop.x, prop.y, PNEUMATIC_PRESS_CRUSH_RADIUS);
        floorG.lineStyle(2.6, 0xe84545, 0.94);
        floorG.strokeCircle(prop.x, prop.y, PNEUMATIC_PRESS_CRUSH_RADIUS);
        floorG.lineStyle(2.4, 0xfacc15, 0.92);
        floorG.strokeCircle(prop.x, prop.y, PNEUMATIC_PRESS_CRUSH_RADIUS * (1 - t * 0.38));
      } else if (pState === 'cooldown') {
        floorG.lineStyle(1.6, 0x64748b, 0.45);
        floorG.strokeCircle(prop.x, prop.y, PNEUMATIC_PRESS_SENSOR_RADIUS);
      } else {
        const pulse = 0.42 + Math.sin(clockSec * 6 + prop.id) * 0.14;
        floorG.lineStyle(1.8, 0xf97316, pulse);
        floorG.strokeCircle(prop.x, prop.y, PNEUMATIC_PRESS_SENSOR_RADIUS);
      }
    } else if (prop.kind === 'forge_blast_shield' && prop.coverState === 'sliding') {
      const ang = Math.atan2(prop.vy ?? 0, prop.vx ?? 1);
      const r = FORGE_BLAST_SHIELD_WAVE_HALF_WIDTH;
      const segs = 10;
      const halfSpan = 1.2;
      // 1. Parabolic tapered Chiaroscuro flame crescent (thick prow -> razor swept-back wingtips)
      for (let pass = 0; pass < 3; pass++) {
        for (let k = 0; k < segs; k++) {
          const u0 = (k / segs) * 2 - 1;
          const u1 = ((k + 1) / segs) * 2 - 1;
          const um = (u0 + u1) * 0.5;
          if (pass === 2 && Math.abs(um) > 0.82) continue;
          const taper = Math.pow(Math.max(0.16, Math.cos(um * Math.PI * 0.45)), 0.78);
          const pad = pass === 0 ? 0.045 : 0.025;
          const a0 = ang + u0 * halfSpan - pad;
          const a1 = ang + u1 * halfSpan + pad;
          const r0 = r - u0 * u0 * 5.5;
          const r1 = r - u1 * u1 * 5.5;
          if (pass === 0) {
            g.lineStyle(13.8 * taper, 0x141019, 0.86);
          } else if (pass === 1) {
            g.lineStyle(8.8 * taper, 0xf97316, 0.94);
          } else {
            g.lineStyle(4.6 * taper, 0xfacc15, 0.96);
          }
          g.beginPath();
          g.moveTo(prop.x + Math.cos(a0) * r0, prop.y + Math.sin(a0) * r0);
          g.lineTo(prop.x + Math.cos(a1) * r1, prop.y + Math.sin(a1) * r1);
          g.strokePath();
        }
      }
      // 2. Swept-back flickering flame fangs / tongues cased in #141019 ink
      for (let j = -3; j <= 3; j++) {
        const u = j / 3;
        const fangAng = ang + u * 0.96;
        const baseR = r - u * u * 5.2;
        const flick = 0.85 + 0.28 * Math.sin(clockSec * 22 + prop.id * 1.7 + j * 2.15);
        const fangLen = (15.5 - Math.abs(j) * 2.2) * flick;
        const bx = prop.x + Math.cos(fangAng) * baseR;
        const by = prop.y + Math.sin(fangAng) * baseR;
        const tx = bx - Math.cos(ang) * fangLen * 0.65 - Math.cos(fangAng) * fangLen * 0.45;
        const ty = by - Math.sin(ang) * fangLen * 0.65 - Math.sin(fangAng) * fangLen * 0.45;
        g.lineStyle(5.2, 0x141019, 0.8);
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(tx, ty);
        g.strokePath();
        g.lineStyle(2.8, j % 2 === 0 ? 0xf97316 : 0xfacc15, 0.94);
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(tx, ty);
        g.strokePath();
      }
      // 3. Incandescent #FFFDF5 leading shock-crest arc + trailing magma cinders
      g.lineStyle(2.5, 0xfffdf5, 0.98);
      g.beginPath();
      g.arc(prop.x, prop.y, r + 0.8, ang - 0.82, ang + 0.82, false);
      g.strokePath();
      for (let c = -1; c <= 1; c += 2) {
        const cAng = ang + c * 0.68;
        const cR = r - 13;
        const cx = prop.x + Math.cos(cAng) * cR;
        const cy = prop.y + Math.sin(cAng) * cR;
        g.fillStyle(0x141019, 0.84);
        g.fillCircle(cx, cy, 3.6);
        g.fillStyle(0xfacc15, 0.95);
        g.fillCircle(cx, cy, 2.0);
      }
    } else if (
      (prop.kind === 'sliding_ice_block' || prop.kind === 'glacial_barricade') &&
      prop.coverState === 'sliding'
    ) {
      const ang = Math.atan2(prop.vy ?? 0, prop.vx ?? 1);
      const tailX = prop.x - Math.cos(ang) * 28;
      const tailY = prop.y - Math.sin(ang) * 28;
      floorG.lineStyle(6.0, 0x141019, 0.55);
      floorG.beginPath();
      floorG.moveTo(prop.x, prop.y);
      floorG.lineTo(tailX, tailY);
      floorG.strokePath();
      floorG.lineStyle(3.4, 0x67e8f9, 0.85);
      floorG.beginPath();
      floorG.moveTo(prop.x, prop.y);
      floorG.lineTo(tailX, tailY);
      floorG.strokePath();
    }
  }
}

export function drawP1CTransientShape(
  g: Phaser.GameObjects.Graphics,
  s: TransientWeaponV2Shape,
  progress: number,
  alpha: number,
  groundG?: Phaser.GameObjects.Graphics,
): boolean {
  const floorG = groundG ?? g;
  if (s.kind === 'glacial_shatter_spikes') {
    const r = s.radius * (0.42 + progress * 0.58);
    floorG.lineStyle(4.2 * alpha, 0x141019, alpha * 0.72);
    floorG.strokeCircle(s.x, s.y, r);
    floorG.lineStyle(2.4 * alpha, 0x38bdf8, alpha * 0.92);
    floorG.strokeCircle(s.x, s.y, r);
    g.lineStyle(2.0 * alpha, 0xfffdf5, alpha);
    for (let k = 0; k < 6; k++) {
      const a = (s.angle ?? 0) + (k * Math.PI) / 3;
      const r0 = r * 0.58;
      const r1 = r * 1.05;
      g.beginPath();
      g.moveTo(s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0);
      g.lineTo(s.x + Math.cos(a) * r1, s.y + Math.sin(a) * r1);
      g.strokePath();
    }
    return true;
  }
  if (s.kind === 'prism_refract_flash') {
    const baseAng = s.angle ?? 0;
    const len = s.radius * (0.5 + progress * 0.65);
    const ringR = 16 + progress * 12;
    floorG.lineStyle(3.8 * alpha, 0x141019, alpha * 0.72);
    floorG.strokeCircle(s.x, s.y, ringR);
    floorG.lineStyle(2.2 * alpha, 0x67e8f9, alpha * 0.9);
    floorG.strokeCircle(s.x, s.y, ringR);

    for (const off of PRISM_RAY_OFFSETS) {
      const a = baseAng + off;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x0 = s.x + ca * 8;
      const y0 = s.y + sa * 8;
      const x1 = s.x + ca * len;
      const y1 = s.y + sa * len;
      g.lineStyle(6.0 * alpha, 0x141019, alpha * 0.84);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.strokePath();
      g.lineStyle(3.4 * alpha, 0x38bdf8, alpha * 0.94);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.strokePath();
      g.lineStyle(1.6 * alpha, 0xfffdf5, alpha);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.strokePath();

      // Crystalline chevron spearhead barbs at tip
      const barbLen = 9.5 * (1 - progress * 0.25);
      for (let side = -1; side <= 1; side += 2) {
        const ba = a + Math.PI - side * 0.52;
        const bx = x1 + Math.cos(ba) * barbLen;
        const by = y1 + Math.sin(ba) * barbLen;
        g.lineStyle(4.2 * alpha, 0x141019, alpha * 0.82);
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(bx, by);
        g.strokePath();
        g.lineStyle(2.0 * alpha, 0x67e8f9, alpha * 0.95);
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(bx, by);
        g.strokePath();
      }
    }

    // 4-point Chiaroscuro prism focal star at refraction origin
    for (let k = 0; k < 2; k++) {
      const sa = baseAng + (k * Math.PI) / 2;
      const sr = 9.5;
      g.lineStyle(4.4 * alpha, 0x141019, alpha * 0.86);
      g.beginPath();
      g.moveTo(s.x - Math.cos(sa) * sr, s.y - Math.sin(sa) * sr);
      g.lineTo(s.x + Math.cos(sa) * sr, s.y + Math.sin(sa) * sr);
      g.strokePath();
      g.lineStyle(2.0 * alpha, 0xfffdf5, alpha);
      g.beginPath();
      g.moveTo(s.x - Math.cos(sa) * sr, s.y - Math.sin(sa) * sr);
      g.lineTo(s.x + Math.cos(sa) * sr, s.y + Math.sin(sa) * sr);
      g.strokePath();
    }
    g.fillStyle(0x141019, alpha * 0.88);
    g.fillCircle(s.x, s.y, 5.2);
    g.fillStyle(0x38bdf8, alpha * 0.95);
    g.fillCircle(s.x, s.y, 3.4);
    g.fillStyle(0xfffdf5, alpha);
    g.fillCircle(s.x, s.y, 1.8);
    return true;
  }
  if (s.kind === 'pneumatic_press_slam') {
    const r = s.radius * (0.48 + progress * 0.55);
    floorG.fillStyle(0xf97316, alpha * 0.05);
    floorG.fillCircle(s.x, s.y, r);
    floorG.lineStyle(4.6 * alpha, 0x141019, alpha * 0.74);
    floorG.strokeCircle(s.x, s.y, r);
    floorG.lineStyle(2.6 * alpha, 0xf97316, alpha * 0.94);
    floorG.strokeCircle(s.x, s.y, r);
    floorG.lineStyle(1.8 * alpha, 0xfffdf5, alpha * 0.9);
    floorG.strokeCircle(s.x, s.y, r * 0.82);
    return true;
  }
  if (s.kind === 'slag_lava_carpet' && s.x2 !== undefined && s.y2 !== undefined) {
    const wScale = 0.65 + progress * 0.35;
    floorG.lineStyle(34 * wScale, 0x141019, alpha * 0.42);
    floorG.beginPath();
    floorG.moveTo(s.x, s.y);
    floorG.lineTo(s.x2, s.y2);
    floorG.strokePath();
    floorG.lineStyle(24 * wScale, 0xdc2626, alpha * 0.16);
    floorG.beginPath();
    floorG.moveTo(s.x, s.y);
    floorG.lineTo(s.x2, s.y2);
    floorG.strokePath();
    floorG.lineStyle(11 * wScale, 0xf97316, alpha * 0.36);
    floorG.beginPath();
    floorG.moveTo(s.x, s.y);
    floorG.lineTo(s.x2, s.y2);
    floorG.strokePath();
    floorG.lineStyle(3.2 * wScale, 0xfef08a, alpha * 0.68);
    floorG.beginPath();
    floorG.moveTo(s.x, s.y);
    floorG.lineTo(s.x2, s.y2);
    floorG.strokePath();
    return true;
  }
  return false;
}
