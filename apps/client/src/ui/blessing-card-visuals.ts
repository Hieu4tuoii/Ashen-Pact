import {
  BLESSINGS,
  type BlessingGroup,
  type BuffId,
  type CharacterId,
  DUO_BOONS,
  type DuoBoonId,
  type ElementType,
  FLOOR_BUFFS,
  i18n,
  isDuoBoonId,
  type SimPlayerState,
  type SupportedLocale,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../art/palette.js';
import { zzfx } from '../audio/zzfx.js';
import type { GameScene } from '../scenes/GameScene.js';
import { drawKeyChip, drawStyledPanel } from './components/hud-primitives.js';
import { UI_THEME } from './theme.js';

const LEGACY_BUFF_ALIASES: Readonly<Record<string, BuffId>> = {
  bountiful_vitality: 'vanguard_bastion_prism',
  swift_wind: 'elementalist_twin_orbit',
};

export interface BuffVisualMeta {
  borderHex: string;
  accentHex: string;
  borderColor: number;
  accentColor: number;
  badgeText: string;
  iconKind: string;
  blessingGroup: BlessingGroup;
  element: ElementType;
  characterId?: CharacterId;
  isDuoBoon?: boolean;
  secondaryHex?: string;
  secondaryColor?: number;
  requiredElements?: readonly [ElementType, ElementType];
}

/**
 * Resolves a BuffId (BlessingId, DuoBoonId, or legacy alias) to its localized display name and description,
 * ensuring raw snake_case IDs never appear in cards or Victory/Defeat summaries.
 */
export function resolveLocalizedBuffText(
  rawBuffId: BuffId | string,
  locale: SupportedLocale = i18n.getLocale(),
): { name: string; desc: string } {
  const prevLocale = i18n.getLocale();
  if (prevLocale !== locale) i18n.setLocale(locale);
  try {
    const canonicalStr = String(LEGACY_BUFF_ALIASES[String(rawBuffId)] ?? rawBuffId);
    if (isDuoBoonId(canonicalStr)) {
      const duoDef = DUO_BOONS[canonicalStr];
      return i18n.getBuffText(canonicalStr, duoDef.nameVi, duoDef.descriptionVi);
    }
    const canonicalId = canonicalStr as BuffId;
    const def =
      BLESSINGS[canonicalId as keyof typeof BLESSINGS] ??
      FLOOR_BUFFS[canonicalId as keyof typeof FLOOR_BUFFS];
    if (def) {
      return i18n.getBuffText(canonicalId, def.nameVi, def.descriptionVi);
    }
    const lookedUp = i18n.getBuffText(canonicalId);
    if (lookedUp.name !== canonicalStr) return lookedUp;
    const humanized = String(rawBuffId)
      .split('_')
      .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : ''))
      .join(' ');
    return { name: humanized, desc: '' };
  } finally {
    if (prevLocale !== locale) i18n.setLocale(prevLocale);
  }
}

function getElementBadgeLabel(element: ElementType, isEn: boolean): string {
  if (element === 'burn') return isEn ? 'BURN' : 'LỬA';
  if (element === 'chill') return isEn ? 'CHILL' : 'BĂNG';
  if (element === 'shock') return isEn ? 'SHOCK' : 'SÉT';
  if (element === 'poison') return isEn ? 'POISON' : 'ĐỘC';
  return isEn ? 'PHYSICAL' : 'VẬT LÝ';
}

export function getBuffVisualMeta(buffId: BuffId | string, isEn: boolean): BuffVisualMeta {
  const canonicalStr = String(LEGACY_BUFF_ALIASES[String(buffId)] ?? buffId);
  if (isDuoBoonId(canonicalStr)) {
    const duoDef = DUO_BOONS[canonicalStr];
    const [elA, elB] = duoDef.requiredElements;
    const labelA = getElementBadgeLabel(elA, isEn);
    const labelB = getElementBadgeLabel(elB, isEn);
    const primaryNum = hexToNum(duoDef.primaryColor);
    const secondaryNum = hexToNum(duoDef.secondaryColor);
    return {
      borderHex: duoDef.primaryColor,
      accentHex: duoDef.primaryColor,
      borderColor: primaryNum,
      accentColor: primaryNum,
      secondaryHex: duoDef.secondaryColor,
      secondaryColor: secondaryNum,
      badgeText: isEn
        ? `[✦ DUO BOON · ${labelA} × ${labelB}]`
        : `[✦ GIAO THOA · ${labelA} × ${labelB}]`,
      iconKind: 'duo_boon',
      blessingGroup: 'bullet_mod',
      element: elA,
      isDuoBoon: true,
      requiredElements: duoDef.requiredElements,
    };
  }

  const bDef =
    BLESSINGS[canonicalStr as keyof typeof BLESSINGS] ??
    FLOOR_BUFFS[canonicalStr as keyof typeof FLOOR_BUFFS];
  const group: BlessingGroup =
    bDef?.blessingGroup ?? (bDef?.characterId ? 'skill_upgrade' : 'bullet_mod');
  const element: ElementType = bDef?.element ?? 'none';
  const elLabel = getElementBadgeLabel(element, isEn);

  if (group === 'skill_upgrade' || bDef?.characterId) {
    const hex = bDef?.accentColor ?? PALETTE.SOLAR_GOLD;
    const num = hexToNum(hex);
    return {
      borderHex: hex,
      accentHex: hex,
      borderColor: num,
      accentColor: num,
      badgeText: isEn ? '[★ SKILL UPGRADE]' : '[★ TUYỆT KỸ CLASS]',
      iconKind: bDef?.characterId ?? 'vanguard',
      blessingGroup: 'skill_upgrade',
      element,
      characterId: bDef?.characterId,
    };
  }

  const badgeByGroup: Record<Exclude<BlessingGroup, 'skill_upgrade'>, string> = {
    table_tech: isEn ? `[TABLE TECH · ${elLabel}]` : `[CHẮN CHIẾN · ${elLabel}]`,
    dash_tech: isEn ? `[DASH TECH · ${elLabel}]` : `[LƯỚT CHIẾN · ${elLabel}]`,
    reload_tech: isEn ? `[RELOAD TECH · ${elLabel}]` : `[NHỊP NẠP [R] · ${elLabel}]`,
    bullet_mod: isEn ? `[BULLET MOD · ${elLabel}]` : `[ĐẠN ĐẠO · ${elLabel}]`,
  };

  const hex = bDef?.accentColor ?? PALETTE.ELECTRIC_VIOLET;
  const num = hexToNum(hex);
  return {
    borderHex: hex,
    accentHex: hex,
    borderColor: num,
    accentColor: num,
    badgeText: badgeByGroup[group],
    iconKind: group,
    blessingGroup: group,
    element,
  };
}

function drawElementVectorGlyph(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  element: ElementType,
  color: number,
  s: number,
): void {
  const boneNum = hexToNum(PALETTE.BONE_WHITE);
  g.fillStyle(color, 1);
  g.lineStyle(Math.max(1.2, 1.6 * s), color, 1);

  if (element === 'burn') {
    g.fillTriangle(cx, cy - 6.8 * s, cx - 5.2 * s, cy + 4.8 * s, cx + 5.2 * s, cy + 4.8 * s);
    g.fillStyle(boneNum, 0.9);
    g.fillTriangle(cx, cy - 2.2 * s, cx - 2.5 * s, cy + 4.2 * s, cx + 2.5 * s, cy + 4.2 * s);
  } else if (element === 'chill') {
    for (let k = 0; k < 3; k++) {
      const ang = (k * Math.PI) / 3;
      const dx = Math.cos(ang) * 6.0 * s;
      const dy = Math.sin(ang) * 6.0 * s;
      g.lineBetween(cx - dx, cy - dy, cx + dx, cy + dy);
    }
    g.fillStyle(boneNum, 0.92);
    g.fillTriangle(cx, cy - 2.6 * s, cx - 2.4 * s, cy, cx + 2.4 * s, cy);
    g.fillTriangle(cx, cy + 2.6 * s, cx - 2.4 * s, cy, cx + 2.4 * s, cy);
  } else if (element === 'shock') {
    g.fillTriangle(cx + 2.0 * s, cy - 6.8 * s, cx - 4.8 * s, cy + 0.6 * s, cx + 0.8 * s, cy + 0.6 * s);
    g.fillTriangle(cx - 0.8 * s, cy - 0.6 * s, cx + 4.8 * s, cy - 0.6 * s, cx - 2.0 * s, cy + 6.8 * s);
  } else if (element === 'poison') {
    g.fillTriangle(cx, cy - 6.6 * s, cx - 4.2 * s, cy + 1.2 * s, cx + 4.2 * s, cy + 1.2 * s);
    g.fillCircle(cx, cy + 2.0 * s, 4.2 * s);
    g.fillStyle(boneNum, 0.85);
    g.fillCircle(cx - 1.3 * s, cy + 1.5 * s, 1.3 * s);
  } else {
    g.fillTriangle(cx - 5.4 * s, cy - 3.6 * s, cx + 5.4 * s, cy - 3.6 * s, cx, cy + 6.4 * s);
    g.fillRect(cx - 5.4 * s, cy - 5.4 * s, 10.8 * s, 2.4 * s);
  }
}

function drawDiamondStud(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  outerCol: number,
  coreCol: number,
): void {
  const inkNum = hexToNum(PALETTE.INK_DARK);
  g.fillStyle(inkNum, 0.96);
  g.fillTriangle(cx, cy - r - 1.2, cx - r - 1.2, cy, cx + r + 1.2, cy);
  g.fillTriangle(cx, cy + r + 1.2, cx - r - 1.2, cy, cx + r + 1.2, cy);
  g.fillStyle(outerCol, 1);
  g.fillTriangle(cx, cy - r, cx - r, cy, cx + r, cy);
  g.fillTriangle(cx, cy + r, cx - r, cy, cx + r, cy);
  const cr = r * 0.46;
  g.fillStyle(coreCol, 0.95);
  g.fillTriangle(cx, cy - cr, cx - cr, cy, cx + cr, cy);
  g.fillTriangle(cx, cy + cr, cx - cr, cy, cx + cr, cy);
}

/**
 * Draws two intersecting elemental rings with dedicated per-element vector icons
 * (`burn`, `chill`, `shock`, `poison`, `none`) and a central diamond fusion spark.
 */
export function drawDuoBoonIntersectingEmblems(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  elA: ElementType,
  elB: ElementType,
  colorA: number,
  colorB: number,
  radius = 14,
): void {
  const s = radius / 14;
  const offset = radius * 0.56;
  const leftX = cx - offset;
  const rightX = cx + offset;
  const goldNum = hexToNum(PALETTE.SOLAR_GOLD);
  const boneNum = hexToNum(PALETTE.BONE_WHITE);

  // Subtle prismatic halo behind both intersecting rings
  g.fillStyle(goldNum, 0.12);
  g.fillCircle(cx, cy, radius * 1.48);

  // Left & Right elemental discs
  g.fillStyle(UI_THEME.panelBgDark, 0.96);
  g.fillCircle(leftX, cy, radius);
  g.fillCircle(rightX, cy, radius);

  g.fillStyle(colorA, 0.18);
  g.fillCircle(leftX, cy, radius * 0.8);
  g.fillStyle(colorB, 0.18);
  g.fillCircle(rightX, cy, radius * 0.8);

  // Intersecting ring strokes
  const strokeW = Math.max(1.4, 2.0 * s);
  g.lineStyle(strokeW, colorA, 0.96);
  g.strokeCircle(leftX, cy, radius);
  g.lineStyle(strokeW, colorB, 0.96);
  g.strokeCircle(rightX, cy, radius);

  // Per-element vector glyphs shifted slightly outward from the fusion center
  drawElementVectorGlyph(g, leftX - 1.4 * s, cy, elA, colorA, s * 0.86);
  drawElementVectorGlyph(g, rightX + 1.4 * s, cy, elB, colorB, s * 0.86);

  // Central diamond fusion spark at the intersection point
  g.lineStyle(Math.max(1.1, 1.4 * s), goldNum, 0.92);
  g.lineBetween(cx - 5.2 * s, cy, cx + 5.2 * s, cy);
  g.lineBetween(cx, cy - 6.2 * s, cx, cy + 6.2 * s);
  drawDiamondStud(g, cx, cy, 4.0 * s, goldNum, boneNum);
}

/**
 * Draws a procedural vector emblem for a Blessing card or HUD chip.
 * Supports both `(g, cx, cy, iconKind, color)` and legacy `(g, iconKind, cx, cy, color)`.
 */
export function drawBuffEmblemIcon(
  g: Phaser.GameObjects.Graphics,
  arg2: number | string,
  arg3: number,
  arg4: string | number,
  arg5: number | string,
  radius = 15,
): void {
  const isLegacyOrder = typeof arg2 === 'string';
  const iconKind = isLegacyOrder ? arg2 : String(arg4);
  const cx = isLegacyOrder ? arg3 : arg2;
  const cy = isLegacyOrder ? Number(arg4) : arg3;
  const accentNum = typeof arg5 === 'number' ? arg5 : hexToNum(String(arg5));
  const s = radius / 15;

  g.fillStyle(UI_THEME.panelBgDark, 0.96);
  g.fillCircle(cx, cy, radius);
  g.lineStyle(Math.max(1.4, 1.8 * s), accentNum, 0.95);
  g.strokeCircle(cx, cy, radius);
  g.fillStyle(accentNum, 0.16);
  g.fillCircle(cx, cy, radius * 0.76);

  g.fillStyle(accentNum, 1);
  g.lineStyle(Math.max(1.3, 1.8 * s), accentNum, 1);

  if (iconKind === 'table_tech') {
    g.fillRect(cx - 7 * s, cy - 5 * s, 14 * s, 4 * s);
    g.fillRect(cx - 5 * s, cy - 1 * s, 10 * s, 7 * s);
    g.lineBetween(cx, cy - 9 * s, cx, cy - 6 * s);
    g.lineBetween(cx - 8 * s, cy - 7 * s, cx - 5 * s, cy - 4 * s);
    g.lineBetween(cx + 8 * s, cy - 7 * s, cx + 5 * s, cy - 4 * s);
  } else if (iconKind === 'dash_tech') {
    g.fillTriangle(cx - 7 * s, cy - 6 * s, cx - 1 * s, cy, cx - 7 * s, cy + 6 * s);
    g.fillTriangle(cx - 1 * s, cy - 6 * s, cx + 7 * s, cy, cx - 1 * s, cy + 6 * s);
  } else if (iconKind === 'reload_tech') {
    g.strokeCircle(cx, cy, 6.5 * s);
    g.fillRect(cx - 2.5 * s, cy - 4 * s, 5 * s, 8 * s);
    g.fillTriangle(cx + 5 * s, cy - 6 * s, cx + 9 * s, cy - 2 * s, cx + 3 * s, cy - 2 * s);
  } else if (iconKind === 'bullet_mod' || iconKind === 'ricochet') {
    g.lineBetween(cx - 7 * s, cy + 5 * s, cx - 1 * s, cy - 1 * s);
    g.lineBetween(cx - 1 * s, cy - 1 * s, cx + 6 * s, cy - 6 * s);
    g.lineBetween(cx - 1 * s, cy - 1 * s, cx + 6 * s, cy + 4 * s);
    g.fillCircle(cx + 6 * s, cy - 6 * s, 2.3 * s);
    g.fillCircle(cx + 6 * s, cy + 4 * s, 2.3 * s);
  } else if (iconKind === 'shield' || iconKind === 'vanguard') {
    g.fillTriangle(cx - 7.5 * s, cy - 5 * s, cx + 7.5 * s, cy - 5 * s, cx, cy + 9 * s);
    g.fillRect(cx - 7.5 * s, cy - 7 * s, 15 * s, 3.5 * s);
  } else if (iconKind === 'bolt' || iconKind === 'elementalist') {
    g.fillTriangle(cx + 2 * s, cy - 9 * s, cx - 5.5 * s, cy + 1 * s, cx + 1 * s, cy + 1 * s);
    g.fillTriangle(cx - 1 * s, cy - 1 * s, cx + 5.5 * s, cy - 1 * s, cx - 2 * s, cy + 9 * s);
  } else if (iconKind === 'crosshair' || iconKind === 'ranger') {
    g.strokeCircle(cx, cy, 6.8 * s);
    g.fillCircle(cx, cy, 2.2 * s);
    g.lineBetween(cx - 9.5 * s, cy, cx - 4.5 * s, cy);
    g.lineBetween(cx + 4.5 * s, cy, cx + 9.5 * s, cy);
  } else if (iconKind === 'wing' || iconKind === 'druid') {
    g.fillCircle(cx, cy + 2 * s, 5.2 * s);
    g.fillTriangle(cx - 5.2 * s, cy + 2 * s, cx + 5.2 * s, cy + 2 * s, cx, cy - 8 * s);
  } else {
    g.fillTriangle(cx, cy - 8 * s, cx - 6.5 * s, cy + 4.5 * s, cx + 6.5 * s, cy + 4.5 * s);
    g.fillTriangle(cx, cy + 8 * s, cx - 6.5 * s, cy - 4.5 * s, cx + 6.5 * s, cy - 4.5 * s);
  }
}

/**
 * Draws a compact row of owned Duo Boon + Blessing emblem chips for the local player on the HUD.
 */
export function drawPlayerBlessingChipsHud(
  _scene: unknown,
  g: Phaser.GameObjects.Graphics,
  localPlayer:
    | (Pick<SimPlayerState, 'blessingIds'> & { duoBoonIds?: DuoBoonId[] })
    | null
    | undefined,
  x = 12,
  y = 85,
): number {
  const duoIds = localPlayer?.duoBoonIds ?? [];
  const blessingIds = localPlayer?.blessingIds ?? [];
  const combined: BuffId[] = [...duoIds, ...blessingIds];
  if (combined.length === 0) return 0;

  const visibleCount = Math.min(combined.length, 9);
  const chipR = 7.5;
  const goldNum = hexToNum(PALETTE.SOLAR_GOLD);
  let cursorX = x + chipR;

  for (let i = 0; i < visibleCount; i++) {
    const buffId = combined[i]!;
    const meta = getBuffVisualMeta(buffId, false);
    const cy = y + chipR;
    if (meta.isDuoBoon && meta.requiredElements) {
      const [elA, elB] = meta.requiredElements;
      g.lineStyle(1.2, goldNum, 0.85);
      g.strokeRoundedRect(cursorX - chipR - 1, y - 1, chipR * 2 + 7, chipR * 2 + 2, 4);
      drawDuoBoonIntersectingEmblems(
        g,
        cursorX + 2.5,
        cy,
        elA,
        elB,
        meta.borderColor,
        meta.secondaryColor ?? goldNum,
        5.2,
      );
      cursorX += 23;
    } else {
      drawBuffEmblemIcon(g, cursorX, cy, meta.iconKind, meta.borderHex, chipR);
      cursorX += 18;
    }
  }
  return visibleCount;
}

function drawDuoBoonDiamondRainbowCardFrame(
  g: Phaser.GameObjects.Graphics,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  meta: BuffVisualMeta,
  isHovered: boolean,
): void {
  const goldNum = hexToNum(PALETTE.SOLAR_GOLD);
  const boneNum = hexToNum(PALETTE.BONE_WHITE);
  const violetNum = hexToNum(PALETTE.ELECTRIC_VIOLET);
  const primaryCol = meta.borderColor;
  const secondaryCol = meta.secondaryColor ?? goldNum;

  // Outer prismatic rainbow glow halo
  g.lineStyle(isHovered ? 4.2 : 3.0, violetNum, isHovered ? 0.34 : 0.22);
  g.strokeRoundedRect(cardX - 2, cardY - 2, cardW + 4, cardH + 4, UI_THEME.panelRadius.md + 2);

  // Main elevated obsidian card body with Solar Gold outer frame
  drawStyledPanel(g, cardX, cardY, cardW, cardH, {
    fillColor: isHovered ? UI_THEME.panelBgElevated : UI_THEME.panelBg,
    fillAlpha: 0.98,
    borderColor: goldNum,
    borderWidth: isHovered ? 2.8 : 2.2,
    radius: UI_THEME.panelRadius.md,
    accentColor: primaryCol,
    accentSide: 'top',
  });

  // Inner dual-element prismatic bevel frame (Primary top-left L, Secondary bottom-right L)
  const inset = 3.5;
  const ix0 = cardX + inset;
  const iy0 = cardY + inset;
  const ix1 = cardX + cardW - inset;
  const iy1 = cardY + cardH - inset;
  g.lineStyle(1.6, primaryCol, 0.92);
  g.lineBetween(ix0 + 5, iy0, ix1 - 5, iy0);
  g.lineBetween(ix0, iy0 + 5, ix0, iy1 - 5);
  g.lineStyle(1.6, secondaryCol, 0.92);
  g.lineBetween(ix0 + 5, iy1, ix1 - 5, iy1);
  g.lineBetween(ix1, iy0 + 5, ix1, iy1 - 5);

  // Prismatic rainbow corner sheen lines
  g.lineStyle(1.0, violetNum, 0.55);
  g.lineBetween(ix0 + 10, iy0 + 2, ix1 - 10, iy0 + 2);
  g.lineBetween(ix0 + 10, iy1 - 2, ix1 - 10, iy1 - 2);

  // 4 faceted diamond studs anchored at the 4 card corners
  const studR = isHovered ? 5.2 : 4.4;
  drawDiamondStud(g, cardX + 4, cardY + 4, studR, goldNum, boneNum);
  drawDiamondStud(g, cardX + cardW - 4, cardY + 4, studR, primaryCol, boneNum);
  drawDiamondStud(g, cardX + 4, cardY + cardH - 4, studR, secondaryCol, boneNum);
  drawDiamondStud(g, cardX + cardW - 4, cardY + cardH - 4, studR, goldNum, boneNum);
}

/**
 * Renders the 3-card Floor Blessing / Duo Boon Choice modal (`sim.runState === 'buff_choice'`).
 */
export function renderBlessingChoiceCards(
  scene: GameScene,
  pendingBuffChoices: BuffId[],
  isEn: boolean,
  textRes: number,
): void {
  const ui = scene.uiScene;
  const sim = scene.transport.getSim();
  const localPlayer = scene.transport.getLocalPlayerState();
  const goldNum = hexToNum(PALETTE.SOLAR_GOLD);
  const boneNum = hexToNum(PALETTE.BONE_WHITE);

  pendingBuffChoices.forEach((buffId: BuffId, idx: number) => {
    const buffTxt = resolveLocalizedBuffText(buffId, isEn ? 'en' : 'vi');
    const meta = getBuffVisualMeta(buffId, isEn);
    const isHovered = scene.buffHoveredIdx === idx;
    const cardW = 212;
    const cardH = 248;
    const cardX = 148 + idx * 226;
    const cardY = isHovered ? 144 : 149;

    const cardG = ui.add.graphics();
    if (meta.isDuoBoon && meta.requiredElements) {
      drawDuoBoonDiamondRainbowCardFrame(cardG, cardX, cardY, cardW, cardH, meta, isHovered);
      drawStyledPanel(cardG, cardX + 10, cardY + 10, cardW - 20, 18, {
        fillColor: UI_THEME.panelBgDark,
        fillAlpha: 0.96,
        borderColor: goldNum,
        borderWidth: 1.4,
        radius: 4,
      });
      const [elA, elB] = meta.requiredElements;
      drawDuoBoonIntersectingEmblems(
        cardG,
        cardX + cardW / 2,
        cardY + 49,
        elA,
        elB,
        meta.borderColor,
        meta.secondaryColor ?? goldNum,
        14,
      );
      const midX = cardX + cardW / 2;
      cardG.lineStyle(1.3, meta.borderColor, 0.55);
      cardG.lineBetween(cardX + 16, cardY + 114, midX - 6, cardY + 114);
      cardG.lineStyle(1.3, meta.secondaryColor ?? goldNum, 0.55);
      cardG.lineBetween(midX + 6, cardY + 114, cardX + cardW - 16, cardY + 114);
      drawDiamondStud(cardG, midX, cardY + 114, 3.0, goldNum, boneNum);
    } else {
      drawStyledPanel(cardG, cardX, cardY, cardW, cardH, {
        fillColor: isHovered ? UI_THEME.panelBgElevated : UI_THEME.panelBg,
        fillAlpha: 0.97,
        borderColor: hexToNum(isHovered ? PALETTE.SOLAR_GOLD : meta.borderHex),
        borderWidth: isHovered ? 2.6 : 2.0,
        radius: UI_THEME.panelRadius.md,
        accentColor: hexToNum(meta.borderHex),
        accentSide: 'top',
      });
      drawStyledPanel(cardG, cardX + 10, cardY + 10, cardW - 20, 18, {
        fillColor: UI_THEME.panelBgDark,
        fillAlpha: 0.94,
        borderColor: hexToNum(meta.borderHex),
        borderWidth: 1.2,
        radius: 4,
      });
      drawBuffEmblemIcon(cardG, cardX + cardW / 2, cardY + 48, meta.iconKind, meta.borderHex, 15);
      cardG.lineStyle(1, hexToNum(meta.borderHex), 0.32);
      cardG.lineBetween(cardX + 16, cardY + 114, cardX + cardW - 16, cardY + 114);
    }

    const footerY = cardY + cardH - 34;
    drawStyledPanel(cardG, cardX + 12, footerY, cardW - 24, 24, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.95,
      borderColor:
        meta.isDuoBoon || isHovered ? goldNum : hexToNum(meta.borderHex),
      borderWidth: meta.isDuoBoon ? 1.5 : 1.3,
      radius: 5,
    });
    const chipMetrics = drawKeyChip(cardG, cardX + 22, footerY + 5, `${idx + 1}`, { active: true });
    scene.modalContainer.add(cardG);

    const fontSans = '"Be Vietnam Pro", sans-serif';
    const badgeTxt = ui.add
      .text(cardX + cardW / 2, cardY + 19, meta.badgeText, {
        fontFamily: fontSans,
        fontSize: '8.8px',
        fontStyle: '800',
        color: meta.isDuoBoon ? PALETTE.SOLAR_GOLD : meta.borderHex,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.2,
        resolution: textRes,
      })
      .setOrigin(0.5, 0.5);
    const title = ui.add
      .text(cardX + cardW / 2, cardY + 89, buffTxt.name, {
        fontFamily: fontSans,
        fontSize: buffTxt.name.length > 22 ? '11px' : '12px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.8,
        align: 'center',
        lineSpacing: -1,
        wordWrap: { width: cardW - 18 },
        resolution: textRes,
      })
      .setOrigin(0.5, 0.5);
    const desc = ui.add
      .text(cardX + cardW / 2, cardY + 120, buffTxt.desc, {
        fontFamily: fontSans,
        fontSize: buffTxt.desc.length > 135 ? '9.5px' : '10px',
        fontStyle: '600',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.2,
        align: 'center',
        lineSpacing: 1.2,
        wordWrap: { width: cardW - 20 },
        resolution: textRes,
      })
      .setOrigin(0.5, 0);
    const keyNumTxt = ui.add
      .text(cardX + 22 + chipMetrics.width * 0.5, footerY + 12, `${idx + 1}`, {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '10.5px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2,
        resolution: textRes,
      })
      .setOrigin(0.5, 0.5);
    const selectActionStr = isEn ? `Press [${idx + 1}] Select` : `Nhấn [${idx + 1}] Chọn`;
    const selectTxt = ui.add
      .text(cardX + cardW / 2 + 10, footerY + 12, selectActionStr, {
        fontFamily: fontSans,
        fontSize: '10.5px',
        fontStyle: '800',
        color: isHovered || meta.isDuoBoon ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.2,
        resolution: textRes,
      })
      .setOrigin(0.5, 0.5);
    scene.modalContainer.add([badgeTxt, title, desc, keyNumTxt, selectTxt]);

    const hit = ui.add
      .rectangle(cardX + cardW / 2, cardY + cardH / 2, cardW, cardH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      if (scene.buffHoveredIdx !== idx) {
        scene.buffHoveredIdx = idx;
        zzfx.play('ui_hover');
      }
    });
    hit.on('pointerout', () => {
      if (scene.buffHoveredIdx === idx) scene.buffHoveredIdx = null;
    });
    hit.on('pointerdown', () => {
      if (scene.room && scene.coopMode !== 'solo') {
        localPlayer.buffChoices = [];
        scene.room.send('select_buff', { buffId });
      } else {
        sim.selectFloorBuff(buffId, localPlayer.id);
      }
      zzfx.play('skill_cast');
    });
    scene.modalContainer.add(hit);
  });
}
