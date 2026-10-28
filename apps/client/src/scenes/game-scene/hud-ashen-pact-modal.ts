import {
  ALL_ASHEN_PACT_IDS,
  ALL_ASHEN_RELIC_IDS,
  ASHEN_PACTS,
  ASHEN_RELICS,
  PACT_TO_RELIC_ID,
  i18n,
  type AshenPactId,
  type AshenRelicId,
  type SimPlayerState,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { zzfx } from '../../audio/zzfx.js';
import { getFreezeVisualTimeSec, getVisualQueryConfig } from '../../core/visual-query.js';
import type { GameScene } from '../GameScene.js';

const UI_FONT = '"Be Vietnam Pro", "Inter", "Segoe UI", system-ui, sans-serif';
const NUM_CRIMSON = hexToNum(PALETTE.CRIMSON_BRIGHT);
const NUM_GOLD = hexToNum(PALETTE.SOLAR_GOLD);
const NUM_CYAN = hexToNum(PALETTE.CYAN_FROST);
const NUM_VIOLET = hexToNum(PALETTE.ELECTRIC_VIOLET);
const NUM_ORANGE = hexToNum(PALETTE.FLAME_ORANGE);
const NUM_WHITE = hexToNum(PALETTE.BONE_WHITE);

export { ALL_ASHEN_PACT_IDS, ALL_ASHEN_RELIC_IDS };

export interface AshenPactModalHeaderMeta {
  titleText: string;
  subtitleText: string;
  declineButtonText: string;
}

export interface AshenPactChoiceCardMeta {
  pactId: AshenPactId;
  relicId: AshenRelicId;
  choiceIndex: number;
  hotkeyLabel: string;
  trialBadgeText: string;
  pactTitle: string;
  pactCurseDesc: string;
  dividerText: string;
  relicBadgeText: string;
  relicTitle: string;
  relicBenefitDesc: string;
  relicTradeoffDesc: string;
}

export interface AshenPactCardRect {
  x: number;
  y: number;
  w: number;
  h: number;
  topHalfRect: { x: number; y: number; w: number; h: number };
  dividerY: number;
  bottomHalfRect: { x: number; y: number; w: number; h: number };
}

export interface AshenPactModalLayout {
  viewportW: number;
  viewportH: number;
  panelRect: { x: number; y: number; w: number; h: number };
  headerRect: { x: number; y: number; w: number; h: number };
  cards: [AshenPactCardRect, AshenPactCardRect];
  declineBtnRect: { x: number; y: number; w: number; h: number };
}

export interface PlayerPactAndRelicBadgeMeta {
  kind: 'pact' | 'relic';
  id: AshenPactId | AshenRelicId;
  labelText: string;
  subLabelText?: string;
  fillColor: number;
  borderColor: number;
  textColorHex: string;
}

export function isVisualFreezeActive(scene?: unknown): boolean {
  try {
    if (getVisualQueryConfig().freeze) return true;
  } catch {
    // Fallback in non-browser unit tests
  }
  if (scene && typeof scene === 'object') {
    const s = scene as { visualFreeze?: boolean; isVisualFreeze?: boolean };
    if (s.visualFreeze || s.isVisualFreeze) return true;
  }
  return false;
}

export function getVisualTimeMs(scene?: unknown): number {
  if (isVisualFreezeActive(scene)) return getFreezeVisualTimeSec(1.0) * 1000;
  if (scene && typeof scene === 'object') {
    const s = scene as {
      sim?: { tick?: number };
      transport?: { getSim?: () => { tick?: number } };
    };
    const tick = s.sim?.tick ?? s.transport?.getSim?.()?.tick;
    if (typeof tick === 'number' && Number.isFinite(tick)) return (tick * 1000) / 60;
  }
  return 1500;
}

export function formatAshenPactModalHeader(
  isEn = i18n.getLocale() === 'en',
): AshenPactModalHeaderMeta {
  return {
    titleText: isEn ? 'ASHEN PACT ALTAR' : 'TẾ ĐÀN KHẾ ƯỚC TRO TÀN',
    subtitleText: isEn
      ? '1 Altar / Biome — Endure the trial through 2 floors & Boss to awaken a Permanent Relic'
      : '1 Tế Đàn / Biome — Chịu lời nguyền suốt 2 tầng & Boss để thức tỉnh Di Vật Vĩnh Viễn',
    declineButtonText: isEn
      ? '[3] Decline Pact (Keep Armor & Ammo Restore)'
      : '[3] Khước Từ Khế Ước (Chỉ Nhận Hồi Giáp & Đạn)',
  };
}

export function formatAshenPactChoiceCardMeta(
  pactId: AshenPactId,
  choiceIndex = 0,
  isEn = i18n.getLocale() === 'en',
): AshenPactChoiceCardMeta {
  const pact = ASHEN_PACTS[pactId];
  const relicId = PACT_TO_RELIC_ID[pactId] ?? pact.relicId;
  const relic = ASHEN_RELICS[relicId];
  return {
    pactId,
    relicId,
    choiceIndex,
    hotkeyLabel: `[${choiceIndex + 1}]`,
    trialBadgeText: isEn ? '[FULL-BIOME TRIAL]' : '[LỜI NGUYỀN SUỐT BIOME]',
    pactTitle: isEn ? pact.nameEn : pact.nameVi,
    pactCurseDesc: isEn ? pact.curseEn : pact.curseVi,
    dividerText: isEn ? '▼ DEFEAT BIOME BOSS TO AWAKEN ▼' : '▼ HẠ GỤC BOSS BIOME THANH TẨY THÀNH ▼',
    relicBadgeText: isEn ? '[★ AWAKENED RELIC]' : '[★ DI VẬT THỨC TỈNH]',
    relicTitle: isEn ? relic.nameEn : relic.nameVi,
    relicBenefitDesc: isEn ? relic.descEn : relic.descVi,
    relicTradeoffDesc: isEn ? relic.tradeoffEn : relic.tradeoffVi,
  };
}

export function computeAshenPactModalLayout(
  viewportW = 960,
  viewportH = 540,
): AshenPactModalLayout {
  const panelW = 792;
  const panelH = 468;
  const panelX = Math.round((viewportW - panelW) / 2);
  const panelY = Math.round((viewportH - panelH) / 2);
  const headerRect = { x: panelX + 20, y: panelY + 12, w: panelW - 40, h: 54 };
  const cardW = 364;
  const cardH = 334;
  const cardGap = 24;
  const cardsStartX = Math.round(panelX + (panelW - (cardW * 2 + cardGap)) / 2);
  const cardsY = panelY + 72;

  const makeCard = (idx: number): AshenPactCardRect => {
    const x = cardsStartX + idx * (cardW + cardGap);
    const y = cardsY;
    const topH = 148;
    const divH = 22;
    const bottomH = cardH - topH - divH;
    return {
      x,
      y,
      w: cardW,
      h: cardH,
      topHalfRect: { x: x + 8, y: y + 8, w: cardW - 16, h: topH - 10 },
      dividerY: y + topH,
      bottomHalfRect: { x: x + 8, y: y + topH + divH, w: cardW - 16, h: bottomH - 8 },
    };
  };

  const declineW = 460;
  const declineH = 36;
  return {
    viewportW,
    viewportH,
    panelRect: { x: panelX, y: panelY, w: panelW, h: panelH },
    headerRect,
    cards: [makeCard(0), makeCard(1)],
    declineBtnRect: {
      x: Math.round(panelX + (panelW - declineW) / 2),
      y: cardsY + cardH + 12,
      w: declineW,
      h: declineH,
    },
  };
}

export function formatRelicAwakenedBannerText(
  relicId: AshenRelicId,
  isEn = i18n.getLocale() === 'en',
): string {
  const relic = ASHEN_RELICS[relicId];
  const relicName = (isEn ? relic?.nameEn : relic?.nameVi) ?? relicId;
  return isEn
    ? `✦ PACT PURIFIED — RELIC AWAKENED: ${relicName.toUpperCase()}!`
    : `✦ KHẾ ƯỚC THANH TẨY — THỨC TỈNH DI VẬT: ${relicName.toUpperCase()}!`;
}

export function formatPlayerPactAndRelicBadges(
  player: Pick<
    SimPlayerState,
    'activePactId' | 'awakenedRelicIds' | 'pactKeepMorphedWeaponId' | 'pactKeepMorphedTimer'
  >,
  isEn = i18n.getLocale() === 'en',
): PlayerPactAndRelicBadgeMeta[] {
  const badges: PlayerPactAndRelicBadgeMeta[] = [];
  if (player.activePactId && ASHEN_PACTS[player.activePactId]) {
    const pact = ASHEN_PACTS[player.activePactId];
    const name = isEn ? pact.nameEn : pact.nameVi;
    let subLabelText: string | undefined;
    if (player.pactKeepMorphedWeaponId && (player.pactKeepMorphedTimer ?? 0) > 0) {
      const sec = Math.ceil(player.pactKeepMorphedTimer ?? 0);
      subLabelText = isEn ? `+Dual ${sec}s` : `+Song Vũ ${sec}s`;
    }
    badges.push({
      kind: 'pact',
      id: pact.id,
      labelText: `⚠ ${name}`,
      subLabelText,
      fillColor: 0x2a0a14,
      borderColor: 0xf43f5e,
      textColorHex: '#FDA4AF',
    });
  }
  for (const relicId of player.awakenedRelicIds ?? []) {
    const relic = ASHEN_RELICS[relicId];
    if (!relic) continue;
    badges.push({
      kind: 'relic',
      id: relic.id,
      labelText: `★ ${isEn ? relic.nameEn : relic.nameVi}`,
      fillColor: 0x261c06,
      borderColor: 0xfacc15,
      textColorHex: '#FEF08A',
    });
  }
  return badges;
}

export function drawAshenPactEmblem(
  g: Phaser.GameObjects.Graphics,
  pactId: AshenPactId,
  cx: number,
  cy: number,
  r = 15,
): void {
  g.fillStyle(0x1f0913, 0.95);
  g.fillCircle(cx, cy, r);
  g.lineStyle(1.6, NUM_CRIMSON, 0.92);
  g.strokeCircle(cx, cy, r);

  switch (pactId) {
    case 'pact_soul_chain':
      g.lineStyle(2, NUM_CYAN, 0.95);
      g.strokeRoundedRect(cx - r * 0.62, cy - r * 0.28, r * 0.72, r * 0.56, r * 0.22);
      g.lineStyle(2, NUM_CRIMSON, 0.95);
      g.strokeRoundedRect(cx - r * 0.1, cy - r * 0.28, r * 0.72, r * 0.56, r * 0.22);
      g.fillStyle(NUM_GOLD, 0.95);
      g.fillCircle(cx, cy, r * 0.18);
      break;
    case 'pact_shattered_glass':
      g.fillStyle(0x0c4a6e, 0.9);
      g.fillTriangle(cx, cy - r * 0.65, cx - r * 0.55, cy + r * 0.45, cx + r * 0.55, cy + r * 0.45);
      g.lineStyle(1.8, NUM_CYAN, 0.95);
      g.strokeTriangle(cx, cy - r * 0.65, cx - r * 0.55, cy + r * 0.45, cx + r * 0.55, cy + r * 0.45);
      g.lineStyle(1.6, NUM_CRIMSON, 0.95);
      g.lineBetween(cx - r * 0.15, cy - r * 0.4, cx + r * 0.15, cy + r * 0.35);
      break;
    case 'pact_searing_trigger':
      g.fillStyle(NUM_ORANGE, 0.92);
      g.fillTriangle(cx - r * 0.48, cy + r * 0.45, cx, cy - r * 0.68, cx + r * 0.48, cy + r * 0.45);
      g.fillStyle(NUM_GOLD, 0.95);
      g.fillCircle(cx, cy + r * 0.12, r * 0.28);
      g.lineStyle(1.5, NUM_CRIMSON, 0.95);
      g.strokeCircle(cx, cy + r * 0.12, r * 0.42);
      break;
    case 'pact_volatile_arsenal':
      g.fillStyle(0x581c87, 0.9);
      g.fillTriangle(cx, cy - r * 0.65, cx - r * 0.58, cy, cx + r * 0.58, cy);
      g.fillTriangle(cx, cy + r * 0.65, cx - r * 0.58, cy, cx + r * 0.58, cy);
      g.lineStyle(1.6, NUM_VIOLET, 0.95);
      g.strokeCircle(cx, cy, r * 0.48);
      g.fillStyle(NUM_GOLD, 0.95);
      g.fillCircle(cx, cy, r * 0.2);
      break;
    case 'pact_ashen_hunted':
      g.fillStyle(0x3b0764, 0.92);
      g.fillTriangle(cx, cy - r * 0.68, cx + r * 0.48, cy + r * 0.48, cx - r * 0.48, cy + r * 0.48);
      g.lineStyle(2.2, NUM_CRIMSON, 1);
      g.beginPath();
      g.arc(cx, cy - r * 0.08, r * 0.62, -Math.PI * 0.85, Math.PI * 0.15, false);
      g.strokePath();
      break;
    case 'pact_ricochet_vow':
      g.lineStyle(2, NUM_CYAN, 0.95);
      g.lineBetween(cx - r * 0.55, cy + r * 0.4, cx - r * 0.05, cy - r * 0.55);
      g.lineBetween(cx - r * 0.05, cy - r * 0.55, cx + r * 0.58, cy + r * 0.25);
      g.fillStyle(NUM_GOLD, 0.95);
      g.fillCircle(cx - r * 0.05, cy - r * 0.55, r * 0.22);
      break;
  }
}

export function drawAshenRelicEmblem(
  g: Phaser.GameObjects.Graphics,
  relicId: AshenRelicId,
  cx: number,
  cy: number,
  r = 15,
): void {
  g.fillStyle(0x261c06, 0.95);
  g.fillCircle(cx, cy, r);
  g.lineStyle(1.8, NUM_GOLD, 0.95);
  g.strokeCircle(cx, cy, r);

  switch (relicId) {
    case 'relic_blood_oath_tether':
      g.lineStyle(2.5, NUM_ORANGE, 0.95);
      g.lineBetween(cx - r * 0.52, cy + r * 0.32, cx + r * 0.52, cy - r * 0.32);
      g.lineStyle(1.4, NUM_CYAN, 0.95);
      g.lineBetween(cx - r * 0.52, cy - r * 0.15, cx + r * 0.52, cy + r * 0.15);
      g.fillStyle(NUM_GOLD, 1);
      g.fillCircle(cx - r * 0.52, cy + r * 0.32, r * 0.22);
      g.fillCircle(cx + r * 0.52, cy - r * 0.32, r * 0.22);
      break;
    case 'relic_black_crystal_heart':
      g.fillStyle(0x311042, 0.95);
      g.fillTriangle(cx, cy - r * 0.65, cx - r * 0.55, cy, cx + r * 0.55, cy);
      g.fillTriangle(cx, cy + r * 0.65, cx - r * 0.55, cy, cx + r * 0.55, cy);
      g.lineStyle(1.8, NUM_GOLD, 1);
      g.strokeCircle(cx, cy, r * 0.32);
      break;
    case 'relic_perpetual_core':
      g.fillStyle(0x0284c7, 0.92);
      g.fillCircle(cx, cy, r * 0.42);
      g.lineStyle(1.8, NUM_GOLD, 1);
      g.strokeCircle(cx, cy, r * 0.66);
      g.fillStyle(NUM_WHITE, 0.95);
      g.fillCircle(cx, cy, r * 0.18);
      break;
    case 'relic_master_forge_seal':
      g.fillStyle(0x78350f, 0.95);
      g.fillRoundedRect(cx - r * 0.55, cy - r * 0.35, r * 1.1, r * 0.72, 3);
      g.lineStyle(1.6, NUM_GOLD, 1);
      g.strokeRoundedRect(cx - r * 0.55, cy - r * 0.35, r * 1.1, r * 0.72, 3);
      g.fillStyle(NUM_VIOLET, 0.95);
      g.fillCircle(cx, cy, r * 0.24);
      break;
    case 'relic_executioner_scythe':
      g.lineStyle(2.4, NUM_GOLD, 1);
      g.lineBetween(cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55);
      g.lineBetween(cx + r * 0.55, cy - r * 0.55, cx - r * 0.55, cy + r * 0.55);
      g.lineStyle(1.6, NUM_CRIMSON, 0.95);
      g.strokeCircle(cx, cy, r * 0.34);
      break;
    case 'relic_ancient_geometry_eye':
      g.lineStyle(1.8, NUM_GOLD, 0.98);
      g.strokeTriangle(cx, cy - r * 0.62, cx - r * 0.58, cy + r * 0.46, cx + r * 0.58, cy + r * 0.46);
      g.fillStyle(NUM_CYAN, 0.95);
      g.fillCircle(cx, cy + r * 0.08, r * 0.24);
      break;
  }
}

export function renderAshenPactAltarModal(
  scene: GameScene,
  localPlayer: SimPlayerState,
  isEn: boolean,
  textRes: number,
): void {
  const sim = scene.transport?.getSim();
  const ui = (scene.uiScene ?? scene) as Phaser.Scene;
  const choices = localPlayer.pactChoices ?? [];
  if (!sim || !ui?.add || choices.length === 0) return;

  const layout = computeAshenPactModalLayout(960, 540);
  const headerMeta = formatAshenPactModalHeader(isEn);
  const { panelRect, headerRect, declineBtnRect } = layout;

  const choosePactOrDecline = (pactIdOrDecline: AshenPactId | 'decline') => {
    if (sim.selectAshenPact(pactIdOrDecline, localPlayer.id)) {
      scene.room?.send('select_pact', { pactId: pactIdOrDecline });
      zzfx.play(pactIdOrDecline === 'decline' ? 'ui_click' : 'skill_cast');
      scene.buffHoveredIdx = null;
      scene.lastRunState = '';
    }
  };

  const modalBg = ui.add.graphics();
  modalBg.fillStyle(0x06040a, 0.84);
  modalBg.fillRect(-480, -270, 1920, 1080);
  modalBg.fillStyle(0x120e1a, 0.97);
  modalBg.fillRoundedRect(panelRect.x, panelRect.y, panelRect.w, panelRect.h, 12);
  modalBg.lineStyle(2.5, NUM_CRIMSON, 0.92);
  modalBg.strokeRoundedRect(panelRect.x, panelRect.y, panelRect.w, panelRect.h, 12);
  modalBg.lineStyle(1, NUM_GOLD, 0.45);
  modalBg.strokeRoundedRect(panelRect.x + 5, panelRect.y + 5, panelRect.w - 10, panelRect.h - 10, 9);
  modalBg.fillStyle(0x1d0f24, 0.94);
  modalBg.fillRoundedRect(headerRect.x, headerRect.y, headerRect.w, headerRect.h, 8);
  modalBg.lineStyle(1.2, NUM_CRIMSON, 0.55);
  modalBg.strokeRoundedRect(headerRect.x, headerRect.y, headerRect.w, headerRect.h, 8);
  scene.modalContainer.add(modalBg);

  const titleTxt = ui.add
    .text(480, headerRect.y + 18, `✦ ${headerMeta.titleText} ✦`, {
      fontFamily: UI_FONT,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#FDA4AF',
      stroke: '#09050E',
      strokeThickness: 3,
      resolution: textRes,
    })
    .setOrigin(0.5);
  const subTxt = ui.add
    .text(480, headerRect.y + 39, headerMeta.subtitleText, {
      fontFamily: UI_FONT,
      fontSize: '10.5px',
      color: '#E2E8F0',
      resolution: textRes,
    })
    .setOrigin(0.5);
  scene.modalContainer.add([titleTxt, subTxt]);

  choices.slice(0, 2).forEach((pactId, idx) => {
    const cardRect = layout.cards[idx];
    if (!cardRect || !ASHEN_PACTS[pactId]) return;
    const meta = formatAshenPactChoiceCardMeta(pactId, idx, isEn);
    const isHovered = scene.buffHoveredIdx === idx;
    const { x, y, w, h, topHalfRect, dividerY, bottomHalfRect } = cardRect;

    const cardG = ui.add.graphics();
    cardG.fillStyle(isHovered ? 0x1c1428 : 0x161020, 0.98);
    cardG.fillRoundedRect(x, y, w, h, 10);
    cardG.lineStyle(isHovered ? 2.6 : 1.8, isHovered ? NUM_GOLD : NUM_CRIMSON, 0.95);
    cardG.strokeRoundedRect(x, y, w, h, 10);

    // Top Half — The Trial (Crimson)
    cardG.fillStyle(0x280c17, 0.92);
    cardG.fillRoundedRect(topHalfRect.x, topHalfRect.y, topHalfRect.w, topHalfRect.h, 7);
    cardG.lineStyle(1.2, NUM_CRIMSON, isHovered ? 0.88 : 0.55);
    cardG.strokeRoundedRect(topHalfRect.x, topHalfRect.y, topHalfRect.w, topHalfRect.h, 7);
    cardG.fillStyle(0x4c0519, 0.95);
    cardG.fillRoundedRect(x + 16, y + 14, 178, 18, 4);
    cardG.lineStyle(1, NUM_CRIMSON, 0.9);
    cardG.strokeRoundedRect(x + 16, y + 14, 178, 18, 4);

    // Hotkey chip & Divider Strip
    cardG.fillStyle(0x0f0a16, 0.95);
    cardG.fillRoundedRect(x + w - 46, y + 13, 30, 20, 5);
    cardG.lineStyle(1.2, isHovered ? NUM_GOLD : NUM_CRIMSON, 0.95);
    cardG.strokeRoundedRect(x + w - 46, y + 13, 30, 20, 5);
    cardG.fillStyle(0x23190c, 0.96);
    cardG.fillRoundedRect(x + 14, dividerY, w - 28, 20, 4);
    cardG.lineStyle(1, NUM_GOLD, 0.68);
    cardG.strokeRoundedRect(x + 14, dividerY, w - 28, 20, 4);

    // Bottom Half — Awakened Relic (Gold)
    cardG.fillStyle(0x211807, 0.92);
    cardG.fillRoundedRect(bottomHalfRect.x, bottomHalfRect.y, bottomHalfRect.w, bottomHalfRect.h, 7);
    cardG.lineStyle(1.3, NUM_GOLD, isHovered ? 0.95 : 0.65);
    cardG.strokeRoundedRect(bottomHalfRect.x, bottomHalfRect.y, bottomHalfRect.w, bottomHalfRect.h, 7);
    cardG.fillStyle(0x422006, 0.95);
    cardG.fillRoundedRect(x + 16, bottomHalfRect.y + 6, 168, 18, 4);
    cardG.lineStyle(1, NUM_GOLD, 0.9);
    cardG.strokeRoundedRect(x + 16, bottomHalfRect.y + 6, 168, 18, 4);

    drawAshenPactEmblem(cardG, meta.pactId, x + 34, y + 54, 15);
    drawAshenRelicEmblem(cardG, meta.relicId, x + 34, bottomHalfRect.y + 46, 15);
    scene.modalContainer.add(cardG);

    const addTxt = (
      tx: number,
      ty: number,
      str: string,
      size: string,
      color: string,
      bold = false,
      wrapW?: number,
      ox = 0,
      oy = 0,
    ) =>
      ui.add
        .text(tx, ty, str, {
          fontFamily: UI_FONT,
          fontSize: size,
          fontStyle: bold ? 'bold' : 'normal',
          color,
          lineSpacing: 2,
          wordWrap: wrapW ? { width: wrapW, useAdvancedWrap: true } : undefined,
          resolution: textRes,
        })
        .setOrigin(ox, oy);

    const trialBadgeTxt = addTxt(x + 22, y + 23, meta.trialBadgeText, '9px', '#FDA4AF', true, undefined, 0, 0.5);
    const hkTxt = addTxt(x + w - 31, y + 23, meta.hotkeyLabel, '11px', '#FACC15', true, undefined, 0.5, 0.5);
    const pactTitleTxt = addTxt(x + 56, y + 42, meta.pactTitle, '13px', '#FFE4E6', true, w - 76);
    const pactDescTxt = addTxt(x + 18, y + 74, meta.pactCurseDesc, '10px', '#FECDD3', false, w - 36);
    const divTxt = addTxt(x + w / 2, dividerY + 10, meta.dividerText, '9px', '#FDE047', true, undefined, 0.5, 0.5);
    const relicBadgeTxt = addTxt(x + 22, bottomHalfRect.y + 15, meta.relicBadgeText, '9px', '#FEF08A', true, undefined, 0, 0.5);
    const relicTitleTxt = addTxt(x + 56, bottomHalfRect.y + 32, meta.relicTitle, '13px', '#FACC15', true, w - 76);
    const relicDescTxt = addTxt(x + 18, bottomHalfRect.y + 64, meta.relicBenefitDesc, '10px', '#FEF9C3', false, w - 36);
    const tradeoffTxt = addTxt(x + 18, bottomHalfRect.y + 122, `⚖ ${meta.relicTradeoffDesc}`, '9.5px', '#F59E0B', true, w - 36);

    const hitZone = ui.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hitZone.on('pointerover', () => {
      if (scene.buffHoveredIdx !== idx) {
        scene.buffHoveredIdx = idx;
        scene.lastRunState = '';
      }
    });
    hitZone.on('pointerout', () => {
      if (scene.buffHoveredIdx === idx) {
        scene.buffHoveredIdx = null;
        scene.lastRunState = '';
      }
    });
    hitZone.on('pointerdown', () => choosePactOrDecline(pactId));
    scene.modalContainer.add([
      trialBadgeTxt, hkTxt, pactTitleTxt, pactDescTxt, divTxt,
      relicBadgeTxt, relicTitleTxt, relicDescTxt, tradeoffTxt, hitZone,
    ]);
  });

  // Decline Pact Button ([3])
  const isDeclineHovered = scene.buffHoveredIdx === 2;
  const decG = ui.add.graphics();
  decG.fillStyle(isDeclineHovered ? 0x1e293b : 0x0f172a, 0.95);
  decG.fillRoundedRect(declineBtnRect.x, declineBtnRect.y, declineBtnRect.w, declineBtnRect.h, 7);
  decG.lineStyle(1.5, isDeclineHovered ? 0x94a3b8 : 0x475569, 0.95);
  decG.strokeRoundedRect(declineBtnRect.x, declineBtnRect.y, declineBtnRect.w, declineBtnRect.h, 7);
  scene.modalContainer.add(decG);

  const decCx = declineBtnRect.x + declineBtnRect.w / 2;
  const decCy = declineBtnRect.y + declineBtnRect.h / 2;
  const decTxt = ui.add
    .text(decCx, decCy, headerMeta.declineButtonText, {
      fontFamily: UI_FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: isDeclineHovered ? '#F8FAFC' : '#CBD5E1',
      resolution: textRes,
    })
    .setOrigin(0.5);
  const decZone = ui.add
    .zone(decCx, decCy, declineBtnRect.w, declineBtnRect.h)
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  decZone.on('pointerover', () => {
    if (scene.buffHoveredIdx !== 2) {
      scene.buffHoveredIdx = 2;
      scene.lastRunState = '';
    }
  });
  decZone.on('pointerout', () => {
    if (scene.buffHoveredIdx === 2) {
      scene.buffHoveredIdx = null;
      scene.lastRunState = '';
    }
  });
  decZone.on('pointerdown', () => choosePactOrDecline('decline'));
  scene.modalContainer.add([decTxt, decZone]);
}

export function drawPlayerPactAndRelicHudBadges(
  scene: GameScene,
  g: Phaser.GameObjects.Graphics,
  player: SimPlayerState,
  startX = 12,
  startY = 104,
  isEn = i18n.getLocale() === 'en',
): number {
  const badges = formatPlayerPactAndRelicBadges(player, isEn);
  const extScene = scene as GameScene & { pactRelicHudText?: Phaser.GameObjects.Text };

  if (badges.length === 0) {
    if (extScene.pactRelicHudText?.visible) extScene.pactRelicHudText.setVisible(false);
    return 0;
  }

  let curX = startX;
  for (const badge of badges) {
    if (badge.kind === 'pact') {
      drawAshenPactEmblem(g, badge.id as AshenPactId, curX + 8, startY + 8, 7.5);
    } else {
      drawAshenRelicEmblem(g, badge.id as AshenRelicId, curX + 8, startY + 8, 7.5);
    }
    curX += 18;
  }

  const summaryStr = badges
    .map((b) => (b.subLabelText ? `${b.labelText} (${b.subLabelText})` : b.labelText))
    .join(' · ');
  const pillW = Math.min(240, Math.max(88, Math.round(summaryStr.length * 5.2 + 16)));
  const primaryBadge = badges[0]!;

  g.fillStyle(primaryBadge.fillColor, 0.92);
  g.fillRoundedRect(curX, startY, pillW, 16, 4);
  g.lineStyle(1.2, primaryBadge.borderColor, 0.92);
  g.strokeRoundedRect(curX, startY, pillW, 16, 4);

  if (scene?.uiScene?.add && scene.hudTopLeftContainer) {
    if (!extScene.pactRelicHudText) {
      extScene.pactRelicHudText = scene.uiScene.add
        .text(curX + 6, startY + 8, summaryStr, {
          fontFamily: UI_FONT,
          fontSize: '9.5px',
          fontStyle: 'bold',
          color: primaryBadge.textColorHex,
          stroke: '#09050E',
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5);
      scene.hudTopLeftContainer.add(extScene.pactRelicHudText);
    } else {
      extScene.pactRelicHudText.setPosition(curX + 6, startY + 8);
      if (extScene.pactRelicHudText.text !== summaryStr) extScene.pactRelicHudText.setText(summaryStr);
      extScene.pactRelicHudText.setColor(primaryBadge.textColorHex);
      if (!extScene.pactRelicHudText.visible) extScene.pactRelicHudText.setVisible(true);
    }
  }
  return badges.length;
}

export function triggerRelicAwakenedBanner(
  scene: GameScene,
  relicId: AshenRelicId,
  isEn = i18n.getLocale() === 'en',
): void {
  scene.hudBannerTextStr = formatRelicAwakenedBannerText(relicId, isEn);
  scene.hudBannerAccentColor = NUM_GOLD;
  scene.hudBannerTimer = 4.0;
}
