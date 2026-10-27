import {
  clamp,
  getSolarMiniSunPositions,
  type SimEvent,
  type SimPlayerState,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { PALETTE } from '../art/palette.js';
import { zzfx } from '../audio/zzfx.js';
import type { CombatFxManager } from './combat-fx.js';
import {
  type TransientWeaponV2Shape,
  type WeaponV2OverlayState,
  getWeaponV2OverlayState,
} from './combat-fx-weapons-v2.js';

export type Batch2WeaponVfxKind =
  | 'focus_laser_beam'
  | 'focus_laser_railgun'
  | 'void_implosion_ring'
  | 'emerald_cleave_arc'
  | 'berserker_guillotine_slam'
  | 'solar_converge_burst'
  | 'solar_supernova_blast'
  | 'magma_geyser_plume'
  | 'thunder_pillar_strike';

function pushP1BShape(state: WeaponV2OverlayState, shape: TransientWeaponV2Shape): void {
  if (state.shapes.length >= 64) {
    state.shapes.shift();
  }
  state.shapes.push(shape);
}

export interface Batch2SceneContext {
  fx?: CombatFxManager;
  lighting?: {
    spawnTransientLight: (
      x: number,
      y: number,
      radius: number,
      colorHex: string,
      intensity: number,
      durationSec: number,
    ) => void;
  };
  camFocusX: number;
  camFocusY: number;
}

export function handleBatch2WeaponSimEvent(
  scene: Batch2SceneContext & object,
  ev: SimEvent,
  sim: WorldSim,
  isStress: boolean,
  allowStressSfx: boolean,
): boolean {
  const state = getWeaponV2OverlayState(scene);
  const fx = scene.fx;

  switch (ev.kind) {
    case 'focus_laser_beam': {
      if (!isStress) {
        pushP1BShape(state, {
          kind: 'focus_laser_beam',
          x: ev.x1,
          y: ev.y1,
          x2: ev.x2,
          y2: ev.y2,
          radius: Math.max(4, (ev.heat ?? 30) * 0.12 + 4),
          count: ev.refractedRays?.length ?? 0,
          color: 0xf97316,
          ttlSec: 0.16,
          maxTtlSec: 0.16,
        });
        for (const ref of ev.refractedRays ?? []) {
          pushP1BShape(state, {
            kind: 'focus_laser_beam',
            x: ref.x1,
            y: ref.y1,
            x2: ref.x2,
            y2: ref.y2,
            radius: 5,
            isFinale: true,
            color: 0x38bdf8,
            ttlSec: 0.18,
            maxTtlSec: 0.18,
          });
        }
        fx?.spawnHitSparks(ev.x2, ev.y2, Math.atan2(ev.y2 - ev.y1, ev.x2 - ev.x1), {
          element: 'burn',
          count: 4,
        });
        scene.lighting?.spawnTransientLight(
          (ev.x1 + ev.x2) * 0.5,
          (ev.y1 + ev.y2) * 0.5,
          150,
          PALETTE.FLAME_ORANGE,
          0.95,
          0.18,
        );
        scene.lighting?.spawnTransientLight(ev.x2, ev.y2, 130, PALETTE.SOLAR_GOLD, 0.9, 0.18);
      }
      if (allowStressSfx) {
        zzfx.play('focus_laser_hum', ev.x2, scene.camFocusX, ev.y2, scene.camFocusY);
      }
      return true;
    }

    case 'focus_laser_railgun': {
      if (!isStress) {
        pushP1BShape(state, {
          kind: 'focus_laser_railgun',
          x: ev.x1,
          y: ev.y1,
          x2: ev.x2,
          y2: ev.y2,
          radius: ev.width ?? 28,
          color: 0xfacc15,
          ttlSec: 0.42,
          maxTtlSec: 0.42,
        });
        const midX = (ev.x1 + ev.x2) * 0.5;
        const midY = (ev.y1 + ev.y2) * 0.5;
        fx?.spawnHitSparks(midX, midY, Math.atan2(ev.y2 - ev.y1, ev.x2 - ev.x1), {
          isCrit: true,
          element: 'burn',
          count: 10,
        });
        fx?.spawnFloatingAlert(ev.x1, ev.y1 - 28, ev.alertTextVi || 'RAILGUN XẢ ÁP!', '#FACC15');
        scene.lighting?.spawnTransientLight(ev.x1, ev.y1, 180, PALETTE.SOLAR_GOLD, 1.0, 0.45);
        scene.lighting?.spawnTransientLight(midX, midY, 210, PALETTE.FLAME_ORANGE, 1.0, 0.45);
      }
      if (allowStressSfx) {
        zzfx.play('focus_laser_railgun', ev.x1, scene.camFocusX, ev.y1, scene.camFocusY);
      }
      return true;
    }

    case 'void_implosion': {
      if (!isStress) {
        pushP1BShape(state, {
          kind: 'void_implosion_ring',
          x: ev.x,
          y: ev.y,
          radius: ev.radius || 110,
          count: ev.swallowedBullets ?? 0,
          color: 0xa855f7,
          ttlSec: 0.42,
          maxTtlSec: 0.42,
        });
        fx?.spawnExplosionBurst(ev.x, ev.y, ev.radius || 110, '#C084FC');
        fx?.spawnFloorDecal('scorch', ev.x, ev.y, 1.15);
        fx?.spawnFloatingAlert(
          ev.x,
          ev.y - 26,
          ev.alertTextVi || 'HỐ ĐEN SỤP ĐỔ!',
          '#C084FC',
        );
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 165, '#C084FC', 0.95, 0.4);
      }
      if (allowStressSfx) {
        zzfx.play('void_implosion', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }

    case 'melee_swing': {
      if (
        !isStress &&
        (ev.weaponId === 'emerald_cleaver' ||
          ev.weaponId === 'berserker_axe' ||
          ev.weaponId === 'thunder_hammer')
      ) {
        const arcColor =
          ev.weaponId === 'emerald_cleaver'
            ? 0x10b981
            : ev.weaponId === 'berserker_axe'
              ? 0xef4444
              : 0x38bdf8;
        pushP1BShape(state, {
          kind: 'emerald_cleave_arc',
          x: ev.x,
          y: ev.y,
          radius: ev.range || 68,
          angle: ev.angle,
          count: sim.player.meleeComboStep ?? 0,
          color: arcColor,
          ttlSec: 0.28,
          maxTtlSec: 0.28,
        });
      }
      return false;
    }

    case 'berserker_guillotine_slam': {
      if (!isStress) {
        pushP1BShape(state, {
          kind: 'berserker_guillotine_slam',
          x: ev.x,
          y: ev.y,
          x2: ev.x2,
          y2: ev.y2,
          radius: ev.length || 160,
          angle: ev.angle,
          color: 0xef4444,
          ttlSec: 0.45,
          maxTtlSec: 0.45,
        });
        fx?.spawnExplosionBurst(ev.x, ev.y, 76, PALETTE.FLAME_ORANGE);
        fx?.spawnFloorDecal('scorch', ev.x, ev.y, 1.2);
        fx?.spawnFloatingAlert(
          ev.x,
          ev.y - 28,
          ev.alertTextVi || 'ĐOẠN ĐẦU ĐÀI!',
          '#F97316',
        );
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 175, PALETTE.FLAME_ORANGE, 1.0, 0.45);
      }
      if (allowStressSfx) {
        zzfx.play('berserker_guillotine', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }

    case 'solar_converge_burst': {
      if (!isStress) {
        pushP1BShape(state, {
          kind: 'solar_converge_burst',
          x: ev.x,
          y: ev.y,
          radius: ev.radius || 52,
          count: ev.rayIndex ?? 0,
          color: 0xfacc15,
          ttlSec: 0.3,
          maxTtlSec: 0.3,
        });
        fx?.spawnHitSparks(ev.x, ev.y, 0, { isCrit: true, element: 'burn', count: 6 });
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 145, PALETTE.SOLAR_GOLD, 0.92, 0.3);
      }
      return true;
    }

    case 'solar_supernova': {
      if (!isStress) {
        pushP1BShape(state, {
          kind: 'solar_supernova_blast',
          x: ev.x,
          y: ev.y,
          x2: sim.player.x,
          y2: sim.player.y,
          radius: ev.radius || 120,
          color: 0xfacc15,
          ttlSec: 0.48,
          maxTtlSec: 0.48,
        });
        fx?.spawnExplosionBurst(ev.x, ev.y, ev.radius || 120, PALETTE.SOLAR_GOLD);
        fx?.spawnFloorDecal('scorch', ev.x, ev.y, 1.35);
        fx?.spawnFloatingAlert(ev.x, ev.y - 28, ev.alertTextVi || 'SIÊU TÂN TINH!', '#FACC15');
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 220, PALETTE.SOLAR_GOLD, 1.0, 0.55);
      }
      if (allowStressSfx) {
        zzfx.play('solar_supernova', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }

    case 'magma_geyser_eruption': {
      if (!isStress) {
        const geysers =
          ev.geysers && ev.geysers.length > 0
            ? ev.geysers
            : [{ x: sim.player.x + 80, y: sim.player.y, radius: 56, damage: 22 }];
        for (let i = 0; i < geysers.length; i += 1) {
          const gy = geysers[i]!;
          pushP1BShape(state, {
            kind: 'magma_geyser_plume',
            x: gy.x,
            y: gy.y,
            radius: gy.radius || 56,
            count: i,
            color: 0xf97316,
            ttlSec: 0.44,
            maxTtlSec: 0.44,
          });
          fx?.spawnExplosionBurst(gy.x, gy.y, gy.radius || 56, PALETTE.FLAME_ORANGE);
          fx?.spawnFloorDecal('scorch', gy.x, gy.y, 1.0);
        }
        const first = geysers[0]!;
        fx?.spawnFloatingAlert(
          first.x,
          first.y - 28,
          ev.alertTextVi || 'VÒI DUNG NHAM!',
          '#F97316',
        );
        scene.lighting?.spawnTransientLight(
          first.x,
          first.y,
          175,
          PALETTE.FLAME_ORANGE,
          0.98,
          0.45,
        );
      }
      if (allowStressSfx) {
        zzfx.play('magma_geyser', sim.player.x, scene.camFocusX, sim.player.y, scene.camFocusY);
      }
      return true;
    }

    case 'thunder_hammer_pillar': {
      if (!isStress) {
        pushP1BShape(state, {
          kind: 'thunder_pillar_strike',
          x: ev.x,
          y: ev.y,
          radius: ev.radius || 110,
          count: ev.strikes?.length ?? 3,
          color: 0x38bdf8,
          ttlSec: 0.46,
          maxTtlSec: 0.46,
        });
        for (const st of ev.strikes ?? []) {
          fx?.spawnChainLightningArc(st.x, st.y - 120, st.x, st.y);
          fx?.spawnHitSparks(st.x, st.y, 0, { isCrit: true, element: 'shock', count: 7 });
        }
        fx?.spawnExplosionBurst(ev.x, ev.y, ev.radius || 110, PALETTE.VOLT_YELLOW);
        fx?.spawnFloatingAlert(ev.x, ev.y - 28, ev.alertTextVi || 'CỘT LÔI ĐÌNH!', '#38BDF8');
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 195, PALETTE.CYAN_FROST, 1.0, 0.48);
      }
      if (allowStressSfx) {
        zzfx.play('thunder_pillar', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }

    default:
      return false;
  }
}

export function drawBatch2ActiveWeaponOverlays(
  g: Phaser.GameObjects.Graphics,
  sim: WorldSim | undefined,
  player: SimPlayerState,
  clockSec: number,
): void {
  if (!sim) return;

  // 1. Molten Magma Trails (magma_cannon)
  for (let i = 0; i < (sim.magmaTrails?.length ?? 0); i += 1) {
    const seg = sim.magmaTrails[i]!;
    const a = clamp(seg.ttlSec / Math.max(0.1, seg.maxTtlSec), 0.2, 1);
    const w = seg.width || 48;
    g.lineStyle(w + 4, 0x141019, a * 0.88);
    g.beginPath();
    g.moveTo(seg.x1, seg.y1);
    g.lineTo(seg.x2, seg.y2);
    g.strokePath();

    g.lineStyle(w * 0.78, 0x991b1b, a * 0.78);
    g.beginPath();
    g.moveTo(seg.x1, seg.y1);
    g.lineTo(seg.x2, seg.y2);
    g.strokePath();

    g.lineStyle(w * 0.46, 0xf97316, a * 0.9);
    g.beginPath();
    g.moveTo(seg.x1, seg.y1);
    g.lineTo(seg.x2, seg.y2);
    g.strokePath();

    g.lineStyle(w * 0.18, 0xfacc15, a * 0.96);
    g.beginPath();
    g.moveTo(seg.x1, seg.y1);
    g.lineTo(seg.x2, seg.y2);
    g.strokePath();
  }

  // 2. Solar Fire Zones (solar_archon_staff Supernova aftermath)
  for (let i = 0; i < (sim.solarFireZones?.length ?? 0); i += 1) {
    const z = sim.solarFireZones[i]!;
    const a = clamp(z.ttlSec / Math.max(0.1, z.maxTtlSec), 0.25, 1);
    const pulse = 1 + Math.sin(clockSec * 10 + z.id) * 0.04;
    const r = z.radius * pulse;
    g.fillStyle(0xea580c, a * 0.24);
    g.fillCircle(z.x, z.y, r);
    g.lineStyle(3.2, 0x141019, a * 0.9);
    g.strokeCircle(z.x, z.y, r);
    g.lineStyle(2.4, 0xfacc15, a * 0.95);
    g.strokeCircle(z.x, z.y, r);
    g.lineStyle(1.6, 0xfef08a, a * 0.8);
    g.strokeCircle(z.x, z.y, r * 0.64);
    for (let k = 0; k < 8; k += 1) {
      const ang = clockSec * 1.8 + (k * Math.PI) / 4;
      g.lineStyle(2.0, 0xf97316, a * 0.85);
      g.beginPath();
      g.moveTo(z.x + Math.cos(ang) * (r * 0.45), z.y + Math.sin(ang) * (r * 0.45));
      g.lineTo(z.x + Math.cos(ang) * r, z.y + Math.sin(ang) * r);
      g.strokePath();
    }
  }

  // 3. Molten Flame Fissures (berserker_axe Hit 3 Guillotine)
  for (let i = 0; i < (sim.flameFissures?.length ?? 0); i += 1) {
    const f = sim.flameFissures[i]!;
    const a = clamp(f.ttlSec / Math.max(0.1, f.maxTtlSec), 0.25, 1);
    const w = f.width || 36;
    g.lineStyle(w + 4, 0x141019, a * 0.92);
    g.beginPath();
    g.moveTo(f.x1, f.y1);
    g.lineTo(f.x2, f.y2);
    g.strokePath();

    g.lineStyle(w * 0.72, 0xdc2626, a * 0.86);
    g.beginPath();
    g.moveTo(f.x1, f.y1);
    g.lineTo(f.x2, f.y2);
    g.strokePath();

    g.lineStyle(w * 0.36, 0xf97316, a * 0.95);
    g.beginPath();
    g.moveTo(f.x1, f.y1);
    g.lineTo(f.x2, f.y2);
    g.strokePath();

    // Jagged white-gold crack core
    const nx = -Math.sin(f.angle);
    const ny = Math.cos(f.angle);
    g.lineStyle(3.0, 0xfef08a, a);
    g.beginPath();
    g.moveTo(f.x1, f.y1);
    for (let s = 1; s <= 6; s += 1) {
      const t = s / 6;
      const j = s < 6 ? (s % 2 === 0 ? 6 : -6) : 0;
      g.lineTo(
        f.x1 + (f.x2 - f.x1) * t + nx * j,
        f.y1 + (f.y2 - f.y1) * t + ny * j,
      );
    }
    g.strokePath();
  }

  // 4. Lightning Rod Pillars (thunder_hammer Hit 3)
  for (let i = 0; i < (sim.lightningPillars?.length ?? 0); i += 1) {
    const pl = sim.lightningPillars[i]!;
    const a = clamp(pl.ttlSec / Math.max(0.1, pl.maxTtlSec), 0.25, 1);
    g.fillStyle(0x0284c7, a * 0.16);
    g.fillCircle(pl.x, pl.y, pl.radius);
    g.lineStyle(2.4, 0x38bdf8, a * 0.9);
    g.strokeCircle(pl.x, pl.y, pl.radius);
    g.lineStyle(1.6, 0xfacc15, a * 0.85);
    g.strokeCircle(pl.x, pl.y, pl.radius * 0.55);

    for (let k = 0; k < 4; k += 1) {
      const ang = clockSec * 4.5 + (k * Math.PI) / 2;
      const mx = pl.x + Math.cos(ang + 0.25) * (pl.radius * 0.52);
      const my = pl.y + Math.sin(ang + 0.25) * (pl.radius * 0.52);
      const ex = pl.x + Math.cos(ang) * (pl.radius * 0.94);
      const ey = pl.y + Math.sin(ang) * (pl.radius * 0.94);
      g.lineStyle(2.2, 0xfef08a, a * 0.92);
      g.beginPath();
      g.moveTo(pl.x, pl.y);
      g.lineTo(mx, my);
      g.lineTo(ex, ey);
      g.strokePath();
    }

    // Planted Lightning Rod Obelisk at center
    g.fillStyle(0x141019, 0.96);
    g.fillCircle(pl.x, pl.y, 13);
    g.fillStyle(0x38bdf8, 0.98);
    g.fillCircle(pl.x, pl.y, 9.5);
    g.fillStyle(0xfacc15, 0.98);
    g.fillCircle(pl.x, pl.y, 5.2);
  }

  // 5. Solar Archon Staff — 3 Orbiting Mini-Suns
  const activeWepId =
    player.weaponSlots[player.activeWeaponSlot ?? 0] ?? player.weaponSlots[0] ?? 'knight_sword';
  if (activeWepId === 'solar_archon_staff' && player.lifeState === 'alive') {
    const suns = getSolarMiniSunPositions(player);
    g.lineStyle(1.4, 0xfacc15, 0.42);
    g.strokeCircle(player.x, player.y, 48);
    for (let i = 0; i < suns.length; i += 1) {
      const sun = suns[i]!;
      g.fillStyle(0x141019, 0.95);
      g.fillCircle(sun.x, sun.y, 12.5);
      for (let rIdx = 0; rIdx < 6; rIdx += 1) {
        const ra = clockSec * 6 + (rIdx * Math.PI) / 3;
        g.lineStyle(2.2, 0xf97316, 0.95);
        g.beginPath();
        g.moveTo(sun.x + Math.cos(ra) * 7, sun.y + Math.sin(ra) * 7);
        g.lineTo(sun.x + Math.cos(ra) * 15, sun.y + Math.sin(ra) * 15);
        g.strokePath();
      }
      g.fillStyle(0xf97316, 0.96);
      g.fillCircle(sun.x, sun.y, 9.5);
      g.fillStyle(0xfacc15, 0.98);
      g.fillCircle(sun.x, sun.y, 6.8);
      g.fillStyle(0xfffdf5, 0.98);
      g.fillCircle(sun.x, sun.y, 3.6);
    }
  }

  // 5b. Berserker Axe — Bloodlust Aura
  if (activeWepId === 'berserker_axe' && (player.berserkerBloodlustStacks ?? 0) > 0) {
    const stacks = clamp(player.berserkerBloodlustStacks ?? 0, 1, 5);
    const auraR = 20 + stacks * 2.5 + Math.sin(clockSec * 14) * 2;
    g.lineStyle(2.2, 0xef4444, 0.55 + stacks * 0.08);
    g.strokeCircle(player.x, player.y, auraR);
  }

  // 6. Active Batch-2 Projectiles
  for (let i = 0; i < (sim.projectiles?.length ?? 0); i += 1) {
    const b = sim.projectiles[i]!;
    if (b.ttlSec <= 0 || b.team !== 'player') continue;

    if (b.weaponId === 'void_staff') {
      const pullR = 110;
      g.lineStyle(1.8, 0xa855f7, 0.52);
      g.strokeCircle(b.x, b.y, pullR);
      for (let arm = 0; arm < 5; arm += 1) {
        const a0 = clockSec * 7 + (arm * Math.PI * 2) / 5;
        const a1 = a0 + 0.75;
        g.lineStyle(2.2, 0xc084fc, 0.78);
        g.beginPath();
        g.moveTo(b.x + Math.cos(a0) * (pullR * 0.85), b.y + Math.sin(a0) * (pullR * 0.85));
        g.lineTo(b.x + Math.cos(a1) * 22, b.y + Math.sin(a1) * 22);
        g.strokePath();
      }
      g.fillStyle(0x141019, 0.98);
      g.fillCircle(b.x, b.y, 19);
      g.lineStyle(3.2, 0xa855f7, 0.98);
      g.strokeCircle(b.x, b.y, 17);
      g.lineStyle(1.8, 0xf0abfc, 0.95);
      g.strokeCircle(b.x, b.y, 12);
      g.fillStyle(0x090514, 1);
      g.fillCircle(b.x, b.y, 9.5);

      const swallowed = clamp(b.swallowedBullets ?? 0, 0, 6);
      for (let m = 0; m < swallowed; m += 1) {
        const ma = -clockSec * 10 + (m * Math.PI * 2) / Math.max(1, swallowed);
        const mx = b.x + Math.cos(ma) * 24;
        const my = b.y + Math.sin(ma) * 24;
        g.fillStyle(0xf0abfc, 0.98);
        g.fillCircle(mx, my, 3.5);
      }
    } else if (b.weaponId === 'emerald_cleaver_boomerang') {
      const spinAng = clockSec * 22 + b.id;
      if (b.boomerangPhase === 'spinning' || b.boomerangPhase === 'returning') {
        g.lineStyle(2.4, 0x34d399, 0.72);
        g.strokeCircle(b.x, b.y, 64);
      }
      g.lineStyle(3.2, 0x141019, 0.95);
      g.strokeCircle(b.x, b.y, 26);
      g.lineStyle(4.2, 0x10b981, 0.96);
      g.beginPath();
      g.arc(b.x, b.y, 24, spinAng, spinAng + Math.PI * 1.35, false);
      g.strokePath();
      g.lineStyle(2.2, 0xa7f3d0, 0.98);
      g.beginPath();
      g.arc(b.x, b.y, 20, spinAng + 0.2, spinAng + Math.PI * 1.15, false);
      g.strokePath();
    } else if (b.weaponId === 'magma_cannon') {
      const r = b.radius || 20;
      g.fillStyle(0x141019, 0.98);
      g.fillCircle(b.x, b.y, r + 2.5);
      g.fillStyle(0x7f1d1d, 0.96);
      g.fillCircle(b.x, b.y, r);
      g.lineStyle(3.0, 0xf97316, 0.96);
      g.strokeCircle(b.x, b.y, r * 0.78);
      g.fillStyle(0xfacc15, 0.98);
      g.fillCircle(b.x, b.y, r * 0.42);
    } else if (b.weaponId === 'solar_archon_staff') {
      const tx = b.convergeTargetX ?? b.x + Math.cos(b.angle) * 60;
      const ty = b.convergeTargetY ?? b.y + Math.sin(b.angle) * 60;
      g.lineStyle(5.0, 0xf97316, 0.65);
      g.beginPath();
      g.moveTo(b.x, b.y);
      g.lineTo(tx, ty);
      g.strokePath();
      g.lineStyle(2.4, 0xfffdf5, 0.95);
      g.beginPath();
      g.moveTo(b.x, b.y);
      g.lineTo(tx, ty);
      g.strokePath();
      g.lineStyle(2.0, 0xfacc15, 0.82);
      g.strokeCircle(tx, ty, 18);
      g.fillStyle(0xfacc15, 0.98);
      g.fillCircle(b.x, b.y, 7);
    }
  }
}

export function drawBatch2TransientShape(
  g: Phaser.GameObjects.Graphics,
  s: TransientWeaponV2Shape,
  progress: number,
  alpha: number,
  clockSec: number,
  idx: number,
): boolean {
  switch (s.kind) {
    case 'focus_laser_beam': {
      const x2 = s.x2 ?? s.x + 200;
      const y2 = s.y2 ?? s.y;
      const w = Math.max(4, s.radius);
      g.lineStyle(w + 5, 0x141019, alpha * 0.9);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(x2, y2);
      g.strokePath();

      g.lineStyle(w + 1.5, s.isFinale ? 0x38bdf8 : 0xef4444, alpha * 0.88);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(x2, y2);
      g.strokePath();

      g.lineStyle(w * 0.62, 0xfacc15, alpha * 0.96);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(x2, y2);
      g.strokePath();

      g.lineStyle(Math.max(2, w * 0.3), 0xfffdf5, alpha);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(x2, y2);
      g.strokePath();
      g.fillStyle(0xfacc15, alpha * 0.95);
      g.fillCircle(x2, y2, w * 0.9);
      return true;
    }

    case 'focus_laser_railgun': {
      const x2 = s.x2 ?? s.x + 520;
      const y2 = s.y2 ?? s.y;
      const w = Math.max(12, s.radius * (1 - progress * 0.45));
      g.lineStyle(w + 8, 0x141019, alpha * 0.92);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(x2, y2);
      g.strokePath();

      g.lineStyle(w + 2, 0xf97316, alpha * 0.9);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(x2, y2);
      g.strokePath();

      g.lineStyle(w * 0.68, 0xfacc15, alpha * 0.98);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(x2, y2);
      g.strokePath();

      g.lineStyle(w * 0.36, 0xfffdf5, alpha);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(x2, y2);
      g.strokePath();
      return true;
    }

    case 'void_implosion_ring': {
      const outerR = s.radius * (1 - progress * 0.55);
      const shockR = s.radius * (0.35 + progress * 0.75);
      g.fillStyle(0x090514, alpha * 0.72);
      g.fillCircle(s.x, s.y, outerR * 0.55);
      g.lineStyle(4.2, 0x141019, alpha * 0.95);
      g.strokeCircle(s.x, s.y, shockR);
      g.lineStyle(3.2, 0xa855f7, alpha * 0.96);
      g.strokeCircle(s.x, s.y, shockR);
      g.lineStyle(2.2, 0xf0abfc, alpha * 0.92);
      g.strokeCircle(s.x, s.y, outerR);
      return true;
    }

    case 'emerald_cleave_arc': {
      const ang = s.angle ?? 0;
      const half = (67.5 * Math.PI) / 180;
      const r = s.radius * (0.75 + progress * 0.3);
      g.lineStyle(10 * (1 - progress * 0.4), 0x141019, alpha * 0.9);
      g.beginPath();
      g.arc(s.x, s.y, r, ang - half, ang + half, false);
      g.strokePath();
      g.lineStyle(6.5 * (1 - progress * 0.35), 0x10b981, alpha * 0.96);
      g.beginPath();
      g.arc(s.x, s.y, r, ang - half, ang + half, false);
      g.strokePath();
      g.lineStyle(2.8, 0xa7f3d0, alpha);
      g.beginPath();
      g.arc(s.x, s.y, r - 4, ang - half * 0.85, ang + half * 0.85, false);
      g.strokePath();
      return true;
    }

    case 'berserker_guillotine_slam': {
      const slamR = 64 * (0.45 + progress * 0.65);
      g.lineStyle(4.5, 0x141019, alpha * 0.94);
      g.strokeCircle(s.x, s.y, slamR);
      g.lineStyle(3.4, 0xef4444, alpha * 0.96);
      g.strokeCircle(s.x, s.y, slamR);
      g.lineStyle(2.2, 0xfacc15, alpha * 0.95);
      g.strokeCircle(s.x, s.y, slamR * 0.68);
      return true;
    }

    case 'solar_converge_burst': {
      const r = s.radius * (0.4 + progress * 0.65);
      g.lineStyle(3.2, 0xf97316, alpha * 0.92);
      g.strokeCircle(s.x, s.y, r);
      g.fillStyle(0xfef08a, alpha * 0.7);
      g.fillCircle(s.x, s.y, r * 0.42);
      return true;
    }

    case 'solar_supernova_blast': {
      const r = s.radius * (0.35 + progress * 0.7);
      g.fillStyle(0xfacc15, alpha * 0.32);
      g.fillCircle(s.x, s.y, r);
      g.lineStyle(5.0, 0x141019, alpha * 0.94);
      g.strokeCircle(s.x, s.y, r);
      g.lineStyle(3.6, 0xf97316, alpha * 0.96);
      g.strokeCircle(s.x, s.y, r);
      g.lineStyle(2.6, 0xfffdf5, alpha);
      g.strokeCircle(s.x, s.y, r * 0.62);
      return true;
    }

    case 'magma_geyser_plume': {
      const r = s.radius * (0.4 + progress * 0.65);
      const plumeH = 54 * (1 - progress * 0.35);
      g.fillStyle(0x141019, alpha * 0.9);
      g.fillCircle(s.x, s.y, r * 0.72 + 3);
      g.fillStyle(0xdc2626, alpha * 0.78);
      g.fillCircle(s.x, s.y, r * 0.72);
      g.lineStyle(3.2, 0xf97316, alpha * 0.95);
      g.strokeCircle(s.x, s.y, r);
      g.lineStyle(12 * (1 - progress * 0.35), 0xf97316, alpha * 0.92);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x, s.y - plumeH);
      g.strokePath();
      g.lineStyle(5.5 * (1 - progress * 0.35), 0xfef08a, alpha);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x, s.y - plumeH * 0.92);
      g.strokePath();
      return true;
    }

    case 'thunder_pillar_strike': {
      const r = s.radius * (0.4 + progress * 0.65);
      g.lineStyle(4.2, 0x141019, alpha * 0.92);
      g.strokeCircle(s.x, s.y, r);
      g.lineStyle(3.2, 0x38bdf8, alpha * 0.96);
      g.strokeCircle(s.x, s.y, r);
      for (let bIdx = -1; bIdx <= 1; bIdx += 1) {
        const bx = s.x + bIdx * 24;
        const by = s.y + (bIdx === 0 ? 0 : 12);
        const jx = bx + Math.sin(clockSec * 30 + idx + bIdx) * 10;
        g.lineStyle(5.5, 0x38bdf8, alpha * 0.92);
        g.beginPath();
        g.moveTo(bx, by - 135);
        g.lineTo(jx, by - 65);
        g.lineTo(bx, by);
        g.strokePath();
        g.lineStyle(2.4, 0xfffdf5, alpha);
        g.beginPath();
        g.moveTo(bx, by - 135);
        g.lineTo(jx, by - 65);
        g.lineTo(bx, by);
        g.strokePath();
      }
      return true;
    }

    default:
      return false;
  }
}
