# WebRTC P2P Online Co-op (Vercel Serverless Ready) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable 100% free, cross-Wi-Fi / cross-ISP Online Co-op (1–4 players) directly on static Vercel deployments via WebRTC DataChannels (`PeerJS`) + 6-character Room Codes while preserving full compatibility with existing local LAN Co-op (`Colyseus`).

**Architecture:** Extract the authoritative 1–4P session/simulation state machine into `@ashen-pact/shared` (`CoopRoomAuthority`) shared by both `apps/server` (`CoopRoom`) and the Browser P2P Host (`PeerHostRoom` stepped at 60Hz by a background-safe Web Worker `BackgroundTicker`). Unify Colyseus `Room` and PeerJS `PeerHostRoom` / `PeerClientRoom` behind a minimal `CoopRoomConnection` adapter in `@ashen-pact/client`, add smart Room Code / Invite URL / LAN IP parsing (`coop-addressing.ts`), expand QR generation to ISO/IEC 18004 Version 5-L (`106` bytes), and add an Online/LAN toggle with automatic HTTPS/Vercel Online default in the Sanctuary Co-op Guild Drawer.

**Tech Stack:** TypeScript 5.6, Phaser 3.87, `peerjs` (`^1.5.5`, WebRTC DataChannel), `peer` (`^1.0.2`, dev/E2E local PeerServer), Colyseus 0.15, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-webrtc-p2p-coop-design.md`

## Global Constraints

- `SANCTUARY_VERSION_BADGE = 'v2.0.0 · LAN'` literal in `apps/client/src/scenes/game-scene/sanctuary-lobby-ui.ts` MUST remain intact (pinned by `packages/shared/test/polish-p12-release-version.test.ts`).
- `SOLO_COOP_INPUT_LOCAL_BOUNDS` (`name` & `ip` boxes) and `data-testid="menu-name-input"` / `data-testid="menu-ip-input"` MUST keep their exact coordinates and attributes (`tests/e2e/polish-p9b.spec.ts`).
- Zero `console.warn` or `console.error` from PeerJS (`debug: 0` strictly enforced); never instantiate `Peer` during Solo mode or Colyseus LAN mode.
- All workspace `package.json` manifests MUST remain at `"version": "2.0.0"`.
- Maintain bilingual i18n parity across `packages/shared/src/i18n/vi.json` and `packages/shared/src/i18n/en.json`.

## Review Focus

1. **Full Vercel invite URL or formatted code pasted into the Room Code / IP input box** (`https://ashen-pact.vercel.app/?join=7K9M2P&p2p=1`, `ap-7k9-m2p`): `parseCoopTargetInput` extracts `{ kind: 'p2p', roomCode: '7K9M2P' }` instead of treating `https://...` as a Colyseus server (pinned in Task 1).
2. **Cloud `wss://` / `https://` Colyseus domain without explicit `:port`** (`wss://my-server.onrender.com`): `parseCoopTargetInput` and `resolveSanctuaryWsUrl` preserve default port 443 (`wss://my-server.onrender.com`) without appending `:2567`, while still appending `:2567` to bare IPv4 / `localhost` (`192.168.1.25` -> `ws://192.168.1.25:2567`) (pinned in Task 1).
3. **Long Vercel preview invite URL (`79..106` UTF-8 bytes) encoded into Hub QR Code**: `generateQrMatrix` (`qr.ts`) upgrades to Version 5-L (`37×37` modules, `108` data codewords) so bytes `79..106` encode completely without silent truncation at 78 bytes (pinned in Task 1).
4. **WebRTC close codes (`4000..4003` vs `1006` network drop) and invalid Room Code (`'peer-unavailable'`)**: `PeerHostRoom` sends `{ t: '__close__', code }` prior to closing DataChannels so kicked/rejected/host-left clients exit to Solo Sanctuary with localized reason banners instead of looping reconnects, and `'peer-unavailable'` returns cleanly to Solo Sanctuary with an error banner (pinned in Task 2 & Task 3).
5. **Stale in-flight P2P Host/Join resolving after `GameScene` restarted back to Solo (`sceneSessionEpoch` race)**: `connectCoopRoomImpl` calls `room.leave(true)` immediately on stale resolution, terminating `Peer` and `BackgroundTicker` cleanly (pinned in Task 3).

---

### Task 1: Shared `CoopRoomAuthority`, Room Code / URL Addressing, QR Version 5-L & `CoopRoom` Delegation

**Files:**
- Create: `packages/shared/src/protocol/coop-room-authority.ts`
- Create: `packages/shared/src/protocol/coop-addressing.ts`
- Modify: `packages/shared/src/core/qr.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/server/src/rooms/CoopRoom.ts`
- Create: `packages/shared/test/coop-room-authority.test.ts`
- Create: `packages/shared/test/coop-addressing.test.ts`

**Interfaces:**
- Produces in `@ashen-pact/shared`:
  - `export interface CoopAuthorityPeer { readonly sessionId: string; send(type: string, payload: unknown): void; close(code: number): void; }`
  - `export interface CoopRoomAuthorityStateSummary { tick: number; seed: number; playerCount: number; inHub: boolean; hostName: string; }`
  - `export interface CoopRoomAuthorityOptions { roomId: string; seed?: number; startInHub?: boolean; allowDuplicateCharacters?: boolean; isDebugEnabled?: () => boolean; onDebugRejected?: (sessionId: string, cmdName: string) => void; reconnectGraceMs?: number; onStateChange?: (state: CoopRoomAuthorityStateSummary) => void; onRoomClose?: () => void; }`
  - `export class CoopRoomAuthority` with `readonly sim: WorldSim`, `joinPeer(peer: CoopAuthorityPeer, options?: Record<string, unknown>): void`, `handleMessage(sessionId: string, type: string, payload: unknown): void`, `leavePeer(sessionId: string, consented: boolean): void`, `step(deltaMs: number): void`, `broadcastImmediateSnapshot(): void`, `dispose(): void`.
  - `export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'`
  - `export function generateRoomCode(randomFn?: () => number): string`
  - `export function normalizeRoomCode(raw: string): string | null`
  - `export function roomCodeToPeerId(roomCode: string): string`
  - `export type ParsedCoopTarget = { kind: 'empty' } | { kind: 'p2p'; roomCode: string } | { kind: 'colyseus'; wsUrl: string; hostPortDisplay: string; roomId?: string }`
  - `export function parseCoopTargetInput(rawInput: string, opts?: { pageProtocol?: string; preferredTransport?: 'p2p' | 'lan' }): ParsedCoopTarget`
  - `export function resolveWsEndpointUrl(hostPortOrUrl: string, pageProtocol?: string): string`

- [ ] **Step 1: Write failing unit tests in `packages/shared/test/coop-addressing.test.ts` and `packages/shared/test/coop-room-authority.test.ts`**

Test `generateRoomCode` (6 chars from `ROOM_CODE_ALPHABET`, zero `0/O/1/I`), `normalizeRoomCode` (`' 7k9-m2p '` -> `'7K9M2P'`, `'ap-7k9m2p'` -> `'7K9M2P'`, `'p2p:7k9m2p'` -> `'7K9M2P'`, rejects `'192.168.1.5:2567'`), `roomCodeToPeerId('7K9M2P') === 'ashen-pact-v2-room-7k9m2p'`, `parseCoopTargetInput` across:
- `'https://ashen-pact.vercel.app/?join=7k9m2p&p2p=1'` -> `{ kind: 'p2p', roomCode: '7K9M2P' }`
- `'https://ashen-pact.vercel.app/?join=7K9M2P'` -> `{ kind: 'p2p', roomCode: '7K9M2P' }`
- `'http://192.168.1.25:2567/?join=roomAbc12'` -> `{ kind: 'colyseus', wsUrl: 'ws://192.168.1.25:2567', hostPortDisplay: '192.168.1.25:2567', roomId: 'roomAbc12' }`
- `'wss://ashen-server.onrender.com'` -> `{ kind: 'colyseus', wsUrl: 'wss://ashen-server.onrender.com', hostPortDisplay: 'ashen-server.onrender.com' }` (no `:2567` appended!)
- `'192.168.1.25'` (`pageProtocol: 'http:'`) -> `{ kind: 'colyseus', wsUrl: 'ws://192.168.1.25:2567', hostPortDisplay: '192.168.1.25:2567' }`
- `generateQrMatrix` on a 92-byte Vercel preview URL `'https://ashen-pact-git-feat-webrtc-hieu4tuoii.vercel.app/?join=7K9M2P&p2p=1'` returns a `37×37` matrix (Version 5-L) rather than truncating at `33×33`.
And in `coop-room-authority.test.ts`: test 1–4P join slots, non-duplicate hero selection + `toggle_duplicate_char`, 60Hz `step` emitting 30Hz `world_snapshot` every 2 ticks, mid-run join rejection (`4003`), 5th player rejection (`4002`), host kick (`4001`), non-consented disconnect + `reconnectToken` recovery within grace window, host leave (`4000` + `onRoomClose`), and `debug_rejected` when `isDebugEnabled` returns `false`.

- [ ] **Step 2: Run Vitest on the two new test files to verify RED**

Run: `pnpm vitest run packages/shared/test/coop-addressing.test.ts packages/shared/test/coop-room-authority.test.ts`
Expected: FAIL (missing exports `CoopRoomAuthority`, `generateRoomCode`, `parseCoopTargetInput`, and QR matrix size `33` instead of `37`).

- [ ] **Step 3: Implement `coop-addressing.ts`, `coop-room-authority.ts`, Version 5-L in `qr.ts`, export from `packages/shared/src/index.ts`, and refactor `apps/server/src/rooms/CoopRoom.ts` to delegate to `CoopRoomAuthority`**

In `qr.ts`, add `{ version: 5, size: 37, dataCodewords: 108, ecCodewords: 26, alignmentCenter: 30 }` to `QR_VERSIONS` and select Version 3-L (`<= 53` bytes), Version 4-L (`<= 78` bytes), or Version 5-L (`> 78` bytes). In `CoopRoom.ts`, use `this.onMessage('*', (client, type, payload) => ...)` forwarding to `this.authority.handleMessage(client.sessionId, String(type), payload)` and clear `this.authority.dispose()` in `onDispose()`.

- [ ] **Step 4: Build `@ashen-pact/shared` & `@ashen-pact/server` and run Vitest to verify GREEN**

Run: `pnpm --filter @ashen-pact/shared build && pnpm --filter @ashen-pact/server build && pnpm vitest run packages/shared/test/coop-addressing.test.ts packages/shared/test/coop-room-authority.test.ts packages/shared/test/phase4-coop.test.ts packages/shared/test/server-debug-gate.test.ts`
Expected: PASS (0 errors, all tests green).

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/shared/src/core/qr.ts packages/shared/src/protocol/coop-addressing.ts packages/shared/src/protocol/coop-room-authority.ts packages/shared/src/index.ts packages/shared/test/coop-addressing.test.ts packages/shared/test/coop-room-authority.test.ts apps/server/src/rooms/CoopRoom.ts
git commit -m "feat(shared,server): extract CoopRoomAuthority, add P2P addressing helpers, and support QR v5-L"
```

---

### Task 2: Browser WebRTC P2P Engine (`PeerJS` Host/Client `CoopRoomConnection` & Web Worker `BackgroundTicker`)

**Files:**
- Modify: `package.json`
- Modify: `apps/client/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/client/src/net/coop-room-connection.ts`
- Create: `apps/client/src/net/background-ticker.ts`
- Create: `apps/client/src/net/p2p-coop-client.ts`
- Create: `apps/client/test/p2p-coop-client.test.ts`

**Interfaces:**
- Consumes: `CoopRoomAuthority`, `generateRoomCode`, `normalizeRoomCode`, `roomCodeToPeerId` from `@ashen-pact/shared`.
- Produces:
  - `apps/client/src/net/coop-room-connection.ts`:
    - `export interface CoopRoomConnection { readonly roomId: string; readonly reconnectionToken?: string; send(type: string, message?: unknown): void; onMessage<T = unknown>(type: string, callback: (message: T) => void): unknown; onLeave(callback: (code: number) => void): unknown; leave(consented?: boolean): Promise<unknown>; }`
  - `apps/client/src/net/background-ticker.ts`:
    - `export interface BackgroundTickerHandle { stop(): void; readonly mode: 'worker' | 'interval'; }`
    - `export function createBackgroundTicker(intervalMs: number, onStep: (deltaMs: number) => void, nowFn?: () => number): BackgroundTickerHandle`
  - `apps/client/src/net/p2p-coop-client.ts`:
    - `export interface PeerSignalingEndpointConfig { host?: string; port?: number; path?: string; secure?: boolean; key?: string; iceServers?: RTCIceServer[]; }`
    - `export function resolvePeerRuntimeOptions(search?: string, env?: Record<string, string | undefined>): PeerSignalingEndpointConfig`
    - `export interface CreatePeerHostRoomOptions { requestedRoomCode?: string; hostDisplayName: string; characterId?: string; seed?: number; isDebugEnabled?: () => boolean; peerFactory?: PeerLikeFactory; signaling?: PeerSignalingEndpointConfig; reconnectGraceMs?: number; }`
    - `export interface JoinPeerClientRoomOptions { roomCode: string; displayName: string; characterId?: string; reconnectToken?: string; timeoutMs?: number; peerFactory?: PeerLikeFactory; signaling?: PeerSignalingEndpointConfig; }`
    - `export async function createPeerHostRoom(options: CreatePeerHostRoomOptions): Promise<CoopRoomConnection>`
    - `export async function joinPeerClientRoom(options: JoinPeerClientRoomOptions): Promise<CoopRoomConnection>`

- [ ] **Step 1: Install `peerjs@^1.5.5` in `@ashen-pact/client` and `peer@^1.0.2` in root `devDependencies`**

Run: `pnpm --filter @ashen-pact/client add peerjs@^1.5.5 && pnpm add -D -w peer@^1.0.2`
Expected: `package.json`, `apps/client/package.json`, and `pnpm-lock.yaml` updated cleanly while keeping `"version": "2.0.0"`.

- [ ] **Step 2: Write failing unit tests in `apps/client/test/p2p-coop-client.test.ts`**

Build an in-memory `FakePeerHub` implementing `PeerLikeFactory` (no mocks of game logic — real `CoopRoomAuthority`, real wire framing) and test:
1. `resolvePeerRuntimeOptions` defaults to `debug: 0`, STUN servers (`stun:stun.l.google.com:19302`, `stun:stun.cloudflare.com:3478`), parses `?peerSignal=http://127.0.0.1:9123/peerjs` -> `{ host: '127.0.0.1', port: 9123, path: '/peerjs', secure: false }`, and parses `VITE_TURN_URLS` + `VITE_TURN_USERNAME` + `VITE_TURN_CREDENTIAL`.
2. `createPeerHostRoom` + 3 `joinPeerClientRoom` peers: P1..P4 receive `coop_welcome` with slots `1..4`, inputs from P2 move P2 in 30Hz `world_snapshot` delivered to all 4 players.
3. Auto-retry when auto-generated `roomCode` hits `'unavailable-id'` on first attempt -> succeeds on second code.
4. Invalid Room Code (`'peer-unavailable'`) rejects `joinPeerClientRoom` with localized Vietnamese message containing the code.
5. Authoritative close codes over DataChannel: Host `kick_player` on slot 2 delivers `'kicked_by_host'` and invokes P2 `onLeave(4001)`; mid-run join invokes `onLeave(4003)`; unexpected DataChannel drop without `__close__` invokes `onLeave(1006)` and re-joining with `reconnectToken` restores slot 2 (`reconnected: true`); Host `leave(true)` delivers `'host_disconnected'` + `onLeave(4000)` to P2..P4 and stops the `BackgroundTicker`.
6. `createBackgroundTicker` uses Worker when `Worker` + `Blob` + `URL.createObjectURL` exist, clamps deltaMs to `<= 100`, revokes object URL + terminates worker on `stop()`, and falls back to `setInterval` cleanly when `Worker` is absent.

- [ ] **Step 3: Run Vitest on `apps/client/test/p2p-coop-client.test.ts` to verify RED**

Run: `pnpm vitest run apps/client/test/p2p-coop-client.test.ts`
Expected: FAIL (cannot find modules `../src/net/p2p-coop-client.js` and `../src/net/background-ticker.js`).

- [ ] **Step 4: Implement `coop-room-connection.ts`, `background-ticker.ts`, and `p2p-coop-client.ts`**

Ensure `import('peerjs')` is loaded lazily inside default `peerFactory` so Node/Vitest unit tests never touch browser WebRTC globals unless real PeerJS is invoked in browser/E2E, and pass `{ debug: 0, ... }` to `new Peer(...)` so PeerJS emits zero console warnings/errors.

- [ ] **Step 5: Run Vitest & client typecheck to verify GREEN**

Run: `pnpm --filter @ashen-pact/client typecheck && pnpm vitest run apps/client/test/p2p-coop-client.test.ts packages/shared/test/polish-p12-release-version.test.ts`
Expected: PASS (all tests green, manifests still `2.0.0`).

- [ ] **Step 6: Commit Task 2**

```bash
git add package.json apps/client/package.json pnpm-lock.yaml apps/client/src/net/coop-room-connection.ts apps/client/src/net/background-ticker.ts apps/client/src/net/p2p-coop-client.ts apps/client/test/p2p-coop-client.test.ts
git commit -m "feat(client): add PeerJS WebRTC Host/Client CoopRoomConnection and Web Worker ticker"
```

---

### Task 3: Sanctuary Online/LAN Co-op Guild Drawer, Smart Routing, i18n & `GameScene` Integration

**Files:**
- Modify: `packages/shared/src/i18n/vi.json`
- Modify: `packages/shared/src/i18n/en.json`
- Modify: `apps/client/src/ui/menu-dom-inputs.ts`
- Modify: `apps/client/src/ui/debug-overlay.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/game-scene/sanctuary-lobby-ui.ts`
- Modify: `apps/client/src/scenes/game-scene/input-and-network.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`
- Create: `apps/client/test/sanctuary-p2p-ui.test.ts`

**Interfaces:**
- Consumes: `parseCoopTargetInput`, `normalizeRoomCode`, `resolveWsEndpointUrl` from `@ashen-pact/shared`; `CoopRoomConnection`, `createPeerHostRoom`, `joinPeerClientRoom` from `apps/client/src/net/*`.
- Produces / Updates:
  - `MENU_IP_MAX_LEN = 96` in `apps/client/src/ui/menu-dom-inputs.ts`.
  - `GameSceneInitData`: add optional `coopBackend?: 'colyseus' | 'p2p'` and `preferredCoopTransport?: 'p2p' | 'lan'`.
  - `GameScene`: `public coopBackend: 'colyseus' | 'p2p' = 'colyseus'`, `public preferredCoopTransport: 'p2p' | 'lan' = 'lan'`, `public hasManualTransportChoice = false`, `public lanServerAvailable = false`, `public room?: CoopRoomConnection`.
  - `GameDebugState` (`debug-overlay.ts`): add `coopBackend: 'colyseus' | 'p2p'` and `preferredCoopTransport: 'p2p' | 'lan'`.
  - `resolveSanctuaryWsUrl(hostPortOrUrl)` delegates to `resolveWsEndpointUrl` so `wss://` / `https://` domains without explicit ports never get `:2567` appended.
  - `normalizeServerHostPortDisplay` preserves bare Room Codes (`7K9M2P`) and portless `https://` / `wss://` domains without appending `:2567`, while still formatting bare IPv4 (`192.168.1.25` -> `192.168.1.25:2567`).

- [ ] **Step 1: Write failing unit tests in `apps/client/test/sanctuary-p2p-ui.test.ts`**

Test:
1. `MENU_IP_MAX_LEN === 96`, allowing full Vercel invite URLs (`https://ashen-pact.vercel.app/?join=7K9M2P&p2p=1`) to be pasted into `applyMenuInputEdit` without truncation.
2. `resolveBootGameSceneInitData` & `GameScene.init` routing:
   - `/?join=7K9M2P&p2p=1` -> `coopMode: 'join'`, `coopBackend: 'p2p'`, `roomId: '7K9M2P'`.
   - On `https://ashen-pact.vercel.app/` (`protocol === 'https:'`): Solo boot sets `preferredCoopTransport === 'p2p'` and `serverHostPort === ''`; `/?join=7K9M2P` (even without `&p2p=1`) routes to `coopBackend === 'p2p'`, `requestedRoomId === '7K9M2P'`.
   - On `http://192.168.1.25:2567/?coop=host&server=192.168.1.25:2567`: routes to `coopBackend === 'colyseus'`.
3. `switchSanctuaryCoopMode` smart routing:
   - In `preferredCoopTransport === 'p2p'` mode, clicking Host starts `coopMode: 'host', coopBackend: 'p2p'`; clicking Join with `'7k9m2p'` or `'https://ashen-pact.vercel.app/?join=7K9M2P&p2p=1'` starts `coopMode: 'join', coopBackend: 'p2p', roomId: '7K9M2P'`; clicking Join with empty input stays in Solo and sets localized `disconnectReason` prompt.
   - Even in `'lan'` mode, typing `'7K9M2P'` and clicking Join auto-routes to `coopBackend: 'p2p', roomId: '7K9M2P'`.
4. `connectCoopRoomImpl` in P2P mode:
   - Populates `hostInviteUrl = 'https://ashen-pact.vercel.app/?join=7K9M2P&p2p=1'` when Host opens room `7K9M2P`.
   - Calls `exitToSoloSanctuary` with error message if `joinPeerClientRoom` rejects (e.g. wrong Room Code).
   - Calls `room.leave(true)` immediately if `sceneSessionEpoch` increments while `createPeerHostRoom` / `joinPeerClientRoom` is in-flight.

- [ ] **Step 2: Run Vitest on `apps/client/test/sanctuary-p2p-ui.test.ts` to verify RED**

Run: `pnpm vitest run apps/client/test/sanctuary-p2p-ui.test.ts`
Expected: FAIL (`MENU_IP_MAX_LEN` is `28`, `coopBackend` / `preferredCoopTransport` undefined).

- [ ] **Step 3: Implement i18n keys, `MENU_IP_MAX_LEN = 96`, `GameScene` / `sanctuary-lobby-ui.ts` / `input-and-network.ts` P2P routing & reconnect, and `hud-hub-and-cards.ts` Online/LAN toggle + Room Code display**

Add bilingual keys under `ui.sanctuary` (`onlineModePill`, `lanModePill`, `roomCodeLabel`, `roomCodePlaceholder`, `p2pReadyStatus`, `hostOnlineBtn`, `joinOnlineBtn`, `onlineInviteHeader`, `enterRoomCodePrompt`, `roomNotFoundError`) in `vi.json` and `en.json` while keeping every existing key untouched. Keep `SANCTUARY_VERSION_BADGE = 'v2.0.0 · LAN'` untouched.

- [ ] **Step 4: Build `@ashen-pact/shared`, typecheck all packages, and run client & regression unit tests to verify GREEN**

Run: `pnpm --filter @ashen-pact/shared build && pnpm typecheck && pnpm vitest run apps/client/test/sanctuary-p2p-ui.test.ts apps/client/test/polish-p9b-menus-modals-settings.test.ts apps/client/test/custom-keybindings.test.ts packages/shared/test/polish-p12-release-version.test.ts`
Expected: PASS (all new and existing unit tests green).

- [ ] **Step 5: Commit Task 3**

```bash
git add packages/shared/src/i18n/vi.json packages/shared/src/i18n/en.json apps/client/src/ui/menu-dom-inputs.ts apps/client/src/ui/debug-overlay.ts apps/client/src/scenes/GameScene.ts apps/client/src/scenes/game-scene/sanctuary-lobby-ui.ts apps/client/src/scenes/game-scene/input-and-network.ts apps/client/src/scenes/game-scene/hud-hub-and-cards.ts apps/client/test/sanctuary-p2p-ui.test.ts
git commit -m "feat(client,i18n): wire Online P2P Room Code & invite links into Sanctuary Co-op Guild Drawer"
```

---

### Task 4: Real Multi-Browser WebRTC E2E Verification & Documentation Update

**Files:**
- Create: `tests/e2e/webrtc-p2p-coop.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `PeerServer` from `peer`, `window.__GAME_DEBUG__`, `window.__GAME_COOP_SEND__`, `window.__GAME_FORCE_RECONNECT__`, `[data-testid="menu-ip-input"]`, and `?peerSignal=http://127.0.0.1:<port>/peerjs`.
- Produces: End-to-end Playwright suite proving 3 separate Chromium instances connect peer-to-peer via WebRTC `RTCPeerConnection` + `RTCDataChannel` using only the 6-character Room Code and invite URL without touching Colyseus `:2567`.

- [ ] **Step 1: Write `tests/e2e/webrtc-p2p-coop.spec.ts` exercising real Chromium WebRTC DataChannels across 3 browser contexts**

Start an ephemeral `PeerServer` on an available localhost port (`port` resolved via `net.Server` or `ExpressPeerServer` on `http.createServer` listening on `127.0.0.1:0`), open 3 isolated browser contexts on `http://localhost:5173`:
- **P1 (Host):** Opens `http://localhost:5173/?coop=host&p2p=1&name=HostP1&peerSignal=http://127.0.0.1:<peerPort>/peerjs`, waits for `serverConnected === true`, `coopBackend === 'p2p'`, and a 6-character `coopRoomId` + `hostInviteUrl` containing `?join=<CODE>&p2p=1`.
- **P2 (Invite Link Joiner):** Opens the generated invite URL (`&name=BanBeP2&peerSignal=...`), verifies `coopPlayerCount >= 2` and `playerSlot === 2`.
- **P3 (Sanctuary UI Room Code Joiner):** Opens `http://localhost:5173/?test=1&peerSignal=...`, presses `KeyI`, types P1's 6-character `<CODE>` into `[data-testid="menu-ip-input"]`, clicks the Join button (or triggers Join), and verifies all 3 browsers reach `coopPlayerCount === 3`, `slots === [1, 2, 3]`, non-duplicate characters, Ready + Floor 1 dungeon transition (`inHub === false`, `currentFloor === 1`), P2 `window.__GAME_FORCE_RECONNECT__()` recovery within 30s, P1 Host exit returning P2 & P3 to Solo Sanctuary (`coopMode === 'solo'`, `inHub === true`), and `expect(consoleErrors).toEqual([])` + `expect(consoleWarnings).toEqual([])`.

- [ ] **Step 2: Update `README.md` with a concise section explaining Online P2P Co-op on Vercel (6-char Room Code + Invite Link + optional `VITE_TURN_*` env vars)**

Keep all existing `v2.0.0` strings in `README.md` required by `polish-p12-release-version.test.ts` intact.

- [ ] **Step 3: Run ESLint, Typecheck, Build, and Playwright E2E (`webrtc-p2p-coop.spec.ts`, `phase4.spec.ts`, `polish-p9b.spec.ts`)**

Run: `pnpm typecheck && pnpm lint && pnpm build && npx playwright test tests/e2e/webrtc-p2p-coop.spec.ts tests/e2e/polish-p9b.spec.ts tests/e2e/phase4.spec.ts`
Expected: PASS (all 3 E2E suites green with zero console errors/warnings).

- [ ] **Step 4: Commit Task 4**

```bash
git add tests/e2e/webrtc-p2p-coop.spec.ts README.md
git commit -m "test(e2e,docs): verify multi-browser WebRTC P2P co-op and document Vercel online setup"
```
