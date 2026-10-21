# Phase P10a — Nhân vật Cutout 2.0 & Quái Full Rig: Animation, Shading 2 Lớp & Rim-Light (`cutout-rig.ts`, `cutout-rig-math.ts`, `primitives.ts`, `texture-baker.ts`, `rig-defs-*.ts`, `entity-sync.ts`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase P10a Cutout 2.0 Character & Full-Rig Enemy Animation, 2-Layer Shading & `-135°` Rim-Light defined in Spec Section 3.8 (lines 447–461) and Section 4.P10a (lines 596–599):

1. **Cutout 2.0 Rig & Parametric Animation Engine (`apps/client/src/art/cutout-rig.ts`, `apps/client/src/art/cutout-rig-math.ts`, `apps/client/src/ui/debug-overlay.ts`, `apps/client/src/scenes/ArtGalleryScene.ts`):**
   - **State Crossfade (`0.12s`, within `0.10–0.15s` spec window):** Smoothly crossfade part local transforms (`x`, `y`, `rotation`, `scaleX`, `scaleY`) and body vertical bounce (`bodyY`) when transitioning between any `RigAnimState` (`'idle' | 'run' | 'attack' | 'hurt' | 'dash' | 'cast' | 'downed' | 'revive'`), eliminating abrupt pose snapping.
   - **New Parametric Poses (`attack`, `hurt`, `dash`, `cast`, `downed`, `revive`):**
     - `attack`: Torso leans forward into the strike (`+0.18 rad`), right arm and weapon thrust/swing forward toward `localAim`, left arm counter-balances. Triggerable both explicitly via `setAnimState('attack')` and automatically during weapon recoil / melee swing bursts.
     - `hurt`: Torso & head recoil backward (`-3.4u`) and tilt backward (`-0.22 rad`), knees compress slightly. Triggerable both explicitly via `setAnimState('hurt')` and during `hitFlashTimer > 0`.
     - `dash`: Aerodynamic forward stretch (`scaleX * 1.15`, `scaleY * 0.88`), strong forward torso lean (`+0.26 rad`), trailing legs tucked back, cloak/backAccessory streaming backward. Triggerable via `setAnimState('dash')` or `setDashActive(true)`.
     - `cast`: Both arms raised upward (`-4.2u`, rotated `-0.68 rad`), weapon/staff elevated with arcane levitation bob (`bodyY = -2.8 + sin(...)`), and subtle cast pulse. Triggerable via `setAnimState('cast')` or `triggerCastPose(durationSec)`.
     - `downed` & `revive`: Smooth crossfade into knelt/slumped `downed` pose (`scaleY * 0.76`, `rotation = 0.34 * facingSign`, head drooped) and rising `revive` pose (upward stretch & recovery posture).
   - **Torso Lean by `moveDirX` (`setMoveVelocity(vx, vy)`):**
     - Torso tilts proportionally to horizontal movement (`moveDirX`, damped lerp up to `±0.16 rad`), adhering to `ART_GUIDE.md` & Spec 3.8.
   - **Deterministic Eye Blink (every 3–5s) & Head/Eye Aim Tracking:**
     - Deterministic seeded blink cycle (`3.2–4.8s` period derived from rig phase seed, `0.11s` blink duration) that smoothly squashes/closes the eye/head blink state, while head position and tilt track the cursor aim (`localAim`) smoothly.
   - **Spring Secondary Motion for `backAccessory` (cloak/hair/plume/quiver/mantle):**
     - Second-order spring-damper simulation (`stepSpring1D` / `BackAccessorySpringState`) driven by movement velocity, vertical bounce velocity, and dash/attack impulses so cloaks, plumes, leaf mantles, and quivers lag and overshoot naturally.
   - **Full Weapon Cursor Aim (Pivot at Hand) & Spring Recoil Recovery:**
     - Weapon pivots at the hand (`weaponDef.offsetX`, `weaponDef.offsetY`) and rotates **100% (`1.0 * localAim`)** toward the cursor aim angle (plus melee swing arc and minor breathing micro-motion), while `armRight` follows the hand grip.
     - Weapon recoil uses an underdamped spring recovery curve (sharp kick back along `-localAim` + muzzle climb, followed by smooth spring return).
2. **2-Layer Shading, Material Highlights & Top-Left (`-135°`) Rim-Light (`apps/client/src/art/primitives.ts`, `apps/client/src/art/texture-baker.ts`, `apps/client/src/art/rig-defs-*.ts`):**
   - Preserve crisp `INK_DARK` (`#141019`) outer outline at `2.5u` (`STANDARD_OUTLINE_WIDTH = 2.5`) and `3.5u` (`BOSS_OUTLINE_WIDTH = 3.5`) on Boss primary silhouette shapes.
   - Upgrade `outlined()` in `apps/client/src/art/primitives.ts` to render **2-layer shading + material-specific highlight + `-135°` top-left rim-light**:
     - **Layer 1 (Soft Directional Gradient):** Clipped linear gradient along the `-135° → +45°` light axis (top-left warm/bright lift `rgba(255, 252, 240, 0.12)` to bottom-right deep shadow `rgba(20, 16, 25, 0.26)`).
     - **Layer 2 (Cel-Shade Crescent):** Clipped bottom-right cel-shade ellipse using `style.shade`.
     - **Material-Specific Highlight (`style.material` or inferred from palette):**
       - `metal`: crisp angled specular streak + secondary glint (`alpha ~0.88`).
       - `cloth` / `organic`: soft matte diffused highlight (`alpha ~0.50`).
       - `crystal` / `energy`: bright glowing core + facet highlight (`alpha ~0.92`).
     - **Top-Left (`-135°`) Rim-Light Arc:** Clipped inner rim highlight along the top-left perimeter (`-135°` arc, `1.4u` width, `style.highlight ?? PALETTE.ICE_WHITE` at `alpha ~0.52`) inside the `INK_DARK` outline so characters and enemies pop cleanly from the floor across all 3 biomes.
3. **Full-Rig Enemies at High/Medium, Distinct Enemy Idle/Telegraph/Death Shatter, Footstep Dust, Softened Player Ring & Blurred Ground Shadow (`apps/client/src/scenes/game-scene/entity-sync.ts`, `GameScene.ts`, `sim-events.ts`, `combat-fx.ts`, `texture-baker.ts`):**
   - **Full Rig Enemies at High/Medium (`entity-sync.ts:234`):** Disable `useFastComposite` in normal rooms at `High` and `Medium` quality (`useFastComposite` only at `Low` quality, `sim.stressTestActive`, or distance LOD `> 420u` when `sim.enemies.length > 36`). Rebuild enemy rig if quality tier changes at runtime.
   - **Distinct Enemy Idle, Telegraph & Death Shatter:** Archetype-specific idle/telegraph motion in `CutoutRig` (slime jelly squash/stretch, floating bat/spirit/drone hover, heavy golem/shielder stomp, clear telegraph wind-up) + enhanced radial/knockback part shatter on death in `spawnEnemyDeathBurst`.
   - **Running Footstep Dust (`spawnFootstepDust`):** Emit subtle biome-tinted footstep dust puffs at the feet of running players and ground enemies on stride contact frames.
   - **Softened Player Slot Ring & Blurred Elliptical Ground Shadow (`texture-baker.ts`):** Multi-stop radial gradient ground shadow (`bakeShadow`) with soft feathered edge, and softened radial-gradient + dual-ring player slot indicator (`bakePlayerRing`).

**Architecture:**
- `apps/client/src/art/cutout-rig-math.ts`: Pure deterministic pose evaluation, `0.12s` state crossfade blending, `moveDirX` torso lean, seeded `3–5s` eye blink & head/eye aim tracking, second-order `backAccessory` spring solver, weapon spring recoil solver, and enemy archetype motion modifiers.
- `apps/client/src/art/cutout-rig.ts`: Phaser Container/Sprite integration consuming `cutout-rig-math.ts`.
- `apps/client/src/art/primitives.ts`, `apps/client/src/art/texture-baker.ts`, `apps/client/src/art/rig-defs-*.ts`: 2-layer shading, material highlights, `-135°` rim-light, `3.5u` boss outlines, softened player slot ring, and blurred elliptical ground shadow.
- `apps/client/src/scenes/game-scene/entity-sync.ts`, `GameScene.ts`, `sim-events.ts`, `apps/client/src/fx/combat-fx.ts`: Full-rig enemies at High/Medium, `moveVelocity` & `cast`/`hurt`/`attack`/`dash` triggers, running footstep dust, and enemy death part shatter.
- Every source file strictly `< 1000` lines.

**Tech Stack:** TypeScript, Phaser 3, Canvas2D Procedural Texture Baker, Vitest, Playwright (`pnpm shots`, `pnpm perf`, `pnpm verify`).

---

## Global Constraints (from Spec 0.3, 0.6 & Section 7)

- `pnpm verify` green: `typecheck`, `lint`, `test`, `build`, `e2e`. Never skip or delete tests to make them pass.
- 0 console errors/warnings in E2E.
- Performance: Stress test (`__GAME_STRESS_TEST__`, 4P + 80 enemies + 600 bullets) at 1080p High `>= 58 FPS` average with VSync on, and uncapped frame time `p95 <= 15.0ms`; normal scenes `>= 60 FPS`.
- Every source file strictly `< 1000` lines.

## Review Focus (Top 5 Risk Areas & Owning Tasks)

1. **Deterministic Animation & Freeze Mode (`?freeze=1`):** Eye blink (`3–5s`), spring secondary motion, state crossfade (`0.10–0.15s`), and footstep dust must be 100% deterministic under `stepDeterministicFrames` (`diffRatio <= 0.005` on `--verify-freeze`) → Owned by **Task 1** & **Task 2**.
2. **Weapon 100% Cursor Aim & Hand Pivot:** Weapon must point directly along `localAim` (`1.0 * localAim` around hand pivot) without detaching from `armRight` when flipping `facingSign` (`+1` vs `-1`) → Owned by **Task 1**.
3. **2-Layer Shading & `-135°` Top-Left Rim-Light Silhouette Separation:** Characters and enemies must stand out clearly against Biome 1, 2, and 3 floors with a crisp `2.5u` (`3.5u` boss) `INK_DARK` outline and `-135°` top-left rim-light without washing out palette colors → Owned by **Task 2**.
4. **Full-Rig Enemies at High/Medium vs Stress Test FPS (`>= 58 FPS`):** Normal rooms at High/Medium must use full 8-part enemy rigs (`useFastComposite = false`), while `stress-4p` (`80` enemies + `600` bullets) maintains `>= 58 FPS` VSync / `p95 <= 15.0ms` uncapped → Owned by **Task 2** & **Task 3**.
5. **E2E Compatibility (`phase0` Gallery Control Bar):** Existing `ArtGalleryScene` control bar button coordinates (`Anim: IDLE`, `Anim: RUN`, `P1–P4`, `Biome 1–3`) must remain untouched so `tests/e2e/phase0.spec.ts` passes without modification → Owned by **Task 1**.

---

## Task Breakdown

### Task 1: Add Phase P10a Visual Scenes (`SCENE_GROUPS.p10a`), Capture `before` Screenshots & Strips, and Implement Cutout 2.0 Parametric Animation Engine (`cutout-rig-math.ts`, `cutout-rig.ts`, `ArtGalleryScene.ts`) (TDD RED → GREEN)

- [x] **Step 1:** Create `tests/e2e/helpers/visual-scene-p10a-helpers.ts`, register `SCENE_GROUPS.p10a` (19 scenes including 10 8-frame `-strip.png` strips for `idle`, `run`, `attack`, `dash`, `hurt`, and state-crossfade in `ArtGalleryScene` and in-game for the 5 heroes + 3 representative enemies across Biomes 1–3) in `visual-scene-p9a-helpers.ts` and `tools/run-shots.ts`, and capture `docs/screenshots/polish-p10a/before/` with `--verify-freeze`.
- [x] **Step 2 (TDD RED):** Create `apps/client/test/polish-p10a-cutout-rig.test.ts` testing:
  - `0.12s` state crossfade (`idle -> run -> attack -> hurt -> dash -> cast -> downed -> revive`) with zero discontinuity at state switch `t = 0`.
  - Torso lean proportional to `moveDirX`.
  - Deterministic `3–5s` eye blink cycle and head/eye tracking toward `localAim`.
  - Second-order spring secondary motion on `backAccessory`.
  - Full `1.0 * localAim` weapon rotation around hand pivot + spring recoil recovery.
  - Archetype-specific enemy idle/telegraph modifiers.
- [x] **Step 3 (TDD GREEN):** Implement `apps/client/src/art/cutout-rig-math.ts` and update `apps/client/src/art/cutout-rig.ts`, `apps/client/src/ui/debug-overlay.ts`, and `apps/client/src/scenes/ArtGalleryScene.ts` (preserving `phase0.spec.ts` button coordinates).
- [x] **Step 4:** Run Vitest unit tests, `pnpm typecheck`, and `pnpm lint`, verify all files `< 1000` lines, and commit Task 1 (`254625b`).

### Task 2: Implement 2-Layer Shading, Material Highlights, `-135°` Rim-Light, Boss `3.5u` Outlines, Softened Player Ring & Blurred Shadow, Full-Rig Enemies at High/Medium, and Footstep Dust (TDD RED → GREEN)

- [x] **Step 1 (TDD RED):** Extend `apps/client/test/polish-p10a-cutout-rig.test.ts` with tests for:
  - Material inference & 2-layer shading + `-135°` rim-light parameters in `primitives.ts`.
  - Boss primary outline width (`3.5u` vs standard `2.5u`).
  - `shouldUseEnemyFastComposite` logic (`false` for High/Medium in normal rooms, `true` for Low quality or stress test / distance LOD fallback).
  - Running footstep dust cadence and enemy death part shatter burst parameters.
- [x] **Step 2 (TDD GREEN):**
  - Update `apps/client/src/art/primitives.ts` and `apps/client/src/art/rig-defs-biome1-boss-hub.ts`, `rig-defs-biome2-boss.ts`, `rig-defs-biome3-boss.ts` for 2-layer shading (soft gradient + cel-shade), material-specific highlights (`metal`, `cloth`, `crystal`, `organic`), `-135°` top-left rim-light arc, and `3.5u` boss outlines.
  - Update `apps/client/src/art/texture-baker.ts` (`bakeShadow` blurred radial-gradient elliptical shadow, `bakePlayerRing` softened under-foot slot ring + gradient aura, and eye-blink / cast ring support).
  - Update `apps/client/src/scenes/game-scene/entity-sync.ts`, `GameScene.ts`, `sim-events.ts`, and `apps/client/src/fx/combat-fx.ts` so enemies use full rigs at High/Medium, players/enemies pass `moveVelocity` and trigger `attack`/`hurt`/`dash`/`cast`/`downed`/`revive` poses, running entities emit footstep dust (`spawnFootstepDust`), and enemy death shatters all rig parts cleanly.
- [x] **Step 3:** Add E2E test `tests/e2e/polish-p10a.spec.ts` verifying Cutout 2.0 poses in `ArtGalleryScene`, full-rig enemies (`fastComposite === false`) in High/Medium combat rooms, and 0 console errors/warnings. Run `pnpm verify` and commit Task 2 (`ae58e03`).

### Task 3: Capture P10a `after` Screenshots & 8-Frame Strips with `--verify-freeze`, Conduct Blind A/B `pro` Visual Gate, Run Phase P10a Quality Gate, and Tag `polish-p10a`

- [x] **Step 1:** Run `pnpm shots -- --phase p10a --label after --group p10a --verify-freeze` and verify all 19 scenes + 10 8-frame strips pass `freezeDiffRatio <= 0.005` (`freezeDiffRatio <= 0.000022`).
- [x] **Step 2:** Set up the Blind A/B directory (`version-A` vs `version-B` with `ab-mapping.json` isolated outside `blind-ab/` during review), dispatch the independent `pro` Visual Reviewer subagent (`7d798028`) to inspect static images and 8-frame animation strips, and record results in `docs/screenshots/polish-p10a/review.md` (**PASS** — 19/19 = 100% accurate identification, Criterion 7 `Nhân vật & animation = 9.3/10`, Criterion 3 `Độ dễ đọc trong combat = 9.2/10`, `0` Blockers, `0` Majors).
- [x] **Step 3:** Run fresh `pnpm verify` (`175 passed` unit tests, `13 passed` E2E specs) and `pnpm perf` (Normal `p50=4.3ms`, `p95=5.485ms`, `60 FPS`; Stress `p50=8.0ms`, `p95=9.9ms`, `60.05 FPS`), update `docs/PROGRESS.md` & `docs/PHASES.md`, commit, and tag `polish-p10a`.
