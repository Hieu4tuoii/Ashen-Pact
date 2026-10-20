/**
 * Master 42-color palette for Ashen Pact (strictly matching docs/ART_GUIDE.md).
 * All procedural surface colors must come from this palette or ENV_PALETTE.
 */
export const PALETTE = {
  // 1. Ink & Outline (4)
  INK_DARK: '#141019',
  INK_DEEP: '#0B090E',
  SLATE_DARK: '#241F2E',
  SLATE_MID: '#3B344A',

  // 2. Metals & Neutrals (6)
  STEEL_DARK: '#565E75',
  STEEL_LIGHT: '#8B97B5',
  SILVER_BRIGHT: '#C7D2E8',
  BONE_WHITE: '#F4F1EA',
  ASH_GRAY: '#746F7D',
  WARM_STONE: '#9C9286',

  // 3. Skin & Leather (5)
  SKIN_WARM: '#F2C29B',
  SKIN_SHADE: '#D1946B',
  LEATHER_DARK: '#4E2F21',
  LEATHER_MID: '#7D4B32',
  LEATHER_LIGHT: '#AD6E4B',

  // 4. Ruby / Fire / P2 (5)
  RUBY_DARK: '#6E1423',
  RUBY_CORE: '#B82538',
  CRIMSON_BRIGHT: '#E84545',
  FLAME_ORANGE: '#F97316',
  SOLAR_GOLD: '#FACC15',

  // 5. Emerald / Nature / P3 (6)
  MOSS_DARK: '#163024',
  FOREST_SHADE: '#1E4E38',
  GOBLIN_GREEN: '#499F54',
  LIME_GLOW: '#84CC16',
  MINT_LIGHT: '#A7F3D0',
  TOXIC_PURPLE: '#9333EA',

  // 6. Azure / Ice / P1 (6)
  ABYSS_BLUE: '#0F1E36',
  COBALT_SHADE: '#1D4ED8',
  AZURE_CORE: '#3B82F6',
  CYAN_FROST: '#22D3EE',
  ICE_WHITE: '#CFFAFE',
  ELECTRIC_VIOLET: '#A855F7',

  // 7. Amber / Lightning / Forge (6)
  FORGE_DARK: '#27120B',
  BRONZE_SHADE: '#92400E',
  BRASS_CORE: '#D97706',
  VOLT_YELLOW: '#FDE047',
  MAGMA_RED: '#DC2626',
  COPPER_LIGHT: '#FDBA74',

  // 8. Player Ring Accents (4)
  P1_RING: '#38BDF8',
  P2_RING: '#FB7185',
  P3_RING: '#4ADE80',
  P4_RING: '#FBBF24',
} as const;

export type PaletteKey = keyof typeof PALETTE;
export type PaletteHex = (typeof PALETTE)[PaletteKey];

export function hexToNum(hex: PaletteHex | string): number {
  return parseInt(hex.replace('#', ''), 16);
}

export const PLAYER_SLOT_COLORS: Record<1 | 2 | 3 | 4, { hex: PaletteHex; labelVi: string }> = {
  1: { hex: PALETTE.P1_RING, labelVi: 'P1 · Xanh Dương' },
  2: { hex: PALETTE.P2_RING, labelVi: 'P2 · Đỏ Hồng' },
  3: { hex: PALETTE.P3_RING, labelVi: 'P3 · Xanh Lá' },
  4: { hex: PALETTE.P4_RING, labelVi: 'P4 · Vàng Kim' },
};

export interface EnvPaletteEntry {
  floor: string;
  seam: string;
  var: string;
  wallTop: string;
  wallFront: string;
  shadow: string;
  rim: string;
  accent: string;
}

export const ENV_PALETTE: Record<0 | 1 | 2 | 3, EnvPaletteEntry> = {
  0: {
    floor: '#414B61',
    seam: '#343B4C',
    var: '#47546C',
    wallTop: '#64708B',
    wallFront: '#2D3547',
    shadow: '#151A24',
    rim: '#8B97B5',
    accent: '#F59E42',
  },
  1: {
    floor: '#3D4F47',
    seam: '#303E38',
    var: '#43584E',
    wallTop: '#627468',
    wallFront: '#2B3731',
    shadow: '#16201C',
    rim: '#9C9286',
    accent: '#84CC16',
  },
  2: {
    floor: '#446E78',
    seam: '#3B5C64',
    var: '#4A7881',
    wallTop: '#6F949E',
    wallFront: '#345462',
    shadow: '#182A33',
    rim: '#CFE8EE',
    accent: '#22D3EE',
  },
  3: {
    floor: '#53433F',
    seam: '#413431',
    var: '#5D4B44',
    wallTop: '#7F6559',
    wallFront: '#3B2D29',
    shadow: '#1F1614',
    rim: '#FDBA74',
    accent: '#F97316',
  },
};

export interface BiomePaletteTheme {
  id: 0 | 1 | 2 | 3;
  nameVi: string;
  bgDark: string;
  floorBase: string;
  floorShade: string;
  floorHighlight: string;
  accentGlow: string;
}

export const HUB_THEME: BiomePaletteTheme = {
  id: 0,
  nameVi: 'Hub: Khu Đá Cổ',
  bgDark: ENV_PALETTE[0].shadow,
  floorBase: ENV_PALETTE[0].floor,
  floorShade: ENV_PALETTE[0].seam,
  floorHighlight: ENV_PALETTE[0].var,
  accentGlow: ENV_PALETTE[0].accent,
};

export const BIOME_THEMES: Record<1 | 2 | 3, BiomePaletteTheme> = {
  1: {
    id: 1,
    nameVi: 'Biome 1: Rừng Cổ Mục Nát',
    bgDark: ENV_PALETTE[1].shadow,
    floorBase: ENV_PALETTE[1].floor,
    floorShade: ENV_PALETTE[1].seam,
    floorHighlight: ENV_PALETTE[1].var,
    accentGlow: ENV_PALETTE[1].accent,
  },
  2: {
    id: 2,
    nameVi: 'Biome 2: Hầm Băng Vĩnh Cửu',
    bgDark: ENV_PALETTE[2].shadow,
    floorBase: ENV_PALETTE[2].floor,
    floorShade: ENV_PALETTE[2].seam,
    floorHighlight: ENV_PALETTE[2].var,
    accentGlow: ENV_PALETTE[2].accent,
  },
  3: {
    id: 3,
    nameVi: 'Biome 3: Lò Rèn Dung Nham',
    bgDark: ENV_PALETTE[3].shadow,
    floorBase: ENV_PALETTE[3].floor,
    floorShade: ENV_PALETTE[3].seam,
    floorHighlight: ENV_PALETTE[3].var,
    accentGlow: ENV_PALETTE[3].accent,
  },
};

export function getBiomeTheme(biome: 0 | 1 | 2 | 3): BiomePaletteTheme {
  if (biome === 0) return HUB_THEME;
  return BIOME_THEMES[biome] ?? BIOME_THEMES[1];
}
