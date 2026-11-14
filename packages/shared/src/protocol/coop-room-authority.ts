import { FixedTimestepLoop } from '../core/fixed-timestep.js';
import {
  type AshenPactId,
  type BuffId,
  type CharacterId,
  type WeaponMutatorId,
} from '../data/types.js';
import { ALL_CHARACTER_IDS, type SimEvent, WorldSim } from '../sim/world-sim.js';
import { type PlayerInputPacket } from './messages.js';
import { encodeWorldSnapshot } from './snapshot-codec.js';

export interface CoopAuthorityPeer {
  readonly sessionId: string;
  send(type: string, payload: unknown): void;
  close(code: number): void;
}

export interface CoopRoomAuthorityStateSummary {
  tick: number;
  seed: number;
  playerCount: number;
  inHub: boolean;
  hostName: string;
}

export interface CoopRoomAuthorityOptions {
  roomId: string;
  seed?: number;
  startInHub?: boolean;
  allowDuplicateCharacters?: boolean;
  isDebugEnabled?: () => boolean;
  onDebugRejected?: (sessionId: string, cmdName: string) => void;
  reconnectGraceMs?: number;
  onStateChange?: (state: CoopRoomAuthorityStateSummary) => void;
  onRoomClose?: () => void;
}

interface AuthorityPlayerMeta {
  sessionId: string;
  playerId: number;
  slot: 1 | 2 | 3 | 4;
  displayName: string;
  isHost: boolean;
  reconnectToken: string;
  disconnectedAtMs: number | null;
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Pure, transport-agnostic authoritative 1–4P Co-op session and simulation state machine.
 * Shared identically by `apps/server` (`CoopRoom` over Colyseus WebSockets) and
 * `@ashen-pact/client` (`PeerHostRoom` over WebRTC DataChannels).
 */
export class CoopRoomAuthority {
  public readonly sim: WorldSim;
  public readonly roomId: string;
  public readonly seed: number;
  private readonly simLoop = new FixedTimestepLoop(60);
  private readonly peersBySession = new Map<string, CoopAuthorityPeer>();
  private readonly playersBySession = new Map<string, AuthorityPlayerMeta>();
  private readonly disconnectedByToken = new Map<string, AuthorityPlayerMeta>();
  private readonly accumulatedEvents: SimEvent[] = [];
  private snapshotTickCounter = 0;
  private hostName = 'Chủ Phòng';
  private disposed = false;
  private readonly isDebugEnabled: () => boolean;
  private readonly onDebugRejected?: (sessionId: string, cmdName: string) => void;
  private readonly reconnectGraceMs: number;
  private readonly onStateChange?: (state: CoopRoomAuthorityStateSummary) => void;
  private readonly onRoomClose?: () => void;

  public constructor(options: CoopRoomAuthorityOptions) {
    this.roomId = options.roomId;
    this.seed = typeof options.seed === 'number' ? options.seed : 202604;
    const startInHub = options.startInHub !== undefined ? Boolean(options.startInHub) : true;
    this.isDebugEnabled = options.isDebugEnabled ?? (() => false);
    this.onDebugRejected = options.onDebugRejected;
    this.reconnectGraceMs = options.reconnectGraceMs ?? 30_000;
    this.onStateChange = options.onStateChange;
    this.onRoomClose = options.onRoomClose;

    this.sim = new WorldSim({
      seed: this.seed,
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

    this.emitStateChange();
  }

  public getStateSummary(): CoopRoomAuthorityStateSummary {
    return {
      tick: this.sim.tick,
      seed: this.seed,
      playerCount: this.sim.getAllPlayers().length,
      inHub: this.sim.inHub,
      hostName: this.hostName,
    };
  }

  public step(deltaMs: number): void {
    if (this.disposed) return;
    const res = this.simLoop.step(deltaMs, (dtSec) => {
      this.sim.step(dtSec);
      const tickEvents = this.sim.consumeEvents();
      for (let i = 0; i < tickEvents.length; i++) {
        this.accumulatedEvents.push(tickEvents[i]!);
      }
      this.snapshotTickCounter += 1;
    });

    if (res.ticksExecuted > 0) {
      this.emitStateChange();
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
  }

  public joinPeer(peer: CoopAuthorityPeer, options?: Record<string, unknown>): void {
    if (this.disposed) {
      peer.close(4000);
      return;
    }

    const requestedToken =
      typeof options?.reconnectToken === 'string' ? options.reconnectToken : '';

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
      this.peersBySession.delete(savedMeta.sessionId);

      savedMeta.sessionId = peer.sessionId;
      savedMeta.disconnectedAtMs = null;
      this.playersBySession.set(peer.sessionId, savedMeta);
      this.peersBySession.set(peer.sessionId, peer);

      peer.send('coop_welcome', {
        playerId: savedMeta.playerId,
        slot: savedMeta.slot,
        isHost: savedMeta.isHost,
        reconnectToken: savedMeta.reconnectToken,
        seed: this.seed,
        roomId: this.roomId,
        reconnected: true,
        allowDuplicateCharacters: this.sim.allowDuplicateCharacters,
        debugAllowed: this.isDebugEnabled(),
      });
      this.emitStateChange();
      this.broadcastImmediateSnapshot();
      return;
    }

    if (this.playersBySession.size > 0 && !this.sim.inHub && this.sim.runState !== 'buff_choice') {
      peer.send('join_rejected', {
        reasonVi: 'Đội đang chiến đấu — chỉ có thể tham gia ở Sảnh Chờ (Hub) hoặc giữa các tầng!',
      });
      peer.close(4003);
      return;
    }

    if (this.playersBySession.size + this.disconnectedByToken.size >= 4) {
      peer.close(4002);
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
    const meta: AuthorityPlayerMeta = {
      sessionId: peer.sessionId,
      playerId,
      slot,
      displayName: rawName,
      isHost,
      reconnectToken,
      disconnectedAtMs: null,
    };

    this.playersBySession.set(peer.sessionId, meta);
    this.peersBySession.set(peer.sessionId, peer);

    this.sim.addCoopPlayer(slot, requestedChar, rawName, playerId);
    if (isHost) {
      this.hostName = rawName;
    }
    this.emitStateChange();

    peer.send('coop_welcome', {
      playerId,
      slot,
      isHost,
      reconnectToken,
      seed: this.seed,
      roomId: this.roomId,
      reconnected: false,
      allowDuplicateCharacters: this.sim.allowDuplicateCharacters,
      debugAllowed: this.isDebugEnabled(),
    });

    this.broadcastImmediateSnapshot();
  }

  public handleMessage(sessionId: string, type: string, payload: unknown): void {
    if (this.disposed) return;
    const peer = this.peersBySession.get(sessionId);
    const meta = this.playersBySession.get(sessionId);

    switch (type) {
      case 'player_input':
      case 'input': {
        if (!meta || !payload) return;
        const packet = payload as PlayerInputPacket & { rttMs?: number };
        const pState = this.sim.getPlayerById(meta.playerId);
        if (pState && typeof packet.rttMs === 'number') {
          pState.pingMs = Math.max(1, Math.round(packet.rttMs));
        }
        this.sim.setCoopPlayerInput(meta.playerId, packet);
        return;
      }

      case 'select_character': {
        const body = payload as { characterId?: CharacterId } | undefined;
        if (!meta || !peer || !body?.characterId) return;
        const ok = this.sim.selectCharacter(meta.playerId, body.characterId);
        peer.send('character_select_result', {
          ok,
          characterId: body.characterId,
          reasonVi: ok
            ? undefined
            : 'Nhân vật này đã có đồng đội chọn (Chủ phòng đang tắt trùng nhân vật).',
        });
        this.broadcastImmediateSnapshot();
        return;
      }

      case 'toggle_ready':
      case 'set_ready': {
        if (!meta) return;
        const body = payload as { ready?: boolean; autoStartIfAllReady?: boolean } | undefined;
        this.sim.togglePlayerReady(meta.playerId, body?.ready);
        if (this.sim.inHub && body?.autoStartIfAllReady && this.sim.areAllPlayersReady()) {
          this.sim.startDungeonRunFromHub();
          this.emitStateChange();
        }
        this.broadcastImmediateSnapshot();
        return;
      }

      case 'start_run': {
        if (!meta) return;
        if ((meta.isHost || this.sim.areAllPlayersReady()) && this.sim.inHub) {
          this.sim.startDungeonRunFromHub();
          this.emitStateChange();
          this.broadcastImmediateSnapshot();
        }
        return;
      }

      case 'return_to_hub': {
        this.sim.botAutoPlayActive = false;
        this.sim.enterHub();
        this.emitStateChange();
        this.broadcastImmediateSnapshot();
        return;
      }

      case 'continue_campaign': {
        if (this.sim.runState === 'victory' && this.sim.currentFloor < 6) {
          this.sim.campaignMaxFloors = 6;
          this.sim.runState = 'playing';
          this.broadcastImmediateSnapshot();
        }
        return;
      }

      case 'replay_run': {
        this.sim.botAutoPlayActive = false;
        this.sim.startDungeonRunFromHub();
        this.emitStateChange();
        this.broadcastImmediateSnapshot();
        return;
      }

      case 'toggle_duplicate_chars':
      case 'toggle_duplicate_char': {
        if (!meta || !meta.isHost) return;
        const body = payload as { allow?: boolean } | undefined;
        this.sim.allowDuplicateCharacters =
          body?.allow !== undefined ? Boolean(body.allow) : !this.sim.allowDuplicateCharacters;
        this.broadcastImmediateSnapshot();
        return;
      }

      case 'kick_player': {
        if (!meta || !meta.isHost) return;
        const body = payload as { slot?: number; playerId?: number } | undefined;
        for (const [sessId, otherMeta] of this.playersBySession.entries()) {
          if (otherMeta.isHost) continue;
          if (otherMeta.slot === body?.slot || otherMeta.playerId === body?.playerId) {
            const targetPeer = this.peersBySession.get(sessId);
            if (targetPeer) {
              const kickMsg = {
                reasonVi: 'Chủ phòng đã mời bạn rời khỏi đội.',
              };
              targetPeer.send('kicked_by_host', kickMsg);
              targetPeer.send('kicked', kickMsg);
              targetPeer.close(4001);
            }
            this.removePlayerMeta(otherMeta);
            this.broadcastImmediateSnapshot();
            break;
          }
        }
        return;
      }

      case 'select_mutator': {
        const body = payload as { mutatorId?: WeaponMutatorId } | undefined;
        if (meta && body?.mutatorId) {
          if (this.sim.selectWeaponMutator(body.mutatorId, meta.playerId)) {
            this.broadcastImmediateSnapshot();
          }
        }
        return;
      }

      case 'select_pact': {
        const body = payload as { pactId?: AshenPactId | 'decline' } | undefined;
        if (meta && body?.pactId) {
          if (this.sim.selectAshenPact(body.pactId, meta.playerId)) {
            this.broadcastImmediateSnapshot();
          }
        }
        return;
      }

      case 'select_buff': {
        const body = payload as { buffId?: BuffId } | undefined;
        if (meta && body?.buffId && this.sim.runState === 'buff_choice') {
          this.sim.selectFloorBuff(body.buffId, meta.playerId);
          this.broadcastImmediateSnapshot();
        }
        return;
      }

      case 'teleport_room': {
        const body = payload as { roomId?: number } | undefined;
        if (!meta || typeof body?.roomId !== 'number') return;
        if (this.sim.inHub || this.sim.runState !== 'playing') return;
        const p = this.sim.getPlayerById(meta.playerId);
        if (!p || p.lifeState !== 'alive') return;
        const curRoom = this.sim.getCurrentRoom();
        if (
          !curRoom.cleared ||
          this.sim.hasActiveCombatEnemies() ||
          this.sim.secretTrialActive ||
          this.sim.doors.some((d) => d.locked && !d.isSecretPassage)
        ) {
          return;
        }
        const targetRoom = this.sim.dungeon.rooms[body.roomId];
        if (
          !targetRoom ||
          targetRoom.id === this.sim.currentRoomId ||
          (targetRoom.discovery !== 'visited' && targetRoom.discovery !== 'cleared')
        ) {
          return;
        }
        if (this.sim.enterRoom(targetRoom.id)) {
          this.sim.doorTransitionCooldown = Math.max(this.sim.doorTransitionCooldown, 0.75);
          this.broadcastImmediateSnapshot();
        }
        return;
      }

      case 'skip_waves': {
        if (this.rejectIfDebugDisabled(sessionId, peer, 'skip_waves')) return;
        this.sim.skipCurrentRoomWaves();
        this.broadcastImmediateSnapshot();
        return;
      }

      case 'set_bot_autoplay': {
        if (this.rejectIfDebugDisabled(sessionId, peer, 'set_bot_autoplay')) return;
        const body = payload as { active?: boolean } | undefined;
        this.sim.botAutoPlayActive = Boolean(body?.active);
        this.broadcastImmediateSnapshot();
        return;
      }

      case 'set_god_mode': {
        if (this.rejectIfDebugDisabled(sessionId, peer, 'set_god_mode')) return;
        if (!meta) return;
        const body = payload as { godMode?: boolean } | undefined;
        const p = this.sim.getPlayerById(meta.playerId);
        if (p) {
          p.godMode = Boolean(body?.godMode);
        }
        this.broadcastImmediateSnapshot();
        return;
      }

      case 'ping_check': {
        const body = payload as { clientTime?: number; rttMs?: number } | undefined;
        if (meta && typeof body?.rttMs === 'number') {
          const p = this.sim.getPlayerById(meta.playerId);
          if (p) p.pingMs = Math.max(1, Math.round(body.rttMs));
        }
        peer?.send('pong_check', {
          clientTime: body?.clientTime ?? Date.now(),
          serverTick: this.sim.tick,
        });
        return;
      }

      case 'report_ping': {
        const body = payload as { rttMs?: number } | undefined;
        if (meta && typeof body?.rttMs === 'number') {
          const p = this.sim.getPlayerById(meta.playerId);
          if (p) p.pingMs = Math.max(1, Math.round(body.rttMs));
        }
        return;
      }

      case 'debug_cmd': {
        if (this.rejectIfDebugDisabled(sessionId, peer, 'debug_cmd')) return;
        const body = payload as
          | {
              cmd?: string;
              roomId?: number;
              floor?: 1 | 2 | 3 | 4 | 5 | 6;
              enabled?: boolean;
              playerId?: number;
            }
          | undefined;
        if (!body?.cmd) return;
        if (body.cmd === 'skip_waves') {
          this.sim.skipCurrentRoomWaves();
        } else if (body.cmd === 'start_run') {
          if (this.sim.inHub) {
            for (const pl of this.sim.getAllPlayers()) {
              pl.ready = true;
            }
            this.sim.startDungeonRunFromHub();
          }
        } else if (body.cmd === 'enter_room' && typeof body.roomId === 'number') {
          this.sim.enterRoom(body.roomId);
        } else if (
          body.cmd === 'advance_floor' &&
          typeof body.floor === 'number' &&
          body.floor >= 1 &&
          body.floor <= 6
        ) {
          this.sim.advanceToFloor(body.floor);
        } else if (body.cmd === 'bot_autoplay') {
          this.sim.botAutoPlayActive = Boolean(body.enabled);
        } else if (body.cmd === 'god_mode_all') {
          for (const pl of this.sim.getAllPlayers()) {
            pl.godMode = Boolean(body.enabled ?? true);
          }
        } else if (body.cmd === 'down_player') {
          const target = this.sim.getPlayerById(body.playerId ?? 2);
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
        } else if (body.cmd === 'revive_all') {
          for (const pl of this.sim.getAllPlayers()) {
            pl.lifeState = 'alive';
            pl.hp = pl.maxHp;
            pl.armor = pl.maxArmor;
            pl.downedTimer = 0;
            pl.reviveProgress = 0;
          }
        }
        this.emitStateChange();
        this.broadcastImmediateSnapshot();
        return;
      }

      default:
        return;
    }
  }

  public leavePeer(sessionId: string, consented: boolean): void {
    if (this.disposed) return;
    const meta = this.playersBySession.get(sessionId);
    if (!meta) return;

    if (meta.isHost) {
      this.playersBySession.delete(sessionId);
      this.peersBySession.delete(sessionId);
      this.clearDisconnectedTimers();

      const remainingPeers = Array.from(this.peersBySession.values());
      this.playersBySession.clear();
      this.peersBySession.clear();

      const disconnectNotice = {
        reasonVi: 'Chủ phòng đã ngắt kết nối. Đang quay về Menu chính...',
      };
      for (const otherPeer of remainingPeers) {
        otherPeer.send('host_disconnected', disconnectNotice);
        otherPeer.close(4000);
      }

      this.onRoomClose?.();
      return;
    }

    if (consented) {
      this.removePlayerMeta(meta);
      this.broadcastImmediateSnapshot();
      return;
    }

    meta.disconnectedAtMs = Date.now();
    this.playersBySession.delete(sessionId);
    this.peersBySession.delete(sessionId);
    this.disconnectedByToken.set(meta.reconnectToken, meta);

    meta.cleanupTimer = setTimeout(() => {
      if (this.disconnectedByToken.has(meta.reconnectToken)) {
        this.disconnectedByToken.delete(meta.reconnectToken);
        this.removePlayerMeta(meta);
        this.broadcastImmediateSnapshot();
      }
    }, this.reconnectGraceMs);
  }

  public broadcastImmediateSnapshot(): void {
    if (this.disposed) return;
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

  public dispose(): void {
    this.disposed = true;
    this.clearDisconnectedTimers();
    this.playersBySession.clear();
    this.peersBySession.clear();
    this.accumulatedEvents.length = 0;
  }

  private clearDisconnectedTimers(): void {
    for (const m of this.disconnectedByToken.values()) {
      if (m.cleanupTimer) {
        clearTimeout(m.cleanupTimer);
        m.cleanupTimer = undefined;
      }
    }
    this.disconnectedByToken.clear();
  }

  private rejectIfDebugDisabled(
    sessionId: string,
    peer: CoopAuthorityPeer | undefined,
    cmdName: string,
  ): boolean {
    if (this.isDebugEnabled()) return false;
    this.onDebugRejected?.(sessionId, cmdName);
    peer?.send('debug_rejected', { command: cmdName, reason: 'debug_disabled' });
    return true;
  }

  private removePlayerMeta(meta: AuthorityPlayerMeta): void {
    if (meta.cleanupTimer) {
      clearTimeout(meta.cleanupTimer);
      meta.cleanupTimer = undefined;
    }
    this.playersBySession.delete(meta.sessionId);
    this.peersBySession.delete(meta.sessionId);
    this.disconnectedByToken.delete(meta.reconnectToken);
    if (meta.playerId !== 1) {
      this.sim.removeCoopPlayer(meta.playerId);
    }
    this.emitStateChange();
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

  private broadcast(type: string, payload: unknown): void {
    for (const peer of this.peersBySession.values()) {
      peer.send(type, payload);
    }
  }

  private emitStateChange(): void {
    this.onStateChange?.(this.getStateSummary());
  }
}
