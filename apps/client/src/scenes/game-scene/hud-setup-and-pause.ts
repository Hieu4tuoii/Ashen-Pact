import {
  i18n,
  MAX_WEAPON_SLOTS,
  VIETNAMESE_VERIFICATION_STRING,
  WEAPONS,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { musicManager } from '../../audio/music-synth.js';
import { zzfx } from '../../audio/zzfx.js';
import { isEffectiveDebugUiEnabled } from '../../core/debug-flag.js';
import { drawStyledPanel } from '../../ui/components/hud-primitives.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { clampUiScale, graphicsSettings } from '../../ui/graphics-settings.js';
import { ModalOverlayManager } from '../../ui/settings-modal.js';
import { computeUiTextResolution, createUiTextStyle, UI_THEME } from '../../ui/theme.js';
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

  if (scene.statusText) {
    if (scene.statusText.text !== nextStatus) {
      scene.statusText.setText(nextStatus);
    }
    if (scene.statusText.visible !== showDebug) {
      scene.statusText.setVisible(showDebug);
    }
  }

  if (scene.statsLineText && scene.statsLineText.visible !== showDebug) {
    scene.statsLineText.setVisible(showDebug);
  }

  for (const btn of [
    scene.elementBtnText,
    scene.qualityBtnText,
    scene.galleryBtnText,
    scene.menuBtnText,
    scene.pauseBtnText,
  ]) {
    if (!btn) continue;
    if (btn.visible !== showDebug) {
      btn.setVisible(showDebug);
      if (showDebug && btn !== scene.pauseBtnText) {
        btn.setInteractive({ useHandCursor: true });
      } else if (!showDebug) {
        btn.disableInteractive();
      }
    }
  }

  if (scene.pauseBtnBg && scene.pauseBtnBg.visible !== showDebug) {
    scene.pauseBtnBg.setVisible(showDebug);
  }
  if (scene.pauseBtnHit && scene.pauseBtnHit.visible !== showDebug) {
    scene.pauseBtnHit.setVisible(showDebug);
    if (showDebug) {
      scene.pauseBtnHit.setInteractive({ useHandCursor: true });
    } else {
      scene.pauseBtnHit.disableInteractive();
    }
  }
}

export function applyHudEdgeAnchors(scene: GameScene): void {
  const padX = scene.hudPadX;
  const padY = scene.hudPadY;
  const uiScale = clampUiScale(graphicsSettings.getState().uiScale);
  scene.currentHudUiScale = uiScale;

  // Normal gameplay has no full-width top/bottom dark bars so arena lighting breathes to the edges
  scene.hudTopBarBg?.clear();
  scene.hudBottomBarBg?.clear();

  scene.hudTopLeftContainer?.setPosition(-padX, -padY).setScale(uiScale);
  scene.coopHudContainer?.setPosition(-padX, -padY + Math.round(102 * uiScale)).setScale(uiScale);
  scene.hudTopCenterContainer?.setPosition(WORLD_VIEW_WIDTH * 0.5, -padY).setScale(uiScale);
  scene.hudTopRightContainer?.setPosition(WORLD_VIEW_WIDTH + padX, -padY).setScale(uiScale);
  scene.hudBottomRightContainer
    ?.setPosition(WORLD_VIEW_WIDTH + padX, WORLD_VIEW_HEIGHT + padY)
    .setScale(uiScale);
  scene.hudBottomCenterContainer
    ?.setPosition(WORLD_VIEW_WIDTH * 0.5, WORLD_VIEW_HEIGHT + padY)
    .setScale(uiScale);
  scene.hubPreviewContainer
    ?.setPosition(-padX, WORLD_VIEW_HEIGHT + padY)
    .setScale(uiScale);

  // Screen-perimeter offscreen arrows and screen-centered hit arcs remain on unscaled HudScene root
  scene.offscreenArrowGraphics?.setPosition(0, 0).setScale(1);
  scene.playerHitArcGraphics?.setPosition(0, 0).setScale(1);

  scene.lastMinimapHash = '';
  scene.lastHudWeaponHash = '';
  scene.lastAbilityHudHash = '';
  scene.lastHudBarsExtraHash = '';
  scene.lastHudHp = -1;
  scene.lastCoopHudHash = '';
}

export function buildVectorHudImpl(this: GameScene): void {
  const ui = this.uiScene;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const zoom = ui.cameras?.main?.zoom || 2;
  const uiScale = clampUiScale(graphicsSettings.getState().uiScale);
  this.currentHudUiScale = uiScale;
  const textRes = computeUiTextResolution(dpr, zoom, uiScale);
  const invBake = 1 / TextureBaker.getBakeScale();

  this.hudContainer = ui.add.container(0, 0).setDepth(2000);

  this.hudTopBarBg = ui.add.graphics();
  this.hudBottomBarBg = ui.add.graphics();
  this.hudTopLeftContainer = ui.add.container(0, 0);
  this.hudTopCenterContainer = ui.add.container(0, 0);
  this.hudTopRightContainer = ui.add.container(0, 0);
  this.hudBottomRightContainer = ui.add.container(0, 0);
  this.hudBottomCenterContainer = ui.add.container(0, 0);

  // 1. Top-Left Player Status Card (Portrait + 3 Segmented Bars + Gold Coin Pill + Status Line)
  this.hudBarsGraphics = ui.add.graphics();
  this.hudTopLeftContainer.add(this.hudBarsGraphics);

  const makeStatLabel = (x: number, y: number, initText: string, color: string = PALETTE.BONE_WHITE) => {
    const t = ui.add
      .text(
        x,
        y,
        initText,
        createUiTextStyle({
          fontPxAt1080p: 13,
          weight: 800,
          color,
          resolution: textRes,
        }),
      )
      .setOrigin(0, 0.5);
    this.textObjects.push(t);
    this.hudTopLeftContainer?.add(t);
    return t;
  };

  this.playerClassLabelText = makeStatLabel(20, 68, 'Thiết Vệ', PALETTE.SILVER_BRIGHT);
  this.hpLabelText = makeStatLabel(168, 21, '8/8', PALETTE.BONE_WHITE);
  this.armorLabelText = makeStatLabel(168, 34.5, '6/6', PALETTE.SILVER_BRIGHT);
  this.energyLabelText = makeStatLabel(168, 48, '150/150', PALETTE.CYAN_FROST);

  this.goldLabelText = ui.add
    .text(
      134,
      68,
      '0 Vàng',
      createUiTextStyle({
        fontPxAt1080p: 14,
        weight: 800,
        color: UI_THEME.status.goldBrightHex,
        resolution: textRes,
      }),
    )
    .setOrigin(0, 0.5);
  this.textObjects.push(this.goldLabelText);
  this.hudTopLeftContainer.add(this.goldLabelText);

  this.statusLineText = ui.add
    .text(
      20,
      92,
      '',
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 700,
        color: PALETTE.CYAN_FROST,
        resolution: textRes,
      }),
    )
    .setOrigin(0, 0.5)
    .setVisible(false);
  this.textObjects.push(this.statusLineText);
  this.hudTopLeftContainer.add(this.statusLineText);

  // Debug-only telemetry & keybind reminder lines (visible only when ?debug=1)
  this.statsLineText = ui.add.text(
    224,
    12,
    isEffectiveDebugUiEnabled(this.coopMode !== 'solo')
      ? `DPS: 0.0 · Đợt 1 | ${VIETNAMESE_VERIFICATION_STRING}`
      : 'Tầng 1/2 (Khởi Đầu) · Vàng 0 · Đợt 1',
    createUiTextStyle({
      fontPxAt1080p: 13,
      weight: 700,
      color: PALETTE.SOLAR_GOLD,
      resolution: textRes,
    }),
  );
  this.textObjects.push(this.statsLineText);
  this.hudTopLeftContainer.add(this.statsLineText);

  this.statusText = ui.add.text(
    224,
    26,
    'WASD: Chạy · Chuột: Bắn/Khiên · Shift: Dash · R: Ng.Tố · G: Đồ Họa · F1-F7: Debug',
    createUiTextStyle({
      fontPxAt1080p: 13,
      weight: 600,
      color: PALETTE.CYAN_FROST,
      resolution: textRes,
    }),
  );
  this.textObjects.push(this.statusText);
  this.hudTopLeftContainer.add(this.statusText);

  // 2. Top-Right Minimap, Floor/Biome Badge, Invite Panel & Debug Toolbar
  this.minimapGraphics = ui.add.graphics();
  this.minimapTitleText = ui.add.text(
    -164,
    124,
    'Tầng 1-1 · Rừng Cổ Mục Nát',
    createUiTextStyle({
      fontPxAt1080p: 13,
      weight: 700,
      color: PALETTE.BONE_WHITE,
      resolution: textRes,
    }),
  );
  this.textObjects.push(this.minimapTitleText);
  this.hudTopRightContainer.add([this.minimapGraphics, this.minimapTitleText]);

  this.elementBtnText = ui.add
    .text(
      -460,
      40,
      '[R] Ng.Tố: Vật Lý',
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 700,
        color: PALETTE.LIME_GLOW,
        resolution: textRes,
      }),
    )
    .setInteractive({ useHandCursor: true });
  this.elementBtnText.on('pointerdown', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    this.transport.getSim().cycleImbueElement();
    zzfx.play('weapon_swap');
  });
  this.textObjects.push(this.elementBtnText);
  this.hudTopRightContainer.add(this.elementBtnText);

  this.qualityBtnText = ui.add
    .text(
      -346,
      40,
      '[G] Đồ Họa: CAO',
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 700,
        color: PALETTE.VOLT_YELLOW,
        resolution: textRes,
      }),
    )
    .setInteractive({ useHandCursor: true });
  this.qualityBtnText.on('pointerdown', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    graphicsSettings.cycleQuality();
  });
  this.textObjects.push(this.qualityBtnText);
  this.hudTopRightContainer.add(this.qualityBtnText);

  const galleryBtn = ui.add
    .text(
      -256,
      40,
      '[Art Gallery]',
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 700,
        color: PALETTE.SOLAR_GOLD,
        resolution: textRes,
      }),
    )
    .setInteractive({ useHandCursor: true });
  galleryBtn.on('pointerdown', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    this.scene.start('ArtGalleryScene');
  });
  this.galleryBtnText = galleryBtn;
  this.textObjects.push(galleryBtn);
  this.hudTopRightContainer.add(galleryBtn);

  const menuBtn = ui.add
    .text(
      -184,
      140,
      i18n.t('ui.hud.menuBtn'),
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 700,
        color: PALETTE.CYAN_FROST,
        resolution: textRes,
      }),
    )
    .setInteractive({ useHandCursor: true });
  menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
  this.menuBtnText = menuBtn;
  this.textObjects.push(menuBtn);
  this.hudTopRightContainer.add(menuBtn);

  this.invitePanelContainer = ui.add.container(0, 0);
  this.hudTopRightContainer.add(this.invitePanelContainer);

  // 3. Bottom-Right Weapon Slot Cards & Circular Skill/Dash Cooldown Widgets
  this.abilityHudGraphics = ui.add.graphics();
  this.hudBottomRightContainer.add(this.abilityHudGraphics);

  this.skillCdText = ui.add
    .text(
      -352,
      -15,
      i18n.t('ui.hud.ready'),
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 800,
        color: PALETTE.LIME_GLOW,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5);
  this.textObjects.push(this.skillCdText);
  this.hudBottomRightContainer.add(this.skillCdText);

  const skillLabel = ui.add
    .text(
      -352,
      -52,
      'Space',
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 700,
        color: PALETTE.BONE_WHITE,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5);
  this.skillLabelText = skillLabel;
  this.textObjects.push(skillLabel);
  this.hudBottomRightContainer.add(skillLabel);

  const skillHit = ui.add
    .rectangle(-352, -32, 38, 44, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  skillHit.on('pointerdown', () => {
    this.skillQueued = true;
  });
  this.hudBottomRightContainer.add(skillHit);

  this.dashCdText = ui.add
    .text(
      -308,
      -15,
      i18n.t('ui.hud.ready'),
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 800,
        color: PALETTE.CYAN_FROST,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5);
  this.textObjects.push(this.dashCdText);
  this.hudBottomRightContainer.add(this.dashCdText);

  const dashLabel = ui.add
    .text(
      -308,
      -52,
      'Shift',
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 700,
        color: PALETTE.BONE_WHITE,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5);
  this.dashLabelText = dashLabel;
  this.textObjects.push(dashLabel);
  this.hudBottomRightContainer.add(dashLabel);

  const dashHit = ui.add
    .rectangle(-308, -32, 38, 44, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  dashHit.on('pointerdown', () => {
    this.dashQueued = true;
  });
  this.hudBottomRightContainer.add(dashHit);

  // 2 Weapon Cards in Bottom-Right Cluster
  const sim = this.transport.getSim();
  this.weaponSlotBgs.length = 0;
  this.weaponIconSprites.length = 0;
  this.weaponNameTexts.length = 0;
  this.weaponMetaTexts.length = 0;
  this.weaponKeyTexts.length = 0;

  for (let idx = 0; idx < MAX_WEAPON_SLOTS; idx++) {
    const weaponId = sim.player.weaponSlots[idx] ?? 'knight_sword';
    const wDef = WEAPONS[weaponId] ?? WEAPONS.knight_sword!;
    const cardX = idx === 0 ? -274 : -124;

    const slotBg = ui.add.graphics();
    this.weaponSlotBgs.push(slotBg);
    this.hudBottomRightContainer.add(slotBg);

    const icon = ui.add.sprite(
      cardX + 20,
      -31,
      TextureBaker.getWeaponTextureKey(weaponId),
    );
    icon.setScale(invBake * 0.78);
    this.weaponIconSprites.push(icon);
    this.hudBottomRightContainer.add(icon);

    const nameTxt = ui.add
      .text(
        cardX + 36,
        -40,
        i18n.weaponName(weaponId, wDef.nameVi),
        createUiTextStyle({
          fontPxAt1080p: 14,
          weight: 800,
          color: PALETTE.BONE_WHITE,
          resolution: textRes,
        }),
      )
      .setOrigin(0, 0.5);
    this.weaponNameTexts.push(nameTxt);
    this.textObjects.push(nameTxt);
    this.hudBottomRightContainer.add(nameTxt);

    const metaTxt = ui.add
      .text(
        cardX + 36,
        -22,
        `ST ${wDef.damage} · NL ${wDef.energyCost}`,
        createUiTextStyle({
          fontPxAt1080p: 13,
          weight: 600,
          color: PALETTE.SILVER_BRIGHT,
          resolution: textRes,
        }),
      )
      .setOrigin(0, 0.5);
    this.weaponMetaTexts.push(metaTxt);
    this.textObjects.push(metaTxt);
    this.hudBottomRightContainer.add(metaTxt);

    const keyTxt = ui.add
      .text(
        cardX + 12,
        -46,
        `${idx + 1}`,
        createUiTextStyle({
          fontPxAt1080p: 13,
          weight: 800,
          color: PALETTE.SOLAR_GOLD,
          resolution: textRes,
        }),
      )
      .setOrigin(0.5, 0.5);
    this.weaponKeyTexts.push(keyTxt);
    this.textObjects.push(keyTxt);
    this.hudBottomRightContainer.add(keyTxt);

    const hit = ui.add
      .rectangle(cardX + 68, -31, 136, 44, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.queuedWeaponSlot = idx;
    });
    this.hudBottomRightContainer.add(hit);
  }

  // Debug-only [Esc] Pause Button
  const pauseBtnBg = ui.add.graphics();
  drawStyledPanel(pauseBtnBg, -92, -96, 80, 32, {
    fillColor: UI_THEME.panelBgDark,
    fillAlpha: 0.92,
    borderColor: hexToNum(PALETTE.SOLAR_GOLD),
    radius: UI_THEME.panelRadius.sm,
  });
  this.pauseBtnBg = pauseBtnBg;
  this.hudBottomRightContainer.add(pauseBtnBg);

  const pauseBtnText = ui.add
    .text(
      -52,
      -80,
      i18n.getLocale() === 'en' ? '⚙ [Esc] Pause' : '⚙ [Esc] Dừng',
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 800,
        color: PALETTE.SOLAR_GOLD,
        align: 'center',
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5);
  this.pauseBtnText = pauseBtnText;
  this.textObjects.push(pauseBtnText);
  this.hudBottomRightContainer.add(pauseBtnText);

  const pauseBtnHit = ui.add
    .rectangle(-52, -80, 80, 32, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  pauseBtnHit.on('pointerdown', () => {
    zzfx.play('ui_click');
    this.togglePauseModal();
  });
  this.pauseBtnHit = pauseBtnHit;
  this.hudBottomRightContainer.add(pauseBtnHit);

  // 4. Bottom-Center Context Prompt Zone (Downed / Revive Banner + Weapon Ground Drop Comparison Card)
  this.downedBannerGraphics = ui.add.graphics();
  this.downedBannerText = ui.add
    .text(
      0,
      -34,
      '',
      createUiTextStyle({
        fontPxAt1080p: 14,
        weight: 800,
        color: PALETTE.BONE_WHITE,
        resolution: textRes,
      }),
    )
    .setOrigin(0, 0.5)
    .setVisible(false);
  this.textObjects.push(this.downedBannerText);
  this.weaponCompareContainer = ui.add.container(0, 0);
  this.hudBottomCenterContainer.add([
    this.downedBannerGraphics,
    this.downedBannerText,
    this.weaponCompareContainer,
  ]);

  // 5. Top-Center Boss HP Bar, Wave/Room Banner & Coalesced Reaction Banner
  this.bossBarGraphics = ui.add.graphics();
  this.bossTitleText = ui.add
    .text(
      0,
      19,
      '',
      createUiTextStyle({
        fontPxAt1080p: 15,
        weight: 800,
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DEEP,
        strokeThickness: 3,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5)
    .setVisible(false);
  this.textObjects.push(this.bossTitleText);

  this.waveBannerGraphics = ui.add.graphics();
  this.waveBannerText = ui.add
    .text(
      0,
      20,
      '',
      createUiTextStyle({
        fontPxAt1080p: 16,
        weight: 800,
        color: PALETTE.SOLAR_GOLD,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5)
    .setVisible(false);
  this.textObjects.push(this.waveBannerText);

  this.reactionBannerGraphics = ui.add.graphics();
  this.reactionBannerText = ui.add
    .text(
      0,
      46,
      '',
      createUiTextStyle({
        fontPxAt1080p: 16,
        weight: 800,
        color: PALETTE.CYAN_FROST,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5)
    .setVisible(false);
  this.textObjects.push(this.reactionBannerText);

  this.hudTopCenterContainer.add([
    this.bossBarGraphics,
    this.bossTitleText,
    this.waveBannerGraphics,
    this.waveBannerText,
    this.reactionBannerGraphics,
    this.reactionBannerText,
  ]);

  // 6. Co-op Teammate HUD Container (left side below player card), Hub Preview, Unscaled Off-Screen Arrows / Hit Arc & Emote Wheel
  this.coopHudContainer = ui.add.container(0, 0);
  this.hubPreviewContainer = ui.add.container(0, 0);
  this.offscreenArrowGraphics = ui.add.graphics();
  this.playerHitArcGraphics = ui.add.graphics();
  this.emoteWheelContainer = ui.add.container(0, 0);

  // 7. Modal Container, Pause Overlay Container & Iris Transition Graphics
  this.modalContainer = ui.add.container(0, 0);
  this.pauseContainer = ui.add.container(0, 0).setVisible(false);
  this.irisGraphics = ui.add.graphics();

  this.hudContainer.add([
    this.hudTopBarBg,
    this.hudBottomBarBg,
    this.playerHitArcGraphics,
    this.offscreenArrowGraphics,
    this.hudTopLeftContainer,
    this.coopHudContainer,
    this.hudTopCenterContainer,
    this.hudTopRightContainer,
    this.hudBottomRightContainer,
    this.hudBottomCenterContainer,
    this.hubPreviewContainer,
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
  this.lastHudGold = -1;
  this.lastHudBarsExtraHash = '';
  this.lastAbilityHudHash = '';
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
  applyHudEdgeAnchors(this);
  this.menuBtnText?.setText(i18n.t('ui.hud.menuBtn'));
  this.skillLabelText?.setText('Space');
  this.dashLabelText?.setText('Shift');
  this.pauseBtnText?.setText(isEn ? '⚙ [Esc] Pause' : '⚙ [Esc] Dừng');
}

export function togglePauseModalImpl(this: GameScene, forceState?: boolean): void {
  const next = typeof forceState === 'boolean' ? forceState : !this.pauseModalOpen;
  this.pauseModalOpen = next;
  this.pauseConfirmExitOpen = false;
  const debug = initGlobalDebugState();
  debug.pauseModalOpen = next;
  debug.pauseConfirmExitOpen = false;
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
  const debug = initGlobalDebugState();
  debug.pauseModalOpen = true;
  debug.pauseConfirmExitOpen = this.pauseConfirmExitOpen;

  const textRes = computeUiTextResolution(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    ui.cameras?.main?.zoom || 2,
    graphicsSettings.getState().uiScale,
  );
  const isEn = i18n.getLocale() === 'en';

  const blocker = ui.add
    .rectangle(480, 270, 2400, 1600, hexToNum(PALETTE.INK_DARK), 0.78)
    .setInteractive();
  this.pauseContainer.add(blocker);

  const cardW = 420;
  const cardH = 330;
  const cardX = 480 - cardW / 2;
  const cardY = 270 - cardH / 2;

  const panel = ui.add.graphics();
  drawStyledPanel(panel, cardX, cardY, cardW, cardH, {
    fillColor: UI_THEME.panelBgDark,
    fillAlpha: 0.96,
    borderColor: hexToNum(PALETTE.SOLAR_GOLD),
    borderWidth: 2.2,
    radius: UI_THEME.panelRadius.lg,
    accentColor: hexToNum(PALETTE.SOLAR_GOLD),
    accentSide: 'top',
  });
  this.pauseContainer.add(panel);

  const title = ui.add
    .text(
      480,
      cardY + 30,
      i18n.t('ui.pause.title'),
      createUiTextStyle({
        fontPxAt1080p: 28,
        weight: 800,
        color: PALETTE.SOLAR_GOLD,
        strokeThickness: 3.5,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5);
  this.pauseContainer.add(title);

  const notice = ui.add
    .text(
      480,
      cardY + 58,
      this.coopMode === 'solo' ? i18n.t('ui.pause.soloNotice') : i18n.t('ui.pause.coopNotice'),
      createUiTextStyle({
        fontPxAt1080p: 16,
        weight: 700,
        color: this.coopMode === 'solo' ? PALETTE.CYAN_FROST : PALETTE.FLAME_ORANGE,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5);
  this.pauseContainer.add(notice);

  const addBtn = (
    bx: number,
    by: number,
    bw: number,
    bh: number,
    label: string,
    fillHex: string,
    borderHex: string,
    fontPx: number,
    disabledWhenConfirm: boolean,
    onClick: () => void,
  ) => {
    const g = ui.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      drawStyledPanel(g, bx - bw / 2, by - bh / 2, bw, bh, {
        fillColor: hexToNum(hover ? PALETTE.SOLAR_GOLD : fillHex),
        fillAlpha: 0.96,
        borderColor: hexToNum(hover ? PALETTE.SOLAR_GOLD : borderHex),
        borderWidth: 1.8,
        radius: UI_THEME.panelRadius.sm,
      });
    };
    draw(false);
    const t = ui.add
      .text(
        bx,
        by,
        label,
        createUiTextStyle({
          fontPxAt1080p: fontPx,
          weight: 800,
          color: PALETTE.BONE_WHITE,
          resolution: textRes,
        }),
      )
      .setOrigin(0.5);
    const hit = ui.add
      .rectangle(bx, by, bw, bh, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      if (disabledWhenConfirm && this.pauseConfirmExitOpen) return;
      draw(true);
      zzfx.play('ui_hover');
    });
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => {
      if (disabledWhenConfirm && this.pauseConfirmExitOpen) return;
      onClick();
    });
    this.pauseContainer.add([g, t, hit]);
  };

  const actions: [string, string, () => void][] = [
    [
      isEn ? '▶ Resume [Esc]' : '▶ Tiếp Tục [Esc]',
      PALETTE.FOREST_SHADE,
      () => {
        zzfx.play('ui_click');
        this.togglePauseModal(false);
      },
    ],
    [
      isEn ? '⚙ Settings [O]' : '⚙ Cài Đặt [O]',
      PALETTE.SLATE_MID,
      () => {
        zzfx.play('ui_click');
        this.settingsModal?.open('settings');
      },
    ],
    [
      isEn ? '↻ Restart Run [H]' : '↻ Khởi Động Lại [H]',
      PALETTE.BRASS_CORE,
      () => {
        zzfx.play('portal_enter');
        this.togglePauseModal(false);
        this.transport.getSim().enterHub();
        this.triggerIrisTransition();
      },
    ],
    [
      isEn ? '🏠 Leave to Menu [M]' : '🏠 Về Menu Chính [M]',
      PALETTE.RUBY_CORE,
      () => {
        zzfx.play('ui_click');
        this.openPauseConfirmExit();
      },
    ],
  ];

  actions.forEach(([label, color, onClick], idx) => {
    addBtn(480, cardY + 104 + idx * 56, 310, 38, label, color, PALETTE.INK_DARK, 18, true, onClick);
  });

  if (this.pauseConfirmExitOpen) {
    const confirmBlocker = ui.add
      .rectangle(480, 270, 2400, 1600, hexToNum(PALETTE.INK_DARK), 0.65)
      .setInteractive();
    const cW = 396;
    const cH = 192;
    const cX = 480 - cW / 2;
    const cY = 270 - cH / 2;
    const confirmPanel = ui.add.graphics();
    drawStyledPanel(confirmPanel, cX, cY, cW, cH, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.98,
      borderColor: hexToNum(PALETTE.RUBY_CORE),
      borderWidth: 2.4,
      radius: UI_THEME.panelRadius.lg,
      accentColor: hexToNum(PALETTE.RUBY_CORE),
      accentSide: 'top',
    });
    const confirmTitle = ui.add
      .text(
        480,
        cY + 30,
        isEn ? '⚠ RETURN TO MAIN MENU?' : '⚠ XÁC NHẬN VỀ MENU CHÍNH?',
        createUiTextStyle({
          fontPxAt1080p: 22,
          weight: 800,
          color: PALETTE.SOLAR_GOLD,
          strokeThickness: 3.2,
          resolution: textRes,
        }),
      )
      .setOrigin(0.5);
    const confirmBody = ui.add
      .text(
        480,
        cY + 78,
        isEn
          ? 'Leave current match? Progress will be lost.'
          : 'Rời trận đấu hiện tại? Tiến trình sẽ mất.',
        createUiTextStyle({
          fontPxAt1080p: 16,
          weight: 700,
          color: PALETTE.BONE_WHITE,
          align: 'center',
          wordWrapWidth: cW - 36,
          resolution: textRes,
        }),
      )
      .setOrigin(0.5);
    this.pauseContainer.add([confirmBlocker, confirmPanel, confirmTitle, confirmBody]);

    addBtn(
      392,
      cY + 148,
      154,
      34,
      isEn ? 'Cancel [Esc]' : 'Hủy [Esc]',
      PALETTE.SLATE_MID,
      PALETTE.CYAN_FROST,
      16,
      false,
      () => {
        zzfx.play('ui_click');
        this.pauseConfirmExitOpen = false;
        initGlobalDebugState().pauseConfirmExitOpen = false;
        this.rebuildPauseModal();
      },
    );
    addBtn(
      568,
      cY + 148,
      166,
      34,
      isEn ? 'Confirm Exit [Enter]' : 'Xác nhận thoát [Enter]',
      PALETTE.RUBY_CORE,
      PALETTE.SOLAR_GOLD,
      16,
      false,
      () => {
        zzfx.play('ui_click');
        this.pauseConfirmExitOpen = false;
        initGlobalDebugState().pauseConfirmExitOpen = false;
        this.togglePauseModal(false);
        this.scene.start('MenuScene');
      },
    );
  }
}
