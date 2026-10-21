import { clamp, type WeaponRarity } from '@ashen-pact/shared';
import { ENV_PALETTE, hexToNum, PALETTE } from '../art/palette.js';

export type UiFontWeight = 400 | 600 | 700 | 800;

export interface BiomeUiAccent {
  biome: 0 | 1 | 2 | 3;
  accentHex: string;
  accentNum: number;
  borderHex: string;
  borderNum: number;
  surfaceHex: string;
  surfaceNum: number;
  rimHex: string;
  rimNum: number;
}

export interface RarityVisualSpec {
  hex: string;
  num: number;
  labelVi: string;
}

export const UI_THEME = {
  fontFamily: '"Be Vietnam Pro", sans-serif',
  fontSizes1080p: [12, 13, 14, 16, 20, 28, 40] as const,
  minHudFontPxAt1080p: 13,

  // Panel surface & border grounded in ENV_PALETTE[0] (Hub slate stone)
  panelBg: hexToNum(ENV_PALETTE[0].wallFront), // 0x2d3547
  panelBgHex: ENV_PALETTE[0].wallFront,
  panelBgDark: 0x1d2330,
  panelBgDarkHex: '#1D2330',
  panelBgElevated: hexToNum(ENV_PALETTE[0].floor), // 0x414b61
  panelBgAlpha: 0.82,
  minimapBgAlpha: 0.85,
  panelBorder: hexToNum(ENV_PALETTE[0].wallTop), // 0x64708b
  panelBorderHex: ENV_PALETTE[0].wallTop,
  panelBorderHighlight: 0x8fa0bf,
  panelBorderHighlightHex: '#8FA0BF',
  inkDark: hexToNum(PALETTE.INK_DARK), // 0x141019
  inkDarkHex: PALETTE.INK_DARK,
  inkDeep: hexToNum(PALETTE.INK_DEEP), // 0x0b090e
  inkDeepHex: PALETTE.INK_DEEP,

  textPrimary: PALETTE.BONE_WHITE, // #F4F1EA
  textSecondary: PALETTE.SILVER_BRIGHT, // #C7D2E8
  textMuted: PALETTE.STEEL_LIGHT, // #8B97B5
  textAccentGold: PALETTE.SOLAR_GOLD, // #FACC15

  panelRadius: {
    sm: 6,
    md: 8,
    lg: 10,
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },

  status: {
    hp: 0xe84545,
    hpHex: '#E84545',
    hpDark: 0xdc2626,
    hpDarkHex: '#DC2626',
    hpTrail: 0xfca5a5,
    hpTrailHex: '#FCA5A5',
    armor: 0xcbd5e1,
    armorHex: '#CBD5E1',
    armorDark: 0x94a3b8,
    armorDarkHex: '#94A3B8',
    armorTrail: 0xe2e8f0,
    energy: 0x38bdf8,
    energyHex: '#38BDF8',
    energyDark: 0x0284c7,
    energyDarkHex: '#0284C7',
    gold: 0xfbbf24,
    goldHex: '#FBBF24',
    goldBright: 0xfde047,
    goldBrightHex: '#FDE047',
    goldDark: 0xf59e0b,
  },

  rarity: {
    common: { hex: '#C7D2E8', num: 0xc7d2e8, labelVi: 'Thường' },
    uncommon: { hex: '#4ADE80', num: 0x4ade80, labelVi: 'Khá' },
    rare: { hex: '#38BDF8', num: 0x38bdf8, labelVi: 'Hiếm' },
    epic: { hex: '#A855F7', num: 0xa855f7, labelVi: 'Sử Thi' },
    legendary: { hex: '#FACC15', num: 0xfacc15, labelVi: 'Huyền Thoại' },
  } satisfies Record<WeaponRarity, RarityVisualSpec>,
} as const;

export function getBiomeUiAccent(biome: 0 | 1 | 2 | 3): BiomeUiAccent {
  const safeBiome: 0 | 1 | 2 | 3 = biome === 0 || biome === 1 || biome === 2 || biome === 3 ? biome : 1;
  const env = ENV_PALETTE[safeBiome];
  return {
    biome: safeBiome,
    accentHex: env.accent,
    accentNum: hexToNum(env.accent),
    borderHex: env.wallTop,
    borderNum: hexToNum(env.wallTop),
    surfaceHex: env.wallFront,
    surfaceNum: hexToNum(env.wallFront),
    rimHex: env.rim,
    rimNum: hexToNum(env.rim),
  };
}

export function clampHudFontPxAt1080p(pxAt1080p: number): number {
  if (!Number.isFinite(pxAt1080p)) return UI_THEME.minHudFontPxAt1080p;
  return Math.max(UI_THEME.minHudFontPxAt1080p, pxAt1080p);
}

export function hudFontPxToScenePx(pxAt1080p: number): number {
  const clamped = clampHudFontPxAt1080p(pxAt1080p);
  return Math.round((clamped / 2) * 10) / 10;
}

export function computeUiTextResolution(dpr = 1, zoom = 2, uiScale = 1): number {
  const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 2;
  const safeScale = Number.isFinite(uiScale) && uiScale > 0 ? uiScale : 1;
  const raw = safeDpr * safeZoom * safeScale;
  return clamp(Math.round(raw * 10000) / 10000, 2, 4);
}

export interface UiTextStyleOptions {
  /** Font size in 1080p pixels (will be clamped to >= 13px for HUD text). */
  fontPxAt1080p?: number;
  /** Direct font size in 960x540 scene coordinates (clamped to >= 6.5px for HUD text). */
  sceneFontPx?: number;
  weight?: UiFontWeight;
  color?: string;
  stroke?: string;
  strokeThickness?: number;
  align?: 'left' | 'center' | 'right';
  wordWrapWidth?: number;
  lineSpacing?: number;
  resolution?: number;
  padding?: { top?: number; bottom?: number; left?: number; right?: number };
}

export interface ComputedUiTextStyle {
  fontFamily: string;
  fontSize: string;
  fontStyle: string;
  color: string;
  stroke: string;
  strokeThickness: number;
  align?: 'left' | 'center' | 'right';
  wordWrap?: { width: number; useAdvancedWrap: boolean };
  lineSpacing: number;
  resolution: number;
  padding: { top: number; bottom: number; left: number; right: number };
}

function buildTextStyleInternal(
  opts: UiTextStyleOptions | undefined,
  enforceHudMinimum: boolean,
): ComputedUiTextStyle {
  const raw1080 =
    opts?.fontPxAt1080p !== undefined
      ? opts.fontPxAt1080p
      : opts?.sceneFontPx !== undefined
        ? opts.sceneFontPx * 2
        : 14;
  const effective1080 = enforceHudMinimum
    ? clampHudFontPxAt1080p(raw1080)
    : Math.max(12, raw1080);
  const scenePx = Math.round((effective1080 / 2) * 10) / 10;
  const weight: UiFontWeight = opts?.weight ?? 600;
  const minLineSpacing = Math.ceil(scenePx * 0.35 * 10) / 10;
  const lineSpacing = Math.max(opts?.lineSpacing ?? 0, minLineSpacing);

  const style: ComputedUiTextStyle = {
    fontFamily: UI_THEME.fontFamily,
    fontSize: `${scenePx}px`,
    fontStyle: `${weight}`,
    color: opts?.color ?? UI_THEME.textPrimary,
    stroke: opts?.stroke ?? UI_THEME.inkDarkHex,
    strokeThickness: opts?.strokeThickness ?? 2,
    lineSpacing,
    resolution: opts?.resolution ?? 2.5,
    padding: {
      top: Math.max(4, opts?.padding?.top ?? 4),
      bottom: Math.max(3, opts?.padding?.bottom ?? 3),
      left: Math.max(2, opts?.padding?.left ?? 2),
      right: Math.max(2, opts?.padding?.right ?? 2),
    },
  };

  if (opts?.align) {
    style.align = opts.align;
  }
  if (opts?.wordWrapWidth && opts.wordWrapWidth > 0) {
    style.wordWrap = { width: opts.wordWrapWidth, useAdvancedWrap: true };
  }

  return style;
}

/**
 * Creates a Phaser text style for in-game HUD text.
 * Enforces minimum 13px at 1080p (6.5px in 960x540 scene), Vietnamese diacritic-safe
 * top/bottom padding, and line-height >= 1.3.
 */
export function createUiTextStyle(opts?: UiTextStyleOptions): ComputedUiTextStyle {
  return buildTextStyleInternal(opts, true);
}

/**
 * Creates a Phaser text style for general UI / showcase text where 12px at 1080p (6px scene)
 * is permitted while still enforcing Vietnamese diacritic top padding >= 4px and line-height >= 1.3.
 */
export function createSceneTextStyle(opts?: UiTextStyleOptions): ComputedUiTextStyle {
  return buildTextStyleInternal(opts, false);
}
