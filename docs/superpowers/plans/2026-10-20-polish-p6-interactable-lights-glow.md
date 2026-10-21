# Phase P6 — Ánh Sáng & Glow Cho Vật Thể Tương Tác (`interactableLights`, Glow `ADD`, Cột Sáng Độ Hiếm & Pickup Glow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Phase P6 interactable lighting & emissive glow system defined in Spec Section 3.2 (lines 302–315) and Section 4.P6 (lines 577–580):
1. Zero-allocation `interactableLights` scratch array passed into `LightingPipeline.update`, drawn immediately after player/prop lights with a **reserved quota (`High: 16`, `Medium: 10`, `Low: 6`)** so interactable lights are never starved by projectile or prop lights.
2. Full Spec 3.2 light & glow table across all interactable categories:
   - **Closed Chests (`!chest.opened`):** Rarity color (`common` to `legendary`), light radius `70–90`, slow `2s` pulse (`Math.sin(t * Math.PI)`), additive glow sprite above `lightmapRt` (`alpha 0.25–0.38`), and rising diamond sparkle motes on `rare+` (`rare`, `epic`, `legendary`) chests; turns off when opened.
   - **World Items (`!item.pickedUp`):** Rarity color, light radius `50–70`, gentle bob + additive foot glow sprite (`fx_light_radial`, `BlendModes.ADD`, `depth: 35`); **Epic (`Tím`) & Legendary (`Cam/Vàng`) items display a slender vertical Soul Knight-style rarity light beam (`fx_rarity_beam`, `BlendModes.ADD`, `depth: 35.2`)**; Merchant shop items (`costGold > 0`) sit on a baked ornate golden merchant display mat (`item_shop_pedestal`) so shop wares are recognizable from free drops without text labels.
   - **Pickups (`gold`, `energy`, `life_seed`):** Gold `#FACC15` / Blue `#38BDF8` / Green `#4ADE80`, light radius `24–32`, **active only on `High` quality**.
   - **Floor / Hub Portal (`sim.portalActive`):** Purple–cyan (`#A855F7` outer + `#22D3EE` inner core), radius `140–180`, pulsing light + additive glow sprite (`0` light/glow when `!sim.portalActive`).
   - **Room Doors (`sim.doors`):** Locked (`door.locked`): small dark crimson (`#DC2626`, radius `60–64`); Open (`!door.locked`): soft biome accent color (`ENV_PALETTE[biome].accent`, radius `72–78`), transitioning color and additive glow when state changes.
   - **Merchant / Shrine / Hub Statues (`sim.npcEntities`, `sim.hubStatues`):** Gold `#F59E42` (`merchant`, radius `90`), Cyan `#22D3EE` (`shrine`, radius `86`, **turning off completely after `npc.interacted === true`** and switching texture to `prop_shrine_statue_used`), Character theme color (`hubStatues`, radius `78`).
3. **Current `[E]` Target Outline Highlight (`viền sáng`) & Distance-Gated Labels:**
   - When an interactable is the current `[E]` target (within interact range), render a crisp luminous outline highlight (`viền sáng`) around it.
   - Hide floating `[E]` text labels on distant interactables (`> 72u`) so in `b1-dark-interactables`, `b1-chest-closed-far`, and `b1-weapon-ground-far`, chests, weapons, shop items, shrine, and portal are immediately recognizable purely via glow/lighting (`không có chữ`).
4. **Enemy Bullet Salience & 30+ Glowing Objects Performance Gate:**
   - Colored lights in `lightmapRt` clamp `alpha <= 0.35`, and additive glow sprites above `lightmapRt` clamp `alpha <= 0.40` (`0.25–0.38`), ensuring enemy bullets (`proj_enemy_orb`) remain the #1 brightest, highest-contrast element on screen in `b1-combat` and `b3-combat`.
   - Replace per-item per-frame `Graphics` redraws (`worldItemSprites.glow` and `telegraphGraphics` chest/item pillars) with batched `Phaser.GameObjects.Image` sprites so rooms with **30+ glowing objects** maintain `>= 58–60 FPS`.

**Architecture:** Client-only lighting & entity visual sync upgrades in `apps/client/src/fx/lighting-config.ts`, `apps/client/src/fx/lighting-pipeline.ts`, `apps/client/src/art/texture-baker-fx.ts`, `apps/client/src/art/texture-baker-props.ts`, `apps/client/src/scenes/GameScene.ts`, `apps/client/src/scenes/game-scene/room-entities-sync.ts`, `apps/client/src/scenes/game-scene/entity-sync.ts`, `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`, and `apps/client/src/world/biome-architecture-render.ts`. Zero simulation physics/combat changes in `packages/shared`. Every file strictly `< 1000` lines.

**Tech Stack:** TypeScript, Phaser 3 (`RenderTexture`, `BlendModes.ADD`, `Image` sprite batching), Vitest, Playwright (`pnpm shots`, `pnpm perf`, `pnpm verify`).

---

## File Structure & Responsibilities

- `apps/client/src/fx/lighting-config.ts` (**Modify**):
  - Export `InteractableLightKind`, `InteractableLightEntry`, `INTERACTABLE_LIGHT_QUOTA` (`high: 16, medium: 10, low: 6`), `getInteractableLightQuota(tier)`, `populateInteractableLightsScratch(scratch, params)`, `resolveInteractableVisualGlowSpec(...)`, and `resolveCurrentInteractHighlightTarget(...)`.
- `apps/client/src/fx/lighting-pipeline.ts` (**Modify**):
  - Extend `LightingPipeline.update` to accept `interactableLights?: readonly InteractableLightEntry[]`, draw them right after Section C (Props) with a reserved quota (`16` High / `10` Medium / `6` Low), clamping colored interactable light `alpha <= 0.35`.
- `apps/client/src/art/texture-baker-fx.ts` & `apps/client/src/art/texture-baker-props.ts` (**Modify**):
  - Bake `'fx_rarity_beam'` (`32×128` Soul Knight slender vertical rarity beam), `'fx_sparkle_mote'` (`16×16` 4-point diamond sparkle), `'item_shop_pedestal'` (`36×22` ornate gold-trimmed merchant display mat), and `'prop_shrine_statue_used'` (extinguished shrine statue) + cyan gem on active `'prop_shrine_statue'`.
- `apps/client/src/scenes/GameScene.ts`, `apps/client/src/scenes/game-scene/room-entities-sync.ts`, `apps/client/src/scenes/game-scene/entity-sync.ts`, `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`, `apps/client/src/world/biome-architecture-render.ts` (**Modify**):
  - Replace per-frame `Graphics` world-item/chest pillars with zero-alloc `Image` glow/beam/sparkle/shop-mat sprites, wire `interactableLightsScratch` into `this.lighting.update(...)`, render current `[E]` target outline highlight (`interactHighlightGraphics`), hide distant `[E]` text labels (`> 72u`), and optimize `BiomeArchitectureLiveLayer` static geometry redraws.
- `apps/client/test/polish-p6-interactable-lights.test.ts` (**Create**):
  - Unit tests verifying quota (`16/10/6`), zero-alloc scratch reuse, priority ordering (main interactables prioritized ahead of pickups), Spec 3.2 light/glow table compliance (chest 2s pulse, Epic/Legendary rarity beams, High-only pickup lights, shrine turn-off after `interacted === true`, door locked/open color transition), `alpha <= 0.35` lightmap clamp, `0.25–0.40` additive glow clamp, and active `[E]` target highlight selection.
- `tests/e2e/helpers/visual-scenes.ts` (**Modify**):
  - Refine `b1-dark-interactables` coordinates so the 5 distant interactables sit cleanly on walkable floor tiles (not overlapping the `2x2` stone pillar or top hazard) + include floor pickups, before capturing `polish-p6/before`.

---

## Task Breakdown

### Task 1: Capture P6 `before` Screenshots, Write Phase P6 Unit Tests (TDD RED → GREEN), and Implement `interactableLights`, Additive Glow Sprites, Soul Knight Rarity Beams, Chest Sparkles & `[E]` Outline Highlight

- [ ] **Step 1:** Update `b1-dark-interactables` in `tests/e2e/helpers/visual-scenes.ts` so all 5 distant interactables (`chest`, `legendary` free weapon, `rare` merchant shop weapon, `shrine`, `portal`) and floor pickups sit on clean walkable floor tiles in the far right of the room (with `props.length = 0`, no stray damage numbers), then capture the 14 Phase P6 `before` screenshots (`docs/screenshots/polish-p6/before/`).
- [ ] **Step 2 (TDD RED):** Create `apps/client/test/polish-p6-interactable-lights.test.ts` testing all Phase P6 requirements and run Vitest to record the RED failure.
- [ ] **Step 3 (TDD GREEN):** Implement `lighting-config.ts`, `lighting-pipeline.ts`, `texture-baker-fx.ts`, `texture-baker-props.ts`, `telegraphs-and-overlays.ts`, `room-entities-sync.ts`, `entity-sync.ts`, `GameScene.ts`, and `biome-architecture-render.ts`.
- [ ] **Step 4:** Verify `npx vitest run apps/client/test/polish-p6-interactable-lights.test.ts`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass. Commit Task 1 code changes.

### Task 2: Capture P6 `after` Screenshots with `--verify-freeze`, Verify 30+ Glowing Objects FPS (`>= 58 FPS`), Conduct Blind A/B `pro` Visual Gate, and Finalize Phase P6 Docs

- [ ] **Step 1:** Run `pnpm shots -- --phase p6 --label after --scenes b1-dark-interactables,b1-chest-closed-far,b1-chest-near,b1-weapon-ground-far,b1-weapon-ground-near,b1-merchant,b1-shrine,b1-door-locked,b1-door-open,b1-portal-inactive,b1-portal-active,hub-solo,b1-combat,b3-combat --verify-freeze` and verify `diffRatio < 0.005` on all 14 scenes and quantitative thresholds in `docs/screenshots/polish-p6/after/metrics.json`.
- [ ] **Step 2:** Verify in Chromium GPU that a room with **30+ glowing interactables & pickups** sustains `>= 58 FPS`.
- [ ] **Step 3:** Set up the 14-scene Blind A/B directory (`version-A` vs `version-B` + `ab-mapping.json`), run the independent `pro` Visual Reviewer Gate, save `docs/screenshots/polish-p6/review.md`, update `docs/PROGRESS.md` & `docs/PHASES.md`, and commit.
