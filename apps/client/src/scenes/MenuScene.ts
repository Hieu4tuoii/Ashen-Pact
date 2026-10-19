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

const PRESET_NAMES_VI = [
  'Hiệp Sĩ Tro',
  'Cung Thủ Gió',
  'Pháp Sư Lửa',
  'Hiền Nhân Rừng',
  'Kỹ Sư Thép',
];

export interface MenuSceneInitData {
  disconnectReason?: string;
}

export class MenuScene extends Phaser.Scene {
  private simLoop = new FixedTimestepLoop(60);
  private vanguardPreview?: CutoutRig;
  private goblinPreview?: CutoutRig;
  private floorTileSprites: { sprite: Phaser.GameObjects.Sprite; variant: number }[] = [];
  private textObjects: Phaser.GameObjects.Text[] = [];
  private debugOverlay?: DebugOverlay;

  private displayName: string = PRESET_NAMES_VI[0]!;
  private presetNameIndex = 0;
  private serverHostPort = '';
  private activeInputField: 'name' | 'ip' | null = null;
  private disconnectReason: string | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  public init(data?: MenuSceneInitData): void {
    this.disconnectReason = data?.disconnectReason ?? null;
    const savedName =
      typeof window !== 'undefined' ? window.localStorage?.getItem('ashen_pact_name') : null;
    if (savedName) {
      this.displayName = savedName;
    } else {
      this.presetNameIndex = Math.floor(Math.random() * PRESET_NAMES_VI.length);
      this.displayName = PRESET_NAMES_VI[this.presetNameIndex] ?? 'Hiệp Sĩ Tro';
    }
    const host = typeof window !== 'undefined' ? window.location.hostname || '127.0.0.1' : '127.0.0.1';
    this.serverHostPort = `${host}:2567`;
  }

  public create(): void {
    const debug = initGlobalDebugState();
    debug.scene = 'MenuScene';

    this.floorTileSprites = [];
    this.textObjects = [];
    this.activeInputField = null;

    this.applyCameraViewport();
    this.scale.on('resize', this.applyCameraViewport, this);

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
        .text(480, 94, 'Top-Down Co-op LAN Action Roguelite · 1–4 Người Chơi Mạng Nội Bộ', {
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

    if (this.disconnectReason) {
      const banner = this.add.graphics();
      banner.fillStyle(hexToNum(PALETTE.RUBY_DARK), 0.96);
      banner.lineStyle(2, hexToNum(PALETTE.RUBY_CORE), 1);
      banner.fillRoundedRect(210, 132, 540, 28, 7);
      banner.strokeRoundedRect(210, 132, 540, 28, 7);
      this.textObjects.push(
        this.add
          .text(480, 146, `⚠ ${this.disconnectReason}`, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '12px',
            fontStyle: '700',
            color: PALETTE.BONE_WHITE,
            stroke: PALETTE.INK_DARK,
            strokeThickness: 2,
            resolution: textRes,
          })
          .setOrigin(0.5),
      );
    }

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

    // Co-op LAN Profile & IP Bar at y=178
    const coopBarBg = this.add.graphics();
    const coopBarText = this.add
      .text(480, 178, '', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '12px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.5,
        resolution: textRes,
      })
      .setOrigin(0.5);
    this.textObjects.push(coopBarText);

    const refreshCoopBar = () => {
      coopBarBg.clear();
      coopBarBg.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
      coopBarBg.lineStyle(
        2,
        hexToNum(this.activeInputField ? PALETTE.SOLAR_GOLD : PALETTE.INK_DARK),
        1,
      );
      coopBarBg.fillRoundedRect(240, 162, 480, 32, 8);
      coopBarBg.strokeRoundedRect(240, 162, 480, 32, 8);

      const nameCursor = this.activeInputField === 'name' ? '▌' : '';
      const ipCursor = this.activeInputField === 'ip' ? '▌' : '';
      coopBarText.setText(
        `Tên: [${this.displayName}${nameCursor}] ↻   |   IP LAN: [${this.serverHostPort}${ipCursor}]`,
      );
    };
    refreshCoopBar();

    // Interactive zones for Name & IP
    const nameZone = this.add
      .rectangle(355, 178, 220, 30, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    nameZone.on('pointerdown', () => {
      if (this.activeInputField === 'name') {
        this.presetNameIndex = (this.presetNameIndex + 1) % PRESET_NAMES_VI.length;
        this.displayName = PRESET_NAMES_VI[this.presetNameIndex] ?? 'Hiệp Sĩ Tro';
      } else {
        this.activeInputField = 'name';
      }
      refreshCoopBar();
    });

    const ipZone = this.add
      .rectangle(605, 178, 220, 30, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    ipZone.on('pointerdown', () => {
      this.activeInputField = this.activeInputField === 'ip' ? null : 'ip';
      refreshCoopBar();
    });

    // Keyboard handler for typing custom Name or IP in MenuScene
    const onKeyDown = (event: KeyboardEvent) => {
      if (!this.activeInputField) return;
      if (event.key === 'Escape' || event.key === 'Enter') {
        this.activeInputField = null;
        refreshCoopBar();
        return;
      }
      if (event.key === 'Backspace') {
        if (this.activeInputField === 'name') {
          this.displayName = this.displayName.slice(0, -1);
        } else {
          this.serverHostPort = this.serverHostPort.slice(0, -1);
        }
        refreshCoopBar();
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        if (this.activeInputField === 'name' && this.displayName.length < 18) {
          this.displayName += event.key;
        } else if (this.activeInputField === 'ip' && this.serverHostPort.length < 28) {
          this.serverHostPort += event.key;
        }
        refreshCoopBar();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.applyCameraViewport, this);
      window.removeEventListener('keydown', onKeyDown);
    });

    // Auto-detect LAN IP from server if available
    fetch('/api/host-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((info: { primaryLanIp?: string; port?: number } | null) => {
        if (info?.primaryLanIp && this.scene.isActive('MenuScene')) {
          this.serverHostPort = `${info.primaryLanIp}:${info.port ?? 2567}`;
          refreshCoopBar();
        }
      })
      .catch(() => {
        // Ignore when server is offline
      });

    // Menu Buttons (Button 1 kept at exact (480, 225) for Phase 0-3 E2E compatibility)
    this.createMenuButton(480, 225, 340, 42, 'Bắt Đầu Chơi Thử (Solo)', PALETTE.RUBY_CORE, () => {
      this.scene.start('GameScene', { coopMode: 'solo' });
    });

    this.createMenuButton(
      480,
      276,
      340,
      42,
      'Tạo Phòng Co-op LAN (Host)',
      PALETTE.BRASS_CORE,
      () => {
        this.saveProfileName();
        this.scene.start('GameScene', {
          coopMode: 'host',
          displayName: this.displayName || 'Hiệp Sĩ Tro',
          serverUrl: this.resolveServerWsUrl(),
        });
      },
    );

    this.createMenuButton(
      480,
      327,
      340,
      42,
      'Tham Gia Phòng LAN (Join IP)',
      PALETTE.AZURE_CORE,
      () => {
        this.saveProfileName();
        this.scene.start('GameScene', {
          coopMode: 'join',
          displayName: this.displayName || 'Cung Thủ Gió',
          serverUrl: this.resolveServerWsUrl(),
        });
      },
    );

    this.createMenuButton(392, 378, 164, 38, 'Art Gallery', PALETTE.STEEL_DARK, () => {
      this.scene.start('ArtGalleryScene');
    });

    this.createMenuButton(568, 378, 164, 38, 'Đổi Animation', PALETTE.GOBLIN_GREEN, () => {
      const nextState = this.vanguardPreview?.getAnimState() === 'idle' ? 'run' : 'idle';
      this.vanguardPreview?.setAnimState(nextState);
      this.goblinPreview?.setAnimState(nextState);
      debug.animState = nextState;
    });

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

  private saveProfileName(): void {
    try {
      window.localStorage?.setItem('ashen_pact_name', this.displayName);
    } catch {
      // Ignore storage restrictions
    }
  }

  private resolveServerWsUrl(): string {
    const trimmed = this.serverHostPort.trim();
    if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
      return trimmed;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostPort = trimmed.includes(':') ? trimmed : `${trimmed}:2567`;
    return `${protocol}//${hostPort}`;
  }

  private createMenuButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fillHex: string,
    onClick: () => void,
  ): void {
    const container = this.add.container(x, y);

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
        fontSize: '14px',
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
