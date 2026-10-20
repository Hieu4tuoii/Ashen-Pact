import { PALETTE } from './palette.js';
import { INNER_OUTLINE_WIDTH } from './primitives.js';
import type { EntityRigDef } from './rig-types.js';

/**
 * Biome 1 Support Enemy: Pháp Sư Goblin (Goblin Shaman)
 * Bone skull mask, violet-moss ritual cloak, and glowing emerald totem staff.
 */
export const GOBLIN_SHAMAN_RIG_DEF: EntityRigDef = {
  id: 'goblin_shaman',
  nameVi: 'Pháp Sư Goblin (Goblin Shaman)',
  roleVi: 'Hỗ Trợ Hồi Máu · Biome 1',
  worldWidth: 34,
  worldHeight: 40,
  shadowRx: 13,
  shadowRy: 5.8,
  parts: [
    {
      id: 'backAccessory',
      width: 30,
      height: 28,
      offsetX: -2,
      offsetY: -15,
      originX: 0.5,
      originY: 0.3,
      zIndex: 10,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -9, y: -9 },
            { x: 9, y: -9 },
            { x: 12, y: 11 },
            { x: 0, y: 13 },
            { x: -12, y: 11 },
          ],
          style: {
            fill: PALETTE.TOXIC_PURPLE,
            shade: PALETTE.SLATE_DARK,
            highlight: PALETTE.ELECTRIC_VIOLET,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 14,
      height: 14,
      offsetX: -4.5,
      offsetY: -4.5,
      originX: 0.5,
      originY: 0.25,
      zIndex: 20,
      shapes: [
        {
          kind: 'roundedRect',
          x: -4,
          y: -2.5,
          w: 8,
          h: 9,
          r: 3.5,
          style: {
            fill: PALETTE.SLATE_DARK,
            highlight: PALETTE.SLATE_MID,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 14,
      height: 14,
      offsetX: 4.5,
      offsetY: -4.5,
      originX: 0.5,
      originY: 0.25,
      zIndex: 21,
      shapes: [
        {
          kind: 'roundedRect',
          x: -4,
          y: -2.5,
          w: 8,
          h: 9,
          r: 3.5,
          style: {
            fill: PALETTE.SLATE_MID,
            shade: PALETTE.SLATE_DARK,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 28,
      height: 22,
      offsetX: 0,
      offsetY: -13,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        {
          kind: 'roundedRect',
          x: -10,
          y: -8,
          w: 20,
          h: 16,
          r: 5.5,
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.GOBLIN_GREEN,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: -1,
          r: 3.6,
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
      offsetX: -10.5,
      offsetY: -13,
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
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.LIME_GLOW,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 34,
      height: 32,
      offsetX: 0,
      offsetY: -28,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        // Goblin ears
        {
          kind: 'polygon',
          points: [
            { x: -9, y: -2 },
            { x: -16, y: -6 },
            { x: -11, y: 4 },
          ],
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 9, y: -2 },
            { x: 16, y: -6 },
            { x: 11, y: 4 },
          ],
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
          },
        },
        // Bone ritual skull mask
        {
          kind: 'roundedRect',
          x: -10.5,
          y: -10,
          w: 21,
          h: 17,
          r: 7,
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.WARM_STONE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
        // Glowing purple/lime shaman eyes
        {
          kind: 'circle',
          cx: -4,
          cy: -1,
          r: 2.4,
          style: {
            fill: PALETTE.LIME_GLOW,
            highlight: PALETTE.MINT_LIGHT,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: 4,
          cy: -1,
          r: 2.4,
          style: {
            fill: PALETTE.LIME_GLOW,
            highlight: PALETTE.MINT_LIGHT,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 38,
      height: 20,
      offsetX: 10,
      offsetY: -14,
      originX: 0.25,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'roundedRect',
          x: -8,
          y: -2,
          w: 22,
          h: 4,
          r: 2,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_LIGHT,
          },
        },
        {
          kind: 'circle',
          cx: 16,
          cy: 0,
          r: 5.5,
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.GOBLIN_GREEN,
            highlight: PALETTE.MINT_LIGHT,
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
          r: 4.2,
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
          },
        },
      ],
    },
  ],
};

/**
 * Biome 1 Stationary Turret: Cối Xay Gai Độc (Thorn Turret)
 * Rooted carnivorous briar blossom firing 6 radial thorns.
 */
export const THORN_TURRET_RIG_DEF: EntityRigDef = {
  id: 'thorn_turret',
  nameVi: 'Cối Xay Gai Độc (Thorn Turret)',
  roleVi: 'Ụ Gai Bắn 6 Hướng · Biome 1',
  worldWidth: 36,
  worldHeight: 36,
  shadowRx: 15,
  shadowRy: 7,
  parts: [
    {
      id: 'backAccessory',
      width: 34,
      height: 24,
      offsetX: 0,
      offsetY: -8,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -14, y: 0 },
            { x: -7, y: -9 },
            { x: 7, y: -9 },
            { x: 14, y: 0 },
            { x: 8, y: 9 },
            { x: -8, y: 9 },
          ],
          style: {
            fill: PALETTE.MOSS_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.FOREST_SHADE,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 14,
      height: 12,
      offsetX: -9,
      offsetY: -4,
      originX: 0.5,
      originY: 0.5,
      zIndex: 20,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -6, y: 2 },
            { x: 0, y: -4 },
            { x: 5, y: 2 },
          ],
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.GOBLIN_GREEN,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 14,
      height: 12,
      offsetX: 9,
      offsetY: -4,
      originX: 0.5,
      originY: 0.5,
      zIndex: 21,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -5, y: 2 },
            { x: 0, y: -4 },
            { x: 6, y: 2 },
          ],
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.GOBLIN_GREEN,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 30,
      height: 26,
      offsetX: 0,
      offsetY: -13,
      originX: 0.5,
      originY: 0.5,
      zIndex: 30,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 11,
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.GOBLIN_GREEN,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 16,
      height: 16,
      offsetX: -12,
      offsetY: -14,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: 4, y: -4 },
            { x: -7, y: 0 },
            { x: 4, y: 4 },
          ],
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.WARM_STONE,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 32,
      height: 32,
      offsetX: 0,
      offsetY: -20,
      originX: 0.5,
      originY: 0.5,
      zIndex: 40,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 10.5,
          style: {
            fill: PALETTE.TOXIC_PURPLE,
            shade: PALETTE.RUBY_DARK,
            highlight: PALETTE.ELECTRIC_VIOLET,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 5.2,
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.GOBLIN_GREEN,
            highlight: PALETTE.SOLAR_GOLD,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 24,
      height: 16,
      offsetX: 9,
      offsetY: -16,
      originX: 0.3,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -3, y: -4 },
            { x: 11, y: 0 },
            { x: -3, y: 4 },
          ],
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.GOBLIN_GREEN,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 16,
      height: 16,
      offsetX: 12,
      offsetY: -14,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -4, y: -4 },
            { x: 7, y: 0 },
            { x: -4, y: 4 },
          ],
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
 * 3-4P Boss Shield Guardian: Nấm Hộ Vệ Mục Vương (Spore Guardian)
 */
export const SPORE_GUARDIAN_RIG_DEF: EntityRigDef = {
  id: 'spore_guardian',
  nameVi: 'Nấm Hộ Vệ Mục Vương',
  roleVi: 'Trụ Khiên Bào Tử · Bảo Vệ Boss 3–4P',
  worldWidth: 36,
  worldHeight: 40,
  shadowRx: 15,
  shadowRy: 7,
  parts: [
    {
      id: 'backAccessory',
      width: 34,
      height: 24,
      offsetX: 0,
      offsetY: -12,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 0,
          rx: 14,
          ry: 9,
          style: {
            fill: PALETTE.TOXIC_PURPLE,
            shade: PALETTE.SLATE_DARK,
            highlight: PALETTE.ELECTRIC_VIOLET,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 12,
      height: 12,
      offsetX: -6,
      offsetY: -4,
      originX: 0.5,
      originY: 0.5,
      zIndex: 20,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4,
          style: {
            fill: PALETTE.MOSS_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.FOREST_SHADE,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 12,
      height: 12,
      offsetX: 6,
      offsetY: -4,
      originX: 0.5,
      originY: 0.5,
      zIndex: 21,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4,
          style: {
            fill: PALETTE.MOSS_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.FOREST_SHADE,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 28,
      height: 24,
      offsetX: 0,
      offsetY: -12,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        {
          kind: 'roundedRect',
          x: -9,
          y: -8,
          w: 18,
          h: 16,
          r: 5,
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.LIME_GLOW,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 14,
      height: 14,
      offsetX: -11,
      offsetY: -12,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4.5,
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
      width: 36,
      height: 28,
      offsetX: 0,
      offsetY: -24,
      originX: 0.5,
      originY: 0.6,
      zIndex: 40,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 0,
          rx: 15,
          ry: 10,
          style: {
            fill: PALETTE.TOXIC_PURPLE,
            shade: PALETTE.SLATE_MID,
            highlight: PALETTE.ELECTRIC_VIOLET,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: -2,
          r: 4,
          style: {
            fill: PALETTE.LIME_GLOW,
            highlight: PALETTE.MINT_LIGHT,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 16,
      height: 16,
      offsetX: 8,
      offsetY: -14,
      originX: 0.5,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4,
          style: {
            fill: PALETTE.ELECTRIC_VIOLET,
            shade: PALETTE.TOXIC_PURPLE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 14,
      height: 14,
      offsetX: 11,
      offsetY: -12,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4.5,
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
