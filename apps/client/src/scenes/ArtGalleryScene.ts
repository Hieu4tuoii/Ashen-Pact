import Phaser from 'phaser';
import {
  FixedTimestepLoop,
  PHASE3_WEAPON_IDS,
  VIETNAMESE_VERIFICATION_STRING,
  WEAPON_RARITY_COLORS,
  WEAPONS,
  type WeaponRarity,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { CutoutRig, type RigAnimState } from '../art/cutout-rig.js';
import { BIOME_THEMES, hexToNum, PALETTE, PLAYER_SLOT_COLORS } from '../art/palette.js';
import {
  GOBLIN_SHAMAN_RIG_DEF,
  GOBLIN_SHOOTER_RIG_DEF,
  GREEN_SLIME_RIG_DEF,
  MERCHANT_RIG_DEF,
  MINI_SLIME_RIG_DEF,
  SPORE_BOMBER_RIG_DEF,
  SPORE_KING_RIG_DEF,
  THORN_TURRET_RIG_DEF,
  VANGUARD_RIG_DEF,
  WILD_BOAR_RIG_DEF,
} from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import { DebugOverlay, initGlobalDebugState } from '../ui/debug-overlay.js';

declare global {
  interface Window {
    __GALLERY_SET_ANIM__?: (state: RigAnimState) => void;
    __GALLERY_SET_SLOT__?: (slot: 1 | 2 | 3 | 4) => void;
    __GALLERY_SET_BIOME__?: (biome: 1 | 2 | 3) => void;
    __GALLERY_SET_PAGE__?: (page: 1 | 2 | 3) => void;
  }
}

export class ArtGalleryScene extends Phaser.Scene {
  private simLoop = new FixedTimestepLoop(60);
  private rigs: CutoutRig[] = [];
  private playerRigs: CutoutRig[] = [];
  private floorTileSprites: { sprite: Phaser.GameObjects.Sprite; variant: number }[] = [];
  private bakedSprites: { sprite: Phaser.GameObjects.Sprite; mult: number }[] = [];
  private textObjects: Phaser.GameObjects.Text[] = [];
  private pageContainers: Phaser.GameObjects.Container[] = [];
  private page2Built = false;
  private page3Built = false;
  private currentPage: 1 | 2 | 3 = 1;
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
    this.bakedSprites = [];
    this.textObjects = [];
    this.pageContainers = [];
    this.page2Built = false;
    this.page3Built = false;
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
      this.add.text(28, 17, 'ART GALLERY — TRIỂN LÃM ĐỒ HỌA VECTOR PROCEDURAL', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '15px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 4,
        resolution: textRes,
      }),
    );

    this.stateStatusText = this.add.text(28, 40, '', {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11.5px',
      fontStyle: '600',
      color: PALETTE.CYAN_FROST,
      resolution: textRes,
    });
    this.textObjects.push(this.stateStatusText);

    // Page navigation buttons in top header
    this.createSmallButton(564, 37, 94, 28, '1. Mẫu Chuẩn', PALETTE.AZURE_CORE, () => {
      this.setGalleryPage(1);
    });
    this.createSmallButton(666, 37, 98, 28, '2. Quái & Boss', PALETTE.GOBLIN_GREEN, () => {
      this.setGalleryPage(2);
    });
    this.createSmallButton(772, 37, 104, 28, '3. Vũ Khí & Map', PALETTE.ELECTRIC_VIOLET, () => {
      this.setGalleryPage(3);
    });

    const menuBtn = this.add
      .text(888, 28, '[Về Menu]', {
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

    // 3. Build Gallery Page 1 initially (Pages 2 & 3 lazy-built on tab switch)
    const p1 = this.add.container(0, 0);
    const p2 = this.add.container(0, 0);
    const p3 = this.add.container(0, 0);
    this.pageContainers = [p1, p2, p3];

    this.buildPage1StandardShowcase(p1);
    this.setGalleryPage(1);

    // 4. Bottom Interactive Control Bar (kept at exact Phase 0 coordinates for E2E compatibility)
    this.createControlBar(16, 460, 928, 68);

    this.updateStatusBanner();
    this.debugOverlay = new DebugOverlay(this, false);

    window.__GALLERY_SET_ANIM__ = (state: RigAnimState) => this.setGalleryAnim(state);
    window.__GALLERY_SET_SLOT__ = (slot: 1 | 2 | 3 | 4) => this.setGallerySlot(slot);
    window.__GALLERY_SET_BIOME__ = (biome: 1 | 2 | 3) => this.setGalleryBiome(biome);
    window.__GALLERY_SET_PAGE__ = (page: 1 | 2 | 3) => this.setGalleryPage(page);
  }

  private buildPage1StandardShowcase(parent: Phaser.GameObjects.Container): void {
    this.createEntityStage(parent, {
      x: 16,
      y: 72,
      w: 454,
      h: 274,
      titleVi: 'NHÂN VẬT MẪU: THIẾT VỆ (VANGUARD)',
      subtitleVi: 'Tỉ lệ Chibi (Đầu ~40%) · Viền 2.5u #141019 · Cel-Shade + Rim Light',
      rigDef: VANGUARD_RIG_DEF,
      isPlayer: true,
    });

    this.createEntityStage(parent, {
      x: 490,
      y: 72,
      w: 454,
      h: 274,
      titleVi: 'QUÁI MẪU BIOME 1: GOBLIN XẠ THỦ (GOBLIN SHOOTER)',
      subtitleVi: 'Cutout Rig 8 Bộ Phận · Animation Tham Số Idle / Run · Nỏ Tên Đỏ',
      rigDef: GOBLIN_SHOOTER_RIG_DEF,
      isPlayer: false,
    });

    this.createPaletteAndBiomePanel(parent, 16, 354, 928, 98);
  }

  private buildPage2EnemiesAndBoss(parent: Phaser.GameObjects.Container): void {
    const textRes = TextureBaker.getBakeScale();
    const invBake = 1 / textRes;
    const entries = [
      {
        title: '1. Goblin Xạ Thủ',
        sub: 'Bắn tỉa tầm xa · Giữ khoảng cách',
        rigDef: GOBLIN_SHOOTER_RIG_DEF,
        scale: 1.25,
      },
      {
        title: '2. Slime Xanh & Slime Con',
        sub: 'Tách làm 2 Slime Con khi bị hạ',
        rigDef: GREEN_SLIME_RIG_DEF,
        scale: 1.2,
        companionDef: MINI_SLIME_RIG_DEF,
      },
      {
        title: '3. Nấm Nổ Độc',
        sub: 'Lao vào tự sát · Tạo đầm độc',
        rigDef: SPORE_BOMBER_RIG_DEF,
        scale: 1.25,
      },
      {
        title: '4. Heo Rừng Húc',
        sub: 'Telegraph đỏ 0.6s · Húc thẳng',
        rigDef: WILD_BOAR_RIG_DEF,
        scale: 1.2,
      },
      {
        title: '5. Pháp Sư Goblin',
        sub: 'Hồi máu đồng minh & bắn đạn',
        rigDef: GOBLIN_SHAMAN_RIG_DEF,
        scale: 1.25,
      },
      {
        title: '6. Ụ Gai Độc',
        sub: 'Cố định · Phóng 6 gai độc tròn',
        rigDef: THORN_TURRET_RIG_DEF,
        scale: 1.25,
      },
      {
        title: '7. Thương Nhân Hắc Ám',
        sub: 'NPC bán vũ khí, máu & giáp',
        rigDef: MERCHANT_RIG_DEF,
        scale: 1.25,
      },
      {
        title: '8. Boss: Mục Vương Nấm Độc',
        sub: 'Boss 3 Pha: Bào Tử · Độn Thổ · Sương Độc',
        rigDef: SPORE_KING_RIG_DEF,
        scale: 1.02,
      },
    ];

    const cardW = 224;
    const cardH = 184;
    const gapX = 10;
    const gapY = 12;

    entries.forEach((item, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const cx = 16 + col * (cardW + gapX);
      const cy = 72 + row * (cardH + gapY);

      const g = this.add.graphics();
      g.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
      g.lineStyle(2, hexToNum(idx === 7 ? PALETTE.SOLAR_GOLD : PALETTE.INK_DARK), 1);
      g.fillRoundedRect(cx, cy, cardW, cardH, 9);
      g.strokeRoundedRect(cx, cy, cardW, cardH, 9);
      parent.add(g);

      for (let tx = 0; tx < 5; tx++) {
        for (let ty = 0; ty < 3; ty++) {
          const variant = (tx + ty) % 4;
          const spr = this.add.sprite(
            cx + 32 + tx * 32 + 16,
            cy + 56 + ty * 32 + 16,
            TextureBaker.getBiomeTileTextureKey(this.currentBiome, variant),
          );
          spr.setScale(invBake);
          this.floorTileSprites.push({ sprite: spr, variant });
          parent.add(spr);
        }
      }

      const rig = new CutoutRig(
        this,
        cx + (item.companionDef ? 94 : 112),
        cy + 122,
        item.rigDef,
        {
          displayScale: item.scale,
        },
      );
      rig.setAnimState(this.currentAnim);
      this.rigs.push(rig);
      parent.add(rig.container);

      if (item.companionDef) {
        const mini = new CutoutRig(this, cx + 152, cy + 128, item.companionDef, {
          displayScale: 1.05,
        });
        mini.setAnimState(this.currentAnim);
        this.rigs.push(mini);
        parent.add(mini.container);
      }

      const tTitle = this.add.text(cx + 12, cy + 10, item.title, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '12px',
        fontStyle: '800',
        color: idx === 7 ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      });
      this.textObjects.push(tTitle);
      parent.add(tTitle);

      const tSub = this.add.text(cx + 12, cy + 28, item.sub, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '10px',
        color: PALETTE.SILVER_BRIGHT,
        resolution: textRes,
      });
      this.textObjects.push(tSub);
      parent.add(tSub);
    });
  }

  private buildPage3WeaponsAndProps(parent: Phaser.GameObjects.Container): void {
    const textRes = TextureBaker.getBakeScale();
    const invBake = 1 / textRes;

    // 1. Weapons Panel (14 Weapons across 5 Rarities)
    const wepPanel = this.add.graphics();
    wepPanel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
    wepPanel.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
    wepPanel.fillRoundedRect(16, 72, 928, 252, 10);
    wepPanel.strokeRoundedRect(16, 72, 928, 252, 10);
    parent.add(wepPanel);

    const wepHeader = this.add.text(
      32,
      82,
      'KHO VŨ KHÍ PROCEDURAL (14 MÓN · 5 ĐỘ HIẾM: COMMON → LEGENDARY)',
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '13px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      },
    );
    this.textObjects.push(wepHeader);
    parent.add(wepHeader);

    const cardW = 124;
    const cardH = 96;
    PHASE3_WEAPON_IDS.forEach((wId, idx) => {
      const wDef = WEAPONS[wId];
      if (!wDef) return;
      const col = idx % 7;
      const row = Math.floor(idx / 7);
      const wx = 28 + col * (cardW + 6);
      const wy = 110 + row * (cardH + 8);
      const rarityHex = WEAPON_RARITY_COLORS[wDef.rarity];

      const cg = this.add.graphics();
      cg.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.9);
      cg.lineStyle(2, hexToNum(rarityHex), 1);
      cg.fillRoundedRect(wx, wy, cardW, cardH, 7);
      cg.strokeRoundedRect(wx, wy, cardW, cardH, 7);
      parent.add(cg);

      const spr = this.add.sprite(
        wx + cardW / 2,
        wy + 34,
        TextureBaker.getWeaponTextureKey(wId),
      );
      spr.setScale(invBake * 1.15);
      this.bakedSprites.push({ sprite: spr, mult: 1.15 });
      parent.add(spr);

      const wName = this.add
        .text(wx + cardW / 2, wy + 64, wDef.nameVi, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '9.5px',
          fontStyle: '800',
          color: rarityHex,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.5,
          resolution: textRes,
        })
        .setOrigin(0.5);
      this.textObjects.push(wName);
      parent.add(wName);

      const wMeta = this.add
        .text(wx + cardW / 2, wy + 80, `ST ${wDef.damage} · NL ${wDef.energyCost}`, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '9px',
          color: PALETTE.SILVER_BRIGHT,
          resolution: textRes,
        })
        .setOrigin(0.5);
      this.textObjects.push(wMeta);
      parent.add(wMeta);
    });

    // 2. Dungeon Props & Chests Panel
    const propPanel = this.add.graphics();
    propPanel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
    propPanel.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
    propPanel.fillRoundedRect(16, 332, 928, 120, 10);
    propPanel.strokeRoundedRect(16, 332, 928, 120, 10);
    parent.add(propPanel);

    const propHeader = this.add.text(
      32,
      342,
      'CÔNG TRÌNH HẦM NGỤC: 5 RƯƠNG ĐỘ HIẾM · CỬA KHÓA/MỞ · TƯỢNG THẦN · CỔNG DỊCH CHUYỂN · VẬT PHẨM',
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '12px',
        fontStyle: '800',
        color: PALETTE.CYAN_FROST,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      },
    );
    this.textObjects.push(propHeader);
    parent.add(propHeader);

    const chestLabelsVi: Record<WeaponRarity, string> = {
      common: 'Rương Thường',
      uncommon: 'Rương Khá',
      rare: 'Rương Hiếm',
      epic: 'Rương Sử Thi',
      legendary: 'Rương H.Thoại',
    };
    const rarities: WeaponRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const propItems: { tex: string; label: string }[] = [
      ...rarities.map((r) => ({
        tex: TextureBaker.getChestTextureKey(r, false),
        label: chestLabelsVi[r],
      })),
      { tex: 'door_locked', label: 'Cửa Khóa' },
      { tex: 'door_open', label: 'Cửa Mở' },
      { tex: 'prop_shrine_statue', label: 'Tượng Thần' },
      { tex: 'portal_active', label: 'Cổng Tầng' },
      { tex: 'item_health_potion', label: 'Bình Máu' },
    ];

    propItems.forEach((pItem, idx) => {
      const px = 64 + idx * 88;
      const py = 398;
      const spr = this.add.sprite(px, py, pItem.tex);
      spr.setScale(invBake * 0.9);
      this.bakedSprites.push({ sprite: spr, mult: 0.9 });
      parent.add(spr);

      const lbl = this.add
        .text(px, py + 36, pItem.label, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '9.5px',
          fontStyle: '700',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.5,
          resolution: textRes,
        })
        .setOrigin(0.5);
      this.textObjects.push(lbl);
      parent.add(lbl);
    });
  }

  private createEntityStage(
    parent: Phaser.GameObjects.Container,
    cfg: {
      x: number;
      y: number;
      w: number;
      h: number;
      titleVi: string;
      subtitleVi: string;
      rigDef: typeof VANGUARD_RIG_DEF;
      isPlayer: boolean;
    },
  ): void {
    const textRes = TextureBaker.getBakeScale();
    const panel = this.add.graphics();
    panel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
    panel.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
    panel.fillRoundedRect(cfg.x, cfg.y, cfg.w, cfg.h, 10);
    panel.strokeRoundedRect(cfg.x, cfg.y, cfg.w, cfg.h, 10);
    parent.add(panel);

    const tTitle = this.add.text(cfg.x + 16, cfg.y + 12, cfg.titleVi, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '13px',
      fontStyle: '800',
      color: PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    });
    this.textObjects.push(tTitle);
    parent.add(tTitle);

    const tSub = this.add.text(cfg.x + 16, cfg.y + 32, cfg.subtitleVi, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '11px',
      color: PALETTE.SILVER_BRIGHT,
      resolution: textRes,
    });
    this.textObjects.push(tSub);
    parent.add(tSub);

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
        parent.add(spr);
      }
    }

    const rig1x = new CutoutRig(this, cfg.x + 125, cfg.y + 185, cfg.rigDef, {
      playerSlot: cfg.isPlayer ? this.currentSlot : null,
      displayScale: 1.0,
    });

    const rigZoom = new CutoutRig(this, cfg.x + 310, cfg.y + 194, cfg.rigDef, {
      playerSlot: cfg.isPlayer ? this.currentSlot : null,
      displayScale: 2.25,
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
    parent.add([rig1x.container, rigZoom.container]);

    const lbl1x = this.add
      .text(cfg.x + 125, cfg.y + 248, '1.0× Kích Thước Thực (32u)', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(lbl1x);
    parent.add(lbl1x);

    const lblZoom = this.add
      .text(cfg.x + 310, cfg.y + 248, '2.25× Phóng Đại Soi Chi Tiết', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11px',
        fontStyle: '700',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(lblZoom);
    parent.add(lblZoom);
  }

  private createPaletteAndBiomePanel(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const textRes = TextureBaker.getBakeScale();
    const panel = this.add.graphics();
    panel.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
    panel.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
    panel.fillRoundedRect(x, y, w, h, 10);
    panel.strokeRoundedRect(x, y, w, h, 10);
    parent.add(panel);

    const tViet = this.add.text(x + 16, y + 10, VIETNAMESE_VERIFICATION_STRING, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '15px',
      fontStyle: '800',
      color: PALETTE.BONE_WHITE,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3.5,
      resolution: textRes,
    });
    this.textObjects.push(tViet);
    parent.add(tViet);

    const tSub = this.add.text(
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
    this.textObjects.push(tSub);
    parent.add(tSub);

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
    parent.add(swGraphics);
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

    const hit = this.add
      .rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', onClick);

    container.add([bg, txt, hit]);
  }

  public setGalleryPage(page: 1 | 2 | 3): void {
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
    }
    this.currentPage = page;
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
      `Trang ${this.currentPage}/3 · Anim: ${this.currentAnim.toUpperCase()} · ${slotInfo.labelVi} · ${biomeInfo.nameVi} · Bake: ${TextureBaker.getBakeScale()}x`,
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
      !this.page2Built && !this.page3Built
        ? TextureBaker.bakeGalleryPage1(this, zoom)
        : TextureBaker.bakeAll(this, zoom, false);
    if (newScale !== prevScale) {
      for (const rig of this.rigs) {
        rig.refreshBakedTextures();
      }
      const invBake = 1 / newScale;
      for (const item of this.floorTileSprites) {
        item.sprite.setTexture(TextureBaker.getBiomeTileTextureKey(this.currentBiome, item.variant));
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
    cam.setZoom(zoom);
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
