# Phase P7 — Nhãn Theo Khoảng Cách & Prompt `[E]` (`findInteractTarget`, Single-Pill Prompt, Fade + Hysteresis, Cửa, Biển Hub, Nameplate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Phase P7 distance-based label and single-target `[E]` prompt system defined in Spec Section 3.3 (lines 317–330) and Section 4.P7 (lines 581–584):
1. **Shared `findInteractTarget(sim, playerId, options)` (`packages/shared/src/sim/interact-target.ts`):**
   - Export `INTERACT_RANGE = 64`, `INTERACT_HYSTERESIS = 8`, `INTERACT_RANGE_OFFSETS` (`hub_statue: 8`, `ancient_mechanism: 10`, `chest: 0`, `world_item: 0`, `shrine: 8`, `portal: 8`, `door: 8`), `INTERACT_PRIORITY_ORDER` (`['hub_statue', 'ancient_mechanism', 'chest', 'world_item', 'shrine', 'portal', 'door']`), `InteractTargetKind`, and `InteractTargetResult`.
   - Select the **closest eligible candidate within the highest-priority group that has at least one candidate in range**, preserving instanced `ownerPlayerId` filtering, weapon pickup lock (`weaponPickupLockTimer` & `droppedRecentlyByActor`), and Engineer party requirement for `ancient_mechanism`.
   - Support optional `currentTargetKey` + `hysteresis` (`8u` default) so the client prompt and outline highlight do not flicker at the range boundary.
   - Refactor `interactWithNearestImpl` in `packages/shared/src/sim/sim-progression-bot.ts` to delegate target selection to `findInteractTarget(this, p.id)` so simulation `[E]` actions and client `[E]` prompts are 100% unified.
   - Document the intentional behavior change in `docs/GDD.md`.
2. **Behavioral Seeded Unit Tests (`packages/shared/test/polish-p7-interact-target.test.ts`):**
   - Across multiple seeded random layouts and explicit priority/tie-break/instanced/engineer/hysteresis scenarios, compute `X = findInteractTarget(sim, playerId)`, trigger a simulated `[E]` interaction (`sim.interactWithNearest(actor)`), and verify that **exact entity `X`** was acted upon (chest `X` opened, world item `X` picked up/purchased, statue `X` selected, mechanism `X` repaired, shrine `X` activated, portal entered, or door `X` traversed).
3. **Single-Target Rounded-Pill `[E]` Prompt with Fade (`120–150ms`) & Hysteresis (`8u`):**
   - Outside interact range: **zero floating `[E]` text labels** on chests, weapons, shop items, shrine, portal, Hub statues, or Hub weapon rack (objects are recognized via their P6 lighting & additive glow).
   - Inside interact range: render **at most one `[E]` prompt** for the current `findInteractTarget` result — a dark translucent rounded pill containing the `[E]` key chip + localized item/object name (in rarity/theme color) + gold cost with coin icon (when `costGold > 0`), paired with the luminous outline highlight (`viền sáng`) on the target entity. Other interactables inside range that are not the winning target show only their glow, with no text label.
   - Smoothly fade the pill in/out over `120–150ms` (`alpha` transition) and pass `currentTargetKey` with `8u` hysteresis so standing at the edge of range never flickers.
   - Deduplicate with the Weapon Comparison Card (`hud-hub-and-cards.ts`): when the current target is a ground/rack/shop weapon and the comparison card is visible, the `[E]` action prompt lives inside the comparison card instead of duplicating a floating world pill.
4. **Hub Guidance Signs, Room Doors & Player Nameplates:**
   - Hub guidance signs (`statuesSign`, `weaponRackSign`, `trainingDummyDpsSign`) are only visible within `~200u` of the local player (fading smoothly).
   - Room doors (`sim.doors`): remove the always-visible room name text. Show only a compact lock icon (`🔒`) when locked, and reveal the target room name only when the player approaches within `~120u`.
   - Player nameplates (`entity-sync.ts`): hide the local player's own overhead name when alive (still show downed/revive or emote bubble if triggered). Render co-op teammates' overhead names in a compact font (`11–12px` at `1080p`, i.e. `6px` in `960×540` world space with `zoom = 2`), `alpha = 0.75`, slot color, positioned cleanly above the head without overlapping the character rig.

**Architecture:** Shared deterministic target selector in `packages/shared/src/sim/interact-target.ts` wired into `packages/shared/src/sim/sim-progression-bot.ts`, plus client-side world UI updates in `apps/client/src/fx/lighting-config.ts`, `apps/client/src/scenes/GameScene.ts`, `apps/client/src/scenes/game-scene/room-entities-sync.ts`, `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`, and `apps/client/src/scenes/game-scene/entity-sync.ts`. Every file strictly `< 1000` lines.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Playwright (`pnpm shots`, `pnpm perf`, `pnpm verify`).

---

## Global Constraints (from Spec 0.3, 0.6 & Section 7)

- `pnpm verify` green: `typecheck`, `lint`, `test`, `build`, `e2e`. Never skip or delete tests to make them pass.
- 0 console errors/warnings in E2E.
- Performance: Stress test (`__GAME_STRESS_TEST__`, 4P + 80 enemies + 600 bullets) at 1080p High `>= 58 FPS` average with VSync on, and uncapped frame time `p95` within `+15%` of P0 baseline; normal scenes `>= 60 FPS`.
- Co-op unbroken (`tests/e2e/phase4.spec.ts` passes). Shared simulation changes must remain 100% deterministic (seeded) and covered by unit tests.
- Zero memory allocations in hot per-frame loops (reuse pooled/persistent Phaser GameObjects for the `[E]` prompt pill and door/hub labels).
- Every source file strictly `< 1000` lines.
- All i18n keys present in both `vi.json` and `en.json`.

## Review Focus (Top 5 Risk Areas & Owning Tasks)

1. **Sim vs Client Target Desync:** Pressing `[E]` acts on object A while the client prompt/outline highlights object B → Owned by **Task 1** (`findInteractTarget` shared between `interactWithNearestImpl` and client) + seeded behavioral unit tests in `packages/shared/test/polish-p7-interact-target.test.ts`.
2. **Co-op Instanced Loot & Engineer Mechanism Filtering:** Player 1 sees or picks up Player 2's instanced chest drop, or a non-Engineer party targets an `ancient_mechanism` → Owned by **Task 1** (`findInteractTarget` unit tests for `ownerPlayerId` and `engineer` party check).
3. **Boundary Flicker & Duplicate Weapon Prompts:** Standing at `64u–72u` causes rapid prompt flickering, or standing near a weapon shows both the floating `[E]` pill and the Weapon Comparison Card → Owned by **Task 1** (`8u` hysteresis unit tests) & **Task 2** (`120–150ms` fade + comparison card deduplication E2E/unit tests).
4. **3-Distance Visual Clutter in Hub, Merchant & Chest Rooms:** Floating `[E]` labels still visible at far (`> 150u`) or mid (`~86–90u`, outside interact range) distances, or multiple `[E]` labels shown simultaneously in Merchant/Hub → Owned by **Task 2** & **Task 3** (`hub-solo`, `hub-statue-mid`, `hub-near-statue`, `b1-merchant-far`, `b1-merchant-mid`, `b1-merchant`, `b1-chest-closed-far`, `b1-chest-mid`, `b1-chest-near` screenshots + Visual Gate).
5. **E2E Regression from Door/Hub/Nameplate Label Changes:** Existing E2E tests (`phase1`–`phase8`) that inspect HUD/debug state or interact with Hub statues/doors/chests break → Owned by **Task 2** & **Task 3** (`pnpm verify` full suite).

---

## File Structure & Responsibilities

- `packages/shared/src/sim/interact-target.ts` (**Create**):
  - Export `INTERACT_RANGE`, `INTERACT_HYSTERESIS`, `INTERACT_RANGE_OFFSETS`, `INTERACT_PRIORITY_ORDER`, `InteractTargetKind`, `InteractTargetResult`, `FindInteractTargetOptions`, and `findInteractTarget(sim, playerId, options)`.
- `packages/shared/src/sim/sim-progression-bot.ts` & `packages/shared/src/index.ts` (**Modify**):
  - Refactor `interactWithNearestImpl` to use `findInteractTarget(this, p.id)` and re-export `interact-target.ts` from `@ashen-pact/shared`.
- `packages/shared/test/polish-p7-interact-target.test.ts` (**Create**):
  - Seeded behavioral unit tests verifying that `X = findInteractTarget(sim, playerId)` matches the exact entity mutated by `sim.interactWithNearest(actor)`, plus priority order, closest-within-group tie-breaking, `8u` hysteresis, instanced loot ownership, pickup lock, and Engineer mechanism eligibility.
- `docs/GDD.md` (**Modify**):
  - Document the intentional behavior change in Section 3.1 (`findInteractTarget`, `INTERACT_RANGE = 64`, category offsets, priority order, closest-within-priority-group selection, and `8u` hysteresis).
- `tests/e2e/helpers/visual-scene-helpers.ts` & `tests/e2e/helpers/visual-scenes.ts` (**Modify**):
  - Refine `hub-solo`, `hub-near-statue`, `b1-merchant`, `b1-chest-near`, `b1-door-locked`, `b1-door-open` and add `hub-statue-mid`, `b1-merchant-far`, `b1-merchant-mid`, `b1-chest-mid` so Hub, Merchant, Chest, and Weapon Ground are all tested at 3 distances (far / mid outside range / near inside range).
- `apps/client/src/fx/lighting-config.ts`, `apps/client/src/scenes/GameScene.ts`, `apps/client/src/scenes/game-scene/room-entities-sync.ts`, `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`, `apps/client/src/scenes/game-scene/entity-sync.ts` (**Modify in Task 2**):
  - Wire `findInteractTarget` with `8u` hysteresis into client highlight + single rounded-pill `[E]` prompt (`120–150ms` fade), weapon card deduplication, chest/shrine/portal/statue/rack/shop prompt formatting, Hub signs `<= 200u`, door lock icon + `<= 120u` room name, and local/teammate nameplate rules.
- `apps/client/test/polish-p7-labels-and-prompt.test.ts` (**Create in Task 2**):
  - Client unit tests for prompt pill descriptor formatting, fade & hysteresis state machine, door label states (`> 120u` vs `<= 120u`, locked vs unlocked), Hub sign distance gating (`<= 200u`), weapon comparison card deduplication, and player nameplate visibility/styling.

---

## Task Breakdown

### Task 1: Refine/Add Phase P7 3-Distance Visual Scenes, Capture P7 `before` Screenshots, and Implement Shared `findInteractTarget` with Seeded Behavioral Unit Tests (TDD RED → GREEN)

- [x] **Step 1:** Update `tests/e2e/helpers/visual-scene-helpers.ts` and `tests/e2e/helpers/visual-scenes.ts` with the 3-distance scenes (`hub-solo`, `hub-statue-mid`, `hub-near-statue`, `b1-merchant-far`, `b1-merchant-mid`, `b1-merchant`, `b1-chest-closed-far`, `b1-chest-mid`, `b1-chest-near`, plus clean `b1-door-locked` / `b1-door-open` player offsets) and capture the 19 Phase P7 `before` screenshots (`docs/screenshots/polish-p7/before/`).
- [x] **Step 2 (TDD RED):** Create `packages/shared/test/polish-p7-interact-target.test.ts` testing `findInteractTarget` and behavioral equivalence with `sim.interactWithNearest()` across 30+ seeded layouts, priority groups, closest-within-group selection, instanced loot, Engineer mechanisms, and `8u` hysteresis; run Vitest to record the RED failure.
- [x] **Step 3 (TDD GREEN):** Implement `packages/shared/src/sim/interact-target.ts`, export it from `packages/shared/src/index.ts`, refactor `interactWithNearestImpl` in `packages/shared/src/sim/sim-progression-bot.ts` to use `findInteractTarget`, and update `docs/GDD.md`.
- [x] **Step 4:** Verify `npx vitest run packages/shared/test/polish-p7-interact-target.test.ts`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass. Commit Task 1 changes.

### Task 2: Implement Single-Pill `[E]` Prompt (`120–150ms` Fade + `8u` Hysteresis), Weapon Card Deduplication, Hub Guidance Signs (`<= 200u`), Door Lock/Proximity Labels (`<= 120u`), and Player Nameplates

- [x] **Step 1 (TDD RED):** Create `apps/client/test/polish-p7-interact-prompt.test.ts` covering single-target `[E]` prompt formatting (chests, weapons, priced shop items with coin icon, shrines, portals, Hub statues, mechanisms, doors), `120–150ms` fade alpha progression, `8u` hysteresis target retention, weapon comparison card deduplication, door lock/proximity label states (`<= 120u`), Hub guidance sign distance gating (`<= 200u`), and local vs teammate nameplate rules. Run Vitest to record the RED failure.
- [x] **Step 2 (TDD GREEN):** Implement the client label & prompt helpers in `apps/client/src/scenes/game-scene/interact-prompt.ts` and integrate them into `GameScene.ts`, `arena-tiles.ts`, `room-entities-sync.ts`, `hud-hub-and-cards.ts`, and `entity-sync.ts` (all files `< 1000` lines, zero per-frame allocations).
- [x] **Step 3:** Verify `npx vitest run apps/client/test/polish-p7-interact-prompt.test.ts`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass. Commit Task 2 changes.

### Task 3: Capture P7 `after` Screenshots with `--verify-freeze`, Conduct Blind A/B `pro` Visual Gate, Run Phase P7 Quality Gate, and Tag `polish-p7`

- [ ] **Step 1:** Run `pnpm shots -- --phase p7 --label after --scenes hub-solo,hub-statue-mid,hub-near-statue,hub-near-rack,hub-coop-2p,b1-merchant-far,b1-merchant-mid,b1-merchant,b1-chest-closed-far,b1-chest-mid,b1-chest-near,b1-weapon-ground-far,b1-weapon-ground-mid,b1-weapon-ground-near,b1-door-locked,b1-door-open,b1-shrine,b1-portal-active,coop-4p-combat --verify-freeze` and verify `diffRatio < 0.005` on all 19 scenes.
- [ ] **Step 2:** Set up the 19-scene Blind A/B directory (`version-A` vs `version-B` + `ab-mapping.json`), dispatch the independent `pro` Visual Reviewer subagent, and record results in `docs/screenshots/polish-p7/review-1.md`.
- [ ] **Step 3:** Run fresh `pnpm verify` and `pnpm perf`, update `docs/PROGRESS.md` & `docs/PHASES.md`, commit, and tag `polish-p7`.
