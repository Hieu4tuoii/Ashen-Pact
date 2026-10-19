import Phaser from 'phaser';
import { Client as ColyseusClient, type Room as ColyseusRoom } from 'colyseus.js';
import {
  CHARACTERS,
  clamp,
  type ElementType,
  ENEMY_SPAWN_WARMUP_SEC,
  INPUT_BUTTON,
  LocalTransport,
  PHASE1_SAMPLE_WEAPONS,
  type PropKind,
  type SimEnemyState,
  type SimEvent,
  type SurfaceKind,
  TILE_SIZE,
  type TileKind,
  VIETNAMESE_VERIFICATION_STRING,
  WEAPONS,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { CutoutRig } from '../art/cutout-rig.js';
import { dampLerp } from '../art/easing.js';
import { hexToNum, PALETTE } from '../art/palette.js';
import { RIG_DEFS_BY_ID, VANGUARD_RIG_DEF } from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import { zzfx } from '../audio/zzfx.js';
import { CombatFxManager } from '../fx/combat-fx.js';
import { LightingPipeline } from '../fx/lighting-pipeline.js';
import { DebugOverlay, initGlobalDebugState } from '../ui/debug-overlay.js';
import { type GraphicsQualityTier, graphicsSettings } from '../ui/graphics-settings.js';

declare global {
  interface Window {
    __GAME_TRANSPORT__?: LocalTransport;
    __GAME_STRESS_TEST__?: (active: boolean) => void;
    __GAME_SET_QUALITY__?: (quality: GraphicsQualityTier) => void;
  }
}

/**
 * CutoutRig uses (0, 0) as the foot/ground-shadow anchor with torso/head parts at offsetY = -12..-29,
 * while WorldSim uses (x, y) as the center of the entity hitbox, projectile origin, and telegraphs.
 * Offsetting the visual rig container by +12u aligns the visual torso center with the simulation hitbox center.
 */
const RIG_FOOT_OFFSET_Y = 12;

const ELEMENT_LABELS_VI: Record<ElementType, string> = {
  none: 'Vật Lý',
  burn: 'Hỏa (Cháy)',
  chill: 'Băng (Đóng Băng)',
  shock: 'Lôi (Giật Điện)',
  poison: 'Độc (Trúng Độc)',
};

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
  private transport!: LocalTransport;
  private fx!: CombatFxManager;
  private lighting!: LightingPipeline;
  private playerRig?: CutoutRig;
  private simPlayerRigs = new Map<number, CutoutRig>();
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
  private projectileSpritePool: { sprite: Phaser.GameObjects.Sprite; textureKey: string }[] = [];
  private pickupSpritePool: { sprite: Phaser.GameObjects.Sprite; textureKey: string }[] = [];

  private readonly activeEnemyIds = new Set<number>();
  private readonly activeSimPlayerIds = new Set<number>();
  private readonly activePropIds = new Set<number>();
  private readonly activeProjIds = new Set<number>();
  private readonly activePickupIds = new Set<number>();

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
  private lastHudHp = -1;
  private lastHudArmor = -1;
  private lastHudEnergy = -1;
  private lastHudSlot = -1;
  private lastHudElement = '';
  private lastHudQuality = '';
  private lastHudStatsText = '';

  private telegraphGraphics!: Phaser.GameObjects.Graphics;
  private hitboxGraphics!: Phaser.GameObjects.Graphics;
  private crosshairSprite!: Phaser.GameObjects.Sprite;

  // Camera-pinned HUD elements
  private hudContainer!: Phaser.GameObjects.Container;
  private hudBarsGraphics!: Phaser.GameObjects.Graphics;
  private hpLabelText!: Phaser.GameObjects.Text;
  private armorLabelText!: Phaser.GameObjects.Text;
  private energyLabelText!: Phaser.GameObjects.Text;
  private statsLineText!: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private qualityBtnText?: Phaser.GameObjects.Text;
  private elementBtnText?: Phaser.GameObjects.Text;
  private weaponSlotBgs: Phaser.GameObjects.Graphics[] = [];
  private weaponIconSprites: Phaser.GameObjects.Sprite[] = [];

  private debugOverlay?: DebugOverlay;
  private room?: ColyseusRoom;

  private inputSeq = 0;
  private queuedWeaponSlot: number | null = null;
  private wheelSwapQueued = false;
  private dashQueued = false;
  private skillQueued = false;

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
  };

  constructor() {
    super({ key: 'GameScene' });
  }

  public create(): void {
    const debug = initGlobalDebugState();
    debug.scene = 'GameScene';

    this.simPlayerRigs.clear();
    this.enemyRigs.clear();
    this.propVisuals.clear();
    this.projectileSprites.clear();
    this.pickupSprites.clear();
    this.projectileSpritePool = [];
    this.pickupSpritePool = [];
    this.mapTileVisuals = [];
    this.lastMapRevision = -1;
    this.dashAfterimageTimer = 0;
    this.textObjects = [];
    this.weaponSlotBgs = [];
    this.weaponIconSprites = [];
    this.lastShakeX = 0;
    this.lastShakeY = 0;
    this.lastHudHp = -1;
    this.lastHudArmor = -1;
    this.lastHudEnergy = -1;
    this.lastHudSlot = -1;
    this.lastHudElement = '';
    this.lastHudQuality = '';
    this.lastHudStatsText = '';

    // 1. Initialize LocalTransport + Authoritative 60Hz WorldSim
    this.transport = new LocalTransport({
      seed: debug.seed,
      mapConfig: {
        cols: 36,
        rows: 22,
        includePillars: true,
        seed: debug.seed,
      },
      spawnInitialWave: true,
      includeTrainingDummy: true,
      includeProps: true,
      autoRespawnWaves: true,
    });
    window.__GAME_TRANSPORT__ = this.transport;
    window.__GAME_STRESS_TEST__ = (active: boolean) => {
      this.setStressTestMode(active);
    };
    window.__GAME_SET_QUALITY__ = (quality: GraphicsQualityTier) => {
      graphicsSettings.setQuality(quality);
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

    const unlockAudio = () => zzfx.unlockOnUserGesture();
    this.input.on('pointerdown', unlockAudio);
    this.input.keyboard?.on('keydown', unlockAudio);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.applyCameraViewport, this);
      this.input.off('wheel', onWheel);
      this.input.off('pointerdown', unlockAudio);
      this.input.keyboard?.off('keydown', unlockAudio);
      this.lighting?.destroy();
      delete window.__GAME_TRANSPORT__;
      delete window.__GAME_STRESS_TEST__;
      delete window.__GAME_SET_QUALITY__;
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

    // 4. Player CutoutRig (Thiết Vệ)
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

    // 5. Sync initial destructible & light-emitting props
    this.syncProps(0);

    // 6. Pooled Combat FX Manager (Particles, Persistent Decals, Dash Afterimages, Ambient Leaves/Mist, Chain Lightning)
    this.fx = new CombatFxManager(this);

    // 7. Dynamic Lighting Pipeline + WebGL PostFX Shader
    this.lighting = new LightingPipeline(this);

    // 8. Custom Procedural Crosshair
    const invBake = 1 / TextureBaker.getBakeScale();
    this.crosshairSprite = this.add.sprite(sim.player.x + 64, sim.player.y, 'ui_crosshair');
    this.crosshairSprite.setScale(invBake);
    this.crosshairSprite.setDepth(950);

    // 9. Camera-Pinned Vector HUD
    this.buildVectorHud();

    // 10. Keyboard & Debug Bindings
    this.setupKeyboardBindings();

    this.debugOverlay = new DebugOverlay(this, false);
    void this.connectHelloRoom();
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

    const cellPx = TILE_SIZE * this.tileCompositeScale;
    const dx = tile.tx * cellPx;
    const dy = tile.ty * cellPx;

    groundCtx.clearRect(dx, dy, cellPx, cellPx);
    this.drawSourceKeyToCtx(
      groundCtx,
      TextureBaker.getBiomeTileTextureKey(1, tile.variant),
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
        this.getStructureTextureKey(tile.kind, tile.autotileMask),
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

    this.lastMapRevision = map.mapRevision;
  }

  private getStructureTextureKey(kind: TileKind, autotileMask: number): string {
    if (kind === 'pillar') {
      return TextureBaker.getPillarTileTextureKey(1, autotileMask);
    }
    if (kind === 'cracked_wall') {
      return TextureBaker.getCrackedWallTextureKey(1);
    }
    return TextureBaker.getWallTileTextureKey(1, autotileMask);
  }

  private syncArenaTilesWithMapRevision(): void {
    const sim = this.transport.getSim();
    if (sim.stressTestActive) return;
    const map = sim.map;
    if (map.mapRevision === this.lastMapRevision) return;
    this.lastMapRevision = map.mapRevision;

    let groundDirty = false;

    for (let i = 0; i < this.mapTileVisuals.length; i++) {
      const tile = this.mapTileVisuals[i]!;
      const newKind = map.getTile(tile.tx, tile.ty);
      const newMask = map.getAutotileMask(tile.tx, tile.ty);
      const newAo = map.getWallAmbientOcclusionMask(tile.tx, tile.ty);
      const newSurface = map.getSurface(tile.tx, tile.ty);
      const newSurfaceMask = map.getSurfaceAutotileMask(tile.tx, tile.ty);

      if (
        newKind !== tile.kind ||
        newMask !== tile.autotileMask ||
        newAo !== tile.aoMask ||
        newSurface !== tile.surface ||
        newSurfaceMask !== tile.surfaceMask
      ) {
        groundDirty = true;
        tile.kind = newKind;
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
      16,
      `DPS: 0.0 · Đợt 1 | ${VIETNAMESE_VERIFICATION_STRING}`,
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '10.5px',
        fontStyle: '700',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
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
      .text(504, 42, '[R] Ng.Tố: Vật Lý', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11px',
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
      .text(648, 42, '[G] Đồ Họa: CAO', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11px',
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
      .text(764, 42, '[Art Gallery]', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11.5px',
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
      .text(868, 42, '[Về Menu]', {
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
        sx + 28,
        barY + slotH / 2,
        TextureBaker.getWeaponTextureKey(weaponId),
      );
      icon.setScale(invBake * 0.82);
      this.weaponIconSprites.push(icon);
      this.hudContainer.add(icon);

      const nameTxt = this.add.text(sx + 54, barY + 7, `[${idx + 1}] ${wDef.nameVi}`, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      });
      this.textObjects.push(nameTxt);
      this.hudContainer.add(nameTxt);

      const metaTxt = this.add.text(
        sx + 54,
        barY + 24,
        `DMG ${wDef.damage}${wDef.pelletCount > 1 ? `×${wDef.pelletCount}` : ''} · NL ${wDef.energyCost}`,
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10px',
          color: PALETTE.SILVER_BRIGHT,
          resolution: textRes,
        },
      );
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
    };

    this.keys.SHIFT.on('down', () => {
      this.dashQueued = true;
    });
    this.keys.SPACE.on('down', () => {
      this.skillQueued = true;
    });
    this.keys.Q.on('down', () => {
      this.wheelSwapQueued = true;
    });
    this.keys.ONE.on('down', () => {
      this.queuedWeaponSlot = 0;
    });
    this.keys.TWO.on('down', () => {
      this.queuedWeaponSlot = 1;
    });
    this.keys.THREE.on('down', () => {
      this.queuedWeaponSlot = 2;
    });
    this.keys.FOUR.on('down', () => {
      this.queuedWeaponSlot = 3;
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
      sim.player.godMode = !sim.player.godMode;
      const debug = initGlobalDebugState();
      debug.godMode = sim.player.godMode;
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

    // F5: Clear current combat enemies
    this.keys.F5.on('down', () => {
      const sim = this.transport.getSim();
      for (const e of sim.enemies) {
        if (!e.isDummy) {
          e.hp = 0;
        }
      }
    });

    // F7: Toggle Phase 2 Stress Test (4 players + 80 enemies + 600+ projectiles)
    this.keys.F7.on('down', () => {
      const sim = this.transport.getSim();
      this.setStressTestMode(!sim.stressTestActive);
    });
  }

  private async connectHelloRoom(): Promise<void> {
    const debug = initGlobalDebugState();
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
      this.weaponIconSprites.forEach((icon, idx) => {
        const wId = PHASE1_SAMPLE_WEAPONS[idx]!;
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
      this.fx?.refreshResolution(newScale, prevScale);
      this.lighting?.refreshResolution();
      this.debugOverlay?.refreshResolution(newScale);
    }

    cam.setZoom(zoom);
  }

  public override update(_time: number, rawDeltaMs: number): void {
    const sim = this.transport.getSim();
    const dtSec = Math.min(rawDeltaMs / 1000, 0.05);

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

    if (this.keys) {
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
      buttons |= INPUT_BUTTON.DASH;
      this.dashQueued = false;
    }
    if (this.skillQueued) {
      buttons |= INPUT_BUTTON.SKILL;
      this.skillQueued = false;
    }
    if (this.wheelSwapQueued) {
      buttons |= INPUT_BUTTON.SWAP;
      this.wheelSwapQueued = false;
    }

    // Left mouse button -> FIRE (except when clicking top/bottom HUD buttons)
    const camView = this.cameras.main.worldView;
    const localViewY = worldPt.y - camView.y;
    const isClickingHud = localViewY < 68 || localViewY > 480;
    if (pointer.leftButtonDown() && !isClickingHud) {
      buttons |= INPUT_BUTTON.FIRE;
    }
    if (pointer.rightButtonDown()) {
      buttons |= INPUT_BUTTON.SKILL;
    }

    const slotSelect = this.queuedWeaponSlot;
    this.queuedWeaponSlot = null;

    this.inputSeq += 1;
    this.transport.sendInput({
      seq: this.inputSeq,
      tick: sim.tick,
      moveX,
      moveY,
      aimAngle,
      buttons,
      weaponSlotSelect: slotSelect,
    });

    // 2. Hit-Stop check & Fixed 60Hz Simulation Step via LocalTransport
    const { simDeltaMs } = this.fx.consumeHitStopDelta(Math.min(rawDeltaMs, 50));
    if (simDeltaMs > 0) {
      const effectiveDelta = sim.stressTestActive ? Math.min(simDeltaMs, 16.6667) : simDeltaMs;
      this.transport.step(effectiveDelta);
    }

    // 3. Sync dynamic map changes (cracked walls destroyed, surface ignitions/electrifications/freezes)
    this.syncArenaTilesWithMapRevision();

    // 4. Process Sim Events (SFX, Sparks, Damage Numbers, Decals, Chain Lightning, Hit-Stop, Screen Shake)
    this.processSimEvents(this.transport.consumeEvents());

    // 5. Render Interpolated Player & CutoutRig Animation + Dash Afterimage Ghosts
    const playerPos = this.transport.getInterpolatedPlayerPos(this.playerPosScratch);
    if (this.playerRig) {
      this.playerRig.container.setPosition(playerPos.x, playerPos.y + RIG_FOOT_OFFSET_Y);
      this.playerRig.setAimAngle(aimAngle);
      this.playerRig.setEquippedWeapon(sim.getActiveWeaponId());
      this.playerRig.setDashActive(sim.player.dashTimer > 0);
      this.playerRig.setElementalStatusTint(this.resolvePlayerStatusTint());

      const isMoving = Math.hypot(sim.player.vx, sim.player.vy) > 12;
      this.playerRig.setAnimState(isMoving ? 'run' : 'idle');
      this.playerRig.update(dtSec);

      if (sim.player.dashTimer > 0) {
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
    }

    // 6. Sync Simulated Co-op Players (P2-P4), Enemies, Props, Projectiles & Pickups
    this.syncSimulatedPlayers(dtSec);
    this.syncEnemyRigs(dtSec);
    this.syncProps(dtSec);
    this.syncProjectilesAndPickups();

    // 7. Update Pooled Particles, Ambient Leaves/Mist, Afterimages & Floating Damage Numbers
    this.fx.update(dtSec, this.cameras.main.worldView);

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

    this.lighting.update({
      dtSec,
      playerPos,
      player: sim.player,
      simulatedPlayers: this.simPlayerLightingScratch,
      enemies: sim.enemies,
      projectiles: sim.projectiles,
      props: sim.props,
      map: sim.map,
      trauma: this.fx.getTrauma(),
    });

    // 10. Update Procedural Crosshair at Mouse World Position
    const updatedWorldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const invBake = 1 / TextureBaker.getBakeScale();
    if (this.crosshairPulse > 0) {
      this.crosshairPulse = Math.max(0, this.crosshairPulse - dtSec * 5);
    }
    this.crosshairSprite.setPosition(updatedWorldPt.x, updatedWorldPt.y);
    this.crosshairSprite.setScale(invBake * (1 + this.crosshairPulse * 0.35));

    // 11. Draw Telegraphs, Spawn Circles, Elemental Badges, Shield Wall & Optional F4 Hitboxes
    this.renderTelegraphsAndShield(playerPos.x, playerPos.y);
    this.renderHitboxesIfEnabled();

    // 12. Update Camera-Pinned Vector HUD & Debug Telemetry
    this.updateVectorHud();
    this.updateDebugState(playerPos.x, playerPos.y);
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
    let maxHitStopMs = 0;
    let maxHitStopTrauma = 0;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      switch (ev.kind) {
        case 'projectile_spawned': {
          if (ev.team === 'player') {
            if (!playerShotFxTriggered) {
              playerShotFxTriggered = true;
              const isShotgun = ev.weaponId === 'scrap_shotgun';
              if (!isStress || sim.tick % 3 === 0) {
                this.fx.spawnMuzzleFlashAndCasing(ev.x, ev.y, ev.angle, isShotgun);
              }
              if (!isStress) {
                this.lighting.spawnTransientLight(
                  ev.x,
                  ev.y,
                  82,
                  PALETTE.SOLAR_GOLD,
                  0.72,
                  0.08,
                );
              }
              this.crosshairPulse = isShotgun ? 0.9 : 0.45;
              this.playerRig?.triggerRecoil(isShotgun ? 6.5 : 4.2);

              if (allowStressSfx) {
                if (ev.weaponId === 'scrap_shotgun') {
                  zzfx.play('shoot_shotgun', ev.x, this.camFocusX);
                  this.fx.addTrauma(0.18);
                } else if (ev.weaponId === 'gale_smg') {
                  zzfx.play('shoot_smg', ev.x, this.camFocusX);
                  this.fx.addTrauma(0.06);
                } else {
                  zzfx.play('shoot_pistol', ev.x, this.camFocusX);
                  this.fx.addTrauma(0.1);
                }
              }
            }
          } else if (!enemyShotSfxTriggered && allowStressSfx) {
            enemyShotSfxTriggered = true;
            zzfx.play('shoot_pistol', ev.x, this.camFocusX);
          }
          break;
        }
        case 'melee_swing': {
          this.playerRig?.triggerMeleeSwing();
          this.fx.spawnMeleeSlash(ev.x, ev.y, ev.angle);
          this.lighting.spawnTransientLight(ev.x, ev.y, 92, PALETTE.CYAN_FROST, 0.65, 0.12);
          this.crosshairPulse = 0.6;
          zzfx.play('swing_sword', ev.x, this.camFocusX);
          if (ev.bulletsDestroyed > 0) {
            zzfx.play('bullet_deflect', ev.x, this.camFocusX);
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
          } else {
            this.playerRig?.triggerHitFlash(0.16);
            zzfx.play('player_hurt', ev.x, this.camFocusX);
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
            zzfx.play('bullet_deflect', ev.x, this.camFocusX);
          }
          break;
        }
        case 'entity_killed': {
          if (!isStress || statusFxCountThisStep < 1) {
            statusFxCountThisStep += 1;
            this.fx.spawnEnemyDeathBurst(ev.defId, ev.x, ev.y);
            if (allowStressSfx) {
              zzfx.play('kill_enemy', ev.x, this.camFocusX);
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
            const simRig = this.simPlayerRigs.get(ev.playerId);
            const spState = sim.simulatedPlayers.find((sp) => sp.id === ev.playerId);
            this.fx.spawnDashAfterimage(
              ev.x,
              ev.y + RIG_FOOT_OFFSET_Y,
              simRig ? simRig.getFacingSign() : ev.dirX >= 0 ? 1 : -1,
              spState ? spState.slot : 2,
            );
          }
          if (allowStressSfx) {
            zzfx.play('dash', ev.x, this.camFocusX);
          }
          break;
        }
        case 'enemy_telegraph': {
          if (allowStressSfx) {
            zzfx.play('telegraph', ev.x, this.camFocusX);
          }
          break;
        }
        case 'explosion': {
          const isBarrel = ev.sourceDefId === 'explosive_barrel';
          const colorHex = isBarrel ? PALETTE.FLAME_ORANGE : PALETTE.TOXIC_PURPLE;
          this.fx.spawnExplosionBurst(ev.x, ev.y, ev.radius, colorHex);
          this.lighting.spawnTransientLight(
            ev.x,
            ev.y,
            ev.radius * 2.2,
            colorHex,
            1.0,
            0.38,
          );
          if (allowStressSfx) {
            zzfx.play('explosion', ev.x, this.camFocusX);
          }
          break;
        }
        case 'prop_destroyed': {
          this.fx.spawnPropBreakBurst(ev.propKind, ev.x, ev.y);
          if (ev.propKind !== 'explosive_barrel' && allowStressSfx) {
            zzfx.play('prop_break', ev.x, this.camFocusX);
          }
          break;
        }
        case 'cracked_wall_broken': {
          this.fx.spawnPropBreakBurst('clay_vase', ev.x, ev.y);
          this.lighting.spawnTransientLight(ev.x, ev.y, 120, PALETTE.CYAN_FROST, 0.85, 0.4);
          zzfx.play('prop_break', ev.x, this.camFocusX);
          break;
        }
        case 'status_applied': {
          if (!isStress || (statusFxCountThisStep < 1 && sim.tick % 4 === 0)) {
            statusFxCountThisStep += 1;
            this.fx.spawnStatusBurst(ev.status, ev.x, ev.y);
            if (!isStress) {
              if (ev.status === 'frozen') {
                this.lighting.spawnTransientLight(ev.x, ev.y, 96, PALETTE.CYAN_FROST, 0.9, 0.28);
                zzfx.play('freeze', ev.x, this.camFocusX);
              } else if (ev.status === 'shatter') {
                this.lighting.spawnTransientLight(ev.x, ev.y, 124, PALETTE.CYAN_FROST, 1.0, 0.34);
                zzfx.play('shatter', ev.x, this.camFocusX);
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
              zzfx.play('chain_lightning', ev.toX, this.camFocusX);
            }
          }
          break;
        }
        case 'surface_triggered': {
          if (allowStressSfx) {
            if (ev.surface === 'burning_oil' || ev.surface === 'burning_grass') {
              zzfx.play('surface_ignite', ev.x, this.camFocusX);
            } else if (ev.surface === 'electrified_water') {
              zzfx.play('chain_lightning', ev.x, this.camFocusX);
            } else if (ev.surface === 'ice') {
              zzfx.play('freeze', ev.x, this.camFocusX);
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
          zzfx.play('skill_cast', ev.x, this.camFocusX);
          break;
        }
        case 'shield_shockwave': {
          this.fx.spawnExplosionBurst(ev.x, ev.y, 90, PALETTE.CRIMSON_BRIGHT);
          this.lighting.spawnTransientLight(ev.x, ev.y, 150, PALETTE.CRIMSON_BRIGHT, 0.95, 0.32);
          zzfx.play('shield_shockwave', ev.x, this.camFocusX);
          break;
        }
        case 'weapon_swapped': {
          zzfx.play('weapon_swap');
          break;
        }
        case 'pickup_collected': {
          if (allowStressSfx) {
            zzfx.play('pickup', ev.x, this.camFocusX);
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
      zzfx.play(enemyHitCritThisStep ? 'crit_hit' : 'hit_enemy', enemyHitSfxX, this.camFocusX);
    }
    if (maxHitStopMs > 0 && !isStress) {
      this.fx.triggerHitStop(maxHitStopMs);
      this.fx.addTrauma(maxHitStopTrauma);
    }
  }

  private syncSimulatedPlayers(dtSec: number): void {
    const sim = this.transport.getSim();
    this.activeSimPlayerIds.clear();

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

    for (const [id, rig] of this.simPlayerRigs.entries()) {
      if (!this.activeSimPlayerIds.has(id)) {
        rig.destroy();
        this.simPlayerRigs.delete(id);
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
          displayScale: 1,
          initialPhaseOffset: (e.id % 7) * 0.25,
          fastComposite: useFastComposite,
        });
        rig.container.setDepth(28);
        this.enemyRigs.set(e.id, rig);
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

        const sprite = this.add.sprite(
          prop.x,
          prop.y,
          TextureBaker.getPropTextureKey(prop.kind),
        );
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

    // 2. Pickups (Energy & Gold, object-pooled Sprites)
    this.activePickupIds.clear();
    for (let i = 0; i < sim.pickups.length; i++) {
      const pk = sim.pickups[i]!;
      this.activePickupIds.add(pk.id);

      let entry = this.pickupSprites.get(pk.id);
      if (!entry) {
        const tex = pk.kind === 'energy' ? 'fx_pickup_energy' : 'fx_pickup_gold';
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
        entry.sprite.setScale(invBake);
        this.pickupSprites.set(pk.id, entry);
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
    const g = this.telegraphGraphics;
    g.clear();

    const sim = this.transport.getSim();
    const p = sim.player;
    const isStress = sim.stressTestActive;
    const view = this.cameras.main.worldView;
    const hasView = view && view.width > 0;
    const viewLeft = hasView ? view.x - 48 : -9999;
    const viewRight = hasView ? view.x + view.width + 48 : 9999;
    const viewTop = hasView ? view.y - 48 : -9999;
    const viewBottom = hasView ? view.y + view.height + 48 : 9999;
    const hudSafeTop = hasView ? view.y + 72 : 72;
    const hudSafeBottom = hasView ? view.y + view.height - 62 : 478;

    // 1. Thiết Vệ Active Skill: "Tường Khiên Hồng Ngọc" (120 deg arc shield in front of player)
    if (p.skillActiveTimer > 0) {
      const halfArc = (60 * Math.PI) / 180;
      const startA = p.aimAngle - halfArc;
      const endA = p.aimAngle + halfArc;
      const r = 38;

      g.lineStyle(7, hexToNum(PALETTE.INK_DARK), 0.85);
      g.beginPath();
      g.arc(playerX, playerY, r, startA, endA, false);
      g.strokePath();

      g.lineStyle(4, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.95);
      g.beginPath();
      g.arc(playerX, playerY, r, startA, endA, false);
      g.strokePath();

      g.lineStyle(2, hexToNum(PALETTE.SOLAR_GOLD), 0.9);
      g.beginPath();
      g.arc(playerX, playerY, r - 4, startA, endA, false);
      g.strokePath();
    }

    // 2. Enemy Spawn Circles, Attack Telegraphs, Elemental Rings & Mini HP Bars
    let hpBarsDrawn = 0;
    let telegraphsDrawn = 0;
    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0) continue;
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

      // Frozen encasement crystal ring
      if (e.frozenTimer > 0 && (!isStress || telegraphsDrawn < 6)) {
        g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 0.28);
        g.fillCircle(pos.x, pos.y, e.radius + 5);
        g.lineStyle(2.2, hexToNum(PALETTE.BONE_WHITE), 0.9);
        g.strokeCircle(pos.x, pos.y, e.radius + 5);
      }

      // Enemy Attack Telegraphs (Section 3.7: high readability red warning before damage)
      if (e.aiState === 'telegraph' && (!isStress || telegraphsDrawn < 4)) {
        telegraphsDrawn += 1;
        const progress =
          e.telegraphDurationSec > 0 ? 1 - clamp(e.stateTimer / e.telegraphDurationSec, 0, 1) : 1;

        if (e.defId === 'goblin_shooter') {
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
        } else if (e.defId === 'wild_boar') {
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
        } else if (e.defId === 'spore_bomber') {
          const r = e.telegraphRadius || 68;
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
        e.shockTimer > 0;
      const barY = pos.y - 30;
      if (
        barY - 8 >= hudSafeTop &&
        barY + 8 <= hudSafeBottom &&
        ((!e.isDummy && e.hp < e.maxHp) || hasStatus) &&
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
    const w = 28;
    const h = 5;
    const ratio = clamp(e.hp / e.maxHp, 0, 1);

    g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.9);
    g.fillRoundedRect(x - w / 2 - 1, y - 1, w + 2, h + 2, 2);

    g.fillStyle(hexToNum(e.frozenTimer > 0 ? PALETTE.CYAN_FROST : PALETTE.CRIMSON_BRIGHT), 1);
    g.fillRoundedRect(x - w / 2, y, Math.max(2, w * ratio), h, 1.5);

    // Elemental status pips above HP bar
    let pipX = x - 10;
    const pipY = y - 5;
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

    if (
      p.hp !== this.lastHudHp ||
      p.armor !== this.lastHudArmor ||
      p.energy !== this.lastHudEnergy
    ) {
      this.lastHudHp = p.hp;
      this.lastHudArmor = p.armor;
      this.lastHudEnergy = p.energy;

      const g = this.hudBarsGraphics;
      g.clear();

      const drawStatBar = (
        x: number,
        y: number,
        w: number,
        h: number,
        ratio: number,
        fillHex: string,
      ) => {
        g.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.95);
        g.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
        g.fillRoundedRect(x, y, w, h, 5);
        if (ratio > 0) {
          g.fillStyle(hexToNum(fillHex), 1);
          g.fillRoundedRect(x + 2, y + 2, Math.max(4, (w - 4) * clamp(ratio, 0, 1)), h - 4, 3.5);
        }
        g.strokeRoundedRect(x, y, w, h, 5);
      };

      // HP, Armor, Energy bars
      drawStatBar(22, 13, 124, 20, p.hp / p.maxHp, PALETTE.RUBY_CORE);
      drawStatBar(156, 13, 124, 20, p.armor / p.maxArmor, PALETTE.STEEL_LIGHT);
      drawStatBar(290, 13, 136, 20, p.energy / p.maxEnergy, PALETTE.AZURE_CORE);

      this.hpLabelText.setText(`${CHARACTERS.vanguard.nameVi} · HP ${p.hp}/${p.maxHp}`);
      this.armorLabelText.setText(`GIÁP ${p.armor}/${p.maxArmor}`);
      this.energyLabelText.setText(`NL ${p.energy}/${p.maxEnergy}`);
    }

    if (sim.tick % 12 === 0 || !this.lastHudStatsText) {
      const dps = sim.getRollingDps();
      const dashReady = p.dashCooldownTimer <= 0 ? 'Sẵn' : `${p.dashCooldownTimer.toFixed(1)}s`;
      const skillReady =
        p.skillActiveTimer > 0
          ? `Bật (${p.skillActiveTimer.toFixed(1)}s)`
          : p.skillCooldownTimer <= 0
            ? 'Sẵn'
            : `${p.skillCooldownTimer.toFixed(1)}s`;

      const nextStats = `DPS: ${dps.toFixed(1)} · Xu: ${p.gold} · Đợt ${sim.waveNumber} · Dash: ${dashReady} · Khiên: ${skillReady} | ${VIETNAMESE_VERIFICATION_STRING}`;
      if (nextStats !== this.lastHudStatsText) {
        this.lastHudStatsText = nextStats;
        this.statsLineText.setText(nextStats);
      }
    }

    if (this.elementBtnText && p.activeImbueElement !== this.lastHudElement) {
      this.lastHudElement = p.activeImbueElement;
      this.elementBtnText.setText(`[R] Ng.Tố: ${ELEMENT_LABELS_VI[p.activeImbueElement]}`);
    }

    const q = graphicsSettings.getState().quality;
    if (this.qualityBtnText && q !== this.lastHudQuality) {
      this.lastHudQuality = q;
      const qVi = q === 'high' ? 'CAO' : q === 'medium' ? 'TB' : 'THẤP';
      this.qualityBtnText.setText(`[G] Đồ Họa: ${qVi}`);
    }

    // Highlight active weapon slot on bottom bar only when slot changes
    if (p.activeWeaponSlot !== this.lastHudSlot) {
      this.lastHudSlot = p.activeWeaponSlot;
      const slotW = 166;
      const slotH = 44;
      const startX = 148;
      const barY = 486;

      this.weaponSlotBgs.forEach((slotBg, idx) => {
        const isSelected = idx === p.activeWeaponSlot;
        const sx = startX + idx * (slotW + 8);
        slotBg.clear();
        slotBg.fillStyle(
          hexToNum(isSelected ? PALETTE.SLATE_MID : PALETTE.SLATE_DARK),
          isSelected ? 0.96 : 0.86,
        );
        slotBg.lineStyle(
          isSelected ? 2.5 : 2,
          hexToNum(isSelected ? PALETTE.SOLAR_GOLD : PALETTE.INK_DARK),
          1,
        );
        slotBg.fillRoundedRect(sx, barY, slotW, slotH, 8);
        slotBg.strokeRoundedRect(sx, barY, slotW, slotH, 8);
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

    const activeEnemyCount = this.activeEnemyIds.size;
    const totalEntities = 1 + sim.simulatedPlayers.length + activeEnemyCount;

    this.debugOverlay?.update({
      entityCount: totalEntities,
      bulletCount: sim.projectiles.length,
      tick: sim.tick,
    });
  }
}
