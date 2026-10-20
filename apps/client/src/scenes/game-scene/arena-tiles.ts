import {
  clamp,
  LocalTransport,
  NetworkTransport,
  PHASE1_SAMPLE_WEAPONS,
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
import { resetClientFreezeRandom } from '../../core/visual-query.js';
import { CombatFxManager } from '../../fx/combat-fx.js';
import { LightingPipeline } from '../../fx/lighting-pipeline.js';
import { DebugOverlay, initGlobalDebugState } from '../../ui/debug-overlay.js';
import { type GraphicsQualityTier, graphicsSettings } from '../../ui/graphics-settings.js';
import { type ArenaTileVisual, type GameScene, RIG_FOOT_OFFSET_Y } from '../GameScene.js';

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
      autoRespawnWaves: false,
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
  window.__GAME_SET_LIGHTING__ = (enabled: boolean) => {
    this.lighting?.setLightingEnabled(enabled);
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

export function rebuildAllTileCellsToCompositeImpl(this: GameScene): void {
  if (!this.arenaGroundTex) return;
  for (let i = 0; i < this.mapTileVisuals.length; i++) {
    this.renderTileCellToComposite(this.mapTileVisuals[i]!);
  }
  this.arenaGroundTex.refresh();
}

export function buildArenaTilesImpl(this: GameScene): void {
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

export function getStructureTextureKeyImpl(
  this: GameScene,
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

export function syncArenaTilesWithMapRevisionImpl(this: GameScene): void {
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
  const zoomX = this.scale.width / WORLD_VIEW_WIDTH;
  const zoomY = this.scale.height / WORLD_VIEW_HEIGHT;
  const zoom = Math.min(zoomX, zoomY);
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

  cam.setZoom(zoomX, zoomY);
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

  const maxHoleR = 560;
  const holeR = Math.max(2, maxHoleR * (1 - this.irisTransitionProgress));
  const ringThickness = 640;
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

  const halfW = WORLD_VIEW_WIDTH / 2;
  const halfH = WORLD_VIEW_HEIGHT / 2;
  const clampedX = clamp(this.camFocusX, halfW - 32, Math.max(halfW, map.width - halfW + 32));
  const clampedY = clamp(this.camFocusY, halfH - 32, Math.max(halfH, map.height - halfH + 32));

  const shake = this.fx.computeCameraShakeOffset(dtSec);
  this.lastShakeX = shake.offsetX;
  this.lastShakeY = shake.offsetY;
  const finalCamX = clampedX + shake.offsetX;
  const finalCamY = clampedY + shake.offsetY;
  cam.centerOn(finalCamX, finalCamY);

  // Pin HUD container to camera worldView origin
  const zoomX = Math.max(0.1, cam.zoomX || cam.zoom || 1);
  const zoomY = Math.max(0.1, cam.zoomY || cam.zoom || 1);
  const viewW = cam.width > 0 ? cam.width / zoomX : WORLD_VIEW_WIDTH;
  const viewH = cam.height > 0 ? cam.height / zoomY : WORLD_VIEW_HEIGHT;
  this.hudContainer.setPosition(finalCamX - viewW * 0.5, finalCamY - viewH * 0.5);
}
