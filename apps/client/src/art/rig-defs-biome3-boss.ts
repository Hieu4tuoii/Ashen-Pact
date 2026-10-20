import { PALETTE } from './palette.js';
import type { EntityRigDef } from './rig-types.js';

export const FORGE_TITAN_RIG_DEF: EntityRigDef = {
  id: 'forge_titan',
  nameVi: 'Titan Lò Rèn (Forge Titan)',
  roleVi: 'Boss Biome 3 · Sóng Xung Kích & Lõi Năng Lượng Kép',
  worldWidth: 80,
  worldHeight: 88,
  shadowRx: 31,
  shadowRy: 13.5,
  parts: [
    {
      id: 'backAccessory',
      width: 76,
      height: 62,
      offsetX: 0,
      offsetY: -36,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Twin industrial furnace smokestacks + magma gear mantle
        {
          kind: 'roundedRect',
          x: -28,
          y: -26,
          w: 14,
          h: 34,
          r: 4,
          style: {
            fill: PALETTE.FORGE_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.MAGMA_RED,
          },
        },
        {
          kind: 'roundedRect',
          x: 14,
          y: -26,
          w: 14,
          h: 34,
          r: 4,
          style: {
            fill: PALETTE.FORGE_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.MAGMA_RED,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: -32, y: -4 },
            { x: 32, y: -4 },
            { x: 24, y: 22 },
            { x: -24, y: 22 },
          ],
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 26,
      height: 26,
      offsetX: -12,
      offsetY: -8,
      originX: 0.5,
      originY: 0.25,
      zIndex: 20,
      shapes: [
        {
          kind: 'roundedRect',
          x: -9,
          y: -6,
          w: 18,
          h: 16,
          r: 4,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.STEEL_LIGHT,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 26,
      height: 26,
      offsetX: 12,
      offsetY: -8,
      originX: 0.5,
      originY: 0.25,
      zIndex: 21,
      shapes: [
        {
          kind: 'roundedRect',
          x: -9,
          y: -6,
          w: 18,
          h: 16,
          r: 4,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.STEEL_LIGHT,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 64,
      height: 50,
      offsetX: 0,
      offsetY: -27,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        // Colossal industrial furnace torso
        {
          kind: 'polygon',
          points: [
            { x: -26, y: -18 },
            { x: 26, y: -18 },
            { x: 29, y: 4 },
            { x: 18, y: 20 },
            { x: -18, y: 20 },
            { x: -29, y: 4 },
          ],
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
        // Glowing molten furnace core grate
        {
          kind: 'roundedRect',
          x: -13,
          y: -10,
          w: 26,
          h: 20,
          r: 5,
          style: {
            fill: PALETTE.FLAME_ORANGE,
            shade: PALETTE.MAGMA_RED,
            highlight: PALETTE.VOLT_YELLOW,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 34,
      height: 36,
      offsetX: -27,
      offsetY: -26,
      originX: 0.5,
      originY: 0.45,
      zIndex: 35,
      shapes: [
        {
          kind: 'roundedRect',
          x: -11,
          y: -11,
          w: 22,
          h: 22,
          r: 5,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.FLAME_ORANGE,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 56,
      height: 48,
      offsetX: 0,
      offsetY: -50,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        // Swept molten-gold automaton horns
        {
          kind: 'polygon',
          points: [
            { x: -16, y: -6 },
            { x: -26, y: -20 },
            { x: -8, y: -13 },
          ],
          style: {
            fill: PALETTE.SOLAR_GOLD,
            shade: PALETTE.BRASS_CORE,
            highlight: PALETTE.VOLT_YELLOW,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 16, y: -6 },
            { x: 26, y: -20 },
            { x: 8, y: -13 },
          ],
          style: {
            fill: PALETTE.SOLAR_GOLD,
            shade: PALETTE.BRASS_CORE,
            highlight: PALETTE.VOLT_YELLOW,
          },
        },
        {
          kind: 'roundedRect',
          x: -18,
          y: -14,
          w: 36,
          h: 26,
          r: 8,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.STEEL_LIGHT,
          },
        },
        // Blazing furnace visor slit
        {
          kind: 'roundedRect',
          x: -12,
          y: -4,
          w: 24,
          h: 6,
          r: 2,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            shade: PALETTE.FLAME_ORANGE,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 68,
      height: 64,
      offsetX: 28,
      offsetY: -26,
      originX: 0.35,
      originY: 0.55,
      zIndex: 45,
      shapes: [
        // Colossal Molten Forge Warhammer (Búa Đại Lò Rèn)
        {
          kind: 'roundedRect',
          x: -4,
          y: -18,
          w: 8,
          h: 42,
          r: 3,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
          },
        },
        {
          kind: 'roundedRect',
          x: -18,
          y: -28,
          w: 36,
          h: 20,
          r: 5,
          style: {
            fill: PALETTE.MAGMA_RED,
            shade: PALETTE.RUBY_DARK,
            highlight: PALETTE.VOLT_YELLOW,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 30,
      height: 30,
      offsetX: 24,
      offsetY: -24,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 9,
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
      ],
    },
  ],
};
