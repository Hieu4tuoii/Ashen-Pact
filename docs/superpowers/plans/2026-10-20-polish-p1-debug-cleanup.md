# Phase P1 — Debug Mode & Debug UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the dual-flag debug system (`debugUi` and `testHooks` in `apps/client/src/core/debug-flag.ts`), `Ctrl+Shift+D` runtime toggle with toast, server-side `--debug` / `ASHEN_PACT_DEBUG=1` command gating and `debugAllowed` handshake, standalone C# launcher `--host` preservation + `start-host-debug.bat`, clean all debug UI/text/hotkeys from player-facing Menu/Hub/HUD when `debugUi` is off, and verify both release modes (default no-debug vs `--debug`) in E2E + Visual Gate.

**Architecture:**
1. **Client Debug Flags (`apps/client/src/core/debug-flag.ts`):**
   - `debugUi`: `Boolean(import.meta.env?.DEV) || urlDebug === '1' || localStorage['ashen_pact_debug'] === '1'`, except when `?debug=0` which **forces `debugUi = false`** even in dev (unless toggled at runtime via `Ctrl+Shift+D`).
   - `effectiveDebugUi(isCoop)`: in solo/Menu returns `isDebugUiEnabled()`; in co-op (`coopMode === 'host' || 'join'`) returns `isDebugUiEnabled() && isServerDebugAllowed()`.
   - `testHooks`: `isDebugUiEnabled() || (Boolean(import.meta.env?.DEV) && urlTestHooks === '1') || isServerDebugAllowed()`. In a default release build (not dev, no `--debug` on server, no `?debug=1`), `testHooks` is strictly `false`.
   - `Ctrl+Shift+D` global keydown listener calls `ev.preventDefault()`, toggles `debugUi` state, persists `'1'` / `'0'` to `localStorage['ashen_pact_debug']`, shows a non-intrusive DOM toast (`"Debug ON"` / `"Debug OFF"`), and notifies registered scene callbacks so `MenuScene`, `GameScene`, and `DebugOverlay` update immediately.
2. **Read-Only `window.__GAME_DEBUG__` & Conditional `window.__GAME_*` Hooks:**
   - Internal client code mutates the module-scoped `rawDebugState` returned by `initGlobalDebugState()`.
   - When `isTestHooksEnabled()` is `false`, `window.__GAME_DEBUG__` is a read-only `Proxy` over `rawDebugState` (blocking external mutation while keeping all telemetry fields readable for auto-quality and E2E), and `window.__GAME_TRANSPORT__`, `window.__GAME_COOP_SEND__`, `window.__PHASER_GAME__`, `window.__GALLERY_*`, etc. are NOT exposed on `window`.
   - When `isTestHooksEnabled()` becomes `true` (at boot or when server reports `debugAllowed: true`), `GameScene` / `ArtGalleryScene` expose their `window.__GAME_*` / `window.__GALLERY_*` hooks.
3. **Server Debug Gate (`apps/server/src/debug-gate.ts`, `HelloRoom.ts`, `CoopRoom.ts`, `index.ts`):**
   - `isServerDebugEnabled()` checks `process.argv.includes('--debug') || process.env.ASHEN_PACT_DEBUG === '1'`.
   - `HelloRoom` (`hello_welcome`), `CoopRoom` (`coop_welcome`), `/api/health`, and `/api/host-info` include `debugAllowed: isServerDebugEnabled()`.
   - When `!isServerDebugEnabled()`, `CoopRoom` ignores `debug_cmd`, `set_god_mode`, `skip_waves`, and `set_bot_autoplay`, logs a warning `console.warn(...)`, and sends a `debug_rejected` message back to the sender.
   - When `--host` and `--debug` are both active, `apps/server/src/index.ts` opens `http://localhost:${activePort}/?coop=host&debug=1`.
4. **Launcher & Packaging (`tools/package-release.ts`, `README.md`):**
   - Fix C# `AshenPactHostLauncher` so `--host` is always included even when extra CLI arguments (such as `--debug` or `--port 2578`) are passed.
   - Generate `start-host-debug.bat` alongside `start-host.bat`.
   - Document "Bật chế độ debug" in `README.md`.

**Tech Stack:** TypeScript 5.x, Phaser 3.85+, Colyseus 0.15, Vitest, Playwright.

**Spec Reference:** `docs/superpowers/specs/2026-10-20-polish-v0.2.0-design.md` (Section 3.1 & Phase P1).

---

## Global Constraints
- `pnpm verify` must pass 100% (`typecheck`, `lint`, `test`, `build`, `e2e`).
- 0 console errors/warnings in E2E.
- Keep all files `< 1000` lines.
- **Ruling on URL Scene Staging (`?biome=`, `?hub=`, `?scene=gallery`, `?gallery=1`, `?scene=game`):** Gated on `isDebugUiEnabled() || isTestHooksEnabled()` so that normal release players (and `?debug=0` without `testHooks=1`) cannot access `ArtGalleryScene` or URL shortcuts, while Playwright visual capture (`?debug=0&testHooks=1`) can stage any scene with player-facing (`debugUi = false`) UI.
- **Ruling on `[R] Ng.Tố` (`cycleImbueElement`):** Per `docs/GDD.md` Section 3.1 & 4, manual element cycling via `R`/`F6` is not a player gameplay mechanic (Elementalist cycles via skill passive). Therefore `[R] Ng.Tố` button and `R`/`F6` keys are gated on `debugUi`.

---

### Task 1: Capture P1 `before` Screenshots, Implement `debug-flag.ts` (TDD) & Clean Client Debug UI/Hooks

**Files:**
- Create: `apps/client/src/core/debug-flag.ts`
- Create: `apps/client/test/debug-flag.test.ts`
- Modify: `apps/client/src/vite-env.d.ts` (or add `/// <reference types="vite/client" />` in `debug-flag.ts`)
- Modify: `apps/client/src/ui/debug-overlay.ts`
- Modify: `apps/client/src/scenes/PreloadScene.ts`
- Modify: `apps/client/src/scenes/MenuScene.ts`
- Modify: `apps/client/src/scenes/ArtGalleryScene.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts`
- Modify: `apps/client/src/scenes/game-scene/input-and-network.ts`

- [ ] **Step 1: Capture Phase P1 `before` screenshots**
  Run:
  `pnpm shots -- --phase p1 --label before --scenes menu,hub-solo,b1-start-room,b1-combat`
  Confirm `docs/screenshots/polish-p1/before/` contains `menu.png`, `hub-solo.png`, `b1-start-room.png`, `b1-combat.png`.

- [ ] **Step 2: Write failing unit tests in `apps/client/test/debug-flag.test.ts` (TDD RED)**
  Test:
  - `resolveDebugFlags({ isDev: true, search: '', storageDebug: null, serverDebugAllowed: false })` → `debugUi: true, testHooks: true`
  - `resolveDebugFlags({ isDev: true, search: '?debug=0', storageDebug: '1', serverDebugAllowed: false })` → `debugUi: false, testHooks: false` (`?debug=0` forces `debugUi` off even in dev)
  - `resolveDebugFlags({ isDev: true, search: '?debug=0&testHooks=1', storageDebug: null, serverDebugAllowed: false })` → `debugUi: false, testHooks: true`
  - `resolveDebugFlags({ isDev: false, search: '', storageDebug: null, serverDebugAllowed: false })` → `debugUi: false, testHooks: false` (default release build)
  - `resolveDebugFlags({ isDev: false, search: '?testHooks=1', storageDebug: null, serverDebugAllowed: false })` → `debugUi: false, testHooks: false` (`?testHooks=1` alone does nothing in release build!)
  - `resolveDebugFlags({ isDev: false, search: '', storageDebug: null, serverDebugAllowed: true })` → `debugUi: false, testHooks: true`
  - `resolveDebugFlags({ isDev: false, search: '?debug=1', storageDebug: null, serverDebugAllowed: true })` → `debugUi: true, testHooks: true, effectiveCoopDebugUi: true`
  - `resolveDebugFlags({ isDev: false, search: '?debug=1', storageDebug: null, serverDebugAllowed: false })` → `debugUi: true, effectiveCoopDebugUi: false` (in co-op, debug UI requires both client and server debug enabled)
  - Runtime toggle via `toggleDebugUi()` flips `debugUi`, writes `'1'`/`'0'` to storage, and notifies listeners.

- [ ] **Step 3: Implement `apps/client/src/core/debug-flag.ts` and pass unit tests (TDD GREEN)**
  - Export `resolveDebugFlags`, `isDebugUiEnabled`, `isEffectiveDebugUiEnabled(isCoop?: boolean)`, `isTestHooksEnabled`, `setServerDebugAllowed`, `isServerDebugAllowed`, `toggleDebugUi`, `onDebugFlagsChanged`, `installDebugHotkeyListener`, and `showDebugToast`.
  - Ensure `Ctrl+Shift+D` (`(ev.ctrlKey || ev.metaKey) && ev.shiftKey && (ev.key === 'D' || ev.key === 'd' || ev.code === 'KeyD')`) calls `ev.preventDefault()`, toggles `debugUi`, saves `localStorage.setItem('ashen_pact_debug', next ? '1' : '0')`, displays `"Debug ON"` / `"Debug OFF"` toast, and notifies all active scenes.

- [ ] **Step 4: Gate `DebugOverlay`, `PreloadScene`, `MenuScene`, `ArtGalleryScene`, and `GameScene` HUD/hotkeys/hooks**
  - `debug-overlay.ts`:
    - Keep `rawDebugState` module-private and return `rawDebugState` from `initGlobalDebugState()`.
    - Expose `syncWindowDebugProxy()` so `window.__GAME_DEBUG__` is a read-only `Proxy` when `!isTestHooksEnabled()` and direct `rawDebugState` when `isTestHooksEnabled()`.
    - In `DebugOverlay`, only allow `F1` toggle and visible container when `isEffectiveDebugUiEnabled(state.coopMode !== 'solo')` is true; if `debugUi` turns off, hide `this.container` and set `state.overlayVisible = false`.
  - `PreloadScene.ts`:
    - Call `installDebugHotkeyListener()`.
    - Gate URL scene shortcuts (`?scene=gallery`, `?gallery=1`, `?scene=game`, `?hub=1`, `?biome=`) on `isDebugUiEnabled() || isTestHooksEnabled()`. If neither is enabled, ignore those params and start `MenuScene` (or `GameScene` if `?coop=host|join` / `?join=` / `isHostServerPort`).
  - `ArtGalleryScene.ts`:
    - In `create()`, if `!(isDebugUiEnabled() || isTestHooksEnabled())`, immediately redirect `this.scene.start('MenuScene')` and return.
    - Gate `window.__GALLERY_*` hooks on `isTestHooksEnabled()`.
  - `MenuScene.ts`:
    - Gate the `artGallery` (`Bộ Sưu Tập`) button, `toggleAnim` (`Đổi Hoạt Ảnh`) button, and the bottom verification footer (`footer` box, `VIETNAMESE_VERIFICATION_STRING` text, `debugHintText`) on `isDebugUiEnabled()`.
    - When `isDebugUiEnabled()` is false, hide those elements (`setVisible(false)` / `disableInteractive()`) and subscribe to `onDebugFlagsChanged` (cleaned up on `SHUTDOWN`) so pressing `Ctrl+Shift+D` shows/hides them live!
  - `GameScene` (`arena-tiles.ts`, `hud-setup-and-pause.ts`, `hud-combat-and-coop.ts`, `input-and-network.ts`):
    - Extract `syncGameTestHooks(scene: GameScene)` in `arena-tiles.ts`: only attach `window.__PHASER_GAME__`, `window.__GAME_TRANSPORT__`, `window.__GAME_STRESS_TEST__`, `window.__GAME_SET_QUALITY__`, `window.__GAME_SET_LIGHTING__`, `window.__GAME_BOT_AUTOPLAY__`, `window.__GAME_SET_WIFI_PROFILE__`, `window.__GAME_TRIGGER_LAG_SPIKE__`, `window.__GAME_FORCE_RECONNECT__`, `window.__GAME_COOP_SEND__` when `isTestHooksEnabled()` is true, and delete them when `isTestHooksEnabled()` is false or on `SHUTDOWN`.
    - When `biome` or `hub` URL params are read in `arena-tiles.ts:114-137`, only honor `?biome=` and `?hub=1` when `isDebugUiEnabled() || isTestHooksEnabled()`.
    - In `hud-setup-and-pause.ts` and `hud-combat-and-coop.ts`:
      - Check `const debugUi = isEffectiveDebugUiEnabled(this.coopMode !== 'solo');`.
      - When `debugUi` is false:
        - Hide `this.elementBtnText`, `this.qualityBtnText`, and `galleryBtn` (`setVisible(false)`, `disableInteractive()`).
        - Set `this.statusText` to clean player controls (`'WASD: Chạy · Chuột: Bắn/Kỹ năng · Shift: Dash · E: Tương tác · Tab: Bản đồ'` in VI, `'WASD: Move · Mouse: Shoot/Skill · Shift: Dash · E: Interact · Tab: Map'` in EN) — no `R: Ng.Tố`, no `G: Đồ Họa`, no `F1-F7: Debug`.
        - In `statsLineText`, omit `DPS` and `VIETNAMESE_VERIFICATION_STRING` when `debugUi` is false (`Tầng 1/2 (Khởi Đầu) · Vàng 0 · Đợt 1 · Dash Sẵn Sàng · KN Sẵn Sàng`).
      - Subscribe to `onDebugFlagsChanged` in `GameScene` so toggling `Ctrl+Shift+D` or receiving `serverDebugAllowed` refreshes HUD visibility and test hooks immediately.
    - In `input-and-network.ts`:
      - Gate debug hotkeys `R`, `G`, `F2`, `F3`, `F4`, `F5`, `F6`, `F7`, `F8`, `F9` on `isEffectiveDebugUiEnabled(this.coopMode !== 'solo')`.

---

### Task 2: Server `--debug` / `ASHEN_PACT_DEBUG=1` Gate, Launcher `--host` Fix, `start-host-debug.bat`, README & E2E Tests

**Files:**
- Create: `apps/server/src/debug-gate.ts`
- Modify: `packages/shared/src/index.ts` (add `debugAllowed?: boolean` to `HelloRoomMessage`)
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/rooms/HelloRoom.ts`
- Modify: `apps/server/src/rooms/CoopRoom.ts`
- Modify: `apps/client/src/scenes/game-scene/input-and-network.ts` (read `debugAllowed` from `/api/host-info`, `hello_welcome`, `coop_welcome`)
- Modify: `tools/package-release.ts`
- Modify: `README.md`
- Modify: `packages/shared/test/phase4-coop.test.ts` (or new unit test verifying server debug gate)
- Modify: `tests/e2e/phase8.spec.ts`
- Modify: `tests/e2e/helpers/visual-scenes.ts`

- [ ] **Step 1: Implement server debug gate (`apps/server/src/debug-gate.ts`, `HelloRoom.ts`, `CoopRoom.ts`, `index.ts`)**
  - Create `apps/server/src/debug-gate.ts` exporting `isServerDebugEnabled(): boolean` (`process.argv.includes('--debug') || process.env.ASHEN_PACT_DEBUG === '1'`).
  - Note: in dev/test runs (`pnpm dev`, `pnpm e2e`), pass `--debug` or `ASHEN_PACT_DEBUG=1` in `apps/server/package.json` `"dev"` script (`"ASHEN_PACT_DEBUG=1 tsx watch src/index.ts"` or `process.env.NODE_ENV !== 'production'` / `--debug`) — wait: let's check Spec 3.1 carefully:
    "**Server:** cờ CLI `--debug` hoặc env `ASHEN_PACT_DEBUG=1`. Khi tắt, server bỏ qua `debug_cmd`/`set_god_mode`/`skip_waves`/`set_bot_autoplay` và log cảnh báo. Thông báo `debugAllowed` cho client trong `hello_welcome` (HelloRoom.ts:54); UI debug ở co-op chỉ hiện khi cả client lẫn server đều bật. Khi có `--debug` và `--host`, server mở trình duyệt với `&debug=1`."
    And:
    "e2e phase0–7 chạy trên dev nên tự có debug. Phase8 (bản release) phải thêm `&debug=1` vào URL, spawn exe với `--debug` **và đặt env `ASHEN_PACT_NO_OPEN_BROWSER=1`**"
    So in `apps/server/package.json`, `"dev": "tsx watch src/index.ts --debug"` (or in `playwright.config.ts` / `apps/server/package.json` dev script pass `--debug`), while the standalone release `server-bundle.cjs` / `AshenPact-Host.exe` runs `src/index.ts` WITHOUT `--debug` unless `--debug` or `ASHEN_PACT_DEBUG=1` is explicitly passed!
  - In `CoopRoom.ts`:
    - Include `debugAllowed: isServerDebugEnabled()` in `coop_welcome`.
    - In `skip_waves`, `set_bot_autoplay`, `set_god_mode`, and `debug_cmd` handlers: if `!isServerDebugEnabled()`, call `console.warn(\`[CoopRoom] Ignored debug command "\${type}" because server debug mode is disabled.\`)`, send `client.send('debug_rejected', { type })`, and return without mutating `this.sim`!
  - In `HelloRoom.ts`:
    - Include `debugAllowed: isServerDebugEnabled()` in `hello_welcome`.
  - In `apps/server/src/index.ts`:
    - Include `debugAllowed: isServerDebugEnabled()` in `/api/health` and `/api/host-info`.
    - When `process.argv.includes('--host')`: open `http://localhost:${activePort}/?coop=host${isServerDebugEnabled() ? '&debug=1' : ''}`.

- [ ] **Step 2: Client `debugAllowed` synchronization in `input-and-network.ts`**
  - In `fetchHostLanInfoImpl`, `connectHelloRoomImpl` (`hello_welcome`), and `bindCoopRoomHandlersImpl` (`coop_welcome`), read `debugAllowed` and call `setServerDebugAllowed(Boolean(msg.debugAllowed))`.

- [ ] **Step 3: Update C# Launcher & Batch Scripts in `tools/package-release.ts` and `README.md`**
  - In `buildLauncherCSharpSource()` (`tools/package-release.ts:221-232`):
    Always ensure `--host` is passed to `server-bundle.cjs` unless `--no-host` is specified:
    check if `args` already contains `--host`; if not, prepend `" --host"` before forwarding all `args[i]`.
  - In `writeBatchScripts(releaseDir)`:
    Also write `start-host-debug.bat` which launches `AshenPact-Host.exe --host --debug %*` (or `runtime\node.exe server-bundle.cjs --host --debug %*`).
  - Add a clear Vietnamese section `"## Bật Chế Độ Debug (Dành Cho Nhà Phát Triển / Kiểm Thử)"` in `README.md` explaining `Ctrl+Shift+D`, `?debug=1`, `--debug` CLI flag, `ASHEN_PACT_DEBUG=1`, and `start-host-debug.bat`.

- [ ] **Step 4: Update `tests/e2e/phase8.spec.ts` to test both Default Release (No Debug) and `--debug` Release**
  - Rebuild the release package (`packageRelease({ skipBuild: false })`) in `phase8.spec.ts` `beforeAll` so `release/AshenPact-v0.1.0-win-x64` has the updated client bundle, server bundle, `AshenPact-Host.exe`, and `start-host-debug.bat`.
  - **Test 1 (existing test, updated for `--debug`):** Spawn `RELEASE_EXE` with `['--port', String(RELEASE_PORT), '--debug']` and `ASHEN_PACT_NO_OPEN_BROWSER: '1'`, connect `pageHost` (`/?coop=host&debug=1...`) and `pageClient2` (`/?name=...&debug=1`), capture `docs/screenshots/polish-p1/after/release-debug-on.png`, and run the full Co-op Dungeon + Boss Victory verification.
  - **Test 2 (new test — Release Default No-Debug Verification):** Spawn `RELEASE_EXE` with `['--port', String(RELEASE_PORT + 1)]` (NO `--debug` flag, `ASHEN_PACT_NO_OPEN_BROWSER: '1'`), open `http://${primaryLanIp}:${RELEASE_PORT + 1}/?coop=host`, and verify:
    - `/api/host-info` reports `debugAllowed: false`.
    - `window.__GAME_TRANSPORT__`, `window.__GAME_COOP_SEND__`, `window.__GAME_STRESS_TEST__` are `undefined`.
    - `window.__GAME_DEBUG__` exists and is read-only (attempting to mutate `window.__GAME_DEBUG__.godMode = true` throws or fails to change `window.__GAME_DEBUG__.godMode`).
    - Pressing `F1`, `F2`, `G`, `R` does nothing (`overlayVisible === false`, `godMode === false`).
    - Connecting a raw Colyseus client to `coop_room` and sending `debug_cmd` (`{ cmd: 'god_mode_all', enabled: true }`) and `set_god_mode` (`{ godMode: true }`) receives `debug_rejected` and `godMode` remains `false` in snapshots!
    - Capture `docs/screenshots/polish-p1/after/release-default-no-debug.png` and `docs/screenshots/polish-p1/after/release-menu-no-debug.png`.

---

### Task 3: Phase P1 Visual Gate, Blind A/B Visual Reviewer & Phase Gate (`polish-p1`)

**Files:**
- Modify: `tests/e2e/helpers/visual-scenes.ts` (add `menu-debug-on` and `b1-hud-debug-on` scenes if needed)
- Create: `docs/screenshots/polish-p1/after/*`
- Create: `docs/screenshots/polish-p1/review.md`
- Modify: `docs/PROGRESS.md`, `docs/PHASES.md`

- [ ] **Step 1: Capture `after` screenshots for Phase P1**
  Run:
  `pnpm shots -- --phase p1 --label after --scenes menu,hub-solo,b1-start-room,b1-combat`
  Plus verify `release-default-no-debug.png` and `release-debug-on.png` from `phase8.spec.ts`.

- [ ] **Step 2: Blind A/B Visual Reviewer (`pro` model)**
  - Copy `before` and `after` images into a temporary blind review directory with randomized `version-A` / `version-B` labels (recording the mapping in `.superpowers/sdd/2026-10-20-polish-p1-debug-cleanup/ab-mapping.json`).
  - Dispatch independent `pro` `research` Visual Reviewer to inspect `menu`, `hub-solo`, `b1-start-room`, `b1-combat`, plus `release-default-no-debug.png` and `release-debug-on.png` and verify:
    1. All debug text/buttons (`F1-F7: Debug`, `[Art Gallery]`, `[G] Đồ Họa`, `[R] Ng.Tố`, `DPS`, `Bộ Sưu Tập`, `Đổi Hoạt Ảnh`, Vietnamese test footer) are 100% gone in `?debug=0` and default release screenshots.
    2. `?debug=1` / `release-debug-on.png` retains full debug tools.
    3. Zero visual regressions.
  - Save the review to `docs/screenshots/polish-p1/review.md`.

- [ ] **Step 3: Run Phase Gate (`pnpm verify`) & Tag `polish-p1`**
  - Run `pnpm verify` (confirming 100% pass across all unit and E2E tests including the new release no-debug E2E test).
  - Update `docs/PROGRESS.md` and `docs/PHASES.md`, commit, and tag `git tag polish-p1`.
