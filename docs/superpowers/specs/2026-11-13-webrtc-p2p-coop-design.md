# WebRTC P2P Online Co-op (Vercel Serverless Ready) — Design Spec

**Date:** 2026-11-13  
**Status:** Approved for Autonomous Execution (User selected Option 1: Browser P2P WebRTC via `PeerJS`)  
**Scope:** `@ashen-pact/shared` (`CoopRoomAuthority`, `coop-addressing`, `qr.ts` Version 5-L, i18n `vi`/`en`), `@ashen-pact/server` (`CoopRoom` shared-authority delegation), `@ashen-pact/client` (`PeerJS` Host/Client transport, Web Worker 60Hz ticker, Sanctuary Online/LAN Guild Drawer, `GameScene` routing), and Playwright E2E multi-browser WebRTC verification.

---

## 1. Intent & Why

Deploying *Ashen Pact* to Vercel (`vercel.json`) publishes `apps/client/dist` as static HTTPS assets without a persistent Node.js backend. Previously, Co-op required running `apps/server` (`Colyseus` on TCP `2567`) on a shared Wi-Fi/LAN, and client URL helpers hardcoded `:2567` and truncated inputs at `28` characters (`MENU_IP_MAX_LEN = 28`).

This design enables **zero-cost, zero-backend Internet Co-op (1–4 players across different Wi-Fi networks and ISPs)** directly from the Vercel deployment using **WebRTC DataChannels (`PeerJS`)** while **100% preserving** existing local LAN Co-op (`Colyseus` / `AshenPact-Host.exe`). Because `@ashen-pact/shared` already contains the deterministic `60Hz` `WorldSim`, `30Hz` `encodeWorldSnapshot`, and client-side prediction/interpolation `NetworkTransport`, the Host player's browser runs the authoritative room simulation directly in-memory (stepped by a background-safe Web Worker timer) and streams quantized snapshots peer-to-peer to up to 3 friends via a 6-character **Room Code** or shareable Vercel invite URL (`https://<domain>/?join=<CODE>&p2p=1`).

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Cross-Network Online Co-op on Static Hosting (Vercel):** Host clicks **Host Online** in Sanctuary to open a room with an unambiguous 6-character alphanumeric **Room Code** (e.g. `7K9M2P`) and shareable QR / invite link (`https://<origin>/?join=7K9M2P&p2p=1`). Friends on any Wi-Fi or ISP join either by opening the invite link or entering the 6-character Room Code (or pasting the full invite link) in the Sanctuary Co-op Drawer.
- **Single Source of Truth (`CoopRoomAuthority`):** Extract the pure authoritative room controller into `@ashen-pact/shared` so Browser P2P Host and `apps/server` (`CoopRoom`) share identical slot assignment (`1..4`), non-duplicate hero rules, 60Hz simulation / 30Hz snapshot broadcast, mid-run join rejection (`4003`), full-room rejection (`4002`), kick (`4001`), host-disconnect (`4000`), 30-second `reconnectToken` grace recovery, and debug command gating.
- **Background-Tab Resilience on Browser Host:** Drive the Browser Host's 60Hz authority loop via an inline `Blob` Web Worker (`BackgroundTicker`) with wall-clock delta clamping (`<= 100ms`) so friends never freeze when the Host Alt-Tabs to Discord/Zalo/Messenger to share the invite link.
- **NAT Traversal Ready (STUN + Configurable TURN):** Configure Google & Cloudflare STUN servers out of the box plus optional Vite/runtime TURN credentials (`VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`) for strict 4G/corporate Symmetric NATs, and optional signaling override (`?peerSignal=...` / `VITE_PEER_HOST`) for offline CI/E2E testing.
- **Seamless Coexistence with Colyseus LAN:** Keep 100% backward compatibility with `AshenPact-Host.exe`, `pnpm host`, `phase4.spec.ts`, and `polish-p9b.spec.ts`. Raise `MENU_IP_MAX_LEN` from `28` to `96`, fix `resolveSanctuaryWsUrl` so `wss://` / `https://` domains without explicit ports do not get `:2567` appended, and upgrade `generateQrMatrix` (`qr.ts`) with ISO/IEC 18004 Version 5-L (`37×37`, up to `106` UTF-8 bytes) so long Vercel preview URLs encode cleanly without truncation.

### Non-Goals
- Host migration when P1 closes their browser tab mid-run (consistent with existing LAN Host disconnect behavior: `4000` returns teammates cleanly to Solo Sanctuary with a disconnect banner).
- Public matchmaking / global room browser (rooms are private by 6-character code / link).

### Anti-Goals
- Emitting any `console.warn` or `console.error` from `PeerJS` (`debug: 0` strictly enforced) or opening PeerJS connections during Solo play or Colyseus LAN sessions.
- Changing `SANCTUARY_VERSION_BADGE = 'v2.0.0 · LAN'` literal in `sanctuary-lobby-ui.ts` (pinned by `polish-p12-release-version.test.ts`), altering `SOLO_COOP_INPUT_LOCAL_BOUNDS` (`data-testid="menu-name-input"` / `data-testid="menu-ip-input"`), or breaking any existing Vitest / Playwright test.

---

## 3. Approaches Considered

1. **Approach 1 (Selected): Shared `CoopRoomAuthority` + `PeerJS` WebRTC DataChannel (`CoopRoomConnection` Adapter) + Web Worker Ticker**
   - *Pros:* 100% free forever on Vercel alone; zero server cold-starts; low P2P latency (`~15–35ms` within Vietnam); zero duplicate gameplay networking code because `GameScene` binds to a unified `CoopRoomConnection` interface implemented by both Colyseus `Room` and `PeerHostRoom` / `PeerClientRoom`.
   - *Cons:* Requires Host tab to remain open (mitigated against background throttling via Web Worker ticker) and optional free TURN credentials for ~10% Symmetric NAT networks.
2. **Approach 2: Free Cloud Colyseus Backend (Render / Koyeb) + Vercel Frontend**
   - *Pros:* Central server avoids P2P NAT edge cases.
   - *Cons:* Free tiers spin down after 15 minutes of inactivity (`30–50s` cold start) and throttle CPU on 60Hz simulations. Rejected per user choice.
3. **Approach 3: Local PC Server + `cloudflared` Tunnel**
   - *Pros:* Minimal code change.
   - *Cons:* Requires Host to run a CLI command locally every session rather than hosting directly from the Vercel web app. Rejected per user choice.

---

## 4. Technical Design

### 4.1 Shared Authoritative Controller & Addressing (`@ashen-pact/shared`)

- **`packages/shared/src/protocol/coop-room-authority.ts`:**
  - `CoopAuthorityPeer`: `{ readonly sessionId: string; send(type: string, payload: unknown): void; close(code: number): void }`.
  - `CoopRoomAuthority`: encapsulates `WorldSim`, `FixedTimestepLoop(60)`, `playersBySession`, `disconnectedByToken`, `step(deltaMs)`, `joinPeer(peer, options)`, `handleMessage(sessionId, type, payload)`, `leavePeer(sessionId, consented)`, `broadcastImmediateSnapshot()`, and `dispose()`.
  - `apps/server/src/rooms/CoopRoom.ts` wraps `CoopRoomAuthority`, forwarding Colyseus `onCreate`, `onJoin`, `onMessage('*', ...)`, `onLeave`, and `onDispose` while updating `CoopRoomState` (`tick`, `seed`, `playerCount`, `inHub`, `hostName`) and logging `[CoopRoom] Ignored debug command ...` on server debug rejections.
- **`packages/shared/src/protocol/coop-addressing.ts`:**
  - Alphabet: `ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'` (32 unambiguous chars, length `6`).
  - `generateRoomCode(randomFn?: () => number): string` -> 6-char uppercase code (e.g. `7K9M2P`).
  - `normalizeRoomCode(raw: string): string | null` -> trims whitespace, strips optional `p2p:` / `ap-` prefix and `-` separators, uppercases, and validates `^[A-Z0-9]{4,12}$` (rejecting strings containing `.`, `:`, `/`).
  - `roomCodeToPeerId(roomCode: string): string` -> `'ashen-pact-v2-room-' + normalized.toLowerCase()`.
  - `parseCoopTargetInput(rawInput: string, opts: { pageProtocol?: string; pageOrigin?: string; preferredTransport?: 'p2p' | 'lan' })`:
    - Parses full pasted P2P invite URLs (`https://.../?join=7K9M2P&p2p=1` or HTTPS `?join=7K9M2P` without `?server=`) -> `{ kind: 'p2p', roomCode: '7K9M2P' }`.
    - Parses full pasted LAN/Colyseus invite URLs (`http://192.168.1.25:2567/?join=abc` or `?server=...`) -> `{ kind: 'colyseus', wsUrl, hostPortDisplay, roomId }`.
    - Parses bare Room Codes (`7K9M2P`, `ap-7k9m2p`) -> `{ kind: 'p2p', roomCode: '7K9M2P' }`.
    - Parses IPv4 / `localhost` / `ws://` / `wss://` / domain endpoints -> `{ kind: 'colyseus', wsUrl, hostPortDisplay }` (appending `:2567` ONLY for bare IPv4 / `localhost` without port; preserving port `443` / `80` on `wss://` / `https://` domains without explicit port).
    - Empty input -> `{ kind: 'empty' }`.
- **`packages/shared/src/core/qr.ts`:**
  - Add ISO/IEC 18004 Version 5-L (`{ version: 5, size: 37, dataCodewords: 108, ecCodewords: 26, alignmentCenter: 30 }`, up to `106` UTF-8 bytes) to `QR_VERSIONS` so URLs of `54..78` bytes use Version 4-L and `79..106` bytes use Version 5-L without truncation.

### 4.2 Browser WebRTC P2P Transport & Background Ticker (`@ashen-pact/client`)

- **`apps/client/src/net/coop-room-connection.ts`:**
  - Defines `CoopRoomConnection` (`roomId`, `reconnectionToken?`, `send`, `onMessage`, `onLeave`, `leave`) compatible with both Colyseus `Room` and P2P rooms.
- **`apps/client/src/net/background-ticker.ts`:**
  - `createBackgroundTicker(intervalMs: number, onStep: (deltaMs: number) => void): { stop(): void }`.
  - Spawns an inline `Blob` `Worker` posting ticks every `intervalMs` (`SIM_STEP_MS`), computing clamped wall-clock `deltaMs = clamp(now - lastNow, 1, 100)`, with clean fallback to `globalThis.setInterval` when `Worker` / `Blob` / `URL.createObjectURL` is unavailable, and full `worker.terminate()` + `URL.revokeObjectURL()` cleanup on `stop()`.
- **`apps/client/src/net/p2p-coop-client.ts`:**
  - Resolves PeerJS options (`resolvePeerRuntimeOptions`): defaults to PeerJS public cloud (`0.peerjs.com:443`, `secure: true`, `debug: 0`) with STUN (`stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302`, `stun:stun.cloudflare.com:3478`) + optional env TURN (`VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`), and supports `?peerSignal=http://host:port/path` or `window.__ASHEN_PACT_PEER_OPTIONS__` for deterministic local E2E testing.
  - **Envelope Protocol over `DataConnection`:**
    - Client -> Host on `open`: `{ t: '__join__', opts: { name, characterId, reconnectToken } }`.
    - Regular messages (bidirectional): `{ t: string, p?: unknown }`.
    - Graceful client leave: `{ t: '__leave__', consented: boolean }` before closing `DataConnection`.
    - Authoritative close with reason code (`4000..4003`): Host sends `{ t: '__close__', code: number }` before closing `DataConnection` so Client invokes `onLeave(code)` with exact Colyseus close-code parity.
  - **`createPeerHostRoom(options)`:**
    - Generates 6-char `roomCode` (or uses valid custom code), registers `Peer(roomCodeToPeerId(roomCode))` (auto-retrying up to 3 times with a fresh random code on `'unavailable-id'` when code was auto-generated).
    - Instantiates `CoopRoomAuthority` (`isDebugEnabled: () => isDebugUiEnabled() || isTestHooksEnabled()`), attaches local loopback P1 (`0ms` overhead), starts `BackgroundTicker`, accepts incoming `DataConnection`s, and on `room.leave()` broadcasts `host_disconnected` + `{ t: '__close__', code: 4000 }`, stops ticker, disposes authority, and destroys `Peer`.
  - **`joinPeerClientRoom(options)`:**
    - Opens anonymous `Peer(options)`, connects `peer.connect(roomCodeToPeerId(roomCode), { reliable: true })`, sends `{ t: '__join__', opts }` on channel open, resolves `CoopRoomConnection` once connected (with 10s timeout and clear Vietnamese error message on `'peer-unavailable'` / timeout).
    - Supports `forceCoopReconnect()` seamlessly using stored `roomCode` + `reconnectToken` within the 30s grace window.

### 4.3 Sanctuary Co-op Guild Drawer, Routing & UX (`@ashen-pact/client`)

- **`MENU_IP_MAX_LEN = 96`** in `apps/client/src/ui/menu-dom-inputs.ts` so full invite URLs, WSS URLs, and Room Codes paste cleanly without truncation.
- **`GameScene` & Boot Routing (`GameScene.ts`, `sanctuary-lobby-ui.ts`, `input-and-network.ts`, `hud-hub-and-cards.ts`):**
  - New `GameScene` fields: `coopBackend: 'colyseus' | 'p2p' = 'colyseus'`, `preferredCoopTransport: 'p2p' | 'lan' = 'lan'`, `lanServerAvailable = false`, `p2pRoomCode: string | null = null`.
  - **Boot / Scene Init Resolution:**
    - `?p2p=1` or `data?.coopBackend === 'p2p'` -> `coopBackend = 'p2p'`.
    - `?join=<val>` without `?server=`: if `?p2p=1`, or `window.location.protocol === 'https:'`, or `<val>` has `p2p:` prefix -> `coopBackend = 'p2p'`, `requestedRoomId = normalizeRoomCode(val)`. If on `http:` without `?p2p=1` and without `?server=`, `connectCoopRoomImpl` probes `/api/host-info` (with short timeout): if `/api/host-info` responds ok, joins local Colyseus (`phase4.spec.ts` compatibility); if `/api/host-info` fails/404s (e.g. static Vite preview / static host) and `normalizeRoomCode(val)` is valid, automatically falls back to P2P Join!
    - In Solo Sanctuary: `preferredCoopTransport` initializes to `'p2p'` when `window.location.protocol === 'https:'` (Vercel!), and updates to `'p2p'` if `fetchHostLanInfo` fails (no local LAN server running) unless user manually selected `'lan'` or entered a custom LAN IP. When switching into `'p2p'` Solo mode without a custom user input, `serverHostPort` clears to `''` so the input box shows a crisp placeholder for entering a 6-character Room Code without `127.0.0.1:2567` clutter.
  - **Solo Sanctuary Drawer (`hud-hub-and-cards.ts`):**
    - Keeps exact `SOLO_COOP_DRAWER_W = 304`, `SOLO_COOP_DRAWER_H = 212`, and `SOLO_COOP_INPUT_LOCAL_BOUNDS` (`name` & `ip`).
    - Adds compact **`[🌐 Online]` / `[📡 LAN]`** mode pill in the header row next to `Ẩn [I]`.
    - In **`🌐 Online`** mode: input label reads `Mã Phòng` / `Room Code` (with subtle placeholder hint when empty), status reads `● P2P Online`, left button reads `🌐 Tạo Phòng` / `🌐 Host Online` (starts P2P Host; if user typed a valid 6-char code, uses it, otherwise generates a random 6-char code), right button reads `🔗 Vào Phòng` / `🔗 Join Code` (parses input via `parseCoopTargetInput`: joins P2P code, or if empty shows a brief disconnect/info banner prompting for a Room Code, or if user pasted a LAN/WSS address routes to Colyseus).
    - In **`📡 LAN`** mode: preserves existing LAN labels & buttons, while `🔗 Vào Phòng LAN` also auto-detects if the user pasted a 6-character P2P Room Code or P2P URL and routes to P2P seamlessly!
  - **Connected Co-op Invite Panel (`hud-hub-and-cards.ts` & `updateHostInviteUrlImpl`):**
    - When `coopBackend === 'p2p'`: displays `Mã Phòng: <CODE>` (`Room Code: <CODE>`) in place of `IP LAN: ...`, generates `hostInviteUrl = "${origin}${pathname}?join=${code}&p2p=1"`, renders its ISO QR matrix, and copies that URL on **Copy Invite Link**.
  - **Connection Failure Recovery (`connectCoopRoomImpl`):**
    - When `coopBackend === 'p2p'` fails to open or join (e.g. invalid/closed Room Code `'peer-unavailable'` or 10s timeout), cleanly calls `exitToSoloSanctuary(this, reason)` instead of leaving the player stranded in an unconnected room.

---

## 5. Verification Strategy

1. **Unit Tests (`Vitest`):**
   - `packages/shared/test/coop-room-authority.test.ts`: 1–4P slot allocation, non-duplicate hero enforcement & toggle, 60Hz->30Hz snapshot cadence, mid-run `4003` & full-room `4002` rejection, Host kick `4001`, Host leave `4000`, 30s `reconnectToken` grace recovery, debug command gate, and `qr.ts` Version 5-L encoding up to 106-byte Vercel URLs.
   - `packages/shared/test/coop-addressing.test.ts`: unambiguous 6-char code generation, `normalizeRoomCode`, `parseCoopTargetInput` across bare codes, pasted Vercel URLs, LAN IPs, `wss://` domains (no `:2567` port bug!), and `MENU_IP_MAX_LEN = 96`.
   - `apps/client/test/p2p-coop-client.test.ts`: deterministic in-memory fake PeerJS transport testing `PeerHostRoom` + `PeerClientRoom` handshake, P1 loopback + P2..P4 DataChannels, auto-retry on `'unavailable-id'`, `'peer-unavailable'` clean rejection, close-code framing (`4000..4003` vs `1006` reconnect), and `BackgroundTicker` Web Worker lifecycle/cleanup.
2. **End-to-End Tests (`Playwright`):**
   - `tests/e2e/webrtc-p2p-coop.spec.ts`: spins up a local `PeerServer` on an ephemeral localhost port (zero external internet needed in headless Chromium), opens 3 separate browser contexts on the client, creates an Online P2P room on P1 (`🌐 Tạo Phòng`), joins P2 via the generated Vercel-style invite URL (`/?join=<CODE>&p2p=1`) and P3 by typing `<CODE>` into `[data-testid="menu-ip-input"]` and clicking `🔗 Vào Phòng`, verifies real Chromium `RTCPeerConnection` + `RTCDataChannel` sync in Sanctuary, hero selection, Ready & Floor 1 combat snapshots, 30s P2 reconnect, and P1 Host leave returning P2/P3 to Sanctuary with zero `console.error` / `console.warn`.
   - Existing `tests/e2e/phase4.spec.ts` and `tests/e2e/polish-p9b.spec.ts` pass 100% unchanged.
