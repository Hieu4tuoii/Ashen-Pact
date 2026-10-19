import { Room, type Client } from '@colyseus/core';
import { Schema, type } from '@colyseus/schema';
import {
  FixedTimestepLoop,
  SeededRandom,
  SIM_STEP_MS,
  VIETNAMESE_VERIFICATION_STRING,
  type HelloRoomMessage,
} from '@ashen-pact/shared';

export class HelloRoomState extends Schema {
  @type('number') public tick = 0;
  @type('number') public seed = 0;
  @type('number') public playerCount = 0;
  @type('string') public statusVi = 'Sảnh chờ Ashen Pact sẵn sàng';
}

export class HelloRoom extends Room<HelloRoomState> {
  public override maxClients = 4;
  private simLoop = new FixedTimestepLoop(60);
  private rng = new SeededRandom('ashen-pact-phase-0');

  public override onCreate(options: Record<string, unknown>): void {
    const state = new HelloRoomState();
    state.seed = typeof options.seed === 'number' ? options.seed : this.rng.initialSeed;
    this.setState(state);

    this.setSimulationInterval((deltaMs) => {
      const res = this.simLoop.step(deltaMs, () => {
        this.state.tick = this.simLoop.getTick();
      });
      if (res.ticksExecuted > 0) {
        this.state.tick = res.tick;
      }
    }, SIM_STEP_MS);

    this.onMessage('ping_check', (client, payload: { clientTime?: number }) => {
      client.send('pong_check', {
        clientTime: payload?.clientTime ?? Date.now(),
        serverTick: this.state.tick,
      });
    });
  }

  public override onJoin(client: Client): void {
    this.state.playerCount = this.clients.length;
    const welcome: HelloRoomMessage = {
      serverTick: this.state.tick,
      roomName: 'hello_room',
      seed: this.state.seed,
      connectedPlayers: this.clients.length,
      welcomeVi: VIETNAMESE_VERIFICATION_STRING,
    };
    client.send('hello_welcome', welcome);
  }

  public override onLeave(_client: Client): void {
    this.state.playerCount = this.clients.length;
  }
}
