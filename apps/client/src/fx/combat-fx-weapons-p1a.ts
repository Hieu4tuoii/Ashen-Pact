import { clamp } from '@ashen-pact/shared';
import type Phaser from 'phaser';
import type { CombatFxManager } from './combat-fx.js';
import {
  type TransientWeaponV2Shape,
  type WeaponV2OverlayState,
  getWeaponV2OverlayState,
} from './combat-fx-weapons-v2.js';

export * from './combat-fx-weapons-p1a-entities.js';

export type Batch1WeaponVfxKind =
  | 'crossbow_rip_tether'
  | 'thorn_whip'
  | 'thorn_bloom_burst'
  | 'scrap_blast_cone'
  | 'scrap_hot_shells'
  | 'gale_wind_blade'
  | 'gale_cyclone_vortex'
  | 'frag_airburst_ring'
  | 'seed_harvest_bloom'
  | 'seed_healing_mist'
  | 'tether_em_yank';

function pushP1AShape(state: WeaponV2OverlayState, shape: TransientWeaponV2Shape): void {
  if (state.shapes.length >= 64) {
    state.shapes.shift();
  }
  state.shapes.push(shape);
}

export function spawnCrossbowBarbedRipVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  playerX: number,
  playerY: number,
  targets: ReadonlyArray<{ x: number; y: number }>,
  totalArrows = 1,
  _locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const effectiveTargets =
    targets.length > 0 ? targets : [{ x: playerX + 90, y: playerY }];
  for (let i = 0; i < effectiveTargets.length; i += 1) {
    const t = effectiveTargets[i]!;
    pushP1AShape(state, {
      kind: 'crossbow_rip_tether',
      x: t.x,
      y: t.y,
      x2: playerX,
      y2: playerY,
      radius: 52,
      count: Math.max(1, totalArrows),
      color: 0x38bdf8,
      ttlSec: 0.34,
      maxTtlSec: 0.34,
    });
    const pullAng = Math.atan2(playerY - t.y, playerX - t.x);
    fx?.spawnShaderDirectional?.(t.x, t.y, 64, pullAng, 'fx_sh_falcon_sonic', {
      tint: 0x7dd3fc,
      ttl: 0.24,
    });
    fx?.spawnHitSparks(t.x, t.y, pullAng, { isCrit: true, element: 'chill', count: 7 });
    fx?.spawnFloorDecal('frost', t.x, t.y, 0.85);
  }
}

export function spawnThornStaffWhipVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  angle: number,
  isFinale = false,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const endX = x + Math.cos(angle) * 240;
  const endY = y + Math.sin(angle) * 240;
  pushP1AShape(state, {
    kind: 'thorn_whip',
    x,
    y,
    x2: endX,
    y2: endY,
    radius: 240,
    angle,
    isFinale,
    color: isFinale ? 0xc084fc : 0x10b981,
    ttlSec: isFinale ? 0.32 : 0.24,
    maxTtlSec: isFinale ? 0.32 : 0.24,
  });
  fx?.spawnShaderSlash?.(
    x,
    y,
    isFinale ? 104 : 84,
    angle,
    'fx_sh_slash_emerald',
    { ttl: isFinale ? 0.24 : 0.19 },
  );
  if (isFinale) {
    fx?.spawnHitSparks(endX, endY, angle + Math.PI, {
      isCrit: true,
      element: 'poison',
      count: 6,
    });
  }
}

export function spawnThornBloomVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  playerX: number,
  playerY: number,
  targets: ReadonlyArray<{ x: number; y: number }>,
  totalThorns = 1,
  _locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const effectiveTargets =
    targets.length > 0 ? targets : [{ x: playerX + 100, y: playerY }];
  for (let i = 0; i < effectiveTargets.length; i += 1) {
    const t = effectiveTargets[i]!;
    pushP1AShape(state, {
      kind: 'thorn_bloom_burst',
      x: t.x,
      y: t.y,
      radius: 58,
      count: Math.max(1, totalThorns),
      color: 0x10b981,
      ttlSec: 0.36,
      maxTtlSec: 0.36,
    });
    fx?.spawnShaderNova?.(t.x, t.y, 58, 'fx_sh_bloom_briar');
    fx?.spawnHitSparks(t.x, t.y, 0, { isCrit: true, element: 'poison', count: 8 });
    fx?.spawnFloorDecal('splatter', t.x, t.y, 1.05);
  }
}

export function spawnScrapShotgunBlastVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  angle: number,
  isFinale = false,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushP1AShape(state, {
    kind: 'scrap_blast_cone',
    x,
    y,
    radius: 96,
    angle,
    isFinale,
    color: isFinale ? 0xf97316 : 0xfacc15,
    ttlSec: isFinale ? 0.28 : 0.2,
    maxTtlSec: isFinale ? 0.28 : 0.2,
  });
  fx?.spawnShaderCone?.(x, y, isFinale ? 104 : 84, angle);
  if (isFinale) {
    fx?.spawnHitSparks(x + Math.cos(angle) * 28, y + Math.sin(angle) * 28, angle, {
      isCrit: true,
      element: 'burn',
      count: 6,
    });
  }
}

export function spawnScrapShotgunShellEjectVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  angle: number,
  _locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushP1AShape(state, {
    kind: 'scrap_hot_shells',
    x,
    y,
    radius: 110,
    angle,
    color: 0xf97316,
    ttlSec: 0.36,
    maxTtlSec: 0.36,
  });
  fx?.spawnShaderCone?.(x, y, 110, angle);
  fx?.spawnShaderNova?.(x, y, 64, 'fx_sh_shrapnel_corona');
  fx?.spawnHitSparks(x + Math.cos(angle) * 44, y + Math.sin(angle) * 44, angle, {
    isCrit: true,
    element: 'burn',
    count: 8,
  });
}

export function spawnGaleWindBladeVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  angle: number,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushP1AShape(state, {
    kind: 'gale_wind_blade',
    x,
    y,
    x2: x + Math.cos(angle) * 260,
    y2: y + Math.sin(angle) * 260,
    radius: 34,
    angle,
    color: 0x2dd4bf,
    ttlSec: 0.28,
    maxTtlSec: 0.28,
  });
  fx?.spawnShaderDirectional?.(x, y, 72, angle, 'fx_sh_falcon_sonic', {
    tint: 0x5eead4,
    ttl: 0.22,
  });
  fx?.spawnHitSparks(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, angle, {
    element: 'chill',
    count: 5,
  });
}

export function spawnGaleCycloneVentVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  radius = 96,
  _locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const cycloneR = radius > 0 ? radius : 96;
  pushP1AShape(state, {
    kind: 'gale_cyclone_vortex',
    x,
    y,
    radius: cycloneR,
    color: 0x2dd4bf,
    ttlSec: 0.3,
    maxTtlSec: 0.3,
  });
  fx?.spawnShaderNova?.(x, y, cycloneR, 'fx_sh_vortex_gale');
  fx?.spawnHitSparks(x, y, 0, { isCrit: true, element: 'chill', count: 10 });
}

export function spawnFragLauncherAirburstVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  radius = 104,
  isAirburst = radius >= 100,
  _locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const effRadius = radius > 0 ? radius : isAirburst ? 104 : 68;
  pushP1AShape(state, {
    kind: 'frag_airburst_ring',
    x,
    y,
    radius: effRadius,
    isAirburst,
    color: 0xf97316,
    ttlSec: 0.3,
    maxTtlSec: 0.3,
  });
  fx?.spawnShaderNova?.(x, y, effRadius, 'fx_sh_shrapnel_corona');
  fx?.spawnFloorDecal('scorch', x, y, isAirburst ? 1.35 : 1.0);
  fx?.spawnHitSparks(x, y, 0, { isCrit: isAirburst, element: 'burn', count: 9 });
}

export function spawnSeedGunHarvestBloomVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  radius = 88,
  releasedHealingMist = false,
  playerX = x,
  playerY = y,
  _locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const bloomR = radius > 0 ? radius : 88;
  pushP1AShape(state, {
    kind: 'seed_harvest_bloom',
    x,
    y,
    radius: bloomR,
    color: 0x10b981,
    ttlSec: 0.3,
    maxTtlSec: 0.3,
  });
  fx?.spawnShaderNova?.(x, y, bloomR, 'fx_sh_bloom_briar');
  fx?.spawnHitSparks(x, y, 0, { isCrit: true, element: 'poison', count: 8 });

  if (releasedHealingMist) {
    pushP1AShape(state, {
      kind: 'seed_healing_mist',
      x,
      y,
      x2: playerX,
      y2: playerY,
      radius: bloomR,
      color: 0x2dd4bf,
      ttlSec: 0.48,
      maxTtlSec: 0.48,
    });
  }
}

export function spawnTetherElectromagneticYankVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  playerX: number,
  playerY: number,
  anchorX?: number,
  anchorY?: number,
  radius = 96,
  _locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const lastBeam = state.lastTetherSnapshot[0];
  const ax = anchorX ?? lastBeam?.x2 ?? playerX + 120;
  const ay = anchorY ?? lastBeam?.y2 ?? playerY;
  const px = lastBeam?.x1 ?? playerX;
  const py = lastBeam?.y1 ?? playerY;
  const effRadius = radius > 0 ? radius : 96;

  pushP1AShape(state, {
    kind: 'tether_em_yank',
    x: ax,
    y: ay,
    x2: px,
    y2: py,
    radius: effRadius,
    color: 0x7c3aed,
    ttlSec: 0.3,
    maxTtlSec: 0.3,
  });
  fx?.spawnShaderNova?.(ax, ay, effRadius, 'fx_sh_anvil_storm', { tint: 0xc084fc });
  fx?.spawnChainLightningArc(px, py, ax, ay);
  fx?.spawnHitSparks(ax, ay, 0, { isCrit: true, element: 'shock', count: 10 });
}

/**
 * Renders the 11 Batch-1 P1A transient Chiaroscuro VFX accents (hollow-core, 1:1 circular, zero opaque discs).
 */
export function drawBatch1TransientShape(
  g: Phaser.GameObjects.Graphics,
  s: TransientWeaponV2Shape,
  progress: number,
  alpha: number,
  clockSec: number,
  index: number,
  groundG?: Phaser.GameObjects.Graphics,
): boolean {
  const floorG = groundG ?? g;
  switch (s.kind) {
    case 'crossbow_rip_tether': {
      const px = s.x2 ?? s.x;
      const py = s.y2 ?? s.y;
      g.lineStyle(4.0 * alpha, 0x071726, alpha * 0.82);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(px, py);
      g.strokePath();

      g.lineStyle(2.2, 0x38bdf8, alpha * 0.94);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(px, py);
      g.strokePath();

      g.lineStyle(1.0, 0xfffdf5, alpha);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(px, py);
      g.strokePath();

      const arrowCount = clamp(s.count ?? 2, 1, 4);
      const ang = Math.atan2(py - s.y, px - s.x);
      for (let k = 0; k < arrowCount; k += 1) {
        const t = clamp(progress * 0.85 + k * 0.12, 0, 0.95);
        const ax = s.x + (px - s.x) * t;
        const ay = s.y + (py - s.y) * t;
        g.lineStyle(2.0, 0xbae6fd, alpha);
        g.beginPath();
        g.moveTo(ax - Math.cos(ang) * 9, ay - Math.sin(ang) * 9);
        g.lineTo(ax + Math.cos(ang) * 5, ay + Math.sin(ang) * 5);
        g.strokePath();
      }

      const slowR = s.radius * (0.45 + progress * 0.55);
      floorG.lineStyle(1.8, 0x38bdf8, alpha * 0.72);
      floorG.strokeCircle(s.x, s.y, slowR);
      g.lineStyle(1.6, 0xf43f5e, alpha * 0.86);
      for (let k = 0; k < 6; k += 1) {
        const a = (k * Math.PI) / 3 + progress * 0.5;
        g.beginPath();
        g.moveTo(s.x + Math.cos(a) * (slowR * 0.65), s.y + Math.sin(a) * (slowR * 0.65));
        g.lineTo(s.x + Math.cos(a) * (slowR * 1.02), s.y + Math.sin(a) * (slowR * 1.02));
        g.strokePath();
      }
      return true;
    }

    case 'thorn_whip': {
      const endX = s.x2 ?? s.x + Math.cos(s.angle ?? 0) * 240;
      const endY = s.y2 ?? s.y + Math.sin(s.angle ?? 0) * 240;
      const dx = endX - s.x;
      const dy = endY - s.y;
      const dist = Math.hypot(dx, dy) || 240;
      const nx = -dy / dist;
      const ny = dx / dist;
      const segs = 10;

      const strokeWhipPass = (lw: number, col: number, a: number): void => {
        g.lineStyle(lw, col, a);
        g.beginPath();
        g.moveTo(s.x, s.y);
        for (let k = 1; k <= segs; k += 1) {
          const t = k / segs;
          const wave =
            Math.sin(t * Math.PI * 3 - progress * 9 + index) * (1 - t * 0.25) * 9.5;
          g.lineTo(s.x + dx * t + nx * wave, s.y + dy * t + ny * wave);
        }
        g.strokePath();
      };
      strokeWhipPass(4.8, 0x041a12, alpha * 0.86);
      strokeWhipPass(2.8, 0x10b981, alpha * 0.96);
      strokeWhipPass(1.3, s.isFinale ? 0xf0abfc : 0xfffdf5, alpha);

      g.lineStyle(1.6, 0xc084fc, alpha * 0.92);
      for (let k = 1; k < segs; k += 1) {
        const t = k / segs;
        const wave =
          Math.sin(t * Math.PI * 3 - progress * 9 + index) * (1 - t * 0.25) * 9.5;
        const vx = s.x + dx * t + nx * wave;
        const vy = s.y + dy * t + ny * wave;
        const side = k % 2 === 0 ? 1 : -1;
        g.beginPath();
        g.moveTo(vx, vy);
        g.lineTo(vx + nx * side * 7 - (dx / dist) * 3.5, vy + ny * side * 7 - (dy / dist) * 3.5);
        g.strokePath();
      }

      if (s.isFinale) {
        const pullT = 1 - progress * 0.35;
        const hx = s.x + dx * pullT;
        const hy = s.y + dy * pullT;
        g.lineStyle(2.2, 0xc084fc, alpha * 0.94);
        g.strokeCircle(hx, hy, 11);
        g.lineStyle(1.6, 0xfffdf5, alpha);
        g.beginPath();
        g.moveTo(hx, hy);
        g.lineTo(hx - (dx / dist) * 22 + nx * 8, hy - (dy / dist) * 22 + ny * 8);
        g.moveTo(hx, hy);
        g.lineTo(hx - (dx / dist) * 22 - nx * 8, hy - (dy / dist) * 22 - ny * 8);
        g.strokePath();
      }
      return true;
    }

    case 'thorn_bloom_burst': {
      // Hollow perimeter-only hooked rose-briar burst synchronized 1:1 with fx_sh_bloom_briar
      const ease = 1 - Math.pow(1 - progress, 2.7);
      const r = s.radius * (0.24 + ease * 0.76);
      floorG.lineStyle(3.2, 0x141019, alpha * 0.72);
      floorG.strokeCircle(s.x, s.y, r);
      floorG.lineStyle(1.9, 0x10b981, alpha * 0.84);
      floorG.strokeCircle(s.x, s.y, r);
      const needles = 6 + Math.min(4, s.count ?? 2);
      for (let k = 0; k < needles; k += 1) {
        const a = (k * Math.PI * 2) / needles + progress * 0.3;
        const hookA = a + (k % 2 === 0 ? 0.16 : -0.16);
        const innerD = r * 0.72;
        const midD = r * 0.9;
        const outerD = r * 1.05;
        g.lineStyle(3.4, 0x141019, alpha * 0.84);
        g.beginPath();
        g.moveTo(s.x + Math.cos(a) * innerD, s.y + Math.sin(a) * innerD);
        g.lineTo(s.x + Math.cos(hookA) * midD, s.y + Math.sin(hookA) * midD);
        g.lineTo(s.x + Math.cos(a) * outerD, s.y + Math.sin(a) * outerD);
        g.strokePath();
        g.lineStyle(1.9, k % 2 === 0 ? 0x4ade80 : 0xc084fc, alpha * 0.94);
        g.beginPath();
        g.moveTo(s.x + Math.cos(a) * innerD, s.y + Math.sin(a) * innerD);
        g.lineTo(s.x + Math.cos(hookA) * midD, s.y + Math.sin(hookA) * midD);
        g.lineTo(s.x + Math.cos(a) * outerD, s.y + Math.sin(a) * outerD);
        g.strokePath();
      }
      return true;
    }

    case 'scrap_blast_cone': {
      const ang = s.angle ?? 0;
      const halfArc = 0.46;
      const r = s.radius * (0.52 + progress * 0.48);
      g.lineStyle(3.0, 0x26080d, alpha * 0.72);
      g.beginPath();
      g.arc(s.x, s.y, r, ang - halfArc, ang + halfArc, false);
      g.strokePath();

      g.lineStyle(1.8, s.isFinale ? 0xf97316 : 0xfacc15, alpha * 0.88);
      g.beginPath();
      g.arc(s.x, s.y, r, ang - halfArc * 0.94, ang + halfArc * 0.94, false);
      g.strokePath();
      return true;
    }

    case 'scrap_hot_shells': {
      const ang = s.angle ?? 0;
      const shellDist = s.radius * (0.28 + progress * 0.68);
      for (const side of [-1, 1] as const) {
        const sAng = ang + side * 0.28;
        const sx = s.x + Math.cos(sAng) * shellDist;
        const sy = s.y + Math.sin(sAng) * shellDist;
        const spin = clockSec * 24 * side + progress * 8;
        const scos = Math.cos(spin);
        const ssin = Math.sin(spin);

        g.lineStyle(1.8, 0xf97316, alpha * 0.78);
        g.beginPath();
        g.moveTo(s.x + Math.cos(sAng) * 18, s.y + Math.sin(sAng) * 18);
        g.lineTo(sx, sy);
        g.strokePath();

        g.lineStyle(4.8, 0x26080d, alpha * 0.92);
        g.beginPath();
        g.moveTo(sx - scos * 5.2, sy - ssin * 5.2);
        g.lineTo(sx + scos * 5.2, sy + ssin * 5.2);
        g.strokePath();

        g.lineStyle(3.0, 0xef4444, alpha * 0.98);
        g.beginPath();
        g.moveTo(sx - scos * 4.4, sy - ssin * 4.4);
        g.lineTo(sx + scos * 4.4, sy + ssin * 4.4);
        g.strokePath();

        g.fillStyle(0xfffdf5, alpha);
        g.fillCircle(sx + scos * 3.4, sy + ssin * 3.4, 2.2);
      }
      return true;
    }

    case 'gale_wind_blade': {
      const ang = s.angle ?? 0;
      const dist = 215 * progress;
      const bx = s.x + Math.cos(ang) * dist;
      const by = s.y + Math.sin(ang) * dist;
      g.lineStyle(3.4, 0x041f1c, alpha * 0.8);
      g.beginPath();
      g.arc(bx, by, 20, ang - 1.05, ang + 1.05, false);
      g.strokePath();

      g.lineStyle(2.0, 0x2dd4bf, alpha * 0.94);
      g.beginPath();
      g.arc(bx, by, 20, ang - 1.0, ang + 1.0, false);
      g.strokePath();

      g.lineStyle(1.1, 0xfffdf5, alpha);
      g.beginPath();
      g.arc(bx, by, 17, ang - 0.85, ang + 0.85, false);
      g.strokePath();
      return true;
    }

    case 'gale_cyclone_vortex': {
      // Hollow 1:1 6-blade logarithmic wind shear spiral synchronized with fx_sh_vortex_gale
      const ease = 1 - Math.pow(1 - progress, 2.7);
      const r = s.radius * (0.24 + ease * 0.76);
      floorG.lineStyle(3.0, 0x141019, alpha * 0.7);
      floorG.strokeCircle(s.x, s.y, r);
      floorG.lineStyle(1.9, 0x2dd4bf, alpha * 0.82);
      floorG.strokeCircle(s.x, s.y, r);
      for (let arm = 0; arm < 6; arm += 1) {
        const baseA = (arm * Math.PI * 2) / 6 + progress * 4.2;
        const innerR = r * 0.62;
        const midR = r * 0.82;
        const outerR = r * 0.98;
        g.lineStyle(3.4, 0x141019, alpha * 0.78);
        g.beginPath();
        g.moveTo(s.x + Math.cos(baseA) * innerR, s.y + Math.sin(baseA) * innerR);
        g.lineTo(s.x + Math.cos(baseA + 0.38) * midR, s.y + Math.sin(baseA + 0.38) * midR);
        g.lineTo(s.x + Math.cos(baseA + 0.76) * outerR, s.y + Math.sin(baseA + 0.76) * outerR);
        g.strokePath();
        g.lineStyle(1.8, arm % 2 === 0 ? 0x5eead4 : 0xfffdf5, alpha * 0.92);
        g.beginPath();
        g.moveTo(s.x + Math.cos(baseA) * innerR, s.y + Math.sin(baseA) * innerR);
        g.lineTo(s.x + Math.cos(baseA + 0.38) * midR, s.y + Math.sin(baseA + 0.38) * midR);
        g.lineTo(s.x + Math.cos(baseA + 0.76) * outerR, s.y + Math.sin(baseA + 0.76) * outerR);
        g.strokePath();
      }
      return true;
    }

    case 'frag_airburst_ring': {
      // Hollow 1:1 ordnance perimeter synchronized with fx_sh_shrapnel_corona + 6 obsidian-cased warheads
      const ease = 1 - Math.pow(1 - progress, 2.7);
      const r = s.radius * (0.24 + ease * 0.76);
      floorG.lineStyle(3.2, 0x141019, alpha * 0.74);
      floorG.strokeCircle(s.x, s.y, r);
      floorG.lineStyle(2.0, 0xf97316, alpha * 0.84);
      floorG.strokeCircle(s.x, s.y, r);

      for (let k = 0; k < 6; k += 1) {
        const subA = (k * Math.PI * 2) / 6 - Math.PI * 0.5 + 0.25;
        const subDist = r * (0.44 + progress * 0.54);
        const sx = s.x + Math.cos(subA) * subDist;
        const sy = s.y + Math.sin(subA) * subDist;

        g.lineStyle(3.2, 0x141019, alpha * 0.84);
        g.beginPath();
        g.moveTo(s.x + Math.cos(subA) * (r * 0.3), s.y + Math.sin(subA) * (r * 0.3));
        g.lineTo(sx, sy);
        g.strokePath();

        g.lineStyle(1.7, 0xfacc15, alpha * 0.92);
        g.beginPath();
        g.moveTo(s.x + Math.cos(subA) * (r * 0.3), s.y + Math.sin(subA) * (r * 0.3));
        g.lineTo(sx, sy);
        g.strokePath();

        g.fillStyle(0x141019, alpha * 0.94);
        g.fillCircle(sx, sy, 4.8);
        g.fillStyle(0xf97316, alpha * 0.96);
        g.fillCircle(sx, sy, 3.4);
        g.fillStyle(0xfffdf5, alpha);
        g.fillCircle(sx, sy, 1.7);
      }
      return true;
    }

    case 'seed_harvest_bloom': {
      // Hollow 1:1 6-petal unfurling botanical lotus synchronized with fx_sh_bloom_briar
      const ease = 1 - Math.pow(1 - progress, 2.7);
      const r = s.radius * (0.24 + ease * 0.76);
      floorG.lineStyle(3.0, 0x141019, alpha * 0.72);
      floorG.strokeCircle(s.x, s.y, r);
      floorG.lineStyle(2.0, 0x10b981, alpha * 0.84);
      floorG.strokeCircle(s.x, s.y, r);
      for (let p = 0; p < 6; p += 1) {
        const a = (p * Math.PI) / 3 + progress * 0.25;
        const px0 = s.x + Math.cos(a - 0.36) * (r * 0.8);
        const py0 = s.y + Math.sin(a - 0.36) * (r * 0.8);
        const tipX = s.x + Math.cos(a) * (r * 1.04);
        const tipY = s.y + Math.sin(a) * (r * 1.04);
        const px1 = s.x + Math.cos(a + 0.36) * (r * 0.8);
        const py1 = s.y + Math.sin(a + 0.36) * (r * 0.8);
        g.lineStyle(3.2, 0x141019, alpha * 0.82);
        g.beginPath();
        g.moveTo(px0, py0);
        g.lineTo(tipX, tipY);
        g.lineTo(px1, py1);
        g.strokePath();
        g.lineStyle(1.8, p % 2 === 0 ? 0x4ade80 : 0xfacc15, alpha * 0.94);
        g.beginPath();
        g.moveTo(px0, py0);
        g.lineTo(tipX, tipY);
        g.lineTo(px1, py1);
        g.strokePath();
      }
      return true;
    }

    case 'seed_healing_mist': {
      const r = s.radius * (0.62 + progress * 0.38);
      floorG.fillStyle(0x2dd4bf, alpha * 0.045);
      floorG.fillCircle(s.x, s.y, r);
      floorG.lineStyle(1.9, 0x2dd4bf, alpha * 0.78);
      floorG.strokeCircle(s.x, s.y, r);

      const px = s.x2 ?? s.x;
      const py = s.y2 ?? s.y;
      floorG.lineStyle(1.8, 0x6ee7b7, alpha * 0.82);
      floorG.strokeCircle(px, py, 24 + progress * 10);

      for (let k = 0; k < 4; k += 1) {
        const ang = (k * Math.PI) / 2 + progress * 0.8;
        const rx = px + Math.cos(ang) * 20;
        const ry = py + Math.sin(ang) * 20;
        g.lineStyle(1.8, k % 2 === 0 ? 0x4ade80 : 0x38bdf8, alpha * 0.92);
        g.beginPath();
        g.moveTo(rx - 3.5, ry);
        g.lineTo(rx + 3.5, ry);
        g.moveTo(rx, ry - 3.5);
        g.lineTo(rx, ry + 3.5);
        g.strokePath();
      }
      return true;
    }

    case 'tether_em_yank': {
      const px = s.x2 ?? s.x;
      const py = s.y2 ?? s.y;
      const ease = 1 - Math.pow(1 - progress, 2.7);
      const contractR = s.radius * (1 - progress * 0.48);
      const novaR = s.radius * (0.24 + ease * 0.76);

      g.lineStyle(3.2, 0x0c0620, alpha * 0.78);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(s.x, s.y);
      g.strokePath();
      g.lineStyle(1.8, 0x7c3aed, alpha * 0.9);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(s.x, s.y);
      g.strokePath();

      floorG.lineStyle(1.8, 0x38bdf8, alpha * 0.76);
      floorG.strokeCircle(s.x, s.y, contractR);
      floorG.lineStyle(2.0, 0xa855f7, alpha * 0.82);
      floorG.strokeCircle(s.x, s.y, novaR);
      return true;
    }

    default:
      return false;
  }
}
