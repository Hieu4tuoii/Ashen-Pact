/**
 * Master 42-color palette for Ashen Pact (strictly matching docs/ART_GUIDE.md).
 * All procedural surface colors must come from this palette.
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

export interface BiomePaletteTheme {
  id: 1 | 2 | 3;
  nameVi: string;
  bgDark: PaletteHex;
  floorBase: PaletteHex;
  floorShade: PaletteHex;
  floorHighlight: PaletteHex;
  accentGlow: PaletteHex;
}

export const BIOME_THEMES: Record<1 | 2 | 3, BiomePaletteTheme> = {
  1: {
    id: 1,
    nameVi: 'Biome 1: Rừng Cổ Mục Nát',
    bgDark: PALETTE.MOSS_DARK,
    floorBase: PALETTE.FOREST_SHADE,
    floorShade: PALETTE.MOSS_DARK,
    floorHighlight: PALETTE.GOBLIN_GREEN,
    accentGlow: PALETTE.LIME_GLOW,
  },
  2: {
    id: 2,
    nameVi: 'Biome 2: Hầm Băng Vĩnh Cửu',
    bgDark: PALETTE.ABYSS_BLUE,
    floorBase: PALETTE.COBALT_SHADE,
    floorShade: PALETTE.ABYSS_BLUE,
    floorHighlight: PALETTE.CYAN_FROST,
    accentGlow: PALETTE.ICE_WHITE,
  },
  3: {
    id: 3,
    nameVi: 'Biome 3: Lò Rèn Dung Nham',
    bgDark: PALETTE.FORGE_DARK,
    floorBase: PALETTE.LEATHER_MID,
    floorShade: PALETTE.LEATHER_DARK,
    floorHighlight: PALETTE.BRONZE_SHADE,
    accentGlow: PALETTE.FLAME_ORANGE,
  },
};
