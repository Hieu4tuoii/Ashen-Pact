import {
  clamp,
  i18n,
  INPUT_BUTTON,
  type InteractTargetResult,
  LocalTransport,
  NetworkTransport,
  type PropKind,
  type QuickEmoteId,
  type SimEnemyState,
  type SimEvent,
  type SurfaceKind,
  type TileKind,
  type WifiProfileId,
} from '@ashen-pact/shared';
import { type Client as ColyseusClient, type Room as ColyseusRoom } from 'colyseus.js';
import Phaser from 'phaser';
import type { CutoutRig } from '../art/cutout-rig.js';
import { shouldEmitFootstepDust } from '../art/cutout-rig-math.js';
import { dampLerp } from '../art/easing.js';
import { RIG_DEFS_BY_ID, VANGUARD_RIG_DEF } from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import { musicManager } from '../audio/music-synth.js';
import { zzfx } from '../audio/zzfx.js';
import { getFreezeVisualTimeSec, getVisualQueryConfig } from '../core/visual-query.js';
import type { CombatFxManager } from '../fx/combat-fx.js';
import {
  type InteractableLightEntry,
  populateInteractableLightsScratch,
} from '../fx/lighting-config.js';
import type { LightingPipeline } from '../fx/lighting-pipeline.js';
import { createPortalAnimState, type PortalAnimState } from '../fx/portal-door-shaders.js';
import type { DebugOverlay } from '../ui/debug-overlay.js';
import { type GraphicsQualityTier, graphicsSettings } from '../ui/graphics-settings.js';
import type { ModalOverlayManager } from '../ui/settings-modal.js';
import type { BiomeArchitectureLiveLayer } from '../world/biome-architecture.js';
import type { HudScene } from './HudScene.js';
import { applyCameraViewportImpl, buildArenaTilesImpl, createImpl, drawSourceKeyToCtxImpl, getStructureTextureKeyImpl, rebuildAllTileCellsToCompositeImpl, renderTileCellToCompositeImpl, setStressTestModeImpl, syncArenaTilesWithMapRevisionImpl, triggerIrisTransitionImpl, updateCameraWithLookaheadAndShakeImpl, updateIrisTransitionImpl } from './game-scene/arena-tiles.js';
import { resolveEnemyStatusTintImpl, resolvePlayerStatusTintImpl, syncEnemyRigsImpl, syncProjectilesAndPickupsImpl, syncPropsImpl, syncSimulatedPlayersImpl, updatePlayerOverheadUiImpl } from './game-scene/entity-sync.js';
import {
  renderViDiacriticsShowcaseImpl,
  triggerPlayerHitDirectionIndicatorImpl,
  triggerRoomClearedBannerImpl,
  triggerWaveBannerImpl,
  updateBossHudImpl,
  updateCoopTeammateHudImpl,
  updateMinimapHudImpl,
  updateOffscreenTeammateArrowsImpl,
  updateTopCenterBannersAndQolImpl,
  updateVectorHudImpl,
} from './game-scene/hud-combat-and-coop.js';
import { updateEmoteWheelHudImpl, updateHubCharacterSkillPreviewImpl, updateHubInvitePanelImpl, updateWeaponComparisonCardImpl } from './game-scene/hud-hub-and-cards.js';
import { updateDebugStateImpl, updateModalHudImpl } from './game-scene/hud-modals-and-debug.js';
import { buildVectorHudImpl, invalidateAllHudCachesImpl, rebuildPauseModalImpl, togglePauseModalImpl } from './game-scene/hud-setup-and-pause.js';
import { bindCoopRoomHandlersImpl, connectCoopRoomImpl, connectHelloRoomImpl, fetchHostLanInfoImpl, forceCoopReconnectImpl, getResolvedWsUrlImpl, setupKeyboardBindingsImpl, updateHostInviteUrlImpl } from './game-scene/input-and-network.js';
import {
  createInteractPromptFadeState,
  type InteractPromptFadeState,
  type InteractPromptPillVisuals,
} from './game-scene/interact-prompt.js';
import {
  destroyPortalAndDoorVisualsImpl,
  type DoorVisualEntry,
  type PortalVisualGroup,
  resetPortalAndDoorTestStateImpl,
  syncDoorVisualsImpl,
  syncPortalVisualsImpl,
  triggerDoorCombatLockupImpl,
  triggerDoorUnlockTransitionImpl,
  triggerPortalActivationBurstImpl,
  triggerPortalEnterSequenceImpl,
} from './game-scene/portal-door-sync.js';
import { syncRoomEntitiesImpl } from './game-scene/room-entities-sync.js';
import { processSimEventsImpl } from './game-scene/sim-events.js';
import { drawEnemyHealthAndStatusBarImpl, renderHitboxesIfEnabledImpl, renderTelegraphsAndShieldImpl } from './game-scene/telegraphs-and-overlays.js';

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
    __GAME_SET_LIGHTING__?: (enabled: boolean) => void;
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
export const RIG_FOOT_OFFSET_Y = 12;

export interface ArenaTileVisual {
  tx: number;
  ty: number;
  kind: TileKind;
  variant: number;
  distToWall: number;
  autotileMask: number;
  aoMask: number;
  surface: SurfaceKind;
  surfaceMask: number;
}

export interface PropVisual {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Sprite;
  kind: PropKind;
  lastHp: number;
  flashTimer: number;
  isFlashed: boolean;
}

export class GameScene extends Phaser.Scene {
  public transport!: LocalTransport | NetworkTransport;
  public networkTransport: NetworkTransport | null = null;
  public coopMode: 'solo' | 'host' | 'join' = 'solo';
  public requestedRoomId: string | undefined;
  public displayName = 'Hiệp Sĩ Tro';
  public serverUrl: string | undefined;
  public reconnectToken: string | null = null;
  public hostInviteUrl: string | null = null;
  public lanIps: string[] = [];
  public primaryLanIp = '127.0.0.1';
  public serverPort = 2567;
  public invitePanelVisible = false;
  public copyToastTimer = 0;

  public fx!: CombatFxManager;
  public lighting!: LightingPipeline;
  public playerRig?: CutoutRig;
  public simPlayerRigs = new Map<number, CutoutRig>();
  public coopPlayerRigs = new Map<
    number,
    {
      rig: CutoutRig;
      nameLabel: Phaser.GameObjects.Text;
      emoteLabel: Phaser.GameObjects.Text;
      emoteBg: Phaser.GameObjects.Graphics;
    }
  >();
  public localNameLabel?: Phaser.GameObjects.Text;
  public localEmoteLabel?: Phaser.GameObjects.Text;
  public localEmoteBg?: Phaser.GameObjects.Graphics;
  public hubStatueRigs = new Map<
    string,
    {
      rig: CutoutRig;
      glowSprite: Phaser.GameObjects.Image;
      label: Phaser.GameObjects.Text;
      subLabel: Phaser.GameObjects.Text;
    }
  >();
  public pingVisuals = new Map<number, Phaser.GameObjects.Text>();
  public enemyRigs = new Map<number, CutoutRig>();
  public propVisuals = new Map<number, PropVisual>();
  public projectileSprites = new Map<
    number,
    { sprite: Phaser.GameObjects.Sprite; textureKey: string }
  >();
  public pickupSprites = new Map<
    number,
    {
      sprite: Phaser.GameObjects.Sprite;
      glowSprite: Phaser.GameObjects.Image;
      textureKey: string;
    }
  >();
  public projectileSpritePool: {
    sprite: Phaser.GameObjects.Sprite;
    textureKey: string;
  }[] = [];
  public pickupSpritePool: {
    sprite: Phaser.GameObjects.Sprite;
    glowSprite: Phaser.GameObjects.Image;
    textureKey: string;
  }[] = [];

  // Phase 3 Room Visuals (Doors, Chests, World Items, NPCs, Portal)
  public doorSprites = new Map<string, DoorVisualEntry>();
  public chestSprites = new Map<number, Phaser.GameObjects.Sprite>();
  public chestGlowSprites = new Map<number, Phaser.GameObjects.Image>();
  public chestSparkleSprites = new Map<number, Phaser.GameObjects.Image[]>();
  public worldItemSprites = new Map<
    number,
    {
      sprite: Phaser.GameObjects.Sprite;
      glowSprite: Phaser.GameObjects.Image;
      beamSprite: Phaser.GameObjects.Image;
      shopMatSprite: Phaser.GameObjects.Image;
      label: Phaser.GameObjects.Text;
    }
  >();
  public npcVisuals = new Map<
    number,
    {
      rig?: CutoutRig;
      sprite?: Phaser.GameObjects.Sprite;
      glowSprite: Phaser.GameObjects.Image;
      label: Phaser.GameObjects.Text;
    }
  >();
  public portalSprite?: Phaser.GameObjects.Sprite;
  public portalGlowSprite?: Phaser.GameObjects.Image;
  public portalLabel?: Phaser.GameObjects.Text;
  public portalVisualGroup?: PortalVisualGroup;
  public portalAnimState: PortalAnimState = createPortalAnimState();
  public portalDoorAnimClockSec = 0;
  public lastDoorRoomKey = '';
  public interactHighlightGraphics!: Phaser.GameObjects.Graphics;
  public interactPromptState: InteractPromptFadeState = createInteractPromptFadeState();
  public currentInteractTarget: InteractTargetResult | null = null;
  public interactPromptVisuals?: InteractPromptPillVisuals;

  public readonly activeEnemyIds = new Set<number>();
  public readonly activeSimPlayerIds = new Set<number>();
  public readonly activeCoopPlayerIds = new Set<number>();
  public readonly activePingIds = new Set<number>();
  public readonly activePropIds = new Set<number>();
  public readonly activeProjIds = new Set<number>();
  public readonly activePickupIds = new Set<number>();
  public readonly activeChestIds = new Set<number>();
  public readonly activeWorldItemIds = new Set<number>();
  public readonly activeNpcIds = new Set<number>();
  public readonly activeDoorKeys = new Set<string>();

  public readonly playerPosPreScratch = { x: 0, y: 0 };
  public readonly playerPosScratch = { x: 0, y: 0 };
  public readonly entityPosScratch = { x: 0, y: 0 };
  public readonly simPlayerLightingScratch: {
    pos: { x: number; y: number };
    state: ReturnType<LocalTransport['getSim']>['player'];
  }[] = [];
  public readonly interactableLightsScratch: InteractableLightEntry[] = [];

  public mapTileVisuals: ArenaTileVisual[] = [];
  public arenaGroundTex?: Phaser.Textures.CanvasTexture;
  public arenaGroundSprite?: Phaser.GameObjects.Image;
  public biomeArchLive?: BiomeArchitectureLiveLayer;
  public readonly tileCompositeScale = 2;
  public lastMapRevision = -1;
  public lastRenderedBiome: 0 | 1 | 2 | 3 = 1;
  public dashAfterimageTimer = 0;
  public textObjects: Phaser.GameObjects.Text[] = [];

  // Cached HUD state to avoid redundant per-frame Canvas2D text uploads
  public currentHudUiScale = 1.0;
  public lastHudLocale = '';
  public lastHudHp = -1;
  public lastHudArmor = -1;
  public lastHudEnergy = -1;
  public lastHudGold = -1;
  public lastHudCharacterId = '';
  public lastHudBarsExtraHash = '';
  public lastAbilityHudHash = '';
  public lastHudWeaponHash = '';
  public lastHudElement = '';
  public lastHudQuality = '';
  public lastHudStatsText = '';
  public lastMinimapHash = '';
  public lastBossHudHash = '';
  public lastCoopHudHash = '';
  public lastInvitePanelHash = '';
  public lastHubPreviewHash = '';
  public lastWeaponCompareHash = '';
  public lastEmoteWheelHash = '';
  public emoteWheelOpen = false;
  public emoteWheelHoveredId: QuickEmoteId | null = null;
  public lastRunState = 'playing';
  public resultDismissed = false;
  public fullMapOpen = false;
  public pauseModalOpen = false;
  public pauseConfirmExitOpen = false;
  public buffHoveredIdx: number | null = null;
  public trailingHpRatio = 1.0;
  public trailingArmorRatio = 1.0;
  public trailingBossHpRatio = 1.0;
  public lowHpHeartbeatTimer = 0;
  public lastBlizzardPhase3 = false;
  public irisTransitionProgress = 0.0;
  public irisTransitionDir: -1 | 0 | 1 = 0;
  public playerHitIndicatorTimer = 0;
  public playerHitIndicatorAngleRad = 0;
  public hudBannerTimer = 0;
  public hudBannerTextStr = '';
  public hudBannerAccentColor = 0xfacc15;
  public lastBannerRoomId = -1;
  public lastBannerWaveNumber = -1;
  public lastBannerRoomCleared = false;

  public telegraphGraphics!: Phaser.GameObjects.Graphics;
  public hitboxGraphics!: Phaser.GameObjects.Graphics;
  public crosshairSprite!: Phaser.GameObjects.Sprite;

  // Camera-pinned HUD elements
  public hudScene?: HudScene;
  public hudPadX = 0;
  public hudPadY = 0;
  public hudTopBarBg?: Phaser.GameObjects.Graphics;
  public hudBottomBarBg?: Phaser.GameObjects.Graphics;
  public hudTopLeftContainer?: Phaser.GameObjects.Container;
  public hudTopCenterContainer?: Phaser.GameObjects.Container;
  public hudTopRightContainer?: Phaser.GameObjects.Container;
  public hudBottomRightContainer?: Phaser.GameObjects.Container;
  public hudBottomCenterContainer?: Phaser.GameObjects.Container;
  public get uiScene(): Phaser.Scene {
    return this.hudScene ?? this;
  }
  public hudContainer!: Phaser.GameObjects.Container;
  public hudBarsGraphics!: Phaser.GameObjects.Graphics;
  public abilityHudGraphics!: Phaser.GameObjects.Graphics;
  public skillCdText!: Phaser.GameObjects.Text;
  public dashCdText!: Phaser.GameObjects.Text;
  public skillLabelText?: Phaser.GameObjects.Text;
  public dashLabelText?: Phaser.GameObjects.Text;
  public pauseBtnBg?: Phaser.GameObjects.Graphics;
  public pauseBtnText?: Phaser.GameObjects.Text;
  public pauseBtnHit?: Phaser.GameObjects.Rectangle;
  public menuBtnText?: Phaser.GameObjects.Text;
  public hubGuideTexts: Phaser.GameObjects.Text[] = [];
  public minimapGraphics!: Phaser.GameObjects.Graphics;
  public minimapTitleText!: Phaser.GameObjects.Text;
  public bossBarGraphics!: Phaser.GameObjects.Graphics;
  public bossTitleText!: Phaser.GameObjects.Text;
  public waveBannerGraphics?: Phaser.GameObjects.Graphics;
  public waveBannerText?: Phaser.GameObjects.Text;
  public reactionBannerGraphics?: Phaser.GameObjects.Graphics;
  public reactionBannerText?: Phaser.GameObjects.Text;
  public downedBannerGraphics?: Phaser.GameObjects.Graphics;
  public downedBannerText?: Phaser.GameObjects.Text;
  public coopHudContainer!: Phaser.GameObjects.Container;
  public invitePanelContainer!: Phaser.GameObjects.Container;
  public hubPreviewContainer!: Phaser.GameObjects.Container;
  public weaponCompareContainer!: Phaser.GameObjects.Container;
  public emoteWheelContainer!: Phaser.GameObjects.Container;
  public pauseContainer!: Phaser.GameObjects.Container;
  public irisGraphics!: Phaser.GameObjects.Graphics;
  public settingsModal?: ModalOverlayManager;
  public offscreenArrowGraphics!: Phaser.GameObjects.Graphics;
  public playerHitArcGraphics?: Phaser.GameObjects.Graphics;
  public viDiacriticsContainer?: Phaser.GameObjects.Container;
  public modalContainer!: Phaser.GameObjects.Container;
  public playerClassLabelText?: Phaser.GameObjects.Text;
  public hpLabelText!: Phaser.GameObjects.Text;
  public armorLabelText!: Phaser.GameObjects.Text;
  public energyLabelText!: Phaser.GameObjects.Text;
  public goldLabelText?: Phaser.GameObjects.Text;
  public statusLineText?: Phaser.GameObjects.Text;
  public statsLineText!: Phaser.GameObjects.Text;
  public statusText?: Phaser.GameObjects.Text;
  public qualityBtnText?: Phaser.GameObjects.Text;
  public elementBtnText?: Phaser.GameObjects.Text;
  public galleryBtnText?: Phaser.GameObjects.Text;
  public unsubDebugFlags?: () => void;
  public weaponSlotBgs: Phaser.GameObjects.Graphics[] = [];
  public weaponIconSprites: Phaser.GameObjects.Sprite[] = [];
  public weaponNameTexts: Phaser.GameObjects.Text[] = [];
  public weaponMetaTexts: Phaser.GameObjects.Text[] = [];
  public weaponKeyTexts: Phaser.GameObjects.Text[] = [];

  public debugOverlay?: DebugOverlay;
  public room?: ColyseusRoom;
  public colyseusClient?: ColyseusClient;
  public intentionalLeave = false;

  public inputSeq = 0;
  public queuedWeaponSlot: number | null = null;
  public wheelSwapQueued = false;
  public dashQueued = false;
  public skillQueued = false;
  public interactQueued = false;
  public reloadVentQueued = false;
  public dropWeaponQueued = false;
  public readyToggleQueued = false;
  public pingQueued: { x: number; y: number } | null = null;
  public queuedEmote: QuickEmoteId | null = null;

  // Smooth camera tracking state
  public camFocusX = 480;
  public camFocusY = 270;
  public lastShakeX = 0;
  public lastShakeY = 0;
  public crosshairPulse = 0;

  public keys?: {
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
    T: Phaser.Input.Keyboard.Key;
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

  public override update(_time: number, rawDeltaMs: number): void {
    if (getVisualQueryConfig().freeze) {
      rawDeltaMs = 16.6667;
    }
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
      if (this.keys.R.isDown) buttons |= INPUT_BUTTON.RELOAD_VENT;
      if (this.keys.X.isDown) buttons |= INPUT_BUTTON.DROP_WEAPON;
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
    if (this.reloadVentQueued) {
      if (!isModalOrPaused) buttons |= INPUT_BUTTON.RELOAD_VENT;
      this.reloadVentQueued = false;
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

    // Left mouse button -> FIRE (except when clicking top/bottom HUD buttons, Invite panel, Emote Wheel, or modal)
    const hudPt = this.uiScene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const localViewX = hudPt.x;
    const localViewY = hudPt.y;
    let suppressFireForEmoteWheel = false;
    if (this.emoteWheelOpen) {
      suppressFireForEmoteWheel = true;
      const dx = localViewX - 480;
      const dy = localViewY - 270;
      const dist = Math.hypot(dx, dy);
      if (dist >= 22) {
        this.emoteWheelHoveredId = (
          Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 1 : 3) : dx > 0 ? 2 : 4
        ) as QuickEmoteId;
      } else {
        this.emoteWheelHoveredId = null;
      }
      if (pointer.leftButtonDown() && this.emoteWheelHoveredId !== null) {
        this.queuedEmote = this.emoteWheelHoveredId;
        this.emoteWheelOpen = false;
        this.emoteWheelHoveredId = null;
      }
    }

    const emoteId = !isModalOrPaused ? (this.queuedEmote ?? undefined) : undefined;
    this.queuedEmote = null;

    const isClickingInvitePanel =
      sim.inHub &&
      this.invitePanelVisible &&
      localViewX >= 676 + this.hudPadX &&
      localViewX <= 952 + this.hudPadX &&
      localViewY >= 70 - this.hudPadY &&
      localViewY <= 470 - this.hudPadY;
    const isClickingHud =
      localViewY < 68 - this.hudPadY ||
      localViewY > 480 + this.hudPadY ||
      isClickingInvitePanel ||
      suppressFireForEmoteWheel ||
      isModalOrPaused ||
      (this.transport.getLocalPlayerState().mutatorChoices?.length ?? 0) > 0 ||
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

    if (this.portalAnimState.enterActive) {
      moveX = 0;
      moveY = 0;
      buttons = 0;
    } else if (
      !isSoloPaused &&
      (buttons & INPUT_BUTTON.INTERACT) !== 0 &&
      this.coopMode === 'solo' &&
      this.currentInteractTarget?.kind === 'portal' &&
      sim.portalActive &&
      (!sim.inHub || sim.areAllPlayersReady() || sim.player.slot === 1)
    ) {
      buttons &= ~INPUT_BUTTON.INTERACT;
      this.triggerPortalEnterSequence(true);
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
      const prevAnimTime = this.playerRig.getAnimTime();
      const charRigDef = RIG_DEFS_BY_ID[sim.player.characterId] ?? VANGUARD_RIG_DEF;
      this.playerRig.setRigDef(charRigDef);
      this.playerRig.setPlayerSlot(sim.player.slot);
      this.playerRig.setLifeState(sim.player.lifeState);
      this.playerRig.setReviveProgress(sim.player.reviveProgress ?? 0);
      this.playerRig.container.setPosition(playerPos.x, playerPos.y + RIG_FOOT_OFFSET_Y);
      this.playerRig.setAimAngle(aimAngle);
      this.playerRig.setEquippedWeapon(sim.getActiveWeaponId());
      this.playerRig.setDashActive(sim.player.dashTimer > 0);
      this.playerRig.setMoveVelocity(sim.player.vx, sim.player.vy);
      this.playerRig.setElementalStatusTint(this.resolvePlayerStatusTint());

      const isMoving =
        sim.player.lifeState === 'alive' && Math.hypot(sim.player.vx, sim.player.vy) > 12;
      if (sim.player.lifeState === 'downed') {
        this.playerRig.setAnimState(
          (sim.player.reviveProgress ?? 0) > 0.05 ? 'revive' : 'downed',
        );
      } else {
        this.playerRig.setAnimState(isMoving ? 'run' : 'idle');
      }
      if (!isSoloPaused) {
        this.playerRig.update(dtSec);
        if (
          shouldEmitFootstepDust(
            prevAnimTime,
            this.playerRig.getAnimTime(),
            isMoving && sim.player.dashTimer <= 0,
            false,
            sim.stressTestActive,
          )
        ) {
          this.fx.spawnFootstepDust(
            playerPos.x,
            playerPos.y + RIG_FOOT_OFFSET_Y,
            sim.currentBiome,
          );
        }
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
    const isBlizzardPhase3 = activeBoss?.defId === 'kryssa_ice_queen' && activeBoss.bossPhase === 3;
    if (isBlizzardPhase3 && !this.lastBlizzardPhase3 && activeBoss) {
      zzfx.play('boss_phase_change', activeBoss.x, this.camFocusX, activeBoss.y, this.camFocusY);
      this.fx.spawnFloatingAlert(
        activeBoss.x,
        activeBoss.y,
        i18n.getLocale() === 'en' ? '❄ ETERNAL BLIZZARD!' : '❄ BÃO TUYẾT VĨNH CỬU!',
      );
    }
    this.lastBlizzardPhase3 = isBlizzardPhase3;
    this.fx.setBiome(sim.currentBiome);
    this.fx.setBlizzardIntense(isBlizzardPhase3);
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

    this.lighting.setBiome(sim.currentBiome);
    this.lighting.setBlizzardVeil(isBlizzardPhase3);
    if (sim.stressTestActive) {
      this.interactableLightsScratch.length = 0;
    } else {
      const qualityTier = graphicsSettings.getState().quality;
      populateInteractableLightsScratch(this.interactableLightsScratch, {
        tier: qualityTier,
        elapsedSec: getFreezeVisualTimeSec(this.lighting.getElapsedSec()),
        simTick: sim.tick,
        biome: sim.currentBiome,
        inHub: sim.inHub,
        hubReady: sim.areAllPlayersReady(),
        roomType: sim.getCurrentRoom().type,
        playerId: sim.player.id,
        portalActive: sim.portalActive,
        portalX: sim.portalX,
        portalY: sim.portalY,
        chests: sim.chests,
        worldItems: sim.worldItems,
        pickups: sim.pickups,
        doors: sim.doors,
        npcEntities: sim.npcEntities,
        hubStatues: sim.hubStatues,
      });
    }
    this.lighting.update({
      dtSec: animDt,
      playerPos,
      player: sim.player,
      simulatedPlayers: this.simPlayerLightingScratch,
      enemies: sim.enemies,
      projectiles: sim.projectiles,
      props: sim.props,
      interactableLights: this.interactableLightsScratch,
      map: sim.map,
      trauma: sim.runState === 'playing' && !isSoloPaused ? this.fx.getTrauma() : 0,
      inHub: sim.inHub,
    });
    if (!sim.stressTestActive) {
      this.biomeArchLive?.update({
        dtSec: animDt,
        map: sim.map,
        props: sim.props,
        lightingEnabled: this.lighting.isLightmapVisible(),
      });
    }

    // 10. Update Procedural Crosshair at Mouse HUD Position
    const invBake = 1 / TextureBaker.getBakeScale();
    if (this.crosshairPulse > 0) {
      this.crosshairPulse = Math.max(0, this.crosshairPulse - dtSec * 5);
    }
    const modalBlockingCrosshair =
      sim.runState !== 'playing' ||
      this.pauseModalOpen ||
      (this.settingsModal?.isOpen() ?? false) ||
      this.fullMapOpen;
    this.crosshairSprite.setVisible(!modalBlockingCrosshair);
    this.crosshairSprite.setPosition(hudPt.x, hudPt.y);
    this.crosshairSprite.setScale(invBake * (1 + this.crosshairPulse * 0.35));

    // 11. Draw Telegraphs, Spawn Circles, Elemental Badges, Shield Wall, Revive Rings & Optional F4 Hitboxes
    this.renderTelegraphsAndShield(playerPos.x, playerPos.y);
    this.renderHitboxesIfEnabled();

    // 12. Update Camera-Pinned Vector HUD, Iris Transition & Debug Telemetry
    this.updateVectorHud();
    this.updateIrisTransition(dtSec);
    this.updateDebugState(playerPos.x, playerPos.y);
  }

  public create(): void { createImpl.call(this); }
  public setStressTestMode(active: boolean): void { setStressTestModeImpl.call(this, active); }
  public drawSourceKeyToCtx(ctx: CanvasRenderingContext2D, key: string, dx: number, dy: number, cellPx: number): void { drawSourceKeyToCtxImpl.call(this, ctx, key, dx, dy, cellPx); }
  public renderTileCellToComposite(tile: ArenaTileVisual): void { renderTileCellToCompositeImpl.call(this, tile); }
  public rebuildAllTileCellsToComposite(): void { rebuildAllTileCellsToCompositeImpl.call(this); }
  public buildArenaTiles(): void { buildArenaTilesImpl.call(this); }
  public getStructureTextureKey(kind: TileKind, autotileMask: number, biome: 0 | 1 | 2 | 3 = 1): string { return getStructureTextureKeyImpl.call(this, kind, autotileMask, biome); }
  public syncArenaTilesWithMapRevision(): void { syncArenaTilesWithMapRevisionImpl.call(this); }
  public buildVectorHud(): void { buildVectorHudImpl.call(this); }
  public invalidateAllHudCaches(): void { invalidateAllHudCachesImpl.call(this); }
  public togglePauseModal(forceState?: boolean): void { togglePauseModalImpl.call(this, forceState); }
  public openPauseConfirmExit(): void {
    this.pauseModalOpen = true;
    this.pauseConfirmExitOpen = true;
    this.rebuildPauseModal();
  }
  public rebuildPauseModal(): void { rebuildPauseModalImpl.call(this); }
  public triggerIrisTransition(mode: 'open' | 'close' = 'open'): void { triggerIrisTransitionImpl.call(this, mode); }
  public setupKeyboardBindings(): void { setupKeyboardBindingsImpl.call(this); }
  public getResolvedWsUrl(): string { return getResolvedWsUrlImpl.call(this); }
  public fetchHostLanInfo(): Promise<void> { return fetchHostLanInfoImpl.call(this); }
  public updateHostInviteUrl(): void { updateHostInviteUrlImpl.call(this); }
  public bindCoopRoomHandlers(room: ColyseusRoom): void { bindCoopRoomHandlersImpl.call(this, room); }
  public connectCoopRoom(): Promise<void> { return connectCoopRoomImpl.call(this); }
  public forceCoopReconnect(): Promise<boolean> { return forceCoopReconnectImpl.call(this); }
  public connectHelloRoom(): Promise<void> { return connectHelloRoomImpl.call(this); }
  public applyCameraViewport(): void { applyCameraViewportImpl.call(this); }
  public updateIrisTransition(dtSec: number): void { updateIrisTransitionImpl.call(this, dtSec); }
  public updatePlayerOverheadUi(p: ReturnType<LocalTransport['getSim']>['player'], x: number, y: number, nameLabel?: Phaser.GameObjects.Text, emoteLabel?: Phaser.GameObjects.Text, emoteBg?: Phaser.GameObjects.Graphics): void { updatePlayerOverheadUiImpl.call(this, p, x, y, nameLabel, emoteLabel, emoteBg); }
  public resolvePlayerStatusTint(): number | null { return resolvePlayerStatusTintImpl.call(this); }
  public resolveEnemyStatusTint(e: SimEnemyState): number | null { return resolveEnemyStatusTintImpl.call(this, e); }
  public processSimEvents(events?: SimEvent[]): void { processSimEventsImpl.call(this, events ?? this.transport.getSim().consumeEvents()); }
  public syncSimulatedPlayers(dtSec: number): void { syncSimulatedPlayersImpl.call(this, dtSec); }
  public syncEnemyRigs(dtSec: number): void { syncEnemyRigsImpl.call(this, dtSec); }
  public syncProps(dtSec: number): void { syncPropsImpl.call(this, dtSec); }
  public syncProjectilesAndPickups(): void { syncProjectilesAndPickupsImpl.call(this); }
  public syncPortalVisuals(dtSec: number): void { syncPortalVisualsImpl.call(this, dtSec); }
  public syncDoorVisuals(dtSec: number, target: InteractTargetResult | null): void { syncDoorVisualsImpl.call(this, dtSec, target); }
  public triggerPortalActivationBurst(): void { triggerPortalActivationBurstImpl.call(this); }
  public triggerPortalEnterSequence(commitOnComplete = false): void { triggerPortalEnterSequenceImpl.call(this, commitOnComplete); }
  public triggerDoorUnlockTransition(): void { triggerDoorUnlockTransitionImpl.call(this); }
  public triggerDoorCombatLockup(): void { triggerDoorCombatLockupImpl.call(this); }
  public resetPortalAndDoorTestState(): void { resetPortalAndDoorTestStateImpl.call(this); }
  public destroyPortalAndDoorVisuals(): void { destroyPortalAndDoorVisualsImpl.call(this); }
  public syncRoomEntities(dtSec: number): void { syncRoomEntitiesImpl.call(this, dtSec); }
  public updateCameraWithLookaheadAndShake(playerX: number, playerY: number, cursorWorldX: number, cursorWorldY: number, dtSec: number): void { updateCameraWithLookaheadAndShakeImpl.call(this, playerX, playerY, cursorWorldX, cursorWorldY, dtSec); }
  public renderTelegraphsAndShield(playerX: number, playerY: number): void { renderTelegraphsAndShieldImpl.call(this, playerX, playerY); }
  public drawEnemyHealthAndStatusBar(g: Phaser.GameObjects.Graphics, x: number, y: number, e: SimEnemyState): void { drawEnemyHealthAndStatusBarImpl.call(this, g, x, y, e); }
  public renderHitboxesIfEnabled(): void { renderHitboxesIfEnabledImpl.call(this); }
  public updateVectorHud(): void { updateVectorHudImpl.call(this); }
  public updateCoopTeammateHud(): void { updateCoopTeammateHudImpl.call(this); }
  public updateHubInvitePanel(): void { updateHubInvitePanelImpl.call(this); }
  public updateHubCharacterSkillPreview(): void { updateHubCharacterSkillPreviewImpl.call(this); }
  public updateWeaponComparisonCard(): void { updateWeaponComparisonCardImpl.call(this); }
  public updateEmoteWheelHud(): void { updateEmoteWheelHudImpl.call(this); }
  public updateOffscreenTeammateArrows(): void { updateOffscreenTeammateArrowsImpl.call(this); }
  public updateMinimapHud(): void { updateMinimapHudImpl.call(this); }
  public updateBossHud(): void { updateBossHudImpl.call(this); }
  public updateTopCenterBannersAndQol(dtSec: number): void { updateTopCenterBannersAndQolImpl.call(this, dtSec); }
  public updateQoLHudAndMinimap(dtSec = 0.016): void { this.updateMinimapHud(); this.updateBossHud(); this.updateTopCenterBannersAndQol(dtSec); }
  public triggerPlayerHitDirectionIndicator(angleRad: number): void { triggerPlayerHitDirectionIndicatorImpl.call(this, angleRad); }
  public triggerWaveBanner(wave: number, maxWaves = 3): void { triggerWaveBannerImpl.call(this, wave, maxWaves); }
  public triggerRoomClearedBanner(): void { triggerRoomClearedBannerImpl.call(this); }
  public renderViDiacriticsShowcase(): void { renderViDiacriticsShowcaseImpl.call(this); }
  public updateModalHud(): void { updateModalHudImpl.call(this); }
  public updateDebugState(playerRenderX: number, playerRenderY: number): void { updateDebugStateImpl.call(this, playerRenderX, playerRenderY); }
}
