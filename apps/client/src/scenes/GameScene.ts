import Phaser from 'phaser';
import { Client as ColyseusClient, type Room as ColyseusRoom } from 'colyseus.js';
import {
  CHARACTERS,
  clamp,
  ENEMY_SPAWN_WARMUP_SEC,
  INPUT_BUTTON,
  LocalTransport,
  PHASE1_SAMPLE_WEAPONS,
  type SimEnemyState,
  type SimEvent,
  TILE_SIZE,
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
import { DebugOverlay, initGlobalDebugState } from '../ui/debug-overlay.js';

declare global {
  interface Window {
    __GAME_TRANSPORT__?: LocalTransport;
  }
}

export class GameScene extends Phaser.Scene {
  private transport!: LocalTransport;
  private fx!: CombatFxManager;
  private playerRig?: CutoutRig;
  private enemyRigs = new Map<number, CutoutRig>();
  private projectileSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private pickupSprites = new Map<number, Phaser.GameObjects.Sprite>();

  private mapTileSprites: {
    sprite: Phaser.GameObjects.Sprite;
    kind: 'floor' | 'wall' | 'pillar';
    variant: number;
  }[] = [];
  private textObjects: Phaser.GameObjects.Text[] = [];

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
    ONE: Phaser.Input.Keyboard.Key;
    TWO: Phaser.Input.Keyboard.Key;
    THREE: Phaser.Input.Keyboard.Key;
    FOUR: Phaser.Input.Keyboard.Key;
    F2: Phaser.Input.Keyboard.Key;
    F3: Phaser.Input.Keyboard.Key;
    F4: Phaser.Input.Keyboard.Key;
    F5: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super({ key: 'GameScene' });
  }

  public create(): void {
    const debug = initGlobalDebugState();
    debug.scene = 'GameScene';

    this.enemyRigs.clear();
    this.projectileSprites.clear();
    this.pickupSprites.clear();
    this.mapTileSprites = [];
    this.textObjects = [];
    this.weaponSlotBgs = [];
    this.weaponIconSprites = [];

    // 1. Initialize LocalTransport + Authoritative 60Hz WorldSim
    this.transport = new LocalTransport({
      seed: debug.seed,
      mapConfig: { cols: 36, rows: 22, includePillars: true },
      spawnInitialWave: true,
      includeTrainingDummy: true,
      autoRespawnWaves: true,
    });
    window.__GAME_TRANSPORT__ = this.transport;

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
      delete window.__GAME_TRANSPORT__;
      if (this.room) {
        const activeRoom = this.room;
        this.room = undefined;
        void activeRoom.leave().catch(() => {});
      }
    });

    // 2. Build Arena Tilemap (Floor, Outer Walls, Interior Tactical Pillars)
    this.buildArenaTiles();

    // 3. Telegraph & Hitbox Overlay Graphics
    this.telegraphGraphics = this.add.graphics();
    this.telegraphGraphics.setDepth(15);

    this.hitboxGraphics = this.add.graphics();
    this.hitboxGraphics.setDepth(90);

    // 4. Player CutoutRig (Thiết Vệ)
    this.playerRig = new CutoutRig(this, sim.player.x, sim.player.y, VANGUARD_RIG_DEF, {
      playerSlot: 1,
      displayScale: 1,
    });
    this.playerRig.container.setDepth(30);
    this.playerRig.setEquippedWeapon(sim.getActiveWeaponId());

    // 5. Pooled Combat FX Manager (Particles, Slashes, Damage Numbers, Hit-Stop, Screen Shake)
    this.fx = new CombatFxManager(this);

    // 6. Custom Procedural Crosshair
    const invBake = 1 / TextureBaker.getBakeScale();
    this.crosshairSprite = this.add.sprite(sim.player.x + 64, sim.player.y, 'ui_crosshair');
    this.crosshairSprite.setScale(invBake);
    this.crosshairSprite.setDepth(950);

    // 7. Camera-Pinned Vector HUD
    this.buildVectorHud();

    // 8. Keyboard & Debug Bindings
    this.setupKeyboardBindings();

    this.debugOverlay = new DebugOverlay(this, false);
    void this.connectHelloRoom();
  }

  private buildArenaTiles(): void {
    const sim = this.transport.getSim();
    const map = sim.map;
    const invBake = 1 / TextureBaker.getBakeScale();

    // Deep backdrop outside map bounds
    const bg = this.add.graphics();
    bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 1);
    bg.fillRect(-600, -400, map.width + 1200, map.height + 800);
    bg.setDepth(0);

    for (let ty = 0; ty < map.rows; ty++) {
      for (let tx = 0; tx < map.cols; tx++) {
        const kind = map.getTile(tx, ty);
        const variant = (tx * 3 + ty * 5) % 4;
        const worldX = tx * TILE_SIZE + TILE_SIZE / 2;
        const worldY = ty * TILE_SIZE + TILE_SIZE / 2;

        let texKey = TextureBaker.getBiomeTileTextureKey(1, variant);
        let depth = 2;
        if (kind === 'wall') {
          texKey = TextureBaker.getWallTileTextureKey(1);
          depth = 12;
        } else if (kind === 'pillar') {
          texKey = TextureBaker.getPillarTileTextureKey(1);
          depth = 24;
        }

        const sprite = this.add.sprite(worldX, worldY, texKey);
        sprite.setScale(invBake);
        sprite.setDepth(depth);
        this.mapTileSprites.push({ sprite, kind, variant });
      }
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
      'WASD: Chạy · Chuột Trái: Bắn · Shift: Dash (i-frame) · Space/Chuột Phải: Khiên Hồng Ngọc · Q/1-4: Vũ khí · [F1-F5]: Debug',
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '11px',
        fontStyle: '600',
        color: PALETTE.CYAN_FROST,
        resolution: textRes,
      },
    );
    this.textObjects.push(this.statusText);
    this.hudContainer.add(this.statusText);

    const galleryBtn = this.add
      .text(742, 42, '[Xem Art Gallery]', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '12px',
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
        fontSize: '12px',
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
      ONE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      TWO: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      THREE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      FOUR: kb.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      F2: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F2),
      F3: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F3),
      F4: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F4),
      F5: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F5),
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
      for (const rig of this.enemyRigs.values()) {
        rig.refreshBakedTextures();
      }
      for (const item of this.mapTileSprites) {
        if (item.kind === 'wall') {
          item.sprite.setTexture(TextureBaker.getWallTileTextureKey(1));
        } else if (item.kind === 'pillar') {
          item.sprite.setTexture(TextureBaker.getPillarTileTextureKey(1));
        } else {
          item.sprite.setTexture(TextureBaker.getBiomeTileTextureKey(1, item.variant));
        }
        item.sprite.setScale(invBake);
      }
      for (const spr of this.projectileSprites.values()) {
        spr.setScale(invBake);
      }
      for (const spr of this.pickupSprites.values()) {
        spr.setScale(invBake);
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
      this.fx?.refreshResolution(newScale);
      this.debugOverlay?.refreshResolution(newScale);
    }

    cam.setZoom(zoom);
  }

  public override update(_time: number, rawDeltaMs: number): void {
    const sim = this.transport.getSim();
    const dtSec = Math.min(rawDeltaMs / 1000, 0.05);

    // 1. Sample Player Input (WASD + Mouse Aim + Buttons)
    const pointer = this.input.activePointer;
    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const pInterpPre = this.transport.getInterpolatedPlayerPos();
    const aimAngle = Math.atan2(worldPt.y - pInterpPre.y, worldPt.x - pInterpPre.x);

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
    const { simDeltaMs } = this.fx.consumeHitStopDelta(rawDeltaMs);
    if (simDeltaMs > 0) {
      this.transport.step(simDeltaMs);
    }

    // 3. Process Sim Events (SFX, Sparks, Damage Numbers, Hit-Stop, Screen Shake)
    this.processSimEvents(this.transport.consumeEvents());

    // 4. Render Interpolated Player & CutoutRig Animation
    const playerPos = this.transport.getInterpolatedPlayerPos();
    if (this.playerRig) {
      this.playerRig.container.setPosition(playerPos.x, playerPos.y);
      this.playerRig.setAimAngle(aimAngle);
      this.playerRig.setEquippedWeapon(sim.getActiveWeaponId());
      this.playerRig.setDashActive(sim.player.dashTimer > 0);

      const isMoving = Math.hypot(sim.player.vx, sim.player.vy) > 12;
      this.playerRig.setAnimState(isMoving ? 'run' : 'idle');
      this.playerRig.update(dtSec);
    }

    // 5. Sync & Interpolate Enemy CutoutRigs
    this.syncEnemyRigs(dtSec);

    // 6. Sync & Interpolate Projectiles & Pickups
    this.syncProjectilesAndPickups();

    // 7. Update Pooled Particles & Floating Damage Numbers
    this.fx.update(dtSec);

    // 8. Smooth Camera Follow + Cursor Lookahead (22%) + Trauma Screen Shake
    this.updateCameraWithLookaheadAndShake(playerPos.x, playerPos.y, worldPt.x, worldPt.y, dtSec);

    // 9. Update Procedural Crosshair at Mouse World Position
    const updatedWorldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const invBake = 1 / TextureBaker.getBakeScale();
    if (this.crosshairPulse > 0) {
      this.crosshairPulse = Math.max(0, this.crosshairPulse - dtSec * 5);
    }
    this.crosshairSprite.setPosition(updatedWorldPt.x, updatedWorldPt.y);
    this.crosshairSprite.setScale(invBake * (1 + this.crosshairPulse * 0.35));

    // 10. Draw Telegraphs, Spawn Circles, Shield Wall & Optional F4 Hitboxes
    this.renderTelegraphsAndShield(playerPos.x, playerPos.y);
    this.renderHitboxesIfEnabled();

    // 11. Update Camera-Pinned Vector HUD & Debug Telemetry
    this.updateVectorHud();
    this.updateDebugState(playerPos.x, playerPos.y);
  }

  private processSimEvents(events: SimEvent[]): void {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      switch (ev.kind) {
        case 'projectile_spawned': {
          if (ev.team === 'player') {
            const isShotgun = ev.weaponId === 'scrap_shotgun';
            this.fx.spawnMuzzleFlashAndCasing(ev.x, ev.y, ev.angle, isShotgun);
            this.crosshairPulse = isShotgun ? 0.9 : 0.45;
            this.playerRig?.triggerRecoil(isShotgun ? 6.5 : 4.2);

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
          } else {
            zzfx.play('shoot_pistol', ev.x, this.camFocusX);
          }
          break;
        }
        case 'melee_swing': {
          this.playerRig?.triggerMeleeSwing();
          this.fx.spawnMeleeSlash(ev.x, ev.y, ev.angle);
          this.crosshairPulse = 0.6;
          zzfx.play('swing_sword', ev.x, this.camFocusX);
          if (ev.bulletsDestroyed > 0) {
            zzfx.play('bullet_deflect', ev.x, this.camFocusX);
          }
          break;
        }
        case 'damage_dealt': {
          this.fx.spawnDamagePopup({
            x: ev.x,
            y: ev.y,
            amount: ev.amount,
            isCrit: ev.isCrit,
            targetKind: ev.targetKind,
            hitArmor: ev.hitArmor,
          });
          const hitAngle = Math.atan2(ev.knockbackY, ev.knockbackX);
          this.fx.spawnHitSparks(ev.x, ev.y, hitAngle, {
            isCrit: ev.isCrit,
            count: ev.isCrit ? 10 : 6,
          });

          if (ev.targetKind === 'enemy') {
            const rig = this.enemyRigs.get(ev.targetId);
            rig?.triggerHitFlash(0.12);
            zzfx.play(ev.isCrit ? 'crit_hit' : 'hit_enemy', ev.x, this.camFocusX);
          } else {
            this.playerRig?.triggerHitFlash(0.16);
            zzfx.play('player_hurt', ev.x, this.camFocusX);
          }
          break;
        }
        case 'projectile_impact': {
          this.fx.spawnHitSparks(ev.x, ev.y, ev.angle, {
            isCrit: ev.isCrit,
            hitWall: ev.hitWall,
            blockedByShield: ev.blockedByShield || ev.destroyedByMelee,
            count: ev.hitWall ? 4 : 6,
          });
          if (ev.blockedByShield || ev.destroyedByMelee) {
            zzfx.play('bullet_deflect', ev.x, this.camFocusX);
          }
          break;
        }
        case 'entity_killed': {
          this.fx.spawnEnemyDeathBurst(ev.defId, ev.x, ev.y);
          zzfx.play('kill_enemy', ev.x, this.camFocusX);
          break;
        }
        case 'dash_started': {
          this.fx.spawnDashDust(ev.x, ev.y);
          zzfx.play('dash', ev.x, this.camFocusX);
          break;
        }
        case 'enemy_telegraph': {
          zzfx.play('telegraph', ev.x, this.camFocusX);
          break;
        }
        case 'explosion': {
          this.fx.spawnExplosionBurst(ev.x, ev.y, ev.radius, PALETTE.TOXIC_PURPLE);
          zzfx.play('explosion', ev.x, this.camFocusX);
          break;
        }
        case 'skill_cast': {
          zzfx.play('skill_cast', ev.x, this.camFocusX);
          break;
        }
        case 'shield_shockwave': {
          this.fx.spawnExplosionBurst(ev.x, ev.y, 90, PALETTE.CRIMSON_BRIGHT);
          zzfx.play('shield_shockwave', ev.x, this.camFocusX);
          break;
        }
        case 'weapon_swapped': {
          zzfx.play('weapon_swap');
          break;
        }
        case 'pickup_collected': {
          zzfx.play('pickup', ev.x, this.camFocusX);
          break;
        }
        case 'hit_stop': {
          this.fx.triggerHitStop(ev.durationMs);
          this.fx.addTrauma(ev.trauma);
          break;
        }
      }
    }
  }

  private syncEnemyRigs(dtSec: number): void {
    const sim = this.transport.getSim();
    const activeIds = new Set<number>();

    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0) continue;
      activeIds.add(e.id);

      let rig = this.enemyRigs.get(e.id);
      if (!rig) {
        const rigDef = RIG_DEFS_BY_ID[e.defId] ?? RIG_DEFS_BY_ID.goblin_shooter!;
        rig = new CutoutRig(this, e.x, e.y, rigDef, {
          displayScale: 1,
          initialPhaseOffset: (e.id % 7) * 0.25,
        });
        rig.container.setDepth(28);
        this.enemyRigs.set(e.id, rig);
      }

      const pos = this.transport.getInterpolatedEnemyPos(e);
      rig.container.setPosition(pos.x, pos.y);
      rig.setAimAngle(e.aimAngle);

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

      const moving = Math.hypot(e.vx, e.vy) > 10;
      rig.setAnimState(moving ? 'run' : 'idle');
      rig.update(dtSec);
    }

    for (const [id, rig] of this.enemyRigs.entries()) {
      if (!activeIds.has(id)) {
        rig.destroy();
        this.enemyRigs.delete(id);
      }
    }
  }

  private syncProjectilesAndPickups(): void {
    const sim = this.transport.getSim();
    const invBake = 1 / TextureBaker.getBakeScale();

    // 1. Projectiles
    const activeProjIds = new Set<number>();
    for (let i = 0; i < sim.projectiles.length; i++) {
      const b = sim.projectiles[i]!;
      activeProjIds.add(b.id);

      let spr = this.projectileSprites.get(b.id);
      if (!spr) {
        let tex = 'proj_player_bolt';
        if (b.team === 'enemy') tex = 'proj_enemy_orb';
        else if (b.weaponId === 'scrap_shotgun') tex = 'proj_player_pellet';

        spr = this.add.sprite(b.x, b.y, tex);
        spr.setScale(invBake);
        spr.setDepth(b.team === 'enemy' ? 50 : 42);
        this.projectileSprites.set(b.id, spr);
      }

      const pos = this.transport.getInterpolatedProjectilePos(b);
      spr.setPosition(pos.x, pos.y);
      spr.setRotation(b.angle);
    }

    for (const [id, spr] of this.projectileSprites.entries()) {
      if (!activeProjIds.has(id)) {
        spr.destroy();
        this.projectileSprites.delete(id);
      }
    }

    // 2. Pickups (Energy & Gold)
    const activePickupIds = new Set<number>();
    for (let i = 0; i < sim.pickups.length; i++) {
      const pk = sim.pickups[i]!;
      activePickupIds.add(pk.id);

      let spr = this.pickupSprites.get(pk.id);
      if (!spr) {
        const tex = pk.kind === 'energy' ? 'fx_pickup_energy' : 'fx_pickup_gold';
        spr = this.add.sprite(pk.x, pk.y, tex);
        spr.setScale(invBake);
        spr.setDepth(25);
        this.pickupSprites.set(pk.id, spr);
      }

      const pos = this.transport.getInterpolatedPickupPos(pk);
      spr.setPosition(pos.x, pos.y);
    }

    for (const [id, spr] of this.pickupSprites.entries()) {
      if (!activePickupIds.has(id)) {
        spr.destroy();
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

    // 2. Enemy Spawn Circles, Attack Telegraphs & Mini HP Bars
    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0) continue;
      const pos = this.transport.getInterpolatedEnemyPos(e);

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

      // Enemy Attack Telegraphs (Section 3.7: high readability red warning before damage)
      if (e.aiState === 'telegraph') {
        const progress =
          e.telegraphDurationSec > 0 ? 1 - clamp(e.stateTimer / e.telegraphDurationSec, 0, 1) : 1;

        if (e.defId === 'goblin_shooter') {
          // 3-way laser sight telegraph lines (-15, 0, +15 deg)
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
          // Rectangular red charge corridor box along locked charge angle
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
          // Expanding crimson AoE blast circle (R = 68u)
          const r = e.telegraphRadius || 68;
          g.fillStyle(hexToNum(PALETTE.CRIMSON_BRIGHT), 0.16 + progress * 0.24);
          g.fillCircle(pos.x, pos.y, r * (0.35 + progress * 0.65));
          g.lineStyle(2.5, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.92);
          g.strokeCircle(pos.x, pos.y, r);
        }
      }

      // Floating HP bar above non-dummy enemies
      if (!e.isDummy && e.hp < e.maxHp) {
        this.drawEnemyHealthBar(g, pos.x, pos.y - 40, e);
      }
    }
  }

  private drawEnemyHealthBar(
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

    g.fillStyle(hexToNum(PALETTE.CRIMSON_BRIGHT), 1);
    g.fillRoundedRect(x - w / 2, y, Math.max(2, w * ratio), h, 1.5);
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
    const pPos = this.transport.getInterpolatedPlayerPos();
    g.lineStyle(2, 0x4ade80, 0.95);
    g.strokeCircle(pPos.x, pPos.y, sim.player.radius);

    // Enemy collision circles
    g.lineStyle(2, 0xfb7185, 0.95);
    for (const e of sim.enemies) {
      const ePos = this.transport.getInterpolatedEnemyPos(e);
      g.strokeCircle(ePos.x, ePos.y, e.radius);
    }

    // Projectile collision circles
    g.lineStyle(1.5, 0x22d3ee, 0.9);
    for (const b of sim.projectiles) {
      const bPos = this.transport.getInterpolatedProjectilePos(b);
      g.strokeCircle(bPos.x, bPos.y, b.radius);
    }
  }

  private updateVectorHud(): void {
    const sim = this.transport.getSim();
    const p = sim.player;
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

    const dps = sim.getRollingDps();
    const dashReady = p.dashCooldownTimer <= 0 ? 'Sẵn' : `${p.dashCooldownTimer.toFixed(1)}s`;
    const skillReady =
      p.skillActiveTimer > 0
        ? `Bật (${p.skillActiveTimer.toFixed(1)}s)`
        : p.skillCooldownTimer <= 0
          ? 'Sẵn'
          : `${p.skillCooldownTimer.toFixed(1)}s`;

    this.statsLineText.setText(
      `DPS: ${dps.toFixed(1)} · Xu: ${p.gold} · Đợt ${sim.waveNumber} · Dash: ${dashReady} · Khiên: ${skillReady} | ${VIETNAMESE_VERIFICATION_STRING}`,
    );

    // Highlight active weapon slot on bottom bar
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

    this.debugOverlay?.update({
      entityCount: 1 + sim.enemies.length,
      bulletCount: sim.projectiles.length,
      tick: sim.tick,
    });
  }
}
