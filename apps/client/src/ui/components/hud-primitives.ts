import { clamp, type CharacterId } from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { createUiTextStyle, UI_THEME } from '../theme.js';

export type HudVectorIconKind =
  | 'heart'
  | 'shield'
  | 'bolt'
  | 'coin'
  | 'skull'
  | 'skill'
  | 'dash'
  | 'sword'
  | 'chest'
  | 'portal'
  | 'shrine'
  | 'merchant'
  | 'stairs';

export interface SegmentedBarSegmentRect {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fillRatio: number;
}

export interface SegmentedBarGeometryInput {
  x: number;
  y: number;
  width: number;
  height: number;
  current: number;
  max: number;
  trailingRatio?: number;
  maxSegments?: number;
  gap?: number;
}

export interface SegmentedBarGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  segmentCount: number;
  fillRatio: number;
  filledWidth: number;
  trailingRatio: number;
  trailingWidth: number;
  filledSegments: number;
  partialSegmentRatio: number;
  segments: SegmentedBarSegmentRect[];
}

export function computeSegmentedBarGeometry(
  inputOrX: SegmentedBarGeometryInput | number,
  yArg = 0,
  widthArg = 100,
  heightArg = 8,
  currentArg = 1,
  maxArg = 1,
  maxSegmentsArg = 10,
): SegmentedBarGeometry {
  const opts: SegmentedBarGeometryInput =
    typeof inputOrX === 'number'
      ? {
          x: inputOrX,
          y: yArg,
          width: widthArg,
          height: heightArg,
          current: currentArg,
          max: maxArg,
          maxSegments: maxSegmentsArg,
        }
      : inputOrX;

  const safeMax = Math.max(1, opts.max);
  const fillRatio = clamp(opts.current / safeMax, 0, 1);
  const trailingRatio = clamp(opts.trailingRatio ?? fillRatio, fillRatio, 1);
  const maxSegs = Math.max(1, opts.maxSegments ?? 10);
  const rawSegments = opts.max <= maxSegs ? Math.max(1, Math.round(opts.max)) : maxSegs;
  const segmentCount = clamp(rawSegments, 1, maxSegs);
  const gap = segmentCount > 1 ? (opts.gap ?? 1.5) : 0;
  const segWidth = Math.max(2, (opts.width - gap * (segmentCount - 1)) / segmentCount);

  const exactFilled = fillRatio * segmentCount;
  const filledSegments = Math.min(segmentCount, Math.floor(exactFilled + 1e-6));
  const partialSegmentRatio = clamp(exactFilled - filledSegments, 0, 1);

  const segments: SegmentedBarSegmentRect[] = [];
  for (let i = 0; i < segmentCount; i += 1) {
    const segX = opts.x + i * (segWidth + gap);
    const segFill =
      i < filledSegments ? 1 : i === filledSegments && partialSegmentRatio > 0.01 ? partialSegmentRatio : 0;
    segments.push({
      index: i,
      x: Math.round(segX * 100) / 100,
      y: opts.y,
      width: Math.round(segWidth * 100) / 100,
      height: opts.height,
      fillRatio: segFill,
    });
  }

  return {
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    segmentCount,
    fillRatio,
    filledWidth: opts.width * fillRatio,
    trailingRatio,
    trailingWidth: opts.width * trailingRatio,
    filledSegments,
    partialSegmentRatio,
    segments,
  };
}

export interface CircularCooldownGeometryInput {
  cx: number;
  cy: number;
  radius: number;
  remainingSec: number;
  totalSec: number;
  activeSec?: number;
}

export interface CircularCooldownGeometry {
  cx: number;
  cy: number;
  radius: number;
  isReady: boolean;
  isActive: boolean;
  readyRatio: number;
  startAngleRad: number;
  endAngleRad: number;
  cooldownText: string;
}

export function computeCircularCooldownGeometry(
  inputOrCx: CircularCooldownGeometryInput | number,
  cyArg = 0,
  radiusArg = 14,
  remainingSecArg = 0,
  totalSecArg = 1,
  activeSecArg = 0,
): CircularCooldownGeometry {
  const opts: CircularCooldownGeometryInput =
    typeof inputOrCx === 'number'
      ? {
          cx: inputOrCx,
          cy: cyArg,
          radius: radiusArg,
          remainingSec: remainingSecArg,
          totalSec: totalSecArg,
          activeSec: activeSecArg,
        }
      : inputOrCx;

  const rem = Math.max(0, opts.remainingSec);
  const total = Math.max(0.1, opts.totalSec);
  const isReady = rem <= 0.02;
  const isActive = Math.max(0, opts.activeSec ?? 0) > 0.02;
  const readyRatio = isReady ? 1 : clamp(1 - rem / total, 0, 1);
  const startAngleRad = -Math.PI / 2;
  return {
    cx: opts.cx,
    cy: opts.cy,
    radius: opts.radius,
    isReady,
    isActive,
    readyRatio,
    startAngleRad,
    endAngleRad: startAngleRad + Math.PI * 2 * readyRatio,
    cooldownText: isReady ? '' : `${rem.toFixed(1)}s`,
  };
}

export interface KeyChipMetrics {
  label: string;
  width: number;
  height: number;
  radius: number;
  paddingX: number;
  paddingY: number;
  fontPx: number;
}

export function computeKeyChipMetrics(keyLabel: string, sceneFontPx = 6.5): KeyChipMetrics {
  const clean = keyLabel.replace(/^\[|\]$/g, '').trim() || 'E';
  const fontPx = Math.max(6.5, sceneFontPx);
  const paddingX = clean.length > 1 ? 4.5 : 3.5;
  const paddingY = 2.2;
  const width = Math.max(12, Math.ceil(clean.length * fontPx * 0.62 + paddingX * 2));
  const height = Math.max(11, Math.ceil(fontPx + paddingY * 2));
  return { label: clean, width, height, radius: 3, paddingX, paddingY, fontPx };
}

export interface StyledPanelOptions {
  fillColor?: number;
  fillAlpha?: number;
  borderColor?: number;
  borderAlpha?: number;
  borderWidth?: number;
  radius?: number;
  shadowAlpha?: number;
  topHighlightAlpha?: number;
  accentColor?: number;
  accentSide?: 'left' | 'top' | 'none';
}

export function drawStyledPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: StyledPanelOptions,
): void {
  const radius = opts?.radius ?? UI_THEME.panelRadius.md;
  const fillColor = opts?.fillColor ?? UI_THEME.panelBg;
  const fillAlpha = opts?.fillAlpha ?? UI_THEME.panelBgAlpha;
  const borderColor = opts?.borderColor ?? UI_THEME.panelBorder;
  const borderAlpha = opts?.borderAlpha ?? 0.92;
  const borderWidth = opts?.borderWidth ?? 1;
  const shadowAlpha = opts?.shadowAlpha ?? 0.42;
  const topHighlightAlpha = opts?.topHighlightAlpha ?? 0.2;

  if (shadowAlpha > 0) {
    g.fillStyle(UI_THEME.inkDeep, shadowAlpha);
    g.fillRoundedRect(x + 1, y + 2, w, h, radius);
  }
  g.fillStyle(fillColor, fillAlpha);
  g.fillRoundedRect(x, y, w, h, radius);

  if (topHighlightAlpha > 0 && h >= 10) {
    g.fillStyle(UI_THEME.panelBorderHighlight, topHighlightAlpha);
    g.fillRoundedRect(x + 1.5, y + 1, Math.max(2, w - 3), Math.min(3, h * 0.22), Math.max(1, radius - 2));
  }
  if (opts?.accentColor !== undefined && opts.accentSide !== 'none') {
    g.fillStyle(opts.accentColor, 0.95);
    if (opts.accentSide === 'top') {
      g.fillRoundedRect(x + 2, y + 1, Math.max(4, w - 4), 2, 1);
    } else {
      g.fillRoundedRect(x + 1, y + 3, 2.5, Math.max(4, h - 6), 1);
    }
  }
  if (borderWidth > 0 && borderAlpha > 0) {
    g.lineStyle(borderWidth, borderColor, borderAlpha);
    g.strokeRoundedRect(x, y, w, h, radius);
  }
}

export interface DrawSegmentedBarOptions extends SegmentedBarGeometryInput {
  fillColor: number;
  fillDarkColor?: number;
  trailColor?: number;
  trackColor?: number;
  borderColor?: number;
  pulseAlert?: boolean;
}

export function drawSegmentedBar(
  g: Phaser.GameObjects.Graphics,
  opts: DrawSegmentedBarOptions,
): SegmentedBarGeometry {
  const geo = computeSegmentedBarGeometry(opts);
  const radius = Math.min(3, opts.height * 0.45);

  g.fillStyle(opts.trackColor ?? UI_THEME.panelBgDark, 0.94);
  g.fillRoundedRect(opts.x, opts.y, opts.width, opts.height, radius);

  if (geo.trailingWidth > geo.filledWidth + 0.5) {
    g.fillStyle(opts.trailColor ?? UI_THEME.status.hpTrail, 0.85);
    g.fillRoundedRect(
      opts.x + 0.5,
      opts.y + 0.5,
      Math.max(1, geo.trailingWidth - 1),
      Math.max(1, opts.height - 1),
      Math.max(1, radius - 0.5),
    );
  }

  for (const seg of geo.segments) {
    if (seg.fillRatio <= 0.01) {
      g.fillStyle(0x111520, 0.55);
      g.fillRoundedRect(seg.x, seg.y + 0.5, seg.width, seg.height - 1, 1.5);
      continue;
    }
    const drawW = Math.max(1, seg.width * seg.fillRatio);
    if (opts.fillDarkColor !== undefined) {
      g.fillStyle(opts.fillDarkColor, 0.96);
      g.fillRoundedRect(seg.x, seg.y + 0.5, drawW, seg.height - 1, 1.5);
    }
    g.fillStyle(opts.fillColor, 0.98);
    g.fillRoundedRect(seg.x, seg.y + 0.5, drawW, Math.max(1, (seg.height - 1) * 0.8), 1.5);
    if (seg.height >= 5) {
      g.fillStyle(0xffffff, 0.24);
      g.fillRect(seg.x + 0.5, seg.y + 1, Math.max(1, drawW - 1), 1.2);
    }
  }

  const borderCol = opts.pulseAlert ? 0xfacc15 : (opts.borderColor ?? UI_THEME.inkDark);
  g.lineStyle(opts.pulseAlert ? 1.4 : 1, borderCol, opts.pulseAlert ? 0.98 : 0.88);
  g.strokeRoundedRect(opts.x, opts.y, opts.width, opts.height, radius);
  return geo;
}

export interface DrawKeyChipOptions {
  active?: boolean;
  sceneFontPx?: number;
  fillColor?: number;
  borderColor?: number;
}

export function drawKeyChip(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  keyLabel: string,
  opts?: DrawKeyChipOptions,
): KeyChipMetrics {
  const metrics = computeKeyChipMetrics(keyLabel, opts?.sceneFontPx ?? 6.5);
  const isActive = Boolean(opts?.active);
  const fillCol = opts?.fillColor ?? (isActive ? 0x3b4559 : UI_THEME.panelBgDark);
  const borderCol = opts?.borderColor ?? (isActive ? 0xfacc15 : 0x8b97b5);

  g.fillStyle(UI_THEME.inkDeep, 0.85);
  g.fillRoundedRect(x, y + 1, metrics.width, metrics.height, metrics.radius);
  g.fillStyle(fillCol, 0.95);
  g.fillRoundedRect(x, y, metrics.width, metrics.height - 0.5, metrics.radius);
  g.fillStyle(0xffffff, isActive ? 0.22 : 0.12);
  g.fillRect(x + 1.5, y + 0.8, Math.max(2, metrics.width - 3), 1);
  g.lineStyle(1, borderCol, isActive ? 0.98 : 0.85);
  g.strokeRoundedRect(x, y, metrics.width, metrics.height - 0.5, metrics.radius);
  return metrics;
}

export interface DrawCircularCooldownOptions extends CircularCooldownGeometryInput {
  accentColor: number;
  iconKind: HudVectorIconKind;
}

export function drawCircularCooldown(
  g: Phaser.GameObjects.Graphics,
  opts: DrawCircularCooldownOptions,
): CircularCooldownGeometry {
  const geo = computeCircularCooldownGeometry(opts);
  const { cx, cy, radius } = geo;

  g.fillStyle(UI_THEME.inkDeep, 0.55);
  g.fillCircle(cx + 0.8, cy + 1.5, radius + 1);
  g.fillStyle(UI_THEME.panelBgDark, 0.92);
  g.fillCircle(cx, cy, radius);

  if (geo.isActive) {
    g.fillStyle(0xfacc15, 0.32);
    g.fillCircle(cx, cy, radius - 1.5);
  } else if (geo.isReady) {
    g.fillStyle(opts.accentColor, 0.24);
    g.fillCircle(cx, cy, radius - 1.5);
  } else if (geo.readyRatio > 0.01) {
    g.fillStyle(opts.accentColor, 0.34);
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, radius - 1.5, geo.startAngleRad, geo.endAngleRad, false);
    g.closePath();
    g.fillPath();
  }

  g.fillStyle(UI_THEME.panelBg, 0.88);
  g.fillCircle(cx, cy, radius * 0.66);

  const iconCol = geo.isActive
    ? 0xfde047
    : geo.isReady
      ? opts.accentColor
      : hexToNum(PALETTE.STEEL_LIGHT);
  drawVectorHudIcon(g, opts.iconKind, cx, cy, radius * 0.52, iconCol);

  const rimCol = geo.isActive ? 0xfacc15 : geo.isReady ? opts.accentColor : UI_THEME.panelBorder;
  g.lineStyle(geo.isReady || geo.isActive ? 1.6 : 1.1, rimCol, geo.isReady || geo.isActive ? 0.98 : 0.75);
  g.strokeCircle(cx, cy, radius);
  return geo;
}

export function drawVectorHudIcon(
  g: Phaser.GameObjects.Graphics,
  kind: HudVectorIconKind,
  cx: number,
  cy: number,
  size: number,
  colorNum?: number,
): void {
  const r = Math.max(2.5, size);
  switch (kind) {
    case 'heart': {
      const col = colorNum ?? UI_THEME.status.hp;
      g.fillStyle(UI_THEME.inkDark, 0.85);
      g.fillCircle(cx - r * 0.34, cy - r * 0.18, r * 0.44);
      g.fillCircle(cx + r * 0.34, cy - r * 0.18, r * 0.44);
      g.fillTriangle(cx - r * 0.76, cy - r * 0.04, cx + r * 0.76, cy - r * 0.04, cx, cy + r * 0.78);
      g.fillStyle(col, 1);
      g.fillCircle(cx - r * 0.32, cy - r * 0.18, r * 0.36);
      g.fillCircle(cx + r * 0.32, cy - r * 0.18, r * 0.36);
      g.fillTriangle(cx - r * 0.66, cy - r * 0.05, cx + r * 0.66, cy - r * 0.05, cx, cy + r * 0.68);
      break;
    }
    case 'shield': {
      const col = colorNum ?? UI_THEME.status.armor;
      g.fillStyle(UI_THEME.inkDark, 0.85);
      g.fillRoundedRect(cx - r * 0.64, cy - r * 0.68, r * 1.28, r * 0.78, 1.5);
      g.fillTriangle(cx - r * 0.64, cy + r * 0.04, cx + r * 0.64, cy + r * 0.04, cx, cy + r * 0.78);
      g.fillStyle(col, 1);
      g.fillRoundedRect(cx - r * 0.54, cy - r * 0.58, r * 1.08, r * 0.66, 1.2);
      g.fillTriangle(cx - r * 0.54, cy + r * 0.02, cx + r * 0.54, cy + r * 0.02, cx, cy + r * 0.66);
      break;
    }
    case 'bolt': {
      const col = colorNum ?? UI_THEME.status.energy;
      g.fillStyle(UI_THEME.inkDark, 0.85);
      g.fillTriangle(cx + r * 0.18, cy - r * 0.78, cx - r * 0.56, cy + r * 0.08, cx + r * 0.08, cy + r * 0.08);
      g.fillTriangle(cx - r * 0.18, cy + r * 0.78, cx + r * 0.56, cy - r * 0.08, cx - r * 0.08, cy - r * 0.08);
      g.fillStyle(col, 1);
      g.fillTriangle(cx + r * 0.14, cy - r * 0.68, cx - r * 0.46, cy + r * 0.05, cx + r * 0.06, cy + r * 0.05);
      g.fillTriangle(cx - r * 0.14, cy + r * 0.68, cx + r * 0.46, cy - r * 0.05, cx - r * 0.06, cy - r * 0.05);
      break;
    }
    case 'coin': {
      const col = colorNum ?? UI_THEME.status.gold;
      g.fillStyle(UI_THEME.inkDark, 0.85);
      g.fillCircle(cx, cy, r * 0.72);
      g.fillStyle(col, 1);
      g.fillCircle(cx, cy, r * 0.6);
      g.fillStyle(UI_THEME.status.goldBright, 0.9);
      g.fillRect(cx - r * 0.14, cy - r * 0.34, r * 0.28, r * 0.68);
      break;
    }
    case 'skull': {
      const col = colorNum ?? 0xe84545;
      g.fillStyle(UI_THEME.inkDark, 0.9);
      g.fillCircle(cx, cy - r * 0.12, r * 0.68);
      g.fillRect(cx - r * 0.38, cy + r * 0.2, r * 0.76, r * 0.44);
      g.fillStyle(col, 1);
      g.fillCircle(cx, cy - r * 0.12, r * 0.56);
      g.fillRect(cx - r * 0.3, cy + r * 0.18, r * 0.6, r * 0.34);
      g.fillStyle(UI_THEME.inkDark, 1);
      g.fillCircle(cx - r * 0.2, cy - r * 0.12, r * 0.16);
      g.fillCircle(cx + r * 0.2, cy - r * 0.12, r * 0.16);
      break;
    }
    case 'skill': {
      const col = colorNum ?? 0x38bdf8;
      g.fillStyle(col, 1);
      g.fillTriangle(cx, cy - r * 0.78, cx - r * 0.26, cy, cx + r * 0.26, cy);
      g.fillTriangle(cx, cy + r * 0.78, cx - r * 0.26, cy, cx + r * 0.26, cy);
      g.fillTriangle(cx - r * 0.78, cy, cx, cy - r * 0.26, cx, cy + r * 0.26);
      g.fillTriangle(cx + r * 0.78, cy, cx, cy - r * 0.26, cx, cy + r * 0.26);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(cx, cy, r * 0.22);
      break;
    }
    case 'dash': {
      const col = colorNum ?? 0x4ade80;
      g.fillStyle(col, 1);
      g.fillTriangle(cx + r * 0.72, cy, cx - r * 0.12, cy - r * 0.56, cx - r * 0.12, cy + r * 0.56);
      g.fillTriangle(cx + r * 0.12, cy, cx - r * 0.68, cy - r * 0.44, cx - r * 0.68, cy + r * 0.44);
      break;
    }
    case 'sword': {
      const col = colorNum ?? 0xc7d2e8;
      g.lineStyle(1.8, col, 1);
      g.lineBetween(cx - r * 0.55, cy + r * 0.55, cx + r * 0.55, cy - r * 0.55);
      g.lineBetween(cx - r * 0.42, cy + r * 0.12, cx - r * 0.12, cy + r * 0.42);
      break;
    }
    case 'chest': {
      g.fillStyle(colorNum ?? 0xfacc15, 1);
      g.fillRoundedRect(cx - r * 0.65, cy - r * 0.48, r * 1.3, r * 0.96, 1.5);
      g.lineStyle(1, UI_THEME.inkDark, 0.9);
      g.strokeRoundedRect(cx - r * 0.65, cy - r * 0.48, r * 1.3, r * 0.96, 1.5);
      break;
    }
    case 'portal': {
      g.lineStyle(1.6, colorNum ?? 0xa855f7, 1);
      g.strokeCircle(cx, cy, r * 0.64);
      g.fillStyle(0x22d3ee, 0.9);
      g.fillCircle(cx, cy, r * 0.28);
      break;
    }
    case 'shrine': {
      g.fillStyle(colorNum ?? 0x22d3ee, 1);
      g.fillTriangle(cx, cy - r * 0.72, cx - r * 0.52, cy + r * 0.52, cx + r * 0.52, cy + r * 0.52);
      break;
    }
    case 'merchant': {
      g.fillStyle(colorNum ?? 0xf59e42, 1);
      g.fillCircle(cx, cy + r * 0.1, r * 0.58);
      g.fillRect(cx - r * 0.25, cy - r * 0.64, r * 0.5, r * 0.28);
      break;
    }
    case 'stairs': {
      const col = colorNum ?? 0xfacc15;
      g.fillStyle(col, 1);
      g.fillRect(cx - r * 0.65, cy + r * 0.2, r * 1.3, r * 0.36);
      g.fillRect(cx - r * 0.2, cy - r * 0.16, r * 0.85, r * 0.36);
      g.fillRect(cx + r * 0.25, cy - r * 0.52, r * 0.4, r * 0.36);
      break;
    }
  }
}

export interface OffscreenArrowPose {
  ax: number;
  ay: number;
  angleRad: number;
  isOffscreen: boolean;
}

export function computeOffscreenArrowPose(params: {
  targetWorldX: number;
  targetWorldY: number;
  camMidX: number;
  camMidY: number;
  viewX: number;
  viewY: number;
  viewW: number;
  viewH: number;
  minScreenX: number;
  maxScreenX: number;
  minScreenY: number;
  maxScreenY: number;
  baseCenterW?: number;
  baseCenterH?: number;
  edgeBufferWorld?: number;
}): OffscreenArrowPose {
  const centerW = params.baseCenterW ?? 480;
  const centerH = params.baseCenterH ?? 270;
  const buf = params.edgeBufferWorld ?? 0;
  const inView =
    params.targetWorldX >= params.viewX + buf &&
    params.targetWorldX <= params.viewX + params.viewW - buf &&
    params.targetWorldY >= params.viewY + buf &&
    params.targetWorldY <= params.viewY + params.viewH - buf;

  const relX = params.targetWorldX - params.camMidX + centerW;
  const relY = params.targetWorldY - params.camMidY + centerH;
  const ax = clamp(relX, params.minScreenX, params.maxScreenX);
  const ay = clamp(relY, params.minScreenY, params.maxScreenY);
  const angleRad = Math.atan2(relY - centerH, relX - centerW);

  return {
    ax,
    ay,
    angleRad,
    isOffscreen: !inView,
  };
}

export function drawOffscreenEnemyArrow(
  g: Phaser.GameObjects.Graphics,
  ax: number,
  ay: number,
  angleRad: number,
  isElite = false,
  uiScale = 1,
): void {
  const s = clamp(uiScale, 0.8, 1.3);
  const len = 9.5 * s;
  const wing = 8.2 * s;
  const fillCol = isElite ? 0xfacc15 : 0xe84545;
  const innerCol = isElite ? 0xfef08a : 0xfca5a5;

  const tipX = ax + Math.cos(angleRad) * len;
  const tipY = ay + Math.sin(angleRad) * len;
  const leftX = ax + Math.cos(angleRad + 2.42) * wing;
  const leftY = ay + Math.sin(angleRad + 2.42) * wing;
  const rightX = ax + Math.cos(angleRad - 2.42) * wing;
  const rightY = ay + Math.sin(angleRad - 2.42) * wing;

  // Outer dark silhouette
  g.fillStyle(UI_THEME.inkDeep, 0.9);
  g.fillCircle(ax, ay, 7.2 * s);

  g.fillStyle(fillCol, 0.96);
  g.lineStyle(1.8 * s, UI_THEME.inkDark, 1);
  g.beginPath();
  g.moveTo(tipX, tipY);
  g.lineTo(leftX, leftY);
  g.lineTo(rightX, rightY);
  g.closePath();
  g.fillPath();
  g.strokePath();

  // Inner bright core dot
  g.fillStyle(innerCol, 0.95);
  g.fillCircle(ax - Math.cos(angleRad) * 1.5 * s, ay - Math.sin(angleRad) * 1.5 * s, 2.2 * s);
}

export function drawPlayerHitDirectionArc(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  angleRad: number,
  alpha: number,
  uiScale = 1,
): void {
  const a = clamp(alpha, 0, 1);
  if (a <= 0.01) return;
  const s = clamp(uiScale, 0.8, 1.3);
  const radius = 52 * s;
  const halfSpan = 0.44;
  const startAng = angleRad - halfSpan;
  const endAng = angleRad + halfSpan;

  // Soft outer crimson glow arc
  g.lineStyle(7.5 * s, 0xdc2626, a * 0.42);
  g.beginPath();
  g.arc(cx, cy, radius, startAng, endAng, false);
  g.strokePath();

  // Sharp core crimson arc
  g.lineStyle(3.8 * s, 0xe84545, a * 0.95);
  g.beginPath();
  g.arc(cx, cy, radius, startAng, endAng, false);
  g.strokePath();

  // Inner bright highlight rim
  g.lineStyle(1.4 * s, 0xfca5a5, a * 0.9);
  g.beginPath();
  g.arc(cx, cy, radius - 1.8 * s, angleRad - halfSpan * 0.65, angleRad + halfSpan * 0.65, false);
  g.strokePath();

  // Directional outer spike chevron at center of arc
  const tipDist = radius + 7.5 * s;
  const baseDist = radius + 1.5 * s;
  const tipX = cx + Math.cos(angleRad) * tipDist;
  const tipY = cy + Math.sin(angleRad) * tipDist;
  const leftX = cx + Math.cos(angleRad - 0.14) * baseDist;
  const leftY = cy + Math.sin(angleRad - 0.14) * baseDist;
  const rightX = cx + Math.cos(angleRad + 0.14) * baseDist;
  const rightY = cy + Math.sin(angleRad + 0.14) * baseDist;

  g.fillStyle(0xe84545, a * 0.98);
  g.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
}

export function drawMiniCharacterPortrait(
  g: Phaser.GameObjects.Graphics,
  characterId: CharacterId | string,
  cx: number,
  cy: number,
  radius: number,
  slotColorHex: string = PALETTE.P1_RING,
): void {
  const rimCol = hexToNum(slotColorHex);
  g.fillStyle(UI_THEME.inkDeep, 0.75);
  g.fillCircle(cx + 0.5, cy + 1, radius + 1);
  g.fillStyle(UI_THEME.panelBgDark, 0.96);
  g.fillCircle(cx, cy, radius);

  const r = radius * 0.72;
  switch (characterId) {
    case 'vanguard': {
      g.fillStyle(hexToNum(PALETTE.RUBY_CORE), 0.95);
      g.fillTriangle(cx, cy - r * 1.15, cx - r * 0.45, cy - r * 0.35, cx + r * 0.45, cy - r * 0.35);
      g.fillStyle(hexToNum(PALETTE.STEEL_LIGHT), 1);
      g.fillRoundedRect(cx - r * 0.68, cy - r * 0.55, r * 1.36, r * 1.18, 2.5);
      g.fillStyle(UI_THEME.inkDark, 0.95);
      g.fillRect(cx - r * 0.46, cy - r * 0.12, r * 0.92, r * 0.22);
      g.fillRect(cx - r * 0.1, cy - r * 0.12, r * 0.2, r * 0.58);
      break;
    }
    case 'elementalist': {
      g.fillStyle(hexToNum(PALETTE.COBALT_SHADE), 1);
      g.fillTriangle(cx, cy - r * 1.05, cx - r * 0.85, cy + r * 0.68, cx + r * 0.85, cy + r * 0.68);
      g.fillStyle(UI_THEME.inkDark, 0.92);
      g.fillCircle(cx, cy + r * 0.08, r * 0.46);
      g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 1);
      g.fillCircle(cx - r * 0.18, cy + r * 0.06, r * 0.13);
      g.fillCircle(cx + r * 0.18, cy + r * 0.06, r * 0.13);
      g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 1);
      g.fillCircle(cx, cy - r * 0.52, r * 0.18);
      break;
    }
    case 'druid': {
      g.fillStyle(hexToNum(PALETTE.FOREST_SHADE), 1);
      g.fillCircle(cx, cy + r * 0.08, r * 0.72);
      g.lineStyle(1.6, hexToNum(PALETTE.WARM_STONE), 1);
      g.lineBetween(cx - r * 0.35, cy - r * 0.35, cx - r * 0.75, cy - r * 0.92);
      g.lineBetween(cx + r * 0.35, cy - r * 0.35, cx + r * 0.75, cy - r * 0.92);
      g.fillStyle(hexToNum(PALETTE.SKIN_WARM), 1);
      g.fillCircle(cx, cy + r * 0.12, r * 0.42);
      g.fillStyle(hexToNum(PALETTE.LIME_GLOW), 1);
      g.fillCircle(cx, cy - r * 0.38, r * 0.2);
      break;
    }
    case 'engineer': {
      g.fillStyle(hexToNum(PALETTE.LEATHER_MID), 1);
      g.fillCircle(cx, cy, r * 0.74);
      g.fillStyle(hexToNum(PALETTE.SKIN_WARM), 1);
      g.fillCircle(cx, cy + r * 0.16, r * 0.48);
      g.fillStyle(hexToNum(PALETTE.BRASS_CORE), 1);
      g.fillRoundedRect(cx - r * 0.68, cy - r * 0.36, r * 1.36, r * 0.44, 1.5);
      g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 1);
      g.fillCircle(cx - r * 0.28, cy - r * 0.14, r * 0.18);
      g.fillCircle(cx + r * 0.28, cy - r * 0.14, r * 0.18);
      break;
    }
    default: {
      g.fillStyle(hexToNum(PALETTE.GOBLIN_GREEN), 1);
      g.fillCircle(cx, cy, r * 0.72);
      g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 1);
      g.fillTriangle(cx + r * 0.2, cy - r * 0.4, cx + r * 0.78, cy - r * 0.95, cx + r * 0.48, cy - r * 0.15);
      break;
    }
  }
  g.lineStyle(1.6, rimCol, 0.98);
  g.strokeCircle(cx, cy, radius);
}

export class UIIconLabel {
  public readonly container: Phaser.GameObjects.Container;
  public readonly bg: Phaser.GameObjects.Graphics;
  public readonly text: Phaser.GameObjects.Text;
  private iconKind: HudVectorIconKind;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    iconKind: HudVectorIconKind,
    initialText: string,
    fontPxAt1080p = 14,
    color = UI_THEME.textPrimary,
  ) {
    this.iconKind = iconKind;
    this.container = scene.add.container(x, y);
    this.bg = scene.add.graphics();
    this.text = scene.add.text(12, 0, initialText, createUiTextStyle({ fontPxAt1080p, weight: 700, color }));
    this.text.setOrigin(0, 0.5);
    this.container.add([this.bg, this.text]);
    this.redrawIcon();
  }

  public setValue(label: string, iconColor?: number): void {
    if (this.text.text !== label) this.text.setText(label);
    this.redrawIcon(iconColor);
  }

  private redrawIcon(iconColor?: number): void {
    this.bg.clear();
    drawVectorHudIcon(this.bg, this.iconKind, 4, 0, 4.5, iconColor);
  }
}

export class UIButton {
  public readonly container: Phaser.GameObjects.Container;
  public readonly bg: Phaser.GameObjects.Graphics;
  public readonly label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    onClick?: () => void,
  ) {
    this.container = scene.add.container(x, y);
    this.bg = scene.add.graphics();
    drawStyledPanel(this.bg, 0, 0, w, h, { radius: UI_THEME.panelRadius.sm });
    this.label = scene.add.text(w / 2, h / 2, text, createUiTextStyle({ fontPxAt1080p: 14, weight: 700 }));
    this.label.setOrigin(0.5, 0.5);
    this.container.add([this.bg, this.label]);
    if (onClick) {
      const hit = scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', onClick);
      this.container.add(hit);
    }
  }
}

export class UITooltip {
  public readonly container: Phaser.GameObjects.Container;
  public readonly bg: Phaser.GameObjects.Graphics;
  public readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.container = scene.add.container(x, y);
    this.bg = scene.add.graphics();
    this.text = scene.add.text(8, 6, '', createUiTextStyle({ fontPxAt1080p: 13, weight: 600 }));
    this.container.add([this.bg, this.text]);
    this.container.setVisible(false);
  }

  public show(content: string, x: number, y: number): void {
    this.text.setText(content);
    this.bg.clear();
    drawStyledPanel(this.bg, 0, 0, Math.max(64, this.text.width + 16), Math.max(22, this.text.height + 10), {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.94,
      radius: UI_THEME.panelRadius.sm,
    });
    this.container.setPosition(x, y);
    this.container.setVisible(true);
  }

  public hide(): void {
    this.container.setVisible(false);
  }
}

export class UIToast {
  public readonly container: Phaser.GameObjects.Container;
  public readonly bg: Phaser.GameObjects.Graphics;
  public readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.container = scene.add.container(x, y);
    this.bg = scene.add.graphics();
    this.text = scene.add.text(0, 0, '', createUiTextStyle({ fontPxAt1080p: 16, weight: 800 }));
    this.text.setOrigin(0.5, 0.5);
    this.container.add([this.bg, this.text]);
    this.container.setVisible(false);
  }
}
