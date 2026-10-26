import { type WifiProfileId } from '@ashen-pact/shared';
import { Client as ColyseusClient, type Room as ColyseusRoom } from 'colyseus.js';
import Phaser from 'phaser';
import { zzfx } from '../../audio/zzfx.js';
import { isEffectiveDebugUiEnabled, setServerDebugAllowed } from '../../core/debug-flag.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import { type GameScene } from '../GameScene.js';

export function setupKeyboardBindingsImpl(this: GameScene): void {
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
    Z: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
    X: kb.addKey(Phaser.Input.Keyboard.KeyCodes.X),
    T: kb.addKey(Phaser.Input.Keyboard.KeyCodes.T),
    V: kb.addKey(Phaser.Input.Keyboard.KeyCodes.V),
    I: kb.addKey(Phaser.Input.Keyboard.KeyCodes.I),
    TAB: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB, false),
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
    F8: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F8),
    F9: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F9),
  };

  kb.on('keydown-ESC', () => {
    zzfx.play('ui_click');
    if (this.settingsModal?.isOpen()) {
      this.settingsModal.close();
      return;
    }
    if (this.pauseModalOpen && this.pauseConfirmExitOpen) {
      this.pauseConfirmExitOpen = false;
      initGlobalDebugState().pauseConfirmExitOpen = false;
      this.rebuildPauseModal();
      return;
    }
    if (this.fullMapOpen) {
      this.fullMapOpen = false;
      initGlobalDebugState().fullMapOpen = false;
      return;
    }
    this.togglePauseModal();
  });

  this.keys.SHIFT.on('down', () => {
    this.dashQueued = true;
  });
  this.keys.SPACE.on('down', () => {
    this.skillQueued = true;
  });
  this.keys.Q.on('down', () => {
    this.wheelSwapQueued = true;
  });
  this.keys.E.on('down', () => {
    this.interactQueued = true;
    const sim = this.transport.getSim();
    if (sim.runState === 'victory' && sim.currentFloor < 6 && !this.resultDismissed) {
      this.resultDismissed = true;
      sim.campaignMaxFloors = 6;
      sim.runState = 'playing';
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('continue_campaign', {});
      }
    } else if (
      this.room &&
      this.coopMode !== 'solo' &&
      sim.inHub &&
      sim.portalActive &&
      Math.hypot(sim.player.x - sim.portalX, sim.player.y - sim.portalY) <= 76
    ) {
      sim.player.ready = true;
      this.room.send('set_ready', { ready: true, autoStartIfAllReady: true });
      if (sim.areAllPlayersReady() || sim.player.slot === 1) {
        this.room.send('start_run', {});
      }
    }
  });
  this.keys.Z.on('down', () => {
    const pointer = this.input.activePointer;
    const wPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.pingQueued = {
      x: wPt.x - this.lastShakeX,
      y: wPt.y - this.lastShakeY,
    };
  });
  this.keys.X.on('down', () => {
    this.dropWeaponQueued = true;
  });
  this.keys.V.on('down', () => {
    const sim = this.transport.getSim();
    if (this.room && this.coopMode !== 'solo') {
      if (!sim.player.ready) {
        sim.player.ready = true;
        this.room.send('set_ready', { ready: true, autoStartIfAllReady: true });
      } else if (sim.inHub && (sim.areAllPlayersReady() || sim.player.slot === 1)) {
        this.room.send('start_run', {});
      } else {
        sim.player.ready = false;
        this.room.send('set_ready', { ready: false });
      }
    } else {
      this.readyToggleQueued = true;
      if (sim.inHub) {
        sim.player.ready = true;
        sim.startDungeonRunFromHub();
      }
    }
    this.lastInvitePanelHash = '';
  });
  this.keys.I.on('down', () => {
    this.invitePanelVisible = !this.invitePanelVisible;
    initGlobalDebugState().invitePanelVisible = this.invitePanelVisible;
    this.lastInvitePanelHash = '';
  });
  this.keys.TAB.on('down', () => {
    this.fullMapOpen = !this.fullMapOpen;
    initGlobalDebugState().fullMapOpen = this.fullMapOpen;
  });
  this.keys.T.on('down', () => {
    const sim = this.transport.getSim();
    if (
      !this.pauseModalOpen &&
      !(this.settingsModal?.isOpen() ?? false) &&
      sim.runState === 'playing'
    ) {
      this.emoteWheelOpen = true;
      initGlobalDebugState().emoteWheelOpen = true;
    }
  });
  this.keys.T.on('up', () => {
    if (this.emoteWheelOpen) {
      if (this.emoteWheelHoveredId !== null) {
        this.queuedEmote = this.emoteWheelHoveredId;
      }
      this.emoteWheelOpen = false;
      this.emoteWheelHoveredId = null;
      initGlobalDebugState().emoteWheelOpen = false;
    }
  });
  this.keys.ONE.on('down', () => {
    const sim = this.transport.getSim();
    const lp = this.transport.getLocalPlayerState();
    const choice0 = lp.buffChoices[0];
    if (sim.runState === 'buff_choice' && choice0) {
      if (this.room && this.coopMode !== 'solo') {
        lp.buffChoices = [];
        this.room.send('select_buff', { buffId: choice0 });
      } else {
        sim.selectFloorBuff(choice0, lp.id);
      }
    } else if (this.keys?.T.isDown || this.emoteWheelOpen) {
      this.queuedEmote = 1;
      this.emoteWheelOpen = false;
      this.emoteWheelHoveredId = null;
      initGlobalDebugState().emoteWheelOpen = false;
    } else {
      this.queuedWeaponSlot = 0;
    }
  });
  this.keys.TWO.on('down', () => {
    const sim = this.transport.getSim();
    const lp = this.transport.getLocalPlayerState();
    const choice1 = lp.buffChoices[1];
    if (sim.runState === 'buff_choice' && choice1) {
      if (this.room && this.coopMode !== 'solo') {
        lp.buffChoices = [];
        this.room.send('select_buff', { buffId: choice1 });
      } else {
        sim.selectFloorBuff(choice1, lp.id);
      }
    } else if (this.keys?.T.isDown || this.emoteWheelOpen) {
      this.queuedEmote = 2;
      this.emoteWheelOpen = false;
      this.emoteWheelHoveredId = null;
      initGlobalDebugState().emoteWheelOpen = false;
    } else {
      this.queuedWeaponSlot = 1;
    }
  });
  this.keys.THREE.on('down', () => {
    const sim = this.transport.getSim();
    const lp = this.transport.getLocalPlayerState();
    const choice2 = lp.buffChoices[2];
    if (sim.runState === 'buff_choice' && choice2) {
      if (this.room && this.coopMode !== 'solo') {
        lp.buffChoices = [];
        this.room.send('select_buff', { buffId: choice2 });
      } else {
        sim.selectFloorBuff(choice2, lp.id);
      }
    } else if (this.keys?.T.isDown || this.emoteWheelOpen) {
      this.queuedEmote = 3;
      this.emoteWheelOpen = false;
      this.emoteWheelHoveredId = null;
      initGlobalDebugState().emoteWheelOpen = false;
    }
  });
  this.keys.FOUR.on('down', () => {
    if (this.keys?.T.isDown || this.emoteWheelOpen) {
      this.queuedEmote = 4;
      this.emoteWheelOpen = false;
      this.emoteWheelHoveredId = null;
      initGlobalDebugState().emoteWheelOpen = false;
    }
  });

  // R: Active Reload / Thermal Vent (INPUT_BUTTON.RELOAD_VENT); Alt+R or F6: Cycle Elemental Imbue (Debug)
  let lastCycleElementAt = -1000;
  const cycleElement = () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const now = performance.now();
    if (now - lastCycleElementAt < 60) return;
    lastCycleElementAt = now;
    this.transport.getSim().cycleImbueElement();
    zzfx.play('weapon_swap');
  };
  let lastAltREvent: KeyboardEvent | undefined;
  this.keys.R.on('down', (keyObj?: Phaser.Input.Keyboard.Key, event?: KeyboardEvent) => {
    this.reloadVentQueued = true;
    const domEvent = event ?? keyObj?.originalEvent;
    if ((domEvent?.altKey || keyObj?.altKey) && domEvent !== lastAltREvent) {
      lastAltREvent = domEvent;
      cycleElement();
    }
  });
  this.keys.F6.on('down', cycleElement);

  // G: Cycle Graphics Quality Preset (High -> Medium -> Low -> High)
  this.keys.G.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    graphicsSettings.cycleQuality();
  });

  // F2: Toggle God Mode
  this.keys.F2.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const sim = this.transport.getSim();
    const nextGod = !sim.player.godMode;
    sim.player.godMode = nextGod;
    const debug = initGlobalDebugState();
    debug.godMode = nextGod;
    if (this.room && this.coopMode !== 'solo') {
      this.room.send('set_god_mode', { godMode: nextGod });
    }
  });

  // F3: Spawn fresh sample wave of 3 enemies
  this.keys.F3.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    this.transport.getSim().spawnSampleWave();
  });

  // F4: Toggle Hitbox & SpatialHashGrid visualization
  this.keys.F4.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const debug = initGlobalDebugState();
    debug.showHitboxes = !debug.showHitboxes;
    if (!debug.showHitboxes) {
      this.hitboxGraphics.clear();
    }
  });

  // F5: Skip current room waves & unlock doors
  this.keys.F5.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const sim = this.transport.getSim();
    sim.skipCurrentRoomWaves();
    if (this.room && this.coopMode !== 'solo') {
      this.room.send('skip_waves', {});
    }
  });

  // F7: Toggle Phase 2 Stress Test (4 players + 80 enemies + 600+ projectiles)
  this.keys.F7.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const sim = this.transport.getSim();
    this.setStressTestMode(!sim.stressTestActive);
  });

  // F8: Toggle Phase 3 Bot Auto-Play (auto-clears Floor 1 -> Buff -> Floor 2 + Boss)
  this.keys.F8.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const sim = this.transport.getSim();
    const nextBot = !sim.botAutoPlayActive;
    sim.botAutoPlayActive = nextBot;
    initGlobalDebugState().botAutoPlayActive = nextBot;
    if (this.room && this.coopMode !== 'solo') {
      this.room.send('set_bot_autoplay', { active: nextBot });
    }
  });

  // F9: Cycle Phase 4 Wi-Fi Network Simulation Profile (off -> good -> normal -> bad)
  this.keys.F9.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const profiles: WifiProfileId[] = ['off', 'good', 'normal', 'bad'];
    const debug = initGlobalDebugState();
    const idx = (profiles.indexOf(debug.wifiProfile) + 1) % profiles.length;
    const nextProfile = profiles[idx]!;
    debug.wifiProfile = nextProfile;
    this.networkTransport?.setWifiProfile(nextProfile);
  });

  // ENTER: Confirm exit when Pause Exit Confirmation is open, or Replay run when Victory/Defeat modal is active
  kb.on('keydown-ENTER', () => {
    if (this.pauseModalOpen && this.pauseConfirmExitOpen) {
      zzfx.play('ui_click');
      this.pauseConfirmExitOpen = false;
      initGlobalDebugState().pauseConfirmExitOpen = false;
      this.togglePauseModal(false);
      this.scene.start('MenuScene');
      return;
    }
    const sim = this.transport.getSim();
    if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('replay_run', {});
        this.resultDismissed = true;
        this.triggerIrisTransition('close');
        this.invalidateAllHudCaches();
      } else {
        this.scene.restart();
      }
    }
  });

  kb.on('keydown-H', () => {
    const sim = this.transport.getSim();
    if (this.pauseModalOpen && !this.pauseConfirmExitOpen && !this.settingsModal?.isOpen()) {
      zzfx.play('portal_enter');
      this.togglePauseModal(false);
      sim.enterHub();
      this.triggerIrisTransition();
      return;
    }
    if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('return_to_hub', {});
      }
      sim.enterHub();
      this.resultDismissed = true;
      this.triggerIrisTransition();
      this.invalidateAllHudCaches();
    }
  });

  kb.on('keydown-O', () => {
    if (this.pauseModalOpen && !this.pauseConfirmExitOpen && !this.settingsModal?.isOpen()) {
      zzfx.play('ui_click');
      this.settingsModal?.open('settings');
    }
  });

  kb.on('keydown-M', () => {
    const sim = this.transport.getSim();
    if (this.pauseModalOpen && !this.pauseConfirmExitOpen && !this.settingsModal?.isOpen()) {
      zzfx.play('ui_click');
      this.openPauseConfirmExit();
      return;
    }
    if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
      this.scene.start('MenuScene');
    }
  });
}

export function getResolvedWsUrlImpl(this: GameScene): string {
  if (this.serverUrl) {
    if (this.serverUrl.startsWith('ws://') || this.serverUrl.startsWith('wss://')) {
      return this.serverUrl;
    }
    return `ws://${this.serverUrl}`;
  }
  const wsHost = window.location.hostname || 'localhost';
  const locPort = window.location.port;
  const wsPort = locPort && locPort !== '5173' && locPort !== '4173' ? locPort : '2567';
  return `ws://${wsHost}:${wsPort}`;
}

export async function fetchHostLanInfoImpl(this: GameScene): Promise<void> {
  const debug = initGlobalDebugState();
  try {
    const wsUrl = this.getResolvedWsUrl();
    const httpBase = wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
    const res = await fetch(`${httpBase}/api/host-info`);
    if (res.ok) {
      const data = (await res.json()) as {
        lanIps?: string[];
        primaryLanIp?: string;
        port?: number;
        debugAllowed?: boolean;
      };
      if (typeof data.debugAllowed === 'boolean') {
        setServerDebugAllowed(data.debugAllowed);
      }
      if (data.primaryLanIp) this.primaryLanIp = data.primaryLanIp;
      if (data.lanIps) this.lanIps = data.lanIps;
      if (data.port) this.serverPort = data.port;
      debug.lanIps = this.lanIps;
      this.updateHostInviteUrl();
    }
  } catch {
    // Ignore if endpoint is unreachable
  }
}

export function updateHostInviteUrlImpl(this: GameScene): void {
  const debug = initGlobalDebugState();
  const ip = this.primaryLanIp || window.location.hostname || '127.0.0.1';
  const roomQuery = this.room ? `?join=${this.room.roomId}` : '?coop=join';
  this.hostInviteUrl = `http://${ip}:${this.serverPort}/${roomQuery}`;
  debug.hostInviteUrl = this.hostInviteUrl;
  this.lastInvitePanelHash = '';
}

export function bindCoopRoomHandlersImpl(this: GameScene, room: ColyseusRoom): void {
  const debug = initGlobalDebugState();
  this.room = room;
  debug.serverConnected = true;
  debug.coopRoomId = room.roomId;
  this.updateHostInviteUrl();

  if (this.networkTransport) {
    this.networkTransport.setOnSendInput((msg) => {
      if (this.room === room) {
        room.send('input', msg);
      }
    });
  }

  room.onMessage(
    'coop_welcome',
    (msg: {
      playerId: number;
      slot: 1 | 2 | 3 | 4;
      seed: number;
      reconnectToken: string;
      isHost: boolean;
      debugAllowed?: boolean;
    }) => {
      if (!this.scene.isActive()) return;
      if (typeof msg.debugAllowed === 'boolean') {
        setServerDebugAllowed(msg.debugAllowed);
      }
      debug.seed = msg.seed;
      debug.playerSlot = msg.slot;
      this.reconnectToken = msg.reconnectToken;
      debug.reconnectToken = msg.reconnectToken;
      try {
        window.sessionStorage?.setItem('ashen_pact_reconnect_token', msg.reconnectToken);
        window.sessionStorage?.setItem('ashen_pact_room_id', room.roomId);
        if (room.reconnectionToken) {
          window.sessionStorage?.setItem('ashen_pact_colyseus_token', room.reconnectionToken);
        }
      } catch {
        // Ignore storage errors
      }
      this.networkTransport?.setLocalIdentity(msg.playerId, msg.slot);
      this.playerRig?.setPlayerSlot(msg.slot);
      this.lastInvitePanelHash = '';
      this.lastCoopHudHash = '';
    },
  );

  room.onMessage('world_snapshot', (snap) => {
    if (!this.scene.isActive()) return;
    this.networkTransport?.receiveSnapshot(snap);
  });

  room.onMessage('pong_check', (payload: { clientTime: number }) => {
    if (!this.scene.isActive()) return;
    const rtt = Math.max(1, Date.now() - payload.clientTime);
    this.networkTransport?.setRttMs(rtt);
    debug.pingMs = rtt;
    room.send('report_ping', { rttMs: rtt });
  });

  room.onMessage('host_disconnected', (msg: { reasonVi?: string }) => {
    if (!this.scene.isActive()) return;
    this.intentionalLeave = true;
    this.scene.start('MenuScene', {
      disconnectReason: msg.reasonVi ?? 'Phòng Co-op đã đóng do Host ngắt kết nối.',
    });
  });

  const onKicked = (msg: { reasonVi?: string }) => {
    if (!this.scene.isActive()) return;
    this.intentionalLeave = true;
    this.scene.start('MenuScene', {
      disconnectReason: msg.reasonVi ?? 'Bạn đã bị Host mời rời khỏi phòng.',
    });
  };
  room.onMessage('kicked', onKicked);
  room.onMessage('kicked_by_host', onKicked);

  room.onMessage('join_rejected', (msg: { reasonVi?: string }) => {
    if (!this.scene.isActive()) return;
    this.intentionalLeave = true;
    this.scene.start('MenuScene', {
      disconnectReason:
        msg.reasonVi ??
        'Đội đang chiến đấu — chỉ có thể tham gia ở Sảnh Chờ (Hub) hoặc giữa các tầng!',
    });
  });

  room.onMessage('character_select_result', () => {
    this.lastInvitePanelHash = '';
  });

  room.onMessage('debug_rejected', (msg: { command?: string; reason?: string }) => {
    if (!this.scene.isActive()) return;
    debug.lastDebugRejected = msg?.command ?? 'unknown';
  });

  room.onLeave((code: number) => {
    if (!this.scene.isActive() || this.intentionalLeave) return;
    // Code 4000 = Host disconnect, 4001 = Kicked, 4002 = Room Full, 4003 = Mid-run Join Rejected
    if (code === 4000 || code === 4001 || code === 4002 || code === 4003) {
      this.scene.start('MenuScene', {
        disconnectReason:
          code === 4001
            ? 'Bạn đã bị Host mời rời khỏi phòng.'
            : code === 4002
              ? 'Phòng Co-op đã đủ 4 người chơi.'
              : code === 4003
                ? 'Đội đang chiến đấu — chỉ có thể tham gia ở Sảnh Chờ (Hub) hoặc giữa các tầng!'
                : 'Phòng Co-op đã đóng do Host ngắt kết nối.',
      });
      return;
    }
    debug.serverConnected = false;
    void this.forceCoopReconnect();
  });
}

export async function connectCoopRoomImpl(this: GameScene): Promise<void> {
  const debug = initGlobalDebugState();
  await this.fetchHostLanInfo();
  try {
    const wsUrl = this.getResolvedWsUrl();
    this.colyseusClient = new ColyseusClient(wsUrl);
    const savedToken =
      this.reconnectToken ??
      (typeof window !== 'undefined'
        ? window.sessionStorage?.getItem('ashen_pact_reconnect_token')
        : null);
    const joinOpts = {
      name: this.displayName,
      reconnectToken: savedToken ?? undefined,
      seed: debug.seed,
    };

    const room = this.requestedRoomId
      ? await this.colyseusClient.joinById(this.requestedRoomId, joinOpts)
      : await this.colyseusClient.joinOrCreate('coop_room', joinOpts);

    if (!this.scene.isActive()) {
      void room.leave().catch(() => {});
      return;
    }

    this.bindCoopRoomHandlers(room);
    room.send('ping_check', { clientTime: Date.now(), rttMs: 8 });

    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (this.room && this.scene.isActive()) {
          const curRtt = this.networkTransport?.getTelemetry().rttMs ?? debug.pingMs ?? 8;
          this.room.send('ping_check', {
            clientTime: Date.now(),
            rttMs: curRtt,
          });
        }
      },
    });
  } catch {
    if (!this.scene.isActive()) return;
    debug.serverConnected = false;
  }
}

export async function forceCoopReconnectImpl(this: GameScene): Promise<boolean> {
  if (!this.colyseusClient) {
    this.colyseusClient = new ColyseusClient(this.getResolvedWsUrl());
  }
  const debug = initGlobalDebugState();
  const targetRoomId =
    this.room?.roomId ??
    this.requestedRoomId ??
    (typeof window !== 'undefined' ? window.sessionStorage?.getItem('ashen_pact_room_id') : null);
  const savedToken =
    this.reconnectToken ??
    (typeof window !== 'undefined'
      ? window.sessionStorage?.getItem('ashen_pact_reconnect_token')
      : null);

  if (this.room) {
    const prevRoom = this.room;
    this.intentionalLeave = true;
    this.room = undefined;
    try {
      await prevRoom.leave(false);
    } catch {
      // Ignore leave errors during simulated drop
    }
    this.intentionalLeave = false;
  }

  try {
    const joinOpts = {
      name: this.displayName,
      reconnectToken: savedToken ?? undefined,
    };
    const newRoom = targetRoomId
      ? await this.colyseusClient.joinById(targetRoomId, joinOpts)
      : await this.colyseusClient.joinOrCreate('coop_room', joinOpts);
    this.bindCoopRoomHandlers(newRoom);
    debug.serverConnected = true;
    return true;
  } catch {
    debug.serverConnected = false;
    return false;
  }
}

export async function connectHelloRoomImpl(this: GameScene): Promise<void> {
  const debug = initGlobalDebugState();
  await this.fetchHostLanInfo();
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

    room.onMessage('hello_welcome', (msg: { seed?: number; debugAllowed?: boolean }) => {
      if (!this.scene.isActive()) return;
      if (typeof msg.debugAllowed === 'boolean') {
        setServerDebugAllowed(msg.debugAllowed);
      }
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
