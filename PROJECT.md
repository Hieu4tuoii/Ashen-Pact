# Project: Ashen-Pact — Commercial 2.5D Map Graphics, Realistic Living Hazards, Multi-Topology Dungeon, AI Pathfinding, Biome Terrain Purity, Minimap Fast-Travel & Vector Barricades (Round 4)

## Architecture

### Overview
Ashen-Pact's map, simulation, and environment architecture spans two strictly separated layers connected by deterministic shared state:
1. **Deterministic Shared Simulation (`packages/shared/src/sim/`)**:
   - **Dynamic Multi-Size & Deep Multi-Shape Arena Grid (`ArenaMap` + `DungeonFloorGraph`)**: Supports dynamic `ArenaMap.resize(cols, rows)` across **6 Room Size Presets** (`compact` 28×18, `standard` 36×22, `wide_hall` 46×20, `tall_sanctum` 32×28, `grand_arena` 44×26, `colossal_boss` 48×28) and **10 Authentic *Enter the Gungeon*-Style Room Silhouettes (`RoomShapeKind`)**:
     1. `'rectangle'` — Classic rectangular hall (`0` exterior void tiles; preserves 100% backward compatibility when `cols === 36 && rows === 22 && roomShape === 'rectangle'`).
     2. `'octagon'` — Deeply chamfered 8-sided chamber (`dx + dy < chamfer` with `chamfer = 5..8` tiles proportional to room size).
     3. `'cruciform'` — Deep symmetric Greek cross (`+`) chamber (`cornerW = 6..12`, `cornerH = 4..8` tiles cut from all 4 corners).
     4. `'hourglass'` — Deep pinched-waist chamber (`waistH = 4..8` tiles indented from North and South walls across `3 <= |tx - midX| <= waistOuterX`, plus corner chamfers).
     5. `'l_shape'` — Asymmetric L-shaped chamber missing the NE quadrant (`tx >= midX + 5 && ty <= midY - 3`).
     6. `'t_shape'` — T-shaped chamber missing both lower corner quadrants (`(tx <= midX - 6 || tx >= midX + 5) && ty >= midY + 3`).
     7. `'u_shape'` — U-shaped wrap-around chamber with deep North-central courtyard/baffle cutouts.
     8. `'donut_ring'` — Ring / Donut chamber with chamfered outer corners and a large central architectural wall monolith (`6..10 × 4..6` tiles in the room center with hollow dark Exterior Void core and 1-tile sculpted interior wall ring).
     9. `'multi_chamber'` — Multi-chamber / Split-wing layout with staggered NE and SW Exterior Void corner cutouts AND interior dividing partition wall wings with narrow doorway chokepoints.
     10. `'island_catwalk'` — Island / Catwalk over Chasm layout with chamfered outer corners and a wide perimeter Chasm moat, leaving a central combat island and satellite pads connected to all 4 door vestibules by 3-tile-wide stone catwalks/bridges.
   - **Round 4 — Zero-Allocation BFS Enemy/Boss/Summon Navigation, Multi-Angle Context Steering, Post-Prop Collision Re-Resolution & Unsticking (`M1_r4_sim_navigation_terrain_and_barricade_launch`)**:
     - Upgrades `findNearestWalkablePoint` and `findNextWalkableWaypoint` (`arena-room-archetypes.ts`) with zero-allocation module-level typed arrays, large-radius (`22..36px`) 8-neighbor clearance verification, stationary blocking-prop avoidance (`prop.blocksMovement && prop.hp > 0 && prop.coverState !== 'fallen'`), and 2-tile LOS lookahead.
     - Adds centralized post-AI pathfinding and multi-angle obstacle avoidance in `updateEnemiesImpl` (`sim-enemies-core.ts`) so all 15 regular enemies, 3 bosses, and moving summons route smoothly around non-rectangular cutouts, central monoliths, partition walls, chasms, bridges, pillars, and props without getting stuck.
     - Re-runs `this.map.resolveCircleCollision` immediately after `this.resolvePropMovementCollision(e)` and rescues any ground enemy stranded on a `'chasm'` tile or embedded in a solid tile via `findNearestWalkablePoint`, plus stuck-progress recovery (`navStuckTimer`).
     - Validates all enemy waves (`spawnNextRoomWaveImpl`, `spawnEnemyImpl`), boss teleports/unburrows/adds (`spore_king`, `kryssa_ice_queen`, `forge_titan`, `ashen_executioner`), player summons (`sacred_tree`, `tesla_turret`, `life_blossom`, `superheated_cyclone`), and pull/yank mechanics against solid tiles, chasms, and prop radii.
   - **Round 4 — Strict Biome-Specific Terrain Separation (`M1_r4_sim_navigation_terrain_and_barricade_launch`)**:
     - Enforces strict biome-authentic terrain pools across `ArenaMap.buildLayout`, `ArenaMap.configureRoomLayout`, and `buildCrossfireConveyorsGeometry` (`arena-map.ts`, `arena-room-archetypes-p1c.ts`):
       - **Biome 1 (Whispering Woods / Rừng Cổ)**: `'poison_swamp'`, `'grass'` (`'burning_grass'`/`'ash'`), `'water'` (`'electrified_water'`), `'oil'` (`'burning_oil'`), `'chasm'` — never spawns `'lava'`, `'ice'`, or `'conveyor'`.
       - **Biome 2 (Hollow Caverns / Hầm Băng)**: `'ice'`, `'water'`, `'electrified_water'`, `'chasm'` — never spawns `'lava'`, `'poison_swamp'`, `'grass'`, `'conveyor'`, or `'oil'`.
       - **Biome 3 (Ashen Forge / Lò Rèn)**: `'lava'`, `'conveyor'`, `'oil'`, `'burning_oil'`, `'ash'`, `'chasm'` — never spawns `'ice'`, `'poison_swamp'`, `'grass'`, or `'water'`.
   - **Round 4 — Direct 1-Step Barricade Launch on Slash/Attack/Dash Without `[E]` Flip (`M1_r4_sim_navigation_terrain_and_barricade_launch`)**:
     - Updates `isKickableProp`, `kickProp`, `triggerMeleeKickProps`, and `resolvePropMovementCollision` (`sim-tactical-physics.ts`), plus melee slash wave projectiles (`sim-projectiles.ts`, `sim-weapon-specials-p1b-melee.ts`), so attacking/slashing or dashing into `'moss_table'`, `'glacial_barricade'`, or `'forge_blast_shield'` in their initial `'low'` state immediately launches them (`coverState = 'sliding'`) along the attack angle while triggering micro-blank bullet clearing and Table Tech blessings, and removes `flip_cover` from `[E]` `findInteractTarget` (`interact-target.ts`).

2. **Commercial 2.5D Client Rendering, Entered-Only Minimap Fog-of-War, Fast-Travel Teleportation with VFX & Procedural Vector Biome Barricades (`apps/client/src/` & `apps/server/src/`)**:
   - **Rounds 1–3 Visual Foundation**: Seamless multi-tile living hazards, concave shorelines, multi-axis bridges, parapet coping, `4×4`/`4×12` concave miters, WebGL `lightmapRt` auto-resize, `#0B090E` Exterior Void masking, dynamic pillar shadows, and grounded braziers.
   - **Round 4 — Entered-Only Minimap & `[Tab]` Map Fog-of-War (`M2_r4_client_minimap_teleport_vfx_and_vector_barricades`: `hud-qol-and-minimap.ts`)**:
     - Restricts room node and corridor rendering in `updateMinimapHudImpl` strictly to rooms the player has actually stepped into (`r.discovery === 'visited' || r.discovery === 'cleared' || r.id === sim.currentRoomId`), completely hiding unvisited rooms (`'hidden'` / `'discovered'`) and unvisited corridor stubs.
   - **Round 4 — Fast-Travel Room Teleportation & Commercial Teleport Out / In VFX (`M2_r4_client_minimap_teleport_vfx_and_vector_barricades`: `hud-qol-and-minimap.ts`, `GameScene.ts`, `arena-tiles.ts`, `CoopRoom.ts`)**:
     - Enables clicking any visited/cleared room node on the `[Tab]` Full Map or corner Minimap when out of combat (`canTeleportFromCurrentRoom(sim)` + `resolveMinimapClickedRoomId(scene, localViewX, localViewY)`) to fast-travel immediately via `scene.teleportToRoom(targetRoomId)` (with Co-op `'teleport_room'` sync in `CoopRoom.ts` and weapon-fire suppression in `isClickingHud`).
     - Renders a dramatic **Teleport Out (departure) + Teleport In (arrival)** VFX sequence: origin arcane burst + `triggerIrisTransition('close')` + `zzfx.play('portal_enter')` + destination `fx_sh_arcane_sigil` shader nova + `spawnChestOpenBurst` vertical beam & sparkles + transient cyan frost light + `'⚡ DỊCH CHUYỂN!'` floating alert + `0.28s` `playerRig` vortex spin/scale materialization (`roomTeleportAnimTimer`).
   - **Round 4 — Sharp Procedural Vector Biome Barricades & `[E]` Prompt Removal (`M2_r4_client_minimap_teleport_vfx_and_vector_barricades`: `texture-baker-props.ts`, `texture-baker-props-p1c.ts`, `interact-prompt.ts`)**:
     - Suppresses the `[E] Lật Bàn Chắn` / `Flip Cover` UI prompt in `resolveInteractPromptSpec` (`interact-prompt.ts`).
     - Replaces the flat rectangular table drawings for `prop_moss_table*`, `prop_glacial_barricade*`, and `prop_forge_blast_shield*` (`low`, `flipped`, `sliding`) with sharp, multi-faceted procedural vector biome objects:
       - **Biome 1 (`prop_moss_table*`)**: **Ancient Runic Moss Boulder / Sylvan Spore Monolith** (craggy octagonal stone monolith, lush forest moss mantle, glowing emerald/mint rune sigil core, and luminous spore buds).
       - **Biome 2 (`prop_glacial_barricade*`)**: **Runic Permafrost Obelisk / Jagged Cryo Shard Cluster** (hexagonal abyssal ice plinth crowned by 3 interlocking jagged crystal shards, crisp refraction ridges, `-135°` specular glints, and diamond cryo-rune core).
       - **Biome 3 (`prop_forge_blast_shield*`)**: **Magma Core Anvil / Pressurized Dwarven Slag Cylinder** (octagonal dark-steel containment hull, twin riveted brass pressure bands, horned anvil shoulders, and incandescent molten magma furnace core).

---

## Feature Inventory
Every feature from the Survey phase must appear here with its assigned milestone. No feature may be left unassigned.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1–F10 | Round 1 Map Overhaul Features | Multi-size rooms, 4 initial shapes, proportional archetypes, realistic hazards, 2.5D flagstones/walls/pillars, and R1 E2E suite. | M1–M3 (R1) | R1 survey |
| F11–F14 | Round 2 Deep Room Shapes & Exterior Void | 10 *Enter the Gungeon*-style room shapes, unlocked `TWIN_BRIDGES`, `#0B090E` Exterior Void, polygon minimap silhouettes, and R2 E2E/Playwright suite. | `M1_r2`–`M3_r2` | R2 survey |
| F15–F19 | Round 3 Visual, Shadow, Lighting & Surface Polish | Surface autotile family fix, hazard-safe prop anchors, `!hasS` wall coping, concave miters, seamless multi-tile pools, N–S/E–W chasm bridges, WebGL `lightmapRt` FBO resize, Exterior Void light masking, dynamic pillar shadows, and R3 E2E/Playwright suite. | `M1_r3`–`M4_r3` | R3 survey |
| F20 | Zero-Allocation BFS Enemy/Boss/Summon Navigation, Multi-Angle Steering, Post-Prop Re-Resolution & Unsticking | Upgrade `findNearestWalkablePoint` & `findNextWalkableWaypoint` (0-alloc typed arrays, prop avoidance, large-radius clearance, 2-tile lookahead); add centralized post-AI BFS pathfinding & multi-angle obstacle steering in `updateEnemiesImpl`; re-run `resolveCircleCollision` after `resolvePropMovementCollision`; rescue ground enemies on chasms/solid tiles & unstick stalled enemies; validate all wave spawns, boss teleports/unburrows/adds, summons (`sacred_tree`, `tesla_turret`, `life_blossom`, `superheated_cyclone`), and pull/yank mechanics (`packages/shared/src/sim/**`). | `M1_r4_sim_navigation_terrain_and_barricade_launch` | R4 survey (`ORIGINAL_REQUEST` Req 1) |
| F21 | Strict Biome-Specific Terrain Separation | Eliminate cross-biome terrain surface contamination in `ArenaMap.buildLayout`, `ArenaMap.configureRoomLayout('start')`, and `buildCrossfireConveyorsGeometry` so Biome 1 only spawns Woods surfaces (`poison_swamp`, `grass`, `water`, `oil`), Biome 2 only spawns Ice Cavern surfaces (`ice`, `water`, `electrified_water`), and Biome 3 only spawns Forge surfaces (`lava`, `conveyor`, `oil`, `burning_oil`), while preserving mid-combat elemental surface interactions (`packages/shared/src/sim/arena-map.ts`, `arena-room-archetypes-p1c.ts`). | `M1_r4_sim_navigation_terrain_and_barricade_launch` | R4 survey (`ORIGINAL_REQUEST` Req 2) |
| F22 | Direct 1-Step Barricade Launch on Slash/Attack/Dash Without `[E]` Flip (Sim) | Allow intact `'low'` `moss_table`, `glacial_barricade`, and `forge_blast_shield` props to be launched directly by melee cone swings, melee slash wave projectiles, and player dashes (`isKickableProp`, `kickProp`, `triggerMeleeKickProps`, `resolvePropMovementCollision`, `sim-projectiles.ts`, `sim-weapon-specials-p1b-melee.ts`, `sim-bot-tactical-helpers.ts`), triggering micro-blank and Table Tech blessings on 1-step launch, and remove `flip_cover` from `[E]` `findInteractTarget` (`interact-target.ts`). | `M1_r4_sim_navigation_terrain_and_barricade_launch` | R4 survey (`ORIGINAL_REQUEST` Req 5A) |
| F23 | Entered-Only Minimap & `[Tab]` Map Fog-of-War | Restrict room node and corridor rendering in `updateMinimapHudImpl` (`hud-qol-and-minimap.ts`) strictly to rooms the player has entered (`discovery === 'visited' || discovery === 'cleared' || id === sim.currentRoomId`), hiding all unvisited rooms (`'hidden'` / `'discovered'`) and unvisited corridor stubs. | `M2_r4_client_minimap_teleport_vfx_and_vector_barricades` | R4 survey (`ORIGINAL_REQUEST` Req 3) |
| F24 | Fast-Travel Room Teleportation Between Visited Rooms + Teleport Out / In VFX | Add `canTeleportFromCurrentRoom(sim)` and `resolveMinimapClickedRoomId(scene, localViewX, localViewY)` (`hud-qol-and-minimap.ts`), `GameScene.teleportToRoom(targetRoomId)` (`GameScene.ts`, `arena-tiles.ts`), and Co-op `'teleport_room'` support (`CoopRoom.ts`) with full departure + arrival VFX (`fx_sh_arcane_sigil` nova, `spawnChestOpenBurst` beam/sparkles, transient cyan light, `triggerIrisTransition('close')`, `'⚡ DỊCH CHUYỂN!'` alert, and `0.28s` `playerRig` vortex spin/scale materialization). | `M2_r4_client_minimap_teleport_vfx_and_vector_barricades` | R4 survey (`ORIGINAL_REQUEST` Req 4) |
| F25 | Commercial Procedural Vector Biome Barricades & `[E]` Prompt Removal (Client) | Return `null` for `flip_cover` in `resolveInteractPromptSpec` (`interact-prompt.ts`) and replace `prop_moss_table*`, `prop_glacial_barricade*`, and `prop_forge_blast_shield*` textures (`texture-baker-props.ts`, `texture-baker-props-p1c.ts`) with multi-faceted procedural vector biome objects (Biome 1: Ancient Runic Moss Boulder / Spore Monolith; Biome 2: Runic Permafrost Obelisk / Cryo Shard Cluster; Biome 3: Magma Core Anvil / Pressurized Slag Cylinder). | `M2_r4_client_minimap_teleport_vfx_and_vector_barricades` | R4 survey (`ORIGINAL_REQUEST` Req 5B) |
| F26 | Round 4 5-Tier E2E Regression Suite & 13-Scene Playwright Visual Verification | Update `tests/e2e/phase2.spec.ts` & `tests/e2e/map-overhaul-e2e.test.ts` with Round 4 regression contracts (`T5-WB-27`..`31`), recapture all 13 `1920×1080` Playwright WebGL screenshots (`01`..`13.png`), visually verify every screenshot via `view_file`, and pass Tier 5 white-box adversarial hardening & Forensic Audit. | `M3_r4_e2e_and_playwright_visuals` | R4 survey |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1–3 | Round 1 Milestones (`M1`–`M3`) | Shared Sim, Client Visuals & E2E Round 1 (F1–F10). | none | DONE |
| 4–6 | Round 2 Milestones (`M1_r2`–`M3_r2`) | Deep Room Shapes, Exterior Void & E2E Round 2 (F11–F14). | none | DONE |
| 7–10 | Round 3 Milestones (`M1_r3`–`M4_r3`) | Surface Autotiling, Seamless Pools, Lightmap FBO Resize & E2E Round 3 (F15–F19). | none | DONE |
| 11 | `M1_r4_sim_navigation_terrain_and_barricade_launch` | Shared Simulation Round 4 (`packages/shared/**`): Implement zero-allocation BFS enemy/boss/summon pathfinding, multi-angle obstacle steering, post-prop collision re-resolution, chasm/solid-tile rescue, stuck recovery, and spawn/pull/yank validation (F20); enforce strict biome-specific terrain separation across Biomes 1, 2, and 3 in `arena-map.ts` and `arena-room-archetypes-p1c.ts` (F21); enable direct 1-step barricade launch (`moss_table`, `glacial_barricade`, `forge_blast_shield`) on melee swing, melee slash wave projectile, and dash without `[E]` flip, and remove `flip_cover` from `findInteractTarget` while updating affected shared tests and adding comprehensive Round 4 shared unit tests (F22). | Interface Contracts defined | DONE (`sub_orch_m1_r4`: `22` sim files + `9` test files, `typecheck` & `vitest` suites passed; 2 Reviewers APPROVE, 2 Challengers APPROVE, Auditor CLEAN) |
| 12 | `M2_r4_client_minimap_teleport_vfx_and_vector_barricades` | Client & Server Round 4 (`apps/client/**`, `apps/server/**`): Restrict Minimap and `[Tab]` Map room node and corridor rendering to entered rooms (`visited` / `cleared` / `currentRoomId`) (F23); implement click-to-teleport fast-travel on the `[Tab]` Map and Minimap (`canTeleportFromCurrentRoom`, `resolveMinimapClickedRoomId`, `GameScene.teleportToRoom`, `CoopRoom` `'teleport_room'`) with departure + arrival arcane sigil/beam/iris/vortex materialization VFX and weapon-fire suppression (F24); remove `[E] Lật Bàn Chắn` UI prompt in `interact-prompt.ts` and replace `prop_moss_table*`, `prop_glacial_barricade*`, and `prop_forge_blast_shield*` in `texture-baker-props.ts` & `texture-baker-props-p1c.ts` with sharp procedural vector biome objects; add comprehensive Round 4 client unit tests (F25). | Interface Contracts defined | DONE (`sub_orch_m2_r4`: `27/27` suites / `208/208` client tests, client & server `typecheck`, & `vite build` passed; 2 Reviewers APPROVE, 2 Challengers APPROVE, Auditor CLEAN) |
| 13 | `M3_r4_e2e_and_playwright_visuals` | E2E Testing Track Update & Final Visual Verification Round 4 (`tests/e2e/**`, `TEST_INFRA.md`, `TEST_READY.md`, `output/playwright/map-overhaul/**`): Update `tests/e2e/phase2.spec.ts` and expand 5-Tier E2E suite (`tests/e2e/map-overhaul-e2e.test.ts`) with Round 4 regression contracts (`T5-WB-27`..`31` covering AI navigation/unsticking, biome terrain purity, entered-only minimap fog-of-war, fast-travel teleport + VFX, and 1-step slash-launched vector biome barricades), recapture all 13 `1920×1080` Playwright WebGL screenshots (`01`..`13.png`), visually inspect every screenshot via `view_file`, and pass Tier 5 white-box adversarial coverage hardening & Forensic Audit (F26). | `M1_r4_sim_navigation_terrain_and_barricade_launch`, `M2_r4_client_minimap_teleport_vfx_and_vector_barricades` | DONE (`sub_orch_m3_r4`: `157/157` E2E tests PASS under `ENFORCE_OVERHAUL_CONTRACTS=1`, `pnpm -r typecheck` PASS, `13/13` `1920×1080` WebGL screenshots recaptured & visually verified; 2 Reviewers APPROVE, 2 Challengers APPROVE, Auditor CLEAN) |

---

## Interface Contracts

### 1. `packages/shared/src/sim/**` ↔ `apps/client/**` & `tests/e2e/**` (`M1_r4` ↔ `M2_r4` & `M3_r4`)
- **Enemy/Boss/Summon Navigation & Safe Placement (`arena-room-archetypes.ts` & `sim-enemies-core.ts`)**:
  - `findNearestWalkablePoint(map: ArenaMap, worldX: number, worldY: number, radius = 14): { x: number; y: number }`:
    - Preserves its existing 3-arg / 4-arg signature while ensuring large-radius entities (`radius > 16`) verify `map.resolveCircleCollision(cx, cy, radius, false)` remains on a non-solid, non-chasm tile, preferring tiles with full 8-neighbor clearance.
  - `findNextWalkableWaypoint(map: ArenaMap, fromX: number, fromY: number, toX: number, toY: number, props?: readonly SimPropState[], ignoreChasm = false): { x: number; y: number }`:
    - Backward-compatible with existing 5-arg calls; uses preallocated module-level typed arrays (zero per-call heap allocations), avoids tiles blocked by stationary `blocksMovement` props (falling back to ignoring props if all paths are prop-blocked), and looks ahead up to 2–3 tiles when clear line-of-sight exists.
  - `updateEnemiesImpl` (`sim-enemies-core.ts`):
    - Applies post-AI BFS waypoint + multi-angle obstacle avoidance for moving enemies (`aiState === 'move' || aiState === 'chase' || aiState === 'idle'`), re-runs `this.map.resolveCircleCollision` immediately after `this.resolvePropMovementCollision(e)`, rescues ground enemies on `'chasm'` or solid tiles via `findNearestWalkablePoint`, and unsticks stalled moving enemies via `navStuckTimer`.
- **Biome-Specific Terrain Separation (`arena-map.ts` & `arena-room-archetypes-p1c.ts`)**:
  - Initial room generation (`ArenaMap.buildLayout`, `ArenaMap.configureRoomLayout`, and all 6 `RoomArchetype` builders) strictly partitions surfaces by `biome`:
    - **Biome 1**: only `'none' | 'poison_swamp' | 'grass' | 'burning_grass' | 'ash' | 'water' | 'electrified_water' | 'oil' | 'burning_oil' | 'chasm'` (never `'lava'`, `'ice'`, `'conveyor'`).
    - **Biome 2**: only `'none' | 'ice' | 'water' | 'electrified_water' | 'chasm'` (never `'lava'`, `'poison_swamp'`, `'grass'`, `'burning_grass'`, `'conveyor'`, `'oil'`, `'burning_oil'`).
    - **Biome 3**: only `'none' | 'lava' | 'conveyor' | 'oil' | 'burning_oil' | 'ash' | 'chasm'` (never `'ice'`, `'poison_swamp'`, `'grass'`, `'burning_grass'`, `'water'`, `'electrified_water'`).
  - Dynamic mid-combat elemental transformations (`ArenaMap.applyElementAtWorldPoint`) remain unchanged.
- **Direct 1-Step Barricade Launch Without `[E]` Flip (`sim-tactical-physics.ts`, `interact-target.ts`)**:
  - `PropKind` values (`'moss_table'`, `'glacial_barricade'`, `'forge_blast_shield'`) and texture keys (`prop_moss_table*`, `prop_glacial_barricade*`, `prop_forge_blast_shield*`) remain unchanged.
  - `isKickableProp(prop)` returns `true` for intact (`hp > 0`, `coverState !== 'sliding' && coverState !== 'fallen'`) `isFlippableBarricadeProp(prop.kind)` props in both `'low'` and `'flipped'` states.
  - `kickProp(sim, prop, actor, customAngle)` transitions `'low'` barricade props through `'flipped'` (`hp = maxHp = getFlippedBarricadeHp(prop.kind)`), applies `applyFlipCoverTableTechBlessings`, `clearEnemyProjectilesAroundProp`, and `triggerTableTechMagnetSnareOnFlip`, and launches them into `'sliding'` (`vx, vy` along `customAngle ?? actor.aimAngle`).
  - `findInteractTarget` (`interact-target.ts`) no longer returns `kind: 'flip_cover'` for `'low'` barricades (while `sim.flipCoverProp(prop, actor)` remains available on `WorldSim` for programmatic stationary-cover tests).

### 2. `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts`, `GameScene.ts`, `arena-tiles.ts`, `texture-baker-props*.ts` ↔ `tests/e2e/**` (`M2_r4` ↔ `M3_r4`)
- **Entered-Only Minimap Fog-of-War & Fast-Travel Helpers (`hud-qol-and-minimap.ts`)**:
  - `updateMinimapHudImpl` renders room nodes and corridors strictly when `isVisitedOrCleared(r)` (`r.discovery === 'visited' || r.discovery === 'cleared' || r.id === sim.currentRoomId`) is true (and for corridors, both `r` and `target` satisfy `isVisitedOrCleared`).
  - Preserves the player's gold position dot as the final `g.fillCircle` call in `updateMinimapHudImpl` (`map-overhaul-r2-void-and-minimap.test.ts:940`).
  - Exports (and re-exports from `hud-combat-and-coop.ts`):
    ```ts
    export function canTeleportFromCurrentRoom(sim: WorldSim): boolean;
    export function resolveMinimapClickedRoomId(
      scene: Pick<GameScene, 'transport' | 'fullMapOpen' | 'hudPadX' | 'hudPadY'>,
      localViewX: number,
      localViewY: number,
    ): number | null;
    ```
- **Fast-Travel Execution & VFX (`GameScene.ts` & `arena-tiles.ts`)**:
  - `GameScene.teleportToRoom(targetRoomId: number): boolean`:
    - Returns `false` if `!canTeleportFromCurrentRoom(sim)` or `targetRoomId === sim.currentRoomId` or target room is not `'visited' | 'cleared'`.
    - When valid: spawns departure VFX at origin `(oldX, oldY)`, transitions `sim.enterRoom(targetRoomId)`, sets `sim.doorTransitionCooldown = Math.max(sim.doorTransitionCooldown, 0.75)`, closes `this.fullMapOpen`, sends `'teleport_room'` in Co-op, syncs arena tiles & sim events, triggers `this.triggerIrisTransition('close')`, sets `this.roomTeleportAnimTimer = this.roomTeleportAnimDuration` (`0.28s` `playerRig` vortex spin/scale materialization), plays `zzfx.play('portal_enter')`, and spawns arrival `fx_sh_arcane_sigil` nova + `spawnChestOpenBurst` vertical beam/sparkles + transient light + `'⚡ DỊCH CHUYỂN!'` / `'⚡ TELEPORT!'` floating alert.
- **Procedural Vector Biome Barricades & Prompt Suppression (`interact-prompt.ts`, `texture-baker-props.ts`, `texture-baker-props-p1c.ts`)**:
  - `resolveInteractPromptSpec` (`interact-prompt.ts`) returns `null` for `case 'flip_cover':`.
  - `TextureBaker.bakeAll` bakes multi-faceted procedural vector biome objects into `prop_moss_table`, `prop_moss_table_flipped`, `prop_moss_table_sliding`, `prop_glacial_barricade`, `prop_glacial_barricade_flipped`, `prop_glacial_barricade_sliding`, `prop_forge_blast_shield`, `prop_forge_blast_shield_flipped`, and `prop_forge_blast_shield_sliding`.

---

## Code Layout

- **Shared Simulation (`M1_r4_sim_navigation_terrain_and_barricade_launch` write scope — exclusive)**:
  - `packages/shared/src/sim/**` (`arena-map.ts`, `arena-room-archetypes.ts`, `arena-room-archetypes-p1c.ts`, `sim-enemies-core.ts`, `sim-enemies-biome1.ts`, `sim-enemies-biome2.ts`, `sim-enemies-biome3.ts`, `sim-ashen-pacts-combat.ts`, `sim-dungeon-rooms.ts`, `sim-props-spawning.ts`, `sim-skills-mechanics.ts`, `sim-duo-boons.ts`, `sim-weapon-specials-rare.ts`, `sim-weapon-specials-p1b-ranged.ts`, `sim-weapon-specials-p1b-melee.ts`, `sim-weapon-mutators-p4a.ts`, `sim-blessings-dash-reload.ts`, `sim-tactical-physics.ts`, `sim-projectiles.ts`, `sim-bot-tactical-helpers.ts`, `interact-target.ts`, `world-sim.ts`)
  - `packages/shared/test/**` (update affected table-flip tests and add `packages/shared/test/round4-navigation-terrain-barricades.test.ts`)
- **Client & Server (`M2_r4_client_minimap_teleport_vfx_and_vector_barricades` write scope — exclusive)**:
  - `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts`
  - `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts`
  - `apps/client/src/scenes/game-scene/arena-tiles.ts`
  - `apps/client/src/scenes/game-scene/interact-prompt.ts`
  - `apps/client/src/scenes/game-scene/combat-telegraphs.ts` (optional arrival ring overlay)
  - `apps/client/src/scenes/GameScene.ts`
  - `apps/client/src/art/texture-baker-props.ts`
  - `apps/client/src/art/texture-baker-props-p1c.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `apps/client/test/**` (update `round3-lighting-architecture-minimap.test.ts` corridor test and add `apps/client/test/round4-minimap-teleport-barricades.test.ts`)
- **E2E Testing & Playwright Visual Verification (`M3_r4_e2e_and_playwright_visuals` write scope — exclusive)**:
  - `TEST_INFRA.md` (project root)
  - `TEST_READY.md` (project root)
  - `tests/e2e/phase2.spec.ts`
  - `tests/e2e/helpers/map-overhaul-harness.ts`
  - `tests/e2e/map-overhaul-e2e.test.ts`
  - `tests/e2e/visual.spec.ts`
  - `output/playwright/map-overhaul/*.png`
