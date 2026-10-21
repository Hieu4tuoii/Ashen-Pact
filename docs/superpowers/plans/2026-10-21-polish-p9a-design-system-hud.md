# Phase P9a — UI/UX: Design System & HUD Trong Game (`theme.ts`, `hud-primitives.ts`, `HudScene` In-Game HUD Redesign, `uiScale` 80–130%, Coalesced Popups, QoL Indicators) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase P9a UI/UX Design System, HUD primitives, in-game `HudScene` redesign, `uiScale` (`0.80–1.30`), reaction popup coalescing (`"HƠI NƯỚC ×3"` within `0.4s`), spatial popup cap (`<= 3` per `120px` cell), and combat QoL indicators defined in Spec Section 3.7 (lines 417–433 & 445) and Section 4.P9a (lines 588–590):

1. **Design System (`apps/client/src/ui/theme.ts`) & HUD Primitives (`apps/client/src/ui/components/hud-primitives.ts`):**
   - Grounded in `ENV_PALETTE` (`panelBg: 0x2d3547`, `panelBgDark: 0x1d2330`, `panelBgAlpha: 0.82`, `minimapBgAlpha: 0.85`, `panelBorder: 0x64708b`, `panelBorderHighlight: 0x8fa0bf`, `panelRadius: { sm: 6, md: 8, lg: 10 }`, `spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }`).
   - Biome accent helper `getBiomeUiAccent(biomeIndex)` returning subtle biome-tuned header/badge accents from `ENV_PALETTE`.
   - Typography scale at 1080p (`12, 13, 14, 16, 20, 28, 40`) with enforced minimum `13px` at 1080p for all in-game HUD text (`>= 6.5px` / `7px` in `960x540` `HudScene` coordinates = `>= 13–14px` at 1080p).
   - Vietnamese diacritic-safe text style helper `createUiTextStyle(...)` with `'Be Vietnam Pro'` (weights `400 / 600 / 800`), `lineSpacing` ensuring `line-height >= 1.3`, and `padding: { top: 4, bottom: 3, left: 2, right: 2 }` so stacked Vietnamese marks (`Ở`, `Ữ`, `Ặ`, `HƠI NƯỚC`) are never clipped at the top.
   - Crisp DPR & `uiScale`-aware text resolution helper `computeUiTextResolution(dpr, zoom, uiScale)`.
   - Status colors (warm red HP `#E84545` / `#DC2626`, silver-slate Armor `#94A3B8` / `#CBD5E1`, azure Energy `#38BDF8` / `#0284C7`, gold Coin `#F59E0B` / `#FBBF24`) and rarity colors.
   - Code-drawn vector HUD primitives: `drawStyledPanel`, `drawSegmentedBar`, `drawKeyChip`, `drawCircularCooldown`, `drawVectorHudIcon`, `drawMiniCharacterPortrait`, `UIButton`, `UITooltip`, `UIToast`, `UIIconLabel`.
   - `uiScale` (`0.80–1.30`, step `0.05`, default `1.0`) and `showKeyHints` (`boolean`, default `true`) in `graphics-settings.ts` with URL query overrides (`?uiScale=0.8`, `?uiScale=1.3`, `?keyHints=0|1`).
2. **In-Game HUD Redesign (`HudScene`, `hud-setup-and-pause.ts`, `hud-combat-and-coop.ts`, `hud-qol-and-minimap.ts`, `hud-hub-and-cards.ts`):**
   - **Top-left:** Player card with procedural mini character portrait, character name & coin badge with icon, and segmented HP / Armor / Energy bars with vector icons, numeric readouts, low-HP pulse, and smooth damage trail.
   - **Top-right:** Crisp rounded minimap (`alpha ~0.85`, clear room icons) with `"Tầng X-Y · Biome"` subtitle badge directly underneath.
   - **Bottom-right:** 2 weapon cards (active slot prominent with rarity border + glow, secondary slot compact; weapon sprite/icon + name + energy cost + key chip `[1]`/`[2]`) and circular cooldown widgets for Skill `[Space]` and Dash `[Shift]` with radial sweep arcs and key chips.
   - **Top-center:** Boss HP bar with phase markers (`66%` / `33%`) and wave/room banners (`"ĐỢT 2/3"`, `"PHÒNG ĐÃ DỌN SẠCH"`, coalesced elemental reaction banner `"HƠI NƯỚC ×3"`).
   - **Left:** Compact co-op teammate cards with slot ring color, mini HP/Armor bars, and status.
   - **Declutter:** Remove full-width top/bottom bars, remove keybind hint row, remove DPS text from normal HUD, and remove on-screen HUD buttons (`[Menu]`, `[Pause]`, etc. when `?debug=0`).
3. **Combat Popups (`combat-fx.ts`, `combat-fx-pools.ts`) & QoL Indicators (`hud-qol-and-minimap.ts`):**
   - Coalesce same-type elemental reactions within a `0.4s` window (`"HƠI NƯỚC ×3"`), rendered at a fixed upper-center HUD banner / anchor so it never obscures the player.
   - Enforce `<= 3` active damage/status popups per `120px` spatial cell with vertical stacking offset; normal hits compact, crits larger with `easeOutBack` scale-pop then fade.
   - Off-screen enemy directional arrows around screen edges when `<= 3` enemies remain in a combat room, red translucent directional hit indicator arc around the player when taking damage, and `"ĐỢT X/Y"` / `"PHÒNG ĐÃ DỌN SẠCH"` banners.

**Architecture:**
- `apps/client/src/ui/theme.ts`: Design system tokens, `ENV_PALETTE` panel/biome helpers, typography scale, Vietnamese diacritic padding, and DPR resolution math.
- `apps/client/src/ui/components/hud-primitives.ts`: Pure geometry calculators + Phaser `Graphics`/container component builders for panels, segmented bars, key chips, circular cooldowns, vector icons, and mini character portraits.
- `apps/client/src/ui/graphics-settings.ts` (re-exported at `apps/client/src/fx/graphics-settings.ts`): `uiScale` (`0.80–1.30`) and `showKeyHints` settings + deterministic URL query overrides.
- `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts`, `hud-combat-and-coop.ts`, `hud-qol-and-minimap.ts`, `hud-hub-and-cards.ts`, and `apps/client/src/fx/combat-fx.ts`: Modular in-game HUD layout, QoL overlays, and coalesced popups.
- Every file strictly `< 1000` lines.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Playwright (`pnpm shots`, `pnpm perf`, `pnpm verify`).

---

## Global Constraints (from Spec 0.3, 0.6 & Section 7)

- `pnpm verify` green: `typecheck`, `lint`, `test`, `build`, `e2e`. Never skip or delete tests to make them pass.
- 0 console errors/warnings in E2E.
- Performance: Stress test (`__GAME_STRESS_TEST__`, 4P + 80 enemies + 600 bullets) at 1080p High `>= 58 FPS` average with VSync on, and uncapped frame time `p95` within `+15%` of P0 baseline; normal scenes `>= 60 FPS`.
- Zero memory allocations in hot per-frame HUD/FX loops (dirty-hash caching + pooled popups/arrows).
- Every source file strictly `< 1000` lines.

## Review Focus (Top 5 Risk Areas & Owning Tasks)

1. **Vietnamese Diacritic Top Clipping (`Ở`, `Ữ`, `Ặ`, `HƠI NƯỚC`):** Phaser `Text` clips stacked uppercase diacritics when top padding is `0` → Owned by **Task 1** (`createUiTextStyle` enforces `padding: { top: 4, bottom: 3, left: 2, right: 2 }` and `lineSpacing` for `line-height >= 1.3`, verified in `ui-vi-diacritics`).
2. **Minimum HUD Font Size `>= 13px` at 1080p & Crispness at 1440p:** In `HudScene` (`960×540` base viewport zoomed `2×` at 1080p), any font `< 6.5px` renders `< 13px` at 1080p, and low text resolution blurs at 1440p → Owned by **Task 1** & **Task 2** (`clampHudFontPxAt1080p >= 13`, `computeUiTextResolution(dpr, zoom, uiScale)`).
3. **`uiScale` (`0.80–1.30`) Edge Anchoring Without Overlap:** Scaling HUD corner containers (`topLeft`, `topRight`, `bottomRight`, `topCenter`, `bottomCenter`, `leftCoop`) around their screen-edge anchor points so neither `0.8` nor `1.3` clips off-screen or overlaps across 1080p, 1440p, and ultrawide → Owned by **Task 2**.
4. **Elemental Reaction Coalescing (`0.4s` Window) & `120px` Spatial Cell Cap (`<= 3`):** Rapid elemental reactions must merge into `"HƠI NƯỚC ×3"` at a fixed top-center combo display without covering the player, and world damage numbers must cap at `<= 3` per `120px` cell → Owned by **Task 2**.
5. **Debug HUD Isolation (`?debug=0` vs `?debug=1`):** Normal HUD (`?debug=0`) must have zero debug buttons, zero keybind bars, and zero DPS text, while `b1-hud-debug-on` (`?debug=1` + `F1`) preserves all debug inspection hooks required by E2E tests → Owned by **Task 2** & **Task 3**.

---

## File Structure & Responsibilities

- `tests/e2e/helpers/visual-scenes.ts` & `tools/run-shots.ts` (`tools/capture-visual-scenes.ts`) (**Modify in Task 1**):
  - Define `SCENE_GROUPS.p9a` (15 scenes: `b1-combat`, `b1-combat-1440p`, `b1-combat-ultrawide`, `b1-combat-4p`, `b1-combat-downed`, `b1-boss-p1`, `b1-boss-p3`, `b2-combat`, `b3-combat`, `b1-hud-weapon-compare`, `b1-hud-debug-on`, `b1-combat-uiscale-80`, `b1-combat-uiscale-130`, `b1-hud-qol-showcase`, `ui-vi-diacritics`) and support `--group p9a`.
- `apps/client/src/ui/graphics-settings.ts` & `apps/client/src/fx/graphics-settings.ts` (**Modify/Create in Task 1**):
  - Add `uiScale` (`0.80–1.30`, step `0.05`, default `1.0`) and `showKeyHints` (`boolean`, default `true`) + URL query overrides `?uiScale=` and `?keyHints=`.
- `apps/client/src/ui/theme.ts` (**Create in Task 1**):
  - `UI_THEME` tokens grounded in `ENV_PALETTE`, `getBiomeUiAccent`, `clampHudFontPxAt1080p`, `hudFontPxToScenePx`, `createUiTextStyle`, `computeUiTextResolution`.
- `apps/client/src/ui/components/hud-primitives.ts` (**Create in Task 1**):
  - Pure geometry helpers + Phaser rendering primitives (`drawStyledPanel`, `drawSegmentedBar`, `drawKeyChip`, `drawCircularCooldown`, `drawVectorHudIcon`, `drawMiniCharacterPortrait`, `UIButton`, `UITooltip`, `UIToast`, `UIIconLabel`).
- `apps/client/test/polish-p9a-design-system-hud.test.ts` (**Create in Task 1**):
  - Unit tests for `UI_THEME`, font clamping `>= 13px`, Vietnamese diacritic padding & line-height `>= 1.3`, `computeUiTextResolution`, `uiScale` clamping & URL query overrides, and HUD primitive geometry helpers.
- `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts`, `hud-combat-and-coop.ts`, `hud-qol-and-minimap.ts`, `hud-hub-and-cards.ts`, `apps/client/src/fx/combat-fx.ts` (**Modify/Create in Task 2**):
  - Redesign in-game `HudScene` HUD, implement `0.4s` reaction coalescing + `120px` cell popup cap + `easeOutBack` scale-pop, and add off-screen enemy arrows (`<= 3`), directional hit arc, and wave/clear banners.

---

## Task Breakdown

### Task 1: Add Phase P9a Visual Scenes, Capture 15 `before` Screenshots, and Implement Design System (`theme.ts`), HUD Primitives (`hud-primitives.ts`) & `uiScale` Settings (TDD RED → GREEN)

- [x] **Step 1:** Add the 15 P9a visual scenes (`SCENE_GROUPS.p9a`) in `tests/e2e/helpers/visual-scenes.ts` and `tools/run-shots.ts` (`tools/capture-visual-scenes.ts`), and capture all 15 `before` screenshots in `docs/screenshots/polish-p9a/before/` with `--verify-freeze`.
- [x] **Step 2 (TDD RED):** Create `apps/client/test/polish-p9a-design-system-hud.test.ts` testing `UI_THEME` `ENV` alignment, HUD font size `>= 13px` at 1080p, Vietnamese diacritic padding & line-height `>= 1.3`, `computeUiTextResolution`, `graphicsSettings` `uiScale` clamping & query overrides, and HUD primitive geometry helpers.
- [x] **Step 3 (TDD GREEN):** Implement `apps/client/src/ui/graphics-settings.ts` (and re-export at `apps/client/src/fx/graphics-settings.ts`), `apps/client/src/ui/theme.ts`, and `apps/client/src/ui/components/hud-primitives.ts`.
- [x] **Step 4:** Verify `pnpm --filter @ashen-pact/client test` and `pnpm typecheck` pass 100%, all files `< 1000` lines, and commit Task 1.

### Task 2: Redesign `HudScene` In-Game HUD, Implement Coalesced Reaction Popups (`0.4s`) & `120px` Cell Cap, and Add Combat QoL Indicators

- [ ] **Step 1 (TDD RED):** Extend `apps/client/test/polish-p9a-design-system-hud.test.ts` with tests for reaction coalescing within `0.4s` (`"HƠI NƯỚC ×3"`), `<= 3` popups per `120px` cell, `easeOutBack` popup scale curve, off-screen enemy arrow gating (`<= 3` enemies), directional hit arc decay, and wave/clear banner state transitions.
- [ ] **Step 2 (TDD GREEN):** Implement `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts`, redesign `hud-setup-and-pause.ts` and `hud-combat-and-coop.ts`, update `combat-fx.ts` / `combat-fx-pools.ts`, and wire `uiScale` edge anchoring into `HudScene` and `GameScene`.
- [ ] **Step 3:** Verify unit tests, `pnpm typecheck`, `pnpm lint`, and E2E compatibility (`phase1`–`phase8`), then commit Task 2.

### Task 3: Capture 15 P9a `after` Screenshots with `--verify-freeze`, Conduct Blind A/B `pro` Visual Gate, Run Phase P9a Quality Gate, and Tag `polish-p9a`

- [ ] **Step 1:** Run `pnpm shots -- --phase p9a --label after --group p9a --verify-freeze` and verify all 15 scenes have `freezeDiffPixels === 0`.
- [ ] **Step 2:** Set up the 15-scene Blind A/B directory (`version-A` vs `version-B` + `ab-mapping.json`), dispatch the independent `pro` Visual Reviewer subagent, and record results in `docs/screenshots/polish-p9a/review.md`.
- [ ] **Step 3:** Run fresh `pnpm verify` and `pnpm perf`, update `docs/PROGRESS.md` & `docs/PHASES.md`, commit, and tag `polish-p9a`.
