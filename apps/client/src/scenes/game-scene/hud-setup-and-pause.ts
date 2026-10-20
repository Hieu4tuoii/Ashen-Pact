import {
  i18n,
  MAX_WEAPON_SLOTS,
  VIETNAMESE_VERIFICATION_STRING,
  WEAPONS,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { musicManager } from '../../audio/music-synth.js';
import { zzfx } from '../../audio/zzfx.js';
import { isEffectiveDebugUiEnabled } from '../../core/debug-flag.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import { ModalOverlayManager } from '../../ui/settings-modal.js';
import { type GameScene } from '../GameScene.js';

export function syncHudDebugVisibility(scene: GameScene): void {
  const showDebug = isEffectiveDebugUiEnabled(scene.coopMode !== 'solo');
  const isEn = i18n.getLocale() === 'en';
  const nextStatus = showDebug
    ? isEn
      ? 'WASD: Move · Mouse: Shoot/Skill · Shift: Dash · R: Elem · G: Quality · F1-F7: Debug'
      : 'WASD: Chạy · Chuột: Bắn/Khiên · Shift: Dash · R: Ng.Tố · G: Đồ Họa · F1-F7: Debug'
    : isEn
      ? 'WASD: Move · Mouse: Shoot/Skill · Shift: Dash · E: Interact · Tab: Map'
      : 'WASD: Chạy · Chuột: Bắn/Kỹ năng · Shift: Dash · E: Tương tác · Tab: Bản đồ';
  if (scene.statusText && scene.statusText.text !== nextStatus) {
    scene.statusText.setText(nextStatus);
  }
  for (const btn of [scene.elementBtnText, scene.qualityBtnText, scene.galleryBtnText]) {
    if (!btn) continue;
    if (btn.visible !== showDebug) {
      btn.setVisible(showDebug);
      if (showDebug) {
        btn.setInteractive({ useHandCursor: true });
      } else {
        btn.disableInteractive();
      }
    }
  }
}

export function applyHudEdgeAnchors(scene: GameScene): void {
  const padX = scene.hudPadX;
  const padY = scene.hudPadY;

  if (scene.hudTopBarBg) {
    scene.hudTopBarBg.clear();
    scene.hudTopBarBg.fillStyle(hexToNum(PALETTE.INK_DARK), 0.72);
    scene.hudTopBarBg.fillRect(-padX, -padY, WORLD_VIEW_WIDTH + padX * 2, 66);
    scene.hudTopBarBg.lineStyle(1.5, hexToNum(PALETTE.SLATE_MID), 0.75);
    scene.hudTopBarBg.lineBetween(-padX, 66 - padY, WORLD_VIEW_WIDTH + padX, 66 - padY);
  }

  if (scene.hudBottomBarBg) {
    scene.hudBottomBarBg.clear();
    scene.hudBottomBarBg.fillStyle(hexToNum(PALETTE.INK_DARK), 0.78);
    scene.hudBottomBarBg.fillRect(-padX, 482 + padY, WORLD_VIEW_WIDTH + padX * 2, 58);
    scene.hudBottomBarBg.lineStyle(1.5, hexToNum(PALETTE.SLATE_MID), 0.8);
    scene.hudBottomBarBg.lineBetween(-padX, 482 + padY, WORLD_VIEW_WIDTH + padX, 482 + padY);
  }

  scene.hudTopLeftContainer?.setPosition(-padX, -padY);
  scene.hudTopCenterContainer?.setPosition(0, -padY);
  scene.hudTopRightContainer?.setPosition(padX, -padY);
  scene.hudBottomCenterContainer?.setPosition(0, padY);
  scene.coopHudContainer?.setPosition(-padX, -padY);
  scene.hubPreviewContainer?.setPosition(-padX, padY);
  scene.lastMinimapHash = '';
}

export function buildVectorHudImpl(this: GameScene): void {
  const ui = this.uiScene;
  const textRes = TextureBaker.getBakeScale();
  const invBake = 1 / textRes;

  this.hudContainer = ui.add.container(0, 0).setDepth(2000);

  this.hudTopBarBg = ui.add.graphics();
  this.hudBottomBarBg = ui.add.graphics();
  this.hudTopLeftContainer = ui.add.container(0, 0);
  this.hudTopCenterContainer = ui.add.container(0, 0);
  this.hudTopRightContainer = ui.add.container(0, 0);
  this.hudBottomCenterContainer = ui.add.container(0, 0);

  // 1. Top-Left HUD Bars & Stats
  this.hudBarsGraphics = ui.add.graphics();
  this.hudTopLeftContainer.add(this.hudBarsGraphics);

  const makeBarText = (x: number, y: number, initText: string) => {
    const t = ui.add.text(x, y, initText, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11px',
      fontStyle: '800',
      color: PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    });
    this.textObjects.push(t);
    this.hudTopLeftContainer?.add(t);
    return t;
  };

  this.hpLabelText = makeBarText(28, 15, 'HP 8/8');
  this.armorLabelText = makeBarText(162, 15, 'GIÁP 6/6');
  this.energyLabelText = makeBarText(296, 15, 'NL 150/150');

  this.statsLineText = ui.add.text(
    432,
    16.5,
    isEffectiveDebugUiEnabled(this.coopMode !== 'solo')
      ? `DPS: 0.0 · Đợt 1 | ${VIETNAMESE_VERIFICATION_STRING}`
      : 'Tầng 1/2 (Khởi Đầu) · Vàng 0 · Đợt 1 · Dash Sẵn Sàng · KN Sẵn Sàng',
    {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '9px',
      fontStyle: '700',
      color: PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 2.5,
      resolution: textRes,
    },
  );
  this.textObjects.push(this.statsLineText);
  this.hudTopLeftContainer.add(this.statsLineText);

  this.statusText = ui.add.text(
    24,
    44,
    'WASD: Chạy · Chuột: Bắn/Khiên · Shift: Dash · R: Ng.Tố · G: Đồ Họa · F1-F7: Debug',
    {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '10.5px',
      fontStyle: '600',
      color: PALETTE.CYAN_FROST,
      resolution: textRes,
    },
  );
  this.textObjects.push(this.statusText);
  this.hudTopLeftContainer.add(this.statusText);

  // 2. Top-Right HUD Buttons & Invite Panel
  this.elementBtnText = ui.add
    .text(490, 42, '[R] Ng.Tố: Vật Lý', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '10.5px',
      fontStyle: '700',
      color: PALETTE.LIME_GLOW,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    })
    .setInteractive({ useHandCursor: true });
  this.elementBtnText.on('pointerdown', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    this.transport.getSim().cycleImbueElement();
    zzfx.play('weapon_swap');
  });
  this.textObjects.push(this.elementBtnText);
  this.hudTopRightContainer.add(this.elementBtnText);

  this.qualityBtnText = ui.add
    .text(658, 42, '[G] Đồ Họa: CAO', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '10.5px',
      fontStyle: '700',
      color: PALETTE.VOLT_YELLOW,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    })
    .setInteractive({ useHandCursor: true });
  this.qualityBtnText.on('pointerdown', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    graphicsSettings.cycleQuality();
  });
  this.textObjects.push(this.qualityBtnText);
  this.hudTopRightContainer.add(this.qualityBtnText);

  const galleryBtn = ui.add
    .text(772, 42, '[Art Gallery]', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11px',
      fontStyle: '700',
      color: PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    })
    .setInteractive({ useHandCursor: true });
  galleryBtn.on('pointerdown', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    this.scene.start('ArtGalleryScene');
  });
  this.galleryBtnText = galleryBtn;
  this.textObjects.push(galleryBtn);
  this.hudTopRightContainer.add(galleryBtn);

  const menuBtn = ui.add
    .text(868, 42, i18n.t('ui.hud.menuBtn'), {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11.5px',
      fontStyle: '700',
      color: PALETTE.CYAN_FROST,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    })
    .setInteractive({ useHandCursor: true });
  menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  this.menuBtnText = menuBtn;
  this.textObjects.push(menuBtn);
  this.hudTopRightContainer.add(menuBtn);

  this.invitePanelContainer = ui.add.container(0, 0);
  this.hudTopRightContainer.add(this.invitePanelContainer);

  // 3. Bottom-Center Weapon & Skill Bar (y: 482, h: 50)
  const slotW = 166;
  const slotH = 44;
  const startX = 148;
  const barY = 486;

  const sim = this.transport.getSim();
  for (let idx = 0; idx < MAX_WEAPON_SLOTS; idx++) {
    const weaponId = sim.player.weaponSlots[idx] ?? 'knight_sword';
    const wDef = WEAPONS[weaponId] ?? WEAPONS.knight_sword!;
    const sx = startX + idx * (slotW + 8);

    const slotBg = ui.add.graphics();
    this.weaponSlotBgs.push(slotBg);
    this.hudBottomCenterContainer.add(slotBg);

    const icon = ui.add.sprite(
      sx + 26,
      barY + slotH / 2,
      TextureBaker.getWeaponTextureKey(weaponId),
    );
    icon.setScale(invBake * 0.82);
    this.weaponIconSprites.push(icon);
    this.hudBottomCenterContainer.add(icon);

    const nameTxt = ui.add.text(
      sx + 48,
      barY + 7,
      `[${idx + 1}] ${i18n.weaponName(weaponId, wDef.nameVi)}`,
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '10px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      },
    );
    this.weaponNameTexts.push(nameTxt);
    this.textObjects.push(nameTxt);
    this.hudBottomCenterContainer.add(nameTxt);

    const metaTxt = ui.add.text(
      sx + 48,
      barY + 24,
      `DMG ${wDef.damage}${wDef.pelletCount > 1 ? `×${wDef.pelletCount}` : ''} · ${i18n.t('ui.hud.energy')} ${wDef.energyCost}`,
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '9.5px',
        color: PALETTE.SILVER_BRIGHT,
        resolution: textRes,
      },
    );
    this.weaponMetaTexts.push(metaTxt);
    this.textObjects.push(metaTxt);
    this.hudBottomCenterContainer.add(metaTxt);

    const hit = ui.add
      .rectangle(sx + slotW / 2, barY + slotH / 2, slotW, slotH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.queuedWeaponSlot = idx;
    });
    this.hudBottomCenterContainer.add(hit);
  }

  // Bottom Skill [Space/RMB] & Dash [Shift] Cooldown Cards + [Esc] Pause Card
  this.abilityHudGraphics = ui.add.graphics();
  this.hudBottomCenterContainer.add(this.abilityHudGraphics);

  this.skillCdText = ui.add
    .text(45, barY + 29, i18n.t('ui.hud.ready'), {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '9.5px',
      fontStyle: '800',
      color: PALETTE.LIME_GLOW,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 2.5,
      resolution: textRes,
    })
    .setOrigin(0.5);
  this.textObjects.push(this.skillCdText);
  this.hudBottomCenterContainer.add(this.skillCdText);

  const skillLabel = ui.add
    .text(45, barY + 12, i18n.getLocale() === 'en' ? '⚡Skill [Space]' : '⚡KN [Space]', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '8.5px',
      fontStyle: '700',
      color: PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 2,
      resolution: textRes,
    })
    .setOrigin(0.5);
  this.skillLabelText = skillLabel;
  this.textObjects.push(skillLabel);
  this.hudBottomCenterContainer.add(skillLabel);

  const skillHit = ui.add
    .rectangle(45, barY + slotH / 2, 62, slotH, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  skillHit.on('pointerdown', () => {
    this.skillQueued = true;
  });
  this.hudBottomCenterContainer.add(skillHit);

  this.dashCdText = ui.add
    .text(111, barY + 29, i18n.t('ui.hud.ready'), {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '9.5px',
      fontStyle: '800',
      color: PALETTE.CYAN_FROST,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 2.5,
      resolution: textRes,
    })
    .setOrigin(0.5);
  this.textObjects.push(this.dashCdText);
  this.hudBottomCenterContainer.add(this.dashCdText);

  const dashLabel = ui.add
    .text(111, barY + 12, '💨Dash [Shift]', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '8.5px',
      fontStyle: '700',
      color: PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 2,
      resolution: textRes,
    })
    .setOrigin(0.5);
  this.textObjects.push(dashLabel);
  this.hudBottomCenterContainer.add(dashLabel);

  const dashHit = ui.add
    .rectangle(111, barY + slotH / 2, 62, slotH, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  dashHit.on('pointerdown', () => {
    this.dashQueued = true;
  });
  this.hudBottomCenterContainer.add(dashHit);

  const pauseBtnBg = ui.add.graphics();
  pauseBtnBg.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.92);
  pauseBtnBg.lineStyle(2, hexToNum(PALETTE.SOLAR_GOLD), 0.95);
  pauseBtnBg.fillRoundedRect(848, barY, 98, slotH, 8);
  pauseBtnBg.strokeRoundedRect(848, barY, 98, slotH, 8);
  this.hudBottomCenterContainer.add(pauseBtnBg);

  const pauseBtnText = ui.add
    .text(
      897,
      barY + slotH / 2,
      i18n.getLocale() === 'en' ? '⚙ [Esc]\nPause' : '⚙ [Esc]\nTạm Dừng',
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '9.5px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        align: 'center',
        resolution: textRes,
      },
    )
    .setOrigin(0.5);
  this.pauseBtnText = pauseBtnText;
  this.textObjects.push(pauseBtnText);
  this.hudBottomCenterContainer.add(pauseBtnText);

  const pauseBtnHit = ui.add
    .rectangle(897, barY + slotH / 2, 98, slotH, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  pauseBtnHit.on('pointerdown', () => {
    zzfx.play('ui_click');
    this.togglePauseModal();
  });
  this.hudBottomCenterContainer.add(pauseBtnHit);

  this.weaponCompareContainer = ui.add.container(0, 0);
  this.hudBottomCenterContainer.add(this.weaponCompareContainer);

  // 4. Top-Center Boss HP Bar (Phase 1 / Phase 2 / Phase 3 with 66% & 33% markers)
  this.bossBarGraphics = ui.add.graphics();
  this.hudTopCenterContainer.add(this.bossBarGraphics);

  this.bossTitleText = ui.add
    .text(480, 76, '', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '12px',
      fontStyle: '800',
      color: PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DEEP,
      strokeThickness: 3.5,
      resolution: textRes,
    })
    .setOrigin(0.5, 0)
    .setVisible(false);
  this.textObjects.push(this.bossTitleText);
  this.hudTopCenterContainer.add(this.bossTitleText);

  // 5. Top-Right Minimap & Fog of War Overlay
  this.minimapGraphics = ui.add.graphics();
  this.minimapTitleText = ui.add.text(784, 76, 'T1/2 · Khởi Đầu [Tab]', {
    fontFamily: '"Be Vietnam Pro", sans-serif',
    fontSize: '9.5px',
    fontStyle: '700',
    color: PALETTE.SOLAR_GOLD,
    stroke: PALETTE.INK_DARK,
    strokeThickness: 2.5,
    resolution: textRes,
  });
  this.textObjects.push(this.minimapTitleText);

  // 6. Co-op Teammate HUD Container (left side), Hub Preview, Off-Screen Arrows & Emote Wheel
  this.coopHudContainer = ui.add.container(0, 0);
  this.hubPreviewContainer = ui.add.container(0, 0);
  this.offscreenArrowGraphics = ui.add.graphics();
  this.emoteWheelContainer = ui.add.container(0, 0);

  // 7. Modal Container, Pause Overlay Container & Iris Transition Graphics
  this.modalContainer = ui.add.container(0, 0);
  this.pauseContainer = ui.add.container(0, 0).setVisible(false);
  this.irisGraphics = ui.add.graphics();

  this.hudContainer.add([
    this.hudTopBarBg,
    this.hudBottomBarBg,
    this.hudTopLeftContainer,
    this.hudTopCenterContainer,
    this.hudTopRightContainer,
    this.hudBottomCenterContainer,
    this.minimapGraphics,
    this.minimapTitleText,
    this.coopHudContainer,
    this.hubPreviewContainer,
    this.offscreenArrowGraphics,
    this.emoteWheelContainer,
    this.modalContainer,
    this.pauseContainer,
    this.irisGraphics,
  ]);

  this.settingsModal?.destroy();
  this.settingsModal = new ModalOverlayManager(ui, () => {
    this.invalidateAllHudCaches();
    if (this.pauseModalOpen) {
      this.rebuildPauseModal();
    }
  });
  syncHudDebugVisibility(this);
  applyHudEdgeAnchors(this);
}

export function invalidateAllHudCachesImpl(this: GameScene): void {
  this.lastHudHp = -1;
  this.lastHudWeaponHash = '';
  this.lastHudElement = '';
  this.lastHudQuality = '';
  this.lastHudStatsText = '';
  this.lastMinimapHash = '';
  this.lastBossHudHash = '';
  this.lastCoopHudHash = '';
  this.lastInvitePanelHash = '';
  this.lastHubPreviewHash = '';
  this.lastWeaponCompareHash = '';
  this.lastEmoteWheelHash = '';
  this.lastRunState = '';
  const isEn = i18n.getLocale() === 'en';
  syncHudDebugVisibility(this);
  this.menuBtnText?.setText(i18n.t('ui.hud.menuBtn'));
  this.skillLabelText?.setText(isEn ? '⚡Skill [Space]' : '⚡KN [Space]');
  this.pauseBtnText?.setText(isEn ? '⚙ [Esc]\nPause' : '⚙ [Esc]\nTạm Dừng');
}

export function togglePauseModalImpl(this: GameScene, forceState?: boolean): void {
  const next = typeof forceState === 'boolean' ? forceState : !this.pauseModalOpen;
  this.pauseModalOpen = next;
  initGlobalDebugState().pauseModalOpen = next;
  if (this.coopMode === 'solo') {
    musicManager.setPaused(next);
  }
  if (!next) {
    this.pauseContainer.removeAll(true);
    this.pauseContainer.setVisible(false);
  } else {
    this.rebuildPauseModal();
  }
}

export function rebuildPauseModalImpl(this: GameScene): void {
  const ui = this.uiScene;
  this.pauseContainer.removeAll(true);
  if (!this.pauseModalOpen) {
    this.pauseContainer.setVisible(false);
    return;
  }
  this.pauseContainer.setVisible(true);
  const textRes = TextureBaker.getBakeScale();

  const blocker = ui.add
    .rectangle(480, 270, 2400, 1600, hexToNum(PALETTE.INK_DARK), 0.78)
    .setInteractive();
  this.pauseContainer.add(blocker);

  const cardW = 420;
  const cardH = 330;
  const cardX = 480 - cardW / 2;
  const cardY = 270 - cardH / 2;

  const panel = ui.add.graphics();
  panel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.98);
  panel.lineStyle(3, hexToNum(PALETTE.SOLAR_GOLD), 1);
  panel.fillRoundedRect(cardX, cardY, cardW, cardH, 12);
  panel.strokeRoundedRect(cardX, cardY, cardW, cardH, 12);
  this.pauseContainer.add(panel);

  const title = ui.add
    .text(480, cardY + 30, i18n.t('ui.pause.title'), {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '20px',
      fontStyle: '800',
      color: PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 4,
      resolution: textRes,
    })
    .setOrigin(0.5);
  this.pauseContainer.add(title);

  const notice = ui.add
    .text(
      480,
      cardY + 58,
      this.coopMode === 'solo' ? i18n.t('ui.pause.soloNotice') : i18n.t('ui.pause.coopNotice'),
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: this.coopMode === 'solo' ? PALETTE.CYAN_FROST : PALETTE.FLAME_ORANGE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      },
    )
    .setOrigin(0.5);
  this.pauseContainer.add(notice);

  const actions: { label: string; color: string; onClick: () => void }[] = [
    {
      label: i18n.t('ui.pause.resume'),
      color: PALETTE.FOREST_SHADE,
      onClick: () => {
        zzfx.play('ui_click');
        this.togglePauseModal(false);
      },
    },
    {
      label: `⚙ ${i18n.t('ui.pause.settings')}`,
      color: PALETTE.SLATE_MID,
      onClick: () => {
        zzfx.play('ui_click');
        this.settingsModal?.open('settings');
      },
    },
    {
      label: `⌨ ${i18n.t('ui.pause.controls')}`,
      color: PALETTE.SLATE_MID,
      onClick: () => {
        zzfx.play('ui_click');
        this.settingsModal?.open('controls');
      },
    },
    {
      label: i18n.t('ui.pause.returnHub'),
      color: PALETTE.BRASS_CORE,
      onClick: () => {
        zzfx.play('portal_enter');
        this.togglePauseModal(false);
        this.transport.getSim().enterHub();
        this.triggerIrisTransition();
      },
    },
    {
      label: i18n.t('ui.pause.leaveMenu'),
      color: PALETTE.RUBY_CORE,
      onClick: () => {
        zzfx.play('ui_click');
        this.togglePauseModal(false);
        this.scene.start('MenuScene');
      },
    },
  ];

  actions.forEach((act, idx) => {
    const by = cardY + 96 + idx * 44;
    const bw = 310;
    const bh = 34;

    const btnBg = ui.add.graphics();
    const draw = (hover: boolean) => {
      btnBg.clear();
      btnBg.fillStyle(hexToNum(hover ? PALETTE.SOLAR_GOLD : act.color), 1);
      btnBg.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
      btnBg.fillRoundedRect(480 - bw / 2, by - bh / 2, bw, bh, 7);
      btnBg.strokeRoundedRect(480 - bw / 2, by - bh / 2, bw, bh, 7);
    };
    draw(false);

    const txt = ui.add
      .text(480, by, act.label, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '12.5px',
        fontStyle: '800',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      })
      .setOrigin(0.5);

    const hit = ui.add
      .rectangle(480, by, bw, bh, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      draw(true);
      zzfx.play('ui_hover');
    });
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', act.onClick);

    this.pauseContainer.add([btnBg, txt, hit]);
  });
}
