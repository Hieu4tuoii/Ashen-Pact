# Project: Ashen-Pact — Commercial 2.5D Map Graphics, Realistic Living Hazards, Multi-Topology Dungeon & Visual/Lighting/Shadow Polish Overhaul (Round 3)

## Architecture

### Overview
Ashen-Pact's map & environment upgrade is architected across two strictly separated layers connected by deterministic shared state:
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
   - **Unlocked `TWIN_BRIDGES`, Hazard-Safe Prop/Brazier Placement & Accurate Surface Autotile Families (`M1_r3_sim_surfaces_and_props`)**:
     - Fixes `ArenaMap.isSameSurfaceFamily` (`arena-map.ts:707`) typo (`b === 'burning_grass'` instead of `a === 'burning_grass'`) so `burning_grass` pools compute accurate perimeter `surfaceMask` values (`!= 15` on outer borders) instead of raw un-bordered 32×32 squares, and separates solid `'ice'` from liquid `'water'` / `'electrified_water'` so adjacent ice and water pools render distinct shoreline rims.
     - Updates `isValidAnchorTile` and `spawnBrazierSafe` (`arena-room-archetypes.ts`) to prefer dry floor (`map.getSurface(tx, ty) === 'none'`, with safe outward-ring fallback) so `torch_brazier` props and static barricades (`forge_blast_shield`, `slag_crucible`) never spawn inside active `ice`, `lava`, or moving `conveyor` belts.

2. **Commercial 2.5D Client Rendering, Seamless Surfaces, Multi-Axis Bridges, Accurate Lightmaps & Dynamic Shadows (`apps/client/src/`)**:
   - **Pillar 1 — Seamless Multi-Tile Living Hazards, Concave Shorelines, Chasm Strata & Multi-Axis Bridges (`M2_r3_client_tiles_surfaces_bridges`: `texture-baker-surfaces.ts` + `arena-tiles.ts`)**:
     - Eliminates the per-tile radial-gradient 32×32 waffle grid on `burning_oil` and `burning_grass`, removes per-tile linear gradient banding on `lava`, `ice`, `water`, and `electrified_water`, keeps Voronoi fissures inside exposed pool edges (`!hasN/E/S/W`), connects `electrified_water` lightning arcs and `oil` sheen across shared tile boundaries, aligns `traceOrganicSurfaceRect` and `traceOrganicShorelineLayer` edge waves, and closes `2.4px` concave inner-corner shoreline gaps on L-shaped/stepped pools.
     - Clips northern chasm rock strata (`y = 0..13`) horizontally to `[rx, rx + rw]` so top-left/top-right chasm corners keep their West/East side strata, tones down subterranean vein alpha, and suppresses the `2.2px` walkable floor lip on chasm edges that directly border a solid `'wall'` or `'pillar'`.
     - Upgrades `drawBridgeOverChasmOverlay` to support both **East–West** (`hasChasmN`/`hasChasmS`) and **North–South** (`hasChasmW`/`hasChasmE` / `isVerticalBridge`) 3-tile bridges, drawing guardrails strictly on outer chasm-facing edges and removing internal rail bars between rows/columns of 3-tile bridges.
   - **Pillar 2 — Complete Parapet Coping, Aligned `4×4`/`4×12` Concave Miters, Diagonal Void Casing, Corner-Only Wall AO & Clean Pillar Medallions (`M2_r3_client_tiles_surfaces_bridges`: `texture-baker-tiles.ts` + `arena-tiles.ts`)**:
     - Draws West/East/North 4px parapet coping on `!hasS` wall tiles (`y = 0..20` Top Cap above the `y = 20..32` South Cliff Face) with open seam lines only on exposed sides, replaces caution-tape North cliff slashes with subtle mortar weathering, aligns concave corner miters to `4×4` (`floorNE`/`NW`) and `4×12` at `y = 20..32` (`floorSE`/`SW`), adds `6×6` diagonal Exterior Void corner shadows and map-border outer contours, restricts `bakeWallAoOverlay`'s `14×14` corner gradient strictly to convex outer corners (`WALL_AO_NORTH_WEST` without `WALL_AO_NORTH | WALL_AO_WEST`), suppresses `wall_ao` over `chasm`/`lava`/`burning_*`, and prevents non-`2×2` pillars (`1×N`, `2×1`, `2×4`, `3×3+1×2`) from stamping sliced half/quarter rune medallions.
   - **Pillar 3 — Pixel-Accurate WebGL `lightmapRt` Resize, Exterior Void Light/Mote/God-Ray Masking, Dynamic Pillar Shadows & Direction-Aware Decors (`M3_r3_client_lighting_architecture_minimap`: `lighting-pipeline.ts` + `biome-architecture.ts` + `biome-architecture-render.ts` + `entity-sync.ts`)**:
     - Enables `webglRt?.setAutoResize?.(true)` around `this.lightmapRt.resize(rtW, rtH)` in `LightingPipeline.update` so the WebGL `RenderTarget` FBO actually resizes from `480×270` to `rtW × rtH`, eliminating the 28%–55% down-right displacement of all dynamic lights across all camera zoom levels.
     - Anchors Biome 2 God-Rays to active North perimeter wall tiles (`!isExteriorVoidWallTile`), skips dust motes over solid/Exterior Void tiles, masks `isExteriorVoidWallTile` cells above additive lighting layers (`depth 36.2`, preserving the `6px` outer wall shadow casing), and removes hard-edged `glowGraphics` circles so `#0B090E` Exterior Void remains pitch-black and crisp.
     - Computes true contiguous `widthTiles` and `heightTiles` for `pillarShadows` (fixing floating shadows under `2×1` pillars and half-height shadows on `2×4` pillars), clips pillar shadows to dry floor (`surface === 'none'`), centers `fluted_column`/`forge_anvil`/`mushroom_cluster` on true `2×2` pillars without totem triple-stacking, restores ground `prop_shadow` and removes floating mid-air wall rods on floor `torch_brazier` props, and makes wall decors (`wrought_iron_fence`, `brazier_pedestal`, `steam_pipe_wall`, `root_base`, `ice_alcove`, `sunken_astrolabe`) direction- and cliff-aware.
   - **Pillar 4 — Minimap Corridor Edge Clipping & Compact Player Dot Sizing (`M3_r3_client_lighting_architecture_minimap`: `hud-qol-and-minimap.ts`)**:
     - Clips Minimap corridor connector segments to the outer borders of connected room nodes so corridor bars never bleed through `u_shape` / `hourglass` concave cutouts or translucent undiscovered rooms, and scales/clamps the compact-mode player dot so it sits cleanly on the `donut_ring` corridor and does not obscure the `island_catwalk` cross.

---

## Feature Inventory
Every feature from the Survey phase must appear here with its assigned milestone. No feature may be left unassigned.

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Dynamic `ArenaMap.resize(cols, rows)` & Room Size Presets | Support 6 even-dimension room size presets (`compact` 28×18, `standard` 36×22, `wide_hall` 46×20, `tall_sanctum` 32×28, `grand_arena` 44×26, `colossal_boss` 48×28). | M1 (R1) | survey |
| F2 | Multi-Geometry Room Silhouettes (`RoomShapeKind`) | Initial 4 silhouettes (`rectangle`, `octagon`, `cruciform`, `hourglass`). | M1 (R1) | survey |
| F3 | Dynamic Door/Vestibule Helpers & Proportional Archetypes | Proportional scaling of all 6 combat archetypes with 100% BFS door connectivity. | M1 (R1) | survey |
| F4 | Tactical Prop Eviction Protection | Prevent `rotten_totem_pillar` eviction under `MAX_TACTICAL_PROPS_PER_ROOM` from orphaning solid `TileKind.Pillar` tiles. | M1 (R1) | survey |
| F5 | Realistic Multi-Layered Molten Lava & Crystalline Ice | Multi-layered volcanic magma & crystalline ice across variants `0..7` + `traceOrganicPoolPath`. | M2 (R1) | survey |
| F6 | All Other Terrain Surfaces, Chasm Strata & 3-Tile Bridges | Upgraded water, electrified water, poison swamp, oil, grass, burning surfaces, chasm strata, conveyors, and 3-tile chasm bridges. | M2 (R1) | survey |
| F7 | Live Deterministic Surface Animation & Additive Emissive Glow | Per-frame deterministic surface animations and `BlendModes.ADD` emissive hazard glow. | M2 (R1) | survey |
| F8 | Tactile 2.5D Flagstone Floors, 3/4 Multi-Course Walls & Monumental Pillars | 8-variant ashlar flagstones, raised parapet coping, 3/4 south cliff faces, monumental 2×2 pillars, and wall AO. | M2 (R1) | survey |
| F9 | Client Ground Composite Auto-Resize, Redraw Fix, Prop Shadows/Life & Secret Door Light Fix | Auto-resize composite texture, re-run `renderGroundPass` on dirty tiles, prop footprint shadows & idle life, secret door light suppression. | M2 (R1) | survey |
| F10 | Round 1 E2E Test Suite & Adversarial Coverage Hardening | 138-test 5-Tier E2E test suite (`TEST_READY.md`). | M3 (R1) | survey |
| F11 | Deep *Enter the Gungeon*-Style Room Shapes (10 `RoomShapeKind`s) & Unlocked `TWIN_BRIDGES` | 10 deep room shapes (`rectangle`, `octagon`, `cruciform`, `hourglass`, `l_shape`, `t_shape`, `u_shape`, `donut_ring`, `multi_chamber`, `island_catwalk`) and unlocked `TWIN_BRIDGES`. | `M1_r2_deep_shapes_sim` | R2 survey |
| F12 | Exterior Void vs. Sculpted 1-Tile Perimeter Wall Rendering & Topology-Aware Biome Decors | `#0B090E` Exterior Void rendering, active 1-tile walls, and `0` decors in Exterior Void. | `M2_r2_void_walls_minimap_client` | R2 survey |
| F13 | Minimap & `[Tab]` Full-Map Room Shape Silhouettes, Proportional Node Sizing & Live Player Dot | Proportional node sizing and polygon silhouettes for all 10 room shapes. | `M2_r2_void_walls_minimap_client` | R2 survey |
| F14 | Round 2 5-Tier E2E Suite Expansion & Complete Playwright Room Shape Visual Comparison Suite | 146-test E2E suite and 13 Playwright 1920×1080 screenshots (`01`..`13.png`). | `M3_r2_e2e_and_playwright_visuals` | R2 survey |
| F15 | Surface Autotile Family Fix (`burning_grass` & `ice`/`water`) & Hazard-Safe Prop/Brazier Spawning | Fix `ArenaMap.isSameSurfaceFamily` typo (`b === 'burning_grass'` on line 707) and separate `'ice'` from `'water'`/`'electrified_water'`; update `isValidAnchorTile` & `spawnBrazierSafe` (`arena-room-archetypes.ts`) so props and floor braziers prefer dry `'none'` floor over `ice`, `lava`, and `conveyor` belts. | `M1_r3_sim_surfaces_and_props` | R3 survey |
| F16 | Complete Wall Parapet Coping (`!hasS`), `4×4`/`4×12` Concave Miters, Diagonal Void Casing, Corner-Only Wall AO & Non-`2×2` Pillar Medallions | Draw W/E/N 4px parapet coping on `!hasS` wall tiles (`y = 0..20`) with selective open seam strokes; replace caution-tape North cliff slashes with subtle mortar cracks; align concave corner miters to `4×4` / `4×12` (`y = 20..32`); add `6×6` diagonal Exterior Void corner shadows & map-edge outer contours; restrict `bakeWallAoOverlay` `14×14` square to convex outer corners and skip `wall_ao` on `chasm`/`lava`/`burning_*`; restrict quadrant-split pillar medallions strictly to true `2×2` pillars (`texture-baker-tiles.ts`, `arena-tiles.ts`). | `M2_r3_client_tiles_surfaces_bridges` | R3 survey |
| F17 | Seamless Multi-Tile Hazard Pools, Concave Corner Shorelines, Chasm Top-Corner Strata & Multi-Axis (`N–S` / `E–W`) Chasm Bridges | Eliminate `32×32` radial-gradient waffle grid on `burning_oil`/`burning_grass` and linear-gradient banding on `lava`/`ice`/`water`/`electrified_water`; keep fissures inside exposed pool edges; connect lightning/oil details across tiles; close `2.4px` concave inner-corner shoreline gaps; clip northern chasm rock strata horizontally to `[rx, rx+rw]` and suppress floor lips against solid walls; extend `drawBridgeOverChasmOverlay` to support both E–W and N–S bridges with outer-only chasm guardrails (`texture-baker-surfaces.ts`, `arena-tiles.ts`). | `M2_r3_client_tiles_surfaces_bridges` | R3 survey |
| F18 | WebGL `lightmapRt` FBO Resize Fix, Exterior Void Light/Mote/God-Ray Masking, Dynamic Pillar Shadows, Grounded Floor Braziers, Direction-Aware Wall Decors & Minimap Corridor Clipping | Enable `webglRt?.setAutoResize?.(true)` around `this.lightmapRt.resize(rtW, rtH)` in `LightingPipeline`; anchor Biome 2 God-Rays to active North walls, skip dust motes in Exterior Void, and mask `isExteriorVoidWallTile` cells above additive light layers (`depth 36.2`); compute true `widthTiles`/`heightTiles` for `pillarShadows` clipped to `surface === 'none'` and center `2×2` pillar decors without totem triple-stacking; restore floor `torch_brazier` shadows and remove mid-air rods; make wall decors direction/cliff-aware; clip Minimap corridors to room node borders and scale/clamp compact player dot (`lighting-pipeline.ts`, `biome-architecture.ts`, `biome-architecture-render.ts`, `entity-sync.ts`, `hud-qol-and-minimap.ts`). | `M3_r3_client_lighting_architecture_minimap` | R3 survey |
| F19 | Round 3 5-Tier E2E Regression Suite & 13-Scene Playwright Visual Verification (`1920×1080`) | Expand E2E test suite (`tests/e2e/map-overhaul-e2e.test.ts`) with Round 3 regression contracts (`T5-WB-21`+), recapture all 13 Playwright screenshots (`output/playwright/map-overhaul/01..13.png`), visually verify every screenshot via `view_file` for zero remaining visual/shadow/lighting/effect defects, and pass Tier 5 white-box adversarial hardening & Forensic Audit. | `M4_r3_e2e_and_playwright_visuals` | R3 survey |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | `M1_room_topology_sim` (R1) | Shared Simulation Round 1 (F1–F4). | none | DONE |
| 2 | `M2_visual_depth_client` (R1) | Client Rendering Round 1 (F5–F9). | M1 (R1) | DONE |
| 3 | `M3_final_e2e_and_hardening` (R1) | Final Milestone Round 1 (F10). | M1, M2 (R1) | DONE |
| 4 | `M1_r2_deep_shapes_sim` (R2) | Shared Simulation Round 2 (F11). | none | DONE |
| 5 | `M2_r2_void_walls_minimap_client` (R2) | Client Rendering & Minimap Round 2 (F12, F13). | none | DONE |
| 6 | `M3_r2_e2e_and_playwright_visuals` (R2) | E2E Testing & Playwright Visuals Round 2 (F14). | M1_r2, M2_r2 | DONE |
| 7 | `M1_r3_sim_surfaces_and_props` | Shared Simulation Round 3 (`packages/shared/**`): Fix `isSameSurfaceFamily` (`burning_grass` typo on line 707 + separate `'ice'` from `'water'`/`'electrified_water'`) in `arena-map.ts`; update `isValidAnchorTile` & `spawnBrazierSafe` in `arena-room-archetypes.ts` to prefer dry `'none'` floor over `ice`, `lava`, and `conveyor` belts; add Round 3 shared unit tests and pass all shared tests (F15). | none | DONE (`sub_orch_m1_r3`: `67/67` files / `403/403` shared tests passed, 2 Reviewers APPROVE, 2 Challengers APPROVE, Auditor CLEAN) |
| 8 | `M2_r3_client_tiles_surfaces_bridges` | Client Tile, Surface & Bridge Baker + Ground Composite Round 3 (`apps/client/src/art/texture-baker-tiles.ts`, `apps/client/src/art/texture-baker-surfaces.ts`, `apps/client/src/scenes/game-scene/arena-tiles.ts`): Fix `!hasS` wall parapet coping & open seam strokes, subtle North cliff mortar weathering, `4×4`/`4×12` (`y = 20..32`) concave corner miters, `6×6` diagonal Exterior Void corner shadows & map-edge outer contours, convex-corner-only `14×14` wall AO & AO suppression over `chasm`/`lava`/`burning_*`, non-`2×2` pillar medallions, seamless `burning_oil`/`burning_grass`/`lava`/`ice`/`water`/`electrified_water`/`oil`/`grass` pools & concave inner-corner shorelines, chasm top-corner strata clipping & wall-to-chasm floor lip suppression, and multi-axis (`N–S` / `E–W`) `drawBridgeOverChasmOverlay` without internal rail bars; add client unit tests (F16, F17). | Interface Contracts defined | DONE (`sub_orch_m2_r3`: `26` suites / `202` client tests passed, 2 Reviewers APPROVE, 2 Challengers APPROVE, Auditor CLEAN) |
| 9 | `M3_r3_client_lighting_architecture_minimap` | Client Lighting Pipeline, Biome Architecture, Entity Sync & Minimap Round 3 (`apps/client/src/fx/lighting-pipeline.ts`, `apps/client/src/world/biome-architecture.ts`, `apps/client/src/world/biome-architecture-render.ts`, `apps/client/src/scenes/game-scene/entity-sync.ts`, `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts`): Fix `LightingPipeline` WebGL `RenderTarget.resize` (`setAutoResize(true)`), anchor Biome 2 God-Rays to active North walls, skip dust motes in Exterior Void, mask `isExteriorVoidWallTile` cells above additive lighting (`depth 36.2`), remove hard-edged `glowGraphics` circles, compute true contiguous `widthTiles`/`heightTiles` for `pillarShadows` clipped to `surface === 'none'`, center `2×2` pillar decors without totem triple-stacking, restore floor `torch_brazier` shadows and remove mid-air rods, make wall decors direction/cliff-aware, and clip Minimap corridors to room node borders + scale/clamp compact player dot; add client unit tests (F18). | Interface Contracts defined | DONE (`sub_orch_m3_r3`: `26` suites / `202` client tests & `vite build` passed, 2 Reviewers APPROVE, 2 Challengers APPROVE, Auditor CLEAN) |
| 10 | `M4_r3_e2e_and_playwright_visuals` | E2E Testing Track Update & Final Visual Verification Round 3 (`tests/e2e/**`, `TEST_INFRA.md`, `TEST_READY.md`, `output/playwright/map-overhaul/**`): Expand 5-Tier E2E suite (`tests/e2e/map-overhaul-e2e.test.ts`) with Round 3 regression contracts (`T5-WB-21`..`26`), recapture all 13 `1920×1080` Playwright WebGL screenshots (`01`..`13.png`), visually inspect every screenshot via `view_file` to verify zero remaining visual/shadow/lighting/effect defects, and pass Tier 5 white-box adversarial coverage hardening & Forensic Audit (F19). | `M1_r3_sim_surfaces_and_props`, `M2_r3_client_tiles_surfaces_bridges`, `M3_r3_client_lighting_architecture_minimap` | DONE (`sub_orch_m4_r3`: `152/152` E2E tests passed, `13/13` Playwright PNGs verified, 2 Reviewers APPROVE, 2 Challengers APPROVE, Auditor CLEAN) |

---

## Interface Contracts

### 1. `packages/shared/src/sim/arena-map.ts` & `arena-room-archetypes.ts` ↔ `apps/client/**` & `tests/e2e/**`
- **`ArenaMap.isSameSurfaceFamily(a: SurfaceKind, b: SurfaceKind): boolean`**:
  - Returns `true` when `a === b`, or when `(a === 'water' || a === 'electrified_water') && (b === 'water' || b === 'electrified_water')`, or when `(a === 'grass' || a === 'ash') && (b === 'grass' || b === 'ash')`.
  - Fixes the line 707 typo (`a === 'burning_grass'`) so `burning_grass` tiles only match `burning_grass` neighbors (giving `surfaceMask !== 15` on pool borders), and separates solid `'ice'` from liquid `'water'` / `'electrified_water'` so adjacent `ice` and `water` pools both draw their shoreline rims.
- **Hazard-Safe Prop & Brazier Anchor Selection (`arena-room-archetypes.ts`)**:
  - `isValidAnchorTile` and `spawnBrazierSafe` require `map.getSurface(tx, ty) === 'none'` on the primary search pass (with outward-ring fallback to non-chasm/non-lava/non-conveyor walkable floor only if no `'none'` surface exists in the search radius), ensuring `torch_brazier`, `forge_blast_shield`, and `slag_crucible` do not spawn inside `ice`, `lava`, or `conveyor` belts.

### 2. `apps/client/src/art/texture-baker-surfaces.ts` & `texture-baker-tiles.ts` ↔ `apps/client/src/scenes/game-scene/arena-tiles.ts` & `tests/e2e/**`
- **`drawBridgeOverChasmOverlay` (`texture-baker-surfaces.ts`)**:
  ```ts
  export function drawBridgeOverChasmOverlay(
    ctx: CanvasRenderingContext2D,
    dx: number,
    dy: number,
    cellPx: number,
    hasChasmN: boolean,
    hasChasmS: boolean,
    biome: 0 | 1 | 2 | 3 = 1,
    hasChasmW = false,
    hasChasmE = false,
    isVerticalBridge = false,
  ): void;
  ```
  - Backward-compatible with existing 6-arg / 7-arg calls in E2E harness (`drawBridgeOverChasmOverlayContract`).
  - When `isVerticalBridge` or `((hasChasmW || hasChasmE) && !hasChasmN && !hasChasmS)`, renders **North–South bridge orientation** (horizontal deck planks across the walkway, vertical structural beams, and vertical guardrails strictly on `hasChasmW` / `hasChasmE` chasm edges).
  - For **East–West bridge orientation**, renders vertical deck planks and horizontal guardrails strictly on `hasChasmN` / `hasChasmS` chasm edges (no internal rail bars when `hasChasmN === false` or `hasChasmS === false`).
- **Concave Pool Corner & Chasm-Wall Transition Helpers (`texture-baker-surfaces.ts` & `arena-tiles.ts`)**:
  - Preserves `traceOrganicPoolPath(ctx, mask, 2.6)` (`0` `arcTo` for `mask === 15`, `4` `arcTo` for `mask === 0`) and `drawSurfaceTile` shoreline colors (`#1F1614` + `#EA580C` for lava, `#CFE8EE` for ice) required by `T5-WB-05`.
  - Adds concave inner-corner shoreline arcs/Steps in `arena-tiles.ts` (or via optional diagonal mask bits) and suppresses chasm walkable floor lips on edges adjacent to solid `'wall'` or `'pillar'` tiles.
- **Wall Parapet Coping, Concave Miters & Pillar Medallions (`texture-baker-tiles.ts` & `arena-tiles.ts`)**:
  - `bakeWallTile` draws W/E/N 4px parapet coping whenever `m !== 15` (clamping W/E coping height to `capBottom = hasS ? 32 : 20`) and open seam strokes only on exposed edges (`!hasN`, `!hasW`, `!hasE`).
  - `arena-tiles.ts` draws `4×4` (`floorNE`/`floorNW`) and `4×12` at `y = 20..32` (`floorSE`/`floorSW`) concave corner miters, `6×6` diagonal Exterior Void corner shadows, and map-border outer contours (`ty === 0`, `ty === map.rows - 1`, `tx === 0`, `tx === map.cols - 1`).
  - `bakePillarTile` only draws the quadrant-split corner rune medallion on true `2×2` corner masks (`6, 10, 5, 9`), and `arena-tiles.ts` verifies that all 4 tiles of the `2×2` quad are `'pillar'` before using quadrant-split pillar textures (falling back to a centered relief on `1×N`, `2×1`, `2×4`, and L-pillar tiles).

### 3. `apps/client/src/fx/lighting-pipeline.ts`, `apps/client/src/world/biome-architecture*.ts`, `entity-sync.ts` & `hud-qol-and-minimap.ts`
- **`LightingPipeline.update` (`lighting-pipeline.ts`)**:
  - Toggles `webglRt?.setAutoResize?.(true)` before `this.lightmapRt.resize(rtW, rtH)` and `webglRt?.setAutoResize?.(false)` after so the WebGL FBO matches `rtW × rtH` (`Math.round(coverW * lightmapScale) × Math.round(coverH * lightmapScale)`).
- **`BiomeArchitectureLiveLayer` Exterior Void Mask & Grounded Braziers (`biome-architecture-render.ts` & `entity-sync.ts`)**:
  - Masks `isExteriorVoidWallTile` cells above additive lighting layers (`depth 36.2`, `PALETTE.INK_DEEP` `#0B090E` inset by `6px` along active wall edges so outer wall shadow casing remains visible), skips dust motes in solid/Exterior Void cells, anchors Biome 2 God-Rays to active North wall tiles (`!isExteriorVoidWallTile`), enables `prop_shadow` on floor `torch_brazier` props, and only draws `bracketGraphics` hanging rods when `(tx, ty - 1)` is a solid wall/pillar.
- **`hud-qol-and-minimap.ts`**:
  - Preserves `resolveMinimapNodeDims`, `computeMinimapRoomPolygon` (`4, 6, 8, 8, 8, 8, 8, 10, 12, 12` vertices), and `drawMinimapRoomSilhouette` op counts (`T5-WB-18..20`).
  - Clips corridor `fillRect` segments in `updateMinimapHudImpl` to the outer edges of connected room nodes and scales/clamps the compact-mode player dot (`dotR = 1.4`).

---

## Code Layout

- **Shared Simulation (`M1_r3_sim_surfaces_and_props` write scope — exclusive)**:
  - `packages/shared/src/sim/arena-map.ts`
  - `packages/shared/src/sim/arena-room-archetypes.ts`
  - `packages/shared/test/round3-surfaces-and-props.test.ts` (and `packages/shared/test/*.test.ts`)
- **Client Tiles, Surfaces, Chasm & Bridges (`M2_r3_client_tiles_surfaces_bridges` write scope — exclusive)**:
  - `apps/client/src/art/texture-baker-tiles.ts`
  - `apps/client/src/art/texture-baker-surfaces.ts`
  - `apps/client/src/scenes/game-scene/arena-tiles.ts`
  - `apps/client/test/round3-tiles-surfaces-bridges.test.ts`
- **Client Lighting, Biome Architecture, Entity Sync & Minimap (`M3_r3_client_lighting_architecture_minimap` write scope — exclusive)**:
  - `apps/client/src/fx/lighting-pipeline.ts`
  - `apps/client/src/world/biome-architecture.ts`
  - `apps/client/src/world/biome-architecture-render.ts`
  - `apps/client/src/scenes/game-scene/entity-sync.ts`
  - `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts`
  - `apps/client/test/round3-lighting-architecture-minimap.test.ts`
- **E2E Testing & Playwright Visual Verification (`M4_r3_e2e_and_playwright_visuals` write scope — exclusive)**:
  - `TEST_INFRA.md` (project root)
  - `TEST_READY.md` (project root)
  - `tests/e2e/helpers/map-overhaul-harness.ts`
  - `tests/e2e/map-overhaul-e2e.test.ts`
  - `tests/e2e/visual.spec.ts`
  - `output/playwright/map-overhaul/*.png`
