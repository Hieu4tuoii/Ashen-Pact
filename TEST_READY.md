# E2E Test Suite Ready (`TEST_READY.md`)

**Status**: **READY & VERIFIED (`152 / 152 PASSED` across Tiers 1–5 under `ENFORCE_OVERHAUL_CONTRACTS=1` + `13 / 13` Round 3 Playwright 1920×1080 WebGL Screenshots Verified)**
**Track Orchestrator**: `sub_orch_m4_r3` (`m4_r3_worker_1`)
**Date**: 2026-11-07T10:45:00Z

---

## 1. Test Runner Commands

### Standard Deterministic 5-Tier E2E Execution
```bash
npx vitest run -c tests/e2e/vitest.config.ts tests/e2e/map-overhaul-e2e.test.ts
```

### Strict Unadapted Contract Enforcement Mode (M4 Round 3 Final Gate — `152 / 152 PASSED`)
```bash
ENFORCE_OVERHAUL_CONTRACTS=1 npx vitest run -c tests/e2e/vitest.config.ts tests/e2e/map-overhaul-e2e.test.ts
```

### Playwright 1920×1080 WebGL Visual Browser Verification (`13 / 13 PASSED`)
```bash
npx playwright test tests/e2e/visual.spec.ts
```

---

## 2. 5-Tier Quantitative Summary

| Tier | Name | Required Minimum | Implemented Count | Static `expect(...)` Calls | Min `expect(...)` / Block | Status |
|------|------|------------------|-------------------|----------------------------|---------------------------|--------|
| **Tier 1** | Feature Coverage (`F1`–`F10`) | `>= 50` (`>= 5` / feature) | **50** (`5` / feature) | `223` | `>= 3` | **PASS** |
| **Tier 2** | Boundary & Corner Cases (`F1`–`F10`) | `>= 50` (`>= 5` / feature) | **50** (`5` / feature) | `223` | `>= 3` | **PASS** |
| **Tier 3** | Cross-Feature Combinations | `>= 15` | **18** (`T3-CF-01`..`18`) | `79` | `>= 3` | **PASS** |
| **Tier 4** | Real-World Application Scenarios | `>= 6` | **8** (`T4-SC-01`..`08`) | `72` | `>= 6` | **PASS** |
| **Tier 5** | White-Box Adversarial Coverage Hardening (`F1`–`F19`) | `>= 24` | **26** (`T5-WB-01`..`26`) | `260+` | `>= 3` | **PASS** |
| **Total** | **All 5 Tiers (`tests/e2e/map-overhaul-e2e.test.ts`)** | **`>= 148`** | **`152`** | **`857+`** | **`3`** | **152 / 152 PASSED** |

---

## 3. Feature Checklist & Test Coverage Matrix (`F1`–`F19`)

| Feature ID | Feature Name | Milestone | Tier 1 Tests (`5` each) | Tier 2 Tests (`5` each) | Tier 3 Combos (`18` total) | Tier 4 Scenarios (`8` total) | Tier 5 White-Box (`26` total) | Verified |
|------------|--------------|-----------|-------------------------|-------------------------|----------------------------|------------------------------|-------------------------------|----------|
| **F1** | Dynamic `ArenaMap.resize(cols, rows)` & 6 Room Size Presets (`compact` 28×18, `standard` 36×22, `wide_hall` 46×20, `tall_sanctum` 32×28, `grand_arena` 44×26, `colossal_boss` 48×28) | M1 (R1) | `T1-F1-01` .. `T1-F1-05` | `T2-F1-01` .. `T2-F1-05` | `T3-CF-01`, `02`, `03`, `04`, `07`, `10`, `13`, `15`, `17` | `T4-SC-01` .. `T4-SC-08` | `T5-WB-01`, `02`, `11`, `13`, `14` | **YES** |
| **F2** | Multi-Geometry Room Silhouettes (`RoomShapeKind`: `rectangle`, `octagon`, `cruciform`, `hourglass`) | M1 (R1) | `T1-F2-01` .. `T1-F2-05` | `T2-F2-01` .. `T2-F2-05` | `T3-CF-01`, `02`, `06`, `13` | `T4-SC-01`, `02`, `03`, `04`, `08` | `T5-WB-02`, `03`, `13`, `14` | **YES** |
| **F3** | Dynamic Door/Vestibule Helpers (`getDoorTilesForMap`, `getDoorVestibuleRectsForMap`), Proportional Archetypes (`TWIN_BRIDGES`, `GAUNTLET_CHOKEPOINT`, `CENTRAL_BASTION`, `CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, `CRUMBLING_PILLAR_RING`) & BFS Connectivity | M1 (R1) | `T1-F3-01` .. `T1-F3-05` | `T2-F3-01` .. `T2-F3-05` | `T3-CF-01`, `02`, `03`, `04`, `07`, `16`, `17` | `T4-SC-01`, `02`, `05`, `08` | `T5-WB-02`, `03`, `11`, `14` | **YES** |
| **F4** | Tactical Prop Eviction Protection (`MAX_TACTICAL_PROPS_PER_ROOM` & `rotten_totem_pillar` / `TileKind.Pillar` non-orphan guarantee) | M1 (R1) | `T1-F4-01` .. `T1-F4-05` | `T2-F4-01` .. `T2-F4-05` | `T3-CF-03`, `08`, `14`, `16` | `T4-SC-04` | `T5-WB-04` | **YES** |
| **F5** | Realistic Multi-Layered Molten Lava & Crystalline Ice (`texture-baker-surfaces.ts` + `traceOrganicPoolPath`) | M2 (R1) | `T1-F5-01` .. `T1-F5-05` | `T2-F5-01` .. `T2-F5-05` | `T3-CF-05`, `11`, `12` | `T4-SC-02`, `03` | `T5-WB-05`, `21`, `23` | **YES** |
| **F6** | Terrain Surfaces (`water`, `electrified_water`, `poison_swamp`, `oil`, `grass`, `burning_oil`, `burning_grass`), Subterranean Chasm Strata, Conveyors & 3-Tile Bridges (`drawBridgeOverChasmOverlay`) | M2 (R1) | `T1-F6-01` .. `T1-F6-05` | `T2-F6-01` .. `T2-F6-05` | `T3-CF-04`, `08`, `09`, `11`, `12` | `T4-SC-02`, `03` | `T5-WB-06`, `21`, `23` | **YES** |
| **F7** | Live Deterministic Surface Animation (`getFreezeVisualTimeSec`, `BiomeArchitectureLiveLayer`) & Additive Emissive Glow (`BlendModes.ADD`) | M2 (R1) | `T1-F7-01` .. `T1-F7-05` | `T2-F7-01` .. `T2-F7-05` | `T3-CF-05`, `08`, `09`, `11`, `12`, `15`, `18` | `T4-SC-01`, `02`, `03`, `07` | `T5-WB-07`, `24` | **YES** |
| **F8** | Tactile 2.5D Flagstone Floors (`variant 0..7` including Center Arena `4..7`), 3/4 Multi-Course Walls (`hasS` coping + south cliff faces) & Monumental 2x2 Pillars | M2 (R1) | `T1-F8-01` .. `T1-F8-05` | `T2-F8-01` .. `T2-F8-05` | `T3-CF-06`, `10`, `13`, `14` | `T4-SC-01`, `08` | `T5-WB-08`, `17`, `22` | **YES** |
| **F9** | Client Ground Composite Auto-Resize (`syncArenaTilesWithMapRevisionImpl`), Redraw Pass Fix (`renderGroundPass`), Prop Footprint Shadows/Idle Animations & Secret Door Light Suppression | M2 (R1) | `T1-F9-01` .. `T1-F9-05` | `T2-F9-01` .. `T2-F9-05` | `T3-CF-03` .. `T3-CF-10`, `14`, `15`, `16`, `18` | `T4-SC-01` .. `T4-SC-05`, `07`, `08` | `T5-WB-09`, `10`, `25` | **YES** |
| **F10** | End-to-End Multi-Room Floor Progression, Seed Determinism, Backward Compatibility (`36x22 rectangle`), CIE $L^*$ Photometric Contrast Invariants & Tier 5 Adversarial White-Box Hardening | M3 (R1) | `T1-F10-01` .. `T1-F10-05` | `T2-F10-01` .. `T2-F10-05` | `T3-CF-17`, `18` | `T4-SC-01`, `06`, `07`, `08` | `T5-WB-01` .. `T5-WB-12` | **YES** |
| **F11** | Deep *Enter the Gungeon*-Style Room Shapes (`10` `RoomShapeKind`s: `rectangle`, `octagon`, `cruciform`, `hourglass`, `l_shape`, `t_shape`, `u_shape`, `donut_ring`, `multi_chamber`, `island_catwalk`), Unlocked `TWIN_BRIDGES`, `360`-Combination Matrix & Center-Walkability Relocation Guards | `M1_r2_deep_shapes_sim` | `T1-F2-01` .. `T1-F2-05` | `T2-F2-01` .. `T2-F2-05` | `T3-CF-01`, `02`, `13` | `T4-SC-08` (`60` combos) | `T5-WB-02`, `11`, `13`, `14`, `15` | **YES** |
| **F12** | Exterior Void (`PALETTE.INK_DEEP` `#0B090E`) vs. Sculpted 1-Tile Perimeter Wall Rendering, Outer-Wall Shadow/Seam Casing, 90° Concave Parapet Miters & Topology-Aware Biome Decors (`0` in Exterior Void) | `M2_r2_void_walls_minimap_client` | `T1-F8-01` .. `T1-F8-05` | `T2-F8-01` .. `T2-F8-05` | `T3-CF-06`, `10`, `13` | `T4-SC-08` (`60` combos) | `T5-WB-13`, `16`, `17`, `22`, `24` | **YES** |
| **F13** | Minimap & `[Tab]` Full-Map Room Shape Silhouettes (`computeMinimapRoomPolygon`, `drawMinimapRoomSilhouette`), Proportional Node Sizing (`resolveMinimapNodeDims`) & Live Player Position Dot (`fillCircle`) | `M2_r2_void_walls_minimap_client` | Covered in Tier 5 | Covered in Tier 5 | Pairwise with F1, F11 | Verified across 13 WebGL scenes | `T5-WB-18`, `19`, `20`, `26` | **YES** |
| **F14** | Round 2 5-Tier E2E Suite Expansion (`146` tests) & Complete Playwright 1920×1080 WebGL Room Shape Visual Comparison Suite (`01`..`13.png`) | `M3_r2_e2e_and_playwright_visuals` | All 50 Tier 1 | All 50 Tier 2 | All 18 Tier 3 | All 8 Tier 4 | `T5-WB-01` .. `T5-WB-20` + Playwright `01`..`13` | **YES** |
| **F15** | Surface Autotile Family Fix (`burning_grass` typo & `ice`/`water` separation) & Hazard-Safe Prop/Brazier Spawning on Dry `'none'` Floor | `M1_r3_sim_surfaces_and_props` | `T1-F5-01` .. `T1-F6-05` | `T2-F5-05` | `T3-CF-03`, `04`, `08`, `14`, `16` | `T4-SC-02`, `03`, `06` | `T5-WB-21` | **YES** |
| **F16** | Complete Wall Parapet Coping (`!hasS`), `4×4`/`4×12` Concave Miters, `6×6` Diagonal Void Casing, Corner-Only `14×14` Wall AO & Non-`2×2` Pillar Medallions | `M2_r3_client_tiles_surfaces_bridges` | `T1-F8-01` .. `T1-F8-05` | `T2-F8-01` .. `T2-F8-05` | `T3-CF-06`, `10`, `13`, `14` | `T4-SC-01`, `08` | `T5-WB-17`, `22` | **YES** |
| **F17** | Seamless Multi-Tile Hazard Pools (`burning_oil`/`burning_grass`/`lava`/`ice`), `2.6×2.6` Concave Corner Shorelines, Chasm Top-Corner Strata & Multi-Axis (`N–S` / `E–W`) Chasm Bridges | `M2_r3_client_tiles_surfaces_bridges` | `T1-F5-01` .. `T1-F6-05` | `T2-F6-01` .. `T2-F6-05` | `T3-CF-04`, `05`, `09`, `11`, `12` | `T4-SC-02`, `03`, `05` | `T5-WB-05`, `06`, `23` | **YES** |
| **F18** | WebGL `lightmapRt` FBO Resize (`setAutoResize(true)`), Exterior Void Light/Mote/God-Ray Masking (`depth 36.2`), Dynamic Contiguous `pillarShadows`, Grounded Braziers, Direction-Aware Decors & Minimap Corridor Clipping / Compact Dot Clamping | `M3_r3_client_lighting_architecture_minimap` | `T1-F7-01` .. `T1-F9-05` | `T2-F7-01` .. `T2-F9-05` | `T3-CF-05`, `08`, `09`, `15`, `18` | `T4-SC-01` .. `T4-SC-08` | `T5-WB-24`, `25`, `26` | **YES** |
| **F19** | Round 3 5-Tier E2E Regression Suite (`152` tests across Tiers 1–5) & 13-Scene Playwright 1920×1080 WebGL Visual Verification (`01`..`13.png`) | `M4_r3_e2e_and_playwright_visuals` | All 50 Tier 1 | All 50 Tier 2 | All 18 Tier 3 | All 8 Tier 4 | All 26 Tier 5 (`T5-WB-01`..`26`) + Playwright `01`..`13` | **YES** |

---

## 4. Playwright 1920×1080 Headless Chromium WebGL Visual Verification (`output/playwright/map-overhaul/`)

All 13 real in-game 1920×1080 WebGL screenshots were recaptured in Round 3 via Playwright headless Chromium (`--use-gl=angle --use-angle=swiftshader`) and visually audited via `view_file`:

1. **[01-hub-sanctuary.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/01-hub-sanctuary.png)** — Hub Sanctuary (`36×22` `'rectangle'` runic flagstones, glowing departure portal, character statues, weapon rack, grounded `torch_brazier` props with pixel-accurate WebGL `lightmapRt` halos, clean North cliff faces without `#F59E42` caution slashes, direction-aware vertical West/East wrought-iron fences, and clipped Minimap corridors).
2. **[02-biome1-ashwood-crypts.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/02-biome1-ashwood-crypts.png)** — Biome 1 Ashwood Crypts (`standard` `36×22` `'rectangle'` `CENTRAL_BASTION` combat room with interlocking mossy temple flagstones, clean C-shaped 1-tile bastion walls without quarter-circle pillar medallions, seamless `burning_grass` pool with full charred perimeter shoreline rim, seamless `electrified_water` & `poison_swamp`, grounded floor braziers without mid-air rods, and clipped Minimap corridors).
3. **[03-biome2-glacial-vaults.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/03-biome2-glacial-vaults.png)** — Biome 2 Glacial Vaults (`standard` `36×22` **`'octagon'` + `'TWIN_BRIDGES'`** with pitch-black `#0B090E` Exterior Void corners masked at `depth 36.2`, complete `!hasS` wall parapet coping & aligned `4×4`/`4×12` concave miters, `6×6` diagonal void corner shadows, clipped chasm top-corner rock strata, multi-axis N–S & E–W 3-tile bridges without internal rail bars, seamless `ice` pools with concave inner-corner shoreline caps, and all braziers/props on dry floor).
4. **[04-biome3-molten-foundry.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/04-biome3-molten-foundry.png)** — Biome 3 Molten Foundry (`standard` `36×22` **`'octagon'` + `'CROSSFIRE_CONVEYORS'`** with `#0B090E` Exterior Void corners, riveted iron foundry floor plates, seamless `burning_oil` & `lava` pools without radial-gradient waffle grid or wall AO darkening, centered `2×2` pillar `fluted_column` & `forge_anvil` decors, and all `slag_crucible` / `forge_blast_shield` / `torch_brazier` props on dry floor).
5. **[05-topology-octagon-cruciform.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/05-topology-octagon-cruciform.png)** — Deep **`'cruciform'`** Chamber (`grand_arena` `44×26`, `CRUMBLING_PILLAR_RING`, centered at `zoom = 1.24`) showing all 4 deep `10×6` `#0B090E` Exterior Void cutouts with zero light/mote bleed, aligned `4×4` & `4×12` concave parapet miters, 6 `2×2` ring pillars without triple-stacked column/anvil decors, seamless `burning_grass` / `lava` / `ice` pools, and all braziers on dry floor.
6. **[06-colossal-boss-arena.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/06-colossal-boss-arena.png)** — Deep **`'octagon'`** Colossal Boss Arena (`colossal_boss` `48×28`, Floor 6 Boss Arena, centered at `zoom = 1.16`) showing all 4 deep 7-tile diagonal chamfered `#0B090E` Exterior Void corners, centered `2×2` boss column/anvil decors, seamless `lava` & `burning_oil` pools, pixel-accurate WebGL `lightmapRt` alignment at `zoom = 1.16`, and all Boss `torch_brazier` props on dry flagstones outside the corner lava pools.
7. **[07-shape-hourglass.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/07-shape-hourglass.png)** — Deep **`'hourglass'`** Chamber (`standard` `36×22`, `GAUNTLET_CHOKEPOINT`, centered at `zoom = 1.38`) showing deep North and South mid-wall pinched waist `#0B090E` Exterior Void cutouts with zero light/God-Ray bleed, distinct `ice` and `water` shorelines with concave inner-corner caps, and all props/braziers on dry floor.
8. **[08-shape-l-shape.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/08-shape-l-shape.png)** — Deep **`'l_shape'`** Chamber (`standard` `36×22`, `CENTRAL_BASTION`, centered at `zoom = 1.38`) showing the entire North-East quadrant carved into pitch-black `#0B090E` Exterior Void, aligned `4×4` concave miter at the inner L-elbow, seamless `burning_grass` & `electrified_water` pools, and wall-mounted vs. floor-grounded braziers.
9. **[09-shape-t-shape.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/09-shape-t-shape.png)** — Deep **`'t_shape'`** Chamber (`standard` `36×22`, `PRISM_LABYRINTH`, centered at `zoom = 1.38`) showing both South-West and South-East quadrants carved into pitch-black `#0B090E` Exterior Void, four `2×4` prism pillars with full-height `widthTiles=2, heightTiles=4` cast shadows clipped to dry floor and clean stone reliefs without sliced corner medallions.
10. **[10-shape-u-shape.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/10-shape-u-shape.png)** — Deep **`'u_shape'`** Chamber (`standard` `36×22`, `CROSSFIRE_CONVEYORS`, centered at `zoom = 1.38`) showing deep North-central courtyard `#0B090E` Exterior Void cutouts, central `2×1` horizontal pillar with non-floating `heightTiles=1` shadow, seamless `burning_oil` & `lava` pools, and clipped Minimap corridors.
11. **[11-shape-donut-ring.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/11-shape-donut-ring.png)** — Deep **`'donut_ring'`** Chamber (`grand_arena` `44×26`, `CRUMBLING_PILLAR_RING`, centered at `zoom = 1.24`) showing chamfered outer `#0B090E` Exterior Void corners and pitch-black hollow-core central architectural wall monolith (`depth 36.2` void mask preserving `6px` inner wall shadow casing), seamless `burning_grass` pool, and compact Minimap player dot clamped onto the ring corridor.
12. **[12-shape-multi-chamber.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/12-shape-multi-chamber.png)** — Deep **`'multi_chamber'`** Chamber (`standard` `36×22`, `GAUNTLET_CHOKEPOINT`, centered at `zoom = 1.38`) showing staggered NE and SW `#0B090E` Exterior Void quadrants, interior partition wall wings with narrow doorway chokepoints, L-shaped pillars with clean `fluted_column` drum & stone reliefs, and unobstructed `sunken_astrolabe`.
13. **[13-shape-island-catwalk.png](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/13-shape-island-catwalk.png)** — Deep **`'island_catwalk'`** Chamber (`standard` `36×22`, `CENTRAL_BASTION`, centered at `zoom = 1.38`) showing chamfered `#0B090E` Exterior Void corners, 360° perimeter `'chasm'` moat with suppressed wall-to-chasm floor lips, and properly oriented E–W (left/right) and N–S (top/bottom) 3-tile stone catwalk bridges with outer-only chasm guardrails.

---

## 5. Files Delivered in Round 3 (`M4_r3_e2e_and_playwright_visuals`)

1. **[TEST_INFRA.md](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/TEST_INFRA.md)** — 5-Tier E2E test architecture and `F1`–`F19` feature mapping.
2. **[TEST_READY.md](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/TEST_READY.md)** — Published readiness contract, runner commands, 5-tier verification matrix (`152` tests), and 13-scene Round 3 Playwright WebGL screenshot index.
3. **[tests/e2e/helpers/map-overhaul-harness.ts](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/tests/e2e/helpers/map-overhaul-harness.ts)** — Synced with `hasChasmAlongAxisWithin3`, `LightingPipeline`, `tx`/`ty`/`pathPoints` recording in `createRecording2dContext`, multi-axis `drawBridgeOverChasmOverlayContract`, and guarded `bakeWallTileContract`.
4. **[tests/e2e/map-overhaul-e2e.test.ts](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/tests/e2e/map-overhaul-e2e.test.ts)** — Complete 152-test 5-Tier E2E test suite (`Tiers 1–4` + `Tier 5 White-Box Adversarial Hardening` `T5-WB-01`..`T5-WB-26`).
5. **[tests/e2e/visual.spec.ts](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/tests/e2e/visual.spec.ts)** — Deterministic 1920×1080 Playwright WebGL visual comparison suite (`MAP_OVERHAUL_SCENES` `01`..`13`) with dry-floor showcase prop/brazier relocation and clean HUD state transitions.
6. **[output/playwright/map-overhaul/](file:///home/antigravity/Hieu4tuoii/Ashen-Pact/output/playwright/map-overhaul/)** — 13 verified Round 3 1920×1080 Playwright Headless Chromium WebGL PNG screenshots (`01-hub-sanctuary.png` .. `13-shape-island-catwalk.png`).
