import {
  SHOT_FLAG,
  clamp,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
  type SimSummonState,
  type SimTetherBeamState,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../art/palette.js';
import { getWeaponV2OverlayState } from './combat-fx-weapons-v2.js';

/**
 * Syncs Batch-1 & Batch-2 weapon room entities (enemies with stuckArrows/parasiticThorns,
 * active projectiles, life_blossom summons, tetherBeams, and live WorldSim reference) into the scene overlay state.
 */
export function syncBatch1WeaponRoomEntities(
  sceneKey: object,
  sim: {
    enemies: ReadonlyArray<SimEnemyState>;
    projectiles: ReadonlyArray<SimProjectileState>;
    summons: ReadonlyArray<SimSummonState>;
    tetherBeams: ReadonlyArray<SimTetherBeamState>;
  },
): void {
  const state = getWeaponV2OverlayState(sceneKey);
  state.syncedSim = sim as WorldSim;
  state.syncedEnemies = sim.enemies;
  state.syncedProjectiles = sim.projectiles;
  state.syncedSummons = sim.summons;
  state.syncedTetherBeams = sim.tetherBeams;
  if (sim.tetherBeams.length > 0) {
    state.lastTetherSnapshot = sim.tetherBeams.map((b) => ({ ...b }));
  }
}

/**
 * 1. Hunter Crossbow (Nỏ Săn Hàn Thiết):
 * Renders 1..4 distinct, Chiaroscuro dark-shear barbed cyan/steel arrows embedded in the enemy body.
 */
export function drawEnemyEmbeddedArrows(
  g: Phaser.GameObjects.Graphics,
  ex: number,
  ey: number,
  enemy: Pick<SimEnemyState, 'id' | 'radius' | 'aimAngle' | 'stuckArrows'>,
  playerX = ex + 60,
  playerY = ey,
  clockSec = 0,
): number {
  const arrows = clamp(enemy.stuckArrows ?? 0, 0, 4);
  if (arrows <= 0) return 0;

  const baseAng =
    Math.hypot(playerX - ex, playerY - ey) > 1e-3
      ? Math.atan2(playerY - ey, playerX - ex)
      : (enemy.aimAngle ?? 0) + Math.PI;
  const rStart = Math.max(4, enemy.radius * 0.32);
  const rEnd = enemy.radius + 14.5;

  for (let k = 0; k < arrows; k += 1) {
    const fanOffset =
      (k - (arrows - 1) * 0.5) * 0.38 + Math.sin(clockSec * 5.5 + k + enemy.id) * 0.03;
    const ang = baseAng + fanOffset;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const px = -sin;
    const py = cos;

    const tx = ex + cos * rStart;
    const ty = ey + sin * rStart;
    const bx = ex + cos * rEnd;
    const by = ey + sin * rEnd;

    // Chiaroscuro deep cryo-steel recessed shear shaft
    g.lineStyle(3.4, 0x071726, 0.92);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(bx, by);
    g.strokePath();

    // Glowing cyan/steel arrow shaft
    g.lineStyle(2.0, 0x38bdf8, 0.98);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(bx, by);
    g.strokePath();

    g.lineStyle(0.95, 0xfffdf5, 0.94);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(bx, by);
    g.strokePath();

    // Embedded barbed head & icy wound point
    g.fillStyle(0x38bdf8, 0.88);
    g.fillCircle(tx, ty, 2.3);
    g.lineStyle(1.6, 0x7dd3fc, 0.96);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx + cos * 4.8 + px * 3.3, ty + sin * 4.8 + py * 3.3);
    g.moveTo(tx, ty);
    g.lineTo(tx + cos * 4.8 - px * 3.3, ty + sin * 4.8 - py * 3.3);
    g.strokePath();

    // Crisp cyan-white V-shaped fletching feathers at tail
    const fx1 = bx - cos * 3.4;
    const fy1 = by - sin * 3.4;
    g.lineStyle(1.8, 0xbae6fd, 0.98);
    g.beginPath();
    g.moveTo(fx1, fy1);
    g.lineTo(bx + px * 4.0, by + py * 4.0);
    g.moveTo(fx1, fy1);
    g.lineTo(bx - px * 4.0, by - py * 4.0);
    g.strokePath();
  }

  return arrows;
}

/**
 * 2. Thorn Staff (Trượng Dây Gai Cộng Sinh):
 * Renders 1..5 glowing Chiaroscuro violet-emerald parasitic thorn buds pulsing on the enemy body.
 */
export function drawEnemyParasiticThorns(
  g: Phaser.GameObjects.Graphics,
  ex: number,
  ey: number,
  enemy: Pick<SimEnemyState, 'id' | 'radius' | 'parasiticThorns'>,
  clockSec = 0,
): number {
  const thorns = clamp(enemy.parasiticThorns ?? 0, 0, 5);
  if (thorns <= 0) return 0;

  const ringR = enemy.radius + 2.5;
  // Chiaroscuro dark venom-forest vine ring around torso
  g.lineStyle(2.8, 0x041a12, 0.86);
  g.strokeCircle(ex, ey, ringR);
  g.lineStyle(1.5, 0x10b981, 0.92);
  g.strokeCircle(ex, ey, ringR);

  for (let k = 0; k < thorns; k += 1) {
    const ang =
      -Math.PI * 0.5 +
      (k * Math.PI * 2) / Math.max(3, thorns) +
      Math.sin(clockSec * 3.0 + enemy.id) * 0.12;
    const pulse = Math.sin(clockSec * 9.0 + k * 1.4) * 1.1;
    const br = enemy.radius + 3.4 + pulse * 0.45;
    const bx = ex + Math.cos(ang) * br;
    const by = ey + Math.sin(ang) * br;
    const tipX = ex + Math.cos(ang) * (br + 7.2 + pulse);
    const tipY = ey + Math.sin(ang) * (br + 7.2 + pulse);

    // Chiaroscuro dark abyss + toxic violet-magenta pod + glowing lime core
    g.fillStyle(0x12051f, 0.94);
    g.fillCircle(bx, by, 4.8);
    g.fillStyle(0xc084fc, 0.96);
    g.fillCircle(bx, by, 3.5);
    g.fillStyle(0x4ade80, 0.98);
    g.fillCircle(bx, by, 2.0);

    // Sharp protruding parasitic thorn needle
    g.lineStyle(2.6, 0x12051f, 0.92);
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(tipX, tipY);
    g.strokePath();

    g.lineStyle(1.5, 0xfffdf5, 0.98);
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(tipX, tipY);
    g.strokePath();
  }

  return thorns;
}

export function drawEnemyBatch1Indicators(
  g: Phaser.GameObjects.Graphics,
  ex: number,
  ey: number,
  enemy: Pick<SimEnemyState, 'id' | 'radius' | 'aimAngle' | 'stuckArrows' | 'parasiticThorns'>,
  playerX: number,
  playerY: number,
  clockSec: number,
): void {
  if ((enemy.stuckArrows ?? 0) > 0) {
    drawEnemyEmbeddedArrows(g, ex, ey, enemy, playerX, playerY, clockSec);
  }
  if ((enemy.parasiticThorns ?? 0) > 0) {
    drawEnemyParasiticThorns(g, ex, ey, enemy, clockSec);
  }
}

/**
 * 6. Seed Gun (Súng Phóng Hạt Sinh Mệnh):
 * Renders lush bioluminescent Emerald/Gold Life Bud (life_blossom) with r = 88px perimeter-weighted
 * Chiaroscuro floor aura (< 0.06 interior opacity) routed to groundHazardGraphics (depth: 16).
 */
export function drawSeedGunLifeBlossom(
  g: Phaser.GameObjects.Graphics,
  sum: Pick<SimSummonState, 'id' | 'x' | 'y' | 'auraRadius'>,
  clockSec: number,
  groundG?: Phaser.GameObjects.Graphics,
): void {
  const floorG = groundG ?? g;
  const auraR = sum.auraRadius || 88;
  const pulse = Math.sin(clockSec * 6.5 + sum.id) * 2.0;
  const r = auraR + pulse;

  // r = 88px Perimeter-weighted Spore Aura at depth 16 (< 0.06 interior opacity)
  floorG.fillStyle(hexToNum(PALETTE.MINT_LIGHT), 0.045);
  floorG.fillCircle(sum.x, sum.y, r);
  floorG.lineStyle(3.0, 0x031812, 0.65);
  floorG.strokeCircle(sum.x, sum.y, r);
  floorG.lineStyle(1.9, hexToNum(PALETTE.LIME_GLOW), 0.88);
  floorG.strokeCircle(sum.x, sum.y, r);
  floorG.lineStyle(1.2, 0x2dd4bf, 0.48);
  floorG.strokeCircle(sum.x, sum.y, r * 0.86 - pulse * 0.35);

  // 8 perimeter-orbiting bioluminescent spore motes near outer 15% rim
  for (let m = 0; m < 8; m += 1) {
    const mAng = clockSec * 1.4 + (m * Math.PI) / 4 + sum.id;
    const mDist = auraR * (0.74 + (m % 2) * 0.16);
    const mx = sum.x + Math.cos(mAng) * mDist;
    const my = sum.y + Math.sin(mAng) * mDist;
    floorG.fillStyle(m % 2 === 0 ? 0x4ade80 : 0xfacc15, 0.78);
    floorG.fillCircle(mx, my, 2.0);
  }

  // Central Life Bud base & 6 glowing Chiaroscuro petals
  g.fillStyle(0x031812, 0.96);
  g.fillCircle(sum.x, sum.y, 16);
  for (let pIdx = 0; pIdx < 6; pIdx += 1) {
    const pAng = clockSec * 0.8 + (pIdx * Math.PI) / 3;
    const px = sum.x + Math.cos(pAng) * 9.5;
    const py = sum.y + Math.sin(pAng) * 9.5;
    g.fillStyle(0x031812, 0.95);
    g.fillCircle(px, py, 6.0);
    g.fillStyle(pIdx % 2 === 0 ? 0x10b981 : 0x2dd4bf, 0.96);
    g.fillCircle(px, py, 4.5);
  }

  // Radiant solar-gold stamen core
  g.fillStyle(hexToNum(PALETTE.LIME_GLOW), 0.98);
  g.fillCircle(sum.x, sum.y, 9.2);
  g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 1);
  g.fillCircle(sum.x, sum.y, 5.6);
  g.fillStyle(0xfffdf5, 0.96);
  g.fillCircle(sum.x - 1.5, sum.y - 1.5, 2.1);
}

/**
 * 7. Tether Staff (Trượng Dây Nối Điện):
 * Renders Chiaroscuro dark-core plasma/lightning cutting tether, slicing sparks, and color-coded anchor nodes.
 */
export function drawTetherStaffBeams(
  g: Phaser.GameObjects.Graphics,
  tetherBeams: ReadonlyArray<SimTetherBeamState>,
  clockSec: number,
): number {
  let drawn = 0;
  for (let i = 0; i < tetherBeams.length; i += 1) {
    const beam = tetherBeams[i]!;
    if (beam.ttlSec <= 0) continue;
    drawn += 1;

    const dx = beam.x2 - beam.x1;
    const dy = beam.y2 - beam.y1;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 1e-3 ? -dy / dist : 0;
    const ny = dist > 1e-3 ? dx / dist : 1;

    // 1. Chiaroscuro deep obsidian-indigo recessed channel + electric-violet plasma sheath + cyan wire + #FFFDF5 spine
    g.lineStyle(5.8, 0x0c0620, 0.76);
    g.beginPath();
    g.moveTo(beam.x1, beam.y1);
    g.lineTo(beam.x2, beam.y2);
    g.strokePath();

    g.lineStyle(3.8, hexToNum(PALETTE.ELECTRIC_VIOLET), 0.68);
    g.beginPath();
    g.moveTo(beam.x1, beam.y1);
    g.lineTo(beam.x2, beam.y2);
    g.strokePath();

    g.lineStyle(2.2, hexToNum(PALETTE.CYAN_FROST), 0.96);
    g.beginPath();
    g.moveTo(beam.x1, beam.y1);
    g.lineTo(beam.x2, beam.y2);
    g.strokePath();

    g.lineStyle(1.1, 0xfffdf5, 0.95);
    g.beginPath();
    g.moveTo(beam.x1, beam.y1);
    g.lineTo(beam.x2, beam.y2);
    g.strokePath();

    // 2. Two tight counter-oscillating electric filaments
    const segments = 7;
    for (let strand = 0; strand < 2; strand += 1) {
      const strandCol = strand === 0 ? 0xfacc15 : 0x7dd3fc;
      const sign = strand === 0 ? 1 : -1;
      g.lineStyle(1.4, strandCol, 0.9);
      g.beginPath();
      g.moveTo(beam.x1, beam.y1);
      for (let s = 1; s < segments; s += 1) {
        const t = s / segments;
        const jitter =
          Math.sin(clockSec * 34 + s * 2.1 + strand * 1.7 + beam.id) * 5.0 * sign;
        g.lineTo(beam.x1 + dx * t + nx * jitter, beam.y1 + dy * t + ny * jitter);
      }
      g.lineTo(beam.x2, beam.y2);
      g.strokePath();
    }

    // 3. Slicing plasma spark nodes traveling along the line
    for (let sp = 0; sp < 3; sp += 1) {
      const t = (clockSec * 2.8 + sp * 0.33 + beam.id * 0.17) % 1;
      const sx = beam.x1 + dx * t;
      const sy = beam.y1 + dy * t;
      g.fillStyle(0xfacc15, 0.95);
      g.fillCircle(sx, sy, 2.8);
      g.fillStyle(0xfffdf5, 0.98);
      g.fillCircle(sx, sy, 1.5);
    }

    // 4. Chiaroscuro Anchor Nodes at Player (x1, y1) and Target Anchor (x2, y2)
    const anchorColor =
      beam.targetKind === 'player'
        ? 0x38bdf8
        : beam.targetKind === 'summon'
          ? 0x4ade80
          : beam.targetKind === 'prop'
            ? 0xf97316
            : beam.targetKind === 'enemy'
              ? 0xf43f5e
              : 0xfacc15;
    const anchorPulse = 9.5 + Math.sin(clockSec * 14 + beam.id) * 1.8;

    g.fillStyle(0x0c0620, 0.92);
    g.fillCircle(beam.x1, beam.y1, 5.8);
    g.fillStyle(0x38bdf8, 0.96);
    g.fillCircle(beam.x1, beam.y1, 3.8);

    g.lineStyle(2.8, 0x0c0620, 0.88);
    g.strokeCircle(beam.x2, beam.y2, anchorPulse);
    g.lineStyle(1.9, anchorColor, 0.96);
    g.strokeCircle(beam.x2, beam.y2, anchorPulse);
    g.fillStyle(0x0c0620, 0.95);
    g.fillCircle(beam.x2, beam.y2, 5.8);
    g.fillStyle(anchorColor, 0.98);
    g.fillCircle(beam.x2, beam.y2, 4.0);
    g.fillStyle(0xfffdf5, 0.98);
    g.fillCircle(beam.x2, beam.y2, 1.9);
  }
  return drawn;
}

/**
 * Draws Chiaroscuro projectile trails & crisp armed indicators for active Batch-1 projectiles.
 */
export function drawBatch1ActiveProjectiles(
  g: Phaser.GameObjects.Graphics,
  projectiles: ReadonlyArray<SimProjectileState>,
  player: SimPlayerState,
  clockSec: number,
): void {
  for (let i = 0; i < projectiles.length; i += 1) {
    const b = projectiles[i]!;
    if (b.team !== 'player' || b.ttlSec <= 0) continue;
    const isFinale = ((b.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT) !== 0;
    const cos = Math.cos(b.angle);
    const sin = Math.sin(b.angle);
    const px = -sin;
    const py = cos;

    if (b.weaponId === 'hunter_crossbow') {
      const isCharged = b.damage >= 20 || b.pierceRemaining >= 2;
      const tailX = b.x - cos * (isCharged ? 24 : 16);
      const tailY = b.y - sin * (isCharged ? 24 : 16);
      g.lineStyle(isCharged ? 3.4 : 2.6, 0x071726, 0.82);
      g.beginPath();
      g.moveTo(tailX, tailY);
      g.lineTo(b.x + cos * 6, b.y + sin * 6);
      g.strokePath();

      g.lineStyle(isCharged ? 2.1 : 1.5, isFinale ? 0xfacc15 : 0x38bdf8, 0.95);
      g.beginPath();
      g.moveTo(tailX, tailY);
      g.lineTo(b.x + cos * 6, b.y + sin * 6);
      g.strokePath();
    } else if (b.weaponId === 'scrap_shotgun' && (isFinale || b.element === 'burn')) {
      g.lineStyle(2.4, 0xf97316, 0.88);
      g.beginPath();
      g.moveTo(b.x - cos * 16, b.y - sin * 16);
      g.lineTo(b.x, b.y);
      g.strokePath();
      g.fillStyle(0xfffdf5, 0.96);
      g.fillCircle(b.x, b.y, 2.6);
    } else if (b.weaponId === 'gale_smg_wind_blade') {
      g.lineStyle(3.4, 0x041f1c, 0.84);
      g.beginPath();
      g.arc(b.x, b.y, 16, b.angle - 1.05, b.angle + 1.05, false);
      g.strokePath();
      g.lineStyle(2.2, 0x2dd4bf, 0.96);
      g.beginPath();
      g.arc(b.x, b.y, 16, b.angle - 1.05, b.angle + 1.05, false);
      g.strokePath();
      g.lineStyle(1.1, 0xfffdf5, 0.94);
      g.beginPath();
      g.moveTo(b.x + px * 10, b.y + py * 10);
      g.lineTo(b.x - cos * 22 + px * 11, b.y - sin * 22 + py * 11);
      g.moveTo(b.x - px * 10, b.y - py * 10);
      g.lineTo(b.x - cos * 22 - px * 11, b.y - sin * 22 - py * 11);
      g.strokePath();
    } else if (b.weaponId === 'frag_launcher') {
      g.fillStyle(0x26080d, 0.94);
      g.fillCircle(b.x, b.y, 6.6);
      g.fillStyle(0xf97316, 0.96);
      g.fillCircle(b.x, b.y, 5.2);
      if (b.armedForAirburst) {
        const pulseR = 15 + Math.sin(clockSec * 20 + b.id) * 2.0;
        g.lineStyle(1.8, 0xfacc15, 0.92);
        g.strokeCircle(b.x, b.y, pulseR);
        g.lineStyle(1.2, 0xf97316, 0.28);
        g.strokeCircle(b.x, b.y, 104);
        g.lineStyle(1.5, 0xfffdf5, 0.9);
        g.beginPath();
        g.moveTo(b.x - pulseR - 4, b.y);
        g.lineTo(b.x - pulseR + 2, b.y);
        g.moveTo(b.x + pulseR - 2, b.y);
        g.lineTo(b.x + pulseR + 4, b.y);
        g.moveTo(b.x, b.y - pulseR - 4);
        g.lineTo(b.x, b.y - pulseR + 2);
        g.moveTo(b.x, b.y + pulseR - 2);
        g.lineTo(b.x, b.y + pulseR + 4);
        g.strokePath();
      }
    } else if (b.weaponId === 'frag_launcher_sub') {
      const arcLift = Math.sin(clamp(b.ttlSec / 0.35, 0, 1) * Math.PI) * 10;
      const rx = b.x;
      const ry = b.y - arcLift;
      g.lineStyle(2.2, 0xf97316, 0.88);
      g.beginPath();
      g.moveTo(b.x - cos * 12, b.y - sin * 12);
      g.lineTo(rx, ry);
      g.strokePath();
      g.fillStyle(0x26080d, 0.92);
      g.fillCircle(rx, ry, 4.6);
      g.fillStyle(0xfacc15, 0.98);
      g.fillCircle(rx, ry, 3.1);
    }
  }

  // Gale SMG spin-up wind ribbons around player feet (1:1 circular top-down)
  const activeWep = player.weaponSlots[player.activeWeaponSlot ?? 0];
  if (activeWep === 'gale_smg' && (player.fireHoldTimer ?? 0) > 0.25) {
    const spinA = clockSec * 12;
    g.lineStyle(1.5, 0x2dd4bf, 0.58);
    g.beginPath();
    g.arc(player.x, player.y + 4, 20, spinA, spinA + 1.6, false);
    g.strokePath();
    g.beginPath();
    g.arc(player.x, player.y + 4, 23, spinA + Math.PI, spinA + Math.PI + 1.6, false);
    g.strokePath();
  }
}
