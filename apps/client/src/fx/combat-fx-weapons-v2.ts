import {
  RIVET_WEB_MAX_LINK_DIST,
  clamp,
  type SimEnemyState,
  type SimMagneticRivetState,
  type SimPlayerState,
  type SimProjectileState,
  type SimSummonState,
  type SimTetherBeamState,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import type { SfxId } from '../audio/zzfx.js';
import {
  type MicroBarFeedbackKind,
  resolveMicroBarFeedbackSpec,
} from '../scenes/game-scene/hud-micro-reload-bar.js';
import type { CombatFxManager } from './combat-fx.js';
import {
  type Batch1WeaponVfxKind,
  drawBatch1ActiveProjectiles,
  drawBatch1TransientShape,
} from './combat-fx-weapons-p1a.js';
import {
  type Batch2WeaponVfxKind,
  drawBatch2ActiveWeaponOverlays,
  drawBatch2TransientShape,
} from './combat-fx-weapons-p1b.js';

export * from './combat-fx-weapons-p1a.js';
export * from './combat-fx-weapons-p1b.js';

export interface MagneticRivetPoint {
  id: number;
  x: number;
  y: number;
  ownerPlayerId?: number;
  ownerId?: number;
  attachedEnemyId?: number | null;
  attachedPropId?: number | null;
  ttlSec?: number;
}

export interface MagneticRivetArcLink {
  from: MagneticRivetPoint;
  to: MagneticRivetPoint;
  dist: number;
}

export function buildMagneticRivetArcLinks(
  rivets: ReadonlyArray<MagneticRivetPoint>,
  maxDist = RIVET_WEB_MAX_LINK_DIST,
): MagneticRivetArcLink[] {
  const links: MagneticRivetArcLink[] = [];
  for (let i = 0; i < rivets.length; i += 1) {
    const a = rivets[i]!;
    const ownerA = a.ownerPlayerId ?? a.ownerId ?? 0;
    for (let j = i + 1; j < rivets.length; j += 1) {
      const b = rivets[j]!;
      const ownerB = b.ownerPlayerId ?? b.ownerId ?? 0;
      if (ownerA !== 0 && ownerB !== 0 && ownerA !== ownerB) continue;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (dist > 0.001 && dist <= maxDist) {
        links.push({ from: a, to: b, dist });
      }
    }
  }
  return links;
}

export type TacticalEventVfxKind =
  | 'cover_flipped'
  | 'prop_flipped'
  | 'prop_kicked'
  | 'wall_slam'
  | 'ring_out'
  | 'chasm_ring_out'
  | 'perfect_reload'
  | 'tactical_vent'
  | 'parry_deflect'
  | 'tri_elemental_beam';

export interface TacticalEventVfxSpec {
  kind: string;
  radius: number;
  ringColor: number;
  sfxId: SfxId;
  floatingText: string | null;
  textColor: string;
}

export function resolveTacticalEventVfxSpec(
  kind: TacticalEventVfxKind,
  locale: 'vi' | 'en' = 'vi',
): TacticalEventVfxSpec {
  const isEn = locale === 'en';
  switch (kind) {
    case 'cover_flipped':
    case 'prop_flipped':
      return {
        kind: 'cover_flipped',
        radius: 56,
        ringColor: 0xffffff,
        sfxId: 'flip_cover',
        floatingText: null,
        textColor: '#FFFDF5',
      };
    case 'prop_kicked':
      return {
        kind: 'prop_kicked',
        radius: 32,
        ringColor: 0xd6d3d1,
        sfxId: 'swing_heavy',
        floatingText: null,
        textColor: '#E5E7EB',
      };
    case 'wall_slam':
      return {
        kind: 'wall_slam',
        radius: 44,
        ringColor: 0xf97316,
        sfxId: 'wall_slam',
        floatingText: isEn ? 'WALL SLAM!' : 'ĐẬP TƯỜNG!',
        textColor: '#F97316',
      };
    case 'ring_out':
    case 'chasm_ring_out':
      return {
        kind: 'ring_out',
        radius: 48,
        ringColor: 0x38bdf8,
        sfxId: 'explosion',
        floatingText: 'RING-OUT!',
        textColor: '#FACC15',
      };
    case 'perfect_reload':
      return {
        kind: 'perfect_reload',
        radius: 36,
        ringColor: 0xfacc15,
        sfxId: 'perfect_reload',
        floatingText: isEn ? 'PERFECT!' : 'HOÀN HẢO!',
        textColor: '#FACC15',
      };
    case 'tactical_vent':
      return {
        kind: 'tactical_vent',
        radius: 56,
        ringColor: 0x38bdf8,
        sfxId: 'tactical_vent',
        floatingText: isEn ? 'VENTED!' : 'XẢ ÁP!',
        textColor: '#38BDF8',
      };
    case 'parry_deflect':
      return {
        kind: 'parry_deflect',
        radius: 44,
        ringColor: 0xffffff,
        sfxId: 'bullet_deflect',
        floatingText: 'PARRY!',
        textColor: '#FEF08A',
      };
    case 'tri_elemental_beam':
      return {
        kind: 'tri_elemental_beam',
        radius: 72,
        ringColor: 0xfacc15,
        sfxId: 'elemental_reaction',
        floatingText: null,
        textColor: '#FACC15',
      };
  }
}

export interface TransientWeaponV2Shape {
  kind:
    | 'rivet_arc'
    | 'tri_beam'
    | 'micro_blank'
    | 'vent_pulse'
    | 'parry_flash'
    | 'wall_cracks'
    | 'ring_out_vortex'
    | 'totem_lane'
    | Batch1WeaponVfxKind
    | Batch2WeaponVfxKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius: number;
  angle?: number;
  count?: number;
  isFinale?: boolean;
  isAirburst?: boolean;
  color: number;
  ttlSec: number;
  maxTtlSec: number;
}

export interface WeaponV2OverlayState {
  shapes: TransientWeaponV2Shape[];
  lastRivetSnapshot: MagneticRivetPoint[];
  lastTetherSnapshot: SimTetherBeamState[];
  syncedSim?: WorldSim;
  syncedEnemies: ReadonlyArray<SimEnemyState>;
  syncedProjectiles: ReadonlyArray<SimProjectileState>;
  syncedSummons: ReadonlyArray<SimSummonState>;
  syncedTetherBeams: ReadonlyArray<SimTetherBeamState>;
  microBarFlashColor: number | null;
  microBarFlashTimerSec: number;
  microBarFlashDurationSec: number;
  wasReloadLockedOut: boolean;
}

const overlayStateByScene = new WeakMap<object, WeaponV2OverlayState>();

export function getWeaponV2OverlayState(sceneKey: object): WeaponV2OverlayState {
  let state = overlayStateByScene.get(sceneKey);
  if (!state) {
    state = {
      shapes: [],
      lastRivetSnapshot: [],
      lastTetherSnapshot: [],
      syncedEnemies: [],
      syncedProjectiles: [],
      syncedSummons: [],
      syncedTetherBeams: [],
      microBarFlashColor: null,
      microBarFlashTimerSec: 0,
      microBarFlashDurationSec: 0.28,
      wasReloadLockedOut: false,
    };
    overlayStateByScene.set(sceneKey, state);
  }
  return state;
}

function pushShape(state: WeaponV2OverlayState, shape: TransientWeaponV2Shape): void {
  if (state.shapes.length >= 48) {
    state.shapes.shift();
  }
  state.shapes.push(shape);
}

export function triggerMicroBarFeedbackOnScene(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  kind: MicroBarFeedbackKind,
  x: number,
  y: number,
  locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const spec = resolveMicroBarFeedbackSpec(kind, locale);
  state.microBarFlashColor = spec.flashColor;
  state.microBarFlashDurationSec = spec.durationSec;
  state.microBarFlashTimerSec = spec.durationSec;
  fx?.spawnFloatingAlert(x, y - 6, spec.text, spec.textColor);
}

export function spawnCoverFlipMicroBlankVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  radius = 56,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushShape(state, {
    kind: 'micro_blank',
    x,
    y,
    radius,
    color: 0xffffff,
    ttlSec: 0.24,
    maxTtlSec: 0.24,
  });
  fx?.spawnHitSparks(x, y, 0, { isCrit: true, count: 6 });
}

export function spawnPropDashKickVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  vx: number,
  vy: number,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const angle = Math.atan2(vy, vx);
  pushShape(state, {
    kind: 'parry_flash',
    x,
    y,
    radius: 26,
    angle,
    color: 0xe5e7eb,
    ttlSec: 0.18,
    maxTtlSec: 0.18,
  });
  fx?.spawnDashDust(x, y);
  fx?.spawnHitSparks(x, y, angle, { count: 5 });
}

export function spawnWallSlamVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const spec = resolveTacticalEventVfxSpec('wall_slam', locale);
  pushShape(state, {
    kind: 'wall_cracks',
    x,
    y,
    radius: spec.radius,
    color: spec.ringColor,
    ttlSec: 0.42,
    maxTtlSec: 0.42,
  });
  fx?.spawnHitSparks(x, y, 0, { isCrit: true, element: 'burn', count: 7 });
  if (spec.floatingText) {
    fx?.spawnFloatingAlert(x, y - 4, spec.floatingText, spec.textColor);
  }
}

export function spawnChasmRingOutVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const spec = resolveTacticalEventVfxSpec('ring_out', locale);
  pushShape(state, {
    kind: 'ring_out_vortex',
    x,
    y,
    radius: spec.radius,
    color: spec.ringColor,
    ttlSec: 0.38,
    maxTtlSec: 0.38,
  });
  fx?.spawnHitSparks(x, y, 0, { isCrit: true, element: 'chill', count: 6 });
  if (spec.floatingText) {
    fx?.spawnFloatingAlert(x, y - 6, spec.floatingText, spec.textColor);
  }
}

export function spawnTacticalVentVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  locale: 'vi' | 'en' = 'vi',
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushShape(state, {
    kind: 'vent_pulse',
    x,
    y,
    radius: 56,
    color: 0x38bdf8,
    ttlSec: 0.26,
    maxTtlSec: 0.26,
  });
  fx?.spawnHitSparks(x, y, 0, { element: 'chill', count: 6 });
  triggerMicroBarFeedbackOnScene(sceneKey, fx, 'tactical_vent', x, y, locale);
}

export function spawnTriElementalBeamVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  radius = 72,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushShape(state, {
    kind: 'tri_beam',
    x: fromX,
    y: fromY,
    x2: toX,
    y2: toY,
    radius,
    color: 0xfacc15,
    ttlSec: 0.3,
    maxTtlSec: 0.3,
  });
  fx?.spawnChainLightningArc(fromX, fromY, toX, toY);
}

export function spawnRivetDetonationWebVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  rivetsArg?: ReadonlyArray<MagneticRivetPoint>,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  const rivets =
    rivetsArg && rivetsArg.length > 0 ? rivetsArg : state.lastRivetSnapshot;
  for (const r of rivets) {
    fx?.spawnHitSparks(r.x, r.y, 0, { isCrit: true, element: 'shock', count: 5 });
  }
  const links = buildMagneticRivetArcLinks(rivets, RIVET_WEB_MAX_LINK_DIST);
  for (const link of links) {
    pushShape(state, {
      kind: 'rivet_arc',
      x: link.from.x,
      y: link.from.y,
      x2: link.to.x,
      y2: link.to.y,
      radius: 18,
      color: 0x38bdf8,
      ttlSec: 0.28,
      maxTtlSec: 0.28,
    });
    fx?.spawnChainLightningArc(link.from.x, link.from.y, link.to.x, link.to.y);
  }
}

export function spawnKnightSwordParryDeflectVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  angle: number,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushShape(state, {
    kind: 'parry_flash',
    x,
    y,
    radius: 44,
    angle,
    color: 0xffffff,
    ttlSec: 0.22,
    maxTtlSec: 0.22,
  });
  fx?.spawnHitSparks(x, y, angle, { isCrit: true, blockedByShield: true, count: 6 });
}

export function spawnTotemCollapseLaneVfx(
  sceneKey: object,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  fallAngle = 0,
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  pushShape(state, {
    kind: 'totem_lane',
    x,
    y,
    radius: 160,
    angle: fallAngle,
    color: 0x84cc16,
    ttlSec: 0.45,
    maxTtlSec: 0.45,
  });
  fx?.spawnPropBreakBurst(
    'rotten_totem_pillar',
    x + Math.cos(fallAngle) * 72,
    y + Math.sin(fallAngle) * 72,
  );
}

export function updateAndDrawWeaponV2Overlays(
  sceneKey: object,
  g: Phaser.GameObjects.Graphics,
  fx: CombatFxManager | undefined,
  player: SimPlayerState,
  rivets: ReadonlyArray<SimMagneticRivetState>,
  dtSec: number,
  clockSec: number,
  locale: 'vi' | 'en' = 'vi',
): { flashColor: number | null; flashAlpha: number } {
  const state = getWeaponV2OverlayState(sceneKey);

  // Detect reload misfire transition (reloadLockout false -> true)
  const lockedNow = Boolean(player.reloadLockout);
  if (lockedNow && !state.wasReloadLockedOut && player.reloadTimer > 0) {
    triggerMicroBarFeedbackOnScene(sceneKey, fx, 'reload_misfire', player.x, player.y, locale);
  }
  state.wasReloadLockedOut = lockedNow;

  if (state.microBarFlashTimerSec > 0) {
    state.microBarFlashTimerSec = Math.max(0, state.microBarFlashTimerSec - dtSec);
  }

  if (rivets.length > 0) {
    state.lastRivetSnapshot = rivets.map((r) => ({
      id: r.id,
      x: r.x,
      y: r.y,
      ownerPlayerId: r.ownerPlayerId,
      attachedEnemyId: r.attachedEnemyId,
      attachedPropId: r.attachedPropId,
      ttlSec: r.ttlSec,
    }));
  }

  // 1. Draw embedded magnetic rivets & live web links
  if (rivets.length > 0) {
    const links = buildMagneticRivetArcLinks(rivets, RIVET_WEB_MAX_LINK_DIST);
    for (const link of links) {
      g.lineStyle(1.4, 0x38bdf8, 0.35 + Math.sin(clockSec * 14) * 0.12);
      g.beginPath();
      g.moveTo(link.from.x, link.from.y);
      g.lineTo(link.to.x, link.to.y);
      g.strokePath();
    }
    for (const r of rivets) {
      const pulseR = 6 + Math.sin(clockSec * 12 + r.id) * 1.8;
      g.lineStyle(1.4, 0x38bdf8, 0.72);
      g.strokeCircle(r.x, r.y, pulseR);
      g.fillStyle(0x141019, 0.95);
      g.fillCircle(r.x, r.y, 4.2);
      g.fillStyle(0xfacc15, 0.98);
      g.fillCircle(r.x, r.y, 2.6);
    }
  }

  // 1b. Draw active Batch-1 projectile procedural overlays & Gale SMG spin-up wind ribbons
  drawBatch1ActiveProjectiles(g, state.syncedProjectiles, player, clockSec);
  drawBatch2ActiveWeaponOverlays(g, state.syncedSim, player, clockSec);

  // 2. Update & draw transient weapon v2 / tactical shapes
  for (let i = state.shapes.length - 1; i >= 0; i -= 1) {
    const s = state.shapes[i]!;
    s.ttlSec -= dtSec;
    if (s.ttlSec <= 0) {
      state.shapes.splice(i, 1);
      continue;
    }
    const progress = clamp(1 - s.ttlSec / Math.max(0.01, s.maxTtlSec), 0, 1);
    const alpha = clamp(1 - progress, 0.05, 1);

    if (drawBatch1TransientShape(g, s, progress, alpha, clockSec, i)) {
      continue;
    }
    if (drawBatch2TransientShape(g, s, progress, alpha, clockSec, i)) {
      continue;
    }

    if (s.kind === 'rivet_arc' && s.x2 !== undefined && s.y2 !== undefined) {
      const midX = (s.x + s.x2) * 0.5 + Math.sin(clockSec * 40 + i) * 7;
      const midY = (s.y + s.y2) * 0.5 + Math.cos(clockSec * 40 + i) * 7;
      g.lineStyle(3.2, 0x38bdf8, alpha * 0.85);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(midX, midY);
      g.lineTo(s.x2, s.y2);
      g.strokePath();
      g.lineStyle(1.4, 0xfef08a, alpha);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(midX, midY);
      g.lineTo(s.x2, s.y2);
      g.strokePath();
    } else if (s.kind === 'tri_beam' && s.x2 !== undefined && s.y2 !== undefined) {
      g.lineStyle(7 * alpha, 0xf97316, alpha * 0.55);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x2, s.y2);
      g.strokePath();
      g.lineStyle(4 * alpha, 0x38bdf8, alpha * 0.8);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x2, s.y2);
      g.strokePath();
      g.lineStyle(2, 0xfacc15, alpha);
      g.strokeCircle(s.x2, s.y2, s.radius * (0.45 + progress * 0.55));
    } else if (s.kind === 'micro_blank' || s.kind === 'vent_pulse') {
      const r = s.radius * (0.35 + progress * 0.65);
      g.lineStyle(s.kind === 'micro_blank' ? 3.0 : 2.6, s.color, alpha * 0.9);
      g.strokeCircle(s.x, s.y, r);
    } else if (s.kind === 'parry_flash') {
      const ang = s.angle ?? 0;
      g.lineStyle(3.4, s.color, alpha * 0.92);
      g.beginPath();
      g.arc(s.x, s.y, s.radius * (0.6 + progress * 0.4), ang - 0.85, ang + 0.85, false);
      g.strokePath();
    } else if (s.kind === 'wall_cracks') {
      g.lineStyle(2.0, 0x141019, alpha * 0.9);
      for (let k = 0; k < 5; k += 1) {
        const a = (k * Math.PI * 2) / 5 + 0.3;
        const len = s.radius * (0.5 + (k % 2) * 0.35);
        g.beginPath();
        g.moveTo(s.x, s.y);
        g.lineTo(s.x + Math.cos(a) * len, s.y + Math.sin(a) * len);
        g.strokePath();
      }
    } else if (s.kind === 'ring_out_vortex') {
      const r = Math.max(4, s.radius * (1 - progress * 0.75));
      g.lineStyle(2.4, 0x38bdf8, alpha * 0.85);
      g.strokeCircle(s.x, s.y, r);
      g.fillStyle(0x09070d, alpha * 0.75);
      g.fillCircle(s.x, s.y, r * 0.55);
    } else if (s.kind === 'totem_lane') {
      const ang = s.angle ?? 0;
      const endX = s.x + Math.cos(ang) * 160;
      const endY = s.y + Math.sin(ang) * 160;
      g.lineStyle(56 * (1 - progress * 0.35), 0x4d382b, alpha * 0.38);
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(endX, endY);
      g.strokePath();
    }
  }

  const flashAlpha =
    state.microBarFlashTimerSec > 0 && state.microBarFlashDurationSec > 0
      ? clamp(state.microBarFlashTimerSec / state.microBarFlashDurationSec, 0, 1)
      : 0;
  return {
    flashColor: flashAlpha > 0 ? state.microBarFlashColor : null,
    flashAlpha,
  };
}
