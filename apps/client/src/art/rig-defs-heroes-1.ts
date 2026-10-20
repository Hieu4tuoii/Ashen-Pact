import { PALETTE } from './palette.js';
import { INNER_OUTLINE_WIDTH, STANDARD_OUTLINE_WIDTH } from './primitives.js';
import type { EntityRigDef } from './rig-types.js';

/**
 * Sample Playable Character #1: Thiết Vệ (Vanguard)
 * Chibi proportions (~34x42 world units, Head ~40% height), Ruby cape, Steel plate armor,
 * Ruby crest shield on left arm, Knight Broadsword in right hand.
 */
export const VANGUARD_RIG_DEF: EntityRigDef = {
  id: 'vanguard',
  nameVi: 'Thiết Vệ (Vanguard)',
  roleVi: 'Tank · Bảo Hộ Tuyến Đầu',
  worldWidth: 34,
  worldHeight: 42,
  shadowRx: 14,
  shadowRy: 6.5,
  parts: [
    {
      id: 'backAccessory',
      width: 34,
      height: 30,
      offsetX: -2,
      offsetY: -13,
      originX: 0.5,
      originY: 0.2,
      zIndex: 10,
      shapes: [
        // Flowing Ruby Cape behind armor
        {
          kind: 'polygon',
          points: [
            { x: -9, y: -10 },
            { x: 9, y: -10 },
            { x: 13, y: 11 },
            { x: 4, y: 13 },
            { x: -4, y: 11 },
            { x: -13, y: 12 },
          ],
          style: {
            fill: PALETTE.RUBY_CORE,
            shade: PALETTE.RUBY_DARK,
            highlight: PALETTE.CRIMSON_BRIGHT,
            outlineWidth: STANDARD_OUTLINE_WIDTH,
          },
        },
        // Golden trim line at bottom of cape
        {
          kind: 'detailStroke',
          points: [
            { x: -11, y: 9 },
            { x: -4, y: 8.5 },
            { x: 4, y: 10 },
            { x: 10.5, y: 8.5 },
          ],
          color: PALETTE.SOLAR_GOLD,
          width: INNER_OUTLINE_WIDTH,
        },
      ],
    },
    {
      id: 'legLeft',
      width: 16,
      height: 16,
      offsetX: -5.5,
      offsetY: -5,
      originX: 0.5,
      originY: 0.25,
      zIndex: 20,
      shapes: [
        {
          kind: 'roundedRect',
          x: -4.5,
          y: -3,
          w: 9,
          h: 10,
          r: 4,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.SLATE_DARK,
            highlight: PALETTE.STEEL_LIGHT,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 16,
      height: 16,
      offsetX: 5.5,
      offsetY: -5,
      originX: 0.5,
      originY: 0.25,
      zIndex: 21,
      shapes: [
        {
          kind: 'roundedRect',
          x: -4.5,
          y: -3,
          w: 9,
          h: 10,
          r: 4,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 30,
      height: 24,
      offsetX: 0,
      offsetY: -14,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        // Main steel breastplate
        {
          kind: 'roundedRect',
          x: -11,
          y: -9,
          w: 22,
          h: 17,
          r: 6,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
        // Left & Right shoulder pauldrons
        {
          kind: 'ellipse',
          cx: -10.5,
          cy: -5.5,
          rx: 5,
          ry: 4,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
        {
          kind: 'ellipse',
          cx: 10.5,
          cy: -5.5,
          rx: 5,
          ry: 4,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
        // Leather belt with golden buckle
        {
          kind: 'roundedRect',
          x: -10.5,
          y: 2.5,
          w: 21,
          h: 4.5,
          r: 2,
          style: {
            fill: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_MID,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'roundedRect',
          x: -3,
          y: 2,
          w: 6,
          h: 5.2,
          r: 1.5,
          style: {
            fill: PALETTE.SOLAR_GOLD,
            shade: PALETTE.BRASS_CORE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        // Ruby Core chest emblem
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -6.5 },
            { x: 4, y: -2.5 },
            { x: 0, y: 1.5 },
            { x: -4, y: -2.5 },
          ],
          style: {
            fill: PALETTE.RUBY_CORE,
            highlight: PALETTE.CRIMSON_BRIGHT,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 24,
      height: 26,
      offsetX: -12,
      offsetY: -14,
      originX: 0.5,
      originY: 0.35,
      zIndex: 35,
      shapes: [
        // Ruby Vanguard Shield mounted on left arm
        {
          kind: 'polygon',
          points: [
            { x: -7, y: -8 },
            { x: 6, y: -8 },
            { x: 7, y: 2 },
            { x: 0, y: 10 },
            { x: -7, y: 2 },
          ],
          style: {
            fill: PALETTE.RUBY_CORE,
            shade: PALETTE.RUBY_DARK,
            highlight: PALETTE.CRIMSON_BRIGHT,
          },
        },
        // Golden shield cross rim
        {
          kind: 'detailStroke',
          points: [
            { x: 0, y: -5.5 },
            { x: 0, y: 6.5 },
          ],
          color: PALETTE.SOLAR_GOLD,
          width: 2.0,
        },
        {
          kind: 'detailStroke',
          points: [
            { x: -4.5, y: -1.5 },
            { x: 4.5, y: -1.5 },
          ],
          color: PALETTE.SOLAR_GOLD,
          width: 2.0,
        },
      ],
    },
    {
      id: 'head',
      width: 34,
      height: 34,
      offsetX: 0,
      offsetY: -29,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        // Heroic Ruby Plume crest on top of helmet
        {
          kind: 'polygon',
          points: [
            { x: -3, y: -14 },
            { x: 6, y: -16 },
            { x: 10, y: -9 },
            { x: 2, y: -7 },
            { x: -6, y: -9 },
          ],
          style: {
            fill: PALETTE.RUBY_CORE,
            shade: PALETTE.RUBY_DARK,
            highlight: PALETTE.CRIMSON_BRIGHT,
          },
        },
        // Chibi Knight Helmet Dome (~40% total character height)
        {
          kind: 'roundedRect',
          x: -12,
          y: -10,
          w: 24,
          h: 19,
          r: 8.5,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
        // Dark visor slit
        {
          kind: 'roundedRect',
          x: -8.5,
          y: -3.5,
          w: 17,
          h: 6.5,
          r: 3,
          style: {
            fill: PALETTE.INK_DARK,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        // Glowing resolute cyan/white eyes inside visor
        {
          kind: 'ellipse',
          cx: -4,
          cy: -0.2,
          rx: 2.3,
          ry: 1.6,
          style: {
            fill: PALETTE.CYAN_FROST,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: 0,
          },
        },
        {
          kind: 'ellipse',
          cx: 4.5,
          cy: -0.2,
          rx: 2.3,
          ry: 1.6,
          style: {
            fill: PALETTE.CYAN_FROST,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: 0,
          },
        },
        // Golden brow crown trim
        {
          kind: 'detailStroke',
          points: [
            { x: -9, y: -5 },
            { x: 0, y: -3 },
            { x: 9, y: -5 },
          ],
          color: PALETTE.SOLAR_GOLD,
          width: 2.0,
        },
      ],
    },
    {
      id: 'weapon',
      width: 44,
      height: 20,
      offsetX: 11,
      offsetY: -14,
      originX: 0.22,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        // Knight Broadsword blade pointing right (+X)
        {
          kind: 'polygon',
          points: [
            { x: -2, y: -4.2 },
            { x: 22, y: -4.2 },
            { x: 29, y: 0 },
            { x: 22, y: 4.2 },
            { x: -2, y: 4.2 },
          ],
          style: {
            fill: PALETTE.SILVER_BRIGHT,
            shade: PALETTE.STEEL_LIGHT,
            highlight: PALETTE.BONE_WHITE,
          },
        },
        // Central fuller ridge
        {
          kind: 'detailStroke',
          points: [
            { x: 1, y: 0 },
            { x: 21, y: 0 },
          ],
          color: PALETTE.STEEL_DARK,
          width: INNER_OUTLINE_WIDTH,
        },
        // Golden crossguard
        {
          kind: 'roundedRect',
          x: -5,
          y: -7,
          w: 4.5,
          h: 14,
          r: 2,
          style: {
            fill: PALETTE.SOLAR_GOLD,
            shade: PALETTE.BRASS_CORE,
            highlight: PALETTE.VOLT_YELLOW,
          },
        },
        // Ruby pommel & grip
        {
          kind: 'roundedRect',
          x: -11,
          y: -2.5,
          w: 6.5,
          h: 5,
          r: 2,
          style: {
            fill: PALETTE.RUBY_CORE,
            shade: PALETTE.RUBY_DARK,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 16,
      height: 16,
      offsetX: 10.5,
      offsetY: -13,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4.8,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
      ],
    },
  ],
};

/**
 * Playable Character #2: Thợ Săn (Ranger)
 * Forest hood & cloak, feather quiver on back, agile leather armor, hunter crossbow.
 */
export const RANGER_RIG_DEF: EntityRigDef = {
  id: 'ranger',
  nameVi: 'Thợ Săn (Ranger)',
  roleVi: 'Bắn Xa · Chí Mạng & Cơ Động',
  worldWidth: 34,
  worldHeight: 42,
  shadowRx: 13.5,
  shadowRy: 6,
  parts: [
    {
      id: 'backAccessory',
      width: 32,
      height: 30,
      offsetX: -3,
      offsetY: -14,
      originX: 0.5,
      originY: 0.25,
      zIndex: 10,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -8, y: -10 },
            { x: 8, y: -10 },
            { x: 12, y: 11 },
            { x: 0, y: 13 },
            { x: -12, y: 11 },
          ],
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.GOBLIN_GREEN,
            outlineWidth: STANDARD_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'roundedRect',
          x: 4,
          y: -12,
          w: 6,
          h: 14,
          r: 2,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 14,
      height: 16,
      offsetX: -5,
      offsetY: -5,
      originX: 0.5,
      originY: 0.25,
      zIndex: 20,
      shapes: [
        {
          kind: 'roundedRect',
          x: -4,
          y: -3,
          w: 8,
          h: 10,
          r: 3.5,
          style: {
            fill: PALETTE.LEATHER_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.LEATHER_MID,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 14,
      height: 16,
      offsetX: 5,
      offsetY: -5,
      originX: 0.5,
      originY: 0.25,
      zIndex: 21,
      shapes: [
        {
          kind: 'roundedRect',
          x: -4,
          y: -3,
          w: 8,
          h: 10,
          r: 3.5,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_LIGHT,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 28,
      height: 24,
      offsetX: 0,
      offsetY: -14,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        {
          kind: 'roundedRect',
          x: -10,
          y: -9,
          w: 20,
          h: 17,
          r: 5.5,
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.LIME_GLOW,
          },
        },
        {
          kind: 'roundedRect',
          x: -10,
          y: 2,
          w: 20,
          h: 4.5,
          r: 2,
          style: {
            fill: PALETTE.LEATHER_DARK,
            highlight: PALETTE.SOLAR_GOLD,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 16,
      height: 16,
      offsetX: -10.5,
      offsetY: -13,
      originX: 0.5,
      originY: 0.4,
      zIndex: 35,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4.8,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LIME_GLOW,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 34,
      height: 34,
      offsetX: 0,
      offsetY: -29,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -13, y: 6 },
            { x: -11, y: -9 },
            { x: 0, y: -15 },
            { x: 11, y: -9 },
            { x: 13, y: 6 },
          ],
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.LIME_GLOW,
          },
        },
        {
          kind: 'roundedRect',
          x: -8,
          y: -4,
          w: 16,
          h: 9,
          r: 4,
          style: {
            fill: PALETTE.SKIN_WARM,
            shade: PALETTE.SKIN_SHADE,
          },
        },
        {
          kind: 'circle',
          cx: -3.8,
          cy: 0,
          r: 2,
          style: {
            fill: PALETTE.LIME_GLOW,
            highlight: PALETTE.BONE_WHITE,
          },
        },
        {
          kind: 'circle',
          cx: 3.8,
          cy: 0,
          r: 2,
          style: {
            fill: PALETTE.LIME_GLOW,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 38,
      height: 24,
      offsetX: 11,
      offsetY: -14,
      originX: 0.25,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'roundedRect',
          x: -6,
          y: -2.5,
          w: 22,
          h: 5,
          r: 2,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 16,
      height: 16,
      offsetX: 10.5,
      offsetY: -13,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4.8,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_LIGHT,
          },
        },
      ],
    },
  ],
};
