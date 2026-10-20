import { PALETTE } from './palette.js';
import { INNER_OUTLINE_WIDTH } from './primitives.js';
import type { EntityRigDef } from './rig-types.js';

/**
 * Sample Biome 1 Enemy: Goblin Xạ Thủ (Goblin Shooter)
 * Chibi proportions (~30x38 world units), long pointed ears, red bandana, quiver of bolts,
 * forest leather vest, and wooden tri-shot crossbow.
 */
export const GOBLIN_SHOOTER_RIG_DEF: EntityRigDef = {
  id: 'goblin_shooter',
  nameVi: 'Goblin Xạ Thủ (Goblin Shooter)',
  roleVi: 'Quái Bắn Xa · Biome 1',
  worldWidth: 32,
  worldHeight: 38,
  shadowRx: 12.5,
  shadowRy: 5.5,
  parts: [
    {
      id: 'backAccessory',
      width: 24,
      height: 26,
      offsetX: -6,
      offsetY: -16,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Wooden arrow quiver tilted on back
        {
          kind: 'polygon',
          points: [
            { x: -6, y: -9 },
            { x: 3, y: -11 },
            { x: 6, y: 7 },
            { x: -3, y: 9 },
          ],
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_LIGHT,
          },
        },
        // Red feathered bolt tips sticking out
        {
          kind: 'circle',
          cx: -3,
          cy: -10.5,
          r: 2.8,
          style: {
            fill: PALETTE.CRIMSON_BRIGHT,
            shade: PALETTE.RUBY_CORE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: 2,
          cy: -11.5,
          r: 2.8,
          style: {
            fill: PALETTE.FLAME_ORANGE,
            shade: PALETTE.RUBY_CORE,
            outlineWidth: INNER_OUTLINE_WIDTH,
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
            fill: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_MID,
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
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_LIGHT,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 26,
      height: 22,
      offsetX: 0,
      offsetY: -13,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        // Forest leather tunic
        {
          kind: 'roundedRect',
          x: -9.5,
          y: -8,
          w: 19,
          h: 15,
          r: 5.5,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_LIGHT,
          },
        },
        // Moss green shoulder scarf
        {
          kind: 'polygon',
          points: [
            { x: -10, y: -8 },
            { x: 10, y: -8 },
            { x: 8, y: -2 },
            { x: 0, y: 0 },
            { x: -8, y: -2 },
          ],
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.GOBLIN_GREEN,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        // Cross-chest strap with skull/bone clasp
        {
          kind: 'detailStroke',
          points: [
            { x: -7, y: -6 },
            { x: 7, y: 5 },
          ],
          color: PALETTE.BONE_WHITE,
          width: 2.0,
        },
      ],
    },
    {
      id: 'armLeft',
      width: 14,
      height: 14,
      offsetX: -9.5,
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
      width: 44,
      height: 30,
      offsetX: 0,
      offsetY: -26.5,
      originX: 0.5,
      originY: 0.6,
      zIndex: 40,
      shapes: [
        // Left pointed Goblin ear
        {
          kind: 'polygon',
          points: [
            { x: -9, y: -3 },
            { x: -20, y: -7 },
            { x: -16, y: 2 },
            { x: -9, y: 3 },
          ],
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.LIME_GLOW,
          },
        },
        // Right pointed Goblin ear
        {
          kind: 'polygon',
          points: [
            { x: 9, y: -3 },
            { x: 20, y: -7 },
            { x: 16, y: 2 },
            { x: 9, y: 3 },
          ],
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.LIME_GLOW,
          },
        },
        // Golden hoop earring on left ear
        {
          kind: 'circle',
          cx: -15,
          cy: 2.5,
          r: 2.4,
          style: {
            fill: PALETTE.SOLAR_GOLD,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        // Main Chibi Goblin Head
        {
          kind: 'roundedRect',
          x: -11,
          y: -9.5,
          w: 22,
          h: 17.5,
          r: 8,
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.LIME_GLOW,
          },
        },
        // Crimson Scout Bandana
        {
          kind: 'roundedRect',
          x: -11.2,
          y: -9.5,
          w: 22.4,
          h: 6,
          r: 3,
          style: {
            fill: PALETTE.RUBY_CORE,
            shade: PALETTE.RUBY_DARK,
            highlight: PALETTE.CRIMSON_BRIGHT,
          },
        },
        // Fierce glowing amber/yellow eyes
        {
          kind: 'polygon',
          points: [
            { x: -7, y: -1.5 },
            { x: -1.5, y: -0.2 },
            { x: -6, y: 2.2 },
          ],
          style: {
            fill: PALETTE.SOLAR_GOLD,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 7, y: -1.5 },
            { x: 1.5, y: -0.2 },
            { x: 6, y: 2.2 },
          ],
          style: {
            fill: PALETTE.SOLAR_GOLD,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        // Little bone-white bottom fangs
        {
          kind: 'polygon',
          points: [
            { x: -4.5, y: 5.5 },
            { x: -3, y: 2.8 },
            { x: -1.5, y: 5.5 },
          ],
          style: {
            fill: PALETTE.BONE_WHITE,
            outlineWidth: 1.2,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 1.5, y: 5.5 },
            { x: 3, y: 2.8 },
            { x: 4.5, y: 5.5 },
          ],
          style: {
            fill: PALETTE.BONE_WHITE,
            outlineWidth: 1.2,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 34,
      height: 26,
      offsetX: 9,
      offsetY: -12,
      originX: 0.3,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        // Bowstring
        {
          kind: 'detailStroke',
          points: [
            { x: 9, y: -9 },
            { x: -2, y: 0 },
            { x: 9, y: 9 },
          ],
          color: PALETTE.BONE_WHITE,
          width: 1.5,
        },
        // Crossbow wooden stock
        {
          kind: 'roundedRect',
          x: -6,
          y: -2.8,
          w: 18,
          h: 5.6,
          r: 2,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_LIGHT,
          },
        },
        // Curved steel bow prod
        {
          kind: 'polygon',
          points: [
            { x: 7, y: -10 },
            { x: 12, y: -7 },
            { x: 10, y: 0 },
            { x: 12, y: 7 },
            { x: 7, y: 10 },
            { x: 8, y: 0 },
          ],
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
        // Loaded high-contrast crimson enemy bolt
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -1.8 },
            { x: 13, y: -1.8 },
            { x: 18, y: 0 },
            { x: 13, y: 1.8 },
            { x: 0, y: 1.8 },
          ],
          style: {
            fill: PALETTE.CRIMSON_BRIGHT,
            highlight: PALETTE.FLAME_ORANGE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 14,
      height: 14,
      offsetX: 8.5,
      offsetY: -11.5,
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
            highlight: PALETTE.LIME_GLOW,
          },
        },
      ],
    },
  ],
};

export const WILD_BOAR_RIG_DEF: EntityRigDef = {
  id: 'wild_boar',
  nameVi: 'Lợn Rừng Nanh Đá (Wild Boar)',
  roleVi: 'Quái Lao Húc · Biome 1',
  worldWidth: 36,
  worldHeight: 36,
  shadowRx: 15,
  shadowRy: 6.5,
  parts: [
    {
      id: 'backAccessory',
      width: 28,
      height: 22,
      offsetX: -6,
      offsetY: -16,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Jagged stone dorsal ridge spikes
        {
          kind: 'polygon',
          points: [
            { x: -10, y: 2 },
            { x: -7, y: -8 },
            { x: -2, y: -3 },
            { x: 2, y: -9 },
            { x: 6, y: -2 },
            { x: 10, y: 2 },
          ],
          style: {
            fill: PALETTE.WARM_STONE,
            shade: PALETTE.ASH_GRAY,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 14,
      height: 14,
      offsetX: -6.5,
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
          r: 3,
          style: {
            fill: PALETTE.LEATHER_DARK,
            shade: PALETTE.SLATE_DARK,
            highlight: PALETTE.LEATHER_MID,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 14,
      height: 14,
      offsetX: 6.5,
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
          r: 3,
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
      width: 34,
      height: 24,
      offsetX: -1,
      offsetY: -12.5,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        // Heavy muscular boar body
        {
          kind: 'roundedRect',
          x: -13,
          y: -9.5,
          w: 26,
          h: 18,
          r: 8,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_LIGHT,
          },
        },
        // Mossy stone armor plate on shoulder
        {
          kind: 'polygon',
          points: [
            { x: -8, y: -9 },
            { x: 9, y: -9 },
            { x: 11, y: -1 },
            { x: 0, y: 3 },
            { x: -10, y: -1 },
          ],
          style: {
            fill: PALETTE.ASH_GRAY,
            shade: PALETTE.SLATE_MID,
            highlight: PALETTE.WARM_STONE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 14,
      height: 14,
      offsetX: -11,
      offsetY: -10,
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
            fill: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_MID,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 36,
      height: 30,
      offsetX: 3,
      offsetY: -22,
      originX: 0.5,
      originY: 0.6,
      zIndex: 40,
      shapes: [
        // Boar ears
        {
          kind: 'polygon',
          points: [
            { x: -8, y: -6 },
            { x: -15, y: -12 },
            { x: -12, y: -2 },
          ],
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 8, y: -6 },
            { x: 15, y: -12 },
            { x: 12, y: -2 },
          ],
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
          },
        },
        // Armored skull & snout
        {
          kind: 'roundedRect',
          x: -11.5,
          y: -9,
          w: 23,
          h: 17,
          r: 7.5,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_LIGHT,
          },
        },
        // Broad snout disc
        {
          kind: 'ellipse',
          cx: 2,
          cy: 2.5,
          rx: 6.5,
          ry: 4.2,
          style: {
            fill: PALETTE.SKIN_SHADE,
            shade: PALETTE.LEATHER_MID,
            highlight: PALETTE.SKIN_WARM,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        // Glowing furious flame-orange eyes
        {
          kind: 'polygon',
          points: [
            { x: -6.5, y: -3.5 },
            { x: -1.5, y: -1.5 },
            { x: -5.5, y: 0.5 },
          ],
          style: {
            fill: PALETTE.FLAME_ORANGE,
            highlight: PALETTE.SOLAR_GOLD,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 7.5, y: -3.5 },
            { x: 2.5, y: -1.5 },
            { x: 6.5, y: 0.5 },
          ],
          style: {
            fill: PALETTE.FLAME_ORANGE,
            highlight: PALETTE.SOLAR_GOLD,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 34,
      height: 24,
      offsetX: 9,
      offsetY: -16,
      originX: 0.3,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        // Upper curved stone tusk
        {
          kind: 'polygon',
          points: [
            { x: -2, y: -3 },
            { x: 11, y: -9 },
            { x: 15, y: -3 },
            { x: 3, y: 0 },
          ],
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.WARM_STONE,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
        // Lower curved stone tusk
        {
          kind: 'polygon',
          points: [
            { x: -2, y: 3 },
            { x: 11, y: 9 },
            { x: 15, y: 3 },
            { x: 3, y: 0 },
          ],
          style: {
            fill: PALETTE.BONE_WHITE,
            shade: PALETTE.WARM_STONE,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 14,
      height: 14,
      offsetX: 9.5,
      offsetY: -10,
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
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_LIGHT,
          },
        },
      ],
    },
  ],
};
