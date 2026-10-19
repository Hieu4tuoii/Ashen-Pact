import {
  type BuffId,
  CHARACTERS,
  type CharacterId,
  clamp,
  type DungeonRoomNode,
  ELEMENTAL_REACTIONS,
  type ElementType,
  ENEMIES,
  ENEMY_SPAWN_WARMUP_SEC,
  FLOOR_BUFFS,
  generateQrMatrix,
  INPUT_BUTTON,
  i18n,
  LocalTransport,
  NetworkTransport,
  PHASE1_SAMPLE_WEAPONS,
  PLAYER_SLOT_COLORS,
  type PropKind,
  QUICK_EMOTES_VI,
  type QuickEmoteId,
  type SimEnemyState,
  type SimEvent,
  type SurfaceKind,
  TILE_SIZE,
  type TileKind,
  VIETNAMESE_VERIFICATION_STRING,
  WEAPON_RARITY_COLORS,
  WEAPONS,
  type WifiProfileId,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { Client as ColyseusClient, type Room as ColyseusRoom } from 'colyseus.js';
import Phaser from 'phaser';
import { CutoutRig } from '../art/cutout-rig.js';
import { dampLerp } from '../art/easing.js';
import { hexToNum, PALETTE } from '../art/palette.js';
import { MERCHANT_RIG_DEF, RIG_DEFS_BY_ID, VANGUARD_RIG_DEF } from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import { musicManager } from '../audio/music-synth.js';
import { resolveWeaponShootSfx, zzfx } from '../audio/zzfx.js';
import { CombatFxManager } from '../fx/combat-fx.js';
import { LightingPipeline } from '../fx/lighting-pipeline.js';
import { DebugOverlay, initGlobalDebugState } from '../ui/debug-overlay.js';
import { type GraphicsQualityTier, graphicsSettings } from '../ui/graphics-settings.js';
import { ModalOverlayManager } from '../ui/settings-modal.js';

export interface GameSceneInitData {
  coopMode?: 'solo' | 'host' | 'join';
  roomId?: string;
  displayName?: string;
  serverUrl?: string;
}

declare global {
  interface Window {
    __GAME_TRANSPORT__?: LocalTransport | NetworkTransport;
    __GAME_STRESS_TEST__?: (active: boolean) => void;
    __GAME_SET_QUALITY__?: (quality: GraphicsQualityTier) => void;
    __GAME_BOT_AUTOPLAY__?: (active: boolean) => void;
    __GAME_SET_WIFI_PROFILE__?: (profile: WifiProfileId) => void;
    __GAME_TRIGGER_LAG_SPIKE__?: (durationMs?: number) => void;
    __GAME_FORCE_RECONNECT__?: () => Promise<boolean>;
    __GAME_COOP_SEND__?: (type: string, payload?: unknown) => void;
    __PHASER_GAME__?: Phaser.Game;
  }
}

/**
 * CutoutRig uses (0, 0) as the foot/ground-shadow anchor with torso/head parts at offsetY = -12..-29,
 * while WorldSim uses (x, y) as the center of the entity hitbox, projectile origin, and telegraphs.
 * Offsetting the visual rig container by +12u aligns the visual torso center with the simulation hitbox center.
 */
const RIG_FOOT_OFFSET_Y = 12;

interface ArenaTileVisual {
  tx: number;
  ty: number;
  kind: TileKind;
  variant: number;
  autotileMask: number;
  aoMask: number;
  surface: SurfaceKind;
  surfaceMask: number;
}

interface PropVisual {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Sprite;
  kind: PropKind;
  lastHp: number;
  flashTimer: number;
  isFlashed: boolean;
}

export class GameScene extends Phaser.Scene {
  private transport!: LocalTransport | NetworkTransport;
  private networkTransport: NetworkTransport | null = null;
  private coopMode: 'solo' | 'host' | 'join' = 'solo';
  private requestedRoomId: string | undefined;
  private displayName = 'Hiệp Sĩ Tro';
  private serverUrl: string | undefined;
  private reconnectToken: string | null = null;
  private hostInviteUrl: string | null = null;
  private lanIps: string[] = [];
  private primaryLanIp = '127.0.0.1';
  private serverPort = 2567;
  private invitePanelVisible = true;
  private copyToastTimer = 0;

  private fx!: CombatFxManager;
  private lighting!: LightingPipeline;
  private playerRig?: CutoutRig;
  private simPlayerRigs = new Map<number, CutoutRig>();
  private coopPlayerRigs = new Map<
    number,
    {
      rig: CutoutRig;
      nameLabel: Phaser.GameObjects.Text;
      emoteLabel: Phaser.GameObjects.Text;
      emoteBg: Phaser.GameObjects.Graphics;
    }
  >();
  private localNameLabel?: Phaser.GameObjects.Text;
  private localEmoteLabel?: Phaser.GameObjects.Text;
  private localEmoteBg?: Phaser.GameObjects.Graphics;
  private hubStatueRigs = new Map<
    string,
    {
      rig: CutoutRig;
      label: Phaser.GameObjects.Text;
      subLabel: Phaser.GameObjects.Text;
    }
  >();
  private pingVisuals = new Map<number, Phaser.GameObjects.Text>();
  private enemyRigs = new Map<number, CutoutRig>();
  private propVisuals = new Map<number, PropVisual>();
  private projectileSprites = new Map<
    number,
    { sprite: Phaser.GameObjects.Sprite; textureKey: string }
  >();
  private pickupSprites = new Map<
    number,
    { sprite: Phaser.GameObjects.Sprite; textureKey: string }
  >();
  private projectileSpritePool: {
    sprite: Phaser.GameObjects.Sprite;
    textureKey: string;
  }[] = [];
  private pickupSpritePool: {
    sprite: Phaser.GameObjects.Sprite;
    textureKey: string;
  }[] = [];

  // Phase 3 Room Visuals (Doors, Chests, World Items, NPCs, Portal)
  private doorSprites = new Map<
    string,
    { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text }
  >();
  private chestSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private worldItemSprites = new Map<
    number,
    { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text }
  >();
  private npcVisuals = new Map<
    number,
    {
      rig?: CutoutRig;
      sprite?: Phaser.GameObjects.Sprite;
      label: Phaser.GameObjects.Text;
    }
  >();
  private portalSprite?: Phaser.GameObjects.Sprite;
  private portalLabel?: Phaser.GameObjects.Text;

  private readonly activeEnemyIds = new Set<number>();
  private readonly activeSimPlayerIds = new Set<number>();
  private readonly activeCoopPlayerIds = new Set<number>();
  private readonly activePingIds = new Set<number>();
  private readonly activePropIds = new Set<number>();
  private readonly activeProjIds = new Set<number>();
  private readonly activePickupIds = new Set<number>();
  private readonly activeChestIds = new Set<number>();
  private readonly activeWorldItemIds = new Set<number>();
  private readonly activeNpcIds = new Set<number>();
  private readonly activeDoorKeys = new Set<string>();

  private readonly playerPosPreScratch = { x: 0, y: 0 };
  private readonly playerPosScratch = { x: 0, y: 0 };
  private readonly entityPosScratch = { x: 0, y: 0 };
  private readonly simPlayerLightingScratch: {
    pos: { x: number; y: number };
    state: ReturnType<LocalTransport['getSim']>['player'];
  }[] = [];

  private mapTileVisuals: ArenaTileVisual[] = [];
  private arenaGroundTex?: Phaser.Textures.CanvasTexture;
  private arenaGroundSprite?: Phaser.GameObjects.Image;
  private readonly tileCompositeScale = 2;
  private lastMapRevision = -1;
  private dashAfterimageTimer = 0;
  private textObjects: Phaser.GameObjects.Text[] = [];

  // Cached HUD state to avoid redundant per-frame Canvas2D text uploads
  private lastHudLocale = '';
  private lastHudHp = -1;
  private lastHudArmor = -1;
  private lastHudEnergy = -1;
  private lastHudCharacterId = '';
  private lastHudWeaponHash = '';
  private lastHudElement = '';
  private lastHudQuality = '';
  private lastHudStatsText = '';
  private lastMinimapHash = '';
  private lastBossHudHash = '';
  private lastCoopHudHash = '';
  private lastInvitePanelHash = '';
  private lastHubPreviewHash = '';
  private lastWeaponCompareHash = '';
  private lastRunState = 'playing';
  private resultDismissed = false;
  private fullMapOpen = false;
  private pauseModalOpen = false;
  private trailingHpRatio = 1.0;
  private trailingArmorRatio = 1.0;
  private trailingBossHpRatio = 1.0;
  private lowHpHeartbeatTimer = 0;
  private irisTransitionProgress = 0.0;
  private irisTransitionDir: -1 | 0 | 1 = 0;

  private telegraphGraphics!: Phaser.GameObjects.Graphics;
  private hitboxGraphics!: Phaser.GameObjects.Graphics;
  private crosshairSprite!: Phaser.GameObjects.Sprite;

  // Camera-pinned HUD elements
  private hudContainer!: Phaser.GameObjects.Container;
  private hudBarsGraphics!: Phaser.GameObjects.Graphics;
  private abilityHudGraphics!: Phaser.GameObjects.Graphics;
  private skillCdText!: Phaser.GameObjects.Text;
  private dashCdText!: Phaser.GameObjects.Text;
  private skillLabelText?: Phaser.GameObjects.Text;
  private pauseBtnText?: Phaser.GameObjects.Text;
  private menuBtnText?: Phaser.GameObjects.Text;
  private hubGuideTexts: Phaser.GameObjects.Text[] = [];
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private minimapTitleText!: Phaser.GameObjects.Text;
  private bossBarGraphics!: Phaser.GameObjects.Graphics;
  private bossTitleText!: Phaser.GameObjects.Text;
  private coopHudContainer!: Phaser.GameObjects.Container;
  private invitePanelContainer!: Phaser.GameObjects.Container;
  private hubPreviewContainer!: Phaser.GameObjects.Container;
  private weaponCompareContainer!: Phaser.GameObjects.Container;
  private pauseContainer!: Phaser.GameObjects.Container;
  private irisGraphics!: Phaser.GameObjects.Graphics;
  private settingsModal?: ModalOverlayManager;
  private offscreenArrowGraphics!: Phaser.GameObjects.Graphics;
  private modalContainer!: Phaser.GameObjects.Container;
  private hpLabelText!: Phaser.GameObjects.Text;
  private armorLabelText!: Phaser.GameObjects.Text;
  private energyLabelText!: Phaser.GameObjects.Text;
  private statsLineText!: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private qualityBtnText?: Phaser.GameObjects.Text;
  private elementBtnText?: Phaser.GameObjects.Text;
  private weaponSlotBgs: Phaser.GameObjects.Graphics[] = [];
  private weaponIconSprites: Phaser.GameObjects.Sprite[] = [];
  private weaponNameTexts: Phaser.GameObjects.Text[] = [];
  private weaponMetaTexts: Phaser.GameObjects.Text[] = [];

  private debugOverlay?: DebugOverlay;
  private room?: ColyseusRoom;
  private colyseusClient?: ColyseusClient;
  private intentionalLeave = false;

  private inputSeq = 0;
  private queuedWeaponSlot: number | null = null;
  private wheelSwapQueued = false;
  private dashQueued = false;
  private skillQueued = false;
  private interactQueued = false;
  private dropWeaponQueued = false;
  private readyToggleQueued = false;
  private pingQueued: { x: number; y: number } | null = null;
  private queuedEmote: QuickEmoteId | null = null;

  // Smooth camera tracking state
  private camFocusX = 480;
  private camFocusY = 270;
  private lastShakeX = 0;
  private lastShakeY = 0;
  private crosshairPulse = 0;

  private keys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
    SHIFT: Phaser.Input.Keyboard.Key;
    Q: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    R: Phaser.Input.Keyboard.Key;
    G: Phaser.Input.Keyboard.Key;
    Z: Phaser.Input.Keyboard.Key;
    X: Phaser.Input.Keyboard.Key;
    V: Phaser.Input.Keyboard.Key;
    I: Phaser.Input.Keyboard.Key;
    TAB: Phaser.Input.Keyboard.Key;
    ONE: Phaser.Input.Keyboard.Key;
    TWO: Phaser.Input.Keyboard.Key;
    THREE: Phaser.Input.Keyboard.Key;
    FOUR: Phaser.Input.Keyboard.Key;
    F2: Phaser.Input.Keyboard.Key;
    F3: Phaser.Input.Keyboard.Key;
    F4: Phaser.Input.Keyboard.Key;
    F5: Phaser.Input.Keyboard.Key;
    F6: Phaser.Input.Keyboard.Key;
    F7: Phaser.Input.Keyboard.Key;
    F8: Phaser.Input.Keyboard.Key;
    F9: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super({ key: 'GameScene' });
  }

  public init(data?: GameSceneInitData): void {
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlCoop = params?.get('coop')?.toLowerCase();
    const urlJoin = params?.get('join') ?? undefined;
    const urlName = params?.get('name') ?? undefined;
    const urlServer = params?.get('server') ?? undefined;

    if (data?.coopMode) {
      this.coopMode = data.coopMode;
    } else if (urlCoop === 'host') {
      this.coopMode = 'host';
    } else if (urlCoop === 'join' || urlJoin) {
      this.coopMode = 'join';
    } else {
      this.coopMode = 'solo';
    }

    this.requestedRoomId = data?.roomId ?? urlJoin;
    this.displayName =
      data?.displayName ??
      urlName ??
      (typeof window !== 'undefined' ? window.localStorage?.getItem('ashen_pact_name') : null) ??
      'Hiệp Sĩ Tro';
    this.serverUrl = data?.serverUrl ?? urlServer;
    this.intentionalLeave = false;
  }

  public create(): void {
    const debug = initGlobalDebugState();
    debug.scene = 'GameScene';
    debug.tick = 0;
    debug.coopMode = this.coopMode;
    debug.language = graphicsSettings.getState().language;
    debug.pauseModalOpen = false;
    debug.settingsModalOpen = false;
    debug.controlsModalOpen = false;
    debug.creditsModalOpen = false;
    debug.weaponComparisonVisible = false;
    debug.comparedWeaponId = null;

    this.simPlayerRigs.clear();
    this.coopPlayerRigs.clear();
    this.hubStatueRigs.clear();
    this.pingVisuals.clear();
    this.enemyRigs.clear();
    this.propVisuals.clear();
    this.projectileSprites.clear();
    this.pickupSprites.clear();
    this.doorSprites.clear();
    this.chestSprites.clear();
    this.worldItemSprites.clear();
    this.npcVisuals.clear();
    this.portalSprite = undefined;
    this.portalLabel = undefined;
    this.localNameLabel = undefined;
    this.localEmoteLabel = undefined;
    this.localEmoteBg = undefined;
    this.hubGuideTexts = [];
    this.projectileSpritePool = [];
    this.pickupSpritePool = [];
    this.mapTileVisuals = [];
    this.lastMapRevision = -1;
    this.dashAfterimageTimer = 0;
    this.textObjects = [];
    this.weaponSlotBgs = [];
    this.weaponIconSprites = [];
    this.weaponNameTexts = [];
    this.weaponMetaTexts = [];
    this.lastShakeX = 0;
    this.lastShakeY = 0;
    this.lastHudLocale = '';
    this.lastHudHp = -1;
    this.lastHudArmor = -1;
    this.lastHudEnergy = -1;
    this.lastHudCharacterId = '';
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
    this.lastRunState = 'playing';
    this.resultDismissed = false;
    this.fullMapOpen = false;
    this.pauseModalOpen = false;
    this.trailingHpRatio = 1.0;
    this.trailingArmorRatio = 1.0;
    this.trailingBossHpRatio = 1.0;
    this.lowHpHeartbeatTimer = 0;
    this.irisTransitionProgress = 0.0;
    this.invitePanelVisible = true;
    this.copyToastTimer = 0;
    this.pingQueued = null;
    this.queuedEmote = null;
    this.dropWeaponQueued = false;
    this.readyToggleQueued = false;
    musicManager.setPaused(false);

    // 1. Initialize Transport (NetworkTransport for Co-op LAN Host/Join, LocalTransport for Solo)
    if (this.coopMode === 'host' || this.coopMode === 'join') {
      this.networkTransport = new NetworkTransport({
        seed: debug.seed,
        startInHub: true,
        localPlayerId: 1,
        localPlayerSlot: 1,
      });
      this.transport = this.networkTransport;
    } else {
      const searchParams = new URLSearchParams(window.location.search);
      const urlBiomeNum = Number(searchParams.get('biome'));
      const initialBiome: 1 | 2 | 3 = urlBiomeNum === 2 ? 2 : urlBiomeNum === 3 ? 3 : 1;
      this.networkTransport = null;
      this.transport = new LocalTransport({
        seed: debug.seed,
        biome: initialBiome,
        mapConfig: {
          cols: 36,
          rows: 22,
          includePillars: true,
          seed: debug.seed,
          biome: initialBiome,
        },
        spawnInitialWave: true,
        includeTrainingDummy: true,
        includeProps: true,
        autoRespawnWaves: true,
      });
      if (searchParams.get('hub') === '1') {
        this.transport.getSim().enterHub();
      } else if (initialBiome > 1) {
        this.transport.getSim().advanceToBiome(initialBiome);
      }
      debug.currentBiome = this.transport.getSim().currentBiome;
    }

    window.__PHASER_GAME__ = this.game;
    window.__GAME_TRANSPORT__ = this.transport;
    window.__GAME_STRESS_TEST__ = (active: boolean) => {
      this.setStressTestMode(active);
    };
    window.__GAME_SET_QUALITY__ = (quality: GraphicsQualityTier) => {
      graphicsSettings.setQuality(quality);
      this.debugOverlay?.resetSamples();
    };
    window.__GAME_BOT_AUTOPLAY__ = (active: boolean) => {
      const s = this.transport.getSim();
      s.botAutoPlayActive = active;
      initGlobalDebugState().botAutoPlayActive = active;
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('set_bot_autoplay', { active });
      }
    };
    window.__GAME_SET_WIFI_PROFILE__ = (profile: WifiProfileId) => {
      this.networkTransport?.setWifiProfile(profile);
      initGlobalDebugState().wifiProfile = profile;
    };
    window.__GAME_TRIGGER_LAG_SPIKE__ = (durationMs = 300) => {
      this.networkTransport?.triggerManualLagSpike(durationMs);
    };
    window.__GAME_FORCE_RECONNECT__ = () => this.forceCoopReconnect();
    window.__GAME_COOP_SEND__ = (type: string, payload?: unknown) => {
      this.room?.send(type, payload);
    };

    const sim = this.transport.getSim();
    this.camFocusX = sim.player.x;
    this.camFocusY = sim.player.y;

    this.applyCameraViewport();
    this.scale.on('resize', this.applyCameraViewport, this);

    // Prevent browser context menu on right-click skill cast
    this.input.mouse?.disableContextMenu();

    const onWheel = (
      _pointer: Phaser.Input.Pointer,
      _currentlyOver: Phaser.GameObjects.GameObject[],
      _dx: number,
      dy: number,
    ) => {
      if (dy !== 0) {
        this.wheelSwapQueued = true;
      }
    };
    this.input.on('wheel', onWheel);

    const onPointerDown = (pointer: Phaser.Input.Pointer) => {
      zzfx.unlockOnUserGesture();
      if (pointer.middleButtonDown()) {
        const wPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.pingQueued = {
          x: wPt.x - this.lastShakeX,
          y: wPt.y - this.lastShakeY,
        };
      }
    };
    const unlockAudio = () => zzfx.unlockOnUserGesture();
    this.input.on('pointerdown', onPointerDown);
    this.input.keyboard?.on('keydown', unlockAudio);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.intentionalLeave = true;
      this.scale.off('resize', this.applyCameraViewport, this);
      this.input.off('wheel', onWheel);
      this.input.off('pointerdown', onPointerDown);
      this.input.keyboard?.off('keydown', unlockAudio);
      this.lighting?.destroy();
      delete window.__GAME_TRANSPORT__;
      delete window.__GAME_STRESS_TEST__;
      delete window.__GAME_SET_QUALITY__;
      delete window.__GAME_BOT_AUTOPLAY__;
      delete window.__GAME_SET_WIFI_PROFILE__;
      delete window.__GAME_TRIGGER_LAG_SPIKE__;
      delete window.__GAME_FORCE_RECONNECT__;
      delete window.__GAME_COOP_SEND__;
      if (this.room) {
        const activeRoom = this.room;
        this.room = undefined;
        void activeRoom.leave().catch(() => {});
      }
    });

    // 2. Build Arena Tilemap (8 Floor Variants, Autotiled Walls/Pillars, Cracked Walls, AO Shadows, 6 Interactive Surfaces)
    this.buildArenaTiles();

    // 3. Telegraph & Hitbox Overlay Graphics (depth 38: above lightmapRt depth 34 so telegraphs stay bright & readable in dark zones)
    this.telegraphGraphics = this.add.graphics();
    this.telegraphGraphics.setDepth(38);

    this.hitboxGraphics = this.add.graphics();
    this.hitboxGraphics.setDepth(90);

    // 4. Player CutoutRig (Thiết Vệ default, switches dynamically in Hub)
    const textRes = TextureBaker.getBakeScale();
    this.playerRig = new CutoutRig(
      this,
      sim.player.x,
      sim.player.y + RIG_FOOT_OFFSET_Y,
      VANGUARD_RIG_DEF,
      {
        playerSlot: 1,
        displayScale: 1,
      },
    );
    this.playerRig.container.setDepth(30);
    this.playerRig.setEquippedWeapon(sim.getActiveWeaponId());

    this.localNameLabel = this.add
      .text(sim.player.x, sim.player.y - 26, '', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '10px',
        fontStyle: '800',
        color: PLAYER_SLOT_COLORS[1],
        stroke: PALETTE.INK_DEEP,
        strokeThickness: 3,
        resolution: textRes,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(48)
      .setVisible(false);
    this.textObjects.push(this.localNameLabel);

    this.localEmoteBg = this.add.graphics().setDepth(49);
    this.localEmoteLabel = this.add
      .text(sim.player.x, sim.player.y - 44, '', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '10.5px',
        fontStyle: '800',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DEEP,
        strokeThickness: 3,
        resolution: textRes,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(50)
      .setVisible(false);
    this.textObjects.push(this.localEmoteLabel);

    // 5. Sync initial destructible & light-emitting props
    this.syncProps(0);

    // 6. Pooled Combat FX Manager (Particles, Persistent Decals, Dash Afterimages, Ambient Leaves/Mist, Chain Lightning)
    this.fx = new CombatFxManager(this);

    // 7. Dynamic Lighting Pipeline + WebGL PostFX Shader
    this.lighting = new LightingPipeline(this);

    // 8. Custom Procedural Crosshair
    const invBake = 1 / textRes;
    this.crosshairSprite = this.add.sprite(sim.player.x + 64, sim.player.y, 'ui_crosshair');
    this.crosshairSprite.setScale(invBake);
    this.crosshairSprite.setDepth(950);

    // 9. Camera-Pinned Vector HUD
    this.buildVectorHud();
    this.triggerIrisTransition('open');

    // 10. Keyboard & Debug Bindings
    this.setupKeyboardBindings();

    this.debugOverlay = new DebugOverlay(this, false);
    if (this.coopMode === 'host' || this.coopMode === 'join') {
      void this.connectCoopRoom();
    } else {
      void this.connectHelloRoom();
    }
  }

  private setStressTestMode(active: boolean): void {
    const sim = this.transport.getSim();
    sim.configureStressTest(active);
    for (const rig of this.enemyRigs.values()) {
      rig.destroy();
    }
    this.enemyRigs.clear();
    this.debugOverlay?.resetSamples();
  }

  private drawSourceKeyToCtx(
    ctx: CanvasRenderingContext2D,
    key: string,
    dx: number,
    dy: number,
    cellPx: number,
  ): void {
    if (!this.textures.exists(key)) return;
    const tex = this.textures.get(key);
    const src = tex.getSourceImage() as CanvasImageSource | undefined;
    if (src) {
      ctx.drawImage(src, dx, dy, cellPx, cellPx);
    }
  }

  private renderTileCellToComposite(tile: ArenaTileVisual): void {
    const groundCtx = this.arenaGroundTex?.getContext();
    if (!groundCtx) return;

    const biome = this.transport?.getSim()?.currentBiome ?? 1;
    const cellPx = TILE_SIZE * this.tileCompositeScale;
    const dx = tile.tx * cellPx;
    const dy = tile.ty * cellPx;

    groundCtx.clearRect(dx, dy, cellPx, cellPx);
    this.drawSourceKeyToCtx(
      groundCtx,
      TextureBaker.getBiomeTileTextureKey(biome, tile.variant),
      dx,
      dy,
      cellPx,
    );

    if (tile.kind === 'floor') {
      if (tile.surface !== 'none') {
        TextureBaker.drawSurfaceTile(
          groundCtx,
          tile.surface,
          tile.surfaceMask,
          dx,
          dy,
          cellPx,
          tile.variant,
        );
      }
      if (tile.aoMask > 0) {
        this.drawSourceKeyToCtx(
          groundCtx,
          TextureBaker.getWallAoTextureKey(tile.aoMask),
          dx,
          dy,
          cellPx,
        );
      }
    } else {
      this.drawSourceKeyToCtx(
        groundCtx,
        this.getStructureTextureKey(tile.kind, tile.autotileMask, biome),
        dx,
        dy,
        cellPx,
      );
    }
  }

  private rebuildAllTileCellsToComposite(): void {
    if (!this.arenaGroundTex) return;
    for (let i = 0; i < this.mapTileVisuals.length; i++) {
      this.renderTileCellToComposite(this.mapTileVisuals[i]!);
    }
    this.arenaGroundTex.refresh();
  }

  private buildArenaTiles(): void {
    const sim = this.transport.getSim();
    const map = sim.map;

    this.cameras.main.setBackgroundColor(PALETTE.INK_DEEP);

    const compW = map.width * this.tileCompositeScale;
    const compH = map.height * this.tileCompositeScale;

    if (this.textures.exists('arena_ground_composite')) {
      this.textures.remove('arena_ground_composite');
    }

    this.arenaGroundTex =
      this.textures.createCanvas('arena_ground_composite', compW, compH) ?? undefined;

    for (let ty = 0; ty < map.rows; ty++) {
      for (let tx = 0; tx < map.cols; tx++) {
        const tile: ArenaTileVisual = {
          tx,
          ty,
          kind: map.getTile(tx, ty),
          variant: map.getTileVariant(tx, ty),
          autotileMask: map.getAutotileMask(tx, ty),
          aoMask: map.getWallAmbientOcclusionMask(tx, ty),
          surface: map.getSurface(tx, ty),
          surfaceMask: map.getSurfaceAutotileMask(tx, ty),
        };
        this.mapTileVisuals.push(tile);
      }
    }

    this.rebuildAllTileCellsToComposite();

    this.arenaGroundSprite = this.add.image(
      map.width / 2,
      map.height / 2,
      'arena_ground_composite',
    );
    this.arenaGroundSprite.setScale(1 / this.tileCompositeScale);
    this.arenaGroundSprite.setDepth(2);

    this.lastMapRevision =
      sim.currentBiome * 10000000 +
      sim.currentFloor * 1000000 +
      sim.currentRoomId * 10000 +
      map.mapRevision;
  }

  private getStructureTextureKey(
    kind: TileKind,
    autotileMask: number,
    biome: 1 | 2 | 3 = 1,
  ): string {
    if (kind === 'pillar') {
      return TextureBaker.getPillarTileTextureKey(biome, autotileMask);
    }
    if (kind === 'cracked_wall') {
      return TextureBaker.getCrackedWallTextureKey(biome);
    }
    return TextureBaker.getWallTileTextureKey(biome, autotileMask);
  }

  private lastRenderedBiome: 1 | 2 | 3 = 1;

  private syncArenaTilesWithMapRevision(): void {
    const sim = this.transport.getSim();
    if (sim.stressTestActive) return;
    const map = sim.map;
    const revKey =
      sim.currentBiome * 10000000 +
      sim.currentFloor * 1000000 +
      sim.currentRoomId * 10000 +
      map.mapRevision;
    if (revKey === this.lastMapRevision && sim.currentBiome === this.lastRenderedBiome) return;
    const biomeChanged = sim.currentBiome !== this.lastRenderedBiome;
    this.lastMapRevision = revKey;
    this.lastRenderedBiome = sim.currentBiome;

    let groundDirty = false;

    for (let i = 0; i < this.mapTileVisuals.length; i++) {
      const tile = this.mapTileVisuals[i]!;
      const newKind = map.getTile(tile.tx, tile.ty);
      const newVariant = map.getTileVariant(tile.tx, tile.ty);
      const newMask = map.getAutotileMask(tile.tx, tile.ty);
      const newAo = map.getWallAmbientOcclusionMask(tile.tx, tile.ty);
      const newSurface = map.getSurface(tile.tx, tile.ty);
      const newSurfaceMask = map.getSurfaceAutotileMask(tile.tx, tile.ty);

      if (
        biomeChanged ||
        newKind !== tile.kind ||
        newVariant !== tile.variant ||
        newMask !== tile.autotileMask ||
        newAo !== tile.aoMask ||
        newSurface !== tile.surface ||
        newSurfaceMask !== tile.surfaceMask
      ) {
        groundDirty = true;
        tile.kind = newKind;
        tile.variant = newVariant;
        tile.autotileMask = newMask;
        tile.aoMask = newAo;
        tile.surface = newSurface;
        tile.surfaceMask = newSurfaceMask;
        this.renderTileCellToComposite(tile);
      }
    }

    if (groundDirty) {
      this.arenaGroundTex?.refresh();
    }
  }

  private buildVectorHud(): void {
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
      `DPS: 0.0 · Đợt 1 | ${VIETNAMESE_VERIFICATION_STRING}`,
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
    galleryBtn.on('pointerdown', () => this.scene.start('ArtGalleryScene'));
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
  }

  private invalidateAllHudCaches(): void {
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
    this.statusText?.setText(
      isEn
        ? 'WASD: Move · Mouse: Shoot/Skill · Shift: Dash · R: Elem · G: Quality · F1-F7: Debug'
        : 'WASD: Chạy · Chuột: Bắn/Khiên · Shift: Dash · R: Ng.Tố · G: Đồ Họa · F1-F7: Debug',
    );
    this.menuBtnText?.setText(i18n.t('ui.hud.menuBtn'));
    this.skillLabelText?.setText(isEn ? '⚡Skill [Space]' : '⚡KN [Space]');
    this.pauseBtnText?.setText(isEn ? '⚙ [Esc]\nPause' : '⚙ [Esc]\nTạm Dừng');
  }

  private togglePauseModal(forceState?: boolean): void {
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

  private rebuildPauseModal(): void {
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

  public triggerIrisTransition(mode: 'open' | 'close' = 'open'): void {
    if (mode === 'close') {
      this.irisTransitionDir = -1;
      this.irisTransitionProgress = 0.02;
    } else {
      this.irisTransitionDir = 1;
      this.irisTransitionProgress = 1.0;
    }
  }

  private setupKeyboardBindings(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    this.keys = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      SHIFT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      Q: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      E: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      R: kb.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      G: kb.addKey(Phaser.Input.Keyboard.KeyCodes.G),
      Z: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      X: kb.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      V: kb.addKey(Phaser.Input.Keyboard.KeyCodes.V),
      I: kb.addKey(Phaser.Input.Keyboard.KeyCodes.I),
      TAB: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB, false),
      ONE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      TWO: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      THREE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      FOUR: kb.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      F2: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F2),
      F3: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F3),
      F4: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F4),
      F5: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F5),
      F6: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F6),
      F7: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F7),
      F8: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F8),
      F9: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F9),
    };

    kb.on('keydown-ESC', () => {
      zzfx.play('ui_click');
      if (this.settingsModal?.isOpen()) {
        this.settingsModal.close();
        return;
      }
      if (this.fullMapOpen) {
        this.fullMapOpen = false;
        initGlobalDebugState().fullMapOpen = false;
        return;
      }
      this.togglePauseModal();
    });

    this.keys.SHIFT.on('down', () => {
      this.dashQueued = true;
    });
    this.keys.SPACE.on('down', () => {
      this.skillQueued = true;
    });
    this.keys.Q.on('down', () => {
      this.wheelSwapQueued = true;
    });
    this.keys.E.on('down', () => {
      this.interactQueued = true;
    });
    this.keys.Z.on('down', () => {
      const pointer = this.input.activePointer;
      const wPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.pingQueued = {
        x: wPt.x - this.lastShakeX,
        y: wPt.y - this.lastShakeY,
      };
    });
    this.keys.X.on('down', () => {
      this.dropWeaponQueued = true;
    });
    this.keys.V.on('down', () => {
      this.readyToggleQueued = true;
      if (this.room && this.coopMode !== 'solo') {
        const sim = this.transport.getSim();
        this.room.send('set_ready', { ready: !sim.player.ready });
      }
    });
    this.keys.I.on('down', () => {
      this.invitePanelVisible = !this.invitePanelVisible;
      this.lastInvitePanelHash = '';
    });
    this.keys.TAB.on('down', () => {
      this.fullMapOpen = !this.fullMapOpen;
      initGlobalDebugState().fullMapOpen = this.fullMapOpen;
    });
    this.keys.ONE.on('down', () => {
      const sim = this.transport.getSim();
      if (sim.runState === 'buff_choice' && sim.pendingBuffChoices[0]) {
        sim.selectFloorBuff(sim.pendingBuffChoices[0]);
        if (this.room && this.coopMode !== 'solo') {
          this.room.send('select_buff', { buffId: sim.pendingBuffChoices[0] });
        }
      } else {
        this.queuedWeaponSlot = 0;
        if (this.coopMode !== 'solo' || sim.inHub || sim.getActivePlayerCount() > 1) {
          this.queuedEmote = 1;
        }
      }
    });
    this.keys.TWO.on('down', () => {
      const sim = this.transport.getSim();
      if (sim.runState === 'buff_choice' && sim.pendingBuffChoices[1]) {
        sim.selectFloorBuff(sim.pendingBuffChoices[1]);
        if (this.room && this.coopMode !== 'solo') {
          this.room.send('select_buff', { buffId: sim.pendingBuffChoices[1] });
        }
      } else {
        this.queuedWeaponSlot = 1;
        if (this.coopMode !== 'solo' || sim.inHub || sim.getActivePlayerCount() > 1) {
          this.queuedEmote = 2;
        }
      }
    });
    this.keys.THREE.on('down', () => {
      const sim = this.transport.getSim();
      if (sim.runState === 'buff_choice' && sim.pendingBuffChoices[2]) {
        sim.selectFloorBuff(sim.pendingBuffChoices[2]);
        if (this.room && this.coopMode !== 'solo') {
          this.room.send('select_buff', { buffId: sim.pendingBuffChoices[2] });
        }
      } else {
        this.queuedWeaponSlot = 2;
        if (this.coopMode !== 'solo' || sim.inHub || sim.getActivePlayerCount() > 1) {
          this.queuedEmote = 3;
        }
      }
    });
    this.keys.FOUR.on('down', () => {
      const sim = this.transport.getSim();
      this.queuedWeaponSlot = 3;
      if (this.coopMode !== 'solo' || sim.inHub || sim.getActivePlayerCount() > 1) {
        this.queuedEmote = 4;
      }
    });

    // R or F6: Cycle Elemental Imbue (None -> Burn -> Chill -> Shock -> Poison)
    const cycleElement = () => {
      this.transport.getSim().cycleImbueElement();
      zzfx.play('weapon_swap');
    };
    this.keys.R.on('down', cycleElement);
    this.keys.F6.on('down', cycleElement);

    // G: Cycle Graphics Quality Preset (High -> Medium -> Low -> High)
    this.keys.G.on('down', () => {
      graphicsSettings.cycleQuality();
    });

    // F2: Toggle God Mode
    this.keys.F2.on('down', () => {
      const sim = this.transport.getSim();
      const nextGod = !sim.player.godMode;
      sim.player.godMode = nextGod;
      const debug = initGlobalDebugState();
      debug.godMode = nextGod;
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('set_god_mode', { godMode: nextGod });
      }
    });

    // F3: Spawn fresh sample wave of 3 enemies
    this.keys.F3.on('down', () => {
      this.transport.getSim().spawnSampleWave();
    });

    // F4: Toggle Hitbox & SpatialHashGrid visualization
    this.keys.F4.on('down', () => {
      const debug = initGlobalDebugState();
      debug.showHitboxes = !debug.showHitboxes;
      if (!debug.showHitboxes) {
        this.hitboxGraphics.clear();
      }
    });

    // F5: Skip current room waves & unlock doors
    this.keys.F5.on('down', () => {
      const sim = this.transport.getSim();
      sim.skipCurrentRoomWaves();
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('skip_waves', {});
      }
    });

    // F7: Toggle Phase 2 Stress Test (4 players + 80 enemies + 600+ projectiles)
    this.keys.F7.on('down', () => {
      const sim = this.transport.getSim();
      this.setStressTestMode(!sim.stressTestActive);
    });

    // F8: Toggle Phase 3 Bot Auto-Play (auto-clears Floor 1 -> Buff -> Floor 2 + Boss)
    this.keys.F8.on('down', () => {
      const sim = this.transport.getSim();
      const nextBot = !sim.botAutoPlayActive;
      sim.botAutoPlayActive = nextBot;
      initGlobalDebugState().botAutoPlayActive = nextBot;
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('set_bot_autoplay', { active: nextBot });
      }
    });

    // F9: Cycle Phase 4 Wi-Fi Network Simulation Profile (off -> good -> normal -> bad)
    this.keys.F9.on('down', () => {
      const profiles: WifiProfileId[] = ['off', 'good', 'normal', 'bad'];
      const debug = initGlobalDebugState();
      const idx = (profiles.indexOf(debug.wifiProfile) + 1) % profiles.length;
      const nextProfile = profiles[idx]!;
      debug.wifiProfile = nextProfile;
      this.networkTransport?.setWifiProfile(nextProfile);
    });

    // ENTER: Replay run when Victory or Defeat summary modal is active
    kb.on('keydown-ENTER', () => {
      const sim = this.transport.getSim();
      if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
        this.scene.restart();
      }
    });

    kb.on('keydown-H', () => {
      const sim = this.transport.getSim();
      if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
        sim.enterHub();
        this.resultDismissed = true;
        this.triggerIrisTransition();
      }
    });

    kb.on('keydown-M', () => {
      const sim = this.transport.getSim();
      if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
        this.scene.start('MenuScene');
      }
    });
  }

  private getResolvedWsUrl(): string {
    if (this.serverUrl) {
      if (this.serverUrl.startsWith('ws://') || this.serverUrl.startsWith('wss://')) {
        return this.serverUrl;
      }
      return `ws://${this.serverUrl}`;
    }
    const wsHost = window.location.hostname || 'localhost';
    const locPort = window.location.port;
    const wsPort = locPort && locPort !== '5173' && locPort !== '4173' ? locPort : '2567';
    return `ws://${wsHost}:${wsPort}`;
  }

  private async fetchHostLanInfo(): Promise<void> {
    const debug = initGlobalDebugState();
    try {
      const wsUrl = this.getResolvedWsUrl();
      const httpBase = wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
      const res = await fetch(`${httpBase}/api/host-info`);
      if (res.ok) {
        const data = (await res.json()) as {
          lanIps?: string[];
          primaryLanIp?: string;
          port?: number;
        };
        if (data.primaryLanIp) this.primaryLanIp = data.primaryLanIp;
        if (data.lanIps) this.lanIps = data.lanIps;
        if (data.port) this.serverPort = data.port;
        debug.lanIps = this.lanIps;
        this.updateHostInviteUrl();
      }
    } catch {
      // Ignore if endpoint is unreachable
    }
  }

  private updateHostInviteUrl(): void {
    const debug = initGlobalDebugState();
    const ip = this.primaryLanIp || window.location.hostname || '127.0.0.1';
    const roomQuery = this.room ? `?join=${this.room.roomId}` : '?coop=join';
    this.hostInviteUrl = `http://${ip}:${this.serverPort}/${roomQuery}`;
    debug.hostInviteUrl = this.hostInviteUrl;
    this.lastInvitePanelHash = '';
  }

  private bindCoopRoomHandlers(room: ColyseusRoom): void {
    const debug = initGlobalDebugState();
    this.room = room;
    debug.serverConnected = true;
    debug.coopRoomId = room.roomId;
    this.updateHostInviteUrl();

    if (this.networkTransport) {
      this.networkTransport.setOnSendInput((msg) => {
        if (this.room === room) {
          room.send('input', msg);
        }
      });
    }

    room.onMessage(
      'coop_welcome',
      (msg: {
        playerId: number;
        slot: 1 | 2 | 3 | 4;
        seed: number;
        reconnectToken: string;
        isHost: boolean;
      }) => {
        if (!this.scene.isActive()) return;
        debug.seed = msg.seed;
        debug.playerSlot = msg.slot;
        this.reconnectToken = msg.reconnectToken;
        debug.reconnectToken = msg.reconnectToken;
        try {
          window.sessionStorage?.setItem('ashen_pact_reconnect_token', msg.reconnectToken);
          window.sessionStorage?.setItem('ashen_pact_room_id', room.roomId);
          if (room.reconnectionToken) {
            window.sessionStorage?.setItem('ashen_pact_colyseus_token', room.reconnectionToken);
          }
        } catch {
          // Ignore storage errors
        }
        this.networkTransport?.setLocalIdentity(msg.playerId, msg.slot);
        this.playerRig?.setPlayerSlot(msg.slot);
        this.lastInvitePanelHash = '';
        this.lastCoopHudHash = '';
      },
    );

    room.onMessage('world_snapshot', (snap) => {
      if (!this.scene.isActive()) return;
      this.networkTransport?.receiveSnapshot(snap);
    });

    room.onMessage('pong_check', (payload: { clientTime: number }) => {
      if (!this.scene.isActive()) return;
      const rtt = Math.max(1, Date.now() - payload.clientTime);
      this.networkTransport?.setRttMs(rtt);
      debug.pingMs = rtt;
      room.send('report_ping', { rttMs: rtt });
    });

    room.onMessage('host_disconnected', (msg: { reasonVi?: string }) => {
      if (!this.scene.isActive()) return;
      this.intentionalLeave = true;
      this.scene.start('MenuScene', {
        disconnectReason: msg.reasonVi ?? 'Phòng Co-op đã đóng do Host ngắt kết nối.',
      });
    });

    const onKicked = (msg: { reasonVi?: string }) => {
      if (!this.scene.isActive()) return;
      this.intentionalLeave = true;
      this.scene.start('MenuScene', {
        disconnectReason: msg.reasonVi ?? 'Bạn đã bị Host mời rời khỏi phòng.',
      });
    };
    room.onMessage('kicked', onKicked);
    room.onMessage('kicked_by_host', onKicked);

    room.onMessage('join_rejected', (msg: { reasonVi?: string }) => {
      if (!this.scene.isActive()) return;
      this.intentionalLeave = true;
      this.scene.start('MenuScene', {
        disconnectReason:
          msg.reasonVi ??
          'Đội đang chiến đấu — chỉ có thể tham gia ở Sảnh Chờ (Hub) hoặc giữa các tầng!',
      });
    });

    room.onMessage('character_select_result', () => {
      this.lastInvitePanelHash = '';
    });

    room.onLeave((code: number) => {
      if (!this.scene.isActive() || this.intentionalLeave) return;
      // Code 4000 = Host disconnect, 4001 = Kicked, 4002 = Room Full, 4003 = Mid-run Join Rejected
      if (code === 4000 || code === 4001 || code === 4002 || code === 4003) {
        this.scene.start('MenuScene', {
          disconnectReason:
            code === 4001
              ? 'Bạn đã bị Host mời rời khỏi phòng.'
              : code === 4002
                ? 'Phòng Co-op đã đủ 4 người chơi.'
                : code === 4003
                  ? 'Đội đang chiến đấu — chỉ có thể tham gia ở Sảnh Chờ (Hub) hoặc giữa các tầng!'
                  : 'Phòng Co-op đã đóng do Host ngắt kết nối.',
        });
        return;
      }
      debug.serverConnected = false;
      void this.forceCoopReconnect();
    });
  }

  private async connectCoopRoom(): Promise<void> {
    const debug = initGlobalDebugState();
    await this.fetchHostLanInfo();
    try {
      const wsUrl = this.getResolvedWsUrl();
      this.colyseusClient = new ColyseusClient(wsUrl);
      const savedToken =
        this.reconnectToken ??
        (typeof window !== 'undefined'
          ? window.sessionStorage?.getItem('ashen_pact_reconnect_token')
          : null);
      const joinOpts = {
        name: this.displayName,
        reconnectToken: savedToken ?? undefined,
        seed: debug.seed,
      };

      const room = this.requestedRoomId
        ? await this.colyseusClient.joinById(this.requestedRoomId, joinOpts)
        : await this.colyseusClient.joinOrCreate('coop_room', joinOpts);

      if (!this.scene.isActive()) {
        void room.leave().catch(() => {});
        return;
      }

      this.bindCoopRoomHandlers(room);
      room.send('ping_check', { clientTime: Date.now(), rttMs: 8 });

      this.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
          if (this.room && this.scene.isActive()) {
            const curRtt = this.networkTransport?.getTelemetry().rttMs ?? debug.pingMs ?? 8;
            this.room.send('ping_check', {
              clientTime: Date.now(),
              rttMs: curRtt,
            });
          }
        },
      });
    } catch {
      if (!this.scene.isActive()) return;
      debug.serverConnected = false;
    }
  }

  public async forceCoopReconnect(): Promise<boolean> {
    if (!this.colyseusClient) {
      this.colyseusClient = new ColyseusClient(this.getResolvedWsUrl());
    }
    const debug = initGlobalDebugState();
    const targetRoomId =
      this.room?.roomId ??
      this.requestedRoomId ??
      (typeof window !== 'undefined' ? window.sessionStorage?.getItem('ashen_pact_room_id') : null);
    const savedToken =
      this.reconnectToken ??
      (typeof window !== 'undefined'
        ? window.sessionStorage?.getItem('ashen_pact_reconnect_token')
        : null);

    if (this.room) {
      const prevRoom = this.room;
      this.intentionalLeave = true;
      this.room = undefined;
      try {
        await prevRoom.leave(false);
      } catch {
        // Ignore leave errors during simulated drop
      }
      this.intentionalLeave = false;
    }

    try {
      const joinOpts = {
        name: this.displayName,
        reconnectToken: savedToken ?? undefined,
      };
      const newRoom = targetRoomId
        ? await this.colyseusClient.joinById(targetRoomId, joinOpts)
        : await this.colyseusClient.joinOrCreate('coop_room', joinOpts);
      this.bindCoopRoomHandlers(newRoom);
      debug.serverConnected = true;
      return true;
    } catch {
      debug.serverConnected = false;
      return false;
    }
  }

  private async connectHelloRoom(): Promise<void> {
    const debug = initGlobalDebugState();
    await this.fetchHostLanInfo();
    try {
      const wsHost = window.location.hostname || 'localhost';
      const client = new ColyseusClient(`ws://${wsHost}:2567`);
      const room = await client.joinOrCreate('hello_room', {});
      if (!this.scene.isActive()) {
        void room.leave().catch(() => {});
        return;
      }
      this.room = room;
      debug.serverConnected = true;

      room.onMessage('hello_welcome', (msg: { seed?: number }) => {
        if (!this.scene.isActive()) return;
        if (typeof msg.seed === 'number') {
          debug.seed = msg.seed;
        }
      });

      room.onMessage('pong_check', (payload: { clientTime: number }) => {
        if (!this.scene.isActive()) return;
        debug.pingMs = Math.max(1, Date.now() - payload.clientTime);
      });

      this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => {
          if (this.room && this.scene.isActive()) {
            this.room.send('ping_check', { clientTime: Date.now() });
          }
        },
      });
    } catch {
      if (!this.scene.isActive()) return;
      debug.serverConnected = false;
    }
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
      const invBake = 1 / newScale;
      this.playerRig?.refreshBakedTextures();
      for (const rig of this.simPlayerRigs.values()) {
        rig.refreshBakedTextures();
      }
      for (const entry of this.coopPlayerRigs.values()) {
        entry.rig.refreshBakedTextures();
        entry.nameLabel.setResolution(newScale);
        entry.emoteLabel.setResolution(newScale);
      }
      for (const entry of this.hubStatueRigs.values()) {
        entry.rig.refreshBakedTextures();
        entry.label.setResolution(newScale);
        entry.subLabel.setResolution(newScale);
      }
      for (const rig of this.enemyRigs.values()) {
        rig.refreshBakedTextures();
      }
      this.rebuildAllTileCellsToComposite();
      for (const pv of this.propVisuals.values()) {
        pv.sprite.setTexture(TextureBaker.getPropTextureKey(pv.kind));
        pv.sprite.setScale(invBake);
        pv.shadow.setTexture('prop_shadow');
        pv.shadow.setScale(invBake);
      }
      const stressInvBake = 1 / Math.min(2, newScale);
      for (const item of this.projectileSprites.values()) {
        item.sprite.setTexture(item.textureKey);
        item.sprite.setScale(item.textureKey.startsWith('proj_stress_') ? stressInvBake : invBake);
      }
      for (const item of this.projectileSpritePool) {
        item.sprite.setTexture(item.textureKey);
        item.sprite.setScale(item.textureKey.startsWith('proj_stress_') ? stressInvBake : invBake);
      }
      for (const item of this.pickupSprites.values()) {
        item.sprite.setTexture(item.textureKey);
        item.sprite.setScale(invBake);
      }
      for (const item of this.pickupSpritePool) {
        item.sprite.setTexture(item.textureKey);
        item.sprite.setScale(invBake);
      }
      const sim = this.transport?.getSim();
      this.weaponIconSprites.forEach((icon, idx) => {
        const wId = sim?.player.weaponSlots[idx] ?? PHASE1_SAMPLE_WEAPONS[idx]!;
        icon.setTexture(TextureBaker.getWeaponTextureKey(wId));
        icon.setScale(invBake * 0.82);
      });
      if (this.crosshairSprite) {
        this.crosshairSprite.setTexture('ui_crosshair');
        this.crosshairSprite.setScale(invBake);
      }
      for (const txt of this.textObjects) {
        txt.setResolution(newScale);
      }
      for (const txt of this.pingVisuals.values()) {
        txt.setResolution(newScale);
      }
      for (const entry of this.doorSprites.values()) {
        entry.sprite.destroy();
        entry.label.destroy();
      }
      this.doorSprites.clear();
      for (const sprite of this.chestSprites.values()) {
        sprite.destroy();
      }
      this.chestSprites.clear();
      for (const entry of this.worldItemSprites.values()) {
        entry.sprite.destroy();
        entry.label.destroy();
      }
      this.worldItemSprites.clear();
      for (const entry of this.npcVisuals.values()) {
        entry.rig?.destroy();
        entry.sprite?.destroy();
        entry.label.destroy();
      }
      this.npcVisuals.clear();
      if (this.portalSprite) {
        this.portalSprite.destroy();
        this.portalSprite = undefined;
      }
      if (this.portalLabel) {
        this.portalLabel.destroy();
        this.portalLabel = undefined;
      }
      if (this.hudContainer) {
        this.invalidateAllHudCaches();
        this.syncRoomEntities(0);
        this.updateModalHud();
        if (this.pauseModalOpen) {
          this.rebuildPauseModal();
        }
      }
      this.settingsModal?.refreshResolution(newScale);
      this.fx?.refreshResolution(newScale, prevScale);
      this.lighting?.refreshResolution();
      this.debugOverlay?.refreshResolution(newScale);
    }

    cam.setZoom(zoom);
  }

  public override update(_time: number, rawDeltaMs: number): void {
    const sim = this.transport.getSim();
    const dtSec = Math.min(rawDeltaMs / 1000, 0.05);
    const isModalOrPaused = this.pauseModalOpen || (this.settingsModal?.isOpen() ?? false);
    const isSoloPaused = isModalOrPaused && this.coopMode === 'solo';

    // 1. Sample Player Input (WASD + Mouse Aim + Buttons)
    // Subtract lastShakeX/Y so screen shake never perturbs player aim angle or camera lookahead
    const pointer = this.input.activePointer;
    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const unshakenWorldX = worldPt.x - this.lastShakeX;
    const unshakenWorldY = worldPt.y - this.lastShakeY;
    const pInterpPre = this.transport.getInterpolatedPlayerPos(this.playerPosPreScratch);
    const aimAngle = Math.atan2(unshakenWorldY - pInterpPre.y, unshakenWorldX - pInterpPre.x);

    let moveX = 0;
    let moveY = 0;
    let buttons = 0;

    if (this.keys && !isModalOrPaused) {
      if (this.keys.A.isDown) moveX -= 1;
      if (this.keys.D.isDown) moveX += 1;
      if (this.keys.W.isDown) moveY -= 1;
      if (this.keys.S.isDown) moveY += 1;
      if (this.keys.SHIFT.isDown) buttons |= INPUT_BUTTON.DASH;
      if (this.keys.SPACE.isDown) buttons |= INPUT_BUTTON.SKILL;
      if (this.keys.Q.isDown) buttons |= INPUT_BUTTON.SWAP;
      if (this.keys.E.isDown) buttons |= INPUT_BUTTON.INTERACT;
    }

    if (this.dashQueued) {
      if (!isModalOrPaused) buttons |= INPUT_BUTTON.DASH;
      this.dashQueued = false;
    }
    if (this.skillQueued) {
      if (!isModalOrPaused) buttons |= INPUT_BUTTON.SKILL;
      this.skillQueued = false;
    }
    if (this.wheelSwapQueued) {
      if (!isModalOrPaused) buttons |= INPUT_BUTTON.SWAP;
      this.wheelSwapQueued = false;
    }
    if (this.interactQueued) {
      if (!isModalOrPaused) buttons |= INPUT_BUTTON.INTERACT;
      this.interactQueued = false;
    }

    if (this.dropWeaponQueued) {
      if (!isModalOrPaused) buttons |= INPUT_BUTTON.DROP_WEAPON;
      this.dropWeaponQueued = false;
    }
    if (this.readyToggleQueued) {
      if (!isModalOrPaused) buttons |= INPUT_BUTTON.READY;
      this.readyToggleQueued = false;
    }

    let pingWorldX: number | undefined;
    let pingWorldY: number | undefined;
    if (this.pingQueued) {
      if (!isModalOrPaused) {
        buttons |= INPUT_BUTTON.PING;
        pingWorldX = this.pingQueued.x;
        pingWorldY = this.pingQueued.y;
      }
      this.pingQueued = null;
    }

    const emoteId = !isModalOrPaused ? (this.queuedEmote ?? undefined) : undefined;
    this.queuedEmote = null;

    // Left mouse button -> FIRE (except when clicking top/bottom HUD buttons, Invite panel, or modal)
    const camView = this.cameras.main.worldView;
    const localViewX = worldPt.x - camView.x;
    const localViewY = worldPt.y - camView.y;
    const isClickingInvitePanel =
      sim.inHub &&
      this.invitePanelVisible &&
      localViewX >= 676 &&
      localViewX <= 952 &&
      localViewY >= 70 &&
      localViewY <= 360;
    const isClickingHud =
      localViewY < 68 ||
      localViewY > 480 ||
      isClickingInvitePanel ||
      isModalOrPaused ||
      sim.runState !== 'playing';
    if (pointer.leftButtonDown() && !isClickingHud) {
      buttons |= INPUT_BUTTON.FIRE;
    }
    if (pointer.rightButtonDown() && sim.runState === 'playing' && !isModalOrPaused) {
      buttons |= INPUT_BUTTON.SKILL;
    }

    const slotSelect = !isModalOrPaused ? this.queuedWeaponSlot : null;
    this.queuedWeaponSlot = null;

    if (this.copyToastTimer > 0) {
      this.copyToastTimer = Math.max(0, this.copyToastTimer - dtSec);
      if (this.copyToastTimer === 0) {
        this.lastInvitePanelHash = '';
      }
    }

    if (!isSoloPaused) {
      this.inputSeq += 1;
      this.transport.sendInput({
        seq: this.inputSeq,
        tick: sim.tick,
        moveX,
        moveY,
        aimAngle,
        buttons,
        weaponSlotSelect: slotSelect,
        pingWorldX,
        pingWorldY,
        emoteId,
      });

      // 2. Hit-Stop check & Fixed 60Hz Simulation Step via Transport
      const { simDeltaMs } = this.fx.consumeHitStopDelta(Math.min(rawDeltaMs, 50));
      if (simDeltaMs > 0) {
        const effectiveDelta = sim.stressTestActive ? Math.min(simDeltaMs, 16.6667) : simDeltaMs;
        this.transport.step(effectiveDelta);
      }

      // 3. Sync dynamic map changes (room transitions, cracked walls destroyed, surface ignitions/electrifications/freezes)
      this.syncArenaTilesWithMapRevision();

      // 4. Process Sim Events (SFX, Sparks, Damage Numbers, Decals, Chain Lightning, Hit-Stop, Screen Shake)
      this.processSimEvents(this.transport.consumeEvents());
    }

    // 4b. Trailing Damage Bars, Low-HP Heartbeat Warning & Dynamic Procedural Music
    const hpRatio = clamp(sim.player.hp / Math.max(1, sim.player.maxHp), 0, 1);
    if (hpRatio >= this.trailingHpRatio) {
      this.trailingHpRatio = hpRatio;
    } else {
      this.trailingHpRatio = dampLerp(this.trailingHpRatio, hpRatio, 5.5, dtSec);
    }

    const armorRatio = clamp(sim.player.armor / Math.max(1, sim.player.maxArmor), 0, 1);
    if (armorRatio >= this.trailingArmorRatio) {
      this.trailingArmorRatio = armorRatio;
    } else {
      this.trailingArmorRatio = dampLerp(this.trailingArmorRatio, armorRatio, 5.5, dtSec);
    }

    const activeBoss = sim.getActiveBoss();
    const bossRatio = activeBoss ? clamp(activeBoss.hp / Math.max(1, activeBoss.maxHp), 0, 1) : 1;
    if (!activeBoss || bossRatio >= this.trailingBossHpRatio) {
      this.trailingBossHpRatio = bossRatio;
    } else {
      this.trailingBossHpRatio = dampLerp(this.trailingBossHpRatio, bossRatio, 4.5, dtSec);
    }

    if (
      !isSoloPaused &&
      sim.runState === 'playing' &&
      !sim.inHub &&
      !sim.stressTestActive &&
      sim.player.lifeState === 'alive' &&
      sim.player.hp > 0 &&
      sim.player.hp <= 2
    ) {
      this.lowHpHeartbeatTimer -= dtSec;
      if (this.lowHpHeartbeatTimer <= 0) {
        this.lowHpHeartbeatTimer = 1.05;
        zzfx.play('low_hp_heartbeat');
      }
    } else {
      this.lowHpHeartbeatTimer = 0;
    }

    const musicTheme = sim.inHub
      ? 'menu_hub'
      : activeBoss
        ? activeBoss.defId === 'kryssa_ice_queen'
          ? 'boss_kryssa'
          : activeBoss.defId === 'forge_titan'
            ? 'boss_forge_titan'
            : 'boss_spore_king'
        : sim.currentBiome === 2
          ? 'biome2'
          : sim.currentBiome === 3
            ? 'biome3'
            : 'biome1';
    const inCombat =
      !sim.inHub &&
      sim.runState === 'playing' &&
      (activeBoss !== null || sim.enemies.some((e) => e.hp > 0 && !e.isDummy));
    musicManager.update(musicTheme, inCombat, dtSec);

    // 5. Render Interpolated Player & CutoutRig Animation + Dash Afterimage Ghosts
    const playerPos = this.transport.getInterpolatedPlayerPos(this.playerPosScratch);
    if (this.playerRig) {
      const charRigDef = RIG_DEFS_BY_ID[sim.player.characterId] ?? VANGUARD_RIG_DEF;
      this.playerRig.setRigDef(charRigDef);
      this.playerRig.setPlayerSlot(sim.player.slot);
      this.playerRig.setLifeState(sim.player.lifeState);
      this.playerRig.container.setPosition(playerPos.x, playerPos.y + RIG_FOOT_OFFSET_Y);
      this.playerRig.setAimAngle(aimAngle);
      this.playerRig.setEquippedWeapon(sim.getActiveWeaponId());
      this.playerRig.setDashActive(sim.player.dashTimer > 0);
      this.playerRig.setElementalStatusTint(this.resolvePlayerStatusTint());

      const isMoving = Math.hypot(sim.player.vx, sim.player.vy) > 12;
      this.playerRig.setAnimState(isMoving ? 'run' : 'idle');
      if (!isSoloPaused) {
        this.playerRig.update(dtSec);
      }

      if (sim.player.dashTimer > 0 && !isSoloPaused) {
        this.dashAfterimageTimer -= dtSec;
        if (this.dashAfterimageTimer <= 0) {
          this.dashAfterimageTimer = 0.038;
          this.fx.spawnDashAfterimage(
            playerPos.x,
            playerPos.y + RIG_FOOT_OFFSET_Y,
            this.playerRig.getFacingSign(),
            sim.player.slot,
          );
        }
      } else {
        this.dashAfterimageTimer = 0;
      }

      this.updatePlayerOverheadUi(
        sim.player,
        playerPos.x,
        playerPos.y,
        this.localNameLabel,
        this.localEmoteLabel,
        this.localEmoteBg,
      );

      // Cold breath vapor in Biome 2 (Frozen Depths)
      if (!isSoloPaused && sim.currentBiome === 2 && !sim.stressTestActive && sim.tick % 90 === 0) {
        this.fx.spawnFrostBreath(playerPos.x, playerPos.y, this.playerRig.getFacingSign());
      }
    }

    // 6. Sync Simulated Co-op Players (P2-P4), Network Co-op Players, Enemies, Props, Projectiles, Pickups & Phase 3/4 Room Entities
    const animDt = isSoloPaused ? 0 : dtSec;
    this.syncSimulatedPlayers(animDt);
    this.syncEnemyRigs(animDt);
    this.syncProps(animDt);
    this.syncProjectilesAndPickups();
    if (!sim.stressTestActive) {
      this.syncRoomEntities(animDt);
    }

    // 7. Update Pooled Particles, Ambient Leaves/Snow/Embers & Floating Damage Numbers
    this.fx.setBiome(sim.currentBiome);
    if (!isSoloPaused) {
      this.fx.update(dtSec, this.cameras.main.worldView);
    }

    // 8. Smooth Camera Follow + Cursor Lookahead (22%) + Trauma Screen Shake
    this.updateCameraWithLookaheadAndShake(
      playerPos.x,
      playerPos.y,
      unshakenWorldX,
      unshakenWorldY,
      dtSec,
    );

    // 9. Update Dynamic Lighting RenderTexture + WebGL PostFX Shader (zero-allocation scratch array)
    this.simPlayerLightingScratch.length = sim.simulatedPlayers.length;
    for (let i = 0; i < sim.simulatedPlayers.length; i++) {
      const sp = sim.simulatedPlayers[i]!;
      let slot = this.simPlayerLightingScratch[i];
      if (!slot) {
        slot = { pos: { x: 0, y: 0 }, state: sp };
        this.simPlayerLightingScratch[i] = slot;
      }
      this.transport.getInterpolatedSimPlayerPos(sp, slot.pos);
      slot.state = sp;
    }

    const isBlizzardPhase3 = activeBoss?.defId === 'kryssa_ice_queen' && activeBoss.bossPhase === 3;
    this.lighting.setBiome(sim.currentBiome);
    this.lighting.setBlizzardVeil(isBlizzardPhase3);
    this.lighting.update({
      dtSec: animDt,
      playerPos,
      player: sim.player,
      simulatedPlayers: this.simPlayerLightingScratch,
      enemies: sim.enemies,
      projectiles: sim.projectiles,
      props: sim.props,
      map: sim.map,
      trauma: sim.runState === 'playing' && !isSoloPaused ? this.fx.getTrauma() : 0,
    });

    // 10. Update Procedural Crosshair at Mouse World Position
    const updatedWorldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const invBake = 1 / TextureBaker.getBakeScale();
    if (this.crosshairPulse > 0) {
      this.crosshairPulse = Math.max(0, this.crosshairPulse - dtSec * 5);
    }
    this.crosshairSprite.setPosition(updatedWorldPt.x, updatedWorldPt.y);
    this.crosshairSprite.setScale(invBake * (1 + this.crosshairPulse * 0.35));

    // 11. Draw Telegraphs, Spawn Circles, Elemental Badges, Shield Wall, Revive Rings & Optional F4 Hitboxes
    this.renderTelegraphsAndShield(playerPos.x, playerPos.y);
    this.renderHitboxesIfEnabled();

    // 12. Update Camera-Pinned Vector HUD, Iris Transition & Debug Telemetry
    this.updateVectorHud();
    this.updateIrisTransition(dtSec);
    this.updateDebugState(playerPos.x, playerPos.y);
  }

  private updateIrisTransition(dtSec: number): void {
    const g = this.irisGraphics;
    if (!g) return;
    g.clear();

    const sim = this.transport.getSim();
    if (sim.runState !== 'playing') {
      this.irisTransitionProgress = 0;
      this.irisTransitionDir = 0;
      return;
    }

    if (this.irisTransitionDir === -1) {
      this.irisTransitionProgress = Math.min(1, this.irisTransitionProgress + dtSec * 4.2);
      if (this.irisTransitionProgress >= 1) {
        this.irisTransitionDir = 1;
      }
    } else if (this.irisTransitionDir === 1) {
      this.irisTransitionProgress = Math.max(0, this.irisTransitionProgress - dtSec * 2.8);
      if (this.irisTransitionProgress <= 0) {
        this.irisTransitionDir = 0;
      }
    }

    if (this.irisTransitionProgress <= 0.005) return;

    const maxHoleR = 560;
    const holeR = Math.max(2, maxHoleR * (1 - this.irisTransitionProgress));
    const ringThickness = 640;
    g.lineStyle(ringThickness, hexToNum(PALETTE.INK_DARK), 1);
    g.strokeCircle(480, 270, holeR + ringThickness * 0.5);
    g.lineStyle(3, hexToNum(PALETTE.SOLAR_GOLD), 0.9);
    g.strokeCircle(480, 270, holeR);
  }

  private updatePlayerOverheadUi(
    p: ReturnType<LocalTransport['getSim']>['player'],
    x: number,
    y: number,
    nameLabel?: Phaser.GameObjects.Text,
    emoteLabel?: Phaser.GameObjects.Text,
    emoteBg?: Phaser.GameObjects.Graphics,
  ): void {
    const sim = this.transport.getSim();
    const showName =
      !sim.stressTestActive &&
      (this.coopMode !== 'solo' ||
        sim.inHub ||
        sim.getActivePlayerCount() > 1 ||
        p.lifeState !== 'alive');

    const view = this.cameras.main.worldView;
    const safeTopY = (view && view.width > 0 ? view.y : 0) + 84;
    const placeBelow = y - 26 < safeTopY;
    const nameY = placeBelow ? y + 24 : y - 26;
    const emoteY = placeBelow ? y + 42 : Math.max(safeTopY + 12, y - 44);

    if (nameLabel) {
      if (!showName) {
        nameLabel.setVisible(false);
      } else {
        nameLabel.setVisible(true);
        let statusSuffix = '';
        if (p.lifeState === 'downed') {
          const revPct = Math.round(p.reviveProgress * 100);
          statusSuffix =
            revPct > 0
              ? ` · ${i18n.t('ui.hud.reviving')} ${revPct}%`
              : ` · ${i18n.t('ui.hud.downed')} (${Math.ceil(p.downedTimer)}s) ${i18n.t('ui.hud.holdEToRevive')}`;
        } else if (p.lifeState === 'ghost') {
          statusSuffix = ` · ${i18n.t('ui.hud.ghost')}`;
        } else if (sim.inHub && p.ready) {
          statusSuffix = ' · ✓';
        }
        const labelStr = `[P${p.slot}] ${p.displayName}${statusSuffix}`;
        if (nameLabel.text !== labelStr) {
          nameLabel.setText(labelStr);
        }
        const slotCol =
          p.lifeState === 'downed'
            ? PALETTE.CRIMSON_BRIGHT
            : p.lifeState === 'ghost'
              ? PALETTE.CYAN_FROST
              : PLAYER_SLOT_COLORS[p.slot];
        nameLabel.setColor(slotCol);
        nameLabel.setPosition(x, nameY);
      }
    }

    if (emoteLabel && emoteBg) {
      emoteBg.clear();
      if (p.emoteTimer > 0 && p.emoteId) {
        const emoteStr = `💬 ${i18n.emoteText(p.emoteId) || QUICK_EMOTES_VI[p.emoteId]}`;
        if (emoteLabel.text !== emoteStr) {
          emoteLabel.setText(emoteStr);
        }
        emoteLabel.setVisible(true);
        emoteLabel.setPosition(x, emoteY);
        const bw = Math.max(76, emoteStr.length * 6.5 + 16);
        const bh = 20;
        emoteBg.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
        emoteBg.lineStyle(2, hexToNum(PLAYER_SLOT_COLORS[p.slot]), 1);
        emoteBg.fillRoundedRect(x - bw / 2, emoteY - bh / 2, bw, bh, 6);
        emoteBg.strokeRoundedRect(x - bw / 2, emoteY - bh / 2, bw, bh, 6);
      } else {
        emoteLabel.setVisible(false);
      }
    }
  }

  private resolvePlayerStatusTint(): number | null {
    const p = this.transport.getSim().player;
    if (p.burnTimer > 0) return 0xfb923c;
    if (p.chillTimer > 0) return 0x38bdf8;
    if (p.poisonTimer > 0) return 0xc084fc;
    return null;
  }

  private resolveEnemyStatusTint(e: SimEnemyState): number | null {
    if (e.frozenTimer > 0) return 0x7dd3fc;
    if (e.shockTimer > 0) return 0xfde047;
    if (e.burnTimer > 0) return 0xfb923c;
    if (e.chillStacks > 0) return 0x38bdf8;
    if (e.poisonStacks > 0) return 0xc084fc;
    return null;
  }

  private processSimEvents(events: SimEvent[]): void {
    if (events.length === 0) return;

    const sim = this.transport.getSim();
    const isStress = sim.stressTestActive;
    const allowStressSfx = !isStress || sim.tick % 8 === 0;
    let playerShotFxTriggered = false;
    let enemyShotSfxTriggered = false;
    let enemyHitCountThisStep = 0;
    let statusFxCountThisStep = 0;
    let enemyHitCritThisStep = false;
    let enemyHitSfxX = this.camFocusX;
    let enemyHitSfxY = this.camFocusY;
    let maxHitStopMs = 0;
    let maxHitStopTrauma = 0;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      switch (ev.kind) {
        case 'projectile_spawned': {
          if (ev.team === 'player') {
            if (!playerShotFxTriggered) {
              playerShotFxTriggered = true;
              const shootSfx = resolveWeaponShootSfx(ev.weaponId);
              const isShotgun = shootSfx === 'shoot_shotgun';
              if (!isStress || sim.tick % 3 === 0) {
                this.fx.spawnMuzzleFlashAndCasing(ev.x, ev.y, ev.angle, isShotgun);
              }
              if (!isStress) {
                this.lighting.spawnTransientLight(ev.x, ev.y, 82, PALETTE.SOLAR_GOLD, 0.72, 0.08);
              }
              this.crosshairPulse = isShotgun ? 0.9 : 0.45;
              this.playerRig?.triggerRecoil(isShotgun ? 6.5 : 4.2);

              if (allowStressSfx) {
                zzfx.play(shootSfx, ev.x, this.camFocusX, ev.y, this.camFocusY);
                this.fx.addTrauma(isShotgun ? 0.18 : shootSfx === 'shoot_smg' ? 0.06 : 0.1);
              }
            }
          } else if (!enemyShotSfxTriggered && allowStressSfx) {
            enemyShotSfxTriggered = true;
            zzfx.play('shoot_pistol', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
          break;
        }
        case 'melee_swing': {
          this.playerRig?.triggerMeleeSwing();
          this.fx.spawnMeleeSlash(ev.x, ev.y, ev.angle);
          this.lighting.spawnTransientLight(ev.x, ev.y, 92, PALETTE.CYAN_FROST, 0.65, 0.12);
          this.crosshairPulse = 0.6;
          const swingSfx = resolveWeaponShootSfx(ev.weaponId);
          zzfx.play(swingSfx, ev.x, this.camFocusX, ev.y, this.camFocusY);
          if (ev.bulletsDestroyed > 0) {
            zzfx.play('bullet_deflect', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
          break;
        }
        case 'damage_dealt': {
          if (!isStress || (enemyHitCountThisStep === 0 && sim.tick % 10 === 0)) {
            this.fx.spawnDamagePopup({
              x: ev.x,
              y: ev.y,
              amount: ev.amount,
              isCrit: ev.isCrit,
              targetKind: ev.targetKind,
              hitArmor: ev.hitArmor,
              element: ev.element,
            });
          }
          const hitAngle = Math.atan2(ev.knockbackY, ev.knockbackX);
          const sparkCount = enemyHitCountThisStep === 0 ? (ev.isCrit ? 8 : 5) : 2;
          if (!isStress || enemyHitCountThisStep < 2) {
            this.fx.spawnHitSparks(ev.x, ev.y, hitAngle, {
              isCrit: ev.isCrit,
              element: ev.element,
              count: sparkCount,
            });
          }

          if (ev.targetKind === 'enemy') {
            if (!isStress || enemyHitCountThisStep < 2) {
              const rig = this.enemyRigs.get(ev.targetId);
              rig?.triggerHitFlash(0.12);
            }
            enemyHitCountThisStep += 1;
            if (ev.isCrit) {
              enemyHitCritThisStep = true;
            }
            enemyHitSfxX = ev.x;
            enemyHitSfxY = ev.y;
          } else {
            this.playerRig?.triggerHitFlash(0.16);
            zzfx.play('player_hurt', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
          break;
        }
        case 'armor_broken': {
          if (!isStress) {
            this.fx.spawnHitSparks(ev.x, ev.y, 0, {
              isCrit: true,
              element: 'shock',
              count: 8,
            });
            this.lighting.spawnTransientLight(ev.x, ev.y, 110, PALETTE.SOLAR_GOLD, 0.9, 0.25);
          }
          if (allowStressSfx) {
            zzfx.play('armor_break', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
          break;
        }
        case 'projectile_impact': {
          if (!isStress || i < 4) {
            this.fx.spawnHitSparks(ev.x, ev.y, ev.angle, {
              isCrit: ev.isCrit,
              hitWall: ev.hitWall,
              blockedByShield: ev.blockedByShield || ev.destroyedByMelee,
              element: ev.element,
              count: 4,
            });
          }
          if ((ev.blockedByShield || ev.destroyedByMelee) && allowStressSfx) {
            zzfx.play('bullet_deflect', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
          break;
        }
        case 'entity_killed': {
          if (!isStress || statusFxCountThisStep < 1) {
            statusFxCountThisStep += 1;
            this.fx.spawnEnemyDeathBurst(ev.defId, ev.x, ev.y);
            if (allowStressSfx) {
              zzfx.play('kill_enemy', ev.x, this.camFocusX, ev.y, this.camFocusY);
            }
          }
          break;
        }
        case 'dash_started': {
          this.fx.spawnDashDust(ev.x, ev.y + RIG_FOOT_OFFSET_Y);
          if (ev.playerId === sim.player.id) {
            if (this.playerRig) {
              this.fx.spawnDashAfterimage(
                ev.x,
                ev.y + RIG_FOOT_OFFSET_Y,
                this.playerRig.getFacingSign(),
                sim.player.slot,
              );
            }
          } else {
            const simRig =
              this.simPlayerRigs.get(ev.playerId) ?? this.coopPlayerRigs.get(ev.playerId)?.rig;
            const spState = sim.simulatedPlayers.find((sp) => sp.id === ev.playerId);
            this.fx.spawnDashAfterimage(
              ev.x,
              ev.y + RIG_FOOT_OFFSET_Y,
              simRig ? simRig.getFacingSign() : ev.dirX >= 0 ? 1 : -1,
              spState ? spState.slot : 2,
            );
          }
          if (allowStressSfx) {
            zzfx.play('dash', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
          break;
        }
        case 'enemy_telegraph': {
          if (allowStressSfx) {
            zzfx.play('telegraph', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
          break;
        }
        case 'explosion': {
          const isBarrel = ev.sourceDefId === 'explosive_barrel';
          const colorHex = isBarrel ? PALETTE.FLAME_ORANGE : PALETTE.TOXIC_PURPLE;
          this.fx.spawnExplosionBurst(ev.x, ev.y, ev.radius, colorHex);
          this.lighting.spawnTransientLight(ev.x, ev.y, ev.radius * 2.2, colorHex, 1.0, 0.38);
          if (allowStressSfx) {
            zzfx.play('explosion', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
          break;
        }
        case 'prop_destroyed': {
          this.fx.spawnPropBreakBurst(ev.propKind, ev.x, ev.y);
          if (ev.propKind !== 'explosive_barrel' && allowStressSfx) {
            zzfx.play('prop_break', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
          break;
        }
        case 'cracked_wall_broken': {
          this.fx.spawnPropBreakBurst('clay_vase', ev.x, ev.y);
          this.lighting.spawnTransientLight(ev.x, ev.y, 120, PALETTE.CYAN_FROST, 0.85, 0.4);
          zzfx.play('prop_break', ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'status_applied': {
          if (!isStress || (statusFxCountThisStep < 1 && sim.tick % 4 === 0)) {
            statusFxCountThisStep += 1;
            this.fx.spawnStatusBurst(ev.status, ev.x, ev.y);
            if (!isStress) {
              if (ev.status === 'frozen') {
                this.lighting.spawnTransientLight(ev.x, ev.y, 96, PALETTE.CYAN_FROST, 0.9, 0.28);
                zzfx.play('freeze', ev.x, this.camFocusX, ev.y, this.camFocusY);
              } else if (ev.status === 'shatter') {
                this.lighting.spawnTransientLight(ev.x, ev.y, 124, PALETTE.CYAN_FROST, 1.0, 0.34);
                zzfx.play('shatter', ev.x, this.camFocusX, ev.y, this.camFocusY);
              } else if (ev.status === 'burn') {
                this.lighting.spawnTransientLight(ev.x, ev.y, 84, PALETTE.FLAME_ORANGE, 0.78, 0.2);
              } else if (ev.status === 'shock') {
                this.lighting.spawnTransientLight(ev.x, ev.y, 96, PALETTE.VOLT_YELLOW, 0.88, 0.22);
              }
            }
          }
          break;
        }
        case 'chain_lightning': {
          if (!isStress || (statusFxCountThisStep < 1 && sim.tick % 6 === 0)) {
            statusFxCountThisStep += 1;
            this.fx.spawnChainLightningArc(ev.fromX, ev.fromY, ev.toX, ev.toY);
            if (!isStress) {
              this.lighting.spawnTransientLight(
                (ev.fromX + ev.toX) * 0.5,
                (ev.fromY + ev.toY) * 0.5,
                110,
                PALETTE.CYAN_FROST,
                0.92,
                0.22,
              );
              zzfx.play('chain_lightning', ev.toX, this.camFocusX, ev.toY, this.camFocusY);
            }
          }
          break;
        }
        case 'surface_triggered': {
          if (allowStressSfx) {
            if (ev.surface === 'burning_oil' || ev.surface === 'burning_grass') {
              zzfx.play('surface_ignite', ev.x, this.camFocusX, ev.y, this.camFocusY);
            } else if (ev.surface === 'electrified_water') {
              zzfx.play('chain_lightning', ev.x, this.camFocusX, ev.y, this.camFocusY);
            } else if (ev.surface === 'ice') {
              zzfx.play('freeze', ev.x, this.camFocusX, ev.y, this.camFocusY);
            }
          }
          break;
        }
        case 'grass_rustle': {
          if (!isStress) {
            this.fx.spawnGrassRustle(ev.x, ev.y);
          }
          break;
        }
        case 'skill_cast': {
          this.lighting.spawnTransientLight(ev.x, ev.y, 115, PALETTE.CRIMSON_BRIGHT, 0.88, 0.26);
          const caster = sim.getAllPlayers().find((pl) => pl.id === ev.playerId) ?? sim.player;
          const skillSfxMap = {
            vanguard: 'skill_vanguard',
            ranger: 'skill_ranger',
            elementalist: 'skill_elementalist',
            druid: 'skill_druid',
            engineer: 'skill_engineer',
          } as const;
          const skillSfx = skillSfxMap[caster.characterId] ?? 'skill_cast';
          zzfx.play(skillSfx, ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'shield_shockwave': {
          this.fx.spawnExplosionBurst(ev.x, ev.y, 90, PALETTE.CRIMSON_BRIGHT);
          this.lighting.spawnTransientLight(ev.x, ev.y, 150, PALETTE.CRIMSON_BRIGHT, 0.95, 0.32);
          zzfx.play('shield_shockwave', ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'weapon_swapped': {
          zzfx.play('weapon_swap');
          break;
        }
        case 'pickup_collected': {
          if (allowStressSfx) {
            zzfx.play('pickup', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
          break;
        }
        case 'shaman_heal': {
          if (!isStress) {
            this.lighting.spawnTransientLight(ev.x, ev.y, 88, PALETTE.GOBLIN_GREEN, 0.85, 0.25);
          }
          break;
        }
        case 'chest_opened': {
          this.lighting.spawnTransientLight(
            ev.x,
            ev.y,
            130,
            WEAPON_RARITY_COLORS[ev.rarity],
            0.95,
            0.45,
          );
          zzfx.play('chest_open', ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'room_cleared': {
          zzfx.play('door_open');
          break;
        }
        case 'room_entered': {
          this.camFocusX = sim.player.x;
          this.camFocusY = sim.player.y;
          break;
        }
        case 'portal_entered': {
          this.camFocusX = sim.player.x;
          this.camFocusY = sim.player.y;
          zzfx.play('portal_enter');
          this.triggerIrisTransition('close');
          break;
        }
        case 'boss_spawned': {
          this.fx.addTrauma(0.32);
          zzfx.play('boss_roar');
          break;
        }
        case 'boss_phase_changed': {
          this.fx.addTrauma(0.42);
          this.lighting.spawnTransientLight(ev.x, ev.y, 220, PALETTE.TOXIC_PURPLE, 1.0, 0.45);
          zzfx.play('boss_phase_change', ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'shrine_blessing': {
          this.lighting.spawnTransientLight(ev.x, ev.y, 140, PALETTE.CYAN_FROST, 0.95, 0.4);
          zzfx.play('skill_druid', ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'item_purchased': {
          zzfx.play('pickup', ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'player_downed': {
          this.lighting.spawnTransientLight(ev.x, ev.y, 110, PALETTE.CRIMSON_BRIGHT, 0.92, 0.35);
          zzfx.play('player_downed', ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'player_revived': {
          this.lighting.spawnTransientLight(ev.x, ev.y, 130, PALETTE.LIME_GLOW, 0.95, 0.4);
          zzfx.play('player_revived', ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'player_ghost': {
          this.lighting.spawnTransientLight(ev.x, ev.y, 120, PALETTE.CYAN_FROST, 0.9, 0.35);
          zzfx.play('telegraph', ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'players_teleported_to_room': {
          this.lighting.spawnTransientLight(ev.x, ev.y, 120, PALETTE.CYAN_FROST, 0.9, 0.3);
          this.camFocusX = sim.player.x;
          this.camFocusY = sim.player.y;
          break;
        }
        case 'character_selected': {
          this.lighting.spawnTransientLight(
            sim.player.x,
            sim.player.y,
            110,
            PALETTE.SOLAR_GOLD,
            0.9,
            0.3,
          );
          zzfx.play('weapon_swap', sim.player.x, this.camFocusX, sim.player.y, this.camFocusY);
          break;
        }
        case 'ping_issued': {
          zzfx.play('pickup', ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'emote_triggered': {
          zzfx.play('weapon_swap', ev.x, this.camFocusX, ev.y, this.camFocusY);
          break;
        }
        case 'elemental_reaction': {
          if (!isStress || statusFxCountThisStep < 2) {
            statusFxCountThisStep += 1;
            const meta = ELEMENTAL_REACTIONS[ev.reaction];
            this.fx.spawnElementalReactionFx({
              reaction: ev.reaction,
              x: ev.x,
              y: ev.y,
              damage: ev.damage,
              isTeamCombo: ev.isTeamCombo,
            });
            this.lighting.spawnTransientLight(
              ev.x,
              ev.y,
              ev.isTeamCombo ? 165 : 124,
              meta?.colorHex ?? PALETTE.SOLAR_GOLD,
              0.96,
              0.38,
            );
            if (allowStressSfx) {
              const reactionSfxMap = {
                vaporize: 'reaction_vaporize',
                shatter: 'shatter',
                superconduct: 'reaction_superconduct',
                toxic_blast: 'reaction_toxic_blast',
                paralysis: 'reaction_paralysis',
                overload: 'reaction_overload',
              } as const;
              const rSfx = reactionSfxMap[ev.reaction] ?? 'elemental_reaction';
              zzfx.play(rSfx, ev.x, this.camFocusX, ev.y, this.camFocusY);
              if (ev.isTeamCombo) {
                zzfx.play('team_combo', ev.x, this.camFocusX, ev.y, this.camFocusY);
              }
            }
          }
          break;
        }
        case 'summon_spawned': {
          this.lighting.spawnTransientLight(
            ev.x,
            ev.y,
            135,
            ev.summonKind === 'sacred_tree' ? PALETTE.LIME_GLOW : PALETTE.VOLT_YELLOW,
            0.92,
            0.35,
          );
          if (allowStressSfx) {
            zzfx.play(
              ev.summonKind === 'sacred_tree' ? 'skill_druid' : 'skill_engineer',
              ev.x,
              this.camFocusX,
              ev.y,
              this.camFocusY,
            );
          }
          break;
        }
        case 'emp_blast': {
          this.fx.spawnExplosionBurst(ev.x, ev.y, ev.radius, PALETTE.VOLT_YELLOW);
          this.lighting.spawnTransientLight(
            ev.x,
            ev.y,
            ev.radius * 2,
            PALETTE.VOLT_YELLOW,
            1.0,
            0.38,
          );
          if (allowStressSfx) {
            zzfx.play('emp_blast', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
          break;
        }
        case 'hit_stop': {
          maxHitStopMs = Math.max(maxHitStopMs, ev.durationMs);
          maxHitStopTrauma = Math.max(maxHitStopTrauma, ev.trauma);
          break;
        }
      }
    }

    if (enemyHitCountThisStep > 0 && allowStressSfx) {
      zzfx.play(
        enemyHitCritThisStep ? 'crit_hit' : 'hit_enemy',
        enemyHitSfxX,
        this.camFocusX,
        enemyHitSfxY,
        this.camFocusY,
      );
    }
    if (maxHitStopMs > 0 && !isStress) {
      this.fx.triggerHitStop(maxHitStopMs);
      this.fx.addTrauma(maxHitStopTrauma);
    }
  }

  private syncSimulatedPlayers(dtSec: number): void {
    const sim = this.transport.getSim();
    const textRes = TextureBaker.getBakeScale();
    this.activeSimPlayerIds.clear();
    this.activeCoopPlayerIds.clear();

    if (sim.stressTestActive) {
      // 1. Stress test simulated players
      for (let i = 0; i < sim.simulatedPlayers.length; i++) {
        const sp = sim.simulatedPlayers[i]!;
        this.activeSimPlayerIds.add(sp.id);

        let rig = this.simPlayerRigs.get(sp.id);
        if (!rig) {
          rig = new CutoutRig(this, sp.x, sp.y + RIG_FOOT_OFFSET_Y, VANGUARD_RIG_DEF, {
            playerSlot: sp.slot,
            displayScale: 1,
            initialPhaseOffset: sp.slot * 0.3,
          });
          rig.container.setDepth(29);
          this.simPlayerRigs.set(sp.id, rig);
        }

        const pos = this.transport.getInterpolatedSimPlayerPos(sp, this.entityPosScratch);
        rig.container.setPosition(pos.x, pos.y + RIG_FOOT_OFFSET_Y);
        rig.setAimAngle(sp.aimAngle);
        const spWeaponId = sp.weaponSlots[sp.activeWeaponSlot] ?? 'rusty_pistol';
        rig.setEquippedWeapon(spWeaponId);
        rig.setAnimState('run');
        rig.update(dtSec);
      }
    } else {
      // 2. Co-op LAN teammates (sim.simulatedPlayers when not in stress test)
      for (let i = 0; i < sim.simulatedPlayers.length; i++) {
        const cp = sim.simulatedPlayers[i]!;
        if (cp.id === sim.player.id) continue;
        this.activeCoopPlayerIds.add(cp.id);

        const charRigDef = RIG_DEFS_BY_ID[cp.characterId] ?? VANGUARD_RIG_DEF;
        let entry = this.coopPlayerRigs.get(cp.id);
        if (!entry) {
          const rig = new CutoutRig(this, cp.x, cp.y + RIG_FOOT_OFFSET_Y, charRigDef, {
            playerSlot: cp.slot,
            displayScale: 1,
            initialPhaseOffset: cp.slot * 0.25,
          });
          rig.container.setDepth(29);

          const nameLabel = this.add
            .text(cp.x, cp.y - 26, '', {
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: '10px',
              fontStyle: '800',
              color: PLAYER_SLOT_COLORS[cp.slot],
              stroke: PALETTE.INK_DEEP,
              strokeThickness: 3,
              resolution: textRes,
            })
            .setOrigin(0.5, 0.5)
            .setDepth(48);

          const emoteBg = this.add.graphics().setDepth(49);
          const emoteLabel = this.add
            .text(cp.x, cp.y - 44, '', {
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: '10.5px',
              fontStyle: '800',
              color: PALETTE.BONE_WHITE,
              stroke: PALETTE.INK_DEEP,
              strokeThickness: 3,
              resolution: textRes,
            })
            .setOrigin(0.5, 0.5)
            .setDepth(50)
            .setVisible(false);

          entry = { rig, nameLabel, emoteLabel, emoteBg };
          this.coopPlayerRigs.set(cp.id, entry);
        }

        const pos = this.transport.getInterpolatedSimPlayerPos(cp, this.entityPosScratch);

        entry.rig.setRigDef(charRigDef);
        entry.rig.setPlayerSlot(cp.slot);
        entry.rig.setLifeState(cp.lifeState);
        entry.rig.container.setPosition(pos.x, pos.y + RIG_FOOT_OFFSET_Y);
        entry.rig.setAimAngle(cp.aimAngle);
        const cpWeaponId = cp.weaponSlots[cp.activeWeaponSlot] ?? 'rusty_pistol';
        entry.rig.setEquippedWeapon(cpWeaponId);
        const moving = Math.hypot(cp.vx, cp.vy) > 10;
        entry.rig.setAnimState(moving ? 'run' : 'idle');
        entry.rig.update(dtSec);

        this.updatePlayerOverheadUi(
          cp,
          pos.x,
          pos.y,
          entry.nameLabel,
          entry.emoteLabel,
          entry.emoteBg,
        );

        if (
          sim.currentBiome === 2 &&
          !sim.stressTestActive &&
          cp.lifeState === 'alive' &&
          (sim.tick + cp.slot * 23) % 90 === 0
        ) {
          this.fx.spawnFrostBreath(pos.x, pos.y, entry.rig.getFacingSign());
        }
      }
    }

    for (const [id, rig] of this.simPlayerRigs.entries()) {
      if (!this.activeSimPlayerIds.has(id)) {
        rig.destroy();
        this.simPlayerRigs.delete(id);
      }
    }

    for (const [id, entry] of this.coopPlayerRigs.entries()) {
      if (!this.activeCoopPlayerIds.has(id)) {
        entry.rig.destroy();
        entry.nameLabel.destroy();
        entry.emoteLabel.destroy();
        entry.emoteBg.destroy();
        this.coopPlayerRigs.delete(id);
      }
    }
  }

  private syncEnemyRigs(dtSec: number): void {
    const sim = this.transport.getSim();
    this.activeEnemyIds.clear();
    const useFastComposite = sim.stressTestActive || sim.enemies.length > 24;
    const view = this.cameras.main.worldView;
    const hasView = view && view.width > 0;
    const viewLeft = hasView ? view.x - 48 : -9999;
    const viewRight = hasView ? view.x + view.width + 48 : 9999;
    const viewTop = hasView ? view.y - 48 : -9999;
    const viewBottom = hasView ? view.y + view.height + 48 : 9999;

    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0) continue;
      this.activeEnemyIds.add(e.id);

      let rig = this.enemyRigs.get(e.id);
      if (!rig) {
        const rigDef = RIG_DEFS_BY_ID[e.defId] ?? RIG_DEFS_BY_ID.goblin_shooter!;
        rig = new CutoutRig(this, e.x, e.y + RIG_FOOT_OFFSET_Y, rigDef, {
          displayScale: e.isElite && !e.isBoss ? 1.22 : 1,
          initialPhaseOffset: (e.id % 7) * 0.25,
          fastComposite: useFastComposite,
        });
        rig.container.setDepth(e.defId === 'ice_prison' ? 32 : e.isBoss ? 31 : 28);
        this.enemyRigs.set(e.id, rig);
      }

      // Mirror clones (kryssa_clone) have no ground shadow so observant players can distinguish real vs illusion!
      rig.setShadowVisible(!ENEMIES[e.defId]?.isIllusion);

      if (e.bossBurrowed) {
        rig.container.setVisible(false);
        continue;
      }

      const pos = this.transport.getInterpolatedEnemyPos(e, this.entityPosScratch);
      const inView =
        pos.x >= viewLeft && pos.x <= viewRight && pos.y >= viewTop && pos.y <= viewBottom;
      rig.container.setVisible(inView);
      if (!inView) continue;

      rig.container.setPosition(pos.x, pos.y + RIG_FOOT_OFFSET_Y);
      rig.setAimAngle(e.aimAngle);
      rig.setElementalStatusTint(this.resolveEnemyStatusTint(e));

      if (e.aiState === 'spawning') {
        const spawnProgress = 1 - clamp(e.stateTimer / ENEMY_SPAWN_WARMUP_SEC, 0, 1);
        rig.setSpawnProgress(spawnProgress);
      } else {
        rig.setSpawnProgress(1);
      }

      if (e.aiState === 'telegraph' && e.telegraphDurationSec > 0) {
        const teleProgress = 1 - clamp(e.stateTimer / e.telegraphDurationSec, 0, 1);
        rig.setTelegraphProgress(teleProgress);
      } else {
        rig.setTelegraphProgress(0);
      }

      const moving = e.frozenTimer <= 0 && Math.hypot(e.vx, e.vy) > 10;
      rig.setAnimState(moving ? 'run' : 'idle');
      if (!sim.stressTestActive || (i + sim.tick) % 2 === 0) {
        rig.update(sim.stressTestActive ? dtSec * 2 : dtSec);
      }
    }

    for (const [id, rig] of this.enemyRigs.entries()) {
      if (!this.activeEnemyIds.has(id)) {
        rig.destroy();
        this.enemyRigs.delete(id);
      }
    }
  }

  private syncProps(dtSec: number): void {
    const sim = this.transport.getSim();
    const invBake = 1 / TextureBaker.getBakeScale();
    this.activePropIds.clear();

    for (let i = 0; i < sim.props.length; i++) {
      const prop = sim.props[i]!;
      if (prop.hp <= 0) continue;
      this.activePropIds.add(prop.id);

      let pv = this.propVisuals.get(prop.id);
      if (!pv) {
        const shadow = this.add.sprite(prop.x, prop.y + 9, 'prop_shadow');
        shadow.setScale(invBake);
        shadow.setDepth(18);

        const sprite = this.add.sprite(prop.x, prop.y, TextureBaker.getPropTextureKey(prop.kind));
        sprite.setScale(invBake);
        sprite.setDepth(22);

        pv = {
          sprite,
          shadow,
          kind: prop.kind,
          lastHp: prop.hp,
          flashTimer: 0,
          isFlashed: false,
        };
        this.propVisuals.set(prop.id, pv);
      }

      if (prop.hp < pv.lastHp || prop.hitFlashTimer > 0) {
        pv.lastHp = prop.hp;
        pv.flashTimer = Math.max(pv.flashTimer, 0.09);
      }

      if (pv.flashTimer > 0) {
        pv.flashTimer = Math.max(0, pv.flashTimer - dtSec);
        if (!pv.isFlashed) {
          pv.sprite.setTintFill(0xf4f1ea);
          pv.isFlashed = true;
        }
      } else if (pv.isFlashed) {
        pv.sprite.clearTint();
        pv.isFlashed = false;
      }
    }

    for (const [id, pv] of this.propVisuals.entries()) {
      if (!this.activePropIds.has(id)) {
        pv.sprite.destroy();
        pv.shadow.destroy();
        this.propVisuals.delete(id);
      }
    }
  }

  private syncProjectilesAndPickups(): void {
    const sim = this.transport.getSim();
    const invBake = 1 / TextureBaker.getBakeScale();
    const stressInvBake = 1 / Math.min(2, TextureBaker.getBakeScale());
    const teammateOpacity = graphicsSettings.getState().teammateFxOpacity;
    const view = this.cameras.main.worldView;
    const hasView = view && view.width > 0;
    const viewLeft = hasView ? view.x - 24 : -9999;
    const viewRight = hasView ? view.x + view.width + 24 : 9999;
    const viewTop = hasView ? view.y - 24 : -9999;
    const viewBottom = hasView ? view.y + view.height + 24 : 9999;

    // 1. Projectiles (object-pooled Sprites)
    const isStress = sim.stressTestActive;
    const projScale = isStress ? stressInvBake : invBake;
    this.activeProjIds.clear();
    for (let i = 0; i < sim.projectiles.length; i++) {
      const b = sim.projectiles[i]!;
      this.activeProjIds.add(b.id);

      let tex = 'proj_player_bolt';
      let tint = 0xffffff;
      if (isStress) {
        if (b.team === 'enemy') {
          tex = 'proj_stress_enemy';
        } else {
          tex = 'proj_stress_player';
          if (b.element === 'burn') tint = 0xfb923c;
          else if (b.element === 'chill') tint = 0x38bdf8;
          else if (b.element === 'shock') tint = 0xfde047;
          else if (b.element === 'poison') tint = 0x4ade80;
          else if (b.weaponId === 'scrap_shotgun') tint = 0xfacc15;
          else tint = 0x7dd3fc;
        }
      } else if (b.team === 'enemy') {
        tex = 'proj_enemy_orb';
        if (b.element === 'chill') tint = 0x7dd3fc;
        else if (b.element === 'burn') tint = 0xfb923c;
        else if (b.element === 'shock') tint = 0xfde047;
      } else if (b.element === 'burn') {
        tex = 'proj_player_burn';
      } else if (b.element === 'chill') {
        tex = 'proj_player_chill';
      } else if (b.element === 'shock') {
        tex = 'proj_player_shock';
      } else if (b.element === 'poison') {
        tex = 'proj_player_poison';
      } else if (b.weaponId === 'scrap_shotgun') {
        tex = 'proj_player_pellet';
      }

      let entry = this.projectileSprites.get(b.id);
      if (!entry) {
        const pooled = this.projectileSpritePool.pop();
        if (pooled) {
          entry = pooled;
          if (entry.textureKey !== tex) {
            entry.textureKey = tex;
            entry.sprite.setTexture(tex);
          }
          entry.sprite.setActive(true);
        } else {
          const sprite = this.add.sprite(b.x, b.y, tex);
          sprite.setDepth(42);
          entry = { sprite, textureKey: tex };
        }
        entry.sprite.setScale(projScale);
        this.projectileSprites.set(b.id, entry);
      } else if (entry.textureKey !== tex) {
        entry.textureKey = tex;
        entry.sprite.setTexture(tex);
        entry.sprite.setScale(projScale);
      }

      const pos = this.transport.getInterpolatedProjectilePos(b, this.entityPosScratch);
      const inView =
        pos.x >= viewLeft && pos.x <= viewRight && pos.y >= viewTop && pos.y <= viewBottom;
      entry.sprite.setVisible(inView);
      if (inView) {
        if (tint === 0xffffff) {
          entry.sprite.clearTint();
        } else {
          entry.sprite.setTint(tint);
        }
        const isTeammateBullet = b.team === 'player' && b.ownerId !== sim.player.id;
        entry.sprite.setAlpha(isTeammateBullet ? teammateOpacity : 1.0);
        entry.sprite.setPosition(pos.x, pos.y);
        entry.sprite.setRotation(b.team === 'enemy' ? 0 : b.angle);
      }
    }

    for (const [id, entry] of this.projectileSprites.entries()) {
      if (!this.activeProjIds.has(id)) {
        entry.sprite.setVisible(false);
        entry.sprite.setActive(false);
        this.projectileSpritePool.push(entry);
        this.projectileSprites.delete(id);
      }
    }

    // 2. Pickups (Energy & Gold, object-pooled Sprites, instanced per player)
    this.activePickupIds.clear();
    for (let i = 0; i < sim.pickups.length; i++) {
      const pk = sim.pickups[i]!;
      if (
        pk.ownerPlayerId !== undefined &&
        pk.ownerPlayerId !== 0 &&
        pk.ownerPlayerId !== sim.player.id
      ) {
        continue;
      }
      this.activePickupIds.add(pk.id);

      let entry = this.pickupSprites.get(pk.id);
      const tex =
        pk.kind === 'energy'
          ? 'fx_pickup_energy'
          : pk.kind === 'life_seed'
            ? 'fx_ambient_leaf'
            : 'fx_pickup_gold';
      if (!entry) {
        const pooled = this.pickupSpritePool.pop();
        if (pooled) {
          entry = pooled;
          if (entry.textureKey !== tex) {
            entry.textureKey = tex;
            entry.sprite.setTexture(tex);
          }
          entry.sprite.setVisible(true);
          entry.sprite.setActive(true);
        } else {
          const sprite = this.add.sprite(pk.x, pk.y, tex);
          sprite.setDepth(25);
          entry = { sprite, textureKey: tex };
        }
        entry.sprite.setScale(invBake * (pk.kind === 'life_seed' ? 1.35 : 1));
        this.pickupSprites.set(pk.id, entry);
      } else if (entry.textureKey !== tex) {
        entry.textureKey = tex;
        entry.sprite.setTexture(tex);
        entry.sprite.setScale(invBake * (pk.kind === 'life_seed' ? 1.35 : 1));
      }

      if (pk.kind === 'life_seed') {
        entry.sprite.setTint(hexToNum(PALETTE.LIME_GLOW));
      } else {
        entry.sprite.clearTint();
      }
      const pos = this.transport.getInterpolatedPickupPos(pk, this.entityPosScratch);
      entry.sprite.setPosition(pos.x, pos.y);
    }

    for (const [id, entry] of this.pickupSprites.entries()) {
      if (!this.activePickupIds.has(id)) {
        entry.sprite.setVisible(false);
        entry.sprite.setActive(false);
        this.pickupSpritePool.push(entry);
        this.pickupSprites.delete(id);
      }
    }
  }

  private syncRoomEntities(dtSec: number): void {
    const sim = this.transport.getSim();
    const textRes = TextureBaker.getBakeScale();
    const invBake = 1 / textRes;

    // 0. Hub 5 Character Statues & Natural Hub Guidance Signs (Doanh Trại)
    const previewOpen = initGlobalDebugState().hubPreviewCharacterId !== null;
    if (sim.inHub && sim.hubStatues.length > 0) {
      for (let i = 0; i < sim.hubStatues.length; i++) {
        const st = sim.hubStatues[i]!;
        const cDef = CHARACTERS[st.characterId];
        const charTxt = i18n.getCharacterText(st.characterId);
        const rigDef = RIG_DEFS_BY_ID[st.characterId] ?? VANGUARD_RIG_DEF;
        let entry = this.hubStatueRigs.get(st.characterId);
        if (!entry) {
          const rig = new CutoutRig(this, st.x, st.y + RIG_FOOT_OFFSET_Y, rigDef, {
            displayScale: 1.12,
            initialPhaseOffset: i * 0.35,
          });
          rig.container.setDepth(24);
          rig.setEquippedWeapon(cDef.starterWeaponId);

          const label = this.add
            .text(st.x, st.y - 30, `[E] ${charTxt.name}`, {
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: '10.5px',
              fontStyle: '800',
              color: PALETTE.SOLAR_GOLD,
              stroke: PALETTE.INK_DEEP,
              strokeThickness: 3,
              resolution: textRes,
            })
            .setOrigin(0.5, 0.5)
            .setDepth(46);

          const subLabel = this.add
            .text(st.x, st.y + 23, `HP ${cDef.hp} · ${i18n.t('ui.hud.armor')} ${cDef.armor}`, {
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: '8.5px',
              fontStyle: '700',
              color: PALETTE.SILVER_BRIGHT,
              stroke: PALETTE.INK_DEEP,
              strokeThickness: 2.5,
              align: 'center',
              resolution: textRes,
            })
            .setOrigin(0.5, 0.5)
            .setDepth(46);

          entry = { rig, label, subLabel };
          this.hubStatueRigs.set(st.characterId, entry);
        }

        const isSelectedByLocal = sim.player.characterId === st.characterId;
        const isInspecting = Math.hypot(sim.player.x - st.x, sim.player.y - st.y) <= 72;
        entry.label.setColor(isSelectedByLocal ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD);
        const selTag = i18n.getLocale() === 'en' ? 'Selected' : 'Đang Chọn';
        entry.label.setText(
          isSelectedByLocal ? `★ ${charTxt.name} (${selTag})` : `[E] ${charTxt.name}`,
        );
        const nextSub = `HP ${cDef.hp} · ${i18n.t('ui.hud.armor')} ${cDef.armor}`;
        if (entry.subLabel.text !== nextSub) {
          entry.subLabel.setText(nextSub);
        }
        entry.subLabel.setVisible(
          !isInspecting && !(previewOpen && st.y > sim.map.height * 0.5 - 120),
        );
        entry.rig.update(dtSec);
      }

      // Natural Hub Guidance Signs (Statues Arc, Weapon Rack, Training Dummy live DPS)
      const isEn = i18n.getLocale() === 'en';
      const camScrollX = this.cameras.main.worldView?.x ?? 0;
      const dummySignX = 620;
      const dummyBlockedByInvite =
        this.invitePanelVisible && !this.fullMapOpen && dummySignX - camScrollX > 560;
      const guideSpecs: {
        x: number;
        y: number;
        text: string;
        color: string;
        visible: boolean;
      }[] = [
        {
          x: 500,
          y: 112,
          text: i18n.t('ui.hubGuide.statuesSign'),
          color: PALETTE.CYAN_FROST,
          visible: true,
        },
        {
          x: 255,
          y: 268,
          text: isEn
            ? '⚔ PRACTICE WEAPON RACK — Press [E] to Test & Compare'
            : '⚔ KỆ VŨ KHÍ THỬ NGHIỆM — Nhấn [E] Nhặt Thử & So Sánh',
          color: PALETTE.SOLAR_GOLD,
          visible: !previewOpen,
        },
        {
          x: dummySignX,
          y: 392,
          text: isEn
            ? `🎯 Training Dummy · DPS: ${sim.getRollingDps().toFixed(1)}`
            : `🎯 Bù Nhìn Tập Bắn · DPS: ${sim.getRollingDps().toFixed(1)}`,
          color: PALETTE.LIME_GLOW,
          visible: !dummyBlockedByInvite,
        },
      ];

      for (let gIdx = 0; gIdx < guideSpecs.length; gIdx++) {
        const spec = guideSpecs[gIdx]!;
        let gTxt = this.hubGuideTexts[gIdx];
        if (!gTxt) {
          gTxt = this.add
            .text(spec.x, spec.y, spec.text, {
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: '9.5px',
              fontStyle: '800',
              color: spec.color,
              stroke: PALETTE.INK_DEEP,
              strokeThickness: 3,
              resolution: textRes,
            })
            .setOrigin(0.5, 0.5)
            .setDepth(45);
          this.hubGuideTexts[gIdx] = gTxt;
        } else {
          if (gTxt.text !== spec.text) gTxt.setText(spec.text);
          gTxt.setColor(spec.color);
          gTxt.setPosition(spec.x, spec.y);
        }
        gTxt.setVisible(spec.visible);
      }
    } else {
      if (this.hubStatueRigs.size > 0) {
        for (const entry of this.hubStatueRigs.values()) {
          entry.rig.destroy();
          entry.label.destroy();
          entry.subLabel.destroy();
        }
        this.hubStatueRigs.clear();
      }
      if (this.hubGuideTexts.length > 0) {
        for (const gTxt of this.hubGuideTexts) {
          gTxt.destroy();
        }
        this.hubGuideTexts = [];
      }
    }

    // 0b. Contextual Ping Labels
    this.activePingIds.clear();
    for (let i = 0; i < sim.pings.length; i++) {
      const ping = sim.pings[i]!;
      this.activePingIds.add(ping.id);
      let label = this.pingVisuals.get(ping.id);
      const slotColor = PLAYER_SLOT_COLORS[ping.playerSlot];
      const prefixIcon =
        ping.kind === 'enemy'
          ? '⚔'
          : ping.kind === 'revive'
            ? '✚'
            : ping.kind === 'loot'
              ? '★'
              : '▼';
      const txt = `[P${ping.playerSlot}] ${prefixIcon} ${ping.labelVi}`;
      if (!label) {
        label = this.add
          .text(ping.x, ping.y - 26, txt, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '10.5px',
            fontStyle: '800',
            color: slotColor,
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 3,
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5)
          .setDepth(55);
        this.pingVisuals.set(ping.id, label);
      } else {
        if (label.text !== txt) label.setText(txt);
        label.setColor(slotColor);
        label.setPosition(ping.x, ping.y - 26 - Math.sin(sim.tick * 0.15) * 3);
      }
    }
    for (const [id, label] of this.pingVisuals.entries()) {
      if (!this.activePingIds.has(id)) {
        label.destroy();
        this.pingVisuals.delete(id);
      }
    }

    // 1. Room Doors (North / South / East / West)
    const view = this.cameras.main.worldView;
    const hasView = view && view.width > 0;
    const bossActive = sim.getActiveBoss() !== null;
    const safeTopY = hasView ? view.y + (bossActive ? 122 : 82) : 82;
    const safeBottomY = hasView ? view.y + view.height - 66 : 474;
    const safeLeftX = hasView ? view.x + 18 : 18;
    const safeRightX = hasView ? view.x + view.width - 18 : 942;

    this.activeDoorKeys.clear();
    for (let i = 0; i < sim.doors.length; i++) {
      const door = sim.doors[i]!;
      const key = `${sim.currentFloor}_${sim.currentRoomId}_${door.dir}`;
      this.activeDoorKeys.add(key);

      const isOpen = !door.locked;
      const tex = isOpen ? 'door_open' : 'door_locked';
      const targetRoom = sim.dungeon.rooms.find((r) => r.id === door.targetRoomId);
      const roomLabel = targetRoom
        ? i18n.roomTypeName(targetRoom.type)
        : i18n.getLocale() === 'en'
          ? 'Room'
          : 'Phòng';
      const labelStr = isOpen ? `→ ${roomLabel}` : `🔒 ${roomLabel}`;
      const labelColor = isOpen ? PALETTE.LIME_GLOW : PALETTE.CRIMSON_BRIGHT;

      let entry = this.doorSprites.get(key);
      if (!entry) {
        const sprite = this.add.sprite(door.x, door.y, tex);
        sprite.setScale(invBake);
        sprite.setDepth(16);
        if (door.dir === 'E' || door.dir === 'W') {
          sprite.setRotation(Math.PI / 2);
        }

        const originX = door.dir === 'E' ? 1 : door.dir === 'W' ? 0 : 0.5;
        const label = this.add
          .text(door.x, door.y, labelStr, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '10px',
            fontStyle: '800',
            color: labelColor,
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 3,
            resolution: textRes,
          })
          .setOrigin(originX, 0.5)
          .setDepth(45);

        entry = { sprite, label };
        this.doorSprites.set(key, entry);
      } else {
        if (entry.sprite.texture.key !== tex) {
          entry.sprite.setTexture(tex);
        }
        if (entry.label.text !== labelStr) {
          entry.label.setText(labelStr);
          entry.label.setColor(labelColor);
        }
      }

      const rawLabelX = door.dir === 'W' ? door.x + 22 : door.dir === 'E' ? door.x - 22 : door.x;
      const rawLabelY =
        door.dir === 'N'
          ? door.y + 30
          : door.dir === 'S'
            ? door.y - 24
            : door.dir === 'E'
              ? Math.max(door.y - 24, hasView ? view.y + 194 : door.y - 24)
              : door.y - 24;
      entry.label.setPosition(
        clamp(rawLabelX, safeLeftX, safeRightX),
        clamp(rawLabelY, safeTopY, safeBottomY),
      );
    }

    for (const [key, entry] of this.doorSprites.entries()) {
      if (!this.activeDoorKeys.has(key)) {
        entry.sprite.destroy();
        entry.label.destroy();
        this.doorSprites.delete(key);
      }
    }

    // 2. Treasure / Reward Chests (5 Rarities; opening spawns instanced drops in Co-op)
    this.activeChestIds.clear();
    for (let i = 0; i < sim.chests.length; i++) {
      const ch = sim.chests[i]!;
      this.activeChestIds.add(ch.id);
      const tex = TextureBaker.getChestTextureKey(ch.rarity, ch.opened);
      let sprite = this.chestSprites.get(ch.id);
      if (!sprite) {
        sprite = this.add.sprite(ch.x, ch.y, tex);
        sprite.setScale(invBake);
        sprite.setDepth(23);
        this.chestSprites.set(ch.id, sprite);
      } else if (sprite.texture.key !== tex) {
        sprite.setTexture(tex);
      }
      sprite.setPosition(ch.x, ch.y);
    }

    for (const [id, sprite] of this.chestSprites.entries()) {
      if (!this.activeChestIds.has(id)) {
        sprite.destroy();
        this.chestSprites.delete(id);
      }
    }

    // 3. World Items (Dropped Weapons & Merchant Shop Items, instanced per player unless shared)
    let comparedWeaponItemId = -1;
    let bestWeaponDist = 64;
    if (sim.runState === 'playing' && !this.fullMapOpen) {
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
        if (d <= bestWeaponDist) {
          bestWeaponDist = d;
          comparedWeaponItemId = it.id;
        }
      }
    }

    this.activeWorldItemIds.clear();
    for (let i = 0; i < sim.worldItems.length; i++) {
      const it = sim.worldItems[i]!;
      if (it.pickedUp) continue;
      if (
        it.ownerPlayerId !== undefined &&
        it.ownerPlayerId !== 0 &&
        it.ownerPlayerId !== sim.player.id
      ) {
        continue;
      }
      this.activeWorldItemIds.add(it.id);
      const tex =
        it.kind === 'weapon' && it.weaponId
          ? TextureBaker.getWeaponTextureKey(it.weaponId)
          : 'item_health_potion';
      const itemName =
        it.kind === 'weapon' && it.weaponId
          ? i18n.weaponName(it.weaponId, it.nameVi)
          : i18n.getLocale() === 'en'
            ? `Health Potion (+${it.healAmount || 3} HP)`
            : it.nameVi;
      const labelText =
        it.costGold > 0
          ? `[E] ${itemName} · ${it.costGold} ${i18n.t('ui.hud.gold')}`
          : `[E] ${itemName}`;

      let entry = this.worldItemSprites.get(it.id);
      if (!entry) {
        const sprite = this.add.sprite(it.x, it.y, tex);
        sprite.setScale(invBake * 0.95);
        sprite.setDepth(26);

        const label = this.add
          .text(it.x, it.y - 24, labelText, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '10px',
            fontStyle: '800',
            color: WEAPON_RARITY_COLORS[it.rarity],
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 3,
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5)
          .setDepth(46);

        entry = { sprite, label };
        this.worldItemSprites.set(it.id, entry);
      } else {
        if (entry.sprite.texture.key !== tex) {
          entry.sprite.setTexture(tex);
        }
        if (entry.label.text !== labelText) {
          entry.label.setText(labelText);
        }
      }

      const bobY = Math.sin(sim.tick * 0.08 + it.id) * 2.5;
      entry.sprite.setPosition(it.x, it.y + bobY);
      entry.label.setPosition(it.x, it.y - 24 + bobY * 0.5);
      entry.label.setVisible(!(sim.inHub && previewOpen) && it.id !== comparedWeaponItemId);
    }

    for (const [id, entry] of this.worldItemSprites.entries()) {
      if (!this.activeWorldItemIds.has(id)) {
        entry.sprite.destroy();
        entry.label.destroy();
        this.worldItemSprites.delete(id);
      }
    }

    // 4. NPCs (Merchant & Ancient Shrine)
    this.activeNpcIds.clear();
    for (let i = 0; i < sim.npcEntities.length; i++) {
      const npc = sim.npcEntities[i]!;
      this.activeNpcIds.add(npc.id);

      let entry = this.npcVisuals.get(npc.id);
      if (!entry) {
        if (npc.kind === 'merchant') {
          const rig = new CutoutRig(this, npc.x, npc.y + RIG_FOOT_OFFSET_Y, MERCHANT_RIG_DEF, {
            displayScale: 1.08,
          });
          rig.container.setDepth(27);
          const label = this.add
            .text(npc.x, npc.y - 38, i18n.t('ui.hud.merchantName'), {
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: '11px',
              fontStyle: '800',
              color: PALETTE.SOLAR_GOLD,
              stroke: PALETTE.INK_DEEP,
              strokeThickness: 3,
              resolution: textRes,
            })
            .setOrigin(0.5, 0.5)
            .setDepth(46);
          entry = { rig, label };
        } else {
          const sprite = this.add.sprite(npc.x, npc.y, 'prop_shrine_statue');
          sprite.setScale(invBake);
          sprite.setDepth(24);
          const label = this.add
            .text(npc.x, npc.y - 42, i18n.t('ui.hud.shrineActive'), {
              fontFamily: '"Be Vietnam Pro", sans-serif',
              fontSize: '11px',
              fontStyle: '800',
              color: PALETTE.CYAN_FROST,
              stroke: PALETTE.INK_DEEP,
              strokeThickness: 3,
              resolution: textRes,
            })
            .setOrigin(0.5, 0.5)
            .setDepth(46);
          entry = { sprite, label };
        }
        this.npcVisuals.set(npc.id, entry);
      }

      if (entry.rig) {
        entry.rig.update(dtSec);
        if (npc.kind === 'merchant') {
          const mTxt = i18n.t('ui.hud.merchantName');
          if (entry.label.text !== mTxt) entry.label.setText(mTxt);
        }
      }
      if (npc.kind === 'shrine') {
        const shrineTxt = npc.interacted
          ? i18n.t('ui.hud.shrineUsed')
          : i18n.t('ui.hud.shrineActive');
        if (entry.label.text !== shrineTxt) {
          entry.label.setText(shrineTxt);
          entry.label.setColor(npc.interacted ? PALETTE.ASH_GRAY : PALETTE.CYAN_FROST);
        }
        entry.label.setPosition(npc.x, npc.y - 42);
      }
    }

    for (const [id, entry] of this.npcVisuals.entries()) {
      if (!this.activeNpcIds.has(id)) {
        entry.rig?.destroy();
        entry.sprite?.destroy();
        entry.label.destroy();
        this.npcVisuals.delete(id);
      }
    }

    // 5. Floor Transition Portal (or Hub Departure Portal)
    if (sim.portalActive) {
      if (!this.portalSprite) {
        this.portalSprite = this.add.sprite(sim.portalX, sim.portalY, 'portal_active');
        this.portalSprite.setDepth(19);
      }
      const portalText = sim.inHub
        ? sim.areAllPlayersReady()
          ? i18n.t('ui.hud.portalHubReady')
          : i18n.t('ui.hud.portalHubWait')
        : i18n.t('ui.hud.portalNextFloor');
      if (!this.portalLabel) {
        this.portalLabel = this.add
          .text(sim.portalX, sim.portalY - 38, portalText, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '11px',
            fontStyle: '800',
            color: PALETTE.ELECTRIC_VIOLET,
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 3.5,
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5)
          .setDepth(46);
      } else if (this.portalLabel.text !== portalText) {
        this.portalLabel.setText(portalText);
      }
      this.portalSprite.setVisible(true);
      this.portalSprite.setPosition(sim.portalX, sim.portalY);
      this.portalSprite.setScale(invBake * (1 + Math.sin(sim.tick * 0.1) * 0.06));
      this.portalSprite.setRotation(sim.tick * 0.03);

      this.portalLabel.setVisible(
        !(sim.inHub && initGlobalDebugState().hubPreviewCharacterId !== null),
      );
      this.portalLabel.setPosition(sim.portalX, sim.portalY - 38);
    } else {
      this.portalSprite?.setVisible(false);
      this.portalLabel?.setVisible(false);
    }
  }

  private updateCameraWithLookaheadAndShake(
    playerX: number,
    playerY: number,
    cursorWorldX: number,
    cursorWorldY: number,
    dtSec: number,
  ): void {
    const cam = this.cameras.main;
    const map = this.transport.getSim().map;

    // 22% cursor lookahead (clamped to max 72 world units so camera never swings wildly)
    const rawOffsetX = (cursorWorldX - playerX) * 0.22;
    const rawOffsetY = (cursorWorldY - playerY) * 0.22;
    const offsetLen = Math.hypot(rawOffsetX, rawOffsetY);
    const maxLookahead = 72;
    const scale = offsetLen > maxLookahead ? maxLookahead / offsetLen : 1;

    const targetX = playerX + rawOffsetX * scale;
    const targetY = playerY + rawOffsetY * scale;

    this.camFocusX = dampLerp(this.camFocusX, targetX, 14, dtSec);
    this.camFocusY = dampLerp(this.camFocusY, targetY, 14, dtSec);

    const halfW = WORLD_VIEW_WIDTH / 2;
    const halfH = WORLD_VIEW_HEIGHT / 2;
    const clampedX = clamp(this.camFocusX, halfW - 32, Math.max(halfW, map.width - halfW + 32));
    const clampedY = clamp(this.camFocusY, halfH - 32, Math.max(halfH, map.height - halfH + 32));

    const shake = this.fx.computeCameraShakeOffset(dtSec);
    this.lastShakeX = shake.offsetX;
    this.lastShakeY = shake.offsetY;
    cam.centerOn(clampedX + shake.offsetX, clampedY + shake.offsetY);

    // Pin HUD container to camera worldView origin
    const view = cam.worldView;
    if (view && view.width > 0) {
      this.hudContainer.setPosition(view.x, view.y);
    }
  }

  private renderTelegraphsAndShield(playerX: number, playerY: number): void {
    const sim = this.transport.getSim();
    const p = sim.player;
    const isStress = sim.stressTestActive;
    if (isStress && sim.tick % 4 !== 0) {
      return;
    }
    const g = this.telegraphGraphics;
    g.clear();
    const view = this.cameras.main.worldView;
    const hasView = view && view.width > 0;
    const viewLeft = hasView ? view.x - 48 : -9999;
    const viewRight = hasView ? view.x + view.width + 48 : 9999;
    const viewTop = hasView ? view.y - 48 : -9999;
    const viewBottom = hasView ? view.y + view.height + 48 : 9999;
    const hudSafeTop = hasView ? view.y + 72 : 72;
    const hudSafeBottom = hasView ? view.y + view.height - 62 : 478;

    // 0a. Hub Campfire & Statue Pedestals (Doanh Trại)
    if (sim.inHub) {
      for (let i = 0; i < sim.hubStatues.length; i++) {
        const st = sim.hubStatues[i]!;
        const isCurrent = p.characterId === st.characterId;
        g.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.92);
        g.lineStyle(2.5, hexToNum(isCurrent ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD), 0.9);
        g.fillEllipse(st.x, st.y + 12, 42, 18);
        g.strokeEllipse(st.x, st.y + 12, 42, 18);
      }

      // Central Campfire
      const fireX = sim.map.width * 0.5;
      const fireY = sim.map.height * 0.5 + 32;
      const flicker = Math.sin(sim.tick * 0.22) * 3;
      g.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.95);
      g.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
      g.fillCircle(fireX, fireY + 4, 18);
      g.strokeCircle(fireX, fireY + 4, 18);
      g.fillStyle(hexToNum(PALETTE.FLAME_ORANGE), 0.85);
      g.fillCircle(fireX, fireY, 12 + flicker * 0.4);
      g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 0.95);
      g.fillCircle(fireX, fireY - 2, 7 - flicker * 0.25);
    }

    // 0b. Rarity Light Pillars for Chests & World Weapon Drops (instanced)
    for (let i = 0; i < sim.chests.length; i++) {
      const ch = sim.chests[i]!;
      const col = hexToNum(WEAPON_RARITY_COLORS[ch.rarity]);
      const beamH = ch.opened ? 72 : 46;
      const beamAlpha = ch.opened ? 0.24 : 0.14;
      g.fillStyle(col, beamAlpha);
      g.fillRect(ch.x - 12, ch.y - beamH, 24, beamH);
      g.lineStyle(2, col, ch.opened ? 0.9 : 0.65);
      g.strokeCircle(ch.x, ch.y + 6, 18);
    }

    for (let i = 0; i < sim.worldItems.length; i++) {
      const it = sim.worldItems[i]!;
      if (it.pickedUp) continue;
      if (it.ownerPlayerId !== undefined && it.ownerPlayerId !== 0 && it.ownerPlayerId !== p.id) {
        continue;
      }
      const col = hexToNum(WEAPON_RARITY_COLORS[it.rarity]);
      g.fillStyle(col, 0.22);
      g.fillRect(it.x - 8, it.y - 54, 16, 54);
      g.lineStyle(2, col, 0.88);
      g.strokeCircle(it.x, it.y + 6, 14);
    }

    // 1. Active Skills & Co-op Downed / Revive Circles for all players
    const allPlayers = sim.getAllPlayers();
    for (let i = 0; i < allPlayers.length; i++) {
      const pl = allPlayers[i]!;
      let px = pl.x;
      let py = pl.y;
      if (pl.id === p.id) {
        px = playerX;
        py = playerY;
      } else {
        const interp = this.transport.getInterpolatedSimPlayerPos(pl, this.entityPosScratch);
        px = interp.x;
        py = interp.y;
      }

      if (pl.lifeState === 'downed') {
        const pulseR = 24 + Math.sin(sim.tick * 0.2) * 3;
        g.fillStyle(hexToNum(PALETTE.RUBY_DARK), 0.35);
        g.fillCircle(px, py + 4, pulseR);
        g.lineStyle(2.5, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.9);
        g.strokeCircle(px, py + 4, pulseR);

        if (pl.reviveProgress > 0) {
          g.lineStyle(4, hexToNum(PALETTE.LIME_GLOW), 1);
          g.beginPath();
          g.arc(
            px,
            py + 4,
            pulseR + 4,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * clamp(pl.reviveProgress, 0, 1),
            false,
          );
          g.strokePath();
        }
      }

      if (pl.skillActiveTimer > 0) {
        if (pl.characterId === 'vanguard') {
          const halfArc = sim.activeBuffIds.includes('vanguard_fortress')
            ? Math.PI
            : (60 * Math.PI) / 180;
          const startA = pl.aimAngle - halfArc;
          const endA = pl.aimAngle + halfArc;
          const r = sim.activeBuffIds.includes('vanguard_fortress') ? 32 : 38;

          g.lineStyle(7, hexToNum(PALETTE.INK_DARK), 0.85);
          g.beginPath();
          g.arc(px, py, r, startA, endA, false);
          g.strokePath();

          g.lineStyle(4, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.95);
          g.beginPath();
          g.arc(px, py, r, startA, endA, false);
          g.strokePath();

          g.lineStyle(2, hexToNum(PALETTE.SOLAR_GOLD), 0.9);
          g.beginPath();
          g.arc(px, py, r - 4, startA, endA, false);
          g.strokePath();
        }
      }
    }

    // 1a. Phase 5 Elementalist Skill Zones (Vùng Cầu Nguyên Tố + Xoáy Nguyên Tố)
    for (let i = 0; i < sim.skillZones.length; i++) {
      const z = sim.skillZones[i]!;
      if (z.ttlSec <= 0) continue;
      const elHex =
        z.element === 'burn'
          ? PALETTE.FLAME_ORANGE
          : z.element === 'chill'
            ? PALETTE.CYAN_FROST
            : PALETTE.VOLT_YELLOW;
      const col = hexToNum(elHex);
      const pulse = Math.sin(sim.tick * 0.16 + z.id) * 3;

      g.fillStyle(col, 0.15);
      g.fillCircle(z.x, z.y, z.radius + pulse);
      g.lineStyle(2.5, col, 0.88);
      g.strokeCircle(z.x, z.y, z.radius + pulse);

      if (z.vortex) {
        g.lineStyle(1.8, hexToNum(PALETTE.BONE_WHITE), 0.55);
        g.strokeCircle(z.x, z.y, z.radius * 0.62 - pulse);
      }

      // Floating elemental orb core
      g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.9);
      g.fillCircle(z.x, z.y, 11);
      g.fillStyle(col, 0.95);
      g.fillCircle(z.x, z.y, 8);
      g.fillStyle(hexToNum(PALETTE.BONE_WHITE), 0.9);
      g.fillCircle(z.x - 2, z.y - 2, 3);
    }

    // 1b. Phase 5 Summoned Entities (Druid Sacred Tree & Engineer Tesla / Ancient Turrets)
    for (let i = 0; i < sim.summons.length; i++) {
      const sum = sim.summons[i]!;
      if (sum.hp <= 0 || sum.ttlSec <= 0) continue;

      if (sum.kind === 'sacred_tree') {
        const pulse = Math.sin(sim.tick * 0.12 + sum.id) * 3;
        g.fillStyle(hexToNum(PALETTE.LIME_GLOW), 0.12);
        g.fillCircle(sum.x, sum.y, sum.auraRadius + pulse);
        g.lineStyle(2.2, hexToNum(PALETTE.LIME_GLOW), 0.82);
        g.strokeCircle(sum.x, sum.y, sum.auraRadius + pulse);

        // Tree trunk & glowing emerald canopy
        g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
        g.fillCircle(sum.x, sum.y, 20);
        g.fillStyle(hexToNum(PALETTE.LEATHER_MID), 1);
        g.fillRoundedRect(sum.x - 6, sum.y - 4, 12, 18, 3);
        g.fillStyle(hexToNum(PALETTE.GOBLIN_GREEN), 0.98);
        g.fillCircle(sum.x, sum.y - 8, 16);
        g.fillStyle(hexToNum(PALETTE.LIME_GLOW), 0.95);
        g.fillCircle(sum.x - 4, sum.y - 11, 9);
        g.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
        g.strokeCircle(sum.x, sum.y - 8, 16);
      } else if (sum.kind === 'life_blossom') {
        // Phase 6 Co-op Weapon: Súng Hạt Giống (seed_gun) blooming Life Blossom
        const pulse = Math.sin(sim.tick * 0.18 + sum.id) * 2.5;
        g.fillStyle(hexToNum(PALETTE.MINT_LIGHT), 0.14);
        g.fillCircle(sum.x, sum.y, sum.auraRadius + pulse);
        g.lineStyle(2, hexToNum(PALETTE.LIME_GLOW), 0.85);
        g.strokeCircle(sum.x, sum.y, sum.auraRadius + pulse);

        g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
        g.fillCircle(sum.x, sum.y, 14);
        g.fillStyle(hexToNum(PALETTE.LIME_GLOW), 0.95);
        g.fillCircle(sum.x, sum.y, 11);
        g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 1);
        g.fillCircle(sum.x, sum.y, 5);
      } else {
        // Tesla Turret / Ancient Turret
        const isAncient = sum.kind === 'ancient_turret';
        const auraCol = hexToNum(isAncient ? PALETTE.SOLAR_GOLD : PALETTE.CYAN_FROST);
        g.fillStyle(auraCol, 0.08);
        g.fillCircle(sum.x, sum.y, sum.auraRadius);
        g.lineStyle(1.6, auraCol, 0.55);
        g.strokeCircle(sum.x, sum.y, sum.auraRadius);

        // Turret base + rotating barrel
        g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
        g.fillCircle(sum.x, sum.y, 16);
        g.fillStyle(hexToNum(PALETTE.STEEL_DARK), 1);
        g.fillCircle(sum.x, sum.y, 13);
        g.fillStyle(hexToNum(isAncient ? PALETTE.SOLAR_GOLD : PALETTE.BRASS_CORE), 1);
        g.fillCircle(sum.x, sum.y, 8);

        const barrelAng = this.time.now * 0.002 + sum.id;
        const bx = sum.x + Math.cos(barrelAng) * 16;
        const by = sum.y + Math.sin(barrelAng) * 16;
        g.lineStyle(6, hexToNum(PALETTE.INK_DARK), 1);
        g.beginPath();
        g.moveTo(sum.x, sum.y);
        g.lineTo(bx, by);
        g.strokePath();
        g.lineStyle(3.2, hexToNum(PALETTE.STEEL_LIGHT), 1);
        g.beginPath();
        g.moveTo(sum.x, sum.y);
        g.lineTo(bx, by);
        g.strokePath();

        // EMP Charge Arc around Tesla Turret (Co-op Synergy indicator)
        if (sum.charge > 0) {
          g.lineStyle(3, hexToNum(PALETTE.VOLT_YELLOW), 0.95);
          g.beginPath();
          g.arc(
            sum.x,
            sum.y,
            19,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * clamp(sum.charge / 100, 0, 1),
            false,
          );
          g.strokePath();
        }
      }

      // Mini TTL / HP bar above summon
      const barW = 28;
      const barY = sum.y - 28;
      const ttlRatio = clamp(sum.ttlSec / Math.max(1, sum.maxTtlSec), 0, 1);
      g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.9);
      g.fillRect(sum.x - barW / 2 - 1, barY - 1, barW + 2, 5);
      g.fillStyle(
        hexToNum(
          sum.kind === 'sacred_tree' || sum.kind === 'life_blossom'
            ? PALETTE.LIME_GLOW
            : PALETTE.VOLT_YELLOW,
        ),
        1,
      );
      g.fillRect(sum.x - barW / 2, barY, Math.max(2, barW * ttlRatio), 3);
    }

    // 1c. Contextual Ping World Rings
    for (let i = 0; i < sim.pings.length; i++) {
      const ping = sim.pings[i]!;
      const col = hexToNum(PLAYER_SLOT_COLORS[ping.playerSlot]);
      const waveR = 14 + ((sim.tick * 0.8) % 18);
      g.fillStyle(col, 0.22);
      g.fillCircle(ping.x, ping.y, 12);
      g.lineStyle(2.5, col, 0.95);
      g.strokeCircle(ping.x, ping.y, waveR);
      g.strokeCircle(ping.x, ping.y, 8);
    }

    // 1d. Phase 6 Co-op Dual Pressure Plates & Pushable Stone Blocks
    for (let i = 0; i < sim.pressurePlates.length; i++) {
      const plate = sim.pressurePlates[i]!;
      const isPressed = plate.pressed || sim.coopPuzzleCompleted;
      const plateCol = hexToNum(isPressed ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD);
      g.fillStyle(hexToNum(isPressed ? PALETTE.FOREST_SHADE : PALETTE.SLATE_DARK), 0.92);
      g.lineStyle(2.5, plateCol, 0.95);
      g.fillRoundedRect(plate.x - 18, plate.y - 18, 36, 36, 6);
      g.strokeRoundedRect(plate.x - 18, plate.y - 18, 36, 36, 6);
      g.fillStyle(plateCol, isPressed ? 0.95 : 0.45);
      g.fillCircle(plate.x, plate.y, 8);
    }

    for (let i = 0; i < sim.pushBlocks.length; i++) {
      const blk = sim.pushBlocks[i]!;
      g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
      g.fillRoundedRect(blk.x - 17, blk.y - 17, 34, 34, 5);
      g.fillStyle(hexToNum(PALETTE.WARM_STONE), 1);
      g.lineStyle(2.5, hexToNum(PALETTE.SOLAR_GOLD), 0.95);
      g.fillRoundedRect(blk.x - 15, blk.y - 15, 30, 30, 4);
      g.strokeRoundedRect(blk.x - 15, blk.y - 15, 30, 30, 4);
      g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 0.95);
      g.fillCircle(blk.x, blk.y, 5);
    }

    // 1e. Phase 6 Co-op Tether Staff Energy Beams (tether_staff)
    for (let i = 0; i < sim.tetherBeams.length; i++) {
      const beam = sim.tetherBeams[i]!;
      if (beam.ttlSec <= 0) continue;
      g.lineStyle(7, hexToNum(PALETTE.ELECTRIC_VIOLET), 0.45);
      g.beginPath();
      g.moveTo(beam.x1, beam.y1);
      g.lineTo(beam.x2, beam.y2);
      g.strokePath();

      g.lineStyle(3.2, hexToNum(PALETTE.CYAN_FROST), 0.95);
      g.beginPath();
      g.moveTo(beam.x1, beam.y1);
      g.lineTo(beam.x2, beam.y2);
      g.strokePath();
    }

    // 1f. Phase 6 Boss Forge Titan Expanding Shockwave Rings (Dash through with i-frames!)
    for (let i = 0; i < sim.shockwaveRings.length; i++) {
      const ring = sim.shockwaveRings[i]!;
      g.lineStyle(ring.thickness * 0.55, hexToNum(PALETTE.FLAME_ORANGE), 0.45);
      g.strokeCircle(ring.x, ring.y, ring.radius);
      g.lineStyle(3.5, hexToNum(PALETTE.SOLAR_GOLD), 0.95);
      g.strokeCircle(ring.x, ring.y, ring.radius);
    }

    // 1g. Phase 6 Boss Kryssa Ice Prison Crystalline Cage around encased players
    const allPl = sim.getAllPlayers();
    for (let i = 0; i < allPl.length; i++) {
      const pl = allPl[i]!;
      if ((pl.encasedInIceTimer ?? 0) > 0 && pl.lifeState === 'alive') {
        g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 0.36);
        g.lineStyle(3, hexToNum(PALETTE.ICE_WHITE), 0.95);
        g.fillRoundedRect(pl.x - 19, pl.y - 24, 38, 42, 7);
        g.strokeRoundedRect(pl.x - 19, pl.y - 24, 38, 42, 7);
      }
    }

    // 2. Enemy Spawn Circles, Attack Telegraphs, Boss Burrow Warning, Elite Aura & Mini HP Bars
    let hpBarsDrawn = 0;
    let telegraphsDrawn = 0;
    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0) continue;

      // Boss Phase 2 Burrow Telegraph Circle on floor under target position
      if (e.bossBurrowed) {
        const r = e.telegraphRadius || 84;
        const progress =
          e.telegraphDurationSec > 0 ? 1 - clamp(e.stateTimer / e.telegraphDurationSec, 0, 1) : 1;
        g.fillStyle(hexToNum(PALETTE.CRIMSON_BRIGHT), 0.22 + progress * 0.22);
        g.fillCircle(e.bossTargetX, e.bossTargetY, r * (0.3 + progress * 0.7));
        g.lineStyle(3, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.95);
        g.strokeCircle(e.bossTargetX, e.bossTargetY, r);
        continue;
      }

      const pos = this.transport.getInterpolatedEnemyPos(e, this.entityPosScratch);
      if (pos.x < viewLeft || pos.x > viewRight || pos.y < viewTop || pos.y > viewBottom) {
        continue;
      }

      // 0.8s Magic Summoning Circle on Floor
      if (e.aiState === 'spawning') {
        const progress = 1 - clamp(e.stateTimer / ENEMY_SPAWN_WARMUP_SEC, 0, 1);
        const r = e.radius + 8;
        g.fillStyle(hexToNum(PALETTE.ELECTRIC_VIOLET), 0.22 * progress);
        g.fillCircle(pos.x, pos.y, r * progress);
        g.lineStyle(2.2, hexToNum(PALETTE.ELECTRIC_VIOLET), 0.9);
        g.strokeCircle(pos.x, pos.y, r);
        continue;
      }

      // Directional Front Shield Arc for Ice Golem & Iron Shielder (must flank behind!)
      const eStats = ENEMIES[e.defId];
      if (eStats?.frontShieldReduction && !isStress) {
        const halfArc = Math.PI * 0.4;
        const shieldR = e.radius + 6;
        const shieldHex = e.defId === 'ice_golem' ? PALETTE.CYAN_FROST : PALETTE.STEEL_LIGHT;
        g.lineStyle(5, hexToNum(PALETTE.INK_DARK), 0.88);
        g.beginPath();
        g.arc(pos.x, pos.y, shieldR, e.aimAngle - halfArc, e.aimAngle + halfArc, false);
        g.strokePath();
        g.lineStyle(3, hexToNum(shieldHex), 0.95);
        g.beginPath();
        g.arc(pos.x, pos.y, shieldR, e.aimAngle - halfArc, e.aimAngle + halfArc, false);
        g.strokePath();
      }

      // Boss Overload Stun Ring (Forge Titan when both energy cores are broken)
      if (e.aiState === 'stunned' && e.stateTimer > 0) {
        g.lineStyle(3.5, hexToNum(PALETTE.VOLT_YELLOW), 0.95);
        g.strokeCircle(pos.x, pos.y, e.radius + 10 + Math.sin(sim.tick * 0.3) * 3);
      }

      // Elite Golden-Violet Aura Ring & Shield Barrier
      if (e.isElite && !isStress) {
        g.lineStyle(2.5, hexToNum(PALETTE.SOLAR_GOLD), 0.85);
        g.strokeCircle(pos.x, pos.y + 4, e.radius + 5);
        if (e.shieldArmor > 0) {
          g.lineStyle(2, hexToNum(PALETTE.CYAN_FROST), 0.92);
          g.strokeCircle(pos.x, pos.y, e.radius + 8);
        }
      }

      // Frozen encasement crystal ring
      if (e.frozenTimer > 0 && (!isStress || telegraphsDrawn < 6)) {
        g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 0.28);
        g.fillCircle(pos.x, pos.y, e.radius + 5);
        g.lineStyle(2.2, hexToNum(PALETTE.BONE_WHITE), 0.9);
        g.strokeCircle(pos.x, pos.y, e.radius + 5);
      }

      // Druid Rooted vines ring around enemy feet
      if (e.rootedTimer > 0 && !isStress) {
        g.lineStyle(2.5, hexToNum(PALETTE.LIME_GLOW), 0.92);
        g.strokeEllipse(pos.x, pos.y + 8, e.radius * 2.1, e.radius * 1.1);
      }

      // Superconduct defense-shred aura ring
      if (e.superconductTimer > 0 && !isStress) {
        g.lineStyle(2, hexToNum(PALETTE.ELECTRIC_VIOLET), 0.9);
        g.strokeCircle(pos.x, pos.y, e.radius + 6);
      }

      // Ranger Predator Mark Crosshair above enemy (visible through Fog of War!)
      if (e.markedTimer > 0 && !isStress) {
        const markY = pos.y - (e.isBoss ? 54 : 40);
        g.lineStyle(2.2, hexToNum(PALETTE.SOLAR_GOLD), 0.95);
        g.strokeCircle(pos.x, markY, 6);
        g.beginPath();
        g.moveTo(pos.x - 9, markY);
        g.lineTo(pos.x + 9, markY);
        g.moveTo(pos.x, markY - 9);
        g.lineTo(pos.x, markY + 9);
        g.strokePath();
      }

      // Enemy Attack Telegraphs (Section 3.7: high readability red warning before damage)
      if (e.aiState === 'telegraph' && (!isStress || telegraphsDrawn < 4)) {
        telegraphsDrawn += 1;
        const progress =
          e.telegraphDurationSec > 0 ? 1 - clamp(e.stateTimer / e.telegraphDurationSec, 0, 1) : 1;

        if (e.defId === 'goblin_shooter' || e.defId === 'frost_bat') {
          const spreadRad = (15 * Math.PI) / 180;
          for (const mult of [-1, 0, 1]) {
            const ang = e.telegraphAngle + mult * spreadRad;
            const len = 240;
            const tx = pos.x + Math.cos(ang) * len;
            const ty = pos.y + Math.sin(ang) * len;
            g.lineStyle(2.5, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.45 + progress * 0.5);
            g.beginPath();
            g.moveTo(pos.x, pos.y);
            g.lineTo(tx, ty);
            g.strokePath();
          }
        } else if (
          e.defId === 'kryssa_ice_queen' ||
          e.defId === 'kryssa_clone' ||
          e.defId === 'ice_mage'
        ) {
          const len = e.telegraphLength || 320;
          const tx = pos.x + Math.cos(e.telegraphAngle) * len;
          const ty = pos.y + Math.sin(e.telegraphAngle) * len;
          g.lineStyle(6, hexToNum(PALETTE.CYAN_FROST), 0.35 + progress * 0.35);
          g.beginPath();
          g.moveTo(pos.x, pos.y);
          g.lineTo(tx, ty);
          g.strokePath();
          g.lineStyle(2.2, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.65 + progress * 0.35);
          g.beginPath();
          g.moveTo(pos.x, pos.y);
          g.lineTo(tx, ty);
          g.strokePath();
        } else if (
          e.defId === 'goblin_shaman' ||
          e.defId === 'green_slime' ||
          e.defId === 'mini_slime' ||
          e.defId === 'fire_imp' ||
          e.defId === 'iron_shielder' ||
          e.defId === 'welder_drone'
        ) {
          const len = e.telegraphLength || 160;
          const tx = pos.x + Math.cos(e.telegraphAngle) * len;
          const ty = pos.y + Math.sin(e.telegraphAngle) * len;
          g.lineStyle(2.2, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.5 + progress * 0.45);
          g.beginPath();
          g.moveTo(pos.x, pos.y);
          g.lineTo(tx, ty);
          g.strokePath();
        } else if (e.defId === 'thorn_turret') {
          for (let k = 0; k < 6; k++) {
            const ang = e.telegraphAngle + (k * Math.PI) / 3;
            const len = 180;
            g.lineStyle(2, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.45 + progress * 0.45);
            g.beginPath();
            g.moveTo(pos.x, pos.y);
            g.lineTo(pos.x + Math.cos(ang) * len, pos.y + Math.sin(ang) * len);
            g.strokePath();
          }
        } else if (e.defId === 'wild_boar' || e.defId === 'baby_yeti') {
          const len = e.telegraphLength || 220;
          const halfW = e.radius;
          const cos = Math.cos(e.telegraphAngle);
          const sin = Math.sin(e.telegraphAngle);
          const px = -sin * halfW;
          const py = cos * halfW;

          const p1 = { x: pos.x + px, y: pos.y + py };
          const p2 = { x: pos.x + cos * len + px, y: pos.y + sin * len + py };
          const p3 = { x: pos.x + cos * len - px, y: pos.y + sin * len - py };
          const p4 = { x: pos.x - px, y: pos.y - py };

          g.fillStyle(hexToNum(PALETTE.CRIMSON_BRIGHT), 0.18 + progress * 0.22);
          g.beginPath();
          g.moveTo(p1.x, p1.y);
          g.lineTo(p2.x, p2.y);
          g.lineTo(p3.x, p3.y);
          g.lineTo(p4.x, p4.y);
          g.closePath();
          g.fillPath();

          g.lineStyle(2, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.85);
          g.strokePath();
        } else if (
          e.defId === 'spore_bomber' ||
          e.defId === 'spore_king' ||
          e.defId === 'snow_spirit' ||
          e.defId === 'ice_golem' ||
          e.defId === 'dwarf_cannon' ||
          e.defId === 'coal_golem' ||
          e.defId === 'forge_titan'
        ) {
          const r = e.telegraphRadius || (e.isBoss ? 96 : 68);
          g.fillStyle(hexToNum(PALETTE.CRIMSON_BRIGHT), 0.16 + progress * 0.24);
          g.fillCircle(pos.x, pos.y, r * (0.35 + progress * 0.65));
          g.lineStyle(2.5, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.92);
          g.strokeCircle(pos.x, pos.y, r);
        }
      }

      // Floating HP bar above non-dummy enemies or enemies with active elemental status (clipped to HUD safe bounds)
      const hasStatus =
        e.burnTimer > 0 ||
        e.chillStacks > 0 ||
        e.frozenTimer > 0 ||
        e.poisonStacks > 0 ||
        e.shockTimer > 0 ||
        e.markedTimer > 0 ||
        e.superconductTimer > 0 ||
        e.rootedTimer > 0;
      const barY = pos.y - (e.isBoss ? 44 : 30);
      if (
        barY - 8 >= hudSafeTop &&
        barY + 8 <= hudSafeBottom &&
        ((!e.isDummy && e.hp < e.maxHp) || hasStatus || e.isElite) &&
        (!isStress || hpBarsDrawn < 8)
      ) {
        this.drawEnemyHealthAndStatusBar(g, pos.x, barY, e);
        hpBarsDrawn += 1;
      }
    }
  }

  private drawEnemyHealthAndStatusBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    e: SimEnemyState,
  ): void {
    const w = e.isBoss ? 52 : e.isElite ? 36 : 28;
    const h = e.isBoss ? 6 : 5;
    const ratio = clamp(e.hp / e.maxHp, 0, 1);

    g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.9);
    g.fillRoundedRect(x - w / 2 - 1, y - 1, w + 2, h + 2, 2);

    g.fillStyle(
      hexToNum(
        e.frozenTimer > 0
          ? PALETTE.CYAN_FROST
          : e.isElite
            ? PALETTE.SOLAR_GOLD
            : PALETTE.CRIMSON_BRIGHT,
      ),
      1,
    );
    g.fillRoundedRect(x - w / 2, y, Math.max(2, w * ratio), h, 1.5);

    if (e.shieldArmor > 0 && e.maxShieldArmor > 0) {
      const sRatio = clamp(e.shieldArmor / e.maxShieldArmor, 0, 1);
      g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 0.95);
      g.fillRect(x - w / 2, y - 3, Math.max(2, w * sRatio), 2);
    }

    // Elemental status pips above HP bar
    let pipX = x - 12;
    const pipY = y - 6;
    if (e.burnTimer > 0) {
      g.fillStyle(hexToNum(PALETTE.FLAME_ORANGE), 1);
      g.fillCircle(pipX, pipY, 2.5);
      pipX += 6;
    }
    if (e.frozenTimer > 0 || e.chillStacks > 0) {
      g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 1);
      g.fillCircle(pipX, pipY, e.frozenTimer > 0 ? 3.2 : 2.5);
      pipX += 6;
    }
    if (e.shockTimer > 0) {
      g.fillStyle(hexToNum(PALETTE.VOLT_YELLOW), 1);
      g.fillCircle(pipX, pipY, 2.5);
      pipX += 6;
    }
    if (e.poisonStacks > 0) {
      g.fillStyle(hexToNum(PALETTE.TOXIC_PURPLE), 1);
      g.fillCircle(pipX, pipY, 2.5);
      pipX += 6;
    }
    if (e.superconductTimer > 0) {
      g.fillStyle(hexToNum(PALETTE.ELECTRIC_VIOLET), 1);
      g.fillCircle(pipX, pipY, 2.5);
      pipX += 6;
    }
    if (e.markedTimer > 0) {
      g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 1);
      g.fillCircle(pipX, pipY, 2.8);
    }
  }

  private renderHitboxesIfEnabled(): void {
    const debug = initGlobalDebugState();
    if (!debug.showHitboxes) return;

    const g = this.hitboxGraphics;
    g.clear();
    const sim = this.transport.getSim();

    // Spatial hash 64x64 grid lines
    g.lineStyle(1, 0x38bdf8, 0.18);
    for (let x = 0; x <= sim.map.width; x += 64) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, sim.map.height);
      g.strokePath();
    }
    for (let y = 0; y <= sim.map.height; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(sim.map.width, y);
      g.strokePath();
    }

    // Solid wall/pillar AABBs
    g.lineStyle(1.2, 0xfacc15, 0.45);
    for (const box of sim.map.solidBoxes) {
      g.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
    }

    // Player collision circle
    const pPos = this.transport.getInterpolatedPlayerPos(this.entityPosScratch);
    g.lineStyle(2, 0x4ade80, 0.95);
    g.strokeCircle(pPos.x, pPos.y, sim.player.radius);

    // Props collision circles
    g.lineStyle(1.8, 0xf97316, 0.9);
    for (const prop of sim.props) {
      if (prop.hp > 0) {
        g.strokeCircle(prop.x, prop.y, prop.radius);
      }
    }

    // Enemy collision circles
    g.lineStyle(2, 0xfb7185, 0.95);
    for (const e of sim.enemies) {
      if (e.hp > 0) {
        const ePos = this.transport.getInterpolatedEnemyPos(e, this.entityPosScratch);
        g.strokeCircle(ePos.x, ePos.y, e.radius);
      }
    }

    // Projectile collision circles
    g.lineStyle(1.5, 0x22d3ee, 0.9);
    for (const b of sim.projectiles) {
      const bPos = this.transport.getInterpolatedProjectilePos(b, this.entityPosScratch);
      g.strokeCircle(bPos.x, bPos.y, b.radius);
    }
  }

  private updateVectorHud(): void {
    const sim = this.transport.getSim();
    const p = sim.player;
    const curLocale = i18n.getLocale();
    if (curLocale !== this.lastHudLocale) {
      this.lastHudLocale = curLocale;
      this.invalidateAllHudCaches();
    }

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

    if (
      sim.tick % 12 === 0 ||
      sim.inHub ||
      !this.lastHudStatsText ||
      this.lastHudStatsText.includes(VIETNAMESE_VERIFICATION_STRING) !== sim.inHub
    ) {
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

      const nextStats = sim.inHub
        ? `${i18n.t('ui.hud.hubStatsHint', { count: sim.getActivePlayerCount() })} | ${VIETNAMESE_VERIFICATION_STRING}`
        : `${i18n.t('ui.hud.floor')} ${sim.currentFloor}/${sim.campaignMaxFloors} (${roomLabel}) · DPS ${dps.toFixed(1)} · ${i18n.t('ui.hud.gold')} ${p.gold} · ${i18n.t('ui.hud.wave')} ${sim.waveNumber} · Dash ${dashReady} · ${skShort} ${skillReady}${cycleTag}${comboTag}`;
      if (nextStats !== this.lastHudStatsText) {
        this.lastHudStatsText = nextStats;
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

  private updateCoopTeammateHud(): void {
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

  private updateHubInvitePanel(): void {
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
        this.readyToggleQueued = true;
        if (this.room && this.coopMode !== 'solo') {
          this.room.send('set_ready', { ready: !sim.player.ready });
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
      { id: 1, key: '1' },
      { id: 2, key: '2' },
      { id: 3, key: '3' },
      { id: 4, key: '4' },
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

  private updateHubCharacterSkillPreview(): void {
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

  private updateWeaponComparisonCard(): void {
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

  private updateOffscreenTeammateArrows(): void {
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

  private updateMinimapHud(): void {
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

  private updateBossHud(): void {
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

  private updateModalHud(): void {
    const sim = this.transport.getSim();
    if (sim.runState === 'playing' || sim.runState === 'buff_choice') {
      this.resultDismissed = false;
    }
    const statsSig =
      sim.runState === 'victory' || sim.runState === 'defeat'
        ? `${sim.runStats.kills}:${Math.round(sim.runStats.damageDealt)}:${sim.runStats.teamCombos}:${sim
            .getAllPlayers()
            .map(
              (pl) =>
                `${pl.id}:${Math.round(pl.statsDamageDealt ?? 0)}:${pl.statsKills ?? 0}:${pl.statsRevives ?? 0}`,
            )
            .join('|')}`
        : '';
    const modalKey = `${sim.runState}:${sim.pendingBuffChoices.join(',')}:${this.resultDismissed}:${i18n.getLocale()}:${statsSig}`;
    if (modalKey === this.lastRunState) return;
    const prevRunState = this.lastRunState.split(':')[0];
    this.lastRunState = modalKey;

    if (sim.runState === 'victory' && prevRunState !== 'victory') {
      zzfx.play('ui_victory');
    } else if (sim.runState === 'defeat' && prevRunState !== 'defeat') {
      zzfx.play('ui_defeat');
    }

    this.modalContainer.removeAll(true);
    const textRes = Math.min(TextureBaker.getBakeScale(), 3);

    if (sim.runState === 'buff_choice') {
      const bg = this.add.graphics();
      bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.92);
      bg.lineStyle(3, hexToNum(PALETTE.SOLAR_GOLD), 1);
      bg.fillRoundedRect(140, 110, 680, 310, 12);
      bg.strokeRoundedRect(140, 110, 680, 310, 12);
      this.modalContainer.add(bg);

      const header = this.add
        .text(480, 132, i18n.t('modal.buffChoiceTitle'), {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '15px',
          fontStyle: '800',
          color: PALETTE.SOLAR_GOLD,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 3.5,
          resolution: textRes,
        })
        .setOrigin(0.5, 0);
      this.modalContainer.add(header);

      sim.pendingBuffChoices.forEach((buffId: BuffId, idx: number) => {
        const bDef = FLOOR_BUFFS[buffId];
        if (!bDef) return;
        const buffTxt = i18n.getBuffText(buffId, bDef.nameVi, bDef.descriptionVi);
        const cardX = 166 + idx * 214;
        const cardY = 172;
        const cardW = 200;
        const cardH = 216;

        const cardG = this.add.graphics();
        cardG.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.96);
        cardG.lineStyle(2.5, hexToNum(PALETTE.CYAN_FROST), 1);
        cardG.fillRoundedRect(cardX, cardY, cardW, cardH, 9);
        cardG.strokeRoundedRect(cardX, cardY, cardW, cardH, 9);
        this.modalContainer.add(cardG);

        const title = this.add
          .text(cardX + cardW / 2, cardY + 22, `[${idx + 1}] ${buffTxt.name}`, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '13px',
            fontStyle: '800',
            color: PALETTE.SOLAR_GOLD,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 3,
            align: 'center',
            wordWrap: { width: cardW - 20 },
            resolution: textRes,
          })
          .setOrigin(0.5, 0);
        this.modalContainer.add(title);

        const desc = this.add
          .text(cardX + cardW / 2, cardY + 74, buffTxt.desc, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '11px',
            fontStyle: '600',
            color: PALETTE.BONE_WHITE,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 2.5,
            align: 'center',
            wordWrap: { width: cardW - 24 },
            resolution: textRes,
          })
          .setOrigin(0.5, 0);
        this.modalContainer.add(desc);

        const hit = this.add
          .rectangle(cardX + cardW / 2, cardY + cardH / 2, cardW, cardH, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => {
          sim.selectFloorBuff(buffId);
          if (this.room && this.coopMode !== 'solo') {
            this.room.send('select_buff', { buffId });
          }
          zzfx.play('skill_cast');
        });
        this.modalContainer.add(hit);
      });
    } else if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
      const isWin = sim.runState === 'victory';
      const biomeName = i18n.biomeName(sim.currentBiome);
      const px = 110;
      const py = 74;
      const pw = 740;
      const ph = 398;

      const bg = this.add.graphics();
      bg.fillStyle(hexToNum(PALETTE.INK_DARK), 0.78);
      bg.fillRect(-200, 68, 1360, 412);
      bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.96);
      bg.lineStyle(3, hexToNum(isWin ? PALETTE.SOLAR_GOLD : PALETTE.CRIMSON_BRIGHT), 1);
      bg.fillRoundedRect(px, py, pw, ph, 12);
      bg.strokeRoundedRect(px, py, pw, ph, 12);
      this.modalContainer.add(bg);

      const header = this.add
        .text(
          480,
          py + 12,
          isWin
            ? i18n.t('modal.victoryTitle', { biome: biomeName.toUpperCase() })
            : i18n.t('modal.defeatTitle', { biome: biomeName.toUpperCase() }),
          {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '15px',
            fontStyle: '800',
            color: isWin ? PALETTE.SOLAR_GOLD : PALETTE.CRIMSON_BRIGHT,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 3.5,
            resolution: textRes,
          },
        )
        .setOrigin(0.5, 0);
      this.modalContainer.add(header);

      const buffNames =
        sim.activeBuffIds.length > 0
          ? sim.activeBuffIds
              .map((b: BuffId) => {
                const def = FLOOR_BUFFS[b];
                return def ? i18n.getBuffText(b, def.nameVi, def.descriptionVi).name : b;
              })
              .join(', ')
          : i18n.t('ui.result.none');
      const activeWDef = WEAPONS[sim.getActiveWeaponId()] ?? WEAPONS.rusty_pistol!;
      const totalGoldEarned = Math.max(sim.runStats.goldEarned, sim.player.gold);
      const totalSec = Math.max(1, Math.round(sim.runStats.ticksElapsed / 60));
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      const timeStr = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
      const summaryLines = [
        i18n.t('ui.result.floorReached', {
          floor: sim.currentFloor,
          biome: biomeName,
        }),
        i18n.t('ui.result.timeElapsed', { time: timeStr }),
        i18n.t('ui.result.roomsCleared', { count: sim.runStats.roomsCleared }),
        i18n.t('ui.result.enemiesKilled', {
          kills: sim.runStats.kills,
          elites: sim.runStats.elitesKilled,
        }),
        i18n.t('ui.result.totalDamage', {
          dmg: Math.round(sim.runStats.damageDealt),
        }),
        i18n.t('ui.result.elementalReactions', {
          reactions: sim.runStats.elementalReactions,
          combos: sim.runStats.teamCombos,
        }),
        i18n.t('ui.result.goldCollected', {
          gold: sim.player.gold,
          totalGold: totalGoldEarned,
        }),
        i18n.t('ui.result.activeWeapon', {
          weapon: i18n.weaponName(activeWDef.id, activeWDef.nameVi),
        }),
        i18n.t('ui.result.blessings', { buffs: buffNames }),
      ].join('\n');

      const body = this.add
        .text(px + 18, py + 36, summaryLines, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '8.8px',
          fontStyle: '700',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.2,
          lineSpacing: 1,
          wordWrap: { width: 348 },
          resolution: textRes,
        })
        .setOrigin(0, 0);
      this.modalContainer.add(body);

      // Left Column Bottom: Per-Player Performance Breakdown Table
      const playerHeader = this.add.text(
        px + 18,
        py + 196,
        `📊 ${i18n.t('ui.result.playerStatsHeader')}`,
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '9.8px',
          fontStyle: '800',
          color: PALETTE.CYAN_FROST,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.6,
          resolution: textRes,
        },
      );
      this.modalContainer.add(playerHeader);

      const allPlayers = sim.getAllPlayers().slice(0, 4);
      allPlayers.forEach((pl, idx) => {
        const ry = py + 214 + idx * 33;
        const rw = 348;
        const rh = 30;
        const slotColor = PLAYER_SLOT_COLORS[pl.slot] ?? PALETTE.CYAN_FROST;

        const rowG = this.add.graphics();
        rowG.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.92);
        rowG.lineStyle(1.5, hexToNum(slotColor), 0.9);
        rowG.fillRoundedRect(px + 18, ry, rw, rh, 5);
        rowG.strokeRoundedRect(px + 18, ry, rw, rh, 5);
        this.modalContainer.add(rowG);

        const cDef = CHARACTERS[pl.characterId] ?? CHARACTERS.vanguard;
        const charName = i18n.charName(pl.characterId, cDef.nameVi);
        const pNameTxt = this.add.text(
          px + 25,
          ry + 3,
          `[P${pl.slot}] ${pl.displayName} (${charName})`,
          {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '8.6px',
            fontStyle: '800',
            color: slotColor,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 2.2,
            resolution: textRes,
          },
        );
        const pStatsTxt = this.add.text(
          px + 25,
          ry + 15,
          i18n.t('ui.result.playerRowFormat', {
            dmg: Math.round(pl.statsDamageDealt ?? 0),
            taken: Math.round(pl.statsDamageTaken ?? 0),
            kills: pl.statsKills ?? 0,
            revives: pl.statsRevives ?? 0,
            elem: pl.statsElementalReactions ?? 0,
            combo: pl.statsTeamCombos ?? 0,
          }),
          {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '8px',
            fontStyle: '700',
            color: PALETTE.BONE_WHITE,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 2,
            resolution: textRes,
          },
        );
        this.modalContainer.add([pNameTxt, pStatsTxt]);
      });

      // Right Column: 4 MVP Award Cards (Danh Hiệu MVP Đội Hình)
      const mvpHeader = this.add.text(px + 380, py + 38, `🏆 ${i18n.t('mvp.sectionTitle')}`, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '10.8px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      });
      this.modalContainer.add(mvpHeader);

      const mvpAwards = sim.computeMvpAwards();
      mvpAwards.forEach((award, idx) => {
        const ay = py + 60 + idx * 62;
        const aw = 342;
        const ah = 56;
        const cardG = this.add.graphics();
        cardG.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
        cardG.lineStyle(2, hexToNum(award.colorHex), 0.95);
        cardG.fillRoundedRect(px + 380, ay, aw, ah, 7);
        cardG.strokeRoundedRect(px + 380, ay, aw, ah, 7);
        this.modalContainer.add(cardG);

        const cDef = CHARACTERS[award.characterId] ?? CHARACTERS.vanguard;
        const charName = i18n.charName(award.characterId, cDef.nameVi);
        const titleTxt = this.add.text(
          px + 390,
          ay + 6,
          `★ ${i18n.t(award.titleKey)} — [P${award.playerSlot}] ${award.displayName}`,
          {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '9.8px',
            fontStyle: '800',
            color: award.colorHex,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 2.5,
            resolution: textRes,
          },
        );
        const descParams: Record<string, string | number> =
          award.category === 'medic'
            ? { revives: award.value, taken: award.secondaryValue }
            : award.category === 'elemental'
              ? { reactions: award.value, combos: award.secondaryValue }
              : { val: award.value };
        const subTxt = this.add.text(
          px + 390,
          ay + 26,
          `${charName} · ${i18n.t(award.descKey, descParams)}`,
          {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '9px',
            fontStyle: '700',
            color: PALETTE.BONE_WHITE,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 2,
            resolution: textRes,
          },
        );
        this.modalContainer.add([titleTxt, subTxt]);
      });

      // Bottom Action Buttons: [Enter] Chơi Lại, [H] Về Doanh Trại, [M] Menu Chính, Đóng Bảng
      const makeModalBtn = (
        bx: number,
        by: number,
        bw: number,
        label: string,
        borderHex: string,
        onClick: () => void,
      ) => {
        const btnG = this.add.graphics();
        btnG.fillStyle(hexToNum(PALETTE.SLATE_MID), 0.96);
        btnG.lineStyle(2, hexToNum(borderHex), 1);
        btnG.fillRoundedRect(bx, by, bw, 34, 7);
        btnG.strokeRoundedRect(bx, by, bw, 34, 7);
        this.modalContainer.add(btnG);

        const txt = this.add
          .text(bx + bw / 2, by + 17, label, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '10.5px',
            fontStyle: '800',
            color: borderHex,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 2.8,
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5);
        this.modalContainer.add(txt);

        const hit = this.add
          .rectangle(bx + bw / 2, by + 17, bw, 34, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => zzfx.play('ui_hover'));
        hit.on('pointerdown', () => {
          zzfx.play('ui_click');
          onClick();
        });
        this.modalContainer.add(hit);
      };

      const btnY = py + ph - 44;
      makeModalBtn(130, btnY, 182, i18n.t('modal.btnReplay'), PALETTE.LIME_GLOW, () => {
        this.scene.restart();
      });
      makeModalBtn(320, btnY, 172, i18n.t('modal.btnReturnHub'), PALETTE.CYAN_FROST, () => {
        sim.enterHub();
        this.triggerIrisTransition('close');
        this.invalidateAllHudCaches();
      });
      makeModalBtn(500, btnY, 162, i18n.t('modal.btnMainMenu'), PALETTE.SOLAR_GOLD, () => {
        this.scene.start('MenuScene');
      });
      makeModalBtn(670, btnY, 160, i18n.t('modal.btnDismiss'), PALETTE.SILVER_BRIGHT, () => {
        this.resultDismissed = true;
      });
    }
  }

  private updateDebugState(playerRenderX: number, playerRenderY: number): void {
    const sim = this.transport.getSim();
    const p = sim.player;
    const debug = initGlobalDebugState();

    debug.playerX = Math.round(playerRenderX * 100) / 100;
    debug.playerY = Math.round(playerRenderY * 100) / 100;
    debug.playerVx = Math.round(p.vx * 100) / 100;
    debug.playerVy = Math.round(p.vy * 100) / 100;
    debug.playerHp = p.hp;
    debug.playerMaxHp = p.maxHp;
    debug.playerArmor = p.armor;
    debug.playerMaxArmor = p.maxArmor;
    debug.playerEnergy = p.energy;
    debug.playerMaxEnergy = p.maxEnergy;
    debug.playerSlot = p.slot;
    debug.activeWeaponId = sim.getActiveWeaponId();
    debug.activeWeaponSlot = p.activeWeaponSlot;
    debug.godMode = p.godMode;
    debug.damagePopupCount = this.fx.getActiveDamagePopupCount();
    debug.totalDamagePopupsSpawned = this.fx.totalDamagePopupsSpawned;
    debug.totalSparksSpawned = this.fx.totalSparksSpawned;
    debug.totalHitStopsTriggered = this.fx.totalHitStopsTriggered;
    debug.totalShakesTriggered = this.fx.totalShakesTriggered;
    debug.sfxPlayedCount = zzfx.getPlayedCount();
    debug.lastSfxId = zzfx.getLastPlayedId();
    debug.rollingDps = sim.getRollingDps();
    debug.cameraCenterX = Math.round(this.cameras.main.midPoint.x * 100) / 100;
    debug.cameraCenterY = Math.round(this.cameras.main.midPoint.y * 100) / 100;
    debug.animState = this.playerRig?.getAnimState() ?? 'idle';

    // Phase 2 telemetry
    debug.activeLightCount = this.lighting.getActiveLightCount();
    debug.decalCount = this.fx.getActiveDecalCount();
    debug.particleCount = this.fx.getActiveParticleCount();
    debug.afterimageCount = this.fx.getActiveAfterimageCount();
    debug.ambientParticleCount = this.fx.getActiveAmbientCount();
    debug.propCount = this.propVisuals.size;
    let destructibleCount = 0;
    for (let i = 0; i < sim.props.length; i++) {
      const pr = sim.props[i]!;
      if (pr.destructible && pr.hp > 0) destructibleCount += 1;
    }
    debug.destructiblePropCount = destructibleCount;
    debug.activeImbueElement = p.activeImbueElement;
    debug.stressTestActive = sim.stressTestActive;

    // Phase 3 telemetry
    const currentRoom = sim.getCurrentRoom();
    const boss = sim.getActiveBoss();
    debug.biome = sim.currentBiome;
    debug.currentBiome = sim.currentBiome;
    debug.currentFloor = sim.currentFloor;
    debug.currentRoomId = sim.currentRoomId;
    debug.currentRoomType = sim.inHub ? 'hub' : currentRoom.type;
    debug.totalRooms = sim.dungeon.rooms.length;
    debug.playerGold = p.gold;
    debug.runState = sim.runState;
    debug.bossActive = boss !== null;
    debug.bossDefId = boss ? boss.defId : null;
    debug.bossPhase = boss ? boss.bossPhase : 0;
    debug.bossHp = boss ? boss.hp : 0;
    debug.bossMaxHp = boss ? boss.maxHp : 0;
    debug.fullMapOpen = this.fullMapOpen;
    debug.botAutoPlayActive = sim.botAutoPlayActive;
    debug.activeBuffs = sim.activeBuffIds;

    // Phase 4 Co-op & Network telemetry
    debug.coopMode = this.coopMode;
    debug.coopPlayerCount = sim.getActivePlayerCount();
    debug.inHub = sim.inHub;
    if (this.networkTransport) {
      const tel = this.networkTransport.getTelemetry();
      debug.rttMs = tel.rttMs;
      debug.jitterMs = tel.jitterMs;
      debug.bandwidthKBps = Math.round((tel.bytesInPerSec / 1024) * 10) / 10;
      debug.interpolationDelayMs = tel.interpolationDelayMs;
      debug.wifiProfile = tel.wifiProfile;
    } else {
      debug.rttMs = debug.pingMs;
      debug.jitterMs = 0;
      debug.bandwidthKBps = 0;
      debug.interpolationDelayMs = 0;
    }

    // Phase 5 telemetry
    debug.playerCharacterId = p.characterId;
    debug.teamComboCount = sim.teamComboCount;
    debug.elementalReactions = sim.runStats.elementalReactions;
    debug.activeSummonCount = sim.summons.length;
    debug.activeSkillZoneCount = sim.skillZones.length;

    // Phase 6 telemetry
    debug.blizzardVeilActive = this.lighting.isBlizzardVeilActive();
    debug.conveyorDirection = sim.map.conveyorDirection;
    debug.pressurePlatesSolved = sim.coopPuzzleCompleted;
    debug.pressurePlateCount = sim.pressurePlates.length;
    debug.shockwaveRingCount = sim.shockwaveRings.length;
    debug.tetherBeamCount = sim.tetherBeams.length;

    // Phase 7 UI/UX & Audio telemetry
    debug.language = graphicsSettings.getState().language;
    debug.pauseModalOpen = this.pauseModalOpen;
    debug.settingsModalOpen = this.settingsModal?.getActiveModal() === 'settings';
    debug.controlsModalOpen = this.settingsModal?.getActiveModal() === 'controls';
    debug.creditsModalOpen = this.settingsModal?.getActiveModal() === 'credits';
    debug.irisTransitionProgress = Math.round(this.irisTransitionProgress * 100) / 100;
    debug.trailingHpRatio = Math.round(this.trailingHpRatio * 1000) / 1000;
    debug.trailingArmorRatio = Math.round(this.trailingArmorRatio * 1000) / 1000;
    debug.musicTheme = musicManager.getCurrentTheme();
    debug.musicCombatMix = musicManager.getCombatMix();
    debug.mvpAwardsCount = sim.computeMvpAwards().length;

    const activeEnemyCount = this.activeEnemyIds.size;
    const totalEntities = 1 + sim.simulatedPlayers.length + activeEnemyCount + sim.summons.length;

    this.debugOverlay?.update({
      entityCount: totalEntities,
      bulletCount: sim.projectiles.length,
      tick: sim.tick,
    });
  }
}
