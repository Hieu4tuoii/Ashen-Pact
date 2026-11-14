# WebRTC P2P Netcode Smoothing & Bandwidth Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate head-of-line blocking, multi-MTU snapshot fragmentation, high-refresh-rate (`120Hz–240Hz`) prediction rubber-banding, and ping telemetry jitter in Online WebRTC P2P Co-op while preserving 100% of Solo, LAN Colyseus, and existing gameplay behavior.

**Architecture:** Multiplex a pre-negotiated unordered/unreliable `RTCDataChannel` (`id: 42`, `ordered: false`, `maxRetransmits: 0`, gated by an end-to-end `__fast_hello__` / `__fast_ack__` probe with seamless fallback to the primary reliable channel) onto the existing PeerJS `RTCPeerConnection`. Split P2P `QuantizedWorldSnapshot` wire payloads into reliable structural baselines (`__base__`) plus single-MTU compact tuple frames (`__fast__`), separate `SimEvent[]` onto reliable `world_events`, route discrete button/stop edges reliably with out-of-order monotonic guards, and pace/reconcile high-Hz client inputs by exact simulated `60Hz` ticks (`simTicks`).

**Tech Stack:** TypeScript, PeerJS (`1.5.5`) + native W3C `RTCDataChannel`, Phaser 3, `@ashen-pact/shared`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-webrtc-p2p-netcode-smoothing-design.md`

## Global Constraints

- Solo (`LocalTransport`) and Colyseus LAN (`apps/server/src/rooms/CoopRoom.ts`) behavior and wire contracts MUST remain 100% unchanged.
- Never route traffic over the negotiated `RTCDataChannel` (`id: 42`) until `__fast_hello__` / `__fast_ack__` confirms end-to-end delivery; if `fastDc` fails to open or closes mid-run while the primary PeerJS `DataConnection` remains open, fall back immediately to the primary reliable channel without disconnecting.
- Deterministic `SimEvent[]` (`bullet_volley_spawned`, `projectiles_destroyed`, hits, audio), immediate state-transition keyframes (`broadcastImmediateSnapshot`), and discrete input transitions (`buttons` changes, `moving -> stopped`, `weaponSlotSelect`, `pingWorldX`, `emoteId`) MUST always travel reliably.
- `P2PSnapshotEncoder` + `P2PSnapshotDecoder` MUST reconstruct `QuantizedWorldSnapshot` losslessly (`toEqual`) and reduce steady-state 4P combat fast-frame JSON byte length by at least `70%` (`< 1,300` bytes).
- PeerJS `debug` MUST remain `0` (zero unexpected browser console warnings/errors).

## Review Focus

- Fast UDP `__fast__` frame arriving a few milliseconds ahead of its reliable `__base__` revision during a room transition must be held as the single newest pending frame and decoded as soon as `__base__` arrives, never mismatched against the previous room's baseline.
- Reliable button-edge input (`seq = 11`, e.g. `DASH` or `SKILL`) arriving after a newer fast UDP movement input (`seq = 12`) must latch `edgeButtons` / `weaponSlotSelect` / `ping` / `emote` without overwriting `seq = 12`'s `moveX`, `moveY`, `aimAngle`, or `lastProcessedSeq`.
- Mid-session closure or error on `fastDc` while the primary PeerJS `DataConnection` remains open must seamlessly revert both Host and Joiner to sending over the primary reliable channel without dropping the player.
- Multiple immediate snapshots emitted at the same `sim.tick` (e.g. Hub character switch + Ready toggle while `inHub` or `buff_choice`) must advance `snapshotSeq` so `NetworkTransport` never drops them as stale.
- `144Hz` / `240Hz` display frame loops where multiple `sendInput` calls occur between `60Hz` fixed steps (or 0 steps on a sub-frame) must reconcile with zero phantom prediction overshoot (`simTicks` exact replay) and flush `moving -> stopped` / button changes with `0 ms` delay.

---

### Task 1: Shared Monotonic Guards, Reliable `receiveEvents`, and High-Hz `simTicks` Reconciliation

**Files:**
- Modify: `packages/shared/src/protocol/messages.ts`
- Modify: `packages/shared/src/protocol/snapshot-codec.ts`
- Modify: `packages/shared/src/sim/sim-coop-hub.ts`
- Modify: `packages/shared/src/protocol/network-transport.ts`
- Modify: `packages/shared/src/protocol/coop-room-authority.ts`
- Test: `packages/shared/test/p2p-netcode-smoothing.test.ts`

**Interfaces:**
- Produces:
  - `PlayerInputPacket.edgeButtons?: number` in `packages/shared/src/protocol/messages.ts`
  - `QuantizedWorldSnapshot.snapshotSeq?: number` in `packages/shared/src/protocol/snapshot-codec.ts`
  - `NetworkTransport.receiveEvents(events: SimEvent[]): void` in `packages/shared/src/protocol/network-transport.ts`
  - `CoopAuthorityPeerSendOptions { reliable?: boolean; immediate?: boolean }` and `CoopAuthorityPeer.send(type: string, payload: unknown, options?: CoopAuthorityPeerSendOptions): void` in `packages/shared/src/protocol/coop-room-authority.ts`
  - `pong_check` payload `{ clientTime: number; clientPerfMs?: number; serverTick: number }` in `packages/shared/src/protocol/coop-room-authority.ts`

- [ ] **Step 1: Write failing unit tests in `packages/shared/test/p2p-netcode-smoothing.test.ts`**

Cover:
1. Out-of-order `setCoopPlayerInput`: `seq = 12` (`moveX = -1, aimAngle = 1.5, buttons = 0`) applied first, followed by delayed `seq = 11` (`moveX = 1, aimAngle = 0, buttons = INPUT_BUTTON.DASH, edgeButtons = INPUT_BUTTON.DASH, weaponSlotSelect = 1`): preserves `moveX = -1`, `aimAngle = 1.5`, `lastProcessedSeq = 12`, while latching `DASH` and `weaponSlotSelect = 1` on the next `sim.step(1 / 60)`; whereas a delayed continuous packet `seq = 10` (`edgeButtons: undefined`) neither rewinds movement nor latches stale buttons.
2. Stale / out-of-order snapshot & same-tick `snapshotSeq`: `NetworkTransport.receiveSnapshot` ignores a delayed snapshot with `snapshotSeq: 4` after applying `snapshotSeq: 5`, AND applies two consecutive Hub immediate snapshots sharing `tick: 10` when `snapshotSeq` advances `5 -> 6`.
3. Separate reliable `NetworkTransport.receiveEvents(events)`: spawns deterministic `bullet_volley_spawned` projectiles and destroys `projectiles_destroyed` IDs cleanly even when `receiveSnapshot` arrives with `events: []`.
4. `144Hz` / `240Hz` sub-tick `sendInput` reconciliation: calling `sendInput` 3 times per `16.67ms` frame (`~180Hz`) while `serverSim` steps at `60Hz` produces `< 2px` reconciliation error (vs `> 12px` phantom overshoot before `simTicks` tracking).
5. `CoopRoomAuthority` increments `snapshotSeq`, marks periodic `step()` snapshots `{ reliable: false, immediate: false }` and `broadcastImmediateSnapshot()` `{ reliable: true, immediate: true }`, and echoes `clientPerfMs` in `pong_check`.

- [ ] **Step 2: Run Vitest to verify RED failure**

Run: `pnpm --filter @ashen-pact/shared exec vitest run test/p2p-netcode-smoothing.test.ts`
Expected: FAIL (`receiveEvents is not a function` / assertions failing).

- [ ] **Step 3: Implement shared protocol & simulation updates**

- Add `edgeButtons?: number` to `PlayerInputPacket` in `packages/shared/src/protocol/messages.ts`.
- Add `snapshotSeq?: number` to `QuantizedWorldSnapshot` in `packages/shared/src/protocol/snapshot-codec.ts`.
- Update `setCoopPlayerInputImpl` in `packages/shared/src/sim/sim-coop-hub.ts`: when `input.seq > 0 && entry.current.seq > 0 && input.seq < entry.current.seq`, only latch `input.edgeButtons ?? 0`, `weaponSlotSelect`, `pingWorldX`/`pingWorldY`, and `emoteId`, returning without overwriting `entry.current` or `sp.lastProcessedSeq`. When in-order, also OR `input.edgeButtons ?? 0` into `entry.latchedButtons`.
- Update `NetworkTransport` in `packages/shared/src/protocol/network-transport.ts`:
  - Store `{ packet: PlayerInputPacket; simTicks: number }[]` in `pendingInputs`; increment the latest entry's `simTicks` inside `stepLocalPrediction` (if `pendingInputs` is non-empty) and replay `entry.simTicks` steps of `1 / 60` per unacknowledged input in `applyAuthoritativeSnapshot`.
  - Reject stale snapshots in `applyAuthoritativeSnapshot` (`snapshot.snapshotSeq !== undefined ? snapshot.snapshotSeq <= this.lastSnapshotSeq : (this.lastSnapshotTick >= 0 && snapshot.tick < this.lastSnapshotTick)`), resetting tracking only if a fresh room/seed reconnect starts at a lower sequence with `tick === 0 && inHub && !this.sim.inHub`.
  - Extract `applyAuthoritativeEvents(events: SimEvent[]): void` and expose `receiveEvents(events: SimEvent[]): void` (routing through `wifiSim.receiveInbound` so simulated Wi-Fi profiles work identically).
- Update `CoopRoomAuthority` in `packages/shared/src/protocol/coop-room-authority.ts`:
  - Add `CoopAuthorityPeerSendOptions { reliable?: boolean; immediate?: boolean }` to `CoopAuthorityPeer.send`.
  - Increment `private snapshotSeq = 0` on every encoded snapshot (`snap.snapshotSeq = ++this.snapshotSeq`), passing `{ reliable: false, immediate: false }` in `step()` and `{ reliable: true, immediate: true }` in `broadcastImmediateSnapshot()`, and passing `{ reliable: false }` on `pong_check` while echoing `clientPerfMs`.
- Rebuild `@ashen-pact/shared` (`pnpm --filter @ashen-pact/shared build`) so downstream packages see updated `.d.ts` types.

- [ ] **Step 4: Run shared tests to verify GREEN**

Run: `pnpm --filter @ashen-pact/shared build && pnpm --filter @ashen-pact/shared exec vitest run test/p2p-netcode-smoothing.test.ts test/phase4-coop.test.ts test/coop-room-authority.test.ts`
Expected: PASS (all 3 test files green).

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/shared/src/protocol/messages.ts packages/shared/src/protocol/snapshot-codec.ts packages/shared/src/sim/sim-coop-hub.ts packages/shared/src/protocol/network-transport.ts packages/shared/src/protocol/coop-room-authority.ts packages/shared/test/p2p-netcode-smoothing.test.ts
git commit -m "feat(shared): add out-of-order netcode guards, reliable event stream, and exact high-Hz prediction replay"
```

---

### Task 2: Lossless P2P Baseline + Single-MTU Fast Tuple Wire Codec

**Files:**
- Create: `apps/client/src/net/p2p-wire-codec.ts`
- Test: `apps/client/test/p2p-wire-codec.test.ts`

**Interfaces:**
- Consumes: `QuantizedWorldSnapshot`, `QuantizedPlayerSnap`, `QuantizedEnemySnap` from `@ashen-pact/shared`
- Produces:
  - `P2PSnapshotBaseline` & `P2PFastFrame` types in `apps/client/src/net/p2p-wire-codec.ts`
  - `class P2PSnapshotEncoder { encode(snap: QuantizedWorldSnapshot): { baseline?: { rev: number; data: P2PSnapshotBaseline }; fast: P2PFastFrame }; reset(): void }`
  - `class P2PSnapshotDecoder { applyBaseline(rev: number, data: P2PSnapshotBaseline): QuantizedWorldSnapshot | null; decodeFast(fast: P2PFastFrame): QuantizedWorldSnapshot | null; reset(): void }`

- [ ] **Step 1: Write failing unit tests in `apps/client/test/p2p-wire-codec.test.ts`**

Cover:
1. Lossless bit-for-bit (`expect(decoded).toEqual(original)`) round-trip of both Hub snapshots (with `hubStatues`, `hubStations`, character choices) and rich 4-player combat snapshots (12 enemies with elite/boss/status timers, 25 props, chests, worldItems, pickups, surfaces, summons, skillZones, pushBlocks, tetherBeams, magneticRivets, blessings, mutators, duoBoons, relics, pacts, salvage, soulChain, runStats).
2. Steady-state delta behavior & single-MTU size: second consecutive combat tick with moving players/enemies emits `baseline === undefined` and `JSON.stringify(fast).length < 1300` bytes (`>= 70%` smaller than `JSON.stringify(snap).length`).
3. Baseline invalidation when any slow field changes (prop damaged/destroyed, chest opened, player picks up weapon/blessing/buffChoice, new enemy spawned, room changed) emits incremented `baseline.rev` and decodes losslessly.
4. Out-of-order / early `__fast__` before `__base__`: calling `decoder.decodeFast(fastRev2)` before `decoder.applyBaseline(2, baseRev2)` returns `null` (never corrupting with `rev 1`'s props/enemies), and immediately returns the reconstructed `rev 2` snapshot when `applyBaseline(2, baseRev2)` arrives; stale `fast` frames with `rev < currentRev` or `seq <= lastSeq` return `null`.

- [ ] **Step 2: Run Vitest to verify RED failure**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/p2p-wire-codec.test.ts`
Expected: FAIL (`Cannot find module '../src/net/p2p-wire-codec.js'`).

- [ ] **Step 3: Implement `apps/client/src/net/p2p-wire-codec.ts`**

- Separate `QuantizedWorldSnapshot` into:
  - `P2PSnapshotBaseline`: room/floor/hub flags, portal coords, `props`, `chests`, `worldItems`, `npcEntities`, `hubStatues` (omitted when `!inHub` unless non-empty, Wait: preserve exact `snap.hubStatues` & `snap.hubStations` in baseline so round-trip `toEqual` is 100% exact!), `pressurePlates`, `discoveredRooms`, `coopPuzzleCompleted`, `secretTrialActive`, `secretTrialResult`, static player metadata (`id`, `slot`, `name`, `color`, `charId`, `maxHp`, `maxArmor`, `clipMax`, `weaponSlots`, `blessings`, `mutators`, `duoBoons`, `pact`, `pactOrigWep`, `relics`, `buffChoices`, `mutatorChoices`, `pactChoices`, `wepLevels`), and static enemy metadata (`id`, `defId`, `maxHp`, `maxShield`, `elite`, `eliteMod`, `boss`). Compute a fast deterministic JSON fingerprint of the baseline object; only emit `{ rev: ++this.rev, data }` when the fingerprint changes!
  - `P2PFastFrame`: compact positional tuple array `[rev, seq, tick, serverTimeMs, flagsAndTimersTuple, playerTuples, enemyTuples, pickupTuples, surfaces, extras?]` where `enemyTuples` omit trailing zero status timers when all statuses are `0` (using a status flag bit or optional status sub-tuple) and `extras` is omitted when transient arrays (`pings`, `summons`, `skillZones`, `pushBlocks`, `tetherBeams`, `magneticRivets`, `projectiles`, `events`) are all empty.
- In `P2PSnapshotDecoder`, store `currentRev`, `currentBaseline`, `lastFastSeq`, and `pendingFast: P2PFastFrame | null`. Reconstruct exact `QuantizedWorldSnapshot` objects matching `encodeWorldSnapshot` property layout.

- [ ] **Step 4: Run Vitest to verify GREEN**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/p2p-wire-codec.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/client/src/net/p2p-wire-codec.ts apps/client/test/p2p-wire-codec.test.ts
git commit -m "feat(client): add lossless P2P baseline delta and single-MTU tuple snapshot codec"
```

---

### Task 3: Multiplexed Negotiated UDP DataChannel (`id: 42`) & Dual-Channel P2P Routing

**Files:**
- Modify: `apps/client/src/net/coop-room-connection.ts`
- Modify: `apps/client/src/net/p2p-coop-client.ts`
- Test: `apps/client/test/p2p-coop-client.test.ts`

**Interfaces:**
- Consumes: `P2PSnapshotEncoder`, `P2PSnapshotDecoder` from Task 2; `CoopAuthorityPeerSendOptions`, `PlayerInputPacket.edgeButtons` from Task 1.
- Produces:
  - `CoopRoomConnection.isFastChannelActive?: () => boolean` in `apps/client/src/net/coop-room-connection.ts`
  - Negotiated `RTCDataChannel` (`label: 'ashen_fast_udp'`, `negotiated: true`, `id: 42`, `ordered: false`, `maxRetransmits: 0`) support on `PeerDataConnectionLike.peerConnection` in `apps/client/src/net/p2p-coop-client.ts`

- [ ] **Step 1: Write failing unit tests in `apps/client/test/p2p-coop-client.test.ts`**

Add tests covering:
1. Negotiated UDP fast channel activation (`__fast_hello__` -> `__fast_ack__`): once verified, `hostRoom.isFastChannelActive()` and `clientRoom.isFastChannelActive()` return `true`; steady 30 Hz `authority.step` broadcasts compact `__fast__` frames over `fastDc` while stripping non-empty `SimEvent[]` onto reliable `conn` as `world_events`, and `broadcastImmediateSnapshot` (e.g. `set_ready` / `select_character`) sends over reliable `conn`.
2. Packet loss resilience on `fastDc`: dropping 50% of outbound `fastDc` frames does NOT drop any `bullet_volley_spawned` `world_events`, does NOT drop discrete button presses (`DASH` / `SKILL` / `FIRE` press/release / `moving -> stopped` routed over reliable `conn` with `edgeButtons`), and never stalls subsequent `world_snapshot` deliveries.
3. Seamless fallback when `fastDc` fails to open OR closes mid-session: if `peerConnection.createDataChannel` is absent, never echoes `__fast_ack__`, or `fastDc` emits `close`/`error` mid-run while `conn` remains open, `isFastChannelActive()` becomes `false` and snapshots, inputs, and `ping_check`/`pong_check` continue flowing losslessly over `conn` without triggering `onLeave`.
4. Backpressure guard: when `fastDc.bufferedAmount > 16_384`, non-immediate fast frames are skipped cleanly instead of growing unboundedly.

- [ ] **Step 2: Run Vitest to verify RED failure**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/p2p-coop-client.test.ts`
Expected: FAIL (new dual-channel & fallback assertions fail).

- [ ] **Step 3: Implement Dual-Channel WebRTC + Codec integration in `apps/client/src/net/p2p-coop-client.ts`**

- Add `readonly isFastChannelActive?: () => boolean` to `CoopRoomConnection` (`apps/client/src/net/coop-room-connection.ts`).
- Extend `PeerDataConnectionLike` with optional `readonly peerConnection?: { createDataChannel?: (label: string, opts: RTCDataChannelInit) => FastDataChannelLike } | null`.
- On both Host (`peer.on('connection', conn => ...)` once `conn` is open / on `__join__`) and Joiner (`dc.on('open')`), open `createDataChannel('ashen_fast_udp', { negotiated: true, id: 42, ordered: false, maxRetransmits: 0 })` inside `try/catch`:
  - Joiner sends `JSON.stringify({ t: '__fast_hello__' })` on `fastDc` when `readyState === 'open'` (with up to 4 retries every `120ms` until `__fast_ack__` arrives or connection closes).
  - Host marks `peerFastVerified = true` ONLY upon receiving `__fast_hello__` on `fastDc` and replies `JSON.stringify({ t: '__fast_ack__' })` on `fastDc`.
  - Joiner marks `fastVerified = true` ONLY upon receiving `__fast_ack__` on `fastDc`.
  - If `fastDc` emits `close` or `error`, mark `fastVerified = false` cleanly without closing `conn`.
  - Clean up `fastDc` and retry timers in `leave()` and `onHostWindowUnload`.
- Wire `P2PSnapshotEncoder` per remote peer on Host and `P2PSnapshotDecoder` on Joiner:
  - For `'world_snapshot'`: if `snap.events.length > 0`, send `{ t: 'world_events', p: snap.events }` on reliable `conn` and encode `{ ...snap, events: [] }` via `encoder.encode(...)`. Send any `{ t: '__base__', rev, b }` on reliable `conn`. If `!opts?.immediate && peerFastVerified && fastDcOpen && (fastDc.bufferedAmount ?? 0) <= 16_384`, send `JSON.stringify({ t: '__fast__', f: fast })` on `fastDc`; otherwise (if `opts?.immediate` or `!peerFastVerified`), send `{ t: '__fast__', f: fast }` on reliable `conn`.
  - On Joiner, handle `'__base__'` and `'__fast__'` (from both `conn` and `fastDc`) through `decoder`, emitting `'world_snapshot'` whenever a non-null `QuantizedWorldSnapshot` is produced, and emit `'world_events'` directly to `dispatcher`.
- Route Joiner outbound messages:
  - `'input'` / `'player_input'`: track `lastSentButtons` and `lastWasMoving`. Compute `edgeButtons = pkt.buttons & ~lastSentButtons`. If `pkt.buttons !== lastSentButtons || (lastWasMoving && !isMoving) || pkt.weaponSlotSelect !== null && pkt.weaponSlotSelect !== undefined || pkt.pingWorldX !== undefined || pkt.emoteId !== undefined || !fastVerified`, send `{ ...pkt, ...(edgeButtons ? { edgeButtons } : {}) }` on reliable `conn`; otherwise send over `fastDc` (if `bufferedAmount <= 16_384`).
  - `'ping_check'`, `'pong_check'`, `'report_ping'`: send over `fastDc` when `fastVerified && fastDcOpen`, else reliable `conn`.

- [ ] **Step 4: Run Vitest to verify GREEN**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/p2p-coop-client.test.ts test/p2p-wire-codec.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add apps/client/src/net/coop-room-connection.ts apps/client/src/net/p2p-coop-client.ts apps/client/test/p2p-coop-client.test.ts
git commit -m "feat(client): multiplex negotiated UDP fast DataChannel with lossless event/edge split and fallback"
```

---

### Task 4: `60Hz` Co-op Input Pacing, Monotonic EWMA Ping, `world_events` Handler & Multi-Browser E2E

**Files:**
- Modify: `apps/client/src/ui/debug-overlay.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/game-scene/input-and-network.ts`
- Modify: `apps/client/test/sanctuary-p2p-ui.test.ts`
- Modify: `tests/e2e/webrtc-p2p-coop.spec.ts`

**Interfaces:**
- Consumes: `NetworkTransport.receiveEvents`, `CoopRoomConnection.isFastChannelActive`, `pong_check.clientPerfMs` from Tasks 1–3.
- Produces: `GlobalDebugState.p2pFastChannel?: boolean` in `apps/client/src/ui/debug-overlay.ts`; `smoothPingRttMs(prevSmoothedMs: number | null, sampleRttMs: number): number` in `apps/client/src/scenes/game-scene/input-and-network.ts`; `shouldSendCoopInputThisFrame(...)` helper in `apps/client/src/scenes/game-scene/input-and-network.ts` (wired into `GameScene.ts`).

- [ ] **Step 1: Write failing unit tests in `apps/client/test/sanctuary-p2p-ui.test.ts` and update `tests/e2e/webrtc-p2p-coop.spec.ts`**

In `apps/client/test/sanctuary-p2p-ui.test.ts`, add tests for:
1. `bindCoopRoomHandlersImpl` forwards `world_events` payloads to `networkTransport.receiveEvents(events)`, computes monotonic RTT from `clientPerfMs` when present (falling back to `Date.now() - clientTime` for legacy payloads), smooths jitter spikes via `smoothPingRttMs` (`20ms -> 120ms` single-sample spike damped rather than jumping straight to `120ms`, while first sample initializes immediately), and exposes `debug.p2pFastChannel`.
2. `shouldSendCoopInputThisFrame`: at `240Hz` (`rawDeltaMs = 4.16ms`), continuous unchanged movement sends once every `>= 15ms` (`~60Hz`), whereas any button change (`FIRE`, `DASH`, `SKILL`, `INTERACT`), `moving -> stopped` transition, `slotSelect !== null`, `pingWorldX !== undefined`, or `emoteId !== undefined` returns `true` immediately (`0ms` delay); Solo mode (`coopMode === 'solo'`) always sends every frame.

In `tests/e2e/webrtc-p2p-coop.spec.ts`:
- Assert that both Host and Joiner activate the real Chromium negotiated WebRTC UDP fast channel (`__ASHEN_PACT_DEBUG__.p2pFastChannel === true`) during their P2P session, and verify combat weapon firing (`bullet_volley_spawned` over `world_events`) + room synchronization work cleanly with zero console errors.

- [ ] **Step 2: Run Vitest to verify RED failure**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/sanctuary-p2p-ui.test.ts`
Expected: FAIL (`smoothPingRttMs` / `shouldSendCoopInputThisFrame` / `world_events` handler missing).

- [ ] **Step 3: Implement `GameScene`, `input-and-network`, and `debug-overlay` wiring**

- Add `p2pFastChannel?: boolean` to `GlobalDebugState` in `apps/client/src/ui/debug-overlay.ts` (default `false`).
- In `apps/client/src/scenes/game-scene/input-and-network.ts`:
  - Export pure helpers `smoothPingRttMs(prevSmoothedMs: number | null, sampleRttMs: number): number` (clamps `sampleRttMs` to `[1, 999]`; if `prevSmoothedMs === null || prevSmoothedMs <= 0`, returns `Math.round(clamped)`; else caps single-sample upward jump to `prevSmoothedMs + Math.min(80, Math.max(25, prevSmoothedMs * 1.5))` and blends `0.7 * prevSmoothedMs + 0.3 * capped`) and `shouldSendCoopInputThisFrame(...)`.
  - Subscribe `room.onMessage<SimEvent[]>('world_events', (events) => { if (!isStaleSession() && Array.isArray(events)) this.networkTransport?.receiveEvents(events); })`.
  - Send `clientPerfMs: performance.now()` alongside `clientTime: Date.now()` in `ping_check`, compute RTT from `clientPerfMs` when `typeof payload.clientPerfMs === 'number'`, smooth with per-room `smoothedRttMs`, and update `debug.p2pFastChannel = Boolean(this.room?.isFastChannelActive?.())`.
- In `apps/client/src/scenes/GameScene.ts`:
  - Track `coopInputSendAccumMs`, `lastSentCoopButtons`, and `lastSentCoopMoving` (reset in `init()`), gating `this.transport.sendInput(...)` via `shouldSendCoopInputThisFrame` when `this.coopMode !== 'solo'` while always keeping `this.transport.step(...)` running every frame (and updating local aim angle immediately on `this.transport.getLocalPlayerState().aimAngle = aimAngle` so crosshair/character facing stays `240Hz`-smooth!).

- [ ] **Step 4: Run Vitest + Build + Typecheck + ESLint + Multi-Browser Playwright E2E**

Run:
1. `pnpm build && pnpm typecheck`
2. `pnpm --filter @ashen-pact/client exec vitest run test/sanctuary-p2p-ui.test.ts test/p2p-coop-client.test.ts test/p2p-wire-codec.test.ts`
3. `npx playwright test tests/e2e/webrtc-p2p-coop.spec.ts tests/e2e/polish-p9b.spec.ts tests/e2e/phase4.spec.ts`
Expected: PASS (`0` errors, `3/3` Playwright E2E specs green with `p2pFastChannel === true`).

- [ ] **Step 5: Commit Task 4**

```bash
git add apps/client/src/ui/debug-overlay.ts apps/client/src/scenes/GameScene.ts apps/client/src/scenes/game-scene/input-and-network.ts apps/client/test/sanctuary-p2p-ui.test.ts tests/e2e/webrtc-p2p-coop.spec.ts
git commit -m "feat(client,e2e): add 60Hz co-op input pacing, smoothed monotonic ping, and dual-channel WebRTC E2E verification"
```
