import Phaser from 'phaser';
import { i18n } from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../art/palette.js';
import { TextureBaker } from '../art/texture-baker.js';
import { zzfx } from '../audio/zzfx.js';
import { initGlobalDebugState } from './debug-overlay.js';
import { graphicsSettings } from './graphics-settings.js';

export type ModalKind = 'none' | 'settings' | 'controls' | 'credits';

export class ModalOverlayManager {
  private readonly scene: Phaser.Scene;
  private readonly onLocaleChanged?: () => void;
  private container: Phaser.GameObjects.Container;
  private activeModal: ModalKind = 'none';
  private textObjects: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, onLocaleChanged?: () => void) {
    this.scene = scene;
    this.onLocaleChanged = onLocaleChanged;
    this.container = scene.add.container(0, 0).setDepth(4200).setVisible(false);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncViewportPosition, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncViewportPosition, this);
    });
  }

  public syncViewportPosition(): void {
    if (!this.container.visible) return;
    const view = this.scene.cameras?.main?.worldView;
    if (view && view.width > 0) {
      this.container.setPosition(view.x, view.y);
    }
  }

  public getActiveModal(): ModalKind {
    return this.activeModal;
  }

  public isOpen(): boolean {
    return this.activeModal !== 'none';
  }

  public open(kind: Exclude<ModalKind, 'none'>): void {
    this.activeModal = kind;
    this.syncDebugFlags();
    this.rebuild();
  }

  public close(): void {
    if (this.activeModal === 'none') return;
    this.activeModal = 'none';
    this.syncDebugFlags();
    this.container.removeAll(true);
    this.textObjects = [];
    this.container.setVisible(false);
  }

  public refreshResolution(scale: number): void {
    for (const txt of this.textObjects) {
      if (txt.active) {
        txt.setResolution(scale);
      }
    }
  }

  private syncDebugFlags(): void {
    const debug = initGlobalDebugState();
    debug.settingsModalOpen = this.activeModal === 'settings';
    debug.controlsModalOpen = this.activeModal === 'controls';
    debug.creditsModalOpen = this.activeModal === 'credits';
    debug.language = graphicsSettings.getState().language;
  }

  public rebuild(): void {
    this.container.removeAll(true);
    this.textObjects = [];
    if (this.activeModal === 'none') {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);
    this.syncViewportPosition();
    const textRes = TextureBaker.getBakeScale();

    // Fullscreen dark backdrop blocker (absorbs clicks behind modal)
    const blocker = this.scene.add
      .rectangle(480, 270, 1920, 1080, hexToNum(PALETTE.INK_DARK), 0.82)
      .setInteractive();
    this.container.add(blocker);

    if (this.activeModal === 'settings') {
      this.buildSettingsModal(textRes);
    } else if (this.activeModal === 'controls') {
      this.buildControlsModal(textRes);
    } else if (this.activeModal === 'credits') {
      this.buildCreditsModal(textRes);
    }
  }

  private buildSettingsModal(textRes: number): void {
    const s = graphicsSettings.getState();
    const cardW = 640;
    const cardH = 446;
    const cardX = 480 - cardW / 2;
    const cardY = 270 - cardH / 2;

    const panel = this.scene.add.graphics();
    panel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.98);
    panel.lineStyle(3, hexToNum(PALETTE.SOLAR_GOLD), 1);
    panel.fillRoundedRect(cardX, cardY, cardW, cardH, 12);
    panel.strokeRoundedRect(cardX, cardY, cardW, cardH, 12);
    this.container.add(panel);

    const title = this.scene.add
      .text(480, cardY + 26, i18n.t('ui.settings.title'), {
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

    interface RowSpec {
      label: string;
      valueText: string;
      ratio?: number;
      barColor?: string;
      onDec?: () => void;
      onInc?: () => void;
      onToggle?: () => void;
    }

    const qualityLabel =
      s.quality === 'high'
        ? i18n.t('ui.settings.qualityHigh')
        : s.quality === 'medium'
          ? i18n.t('ui.settings.qualityMedium')
          : i18n.t('ui.settings.qualityLow');

    const rows: RowSpec[] = [
      {
        label: i18n.t('ui.settings.masterVolume'),
        valueText: `${Math.round(s.masterVolume * 100)}%`,
        ratio: s.masterVolume,
        barColor: PALETTE.SOLAR_GOLD,
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
        label: i18n.t('ui.settings.musicVolume'),
        valueText: `${Math.round(s.musicVolume * 100)}%`,
        ratio: s.musicVolume,
        barColor: PALETTE.AZURE_CORE,
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
        label: i18n.t('ui.settings.sfxVolume'),
        valueText: `${Math.round(s.sfxVolume * 100)}%`,
        ratio: s.sfxVolume,
        barColor: PALETTE.GOBLIN_GREEN,
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
        label: i18n.t('ui.settings.graphicsQuality'),
        valueText: qualityLabel,
        onToggle: () => {
          graphicsSettings.cycleQuality();
          zzfx.play('ui_click');
          this.rebuild();
        },
      },
      {
        label: i18n.t('ui.settings.autoQuality'),
        valueText: s.autoQuality ? i18n.t('ui.settings.on') : i18n.t('ui.settings.off'),
        onToggle: () => {
          graphicsSettings.setAutoQuality(!s.autoQuality);
          zzfx.play('ui_click');
          this.rebuild();
        },
      },
      {
        label: i18n.t('ui.settings.screenShake'),
        valueText: `${Math.round(s.screenShakeIntensity * 100)}%`,
        ratio: s.screenShakeIntensity,
        barColor: PALETTE.FLAME_ORANGE,
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
        label: i18n.t('ui.settings.damageNumbers'),
        valueText: s.showDamageNumbers ? i18n.t('ui.settings.on') : i18n.t('ui.settings.off'),
        onToggle: () => {
          graphicsSettings.setShowDamageNumbers(!s.showDamageNumbers);
          zzfx.play('ui_click');
          this.rebuild();
        },
      },
      {
        label: i18n.t('ui.settings.teammateFxOpacity'),
        valueText: `${Math.round(s.teammateFxOpacity * 100)}%`,
        ratio: (s.teammateFxOpacity - 0.3) / 0.7,
        barColor: PALETTE.CYAN_FROST,
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
      {
        label: i18n.t('ui.settings.language'),
        valueText: s.language === 'vi' ? 'Tiếng Việt (VI)' : 'English (EN)',
        onToggle: () => {
          graphicsSettings.toggleLanguage();
          this.syncDebugFlags();
          zzfx.play('ui_click');
          this.onLocaleChanged?.();
          this.rebuild();
        },
      },
    ];

    const startY = cardY + 62;
    const rowStep = 34;

    rows.forEach((r, idx) => {
      const ry = startY + idx * rowStep;
      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(hexToNum(idx % 2 === 0 ? PALETTE.INK_DEEP : PALETTE.STEEL_DARK), 0.55);
      rowBg.fillRoundedRect(cardX + 22, ry - 13, cardW - 44, 28, 6);
      this.container.add(rowBg);

      const lbl = this.scene.add
        .text(cardX + 36, ry, r.label, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '13px',
          fontStyle: '700',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.5,
          resolution: textRes,
        })
        .setOrigin(0, 0.5);
      this.textObjects.push(lbl);
      this.container.add(lbl);

      if (typeof r.ratio === 'number' && r.onDec && r.onInc) {
        this.addSmallButton(cardX + 355, ry, 28, 22, '−', PALETTE.SLATE_MID, r.onDec, textRes);

        const barW = 120;
        const barH = 10;
        const barX = cardX + 376;
        const barY = ry - barH / 2;
        const barGfx = this.scene.add.graphics();
        barGfx.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
        barGfx.fillRoundedRect(barX, barY, barW, barH, 4);
        barGfx.fillStyle(hexToNum(r.barColor ?? PALETTE.SOLAR_GOLD), 1);
        barGfx.fillRoundedRect(barX + 1, barY + 1, Math.max(2, (barW - 2) * r.ratio), barH - 2, 3);
        this.container.add(barGfx);

        this.addSmallButton(cardX + 516, ry, 28, 22, '+', PALETTE.SLATE_MID, r.onInc, textRes);

        const valTxt = this.scene.add
          .text(cardX + 575, ry, r.valueText, {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '12px',
            fontStyle: '700',
            color: PALETTE.SOLAR_GOLD,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 2,
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
          24,
          `◀  ${r.valueText}  ▶`,
          PALETTE.SLATE_MID,
          r.onToggle,
          textRes,
        );
      }
    });

    // Bottom buttons: Fullscreen, Reset Defaults, Close
    const btnY = cardY + cardH - 32;
    this.addSmallButton(
      292,
      btnY,
      228,
      30,
      `${i18n.t('ui.settings.fullscreen')}: ${s.fullscreen ? i18n.t('ui.settings.on') : i18n.t('ui.settings.off')}`,
      PALETTE.STEEL_DARK,
      () => {
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
      textRes,
    );

    this.addSmallButton(
      512,
      btnY,
      174,
      30,
      i18n.t('ui.settings.resetDefaults'),
      PALETTE.BRONZE_SHADE,
      () => {
        graphicsSettings.resetDefaults();
        this.syncDebugFlags();
        zzfx.play('ui_click');
        this.onLocaleChanged?.();
        this.rebuild();
      },
      textRes,
    );

    this.addSmallButton(
      695,
      btnY,
      155,
      30,
      i18n.t('ui.settings.close'),
      PALETTE.RUBY_CORE,
      () => {
        zzfx.play('ui_click');
        this.close();
      },
      textRes,
    );
  }

  private buildControlsModal(textRes: number): void {
    const cardW = 660;
    const cardH = 420;
    const cardX = 480 - cardW / 2;
    const cardY = 270 - cardH / 2;

    const panel = this.scene.add.graphics();
    panel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.98);
    panel.lineStyle(3, hexToNum(PALETTE.AZURE_CORE), 1);
    panel.fillRoundedRect(cardX, cardY, cardW, cardH, 12);
    panel.strokeRoundedRect(cardX, cardY, cardW, cardH, 12);
    this.container.add(panel);

    const title = this.scene.add
      .text(480, cardY + 28, i18n.t('ui.controls.title'), {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '20px',
        fontStyle: '800',
        color: PALETTE.CYAN_FROST,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 4,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(title);
    this.container.add(title);

    const lines = [
      i18n.t('ui.controls.move'),
      i18n.t('ui.controls.aimShoot'),
      i18n.t('ui.controls.skill'),
      i18n.t('ui.controls.dash'),
      i18n.t('ui.controls.swapWeapon'),
      i18n.t('ui.controls.interact'),
      i18n.t('ui.controls.map'),
      i18n.t('ui.controls.ping'),
      i18n.t('ui.controls.emote'),
      i18n.t('ui.controls.pause'),
    ];

    lines.forEach((line, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const lx = cardX + 32 + col * 305;
      const ly = cardY + 72 + row * 40;

      const box = this.scene.add.graphics();
      box.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.72);
      box.lineStyle(1.5, hexToNum(PALETTE.SLATE_MID), 0.8);
      box.fillRoundedRect(lx, ly - 15, 290, 30, 6);
      box.strokeRoundedRect(lx, ly - 15, 290, 30, 6);
      this.container.add(box);

      const txt = this.scene.add
        .text(lx + 12, ly, line, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '12px',
          fontStyle: '700',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2,
          resolution: textRes,
        })
        .setOrigin(0, 0.5);
      this.textObjects.push(txt);
      this.container.add(txt);
    });

    // Elemental Reactions summary box
    const reactBoxY = cardY + 275;
    const rBox = this.scene.add.graphics();
    rBox.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.85);
    rBox.lineStyle(1.5, hexToNum(PALETTE.SOLAR_GOLD), 0.9);
    rBox.fillRoundedRect(cardX + 32, reactBoxY, cardW - 64, 82, 8);
    rBox.strokeRoundedRect(cardX + 32, reactBoxY, cardW - 64, 82, 8);
    this.container.add(rBox);

    const reactLines = [
      `${i18n.t('reactions.vaporize')}: ${i18n.t('elements.burn')} + ${i18n.t('elements.chill')}   |   ${i18n.t('reactions.superconduct')}: ${i18n.t('elements.chill')} + ${i18n.t('elements.shock')}`,
      `${i18n.t('reactions.toxic_blast')}: ${i18n.t('elements.poison')} + ${i18n.t('elements.burn')}   |   ${i18n.t('reactions.paralysis')}: ${i18n.t('elements.poison')} + ${i18n.t('elements.shock')}`,
      `${i18n.t('reactions.overload')}: ${i18n.t('elements.burn')} + ${i18n.t('elements.shock')}   |   ${i18n.t('reactions.shatter')}: ${i18n.t('elements.chill')} (x3) + Crit/Melee`,
    ];

    reactLines.forEach((rl, idx) => {
      const rt = this.scene.add
        .text(480, reactBoxY + 18 + idx * 22, rl, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '11.5px',
          fontStyle: '700',
          color: idx === 0 ? PALETTE.SOLAR_GOLD : PALETTE.SILVER_BRIGHT,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2,
          resolution: textRes,
        })
        .setOrigin(0.5);
      this.textObjects.push(rt);
      this.container.add(rt);
    });

    this.addSmallButton(
      480,
      cardY + cardH - 30,
      180,
      30,
      i18n.t('ui.controls.close'),
      PALETTE.RUBY_CORE,
      () => {
        zzfx.play('ui_click');
        this.close();
      },
      textRes,
    );
  }

  private buildCreditsModal(textRes: number): void {
    const cardW = 580;
    const cardH = 320;
    const cardX = 480 - cardW / 2;
    const cardY = 270 - cardH / 2;

    const panel = this.scene.add.graphics();
    panel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.98);
    panel.lineStyle(3, hexToNum(PALETTE.SOLAR_GOLD), 1);
    panel.fillRoundedRect(cardX, cardY, cardW, cardH, 12);
    panel.strokeRoundedRect(cardX, cardY, cardW, cardH, 12);
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
      bg.fillStyle(hexToNum(hover ? PALETTE.SOLAR_GOLD : fillHex), 1);
      bg.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
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
