import {
  ASHEN_PACTS,
  ASHEN_RELICS,
  SOUL_CHAIN_DRAIN_INTERVAL_SEC,
  SOUL_CHAIN_MAX_DIST,
  i18n,
  type SimEnemyState,
  type SimEvent,
  type SimPlayerState,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { PALETTE } from '../art/palette.js';
import { zzfx } from '../audio/zzfx.js';
import type { GameScene } from '../scenes/GameScene.js';
import {
  getVisualTimeMs,
  isVisualFreezeActive,
  triggerRelicAwakenedBanner,
} from '../scenes/game-scene/hud-ashen-pact-modal.js';

export interface PlayerTetherVisualSpec {
  active: boolean;
  mode: 'none' | 'pact_soul_chain' | 'relic_blood_oath_tether';
  targetKind: 'none' | 'player' | 'enemy';
  targetId: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  distancePx: number;
  maxSafeDistancePx: number;
  isStretched: boolean;
  stretchTimerSec: number;
  stretchRatio: number;
  primaryColor: number;
  secondaryColor: number;
  warningTextVi: string;
  warningTextEn: string;
}

interface CrossScytheSlashFx {
  x: number;
  y: number;
  radius: number;
  bornAtMs: number;
  durationMs: number;
}

const activeCrossScytheSlashes: CrossScytheSlashFx[] = [];

function resolveAllPlayers(sim: WorldSim): SimPlayerState[] {
  if (typeof sim.getAllPlayers === 'function') return sim.getAllPlayers();
  const list: SimPlayerState[] = [];
  if (sim.player) list.push(sim.player);
  for (const sp of sim.simulatedPlayers ?? []) {
    if (!list.some((p) => p.id === sp.id)) list.push(sp);
  }
  return list;
}

function makeInactiveSpec(player: SimPlayerState, primaryColor = 0x38bdf8): PlayerTetherVisualSpec {
  return {
    active: false,
    mode: 'none',
    targetKind: 'none',
    targetId: 0,
    x1: player.x,
    y1: player.y,
    x2: player.x,
    y2: player.y,
    distancePx: 0,
    maxSafeDistancePx: SOUL_CHAIN_MAX_DIST,
    isStretched: false,
    stretchTimerSec: 0,
    stretchRatio: 0,
    primaryColor,
    secondaryColor: 0x38bdf8,
    warningTextVi: '',
    warningTextEn: '',
  };
}

function resolveAnchorPosition(
  sim: WorldSim,
  player: SimPlayerState,
  preferWithinMaxDist: boolean,
): { kind: 'none' | 'player' | 'enemy'; id: number; x: number; y: number } {
  const allPlayers = resolveAllPlayers(sim);
  const enemies: SimEnemyState[] = sim.enemies ?? [];

  if (player.soulChainTargetKind === 'player' && player.soulChainTargetId != null) {
    const ally = allPlayers.find((p) => p.id === player.soulChainTargetId);
    if (ally && ally.lifeState === 'alive' && ally.hp > 0 && ally.id !== player.id) {
      return { kind: 'player', id: ally.id, x: ally.x, y: ally.y };
    }
  }
  if (player.soulChainTargetKind === 'enemy' && player.soulChainTargetId != null) {
    const enemy = enemies.find(
      (e) =>
        e.id === player.soulChainTargetId &&
        e.hp > 0 &&
        !e.isDummy &&
        e.defId !== 'ashen_executioner',
    );
    if (enemy) return { kind: 'enemy', id: enemy.id, x: enemy.x, y: enemy.y };
  }

  let bestAlly: SimPlayerState | undefined;
  let bestAllyDist = Infinity;
  for (const other of allPlayers) {
    if (other.id === player.id || other.lifeState !== 'alive' || other.hp <= 0) continue;
    const d = Math.hypot(other.x - player.x, other.y - player.y);
    if (d < bestAllyDist) {
      bestAllyDist = d;
      bestAlly = other;
    }
  }
  if (bestAlly && (!preferWithinMaxDist || bestAllyDist <= SOUL_CHAIN_MAX_DIST)) {
    return { kind: 'player', id: bestAlly.id, x: bestAlly.x, y: bestAlly.y };
  }

  let bestEnemy: SimEnemyState | undefined;
  let bestEnemyDist = Infinity;
  for (const e of enemies) {
    if (e.isDummy || e.defId === 'ashen_executioner' || e.hp <= 0 || e.bossBurrowed) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < bestEnemyDist) {
      bestEnemyDist = d;
      bestEnemy = e;
    }
  }
  if (bestEnemy && (!preferWithinMaxDist || bestEnemyDist <= SOUL_CHAIN_MAX_DIST)) {
    return { kind: 'enemy', id: bestEnemy.id, x: bestEnemy.x, y: bestEnemy.y };
  }
  return { kind: 'none', id: 0, x: player.x, y: player.y };
}

export function computePlayerTetherVisualSpec(
  sim: WorldSim,
  player: SimPlayerState,
): PlayerTetherVisualSpec {
  const hasRelicTether = Boolean(player.awakenedRelicIds?.includes('relic_blood_oath_tether'));
  const hasPactChain = player.activePactId === 'pact_soul_chain';
  if (!hasRelicTether && !hasPactChain) return makeInactiveSpec(player);

  if (hasRelicTether && !hasPactChain) {
    const anchor = resolveAnchorPosition(sim, player, true);
    if (anchor.kind === 'none') return makeInactiveSpec(player, 0xff6b00);
    const dist = Math.hypot(anchor.x - player.x, anchor.y - player.y);
    return {
      active: dist <= SOUL_CHAIN_MAX_DIST,
      mode: 'relic_blood_oath_tether',
      targetKind: anchor.kind,
      targetId: anchor.id,
      x1: player.x,
      y1: player.y,
      x2: anchor.x,
      y2: anchor.y,
      distancePx: dist,
      maxSafeDistancePx: SOUL_CHAIN_MAX_DIST,
      isStretched: false,
      stretchTimerSec: 0,
      stretchRatio: 0,
      primaryColor: 0xff6b00,
      secondaryColor: 0x38bdf8,
      warningTextVi: '',
      warningTextEn: '',
    };
  }

  const anchor = resolveAnchorPosition(sim, player, false);
  if (anchor.kind === 'none') return makeInactiveSpec(player);

  const dist = Math.hypot(anchor.x - player.x, anchor.y - player.y);
  const isStretched = dist > SOUL_CHAIN_MAX_DIST;
  const stretchTimerSec = player.soulChainStretchTimer ?? 0;
  const stretchRatio = Math.min(1, Math.max(0, stretchTimerSec / SOUL_CHAIN_DRAIN_INTERVAL_SEC));

  return {
    active: true,
    mode: 'pact_soul_chain',
    targetKind: anchor.kind,
    targetId: anchor.id,
    x1: player.x,
    y1: player.y,
    x2: anchor.x,
    y2: anchor.y,
    distancePx: dist,
    maxSafeDistancePx: SOUL_CHAIN_MAX_DIST,
    isStretched,
    stretchTimerSec,
    stretchRatio,
    primaryColor: isStretched ? 0xf43f5e : 0x38bdf8,
    secondaryColor: isStretched ? 0xfacc15 : 0xa855f7,
    warningTextVi: isStretched ? '> 260px · RÚT GIÁP!' : '',
    warningTextEn: isStretched ? '> 260px · ARMOR DRAIN!' : '',
  };
}

function drawSoulChainBeam(
  g: Phaser.GameObjects.Graphics,
  spec: PlayerTetherVisualSpec,
  timeMs: number,
): void {
  const { x1, y1, x2, y2, distancePx, isStretched, stretchRatio, primaryColor, secondaryColor } =
    spec;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, distancePx);
  const nx = -dy / len;
  const ny = dx / len;
  const pulse = 0.72 + 0.28 * Math.sin(timeMs * (isStretched ? 0.016 : 0.006));

  g.lineStyle(isStretched ? 6.5 : 5.0, 0x141019, 0.58);
  g.lineBetween(x1, y1, x2, y2);
  g.lineStyle(isStretched ? 3.2 : 2.2, primaryColor, 0.42 * pulse);
  g.lineBetween(x1, y1, x2, y2);

  const linkCount = Math.max(2, Math.min(36, Math.floor(len / 18)));
  for (let i = 0; i <= linkCount; i++) {
    const t = i / linkCount;
    const jitter = isStretched ? Math.sin(timeMs * 0.025 + i * 1.9) * (2.5 + stretchRatio * 3.5) : 0;
    const cx = x1 + dx * t + nx * jitter;
    const cy = y1 + dy * t + ny * jitter;
    g.lineStyle(isStretched ? 2.2 : 1.8, i % 2 === 0 ? primaryColor : secondaryColor, 0.88 * pulse);
    g.strokeCircle(cx, cy, isStretched ? 4.0 : 3.2);
  }

  if (isStretched) {
    g.lineStyle(1.8, 0xfacc15, 0.92);
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const wave = (i % 2 === 0 ? 1 : -1) * (5 + 4 * Math.sin(timeMs * 0.02 + i));
      g.lineTo(x1 + dx * t + nx * wave, y1 + dy * t + ny * wave);
    }
    g.lineTo(x2, y2);
    g.strokePath();

    const warnRadius = 22 + 3 * Math.sin(timeMs * 0.018);
    g.lineStyle(2.2, 0xf43f5e, 0.9);
    g.strokeCircle(x1, y1, warnRadius);

    if (stretchRatio > 0.02) {
      g.lineStyle(3.2, 0xfacc15, 0.95);
      g.beginPath();
      g.arc(x1, y1, warnRadius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * stretchRatio, false);
      g.strokePath();
    }
  }
}

function drawBloodOathLaserTether(
  g: Phaser.GameObjects.Graphics,
  spec: PlayerTetherVisualSpec,
  timeMs: number,
): void {
  const { x1, y1, x2, y2, distancePx } = spec;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, distancePx);
  const nx = -dy / len;
  const ny = dx / len;
  const pulse = 0.78 + 0.22 * Math.sin(timeMs * 0.012);

  g.lineStyle(8.0, 0x141019, 0.72);
  g.lineBetween(x1, y1, x2, y2);
  g.lineStyle(4.2, 0xff6b00, 0.88 * pulse);
  g.lineBetween(x1, y1, x2, y2);
  g.lineStyle(1.6, 0xfffdf5, 0.94);
  g.lineBetween(x1, y1, x2, y2);

  const segs = Math.max(4, Math.min(20, Math.floor(len / 18)));
  g.lineStyle(1.6, 0x38bdf8, 0.9);
  g.beginPath();
  g.moveTo(x1, y1);
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const offset = Math.sin(timeMs * 0.02 + i * 1.7) * 5.0;
    g.lineTo(x1 + dx * t + nx * offset, y1 + dy * t + ny * offset);
  }
  g.lineTo(x2, y2);
  g.strokePath();

  g.lineStyle(1.8, 0xfacc15, 0.85);
  g.strokeCircle(x1, y1, 14);
  g.strokeCircle(x2, y2, 14);
}

export function drawP2BWorldOverlays(
  scene: GameScene,
  g: Phaser.GameObjects.Graphics,
  sim: WorldSim,
  playerX: number,
  playerY: number,
): void {
  const floorG = (scene as { groundHazardGraphics?: Phaser.GameObjects.Graphics }).groundHazardGraphics ?? g;
  const timeMs = getVisualTimeMs(scene);
  const pulse = 0.75 + 0.25 * Math.sin(timeMs * 0.007);
  const allPlayers = resolveAllPlayers(sim);

  // 1. Player Tethers & Black Crystal Empowered Halo
  const renderedAllyPairs = new Set<string>();
  for (const p of allPlayers) {
    if (p.lifeState !== 'alive' || p.hp <= 0) continue;
    const px = p.id === sim.player.id ? playerX : p.x;
    const py = p.id === sim.player.id ? playerY : p.y;

    if (p.blackCrystalEmpoweredNextShot) {
      const rot = (timeMs * 0.003) % (Math.PI * 2);
      const r = 20 + 2 * Math.sin(timeMs * 0.01);
      floorG.fillStyle(0x311042, 0.08);
      floorG.fillCircle(px, py, r);
      g.lineStyle(3.4, 0x141019, 0.76);
      g.beginPath();
      g.moveTo(px + Math.cos(rot) * r, py + Math.sin(rot) * r);
      g.lineTo(px + Math.cos(rot + Math.PI / 2) * r, py + Math.sin(rot + Math.PI / 2) * r);
      g.lineTo(px + Math.cos(rot + Math.PI) * r, py + Math.sin(rot + Math.PI) * r);
      g.lineTo(px + Math.cos(rot + (Math.PI * 3) / 2) * r, py + Math.sin(rot + (Math.PI * 3) / 2) * r);
      g.closePath();
      g.strokePath();
      g.lineStyle(1.8, 0xfacc15, 0.94);
      g.strokePath();
    }

    const spec = computePlayerTetherVisualSpec(sim, p);
    if (!spec.active) continue;
    spec.x1 = px;
    spec.y1 = py;

    if (spec.targetKind === 'player') {
      const pairKey = `${spec.mode}:${Math.min(p.id, spec.targetId)}:${Math.max(p.id, spec.targetId)}`;
      if (renderedAllyPairs.has(pairKey)) continue;
      renderedAllyPairs.add(pairKey);
    }

    if (spec.mode === 'pact_soul_chain') {
      drawSoulChainBeam(g, spec, timeMs);
    } else if (spec.mode === 'relic_blood_oath_tether') {
      drawBloodOathLaserTether(g, spec, timeMs);
    }
  }

  // 2. Ashen Executioner (`Bóng Ma Đao Phủ`) 1:1 spectral aura & scythe cleave telegraph
  for (const e of sim.enemies) {
    if (e.hp <= 0 || e.defId !== 'ashen_executioner') continue;
    if (Math.hypot(e.x - playerX, e.y - playerY) > 760) continue;

    const r = e.radius || 22;
    const rot = (timeMs * 0.004) % (Math.PI * 2);
    floorG.fillStyle(0x2e0718, 0.08);
    floorG.fillCircle(e.x, e.y, r + 8);
    floorG.lineStyle(2.2, 0xf43f5e, 0.78 * pulse);
    floorG.strokeCircle(e.x, e.y, r + 8);
    floorG.lineStyle(1.6, 0xc084fc, 0.78);
    floorG.beginPath();
    floorG.arc(e.x, e.y, r + 12, rot, rot + Math.PI * 1.15, false);
    floorG.strokePath();

    if (e.aiState === 'telegraph') {
      const aimAngle = e.telegraphAngle ?? e.aimAngle;
      floorG.fillStyle(0xe84545, 0.08);
      floorG.beginPath();
      floorG.moveTo(e.x, e.y);
      floorG.arc(e.x, e.y, 92, aimAngle - 0.75, aimAngle + 0.75, false);
      floorG.closePath();
      floorG.fillPath();
      floorG.lineStyle(4.2, 0x141019, 0.72);
      floorG.strokePath();
      floorG.lineStyle(2.4, 0xe84545, 0.95);
      floorG.strokePath();
    }
  }

  // 3. P2B Projectiles: `ashen_executioner_wave` & `relic_perpetual_core_rocket`
  for (const b of sim.projectiles) {
    if (Math.hypot(b.x - playerX, b.y - playerY) > 760) continue;

    if (b.weaponId === 'ashen_executioner_wave') {
      const angle = b.angle ?? Math.atan2(b.vy, b.vx);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const nx = -sin;
      const ny = cos;
      // Offset arc center behind (b.x, b.y) so the ~48px Chiaroscuro Dark-Flame Scythe Crescent
      // sweeps directly through the inviolable #E84545 enemy core at (b.x, b.y)!
      const arcR = Math.max(26, (b.radius || 14) + 12);
      const cx = b.x - cos * (arcR - 2);
      const cy = b.y - sin * (arcR - 2);

      // Trailing dark-flame wake wisps from scythe horn tips
      for (const side of [-1, 1] as const) {
        const hornAng = angle + side * 1.12;
        const hx = cx + Math.cos(hornAng) * arcR;
        const hy = cy + Math.sin(hornAng) * arcR;
        g.lineStyle(4.2, 0x141019, 0.86);
        g.beginPath();
        g.moveTo(hx, hy);
        g.lineTo(hx - cos * 16 + nx * side * 3, hy - sin * 16 + ny * side * 3);
        g.strokePath();

        g.lineStyle(2.0, 0xa855f7, 0.88);
        g.beginPath();
        g.moveTo(hx, hy);
        g.lineTo(hx - cos * 13 + nx * side * 2.5, hy - sin * 13 + ny * side * 2.5);
        g.strokePath();
      }

      // 1. Wide #141019 obsidian Chiaroscuro shroud
      g.lineStyle(8.4, 0x141019, 0.92);
      g.beginPath();
      g.arc(cx, cy, arcR, angle - 1.18, angle + 1.18, false);
      g.strokePath();

      // 2. Ashen dark-flame spectral violet outer mantle
      g.lineStyle(5.6, 0x9333ea, 0.86);
      g.beginPath();
      g.arc(cx - cos * 2.5, cy - sin * 2.5, arcR - 1, angle - 1.08, angle + 1.08, false);
      g.strokePath();

      // 3. Saturated #E84545 crimson scythe blade
      g.lineStyle(4.0, 0xe84545, 0.98);
      g.beginPath();
      g.arc(cx, cy, arcR, angle - 1.05, angle + 1.05, false);
      g.strokePath();

      // 4. Razor #FFFDF5 hot cutting spine passing right through (b.x, b.y)
      g.lineStyle(1.8, 0xfffdf5, 0.98);
      g.beginPath();
      g.arc(cx, cy, arcR + 1.2, angle - 0.86, angle + 0.86, false);
      g.strokePath();
    } else if (b.weaponId === 'relic_perpetual_core_rocket') {
      const angle = b.angle ?? Math.atan2(b.vy, b.vx);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      g.fillStyle(0x38bdf8, 0.9);
      g.fillCircle(b.x - cos * 8, b.y - sin * 8, 4.0);
      g.fillStyle(0xd97706, 0.95);
      g.fillTriangle(
        b.x + cos * 8,
        b.y + sin * 8,
        b.x - cos * 5 - sin * 4,
        b.y - sin * 5 + cos * 4,
        b.x - cos * 5 + sin * 4,
        b.y - sin * 5 - cos * 4,
      );
      g.lineStyle(1.4, 0xfacc15, 1);
      g.strokeTriangle(
        b.x + cos * 8,
        b.y + sin * 8,
        b.x - cos * 5 - sin * 4,
        b.y - sin * 5 + cos * 4,
        b.x - cos * 5 + sin * 4,
        b.y - sin * 5 - cos * 4,
      );
    }
  }

  // 4. Transient Cross Scythe X-Slash bursts (`relic_executioner_scythe` — hollow 1:1 Chiaroscuro sigil)
  for (let i = activeCrossScytheSlashes.length - 1; i >= 0; i--) {
    const fx = activeCrossScytheSlashes[i]!;
    const elapsed = timeMs - fx.bornAtMs;
    if (elapsed < 0 || elapsed > fx.durationMs) {
      if (!isVisualFreezeActive(scene)) activeCrossScytheSlashes.splice(i, 1);
      continue;
    }
    const t = Math.min(1, Math.max(0, elapsed / fx.durationMs));
    const alpha = 1 - t * 0.85;
    const r = fx.radius * (0.68 + 0.32 * t);

    floorG.fillStyle(0xf43f5e, alpha * 0.05);
    floorG.fillCircle(fx.x, fx.y, r);
    floorG.lineStyle(4.2, 0x141019, alpha * 0.72);
    floorG.strokeCircle(fx.x, fx.y, r);
    floorG.lineStyle(2.4, 0xfacc15, alpha * 0.92);
    floorG.strokeCircle(fx.x, fx.y, r);

    const diag = r * 0.84;
    g.lineStyle(6.0, 0x141019, alpha * 0.82);
    g.lineBetween(fx.x - diag, fx.y - diag, fx.x + diag, fx.y + diag);
    g.lineBetween(fx.x + diag, fx.y - diag, fx.x - diag, fx.y + diag);

    g.lineStyle(3.4, 0xf43f5e, alpha * 0.95);
    g.lineBetween(fx.x - diag, fx.y - diag, fx.x + diag, fx.y + diag);
    g.lineBetween(fx.x + diag, fx.y - diag, fx.x - diag, fx.y + diag);

    g.lineStyle(1.6, 0xfffdf5, alpha);
    g.lineBetween(fx.x - diag * 0.88, fx.y - diag * 0.88, fx.x + diag * 0.88, fx.y + diag * 0.88);
    g.lineBetween(fx.x + diag * 0.88, fx.y - diag * 0.88, fx.x - diag * 0.88, fx.y + diag * 0.88);
  }
}

export function handleP2BSimEvent(
  scene: GameScene,
  ev: SimEvent,
  _sim: WorldSim,
  isStress: boolean,
  allowStressSfx: boolean,
): boolean {
  const isEn = i18n.getLocale() === 'en';

  if (ev.kind === 'pact_signed') {
    const pact = ASHEN_PACTS[ev.pactId];
    if (!isStress) {
      scene.fx?.spawnExplosionBurst(ev.x, ev.y, 44, PALETTE.CRIMSON_BRIGHT);
      scene.fx?.addTrauma(0.24);
      scene.lighting?.spawnTransientLight(ev.x, ev.y, 130, PALETTE.CRIMSON_BRIGHT, 0.95, 0.35);
      const pactName = (isEn ? pact?.nameEn : pact?.nameVi) ?? ev.nameVi;
      scene.fx?.spawnFloatingAlert(
        ev.x,
        ev.y - 24,
        isEn ? `PACT: ${pactName.toUpperCase()}!` : `KHẾ ƯỚC: ${pactName.toUpperCase()}!`,
      );
    }
    if (!isStress || allowStressSfx) zzfx.play('skill_cast', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
    return true;
  }

  if (ev.kind === 'relic_awakened') {
    const relic = ASHEN_RELICS[ev.relicId];
    if (!isStress) {
      triggerRelicAwakenedBanner(scene, ev.relicId, isEn);
      scene.fx?.spawnExplosionBurst(ev.x, ev.y, 56, PALETTE.SOLAR_GOLD);
      scene.fx?.addTrauma(0.32);
      scene.lighting?.spawnTransientLight(ev.x, ev.y, 160, PALETTE.SOLAR_GOLD, 1.0, 0.55);
      const relicName = (isEn ? relic?.nameEn : relic?.nameVi) ?? ev.nameVi;
      scene.fx?.spawnFloatingAlert(
        ev.x,
        ev.y - 28,
        isEn ? `★ RELIC AWAKENED: ${relicName}!` : `★ THỨC TỈNH DI VẬT: ${relicName}!`,
      );
    }
    if (!isStress || allowStressSfx) zzfx.play('ui_victory');
    return true;
  }

  if (ev.kind === 'explosion' && ev.sourceDefId === 'relic_executioner_scythe') {
    if (!isStress) {
      const r = Math.max(48, ev.radius || 96);
      activeCrossScytheSlashes.push({
        x: ev.x,
        y: ev.y,
        radius: r,
        bornAtMs: getVisualTimeMs(scene),
        durationMs: 360,
      });
      scene.fx?.spawnShaderSlash?.(ev.x, ev.y, r * 0.85, Math.PI * 0.25, 'fx_sh_slash_crimson');
      scene.fx?.spawnShaderSlash?.(ev.x, ev.y, r * 0.85, -Math.PI * 0.25, 'fx_sh_slash_crimson', {
        flipY: true,
      });
    }
    return false;
  }
  return false;
}
