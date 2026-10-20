import { Room, type Client } from '@colyseus/core';
import { Schema, type } from '@colyseus/schema';
import {
  ALL_CHARACTER_IDS,
  type BuffId,
  type CharacterId,
  FixedTimestepLoop,
  type PlayerInputPacket,
  SIM_STEP_MS,
  type SimEvent,
  WorldSim,
  encodeWorldSnapshot,
} from '@ashen-pact/shared';

export class CoopRoomState extends Schema {
  @type('number') public tick = 0;
  @type('number') public seed = 0;
  @type('number') public playerCount = 0;
  @type('boolean') public inHub = true;
  @type('string') public hostName = 'Chủ Phòng';
}

interface ClientPlayerMeta {
  sessionId: string;
  playerId: number;
  slot: 1 | 2 | 3 | 4;
  displayName: string;
  isHost: boolean;
  reconnectToken: string;
  disconnectedAtMs: number | null;
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

export class CoopRoom extends Room<CoopRoomState> {
  public override maxClients = 8;
  private sim!: WorldSim;
  private simLoop = new FixedTimestepLoop(60);
  private readonly playersBySession = new Map<string, ClientPlayerMeta>();
  private readonly disconnectedByToken = new Map<string, ClientPlayerMeta>();
  private readonly accumulatedEvents: SimEvent[] = [];
  private snapshotTickCounter = 0;

  public override onCreate(options: Record<string, unknown>): void {
    const seed = typeof options.seed === 'number' ? options.seed : 202604;
    const startInHub = options.startInHub !== undefined ? Boolean(options.startInHub) : true;

    this.sim = new WorldSim({
      seed,
      startInHub,
      coopMode: true,
      spawnInitialWave: !startInHub,
      includeTrainingDummy: false,
      autoRevivePlayer: false,
    });
    this.sim.allowDuplicateCharacters =
      options.allowDuplicateCharacters !== undefined
        ? Boolean(options.allowDuplicateCharacters)
        : false;

    const state = new CoopRoomState();
    state.seed = seed;
    state.inHub = this.sim.inHub;
    this.setState(state);

    this.setSimulationInterval((deltaMs) => {
      const res = this.simLoop.step(deltaMs, (dtSec) => {
        this.sim.step(dtSec);
        const tickEvents = this.sim.consumeEvents();
        for (let i = 0; i < tickEvents.length; i++) {
          this.accumulatedEvents.push(tickEvents[i]!);
        }
        this.snapshotTickCounter += 1;
      });

      if (res.ticksExecuted > 0) {
        this.state.tick = this.sim.tick;
        this.state.inHub = this.sim.inHub;
        this.state.playerCount = this.sim.getAllPlayers().length;

        // Broadcast quantized snapshot at 30Hz (every 2 ticks of 60Hz sim)
        if (this.snapshotTickCounter >= 2) {
          this.snapshotTickCounter = 0;
          const snap = encodeWorldSnapshot(
            this.sim,
            this.accumulatedEvents,
            this.sim.allowDuplicateCharacters,
            Date.now(),
          );
          this.accumulatedEvents.length = 0;
          this.broadcast('world_snapshot', snap);
        }
      }
    }, SIM_STEP_MS);

    const handlePlayerInput = (client: Client, packet: PlayerInputPacket & { rttMs?: number }) => {
      const meta = this.playersBySession.get(client.sessionId);
      if (!meta || !packet) return;
      const pState = this.sim.getPlayerById(meta.playerId);
      if (pState && typeof packet.rttMs === 'number') {
        pState.pingMs = Math.max(1, Math.round(packet.rttMs));
      }
      this.sim.setCoopPlayerInput(meta.playerId, packet);
    };
    this.onMessage('player_input', handlePlayerInput);
    this.onMessage('input', handlePlayerInput);

    this.onMessage('select_character', (client, payload: { characterId?: CharacterId }) => {
      const meta = this.playersBySession.get(client.sessionId);
      if (!meta || !payload?.characterId) return;
      const ok = this.sim.selectCharacter(meta.playerId, payload.characterId);
      client.send('character_select_result', {
        ok,
        characterId: payload.characterId,
        reasonVi: ok
          ? undefined
          : 'Nhân vật này đã có đồng đội chọn (Chủ phòng đang tắt trùng nhân vật).',
      });
      this.broadcastImmediateSnapshot();
    });

    const handleToggleReady = (
      client: Client,
      payload?: { ready?: boolean; autoStartIfAllReady?: boolean },
    ) => {
      const meta = this.playersBySession.get(client.sessionId);
      if (!meta) return;
      this.sim.togglePlayerReady(meta.playerId, payload?.ready);
      if (this.sim.inHub && payload?.autoStartIfAllReady && this.sim.areAllPlayersReady()) {
        this.sim.startDungeonRunFromHub();
      }
      this.broadcastImmediateSnapshot();
    };
    this.onMessage('toggle_ready', handleToggleReady);
    this.onMessage('set_ready', handleToggleReady);

    this.onMessage('start_run', (client) => {
      const meta = this.playersBySession.get(client.sessionId);
      if (!meta) return;
      if ((meta.isHost || this.sim.areAllPlayersReady()) && this.sim.inHub) {
        this.sim.startDungeonRunFromHub();
        this.broadcastImmediateSnapshot();
      }
    });

    this.onMessage('return_to_hub', () => {
      this.sim.botAutoPlayActive = false;
      this.sim.enterHub();
      this.broadcastImmediateSnapshot();
    });

    this.onMessage('continue_campaign', () => {
      if (this.sim.runState === 'victory' && this.sim.currentFloor < 6) {
        this.sim.campaignMaxFloors = 6;
        this.sim.runState = 'playing';
        this.broadcastImmediateSnapshot();
      }
    });

    this.onMessage('replay_run', () => {
      this.sim.botAutoPlayActive = false;
      this.sim.startDungeonRunFromHub();
      this.broadcastImmediateSnapshot();
    });

    const handleToggleDuplicate = (client: Client, payload?: { allow?: boolean }) => {
      const meta = this.playersBySession.get(client.sessionId);
      if (!meta || !meta.isHost) return;
      this.sim.allowDuplicateCharacters =
        payload?.allow !== undefined ? Boolean(payload.allow) : !this.sim.allowDuplicateCharacters;
      this.broadcastImmediateSnapshot();
    };
    this.onMessage('toggle_duplicate_chars', handleToggleDuplicate);
    this.onMessage('toggle_duplicate_char', handleToggleDuplicate);

    this.onMessage('kick_player', (client, payload: { slot?: number; playerId?: number }) => {
      const meta = this.playersBySession.get(client.sessionId);
      if (!meta || !meta.isHost) return;
      for (const [sessId, otherMeta] of this.playersBySession.entries()) {
        if (otherMeta.isHost) continue;
        if (otherMeta.slot === payload?.slot || otherMeta.playerId === payload?.playerId) {
          const targetClient = this.clients.find((c) => c.sessionId === sessId);
          if (targetClient) {
            const kickMsg = {
              reasonVi: 'Chủ phòng đã mời bạn rời khỏi đội.',
            };
            targetClient.send('kicked_by_host', kickMsg);
            targetClient.send('kicked', kickMsg);
            targetClient.leave(4001);
          }
          this.removePlayerMeta(otherMeta);
          this.broadcastImmediateSnapshot();
          break;
        }
      }
    });

    this.onMessage('select_buff', (_client, payload: { buffId?: BuffId }) => {
      if (payload?.buffId && this.sim.runState === 'buff_choice') {
        this.sim.selectFloorBuff(payload.buffId);
        this.broadcastImmediateSnapshot();
      }
    });

    this.onMessage('skip_waves', () => {
      this.sim.skipCurrentRoomWaves();
      this.broadcastImmediateSnapshot();
    });

    this.onMessage('set_bot_autoplay', (_client, payload?: { active?: boolean }) => {
      this.sim.botAutoPlayActive = Boolean(payload?.active);
      this.broadcastImmediateSnapshot();
    });

    this.onMessage('set_god_mode', (client, payload?: { godMode?: boolean }) => {
      const meta = this.playersBySession.get(client.sessionId);
      if (!meta) return;
      const p = this.sim.getPlayerById(meta.playerId);
      if (p) {
        p.godMode = Boolean(payload?.godMode);
      }
      this.broadcastImmediateSnapshot();
    });

    this.onMessage('ping_check', (client, payload: { clientTime?: number; rttMs?: number }) => {
      const meta = this.playersBySession.get(client.sessionId);
      if (meta && typeof payload?.rttMs === 'number') {
        const p = this.sim.getPlayerById(meta.playerId);
        if (p) p.pingMs = Math.max(1, Math.round(payload.rttMs));
      }
      client.send('pong_check', {
        clientTime: payload?.clientTime ?? Date.now(),
        serverTick: this.sim.tick,
      });
    });

    this.onMessage('report_ping', (client, payload: { rttMs?: number }) => {
      const meta = this.playersBySession.get(client.sessionId);
      if (meta && typeof payload?.rttMs === 'number') {
        const p = this.sim.getPlayerById(meta.playerId);
        if (p) p.pingMs = Math.max(1, Math.round(payload.rttMs));
      }
    });

    this.onMessage(
      'debug_cmd',
      (
        _client,
        payload: {
          cmd?: string;
          roomId?: number;
          floor?: 1 | 2 | 3 | 4 | 5 | 6;
          enabled?: boolean;
          playerId?: number;
        },
      ) => {
        if (!payload?.cmd) return;
        if (payload.cmd === 'skip_waves') {
          this.sim.skipCurrentRoomWaves();
        } else if (payload.cmd === 'start_run') {
          if (this.sim.inHub) {
            for (const pl of this.sim.getAllPlayers()) {
              pl.ready = true;
            }
            this.sim.startDungeonRunFromHub();
          }
        } else if (payload.cmd === 'enter_room' && typeof payload.roomId === 'number') {
          this.sim.enterRoom(payload.roomId);
        } else if (
          payload.cmd === 'advance_floor' &&
          typeof payload.floor === 'number' &&
          payload.floor >= 1 &&
          payload.floor <= 6
        ) {
          this.sim.advanceToFloor(payload.floor as 1 | 2 | 3 | 4 | 5 | 6);
        } else if (payload.cmd === 'bot_autoplay') {
          this.sim.botAutoPlayActive = Boolean(payload.enabled);
        } else if (payload.cmd === 'god_mode_all') {
          for (const pl of this.sim.getAllPlayers()) {
            pl.godMode = Boolean(payload.enabled ?? true);
          }
        } else if (payload.cmd === 'down_player') {
          const target = this.sim.getPlayerById(payload.playerId ?? 2);
          if (target) {
            const nearHost = this.sim.map.resolveCircleCollision(
              this.sim.player.x + 56,
              this.sim.player.y - 24,
              target.radius,
            );
            target.x = nearHost.x;
            target.y = nearHost.y;
            target.prevX = nearHost.x;
            target.prevY = nearHost.y;
            target.vx = 0;
            target.vy = 0;
            // Keep nearby enemies and other teammates clear of the downed revival circle
            for (const e of this.sim.enemies) {
              if (!e.isDummy && Math.hypot(e.x - target.x, e.y - target.y) < 110) {
                const col = this.sim.map.resolveCircleCollision(target.x + 145, target.y, e.radius);
                e.x = col.x;
                e.y = col.y;
                e.prevX = col.x;
                e.prevY = col.y;
              }
            }
            target.godMode = false;
            target.invulnerableTimer = 0;
            target.armor = 0;
            this.sim.applyDamageToPlayer(target.hp + 10, 0, 0, 'debug', target);
          }
        } else if (payload.cmd === 'revive_all') {
          for (const pl of this.sim.getAllPlayers()) {
            pl.lifeState = 'alive';
            pl.hp = pl.maxHp;
            pl.armor = pl.maxArmor;
            pl.downedTimer = 0;
            pl.reviveProgress = 0;
          }
        }
        this.broadcastImmediateSnapshot();
      },
    );
  }

  public override onJoin(client: Client, options?: Record<string, unknown>): void {
    const requestedToken =
      typeof options?.reconnectToken === 'string' ? options.reconnectToken : '';

    // Check if this client is reconnecting within 30s with a valid reconnectToken
    // (either already in disconnectedByToken or replacing an in-flight closing session in playersBySession)
    const savedMeta = requestedToken
      ? (this.disconnectedByToken.get(requestedToken) ??
        Array.from(this.playersBySession.values()).find((m) => m.reconnectToken === requestedToken))
      : undefined;

    if (savedMeta) {
      if (savedMeta.cleanupTimer) {
        clearTimeout(savedMeta.cleanupTimer);
        savedMeta.cleanupTimer = undefined;
      }
      this.disconnectedByToken.delete(savedMeta.reconnectToken);
      this.playersBySession.delete(savedMeta.sessionId);
      savedMeta.sessionId = client.sessionId;
      savedMeta.disconnectedAtMs = null;
      this.playersBySession.set(client.sessionId, savedMeta);

      client.send('coop_welcome', {
        playerId: savedMeta.playerId,
        slot: savedMeta.slot,
        isHost: savedMeta.isHost,
        reconnectToken: savedMeta.reconnectToken,
        seed: this.state.seed,
        roomId: this.roomId,
        reconnected: true,
        allowDuplicateCharacters: this.sim.allowDuplicateCharacters,
      });
      this.broadcastImmediateSnapshot();
      return;
    }

    // New players (without reconnectToken) can only join in the Hub or between floors (buff_choice)
    if (this.playersBySession.size > 0 && !this.sim.inHub && this.sim.runState !== 'buff_choice') {
      client.send('join_rejected', {
        reasonVi: 'Đội đang chiến đấu — chỉ có thể tham gia ở Sảnh Chờ (Hub) hoặc giữa các tầng!',
      });
      client.leave(4003);
      return;
    }

    if (this.playersBySession.size + this.disconnectedByToken.size >= 4) {
      client.leave(4002);
      return;
    }

    const slot = this.findAvailableSlot();
    const playerId = slot;
    const isHost = slot === 1 && !Array.from(this.playersBySession.values()).some((m) => m.isHost);
    const defaultChar: CharacterId = ALL_CHARACTER_IDS[(slot - 1) % ALL_CHARACTER_IDS.length]!;
    let requestedChar =
      typeof options?.characterId === 'string' &&
      ALL_CHARACTER_IDS.includes(options.characterId as CharacterId)
        ? (options.characterId as CharacterId)
        : defaultChar;

    if (!this.sim.allowDuplicateCharacters && this.playersBySession.size > 0) {
      const takenChars = new Set(
        this.sim
          .getAllPlayers()
          .filter((p) => p.id !== playerId)
          .map((p) => p.characterId),
      );
      if (takenChars.has(requestedChar)) {
        const freeChar = ALL_CHARACTER_IDS.find((cid) => !takenChars.has(cid));
        if (freeChar) {
          requestedChar = freeChar;
        }
      }
    }

    const rawNameCandidate =
      typeof options?.displayName === 'string'
        ? options.displayName
        : typeof options?.name === 'string'
          ? options.name
          : '';
    const rawName =
      rawNameCandidate.trim().length > 0
        ? rawNameCandidate.trim().slice(0, 18)
        : `Chiến Hữu P${slot}`;

    const reconnectToken = `ap_${slot}_${Math.random().toString(36).slice(2, 10)}`;
    const meta: ClientPlayerMeta = {
      sessionId: client.sessionId,
      playerId,
      slot,
      displayName: rawName,
      isHost,
      reconnectToken,
      disconnectedAtMs: null,
    };
    this.playersBySession.set(client.sessionId, meta);

    this.sim.addCoopPlayer(slot, requestedChar, rawName, playerId);
    if (isHost) {
      this.state.hostName = rawName;
    }
    this.state.playerCount = this.sim.getAllPlayers().length;

    client.send('coop_welcome', {
      playerId,
      slot,
      isHost,
      reconnectToken,
      seed: this.state.seed,
      roomId: this.roomId,
      reconnected: false,
      allowDuplicateCharacters: this.sim.allowDuplicateCharacters,
    });

    this.broadcastImmediateSnapshot();
  }

  public override onLeave(client: Client, consented: boolean): void {
    const meta = this.playersBySession.get(client.sessionId);
    if (!meta) return;

    // If Host leaves intentionally (or disconnects when hostDisconnectImmediate is active), notify all clients
    if (meta.isHost) {
      this.broadcast('host_disconnected', {
        reasonVi: 'Chủ phòng đã ngắt kết nối. Đang quay về Menu chính...',
      });
      this.playersBySession.delete(client.sessionId);
      setTimeout(() => {
        void this.disconnect();
      }, 150);
      return;
    }

    if (consented) {
      this.removePlayerMeta(meta);
      this.broadcastImmediateSnapshot();
      return;
    }

    // Non-consented disconnect: allow 30 seconds to reconnect via reconnectToken
    meta.disconnectedAtMs = Date.now();
    this.playersBySession.delete(client.sessionId);
    this.disconnectedByToken.set(meta.reconnectToken, meta);

    meta.cleanupTimer = setTimeout(() => {
      if (this.disconnectedByToken.has(meta.reconnectToken)) {
        this.disconnectedByToken.delete(meta.reconnectToken);
        this.removePlayerMeta(meta);
        this.broadcastImmediateSnapshot();
      }
    }, 30_000);
  }

  private removePlayerMeta(meta: ClientPlayerMeta): void {
    if (meta.cleanupTimer) {
      clearTimeout(meta.cleanupTimer);
      meta.cleanupTimer = undefined;
    }
    this.playersBySession.delete(meta.sessionId);
    this.disconnectedByToken.delete(meta.reconnectToken);
    if (meta.playerId !== 1) {
      this.sim.removeCoopPlayer(meta.playerId);
    }
    this.state.playerCount = this.sim.getAllPlayers().length;
  }

  private findAvailableSlot(): 1 | 2 | 3 | 4 {
    const usedSlots = new Set<number>();
    for (const m of this.playersBySession.values()) {
      usedSlots.add(m.slot);
    }
    for (const m of this.disconnectedByToken.values()) {
      usedSlots.add(m.slot);
    }
    for (const s of [1, 2, 3, 4] as const) {
      if (!usedSlots.has(s)) return s;
    }
    return 4;
  }

  private broadcastImmediateSnapshot(): void {
    const events = this.sim.consumeEvents();
    for (let i = 0; i < events.length; i++) {
      this.accumulatedEvents.push(events[i]!);
    }
    const snap = encodeWorldSnapshot(
      this.sim,
      this.accumulatedEvents,
      this.sim.allowDuplicateCharacters,
      Date.now(),
    );
    this.accumulatedEvents.length = 0;
    this.broadcast('world_snapshot', snap);
  }
}
