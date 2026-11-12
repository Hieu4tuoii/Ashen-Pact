import {
  clamp,
  type DungeonRoomNode,
  ENEMIES,
  i18n,
  PLAYER_SLOT_COLORS,
  type SimEnemyState,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { musicManager } from '../../audio/music-synth.js';
import {
  computeOffscreenArrowPose,
  drawKeyChip,
  drawOffscreenEnemyArrow,
  drawPlayerHitDirectionArc,
  drawSegmentedBar,
  drawStyledPanel,
  drawVectorHudIcon,
} from '../../ui/components/hud-primitives.js';
import { clampUiScale, graphicsSettings } from '../../ui/graphics-settings.js';
import { serializeKeybindingsHash } from '../../ui/keybindings.js';
import {
  computeUiTextResolution,
  createSceneTextStyle,
  createUiTextStyle,
  getBiomeUiAccent,
  UI_THEME,
} from '../../ui/theme.js';
import type { GameScene } from '../GameScene.js';
import {
  drawBossArmorFrameAndTacticalHintHud,
  drawBossStaggerBarHud,
  isBossHudHintBannerVisible,
} from './hud-combat-and-coop.js';
import {
  computeMusicIntensityBoost,
  computeWaveBannerSpec,
  triggerP11WaveBanner,
  updateP11RemainingEnemiesHud,
} from './p11-drama-hud.js';

const scratchAliveBosses: SimEnemyState[] = [];
const scratchAliveEnemies: SimEnemyState[] = [];

export function shouldShowOffscreenEnemyArrows(aliveEnemyCount: number): boolean {
  return aliveEnemyCount >= 1 && aliveEnemyCount <= 3;
}

export function triggerPlayerHitDirectionIndicatorImpl(this: GameScene, angleRad: number): void {
  this.playerHitIndicatorAngleRad = angleRad;
  this.playerHitIndicatorTimer = 0.55;
}

export function triggerWaveBannerImpl(this: GameScene, wave: number, maxWaves = 3): void {
  const sim = this.transport.getSim();
  const room = sim.getCurrentRoom();
  const isChallenge = Boolean(
    room.isChallenge || (room as unknown as Record<string, unknown>).isChallengeRoom,
  );
  const spec = computeWaveBannerSpec(wave, maxWaves, isChallenge);
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__LAST_P11_WAVE_BANNER__ = spec.titleVi;
  }
  triggerP11WaveBanner(this, wave, maxWaves, isChallenge);
}

export function triggerRoomClearedBannerImpl(this: GameScene): void {
  const isEn = i18n.getLocale() === 'en';
  this.hudBannerTextStr = isEn ? '✓ ROOM CLEARED' : '✓ PHÒNG ĐÃ DỌN SẠCH';
  this.hudBannerAccentColor = 0x4ade80;
  this.hudBannerTimer = 2.2;
}

export function resolveMinimapNodeDims(
  cellStep: number,
  preset?: string,
  cols = 36,
  rows = 22,
): { nodeW: number; nodeH: number } {
  const baseW = cellStep * 0.74;
  const baseH = cellStep * 0.64;
  let scaleW = 0.92;
  let scaleH = 0.9;
  if (preset === 'compact' || (cols <= 28 && rows <= 18)) {
    scaleW = 0.76;
    scaleH = 0.76;
  } else if (preset === 'wide_hall' || (cols >= 46 && rows <= 20)) {
    scaleW = 1.14;
    scaleH = 0.8;
  } else if (preset === 'tall_sanctum' || (cols <= 32 && rows >= 28)) {
    scaleW = 0.82;
    scaleH = 1.14;
  } else if (preset === 'grand_arena' || (cols === 44 && rows === 26)) {
    scaleW = 1.08;
    scaleH = 1.06;
  } else if (preset === 'colossal_boss' || cols >= 48) {
    scaleW = 1.18;
    scaleH = 1.16;
  }
  const maxDim = Math.max(8, Math.floor(cellStep * 0.88));
  const minDim = Math.max(6, Math.floor(cellStep * 0.48));
  return {
    nodeW: clamp(Math.round(baseW * scaleW), minDim, maxDim),
    nodeH: clamp(Math.round(baseH * scaleH), minDim, maxDim),
  };
}

export function computeMinimapRoomPolygon(
  shape: string,
  cx: number,
  cy: number,
  nodeW: number,
  nodeH: number,
  orientation = 0,
): readonly [number, number][] {
  const hw = nodeW * 0.5;
  const hh = nodeH * 0.5;
  switch (shape) {
    case 'octagon': {
      const bx = hw * 0.36;
      const by = hh * 0.36;
      return [
        [cx - hw + bx, cy - hh],
        [cx + hw - bx, cy - hh],
        [cx + hw, cy - hh + by],
        [cx + hw, cy + hh - by],
        [cx + hw - bx, cy + hh],
        [cx - hw + bx, cy + hh],
        [cx - hw, cy + hh - by],
        [cx - hw, cy - hh + by],
      ];
    }
    case 'diamond':
    case 'rhombus': {
      const tx = hw * 0.22;
      const ty = hh * 0.22;
      return [
        [cx - tx, cy - hh],
        [cx + tx, cy - hh],
        [cx + hw, cy - ty],
        [cx + hw, cy + ty],
        [cx + tx, cy + hh],
        [cx - tx, cy + hh],
        [cx - hw, cy + ty],
        [cx - hw, cy - ty],
      ];
    }
    case 'cruciform':
    case 'plus_shape':
    case 'plus':
    case 'cross_chamber': {
      const ratio = shape === 'cruciform' ? 0.46 : 0.34;
      const aw = hw * ratio;
      const ah = hh * ratio;
      return [
        [cx - aw, cy - hh],
        [cx + aw, cy - hh],
        [cx + aw, cy - ah],
        [cx + hw, cy - ah],
        [cx + hw, cy + ah],
        [cx + aw, cy + ah],
        [cx + aw, cy + hh],
        [cx - aw, cy + hh],
        [cx - aw, cy + ah],
        [cx - hw, cy + ah],
        [cx - hw, cy - ah],
        [cx - aw, cy - ah],
      ];
    }
    case 'hourglass': {
      const wx = hw * 0.34;
      const wy = hh * 0.44;
      return [
        [cx - hw, cy - hh],
        [cx - wx, cy - hh],
        [cx - wx * 0.55, cy - wy],
        [cx + wx * 0.55, cy - wy],
        [cx + wx, cy - hh],
        [cx + hw, cy - hh],
        [cx + hw, cy + hh],
        [cx + wx, cy + hh],
        [cx + wx * 0.55, cy + wy],
        [cx - wx * 0.55, cy + wy],
        [cx - wx, cy + hh],
        [cx - hw, cy + hh],
      ];
    }
    case 'l_shape': {
      const ix = hw * 0.12;
      const iy = hh * 0.12;
      const rot = ((orientation % 4) + 4) % 4;
      if (rot === 1) {
        return [
          [cx + ix, cy - hh],
          [cx + hw, cy - hh],
          [cx + hw, cy + hh],
          [cx - hw, cy + hh],
          [cx - hw, cy - iy],
          [cx + ix, cy - iy],
        ];
      }
      if (rot === 2) {
        return [
          [cx - hw, cy - hh],
          [cx + hw, cy - hh],
          [cx + hw, cy + hh],
          [cx + ix, cy + hh],
          [cx + ix, cy + iy],
          [cx - hw, cy + iy],
        ];
      }
      if (rot === 3) {
        return [
          [cx - hw, cy - hh],
          [cx + hw, cy - hh],
          [cx + hw, cy + iy],
          [cx - ix, cy + iy],
          [cx - ix, cy + hh],
          [cx - hw, cy + hh],
        ];
      }
      return [
        [cx - hw, cy - hh],
        [cx - ix, cy - hh],
        [cx - ix, cy - iy],
        [cx + hw, cy - iy],
        [cx + hw, cy + hh],
        [cx - hw, cy + hh],
      ];
    }
    case 't_shape': {
      const sw = hw * 0.44;
      const sh = hh * 0.16;
      const rot = ((orientation % 4) + 4) % 4;
      if (rot === 1) {
        return [
          [cx - sw, cy - hh],
          [cx + sw, cy - hh],
          [cx + sw, cy - sh],
          [cx + hw, cy - sh],
          [cx + hw, cy + hh],
          [cx - hw, cy + hh],
          [cx - hw, cy - sh],
          [cx - sw, cy - sh],
        ];
      }
      return [
        [cx - hw, cy - hh],
        [cx + hw, cy - hh],
        [cx + hw, cy + sh],
        [cx + sw, cy + sh],
        [cx + sw, cy + hh],
        [cx - sw, cy + hh],
        [cx - sw, cy + sh],
        [cx - hw, cy + sh],
      ];
    }
    case 'u_shape': {
      const uw = hw * 0.34;
      const uy = hh * 0.22;
      const rot = ((orientation % 4) + 4) % 4;
      if (rot === 1) {
        return [
          [cx - hw, cy - hh],
          [cx + hw, cy - hh],
          [cx + hw, cy + hh],
          [cx + uw, cy + hh],
          [cx + uw, cy - uy],
          [cx - uw, cy - uy],
          [cx - uw, cy + hh],
          [cx - hw, cy + hh],
        ];
      }
      return [
        [cx - hw, cy - hh],
        [cx - uw, cy - hh],
        [cx - uw, cy + uy],
        [cx + uw, cy + uy],
        [cx + uw, cy - hh],
        [cx + hw, cy - hh],
        [cx + hw, cy + hh],
        [cx - hw, cy + hh],
      ];
    }
    case 'multi_chamber':
    case 'split_wing':
    case 'split_twin_lobe':
    case 'twin_lobe':
    case 'asymmetric': {
      const stepX = hw * 0.16;
      const neckX = hw * 0.04;
      const stepY = hh * 0.38;
      const neckY = hh * 0.52;
      return [
        [cx - hw, cy - hh],
        [cx + stepX, cy - hh],
        [cx + stepX, cy - neckY],
        [cx + neckX, cy - stepY],
        [cx + hw, cy - stepY],
        [cx + hw, cy + hh],
        [cx - stepX, cy + hh],
        [cx - stepX, cy + neckY],
        [cx - neckX, cy + stepY],
        [cx - hw, cy + stepY],
      ];
    }
    case 'donut_ring':
    case 'ring_donut':
    case 'donut':
    case 'ring': {
      const bx = hw * 0.28;
      const by = hh * 0.28;
      return [
        [cx - hw + bx, cy - hh],
        [cx + hw - bx, cy - hh],
        [cx + hw, cy - hh + by],
        [cx + hw, cy + hh - by],
        [cx + hw - bx, cy + hh],
        [cx - hw + bx, cy + hh],
        [cx - hw, cy + hh - by],
        [cx - hw, cy - hh + by],
      ];
    }
    case 'island_catwalk': {
      const bx = hw * 0.22;
      const by = hh * 0.22;
      return [
        [cx - hw + bx, cy - hh],
        [cx + hw - bx, cy - hh],
        [cx + hw, cy - hh + by],
        [cx + hw, cy + hh - by],
        [cx + hw - bx, cy + hh],
        [cx - hw + bx, cy + hh],
        [cx - hw, cy + hh - by],
        [cx - hw, cy - hh + by],
      ];
    }
    default:
      return [
        [cx - hw, cy - hh],
        [cx + hw, cy - hh],
        [cx + hw, cy + hh],
        [cx - hw, cy + hh],
      ];
  }
}

export function drawMinimapRoomSilhouette(
  g: Phaser.GameObjects.Graphics,
  shape: string,
  cx: number,
  cy: number,
  nodeW: number,
  nodeH: number,
  fillNum: number,
  fillAlpha: number,
  borderColor: number,
  borderWidth = 1,
  orientation = 0,
): void {
  const poly = computeMinimapRoomPolygon(shape, cx, cy, nodeW, nodeH, orientation);
  if (poly.length === 0) return;

  const isIslandCatwalk = shape === 'island_catwalk';
  const outerFill = isIslandCatwalk ? UI_THEME.inkDeep : fillNum;
  const outerAlpha = isIslandCatwalk ? Math.min(0.96, fillAlpha + 0.12) : fillAlpha;

  g.fillStyle(outerFill, outerAlpha);
  g.lineStyle(borderWidth, borderColor, 1);
  g.beginPath();
  g.moveTo(poly[0]![0], poly[0]![1]);
  for (let i = 1; i < poly.length; i++) {
    g.lineTo(poly[i]![0], poly[i]![1]);
  }
  g.closePath();
  g.fillPath();
  g.strokePath();

  if (
    shape === 'donut_ring' ||
    shape === 'ring_donut' ||
    shape === 'donut' ||
    shape === 'ring'
  ) {
    const holeW = Math.max(3, nodeW * 0.38);
    const holeH = Math.max(3, nodeH * 0.38);
    g.fillStyle(UI_THEME.panelBgDark, 0.96);
    g.fillRect(cx - holeW * 0.5, cy - holeH * 0.5, holeW, holeH);
    g.lineStyle(Math.max(0.9, borderWidth * 0.85), borderColor, 0.92);
    g.strokeRect(cx - holeW * 0.5, cy - holeH * 0.5, holeW, holeH);
  } else if (
    shape === 'multi_chamber' ||
    shape === 'split_wing' ||
    shape === 'split_twin_lobe' ||
    shape === 'twin_lobe' ||
    shape === 'asymmetric'
  ) {
    const hw = nodeW * 0.5;
    const hh = nodeH * 0.5;
    g.lineStyle(Math.max(0.9, borderWidth * 0.8), borderColor, 0.85);
    g.beginPath();
    g.moveTo(cx - hw * 0.18, cy - hh * 0.14);
    g.lineTo(cx + hw * 0.18, cy + hh * 0.14);
    g.strokePath();
  } else if (isIslandCatwalk) {
    const hw = nodeW * 0.5;
    const hh = nodeH * 0.5;
    const cw = hw * 0.24;
    const ch = hh * 0.24;
    const iw = hw * 0.52;
    const ih = hh * 0.52;
    const spanW = hw * 0.88;
    const spanH = hh * 0.88;
    const innerPoly: readonly [number, number][] = [
      [cx - cw, cy - spanH],
      [cx + cw, cy - spanH],
      [cx + cw, cy - ih],
      [cx + iw, cy - ih],
      [cx + iw, cy - ch],
      [cx + spanW, cy - ch],
      [cx + spanW, cy + ch],
      [cx + iw, cy + ch],
      [cx + iw, cy + ih],
      [cx + cw, cy + ih],
      [cx + cw, cy + spanH],
      [cx - cw, cy + spanH],
      [cx - cw, cy + ih],
      [cx - iw, cy + ih],
      [cx - iw, cy + ch],
      [cx - spanW, cy + ch],
      [cx - spanW, cy - ch],
      [cx - iw, cy - ch],
      [cx - iw, cy - ih],
      [cx - cw, cy - ih],
    ];
    g.fillStyle(fillNum, fillAlpha);
    g.lineStyle(Math.max(0.8, borderWidth * 0.75), borderColor, 0.88);
    g.beginPath();
    g.moveTo(innerPoly[0]![0], innerPoly[0]![1]);
    for (let i = 1; i < innerPoly.length; i++) {
      g.lineTo(innerPoly[i]![0], innerPoly[i]![1]);
    }
    g.closePath();
    g.fillPath();
    g.strokePath();
  }
}

export function canTeleportFromCurrentRoom(
  sim: ReturnType<GameScene['transport']['getSim']>,
): boolean {
  if (!sim || sim.inHub || sim.runState !== 'playing') return false;
  if (sim.player && sim.player.lifeState !== 'alive') return false;
  const curRoom = sim.getCurrentRoom?.();
  if (!curRoom || !curRoom.cleared) return false;
  if (typeof sim.hasActiveCombatEnemies === 'function' && sim.hasActiveCombatEnemies()) {
    return false;
  }
  if (sim.secretTrialActive) return false;
  if (Array.isArray(sim.doors) && sim.doors.some((d) => d.locked && !d.isSecretPassage)) {
    return false;
  }
  return true;
}

export function resolveMinimapClickedRoomId(
  scene: Pick<GameScene, 'transport'> &
    Partial<Pick<GameScene, 'fullMapOpen' | 'hudPadX' | 'hudPadY' | 'currentHudUiScale'>>,
  localViewX: number,
  localViewY: number,
): number | null {
  const sim = scene.transport?.getSim?.();
  if (!sim || sim.inHub) return null;
  const rooms = sim.dungeon?.rooms;
  if (!rooms || rooms.length === 0) return null;

  const settingsScale = clampUiScale(graphicsSettings.getState().uiScale);
  const sceneScale =
    typeof scene.currentHudUiScale === 'number' && scene.currentHudUiScale > 0
      ? clampUiScale(scene.currentHudUiScale)
      : 1;
  const uiScale = settingsScale !== 1 ? settingsScale : sceneScale;
  const padX = scene.hudPadX ?? 0;
  const padY = scene.hudPadY ?? 0;

  const mapLocalX = (localViewX - (WORLD_VIEW_WIDTH + padX)) / uiScale;
  const mapLocalY = (localViewY + padY) / uiScale;

  const fullMapOpen = Boolean(scene.fullMapOpen);
  const panelW = fullMapOpen ? 420 : 172;
  const panelH = fullMapOpen ? 280 : 102;
  const panelX = fullMapOpen ? -480 - panelW * 0.5 : -184;
  const panelY = fullMapOpen ? 110 : 10;

  if (
    mapLocalX < panelX ||
    mapLocalX > panelX + panelW ||
    mapLocalY < panelY ||
    mapLocalY > panelY + panelH
  ) {
    return null;
  }

  let minGx = 99;
  let maxGx = -99;
  let minGy = 99;
  let maxGy = -99;
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!;
    if (r.gx < minGx) minGx = r.gx;
    if (r.gx > maxGx) maxGx = r.gx;
    if (r.gy < minGy) minGy = r.gy;
    if (r.gy > maxGy) maxGy = r.gy;
  }

  const spanX = Math.max(1, maxGx - minGx + 1);
  const spanY = Math.max(1, maxGy - minGy + 1);

  const cellStep = fullMapOpen
    ? Math.min(52, Math.floor((panelW - 56) / spanX), Math.floor((panelH - 52) / spanY))
    : Math.min(24, Math.floor((panelW - 24) / spanX), Math.floor((panelH - 22) / spanY));

  const originX = panelX + (panelW - (spanX - 1) * cellStep) * 0.5;
  const originY = panelY + (panelH - (spanY - 1) * cellStep) * 0.5;

  const isVisitedOrCleared = (rm: DungeonRoomNode) =>
    rm.discovery === 'visited' || rm.discovery === 'cleared' || rm.id === sim.currentRoomId;

  const hitPad = fullMapOpen ? 4 : 2;
  let bestRoomId: number | null = null;
  let bestDistSq = Infinity;

  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!;
    if (!isVisitedOrCleared(r)) continue;

    const cx = originX + (r.gx - minGx) * cellStep;
    const cy = originY + (r.gy - minGy) * cellStep;
    const isCurrent = r.id === sim.currentRoomId;
    const effectivePreset = isCurrent
      ? ((sim.map as { roomSizePreset?: string })?.roomSizePreset ??
        (sim.map?.lastLayoutResult as { roomSizePreset?: string } | null)?.roomSizePreset ??
        r.roomSizePreset)
      : r.roomSizePreset;
    const effectiveCols = isCurrent ? (sim.map?.cols ?? 36) : (r.cols ?? 36);
    const effectiveRows = isCurrent ? (sim.map?.rows ?? 22) : (r.rows ?? 22);
    const { nodeW, nodeH } = resolveMinimapNodeDims(
      cellStep,
      effectivePreset,
      effectiveCols,
      effectiveRows,
    );

    const halfW = Math.min(cellStep * 0.48, nodeW * 0.5 + hitPad);
    const halfH = Math.min(cellStep * 0.48, nodeH * 0.5 + hitPad);
    const dx = mapLocalX - cx;
    const dy = mapLocalY - cy;

    if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestRoomId = r.id;
      }
    }
  }

  return bestRoomId;
}

export function updateMinimapHudImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  const room = sim.getCurrentRoom();
  const uiScale = graphicsSettings.getState().uiScale;
  const pNormX = Math.round(clamp(sim.player.x / Math.max(1, sim.map.width), 0, 1) * 16);
  const pNormY = Math.round(clamp(sim.player.y / Math.max(1, sim.map.height), 0, 1) * 16);
  const liveShape =
    (sim.map as { roomShape?: string }).roomShape ??
    sim.map.lastLayoutResult?.roomShape ??
    room.roomShape ??
    'rectangle';
  const livePreset =
    (sim.map as { roomSizePreset?: string }).roomSizePreset ??
    (sim.map.lastLayoutResult as { roomSizePreset?: string } | null)?.roomSizePreset ??
    room.roomSizePreset ??
    'standard';
  let roomsTopologySig = '';
  for (let i = 0; i < sim.dungeon.rooms.length; i++) {
    const rm = sim.dungeon.rooms[i]!;
    roomsTopologySig += `${rm.id}:${rm.roomShape ?? 'r'}:${rm.roomSizePreset ?? 's'}:${rm.discovery}:${rm.cleared ? 1 : 0};`;
  }
  const canTeleport = canTeleportFromCurrentRoom(sim);
  const gState = graphicsSettings.getState();
  const mapLabel = graphicsSettings.getActionKeyLabel('toggleMap');
  const minimapHash = `${sim.inHub ? 'hub' : sim.currentFloor}:${sim.currentBiome}:${sim.currentRoomId}:${this.fullMapOpen ? 1 : 0}:${sim.secretWallBroken ? 1 : 0}:${room.cleared ? 1 : 0}:${canTeleport ? 1 : 0}:${sim.runStats.roomsCleared}:${sim.pings.length}:${i18n.getLocale()}:${this.hudPadX}:${this.hudPadY}:${uiScale}:${liveShape}:${livePreset}:${sim.map.cols}x${sim.map.rows}:${sim.map.mapRevision}:${pNormX},${pNormY}:${roomsTopologySig}:${serializeKeybindingsHash(gState.keybindings)}`;
  if (minimapHash === this.lastMinimapHash && !sim.stressTestActive) return;
  this.lastMinimapHash = minimapHash;

  const g = this.minimapGraphics;
  g.clear();

  const isEn = i18n.getLocale() === 'en';
  const biomeAccent = getBiomeUiAccent(sim.inHub ? 0 : sim.currentBiome);
  const biomeName = i18n.biomeName(sim.currentBiome);
  const roomOrd = Math.max(1, room.id + 1);
  const rawFullTitle = this.fullMapOpen
    ? i18n.t('ui.minimap.fullTitle', {
        floor: sim.currentFloor,
        max: sim.campaignMaxFloors,
        roomType: sim.inHub ? i18n.roomTypeLabel('hub') : i18n.roomTypeLabel(room.type),
      })
    : '';
  const titleStr = this.fullMapOpen
    ? mapLabel === 'Tab'
      ? rawFullTitle
      : rawFullTitle.replace(/\[Tab\]/gi, `[${mapLabel}]`)
    : sim.inHub
      ? isEn
        ? `Campfire Hub · [${mapLabel}] Map`
        : `Doanh Trại · [${mapLabel}] Bản Đồ`
      : isEn
        ? `Floor ${sim.currentFloor}-${roomOrd} · ${biomeName}`
        : `Tầng ${sim.currentFloor}-${roomOrd} · ${biomeName}`;

  if (this.minimapTitleText.text !== titleStr) {
    this.minimapTitleText.setText(titleStr);
  }

  const rooms = sim.dungeon.rooms;
  let minGx = 99;
  let maxGx = -99;
  let minGy = 99;
  let maxGy = -99;
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!;
    if (r.gx < minGx) minGx = r.gx;
    if (r.gx > maxGx) maxGx = r.gx;
    if (r.gy < minGy) minGy = r.gy;
    if (r.gy > maxGy) maxGy = r.gy;
  }

  const spanX = Math.max(1, maxGx - minGx + 1);
  const spanY = Math.max(1, maxGy - minGy + 1);

  // Local coordinates inside hudTopRightContainer (anchored at WORLD_VIEW_WIDTH + padX, -padY)
  const panelW = this.fullMapOpen ? 420 : 172;
  const panelH = this.fullMapOpen ? 280 : 102;
  const panelX = this.fullMapOpen ? -480 - panelW * 0.5 : -184;
  const panelY = this.fullMapOpen ? 110 : 10;

  drawStyledPanel(g, panelX, panelY, panelW, panelH, {
    fillColor: UI_THEME.panelBg,
    fillAlpha: this.fullMapOpen ? 0.94 : UI_THEME.minimapBgAlpha,
    borderColor: UI_THEME.panelBorder,
    borderWidth: 1.4,
    radius: UI_THEME.panelRadius.md,
    accentColor: biomeAccent.accentNum,
    accentSide: 'top',
  });

  // Floor & Biome badge pill directly below the minimap
  const badgeX = panelX;
  const badgeY = panelY + panelH + 4;
  const badgeW = panelW;
  const badgeH = 21;
  drawStyledPanel(g, badgeX, badgeY, badgeW, badgeH, {
    fillColor: UI_THEME.panelBgDark,
    fillAlpha: 0.88,
    borderColor: UI_THEME.panelBorder,
    borderWidth: 1.1,
    radius: UI_THEME.panelRadius.sm,
    accentColor: biomeAccent.accentNum,
    accentSide: 'left',
  });
  drawVectorHudIcon(g, 'stairs', badgeX + 11, badgeY + badgeH * 0.5, 4.2, biomeAccent.accentNum);
  this.minimapTitleText.setOrigin(0, 0.5);
  this.minimapTitleText.setPosition(badgeX + 20, badgeY + badgeH * 0.5);

  const cellStep = this.fullMapOpen
    ? Math.min(52, Math.floor((panelW - 56) / spanX), Math.floor((panelH - 52) / spanY))
    : Math.min(24, Math.floor((panelW - 24) / spanX), Math.floor((panelH - 22) / spanY));

  const originX = panelX + (panelW - (spanX - 1) * cellStep) * 0.5;
  const originY = panelY + (panelH - (spanY - 1) * cellStep) * 0.5;

  const isVisitedOrCleared = (rm: DungeonRoomNode) =>
    rm.discovery === 'visited' || rm.discovery === 'cleared' || rm.id === sim.currentRoomId;

  const resolveRoomNodeInfo = (
    rm: DungeonRoomNode,
  ): { isCurrent: boolean; effectiveShape: string; nodeW: number; nodeH: number } => {
    const isCurrent = rm.id === sim.currentRoomId;
    const effectiveShape = isCurrent
      ? ((sim.map as { roomShape?: string }).roomShape ??
        sim.map.lastLayoutResult?.roomShape ??
        rm.roomShape ??
        'rectangle')
      : (rm.roomShape ?? 'rectangle');
    const effectivePreset = isCurrent
      ? ((sim.map as { roomSizePreset?: string }).roomSizePreset ??
        (sim.map.lastLayoutResult as { roomSizePreset?: string } | null)?.roomSizePreset ??
        rm.roomSizePreset)
      : rm.roomSizePreset;
    const effectiveCols = isCurrent ? sim.map.cols : (rm.cols ?? 36);
    const effectiveRows = isCurrent ? sim.map.rows : (rm.rows ?? 22);
    const { nodeW, nodeH } = resolveMinimapNodeDims(
      cellStep,
      effectivePreset,
      effectiveCols,
      effectiveRows,
    );
    return { isCurrent, effectiveShape, nodeW, nodeH };
  };

  // 1. Corridors between entered rooms (clipped to outer room borders)
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!;
    if (!isVisitedOrCleared(r)) continue;
    const cx = originX + (r.gx - minGx) * cellStep;
    const cy = originY + (r.gy - minGy) * cellStep;
    const srcDims = resolveRoomNodeInfo(r);

    for (const targetId of Object.values(r.connections)) {
      if (targetId === undefined) continue;
      let target: DungeonRoomNode | undefined;
      for (let j = 0; j < rooms.length; j++) {
        if (rooms[j]!.id === targetId) {
          target = rooms[j]!;
          break;
        }
      }
      if (!target || !isVisitedOrCleared(target)) continue;

      const tx = originX + (target.gx - minGx) * cellStep;
      const ty = originY + (target.gy - minGy) * cellStep;
      const dstDims = resolveRoomNodeInfo(target);
      g.fillStyle(UI_THEME.panelBorderHighlight, 0.82);

      if (Math.abs(tx - cx) >= Math.abs(ty - cy)) {
        const leftIsSrc = cx <= tx;
        const leftX = leftIsSrc ? cx : tx;
        const rightX = leftIsSrc ? tx : cx;
        const leftW = leftIsSrc ? srcDims.nodeW : dstDims.nodeW;
        const rightW = leftIsSrc ? dstDims.nodeW : srcDims.nodeW;
        const x0 = leftX + leftW * 0.46;
        const x1 = rightX - rightW * 0.46;
        const segW = Math.max(1.5, x1 - x0);
        const segX = x1 > x0 ? x0 : (leftX + rightX - segW) * 0.5;
        g.fillRect(segX, (cy + ty) * 0.5 - 1, segW, 2);
      } else {
        const topIsSrc = cy <= ty;
        const topY = topIsSrc ? cy : ty;
        const botY = topIsSrc ? ty : cy;
        const topH = topIsSrc ? srcDims.nodeH : dstDims.nodeH;
        const botH = topIsSrc ? dstDims.nodeH : srcDims.nodeH;
        const y0 = topY + topH * 0.46;
        const y1 = botY - botH * 0.46;
        const segH = Math.max(1.5, y1 - y0);
        const segY = y1 > y0 ? y0 : (topY + botY - segH) * 0.5;
        g.fillRect((cx + tx) * 0.5 - 1, segY, 2, segH);
      }
    }
  }

  // 2. Room Nodes (strictly entered rooms only: visited, cleared, or currentRoomId)
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!;
    const discovered = isVisitedOrCleared(r);
    if (!discovered) continue;

    const cx = originX + (r.gx - minGx) * cellStep;
    const cy = originY + (r.gy - minGy) * cellStep;

    let fillNum = UI_THEME.panelBgElevated;
    if (!discovered) {
      fillNum = UI_THEME.panelBgDark;
    } else if (r.type === 'boss') {
      fillNum = 0x991b1b;
    } else if (r.type === 'portal') {
      fillNum = 0x581c87;
    } else if (r.type === 'treasure' || r.type === 'merchant') {
      fillNum = 0x78350f;
    } else if (r.type === 'shrine') {
      fillNum = 0x0c4a6e;
    } else if (r.type === 'secret') {
      fillNum = 0x4c1d95;
    } else if (r.cleared) {
      fillNum = 0x1e3a2f;
    }

    const { isCurrent, effectiveShape, nodeW, nodeH } = resolveRoomNodeInfo(r);

    const bw = isCurrent ? 1.5 : 1;
    const borderColor = isCurrent
      ? 0xfacc15
      : discovered
        ? UI_THEME.panelBorderHighlight
        : UI_THEME.panelBorder;
    const fillAlpha = discovered ? 0.96 : 0.65;

    drawMinimapRoomSilhouette(
      g,
      effectiveShape,
      cx,
      cy,
      nodeW,
      nodeH,
      fillNum,
      fillAlpha,
      borderColor,
      bw,
      0,
    );

    if (this.fullMapOpen && canTeleport && !isCurrent) {
      g.lineStyle(1.2, 0x38bdf8, 0.85);
      g.strokeRect(
        cx - nodeW * 0.5 - 1.5,
        cy - nodeH * 0.5 - 1.5,
        nodeW + 3,
        nodeH + 3,
      );
    }

    const iconSize = this.fullMapOpen ? 4.8 : 2.8;
    if (discovered) {
      if (r.type === 'boss') {
        drawVectorHudIcon(g, 'skull', cx, cy, iconSize, 0xfca5a5);
      } else if (r.type === 'portal') {
        drawVectorHudIcon(g, 'portal', cx, cy, iconSize, 0xc084fc);
      } else if (r.type === 'treasure') {
        drawVectorHudIcon(g, 'chest', cx, cy, iconSize, 0xfacc15);
      } else if (r.type === 'merchant') {
        drawVectorHudIcon(g, 'coin', cx, cy, iconSize, 0xfbbf24);
      } else if (r.type === 'shrine') {
        drawVectorHudIcon(g, 'shrine', cx, cy, iconSize, 0x38bdf8);
      } else if (r.cleared && !isCurrent) {
        const dotR = this.fullMapOpen ? 2.2 : 1.5;
        g.fillStyle(0x4ade80, 0.9);
        g.fillRect(cx - dotR, cy - dotR, dotR * 2, dotR * 2);
      }

      if (isCurrent) {
        const normX = clamp(sim.player.x / Math.max(1, sim.map.width), 0.12, 0.88) - 0.5;
        const normY = clamp(sim.player.y / Math.max(1, sim.map.height), 0.12, 0.88) - 0.5;
        const isCompactSmallNode = !this.fullMapOpen && Math.min(nodeW, nodeH) <= 12;
        const dotR = this.fullMapOpen ? 3.2 : isCompactSmallNode ? 1.4 : 2.0;
        const outlinePad = this.fullMapOpen ? 1.0 : isCompactSmallNode ? 0.7 : 1.0;
        let dotX = cx + normX * Math.max(4, nodeW - 4);
        let dotY = cy + normY * Math.max(4, nodeH - 4);

        if (
          effectiveShape === 'donut_ring' ||
          effectiveShape === 'ring_donut' ||
          effectiveShape === 'donut' ||
          effectiveShape === 'ring'
        ) {
          const holeHalfW = Math.max(3, nodeW * 0.38) * 0.5;
          const holeHalfH = Math.max(3, nodeH * 0.38) * 0.5;
          const minClearX = Math.min(nodeW * 0.42, holeHalfW + dotR * 0.75);
          const minClearY = Math.min(nodeH * 0.42, holeHalfH + dotR * 0.75);
          if (Math.abs(dotX - cx) < minClearX && Math.abs(dotY - cy) < minClearY) {
            if (Math.abs(normX) >= Math.abs(normY)) {
              dotX = cx + (normX < 0 ? -minClearX : minClearX);
            } else {
              dotY = cy + (normY < 0 ? -minClearY : minClearY);
            }
          }
        }

        g.fillStyle(UI_THEME.inkDeep, 0.95);
        g.fillCircle(dotX, dotY, dotR + outlinePad);
        g.fillStyle(UI_THEME.status.goldBright, 1);
        g.fillCircle(dotX, dotY, dotR);
      }
    }
  }
}

export function updateBossHudImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  scratchAliveBosses.length = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.isBoss && e.hp > 0) {
      scratchAliveBosses.push(e);
    }
  }
  const boss = scratchAliveBosses[0] ?? null;
  const stunActive = boss && boss.aiState === 'stunned' && boss.stateTimer > 0 ? 1 : 0;
  const transActive = boss && (boss.bossPhaseTransitionTimer ?? 0) > 0 ? 1 : 0;
  const bossExt = boss as unknown as Record<string, number | undefined> | null;
  const bossElapsed = boss ? Number(boss.bossCombatElapsedSec ?? bossExt?.bossFightElapsedSec ?? 0) : 0;
  const enrageLvl = boss
    ? Math.max(
        boss.bossEnrageLevel ?? 0,
        bossExt?.bossEnrageStacks ?? 0,
        bossElapsed >= 90 ? Math.floor((bossElapsed - 90) / 15) + 1 : 0,
      )
    : 0;
  const coreWin = Math.ceil(sim.titanCoreWindowTimer);
  const trailKey = Math.round(this.trailingBossHpRatio * 200);
  const staggerKey = boss ? Math.round(boss.bossStaggerAccum ?? 0) : 0;
  const staggerCdKey = boss && (boss.bossStaggerCooldownTimer ?? 0) > 0 ? 1 : 0;
  const armorShellKey = boss?.bossArmorShellActive ? 1 : 0;
  const armorVulnKey = boss && (boss.bossArmorBreakVulnTimer ?? 0) > 0 ? 1 : 0;
  const bossHash =
    !boss || this.fullMapOpen || sim.runState !== 'playing'
      ? ''
      : `${boss.defId}:${boss.id}:${boss.hp}:${boss.maxHp}:${boss.bossPhase}:${stunActive}:${transActive}:${enrageLvl}:${coreWin}:${trailKey}:${staggerKey}:${staggerCdKey}:${armorShellKey}:${armorVulnKey}:${i18n.getLocale()}`;
  if (bossHash === this.lastBossHudHash) return;
  this.lastBossHudHash = bossHash;

  const g = this.bossBarGraphics;
  g.clear();

  if (!boss || this.fullMapOpen || sim.runState !== 'playing') {
    this.bossTitleText.setVisible(false);
    drawBossArmorFrameAndTacticalHintHud(this, g, null, 0, 0, 0, 0, 0, 0, 0, 0);
    return;
  }

  this.bossTitleText.setVisible(true);
  const bossDef = ENEMIES[boss.defId];
  const bossName = i18n
    .enemyName(boss.defId, bossDef?.nameVi ?? 'Mục Vương Nấm Độc')
    .toUpperCase();
  const isEn = i18n.getLocale() === 'en';
  const shellBadge = boss.bossArmorShellActive
    ? boss.defId === 'spore_king'
      ? ' · [-70% DMG]'
      : ' · [-75% DMG]'
    : '';
  const statusSuffix =
    transActive > 0
      ? isEn
        ? ' [INVULNERABLE]'
        : ' [BẤT TỬ · CHUYỂN PHA]'
      : enrageLvl > 0
        ? isEn
          ? ` [ENRAGE ×${enrageLvl}]`
          : ` [CUỒNG NỘ ×${enrageLvl}]`
        : boss.bossArmorShellActive
          ? shellBadge
          : boss.aiState === 'stunned' && boss.stateTimer > 0
            ? i18n.t('ui.boss.stunned')
            : sim.titanCoreWindowTimer > 0
              ? i18n.t('ui.boss.breakCores', {
                  sec: Math.ceil(sim.titanCoreWindowTimer),
                })
              : '';
  const titleStr = i18n.t('ui.boss.titleFormat', {
    name: bossName,
    phase: boss.bossPhase,
    hp: boss.hp,
    maxHp: boss.maxHp,
    suffix: statusSuffix,
  });
  if (this.bossTitleText.text !== titleStr) {
    this.bossTitleText.setText(titleStr);
  }

  // Local coordinates inside hudTopCenterContainer (anchored at x = 480, y = -padY)
  const panelW = 348;
  const panelH = 42;
  const panelX = -panelW * 0.5;
  const panelY = 8;

  const phaseAccent =
    transActive > 0
      ? 0xfacc15
      : enrageLvl > 0
        ? 0xff2a2a
        : boss.bossPhase === 3
          ? 0xa855f7
          : boss.bossPhase === 2
            ? 0xf97316
            : 0xe84545;

  drawStyledPanel(g, panelX, panelY, panelW, panelH, {
    fillColor: UI_THEME.panelBgDark,
    fillAlpha: 0.9,
    borderColor: phaseAccent,
    borderWidth: 1.5,
    radius: UI_THEME.panelRadius.md,
    accentColor: phaseAccent,
    accentSide: 'top',
  });

  drawVectorHudIcon(g, 'skull', panelX + 14, panelY + 20, 5.5, phaseAccent);
  this.bossTitleText.setOrigin(0.5, 0.5);
  this.bossTitleText.setPosition(8, panelY + 11);

  const bx = panelX + 26;
  const by = panelY + 20;
  const bw = panelW - 36;
  const bh = 9.0;

  const fillCol =
    boss.defId === 'kryssa_ice_queen'
      ? boss.bossPhase === 3
        ? 0x0284c7
        : 0x38bdf8
      : boss.defId === 'forge_titan'
        ? boss.bossPhase === 3
          ? 0xdc2626
          : 0xf97316
        : phaseAccent;

  drawSegmentedBar(g, {
    x: bx,
    y: by,
    width: bw,
    height: bh,
    current: boss.hp,
    max: boss.maxHp,
    trailingRatio: this.trailingBossHpRatio,
    maxSegments: 12,
    gap: 1.5,
    fillColor: fillCol,
    fillDarkColor: 0x7f1d1d,
    trailColor: 0xfacc15,
    borderColor: UI_THEME.inkDark,
  });

  // Phase threshold notch markers at 33% and 66%
  for (const mark of [0.3333, 0.6667]) {
    const mx = bx + bw * mark;
    g.lineStyle(1.6, 0xfacc15, 0.95);
    g.beginPath();
    g.moveTo(mx, by - 1);
    g.lineTo(mx, by + bh + 1);
    g.strokePath();
  }

  // P3B.1 Orange-Gold Boss Stagger Bar right beneath the Boss HP bar
  drawBossStaggerBarHud(g, boss, bx, by + bh + 3, bw);
  // P3B.5 Reinforced Boss Armor Shell Frame & Tactical Hint / Vuln Banner
  drawBossArmorFrameAndTacticalHintHud(this, g, boss, panelX, panelY, panelW, panelH, bx, by, bw, bh);
}

export function updateTopCenterBannersAndQolImpl(this: GameScene, dtSec: number): void {
  const sim = this.transport.getSim();
  const room = sim.getCurrentRoom();
  const isEn = i18n.getLocale() === 'en';
  const uiScale = this.currentHudUiScale || graphicsSettings.getState().uiScale;

  updateP11RemainingEnemiesHud(this);

  const hpRatio = clamp(sim.player.hp / Math.max(1, sim.player.maxHp), 0, 1);
  const activeBoss = sim.getActiveBoss();
  const bossExt = activeBoss as unknown as Record<string, number | undefined> | null;
  const bossElapsed = activeBoss
    ? Number(activeBoss.bossCombatElapsedSec ?? bossExt?.bossFightElapsedSec ?? 0)
    : 0;
  const bossEnrageLvl = activeBoss
    ? Math.max(
        activeBoss.bossEnrageLevel ?? 0,
        bossExt?.bossEnrageStacks ?? 0,
        bossElapsed >= 90 ? Math.floor((bossElapsed - 90) / 15) + 1 : 0,
      )
    : 0;
  musicManager.setIntensityBoost(
    computeMusicIntensityBoost(hpRatio, bossEnrageLvl, activeBoss?.bossPhase ?? 0),
  );

  // Detect room / wave transitions automatically
  if (sim.currentRoomId !== this.lastBannerRoomId) {
    this.lastBannerRoomId = sim.currentRoomId;
    this.lastBannerWaveNumber = sim.waveNumber;
    this.lastBannerRoomCleared = room.cleared;
  } else if (!sim.inHub && sim.runState === 'playing') {
    if (sim.waveNumber > 0 && sim.waveNumber !== this.lastBannerWaveNumber && !room.cleared) {
      this.lastBannerWaveNumber = sim.waveNumber;
      this.triggerWaveBanner(Math.max(1, room.wavesSpawned || 1), room.wavesTotal || 3);
    }
    if (room.cleared && !this.lastBannerRoomCleared && room.type === 'combat') {
      this.lastBannerRoomCleared = true;
      this.triggerRoomClearedBanner();
    }
  }

  if (this.hudBannerTimer > 0) {
    this.hudBannerTimer = Math.max(0, this.hudBannerTimer - dtSec);
  }
  if (this.playerHitIndicatorTimer > 0) {
    this.playerHitIndicatorTimer = Math.max(0, this.playerHitIndicatorTimer - dtSec);
  }

  // 1. Top-Center Wave / Room Cleared Banner + Coalesced Reaction Banner
  const bossActive = Boolean(this.bossTitleText?.visible);
  const secretTrialHudVisible = Boolean(
    sim.secretTrialActive || (sim.secretTrialBannerTimer ?? 0) > 0,
  );
  let bannerCurY = bossActive
    ? isBossHudHintBannerVisible(this)
      ? 75
      : 52
    : secretTrialHudVisible
      ? 58
      : 10;

  if (this.waveBannerGraphics && this.waveBannerText) {
    const showWaveBanner = Boolean(
      this.hudBannerTimer > 0 && this.hudBannerTextStr && !this.fullMapOpen,
    );
    if (showWaveBanner) {
      this.waveBannerGraphics.clear();
      if (this.waveBannerText.text !== this.hudBannerTextStr) {
        this.waveBannerText.setText(this.hudBannerTextStr);
      }
      const alpha = clamp(this.hudBannerTimer / 0.25, 0, 1);
      const bw = Math.max(186, Math.ceil(this.waveBannerText.width + 28));
      const bh = 22;
      const bx = -bw * 0.5;
      const by = bannerCurY;
      drawStyledPanel(this.waveBannerGraphics, bx, by, bw, bh, {
        fillColor: UI_THEME.panelBgDark,
        fillAlpha: 0.9 * alpha,
        borderColor: this.hudBannerAccentColor,
        borderWidth: 1.5,
        radius: UI_THEME.panelRadius.sm,
        accentColor: this.hudBannerAccentColor,
        accentSide: 'top',
      });
      this.waveBannerText.setPosition(0, by + bh * 0.5);
      this.waveBannerText.setAlpha(alpha);
      if (!this.waveBannerText.visible) this.waveBannerText.setVisible(true);
      bannerCurY += bh + 4;
    } else if (this.waveBannerText.visible) {
      this.waveBannerGraphics.clear();
      this.waveBannerText.setVisible(false);
    }
  }

  if (this.reactionBannerGraphics && this.reactionBannerText) {
    const rxBanner = this.fx.getActiveReactionBanner();
    const showRxBanner = Boolean(rxBanner && rxBanner.displayTimerSec > 0 && !this.fullMapOpen);
    if (showRxBanner && rxBanner) {
      this.reactionBannerGraphics.clear();
      const alpha = clamp(rxBanner.displayTimerSec / 0.25, 0, 1);
      const rxCol = hexToNum(rxBanner.colorHex);
      const dmgTag = rxBanner.totalDamage > 0 ? ` (+${rxBanner.totalDamage})` : '';
      const comboPrefix = rxBanner.isTeamCombo ? '⚡ ' : '✦ ';
      const fullLabel = `${comboPrefix}${rxBanner.label}${dmgTag}`;
      if (this.reactionBannerText.text !== fullLabel) {
        this.reactionBannerText.setText(fullLabel);
      }
      if (this.reactionBannerText.style.color !== rxBanner.colorHex) {
        this.reactionBannerText.setColor(rxBanner.colorHex);
      }
      const bw = Math.max(176, Math.ceil(this.reactionBannerText.width + 24));
      const bh = 22;
      const bx = -bw * 0.5;
      const by = bannerCurY;
      drawStyledPanel(this.reactionBannerGraphics, bx, by, bw, bh, {
        fillColor: UI_THEME.panelBgDark,
        fillAlpha: 0.92 * alpha,
        borderColor: rxCol,
        borderWidth: 1.5,
        radius: UI_THEME.panelRadius.sm,
        accentColor: rxCol,
        accentSide: 'left',
      });
      this.reactionBannerText.setPosition(0, by + bh * 0.5);
      this.reactionBannerText.setAlpha(alpha);
      if (!this.reactionBannerText.visible) this.reactionBannerText.setVisible(true);
    } else if (this.reactionBannerText.visible) {
      this.reactionBannerGraphics.clear();
      this.reactionBannerText.setVisible(false);
    }
  }

  // 2. Bottom-Center Downed / Revive Context Banner (when not obscured by Weapon Compare Card)
  if (this.downedBannerGraphics && this.downedBannerText) {
    const isPlayerDowned = (pl: typeof sim.player): boolean =>
      pl.lifeState === 'downed' || ((pl as { bleedoutTimer?: number }).bleedoutTimer ?? 0) > 0;
    let downedTarget = isPlayerDowned(sim.player) ? sim.player : null;
    if (!downedTarget) {
      for (let i = 0; i < sim.simulatedPlayers.length; i++) {
        const sp = sim.simulatedPlayers[i]!;
        if (isPlayerDowned(sp)) {
          if (!downedTarget || sp.reviveProgress > downedTarget.reviveProgress) {
            downedTarget = sp;
          }
        }
      }
    }

    const showDowned =
      downedTarget !== null &&
      !this.fullMapOpen &&
      !this.pauseModalOpen &&
      this.weaponCompareContainer.length === 0;
    if (showDowned && downedTarget) {
      this.downedBannerGraphics.clear();
      const revPct = Math.round(clamp(downedTarget.reviveProgress, 0, 1) * 100);
      const rawBleedTimer =
        (downedTarget as { bleedoutTimer?: number }).bleedoutTimer ?? downedTarget.downedTimer;
      const bleedSec = Math.max(0, rawBleedTimer).toFixed(1);
      const isReviving = downedTarget.reviveProgress > 0.01;
      const bw = 272;
      const bh = 38;
      const bx = -206;
      const by = -bh - 10;
      const borderCol = isReviving ? 0x4ade80 : 0xe84545;

      drawStyledPanel(this.downedBannerGraphics, bx, by, bw, bh, {
        fillColor: UI_THEME.panelBgDark,
        fillAlpha: 0.92,
        borderColor: borderCol,
        borderWidth: 1.6,
        radius: UI_THEME.panelRadius.md,
        accentColor: borderCol,
        accentSide: 'left',
      });

      drawVectorHudIcon(
        this.downedBannerGraphics,
        isReviving ? 'heart' : 'skull',
        bx + 15,
        by + 13,
        4.8,
        borderCol,
      );

      drawSegmentedBar(this.downedBannerGraphics, {
        x: bx + 26,
        y: by + 24,
        width: bw - 38,
        height: 7,
        current: isReviving ? downedTarget.reviveProgress * 10 : rawBleedTimer,
        max: isReviving ? 10 : 15,
        maxSegments: 10,
        fillColor: isReviving ? 0x4ade80 : 0xe84545,
        fillDarkColor: isReviving ? 0x16a34a : 0x991b1b,
      });

      const interactLabel = graphicsSettings.getActionKeyLabel('interact');
      const bannerLabel = isReviving
        ? isEn
          ? `REVIVING ${downedTarget.displayName.toUpperCase()} (${revPct}%) · Bleedout ${bleedSec}s`
          : `ĐANG CỨU ${downedTarget.displayName.toUpperCase()} (${revPct}%) · Hấp hối ${bleedSec}s`
        : isEn
          ? `${downedTarget.displayName.toUpperCase()} DOWNED (${bleedSec}s) · Hold [${interactLabel}] to Revive`
          : `${downedTarget.displayName.toUpperCase()} GỤC NGÃ (${bleedSec}s) · Giữ [${interactLabel}] Cứu`;

      if (this.downedBannerText.text !== bannerLabel) {
        this.downedBannerText.setText(bannerLabel);
      }
      const downedColor = isReviving ? '#4ADE80' : '#FCA5A5';
      if (this.downedBannerText.style.color !== downedColor) {
        this.downedBannerText.setColor(downedColor);
      }
      this.downedBannerText.setPosition(bx + 26, by + 13);
      if (!this.downedBannerText.visible) this.downedBannerText.setVisible(true);
    } else if (this.downedBannerText.visible) {
      this.downedBannerGraphics.clear();
      this.downedBannerText.setVisible(false);
    }
  }

  // 3. Player Directional Hit Indicator Arc on unscaled HudScene root
  if (this.playerHitArcGraphics) {
    const showHitArc =
      this.playerHitIndicatorTimer > 0 && !this.fullMapOpen && !this.pauseModalOpen;
    if (showHitArc) {
      this.playerHitArcGraphics.clear();
      const cam = this.cameras.main;
      const pPos = this.playerPosScratch;
      const screenX = pPos.x - cam.midPoint.x + WORLD_VIEW_WIDTH * 0.5;
      const screenY = pPos.y - cam.midPoint.y + WORLD_VIEW_HEIGHT * 0.5;
      const alpha = clamp(this.playerHitIndicatorTimer / 0.45, 0, 1);
      drawPlayerHitDirectionArc(
        this.playerHitArcGraphics,
        screenX,
        screenY,
        this.playerHitIndicatorAngleRad,
        alpha,
        uiScale,
      );
      this.playerHitArcGraphics.setVisible(true);
    } else if (this.playerHitArcGraphics.visible) {
      this.playerHitArcGraphics.clear();
      this.playerHitArcGraphics.setVisible(false);
    }
  }
}

export function updateOffscreenTeammateArrowsImpl(this: GameScene): void {
  const g = this.offscreenArrowGraphics;
  g.clear();

  const sim = this.transport.getSim();
  if (sim.stressTestActive || this.fullMapOpen) return;

  const cam = this.cameras.main;
  const view = cam.worldView;
  if (!view || view.width <= 0) return;

  const uiScale = this.currentHudUiScale || graphicsSettings.getState().uiScale;
  const minX = -this.hudPadX + 26;
  const maxX = WORLD_VIEW_WIDTH + this.hudPadX - 26;
  const minY = -this.hudPadY + 26;
  const maxY = WORLD_VIEW_HEIGHT + this.hudPadY - 26;

  // 1. Off-screen Co-op Teammate Arrows
  for (let i = 0; i < sim.simulatedPlayers.length; i++) {
    const cp = sim.simulatedPlayers[i]!;
    if (cp.id === sim.player.id) continue;

    const cpDowned =
      cp.lifeState === 'downed' || ((cp as { bleedoutTimer?: number }).bleedoutTimer ?? 0) > 0;
    const pos = this.transport.getInterpolatedSimPlayerPos(cp, this.entityPosScratch);
    const pose = computeOffscreenArrowPose({
      targetWorldX: pos.x,
      targetWorldY: pos.y,
      camMidX: cam.midPoint.x,
      camMidY: cam.midPoint.y,
      viewX: view.x,
      viewY: view.y,
      viewW: view.width,
      viewH: view.height,
      minScreenX: minX,
      maxScreenX: maxX,
      minScreenY: minY,
      maxScreenY: maxY,
      edgeBufferWorld: cpDowned ? 76 : 0,
    });
    if (!pose.isOffscreen) continue;

    const col = hexToNum(cpDowned ? PALETTE.CRIMSON_BRIGHT : PLAYER_SLOT_COLORS[cp.slot]);
    const s = clamp(uiScale, 0.8, 1.3);
    const tipX = pose.ax + Math.cos(pose.angleRad) * 10 * s;
    const tipY = pose.ay + Math.sin(pose.angleRad) * 10 * s;
    const leftX = pose.ax + Math.cos(pose.angleRad + 2.4) * 8.5 * s;
    const leftY = pose.ay + Math.sin(pose.angleRad + 2.4) * 8.5 * s;
    const rightX = pose.ax + Math.cos(pose.angleRad - 2.4) * 8.5 * s;
    const rightY = pose.ay + Math.sin(pose.angleRad - 2.4) * 8.5 * s;

    g.fillStyle(col, 0.95);
    g.lineStyle(1.8 * s, UI_THEME.inkDark, 1);
    g.beginPath();
    g.moveTo(tipX, tipY);
    g.lineTo(leftX, leftY);
    g.lineTo(rightX, rightY);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  // 2. Off-screen Enemy Directional Arrows (when 1..3 alive non-dummy enemies remain in room)
  if (!sim.inHub && sim.runState === 'playing') {
    scratchAliveEnemies.length = 0;
    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      const def = ENEMIES[e.defId];
      if (e.hp > 0 && !e.isDummy && !def?.isBoss) {
        scratchAliveEnemies.push(e);
      }
    }

    if (shouldShowOffscreenEnemyArrows(scratchAliveEnemies.length)) {
      const pScreenX = this.playerPosScratch.x - cam.midPoint.x + WORLD_VIEW_WIDTH * 0.5;
      const pScreenY = this.playerPosScratch.y - cam.midPoint.y + WORLD_VIEW_HEIGHT * 0.5;
      for (let i = 0; i < scratchAliveEnemies.length; i++) {
        const e = scratchAliveEnemies[i]!;
        const pose = computeOffscreenArrowPose({
          targetWorldX: e.x,
          targetWorldY: e.y,
          camMidX: cam.midPoint.x,
          camMidY: cam.midPoint.y,
          viewX: view.x,
          viewY: view.y,
          viewW: view.width,
          viewH: view.height,
          minScreenX: minX,
          maxScreenX: maxX,
          minScreenY: minY,
          maxScreenY: maxY,
          edgeBufferWorld: 92,
        });
        const distFromPlayer = Math.hypot(
          e.x - this.playerPosScratch.x,
          e.y - this.playerPosScratch.y,
        );
        if (!pose.isOffscreen && distFromPlayer < 360) continue;

        const eScreenX = e.x - cam.midPoint.x + WORLD_VIEW_WIDTH * 0.5;
        const eScreenY = e.y - cam.midPoint.y + WORLD_VIEW_HEIGHT * 0.5;
        const ang = Math.atan2(eScreenY - pScreenY, eScreenX - pScreenX);
        let ax = clamp(eScreenX - Math.cos(ang) * 28, minX, maxX);
        let ay = clamp(eScreenY - Math.sin(ang) * 28, minY, maxY);
        if (pose.isOffscreen) {
          ax = pose.ax;
          ay = pose.ay;
        }
        // Keep arrows clear of the top-right minimap and bottom-right weapon cards
        if (ax > 760 && ay < 158) {
          ax = 758;
        }
        if (ax > 590 && ay > 468) {
          ay = 466;
        }
        drawOffscreenEnemyArrow(g, ax, ay, ang, e.isElite, uiScale);
      }
    }
  }
}

export function renderViDiacriticsShowcaseImpl(this: GameScene): void {
  const ui = this.uiScene;
  if (this.viDiacriticsContainer) {
    this.viDiacriticsContainer.destroy(true);
  }
  this.hudTopLeftContainer?.setVisible(false);
  this.coopHudContainer?.setVisible(false);
  this.hudTopCenterContainer?.setVisible(false);
  this.hudTopRightContainer?.setVisible(false);
  this.hudBottomRightContainer?.setVisible(false);
  this.hudBottomCenterContainer?.setVisible(false);
  const c = ui.add.container(0, 0).setDepth(5200);
  this.viDiacriticsContainer = c;

  const textRes = computeUiTextResolution(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    ui.cameras?.main?.zoom || 2,
    1.0,
  );

  const bg = ui.add.graphics();
  drawStyledPanel(bg, 38, 24, 884, 492, {
    fillColor: UI_THEME.panelBgDark,
    fillAlpha: 0.96,
    borderColor: UI_THEME.panelBorderHighlight,
    borderWidth: 2,
    radius: UI_THEME.panelRadius.lg,
    accentColor: 0xfacc15,
    accentSide: 'top',
  });
  c.add(bg);

  const header = ui.add.text(
    62,
    38,
    'BẢNG KIỂM ĐỊNH TYPOGRAPHY & DẤU TIẾNG VIỆT (BE VIETNAM PRO — 12/14/16/20/28/40PX)',
    createUiTextStyle({
      fontPxAt1080p: 16,
      weight: 800,
      color: PALETTE.SOLAR_GOLD,
      resolution: textRes,
    }),
  );
  c.add(header);

  const specs: Array<{ px1080: number; weight: 600 | 700 | 800; color: string; sample: string }> = [
    {
      px1080: 12,
      weight: 600,
      color: PALETTE.SILVER_BRIGHT,
      sample:
        '[12px · 600] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · ĐỢT 2/3 · PHÒNG ĐÃ DỌN SẠCH · TẦNG 1-2 · RỪNG CỔ MỤC NÁT · SƯƠNG ĐỘC · QUÁI TỰ NỔ',
    },
    {
      px1080: 14,
      weight: 700,
      color: PALETTE.BONE_WHITE,
      sample:
        '[14px · 700] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · ĐỢT 2/3 · PHÒNG ĐÃ DỌN SẠCH · TẦNG 1-2 · RỪNG CỔ MỤC NÁT · SƯƠNG ĐỘC · QUÁI TỰ NỔ',
    },
    {
      px1080: 16,
      weight: 700,
      color: PALETTE.CYAN_FROST,
      sample:
        '[16px · 700] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · ĐỢT 2/3 · PHÒNG ĐÃ DỌN SẠCH · TẦNG 1-2 · RỪNG CỔ MỤC NÁT · SƯƠNG ĐỘC',
    },
    {
      px1080: 20,
      weight: 800,
      color: PALETTE.LIME_GLOW,
      sample:
        '[20px · 800] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · ĐỢT 2/3 · PHÒNG ĐÃ DỌN SẠCH · SƯƠNG ĐỘC · QUÁI TỰ NỔ',
    },
    {
      px1080: 28,
      weight: 800,
      color: PALETTE.SOLAR_GOLD,
      sample: '[28px · 800] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · ĐỢT 2/3 · PHÒNG ĐÃ DỌN SẠCH',
    },
    {
      px1080: 40,
      weight: 800,
      color: PALETTE.BONE_WHITE,
      sample: '[40px · 800] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · QUÁI TỰ NỔ',
    },
  ];

  let curY = 66;
  for (const row of specs) {
    const rowH = Math.max(32, Math.round(row.px1080 * 1.15) + 16);
    drawStyledPanel(bg, 56, curY, 848, rowH, {
      fillColor: UI_THEME.panelBg,
      fillAlpha: 0.78,
      borderColor: UI_THEME.panelBorder,
      borderWidth: 1,
      radius: UI_THEME.panelRadius.sm,
      accentColor: hexToNum(row.color),
      accentSide: 'left',
    });

    const style =
      row.px1080 === 12
        ? createSceneTextStyle({
            fontPxAt1080p: 12,
            weight: row.weight,
            color: row.color,
            resolution: textRes,
          })
        : createUiTextStyle({
            fontPxAt1080p: row.px1080,
            weight: row.weight,
            color: row.color,
            resolution: textRes,
          });

    const txt = ui.add.text(68, curY + rowH * 0.5, row.sample, style).setOrigin(0, 0.5);
    c.add(txt);
    curY += rowH + 8;
  }

  // Bottom HUD Primitive Showcase Strip inside specimen panel
  const chipSpace = drawKeyChip(bg, 62, 482, 'Space', { active: true });
  const chipShift = drawKeyChip(bg, 102, 482, 'Shift', { active: false });
  const chipE = drawKeyChip(bg, 138, 482, 'E', { active: true });
  for (const [chip, cx, col] of [
    [chipSpace, 62, PALETTE.SOLAR_GOLD],
    [chipShift, 102, PALETTE.SILVER_BRIGHT],
    [chipE, 138, PALETTE.SOLAR_GOLD],
  ] as const) {
    const kt = ui.add
      .text(
        cx + chip.width * 0.5,
        482 + chip.height * 0.5,
        chip.label,
        createUiTextStyle({
          fontPxAt1080p: 13,
          weight: 800,
          color: col,
          resolution: textRes,
        }),
      )
      .setOrigin(0.5, 0.5);
    c.add(kt);
  }
  drawSegmentedBar(bg, {
    x: 168,
    y: 484,
    width: 140,
    height: 9,
    current: 7,
    max: 8,
    trailingRatio: 0.95,
    maxSegments: 8,
    fillColor: UI_THEME.status.hp,
    fillDarkColor: UI_THEME.status.hpDark,
    trailColor: UI_THEME.status.hpTrail,
  });
  const footerNote = ui.add
    .text(
      322,
      488,
      'Padding top ≥ 4px · Line-height ≥ 1.30 · Không cắt dấu Tiếng Việt (Ở, Ữ, Ặ, Ố, Ề, Ử, Ẵ)',
      createUiTextStyle({
        fontPxAt1080p: 14,
        weight: 700,
        color: PALETTE.BONE_WHITE,
        resolution: textRes,
      }),
    )
    .setOrigin(0, 0.5);
  c.add(footerNote);
}
