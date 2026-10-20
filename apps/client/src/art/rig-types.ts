import type { VectorShapeCommand } from './primitives.js';

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

export interface WeaponVectorDef {
  id: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  shapes: readonly VectorShapeCommand[];
}

export const BOSS_OUTLINE_WIDTH = 3.5;
