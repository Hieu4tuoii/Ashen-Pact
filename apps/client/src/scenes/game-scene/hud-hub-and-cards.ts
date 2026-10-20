import {
  CHARACTERS,
  type CharacterId,
  generateQrMatrix,
  i18n,
  PLAYER_SLOT_COLORS,
  type QuickEmoteId,
  WEAPON_RARITY_COLORS,
  WEAPONS,
} from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { type GameScene } from '../GameScene.js';

export function updateHubInvitePanelImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  const showPanel = sim.inHub && this.invitePanelVisible && !this.fullMapOpen;
  const allPlayers = sim.getAllPlayers();
  const playersKey = allPlayers
    .map((pl) => `${pl.id}:${pl.slot}:${pl.displayName}:${pl.characterId}:${pl.ready ? 1 : 0}`)
    .join('|');
  const hash = !showPanel
    ? ''
    : `${this.primaryLanIp}:${this.serverPort}:${this.hostInviteUrl ?? ''}:${sim.allowDuplicateCharacters ? 1 : 0}:${this.copyToastTimer > 0 ? 1 : 0}:${playersKey}:${i18n.getLocale()}`;

  if (hash === this.lastInvitePanelHash) return;
  this.lastInvitePanelHash = hash;

  this.invitePanelContainer.removeAll(true);
  if (!showPanel) return;

  const textRes = TextureBaker.getBakeScale();
  const px = 676;
  const py = 184;
  const pw = 272;
  const ph = 286;

  const bg = this.add.graphics();
  bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.92);
  bg.lineStyle(2.5, hexToNum(PALETTE.SOLAR_GOLD), 0.95);
  bg.fillRoundedRect(px, py, pw, ph, 9);
  bg.strokeRoundedRect(px, py, pw, ph, 9);
  this.invitePanelContainer.add(bg);

  const header = this.add.text(px + 10, py + 7, i18n.t('ui.hud.coopInviteHeader'), {
    fontFamily: '"Be Vietnam Pro", sans-serif',
    fontSize: '11px',
    fontStyle: '800',
    color: PALETTE.SOLAR_GOLD,
    stroke: PALETTE.INK_DARK,
    strokeThickness: 3,
    resolution: textRes,
  });
  const ipText = this.add.text(
    px + 10,
    py + 23,
    `${i18n.t('ui.menu.ipLabel')}: ${this.primaryLanIp}:${this.serverPort}`,
    {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '10px',
      fontStyle: '700',
      color: PALETTE.CYAN_FROST,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 2.5,
      resolution: textRes,
    },
  );
  this.invitePanelContainer.add([header, ipText]);

  // Procedural Vector QR Code (ISO/IEC 18004)
  const qrUrl = this.hostInviteUrl ?? `http://${this.primaryLanIp}:${this.serverPort}/?coop=join`;
  const qrMatrix = generateQrMatrix(qrUrl);
  const qrSize = qrMatrix.length;
  const qrBoxSize = 78;
  const qrX = px + 10;
  const qrY = py + 42;
  const quietZone = 2;
  const totalModules = qrSize + quietZone * 2;
  const cellPx = qrBoxSize / totalModules;

  const qrG = this.add.graphics();
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

  // Helper for compact buttons next to QR code
  const makePanelBtn = (
    bx: number,
    by: number,
    bw: number,
    bh: number,
    label: string,
    fillHex: string,
    onClick: () => void,
  ) => {
    const btnG = this.add.graphics();
    btnG.fillStyle(hexToNum(fillHex), 0.95);
    btnG.lineStyle(1.8, hexToNum(PALETTE.INK_DARK), 1);
    btnG.fillRoundedRect(bx, by, bw, bh, 5);
    btnG.strokeRoundedRect(bx, by, bw, bh, 5);

    const txt = this.add
      .text(bx + bw / 2, by + bh / 2, label, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '9.5px',
        fontStyle: '800',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      })
      .setOrigin(0.5, 0.5);

    const hit = this.add
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
    23,
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
    qrY + 27,
    btnW,
    23,
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
    qrY + 54,
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
    const rowY = listStartY + (slotIdx - 1) * 28;
    const pl = allPlayers.find((item) => item.slot === slotIdx);
    const slotColor = PLAYER_SLOT_COLORS[slotIdx as 1 | 2 | 3 | 4];

    const rowG = this.add.graphics();
    rowG.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.9);
    rowG.lineStyle(1.5, hexToNum(pl ? slotColor : PALETTE.INK_DARK), 0.9);
    rowG.fillRoundedRect(px + 10, rowY, pw - 20, 24, 5);
    rowG.strokeRoundedRect(px + 10, rowY, pw - 20, 24, 5);
    this.invitePanelContainer.add(rowG);

    if (pl) {
      const charDef = CHARACTERS[pl.characterId] ?? CHARACTERS.vanguard;
      const charName = i18n.charName(pl.characterId, charDef.nameVi);
      const rdyStr = pl.ready ? i18n.t('ui.hud.readyShort') : i18n.t('ui.hud.selectingChar');
      const hasKickBtn = sim.player.slot === 1 && pl.slot !== 1;
      const rowTxt = this.add.text(
        px + 15,
        rowY + 5.5,
        `P${pl.slot} · ${pl.displayName} (${charName}) — ${rdyStr}`,
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: hasKickBtn ? '8.2px' : '9px',
          fontStyle: '700',
          color: pl.ready ? PALETTE.LIME_GLOW : slotColor,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2,
          resolution: textRes,
        },
      );
      this.invitePanelContainer.add(rowTxt);

      if (hasKickBtn) {
        makePanelBtn(
          px + pw - 56,
          rowY + 3,
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
        );
      }
    } else {
      const emptyTxt = this.add.text(
        px + 16,
        rowY + 5,
        `P${slotIdx} · ${i18n.t('ui.hud.emptySlot')}`,
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '9px',
          color: PALETTE.ASH_GRAY,
          resolution: textRes,
        },
      );
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
  const emY = py + ph - 26;
  const emW = 60;
  emotes.forEach((em, idx) => {
    makePanelBtn(
      px + 10 + idx * (emW + 4),
      emY,
      emW,
      20,
      `[${em.key}] ${i18n.emoteText(em.id)}`,
      PALETTE.SLATE_MID,
      () => {
        this.queuedEmote = em.id;
      },
    );
  });
}

export function updateHubCharacterSkillPreviewImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  const debug = initGlobalDebugState();
  let nearestCharId: CharacterId | null = null;
  let bestDist = 72;

  if (sim.inHub && !this.fullMapOpen && !debug.overlayVisible) {
    for (let i = 0; i < sim.hubStatues.length; i++) {
      const st = sim.hubStatues[i]!;
      const d = Math.hypot(sim.player.x - st.x, sim.player.y - st.y);
      if (d <= bestDist) {
        bestDist = d;
        nearestCharId = st.characterId;
      }
    }
  }

  debug.hubPreviewCharacterId = nearestCharId;
  const isEquipped = nearestCharId === sim.player.characterId;
  const hash = nearestCharId ? `${nearestCharId}:${isEquipped ? 1 : 0}:${i18n.getLocale()}` : '';

  if (hash === this.lastHubPreviewHash) return;
  this.lastHubPreviewHash = hash;

  this.hubPreviewContainer.removeAll(true);
  if (!nearestCharId) return;

  const cDef = CHARACTERS[nearestCharId];
  if (!cDef) return;
  const charTxt = i18n.getCharacterText(nearestCharId);
  const isEn = i18n.getLocale() === 'en';

  const textRes = TextureBaker.getBakeScale();
  const px = 14;
  const py = 302;
  const pw = 542;
  const ph = 158;

  const bg = this.add.graphics();
  bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.99);
  bg.lineStyle(2.5, hexToNum(isEquipped ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD), 0.96);
  bg.fillRoundedRect(px, py, pw, ph, 8);
  bg.strokeRoundedRect(px, py, pw, ph, 8);
  this.hubPreviewContainer.add(bg);

  const statusBadge = isEquipped
    ? i18n.t('ui.hud.equippedBadge')
    : i18n.t('ui.hud.pressEToSelect');
  const header = this.add.text(
    px + 12,
    py + 7,
    `${charTxt.name.toUpperCase()} — ${charTxt.title}`,
    {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '9.8px',
      fontStyle: '800',
      color: isEquipped ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    },
  );

  const spdLabel = isEn ? 'Spd' : 'Tốc';
  const statsBadge = this.add
    .text(
      px + pw - 12,
      py + 7.5,
      `[${statusBadge}] · HP ${cDef.hp} · ${i18n.t('ui.hud.armor')} ${cDef.armor} · ${i18n.t('ui.hud.energy')} ${cDef.energy} · ${spdLabel} ${cDef.moveSpeed}`,
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '8.6px',
        fontStyle: '700',
        color: PALETTE.CYAN_FROST,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      },
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
        `• Kỹ năng [Q] (${charTxt.skillName} · Hồi ${cDef.skill.cooldownSec}s): ${charTxt.skillDesc}`,
        `• Nâng cấp: (1) ${upg1Txt.name}: ${upg1Txt.desc} | (2) ${upg2Txt.name}: ${upg2Txt.desc}`,
        `• Synergy Co-op: ${charTxt.synergy}`,
      ].join('\n');

  const body = this.add.text(px + 12, py + 25, bodyLines, {
    fontFamily: '"Be Vietnam Pro", sans-serif',
    fontSize: '8.7px',
    fontStyle: '600',
    color: PALETTE.BONE_WHITE,
    stroke: PALETTE.INK_DARK,
    strokeThickness: 2,
    lineSpacing: 2.2,
    wordWrap: { width: pw - 24 },
    resolution: textRes,
  });

  this.hubPreviewContainer.add([header, statsBadge, body]);
}

export function updateWeaponComparisonCardImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  const debug = initGlobalDebugState();
  let nearestWeaponItem: (typeof sim.worldItems)[number] | null = null;
  let bestDist = 64;

  if (
    sim.runState === 'playing' &&
    !this.fullMapOpen &&
    !this.pauseModalOpen &&
    !(this.settingsModal?.isOpen() ?? false) &&
    !debug.overlayVisible &&
    debug.hubPreviewCharacterId === null
  ) {
    for (let i = 0; i < sim.worldItems.length; i++) {
      const it = sim.worldItems[i]!;
      if (it.pickedUp || it.kind !== 'weapon' || !it.weaponId) continue;
      if (
        it.ownerPlayerId !== undefined &&
        it.ownerPlayerId !== 0 &&
        it.ownerPlayerId !== sim.player.id
      ) {
        continue;
      }
      const d = Math.hypot(sim.player.x - it.x, sim.player.y - it.y);
      if (d <= bestDist) {
        bestDist = d;
        nearestWeaponItem = it;
      }
    }
  }

  const dropWId = nearestWeaponItem?.weaponId ?? null;
  debug.weaponComparisonVisible = dropWId !== null;
  debug.comparedWeaponId = dropWId;

  const currWId = sim.getActiveWeaponId();
  const hash = dropWId
    ? `${dropWId}:${currWId}:${nearestWeaponItem?.costGold ?? 0}:${i18n.getLocale()}`
    : '';
  if (hash === this.lastWeaponCompareHash) return;
  this.lastWeaponCompareHash = hash;

  this.weaponCompareContainer.removeAll(true);
  if (!dropWId || !nearestWeaponItem) return;

  const wDrop = WEAPONS[dropWId] ?? WEAPONS.rusty_pistol!;
  const wCurr = WEAPONS[currWId] ?? WEAPONS.rusty_pistol!;
  const textRes = TextureBaker.getBakeScale();
  const px = 230;
  const py = 356;
  const pw = 500;
  const ph = 122;

  const bg = this.add.graphics();
  bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.96);
  bg.lineStyle(2.5, hexToNum(WEAPON_RARITY_COLORS[wDrop.rarity]), 0.96);
  bg.fillRoundedRect(px, py, pw, ph, 8);
  bg.strokeRoundedRect(px, py, pw, ph, 8);
  this.weaponCompareContainer.add(bg);

  const dropTotalDmg = wDrop.damage * Math.max(1, wDrop.pelletCount);
  const currTotalDmg = wCurr.damage * Math.max(1, wCurr.pelletCount);
  const dmgDiff = dropTotalDmg - currTotalDmg;
  const rateDiff = Math.round((wDrop.fireRate - wCurr.fireRate) * 10) / 10;
  const nrgDiff = wDrop.energyCost - wCurr.energyCost;
  const dropDps = Math.round(dropTotalDmg * wDrop.fireRate * (1 + wDrop.critChance * 0.5));
  const currDps = Math.round(currTotalDmg * wCurr.fireRate * (1 + wCurr.critChance * 0.5));
  const dpsDiff = dropDps - currDps;

  const fmtDelta = (diff: number, invertGood = false) => {
    if (Math.abs(diff) < 0.05) return '(=)';
    const isGood = invertGood ? diff < 0 : diff > 0;
    const sign = diff > 0 ? '+' : '';
    return isGood ? `▲ ${sign}${diff}` : `▼ ${sign}${diff}`;
  };

  const dropName = i18n.weaponName(wDrop.id, wDrop.nameVi);
  const currName = i18n.weaponName(wCurr.id, wCurr.nameVi);
  const costSuffix =
    nearestWeaponItem.costGold > 0
      ? ` (${nearestWeaponItem.costGold} ${i18n.t('ui.hud.gold')})`
      : '';

  const header = this.add.text(
    px + 12,
    py + 7,
    `★ ${dropName.toUpperCase()}${costSuffix}  ⇄  ${currName}   ·   DPS ~${dropDps} (${fmtDelta(dpsDiff)})`,
    {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '9.8px',
      fontStyle: '800',
      color: WEAPON_RARITY_COLORS[wDrop.rarity],
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    },
  );
  this.weaponCompareContainer.add(header);

  const statsLine1 = `${i18n.t('ui.hud.weaponCompareDmg')}: ${wDrop.damage}${wDrop.pelletCount > 1 ? `×${wDrop.pelletCount}` : ''} (${fmtDelta(dmgDiff)})   ·   ${i18n.t('ui.hud.weaponCompareFireRate')}: ${wDrop.fireRate}/s (${fmtDelta(rateDiff)})   ·   ${i18n.t('ui.hud.weaponCompareEnergy')}: ${wDrop.energyCost} (${fmtDelta(nrgDiff, true)})`;
  const statsLine2 = `${i18n.t('ui.hud.weaponCompareCrit')}: ${Math.round(wDrop.critChance * 100)}%   ·   ${i18n.t('ui.tooltip.element')}: ${i18n.elementName(wDrop.element)}   ·   [E] ${i18n.t('ui.hud.weaponCompareSwap')}`;
  const descLine = `${i18n.getWeaponText(wDrop.id).desc}`;

  const body = this.add.text(px + 12, py + 26, [statsLine1, statsLine2, descLine].join('\n'), {
    fontFamily: '"Be Vietnam Pro", sans-serif',
    fontSize: '8.9px',
    fontStyle: '700',
    color: PALETTE.BONE_WHITE,
    stroke: PALETTE.INK_DARK,
    strokeThickness: 2.2,
    lineSpacing: 3,
    wordWrap: { width: pw - 24 },
    resolution: textRes,
  });
  const tipText = this.add.text(px + 12, py + ph - 19, i18n.t('ui.tooltip.firstPickupHint'), {
    fontFamily: '"Be Vietnam Pro", sans-serif',
    fontSize: '8.3px',
    fontStyle: '700',
    color: PALETTE.CYAN_FROST,
    stroke: PALETTE.INK_DARK,
    strokeThickness: 2,
    resolution: textRes,
  });
  this.weaponCompareContainer.add([body, tipText]);
}

export function updateEmoteWheelHudImpl(this: GameScene): void {
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

  const textRes = TextureBaker.getBakeScale();
  const isEn = i18n.getLocale() === 'en';
  const cx = 480;
  const cy = 270;

  const bg = this.add.graphics();
  bg.fillStyle(hexToNum(PALETTE.INK_DARK), 0.72);
  bg.lineStyle(2, hexToNum(PALETTE.SOLAR_GOLD), 0.85);
  bg.fillCircle(cx, cy, 44);
  bg.strokeCircle(cx, cy, 44);
  this.emoteWheelContainer.add(bg);

  const centerTxt = this.add
    .text(cx, cy, isEn ? '[T] EMOTE' : '[T] BIỂU CẢM', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '9.5px',
      fontStyle: '800',
      color: PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      align: 'center',
      resolution: textRes,
    })
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
    const cardG = this.add.graphics();
    cardG.fillStyle(
      hexToNum(isHovered ? PALETTE.SLATE_MID : PALETTE.INK_DEEP),
      isHovered ? 0.98 : 0.9,
    );
    cardG.lineStyle(
      isHovered ? 2.5 : 2,
      hexToNum(isHovered ? PALETTE.SOLAR_GOLD : PALETTE.CYAN_FROST),
      1,
    );
    cardG.fillRoundedRect(c.x - cardW / 2, c.y - cardH / 2, cardW, cardH, 8);
    cardG.strokeRoundedRect(c.x - cardW / 2, c.y - cardH / 2, cardW, cardH, 8);

    const txt = this.add
      .text(c.x, c.y, `[${c.id}] ${i18n.emoteText(c.id)}`, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '10.5px',
        fontStyle: '800',
        color: isHovered ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.8,
        resolution: textRes,
      })
      .setOrigin(0.5);

    this.emoteWheelContainer.add([cardG, txt]);
  }
}
