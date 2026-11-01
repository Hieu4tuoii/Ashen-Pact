import {
  COAL_BOMB_BLAST_RADIUS,
  COAL_BOMB_FUSE_SEC,
  DWARF_MORTAR_FLIGHT_SEC,
  IRON_SHIELDER_ARC_HALF_ANGLE_RAD,
  IRON_SHIELDER_ARC_RADIUS,
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
 * Renders Phase 3A/3B Predictive Sightline Telegraphs & Arena Danger Overlays:
 * - Ground danger zones routed to `groundHazardGraphics` (`depth: 16`) with `<= 0.10` interior fill
 *   and crisp `#141019` + `#E84545` / `#FBBF24` Chiaroscuro danger perimeters.
 */
export function drawP3APredictiveSightlinesAndOverlays(
  scene: GameScene,
  g: Phaser.GameObjects.Graphics,
  sim: WorldSim,
): void {
  const floorG =
    (scene as { groundHazardGraphics?: Phaser.GameObjects.Graphics }).groundHazardGraphics ?? g;
  const inkColor = hexToNum(PALETTE.INK_DARK);
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

    // 1. Chiaroscuro dark bed + Outer 4.5px #FF5722 sightline beam
    g.lineStyle(spec.outerWidthPx + 2.0, inkColor, spec.outerAlpha * 0.55);
    g.beginPath();
    g.moveTo(spec.startX, spec.startY);
    g.lineTo(spec.endX, spec.endY);
    g.strokePath();

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
          g.lineStyle(4.8, inkColor, 0.55);
          g.beginPath();
          g.moveTo(prop.x, prop.y);
          g.lineTo(e.x, e.y);
          g.strokePath();

          g.lineStyle(2.6, outerBeamColor, 0.72);
          g.beginPath();
          g.moveTo(prop.x, prop.y);
          g.lineTo(e.x, e.y);
          g.strokePath();

          g.lineStyle(1.3, coreBeamColor, 0.9);
          g.beginPath();
          g.moveTo(prop.x, prop.y);
          g.lineTo(e.x, e.y);
          g.strokePath();
        }
      }
    }
  }

  // 6. Biome 3 Coal Golem (`coal_bomb`) fuse countdown ring & 1:1 blast danger circle (r=96px at depth 16)
  if (sim.props.length > 0) {
    const crimsonColor = hexToNum(PALETTE.CRIMSON_BRIGHT);
    const flameColor = hexToNum(PALETTE.FLAME_ORANGE);
    const goldColor = hexToNum(PALETTE.SOLAR_GOLD);
    for (let pIdx = 0; pIdx < sim.props.length; pIdx++) {
      const prop = sim.props[pIdx]!;
      if (prop.kind !== 'coal_bomb' || prop.hp <= 0 || prop.state === 'broken') continue;
      const fuseLeft = clamp(prop.fuseTimer ?? COAL_BOMB_FUSE_SEC, 0, COAL_BOMB_FUSE_SEC);
      const progress = 1 - fuseLeft / COAL_BOMB_FUSE_SEC;

      floorG.fillStyle(crimsonColor, 0.05 + 0.04 * progress);
      floorG.fillCircle(prop.x, prop.y, COAL_BOMB_BLAST_RADIUS);
      floorG.lineStyle(4.0, inkColor, 0.65);
      floorG.strokeCircle(prop.x, prop.y, COAL_BOMB_BLAST_RADIUS);
      floorG.lineStyle(2.2, crimsonColor, 0.58 + 0.36 * progress);
      floorG.strokeCircle(prop.x, prop.y, COAL_BOMB_BLAST_RADIUS);
      floorG.lineStyle(1.6, flameColor, 0.68);
      floorG.strokeCircle(prop.x, prop.y, COAL_BOMB_BLAST_RADIUS * (0.25 + 0.75 * progress));

      g.lineStyle(3.2, goldColor, 0.92);
      g.beginPath();
      g.arc(
        prop.x,
        prop.y,
        (prop.radius || 18) + 5,
        -Math.PI * 0.5,
        -Math.PI * 0.5 + Math.PI * 2 * (1 - progress),
        false,
      );
      g.strokePath();
    }
  }

  // 7. Biome 3 Dwarf Cannon (`pendingMortarStrikes`) r=56px red floor target indicator (depth 16) & parabolic shell arc
  if (sim.pendingMortarStrikes.length > 0) {
    const crimson = hexToNum(PALETTE.CRIMSON_BRIGHT);
    const flame = hexToNum(PALETTE.FLAME_ORANGE);
    const bone = hexToNum(PALETTE.BONE_WHITE);
    for (let mIdx = 0; mIdx < sim.pendingMortarStrikes.length; mIdx++) {
      const strike = sim.pendingMortarStrikes[mIdx]!;
      const total = strike.maxTimer || DWARF_MORTAR_FLIGHT_SEC;
      const t = clamp(1 - strike.timer / total, 0, 1);

      // Red floor target indicator (r = 56px, <= 0.10 interior fill)
      floorG.fillStyle(crimson, 0.06 + 0.04 * t);
      floorG.fillCircle(strike.x, strike.y, strike.radius);
      floorG.lineStyle(4.4, inkColor, 0.72);
      floorG.strokeCircle(strike.x, strike.y, strike.radius);
      floorG.lineStyle(2.6, crimson, 0.94);
      floorG.strokeCircle(strike.x, strike.y, strike.radius);
      floorG.lineStyle(1.8, flame, 0.82);
      floorG.strokeCircle(strike.x, strike.y, Math.max(6, strike.radius * (1 - t)));

      // Parabolic lobbed shell trajectory arc over cover
      if (!isStress) {
        const arcPeak = 76;
        g.lineStyle(2.0, flame, 0.52);
        g.beginPath();
        const steps = 10;
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const ax = strike.startX + (strike.x - strike.startX) * u;
          const ay =
            strike.startY +
            (strike.y - strike.startY) * u -
            4 * arcPeak * u * (1 - u);
          if (s === 0) g.moveTo(ax, ay);
          else g.lineTo(ax, ay);
        }
        g.strokePath();

        const shellX = strike.startX + (strike.x - strike.startX) * t;
        const shellY =
          strike.startY +
          (strike.y - strike.startY) * t -
          4 * arcPeak * t * (1 - t);
        g.fillStyle(inkColor, 0.9);
        g.fillCircle(shellX, shellY, 7.8);
        g.fillStyle(crimson, 0.96);
        g.fillCircle(shellX, shellY, 6.2);
        g.fillStyle(bone, 0.96);
        g.fillCircle(shellX, shellY, 2.6);
      }
    }
  }

  // 8. Biome 3 Iron Shielder rear lightning arc cone & Welder Drone EMP blast pulse ring
  const cyanColor = hexToNum(PALETTE.CYAN_FROST);
  const voltColor = hexToNum(PALETTE.VOLT_YELLOW);
  for (let eIdx = 0; eIdx < sim.enemies.length; eIdx++) {
    const e = sim.enemies[eIdx]!;
    const timer = e.shockArcVisualTimer ?? 0;
    if (e.hp <= 0 || timer <= 0) continue;
    const rearAngle = e.shockArcVisualAngle ?? e.aimAngle + Math.PI;
    const alpha = clamp(timer / 0.38, 0, 1);

    floorG.fillStyle(cyanColor, 0.08 * alpha);
    floorG.beginPath();
    floorG.moveTo(e.x, e.y);
    floorG.arc(
      e.x,
      e.y,
      IRON_SHIELDER_ARC_RADIUS,
      rearAngle - IRON_SHIELDER_ARC_HALF_ANGLE_RAD,
      rearAngle + IRON_SHIELDER_ARC_HALF_ANGLE_RAD,
      false,
    );
    floorG.closePath();
    floorG.fillPath();
    floorG.lineStyle(4.2, inkColor, 0.72 * alpha);
    floorG.strokePath();
    floorG.lineStyle(2.4, voltColor, 0.94 * alpha);
    floorG.strokePath();
  }

  if (sim.empBlastVisualRings.length > 0) {
    for (let rIdx = 0; rIdx < sim.empBlastVisualRings.length; rIdx++) {
      const ring = sim.empBlastVisualRings[rIdx]!;
      const p = clamp(1 - ring.timer / (ring.maxTimer || 0.42), 0, 1);
      const curR = ring.radius * (0.28 + 0.72 * p);
      const alpha = 1 - p;
      floorG.fillStyle(cyanColor, 0.06 * alpha);
      floorG.fillCircle(ring.x, ring.y, curR);
      floorG.lineStyle(4.5, inkColor, 0.7 * alpha);
      floorG.strokeCircle(ring.x, ring.y, curR);
      floorG.lineStyle(2.8, voltColor, 0.94 * alpha);
      floorG.strokeCircle(ring.x, ring.y, curR);
    }
  }

  // 9. P3B.1 Boss Supply Drop 0.6s golden target rings (`pendingBossSupplyDrops`) & landing burst
  let tracker = supplyDropTrackerBySim.get(sim);
  if (!tracker) {
    tracker = { prevDrops: [], landedRings: [], lastAlertTick: -1 };
    supplyDropTrackerBySim.set(sim, tracker);
  }
  const curDrops = sim.pendingBossSupplyDrops ?? [];
  if (tracker.prevDrops.length > 0 && curDrops.length === 0 && sim.tick > tracker.lastAlertTick) {
    tracker.lastAlertTick = sim.tick;
    tracker.landedRings = tracker.prevDrops.map((d) => ({
      x: d.x,
      y: d.y,
      bornTick: sim.tick,
    }));
    const activeBoss = sim.enemies.find((e) => e.isBoss && e.hp > 0);
    const alertX = activeBoss ? activeBoss.x : tracker.prevDrops[0]!.x;
    const alertY = activeBoss ? activeBoss.y - 44 : tracker.prevDrops[0]!.y - 28;
    scene.fx?.spawnFloatingAlert(alertX, alertY, 'SUPPLY DROP!', '#FBBF24');
  }
  if (curDrops.length > 0) {
    tracker.prevDrops = curDrops.map((d) => ({ x: d.x, y: d.y }));
    const amber = 0xf59e0b; // #F59E0B
    const gold = 0xfbbf24; // #FBBF24
    for (let dIdx = 0; dIdx < curDrops.length; dIdx++) {
      const drop = curDrops[dIdx]!;
      const maxT = drop.maxTimer || 0.6;
      const progress = clamp(1 - drop.timer / maxT, 0, 1);
      const r = drop.radius || 26;

      floorG.fillStyle(amber, 0.05 + 0.03 * progress);
      floorG.fillCircle(drop.x, drop.y, r);
      floorG.lineStyle(4.0, inkColor, 0.72);
      floorG.strokeCircle(drop.x, drop.y, r);
      floorG.lineStyle(2.5, gold, 0.94);
      floorG.strokeCircle(drop.x, drop.y, r);

      const innerR = Math.max(4, r * (1 - 0.72 * progress));
      floorG.lineStyle(1.9, amber, 0.88);
      floorG.strokeCircle(drop.x, drop.y, innerR);

      // Descending supply crate pod
      const dropHeightOffset = (1 - progress) * 54;
      g.lineStyle(2.0, gold, 0.45 + 0.35 * progress);
      g.beginPath();
      g.moveTo(drop.x, drop.y - dropHeightOffset);
      g.lineTo(drop.x, drop.y);
      g.strokePath();
      g.fillStyle(gold, 0.96);
      g.fillRect(drop.x - 5.5, drop.y - dropHeightOffset - 5.5, 11, 11);
      g.lineStyle(1.4, 0xfffbeb, 0.95);
      g.strokeRect(drop.x - 5.5, drop.y - dropHeightOffset - 5.5, 11, 11);
    }
  } else {
    tracker.prevDrops = [];
  }

  if (tracker.landedRings.length > 0) {
    const gold = 0xfbbf24;
    const amber = 0xf59e0b;
    for (let lIdx = tracker.landedRings.length - 1; lIdx >= 0; lIdx--) {
      const lr = tracker.landedRings[lIdx]!;
      const ageTicks = sim.tick - lr.bornTick;
      if (ageTicks < 0 || ageTicks > 14) {
        tracker.landedRings.splice(lIdx, 1);
        continue;
      }
      const p = clamp(ageTicks / 14, 0, 1);
      const rad = 16 + p * 34;
      const alpha = 1 - p;
      floorG.fillStyle(gold, 0.06 * alpha);
      floorG.fillCircle(lr.x, lr.y, rad);
      floorG.lineStyle(4.2, inkColor, 0.7 * alpha);
      floorG.strokeCircle(lr.x, lr.y, rad);
      floorG.lineStyle(2.6, gold, 0.95 * alpha);
      floorG.strokeCircle(lr.x, lr.y, rad);
      floorG.lineStyle(1.6, amber, 0.8 * alpha);
      floorG.strokeCircle(lr.x, lr.y, rad * 0.65);
    }
  }

  // 10. P3B.2–P3B.4 Boss Reinforced Armor Shell Aura & Shattered Armor Vulnerability Ring
  for (let bIdx = 0; bIdx < sim.enemies.length; bIdx++) {
    const boss = sim.enemies[bIdx]!;
    if (!boss.isBoss || boss.hp <= 0) continue;
    const bPos = scene.transport
      ? scene.transport.getInterpolatedEnemyPos(boss, scene.entityPosScratch)
      : boss;
    const bx = bPos.x;
    const by = bPos.y;
    const br = (boss.radius || 32) + 12;

    if (boss.bossArmorShellActive === true) {
      const shellCol =
        boss.defId === 'spore_king'
          ? 0x4ade80
          : boss.defId === 'kryssa_ice_queen'
            ? 0x38bdf8
            : 0xf97316;
      const coreCol =
        boss.defId === 'spore_king'
          ? 0xbbf7d0
          : boss.defId === 'kryssa_ice_queen'
            ? 0xe0f2fe
            : 0xfef08a;

      floorG.fillStyle(shellCol, 0.06);
      floorG.fillCircle(bx, by, br);
      g.lineStyle(4.8, inkColor, 0.74);
      g.strokeCircle(bx, by, br);
      g.lineStyle(3.0, shellCol, 0.94);
      g.strokeCircle(bx, by, br);
      g.lineStyle(1.5, coreCol, 0.88);
      g.strokeCircle(bx, by, br - 4.5);

      // 6 rotating armor barrier nodes around the boss
      const rotBase = sim.tick * 0.05;
      for (let k = 0; k < 6; k++) {
        const ang = rotBase + (k * Math.PI) / 3;
        const nx = bx + Math.cos(ang) * br;
        const ny = by + Math.sin(ang) * br;
        g.fillStyle(inkColor, 0.9);
        g.fillCircle(nx, ny, 5.0);
        g.fillStyle(coreCol, 0.96);
        g.fillCircle(nx, ny, 3.6);
      }
    } else if ((boss.bossArmorBreakVulnTimer ?? 0) > 0) {
      const vulnCol = 0xfbbf24;
      const crackCol = 0xef4444;
      floorG.fillStyle(vulnCol, 0.06);
      floorG.fillCircle(bx, by, br + 4);
      floorG.lineStyle(4.2, inkColor, 0.72);
      floorG.strokeCircle(bx, by, br + 2);
      floorG.lineStyle(2.6, vulnCol, 0.94);
      floorG.strokeCircle(bx, by, br + 2);

      // Radial shattered armor floor cracks
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4 + 0.2;
        const x1 = bx + Math.cos(ang) * (br - 6);
        const y1 = by + Math.sin(ang) * (br - 6);
        const x2 = bx + Math.cos(ang) * (br + 14);
        const y2 = by + Math.sin(ang) * (br + 14);
        floorG.lineStyle(2.2, k % 2 === 0 ? vulnCol : crackCol, 0.9);
        floorG.beginPath();
        floorG.moveTo(x1, y1);
        floorG.lineTo(x2, y2);
        floorG.strokePath();
      }
    }
  }

  // 11. P3B.3 Cryo-Charged Glacial Barricade Halo & Kicked Prop Kinetic Slipstream
  for (let pIdx = 0; pIdx < sim.props.length; pIdx++) {
    const prop = sim.props[pIdx]!;
    if (prop.hp <= 0) continue;
    const pr = (prop.radius || 20) + 7;

    if (prop.cryoChargedByLaser === true) {
      floorG.fillStyle(0x38bdf8, 0.07);
      floorG.fillCircle(prop.x, prop.y, pr + 4);
      g.lineStyle(4.2, inkColor, 0.75);
      g.strokeCircle(prop.x, prop.y, pr + 2);
      g.lineStyle(2.6, 0x38bdf8, 0.95);
      g.strokeCircle(prop.x, prop.y, pr + 2);
      g.lineStyle(1.6, 0xfffdf5, 0.95);
      g.strokeCircle(prop.x, prop.y, pr - 2);
    }

    const kvx = prop.coverState === 'sliding' ? (prop.vx ?? 0) : 0;
    const kvy = prop.coverState === 'sliding' ? (prop.vy ?? 0) : 0;
    const kSpd = Math.hypot(kvx, kvy);
    if (kSpd > 40) {
      const nx = kvx / kSpd;
      const ny = kvy / kSpd;
      const wakeCol = prop.cryoChargedByLaser ? 0x38bdf8 : 0xfbbf24;
      g.lineStyle(3.0, wakeCol, 0.88);
      g.beginPath();
      g.moveTo(prop.x - nx * 8, prop.y - ny * 8);
      g.lineTo(prop.x - nx * 36, prop.y - ny * 36);
      g.strokePath();
      g.lineStyle(2.2, 0xfffbeb, 0.92);
      g.strokeCircle(prop.x, prop.y, pr);
    }
  }
}

interface SupplyDropTrackState {
  prevDrops: Array<{ x: number; y: number }>;
  landedRings: Array<{ x: number; y: number; bornTick: number }>;
  lastAlertTick: number;
}

const supplyDropTrackerBySim = new WeakMap<WorldSim, SupplyDropTrackState>();
