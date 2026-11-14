import { SIM_STEP_MS, type QuantizedWorldSnapshot, roomCodeToPeerId } from '@ashen-pact/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundTicker } from '../src/net/background-ticker.js';
import {
  type PeerDataConnectionLike,
  type PeerInstanceLike,
  type PeerLikeFactory,
  createPeerHostRoom,
  joinPeerClientRoom,
  resolvePeerRuntimeOptions,
} from '../src/net/p2p-coop-client.js';

class FakeDataConnection implements PeerDataConnectionLike {
  public open = false;
  public counterpart?: FakeDataConnection;
  private readonly openHandlers: Array<() => void> = [];
  private readonly dataHandlers: Array<(data: unknown) => void> = [];
  private readonly closeHandlers: Array<() => void> = [];
  private readonly errorHandlers: Array<(err: unknown) => void> = [];

  public constructor(
    public readonly peer: string,
    private readonly getSendDelayMs: () => number = () => 0,
  ) {}

  public send(data: unknown): void {
    if (!this.open || !this.counterpart || !this.counterpart.open) return;
    const cloned = JSON.parse(JSON.stringify(data)) as unknown;
    const target = this.counterpart;
    const delayMs = this.getSendDelayMs();
    if (delayMs > 0) {
      globalThis.setTimeout(() => {
        if (target.open) {
          target.emitData(cloned);
        }
      }, delayMs);
      return;
    }
    queueMicrotask(() => {
      if (target.open) {
        target.emitData(cloned);
      }
    });
  }

  public close(): void {
    if (!this.open) return;
    this.open = false;
    for (const cb of this.closeHandlers) cb();
    const other = this.counterpart;
    if (other && other.open) {
      queueMicrotask(() => {
        other.closeFromRemote();
      });
    }
  }

  public closeFromRemote(): void {
    if (!this.open) return;
    this.open = false;
    for (const cb of this.closeHandlers) cb();
  }

  public emitOpen(): void {
    this.open = true;
    for (const cb of this.openHandlers) cb();
  }

  public emitData(data: unknown): void {
    for (const cb of this.dataHandlers) cb(data);
  }

  public on(event: 'open', cb: () => void): void;
  public on(event: 'data', cb: (data: unknown) => void): void;
  public on(event: 'close', cb: () => void): void;
  public on(event: 'error', cb: (err: unknown) => void): void;
  public on(
    event: 'open' | 'data' | 'close' | 'error',
    cb: (() => void) | ((data: unknown) => void),
  ): void {
    if (event === 'open') this.openHandlers.push(cb as () => void);
    else if (event === 'data') this.dataHandlers.push(cb);
    else if (event === 'close') this.closeHandlers.push(cb as () => void);
    else if (event === 'error') this.errorHandlers.push(cb);
  }
}

class FakePeerHub {
  public readonly peers = new Map<string, FakePeerInstance>();
  public readonly preReservedIds = new Set<string>();
  public readonly createdConfigs: Array<{ id?: string; debug: number }> = [];
  public sendDelayMs = 0;
  private anonSeq = 1;

  public readonly factory: PeerLikeFactory = (peerId, opts) => {
    this.createdConfigs.push({ id: peerId, debug: opts.debug });
    const assignedId = peerId ?? `anon-peer-${this.anonSeq++}`;
    const peer = new FakePeerInstance(this, assignedId);

    queueMicrotask(() => {
      if (peer.destroyed) return;
      if (this.preReservedIds.has(assignedId) || this.peers.has(assignedId)) {
        peer.emitError({ type: 'unavailable-id', message: `ID ${assignedId} is taken` });
        return;
      }
      this.peers.set(assignedId, peer);
      peer.emitOpen(assignedId);
    });

    return peer;
  };
}

class FakePeerInstance implements PeerInstanceLike {
  public destroyed = false;
  public disconnected = false;
  public reconnectCalls = 0;
  private readonly openHandlers: Array<(id: string) => void> = [];
  private readonly connHandlers: Array<(conn: PeerDataConnectionLike) => void> = [];
  private readonly errorHandlers: Array<(err: { type?: string; message?: string }) => void> = [];
  private readonly disconnectedHandlers: Array<() => void> = [];
  private readonly closeHandlers: Array<() => void> = [];
  private readonly activeConnections = new Set<FakeDataConnection>();

  public constructor(
    private readonly hub: FakePeerHub,
    public readonly id: string,
  ) {}

  public connect(targetPeerId: string): PeerDataConnectionLike {
    const clientSide = new FakeDataConnection(targetPeerId, () => this.hub.sendDelayMs);
    this.activeConnections.add(clientSide);

    queueMicrotask(() => {
      if (this.destroyed) return;
      const hostPeer = this.hub.peers.get(targetPeerId);
      if (!hostPeer || hostPeer.destroyed) {
        this.emitError({
          type: 'peer-unavailable',
          message: `Could not connect to peer ${targetPeerId}`,
        });
        return;
      }
      const hostSide = new FakeDataConnection(this.id, () => this.hub.sendDelayMs);
      hostPeer.activeConnections.add(hostSide);
      clientSide.counterpart = hostSide;
      hostSide.counterpart = clientSide;

      hostPeer.emitIncomingConnection(hostSide);
      queueMicrotask(() => {
        if (!this.destroyed && !hostPeer.destroyed) {
          hostSide.emitOpen();
          clientSide.emitOpen();
        }
      });
    });

    return clientSide;
  }

  public reconnect(): void {
    if (this.destroyed) return;
    this.reconnectCalls += 1;
    this.disconnected = false;
    this.hub.peers.set(this.id, this);
  }

  public emitDisconnected(): void {
    this.disconnected = true;
    for (const cb of this.disconnectedHandlers) cb();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.hub.peers.delete(this.id);
    for (const c of this.activeConnections) {
      c.close();
    }
    this.activeConnections.clear();
    for (const cb of this.closeHandlers) cb();
  }

  public simulateAbruptNetworkDrop(): void {
    for (const c of this.activeConnections) {
      c.close();
    }
    this.activeConnections.clear();
  }

  public emitOpen(id: string): void {
    for (const cb of this.openHandlers) cb(id);
  }

  public emitIncomingConnection(conn: FakeDataConnection): void {
    for (const cb of this.connHandlers) cb(conn);
  }

  public emitError(err: { type?: string; message?: string }): void {
    for (const cb of this.errorHandlers) cb(err);
  }

  public on(event: 'open', cb: (id: string) => void): void;
  public on(event: 'connection', cb: (conn: PeerDataConnectionLike) => void): void;
  public on(event: 'error', cb: (err: { type?: string; message?: string }) => void): void;
  public on(event: 'disconnected' | 'close', cb: () => void): void;
  public on(
    event: 'open' | 'connection' | 'error' | 'disconnected' | 'close',
    cb:
      | ((id: string) => void)
      | ((conn: PeerDataConnectionLike) => void)
      | ((err: { type?: string; message?: string }) => void)
      | (() => void),
  ): void {
    if (event === 'open') this.openHandlers.push(cb as (id: string) => void);
    else if (event === 'connection')
      this.connHandlers.push(cb as (conn: PeerDataConnectionLike) => void);
    else if (event === 'error')
      this.errorHandlers.push(cb as (err: { type?: string; message?: string }) => void);
    else if (event === 'disconnected') this.disconnectedHandlers.push(cb as () => void);
    else this.closeHandlers.push(cb as () => void);
  }
}

const flushMicrotasks = async (rounds = 8): Promise<void> => {
  for (let i = 0; i < rounds; i++) {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  }
};

describe('PeerJS WebRTC P2P Engine & BackgroundTicker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('resolves silent debug:0 PeerJS options, STUN defaults, ?peerSignal override, and VITE_TURN_* env vars', () => {
    const def = resolvePeerRuntimeOptions('', {});
    expect(def.debug).toBe(0);
    expect(def.iceServers?.some((s) => String(s.urls).includes('stun:stun.l.google.com:19302'))).toBe(
      true,
    );
    expect(
      def.iceServers?.some((s) => String(s.urls).includes('stun:stun.cloudflare.com:3478')),
    ).toBe(true);

    const localSig = resolvePeerRuntimeOptions('?peerSignal=http://127.0.0.1:9123/peerjs', {});
    expect(localSig.host).toBe('127.0.0.1');
    expect(localSig.port).toBe(9123);
    expect(localSig.path).toBe('/peerjs');
    expect(localSig.secure).toBe(false);
    expect(localSig.debug).toBe(0);
    expect(localSig.iceServers).toEqual([{ urls: 'stun:127.0.0.1:9123' }]);

    const withTurn = resolvePeerRuntimeOptions('', {
      VITE_TURN_URLS: 'turn:relay1.metered.ca:80,turns:relay1.metered.ca:443',
      VITE_TURN_USERNAME: 'turnuser',
      VITE_TURN_CREDENTIAL: 'turnsecret',
    });
    const turnEntry = withTurn.iceServers?.find((s) => s.username === 'turnuser');
    expect(turnEntry).toEqual({
      urls: ['turn:relay1.metered.ca:80', 'turns:relay1.metered.ca:443'],
      username: 'turnuser',
      credential: 'turnsecret',
    });
  });

  it('connects Host P1 + 3 WebRTC clients P2..P4, assigns slots 1..4, and broadcasts 30Hz snapshots', async () => {
    vi.stubGlobal('Worker', undefined);
    const hub = new FakePeerHub();

    const hostRoom = await createPeerHostRoom({
      requestedRoomCode: '7K9M2P',
      hostDisplayName: 'Host P1',
      seed: 4242,
      peerFactory: hub.factory,
    });
    expect(hostRoom.roomId).toBe('7K9M2P');
    expect(hub.createdConfigs[0]?.debug).toBe(0);

    const welcomes: Record<number, { slot: number; reconnectToken: string }> = {};
    const latestSnaps: Record<number, QuantizedWorldSnapshot> = {};

    hostRoom.onMessage('coop_welcome', (m: { slot: number; reconnectToken: string }) => {
      welcomes[1] = m;
    });
    hostRoom.onMessage('world_snapshot', (s: QuantizedWorldSnapshot) => {
      latestSnaps[1] = s;
    });

    const p2Room = await joinPeerClientRoom({
      roomCode: '7k9-m2p',
      displayName: 'Cung Thủ P2',
      peerFactory: hub.factory,
    });
    p2Room.onMessage('coop_welcome', (m: { slot: number; reconnectToken: string }) => {
      welcomes[2] = m;
    });
    p2Room.onMessage('world_snapshot', (s: QuantizedWorldSnapshot) => {
      latestSnaps[2] = s;
    });

    const p3Room = await joinPeerClientRoom({
      roomCode: '7K9M2P',
      displayName: 'Pháp Sư P3',
      peerFactory: hub.factory,
    });
    p3Room.onMessage('coop_welcome', (m: { slot: number; reconnectToken: string }) => {
      welcomes[3] = m;
    });

    const p4Room = await joinPeerClientRoom({
      roomCode: '7K9M2P',
      displayName: 'Hiền Nhân P4',
      peerFactory: hub.factory,
    });
    p4Room.onMessage('coop_welcome', (m: { slot: number; reconnectToken: string }) => {
      welcomes[4] = m;
    });

    await flushMicrotasks(12);
    // Request a ping_check and verify pong_check works for both Host loopback and P2
    let p2Pong = false;
    p2Room.onMessage('pong_check', () => {
      p2Pong = true;
    });
    p2Room.send('ping_check', { clientTime: Date.now(), rttMs: 12 });
    await flushMicrotasks(8);
    expect(p2Pong).toBe(true);

    expect([welcomes[1]?.slot, welcomes[2]?.slot, welcomes[3]?.slot, welcomes[4]?.slot]).toEqual([
      1, 2, 3, 4,
    ]);

    const initialP2X = latestSnaps[2]!.players.find((p) => p.slot === 2)!.qx;
    p2Room.send('input', {
      seq: 1,
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
    });
    await flushMicrotasks(6);
    await new Promise((r) => setTimeout(r, SIM_STEP_MS * 4));
    await flushMicrotasks(6);

    const movedP2X = latestSnaps[1]!.players.find((p) => p.slot === 2)!.qx;
    expect(movedP2X).toBeGreaterThan(initialP2X);

    await p4Room.leave(true);
    await p3Room.leave(true);
    await p2Room.leave(true);
    await hostRoom.leave(true);
  });

  it('auto-retries random room code on unavailable-id and rejects invalid join room code with localized error', async () => {
    vi.stubGlobal('Worker', undefined);
    const hub = new FakePeerHub();

    let callIdx = 0;
    const codes = ['AAAA22', 'BBBB33'];
    hub.preReservedIds.add(roomCodeToPeerId('AAAA22'));

    const hostRoom = await createPeerHostRoom({
      hostDisplayName: 'Host Retry',
      peerFactory: hub.factory,
      randomFn: () => {
        // First 6 calls -> 'A' (index 0) except we want exact AAAA22 vs BBBB33:
        const code = codes[Math.min(1, Math.floor(callIdx / 6))]!;
        const ch = code[callIdx % 6]!;
        callIdx += 1;
        const idx = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.indexOf(ch);
        return idx / 32;
      },
    });
    expect(hostRoom.roomId).toBe('BBBB33');

    await expect(
      joinPeerClientRoom({
        roomCode: 'ZZZZ99',
        displayName: 'Joiner',
        peerFactory: hub.factory,
        timeoutMs: 500,
      }),
    ).rejects.toThrow(/ZZZZ99/);

    await hostRoom.leave(true);
  });

  it('preserves close codes 4001 (kick), 4003 (mid-run), 1006 + 30s reconnect recovery, and 4000 (host leave)', async () => {
    vi.stubGlobal('Worker', undefined);
    const hub = new FakePeerHub();

    const hostRoom = await createPeerHostRoom({
      requestedRoomCode: 'CODE77',
      hostDisplayName: 'Host',
      peerFactory: hub.factory,
    });

    const p2Room = await joinPeerClientRoom({
      roomCode: 'CODE77',
      displayName: 'Player2',
      peerFactory: hub.factory,
    });
    const p3Room = await joinPeerClientRoom({
      roomCode: 'CODE77',
      displayName: 'Player3',
      peerFactory: hub.factory,
    });

    let p2LeaveCode: number | null = null;
    let p2KickedMsg = false;
    p2Room.onMessage('kicked_by_host', () => {
      p2KickedMsg = true;
    });
    p2Room.onLeave((code) => {
      p2LeaveCode = code;
    });

    let p3WelcomeToken = '';
    let p3LeaveCode: number | null = null;
    p3Room.onMessage('coop_welcome', (m: { reconnectToken: string }) => {
      p3WelcomeToken = m.reconnectToken;
    });
    p3Room.onLeave((code) => {
      p3LeaveCode = code;
    });

    await flushMicrotasks(10);
    expect(p3WelcomeToken).toBeTruthy();

    // 1. Kick P2 -> 4001
    hostRoom.send('kick_player', { slot: 2 });
    await flushMicrotasks(10);
    expect(p2KickedMsg).toBe(true);
    expect(p2LeaveCode).toBe(4001);

    // 2. Abrupt network drop on P3 -> 1006, then reconnect with token restores slot 3
    const p3FakePeer = Array.from(hub.peers.values()).find((p) => p.id !== roomCodeToPeerId('CODE77'))!;
    p3FakePeer.simulateAbruptNetworkDrop();
    await flushMicrotasks(8);
    expect(p3LeaveCode).toBe(1006);

    const p3Reconnected = await joinPeerClientRoom({
      roomCode: 'CODE77',
      displayName: 'Player3',
      reconnectToken: p3WelcomeToken,
      peerFactory: hub.factory,
    });
    let reconnectedWelcome: { slot: number; reconnected: boolean } | null = null;
    p3Reconnected.onMessage(
      'coop_welcome',
      (m: { slot: number; reconnected: boolean }) => {
        reconnectedWelcome = m;
      },
    );
    let p3ReconnectedLeaveCode: number | null = null;
    let p3HostDisconnectedMsg = false;
    p3Reconnected.onMessage('host_disconnected', () => {
      p3HostDisconnectedMsg = true;
    });
    p3Reconnected.onLeave((code) => {
      p3ReconnectedLeaveCode = code;
    });
    await flushMicrotasks(10);
    expect(reconnectedWelcome).toEqual(expect.objectContaining({ slot: 3, reconnected: true }));

    // 3. Start dungeon run -> new joiner gets 4003
    hostRoom.send('start_run', {});
    await flushMicrotasks(8);

    const lateRoom = await joinPeerClientRoom({
      roomCode: 'CODE77',
      displayName: 'LateJoiner',
      peerFactory: hub.factory,
    });
    let lateLeaveCode: number | null = null;
    lateRoom.onLeave((code) => {
      lateLeaveCode = code;
    });
    await flushMicrotasks(10);
    expect(lateLeaveCode).toBe(4003);

    // 4. Host leaves -> P3 gets host_disconnected + onLeave(4000)
    await hostRoom.leave(true);
    await flushMicrotasks(10);
    expect(p3HostDisconnectedMsg).toBe(true);
    expect(p3ReconnectedLeaveCode).toBe(4000);
  });

  it('uses Web Worker in createBackgroundTicker when available, clamps delta <= 100ms, cleans up on stop, and falls back to setInterval', () => {
    let createdBlobUrl = '';
    let revokedBlobUrl = '';
    let terminated = false;
    let workerOnMessage: (() => void) | null = null;

    class MockWorker {
      public onmessage: (() => void) | null = null;
      public constructor(public readonly url: string) {}
      public postMessage(_msg: unknown): void {
        workerOnMessage = () => this.onmessage?.();
      }
      public terminate(): void {
        terminated = true;
      }
    }

    vi.stubGlobal('Worker', MockWorker);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      createdBlobUrl = 'blob:ashen-ticker-1';
      return createdBlobUrl;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u: string) => {
      revokedBlobUrl = u;
    });

    let fakeNow = 1_000;
    const deltas: number[] = [];
    const ticker = createBackgroundTicker(16.666, (dt) => deltas.push(dt), () => fakeNow);

    expect(ticker.mode).toBe('worker');
    expect(createdBlobUrl).toBe('blob:ashen-ticker-1');

    fakeNow = 1_020;
    workerOnMessage?.();
    fakeNow = 1_500; // 480ms spike -> clamped to 100ms!
    workerOnMessage?.();

    expect(deltas).toEqual([20, 100]);

    ticker.stop();
    expect(terminated).toBe(true);
    expect(revokedBlobUrl).toBe('blob:ashen-ticker-1');

    // Fallback when Worker is unavailable
    vi.useFakeTimers();
    vi.stubGlobal('Worker', undefined);
    let intervalNow = 5_000;
    const intervalDeltas: number[] = [];
    const fallback = createBackgroundTicker(
      16,
      (dt) => intervalDeltas.push(dt),
      () => intervalNow,
    );
    expect(fallback.mode).toBe('interval');
    intervalNow = 5_016;
    vi.advanceTimersByTime(16);
    expect(intervalDeltas).toEqual([16]);
    fallback.stop();
  });

  it('notifies connected clients with close code 4000 when Host browser tab triggers pagehide and cleans up listeners on leave', async () => {
    vi.stubGlobal('Worker', undefined);
    const listeners = new Map<string, Set<() => void>>();
    const addSpy = vi.fn((ev: string, fn: () => void) => {
      let set = listeners.get(ev);
      if (!set) {
        set = new Set();
        listeners.set(ev, set);
      }
      set.add(fn);
    });
    const removeSpy = vi.fn((ev: string, fn: () => void) => {
      listeners.get(ev)?.delete(fn);
    });
    vi.stubGlobal('window', {
      location: { search: '' },
      addEventListener: addSpy,
      removeEventListener: removeSpy,
    });

    const hub = new FakePeerHub();
    const hostRoom = await createPeerHostRoom({
      requestedRoomCode: 'TABCLS',
      hostDisplayName: 'Host',
      peerFactory: hub.factory,
    });
    const clientRoom = await joinPeerClientRoom({
      roomCode: 'TABCLS',
      displayName: 'Joiner',
      peerFactory: hub.factory,
    });

    let clientLeaveCode: number | null = null;
    clientRoom.onLeave((code) => {
      clientLeaveCode = code;
    });
    await flushMicrotasks(8);

    for (const fn of listeners.get('pagehide') ?? []) {
      fn();
    }
    await flushMicrotasks(8);

    expect(clientLeaveCode).toBe(4000);
    expect(listeners.get('pagehide')?.size ?? 0).toBe(0);
    await hostRoom.leave(true);
  });

  it('flushes __close__ (4001/4000) and consented __leave__ reliably over simulated WAN latency without racing conn.close()', async () => {
    vi.stubGlobal('Worker', undefined);
    const hub = new FakePeerHub();
    hub.sendDelayMs = 20;

    const hostRoom = await createPeerHostRoom({
      requestedRoomCode: 'WAN777',
      hostDisplayName: 'Host',
      reconnectGraceMs: 5_000,
      peerFactory: hub.factory,
    });
    let latestHostSnap: QuantizedWorldSnapshot | null = null;
    hostRoom.onMessage('world_snapshot', (s: QuantizedWorldSnapshot) => {
      latestHostSnap = s;
    });

    const p2Room = await joinPeerClientRoom({
      roomCode: 'WAN777',
      displayName: 'P2',
      peerFactory: hub.factory,
    });
    const p3Room = await joinPeerClientRoom({
      roomCode: 'WAN777',
      displayName: 'P3',
      peerFactory: hub.factory,
    });
    const p4Room = await joinPeerClientRoom({
      roomCode: 'WAN777',
      displayName: 'P4',
      peerFactory: hub.factory,
    });

    let p2LeaveCode: number | null = null;
    p2Room.onLeave((code) => {
      p2LeaveCode = code;
    });
    let p4LeaveCode: number | null = null;
    let p4GotHostDisc = false;
    p4Room.onMessage('host_disconnected', () => {
      p4GotHostDisc = true;
    });
    p4Room.onLeave((code) => {
      p4LeaveCode = code;
    });

    await new Promise((r) => setTimeout(r, 80));

    // 1. Kick P2 (slot 2) over 20ms WAN -> must receive 4001, NOT 1006!
    hostRoom.send('kick_player', { slot: 2 });
    await new Promise((r) => setTimeout(r, 60));
    expect(p2LeaveCode).toBe(4001);

    // 2. P3 leaves voluntarily (consented = true) over 20ms WAN -> Host must remove slot 3 immediately (2 players left: Host + P4)
    await p3Room.leave(true);
    await new Promise((r) => setTimeout(r, 60));
    expect(latestHostSnap?.players.map((pl) => pl.slot)).toEqual([1, 4]);

    // 3. Host leaves voluntarily over 20ms WAN -> P4 must receive host_disconnected + 4000, NOT 1006!
    await hostRoom.leave(true);
    await new Promise((r) => setTimeout(r, 60));
    expect(p4GotHostDisc).toBe(true);
    expect(p4LeaveCode).toBe(4000);
  });

  it('reconnects Host signaling Peer automatically on disconnected event and honours window.__ASHEN_PACT_PEER_OPTIONS__', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', undefined);
    vi.stubGlobal('window', {
      location: { search: '' },
      __ASHEN_PACT_PEER_OPTIONS__: {
        host: '127.0.0.1',
        port: 9988,
        path: '/custom-peer',
        secure: false,
        debug: 3,
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const opts = resolvePeerRuntimeOptions('', {});
    expect(opts.host).toBe('127.0.0.1');
    expect(opts.port).toBe(9988);
    expect(opts.path).toBe('/custom-peer');
    expect(opts.debug).toBe(0);

    const hub = new FakePeerHub();
    const hostRoom = await createPeerHostRoom({
      requestedRoomCode: 'SIGREC',
      hostDisplayName: 'Host',
      peerFactory: hub.factory,
    });
    const hostPeer = hub.peers.get(roomCodeToPeerId('SIGREC'))!;
    expect(hostPeer).toBeDefined();
    expect(hostPeer.reconnectCalls).toBe(0);

    hostPeer.emitDisconnected();
    vi.advanceTimersByTime(1_200);
    expect(hostPeer.reconnectCalls).toBe(1);

    await hostRoom.leave(true);
  });
});
