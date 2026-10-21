import { WORLD_VIEW_HEIGHT, WORLD_VIEW_WIDTH } from '@ashen-pact/shared';
import { PALETTE, hexToNum } from '../art/palette.js';
import {
  applyMenuInputEdit,
  MENU_INPUT_BOUNDS,
  MENU_IP_MAX_LEN,
  MENU_NAME_MAX_LEN,
  MenuDomInputOverlay,
  type MenuDomInputCallbacks,
  type MenuInputBoxBounds,
  type MenuInputEditAction,
  type MenuInputFieldId,
  sanitizeMenuInputText,
} from './menu-dom-inputs.js';
import { UI_THEME } from './theme.js';

export {
  applyMenuInputEdit,
  MENU_INPUT_BOUNDS,
  MENU_IP_MAX_LEN,
  MENU_NAME_MAX_LEN,
  MenuDomInputOverlay,
  MenuDomInputOverlay as MenuHtmlInputOverlay,
  sanitizeMenuInputText,
  type MenuDomInputCallbacks,
  type MenuInputBoxBounds,
  type MenuInputEditAction,
  type MenuInputFieldId,
};

export interface MenuInputRect {
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
  fontSizePx: number;
}

/**
 * Pure coordinate converter mapping a 960x540 design-space input box (`cx, cy, w, h`)
 * onto a CSS pixel rectangle over the Phaser canvas (`canvasRect`).
 */
export function computeMenuInputOverlayRect(
  field: MenuInputFieldId,
  canvasRect: { left: number; top: number; width: number; height: number },
  bounds: MenuInputBoxBounds = MENU_INPUT_BOUNDS[field],
): MenuInputRect {
  const scaleX = canvasRect.width / WORLD_VIEW_WIDTH;
  const scaleY = canvasRect.height / WORLD_VIEW_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  const viewW = WORLD_VIEW_WIDTH * scale;
  const viewH = WORLD_VIEW_HEIGHT * scale;
  const offsetX = canvasRect.left + (canvasRect.width - viewW) * 0.5;
  const offsetY = canvasRect.top + (canvasRect.height - viewH) * 0.5;

  const hitW = field === 'name' ? bounds.w - 28 : bounds.w;
  const leftInWorld = bounds.cx - bounds.w * 0.5;
  const topInWorld = bounds.cy - bounds.h * 0.5;

  return {
    leftPx: Math.round(offsetX + leftInWorld * scale),
    topPx: Math.round(offsetY + topInWorld * scale),
    widthPx: Math.round(hitW * scale),
    heightPx: Math.round(bounds.h * scale),
    fontSizePx: Math.max(11, Math.round(12 * scale)),
  };
}

/**
 * Sanitizes a raw input or pasted string for Menu Name or LAN IP fields.
 */
export function sanitizeMenuInputValue(
  raw: string,
  field: MenuInputFieldId,
  maxLength = field === 'name' ? MENU_NAME_MAX_LEN : MENU_IP_MAX_LEN,
): string {
  return sanitizeMenuInputText(raw, field, maxLength);
}

export type MenuButtonTier = 'primary' | 'secondary' | 'utility' | 'debug';

export interface MenuButtonHierarchySpec {
  id: string;
  tier: MenuButtonTier;
  width: number;
  height: number;
  fontSizePx: number;
  fillColor: number;
  borderColor: number;
  borderWidth: number;
  accentSide?: 'top' | 'left';
  debugOnly: boolean;
}

/**
 * Pure helper returning the 3-tier Main Menu button hierarchy spec (plus debug row)
 * to guarantee clear visual distinction between Primary CTA, Secondary Co-op, and Utility buttons.
 */
export function resolveMenuButtonHierarchySpec(
  id:
    | 'playSolo'
    | 'hostCoop'
    | 'joinCoop'
    | 'settings'
    | 'controls'
    | 'credits'
    | 'language'
    | 'artGallery'
    | 'toggleAnim',
): MenuButtonHierarchySpec {
  switch (id) {
    case 'playSolo':
      return {
        id,
        tier: 'primary',
        width: 348,
        height: 42,
        fontSizePx: 15,
        fillColor: hexToNum(PALETTE.RUBY_CORE),
        borderColor: hexToNum(PALETTE.SOLAR_GOLD),
        borderWidth: 2.2,
        accentSide: 'top',
        debugOnly: false,
      };
    case 'hostCoop':
      return {
        id,
        tier: 'secondary',
        width: 170,
        height: 34,
        fontSizePx: 12.5,
        fillColor: UI_THEME.panelBg,
        borderColor: hexToNum(PALETTE.BRASS_CORE),
        borderWidth: 1.8,
        accentSide: 'left',
        debugOnly: false,
      };
    case 'joinCoop':
      return {
        id,
        tier: 'secondary',
        width: 170,
        height: 34,
        fontSizePx: 12.5,
        fillColor: UI_THEME.panelBg,
        borderColor: hexToNum(PALETTE.AZURE_CORE),
        borderWidth: 1.8,
        accentSide: 'left',
        debugOnly: false,
      };
    case 'artGallery':
    case 'toggleAnim':
      return {
        id,
        tier: 'debug',
        width: 166,
        height: 32,
        fontSizePx: 11.5,
        fillColor: hexToNum(id === 'artGallery' ? PALETTE.STEEL_DARK : PALETTE.GOBLIN_GREEN),
        borderColor: UI_THEME.panelBorder,
        borderWidth: 1.5,
        debugOnly: true,
      };
    default:
      return {
        id,
        tier: 'utility',
        width: 144,
        height: 30,
        fontSizePx: 11.5,
        fillColor: hexToNum(id === 'language' ? PALETTE.FOREST_SHADE : PALETTE.SLATE_MID),
        borderColor: UI_THEME.panelBorder,
        borderWidth: 1.5,
        debugOnly: false,
      };
  }
}

export interface CampfireEmber {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  originX: number;
  originY: number;
}

export function createCampfireEmbers(): CampfireEmber[] {
  const embers: CampfireEmber[] = [];
  const firePositions: [number, number][] = [
    [236, 285],
    [724, 285],
  ];
  for (let i = 0; i < 24; i++) {
    const [ox, oy] = firePositions[i % 2]!;
    embers.push({
      x: ox + ((i * 7) % 18) - 9,
      y: oy - ((i * 11) % 45),
      vx: (((i * 13) % 20) - 10) * 0.8,
      vy: -18 - ((i * 5) % 22),
      size: 1.5 + (i % 3) * 0.8,
      alpha: 0.4 + (i % 5) * 0.12,
      life: (i * 0.13) % 1.8,
      maxLife: 1.4 + (i % 4) * 0.35,
      originX: ox,
      originY: oy,
    });
  }
  return embers;
}

export function drawMenuCampfires(
  gfx: {
    clear: () => void;
    fillStyle: (c: number, a?: number) => void;
    fillCircle: (x: number, y: number, r: number) => void;
    lineStyle: (w: number, c: number, a?: number) => void;
    strokeCircle: (x: number, y: number, r: number) => void;
    fillTriangle: (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
    ) => void;
  },
  embers: CampfireEmber[],
  t: number,
  dtSec: number,
): void {
  gfx.clear();
  const firePositions: [number, number][] = [
    [236, 285],
    [724, 285],
  ];

  for (let f = 0; f < firePositions.length; f++) {
    const [fx, fy] = firePositions[f]!;
    const pulse = Math.sin(t * 7.5 + f * 1.9) * 3.5;

    gfx.fillStyle(hexToNum(PALETTE.FLAME_ORANGE), 0.12);
    gfx.fillCircle(fx, fy, 96 + pulse);
    gfx.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 0.16);
    gfx.fillCircle(fx, fy, 56 + pulse * 0.6);

    gfx.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
    gfx.fillCircle(fx, fy + 4, 17);
    gfx.lineStyle(2.5, hexToNum(PALETTE.SLATE_MID), 1);
    gfx.strokeCircle(fx, fy + 4, 17);

    const flameH = 22 + Math.sin(t * 11 + f) * 4;
    const sway = Math.cos(t * 9 + f * 2) * 3;
    gfx.fillStyle(hexToNum(PALETTE.CRIMSON_BRIGHT), 0.9);
    gfx.fillTriangle(fx - 11, fy + 4, fx + 11, fy + 4, fx + sway, fy - flameH);
    gfx.fillStyle(hexToNum(PALETTE.FLAME_ORANGE), 0.95);
    gfx.fillTriangle(fx - 8, fy + 4, fx + 8, fy + 4, fx - sway * 0.7, fy - flameH * 0.82);
    gfx.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 1);
    gfx.fillTriangle(fx - 4.5, fy + 4, fx + 4.5, fy + 4, fx + sway * 0.4, fy - flameH * 0.55);
  }

  for (let i = 0; i < embers.length; i++) {
    const e = embers[i]!;
    e.life += dtSec;
    if (e.life >= e.maxLife) {
      e.life = 0;
      e.x = e.originX + Math.sin(t * 5 + i) * 8;
      e.y = e.originY;
    }
    e.x += (e.vx + Math.sin(t * 4 + i) * 6) * dtSec;
    e.y += e.vy * dtSec;
    const progress = e.life / e.maxLife;
    const alpha = Math.max(0, (1 - progress) * e.alpha);
    gfx.fillStyle(hexToNum(i % 2 === 0 ? PALETTE.SOLAR_GOLD : PALETTE.FLAME_ORANGE), alpha);
    gfx.fillCircle(e.x, e.y, e.size * (1 - progress * 0.4));
  }
}
