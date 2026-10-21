# Implementation Plan — Phase P10b: FX, Phản Ứng Nguyên Tố & Hạt Môi Trường Trong Trẻo (`polish-p10b`)

## 1. Goal & Scope

Implement Spec Section 3.9 and Section 4.P10b (`docs/superpowers/specs/2026-10-20-polish-v0.2.0-design.md`):

1. **Additive (`BlendMode.ADD`) Combat FX Above Lightmap (`depth > 34`) & Enemy Bullet Salience (`depth = 60`):**
   - All glowing FX (sparks, spark trails, impact rings, shockwave rings, multi-layer muzzle flashes, slash arcs, elemental reaction bursts, rarity beams, spawn pillars, fireflies, rising embers, torch dust motes) use `Phaser.BlendModes.ADD` and render above `lightmapRt` (`depth > 34`).
   - Physical opaque particles (`fx_shell_casing`, `fx_wood_shard`, `fx_dust_puff`, enemy death rig parts) explicitly reset `BlendModes.NORMAL`.
   - Enemy projectiles (`proj_enemy_orb`, `proj_stress_enemy`) strictly maintain their **near-white core (`#FFFDF5`) + `#E84545` crimson body + `1.5u` `INK_DARK` (`#141019`) outline** across all biomes without elemental tint overrides, and render at `depth = 60` above combat FX so no explosion, shockwave, or teammate FX ever obscures an enemy bullet.
2. **Hit Sparks with Short Trails, `easeOutCubic` Impact Rings, Multi-Layer Muzzle Flash & Shell Casing Shadows:**
   - Bake `fx_impact_ring`, `fx_shockwave_ring`, `fx_spark_trail`, and `fx_muzzle_core` in `apps/client/src/art/texture-baker-fx.ts`.
   - `spawnHitSparks`: spawns an `easeOutCubic` expanding impact ring (`fx_impact_ring`, `BlendMode.ADD`) plus directional spark streaks (`fx_spark_trail` + `fx_spark`, `BlendMode.ADD`) stretched along their velocity vector.
   - `spawnMuzzleFlashAndCasing`: spawns a 2-layer additive muzzle flash (`fx_muzzle_flash` outer star cone + `fx_muzzle_core` white-gold core) and an ejected brass shell casing (`fx_shell_casing`) with a ground drop shadow (`hasGroundShadow: true`) that tracks beneath the casing as it arcs and bounces.
3. **Elemental Combo FX (`spawnElementalReactionFx`):**
   - Triggering any of the 6 Elemental Reactions (*Hơi Nước / Vaporize*, *Vỡ Băng / Shatter*, *Siêu Dẫn / Superconduct*, *Nổ Độc / Toxic Blast*, *Tê Liệt / Paralysis*, *Quá Tải / Overload*) spawns:
     - Fast-expanding `easeOutCubic` primary + inner shockwave rings (`fx_shockwave_ring`, `BlendMode.ADD`).
     - Reaction-specific `BlendMode.ADD` elemental particle bursts.
     - Coalesced combo text within a `0.4s` window (`"HƠI NƯỚC ×3"`, etc.) both in the top-center reaction banner and as an in-place coalesced world callout.
4. **Clear Biome Ambient Particles (Zero Fog — Remove `fx_ambient_mist`) & Torch Light Motes:**
   - Completely remove `fx_ambient_mist` from `apps/client/src/art/texture-baker-fx.ts`.
   - **Biome 1:** Drifting forest leaves (`fx_ambient_leaf`, `NORMAL`) + glowing fireflies (`fx_ambient_firefly`, `BlendMode.ADD`, pulsing lime/gold).
   - **Biome 2:** `60–80` soft round `2–4px` un-outlined snowflakes (`fx_ambient_snow`) with sinusoidal horizontal sway and **2-layer parallax** (foreground vs background speed/scale/alpha).
   - **Biome 3:** Small rising embers `<= 4px` without outline (`fx_ember_mote`, `BlendMode.ADD`, `vy < 0`), never using the `6–14px` white-core + dark-outline enemy bullet pattern.
   - **Torch Braziers:** Tiny glowing dust motes (`BlendMode.ADD`) hovering inside the warm light pools of `torch_brazier` props.
5. **Chest Opening Arc + Lid Bounce + Rarity Pillar, Enemy Spawn Rune Circle + Short Light Pillar, Smooth Iris Transition & Boss Kill Slow-Mo + Flash:**
   - `openChestImpl` sets `fromX`, `fromY`, and `droppedAtTick` on chest-spawned `worldItems` so weapons arc out along a parabolic trajectory; `chest_opened` triggers a lid-pop bounce (`easeOutBack`), a vertical rarity light pillar (`fx_rarity_beam`, `BlendMode.ADD`), and rising sparkle motes.
   - `aiState === 'spawning'` renders a double-ring magic summoning circle with counter-rotating geometric runes + a short vertical additive light pillar.
   - Boss death triggers a dramatic slow-mo (`0.42s` at `0.25x` sim speed) + additive flash & double shockwave ring burst; iris transition uses `easeInOutCubic` with a dual-ring golden rim.
   - Teammate FX respect `graphicsSettings.getState().teammateFxOpacity`.

---

## 2. File Structure & Line-Budget Plan (All Files `< 1000` Lines)

- `tests/e2e/helpers/visual-scene-p10b-helpers.ts` (New, ~360 lines): Deterministic `SCENE_GROUPS.p10b` (16 scenes including 9 8-frame `-strip.png` scenes + `b3-combat-grayscale.png`).
- `tests/e2e/helpers/visual-scenes.ts` & `tools/run-shots.ts`: Register `SCENE_GROUPS.p10b`.
- `apps/client/src/art/texture-baker-fx.ts` (~620 lines): Remove `fx_ambient_mist`; bake `fx_impact_ring`, `fx_shockwave_ring`, `fx_spark_trail`, `fx_muzzle_core`, `fx_ambient_firefly`, `fx_ambient_snow`; enforce `1.5u` `INK_DARK` outline + `#E84545` body + centered `#FFFDF5` core on `proj_enemy_orb` & `proj_stress_enemy`.
- `apps/client/src/fx/combat-fx-pools.ts` (~680 lines): Support `blendMode`, `easeCurve`, directional stretch (`stretchBySpeed`), ground shadow rendering for shell casings, 2-layer parallax snow (`60–80` count at High), B1 fireflies/leaves, B3 `<= 4px` rising embers, and torch light pool dust motes.
- `apps/client/src/fx/combat-fx-spawners.ts` (New, ~480 lines): Extracted particle/FX spawner implementations (`spawnMuzzleFlashAndCasing`, `spawnHitSparks`, `spawnExplosionBurst`, `spawnElementalReactionFx`, `spawnChestOpenBurst`, `spawnBossKillBurst`, `spawnTorchLightMotes`, etc.) so `combat-fx.ts` stays compact (`< 600` lines).
- `apps/client/src/fx/combat-fx.ts` (~520 lines): Public `CombatFxManager` facade, slow-mo timer (`bossKillSlowMoTimer`, `bossKillFlashTimer`), and coalesced reaction state.
- `packages/shared/src/sim/sim-dungeon-rooms.ts` (~875 lines): Set `fromX`, `fromY`, `droppedAtTick` on `worldItems` spawned by `openChestImpl`.
- `apps/client/src/scenes/game-scene/sim-events.ts` (~580 lines), `entity-sync.ts` (~625 lines), `room-entities-sync.ts` (~710 lines), `telegraphs-and-overlays.ts` (~740 lines), `arena-tiles.ts` (~875 lines): Wire chest open burst & lid bounce, enemy spawn rotating rune circle + short light pillar, boss kill slow-mo + flash, teammate FX opacity, and untinted `depth = 60` enemy bullets.
- `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts` (New, ~260 lines): Unit tests for P10b FX, elemental combo coalescing & shockwaves, biome ambient particles (`0` mist, `60–80` B2 snow 2-layer parallax, `<= 4px` B3 embers), enemy bullet shape/color invariants, chest open loot arc, and boss kill slow-mo.
- `tests/e2e/polish-p10b.spec.ts` (New, ~200 lines): Playwright E2E test verifying P10b FX, elemental reactions, chest open arc, ambient particles across B1/B2/B3, and enemy bullet readability.

---

## 3. Tasks

### Task 1: Add Phase P10b Visual Scenes (`SCENE_GROUPS.p10b`), Capture `before` Screenshots & 8-Frame Strips, and Implement Core FX Upgrade (`BlendMode.ADD`, Hit Spark Trail + Impact Ring, Multi-Layer Muzzle Flash + Casing Shadow, Elemental Combo FX, and Clear Biome Ambient Particles)

- [x] **Step 1:** Create `tests/e2e/helpers/visual-scene-p10b-helpers.ts`, register `p10b` in `visual-scenes.ts` and `tools/run-shots.ts`, and capture `docs/screenshots/polish-p10b/before/` with `pnpm shots -- --phase p10b --label before --group p10b --verify-freeze` BEFORE changing FX production rendering.
- [x] **Step 2 (TDD RED):** Create `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts` testing:
  - `fx_ambient_mist` is completely absent and B1/B2/B3 ambient configs produce crisp leaves+fireflies (B1), `60–80` 2–4px round 2-layer parallax snow (B2), and `<= 4px` rising un-outlined embers (B3) + torch brazier dust motes.
  - Glowing FX (`fx_spark`, `fx_spark_trail`, `fx_impact_ring`, `fx_shockwave_ring`, `fx_muzzle_flash`, `fx_muzzle_core`) use `BlendMode.ADD` and `depth > 34`, while `fx_shell_casing` uses `NORMAL` and renders a ground shadow.
  - `spawnElementalReactionFx` spawns `easeOutCubic` shockwave rings + `BlendMode.ADD` elemental particles and coalesces reaction labels (`"HƠI NƯỚC ×3"`) within `0.4s`.
  - Enemy bullet spec (`proj_enemy_orb`) preserves `#E84545` body + `#FFFDF5` core + `1.5u` `INK_DARK` outline in all biomes (`tint === 0xffffff`, `depth = 60`).
- [x] **Step 3 (TDD GREEN):** Implement `texture-baker-fx.ts`, `combat-fx-pools.ts`, `combat-fx-spawners.ts`, and `combat-fx.ts`.
- [x] **Step 4:** Run Vitest, `pnpm typecheck`, and `pnpm lint`, verify all files `< 1000` lines, and commit Task 1 (`5d117d8`).

### Task 2: Wire Chest Open Arc + Lid Pop + Rarity Pillar, Enemy Spawn Rotating Rune Circle + Light Pillar, Boss Kill Slow-Mo + Flash, Teammate FX Opacity, Enemy Bullet Guardrails & E2E Spec (`tests/e2e/polish-p10b.spec.ts`)

- [x] **Step 1 (TDD RED):** Extend `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts` with tests for:
  - `openChestImpl` setting `fromX`, `fromY`, `droppedAtTick` on chest-spawned `worldItems` + chest lid pop bounce & rarity pillar burst.
  - Enemy spawn (`aiState === 'spawning'`) rotating rune circle geometry & short vertical light pillar parameters.
  - Boss kill slow-mo time scale & flash burst + `easeInOutCubic` iris transition.
  - Teammate FX opacity scaling (`teammateFxOpacity`).
- [x] **Step 2 (TDD GREEN):** Update `packages/shared/src/sim/sim-dungeon-rooms.ts`, `apps/client/src/scenes/game-scene/sim-events.ts`, `entity-sync.ts`, `room-entities-sync.ts`, `telegraphs-and-overlays.ts`, `arena-tiles.ts`, and `GameScene.ts`.
- [x] **Step 3:** Create `tests/e2e/polish-p10b.spec.ts`, run `pnpm verify`, restore any legacy screenshots dirtied by `pnpm e2e`, verify all files `< 1000` lines, and commit Task 2.

### Task 3: Capture P10b `after` Screenshots & 8-Frame Strips with `--verify-freeze`, Conduct Blind A/B `pro` Visual Gate, Run Phase P10b Quality Gate, and Tag `polish-p10b`

- [ ] **Step 1:** Run `pnpm shots -- --phase p10b --label after --group p10b --verify-freeze` and verify all 16 scenes + 9 8-frame strips + `b3-combat-grayscale.png` pass `freezeDiffRatio <= 0.005`.
- [ ] **Step 2:** Set up per-scene randomized Blind A/B folders (`version-A` vs `version-B` with `ab-mapping.json` isolated outside `blind-ab/` during review), dispatch the independent `pro` Visual Reviewer subagent to inspect all static images, `b3-combat-grayscale.png`, and 8-frame animation strips, and save `docs/screenshots/polish-p10b/review.md` (Target: Criterion 8 `FX & hạt >= 8.0/10`, Criterion 3 `Độ dễ đọc trong combat >= 8.0/10`, `0` Blockers, `0` Majors).
- [ ] **Step 3:** Run fresh `pnpm verify` and `pnpm perf`, update `docs/PROGRESS.md` & `docs/PHASES.md`, commit, and tag `polish-p10b`.
