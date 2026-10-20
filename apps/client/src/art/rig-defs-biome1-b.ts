import { PALETTE } from './palette.js';
import { INNER_OUTLINE_WIDTH } from './primitives.js';
import type { EntityRigDef } from './rig-types.js';

export const SPORE_BOMBER_RIG_DEF: EntityRigDef = {
  id: 'spore_bomber',
  nameVi: 'Nấm Nổ Bào Tử (Spore Bomber)',
  roleVi: 'Quái Nổ Tự Sát · Biome 1',
  worldWidth: 30,
  worldHeight: 36,
  shadowRx: 12,
  shadowRy: 5.5,
  parts: [
    {
      id: 'backAccessory',
      width: 24,
      height: 24,
      offsetX: -4,
      offsetY: -15,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Volatile glowing toxic spore sac on back
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 7.5,
          style: {
            fill: PALETTE.TOXIC_PURPLE,
            shade: PALETTE.SLATE_DARK,
            highlight: PALETTE.LIME_GLOW,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 12,
      height: 12,
      offsetX: -4,
      offsetY: -4,
      originX: 0.5,
      originY: 0.25,
      zIndex: 20,
      shapes: [
        {
          kind: 'roundedRect',
          x: -3.5,
          y: -2,
          w: 7,
          h: 8,
          r: 3,
          style: {
            fill: PALETTE.WARM_STONE,
            shade: PALETTE.ASH_GRAY,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 12,
      height: 12,
      offsetX: 4,
      offsetY: -4,
      originX: 0.5,
      originY: 0.25,
      zIndex: 21,
      shapes: [
        {
          kind: 'roundedRect',
          x: -3.5,
          y: -2,
          w: 7,
          h: 8,
          r: 3,
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.WARM_STONE,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 24,
      height: 20,
      offsetX: 0,
      offsetY: -12,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        // Plump mushroom stalk body
        {
          kind: 'roundedRect',
          x: -8.5,
          y: -7.5,
          w: 17,
          h: 14,
          r: 6,
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.WARM_STONE,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
        // Glowing crimson warning belly ring
        {
          kind: 'ellipse',
          cx: 0,
          cy: 0.5,
          rx: 5,
          ry: 3.5,
          style: {
            fill: PALETTE.CRIMSON_BRIGHT,
            shade: PALETTE.RUBY_CORE,
            highlight: PALETTE.FLAME_ORANGE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 12,
      height: 12,
      offsetX: -8.5,
      offsetY: -12,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 3.8,
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.WARM_STONE,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 38,
      height: 30,
      offsetX: 0,
      offsetY: -25,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        // Wide volatile bulbous mushroom cap
        {
          kind: 'polygon',
          points: [
            { x: -15, y: 3 },
            { x: -12, y: -9 },
            { x: 0, y: -13 },
            { x: 12, y: -9 },
            { x: 15, y: 3 },
            { x: 0, y: 6 },
          ],
          style: {
            fill: PALETTE.TOXIC_PURPLE,
            shade: PALETTE.RUBY_DARK,
            highlight: PALETTE.ELECTRIC_VIOLET,
          },
        },
        // Glowing lime & crimson spots on cap
        {
          kind: 'circle',
          cx: -6.5,
          cy: -5.5,
          r: 3.2,
          style: {
            fill: PALETTE.LIME_GLOW,
            highlight: PALETTE.MINT_LIGHT,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: 6,
          cy: -6,
          r: 2.8,
          style: {
            fill: PALETTE.CRIMSON_BRIGHT,
            highlight: PALETTE.FLAME_ORANGE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: -9.5,
          r: 2.2,
          style: {
            fill: PALETTE.SOLAR_GOLD,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        // Glowing lime-yellow manic eyes under cap rim
        {
          kind: 'circle',
          cx: -4,
          cy: 2.2,
          r: 2.0,
          style: {
            fill: PALETTE.LIME_GLOW,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: 4,
          cy: 2.2,
          r: 2.0,
          style: {
            fill: PALETTE.LIME_GLOW,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 20,
      height: 20,
      offsetX: 8,
      offsetY: -12,
      originX: 0.5,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'circle',
          cx: 2,
          cy: 0,
          r: 4.2,
          style: {
            fill: PALETTE.CRIMSON_BRIGHT,
            shade: PALETTE.RUBY_CORE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 12,
      height: 12,
      offsetX: 8.5,
      offsetY: -12,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 3.8,
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.WARM_STONE,
          },
        },
      ],
    },
  ],
};

/**
 * Biome 1 Enemy: Slime Xanh Tách Đôi (Green Slime)
 * Translucent-style cel-shaded gelatinous cube/dome with inner toxic nucleus & bouncing tendrils.
 */
export const GREEN_SLIME_RIG_DEF: EntityRigDef = {
  id: 'green_slime',
  nameVi: 'Slime Xanh Tách Đôi (Green Slime)',
  roleVi: 'Quái Tách Đôi · Biome 1',
  worldWidth: 34,
  worldHeight: 34,
  shadowRx: 14,
  shadowRy: 6,
  parts: [
    {
      id: 'backAccessory',
      width: 28,
      height: 22,
      offsetX: 0,
      offsetY: -12,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 2,
          rx: 12,
          ry: 8,
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.GOBLIN_GREEN,
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
      originY: 0.5,
      zIndex: 20,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 0,
          rx: 5,
          ry: 3.5,
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.LIME_GLOW,
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
      originY: 0.5,
      zIndex: 21,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 0,
          rx: 5,
          ry: 3.5,
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.LIME_GLOW,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 32,
      height: 28,
      offsetX: 0,
      offsetY: -13,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        {
          kind: 'roundedRect',
          x: -13,
          y: -10,
          w: 26,
          h: 20,
          r: 9,
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.LIME_GLOW,
          },
        },
        // Inner mitotic nucleus (twin cores ready to split)
        {
          kind: 'circle',
          cx: -4,
          cy: -1,
          r: 4.2,
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.GOBLIN_GREEN,
            highlight: PALETTE.MINT_LIGHT,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: 4,
          cy: 1,
          r: 3.8,
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.GOBLIN_GREEN,
            highlight: PALETTE.MINT_LIGHT,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 14,
      height: 14,
      offsetX: -12,
      offsetY: -12,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4.2,
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.GOBLIN_GREEN,
            highlight: PALETTE.MINT_LIGHT,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 30,
      height: 26,
      offsetX: 0,
      offsetY: -22,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 0,
          rx: 11.5,
          ry: 9,
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.GOBLIN_GREEN,
            highlight: PALETTE.MINT_LIGHT,
          },
        },
        {
          kind: 'circle',
          cx: -4.2,
          cy: 0.5,
          r: 2.3,
          style: {
            fill: PALETTE.INK_DARK,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: 4.2,
          cy: 0.5,
          r: 2.3,
          style: {
            fill: PALETTE.INK_DARK,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 14,
      height: 14,
      offsetX: 9,
      offsetY: -12,
      originX: 0.5,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 3.5,
          style: {
            fill: PALETTE.MINT_LIGHT,
            shade: PALETTE.LIME_GLOW,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 14,
      height: 14,
      offsetX: 12,
      offsetY: -12,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4.2,
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.GOBLIN_GREEN,
            highlight: PALETTE.MINT_LIGHT,
          },
        },
      ],
    },
  ],
};

/**
 * Biome 1 Split Offspring: Slime Nhỏ (Mini Slime)
 */
export const MINI_SLIME_RIG_DEF: EntityRigDef = {
  id: 'mini_slime',
  nameVi: 'Slime Nhỏ (Mini Slime)',
  roleVi: 'Quái Tách Đôi Nhỏ · Biome 1',
  worldWidth: 24,
  worldHeight: 24,
  shadowRx: 9.5,
  shadowRy: 4.5,
  parts: [
    {
      id: 'backAccessory',
      width: 18,
      height: 14,
      offsetX: 0,
      offsetY: -8,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 1,
          rx: 7.5,
          ry: 5,
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 10,
      height: 10,
      offsetX: -4,
      offsetY: -3,
      originX: 0.5,
      originY: 0.5,
      zIndex: 20,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 3,
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 10,
      height: 10,
      offsetX: 4,
      offsetY: -3,
      originX: 0.5,
      originY: 0.5,
      zIndex: 21,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 3,
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 22,
      height: 20,
      offsetX: 0,
      offsetY: -9,
      originX: 0.5,
      originY: 0.5,
      zIndex: 30,
      shapes: [
        {
          kind: 'roundedRect',
          x: -8.5,
          y: -7,
          w: 17,
          h: 14,
          r: 6.5,
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.GOBLIN_GREEN,
            highlight: PALETTE.MINT_LIGHT,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 10,
      height: 10,
      offsetX: -8,
      offsetY: -8,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 2.8,
          style: {
            fill: PALETTE.MINT_LIGHT,
            shade: PALETTE.LIME_GLOW,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 20,
      height: 18,
      offsetX: 0,
      offsetY: -14,
      originX: 0.5,
      originY: 0.6,
      zIndex: 40,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 0,
          rx: 7.5,
          ry: 6,
          style: {
            fill: PALETTE.MINT_LIGHT,
            shade: PALETTE.LIME_GLOW,
            highlight: PALETTE.BONE_WHITE,
          },
        },
        {
          kind: 'circle',
          cx: -2.8,
          cy: 0.5,
          r: 1.7,
          style: {
            fill: PALETTE.INK_DARK,
            outlineWidth: 0,
          },
        },
        {
          kind: 'circle',
          cx: 2.8,
          cy: 0.5,
          r: 1.7,
          style: {
            fill: PALETTE.INK_DARK,
            outlineWidth: 0,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 10,
      height: 10,
      offsetX: 6,
      offsetY: -8,
      originX: 0.5,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 2.4,
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.GOBLIN_GREEN,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 10,
      height: 10,
      offsetX: 8,
      offsetY: -8,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 2.8,
          style: {
            fill: PALETTE.MINT_LIGHT,
            shade: PALETTE.LIME_GLOW,
          },
        },
      ],
    },
  ],
};
