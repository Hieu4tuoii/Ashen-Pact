import {
  type CharacterId,
  FixedTimestepLoop,
  i18n,
  VIETNAMESE_VERIFICATION_STRING,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import Phaser from 'phaser';
import { CutoutRig } from '../art/cutout-rig.js';
import { ENV_PALETTE, hexToNum, PALETTE } from '../art/palette.js';
import { GOBLIN_SHOOTER_RIG_DEF, RIG_DEFS_BY_ID } from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import { musicManager } from '../audio/music-synth.js';
import { zzfx } from '../audio/zzfx.js';
import { isDebugUiEnabled, onDebugFlagsChanged } from '../core/debug-flag.js';
import {
  getClientFreezeRandom,
  getVisualQueryConfig,
  resetClientFreezeRandom,
} from '../core/visual-query.js';
import { drawStyledPanel } from '../ui/components/hud-primitives.js';
import { DebugOverlay, initGlobalDebugState } from '../ui/debug-overlay.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import {
  applyMenuInputEdit,
  type CampfireEmber,
  createCampfireEmbers,
  drawMenuCampfires,
  MENU_INPUT_BOUNDS,
  MENU_IP_MAX_LEN,
  MENU_NAME_MAX_LEN,
  type MenuButtonTier,
  MenuDomInputOverlay,
  type MenuInputFieldId,
} from '../ui/html-input-overlay.js';
import { ModalOverlayManager } from '../ui/settings-modal.js';
import { UI_THEME } from '../ui/theme.js';

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

export class MenuScene extends Phaser.Scene {
  private simLoop = new FixedTimestepLoop(60);
  private heroRigs: {
    charId: CharacterId;
    rig: CutoutRig;
    label: Phaser.GameObjects.Text;
  }[] = [];
  private goblinPreview?: CutoutRig;
  private campfireGfx?: Phaser.GameObjects.Graphics;
  private campfireTimeSec = 0;
  private embers: CampfireEmber[] = [];
  private floorTileSprites: {
    sprite: Phaser.GameObjects.Sprite;
    variant: number;
  }[] = [];
  private textObjects: Phaser.GameObjects.Text[] = [];
  private debugOverlay?: DebugOverlay;
  private modalManager?: ModalOverlayManager;
  private domInputs?: MenuDomInputOverlay;

  private titleText?: Phaser.GameObjects.Text;
  private subtitleText?: Phaser.GameObjects.Text;
  private rosterStripText?: Phaser.GameObjects.Text;
  private debugHintText?: Phaser.GameObjects.Text;
  private buttonLabels = new Map<string, Phaser.GameObjects.Text>();
  private buttonEntries = new Map<
    string,
    { container: Phaser.GameObjects.Container; hitArea: Phaser.GameObjects.Rectangle }
  >();
  private debugUiObjects: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [];
  private unsubDebugFlags?: () => void;
  private refreshCoopBarFn?: () => void;

  private displayName: string = PRESET_NAMES_VI[0]!;
  private presetNameIndex = 0;
  private serverHostPort = '';
  private activeInputField: MenuInputFieldId | null = null;
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
      this.presetNameIndex = getVisualQueryConfig().freeze
        ? 0
        : Math.floor(getClientFreezeRandom()() * PRESET_NAMES_VI.length);
      this.displayName = PRESET_NAMES_VI[this.presetNameIndex] ?? 'Hiệp Sĩ Tro';
    }
    const host =
      typeof window !== 'undefined' ? window.location.hostname || '127.0.0.1' : '127.0.0.1';
    const locPort = typeof window !== 'undefined' ? window.location.port : '';
    const defaultPort = locPort && locPort !== '5173' && locPort !== '4173' ? locPort : '2567';
    this.serverHostPort = `${host}:${defaultPort}`;
  }

  public create(): void {
    if (this.scene.isActive('HudScene')) {
      this.scene.stop('HudScene');
    }
    resetClientFreezeRandom(getVisualQueryConfig().seed);
    const debug = initGlobalDebugState();
    debug.scene = 'MenuScene';
    debug.language = graphicsSettings.getState().language;
    debug.pauseModalOpen = false;
    debug.settingsModalOpen = false;
    debug.controlsModalOpen = false;
    debug.creditsModalOpen = false;
    debug.menuDisplayName = this.displayName;
    debug.menuServerHostPort = this.serverHostPort;
    debug.menuActiveInput = null;

    this.floorTileSprites = [];
    this.textObjects = [];
    this.heroRigs = [];
    this.buttonLabels.clear();
    this.buttonEntries.clear();
    this.debugUiObjects = [];
    this.activeInputField = null;
    this.campfireTimeSec = 0;

    this.applyCameraViewport();
    this.scale.on('resize', this.applyCameraViewport, this);

    this.input.on('pointerdown', () => {
      zzfx.unlockOnUserGesture();
    });

    const textRes = TextureBaker.getBakeScale();
    const hubEnv = ENV_PALETTE[0];

    // Warm Hub night stone backdrop (extended for ultrawide / non-16:9 aspect ratios)
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(hubEnv.shadow), 1);
    bg.fillRect(-480, -270, WORLD_VIEW_WIDTH + 960, WORLD_VIEW_HEIGHT + 540);
    bg.fillStyle(hexToNum(hubEnv.wallFront), 0.92);
    bg.fillRoundedRect(26, 114, 908, 376, 12);
    bg.lineStyle(2.5, hexToNum(hubEnv.wallTop), 0.95);
    bg.strokeRoundedRect(26, 114, 908, 376, 12);
    bg.lineStyle(1.2, hexToNum(PALETTE.SOLAR_GOLD), 0.35);
    bg.strokeRoundedRect(30, 118, 900, 368, 10);

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
        tile.setAlpha(0.84);
        this.floorTileSprites.push({ sprite: tile, variant });
      }
    }

    // Dynamic Campfire Graphics layer (warm glow + flickering flames + rising embers)
    this.campfireGfx = this.add.graphics();
    this.initCampfireEmbers();
    this.drawCampfires(0);

    // Header Card (UI_THEME styled panel with gold top accent & version badge)
    const card = this.add.graphics();
    drawStyledPanel(card, 120, 18, 720, 96, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.96,
      borderColor: hexToNum(PALETTE.SOLAR_GOLD),
      borderWidth: 2.2,
      radius: UI_THEME.panelRadius.lg,
      accentColor: hexToNum(PALETTE.SOLAR_GOLD),
      accentSide: 'top',
    });
    // Subtle inner divider rule between title and subtitle
    card.lineStyle(1, hexToNum(PALETTE.SOLAR_GOLD), 0.25);
    card.lineBetween(200, 72, 760, 72);
    // Version badge pill at top-right of Header Card
    drawStyledPanel(card, 738, 26, 92, 20, {
      fillColor: UI_THEME.panelBgElevated,
      fillAlpha: 0.95,
      borderColor: hexToNum(PALETTE.CYAN_FROST),
      borderWidth: 1.2,
      radius: 5,
    });

    const addCenteredText = (
      tx: number,
      ty: number,
      str: string,
      size: string,
      weight: string,
      col: string,
      strokeW: number,
      mono = false,
    ) => {
      const t = this.add
        .text(tx, ty, str, {
          fontFamily: mono ? '"JetBrains Mono", monospace' : '"Be Vietnam Pro", sans-serif',
          fontSize: size,
          fontStyle: weight,
          color: col,
          stroke: PALETTE.INK_DARK,
          strokeThickness: strokeW,
          resolution: textRes,
        })
        .setOrigin(0.5);
      this.textObjects.push(t);
      return t;
    };

    addCenteredText(784, 36, 'v2.0.0 · LAN', '10px', '700', PALETTE.CYAN_FROST, 2, true);
    this.titleText = addCenteredText(
      480,
      46,
      i18n.t('ui.menu.title'),
      '26px',
      '800',
      PALETTE.SOLAR_GOLD,
      5,
    );
    this.subtitleText = addCenteredText(
      480,
      90,
      i18n.t('ui.menu.subtitle'),
      '13px',
      '600',
      PALETTE.SILVER_BRIGHT,
      3,
    );

    if (this.disconnectReason) {
      const banner = this.add.graphics();
      drawStyledPanel(banner, 210, 122, 540, 26, {
        fillColor: hexToNum(PALETTE.RUBY_DARK),
        fillAlpha: 0.96,
        borderColor: hexToNum(PALETTE.RUBY_CORE),
        borderWidth: 1.8,
        radius: 6,
      });
      addCenteredText(480, 135, `⚠ ${this.disconnectReason}`, '12px', '700', PALETTE.BONE_WHITE, 2);
    }

    // 5 Playable Hero Rigs gathered around the Hub campfires in a staggered semicircle
    const heroPlacements: [CharacterId, number, number, 1 | 2 | 3 | 4, number, number][] = [
      ['vanguard', 82, 196, 1, 0.35, 0.0],
      ['druid', 162, 266, 4, 0.1, 0.8],
      ['ranger', 86, 334, 2, -0.25, 0.4],
      ['elementalist', 878, 196, 3, Math.PI - 0.35, 0.2],
      ['engineer', 798, 266, 1, Math.PI - 0.05, 0.6],
    ];

    for (const [charId, hx, hy, slot, aim, phase] of heroPlacements) {
      const rig = new CutoutRig(this, hx, hy, RIG_DEFS_BY_ID[charId]!, {
        playerSlot: slot,
        displayScale: 1.65,
        initialPhaseOffset: phase,
      });
      rig.setAimAngle(aim);

      const label = this.add
        .text(hx, hy + 24, i18n.t(`characters.${charId}.name`), {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10.5px',
          fontStyle: '800',
          color: PALETTE.SOLAR_GOLD,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.8,
          resolution: textRes,
        })
        .setOrigin(0.5)
        .setDepth(25);
      this.textObjects.push(label);
      this.heroRigs.push({ charId, rig, label });
    }

    this.goblinPreview = new CutoutRig(this, 874, 334, GOBLIN_SHOOTER_RIG_DEF, {
      displayScale: 1.6,
      initialPhaseOffset: 0.7,
    });
    this.goblinPreview.setAimAngle(Math.PI + 0.25);

    // Distinct Profile Name & LAN IP Input Cards at y=176
    const coopBarBg = this.add.graphics();
    const nameBounds = MENU_INPUT_BOUNDS.name;
    const ipBounds = MENU_INPUT_BOUNDS.ip;
    const makeBarText = (
      tx: number,
      ty: number,
      initStr: string,
      size: string,
      weight: string,
      col: string,
      originX = 0,
      mono = false,
    ) =>
      this.add
        .text(tx, ty, initStr, {
          fontFamily: mono ? '"JetBrains Mono", monospace' : '"Be Vietnam Pro", sans-serif',
          fontSize: size,
          fontStyle: weight,
          color: col,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.3,
          resolution: textRes,
        })
        .setOrigin(originX, 0.5);

    const nameLabelText = makeBarText(
      nameBounds.cx - nameBounds.w / 2 + 10,
      nameBounds.cy,
      '',
      '11px',
      '800',
      PALETTE.ASH_GRAY,
    );
    const nameValueText = makeBarText(
      nameBounds.cx - nameBounds.w / 2 + 54,
      nameBounds.cy,
      '',
      '12px',
      '700',
      PALETTE.BONE_WHITE,
    );
    const nameCycleText = makeBarText(
      nameBounds.cx + nameBounds.w / 2 - 14,
      nameBounds.cy,
      '↻',
      '13px',
      '800',
      PALETTE.SOLAR_GOLD,
      0.5,
    );
    const ipLabelText = makeBarText(
      ipBounds.cx - ipBounds.w / 2 + 10,
      ipBounds.cy,
      '',
      '11px',
      '800',
      PALETTE.CYAN_FROST,
    );
    const ipValueText = makeBarText(
      ipBounds.cx - ipBounds.w / 2 + 64,
      ipBounds.cy,
      '',
      '12px',
      '700',
      PALETTE.BONE_WHITE,
      0,
      true,
    );

    this.textObjects.push(nameLabelText, nameValueText, nameCycleText, ipLabelText, ipValueText);

    const refreshCoopBar = () => {
      coopBarBg.clear();
      const nameFocused = this.activeInputField === 'name';
      const ipFocused = this.activeInputField === 'ip';

      // Name Box
      const nx = nameBounds.cx - nameBounds.w / 2;
      const ny = nameBounds.cy - nameBounds.h / 2;
      drawStyledPanel(coopBarBg, nx, ny, nameBounds.w, nameBounds.h, {
        fillColor: UI_THEME.panelBgDark,
        fillAlpha: 0.95,
        borderColor: nameFocused ? hexToNum(PALETTE.SOLAR_GOLD) : UI_THEME.panelBorder,
        borderWidth: nameFocused ? 2.2 : 1.5,
        radius: 6,
      });
      // Inner editable field well for Name
      coopBarBg.fillStyle(0x121620, 0.92);
      coopBarBg.fillRoundedRect(nx + 48, ny + 4, nameBounds.w - 78, nameBounds.h - 8, 4);
      // Cycle preset button pill on right of Name box
      drawStyledPanel(coopBarBg, nx + nameBounds.w - 26, ny + 4, 22, nameBounds.h - 8, {
        fillColor: UI_THEME.panelBgElevated,
        fillAlpha: 0.95,
        borderColor: hexToNum(PALETTE.SOLAR_GOLD),
        borderWidth: 1.2,
        radius: 4,
      });

      // IP Box
      const ix = ipBounds.cx - ipBounds.w / 2;
      const iy = ipBounds.cy - ipBounds.h / 2;
      drawStyledPanel(coopBarBg, ix, iy, ipBounds.w, ipBounds.h, {
        fillColor: UI_THEME.panelBgDark,
        fillAlpha: 0.95,
        borderColor: ipFocused ? hexToNum(PALETTE.SOLAR_GOLD) : UI_THEME.panelBorder,
        borderWidth: ipFocused ? 2.2 : 1.5,
        radius: 6,
      });
      // Inner editable field well for IP
      coopBarBg.fillStyle(0x121620, 0.92);
      coopBarBg.fillRoundedRect(ix + 58, iy + 4, ipBounds.w - 64, ipBounds.h - 8, 4);

      nameLabelText.setText(`${i18n.t('ui.menu.nameLabel')}:`);
      nameValueText.setText(`${this.displayName}${nameFocused ? '▌' : ''}`);
      nameValueText.setColor(nameFocused ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE);

      ipLabelText.setText(`${i18n.t('ui.menu.ipLabel')}:`);
      ipValueText.setText(`${this.serverHostPort}${ipFocused ? '▌' : ''}`);
      ipValueText.setColor(ipFocused ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE);

      this.domInputs?.syncValues(this.displayName, this.serverHostPort);
      const gDebug = initGlobalDebugState();
      gDebug.menuDisplayName = this.displayName;
      gDebug.menuServerHostPort = this.serverHostPort;
      gDebug.menuActiveInput = this.activeInputField;
    };
    this.refreshCoopBarFn = refreshCoopBar;
    refreshCoopBar();

    // Mount real HTML <input> overlays for native selection, paste (Ctrl+V), Backspace/Delete
    this.domInputs = new MenuDomInputOverlay(this, this.displayName, this.serverHostPort, {
      onFocusChange: (field) => {
        if (this.modalManager?.isOpen()) return;
        if (this.activeInputField !== field) {
          this.activeInputField = field;
          if (field !== null) {
            zzfx.play('ui_click');
          }
          refreshCoopBar();
        }
      },
      onValueChange: (field, val) => {
        if (field === 'name') {
          this.displayName = val;
        } else {
          this.serverHostPort = val;
        }
        refreshCoopBar();
      },
    });

    // Interactive Phaser fallback zones for Name, Cycle Preset (↻), & IP
    const addBarZone = (zx: number, zy: number, zw: number, zh: number, fn: () => void) => {
      this.add
        .rectangle(zx, zy, zw, zh, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (this.modalManager?.isOpen()) return;
          zzfx.play('ui_click');
          fn();
          refreshCoopBar();
        });
    };
    addBarZone(nameBounds.cx - 14, nameBounds.cy, nameBounds.w - 28, nameBounds.h, () => {
      this.activeInputField = 'name';
      this.domInputs?.focusField('name');
    });
    addBarZone(nameBounds.cx + nameBounds.w / 2 - 14, nameBounds.cy, 26, nameBounds.h, () => {
      this.presetNameIndex = (this.presetNameIndex + 1) % PRESET_NAMES_VI.length;
      this.displayName = PRESET_NAMES_VI[this.presetNameIndex] ?? 'Hiệp Sĩ Tro';
    });
    addBarZone(ipBounds.cx, ipBounds.cy, ipBounds.w, ipBounds.h, () => {
      this.activeInputField = 'ip';
      this.domInputs?.focusField('ip');
    });

    // Keyboard handler for canvas fallback typing or opening Menu Modals
    const onKeyDown = (event: KeyboardEvent) => {
      if (this.modalManager?.isOpen()) {
        if (event.key === 'Escape') {
          zzfx.play('ui_click');
          this.modalManager.close();
          this.domInputs?.setModalBlocked(false);
        }
        return;
      }

      if (this.activeInputField) {
        if (event.key === 'Escape' || event.key === 'Enter') {
          this.activeInputField = null;
          this.domInputs?.focusField(null);
          refreshCoopBar();
          return;
        }
        const curVal = this.activeInputField === 'name' ? this.displayName : this.serverHostPort;
        const maxLen = this.activeInputField === 'name' ? MENU_NAME_MAX_LEN : MENU_IP_MAX_LEN;
        const action =
          event.key === 'Backspace'
            ? ({ kind: 'backspace' } as const)
            : event.key === 'Delete'
              ? ({ kind: 'delete' } as const)
              : event.key.length === 1 && !event.ctrlKey && !event.metaKey
                ? ({ kind: 'insert', text: event.key } as const)
                : null;
        if (action) {
          const selStart = action.kind === 'delete' ? 0 : curVal.length;
          const next = applyMenuInputEdit(
            curVal,
            selStart,
            curVal.length,
            action,
            this.activeInputField,
            maxLen,
          );
          if (this.activeInputField === 'name') this.displayName = next.value;
          else this.serverHostPort = next.value;
          refreshCoopBar();
        }
        return;
      }

      const upper = event.key.toUpperCase();
      const modalKeyMap: Record<string, 'settings' | 'controls' | 'credits'> = {
        O: 'settings',
        K: 'controls',
        C: 'credits',
      };
      if (modalKeyMap[upper]) {
        zzfx.play('ui_click');
        this.domInputs?.setModalBlocked(true);
        this.modalManager?.open(modalKeyMap[upper]!);
      } else if (upper === 'L') {
        zzfx.play('ui_click');
        graphicsSettings.toggleLanguage();
        this.refreshLocalizedText();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    this.unsubDebugFlags = onDebugFlagsChanged(() => {
      this.syncDebugUiVisibility();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.applyCameraViewport, this);
      window.removeEventListener('keydown', onKeyDown);
      this.unsubDebugFlags?.();
      this.unsubDebugFlags = undefined;
      this.domInputs?.destroy();
      this.domInputs = undefined;
    });

    // Auto-detect LAN IP from server if available
    fetch('/api/host-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((info: { primaryLanIp?: string; port?: number } | null) => {
        if (info?.primaryLanIp && this.scene.isActive('MenuScene') && !this.activeInputField) {
          this.serverHostPort = `${info.primaryLanIp}:${info.port ?? 2567}`;
          refreshCoopBar();
        }
      })
      .catch(() => {
        // Ignore when server is offline
      });

    // 1. Primary Large CTA Button: Play Solo kept at exact (480, 225) for Phase 0-7 E2E compatibility
    this.createMenuButton(
      'playSolo',
      480,
      225,
      348,
      42,
      `⚔  ${i18n.t('ui.menu.playSolo')}`,
      PALETTE.RUBY_CORE,
      () => {
        if (this.modalManager?.isOpen()) return;
        zzfx.play('ui_click');
        this.scene.start('GameScene', { coopMode: 'solo' });
      },
      'primary',
    );

    // 2. Secondary Co-op Action Row: Host LAN & Join LAN side-by-side at y=272
    this.createMenuButton(
      'hostCoop',
      390,
      272,
      170,
      34,
      this.formatCoopBtnLabel('host'),
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
      'secondary',
    );

    this.createMenuButton(
      'joinCoop',
      570,
      272,
      170,
      34,
      this.formatCoopBtnLabel('join'),
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
      'secondary',
    );

    // 3. Campfire Hero Roster Preview Strip at y=313
    const rosterGfx = this.add.graphics();
    drawStyledPanel(rosterGfx, 480 - 174, 313 - 13, 348, 26, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.9,
      borderColor: UI_THEME.panelBorder,
      borderWidth: 1.2,
      radius: 5,
    });
    this.rosterStripText = addCenteredText(
      480,
      313,
      this.formatRosterStripLabel(),
      '10.5px',
      '700',
      PALETTE.SILVER_BRIGHT,
      2.2,
    );

    // 4. Debug Row (?debug=1) at exact (392, 353) and (568, 353)
    this.createMenuButton(
      'artGallery',
      392,
      353,
      166,
      32,
      i18n.t('ui.menu.artGallery'),
      PALETTE.STEEL_DARK,
      () => {
        if (this.modalManager?.isOpen() || !isDebugUiEnabled()) return;
        zzfx.play('ui_click');
        this.scene.start('ArtGalleryScene');
      },
      'debug',
    );

    this.createMenuButton(
      'toggleAnim',
      568,
      353,
      166,
      32,
      i18n.t('ui.menu.toggleAnim'),
      PALETTE.GOBLIN_GREEN,
      () => {
        if (this.modalManager?.isOpen() || !isDebugUiEnabled()) return;
        zzfx.play('ui_click');
        const nextState = this.heroRigs[0]?.rig.getAnimState() === 'idle' ? 'run' : 'idle';
        for (const hr of this.heroRigs) hr.rig.setAnimState(nextState);
        this.goblinPreview?.setAnimState(nextState);
        debug.animState = nextState;
      },
      'debug',
    );

    // 5. Compact Utility Action Bar at y=396: Settings [O], Controls [K], Credits [C], Language [L]
    const utilityButtons: [string, number, string, string, () => void][] = [
      [
        'settings',
        252,
        `${i18n.t('ui.menu.settings')} [O]`,
        PALETTE.SLATE_MID,
        () => {
          this.domInputs?.setModalBlocked(true);
          this.modalManager?.open('settings');
        },
      ],
      [
        'controls',
        404,
        `${i18n.t('ui.menu.controls')} [K]`,
        PALETTE.SLATE_MID,
        () => {
          this.domInputs?.setModalBlocked(true);
          this.modalManager?.open('controls');
        },
      ],
      [
        'credits',
        556,
        `${i18n.t('ui.menu.credits')} [C]`,
        PALETTE.SLATE_MID,
        () => {
          this.domInputs?.setModalBlocked(true);
          this.modalManager?.open('credits');
        },
      ],
      [
        'language',
        708,
        `${i18n.t('ui.menu.languageBtn')} [L]`,
        PALETTE.FOREST_SHADE,
        () => {
          graphicsSettings.toggleLanguage();
          this.refreshLocalizedText();
        },
      ],
    ];
    for (const [id, ux, uLabel, uHex, uAction] of utilityButtons) {
      this.createMenuButton(
        id,
        ux,
        396,
        144,
        30,
        uLabel,
        uHex,
        () => {
          if (this.modalManager?.isOpen()) return;
          zzfx.play('ui_click');
          uAction();
        },
        'utility',
      );
    }

    // Vietnamese Diacritics Verification Footer (?debug=1)
    const footer = this.add.graphics();
    drawStyledPanel(footer, 110, 448, 740, 64, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.95,
      borderColor: UI_THEME.inkDark,
      borderWidth: 2,
      radius: 10,
    });
    const footerSampleText = addCenteredText(
      480,
      468,
      VIETNAMESE_VERIFICATION_STRING,
      '16px',
      '700',
      PALETTE.BONE_WHITE,
      3,
    );
    this.debugHintText = addCenteredText(
      480,
      494,
      i18n.t('ui.menu.footerHint'),
      '12px',
      '600',
      PALETTE.CYAN_FROST,
      0,
    );
    this.debugUiObjects.push(footer, footerSampleText, this.debugHintText);

    this.modalManager = new ModalOverlayManager(this, () => {
      this.refreshLocalizedText();
      if (!this.modalManager?.isOpen()) {
        this.domInputs?.setModalBlocked(false);
      }
    });

    this.debugOverlay = new DebugOverlay(this, false);
    this.syncDebugUiVisibility();
  }

  private formatCoopBtnLabel(mode: 'host' | 'join'): string {
    const isEn = i18n.getLocale() === 'en';
    return mode === 'host'
      ? isEn
        ? '📡 Host LAN Room'
        : '📡 Tạo Phòng LAN'
      : isEn
        ? '🔗 Join LAN IP'
        : '🔗 Vào Phòng LAN';
  }

  private formatRosterStripLabel(): string {
    return i18n.getLocale() === 'en'
      ? '🔥 5 Heroes Ready: Vanguard · Ranger · Elementalist · Druid · Engineer'
      : '🔥 5 Anh Hùng Hội Tụ: Thiết Vệ · Liệp Ưng · Lam Hỏa · Mộc Linh · Bánh Răng';
  }

  private syncDebugUiVisibility(): void {
    const showDebug = isDebugUiEnabled();
    for (const id of ['artGallery', 'toggleAnim']) {
      const entry = this.buttonEntries.get(id);
      if (entry) {
        entry.container.setVisible(showDebug);
        if (showDebug) entry.hitArea.setInteractive({ useHandCursor: true });
        else entry.hitArea.disableInteractive();
      }
    }
    for (const obj of this.debugUiObjects) obj.setVisible(showDebug);
  }

  private initCampfireEmbers(): void {
    this.embers = createCampfireEmbers();
  }

  private drawCampfires(dtSec: number): void {
    if (!this.campfireGfx) return;
    const frozen = getVisualQueryConfig().freeze;
    this.campfireTimeSec = frozen ? 1.0 : this.campfireTimeSec + dtSec;
    drawMenuCampfires(this.campfireGfx, this.embers, this.campfireTimeSec, frozen ? 0 : dtSec);
  }

  private refreshLocalizedText(): void {
    initGlobalDebugState().language = graphicsSettings.getState().language;
    this.titleText?.setText(i18n.t('ui.menu.title'));
    this.subtitleText?.setText(i18n.t('ui.menu.subtitle'));
    this.rosterStripText?.setText(this.formatRosterStripLabel());
    this.debugHintText?.setText(i18n.t('ui.menu.footerHint'));
    this.refreshCoopBarFn?.();

    const labels: [string, string][] = [
      ['playSolo', `⚔  ${i18n.t('ui.menu.playSolo')}`],
      ['hostCoop', this.formatCoopBtnLabel('host')],
      ['joinCoop', this.formatCoopBtnLabel('join')],
      ['artGallery', i18n.t('ui.menu.artGallery')],
      ['toggleAnim', i18n.t('ui.menu.toggleAnim')],
      ['settings', `${i18n.t('ui.menu.settings')} [O]`],
      ['controls', `${i18n.t('ui.menu.controls')} [K]`],
      ['credits', `${i18n.t('ui.menu.credits')} [C]`],
      ['language', `${i18n.t('ui.menu.languageBtn')} [L]`],
    ];
    for (const [id, text] of labels) this.buttonLabels.get(id)?.setText(text);
    for (const hr of this.heroRigs) hr.label.setText(i18n.t(`characters.${hr.charId}.name`));
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
    if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${trimmed.includes(':') ? trimmed : `${trimmed}:2567`}`;
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
    tier: MenuButtonTier = 'secondary',
  ): void {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    const drawButton = (hover: boolean) => {
      bg.clear();
      const isPri = tier === 'primary';
      const isSec = tier === 'secondary';
      drawStyledPanel(bg, -w / 2, -h / 2, w, h, {
        fillColor: isPri
          ? hexToNum(hover ? PALETTE.FLAME_ORANGE : fillHex)
          : isSec
            ? hover
              ? UI_THEME.panelBgElevated
              : UI_THEME.panelBg
            : hover
              ? UI_THEME.panelBgElevated
              : hexToNum(fillHex),
        fillAlpha: isPri ? 0.98 : isSec ? 0.96 : 0.94,
        borderColor: isPri
          ? hexToNum(PALETTE.SOLAR_GOLD)
          : isSec
            ? hexToNum(hover ? PALETTE.SOLAR_GOLD : fillHex)
            : hover
              ? hexToNum(PALETTE.SOLAR_GOLD)
              : UI_THEME.panelBorder,
        borderWidth: isPri ? (hover ? 2.6 : 2.2) : isSec ? (hover ? 2.2 : 1.8) : 1.5,
        radius: isPri ? 8 : isSec ? 7 : 6,
        accentColor: isPri ? hexToNum(PALETTE.SOLAR_GOLD) : isSec ? hexToNum(fillHex) : undefined,
        accentSide: isPri ? 'top' : isSec ? 'left' : undefined,
      });
    };
    drawButton(false);

    const fontSize = tier === 'primary' ? '15px' : tier === 'secondary' ? '12.5px' : '11.5px';
    const txt = this.add
      .text(0, 0, label, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize,
        fontStyle: tier === 'primary' ? '800' : '700',
        color: tier === 'primary' ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: tier === 'primary' ? 3.5 : 2.8,
        resolution: TextureBaker.getBakeScale(),
      })
      .setOrigin(0.5);
    this.textObjects.push(txt);
    this.buttonLabels.set(id, txt);

    const hitArea = this.add
      .rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        if (this.modalManager?.isOpen()) return;
        drawButton(true);
        zzfx.play('ui_hover');
      })
      .on('pointerout', () => drawButton(false))
      .on('pointerdown', onClick);

    container.add([bg, txt, hitArea]);
    this.buttonEntries.set(id, { container, hitArea });
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
      for (const hr of this.heroRigs) hr.rig.refreshBakedTextures();
      this.goblinPreview?.refreshBakedTextures();
      const invBake = 1 / newScale;
      for (const item of this.floorTileSprites) {
        item.sprite.setTexture(TextureBaker.getBiomeTileTextureKey(1, item.variant));
        item.sprite.setScale(invBake);
      }
      for (const txt of this.textObjects) txt.setResolution(newScale);
      this.modalManager?.refreshResolution(newScale);
      this.debugOverlay?.refreshResolution(newScale);
    }
    cam.setZoom(zoom);
    cam.centerOn(WORLD_VIEW_WIDTH / 2, WORLD_VIEW_HEIGHT / 2);
    this.domInputs?.reposition();
  }

  public override update(_time: number, deltaMs: number): void {
    const effectiveDeltaMs = getVisualQueryConfig().freeze ? 16.6667 : deltaMs;
    const stepRes = this.simLoop.step(effectiveDeltaMs, () => {});
    const dtSec = Math.min(effectiveDeltaMs / 1000, 0.05);
    for (const hr of this.heroRigs) hr.rig.update(dtSec);
    this.goblinPreview?.update(dtSec);
    this.drawCampfires(dtSec);

    musicManager.update('menu_hub', false, dtSec);
    const mState = musicManager.getState();
    const debug = initGlobalDebugState();
    debug.musicTheme = mState.theme;
    debug.musicCombatMix = mState.combatMix;
    if (this.modalManager && !this.modalManager.isOpen()) {
      this.domInputs?.setModalBlocked(false);
    }
    this.debugOverlay?.update({
      entityCount: this.heroRigs.length + 1,
      bulletCount: 0,
      tick: stepRes.tick,
    });
  }
}
