import { PALETTE } from './palette.js';
import { INNER_OUTLINE_WIDTH, STANDARD_OUTLINE_WIDTH, type VectorShapeCommand } from './primitives.js';

export type RigPartId =
  | 'backAccessory'
  | 'legLeft'
  | 'legRight'
  | 'armLeft'
  | 'torso'
  | 'head'
  | 'weapon'
  | 'armRight';

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
      // Leather grip
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
      // Heavy steel barrel
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
      // Brass muzzle ring
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
  scrap_shotgun: {
    id: 'scrap_shotgun',
    width: 42,
    height: 22,
    originX: 0.26,
    originY: 0.5,
    shapes: [
      // Wooden stock
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
      // Wide double barrel
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
      // Flared crimson/brass blunderbuss muzzle
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
      // Forward magazine
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
      // Compact SMG receiver
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
      // Rapid barrel tip
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
};

export const RIG_DEFS_BY_ID: Record<string, EntityRigDef> = {
  vanguard: VANGUARD_RIG_DEF,
  goblin_shooter: GOBLIN_SHOOTER_RIG_DEF,
  wild_boar: WILD_BOAR_RIG_DEF,
  spore_bomber: SPORE_BOMBER_RIG_DEF,
  training_dummy: TRAINING_DUMMY_RIG_DEF,
};

export const ALL_SAMPLE_RIGS: readonly EntityRigDef[] = [
  VANGUARD_RIG_DEF,
  GOBLIN_SHOOTER_RIG_DEF,
  WILD_BOAR_RIG_DEF,
  SPORE_BOMBER_RIG_DEF,
  TRAINING_DUMMY_RIG_DEF,
];

