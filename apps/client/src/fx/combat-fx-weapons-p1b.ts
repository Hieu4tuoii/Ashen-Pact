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
  if (state.shapes.length >= 64) state.shapes.shift();
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

function strokeSeg(
  g: Phaser.GameObjects.Graphics,
  w: number,
  col: number,
  a: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  g.lineStyle(w, col, a);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.strokePath();
}

function strokeArc(
  g: Phaser.GameObjects.Graphics,
  w: number,
  col: number,
  a: number,
  x: number,
  y: number,
  r: number,
  a0: number,
  a1: number,
): void {
  g.lineStyle(w, col, a);
  g.beginPath();
  g.arc(x, y, r, a0, a1, false);
  g.strokePath();
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
      const rays = ev.refractedRays ?? [];
      if (!isStress) {
        pushP1BShape(state, {
          kind: 'focus_laser_beam',
          x: ev.x1,
          y: ev.y1,
          x2: ev.x2,
          y2: ev.y2,
          radius: Math.max(4, (ev.heat ?? 30) * 0.1 + 3.5),
          count: rays.length,
          color: 0xf97316,
          ttlSec: 0.14,
          maxTtlSec: 0.14,
        });
        for (const ref of rays) {
          pushP1BShape(state, {
            kind: 'focus_laser_beam',
            x: ref.x1,
            y: ref.y1,
            x2: ref.x2,
            y2: ref.y2,
            radius: 4.5,
            isFinale: true,
            color: 0x38bdf8,
            ttlSec: 0.16,
            maxTtlSec: 0.16,
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
        const beamAngle = Math.atan2(ev.y2 - ev.y1, ev.x2 - ev.x1);
        const beamLength = Math.max(64, Math.hypot(ev.x2 - ev.x1, ev.y2 - ev.y1));
        const beamWidth = ev.width ?? 28;
        pushP1BShape(state, {
          kind: 'focus_laser_railgun',
          x: ev.x1,
          y: ev.y1,
          x2: ev.x2,
          y2: ev.y2,
          radius: beamWidth,
          color: 0xfacc15,
          ttlSec: 0.36,
          maxTtlSec: 0.36,
        });
        fx?.spawnShaderLance?.(ev.x1, ev.y1, beamLength, beamAngle, { widthPx: beamWidth * 1.15 });
        fx?.spawnShaderCone?.(ev.x1, ev.y1, 92, beamAngle);
        const midX = (ev.x1 + ev.x2) * 0.5;
        const midY = (ev.y1 + ev.y2) * 0.5;
        fx?.spawnHitSparks(midX, midY, beamAngle, { isCrit: true, element: 'burn', count: 10 });
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
        const rad = ev.radius || 110;
        pushP1BShape(state, {
          kind: 'void_implosion_ring',
          x: ev.x,
          y: ev.y,
          radius: rad,
          count: ev.swallowedBullets ?? 0,
          color: 0xa855f7,
          ttlSec: 0.38,
          maxTtlSec: 0.38,
        });
        fx?.spawnShaderNova?.(ev.x, ev.y, rad, 'fx_sh_nova_void');
        fx?.spawnFloorDecal('scorch', ev.x, ev.y, 1.15);
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 165, '#C084FC', 0.95, 0.4);
      }
      if (allowStressSfx) {
        zzfx.play('void_implosion', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }

    case 'melee_swing': {
      const swinger = sim.getAllPlayers
        ? (sim.getAllPlayers().find((pl) => pl.id === ev.playerId) ?? sim.player)
        : sim.player;
      const postComboStep = swinger?.meleeComboStep ?? 0;
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
          count: postComboStep,
          color: arcColor,
          ttlSec: 0.22,
          maxTtlSec: 0.22,
        });
      }
      if (
        ev.weaponId === 'emerald_cleaver' &&
        postComboStep === 0 &&
        allowStressSfx
      ) {
        zzfx.play('emerald_boomerang', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return false;
    }

    case 'bullet_volley_spawned': {
      if (ev.weaponId === 'emerald_cleaver_boomerang' && allowStressSfx) {
        zzfx.play('emerald_boomerang', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return false;
    }

    case 'berserker_guillotine_slam': {
      if (!isStress) {
        const fissureLen = ev.length || 160;
        pushP1BShape(state, {
          kind: 'berserker_guillotine_slam',
          x: ev.x,
          y: ev.y,
          x2: ev.x2,
          y2: ev.y2,
          radius: fissureLen,
          angle: ev.angle,
          color: 0xef4444,
          ttlSec: 0.4,
          maxTtlSec: 0.4,
        });
        fx?.spawnShaderSlash?.(ev.x, ev.y, 98, ev.angle, 'fx_sh_slash_crimson', {
          ttl: 0.24,
        });
        fx?.spawnShaderLance?.(ev.x, ev.y, fissureLen, ev.angle, { widthPx: ev.width ?? 36 });
        fx?.spawnShaderNova?.(ev.x, ev.y, 76, 'fx_sh_geyser_plume');
        fx?.spawnFloorDecal('scorch', ev.x, ev.y, 1.2);
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 175, PALETTE.FLAME_ORANGE, 1.0, 0.45);
      }
      if (allowStressSfx) {
        zzfx.play('berserker_guillotine', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }

    case 'solar_converge_burst': {
      if (!isStress) {
        const rad = ev.radius || 52;
        pushP1BShape(state, {
          kind: 'solar_converge_burst',
          x: ev.x,
          y: ev.y,
          radius: rad,
          count: ev.rayIndex ?? 0,
          color: 0xfacc15,
          ttlSec: 0.26,
          maxTtlSec: 0.26,
        });
        fx?.spawnShaderNova?.(ev.x, ev.y, rad, 'fx_sh_arcane_sigil', { tint: 0xfef08a });
        fx?.spawnHitSparks(ev.x, ev.y, 0, { isCrit: true, element: 'burn', count: 6 });
        scene.lighting?.spawnTransientLight(ev.x, ev.y, 145, PALETTE.SOLAR_GOLD, 0.92, 0.3);
      }
      if (allowStressSfx) {
        zzfx.play('solar_converge', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }

    case 'solar_supernova': {
      if (!isStress) {
        const rad = ev.radius || 120;
        pushP1BShape(state, {
          kind: 'solar_supernova_blast',
          x: ev.x,
          y: ev.y,
          x2: sim.player.x,
          y2: sim.player.y,
          radius: rad,
          color: 0xfacc15,
          ttlSec: 0.42,
          maxTtlSec: 0.42,
        });
        fx?.spawnShaderNova?.(ev.x, ev.y, rad, 'fx_sh_nova_solar');
        fx?.spawnFloorDecal('scorch', ev.x, ev.y, 1.35);
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
          const rad = gy.radius || 56;
          pushP1BShape(state, {
            kind: 'magma_geyser_plume',
            x: gy.x,
            y: gy.y,
            radius: rad,
            count: i,
            color: 0xf97316,
            ttlSec: 0.38,
            maxTtlSec: 0.38,
          });
          fx?.spawnShaderNova?.(gy.x, gy.y, rad, 'fx_sh_geyser_plume');
          fx?.spawnFloorDecal('scorch', gy.x, gy.y, 1.0);
        }
        const first = geysers[0]!;
        scene.lighting?.spawnTransientLight(first.x, first.y, 175, PALETTE.FLAME_ORANGE, 0.98, 0.45);
      }
      if (allowStressSfx) {
        zzfx.play('magma_geyser', sim.player.x, scene.camFocusX, sim.player.y, scene.camFocusY);
      }
      return true;
    }

    case 'thunder_hammer_pillar': {
      if (!isStress) {
        const rad = ev.radius || 110;
        pushP1BShape(state, {
          kind: 'thunder_pillar_strike',
          x: ev.x,
          y: ev.y,
          radius: rad,
          count: ev.strikes?.length ?? 3,
          color: 0x38bdf8,
          ttlSec: 0.4,
          maxTtlSec: 0.4,
        });
        fx?.spawnShaderNova?.(ev.x, ev.y, rad, 'fx_sh_anvil_storm');
        const strikes = ev.strikes ?? [];
        for (let sIdx = 0; sIdx < strikes.length; sIdx += 1) {
          const st = strikes[sIdx]!;
          const next = strikes[(sIdx + 1) % strikes.length];
          if (next && next !== st) {
            fx?.spawnChainLightningArc(st.x, st.y, next.x, next.y);
          } else {
            fx?.spawnChainLightningArc(ev.x, ev.y, st.x, st.y);
          }
          fx?.spawnHitSparks(st.x, st.y, 0, { isCrit: true, element: 'shock', count: 6 });
        }
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
  groundG?: Phaser.GameObjects.Graphics,
): void {
  if (!sim) return;
  const floorG = groundG ?? g;

  // 1. Magma Cannon ground trails at depth 16 (perimeter-crisp molten crack, low interior fill)
  for (let i = 0; i < (sim.magmaTrails?.length ?? 0); i += 1) {
    const seg = sim.magmaTrails[i]!;
    const a = clamp(seg.ttlSec / Math.max(0.1, seg.maxTtlSec), 0.2, 1);
    const w = seg.width || 48;
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = (-dy / dist) * (w * 0.46);
    const ny = (dx / dist) * (w * 0.46);
    strokeSeg(floorG, w * 0.88, 0x26080d, a * 0.08, seg.x1, seg.y1, seg.x2, seg.y2);
    strokeSeg(floorG, 2.2, 0x991b1b, a * 0.72, seg.x1 + nx, seg.y1 + ny, seg.x2 + nx, seg.y2 + ny);
    strokeSeg(floorG, 2.2, 0x991b1b, a * 0.72, seg.x1 - nx, seg.y1 - ny, seg.x2 - nx, seg.y2 - ny);
    strokeSeg(floorG, 3.2, 0xf97316, a * 0.82, seg.x1, seg.y1, seg.x2, seg.y2);
    strokeSeg(floorG, 1.4, 0xfacc15, a * 0.92, seg.x1, seg.y1, seg.x2, seg.y2);
  }

  // 2. Solar Archon Staff persistent fire zones at depth 16 (< 0.06 interior fill, 15% perimeter rim, zero center spokes)
  for (let i = 0; i < (sim.solarFireZones?.length ?? 0); i += 1) {
    const z = sim.solarFireZones[i]!;
    const a = clamp(z.ttlSec / Math.max(0.1, z.maxTtlSec), 0.25, 1);
    const r = z.radius * (1 + Math.sin(clockSec * 8 + z.id) * 0.02);
    floorG.fillStyle(0xea580c, a * 0.05);
    floorG.fillCircle(z.x, z.y, r);
    floorG.lineStyle(3.0, 0x26080d, a * 0.78);
    floorG.strokeCircle(z.x, z.y, r);
    floorG.lineStyle(2.0, 0xfacc15, a * 0.9);
    floorG.strokeCircle(z.x, z.y, r);
    floorG.lineStyle(1.3, 0xf97316, a * 0.55);
    floorG.strokeCircle(z.x, z.y, r * 0.86);
    for (let k = 0; k < 6; k += 1) {
      const ang = clockSec * 1.4 + (k * Math.PI) / 3;
      strokeSeg(
        floorG,
        1.6,
        0xfffdf5,
        a * 0.72,
        z.x + Math.cos(ang) * (r * 0.86),
        z.y + Math.sin(ang) * (r * 0.86),
        z.x + Math.cos(ang) * r,
        z.y + Math.sin(ang) * r,
      );
    }
  }

  // 3. Berserker Axe Guillotine flame fissures at depth 16 (recessed dark crack + razor molten spine)
  for (let i = 0; i < (sim.flameFissures?.length ?? 0); i += 1) {
    const f = sim.flameFissures[i]!;
    const a = clamp(f.ttlSec / Math.max(0.1, f.maxTtlSec), 0.25, 1);
    const w = f.width || 36;
    const nx = -Math.sin(f.angle);
    const ny = Math.cos(f.angle);
    const halfEdge = w * 0.45;
    strokeSeg(floorG, w * 0.85, 0x1c060b, a * 0.08, f.x1, f.y1, f.x2, f.y2);
    strokeSeg(
      floorG,
      2.0,
      0xdc2626,
      a * 0.78,
      f.x1 + nx * halfEdge,
      f.y1 + ny * halfEdge,
      f.x2 + nx * halfEdge,
      f.y2 + ny * halfEdge,
    );
    strokeSeg(
      floorG,
      2.0,
      0xdc2626,
      a * 0.78,
      f.x1 - nx * halfEdge,
      f.y1 - ny * halfEdge,
      f.x2 - nx * halfEdge,
      f.y2 - ny * halfEdge,
    );
    floorG.lineStyle(2.4, 0xf97316, a * 0.9);
    floorG.beginPath();
    floorG.moveTo(f.x1, f.y1);
    for (let s = 1; s <= 6; s += 1) {
      const t = s / 6;
      const j = s < 6 ? (s % 2 === 0 ? 5 : -5) : 0;
      floorG.lineTo(f.x1 + (f.x2 - f.x1) * t + nx * j, f.y1 + (f.y2 - f.y1) * t + ny * j);
    }
    floorG.strokePath();
    floorG.lineStyle(1.2, 0xfffdf5, a * 0.94);
    floorG.beginPath();
    floorG.moveTo(f.x1, f.y1);
    for (let s = 1; s <= 6; s += 1) {
      const t = s / 6;
      const j = s < 6 ? (s % 2 === 0 ? 5 : -5) : 0;
      floorG.lineTo(f.x1 + (f.x2 - f.x1) * t + nx * j, f.y1 + (f.y2 - f.y1) * t + ny * j);
    }
    floorG.strokePath();
  }

  // 4. Thunder Hammer persistent lightning pillars: floor perimeter at depth 16 (< 0.06 fill), pylon node on g
  for (let i = 0; i < (sim.lightningPillars?.length ?? 0); i += 1) {
    const pl = sim.lightningPillars[i]!;
    const a = clamp(pl.ttlSec / Math.max(0.1, pl.maxTtlSec), 0.25, 1);
    floorG.fillStyle(0x0284c7, a * 0.048);
    floorG.fillCircle(pl.x, pl.y, pl.radius);
    floorG.lineStyle(2.8, 0x071326, a * 0.72);
    floorG.strokeCircle(pl.x, pl.y, pl.radius);
    floorG.lineStyle(2.0, 0x38bdf8, a * 0.88);
    floorG.strokeCircle(pl.x, pl.y, pl.radius);
    floorG.lineStyle(1.2, 0xfacc15, a * 0.56);
    floorG.strokeCircle(pl.x, pl.y, pl.radius * 0.86);
    for (let k = 0; k < 4; k += 1) {
      const ang = clockSec * 4.2 + (k * Math.PI) / 2;
      strokeArc(floorG, 1.8, 0xfffdf5, a * 0.82, pl.x, pl.y, pl.radius * 0.93, ang, ang + 0.42);
    }
    g.fillStyle(0x071326, 0.96);
    g.fillCircle(pl.x, pl.y, 11.5);
    g.fillStyle(0x38bdf8, 0.98);
    g.fillCircle(pl.x, pl.y, 8.2);
    g.fillStyle(0xfacc15, 0.98);
    g.fillCircle(pl.x, pl.y, 4.6);
    g.fillStyle(0xfffdf5, 0.98);
    g.fillCircle(pl.x, pl.y, 2.2);
  }

  // 5. Orbiting Solar Mini-Suns (1:1 circular orbit r=48) & Berserker Bloodlust ring
  const activeWepId =
    player.weaponSlots[player.activeWeaponSlot ?? 0] ?? player.weaponSlots[0] ?? 'knight_sword';
  if (activeWepId === 'solar_archon_staff' && player.lifeState === 'alive') {
    const suns = getSolarMiniSunPositions(player);
    g.lineStyle(1.2, 0xfacc15, 0.34);
    g.strokeCircle(player.x, player.y, 48);
    for (let i = 0; i < suns.length; i += 1) {
      const sun = suns[i]!;
      g.fillStyle(0x26080d, 0.94);
      g.fillCircle(sun.x, sun.y, 10.5);
      for (let rIdx = 0; rIdx < 4; rIdx += 1) {
        const ra = clockSec * 5.5 + (rIdx * Math.PI) / 2;
        strokeSeg(
          g,
          1.8,
          0xf97316,
          0.92,
          sun.x + Math.cos(ra) * 6.5,
          sun.y + Math.sin(ra) * 6.5,
          sun.x + Math.cos(ra) * 12.5,
          sun.y + Math.sin(ra) * 12.5,
        );
      }
      g.fillStyle(0xf97316, 0.96);
      g.fillCircle(sun.x, sun.y, 8.0);
      g.fillStyle(0xfacc15, 0.98);
      g.fillCircle(sun.x, sun.y, 5.6);
      g.fillStyle(0xfffdf5, 0.98);
      g.fillCircle(sun.x, sun.y, 2.8);
    }
  }
  if (activeWepId === 'berserker_axe' && (player.berserkerBloodlustStacks ?? 0) > 0) {
    const stacks = clamp(player.berserkerBloodlustStacks ?? 0, 1, 5);
    floorG.lineStyle(1.8, 0xef4444, 0.45 + stacks * 0.08);
    floorG.strokeCircle(player.x, player.y, 20 + stacks * 2.2 + Math.sin(clockSec * 14) * 1.5);
  }

  // 6. Active Batch-2 Projectiles (Void Orb, Emerald Boomerang, Magma Boulder, Solar Converging Ray)
  for (let i = 0; i < (sim.projectiles?.length ?? 0); i += 1) {
    const b = sim.projectiles[i]!;
    if (b.ttlSec <= 0 || b.team !== 'player') continue;
    if (b.weaponId === 'void_staff') {
      g.lineStyle(1.4, 0xa855f7, 0.38);
      g.strokeCircle(b.x, b.y, 110);
      for (let arm = 0; arm < 4; arm += 1) {
        const a0 = clockSec * 6.5 + (arm * Math.PI) / 2;
        strokeArc(g, 1.8, 0xc084fc, 0.72, b.x, b.y, 34, a0, a0 + 0.9);
      }
      g.fillStyle(0x050209, 0.98);
      g.fillCircle(b.x, b.y, 17);
      g.lineStyle(2.6, 0x7c3aed, 0.98);
      g.strokeCircle(b.x, b.y, 15.5);
      g.lineStyle(1.5, 0xf0abfc, 0.95);
      g.strokeCircle(b.x, b.y, 11.5);
      g.fillStyle(0x030106, 1);
      g.fillCircle(b.x, b.y, 9.0);
      const swallowed = clamp(b.swallowedBullets ?? 0, 0, 6);
      for (let m = 0; m < swallowed; m += 1) {
        const ma = -clockSec * 10 + (m * Math.PI * 2) / Math.max(1, swallowed);
        g.fillStyle(0xfffdf5, 0.98);
        g.fillCircle(b.x + Math.cos(ma) * 22, b.y + Math.sin(ma) * 22, 2.8);
      }
    } else if (b.weaponId === 'emerald_cleaver_boomerang') {
      const spinAng = clockSec * 22 + b.id;
      if (b.boomerangPhase === 'spinning' || b.boomerangPhase === 'returning') {
        g.lineStyle(1.8, 0x10b981, 0.56);
        g.strokeCircle(b.x, b.y, 64);
      }
      g.lineStyle(2.8, 0x031812, 0.92);
      g.strokeCircle(b.x, b.y, 24);
      strokeArc(g, 3.8, 0x10b981, 0.96, b.x, b.y, 23, spinAng, spinAng + Math.PI * 1.3);
      strokeArc(g, 1.8, 0xfffdf5, 0.98, b.x, b.y, 20, spinAng + 0.2, spinAng + Math.PI * 1.1);
    } else if (b.weaponId === 'magma_cannon') {
      const r = b.radius || 20;
      g.fillStyle(0x26080d, 0.98);
      g.fillCircle(b.x, b.y, r + 1.8);
      g.fillStyle(0x7f1d1d, 0.96);
      g.fillCircle(b.x, b.y, r);
      g.lineStyle(2.6, 0xf97316, 0.96);
      g.strokeCircle(b.x, b.y, r * 0.76);
      g.fillStyle(0xfacc15, 0.98);
      g.fillCircle(b.x, b.y, r * 0.44);
      g.fillStyle(0xfffdf5, 0.96);
      g.fillCircle(b.x - r * 0.14, b.y - r * 0.14, r * 0.18);
    } else if (b.weaponId === 'solar_archon_staff') {
      const tx = b.convergeTargetX ?? b.x + Math.cos(b.angle) * 60;
      const ty = b.convergeTargetY ?? b.y + Math.sin(b.angle) * 60;
      strokeSeg(g, 4.4, 0x26080d, 0.62, b.x, b.y, tx, ty);
      strokeSeg(g, 2.8, 0xf97316, 0.78, b.x, b.y, tx, ty);
      strokeSeg(g, 1.4, 0xfffdf5, 0.96, b.x, b.y, tx, ty);
      g.lineStyle(1.6, 0xfacc15, 0.72);
      g.strokeCircle(tx, ty, 16);
      g.fillStyle(0xfacc15, 0.98);
      g.fillCircle(b.x, b.y, 6);
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
  groundG?: Phaser.GameObjects.Graphics,
): boolean {
  const floorG = groundG ?? g;
  switch (s.kind) {
    case 'focus_laser_beam': {
      const x2 = s.x2 ?? s.x + 200;
      const y2 = s.y2 ?? s.y;
      const w = Math.max(3.5, s.radius);
      const darkCol = s.isFinale ? 0x071726 : 0x1c060b;
      const midCol = s.isFinale ? 0x0284c7 : 0xef4444;
      const hotCol = s.isFinale ? 0x38bdf8 : 0xfacc15;
      strokeSeg(g, w + 3.6, darkCol, alpha * 0.84, s.x, s.y, x2, y2);
      strokeSeg(g, w + 0.8, midCol, alpha * 0.88, s.x, s.y, x2, y2);
      strokeSeg(g, w * 0.56, hotCol, alpha * 0.96, s.x, s.y, x2, y2);
      strokeSeg(g, Math.max(1.4, w * 0.24), 0xfffdf5, alpha, s.x, s.y, x2, y2);
      g.fillStyle(0xfffdf5, alpha * 0.94);
      g.fillCircle(x2, y2, w * 0.65);
      return true;
    }

    case 'focus_laser_railgun': {
      const x2 = s.x2 ?? s.x + 520;
      const y2 = s.y2 ?? s.y;
      const w = Math.max(8, s.radius * (1 - progress * 0.55));
      strokeSeg(g, w + 4, 0x1c060b, alpha * 0.82, s.x, s.y, x2, y2);
      strokeSeg(g, w * 0.82, 0xf97316, alpha * 0.88, s.x, s.y, x2, y2);
      strokeSeg(g, w * 0.5, 0xfacc15, alpha * 0.96, s.x, s.y, x2, y2);
      strokeSeg(g, w * 0.22, 0xfffdf5, alpha, s.x, s.y, x2, y2);
      return true;
    }

    case 'void_implosion_ring': {
      // Hollow gravitational event-horizon rings on floor (fx_sh_nova_void renders the Chiaroscuro collapse)
      const outerR = s.radius * (1 - progress * 0.45);
      const shockR = s.radius * (0.55 + progress * 0.45);
      floorG.lineStyle(2.4, 0x050209, alpha * 0.86);
      floorG.strokeCircle(s.x, s.y, shockR);
      floorG.lineStyle(1.9, 0xa855f7, alpha * 0.88);
      floorG.strokeCircle(s.x, s.y, shockR);
      floorG.lineStyle(1.4, 0xf0abfc, alpha * 0.78);
      floorG.strokeCircle(s.x, s.y, outerR);
      return true;
    }

    case 'emerald_cleave_arc': {
      const ang = s.angle ?? 0;
      const half = (65 * Math.PI) / 180;
      const r = s.radius * (0.82 + progress * 0.2);
      const mainColor = s.color || 0x10b981;
      const darkShear =
        mainColor === 0xef4444 ? 0x1c060b : mainColor === 0x38bdf8 ? 0x071326 : 0x031812;
      const coreColor =
        mainColor === 0xef4444 ? 0xfacc15 : mainColor === 0x38bdf8 ? 0xfef08a : 0xa7f3d0;
      strokeArc(
        g,
        4.4 * (1 - progress * 0.45),
        darkShear,
        alpha * 0.72,
        s.x,
        s.y,
        r,
        ang - half,
        ang + half,
      );
      strokeArc(
        g,
        2.6 * (1 - progress * 0.4),
        mainColor,
        alpha * 0.84,
        s.x,
        s.y,
        r,
        ang - half,
        ang + half,
      );
      strokeArc(g, 1.3, coreColor, alpha * 0.92, s.x, s.y, r - 2.5, ang - half * 0.85, ang + half * 0.85);
      return true;
    }

    case 'berserker_guillotine_slam': {
      const slamR = 68 * (0.55 + progress * 0.45);
      floorG.lineStyle(3.2, 0x141019, alpha * 0.84);
      floorG.strokeCircle(s.x, s.y, slamR);
      floorG.lineStyle(2.0, 0xef4444, alpha * 0.9);
      floorG.strokeCircle(s.x, s.y, slamR);
      for (let tIdx = 0; tIdx < 8; tIdx += 1) {
        const a = (tIdx * Math.PI) / 4 + 0.18;
        const innerR = slamR * 0.72;
        const outerR = slamR * (tIdx % 2 === 0 ? 1.08 : 0.98);
        strokeSeg(
          g,
          3.6,
          0x141019,
          alpha * 0.85,
          s.x + Math.cos(a) * innerR,
          s.y + Math.sin(a) * innerR,
          s.x + Math.cos(a) * outerR,
          s.y + Math.sin(a) * outerR,
        );
        strokeSeg(
          g,
          1.9,
          tIdx % 2 === 0 ? 0xfacc15 : 0xef4444,
          alpha * 0.94,
          s.x + Math.cos(a) * innerR,
          s.y + Math.sin(a) * innerR,
          s.x + Math.cos(a) * outerR,
          s.y + Math.sin(a) * outerR,
        );
      }
      return true;
    }

    case 'solar_converge_burst': {
      // Hollow 1:1 solar astrolabe convergence sigil (synchronized with fx_sh_arcane_sigil)
      const r = s.radius * (0.58 + progress * 0.42);
      floorG.lineStyle(2.8, 0x141019, alpha * 0.76);
      floorG.strokeCircle(s.x, s.y, r);
      floorG.lineStyle(1.9, 0xf97316, alpha * 0.88);
      floorG.strokeCircle(s.x, s.y, r);
      for (let k = 0; k < 4; k += 1) {
        const a = (k * Math.PI) / 2 + progress * 0.6;
        strokeSeg(
          g,
          3.0,
          0x141019,
          alpha * 0.8,
          s.x + Math.cos(a) * (r * 0.74),
          s.y + Math.sin(a) * (r * 0.74),
          s.x + Math.cos(a) * (r * 1.05),
          s.y + Math.sin(a) * (r * 1.05),
        );
        strokeSeg(
          g,
          1.6,
          0xfffdf5,
          alpha * 0.94,
          s.x + Math.cos(a) * (r * 0.74),
          s.y + Math.sin(a) * (r * 0.74),
          s.x + Math.cos(a) * (r * 1.05),
          s.y + Math.sin(a) * (r * 1.05),
        );
      }
      return true;
    }

    case 'solar_supernova_blast': {
      // Hollow 1:1 8-point celestial sunburst crown around outer shock-rim at depth 16
      const r = s.radius * (0.56 + progress * 0.44);
      floorG.lineStyle(3.2, 0x141019, alpha * 0.8);
      floorG.strokeCircle(s.x, s.y, r);
      floorG.lineStyle(2.1, 0xf97316, alpha * 0.9);
      floorG.strokeCircle(s.x, s.y, r);
      floorG.lineStyle(1.3, 0xfacc15, alpha * 0.78);
      floorG.strokeCircle(s.x, s.y, r * 0.86);
      for (let k = 0; k < 8; k += 1) {
        const a = (k * Math.PI) / 4 + progress * 0.25;
        const tipR = r * (k % 2 === 0 ? 1.07 : 1.01);
        strokeSeg(
          g,
          3.4,
          0x141019,
          alpha * 0.82,
          s.x + Math.cos(a) * (r * 0.84),
          s.y + Math.sin(a) * (r * 0.84),
          s.x + Math.cos(a) * tipR,
          s.y + Math.sin(a) * tipR,
        );
        strokeSeg(
          g,
          1.8,
          k % 2 === 0 ? 0xfffdf5 : 0xfacc15,
          alpha * 0.94,
          s.x + Math.cos(a) * (r * 0.84),
          s.y + Math.sin(a) * (r * 0.84),
          s.x + Math.cos(a) * tipR,
          s.y + Math.sin(a) * tipR,
        );
      }
      return true;
    }

    case 'magma_geyser_plume': {
      // True 1:1 top-down hollow crater rim + radial molten shear ticks (no 3/4 vertical side-view line!)
      const r = s.radius * (0.56 + progress * 0.44);
      floorG.lineStyle(2.4, 0x26080d, alpha * 0.8);
      floorG.strokeCircle(s.x, s.y, r);
      floorG.lineStyle(1.8, 0xf97316, alpha * 0.88);
      floorG.strokeCircle(s.x, s.y, r);
      for (let k = 0; k < 4; k += 1) {
        const ang = (k * Math.PI) / 2 + 0.4 + progress * 0.35;
        strokeSeg(
          g,
          2.0,
          0xfacc15,
          alpha * 0.86,
          s.x + Math.cos(ang) * (r * 0.68),
          s.y + Math.sin(ang) * (r * 0.68),
          s.x + Math.cos(ang) * (r * 1.04),
          s.y + Math.sin(ang) * (r * 1.04),
        );
      }
      return true;
    }

    case 'thunder_pillar_strike': {
      // True 1:1 top-down hollow thunder perimeter + radial lightning filaments (no 3/4 vertical sky-lines)
      const r = s.radius * (0.58 + progress * 0.42);
      floorG.lineStyle(2.6, 0x071326, alpha * 0.78);
      floorG.strokeCircle(s.x, s.y, r);
      floorG.lineStyle(1.9, 0x38bdf8, alpha * 0.88);
      floorG.strokeCircle(s.x, s.y, r);
      for (let bIdx = 0; bIdx < 3; bIdx += 1) {
        const ang = (bIdx * Math.PI * 2) / 3 + progress * 0.6;
        const midA = ang + Math.sin(clockSec * 28 + idx + bIdx) * 0.14;
        const innerR = r * 0.48;
        const midR = r * 0.76;
        g.lineStyle(2.8, 0x38bdf8, alpha * 0.9);
        g.beginPath();
        g.moveTo(s.x + Math.cos(ang) * innerR, s.y + Math.sin(ang) * innerR);
        g.lineTo(s.x + Math.cos(midA) * midR, s.y + Math.sin(midA) * midR);
        g.lineTo(s.x + Math.cos(ang) * r, s.y + Math.sin(ang) * r);
        g.strokePath();
        g.lineStyle(1.2, 0xfffdf5, alpha);
        g.beginPath();
        g.moveTo(s.x + Math.cos(ang) * innerR, s.y + Math.sin(ang) * innerR);
        g.lineTo(s.x + Math.cos(midA) * midR, s.y + Math.sin(midA) * midR);
        g.lineTo(s.x + Math.cos(ang) * r, s.y + Math.sin(ang) * r);
        g.strokePath();
      }
      return true;
    }

    default:
      return false;
  }
}
