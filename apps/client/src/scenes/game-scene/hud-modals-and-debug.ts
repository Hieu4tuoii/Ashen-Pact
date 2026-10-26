import {
  type BuffId,
  CHARACTERS,
  FLOOR_BUFFS,
  i18n,
  PLAYER_SLOT_COLORS,
  type SupportedLocale,
  WEAPONS,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { musicManager } from '../../audio/music-synth.js';
import { zzfx } from '../../audio/zzfx.js';
import { drawKeyChip, drawStyledPanel } from '../../ui/components/hud-primitives.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import { UI_THEME } from '../../ui/theme.js';
import { type GameScene } from '../GameScene.js';

export interface ResultScreenButtonSpec {
  id: 'replay' | 'returnHub';
  tier: 'primary' | 'secondary';
  hotkey: 'Enter' | 'H';
  x: number;
  w: number;
  h: number;
  label: string;
}

const LEGACY_BUFF_ALIASES: Readonly<Record<string, BuffId>> = {
  bountiful_vitality: 'vanguard_bastion_prism',
  swift_wind: 'elementalist_twin_orbit',
};

/**
 * Resolves a BuffId (or legacy alias) to its localized display name and description,
 * ensuring raw snake_case IDs never appear in Victory/Defeat summaries.
 */
export function resolveLocalizedBuffText(
  rawBuffId: BuffId | string,
  locale: SupportedLocale = i18n.getLocale(),
): { name: string; desc: string } {
  const prevLocale = i18n.getLocale();
  if (prevLocale !== locale) {
    i18n.setLocale(locale);
  }
  try {
    const canonicalId = (LEGACY_BUFF_ALIASES[String(rawBuffId)] ?? rawBuffId) as BuffId;
    const def = FLOOR_BUFFS[canonicalId];
    if (def) {
      return i18n.getBuffText(canonicalId, def.nameVi, def.descriptionVi);
    }
    const lookedUp = i18n.getBuffText(canonicalId);
    if (lookedUp.name !== String(canonicalId)) {
      return lookedUp;
    }
    const humanized = String(rawBuffId)
      .split('_')
      .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : ''))
      .join(' ');
    return { name: humanized, desc: '' };
  } finally {
    if (prevLocale !== locale) {
      i18n.setLocale(prevLocale);
    }
  }
}

/**
 * Returns the 2 hierarchical action buttons for the Victory/Defeat screen
 * (1 prominent primary button 'Chơi lại [Enter]' + 1 secondary button 'Về Hub [H]',
 * removing redundant 'Về Menu' and 'Đóng Bảng' buttons per Spec 3.7.4).
 */
export function getResultScreenButtonSpecs(
  locale: SupportedLocale = i18n.getLocale(),
): ResultScreenButtonSpec[] {
  const isEn = locale === 'en';
  return [
    {
      id: 'replay',
      tier: 'primary',
      hotkey: 'Enter',
      x: 242,
      w: 256,
      h: 36,
      label: isEn ? '⚔  Play Again [Enter]' : '⚔  Chơi lại [Enter]',
    },
    {
      id: 'returnHub',
      tier: 'secondary',
      hotkey: 'H',
      x: 518,
      w: 200,
      h: 34,
      label: isEn ? '🏕  Return to Hub [H]' : '🏕  Về Hub [H]',
    },
  ];
}

function getBuffVisualMeta(
  buffId: BuffId,
  isEn: boolean,
): { borderHex: string; badgeText: string; iconKind: string } {
  const bDef = FLOOR_BUFFS[buffId];
  if (bDef?.characterId) {
    return {
      borderHex: PALETTE.SOLAR_GOLD,
      badgeText: isEn ? '★ SKILL UPGRADE' : '★ NÂNG CẤP KỸ NĂNG',
      iconKind: bDef.characterId,
    };
  }
  return {
    borderHex: PALETTE.ELECTRIC_VIOLET,
    badgeText: isEn ? '✦ BLESSING' : '✦ PHƯỚC LÀNH',
    iconKind: 'ricochet',
  };
}

function drawBuffEmblemIcon(
  g: Phaser.GameObjects.Graphics,
  iconKind: string,
  cx: number,
  cy: number,
  accentHex: string,
): void {
  const accentNum = hexToNum(accentHex);
  g.fillStyle(UI_THEME.panelBgDark, 0.96);
  g.fillCircle(cx, cy, 18);
  g.lineStyle(2, accentNum, 0.95);
  g.strokeCircle(cx, cy, 18);
  g.fillStyle(accentNum, 0.16);
  g.fillCircle(cx, cy, 14);

  g.fillStyle(accentNum, 1);
  g.lineStyle(2, accentNum, 1);
  if (iconKind === 'heart') {
    g.fillCircle(cx - 4.5, cy - 2.5, 5);
    g.fillCircle(cx + 4.5, cy - 2.5, 5);
    g.fillTriangle(cx - 9.2, cy - 0.5, cx + 9.2, cy - 0.5, cx, cy + 9.5);
  } else if (iconKind === 'shield' || iconKind === 'vanguard') {
    g.fillTriangle(cx - 8, cy - 6, cx + 8, cy - 6, cx, cy + 10);
    g.fillRect(cx - 8, cy - 8, 16, 4);
  } else if (iconKind === 'bolt' || iconKind === 'elementalist') {
    g.fillTriangle(cx + 2, cy - 10, cx - 6, cy + 1, cx + 1, cy + 1);
    g.fillTriangle(cx - 1, cy - 1, cx + 6, cy - 1, cx - 2, cy + 10);
  } else if (iconKind === 'crosshair' || iconKind === 'ranger') {
    g.strokeCircle(cx, cy, 7.5);
    g.fillCircle(cx, cy, 2.5);
    g.lineBetween(cx - 11, cy, cx - 5, cy);
    g.lineBetween(cx + 5, cy, cx + 11, cy);
    g.lineBetween(cx, cy - 11, cx, cy - 5);
    g.lineBetween(cx, cy + 5, cx, cy + 11);
  } else if (iconKind === 'wing' || iconKind === 'druid') {
    g.fillCircle(cx, cy + 2, 6);
    g.fillTriangle(cx - 6, cy + 2, cx + 6, cy + 2, cx, cy - 9);
  } else {
    // Engineer / Ricochet star emblem
    g.fillTriangle(cx, cy - 9, cx - 7, cy + 5, cx + 7, cy + 5);
    g.fillTriangle(cx, cy + 9, cx - 7, cy - 5, cx + 7, cy - 5);
  }
}

export function updateModalHudImpl(this: GameScene): void {
  const ui = this.uiScene;
  const sim = this.transport.getSim();
  if (sim.runState === 'playing' || sim.runState === 'buff_choice') {
    this.resultDismissed = false;
  }
  if (sim.runState !== 'buff_choice') {
    this.buffHoveredIdx = null;
  }
  const statsSig =
    sim.runState === 'victory' || sim.runState === 'defeat'
      ? `${sim.runStats.kills}:${Math.round(sim.runStats.damageDealt)}:${sim.runStats.teamCombos}:${sim
          .getAllPlayers()
          .map(
            (pl) =>
              `${pl.id}:${Math.round(pl.statsDamageDealt ?? 0)}:${pl.statsKills ?? 0}:${pl.statsRevives ?? 0}`,
          )
          .join('|')}`
      : '';
  const allPlayers = sim.getAllPlayers();
  const partyCount = Math.max(1, allPlayers.length);
  const readyCount = allPlayers.filter((pl) => pl.buffChoices.length === 0).length;
  const localPlayer = this.transport.getLocalPlayerState();
  const pendingBuffChoices = localPlayer.buffChoices ?? [];
  const modalKey = `${sim.runState}:${pendingBuffChoices.join(',')}:${readyCount}:${partyCount}:${this.buffHoveredIdx ?? -1}:${this.resultDismissed}:${i18n.getLocale()}:${statsSig}`;
  if (modalKey === this.lastRunState) return;
  const prevRunState = this.lastRunState.split(':')[0];
  this.lastRunState = modalKey;

  if (sim.runState === 'victory' && prevRunState !== 'victory') {
    zzfx.play('ui_victory');
  } else if (sim.runState === 'defeat' && prevRunState !== 'defeat') {
    zzfx.play('ui_defeat');
  }

  this.modalContainer.removeAll(true);
  const textRes = Math.min(TextureBaker.getBakeScale(), 3);
  const isEn = i18n.getLocale() === 'en';

  if (sim.runState === 'buff_choice') {
    const modalX = 124;
    const modalY = 86;
    const modalW = 712;
    const modalH = 368;

    const bg = ui.add.graphics();
    bg.fillStyle(hexToNum(PALETTE.INK_DARK), 0.76);
    bg.fillRect(-480, -270, 1920, 1080);

    drawStyledPanel(bg, modalX, modalY, modalW, modalH, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.96,
      borderColor: hexToNum(PALETTE.SOLAR_GOLD),
      borderWidth: 2.4,
      radius: UI_THEME.panelRadius.lg,
      accentColor: hexToNum(PALETTE.SOLAR_GOLD),
      accentSide: 'top',
    });
    this.modalContainer.add(bg);

    const header = ui.add
      .text(480, modalY + 16, i18n.t('modal.buffChoiceTitle'), {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '15px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3.5,
        resolution: textRes,
      })
      .setOrigin(0.5, 0);
    this.modalContainer.add(header);

    const subtitleStr =
      pendingBuffChoices.length === 0
        ? isEn
          ? `✓ Blessing Selected — Waiting for party (${readyCount}/${partyCount})...`
          : `✓ Đã chọn Phước Lành — Đang chờ đồng đội (${readyCount}/${partyCount})...`
        : isEn
          ? `Floor ${sim.currentFloor} Cleared · Select 1 Blessing to Empower Your Pact`
          : `Hoàn Thành Tầng ${sim.currentFloor} · Chọn 1 Phước Lành Cường Hóa Đội Hình`;
    const subHeader = ui.add
      .text(480, modalY + 38, subtitleStr, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: PALETTE.CYAN_FROST,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.4,
        resolution: textRes,
      })
      .setOrigin(0.5, 0);
    this.modalContainer.add(subHeader);

    pendingBuffChoices.forEach((buffId: BuffId, idx: number) => {
      const bDef = FLOOR_BUFFS[buffId];
      if (!bDef) return;
      const buffTxt = i18n.getBuffText(buffId, bDef.nameVi, bDef.descriptionVi);
      const meta = getBuffVisualMeta(buffId, isEn);
      const isHovered = this.buffHoveredIdx === idx;

      const cardW = 212;
      const cardH = 248;
      const cardX = 148 + idx * 226;
      const cardY = (isHovered ? 144 : 149);

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

      // Category / Rarity Pill at top of card
      drawStyledPanel(cardG, cardX + 14, cardY + 12, cardW - 28, 18, {
        fillColor: UI_THEME.panelBgDark,
        fillAlpha: 0.92,
        borderColor: hexToNum(meta.borderHex),
        borderWidth: 1.2,
        radius: 4,
      });

      // Procedural Vector Emblem Icon
      drawBuffEmblemIcon(cardG, meta.iconKind, cardX + cardW / 2, cardY + 56, meta.borderHex);

      // Divider line above description
      cardG.lineStyle(1, hexToNum(meta.borderHex), 0.3);
      cardG.lineBetween(cardX + 18, cardY + 114, cardX + cardW - 18, cardY + 114);

      // Bottom hotkey footer bar inside card
      const footerY = cardY + cardH - 34;
      drawStyledPanel(cardG, cardX + 12, footerY, cardW - 24, 24, {
        fillColor: UI_THEME.panelBgDark,
        fillAlpha: 0.95,
        borderColor: hexToNum(isHovered ? PALETTE.SOLAR_GOLD : meta.borderHex),
        borderWidth: 1.3,
        radius: 5,
      });
      const chipMetrics = drawKeyChip(cardG, cardX + 22, footerY + 5, `${idx + 1}`, {
        active: true,
      });
      this.modalContainer.add(cardG);

      const badgeTxt = ui.add
        .text(cardX + cardW / 2, cardY + 21, meta.badgeText, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '9.5px',
          fontStyle: '800',
          color: meta.borderHex,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.2,
          resolution: textRes,
        })
        .setOrigin(0.5, 0.5);

      const title = ui.add
        .text(cardX + cardW / 2, cardY + 82, buffTxt.name, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '13px',
          fontStyle: '800',
          color: PALETTE.SOLAR_GOLD,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 3,
          align: 'center',
          wordWrap: { width: cardW - 20 },
          resolution: textRes,
        })
        .setOrigin(0.5, 0);

      const desc = ui.add
        .text(cardX + cardW / 2, cardY + 122, buffTxt.desc, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '11px',
          fontStyle: '600',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.4,
          align: 'center',
          wordWrap: { width: cardW - 24 },
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
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10.5px',
          fontStyle: '800',
          color: isHovered ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.2,
          resolution: textRes,
        })
        .setOrigin(0.5, 0.5);

      this.modalContainer.add([badgeTxt, title, desc, keyNumTxt, selectTxt]);

      const hit = ui.add
        .rectangle(cardX + cardW / 2, cardY + cardH / 2, cardW, cardH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        if (this.buffHoveredIdx !== idx) {
          this.buffHoveredIdx = idx;
          zzfx.play('ui_hover');
        }
      });
      hit.on('pointerout', () => {
        if (this.buffHoveredIdx === idx) {
          this.buffHoveredIdx = null;
        }
      });
      hit.on('pointerdown', () => {
        if (this.room && this.coopMode !== 'solo') {
          localPlayer.buffChoices = [];
          this.room.send('select_buff', { buffId });
        } else {
          sim.selectFloorBuff(buffId, localPlayer.id);
        }
        zzfx.play('skill_cast');
      });
      this.modalContainer.add(hit);
    });

    // Bottom Co-op pick status & countdown bar
    const statusFooterG = ui.add.graphics();
    drawStyledPanel(statusFooterG, modalX + 24, modalY + modalH - 42, modalW - 48, 28, {
      fillColor: UI_THEME.panelBg,
      fillAlpha: 0.92,
      borderColor: UI_THEME.panelBorder,
      borderWidth: 1.2,
      radius: 6,
    });
    // Progress track inside status footer
    const readyRatio = Math.min(1, Math.max(0, readyCount / Math.max(1, partyCount)));
    statusFooterG.fillStyle(0x121620, 0.9);
    statusFooterG.fillRoundedRect(modalX + modalW - 168, modalY + modalH - 33, 128, 10, 4);
    statusFooterG.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 0.9);
    statusFooterG.fillRoundedRect(
      modalX + modalW - 167,
      modalY + modalH - 32,
      Math.max(4, Math.round(126 * readyRatio)),
      8,
      3,
    );
    this.modalContainer.add(statusFooterG);

    const statusBarStr = isEn
      ? `⏱ Auto-Pick: 25s  ·  Party Selection: ${readyCount}/${partyCount} Ready  ·  Hotkeys [1] [2] [3]`
      : `⏱ Tự chọn sau: 25s  ·  Đồng đội đã chọn: ${readyCount}/${partyCount}  ·  Phím tắt [1] [2] [3]`;
    const statusBarTxt = ui.add
      .text(modalX + 38, modalY + modalH - 28, statusBarStr, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '10.5px',
        fontStyle: '700',
        color: PALETTE.SILVER_BRIGHT,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.2,
        resolution: textRes,
      })
      .setOrigin(0, 0.5);
    this.modalContainer.add(statusBarTxt);
  } else if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
    const isWin = sim.runState === 'victory';
    const biomeName = i18n.biomeName(sim.currentBiome);
    const px = 96;
    const py = 52;
    const pw = 768;
    const ph = 436;
    const themeHex = isWin ? PALETTE.SOLAR_GOLD : PALETTE.CRIMSON_BRIGHT;
    const themeNum = hexToNum(themeHex);

    const bg = ui.add.graphics();
    bg.fillStyle(hexToNum(PALETTE.INK_DARK), 0.82);
    bg.fillRect(-480, -270, 1920, 1080);

    // Outer Result Modal Frame
    drawStyledPanel(bg, px, py, pw, ph, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.97,
      borderColor: themeNum,
      borderWidth: 2.6,
      radius: UI_THEME.panelRadius.lg,
      accentColor: themeNum,
      accentSide: 'top',
    });

    // TIER 1: Result Header Banner
    drawStyledPanel(bg, px + 16, py + 12, pw - 32, 48, {
      fillColor: UI_THEME.panelBgElevated,
      fillAlpha: 0.96,
      borderColor: themeNum,
      borderWidth: 1.8,
      radius: UI_THEME.panelRadius.md,
    });
    this.modalContainer.add(bg);

    const headerTitle = isWin
      ? `🏆  ${i18n.t('modal.victoryTitle', { biome: biomeName.toUpperCase() })}`
      : `💀  ${i18n.t('modal.defeatTitle', { biome: biomeName.toUpperCase() })}`;
    const header = ui.add
      .text(480, py + 20, headerTitle, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '16px',
        fontStyle: '800',
        color: themeHex,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3.8,
        resolution: textRes,
      })
      .setOrigin(0.5, 0);

    const totalGoldEarned = Math.max(sim.runStats.goldEarned, sim.player.gold);
    const totalSec = Math.max(1, Math.round(sim.runStats.ticksElapsed / 60));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const timeStr = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;

    const tier1SubStr = isEn
      ? `Floor ${sim.currentFloor} (${biomeName})  ·  ⏱ ${timeStr}  ·  ⚔ ${sim.runStats.kills} Kills (${sim.runStats.elitesKilled} Elites)  ·  💰 ${totalGoldEarned} Gold`
      : `Tầng ${sim.currentFloor} (${biomeName})  ·  ⏱ ${timeStr}  ·  ⚔ ${sim.runStats.kills} Hạ (${sim.runStats.elitesKilled} Tinh Anh)  ·  💰 ${totalGoldEarned} Xu`;
    const tier1Sub = ui.add
      .text(480, py + 41, tier1SubStr, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '10.5px',
        fontStyle: '700',
        color: PALETTE.SILVER_BRIGHT,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.2,
        resolution: textRes,
      })
      .setOrigin(0.5, 0);
    this.modalContainer.add([header, tier1Sub]);

    // TIER 2 (Left Column): Party Run Summary Card + Per-Player Performance Breakdown
    const leftX = px + 16;
    const leftW = 366;
    const summaryCardY = py + 68;
    const summaryCardH = 124;

    const summaryCardG = ui.add.graphics();
    drawStyledPanel(summaryCardG, leftX, summaryCardY, leftW, summaryCardH, {
      fillColor: UI_THEME.panelBg,
      fillAlpha: 0.94,
      borderColor: UI_THEME.panelBorder,
      borderWidth: 1.5,
      radius: UI_THEME.panelRadius.md,
      accentColor: hexToNum(PALETTE.CYAN_FROST),
      accentSide: 'left',
    });
    this.modalContainer.add(summaryCardG);

    const buffNames =
      localPlayer.blessingIds.length > 0
        ? localPlayer.blessingIds
            .map((b: BuffId) => resolveLocalizedBuffText(b, isEn ? 'en' : 'vi').name)
            .join(', ')
        : i18n.t('ui.result.none');
    const activeWDef = WEAPONS[sim.getActiveWeaponId()] ?? WEAPONS.knight_sword!;
    const summaryLines = [
      i18n.t('ui.result.roomsCleared', { count: sim.runStats.roomsCleared }),
      i18n.t('ui.result.enemiesKilled', {
        kills: sim.runStats.kills,
        elites: sim.runStats.elitesKilled,
      }),
      i18n.t('ui.result.totalDamage', {
        dmg: Math.round(sim.runStats.damageDealt),
      }),
      i18n.t('ui.result.elementalReactions', {
        reactions: sim.runStats.elementalReactions,
        combos: sim.runStats.teamCombos,
      }),
      i18n.t('ui.result.activeWeapon', {
        weapon: i18n.weaponName(activeWDef.id, activeWDef.nameVi),
      }),
      i18n.t('ui.result.blessings', { buffs: buffNames }),
    ].join('\n');

    const body = ui.add
      .text(leftX + 12, summaryCardY + 8, summaryLines, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '9.8px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.2,
        lineSpacing: 2.5,
        wordWrap: { width: leftW - 22 },
        resolution: textRes,
      })
      .setOrigin(0, 0);
    this.modalContainer.add(body);

    const playerHeader = ui.add.text(
      leftX + 2,
      py + 198,
      `📊 ${i18n.t('ui.result.playerStatsHeader')}`,
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '10.5px',
        fontStyle: '800',
        color: PALETTE.CYAN_FROST,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.6,
        resolution: textRes,
      },
    );
    this.modalContainer.add(playerHeader);

    const allPlayers = sim.getAllPlayers().slice(0, 4);
    allPlayers.forEach((pl, idx) => {
      const ry = py + 217 + idx * 39;
      const rw = leftW;
      const rh = 35;
      const slotColor = PLAYER_SLOT_COLORS[pl.slot] ?? PALETTE.CYAN_FROST;

      const rowG = ui.add.graphics();
      drawStyledPanel(rowG, leftX, ry, rw, rh, {
        fillColor: UI_THEME.panelBg,
        fillAlpha: 0.94,
        borderColor: hexToNum(slotColor),
        borderWidth: 1.4,
        radius: 5,
        accentColor: hexToNum(slotColor),
        accentSide: 'left',
      });
      this.modalContainer.add(rowG);

      const cDef = CHARACTERS[pl.characterId] ?? CHARACTERS.vanguard;
      const charName = i18n.charName(pl.characterId, cDef.nameVi);
      const pNameTxt = ui.add.text(
        leftX + 10,
        ry + 4,
        `[P${pl.slot}] ${pl.displayName} (${charName})`,
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '9.5px',
          fontStyle: '800',
          color: slotColor,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.2,
          resolution: textRes,
        },
      );
      const pStatsTxt = ui.add.text(
        leftX + 10,
        ry + 18,
        i18n.t('ui.result.playerRowFormat', {
          dmg: Math.round(pl.statsDamageDealt ?? 0),
          taken: Math.round(pl.statsDamageTaken ?? 0),
          kills: pl.statsKills ?? 0,
          revives: pl.statsRevives ?? 0,
          elem: pl.statsElementalReactions ?? 0,
          combo: pl.statsTeamCombos ?? 0,
        }),
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '8.5px',
          fontStyle: '700',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2,
          resolution: textRes,
        },
      );
      this.modalContainer.add([pNameTxt, pStatsTxt]);
    });

    // TIER 3 (Right Column): 4 MVP Honor Cards
    const rightX = px + 396;
    const rightW = 356;
    const mvpHeader = ui.add.text(rightX + 2, py + 68, `👑 ${i18n.t('mvp.sectionTitle')}`, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11px',
      fontStyle: '800',
      color: PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    });
    this.modalContainer.add(mvpHeader);

    const mvpAwards = sim.computeMvpAwards();
    mvpAwards.forEach((award, idx) => {
      const ay = py + 90 + idx * 70;
      const aw = rightW;
      const ah = 64;
      const cardG = ui.add.graphics();
      drawStyledPanel(cardG, rightX, ay, aw, ah, {
        fillColor: UI_THEME.panelBg,
        fillAlpha: 0.95,
        borderColor: hexToNum(award.colorHex),
        borderWidth: 1.8,
        radius: UI_THEME.panelRadius.md,
        accentColor: hexToNum(award.colorHex),
        accentSide: 'left',
      });
      this.modalContainer.add(cardG);

      const categoryIcon =
        award.category === 'damage'
          ? '⚔'
          : award.category === 'slayer'
            ? '💀'
            : award.category === 'elemental'
              ? '⚡'
              : '✚';

      const cDef = CHARACTERS[award.characterId] ?? CHARACTERS.vanguard;
      const charName = i18n.charName(award.characterId, cDef.nameVi);
      const titleTxt = ui.add.text(
        rightX + 12,
        ay + 8,
        `${categoryIcon} ${i18n.t(award.titleKey)}`,
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10.5px',
          fontStyle: '800',
          color: award.colorHex,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.5,
          resolution: textRes,
        },
      );
      const winnerBadge = ui.add
        .text(rightX + aw - 12, ay + 8, `[P${award.playerSlot}] ${award.displayName}`, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10px',
          fontStyle: '800',
          color: PALETTE.SOLAR_GOLD,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.4,
          resolution: textRes,
        })
        .setOrigin(1, 0);

      const descParams: Record<string, string | number> =
        award.category === 'medic'
          ? { revives: award.value, taken: award.secondaryValue }
          : award.category === 'elemental'
            ? { reactions: award.value, combos: award.secondaryValue }
            : { val: award.value };
      const subTxt = ui.add.text(
        rightX + 12,
        ay + 32,
        `${charName}  ·  ${i18n.t(award.descKey, descParams)}`,
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '9.5px',
          fontStyle: '700',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.2,
          resolution: textRes,
        },
      );
      this.modalContainer.add([titleTxt, winnerBadge, subTxt]);
    });

    // Bottom Action Bar: 1 Prominent Primary Button (Replay) + 2 Balanced Secondary Buttons (Hub, Main Menu)
    const btnSpecs = getResultScreenButtonSpecs(isEn ? 'en' : 'vi');
    const baseBtnY = py + ph - 46;

    for (const spec of btnSpecs) {
      const isPrimary = spec.tier === 'primary';
      const by = isPrimary ? baseBtnY - 1 : baseBtnY;
      const btnG = ui.add.graphics();
      const drawBtn = (hover: boolean) => {
        btnG.clear();
        if (isPrimary) {
          drawStyledPanel(btnG, spec.x, by, spec.w, spec.h, {
            fillColor: hexToNum(hover ? PALETTE.LIME_GLOW : PALETTE.FOREST_SHADE),
            fillAlpha: 0.98,
            borderColor: hexToNum(PALETTE.SOLAR_GOLD),
            borderWidth: hover ? 2.6 : 2.2,
            radius: 7,
            accentColor: hexToNum(PALETTE.SOLAR_GOLD),
            accentSide: 'top',
          });
        } else {
          const secBorder =
            spec.id === 'returnHub' ? PALETTE.CYAN_FROST : PALETTE.SILVER_BRIGHT;
          drawStyledPanel(btnG, spec.x, by, spec.w, spec.h, {
            fillColor: hover ? UI_THEME.panelBgElevated : UI_THEME.panelBg,
            fillAlpha: 0.96,
            borderColor: hexToNum(hover ? PALETTE.SOLAR_GOLD : secBorder),
            borderWidth: 1.8,
            radius: 6,
          });
        }
      };
      drawBtn(false);
      this.modalContainer.add(btnG);

      const txt = ui.add
        .text(spec.x + spec.w / 2, by + spec.h / 2, spec.label, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: isPrimary ? '12px' : '10.5px',
          fontStyle: '800',
          color: isPrimary
            ? PALETTE.SOLAR_GOLD
            : spec.id === 'returnHub'
              ? PALETTE.CYAN_FROST
              : PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: isPrimary ? 3.2 : 2.6,
          resolution: textRes,
        })
        .setOrigin(0.5, 0.5);
      this.modalContainer.add(txt);

      const hit = ui.add
        .rectangle(spec.x + spec.w / 2, by + spec.h / 2, spec.w, spec.h, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        drawBtn(true);
        zzfx.play('ui_hover');
      });
      hit.on('pointerout', () => drawBtn(false));
      hit.on('pointerdown', () => {
        zzfx.play('ui_click');
        if (spec.id === 'replay') {
          if (this.room && this.coopMode !== 'solo') {
            this.room.send('replay_run', {});
            this.resultDismissed = true;
            this.triggerIrisTransition('close');
            this.invalidateAllHudCaches();
          } else {
            this.scene.restart();
          }
        } else if (spec.id === 'returnHub') {
          if (this.room && this.coopMode !== 'solo') {
            this.room.send('return_to_hub', {});
          }
          sim.enterHub();
          this.resultDismissed = true;
          this.triggerIrisTransition('close');
          this.invalidateAllHudCaches();
        }
      });
      this.modalContainer.add(hit);
    }
  }
}

export function updateDebugStateImpl(
  this: GameScene,
  playerRenderX: number,
  playerRenderY: number,
): void {
  const sim = this.transport.getSim();
  const p = sim.player;
  const debug = initGlobalDebugState();

  debug.playerX = Math.round(playerRenderX * 100) / 100;
  debug.playerY = Math.round(playerRenderY * 100) / 100;
  debug.playerVx = Math.round(p.vx * 100) / 100;
  debug.playerVy = Math.round(p.vy * 100) / 100;
  debug.playerHp = p.hp;
  debug.playerMaxHp = p.maxHp;
  debug.playerArmor = p.armor;
  debug.playerMaxArmor = p.maxArmor;
  debug.playerClipAmmo = p.clipAmmo;
  debug.playerClipMax = p.clipMax;
  debug.playerWeaponHeat = Math.round(p.weaponHeat);
  debug.playerSlot = p.slot;
  debug.activeWeaponId = sim.getActiveWeaponId();
  debug.activeWeaponSlot = p.activeWeaponSlot;
  debug.godMode = p.godMode;
  debug.damagePopupCount = this.fx.getActiveDamagePopupCount();
  debug.totalDamagePopupsSpawned = this.fx.totalDamagePopupsSpawned;
  debug.totalSparksSpawned = this.fx.totalSparksSpawned;
  debug.totalHitStopsTriggered = this.fx.totalHitStopsTriggered;
  debug.totalShakesTriggered = this.fx.totalShakesTriggered;
  debug.sfxPlayedCount = zzfx.getPlayedCount();
  debug.lastSfxId = zzfx.getLastPlayedId();
  debug.rollingDps = sim.getRollingDps();
  debug.cameraCenterX = Math.round(this.cameras.main.midPoint.x * 100) / 100;
  debug.cameraCenterY = Math.round(this.cameras.main.midPoint.y * 100) / 100;
  debug.animState = this.playerRig?.getAnimState() ?? 'idle';

  // Phase 2 telemetry
  debug.activeLightCount = this.lighting.getActiveLightCount();
  debug.decalCount = this.fx.getActiveDecalCount();
  debug.particleCount = this.fx.getActiveParticleCount();
  debug.afterimageCount = this.fx.getActiveAfterimageCount();
  debug.ambientParticleCount = this.fx.getActiveAmbientCount();
  debug.propCount = this.propVisuals.size;
  let destructibleCount = 0;
  for (let i = 0; i < sim.props.length; i++) {
    const pr = sim.props[i]!;
    if (pr.destructible && pr.hp > 0) destructibleCount += 1;
  }
  debug.destructiblePropCount = destructibleCount;
  debug.activeImbueElement = p.activeImbueElement;
  debug.stressTestActive = sim.stressTestActive;

  // Phase 3 telemetry
  const currentRoom = sim.getCurrentRoom();
  const boss = sim.getActiveBoss();
  debug.biome = sim.currentBiome;
  debug.currentBiome = sim.currentBiome;
  debug.currentFloor = sim.currentFloor;
  debug.currentRoomId = sim.currentRoomId;
  debug.currentRoomType = sim.inHub ? 'hub' : currentRoom.type;
  debug.totalRooms = sim.dungeon.rooms.length;
  debug.playerGold = p.gold;
  debug.runState = sim.runState;
  debug.bossActive = boss !== null;
  debug.bossDefId = boss ? boss.defId : null;
  debug.bossPhase = boss ? boss.bossPhase : 0;
  debug.bossHp = boss ? boss.hp : 0;
  debug.bossMaxHp = boss ? boss.maxHp : 0;
  debug.fullMapOpen = this.fullMapOpen;
  debug.botAutoPlayActive = sim.botAutoPlayActive;
  debug.activeBuffs = p.blessingIds;

  // Phase 4 Co-op & Network telemetry
  debug.coopMode = this.coopMode;
  debug.coopPlayerCount = sim.getActivePlayerCount();
  debug.inHub = sim.inHub;
  if (this.networkTransport) {
    const tel = this.networkTransport.getTelemetry();
    debug.rttMs = tel.rttMs;
    debug.jitterMs = tel.jitterMs;
    debug.bandwidthKBps = Math.round((tel.bytesInPerSec / 1024) * 10) / 10;
    debug.interpolationDelayMs = tel.interpolationDelayMs;
    debug.wifiProfile = tel.wifiProfile;
  } else {
    debug.rttMs = debug.pingMs;
    debug.jitterMs = 0;
    debug.bandwidthKBps = 0;
    debug.interpolationDelayMs = 0;
  }

  // Phase 5 telemetry
  debug.playerCharacterId = p.characterId;
  debug.teamComboCount = sim.teamComboCount;
  debug.elementalReactions = sim.runStats.elementalReactions;
  debug.activeSummonCount = sim.summons.length;
  debug.activeSkillZoneCount = sim.skillZones.length;

  // Phase 6 telemetry
  debug.blizzardVeilActive = this.lighting.isBlizzardVeilActive();
  debug.conveyorDirection = sim.map.conveyorDirection;
  debug.pressurePlatesSolved = sim.coopPuzzleCompleted;
  debug.pressurePlateCount = sim.pressurePlates.length;
  debug.shockwaveRingCount = sim.shockwaveRings.length;
  debug.tetherBeamCount = sim.tetherBeams.length;

  // Phase 7 & P9b UI/UX & Audio telemetry
  debug.language = graphicsSettings.getState().language;
  debug.pauseModalOpen = this.pauseModalOpen;
  debug.pauseConfirmExitOpen = this.pauseConfirmExitOpen;
  debug.invitePanelVisible = this.invitePanelVisible;
  const activeModal = this.settingsModal?.getActiveModal() ?? 'none';
  const activeTab = this.settingsModal?.getActiveTab() ?? 'audio';
  debug.settingsModalOpen = activeModal === 'settings';
  debug.controlsModalOpen =
    activeModal === 'controls' || (activeModal === 'settings' && activeTab === 'controls');
  debug.creditsModalOpen = activeModal === 'credits';
  debug.settingsActiveTab = activeTab;
  debug.emoteWheelOpen = this.emoteWheelOpen;
  debug.irisTransitionProgress = Math.round(this.irisTransitionProgress * 100) / 100;
  debug.trailingHpRatio = Math.round(this.trailingHpRatio * 1000) / 1000;
  debug.trailingArmorRatio = Math.round(this.trailingArmorRatio * 1000) / 1000;
  debug.musicTheme = musicManager.getCurrentTheme();
  debug.musicCombatMix = musicManager.getCombatMix();
  debug.mvpAwardsCount = sim.computeMvpAwards().length;

  const activeEnemyCount = this.activeEnemyIds.size;
  const totalEntities = 1 + sim.simulatedPlayers.length + activeEnemyCount + sim.summons.length;

  this.debugOverlay?.update({
    entityCount: totalEntities,
    bulletCount: sim.projectiles.length,
    tick: sim.tick,
  });
}
