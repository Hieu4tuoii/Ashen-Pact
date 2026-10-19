import { PALETTE } from './palette.js';
import {
  INNER_OUTLINE_WIDTH,
  STANDARD_OUTLINE_WIDTH,
  type VectorShapeCommand,
} from './primitives.js';

export type RigPartId =
  'backAccessory' | 'legLeft' | 'legRight' | 'armLeft' | 'torso' | 'head' | 'weapon' | 'armRight';

export interface RigPartDef {
  id: RigPartId;
  /** World-space width of this baked part canvas (centered at 0,0) */
  width: number;
  /** World-space height of this baked part canvas (centered at 0,0) */
  height: number;
  /** Rest position offset relative to entity root (feet/hip center) */
  offsetX: number;
  offsetY: number;
  /** Normalized origin [0..1] for Phaser Sprite rotation pivot */
  originX: number;
  originY: number;
  zIndex: number;
  shapes: readonly VectorShapeCommand[];
}

export interface EntityRigDef {
  id: string;
  nameVi: string;
  roleVi: string;
  worldWidth: number;
  worldHeight: number;
  shadowRx: number;
  shadowRy: number;
  parts: readonly RigPartDef[];
}

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

export const TRAINING_DUMMY_RIG_DEF: EntityRigDef = {
  id: 'training_dummy',
  nameVi: 'Hình Nộm Tập Bắn (Training Dummy)',
  roleVi: 'Mục Tiêu Đo DPS · Phòng Thử Nghiệm',
  worldWidth: 32,
  worldHeight: 42,
  shadowRx: 13,
  shadowRy: 6,
  parts: [
    {
      id: 'backAccessory',
      width: 28,
      height: 16,
      offsetX: 0,
      offsetY: -16,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        {
          kind: 'roundedRect',
          x: -12,
          y: -3,
          w: 24,
          h: 6,
          r: 2,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_LIGHT,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 12,
      height: 14,
      offsetX: -2,
      offsetY: -5,
      originX: 0.5,
      originY: 0.25,
      zIndex: 20,
      shapes: [
        {
          kind: 'roundedRect',
          x: -3,
          y: -3,
          w: 6,
          h: 10,
          r: 2,
          style: {
            fill: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LEATHER_MID,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 12,
      height: 14,
      offsetX: 2,
      offsetY: -5,
      originX: 0.5,
      originY: 0.25,
      zIndex: 21,
      shapes: [
        {
          kind: 'roundedRect',
          x: -3,
          y: -3,
          w: 6,
          h: 10,
          r: 2,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 28,
      height: 24,
      offsetX: 0,
      offsetY: -15,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        {
          kind: 'roundedRect',
          x: -10,
          y: -9,
          w: 20,
          h: 18,
          r: 5,
          style: {
            fill: PALETTE.COPPER_LIGHT,
            shade: PALETTE.LEATHER_LIGHT,
            highlight: PALETTE.BONE_WHITE,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 6,
          style: {
            fill: PALETTE.CRIMSON_BRIGHT,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 2.8,
          style: {
            fill: PALETTE.BONE_WHITE,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 12,
      height: 12,
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
          r: 3.8,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 28,
      height: 28,
      offsetX: 0,
      offsetY: -29,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: -1,
          r: 9.5,
          style: {
            fill: PALETTE.COPPER_LIGHT,
            shade: PALETTE.LEATHER_LIGHT,
            highlight: PALETTE.BONE_WHITE,
          },
        },
        {
          kind: 'detailStroke',
          points: [
            { x: -5, y: -3 },
            { x: -2, y: 0 },
          ],
          color: PALETTE.INK_DARK,
          width: 1.8,
        },
        {
          kind: 'detailStroke',
          points: [
            { x: 2, y: -3 },
            { x: 5, y: 0 },
          ],
          color: PALETTE.INK_DARK,
          width: 1.8,
        },
      ],
    },
    {
      id: 'weapon',
      width: 16,
      height: 16,
      offsetX: 10,
      offsetY: -15,
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
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 12,
      height: 12,
      offsetX: 11,
      offsetY: -15,
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
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
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
 * Biome 1 Boss: Mục Vương Nấm Độc (Spore King)
 * Massive 64x68 Boss rig with 3.5u #0B090E (PALETTE.INK_DEEP) outer outline per ART_GUIDE.md,
 * bioluminescent toxic-purple & crimson mushroom crown, root mantle, and Spore Scepter.
 */
const BOSS_OUTLINE_WIDTH = 3.5;

export const SPORE_KING_RIG_DEF: EntityRigDef = {
  id: 'spore_king',
  nameVi: 'Mục Vương Nấm Độc (Spore King)',
  roleVi: 'Trùm Cuối Biome 1 · Rừng Cổ Mục Nát',
  worldWidth: 64,
  worldHeight: 68,
  shadowRx: 26,
  shadowRy: 11,
  parts: [
    {
      id: 'backAccessory',
      width: 56,
      height: 44,
      offsetX: 0,
      offsetY: -22,
      originX: 0.5,
      originY: 0.4,
      zIndex: 10,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -20, y: -14 },
            { x: 20, y: -14 },
            { x: 25, y: 16 },
            { x: 0, y: 20 },
            { x: -25, y: 16 },
          ],
          style: {
            fill: PALETTE.MOSS_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.FOREST_SHADE,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: BOSS_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 22,
      height: 20,
      offsetX: -10,
      offsetY: -6,
      originX: 0.5,
      originY: 0.3,
      zIndex: 20,
      shapes: [
        {
          kind: 'roundedRect',
          x: -7,
          y: -5,
          w: 14,
          h: 13,
          r: 5,
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.GOBLIN_GREEN,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: BOSS_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 22,
      height: 20,
      offsetX: 10,
      offsetY: -6,
      originX: 0.5,
      originY: 0.3,
      zIndex: 21,
      shapes: [
        {
          kind: 'roundedRect',
          x: -7,
          y: -5,
          w: 14,
          h: 13,
          r: 5,
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.LIME_GLOW,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: BOSS_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 52,
      height: 40,
      offsetX: 0,
      offsetY: -20,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        {
          kind: 'roundedRect',
          x: -20,
          y: -15,
          w: 40,
          h: 30,
          r: 11,
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.GOBLIN_GREEN,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: BOSS_OUTLINE_WIDTH,
          },
        },
        // Glowing toxic heart core on chest
        {
          kind: 'polygon',
          points: [
            { x: 0, y: -9 },
            { x: 8, y: 0 },
            { x: 0, y: 9 },
            { x: -8, y: 0 },
          ],
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.GOBLIN_GREEN,
            highlight: PALETTE.MINT_LIGHT,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 24,
      height: 24,
      offsetX: -21,
      offsetY: -20,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 8,
          style: {
            fill: PALETTE.TOXIC_PURPLE,
            shade: PALETTE.SLATE_DARK,
            highlight: PALETTE.ELECTRIC_VIOLET,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: BOSS_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 60,
      height: 48,
      offsetX: 0,
      offsetY: -40,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        // Royal Spore Cap Dome
        {
          kind: 'polygon',
          points: [
            { x: -26, y: 4 },
            { x: -20, y: -12 },
            { x: 0, y: -19 },
            { x: 20, y: -12 },
            { x: 26, y: 4 },
            { x: 14, y: 9 },
            { x: -14, y: 9 },
          ],
          style: {
            fill: PALETTE.TOXIC_PURPLE,
            shade: PALETTE.RUBY_DARK,
            highlight: PALETTE.ELECTRIC_VIOLET,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: BOSS_OUTLINE_WIDTH,
          },
        },
        // Golden King Crown atop the Mushroom Cap
        {
          kind: 'polygon',
          points: [
            { x: -11, y: -14 },
            { x: -8, y: -22 },
            { x: -3, y: -17 },
            { x: 0, y: -24 },
            { x: 3, y: -17 },
            { x: 8, y: -22 },
            { x: 11, y: -14 },
          ],
          style: {
            fill: PALETTE.SOLAR_GOLD,
            shade: PALETTE.BRASS_CORE,
            highlight: PALETTE.VOLT_YELLOW,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: 2.5,
          },
        },
        // Glowing Spore pustules on cap
        {
          kind: 'circle',
          cx: -13,
          cy: -4,
          r: 3.8,
          style: {
            fill: PALETTE.LIME_GLOW,
            highlight: PALETTE.MINT_LIGHT,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: 13,
          cy: -4,
          r: 3.8,
          style: {
            fill: PALETTE.LIME_GLOW,
            highlight: PALETTE.MINT_LIGHT,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        // Fierce glowing eyes beneath cap shadow
        {
          kind: 'circle',
          cx: -6.5,
          cy: 5,
          r: 3.0,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            highlight: PALETTE.BONE_WHITE,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
        {
          kind: 'circle',
          cx: 6.5,
          cy: 5,
          r: 3.0,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            highlight: PALETTE.BONE_WHITE,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: INNER_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 48,
      height: 28,
      offsetX: 18,
      offsetY: -20,
      originX: 0.25,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'roundedRect',
          x: -10,
          y: -3,
          w: 28,
          h: 6,
          r: 2.5,
          style: {
            fill: PALETTE.LEATHER_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.LEATHER_MID,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: 2.5,
          },
        },
        {
          kind: 'circle',
          cx: 21,
          cy: 0,
          r: 7.5,
          style: {
            fill: PALETTE.LIME_GLOW,
            shade: PALETTE.TOXIC_PURPLE,
            highlight: PALETTE.MINT_LIGHT,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: 2.5,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 24,
      height: 24,
      offsetX: 21,
      offsetY: -20,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 8,
          style: {
            fill: PALETTE.TOXIC_PURPLE,
            shade: PALETTE.SLATE_DARK,
            highlight: PALETTE.ELECTRIC_VIOLET,
            outlineColor: PALETTE.INK_DEEP,
            outlineWidth: BOSS_OUTLINE_WIDTH,
          },
        },
      ],
    },
  ],
};

/**
 * Sanctuary NPC: Thương Nhân Hắc Ám (Merchant)
 */
export const MERCHANT_RIG_DEF: EntityRigDef = {
  id: 'merchant',
  nameVi: 'Thương Nhân Hắc Ám (Merchant)',
  roleVi: 'Thương Nhân Cổ Ngữ · Khu Nghỉ Ngơi',
  worldWidth: 36,
  worldHeight: 42,
  shadowRx: 15,
  shadowRy: 6.5,
  parts: [
    {
      id: 'backAccessory',
      width: 32,
      height: 28,
      offsetX: -4,
      offsetY: -18,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Giant treasure pack on back
        {
          kind: 'roundedRect',
          x: -12,
          y: -11,
          w: 24,
          h: 22,
          r: 6,
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
      height: 14,
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
          h: 9,
          r: 3,
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
          h: 9,
          r: 3,
          style: {
            fill: PALETTE.SLATE_DARK,
            highlight: PALETTE.SLATE_MID,
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
        {
          kind: 'roundedRect',
          x: -11,
          y: -9,
          w: 22,
          h: 18,
          r: 6,
          style: {
            fill: PALETTE.SLATE_MID,
            shade: PALETTE.SLATE_DARK,
            highlight: PALETTE.ELECTRIC_VIOLET,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 3.5,
          style: {
            fill: PALETTE.SOLAR_GOLD,
            shade: PALETTE.BRASS_CORE,
            highlight: PALETTE.VOLT_YELLOW,
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
      offsetY: -14,
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
            fill: PALETTE.SLATE_MID,
            shade: PALETTE.SLATE_DARK,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 32,
      height: 32,
      offsetX: 0,
      offsetY: -28,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -12, y: 7 },
            { x: -10, y: -9 },
            { x: 0, y: -14 },
            { x: 10, y: -9 },
            { x: 12, y: 7 },
          ],
          style: {
            fill: PALETTE.SLATE_MID,
            shade: PALETTE.SLATE_DARK,
            highlight: PALETTE.ELECTRIC_VIOLET,
          },
        },
        {
          kind: 'circle',
          cx: -3.5,
          cy: 0,
          r: 2.2,
          style: {
            fill: PALETTE.SOLAR_GOLD,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: 0,
          },
        },
        {
          kind: 'circle',
          cx: 3.5,
          cy: 0,
          r: 2.2,
          style: {
            fill: PALETTE.SOLAR_GOLD,
            highlight: PALETTE.BONE_WHITE,
            outlineWidth: 0,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 20,
      height: 22,
      offsetX: 11,
      offsetY: -13,
      originX: 0.5,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        // Golden merchant lantern
        {
          kind: 'roundedRect',
          x: -4.5,
          y: -5,
          w: 9,
          h: 11,
          r: 2.5,
          style: {
            fill: PALETTE.SOLAR_GOLD,
            shade: PALETTE.BRASS_CORE,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armRight',
      width: 14,
      height: 14,
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
          r: 4.2,
          style: {
            fill: PALETTE.SLATE_MID,
            shade: PALETTE.SLATE_DARK,
          },
        },
      ],
    },
  ],
};

export interface WeaponVectorDef {
  id: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  shapes: readonly VectorShapeCommand[];
}

export const WEAPON_VECTOR_DEFS: Record<string, WeaponVectorDef> = {
  knight_sword: {
    id: 'knight_sword',
    width: 44,
    height: 20,
    originX: 0.22,
    originY: 0.5,
    shapes: VANGUARD_RIG_DEF.parts.find((p) => p.id === 'weapon')!.shapes,
  },
  rusty_pistol: {
    id: 'rusty_pistol',
    width: 34,
    height: 20,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -6,
        y: 0,
        w: 7,
        h: 8,
        r: 2,
        style: {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: PALETTE.LEATHER_LIGHT,
        },
      },
      {
        kind: 'roundedRect',
        x: -5,
        y: -5,
        w: 20,
        h: 7.5,
        r: 2.5,
        style: {
          fill: PALETTE.STEEL_LIGHT,
          shade: PALETTE.STEEL_DARK,
          highlight: PALETTE.SILVER_BRIGHT,
        },
      },
      {
        kind: 'roundedRect',
        x: 12,
        y: -5.2,
        w: 4.5,
        h: 8,
        r: 1.5,
        style: {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.BRASS_CORE,
        },
      },
    ],
  },
  hunter_crossbow: {
    id: 'hunter_crossbow',
    width: 40,
    height: 26,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -8,
        y: -3,
        w: 22,
        h: 6,
        r: 2,
        style: {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: PALETTE.LEATHER_LIGHT,
        },
      },
      {
        kind: 'polygon',
        points: [
          { x: 8, y: -11 },
          { x: 16, y: 0 },
          { x: 8, y: 11 },
          { x: 12, y: 0 },
        ],
        style: {
          fill: PALETTE.STEEL_LIGHT,
          shade: PALETTE.STEEL_DARK,
          highlight: PALETTE.SILVER_BRIGHT,
        },
      },
    ],
  },
  scrap_shotgun: {
    id: 'scrap_shotgun',
    width: 42,
    height: 22,
    originX: 0.26,
    originY: 0.5,
    shapes: [
      {
        kind: 'polygon',
        points: [
          { x: -10, y: -2 },
          { x: -1, y: -3 },
          { x: -1, y: 4 },
          { x: -10, y: 6 },
        ],
        style: {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: PALETTE.LEATHER_LIGHT,
        },
      },
      {
        kind: 'roundedRect',
        x: -2,
        y: -5.5,
        w: 24,
        h: 9.5,
        r: 2.5,
        style: {
          fill: PALETTE.STEEL_DARK,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.STEEL_LIGHT,
        },
      },
      {
        kind: 'polygon',
        points: [
          { x: 18, y: -6 },
          { x: 25, y: -8 },
          { x: 25, y: 6 },
          { x: 18, y: 4 },
        ],
        style: {
          fill: PALETTE.BRASS_CORE,
          shade: PALETTE.BRONZE_SHADE,
          highlight: PALETTE.SOLAR_GOLD,
        },
      },
    ],
  },
  gale_smg: {
    id: 'gale_smg',
    width: 38,
    height: 22,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: 4,
        y: 1,
        w: 5.5,
        h: 8.5,
        r: 1.5,
        style: {
          fill: PALETTE.SLATE_MID,
          shade: PALETTE.SLATE_DARK,
        },
      },
      {
        kind: 'roundedRect',
        x: -6,
        y: -5,
        w: 23,
        h: 8,
        r: 3,
        style: {
          fill: PALETTE.GOBLIN_GREEN,
          shade: PALETTE.FOREST_SHADE,
          highlight: PALETTE.LIME_GLOW,
        },
      },
      {
        kind: 'roundedRect',
        x: 15,
        y: -3.2,
        w: 7,
        h: 4.5,
        r: 1.5,
        style: {
          fill: PALETTE.SILVER_BRIGHT,
          shade: PALETTE.STEEL_LIGHT,
        },
      },
    ],
  },
  rivet_gun: {
    id: 'rivet_gun',
    width: 38,
    height: 22,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -7,
        y: -5.5,
        w: 22,
        h: 10,
        r: 3,
        style: {
          fill: PALETTE.BRASS_CORE,
          shade: PALETTE.BRONZE_SHADE,
          highlight: PALETTE.SOLAR_GOLD,
        },
      },
      {
        kind: 'roundedRect',
        x: 13,
        y: -3.5,
        w: 8,
        h: 6,
        r: 2,
        style: {
          fill: PALETTE.STEEL_LIGHT,
          shade: PALETTE.STEEL_DARK,
          highlight: PALETTE.SILVER_BRIGHT,
        },
      },
    ],
  },
  frost_scepter: {
    id: 'frost_scepter',
    width: 42,
    height: 22,
    originX: 0.24,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -10,
        y: -2.2,
        w: 24,
        h: 4.4,
        r: 2,
        style: {
          fill: PALETTE.COBALT_SHADE,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.AZURE_CORE,
        },
      },
      {
        kind: 'polygon',
        points: [
          { x: 11, y: -7 },
          { x: 24, y: 0 },
          { x: 11, y: 7 },
          { x: 14, y: 0 },
        ],
        style: {
          fill: PALETTE.CYAN_FROST,
          shade: PALETTE.AZURE_CORE,
          highlight: PALETTE.BONE_WHITE,
        },
      },
    ],
  },
  tesla_carbine: {
    id: 'tesla_carbine',
    width: 40,
    height: 22,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -7,
        y: -5,
        w: 22,
        h: 8,
        r: 2.5,
        style: {
          fill: PALETTE.STEEL_DARK,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.STEEL_LIGHT,
        },
      },
      {
        kind: 'roundedRect',
        x: 13,
        y: -4,
        w: 9,
        h: 6,
        r: 2,
        style: {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.BRASS_CORE,
          highlight: PALETTE.VOLT_YELLOW,
        },
      },
    ],
  },
  apprentice_staff: {
    id: 'apprentice_staff',
    width: 42,
    height: 22,
    originX: 0.24,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -10,
        y: -2.2,
        w: 25,
        h: 4.4,
        r: 2,
        style: {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: PALETTE.LEATHER_LIGHT,
        },
      },
      {
        kind: 'circle',
        cx: 17,
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
  thorn_staff: {
    id: 'thorn_staff',
    width: 42,
    height: 22,
    originX: 0.24,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -10,
        y: -2.2,
        w: 25,
        h: 4.4,
        r: 2,
        style: {
          fill: PALETTE.FOREST_SHADE,
          shade: PALETTE.MOSS_DARK,
          highlight: PALETTE.GOBLIN_GREEN,
        },
      },
      {
        kind: 'circle',
        cx: 17,
        cy: 0,
        r: 5.5,
        style: {
          fill: PALETTE.TOXIC_PURPLE,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.LIME_GLOW,
        },
      },
    ],
  },
  venom_smg: {
    id: 'venom_smg',
    width: 40,
    height: 22,
    originX: 0.28,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -7,
        y: -5,
        w: 23,
        h: 8.5,
        r: 3,
        style: {
          fill: PALETTE.TOXIC_PURPLE,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.ELECTRIC_VIOLET,
        },
      },
      {
        kind: 'roundedRect',
        x: 14,
        y: -3.5,
        w: 8,
        h: 5.5,
        r: 2,
        style: {
          fill: PALETTE.LIME_GLOW,
          shade: PALETTE.GOBLIN_GREEN,
          highlight: PALETTE.MINT_LIGHT,
        },
      },
    ],
  },
  dragon_breath_shotgun: {
    id: 'dragon_breath_shotgun',
    width: 44,
    height: 24,
    originX: 0.26,
    originY: 0.5,
    shapes: [
      {
        kind: 'roundedRect',
        x: -9,
        y: -5.5,
        w: 25,
        h: 10,
        r: 3,
        style: {
          fill: PALETTE.RUBY_CORE,
          shade: PALETTE.RUBY_DARK,
          highlight: PALETTE.CRIMSON_BRIGHT,
        },
      },
      {
        kind: 'polygon',
        points: [
          { x: 15, y: -7 },
          { x: 25, y: -9 },
          { x: 25, y: 9 },
          { x: 15, y: 7 },
        ],
        style: {
          fill: PALETTE.FLAME_ORANGE,
          shade: PALETTE.MAGMA_RED,
          highlight: PALETTE.SOLAR_GOLD,
        },
      },
    ],
  },
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

/**
 * Playable Character #3: Pháp Sư Nguyên Tố (Elementalist)
 * Arcane azure-violet robe, floating elemental mantle, pointed wizard hat, frost/fire scepter.
 */
export const ELEMENTALIST_RIG_DEF: EntityRigDef = {
  id: 'elementalist',
  nameVi: 'Pháp Sư Nguyên Tố (Elementalist)',
  roleVi: 'Phép Thuật · Khống Chế Nguyên Tố',
  worldWidth: 34,
  worldHeight: 44,
  shadowRx: 13.5,
  shadowRy: 6,
  parts: [
    {
      id: 'backAccessory',
      width: 34,
      height: 30,
      offsetX: -2,
      offsetY: -14,
      originX: 0.5,
      originY: 0.25,
      zIndex: 10,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -10, y: -10 },
            { x: 10, y: -10 },
            { x: 14, y: 12 },
            { x: 0, y: 14 },
            { x: -14, y: 12 },
          ],
          style: {
            fill: PALETTE.COBALT_SHADE,
            shade: PALETTE.ABYSS_BLUE,
            highlight: PALETTE.ELECTRIC_VIOLET,
            outlineWidth: STANDARD_OUTLINE_WIDTH,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 14,
      height: 14,
      offsetX: -4.5,
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
          h: 9,
          r: 3.5,
          style: {
            fill: PALETTE.ABYSS_BLUE,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.COBALT_SHADE,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 14,
      height: 14,
      offsetX: 4.5,
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
          h: 9,
          r: 3.5,
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
      width: 30,
      height: 24,
      offsetX: 0,
      offsetY: -14,
      originX: 0.5,
      originY: 0.55,
      zIndex: 30,
      shapes: [
        {
          kind: 'roundedRect',
          x: -11,
          y: -9,
          w: 22,
          h: 18,
          r: 6,
          style: {
            fill: PALETTE.AZURE_CORE,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: -2,
          r: 4,
          style: {
            fill: PALETTE.SOLAR_GOLD,
            shade: PALETTE.FLAME_ORANGE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 16,
      height: 16,
      offsetX: -11,
      offsetY: -13,
      originX: 0.5,
      originY: 0.4,
      zIndex: 35,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 5,
          style: {
            fill: PALETTE.ELECTRIC_VIOLET,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 36,
      height: 36,
      offsetX: 0,
      offsetY: -30,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        {
          kind: 'roundedRect',
          x: -10,
          y: -6,
          w: 20,
          h: 13,
          r: 6,
          style: {
            fill: PALETTE.ABYSS_BLUE,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.COBALT_SHADE,
          },
        },
        // Wizard hat brim & cone
        {
          kind: 'polygon',
          points: [
            { x: -15, y: -4 },
            { x: 0, y: -17 },
            { x: 15, y: -4 },
          ],
          style: {
            fill: PALETTE.ELECTRIC_VIOLET,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
        {
          kind: 'circle',
          cx: -4,
          cy: 0,
          r: 2.2,
          style: {
            fill: PALETTE.CYAN_FROST,
            highlight: PALETTE.ICE_WHITE,
          },
        },
        {
          kind: 'circle',
          cx: 4,
          cy: 0,
          r: 2.2,
          style: {
            fill: PALETTE.FLAME_ORANGE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 40,
      height: 20,
      offsetX: 11,
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
            fill: PALETTE.SOLAR_GOLD,
            shade: PALETTE.BRASS_CORE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
        {
          kind: 'circle',
          cx: 16,
          cy: 0,
          r: 5,
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
            fill: PALETTE.AZURE_CORE,
            shade: PALETTE.COBALT_SHADE,
            highlight: PALETTE.CYAN_FROST,
          },
        },
      ],
    },
  ],
};

/**
 * Playable Character #4: Mộc Linh (Druid)
 * Nature spirit guardian with leaf mantle, bark armor, golden-emerald antlers, and healing staff.
 */
export const DRUID_RIG_DEF: EntityRigDef = {
  id: 'druid',
  nameVi: 'Mộc Linh (Druid)',
  roleVi: 'Hỗ Trợ · Hồi Phục & Trói Chân',
  worldWidth: 34,
  worldHeight: 44,
  shadowRx: 14,
  shadowRy: 6.5,
  parts: [
    {
      id: 'backAccessory',
      width: 34,
      height: 30,
      offsetX: -2,
      offsetY: -14,
      originX: 0.5,
      originY: 0.25,
      zIndex: 10,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -10, y: -9 },
            { x: 10, y: -9 },
            { x: 13, y: 10 },
            { x: 0, y: 14 },
            { x: -13, y: 10 },
          ],
          style: {
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.MINT_LIGHT,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 14,
      height: 14,
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
          h: 9,
          r: 3.5,
          style: {
            fill: PALETTE.LEATHER_DARK,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.LEATHER_MID,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 14,
      height: 14,
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
          h: 9,
          r: 3.5,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.GOBLIN_GREEN,
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
        {
          kind: 'roundedRect',
          x: -11,
          y: -9,
          w: 22,
          h: 17,
          r: 6,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LIME_GLOW,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: -1,
          r: 4.5,
          style: {
            fill: PALETTE.MINT_LIGHT,
            shade: PALETTE.GOBLIN_GREEN,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 16,
      height: 16,
      offsetX: -11,
      offsetY: -13,
      originX: 0.5,
      originY: 0.4,
      zIndex: 35,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 5,
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
      height: 36,
      offsetX: 0,
      offsetY: -29,
      originX: 0.5,
      originY: 0.65,
      zIndex: 40,
      shapes: [
        // Antler crown
        {
          kind: 'polygon',
          points: [
            { x: -13, y: -15 },
            { x: -6, y: -8 },
            { x: 6, y: -8 },
            { x: 13, y: -15 },
            { x: 9, y: -5 },
            { x: -9, y: -5 },
          ],
          style: {
            fill: PALETTE.SOLAR_GOLD,
            shade: PALETTE.LEATHER_LIGHT,
            highlight: PALETTE.VOLT_YELLOW,
          },
        },
        {
          kind: 'roundedRect',
          x: -11,
          y: -8,
          w: 22,
          h: 16,
          r: 7,
          style: {
            fill: PALETTE.FOREST_SHADE,
            shade: PALETTE.MOSS_DARK,
            highlight: PALETTE.LIME_GLOW,
          },
        },
        {
          kind: 'circle',
          cx: -4,
          cy: 0,
          r: 2.3,
          style: {
            fill: PALETTE.MINT_LIGHT,
            highlight: PALETTE.BONE_WHITE,
          },
        },
        {
          kind: 'circle',
          cx: 4,
          cy: 0,
          r: 2.3,
          style: {
            fill: PALETTE.MINT_LIGHT,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 40,
      height: 20,
      offsetX: 11,
      offsetY: -14,
      originX: 0.25,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'roundedRect',
          x: -8,
          y: -2.2,
          w: 22,
          h: 4.4,
          r: 2,
          style: {
            fill: PALETTE.LEATHER_MID,
            shade: PALETTE.LEATHER_DARK,
            highlight: PALETTE.LIME_GLOW,
          },
        },
        {
          kind: 'circle',
          cx: 16,
          cy: 0,
          r: 5.2,
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
            fill: PALETTE.GOBLIN_GREEN,
            shade: PALETTE.FOREST_SHADE,
            highlight: PALETTE.MINT_LIGHT,
          },
        },
      ],
    },
  ],
};

/**
 * Playable Character #5: Kỹ Sư Cơ Giới (Engineer)
 * Brass & copper forge armor, dual Tesla coil backpack, welding goggles helmet, Tesla carbine.
 */
export const ENGINEER_RIG_DEF: EntityRigDef = {
  id: 'engineer',
  nameVi: 'Kỹ Sư Cơ Giới (Engineer)',
  roleVi: 'Công Nghệ · Trụ Điện & Hồi Giáp',
  worldWidth: 36,
  worldHeight: 42,
  shadowRx: 14.5,
  shadowRy: 6.5,
  parts: [
    {
      id: 'backAccessory',
      width: 34,
      height: 30,
      offsetX: -3,
      offsetY: -15,
      originX: 0.5,
      originY: 0.3,
      zIndex: 10,
      shapes: [
        // Tesla Coil Backpack
        {
          kind: 'roundedRect',
          x: -10,
          y: -11,
          w: 20,
          h: 18,
          r: 4,
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
        {
          kind: 'circle',
          cx: -7,
          cy: -12,
          r: 3.5,
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
        {
          kind: 'circle',
          cx: 7,
          cy: -12,
          r: 3.5,
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
      width: 14,
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
          r: 3.5,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.SLATE_DARK,
            highlight: PALETTE.BRASS_CORE,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 14,
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
          r: 3.5,
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.COPPER_LIGHT,
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
        {
          kind: 'roundedRect',
          x: -11,
          y: -9,
          w: 22,
          h: 17,
          r: 5.5,
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.COPPER_LIGHT,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: -1,
          r: 4.5,
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 16,
      height: 16,
      offsetX: -11,
      offsetY: -13,
      originX: 0.5,
      originY: 0.4,
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
            highlight: PALETTE.VOLT_YELLOW,
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
          kind: 'roundedRect',
          x: -12,
          y: -10,
          w: 24,
          h: 18,
          r: 8,
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
        // Engineer Goggles
        {
          kind: 'circle',
          cx: -4.5,
          cy: -1,
          r: 4,
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
        {
          kind: 'circle',
          cx: 4.5,
          cy: -1,
          r: 4,
          style: {
            fill: PALETTE.CYAN_FROST,
            shade: PALETTE.AZURE_CORE,
            highlight: PALETTE.ICE_WHITE,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 40,
      height: 20,
      offsetX: 11,
      offsetY: -14,
      originX: 0.25,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'roundedRect',
          x: -6,
          y: -3.5,
          w: 22,
          h: 7,
          r: 2.5,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.VOLT_YELLOW,
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
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
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

export const WELDER_DRONE_RIG_DEF: EntityRigDef = {
  id: 'welder_drone',
  nameVi: 'Drone Hàn Cơ Giới (Welder Drone)',
  roleVi: 'Quái Bay Hỗ Trợ Hàn Giáp · Biome 3',
  worldWidth: 34,
  worldHeight: 34,
  shadowRx: 11,
  shadowRy: 4.5,
  parts: [
    {
      id: 'backAccessory',
      width: 36,
      height: 24,
      offsetX: 0,
      offsetY: -22,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Twin horizontal hover rotor blades / fins
        {
          kind: 'roundedRect',
          x: -17,
          y: -4,
          w: 13,
          h: 6,
          r: 2.5,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
        {
          kind: 'roundedRect',
          x: 4,
          y: -4,
          w: 13,
          h: 6,
          r: 2.5,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
      ],
    },
    {
      id: 'legLeft',
      width: 12,
      height: 12,
      offsetX: -5,
      offsetY: -7,
      originX: 0.5,
      originY: 0.2,
      zIndex: 20,
      shapes: [
        // Plasma hover thruster jet
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
            highlight: PALETTE.ICE_WHITE,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 12,
      height: 12,
      offsetX: 5,
      offsetY: -7,
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
            highlight: PALETTE.ICE_WHITE,
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
        // Spherical brass drone chassis
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 11,
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
      width: 12,
      height: 12,
      offsetX: -12,
      offsetY: -18,
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
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 24,
      height: 24,
      offsetX: 0,
      offsetY: -18,
      originX: 0.5,
      originY: 0.5,
      zIndex: 40,
      shapes: [
        // Central Cyclops Welding Lens
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 6.5,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.STEEL_LIGHT,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4,
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
      width: 26,
      height: 18,
      offsetX: 12,
      offsetY: -16,
      originX: 0.3,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        // Arc-welder plasma torch nozzle
        {
          kind: 'roundedRect',
          x: -4,
          y: -3,
          w: 14,
          h: 6,
          r: 2,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
          },
        },
        {
          kind: 'polygon',
          points: [
            { x: 9, y: -4 },
            { x: 16, y: 0 },
            { x: 9, y: 4 },
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
      width: 12,
      height: 12,
      offsetX: 11,
      offsetY: -16,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 3.5,
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
          },
        },
      ],
    },
  ],
};

export const IRON_SHIELDER_RIG_DEF: EntityRigDef = {
  id: 'iron_shielder',
  nameVi: 'Khiên Thủ Sắt (Iron Shielder)',
  roleVi: 'Khiên Chắn Mặt Trước · Tiến Chậm Bắn Trả · Biome 3',
  worldWidth: 46,
  worldHeight: 48,
  shadowRx: 18,
  shadowRy: 8,
  parts: [
    {
      id: 'backAccessory',
      width: 36,
      height: 30,
      offsetX: -2,
      offsetY: -18,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        {
          kind: 'polygon',
          points: [
            { x: -12, y: -10 },
            { x: 12, y: -10 },
            { x: 15, y: 12 },
            { x: -15, y: 12 },
          ],
          style: {
            fill: PALETTE.RUBY_DARK,
            shade: PALETTE.FORGE_DARK,
            highlight: PALETTE.RUBY_CORE,
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
          x: -5,
          y: -4,
          w: 10,
          h: 10,
          r: 3,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
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
          x: -5,
          y: -4,
          w: 10,
          h: 10,
          r: 3,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 34,
      height: 26,
      offsetX: 0,
      offsetY: -15,
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
          r: 5,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.SLATE_DARK,
            highlight: PALETTE.STEEL_LIGHT,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4.5,
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
      width: 18,
      height: 18,
      offsetX: -14,
      offsetY: -15,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'roundedRect',
          x: -6,
          y: -6,
          w: 12,
          h: 12,
          r: 3,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 32,
      height: 28,
      offsetX: 0,
      offsetY: -28,
      originX: 0.5,
      originY: 0.6,
      zIndex: 40,
      shapes: [
        // Heavy riveted bucket helm with glowing T-visor
        {
          kind: 'roundedRect',
          x: -11,
          y: -10,
          w: 22,
          h: 18,
          r: 5,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
        {
          kind: 'roundedRect',
          x: -7,
          y: -3,
          w: 14,
          h: 3.5,
          r: 1.5,
          style: {
            fill: PALETTE.FLAME_ORANGE,
            highlight: PALETTE.VOLT_YELLOW,
            outlineWidth: 1,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 34,
      height: 44,
      offsetX: 15,
      offsetY: -15,
      originX: 0.35,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        // Massive riveted Iron Bulwark Tower Shield
        {
          kind: 'roundedRect',
          x: -6,
          y: -18,
          w: 16,
          h: 36,
          r: 4,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
            highlight: PALETTE.STEEL_LIGHT,
          },
        },
        {
          kind: 'roundedRect',
          x: -2,
          y: -12,
          w: 8,
          h: 24,
          r: 2,
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
            outlineWidth: INNER_OUTLINE_WIDTH,
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

export const FORGE_ENERGY_CORE_RIG_DEF: EntityRigDef = {
  id: 'forge_energy_core',
  nameVi: 'Lõi Năng Lượng Lò Rèn (Forge Core)',
  roleVi: 'Mục Tiêu Đồng Bộ Co-op · Phá Cùng Lúc Làm Choáng Titan',
  worldWidth: 40,
  worldHeight: 46,
  shadowRx: 16,
  shadowRy: 7,
  parts: [
    {
      id: 'backAccessory',
      width: 40,
      height: 40,
      offsetX: 0,
      offsetY: -20,
      originX: 0.5,
      originY: 0.5,
      zIndex: 10,
      shapes: [
        // Brass cooling fins radiating outward
        {
          kind: 'polygon',
          points: [
            { x: -17, y: -12 },
            { x: 17, y: -12 },
            { x: 14, y: 12 },
            { x: -14, y: 12 },
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
      width: 16,
      height: 12,
      offsetX: -7,
      offsetY: -4,
      originX: 0.5,
      originY: 0.5,
      zIndex: 20,
      shapes: [
        {
          kind: 'roundedRect',
          x: -6,
          y: -4,
          w: 12,
          h: 8,
          r: 2,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
          },
        },
      ],
    },
    {
      id: 'legRight',
      width: 16,
      height: 12,
      offsetX: 7,
      offsetY: -4,
      originX: 0.5,
      originY: 0.5,
      zIndex: 21,
      shapes: [
        {
          kind: 'roundedRect',
          x: -6,
          y: -4,
          w: 12,
          h: 8,
          r: 2,
          style: {
            fill: PALETTE.STEEL_DARK,
            shade: PALETTE.INK_DARK,
          },
        },
      ],
    },
    {
      id: 'torso',
      width: 34,
      height: 36,
      offsetX: 0,
      offsetY: -20,
      originX: 0.5,
      originY: 0.5,
      zIndex: 30,
      shapes: [
        // Plasma reactor cylinder
        {
          kind: 'roundedRect',
          x: -11,
          y: -15,
          w: 22,
          h: 30,
          r: 6,
          style: {
            fill: PALETTE.FLAME_ORANGE,
            shade: PALETTE.MAGMA_RED,
            highlight: PALETTE.VOLT_YELLOW,
          },
        },
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 7,
          style: {
            fill: PALETTE.VOLT_YELLOW,
            highlight: PALETTE.BONE_WHITE,
          },
        },
      ],
    },
    {
      id: 'armLeft',
      width: 14,
      height: 18,
      offsetX: -14,
      offsetY: -20,
      originX: 0.5,
      originY: 0.5,
      zIndex: 35,
      shapes: [
        {
          kind: 'roundedRect',
          x: -4,
          y: -7,
          w: 8,
          h: 14,
          r: 2,
          style: {
            fill: PALETTE.BRASS_CORE,
            shade: PALETTE.BRONZE_SHADE,
            highlight: PALETTE.SOLAR_GOLD,
          },
        },
      ],
    },
    {
      id: 'head',
      width: 30,
      height: 20,
      offsetX: 0,
      offsetY: -36,
      originX: 0.5,
      originY: 0.5,
      zIndex: 40,
      shapes: [
        // Top Tesla coil cap
        {
          kind: 'roundedRect',
          x: -12,
          y: -5,
          w: 24,
          h: 9,
          r: 3,
          style: {
            fill: PALETTE.STEEL_LIGHT,
            shade: PALETTE.STEEL_DARK,
            highlight: PALETTE.SILVER_BRIGHT,
          },
        },
      ],
    },
    {
      id: 'weapon',
      width: 14,
      height: 14,
      offsetX: 0,
      offsetY: -44,
      originX: 0.5,
      originY: 0.5,
      zIndex: 45,
      shapes: [
        {
          kind: 'circle',
          cx: 0,
          cy: 0,
          r: 4.5,
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
      width: 14,
      height: 18,
      offsetX: 14,
      offsetY: -20,
      originX: 0.5,
      originY: 0.5,
      zIndex: 50,
      shapes: [
        {
          kind: 'roundedRect',
          x: -4,
          y: -7,
          w: 8,
          h: 14,
          r: 2,
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

export const RIG_DEFS_BY_ID: Record<string, EntityRigDef> = {
  vanguard: VANGUARD_RIG_DEF,
  ranger: RANGER_RIG_DEF,
  elementalist: ELEMENTALIST_RIG_DEF,
  druid: DRUID_RIG_DEF,
  engineer: ENGINEER_RIG_DEF,
  goblin_shooter: GOBLIN_SHOOTER_RIG_DEF,
  wild_boar: WILD_BOAR_RIG_DEF,
  spore_bomber: SPORE_BOMBER_RIG_DEF,
  green_slime: GREEN_SLIME_RIG_DEF,
  mini_slime: MINI_SLIME_RIG_DEF,
  goblin_shaman: GOBLIN_SHAMAN_RIG_DEF,
  thorn_turret: THORN_TURRET_RIG_DEF,
  spore_guardian: SPORE_GUARDIAN_RIG_DEF,
  spore_king: SPORE_KING_RIG_DEF,
  frost_bat: FROST_BAT_RIG_DEF,
  baby_yeti: BABY_YETI_RIG_DEF,
  ice_mage: ICE_MAGE_RIG_DEF,
  ice_golem: ICE_GOLEM_RIG_DEF,
  snow_spirit: SNOW_SPIRIT_RIG_DEF,
  kryssa_ice_queen: KRYSSA_ICE_QUEEN_RIG_DEF,
  kryssa_clone: KRYSSA_CLONE_RIG_DEF,
  ice_prison: ICE_PRISON_RIG_DEF,
  fire_imp: FIRE_IMP_RIG_DEF,
  dwarf_cannon: DWARF_CANNON_RIG_DEF,
  coal_golem: COAL_GOLEM_RIG_DEF,
  welder_drone: WELDER_DRONE_RIG_DEF,
  iron_shielder: IRON_SHIELDER_RIG_DEF,
  forge_energy_core: FORGE_ENERGY_CORE_RIG_DEF,
  forge_titan: FORGE_TITAN_RIG_DEF,
  merchant: MERCHANT_RIG_DEF,
  training_dummy: TRAINING_DUMMY_RIG_DEF,
};

export const ALL_SAMPLE_RIGS: readonly EntityRigDef[] = [
  VANGUARD_RIG_DEF,
  RANGER_RIG_DEF,
  ELEMENTALIST_RIG_DEF,
  DRUID_RIG_DEF,
  ENGINEER_RIG_DEF,
  GOBLIN_SHOOTER_RIG_DEF,
  WILD_BOAR_RIG_DEF,
  SPORE_BOMBER_RIG_DEF,
  GREEN_SLIME_RIG_DEF,
  MINI_SLIME_RIG_DEF,
  GOBLIN_SHAMAN_RIG_DEF,
  THORN_TURRET_RIG_DEF,
  SPORE_GUARDIAN_RIG_DEF,
  SPORE_KING_RIG_DEF,
  FROST_BAT_RIG_DEF,
  BABY_YETI_RIG_DEF,
  ICE_MAGE_RIG_DEF,
  ICE_GOLEM_RIG_DEF,
  SNOW_SPIRIT_RIG_DEF,
  KRYSSA_ICE_QUEEN_RIG_DEF,
  KRYSSA_CLONE_RIG_DEF,
  ICE_PRISON_RIG_DEF,
  FIRE_IMP_RIG_DEF,
  DWARF_CANNON_RIG_DEF,
  COAL_GOLEM_RIG_DEF,
  WELDER_DRONE_RIG_DEF,
  IRON_SHIELDER_RIG_DEF,
  FORGE_ENERGY_CORE_RIG_DEF,
  FORGE_TITAN_RIG_DEF,
  MERCHANT_RIG_DEF,
  TRAINING_DUMMY_RIG_DEF,
];
