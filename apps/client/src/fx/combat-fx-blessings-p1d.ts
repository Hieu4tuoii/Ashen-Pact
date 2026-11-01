import {
  distance,
  type SimEvent,
  type SimProjectileState,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import type { ShaderNovaKey } from '../art/texture-baker-shader-fx.js';
import { PALETTE } from '../art/palette.js';
import { zzfx } from '../audio/zzfx.js';
import { getVisualQueryConfig } from '../core/visual-query.js';
import type { GameScene } from '../scenes/GameScene.js';
import type { CombatFxManager } from './combat-fx.js';
import { getWeaponV2OverlayState, type TransientWeaponV2Shape } from './combat-fx-weapons-v2.js';

export const P1D_BLESSING_EVENT_KINDS = [
  'table_tech_rocket_launch',
  'table_tech_blank_nova',
  'table_tech_prism_split',
  'dash_tidal_ram_hit',
  'dash_tidal_ram_refund',
  'dash_flame_shackle',
  'dash_reload_acrobat',
  'reload_tediore_chuck',
  'reload_frost_nova',
  'reload_magnet_vortex',
  'reload_repulsor_shock',
  'bullet_split_bounce',
  'bullet_ricochet_boom',
  'bullet_pinball_collide',
  'bullet_coop_arc_relay',
  'vanguard_shield_charge',
  'ranger_arrow_wall_blast',
  'druid_poison_root_whip',
] as const;

export type P1DBlessingVfxKind = (typeof P1D_BLESSING_EVENT_KINDS)[number];

export function isVisualFreezeActive(scene?: unknown): boolean {
  if (scene && typeof scene === 'object' && (scene as { visualFreeze?: boolean }).visualFreeze) {
    return true;
  }
  if (getVisualQueryConfig().freeze) {
    return true;
  }
  const g = globalThis as {
    __AP_VISUAL_FREEZE__?: boolean;
    location?: { search?: string };
  };
  if (g.__AP_VISUAL_FREEZE__ === true) return true;
  if (typeof g.location?.search === 'string' && g.location.search.includes('visualFreeze=1')) {
    return true;
  }
  return false;
}

function resolveGraphics(sceneOrG: unknown): Phaser.GameObjects.Graphics | null {
  if (!sceneOrG || typeof sceneOrG !== 'object') return null;
  if ('strokeCircle' in sceneOrG && typeof (sceneOrG as { strokeCircle?: unknown }).strokeCircle === 'function') {
    return sceneOrG as Phaser.GameObjects.Graphics;
  }
  const maybeScene = sceneOrG as { telegraphGraphics?: Phaser.GameObjects.Graphics };
  return maybeScene.telegraphGraphics ?? null;
}

function resolveFloorGraphics(
  sceneOrG: unknown,
  fallbackG: Phaser.GameObjects.Graphics,
  explicitGroundG?: Phaser.GameObjects.Graphics,
): Phaser.GameObjects.Graphics {
  if (explicitGroundG) return explicitGroundG;
  if (sceneOrG && typeof sceneOrG === 'object' && 'groundHazardGraphics' in sceneOrG) {
    const gg = (sceneOrG as { groundHazardGraphics?: Phaser.GameObjects.Graphics }).groundHazardGraphics;
    if (gg) return gg;
  }
  return fallbackG;
}

/**
 * Draws procedural Chiaroscuro 1:1 overlays for active P1D projectiles (`table_tech_rocket`, `reload_tediore_chuck`,
 * `vanguard_bastion_prism`, and `splitGeneration >= 1` child bullets).
 */
export function drawP1DBlessingProjectileOverlay(
  sceneOrG: unknown,
  gOrB: Phaser.GameObjects.Graphics | SimProjectileState,
  bOrClock?: SimProjectileState | number,
  clockSecArg = 0,
): void {
  const hasSceneArg =
    bOrClock !== undefined && typeof bOrClock === 'object' && 'weaponId' in bOrClock;
  const g = hasSceneArg
    ? (gOrB as Phaser.GameObjects.Graphics)
    : resolveGraphics(sceneOrG);
  const b = (hasSceneArg ? bOrClock : gOrB) as SimProjectileState | undefined;
  if (!g || !b || b.team !== 'player') return;
  const freeze = hasSceneArg ? isVisualFreezeActive(sceneOrG) : isVisualFreezeActive();
  const t = freeze ? 0 : hasSceneArg ? clockSecArg : typeof bOrClock === 'number' ? bOrClock : 0;
  const ang = b.angle ?? Math.atan2(b.vy, b.vx);
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);

  if (b.weaponId === 'table_tech_rocket') {
    const tailX = b.x - cos * 11;
    const tailY = b.y - sin * 11;
    g.lineStyle(4.8, 0x141019, 0.85);
    g.lineBetween(tailX, tailY, b.x + cos * 5, b.y + sin * 5);
    g.lineStyle(2.8, 0xf97316, 0.95);
    g.lineBetween(tailX, tailY, b.x + cos * 5, b.y + sin * 5);
    g.fillStyle(0xfffdf5, 0.96);
    g.fillCircle(tailX - cos * (2 + Math.sin(t * 25 + b.id) * 1.5), tailY - sin * 2, 3.2);
    g.lineStyle(1.4, 0xfacc15, 0.88);
    g.strokeCircle(b.x, b.y, b.radius + 2);
  } else if (b.weaponId === 'reload_tediore_chuck') {
    const spin = freeze ? 0.6 : t * 14 + b.id;
    const rx = Math.cos(spin) * 6;
    const ry = Math.sin(spin) * 6;
    g.lineStyle(4.0, 0x141019, 0.86);
    g.lineBetween(b.x - rx, b.y - ry, b.x + rx, b.y + ry);
    g.lineStyle(2.2, 0xf97316, 0.94);
    g.lineBetween(b.x - rx, b.y - ry, b.x + rx, b.y + ry);
    g.fillStyle(0xfffdf5, 0.94);
    g.fillCircle(b.x, b.y, 2.8);
    g.lineStyle(1.3, 0xfacc15, 0.72);
    g.strokeCircle(b.x, b.y, b.radius + 3);
  } else if (b.weaponId === 'vanguard_bastion_prism') {
    g.lineStyle(2.4, 0xf97316, 0.92);
    g.strokeCircle(b.x, b.y, b.radius + 1.5);
    g.fillStyle(0xfffdf5, 0.95);
    g.fillCircle(b.x, b.y, 2.5);
  } else if ((b.splitGeneration ?? 0) >= 1) {
    g.lineStyle(1.6, 0x38bdf8, 0.82);
    g.strokeCircle(b.x, b.y, Math.max(2.5, b.radius * 0.9));
    g.lineBetween(b.x - cos * 7, b.y - sin * 7, b.x, b.y);
  }
}

/**
 * Draws active world/prop/zone/summon/player overlays for Phase P1D blessings and skill upgrades.
 */
export function drawP1DBlessingActiveOverlays(
  sceneOrG: unknown,
  sim?: WorldSim,
  clockSec = 0,
  groundG?: Phaser.GameObjects.Graphics,
): void {
  const g = resolveGraphics(sceneOrG);
  const activeSim =
    sim ?? (sceneOrG && typeof sceneOrG === 'object' ? (sceneOrG as { sim?: WorldSim }).sim : undefined);
  if (!g || !activeSim) return;
  const floorG = resolveFloorGraphics(sceneOrG, g, groundG);
  const freeze = isVisualFreezeActive(sceneOrG);
  const t = freeze ? 0 : clockSec;
  const pulse = Math.sin(t * 8) * 2;

  const props = activeSim.props ?? [];
  const allPlayers =
    typeof activeSim.getAllPlayers === 'function' ? activeSim.getAllPlayers() : [];
  const skillZones = activeSim.skillZones ?? [];
  const summons = activeSim.summons ?? [];
  const enemies = activeSim.enemies ?? [];
  const projectiles = activeSim.projectiles ?? [];

  // 1. Props: Prism Barricade Aura, Rocket-Charged Barricade, Billiard Master Ricochet
  for (let i = 0; i < props.length; i++) {
    const pr = props[i]!;
    if (pr.hp <= 0) continue;
    if (pr.coverState === 'flipped' && pr.prismAuraActive) {
      floorG.lineStyle(3.2, 0x141019, 0.65);
      floorG.strokeCircle(pr.x, pr.y, pr.radius + 10 + pulse * 0.5);
      floorG.lineStyle(2.0, 0x34d399, 0.86);
      floorG.strokeCircle(pr.x, pr.y, pr.radius + 10 + pulse * 0.5);
      floorG.lineStyle(1.2, 0x38bdf8, 0.68);
      floorG.strokeCircle(pr.x, pr.y, pr.radius + 5);
    }
    if (pr.coverState === 'sliding' && pr.rocketCharged) {
      const ang = Math.atan2(pr.vy || 0, pr.vx || 1);
      const backX = pr.x - Math.cos(ang) * (pr.radius + 10);
      const backY = pr.y - Math.sin(ang) * (pr.radius + 10);
      g.lineStyle(2.4, 0xf97316, 0.92);
      g.strokeCircle(pr.x, pr.y, pr.radius + 5);
      g.fillStyle(0xfffdf5, 0.92);
      g.fillCircle(backX, backY, 5.0);
    } else if (pr.coverState === 'sliding' && (pr.bouncesRemaining ?? 0) > 0) {
      g.lineStyle(1.8, 0xe2e8f0, 0.78);
      g.strokeCircle(pr.x, pr.y, pr.radius + 4);
    }
  }

  // 2. Players: Tidal Ram bow wave & Vanguard Bastion Prism 360° shield dome
  let anyPreyChainOwner = false;
  for (let i = 0; i < allPlayers.length; i++) {
    const pl = allPlayers[i]!;
    const blessings = pl.blessingIds ?? [];
    if (blessings.includes('ranger_prey_chain')) anyPreyChainOwner = true;
    if (pl.lifeState !== 'alive') continue;
    if (pl.dashTimer > 0 && blessings.includes('dash_tidal_ram')) {
      const dAng = Math.atan2(pl.dashDirY || Math.sin(pl.aimAngle), pl.dashDirX || Math.cos(pl.aimAngle));
      g.lineStyle(5.2, 0x141019, 0.78);
      g.beginPath();
      g.arc(pl.x, pl.y, pl.radius + 10, dAng - 1.05, dAng + 1.05, false);
      g.strokePath();
      g.lineStyle(3.0, 0x38bdf8, 0.92);
      g.beginPath();
      g.arc(pl.x, pl.y, pl.radius + 10, dAng - 1.05, dAng + 1.05, false);
      g.strokePath();
      g.lineStyle(1.4, 0xfffdf5, 0.96);
      g.beginPath();
      g.arc(pl.x, pl.y, pl.radius + 11, dAng - 0.85, dAng + 0.85, false);
      g.strokePath();
    }
    if (
      pl.characterId === 'vanguard' &&
      pl.skillActiveTimer > 0 &&
      blessings.includes('vanguard_bastion_prism')
    ) {
      g.lineStyle(4.2, 0x141019, 0.72);
      g.strokeCircle(pl.x, pl.y, 34 + pulse * 0.4);
      g.lineStyle(2.4, 0xf97316, 0.9);
      g.strokeCircle(pl.x, pl.y, 34 + pulse * 0.4);
      g.lineStyle(1.3, 0xfffdf5, 0.78);
      g.strokeCircle(pl.x, pl.y, 30);
    }
  }

  // 3. Skill Zones: Elementalist Twin Orbit cutting beam & Vortex pull rings
  for (let i = 0; i < skillZones.length; i++) {
    const z = skillZones[i]!;
    if (z.ttlSec <= 0) continue;
    if (z.vortex) {
      floorG.lineStyle(1.5, 0x60a5fa, 0.52);
      floorG.strokeCircle(z.x, z.y, Math.max(16, z.radius * 0.55 + pulse));
    }
    if (z.linkedZoneId && !z.isTwinSecondary) {
      const partner = skillZones.find((o) => o.id === z.linkedZoneId && o.ttlSec > 0);
      if (partner) {
        g.lineStyle(6.0, 0x141019, 0.78);
        g.beginPath();
        g.moveTo(z.x, z.y);
        g.lineTo(partner.x, partner.y);
        g.strokePath();
        g.lineStyle(3.4, 0xc084fc, 0.88);
        g.beginPath();
        g.moveTo(z.x, z.y);
        g.lineTo(partner.x, partner.y);
        g.strokePath();
        g.lineStyle(1.5, 0xfffdf5, 0.95);
        g.beginPath();
        g.moveTo(z.x, z.y);
        g.lineTo(partner.x, partner.y);
        g.strokePath();
      }
    }
  }

  // 4. Summons: Twin Tesla Turret laser fence, Self-Destruct core, Sacred Grove canopy
  for (let i = 0; i < summons.length; i++) {
    const s1 = summons[i]!;
    if (s1.hp <= 0 || s1.ttlSec <= 0) continue;
    if (s1.kind === 'tesla_turret') {
      if (s1.selfDestruct) {
        floorG.lineStyle(2.0, 0xf97316, 0.85);
        floorG.strokeCircle(s1.x, s1.y, s1.radius + 5 + pulse * 0.4);
      }
      for (let j = i + 1; j < summons.length; j++) {
        const s2 = summons[j]!;
        if (
          s2.kind === 'tesla_turret' &&
          s2.hp > 0 &&
          s2.ttlSec > 0 &&
          s1.ownerPlayerId === s2.ownerPlayerId
        ) {
          g.lineStyle(5.0, 0x141019, 0.74);
          g.beginPath();
          g.moveTo(s1.x, s1.y);
          g.lineTo(s2.x, s2.y);
          g.strokePath();
          g.lineStyle(2.8, 0x38bdf8, 0.86);
          g.beginPath();
          g.moveTo(s1.x, s1.y);
          g.lineTo(s2.x, s2.y);
          g.strokePath();
          g.lineStyle(1.3, 0xfacc15, 0.94);
          g.beginPath();
          g.moveTo(s1.x, s1.y);
          g.lineTo(s2.x, s2.y);
          g.strokePath();
        }
      }
    } else if (s1.kind === 'sacred_tree') {
      if (s1.sacredGrove) {
        floorG.lineStyle(1.8, 0x2dd4bf, 0.62);
        floorG.strokeCircle(s1.x, s1.y, s1.auraRadius);
      }
      if (s1.poisonRoots) {
        floorG.lineStyle(1.6, 0x4ade80, 0.75);
        floorG.strokeCircle(s1.x, s1.y, s1.radius + 7);
      }
    }
  }

  // 5. Enemies: Ranger Prey Chain Chiaroscuro links & Heavy Pinball rebound ring
  const markedEnemies = anyPreyChainOwner
    ? enemies.filter((e) => e.hp > 0 && e.markedTimer > 0)
    : [];
  for (let i = 0; i < markedEnemies.length; i++) {
    const a = markedEnemies[i]!;
    for (let j = i + 1; j < markedEnemies.length; j++) {
      const b = markedEnemies[j]!;
      if (distance(a.x, a.y, b.x, b.y) <= 220) {
        floorG.lineStyle(3.6, 0x141019, 0.65);
        floorG.beginPath();
        floorG.moveTo(a.x, a.y);
        floorG.lineTo(b.x, b.y);
        floorG.strokePath();
        floorG.lineStyle(1.8, 0xfacc15, 0.82);
        floorG.beginPath();
        floorG.moveTo(a.x, a.y);
        floorG.lineTo(b.x, b.y);
        floorG.strokePath();
      }
    }
  }
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]!;
    if (e.hp > 0 && (e.pinballReboundTimer ?? 0) > 0) {
      g.lineStyle(2.0, 0xcbd5e1, 0.85);
      g.strokeCircle(e.x, e.y, e.radius + 5);
    }
  }

  // 6. Active projectiles overlay pass when called directly with (scene, sim, clockSec)
  for (let i = 0; i < projectiles.length; i++) {
    drawP1DBlessingProjectileOverlay(sceneOrG, g, projectiles[i]!, t);
  }
}

function pushP1DShape(scene: object, shape: TransientWeaponV2Shape): void {
  const state = getWeaponV2OverlayState(scene);
  if (state.shapes.length >= 48) {
    state.shapes.shift();
  }
  state.shapes.push(shape);
}

const COLOR_BY_P1D_KIND: Readonly<Record<P1DBlessingVfxKind, number>> = {
  table_tech_rocket_launch: 0xf97316,
  table_tech_blank_nova: 0x38bdf8,
  table_tech_prism_split: 0x34d399,
  dash_tidal_ram_hit: 0x60a5fa,
  dash_tidal_ram_refund: 0x38bdf8,
  dash_flame_shackle: 0xfb923c,
  dash_reload_acrobat: 0xfbbf24,
  reload_tediore_chuck: 0xef4444,
  reload_frost_nova: 0x38bdf8,
  reload_magnet_vortex: 0xa78bfa,
  reload_repulsor_shock: 0xf59e0b,
  bullet_split_bounce: 0xcbd5e1,
  bullet_ricochet_boom: 0xf97316,
  bullet_pinball_collide: 0x94a3b8,
  bullet_coop_arc_relay: 0xfacc15,
  vanguard_shield_charge: 0x84cc16,
  ranger_arrow_wall_blast: 0x10b981,
  druid_poison_root_whip: 0x4ade80,
};

const NOVA_KEY_BY_P1D_KIND: Partial<Record<P1DBlessingVfxKind, ShaderNovaKey>> = {
  table_tech_rocket_launch: 'fx_sh_shrapnel_corona',
  table_tech_blank_nova: 'fx_sh_nova_cryo',
  dash_tidal_ram_hit: 'fx_sh_vortex_gale',
  reload_tediore_chuck: 'fx_sh_shrapnel_corona',
  reload_frost_nova: 'fx_sh_nova_cryo',
  reload_magnet_vortex: 'fx_sh_vortex_gale',
  bullet_ricochet_boom: 'fx_sh_shrapnel_corona',
  ranger_arrow_wall_blast: 'fx_sh_spore_cloud',
  druid_poison_root_whip: 'fx_sh_bloom_briar',
};

function dispatchP1DShaderFlipbook(
  scene: object,
  kind: P1DBlessingVfxKind,
  x: number,
  y: number,
  radius: number,
  angle: number,
): void {
  const fx = (scene as { fx?: CombatFxManager }).fx;
  if (!fx) return;
  if (kind === 'druid_poison_root_whip') {
    fx.spawnShaderSlash?.(x, y, Math.max(54, radius), angle, 'fx_sh_slash_emerald');
    fx.spawnShaderNova?.(x, y, Math.max(38, radius * 0.65), 'fx_sh_bloom_briar');
    return;
  }
  const novaKey = NOVA_KEY_BY_P1D_KIND[kind];
  if (novaKey) {
    fx.spawnShaderNova?.(x, y, Math.max(36, radius), novaKey);
    return;
  }
  if (kind === 'table_tech_prism_split') {
    fx.spawnShaderCone?.(x, y, Math.max(48, radius), angle);
    fx.spawnShaderNova?.(x, y, Math.max(36, radius * 0.65), 'fx_sh_arcane_sigil', {
      tint: 0x67e8f9,
    });
    return;
  }
  if (kind === 'reload_repulsor_shock') {
    fx.spawnShaderCone?.(x, y, Math.max(48, radius), angle);
    return;
  }
  if (kind === 'vanguard_shield_charge') {
    if (fx.spawnShaderDirectional) {
      fx.spawnShaderDirectional(x, y, Math.max(58, radius), angle, 'fx_sh_aegis_crest');
    } else {
      fx.spawnShaderSlash?.(x, y, Math.max(54, radius), angle, 'fx_sh_slash_steel');
    }
    return;
  }
  if (kind === 'bullet_coop_arc_relay') {
    fx.spawnShaderNova?.(x, y, Math.max(40, radius * 0.65), 'fx_sh_anvil_storm');
  }
}

/**
 * Spawns deterministic transient VFX for explicit P1D blessing event kinds or matching SimEvents.
 */
export function spawnP1DBlessingEventFx(
  scene: GameScene | object,
  ev: SimEvent | { kind: string; x?: number; y?: number; x2?: number; y2?: number; radius?: number; angle?: number },
  sim?: WorldSim,
  isStress = false,
  allowStressSfx = true,
): boolean {
  if (!scene || isStress) return false;
  const kind = ev.kind as P1DBlessingVfxKind;
  if ((P1D_BLESSING_EVENT_KINDS as readonly string[]).includes(kind)) {
    const raw = ev as {
      x?: number;
      y?: number;
      x2?: number;
      y2?: number;
      radius?: number;
      angle?: number;
    };
    const x = raw.x ?? 0;
    const y = raw.y ?? 0;
    const radius = raw.radius ?? 72;
    const angle = raw.angle ?? 0;
    const color = COLOR_BY_P1D_KIND[kind] ?? 0xfacc15;
    pushP1DShape(scene, {
      kind,
      x,
      y,
      x2: raw.x2 ?? x + Math.cos(angle) * 64,
      y2: raw.y2 ?? y + Math.sin(angle) * 64,
      radius,
      angle,
      color,
      ttlSec: 0.34,
      maxTtlSec: 0.34,
    });
    dispatchP1DShaderFlipbook(scene, kind, x, y, radius, angle);
    return true;
  }

  // Also enrich standard SimEvents when P1D blessings are active
  const activeSim =
    sim ?? (scene && typeof scene === 'object' ? (scene as { sim?: WorldSim }).sim : undefined);
  if (!activeSim) return false;

  if (ev.kind === 'explosion') {
    const ex = ev as Extract<SimEvent, { kind: 'explosion' }>;
    const explosionKindMap: Readonly<Record<string, { kind: P1DBlessingVfxKind; color: number; ttl: number }>> = {
      bullet_ricochet_boom: { kind: 'bullet_ricochet_boom', color: 0xf97316, ttl: 0.3 },
      ranger_arrow_volley: { kind: 'ranger_arrow_wall_blast', color: 0x10b981, ttl: 0.32 },
      tesla_turret_self_destruct: { kind: 'table_tech_rocket_launch', color: 0xef4444, ttl: 0.38 },
    };
    const mapped = explosionKindMap[ex.sourceDefId];
    if (mapped) {
      pushP1DShape(scene, {
        kind: mapped.kind,
        x: ex.x,
        y: ex.y,
        radius: ex.radius,
        color: mapped.color,
        ttlSec: mapped.ttl,
        maxTtlSec: mapped.ttl,
      });
    }
  } else if (ev.kind === 'cover_flipped') {
    const cf = ev as Extract<SimEvent, { kind: 'cover_flipped' }>;
    const pl = activeSim.getPlayerById(cf.playerId);
    if (pl?.blessingIds.includes('table_tech_blank_nova')) {
      const blastR = Math.max(160, cf.radius);
      pushP1DShape(scene, {
        kind: 'table_tech_blank_nova',
        x: cf.x,
        y: cf.y,
        radius: blastR,
        color: 0x38bdf8,
        ttlSec: 0.38,
        maxTtlSec: 0.38,
      });
      dispatchP1DShaderFlipbook(scene, 'table_tech_blank_nova', cf.x, cf.y, blastR, 0);
    }
  } else if (ev.kind === 'perfect_reload' || ev.kind === 'tactical_vent') {
    const pr = ev as Extract<SimEvent, { kind: 'perfect_reload' | 'tactical_vent' }>;
    const pl = activeSim.getPlayerById(pr.playerId);
    if (pl?.blessingIds.includes('reload_frost_nova')) {
      pushP1DShape(scene, {
        kind: 'reload_frost_nova',
        x: pr.x,
        y: pr.y,
        radius: 110,
        color: 0x38bdf8,
        ttlSec: 0.35,
        maxTtlSec: 0.35,
      });
      dispatchP1DShaderFlipbook(scene, 'reload_frost_nova', pr.x, pr.y, 110, 0);
    }
    if (pl?.blessingIds.includes('reload_repulsor_shock')) {
      pushP1DShape(scene, {
        kind: 'reload_repulsor_shock',
        x: pr.x,
        y: pr.y,
        radius: 165,
        angle: pl.aimAngle,
        color: 0xf59e0b,
        ttlSec: 0.32,
        maxTtlSec: 0.32,
      });
      dispatchP1DShaderFlipbook(scene, 'reload_repulsor_shock', pr.x, pr.y, 165, pl.aimAngle);
    }
    if (allowStressSfx && 'camFocusX' in scene) {
      const gs = scene as GameScene;
      if (pl?.blessingIds.includes('reload_frost_nova')) {
        zzfx.play('elemental_reaction', pr.x, gs.camFocusX, pr.y, gs.camFocusY);
      }
    }
  } else if (ev.kind === 'buff_selected') {
    const bs = ev as Extract<SimEvent, { kind: 'buff_selected' }>;
    if ('fx' in scene && (scene as GameScene).fx) {
      const gs = scene as GameScene;
      gs.lighting?.spawnTransientLight(
        activeSim.player.x,
        activeSim.player.y,
        130,
        PALETTE.SOLAR_GOLD,
        0.9,
        0.28,
      );
      if (bs.buffId && allowStressSfx) {
        zzfx.play('skill_cast', activeSim.player.x, gs.camFocusX, activeSim.player.y, gs.camFocusY);
      }
    }
  }

  return false;
}

/**
 * Renders transient P1D blessing shapes inside `updateAndDrawWeaponV2Overlays` (1:1 hollow Chiaroscuro sigils).
 */
export function drawP1DTransientShape(
  g: Phaser.GameObjects.Graphics,
  s: TransientWeaponV2Shape,
  progress: number,
  alpha: number,
  groundG?: Phaser.GameObjects.Graphics,
): boolean {
  if (!(P1D_BLESSING_EVENT_KINDS as readonly string[]).includes(s.kind)) {
    return false;
  }
  const floorG = groundG ?? g;

  if (
    s.kind === 'dash_flame_shackle' ||
    s.kind === 'druid_poison_root_whip' ||
    s.kind === 'bullet_coop_arc_relay' ||
    s.kind === 'vanguard_shield_charge'
  ) {
    const x2 = s.x2 ?? s.x + Math.cos(s.angle ?? 0) * s.radius;
    const y2 = s.y2 ?? s.y + Math.sin(s.angle ?? 0) * s.radius;
    g.lineStyle(5.2, 0x141019, alpha * 0.72);
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(x2, y2);
    g.strokePath();
    g.lineStyle(2.8, s.color, alpha * 0.94);
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(x2, y2);
    g.strokePath();
    floorG.lineStyle(2.2, s.color, alpha * 0.88);
    floorG.strokeCircle(x2, y2, 10 + progress * 12);
    return true;
  }

  if (s.kind === 'reload_repulsor_shock' || s.kind === 'table_tech_prism_split') {
    const ang = s.angle ?? 0;
    const r = s.radius * (0.38 + progress * 0.62);
    g.lineStyle(5.4, 0x141019, alpha * 0.75);
    g.beginPath();
    g.arc(s.x, s.y, r, ang - 1.1, ang + 1.1, false);
    g.strokePath();
    g.lineStyle(3.0, s.color, alpha * 0.94);
    g.beginPath();
    g.arc(s.x, s.y, r, ang - 1.1, ang + 1.1, false);
    g.strokePath();
    g.lineStyle(1.4, 0xfffdf5, alpha * 0.95);
    g.beginPath();
    g.arc(s.x, s.y, r - 2, ang - 0.88, ang + 0.88, false);
    g.strokePath();
    return true;
  }

  const r = Math.max(8, s.radius * (0.38 + progress * 0.62));
  floorG.fillStyle(s.color, alpha * 0.05);
  floorG.fillCircle(s.x, s.y, r);
  floorG.lineStyle(4.2, 0x141019, alpha * 0.7);
  floorG.strokeCircle(s.x, s.y, r);
  floorG.lineStyle(2.4, s.color, alpha * 0.92);
  floorG.strokeCircle(s.x, s.y, r);
  return true;
}
