import Phaser from 'phaser';
import { Client as ColyseusClient, type Room as ColyseusRoom } from 'colyseus.js';
import {
  CHARACTERS,
  FixedTimestepLoop,
  lerp,
  VIETNAMESE_VERIFICATION_STRING,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { CutoutRig } from '../art/cutout-rig.js';
import { hexToNum, PALETTE } from '../art/palette.js';
import { GOBLIN_SHOOTER_RIG_DEF, VANGUARD_RIG_DEF } from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import { DebugOverlay, initGlobalDebugState } from '../ui/debug-overlay.js';

export class GameScene extends Phaser.Scene {
  private simLoop = new FixedTimestepLoop(60);
  private playerRig?: CutoutRig;
  private goblinRig?: CutoutRig;
  private debugOverlay?: DebugOverlay;
  private statusText?: Phaser.GameObjects.Text;
  private room?: ColyseusRoom;

  private prevPlayerPos = { x: 320, y: 270 };
  private currPlayerPos = { x: 320, y: 270 };
  private prevGoblinPos = { x: 640, y: 270 };
  private currGoblinPos = { x: 640, y: 270 };

  private keys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super({ key: 'GameScene' });
  }

  public create(): void {
    const debug = initGlobalDebugState();
    debug.scene = 'GameScene';

    this.applyCameraViewport();
    this.scale.on('resize', this.applyCameraViewport, this);

    const textRes = TextureBaker.getBakeScale();
    const invBake = 1 / textRes;

    for (let tx = 2; tx < 28; tx++) {
      for (let ty = 3; ty < 15; ty++) {
        const tile = this.add.sprite(
          tx * 32 + 16,
          ty * 32 + 16,
          TextureBaker.getBiomeTileTextureKey(1, (tx * 3 + ty) % 4),
        );
        tile.setScale(invBake);
      }
    }

    this.playerRig = new CutoutRig(
      this,
      this.currPlayerPos.x,
      this.currPlayerPos.y,
      VANGUARD_RIG_DEF,
      {
        playerSlot: 1,
        displayScale: 1,
      },
    );

    this.goblinRig = new CutoutRig(
      this,
      this.currGoblinPos.x,
      this.currGoblinPos.y,
      GOBLIN_SHOOTER_RIG_DEF,
      {
        displayScale: 1,
        initialPhaseOffset: 0.4,
      },
    );
    this.goblinRig.setAimAngle(Math.PI);

    const hudBar = this.add.graphics();
    hudBar.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.92);
    hudBar.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
    hudBar.fillRoundedRect(16, 12, 928, 56, 8);
    hudBar.strokeRoundedRect(16, 12, 928, 56, 8);

    const vanguardStats = CHARACTERS.vanguard;
    this.add.text(
      32,
      22,
      `${vanguardStats.nameVi} · HP ${vanguardStats.hp} · Giáp ${vanguardStats.armor} · NL ${vanguardStats.energy} | ${VIETNAMESE_VERIFICATION_STRING}`,
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '13px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      },
    );

    this.statusText = this.add.text(
      32,
      44,
      'WASD: Di chuyển · Chuột: Ngắm · [F1]: Debug Overlay · Kết nối Colyseus: Đang kiểm tra...',
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '12px',
        color: PALETTE.CYAN_FROST,
        resolution: textRes,
      },
    );

    const galleryBtn = this.add
      .text(815, 30, '[Xem Art Gallery]', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '13px',
        fontStyle: '700',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3,
        resolution: textRes,
      })
      .setInteractive({ useHandCursor: true });
    galleryBtn.on('pointerdown', () => this.scene.start('ArtGalleryScene'));

    if (this.input.keyboard) {
      this.keys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    this.debugOverlay = new DebugOverlay(this, false);
    this.connectHelloRoom();
  }

  private async connectHelloRoom(): Promise<void> {
    const debug = initGlobalDebugState();
    try {
      const wsHost = window.location.hostname || 'localhost';
      const client = new ColyseusClient(`ws://${wsHost}:2567`);
      const room = await client.joinOrCreate('hello_room', {});
      this.room = room;
      debug.serverConnected = true;

      room.onMessage('hello_welcome', (msg: { seed?: number; connectedPlayers?: number }) => {
        if (typeof msg.seed === 'number') {
          debug.seed = msg.seed;
        }
        this.statusText?.setText(
          `WASD: Di chuyển · Chuột: Ngắm · [F1]: Debug · Đã kết nối HelloRoom (Người chơi: ${msg.connectedPlayers ?? 1})`,
        );
      });

      room.onMessage('pong_check', (payload: { clientTime: number }) => {
        debug.pingMs = Math.max(1, Date.now() - payload.clientTime);
      });

      this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => {
          if (this.room) {
            this.room.send('ping_check', { clientTime: Date.now() });
          }
        },
      });
    } catch {
      debug.serverConnected = false;
      this.statusText?.setText(
        'WASD: Di chuyển · Chuột: Ngắm · [F1]: Debug · Chế độ Local Simulation (60Hz)',
      );
    }
  }

  private applyCameraViewport(): void {
    const cam = this.cameras.main;
    const zoom = Math.min(
      this.scale.width / WORLD_VIEW_WIDTH,
      this.scale.height / WORLD_VIEW_HEIGHT,
    );
    TextureBaker.bakeAll(this, zoom, false);
    cam.setZoom(zoom);
    cam.centerOn(WORLD_VIEW_WIDTH / 2, WORLD_VIEW_HEIGHT / 2);
  }

  public override update(_time: number, deltaMs: number): void {
    const moveSpeed = CHARACTERS.vanguard.moveSpeed;

    const stepRes = this.simLoop.step(deltaMs, (dtSec, tick) => {
      this.prevPlayerPos.x = this.currPlayerPos.x;
      this.prevPlayerPos.y = this.currPlayerPos.y;
      this.prevGoblinPos.x = this.currGoblinPos.x;
      this.prevGoblinPos.y = this.currGoblinPos.y;

      let mx = 0;
      let my = 0;
      if (this.keys) {
        if (this.keys.A.isDown) mx -= 1;
        if (this.keys.D.isDown) mx += 1;
        if (this.keys.W.isDown) my -= 1;
        if (this.keys.S.isDown) my += 1;
      }

      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        this.currPlayerPos.x = Phaser.Math.Clamp(
          this.currPlayerPos.x + (mx / len) * moveSpeed * dtSec,
          96,
          864,
        );
        this.currPlayerPos.y = Phaser.Math.Clamp(
          this.currPlayerPos.y + (my / len) * moveSpeed * dtSec,
          128,
          448,
        );
        this.playerRig?.setAnimState('run');
      } else {
        this.playerRig?.setAnimState('idle');
      }

      const patrolT = tick / 60;
      this.currGoblinPos.x = 640 + Math.sin(patrolT * 1.4) * 36;
      this.currGoblinPos.y = 270 + Math.cos(patrolT * 1.4) * 20;
      this.goblinRig?.setAnimState('run');
    });

    const alpha = stepRes.alpha;
    if (this.playerRig) {
      this.playerRig.container.x = lerp(this.prevPlayerPos.x, this.currPlayerPos.x, alpha);
      this.playerRig.container.y = lerp(this.prevPlayerPos.y, this.currPlayerPos.y, alpha);

      const pointer = this.input.activePointer;
      const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const aimAngle = Math.atan2(
        worldPt.y - this.playerRig.container.y,
        worldPt.x - this.playerRig.container.x,
      );
      this.playerRig.setAimAngle(aimAngle);
      this.playerRig.update(Math.min(deltaMs / 1000, 0.05));
    }

    if (this.goblinRig && this.playerRig) {
      this.goblinRig.container.x = lerp(this.prevGoblinPos.x, this.currGoblinPos.x, alpha);
      this.goblinRig.container.y = lerp(this.prevGoblinPos.y, this.currGoblinPos.y, alpha);
      const goblinAim = Math.atan2(
        this.playerRig.container.y - this.goblinRig.container.y,
        this.playerRig.container.x - this.goblinRig.container.x,
      );
      this.goblinRig.setAimAngle(goblinAim);
      this.goblinRig.update(Math.min(deltaMs / 1000, 0.05));
    }

    this.debugOverlay?.update({
      entityCount: 2,
      bulletCount: 0,
      tick: stepRes.tick,
    });
  }
}
