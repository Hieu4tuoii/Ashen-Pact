import type Phaser from 'phaser';
import {
  MAX_MUTATORS_PER_WEAPON_SLOT,
  WEAPONS,
  WEAPON_MUTATORS,
  WEAPON_SALVAGE_GOLD,
  WEAPON_SALVAGE_HOLD_SEC,
  findSalvageableWeaponNearPlayer,
  getActiveSlotMutators,
  i18n,
  type SimEvent,
  type SimPlayerState,
  type SimWorldItemState,
  type WeaponMutatorId,
  type WorldSim,
} from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { zzfx } from '../../audio/zzfx.js';
import type { GameScene } from '../GameScene.js';

type WeaponId = keyof typeof WEAPONS;

const UI_FONT_FAMILY = '"Be Vietnam Pro", "Inter", "Segoe UI", system-ui, sans-serif';

const NUM_SOLAR_GOLD = hexToNum(PALETTE.SOLAR_GOLD);
const NUM_FLAME_ORANGE = hexToNum(PALETTE.FLAME_ORANGE);
const NUM_CYAN_FROST = hexToNum(PALETTE.CYAN_FROST);
const NUM_AZURE_CORE = hexToNum(PALETTE.AZURE_CORE);
const NUM_ELECTRIC_VIOLET = hexToNum(PALETTE.ELECTRIC_VIOLET);
const NUM_TOXIC_PURPLE = hexToNum(PALETTE.TOXIC_PURPLE);
const NUM_CRIMSON_BRIGHT = hexToNum(PALETTE.CRIMSON_BRIGHT);
const NUM_BONE_WHITE = hexToNum(PALETTE.BONE_WHITE);
const NUM_SLATE_DARK = hexToNum(PALETTE.SLATE_DARK);

const MUTATOR_COLOR_TABLE: Partial<
  Record<WeaponMutatorId, { borderColor: number; accentHex: string; badgeBgColor: number }>
> = {
  mutator_finale_jolt: { borderColor: NUM_SOLAR_GOLD, accentHex: '#FBBF24', badgeBgColor: 0x3b2506 },
  mutator_gravity_singularity: {
    borderColor: NUM_ELECTRIC_VIOLET,
    accentHex: '#A78BFA',
    badgeBgColor: 0x261347,
  },
  mutator_shockwave_edge: {
    borderColor: NUM_FLAME_ORANGE,
    accentHex: '#FB923C',
    badgeBgColor: 0x3d1908,
  },
  mutator_chain_harpoon: {
    borderColor: NUM_CYAN_FROST,
    accentHex: '#22D3EE',
    badgeBgColor: 0x082f3d,
  },
  mutator_prism_splitter: {
    borderColor: NUM_AZURE_CORE,
    accentHex: '#38BDF8',
    badgeBgColor: 0x0c2944,
  },
  mutator_thermal_meltdown: {
    borderColor: NUM_CRIMSON_BRIGHT,
    accentHex: '#FB7185',
    badgeBgColor: 0x3f0d1d,
  },
};

export interface DaedalusModalHeaderSpec {
  title: string;
  subtitle: string;
  footerHint: string;
  activeWeaponId: WeaponId;
  activeWeaponName: string;
  upgradeLevel: number;
  attachedCount: number;
  maxMutators: number;
}

export interface MutatorChoiceCardMeta {
  id: WeaponMutatorId;
  name: string;
  desc: string;
  compatibilityBadge: string;
  accentHex: string;
  borderColor: number;
  badgeBgColor: number;
  hotkeyLabel: string;
}

export interface WeaponSalvageHudState {
  canSalvage: boolean;
  targetItem: SimWorldItemState | null;
  goldValue: number;
  holdSec: number;
  progress: number;
  percent: number;
  promptText: string;
}

export function formatDaedalusModalHeader(
  player: SimPlayerState,
  isEn = i18n.getLocale() === 'en',
): DaedalusModalHeaderSpec {
  const activeSlot = player.activeWeaponSlot ?? 0;
  const activeWeaponId = (player.weaponSlots?.[activeSlot] ?? 'pistol') as WeaponId;
  const fallbackDef = Object.values(WEAPONS)[0]!;
  const wepDef = WEAPONS[activeWeaponId] ?? fallbackDef;
  const rawWepName = isEn ? i18n.weaponName(wepDef.id, wepDef.nameVi) : wepDef.nameVi;
  const upgradeLevel = player.weaponUpgradeLevels?.[activeSlot] ?? 0;
  const attachedCount = getActiveSlotMutators(player).length;
  const wepLabel = upgradeLevel > 0 ? `${rawWepName} +${upgradeLevel}` : rawWepName;

  return {
    title: isEn
      ? 'ANCIENT DAEDALUS ANVIL — SELECT WEAPON MUTATOR'
      : 'ĐE RÈN CỔ ĐẠI DAEDALUS — CHỌN BẢN ĐỘ VŨ KHÍ',
    subtitle: isEn
      ? `Equipped Weapon: ${wepLabel} · Mutator Slots: ${attachedCount}/${MAX_MUTATORS_PER_WEAPON_SLOT}`
      : `Vũ khí đang cầm: ${wepLabel} · Ô Độ Súng: ${attachedCount}/${MAX_MUTATORS_PER_WEAPON_SLOT} Mutator`,
    footerHint: isEn
      ? 'Press [1] / [2] or click a card to forge Mutator onto your active weapon'
      : 'Nhấn phím [1] / [2] hoặc Click chuột vào thẻ để khảm Bản Độ vào vũ khí đang cầm',
    activeWeaponId: wepDef.id,
    activeWeaponName: rawWepName,
    upgradeLevel,
    attachedCount,
    maxMutators: MAX_MUTATORS_PER_WEAPON_SLOT,
  };
}

export function formatMutatorChoiceCardMeta(
  mutatorId: WeaponMutatorId,
  index = 0,
  isEn = i18n.getLocale() === 'en',
): MutatorChoiceCardMeta {
  const def = WEAPON_MUTATORS[mutatorId];
  const cadences = def?.compatibleCadences ?? ['CLIP_RELOAD', 'HEAT_VENT'];
  const hasClip = cadences.some((c) => c.toUpperCase().startsWith('CLIP'));
  const hasHeat = cadences.some((c) => c.toUpperCase().startsWith('HEAT'));
  const hasMelee = cadences.some((c) => c.toUpperCase().startsWith('MELEE'));

  const compatibilityBadge =
    hasClip && hasHeat && hasMelee
      ? 'CLIP / HEAT / MELEE'
      : hasMelee && !hasClip && !hasHeat
        ? 'MELEE COMBO'
        : hasClip && hasHeat
          ? 'CLIP / HEAT'
          : cadences.map((c) => c.toUpperCase()).join(' / ');

  const theme = MUTATOR_COLOR_TABLE[mutatorId] ?? {
    borderColor: NUM_SOLAR_GOLD,
    accentHex: '#FBBF24',
    badgeBgColor: 0x3b2506,
  };

  return {
    id: mutatorId,
    name: isEn ? (def?.nameEn ?? mutatorId) : (def?.nameVi ?? mutatorId),
    desc: isEn ? (def?.descEn ?? '') : (def?.descVi ?? ''),
    compatibilityBadge,
    accentHex: theme.accentHex,
    borderColor: theme.borderColor,
    badgeBgColor: theme.badgeBgColor,
    hotkeyLabel: isEn ? `[${index + 1}] Select` : `[${index + 1}] Chọn`,
  };
}

export function computeWeaponSalvageHudState(
  sim: WorldSim,
  player: SimPlayerState,
  isEn = i18n.getLocale() === 'en',
): WeaponSalvageHudState {
  const targetItem = findSalvageableWeaponNearPlayer(sim, player);
  if (!targetItem || !targetItem.weaponId) {
    return {
      canSalvage: false,
      targetItem: null,
      goldValue: 0,
      holdSec: WEAPON_SALVAGE_HOLD_SEC,
      progress: 0,
      percent: 0,
      promptText: '',
    };
  }
  const wepDef = WEAPONS[targetItem.weaponId];
  const rarity = targetItem.rarity ?? wepDef?.rarity ?? 'common';
  const goldValue = WEAPON_SALVAGE_GOLD[rarity] ?? 15;
  const rawHold = Math.max(0, player.salvageHoldTimer ?? 0);
  const progress = Math.max(0, Math.min(1, rawHold / WEAPON_SALVAGE_HOLD_SEC));
  const percent = Math.round(progress * 100);
  const promptText = isEn
    ? `[X] Hold 0.5s Salvage (+${goldValue} Gold)`
    : `[X] Giữ 0.5s Phân Rã (+${goldValue} Vàng)`;

  return {
    canSalvage: true,
    targetItem,
    goldValue,
    holdSec: WEAPON_SALVAGE_HOLD_SEC,
    progress,
    percent,
    promptText,
  };
}

export function formatWeaponCardSlotTitle(
  rawWeaponName: string,
  upgradeLevel: number,
  isSelected: boolean,
): string {
  const suffix = upgradeLevel > 0 ? ` +${upgradeLevel}` : '';
  if (isSelected) return `${rawWeaponName}${suffix}`;
  const maxBaseLen = suffix.length > 0 ? 10 : 12;
  const base =
    rawWeaponName.length > maxBaseLen ? `${rawWeaponName.slice(0, maxBaseLen - 1)}…` : rawWeaponName;
  return `${base}${suffix}`;
}

export function drawWeaponMutatorEmblem(
  g: Phaser.GameObjects.Graphics,
  mutatorId: WeaponMutatorId,
  cx: number,
  cy: number,
  radius = 22,
): void {
  const meta = formatMutatorChoiceCardMeta(mutatorId, 0, false);
  g.fillStyle(0x090d16, 0.94);
  g.fillCircle(cx, cy, radius);
  g.lineStyle(2, meta.borderColor, 0.95);
  g.strokeCircle(cx, cy, radius);
  g.lineStyle(1, NUM_BONE_WHITE, 0.25);
  g.strokeCircle(cx, cy, radius - 3);

  switch (mutatorId) {
    case 'mutator_finale_jolt':
      g.fillStyle(NUM_SOLAR_GOLD, 0.95);
      g.beginPath();
      g.moveTo(cx + 3, cy - 13);
      g.lineTo(cx - 7, cy + 1);
      g.lineTo(cx - 1, cy + 1);
      g.lineTo(cx - 4, cy + 13);
      g.lineTo(cx + 8, cy - 2);
      g.lineTo(cx + 1, cy - 2);
      g.closePath();
      g.fillPath();
      g.fillStyle(NUM_BONE_WHITE, 0.9);
      g.fillCircle(cx - 10, cy - 8, 2);
      g.fillCircle(cx + 10, cy + 8, 2);
      break;
    case 'mutator_gravity_singularity':
      g.lineStyle(2, NUM_ELECTRIC_VIOLET, 0.9);
      g.strokeCircle(cx, cy, 12);
      g.lineStyle(1.5, NUM_TOXIC_PURPLE, 0.85);
      g.strokeCircle(cx, cy, 7);
      g.fillStyle(0x05030a, 1);
      g.fillCircle(cx, cy, 4.5);
      g.lineStyle(1.5, NUM_BONE_WHITE, 0.85);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        g.lineBetween(
          cx + Math.cos(a) * 14,
          cy + Math.sin(a) * 14,
          cx + Math.cos(a) * 7,
          cy + Math.sin(a) * 7,
        );
      }
      break;
    case 'mutator_shockwave_edge':
      g.lineStyle(2.5, NUM_FLAME_ORANGE, 0.95);
      g.beginPath();
      g.arc(cx - 2, cy, 10, -Math.PI * 0.42, Math.PI * 0.42, false);
      g.strokePath();
      g.lineStyle(2, NUM_SOLAR_GOLD, 0.9);
      g.beginPath();
      g.arc(cx + 2, cy, 14, -Math.PI * 0.36, Math.PI * 0.36, false);
      g.strokePath();
      g.fillStyle(NUM_BONE_WHITE, 0.95);
      g.fillTriangle(cx - 11, cy + 8, cx + 3, cy - 9, cx - 4, cy + 9);
      break;
    case 'mutator_chain_harpoon':
      g.lineStyle(2, NUM_CYAN_FROST, 0.9);
      g.lineBetween(cx - 11, cy + 11, cx + 8, cy - 8);
      g.fillStyle(NUM_BONE_WHITE, 0.95);
      g.fillTriangle(cx + 12, cy - 12, cx + 2, cy - 9, cx + 9, cy - 2);
      g.lineStyle(1.5, NUM_AZURE_CORE, 0.85);
      g.strokeCircle(cx - 8, cy + 8, 3);
      g.strokeCircle(cx - 3, cy + 3, 3);
      break;
    case 'mutator_prism_splitter':
      g.fillStyle(NUM_AZURE_CORE, 0.88);
      g.fillTriangle(cx, cy - 11, cx - 9, cy + 5, cx + 9, cy + 5);
      g.lineStyle(1.8, NUM_CYAN_FROST, 0.95);
      g.lineBetween(cx, cy - 2, cx - 12, cy - 10);
      g.lineBetween(cx, cy - 2, cx, cy - 14);
      g.lineBetween(cx, cy - 2, cx + 12, cy - 10);
      g.fillStyle(NUM_BONE_WHITE, 0.95);
      g.fillCircle(cx, cy, 2.5);
      break;
    case 'mutator_thermal_meltdown':
      g.fillStyle(NUM_CRIMSON_BRIGHT, 0.9);
      g.fillCircle(cx, cy + 2, 9);
      g.fillStyle(NUM_FLAME_ORANGE, 0.95);
      g.fillTriangle(cx - 7, cy + 3, cx, cy - 13, cx + 7, cy + 3);
      g.fillStyle(NUM_SOLAR_GOLD, 0.95);
      g.fillCircle(cx, cy + 3, 4.5);
      break;
    default:
      g.fillStyle(NUM_SOLAR_GOLD, 0.92);
      g.fillTriangle(cx, cy - 11, cx - 10, cy + 8, cx + 10, cy + 8);
      g.fillStyle(NUM_BONE_WHITE, 0.9);
      g.fillCircle(cx, cy + 1, 3.5);
      break;
  }
}

export function renderDaedalusAnvilModal(
  scene: GameScene,
  localPlayer: SimPlayerState,
  isEn: boolean,
  textRes: number,
): void {
  const sim = scene.transport?.getSim();
  const ui = (scene.uiScene ?? scene) as Phaser.Scene;
  const choices = localPlayer.mutatorChoices ?? [];
  if (!sim || !ui?.add || choices.length === 0) return;

  const header = formatDaedalusModalHeader(localPlayer, isEn);
  const modalX = 148;
  const modalY = 82;
  const modalW = 664;
  const modalH = 376;

  const modalBg = ui.add.graphics();
  modalBg.fillStyle(0x04070d, 0.76);
  modalBg.fillRect(-480, -270, 1920, 1080);
  modalBg.fillStyle(NUM_SLATE_DARK, 0.97);
  modalBg.fillRoundedRect(modalX, modalY, modalW, modalH, 12);
  modalBg.fillStyle(0x1e160c, 0.92);
  modalBg.fillRoundedRect(modalX + 4, modalY + 4, modalW - 8, 62, 9);
  modalBg.lineStyle(2.5, NUM_SOLAR_GOLD, 0.95);
  modalBg.strokeRoundedRect(modalX, modalY, modalW, modalH, 12);
  modalBg.lineStyle(1, NUM_FLAME_ORANGE, 0.45);
  modalBg.strokeRoundedRect(modalX + 5, modalY + 5, modalW - 10, modalH - 10, 9);
  scene.modalContainer.add(modalBg);

  const titleTxt = ui.add
    .text(480, modalY + 24, header.title, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#FDE68A',
      stroke: '#090D16',
      strokeThickness: 3,
      resolution: textRes,
    })
    .setOrigin(0.5);
  const subTxt = ui.add
    .text(480, modalY + 48, header.subtitle, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '11px',
      color: '#E2E8F0',
      resolution: textRes,
    })
    .setOrigin(0.5);
  scene.modalContainer.add([titleTxt, subTxt]);

  const count = Math.min(2, choices.length);
  const cardW = 288;
  const cardH = 248;
  const gap = 24;
  const startX = 480 - (count * cardW + (count - 1) * gap) / 2;
  const cardY = modalY + 78;

  choices.slice(0, 2).forEach((mutatorId, idx) => {
    const meta = formatMutatorChoiceCardMeta(mutatorId, idx, isEn);
    const x = startX + idx * (cardW + gap);
    const cx = x + cardW / 2;
    const isHovered = scene.buffHoveredIdx === idx;

    const cardG = ui.add.graphics();
    cardG.fillStyle(isHovered ? 0x172033 : 0x0d1322, 0.96);
    cardG.fillRoundedRect(x, cardY, cardW, cardH, 10);
    cardG.lineStyle(isHovered ? 3 : 2, isHovered ? NUM_BONE_WHITE : meta.borderColor, 0.96);
    cardG.strokeRoundedRect(x, cardY, cardW, cardH, 10);

    const badgeW = Math.max(116, meta.compatibilityBadge.length * 7 + 20);
    cardG.fillStyle(meta.badgeBgColor, 0.95);
    cardG.fillRoundedRect(cx - badgeW / 2, cardY + 68, badgeW, 18, 5);
    cardG.lineStyle(1, meta.borderColor, 0.85);
    cardG.strokeRoundedRect(cx - badgeW / 2, cardY + 68, badgeW, 18, 5);

    cardG.fillStyle(isHovered ? meta.borderColor : 0x1e293b, isHovered ? 0.92 : 0.9);
    cardG.fillRoundedRect(cx - 56, cardY + cardH - 32, 112, 22, 5);
    cardG.lineStyle(1.2, meta.borderColor, 0.9);
    cardG.strokeRoundedRect(cx - 56, cardY + cardH - 32, 112, 22, 5);

    drawWeaponMutatorEmblem(cardG, mutatorId, cx, cardY + 36, 22);
    scene.modalContainer.add(cardG);

    const badgeTxt = ui.add
      .text(cx, cardY + 77, meta.compatibilityBadge, {
        fontFamily: UI_FONT_FAMILY,
        fontSize: '9px',
        fontStyle: 'bold',
        color: meta.accentHex,
        resolution: textRes,
      })
      .setOrigin(0.5);
    const nameTxt = ui.add
      .text(cx, cardY + 106, meta.name, {
        fontFamily: UI_FONT_FAMILY,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#F8FAFC',
        align: 'center',
        wordWrap: { width: cardW - 28, useAdvancedWrap: true },
        resolution: textRes,
      })
      .setOrigin(0.5);
    const descTxt = ui.add
      .text(cx, cardY + 162, meta.desc, {
        fontFamily: UI_FONT_FAMILY,
        fontSize: '11px',
        color: '#CBD5E1',
        align: 'center',
        lineSpacing: 3,
        wordWrap: { width: cardW - 32, useAdvancedWrap: true },
        resolution: textRes,
      })
      .setOrigin(0.5);
    const keyTxt = ui.add
      .text(cx, cardY + cardH - 21, meta.hotkeyLabel, {
        fontFamily: UI_FONT_FAMILY,
        fontSize: '11px',
        fontStyle: 'bold',
        color: isHovered ? '#090D16' : '#FDE68A',
        resolution: textRes,
      })
      .setOrigin(0.5);

    const hitZone = ui.add
      .zone(cx, cardY + cardH / 2, cardW, cardH)
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
    hitZone.on('pointerdown', () => {
      if (sim.selectWeaponMutator(mutatorId, localPlayer.id)) {
        scene.room?.send('select_mutator', { mutatorId });
        zzfx.play('pickup');
        scene.buffHoveredIdx = null;
        scene.lastRunState = '';
      }
    });

    scene.modalContainer.add([badgeTxt, nameTxt, descTxt, keyTxt, hitZone]);
  });

  const footerTxt = ui.add
    .text(480, modalY + modalH - 18, header.footerHint, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '11px',
      color: '#FDE68A',
      resolution: textRes,
    })
    .setOrigin(0.5);
  scene.modalContainer.add(footerTxt);
}

export function drawWeaponSlotMutatorGems(
  g: Phaser.GameObjects.Graphics,
  sx: number,
  sy: number,
  cardW: number,
  cardH: number,
  mutatorIds: readonly WeaponMutatorId[],
  upgradeLevel: number,
  isSelected: boolean,
): void {
  if (upgradeLevel > 0 || mutatorIds.length > 0) {
    g.lineStyle(isSelected ? 1.5 : 1, NUM_SOLAR_GOLD, isSelected ? 0.85 : 0.45);
    g.strokeRoundedRect(sx + 1, sy + 1, cardW - 2, cardH - 2, isSelected ? 7 : 5);
  }
  for (let i = 0; i < Math.min(MAX_MUTATORS_PER_WEAPON_SLOT, mutatorIds.length); i++) {
    const gx = sx + cardW - 10 - i * 10;
    const gy = sy + cardH - 8;
    const meta = formatMutatorChoiceCardMeta(mutatorIds[i]!, i, false);
    g.fillStyle(0x090d16, 0.95);
    g.fillCircle(gx, gy, 4.2);
    g.fillStyle(meta.borderColor, 0.98);
    g.fillCircle(gx, gy, 2.8);
  }
}

export function renderWeaponCompareSalvageBar(
  scene: GameScene,
  bg: Phaser.GameObjects.Graphics,
  sim: WorldSim,
  localPlayer: SimPlayerState,
  px: number,
  py: number,
  pw: number,
  ph: number,
  isEn: boolean,
  textRes: number,
): boolean {
  const state = computeWeaponSalvageHudState(sim, localPlayer, isEn);
  if (!state.canSalvage) return false;
  const ui = (scene.uiScene ?? scene) as Phaser.Scene;
  const barX = px + 10;
  const barY = py + ph - 21;
  const barW = pw - 20;
  const barH = 15;

  bg.fillStyle(0x090d16, 0.94);
  bg.fillRoundedRect(barX, barY, barW, barH, 4);
  if (state.progress > 0) {
    const fillW = Math.max(6, Math.round(barW * state.progress));
    bg.fillStyle(NUM_FLAME_ORANGE, 0.9);
    bg.fillRoundedRect(barX, barY, fillW, barH, 4);
    bg.fillStyle(NUM_SOLAR_GOLD, 0.85);
    bg.fillRoundedRect(barX, barY, fillW, Math.max(4, Math.floor(barH * 0.45)), 3);
  }
  bg.lineStyle(1.2, state.progress > 0 ? NUM_SOLAR_GOLD : NUM_FLAME_ORANGE, 0.9);
  bg.strokeRoundedRect(barX, barY, barW, barH, 4);

  const label = state.progress > 0 ? `${state.promptText} · ${state.percent}%` : state.promptText;
  const txt = ui.add
    .text(px + pw / 2, barY + barH / 2, label, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '9px',
      fontStyle: 'bold',
      color: state.progress > 0 ? '#FFFBEB' : '#FDE68A',
      stroke: '#000000',
      strokeThickness: 2,
      resolution: textRes,
    })
    .setOrigin(0.5);
  scene.weaponCompareContainer.add(txt);
  return true;
}

export function drawWorldWeaponSalvageRing(
  g: Phaser.GameObjects.Graphics,
  sim: WorldSim,
  localPlayer: SimPlayerState,
  clockSec: number,
): void {
  const state = computeWeaponSalvageHudState(sim, localPlayer, false);
  if (!state.canSalvage || !state.targetItem) return;

  const ix = state.targetItem.x;
  const iy = state.targetItem.y;
  const pulse = 0.5 + 0.5 * Math.sin(clockSec * 6);
  if (state.progress <= 0) {
    g.lineStyle(1.2, NUM_SOLAR_GOLD, 0.28 + pulse * 0.2);
    g.strokeCircle(ix, iy, 18);
    return;
  }

  const radius = 24;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * state.progress;

  g.fillStyle(NUM_SOLAR_GOLD, 0.12 + state.progress * 0.22);
  g.fillCircle(ix, iy, 14 + state.progress * 10);
  g.lineStyle(5, 0x090d16, 0.9);
  g.strokeCircle(ix, iy, radius);
  g.lineStyle(6.5, NUM_FLAME_ORANGE, 0.55);
  g.beginPath();
  g.arc(ix, iy, radius, startAngle, endAngle, false);
  g.strokePath();
  g.lineStyle(3.5, NUM_SOLAR_GOLD, 0.98);
  g.beginPath();
  g.arc(ix, iy, radius, startAngle, endAngle, false);
  g.strokePath();

  const barW = 42;
  const barH = 6;
  const barX = ix - barW * 0.5;
  const barY = iy + 27;
  g.fillStyle(0x090d16, 0.92);
  g.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  g.fillStyle(NUM_FLAME_ORANGE, 0.95);
  g.fillRect(barX, barY, Math.max(4, Math.round(barW * state.progress)), barH);
  g.fillStyle(NUM_SOLAR_GOLD, 0.95);
  g.fillRect(barX, barY, Math.max(4, Math.round(barW * state.progress)), 3);

  for (let i = 0; i < 6; i++) {
    const sparkAngle = clockSec * 8 + state.progress * Math.PI * 3 + (i * Math.PI) / 3;
    const sparkDist = (1 - state.progress * 0.68) * 26;
    g.fillStyle(i % 2 === 0 ? NUM_SOLAR_GOLD : NUM_BONE_WHITE, 0.95);
    g.fillCircle(ix + Math.cos(sparkAngle) * sparkDist, iy + Math.sin(sparkAngle) * sparkDist, 2.6);
  }
}

export function handleP2AForgeAndSalvageSimEvent(
  scene: GameScene,
  ev: SimEvent,
  isStress: boolean,
  allowStressSfx: boolean,
): boolean {
  const isEn = i18n.getLocale() === 'en';
  if (ev.kind === 'cracked_wall_broken') {
    if (!isStress) {
      scene.fx?.spawnExplosionBurst(ev.x, ev.y, 44);
      scene.fx?.spawnHitSparks(ev.x, ev.y, Math.PI, { hitWall: true });
      scene.fx?.addTrauma(0.28);
      scene.lighting?.spawnTransientLight(ev.x, ev.y, 140, PALETTE.SOLAR_GOLD, 0.95, 0.4);
      scene.fx?.spawnFloatingAlert(ev.x, ev.y - 16, isEn ? 'SECRET PASSAGE!' : 'LỐI ĐI BÍ MẬT!');
    }
    if (!isStress || allowStressSfx) zzfx.play('armor_break', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
    return true;
  }
  if (ev.kind === 'weapon_salvaged') {
    if (!isStress) {
      scene.fx?.spawnHitSparks(ev.x, ev.y, -Math.PI / 2, { isCrit: true });
      scene.fx?.spawnExplosionBurst(ev.x, ev.y, 26);
      scene.lighting?.spawnTransientLight(ev.x, ev.y, 96, PALETTE.SOLAR_GOLD, 0.9, 0.3);
      scene.fx?.spawnFloatingAlert(
        ev.x,
        ev.y - 18,
        isEn ? `+${ev.goldEarned} GOLD SALVAGED!` : `+${ev.goldEarned} VÀNG PHÂN RÃ!`,
      );
    }
    if (!isStress || allowStressSfx) zzfx.play('pickup', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
    return true;
  }
  if (ev.kind === 'flawless_room_cleared') {
    if (!isStress) {
      scene.fx?.spawnFloatingAlert(
        ev.x,
        ev.y - 28,
        isEn ? `+${ev.goldBonus} FLAWLESS GOLD!` : ev.labelVi,
      );
    }
    if (!isStress || allowStressSfx) zzfx.play('pickup', ev.x, scene.camFocusX, ev.y, scene.camFocusY);
    return true;
  }
  return false;
}
