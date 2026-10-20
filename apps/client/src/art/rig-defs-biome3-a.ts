import { PALETTE } from './palette.js';
import { INNER_OUTLINE_WIDTH } from './primitives.js';
import type { EntityRigDef } from './rig-types.js';

export const FIRE_IMP_RIG_DEF: EntityRigDef = {
  id: 'fire_imp',
  nameVi: 'Tiểu Quỷ Lửa (Fire Imp)',
  roleVi: 'Quái Cơ Động Bắn Lửa · Biome 3',
  worldWidth: 32,
  worldHeight: 34,
  shadowRx: 12,
  shadowRy: 5,
  parts: [
    {
      id: 'backAccessory',
      width: 32,
      height: 26,
      offsetX: -2,
      offsetY: -14,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Spiked devil wings + barbed tail
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -2 },
            { x: -14, y: -10 },
            { x: -10, y: 4 },
            { x: -13, y: 10 },
            { x: 0, y: 6 },
            { x: 12, y: -8 },
            { x: 9, y: 4 },
          ],
          style: {
            fill: PALETTE.RUBY_DARK,
            shade: PALETTE.FORGE_DARK,
            highlight: PALETTE.CRIMSON_BRIGHT,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 12,
      height: 14,
      offsetX: -5,
      offsetY: -5,
      originX: 0.5,
      originY: 0.25,
      zIndex: 20,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -3, y: -3 },
            { x: 3, y: -3 },
            { x: 4, y: 5 },
            { x: -2, y: 5 },
          ],
          style: {
            fill: PALETTE.RUBY_DARK,
            shade: PALETTE.FORGE_DARK,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 12,
      height: 14,
      offsetX: 5,
      offsetY: -5,
      originX: 0.5,
      originY: 0.25,
      zIndex: 21,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -3, y: -3 },
            { x: 3, y: -3 },
            { x: 2, y: 5 },
            { x: -4, y: 5 },
          ],
          style: {
            fill: PALETTE.RUBY_DARK,
            shade: PALETTE.FORGE_DARK,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 24,
      height: 20,
      offsetX: 0,
      offsetY: -13,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -9, y: -7 },
            { x: 9, y: -7 },
            { x: 6, y: 7 },
            { x: -6, y: 7 },
          ],
          style: {
            fill: PALETTE.CRIMSON_BRIGHT,
            shade: PALETTE.RUBY_CORE,
            highlight: PALETTE.FLAME_ORANGE,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 3.5,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            shade: PALETTE.FLAME_ORANGE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 14,
      height: 14,
      offsetX: -10,
      offsetY: -13,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4,
          style: {
            fill: PALETTE.CRIMSON_BRIGHT,
            shade: PALETTE.RUBY_CORE,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 30,
      height: 28,
      offsetX: 0,
      offsetY: -24,
      originX: 0.5,
      originY: 0.6,
      zIndex: 40,
      shapes: [
        // Swept-back curved devil horns
        {
          kind: 'polygon',
          points: [
            { x: -8, y: -4 },
            { x: -14, y: -13 },
            { x: -3, y: -7 },
          ],
          style: {
            fill: PALETTE.FORGE_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.FLAME_ORANGE,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 8, y: -4 },
            { x: 14, y: -13 },
            { x: 3, y: -7 },
          ],
          style: {
            fill: PALETTE.FORGE_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.FLAME_ORANGE,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: -10, y: -6 },
            { x: 10, y: -6 },
            { x: 8, y: 4 },
            { x: 0, y: 8 },
            { x: -8, y: 4 },
          ],
          style: {
            fill: PALETTE.CRIMSON_BRIGHT,
            shade: PALETTE.RUBY_CORE,
            highlight: PALETTE.FLAME_ORANGE,
          },
        },
        {
          kind: 'circle',
          cx: -3.5,
          cy: -1,
          r: 2.2,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: 0,
          },
        },
        {
          kind: 'circle',
          cx: 3.5,
          cy: -1,
          r: 2.2,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: 0,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 22,
      height: 22,
      offsetX: 11,
      offsetY: -14,
      originX: 0.4,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        // Blazing Fireball / Flame Pitchfork
        {
          kind: 'polygon',
          points: [
            { x: -3, y: -6 },
            { x: 9, y: 0 },
            { x: -3, y: 6 },
            { x: 0, y: 0 },
          ],
          style: {
            fill: PALETTE.VOLT_YELLOW,
            shade: PALETTE.FLAME_ORANGE,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 14,
      height: 14,
      offsetX: 10,
      offsetY: -13,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4,
          style: {
            fill: PALETTE.CRIMSON_BRIGHT,
            shade: PALETTE.RUBY_CORE,
          },
        },
      ],
    },
  ],
};

export const DWARF_CANNON_RIG_DEF: EntityRigDef = {
  id: 'dwarf_cannon',
  nameVi: 'Người Lùn Pháo Thủ (Dwarf Cannoneer)',
  roleVi: 'Pháo Cối Nổ AoE · Biome 3',
  worldWidth: 40,
  worldHeight: 38,
  shadowRx: 16,
  shadowRy: 7,
  parts: [
    {
      id: 'backAccessory',
      width: 34,
      height: 28,
      offsetX: -3,
      offsetY: -17,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Twin brass steam boilers on back
        {
          kind: 'roundedRect',
          x: -12,
          y: -11,
          w: 10,
          h: 18,
          r: 3,
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
        {
          kind: 'roundedRect',
          x: 2,
          y: -11,
          w: 10,
          h: 18,
          r: 3,
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
      width: 14,
      height: 12,
      offsetX: -6,
      offsetY: -4,
      originX: 0.5,
      originY: 0.3,
      zIndex: 20,
      shapes: [
        {
          kind: 'roundedRect',
          x: -5,
          y: -3,
          w: 10,
          h: 7,
          r: 2.5,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 14,
      height: 12,
      offsetX: 6,
      offsetY: -4,
      originX: 0.5,
      originY: 0.3,
      zIndex: 21,
      shapes: [
        {
          kind: 'roundedRect',
          x: -5,
          y: -3,
          w: 10,
          h: 7,
          r: 2.5,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 32,
      height: 24,
      offsetX: 0,
      offsetY: -12,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        {
          kind: 'roundedRect',
          x: -13,
          y: -8,
          w: 26,
          h: 16,
          r: 5,
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 16,
      height: 16,
      offsetX: -13,
      offsetY: -12,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 5,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 34,
      height: 32,
      offsetX: 0,
      offsetY: -22,
      originX: 0.5,
      originY: 0.55,
      zIndex: 40,
      shapes: [
        // Domed iron helmet + brass goggles + long braided fiery beard
        {
          kind: 'roundedRect',
          x: -11,
          y: -10,
          w: 22,
          h: 13,
          r: 6,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
        // Glowing welding goggles
        {
          kind: 'circle',
          cx: -4,
          cy: -2,
          r: 3,
          style: {
            fill: PALETTE.FLAME_ORANGE,
            highlight: PALETTE.VOLT_YELLOW,
          },
        },
        {
          kind: 'circle',
          cx: 4,
          cy: -2,
          r: 3,
          style: {
            fill: PALETTE.FLAME_ORANGE,
            highlight: PALETTE.VOLT_YELLOW,
          },
        },
        // Braided dwarf beard hanging down
        {
          kind: 'polygon',
          points: [
            { x: -8, y: 2 },
            { x: 8, y: 2 },
            { x: 5, y: 12 },
            { x: 0, y: 15 },
            { x: -5, y: 12 },
          ],
          style: {
            fill: PALETTE.FLAME_ORANGE,
            shade: PALETTE.RUBY_CORE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 38,
      height: 26,
      offsetX: 14,
      offsetY: -12,
      originX: 0.3,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        // Heavy wide-bore Siege Mortar Cannon
        {
          kind: 'roundedRect',
          x: -6,
          y: -7,
          w: 22,
          h: 14,
          r: 4,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.STEEL_LIGHT,
          },
        },
        {
          kind: 'roundedRect',
          x: 11,
          y: -8,
          w: 5,
          h: 16,
          r: 2,
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
        {
          kind: 'circle',
          cx: 15,
          cy: 0,
          r: 3.5,
          style: {
            fill: PALETTE.FLAME_ORANGE,
            highlight: PALETTE.VOLT_YELLOW,
            outlineWidth: 0,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 16,
      height: 16,
      offsetX: 11,
      offsetY: -11,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 5,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
          },
        },
      ],
    },
  ],
};

export const COAL_GOLEM_RIG_DEF: EntityRigDef = {
  id: 'coal_golem',
  nameVi: 'Golem Than (Coal Golem)',
  roleVi: 'Quái Nặng Để Lại Dung Nham Khi Chết · Biome 3',
  worldWidth: 44,
  worldHeight: 46,
  shadowRx: 18,
  shadowRy: 8,
  parts: [
    {
      id: 'backAccessory',
      width: 40,
      height: 32,
      offsetX: 0,
      offsetY: -20,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Volcanic obsidian back crags with magma rim
        {
          kind: 'polygon',
          points: [
            { x: -16, y: 6 },
            { x: -12, y: -14 },
            { x: 0, y: -8 },
            { x: 12, y: -14 },
            { x: 16, y: 6 },
          ],
          style: {
            fill: PALETTE.FORGE_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.MAGMA_RED,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 16,
      height: 16,
      offsetX: -8,
      offsetY: -5,
      originX: 0.5,
      originY: 0.3,
      zIndex: 20,
      shapes: [
        {
          kind: 'roundedRect',
          x: -6,
          y: -4,
          w: 12,
          h: 10,
          r: 3,
          style: {
            fill: PALETTE.SLATE_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.FLAME_ORANGE,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 16,
      height: 16,
      offsetX: 8,
      offsetY: -5,
      originX: 0.5,
      originY: 0.3,
      zIndex: 21,
      shapes: [
        {
          kind: 'roundedRect',
          x: -6,
          y: -4,
          w: 12,
          h: 10,
          r: 3,
          style: {
            fill: PALETTE.SLATE_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.FLAME_ORANGE,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 38,
      height: 30,
      offsetX: 0,
      offsetY: -16,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -15, y: -11 },
            { x: 15, y: -11 },
            { x: 17, y: 3 },
            { x: 11, y: 12 },
            { x: -11, y: 12 },
            { x: -17, y: 3 },
          ],
          style: {
            fill: PALETTE.SLATE_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.MAGMA_RED,
          },
        },
        // Glowing molten magma fissure in chest
        {
          kind: 'polygon',
          points: [
            { x: -6, y: -5 },
            { x: 0, y: -8 },
            { x: 6, y: -5 },
            { x: 4, y: 5 },
            { x: 0, y: 8 },
            { x: -4, y: 5 },
          ],
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
      width: 22,
      height: 22,
      offsetX: -16,
      offsetY: -15,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -7, y: -7 },
            { x: 7, y: -5 },
            { x: 8, y: 8 },
            { x: -6, y: 8 },
          ],
          style: {
            fill: PALETTE.SLATE_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.FLAME_ORANGE,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 32,
      height: 26,
      offsetX: 0,
      offsetY: -28,
      originX: 0.5,
      originY: 0.6,
      zIndex: 40,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -11, y: -8 },
            { x: 0, y: -12 },
            { x: 11, y: -8 },
            { x: 12, y: 6 },
            { x: -12, y: 6 },
          ],
          style: {
            fill: PALETTE.SLATE_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.MAGMA_RED,
          },
        },
        {
          kind: 'circle',
          cx: -4.5,
          cy: -1,
          r: 2.5,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: 0,
          },
        },
        {
          kind: 'circle',
          cx: 4.5,
          cy: -1,
          r: 2.5,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: 0,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 24,
      height: 24,
      offsetX: 16,
      offsetY: -14,
      originX: 0.5,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        // Molten magma boulder fist
        {
          kind: 'polygon',
          points: [
            { x: -6, y: -8 },
            { x: 8, y: -6 },
            { x: 10, y: 4 },
            { x: 2, y: 9 },
            { x: -7, y: 6 },
          ],
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
      width: 18,
      height: 18,
      offsetX: 14,
      offsetY: -15,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 5.5,
          style: {
            fill: PALETTE.SLATE_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.FLAME_ORANGE,
          },
        },
      ],
    },
  ],
};
