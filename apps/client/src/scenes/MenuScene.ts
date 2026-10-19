import Phaser from 'phaser';
import {
  FixedTimestepLoop,
  VIETNAMESE_VERIFICATION_STRING,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { CutoutRig } from '../art/cutout-rig.js';
import { hexToNum, PALETTE } from '../art/palette.js';
import { GOBLIN_SHOOTER_RIG_DEF, VANGUARD_RIG_DEF } from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import { DebugOverlay, initGlobalDebugState } from '../ui/debug-overlay.js';

export class MenuScene extends Phaser.Scene {
  private simLoop = new FixedTimestepLoop(60);
  private vanguardPreview?: CutoutRig;
  private goblinPreview?: CutoutRig;
  private floorTileSprites: { sprite: Phaser.GameObjects.Sprite; variant: number }[] = [];
  private textObjects: Phaser.GameObjects.Text[] = [];
  private debugOverlay?: DebugOverlay;

  constructor() {
    super({ key: 'MenuScene' });
  }

  public create(): void {
    const debug = initGlobalDebugState();
    debug.scene = 'MenuScene';

    this.floorTileSprites = [];
    this.textObjects = [];

    this.applyCameraViewport();
    this.scale.on('resize', this.applyCameraViewport, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.applyCameraViewport, this);
    });

    const textRes = TextureBaker.getBakeScale();

    // Background panel (extended for ultrawide / non-16:9 aspect ratios)
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 1);
    bg.fillRect(-480, -270, WORLD_VIEW_WIDTH + 960, WORLD_VIEW_HEIGHT + 540);

    // Tiled biome 1 center arena rug
    const invBake = 1 / textRes;
    for (let gx = 0; gx < 24; gx++) {
      for (let gy = 0; gy < 8; gy++) {
        const variant = (gx + gy) % 4;
        const tile = this.add.sprite(
          112 + gx * 32,
          170 + gy * 32,
          TextureBaker.getBiomeTileTextureKey(1, variant),
        );
        tile.setScale(invBake);
        tile.setAlpha(0.78);
        this.floorTileSprites.push({ sprite: tile, variant });
      }
    }

    // Header Card
    const card = this.add.graphics();
    card.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.95);
    card.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
    card.fillRoundedRect(120, 26, 720, 98, 12);
    card.strokeRoundedRect(120, 26, 720, 98, 12);

    this.textObjects.push(
      this.add
        .text(480, 55, 'ASHEN PACT — KHẾ ƯỚC TRO TÀN', {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '28px',
          fontStyle: '800',
          color: PALETTE.SOLAR_GOLD,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 5,
          resolution: textRes,
        })
        .setOrigin(0.5),
    );

    this.textObjects.push(
      this.add
        .text(480, 94, 'Top-Down Co-op LAN Action Roguelite · Phase 0 Foundation', {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '14px',
          fontStyle: '600',
          color: PALETTE.SILVER_BRIGHT,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 3,
          resolution: textRes,
        })
        .setOrigin(0.5),
    );

    // Sample Rigs flanking menu buttons with clean spacing
    this.vanguardPreview = new CutoutRig(this, 185, 315, VANGUARD_RIG_DEF, {
      playerSlot: 1,
      displayScale: 2.2,
    });
    this.goblinPreview = new CutoutRig(this, 775, 315, GOBLIN_SHOOTER_RIG_DEF, {
      displayScale: 2.2,
      initialPhaseOffset: 0.7,
    });
    this.goblinPreview.setAimAngle(Math.PI);

    // Menu Buttons
    this.createMenuButton(480, 225, 'Bắt Đầu Chơi Thử (Game Scene)', PALETTE.RUBY_CORE, () => {
      this.scene.start('GameScene');
    });

    this.createMenuButton(
      480,
      290,
      'Phòng Trưng Bày Nghệ Thuật (Art Gallery)',
      PALETTE.AZURE_CORE,
      () => {
        this.scene.start('ArtGalleryScene');
      },
    );

    this.createMenuButton(
      480,
      355,
      'Đổi Animation Mẫu (Idle / Run)',
      PALETTE.GOBLIN_GREEN,
      () => {
        const nextState = this.vanguardPreview?.getAnimState() === 'idle' ? 'run' : 'idle';
        this.vanguardPreview?.setAnimState(nextState);
        this.goblinPreview?.setAnimState(nextState);
        debug.animState = nextState;
      },
    );

    // Vietnamese Diacritics Verification Footer
    const footer = this.add.graphics();
    footer.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.95);
    footer.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
    footer.fillRoundedRect(110, 448, 740, 64, 10);
    footer.strokeRoundedRect(110, 448, 740, 64, 10);

    this.textObjects.push(
      this.add
        .text(480, 468, VIETNAMESE_VERIFICATION_STRING, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '16px',
          fontStyle: '700',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 3,
          resolution: textRes,
        })
        .setOrigin(0.5),
    );

    this.textObjects.push(
      this.add
        .text(480, 494, 'Nhấn [F1] để bật/tắt Debug Overlay · 100% Procedural Vector Art', {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '12px',
          color: PALETTE.CYAN_FROST,
          resolution: textRes,
        })
        .setOrigin(0.5),
    );

    this.debugOverlay = new DebugOverlay(this, false);
  }

  private createMenuButton(
    x: number,
    y: number,
    label: string,
    fillHex: string,
    onClick: () => void,
  ): void {
    const container = this.add.container(x, y);
    const w = 340;
    const h = 48;

    const bg = this.add.graphics();
    const drawButton = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hexToNum(hover ? PALETTE.SOLAR_GOLD : fillHex), 1);
      bg.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    drawButton(false);

    const txt = this.add
      .text(0, 0, label, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '15px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: TextureBaker.getBakeScale(),
      })
      .setOrigin(0.5);
    this.textObjects.push(txt);

    const hitArea = this.add
      .rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => drawButton(true));
    hitArea.on('pointerout', () => drawButton(false));
    hitArea.on('pointerdown', onClick);

    container.add([bg, txt, hitArea]);
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
      this.vanguardPreview?.refreshBakedTextures();
      this.goblinPreview?.refreshBakedTextures();
      const invBake = 1 / newScale;
      for (const item of this.floorTileSprites) {
        item.sprite.setTexture(TextureBaker.getBiomeTileTextureKey(1, item.variant));
        item.sprite.setScale(invBake);
      }
      for (const txt of this.textObjects) {
        txt.setResolution(newScale);
      }
      this.debugOverlay?.refreshResolution(newScale);
    }
    cam.setZoom(zoom);
    cam.centerOn(WORLD_VIEW_WIDTH / 2, WORLD_VIEW_HEIGHT / 2);
  }

  public override update(_time: number, deltaMs: number): void {
    const stepRes = this.simLoop.step(deltaMs, () => {});
    const dtSec = Math.min(deltaMs / 1000, 0.05);
    this.vanguardPreview?.update(dtSec);
    this.goblinPreview?.update(dtSec);

    this.debugOverlay?.update({
      entityCount: 2,
      bulletCount: 0,
      tick: stepRes.tick,
    });
  }
}
