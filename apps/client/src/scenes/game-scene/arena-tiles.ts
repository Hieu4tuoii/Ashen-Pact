import {
  type ArenaMap,
  AUTOTILE_EAST,
  AUTOTILE_NORTH,
  AUTOTILE_SOUTH,
  AUTOTILE_WEST,
  clamp,
  i18n,
  LocalTransport,
  NetworkTransport,
  PLAYER_SLOT_COLORS,
  type SurfaceKind,
  TILE_SIZE,
  type TileKind,
  type WifiProfileId,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import Phaser from 'phaser';
import { CutoutRig } from '../../art/cutout-rig.js';
import { dampLerp } from '../../art/easing.js';
import { ENV_PALETTE, hexToNum, PALETTE } from '../../art/palette.js';
import { VANGUARD_RIG_DEF } from '../../art/rig-defs.js';
import { TextureBaker } from '../../art/texture-baker.js';
import {
  drawBridgeOverChasmOverlay,
  hasChasmAlongAxisWithin3,
  isBridgeFloorTileOverChasm,
} from '../../art/texture-baker-surfaces.js';
import { musicManager } from '../../audio/music-synth.js';
import { zzfx } from '../../audio/zzfx.js';
import {
  isDebugUiEnabled,
  isTestHooksEnabled,
  onDebugFlagsChanged,
} from '../../core/debug-flag.js';
import { getFreezeVisualTimeSec, resetClientFreezeRandom } from '../../core/visual-query.js';
import { CombatFxManager, computeIrisHoleRadius } from '../../fx/combat-fx.js';
import { computeUniformViewportMetrics } from '../../fx/lighting-config.js';
import { LightingPipeline } from '../../fx/lighting-pipeline.js';
import { DebugOverlay, initGlobalDebugState } from '../../ui/debug-overlay.js';
import { type GraphicsQualityTier, graphicsSettings } from '../../ui/graphics-settings.js';
import {
  BiomeArchitectureLiveLayer,
  buildRoomArchitecturePlan,
  computeTileDistToWall,
  isActiveWallTile,
  isExteriorVoidWallTile,
  renderBiomeArchitectureToComposite,
  resolveHybridFloorVariant,
} from '../../world/biome-architecture.js';
import { type ArenaTileVisual, type GameScene, RIG_FOOT_OFFSET_Y } from '../GameScene.js';
import type { HudScene } from '../HudScene.js';
import { applyHudEdgeAnchors } from './hud-setup-and-pause.js';
import {
  canTeleportFromCurrentRoom,
  resolveMinimapClickedRoomId,
} from './hud-qol-and-minimap.js';
import { createInteractPromptFadeState } from './interact-prompt.js';
import {
  isSanctuaryHudChromeClick,
  resolveHubWorldPointerClick,
  SanctuaryVisualLayer,
} from './sanctuary-architecture.js';
import {
  destroySanctuaryDomInputs,
  mountSanctuaryDomInputs,
  resolveSavedSanctuaryCharacter,
  syncSanctuaryDomInputsLayoutAndVisibility,
} from './sanctuary-lobby-ui.js';
import { createPortalAnimState } from '../../fx/portal-door-shaders.js';

export function syncGameSceneTestHooks(scene: GameScene): void {
  if (typeof window === 'undefined') return;
  if (isTestHooksEnabled()) {
    window.__PHASER_GAME__ = scene.game;
    window.__GAME_TRANSPORT__ = scene.transport;
    window.__GAME_STRESS_TEST__ = (active: boolean) => {
      scene.setStressTestMode(active);
    };
    window.__GAME_SET_QUALITY__ = (quality: GraphicsQualityTier) => {
      graphicsSettings.setQuality(quality);
      scene.debugOverlay?.resetSamples();
    };
    window.__GAME_BOT_AUTOPLAY__ = (active: boolean) => {
      const s = scene.transport.getSim();
      s.botAutoPlayActive = active;
      initGlobalDebugState().botAutoPlayActive = active;
      if (scene.room && scene.coopMode !== 'solo') {
        scene.room.send('set_bot_autoplay', { active });
      }
    };
    window.__GAME_SET_WIFI_PROFILE__ = (profile: WifiProfileId) => {
      scene.networkTransport?.setWifiProfile(profile);
      initGlobalDebugState().wifiProfile = profile;
    };
    window.__GAME_TRIGGER_LAG_SPIKE__ = (durationMs = 300) => {
      scene.networkTransport?.triggerManualLagSpike(durationMs);
    };
    window.__GAME_SET_LIGHTING__ = (enabled: boolean) => {
      scene.lighting?.setLightingEnabled(enabled);
    };
    window.__GAME_FORCE_RECONNECT__ = () => scene.forceCoopReconnect();
    window.__GAME_COOP_SEND__ = (type: string, payload?: unknown) => {
      scene.room?.send(type, payload);
    };
  } else {
    delete window.__PHASER_GAME__;
    delete window.__GAME_TRANSPORT__;
    delete window.__GAME_STRESS_TEST__;
    delete window.__GAME_SET_QUALITY__;
    delete window.__GAME_SET_LIGHTING__;
    delete window.__GAME_BOT_AUTOPLAY__;
    delete window.__GAME_SET_WIFI_PROFILE__;
    delete window.__GAME_TRIGGER_LAG_SPIKE__;
    delete window.__GAME_FORCE_RECONNECT__;
    delete window.__GAME_COOP_SEND__;
  }
}

export function createImpl(this: GameScene): void {
  const debug = initGlobalDebugState();
  resetClientFreezeRandom(debug.seed);
  debug.scene = 'GameScene';
  debug.tick = 0;
  debug.coopMode = this.coopMode;
  debug.language = graphicsSettings.getState().language;
  debug.pauseModalOpen = false;
  debug.pauseConfirmExitOpen = false;
  debug.invitePanelVisible = false;
  debug.settingsModalOpen = false;
  debug.controlsModalOpen = false;
  debug.creditsModalOpen = false;
  debug.weaponComparisonVisible = false;
  debug.comparedWeaponId = null;
  debug.emoteWheelOpen = false;
  debug.lastDebugRejected = null;
  debug.menuDisplayName = this.displayName;
  debug.menuServerHostPort = this.serverHostPort;
  debug.menuActiveInput = null;

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
  this.chestGlowSprites.clear();
  this.chestSparkleSprites.clear();
  this.worldItemSprites.clear();
  this.npcVisuals.clear();
  this.portalSprite = undefined;
  this.portalGlowSprite = undefined;
  this.portalLabel = undefined;
  this.portalVisualGroup = undefined;
  this.portalAnimState = createPortalAnimState();
  this.portalDoorAnimClockSec = 0;
  this.lastDoorRoomKey = '';
  this.interactPromptState = createInteractPromptFadeState();
  this.currentInteractTarget = null;
  this.interactPromptVisuals = undefined;
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
  this.lastSanctuaryHudHash = '';
  this.lastHubPreviewHash = '';
  this.lastWeaponCompareHash = '';
  this.lastEmoteWheelHash = '';
  this.emoteWheelOpen = false;
  this.emoteWheelHoveredId = null;
  this.lastRunState = 'playing';
  this.resultDismissed = false;
  this.fullMapOpen = false;
  this.pauseModalOpen = false;
  this.pauseConfirmExitOpen = false;
  this.buffHoveredIdx = null;
  this.trailingHpRatio = 1.0;
  this.trailingArmorRatio = 1.0;
  this.trailingBossHpRatio = 1.0;
  this.lowHpHeartbeatTimer = 0;
  this.lastBlizzardPhase3 = false;
  this.irisTransitionProgress = 0.0;
  this.irisTransitionDir = 0;
  this.roomTeleportAnimTimer = 0;
  this.invitePanelVisible = false;
  this.copyToastTimer = 0;
  this.pingQueued = null;
  this.queuedEmote = null;
  this.dropWeaponQueued = false;
  this.readyToggleQueued = false;
  this.suppressFireUntilPointerUp = false;
  this.hubTicksElapsed = 0;
  this.wasInHubLastFrame = false;
  this.hubLoungeAnimOverride = null;
  this.sanctuaryHubElapsedSec = 0;
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
    this.wasInHubLastFrame = true;
  } else {
    const searchParams = new URLSearchParams(window.location.search);
    const allowShortcuts = isDebugUiEnabled() || isTestHooksEnabled();
    const urlBiomeNum = allowShortcuts ? Number(searchParams.get('biome')) : 1;
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
      autoRespawnWaves: false,
      autoRevivePlayer: false,
    });
    if (this.startInHub || (allowShortcuts && searchParams.get('hub') === '1')) {
      const soloSim = this.transport.getSim();
      soloSim.enterHub();
      soloSim.player.displayName = this.displayName;
      const savedChar = resolveSavedSanctuaryCharacter(window.location.search);
      if (savedChar && savedChar !== soloSim.player.characterId) {
        soloSim.selectCharacter(soloSim.player.id, savedChar);
      }
      this.transport.consumeEvents();
      this.wasInHubLastFrame = true;
    } else if (allowShortcuts && initialBiome > 1) {
      this.transport.getSim().advanceToBiome(initialBiome);
    }
    debug.currentBiome = this.transport.getSim().currentBiome;
  }

  syncGameSceneTestHooks(this);
  this.unsubDebugFlags?.();
  this.unsubDebugFlags = onDebugFlagsChanged(() => {
    syncGameSceneTestHooks(this);
    this.invalidateAllHudCaches();
  });

  const sim = this.transport.getSim();
  this.camFocusX = sim.player.x;
  this.camFocusY = sim.player.y;

  if (!this.scene.isActive('HudScene')) {
    this.game.scene.start('HudScene');
  }
  this.scene.bringToTop('HudScene');
  const hudScene = this.scene.get('HudScene') as HudScene;
  hudScene.attachGameScene();
  this.hudScene = hudScene;

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
      return;
    }
    if (
      pointer.leftButtonDown() &&
      !this.pauseModalOpen &&
      !(this.settingsModal?.isOpen() ?? false)
    ) {
      const hudPt = this.uiScene?.cameras?.main
        ? this.uiScene.cameras.main.getWorldPoint(pointer.x, pointer.y)
        : { x: pointer.x, y: pointer.y };
      const clickedRoomId = resolveMinimapClickedRoomId(this, hudPt.x, hudPt.y);
      if (clickedRoomId !== null) {
        this.teleportToRoom(clickedRoomId);
        return;
      }

      const curSim = this.transport.getSim();
      const debugState = initGlobalDebugState();
      const modalOpen =
        this.pauseModalOpen ||
        (this.settingsModal?.isOpen() ?? false) ||
        this.fullMapOpen ||
        this.emoteWheelOpen ||
        debugState.overlayVisible ||
        (this.transport.getLocalPlayerState().buffChoices?.length ?? 0) > 0 ||
        (this.transport.getLocalPlayerState().mutatorChoices?.length ?? 0) > 0 ||
        (this.transport.getLocalPlayerState().pactChoices?.length ?? 0) > 0;
      const hudHitCount = this.uiScene?.input?.hitTestPointer(pointer)?.length ?? 0;
      const isClickingHudChrome = isSanctuaryHudChromeClick({
        inHub: curSim.inHub,
        invitePanelVisible: this.invitePanelVisible,
        hudX: hudPt.x,
        hudY: hudPt.y,
        hudPadX: this.hudPadX,
        hudPadY: this.hudPadY,
        hudUiScale: this.currentHudUiScale || 1,
        hudHitCount,
      });

      if (curSim.inHub && !modalOpen && isClickingHudChrome) {
        this.suppressFireUntilPointerUp = true;
      } else if (curSim.inHub && !modalOpen) {
        const wPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const action = resolveHubWorldPointerClick({
          inHub: curSim.inHub,
          coopMode: this.coopMode,
          modalOpen,
          isClickingHudChrome,
          worldX: wPt.x - this.lastShakeX,
          worldY: wPt.y - this.lastShakeY,
          hubStatues: curSim.hubStatues,
          hubStations: curSim.hubStations,
        });
        if (action) {
          this.suppressFireUntilPointerUp = true;
          if (action.kind === 'select_character') {
            if (curSim.selectCharacter(curSim.player.id, action.characterId)) {
              zzfx.play('ui_click');
              if (typeof window !== 'undefined') {
                window.localStorage?.setItem('ashen_pact_character', action.characterId);
              }
              this.lastHudCharacterId = '';
              this.lastHubPreviewHash = '';
              this.lastInvitePanelHash = '';
            }
          } else if (action.kind === 'toggle_coop_board') {
            this.invitePanelVisible = !this.invitePanelVisible;
            debugState.invitePanelVisible = this.invitePanelVisible;
            this.lastInvitePanelHash = '';
            zzfx.play('ui_click');
          } else if (action.kind === 'open_codex_desk') {
            this.settingsModal?.open('settings');
            zzfx.play('ui_click');
          }
        }
      }
    }
  };
  const unlockAudio = () => zzfx.unlockOnUserGesture();
  this.input.on('pointerdown', onPointerDown);
  this.input.keyboard?.on('keydown', unlockAudio);

  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    this.intentionalLeave = true;
    destroySanctuaryDomInputs(this);
    this.sanctuaryHudContainer = undefined;
    this.sanctuaryPlaqueContainer = undefined;
    this.sanctuaryDebugFooterContainer = undefined;
    this.scale.off('resize', this.applyCameraViewport, this);
    this.input.off('wheel', onWheel);
    this.input.off('pointerdown', onPointerDown);
    this.input.keyboard?.off('keydown', unlockAudio);
    this.lighting?.destroy();
    this.destroyPortalAndDoorVisuals();
    this.sanctuaryLayer?.destroy();
    this.sanctuaryLayer = undefined;
    this.biomeArchLive?.destroy();
    this.biomeArchLive = undefined;
    this.settingsModal?.destroy();
    this.hudScene?.detachGameScene();
    this.hudScene = undefined;
    this.unsubDebugFlags?.();
    this.unsubDebugFlags = undefined;
    delete window.__PHASER_GAME__;
    delete window.__GAME_TRANSPORT__;
    delete window.__GAME_STRESS_TEST__;
    delete window.__GAME_SET_QUALITY__;
    delete window.__GAME_SET_LIGHTING__;
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
  this.sanctuaryLayer?.destroy();
  this.sanctuaryLayer = new SanctuaryVisualLayer(this);

  // 3. Telegraph, Interact Highlight & Hitbox Overlay Graphics (depth 35.6..38: above lightmapRt depth 34)
  this.interactHighlightGraphics = this.add.graphics();
  this.interactHighlightGraphics.setDepth(35.6);
  this.interactHighlightGraphics.setBlendMode(Phaser.BlendModes.ADD);

  this.groundHazardGraphics = this.add.graphics();
  this.groundHazardGraphics.setDepth(16);

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
  this.sanctuaryLayer.sync(sim, 0, getFreezeVisualTimeSec(this.lighting.getElapsedSec()));

  // 8. Custom Procedural Crosshair (in HudScene so it is unaffected by PostFX/lightmap)
  const invBake = 1 / textRes;
  this.crosshairSprite = this.uiScene.add.sprite(480, 270, 'ui_crosshair');
  this.crosshairSprite.setScale(invBake);
  this.crosshairSprite.setDepth(5000);

  // 9. Camera-Pinned Vector HUD + Sanctuary DOM Input Overlay
  this.buildVectorHud();
  mountSanctuaryDomInputs(this);
  syncSanctuaryDomInputsLayoutAndVisibility(this);
  this.triggerIrisTransition('open');

  // 10. Keyboard & Debug Bindings
  this.setupKeyboardBindings();

  this.debugOverlay = new DebugOverlay(this, false, this.uiScene);
  if (this.coopMode === 'host' || this.coopMode === 'join') {
    void this.connectCoopRoom();
  } else {
    void this.connectHelloRoom();
  }
}

export function setStressTestModeImpl(this: GameScene, active: boolean): void {
  const sim = this.transport.getSim();
  sim.configureStressTest(active);
  for (const rig of this.enemyRigs.values()) {
    rig.destroy();
  }
  this.enemyRigs.clear();
  this.sanctuaryLayer?.sync(sim, 0, getFreezeVisualTimeSec(this.lighting?.getElapsedSec() ?? 1.0));
  if (active) {
    this.transport.consumeEvents();
    this.fx?.consumeHitStopDelta(999);
    this.syncArenaTilesWithMapRevision();
    this.destroyPortalAndDoorVisuals();
    this.syncSimulatedPlayers(0);
    this.syncEnemyRigs(0);
    this.syncProps(0);
    this.syncProjectilesAndPickups();
  }
  this.debugOverlay?.resetSamples();
}

export function drawSourceKeyToCtxImpl(
  this: GameScene,
  ctx: CanvasRenderingContext2D,
  key: string,
  dx: number,
  dy: number,
  cellPx: number,
): void {
  if (!this.textures?.exists?.(key)) return;
  const tex = this.textures.get(key);
  const src = tex?.getSourceImage?.() as CanvasImageSource | undefined;
  if (src) {
    ctx.drawImage(src, dx, dy, cellPx, cellPx);
  }
}

function isSameSurfaceFamilyForTile(map: ArenaMap, a: SurfaceKind, b: SurfaceKind): boolean {
  const mapWithHelper = map as unknown as {
    isSameSurfaceFamily?: (s1: SurfaceKind, s2: SurfaceKind) => boolean;
  };
  if (typeof mapWithHelper.isSameSurfaceFamily === 'function') {
    return mapWithHelper.isSameSurfaceFamily(a, b);
  }
  if (a === b) return true;
  if ((a === 'water' || a === 'electrified_water') && (b === 'water' || b === 'electrified_water')) {
    return true;
  }
  if ((a === 'grass' || a === 'ash') && (b === 'grass' || b === 'ash')) {
    return true;
  }
  return false;
}

function resolveSurfaceShorelineColors(
  surface: Exclude<SurfaceKind, 'none' | 'chasm' | 'conveyor'>,
): { outerBank: string; innerLip: string } {
  switch (surface) {
    case 'lava':
      return { outerBank: '#1F1614', innerLip: '#EA580C' };
    case 'ice':
      return { outerBank: '#3B7290', innerLip: '#CFE8EE' };
    case 'water':
      return { outerBank: '#263B52', innerLip: '#3E6282' };
    case 'electrified_water':
      return { outerBank: '#2C5173', innerLip: '#5687AD' };
    case 'poison_swamp':
      return { outerBank: '#2D3B36', innerLip: '#496146' };
    case 'grass':
      return { outerBank: '#253B2D', innerLip: '#3B5E47' };
    case 'burning_grass':
      return { outerBank: '#4F2621', innerLip: '#8A4538' };
    case 'oil':
      return { outerBank: '#2A2438', innerLip: '#3B2D29' };
    case 'burning_oil':
      return { outerBank: '#3B2019', innerLip: '#8F452C' };
    case 'ash':
      return { outerBank: '#252129', innerLip: '#423C46' };
  }
}

export function renderTileCellToCompositeImpl(
  this: GameScene,
  tileOrCtx: ArenaTileVisual | CanvasRenderingContext2D,
  maybeTile?: ArenaTileVisual,
  maybeScale?: number,
  maybeBiome?: 0 | 1 | 2 | 3,
): void {
  const isDirectCtxCall =
    maybeTile !== undefined &&
    typeof (tileOrCtx as CanvasRenderingContext2D)?.fillRect === 'function';
  const groundCtx = isDirectCtxCall
    ? (tileOrCtx as CanvasRenderingContext2D)
    : this.arenaGroundTex?.getContext();
  if (!groundCtx) return;

  const tile = isDirectCtxCall ? maybeTile : (tileOrCtx as ArenaTileVisual);
  const sim =
    this.transport?.getSim?.() ??
    (this as unknown as { sim?: ReturnType<LocalTransport['getSim']> })?.sim;
  const map = sim?.map ?? (this as unknown as { map?: ArenaMap })?.map;
  const effectiveBiome: 0 | 1 | 2 | 3 =
    maybeBiome ?? (sim ? (sim.inHub ? 0 : sim.currentBiome) : (this.lastRenderedBiome ?? 1));
  const env = ENV_PALETTE[effectiveBiome] ?? ENV_PALETTE[1];
  const scale = maybeScale ?? (this.tileCompositeScale || 1);
  const cellPx = TILE_SIZE * scale;
  const dx = tile.tx * cellPx;
  const dy = tile.ty * cellPx;
  const drawKey = this.drawSourceKeyToCtx ?? drawSourceKeyToCtxImpl;
  const getStructKey = this.getStructureTextureKey ?? getStructureTextureKeyImpl;

  groundCtx.clearRect(dx, dy, cellPx, cellPx);

  // Branch A: Exterior Void Wall Tile (distToFloorChebyshev >= 2)
  if (tile.kind === 'wall' && map && isExteriorVoidWallTile(map, tile.tx, tile.ty)) {
    groundCtx.save();
    groundCtx.fillStyle = PALETTE.INK_DEEP;
    groundCtx.fillRect(dx, dy, cellPx, cellPx);

    const tx = tile.tx;
    const ty = tile.ty;
    const adjWallN = ty > 0 && isActiveWallTile(map, tx, ty - 1);
    const adjWallS = ty + 1 < map.rows && isActiveWallTile(map, tx, ty + 1);
    const adjWallW = tx > 0 && isActiveWallTile(map, tx - 1, ty);
    const adjWallE = tx + 1 < map.cols && isActiveWallTile(map, tx + 1, ty);
    const adjWallNW =
      !adjWallN && !adjWallW && tx > 0 && ty > 0 && isActiveWallTile(map, tx - 1, ty - 1);
    const adjWallNE =
      !adjWallN &&
      !adjWallE &&
      tx + 1 < map.cols &&
      ty > 0 &&
      isActiveWallTile(map, tx + 1, ty - 1);
    const adjWallSW =
      !adjWallS &&
      !adjWallW &&
      tx > 0 &&
      ty + 1 < map.rows &&
      isActiveWallTile(map, tx - 1, ty + 1);
    const adjWallSE =
      !adjWallS &&
      !adjWallE &&
      tx + 1 < map.cols &&
      ty + 1 < map.rows &&
      isActiveWallTile(map, tx + 1, ty + 1);

    if (
      adjWallN ||
      adjWallS ||
      adjWallW ||
      adjWallE ||
      adjWallNW ||
      adjWallNE ||
      adjWallSW ||
      adjWallSE
    ) {
      // 1. 6px (6 * scale) outer-wall ambient shadow strip/corner in ENV_PALETTE[biome].shadow (alpha = 0.65)
      groundCtx.fillStyle = env.shadow;
      groundCtx.globalAlpha = 0.65;
      if (adjWallN) groundCtx.fillRect(dx, dy, cellPx, 6 * scale);
      if (adjWallS) groundCtx.fillRect(dx, dy + cellPx - 6 * scale, cellPx, 6 * scale);
      if (adjWallW) groundCtx.fillRect(dx, dy, 6 * scale, cellPx);
      if (adjWallE) groundCtx.fillRect(dx + cellPx - 6 * scale, dy, 6 * scale, cellPx);
      if (adjWallNW) groundCtx.fillRect(dx, dy, 6 * scale, 6 * scale);
      if (adjWallNE) groundCtx.fillRect(dx + cellPx - 6 * scale, dy, 6 * scale, 6 * scale);
      if (adjWallSW) groundCtx.fillRect(dx, dy + cellPx - 6 * scale, 6 * scale, 6 * scale);
      if (adjWallSE) {
        groundCtx.fillRect(
          dx + cellPx - 6 * scale,
          dy + cellPx - 6 * scale,
          6 * scale,
          6 * scale,
        );
      }

      // 2. 2px (2 * scale) PALETTE.INK_DARK (#141019) outer wall backing edge/corner
      groundCtx.globalAlpha = 1;
      groundCtx.fillStyle = PALETTE.INK_DARK;
      if (adjWallN) groundCtx.fillRect(dx, dy, cellPx, 2 * scale);
      if (adjWallS) groundCtx.fillRect(dx, dy + cellPx - 2 * scale, cellPx, 2 * scale);
      if (adjWallW) groundCtx.fillRect(dx, dy, 2 * scale, cellPx);
      if (adjWallE) groundCtx.fillRect(dx + cellPx - 2 * scale, dy, 2 * scale, cellPx);
      if (adjWallNW) groundCtx.fillRect(dx, dy, 2 * scale, 2 * scale);
      if (adjWallNE) groundCtx.fillRect(dx + cellPx - 2 * scale, dy, 2 * scale, 2 * scale);
      if (adjWallSW) groundCtx.fillRect(dx, dy + cellPx - 2 * scale, 2 * scale, 2 * scale);
      if (adjWallSE) {
        groundCtx.fillRect(
          dx + cellPx - 2 * scale,
          dy + cellPx - 2 * scale,
          2 * scale,
          2 * scale,
        );
      }

      // 3. 1px (1 * scale) ENV_PALETTE[biome].seam outer wall backing seam line & corner dot
      if (adjWallNW || adjWallNE || adjWallSW || adjWallSE) {
        groundCtx.fillStyle = env.seam;
        if (adjWallNW) groundCtx.fillRect(dx + 2 * scale, dy + 2 * scale, 1 * scale, 1 * scale);
        if (adjWallNE) {
          groundCtx.fillRect(dx + cellPx - 3 * scale, dy + 2 * scale, 1 * scale, 1 * scale);
        }
        if (adjWallSW) {
          groundCtx.fillRect(dx + 2 * scale, dy + cellPx - 3 * scale, 1 * scale, 1 * scale);
        }
        if (adjWallSE) {
          groundCtx.fillRect(
            dx + cellPx - 3 * scale,
            dy + cellPx - 3 * scale,
            1 * scale,
            1 * scale,
          );
        }
      }
      if (adjWallN || adjWallS || adjWallW || adjWallE) {
        groundCtx.strokeStyle = env.seam;
        groundCtx.lineWidth = 1 * scale;
        groundCtx.beginPath();
        if (adjWallN) {
          groundCtx.moveTo(dx, dy + 2.5 * scale);
          groundCtx.lineTo(dx + cellPx, dy + 2.5 * scale);
        }
        if (adjWallS) {
          groundCtx.moveTo(dx, dy + cellPx - 2.5 * scale);
          groundCtx.lineTo(dx + cellPx, dy + cellPx - 2.5 * scale);
        }
        if (adjWallW) {
          groundCtx.moveTo(dx + 2.5 * scale, dy);
          groundCtx.lineTo(dx + 2.5 * scale, dy + cellPx);
        }
        if (adjWallE) {
          groundCtx.moveTo(dx + cellPx - 2.5 * scale, dy);
          groundCtx.lineTo(dx + cellPx - 2.5 * scale, dy + cellPx);
        }
        groundCtx.stroke();
      }
    }

    groundCtx.restore();
    return;
  }

  drawKey.call(
    this,
    groundCtx,
    TextureBaker.getBiomeTileTextureKey(effectiveBiome, tile.variant),
    dx,
    dy,
    cellPx,
  );

  if (tile.kind === 'floor') {
    if (tile.surface !== 'none') {
      const surfaceVariant = (tile.tx * 7 + tile.ty * 13 + tile.variant) & 7;
      TextureBaker.drawSurfaceTile(
        groundCtx,
        tile.surface,
        tile.surfaceMask,
        dx,
        dy,
        cellPx,
        surfaceVariant,
        effectiveBiome,
      );

      if (map && tile.surface === 'chasm') {
        const solidN = tile.ty > 0 && map.isSolidTile(tile.tx, tile.ty - 1);
        const solidS = tile.ty + 1 < map.rows && map.isSolidTile(tile.tx, tile.ty + 1);
        const solidW = tile.tx > 0 && map.isSolidTile(tile.tx - 1, tile.ty);
        const solidE = tile.tx + 1 < map.cols && map.isSolidTile(tile.tx + 1, tile.ty);
        if (solidN || solidS || solidW || solidE) {
          const chasmStrataColor =
            effectiveBiome === 2 ? '#243B47' : effectiveBiome === 3 ? '#2A120E' : '#1F1815';
          groundCtx.save();
          groundCtx.fillStyle = chasmStrataColor;
          if (solidN) groundCtx.fillRect(dx, dy, cellPx, 2.2 * scale);
          if (solidS) groundCtx.fillRect(dx, dy + cellPx - 2.2 * scale, cellPx, 2.2 * scale);
          if (solidW) groundCtx.fillRect(dx, dy, 2.2 * scale, cellPx);
          if (solidE) groundCtx.fillRect(dx + cellPx - 2.2 * scale, dy, 2.2 * scale, cellPx);
          groundCtx.restore();
        }
      } else if (map && tile.surface !== 'chasm' && tile.surface !== 'conveyor') {
        const sm = tile.surfaceMask;
        const sHasN = (sm & AUTOTILE_NORTH) !== 0;
        const sHasE = (sm & AUTOTILE_EAST) !== 0;
        const sHasS = (sm & AUTOTILE_SOUTH) !== 0;
        const sHasW = (sm & AUTOTILE_WEST) !== 0;
        const sameDiag = (nx: number, ny: number): boolean => {
          if (nx < 0 || ny < 0 || nx >= map.cols || ny >= map.rows) return false;
          return isSameSurfaceFamilyForTile(map, tile.surface, map.getSurface(nx, ny));
        };
        const concaveNE = sHasN && sHasE && !sameDiag(tile.tx + 1, tile.ty - 1);
        const concaveNW = sHasN && sHasW && !sameDiag(tile.tx - 1, tile.ty - 1);
        const concaveSE = sHasS && sHasE && !sameDiag(tile.tx + 1, tile.ty + 1);
        const concaveSW = sHasS && sHasW && !sameDiag(tile.tx - 1, tile.ty + 1);

        if (concaveNE || concaveNW || concaveSE || concaveSW) {
          const { outerBank, innerLip } = resolveSurfaceShorelineColors(tile.surface);
          const cap = 2.6 * scale;
          groundCtx.save();
          groundCtx.fillStyle = outerBank;
          if (concaveNE) groundCtx.fillRect(dx + cellPx - cap, dy, cap, cap);
          if (concaveNW) groundCtx.fillRect(dx, dy, cap, cap);
          if (concaveSE) groundCtx.fillRect(dx + cellPx - cap, dy + cellPx - cap, cap, cap);
          if (concaveSW) groundCtx.fillRect(dx, dy + cellPx - cap, cap, cap);

          groundCtx.strokeStyle = innerLip;
          groundCtx.lineWidth = 1.4 * scale;
          groundCtx.beginPath();
          if (concaveNE) {
            groundCtx.moveTo(dx + cellPx - cap, dy);
            groundCtx.lineTo(dx + cellPx, dy + cap);
          }
          if (concaveNW) {
            groundCtx.moveTo(dx + cap, dy);
            groundCtx.lineTo(dx, dy + cap);
          }
          if (concaveSE) {
            groundCtx.moveTo(dx + cellPx - cap, dy + cellPx);
            groundCtx.lineTo(dx + cellPx, dy + cellPx - cap);
          }
          if (concaveSW) {
            groundCtx.moveTo(dx + cap, dy + cellPx);
            groundCtx.lineTo(dx, dy + cellPx - cap);
          }
          groundCtx.stroke();
          groundCtx.restore();
        }
      }
    } else if (map && isBridgeFloorTileOverChasm(map, tile.tx, tile.ty)) {
      const hasChasmN = map.getSurface(tile.tx, tile.ty - 1) === 'chasm';
      const hasChasmS = map.getSurface(tile.tx, tile.ty + 1) === 'chasm';
      const hasChasmW = map.getSurface(tile.tx - 1, tile.ty) === 'chasm';
      const hasChasmE = map.getSurface(tile.tx + 1, tile.ty) === 'chasm';
      const spansWE =
        hasChasmAlongAxisWithin3(map, tile.tx, tile.ty, -1, 0) &&
        hasChasmAlongAxisWithin3(map, tile.tx, tile.ty, 1, 0);
      const spansNS =
        hasChasmAlongAxisWithin3(map, tile.tx, tile.ty, 0, -1) &&
        hasChasmAlongAxisWithin3(map, tile.tx, tile.ty, 0, 1);
      const isVerticalBridge = spansWE && !spansNS;
      drawBridgeOverChasmOverlay(
        groundCtx,
        dx,
        dy,
        cellPx,
        hasChasmN,
        hasChasmS,
        effectiveBiome,
        hasChasmW,
        hasChasmE,
        isVerticalBridge,
      );
    }
    if (
      tile.aoMask > 0 &&
      tile.surface !== 'chasm' &&
      tile.surface !== 'lava' &&
      tile.surface !== 'burning_oil' &&
      tile.surface !== 'burning_grass'
    ) {
      drawKey.call(
        this,
        groundCtx,
        TextureBaker.getWallAoTextureKey(tile.aoMask),
        dx,
        dy,
        cellPx,
      );
    }
  } else {
    drawKey.call(
      this,
      groundCtx,
      getStructKey.call(this, tile.kind, tile.autotileMask, effectiveBiome),
      dx,
      dy,
      cellPx,
    );

    // Non-2x2 Pillar Check: only complete 2x2 pillar quads (masks 6, 12, 3, 9) keep corner medallions
    if (tile.kind === 'pillar' && map) {
      const pm = tile.autotileMask & 15;
      const isCornerMask = pm === 6 || pm === 12 || pm === 3 || pm === 9;
      const isLinearMedallionFallback = pm === 5 || pm === 10;
      if (isCornerMask || isLinearMedallionFallback) {
        const qTx = pm === 12 || pm === 9 ? tile.tx - 1 : tile.tx;
        const qTy = pm === 3 || pm === 9 ? tile.ty - 1 : tile.ty;
        const isComplete2x2PillarQuad =
          isCornerMask &&
          qTx >= 0 &&
          qTy >= 0 &&
          qTx + 1 < map.cols &&
          qTy + 1 < map.rows &&
          map.getTile(qTx, qTy) === 'pillar' &&
          map.getAutotileMask(qTx, qTy) === 6 &&
          map.getTile(qTx + 1, qTy) === 'pillar' &&
          map.getAutotileMask(qTx + 1, qTy) === 12 &&
          map.getTile(qTx, qTy + 1) === 'pillar' &&
          map.getAutotileMask(qTx, qTy + 1) === 3 &&
          map.getTile(qTx + 1, qTy + 1) === 'pillar' &&
          map.getAutotileMask(qTx + 1, qTy + 1) === 9;

        if (!isComplete2x2PillarQuad) {
          groundCtx.save();
          groundCtx.fillStyle = env.wallTop;
          if (isCornerMask) {
            const mx = dx + (pm === 6 || pm === 3 ? 23.5 : 0) * scale;
            const my = dy + (pm === 6 || pm === 12 ? 23.5 : 0) * scale;
            groundCtx.fillRect(mx, my, 8.5 * scale, 8.5 * scale);
          }
          const hasS = (pm & AUTOTILE_SOUTH) !== 0;
          const reliefY = dy + (hasS ? 9 : 6) * scale;
          const reliefH = (hasS ? 14 : 8) * scale;
          groundCtx.fillStyle = env.var;
          groundCtx.globalAlpha = 0.55;
          groundCtx.fillRect(dx + 9 * scale, reliefY, 14 * scale, reliefH);
          groundCtx.globalAlpha = 0.65;
          groundCtx.strokeStyle = env.seam;
          groundCtx.lineWidth = 1.1 * scale;
          groundCtx.beginPath();
          groundCtx.moveTo(dx + 9 * scale, reliefY);
          groundCtx.lineTo(dx + 23 * scale, reliefY);
          groundCtx.lineTo(dx + 23 * scale, reliefY + reliefH);
          groundCtx.lineTo(dx + 9 * scale, reliefY + reliefH);
          groundCtx.lineTo(dx + 9 * scale, reliefY);
          groundCtx.stroke();
          groundCtx.restore();
        }
      }
    }

    // Branch B: Active 1-Tile-Thick Sculpted Wall Tile
    if (tile.kind === 'wall' && map) {
      const tx = tile.tx;
      const ty = tile.ty;
      const voidN = ty === 0 || isExteriorVoidWallTile(map, tx, ty - 1);
      const voidS = ty === map.rows - 1 || isExteriorVoidWallTile(map, tx, ty + 1);
      const voidW = tx === 0 || isExteriorVoidWallTile(map, tx - 1, ty);
      const voidE = tx === map.cols - 1 || isExteriorVoidWallTile(map, tx + 1, ty);

      if (voidN || voidS || voidW || voidE) {
        groundCtx.save();
        // 1px ENV_PALETTE[biome].seam inner bevel along void-facing cardinal edges
        groundCtx.strokeStyle = env.seam;
        groundCtx.lineWidth = 1 * scale;
        groundCtx.beginPath();
        if (voidN) {
          groundCtx.moveTo(dx, dy + 1.8 * scale);
          groundCtx.lineTo(dx + cellPx, dy + 1.8 * scale);
        }
        if (voidS) {
          groundCtx.moveTo(dx, dy + cellPx - 1.8 * scale);
          groundCtx.lineTo(dx + cellPx, dy + cellPx - 1.8 * scale);
        }
        if (voidW) {
          groundCtx.moveTo(dx + 1.8 * scale, dy);
          groundCtx.lineTo(dx + 1.8 * scale, dy + cellPx);
        }
        if (voidE) {
          groundCtx.moveTo(dx + cellPx - 1.8 * scale, dy);
          groundCtx.lineTo(dx + cellPx - 1.8 * scale, dy + cellPx);
        }
        groundCtx.stroke();

        // 1.5px PALETTE.INK_DARK outer contour line along void-facing cardinal edges
        groundCtx.strokeStyle = PALETTE.INK_DARK;
        groundCtx.lineWidth = 1.5 * scale;
        groundCtx.beginPath();
        if (voidN) {
          groundCtx.moveTo(dx, dy + 0.75 * scale);
          groundCtx.lineTo(dx + cellPx, dy + 0.75 * scale);
        }
        if (voidS) {
          groundCtx.moveTo(dx, dy + cellPx - 0.75 * scale);
          groundCtx.lineTo(dx + cellPx, dy + cellPx - 0.75 * scale);
        }
        if (voidW) {
          groundCtx.moveTo(dx + 0.75 * scale, dy);
          groundCtx.lineTo(dx + 0.75 * scale, dy + cellPx);
        }
        if (voidE) {
          groundCtx.moveTo(dx + cellPx - 0.75 * scale, dy);
          groundCtx.lineTo(dx + cellPx - 0.75 * scale, dy + cellPx);
        }
        groundCtx.stroke();
        groundCtx.restore();
      }

      // 90° Concave-Corner Parapet Coping Miters whenever the two adjacent cardinal sides of a corner are solid
      const wm = tile.autotileMask & 15;
      const hasN = (wm & AUTOTILE_NORTH) !== 0;
      const hasE = (wm & AUTOTILE_EAST) !== 0;
      const hasS = (wm & AUTOTILE_SOUTH) !== 0;
      const hasW = (wm & AUTOTILE_WEST) !== 0;

      const floorNE =
        hasN && hasE && tx + 1 < map.cols && ty - 1 >= 0 && !map.isSolidTile(tx + 1, ty - 1);
      const floorNW =
        hasN && hasW && tx - 1 >= 0 && ty - 1 >= 0 && !map.isSolidTile(tx - 1, ty - 1);
      const floorSE =
        hasS && hasE && tx + 1 < map.cols && ty + 1 < map.rows && !map.isSolidTile(tx + 1, ty + 1);
      const floorSW =
        hasS && hasW && tx - 1 >= 0 && ty + 1 < map.rows && !map.isSolidTile(tx - 1, ty + 1);

      if (floorNE || floorNW || floorSE || floorSW) {
        groundCtx.save();

        // NE 4x4 parapet coping miter (x = 28..32, y = 0..4), preserving T5-WB-17 recording contract
        if (floorNE) {
          groundCtx.fillStyle = env.wallFront;
          groundCtx.fillRect(dx + 25 * scale, dy, 7 * scale, 6 * scale);
          groundCtx.fillStyle = env.wallTop;
          groundCtx.fillRect(dx + 25 * scale, dy, 3 * scale, 6 * scale);
          groundCtx.fillRect(dx + 28 * scale, dy + 4 * scale, 4 * scale, 2 * scale);
          groundCtx.fillStyle = env.wallFront;
          groundCtx.fillRect(dx + 28 * scale, dy, 4 * scale, 4 * scale);
          groundCtx.strokeStyle = env.rim;
          groundCtx.lineWidth = 1.4 * scale;
          groundCtx.beginPath();
          groundCtx.moveTo(dx + 29.8 * scale, dy + 4 * scale);
          groundCtx.lineTo(dx + 29.8 * scale, dy + 1.8 * scale);
          groundCtx.lineTo(dx + 32 * scale, dy + 1.8 * scale);
          groundCtx.stroke();
          groundCtx.strokeStyle = env.seam;
          groundCtx.lineWidth = 1.1 * scale;
          groundCtx.beginPath();
          groundCtx.moveTo(dx + 28 * scale, dy);
          groundCtx.lineTo(dx + 28 * scale, dy + 4 * scale);
          groundCtx.lineTo(dx + 32 * scale, dy + 4 * scale);
          groundCtx.stroke();
          groundCtx.strokeStyle = PALETTE.INK_DARK;
          groundCtx.lineWidth = 1.8 * scale;
          groundCtx.beginPath();
          groundCtx.moveTo(dx + 30.9 * scale, dy);
          groundCtx.lineTo(dx + 30.9 * scale, dy + 1.1 * scale);
          groundCtx.lineTo(dx + 32 * scale, dy + 1.1 * scale);
          groundCtx.stroke();
        }

        // NW 4x4 parapet coping miter (x = 0..4, y = 0..4), preserving T5-WB-17 recording contract
        if (floorNW) {
          groundCtx.fillStyle = env.wallFront;
          groundCtx.fillRect(dx, dy, 7 * scale, 6 * scale);
          groundCtx.fillStyle = env.wallTop;
          groundCtx.fillRect(dx + 4 * scale, dy, 3 * scale, 6 * scale);
          groundCtx.fillRect(dx, dy + 4 * scale, 4 * scale, 2 * scale);
          groundCtx.fillStyle = env.wallFront;
          groundCtx.fillRect(dx, dy, 4 * scale, 4 * scale);
          groundCtx.strokeStyle = env.rim;
          groundCtx.lineWidth = 1.4 * scale;
          groundCtx.beginPath();
          groundCtx.moveTo(dx + 1.8 * scale, dy + 4 * scale);
          groundCtx.lineTo(dx + 1.8 * scale, dy + 1.8 * scale);
          groundCtx.lineTo(dx + 4 * scale, dy + 1.8 * scale);
          groundCtx.stroke();
          groundCtx.strokeStyle = env.seam;
          groundCtx.lineWidth = 1.1 * scale;
          groundCtx.beginPath();
          groundCtx.moveTo(dx + 4 * scale, dy);
          groundCtx.lineTo(dx + 4 * scale, dy + 4 * scale);
          groundCtx.lineTo(dx, dy + 4 * scale);
          groundCtx.stroke();
          groundCtx.strokeStyle = PALETTE.INK_DARK;
          groundCtx.lineWidth = 1.8 * scale;
          groundCtx.beginPath();
          groundCtx.moveTo(dx + 1.1 * scale, dy);
          groundCtx.lineTo(dx + 1.1 * scale, dy + 1.1 * scale);
          groundCtx.lineTo(dx, dy + 1.1 * scale);
          groundCtx.stroke();
        }

        // SE 4x12 cliff-to-parapet corner miter (x = 28..32, y = 20..32), preserving T5-WB-17 recording contract
        if (floorSE) {
          groundCtx.fillStyle = env.wallFront;
          groundCtx.fillRect(dx + 25 * scale, dy + 21 * scale, 7 * scale, 11 * scale);
          groundCtx.fillStyle = env.wallTop;
          groundCtx.fillRect(dx + 25 * scale, dy + 21 * scale, 3 * scale, 11 * scale);
          groundCtx.fillStyle = env.wallFront;
          groundCtx.fillRect(dx + 28 * scale, dy + 20 * scale, 4 * scale, 12 * scale);
          groundCtx.fillStyle = env.shadow;
          groundCtx.fillRect(dx + 28 * scale, dy + 20 * scale, 4 * scale, 2 * scale);
          groundCtx.strokeStyle = env.seam;
          groundCtx.lineWidth = 1.1 * scale;
          groundCtx.beginPath();
          groundCtx.moveTo(dx + 28 * scale, dy + 20 * scale);
          groundCtx.lineTo(dx + 28 * scale, dy + 32 * scale);
          groundCtx.stroke();
          groundCtx.strokeStyle = PALETTE.INK_DARK;
          groundCtx.lineWidth = 1.8 * scale;
          groundCtx.beginPath();
          groundCtx.moveTo(dx + 32 * scale, dy + 20 * scale);
          groundCtx.lineTo(dx + 28 * scale, dy + 20 * scale);
          groundCtx.lineTo(dx + 30.9 * scale, dy + 20 * scale);
          groundCtx.lineTo(dx + 30.9 * scale, dy + 32 * scale);
          groundCtx.stroke();
        }

        // SW 4x12 cliff-to-parapet corner miter (x = 0..4, y = 20..32), preserving T5-WB-17 recording contract
        if (floorSW) {
          groundCtx.fillStyle = env.wallFront;
          groundCtx.fillRect(dx, dy + 21 * scale, 7 * scale, 11 * scale);
          groundCtx.fillStyle = env.wallTop;
          groundCtx.fillRect(dx + 4 * scale, dy + 21 * scale, 3 * scale, 11 * scale);
          groundCtx.fillStyle = env.wallFront;
          groundCtx.fillRect(dx, dy + 20 * scale, 4 * scale, 12 * scale);
          groundCtx.fillStyle = env.shadow;
          groundCtx.fillRect(dx, dy + 20 * scale, 4 * scale, 2 * scale);
          groundCtx.strokeStyle = env.seam;
          groundCtx.lineWidth = 1.1 * scale;
          groundCtx.beginPath();
          groundCtx.moveTo(dx + 4 * scale, dy + 20 * scale);
          groundCtx.lineTo(dx + 4 * scale, dy + 32 * scale);
          groundCtx.stroke();
          groundCtx.strokeStyle = PALETTE.INK_DARK;
          groundCtx.lineWidth = 1.8 * scale;
          groundCtx.beginPath();
          groundCtx.moveTo(dx, dy + 20 * scale);
          groundCtx.lineTo(dx + 4 * scale, dy + 20 * scale);
          groundCtx.lineTo(dx + 1.1 * scale, dy + 20 * scale);
          groundCtx.lineTo(dx + 1.1 * scale, dy + 32 * scale);
          groundCtx.stroke();
        }

        groundCtx.restore();
      }
    }
  }
}

export function rebuildAllTileCellsToCompositeImpl(this: GameScene): void {
  if (!this.arenaGroundTex) return;
  for (let i = 0; i < this.mapTileVisuals.length; i++) {
    this.renderTileCellToComposite(this.mapTileVisuals[i]!);
  }
  const groundCtx = this.arenaGroundTex.getContext();
  const sim = this.transport?.getSim();
  if (groundCtx && sim) {
    const effectiveBiome: 0 | 1 | 2 | 3 = sim.inHub ? 0 : sim.currentBiome;
    const roomType = sim.inHub
      ? 'start'
      : (sim.dungeon.rooms.find((r) => r.id === sim.currentRoomId)?.type ?? 'combat');
    const plan = buildRoomArchitecturePlan(
      sim.map,
      roomType,
      effectiveBiome,
      `${sim.dungeon.seed}_${sim.currentFloor}_${sim.currentRoomId}`,
    );
    this.biomeArchLive?.setPlan(plan);
    renderBiomeArchitectureToComposite(
      groundCtx,
      sim.map,
      plan,
      TILE_SIZE * this.tileCompositeScale,
    );
  }
  this.arenaGroundTex.refresh();
}

export function buildArenaTilesImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  const map = sim.map;
  const effectiveBiome: 0 | 1 | 2 | 3 = sim.inHub ? 0 : sim.currentBiome;

  this.cameras.main.setBackgroundColor(PALETTE.INK_DEEP);

  const compW = map.width * this.tileCompositeScale;
  const compH = map.height * this.tileCompositeScale;

  if (this.textures.exists('arena_ground_composite')) {
    this.textures.remove('arena_ground_composite');
  }

  this.arenaGroundTex =
    this.textures.createCanvas('arena_ground_composite', compW, compH) ?? undefined;

  if (!this.biomeArchLive) {
    this.biomeArchLive = new BiomeArchitectureLiveLayer(this);
  }

  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      const distToWall = computeTileDistToWall(map, tx, ty);
      const tile: ArenaTileVisual = {
        tx,
        ty,
        kind: map.getTile(tx, ty),
        variant: resolveHybridFloorVariant(tx, ty, distToWall),
        distToWall,
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

  this.lastRenderedBiome = effectiveBiome;
  (this as GameScene & { lastConveyorDirection?: 1 | -1 }).lastConveyorDirection =
    map.conveyorDirection;
  this.lastMapRevision =
    effectiveBiome * 10000000 +
    sim.currentFloor * 1000000 +
    sim.currentRoomId * 10000 +
    map.mapRevision;
}

export function getStructureTextureKeyImpl(
  this: GameScene,
  kind: TileKind,
  autotileMask: number,
  biome: 0 | 1 | 2 | 3 = 1,
): string {
  if (kind === 'pillar') {
    return TextureBaker.getPillarTileTextureKey(biome, autotileMask);
  }
  if (kind === 'cracked_wall') {
    return TextureBaker.getCrackedWallTextureKey(biome);
  }
  return TextureBaker.getWallTileTextureKey(biome, autotileMask);
}

export function syncArenaTilesWithMapRevisionImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  if (sim.stressTestActive) return;
  const map = sim.map;
  const effectiveBiome: 0 | 1 | 2 | 3 = sim.inHub ? 0 : sim.currentBiome;
  const expectedW = map.width * this.tileCompositeScale;
  const expectedH = map.height * this.tileCompositeScale;
  const dimsChanged =
    this.mapTileVisuals.length !== map.cols * map.rows ||
    this.arenaGroundTex?.width !== expectedW ||
    this.arenaGroundTex?.height !== expectedH;
  const sceneWithConv = this as GameScene & { lastConveyorDirection?: 1 | -1 };
  const conveyorFlipped =
    sceneWithConv.lastConveyorDirection !== undefined &&
    map.conveyorDirection !== sceneWithConv.lastConveyorDirection;
  sceneWithConv.lastConveyorDirection = map.conveyorDirection;

  const revKey =
    effectiveBiome * 10000000 +
    sim.currentFloor * 1000000 +
    sim.currentRoomId * 10000 +
    map.mapRevision;
  if (
    !dimsChanged &&
    !conveyorFlipped &&
    revKey === this.lastMapRevision &&
    effectiveBiome === this.lastRenderedBiome
  ) {
    return;
  }
  const biomeChanged = effectiveBiome !== this.lastRenderedBiome;
  this.lastMapRevision = revKey;
  this.lastRenderedBiome = effectiveBiome;

  if (dimsChanged) {
    if (this.textures.exists('arena_ground_composite')) {
      this.textures.remove('arena_ground_composite');
    }
    this.arenaGroundTex =
      this.textures.createCanvas('arena_ground_composite', expectedW, expectedH) ?? undefined;
    if (this.arenaGroundSprite) {
      this.arenaGroundSprite.setTexture('arena_ground_composite');
      this.arenaGroundSprite.setPosition(map.width / 2, map.height / 2);
    }
    this.mapTileVisuals.length = 0;
    for (let ty = 0; ty < map.rows; ty++) {
      for (let tx = 0; tx < map.cols; tx++) {
        const distToWall = computeTileDistToWall(map, tx, ty);
        this.mapTileVisuals.push({
          tx,
          ty,
          kind: map.getTile(tx, ty),
          variant: resolveHybridFloorVariant(tx, ty, distToWall),
          distToWall,
          autotileMask: map.getAutotileMask(tx, ty),
          aoMask: map.getWallAmbientOcclusionMask(tx, ty),
          surface: map.getSurface(tx, ty),
          surfaceMask: map.getSurfaceAutotileMask(tx, ty),
        });
      }
    }
    this.rebuildAllTileCellsToComposite();
    return;
  }

  let groundDirty = conveyorFlipped;

  for (let i = 0; i < this.mapTileVisuals.length; i++) {
    const tile = this.mapTileVisuals[i]!;
    const newKind = map.getTile(tile.tx, tile.ty);
    const newDistToWall = computeTileDistToWall(map, tile.tx, tile.ty);
    const newVariant = resolveHybridFloorVariant(tile.tx, tile.ty, newDistToWall);
    const newMask = map.getAutotileMask(tile.tx, tile.ty);
    const newAo = map.getWallAmbientOcclusionMask(tile.tx, tile.ty);
    const newSurface = map.getSurface(tile.tx, tile.ty);
    const newSurfaceMask = map.getSurfaceAutotileMask(tile.tx, tile.ty);

    if (
      biomeChanged ||
      newKind !== tile.kind ||
      newVariant !== tile.variant ||
      newDistToWall !== tile.distToWall ||
      newMask !== tile.autotileMask ||
      newAo !== tile.aoMask ||
      newSurface !== tile.surface ||
      newSurfaceMask !== tile.surfaceMask
    ) {
      groundDirty = true;
      tile.kind = newKind;
      tile.variant = newVariant;
      tile.distToWall = newDistToWall;
      tile.autotileMask = newMask;
      tile.aoMask = newAo;
      tile.surface = newSurface;
      tile.surfaceMask = newSurfaceMask;
    }
  }

  if (groundDirty) {
    this.rebuildAllTileCellsToComposite();
  }
}

export function triggerIrisTransitionImpl(this: GameScene, mode: 'open' | 'close' = 'open'): void {
  if (mode === 'close') {
    this.irisTransitionDir = -1;
    this.irisTransitionProgress = 0.02;
  } else {
    this.irisTransitionDir = 1;
    this.irisTransitionProgress = 1.0;
  }
}

export function teleportToRoomImpl(this: GameScene, targetRoomId: number): boolean {
  const sim = this.transport?.getSim();
  if (!sim || !canTeleportFromCurrentRoom(sim)) return false;
  const targetRoom = sim.dungeon.rooms[targetRoomId];
  if (
    !targetRoom ||
    targetRoom.id === sim.currentRoomId ||
    (targetRoom.discovery !== 'visited' && targetRoom.discovery !== 'cleared')
  ) {
    return false;
  }

  const oldX = sim.player.x;
  const oldY = sim.player.y;
  this.fx?.spawnShaderNova?.(oldX, oldY, 72, 'fx_sh_arcane_sigil', {
    tint: 0x38bdf8,
    ttl: 0.26,
  });
  this.lighting?.spawnTransientLight?.(oldX, oldY, 140, PALETTE.CYAN_FROST, 0.9, 0.3);

  if (this.fullMapOpen) {
    this.fullMapOpen = false;
    initGlobalDebugState().fullMapOpen = false;
  }

  const entered = sim.enterRoom(targetRoomId);
  if (!entered) return false;
  sim.doorTransitionCooldown = Math.max(sim.doorTransitionCooldown, 0.75);

  if (this.room && this.coopMode !== 'solo') {
    this.room.send('teleport_room', { roomId: targetRoomId });
  }

  if (this.textures) {
    this.syncArenaTilesWithMapRevision();
  }
  if (
    typeof this.processSimEvents === 'function' &&
    typeof this.transport.consumeEvents === 'function'
  ) {
    this.processSimEvents(this.transport.consumeEvents());
  }
  this.lastMinimapHash = '';

  if (typeof this.triggerIrisTransition === 'function') {
    this.triggerIrisTransition('close');
  } else {
    triggerIrisTransitionImpl.call(this, 'close');
  }
  this.roomTeleportAnimTimer = this.roomTeleportAnimDuration ?? 0.28;
  zzfx.play('portal_enter');
  this.fx?.spawnShaderNova?.(sim.player.x, sim.player.y, 88, 'fx_sh_arcane_sigil', {
    tint: 0x38bdf8,
    ttl: 0.34,
  });
  this.fx?.spawnChestOpenBurst?.(sim.player.x, sim.player.y, 'rare');
  this.lighting?.spawnTransientLight?.(
    sim.player.x,
    sim.player.y,
    180,
    PALETTE.CYAN_FROST,
    1.0,
    0.45,
  );
  this.fx?.addTrauma?.(0.2);
  this.fx?.spawnFloatingAlert?.(
    sim.player.x,
    sim.player.y - 18,
    i18n.getLocale() === 'en' ? '⚡ TELEPORT!' : '⚡ DỊCH CHUYỂN!',
    PALETTE.CYAN_FROST,
  );
  return true;
}

export function applyCameraViewportImpl(this: GameScene): void {
  const cam = this.cameras?.main;
  if (!cam) return;
  const vp = computeUniformViewportMetrics(this.scale.width, this.scale.height);
  const zoom = vp.zoom;
  this.hudPadX = vp.padX;
  this.hudPadY = vp.padY;
  const prevScale = TextureBaker.getBakeScale();
  const newScale = TextureBaker.bakeAll(this, zoom, false);
  initGlobalDebugState().bakeScale = newScale;

  if (newScale !== prevScale) {
    const invBake = 1 / newScale;
    this.playerRig?.refreshBakedTextures();
    for (const rig of this.simPlayerRigs.values()) {
      rig.refreshBakedTextures();
    }
    for (const entry of this.coopPlayerRigs.values()) {
      entry.rig.refreshBakedTextures();
      entry.nameLabel.setResolution(newScale * 2);
      entry.emoteLabel.setResolution(newScale);
    }
    for (const entry of this.hubStatueRigs.values()) {
      entry.rig.refreshBakedTextures();
      entry.glowSprite.setTexture('fx_light_radial');
      entry.label.setResolution(newScale);
      entry.subLabel.setResolution(newScale);
    }
    for (const gTxt of this.hubGuideTexts) {
      gTxt.setResolution(newScale);
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
      const baseInv = item.textureKey.startsWith('proj_stress_') ? stressInvBake : invBake;
      item.sprite.setTexture(item.textureKey);
      item.sprite.setScale(baseInv * item.specScale);
      item.glowSprite.setTexture('fx_enemy_bullet_glow');
      item.glowSprite.setScale(baseInv * item.specScale * 1.05);
    }
    for (const item of this.projectileSpritePool) {
      const baseInv = item.textureKey.startsWith('proj_stress_') ? stressInvBake : invBake;
      item.sprite.setTexture(item.textureKey);
      item.sprite.setScale(baseInv * item.specScale);
      item.glowSprite.setTexture('fx_enemy_bullet_glow');
      item.glowSprite.setScale(baseInv * item.specScale * 1.05);
    }
    for (const item of this.pickupSprites.values()) {
      item.sprite.setTexture(item.textureKey);
      item.sprite.setScale(invBake);
      item.glowSprite.setTexture('fx_light_radial');
    }
    for (const item of this.pickupSpritePool) {
      item.sprite.setTexture(item.textureKey);
      item.sprite.setScale(invBake);
      item.glowSprite.setTexture('fx_light_radial');
    }
    const sim = this.transport?.getSim();
    this.weaponIconSprites.forEach((icon, idx) => {
      const wId = sim?.player.weaponSlots[idx];
      if (wId) {
        icon.setVisible(true);
        icon.setTexture(TextureBaker.getWeaponTextureKey(wId));
        icon.setScale(invBake * 0.82);
      } else {
        icon.setVisible(false);
      }
    });
    if (this.crosshairSprite) {
      this.crosshairSprite.setTexture('ui_crosshair');
      this.crosshairSprite.setScale(invBake);
    }
    const hudTextRes = Math.min(4, newScale);
    for (const txt of this.textObjects) {
      txt.setResolution(hudTextRes);
    }
    for (const txt of this.pingVisuals.values()) {
      txt.setResolution(hudTextRes);
    }
    this.destroyPortalAndDoorVisuals();
    for (const sprite of this.chestSprites.values()) {
      sprite.destroy();
    }
    this.chestSprites.clear();
    for (const glow of this.chestGlowSprites.values()) {
      glow.destroy();
    }
    this.chestGlowSprites.clear();
    for (const sparkles of this.chestSparkleSprites.values()) {
      for (const sp of sparkles) sp.destroy();
    }
    this.chestSparkleSprites.clear();
    for (const entry of this.worldItemSprites.values()) {
      entry.sprite.destroy();
      entry.glowSprite.destroy();
      entry.beamSprite.destroy();
      entry.shopMatSprite.destroy();
      entry.label.destroy();
    }
    this.worldItemSprites.clear();
    for (const entry of this.npcVisuals.values()) {
      entry.rig?.destroy();
      entry.sprite?.destroy();
      entry.glowSprite.destroy();
      entry.label.destroy();
    }
    this.npcVisuals.clear();
    if (this.portalLabel) {
      this.portalLabel.destroy();
      this.portalLabel = undefined;
    }
    if (this.hudContainer) {
      this.invalidateAllHudCaches();
      if (!sim?.stressTestActive) {
        this.syncRoomEntities(0);
      }
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
  this.hudScene?.applyViewport();
  if (this.hudContainer) {
    applyHudEdgeAnchors(this);
  }
  this.debugOverlay?.resetSamples();
}

export function updateIrisTransitionImpl(this: GameScene, dtSec: number): void {
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

  const maxHoleR =
    Math.hypot(WORLD_VIEW_WIDTH * 0.5 + this.hudPadX, WORLD_VIEW_HEIGHT * 0.5 + this.hudPadY) +
    40;
  const holeR = computeIrisHoleRadius(this.irisTransitionProgress, maxHoleR);
  const ringThickness = 840;
  g.lineStyle(ringThickness, hexToNum(PALETTE.INK_DARK), 1);
  g.strokeCircle(480, 270, holeR + ringThickness * 0.5);
  g.lineStyle(3.2, hexToNum(PALETTE.SOLAR_GOLD), 0.92);
  g.strokeCircle(480, 270, holeR);
  if (holeR > 5) {
    g.lineStyle(1.6, hexToNum(PALETTE.CYAN_FROST), 0.72);
    g.strokeCircle(480, 270, holeR - 2.5);
  }
}

export function updateCameraWithLookaheadAndShakeImpl(
  this: GameScene,
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

  const zoom = Math.max(0.1, cam.zoom || 1);
  const viewW = cam.width > 0 ? cam.width / zoom : WORLD_VIEW_WIDTH;
  const viewH = cam.height > 0 ? cam.height / zoom : WORLD_VIEW_HEIGHT;
  const halfW = viewW * 0.5;
  const halfH = viewH * 0.5;
  const minCamX = halfW - 32;
  const maxCamX = map.width - halfW + 32;
  const minCamY = halfH - 32;
  const maxCamY = map.height - halfH + 32;
  const clampedX = minCamX > maxCamX ? map.width * 0.5 : clamp(this.camFocusX, minCamX, maxCamX);
  const clampedY = minCamY > maxCamY ? map.height * 0.5 : clamp(this.camFocusY, minCamY, maxCamY);

  const shake = this.fx.computeCameraShakeOffset(dtSec);
  this.lastShakeX = shake.offsetX;
  this.lastShakeY = shake.offsetY;
  const finalCamX = clampedX + shake.offsetX;
  const finalCamY = clampedY + shake.offsetY;
  cam.centerOn(finalCamX, finalCamY);
}
