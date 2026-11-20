import {
  clamp,
  ENEMIES,
  ENEMY_SPAWN_WARMUP_SEC,
  i18n,
  PLAYER_SLOT_COLORS,
  type SimEnemyState,
} from '@ashen-pact/shared';
import Phaser from 'phaser';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { getFreezeVisualTimeSec } from '../../core/visual-query.js';
import {
  computeEnemySpawnCircleSpec,
} from '../../fx/combat-fx.js';
import { isVisualFreezeActive } from '../../fx/combat-fx-blessings-p1d.js';
import {
  drawInscribedElementalistZone,
  drawRangerPredatorMarkChiaroscuro,
  drawVanguardRubyPhalanxShield,
  renderBastionPrismPlates,
  renderDownedReviveBrackets,
  renderIcePrisonBars,
} from '../../fx/combat-fx-classes.js';

export {
  renderBastionPrismPlates,
  renderDownedReviveBrackets,
  renderIcePrisonBars,
};
export {
  EXECUTIONER_WAVE_CRESCENT_DEPTH,
  renderExecutionerCrescentProjectile,
} from '../../fx/combat-fx-p2b.js';
export { renderBossPhaseInvulnCage } from './p11-drama-hud.js';
export { renderBossArmorShellPlates } from '../../fx/combat-fx-p3a.js';
export {
  stepBossKillTwoBeatSequence,
  type BossKillSequenceState,
} from '../../fx/combat-fx.js';
import { stepBossKillTwoBeatSequence } from '../../fx/combat-fx.js';
import { isBatch1WeaponRoomEntitiesSynced } from '../../fx/combat-fx-weapons-p1a-entities.js';
import {
  drawEnemyBatch1Indicators,
  drawTetherStaffBeams,
  syncBatch1WeaponRoomEntities,
  updateAndDrawWeaponV2Overlays,
} from '../../fx/combat-fx-weapons-v2.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { drawP2BWorldOverlays } from '../../fx/combat-fx-p2b.js';
import { drawP3APredictiveSightlinesAndOverlays } from '../../fx/combat-fx-p3a.js';
import {
  drawP4ATetherAndProjectileOverlays,
} from '../../fx/combat-fx-p4a.js';
import {
  renderP4BDuoAndSecretArenaOverlays,
} from '../../fx/combat-fx-p4b.js';
import { type GameScene, RIG_FOOT_OFFSET_Y } from '../GameScene.js';
import { drawFootMicroReloadBar } from './hud-micro-reload-bar.js';
import { drawWorldWeaponSalvageRing } from './hud-pact-and-forge-modals.js';
import { drawP11DramaWorldOverlays } from './p11-drama-hud.js';

const NUM_INK_DARK = hexToNum(PALETTE.INK_DARK);
const NUM_CYAN_FROST = hexToNum(PALETTE.CYAN_FROST);
const NUM_SOLAR_GOLD = hexToNum(PALETTE.SOLAR_GOLD);
const NUM_CRIMSON_BRIGHT = hexToNum(PALETTE.CRIMSON_BRIGHT);
const NUM_FLAME_ORANGE = hexToNum(PALETTE.FLAME_ORANGE);
const NUM_VOLT_YELLOW = hexToNum(PALETTE.VOLT_YELLOW);
const NUM_TOXIC_PURPLE = hexToNum(PALETTE.TOXIC_PURPLE);
const NUM_ELECTRIC_VIOLET = hexToNum(PALETTE.ELECTRIC_VIOLET);

const projRawXScratch: number[] = [];
const projRawYScratch: number[] = [];

export interface ScratchAimingSightline {
  x: number;
  y: number;
  angle: number;
  length: number;
  progress: number;
  stateTimer: number;
  distSqToPlayer: number;
}
export const scratchAimingSightlines: ScratchAimingSightline[] = [];
const aimingSightlinePool: ScratchAimingSightline[] = [];

function clearOverlayGraphicsIfNeeded(gfx: Phaser.GameObjects.Graphics | undefined): void {
  if (!gfx || typeof gfx.clear !== 'function') return;
  const cmdBuf = (gfx as unknown as { commandBuffer?: unknown }).commandBuffer;
  if (Array.isArray(cmdBuf)) {
    if (cmdBuf.length > 0) {
      gfx.clear();
    }
    return;
  }
  gfx.clear();
}

function syncOverlayGraphicsVisibility(gfx: Phaser.GameObjects.Graphics | undefined): void {
  if (!gfx || typeof gfx.setVisible !== 'function') return;
  const cmdBuf = (gfx as unknown as { commandBuffer?: unknown }).commandBuffer;
  if (!Array.isArray(cmdBuf)) return;
  const hasCommands = cmdBuf.length > 0;
  if (gfx.visible !== hasCommands) {
    gfx.setVisible(hasCommands);
  }
}

function unhideSharedFxGraphicsIfPopulated(gfx: Phaser.GameObjects.Graphics | undefined): void {
  if (!gfx || typeof gfx.setVisible !== 'function') return;
  const cmdBuf = (gfx as unknown as { commandBuffer?: unknown }).commandBuffer;
  if (!Array.isArray(cmdBuf)) return;
  if (cmdBuf.length > 0 && gfx.visible === false) {
    gfx.setVisible(true);
  }
}

export function withInterpolatedProjectilesAndPlayer<T>(
  scene: GameScene,
  sim: ReturnType<GameScene['transport']['getSim']>,
  playerX: number,
  playerY: number,
  fn: () => T,
): T {
  const getInterpProj = scene.transport?.getInterpolatedProjectilePos;
  const p = sim.player;
  const rawPx = p.x;
  const rawPy = p.y;
  const projs = sim.projectiles;
  const count = projs.length;
  const canInterpProj = typeof getInterpProj === 'function' && count > 0;
  if (canInterpProj) {
    const scratch = scene.entityPosScratch ?? { x: 0, y: 0 };
    for (let i = 0; i < count; i++) {
      const b = projs[i]!;
      projRawXScratch[i] = b.x;
      projRawYScratch[i] = b.y;
      const ip = getInterpProj.call(scene.transport, b, scratch);
      b.x = ip.x;
      b.y = ip.y;
    }
  }
  p.x = playerX;
  p.y = playerY;
  try {
    return fn();
  } finally {
    p.x = rawPx;
    p.y = rawPy;
    if (canInterpProj) {
      for (let i = 0; i < count; i++) {
        const b = projs[i];
        if (b) {
          b.x = projRawXScratch[i]!;
          b.y = projRawYScratch[i]!;
        }
      }
    }
  }
}

export function renderTelegraphsAndShieldImpl(this: GameScene, playerX: number, playerY: number): void {
  const sim = this.transport.getSim();
  const p = sim.player;
  const isStress = sim.stressTestActive;
  if (isStress && sim.tick % 4 !== 0) {
    return;
  }
  const g = this.telegraphGraphics;
  clearOverlayGraphicsIfNeeded(g);
  const floorG = this.groundHazardGraphics ?? g;
  if (this.groundHazardGraphics && this.groundHazardGraphics !== g) {
    clearOverlayGraphicsIfNeeded(this.groundHazardGraphics);
  }
  const enemyG = this.enemyGroundTelegraphGfx ?? floorG;
  if (this.enemyGroundTelegraphGfx && this.enemyGroundTelegraphGfx !== floorG) {
    clearOverlayGraphicsIfNeeded(this.enemyGroundTelegraphGfx);
  }
  clearOverlayGraphicsIfNeeded(this.icePrisonRearGraphics);
  clearOverlayGraphicsIfNeeded(this.bastionRearGraphics);
  clearOverlayGraphicsIfNeeded(this.icePrisonFrontGraphics);
  clearOverlayGraphicsIfNeeded(this.bastionFrontGraphics);
  clearOverlayGraphicsIfNeeded(this.bossOverGraphics);
  clearOverlayGraphicsIfNeeded(this.bossFractureGraphics);
  clearOverlayGraphicsIfNeeded(this.bossOverheadStunGraphics);
  clearOverlayGraphicsIfNeeded(this.executionerWaveGraphics);

  const view = this.cameras.main.worldView;
  const hasView = view && view.width > 0;
  const viewLeft = hasView ? view.x - 48 : -9999;
  const viewRight = hasView ? view.x + view.width + 48 : 9999;
  const viewTop = hasView ? view.y - 48 : -9999;
  const viewBottom = hasView ? view.y + view.height + 48 : 9999;
  const hudSafeTop = hasView ? view.y + 72 : 72;
  const hudSafeBottom = hasView ? view.y + view.height - 62 : 478;
  const freezeOverlay = isVisualFreezeActive(this);
  const overlayTimeSec = freezeOverlay ? getFreezeVisualTimeSec(sim.tick / 60, true) : sim.tick / 60;
  const overlayTick = freezeOverlay ? overlayTimeSec * 60 : sim.tick;

  // 0a. World Weapon Salvage Ring (reads raw sim.player coordinates)
  if (!isStress) {
    drawWorldWeaponSalvageRing(floorG, sim, p, overlayTimeSec);
  }

  withInterpolatedProjectilesAndPlayer(this, sim, playerX, playerY, () => {
    if (!isStress) {
      drawP2BWorldOverlays(this, g, sim, playerX, playerY);
    }

  if (this.roomTeleportAnimTimer > 0) {
    const dur = Math.max(0.01, this.roomTeleportAnimDuration || 0.28);
    const progress = 1 - clamp(this.roomTeleportAnimTimer / dur, 0, 1);
    const alpha = (1 - progress) * 0.9;
    const outerR = 14 + progress * 46;
    const innerR = 8 + (1 - progress) * 24;
    floorG.fillStyle(hexToNum(PALETTE.CYAN_FROST), alpha * 0.14);
    floorG.fillCircle(playerX, playerY + 4, outerR);
    floorG.lineStyle(3.2, hexToNum(PALETTE.INK_DARK), alpha * 0.75);
    floorG.strokeCircle(playerX, playerY + 4, outerR);
    floorG.lineStyle(2.2, hexToNum(PALETTE.CYAN_FROST), alpha);
    floorG.strokeCircle(playerX, playerY + 4, outerR);
    g.lineStyle(1.8, hexToNum(PALETTE.SOLAR_GOLD), alpha * 0.92);
    g.strokeCircle(playerX, playerY + 4, innerR);
  }

  // 1. Active Skills & Co-op Downed / Revive Circles for all players
  const allPlayers = sim.getAllPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const pl = allPlayers[i]!;
    let px = pl.x;
    let py = pl.y;
    if (pl.id === p.id) {
      px = playerX;
      py = playerY;
    } else {
      const interp = this.transport.getInterpolatedSimPlayerPos(pl, this.entityPosScratch);
      px = interp.x;
      py = interp.y;
    }

    if (pl.lifeState === 'downed') {
      renderDownedReviveBrackets(floorG, px, py, 64, pl.reviveProgress ?? 0);
    }

    if (pl.skillActiveTimer > 0) {
      if (pl.characterId === 'vanguard') {
        const isBastion = pl.blessingIds.includes('vanguard_bastion_prism');
        if (isBastion) {
          renderBastionPrismPlates(
            this.bastionRearGraphics ?? this.underActorGraphics ?? floorG,
            this.bastionFrontGraphics ?? this.telegraphGraphics ?? g,
            px,
            py,
            38,
            overlayTimeSec * 2.8,
            1.0,
          );
        } else {
          drawVanguardRubyPhalanxShield(
            g,
            px,
            py,
            pl.aimAngle,
            false,
            pl.shieldStoredBullets ?? 0,
            overlayTimeSec,
          );
        }
      }
    }
  }

  // 1a. Phase 5 Elementalist Skill Zones (Vùng Cầu Nguyên Tố + Xoáy Nguyên Tố — 1:1 inscribed arcane sigil at depth 16)
  for (let i = 0; i < sim.skillZones.length; i++) {
    const z = sim.skillZones[i]!;
    if (z.ttlSec <= 0) continue;
    drawInscribedElementalistZone(floorG, g, z, overlayTick, this.underActorGraphics);
  }

  // 1b. Phase 5 Summoned Entities (Cutout summons rendered via syncSummonCutoutVisuals; 1:1 circular floor aura & mini TTL/HP bar)
  for (let i = 0; i < sim.summons.length; i++) {
    const sum = sim.summons[i]!;
    if (sum.hp <= 0 || sum.ttlSec <= 0) continue;

    if (sum.kind === 'sacred_tree' || sum.kind === 'life_blossom') {
      const auraR = sum.auraRadius || 88;
      const auraCol = hexToNum(sum.kind === 'sacred_tree' ? PALETTE.LIME_GLOW : PALETTE.GOBLIN_GREEN);
      floorG.fillStyle(auraCol, 0.045);
      floorG.fillCircle(sum.x, sum.y, auraR);
      floorG.lineStyle(3.2, hexToNum(PALETTE.INK_DARK), 0.65);
      floorG.strokeCircle(sum.x, sum.y, auraR);
      floorG.lineStyle(1.8, auraCol, 0.85);
      floorG.strokeCircle(sum.x, sum.y, auraR);

      if (sum.kind === 'sacred_tree' && this.icePrisonRearGraphics) {
        this.icePrisonRearGraphics.fillStyle(hexToNum(PALETTE.INK_DARK), 0.55);
        this.icePrisonRearGraphics.fillCircle(sum.x, sum.y + 4, 16);
        this.icePrisonRearGraphics.fillStyle(0x3f6212, 0.75);
        this.icePrisonRearGraphics.fillCircle(sum.x, sum.y + 4, 13);
      }
    }

    // Mini TTL / HP bar above summon
    const barW = 28;
    const barY = sum.y - 28;
    const ttlRatio = clamp(sum.ttlSec / Math.max(1, sum.maxTtlSec), 0, 1);
    g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.9);
    g.fillRect(sum.x - barW / 2 - 1, barY - 1, barW + 2, 5);
    g.fillStyle(
      hexToNum(
        sum.kind === 'sacred_tree' || sum.kind === 'life_blossom'
          ? PALETTE.LIME_GLOW
          : PALETTE.VOLT_YELLOW,
      ),
      1,
    );
    g.fillRect(sum.x - barW / 2, barY, Math.max(2, barW * ttlRatio), 3);
  }

  // 1c. Contextual Ping World Rings
  for (let i = 0; i < sim.pings.length; i++) {
    const ping = sim.pings[i]!;
    const col = hexToNum(PLAYER_SLOT_COLORS[ping.playerSlot]);
    const waveR = 14 + ((sim.tick * 0.8) % 18);
    g.fillStyle(col, 0.22);
    g.fillCircle(ping.x, ping.y, 12);
    g.lineStyle(2.5, col, 0.95);
    g.strokeCircle(ping.x, ping.y, waveR);
    g.strokeCircle(ping.x, ping.y, 8);
  }

  // 1d. Phase 6 Co-op Dual Pressure Plates & Pushable Stone Blocks
  for (let i = 0; i < sim.pressurePlates.length; i++) {
    const plate = sim.pressurePlates[i]!;
    const isPressed = plate.pressed || sim.coopPuzzleCompleted;
    const plateCol = hexToNum(isPressed ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD);
    floorG.fillStyle(hexToNum(isPressed ? PALETTE.FOREST_SHADE : PALETTE.SLATE_DARK), 0.92);
    floorG.lineStyle(2.5, plateCol, 0.95);
    floorG.fillRoundedRect(plate.x - 18, plate.y - 18, 36, 36, 6);
    floorG.strokeRoundedRect(plate.x - 18, plate.y - 18, 36, 36, 6);
    floorG.fillStyle(plateCol, isPressed ? 0.95 : 0.45);
    floorG.fillCircle(plate.x, plate.y, 8);
  }

  // 1e. Phase P1A Tether Staff Energy Beams & Anchor Nodes (tether_staff)
  drawTetherStaffBeams(g, sim.tetherBeams, sim.tick / 60, sim.player.id);

  // 1f. Phase 6 Boss Forge Titan Expanding Shockwave Rings (Dash through with i-frames!)
  for (let i = 0; i < sim.shockwaveRings.length; i++) {
    const ring = sim.shockwaveRings[i]!;
    g.lineStyle(ring.thickness * 0.5 + 2.5, hexToNum(PALETTE.INK_DARK), 0.65);
    g.strokeCircle(ring.x, ring.y, ring.radius);
    g.lineStyle(ring.thickness * 0.45, hexToNum(PALETTE.FLAME_ORANGE), 0.72);
    g.strokeCircle(ring.x, ring.y, ring.radius);
    g.lineStyle(2.6, hexToNum(PALETTE.SOLAR_GOLD), 0.96);
    g.strokeCircle(ring.x, ring.y, ring.radius);
  }

  // 2. Enemy Spawn Circles, Attack Telegraphs, Boss Burrow Warning, Elite Aura & Mini HP Bars
  let hpBarsDrawn = 0;
  let telegraphsDrawn = 0;
  let sightlineCount = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0) continue;

    // Boss Phase 2 Burrow Telegraph Circle on floor under target position (1:1 hollow Chiaroscuro danger ring)
    if (e.bossBurrowed) {
      const r = e.telegraphRadius || 84;
      const progress =
        e.telegraphDurationSec > 0 ? 1 - clamp(e.stateTimer / e.telegraphDurationSec, 0, 1) : 1;
      enemyG.fillStyle(NUM_CRIMSON_BRIGHT, 0.06 + progress * 0.04);
      enemyG.fillCircle(e.bossTargetX, e.bossTargetY, r);
      enemyG.lineStyle(3.2, 0x141019, 0.95);
      enemyG.strokeCircle(e.bossTargetX, e.bossTargetY, r);
      enemyG.lineStyle(2.0, NUM_CRIMSON_BRIGHT, 0.96);
      enemyG.strokeCircle(e.bossTargetX, e.bossTargetY, r);
      continue;
    }

    const pos = this.transport.getInterpolatedEnemyPos(e, this.entityPosScratch);
    if (pos.x < viewLeft || pos.x > viewRight || pos.y < viewTop || pos.y > viewBottom) {
      continue;
    }

    if (e.defId === 'ice_prison') {
      renderIcePrisonBars(
        this.icePrisonRearGraphics ?? floorG,
        this.icePrisonFrontGraphics ?? g,
        pos.x,
        pos.y,
        clamp(e.hp / Math.max(1, e.maxHp), 0, 1),
      );
    }

    // 0.8s Rotating 1:1 Arcane Rune Summoning Circle on Floor + Rising Motes
    if (e.aiState === 'spawning') {
      const progress = 1 - clamp(e.stateTimer / ENEMY_SPAWN_WARMUP_SEC, 0, 1);
      const spec = computeEnemySpawnCircleSpec(e.radius, progress, e.isElite, e.isBoss);
      const primaryNum = hexToNum(spec.primaryColorHex);
      const coreNum = hexToNum(spec.coreColorHex);

      // 1. Outer & inner 1:1 arcane rings on floor (depth 16)
      floorG.fillStyle(primaryNum, 0.05 + 0.04 * progress);
      floorG.fillCircle(pos.x, pos.y, spec.outerRadius * progress);
      floorG.lineStyle(3.8, NUM_INK_DARK, 0.68);
      floorG.strokeCircle(pos.x, pos.y, spec.outerRadius);
      floorG.lineStyle(2.4, primaryNum, 0.92);
      floorG.strokeCircle(pos.x, pos.y, spec.outerRadius);
      floorG.lineStyle(1.4, coreNum, 0.82);
      floorG.strokeCircle(pos.x, pos.y, spec.innerRadius);

      // 2. Inscribed counter-rotating hexagram (2 equilateral triangles) & orbiting rune ticks on floor
      if (!isStress) {
        const triAngles: readonly [number, number] = [
          spec.runeRotationRad,
          spec.counterRuneRotationRad + Math.PI / 3,
        ];
        for (let tIdx = 0; tIdx < 2; tIdx++) {
          const baseAng = triAngles[tIdx]!;
          floorG.lineStyle(1.3, tIdx === 0 ? primaryNum : coreNum, 0.78);
          floorG.beginPath();
          for (let v = 0; v <= 3; v++) {
            const ang = baseAng + ((v % 3) * Math.PI * 2) / 3;
            const vx = pos.x + Math.cos(ang) * spec.innerRadius;
            const vy = pos.y + Math.sin(ang) * spec.innerRadius;
            if (v === 0) floorG.moveTo(vx, vy);
            else floorG.lineTo(vx, vy);
          }
          floorG.strokePath();
        }

        for (let rIdx = 0; rIdx < spec.runeCount; rIdx++) {
          const rAng = spec.runeRotationRad + (rIdx * Math.PI * 2) / spec.runeCount;
          const rx1 = pos.x + Math.cos(rAng) * (spec.innerRadius + 1.5);
          const ry1 = pos.y + Math.sin(rAng) * (spec.innerRadius + 1.5);
          const rx2 = pos.x + Math.cos(rAng) * (spec.outerRadius + 2.5);
          const ry2 = pos.y + Math.sin(rAng) * (spec.outerRadius + 2.5);
          floorG.lineStyle(1.8, rIdx % 2 === 0 ? coreNum : primaryNum, 0.86);
          floorG.lineBetween(rx1, ry1, rx2, ry2);
        }
      }

      // 3. Compact top-down convergence motes
      for (let m = 0; m < 3; m++) {
        const mPhase = (progress * 1.8 + m * 0.33) % 1;
        const mAng = spec.runeRotationRad * 2 + (m * Math.PI * 2) / 3;
        const mRad = spec.outerRadius * (1 - mPhase * 0.75);
        const mx = pos.x + Math.cos(mAng) * mRad;
        const my = pos.y + Math.sin(mAng) * mRad;
        g.fillStyle(coreNum, (1 - mPhase * 0.5) * 0.92);
        g.fillCircle(mx, my, 2.0);
      }
      continue;
    }

    // Directional Front Shield Arc for Ice Golem & Iron Shielder (must flank behind!)
    const eStats = ENEMIES[e.defId];
    if (eStats?.frontShieldReduction && !isStress) {
      const halfArc = Math.PI * 0.4;
      const shieldR = e.radius + 6;
      const shieldHex = e.defId === 'ice_golem' ? PALETTE.CYAN_FROST : PALETTE.STEEL_LIGHT;
      g.lineStyle(5, NUM_INK_DARK, 0.88);
      g.beginPath();
      g.arc(pos.x, pos.y, shieldR, e.aimAngle - halfArc, e.aimAngle + halfArc, false);
      g.strokePath();
      g.lineStyle(3, hexToNum(shieldHex), 0.95);
      g.beginPath();
      g.arc(pos.x, pos.y, shieldR, e.aimAngle - halfArc, e.aimAngle + halfArc, false);
      g.strokePath();
    }

    // Stunned Overhead Cutout 4-Point Stars (replaces full-torso yellow wireframe hoop)
    if (e.aiState === 'stunned' && e.stateTimer > 0) {
      const headY = pos.y - (e.isBoss ? 50 : 34);
      const orbitRx = e.isBoss ? 18 : 12;
      const orbitRy = e.isBoss ? 5.5 : 4.0;
      const basePhase = overlayTick * 0.14;
      for (let sIdx = 0; sIdx < 2; sIdx++) {
        const ang = basePhase + sIdx * Math.PI;
        const sx = pos.x + Math.cos(ang) * orbitRx;
        const sy = headY + Math.sin(ang) * orbitRy;
        const outerR = e.isBoss ? 6.2 : 4.8;
        const innerR = outerR * 0.34;
        g.fillStyle(NUM_VOLT_YELLOW, 0.96);
        g.lineStyle(2.2, NUM_INK_DARK, 0.94);
        g.beginPath();
        for (let pIdx = 0; pIdx < 8; pIdx++) {
          const pa = (pIdx * Math.PI) / 4;
          const pr = pIdx % 2 === 0 ? outerR : innerR;
          const px = sx + Math.cos(pa) * pr;
          const py = sy + Math.sin(pa) * pr;
          if (pIdx === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fillPath();
        g.strokePath();
      }
    }

    // Elite Grounded 2.12:1 Cutout Foot-Crescents & Compact Flank Shield Brackets
    if (e.isElite && !isStress) {
      const mod =
        e.eliteModifier ?? ((e as { p11PreferredModifier?: string }).p11PreferredModifier ?? null);
      const auraCol =
        mod === 'vengeful'
          ? NUM_ELECTRIC_VIOLET
          : mod === 'volley'
            ? NUM_FLAME_ORANGE
            : NUM_SOLAR_GOLD;
      const footY = pos.y + 10;
      const rx = e.radius + 6;
      const ry = rx / 2.12;
      for (let side = 0; side < 2; side++) {
        const a0 = side === 0 ? -Math.PI * 0.36 : Math.PI * 0.64;
        const a1 = side === 0 ? Math.PI * 0.36 : Math.PI * 1.36;
        for (let pass = 0; pass < 2; pass++) {
          floorG.lineStyle(
            pass === 0 ? 4.4 : 2.1,
            pass === 0 ? NUM_INK_DARK : auraCol,
            pass === 0 ? 0.86 : 0.92,
          );
          floorG.beginPath();
          for (let seg = 0; seg <= 8; seg++) {
            const a = a0 + ((a1 - a0) * seg) / 8;
            const px = pos.x + Math.cos(a) * rx;
            const py = footY + Math.sin(a) * ry;
            if (seg === 0) floorG.moveTo(px, py);
            else floorG.lineTo(px, py);
          }
          floorG.strokePath();
        }
      }
      if (mod === 'vengeful' || mod === 'volley') {
        for (const sideSign of [-1, 1]) {
          const tx = pos.x + sideSign * (rx + 2.5);
          floorG.lineStyle(3.4, NUM_INK_DARK, 0.85);
          floorG.beginPath();
          floorG.moveTo(tx, footY - 3.5);
          floorG.lineTo(tx + sideSign * 3.5, footY);
          floorG.lineTo(tx, footY + 3.5);
          floorG.strokePath();
          floorG.lineStyle(1.7, NUM_SOLAR_GOLD, 0.92);
          floorG.beginPath();
          floorG.moveTo(tx, footY - 3.5);
          floorG.lineTo(tx + sideSign * 3.5, footY);
          floorG.lineTo(tx, footY + 3.5);
          floorG.strokePath();
        }
      }
      if (e.shieldArmor > 0) {
        const shR = e.radius + 5;
        for (const baseAng of [0, Math.PI]) {
          for (let pass = 0; pass < 2; pass++) {
            g.lineStyle(
              pass === 0 ? 4.2 : 2.0,
              pass === 0 ? NUM_INK_DARK : NUM_CYAN_FROST,
              pass === 0 ? 0.88 : 0.95,
            );
            g.beginPath();
            for (let seg = 0; seg <= 6; seg++) {
              const a = baseAng - 0.42 + (0.84 * seg) / 6;
              const px = pos.x + Math.cos(a) * shR;
              const py = pos.y + Math.sin(a) * shR;
              if (seg === 0) g.moveTo(px, py);
              else g.lineTo(px, py);
            }
            g.strokePath();
          }
        }
      }
    }

    // Druid Rooted 1:1 circular thorn collar on floor (zero 3/4 squash ellipse)
    if (e.rootedTimer > 0 && !isStress) {
      floorG.lineStyle(4.2, NUM_INK_DARK, 0.72);
      floorG.strokeCircle(pos.x, pos.y + 2, e.radius + 4);
      floorG.lineStyle(2.4, hexToNum(PALETTE.LIME_GLOW), 0.92);
      floorG.strokeCircle(pos.x, pos.y + 2, e.radius + 4);
    }

    // Ranger Predator Mark Crosshair above enemy (visible through Fog of War!)
    if (e.markedTimer > 0 && !isStress) {
      const markY = pos.y - (e.isBoss ? 54 : 40);
      drawRangerPredatorMarkChiaroscuro(g, pos.x, markY, overlayTick);
    }

    // Phase P1A Batch-1 Embedded Arrows (hunter_crossbow) & Parasitic Thorns (thorn_staff)
    if (!isStress) {
      drawEnemyBatch1Indicators(g, pos.x, pos.y, e, playerX, playerY, overlayTimeSec);
    }

    // Enemy Attack Telegraphs (Section 3.7: high readability #E84545 danger perimeters, <=0.10 floor fill)
    if (e.aiState === 'telegraph' && (!isStress || telegraphsDrawn < 4)) {
      telegraphsDrawn += 1;
      const progress =
        e.telegraphDurationSec > 0 ? 1 - clamp(e.stateTimer / e.telegraphDurationSec, 0, 1) : 1;

      if (
        e.defId === 'goblin_shooter' ||
        e.defId === 'frost_bat' ||
        e.defId === 'kryssa_ice_queen' ||
        e.defId === 'kryssa_clone' ||
        e.defId === 'ice_mage' ||
        e.defId === 'goblin_shaman' ||
        e.defId === 'green_slime' ||
        e.defId === 'mini_slime' ||
        e.defId === 'fire_imp' ||
        e.defId === 'iron_shielder' ||
        e.defId === 'welder_drone' ||
        e.defId === 'thorn_turret'
      ) {
        // Collect single unified sightline per aiming enemy (pooled in place)
        const defaultLen =
          e.defId === 'kryssa_ice_queen' || e.defId === 'kryssa_clone' || e.defId === 'ice_mage'
            ? 320
            : e.defId === 'goblin_shooter' || e.defId === 'frost_bat'
              ? 240
              : e.defId === 'thorn_turret'
                ? 180
                : 160;
        const len = e.telegraphLength || defaultLen;
        const dx = pos.x - playerX;
        const dy = pos.y - playerY;
        const distSq = dx * dx + dy * dy;
        let slot = aimingSightlinePool[sightlineCount];
        if (!slot) {
          slot = {
            x: 0,
            y: 0,
            angle: 0,
            length: 0,
            progress: 0,
            stateTimer: 0,
            distSqToPlayer: 0,
          };
          aimingSightlinePool[sightlineCount] = slot;
        }
        slot.x = pos.x;
        slot.y = pos.y;
        slot.angle = e.telegraphAngle;
        slot.length = len;
        slot.progress = progress;
        slot.stateTimer = e.stateTimer;
        slot.distSqToPlayer = distSq;
        scratchAimingSightlines[sightlineCount] = slot;
        sightlineCount += 1;
      } else if (e.defId === 'wild_boar' || e.defId === 'baby_yeti') {
        const len = e.telegraphLength || 220;
        const halfW = e.radius;
        const cos = Math.cos(e.telegraphAngle);
        const sin = Math.sin(e.telegraphAngle);
        const px = -sin * halfW;
        const py = cos * halfW;

        const p1x = pos.x + px;
        const p1y = pos.y + py;
        const p2x = pos.x + cos * len + px;
        const p2y = pos.y + sin * len + py;
        const p3x = pos.x + cos * len - px;
        const p3y = pos.y + sin * len - py;
        const p4x = pos.x - px;
        const p4y = pos.y - py;

        enemyG.fillStyle(NUM_CRIMSON_BRIGHT, 0.06 + progress * 0.04);
        enemyG.beginPath();
        enemyG.moveTo(p1x, p1y);
        enemyG.lineTo(p2x, p2y);
        enemyG.lineTo(p3x, p3y);
        enemyG.lineTo(p4x, p4y);
        enemyG.closePath();
        enemyG.fillPath();

        enemyG.lineStyle(3.2, 0x141019, 0.95);
        enemyG.strokePath();
        enemyG.lineStyle(2.0, NUM_CRIMSON_BRIGHT, 0.96);
        enemyG.strokePath();
      } else if (
        e.defId === 'spore_bomber' ||
        e.defId === 'spore_king' ||
        e.defId === 'snow_spirit' ||
        e.defId === 'ice_golem' ||
        e.defId === 'dwarf_cannon' ||
        e.defId === 'coal_golem' ||
        e.defId === 'forge_titan'
      ) {
        const r = e.telegraphRadius || (e.isBoss ? 96 : 68);
        enemyG.fillStyle(NUM_CRIMSON_BRIGHT, 0.06 + progress * 0.04);
        enemyG.fillCircle(pos.x, pos.y, r);
        enemyG.lineStyle(3.2, 0x141019, 0.95);
        enemyG.strokeCircle(pos.x, pos.y, r);
        enemyG.lineStyle(2.0, NUM_CRIMSON_BRIGHT, 0.96);
        enemyG.strokeCircle(pos.x, pos.y, r);
      }
    }

    // Floating HP bar above non-dummy enemies or enemies with active elemental status (clipped to HUD safe bounds)
    const hasStatus =
      e.burnTimer > 0 ||
      e.chillStacks > 0 ||
      e.frozenTimer > 0 ||
      e.poisonStacks > 0 ||
      e.shockTimer > 0 ||
      e.markedTimer > 0 ||
      e.superconductTimer > 0 ||
      e.rootedTimer > 0;
    const barY = pos.y - (e.isBoss ? 44 : 30);
    if (
      barY - 8 >= hudSafeTop &&
      barY + 8 <= hudSafeBottom &&
      ((!e.isDummy && e.hp < e.maxHp) || hasStatus || e.isElite) &&
      (!isStress || hpBarsDrawn < 8)
    ) {
      this.drawEnemyHealthAndStatusBar(g, pos.x, barY, e);
      hpBarsDrawn += 1;
    }
  }
  scratchAimingSightlines.length = sightlineCount;

  // 2a. Top-8 Enemy Sniper Sightlines unified onto telegraphGraphics (depth 46.0)
  if (sightlineCount > 0 && this.telegraphGraphics) {
    if (sightlineCount > 1) {
      scratchAimingSightlines.sort((a, b) => {
        if (Math.abs(a.stateTimer - b.stateTimer) > 0.001) {
          return a.stateTimer - b.stateTimer;
        }
        return a.distSqToPlayer - b.distSqToPlayer;
      });
    }
    const cap = Math.min(sightlineCount, 8);
    for (let k = 0; k < cap; k++) {
      const s = scratchAimingSightlines[k]!;
      const tx = s.x + Math.cos(s.angle) * s.length;
      const ty = s.y + Math.sin(s.angle) * s.length;

      // Cutout #141019 border (5.2) + #E84545 core (2.0) -> 1.6px ink border per side
      this.telegraphGraphics.lineStyle(5.2, 0x141019, 0.45 + s.progress * 0.45);
      this.telegraphGraphics.beginPath();
      this.telegraphGraphics.moveTo(s.x, s.y);
      this.telegraphGraphics.lineTo(tx, ty);
      this.telegraphGraphics.strokePath();

      this.telegraphGraphics.lineStyle(2.0, 0xe84545, 0.65 + s.progress * 0.35);
      this.telegraphGraphics.beginPath();
      this.telegraphGraphics.moveTo(s.x, s.y);
      this.telegraphGraphics.lineTo(tx, ty);
      this.telegraphGraphics.strokePath();
    }
  }

  // 2b. Phase 3A (P3A.1) 0.35s Predictive Sightline Telegraph (#FF5722 outer + #FFF7ED bright core + muzzle diamond reticle)
  drawP3APredictiveSightlinesAndOverlays(this, g, sim);
  if (!isStress) {
    drawP4ATetherAndProjectileOverlays(this, g, sim);
    renderP4BDuoAndSecretArenaOverlays(this);
  }

  // 3. Boss Kill 2-Beat Sequence (Beat 1: chest fracture rays; Beat 2: twin crescents)
  if (this.fx.bossKillSequenceState?.active) {
    stepBossKillTwoBeatSequence(this.fx, this.lastRawDtSec ?? (1 / 60));
  }

  // 4. Phase P11 Drama World Overlays (Boss Phase Transition Invuln/Roar, Boss Soft Enrage Aura, Vengeful Rings, Overlapping Wave Circles)
  drawP11DramaWorldOverlays(this);

  // 5. Phase P0B & P1A Weapon V2 / Tactical Overlays + 32x5px Foot Micro-Reload Bar
  if (!isStress) {
    const isSoloPaused =
      (this.pauseModalOpen || (this.settingsModal?.isOpen() ?? false)) && this.coopMode === 'solo';
    if (!isBatch1WeaponRoomEntitiesSynced(this, sim)) {
      syncBatch1WeaponRoomEntities(this, sim);
    }
    const v2Flash = updateAndDrawWeaponV2Overlays(
      this,
      g,
      this.fx,
      p,
      sim.magneticRivets ?? [],
      isSoloPaused ? 0 : 1 / 60,
      overlayTimeSec,
      i18n.getLocale(),
      floorG,
      this.underActorGraphics,
      this.weaponRibbonGraphics,
    );
    drawFootMicroReloadBar(
      g,
      playerX,
      playerY + RIG_FOOT_OFFSET_Y + 6,
      p,
      undefined,
      v2Flash.flashColor,
      v2Flash.flashAlpha,
    );
  }
  });

  syncOverlayGraphicsVisibility(this.icePrisonRearGraphics);
  syncOverlayGraphicsVisibility(this.bastionRearGraphics);
  syncOverlayGraphicsVisibility(this.icePrisonFrontGraphics);
  syncOverlayGraphicsVisibility(this.bastionFrontGraphics);
  syncOverlayGraphicsVisibility(this.bossOverGraphics);
  syncOverlayGraphicsVisibility(this.bossFractureGraphics);
  syncOverlayGraphicsVisibility(this.bossOverheadStunGraphics);
  syncOverlayGraphicsVisibility(this.executionerWaveGraphics);
  syncOverlayGraphicsVisibility(this.enemyGroundTelegraphGfx);
  syncOverlayGraphicsVisibility(this.groundHazardGraphics);
  syncOverlayGraphicsVisibility(this.telegraphGraphics);
  unhideSharedFxGraphicsIfPopulated(this.underActorGraphics);
  unhideSharedFxGraphicsIfPopulated(this.weaponRibbonGraphics);
}

function drawStatusDiamondPip(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  colorNum: number,
): void {
  g.fillStyle(colorNum, 1);
  if (typeof g.fillTriangle === 'function') {
    g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r);
    g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r);
  } else {
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}

export function drawEnemyHealthAndStatusBarImpl(
  this: GameScene,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  e: SimEnemyState,
): void {
  const w = e.isBoss ? 52 : e.isElite ? 36 : 28;
  const h = e.isBoss ? 6 : 5;
  const ratio = clamp(e.hp / e.maxHp, 0, 1);

  g.fillStyle(NUM_INK_DARK, 0.9);
  g.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);

  g.fillStyle(
    e.frozenTimer > 0
      ? NUM_CYAN_FROST
      : e.isElite
        ? NUM_SOLAR_GOLD
        : NUM_CRIMSON_BRIGHT,
    1,
  );
  g.fillRect(x - w / 2, y, Math.max(2, w * ratio), h);

  if (e.shieldArmor > 0 && e.maxShieldArmor > 0) {
    const sRatio = clamp(e.shieldArmor / e.maxShieldArmor, 0, 1);
    g.fillStyle(NUM_CYAN_FROST, 0.95);
    g.fillRect(x - w / 2, y - 3, Math.max(2, w * sRatio), 2);
  }

  // Earcut-free elemental status diamond pips above HP bar
  let pipX = x - 12;
  const pipY = y - 6;
  if (e.burnTimer > 0) {
    drawStatusDiamondPip(g, pipX, pipY, 2.5, NUM_FLAME_ORANGE);
    pipX += 6;
  }
  if (e.frozenTimer > 0 || e.chillStacks > 0) {
    drawStatusDiamondPip(g, pipX, pipY, e.frozenTimer > 0 ? 3.2 : 2.5, NUM_CYAN_FROST);
    pipX += 6;
  }
  if (e.shockTimer > 0) {
    drawStatusDiamondPip(g, pipX, pipY, 2.5, NUM_VOLT_YELLOW);
    pipX += 6;
  }
  if (e.poisonStacks > 0) {
    drawStatusDiamondPip(g, pipX, pipY, 2.5, NUM_TOXIC_PURPLE);
    pipX += 6;
  }
  if (e.superconductTimer > 0) {
    drawStatusDiamondPip(g, pipX, pipY, 2.5, NUM_ELECTRIC_VIOLET);
    pipX += 6;
  }
  if (e.markedTimer > 0) {
    drawStatusDiamondPip(g, pipX, pipY, 2.8, NUM_SOLAR_GOLD);
  }
}

export function renderHitboxesIfEnabledImpl(this: GameScene): void {
  const debug = initGlobalDebugState();
  if (!debug.showHitboxes) return;

  const g = this.hitboxGraphics;
  g.clear();
  const sim = this.transport.getSim();

  // Spatial hash 64x64 grid lines
  g.lineStyle(1, 0x38bdf8, 0.18);
  for (let x = 0; x <= sim.map.width; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, sim.map.height);
    g.strokePath();
  }
  for (let y = 0; y <= sim.map.height; y += 64) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(sim.map.width, y);
    g.strokePath();
  }

  // Solid wall/pillar AABBs
  g.lineStyle(1.2, 0xfacc15, 0.45);
  for (const box of sim.map.solidBoxes) {
    g.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
  }

  // Player collision circle
  const pPos = this.transport.getInterpolatedPlayerPos(this.entityPosScratch);
  g.lineStyle(2, 0x4ade80, 0.95);
  g.strokeCircle(pPos.x, pPos.y, sim.player.radius);

  // Props collision circles
  g.lineStyle(1.8, 0xf97316, 0.9);
  for (const prop of sim.props) {
    if (prop.hp > 0) {
      g.strokeCircle(prop.x, prop.y, prop.radius);
    }
  }

  // Enemy collision circles
  g.lineStyle(2, 0xfb7185, 0.95);
  for (const e of sim.enemies) {
    if (e.hp > 0) {
      const ePos = this.transport.getInterpolatedEnemyPos(e, this.entityPosScratch);
      g.strokeCircle(ePos.x, ePos.y, e.radius);
    }
  }

  // Projectile collision circles
  g.lineStyle(1.5, 0x22d3ee, 0.9);
  for (const b of sim.projectiles) {
    const bPos = this.transport.getInterpolatedProjectilePos(b, this.entityPosScratch);
    g.strokeCircle(bPos.x, bPos.y, b.radius);
  }
}
