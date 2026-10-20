import { PALETTE } from './palette.js';
import { INNER_OUTLINE_WIDTH } from './primitives.js';
import type { EntityRigDef } from './rig-types.js';

export const ICE_MAGE_RIG_DEF: EntityRigDef = {
  id: 'ice_mage',
  nameVi: 'Pháp Sư Băng (Ice Mage)',
  roleVi: 'Pháp Sư Đóng Băng · Biome 2',
  worldWidth: 34,
  worldHeight: 44,
  shadowRx: 13,
  shadowRy: 5.5,
  parts: [
    {
      id: 'backAccessory',
      width: 34,
      height: 34,
      offsetX: 0,
      offsetY: -22,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Floating crystalline halo ring behind mage
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -15 },
            { x: 13, y: -5 },
            { x: 9, y: 11 },
            { x: -9, y: 11 },
            { x: -13, y: -5 },
          ],
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
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
      originY: 0.3,
      zIndex: 20,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -4, y: -3 },
            { x: 4, y: -3 },
            { x: 2, y: 4 },
            { x: -3, y: 4 },
          ],
          style: {
            fill: PALETTE.ABYSS_BLUE,
            shade: PALETTE.INK_DARK,
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
      originY: 0.3,
      zIndex: 21,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -4, y: -3 },
            { x: 4, y: -3 },
            { x: 3, y: 4 },
            { x: -2, y: 4 },
          ],
          style: {
            fill: PALETTE.ABYSS_BLUE,
            shade: PALETTE.INK_DARK,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 30,
      height: 28,
      offsetX: 0,
      offsetY: -15,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        // Flared wizard robe
        {
          kind: 'polygon',
          points: [
            { x: -9, y: -10 },
            { x: 9, y: -10 },
            { x: 13, y: 11 },
            { x: -13, y: 11 },
          ],
          style: {
            fill: PALETTE.COBALT_SHADE,
            shade: PALETTE.ABYSS_BLUE,
            highlight: PALETTE.AZURE_CORE,
          },
        },
        // Frost crystal stole
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -7 },
            { x: 5, y: 1 },
            { x: 0, y: 9 },
            { x: -5, y: 1 },
          ],
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 16,
      height: 16,
      offsetX: -11,
      offsetY: -15,
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
            fill: PALETTE.AZURE_CORE,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 32,
      height: 34,
      offsetX: 0,
      offsetY: -29,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        // Pointed arcane hood with crystal crest
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -16 },
            { x: 12, y: -2 },
            { x: 10, y: 8 },
            { x: -10, y: 8 },
            { x: -12, y: -2 },
          ],
          style: {
            fill: PALETTE.COBALT_SHADE,
            shade: PALETTE.ABYSS_BLUE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 7,
          style: {
            fill: PALETTE.INK_DARK,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: -3,
          cy: 0,
          r: 2.2,
          style: {
            fill: PALETTE.ICE_WHITE,
            highlight: PALETTE.CYAN_FROST,
            outlineWidth: 0,
          },
        },
        {
          kind: 'circle',
          cx: 3,
          cy: 0,
          r: 2.2,
          style: {
            fill: PALETTE.ICE_WHITE,
            highlight: PALETTE.CYAN_FROST,
            outlineWidth: 0,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 34,
      height: 36,
      offsetX: 12,
      offsetY: -16,
      originX: 0.4,
      originY: 0.6,
      zIndex: 45,
      shapes: [
        // Tall Frost Staff with diamond crystal head
        {
          kind: 'roundedRect',
          x: -2,
          y: -10,
          w: 4,
          h: 24,
          r: 1.5,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.COBALT_SHADE,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -19 },
            { x: 7, y: -11 },
            { x: 0, y: -4 },
            { x: -7, y: -11 },
          ],
          style: {
            fill: PALETTE.ICE_WHITE,
            shade: PALETTE.CYAN_FROST,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 16,
      height: 16,
      offsetX: 11,
      offsetY: -14,
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
            fill: PALETTE.AZURE_CORE,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
  ],
};

export const ICE_GOLEM_RIG_DEF: EntityRigDef = {
  id: 'ice_golem',
  nameVi: 'Golem Băng (Ice Golem)',
  roleVi: 'Tank Khiên Băng Trước Mặt · Biome 2',
  worldWidth: 46,
  worldHeight: 50,
  shadowRx: 19,
  shadowRy: 8.5,
  parts: [
    {
      id: 'backAccessory',
      width: 44,
      height: 36,
      offsetX: 0,
      offsetY: -22,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Twin glacier shoulder spires
        {
          kind: 'polygon',
          points: [
            { x: -18, y: 4 },
            { x: -14, y: -16 },
            { x: -4, y: -6 },
            { x: 4, y: -6 },
            { x: 14, y: -16 },
            { x: 18, y: 4 },
          ],
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 18,
      height: 18,
      offsetX: -8,
      offsetY: -6,
      originX: 0.5,
      originY: 0.25,
      zIndex: 20,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -6, y: -4 },
            { x: 6, y: -4 },
            { x: 7, y: 8 },
            { x: -7, y: 8 },
          ],
          style: {
            fill: PALETTE.COBALT_SHADE,
            shade: PALETTE.ABYSS_BLUE,
            highlight: PALETTE.AZURE_CORE,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 18,
      height: 18,
      offsetX: 8,
      offsetY: -6,
      originX: 0.5,
      originY: 0.25,
      zIndex: 21,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -6, y: -4 },
            { x: 6, y: -4 },
            { x: 7, y: 8 },
            { x: -7, y: 8 },
          ],
          style: {
            fill: PALETTE.COBALT_SHADE,
            shade: PALETTE.ABYSS_BLUE,
            highlight: PALETTE.AZURE_CORE,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 40,
      height: 32,
      offsetX: 0,
      offsetY: -17,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        // Chiseled hexagonal ice boulder torso
        {
          kind: 'polygon',
          points: [
            { x: -14, y: -12 },
            { x: 14, y: -12 },
            { x: 18, y: 0 },
            { x: 12, y: 12 },
            { x: -12, y: 12 },
            { x: -18, y: 0 },
          ],
          style: {
            fill: PALETTE.AZURE_CORE,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -6 },
            { x: 6, y: 0 },
            { x: 0, y: 6 },
            { x: -6, y: 0 },
          ],
          style: {
            fill: PALETTE.VOLT_YELLOW,
            shade: PALETTE.SOLAR_GOLD,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 24,
      height: 26,
      offsetX: -17,
      offsetY: -16,
      originX: 0.5,
      originY: 0.45,
      zIndex: 35,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -8, y: -8 },
            { x: 7, y: -6 },
            { x: 8, y: 9 },
            { x: -7, y: 9 },
          ],
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 34,
      height: 28,
      offsetX: 0,
      offsetY: -31,
      originX: 0.5,
      originY: 0.6,
      zIndex: 40,
      shapes: [
        // Angular glacier monolith head
        {
          kind: 'polygon',
          points: [
            { x: -9, y: -11 },
            { x: 0, y: -15 },
            { x: 9, y: -11 },
            { x: 12, y: 6 },
            { x: -12, y: 6 },
          ],
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
        // Glowing golden visor slit
        {
          kind: 'roundedRect',
          x: -7,
          y: -3,
          w: 14,
          h: 4,
          r: 1.5,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: 1,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 34,
      height: 42,
      offsetX: 15,
      offsetY: -15,
      originX: 0.35,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        // Massive faceted Glacier Tower Shield
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -18 },
            { x: 11, y: -11 },
            { x: 11, y: 11 },
            { x: 0, y: 18 },
            { x: -8, y: 11 },
            { x: -8, y: -11 },
          ],
          style: {
            fill: PALETTE.ICE_WHITE,
            shade: PALETTE.CYAN_FROST,
            highlight: PALETTE.BONE_WHITE,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 1.5, y: -10 },
            { x: 6, y: 0 },
            { x: 1.5, y: 10 },
            { x: -3, y: 0 },
          ],
          style: {
            fill: PALETTE.AZURE_CORE,
            shade: PALETTE.COBALT_SHADE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 20,
      height: 20,
      offsetX: 13,
      offsetY: -15,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 6,
          style: {
            fill: PALETTE.AZURE_CORE,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
  ],
};

export const SNOW_SPIRIT_RIG_DEF: EntityRigDef = {
  id: 'snow_spirit',
  nameVi: 'Tinh Linh Tuyết (Snow Spirit)',
  roleVi: 'Cảm Tử Nổ Băng · Biome 2',
  worldWidth: 34,
  worldHeight: 36,
  shadowRx: 11,
  shadowRy: 4.5,
  parts: [
    {
      id: 'backAccessory',
      width: 36,
      height: 36,
      offsetX: 0,
      offsetY: -18,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // 8-pointed snowflake crystal halo
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -16 },
            { x: 5, y: -5 },
            { x: 16, y: 0 },
            { x: 5, y: 5 },
            { x: 0, y: 16 },
            { x: -5, y: 5 },
            { x: -16, y: 0 },
            { x: -5, y: -5 },
          ],
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 12,
      height: 14,
      offsetX: -5,
      offsetY: -6,
      originX: 0.5,
      originY: 0.2,
      zIndex: 20,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -3, y: -2 },
            { x: 3, y: -2 },
            { x: 0, y: 6 },
          ],
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 12,
      height: 14,
      offsetX: 5,
      offsetY: -6,
      originX: 0.5,
      originY: 0.2,
      zIndex: 21,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -3, y: -2 },
            { x: 3, y: -2 },
            { x: 0, y: 6 },
          ],
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 28,
      height: 28,
      offsetX: 0,
      offsetY: -18,
      originX: 0.5,
      originY: 0.5,
      zIndex: 30,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -12 },
            { x: 11, y: 0 },
            { x: 0, y: 12 },
            { x: -11, y: 0 },
          ],
          style: {
            fill: PALETTE.ICE_WHITE,
            shade: PALETTE.CYAN_FROST,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 14,
      height: 14,
      offsetX: -13,
      offsetY: -18,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -5 },
            { x: 4, y: 0 },
            { x: 0, y: 5 },
            { x: -4, y: 0 },
          ],
          style: {
            fill: PALETTE.ELECTRIC_VIOLET,
            shade: PALETTE.TOXIC_PURPLE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 24,
      height: 24,
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
          r: 7.5,
          style: {
            fill: PALETTE.ELECTRIC_VIOLET,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
        {
          kind: 'circle',
          cx: -2.8,
          cy: -1,
          r: 2,
          style: {
            fill: PALETTE.ICE_WHITE,
            outlineWidth: 0,
          },
        },
        {
          kind: 'circle',
          cx: 2.8,
          cy: -1,
          r: 2,
          style: {
            fill: PALETTE.ICE_WHITE,
            outlineWidth: 0,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 14,
      height: 14,
      offsetX: 13,
      offsetY: -18,
      originX: 0.5,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -5 },
            { x: 4, y: 0 },
            { x: 0, y: 5 },
            { x: -4, y: 0 },
          ],
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
      width: 10,
      height: 10,
      offsetX: 0,
      offsetY: -31,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 3,
          style: {
            fill: PALETTE.ICE_WHITE,
            shade: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
  ],
};
