import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CoopRoomAuthority,
  type CoopAuthorityPeer,
  SIM_STEP_MS,
  decodeWorldSnapshot,
  type QuantizedWorldSnapshot,
} from '../src/index.js';

class MockAuthorityPeer implements CoopAuthorityPeer {
  public readonly sent: Array<{ type: string; payload: unknown }> = [];
  public closedCode: number | null = null;

  public constructor(public readonly sessionId: string) {}

  public send(type: string, payload: unknown): void {
    this.sent.push({ type, payload });
  }

  public close(code: number): void {
    this.closedCode = code;
  }

  public lastMessage<T = unknown>(type: string): T | undefined {
    for (let i = this.sent.length - 1; i >= 0; i--) {
      if (this.sent[i]!.type === type) {
        return this.sent[i]!.payload as T;
      }
    }
    return undefined;
  }

  public countMessages(type: string): number {
    return this.sent.filter((m) => m.type === type).length;
  }
}

describe('CoopRoomAuthority shared 1-4P authoritative state machine', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('assigns slots 1..4, enforces non-duplicate characters until toggled, and emits 30Hz snapshots from 60Hz steps', () => {
    const stateChanges: Array<{ playerCount: number; hostName: string; inHub: boolean }> = [];
    const auth = new CoopRoomAuthority({
      roomId: '7K9M2P',
      seed: 12345,
      startInHub: true,
      onStateChange: (s) => stateChanges.push({ ...s }),
    });

    const p1 = new MockAuthorityPeer('sess-1');
    const p2 = new MockAuthorityPeer('sess-2');
    const p3 = new MockAuthorityPeer('sess-3');
    const p4 = new MockAuthorityPeer('sess-4');
    const p5 = new MockAuthorityPeer('sess-5');

    auth.joinPeer(p1, { name: 'Host Khoa', characterId: 'vanguard' });
    auth.joinPeer(p2, { name: 'Bạn Bè 2', characterId: 'vanguard' }); // duplicate -> auto-reassigned
    auth.joinPeer(p3, { name: 'Bạn Bè 3' });
    auth.joinPeer(p4, { name: 'Bạn Bè 4' });
    auth.joinPeer(p5, { name: 'Người Thứ 5' });

    expect(p5.closedCode).toBe(4002);
    expect(stateChanges.at(-1)?.playerCount).toBe(4);
    expect(stateChanges.at(-1)?.hostName).toBe('Host Khoa');

    const w1 = p1.lastMessage<{ slot: number; isHost: boolean; roomId: string }>('coop_welcome')!;
    const w2 = p2.lastMessage<{ slot: number; isHost: boolean }>('coop_welcome')!;
    const w3 = p3.lastMessage<{ slot: number; isHost: boolean }>('coop_welcome')!;
    const w4 = p4.lastMessage<{ slot: number; isHost: boolean }>('coop_welcome')!;
    expect([w1.slot, w2.slot, w3.slot, w4.slot]).toEqual([1, 2, 3, 4]);
    expect(w1.isHost).toBe(true);
    expect(w2.isHost).toBe(false);
    expect(w1.roomId).toBe('7K9M2P');

    // Duplicate hero rejected when allowDuplicateCharacters = false
    auth.handleMessage('sess-2', 'select_character', { characterId: 'vanguard' });
    expect(
      p2.lastMessage<{ ok: boolean }>('character_select_result')?.ok,
    ).toBe(false);

    // Host enables duplicate characters -> P2 can now pick vanguard
    auth.handleMessage('sess-1', 'toggle_duplicate_char', { allow: true });
    auth.handleMessage('sess-2', 'select_character', { characterId: 'vanguard' });
    expect(
      p2.lastMessage<{ ok: boolean }>('character_select_result')?.ok,
    ).toBe(true);

    // Clear initial immediate snapshots and test 60Hz step -> 30Hz snapshot cadence (every 2 ticks)
    const beforeCount = p1.countMessages('world_snapshot');
    auth.step(SIM_STEP_MS);
    expect(p1.countMessages('world_snapshot')).toBe(beforeCount);
    auth.step(SIM_STEP_MS);
    expect(p1.countMessages('world_snapshot')).toBe(beforeCount + 1);

    const snap = p1.lastMessage<QuantizedWorldSnapshot>('world_snapshot')!;
    expect(snap.players).toHaveLength(4);
    const roundTripped = decodeWorldSnapshot(JSON.stringify(snap));
    expect(roundTripped.players).toHaveLength(4);

    auth.dispose();
  });

  it('rejects mid-run join with 4003, supports host kick with 4001, and closes remaining peers with 4000 on host leave', () => {
    let roomClosed = false;
    const auth = new CoopRoomAuthority({
      roomId: 'ROOM01',
      seed: 999,
      startInHub: true,
      onRoomClose: () => {
        roomClosed = true;
      },
    });

    const p1 = new MockAuthorityPeer('host-1');
    const p2 = new MockAuthorityPeer('client-2');
    const p3 = new MockAuthorityPeer('client-3');

    auth.joinPeer(p1, { name: 'Host' });
    auth.joinPeer(p2, { name: 'P2' });
    auth.joinPeer(p3, { name: 'P3' });

    // Kick P2
    auth.handleMessage('host-1', 'kick_player', { slot: 2 });
    expect(p2.lastMessage('kicked_by_host')).toBeTruthy();
    expect(p2.closedCode).toBe(4001);
    expect(auth.sim.getAllPlayers()).toHaveLength(2);

    // Start dungeon run -> new joiner rejected with 4003
    auth.handleMessage('host-1', 'start_run', {});
    expect(auth.sim.inHub).toBe(false);

    const lateJoiner = new MockAuthorityPeer('late-4');
    auth.joinPeer(lateJoiner, { name: 'Late' });
    expect(lateJoiner.lastMessage('join_rejected')).toBeTruthy();
    expect(lateJoiner.closedCode).toBe(4003);

    // Host leaves -> P3 receives host_disconnected + close(4000) and onRoomClose fires
    auth.leavePeer('host-1', true);
    expect(p3.lastMessage('host_disconnected')).toBeTruthy();
    expect(p3.closedCode).toBe(4000);
    expect(roomClosed).toBe(true);

    auth.dispose();
  });

  it('recovers disconnected peer within grace window via reconnectToken and gates debug commands', () => {
    vi.useFakeTimers();
    let debugEnabled = false;
    const rejectedLog: Array<{ sessionId: string; cmdName: string }> = [];

    const auth = new CoopRoomAuthority({
      roomId: 'RECON1',
      seed: 777,
      reconnectGraceMs: 30_000,
      isDebugEnabled: () => debugEnabled,
      onDebugRejected: (sessionId, cmdName) => rejectedLog.push({ sessionId, cmdName }),
    });

    const p1 = new MockAuthorityPeer('host-1');
    const p2 = new MockAuthorityPeer('client-2');
    auth.joinPeer(p1, { name: 'Host' });
    auth.joinPeer(p2, { name: 'Teammate' });

    const welcome2 = p2.lastMessage<{ reconnectToken: string; slot: number }>('coop_welcome')!;
    expect(welcome2.slot).toBe(2);

    // Debug command rejected when disabled
    auth.handleMessage('host-1', 'skip_waves', {});
    expect(p1.lastMessage('debug_rejected')).toEqual({
      command: 'skip_waves',
      reason: 'debug_disabled',
    });
    expect(rejectedLog).toEqual([{ sessionId: 'host-1', cmdName: 'skip_waves' }]);

    // Enable debug -> set_god_mode works
    debugEnabled = true;
    auth.handleMessage('host-1', 'set_god_mode', { godMode: true });
    expect(auth.sim.getPlayerById(1)?.godMode).toBe(true);

    // Non-consented disconnect of P2 -> reconnect within 10s keeps slot 2
    auth.leavePeer('client-2', false);
    vi.advanceTimersByTime(10_000);
    expect(auth.sim.getAllPlayers()).toHaveLength(2);

    const p2Rejoined = new MockAuthorityPeer('client-2b');
    auth.joinPeer(p2Rejoined, {
      name: 'Teammate',
      reconnectToken: welcome2.reconnectToken,
    });
    const reWelcome = p2Rejoined.lastMessage<{ slot: number; reconnected: boolean }>(
      'coop_welcome',
    )!;
    expect(reWelcome.slot).toBe(2);
    expect(reWelcome.reconnected).toBe(true);

    // Disconnect again and let 30s grace expire -> slot 2 cleaned up
    auth.leavePeer('client-2b', false);
    vi.advanceTimersByTime(31_000);
    expect(auth.sim.getAllPlayers()).toHaveLength(1);

    auth.dispose();
  });
});
