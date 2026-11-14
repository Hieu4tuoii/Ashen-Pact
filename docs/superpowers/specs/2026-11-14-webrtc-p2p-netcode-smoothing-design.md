# WebRTC P2P Netcode Smoothing & Bandwidth Optimization — Design Spec

## 1. Intent & Why

Online WebRTC P2P Co-op on Vercel already works end-to-end for 1–4 players, but real-world WAN/Wi-Fi play and high-refresh-rate gaming monitors (`120Hz` / `144Hz` / `240Hz`) expose three concrete bottlenecks in the current transport layer:

1. **Single-channel Head-of-Line Blocking & Multi-MTU Fragmentation:**
   - `peerjs@1.5.5` hardcodes `reliable: true` (ordered, retransmitted SCTP) on its default `MsgPack` `DataConnection`, and `encodeWorldSnapshot` serializes full `props`, `hubStatues`, `discoveredRooms`, and verbose object keys 30 times/sec (~`12–15 KB` per snapshot = `10–13` UDP MTU fragments).
   - Dropping a single Wi-Fi UDP fragment stalls all newer 30 Hz frames until SCTP retransmission completes (`100–300 ms` rubber-band spikes).
   - Naively sending full `QuantizedWorldSnapshot` over an unreliable channel is unsafe because `snapshot.events` carries deterministic `bullet_volley_spawned` and `projectiles_destroyed` events; losing one packet would make bullets invisible or leave ghost bullets alive.
2. **High-Refresh-Rate (`120Hz–240Hz`) Input Flood & Prediction Overshoot:**
   - `GameScene.update()` calls `transport.sendInput(...)` every display RAF frame (`144–240` packets/sec on high-Hz displays), while `NetworkTransport.applyAuthoritativeSnapshot` replays every unacknowledged entry in `pendingInputs` assuming `replayDt = 1 / 60` sec regardless of how many fixed `60Hz` ticks `stepLocalPrediction` actually executed for that input.
3. **Out-of-Order Packet Safety & Ping Telemetry Jitter:**
   - `NetworkTransport.applyAuthoritativeSnapshot` and `WorldSim.setCoopPlayerInput` need monotonic sequence/tick guards before consuming unordered UDP frames, while preserving reliable one-shot button edges that arrive slightly after newer continuous movement frames.
   - `pong_check` currently computes raw single-sample `Date.now() - clientTime` over the reliable stream, inflating displayed ping whenever SCTP or frame scheduling hiccups.

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Zero Head-of-Line Blocking for Continuous 30 Hz State & 60 Hz Movement:** Multiplex a pre-negotiated W3C `RTCDataChannel` (`label: 'ashen_fast_udp'`, `negotiated: true`, `id: 42`, `ordered: false`, `maxRetransmits: 0`) onto the existing PeerJS `RTCPeerConnection` (`conn.peerConnection`) with zero extra ICE/SDP signaling, gated by an end-to-end `__fast_hello__` / `__fast_ack__` verification handshake and automatic fallback to the primary reliable channel.
- **100% Lossless Gameplay Events, State Transitions & Button Edges:**
  - Strip `SimEvent[]` out of unreliable fast-frames onto a dedicated reliable `world_events` message consumed via `NetworkTransport.receiveEvents(events)`.
  - Send immediate keyframe snapshots (`broadcastImmediateSnapshot` for Hub ready/character select, room/floor changes, buff/pact/mutator picks) reliably.
  - Route any client `input` packet with a button transition (`buttons !== lastSentButtons`), `weaponSlotSelect !== null`, `pingWorldX !== undefined`, or `emoteId !== undefined` over the reliable channel with an explicit `edgeButtons` bitmask so out-of-order arrival never drops a tap or overwrites newer `moveX`/`moveY`/`aimAngle`.
- **Single-MTU Fast Snapshot Compression (`>= 70%` wire reduction, 100% lossless reconstruction):**
  - Split `QuantizedWorldSnapshot` on the P2P wire into a reliable structural baseline delta (`__base__`: room metadata, `props`, `chests`, `worldItems`, `npcEntities`, `hubStatues`/`hubStations` when in Hub, `discoveredRooms`, `pressurePlates`, static player loadout & static enemy spawn metadata) plus a compact positional-tuple fast frame (`__fast__`: dynamic player/enemy kinematics, HP/armor/timers/statuses, pickups, surfaces, and active transient mechanics) that fits inside ~`500–1,100 bytes` (`<= 1` UDP MTU in typical combat) and reconstructs an identical `QuantizedWorldSnapshot` on the receiver.
- **Exact Prediction Replay & 60 Hz Input Pacing on `120Hz–240Hz` Displays:**
  - Track actual executed fixed `60Hz` `simTicks` per `pendingInputs` entry in `NetworkTransport` so reconciliation matches local prediction at `60Hz`, `120Hz`, `144Hz`, and `240Hz` with zero phantom overshoot.
  - Pace continuous Co-op `sendInput` calls in `GameScene.update()` to ~`60Hz` (`15 ms` accumulator) while bypassing the accumulator (`0 ms` delay) on any button change, weapon slot select, stop-moving transition, ping, or emote.
- **Monotonic Smoothed Ping Telemetry:** Measure RTT using `performance.now()` (`clientPerfMs` echoed alongside `clientTime`) over the fast UDP channel when active, smoothed with an outlier-clamped EWMA (`0.7 / 0.3`).

### Non-Goals & Anti-Goals
- **Zero Gameplay or Balance Changes:** Combat math, deterministic simulation, Solo `LocalTransport`, and LAN Colyseus `CoopRoom` behavior must remain 100% unchanged.
- **No Unverified Unreliable Traffic:** Never send fast-channel traffic before `__fast_hello__` / `__fast_ack__` confirms end-to-end delivery on `fastDc`, and never drop gameplay events or button presses when packets are lost or reordered.

## 3. Approaches Considered

1. **Selected — Multiplexed Negotiated UDP DataChannel (`id: 42`) + Reliable Baseline / Fast Tuple Split + `simTicks` Pacing:**
   - Reuses the single PeerJS `RTCPeerConnection` (`0` extra ICE/STUN latency), bypasses `peerjs@1.5.5`'s hardcoded `reliable: true` stream wrapper for fast frames while keeping PeerJS `MsgPack` for reliable control/events/baselines, cuts steady-state snapshot size by ~`80%` to fit 1 UDP MTU, and falls back seamlessly to single-channel if `fastDc` cannot open.
2. **Rejected — Opening a second `peer.connect(hostId, { reliable: false })`:**
   - Inspection of `peerjs@1.5.5` (`bundler.cjs:1590`) proved its default `MsgPack` `DataConnection` silently overrides `reliable` to `true` and pipes through a stateful `TransformStream`, PLUS creates a second `RTCPeerConnection` requiring duplicate STUN/ICE negotiation.
3. **Rejected — Sending raw `QuantizedWorldSnapshot` over `ordered: false, maxRetransmits: 0`:**
   - Loses `bullet_volley_spawned` / `projectiles_destroyed` on packet loss and fragments ~`14 KB` snapshots across ~`12` UDP packets (amplifying 2% packet loss into ~22% snapshot loss).

## 4. Architecture & Interfaces

1. **`@ashen-pact/shared` (`messages.ts`, `snapshot-codec.ts`, `sim-coop-hub.ts`, `network-transport.ts`, `coop-room-authority.ts`):**
   - Optional `edgeButtons?: number` on `PlayerInputPacket`; in `setCoopPlayerInputImpl`, if `input.seq > 0 && entry.current.seq > 0 && input.seq < entry.current.seq`, preserve one-shot actions (`entry.latchedButtons |= input.edgeButtons ?? 0`, `weaponSlotSelect`, `pingWorldX/Y`, `emoteId`) without rewinding `entry.current` kinematics or `lastProcessedSeq`.
   - Optional `snapshotSeq?: number` on `QuantizedWorldSnapshot`, incremented monotonically by `CoopRoomAuthority`.
   - `NetworkTransport.receiveEvents(events: SimEvent[]): void` + stale snapshot rejection (`snapshotSeq <= lastSnapshotSeq` or legacy `tick < lastSnapshotTick`) + `simTicks` counter per `pendingInputs` item.
   - `CoopAuthorityPeer.send(type, payload, options?: { reliable?: boolean; immediate?: boolean })` and `pong_check` echoing optional `clientPerfMs`.
2. **`@ashen-pact/client` (`p2p-wire-codec.ts`, `p2p-coop-client.ts`, `GameScene.ts`, `input-and-network.ts`, `debug-overlay.ts`):**
   - `P2PSnapshotEncoder` / `P2PSnapshotDecoder` in `apps/client/src/net/p2p-wire-codec.ts` splitting `QuantizedWorldSnapshot` into reliable `__base__` revisions + compact tuple `__fast__` frames (buffering at most 1 newest pending `__fast__` frame if it arrives a few ms ahead of its matching `__base__` revision).
   - Negotiated `RTCDataChannel` (`id: 42`, `ordered: false`, `maxRetransmits: 0`, `bufferedAmount <= 16_384` backpressure guard) in `p2p-coop-client.ts` with `__fast_hello__` / `__fast_ack__` activation, reliable `world_events` separation, and edge-aware input routing.
   - `15 ms` continuous Co-op input pacing (with instant discrete-change flush) in `GameScene.ts`, plus `clientPerfMs` + EWMA RTT smoothing in `input-and-network.ts` and `p2pFastChannel` debug telemetry.
