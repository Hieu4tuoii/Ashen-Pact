# Phase P8 — Cổng Dịch Chuyển & Cổng Qua Phòng (`PortalVortexPipeline`, `DoorBarrierPipeline`, Multi-Layer Portal/Door Rig, Activation Burst, Enter Stretch/Spiral, Door Lock-up/Dissolve, Low Fallback) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase P8 multi-layer floor/Hub portals and biome room doors with per-object GLSL shaders, state transitions, animations, and Low-quality sprite fallbacks defined in Spec Section 3.4 (lines 331–348) and Section 4.P8 (lines 585–587):
1. **Multi-Layer Floor & Hub Portals (replacing flat `portal_active`):**
   - Engraved stone pedestal (`portal_pedestal_base` + `portal_pedestal_runes` baked textures).
   - Per-object GLSL `PortalVortexPipeline` (`Phaser.Renderer.WebGL.Pipelines.SinglePipeline` on the vortex disc sprite) with polar coordinate swirl noise, bright glowing eye core, luminous rim ring, breathing pulse, and expanding shockwave burst.
   - Spiral suction particles (`fx_sparkle_mote`) pulling into the center + rising energy rays (`portal_energy_ray`).
   - Pulsing dynamic light & additive glow (`lighting-config.ts`).
   - **4 Portal States & Transitions:**
     - `dungeon_inactive`: visible in `portal` rooms before waves are cleared; dark gray-purple, slow vortex spin, muted glow.
     - `dungeon_active`: after room clear, plays a `0.6–0.8s` (`0.72s`) **activation burst** (expanding shockwave ring + flash + SFX), then settles into vibrant purple (`#A855F7`) + cyan core (`#22D3EE`) steady state.
     - **Player Enter (`0.30s`):** when the player interacts with an active portal, plays a `0.30s` stretch/spiral pull-in animation toward the portal center + flash before triggering the Iris close and floor/run transition.
     - **Hub Departure Portal:** same visual family in the Hub courtyard — cool slate-blue (`#64748B` / `#38BDF8`) while waiting (`hub_waiting`), warm solar gold (`#F59E42` / `#FACC15` / `#FEF08A`) when all players are Ready (`hub_ready`).
2. **Biome Room Doors & Energy Barriers (replacing square `door_open` / `door_locked`):**
   - Distinct 3/4 perspective stone/metal archway frames per biome (`0..3`) and orientation: horizontal `door_frame_ns_<biome>` (`68×52`) for North/South doors and vertical `door_frame_ew_<biome>` (`52×68`) for East/West doors — **zero `90°` rotation distortion** (`frameRotationRad === 0`).
   - **Locked state:** translucent dark crimson energy barrier (`#7F1D1D` / `#DC2626` / `#F87171`) using `DoorBarrierPipeline` (scrolling hexagonal grid + central arcane lock seal), rising ember motes, and red lock-lamp indicators on the jambs.
   - **Unlock transition (`380ms` = `300–450ms`):** barrier dissolves via procedural noise with a molten orange-gold burning rim (`#F97316` / `#FEF08A`) + spark burst, leaving a soft luminous threshold veil (`door_open_arch_ns` / `door_open_arch_ew`) tinted with the biome's accent color.
   - **Combat room entry (`250ms`):** barrier erects from bottom to top over `250ms` with a bright leading beam and lock SFX.
3. **Low Quality Fallback (`quality === 'low'` or WebGL shader fallback):**
   - Disables custom GLSL pipelines (`useShader === false`) and renders multi-layer counter-rotating baked vortex sprites (`portal_vortex_disc` + `portal_vortex_core`) and baked translucent energy barriers (`door_barrier_ns` / `door_barrier_ew`) with smooth scale/alpha transitions.

**Architecture:**
- `apps/client/src/fx/portal-door-shaders.ts`: Pure visual state & animation resolvers (`resolvePortalVisualState`, `stepPortalAnimState`, `resolveDoorVisualState`, `stepDoorAnimState`) + WebGL `PortalVortexPipeline` and `DoorBarrierPipeline`.
- `apps/client/src/art/texture-baker-portals-doors.ts` (wired into `apps/client/src/art/texture-baker.ts`): Bakes `portal_pedestal_base`, `portal_pedestal_runes`, `portal_vortex_disc`, `portal_vortex_core`, `portal_energy_ray`, `door_frame_ns_0..3`, `door_frame_ew_0..3`, `door_barrier_ns`, `door_barrier_ew`, `door_open_arch_ns`, `door_open_arch_ew`.
- `apps/client/src/scenes/game-scene/portal-door-sync.ts`: Multi-layer Phaser GameObject lifecycle, per-frame zero-allocation sync, particle pools, activation burst, `0.30s` player enter sequence, and door lock-up/unlock transitions, integrated into `GameScene.ts`, `room-entities-sync.ts`, `input-and-network.ts`, `sim-events.ts`, and `lighting-config.ts`.
- Every file strictly `< 1000` lines.

**Tech Stack:** TypeScript, Phaser 3 WebGL (`SinglePipeline`), Vitest, Playwright (`pnpm shots`, `pnpm perf`, `pnpm verify`).

---

## Global Constraints (from Spec 0.3, 0.6 & Section 7)

- `pnpm verify` green: `typecheck`, `lint`, `test`, `build`, `e2e`. Never skip or delete tests to make them pass.
- 0 console errors/warnings in E2E (including zero WebGL shader compilation or uniform errors).
- Performance: Stress test (`__GAME_STRESS_TEST__`, 4P + 80 enemies + 600 bullets) at 1080p High `>= 58 FPS` average with VSync on, and uncapped frame time `p95` within `+15%` of P0 baseline; normal scenes `>= 60 FPS`.
- Co-op unbroken (`tests/e2e/phase4.spec.ts` passes).
- Zero memory allocations in hot per-frame loops (reuse persistent sprites, uniform state objects, and particle pools).
- Every source file strictly `< 1000` lines.

## Review Focus (Top 5 Risk Areas & Owning Tasks)

1. **WebGL Batch Flushing for Per-Object Uniforms:** Multiple doors in the same room share `DoorBarrierPipeline` with different `uIsVertical`, `uLockupProgress`, or `uDissolveProgress` values; failing to flush in `onBind(gameObject)` when `vertexCount > 0` would overwrite uniforms across doors → Owned by **Task 1** (`PortalVortexPipeline.onBind` & `DoorBarrierPipeline.onBind` flush before setting per-sprite uniforms).
2. **N/S vs E/W Door Perspective Distortion:** Rotating a single door sprite by `90°` (`Math.PI / 2`) breaks `-135°` top-left lighting and 3/4 cliff perspective → Owned by **Task 1** (`door_frame_ns_<biome>` vs `door_frame_ew_<biome>` native 3/4 baked textures + unit test asserting `frameRotationRad === 0` for all 4 directions).
3. **Portal Enter Sequence vs Direct `sim.interactWithNearest()` Calls in Tests/E2E:** Existing tests or scenes (`modal-buff`, `phase1`–`phase8`) that call `sim.interactWithNearest()` directly in page.evaluate must still advance immediately, while player `[E]` input (or `triggerPortalEnterSequence()`) plays the `0.30s` stretch/spiral enter animation before committing portal traversal → Owned by **Task 2**.
4. **Deterministic Freeze & Strip Capture (`?freeze=1`):** Portal/door animations (`b1-portal-active`, `b1-portal-burst`, `b1-portal-enter`, `b1-door-unlock`, `b1-door-lockup`) must advance deterministically in 8-frame strips while remaining 100% frozen (`diffRatio < 0.005`) on static `--verify-freeze` captures → Owned by **Task 2** & **Task 3**.
5. **Low Quality Visual Parity:** `b1-portal-active-low` and `b1-door-locked-low` must look crisp, layered, and magical using counter-rotating baked sprites without GLSL shaders → Owned by **Task 1**, **Task 2**, & **Task 3**.

---

## File Structure & Responsibilities

- `tests/e2e/helpers/visual-scenes.ts` (**Modify in Task 1**):
  - Add 8 deterministic Phase P8 scenes (`hub-portal-ready`, `b1-portal-burst`, `b1-portal-enter`, `b1-door-ns-locked`, `b1-door-ns-open`, `b1-door-unlock`, `b1-door-lockup`, `b1-door-locked-low`) and set `stripFramesPerStep: 5` on `b1-portal-active`.
- `apps/client/src/fx/portal-door-shaders.ts` (**Create in Task 1**):
  - Pure resolvers & animation steppers (`resolvePortalVisualState`, `stepPortalAnimState`, `resolveDoorVisualState`, `stepDoorAnimState`) + `PortalVortexPipeline` and `DoorBarrierPipeline` WebGL pipelines.
- `apps/client/src/art/texture-baker-portals-doors.ts` (**Create in Task 1**) & `apps/client/src/art/texture-baker.ts` (**Modify in Task 1**):
  - Bake all multi-layer portal and biome N/S + E/W door textures and register them in `TextureBaker.bakeAll`.
- `apps/client/test/polish-p8-portal-door.test.ts` (**Create in Task 1**):
  - Unit tests for portal states (`dungeon_inactive`, `dungeon_active`, `hub_waiting`, `hub_ready`), `0.72s` activation burst, `0.30s` player enter animation, N/S vs E/W door visual states with `frameRotationRad === 0`, `380ms` unlock dissolve, `250ms` combat lock-up, and Low-quality fallback.
- `apps/client/src/scenes/game-scene/portal-door-sync.ts` (**Create in Task 2**) & `GameScene.ts`, `room-entities-sync.ts`, `input-and-network.ts`, `sim-events.ts`, `lighting-config.ts` (**Modify in Task 2**):
  - Wire multi-layer portal & door rendering, shaders, particle pools, sound effects, activation burst, `0.30s` player enter stretch/spiral sequence, and door lock-up/unlock transitions into `GameScene`.

---

## Task Breakdown

### Task 1: Add Phase P8 Visual Scenes, Capture P8 `before` Screenshots, and Implement Portal/Door State Resolvers, GLSL Pipelines & Baked Textures (TDD RED → GREEN)

- [x] **Step 1:** Add the 8 new Phase P8 visual scenes (`hub-portal-ready`, `b1-portal-burst`, `b1-portal-enter`, `b1-door-ns-locked`, `b1-door-ns-open`, `b1-door-unlock`, `b1-door-lockup`, `b1-door-locked-low`) and `stripFramesPerStep: 5` on `b1-portal-active` in `tests/e2e/helpers/visual-scenes.ts`. Capture all 17 Phase P8 `before` screenshots (`docs/screenshots/polish-p8/before/`).
- [x] **Step 2 (TDD RED):** Create `apps/client/test/polish-p8-portal-door.test.ts` testing `resolvePortalVisualState`, `stepPortalAnimState`, `resolveDoorVisualState`, and `stepDoorAnimState`; run Vitest to record the RED failure.
- [x] **Step 3 (TDD GREEN):** Implement `apps/client/src/fx/portal-door-shaders.ts` (`PortalVortexPipeline`, `DoorBarrierPipeline`, and pure state/animation functions) and `apps/client/src/art/texture-baker-portals-doors.ts` (wired into `apps/client/src/art/texture-baker.ts`).
- [x] **Step 4:** Verify `npx vitest run apps/client/test/polish-p8-portal-door.test.ts`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass. Commit Task 1 changes.

### Task 2: Integrate Multi-Layer Portals & Biome Doors, Activation Burst (`0.72s`), Player Enter Stretch/Spiral (`0.30s`), Door Lock-up (`250ms`) & Unlock Dissolve (`380ms`), and Low Quality Fallback into `GameScene`

- [ ] **Step 1 (TDD RED):** Extend `apps/client/test/polish-p8-portal-door.test.ts` with tests for portal particle/ray descriptors, inactive dungeon portal light/glow specs, and door transition triggers on room clear / combat room entry; run Vitest to record the RED failure.
- [ ] **Step 2 (TDD GREEN):** Implement `apps/client/src/scenes/game-scene/portal-door-sync.ts` and wire it into `GameScene.ts`, `room-entities-sync.ts`, `input-and-network.ts`, `sim-events.ts`, and `lighting-config.ts` (all files `< 1000` lines, zero per-frame allocations).
- [ ] **Step 3:** Verify `npx vitest run apps/client/test/polish-p8-portal-door.test.ts`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass. Commit Task 2 changes.

### Task 3: Capture P8 `after` Screenshots with `--verify-freeze`, Conduct Blind A/B `pro` Visual Gate, Run Phase P8 Quality Gate, and Tag `polish-p8`

- [ ] **Step 1:** Run `pnpm shots -- --phase p8 --label after --scenes hub-solo,hub-portal-ready,hub-coop-2p,b1-portal-inactive,b1-portal-active,b1-portal-burst,b1-portal-enter,b1-portal-active-low,b1-door-locked,b1-door-open,b1-door-ns-locked,b1-door-ns-open,b1-door-unlock,b1-door-lockup,b1-door-locked-low,b2-start-room,b3-start-room --verify-freeze` and verify `diffRatio < 0.005` on all 17 scenes.
- [ ] **Step 2:** Set up the 17-scene Blind A/B directory (`version-A` vs `version-B` + `ab-mapping.json`), dispatch the independent `pro` Visual Reviewer subagent, and record results in `docs/screenshots/polish-p8/review.md`.
- [ ] **Step 3:** Run fresh `pnpm verify` and `pnpm perf`, update `docs/PROGRESS.md` & `docs/PHASES.md`, commit, and tag `polish-p8`.
