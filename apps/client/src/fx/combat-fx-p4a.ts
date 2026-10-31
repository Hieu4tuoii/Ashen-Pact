import {
  BOOMERANG_CORE_MAX_OUTBOUND_DIST,
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

type Gfx = Phaser.GameObjects.Graphics;

const COL_INK = hexToNum(PALETTE.INK_DARK);
const COL_SLATE = hexToNum(PALETTE.SLATE_DARK);
const COL_VIOLET = hexToNum(PALETTE.ELECTRIC_VIOLET);
const COL_SOLAR_GOLD = hexToNum(PALETTE.SOLAR_GOLD);
const COL_VOLT_YELLOW = 0xfacc15;
const COL_CYAN_BOLT = 0x38bdf8;
const COL_HOLO_ICE = 0xe0f2fe;
const COL_HOLO_DEEP = 0x0284c7;
const COL_EMERALD = 0x10b981;
const COL_JADE_LIGHT = 0x34d399;
const COL_TEAL_SAW = 0x14b8a6;
const COL_TEAL_EDGE = 0x5eead4;
const COL_LIME_ACID = 0x84cc16;
const COL_LIME_BRIGHT = 0xbef264;
const COL_MORTAR_ORANGE = 0xf97316;

interface P4ATransientBurst {
  kind: 'thunder_decoy_nova' | 'caustic_pod_burst' | 'cluster_mortar_pop';
  roomId: number;
  x: number;
  y: number;
  radius: number;
  spawnTick: number;
  durationTicks: number;
}

const p4aTransientBurstsBySim = new WeakMap<WorldSim, P4ATransientBurst[]>();

function getTransientBurstList(sim: WorldSim): P4ATransientBurst[] {
  let list = p4aTransientBurstsBySim.get(sim);
  if (!list) {
    list = [];
    p4aTransientBurstsBySim.set(sim, list);
  }
  return list;
}

export function resolveP4AVisualTimeSec(scene: unknown, sim: WorldSim): number {
  const simTimeSec = sim.tick / 60;
  if (isVisualFreezeActive(scene) || getVisualQueryConfig().freeze) {
    return getFreezeVisualTimeSec(simTimeSec);
  }
  return simTimeSec;
}

function fillDisc(g: Gfx, x: number, y: number, r: number, col: number, alpha: number): void {
  g.fillStyle(col, alpha);
  g.fillCircle(x, y, r);
}

function strokeRing(g: Gfx, x: number, y: number, r: number, width: number, col: number, alpha: number): void {
  g.lineStyle(width, col, alpha);
  g.strokeCircle(x, y, r);
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

function drawThunderDecoySummon(g: Gfx, sum: SimSummonState, tSec: number, ttlRatio: number): void {
  const blastR = THUNDER_DECOY_BLAST_RADIUS;
  fillDisc(g, sum.x, sum.y, blastR, COL_VIOLET, 0.045);
  strokeRing(g, sum.x, sum.y, blastR, 2.4, COL_INK, 0.28);
  strokeRing(g, sum.x, sum.y, blastR, 1.4, COL_VIOLET, 0.44);

  for (let w = 0; w < 2; w++) {
    const waveProg = (tSec * 1.65 + w * 0.5) % 1;
    strokeRing(g, sum.x, sum.y, 19 + waveProg * 46, 1.6, w === 0 ? COL_SOLAR_GOLD : COL_VIOLET, (1 - waveProg) * 0.36);
  }

  g.fillStyle(COL_INK, 0.42);
  g.fillEllipse(sum.x, sum.y + 11, 30, 12);
  fillDisc(g, sum.x, sum.y, 17, COL_INK, 0.96);
  fillDisc(g, sum.x, sum.y, 13.8, COL_VIOLET, 0.92);
  g.fillStyle(COL_INK, 0.94);
  g.fillTriangle(sum.x - 10, sum.y + 7, sum.x + 10, sum.y + 7, sum.x, sum.y - 14);
  g.fillStyle(COL_SOLAR_GOLD, 0.98);
  g.fillTriangle(sum.x - 7.5, sum.y + 5.5, sum.x + 7.5, sum.y + 5.5, sum.x, sum.y - 11.5);
  g.fillCircle(sum.x, sum.y - 1, 5.6);

  strokePolyline(g, 2.0, 0xfef9c3, 0.98, [
    [sum.x + 2, sum.y - 8],
    [sum.x - 2.5, sum.y - 1],
    [sum.x + 1.5, sum.y - 1],
    [sum.x - 2, sum.y + 6.5],
  ]);

  for (let k = 0; k < 3; k++) {
    const baseAng = tSec * 5.4 + sum.id * 0.7 + (k * Math.PI * 2) / 3;
    const midAng = baseAng + 0.28 * (k % 2 === 0 ? 1 : -1);
    const tipAng = baseAng + 0.08;
    const arcPts: [number, number][] = [
      [sum.x + Math.cos(baseAng) * 12, sum.y + Math.sin(baseAng) * 12],
      [sum.x + Math.cos(midAng) * 17.5, sum.y + Math.sin(midAng) * 17.5],
      [sum.x + Math.cos(tipAng) * 22, sum.y + Math.sin(tipAng) * 22],
    ];
    strokePolyline(g, 3.0, COL_INK, 0.85, arcPts);
    strokePolyline(g, 1.6, k === 0 ? COL_SOLAR_GOLD : COL_CYAN_BOLT, 0.94, arcPts);
  }

  strokeRing(g, sum.x, sum.y, 14.5, 2.4, COL_INK, 0.98);
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

  strokeRing(g, sum.x, sum.y, 8.6, 2.4, COL_INK, 0.96);
  strokeRing(g, sum.x, sum.y, 8.2, 1.7, COL_HOLO_ICE, 0.9);
  strokeRing(g, sum.x, sum.y, 6.0, 1.5, COL_CYAN_BOLT, 0.88);
  fillDisc(g, sum.x, sum.y, 5.2 + pulse * 0.6, COL_CYAN_BOLT, 0.94);
  fillDisc(g, sum.x, sum.y, 3.1 + pulse * 0.35, COL_SOLAR_GOLD, 0.98);
  fillDisc(g, sum.x - 1.1, sum.y - 1.1, 1.3, 0xffffff, 0.95);
  strokeRing(g, sum.x, sum.y, 15.2, 3.2, COL_INK, 0.85);
  strokeArc(g, sum.x, sum.y, 15.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ttlRatio, 2.1, COL_CYAN_BOLT, 0.95);
}

function drawHoloDecoyTurretSummon(g: Gfx, sim: WorldSim, sum: SimSummonState, tSec: number, ttlRatio: number): void {
  const aimAng = resolveHoloDecoyAimAngle(sim, sum);
  const cos = Math.cos(aimAng);
  const sin = Math.sin(aimAng);

  g.fillStyle(COL_INK, 0.94);
  g.fillEllipse(sum.x, sum.y + 8, 26, 11);
  g.fillStyle(COL_SLATE, 0.92);
  g.fillEllipse(sum.x, sum.y + 8, 22, 8.5);
  g.lineStyle(1.8, COL_CYAN_BOLT, 0.88);
  g.strokeEllipse(sum.x, sum.y + 8, 22, 8.5);

  fillDisc(g, sum.x, sum.y - 1, 14.2, COL_INK, 0.72);
  fillDisc(g, sum.x, sum.y - 1, 12.4, COL_HOLO_DEEP, 0.36);
  fillDisc(g, sum.x - cos * 1.5, sum.y - 1 - sin * 1.5, 8.4, COL_CYAN_BOLT, 0.45);

  const scanOffset = ((tSec * 20) % 5) - 2.5;
  for (let row = -1; row <= 1; row++) {
    const sy = sum.y - 1 + row * 4.5 + scanOffset * 0.45;
    const dy = Math.abs(sy - (sum.y - 1));
    const halfSpan = Math.sqrt(Math.max(4, 11.2 * 11.2 - dy * dy)) - 1.5;
    strokeLine(g, sum.x - halfSpan, sy, sum.x + halfSpan, sy, 1.3, row === 0 ? COL_HOLO_ICE : COL_CYAN_BOLT, 0.82);
  }

  strokeRing(g, sum.x, sum.y - 1, 13.2, 2.4, COL_INK, 0.95);
  strokeRing(g, sum.x, sum.y - 1, 12.2, 1.7, COL_HOLO_ICE, 0.92);

  const bx0 = sum.x + cos * 4;
  const by0 = sum.y - 1 + sin * 4;
  const bx1 = sum.x + cos * 19.5;
  const by1 = sum.y - 1 + sin * 19.5;
  strokeLine(g, bx0, by0, bx1, by1, 6.0, COL_INK, 0.96);
  strokeLine(g, bx0, by0, bx1, by1, 3.4, COL_CYAN_BOLT, 0.96);
  strokeLine(g, bx0 + cos * 2, by0 + sin * 2, bx1, by1, 1.5, COL_HOLO_ICE, 0.98);

  if (sum.tickTimer <= 0.06 || sum.tickTimer >= 0.39) {
    fillDisc(g, bx1 + cos * 2, by1 + sin * 2, 5.6, COL_CYAN_BOLT, 0.55);
    fillDisc(g, bx1 + cos * 2, by1 + sin * 2, 3.0, COL_HOLO_ICE, 0.96);
    strokeLine(g, bx1 + sin * 5.5, by1 - cos * 5.5, bx1 - sin * 5.5, by1 + cos * 5.5, 1.8, COL_HOLO_ICE, 0.92);
  }

  strokeArc(g, sum.x, sum.y - 1, 16.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ttlRatio, 2.1, COL_CYAN_BOLT, 0.9);
}

export function drawP4ASummonOverlay(scene: unknown, g: Gfx, sim: WorldSim, sum: SimSummonState): boolean {
  if (sum.kind !== 'thunder_decoy' && sum.kind !== 'wall_tether_pylon' && sum.kind !== 'holo_decoy_turret') {
    return false;
  }
  const tSec = resolveP4AVisualTimeSec(scene, sim);
  const ttlRatio = clamp(sum.ttlSec / Math.max(0.1, sum.maxTtlSec), 0, 1);
  if (sum.kind === 'thunder_decoy') drawThunderDecoySummon(g, sum, tSec, ttlRatio);
  else if (sum.kind === 'wall_tether_pylon') drawWallTetherPylonSummon(g, sum, tSec, ttlRatio);
  else drawHoloDecoyTurretSummon(g, sim, sum, tSec, ttlRatio);
  return true;
}

function drawElectricCutterWires(g: Gfx, sim: WorldSim, tSec: number): void {
  let firstPylonByOwner: Map<number, SimSummonState> | null = null;
  for (let i = 0; i < sim.summons.length; i++) {
    const s = sim.summons[i]!;
    if (s.hp <= 0 || s.ttlSec <= 0 || s.kind !== 'wall_tether_pylon') continue;
    if (!firstPylonByOwner) firstPylonByOwner = new Map<number, SimSummonState>();
    const p1 = firstPylonByOwner.get(s.ownerPlayerId);
    if (!p1) {
      firstPylonByOwner.set(s.ownerPlayerId, s);
      continue;
    }

    const p2 = s;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 6) continue;
    const nx = -dy / len;
    const ny = dx / len;
    const segCount = Math.max(6, Math.min(16, Math.round(len / 22)));

    strokeLine(g, p1.x, p1.y, p2.x, p2.y, 8.4, COL_INK, 0.78);
    strokeLine(g, p1.x, p1.y, p2.x, p2.y, 4.2, COL_CYAN_BOLT, 0.34);

    for (let strand = 0; strand < 2; strand++) {
      const sign = strand === 0 ? 1 : -1;
      g.lineStyle(strand === 0 ? 2.5 : 1.9, strand === 0 ? COL_CYAN_BOLT : COL_VOLT_YELLOW, 0.96);
      g.beginPath();
      g.moveTo(p1.x, p1.y);
      for (let step = 1; step < segCount; step++) {
        const u = step / segCount;
        const jag = Math.sin(tSec * 24 + step * 2.35 + p1.id * 0.5 + strand * 1.7) * 5.2 * Math.sin(u * Math.PI) * sign;
        g.lineTo(p1.x + dx * u + nx * jag, p1.y + dy * u + ny * jag);
      }
      g.lineTo(p2.x, p2.y);
      g.strokePath();
    }

    for (let ei = 0; ei < sim.enemies.length; ei++) {
      const e = sim.enemies[ei]!;
      if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
      const proj = pointToSegmentProjection(e.x, e.y, p1.x, p1.y, p2.x, p2.y);
      if (proj.dist <= WALL_TETHER_WIRE_HALF_WIDTH + e.radius + 4) {
        fillDisc(g, proj.cx, proj.cy, 7.2, COL_INK, 0.9);
        fillDisc(g, proj.cx, proj.cy, 5.2, COL_CYAN_BOLT, 0.92);
        fillDisc(g, proj.cx, proj.cy, 2.8, COL_VOLT_YELLOW, 0.98);
        for (let sp = 0; sp < 4; sp++) {
          const spAng = tSec * 12 + e.id + (sp * Math.PI) / 2 + 0.35;
          strokeLine(
            g,
            proj.cx + Math.cos(spAng) * 3,
            proj.cy + Math.sin(spAng) * 3,
            proj.cx + Math.cos(spAng) * 9.5,
            proj.cy + Math.sin(spAng) * 9.5,
            1.8,
            sp % 2 === 0 ? COL_VOLT_YELLOW : COL_HOLO_ICE,
            0.94,
          );
        }
      }
    }
  }
}

function drawCausticSporePodOverlays(g: Gfx, sim: WorldSim, tSec: number): void {
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0 || prop.kind !== 'caustic_spore_pod') continue;
    const r = prop.radius + 4.5;
    const pulse = Math.sin(tSec * 7.5 + prop.id) * 1.4;
    fillDisc(g, prop.x, prop.y, r + 4 + pulse, COL_LIME_ACID, 0.14);
    strokeRing(g, prop.x, prop.y, r + pulse * 0.5, 3.4, COL_INK, 0.86);
    strokeRing(g, prop.x, prop.y, r + pulse * 0.5, 2.0, COL_LIME_ACID, 0.96);

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
      const tetherPts: [number, number][] = [
        [b.x, b.y],
        [(b.x + owner.x) * 0.5 + perpX * bend, (b.y + owner.y) * 0.5 + perpY * bend],
        [owner.x, owner.y],
      ];
      strokePolyline(g, 2.6, COL_INK, 0.34, tetherPts);
      strokePolyline(g, 1.4, COL_EMERALD, 0.56, tetherPts);
    }
  }

  if (b.clientHeldAtMaxRange || (b.orbitReturnTicks ?? 99) <= 10) {
    const turnR = b.radius + 7.5 + Math.sin(tSec * 18 + b.id) * 1.2;
    strokeRing(g, b.x - cos * 4, b.y - sin * 4, turnR, 2.8, COL_INK, 0.82);
    strokeRing(g, b.x - cos * 4, b.y - sin * 4, turnR, 1.7, COL_JADE_LIGHT, 0.92);
  }

  const noseX = b.x + cos * (b.radius + 6.5);
  const noseY = b.y + sin * (b.radius + 6.5);
  const wingBackX = b.x - cos * 11.5;
  const wingBackY = b.y - sin * 11.5;
  const span = b.radius + 6.5;
  const chevronPts: [number, number][] = [
    [wingBackX + perpX * span, wingBackY + perpY * span],
    [noseX, noseY],
    [wingBackX - perpX * span, wingBackY - perpY * span],
  ];
  strokePolyline(g, 4.6, COL_INK, 0.94, chevronPts);
  strokePolyline(g, 2.5, COL_EMERALD, 0.98, chevronPts);
  strokeLine(g, b.x - cos * 18, b.y - sin * 18, noseX - cos * 1.5, noseY - sin * 1.5, 1.6, COL_JADE_LIGHT, 0.96);
  fillDisc(g, b.x, b.y, Math.max(2.6, b.radius * 0.62), COL_JADE_LIGHT, 0.96);
}

function drawPhaseShockwaveBladeOverlay(g: Gfx, b: SimProjectileState): void {
  const ang = b.angle ?? Math.atan2(b.vy, b.vx);
  const r = Math.max(15, b.radius);
  strokeArc(g, b.x, b.y, r, ang - 1.05, ang + 1.05, 6.2, COL_INK, 0.94);
  strokeArc(g, b.x, b.y, r, ang - 1.0, ang + 1.0, 3.6, COL_CYAN_BOLT, 0.95);
  strokeArc(g, b.x, b.y, r + 1.2, ang - 0.78, ang + 0.78, 1.8, COL_HOLO_ICE, 0.98);
}

function drawBoomerangSawCoreOverlay(g: Gfx, b: SimProjectileState, tSec: number): void {
  const r = Math.max(13, b.radius);
  const spin = tSec * 16 + b.id * 0.5;
  fillDisc(g, b.x, b.y, r * 0.72, COL_INK, 0.94);

  for (let tooth = 0; tooth < 6; tooth++) {
    const a0 = spin + (tooth * Math.PI * 2) / 6;
    const a1 = a0 + 0.34;
    const tipA = a0 + 0.14;
    g.fillStyle(COL_INK, 0.95);
    g.fillTriangle(
      b.x + Math.cos(a0) * (r * 0.65),
      b.y + Math.sin(a0) * (r * 0.65),
      b.x + Math.cos(a1) * (r * 0.65),
      b.y + Math.sin(a1) * (r * 0.65),
      b.x + Math.cos(tipA) * (r + 3.2),
      b.y + Math.sin(tipA) * (r + 3.2),
    );
    g.fillStyle(tooth % 2 === 0 ? COL_TEAL_EDGE : COL_TEAL_SAW, 0.96);
    g.fillTriangle(
      b.x + Math.cos(a0) * (r * 0.62),
      b.y + Math.sin(a0) * (r * 0.62),
      b.x + Math.cos(a1) * (r * 0.62),
      b.y + Math.sin(a1) * (r * 0.62),
      b.x + Math.cos(tipA) * (r + 1.6),
      b.y + Math.sin(tipA) * (r + 1.6),
    );
  }

  strokeRing(g, b.x, b.y, r * 0.68, 2.4, COL_INK, 0.96);
  fillDisc(g, b.x, b.y, r * 0.45, COL_TEAL_SAW, 0.96);
  fillDisc(g, b.x, b.y, r * 0.2, COL_HOLO_ICE, 0.98);

  if (b.boomerangPhase === 'returning') {
    const travelRatio = clamp(distance(b.originX ?? b.x, b.originY ?? b.y, b.x, b.y) / BOOMERANG_CORE_MAX_OUTBOUND_DIST, 0.25, 1);
    strokeRing(g, b.x, b.y, r + 4.2, 1.6, COL_TEAL_EDGE, 0.72 * travelRatio);
  }
}

function drawClusterMortarLobOverlay(g: Gfx, b: SimProjectileState): void {
  const traveled = distance(b.originX ?? b.prevX, b.originY ?? b.prevY, b.x, b.y);
  const arcPhase = clamp(Math.sin(clamp(traveled / 240, 0.08, 0.95) * Math.PI), 0.15, 1);
  const lobHeight = 8 + arcPhase * 15;
  const shellY = b.y - lobHeight * 0.45;

  g.fillStyle(COL_INK, 0.48);
  g.fillEllipse(b.x, b.y + lobHeight * 0.55, 16 + arcPhase * 5, 7 + arcPhase * 2);
  strokeLine(g, b.x, b.y + lobHeight * 0.5, b.x, shellY, 1.6, COL_MORTAR_ORANGE, 0.72);
  fillDisc(g, b.x, shellY, b.radius + 3.2, COL_INK, 0.94);
  fillDisc(g, b.x, shellY, b.radius + 1.4, COL_MORTAR_ORANGE, 0.96);
  fillDisc(g, b.x - 1, shellY - 1, Math.max(2, b.radius * 0.55), COL_VOLT_YELLOW, 0.98);
}

function drawAuxP4ABoltOverlay(g: Gfx, b: SimProjectileState): void {
  const ang = b.angle ?? Math.atan2(b.vy, b.vx);
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const isSurge = b.weaponId === 'holster_surge_bolt';
  const tailLen = isSurge ? 18 : 12;
  const headLen = isSurge ? 6 : 4;
  strokeLine(g, b.x - cos * tailLen, b.y - sin * tailLen, b.x + cos * headLen, b.y + sin * headLen, isSurge ? 5.2 : 4.0, COL_INK, isSurge ? 0.92 : 0.88);
  strokeLine(g, b.x - cos * tailLen, b.y - sin * tailLen, b.x + cos * headLen, b.y + sin * headLen, isSurge ? 2.8 : 2.2, isSurge ? COL_VOLT_YELLOW : COL_CYAN_BOLT, 0.97);
  fillDisc(g, b.x + (isSurge ? 0 : cos * 1.5), b.y + (isSurge ? 0 : sin * 1.5), isSurge ? 3.4 : 2.4, COL_HOLO_ICE, 0.98);
}

function drawDeterministicTransientBursts(g: Gfx, sim: WorldSim): void {
  const list = p4aTransientBurstsBySim.get(sim);
  if (!list || list.length === 0) return;

  for (let i = list.length - 1; i >= 0; i--) {
    const burst = list[i]!;
    const elapsedTicks = sim.tick - burst.spawnTick;
    if (burst.roomId !== sim.currentRoomId || elapsedTicks < 0 || elapsedTicks > burst.durationTicks) {
      list.splice(i, 1);
      continue;
    }
    const prog = clamp(elapsedTicks / Math.max(1, burst.durationTicks), 0, 1);
    const fade = 1 - prog;
    const curR = burst.radius * (0.42 + 0.58 * Math.sqrt(prog));

    if (burst.kind === 'thunder_decoy_nova') {
      fillDisc(g, burst.x, burst.y, curR, COL_VIOLET, 0.14 * fade);
      strokeRing(g, burst.x, burst.y, curR, 4.2, COL_INK, 0.72 * fade);
      strokeRing(g, burst.x, burst.y, curR, 2.4, COL_SOLAR_GOLD, 0.94 * fade);
      strokeRing(g, burst.x, burst.y, burst.radius, 1.6, COL_CYAN_BOLT, 0.86 * fade);
      for (let s = 0; s < 8; s++) {
        const ang = (s * Math.PI) / 4 + 0.2;
        strokeLine(
          g,
          burst.x + Math.cos(ang) * (curR * 0.28),
          burst.y + Math.sin(ang) * (curR * 0.28),
          burst.x + Math.cos(ang) * (curR * 0.96),
          burst.y + Math.sin(ang) * (curR * 0.96),
          1.9,
          s % 2 === 0 ? COL_SOLAR_GOLD : COL_CYAN_BOLT,
          0.88 * fade,
        );
      }
    } else if (burst.kind === 'caustic_pod_burst') {
      fillDisc(g, burst.x, burst.y, curR, COL_LIME_ACID, 0.16 * fade);
      strokeRing(g, burst.x, burst.y, curR, 3.6, COL_INK, 0.7 * fade);
      strokeRing(g, burst.x, burst.y, curR, 2.2, COL_LIME_BRIGHT, 0.92 * fade);
    } else {
      strokeRing(g, burst.x, burst.y, curR, 3.2, COL_INK, 0.68 * fade);
      strokeRing(g, burst.x, burst.y, curR, 2.0, COL_MORTAR_ORANGE, 0.9 * fade);
    }
  }
}

export function drawP4ATetherAndProjectileOverlays(scene: unknown, g: Gfx, sim: WorldSim): void {
  const tSec = resolveP4AVisualTimeSec(scene, sim);
  drawElectricCutterWires(g, sim, tSec);
  drawCausticSporePodOverlays(g, sim, tSec);
  drawDeterministicTransientBursts(g, sim);

  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team !== 'player') continue;
    if (b.orbitReturned || b.clientHeldAtMaxRange) drawOrbitReturnProjectileOverlay(g, sim, b, tSec);
    if (b.weaponId === 'dash_phase_blade') drawPhaseShockwaveBladeOverlay(g, b);
    else if (b.weaponId === 'mutator_boomerang_saw') drawBoomerangSawCoreOverlay(g, b, tSec);
    else if (b.weaponId === 'holster_surge_bolt' || b.weaponId === 'holo_decoy_shot') drawAuxP4ABoltOverlay(g, b);
    if (b.clusterMortarLob) drawClusterMortarLobOverlay(g, b);
  }
}

export function handleP4ASimEvent(_scene: unknown, ev: SimEvent, sim: WorldSim, isStress: boolean, _allowStressSfx: boolean): boolean {
  if (isStress || ev.kind !== 'explosion') return false;
  const isCausticPod = ev.sourceDefId === 'caustic_spore_pod' || ev.sourceDefId === 'reload_caustic_pod';
  if (
    ev.sourceDefId === 'dash_thunder_decoy' ||
    isCausticPod ||
    ev.sourceDefId === 'mutator_cluster_mortar'
  ) {
    const list = getTransientBurstList(sim);
    if (list.length >= 24) list.shift();
    list.push({
      kind:
        ev.sourceDefId === 'dash_thunder_decoy'
          ? 'thunder_decoy_nova'
          : isCausticPod
            ? 'caustic_pod_burst'
            : 'cluster_mortar_pop',
      roomId: sim.currentRoomId,
      x: ev.x,
      y: ev.y,
      radius:
        ev.radius ||
        (ev.sourceDefId === 'dash_thunder_decoy'
          ? THUNDER_DECOY_BLAST_RADIUS
          : isCausticPod
            ? CAUSTIC_POD_BLAST_RADIUS
            : CLUSTER_MORTAR_BLAST_RADIUS),
      spawnTick: sim.tick,
      durationTicks: ev.sourceDefId === 'dash_thunder_decoy' ? 16 : 12,
    });
  }
  return false;
}
