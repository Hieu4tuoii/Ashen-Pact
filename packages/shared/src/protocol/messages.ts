import { clamp } from '../math/vec2.js';

/**
 * Required Vietnamese diacritics verification string from master prompt section 3.2 & Phase 0 DoD.
 */
export const VIETNAMESE_VERIFICATION_STRING = 'Tiếng Việt: ắ ằ ẳ ẵ ặ ầ ẩ ẫ ậ ỡ ự ữ ỹ Đ đ';

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
  DROP_WEAPON: 1 << 6,
  READY: 1 << 7,
  RELOAD_VENT: 1 << 8,
} as const;

export const SHOT_FLAG = {
  FINALE_SHOT: 1 << 0,
  OVERCLOCKED_SHOT: 1 << 1,
  DYNAMIC_BOUNCE: 1 << 2,
} as const;

export type QuickEmoteId = 1 | 2 | 3 | 4;

export const QUICK_EMOTES_VI: Record<QuickEmoteId, string> = {
  1: '👍 Tuyệt vời!',
  2: '❤️ Cần hồi máu!',
  3: '⚔️ Dồn sát thương!',
  4: '🎉 Chiến thắng!',
};

export const PLAYER_SLOT_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: '#38BDF8',
  2: '#F43F5E',
  3: '#22C55E',
  4: '#FACC15',
};

export const PLAYER_SLOT_LABELS_VI: Record<1 | 2 | 3 | 4, string> = {
  1: 'P1 Xanh Dương',
  2: 'P2 Đỏ',
  3: 'P3 Xanh Lá',
  4: 'P4 Vàng',
};

export interface PlayerInputPacket {
  seq: number;
  tick: number;
  moveX: number;
  moveY: number;
  aimAngle: number;
  buttons: number;
  /** Optional direct weapon slot selection (0..3) in test arena / inventory */
  weaponSlotSelect?: number | null;
  /** Optional cursor world coordinates when issuing a contextual Ping */
  pingWorldX?: number;
  pingWorldY?: number;
  /** Optional quick emote (1..4) */
  emoteId?: QuickEmoteId | null;
}

export interface HelloRoomMessage {
  serverTick: number;
  roomName: string;
  seed: number;
  connectedPlayers: number;
  welcomeVi: string;
  debugAllowed?: boolean;
}

/**
 * Deterministic Bullet Volley Spawn event sent from authoritative server to clients.
 * Clients simulate projectiles locally from this compact event instead of syncing per-bullet positions.
 */
export interface BulletVolleySpawnNetEvent {
  eventId: number;
  tick: number;
  ownerId: number;
  team: 'player' | 'enemy';
  weaponId: string;
  qx: number;
  qy: number;
  qAngle: number;
  seed: number;
  element: string;
  amplifiedByShield: boolean;
  shotFlags?: number;
  replacedProjectileId?: number;
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
