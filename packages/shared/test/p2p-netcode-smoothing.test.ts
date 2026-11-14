import { describe, expect, it } from 'vitest';
import {
  CoopRoomAuthority,
  type CoopAuthorityPeer,
  type CoopAuthorityPeerSendOptions,
  INPUT_BUTTON,
  NetworkTransport,
  WorldSim,
  encodeWorldSnapshot,
} from '../src/index.js';

describe('P2P Netcode Smoothing — Shared Monotonic Guards, Reliable Events & High-Hz Prediction', () => {
  it('preserves reliable edgeButtons/slot/ping/emote on out-of-order inputs without rewinding newer movement or seq', () => {
    const sim = new WorldSim({
      seed: 4242,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Friend P2', 2);
    p2.weaponSlots = ['hunter_crossbow', 'knight_sword'];
    p2.activeWeaponSlot = 0;

    // Newer fast-UDP continuous movement packet (seq = 12) arrives first
    sim.setCoopPlayerInput(p2.id, {
      seq: 12,
      tick: sim.tick,
      moveX: -1,
      moveY: 0,
      aimAngle: 1.5,
      buttons: 0,
      weaponSlotSelect: null,
    });

    // Slightly delayed reliable edge packet (seq = 11) arrives 2ms later with DASH + slot 1 + emote
    sim.setCoopPlayerInput(p2.id, {
      seq: 11,
      tick: sim.tick,
      moveX: 1,
      moveY: 1,
      aimAngle: 0,
      buttons: INPUT_BUTTON.DASH,
      edgeButtons: INPUT_BUTTON.DASH,
      weaponSlotSelect: 1,
      emoteId: 2,
    });

    // Delayed continuous UDP packet (seq = 10, no edgeButtons) arrives even later -> completely ignored
    sim.setCoopPlayerInput(p2.id, {
      seq: 10,
      tick: sim.tick,
      moveX: 0,
      moveY: 1,
      aimAngle: -1.2,
      buttons: INPUT_BUTTON.SKILL,
      weaponSlotSelect: null,
    });

    expect(p2.lastProcessedSeq).toBe(12);
    const entry = sim.coopPlayerInputs.get(p2.id)!;
    expect(entry.current.moveX).toBe(-1);
    expect(entry.current.aimAngle).toBe(1.5);
    expect(p2.emoteId).toBe(2);

    sim.step(1 / 60);
    // DASH and weaponSlotSelect=1 from reliable seq=11 fired, while SKILL from stale continuous seq=10 did NOT fire
    expect(p2.dashTimer).toBeGreaterThan(0);
    expect(p2.activeWeaponSlot).toBe(1);
    expect(p2.skillCooldownTimer).toBe(0);
  });

  it('drops out-of-order stale snapshots while accepting same-tick Hub immediate snapshots when snapshotSeq advances', () => {
    const serverSim = new WorldSim({ seed: 1010, startInHub: true });
    const clientTransport = new NetworkTransport({
      seed: 1010,
      startInHub: true,
      localPlayerId: 1,
      localPlayerSlot: 1,
      wifiProfile: 'off',
    });

    serverSim.step(1 / 60);
    const snapSeq5 = encodeWorldSnapshot(serverSim, []);
    snapSeq5.snapshotSeq = 5;
    snapSeq5.players[0]!.ready = false;
    clientTransport.receiveSnapshot(snapSeq5);
    expect(clientTransport.getLocalPlayerState().ready).toBe(false);

    // Same tick, immediate Hub snapshot (Ready toggled true) with snapshotSeq = 6 MUST apply
    const snapSeq6SameTick = encodeWorldSnapshot(serverSim, []);
    snapSeq6SameTick.snapshotSeq = 6;
    snapSeq6SameTick.players[0]!.ready = true;
    clientTransport.receiveSnapshot(snapSeq6SameTick);
    expect(clientTransport.getLocalPlayerState().ready).toBe(true);

    // Out-of-order delayed UDP snapshot with snapshotSeq = 4 MUST be ignored
    const staleSnapSeq4 = encodeWorldSnapshot(serverSim, []);
    staleSnapSeq4.snapshotSeq = 4;
    staleSnapSeq4.players[0]!.ready = false;
    clientTransport.receiveSnapshot(staleSnapSeq4);
    expect(clientTransport.getLocalPlayerState().ready).toBe(true);
  });

  it('spawns and destroys deterministic projectiles via reliable receiveEvents when snapshots omit events', () => {
    const serverSim = new WorldSim({
      seed: 5050,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const clientTransport = new NetworkTransport({
      seed: 5050,
      startInHub: false,
      localPlayerId: 1,
      localPlayerSlot: 1,
      wifiProfile: 'off',
    });

    serverSim.player.weaponSlots = ['scrap_shotgun'];
    serverSim.player.activeWeaponSlot = 0;
    serverSim.setPlayerInput({
      seq: 1,
      tick: 1,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
      weaponSlotSelect: null,
    });
    serverSim.step(1 / 60);
    const events = serverSim.consumeEvents();
    expect(events.some((e) => e.kind === 'bullet_volley_spawned')).toBe(true);

    // Fast UDP snapshot carries empty events; reliable channel delivers events separately
    const snapWithoutEvents = encodeWorldSnapshot(serverSim, []);
    clientTransport.receiveEvents(events);
    clientTransport.receiveSnapshot(snapWithoutEvents);

    const clientSim = clientTransport.getSim();
    expect(clientSim.projectiles.length).toBe(serverSim.projectiles.length);
    expect(clientSim.projectiles.length).toBeGreaterThan(0);

    const destroyIds = clientSim.projectiles.map((p) => p.id);
    clientTransport.receiveEvents([{ kind: 'projectiles_destroyed', ids: destroyIds }]);
    expect(clientSim.projectiles.length).toBe(0);
  });

  it('reconciles 240Hz high-refresh-rate sendInput calls over WAN latency without phantom position overshoot', () => {
    const serverSim = new WorldSim({
      seed: 7070,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const clientTransport = new NetworkTransport({
      seed: 7070,
      startInHub: false,
      localPlayerId: 1,
      localPlayerSlot: 1,
      wifiProfile: 'off',
    });

    const delayedQueue: Array<{ deliverAtFrame: number; pkt: Parameters<typeof serverSim.setPlayerInput>[0] }> = [];
    let currentFrame = 0;
    clientTransport.setOnSendInput((pkt) => {
      // Simulate 50ms one-way WAN uplink (12 frames at 240Hz)
      delayedQueue.push({ deliverAtFrame: currentFrame + 12, pkt });
    });

    // Run 48 frames at 240Hz (= 200ms = 12 fixed 60Hz ticks)
    for (let frame = 1; frame <= 48; frame++) {
      currentFrame = frame;
      clientTransport.sendInput({
        seq: frame,
        tick: serverSim.tick,
        moveX: 1,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      clientTransport.step(1000 / 240);

      while (delayedQueue.length > 0 && delayedQueue[0]!.deliverAtFrame <= frame) {
        serverSim.setPlayerInput(delayedQueue.shift()!.pkt);
      }

      if (frame % 4 === 0) {
        serverSim.step(1 / 60);
      }
    }

    const posBeforeReconcile = clientTransport.getLocalPlayerState().x;
    // Server snapshot arrives acknowledging seq = 36 (24 frames = 12 unacked 240Hz inputs in flight = only 3 real 60Hz ticks)
    const snap = encodeWorldSnapshot(serverSim, serverSim.consumeEvents());
    clientTransport.receiveSnapshot(snap);
    const posAfterReconcile = clientTransport.getLocalPlayerState().x;

    // Without simTicks tracking, 12 unacked 240Hz inputs replay as 12 full 60Hz ticks (+31px phantom overshoot!).
    // With exact simTicks tracking, reconciliation matches local prediction within < 2px.
    expect(Math.abs(posAfterReconcile - posBeforeReconcile)).toBeLessThan(2);
  });

  it('marks periodic CoopRoomAuthority snapshots unreliable and immediate snapshots reliable while echoing clientPerfMs', () => {
    const sent: Array<{
      type: string;
      payload: unknown;
      options?: CoopAuthorityPeerSendOptions;
    }> = [];
    const authority = new CoopRoomAuthority({ roomId: 'SMOOTH', seed: 123, startInHub: true });
    const hostPeer: CoopAuthorityPeer = {
      sessionId: 'host_1',
      send(type, payload, options) {
        sent.push({ type, payload, options });
      },
      close() {},
    };

    authority.joinPeer(hostPeer, { name: 'Host' });
    const joinSnap = sent.find((m) => m.type === 'world_snapshot');
    expect(joinSnap?.options).toEqual({ reliable: true, immediate: true });
    const seq1 = (joinSnap?.payload as { snapshotSeq?: number })?.snapshotSeq;
    expect(seq1).toBe(1);

    sent.length = 0;
    authority.step(34);
    const periodicSnap = sent.find((m) => m.type === 'world_snapshot');
    expect(periodicSnap?.options).toEqual({ reliable: false, immediate: false });
    const seq2 = (periodicSnap?.payload as { snapshotSeq?: number })?.snapshotSeq;
    expect(seq2).toBe(2);

    sent.length = 0;
    authority.handleMessage('host_1', 'ping_check', {
      clientTime: 1700000000000,
      clientPerfMs: 1234.56,
      rttMs: 14,
    });
    const pong = sent.find((m) => m.type === 'pong_check');
    expect(pong?.options).toEqual({ reliable: false });
    expect(pong?.payload).toMatchObject({
      clientTime: 1700000000000,
      clientPerfMs: 1234.56,
    });
    authority.dispose();
  });
});
