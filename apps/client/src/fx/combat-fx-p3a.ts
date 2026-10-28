import {
  SHAMAN_TOTEM_LINK_RADIUS,
  SIGHTLINE_TELEGRAPH_WINDOW_SEC,
  clamp,
  distance,
  raycastSightlineDistance,
  type SimEnemyState,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { PALETTE, hexToNum } from '../art/palette.js';
import type { GameScene } from '../scenes/GameScene.js';

export const SIGHTLINE_OUTER_COLOR = 0xff5722; // #FF5722 Deep Red-Orange
export const SIGHTLINE_CORE_COLOR = 0xfff7ed; // #FFF7ED Bright Core
export const SIGHTLINE_RETICLE_ACCENT = 0xffcc80; // #FFCC80 Warm Amber Lock Reticle

const RANGED_SIGHTLINE_ENEMY_DEF_IDS = new Set<string>([
  'goblin_shooter',
  'goblin_shaman',
  'frost_bat',
  'ice_mage',
  'ice_golem',
  'kryssa_clone',
  'fire_imp',
  'welder_drone',
  'iron_shielder',
  'spore_king',
  'kryssa_ice_queen',
  'forge_titan',
]);

export interface PredictiveSightlineVisualSpec {
  enemyId: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  angle: number;
  distancePx: number;
  outerWidthPx: number;
  outerColor: number;
  outerAlpha: number;
  coreWidthPx: number;
  coreColor: number;
  coreAlpha: number;
  reticleRadiusPx: number;
}

export function isEnemySightlineTelegraphActive(e: SimEnemyState): boolean {
  if (e.hp <= 0 || e.bossBurrowed || e.aiState !== 'telegraph') {
    return false;
  }
  if (e.leadSightlineActive) {
    return true;
  }
  if (e.stateTimer <= 0 || e.stateTimer > SIGHTLINE_TELEGRAPH_WINDOW_SEC) {
    return false;
  }
  return RANGED_SIGHTLINE_ENEMY_DEF_IDS.has(e.defId);
}

export function computePredictiveSightlineSpec(
  sim: WorldSim,
  e: SimEnemyState,
  originX = e.x,
  originY = e.y,
): PredictiveSightlineVisualSpec | null {
  if (!isEnemySightlineTelegraphActive(e)) {
    return null;
  }
  const angle = e.leadSightlineAngle ?? e.telegraphAngle;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const maxDist = e.telegraphLength || (e.isBoss ? 360 : 320);
  const hitDist = raycastSightlineDistance(sim, originX, originY, angle, maxDist);
  const muzzleOffset = e.radius + 4;
  const endDist = Math.max(muzzleOffset + 8, hitDist);
  const lockProgress =
    1 - clamp(e.stateTimer / SIGHTLINE_TELEGRAPH_WINDOW_SEC, 0, 1);
  const outerAlpha = clamp(0.42 + 0.33 * lockProgress, 0.42, 0.75);

  return {
    enemyId: e.id,
    startX: originX + cos * muzzleOffset,
    startY: originY + sin * muzzleOffset,
    endX: originX + cos * endDist,
    endY: originY + sin * endDist,
    angle,
    distancePx: endDist - muzzleOffset,
    outerWidthPx: 4.5,
    outerColor: SIGHTLINE_OUTER_COLOR,
    outerAlpha,
    coreWidthPx: 1.8,
    coreColor: SIGHTLINE_CORE_COLOR,
    coreAlpha: 0.92,
    reticleRadiusPx: e.isBoss ? 6.5 : e.isElite ? 5.5 : 4.5,
  };
}

/**
 * Renders Phase 3A (P3A.1) 0.35s Predictive Sightline Telegraphs:
 * - Outer 4.5px #FF5722 red-orange sightline (alpha 0.42..0.75), clipped against walls and flipped cover
 * - Inner 1.8px #FFF7ED bright core (alpha 0.92)
 * - Muzzle lock diamond reticle + terminal lock dot
 */
export function drawP3APredictiveSightlinesAndOverlays(
  scene: GameScene,
  g: Phaser.GameObjects.Graphics,
  sim: WorldSim,
): void {
  const isStress = sim.stressTestActive;
  let sightlinesDrawn = 0;

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (!isEnemySightlineTelegraphActive(e)) continue;
    if (isStress && sightlinesDrawn >= 4) break;

    const pos = scene.transport
      ? scene.transport.getInterpolatedEnemyPos(e, scene.entityPosScratch)
      : e;
    const spec = computePredictiveSightlineSpec(sim, e, pos.x, pos.y);
    if (!spec) continue;
    sightlinesDrawn += 1;

    // 1. Outer 4.5px #FF5722 sightline beam
    g.lineStyle(spec.outerWidthPx, spec.outerColor, spec.outerAlpha);
    g.beginPath();
    g.moveTo(spec.startX, spec.startY);
    g.lineTo(spec.endX, spec.endY);
    g.strokePath();

    // 2. Inner 1.8px #FFF7ED bright core beam
    g.lineStyle(spec.coreWidthPx, spec.coreColor, spec.coreAlpha);
    g.beginPath();
    g.moveTo(spec.startX, spec.startY);
    g.lineTo(spec.endX, spec.endY);
    g.strokePath();

    // 3. Muzzle Lock Diamond Reticle
    const cos = Math.cos(spec.angle);
    const sin = Math.sin(spec.angle);
    const perpX = -sin;
    const perpY = cos;
    const r = spec.reticleRadiusPx;

    const tipX = spec.startX + cos * (r * 1.35);
    const tipY = spec.startY + sin * (r * 1.35);
    const backX = spec.startX - cos * (r * 0.85);
    const backY = spec.startY - sin * (r * 0.85);
    const leftX = spec.startX + perpX * r;
    const leftY = spec.startY + perpY * r;
    const rightX = spec.startX - perpX * r;
    const rightY = spec.startY - perpY * r;

    g.fillStyle(SIGHTLINE_RETICLE_ACCENT, 0.92);
    g.beginPath();
    g.moveTo(tipX, tipY);
    g.lineTo(leftX, leftY);
    g.lineTo(backX, backY);
    g.lineTo(rightX, rightY);
    g.closePath();
    g.fillPath();

    g.lineStyle(1.8, spec.outerColor, 0.96);
    g.strokePath();

    g.fillStyle(hexToNum(PALETTE.BONE_WHITE), 0.95);
    g.fillCircle(spec.startX, spec.startY, 1.8);

    // 4. Terminal sightline impact dot (shows where wall / flipped cover blocks the shot)
    g.fillStyle(spec.outerColor, 0.88);
    g.fillCircle(spec.endX, spec.endY, 3.2);
    g.fillStyle(spec.coreColor, 0.95);
    g.fillCircle(spec.endX, spec.endY, 1.5);
  }

  // 5. Biome 1 Goblin Shaman Ward Totem (`shaman_totem`) emerald link tether beams to allies within 220px
  if (!isStress && sim.props.length > 0) {
    const outerBeamColor = hexToNum(PALETTE.GOBLIN_GREEN);
    const coreBeamColor = hexToNum(PALETTE.LIME_GLOW);
    for (let pIdx = 0; pIdx < sim.props.length; pIdx++) {
      const prop = sim.props[pIdx]!;
      if (prop.kind !== 'shaman_totem' || prop.hp <= 0 || prop.state === 'broken') continue;
      for (let eIdx = 0; eIdx < sim.enemies.length; eIdx++) {
        const e = sim.enemies[eIdx]!;
        if (e.hp <= 0 || e.isBoss || e.isDummy) continue;
        if (distance(prop.x, prop.y, e.x, e.y) <= SHAMAN_TOTEM_LINK_RADIUS + e.radius) {
          g.lineStyle(3.2, outerBeamColor, 0.55);
          g.beginPath();
          g.moveTo(prop.x, prop.y);
          g.lineTo(e.x, e.y);
          g.strokePath();

          g.lineStyle(1.4, coreBeamColor, 0.88);
          g.beginPath();
          g.moveTo(prop.x, prop.y);
          g.lineTo(e.x, e.y);
          g.strokePath();
        }
      }
    }
  }
}
