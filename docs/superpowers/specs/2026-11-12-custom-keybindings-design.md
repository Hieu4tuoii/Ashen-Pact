# Customizable Keybindings (Tùy Chỉnh Phím Bấm) — Design Spec

**Date:** 2026-11-12
**Status:** Approved for Autonomous Execution
**Scope:** `@ashen-pact/shared` (i18n VI/EN) & `@ashen-pact/client` (`keybindings`, `graphics-settings`, `settings-modal`, `GameScene` runtime input & HUD key hints) + E2E verification

---

## 1. Goal

Upgrade the static read-only **Controls (`⌨ Điều khiển` / `⌨ Controls`)** tab inside `ModalOverlayManager` (`apps/client/src/ui/settings-modal.ts`) into a refined, Soul Knight / Enter the Gungeon / Hades-grade **Interactive Keybinding Customizer**, wired end-to-end into:

1. **Persistent Storage (`localStorage`):** Saved under `ashen_pact_graphics_settings.keybindings` with full schema sanitization and `Restore Defaults` (`Khôi Phục Mặc Định`) integration.
2. **Conflict-Safe Capture & Auto-Swap:** Clicking any action slot enters an amber/cyan listening state (`window` capture-phase `keydown`), cancels cleanly on `Escape` without closing the Settings modal, rejects reserved system/slot keys (`1–4`, `0–9`, `Enter`, `Escape`, `F1–F12`, meta/lock keys) with inline feedback, and **automatically swaps** duplicate bindings between gameplay actions so no action is ever left unbound.
3. **Zero-Restart Live Runtime Input (`GameScene`):** Changing any binding immediately updates `GameScene.keys` and `.on('down')` / `.on('up')` handlers in place via `graphicsSettings.onChange` without restarting the scene or breaking `software-gl.ts` substeps.
4. **Dynamic HUD & World Keycap Hints:** Skill/Dash HUD chips, Weapon Compare `[E]` pill, World Interact `[E]` prompt pill, Reload/Vent `[R]` bar text, Salvage `[X]` hold prompt, Minimap `[Tab]` header, Hub Skill Preview, and Co-op Invite Panel `[I]` / `[T+1..4]` labels dynamically display the player's customized key labels.

---

## 2. Rebindable Actions & Defaults (14 Actions, `7 × 2` Grid)

| # | `KeybindActionId` | `GameScene.keys` Slot | Default Code | Default Label | VI Label (`ui.controls.actions.*`) | EN Label (`ui.controls.actions.*`) |
|---|---|---|---|---|---|---|
| 1 | `moveUp` | `W` | `'KeyW'` | `'W'` | `Di chuyển Lên` | `Move Up` |
| 2 | `moveDown` | `S` | `'KeyS'` | `'S'` | `Di chuyển Xuống` | `Move Down` |
| 3 | `moveLeft` | `A` | `'KeyA'` | `'A'` | `Di chuyển Trái` | `Move Left` |
| 4 | `moveRight` | `D` | `'KeyD'` | `'D'` | `Di chuyển Phải` | `Move Right` |
| 5 | `skill` | `SPACE` | `'Space'` | `'Space'` | `Kỹ năng chủ động (+RMB)` | `Active Skill (+RMB)` |
| 6 | `dash` | `SHIFT` | `'Shift'` | `'Shift'` | `Lướt né đòn (Dash)` | `Dash (i-frames)` |
| 7 | `interact` | `E` | `'KeyE'` | `'E'` | `Tương tác / Nhặt / Cứu` | `Interact / Loot / Revive` |
| 8 | `swapWeapon` | `Q` | `'KeyQ'` | `'Q'` | `Đổi vũ khí (+Con lăn)` | `Swap Weapon (+Wheel)` |
| 9 | `reload` | `R` | `'KeyR'` | `'R'` | `Nạp đạn / Xả nhiệt` | `Reload / Vent Heat` |
| 10 | `dropWeapon` | `X` | `'KeyX'` | `'X'` | `Thả / Phân rã vũ khí` | `Drop / Salvage Weapon` |
| 11 | `toggleMap` | `TAB` | `'Tab'` | `'Tab'` | `Bản đồ Hầm ngục` | `Dungeon Map` |
| 12 | `ping` | `Z` | `'KeyZ'` | `'Z'` | `Ping đồng đội (+MMB)` | `Team Ping (+MMB)` |
| 13 | `emote` | `T` | `'KeyT'` | `'T'` | `Vòng biểu cảm (Giữ)` | `Emote Wheel (Hold)` |
| 14 | `coopPanel` | `I` | `'KeyI'` | `'I'` | `Bảng Tổ Đội Co-op` | `Co-op Guild Panel` |

---

## 3. Key Normalization, Reserved Keys & Conflict Resolution

### 3.1 Self-Contained Canonical Binding Table (`apps/client/src/ui/keybindings.ts`)
Unit tests mock `Phaser.Input.Keyboard.KeyCodes` as `{}` (`apps/client/test/polish-p9b-menus-modals-settings.test.ts:62`), so `keybindings.ts` owns a self-contained, zero-Phaser-dependency table mapping canonical binding codes to DOM/Phaser numeric `keyCode`s and concise keycap labels:
- Letters: `'KeyA'`..`'KeyZ'` (`65`..`90`, labels `'A'`..`'Z'`)
- Modifiers (left/right unified so either Shift/Ctrl/Alt works in Phaser `Key` `16`/`17`/`18`):
  - `'ShiftLeft'` / `'ShiftRight'` / `'Shift'` → `'Shift'` (`16`, label `'Shift'`)
  - `'ControlLeft'` / `'ControlRight'` / `'Control'` → `'Control'` (`17`, label `'Ctrl'`)
  - `'AltLeft'` / `'AltRight'` / `'Alt'` → `'Alt'` (`18`, label `'Alt'`)
- Navigation & Editing:
  - `'Space'` (`32`, `'Space'`), `'Tab'` (`9`, `'Tab'`), `'Backspace'` (`8`, `'Bksp'`)
  - `'ArrowUp'` (`38`, `'↑'`), `'ArrowDown'` (`40`, `'↓'`), `'ArrowLeft'` (`37`, `'←'`), `'ArrowRight'` (`39`, `'→'`)
- Punctuation:
  - `'Comma'` (`188`, `','`), `'Period'` (`190`, `'.'`), `'Slash'` (`191`, `'/'`), `'Semicolon'` (`186`, `';'`), `'Quote'` (`222`, `"'"`), `'BracketLeft'` (`219`, `'['`), `'BracketRight'` (`221`, `']'`), `'Backslash'` (`220`, `'\\'`), `'Minus'` (`189`, `'-'`), `'Equal'` (`187`, `'='`), `'Backquote'` (`192`, `` '`' ``)

### 3.2 Cancel & Reserved Keys
- **Cancel Active Capture:** `Escape` (`code === 'Escape' || key === 'Escape' || keyCode === 27`) → `{ status: 'cancel' }`. Cancels listening without mutating bindings and without closing `ModalOverlayManager`.
- **Reserved Keys (`{ status: 'reserved', displayLabel }`):**
  - `Digit0`–`Digit9`, `Numpad0`–`Numpad9` (reserved for Weapon Slots `1–2`, Blessing/Mutator/Pact choices `1–3`, and Quick Emotes `1–4`)
  - `Enter`, `NumpadEnter` (reserved for Pause Exit confirm & Victory/Defeat Replay)
  - `F1`–`F12` (reserved for Debug hotkeys `F2–F9` & browser function keys)
  - System/lock/navigation keys: `MetaLeft`, `MetaRight`, `OSLeft`, `OSRight`, `ContextMenu`, `CapsLock`, `NumLock`, `ScrollLock`, `PrintScreen`, `Pause`, `Insert`, `Delete`, `Home`, `End`, `PageUp`, `PageDown`
- **Unsupported Keys:** Any unmapped key returns `{ status: 'unsupported' }` and keeps the modal in listening state or displays a brief hint without corrupting state.

### 3.3 Auto-Swap Conflict Resolution & Storage Sanitization
- When binding `action` to valid `code`:
  - If `current[action] === code`: `{ ok: true, changed: false, ... }`.
  - If another `otherAction` currently owns `code`: atomically swap `next[action] = code` and `next[otherAction] = current[action]`, returning `swappedWith: otherAction`.
- `sanitizeKeybindings(raw)` validates arbitrary `localStorage` payloads and deterministically repairs missing, invalid, reserved, or duplicate entries using unclaimed `DEFAULT_KEYBINDINGS` values so all 14 actions are guaranteed valid and pairwise unique.

---

## 4. UI Layout & Modal Coordinate Invariants (`960 × 540` Design Space)

`ModalOverlayManager` (`660 × 444` card at `cardX = 150, cardY = 48`) preserves all existing tab and footer coordinates:
- Tab bar at `cy = 108` (`Audio` `247`, `Video` `402`, `Gameplay` `558`, `Controls` `713`).
- Header divider: `y = cardY + 82 = 130`.
- Footer divider: `y = cardY + cardH - 52 = 440`.
- Footer buttons: **Restore Defaults** at `(534, 466)` (`1068, 932` in `1080p`), **Close `[Esc]`** at `(704, 466)` (`1408, 932` in `1080p`).

Inside the Controls tab body (`y = 135..434`, `x = 174..786`):
1. **Top Status / Instruction Banner (`x = 174, y = 136, w = 612, h = 24`, center `cy = 148`):**
   - Idle: instruction text + `LMB` / `RMB` note.
   - Listening (`rebindingAction !== null`): highlighted `CYAN_FROST` / `SOLAR_GOLD` border showing which action is awaiting a key and `[Esc]` to cancel.
   - Swapped / Reserved / Cancelled feedback: color-coded inline confirmation banner.
2. **Interactive `7 × 2` Action Binding Grid (`y = 165..380`):**
   - `col = idx % 2`, `row = Math.floor(idx / 2)` (`idx = 0..13`).
   - `lx = cardX + 24 + col * 312` (`174` for Col 0, `486` for Col 1), `boxW = 300`, `boxH = 27`, row stride `31px`, row center `ly = cardY + 131 + row * 31` (`179, 210, 241, 272, 303, 334, 365`).
   - Export pure geometry helper `getControlsActionRowBounds(index: number)` returning `{ action, col, row, cx, cy, w, h, keyPillCx, keyPillCy, keyPillW, keyPillH }` in `960 × 540` space so unit tests and Playwright E2E tests click exact deterministic coordinates without magic numbers.
   - Each row has:
     - Left action title (`lx + 10`, `origin(0, 0.5)`, max width `198px` with automatic horizontal scale clamp so VI/EN labels never touch the key pill).
     - Right keycap pill (`keyPillX = lx + 216, w = 76, h = 21`, centered at `lx + 254, ly`), showing `[KeyLabel]` in `SOLAR_GOLD`, or `[ ... ]` in `CYAN_FROST` when `rebindingAction === action`.
     - Full-row interactive hit rectangle (`300 × 27`) with hover highlight + click-to-rebind.
3. **Compact Elemental Reactions Reference Strip (`x = 174, y = 386, w = 612, h = 47`):**
   - Preserves the 6 Elemental Reactions cheat-sheet in 2 crisp lines above the `y = 440` footer divider (`7px` clearance).
4. **Capture Lifecycle Cleanup:**
   - Capture-phase `window` `keydown` listener is detached whenever a rebind completes, is cancelled via `Escape`, or when `selectTab()`, `open()`, `close()`, `resetDefaults()`, or `destroy()` runs.
   - `window.__GAME_DEBUG__.rebindingAction` stays synchronized at all times (`null` when idle, `KeybindActionId` while listening).

---

## 5. Live `GameScene` Input & Shortcut Coexistence

1. **Reusable Action Rebinding (`syncSceneKeybindings` in `apps/client/src/scenes/game-scene/input-and-network.ts`):**
   - Named listener functions (`onDashDown`, `onSkillDown`, `onSwapDown`, `onInteractDown`, `onPingDown`, `onDropDown`, `onCoopPanelDown`, `onMapDown`, `onEmoteDown`, `onEmoteUp`, `onReloadDown`) are stored per scene setup.
   - `syncSceneKeybindings(scene)` detaches those named listeners from any previous `Key` objects (calling `prevKey.reset?.()` without destroying shared `Key` instances in `KeyboardPlugin.keys`), acquires each action's target `Key` via `kb.addKey(keyCode, shouldCaptureBrowserKey(code))`, updates `scene.keys.{W,S,A,D,SPACE,SHIFT,E,Q,R,X,TAB,Z,T,I}`, and re-attaches the named listeners.
   - `GameScene` subscribes to `graphicsSettings.onChange` in `createImpl` (and unsubscribes on `SHUTDOWN`), calling `syncSceneKeybindings(this)` and `this.invalidateAllHudCaches()` whenever `keybindings` (or locale/UI scale/key hints) change.
2. **Non-Interference with Utility Shortcuts (`O`, `K`, `C`, `L`, `H`, `M`, `V`, `G`):**
   - While in active gameplay or Hub (not paused), Hub/debug single-letter shortcuts (`O`, `K`, `C`, `L`, `V`, `G`) check `!isBindingCodeUsed(graphicsSettings.getKeybindings(), 'KeyX')` before firing so binding a gameplay action to `O`, `K`, `C`, `L`, `V`, or `G` never accidentally pops a modal or cycles quality mid-movement; top-center Sanctuary utility pills (`⚙ [O]`, `⌨ [K]`, `★ [C]`, `🌐 [L]`) and `[Esc]` Pause Menu remain clickable at all times.
   - When `pauseModalOpen` is `true` (gameplay input is paused) or on Victory/Defeat screens, `[O]`, `[H]`, `[M]` modal shortcuts continue to work normally.
