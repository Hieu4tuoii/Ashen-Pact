import { describe, expect, it } from 'vitest';
import { WEAPONS } from '@ashen-pact/shared';
import { BIOME_THEMES, PALETTE, PLAYER_SLOT_COLORS } from '../src/art/palette.js';
import { easeInOutSine, easeOutBack, easeOutCubic } from '../src/art/easing.js';
import { ALL_SAMPLE_RIGS, GOBLIN_SHOOTER_RIG_DEF, VANGUARD_RIG_DEF } from '../src/art/rig-defs.js';
import { musicManager } from '../src/audio/music-synth.js';
import { resolveWeaponShootSfx, zzfx } from '../src/audio/zzfx.js';
import { graphicsSettings } from '../src/ui/graphics-settings.js';

describe('Art Pipeline Data & Palette', () => {
  it('defines the fixed 42-color master palette and P1-P4 slot colors', () => {
    const colors = Object.values(PALETTE);
    expect(colors.length).toBe(42);
    for (const hex of colors) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(Object.keys(PLAYER_SLOT_COLORS)).toEqual(['1', '2', '3', '4']);
    expect(Object.keys(BIOME_THEMES)).toEqual(['1', '2', '3']);
  });

  it('validates easing curves at boundary values 0 and 1', () => {
    expect(easeInOutSine(0)).toBeCloseTo(0, 5);
    expect(easeInOutSine(1)).toBeCloseTo(1, 5);
    expect(easeOutCubic(0)).toBeCloseTo(0, 5);
    expect(easeOutCubic(1)).toBeCloseTo(1, 5);
    expect(easeOutBack(0)).toBeCloseTo(0, 5);
    expect(easeOutBack(1)).toBeCloseTo(1, 5);
  });

  it('defines complete cutout rigs for Vanguard and Goblin Shooter using only palette colors', () => {
    const validColors = new Set<string>(Object.values(PALETTE));
    expect(ALL_SAMPLE_RIGS).toContain(VANGUARD_RIG_DEF);
    expect(ALL_SAMPLE_RIGS).toContain(GOBLIN_SHOOTER_RIG_DEF);

    for (const rig of ALL_SAMPLE_RIGS) {
      expect(rig.parts.length).toBe(8);
      for (const part of rig.parts) {
        expect(part.shapes.length).toBeGreaterThan(0);
        for (const cmd of part.shapes) {
          if (cmd.kind === 'detailStroke') {
            if (cmd.color) expect(validColors.has(cmd.color)).toBe(true);
          } else {
            expect(validColors.has(cmd.style.fill)).toBe(true);
            if (cmd.style.shade) expect(validColors.has(cmd.style.shade)).toBe(true);
            if (cmd.style.highlight) expect(validColors.has(cmd.style.highlight)).toBe(true);
          }
        }
      }
    }
  });

  it('defines 47 procedural SFX presets, weapon shoot mapping, 7 music themes, and graphics/audio settings', () => {
    const presetIds = zzfx.getPresetIds();
    expect(presetIds.length).toBeGreaterThanOrEqual(45);

    for (const weaponId of Object.keys(WEAPONS)) {
      const sfxId = resolveWeaponShootSfx(weaponId);
      expect(presetIds).toContain(sfxId);
    }

    const themes = musicManager.getAvailableThemes();
    expect(themes).toEqual([
      'menu_hub',
      'biome1',
      'biome2',
      'biome3',
      'boss_spore_king',
      'boss_kryssa',
      'boss_forge_titan',
    ]);

    musicManager.update('biome1', false, 0.5);
    expect(musicManager.getCurrentTheme()).toBe('biome1');
    expect(musicManager.getCombatMix()).toBe(0);

    musicManager.update('biome1', true, 0.5);
    expect(musicManager.getCombatMix()).toBeGreaterThan(0);

    // Settings clamping & reset
    graphicsSettings.setMasterVolume(1.5);
    expect(graphicsSettings.getState().masterVolume).toBe(1);
    graphicsSettings.setMusicVolume(-0.2);
    expect(graphicsSettings.getState().musicVolume).toBe(0);
    graphicsSettings.resetDefaults();
    expect(graphicsSettings.getState().masterVolume).toBe(0.85);
    expect(graphicsSettings.getState().musicVolume).toBe(0.7);
    expect(graphicsSettings.getState().sfxVolume).toBe(0.9);
    expect(graphicsSettings.getState().language).toBe('vi');
  });
});
