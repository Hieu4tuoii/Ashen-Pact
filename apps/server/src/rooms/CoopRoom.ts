import { Room, type Client } from '@colyseus/core';
import { Schema, type } from '@colyseus/schema';
import {
  CoopRoomAuthority,
  type CoopAuthorityPeer,
  SIM_STEP_MS,
} from '@ashen-pact/shared';
import { isServerDebugEnabled } from '../debug-gate.js';

export class CoopRoomState extends Schema {
  @type('number') public tick = 0;
  @type('number') public seed = 0;
  @type('number') public playerCount = 0;
  @type('boolean') public inHub = true;
  @type('string') public hostName = 'Chủ Phòng';
}

export class CoopRoom extends Room<CoopRoomState> {
  public override maxClients = 8;
  private authority!: CoopRoomAuthority;

  public override onCreate(options: Record<string, unknown>): void {
    const seed = typeof options.seed === 'number' ? options.seed : 202604;
    const startInHub = options.startInHub !== undefined ? Boolean(options.startInHub) : true;

    const state = new CoopRoomState();
    state.seed = seed;
    state.inHub = startInHub;
    this.setState(state);

    this.authority = new CoopRoomAuthority({
      roomId: this.roomId,
      seed,
      startInHub,
      allowDuplicateCharacters:
        options.allowDuplicateCharacters !== undefined
          ? Boolean(options.allowDuplicateCharacters)
          : false,
      isDebugEnabled: () => isServerDebugEnabled(),
      onDebugRejected: (sessionId, cmdName) => {
        console.warn(
          `[CoopRoom] Ignored debug command "${cmdName}" from session ${sessionId}: server debug mode is disabled.`,
        );
      },
      onStateChange: (summary) => {
        this.state.tick = summary.tick;
        this.state.seed = summary.seed;
        this.state.playerCount = summary.playerCount;
        this.state.inHub = summary.inHub;
        this.state.hostName = summary.hostName;
      },
      onRoomClose: () => {
        setTimeout(() => {
          void this.disconnect();
        }, 150);
      },
    });

    this.setSimulationInterval((deltaMs) => {
      this.authority.step(deltaMs);
    }, SIM_STEP_MS);

    this.onMessage('*', (client, messageType, payload) => {
      this.authority.handleMessage(client.sessionId, String(messageType), payload);
    });
  }

  public override onJoin(client: Client, options?: Record<string, unknown>): void {
    const peer: CoopAuthorityPeer = {
      sessionId: client.sessionId,
      send: (messageType, payload) => {
        client.send(messageType, payload);
      },
      close: (code) => {
        // When Host disconnects (4000), onRoomClose disconnects the Colyseus room after flushing
        // the `host_disconnected` broadcast frame cleanly.
        if (code === 4000) return;
        client.leave(code);
      },
    };
    this.authority.joinPeer(peer, options);
  }

  public override onLeave(client: Client, consented: boolean): void {
    this.authority.leavePeer(client.sessionId, consented);
  }

  public override onDispose(): void {
    this.authority?.dispose();
  }
}
