import { PALETTE } from './palette.js';
import type { EntityRigDef } from './rig-types.js';

function buildKryssaQueenRig(spec: {
  id: string;
  nameVi: string;
  roleVi: string;
  scale: number;
  isClone: boolean;
}): EntityRigDef {
  const s = spec.scale;
  return {
    id: spec.id,
    nameVi: spec.nameVi,
    roleVi: spec.roleVi,
    worldWidth: Math.round(44 * s),
    worldHeight: Math.round(50 * s),
    shadowRx: Math.round(17 * s),
    shadowRy: Math.round(7.5 * s),
    parts: [
      {
        id: 'backAccessory',
        width: Math.round(44 * s),
        height: Math.round(38 * s),
        offsetX: 0,
        offsetY: Math.round(-22 * s),
        originX: 0.5,
        originY: 0.5,
        zIndex: 10,
        shapes: [
          // Radiating 6-wing Aurora Ice Mantle
          {
            kind: 'polygon',
            points: [
              { x: 0, y: -6 * s },
              { x: -19 * s, y: -16 * s },
              { x: -14 * s, y: -2 * s },
              { x: -20 * s, y: 8 * s },
              { x: -9 * s, y: 14 * s },
              { x: 0, y: 17 * s },
              { x: 9 * s, y: 14 * s },
              { x: 20 * s, y: 8 * s },
              { x: 14 * s, y: -2 * s },
              { x: 19 * s, y: -16 * s },
            ],
            style: {
              fill: spec.isClone ? PALETTE.ELECTRIC_VIOLET : PALETTE.COBALT_SHADE,
              shade: PALETTE.ABYSS_BLUE,
              highlight: PALETTE.CYAN_FROST,
            },
          },
        ],
      },
      {
        id: 'legLeft',
        width: Math.round(12 * s),
        height: Math.round(12 * s),
        offsetX: Math.round(-5 * s),
        offsetY: Math.round(-4 * s),
        originX: 0.5,
        originY: 0.3,
        zIndex: 20,
        shapes: [
          {
            kind: 'polygon',
            points: [
              { x: -3 * s, y: -3 * s },
              { x: 3 * s, y: -3 * s },
              { x: 2 * s, y: 4 * s },
              { x: -2 * s, y: 4 * s },
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
        width: Math.round(12 * s),
        height: Math.round(12 * s),
        offsetX: Math.round(5 * s),
        offsetY: Math.round(-4 * s),
        originX: 0.5,
        originY: 0.3,
        zIndex: 21,
        shapes: [
          {
            kind: 'polygon',
            points: [
              { x: -3 * s, y: -3 * s },
              { x: 3 * s, y: -3 * s },
              { x: 2 * s, y: 4 * s },
              { x: -2 * s, y: 4 * s },
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
        width: Math.round(32 * s),
        height: Math.round(30 * s),
        offsetX: 0,
        offsetY: Math.round(-15 * s),
        originX: 0.5,
        originY: 0.55,
        zIndex: 30,
        shapes: [
          // Royal sculpted ice gown
          {
            kind: 'polygon',
            points: [
              { x: -10 * s, y: -11 * s },
              { x: 10 * s, y: -11 * s },
              { x: 7 * s, y: -2 * s },
              { x: 14 * s, y: 12 * s },
              { x: 0, y: 14 * s },
              { x: -14 * s, y: 12 * s },
              { x: -7 * s, y: -2 * s },
            ],
            style: {
              fill: spec.isClone ? PALETTE.CYAN_FROST : PALETTE.AZURE_CORE,
              shade: PALETTE.COBALT_SHADE,
              highlight: PALETTE.ICE_WHITE,
            },
          },
          // Glowing frost-heart gem
          {
            kind: 'polygon',
            points: [
              { x: 0, y: -7 * s },
              { x: 4.5 * s, y: -2 * s },
              { x: 0, y: 3 * s },
              { x: -4.5 * s, y: -2 * s },
            ],
            style: {
              fill: PALETTE.ICE_WHITE,
              shade: PALETTE.ELECTRIC_VIOLET,
              highlight: PALETTE.BONE_WHITE,
            },
          },
        ],
      },
      {
        id: 'armLeft',
        width: Math.round(16 * s),
        height: Math.round(16 * s),
        offsetX: Math.round(-12 * s),
        offsetY: Math.round(-16 * s),
        originX: 0.5,
        originY: 0.5,
        zIndex: 35,
        shapes: [
          {
            kind: 'polygon',
            points: [
              { x: 0, y: -6 * s },
              { x: 5 * s, y: 0 },
              { x: 0, y: 6 * s },
              { x: -5 * s, y: 0 },
            ],
            style: {
              fill: PALETTE.ICE_WHITE,
              shade: PALETTE.CYAN_FROST,
            },
          },
        ],
      },
      {
        id: 'head',
        width: Math.round(34 * s),
        height: Math.round(36 * s),
        offsetX: 0,
        offsetY: Math.round(-30 * s),
        originX: 0.5,
        originY: 0.65,
        zIndex: 40,
        shapes: [
          // 5-Spire Royal Ice Crown
          {
            kind: 'polygon',
            points: [
              { x: -11 * s, y: -5 * s },
              { x: -13 * s, y: -14 * s },
              { x: -6 * s, y: -9 * s },
              { x: 0, y: -18 * s },
              { x: 6 * s, y: -9 * s },
              { x: 13 * s, y: -14 * s },
              { x: 11 * s, y: -5 * s },
            ],
            style: {
              fill: PALETTE.ICE_WHITE,
              shade: PALETTE.CYAN_FROST,
              highlight: PALETTE.BONE_WHITE,
            },
          },
          {
            kind: 'roundedRect',
            x: -10 * s,
            y: -7 * s,
            w: 20 * s,
            h: 15 * s,
            r: 7 * s,
            style: {
              fill: PALETTE.ICE_WHITE,
              shade: PALETTE.CYAN_FROST,
              highlight: PALETTE.BONE_WHITE,
            },
          },
          {
            kind: 'circle',
            cx: -3.8 * s,
            cy: 0,
            r: 2.2 * s,
            style: {
              fill: spec.isClone ? PALETTE.ELECTRIC_VIOLET : PALETTE.AZURE_CORE,
              highlight: PALETTE.ICE_WHITE,
              outlineWidth: 0,
            },
          },
          {
            kind: 'circle',
            cx: 3.8 * s,
            cy: 0,
            r: 2.2 * s,
            style: {
              fill: spec.isClone ? PALETTE.ELECTRIC_VIOLET : PALETTE.AZURE_CORE,
              highlight: PALETTE.ICE_WHITE,
              outlineWidth: 0,
            },
          },
        ],
      },
      {
        id: 'weapon',
        width: Math.round(36 * s),
        height: Math.round(42 * s),
        offsetX: Math.round(14 * s),
        offsetY: Math.round(-18 * s),
        originX: 0.4,
        originY: 0.6,
        zIndex: 45,
        shapes: [
          // Royal Crescent Ice Scepter
          {
            kind: 'roundedRect',
            x: -2 * s,
            y: -12 * s,
            w: 4 * s,
            h: 28 * s,
            r: 1.5 * s,
            style: {
              fill: PALETTE.CYAN_FROST,
              shade: PALETTE.COBALT_SHADE,
            },
          },
          {
            kind: 'polygon',
            points: [
              { x: 0, y: -21 * s },
              { x: 9 * s, y: -12 * s },
              { x: 0, y: -5 * s },
              { x: -9 * s, y: -12 * s },
            ],
            style: {
              fill: PALETTE.ICE_WHITE,
              shade: PALETTE.ELECTRIC_VIOLET,
              highlight: PALETTE.BONE_WHITE,
            },
          },
        ],
      },
      {
        id: 'armRight',
        width: Math.round(16 * s),
        height: Math.round(16 * s),
        offsetX: Math.round(12 * s),
        offsetY: Math.round(-15 * s),
        originX: 0.5,
        originY: 0.5,
        zIndex: 50,
        shapes: [
          {
            kind: 'circle',
            cx: 0,
            cy: 0,
            r: 4.5 * s,
            style: {
              fill: PALETTE.ICE_WHITE,
              shade: PALETTE.CYAN_FROST,
            },
          },
        ],
      },
    ],
  };
}

export const KRYSSA_ICE_QUEEN_RIG_DEF: EntityRigDef = buildKryssaQueenRig({
  id: 'kryssa_ice_queen',
  nameVi: 'Băng Hậu Kryssa (Ice Queen)',
  roleVi: 'Boss Biome 2 · Phân Thân Gương & Bão Tuyết',
  scale: 1.65,
  isClone: false,
});

export const KRYSSA_CLONE_RIG_DEF: EntityRigDef = buildKryssaQueenRig({
  id: 'kryssa_clone',
  nameVi: 'Ảo Ảnh Băng Hậu (Mirror Clone)',
  roleVi: 'Phân Thân Không Bóng Đổ · Biome 2',
  scale: 1.05,
  isClone: true,
});

export const ICE_PRISON_RIG_DEF: EntityRigDef = {
  id: 'ice_prison',
  nameVi: 'Lồng Băng Vĩnh Cửu (Ice Prison)',
  roleVi: 'Giam Giữ Đồng Đội · Bắn Vỡ Để Cứu',
  worldWidth: 42,
  worldHeight: 48,
  shadowRx: 17,
  shadowRy: 7.5,
  parts: [
    {
      id: 'backAccessory',
      width: 42,
      height: 44,
      offsetX: 0,
      offsetY: -22,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Outer jagged glacier spires of the prison cage
        {
          kind: 'polygon',
          points: [
            { x: -16, y: 14 },
            { x: -18, y: -6 },
            { x: -9, y: -20 },
            { x: 0, y: -12 },
            { x: 9, y: -20 },
            { x: 18, y: -6 },
            { x: 16, y: 14 },
          ],
          style: {
            fill: PALETTE.AZURE_CORE,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 14,
      height: 14,
      offsetX: -8,
      offsetY: -5,
      originX: 0.5,
      originY: 0.5,
      zIndex: 20,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -5, y: 4 },
            { x: -2, y: -5 },
            { x: 5, y: 4 },
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
      id: 'legRight',
      width: 14,
      height: 14,
      offsetX: 8,
      offsetY: -5,
      originX: 0.5,
      originY: 0.5,
      zIndex: 21,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -5, y: 4 },
            { x: 2, y: -5 },
            { x: 5, y: 4 },
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
      width: 38,
      height: 42,
      offsetX: 0,
      offsetY: -20,
      originX: 0.5,
      originY: 0.5,
      zIndex: 30,
      shapes: [
        // Central translucent-styled crystal prism
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -19 },
            { x: 14, y: -6 },
            { x: 11, y: 16 },
            { x: -11, y: 16 },
            { x: -14, y: -6 },
          ],
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
        // Trapped golden soul light inside cage
        {
          kind: 'circle',
          cx: 0,
          cy: -2,
          r: 6,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            shade: PALETTE.FLAME_ORANGE,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 14,
      height: 20,
      offsetX: -14,
      offsetY: -18,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -8 },
            { x: 5, y: 6 },
            { x: -5, y: 6 },
          ],
          style: {
            fill: PALETTE.ICE_WHITE,
            shade: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 32,
      height: 36,
      offsetX: 0,
      offsetY: -20,
      originX: 0.5,
      originY: 0.5,
      zIndex: 40,
      shapes: [
        // Front crossed ice bars locking the prison
        {
          kind: 'polygon',
          points: [
            { x: -10, y: -12 },
            { x: -6, y: -12 },
            { x: 10, y: 12 },
            { x: 6, y: 12 },
          ],
          style: {
            fill: PALETTE.ICE_WHITE,
            shade: PALETTE.CYAN_FROST,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 6, y: -12 },
            { x: 10, y: -12 },
            { x: -6, y: 12 },
            { x: -10, y: 12 },
          ],
          style: {
            fill: PALETTE.ICE_WHITE,
            shade: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 14,
      height: 18,
      offsetX: 0,
      offsetY: -36,
      originX: 0.5,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -7 },
            { x: 4, y: 5 },
            { x: -4, y: 5 },
          ],
          style: {
            fill: PALETTE.ICE_WHITE,
            shade: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 14,
      height: 20,
      offsetX: 14,
      offsetY: -18,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -8 },
            { x: 5, y: 6 },
            { x: -5, y: 6 },
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
