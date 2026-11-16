import {
  CAUSTIC_POD_BLAST_RADIUS,
  CLUSTER_MORTAR_BLAST_RADIUS,
  THUNDER_DECOY_BLAST_RADIUS,
  WALL_TETHER_WIRE_HALF_WIDTH,
  clamp,
  distance,
  type SimEvent,
  type SimPlayerState,
  type SimProjectileState,
  type SimSummonState,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { PALETTE, hexToNum } from '../art/palette.js';
import { getFreezeVisualTimeSec, getVisualQueryConfig } from '../core/visual-query.js';
import { isVisualFreezeActive } from './combat-fx-blessings-p1d.js';
import {
  fillTaperedArcRibbon,
  fillTaperedLightningBolt,
  fillTaperedQuadraticBezier,
} from './tapered-ribbon-builder.js';
import { routeCutoutBurstByRadius } from './combat-fx-spawners.js';

type Gfx = Phaser.GameObjects.Graphics;

const firstPylonByOwnerScratch = new Map<number, SimSummonState>();

function resolveUnderActorGfx(scene: unknown, fallback: Gfx): Gfx {
  if (
    scene &&
    typeof scene === 'object' &&
    'underActorGraphics' in scene &&
    (scene as { underActorGraphics?: Gfx }).underActorGraphics
  ) {
    return (scene as { underActorGraphics: Gfx }).underActorGraphics!;
  }
  return fallback;
}

const COL_INK = hexToNum(PALETTE.INK_DARK);
const COL_BONE = 0xfffdf5;
const COL_SLATE = hexToNum(PALETTE.SLATE_DARK);
const COL_VIOLET = hexToNum(PALETTE.ELECTRIC_VIOLET);
const COL_SOLAR_GOLD = hexToNum(PALETTE.SOLAR_GOLD);
const COL_VOLT_YELLOW = 0xfacc15;
const COL_CYAN_BOLT = 0x38bdf8;
const COL_HOLO_ICE = 0xe0f2fe;
const COL_HOLO_DEEP = 0x0284c7;
const COL_EMERALD = 0x10b981;
const COL_JADE_LIGHT = 0x34d399;
const COL_LIME_ACID = 0x84cc16;
const COL_LIME_BRIGHT = 0xbef264;
const COL_MORTAR_ORANGE = 0xf97316;

const SCRATCH_DECOY_BOLT_PTS: [[number, number], [number, number], [number, number], [number, number]] = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
];
const SCRATCH_DECOY_ARC_PTS: [[number, number], [number, number], [number, number]] = [
  [0, 0],
  [0, 0],
  [0, 0],
];

const SCRATCH_ORBIT_CHEVRON_PTS: [[number, number], [number, number], [number, number]] = [
  [0, 0],
  [0, 0],
  [0, 0],
];

function resolveFloorGfx(scene: unknown, fallbackG: Gfx): Gfx {
  if (scene && typeof scene === 'object' && 'groundHazardGraphics' in scene) {
    const gg = (scene as { groundHazardGraphics?: Gfx }).groundHazardGraphics;
    if (gg) return gg;
  }
  return fallbackG;
}

export function resolveP4AVisualTimeSec(scene: unknown, sim: WorldSim): number {
  const simTimeSec = sim.tick / 60;
  if (isVisualFreezeActive(scene) || getVisualQueryConfig().freeze) {
    return getFreezeVisualTimeSec(simTimeSec, true);
  }
  return simTimeSec;
}

function fillDisc(g: Gfx, x: number, y: number, r: number, col: number, alpha: number): void {
  g.fillStyle(col, alpha);
  g.fillCircle(x, y, r);
}

function strokeArc(g: Gfx, x: number, y: number, r: number, a0: number, a1: number, width: number, col: number, alpha: number): void {
  g.lineStyle(width, col, alpha);
  g.beginPath();
  g.arc(x, y, r, a0, a1, false);
  g.strokePath();
}

function strokePolyline(g: Gfx, width: number, col: number, alpha: number, pts: readonly [number, number][]): void {
  if (pts.length < 2) return;
  g.lineStyle(width, col, alpha);
  g.beginPath();
  g.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]![0], pts[i]![1]);
  g.strokePath();
}

function strokeLine(g: Gfx, x0: number, y0: number, x1: number, y1: number, width: number, col: number, alpha: number): void {
  g.lineStyle(width, col, alpha);
  g.lineBetween(x0, y0, x1, y1);
}

function pointToSegmentProjection(px: number, py: number, x1: number, y1: number, x2: number, y2: number): { dist: number; cx: number; cy: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-8) return { dist: distance(px, py, x1, y1), cx: x1, cy: y1 };
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return { dist: distance(px, py, cx, cy), cx, cy };
}

function resolveSummonOwner(sim: WorldSim, ownerPlayerId: number): SimPlayerState {
  if (ownerPlayerId === sim.player.id) return sim.player;
  return sim.getPlayerById(ownerPlayerId) ?? sim.player;
}

function resolveHoloDecoyAimAngle(sim: WorldSim, sum: SimSummonState): number {
  const owner = resolveSummonOwner(sim, sum.ownerPlayerId);
  let aimAngle = owner.aimAngle;
  if (owner.lifeState === 'alive') {
    if (
      typeof owner.aimWorldX === 'number' &&
      typeof owner.aimWorldY === 'number' &&
      Number.isFinite(owner.aimWorldX) &&
      Number.isFinite(owner.aimWorldY) &&
      distance(sum.x, sum.y, owner.aimWorldX, owner.aimWorldY) > 12
    ) {
      aimAngle = Math.atan2(owner.aimWorldY - sum.y, owner.aimWorldX - sum.x);
    }
    return aimAngle;
  }
  let bestDist = Infinity;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed || e.defId === 'ashen_executioner') continue;
    const d = distance(sum.x, sum.y, e.x, e.y);
    if (d <= sum.auraRadius && d < bestDist) {
      bestDist = d;
      aimAngle = Math.atan2(e.y - sum.y, e.x - sum.x);
    }
  }
  return aimAngle;
}

function drawThunderDecoySummon(g: Gfx, floorG: Gfx, sum: SimSummonState, tSec: number, ttlRatio: number): void {
  const blastR = THUNDER_DECOY_BLAST_RADIUS;
  fillDisc(floorG, sum.x, sum.y, blastR, COL_VIOLET, 0.045);
  for (let k = 0; k < 4; k++) {
    const ang = (k * Math.PI) / 2 + tSec * 0.5;
    fillTaperedArcRibbon(floorG, sum.x, sum.y, blastR, ang - 0.28, ang + 0.28, 2.0, COL_VIOLET, 0.48, 3, 1.2);
  }

  for (let w = 0; w < 2; w++) {
    const waveProg = (tSec * 1.65 + w * 0.5) % 1;
    const wr = 19 + waveProg * 46;
    const wcol = w === 0 ? COL_SOLAR_GOLD : COL_VIOLET;
    for (let k = 0; k < 4; k++) {
      const ang = (k * Math.PI) / 2 + tSec * 1.2;
      fillTaperedArcRibbon(floorG, sum.x, sum.y, wr, ang - 0.24, ang + 0.24, 1.6, wcol, (1 - waveProg) * 0.36, 3, 1.0);
    }
  }

  fillDisc(g, sum.x, sum.y, 17, COL_INK, 0.96);
  fillDisc(g, sum.x, sum.y, 13.8, COL_VIOLET, 0.92);
  g.fillStyle(COL_INK, 0.94);
  g.fillTriangle(sum.x - 10, sum.y + 7, sum.x + 10, sum.y + 7, sum.x, sum.y - 14);
  g.fillStyle(COL_SOLAR_GOLD, 0.98);
  g.fillTriangle(sum.x - 7.5, sum.y + 5.5, sum.x + 7.5, sum.y + 5.5, sum.x, sum.y - 11.5);
  g.fillCircle(sum.x, sum.y - 1, 5.6);

  SCRATCH_DECOY_BOLT_PTS[0][0] = sum.x + 2;
  SCRATCH_DECOY_BOLT_PTS[0][1] = sum.y - 8;
  SCRATCH_DECOY_BOLT_PTS[1][0] = sum.x - 2.5;
  SCRATCH_DECOY_BOLT_PTS[1][1] = sum.y - 1;
  SCRATCH_DECOY_BOLT_PTS[2][0] = sum.x + 1.5;
  SCRATCH_DECOY_BOLT_PTS[2][1] = sum.y - 1;
  SCRATCH_DECOY_BOLT_PTS[3][0] = sum.x - 2;
  SCRATCH_DECOY_BOLT_PTS[3][1] = sum.y + 6.5;
  strokePolyline(g, 2.0, 0xfffdf5, 0.98, SCRATCH_DECOY_BOLT_PTS);

  for (let k = 0; k < 3; k++) {
    const baseAng = tSec * 5.4 + sum.id * 0.7 + (k * Math.PI * 2) / 3;
    const midAng = baseAng + 0.28 * (k % 2 === 0 ? 1 : -1);
    const tipAng = baseAng + 0.08;
    SCRATCH_DECOY_ARC_PTS[0][0] = sum.x + Math.cos(baseAng) * 12;
    SCRATCH_DECOY_ARC_PTS[0][1] = sum.y + Math.sin(baseAng) * 12;
    SCRATCH_DECOY_ARC_PTS[1][0] = sum.x + Math.cos(midAng) * 17.5;
    SCRATCH_DECOY_ARC_PTS[1][1] = sum.y + Math.sin(midAng) * 17.5;
    SCRATCH_DECOY_ARC_PTS[2][0] = sum.x + Math.cos(tipAng) * 22;
    SCRATCH_DECOY_ARC_PTS[2][1] = sum.y + Math.sin(tipAng) * 22;
    strokePolyline(g, 3.0, COL_INK, 0.85, SCRATCH_DECOY_ARC_PTS);
    strokePolyline(g, 1.6, k === 0 ? COL_SOLAR_GOLD : COL_CYAN_BOLT, 0.94, SCRATCH_DECOY_ARC_PTS);
  }

  for (let k = 0; k < 3; k++) {
    const ang = (k * Math.PI * 2) / 3 + tSec * 2.0;
    fillTaperedArcRibbon(g, sum.x, sum.y, 14.5, ang - 0.35, ang + 0.35, 2.4, COL_SOLAR_GOLD, 0.95, 3, 1.2);
  }
  strokeArc(g, sum.x, sum.y, 19.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ttlRatio, 2.6, COL_SOLAR_GOLD, 0.95);
}

function drawWallTetherPylonSummon(g: Gfx, sum: SimSummonState, tSec: number, ttlRatio: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(tSec * 9.0 + sum.id);
  fillDisc(g, sum.x, sum.y, 13.5, COL_INK, 0.96);
  fillDisc(g, sum.x, sum.y, 11.2, COL_SLATE, 0.96);

  g.fillStyle(COL_INK, 0.95);
  for (let b = 0; b < 4; b++) {
    const ang = Math.PI * 0.25 + (b * Math.PI) / 2;
    g.fillCircle(sum.x + Math.cos(ang) * 9.2, sum.y + Math.sin(ang) * 9.2, 1.5);
  }

  for (let k = 0; k < 4; k++) {
    const ang = (k * Math.PI) / 2;
    fillTaperedArcRibbon(g, sum.x, sum.y, 8.4, ang - 0.3, ang + 0.3, 2.0, COL_CYAN_BOLT, 0.9, 3, 1.2);
    fillTaperedArcRibbon(g, sum.x, sum.y, 15.2, ang - 0.25, ang + 0.25, 2.4, COL_INK, 0.85, 3, 1.2);
  }
  fillDisc(g, sum.x, sum.y, 5.2 + pulse * 0.6, COL_CYAN_BOLT, 0.94);
  fillDisc(g, sum.x, sum.y, 3.1 + pulse * 0.35, COL_SOLAR_GOLD, 0.98);
  fillDisc(g, sum.x - 1.1, sum.y - 1.1, 1.3, 0xffffff, 0.95);
  strokeArc(g, sum.x, sum.y, 15.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ttlRatio, 2.1, COL_CYAN_BOLT, 0.95);
}

function drawHoloDecoyTurretSummon(g: Gfx, sim: WorldSim, sum: SimSummonState, tSec: number, ttlRatio: number): void {
  const aimAng = resolveHoloDecoyAimAngle(sim, sum);
  const cos = Math.cos(aimAng);
  const sin = Math.sin(aimAng);

  // True 1:1 circular top-down holo emitter pedestal (zero 3/4 squash ellipse)
  fillDisc(g, sum.x, sum.y, 15.6, COL_INK, 0.94);
  fillDisc(g, sum.x, sum.y, 13.8, COL_SLATE, 0.92);

  fillDisc(g, sum.x, sum.y, 12.2, COL_HOLO_DEEP, 0.36);
  fillDisc(g, sum.x - cos * 1.5, sum.y - sin * 1.5, 8.4, COL_CYAN_BOLT, 0.45);

  const scanOffset = ((tSec * 20) % 5) - 2.5;
  for (let row = -1; row <= 1; row++) {
    const sy = sum.y + row * 4.2 + scanOffset * 0.45;
    const dy = Math.abs(sy - sum.y);
    const halfSpan = Math.sqrt(Math.max(4, 11.0 * 11.0 - dy * dy)) - 1.5;
    strokeLine(g, sum.x - halfSpan, sy, sum.x + halfSpan, sy, 1.3, row === 0 ? COL_HOLO_ICE : COL_CYAN_BOLT, 0.82);
  }

  for (let k = 0; k < 4; k++) {
    const ang = (k * Math.PI) / 2 + 0.35;
    fillTaperedArcRibbon(g, sum.x, sum.y, 12.8, ang - 0.32, ang + 0.32, 2.0, COL_CYAN_BOLT, 0.92, 3, 1.2);
  }

  const bx0 = sum.x + cos * 4;
  const by0 = sum.y + sin * 4;
  const bx1 = sum.x + cos * 19.5;
  const by1 = sum.y + sin * 19.5;
  strokeLine(g, bx0, by0, bx1, by1, 6.0, COL_INK, 0.96);
  strokeLine(g, bx0, by0, bx1, by1, 3.4, COL_CYAN_BOLT, 0.96);
  strokeLine(g, bx0 + cos * 2, by0 + sin * 2, bx1, by1, 1.5, COL_HOLO_ICE, 0.98);

  if (sum.tickTimer <= 0.06 || sum.tickTimer >= 0.39) {
    fillDisc(g, bx1 + cos * 2, by1 + sin * 2, 5.6, COL_CYAN_BOLT, 0.55);
    fillDisc(g, bx1 + cos * 2, by1 + sin * 2, 3.0, COL_HOLO_ICE, 0.96);
    strokeLine(g, bx1 + sin * 5.5, by1 - cos * 5.5, bx1 - sin * 5.5, by1 + cos * 5.5, 1.8, COL_HOLO_ICE, 0.92);
  }

  strokeArc(g, sum.x, sum.y, 16.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ttlRatio, 2.1, COL_CYAN_BOLT, 0.9);
}

export function drawP4ASummonOverlay(scene: unknown, g: Gfx, sim: WorldSim, sum: SimSummonState): boolean {
  if (sum.kind !== 'thunder_decoy' && sum.kind !== 'wall_tether_pylon' && sum.kind !== 'holo_decoy_turret') {
    return false;
  }
  const floorG = resolveFloorGfx(scene, g);
  const tSec = resolveP4AVisualTimeSec(scene, sim);
  const ttlRatio = clamp(sum.ttlSec / Math.max(0.1, sum.maxTtlSec), 0, 1);
  if (sum.kind === 'thunder_decoy') drawThunderDecoySummon(g, floorG, sum, tSec, ttlRatio);
  else if (sum.kind === 'wall_tether_pylon') drawWallTetherPylonSummon(g, sum, tSec, ttlRatio);
  else drawHoloDecoyTurretSummon(g, sim, sum, tSec, ttlRatio);
  return true;
}

function drawChiaroscuroDiamondStar(
  g: Gfx,
  cx: number,
  cy: number,
  outerR: number,
  rotRad: number,
  midCol: number,
): void {
  for (let axis = 0; axis < 2; axis++) {
    const a = rotRad + (axis * Math.PI) / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const r = axis === 0 ? outerR : outerR * 0.82;
    strokeLine(g, cx - ca * r, cy - sa * r, cx + ca * r, cy + sa * r, 4.8, COL_INK, 0.9);
    strokeLine(g, cx - ca * (r - 1.2), cy - sa * (r - 1.2), cx + ca * (r - 1.2), cy + sa * (r - 1.2), 2.6, midCol, 0.95);
    strokeLine(g, cx - ca * (r * 0.65), cy - sa * (r * 0.65), cx + ca * (r * 0.65), cy + sa * (r * 0.65), 1.3, COL_BONE, 0.98);
  }
  fillDisc(g, cx, cy, 3.6, COL_INK, 0.9);
  fillDisc(g, cx, cy, 2.3, midCol, 0.96);
  fillDisc(g, cx, cy, 1.2, COL_BONE, 1);
}

function drawElectricCutterWires(underG: Gfx, sim: WorldSim, tSec: number): void {
  firstPylonByOwnerScratch.clear();
  for (let i = 0; i < sim.summons.length; i++) {
    const s = sim.summons[i]!;
    if (s.hp <= 0 || s.ttlSec <= 0 || s.kind !== 'wall_tether_pylon') continue;
    const p1 = firstPylonByOwnerScratch.get(s.ownerPlayerId);
    if (!p1) {
      firstPylonByOwnerScratch.set(s.ownerPlayerId, s);
      continue;
    }

    const p2 = s;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 6) continue;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const segCount = Math.max(6, Math.min(16, Math.round(len / 20)));

    // 1. Main high-intensity lightning bolt (< 28° kink clamp, ink border + cyan/volt core) on underActorGraphics (depth 26.6)
    fillTaperedLightningBolt(
      underG,
      p1.x,
      p1.y,
      p2.x,
      p2.y,
      2.4,
      COL_CYAN_BOLT,
      0.96,
      p1.id * 17 + p2.id * 31 + Math.floor(tSec * 16),
      segCount,
      1.4,
    );
    fillTaperedLightningBolt(
      underG,
      p1.x,
      p1.y,
      p2.x,
      p2.y,
      1.5,
      COL_VOLT_YELLOW,
      0.92,
      p1.id * 23 + p2.id * 47 + Math.floor(tSec * 18),
      segCount,
      1.1,
    );

    // 2. Crackling mid-conduit electric fork offshoots on underActorGraphics
    for (let fk = 0; fk < 2; fk++) {
      const idx = Math.max(1, Math.min(segCount - 1, Math.round(segCount * (fk === 0 ? 0.34 : 0.67))));
      const u = idx / segCount;
      const bx = p1.x + dx * u;
      const by = p1.y + dy * u;
      const side = Math.sin(tSec * 17 + p1.id + fk * 2.9) >= 0 ? 1 : -1;
      const fx = bx + ux * 9 * (fk === 0 ? 1 : -1) + nx * side * 11;
      const fy = by + uy * 9 * (fk === 0 ? 1 : -1) + ny * side * 11;
      fillTaperedLightningBolt(
        underG,
        bx,
        by,
        fx,
        fy,
        1.4,
        fk === 0 ? COL_CYAN_BOLT : COL_VOLT_YELLOW,
        0.9,
        p1.id + fk * 13 + Math.floor(tSec * 14),
        4,
        1.1,
      );
    }

    // 3. Arc-welder terminal stars on both pylon heads on underActorGraphics
    drawChiaroscuroDiamondStar(underG, p1.x, p1.y, 7.5, tSec * 4.5 + p1.id, COL_CYAN_BOLT);
    drawChiaroscuroDiamondStar(underG, p2.x, p2.y, 7.5, -tSec * 4.5 + p2.id, COL_CYAN_BOLT);

    for (let ei = 0; ei < sim.enemies.length; ei++) {
      const e = sim.enemies[ei]!;
      if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
      const proj = pointToSegmentProjection(e.x, e.y, p1.x, p1.y, p2.x, p2.y);
      if (proj.dist <= WALL_TETHER_WIRE_HALF_WIDTH + e.radius + 4) {
        drawChiaroscuroDiamondStar(underG, proj.cx, proj.cy, 10.5, tSec * 10 + e.id * 0.7, COL_VOLT_YELLOW);
        for (let sp = 0; sp < 4; sp++) {
          const spAng = tSec * 12 + e.id + (sp * Math.PI) / 2 + Math.PI * 0.25;
          const x0 = proj.cx + Math.cos(spAng) * 4.2;
          const y0 = proj.cy + Math.sin(spAng) * 4.2;
          const x1 = proj.cx + Math.cos(spAng) * 10.8;
          const y1 = proj.cy + Math.sin(spAng) * 10.8;
          fillTaperedLightningBolt(
            underG,
            x0,
            y0,
            x1,
            y1,
            1.2,
            sp % 2 === 0 ? COL_CYAN_BOLT : COL_HOLO_ICE,
            0.92,
            e.id + sp * 7,
            3,
            1.0,
          );
        }
      }
    }
  }
}

function drawCausticSporePodOverlays(g: Gfx, floorG: Gfx, sim: WorldSim, tSec: number): void {
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0 || prop.kind !== 'caustic_spore_pod') continue;
    const r = prop.radius + 4.5;
    const pulse = Math.sin(tSec * 7.5 + prop.id) * 1.4;
    fillDisc(floorG, prop.x, prop.y, r + 4 + pulse, COL_LIME_ACID, 0.06);

    for (let b = 0; b < 4; b++) {
      const ang = tSec * 2.8 + prop.id * 0.9 + (b * Math.PI) / 2;
      const bob = 1.6 + 0.8 * Math.sin(tSec * 9 + b * 1.9 + prop.id);
      const bx = prop.x + Math.cos(ang) * (r + 1.5);
      const by = prop.y + Math.sin(ang) * (r + 1.5);
      fillDisc(g, bx, by, bob + 1.1, COL_INK, 0.92);
      fillDisc(g, bx, by, bob, b % 2 === 0 ? COL_LIME_BRIGHT : COL_LIME_ACID, 0.96);
    }
  }
}

function drawOrbitReturnProjectileOverlay(g: Gfx, sim: WorldSim, b: SimProjectileState, tSec: number): void {
  const owner = resolveSummonOwner(sim, b.ownerId);
  const ang = b.angle ?? Math.atan2(b.vy, b.vx);
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const perpX = -sin;
  const perpY = cos;

  if (owner.lifeState === 'alive') {
    const distToOwner = distance(b.x, b.y, owner.x, owner.y);
    if (distToOwner > 18 && distToOwner < 460) {
      const bend = Math.min(26, distToOwner * 0.14);
      const midX = (b.x + owner.x) * 0.5 + perpX * bend;
      const midY = (b.y + owner.y) * 0.5 + perpY * bend;
      fillTaperedQuadraticBezier(
        g,
        b.x,
        b.y,
        midX,
        midY,
        owner.x,
        owner.y,
        1.8,
        3.0,
        1.8,
        COL_EMERALD,
        0.56,
        6,
        1.6,
      );
    }
  }

  if (b.clientHeldAtMaxRange || (b.orbitReturnTicks ?? 99) <= 10) {
    const turnR = b.radius + 7.5 + Math.sin(tSec * 18 + b.id) * 1.2;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + tSec * 3.0;
      fillTaperedArcRibbon(g, b.x - cos * 4, b.y - sin * 4, turnR, a - 0.28, a + 0.28, 2.0, COL_JADE_LIGHT, 0.92, 3, 1.2);
    }
  }

  const noseX = b.x + cos * (b.radius + 6.5);
  const noseY = b.y + sin * (b.radius + 6.5);
  const wingBackX = b.x - cos * 11.5;
  const wingBackY = b.y - sin * 11.5;
  const span = b.radius + 6.5;
  SCRATCH_ORBIT_CHEVRON_PTS[0][0] = wingBackX + perpX * span;
  SCRATCH_ORBIT_CHEVRON_PTS[0][1] = wingBackY + perpY * span;
  SCRATCH_ORBIT_CHEVRON_PTS[1][0] = noseX;
  SCRATCH_ORBIT_CHEVRON_PTS[1][1] = noseY;
  SCRATCH_ORBIT_CHEVRON_PTS[2][0] = wingBackX - perpX * span;
  SCRATCH_ORBIT_CHEVRON_PTS[2][1] = wingBackY - perpY * span;
  strokePolyline(g, 4.6, COL_INK, 0.94, SCRATCH_ORBIT_CHEVRON_PTS);
  strokePolyline(g, 2.5, COL_EMERALD, 0.98, SCRATCH_ORBIT_CHEVRON_PTS);
  strokeLine(g, b.x - cos * 18, b.y - sin * 18, noseX - cos * 1.5, noseY - sin * 1.5, 1.6, COL_JADE_LIGHT, 0.96);
  fillDisc(g, b.x, b.y, Math.max(2.6, b.radius * 0.62), COL_JADE_LIGHT, 0.96);
}

function drawClusterMortarLobOverlay(_g: Gfx, floorG: Gfx, b: SimProjectileState): void {
  const traveled = distance(b.originX ?? b.prevX, b.originY ?? b.prevY, b.x, b.y);
  const arcPhase = clamp(Math.sin(clamp(traveled / 240, 0.08, 0.95) * Math.PI), 0.15, 1);
  const lobHeight = 8 + arcPhase * 15;

  // Depth 19.0 growing ground shadow on floorG (groundHazardGraphics)
  floorG.fillStyle(COL_INK, 0.42);
  floorG.fillEllipse(b.x, b.y + lobHeight * 0.55, 16 + arcPhase * 5, 7 + arcPhase * 2);

  // 1:1 depth 16.0 impact bracket via fillTaperedArcRibbon on groundHazardGraphics
  const impactR = b.radius + 6;
  for (let k = 0; k < 4; k++) {
    const ang = (k * Math.PI) / 2 + Math.PI / 4;
    fillTaperedArcRibbon(floorG, b.x, b.y, impactR, ang - 0.24, ang + 0.24, 2.0, COL_MORTAR_ORANGE, 0.85, 3, 1.2);
  }
}

export function drawP4ATetherAndProjectileOverlays(scene: unknown, g: Gfx, sim: WorldSim): void {
  const floorG = resolveFloorGfx(scene, g);
  const underG = resolveUnderActorGfx(scene, g);
  const tSec = resolveP4AVisualTimeSec(scene, sim);
  drawElectricCutterWires(underG, sim, tSec);
  drawCausticSporePodOverlays(g, floorG, sim, tSec);

  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team !== 'player') continue;
    if (b.orbitReturned || b.clientHeldAtMaxRange) drawOrbitReturnProjectileOverlay(g, sim, b, tSec);
    if (b.clusterMortarLob) drawClusterMortarLobOverlay(g, floorG, b);
  }
}

export function handleP4ASimEvent(scene: unknown, ev: SimEvent, sim: WorldSim, isStress: boolean, _allowStressSfx: boolean): boolean {
  if (isStress || ev.kind !== 'explosion') return false;
  const isCausticPod = ev.sourceDefId === 'caustic_spore_pod' || ev.sourceDefId === 'reload_caustic_pod';
  if (
    ev.sourceDefId === 'dash_thunder_decoy' ||
    isCausticPod ||
    ev.sourceDefId === 'mutator_cluster_mortar'
  ) {
    const sceneObj = scene as { fx?: Parameters<typeof routeCutoutBurstByRadius>[0] };
    if (sceneObj?.fx && typeof (sceneObj.fx as { spawnShaderNova?: unknown }).spawnShaderNova === 'function') {
      const evOwner = (ev as { ownerId?: number }).ownerId;
      const isTeammate = evOwner !== undefined && evOwner !== sim.player.id;
      if (ev.sourceDefId === 'dash_thunder_decoy') {
        routeCutoutBurstByRadius(sceneObj.fx, ev.x, ev.y, ev.radius || THUNDER_DECOY_BLAST_RADIUS, 'fx_sh_nova_thunder', { isTeammate });
      } else if (isCausticPod) {
        routeCutoutBurstByRadius(sceneObj.fx, ev.x, ev.y, ev.radius || CAUSTIC_POD_BLAST_RADIUS, 'fx_sh_bloom_briar', { isTeammate });
      } else if (ev.sourceDefId === 'mutator_cluster_mortar') {
        routeCutoutBurstByRadius(sceneObj.fx, ev.x, ev.y, ev.radius || CLUSTER_MORTAR_BLAST_RADIUS, 'fx_sh_shrapnel_corona', { isTeammate });
      }
    }
  }
  return false;
}
