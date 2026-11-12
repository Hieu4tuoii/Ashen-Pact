import { i18n, type SupportedLocale } from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../art/palette.js';
import { TextureBaker } from '../art/texture-baker.js';
import { zzfx } from '../audio/zzfx.js';
import { flushSceneInteractiveContainer } from '../core/software-gl.js';
import {
  drawSegmentedBar,
  drawStyledPanel,
} from './components/hud-primitives.js';
import { initGlobalDebugState } from './debug-overlay.js';
import { graphicsSettings } from './graphics-settings.js';
import {
  getActionDisplayLabel,
  KEYBIND_ACTION_IDS,
  type KeybindActionId,
  normalizeKeyEventToBindingCode,
} from './keybindings.js';
import { UI_THEME } from './theme.js';

export type ModalKind = 'none' | 'settings' | 'controls' | 'credits';
export type SettingsTabId = 'audio' | 'video' | 'gameplay' | 'controls';

export const SETTINGS_TABS: readonly SettingsTabId[] = [
  'audio',
  'video',
  'gameplay',
  'controls',
];

export interface SettingsTabSpec {
  id: SettingsTabId;
  label: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface ControlsActionRowBounds {
  action: KeybindActionId;
  index: number;
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  keyPillCx: number;
  keyPillCy: number;
  keyPillW: number;
  keyPillH: number;
}

/**
 * Computes the 960x540 bounds for one of the 14 interactive Controls-tab rows (7x2 grid).
 */
export function getControlsActionRowBounds(
  indexOrAction: number | KeybindActionId,
  cardX = 150,
  cardY = 48,
): ControlsActionRowBounds {
  const rawIndex =
    typeof indexOrAction === 'number'
      ? indexOrAction
      : KEYBIND_ACTION_IDS.indexOf(indexOrAction);
  const index = Math.max(0, Math.min(KEYBIND_ACTION_IDS.length - 1, rawIndex));
  const action = KEYBIND_ACTION_IDS[index]!;
  const col = index % 2;
  const row = Math.floor(index / 2);
  const w = 300;
  const h = 27;
  const x = cardX + 24 + col * 312;
  const cy = cardY + 131 + row * 31;
  const y = cy - h / 2;
  const cx = x + w / 2;
  const keyPillW = 76;
  const keyPillH = 21;
  const keyPillCx = x + 254;
  const keyPillCy = cy;
  return {
    action,
    index,
    col,
    row,
    x,
    y,
    w,
    h,
    cx,
    cy,
    keyPillCx,
    keyPillCy,
    keyPillW,
    keyPillH,
  };
}

/**
 * Returns the single-language header title for the Settings modal in the active locale.
 */
export function getSettingsModalTitle(
  locale: SupportedLocale = i18n.getLocale(),
): string {
  return locale === 'en' ? 'SETTINGS' : 'CÀI ĐẶT';
}

/**
 * Returns the 4 tab specifications (Audio, Video, Gameplay, Controls) with 960x540 coordinates.
 */
export function getSettingsTabSpecs(
  locale: SupportedLocale = i18n.getLocale(),
): SettingsTabSpec[] {
  const isEn = locale === 'en';
  const cy = 108;
  const w = 144;
  const h = 28;
  return [
    {
      id: 'audio',
      label: isEn ? '🔊 Audio' : '🔊 Âm thanh',
      cx: 247,
      cy,
      w,
      h,
    },
    {
      id: 'video',
      label: isEn ? '🖥 Video' : '🖥 Hình ảnh',
      cx: 402,
      cy,
      w,
      h,
    },
    {
      id: 'gameplay',
      label: '🎮 Gameplay',
      cx: 558,
      cy,
      w,
      h,
    },
    {
      id: 'controls',
      label: isEn ? '⌨ Controls' : '⌨ Điều khiển',
      cx: 713,
      cy,
      w,
      h,
    },
  ];
}

interface SettingRowSpec {
  id: string;
  label: string;
  subLabel?: string;
  valueText: string;
  ratio?: number;
  segments?: number;
  barColor?: number;
  onDec?: () => void;
  onInc?: () => void;
  onToggle?: () => void;
}

export class ModalOverlayManager {
  private readonly scene: Phaser.Scene;
  private readonly onLocaleChanged?: () => void;
  private container: Phaser.GameObjects.Container;
  private activeModal: ModalKind = 'none';
  private activeTab: SettingsTabId = 'audio';
  private textObjects: Phaser.GameObjects.Text[] = [];
  private rebindingAction: KeybindActionId | null = null;
  private controlsFeedback: { text: string; tone: 'info' | 'success' | 'warn' } | null = null;
  private captureListenerAttached = false;
  private readonly boundCaptureKeyDown = (event: KeyboardEvent): void => {
    this.handleCaptureKeyDown(event);
  };

  constructor(scene: Phaser.Scene, onLocaleChanged?: () => void) {
    this.scene = scene;
    this.onLocaleChanged = onLocaleChanged;
    this.container = scene.add.container(0, 0).setDepth(4200).setVisible(false);
    scene.events.on('postupdate', this.syncViewportPosition, this);
    scene.events.once('shutdown', () => {
      this.cancelRebinding(false);
      this.controlsFeedback = null;
      scene.events.off('postupdate', this.syncViewportPosition, this);
    });
  }

  public syncViewportPosition(): void {
    if (!this.container.active || !this.container.visible) return;
    const cam = this.scene.cameras?.main;
    if (cam) {
      this.container.setPosition(cam.midPoint.x - 480, cam.midPoint.y - 270);
    }
  }

  public destroy(): void {
    this.cancelRebinding(false);
    this.controlsFeedback = null;
    this.scene.events.off('postupdate', this.syncViewportPosition, this);
  }

  public getActiveModal(): ModalKind {
    return this.activeModal;
  }

  public getActiveTab(): SettingsTabId {
    return this.activeTab;
  }

  public getRebindingAction(): KeybindActionId | null {
    return this.rebindingAction;
  }

  public startRebinding(action: KeybindActionId): void {
    if (!this.isOpen()) return;
    this.rebindingAction = action;
    this.controlsFeedback = null;
    this.attachCaptureListener();
    this.syncDebugFlags();
    if (this.activeModal !== 'none') this.rebuild();
  }

  public cancelRebinding(showNotice = false): void {
    const wasRebinding = this.rebindingAction !== null;
    this.rebindingAction = null;
    this.detachCaptureListener();
    if (showNotice) {
      this.controlsFeedback = {
        text: i18n.t('ui.controls.cancelledNotice'),
        tone: 'info',
      };
    }
    this.syncDebugFlags();
    if (wasRebinding && showNotice && this.activeModal !== 'none') {
      this.rebuild();
    }
  }

  private attachCaptureListener(): void {
    if (this.captureListenerAttached || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.boundCaptureKeyDown, true);
    this.captureListenerAttached = true;
  }

  private detachCaptureListener(): void {
    if (!this.captureListenerAttached || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.boundCaptureKeyDown, true);
    this.captureListenerAttached = false;
  }

  private handleCaptureKeyDown(event: KeyboardEvent): void {
    if (!this.rebindingAction || !this.isOpen()) {
      this.detachCaptureListener();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;

    const action = this.rebindingAction;
    const res = normalizeKeyEventToBindingCode(event);
    if (res.status === 'cancel') {
      zzfx.play('ui_hover');
      this.cancelRebinding(true);
      return;
    }
    if (res.status === 'reserved' || res.status === 'unsupported') {
      this.controlsFeedback = {
        text: i18n.t('ui.controls.reservedNotice', { key: res.displayLabel }),
        tone: 'warn',
      };
      zzfx.play('ui_hover');
      this.rebuild();
      return;
    }

    const update = graphicsSettings.setKeybinding(action, res.code);
    this.rebindingAction = null;
    this.detachCaptureListener();
    const actionTitle = i18n.t(`ui.controls.actions.${action}`);
    if (update.ok && update.swappedWith) {
      const otherTitle = i18n.t(`ui.controls.actions.${update.swappedWith}`);
      this.controlsFeedback = {
        text: i18n.t('ui.controls.swappedNotice', {
          key: res.displayLabel,
          action: actionTitle,
          otherAction: otherTitle,
        }),
        tone: 'success',
      };
    } else {
      const isEn = graphicsSettings.getState().language === 'en';
      this.controlsFeedback = {
        text: isEn
          ? `${actionTitle} bound to [${res.displayLabel}].`
          : `Đã gán [${res.displayLabel}] cho ${actionTitle}.`,
        tone: 'success',
      };
    }
    this.syncDebugFlags();
    zzfx.play('ui_click');
    this.onLocaleChanged?.();
    this.rebuild();
  }

  public setLanguage(lang: SupportedLocale): void {
    this.cancelRebinding(false);
    this.controlsFeedback = null;
    graphicsSettings.setLanguage(lang);
    this.syncDebugFlags();
    this.onLocaleChanged?.();
    if (this.activeModal !== 'none') this.rebuild();
  }

  public selectTab(tab: SettingsTabId): void {
    this.cancelRebinding(false);
    this.controlsFeedback = null;
    this.activeTab = tab;
    if (this.activeModal === 'controls' && tab !== 'controls') this.activeModal = 'settings';
    this.syncDebugFlags();
    this.rebuild();
  }

  public isOpen(): boolean {
    return this.activeModal !== 'none';
  }

  public open(kind: Exclude<ModalKind, 'none'>, initialTab?: SettingsTabId): void {
    this.cancelRebinding(false);
    this.controlsFeedback = null;
    this.activeModal = kind;
    this.activeTab = kind === 'controls' ? 'controls' : (initialTab ?? 'audio');
    this.syncDebugFlags();
    this.rebuild();
  }

  public close(): void {
    if (this.activeModal === 'none') return;
    this.cancelRebinding(false);
    this.controlsFeedback = null;
    this.activeModal = 'none';
    this.syncDebugFlags();
    this.container.removeAll(true);
    this.textObjects = [];
    this.container.setVisible(false);
    (this.scene.input as unknown as { preUpdate?: () => void })?.preUpdate?.();
  }

  public refreshResolution(scale: number): void {
    for (const txt of this.textObjects) {
      if (txt.active) txt.setResolution(scale);
    }
  }

  private syncDebugFlags(): void {
    const debug = initGlobalDebugState();
    debug.settingsModalOpen = this.activeModal === 'settings';
    debug.controlsModalOpen =
      this.activeModal === 'controls' ||
      (this.activeModal === 'settings' && this.activeTab === 'controls');
    debug.creditsModalOpen = this.activeModal === 'credits';
    debug.settingsActiveTab = this.activeTab;
    debug.language = graphicsSettings.getState().language;
    debug.rebindingAction = this.rebindingAction;
  }

  public rebuild(): void {
    this.container.removeAll(true);
    this.textObjects = [];
    if (this.activeModal === 'none') {
      this.container.setVisible(false);
      (this.scene.input as unknown as { preUpdate?: () => void })?.preUpdate?.();
      return;
    }
    this.container.setVisible(true);
    this.syncViewportPosition();
    const textRes = TextureBaker.getBakeScale();

    // Fullscreen dark backdrop blocker (absorbs clicks behind modal)
    const blocker = this.scene.add
      .rectangle(480, 270, 2400, 1600, hexToNum(PALETTE.INK_DARK), 0.82)
      .setInteractive();
    this.container.add(blocker);

    if (this.activeModal === 'settings' || this.activeModal === 'controls') {
      this.buildTabbedSettingsModal(textRes);
    } else if (this.activeModal === 'credits') {
      this.buildCreditsModal(textRes);
    }
    flushSceneInteractiveContainer(this.scene, this.container);
  }

  private buildTabbedSettingsModal(textRes: number): void {
    const s = graphicsSettings.getState();
    const isEn = s.language === 'en';
    const cardW = 660;
    const cardH = 444;
    const cardX = 480 - cardW / 2;
    const cardY = 270 - cardH / 2;

    const panel = this.scene.add.graphics();
    drawStyledPanel(panel, cardX, cardY, cardW, cardH, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.98,
      borderColor: hexToNum(PALETTE.SOLAR_GOLD),
      borderWidth: 2.4,
      radius: UI_THEME.panelRadius.lg,
      accentColor: hexToNum(PALETTE.SOLAR_GOLD),
      accentSide: 'top',
    });
    // Header divider line below tabs
    panel.lineStyle(1.2, UI_THEME.panelBorder, 0.75);
    panel.lineBetween(cardX + 20, cardY + 82, cardX + cardW - 20, cardY + 82);
    // Footer divider line
    panel.lineBetween(cardX + 20, cardY + cardH - 52, cardX + cardW - 20, cardY + cardH - 52);
    this.container.add(panel);

    const title = this.scene.add
      .text(480, cardY + 24, getSettingsModalTitle(s.language), {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '20px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 4,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(title);
    this.container.add(title);

    // 4-Tab Bar (Audio, Video, Gameplay, Controls)
    const tabSpecs = getSettingsTabSpecs(s.language);
    for (const tab of tabSpecs) {
      const isSelected = this.activeTab === tab.id;
      const tabBtn = this.scene.add.container(tab.cx, tab.cy);
      const tabBg = this.scene.add.graphics();
      const drawTab = (hover: boolean) => {
        tabBg.clear();
        drawStyledPanel(tabBg, -tab.w / 2, -tab.h / 2, tab.w, tab.h, {
          fillColor: isSelected
            ? UI_THEME.panelBgElevated
            : hover
              ? UI_THEME.panelBg
              : UI_THEME.panelBgDark,
          fillAlpha: 0.96,
          borderColor: hexToNum(
            isSelected ? PALETTE.SOLAR_GOLD : hover ? PALETTE.CYAN_FROST : PALETTE.SLATE_MID,
          ),
          borderWidth: isSelected ? 2.2 : 1.4,
          radius: 6,
          accentColor: isSelected ? hexToNum(PALETTE.SOLAR_GOLD) : undefined,
          accentSide: isSelected ? 'top' : 'none',
        });
      };
      drawTab(false);

      const tabTxt = this.scene.add
        .text(0, 0, tab.label, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '12px',
          fontStyle: '800',
          color: isSelected ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.5,
          resolution: textRes,
        })
        .setOrigin(0.5);
      this.textObjects.push(tabTxt);

      const tabHit = this.scene.add
        .rectangle(0, 0, tab.w, tab.h, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      tabHit.on('pointerover', () => {
        if (!isSelected) {
          drawTab(true);
          zzfx.play('ui_hover');
        }
      });
      tabHit.on('pointerout', () => drawTab(false));
      tabHit.on('pointerdown', () => {
        if (this.activeTab !== tab.id) {
          zzfx.play('ui_click');
          this.selectTab(tab.id);
        }
      });

      tabBtn.add([tabBg, tabTxt, tabHit]);
      this.container.add(tabBtn);
    }

    // Active Tab Content Area
    if (this.activeTab === 'controls') {
      this.buildControlsTabContent(cardX, cardY, cardW, textRes, isEn);
    } else {
      const rows = this.getRowsForTab(this.activeTab, textRes);
      this.renderSettingRows(cardX, cardY, cardW, rows, textRes);
    }

    // Bottom Footer: Auto-save hint + Restore Defaults + Close [Esc]
    const footerY = cardY + cardH - 26;
    const subHint = this.scene.add
      .text(
        cardX + 24,
        footerY,
        isEn
          ? '💾 Automatically saved to browser localStorage'
          : '💾 Tự động lưu vào trình duyệt (localStorage)',
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '11.5px',
          fontStyle: '600',
          color: PALETTE.ASH_GRAY,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2,
          resolution: textRes,
        },
      )
      .setOrigin(0, 0.5);
    this.textObjects.push(subHint);
    this.container.add(subHint);

    this.addSmallButton(
      534,
      footerY,
      166,
      28,
      i18n.t('ui.settings.resetDefaults'),
      PALETTE.BRONZE_SHADE,
      () => {
        this.cancelRebinding(false);
        this.controlsFeedback = null;
        graphicsSettings.resetDefaults();
        this.syncDebugFlags();
        zzfx.play('ui_click');
        this.onLocaleChanged?.();
        this.rebuild();
      },
      textRes,
    );

    this.addSmallButton(
      704,
      footerY,
      146,
      28,
      i18n.t('ui.settings.close'),
      PALETTE.RUBY_CORE,
      () => {
        zzfx.play('ui_click');
        this.close();
      },
      textRes,
    );
  }

  private getRowsForTab(
    tab: Exclude<SettingsTabId, 'controls'>,
    _textRes: number,
  ): SettingRowSpec[] {
    const s = graphicsSettings.getState();
    const isEn = s.language === 'en';
    const onLabel = i18n.t('ui.settings.on');
    const offLabel = i18n.t('ui.settings.off');

    if (tab === 'audio') {
      const isMuted = s.masterVolume <= 0.001;
      return [
        {
          id: 'masterVolume',
          label: i18n.t('ui.settings.masterVolume'),
          subLabel: isEn
            ? 'Global output level for all synthesized audio'
            : 'Mức âm lượng tổng cho toàn bộ âm thanh trong game',
          valueText: `${Math.round(s.masterVolume * 100)}%`,
          ratio: s.masterVolume,
          segments: 10,
          barColor: hexToNum(PALETTE.SOLAR_GOLD),
          onDec: () => {
            graphicsSettings.setMasterVolume(s.masterVolume - 0.1);
            zzfx.play('ui_click');
            this.rebuild();
          },
          onInc: () => {
            graphicsSettings.setMasterVolume(s.masterVolume + 0.1);
            zzfx.play('ui_click');
            this.rebuild();
          },
        },
        {
          id: 'musicVolume',
          label: i18n.t('ui.settings.musicVolume'),
          subLabel: isEn
            ? 'Dual-layer ambient & combat synth sequencer'
            : 'Nhạc nền động 2 lớp chuyển pha theo giao chiến',
          valueText: `${Math.round(s.musicVolume * 100)}%`,
          ratio: s.musicVolume,
          segments: 10,
          barColor: hexToNum(PALETTE.AZURE_CORE),
          onDec: () => {
            graphicsSettings.setMusicVolume(s.musicVolume - 0.1);
            zzfx.play('ui_click');
            this.rebuild();
          },
          onInc: () => {
            graphicsSettings.setMusicVolume(s.musicVolume + 0.1);
            zzfx.play('ui_click');
            this.rebuild();
          },
        },
        {
          id: 'sfxVolume',
          label: i18n.t('ui.settings.sfxVolume'),
          subLabel: isEn
            ? 'Weapons, elemental reactions, boss telegraphs & UI'
            : 'Tiếng vũ khí, phản ứng nguyên tố, đòn trùm & giao diện',
          valueText: `${Math.round(s.sfxVolume * 100)}%`,
          ratio: s.sfxVolume,
          segments: 10,
          barColor: hexToNum(PALETTE.LIME_GLOW),
          onDec: () => {
            graphicsSettings.setSfxVolume(s.sfxVolume - 0.1);
            zzfx.play('ui_click');
            this.rebuild();
          },
          onInc: () => {
            graphicsSettings.setSfxVolume(s.sfxVolume + 0.1);
            zzfx.play('ui_click');
            this.rebuild();
          },
        },
        {
          id: 'muteAll',
          label: isEn ? 'Mute All Audio' : 'Tắt tiếng nhanh',
          subLabel: isEn
            ? 'Instantly mute or restore master audio output'
            : 'Tắt hoặc khôi phục nhanh toàn bộ âm thanh',
          valueText: isMuted ? onLabel : offLabel,
          onToggle: () => {
            graphicsSettings.setMasterVolume(isMuted ? 0.85 : 0);
            zzfx.play('ui_click');
            this.rebuild();
          },
        },
      ];
    }

    if (tab === 'video') {
      const qualityLabel =
        s.quality === 'high'
          ? i18n.t('ui.settings.qualityHigh')
          : s.quality === 'medium'
            ? i18n.t('ui.settings.qualityMedium')
            : i18n.t('ui.settings.qualityLow');

      return [
        {
          id: 'graphicsQuality',
          label: i18n.t('ui.settings.graphicsQuality'),
          subLabel: isEn
            ? 'Controls lightmap resolution, bloom & particle budget'
            : 'Điều chỉnh độ phân giải ánh sáng động, bloom & hạt hiệu ứng',
          valueText: qualityLabel,
          onToggle: () => {
            graphicsSettings.cycleQuality();
            zzfx.play('ui_click');
            this.onLocaleChanged?.();
            this.rebuild();
          },
        },
        {
          id: 'autoQuality',
          label: i18n.t('ui.settings.autoQuality'),
          subLabel: isEn
            ? 'Steps down preset automatically if sustained FPS drops'
            : 'Tự động giảm bậc đồ họa khi FPS duy trì dưới ngưỡng',
          valueText: s.autoQuality ? onLabel : offLabel,
          onToggle: () => {
            graphicsSettings.setAutoQuality(!s.autoQuality);
            zzfx.play('ui_click');
            this.rebuild();
          },
        },
        {
          id: 'screenShake',
          label: i18n.t('ui.settings.screenShake'),
          subLabel: isEn
            ? 'Camera trauma shake on heavy hits & explosions'
            : 'Độ rung camera khi nổ nguyên tố hoặc trúng đòn mạnh',
          valueText: `${Math.round(s.screenShakeIntensity * 100)}%`,
          ratio: s.screenShakeIntensity,
          segments: 5,
          barColor: hexToNum(PALETTE.FLAME_ORANGE),
          onDec: () => {
            graphicsSettings.setScreenShakeIntensity(s.screenShakeIntensity - 0.2);
            zzfx.play('ui_click');
            this.rebuild();
          },
          onInc: () => {
            graphicsSettings.setScreenShakeIntensity(s.screenShakeIntensity + 0.2);
            zzfx.play('ui_click');
            this.rebuild();
          },
        },
        {
          id: 'fullscreen',
          label: i18n.t('ui.settings.fullscreen'),
          subLabel: isEn
            ? 'Toggle borderless browser fullscreen mode'
            : 'Chuyển đổi chế độ hiển thị toàn màn hình',
          valueText: s.fullscreen ? onLabel : offLabel,
          onToggle: () => {
            const nextFs = !s.fullscreen;
            graphicsSettings.setFullscreen(nextFs);
            try {
              if (nextFs && !this.scene.scale.isFullscreen) {
                this.scene.scale.startFullscreen();
              } else if (!nextFs && this.scene.scale.isFullscreen) {
                this.scene.scale.stopFullscreen();
              }
            } catch {
              // Ignore fullscreen API restrictions in headless browsers
            }
            zzfx.play('ui_click');
            this.rebuild();
          },
        },
      ];
    }

    // Gameplay tab: Language, UI Scale (80%-130%), Key Hints (On/Off), Damage Numbers, Teammate FX Opacity
    return [
      {
        id: 'language',
        label: isEn ? 'Display Language' : 'Ngôn ngữ hiển thị',
        subLabel: isEn
          ? 'Switch all UI, weapon & blessing texts (VI / EN)'
          : 'Chuyển đổi ngôn ngữ giao diện, vũ khí & phước lành',
        valueText: s.language === 'vi' ? 'Tiếng Việt (VI)' : 'English (EN)',
        onToggle: () => {
          graphicsSettings.toggleLanguage();
          this.syncDebugFlags();
          zzfx.play('ui_click');
          this.onLocaleChanged?.();
          this.rebuild();
        },
      },
      {
        id: 'uiScale',
        label: isEn ? 'HUD & UI Scale' : 'Tỷ lệ Giao diện (UI Scale)',
        subLabel: isEn
          ? 'Scale combat HUD panels from 80% to 130%'
          : 'Thu phóng kích thước cụm HUD chiến đấu từ 80% đến 130%',
        valueText: `${Math.round(s.uiScale * 100)}%`,
        ratio: (s.uiScale - 0.8) / 0.5,
        segments: 10,
        barColor: hexToNum(PALETTE.SOLAR_GOLD),
        onDec: () => {
          graphicsSettings.setUiScale(s.uiScale - 0.05);
          zzfx.play('ui_click');
          this.onLocaleChanged?.();
          this.rebuild();
        },
        onInc: () => {
          graphicsSettings.setUiScale(s.uiScale + 0.05);
          zzfx.play('ui_click');
          this.onLocaleChanged?.();
          this.rebuild();
        },
      },
      {
        id: 'showKeyHints',
        label: isEn ? 'Show Keybind Hints' : 'Hiển thị Gợi ý Phím tắt',
        subLabel: isEn
          ? `Display [${graphicsSettings.getActionKeyLabel('skill')}], [${graphicsSettings.getActionKeyLabel('dash')}], [${graphicsSettings.getActionKeyLabel('interact')}], [${graphicsSettings.getActionKeyLabel('swapWeapon')}] key chips on HUD`
          : `Hiển thị nhãn phím [${graphicsSettings.getActionKeyLabel('skill')}], [${graphicsSettings.getActionKeyLabel('dash')}], [${graphicsSettings.getActionKeyLabel('interact')}], [${graphicsSettings.getActionKeyLabel('swapWeapon')}] trên HUD`,
        valueText: s.showKeyHints ? onLabel : offLabel,
        onToggle: () => {
          graphicsSettings.setShowKeyHints(!s.showKeyHints);
          zzfx.play('ui_click');
          this.onLocaleChanged?.();
          this.rebuild();
        },
      },
      {
        id: 'damageNumbers',
        label: i18n.t('ui.settings.damageNumbers'),
        subLabel: isEn
          ? 'Floating damage popups & critical hit callouts'
          : 'Hiển thị số sát thương bay lên khi bắn trúng mục tiêu',
        valueText: s.showDamageNumbers ? onLabel : offLabel,
        onToggle: () => {
          graphicsSettings.setShowDamageNumbers(!s.showDamageNumbers);
          zzfx.play('ui_click');
          this.rebuild();
        },
      },
      {
        id: 'teammateFxOpacity',
        label: i18n.t('ui.settings.teammateFxOpacity'),
        subLabel: isEn
          ? 'Adjust ally projectile & skill visual intensity (30%–100%)'
          : 'Độ rõ đạn và kỹ năng của đồng đội Co-op (30%–100%)',
        valueText: `${Math.round(s.teammateFxOpacity * 100)}%`,
        ratio: (s.teammateFxOpacity - 0.3) / 0.7,
        segments: 7,
        barColor: hexToNum(PALETTE.CYAN_FROST),
        onDec: () => {
          graphicsSettings.setTeammateFxOpacity(s.teammateFxOpacity - 0.1);
          zzfx.play('ui_click');
          this.rebuild();
        },
        onInc: () => {
          graphicsSettings.setTeammateFxOpacity(s.teammateFxOpacity + 0.1);
          zzfx.play('ui_click');
          this.rebuild();
        },
      },
    ];
  }

  private renderSettingRows(
    cardX: number,
    cardY: number,
    cardW: number,
    rows: SettingRowSpec[],
    textRes: number,
  ): void {
    const startY = cardY + 114;
    const rowStep = rows.length <= 4 ? 64 : 54;
    const rowH = rows.length <= 4 ? 52 : 44;

    rows.forEach((r, idx) => {
      const ry = startY + idx * rowStep;
      const rowBg = this.scene.add.graphics();
      drawStyledPanel(rowBg, cardX + 22, ry - rowH / 2, cardW - 44, rowH, {
        fillColor: idx % 2 === 0 ? UI_THEME.panelBg : UI_THEME.panelBgElevated,
        fillAlpha: 0.88,
        borderColor: UI_THEME.panelBorder,
        borderWidth: 1.2,
        radius: 6,
      });
      this.container.add(rowBg);

      const lbl = this.scene.add
        .text(cardX + 36, r.subLabel ? ry - 7 : ry, r.label, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '13px',
          fontStyle: '800',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.5,
          resolution: textRes,
        })
        .setOrigin(0, 0.5);
      this.textObjects.push(lbl);
      this.container.add(lbl);

      if (r.subLabel) {
        const sub = this.scene.add
          .text(cardX + 36, ry + 10, r.subLabel, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '10.5px',
            fontStyle: '600',
            color: PALETTE.ASH_GRAY,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 2,
            resolution: textRes,
          })
          .setOrigin(0, 0.5);
        this.textObjects.push(sub);
        this.container.add(sub);
      }

      if (typeof r.ratio === 'number' && r.onDec && r.onInc) {
        // Dec button at cardX + 355 (x = 505), bar at cardX + 376..496, Inc button at cardX + 516 (x = 666)
        this.addSmallButton(cardX + 355, ry, 28, 24, '−', PALETTE.SLATE_MID, r.onDec, textRes);

        const barW = 120;
        const barH = 12;
        const barX = cardX + 376;
        const barY = ry - barH / 2;
        const barGfx = this.scene.add.graphics();
        const segCount = r.segments ?? 10;
        drawSegmentedBar(barGfx, {
          x: barX,
          y: barY,
          width: barW,
          height: barH,
          current: r.ratio * segCount,
          max: segCount,
          maxSegments: segCount,
          fillColor: r.barColor ?? hexToNum(PALETTE.SOLAR_GOLD),
        });
        this.container.add(barGfx);

        this.addSmallButton(cardX + 516, ry, 28, 24, '+', PALETTE.SLATE_MID, r.onInc, textRes);

        const valTxt = this.scene.add
          .text(cardX + 576, ry, r.valueText, {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '12.5px',
            fontStyle: '700',
            color: PALETTE.SOLAR_GOLD,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 2.2,
            resolution: textRes,
          })
          .setOrigin(0.5);
        this.textObjects.push(valTxt);
        this.container.add(valTxt);
      } else if (r.onToggle) {
        this.addSmallButton(
          cardX + 485,
          ry,
          210,
          26,
          `◀  ${r.valueText}  ▶`,
          PALETTE.SLATE_MID,
          r.onToggle,
          textRes,
        );
      }
    });
  }

  private buildControlsTabContent(
    cardX: number,
    cardY: number,
    cardW: number,
    textRes: number,
    _isEn: boolean,
  ): void {
    const keybindings = graphicsSettings.getKeybindings();

    // 1. Top Status / Instruction Banner (y = cardY + 88 .. cardY + 112)
    const bannerX = cardX + 24;
    const bannerY = cardY + 88;
    const bannerW = cardW - 48;
    const bannerH = 24;

    let bannerText = i18n.t('ui.controls.rebindHint');
    let bannerBorderHex: string = PALETTE.SLATE_MID;
    let bannerTextColor: string = PALETTE.SILVER_BRIGHT;

    if (this.controlsFeedback) {
      bannerText = this.controlsFeedback.text;
      if (this.controlsFeedback.tone === 'warn') {
        bannerBorderHex = PALETTE.FLAME_ORANGE;
        bannerTextColor = PALETTE.FLAME_ORANGE;
      } else if (this.controlsFeedback.tone === 'success') {
        bannerBorderHex = PALETTE.LIME_GLOW;
        bannerTextColor = PALETTE.LIME_GLOW;
      } else {
        bannerBorderHex = PALETTE.CYAN_FROST;
        bannerTextColor = PALETTE.CYAN_FROST;
      }
    } else if (this.rebindingAction) {
      const actionTitle = i18n.t(`ui.controls.actions.${this.rebindingAction}`);
      bannerText = i18n.t('ui.controls.listeningPrompt', { action: actionTitle });
      bannerBorderHex = PALETTE.CYAN_FROST;
      bannerTextColor = PALETTE.CYAN_FROST;
    }

    const bannerGfx = this.scene.add.graphics();
    drawStyledPanel(bannerGfx, bannerX, bannerY, bannerW, bannerH, {
      fillColor: UI_THEME.panelBgElevated,
      fillAlpha: 0.94,
      borderColor: hexToNum(bannerBorderHex),
      borderWidth: this.rebindingAction || this.controlsFeedback ? 1.6 : 1.1,
      radius: 5,
    });
    this.container.add(bannerGfx);

    const bannerTxt = this.scene.add
      .text(480, bannerY + bannerH * 0.5, bannerText, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '10.5px',
        fontStyle: '700',
        color: bannerTextColor,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2,
        resolution: textRes,
      })
      .setOrigin(0.5);
    if (bannerTxt.width > bannerW - 18) {
      bannerTxt.setScale((bannerW - 18) / bannerTxt.width, 1);
    }
    this.textObjects.push(bannerTxt);
    this.container.add(bannerTxt);

    // 2. 14 Interactive Action Rows (7x2 grid inside y = 165.5 .. 378.5)
    for (let idx = 0; idx < KEYBIND_ACTION_IDS.length; idx++) {
      const bounds = getControlsActionRowBounds(idx, cardX, cardY);
      const isListening = this.rebindingAction === bounds.action;
      const keyLabel = getActionDisplayLabel(bounds.action, keybindings);
      const pillText = isListening ? '[ ... ]' : `[${keyLabel}]`;

      const rowGfx = this.scene.add.graphics();
      const drawRow = (hover: boolean) => {
        rowGfx.clear();
        drawStyledPanel(rowGfx, bounds.x, bounds.y, bounds.w, bounds.h, {
          fillColor: isListening
            ? UI_THEME.panelBgElevated
            : hover
              ? UI_THEME.panelBgElevated
              : UI_THEME.panelBg,
          fillAlpha: 0.92,
          borderColor: isListening
            ? hexToNum(PALETTE.CYAN_FROST)
            : hover
              ? hexToNum(PALETTE.SOLAR_GOLD)
              : UI_THEME.panelBorder,
          borderWidth: isListening ? 1.8 : hover ? 1.5 : 1.1,
          radius: 5,
        });
        drawStyledPanel(
          rowGfx,
          bounds.keyPillCx - bounds.keyPillW * 0.5,
          bounds.keyPillCy - bounds.keyPillH * 0.5,
          bounds.keyPillW,
          bounds.keyPillH,
          {
            fillColor: UI_THEME.panelBgDark,
            fillAlpha: 0.96,
            borderColor: hexToNum(
              isListening ? PALETTE.CYAN_FROST : hover ? PALETTE.SOLAR_GOLD : PALETTE.BRONZE_SHADE,
            ),
            borderWidth: isListening ? 1.8 : 1.2,
            radius: 4,
          },
        );
      };
      drawRow(false);
      this.container.add(rowGfx);

      const descTxt = this.scene.add
        .text(bounds.x + 10, bounds.cy, i18n.t(`ui.controls.actions.${bounds.action}`), {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '11px',
          fontStyle: '700',
          color: isListening ? PALETTE.CYAN_FROST : PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2,
          resolution: textRes,
        })
        .setOrigin(0, 0.5);
      if (descTxt.width > 198) {
        descTxt.setScale(198 / descTxt.width, 1);
      }

      const keyTxt = this.scene.add
        .text(bounds.keyPillCx, bounds.keyPillCy, pillText, {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '10.5px',
          fontStyle: '800',
          color: isListening ? PALETTE.CYAN_FROST : PALETTE.SOLAR_GOLD,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2,
          resolution: textRes,
        })
        .setOrigin(0.5, 0.5);
      if (keyTxt.width > bounds.keyPillW - 8) {
        keyTxt.setScale((bounds.keyPillW - 8) / keyTxt.width, 1);
      }

      const hit = this.scene.add
        .rectangle(bounds.cx, bounds.cy, bounds.w, bounds.h, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        drawRow(true);
        zzfx.play('ui_hover');
      });
      hit.on('pointerout', () => drawRow(false));
      hit.on('pointerdown', () => {
        zzfx.play('ui_click');
        if (this.rebindingAction === bounds.action) {
          this.cancelRebinding(true);
        } else {
          this.startRebinding(bounds.action);
        }
      });

      this.textObjects.push(descTxt, keyTxt);
      this.container.add([descTxt, keyTxt, hit]);
    }

    // 3. Compact 2-line Elemental Reactions cheat-sheet panel (y = cardY + 338, h = 47 -> 386..433)
    const reactBoxY = cardY + 338;
    const reactBoxW = cardW - 48;
    const reactBoxH = 47;
    const rBox = this.scene.add.graphics();
    drawStyledPanel(rBox, cardX + 24, reactBoxY, reactBoxW, reactBoxH, {
      fillColor: UI_THEME.panelBgElevated,
      fillAlpha: 0.92,
      borderColor: hexToNum(PALETTE.SOLAR_GOLD),
      borderWidth: 1.4,
      radius: 6,
      accentColor: hexToNum(PALETTE.SOLAR_GOLD),
      accentSide: 'left',
    });
    this.container.add(rBox);

    const reactLines = [
      `${i18n.t('reactions.vaporize')}: ${i18n.t('elements.burn')}+${i18n.t('elements.chill')}  ·  ${i18n.t('reactions.superconduct')}: ${i18n.t('elements.chill')}+${i18n.t('elements.shock')}  ·  ${i18n.t('reactions.overload')}: ${i18n.t('elements.burn')}+${i18n.t('elements.shock')}`,
      `${i18n.t('reactions.toxic_blast')}: ${i18n.t('elements.poison')}+${i18n.t('elements.burn')}  ·  ${i18n.t('reactions.paralysis')}: ${i18n.t('elements.poison')}+${i18n.t('elements.shock')}  ·  ${i18n.t('reactions.shatter')}: ${i18n.t('elements.chill')}(×3)+Crit`,
    ];

    reactLines.forEach((rl, idx) => {
      const rt = this.scene.add
        .text(480, reactBoxY + 15 + idx * 18, rl, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10px',
          fontStyle: '700',
          color: idx === 0 ? PALETTE.SOLAR_GOLD : PALETTE.SILVER_BRIGHT,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2,
          resolution: textRes,
        })
        .setOrigin(0.5);
      if (rt.width > reactBoxW - 22) {
        rt.setScale((reactBoxW - 22) / rt.width, 1);
      }
      this.textObjects.push(rt);
      this.container.add(rt);
    });
  }

  private buildCreditsModal(textRes: number): void {
    const cardW = 580;
    const cardH = 320;
    const cardX = 480 - cardW / 2;
    const cardY = 270 - cardH / 2;

    const panel = this.scene.add.graphics();
    drawStyledPanel(panel, cardX, cardY, cardW, cardH, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.98,
      borderColor: hexToNum(PALETTE.SOLAR_GOLD),
      borderWidth: 2.4,
      radius: UI_THEME.panelRadius.lg,
      accentColor: hexToNum(PALETTE.SOLAR_GOLD),
      accentSide: 'top',
    });
    this.container.add(panel);

    const title = this.scene.add
      .text(480, cardY + 34, i18n.t('ui.credits.title'), {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '20px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 4,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(title);
    this.container.add(title);

    const creditsLines = [
      { text: i18n.t('ui.credits.studio'), color: PALETTE.BONE_WHITE, size: '14px' },
      { text: i18n.t('ui.credits.engine'), color: PALETTE.CYAN_FROST, size: '13px' },
      { text: i18n.t('ui.credits.artAudio'), color: PALETTE.LIME_GLOW, size: '13px' },
      { text: i18n.t('ui.credits.coop'), color: PALETTE.SILVER_BRIGHT, size: '13px' },
      { text: i18n.t('ui.credits.thanks'), color: PALETTE.SOLAR_GOLD, size: '14px' },
    ];

    creditsLines.forEach((item, idx) => {
      const ct = this.scene.add
        .text(480, cardY + 86 + idx * 36, item.text, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: item.size,
          fontStyle: '700',
          color: item.color,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.5,
          resolution: textRes,
        })
        .setOrigin(0.5);
      this.textObjects.push(ct);
      this.container.add(ct);
    });

    this.addSmallButton(
      480,
      cardY + cardH - 34,
      180,
      30,
      i18n.t('ui.credits.close'),
      PALETTE.RUBY_CORE,
      () => {
        zzfx.play('ui_click');
        this.close();
      },
      textRes,
    );
  }

  private addSmallButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fillHex: string,
    onClick: () => void,
    textRes: number,
  ): void {
    const btn = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      drawStyledPanel(bg, -w / 2, -h / 2, w, h, {
        fillColor: hexToNum(hover ? PALETTE.SOLAR_GOLD : fillHex),
        fillAlpha: 0.96,
        borderColor: hover ? hexToNum(PALETTE.SOLAR_GOLD) : UI_THEME.inkDark,
        borderWidth: 1.8,
        radius: 6,
      });
    };
    draw(false);

    const txt = this.scene.add
      .text(0, 0, label, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '12px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(txt);

    const hit = this.scene.add
      .rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      draw(true);
      zzfx.play('ui_hover');
    });
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', onClick);

    btn.add([bg, txt, hit]);
    this.container.add(btn);
  }
}
