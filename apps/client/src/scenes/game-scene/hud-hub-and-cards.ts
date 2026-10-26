import {
  CHARACTERS,
  type CharacterId,
  findInteractTarget,
  generateQrMatrix,
  i18n,
  INTERACT_HYSTERESIS,
  PLAYER_SLOT_COLORS,
  type QuickEmoteId,
  WEAPON_RARITY_COLORS,
  WEAPONS,
} from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../../art/palette.js';
import {
  drawKeyChip,
  drawStyledPanel,
  drawVectorHudIcon,
} from '../../ui/components/hud-primitives.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import { computeUiTextResolution, createUiTextStyle, UI_THEME } from '../../ui/theme.js';
import { type GameScene } from '../GameScene.js';
import { formatWeaponCadenceHudLabel } from './hud-micro-reload-bar.js';

export function formatHubInvitePlayerRowText(
  slot: number,
  displayName: string,
  charName: string,
  readyStr: string,
  hasKickBtn: boolean,
): string {
  const maxNameChars = hasKickBtn ? 12 : 16;
  const trimmedName =
    displayName.length > maxNameChars ? `${displayName.slice(0, maxNameChars - 1)}…` : displayName;
  return `P${slot} · ${trimmedName} (${charName}) — ${readyStr}`;
}

export function updateHubInvitePanelImpl(this: GameScene): void {
  const ui = this.uiScene;
  const sim = this.transport.getSim();
  const showInHub = sim.inHub && !this.fullMapOpen;
  const allPlayers = sim.getAllPlayers();
  const playersKey = allPlayers
    .map((pl) => `${pl.id}:${pl.slot}:${pl.displayName}:${pl.characterId}:${pl.ready ? 1 : 0}`)
    .join('|');
  const hash = !showInHub
    ? ''
    : `${this.invitePanelVisible ? 1 : 0}:${this.primaryLanIp}:${this.serverPort}:${this.hostInviteUrl ?? ''}:${sim.allowDuplicateCharacters ? 1 : 0}:${this.copyToastTimer > 0 ? 1 : 0}:${playersKey}:${i18n.getLocale()}:${this.currentHudUiScale}`;

  if (hash === this.lastInvitePanelHash) return;
  this.lastInvitePanelHash = hash;

  this.invitePanelContainer.removeAll(true);
  if (!showInHub) return;

  const textRes = computeUiTextResolution(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    ui.cameras?.main?.zoom || 2,
    this.currentHudUiScale || 1,
  );
  const isEn = i18n.getLocale() === 'en';
  const activeCount = Math.max(1, allPlayers.length);

  // Collapsed default state: compact top-right chip "📡 Mời bạn [I] · 2/4"
  if (!this.invitePanelVisible) {
    const chipW = 166;
    const chipH = 26;
    const chipX = -12 - chipW;
    const chipY = 144;

    const chipBg = ui.add.graphics();
    drawStyledPanel(chipBg, chipX, chipY, chipW, chipH, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.92,
      borderColor: hexToNum(PALETTE.SOLAR_GOLD),
      borderWidth: 1.6,
      radius: UI_THEME.panelRadius.md,
      accentColor: hexToNum(PALETTE.SOLAR_GOLD),
      accentSide: 'left',
    });

    const labelStr = isEn ? `📡 Invite · ${activeCount}/4` : `📡 Mời bạn · ${activeCount}/4`;
    const chipTxt = ui.add
      .text(
        chipX + 10,
        chipY + chipH * 0.5,
        labelStr,
        createUiTextStyle({
          fontPxAt1080p: 13,
          weight: 800,
          color: PALETTE.SOLAR_GOLD,
          resolution: textRes,
        }),
      )
      .setOrigin(0, 0.5);

    const keyMetrics = drawKeyChip(chipBg, chipX + chipW - 22, chipY + 7, 'I', { active: true });
    const keyTxt = ui.add
      .text(
        chipX + chipW - 22 + keyMetrics.width * 0.5,
        chipY + chipH * 0.5,
        'I',
        createUiTextStyle({
          fontPxAt1080p: 12,
          weight: 800,
          color: PALETTE.SOLAR_GOLD,
          resolution: textRes,
        }),
      )
      .setOrigin(0.5, 0.5);

    const hit = ui.add
      .rectangle(chipX + chipW * 0.5, chipY + chipH * 0.5, chipW, chipH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.invitePanelVisible = true;
      initGlobalDebugState().invitePanelVisible = true;
      this.lastInvitePanelHash = '';
    });

    this.invitePanelContainer.add([chipBg, chipTxt, keyTxt, hit]);
    return;
  }

  // Expanded state: full QR + LAN IP + 4-Slot Co-op Roster inside hudTopRightContainer
  const pw = 284;
  const ph = 282;
  const px = -12 - pw;
  const py = 144;

  const bg = ui.add.graphics();
  drawStyledPanel(bg, px, py, pw, ph, {
    fillColor: UI_THEME.panelBgDark,
    fillAlpha: 0.94,
    borderColor: hexToNum(PALETTE.SOLAR_GOLD),
    borderWidth: 1.8,
    radius: UI_THEME.panelRadius.md,
    accentColor: hexToNum(PALETTE.SOLAR_GOLD),
    accentSide: 'top',
  });
  this.invitePanelContainer.add(bg);

  const header = ui.add.text(
    px + 10,
    py + 6,
    `${i18n.t('ui.hud.coopInviteHeader')} · ${activeCount}/4`,
    createUiTextStyle({
      fontPxAt1080p: 14,
      weight: 800,
      color: PALETTE.SOLAR_GOLD,
      resolution: textRes,
    }),
  );
  const ipText = ui.add.text(
    px + 10,
    py + 21,
    `${i18n.t('ui.menu.ipLabel')}: ${this.primaryLanIp}:${this.serverPort}`,
    createUiTextStyle({
      fontPxAt1080p: 13,
      weight: 700,
      color: PALETTE.CYAN_FROST,
      resolution: textRes,
    }),
  );
  this.invitePanelContainer.add([header, ipText]);

  // Collapse button [I] at top-right of expanded panel
  const collapseBtnW = 54;
  const collapseBtnH = 18;
  const collapseBtnX = px + pw - collapseBtnW - 8;
  const collapseBtnY = py + 6;
  drawStyledPanel(bg, collapseBtnX, collapseBtnY, collapseBtnW, collapseBtnH, {
    fillColor: UI_THEME.panelBgElevated,
    fillAlpha: 0.95,
    borderColor: UI_THEME.panelBorder,
    borderWidth: 1.2,
    radius: 4,
  });
  const collapseTxt = ui.add
    .text(
      collapseBtnX + collapseBtnW * 0.5,
      collapseBtnY + collapseBtnH * 0.5,
      isEn ? 'Hide [I]' : 'Ẩn [I]',
      createUiTextStyle({
        fontPxAt1080p: 11,
        weight: 800,
        color: PALETTE.SILVER_BRIGHT,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5);
  const collapseHit = ui.add
    .rectangle(
      collapseBtnX + collapseBtnW * 0.5,
      collapseBtnY + collapseBtnH * 0.5,
      collapseBtnW,
      collapseBtnH,
      0x000000,
      0,
    )
    .setInteractive({ useHandCursor: true });
  collapseHit.on('pointerdown', () => {
    this.invitePanelVisible = false;
    initGlobalDebugState().invitePanelVisible = false;
    this.lastInvitePanelHash = '';
  });
  this.invitePanelContainer.add([collapseTxt, collapseHit]);

  // Procedural Vector QR Code (ISO/IEC 18004)
  const qrUrl = this.hostInviteUrl ?? `http://${this.primaryLanIp}:${this.serverPort}/?coop=join`;
  const qrMatrix = generateQrMatrix(qrUrl);
  const qrSize = qrMatrix.length;
  const qrBoxSize = 76;
  const qrX = px + 10;
  const qrY = py + 38;
  const quietZone = 2;
  const totalModules = qrSize + quietZone * 2;
  const cellPx = qrBoxSize / totalModules;

  const qrG = ui.add.graphics();
  qrG.fillStyle(hexToNum(PALETTE.BONE_WHITE), 1);
  qrG.lineStyle(1.5, hexToNum(PALETTE.INK_DARK), 1);
  qrG.fillRoundedRect(qrX, qrY, qrBoxSize, qrBoxSize, 4);
  qrG.strokeRoundedRect(qrX, qrY, qrBoxSize, qrBoxSize, 4);
  qrG.fillStyle(hexToNum(PALETTE.INK_DARK), 1);

  for (let r = 0; r < qrSize; r++) {
    for (let c = 0; c < qrSize; c++) {
      if (qrMatrix[r]?.[c]) {
        qrG.fillRect(
          qrX + (c + quietZone) * cellPx,
          qrY + (r + quietZone) * cellPx,
          Math.ceil(cellPx),
          Math.ceil(cellPx),
        );
      }
    }
  }
  this.invitePanelContainer.add(qrG);

  const makePanelBtn = (
    bx: number,
    by: number,
    bw: number,
    bh: number,
    label: string,
    fillHex: string,
    onClick: () => void,
    fontPxAt1080p = 13,
  ) => {
    const btnG = ui.add.graphics();
    drawStyledPanel(btnG, bx, by, bw, bh, {
      fillColor: hexToNum(fillHex),
      fillAlpha: 0.94,
      borderColor: UI_THEME.inkDark,
      borderWidth: 1.4,
      radius: 4,
    });

    const txt = ui.add
      .text(
        bx + bw / 2,
        by + bh / 2,
        label,
        createUiTextStyle({
          fontPxAt1080p,
          weight: 800,
          color: PALETTE.BONE_WHITE,
          resolution: textRes,
        }),
      )
      .setOrigin(0.5, 0.5);

    const hit = ui.add
      .rectangle(bx + bw / 2, by + bh / 2, bw, bh, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', onClick);

    this.invitePanelContainer.add([btnG, txt, hit]);
  };

  const btnX = qrX + qrBoxSize + 8;
  const btnW = pw - qrBoxSize - 28;

  makePanelBtn(
    btnX,
    qrY,
    btnW,
    22,
    this.copyToastTimer > 0 ? i18n.t('ui.hud.copiedInviteLink') : i18n.t('ui.hud.copyInviteLink'),
    this.copyToastTimer > 0 ? PALETTE.GOBLIN_GREEN : PALETTE.AZURE_CORE,
    () => {
      try {
        void navigator.clipboard?.writeText(qrUrl);
      } catch {
        // Ignore clipboard errors
      }
      this.copyToastTimer = 2.0;
      this.lastInvitePanelHash = '';
    },
  );

  makePanelBtn(
    btnX,
    qrY + 26,
    btnW,
    22,
    `${i18n.t('ui.hud.duplicateChar')}: ${sim.allowDuplicateCharacters ? i18n.t('ui.hud.on') : i18n.t('ui.hud.off')}`,
    PALETTE.SLATE_MID,
    () => {
      const nextAllow = !sim.allowDuplicateCharacters;
      sim.allowDuplicateCharacters = nextAllow;
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('toggle_duplicate_char', { allow: nextAllow });
      }
      this.lastInvitePanelHash = '';
    },
  );

  makePanelBtn(
    btnX,
    qrY + 52,
    btnW,
    24,
    sim.player.ready ? i18n.t('ui.hud.readyDone') : i18n.t('ui.hud.pressReady'),
    sim.player.ready ? PALETTE.GOBLIN_GREEN : PALETTE.RUBY_CORE,
    () => {
      if (this.room && this.coopMode !== 'solo') {
        if (!sim.player.ready) {
          sim.player.ready = true;
          this.room.send('set_ready', { ready: true, autoStartIfAllReady: true });
        } else if (sim.inHub && (sim.areAllPlayersReady() || sim.player.slot === 1)) {
          this.room.send('start_run', {});
        } else {
          sim.player.ready = false;
          this.room.send('set_ready', { ready: false });
        }
      } else {
        this.readyToggleQueued = true;
        if (sim.inHub) {
          sim.player.ready = true;
          sim.startDungeonRunFromHub();
        }
      }
      this.lastInvitePanelHash = '';
    },
  );

  // Player Slots List (P1..P4)
  const listStartY = qrY + qrBoxSize + 8;
  for (let slotIdx = 1; slotIdx <= 4; slotIdx++) {
    const rowY = listStartY + (slotIdx - 1) * 27;
    const pl = allPlayers.find((item) => item.slot === slotIdx);
    const slotColor = PLAYER_SLOT_COLORS[slotIdx as 1 | 2 | 3 | 4];

    const rowG = ui.add.graphics();
    drawStyledPanel(rowG, px + 10, rowY, pw - 20, 23, {
      fillColor: UI_THEME.panelBg,
      fillAlpha: 0.88,
      borderColor: hexToNum(pl ? slotColor : PALETTE.INK_DARK),
      borderWidth: 1.2,
      radius: 4,
    });
    this.invitePanelContainer.add(rowG);

    if (pl) {
      const charDef = CHARACTERS[pl.characterId] ?? CHARACTERS.vanguard;
      const charName = i18n.charName(pl.characterId, charDef.nameVi);
      const rdyStr = pl.ready ? i18n.t('ui.hud.readyShort') : i18n.t('ui.hud.selectingChar');
      const hasKickBtn = sim.player.slot === 1 && pl.slot !== 1;
      const kickBtnX = px + pw - 56;
      const maxRowTextW = hasKickBtn ? kickBtnX - (px + 15) - 8 : pw - 32;

      const fullRowStr = formatHubInvitePlayerRowText(
        pl.slot,
        pl.displayName,
        charName,
        rdyStr,
        hasKickBtn,
      );
      const rowTxt = ui.add
        .text(
          px + 15,
          rowY + 11.5,
          fullRowStr,
          createUiTextStyle({
            fontPxAt1080p: 12,
            weight: 700,
            color: pl.ready ? PALETTE.LIME_GLOW : slotColor,
            resolution: textRes,
          }),
        )
        .setOrigin(0, 0.5);

      // Guarantee zero overlap with the "Đuổi" / "Kick" button on the right
      if (rowTxt.width > maxRowTextW) {
        let shortened = fullRowStr;
        while (shortened.length > 8 && rowTxt.width > maxRowTextW) {
          shortened = `${shortened.slice(0, -2)}…`;
          rowTxt.setText(shortened);
        }
      }
      this.invitePanelContainer.add(rowTxt);

      if (hasKickBtn) {
        makePanelBtn(
          kickBtnX,
          rowY + 2.5,
          42,
          18,
          i18n.t('ui.hud.kick'),
          PALETTE.RUBY_DARK,
          () => {
            if (this.room && this.coopMode !== 'solo') {
              this.room.send('kick_player', { slot: pl.slot });
            } else {
              sim.removeCoopPlayer(pl.id);
            }
          },
          12,
        );
      }
    } else {
      const emptyTxt = ui.add
        .text(
          px + 16,
          rowY + 11.5,
          `P${slotIdx} · ${i18n.t('ui.hud.emptySlot')}`,
          createUiTextStyle({
            fontPxAt1080p: 12,
            weight: 600,
            color: PALETTE.ASH_GRAY,
            resolution: textRes,
          }),
        )
        .setOrigin(0, 0.5);
      this.invitePanelContainer.add(emptyTxt);
    }
  }

  // Quick Emote Bar at bottom of Hub Panel
  const emotes: { id: QuickEmoteId; key: string }[] = [
    { id: 1, key: 'T+1' },
    { id: 2, key: 'T+2' },
    { id: 3, key: 'T+3' },
    { id: 4, key: 'T+4' },
  ];
  const emY = py + ph - 25;
  const emW = 63;
  emotes.forEach((em, idx) => {
    makePanelBtn(
      px + 10 + idx * (emW + 4),
      emY,
      emW,
      19,
      `[${em.key}] ${i18n.emoteText(em.id)}`,
      PALETTE.SLATE_MID,
      () => {
        this.queuedEmote = em.id;
      },
      12,
    );
  });
}

export function updateHubCharacterSkillPreviewImpl(this: GameScene): void {
  const ui = this.uiScene;
  const sim = this.transport.getSim();
  const debug = initGlobalDebugState();
  const target =
    this.currentInteractTarget ??
    findInteractTarget(sim, sim.player.id, {
      currentTargetKey: this.interactPromptState.currentTargetKey,
      hysteresis: INTERACT_HYSTERESIS,
    });
  const nearestCharId: CharacterId | null =
    sim.inHub && !this.fullMapOpen && !debug.overlayVisible && target?.kind === 'hub_statue'
      ? target.statue.characterId
      : null;

  debug.hubPreviewCharacterId = nearestCharId;
  const isEquipped = nearestCharId === sim.player.characterId;
  const hash = nearestCharId
    ? `${nearestCharId}:${isEquipped ? 1 : 0}:${i18n.getLocale()}:${this.currentHudUiScale}`
    : '';

  if (hash === this.lastHubPreviewHash) return;
  this.lastHubPreviewHash = hash;

  this.hubPreviewContainer.removeAll(true);
  if (!nearestCharId) return;

  const cDef = CHARACTERS[nearestCharId];
  if (!cDef) return;
  const charTxt = i18n.getCharacterText(nearestCharId);
  const isEn = i18n.getLocale() === 'en';

  const textRes = computeUiTextResolution(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    ui.cameras?.main?.zoom || 2,
    this.currentHudUiScale || 1,
  );
  // Local coordinates inside hubPreviewContainer (anchored at -padX, WORLD_VIEW_HEIGHT + padY)
  const px = 12;
  const pw = 516;
  const ph = 152;
  const py = -12 - ph;

  const bg = ui.add.graphics();
  const borderCol = hexToNum(isEquipped ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD);
  drawStyledPanel(bg, px, py, pw, ph, {
    fillColor: UI_THEME.panelBgDark,
    fillAlpha: 0.94,
    borderColor: borderCol,
    borderWidth: 1.8,
    radius: UI_THEME.panelRadius.md,
    accentColor: borderCol,
    accentSide: 'left',
  });
  this.hubPreviewContainer.add(bg);

  const statusBadge = isEquipped
    ? i18n.t('ui.hud.equippedBadge')
    : i18n.t('ui.hud.pressEToSelect');
  const header = ui.add.text(
    px + 12,
    py + 6,
    `${charTxt.name.toUpperCase()} — ${charTxt.title}`,
    createUiTextStyle({
      fontPxAt1080p: 15,
      weight: 800,
      color: isEquipped ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD,
      resolution: textRes,
    }),
  );

  const spdLabel = isEn ? 'Spd' : 'Tốc';
  const statsBadge = ui.add
    .text(
      px + pw - 12,
      py + 7,
      `[${statusBadge}] · HP ${cDef.hp} · ${i18n.t('ui.hud.armor')} ${cDef.armor} · ${spdLabel} ${cDef.moveSpeed}`,
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 700,
        color: PALETTE.CYAN_FROST,
        resolution: textRes,
      }),
    )
    .setOrigin(1, 0);

  const upg1 = cDef.skill.upgrades[0];
  const upg2 = cDef.skill.upgrades[1];
  const upg1Txt = i18n.getBuffText(upg1.id);
  const upg2Txt = i18n.getBuffText(upg2.id);
  const bodyLines = isEn
    ? [
        `• Passive (${charTxt.passiveName}): ${charTxt.passiveDesc}`,
        `• Skill [Space/RMB] (${charTxt.skillName} · CD ${cDef.skill.cooldownSec}s): ${charTxt.skillDesc}`,
        `• Upgrades: (1) ${upg1Txt.name}: ${upg1Txt.desc} | (2) ${upg2Txt.name}: ${upg2Txt.desc}`,
        `• Co-op Synergy: ${charTxt.synergy}`,
      ].join('\n')
    : [
        `• Nội tại (${charTxt.passiveName}): ${charTxt.passiveDesc}`,
        `• Kỹ năng [Space] (${charTxt.skillName} · Hồi ${cDef.skill.cooldownSec}s): ${charTxt.skillDesc}`,
        `• Nâng cấp: (1) ${upg1Txt.name}: ${upg1Txt.desc} | (2) ${upg2Txt.name}: ${upg2Txt.desc}`,
        `• Synergy Co-op: ${charTxt.synergy}`,
      ].join('\n');

  const body = ui.add.text(
    px + 12,
    py + 24,
    bodyLines,
    createUiTextStyle({
      fontPxAt1080p: 13,
      weight: 600,
      color: PALETTE.BONE_WHITE,
      wordWrapWidth: pw - 24,
      resolution: textRes,
    }),
  );

  this.hubPreviewContainer.add([header, statsBadge, body]);
}

export function updateWeaponComparisonCardImpl(this: GameScene): void {
  const ui = this.uiScene;
  const sim = this.transport.getSim();
  const debug = initGlobalDebugState();
  const target =
    this.currentInteractTarget ??
    findInteractTarget(sim, sim.player.id, {
      currentTargetKey: this.interactPromptState.currentTargetKey,
      hysteresis: INTERACT_HYSTERESIS,
    });
  const nearestWeaponItem =
    sim.runState === 'playing' &&
    !this.fullMapOpen &&
    !this.pauseModalOpen &&
    !(this.settingsModal?.isOpen() ?? false) &&
    !debug.overlayVisible &&
    debug.hubPreviewCharacterId === null &&
    target?.kind === 'world_item' &&
    target.item.kind === 'weapon' &&
    target.item.weaponId
      ? target.item
      : null;

  const dropWId = nearestWeaponItem?.weaponId ?? null;
  debug.weaponComparisonVisible = dropWId !== null;
  debug.comparedWeaponId = dropWId;

  const currWId = sim.getActiveWeaponId();
  const showHints = graphicsSettings.getState().showKeyHints;
  const hash = dropWId
    ? `${dropWId}:${currWId}:${nearestWeaponItem?.costGold ?? 0}:${i18n.getLocale()}:${showHints ? 1 : 0}:${this.currentHudUiScale}`
    : '';
  if (hash === this.lastWeaponCompareHash) return;
  this.lastWeaponCompareHash = hash;

  this.weaponCompareContainer.removeAll(true);
  if (!dropWId || !nearestWeaponItem) return;

  const wDrop = WEAPONS[dropWId] ?? WEAPONS.knight_sword!;
  const wCurr = WEAPONS[currWId] ?? WEAPONS.knight_sword!;
  const textRes = computeUiTextResolution(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    ui.cameras?.main?.zoom || 2,
    this.currentHudUiScale || 1,
  );
  const isEn = i18n.getLocale() === 'en';

  // Local coordinates inside hudBottomCenterContainer (anchored at x = 480, y = WORLD_VIEW_HEIGHT + padY)
  // Shifted slightly left (-276..+100) so it never collides with bottom-right Weapon & Cooldown cards!
  const pw = 376;
  const ph = 108;
  const px = -276;
  const py = -12 - ph;

  const rarityHex = WEAPON_RARITY_COLORS[wDrop.rarity];
  const rarityNum = hexToNum(rarityHex);
  const bg = ui.add.graphics();
  drawStyledPanel(bg, px, py, pw, ph, {
    fillColor: UI_THEME.panelBgDark,
    fillAlpha: 0.94,
    borderColor: rarityNum,
    borderWidth: 1.8,
    radius: UI_THEME.panelRadius.md,
    accentColor: rarityNum,
    accentSide: 'left',
  });
  this.weaponCompareContainer.add(bg);

  const dropTotalDmg = wDrop.damage * Math.max(1, wDrop.pelletCount);
  const currTotalDmg = wCurr.damage * Math.max(1, wCurr.pelletCount);
  const dmgDiff = dropTotalDmg - currTotalDmg;
  const rateDiff = Math.round((wDrop.fireRate - wCurr.fireRate) * 10) / 10;
  const dropDps = Math.round(dropTotalDmg * wDrop.fireRate * (1 + wDrop.critChance * 0.5));
  const currDps = Math.round(currTotalDmg * wCurr.fireRate * (1 + wCurr.critChance * 0.5));
  const dpsDiff = dropDps - currDps;

  const fmtDelta = (diff: number) => {
    if (Math.abs(diff) < 0.05) return '(=)';
    const isGood = diff > 0;
    const sign = diff > 0 ? '+' : '';
    return isGood ? `▲${sign}${diff}` : `▼${sign}${diff}`;
  };

  const dropName = i18n.weaponName(wDrop.id, wDrop.nameVi);
  const currName = i18n.weaponName(wCurr.id, wCurr.nameVi);

  const header = ui.add.text(
    px + 12,
    py + 6,
    `★ ${dropName.toUpperCase()} ⇄ ${currName} · DPS ~${dropDps} (${fmtDelta(dpsDiff)})`,
    createUiTextStyle({
      fontPxAt1080p: 14,
      weight: 800,
      color: rarityHex,
      resolution: textRes,
    }),
  );
  this.weaponCompareContainer.add(header);

  // Merged [E] prompt pill badge at top-right of the Weapon Comparison Card
  const costGold = Math.max(0, nearestWeaponItem.costGold ?? 0);
  const isPriced = costGold > 0;
  const actionLabel = isPriced ? (isEn ? 'Buy' : 'Mua') : i18n.t('ui.hud.weaponCompareSwap');

  const keyTxt = ui.add
    .text(
      0,
      0,
      'E',
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 800,
        color: PALETTE.SOLAR_GOLD,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5);

  const actionTxt = ui.add
    .text(
      0,
      0,
      actionLabel,
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 800,
        color: PALETTE.BONE_WHITE,
        resolution: textRes,
      }),
    )
    .setOrigin(0, 0.5);

  const priceTxt = isPriced
    ? ui.add
        .text(
          0,
          0,
          `${costGold}`,
          createUiTextStyle({
            fontPxAt1080p: 13,
            weight: 800,
            color: UI_THEME.status.goldBrightHex,
            resolution: textRes,
          }),
        )
        .setOrigin(0, 0.5)
    : null;

  const chipW = 14;
  const pillH = 18;
  const coinBlockW = priceTxt ? 6 + 9 + 4 + priceTxt.width : 0;
  const pillW = Math.ceil(5 + chipW + 5 + actionTxt.width + coinBlockW + 6);
  const pillX = px + pw - 8 - pillW;
  const pillY = py + 5;
  const pillCy = pillY + pillH * 0.5;

  drawStyledPanel(bg, pillX, pillY, pillW, pillH, {
    fillColor: UI_THEME.panelBg,
    fillAlpha: 0.96,
    borderColor: rarityNum,
    borderWidth: 1.2,
    radius: 4,
  });

  const chipMetrics = drawKeyChip(bg, pillX + 4, pillCy - 5.5, 'E', { active: true });
  keyTxt.setPosition(pillX + 4 + chipMetrics.width * 0.5, pillCy);
  const actionX = pillX + 4 + chipMetrics.width + 5;
  actionTxt.setPosition(actionX, pillCy);
  this.weaponCompareContainer.add([keyTxt, actionTxt]);

  if (priceTxt) {
    const coinCx = actionX + actionTxt.width + 8;
    drawVectorHudIcon(bg, 'coin', coinCx, pillCy, 4.2, UI_THEME.status.gold);
    priceTxt.setPosition(coinCx + 6, pillCy);
    this.weaponCompareContainer.add(priceTxt);
  }

  const dropCadenceStat = formatWeaponCadenceHudLabel(
    sim.player,
    wDrop,
    isEn ? 'en' : 'vi',
  ).compareStatText;
  const statsLine1 = `${i18n.t('ui.hud.weaponCompareDmg')}: ${wDrop.damage}${wDrop.pelletCount > 1 ? `×${wDrop.pelletCount}` : ''} (${fmtDelta(dmgDiff)}) · ${i18n.t('ui.hud.weaponCompareFireRate')}: ${wDrop.fireRate}/s (${fmtDelta(rateDiff)}) · ${dropCadenceStat}`;
  const statsLine2 = `${i18n.t('ui.hud.weaponCompareCrit')}: ${Math.round(wDrop.critChance * 100)}% · ${i18n.t('ui.tooltip.element')}: ${i18n.elementName(wDrop.element)} · ${i18n.getRarityLabel(wDrop.rarity)}`;
  const descLine = `${i18n.getWeaponText(wDrop.id).desc}`;

  const body = ui.add.text(
    px + 12,
    py + 25,
    [statsLine1, statsLine2, descLine].join('\n'),
    createUiTextStyle({
      fontPxAt1080p: 13,
      weight: 600,
      color: PALETTE.BONE_WHITE,
      wordWrapWidth: pw - 24,
      resolution: textRes,
    }),
  );

  const tipText = ui.add.text(
    px + 12,
    py + ph - 18,
    i18n.t('ui.tooltip.firstPickupHint'),
    createUiTextStyle({
      fontPxAt1080p: 13,
      weight: 700,
      color: PALETTE.CYAN_FROST,
      resolution: textRes,
    }),
  );
  this.weaponCompareContainer.add([body, tipText]);
}

export function updateEmoteWheelHudImpl(this: GameScene): void {
  const ui = this.uiScene;
  const showWheel =
    this.emoteWheelOpen &&
    !this.fullMapOpen &&
    !this.pauseModalOpen &&
    !(this.settingsModal?.isOpen() ?? false);
  const hash = showWheel ? `${this.emoteWheelHoveredId ?? 0}:${i18n.getLocale()}` : '';
  if (hash === this.lastEmoteWheelHash) return;
  this.lastEmoteWheelHash = hash;

  this.emoteWheelContainer.removeAll(true);
  if (!showWheel) return;

  const textRes = computeUiTextResolution(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    ui.cameras?.main?.zoom || 2,
    this.currentHudUiScale || 1,
  );
  const isEn = i18n.getLocale() === 'en';
  const cx = 480;
  const cy = 270;

  const bg = ui.add.graphics();
  bg.fillStyle(UI_THEME.panelBgDark, 0.85);
  bg.lineStyle(2, hexToNum(PALETTE.SOLAR_GOLD), 0.9);
  bg.fillCircle(cx, cy, 44);
  bg.strokeCircle(cx, cy, 44);
  this.emoteWheelContainer.add(bg);

  const centerTxt = ui.add
    .text(
      cx,
      cy,
      isEn ? '[T] EMOTE' : '[T] BIỂU CẢM',
      createUiTextStyle({
        fontPxAt1080p: 14,
        weight: 800,
        color: PALETTE.SOLAR_GOLD,
        align: 'center',
        resolution: textRes,
      }),
    )
    .setOrigin(0.5);
  this.emoteWheelContainer.add(centerTxt);

  const cards: { id: QuickEmoteId; x: number; y: number }[] = [
    { id: 1, x: 480, y: 196 },
    { id: 2, x: 606, y: 270 },
    { id: 3, x: 480, y: 344 },
    { id: 4, x: 354, y: 270 },
  ];

  const cardW = 128;
  const cardH = 34;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]!;
    const isHovered = this.emoteWheelHoveredId === c.id;
    const cardG = ui.add.graphics();
    drawStyledPanel(cardG, c.x - cardW / 2, c.y - cardH / 2, cardW, cardH, {
      fillColor: isHovered ? UI_THEME.panelBgElevated : UI_THEME.panelBgDark,
      fillAlpha: isHovered ? 0.96 : 0.88,
      borderColor: hexToNum(isHovered ? PALETTE.SOLAR_GOLD : PALETTE.CYAN_FROST),
      borderWidth: isHovered ? 2.2 : 1.5,
      radius: UI_THEME.panelRadius.md,
    });

    const txt = ui.add
      .text(
        c.x,
        c.y,
        `[${c.id}] ${i18n.emoteText(c.id)}`,
        createUiTextStyle({
          fontPxAt1080p: 15,
          weight: 800,
          color: isHovered ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE,
          resolution: textRes,
        }),
      )
      .setOrigin(0.5);

    this.emoteWheelContainer.add([cardG, txt]);
  }
}
