import {
  clamp,
  LocalTransport,
  NetworkTransport,
  PLAYER_SLOT_COLORS,
  TILE_SIZE,
  type TileKind,
  type WifiProfileId,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import Phaser from 'phaser';
import { CutoutRig } from '../../art/cutout-rig.js';
import { dampLerp } from '../../art/easing.js';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { VANGUARD_RIG_DEF } from '../../art/rig-defs.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { musicManager } from '../../audio/music-synth.js';
import { zzfx } from '../../audio/zzfx.js';
import {
  isDebugUiEnabled,
  isTestHooksEnabled,
  onDebugFlagsChanged,
} from '../../core/debug-flag.js';
import { resetClientFreezeRandom } from '../../core/visual-query.js';
import { CombatFxManager } from '../../fx/combat-fx.js';
import { computeUniformViewportMetrics } from '../../fx/lighting-config.js';
import { LightingPipeline } from '../../fx/lighting-pipeline.js';
import { DebugOverlay, initGlobalDebugState } from '../../ui/debug-overlay.js';
import { type GraphicsQualityTier, graphicsSettings } from '../../ui/graphics-settings.js';
import {
  BiomeArchitectureLiveLayer,
  buildRoomArchitecturePlan,
  computeTileDistToWall,
  renderBiomeArchitectureToComposite,
  resolveHybridFloorVariant,
} from '../../world/biome-architecture.js';
import { type ArenaTileVisual, type GameScene, RIG_FOOT_OFFSET_Y } from '../GameScene.js';
import type { HudScene } from '../HudScene.js';
import { applyHudEdgeAnchors } from './hud-setup-and-pause.js';
import { createInteractPromptFadeState } from './interact-prompt.js';
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
  debug.settingsModalOpen = false;
  debug.controlsModalOpen = false;
  debug.creditsModalOpen = false;
  debug.weaponComparisonVisible = false;
  debug.comparedWeaponId = null;
  debug.emoteWheelOpen = false;
  debug.lastDebugRejected = null;

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
  this.lastHubPreviewHash = '';
  this.lastWeaponCompareHash = '';
  this.lastEmoteWheelHash = '';
  this.emoteWheelOpen = false;
  this.emoteWheelHoveredId = null;
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
    });
    if (allowShortcuts && searchParams.get('hub') === '1') {
      this.transport.getSim().enterHub();
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
    this.destroyPortalAndDoorVisuals();
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

  // 3. Telegraph, Interact Highlight & Hitbox Overlay Graphics (depth 35.6..38: above lightmapRt depth 34)
  this.interactHighlightGraphics = this.add.graphics();
  this.interactHighlightGraphics.setDepth(35.6);
  this.interactHighlightGraphics.setBlendMode(Phaser.BlendModes.ADD);

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

  // 8. Custom Procedural Crosshair (in HudScene so it is unaffected by PostFX/lightmap)
  const invBake = 1 / textRes;
  this.crosshairSprite = this.uiScene.add.sprite(480, 270, 'ui_crosshair');
  this.crosshairSprite.setScale(invBake);
  this.crosshairSprite.setDepth(5000);

  // 9. Camera-Pinned Vector HUD
  this.buildVectorHud();
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
  if (!this.textures.exists(key)) return;
  const tex = this.textures.get(key);
  const src = tex.getSourceImage() as CanvasImageSource | undefined;
  if (src) {
    ctx.drawImage(src, dx, dy, cellPx, cellPx);
  }
}

export function renderTileCellToCompositeImpl(this: GameScene, tile: ArenaTileVisual): void {
  const groundCtx = this.arenaGroundTex?.getContext();
  if (!groundCtx) return;

  const sim = this.transport?.getSim();
  const effectiveBiome: 0 | 1 | 2 | 3 = sim ? (sim.inHub ? 0 : sim.currentBiome) : 1;
  const cellPx = TILE_SIZE * this.tileCompositeScale;
  const dx = tile.tx * cellPx;
  const dy = tile.ty * cellPx;

  groundCtx.clearRect(dx, dy, cellPx, cellPx);
  this.drawSourceKeyToCtx(
    groundCtx,
    TextureBaker.getBiomeTileTextureKey(effectiveBiome, tile.variant),
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
      this.getStructureTextureKey(tile.kind, tile.autotileMask, effectiveBiome),
      dx,
      dy,
      cellPx,
    );
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
  const revKey =
    effectiveBiome * 10000000 +
    sim.currentFloor * 1000000 +
    sim.currentRoomId * 10000 +
    map.mapRevision;
  if (revKey === this.lastMapRevision && effectiveBiome === this.lastRenderedBiome) return;
  const biomeChanged = effectiveBiome !== this.lastRenderedBiome;
  this.lastMapRevision = revKey;
  this.lastRenderedBiome = effectiveBiome;

  let groundDirty = false;

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

export function applyCameraViewportImpl(this: GameScene): void {
  const cam = this.cameras?.main;
  if (!cam) return;
  const vp = computeUniformViewportMetrics(this.scale.width, this.scale.height);
  const zoom = vp.zoom;
  this.hudPadX = vp.padX;
  this.hudPadY = vp.padY;
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
      entry.nameLabel.setResolution(newScale * 2);
      entry.emoteLabel.setResolution(newScale);
    }
    for (const entry of this.hubStatueRigs.values()) {
      entry.rig.refreshBakedTextures();
      entry.glowSprite.setTexture('fx_light_radial');
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
    for (const txt of this.textObjects) {
      txt.setResolution(newScale);
    }
    for (const txt of this.pingVisuals.values()) {
      txt.setResolution(newScale);
    }
    for (const entry of this.doorSprites.values()) {
      entry.sprite.destroy();
      entry.glowSprite.destroy();
      entry.label.destroy();
    }
    this.doorSprites.clear();
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
    if (this.portalSprite) {
      this.portalSprite.destroy();
      this.portalSprite = undefined;
    }
    if (this.portalGlowSprite) {
      this.portalGlowSprite.destroy();
      this.portalGlowSprite = undefined;
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
  this.hudScene?.applyViewport();
  if (this.hudContainer) {
    applyHudEdgeAnchors(this);
  }
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
  const holeR = Math.max(2, maxHoleR * (1 - this.irisTransitionProgress));
  const ringThickness = 840;
  g.lineStyle(ringThickness, hexToNum(PALETTE.INK_DARK), 1);
  g.strokeCircle(480, 270, holeR + ringThickness * 0.5);
  g.lineStyle(3, hexToNum(PALETTE.SOLAR_GOLD), 0.9);
  g.strokeCircle(480, 270, holeR);
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
