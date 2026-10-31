import {
  anyPlayerHasDuoBoon,
  clamp,
  CRYO_SHATTER_SPIRE_BLAST_RADIUS,
  CRYO_SHATTER_SPIRE_TTL_SEC,
  distance,
  hasPlayerDuoBoon,
  isFlippableBarricadeProp,
  MAGNETIC_BASTION_MAX_DIST,
  MAGNETIC_BASTION_WIRE_HALF_WIDTH,
  NAPALM_PLAGUE_BLAST_RADIUS,
  type SimEvent,
  type SimProjectileState,
  type SimPropState,
  type SimSummonState,
  SUPERCONDUCT_RAIL_RADIUS,
  SUPERHEATED_CYCLONE_AURA_RADIUS,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../art/palette.js';
import { zzfx } from '../audio/zzfx.js';
import { getFreezeVisualTimeSec, getVisualQueryConfig } from '../core/visual-query.js';
import type { GameScene } from '../scenes/GameScene.js';
import { isVisualFreezeActive } from './combat-fx-blessings-p1d.js';

type Gfx = Phaser.GameObjects.Graphics;

const COL_INK = hexToNum(PALETTE.INK_DARK);
const COL_BONE = hexToNum(PALETTE.BONE_WHITE);
const COL_SOLAR_GOLD = hexToNum(PALETTE.SOLAR_GOLD);
const COL_VIOLET = hexToNum(PALETTE.ELECTRIC_VIOLET);
const COL_FIRE_ORANGE = 0xf97316;
const COL_FROST_CYAN = 0x38bdf8;
const COL_ICE_WHITE = 0xe0f2fe;
const COL_VOLT_YELLOW = 0xfacc15;
const COL_LIME_VENOM = 0x84cc16;
const COL_LIME_BRIGHT = 0xbef264;
const COL_SLATE_MUTED = 0x64708b;

interface P4BTransientBurst {
  kind:
    | 'cryo_shatter_spire_burst'
    | 'napalm_chain_plague_burst'
    | 'secret_trial_seal'
    | 'secret_trial_victory'
    | 'secret_trial_expired';
  roomId: number;
  x: number;
  y: number;
  radius: number;
  spawnTick: number;
  durationTicks: number;
}

const p4bTransientBurstsBySim = new WeakMap<WorldSim, P4BTransientBurst[]>();
const p4bAdditiveGfxByScene = new WeakMap<object, Gfx>();

function getTransientBurstList(sim: WorldSim): P4BTransientBurst[] {
  let list = p4bTransientBurstsBySim.get(sim);
  if (!list) {
    list = [];
    p4bTransientBurstsBySim.set(sim, list);
  }
  return list;
}

function resolveSimFromScene(scene: unknown): WorldSim | null {
  if (!scene || typeof scene !== 'object') return null;
  const s = scene as { transport?: { getSim?: () => WorldSim }; sim?: WorldSim };
  if (s.transport && typeof s.transport.getSim === 'function') {
    return s.transport.getSim();
  }
  return s.sim ?? null;
}

function getOrCreateAdditiveOverlayGraphics(scene: unknown, fallbackG: Gfx): Gfx {
  if (!scene || typeof scene !== 'object') return fallbackG;
  const s = scene as {
    add?: { graphics?: () => Gfx };
    sys?: { isActive?: () => boolean };
  };
  if (!s.add || typeof s.add.graphics !== 'function') {
    return fallbackG;
  }
  const existing = p4bAdditiveGfxByScene.get(s);
  if (existing && existing.scene) {
    existing.clear();
    return existing;
  }
  const created = s.add.graphics();
  created.setDepth(42);
  // Phaser.BlendModes.ADD === 1 (kept numeric so `phaser` remains a type-only import under Node Vitest)
  created.setBlendMode(1);
  p4bAdditiveGfxByScene.set(s, created);
  return created;
}

export function resolveP4BVisualTimeSec(scene: unknown, sim: WorldSim): number {
  const simTimeSec = sim.tick / 60;
  if (isVisualFreezeActive(scene) || getVisualQueryConfig().freeze) {
    return getFreezeVisualTimeSec(simTimeSec);
  }
  return simTimeSec;
}

function resolveOwnerAlpha(sim: WorldSim, ownerPlayerId: number | undefined): number {
  if (ownerPlayerId !== undefined && ownerPlayerId !== 0 && ownerPlayerId !== sim.player.id) {
    return 0.5;
  }
  return 1.0;
}

function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { dist: number; cx: number; cy: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-8) return { dist: distance(px, py, x1, y1), cx: x1, cy: y1 };
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return { dist: distance(px, py, cx, cy), cx, cy };
}

function drawSuperheatedCycloneBase(
  g: Gfx,
  sim: WorldSim,
  sum: SimSummonState,
  tSec: number,
): void {
  const aMul = resolveOwnerAlpha(sim, sum.ownerPlayerId);
  const auraR = sum.auraRadius || SUPERHEATED_CYCLONE_AURA_RADIUS;
  const spin = tSec * 5.4 + sum.id * 0.7;

  // Boiling vapor outer boundary ring
  g.fillStyle(COL_FROST_CYAN, 0.08 * aMul);
  g.fillCircle(sum.x, sum.y, auraR);
  g.lineStyle(2.2, COL_INK, 0.55 * aMul);
  g.strokeCircle(sum.x, sum.y, auraR);
  g.lineStyle(1.6, COL_ICE_WHITE, 0.72 * aMul);
  g.strokeCircle(sum.x, sum.y, auraR);

  // Dual counter-rotating steam spirals (white-cyan outer vortex)
  for (let arm = 0; arm < 2; arm++) {
    const baseAng = spin + arm * Math.PI;
    g.lineStyle(2.2, arm === 0 ? COL_ICE_WHITE : COL_FROST_CYAN, 0.82 * aMul);
    g.beginPath();
    for (let step = 0; step <= 8; step++) {
      const ratio = step / 8;
      const r = 8 + ratio * (auraR - 10);
      const ang = baseAng + ratio * 2.5;
      const px = sum.x + Math.cos(ang) * r;
      const py = sum.y + Math.sin(ang) * r;
      if (step === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
  }
}

function drawSuperheatedCycloneAdditiveCore(
  addG: Gfx,
  sim: WorldSim,
  sum: SimSummonState,
  tSec: number,
): void {
  const aMul = resolveOwnerAlpha(sim, sum.ownerPlayerId);
  const auraR = sum.auraRadius || SUPERHEATED_CYCLONE_AURA_RADIUS;
  const counterSpin = -tSec * 7.2 + sum.id * 1.1;

  // Additive blazing orange-gold inner fire core
  addG.fillStyle(COL_FIRE_ORANGE, 0.26 * aMul);
  addG.fillCircle(sum.x, sum.y, 20);
  addG.fillStyle(COL_SOLAR_GOLD, 0.42 * aMul);
  addG.fillCircle(sum.x, sum.y, 10.5);
  addG.fillStyle(COL_BONE, 0.65 * aMul);
  addG.fillCircle(sum.x, sum.y, 4.8);

  for (let arm = 0; arm < 3; arm++) {
    const ang0 = counterSpin + (arm * Math.PI * 2) / 3;
    addG.lineStyle(2.0, arm % 2 === 0 ? COL_FIRE_ORANGE : COL_SOLAR_GOLD, 0.78 * aMul);
    addG.beginPath();
    addG.arc(sum.x, sum.y, 15 + arm * 5, ang0, ang0 + 1.35, false);
    addG.strokePath();
  }

  // Orbiting boiling steam-ember droplets
  for (let k = 0; k < 4; k++) {
    const dAng = counterSpin * 0.8 + (k * Math.PI) / 2;
    const dR = auraR * 0.66;
    addG.fillStyle(k % 2 === 0 ? COL_ICE_WHITE : COL_FIRE_ORANGE, 0.76 * aMul);
    addG.fillCircle(sum.x + Math.cos(dAng) * dR, sum.y + Math.sin(dAng) * dR, 2.6);
  }
}

/**
 * Intercepts P4B summons (`superheated_cyclone`) inside `telegraphs-and-overlays.ts`
 * so they render deterministically instead of falling into the default turret branch.
 */
export function drawP4BSummonOverlay(
  scene: unknown,
  g: Gfx,
  sim: WorldSim,
  sum: SimSummonState,
): boolean {
  if (sum.kind !== 'superheated_cyclone') return false;
  const tSec = resolveP4BVisualTimeSec(scene, sim);
  drawSuperheatedCycloneBase(g, sim, sum, tSec);
  return true;
}

function drawCryoShatterSpireOverlays(g: Gfx, sim: WorldSim, tSec: number): void {
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0 || prop.kind !== 'glacial_spike' || !prop.cryoShatterSpire) continue;

    const aMul = resolveOwnerAlpha(sim, prop.ownerPlayerId);
    const rot = tSec * 2.1 + prop.id * 0.5;
    const baseR = Math.max(16, prop.radius + 5);
    const ttlRatio = clamp((prop.ttlSec ?? CRYO_SHATTER_SPIRE_TTL_SEC) / CRYO_SHATTER_SPIRE_TTL_SEC, 0, 1);

    g.fillStyle(COL_FROST_CYAN, 0.14 * aMul);
    g.fillCircle(prop.x, prop.y, baseR + 4);
    g.lineStyle(2.2, COL_INK, 0.68 * aMul);
    g.strokeCircle(prop.x, prop.y, baseR);
    g.lineStyle(1.6, COL_ICE_WHITE, 0.9 * aMul);
    g.strokeCircle(prop.x, prop.y, baseR);

    // 4 cardinal diamond ice crystal shards around spire base
    for (let k = 0; k < 4; k++) {
      const ang = rot + (k * Math.PI) / 2;
      const tipX = prop.x + Math.cos(ang) * (baseR + 7);
      const tipY = prop.y + Math.sin(ang) * (baseR + 7);
      const leftX = prop.x + Math.cos(ang - 0.22) * (baseR - 1);
      const leftY = prop.y + Math.sin(ang - 0.22) * (baseR - 1);
      const rightX = prop.x + Math.cos(ang + 0.22) * (baseR - 1);
      const rightY = prop.y + Math.sin(ang + 0.22) * (baseR - 1);
      g.fillStyle(k % 2 === 0 ? COL_ICE_WHITE : COL_FROST_CYAN, 0.88 * aMul);
      g.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
    }

    // Countdown shatter fuse arc
    g.lineStyle(2.0, COL_FROST_CYAN, 0.92 * aMul);
    g.beginPath();
    g.arc(prop.x, prop.y, baseR + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ttlRatio, false);
    g.strokePath();
  }
}

function drawSuperconductRailAndNapalmEnemyOverlays(g: Gfx, sim: WorldSim, tSec: number): void {
  const railOwner = anyPlayerHasDuoBoon(sim, 'duo_superconduct_rail');
  const railAlpha = hasPlayerDuoBoon(sim.player, 'duo_superconduct_rail') ? 1.0 : 0.5;

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0) continue;

    // 3. duo_superconduct_rail: dashed r=100px cyan-violet magnetic field ring
    if (railOwner && e.superconductTimer > 0) {
      const r = SUPERCONDUCT_RAIL_RADIUS;
      const rot = tSec * 1.6 + e.id * 0.4;
      g.lineStyle(1.4, COL_VIOLET, 0.26 * railAlpha);
      g.strokeCircle(e.x, e.y, r);

      const segCount = 12;
      const arcSpan = (Math.PI * 2) / (segCount * 1.75);
      for (let s = 0; s < segCount; s++) {
        const a0 = rot + (s * Math.PI * 2) / segCount;
        g.lineStyle(2.0, s % 2 === 0 ? COL_FROST_CYAN : COL_VIOLET, 0.84 * railAlpha);
        g.beginPath();
        g.arc(e.x, e.y, r, a0, a0 + arcSpan, false);
        g.strokePath();
      }

      // 4 inward magnetic lock-on ticks
      for (let q = 0; q < 4; q++) {
        const qa = -rot * 1.4 + (q * Math.PI) / 2;
        g.lineStyle(1.6, COL_ICE_WHITE, 0.8 * railAlpha);
        g.lineBetween(
          e.x + Math.cos(qa) * (e.radius + 5),
          e.y + Math.sin(qa) * (e.radius + 5),
          e.x + Math.cos(qa) * (e.radius + 13),
          e.y + Math.sin(qa) * (e.radius + 13),
        );
      }
    }

    // 4. duo_napalm_chain_plague: bubbling amber-lime resin droplets around enemy feet
    if ((e.napalmPlagueTimer ?? 0) > 0) {
      const pAlpha = resolveOwnerAlpha(sim, e.napalmPlagueOwnerId);
      const footY = e.y + e.radius * 0.55;
      const ringW = Math.max(20, e.radius * 2.1);
      g.fillStyle(COL_LIME_VENOM, 0.18 * pAlpha);
      g.fillEllipse(e.x, footY, ringW, ringW * 0.52);
      g.lineStyle(1.5, COL_FIRE_ORANGE, 0.76 * pAlpha);
      g.strokeEllipse(e.x, footY, ringW, ringW * 0.52);

      for (let d = 0; d < 5; d++) {
        const ang = tSec * 3.8 + d * 1.256 + e.id;
        const bob = Math.sin(tSec * 7.5 + d * 1.7) * 3.2;
        const dx = e.x + Math.cos(ang) * (e.radius * 0.85);
        const dy = footY + Math.sin(ang) * (e.radius * 0.36) - Math.abs(bob);
        const dropCol = d % 2 === 0 ? COL_FIRE_ORANGE : COL_LIME_BRIGHT;
        g.fillStyle(COL_INK, 0.75 * pAlpha);
        g.fillCircle(dx, dy, 3.3);
        g.fillStyle(dropCol, 0.92 * pAlpha);
        g.fillCircle(dx, dy, 2.3);
      }
    }
  }
}

function drawPlasmaStarAndRailProjectiles(
  g: Gfx,
  addG: Gfx,
  sim: WorldSim,
  tSec: number,
): void {
  const hasRail = Boolean(anyPlayerHasDuoBoon(sim, 'duo_superconduct_rail'));

  for (let i = 0; i < sim.projectiles.length; i++) {
    const b: SimProjectileState = sim.projectiles[i]!;
    if (b.team !== 'player') continue;
    const aMul = resolveOwnerAlpha(sim, b.ownerId);

    // 3b. Superconduct Rail trajectory lock-on beam & wake
    if (b.superconductRailRedirected || (b.awaitingServerRedirectTimer ?? 0) > 0) {
      const tailX = b.x - Math.cos(b.angle) * 18;
      const tailY = b.y - Math.sin(b.angle) * 18;
      g.lineStyle(3.2, COL_VIOLET, 0.68 * aMul);
      g.lineBetween(tailX, tailY, b.x, b.y);
      g.lineStyle(1.6, COL_FROST_CYAN, 0.94 * aMul);
      g.lineBetween(tailX, tailY, b.x, b.y);

      if (hasRail) {
        let bestEnemy = null;
        let bestDist = SUPERCONDUCT_RAIL_RADIUS + 36;
        for (let ei = 0; ei < sim.enemies.length; ei++) {
          const e = sim.enemies[ei]!;
          if (e.hp <= 0 || e.superconductTimer <= 0) continue;
          const d = distance(b.x, b.y, e.x, e.y);
          if (d < bestDist) {
            bestDist = d;
            bestEnemy = e;
          }
        }
        if (bestEnemy) {
          g.lineStyle(1.3, COL_FROST_CYAN, 0.65 * aMul);
          g.lineBetween(b.x, b.y, bestEnemy.x, bestEnemy.y);
        }
      }
    }

    // 5. duo_plasma_overload_star: counter-rotating 6-pointed gold-violet Plasma Star
    if (b.weaponId === 'duo_plasma_overload_star') {
      const rOuter = Math.max(10, b.radius + 3.5);
      const rotCw = tSec * 9.6 + b.id * 0.5;
      const rotCcw = -tSec * 9.6 - b.id * 0.3;

      // Electric plasma wake & wall-bounce spark ring
      const backX = b.x - Math.cos(b.angle) * 20;
      const backY = b.y - Math.sin(b.angle) * 20;
      const midX = (b.x + backX) * 0.5 + Math.sin(tSec * 24 + b.id) * 3.5;
      const midY = (b.y + backY) * 0.5 - Math.cos(tSec * 24 + b.id) * 3.5;
      g.lineStyle(2.2, COL_VIOLET, 0.78 * aMul);
      g.beginPath();
      g.moveTo(backX, backY);
      g.lineTo(midX, midY);
      g.lineTo(b.x, b.y);
      g.strokePath();

      if ((b.bouncesDone ?? 0) > 0) {
        g.lineStyle(1.5, COL_VOLT_YELLOW, 0.72 * aMul);
        g.strokeCircle(b.x, b.y, rOuter + 3);
      }

      // Triangle A (Gold-Orange CW) + Triangle B (Electric Violet CCW) = 6-pointed Plasma Star
      for (let layer = 0; layer < 2; layer++) {
        const baseRot = layer === 0 ? rotCw : rotCcw + Math.PI / 3;
        const col = layer === 0 ? COL_VOLT_YELLOW : COL_VIOLET;
        const p0x = b.x + Math.cos(baseRot) * rOuter;
        const p0y = b.y + Math.sin(baseRot) * rOuter;
        const p1x = b.x + Math.cos(baseRot + (Math.PI * 2) / 3) * rOuter;
        const p1y = b.y + Math.sin(baseRot + (Math.PI * 2) / 3) * rOuter;
        const p2x = b.x + Math.cos(baseRot + (Math.PI * 4) / 3) * rOuter;
        const p2y = b.y + Math.sin(baseRot + (Math.PI * 4) / 3) * rOuter;
        addG.fillStyle(col, 0.85 * aMul);
        addG.fillTriangle(p0x, p0y, p1x, p1y, p2x, p2y);
      }

      addG.fillStyle(COL_FIRE_ORANGE, 0.88 * aMul);
      addG.fillCircle(b.x, b.y, 4.8);
      addG.fillStyle(COL_BONE, 0.96 * aMul);
      addG.fillCircle(b.x, b.y, 2.5);
    }
  }
}

const flippedBarricadesScratch: SimPropState[] = [];

function drawMagneticBastionArcWires(g: Gfx, sim: WorldSim, tSec: number): void {
  if (!anyPlayerHasDuoBoon(sim, 'duo_magnetic_bastion_ring')) return;
  const localOwnsBastion = hasPlayerDuoBoon(sim.player, 'duo_magnetic_bastion_ring');
  const wireAlpha = localOwnsBastion ? 1.0 : 0.5;

  flippedBarricadesScratch.length = 0;
  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    if (p.hp > 0 && p.coverState === 'flipped' && isFlippableBarricadeProp(p.kind)) {
      flippedBarricadesScratch.push(p);
    }
  }
  if (flippedBarricadesScratch.length < 2) return;

  for (let i = 0; i < flippedBarricadesScratch.length; i++) {
    const a = flippedBarricadesScratch[i]!;
    for (let j = i + 1; j < flippedBarricadesScratch.length; j++) {
      const b = flippedBarricadesScratch[j]!;
      const dist = distance(a.x, a.y, b.x, b.y);
      if (dist <= 1 || dist > MAGNETIC_BASTION_MAX_DIST) continue;

      const nx = -(b.y - a.y) / dist;
      const ny = (b.x - a.x) / dist;

      // Subtle dark outline for contrast without obscuring #E84545 enemy projectiles
      g.lineStyle(4.0, COL_INK, 0.48 * wireAlpha);
      g.lineBetween(a.x, a.y, b.x, b.y);

      // Dual jagged high-voltage electric arc strands
      for (let strand = 0; strand < 2; strand++) {
        const col = strand === 0 ? COL_VOLT_YELLOW : COL_FROST_CYAN;
        const sign = strand === 0 ? 1 : -1;
        g.lineStyle(strand === 0 ? 2.1 : 1.5, col, 0.88 * wireAlpha);
        g.beginPath();
        g.moveTo(a.x, a.y);
        const segs = 6;
        for (let s = 1; s < segs; s++) {
          const u = s / segs;
          const jitter =
            Math.sin(tSec * 19 + s * 2.3 + a.id + b.id + strand * 1.9) * 5.2 * sign;
          g.lineTo(a.x + (b.x - a.x) * u + nx * jitter, a.y + (b.y - a.y) * u + ny * jitter);
        }
        g.lineTo(b.x, b.y);
        g.strokePath();
      }

      // Capacitor nodes on both flipped barricades
      g.fillStyle(COL_VOLT_YELLOW, 0.9 * wireAlpha);
      g.fillCircle(a.x, a.y, 3.6);
      g.fillCircle(b.x, b.y, 3.6);

      // Contact zap sparks on crossing enemies
      for (let ei = 0; ei < sim.enemies.length; ei++) {
        const e = sim.enemies[ei]!;
        if (e.hp <= 0) continue;
        const proj = pointToSegmentDist(e.x, e.y, a.x, a.y, b.x, b.y);
        if (proj.dist <= MAGNETIC_BASTION_WIRE_HALF_WIDTH + e.radius) {
          g.lineStyle(1.8, COL_BONE, 0.9 * wireAlpha);
          g.strokeCircle(proj.cx, proj.cy, 8 + Math.sin(tSec * 22 + e.id) * 2);
        }
      }
    }
  }
}

function drawSecretChallengeCrystalOverlays(g: Gfx, sim: WorldSim, tSec: number): void {
  for (let i = 0; i < sim.npcEntities.length; i++) {
    const npc = sim.npcEntities[i]!;
    if (npc.kind !== 'secret_challenge_crystal') continue;

    if (npc.interacted) {
      g.lineStyle(1.4, COL_SLATE_MUTED, 0.3);
      g.strokeCircle(npc.x, npc.y + 4, 20);
      continue;
    }

    const pulse = Math.sin(tSec * 3.4 + npc.id) * 2.2;
    const ringR = 24 + pulse;
    g.fillStyle(COL_VIOLET, 0.14);
    g.fillCircle(npc.x, npc.y + 2, ringR + 4);
    g.lineStyle(2.0, COL_VIOLET, 0.82);
    g.strokeCircle(npc.x, npc.y + 2, ringR);
    g.lineStyle(1.3, COL_SOLAR_GOLD, 0.78);
    g.strokeCircle(npc.x, npc.y + 2, ringR * 0.72);

    // 4 orbiting prismatic motes around active challenge crystal
    for (let m = 0; m < 4; m++) {
      const ang = tSec * 2.2 + (m * Math.PI) / 2;
      const mx = npc.x + Math.cos(ang) * (ringR + 2);
      const my = npc.y + 2 + Math.sin(ang) * (ringR * 0.65);
      g.fillStyle(m % 2 === 0 ? COL_SOLAR_GOLD : COL_VIOLET, 0.92);
      g.fillCircle(mx, my, 2.4);
    }
  }
}

function drawP4BTransientBursts(g: Gfx, sim: WorldSim): void {
  const list = p4bTransientBurstsBySim.get(sim);
  if (!list || list.length === 0) return;

  for (let i = list.length - 1; i >= 0; i--) {
    const burst = list[i]!;
    const elapsed = sim.tick - burst.spawnTick;
    if (burst.roomId !== sim.currentRoomId || elapsed < 0 || elapsed > burst.durationTicks) {
      list.splice(i, 1);
      continue;
    }

    const prog = clamp(elapsed / Math.max(1, burst.durationTicks), 0, 1);
    const fade = 1 - prog;
    const curR = burst.radius * (0.35 + 0.65 * Math.sqrt(prog));

    if (burst.kind === 'cryo_shatter_spire_burst') {
      g.fillStyle(COL_FROST_CYAN, 0.16 * fade);
      g.fillCircle(burst.x, burst.y, curR);
      g.lineStyle(3.2, COL_INK, 0.65 * fade);
      g.strokeCircle(burst.x, burst.y, curR);
      g.lineStyle(2.2, COL_ICE_WHITE, 0.94 * fade);
      g.strokeCircle(burst.x, burst.y, curR);
      for (let s = 0; s < 8; s++) {
        const ang = (s * Math.PI) / 4;
        g.lineStyle(2.0, s % 2 === 0 ? COL_ICE_WHITE : COL_FROST_CYAN, 0.9 * fade);
        g.lineBetween(
          burst.x + Math.cos(ang) * (curR * 0.25),
          burst.y + Math.sin(ang) * (curR * 0.25),
          burst.x + Math.cos(ang) * (curR * 1.04),
          burst.y + Math.sin(ang) * (curR * 1.04),
        );
      }
    } else if (burst.kind === 'napalm_chain_plague_burst') {
      g.fillStyle(COL_FIRE_ORANGE, 0.15 * fade);
      g.fillCircle(burst.x, burst.y, curR);
      g.lineStyle(3.4, COL_INK, 0.68 * fade);
      g.strokeCircle(burst.x, burst.y, curR);
      g.lineStyle(2.4, COL_FIRE_ORANGE, 0.92 * fade);
      g.strokeCircle(burst.x, burst.y, curR);
      g.lineStyle(2.0, COL_LIME_BRIGHT, 0.88 * fade);
      g.strokeCircle(burst.x, burst.y, curR * 0.72);
      for (let s = 0; s < 10; s++) {
        const ang = (s * Math.PI * 2) / 10 + 0.15;
        const sr = curR * 0.88;
        g.fillStyle(s % 2 === 0 ? COL_FIRE_ORANGE : COL_LIME_VENOM, 0.88 * fade);
        g.fillCircle(burst.x + Math.cos(ang) * sr, burst.y + Math.sin(ang) * sr, 3.2 * fade + 1);
      }
    } else if (burst.kind === 'secret_trial_seal') {
      g.lineStyle(3.0, COL_VIOLET, 0.88 * fade);
      g.strokeCircle(burst.x, burst.y, curR);
      g.lineStyle(1.8, COL_SOLAR_GOLD, 0.84 * fade);
      g.strokeCircle(burst.x, burst.y, curR * 0.76);
    } else if (burst.kind === 'secret_trial_victory') {
      g.fillStyle(COL_SOLAR_GOLD, 0.14 * fade);
      g.fillCircle(burst.x, burst.y, curR);
      g.lineStyle(3.2, COL_SOLAR_GOLD, 0.95 * fade);
      g.strokeCircle(burst.x, burst.y, curR);
      for (let s = 0; s < 8; s++) {
        const ang = (s * Math.PI) / 4 + prog * 0.4;
        g.lineStyle(2.0, COL_BONE, 0.88 * fade);
        g.lineBetween(
          burst.x + Math.cos(ang) * (curR * 0.35),
          burst.y + Math.sin(ang) * (curR * 0.35),
          burst.x + Math.cos(ang) * (curR * 1.05),
          burst.y + Math.sin(ang) * (curR * 1.05),
        );
      }
    } else {
      g.lineStyle(2.2, COL_SLATE_MUTED, 0.75 * fade);
      g.strokeCircle(burst.x, burst.y, curR);
    }
  }
}

/**
 * Renders all 6 Phase 4B Duo Boon procedural VFX layers and Secret Challenge Arena world overlays.
 */
export function renderP4BDuoAndSecretArenaOverlays(scene: GameScene): void {
  const sim = resolveSimFromScene(scene);
  const g = (scene as unknown as { telegraphGraphics?: Gfx }).telegraphGraphics;
  if (!sim || !g) return;

  const addG = getOrCreateAdditiveOverlayGraphics(scene, g);
  const tSec = resolveP4BVisualTimeSec(scene, sim);

  // 1. Superheated Cyclone summons (when renderP4BDuoAndSecretArenaOverlays runs standalone in tests, draw base too if not yet drawn via summon loop; additive core always renders here)
  const isStandaloneMock = addG === g;
  for (let i = 0; i < sim.summons.length; i++) {
    const sum = sim.summons[i]!;
    if (sum.hp <= 0 || sum.ttlSec <= 0 || sum.kind !== 'superheated_cyclone') continue;
    if (isStandaloneMock) {
      drawSuperheatedCycloneBase(g, sim, sum, tSec);
    }
    drawSuperheatedCycloneAdditiveCore(addG, sim, sum, tSec);
  }

  // 2. Cryo Shatter Spires
  drawCryoShatterSpireOverlays(g, sim, tSec);

  // 3 & 4. Superconduct Rail magnetic rings + Napalm Chain Plague boiling resin
  drawSuperconductRailAndNapalmEnemyOverlays(g, sim, tSec);

  // 3b & 5. Superconduct Rail redirected tracers + Plasma Overload 6-pointed counter-rotating stars
  drawPlasmaStarAndRailProjectiles(g, addG, sim, tSec);

  // 6. Magnetic Bastion Ring high-voltage barricade arc wires
  drawMagneticBastionArcWires(g, sim, tSec);

  // 7. Secret Challenge Crystal rune halo & deterministic room-scoped transient bursts
  drawSecretChallengeCrystalOverlays(g, sim, tSec);
  drawP4BTransientBursts(g, sim);
}

/**
 * Handles Phase 4B Duo Boon explosions (`duo_cryo_shatter_spire`, `duo_napalm_chain_plague`)
 * and Secret Skill Arena lifecycle events (`secret_trial_started`, `secret_trial_resolved`).
 */
export function handleP4BSimEvent(scene: GameScene, ev: SimEvent): boolean {
  const sim = resolveSimFromScene(scene);
  if (!sim || sim.stressTestActive) return false;

  if (ev.kind === 'explosion') {
    if (
      ev.sourceDefId === 'duo_cryo_shatter_spire' ||
      ev.sourceDefId === 'duo_napalm_chain_plague'
    ) {
      const list = getTransientBurstList(sim);
      if (list.length >= 24) list.shift();
      const isCryo = ev.sourceDefId === 'duo_cryo_shatter_spire';
      list.push({
        kind: isCryo ? 'cryo_shatter_spire_burst' : 'napalm_chain_plague_burst',
        roomId: sim.currentRoomId,
        x: ev.x,
        y: ev.y,
        radius:
          ev.radius || (isCryo ? CRYO_SHATTER_SPIRE_BLAST_RADIUS : NAPALM_PLAGUE_BLAST_RADIUS),
        spawnTick: sim.tick,
        durationTicks: isCryo ? 16 : 20,
      });
    }
    return false;
  }

  if (ev.kind === 'secret_trial_started') {
    if (ev.roomId !== sim.currentRoomId) return true;
    const list = getTransientBurstList(sim);
    if (list.length >= 24) list.shift();
    list.push({
      kind: 'secret_trial_seal',
      roomId: sim.currentRoomId,
      x: ev.x,
      y: ev.y,
      radius: 170,
      spawnTick: sim.tick,
      durationTicks: 28,
    });
    if (scene.lighting?.spawnTransientLight) {
      scene.lighting.spawnTransientLight(ev.x, ev.y, 180, PALETTE.ELECTRIC_VIOLET, 0.9, 0.45);
      zzfx.play('portal_enter', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
    }
    return true;
  }

  if (ev.kind === 'secret_trial_resolved') {
    if (ev.roomId !== sim.currentRoomId) return true;
    const list = getTransientBurstList(sim);
    if (list.length >= 24) list.shift();
    list.push({
      kind: ev.victory ? 'secret_trial_victory' : 'secret_trial_expired',
      roomId: sim.currentRoomId,
      x: ev.x,
      y: ev.y,
      radius: ev.victory ? 190 : 135,
      spawnTick: sim.tick,
      durationTicks: ev.victory ? 36 : 24,
    });
    if (scene.lighting?.spawnTransientLight) {
      scene.lighting.spawnTransientLight(
        ev.x,
        ev.y,
        ev.victory ? 220 : 120,
        ev.victory ? PALETTE.SOLAR_GOLD : PALETTE.SILVER_BRIGHT,
        ev.victory ? 1.0 : 0.55,
        ev.victory ? 0.65 : 0.3,
      );
      zzfx.play(
        ev.victory ? 'chest_open' : 'ui_click',
        ev.x,
        scene.camFocusX,
        ev.y,
        scene.camFocusY,
      );
    }
    return true;
  }

  return false;
}
