import Phaser from 'phaser';
import {
  type CharacterId,
  FixedTimestepLoop,
  i18n,
  VIETNAMESE_VERIFICATION_STRING,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { CutoutRig } from '../art/cutout-rig.js';
import { hexToNum, PALETTE } from '../art/palette.js';
import { GOBLIN_SHOOTER_RIG_DEF, RIG_DEFS_BY_ID } from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import { musicManager } from '../audio/music-synth.js';
import { zzfx } from '../audio/zzfx.js';
import { DebugOverlay, initGlobalDebugState } from '../ui/debug-overlay.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import { ModalOverlayManager } from '../ui/settings-modal.js';

const PRESET_NAMES_VI = [
  'Hiệp Sĩ Tro',
  'Cung Thủ Gió',
  'Pháp Sư Lửa',
  'Hiền Nhân Rừng',
  'Kỹ Sư Thép',
];

export interface MenuSceneInitData {
  disconnectReason?: string;
}

interface CampfireEmber {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  originX: number;
  originY: number;
}

export class MenuScene extends Phaser.Scene {
  private simLoop = new FixedTimestepLoop(60);
  private heroRigs: { charId: CharacterId; rig: CutoutRig; label: Phaser.GameObjects.Text }[] = [];
  private goblinPreview?: CutoutRig;
  private campfireGfx?: Phaser.GameObjects.Graphics;
  private campfireTimeSec = 0;
  private embers: CampfireEmber[] = [];
  private floorTileSprites: { sprite: Phaser.GameObjects.Sprite; variant: number }[] = [];
  private textObjects: Phaser.GameObjects.Text[] = [];
  private debugOverlay?: DebugOverlay;
  private modalManager?: ModalOverlayManager;

  private titleText?: Phaser.GameObjects.Text;
  private subtitleText?: Phaser.GameObjects.Text;
  private debugHintText?: Phaser.GameObjects.Text;
  private buttonLabels = new Map<string, Phaser.GameObjects.Text>();
  private refreshCoopBarFn?: () => void;

  private displayName: string = PRESET_NAMES_VI[0]!;
  private presetNameIndex = 0;
  private serverHostPort = '';
  private activeInputField: 'name' | 'ip' | null = null;
  private disconnectReason: string | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  public init(data?: MenuSceneInitData): void {
    this.disconnectReason = data?.disconnectReason ?? null;
    const savedName =
      typeof window !== 'undefined' ? window.localStorage?.getItem('ashen_pact_name') : null;
    if (savedName) {
      this.displayName = savedName;
    } else {
      this.presetNameIndex = Math.floor(Math.random() * PRESET_NAMES_VI.length);
      this.displayName = PRESET_NAMES_VI[this.presetNameIndex] ?? 'Hiệp Sĩ Tro';
    }
    const host =
      typeof window !== 'undefined' ? window.location.hostname || '127.0.0.1' : '127.0.0.1';
    this.serverHostPort = `${host}:2567`;
  }

  public create(): void {
    const debug = initGlobalDebugState();
    debug.scene = 'MenuScene';
    debug.language = graphicsSettings.getState().language;
    debug.pauseModalOpen = false;
    debug.settingsModalOpen = false;
    debug.controlsModalOpen = false;
    debug.creditsModalOpen = false;

    this.floorTileSprites = [];
    this.textObjects = [];
    this.heroRigs = [];
    this.buttonLabels.clear();
    this.activeInputField = null;
    this.campfireTimeSec = 0;

    this.applyCameraViewport();
    this.scale.on('resize', this.applyCameraViewport, this);

    this.input.on('pointerdown', () => {
      zzfx.unlockOnUserGesture();
    });

    const textRes = TextureBaker.getBakeScale();

    // Background panel (extended for ultrawide / non-16:9 aspect ratios)
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 1);
    bg.fillRect(-480, -270, WORLD_VIEW_WIDTH + 960, WORLD_VIEW_HEIGHT + 540);

    // Tiled Hub courtyard floor
    const invBake = 1 / textRes;
    for (let gx = 0; gx < 28; gx++) {
      for (let gy = 0; gy < 11; gy++) {
        const variant = (gx + gy) % 4;
        const tile = this.add.sprite(
          48 + gx * 32,
          128 + gy * 32,
          TextureBaker.getBiomeTileTextureKey(1, variant),
        );
        tile.setScale(invBake);
        tile.setAlpha(0.76);
        this.floorTileSprites.push({ sprite: tile, variant });
      }
    }

    // Dynamic Campfire Graphics layer (warm glow + flickering flames + rising embers)
    this.campfireGfx = this.add.graphics();
    this.initCampfireEmbers();
    this.drawCampfires(0);

    // Header Card
    const card = this.add.graphics();
    card.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.95);
    card.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
    card.fillRoundedRect(120, 22, 720, 96, 12);
    card.strokeRoundedRect(120, 22, 720, 96, 12);

    this.titleText = this.add
      .text(480, 51, i18n.t('ui.menu.title'), {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '27px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 5,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(this.titleText);

    this.subtitleText = this.add
      .text(480, 89, i18n.t('ui.menu.subtitle'), {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '13.5px',
        fontStyle: '600',
        color: PALETTE.SILVER_BRIGHT,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(this.subtitleText);

    if (this.disconnectReason) {
      const banner = this.add.graphics();
      banner.fillStyle(hexToNum(PALETTE.RUBY_DARK), 0.96);
      banner.lineStyle(2, hexToNum(PALETTE.RUBY_CORE), 1);
      banner.fillRoundedRect(210, 124, 540, 26, 7);
      banner.strokeRoundedRect(210, 124, 540, 26, 7);
      this.textObjects.push(
        this.add
          .text(480, 137, `⚠ ${this.disconnectReason}`, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '12px',
            fontStyle: '700',
            color: PALETTE.BONE_WHITE,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 2,
            resolution: textRes,
          })
          .setOrigin(0.5),
      );
    }

    // 5 Playable Hero Rigs gathered around the Hub campfires
    const heroPlacements: {
      charId: CharacterId;
      x: number;
      y: number;
      slot: 1 | 2 | 3 | 4;
      aim: number;
      phase: number;
    }[] = [
      { charId: 'vanguard', x: 104, y: 232, slot: 1, aim: 0.25, phase: 0.0 },
      { charId: 'ranger', x: 104, y: 348, slot: 2, aim: -0.15, phase: 0.4 },
      { charId: 'druid', x: 195, y: 198, slot: 4, aim: 0.45, phase: 0.8 },
      { charId: 'elementalist', x: 856, y: 232, slot: 3, aim: Math.PI - 0.25, phase: 0.2 },
      { charId: 'engineer', x: 856, y: 348, slot: 1, aim: Math.PI + 0.15, phase: 0.6 },
    ];

    for (const hp of heroPlacements) {
      const rigDef = RIG_DEFS_BY_ID[hp.charId]!;
      const rig = new CutoutRig(this, hp.x, hp.y, rigDef, {
        playerSlot: hp.slot,
        displayScale: 1.85,
        initialPhaseOffset: hp.phase,
      });
      rig.setAimAngle(hp.aim);

      const label = this.add
        .text(hp.x, hp.y + 30, i18n.t(`characters.${hp.charId}.name`), {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10.5px',
          fontStyle: '700',
          color: PALETTE.SOLAR_GOLD,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.5,
          resolution: textRes,
        })
        .setOrigin(0.5);
      this.textObjects.push(label);
      this.heroRigs.push({ charId: hp.charId, rig, label });
    }

    this.goblinPreview = new CutoutRig(this, 765, 198, GOBLIN_SHOOTER_RIG_DEF, {
      displayScale: 1.75,
      initialPhaseOffset: 0.7,
    });
    this.goblinPreview.setAimAngle(Math.PI - 0.35);

    // Co-op LAN Profile & IP Bar at y=176
    const coopBarBg = this.add.graphics();
    const coopBarText = this.add
      .text(480, 176, '', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '12px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(coopBarText);

    const refreshCoopBar = () => {
      coopBarBg.clear();
      coopBarBg.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
      coopBarBg.lineStyle(
        2,
        hexToNum(this.activeInputField ? PALETTE.SOLAR_GOLD : PALETTE.INK_DARK),
        1,
      );
      coopBarBg.fillRoundedRect(240, 160, 480, 32, 8);
      coopBarBg.strokeRoundedRect(240, 160, 480, 32, 8);

      const nameCursor = this.activeInputField === 'name' ? '▌' : '';
      const ipCursor = this.activeInputField === 'ip' ? '▌' : '';
      coopBarText.setText(
        `${i18n.t('ui.menu.nameLabel')}: [${this.displayName}${nameCursor}] ↻   |   ${i18n.t('ui.menu.ipLabel')}: [${this.serverHostPort}${ipCursor}]`,
      );
    };
    this.refreshCoopBarFn = refreshCoopBar;
    refreshCoopBar();

    // Interactive zones for Name & IP
    const nameZone = this.add
      .rectangle(355, 176, 220, 30, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    nameZone.on('pointerdown', () => {
      if (this.modalManager?.isOpen()) return;
      zzfx.play('ui_click');
      if (this.activeInputField === 'name') {
        this.presetNameIndex = (this.presetNameIndex + 1) % PRESET_NAMES_VI.length;
        this.displayName = PRESET_NAMES_VI[this.presetNameIndex] ?? 'Hiệp Sĩ Tro';
      } else {
        this.activeInputField = 'name';
      }
      refreshCoopBar();
    });

    const ipZone = this.add
      .rectangle(605, 176, 220, 30, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    ipZone.on('pointerdown', () => {
      if (this.modalManager?.isOpen()) return;
      zzfx.play('ui_click');
      this.activeInputField = this.activeInputField === 'ip' ? null : 'ip';
      refreshCoopBar();
    });

    // Keyboard handler for typing custom Name/IP or opening Menu Modals
    const onKeyDown = (event: KeyboardEvent) => {
      if (this.modalManager?.isOpen()) {
        if (event.key === 'Escape') {
          zzfx.play('ui_click');
          this.modalManager.close();
        }
        return;
      }

      if (this.activeInputField) {
        if (event.key === 'Escape' || event.key === 'Enter') {
          this.activeInputField = null;
          refreshCoopBar();
          return;
        }
        if (event.key === 'Backspace') {
          if (this.activeInputField === 'name') {
            this.displayName = this.displayName.slice(0, -1);
          } else {
            this.serverHostPort = this.serverHostPort.slice(0, -1);
          }
          refreshCoopBar();
          return;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          if (this.activeInputField === 'name' && this.displayName.length < 18) {
            this.displayName += event.key;
          } else if (this.activeInputField === 'ip' && this.serverHostPort.length < 28) {
            this.serverHostPort += event.key;
          }
          refreshCoopBar();
        }
        return;
      }

      const upper = event.key.toUpperCase();
      if (upper === 'O') {
        zzfx.play('ui_click');
        this.modalManager?.open('settings');
      } else if (upper === 'K') {
        zzfx.play('ui_click');
        this.modalManager?.open('controls');
      } else if (upper === 'C') {
        zzfx.play('ui_click');
        this.modalManager?.open('credits');
      } else if (upper === 'L') {
        zzfx.play('ui_click');
        graphicsSettings.toggleLanguage();
        this.refreshLocalizedText();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.applyCameraViewport, this);
      window.removeEventListener('keydown', onKeyDown);
    });

    // Auto-detect LAN IP from server if available
    fetch('/api/host-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((info: { primaryLanIp?: string; port?: number } | null) => {
        if (info?.primaryLanIp && this.scene.isActive('MenuScene')) {
          this.serverHostPort = `${info.primaryLanIp}:${info.port ?? 2567}`;
          refreshCoopBar();
        }
      })
      .catch(() => {
        // Ignore when server is offline
      });

    // Menu Buttons (Button 1 kept at exact (480, 225) for Phase 0-3 E2E compatibility)
    this.createMenuButton(
      'playSolo',
      480,
      225,
      340,
      38,
      i18n.t('ui.menu.playSolo'),
      PALETTE.RUBY_CORE,
      () => {
        if (this.modalManager?.isOpen()) return;
        zzfx.play('ui_click');
        this.scene.start('GameScene', { coopMode: 'solo' });
      },
    );

    this.createMenuButton(
      'hostCoop',
      480,
      268,
      340,
      38,
      i18n.t('ui.menu.hostCoop'),
      PALETTE.BRASS_CORE,
      () => {
        if (this.modalManager?.isOpen()) return;
        zzfx.play('ui_click');
        this.saveProfileName();
        this.scene.start('GameScene', {
          coopMode: 'host',
          displayName: this.displayName || 'Hiệp Sĩ Tro',
          serverUrl: this.resolveServerWsUrl(),
        });
      },
    );

    this.createMenuButton(
      'joinCoop',
      480,
      311,
      340,
      38,
      i18n.t('ui.menu.joinCoop'),
      PALETTE.AZURE_CORE,
      () => {
        if (this.modalManager?.isOpen()) return;
        zzfx.play('ui_click');
        this.saveProfileName();
        this.scene.start('GameScene', {
          coopMode: 'join',
          displayName: this.displayName || 'Cung Thủ Gió',
          serverUrl: this.resolveServerWsUrl(),
        });
      },
    );

    this.createMenuButton(
      'artGallery',
      392,
      353,
      164,
      34,
      i18n.t('ui.menu.artGallery'),
      PALETTE.STEEL_DARK,
      () => {
        if (this.modalManager?.isOpen()) return;
        zzfx.play('ui_click');
        this.scene.start('ArtGalleryScene');
      },
    );

    this.createMenuButton(
      'toggleAnim',
      568,
      353,
      164,
      34,
      i18n.t('ui.menu.toggleAnim'),
      PALETTE.GOBLIN_GREEN,
      () => {
        if (this.modalManager?.isOpen()) return;
        zzfx.play('ui_click');
        const firstRig = this.heroRigs[0]?.rig;
        const nextState = firstRig?.getAnimState() === 'idle' ? 'run' : 'idle';
        for (const hr of this.heroRigs) {
          hr.rig.setAnimState(nextState);
        }
        this.goblinPreview?.setAnimState(nextState);
        debug.animState = nextState;
      },
    );

    // Phase 7 Action Row: Settings [O], Controls [K], Credits [C], Language [L]
    this.createMenuButton(
      'settings',
      246,
      394,
      146,
      32,
      i18n.t('ui.menu.settings'),
      PALETTE.SLATE_MID,
      () => {
        if (this.modalManager?.isOpen()) return;
        zzfx.play('ui_click');
        this.modalManager?.open('settings');
      },
    );

    this.createMenuButton(
      'controls',
      402,
      394,
      146,
      32,
      i18n.t('ui.menu.controls'),
      PALETTE.SLATE_MID,
      () => {
        if (this.modalManager?.isOpen()) return;
        zzfx.play('ui_click');
        this.modalManager?.open('controls');
      },
    );

    this.createMenuButton(
      'credits',
      558,
      394,
      146,
      32,
      i18n.t('ui.menu.credits'),
      PALETTE.SLATE_MID,
      () => {
        if (this.modalManager?.isOpen()) return;
        zzfx.play('ui_click');
        this.modalManager?.open('credits');
      },
    );

    this.createMenuButton(
      'language',
      714,
      394,
      146,
      32,
      i18n.t('ui.menu.languageBtn'),
      PALETTE.FOREST_SHADE,
      () => {
        if (this.modalManager?.isOpen()) return;
        zzfx.play('ui_click');
        graphicsSettings.toggleLanguage();
        this.refreshLocalizedText();
      },
    );

    // Vietnamese Diacritics Verification Footer
    const footer = this.add.graphics();
    footer.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.95);
    footer.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
    footer.fillRoundedRect(110, 448, 740, 64, 10);
    footer.strokeRoundedRect(110, 448, 740, 64, 10);

    this.textObjects.push(
      this.add
        .text(480, 468, VIETNAMESE_VERIFICATION_STRING, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '16px',
          fontStyle: '700',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 3,
          resolution: textRes,
        })
        .setOrigin(0.5),
    );

    this.debugHintText = this.add
      .text(480, 494, i18n.t('ui.menu.footerHint'), {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '12px',
        color: PALETTE.CYAN_FROST,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(this.debugHintText);

    this.modalManager = new ModalOverlayManager(this, () => {
      this.refreshLocalizedText();
    });

    this.debugOverlay = new DebugOverlay(this, false);
  }

  private initCampfireEmbers(): void {
    this.embers = [];
    const firePositions: [number, number][] = [
      [195, 285],
      [765, 285],
    ];
    for (let i = 0; i < 24; i++) {
      const [ox, oy] = firePositions[i % 2]!;
      this.embers.push({
        x: ox + ((i * 7) % 18) - 9,
        y: oy - ((i * 11) % 45),
        vx: (((i * 13) % 20) - 10) * 0.8,
        vy: -18 - ((i * 5) % 22),
        size: 1.5 + (i % 3) * 0.8,
        alpha: 0.4 + (i % 5) * 0.12,
        life: (i * 0.13) % 1.8,
        maxLife: 1.4 + (i % 4) * 0.35,
        originX: ox,
        originY: oy,
      });
    }
  }

  private drawCampfires(dtSec: number): void {
    if (!this.campfireGfx) return;
    this.campfireTimeSec += dtSec;
    const t = this.campfireTimeSec;
    const gfx = this.campfireGfx;
    gfx.clear();

    const firePositions: [number, number][] = [
      [195, 285],
      [765, 285],
    ];

    for (let f = 0; f < firePositions.length; f++) {
      const [fx, fy] = firePositions[f]!;
      const pulse = Math.sin(t * 7.5 + f * 1.9) * 3.5;

      // Warm radial light pools
      gfx.fillStyle(hexToNum(PALETTE.FLAME_ORANGE), 0.09);
      gfx.fillCircle(fx, fy, 88 + pulse);
      gfx.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 0.13);
      gfx.fillCircle(fx, fy, 52 + pulse * 0.6);

      // Stone firepit ring & charred logs
      gfx.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
      gfx.fillCircle(fx, fy + 4, 17);
      gfx.lineStyle(2.5, hexToNum(PALETTE.SLATE_MID), 1);
      gfx.strokeCircle(fx, fy + 4, 17);

      // Flickering flame tongues
      const flameH = 22 + Math.sin(t * 11 + f) * 4;
      const sway = Math.cos(t * 9 + f * 2) * 3;
      gfx.fillStyle(hexToNum(PALETTE.CRIMSON_BRIGHT), 0.9);
      gfx.fillTriangle(fx - 11, fy + 4, fx + 11, fy + 4, fx + sway, fy - flameH);
      gfx.fillStyle(hexToNum(PALETTE.FLAME_ORANGE), 0.95);
      gfx.fillTriangle(fx - 8, fy + 4, fx + 8, fy + 4, fx - sway * 0.7, fy - flameH * 0.82);
      gfx.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 1);
      gfx.fillTriangle(fx - 4.5, fy + 4, fx + 4.5, fy + 4, fx + sway * 0.4, fy - flameH * 0.55);
    }

    // Update & render floating embers
    for (let i = 0; i < this.embers.length; i++) {
      const e = this.embers[i]!;
      e.life += dtSec;
      if (e.life >= e.maxLife) {
        e.life = 0;
        e.x = e.originX + Math.sin(t * 5 + i) * 8;
        e.y = e.originY;
      }
      e.x += (e.vx + Math.sin(t * 4 + i) * 6) * dtSec;
      e.y += e.vy * dtSec;
      const progress = e.life / e.maxLife;
      const alpha = Math.max(0, (1 - progress) * e.alpha);
      gfx.fillStyle(
        hexToNum(i % 2 === 0 ? PALETTE.SOLAR_GOLD : PALETTE.FLAME_ORANGE),
        alpha,
      );
      gfx.fillCircle(e.x, e.y, e.size * (1 - progress * 0.4));
    }
  }

  private refreshLocalizedText(): void {
    const debug = initGlobalDebugState();
    debug.language = graphicsSettings.getState().language;

    this.titleText?.setText(i18n.t('ui.menu.title'));
    this.subtitleText?.setText(i18n.t('ui.menu.subtitle'));
    this.debugHintText?.setText(i18n.t('ui.menu.footerHint'));
    this.refreshCoopBarFn?.();

    this.buttonLabels.get('playSolo')?.setText(i18n.t('ui.menu.playSolo'));
    this.buttonLabels.get('hostCoop')?.setText(i18n.t('ui.menu.hostCoop'));
    this.buttonLabels.get('joinCoop')?.setText(i18n.t('ui.menu.joinCoop'));
    this.buttonLabels.get('artGallery')?.setText(i18n.t('ui.menu.artGallery'));
    this.buttonLabels.get('toggleAnim')?.setText(i18n.t('ui.menu.toggleAnim'));
    this.buttonLabels.get('settings')?.setText(i18n.t('ui.menu.settings'));
    this.buttonLabels.get('controls')?.setText(i18n.t('ui.menu.controls'));
    this.buttonLabels.get('credits')?.setText(i18n.t('ui.menu.credits'));
    this.buttonLabels.get('language')?.setText(i18n.t('ui.menu.languageBtn'));

    for (const hr of this.heroRigs) {
      hr.label.setText(i18n.t(`characters.${hr.charId}.name`));
    }
  }

  private saveProfileName(): void {
    try {
      window.localStorage?.setItem('ashen_pact_name', this.displayName);
    } catch {
      // Ignore storage restrictions
    }
  }

  private resolveServerWsUrl(): string {
    const trimmed = this.serverHostPort.trim();
    if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
      return trimmed;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostPort = trimmed.includes(':') ? trimmed : `${trimmed}:2567`;
    return `${protocol}//${hostPort}`;
  }

  private createMenuButton(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fillHex: string,
    onClick: () => void,
  ): void {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    const drawButton = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hexToNum(hover ? PALETTE.SOLAR_GOLD : fillHex), 1);
      bg.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 9);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 9);
    };
    drawButton(false);

    const txt = this.add
      .text(0, 0, label, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: h <= 34 ? '12.5px' : '14px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: TextureBaker.getBakeScale(),
      })
      .setOrigin(0.5);
    this.textObjects.push(txt);
    this.buttonLabels.set(id, txt);

    const hitArea = this.add
      .rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      if (this.modalManager?.isOpen()) return;
      drawButton(true);
      zzfx.play('ui_hover');
    });
    hitArea.on('pointerout', () => drawButton(false));
    hitArea.on('pointerdown', onClick);

    container.add([bg, txt, hitArea]);
  }

  private applyCameraViewport(): void {
    const cam = this.cameras?.main;
    if (!cam) return;
    const zoom = Math.min(
      this.scale.width / WORLD_VIEW_WIDTH,
      this.scale.height / WORLD_VIEW_HEIGHT,
    );
    const prevScale = TextureBaker.getBakeScale();
    const newScale = TextureBaker.bakeAll(this, zoom, false);
    if (newScale !== prevScale) {
      for (const hr of this.heroRigs) {
        hr.rig.refreshBakedTextures();
      }
      this.goblinPreview?.refreshBakedTextures();
      const invBake = 1 / newScale;
      for (const item of this.floorTileSprites) {
        item.sprite.setTexture(TextureBaker.getBiomeTileTextureKey(1, item.variant));
        item.sprite.setScale(invBake);
      }
      for (const txt of this.textObjects) {
        txt.setResolution(newScale);
      }
      this.modalManager?.refreshResolution(newScale);
      this.debugOverlay?.refreshResolution(newScale);
    }
    cam.setZoom(zoom);
    cam.centerOn(WORLD_VIEW_WIDTH / 2, WORLD_VIEW_HEIGHT / 2);
  }

  public override update(_time: number, deltaMs: number): void {
    const stepRes = this.simLoop.step(deltaMs, () => {});
    const dtSec = Math.min(deltaMs / 1000, 0.05);
    for (const hr of this.heroRigs) {
      hr.rig.update(dtSec);
    }
    this.goblinPreview?.update(dtSec);
    this.drawCampfires(dtSec);

    musicManager.update('menu_hub', false, dtSec);
    const mState = musicManager.getState();
    const debug = initGlobalDebugState();
    debug.musicTheme = mState.theme;
    debug.musicCombatMix = mState.combatMix;

    this.debugOverlay?.update({
      entityCount: this.heroRigs.length + 1,
      bulletCount: 0,
      tick: stepRes.tick,
    });
  }
}
