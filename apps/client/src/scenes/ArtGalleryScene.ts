import { FixedTimestepLoop, WORLD_VIEW_HEIGHT, WORLD_VIEW_WIDTH } from '@ashen-pact/shared';
import Phaser from 'phaser';
import type { CutoutRig, RigAnimState } from '../art/cutout-rig.js';
import { hexToNum, PALETTE, PLAYER_SLOT_COLORS } from '../art/palette.js';
import { TextureBaker } from '../art/texture-baker.js';
import { DebugOverlay, initGlobalDebugState } from '../ui/debug-overlay.js';
import {
  buildPage1StandardShowcase,
  buildPage2EnemiesAndBoss,
  buildPage3WeaponsAndProps,
  buildPage4CharactersAndSynergy,
  buildPage5Biome2And3Showcase,
  createEntityStage,
  createPaletteAndBiomePanel,
} from './art-gallery-pages.js';

declare global {
  interface Window {
    __GALLERY_SET_ANIM__?: (state: RigAnimState) => void;
    __GALLERY_SET_SLOT__?: (slot: 1 | 2 | 3 | 4) => void;
    __GALLERY_SET_BIOME__?: (biome: 1 | 2 | 3) => void;
    __GALLERY_SET_PAGE__?: (page: 1 | 2 | 3 | 4 | 5) => void;
  }
}

export class ArtGalleryScene extends Phaser.Scene {
  public simLoop = new FixedTimestepLoop(60);
  public rigs: CutoutRig[] = [];
  public playerRigs: CutoutRig[] = [];
  public floorTileSprites: {
    sprite: Phaser.GameObjects.Sprite;
    variant: number;
    fixedBiome?: 1 | 2 | 3;
  }[] = [];
  public bakedSprites: { sprite: Phaser.GameObjects.Sprite; mult: number }[] = [];
  public textObjects: Phaser.GameObjects.Text[] = [];
  public pageContainers: Phaser.GameObjects.Container[] = [];
  public page2Built = false;
  public page3Built = false;
  public page4Built = false;
  public page5Built = false;
  public currentPage: 1 | 2 | 3 | 4 | 5 = 1;
  public currentAnim: RigAnimState = 'idle';
  public currentSlot: 1 | 2 | 3 | 4 = 1;
  public currentBiome: 1 | 2 | 3 = 1;
  public stateStatusText?: Phaser.GameObjects.Text;
  public debugOverlay?: DebugOverlay;

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
    this.bakedSprites = [];
    this.textObjects = [];
    this.pageContainers = [];
    this.page2Built = false;
    this.page3Built = false;
    this.page4Built = false;
    this.page5Built = false;
    this.currentPage = 1;

    this.applyCameraViewport();
    this.scale.on('resize', this.applyCameraViewport, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.applyCameraViewport, this);
      delete window.__GALLERY_SET_ANIM__;
      delete window.__GALLERY_SET_SLOT__;
      delete window.__GALLERY_SET_BIOME__;
      delete window.__GALLERY_SET_PAGE__;
    });

    const textRes = TextureBaker.getBakeScale();

    // 1. Deep Backdrop (extended for ultrawide / non-16:9 aspect ratios)
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 1);
    bg.fillRect(-480, -270, WORLD_VIEW_WIDTH + 960, WORLD_VIEW_HEIGHT + 540);

    // 2. Top Header Banner
    const header = this.add.graphics();
    header.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.96);
    header.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
    header.fillRoundedRect(16, 10, 928, 54, 10);
    header.strokeRoundedRect(16, 10, 928, 54, 10);

    this.textObjects.push(
      this.add.text(28, 17, 'ART GALLERY — TRIỂN LÃM ĐỒ HỌA VECTOR', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '14px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 4,
        resolution: textRes,
      }),
    );

    this.stateStatusText = this.add.text(28, 40, '', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '10.5px',
      fontStyle: '600',
      color: PALETTE.CYAN_FROST,
      resolution: textRes,
    });
    this.textObjects.push(this.stateStatusText);

    // Page navigation buttons in top header
    this.createSmallButton(428, 37, 78, 28, '1. Mẫu Chuẩn', PALETTE.AZURE_CORE, () => {
      this.setGalleryPage(1);
    });
    this.createSmallButton(512, 37, 82, 28, '2. Biome 1', PALETTE.GOBLIN_GREEN, () => {
      this.setGalleryPage(2);
    });
    this.createSmallButton(600, 37, 86, 28, '3. 24 Vũ Khí', PALETTE.ELECTRIC_VIOLET, () => {
      this.setGalleryPage(3);
    });
    this.createSmallButton(692, 37, 82, 28, '4. 5 Nhân Vật', PALETTE.RUBY_CORE, () => {
      this.setGalleryPage(4);
    });
    this.createSmallButton(780, 37, 88, 28, '5. Biome 2 & 3', PALETTE.CYAN_FROST, () => {
      this.setGalleryPage(5);
    });

    const menuBtn = this.add
      .text(898, 28, '[Về Menu]', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '12px',
        fontStyle: '700',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));
    this.textObjects.push(menuBtn);

    // 3. Build Gallery Page 1 initially (Pages 2, 3, 4, 5 lazy-built on tab switch)
    const p1 = this.add.container(0, 0);
    const p2 = this.add.container(0, 0);
    const p3 = this.add.container(0, 0);
    const p4 = this.add.container(0, 0);
    const p5 = this.add.container(0, 0);
    this.pageContainers = [p1, p2, p3, p4, p5];

    this.buildPage1StandardShowcase(p1);
    this.setGalleryPage(1);

    // 4. Bottom Interactive Control Bar (kept at exact Phase 0 coordinates for E2E compatibility)
    this.createControlBar(16, 460, 928, 68);

    this.updateStatusBanner();
    this.debugOverlay = new DebugOverlay(this, false);

    window.__GALLERY_SET_ANIM__ = (state: RigAnimState) => this.setGalleryAnim(state);
    window.__GALLERY_SET_SLOT__ = (slot: 1 | 2 | 3 | 4) => this.setGallerySlot(slot);
    window.__GALLERY_SET_BIOME__ = (biome: 1 | 2 | 3) => this.setGalleryBiome(biome);
    window.__GALLERY_SET_PAGE__ = (page: 1 | 2 | 3 | 4 | 5) => this.setGalleryPage(page);

    this.input.keyboard?.on('keydown-ONE', () => this.setGalleryPage(1));
    this.input.keyboard?.on('keydown-TWO', () => this.setGalleryPage(2));
    this.input.keyboard?.on('keydown-THREE', () => this.setGalleryPage(3));
    this.input.keyboard?.on('keydown-FOUR', () => this.setGalleryPage(4));
    this.input.keyboard?.on('keydown-FIVE', () => this.setGalleryPage(5));
  }

  public buildPage1StandardShowcase(parent: Phaser.GameObjects.Container): void {
    buildPage1StandardShowcase.call(this, parent);
  }

  public buildPage2EnemiesAndBoss(parent: Phaser.GameObjects.Container): void {
    buildPage2EnemiesAndBoss.call(this, parent);
  }

  public buildPage3WeaponsAndProps(parent: Phaser.GameObjects.Container): void {
    buildPage3WeaponsAndProps.call(this, parent);
  }

  public buildPage4CharactersAndSynergy(parent: Phaser.GameObjects.Container): void {
    buildPage4CharactersAndSynergy.call(this, parent);
  }

  public buildPage5Biome2And3Showcase(parent: Phaser.GameObjects.Container): void {
    buildPage5Biome2And3Showcase.call(this, parent);
  }

  public createEntityStage(
    parent: Phaser.GameObjects.Container,
    cfg: Parameters<typeof createEntityStage>[1],
  ): void {
    createEntityStage.call(this, parent, cfg);
  }

  public createPaletteAndBiomePanel(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    createPaletteAndBiomePanel.call(this, parent, x, y, w, h);
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
        fontSize: '11px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: TextureBaker.getBakeScale(),
      })
      .setOrigin(0.5);
    this.textObjects.push(txt);

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', onClick);

    container.add([bg, txt, hit]);
  }

  public setGalleryPage(page: 1 | 2 | 3 | 4 | 5): void {
    const zoom = Math.min(
      this.scale.width / WORLD_VIEW_WIDTH,
      this.scale.height / WORLD_VIEW_HEIGHT,
    );
    if (page === 2 && !this.page2Built && this.pageContainers[1]) {
      TextureBaker.bakeAll(this, zoom, false);
      this.buildPage2EnemiesAndBoss(this.pageContainers[1]);
      this.page2Built = true;
    } else if (page === 3 && !this.page3Built && this.pageContainers[2]) {
      TextureBaker.bakeAll(this, zoom, false);
      this.buildPage3WeaponsAndProps(this.pageContainers[2]);
      this.page3Built = true;
    } else if (page === 4 && !this.page4Built && this.pageContainers[3]) {
      TextureBaker.bakeAll(this, zoom, false);
      this.buildPage4CharactersAndSynergy(this.pageContainers[3]);
      this.page4Built = true;
    } else if (page === 5 && !this.page5Built && this.pageContainers[4]) {
      TextureBaker.bakeAll(this, zoom, false);
      this.buildPage5Biome2And3Showcase(this.pageContainers[4]);
      this.page5Built = true;
    }
    this.currentPage = page;
    initGlobalDebugState().galleryPage = page;
    this.pageContainers.forEach((c, idx) => {
      c.setVisible(idx + 1 === page);
    });
    this.updateStatusBanner();
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
      const targetBiome = item.fixedBiome ?? biome;
      item.sprite.setTexture(TextureBaker.getBiomeTileTextureKey(targetBiome, item.variant));
      item.sprite.setScale(invBake);
    }
    const debug = initGlobalDebugState();
    debug.biome = biome;
    this.updateStatusBanner();
  }

  private updateStatusBanner(): void {
    const slotInfo = PLAYER_SLOT_COLORS[this.currentSlot];
    this.stateStatusText?.setText(
      `Trang ${this.currentPage}/5 · Anim: ${this.currentAnim.toUpperCase()} · ${slotInfo.labelVi} · Biome ${this.currentBiome} · Bake: ${TextureBaker.getBakeScale()}x`,
    );
  }

  private applyCameraViewport(): void {
    const cam = this.cameras?.main;
    if (!cam) return;
    const zoom = Math.min(
      this.scale.width / WORLD_VIEW_WIDTH,
      this.scale.height / WORLD_VIEW_HEIGHT,
    );
    const prevScale = TextureBaker.getBakeScale();
    const newScale =
      !this.page2Built && !this.page3Built && !this.page4Built && !this.page5Built
        ? TextureBaker.bakeGalleryPage1(this, zoom)
        : TextureBaker.bakeAll(this, zoom, false);
    if (newScale !== prevScale) {
      for (const rig of this.rigs) {
        rig.refreshBakedTextures();
      }
      const invBake = 1 / newScale;
      for (const item of this.floorTileSprites) {
        const targetBiome = item.fixedBiome ?? this.currentBiome;
        item.sprite.setTexture(TextureBaker.getBiomeTileTextureKey(targetBiome, item.variant));
        item.sprite.setScale(invBake);
      }
      for (const item of this.bakedSprites) {
        item.sprite.setScale(invBake * item.mult);
      }
      for (const txt of this.textObjects) {
        txt.setResolution(newScale);
      }
      this.debugOverlay?.refreshResolution(newScale);
    }
    const zoomX = this.scale.width / WORLD_VIEW_WIDTH;
    const zoomY = this.scale.height / WORLD_VIEW_HEIGHT;
    cam.setZoom(zoomX, zoomY);
    cam.centerOn(WORLD_VIEW_WIDTH / 2, WORLD_VIEW_HEIGHT / 2);
    this.updateStatusBanner();
  }

  public override update(_time: number, deltaMs: number): void {
    const stepRes = this.simLoop.step(deltaMs, () => {});
    const dtSec = Math.min(deltaMs / 1000, 0.05);

    for (const rig of this.rigs) {
      if (rig.container.parentContainer?.visible !== false) {
        rig.update(dtSec);
      }
    }

    this.debugOverlay?.update({
      entityCount: this.rigs.length,
      bulletCount: 0,
      tick: stepRes.tick,
    });
  }
}
