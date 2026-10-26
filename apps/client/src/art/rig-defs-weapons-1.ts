import { PALETTE } from './palette.js';
import { VANGUARD_RIG_DEF } from './rig-defs-heroes-1.js';
import type { WeaponVectorDef } from './rig-types.js';

export const WEAPON_VECTOR_DEFS_PART_1: Record<string, WeaponVectorDef> = {
  knight_sword: {
    id: 'knight_sword',
    width: 44,
    height: 20,
    originX: 0.22,
    originY: 0.5,
    shapes: VANGUARD_RIG_DEF.parts.find((p) => p.id === 'weapon')!.shapes,
  },
  hunter_crossbow: {
    id: 'hunter_crossbow',
    width: 40,
    height: 26,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -8,
        y: -3,
        w: 22,
        h: 6,
        r: 2,
        style: {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: PALETTE.LEATHER_LIGHT,
        },
      },
      {
        kind: 'polygon',
        points: [
          { x: 8, y: -11 },
          { x: 16, y: 0 },
          { x: 8, y: 11 },
          { x: 12, y: 0 },
        ],
        style: {
          fill: PALETTE.STEEL_LIGHT,
          shade: PALETTE.STEEL_DARK,
          highlight: PALETTE.SILVER_BRIGHT,
        },
      },
    ],
  },
  scrap_shotgun: {
    id: 'scrap_shotgun',
    width: 42,
    height: 22,
    originX: 0.26,
    originY: 0.5,
    shapes: [
      {
        kind: 'polygon',
        points: [
          { x: -10, y: -2 },
          { x: -1, y: -3 },
          { x: -1, y: 4 },
          { x: -10, y: 6 },
        ],
        style: {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: PALETTE.LEATHER_LIGHT,
        },
      },
      {
        kind: 'roundedRect',
        x: -2,
        y: -5.5,
        w: 24,
        h: 9.5,
        r: 2.5,
        style: {
          fill: PALETTE.STEEL_DARK,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.STEEL_LIGHT,
        },
      },
      {
        kind: 'polygon',
        points: [
          { x: 18, y: -6 },
          { x: 25, y: -8 },
          { x: 25, y: 6 },
          { x: 18, y: 4 },
        ],
        style: {
          fill: PALETTE.BRASS_CORE,
          shade: PALETTE.BRONZE_SHADE,
          highlight: PALETTE.SOLAR_GOLD,
        },
      },
    ],
  },
  gale_smg: {
    id: 'gale_smg',
    width: 38,
    height: 22,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: 4,
        y: 1,
        w: 5.5,
        h: 8.5,
        r: 1.5,
        style: {
          fill: PALETTE.SLATE_MID,
          shade: PALETTE.SLATE_DARK,
        },
      },
      {
        kind: 'roundedRect',
        x: -6,
        y: -5,
        w: 23,
        h: 8,
        r: 3,
        style: {
          fill: PALETTE.GOBLIN_GREEN,
          shade: PALETTE.FOREST_SHADE,
          highlight: PALETTE.LIME_GLOW,
        },
      },
      {
        kind: 'roundedRect',
        x: 15,
        y: -3.2,
        w: 7,
        h: 4.5,
        r: 1.5,
        style: {
          fill: PALETTE.SILVER_BRIGHT,
          shade: PALETTE.STEEL_LIGHT,
        },
      },
    ],
  },
  rivet_gun: {
    id: 'rivet_gun',
    width: 38,
    height: 22,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -7,
        y: -5.5,
        w: 22,
        h: 10,
        r: 3,
        style: {
          fill: PALETTE.BRASS_CORE,
          shade: PALETTE.BRONZE_SHADE,
          highlight: PALETTE.SOLAR_GOLD,
        },
      },
      {
        kind: 'roundedRect',
        x: 13,
        y: -3.5,
        w: 8,
        h: 6,
        r: 2,
        style: {
          fill: PALETTE.STEEL_LIGHT,
          shade: PALETTE.STEEL_DARK,
          highlight: PALETTE.SILVER_BRIGHT,
        },
      },
    ],
  },
  tesla_carbine: {
    id: 'tesla_carbine',
    width: 40,
    height: 22,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -7,
        y: -5,
        w: 22,
        h: 8,
        r: 2.5,
        style: {
          fill: PALETTE.STEEL_DARK,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.STEEL_LIGHT,
        },
      },
      {
        kind: 'roundedRect',
        x: 13,
        y: -4,
        w: 9,
        h: 6,
        r: 2,
        style: {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.BRASS_CORE,
          highlight: PALETTE.VOLT_YELLOW,
        },
      },
    ],
  },
  apprentice_staff: {
    id: 'apprentice_staff',
    width: 42,
    height: 22,
    originX: 0.24,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -10,
        y: -2.2,
        w: 25,
        h: 4.4,
        r: 2,
        style: {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: PALETTE.LEATHER_LIGHT,
        },
      },
      {
        kind: 'circle',
        cx: 17,
        cy: 0,
        r: 5.5,
        style: {
          fill: PALETTE.FLAME_ORANGE,
          shade: PALETTE.RUBY_CORE,
          highlight: PALETTE.SOLAR_GOLD,
        },
      },
    ],
  },
  thorn_staff: {
    id: 'thorn_staff',
    width: 42,
    height: 22,
    originX: 0.24,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -10,
        y: -2.2,
        w: 25,
        h: 4.4,
        r: 2,
        style: {
          fill: PALETTE.FOREST_SHADE,
          shade: PALETTE.MOSS_DARK,
          highlight: PALETTE.GOBLIN_GREEN,
        },
      },
      {
        kind: 'circle',
        cx: 17,
        cy: 0,
        r: 5.5,
        style: {
          fill: PALETTE.TOXIC_PURPLE,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.LIME_GLOW,
        },
      },
    ],
  },
};
