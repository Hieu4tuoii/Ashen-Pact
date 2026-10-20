import {
  CHARACTERS,
  clamp,
  type DungeonRoomNode,
  type ElementType,
  ENEMIES,
  i18n,
  PHASE1_SAMPLE_WEAPONS,
  PLAYER_SLOT_COLORS,
  WEAPON_RARITY_COLORS,
  WEAPONS,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { isEffectiveDebugUiEnabled } from '../../core/debug-flag.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import { type GameScene } from '../GameScene.js';
import { syncHudDebugVisibility } from './hud-setup-and-pause.js';

export function updateVectorHudImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  const p = sim.player;
  const curLocale = i18n.getLocale();
  if (curLocale !== this.lastHudLocale) {
    this.lastHudLocale = curLocale;
    this.invalidateAllHudCaches();
  }
  syncHudDebugVisibility(this);

  const hpRatio = clamp(p.hp / Math.max(1, p.maxHp), 0, 1);
  const armorRatio = clamp(p.armor / Math.max(1, p.maxArmor), 0, 1);
  const trailingAnimating =
    Math.abs(this.trailingHpRatio - hpRatio) > 0.004 ||
    Math.abs(this.trailingArmorRatio - armorRatio) > 0.004;
  const lowHpPulse = p.hp > 0 && p.hp <= 2 && sim.tick % 10 === 0;

  if (
    p.hp !== this.lastHudHp ||
    p.armor !== this.lastHudArmor ||
    p.energy !== this.lastHudEnergy ||
    p.characterId !== this.lastHudCharacterId ||
    trailingAnimating ||
    lowHpPulse
  ) {
    this.lastHudHp = p.hp;
    this.lastHudArmor = p.armor;
    this.lastHudEnergy = p.energy;
    this.lastHudCharacterId = p.characterId;

    const g = this.hudBarsGraphics;
    g.clear();

    const drawStatBar = (
      x: number,
      y: number,
      w: number,
      h: number,
      ratio: number,
      trailingRatio: number,
      fillHex: string,
      trailingHex: string,
      borderHex: string,
    ) => {
      g.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.95);
      g.lineStyle(2, hexToNum(borderHex), 1);
      g.fillRoundedRect(x, y, w, h, 5);
      if (trailingRatio > ratio + 0.003) {
        g.fillStyle(hexToNum(trailingHex), 0.85);
        g.fillRoundedRect(
          x + 2,
          y + 2,
          Math.max(4, (w - 4) * clamp(trailingRatio, 0, 1)),
          h - 4,
          3.5,
        );
      }
      if (ratio > 0) {
        g.fillStyle(hexToNum(fillHex), 1);
        g.fillRoundedRect(x + 2, y + 2, Math.max(4, (w - 4) * clamp(ratio, 0, 1)), h - 4, 3.5);
      }
      g.strokeRoundedRect(x, y, w, h, 5);
    };

    const hpBorder =
      p.hp > 0 && p.hp <= 2 && Math.floor(sim.tick / 10) % 2 === 0
        ? PALETTE.CRIMSON_BRIGHT
        : PALETTE.INK_DARK;

    // HP, Armor, Energy bars with smooth trailing damage bars
    drawStatBar(
      22,
      13,
      124,
      20,
      hpRatio,
      this.trailingHpRatio,
      PALETTE.RUBY_CORE,
      PALETTE.SOLAR_GOLD,
      hpBorder,
    );
    drawStatBar(
      156,
      13,
      124,
      20,
      armorRatio,
      this.trailingArmorRatio,
      PALETTE.STEEL_LIGHT,
      PALETTE.CRIMSON_BRIGHT,
      PALETTE.INK_DARK,
    );
    drawStatBar(
      290,
      13,
      136,
      20,
      p.energy / Math.max(1, p.maxEnergy),
      p.energy / Math.max(1, p.maxEnergy),
      PALETTE.AZURE_CORE,
      PALETTE.AZURE_CORE,
      PALETTE.INK_DARK,
    );

    const charDef = CHARACTERS[p.characterId] ?? CHARACTERS.vanguard;
    const charName = i18n.charName(p.characterId, charDef.nameVi);
    this.hpLabelText.setText(`${charName} · ${i18n.t('ui.hud.hp')} ${p.hp}/${p.maxHp}`);
    this.armorLabelText.setText(`${i18n.t('ui.hud.armor')} ${p.armor}/${p.maxArmor}`);
    this.energyLabelText.setText(`${i18n.t('ui.hud.energy')} ${p.energy}/${p.maxEnergy}`);
  }

  // Update Bottom-Left Skill [Space] & Dash [Shift] Cooldown Sweep Cards
  if (this.abilityHudGraphics) {
    const ag = this.abilityHudGraphics;
    ag.clear();
    const barY = 486;
    const cardW = 62;
    const cardH = 44;

    const cDef = CHARACTERS[p.characterId] ?? CHARACTERS.vanguard;
    const skillMaxCd = Math.max(0.5, cDef.skill.cooldownSec);
    const skillReadyRatio =
      p.skillActiveTimer > 0 ? 1 : clamp(1 - p.skillCooldownTimer / skillMaxCd, 0, 1);
    const skillBorder =
      p.skillActiveTimer > 0
        ? PALETTE.SOLAR_GOLD
        : p.skillCooldownTimer <= 0
          ? PALETTE.LIME_GLOW
          : PALETTE.INK_DARK;

    ag.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.92);
    ag.fillRoundedRect(14, barY, cardW, cardH, 7);
    if (skillReadyRatio > 0) {
      const fillH = (cardH - 4) * skillReadyRatio;
      ag.fillStyle(
        hexToNum(p.skillActiveTimer > 0 ? PALETTE.SOLAR_GOLD : PALETTE.FOREST_SHADE),
        p.skillCooldownTimer <= 0 ? 0.55 : 0.35,
      );
      ag.fillRoundedRect(16, barY + cardH - 2 - fillH, cardW - 4, fillH, 5);
    }
    ag.lineStyle(2, hexToNum(skillBorder), 1);
    ag.strokeRoundedRect(14, barY, cardW, cardH, 7);

    const dashMaxCd = 1.2;
    const dashReadyRatio = clamp(1 - p.dashCooldownTimer / dashMaxCd, 0, 1);
    const dashBorder = p.dashCooldownTimer <= 0 ? PALETTE.CYAN_FROST : PALETTE.INK_DARK;

    ag.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.92);
    ag.fillRoundedRect(80, barY, cardW, cardH, 7);
    if (dashReadyRatio > 0) {
      const fillH = (cardH - 4) * dashReadyRatio;
      ag.fillStyle(hexToNum(PALETTE.COBALT_SHADE), p.dashCooldownTimer <= 0 ? 0.55 : 0.35);
      ag.fillRoundedRect(82, barY + cardH - 2 - fillH, cardW - 4, fillH, 5);
    }
    ag.lineStyle(2, hexToNum(dashBorder), 1);
    ag.strokeRoundedRect(80, barY, cardW, cardH, 7);

    if (this.skillCdText) {
      const skTxt =
        p.skillActiveTimer > 0
          ? `${p.skillActiveTimer.toFixed(1)}s`
          : p.skillCooldownTimer <= 0
            ? i18n.t('ui.hud.ready')
            : `${p.skillCooldownTimer.toFixed(1)}s`;
      if (this.skillCdText.text !== skTxt) this.skillCdText.setText(skTxt);
      this.skillCdText.setColor(
        p.skillActiveTimer > 0
          ? PALETTE.SOLAR_GOLD
          : p.skillCooldownTimer <= 0
            ? PALETTE.LIME_GLOW
            : PALETTE.ASH_GRAY,
      );
    }
    if (this.dashCdText) {
      const dTxt =
        p.dashCooldownTimer <= 0 ? i18n.t('ui.hud.ready') : `${p.dashCooldownTimer.toFixed(1)}s`;
      if (this.dashCdText.text !== dTxt) this.dashCdText.setText(dTxt);
      this.dashCdText.setColor(p.dashCooldownTimer <= 0 ? PALETTE.CYAN_FROST : PALETTE.ASH_GRAY);
    }
  }

  if (sim.tick % 12 === 0 || sim.inHub || !this.lastHudStatsText) {
    const dps = sim.getRollingDps();
    const room = sim.getCurrentRoom();
    const roomLabel = sim.inHub ? i18n.t('ui.hud.hub') : i18n.roomTypeName(room.type);
    const dashReady =
      p.dashCooldownTimer <= 0 ? i18n.t('ui.hud.ready') : `${p.dashCooldownTimer.toFixed(1)}s`;
    const skillReady =
      p.skillActiveTimer > 0
        ? `${i18n.t('ui.hud.active')} (${p.skillActiveTimer.toFixed(1)}s)`
        : p.skillCooldownTimer <= 0
          ? i18n.t('ui.hud.ready')
          : `${p.skillCooldownTimer.toFixed(1)}s`;

    const nextElem: ElementType =
      p.activeImbueElement === 'burn'
        ? 'chill'
        : p.activeImbueElement === 'chill'
          ? 'shock'
          : 'burn';
    const cycleTag =
      p.characterId === 'elementalist'
        ? ` · ${i18n.t('ui.hud.cycle')}: ${i18n.elementShortName(p.activeImbueElement)}→${i18n.elementShortName(nextElem)}`
        : '';
    const comboTag =
      sim.teamComboCount > 0 ? ` · ${i18n.t('ui.hud.teamCombo')}: ${sim.teamComboCount}` : '';
    const skShort = curLocale === 'en' ? 'Skill' : 'KN';

    const showDebug = isEffectiveDebugUiEnabled(this.coopMode !== 'solo');
    const dpsSegment = showDebug ? ` · DPS ${dps.toFixed(1)}` : '';
    const nextStats = sim.inHub
      ? i18n.t('ui.hud.hubStatsHint', { count: sim.getActivePlayerCount() })
      : `${i18n.t('ui.hud.floor')} ${sim.currentFloor}/${sim.campaignMaxFloors} (${roomLabel})${dpsSegment} · ${i18n.t('ui.hud.gold')} ${p.gold} · ${i18n.t('ui.hud.wave')} ${sim.waveNumber} · Dash ${dashReady} · ${skShort} ${skillReady}${cycleTag}${comboTag}`;
    const statsCacheKey = `${showDebug ? '1' : '0'}:${nextStats}`;
    if (statsCacheKey !== this.lastHudStatsText) {
      this.lastHudStatsText = statsCacheKey;
      this.statsLineText.setText(nextStats);
    }
  }

  const elemKey = `${p.activeImbueElement}:${curLocale}`;
  if (this.elementBtnText && elemKey !== this.lastHudElement) {
    this.lastHudElement = elemKey;
    this.elementBtnText.setText(
      `${i18n.t('ui.hud.elementBtn')}: ${i18n.elementName(p.activeImbueElement)}`,
    );
  }

  const q = graphicsSettings.getState().quality;
  const qKey = `${q}:${curLocale}`;
  if (this.qualityBtnText && qKey !== this.lastHudQuality) {
    this.lastHudQuality = qKey;
    const qLabel =
      q === 'high'
        ? i18n.t('ui.settings.qualityHigh')
        : q === 'medium'
          ? i18n.t('ui.settings.qualityMedium')
          : i18n.t('ui.settings.qualityLow');
    this.qualityBtnText.setText(`${i18n.t('ui.hud.qualityBtn')}: ${qLabel}`);
  }

  // Update 4-slot Weapon Bar when active slot or equipped weapons change
  const weaponHash = `${p.activeWeaponSlot}:${p.weaponSlots.join(',')}:${curLocale}`;
  if (weaponHash !== this.lastHudWeaponHash) {
    this.lastHudWeaponHash = weaponHash;
    const slotW = 166;
    const slotH = 44;
    const startX = 148;
    const barY = 486;
    const invBake = 1 / TextureBaker.getBakeScale();
    const dmgPrefix = curLocale === 'en' ? 'DMG' : 'ST';
    const nrgPrefix = i18n.t('ui.hud.energy');

    this.weaponSlotBgs.forEach((slotBg, idx) => {
      const wId = p.weaponSlots[idx] ?? PHASE1_SAMPLE_WEAPONS[idx]!;
      const wDef = WEAPONS[wId] ?? WEAPONS.rusty_pistol!;
      const isSelected = idx === p.activeWeaponSlot;
      const sx = startX + idx * (slotW + 8);
      const rarityHex = WEAPON_RARITY_COLORS[wDef.rarity];

      slotBg.clear();
      slotBg.fillStyle(
        hexToNum(isSelected ? PALETTE.SLATE_MID : PALETTE.SLATE_DARK),
        isSelected ? 0.96 : 0.86,
      );
      slotBg.lineStyle(
        isSelected ? 2.5 : 2,
        hexToNum(isSelected ? PALETTE.SOLAR_GOLD : rarityHex),
        1,
      );
      slotBg.fillRoundedRect(sx, barY, slotW, slotH, 8);
      slotBg.strokeRoundedRect(sx, barY, slotW, slotH, 8);

      const icon = this.weaponIconSprites[idx];
      if (icon) {
        icon.setTexture(TextureBaker.getWeaponTextureKey(wId));
        icon.setScale(invBake * 0.82);
      }
      const nameTxt = this.weaponNameTexts[idx];
      if (nameTxt) {
        nameTxt.setText(`[${idx + 1}] ${i18n.weaponName(wId, wDef.nameVi)}`);
        nameTxt.setColor(rarityHex);
      }
      const metaTxt = this.weaponMetaTexts[idx];
      if (metaTxt) {
        metaTxt.setText(
          `${dmgPrefix} ${wDef.damage}${wDef.pelletCount > 1 ? `×${wDef.pelletCount}` : ''} · ${nrgPrefix} ${wDef.energyCost}`,
        );
      }
    });
  }

  if (!sim.stressTestActive) {
    this.updateMinimapHud();
    this.updateBossHud();
    this.updateCoopTeammateHud();
    this.updateHubInvitePanel();
    this.updateHubCharacterSkillPreview();
    this.updateWeaponComparisonCard();
    this.updateOffscreenTeammateArrows();
    this.updateModalHud();
  }
}

export function updateCoopTeammateHudImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  const debug = initGlobalDebugState();
  const remotes = sim.stressTestActive ? [] : sim.simulatedPlayers;
  const telemetry = this.networkTransport?.getTelemetry();
  const localHighPing = (telemetry?.rttMs ?? 0) > 100 ? 1 : 0;
  const resultModalActive =
    (sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed;
  const hash =
    debug.overlayVisible || remotes.length === 0 || resultModalActive
      ? ''
      : remotes
          .map(
            (r) =>
              `${r.id}:${r.slot}:${r.displayName}:${r.characterId}:${r.hp}:${r.maxHp}:${r.armor}:${r.lifeState}:${r.ready ? 1 : 0}:${Math.ceil(r.skillCooldownTimer)}:${r.pingMs}`,
          )
          .join('|') + `:${localHighPing}:${i18n.getLocale()}`;

  if (hash === this.lastCoopHudHash) return;
  this.lastCoopHudHash = hash;

  this.coopHudContainer.removeAll(true);
  if (!hash) return;

  const textRes = TextureBaker.getBakeScale();
  const cardW = 224;
  const cardH = 40;
  const startX = 14;
  const startY = 74;

  remotes.forEach((cp, idx) => {
    const cy = startY + idx * (cardH + 5);
    const slotHex = PLAYER_SLOT_COLORS[cp.slot];
    const charDef = CHARACTERS[cp.characterId] ?? CHARACTERS.vanguard;
    const charName = i18n.charName(cp.characterId, charDef.nameVi);
    const playerPing = Math.max(1, Math.round(cp.pingMs || (telemetry?.rttMs ?? 8)));
    const isHighPing = playerPing > 100;
    const skillReady = cp.skillCooldownTimer <= 0;

    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.88);
    bg.lineStyle(2, hexToNum(cp.lifeState === 'downed' ? PALETTE.CRIMSON_BRIGHT : slotHex), 1);
    bg.fillRoundedRect(startX, cy, cardW, cardH, 6);
    bg.strokeRoundedRect(startX, cy, cardW, cardH, 6);

    // Mini HP bar
    const hpRatio = clamp(cp.hp / Math.max(1, cp.maxHp), 0, 1);
    bg.fillStyle(hexToNum(PALETTE.SLATE_DARK), 1);
    bg.fillRect(startX + 8, cy + 21, 96, 7);
    bg.fillStyle(
      hexToNum(
        cp.lifeState === 'downed'
          ? PALETTE.CRIMSON_BRIGHT
          : cp.lifeState === 'ghost'
            ? PALETTE.CYAN_FROST
            : PALETTE.RUBY_CORE,
      ),
      1,
    );
    bg.fillRect(startX + 8, cy + 21, Math.max(2, 96 * hpRatio), 7);

    // Mini Armor bar
    const armorRatio = clamp(cp.armor / Math.max(1, cp.maxArmor), 0, 1);
    bg.fillStyle(hexToNum(PALETTE.SLATE_DARK), 1);
    bg.fillRect(startX + 8, cy + 30, 96, 4);
    if (armorRatio > 0) {
      bg.fillStyle(hexToNum(PALETTE.STEEL_LIGHT), 1);
      bg.fillRect(startX + 8, cy + 30, Math.max(2, 96 * armorRatio), 4);
    }

    this.coopHudContainer.add(bg);

    const skillTag = skillReady ? '[Q✓]' : `[Q ${Math.ceil(cp.skillCooldownTimer)}s]`;
    const stateTag =
      cp.lifeState === 'downed'
        ? i18n.t('ui.hud.downed')
        : cp.lifeState === 'ghost'
          ? i18n.t('ui.hud.ghost')
          : sim.inHub && cp.ready
            ? `${i18n.t('ui.hud.readyShort')} · ${skillTag}`
            : `HP ${cp.hp}/${cp.maxHp} · ${skillTag}`;

    const title = this.add.text(
      startX + 8,
      cy + 4,
      `[P${cp.slot}] ${cp.displayName} (${charName})`,
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '9.5px',
        fontStyle: '800',
        color: slotHex,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      },
    );
    const pingText = this.add
      .text(startX + cardW - 7, cy + 4, `${isHighPing ? '⚠' : ''}${playerPing}ms`, {
        fontFamily: '"Be Vietnam Pro", monospace',
        fontSize: '9px',
        fontStyle: '800',
        color: isHighPing ? PALETTE.SOLAR_GOLD : PALETTE.SILVER_BRIGHT,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      })
      .setOrigin(1, 0);
    const sub = this.add.text(startX + 110, cy + 20, stateTag, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '8.8px',
      fontStyle: '700',
      color:
        cp.lifeState === 'downed'
          ? PALETTE.CRIMSON_BRIGHT
          : skillReady
            ? PALETTE.LIME_GLOW
            : PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 2,
      resolution: textRes,
    });
    this.coopHudContainer.add([title, pingText, sub]);
  });
}

export function updateOffscreenTeammateArrowsImpl(this: GameScene): void {
  const g = this.offscreenArrowGraphics;
  g.clear();

  const sim = this.transport.getSim();
  if (sim.stressTestActive || sim.simulatedPlayers.length === 0) return;

  const view = this.cameras.main.worldView;
  if (!view || view.width <= 0) return;

  const margin = 26;
  const minX = margin;
  const maxX = WORLD_VIEW_WIDTH - margin;
  const minY = 74;
  const maxY = 472;

  for (let i = 0; i < sim.simulatedPlayers.length; i++) {
    const cp = sim.simulatedPlayers[i]!;
    if (cp.id === sim.player.id) continue;

    const pos = this.transport.getInterpolatedSimPlayerPos(cp, this.entityPosScratch);

    if (
      pos.x >= view.x &&
      pos.x <= view.x + view.width &&
      pos.y >= view.y &&
      pos.y <= view.y + view.height
    ) {
      continue;
    }

    const relX = pos.x - view.x;
    const relY = pos.y - view.y;
    const ax = clamp(relX, minX, maxX);
    const ay = clamp(relY, minY, maxY);
    const angle = Math.atan2(relY - WORLD_VIEW_HEIGHT * 0.5, relX - WORLD_VIEW_WIDTH * 0.5);

    const col = hexToNum(
      cp.lifeState === 'downed' ? PALETTE.CRIMSON_BRIGHT : PLAYER_SLOT_COLORS[cp.slot],
    );
    const tipX = ax + Math.cos(angle) * 10;
    const tipY = ay + Math.sin(angle) * 10;
    const leftX = ax + Math.cos(angle + 2.4) * 9;
    const leftY = ay + Math.sin(angle + 2.4) * 9;
    const rightX = ax + Math.cos(angle - 2.4) * 9;
    const rightY = ay + Math.sin(angle - 2.4) * 9;

    g.fillStyle(col, 0.95);
    g.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
    g.beginPath();
    g.moveTo(tipX, tipY);
    g.lineTo(leftX, leftY);
    g.lineTo(rightX, rightY);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }
}

export function updateMinimapHudImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  const room = sim.getCurrentRoom();
  const minimapHash = `${sim.inHub ? 'hub' : sim.currentFloor}:${sim.currentRoomId}:${this.fullMapOpen ? 1 : 0}:${sim.secretWallBroken ? 1 : 0}:${room.cleared ? 1 : 0}:${sim.runStats.roomsCleared}:${sim.pings.length}:${i18n.getLocale()}`;
  if (minimapHash === this.lastMinimapHash) return;
  this.lastMinimapHash = minimapHash;

  const g = this.minimapGraphics;
  g.clear();

  const roomTypeStr = sim.inHub ? i18n.roomTypeLabel('hub') : i18n.roomTypeLabel(room.type);
  const titleStr = this.fullMapOpen
    ? i18n.t('ui.minimap.fullTitle', {
        floor: sim.currentFloor,
        max: sim.campaignMaxFloors,
        roomType: roomTypeStr,
      })
    : sim.inHub
      ? i18n.t('ui.minimap.hubMini')
      : i18n.t('ui.minimap.floorMini', {
          floor: sim.currentFloor,
          max: sim.campaignMaxFloors,
          roomType: roomTypeStr,
        });
  if (this.minimapTitleText.text !== titleStr) {
    this.minimapTitleText.setText(titleStr);
  }

  const rooms = sim.dungeon.rooms;
  let minGx = 99;
  let maxGx = -99;
  let minGy = 99;
  let maxGy = -99;
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!;
    if (r.gx < minGx) minGx = r.gx;
    if (r.gx > maxGx) maxGx = r.gx;
    if (r.gy < minGy) minGy = r.gy;
    if (r.gy > maxGy) maxGy = r.gy;
  }

  const spanX = Math.max(1, maxGx - minGx + 1);
  const spanY = Math.max(1, maxGy - minGy + 1);

  const panelX = this.fullMapOpen ? 260 : 776;
  const panelY = this.fullMapOpen ? 105 : 72;
  const panelW = this.fullMapOpen ? 440 : 172;
  const panelH = this.fullMapOpen ? 310 : 108;

  this.minimapTitleText.setPosition(panelX + 8, panelY + 4);

  g.fillStyle(hexToNum(PALETTE.INK_DEEP), this.fullMapOpen ? 0.94 : 0.84);
  g.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
  g.fillRoundedRect(panelX, panelY, panelW, panelH, 7);
  g.strokeRoundedRect(panelX, panelY, panelW, panelH, 7);

  const cellStep = this.fullMapOpen
    ? Math.min(54, Math.floor((panelW - 60) / spanX), Math.floor((panelH - 64) / spanY))
    : Math.min(24, Math.floor((panelW - 24) / spanX), Math.floor((panelH - 32) / spanY));
  const nodeW = Math.floor(cellStep * 0.72);
  const nodeH = Math.floor(cellStep * 0.62);

  const originX = panelX + (panelW - (spanX - 1) * cellStep) * 0.5;
  const originY = panelY + 14 + (panelH - 18 - (spanY - 1) * cellStep) * 0.5;

  const isVisitedOrCleared = (rm: DungeonRoomNode) =>
    rm.discovery === 'visited' || rm.discovery === 'cleared';

  // 1. Corridors between discovered / adjacent rooms
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!;
    if (!isVisitedOrCleared(r)) continue;
    const cx = originX + (r.gx - minGx) * cellStep;
    const cy = originY + (r.gy - minGy) * cellStep;

    for (const targetId of Object.values(r.connections)) {
      if (targetId === undefined) continue;
      const target = rooms.find((rm) => rm.id === targetId);
      if (!target) continue;
      if (target.type === 'secret' && !r.secretWallBroken && !isVisitedOrCleared(target)) {
        continue;
      }

      const tx = originX + (target.gx - minGx) * cellStep;
      const ty = originY + (target.gy - minGy) * cellStep;
      g.lineStyle(2, hexToNum(PALETTE.ASH_GRAY), 0.75);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(tx, ty);
      g.strokePath();
    }
  }

  // 2. Room Nodes (Fog of War: visited/cleared rooms vs adjacent mystery rooms)
  const adjacentIds = new Set<number>();
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!;
    if (!isVisitedOrCleared(r)) continue;
    for (const tid of Object.values(r.connections)) {
      if (typeof tid === 'number') adjacentIds.add(tid);
    }
  }

  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i]!;
    const discovered = isVisitedOrCleared(r);
    const isVisible =
      discovered ||
      r.discovery === 'discovered' ||
      (adjacentIds.has(r.id) && (r.type !== 'secret' || room.secretWallBroken));
    if (!isVisible) continue;

    const cx = originX + (r.gx - minGx) * cellStep;
    const cy = originY + (r.gy - minGy) * cellStep;

    let fillHex: string = PALETTE.SLATE_MID;
    if (!discovered) {
      fillHex = PALETTE.SLATE_DARK;
    } else if (r.type === 'boss') {
      fillHex = PALETTE.RUBY_CORE;
    } else if (r.type === 'portal') {
      fillHex = PALETTE.ELECTRIC_VIOLET;
    } else if (r.type === 'treasure' || r.type === 'merchant') {
      fillHex = PALETTE.SOLAR_GOLD;
    } else if (r.type === 'shrine') {
      fillHex = PALETTE.CYAN_FROST;
    } else if (r.type === 'secret') {
      fillHex = PALETTE.TOXIC_PURPLE;
    } else if (r.cleared) {
      fillHex = PALETTE.GOBLIN_GREEN;
    }

    const isCurrent = r.id === sim.currentRoomId;
    g.fillStyle(hexToNum(fillHex), discovered ? 0.95 : 0.45);
    g.lineStyle(
      isCurrent ? 2.5 : 1.5,
      hexToNum(isCurrent ? PALETTE.BONE_WHITE : PALETTE.INK_DARK),
      1,
    );
    g.fillRoundedRect(cx - nodeW / 2, cy - nodeH / 2, nodeW, nodeH, 3);
    g.strokeRoundedRect(cx - nodeW / 2, cy - nodeH / 2, nodeW, nodeH, 3);

    if (isCurrent) {
      g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 1);
      g.fillCircle(cx, cy, this.fullMapOpen ? 4.5 : 2.8);
    }
  }
}

export function updateBossHudImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  const boss = sim.getActiveBoss();
  const stunActive = boss && boss.aiState === 'stunned' && boss.stateTimer > 0 ? 1 : 0;
  const coreWin = Math.ceil(sim.titanCoreWindowTimer);
  const trailKey = Math.round(this.trailingBossHpRatio * 200);
  const bossHash =
    !boss || this.fullMapOpen || sim.runState !== 'playing'
      ? ''
      : `${boss.defId}:${boss.id}:${boss.hp}:${boss.maxHp}:${boss.bossPhase}:${stunActive}:${coreWin}:${trailKey}:${i18n.getLocale()}`;
  if (bossHash === this.lastBossHudHash) return;
  this.lastBossHudHash = bossHash;

  const g = this.bossBarGraphics;
  g.clear();

  if (!boss || this.fullMapOpen || sim.runState !== 'playing') {
    this.bossTitleText.setVisible(false);
    return;
  }

  this.bossTitleText.setVisible(true);
  const bossDef = ENEMIES[boss.defId];
  const bossName = i18n
    .enemyName(boss.defId, bossDef?.nameVi ?? 'Mục Vương Nấm Độc')
    .toUpperCase();
  const statusSuffix =
    boss.aiState === 'stunned' && boss.stateTimer > 0
      ? i18n.t('ui.boss.stunned')
      : sim.titanCoreWindowTimer > 0
        ? i18n.t('ui.boss.breakCores', {
            sec: Math.ceil(sim.titanCoreWindowTimer),
          })
        : '';
  const titleStr = i18n.t('ui.boss.titleFormat', {
    name: bossName,
    phase: boss.bossPhase,
    hp: boss.hp,
    maxHp: boss.maxHp,
    suffix: statusSuffix,
  });
  if (this.bossTitleText.text !== titleStr) {
    this.bossTitleText.setText(titleStr);
  }

  const bx = 260;
  const by = 94;
  const bw = 440;
  const bh = 16;
  const ratio = clamp(boss.hp / boss.maxHp, 0, 1);

  g.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.94);
  g.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
  g.fillRoundedRect(bx, by, bw, bh, 5);

  if (this.trailingBossHpRatio > ratio + 0.003) {
    g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 0.85);
    g.fillRoundedRect(
      bx + 2,
      by + 2,
      Math.max(4, (bw - 4) * clamp(this.trailingBossHpRatio, 0, 1)),
      bh - 4,
      3.5,
    );
  }

  const fillHex =
    boss.defId === 'kryssa_ice_queen'
      ? boss.bossPhase === 3
        ? PALETTE.AZURE_CORE
        : PALETTE.CYAN_FROST
      : boss.defId === 'forge_titan'
        ? boss.bossPhase === 3
          ? PALETTE.MAGMA_RED
          : PALETTE.FLAME_ORANGE
        : boss.bossPhase === 3
          ? PALETTE.TOXIC_PURPLE
          : boss.bossPhase === 2
            ? PALETTE.FLAME_ORANGE
            : PALETTE.RUBY_CORE;
  if (ratio > 0) {
    g.fillStyle(hexToNum(fillHex), 1);
    g.fillRoundedRect(bx + 2, by + 2, Math.max(4, (bw - 4) * ratio), bh - 4, 3.5);
  }
  g.strokeRoundedRect(bx, by, bw, bh, 5);

  // Phase threshold notch markers at 66% and 33%
  for (const mark of [0.33, 0.66]) {
    const mx = bx + bw * mark;
    g.lineStyle(2, hexToNum(PALETTE.SOLAR_GOLD), 0.95);
    g.beginPath();
    g.moveTo(mx, by);
    g.lineTo(mx, by + bh);
    g.strokePath();
  }
}
