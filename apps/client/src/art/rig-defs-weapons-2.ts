import { PALETTE } from './palette.js';
import { WEAPON_VECTOR_DEFS_PART_1 } from './rig-defs-weapons-1.js';
import type { WeaponVectorDef } from './rig-types.js';

export const WEAPON_VECTOR_DEFS_PART_2: Record<string, WeaponVectorDef> = {
  emerald_cleaver: {
    id: 'emerald_cleaver',
    width: 48,
    height: 24,
    originX: 0.22,
    originY: 0.5,
    shapes: [
      {
        kind: 'polygon',
        points: [
          { x: -3, y: -5.5 },
          { x: 24, y: -7.5 },
          { x: 31, y: 0 },
          { x: 22, y: 6.5 },
          { x: -3, y: 4.5 },
        ],
        style: {
          fill: PALETTE.LIME_GLOW,
          shade: PALETTE.GOBLIN_GREEN,
          highlight: PALETTE.MINT_LIGHT,
        },
      },
      {
        kind: 'roundedRect',
        x: -7,
        y: -7,
        w: 5,
        h: 14,
        r: 2,
        style: {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.BRASS_CORE,
          highlight: PALETTE.VOLT_YELLOW,
        },
      },
    ],
  },
  solar_archon_staff: {
    id: 'solar_archon_staff',
    width: 46,
    height: 24,
    originX: 0.24,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -11,
        y: -2.4,
        w: 27,
        h: 4.8,
        r: 2,
        style: {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.BRASS_CORE,
          highlight: PALETTE.VOLT_YELLOW,
        },
      },
      {
        kind: 'circle',
        cx: 19,
        cy: 0,
        r: 6.5,
        style: {
          fill: PALETTE.FLAME_ORANGE,
          shade: PALETTE.RUBY_CORE,
          highlight: PALETTE.BONE_WHITE,
        },
      },
    ],
  },
  dual_pistols: {
    id: 'dual_pistols',
    width: 38,
    height: 24,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -6,
        y: -7.5,
        w: 21,
        h: 6.5,
        r: 2.2,
        style: {
          fill: PALETTE.STEEL_LIGHT,
          shade: PALETTE.STEEL_DARK,
          highlight: PALETTE.SILVER_BRIGHT,
        },
      },
      {
        kind: 'roundedRect',
        x: -4,
        y: 0.5,
        w: 21,
        h: 6.5,
        r: 2.2,
        style: {
          fill: PALETTE.BRASS_CORE,
          shade: PALETTE.BRONZE_SHADE,
          highlight: PALETTE.SOLAR_GOLD,
        },
      },
    ],
  },
  frost_bow: {
    id: 'frost_bow',
    width: 42,
    height: 30,
    originX: 0.3,
    originY: 0.5,
    shapes: [
      {
        kind: 'polygon',
        points: [
          { x: 2, y: -13 },
          { x: 14, y: 0 },
          { x: 2, y: 13 },
          { x: 7, y: 0 },
        ],
        style: {
          fill: PALETTE.CYAN_FROST,
          shade: PALETTE.AZURE_CORE,
          highlight: PALETTE.ICE_WHITE,
        },
      },
      {
        kind: 'roundedRect',
        x: -6,
        y: -1.8,
        w: 22,
        h: 3.6,
        r: 1.5,
        style: {
          fill: PALETTE.ICE_WHITE,
          shade: PALETTE.CYAN_FROST,
        },
      },
    ],
  },
  frag_launcher: {
    id: 'frag_launcher',
    width: 44,
    height: 24,
    originX: 0.26,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -9,
        y: -6,
        w: 27,
        h: 11,
        r: 3.5,
        style: {
          fill: PALETTE.STEEL_DARK,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.BRASS_CORE,
        },
      },
      {
        kind: 'circle',
        cx: 4,
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
  seed_gun: {
    id: 'seed_gun',
    width: 42,
    height: 24,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -7,
        y: -5,
        w: 22,
        h: 9,
        r: 3.5,
        style: {
          fill: PALETTE.GOBLIN_GREEN,
          shade: PALETTE.FOREST_SHADE,
          highlight: PALETTE.LIME_GLOW,
        },
      },
      {
        kind: 'circle',
        cx: 17,
        cy: 0,
        r: 5.5,
        style: {
          fill: PALETTE.MINT_LIGHT,
          shade: PALETTE.LIME_GLOW,
          highlight: PALETTE.SOLAR_GOLD,
        },
      },
    ],
  },
  tether_staff: {
    id: 'tether_staff',
    width: 44,
    height: 24,
    originX: 0.24,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -10,
        y: -2.4,
        w: 25,
        h: 4.8,
        r: 2,
        style: {
          fill: PALETTE.BRASS_CORE,
          shade: PALETTE.BRONZE_SHADE,
          highlight: PALETTE.SOLAR_GOLD,
        },
      },
      {
        kind: 'circle',
        cx: 17,
        cy: -4,
        r: 4,
        style: {
          fill: PALETTE.CYAN_FROST,
          shade: PALETTE.AZURE_CORE,
          highlight: PALETTE.ICE_WHITE,
        },
      },
      {
        kind: 'circle',
        cx: 17,
        cy: 4,
        r: 4,
        style: {
          fill: PALETTE.VOLT_YELLOW,
          shade: PALETTE.FLAME_ORANGE,
          highlight: PALETTE.BONE_WHITE,
        },
      },
    ],
  },
  focus_laser: {
    id: 'focus_laser',
    width: 44,
    height: 22,
    originX: 0.26,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -8,
        y: -4.5,
        w: 26,
        h: 8.5,
        r: 3,
        style: {
          fill: PALETTE.AZURE_CORE,
          shade: PALETTE.COBALT_SHADE,
          highlight: PALETTE.CYAN_FROST,
        },
      },
      {
        kind: 'polygon',
        points: [
          { x: 16, y: -5.5 },
          { x: 25, y: 0 },
          { x: 16, y: 5.5 },
        ],
        style: {
          fill: PALETTE.VOLT_YELLOW,
          shade: PALETTE.SOLAR_GOLD,
          highlight: PALETTE.BONE_WHITE,
        },
      },
    ],
  },
  void_staff: {
    id: 'void_staff',
    width: 44,
    height: 24,
    originX: 0.24,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -10,
        y: -2.3,
        w: 25,
        h: 4.6,
        r: 2,
        style: {
          fill: PALETTE.SLATE_DARK,
          shade: PALETTE.INK_DARK,
          highlight: PALETTE.TOXIC_PURPLE,
        },
      },
      {
        kind: 'circle',
        cx: 18,
        cy: 0,
        r: 6,
        style: {
          fill: PALETTE.ELECTRIC_VIOLET,
          shade: PALETTE.TOXIC_PURPLE,
          highlight: PALETTE.CYAN_FROST,
        },
      },
    ],
  },
  berserker_axe: {
    id: 'berserker_axe',
    width: 48,
    height: 28,
    originX: 0.24,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -9,
        y: -2.5,
        w: 28,
        h: 5,
        r: 2,
        style: {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: PALETTE.SOLAR_GOLD,
        },
      },
      {
        kind: 'polygon',
        points: [
          { x: 10, y: -12 },
          { x: 25, y: -7 },
          { x: 22, y: 7 },
          { x: 10, y: 12 },
          { x: 13, y: 0 },
        ],
        style: {
          fill: PALETTE.RUBY_CORE,
          shade: PALETTE.RUBY_DARK,
          highlight: PALETTE.FLAME_ORANGE,
        },
      },
    ],
  },
  magma_cannon: {
    id: 'magma_cannon',
    width: 46,
    height: 26,
    originX: 0.26,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -10,
        y: -6.5,
        w: 28,
        h: 12,
        r: 3.5,
        style: {
          fill: PALETTE.RUBY_DARK,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.FLAME_ORANGE,
        },
      },
      {
        kind: 'circle',
        cx: 18,
        cy: 0,
        r: 6.5,
        style: {
          fill: PALETTE.FLAME_ORANGE,
          shade: PALETTE.MAGMA_RED,
          highlight: PALETTE.VOLT_YELLOW,
        },
      },
    ],
  },
  thunder_hammer: {
    id: 'thunder_hammer',
    width: 50,
    height: 30,
    originX: 0.24,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -10,
        y: -2.6,
        w: 27,
        h: 5.2,
        r: 2,
        style: {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.BRASS_CORE,
          highlight: PALETTE.VOLT_YELLOW,
        },
      },
      {
        kind: 'roundedRect',
        x: 11,
        y: -11,
        w: 14,
        h: 22,
        r: 4,
        style: {
          fill: PALETTE.CYAN_FROST,
          shade: PALETTE.AZURE_CORE,
          highlight: PALETTE.ICE_WHITE,
        },
      },
    ],
  },
};

export const WEAPON_VECTOR_DEFS: Record<string, WeaponVectorDef> = {
  ...WEAPON_VECTOR_DEFS_PART_1,
  ...WEAPON_VECTOR_DEFS_PART_2,
};
