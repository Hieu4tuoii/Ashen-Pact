import {
  BLESSINGS,
  type BlessingGroup,
  type BuffId,
  type CharacterId,
  type ElementType,
  FLOOR_BUFFS,
  i18n,
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
}

/**
 * Resolves a BuffId (or legacy alias) to its localized display name and description,
 * ensuring raw snake_case IDs never appear in cards or Victory/Defeat summaries.
 */
export function resolveLocalizedBuffText(
  rawBuffId: BuffId | string,
  locale: SupportedLocale = i18n.getLocale(),
): { name: string; desc: string } {
  const prevLocale = i18n.getLocale();
  if (prevLocale !== locale) i18n.setLocale(locale);
  try {
    const canonicalId = (LEGACY_BUFF_ALIASES[String(rawBuffId)] ?? rawBuffId) as BuffId;
    const def = BLESSINGS[canonicalId] ?? FLOOR_BUFFS[canonicalId];
    if (def) {
      return i18n.getBuffText(canonicalId, def.nameVi, def.descriptionVi);
    }
    const lookedUp = i18n.getBuffText(canonicalId);
    if (lookedUp.name !== String(canonicalId)) return lookedUp;
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
  const canonicalId = (LEGACY_BUFF_ALIASES[String(buffId)] ?? buffId) as BuffId;
  const bDef = BLESSINGS[canonicalId] ?? FLOOR_BUFFS[canonicalId];
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
 * Draws a compact row of owned Blessing emblem chips for the local player on the HUD.
 */
export function drawPlayerBlessingChipsHud(
  _scene: unknown,
  g: Phaser.GameObjects.Graphics,
  localPlayer: Pick<SimPlayerState, 'blessingIds'> | null | undefined,
  x = 12,
  y = 85,
): number {
  const ids = localPlayer?.blessingIds ?? [];
  if (ids.length === 0) return 0;
  const visibleCount = Math.min(ids.length, 8);
  const chipR = 7.5;
  for (let i = 0; i < visibleCount; i++) {
    const meta = getBuffVisualMeta(ids[i]!, false);
    drawBuffEmblemIcon(g, x + chipR + i * 18, y + chipR, meta.iconKind, meta.borderHex, chipR);
  }
  return visibleCount;
}

/**
 * Renders the 3-card Floor Blessing Choice modal (`sim.runState === 'buff_choice'`).
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

  pendingBuffChoices.forEach((buffId: BuffId, idx: number) => {
    const buffTxt = resolveLocalizedBuffText(buffId, isEn ? 'en' : 'vi');
    const meta = getBuffVisualMeta(buffId, isEn);
    const isHovered = scene.buffHoveredIdx === idx;
    const cardW = 212;
    const cardH = 248;
    const cardX = 148 + idx * 226;
    const cardY = isHovered ? 144 : 149;

    const cardG = ui.add.graphics();
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

    const footerY = cardY + cardH - 34;
    drawStyledPanel(cardG, cardX + 12, footerY, cardW - 24, 24, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.95,
      borderColor: hexToNum(isHovered ? PALETTE.SOLAR_GOLD : meta.borderHex),
      borderWidth: 1.3,
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
        color: meta.borderHex,
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
        color: isHovered ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE,
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
