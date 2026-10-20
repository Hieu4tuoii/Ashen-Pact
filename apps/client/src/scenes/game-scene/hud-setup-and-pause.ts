import {
  i18n,
  PHASE1_SAMPLE_WEAPONS,
  VIETNAMESE_VERIFICATION_STRING,
  WEAPONS,
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

export function buildVectorHudImpl(this: GameScene): void {
  const textRes = TextureBaker.getBakeScale();
  const invBake = 1 / textRes;

  this.hudContainer = this.add.container(0, 0);
  this.hudContainer.setDepth(900);

  // Top HUD Panel (x: 12, y: 8, w: 936, h: 60)
  const topPanel = this.add.graphics();
  topPanel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.92);
  topPanel.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
  topPanel.fillRoundedRect(12, 8, 936, 60, 9);
  topPanel.strokeRoundedRect(12, 8, 936, 60, 9);
  this.hudContainer.add(topPanel);

  this.hudBarsGraphics = this.add.graphics();
  this.hudContainer.add(this.hudBarsGraphics);

  const makeBarText = (x: number, y: number, initText: string) => {
    const t = this.add.text(x, y, initText, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11px',
      fontStyle: '800',
      color: PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    });
    this.textObjects.push(t);
    this.hudContainer.add(t);
    return t;
  };

  this.hpLabelText = makeBarText(28, 15, 'HP 8/8');
  this.armorLabelText = makeBarText(162, 15, 'GIÁP 6/6');
  this.energyLabelText = makeBarText(296, 15, 'NL 150/150');

  this.statsLineText = this.add.text(
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
  this.hudContainer.add(this.statsLineText);

  this.statusText = this.add.text(
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
  this.hudContainer.add(this.statusText);

  this.elementBtnText = this.add
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
  this.hudContainer.add(this.elementBtnText);

  this.qualityBtnText = this.add
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
  this.hudContainer.add(this.qualityBtnText);

  const galleryBtn = this.add
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
  this.hudContainer.add(galleryBtn);

  const menuBtn = this.add
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
  this.hudContainer.add(menuBtn);

  // Bottom Weapon & Skill Bar (y: 482, h: 50)
  const slotW = 166;
  const slotH = 44;
  const startX = 148;
  const barY = 486;

  PHASE1_SAMPLE_WEAPONS.forEach((weaponId, idx) => {
    const wDef = WEAPONS[weaponId]!;
    const sx = startX + idx * (slotW + 8);

    const slotBg = this.add.graphics();
    this.weaponSlotBgs.push(slotBg);
    this.hudContainer.add(slotBg);

    const icon = this.add.sprite(
      sx + 26,
      barY + slotH / 2,
      TextureBaker.getWeaponTextureKey(weaponId),
    );
    icon.setScale(invBake * 0.82);
    this.weaponIconSprites.push(icon);
    this.hudContainer.add(icon);

    const nameTxt = this.add.text(
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
    this.hudContainer.add(nameTxt);

    const metaTxt = this.add.text(
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
    this.hudContainer.add(metaTxt);

    const hit = this.add
      .rectangle(sx + slotW / 2, barY + slotH / 2, slotW, slotH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.queuedWeaponSlot = idx;
    });
    this.hudContainer.add(hit);
  });

  // Bottom-Left Skill [Space/RMB] & Dash [Shift] Cooldown Cards + Bottom-Right [Esc] Pause Card
  this.abilityHudGraphics = this.add.graphics();
  this.hudContainer.add(this.abilityHudGraphics);

  this.skillCdText = this.add
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
  this.hudContainer.add(this.skillCdText);

  const skillLabel = this.add
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
  this.hudContainer.add(skillLabel);

  const skillHit = this.add
    .rectangle(45, barY + slotH / 2, 62, slotH, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  skillHit.on('pointerdown', () => {
    this.skillQueued = true;
  });
  this.hudContainer.add(skillHit);

  this.dashCdText = this.add
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
  this.hudContainer.add(this.dashCdText);

  const dashLabel = this.add
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
  this.hudContainer.add(dashLabel);

  const dashHit = this.add
    .rectangle(111, barY + slotH / 2, 62, slotH, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  dashHit.on('pointerdown', () => {
    this.dashQueued = true;
  });
  this.hudContainer.add(dashHit);

  const pauseBtnBg = this.add.graphics();
  pauseBtnBg.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.92);
  pauseBtnBg.lineStyle(2, hexToNum(PALETTE.SOLAR_GOLD), 0.95);
  pauseBtnBg.fillRoundedRect(848, barY, 98, slotH, 8);
  pauseBtnBg.strokeRoundedRect(848, barY, 98, slotH, 8);
  this.hudContainer.add(pauseBtnBg);

  const pauseBtnText = this.add
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
  this.hudContainer.add(pauseBtnText);

  const pauseBtnHit = this.add
    .rectangle(897, barY + slotH / 2, 98, slotH, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  pauseBtnHit.on('pointerdown', () => {
    zzfx.play('ui_click');
    this.togglePauseModal();
  });
  this.hudContainer.add(pauseBtnHit);

  // Top-Right Minimap & Fog of War Overlay
  this.minimapGraphics = this.add.graphics();
  this.hudContainer.add(this.minimapGraphics);

  this.minimapTitleText = this.add.text(784, 76, 'T1/2 · Khởi Đầu [Tab]', {
    fontFamily: '"Be Vietnam Pro", sans-serif',
    fontSize: '9.5px',
    fontStyle: '700',
    color: PALETTE.SOLAR_GOLD,
    stroke: PALETTE.INK_DARK,
    strokeThickness: 2.5,
    resolution: textRes,
  });
  this.textObjects.push(this.minimapTitleText);
  this.hudContainer.add(this.minimapTitleText);

  // Top-Center Boss HP Bar (Phase 1 / Phase 2 / Phase 3 with 66% & 33% markers)
  this.bossBarGraphics = this.add.graphics();
  this.hudContainer.add(this.bossBarGraphics);

  this.bossTitleText = this.add
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
  this.hudContainer.add(this.bossTitleText);

  // Co-op Teammate HUD Container (left side), Host Invite QR Panel (right side), and Off-Screen Arrows
  this.offscreenArrowGraphics = this.add.graphics();
  this.hudContainer.add(this.offscreenArrowGraphics);

  this.coopHudContainer = this.add.container(0, 0);
  this.hudContainer.add(this.coopHudContainer);

  this.invitePanelContainer = this.add.container(0, 0);
  this.hudContainer.add(this.invitePanelContainer);

  this.hubPreviewContainer = this.add.container(0, 0);
  this.hudContainer.add(this.hubPreviewContainer);

  this.weaponCompareContainer = this.add.container(0, 0);
  this.hudContainer.add(this.weaponCompareContainer);

  // Iris Transition Graphics placed below Modals & Pause Overlay so modals are never obscured
  this.irisGraphics = this.add.graphics();
  this.hudContainer.add(this.irisGraphics);

  // Modal Container for Between-Floor Buff Selection & Run Victory/Defeat Summary
  this.modalContainer = this.add.container(0, 0);
  this.hudContainer.add(this.modalContainer);

  // Pause Overlay Container & Settings/Controls Modal Manager
  this.pauseContainer = this.add.container(0, 0).setVisible(false);
  this.hudContainer.add(this.pauseContainer);

  this.settingsModal = new ModalOverlayManager(this, () => {
    this.invalidateAllHudCaches();
    if (this.pauseModalOpen) {
      this.rebuildPauseModal();
    }
  });
  syncHudDebugVisibility(this);
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
  this.pauseContainer.removeAll(true);
  if (!this.pauseModalOpen) {
    this.pauseContainer.setVisible(false);
    return;
  }
  this.pauseContainer.setVisible(true);
  const textRes = TextureBaker.getBakeScale();

  const blocker = this.add
    .rectangle(480, 270, 1920, 1080, hexToNum(PALETTE.INK_DARK), 0.78)
    .setInteractive();
  this.pauseContainer.add(blocker);

  const cardW = 420;
  const cardH = 330;
  const cardX = 480 - cardW / 2;
  const cardY = 270 - cardH / 2;

  const panel = this.add.graphics();
  panel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.98);
  panel.lineStyle(3, hexToNum(PALETTE.SOLAR_GOLD), 1);
  panel.fillRoundedRect(cardX, cardY, cardW, cardH, 12);
  panel.strokeRoundedRect(cardX, cardY, cardW, cardH, 12);
  this.pauseContainer.add(panel);

  const title = this.add
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

  const notice = this.add
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

    const btnBg = this.add.graphics();
    const draw = (hover: boolean) => {
      btnBg.clear();
      btnBg.fillStyle(hexToNum(hover ? PALETTE.SOLAR_GOLD : act.color), 1);
      btnBg.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
      btnBg.fillRoundedRect(480 - bw / 2, by - bh / 2, bw, bh, 7);
      btnBg.strokeRoundedRect(480 - bw / 2, by - bh / 2, bw, bh, 7);
    };
    draw(false);

    const txt = this.add
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

    const hit = this.add
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
