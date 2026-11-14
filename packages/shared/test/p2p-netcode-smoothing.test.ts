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

  it('deduplicates delayed SCTP edgeButtons when a newer continuous packet already inferred the rising edge, while preserving genuine double-taps', () => {
    const sim = new WorldSim({
      seed: 8181,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Friend P2', 2);
    p2.weaponSlots = ['hunter_crossbow', 'knight_sword'];
    p2.activeWeaponSlot = 0;

    // Baseline seq = 10 with no buttons pressed
    sim.setCoopPlayerInput(p2.id, {
      seq: 10,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
      weaponSlotSelect: null,
    });
    sim.step(1 / 60);
    expect(p2.activeWeaponSlot).toBe(0);

    // Normal >15ms keypress of SWAP (Q):
    // seq = 12 (continuous UDP packet with SWAP still held, no edgeButtons) arrives BEFORE seq = 11 (SCTP packet with edgeButtons: SWAP)
    sim.setCoopPlayerInput(p2.id, {
      seq: 12,
      tick: sim.tick,
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SWAP,
      weaponSlotSelect: null,
    });
    sim.step(1 / 60);
    expect(p2.activeWeaponSlot).toBe(1);

    // Delayed reliable seq = 11 arrives 30ms later -> must NOT swap a second time back to slot 0!
    sim.setCoopPlayerInput(p2.id, {
      seq: 11,
      tick: sim.tick,
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SWAP,
      edgeButtons: INPUT_BUTTON.SWAP,
      weaponSlotSelect: null,
    });
    sim.step(1 / 60);
    expect(p2.activeWeaponSlot).toBe(1);

    // Release SWAP on seq = 20
    sim.setCoopPlayerInput(p2.id, {
      seq: 20,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
      weaponSlotSelect: null,
    });
    sim.step(1 / 60);

    // Genuine rapid double-tap where seq = 24 (continuous hold of tap #2) overtakes SCTP seq = 21 (tap #1), 22 (release), 23 (tap #2)
    sim.setCoopPlayerInput(p2.id, {
      seq: 24,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SWAP,
      weaponSlotSelect: null,
    });
    sim.step(1 / 60);
    expect(p2.activeWeaponSlot).toBe(0); // Tap #1 inferred

    sim.setCoopPlayerInput(p2.id, {
      seq: 21,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SWAP,
      edgeButtons: INPUT_BUTTON.SWAP,
      weaponSlotSelect: null,
    });
    sim.setCoopPlayerInput(p2.id, {
      seq: 22,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
      weaponSlotSelect: null,
    });
    sim.setCoopPlayerInput(p2.id, {
      seq: 23,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SWAP,
      edgeButtons: INPUT_BUTTON.SWAP,
      weaponSlotSelect: null,
    });
    sim.step(1 / 60);
    expect(p2.activeWeaponSlot).toBe(1); // Tap #2 executed -> net 2 swaps (1 -> 0 -> 1)
  });

  it('triggers local predicted dash only on INPUT_BUTTON.DASH rising edge and never while holding SHIFT across cooldown expiry', () => {
    const serverSim = new WorldSim({
      seed: 9191,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const clientTransport = new NetworkTransport({
      seed: 9191,
      startInHub: false,
      localPlayerId: 1,
      localPlayerSlot: 1,
      wifiProfile: 'off',
    });

    clientTransport.setOnSendInput((pkt) => {
      serverSim.setPlayerInput(pkt);
    });

    // Hold SHIFT continuously across 125 fixed ticks (2.08s > 1.85s DASH_COOLDOWN_SEC) without snapshot sync after tick 10
    for (let tick = 1; tick <= 125; tick++) {
      clientTransport.sendInput({
        seq: tick,
        tick: serverSim.tick,
        moveX: 0,
        moveY: 1,
        aimAngle: 0,
        buttons: INPUT_BUTTON.DASH,
        weaponSlotSelect: null,
      });
      clientTransport.step(1000 / 60);
      serverSim.step(1 / 60);

      if (tick === 1) {
        expect(serverSim.player.dashTimer).toBeGreaterThan(0);
        expect(clientTransport.getLocalPlayerState().dashTimer).toBeGreaterThan(0);
      }
      if (tick === 10) {
        clientTransport.receiveSnapshot(encodeWorldSnapshot(serverSim, serverSim.consumeEvents()));
      }
      if (tick >= 113) {
        // Cooldown (1.85s = 111 ticks) has expired while SHIFT remained held: neither authoritative sim nor local prediction may dash a second time!
        expect(serverSim.player.dashTimer).toBe(0);
        expect(clientTransport.getLocalPlayerState().dashTimer).toBe(0);
      }
    }

    expect(Math.abs(clientTransport.getLocalPlayerState().y - serverSim.player.y)).toBeLessThan(2);
  });

  it('flushes an immediate reliable world_snapshot on odd tick when an in-step room transition occurs', () => {
    const sent: Array<{
      type: string;
      payload: unknown;
      options?: CoopAuthorityPeerSendOptions;
    }> = [];
    const authority = new CoopRoomAuthority({ roomId: 'ROOMTX', seed: 31337, startInHub: false });
    const hostPeer: CoopAuthorityPeer = {
      sessionId: 'host_tx',
      send(type, payload, options) {
        sent.push({ type, payload, options });
      },
      close() {},
    };

    authority.joinPeer(hostPeer, { name: 'Host' });
    authority.sim.skipCurrentRoomWaves();
    const door = authority.sim.doors.find((d) => !d.locked)!;
    expect(door).toBeDefined();
    expect(door.locked).toBe(false);

    // Place P1 directly on the unlocked start-room door and press INTERACT on a single 17ms (1-tick) step
    authority.sim.player.x = door.x;
    authority.sim.player.y = door.y;
    authority.handleMessage('host_tx', 'input', {
      seq: 1,
      tick: authority.sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.INTERACT,
      edgeButtons: INPUT_BUTTON.INTERACT,
      weaponSlotSelect: null,
    });

    sent.length = 0;
    authority.step(17); // Only 1 fixed tick executed (odd tick, snapshotTickCounter would be 1)

    expect(authority.sim.currentRoomId).toBe(door.targetRoomId);
    const transitionSnap = sent.find((m) => m.type === 'world_snapshot');
    expect(transitionSnap).toBeDefined();
    expect(transitionSnap?.options).toEqual({ reliable: true, immediate: true });
    authority.dispose();
  });
});
