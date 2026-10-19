import { clamp } from '../math/vec2.js';

/**
 * Required Vietnamese diacritics verification string from master prompt section 3.2 & Phase 0 DoD.
 */
export const VIETNAMESE_VERIFICATION_STRING =
  'Tiếng Việt: ắ ằ ẳ ẵ ặ ầ ẩ ẫ ậ ỡ ự ữ ỹ Đ đ';

export const WORLD_VIEW_WIDTH = 960;
export const WORLD_VIEW_HEIGHT = 540;
export const TILE_SIZE = 32;

export const INPUT_BUTTON = {
  FIRE: 1 << 0,
  SKILL: 1 << 1,
  DASH: 1 << 2,
  INTERACT: 1 << 3,
  SWAP: 1 << 4,
  PING: 1 << 5,
} as const;

export interface PlayerInputPacket {
  seq: number;
  tick: number;
  moveX: number;
  moveY: number;
  aimAngle: number;
  buttons: number;
  /** Optional direct weapon slot selection (0..3) in test arena / inventory */
  weaponSlotSelect?: number | null;
}

export interface HelloRoomMessage {
  serverTick: number;
  roomName: string;
  seed: number;
  connectedPlayers: number;
  welcomeVi: string;
}

/**
 * Quantizes world coordinate (precision 0.1 unit) into signed 16-bit integer range.
 */
export function quantizeCoord(value: number): number {
  return clamp(Math.round(value * 10), -32768, 32767);
}

export function dequantizeCoord(quantized: number): number {
  return quantized / 10;
}

/**
 * Quantizes angle in radians [-PI, PI] into signed 16-bit integer (milliradians).
 */
export function quantizeAngle(radians: number): number {
  return clamp(Math.round(radians * 1000), -3142, 3142);
}

export function dequantizeAngle(quantized: number): number {
  return quantized / 1000;
}
