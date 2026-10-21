# Phase P9b — UI/UX: Menu, Hub, Modal, Pause, Settings & Kết Quả (`MenuScene`, HTML `<input>` Overlay, Collapsed Hub Invite Chip `[I]`, Buff Modal, Victory/Defeat Modal, Pause Exit Confirmation, Tabbed Settings Modal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase P9b UI/UX Screens & Modals defined in Spec Section 3.7 (lines 434–444) and Section 4.P9b (lines 592–594):

1. **Main Menu (`apps/client/src/scenes/MenuScene.ts` + `apps/client/src/ui/html-input-overlay.ts`):**
   - Clear 3-tier hierarchy:
     1. **Primary CTA (`playSolo` at `(480, 225)`):** Prominent primary button (`UI_THEME` crimson/ember fill `#9F1D35` / `#DC2626`, `SOLAR_GOLD` border, top gold accent bar, `16px` bold text, `▶` play icon).
     2. **Secondary Co-op Buttons (`hostCoop`, `joinCoop`):** Elevated dark-slate (`UI_THEME.panelBgElevated`) buttons with brass/azure left accent bars so they are clearly subordinate to `playSolo`.
     3. **Compact Action Row (`settings` `[O]`, `controls` `[K]`, `credits` `[C]`, `language` `[L]` at `y = 394`):** Styled with `UI_THEME.panelBgDark`, subtle slate border, and key chips `[O]`, `[K]`, `[C]`, `[L]`.
   - Hide debug buttons (`artGallery`, `toggleAnim`) and Vietnamese verification footer when `?debug=0`; keep them visible & interactive when `?debug=1`.
   - **HTML `<input type="text">` Overlay (`MenuHtmlInputOverlay`):** Mounted over the Phaser canvas in `MenuScene` for Name (`x = 355, y = 176, w = 216, h = 28`) and LAN IP (`x = 605, y = 176, w = 216, h = 28`), supporting native caret, text selection, `Ctrl+V` / clipboard paste, `Enter` / `Escape` to confirm/blur, and deterministic freeze mode (`?freeze=1` hides blinking browser caret and renders steady `▌` indicator).
2. **Hub Co-op Invite Panel (`apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`, `GameScene.ts`, `arena-tiles.ts`):**
   - **Collapsed by default (`invitePanelVisible = false`):** Renders a compact top-right chip `"Mời bạn [I] (XP/4P)"` / `"Invite [I] (XP/4P)"` below the minimap; clicking or pressing `[I]` expands the full QR/LAN invite panel.
   - **Expanded state (`hub-coop-invite-open`):** Includes a `"Thu gọn [I]"` / `"Collapse [I]"` header button and constrains/truncates player row text (`formatHubInvitePlayerRowText`) so it never overlaps the Host `"Đuổi"` (`Kick`) button.
3. **Modals (`hud-modals-and-debug.ts`, `hud-setup-and-pause.ts`, `settings-modal.ts`):**
   - **Buff Selection Modal (`modal-buff`, `modal-buff-en`):** Cards with procedural vector buff icons, rarity/category border + top accent, concise description, hover elevation (`-4px` lift + gold border), key chips `[1]`, `[2]`, `[3]`, and Co-op ready/countdown footer.
   - **Victory / Defeat Summary Modal (`modal-victory`, `modal-victory-en`, `modal-defeat`):** Clear visual hierarchy (Heroic Victory / Defeat banner → Run Statistics card + Per-Player table → 4 MVP Award cards), primary `"Chơi Lại [Enter]"` button and secondary `"Về Doanh Trại [H]"` / `"Về Menu Chính [M]"` buttons, removing the meaningless `"Đóng Bảng"` (`Dismiss`) button.
   - **Pause Overlay + Exit Confirmation (`pause`, `pause-en`, `pause-confirm-exit`):** Clicking `"Về Menu Chính [M]"` opens a confirmation dialog (`"Xác nhận thoát về Menu Chính?"` / `"Confirm exit to Main Menu?"` with `"Xác nhận thoát"` and `"Hủy [Esc]"`).
   - **Tabbed Settings Modal (`menu-settings`, `menu-settings-en`):** 4 tabs (`Âm thanh` / `Audio`, `Hình ảnh` / `Graphics`, `Gameplay`, `Điều khiển` / `Controls`), single-language header (`"CÀI ĐẶT HỆ THỐNG"` in VI, `"SYSTEM SETTINGS"` in EN), `UI Scale` (`80%–130%`) slider/stepper, and `Hiện gợi ý phím` (`Show Key Hints`) toggle.

**Architecture:**
- `apps/client/src/ui/html-input-overlay.ts`: Pure layout/formatting helpers + DOM `<input>` overlay lifecycle manager for `MenuScene`.
- `apps/client/src/scenes/MenuScene.ts`: Redesigned 3-tier menu hierarchy + HTML input overlay integration.
- `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`: Collapsed `"Mời bạn [I]"` chip + expanded QR panel with non-overlapping `"Đuổi"` button.
- `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts`, `hud-setup-and-pause.ts`, `apps/client/src/ui/settings-modal.ts`: Redesigned Buff Modal, Victory/Defeat Modal, Pause Exit Confirmation Dialog, and 4-Tab Settings Modal.
- Every source file strictly `< 1000` lines.

**Tech Stack:** TypeScript, Phaser 3, HTML5 DOM Overlay, Vitest, Playwright (`pnpm shots`, `pnpm perf`, `pnpm verify`).

---

## Global Constraints (from Spec 0.3, 0.6 & Section 7)

- `pnpm verify` green: `typecheck`, `lint`, `test`, `build`, `e2e`. Never skip or delete tests to make them pass.
- 0 console errors/warnings in E2E.
- Performance: Stress test (`__GAME_STRESS_TEST__`, 4P + 80 enemies + 600 bullets) at 1080p High `>= 58 FPS` average with VSync on, and uncapped frame time `p95 <= 15.0ms`; normal scenes `>= 60 FPS`.
- Every source file strictly `< 1000` lines.

## Review Focus (Top 5 Risk Areas & Owning Tasks)

1. **HTML `<input>` Overlay Scaling, Modal Z-Order & `?freeze=1` Determinism:** DOM inputs must align with Phaser's uniform-scaled `960×540` viewport across 1080p/1440p/ultrawide, hide when `ModalOverlayManager` opens, clean up on `SHUTDOWN`, and hide native blinking caret when `?freeze=1` → Owned by **Task 1**.
2. **Hub Invite Panel Default Collapsed State & `"Đuổi"` Button Non-Overlap:** `hub-coop-2p` must show the collapsed `"Mời bạn [I]"` chip while `hub-coop-invite-open` shows the expanded QR panel with zero text collision against `"Đuổi"` → Owned by **Task 1**.
3. **4-Tab Settings Modal & Single-Language Header (`vi` vs `en`):** Settings must divide cleanly into 4 tabs (`Âm thanh`, `Hình ảnh`, `Gameplay`, `Điều khiển`), expose `uiScale` (`80%–130%`) and `showKeyHints`, and use single-language titles → Owned by **Task 2**.
4. **Pause Exit Confirmation & Removal of `"Đóng Bảng"` on Victory/Defeat:** `"Về Menu Chính"` in Pause must require confirmation (`pause-confirm-exit`), and Victory/Defeat must remove `"Đóng Bảng"` while keeping `"Chơi Lại"` primary and `"Về Doanh Trại"` / `"Về Menu Chính"` secondary → Owned by **Task 2**.
5. **E2E Compatibility (`phase0`–`phase8` + new P9b E2E checks):** Existing click coordinates (`(960, 450)` for `playSolo`, `(1136, 706)` for `menu-debug-on`, `[O]/[K]/[C]/[L]/[Escape]` shortcuts) must remain 100% compatible while adding E2E tests for clipboard/paste into the IP input and full mouse/keyboard navigation → Owned by **Task 2** & **Task 3**.

---

## Task Breakdown

### Task 1: Add Phase P9b Visual Scenes (`SCENE_GROUPS.p9b`), Capture 18 `before` Screenshots, and Implement Main Menu Hierarchy + HTML `<input>` Overlay & Hub Collapsed Invite Chip (TDD RED → GREEN)

- [ ] **Step 1:** Add `p9b` (18 scenes) to `SCENE_GROUPS` in `tests/e2e/helpers/visual-scene-p9a-helpers.ts` and `tools/run-shots.ts`, add `hub-coop-invite-open` and update `pause-confirm-exit` in `tests/e2e/helpers/visual-scenes.ts`, and capture all 18 `before` screenshots in `docs/screenshots/polish-p9b/before/` with `--verify-freeze`.
- [ ] **Step 2 (TDD RED):** Create `apps/client/test/polish-p9b-menus-modals-settings.test.ts` testing `computeMenuInputOverlayRect`, `resolveMenuButtonHierarchySpec`, `sanitizeMenuInputValue`, `formatHubInvitePlayerRowText`, and Hub Invite collapsed/expanded state helpers.
- [ ] **Step 3 (TDD GREEN):** Implement `apps/client/src/ui/html-input-overlay.ts`, update `apps/client/src/scenes/MenuScene.ts`, update `packages/shared/src/i18n/vi.json` & `en.json`, and update `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`, `GameScene.ts`, and `arena-tiles.ts`.
- [ ] **Step 4:** Verify unit tests, `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass 100%, all files `< 1000` lines, and commit Task 1.

### Task 2: Redesign Buff Modal, Victory/Defeat Result Modal, Pause Overlay + Exit Confirmation, and 4-Tab Settings Modal + E2E Paste/Navigation Tests (TDD RED → GREEN)

- [ ] **Step 1 (TDD RED):** Extend `apps/client/test/polish-p9b-menus-modals-settings.test.ts` with tests for 4-tab Settings model (`audio`, `graphics`, `gameplay`, `controls`), single-language titles, Pause exit confirmation state machine, Buff card rarity/icon spec, and Result modal button hierarchy (no `"Đóng Bảng"` button).
- [ ] **Step 2 (TDD GREEN):** Implement the 4-tab Settings modal in `apps/client/src/ui/settings-modal.ts`, Pause exit confirmation in `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts`, and redesigned Buff & Victory/Defeat modals in `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts`.
- [ ] **Step 3:** Add E2E verification for HTML `<input>` paste/keyboard and modal mouse/keyboard navigation, verify all unit & E2E tests pass, and commit Task 2.

### Task 3: Capture 18 P9b `after` Screenshots with `--verify-freeze`, Conduct Blind A/B `pro` Visual Gate, Run Phase P9b Quality Gate, and Tag `polish-p9b`

- [ ] **Step 1:** Run `pnpm shots -- --phase p9b --label after --group p9b --verify-freeze` and verify all 18 scenes pass `freezeDiffRatio <= 0.005`.
- [ ] **Step 2:** Set up the 18-scene Blind A/B directory (`version-A` vs `version-B` + `ab-mapping.json`), dispatch the independent `pro` Visual Reviewer subagent, and record results in `docs/screenshots/polish-p9b/review.md`.
- [ ] **Step 3:** Run fresh `pnpm verify` and `pnpm perf`, update `docs/PROGRESS.md` & `docs/PHASES.md`, commit, and tag `polish-p9b`.
