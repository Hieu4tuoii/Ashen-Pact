import { PALETTE } from './palette.js';
import { INNER_OUTLINE_WIDTH } from './primitives.js';
import type { EntityRigDef } from './rig-types.js';

export const FROST_BAT_RIG_DEF: EntityRigDef = {
  id: 'frost_bat',
  nameVi: 'Dơi Băng (Frost Bat)',
  roleVi: 'Quái Bay Nhanh · Biome 2',
  worldWidth: 34,
  worldHeight: 30,
  shadowRx: 11,
  shadowRy: 4.5,
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
        // Frost crystal tail spikes
        {
          kind: 'polygon',
          points: [
            { x: -6, y: 2 },
            { x: 0, y: 10 },
            { x: 6, y: 2 },
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
      width: 10,
      height: 10,
      offsetX: -4,
      offsetY: -5,
      originX: 0.5,
      originY: 0.3,
      zIndex: 20,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -2, y: -2 },
            { x: 2, y: -2 },
            { x: 0, y: 4 },
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
      width: 10,
      height: 10,
      offsetX: 4,
      offsetY: -5,
      originX: 0.5,
      originY: 0.3,
      zIndex: 21,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -2, y: -2 },
            { x: 2, y: -2 },
            { x: 0, y: 4 },
          ],
          style: {
            fill: PALETTE.ABYSS_BLUE,
            shade: PALETTE.INK_DARK,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 28,
      height: 24,
      offsetX: -12,
      offsetY: -16,
      originX: 0.8,
      originY: 0.5,
      zIndex: 25,
      shapes: [
        // Jagged left bat wing
        {
          kind: 'polygon',
          points: [
            { x: 8, y: -2 },
            { x: -4, y: -10 },
            { x: -12, y: -4 },
            { x: -9, y: 6 },
            { x: -2, y: 3 },
            { x: 4, y: 7 },
          ],
          style: {
            fill: PALETTE.COBALT_SHADE,
            shade: PALETTE.ABYSS_BLUE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 28,
      height: 24,
      offsetX: 12,
      offsetY: -16,
      originX: 0.2,
      originY: 0.5,
      zIndex: 48,
      shapes: [
        // Jagged right bat wing
        {
          kind: 'polygon',
          points: [
            { x: -8, y: -2 },
            { x: 4, y: -10 },
            { x: 12, y: -4 },
            { x: 9, y: 6 },
            { x: 2, y: 3 },
            { x: -4, y: 7 },
          ],
          style: {
            fill: PALETTE.COBALT_SHADE,
            shade: PALETTE.ABYSS_BLUE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 22,
      height: 20,
      offsetX: 0,
      offsetY: -14,
      originX: 0.5,
      originY: 0.5,
      zIndex: 30,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 0,
          rx: 8,
          ry: 7,
          style: {
            fill: PALETTE.AZURE_CORE,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -4 },
            { x: 4, y: 0 },
            { x: 0, y: 4 },
            { x: -4, y: 0 },
          ],
          style: {
            fill: PALETTE.ICE_WHITE,
            shade: PALETTE.CYAN_FROST,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 28,
      height: 26,
      offsetX: 0,
      offsetY: -22,
      originX: 0.5,
      originY: 0.6,
      zIndex: 40,
      shapes: [
        // Tall pointed bat ears
        {
          kind: 'polygon',
          points: [
            { x: -8, y: -2 },
            { x: -12, y: -12 },
            { x: -3, y: -6 },
          ],
          style: {
            fill: PALETTE.COBALT_SHADE,
            shade: PALETTE.ABYSS_BLUE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 8, y: -2 },
            { x: 12, y: -12 },
            { x: 3, y: -6 },
          ],
          style: {
            fill: PALETTE.COBALT_SHADE,
            shade: PALETTE.ABYSS_BLUE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
        {
          kind: 'ellipse',
          cx: 0,
          cy: -1,
          rx: 9,
          ry: 7,
          style: {
            fill: PALETTE.AZURE_CORE,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
        // Glowing eyes + white ice fangs
        {
          kind: 'circle',
          cx: -3.5,
          cy: -2,
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
          cy: -2,
          r: 2.2,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: 0,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: -4, y: 3 },
            { x: -2.5, y: 7 },
            { x: -1, y: 3 },
          ],
          style: {
            fill: PALETTE.ICE_WHITE,
            outlineWidth: 1,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 1, y: 3 },
            { x: 2.5, y: 7 },
            { x: 4, y: 3 },
          ],
          style: {
            fill: PALETTE.ICE_WHITE,
            outlineWidth: 1,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 16,
      height: 16,
      offsetX: 8,
      offsetY: -16,
      originX: 0.5,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -3, y: -4 },
            { x: 6, y: 0 },
            { x: -3, y: 4 },
          ],
          style: {
            fill: PALETTE.ICE_WHITE,
            shade: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
  ],
};

export const BABY_YETI_RIG_DEF: EntityRigDef = {
  id: 'baby_yeti',
  nameVi: 'Yeti Con (Baby Yeti)',
  roleVi: 'Quái Húc Trượt Băng · Biome 2',
  worldWidth: 40,
  worldHeight: 42,
  shadowRx: 16,
  shadowRy: 7,
  parts: [
    {
      id: 'backAccessory',
      width: 36,
      height: 30,
      offsetX: 0,
      offsetY: -18,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Shaggy fur hump + ice crystals on back
        {
          kind: 'ellipse',
          cx: 0,
          cy: 0,
          rx: 15,
          ry: 12,
          style: {
            fill: PALETTE.SILVER_BRIGHT,
            shade: PALETTE.STEEL_LIGHT,
            highlight: PALETTE.BONE_WHITE,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: -8, y: -8 },
            { x: -4, y: -14 },
            { x: 0, y: -8 },
          ],
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 2, y: -8 },
            { x: 7, y: -14 },
            { x: 10, y: -7 },
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
      width: 16,
      height: 16,
      offsetX: -7,
      offsetY: -5,
      originX: 0.5,
      originY: 0.3,
      zIndex: 20,
      shapes: [
        {
          kind: 'roundedRect',
          x: -5.5,
          y: -4,
          w: 11,
          h: 10,
          r: 4,
          style: {
            fill: PALETTE.SILVER_BRIGHT,
            shade: PALETTE.STEEL_LIGHT,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 16,
      height: 16,
      offsetX: 7,
      offsetY: -5,
      originX: 0.5,
      originY: 0.3,
      zIndex: 21,
      shapes: [
        {
          kind: 'roundedRect',
          x: -5.5,
          y: -4,
          w: 11,
          h: 10,
          r: 4,
          style: {
            fill: PALETTE.SILVER_BRIGHT,
            shade: PALETTE.STEEL_LIGHT,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 36,
      height: 28,
      offsetX: 0,
      offsetY: -15,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 0,
          rx: 15,
          ry: 12,
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.SILVER_BRIGHT,
            highlight: PALETTE.ICE_WHITE,
          },
        },
        // Frost belly patch
        {
          kind: 'ellipse',
          cx: 0,
          cy: 2,
          rx: 8,
          ry: 6,
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
      width: 22,
      height: 24,
      offsetX: -15,
      offsetY: -14,
      originX: 0.5,
      originY: 0.4,
      zIndex: 35,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 2,
          rx: 7.5,
          ry: 9,
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.SILVER_BRIGHT,
            highlight: PALETTE.ICE_WHITE,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 36,
      height: 30,
      offsetX: 0,
      offsetY: -27,
      originX: 0.5,
      originY: 0.6,
      zIndex: 40,
      shapes: [
        // Curved blue ram horns
        {
          kind: 'polygon',
          points: [
            { x: -10, y: -3 },
            { x: -17, y: -10 },
            { x: -13, y: -2 },
            { x: -7, y: -7 },
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
            { x: 10, y: -3 },
            { x: 17, y: -10 },
            { x: 13, y: -2 },
            { x: 7, y: -7 },
          ],
          style: {
            fill: PALETTE.AZURE_CORE,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
        {
          kind: 'roundedRect',
          x: -12,
          y: -9,
          w: 24,
          h: 18,
          r: 8,
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.SILVER_BRIGHT,
            highlight: PALETTE.ICE_WHITE,
          },
        },
        // Blue Yeti face mask
        {
          kind: 'roundedRect',
          x: -8,
          y: -4,
          w: 16,
          h: 9,
          r: 4,
          style: {
            fill: PALETTE.COBALT_SHADE,
            shade: PALETTE.ABYSS_BLUE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: -4,
          cy: -0.5,
          r: 2.2,
          style: {
            fill: PALETTE.CYAN_FROST,
            highlight: PALETTE.ICE_WHITE,
            outlineWidth: 0,
          },
        },
        {
          kind: 'circle',
          cx: 4,
          cy: -0.5,
          r: 2.2,
          style: {
            fill: PALETTE.CYAN_FROST,
            highlight: PALETTE.ICE_WHITE,
            outlineWidth: 0,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 24,
      height: 22,
      offsetX: 15,
      offsetY: -12,
      originX: 0.4,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        // Ice boulder / frost claw
        {
          kind: 'polygon',
          points: [
            { x: -4, y: -7 },
            { x: 8, y: -5 },
            { x: 10, y: 2 },
            { x: 4, y: 8 },
            { x: -5, y: 5 },
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
      id: 'armRight',
      width: 22,
      height: 24,
      offsetX: 14,
      offsetY: -14,
      originX: 0.5,
      originY: 0.4,
      zIndex: 50,
      shapes: [
        {
          kind: 'ellipse',
          cx: 0,
          cy: 2,
          rx: 7.5,
          ry: 9,
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.SILVER_BRIGHT,
            highlight: PALETTE.ICE_WHITE,
          },
        },
      ],
    },
  ],
};
