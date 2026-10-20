import { WORLD_VIEW_HEIGHT, WORLD_VIEW_WIDTH } from '@ashen-pact/shared';

export interface BiomeLightingEntry {
  readonly ambientColor: number;
  readonly colorGradeTint: [number, number, number];
  readonly vignetteStrength: number;
}

export const BIOME_LIGHTING_CONFIG: {
  readonly 1: BiomeLightingEntry;
  readonly 2: BiomeLightingEntry;
  readonly 3: BiomeLightingEntry;
  readonly hub: BiomeLightingEntry;
} = {
  1: {
    ambientColor: 0xd9e3dd,
    colorGradeTint: [1.02, 0.99, 0.96],
    vignetteStrength: 0.0,
  },
  2: {
    ambientColor: 0xd2e0e8,
    colorGradeTint: [0.95, 1.0, 1.05],
    vignetteStrength: 0.0,
  },
  3: {
    ambientColor: 0xebdbd1,
    colorGradeTint: [1.05, 0.96, 0.92],
    vignetteStrength: 0.0,
  },
  hub: {
    ambientColor: 0xd6dce8,
    colorGradeTint: [0.98, 0.99, 1.03],
    vignetteStrength: 0.0,
  },
};

export const POSTFX_DEFAULTS = {
  contrast: 0.98,
  bloomStrength: 0.14,
  vignetteStrength: 0.0,
} as const;

export function resolveSceneLightingConfig(
  biome: 1 | 2 | 3,
  inHub = false,
  blizzardVeil = false,
): BiomeLightingEntry {
  if (inHub) {
    return BIOME_LIGHTING_CONFIG.hub;
  }
  if (blizzardVeil) {
    return {
      ambientColor: BIOME_LIGHTING_CONFIG[2].ambientColor,
      colorGradeTint: [0.95, 1.0, 1.05],
      vignetteStrength: 0.0,
    };
  }
  return BIOME_LIGHTING_CONFIG[biome];
}

export interface UniformViewportMetrics {
  zoom: number;
  viewW: number;
  viewH: number;
  padX: number;
  padY: number;
  centerMapX: boolean;
  centerMapY: boolean;
}

export function computeUniformViewportMetrics(
  width: number,
  height: number,
  mapWidth?: number,
  mapHeight?: number,
): UniformViewportMetrics {
  const safeW = width > 0 ? width : WORLD_VIEW_WIDTH;
  const safeH = height > 0 ? height : WORLD_VIEW_HEIGHT;
  const zoom = Math.max(0.1, Math.min(safeW / WORLD_VIEW_WIDTH, safeH / WORLD_VIEW_HEIGHT));
  const viewW = safeW / zoom;
  const viewH = safeH / zoom;
  const padX = Math.max(0, (viewW - WORLD_VIEW_WIDTH) * 0.5);
  const padY = Math.max(0, (viewH - WORLD_VIEW_HEIGHT) * 0.5);
  return {
    zoom,
    viewW,
    viewH,
    padX,
    padY,
    centerMapX: typeof mapWidth === 'number' ? viewW >= mapWidth : false,
    centerMapY: typeof mapHeight === 'number' ? viewH >= mapHeight : false,
  };
}
