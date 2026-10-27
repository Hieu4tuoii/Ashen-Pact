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
  locale: 'vi' | 'en' = 'vi',
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
      ttlSec: 0.38,
      maxTtlSec: 0.38,
    });
    const pullAng = Math.atan2(playerY - t.y, playerX - t.x);
    fx?.spawnHitSparks(t.x, t.y, pullAng, { isCrit: true, element: 'chill', count: 7 });
    fx?.spawnFloorDecal('frost', t.x, t.y, 0.85);
  }
  const label =
    locale === 'en' ? `BARBED RIP! ×${totalArrows}` : `RÚT TÊN! ×${totalArrows}`;
  fx?.spawnFloatingAlert(playerX, playerY - 10, label, '#38BDF8');
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
    color: isFinale ? 0xc084fc : 0x4ade80,
    ttlSec: isFinale ? 0.34 : 0.25,
    maxTtlSec: isFinale ? 0.34 : 0.25,
  });
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
  locale: 'vi' | 'en' = 'vi',
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
      color: 0x4ade80,
      ttlSec: 0.4,
      maxTtlSec: 0.4,
    });
    fx?.spawnHitSparks(t.x, t.y, 0, { isCrit: true, element: 'poison', count: 8 });
    fx?.spawnFloorDecal('splatter', t.x, t.y, 1.05);
  }
  const label =
    locale === 'en' ? `THORN BLOOM! ×${totalThorns}` : `NỞ GAI ĐỘC! ×${totalThorns}`;
  fx?.spawnFloatingAlert(playerX, playerY - 10, label, '#4ADE80');
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
    ttlSec: isFinale ? 0.3 : 0.22,
    maxTtlSec: isFinale ? 0.3 : 0.22,
  });
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
  locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushP1AShape(state, {
    kind: 'scrap_hot_shells',
    x,
    y,
    radius: 110,
    angle,
    color: 0xf97316,
    ttlSec: 0.38,
    maxTtlSec: 0.38,
  });
  fx?.spawnHitSparks(x + Math.cos(angle) * 44, y + Math.sin(angle) * 44, angle, {
    isCrit: true,
    element: 'burn',
    count: 8,
  });
  fx?.spawnFloatingAlert(
    x,
    y - 12,
    locale === 'en' ? 'HOT SHELLS!' : 'VỎ ĐẠN NÓNG!',
    '#F97316',
  );
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
    ttlSec: 0.3,
    maxTtlSec: 0.3,
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
  locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushP1AShape(state, {
    kind: 'gale_cyclone_vortex',
    x,
    y,
    radius: Math.max(radius, 96),
    color: 0x2dd4bf,
    ttlSec: 0.44,
    maxTtlSec: 0.44,
  });
  fx?.spawnHitSparks(x, y, 0, { isCrit: true, element: 'chill', count: 10 });
  fx?.spawnFloatingAlert(
    x,
    y - 12,
    locale === 'en' ? 'CYCLONE VENT!' : 'LỐC XOÁY!',
    '#2DD4BF',
  );
}

export function spawnFragLauncherAirburstVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  radius = 104,
  isAirburst = radius >= 100,
  locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushP1AShape(state, {
    kind: 'frag_airburst_ring',
    x,
    y,
    radius: isAirburst ? Math.max(radius, 104) : Math.max(radius, 68),
    isAirburst,
    color: 0xf97316,
    ttlSec: 0.42,
    maxTtlSec: 0.42,
  });
  fx?.spawnFloorDecal('scorch', x, y, isAirburst ? 1.35 : 1.0);
  fx?.spawnHitSparks(x, y, 0, { isCrit: isAirburst, element: 'burn', count: 9 });
  if (isAirburst) {
    fx?.spawnFloatingAlert(
      x,
      y - 10,
      locale === 'en' ? 'AIRBURST!' : 'NỔ TRÊN KHÔNG!',
      '#FACC15',
    );
  }
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
  locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const bloomR = Math.max(radius, 88);
  pushP1AShape(state, {
    kind: 'seed_harvest_bloom',
    x,
    y,
    radius: bloomR,
    color: 0x4ade80,
    ttlSec: 0.44,
    maxTtlSec: 0.44,
  });
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
      ttlSec: 0.55,
      maxTtlSec: 0.55,
    });
    fx?.spawnFloatingAlert(
      playerX,
      playerY - 12,
      locale === 'en' ? '✚ HEALING MIST!' : '✚ SƯƠNG HỒI PHỤC!',
      '#2DD4BF',
    );
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
  locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const lastBeam = state.lastTetherSnapshot[0];
  const ax = anchorX ?? lastBeam?.x2 ?? playerX + 120;
  const ay = anchorY ?? lastBeam?.y2 ?? playerY;
  const px = lastBeam?.x1 ?? playerX;
  const py = lastBeam?.y1 ?? playerY;

  pushP1AShape(state, {
    kind: 'tether_em_yank',
    x: ax,
    y: ay,
    x2: px,
    y2: py,
    radius: Math.max(radius, 96),
    color: 0xa855f7,
    ttlSec: 0.44,
    maxTtlSec: 0.44,
  });
  fx?.spawnChainLightningArc(px, py, ax, ay);
  fx?.spawnHitSparks(ax, ay, 0, { isCrit: true, element: 'shock', count: 10 });
  fx?.spawnFloatingAlert(
    ax,
    ay - 12,
    locale === 'en' ? '⚡ EM YANK NOVA!' : '⚡ XUNG KÉO ĐIỆN TỪ!',
    '#C084FC',
  );
}

/**
 * Renders the 11 Batch-1 P1A transient procedural VFX shapes onto the scene Graphics overlay.
 */
export function drawBatch1TransientShape(
  g: Phaser.GameObjects.Graphics,
  s: TransientWeaponV2Shape,
  progress: number,
  alpha: number,
  clockSec: number,
  index: number,
): boolean {
  switch (s.kind) {
    case 'crossbow_rip_tether': {
      const px = s.x2 ?? s.x;
      const py = s.y2 ?? s.y;
      g.lineStyle(5.2 * alpha, 0x141019, alpha * 0.85);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(px, py);
      g.strokePath();

      g.lineStyle(3.0, 0x38bdf8, alpha * 0.96);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(px, py);
      g.strokePath();

      g.lineStyle(1.4, 0xfffdf5, alpha);
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
        g.lineStyle(2.4, 0x7dd3fc, alpha);
        g.beginPath();
        g.moveTo(ax - Math.cos(ang) * 10, ay - Math.sin(ang) * 10);
        g.lineTo(ax + Math.cos(ang) * 6, ay + Math.sin(ang) * 6);
        g.strokePath();
      }

      const slowR = s.radius * (0.35 + progress * 0.72);
      g.lineStyle(3.2, 0x38bdf8, alpha * 0.92);
      g.strokeCircle(s.x, s.y, slowR);
      g.lineStyle(1.8, 0xf43f5e, alpha * 0.85);
      for (let k = 0; k < 6; k += 1) {
        const a = (k * Math.PI) / 3 + progress * 0.6;
        g.beginPath();
        g.moveTo(s.x + Math.cos(a) * 6, s.y + Math.sin(a) * 6);
        g.lineTo(
          s.x + Math.cos(a) * (16 + progress * 18),
          s.y + Math.sin(a) * (16 + progress * 18),
        );
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

      const layers: readonly [number, number, number][] = [
        [6.2, 0x141019, alpha * 0.9],
        [3.6, 0x22c55e, alpha * 0.96],
        [1.8, s.isFinale ? 0xe879f9 : 0x86efac, alpha],
      ];
      for (const [lw, col, a] of layers) {
        g.lineStyle(lw, col, a);
        g.beginPath();
        g.moveTo(s.x, s.y);
        for (let k = 1; k <= segs; k += 1) {
          const t = k / segs;
          const wave =
            Math.sin(t * Math.PI * 3 - progress * 9 + index) * (1 - t * 0.25) * 11;
          g.lineTo(s.x + dx * t + nx * wave, s.y + dy * t + ny * wave);
        }
        g.strokePath();
      }

      g.lineStyle(2.0, 0xc084fc, alpha * 0.95);
      for (let k = 1; k < segs; k += 1) {
        const t = k / segs;
        const wave =
          Math.sin(t * Math.PI * 3 - progress * 9 + index) * (1 - t * 0.25) * 11;
        const vx = s.x + dx * t + nx * wave;
        const vy = s.y + dy * t + ny * wave;
        const side = k % 2 === 0 ? 1 : -1;
        g.beginPath();
        g.moveTo(vx, vy);
        g.lineTo(vx + nx * side * 8 - (dx / dist) * 4, vy + ny * side * 8 - (dy / dist) * 4);
        g.strokePath();
      }

      if (s.isFinale) {
        const pullT = 1 - progress * 0.38;
        const hx = s.x + dx * pullT;
        const hy = s.y + dy * pullT;
        g.lineStyle(3.0, 0xc084fc, alpha * 0.96);
        g.strokeCircle(hx, hy, 12);
        g.lineStyle(2.2, 0xfef08a, alpha);
        g.beginPath();
        g.moveTo(hx, hy);
        g.lineTo(hx - (dx / dist) * 28 + nx * 10, hy - (dy / dist) * 28 + ny * 10);
        g.moveTo(hx, hy);
        g.lineTo(hx - (dx / dist) * 28 - nx * 10, hy - (dy / dist) * 28 - ny * 10);
        g.strokePath();
      }
      return true;
    }

    case 'thorn_bloom_burst': {
      const r = s.radius * (0.35 + progress * 0.75);
      g.fillStyle(0xc084fc, alpha * 0.24);
      g.fillCircle(s.x, s.y, r);
      g.lineStyle(3.4, 0x141019, alpha * 0.85);
      g.strokeCircle(s.x, s.y, r);
      g.lineStyle(2.4, 0x4ade80, alpha * 0.96);
      g.strokeCircle(s.x, s.y, r);
      g.lineStyle(1.8, 0xc084fc, alpha * 0.88);
      g.strokeCircle(s.x, s.y, r * 0.65);

      const needles = 8 + Math.min(4, s.count ?? 2);
      for (let k = 0; k < needles; k += 1) {
        const a = (k * Math.PI * 2) / needles + progress * 0.35;
        const innerD = r * 0.35;
        const outerD = r * 1.15;
        g.lineStyle(2.6, k % 2 === 0 ? 0x4ade80 : 0xe879f9, alpha * 0.96);
        g.beginPath();
        g.moveTo(s.x + Math.cos(a) * innerD, s.y + Math.sin(a) * innerD);
        g.lineTo(s.x + Math.cos(a) * outerD, s.y + Math.sin(a) * outerD);
        g.strokePath();
      }
      return true;
    }

    case 'scrap_blast_cone': {
      const ang = s.angle ?? 0;
      const halfArc = 0.48;
      const r = s.radius * (0.4 + progress * 0.6);
      g.lineStyle(4.2, 0x141019, alpha * 0.82);
      g.beginPath();
      g.arc(s.x, s.y, r, ang - halfArc, ang + halfArc, false);
      g.strokePath();

      g.lineStyle(2.8, s.isFinale ? 0xf97316 : 0xfacc15, alpha * 0.95);
      g.beginPath();
      g.arc(s.x, s.y, r, ang - halfArc, ang + halfArc, false);
      g.strokePath();

      if (s.isFinale) {
        for (let k = -2; k <= 2; k += 1) {
          const rayA = ang + k * 0.18;
          g.lineStyle(2.2, k % 2 === 0 ? 0xfacc15 : 0xf97316, alpha * 0.92);
          g.beginPath();
          g.moveTo(s.x + Math.cos(rayA) * 14, s.y + Math.sin(rayA) * 14);
          g.lineTo(s.x + Math.cos(rayA) * r, s.y + Math.sin(rayA) * r);
          g.strokePath();
        }
      }
      return true;
    }

    case 'scrap_hot_shells': {
      const ang = s.angle ?? 0;
      const halfArc = (60 * Math.PI) / 180;
      const coneR = s.radius * (0.45 + progress * 0.55);

      g.lineStyle(4.0, 0x141019, alpha * 0.85);
      g.beginPath();
      g.arc(s.x, s.y, coneR, ang - halfArc, ang + halfArc, false);
      g.strokePath();

      g.lineStyle(2.6, 0xf97316, alpha * 0.94);
      g.beginPath();
      g.arc(s.x, s.y, coneR, ang - halfArc, ang + halfArc, false);
      g.strokePath();

      const shellDist = s.radius * (0.25 + progress * 0.72);
      for (const side of [-1, 1] as const) {
        const sAng = ang + side * 0.28;
        const sx = s.x + Math.cos(sAng) * shellDist;
        const sy = s.y + Math.sin(sAng) * shellDist;
        const spin = clockSec * 24 * side + progress * 8;
        const scos = Math.cos(spin);
        const ssin = Math.sin(spin);

        g.lineStyle(2.4, 0xf97316, alpha * 0.85);
        g.beginPath();
        g.moveTo(s.x + Math.cos(sAng) * 14, s.y + Math.sin(sAng) * 14);
        g.lineTo(sx, sy);
        g.strokePath();

        g.lineStyle(6.5, 0x141019, alpha * 0.95);
        g.beginPath();
        g.moveTo(sx - scos * 6, sy - ssin * 6);
        g.lineTo(sx + scos * 6, sy + ssin * 6);
        g.strokePath();

        g.lineStyle(4.2, 0xef4444, alpha * 0.98);
        g.beginPath();
        g.moveTo(sx - scos * 5, sy - ssin * 5);
        g.lineTo(sx + scos * 5, sy + ssin * 5);
        g.strokePath();

        g.fillStyle(0xfacc15, alpha);
        g.fillCircle(sx + scos * 4, sy + ssin * 4, 2.8);
      }
      return true;
    }

    case 'gale_wind_blade': {
      const ang = s.angle ?? 0;
      const dist = 220 * progress;
      const bx = s.x + Math.cos(ang) * dist;
      const by = s.y + Math.sin(ang) * dist;
      g.lineStyle(4.5, 0x141019, alpha * 0.85);
      g.beginPath();
      g.arc(bx, by, 22, ang - 1.1, ang + 1.1, false);
      g.strokePath();

      g.lineStyle(2.8, 0x2dd4bf, alpha * 0.96);
      g.beginPath();
      g.arc(bx, by, 22, ang - 1.1, ang + 1.1, false);
      g.strokePath();

      g.lineStyle(1.4, 0xfffdf5, alpha);
      g.beginPath();
      g.arc(bx, by, 18, ang - 0.9, ang + 0.9, false);
      g.strokePath();
      return true;
    }

    case 'gale_cyclone_vortex': {
      const r = s.radius * (0.45 + progress * 0.55);
      g.fillStyle(0x2dd4bf, alpha * 0.14);
      g.fillCircle(s.x, s.y, r);
      g.lineStyle(4.5, 0x141019, alpha * 0.85);
      g.strokeCircle(s.x, s.y, r);
      g.lineStyle(3.0, 0x2dd4bf, alpha * 0.96);
      g.strokeCircle(s.x, s.y, r);
      g.lineStyle(2.0, 0x38bdf8, alpha * 0.88);
      g.strokeCircle(s.x, s.y, r * 0.68);
      g.lineStyle(1.6, 0xfffdf5, alpha * 0.9);
      g.strokeCircle(s.x, s.y, r * 0.38);

      for (let arm = 0; arm < 6; arm += 1) {
        const baseA = (arm * Math.PI) / 3 + progress * 4.2;
        g.lineStyle(2.2, arm % 2 === 0 ? 0x6ee7b7 : 0x7dd3fc, alpha * 0.92);
        g.beginPath();
        for (let step = 0; step <= 6; step += 1) {
          const t = step / 6;
          const sr = r * (0.18 + t * 0.82);
          const sa = baseA + t * 1.65;
          const wx = s.x + Math.cos(sa) * sr;
          const wy = s.y + Math.sin(sa) * sr;
          if (step === 0) g.moveTo(wx, wy);
          else g.lineTo(wx, wy);
        }
        g.strokePath();
      }
      return true;
    }

    case 'frag_airburst_ring': {
      const r = s.radius * (0.4 + progress * 0.6);
      g.fillStyle(0xf97316, alpha * 0.16);
      g.fillCircle(s.x, s.y, r);
      g.lineStyle(4.8, 0x141019, alpha * 0.88);
      g.strokeCircle(s.x, s.y, r);
      g.lineStyle(3.2, 0xf97316, alpha * 0.96);
      g.strokeCircle(s.x, s.y, r);
      g.lineStyle(2.0, 0xfacc15, alpha * 0.92);
      g.strokeCircle(s.x, s.y, r * 0.72);

      const chR = 18 + progress * 12;
      g.lineStyle(2.2, 0xfffdf5, alpha * 0.95);
      g.strokeCircle(s.x, s.y, chR);
      g.beginPath();
      g.moveTo(s.x - chR - 8, s.y);
      g.lineTo(s.x + chR + 8, s.y);
      g.moveTo(s.x, s.y - chR - 8);
      g.lineTo(s.x, s.y + chR + 8);
      g.strokePath();

      for (let k = 0; k < 5; k += 1) {
        const subA = (k * Math.PI * 2) / 5 - Math.PI * 0.5 + 0.25;
        const subDist = r * (0.35 + progress * 0.62);
        const arcLift = Math.sin(progress * Math.PI) * 22;
        const sx = s.x + Math.cos(subA) * subDist;
        const sy = s.y + Math.sin(subA) * subDist - arcLift;
        const midX = s.x + Math.cos(subA) * (subDist * 0.5);
        const midY = s.y + Math.sin(subA) * (subDist * 0.5) - arcLift * 1.35;

        g.lineStyle(2.4, 0xfacc15, alpha * 0.9);
        g.beginPath();
        g.moveTo(s.x, s.y);
        g.lineTo(midX, midY);
        g.lineTo(sx, sy);
        g.strokePath();

        g.fillStyle(0xf97316, alpha * 0.96);
        g.fillCircle(sx, sy, 4.2);
        g.fillStyle(0xfffdf5, alpha);
        g.fillCircle(sx, sy, 2.0);
      }
      return true;
    }

    case 'seed_harvest_bloom': {
      const r = s.radius * (0.42 + progress * 0.58);
      g.fillStyle(0x4ade80, alpha * 0.16);
      g.fillCircle(s.x, s.y, r);
      g.lineStyle(4.2, 0x141019, alpha * 0.85);
      g.strokeCircle(s.x, s.y, r);
      g.lineStyle(2.8, 0x4ade80, alpha * 0.96);
      g.strokeCircle(s.x, s.y, r);

      for (let pIdx = 0; pIdx < 8; pIdx += 1) {
        const a = (pIdx * Math.PI) / 4 + progress * 0.25;
        const px = s.x + Math.cos(a) * (r * 0.58);
        const py = s.y + Math.sin(a) * (r * 0.58);
        g.lineStyle(2.2, pIdx % 2 === 0 ? 0x4ade80 : 0xfacc15, alpha * 0.94);
        g.strokeCircle(px, py, r * 0.28);
        g.beginPath();
        g.moveTo(s.x, s.y);
        g.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
        g.strokePath();
      }
      return true;
    }

    case 'seed_healing_mist': {
      const r = s.radius * (0.5 + progress * 0.5);
      g.fillStyle(0x2dd4bf, alpha * 0.18);
      g.fillCircle(s.x, s.y, r);
      g.lineStyle(2.6, 0x2dd4bf, alpha * 0.94);
      g.strokeCircle(s.x, s.y, r * 0.85);
      g.lineStyle(1.8, 0x6ee7b7, alpha * 0.85);
      g.strokeCircle(s.x, s.y, r * 0.52);

      const px = s.x2 ?? s.x;
      const py = s.y2 ?? s.y;
      g.lineStyle(2.4, 0x2dd4bf, alpha * 0.92);
      g.strokeCircle(px, py, 26 + progress * 14);

      for (let k = 0; k < 5; k += 1) {
        const rx = px + (k - 2) * 14;
        const ry = py - 8 - progress * 28 - (k % 2) * 8;
        g.lineStyle(2.2, k % 2 === 0 ? 0x4ade80 : 0x38bdf8, alpha * 0.96);
        g.beginPath();
        g.moveTo(rx - 4, ry);
        g.lineTo(rx + 4, ry);
        g.moveTo(rx, ry - 4);
        g.lineTo(rx, ry + 4);
        g.strokePath();
      }
      return true;
    }

    case 'tether_em_yank': {
      const px = s.x2 ?? s.x;
      const py = s.y2 ?? s.y;
      const contractR = s.radius * (1 - progress * 0.62);
      const novaR = s.radius * (0.32 + progress * 0.68);

      g.lineStyle(4.2, 0xa855f7, alpha * 0.9);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(s.x, s.y);
      g.strokePath();

      g.fillStyle(0xa855f7, alpha * 0.2);
      g.fillCircle(s.x, s.y, novaR);
      g.lineStyle(2.6, 0x38bdf8, alpha * 0.92);
      g.strokeCircle(s.x, s.y, contractR);
      g.lineStyle(4.4, 0x141019, alpha * 0.88);
      g.strokeCircle(s.x, s.y, novaR);
      g.lineStyle(3.2, 0xa855f7, alpha * 0.96);
      g.strokeCircle(s.x, s.y, novaR);
      g.lineStyle(2.0, 0xfde047, alpha * 0.94);
      g.strokeCircle(s.x, s.y, novaR * 0.65);

      for (let k = 0; k < 8; k += 1) {
        const a = (k * Math.PI) / 4 + progress * 0.4;
        const midR = novaR * 0.55;
        const jx = s.x + Math.cos(a + 0.16) * midR;
        const jy = s.y + Math.sin(a + 0.16) * midR;
        const ex = s.x + Math.cos(a) * novaR;
        const ey = s.y + Math.sin(a) * novaR;
        g.lineStyle(2.0, k % 2 === 0 ? 0xfde047 : 0x7dd3fc, alpha * 0.95);
        g.beginPath();
        g.moveTo(s.x, s.y);
        g.lineTo(jx, jy);
        g.lineTo(ex, ey);
        g.strokePath();
      }
      return true;
    }

    default:
      return false;
  }
}
