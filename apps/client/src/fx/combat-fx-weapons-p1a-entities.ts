import {
  SHOT_FLAG,
  clamp,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
  type SimSummonState,
  type SimTetherBeamState,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../art/palette.js';
import { getWeaponV2OverlayState } from './combat-fx-weapons-v2.js';

/**
 * Syncs Batch-1 weapon room entities (enemies with stuckArrows/parasiticThorns,
 * active projectiles, life_blossom summons, and tetherBeams) into the scene overlay state.
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
 * Renders 1..4 distinct, high-contrast barbed cyan/steel arrows embedded in the enemy body.
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
  const rEnd = enemy.radius + 15;

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

    // Dark #141019 contrast outline shaft
    g.lineStyle(4.2, 0x141019, 0.95);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(bx, by);
    g.strokePath();

    // Glowing cyan/steel arrow shaft
    g.lineStyle(2.2, 0x38bdf8, 0.98);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(bx, by);
    g.strokePath();

    g.lineStyle(1.0, 0xfffdf5, 0.92);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(bx, by);
    g.strokePath();

    // Embedded barbed head & icy wound glow
    g.fillStyle(0x38bdf8, 0.85);
    g.fillCircle(tx, ty, 2.5);
    g.lineStyle(1.8, 0x7dd3fc, 0.96);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx + cos * 5 + px * 3.5, ty + sin * 5 + py * 3.5);
    g.moveTo(tx, ty);
    g.lineTo(tx + cos * 5 - px * 3.5, ty + sin * 5 - py * 3.5);
    g.strokePath();

    // Glowing cyan-white V-shaped fletching feathers at tail
    const fx1 = bx - cos * 3.5;
    const fy1 = by - sin * 3.5;
    g.lineStyle(2.0, 0x38bdf8, 0.98);
    g.beginPath();
    g.moveTo(fx1, fy1);
    g.lineTo(bx + px * 4.2, by + py * 4.2);
    g.moveTo(fx1, fy1);
    g.lineTo(bx - px * 4.2, by - py * 4.2);
    g.strokePath();
  }

  return arrows;
}

/**
 * 2. Thorn Staff (Trượng Dây Gai Cộng Sinh):
 * Renders 1..5 glowing violet-green parasitic thorn buds pulsing on the enemy body.
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
  // Creeping symbiotic vine ring around torso
  g.lineStyle(3.4, 0x141019, 0.88);
  g.strokeCircle(ex, ey, ringR);
  g.lineStyle(1.8, 0x22c55e, 0.9);
  g.strokeCircle(ex, ey, ringR);

  for (let k = 0; k < thorns; k += 1) {
    const ang =
      -Math.PI * 0.5 +
      (k * Math.PI * 2) / Math.max(3, thorns) +
      Math.sin(clockSec * 3.0 + enemy.id) * 0.12;
    const pulse = Math.sin(clockSec * 9.0 + k * 1.4) * 1.2;
    const br = enemy.radius + 3.5 + pulse * 0.5;
    const bx = ex + Math.cos(ang) * br;
    const by = ey + Math.sin(ang) * br;
    const tipX = ex + Math.cos(ang) * (br + 7.5 + pulse);
    const tipY = ey + Math.sin(ang) * (br + 7.5 + pulse);

    // Dark outline + toxic violet-magenta pod + glowing lime core
    g.fillStyle(0x141019, 0.96);
    g.fillCircle(bx, by, 5.2);
    g.fillStyle(0xc084fc, 0.96);
    g.fillCircle(bx, by, 3.8);
    g.fillStyle(0x4ade80, 0.98);
    g.fillCircle(bx, by, 2.2);

    // Sharp protruding parasitic thorn needle
    g.lineStyle(3.2, 0x141019, 0.95);
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(tipX, tipY);
    g.strokePath();

    g.lineStyle(1.8, 0xfef08a, 0.98);
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
 * Renders lush bioluminescent Emerald/Gold Life Bud (life_blossom) with r = 88px toxic spore aura.
 */
export function drawSeedGunLifeBlossom(
  g: Phaser.GameObjects.Graphics,
  sum: Pick<SimSummonState, 'id' | 'x' | 'y' | 'auraRadius'>,
  clockSec: number,
): void {
  const auraR = sum.auraRadius || 88;
  const pulse = Math.sin(clockSec * 6.5 + sum.id) * 2.5;
  const r = auraR + pulse;

  // r = 88px Toxic Spore Aura + Turquoise-Emerald harmonic ring
  g.fillStyle(hexToNum(PALETTE.MINT_LIGHT), 0.12);
  g.fillCircle(sum.x, sum.y, r);
  g.lineStyle(3.4, 0x141019, 0.45);
  g.strokeCircle(sum.x, sum.y, r);
  g.lineStyle(2.2, hexToNum(PALETTE.LIME_GLOW), 0.9);
  g.strokeCircle(sum.x, sum.y, r);
  g.lineStyle(1.4, 0x2dd4bf, 0.55);
  g.strokeCircle(sum.x, sum.y, r * 0.72 - pulse * 0.5);

  // 8 orbiting bioluminescent spore motes inside the 88px aura
  for (let m = 0; m < 8; m += 1) {
    const mAng = clockSec * 1.4 + (m * Math.PI) / 4 + sum.id;
    const mDist = auraR * (0.42 + (m % 2) * 0.34);
    const mx = sum.x + Math.cos(mAng) * mDist;
    const my = sum.y + Math.sin(mAng) * mDist;
    g.fillStyle(m % 2 === 0 ? 0x4ade80 : 0xfacc15, 0.78);
    g.fillCircle(mx, my, 2.2);
  }

  // Central Life Bud base & 6 glowing petals
  g.fillStyle(0x141019, 0.96);
  g.fillCircle(sum.x, sum.y, 16);
  for (let pIdx = 0; pIdx < 6; pIdx += 1) {
    const pAng = clockSec * 0.8 + (pIdx * Math.PI) / 3;
    const px = sum.x + Math.cos(pAng) * 9.5;
    const py = sum.y + Math.sin(pAng) * 9.5;
    g.fillStyle(0x141019, 0.95);
    g.fillCircle(px, py, 6.2);
    g.fillStyle(pIdx % 2 === 0 ? 0x4ade80 : 0x2dd4bf, 0.96);
    g.fillCircle(px, py, 4.6);
  }

  // Radiant solar-gold stamen core
  g.fillStyle(hexToNum(PALETTE.LIME_GLOW), 0.98);
  g.fillCircle(sum.x, sum.y, 9.5);
  g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 1);
  g.fillCircle(sum.x, sum.y, 5.8);
  g.fillStyle(0xfffdf5, 0.95);
  g.fillCircle(sum.x - 1.5, sum.y - 1.5, 2.2);
}

/**
 * 7. Tether Staff (Trượng Dây Nối Điện):
 * Renders multi-strand crackling plasma/lightning cutting tether, slicing sparks, and glowing anchor nodes.
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

    // 1. High-contrast #141019 backing + electric-violet plasma sheath + cyan-white laser wire
    g.lineStyle(8.5, 0x141019, 0.65);
    g.beginPath();
    g.moveTo(beam.x1, beam.y1);
    g.lineTo(beam.x2, beam.y2);
    g.strokePath();

    g.lineStyle(6.0, hexToNum(PALETTE.ELECTRIC_VIOLET), 0.55);
    g.beginPath();
    g.moveTo(beam.x1, beam.y1);
    g.lineTo(beam.x2, beam.y2);
    g.strokePath();

    g.lineStyle(3.0, hexToNum(PALETTE.CYAN_FROST), 0.96);
    g.beginPath();
    g.moveTo(beam.x1, beam.y1);
    g.lineTo(beam.x2, beam.y2);
    g.strokePath();

    g.lineStyle(1.4, 0xfffdf5, 0.92);
    g.beginPath();
    g.moveTo(beam.x1, beam.y1);
    g.lineTo(beam.x2, beam.y2);
    g.strokePath();

    // 2. Two counter-oscillating jagged lightning strands crackling along the tether
    const segments = 7;
    for (let strand = 0; strand < 2; strand += 1) {
      const strandCol = strand === 0 ? 0xfde047 : 0x7dd3fc;
      const sign = strand === 0 ? 1 : -1;
      g.lineStyle(1.8, strandCol, 0.92);
      g.beginPath();
      g.moveTo(beam.x1, beam.y1);
      for (let s = 1; s < segments; s += 1) {
        const t = s / segments;
        const jitter =
          Math.sin(clockSec * 34 + s * 2.1 + strand * 1.7 + beam.id) * 7.5 * sign;
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
      g.fillStyle(0xfde047, 0.95);
      g.fillCircle(sx, sy, 3.4);
      g.fillStyle(0xfffdf5, 0.98);
      g.fillCircle(sx, sy, 1.8);
    }

    // 4. Glowing Anchor Nodes at Player (x1, y1) and Target Anchor (x2, y2)
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
    const anchorPulse = 10 + Math.sin(clockSec * 14 + beam.id) * 2.2;

    g.fillStyle(0x141019, 0.92);
    g.fillCircle(beam.x1, beam.y1, 6.5);
    g.fillStyle(0x38bdf8, 0.96);
    g.fillCircle(beam.x1, beam.y1, 4.2);

    g.lineStyle(3.2, 0x141019, 0.9);
    g.strokeCircle(beam.x2, beam.y2, anchorPulse);
    g.lineStyle(2.2, anchorColor, 0.96);
    g.strokeCircle(beam.x2, beam.y2, anchorPulse);
    g.fillStyle(0x141019, 0.95);
    g.fillCircle(beam.x2, beam.y2, 6.5);
    g.fillStyle(anchorColor, 0.98);
    g.fillCircle(beam.x2, beam.y2, 4.5);
    g.fillStyle(0xfffdf5, 0.98);
    g.fillCircle(beam.x2, beam.y2, 2.2);
  }
  return drawn;
}

/**
 * Draws procedural projectile trails & armed indicators for active Batch-1 projectiles.
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
      const tailX = b.x - cos * (isCharged ? 26 : 18);
      const tailY = b.y - sin * (isCharged ? 26 : 18);
      g.lineStyle(isCharged ? 4.2 : 3.2, 0x141019, 0.85);
      g.beginPath();
      g.moveTo(tailX, tailY);
      g.lineTo(b.x + cos * 6, b.y + sin * 6);
      g.strokePath();

      g.lineStyle(isCharged ? 2.6 : 1.8, isFinale ? 0xfacc15 : 0x38bdf8, 0.95);
      g.beginPath();
      g.moveTo(tailX, tailY);
      g.lineTo(b.x + cos * 6, b.y + sin * 6);
      g.strokePath();
    } else if (b.weaponId === 'scrap_shotgun' && (isFinale || b.element === 'burn')) {
      g.lineStyle(2.8, 0xf97316, 0.88);
      g.beginPath();
      g.moveTo(b.x - cos * 18, b.y - sin * 18);
      g.lineTo(b.x, b.y);
      g.strokePath();
      g.fillStyle(0xfef08a, 0.96);
      g.fillCircle(b.x, b.y, 3.2);
    } else if (b.weaponId === 'gale_smg_wind_blade') {
      g.lineStyle(4.2, 0x141019, 0.85);
      g.beginPath();
      g.arc(b.x, b.y, 16, b.angle - 1.05, b.angle + 1.05, false);
      g.strokePath();
      g.lineStyle(2.6, 0x2dd4bf, 0.96);
      g.beginPath();
      g.arc(b.x, b.y, 16, b.angle - 1.05, b.angle + 1.05, false);
      g.strokePath();
      g.lineStyle(1.4, 0xfffdf5, 0.92);
      g.beginPath();
      g.moveTo(b.x + px * 10, b.y + py * 10);
      g.lineTo(b.x - cos * 24 + px * 12, b.y - sin * 24 + py * 12);
      g.moveTo(b.x - px * 10, b.y - py * 10);
      g.lineTo(b.x - cos * 24 - px * 12, b.y - sin * 24 - py * 12);
      g.strokePath();
    } else if (b.weaponId === 'frag_launcher') {
      g.fillStyle(0xf97316, 0.92);
      g.fillCircle(b.x, b.y, 6.2);
      if (b.armedForAirburst) {
        const pulseR = 16 + Math.sin(clockSec * 20 + b.id) * 2.5;
        g.lineStyle(2.2, 0xfacc15, 0.95);
        g.strokeCircle(b.x, b.y, pulseR);
        g.lineStyle(1.4, 0xf97316, 0.35);
        g.strokeCircle(b.x, b.y, 104);
        g.lineStyle(1.8, 0xfffdf5, 0.9);
        g.beginPath();
        g.moveTo(b.x - pulseR - 4, b.y);
        g.lineTo(b.x - pulseR + 3, b.y);
        g.moveTo(b.x + pulseR - 3, b.y);
        g.lineTo(b.x + pulseR + 4, b.y);
        g.moveTo(b.x, b.y - pulseR - 4);
        g.lineTo(b.x, b.y - pulseR + 3);
        g.moveTo(b.x, b.y + pulseR - 3);
        g.lineTo(b.x, b.y + pulseR + 4);
        g.strokePath();
      }
    } else if (b.weaponId === 'frag_launcher_sub') {
      const arcLift = Math.sin(clamp(b.ttlSec / 0.35, 0, 1) * Math.PI) * 14;
      const rx = b.x;
      const ry = b.y - arcLift;
      g.lineStyle(2.6, 0xf97316, 0.88);
      g.beginPath();
      g.moveTo(b.x - cos * 14, b.y - sin * 14);
      g.lineTo(rx, ry);
      g.strokePath();
      g.fillStyle(0x141019, 0.92);
      g.fillCircle(rx, ry, 5.2);
      g.fillStyle(0xfacc15, 0.98);
      g.fillCircle(rx, ry, 3.6);
    }
  }

  // Gale SMG spin-up wind ribbons around player feet when firing at high heat
  const activeWep = player.weaponSlots[player.activeWeaponSlot ?? 0];
  if (activeWep === 'gale_smg' && (player.fireHoldTimer ?? 0) > 0.25) {
    const spinA = clockSec * 12;
    g.lineStyle(1.8, 0x2dd4bf, 0.65);
    g.beginPath();
    g.arc(player.x, player.y + 4, 20, spinA, spinA + 1.8, false);
    g.strokePath();
    g.beginPath();
    g.arc(player.x, player.y + 4, 24, spinA + Math.PI, spinA + Math.PI + 1.8, false);
    g.strokePath();
  }
}
