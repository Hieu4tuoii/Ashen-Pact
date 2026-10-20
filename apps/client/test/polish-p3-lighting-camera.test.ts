import { describe, expect, it } from 'vitest';
import {
  BIOME_LIGHTING_CONFIG,
  computeUniformViewportMetrics,
  POSTFX_DEFAULTS,
  resolveSceneLightingConfig,
} from '../src/fx/lighting-config.js';

function getRgbChannelMean(colorNum: number): number {
  const r = ((colorNum >> 16) & 0xff) / 255;
  const g = ((colorNum >> 8) & 0xff) / 255;
  const b = (colorNum & 0xff) / 255;
  return (r + g + b) / 3;
}

describe('Phase P3 — Full-Screen Clear Visibility Lighting & Uniform Viewport Metrics', () => {
  it('configures bright ambientColor with RGB channel mean in [0.84, 0.90] and zero vignette across all biomes and Hub', () => {
    expect(BIOME_LIGHTING_CONFIG[1].ambientColor).toBe(0xd9e3dd);
    expect(BIOME_LIGHTING_CONFIG[1].colorGradeTint).toEqual([1.02, 0.99, 0.96]);
    expect(BIOME_LIGHTING_CONFIG[1].vignetteStrength).toBe(0.0);

    expect(BIOME_LIGHTING_CONFIG[2].ambientColor).toBe(0xd2e0e8);
    expect(BIOME_LIGHTING_CONFIG[2].colorGradeTint).toEqual([0.95, 1.0, 1.05]);
    expect(BIOME_LIGHTING_CONFIG[2].vignetteStrength).toBe(0.0);

    expect(BIOME_LIGHTING_CONFIG[3].ambientColor).toBe(0xebdbd1);
    expect(BIOME_LIGHTING_CONFIG[3].colorGradeTint).toEqual([1.05, 0.96, 0.92]);
    expect(BIOME_LIGHTING_CONFIG[3].vignetteStrength).toBe(0.0);

    expect(BIOME_LIGHTING_CONFIG.hub.ambientColor).toBe(0xd6dce8);
    expect(BIOME_LIGHTING_CONFIG.hub.colorGradeTint).toEqual([0.98, 0.99, 1.03]);
    expect(BIOME_LIGHTING_CONFIG.hub.vignetteStrength).toBe(0.0);

    for (const key of [1, 2, 3, 'hub'] as const) {
      const mean = getRgbChannelMean(BIOME_LIGHTING_CONFIG[key].ambientColor);
      expect(mean).toBeGreaterThanOrEqual(0.84);
      expect(mean).toBeLessThanOrEqual(0.9);
    }
  });

  it('defines gentle PostFX defaults with vignetteStrength === 0, contrast in [0.96, 1.0], and bloomStrength in [0.12, 0.15]', () => {
    expect(POSTFX_DEFAULTS.vignetteStrength).toBe(0.0);
    expect(POSTFX_DEFAULTS.contrast).toBeGreaterThanOrEqual(0.96);
    expect(POSTFX_DEFAULTS.contrast).toBeLessThanOrEqual(1.0);
    expect(POSTFX_DEFAULTS.contrast).toBeCloseTo(0.98, 4);
    expect(POSTFX_DEFAULTS.bloomStrength).toBeGreaterThanOrEqual(0.12);
    expect(POSTFX_DEFAULTS.bloomStrength).toBeLessThanOrEqual(0.15);
    expect(POSTFX_DEFAULTS.bloomStrength).toBeCloseTo(0.14, 4);
  });

  it('keeps ambient brightness >= 0.84 and vignetteStrength === 0 when Kryssa Phase 3 blizzardVeil is active', () => {
    const normalB2 = resolveSceneLightingConfig(2, false, false);
    const blizzardB2 = resolveSceneLightingConfig(2, false, true);

    expect(getRgbChannelMean(blizzardB2.ambientColor)).toBeGreaterThanOrEqual(0.84);
    expect(blizzardB2.ambientColor).toBe(normalB2.ambientColor);
    expect(blizzardB2.vignetteStrength).toBe(0.0);
    expect(blizzardB2.colorGradeTint).toEqual([0.95, 1.0, 1.05]);
  });

  it('computes uniform zoom and edge padding across 16:9, 21:9 ultrawide, and 5:4 aspect ratios', () => {
    const m1080p = computeUniformViewportMetrics(1920, 1080);
    expect(m1080p.zoom).toBeCloseTo(2.0, 4);
    expect(m1080p.viewW).toBeCloseTo(960, 4);
    expect(m1080p.viewH).toBeCloseTo(540, 4);
    expect(m1080p.padX).toBeCloseTo(0, 4);
    expect(m1080p.padY).toBeCloseTo(0, 4);

    const m1440p = computeUniformViewportMetrics(2560, 1440);
    expect(m1440p.zoom).toBeCloseTo(2560 / 960, 4);
    expect(m1440p.viewW).toBeCloseTo(960, 4);
    expect(m1440p.viewH).toBeCloseTo(540, 4);
    expect(m1440p.padX).toBeCloseTo(0, 4);
    expect(m1440p.padY).toBeCloseTo(0, 4);

    const mUltrawide = computeUniformViewportMetrics(2560, 1080);
    expect(mUltrawide.zoom).toBeCloseTo(2.0, 4);
    expect(mUltrawide.viewW).toBeCloseTo(1280, 4);
    expect(mUltrawide.viewH).toBeCloseTo(540, 4);
    expect(mUltrawide.padX).toBeCloseTo(160, 4);
    expect(mUltrawide.padY).toBeCloseTo(0, 4);

    const m5by4 = computeUniformViewportMetrics(1280, 1024);
    expect(m5by4.zoom).toBeCloseTo(1280 / 960, 4);
    expect(m5by4.viewW).toBeCloseTo(960, 4);
    expect(m5by4.viewH).toBeCloseTo(768, 4);
    expect(m5by4.padX).toBeCloseTo(0, 4);
    expect(m5by4.padY).toBeCloseTo(114, 4);
  });
});
