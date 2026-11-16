import {
  clamp,
  type ArenaMap,
  type SimEvent,
  type SimPlayerState,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { PALETTE } from '../art/palette.js';
import { CUTOUT_KIT_ATLAS_KEY } from '../art/texture-baker-fx.js';
import { zzfx } from '../audio/zzfx.js';
import type { CombatFxManager } from './combat-fx.js';
import { acquireParticleSlot } from './combat-fx-pools.js';
import {
  activateParticle,
  applyP1SafeHaloAlpha,
  resolveAllyFxProfile,
  routeCutoutBurstByRadius,
} from './combat-fx-spawners.js';
import {
  fillTaperedArcRibbon,
  fillTaperedLightningBolt,
} from './tapered-ribbon-builder.js';
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
        const isTeammate = ev.playerId !== undefined && ev.playerId !== sim.player.id;
        if (!isTeammate) {
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
        const isTeammate = ev.playerId !== undefined && ev.playerId !== sim.player.id;
        if (!isTeammate) {
          scene.lighting?.spawnTransientLight(ev.x1, ev.y1, 180, PALETTE.SOLAR_GOLD, 1.0, 0.45);
          scene.lighting?.spawnTransientLight(midX, midY, 210, PALETTE.FLAME_ORANGE, 1.0, 0.45);
        }
      }
      if (allowStressSfx) {
        zzfx.play('focus_laser_railgun', ev.x1, scene.camFocusX, ev.y1, scene.camFocusY);
      }
      return true;
    }

    case 'void_implosion': {
      if (!isStress) {
        const rad = ev.radius || 110;
        const isTeammate = ev.playerId !== sim.player.id;
        const dist = Math.hypot(ev.x - sim.player.x, ev.y - sim.player.y);
        const ally = resolveAllyFxProfile(isTeammate ? 2 : 1, 1);
        const alpha = applyP1SafeHaloAlpha(ally.aoeAlpha, isTeammate, dist, rad);

        pushP1BShape(state, {
          kind: 'void_implosion_ring',
          x: ev.x,
          y: ev.y,
          radius: rad,
          count: ev.swallowedBullets ?? 0,
          color: 0xa855f7,
          ttlSec: 4 / 60,
          maxTtlSec: 4 / 60,
        });
        if (fx) {
          routeCutoutBurstByRadius(fx, ev.x, ev.y, rad, 'fx_sh_nova_void', {
            isTeammate,
            alpha,
            depth: 43.5,
          });
        }
        fx?.spawnFloorDecal?.('scorch', ev.x, ev.y, 1.15);
        if (!isTeammate) {
          scene.lighting?.spawnTransientLight(ev.x, ev.y, 165, '#C084FC', 0.95, 0.4);
        }
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
      const isTeammate = ev.playerId !== sim.player.id;
      if (ev.weaponId === 'emerald_cleaver') {
        const evComb = (ev as unknown as { comboStep?: number }).comboStep;
        const executedStep: 1 | 2 | 3 =
          evComb !== undefined
            ? ((evComb + 1) as 1 | 2 | 3)
            : postComboStep === 1
              ? 1
              : postComboStep === 2
                ? 2
                : 3;
        if (!isStress) {
          pushP1BShape(state, {
            kind: 'emerald_cleave_arc',
            x: ev.x,
            y: ev.y,
            radius: ev.range || 68,
            angle: ev.angle,
            count: postComboStep,
            color: 0x10b981,
            ttlSec: 0.22,
            maxTtlSec: 0.22,
          });
          if (fx) {
            spawnEmeraldCleaverSlash(fx, ev.x, ev.y, ev.angle, ev.range || 92.0, executedStep, isTeammate);
          }
        }
        if (postComboStep === 0 && allowStressSfx) {
          zzfx.play('emerald_boomerang', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
        }
        return true;
      }
      if (
        !isStress &&
        (ev.weaponId === 'berserker_axe' || ev.weaponId === 'thunder_hammer')
      ) {
        const arcColor = ev.weaponId === 'berserker_axe' ? 0xef4444 : 0x38bdf8;
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
        const isTeammate = ev.playerId !== undefined && ev.playerId !== sim.player.id;
        if (!isTeammate) {
          scene.lighting?.spawnTransientLight(ev.x, ev.y, 175, PALETTE.FLAME_ORANGE, 1.0, 0.45);
        }
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
          color: 0xf59e0b,
          ttlSec: 0.26,
          maxTtlSec: 0.26,
        });
        const isTeammate = ev.playerId !== undefined && ev.playerId !== sim.player.id;
        if (fx) {
          const ally = resolveAllyFxProfile(isTeammate ? 2 : 1, 1);
          const dist = fx.distanceToLocalPlayer ? fx.distanceToLocalPlayer(ev.x, ev.y) : Infinity;
          const alpha = applyP1SafeHaloAlpha(ally.aoeAlpha, isTeammate, dist, rad);
          routeCutoutBurstByRadius(fx, ev.x, ev.y, rad, 'fx_sh_nova_magma', {
            tint: 0xf59e0b,
            isTeammate,
            depth: 43.5,
            alpha,
          });
        }
        fx?.spawnHitSparks(ev.x, ev.y, 0, { isCrit: true, element: 'burn', count: 6 });
        if (!isTeammate) {
          scene.lighting?.spawnTransientLight(ev.x, ev.y, 145, PALETTE.SOLAR_GOLD, 0.92, 0.3);
        }
      }
      if (allowStressSfx) {
        zzfx.play('solar_converge', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }

    case 'solar_supernova': {
      if (!isStress) {
        const isTeammate = ev.playerId !== undefined && ev.playerId !== sim.player.id;
        if (fx) {
          spawnSolarSupernovaFx(fx, ev, isTeammate);
        } else {
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
        }
        fx?.spawnFloorDecal('scorch', ev.x, ev.y, 1.35);
        if (!isTeammate) {
          scene.lighting?.spawnTransientLight(ev.x, ev.y, 220, PALETTE.SOLAR_GOLD, 1.0, 0.55);
        }
      }
      if (allowStressSfx) {
        zzfx.play('solar_supernova', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
      }
      return true;
    }

    case 'magma_geyser_eruption': {
      if (!isStress && fx) {
        const isTeammate = ev.playerId !== undefined && ev.playerId !== sim.player.id;
        spawnMagmaGeyserClusterFx(fx, ev, isTeammate, scene);
        const geysers = ev.geysers && ev.geysers.length > 0 ? ev.geysers : [{ x: sim.player.x + 80, y: sim.player.y }];
        const first = geysers[0]!;
        if (!isTeammate) {
          scene.lighting?.spawnTransientLight(first.x, first.y, 175, PALETTE.FLAME_ORANGE, 0.98, 0.45);
        }
      }
      if (allowStressSfx) {
        zzfx.play('magma_geyser', sim.player.x, scene.camFocusX, sim.player.y, scene.camFocusY);
      }
      return true;
    }

    case 'thunder_hammer_pillar': {
      if (!isStress) {
        const isTeammate = ev.playerId !== undefined && ev.playerId !== sim.player.id;
        const strikes = ev.strikes?.length
          ? ev.strikes
          : [{ x: ev.x, y: ev.y, radius: ev.radius || 110, damage: ev.damage || 54 }];
        for (let i = 0; i < strikes.length; i++) {
          const s = strikes[i]!;
          pushP1BShape(state, {
            kind: 'thunder_pillar_strike',
            x: s.x,
            y: s.y,
            radius: s.radius || 110,
            count: 6,
            color: 0x38bdf8,
            ttlSec: 0.35,
            maxTtlSec: 0.35,
          });
        }
        if (fx) {
          spawnThunderHammerPillarFx(fx, ev, isTeammate);
        } else if (!isTeammate) {
          scene.lighting?.spawnTransientLight(ev.x, ev.y, 195, PALETTE.CYAN_FROST, 1.0, 0.48);
        }
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
  underG?: Phaser.GameObjects.Graphics,
): void {
  if (!sim) return;
  const floorG = groundG ?? g;
  const underActorG =
    underG ??
    (g as unknown as { underActorGraphics?: Phaser.GameObjects.Graphics }).underActorGraphics ??
    g;

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
    const halfEdge = (f.width || 36) * 0.5;
    if (sim.map) {
      const isTeammateCorridor = f.ownerPlayerId !== undefined && f.ownerPlayerId !== player.id;
      const distToPlayer = Math.hypot(f.x1 - player.x, f.y1 - player.y);
      renderBerserkerGuillotineCorridor(floorG, g, sim.map, f.x1, f.y1, f.x2, f.y2, halfEdge, a, isTeammateCorridor, distToPlayer);
    } else {
      const w = f.width || 36;
      const nx = -Math.sin(f.angle);
      const ny = Math.cos(f.angle);
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

  // 5. Orbiting Solar Mini-Suns (3 fx_solar_mini_sun sprites pooled at depth 41.5, zero connecting strokeCircle) & Berserker Bloodlust ring
  const activeWepId =
    player.weaponSlots[player.activeWeaponSlot ?? 0] ?? player.weaponSlots[0] ?? 'knight_sword';
  if (activeWepId === 'solar_archon_staff' && player.lifeState === 'alive') {
    // Rendered via entity-sync as 3 fx_solar_mini_sun sprites (12x12px, depth 41.5) at ±48.0px
    // ZERO connecting strokeCircle!
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
      const isTeammate = b.ownerId !== undefined && b.ownerId !== player.id;
      const baseAlpha = isTeammate ? 0.07 : 0.22;
      const distToPlayer = Math.hypot(b.x - player.x, b.y - player.y);
      const alpha = applyP1SafeHaloAlpha(baseAlpha, isTeammate, distToPlayer, 110);

      // 4 subtle inward fillTaperedArcRibbon arcs at r = 110.0px (depth 26.6 on underActorG, 68% open)
      // ZERO solid strokeCircle!
      const arcSpan = ((1 - 0.68) * Math.PI * 2) / 4;
      for (let arm = 0; arm < 4; arm += 1) {
        const aMid = clockSec * 2.0 + (arm * Math.PI) / 2;
        fillTaperedArcRibbon(
          underActorG,
          b.x,
          b.y,
          110.0,
          aMid - arcSpan * 0.5,
          aMid + arcSpan * 0.5,
          2.6,
          0xa855f7,
          alpha,
          6,
          1.8,
        );
      }

      // Core: #0B090E r = 11px core (1.8px #A855F7 + #141019 rim)
      g.fillStyle(0x0b090e, 0.98);
      g.fillCircle(b.x, b.y, 11);
      g.lineStyle(1.8, 0xa855f7, 0.96);
      g.strokeCircle(b.x, b.y, 11);
      g.lineStyle(1.0, 0x141019, 0.92);
      g.strokeCircle(b.x, b.y, 12);

      const swallowed = clamp(b.swallowedBullets ?? 0, 0, 6);
      for (let m = 0; m < swallowed; m += 1) {
        const ma = -clockSec * 10 + (m * Math.PI * 2) / Math.max(1, swallowed);
        g.fillStyle(0xfffdf5, 0.98);
        g.fillCircle(b.x + Math.cos(ma) * 22, b.y + Math.sin(ma) * 22, 2.8);
      }
    } else if (b.weaponId === 'emerald_cleaver_boomerang') {
      const spinAng = clockSec * 22 + b.id;
      const isTeammate = b.ownerId !== undefined && b.ownerId !== player.id;
      const distToPlayer = Math.hypot(b.x - player.x, b.y - player.y);
      renderEmeraldBoomerangOverlay(
        g,
        b.x,
        b.y,
        b.boomerangPhase ?? 'spinning',
        spinAng,
        1.0,
        isTeammate,
        distToPlayer,
      );
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
    } else if (b.weaponId === 'thunder_hammer') {
      const owner = sim.getAllPlayers ? (sim.getAllPlayers().find((p) => p.id === b.ownerId) ?? sim.player) : sim.player;
      if (owner) {
        const isTeammate = owner.id !== player.id;
        const distToPlayer = Math.hypot(b.x - player.x, b.y - player.y);
        const tetherAlpha = applyP1SafeHaloAlpha(0.65, isTeammate, distToPlayer, 28);
        fillTaperedLightningBolt(
          g,
          owner.x,
          owner.y,
          b.x,
          b.y,
          2.0,
          0x38bdf8,
          tetherAlpha,
          ((b.id * 17) & 0xffff),
          5,
          1.4,
        );
      }
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
  underG?: Phaser.GameObjects.Graphics,
  ribbonG?: Phaser.GameObjects.Graphics,
): boolean {
  const floorG = groundG ?? g;
  const underActorG =
    underG ??
    (g as unknown as { underActorGraphics?: Phaser.GameObjects.Graphics }).underActorGraphics ??
    floorG;
  const ribbonTargetG =
    ribbonG ??
    (g as unknown as { weaponRibbonGraphics?: Phaser.GameObjects.Graphics }).weaponRibbonGraphics ??
    g;
  switch (s.kind) {
    case 'focus_laser_beam': {
      const x2 = s.x2 ?? s.x + 200;
      const y2 = s.y2 ?? s.y;
      const dx = x2 - s.x;
      const dy = y2 - s.y;
      const len = Math.hypot(dx, dy) || 1;
      const tx = dx / len;
      const ty = dy / len;
      const nx = -ty;
      const ny = tx;

      const heat = clamp(s.count !== undefined && s.count > 0 ? 80 : 30, 0, 100);
      const coreW = 2.4 + (heat / 100) * 1.6;
      const coreCol = heat < 40 ? 0x38bdf8 : heat < 80 ? 0xf59e0b : 0xf4f1ea;

      // Ink outline
      ribbonTargetG.lineStyle(coreW + 2.8, 0x141019, alpha * 0.9);
      ribbonTargetG.beginPath();
      ribbonTargetG.moveTo(s.x, s.y);
      ribbonTargetG.lineTo(x2, y2);
      ribbonTargetG.strokePath();

      // Core beam
      ribbonTargetG.lineStyle(coreW, coreCol, alpha * 0.96);
      ribbonTargetG.beginPath();
      ribbonTargetG.moveTo(s.x, s.y);
      ribbonTargetG.lineTo(x2, y2);
      ribbonTargetG.strokePath();

      // Center bright needle
      ribbonTargetG.lineStyle(Math.max(1.0, coreW * 0.35), 0xffffff, alpha);
      ribbonTargetG.beginPath();
      ribbonTargetG.moveTo(s.x, s.y);
      ribbonTargetG.lineTo(x2, y2);
      ribbonTargetG.strokePath();

      // 1 sliding 4-point diamond star on the hit rim at (x2, y2)
      const starR = 5.2 + (heat / 100) * 2.5;
      const starOutR = starR + 1.4;
      ribbonTargetG.fillStyle(0x141019, alpha * 0.95);
      ribbonTargetG.fillTriangle(x2 + tx * starOutR, y2 + ty * starOutR, x2 + nx * 3.0, y2 + ny * 3.0, x2 - tx * starOutR, y2 - ty * starOutR);
      ribbonTargetG.fillTriangle(x2 + tx * starOutR, y2 + ty * starOutR, x2 - tx * starOutR, y2 - ty * starOutR, x2 - nx * 3.0, y2 - ny * 3.0);
      ribbonTargetG.fillTriangle(x2 + nx * starOutR, y2 + ny * starOutR, x2 + tx * 3.0, y2 + ty * 3.0, x2 - nx * starOutR, y2 - ny * starOutR);
      ribbonTargetG.fillTriangle(x2 + nx * starOutR, y2 + ny * starOutR, x2 - nx * starOutR, y2 - ny * starOutR, x2 - tx * 3.0, y2 - ty * 3.0);

      ribbonTargetG.fillStyle(0xf4f1ea, alpha);
      ribbonTargetG.fillTriangle(x2 + tx * starR, y2 + ty * starR, x2 + nx * 2.0, y2 + ny * 2.0, x2 - tx * starR, y2 - ty * starR);
      ribbonTargetG.fillTriangle(x2 + tx * starR, y2 + ty * starR, x2 - tx * starR, y2 - ty * starR, x2 - nx * 2.0, y2 - ny * 2.0);
      ribbonTargetG.fillTriangle(x2 + nx * starR, y2 + ny * starR, x2 + tx * 2.0, y2 + ty * 2.0, x2 - nx * starR, y2 - ny * starR);
      ribbonTargetG.fillTriangle(x2 + nx * starR, y2 + ny * starR, x2 - nx * starR, y2 - ny * starR, x2 - tx * 2.0, y2 - ty * 2.0);

      return true;
    }

    case 'focus_laser_railgun': {
      const x2 = s.x2 ?? s.x + 520;
      const y2 = s.y2 ?? s.y;
      const frameIndex = Math.min(5, Math.floor(progress * 6));
      renderFocusLaserRailgunShot(
        ribbonTargetG,
        {
          kind: 'focus_laser_railgun',
          playerId: 1,
          x1: s.x,
          y1: s.y,
          x2,
          y2,
          angle: Math.atan2(y2 - s.y, x2 - s.x),
          width: s.radius || 28,
          damage: 90,
          alertTextVi: '',
        },
        frameIndex,
        alpha,
      );
      return true;
    }

    case 'void_implosion_ring': {
      // Hollow gravitational event-horizon collapse 110px -> 0px over 4 ticks
      const collapseR = s.radius * Math.max(0, 1 - progress);
      floorG.lineStyle(2.4, 0x141019, alpha * 0.86);
      floorG.strokeCircle(s.x, s.y, collapseR);
      floorG.lineStyle(1.8, 0xa855f7, alpha * 0.92);
      floorG.strokeCircle(s.x, s.y, collapseR);
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
      const slamR = 64 * (0.55 + progress * 0.45);
      for (let arcIdx = 0; arcIdx < 4; arcIdx += 1) {
        const aMid = (arcIdx * Math.PI) / 2 + 0.18;
        fillTaperedArcRibbon(
          floorG,
          s.x,
          s.y,
          slamR,
          aMid - 0.46,
          aMid + 0.46,
          2.1,
          0xef4444,
          alpha * 0.9,
          8,
          1.6,
        );
      }
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
      // 4 converging Cutout diamond darts (zero strokeCircle) + center gleam
      const r = s.radius * (0.58 + progress * 0.42);
      for (let k = 0; k < 4; k += 1) {
        const a = (k * Math.PI) / 2 + progress * 0.6;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const nx = -sin * 3.0;
        const ny = cos * 3.0;
        const inX = s.x + cos * (r * 0.65);
        const inY = s.y + sin * (r * 0.65);
        const outX = s.x + cos * (r * 1.05);
        const outY = s.y + sin * (r * 1.05);
        floorG.fillStyle(0x141019, alpha * 0.82);
        floorG.fillTriangle(inX, inY, outX + nx, outY + ny, outX - nx, outY - ny);
        floorG.fillStyle(0xf59e0b, alpha * 0.94);
        floorG.fillTriangle(inX + cos * 2, inY + sin * 2, outX + nx * 0.6, outY + ny * 0.6, outX - nx * 0.6, outY - ny * 0.6);
      }
      g.fillStyle(0xfffdf5, alpha * 0.96);
      g.fillCircle(s.x, s.y, 4.2 * (1 - progress));
      return true;
    }

    case 'solar_supernova_blast': {
      // 8 60Hz corona lances reaching r = 120.0px on underActorGraphics (depth 26.6, zero strokeCircle)
      const targetGfx = underActorG;
      renderSolarSupernovaCoronaLances(targetGfx, s.x, s.y, s.radius || 120.0, progress, alpha);
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

      // Persistent 6-branch radial fissure on floorG (depth 16.0) across frames
      const fAlpha = alpha * (1 - progress * 0.35);
      for (let k = 0; k < 6; k++) {
        const branchAng = (k * Math.PI) / 3 + 0.14;
        const branchLen = 32 + (k % 2) * 14;
        const bx = s.x + Math.cos(branchAng) * branchLen;
        const by = s.y + Math.sin(branchAng) * branchLen;

        floorG.lineStyle(3.0, 0x141019, fAlpha * 0.85);
        floorG.beginPath();
        floorG.moveTo(s.x, s.y);
        floorG.lineTo(bx, by);
        floorG.strokePath();

        floorG.lineStyle(1.6, 0x38bdf8, fAlpha * 0.95);
        floorG.beginPath();
        floorG.moveTo(s.x, s.y);
        floorG.lineTo(bx, by);
        floorG.strokePath();
      }

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

export function spawnEmeraldCleaverSlash(
  fx: CombatFxManager,
  x: number,
  y: number,
  angleRad: number,
  rangePx: number,
  comboStep: 1 | 2 | 3,
  isTeammate: boolean,
): boolean {
  const ally = resolveAllyFxProfile(isTeammate ? 2 : 1, 1);
  const effectiveRange = rangePx || 92.0;
  const dist = fx?.distanceToLocalPlayer ? fx.distanceToLocalPlayer(x, y) : Infinity;
  const alpha = applyP1SafeHaloAlpha(ally.aoeAlpha, isTeammate, dist, effectiveRange);

  if (comboStep === 1) {
    fx.spawnShaderSlash?.(x, y, effectiveRange, angleRad, 'fx_sh_slash_emerald', {
      ttl: 0.19,
      isTeammate,
      flipY: false,
      depth: 42.0,
      alpha,
    });
  } else if (comboStep === 2) {
    fx.spawnShaderSlash?.(x, y, effectiveRange, angleRad, 'fx_sh_slash_emerald', {
      ttl: 0.19,
      isTeammate,
      flipY: true,
      depth: 42.0,
      alpha,
    });
  } else {
    // comboStep === 3: 1:1 at 92.0px, twin fangs
    fx.spawnShaderSlash?.(x, y, effectiveRange, angleRad - 0.22, 'fx_sh_slash_emerald', {
      ttl: 0.22,
      isTeammate,
      flipY: false,
      depth: 42.0,
      alpha,
    });
    fx.spawnShaderSlash?.(x, y, effectiveRange * 0.94, angleRad + 0.22, 'fx_sh_slash_emerald', {
      ttl: 0.21,
      isTeammate,
      flipY: true,
      depth: 42.5,
      alpha,
    });

    if (!isTeammate) {
      const lighting =
        (fx as unknown as { lighting?: { spawnTransientLight: (x: number, y: number, r: number, c: string, i: number, d: number) => void } }).lighting ??
        (fx as unknown as { sceneRef?: { lighting?: { spawnTransientLight: (x: number, y: number, r: number, c: string, i: number, d: number) => void } } }).sceneRef?.lighting;
      lighting?.spawnTransientLight(x, y, 160, PALETTE.LIME_GLOW, 0.95, 0.25);
    }
  }

  return true; // Review Focus #1: returns true on all combo steps 1..3!
}

export function renderEmeraldBoomerangOverlay(
  underGfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  phase: 'outbound' | 'spinning' | 'returning',
  spinAngleRad: number,
  alpha: number,
  isTeammate = false,
  distToLocal = Infinity,
): void {
  const effAlpha = isTeammate ? applyP1SafeHaloAlpha(alpha, true, distToLocal, 56) : alpha;
  if (effAlpha <= 0.005) return;

  if (phase === 'spinning') {
    // 3 120°-spaced fillTaperedArcRibbon jade crescents at r = 56.0px on underActorGraphics (depth 26.6)
    // ZERO full strokeCircle!
    const arcSpan = 0.58;
    const peakHw = 2.4;
    const centerRadius = 56.0 - peakHw;
    for (let k = 0; k < 3; k++) {
      const midAngle = spinAngleRad + k * ((Math.PI * 2) / 3);
      fillTaperedArcRibbon(
        underGfx,
        x,
        y,
        centerRadius,
        midAngle - arcSpan * 0.5,
        midAngle + arcSpan * 0.5,
        peakHw,
        0x10b981,
        effAlpha * 0.92,
        8,
        1.8,
      );
    }
  } else {
    // phase === 'outbound' | 'returning': spinning Cutout blade r = 22.0px
    const bladeSpan = 0.72;
    for (let k = 0; k < 3; k++) {
      const midAngle = spinAngleRad + k * ((Math.PI * 2) / 3);
      fillTaperedArcRibbon(
        underGfx,
        x,
        y,
        22.0,
        midAngle - bladeSpan * 0.5,
        midAngle + bladeSpan * 0.5,
        3.5,
        0x10b981,
        effAlpha,
        6,
        1.8,
      );
    }
  }
}

const CORRIDOR_RESULT = { renderedSegments: 0, chasmBridgeSegments: 0 };

export function renderBerserkerGuillotineCorridor(
  groundGfx: Phaser.GameObjects.Graphics,
  underGfx: Phaser.GameObjects.Graphics,
  map: Pick<ArenaMap, 'width' | 'height' | 'getTile'> & { getSurface?: (tx: number, ty: number) => string },
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  halfWidthPx: number,
  alpha: number,
  isTeammate = false,
  distToLocal = Infinity,
): { renderedSegments: number; chasmBridgeSegments: number } {
  const effAlpha = isTeammate ? applyP1SafeHaloAlpha(alpha, true, distToLocal, halfWidthPx * 2) : alpha;
  CORRIDOR_RESULT.renderedSegments = 0;
  CORRIDOR_RESULT.chasmBridgeSegments = 0;

  const totalSegs = 8;
  const dx = (x2 - x1) / totalSegs;
  const dy = (y2 - y1) / totalSegs;
  const segLen = Math.hypot(dx, dy) || 1;
  const nx = -dy / segLen;
  const ny = dx / segLen;

  for (let i = 0; i < totalSegs; i++) {
    const s0x = x1 + i * dx;
    const s0y = y1 + i * dy;
    const s1x = x1 + (i + 1) * dx;
    const s1y = y1 + (i + 1) * dy;

    // Probe the forward sample of this segment
    const tx = Math.floor(s1x / 32);
    const ty = Math.floor(s1y / 32);

    // Stop ONLY when a sample hits an outer room perimeter wall
    if (tx <= 0 || ty <= 0 || tx >= map.width - 1 || ty >= map.height - 1) {
      break;
    }

    const tile = map.getTile(tx, ty);
    const surface = map.getSurface ? map.getSurface(tx, ty) : undefined;
    const isChasm = (tile as unknown as string) === 'chasm' || surface === 'chasm';

    if (isChasm) {
      // ±18.0px pointed fire-arc bridge on underGfx (depth 26.6)
      CORRIDOR_RESULT.chasmBridgeSegments++;
      CORRIDOR_RESULT.renderedSegments++;

      const midX = (s0x + s1x) * 0.5;
      const midY = (s0y + s1y) * 0.5;
      const topX = midX + nx * halfWidthPx;
      const topY = midY + ny * halfWidthPx;
      const botX = midX - nx * halfWidthPx;
      const botY = midY - ny * halfWidthPx;

      underGfx.fillStyle(0x141019, effAlpha * 0.95);
      underGfx.fillTriangle(s0x, s0y, topX, topY, s1x, s1y);
      underGfx.fillTriangle(s0x, s0y, s1x, s1y, botX, botY);

      underGfx.fillStyle(0xea580c, effAlpha);
      const innerHalf = halfWidthPx * 0.72;
      const inTopX = midX + nx * innerHalf;
      const inTopY = midY + ny * innerHalf;
      const inBotX = midX - nx * innerHalf;
      const inBotY = midY - ny * innerHalf;
      underGfx.fillTriangle(s0x, s0y, inTopX, inTopY, s1x, s1y);
      underGfx.fillTriangle(s0x, s0y, s1x, s1y, inBotX, inBotY);
    } else {
      // Floor or interior pillar (TileKind.Wall / pillar inside 1..width-2):
      // Draw jagged #141019 + #EA580C ember fissure plates on groundGfx (depth 16.0, naturally passing under pillars)
      CORRIDOR_RESULT.renderedSegments++;

      const midX = (s0x + s1x) * 0.5;
      const midY = (s0y + s1y) * 0.5;
      const jag = (i % 2 === 0 ? 1 : -1) * 3.5;
      const px = midX + nx * jag;
      const py = midY + ny * jag;

      groundGfx.lineStyle(halfWidthPx * 1.8, 0x141019, effAlpha * 0.82);
      groundGfx.beginPath();
      groundGfx.moveTo(s0x, s0y);
      groundGfx.lineTo(px, py);
      groundGfx.lineTo(s1x, s1y);
      groundGfx.strokePath();

      groundGfx.lineStyle(3.2, 0xea580c, effAlpha * 0.92);
      groundGfx.beginPath();
      groundGfx.moveTo(s0x, s0y);
      groundGfx.lineTo(px, py);
      groundGfx.lineTo(s1x, s1y);
      groundGfx.strokePath();

      groundGfx.lineStyle(1.4, 0xfacc15, effAlpha * 0.95);
      groundGfx.beginPath();
      groundGfx.moveTo(s0x, s0y);
      groundGfx.lineTo(px, py);
      groundGfx.lineTo(s1x, s1y);
      groundGfx.strokePath();
    }
  }

  return CORRIDOR_RESULT;
}

export function spawnThunderHammerPillarFx(
  fx: CombatFxManager,
  ev: Extract<SimEvent, { kind: 'thunder_hammer_pillar' }>,
  isTeammate: boolean,
): void {
  const ally = resolveAllyFxProfile(isTeammate ? 2 : 1, 1);
  const strikes = ev.strikes?.length
    ? ev.strikes
    : [{ x: ev.x, y: ev.y, radius: ev.radius || 110, damage: ev.damage || 54 }];

  // Register persistent transient ground shape (ttl ≈ 0.35s) for each strike
  const sceneKey = (fx as unknown as { sceneRef?: object }).sceneRef ?? fx;
  if (sceneKey) {
    const state = getWeaponV2OverlayState(sceneKey);
    for (let i = 0; i < strikes.length; i++) {
      const s = strikes[i]!;
      pushP1BShape(state, {
        kind: 'thunder_pillar_strike',
        x: s.x,
        y: s.y,
        radius: s.radius || 110,
        count: 6,
        color: 0x38bdf8,
        ttlSec: 0.35,
        maxTtlSec: 0.35,
      });
    }
  }

  for (let i = 0; i < strikes.length; i++) {
    const s = strikes[i]!;
    const strikeRad = s.radius || 110;
    const dist = fx?.distanceToLocalPlayer ? fx.distanceToLocalPlayer(s.x, s.y) : Infinity;
    const alpha = applyP1SafeHaloAlpha(ally.aoeAlpha, isTeammate, dist, strikeRad);

    // 1. -90px vertical fillTaperedLightningBolt (depth 42.5)
    const targetGfx =
      fx.weaponRibbonGraphics ??
      fx.underActorGraphics ??
      (fx as unknown as { lightningGraphics?: Phaser.GameObjects.Graphics }).lightningGraphics;
    if (targetGfx) {
      fillTaperedLightningBolt(
        targetGfx,
        s.x,
        s.y - 90,
        s.x,
        s.y,
        4.5,
        0x38bdf8,
        alpha,
        ((s.x * 31 + s.y) & 0xffff) + i,
        6,
        1.8,
      );
    }

    // 2. Stamps 6-branch radial fissure (depth 16.0)
    const floorG =
      (fx as unknown as { groundHazardGraphics?: Phaser.GameObjects.Graphics }).groundHazardGraphics ??
      (fx as unknown as { sceneRef?: { groundHazardGraphics?: Phaser.GameObjects.Graphics } }).sceneRef?.groundHazardGraphics;
    if (floorG) {
      for (let k = 0; k < 6; k++) {
        const branchAng = (k * Math.PI) / 3 + 0.14;
        const branchLen = 32 + (k % 2) * 14;
        const bx = s.x + Math.cos(branchAng) * branchLen;
        const by = s.y + Math.sin(branchAng) * branchLen;

        floorG.lineStyle(3.0, 0x141019, isTeammate ? 0.35 : 0.85);
        floorG.beginPath();
        floorG.moveTo(s.x, s.y);
        floorG.lineTo(bx, by);
        floorG.strokePath();

        floorG.lineStyle(1.6, 0x38bdf8, isTeammate ? 0.35 : 0.95);
        floorG.beginPath();
        floorG.moveTo(s.x, s.y);
        floorG.lineTo(bx, by);
        floorG.strokePath();
      }
    }

    // 3. Routes ev.radius (110px) via routeCutoutBurstByRadius(fx, s.x, s.y, s.radius, 'fx_sh_nova_thunder')
    routeCutoutBurstByRadius(fx, s.x, s.y, strikeRad, 'fx_sh_nova_thunder', {
      isTeammate,
      depth: 42.5,
      tint: 0x38bdf8,
    });

    fx.spawnHitSparks?.(s.x, s.y, 0, { isCrit: true, element: 'shock', count: 6, isTeammate });
  }

  // Transient light
  if (!isTeammate) {
    const lighting =
      (fx as unknown as { lighting?: { spawnTransientLight: (x: number, y: number, r: number, c: string, i: number, d: number) => void } }).lighting ??
      (fx as unknown as { sceneRef?: { lighting?: { spawnTransientLight: (x: number, y: number, r: number, c: string, i: number, d: number) => void } } }).sceneRef?.lighting;
    lighting?.spawnTransientLight(ev.x, ev.y, 195, PALETTE.CYAN_FROST, 1.0, 0.48);
  }
}

export function renderFocusLaserRailgunShot(
  ribbonGfx: Phaser.GameObjects.Graphics,
  ev: Extract<SimEvent, { kind: 'focus_laser_railgun' }>,
  frameIndex: number,
  alpha: number,
): void {
  const dx = ev.x2 - ev.x1;
  const dy = ev.y2 - ev.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const tx = dx / len;
  const ty = dy / len;

  if (frameIndex === 0 || frameIndex === 1) {
    // 2-frame #141019 inverted-ink flash (±14.0px tapered to ±4.0px at muzzle, #F4F1EA 4px center spine)
    const mLeftX = ev.x1 + nx * 4.0;
    const mLeftY = ev.y1 + ny * 4.0;
    const mRightX = ev.x1 - nx * 4.0;
    const mRightY = ev.y1 - ny * 4.0;

    const eLeftX = ev.x2 + nx * 14.0;
    const eLeftY = ev.y2 + ny * 14.0;
    const eRightX = ev.x2 - nx * 14.0;
    const eRightY = ev.y2 - ny * 14.0;

    ribbonGfx.fillStyle(0x141019, alpha * 0.96);
    ribbonGfx.fillTriangle(mLeftX, mLeftY, eLeftX, eLeftY, eRightX, eRightY);
    ribbonGfx.fillTriangle(mLeftX, mLeftY, eRightX, eRightY, mRightX, mRightY);

    // #F4F1EA 4px center spine (±2.0px)
    const smLeftX = ev.x1 + nx * 2.0;
    const smLeftY = ev.y1 + ny * 2.0;
    const smRightX = ev.x1 - nx * 2.0;
    const smRightY = ev.y1 - ny * 2.0;

    const seLeftX = ev.x2 + nx * 2.0;
    const seLeftY = ev.y2 + ny * 2.0;
    const seRightX = ev.x2 - nx * 2.0;
    const seRightY = ev.y2 - ny * 2.0;

    ribbonGfx.fillStyle(0xf4f1ea, alpha);
    ribbonGfx.fillTriangle(smLeftX, smLeftY, seLeftX, seLeftY, seRightX, seRightY);
    ribbonGfx.fillTriangle(smLeftX, smLeftY, seRightX, seRightY, smRightX, smRightY);
  } else {
    // 4 frames of dashed Cutout shock-rails at ±14.0px
    const step = 24;
    const dashLen = 14;
    for (const side of [-1, 1] as const) {
      const railOffsetX = nx * (side * 14.0);
      const railOffsetY = ny * (side * 14.0);

      for (let d = 0; d < len; d += step) {
        const d0 = d;
        const d1 = Math.min(len, d + dashLen);

        const p0x = ev.x1 + tx * d0 + railOffsetX;
        const p0y = ev.y1 + ty * d0 + railOffsetY;
        const p1x = ev.x1 + tx * d1 + railOffsetX;
        const p1y = ev.y1 + ty * d1 + railOffsetY;

        // Ink outline (width 2.6px => ±1.3px, staying within ±15.3px from axis)
        const inW = 1.3;
        ribbonGfx.fillStyle(0x141019, alpha * 0.88);
        ribbonGfx.fillTriangle(
          p0x + nx * inW, p0y + ny * inW,
          p1x + nx * inW, p1y + ny * inW,
          p1x - nx * inW, p1y - ny * inW,
        );
        ribbonGfx.fillTriangle(
          p0x + nx * inW, p0y + ny * inW,
          p1x - nx * inW, p1y - ny * inW,
          p0x - nx * inW, p0y - ny * inW,
        );

        // Core fill (width 1.2px => ±0.6px)
        const coreW = 0.6;
        ribbonGfx.fillStyle(0xfacc15, alpha * 0.95);
        ribbonGfx.fillTriangle(
          p0x + nx * coreW, p0y + ny * coreW,
          p1x + nx * coreW, p1y + ny * coreW,
          p1x - nx * coreW, p1y - ny * coreW,
        );
        ribbonGfx.fillTriangle(
          p0x + nx * coreW, p0y + ny * coreW,
          p1x - nx * coreW, p1y - ny * coreW,
          p0x - nx * coreW, p0y - ny * coreW,
        );
      }
    }

    // Residual core filament
    const resW = 0.9;
    ribbonGfx.fillStyle(0xf4f1ea, alpha * 0.65);
    ribbonGfx.fillTriangle(
      ev.x1 + nx * resW, ev.y1 + ny * resW,
      ev.x2 + nx * resW, ev.y2 + ny * resW,
      ev.x2 - nx * resW, ev.y2 - ny * resW,
    );
    ribbonGfx.fillTriangle(
      ev.x1 + nx * resW, ev.y1 + ny * resW,
      ev.x2 - nx * resW, ev.y2 - ny * resW,
      ev.x1 - nx * resW, ev.y1 - ny * resW,
    );
  }
}

export function renderSolarSupernovaCoronaLances(
  underGfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  progress: number,
  alpha: number,
): void {
  const innerR = 26.0;
  const reachR = radius || 120.0;
  for (let k = 0; k < 8; k += 1) {
    const angle = (k * Math.PI) / 4 + progress * 0.25;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = -sin;
    const ny = cos;

    const baseHalfW = 3.6;
    const b1x = x + cos * innerR + nx * baseHalfW;
    const b1y = y + sin * innerR + ny * baseHalfW;
    const b2x = x + cos * innerR - nx * baseHalfW;
    const b2y = y + sin * innerR - ny * baseHalfW;
    const tipX = x + cos * reachR;
    const tipY = y + sin * reachR;

    // #141019 ink outline
    underGfx.fillStyle(0x141019, alpha * 0.88);
    const outPad = 1.2;
    underGfx.fillTriangle(
      b1x + nx * outPad, b1y + ny * outPad,
      tipX, tipY,
      b2x - nx * outPad, b2y - ny * outPad,
    );

    // #FACC15 / #F4F1EA core lance
    underGfx.fillStyle(k % 2 === 0 ? 0xfacc15 : 0xf4f1ea, alpha * 0.95);
    underGfx.fillTriangle(b1x, b1y, tipX - cos * 1.0, tipY - sin * 1.0, b2x, b2y);
  }
}

export function spawnSolarSupernovaFx(
  fx: CombatFxManager,
  ev: Extract<SimEvent, { kind: 'solar_supernova' }>,
  isTeammate: boolean,
): void {
  const rad = ev.radius || 120.0;
  const ally = resolveAllyFxProfile(isTeammate ? 2 : 1, 1);
  const dist = fx?.distanceToLocalPlayer ? fx.distanceToLocalPlayer(ev.x, ev.y) : Infinity;
  const alpha = applyP1SafeHaloAlpha(ally.aoeAlpha, isTeammate, dist, rad);

  routeCutoutBurstByRadius(fx, ev.x, ev.y, rad, 'fx_sh_nova_solar', {
    isTeammate,
    depth: 43.5,
    tint: 0xfacc15,
    alpha,
  });

  const sceneKey = (fx as unknown as { sceneRef?: object }).sceneRef ?? fx;
  if (sceneKey) {
    const state = getWeaponV2OverlayState(sceneKey);
    pushP1BShape(state, {
      kind: 'solar_supernova_blast',
      x: ev.x,
      y: ev.y,
      radius: rad,
      color: 0xfacc15,
      ttlSec: 0.42,
      maxTtlSec: 0.42,
    });
  }

  const underGfx =
    fx.underActorGraphics ??
    (fx as unknown as { sceneRef?: { underActorGraphics?: Phaser.GameObjects.Graphics } }).sceneRef?.underActorGraphics;
  if (underGfx) {
    renderSolarSupernovaCoronaLances(underGfx, ev.x, ev.y, rad, 0, alpha);
  }
}

export function spawnMagmaGeyserClusterFx(
  fx: CombatFxManager,
  ev: Extract<SimEvent, { kind: 'magma_geyser_eruption' }>,
  isTeammate: boolean,
  sceneKeyArg?: object,
): { rimCount: number; tallPlumeCount: number; lowBoilCount: number } {
  const geysers =
    ev.geysers && ev.geysers.length > 0
      ? ev.geysers
      : [{ x: (ev as unknown as { x?: number }).x ?? 0, y: (ev as unknown as { y?: number }).y ?? 0, radius: ev.radius || 56, damage: ev.damage || 40 }];

  let rimCount = 0;
  let tallPlumeCount = 0;
  let lowBoilCount = 0;
  const tallPlumePositions: Array<{ x: number; y: number }> = [];

  if (fx.particlePool) {
    for (const p of fx.particlePool) {
      if (p.active && (p.textureKey === 'fx_sh_geyser_plume' || p.frameName === 'fx_sh_geyser_plume')) {
        tallPlumePositions.push({ x: p.x, y: p.y });
      }
    }
  }

  const ally = resolveAllyFxProfile(isTeammate ? 2 : 1, 1);
  const sceneKey = sceneKeyArg ?? (fx as unknown as { sceneRef?: object }).sceneRef ?? fx;

  for (let i = 0; i < geysers.length; i++) {
    const gy = geysers[i]!;
    const rad = gy.radius || 56.0;
    rimCount += 1;

    const distToPlayer = fx.distanceToLocalPlayer ? fx.distanceToLocalPlayer(gy.x, gy.y) : Infinity;
    const aoeAlpha = applyP1SafeHaloAlpha(ally.aoeAlpha, isTeammate, distToPlayer, rad);

    // 1. Persistent magma rim at depth 16.0
    if (sceneKey) {
      const state = getWeaponV2OverlayState(sceneKey);
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
    }

    // 2. Tall plume vs low boil proximity check (46px spacing) + crisp 3-tick ignition rim on distinct craters
    let isTooClose = false;
    for (const pos of tallPlumePositions) {
      if (Math.hypot(gy.x - pos.x, gy.y - pos.y) < 46.0) {
        isTooClose = true;
        break;
      }
    }

    if (!isTooClose && fx.activePerimeterRings) {
      const ring = (fx.perimeterRingFreePool ? fx.perimeterRingFreePool.pop() : undefined) ?? {
        active: true,
        x: gy.x,
        y: gy.y,
        targetRadiusPx: rad,
        currentRadiusPx: rad * 0.65,
        colorNum: 0xf97316,
        alpha: aoeAlpha,
        age: 0,
        ttl: 0.06,
      };
      ring.active = true;
      ring.x = gy.x;
      ring.y = gy.y;
      ring.targetRadiusPx = rad;
      ring.currentRadiusPx = rad * 0.65;
      ring.colorNum = 0xf97316;
      ring.alpha = aoeAlpha;
      ring.age = 0;
      ring.ttl = 0.06;
      fx.activePerimeterRings.push(ring);
    }

    if (isTooClose) {
      lowBoilCount += 1;
      const slot =
        typeof fx.acquireParticleSlot === 'function'
          ? fx.acquireParticleSlot()
          : fx.particlePool
            ? acquireParticleSlot.call(fx)
            : undefined;
      if (slot) {
        const boilScale = 12 / 11.0;
        activateParticle(slot, {
          textureKey: CUTOUT_KIT_ATLAS_KEY,
          frameName: 'fx_micro_burst_4f_0',
          kitFramePrefix: 'fx_micro_burst_4f',
          frameCount: 4,
          x: gy.x,
          y: gy.y,
          ttl: 0.2,
          startScale: boilScale,
          endScale: boilScale,
          startAlpha: aoeAlpha,
          depth: 26.4,
          blendMode: 'NORMAL',
          preserveFlipbookAlpha: true,
        });
      }
    } else {
      tallPlumeCount += 1;
      tallPlumePositions.push({ x: gy.x, y: gy.y });
      fx.spawnShaderNova?.(gy.x, gy.y, rad, 'fx_sh_geyser_plume');
    }

    fx.spawnFloorDecal?.('scorch', gy.x, gy.y, 1.0);
  }

  return { rimCount, tallPlumeCount, lowBoilCount };
}
