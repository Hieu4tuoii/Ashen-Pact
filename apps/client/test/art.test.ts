import { describe, expect, it } from 'vitest';
import { BIOME_THEMES, PALETTE, PLAYER_SLOT_COLORS } from '../src/art/palette.js';
import { easeInOutSine, easeOutBack, easeOutCubic } from '../src/art/easing.js';
import { ALL_SAMPLE_RIGS, GOBLIN_SHOOTER_RIG_DEF, VANGUARD_RIG_DEF } from '../src/art/rig-defs.js';

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
});
