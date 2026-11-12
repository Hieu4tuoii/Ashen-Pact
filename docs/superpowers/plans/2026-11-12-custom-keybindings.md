# Customizable Keybindings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build full customizable keybindings in the Settings Controls tab with `localStorage` persistence, conflict auto-swap, reserved-key guards, live zero-restart Phaser runtime input rebinding, dynamic HUD/world keycap labels, and Playwright E2E verification.

**Architecture:** Extract a pure, Phaser-independent keybinding registry (`apps/client/src/ui/keybindings.ts`) integrated into `GraphicsSettingsManager` (`ashen_pact_graphics_settings.keybindings`) and bilingual `vi.json`/`en.json` catalogs. Upgrade `ModalOverlayManager.buildControlsTabContent` into an interactive `7 × 2` capture grid using a capture-phase `window` `keydown` listener, and wire `GameScene` + HUD/prompt modules to hot-swap Phaser `Key` bindings and keycap hints via `graphicsSettings.onChange`.

**Tech Stack:** TypeScript Strict, Phaser 3.90 WebGL, `@ashen-pact/shared` i18n, Vitest, Playwright 1080p Headless Chromium.

**Spec:** `docs/superpowers/specs/2026-11-12-custom-keybindings-design.md`

## Global Constraints

- Modal card geometry in `apps/client/src/ui/settings-modal.ts` MUST preserve `cardW = 660, cardH = 444, cardX = 150, cardY = 48`, tab bar `cy = 108` (`cx = 247, 402, 558, 713`), header divider `y = 130`, footer divider `y = 440`, Restore Defaults button at `(534, 466)` (`1068, 932` in `1080p`), and Close `[Esc]` button at `(704, 466)` (`1408, 932` in `1080p`).
- `apps/client/src/ui/keybindings.ts` MUST NOT depend on `Phaser.Input.Keyboard.KeyCodes` at runtime because unit tests mock `KeyCodes` as `{}`; map canonical codes to numeric `keyCode`s (`65..90`, `32`, `16`, `17`, `18`, `9`, `8`, `37..40`, punctuation) in a self-contained table.
- All 14 `KeybindActionId` values in exact display order: `'moveUp'`, `'moveDown'`, `'moveLeft'`, `'moveRight'`, `'skill'`, `'dash'`, `'interact'`, `'swapWeapon'`, `'reload'`, `'dropWeapon'`, `'toggleMap'`, `'ping'`, `'emote'`, `'coopPanel'`.
- `vi.json` and `en.json` MUST maintain 100% identical key-tree parity.
- Every `GraphicsSettingsState` copy (`constructor`, `resetDefaults`, `resetKeybindings`) MUST deep-clone `keybindings: { ...DEFAULT_KEYBINDINGS }` so mutating state never mutates `DEFAULT_GRAPHICS_SETTINGS.keybindings`.
- `Escape` while actively capturing (`rebindingAction !== null`) MUST cancel the pending capture in `window` capture phase (`preventDefault()` + `stopImmediatePropagation()`) without closing `ModalOverlayManager`; a subsequent `Escape` when `rebindingAction === null` closes the modal.
- Runtime rebinding in `input-and-network.ts` MUST detach named `.on('down')` / `.on('up')` listeners via `.off(...)` and `.reset?.()` rather than calling `kb.removeKey(..., true)`, preserving shared `KeyboardPlugin.keys` instances.
- When running multi-file Vitest on `@ashen-pact/shared`, always pass `--no-file-parallelism`.

## Review Focus

1. **Synthetic `KeyboardEvent`s missing `event.code` (only `event.key` provided, or vice versa) and left/right modifier variants (`ShiftLeft` vs `ShiftRight`):** `normalizeKeyEventToBindingCode` must normalize both `code` and `key` fallbacks and unify `ShiftLeft`/`ShiftRight` → `'Shift'`, `ControlLeft`/`ControlRight` → `'Control'`, `AltLeft`/`AltRight` → `'Alt'`. (Pinned in Task 1 tests.)
2. **Corrupted or duplicate `localStorage` `keybindings` JSON (e.g., two actions manually edited to `'KeyE'`, reserved `'Digit1'`, or missing new keys from older game versions):** `sanitizeKeybindings` must deterministically repair invalid/duplicate entries using unclaimed defaults so all 14 actions remain valid and pairwise unique. (Pinned in Task 1 tests.)
3. **Dangling capture-phase `window` `keydown` listener if user clicks another Settings tab, clicks Restore Defaults, clicks Close, or scene shuts down mid-capture:** `ModalOverlayManager` must cancel capture and detach the `window` listener on `selectTab`, `open`, `close`, `resetDefaults`, and `destroy`. (Pinned in Task 2 tests.)
4. **Repeated live rebinding (`E -> F -> E` or swapping `Shift <-> Q`) causing duplicate `.on('down')` callbacks or firing Hub utility modals (`O`, `K`, `C`, `L`, `V`, `G`) when a gameplay action is bound to those letters:** `syncSceneKeybindings` must detach prior listeners cleanly so one keypress queues exactly once, and Hub/debug letter shortcuts must yield when bound to a gameplay action. (Pinned in Task 2 tests.)
5. **Default `[E]` keycap backward compatibility vs wider custom labels (`'Space'`, `'Shift'`, `'Tab'`):** `resolveInteractPromptSpec` must return `keycapText: 'E'` when default and dynamically expand world/HUD pill chip width when rebound to multi-character keys. (Pinned in Task 2 & Task 3 tests.)

---

### Task 1: Pure Keybinding Registry, `GraphicsSettingsManager` Persistence, Debug State & Bilingual i18n

**Files:**
- Create: `apps/client/src/ui/keybindings.ts`
- Modify: `apps/client/src/ui/graphics-settings.ts`
- Modify: `apps/client/src/ui/debug-overlay.ts`
- Modify: `packages/shared/src/i18n/vi.json`
- Modify: `packages/shared/src/i18n/en.json`
- Create: `apps/client/test/custom-keybindings.test.ts`

**Interfaces:**
- Consumes: `SupportedLocale`, `i18n` from `@ashen-pact/shared`
- Produces:
  - From `apps/client/src/ui/keybindings.ts`:
    - `KEYBIND_ACTION_IDS: readonly ['moveUp', 'moveDown', 'moveLeft', 'moveRight', 'skill', 'dash', 'interact', 'swapWeapon', 'reload', 'dropWeapon', 'toggleMap', 'ping', 'emote', 'coopPanel']`
    - `type KeybindActionId = (typeof KEYBIND_ACTION_IDS)[number]`
    - `type KeybindingsMap = Record<KeybindActionId, string>`
    - `DEFAULT_KEYBINDINGS: Readonly<KeybindingsMap>`
    - `type NormalizedKeyCapture = { status: 'valid'; code: string; displayLabel: string; keyCode: number } | { status: 'cancel' } | { status: 'reserved'; displayLabel: string } | { status: 'unsupported'; displayLabel: string }`
    - `type KeybindUpdateResult = { ok: true; changed: boolean; keybindings: KeybindingsMap; swappedWith: KeybindActionId | null; boundCode: string; previousCode: string } | { ok: false; reason: 'reserved' | 'unsupported'; displayLabel: string; keybindings: KeybindingsMap; swappedWith: null }`
    - `normalizeBindingCode(rawCode: string): string | null`
    - `normalizeKeyEventToBindingCode(event: { code?: string; key?: string; keyCode?: number }): NormalizedKeyCapture`
    - `getKeyCodeForBinding(code: string): number`
    - `getKeybindDisplayLabel(code: string): string`
    - `getActionDisplayLabel(action: KeybindActionId, bindings?: Readonly<KeybindingsMap>): string`
    - `applyKeybindingChange(current: Readonly<KeybindingsMap>, action: KeybindActionId, rawCode: string): KeybindUpdateResult`
    - `sanitizeKeybindings(raw: unknown): KeybindingsMap`
    - `isBindingCodeUsed(bindings: Readonly<KeybindingsMap>, code: string): boolean`
    - `shouldCaptureBrowserKey(code: string): boolean`
    - `serializeKeybindingsHash(bindings: Readonly<KeybindingsMap>): string`
  - On `GraphicsSettingsState` & `GraphicsSettingsManager` (`apps/client/src/ui/graphics-settings.ts`):
    - `state.keybindings: KeybindingsMap`
    - `getKeybindings(): Readonly<KeybindingsMap>`
    - `getActionKeyLabel(action: KeybindActionId): string`
    - `setKeybinding(action: KeybindActionId, code: string): KeybindUpdateResult`
    - `resetKeybindings(): void`
    - `resetDefaults(): void` (also resets `keybindings` to `{ ...DEFAULT_KEYBINDINGS }`)
  - On `GameDebugState` (`apps/client/src/ui/debug-overlay.ts`):
    - `rebindingAction: KeybindActionId | null` (default `null`)
  - In `vi.json` & `en.json` under `ui.controls`:
    - `rebindHint`, `listeningPrompt`, `swappedNotice`, `reservedNotice`, `cancelledNotice`, and `actions.{moveUp,moveDown,moveLeft,moveRight,skill,dash,interact,swapWeapon,reload,dropWeapon,toggleMap,ping,emote,coopPanel}`

- [ ] **Step 1: Write the failing unit tests in `apps/client/test/custom-keybindings.test.ts`**

Test cases to write:
1. `defines 14 default keybindings with self-contained numeric keyCodes and display labels without Phaser KeyCodes` — asserts `KEYBIND_ACTION_IDS` length `14`, `DEFAULT_KEYBINDINGS.interact === 'KeyE'`, `getKeyCodeForBinding('KeyW') === 87`, `getKeyCodeForBinding('Shift') === 16`, `getKeyCodeForBinding('Space') === 32`, `getKeyCodeForBinding('Tab') === 9`, `getKeyCodeForBinding('ArrowUp') === 38`, `getKeybindDisplayLabel('ArrowUp') === '↑'`, `getKeybindDisplayLabel('Control') === 'Ctrl'`, `shouldCaptureBrowserKey('Tab') === true`, `shouldCaptureBrowserKey('KeyE') === false`.
2. `normalizes DOM KeyboardEvents including ShiftLeft/ShiftRight, code-less synthetic key events, Escape cancel, and reserved Digit/Enter/Function keys` — asserts `ShiftLeft` & `ShiftRight` both normalize to `{ status: 'valid', code: 'Shift', keyCode: 16, displayLabel: 'Shift' }`; `{ key: 'f' }` (no `code`) normalizes to `'KeyF'`; `{ code: 'Escape', key: 'Escape' }` returns `{ status: 'cancel' }`; `Digit1`, `Numpad2`, `Enter`, `F5`, `CapsLock`, `MetaLeft` return `{ status: 'reserved', ... }`.
3. `auto-swaps conflicting gameplay actions atomically and rejects reserved codes without mutating bindings` — rebinding `dash` (`'Shift'`) to `'KeyQ'` (owned by `swapWeapon`) sets `dash = 'KeyQ'`, `swapWeapon = 'Shift'`, `swappedWith = 'swapWeapon'`; rebinding to `'Digit1'` returns `ok: false, reason: 'reserved'`.
4. `sanitizes corrupted, legacy ShiftLeft, missing, or duplicate localStorage keybindings into 14 pairwise-unique bindings` — passes `{ interact: 'KeyF', moveUp: 'KeyF', dash: 'ShiftLeft', skill: 'Digit1' }` to `sanitizeKeybindings` and verifies `interact === 'KeyF'`, `dash === 'Shift'`, `skill === 'Space'`, and all 14 values in `Object.values(result)` are unique (`new Set(Object.values(result)).size === 14`).
5. `persists custom keybindings in GraphicsSettingsManager localStorage, notifies listeners, resets via resetDefaults(), and maintains VI/EN i18n parity` — exercises `new GraphicsSettingsManager()`, `setKeybinding('interact', 'KeyF')`, verifies `ashen_pact_graphics_settings` JSON in `window.localStorage`, reloads a fresh `GraphicsSettingsManager()` to confirm `'KeyF'` persists, calls `resetDefaults()` to confirm `'KeyE'` is restored without mutating `DEFAULT_GRAPHICS_SETTINGS.keybindings`, checks `initGlobalDebugState().rebindingAction === null`, and verifies all `ui.controls.actions.*` keys exist in both `vi` and `en` locales.

- [ ] **Step 2: Run Vitest to verify RED failure**

Run: `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @ashen-pact/client exec vitest run test/custom-keybindings.test.ts`
Expected: FAIL (`Cannot find module '../src/ui/keybindings.js'`)

- [ ] **Step 3: Implement `keybindings.ts`, `graphics-settings.ts`, `debug-overlay.ts`, and `vi.json`/`en.json` (+ rebuild `@ashen-pact/shared` if needed)**

Implement the exact exported interfaces above:
- In `packages/shared/src/i18n/vi.json` & `en.json`: add identical keys under `ui.controls` (`rebindHint`, `listeningPrompt`, `swappedNotice`, `reservedNotice`, `cancelledNotice`, and `actions` object with all 14 `KeybindActionId` keys) while keeping all existing `ui.controls.*` keys untouched. Run `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @ashen-pact/shared build` so `@ashen-pact/client` sees updated shared dist JSON if imported via dist.
- In `apps/client/src/ui/keybindings.ts`: implement pure registry, `normalizeKeyEventToBindingCode`, `applyKeybindingChange`, `sanitizeKeybindings`, `isBindingCodeUsed`, `shouldCaptureBrowserKey`, `serializeKeybindingsHash`.
- In `apps/client/src/ui/graphics-settings.ts`: add `keybindings: KeybindingsMap` to `GraphicsSettingsState` and `DEFAULT_GRAPHICS_SETTINGS`, deep-copy `keybindings` on init/reset, load via `sanitizeKeybindings(parsed.keybindings)`, and add `getKeybindings()`, `getActionKeyLabel()`, `setKeybinding()`, `resetKeybindings()`.
- In `apps/client/src/ui/debug-overlay.ts`: add `rebindingAction: KeybindActionId | null` (`null` initial value) to `GameDebugState`.

- [ ] **Step 4: Run tests and typecheck to verify GREEN**

Run:
`COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @ashen-pact/shared exec vitest run --no-file-parallelism test/polish-p12-release-version.test.ts && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @ashen-pact/client exec vitest run test/custom-keybindings.test.ts test/polish-p9a-design-system-hud.test.ts test/polish-p9b-menus-modals-settings.test.ts && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm typecheck`
Expected: PASS (0 errors, all tests green)

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/shared/src/i18n/vi.json packages/shared/src/i18n/en.json apps/client/src/ui/keybindings.ts apps/client/src/ui/graphics-settings.ts apps/client/src/ui/debug-overlay.ts apps/client/test/custom-keybindings.test.ts
git commit -m "feat(settings): add customizable keybinding registry, persistence, and bilingual i18n"
```

---

### Task 2: Interactive Controls Tab UI, Live `GameScene` Rebinding & Dynamic HUD/World Keycap Hints

**Files:**
- Modify: `apps/client/src/ui/settings-modal.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts`
- Modify: `apps/client/src/scenes/game-scene/input-and-network.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-micro-reload-bar.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`
- Modify: `apps/client/src/scenes/game-scene/interact-prompt.ts`
- Modify: `apps/client/test/custom-keybindings.test.ts`

**Interfaces:**
- Consumes: Task 1 exports from `apps/client/src/ui/keybindings.ts` and `graphicsSettings`
- Produces:
  - From `apps/client/src/ui/settings-modal.ts`:
    - `export interface ControlsActionRowBounds { action: KeybindActionId; index: number; col: number; row: number; x: number; y: number; w: number; h: number; cx: number; cy: number; keyPillCx: number; keyPillCy: number; keyPillW: number; keyPillH: number }`
    - `export function getControlsActionRowBounds(indexOrAction: number | KeybindActionId, cardX?: number, cardY?: number): ControlsActionRowBounds`
    - `ModalOverlayManager.getRebindingAction(): KeybindActionId | null`
    - `ModalOverlayManager.startRebinding(action: KeybindActionId): void`
    - `ModalOverlayManager.cancelRebinding(showNotice?: boolean): void`
  - From `apps/client/src/scenes/game-scene/input-and-network.ts`:
    - `export function syncSceneKeybindings(scene: GameScene): void`
  - From `apps/client/src/scenes/game-scene/interact-prompt.ts`:
    - `InteractPromptSpec.keycapText: string` (defaults to `graphicsSettings.getActionKeyLabel('interact')`, i.e., `'E'` when default, or `options?.keycapText`)

- [ ] **Step 1: Extend `apps/client/test/custom-keybindings.test.ts` with failing UI, live runtime input, and HUD/prompt keycap tests**

Add unit tests covering:
1. `computes non-overlapping 7x2 Controls tab row bounds strictly inside card body (y=136..434) and manages capture lifecycle on Escape, conflict swap, reserved key, tab switch, and close` — instantiates `ModalOverlayManager` with a lightweight mock Phaser scene + `window` event target, opens `'controls'`, verifies all 14 `getControlsActionRowBounds` fit inside `[174..786] × [165..380]` without pairwise overlap, calls `startRebinding('interact')` (`window.__GAME_DEBUG__.rebindingAction === 'interact'`), dispatches capture `KeyboardEvent('keydown', { code: 'Digit1', cancelable: true })` (stays open with reserved feedback and `preventDefault()` called), dispatches `KeyboardEvent('keydown', { code: 'Escape', cancelable: true })` (cancels capture while `isOpen() === true`), starts rebinding `'dash'` and dispatches `{ code: 'KeyQ', cancelable: true }` (auto-swaps `dash = 'KeyQ'`, `swapWeapon = 'Shift'`, `rebindingAction === null`), and verifies `selectTab('audio')` / `close()` / `destroy()` clean up active capture listeners.
2. `hot-swaps GameScene Phaser Key bindings via syncSceneKeybindings without duplicate listeners and guards Hub letter shortcuts when bound` — creates a mock `KeyboardPlugin` with `Key` emitters, runs `setupKeyboardBindingsImpl.call(scene)`, rebinds `interact` `'KeyE' -> 'KeyF'` and `dash` `'Shift' <-> 'KeyQ'`, calls `syncSceneKeybindings(scene)`, fires `'KeyF'` once and verifies `scene.interactQueued === true` once (and firing old `'KeyE'` does NOT set `interactQueued`), rebinds `'KeyF' -> 'KeyE'` and verifies `'KeyE'` fires once (zero duplicate listeners), and verifies binding an action to `'KeyO'` suppresses the Hub `'keydown-O'` modal trigger while unpaused.
3. `propagates custom key labels into resolveInteractPromptSpec, formatWeaponCadenceHudLabel, and computeWeaponSalvageHudState while keeping default 'E'/'R'/'X' unchanged` — checks default `'E'`, `'R'`, `'X'`, then sets `interact -> 'KeyF'`, `reload -> 'KeyC'`, `dropWeapon -> 'KeyB'` and verifies `resolveInteractPromptSpec(...).keycapText === 'F'`, `formatWeaponCadenceHudLabel` shows `[C]`, and `computeWeaponSalvageHudState` shows `[B]`, then resets defaults in `afterEach`.

- [ ] **Step 2: Run Vitest to verify RED failure**

Run: `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @ashen-pact/client exec vitest run test/custom-keybindings.test.ts`
Expected: FAIL (`getControlsActionRowBounds` / `syncSceneKeybindings` not exported yet)

- [ ] **Step 3: Implement interactive Controls tab, `syncSceneKeybindings`, `GameScene` subscription, and dynamic HUD/prompt key labels**

Implementation details:
- **`apps/client/src/ui/settings-modal.ts`:**
  - Export `getControlsActionRowBounds` (`cardX = 150, cardY = 48` defaults; `col = idx % 2`, `row = Math.floor(idx / 2)`, `x = cardX + 24 + col * 312`, `boxW = 300`, `boxH = 27`, `cy = cardY + 131 + row * 31`, `y = cy - boxH / 2`, `keyPillW = 76`, `keyPillH = 21`, `keyPillCx = x + 254`, `keyPillCy = cy`).
  - Add `rebindingAction: KeybindActionId | null = null`, `controlsFeedback: { text: string; tone: 'info' | 'success' | 'warn' } | null = null`, and capture-phase `window` `keydown` listener management (`attachCaptureListener` / `detachCaptureListener`).
  - On capture `keydown`: call `event.preventDefault()` and `event.stopImmediatePropagation()`; pass event to `normalizeKeyEventToBindingCode(event)`:
    - `'cancel'` → `cancelRebinding(true)` (sets info feedback `ui.controls.cancelledNotice`, keeps modal open, rebuilds).
    - `'reserved'` / `'unsupported'` → keep `rebindingAction` active (or show `ui.controls.reservedNotice` with `{ key: res.displayLabel }` in `'warn'` tone so player can immediately press another key!), play `'ui_hover'`, rebuild.
    - `'valid'` → call `graphicsSettings.setKeybinding(action, res.code)`, clear `rebindingAction = null`, detach capture listener, set `'success'` feedback (`ui.controls.swappedNotice` when `swappedWith !== null`, else confirmation), play `'ui_click'`, invoke `this.onLocaleChanged?.()`, and `this.rebuild()`.
  - Ensure `open()`, `selectTab()`, `close()`, `destroy()`, and the Restore Defaults button callback call `this.cancelRebinding(false)` (and clear `controlsFeedback` on `open`/`selectTab`/`close`).
  - Render in `buildControlsTabContent`:
    1. Top Status/Instruction Banner (`x = cardX + 24`, `y = cardY + 88`, `w = cardW - 48`, `h = 24`) showing listening prompt, feedback notice, or default `ui.controls.rebindHint`.
    2. `14` interactive action rows (`KEYBIND_ACTION_IDS`) with left localized action label (clamped to `maxW = 198px`) and right keycap pill (`[Key]` in `SOLAR_GOLD`, or `[ ... ]` with `CYAN_FROST` border when listening).
    3. Compact 2-line Elemental Reactions cheat-sheet panel at `x = cardX + 24, y = cardY + 338, w = cardW - 48, h = 47` (`y = 386..433`, cleanly above `y = 440` footer divider).
- **`apps/client/src/scenes/game-scene/input-and-network.ts`, `GameScene.ts`, `arena-tiles.ts`:**
  - Store reusable action listener callbacks on `GameScene` (or a `WeakMap<GameScene, SceneKeybindHandlers>`) in `setupKeyboardBindingsImpl` and delegate all 14 rebindable `Key` assignments + `.on('down')`/`.on('up')` wiring to `syncSceneKeybindings(this)`.
  - Guard `G`, `V`, `O`, `K`, `C`, `L`, `H`, `M` non-paused shortcuts with `!isBindingCodeUsed(graphicsSettings.getKeybindings(), 'KeyX')` when gameplay/Hub input is active (preserving `[O]`, `[H]`, `[M]` inside `pauseModalOpen` and Victory/Defeat modals!).
  - In `GameScene.ts` + `arena-tiles.ts`: add `unsubGraphicsSettings?: () => void`; subscribe in `createImpl` after `setupKeyboardBindings()` (`graphicsSettings.onChange(() => { syncSceneKeybindings(this); this.invalidateAllHudCaches(); })`) and unsubscribe in the `SHUTDOWN` handler!
- **Dynamic HUD & World Keycap Labels:**
  - `interact-prompt.ts`: widen `InteractPromptSpec.keycapText` to `string`, resolve `const keycapText = options?.keycapText ?? graphicsSettings.getActionKeyLabel('interact')`, include `renderSpec.keycapText` in `visuals.lastHash`, call `visuals.keyText.setText(renderSpec.keycapText)`, and compute `chipW = Math.max(14, Math.ceil(visuals.keyText.width + 8))`.
  - `hud-setup-and-pause.ts` & `hud-combat-and-coop.ts`: use `graphicsSettings.getActionKeyLabel('skill')`, `getActionKeyLabel('dash')`, and `getActionKeyLabel('interact')` for `skillLabelText`, `dashLabelText`, centered `drawKeyChip` behind Skill/Dash (`cx = -352` and `cx = -308`), empty weapon slot `[E] Equip` / `[E] Nhặt`, and include `serializeKeybindingsHash(gState.keybindings)` in `abilityHash` and `weaponHash`.
  - `hud-micro-reload-bar.ts` & `hud-pact-and-forge-modals.ts`: use `graphicsSettings.getActionKeyLabel('reload')` (default `'R'`) and `graphicsSettings.getActionKeyLabel('dropWeapon')` (default `'X'`).
  - `hud-qol-and-minimap.ts` & `hud-hub-and-cards.ts`: use dynamic labels for `[Tab]` minimap header, `[Space]`/`[E]` Hub skill preview & weapon compare card (`chipW = Math.max(14, chipMetrics.width)`), `[I]` Co-op drawer toggle, and `[T+1..4]` quick emote buttons, including `serializeKeybindingsHash` in their dirty-check hashes.

- [ ] **Step 4: Run full unit test suites + typecheck + lint to verify GREEN**

Run:
`COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm typecheck && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @ashen-pact/client exec vitest run && npx eslint --max-warnings=0 "packages/*/src/**/*.ts" "apps/*/src/**/*.ts"`
Expected: PASS (all client unit tests green, 0 lint warnings/errors, 0 type errors)

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/client/src/ui/settings-modal.ts apps/client/src/scenes/GameScene.ts apps/client/src/scenes/game-scene/arena-tiles.ts apps/client/src/scenes/game-scene/input-and-network.ts apps/client/src/scenes/game-scene/hud-setup-and-pause.ts apps/client/src/scenes/game-scene/hud-combat-and-coop.ts apps/client/src/scenes/game-scene/hud-micro-reload-bar.ts apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts apps/client/src/scenes/game-scene/hud-hub-and-cards.ts apps/client/src/scenes/game-scene/interact-prompt.ts apps/client/test/custom-keybindings.test.ts
git commit -m "feat(controls): wire interactive Controls tab, live Phaser rebinding, and dynamic HUD key hints"
```

---

### Task 3: End-to-End Playwright Verification & Visual Layout Audit (`1920 × 1080`)

**Files:**
- Modify: `tests/e2e/polish-p9b.spec.ts`

**Interfaces:**
- Consumes: `window.__GAME_DEBUG__.rebindingAction`, `window.__GAME_DEBUG__.controlsModalOpen`, `window.__GAME_DEBUG__.settingsModalOpen`, `ashen_pact_graphics_settings.keybindings` in `localStorage`, and `getControlsActionRowBounds` coordinates (`2x` scale at `1920 × 1080`).
- Produces: Automated E2E regression coverage in `tests/e2e/polish-p9b.spec.ts` + 1080p visual screenshots of the new Controls tab in `output/playwright/` (git-ignored) inspected for crisp typography and zero overlap.

- [ ] **Step 1: Extend `tests/e2e/polish-p9b.spec.ts` with end-to-end custom keybinding assertions**

In `tests/e2e/polish-p9b.spec.ts` (inside the Tab 4 Controls flow around lines 146–159):
1. Click the `interact` row (`index = 6`, `col = 0, row = 3`, design center `(324, 272)` → `1080p` `(648, 544)`):
   - Assert `window.__GAME_DEBUG__.rebindingAction === 'interact'`.
   - Capture 1080p screenshot `output/playwright/controls-rebind-listening-vi.png` for visual audit.
   - Press `'Escape'` and assert `rebindingAction === null` AND `controlsModalOpen === true` (modal stays open!).
2. Click the `interact` row `(648, 544)` again and press `'KeyF'`:
   - Assert `rebindingAction === null` and `localStorage` `keybindings.interact === 'KeyF'`.
3. Test conflict auto-swap in E2E: click the `dash` row (`index = 5`, `col = 1, row = 2`, design center `(636, 241)` → `1080p` `(1272, 482)`) and press `'KeyQ'`:
   - Assert `localStorage` `keybindings.dash === 'KeyQ'` AND `keybindings.swapWeapon === 'Shift'`.
   - Capture 1080p screenshot `output/playwright/controls-rebind-swapped-vi.png`.
4. Close Settings (`Escape` → `settingsModalOpen === false`), test **real live gameplay input** in Sanctuary:
   - Position P1 beside the Ranger Hero Station (`hubStatues` `'ranger'`), press old `'KeyE'` and verify character remains `'vanguard'`, then press rebound `'KeyF'` and verify `window.__GAME_DEBUG__.playerCharacterId === 'ranger'`! Switch back to `'vanguard'` via `'KeyF'` on Vanguard's station and restore P1 start position.
5. Reopen Controls (`[K]`), click **Restore Defaults** `(1068, 932)`, verify `localStorage` `keybindings.interact === 'KeyE'` and `keybindings.dash === 'Shift'` and `uiScale === 1`, then close with `Escape`.

- [ ] **Step 2: Run `polish-p9b.spec.ts` and `phase7.spec.ts` via Playwright and visually inspect screenshots**

Run: `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 npx playwright test tests/e2e/polish-p9b.spec.ts tests/e2e/phase7.spec.ts`
Expected: `2/2` PASS (`0` console/page errors), and inspect `output/playwright/controls-rebind-listening-vi.png` + `output/playwright/controls-rebind-swapped-vi.png` + `docs/screenshots/menu-settings-en-1080p.png` to confirm zero text clipping or overlap.

- [ ] **Step 3: Commit Task 3**

```bash
git add tests/e2e/polish-p9b.spec.ts
git commit -m "test(e2e): verify interactive keybinding capture, auto-swap, live Sanctuary input, and restore defaults"
```
