import Phaser from 'phaser';
import {
  FixedTimestepLoop,
  VIETNAMESE_VERIFICATION_STRING,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { CutoutRig, type RigAnimState } from '../art/cutout-rig.js';
import { BIOME_THEMES, hexToNum, PALETTE, PLAYER_SLOT_COLORS } from '../art/palette.js';
import { GOBLIN_SHOOTER_RIG_DEF, VANGUARD_RIG_DEF } from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import { DebugOverlay, initGlobalDebugState } from '../ui/debug-overlay.js';

declare global {
  interface Window {
    __GALLERY_SET_ANIM__?: (state: RigAnimState) => void;
    __GALLERY_SET_SLOT__?: (slot: 1 | 2 | 3 | 4) => void;
    __GALLERY_SET_BIOME__?: (biome: 1 | 2 | 3) => void;
  }
}

export class ArtGalleryScene extends Phaser.Scene {
  private simLoop = new FixedTimestepLoop(60);
  private rigs: CutoutRig[] = [];
  private playerRigs: CutoutRig[] = [];
  private floorTileSprites: { sprite: Phaser.GameObjects.Sprite; variant: number }[] = [];
  private currentAnim: RigAnimState = 'idle';
  private currentSlot: 1 | 2 | 3 | 4 = 1;
  private currentBiome: 1 | 2 | 3 = 1;
  private stateStatusText?: Phaser.GameObjects.Text;
  private debugOverlay?: DebugOverlay;

  constructor() {
    super({ key: 'ArtGalleryScene' });
  }

  public create(): void {
    const debug = initGlobalDebugState();
    debug.scene = 'ArtGalleryScene';
    debug.animState = this.currentAnim;
    debug.playerSlot = this.currentSlot;
    debug.biome = this.currentBiome;

    this.rigs = [];
    this.playerRigs = [];
    this.floorTileSprites = [];

    this.applyCameraViewport();
    this.scale.on('resize', this.applyCameraViewport, this);

    const textRes = TextureBaker.getBakeScale();

    // 1. Deep Backdrop
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 1);
    bg.fillRect(0, 0, WORLD_VIEW_WIDTH, WORLD_VIEW_HEIGHT);

    // 2. Top Header Banner
    const header = this.add.graphics();
    header.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.96);
    header.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
    header.fillRoundedRect(16, 10, 928, 54, 10);
    header.strokeRoundedRect(16, 10, 928, 54, 10);

    this.add.text(32, 18, 'ART GALLERY — KIỂM ĐỊNH PHONG CÁCH ĐỒ HỌA VECTOR (PHASE 0)', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '16px',
      fontStyle: '800',
      color: PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 4,
      resolution: textRes,
    });

    this.stateStatusText = this.add.text(32, 41, '', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '12px',
      fontStyle: '600',
      color: PALETTE.CYAN_FROST,
      resolution: textRes,
    });

    // 3. Left Stage: Thiết Vệ (Vanguard)
    this.createEntityStage({
      x: 16,
      y: 72,
      w: 454,
      h: 274,
      titleVi: 'NHÂN VẬT MẪU: THIẾT VỆ (VANGUARD)',
      subtitleVi: 'Tỉ lệ Chibi (Đầu ~40%) · Viền 2.5u #141019 · Cel-Shade + Rim Light',
      rigDef: VANGUARD_RIG_DEF,
      isPlayer: true,
    });

    // 4. Right Stage: Goblin Xạ Thủ (Goblin Shooter)
    this.createEntityStage({
      x: 490,
      y: 72,
      w: 454,
      h: 274,
      titleVi: 'QUÁI MẪU BIOME 1: GOBLIN XẠ THỦ (GOBLIN SHOOTER)',
      subtitleVi: 'Cutout Rig 8 Bộ Phận · Animation Tham Số Idle / Run · Nỏ Tên Đỏ',
      rigDef: GOBLIN_SHOOTER_RIG_DEF,
      isPlayer: false,
    });

    // 5. Biome Tiles & Master Palette Strip Panel
    this.createPaletteAndBiomePanel(16, 354, 928, 98);

    // 6. Bottom Interactive Control Bar
    this.createControlBar(16, 460, 928, 68);

    this.updateStatusBanner();
    this.debugOverlay = new DebugOverlay(this, false);

    window.__GALLERY_SET_ANIM__ = (state: RigAnimState) => this.setGalleryAnim(state);
    window.__GALLERY_SET_SLOT__ = (slot: 1 | 2 | 3 | 4) => this.setGallerySlot(slot);
    window.__GALLERY_SET_BIOME__ = (biome: 1 | 2 | 3) => this.setGalleryBiome(biome);
  }

  private createEntityStage(cfg: {
    x: number;
    y: number;
    w: number;
    h: number;
    titleVi: string;
    subtitleVi: string;
    rigDef: typeof VANGUARD_RIG_DEF;
    isPlayer: boolean;
  }): void {
    const textRes = TextureBaker.getBakeScale();
    const panel = this.add.graphics();
    panel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
    panel.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
    panel.fillRoundedRect(cfg.x, cfg.y, cfg.w, cfg.h, 10);
    panel.strokeRoundedRect(cfg.x, cfg.y, cfg.w, cfg.h, 10);

    this.add.text(cfg.x + 16, cfg.y + 12, cfg.titleVi, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '13px',
      fontStyle: '800',
      color: PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    });

    this.add.text(cfg.x + 16, cfg.y + 32, cfg.subtitleVi, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11px',
      color: PALETTE.SILVER_BRIGHT,
      resolution: textRes,
    });

    const invBake = 1 / textRes;
    const cols = 12;
    const rows = 5;
    const startX = cfg.x + 36;
    const startY = cfg.y + 72;

    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        const variant = (cx + cy) % 4;
        const spr = this.add.sprite(
          startX + cx * 32 + 16,
          startY + cy * 32 + 16,
          TextureBaker.getBiomeTileTextureKey(this.currentBiome, variant),
        );
        spr.setScale(invBake);
        this.floorTileSprites.push({ sprite: spr, variant });
      }
    }

    const rig1x = new CutoutRig(this, cfg.x + 125, cfg.y + 185, cfg.rigDef, {
      playerSlot: cfg.isPlayer ? this.currentSlot : null,
      displayScale: 1.0,
    });

    const rigZoom = new CutoutRig(this, cfg.x + 310, cfg.y + 205, cfg.rigDef, {
      playerSlot: cfg.isPlayer ? this.currentSlot : null,
      displayScale: 2.4,
      initialPhaseOffset: 0.25,
    });

    if (!cfg.isPlayer) {
      rig1x.setAimAngle(-0.15);
      rigZoom.setAimAngle(-0.15);
    } else {
      rig1x.setAimAngle(0.1);
      rigZoom.setAimAngle(0.1);
      this.playerRigs.push(rig1x, rigZoom);
    }

    this.rigs.push(rig1x, rigZoom);

    this.add
      .text(cfg.x + 125, cfg.y + 246, '1.0× Kích Thước Thực (32u)', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      })
      .setOrigin(0.5);

    this.add
      .text(cfg.x + 310, cfg.y + 246, '2.4× Phóng Đại Soi Chi Tiết', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      })
      .setOrigin(0.5);
  }

  private createPaletteAndBiomePanel(x: number, y: number, w: number, h: number): void {
    const textRes = TextureBaker.getBakeScale();
    const panel = this.add.graphics();
    panel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
    panel.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
    panel.fillRoundedRect(x, y, w, h, 10);
    panel.strokeRoundedRect(x, y, w, h, 10);

    this.add.text(x + 16, y + 10, VIETNAMESE_VERIFICATION_STRING, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '15px',
      fontStyle: '800',
      color: PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3.5,
      resolution: textRes,
    });

    this.add.text(
      x + 16,
      y + 34,
      'Bảng Màu Chuẩn (42 Màu Cố Định) · Hướng Sáng Trên-Trái (-135°) · Đầy Đủ 4 Màu Định Danh P1–P4:',
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11px',
        color: PALETTE.SILVER_BRIGHT,
        resolution: textRes,
      },
    );

    const swatches = Object.values(PALETTE);
    const swGraphics = this.add.graphics();
    const swW = 19.5;
    const swH = 26;
    swatches.forEach((hex, idx) => {
      const sx = x + 16 + idx * (swW + 2);
      const sy = y + 56;
      swGraphics.fillStyle(hexToNum(hex), 1);
      swGraphics.lineStyle(1.5, hexToNum(PALETTE.INK_DARK), 1);
      swGraphics.fillRoundedRect(sx, sy, swW, swH, 3);
      swGraphics.strokeRoundedRect(sx, sy, swW, swH, 3);
    });
  }

  private createControlBar(x: number, y: number, w: number, h: number): void {
    const bar = this.add.graphics();
    bar.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.96);
    bar.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
    bar.fillRoundedRect(x, y, w, h, 10);
    bar.strokeRoundedRect(x, y, w, h, 10);

    this.createSmallButton(x + 74, y + 34, 116, 38, 'Anim: IDLE', PALETTE.AZURE_CORE, () => {
      this.setGalleryAnim('idle');
    });
    this.createSmallButton(x + 198, y + 34, 116, 38, 'Anim: RUN', PALETTE.GOBLIN_GREEN, () => {
      this.setGalleryAnim('run');
    });

    this.createSmallButton(x + 312, y + 34, 78, 38, 'P1 Xanh', PALETTE.AZURE_CORE, () => {
      this.setGallerySlot(1);
    });
    this.createSmallButton(x + 398, y + 34, 78, 38, 'P2 Đỏ', PALETTE.RUBY_CORE, () => {
      this.setGallerySlot(2);
    });
    this.createSmallButton(x + 484, y + 34, 78, 38, 'P3 Lục', PALETTE.GOBLIN_GREEN, () => {
      this.setGallerySlot(3);
    });
    this.createSmallButton(x + 570, y + 34, 78, 38, 'P4 Vàng', PALETTE.BRASS_CORE, () => {
      this.setGallerySlot(4);
    });

    this.createSmallButton(x + 668, y + 34, 82, 38, 'Biome 1', PALETTE.FOREST_SHADE, () => {
      this.setGalleryBiome(1);
    });
    this.createSmallButton(x + 758, y + 34, 82, 38, 'Biome 2', PALETTE.COBALT_SHADE, () => {
      this.setGalleryBiome(2);
    });
    this.createSmallButton(x + 848, y + 34, 82, 38, 'Biome 3', PALETTE.BRONZE_SHADE, () => {
      this.setGalleryBiome(3);
    });
  }

  private createSmallButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    colorHex: string,
    onClick: () => void,
  ): void {
    const container = this.add.container(cx, cy);
    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hexToNum(hover ? PALETTE.SOLAR_GOLD : colorHex), 1);
      bg.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 7);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);
    };
    draw(false);

    const txt = this.add
      .text(0, 0, label, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '12px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: TextureBaker.getBakeScale(),
      })
      .setOrigin(0.5);

    const hit = this.add
      .rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', onClick);

    container.add([bg, txt, hit]);
  }

  public setGalleryAnim(state: RigAnimState): void {
    this.currentAnim = state;
    for (const rig of this.rigs) {
      rig.setAnimState(state);
    }
    const debug = initGlobalDebugState();
    debug.animState = state;
    this.updateStatusBanner();
  }

  public setGallerySlot(slot: 1 | 2 | 3 | 4): void {
    this.currentSlot = slot;
    for (const rig of this.playerRigs) {
      rig.setPlayerSlot(slot);
    }
    const debug = initGlobalDebugState();
    debug.playerSlot = slot;
    this.updateStatusBanner();
  }

  public setGalleryBiome(biome: 1 | 2 | 3): void {
    this.currentBiome = biome;
    const invBake = 1 / TextureBaker.getBakeScale();
    for (const item of this.floorTileSprites) {
      item.sprite.setTexture(TextureBaker.getBiomeTileTextureKey(biome, item.variant));
      item.sprite.setScale(invBake);
    }
    const debug = initGlobalDebugState();
    debug.biome = biome;
    this.updateStatusBanner();
  }

  private updateStatusBanner(): void {
    const slotInfo = PLAYER_SLOT_COLORS[this.currentSlot];
    const biomeInfo = BIOME_THEMES[this.currentBiome];
    this.stateStatusText?.setText(
      `Trạng thái Animation: ${this.currentAnim.toUpperCase()} · Định danh: ${slotInfo.labelVi} · Nền: ${biomeInfo.nameVi} · Bake Scale: ${TextureBaker.getBakeScale()}x`,
    );
  }

  private applyCameraViewport(): void {
    const cam = this.cameras.main;
    const zoom = Math.min(
      this.scale.width / WORLD_VIEW_WIDTH,
      this.scale.height / WORLD_VIEW_HEIGHT,
    );
    const prevScale = TextureBaker.getBakeScale();
    const newScale = TextureBaker.bakeAll(this, zoom, false);
    if (newScale !== prevScale) {
      for (const rig of this.rigs) {
        rig.refreshBakedTextures();
      }
      const invBake = 1 / newScale;
      for (const item of this.floorTileSprites) {
        item.sprite.setTexture(TextureBaker.getBiomeTileTextureKey(this.currentBiome, item.variant));
        item.sprite.setScale(invBake);
      }
    }
    cam.setZoom(zoom);
    cam.centerOn(WORLD_VIEW_WIDTH / 2, WORLD_VIEW_HEIGHT / 2);
    this.updateStatusBanner();
  }

  public override update(_time: number, deltaMs: number): void {
    const stepRes = this.simLoop.step(deltaMs, () => {});
    const dtSec = Math.min(deltaMs / 1000, 0.05);

    for (const rig of this.rigs) {
      rig.update(dtSec);
    }

    this.debugOverlay?.update({
      entityCount: this.rigs.length,
      bulletCount: 0,
      tick: stepRes.tick,
    });
  }
}
