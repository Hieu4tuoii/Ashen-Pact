# Ashen Pact 2.0 — Phase P1C Implementation Plan: 3 Remaining Room Archetypes & Biome 2 + Biome 3 Interactive Ecosystems

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the remaining 3 Tactical Room Archetypes (`CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, `CRUMBLING_PILLAR_RING`) and the complete Biome 2 (Frozen Depths) & Biome 3 (Molten Forge) survival laws, 6 interactive props (`glacial_barricade`, `sliding_ice_block`, `cryo_prism_pillar`, `forge_blast_shield`, `pneumatic_press`, `slag_crucible`), procedural textures/VFX, and Engine 2.6 visual verification scenes.

**Architecture:**
- Keep all `.ts` files strictly `< 1000 lines` by placing new P1C room geometry in `packages/shared/src/sim/arena-room-archetypes-p1c.ts`, new Biome 2 & Biome 3 laws/props in `packages/shared/src/sim/sim-tactical-physics-p1c.ts`, new procedural prop textures in `apps/client/src/art/texture-baker-props-p1c.ts`, new P1C combat VFX in `apps/client/src/fx/combat-fx-p1c.ts`, and new Engine 2.6 visual scenes in `tests/e2e/helpers/visual-scene-ap2-p1c.ts`.
- All simulation logic uses `WorldSim.rng` (zero `Math.random()`) and deterministic 60Hz tick timers.

---

## Task 1 (`P1C.1`): 3 Remaining Room Archetypes (`CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, `CRUMBLING_PILLAR_RING`)

**Files:**
- Create: `packages/shared/src/sim/arena-room-archetypes-p1c.ts`
- Modify: `packages/shared/src/sim/arena-room-archetypes.ts`
- Modify: `packages/shared/src/sim/arena-map.ts`
- Test: `packages/shared/test/ap2-p1c-room-archetypes.test.ts`

- [ ] **Step 1: Write failing unit tests in `packages/shared/test/ap2-p1c-room-archetypes.test.ts`**
  - Verify `CROSSFIRE_CONVEYORS` builds two 3-tile-wide parallel conveyor/current lanes (`ty: 6..8` flowing East `+1`, `ty: 13..15` flowing West `-1`, mirrored under `flipX`/`flipY`) that push players, enemies, and sliding props at `110 px/s`.
  - Verify `PRISM_LABYRINTH` places 5 staggered `2×4` cover walls in a checkerboard layout, interleaved with biome-specific `pillar_toy` (`cryo_prism_pillar` / `rotten_totem_pillar` / `pneumatic_press`), barricades, and hazards.
  - Verify `CRUMBLING_PILLAR_RING` places 6 hexagonal ring pillars (`2×2` tiles each, linked to destructible/collapsing pillar props) around the room center with 4 barricades in the gaps; when a ring pillar is destroyed by gunfire or `Wall-Slam`, it collapses along a `160×56px` zone (`computeHazardDamage` + `1.5s` stun) and clears its `2×2` solid pillar tiles to `'floor'`, updating `rebuildSolidBoxes()` and `mapRevision`.
  - Audit 500 consecutive seeds across all 6 archetypes (`ALL_ROOM_ARCHETYPES`) and Biomes 1–3 for `flipX`/`flipY`, `Prop Jitter ±1..2`, `Door Clearance Guarantee` (`3×3`), and `areActiveDoorsConnectedBfs === true`.

- [ ] **Step 2: Implement `arena-room-archetypes-p1c.ts` and wire into `arena-room-archetypes.ts` & `arena-map.ts`**
  - Implement `buildCrossfireConveyorsGeometry`, `buildPrismLabyrinthGeometry`, `buildCrumblingPillarRingGeometry`, and `collapseCrumblingRingPillar`.
  - Update `selectCombatRoomArchetype(roomSeed, roomIndex, biome)` to select from all 6 archetypes (`ALL_ROOM_ARCHETYPES`).
  - Run `pnpm --filter @ashen-pact/shared test` and confirm all tests pass.

---

## Task 2 (`P1C.2`): Biome 2 Survival Law ("Quán Tính Băng Vĩnh Cửu") & 3 Biome 2 Interactive Props

**Files:**
- Create: `packages/shared/src/sim/sim-tactical-physics-p1c.ts`
- Modify: `packages/shared/src/sim/sim-tactical-physics.ts`
- Modify: `packages/shared/src/sim/sim-projectiles.ts`
- Modify: `packages/shared/src/sim/world-sim-types.ts`
- Test: `packages/shared/test/ap2-p1c-biome2-ecosystem.test.ts`

- [ ] **Step 1: Write failing unit tests in `packages/shared/test/ap2-p1c-biome2-ecosystem.test.ts`**
  - **Biome 2 Law ("Quán Tính Băng Vĩnh Cửu"):**
    1. On `'ice'` surface, enemy knockback velocity and sliding prop velocity (`Dash-Kick` / `Melee-Kick`) increase by `+50%` (`×1.50`).
    2. Every `Wall-Slam` in Biome 2 pulses a `r = 64px` cryo wave applying 1 stack of `Chill` to enemies within `r = 64px`.
  - **3 Biome 2 Props:**
    1. `glacial_barricade`: `[E]` flips to `'flipped'` with `65 HP`. When `Dash-Kick`ed into an enemy or wall, it shatters and spawns 3 Ice Spike pillars (`glacial_spike`, `ttlSec = 4.0s`, `blocksMovement = true`, `blocksEnemyProjectiles = true`, obeying `MAX_TACTICAL_PROPS_PER_ROOM = 16`), dealing $\text{Dmg}_{\text{Hazard}}$ and freezing enemies (`frozenTimer = 1.5s`) in `r = 72px`.
    2. `sliding_ice_block`: `Dash-Kick` / `Melee-Kick` launches at `600 px/s` (`900 px/s` on `'ice'`), bounces `1` time off a wall like a billiard ball (`bouncesRemaining = 1` on kick), and knocks back / stuns a line of enemies.
    3. `cryo_prism_pillar`: When a player projectile (`splitGeneration === 0`) hits `cryo_prism_pillar`, it refracts into 3 fan rays (`splitGeneration = 1`, `+20% Additive DMG`, `'chill'` element, `SHOT_FLAG.DYNAMIC_BOUNCE`) aimed toward the densest enemy cluster. A `splitGeneration === 1` projectile hitting a second prism never spawns children (only gains `+20% Additive DMG` and `+1 bounceRemaining`, clamped to `4`).

- [ ] **Step 2: Implement Biome 2 laws & props in `sim-tactical-physics-p1c.ts` and wire into `sim-tactical-physics.ts` & `sim-projectiles.ts`**
  - Run `pnpm --filter @ashen-pact/shared test` and confirm all tests pass.

---

## Task 3 (`P1C.3`): Biome 3 Survival Law ("Nhịp Đập Lò Nung") & 3 Biome 3 Interactive Props

**Files:**
- Modify: `packages/shared/src/sim/sim-tactical-physics-p1c.ts`
- Modify: `packages/shared/src/sim/sim-tactical-physics.ts`
- Modify: `packages/shared/src/sim/sim-weapon-cadence.ts`
- Modify: `packages/shared/src/sim/sim-props-spawning.ts`
- Test: `packages/shared/test/ap2-p1c-biome3-ecosystem.test.ts`

- [ ] **Step 1: Write failing unit tests in `packages/shared/test/ap2-p1c-biome3-ecosystem.test.ts`**
  - **Biome 3 Law ("Nhịp Đập Lò Nung"):**
    1. `conveyor` belts reverse direction synchronously every `8.0s` (`conveyorCycleTimer`), activating `conveyorWarningTimer = 1.2s` before reversal.
    2. In Biome 3, `HEAT_VENT` weapons gain heat `+15%` faster (`×1.15`), and `[R]` `Tactical Vent` clears enemy bullets / pulses in a `1.5×` wider radius (`r = 110px`).
  - **3 Biome 3 Props:**
    1. `forge_blast_shield`: `[E]` flips to `'flipped'` with `85 HP`. When `Dash-Kick`ed, it slides across the floor and projects an `88px`-wide Fire Wave (`forge_fire_wave`) dealing Burn + $\text{Dmg}_{\text{KickSlide}}$ and igniting `oil`/`grass` along the `88px` corridor.
    2. `pneumatic_press`: Placed in rooms/conveyors (`Cooldown = 4.0s`). When a player `Dash-Kick`s a prop/enemy into the press frame or an enemy/Boss enters its sensor (`r = 56px`), it winds up for `0.35s` and slams down, dealing $\text{Dmg}_{\text{Hazard}}$ to enemies, applying Boss Armor Break (`bossArmorBreakTimer = 5.0s`, `+1 bossStaggerAccum`), and pushing players safely to the rim with `0` player damage.
    3. `slag_crucible`: When `Dash-Kick`ed or shot to `0 HP`, spills a `192px`-long Molten Lava Carpet (`lava` tiles + magma trail hazard) burning a row of enemies.

- [ ] **Step 2: Implement Biome 3 laws & props in `sim-tactical-physics-p1c.ts` and wire into `sim-weapon-cadence.ts` & `sim-props-spawning.ts`**
  - Run `pnpm --filter @ashen-pact/shared test` and confirm all tests pass.

---

## Task 4 (`P1C.4`): Procedural Textures & VFX for Biome 2 & Biome 3 Props + Archetypes

**Files:**
- Create: `apps/client/src/art/texture-baker-props-p1c.ts`
- Create: `apps/client/src/fx/combat-fx-p1c.ts`
- Modify: `apps/client/src/art/texture-baker-props.ts`
- Modify: `apps/client/src/art/texture-baker.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-v2.ts`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Test: `apps/client/test/ap2-p1c-props-fx.test.ts`

- [ ] **Step 1: Bake procedural textures for all Biome 2 & Biome 3 props and states**
  - Bake `'low' | 'flipped' | 'sliding'` textures for `glacial_barricade` and `forge_blast_shield`.
  - Bake `prop_glacial_spike`, `prop_sliding_ice_block`, `prop_cryo_prism_pillar`, `prop_pneumatic_press` + `prop_pneumatic_press_slammed`, `prop_slag_crucible`, and `prop_crumbling_pillar` + `prop_crumbling_pillar_fallen`.
  - Render `conveyorWarningTimer` (`1.2s`) flashing warning chevrons on conveyor tiles and P1C SimEvent VFX (`glacial_shatter_spikes`, `prism_refract_flash`, `forge_fire_wave`, `pneumatic_press_slam`, `slag_lava_carpet`, `pillar_collapse_dust`).

- [ ] **Step 2: Write unit tests in `apps/client/test/ap2-p1c-props-fx.test.ts` and verify all client & shared tests pass.**

---

## Task 5 (`P1C.5`): Engine 2.6 Visual Scenes & Strips for Biome 2 & Biome 3 (`ap2-p1c`)

**Files:**
- Create: `tests/e2e/helpers/visual-scene-ap2-p1c.ts`
- Modify: `tests/e2e/helpers/visual-scenes.ts`
- Modify: `tools/run-shots.ts`
- Modify: `tools/visual-animation-gates.ts`

- [ ] **Step 1: Build the 7 `ap2-p1c` scenes in `tests/e2e/helpers/visual-scene-ap2-p1c.ts`**
  1. `ap2-b2-prism-labyrinth` (Biome 2 `PRISM_LABYRINTH` static + `-unlit.png`, custom `sampleRects` placing `floor_center` on walkable floor)
  2. `ap2-b2-glacial-kick-spikes` (`8-frame` strip, `heroFrameIndex = 4`: `[E]` flip `glacial_barricade` -> `Dash-Kick` shatters into 3 Ice Spikes freezing enemies)
  3. `ap2-b2-prism-refract` (`8-frame` strip, `heroFrameIndex = 4`: shoot `cryo_prism_pillar` -> 3 fan rays refract into enemy pack)
  4. `ap2-b3-crossfire-conveyors` (Biome 3 `CROSSFIRE_CONVEYORS` static + `-unlit.png`, custom `sampleRects` placing `floor_center` on walkable floor)
  5. `ap2-b3-pneumatic-press-crush` (`8-frame` strip, `heroFrameIndex = 4`, custom `sampleRects`: `Dash-Kick` into `pneumatic_press` sensor -> `0.35s` windup -> Piston slam crush)
  6. `ap2-b3-blast-shield-wave` (`8-frame` strip, `heroFrameIndex = 4`: `[E]` flip `forge_blast_shield` -> `Dash-Kick` projects `88px` Fire Wave)
  7. `ap2-crumbling-pillar-ring` (`8-frame` strip, `heroFrameIndex = 4`: `CRUMBLING_PILLAR_RING` hexagonal pillar collapses from `Wall-Slam` / gunfire, crushing `160px` lane)

- [ ] **Step 2: Run `pnpm shots -- --phase ap2-p1c --label after --group ap2-p1c --verify-freeze` and verify 5/5 Engine 2.6 gates + Golden Room `metrics.json` pass.**

---

## Task 6 (`P1C.6`): Visual Gate (`pro`), Whole-Phase Code Review (`pro`), `pnpm verify`, `pnpm perf` & Tag `ap2-p1c`

- [ ] **Step 1: Dispatch `pro` Visual Reviewer & `pro` Code Reviewer subagents.**
- [ ] **Step 2: Run `pnpm verify` and `pnpm perf`.**
- [ ] **Step 3: Update `docs/PHASES.md`, `docs/PROGRESS.md`, commit, and tag `ap2-p1c`.**
