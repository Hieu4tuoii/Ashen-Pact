# Post-VFX-Overhaul Game Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate post-VFX-overhaul frame-time spikes, per-frame `gl.texImage2D` Canvas2D stalls, static `Graphics` CPU Earcut triangulation (`2.58 MB/frame` `bufferSubData`), `DisplayList.depthSort` churn, per-rig/per-bullet GC allocations, and simulation/P2P CPU overhead while preserving 100% of existing features, visuals, determinism, and tests.

**Architecture:** Six orthogonal optimization layers across HUD text/debug caching, static & dirty-region world composite rendering, zero-allocation `CutoutRig` & entity sync with depth-sort guards and frustum culling, pooled VFX/overlays/lighting/audio caching, shared runtime `CutoutRig`/prop sprite atlasing, and bit-identical `WorldSim` spatial/collision/BFS & P2P baseline fingerprinting.

**Tech Stack:** TypeScript 5.x, Phaser 3.80+ WebGL (`MultiPipeline`, `CanvasTexture`, `PostFXPipeline`), WebAudio API, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-20-game-performance-optimization-design.md`

## Global Constraints

- Zero gameplay, visual, or test regressions: all 37 existing unit test files in `apps/client`, all unit tests in `apps/server`, all Playwright E2E smoke tests, and all 107 passing unit test files in `packages/shared` MUST remain 100% green. (Note: on baseline `main` commit `799f287`, 5 balance assertions in `packages/shared/test/{ap2-p1a-rare-weapons,ap2-p3c-balance-targets,phase1-sim,polish-p11-balance-difficulty,round3-surfaces-and-props}.test.ts` reflect prior manual balance tuning from `e270549` — NEVER alter any game balance constants in `packages/shared/src/data/` to chase those 5 pre-existing balance assertions.)
- Simulation determinism: `WorldSim` PRNG (`this.rng` and `this.volleyRng`) call counts and order, deterministic projectile ID bit-packing `(((ev.eventId ?? 1) & 0x3fffff) << 6) | (i & 0x3f)`, FIFO team caps (`MAX_PLAYER_PROJECTILES = 240`, `MAX_ENEMY_PROJECTILES = 300`), and BFS `CARDINAL_DIRS` tie-breaking MUST remain 100% bit-identical.
- Never alias `sim.queryEnemyScratch` inside nested callbacks (`applyDamageToEnemy`, elemental reactions, weapon specials, mutators, death handlers) while an outer loop iterates `sim.queryEnemyScratch`; always use a dedicated secondary scratch array.
- Texture & VRAM contracts (`apps/client/test/topdown-shader-vfx-baker.test.ts`): `fx_cutout_kit_512` (`512x512`, 51 frames + `_${0..3}` subframes), all 24 `SHADER_FX_TEXTURE_KEYS`, all `BAKED_FX_TEXTURE_KEYS`, and all 6 `ELEMENTAL_REACTION_STRIP_KEYS` MUST remain intact, and `computeTotalVramBytes(scene)` at DPR `1.5` (`bakeScale = 3`) MUST stay strictly within `[14_700_000, 24_950_000]` bytes. Shared runtime atlases for non-VFX rigs/weapons/props MUST use prefix `atlas_rig_prop_` and be excluded by `isPreExistingNonVfxWorldOrRigTextureKey`.
- Shader & primitive test contracts: `BIOME_POSTFX_FRAG` MUST contain `'smoothstep(0.22, 0.48, centerLuma)'` and `POSTFX_DEFAULTS.bloomStrength === 0.14`; `tapered-ribbon-builder.ts` triangle counts for a given `segments` argument MUST NOT change; do NOT alter primitive draw calls inside `drawEnemyEmbeddedArrows`, `drawEnemyParasiticThorns`, `drawSeedGunLifeBlossom`, or `drawVoidStaffBlackHole`.
- Pure math backward compatibility: `evaluateRigPose`, `blendRigPoseSnapshots`, `stepBackAccessorySpring`, `stepWeaponRecoilSpring`, `stepMeleeLungeGlideOffset`, and `findNextWalkableWaypoint` MUST still allocate fresh return objects when their optional `out` parameter is omitted.
- Live debug telemetry (`window.__GAME_DEBUG__`, `window.__P11_REMAINING_HUD_TEXT__`, `window.__LAST_P11_WAVE_BANNER__`) MUST continue updating accurately even when the F3 debug overlay is hidden.

## Review Focus

- Mocked Phaser `Text` / `Sprite` / `Scene` objects in unit tests often omit `.style`, `.textures.createCanvas`, or WebGL `gl` handles — every guard and atlas/sub-image fast path MUST fall back safely when optional Phaser internals are absent in unit tests.
- Calling `setTextAndColorIfChanged(txt, nextText, nextColor)` when BOTH text and color change MUST mutate `txt.style.color = nextColor` before calling `txt.setText(nextText)` (when `txt.style` exists) so Phaser runs `updateText()` once instead of twice, while calling `txt.setColor(nextColor)` when only color changes.
- Incremental `arenaGroundTex` updates MUST re-clear and re-render every tile in the dirty tile bounding box before clipped `renderGroundPass` so semi-transparent pillar shadows or decals never double-darken untouched floor pixels, and `texSubImage2D` MUST align pixel coordinates cleanly with `UNPACK_FLIP_Y_WEBGL` disabled (matching Phaser's `WebGLTextureWrapper` convention) or fall back cleanly when `gl` is unavailable.
- `CutoutRig` and `syncProps` runtime atlas frame binding MUST still report expected sprite visibility, scale, tint, and container hierarchy for `strip-browser-instrumentation.ts` and mocked unit tests where `TextureBaker.bakeAll` was not run.
- `SpatialHashGrid` `_gridStamp` deduplication MUST handle `queryId` wrap-around cleanly and work on arbitrary entity IDs (`0` to `2^30`) without mutating serialized snapshot fields (`enumerable: false` or non-serialized transient field).

---

### Task 1: Zero-Redundancy `Phaser.Text` (`texImage2D`) Uploads, HUD Hash Decoupling & O(1) Debug Telemetry

**Files:**
- Create: `apps/client/src/ui/phaser-text-guard.ts`
- Modify: `apps/client/src/scenes/game-scene/p11-drama-hud.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-ashen-pact-modal.ts`
- Modify: `apps/client/src/ui/secret-arena-hud.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Test: `apps/client/test/perf-hud-text-upload-guard.test.ts`

**Interfaces:**
- Consumes: `CombatFxManager.getActiveParticleCount(): number` and `CombatFxManager.getActiveDamagePopupCount(): number` from `apps/client/src/fx/combat-fx.ts`.
- Produces:
  - `setTextIfChanged(txt: { text?: string; setText: (v: string) => unknown } | null | undefined, nextText: string): boolean` in `apps/client/src/ui/phaser-text-guard.ts`
  - `setColorIfChanged(txt: { style?: { color?: string }; setColor?: (c: string) => unknown } | null | undefined, nextColor: string): boolean` in `apps/client/src/ui/phaser-text-guard.ts`
  - `setTextAndColorIfChanged(txt: { text?: string; style?: { color?: string }; setText: (v: string) => unknown; setColor?: (c: string) => unknown } | null | undefined, nextText: string, nextColor: string): boolean` in `apps/client/src/ui/phaser-text-guard.ts`

- [ ] **Step 1: Write the failing test in `apps/client/test/perf-hud-text-upload-guard.test.ts`**

Write Vitest unit tests verifying:
1. `setTextAndColorIfChanged`:
   - When neither `text` nor `style.color` changed, calls neither `setText` nor `setColor` and returns `false`.
   - When only `nextColor` changed, calls `setColor(nextColor)` once (and `setText` 0 times) and updates color, returning `true`.
   - When BOTH `nextText` and `nextColor` changed and `txt.style` is writable, sets `txt.style.color = nextColor` first and calls `txt.setText(nextText)` once without a second `setColor` rasterization pass (and if `txt.style` is absent on a minimal mock, safely calls `setText` + `setColor`), returning `true`.
2. `updateP11RemainingEnemiesHud`: calling it across 10 consecutive frames with unchanged `aliveCombat = 5`, `wavesSpawned = 1`, `wavesTotal = 3`, and pill position invokes `pill.setText` and `pill.setColor` only on frame 1 (0 calls on frames 2–10), while still keeping `window.__P11_REMAINING_HUD_TEXT__` accurate and updating immediately when `aliveCombat` drops to `4`.
3. `updateVectorHudImpl` bottom-right weapon slot cards: firing shots / changing `clipAmmo`, `weaponHeat`, `reloadTimer`, or `meleeComboStep` without changing `weaponSlots`, `activeWeaponSlot`, keybindings, or locale does NOT clear/redraw `weaponSlotBgs` or call `setText`/`setColor` on `weaponKeyTexts`, `weaponNameTexts`, or `weaponMetaTexts`.
4. `syncSecretArenaHud` (`apps/client/src/ui/secret-arena-hud.ts`): ticking `progressRatio` across 10 frames with unchanged `titleColor` and `vm.textColorHex` does NOT call `titleText.setColor` or `primaryText.setColor` on frames 2–10.
5. `updateDebugStateImpl`: during `sim.runState === 'playing'` across 10 consecutive frames with unchanged kill count, `sim.computeMvpAwards` is called at most once, whereas transitioning to `sim.runState = 'victory'` recomputes `mvpAwardsCount` immediately on that frame.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/perf-hud-text-upload-guard.test.ts`
Expected: FAIL (`../src/ui/phaser-text-guard.js` module not found).

- [ ] **Step 3: Implement `phaser-text-guard.ts`, HUD dirty guards, weaponHash decoupling, int32 minimap hash, and `updateDebugState` caching**

1. Create `apps/client/src/ui/phaser-text-guard.ts` implementing `setTextIfChanged`, `setColorIfChanged`, and `setTextAndColorIfChanged` (tracking fallback last-color in a `WeakMap<object, string>` when `txt.style` is undefined on minimal test mocks!).
2. In `apps/client/src/scenes/game-scene/p11-drama-hud.ts`:
   - Cache `lastRemainingHudSig` on the scene (resetting when hidden or in `invalidateAllHudCachesImpl` if needed, or comparing `pill.visible`, `label`, `nextColor`, `pillX`, `pillY`) and use `setTextAndColorIfChanged` on `pill`.
3. In `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts`:
   - Remove `${cadenceStateHash}` from `weaponHash` (`line 438`) so bottom-right weapon cards only rebuild when `weaponSlots`, `activeWeaponSlot`, `mutators`/`weaponLevels` (if displayed on card), keybind labels (`slot1Key`, `slot2Key`), `uiScale`, or `locale` change, and use `setTextAndColorIfChanged` / `setColorIfChanged` on `weaponKeyTexts`, `weaponNameTexts`, `weaponMetaTexts`, and `ext.bossHintText` (`line 889`).
4. In `apps/client/src/scenes/game-scene/hud-ashen-pact-modal.ts` (`line 620-625`) and `apps/client/src/ui/secret-arena-hud.ts` (`line 309-315`):
   - Replace unguarded `setText` / `setColor` calls with `setTextAndColorIfChanged` / `setColorIfChanged`.
5. In `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts`:
   - Guard `bossTitleText` with `setTextAndColorIfChanged` (if `setColor` is used).
   - Replace string-concatenated `roomsTopologySig` loop (`lines 590-599`) with a 32-bit FNV-1a integer hash over `sim.dungeon.rooms` + cached keybindings signature so zero per-room strings are concatenated per frame.
6. In `apps/client/src/scenes/GameScene.ts` (`lines 787-789`):
   - Only invoke `resolveMinimapClickedRoomId(this, localViewX, localViewY)` when `pointer.leftButtonDown()` is true and `!this.fullMapOpen`, avoiding per-frame minimap hit-test math when the mouse button isn't even pressed.
7. In `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts` (`updateDebugStateImpl`):
   - Cache `lastMvpEvalTick`, `lastMvpRunState`, `lastMvpKills`, and `cachedMvpAwardsCount` on the scene so `sim.computeMvpAwards()` runs immediately when `sim.runState !== 'playing'` (e.g. `'victory'` or `'defeat'`) or on first frame, and during `'playing'` only recomputes when kills/player-count changed AND `sim.tick - lastMvpEvalTick >= 15`.
   - Use `this.fx.getActiveParticleCount()` and `this.fx.getActiveDamagePopupCount()` cleanly (no duplicate manual pool scans if any exist).

- [ ] **Step 4: Run focused and package tests to verify GREEN**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/perf-hud-text-upload-guard.test.ts test/polish-p9a-design-system-hud.test.ts test/ap2-p0a-hud-cadence.test.ts test/ap2-p4b-duo-ui-fx.test.ts`
Expected: PASS with 0 errors and 0 warnings.

- [ ] **Step 5: Run full client typecheck & unit suite and commit**

```bash
pnpm --filter @ashen-pact/client typecheck && pnpm --filter @ashen-pact/client test
git add apps/client/src/ui/phaser-text-guard.ts apps/client/src/scenes/game-scene/p11-drama-hud.ts apps/client/src/scenes/game-scene/hud-combat-and-coop.ts apps/client/src/scenes/game-scene/hud-ashen-pact-modal.ts apps/client/src/ui/secret-arena-hud.ts apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts apps/client/src/scenes/game-scene/hud-modals-and-debug.ts apps/client/src/scenes/GameScene.ts apps/client/test/perf-hud-text-upload-guard.test.ts
git commit -m "perf(hud): guard Phaser.Text texImage2D uploads, decouple weapon card hash, and cache debug MVP state"
```

---

### Task 2: Static Layer Rasterization (`SanctuaryVisualLayer`, `voidMask`), Dirty-Box `arenaGroundTex` `texSubImage2D` & Earcut-Free Live Architecture

**Files:**
- Modify: `apps/client/src/scenes/game-scene/sanctuary-architecture.ts`
- Modify: `apps/client/src/world/biome-architecture.ts`
- Modify: `apps/client/src/world/biome-architecture-render.ts`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts`
- Test: `apps/client/test/perf-world-composite-and-layers.test.ts`

**Interfaces:**
- Consumes: `ArenaMap`, `RoomArchitecturePlan` from `apps/client/src/world/biome-architecture.ts`.
- Produces:
  - Optional `clipRectWorld?: { x: number; y: number; width: number; height: number }` parameter on `renderBiomeArchitectureToComposite(ctx, map, plan, cellPx, clipRectWorld?)` and `BiomeArchitectureLiveLayer.renderGroundPass(ctx, map, tileCompositeScale?, clipRectWorld?)` in `apps/client/src/world/biome-architecture-render.ts`.
  - `mergeExteriorVoidRowSpans(map: ArenaMap): Array<{ x: number; y: number; width: number; height: number }>` exported from `apps/client/src/world/biome-architecture-render.ts` for horizontal rect coalescing of exterior void masks.

- [ ] **Step 1: Write the failing test in `apps/client/test/perf-world-composite-and-layers.test.ts`**

Write Vitest unit tests verifying:
1. `mergeExteriorVoidRowSpans(map)` on an L-shape or donut room merges contiguous exterior void regions along each row, producing at least **65% fewer** rectangles than per-tile `isExteriorVoidWallTile` emission while covering the exact same pixel set (verify pixel-by-pixel occupancy on a boolean grid `map.width × map.height`!).
2. `BiomeArchitectureLiveLayer.update` in a room with 4 `torch_brazier` props and `burning_oil` + `electrified_water` + `poison_swamp` tiles calls `additiveGraphics.fillCircle` **0 times** for tiny embers/motes/hazard glints (`r <= 3.0px`, using Earcut-free `fillRect` / `fillTriangle` instead) while still emitting additive geometry onto `additiveGraphics`.
3. `getVisibleFloorDecals(plan, map)` in `biome-architecture.ts` returns a cached array reference when called repeatedly with the same `plan` and unchanged `map.mapRevision`, and invalidates immediately when `map.setSurface(...)` increments `map.mapRevision`.
4. `SanctuaryVisualLayer`: when `scene.make?.renderTexture` or `floorGraphics.generateTexture` is available, `floorGraphics` is cleared & hidden (`floorGraphics.visible === false`) after baking into a static `Image` at `depth === 6`, so 0 static `Graphics` commands remain active per frame in the Hub; when neither texture baker API is present on a minimal test mock, `floorGraphics` remains visible as a graceful fallback.
5. `syncArenaTilesWithMapRevisionImpl`: when 1 interior tile's surface changes (`map.setSurface(10, 10, 'burning_oil')`), only tiles inside the expanded dirty bounding box are re-rendered (not all `cols * rows` tiles), `renderGroundPass` receives a tight `clipRectWorld` instead of full-room unclipped overdraw, and if a WebGL texture wrapper (`gl` + `webGLTexture`) is present on `arenaGroundTex`, `gl.texSubImage2D` (or sub-canvas upload) is used instead of full-canvas `gl.texImage2D` (`arenaGroundTex.refresh()`), falling back to `arenaGroundTex.refresh()` when WebGL handles are absent.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/perf-world-composite-and-layers.test.ts`
Expected: FAIL (`mergeExteriorVoidRowSpans` is not exported).

- [ ] **Step 3: Implement static Hub/voidMask rasterization, Earcut-free motes, decal caching, and dirty-box `arenaGroundTex` upload**

1. In `apps/client/src/world/biome-architecture.ts`:
   - Cache `getVisibleFloorDecals(plan, map)` using a `WeakMap<RoomArchitecturePlan, { mapRef: ArenaMap; rev: number; decals: FloorArchitectureDecal[] }>` so repeated calls in the same `mapRevision` return the cached array with zero `.filter()` allocation.
2. In `apps/client/src/world/biome-architecture-render.ts`:
   - Export `mergeExteriorVoidRowSpans(map: ArenaMap)` that computes the exact per-tile exterior void mask rectangles (preserving the exact 6px `adjN/S/W/E` and `diagNW/NE/SW/SE` insets from lines `810-862` — verify 1:1 equivalence!) and merges horizontally adjacent rectangles with identical `(y, height)`.
   - In `BiomeArchitectureLiveLayer`:
     - If `scene.textures?.createCanvas` and `scene.add?.image` exist, rasterize the merged void mask spans once per `voidMaskSig` onto a lightweight `1×` world-resolution `CanvasTexture` (`__biome_void_mask_tex__`) displayed by a `Phaser.GameObjects.Image` at `depth: 36.2`, keeping `this.voidMaskGraphics` cleared & `setVisible(false)` (and destroying the image/texture in `destroy()`). If `createCanvas` is absent in unit tests, draw the merged spans into `this.voidMaskGraphics` (still ~85% fewer rects!).
     - Replace tiny `r <= 3.0px` `fillCircle` calls on `additiveGraphics` (brazier embers `r = 1.1..1.65`, warm dust motes `r = 1.1..1.35`, hazard spark glints `r = 2.2..2.6`, and bowl core `r = 3.0`) and `gearGraphics` (`lava` `r = 1.6..2.5`, `poison_swamp` `r = 1.4..2.3`) with crisp 2-triangle diamonds (`fillTriangle` top + bottom or `fillRect` for `r <= 1.65`) — zero Earcut calls! (Keep `fillCircle` on `gearGraphics` brass gear hubs `r = 6.6` in Biome 3 or if any test checks gear hubs.)
     - Set `this.additiveGraphics.setVisible(this.additiveGraphics.commandBuffer?.length ? this.additiveGraphics.commandBuffer.length > 0 : true)` and same for `gearGraphics` / `bracketGraphics`.
     - Add optional `clipRectWorld?: { x: number; y: number; width: number; height: number }` to `renderBiomeArchitectureToComposite` and `renderGroundPass`: when provided, wrap the draw in `ctx.save(); ctx.beginPath(); ctx.rect(clipRectWorld.x * scale, clipRectWorld.y * scale, clipRectWorld.width * scale, clipRectWorld.height * scale); ctx.clip(); ... ctx.restore();`, and skip `pillarShadows` / `visibleDecals` / `solidDecors` whose world bounds do not intersect `clipRectWorld`!
3. In `apps/client/src/scenes/game-scene/sanctuary-architecture.ts`:
   - Bake static Sanctuary floor once per `staticKey` (`${mapW}x${mapH}:${locale}`): if `this.floorGraphics.generateTexture` and `this.scene.add?.image` exist (in real Phaser runtime), call `this.drawStaticFloor(this.floorGraphics, this.cachedSpec)`, generate texture `'__sanctuary_static_floor__'` (`mapW`, `mapH`), attach/update `this.staticFloorImage` (`origin(0, 0)`, `depth: 6`), then `this.floorGraphics.clear(); this.floorGraphics.setVisible(false);`! Clean up `staticFloorImage` and texture on `destroy()` and hide when `!sim.inHub || sim.stressTestActive`. When `generateTexture` is unavailable (unit-test mocks), keep `this.floorGraphics` visible exactly as before.
   - Guard any `.setDepth(...)` calls inside `sanctuary-architecture.ts` with `if (obj.depth !== d) obj.setDepth(d)`.
4. In `apps/client/src/scenes/game-scene/arena-tiles.ts` (`syncArenaTilesWithMapRevisionImpl`):
   - When `!biomeChanged && !conveyorFlipped && scratchDirtyTiles.length > 0 && scratchDirtyTiles.length <= 64 && this.arenaGroundTex`:
     - Compute tile bounding box `[minTx, maxTx] × [minTy, maxTy]` across `scratchDirtyTiles`, expanded by 1 tile (clamped to `[0..map.cols-1] × [0..map.rows-1]`) so neighbor shoreline/AO/pillar-shadow overlaps stay seamless.
     - Re-render all tiles `(tx, ty)` inside `[minTx..maxTx] × [minTy..maxTy]` via `this.renderTileCellToComposite(tile)`.
     - Pass `clipRectWorld = { x: minTx * TILE_SIZE, y: minTy * TILE_SIZE, width: (maxTx - minTx + 1) * TILE_SIZE, height: (maxTy - minTy + 1) * TILE_SIZE }` to `this.biomeArchLive.renderGroundPass(...)` so untouched floor tiles outside the box are NEVER double-darkened by pillar shadows or astrolabe strokes!
     - Upload ONLY the dirty pixel sub-rectangle `(px, py, pw, ph)` to WebGL using a small reusable offscreen patch `<canvas>` + `gl.bindTexture(gl.TEXTURE_2D, webGLTex)` + `gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, ...)` (matching Phaser's `arenaGroundTex` `pma` state — check `source.glTexture.pma`!) + `gl.texSubImage2D(gl.TEXTURE_2D, 0, px, py, gl.RGBA, gl.UNSIGNED_BYTE, patchCanvas)` when WebGL `gl` and `source.glTexture?.webGLTexture` exist (also keeping `arenaGroundTex.canvas` already updated in place for any CPU `getImageData` callers in tests!), falling back to `this.arenaGroundTex.refresh()` otherwise!

- [ ] **Step 4: Run focused and existing architecture/tile/sanctuary tests to verify GREEN**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/perf-world-composite-and-layers.test.ts test/round3-tiles-surfaces-bridges.test.ts test/round3-lighting-architecture-minimap.test.ts test/map-overhaul-r2-void-and-minimap.test.ts test/polish-p4-map-architecture.test.ts test/polish-p5-biome-architecture.test.ts test/sanctuary-architecture.test.ts`
Expected: PASS with 0 errors.

- [ ] **Step 5: Run full client typecheck & unit suite and commit**

```bash
pnpm --filter @ashen-pact/client typecheck && pnpm --filter @ashen-pact/client test
git add apps/client/src/scenes/game-scene/sanctuary-architecture.ts apps/client/src/world/biome-architecture.ts apps/client/src/world/biome-architecture-render.ts apps/client/src/scenes/game-scene/arena-tiles.ts apps/client/test/perf-world-composite-and-layers.test.ts
git commit -m "perf(world): bake static Sanctuary/voidMask layers, eliminate mote Earcut circles, and upload dirty ground sub-rects"
```

---

### Task 3: Zero-Alloc `CutoutRig`, DisplayList `setDepth` Sort Guard, Frustum Culling & Projectile Spec Caching

**Files:**
- Modify: `apps/client/src/art/cutout-rig-math.ts`
- Modify: `apps/client/src/art/cutout-rig.ts`
- Modify: `apps/client/src/scenes/game-scene/entity-sync.ts`
- Modify: `apps/client/src/scenes/game-scene/room-entities-sync.ts`
- Modify: `apps/client/src/scenes/game-scene/portal-door-sync.ts`
- Test: `apps/client/test/perf-rig-and-entity-sync.test.ts`

**Interfaces:**
- Consumes: `setTextAndColorIfChanged`, `setColorIfChanged` from `apps/client/src/ui/phaser-text-guard.ts` (Task 1).
- Produces:
  - `createEmptyRigPoseSnapshot(): RigPoseSnapshot` in `apps/client/src/art/cutout-rig-math.ts`
  - Optional `out?: RigPoseSnapshot` parameter on `evaluateRigPose(params, out?)` and `blendRigPoseSnapshots(from, to, alpha, out?)` in `apps/client/src/art/cutout-rig-math.ts`
  - `stepBackAccessorySpringInPlace(state: BackAccessorySpringState, params: ...): BackAccessorySpringState` and `stepWeaponRecoilSpringInPlace(state: WeaponRecoilSpringState, dtSec: number): WeaponRecoilSpringState` in `apps/client/src/art/cutout-rig-math.ts`
  - `setDepthIfChanged<T extends { depth?: number; setDepth: (d: number) => unknown }>(obj: T, depth: number): void` and `setBlendModeIfChanged<T extends { blendMode?: number | string; setBlendMode: (m: number) => unknown }>(obj: T, mode: number): void` exported from `apps/client/src/scenes/game-scene/entity-sync.ts`

- [ ] **Step 1: Write the failing test in `apps/client/test/perf-rig-and-entity-sync.test.ts`**

Write Vitest unit tests verifying:
1. `evaluateRigPose(params, out)` and `blendRigPoseSnapshots(a, b, 0.5, out)`:
   - Mutate `out` in place (`result === out` and `result.parts.torso === out.parts.torso`) and produce numerically identical transforms to calling `evaluateRigPose(params)` / `blendRigPoseSnapshots(a, b, 0.5)` without `out`.
   - Calling `evaluateRigPose(params)` without `out` still returns distinct fresh snapshots so two sequential calls do not alias each other.
   - `Map` constructor spy (`vi.spyOn(globalThis, 'Map')` or allocation check): calling `evaluateRigPose(params, out)` 100 times constructs **0** `new Map()` instances.
2. `setDepthIfChanged` and `setBlendModeIfChanged`: calling `setDepthIfChanged(sprite, 59)` when `sprite.depth === 59` does NOT invoke `sprite.setDepth`, preventing Phaser `queueDepthSort()`, and DOES invoke `sprite.setDepth(60)` when `sprite.depth !== 60`.
3. `syncProjectilesAndPickupsImpl`: across 10 frames of an in-flight bullet (`id = 42`, unchanged weaponId/element/stress/opacity), `entry.glowSprite.setDepth` and `entry.sprite.setTexture` are NOT called on frames 2–10.
4. Offscreen enemy frustum culling in `syncEnemyRigsImpl`: an alive enemy positioned 300px outside `cameras.main.worldView` sets `rig.container.visible` to `false` and skips full pose evaluation (`evaluateRigPose`), then immediately restores `visible === true` and updates pose on the frame it enters `worldView + 64px`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/perf-rig-and-entity-sync.test.ts`
Expected: FAIL (`createEmptyRigPoseSnapshot` / `setDepthIfChanged` not exported).

- [ ] **Step 3: Implement zero-alloc `CutoutRig`, `setDepthIfChanged` guards, projectile spec caching, and offscreen culling**

1. In `apps/client/src/art/cutout-rig-math.ts`:
   - Cache a `WeakMap<EntityRigDef, Partial<Record<RigPartId, RigPartDef>>>` so `evaluateRigPose` looks up base parts in O(1) without constructing `new Map()` or a `getBase` closure on every call.
   - Export `createEmptyRigPoseSnapshot()`, add optional `out?: RigPoseSnapshot` to `evaluateRigPose`, `cloneRigPoseSnapshot`, and `blendRigPoseSnapshots`, use module-level scratch structs for internal `computeHeadAimOffset` / `computeEnemyArchetypeMotion` calls inside `evaluateRigPose`, and export `stepBackAccessorySpringInPlace`, `stepWeaponRecoilSpringInPlace`, and `stepMeleeLungeGlideOffsetInPlace` (keeping the original functions 100% backward-compatible when called by existing unit tests!).
2. In `apps/client/src/art/cutout-rig.ts`:
   - Pre-allocate `poseScratch`, `blendFromScratch`, and `blendedPoseScratch` via `createEmptyRigPoseSnapshot()` on each `CutoutRig` instance and use the in-place spring & pose functions inside `CutoutRig.update()` and `setAnimState()` crossfade capture.
   - Dirty-check `x`, `y`, `rotation`, `scaleX`, `scaleY` in `applyPoseSnapshot` (`1e-4` epsilon) and cache `lastAppliedTint` / `lastChilledFoot` / `lastSilhouetteInverted` in `applyHitFlashAndStatusVisuals` so `clearTint()` and `setTint()` are only called on actual tint changes instead of across all 8 sprites every frame.
   - Add a lightweight `advanceClockOnly(dtSec: number)` method on `CutoutRig` (stepping `animTime`, `hitFlashTimer`, and springs without running `evaluateRigPose` or mutating Phaser `Sprite` transforms) for offscreen enemies.
3. In `apps/client/src/scenes/game-scene/entity-sync.ts`:
   - Export and apply `setDepthIfChanged` and `setBlendModeIfChanged` across `statusRimPool`, `statusFreezeCuffPool`, `statusBadgePool`, `duoRailLockPool`, `projectileSprites` (`sprite` & `glowSprite`), and `pickupSprites`.
   - In `syncEnemyRigsImpl`, when `cameras?.main?.worldView` has positive dimensions and an enemy's interpolated `(pos.x, pos.y)` lies outside `worldView` expanded by `72px` (and `!isVisualFreezeActive(this)`), hide `rig.container` and call `rig.advanceClockOnly(dtSec)` instead of full `rig.update(dtSec)`, restoring `rig.container.setVisible(true)` as soon as it enters the expanded view!
   - In `syncProjectilesAndPickupsImpl`, cache `(cachedWeaponId, cachedElement, cachedTeam, cachedKind, cachedIsCrit, cachedStress, cachedOpacity, cachedTint, cachedAlpha, cachedDepth, cachedBlendMode, specScale)` on each `ProjectileVisualEntry` so `resolveProjectileRenderSpec` only runs when the slot binds a new projectile ID or a relevant key changes; cull offscreen projectile `glowSprite` `Math.sin` pulsing outside `worldView + 48px`.
   - Guard `emoteBg.clear()` in `updatePlayerOverheadUiImpl` with a `hadEmoteBgDrawn` flag on `emoteBg`, and skip `syncFragFuseWheelsImpl`'s projectile loop unless at least one player holds `'frag_launcher'` or `this.fragFuseWheelSprites.size > 0`.
4. In `apps/client/src/scenes/game-scene/room-entities-sync.ts` and `apps/client/src/scenes/game-scene/portal-door-sync.ts`:
   - Replace unguarded `.setDepth(...)` calls on summons and portals/doors with `setDepthIfChanged`.
   - Fix `secret_challenge_crystal` world label (`room-entities-sync.ts:978-981`) using `setTextAndColorIfChanged`.
   - Remove the duplicate `drawWorldWeaponSalvageRing` call in `room-entities-sync.ts:1103` (since `telegraphs-and-overlays.ts:158` already draws it on `groundHazardGraphics` every frame! Verify no test calls `syncRoomEntitiesImpl` expecting salvage ring on `interactHighlightGraphics`).
   - In `portal-door-sync.ts`, frustum-cull offscreen door barrier shader uniform updates and door mote updates when a door is >80px outside `cameras.main.worldView` (when `worldView.width > 0` and not in aTransition burst).

- [ ] **Step 4: Run focused and existing rig/entity/portal tests to verify GREEN**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/perf-rig-and-entity-sync.test.ts test/polish-p10a-cutout-rig.test.ts test/polish-p10b-fx-elemental-ambient.test.ts test/polish-p8-portal-door.test.ts test/commercial-class-and-interaction-vfx.test.ts`
Expected: PASS with 0 errors.

- [ ] **Step 5: Run full client typecheck & unit suite and commit**

```bash
pnpm --filter @ashen-pact/client typecheck && pnpm --filter @ashen-pact/client test
git add apps/client/src/art/cutout-rig-math.ts apps/client/src/art/cutout-rig.ts apps/client/src/scenes/game-scene/entity-sync.ts apps/client/src/scenes/game-scene/room-entities-sync.ts apps/client/src/scenes/game-scene/portal-door-sync.ts apps/client/test/perf-rig-and-entity-sync.test.ts
git commit -m "perf(entities): make CutoutRig zero-alloc, guard setDepth sorting, cache projectile specs, and cull offscreen rigs"
```

---

### Task 4: `CombatFxManager`, World Overlay Consolidation, Lighting Surface Cache & Cached Procedural Audio

**Files:**
- Modify: `apps/client/src/fx/combat-fx-pools.ts`
- Modify: `apps/client/src/fx/combat-fx.ts`
- Modify: `apps/client/src/fx/combat-fx-spawners.ts`
- Modify: `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1a-entities.ts`
- Modify: `apps/client/src/fx/combat-fx-blessings-p1d.ts`
- Modify: `apps/client/src/fx/combat-fx-p2b.ts`
- Modify: `apps/client/src/fx/combat-fx-p3a.ts`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Modify: `apps/client/src/fx/lighting-pipeline.ts`
- Modify: `apps/client/src/audio/zzfx.ts`
- Test: `apps/client/test/perf-fx-lighting-audio.test.ts`

**Interfaces:**
- Consumes: `setTextAndColorIfChanged` from `apps/client/src/ui/phaser-text-guard.ts` (Task 1); `setDepthIfChanged`, `setBlendModeIfChanged` from `apps/client/src/scenes/game-scene/entity-sync.ts` (Task 3).
- Produces:
  - O(1) `getActiveParticleCount()` and `getActiveDamagePopupCount()` on `CombatFxManager`
  - Cached procedural fallback `AudioBuffer` map per `AudioContext` in `apps/client/src/audio/zzfx.ts`

- [ ] **Step 1: Write the failing test in `apps/client/test/perf-fx-lighting-audio.test.ts`**

Write Vitest unit tests verifying:
1. `CombatFxManager` pool footprint & flipbook frame guard:
   - Constructing `CombatFxManager(mockScene, 300, 48, 120, 24, 96)` creates **at most 32** casing shadow sprites (instead of 300), while spawning a shell casing (`fx_shell_casing` via `spawnMuzzleFlashAndCasing`) still attaches a visible `shadowSprite` at `depth === 19`.
   - Advancing a 4-frame kit burst particle across 6 small `dt = 0.005s` steps while it remains on subframe `0` calls `sprite.setFrame` only on initial spawn (`0` redundant `setFrame` calls on unchanged frame index), and calls `setFrame` once when advancing to subframe `1`.
   - Idle split-depth `Graphics` layers (`underActorGraphics`, `weaponRibbonGraphics`, `floorFoldGraphics`) are hidden (`visible === false`) when no ribbons/folds/arcs are active and do not call `.clear()` repeatedly while already empty.
2. `telegraphs-and-overlays.ts` & `combat-fx-weapons-p1a-entities.ts`:
   - `renderTelegraphsAndShieldImpl` invokes `transport.getInterpolatedProjectilePos` **at most once per projectile** (collapsing the 3 `withInterpolatedProjectilesAndPlayer` passes into 1) and does NOT call `syncBatch1WeaponRoomEntities` a second time if already synced in `syncRoomEntitiesImpl` (or `syncBatch1WeaponRoomEntities` mutates `state.tetherBeams` in place without allocating `.map()` clones).
   - `drawEnemyHealthAndStatusBarImpl` calls `fillRoundedRect` **0 times** (using Earcut-free `fillRect` bars and status pips).
3. `LightingPipeline.update`:
   - Calling `lighting.update(...)` across 10 consecutive frames with unchanged `map.mapRevision` calls `map.getSurface` only on frame 1 (`0` calls on frames 2–10), and invalidates immediately when `map.mapRevision` increments.
   - `getBiomePostFxFragForTest()` contains `'if (centerLuma > 0.68)'` AND still contains `'smoothstep(0.22, 0.48, centerLuma)'`.
4. `zzfx` procedural fallback caching:
   - When playing the same procedural fallback `SfxId` (when preloaded WAV buffer is absent) 5 times on a mocked `AudioContext`, `ctx.createBuffer` is called **only once** for that `SfxId` (reusing the cached unit-gain `AudioBuffer` on plays 2–5), and `pan === 0` skips `ctx.createStereoPanner()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/perf-fx-lighting-audio.test.ts`
Expected: FAIL on shadow sprite count (300 > 32), repeated `getSurface` calls, and repeated `ctx.createBuffer` calls.

- [ ] **Step 3: Implement FX pool/overlay consolidation, lighting surface cache, and ZzFX procedural buffer cache**

1. In `apps/client/src/fx/combat-fx-pools.ts`, `apps/client/src/fx/combat-fx.ts`, and `apps/client/src/fx/combat-fx-spawners.ts`:
   - Replace the 300 permanent `shadowSprite`s on `particlePool` with a dedicated 32-sprite `casingShadowPool` (`depth: 19`), dynamically binding `p.shadowSprite` when `hasGroundShadow === true` (e.g. `fx_shell_casing`) and releasing/hiding it when the particle expires!
   - Maintain incremental `activeParticleCount` and `activeDamagePopupCount` counters (or compact active index lists) so `getActiveParticleCount()`, `getActiveDamagePopupCount()`, and `update()` skip scanning 300 dead particle slots and 120 dead decal slots on quiet frames.
   - Pre-build a static subframe string cache `getKitSubframeName(prefix, frameIdx)` (`Map<string, readonly [string, string, string, string]>`) and store `lastFrameIndex` on `PooledParticle` so `p.sprite.setFrame(...)` only runs when `targetFrame !== p.lastFrameIndex`.
   - Guard `.setDepth()` and `.setBlendMode()` in `activateParticle` (`setDepthIfChanged`, `setBlendModeIfChanged`).
   - Use `setTextAndColorIfChanged` on damage popups and floating alerts (`combat-fx.ts`, `combat-fx-spawners.ts`) so spawning/merging a popup never triggers double `updateText()` (`setText` + `setColor`).
   - Add fast early-outs (`if (activeNumericCount < 2) return;` / `if (activeAlertCount === 0) return;`) and cached `halfW`/`halfH` on `PooledDamageText` inside `resolveActivePopupOverlaps` and `resolveTacticalAlertSlotOverlaps`.
   - Make `syncTorchPositions` zero-alloc (reusing pooled `{ x, y }` objects and gating on `(props.length, torchSignature)`).
   - Stop clearing unused `lightningGraphics` every frame (keep it hidden) and track `wasNonEmpty` + `.setVisible(hasCommands)` on `underActorGraphics`, `weaponRibbonGraphics`, and `floorFoldGraphics`.
2. In `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`, `apps/client/src/fx/combat-fx-weapons-p1a-entities.ts`, `apps/client/src/fx/combat-fx-blessings-p1d.ts`, `apps/client/src/fx/combat-fx-p2b.ts`, `apps/client/src/fx/combat-fx-p3a.ts`, and `apps/client/src/scenes/game-scene/sim-events.ts`:
   - Merge the 3 `withInterpolatedProjectilesAndPlayer` calls in `renderTelegraphsAndShieldImpl` into a single wrapper pass; pool `scratchAimingSightlines` entries in place (`sightlineCount` + grow-only object array, slicing or sorting only the active prefix); make `syncBatch1WeaponRoomEntities` reuse pooled `tetherBeams` objects in place and skip duplicate execution on the same `(sim.tick, renderFrame)`.
   - In `drawEnemyHealthAndStatusBarImpl`, replace `fillRoundedRect` (`h = 4px`) and status pip `fillCircle`/`strokeCircle` (`r = 2.6px`) with crisp `fillRect` bars + 2-triangle diamond/square pips (zero Earcut!).
   - At the end of `renderTelegraphsAndShieldImpl`, toggle `.setVisible(gfx.commandBuffer.length > 0)` (when `commandBuffer` exists, and guard `.clear()` on the next frame if already empty) across `icePrisonRearGraphics`, `bastionRearGraphics`, `icePrisonFrontGraphics`, `bastionFrontGraphics`, `bossOverGraphics`, `bossFractureGraphics`, `bossOverheadStunGraphics`, `executionerWaveGraphics`, `enemyGroundTelegraphGfx`, `groundHazardGraphics`, and `telegraphGraphics`.
   - In `drawP1DBlessingProjectileOverlay` (`combat-fx-blessings-p1d.ts:192`), check `if (b.team !== 'player') return;` and check whether `b` actually has any P1D visual flag BEFORE calling `isVisualFreezeActive` or `Math.atan2`/`cos`/`sin`; replace `enemies.filter(...)` at line `350` with a reusable module-level scratch array.
   - Reuse a module-level `Set<number>` in `combat-fx-p2b.ts:416`; guard `plate.setDepth(30.8)` with `setDepthIfChanged` in `combat-fx-p3a.ts:49`; pre-scan `events` once in `sim-events.ts:processSimEventsImpl` into scratch flags/maps to eliminate nested `events.some(...)` and repeated `sim.enemies.find(...)` scans.
3. In `apps/client/src/fx/lighting-pipeline.ts`:
   - Cache glowing surface light entries (`{ wx, wy, radius, colorNum, intensity }`) keyed by `(map, map.mapRevision)` so `LightingPipeline.update` never scans 680 tiles via `map.getSurface` on unchanged `mapRevision`.
   - Hoist `hexToNum(...)` color lookups to module-level constants, guard empty `blizzardRimGraphics.clear()`, and update `BIOME_POSTFX_FRAG` line `78` from `if (centerLuma > 0.58)` to `if (centerLuma > 0.68)` (preserving `smoothstep(0.22, 0.48, centerLuma)` verbatim!).
4. In `apps/client/src/audio/zzfx.ts`:
   - Cache unit-gain (`gainScale = 1.0`) procedural fallback `AudioBuffer`s in a `WeakMap<AudioContext, Map<SfxId, AudioBuffer>>`, passing spatial `gainScale` into `connectSpatialChain(gainScale, pan)` and applying ±3% pitch variation via `source.playbackRate.value`.
   - Skip `createStereoPanner()` when `Math.abs(pan) < 0.01`, use O(1) swap-pop when removing finished entries from `activeVoices`, and call `.disconnect()` on `source`, `gainNode`, and `panner` inside `source.onended`.

- [ ] **Step 4: Run focused and existing VFX/lighting/audio tests to verify GREEN**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/perf-fx-lighting-audio.test.ts test/topdown-shader-vfx-spawners.test.ts test/topdown-shader-vfx-baker.test.ts test/tapered-ribbon-builder.test.ts test/ap2-p1a-weapons-vfx-audio.test.ts test/ap2-p1b-weapons-fx.test.ts test/ap2-p1d-blessing-ui-fx.test.ts test/polish-p3-lighting-camera.test.ts test/authentic-sfx-overhaul.test.ts`
Expected: PASS with 0 errors.

- [ ] **Step 5: Run full client typecheck & unit suite and commit**

```bash
pnpm --filter @ashen-pact/client typecheck && pnpm --filter @ashen-pact/client test
git add apps/client/src/fx/combat-fx-pools.ts apps/client/src/fx/combat-fx.ts apps/client/src/fx/combat-fx-spawners.ts apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts apps/client/src/fx/combat-fx-weapons-p1a-entities.ts apps/client/src/fx/combat-fx-blessings-p1d.ts apps/client/src/fx/combat-fx-p2b.ts apps/client/src/fx/combat-fx-p3a.ts apps/client/src/scenes/game-scene/sim-events.ts apps/client/src/fx/lighting-pipeline.ts apps/client/src/audio/zzfx.ts apps/client/test/perf-fx-lighting-audio.test.ts
git commit -m "perf(fx,lighting,audio): trim shadow pool, consolidate overlay passes, cache hazard lights, and cache fallback SFX buffers"
```

---

### Task 5: Shared Runtime Sprite Atlas for `CutoutRig` Parts, Weapons & Props (WebGL Draw-Call Batching)

**Files:**
- Modify: `apps/client/src/art/texture-baker-canvas.ts`
- Modify: `apps/client/src/art/texture-baker.ts`
- Modify: `apps/client/src/art/texture-baker-fx.ts`
- Modify: `apps/client/src/art/cutout-rig.ts`
- Modify: `apps/client/src/scenes/game-scene/entity-sync.ts`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts`
- Test: `apps/client/test/perf-runtime-rig-atlas.test.ts`

**Interfaces:**
- Consumes: `CutoutRig` from Task 3; `entity-sync.ts` from Task 3; `arena-tiles.ts` from Task 2.
- Produces:
  - `RIG_PROP_ATLAS_PREFIX = 'atlas_rig_prop_'` in `apps/client/src/art/texture-baker.ts`
  - `TextureBaker.resolveAtlasBinding(scene: Phaser.Scene | undefined, logicalKey: string): { textureKey: string; frameName?: string }` in `apps/client/src/art/texture-baker.ts`

- [ ] **Step 1: Write the failing test in `apps/client/test/perf-runtime-rig-atlas.test.ts`**

Write Vitest unit tests verifying:
1. After `TextureBaker.bakeAll(mockScene, 1.5, true)` (`bakeScale = 3`):
   - Hero and enemy rig part keys (`TextureBaker.getPartTextureKey('vanguard', 'torso')`, `TextureBaker.getPartTextureKey('goblin_shooter', 'head')`), weapon keys (`TextureBaker.getWeaponTextureKey('knight_sword')`), shadow/ring keys (`rig_shadow_medium`, `rig_ring_1`), and prop keys (`TextureBaker.getPropTextureKey('wooden_crate')`) all resolve via `TextureBaker.resolveAtlasBinding(mockScene, key)` to a shared POT `atlas_rig_prop_*` (`<= 2048×2048`) texture with `frameName === key`, AND all share at most **3** backing `atlas_rig_prop_*` textures total (down from 180+ separate textures!).
   - Individual legacy keys (`scene.textures.exists(key)`) still remain valid if queried directly OR `TextureBaker.getPartTextureKey` / `getWeaponTextureKey` / `getPropTextureKey` still return their exact string names (`art.test.ts` & `topdown-shader-vfx-baker.test.ts` compatibility — check whether any test calls `scene.textures.exists('rig_vanguard_torso')` or `scene.textures.exists('prop_wooden_crate')` before removing standalone canvases; if a test checks `textures.exists`, only register standalone textures that don't duplicate GPU binds when sprites bind `atlas_rig_prop_*`, OR check `computeTotalVramBytes`!).
   - `computeTotalVramBytes(mockScene)` at DPR `1.5` remains strictly within `[14_700_000, 24_950_000]` bytes (`isPreExistingNonVfxWorldOrRigTextureKey` excludes `atlas_rig_prop_`).
2. `CutoutRig` constructed on a scene with baked `atlas_rig_prop_*` binds its part sprites, weapon sprite, shadow sprite, and player ring sprite to `(atlasKey, frameName)` sharing the same `atlas_rig_prop_*` texture key, and falls back cleanly to `(logicalKey)` when `atlas_rig_prop_*` is absent on minimal mock scenes.
3. `bakeCustomCanvas` in `apps/client/src/art/texture-baker-canvas.ts` calls `canvas.getContext('2d')` without `{ willReadFrequently: true }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/perf-runtime-rig-atlas.test.ts`
Expected: FAIL (`TextureBaker.resolveAtlasBinding` is not a function).

- [ ] **Step 3: Implement shelf-packed `atlas_rig_prop_*` runtime atlasing and sprite binding**

1. In `apps/client/src/art/texture-baker-canvas.ts`:
   - Change `canvas.getContext('2d', { willReadFrequently: true })` (`line 14`) to `canvas.getContext('2d')` so browsers use hardware-accelerated Canvas2D rasterization during startup/resize baking.
2. In `apps/client/src/art/texture-baker-fx.ts`:
   - Add `key.startsWith('atlas_rig_prop_')` to `isPreExistingNonVfxWorldOrRigTextureKey(key)` so the non-VFX rig/prop atlas is classified identically to `rig_*`, `weapon_vec_*`, and `prop_*` in `computeTotalVramBytes`.
3. In `apps/client/src/art/texture-baker.ts`:
   - Add a deterministic shelf packer (`2048×2048` POT pages `atlas_rig_prop_0`, `atlas_rig_prop_1`, ..., with `2px` transparent gutter around each sprite so bilinear filtering never bleeds across frames!) that packs all rendered offscreen canvases for `rig_*` (parts, composite fast sprites, shadows, player rings), `weapon_vec_*`, and `prop_*` (`prop_shadow` + all props).
   - Register each packed rectangle as a named frame `atlasTex.add(logicalKey, 0, x, y, w, h)` on its `atlas_rig_prop_<page>` `CanvasTexture` and record `logicalKey -> { textureKey, frameName: logicalKey }` in a per-`TextureManager` `WeakMap` (rebuilt whenever `bakeAll` runs at a new `bakeScale` or `force === true`, removing stale `atlas_rig_prop_*` pages first).
   - Check if any existing test calls `scene.textures.exists('rig_...')` / `scene.textures.get('prop_...')` / `drawSourceKeyToCtx`: if any test or HUD icon (`weaponIconSprites` in `arena-tiles.ts:1802`, `hud-combat-and-coop.ts`, `hud-hub-and-cards.ts`) uses `weapon_vec_*` or `prop_*` or `rig_*` directly via `scene.textures.exists`, check every call site (`grep -rn "getWeaponTextureKey\|getPropTextureKey\|getPartTextureKey\|rig_shadow\|rig_ring"` in `apps/client/src` and `apps/client/test` and `tests/e2e`) and bind via `TextureBaker.resolveAtlasBinding(scene, key)` (or keep standalone keys ONLY if needed by a test, while `CutoutRig` + `propVisuals` + `weaponIconSprites` bind `atlas_rig_prop_*`!). Better yet: check every call site so we don't even need duplicate standalone WebGL textures unless a test explicitly asserts `scene.textures.exists(...)`!
4. In `apps/client/src/art/cutout-rig.ts`, `apps/client/src/scenes/game-scene/entity-sync.ts` (`syncPropsImpl`), and `apps/client/src/scenes/game-scene/arena-tiles.ts` (`applyCameraViewportImpl` prop/weapon refresh):
   - Use `TextureBaker.resolveAtlasBinding(scene, key)` whenever creating or refreshing `Sprite`/`Image` textures (`sprite.setTexture(binding.textureKey, binding.frameName)` when `binding.frameName` is defined, else `sprite.setTexture(binding.textureKey)`).

- [ ] **Step 4: Run focused and existing art/baker/rig tests to verify GREEN**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/perf-runtime-rig-atlas.test.ts test/art.test.ts test/topdown-shader-vfx-baker.test.ts test/polish-p10a-cutout-rig.test.ts test/ap2-p1c-props-fx.test.ts`
Expected: PASS with 0 errors and `computeTotalVramBytes` strictly within `[14.7 MB, 24.95 MB]`.

- [ ] **Step 5: Run full client typecheck & unit suite and commit**

```bash
pnpm --filter @ashen-pact/client typecheck && pnpm --filter @ashen-pact/client test
git add apps/client/src/art/texture-baker-canvas.ts apps/client/src/art/texture-baker.ts apps/client/src/art/texture-baker-fx.ts apps/client/src/art/cutout-rig.ts apps/client/src/scenes/game-scene/entity-sync.ts apps/client/src/scenes/game-scene/arena-tiles.ts apps/client/test/perf-runtime-rig-atlas.test.ts
git commit -m "perf(art): pack CutoutRig parts, weapons, and props into shared 2048x2048 runtime WebGL atlases"
```

---

### Task 6: 100%-Deterministic `WorldSim`, `SpatialHashGrid`, Navigation/Collision & P2P Wire Codec Optimization

**Files:**
- Modify: `packages/shared/src/math/spatial-hash.ts`
- Modify: `packages/shared/src/sim/arena-map.ts`
- Modify: `packages/shared/src/sim/arena-room-archetypes.ts`
- Modify: `packages/shared/src/sim/sim-enemies-core.ts`
- Modify: `packages/shared/src/sim/world-sim.ts`
- Modify: `packages/shared/src/sim/sim-projectiles.ts`
- Modify: `packages/shared/src/sim/sim-tactical-physics.ts`
- Modify: `packages/shared/src/sim/sim-blessings-p4a.ts`
- Modify: `packages/shared/src/sim/sim-blessings.ts`
- Modify: `packages/shared/src/sim/sim-ashen-pacts.ts`
- Modify: `packages/shared/src/sim/sim-ashen-pacts-combat.ts`
- Modify: `packages/shared/src/sim/sim-blessings-p4a-group34.ts`
- Modify: `packages/shared/src/sim/sim-progression-bot.ts`
- Modify: `packages/shared/src/sim/sim-weapon-cadence.ts`
- Modify: `packages/shared/src/sim/sim-weapon-specials-p1b-legendary.ts`
- Modify: `packages/shared/src/sim/sim-duo-boons.ts`
- Modify: `packages/shared/src/protocol/coop-room-authority.ts`
- Modify: `apps/client/src/net/p2p-wire-codec.ts`
- Test: `packages/shared/test/perf-sim-determinism-and-spatial.test.ts`

**Interfaces:**
- Consumes: Existing `@ashen-pact/shared` types and `P2PSnapshotEncoder` in `apps/client/src/net/p2p-wire-codec.ts`.
- Produces:
  - Unlimited-ID zero-`Set` `SpatialHashGrid<T>` deduplication in `packages/shared/src/math/spatial-hash.ts`
  - Precomputed contiguous wall/chasm span tables and `activeDynamicSurfaceCount` early-exit on `ArenaMap` in `packages/shared/src/sim/arena-map.ts`
  - Active `bulletSpatialGrid` + `playerProjectileCount` / `enemyProjectileCount` on `WorldSim`
  - Revision-gated baseline fingerprinting in `P2PSnapshotEncoder` (`apps/client/src/net/p2p-wire-codec.ts`)

- [ ] **Step 1: Write the failing test in `packages/shared/test/perf-sim-determinism-and-spatial.test.ts`**

Write Vitest unit tests verifying:
1. `SpatialHashGrid` high-ID zero-`Set` deduplication: inserting entities with bit-packed projectile IDs (`id = (500 << 6) | 3 = 32003`) and puzzle IDs (`id = 90005`) spanning 4 cells and calling `queryCircle` 50 times returns each entity exactly once **without ever calling `Set.prototype.add`** (`vi.spyOn(Set.prototype, 'add')` count === `0`), and does NOT add enumerable properties to the queried objects (`Object.keys(entity)` unchanged!).
2. `ArenaMap.resolveCircleCollision` span-table equivalence: across all room shapes (`rectangle`, `l_shape`, `donut_ring`, `island_catwalk`) with pillars, chasms, and broken cracked walls (`mapRevision` incremented), `resolveCircleCollision` produces **bit-identical `(x, y)` floats** across 1,000 random circle positions/radii before vs after wall breaks, and `ArenaMap.stepSurfaces(1/60)` returns immediately in O(1) when zero dynamic timed/burning surfaces are active while still ticking and burning out `burning_oil` / `electrified_water` identically when active.
3. `WorldSim` `bulletSpatialGrid` & `teamCap` correctness:
   - With 220 enemy bullets and 40 player bullets (`total = 260 >= MAX_PLAYER_PROJECTILES`), spawning a 12-pellet player shotgun volley does NOT evict any bullets and increments `playerProjectileCount` to `52` and `enemyProjectileCount` to `220`.
   - Phase Blade (`clearEnemyBulletsAlongPhaseBlade`) and flipped barricade micro-blank (`clearEnemyProjectilesAroundProp`) clear the exact enemy bullets within radius using `bulletSpatialGrid` without mutating `sim.queryEnemyScratch`.
4. Locked-seed 600-tick combat determinism: two `WorldSim` instances with seed `0x51a71c` stepping 600 ticks of 4-player bot autoplay + combat + elemental reactions + blessings produce identical final `tick`, player `(x, y, hp, armor)`, enemy `(id, x, y, hp)`, and projectile `(id, x, y)` state.
5. `P2PSnapshotEncoder`: encoding 30 consecutive 30Hz combat snapshots where enemies move and props tick `hitFlashTimer`/`ttlSec` (while room, player builds, enemy roster IDs, prop roster IDs, chests, and worldItems do not structurally change) does NOT call `JSON.stringify` 30 times if static roster/build signature is unchanged OR strips volatile prop fields (`hitFlashTimer`, `fuseTimer`, `ttlSec`, `prismPulseCooldownSec`) from baseline fingerprinting so `baseline` is NOT re-transmitted on every prop timer tick! (Verify `P2PSnapshotDecoder` still decodes dynamic prop `hp`, `x`, `y`, `state`, `coverState` accurately — keep any field not carried in `P2PSnapshotFastFrame` accurate in baseline, and skip `extractBaseline` + `JSON.stringify` when a fast numeric/primitive structural signature of baseline-only fields hasn't changed!).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/shared exec vitest run test/perf-sim-determinism-and-spatial.test.ts`
Expected: FAIL (`Set.prototype.add` called for `id >= 16384`, `playerProjectileCount` undefined, etc.).

- [ ] **Step 3: Implement `SpatialHashGrid` non-enumerable stamp, `ArenaMap` span tables & surface counter, `WorldSim` spatial/GC optimizations, and P2P baseline fingerprint fast-path**

1. In `packages/shared/src/math/spatial-hash.ts`:
   - Stamp queried multi-cell items using a WeakMap or a non-enumerable symbol/property (`const GRID_STAMP = Symbol('gridStamp')`! A `Symbol` property on JS objects is **100% invisible** to `JSON.stringify`, `Object.keys`, `for..in`, `{ ...obj }` spread comparison in `toEqual`? Wait: Vitest `expect(a).toEqual(b)` checks `Reflect.ownKeys` / symbols in some matchers — test `expect({ id: 1, [ sym ]: 2 }).toEqual({ id: 1 })` or even simpler: store dense insertion index `idx` in a parallel `cellItemIndices: number[][]` array alongside `itemsRef: T[]` during `insert`, and index `this.seenBySlot: Int32Array` by dense insertion slot `0..count-1`!!).
   - **YES!! Dense insertion slot indexing (`items: T[]` + `seenBySlot: Int32Array` grown lazily if `items.length > seenBySlot.length`)**:
     - Mutates **ZERO** properties on `T` (not even a Symbol!), works for **ANY** `id` (`-Infinity..+Infinity`), uses **ZERO** `Set` allocations, and is pure contiguous `Int32Array` L1-cache speed! Implement dense insertion slot indexing in `SpatialHashGrid`!
2. In `packages/shared/src/sim/arena-map.ts`:
   - Precompute 8 `Uint8Array` span tables (`solidLeft`, `solidRight`, `solidTop`, `solidBottom` for `includeChasm = false` and `chasmLeft`, `chasmRight`, `chasmTop`, `chasmBottom` for `includeChasm = true`) lazily rebuilt whenever `this.spanCacheRevision !== this.mapRevision`. Replace the 4 `while` loops in `resolveCircleCollision` (`lines 1082-1104`) with O(1) array lookups producing the **exact same** `leftTile`, `rightTile`, `topTile`, `bottomTile` integers!
   - Maintain `activeDynamicSurfaceCount` on `ArenaMap` (recounted on room init/reset and updated in `setSurface` / `stepSurfaces` whenever a tile transitions into or out of `surfaceTimers[i] > 0 || s === 'burning_oil' || s === 'burning_grass' || s === 'electrified_water'`) so `stepSurfaces` returns immediately in O(1) when `activeDynamicSurfaceCount === 0`.
3. In `packages/shared/src/sim/arena-room-archetypes.ts` and `packages/shared/src/sim/sim-enemies-core.ts`:
   - Pre-filter stationary movement-blocking props once at the start of `updateEnemiesImpl` into `this.blockingPropsScratch` and pass as an optional parameter to `hasClearWalkableCorridor`, `findNextWalkableWaypoint`, and `isPointBlockedByStationaryProp` (defaulting to `sim.props` if omitted).
   - Hoist `allocStamp` and `runBfs` out of `findNextWalkableWaypoint`, cache `bfsPropBlockedStampScratch` per `(sim.tick, map.mapRevision, padExtra)` so multiple obstructed enemies in the same tick reuse the rasterized prop mask, and add optional `out?: { x: number; y: number }` to `findNextWalkableWaypoint` (allocating `{ x, y }` when `out` is omitted).
4. In `packages/shared/src/sim/world-sim.ts`, `sim-projectiles.ts`, `sim-tactical-physics.ts`, `sim-blessings-p4a.ts`, `sim-blessings.ts`, `sim-ashen-pacts.ts`, `sim-ashen-pacts-combat.ts`, `sim-blessings-p4a-group34.ts`, `sim-progression-bot.ts`, `sim-weapon-cadence.ts`, `sim-weapon-specials-p1b-legendary.ts`, and `sim-duo-boons.ts`:
   - Add `queryBulletScratch: SimProjectileState[] = []` and `superconductEnemyScratch: SimEnemyState[] = []` on `WorldSim` (**never aliasing `queryEnemyScratch`!**).
   - Populate `this.bulletSpatialGrid` with active enemy bullets (`b.team === 'enemy' && b.ttlSec > 0`) at the start of `updateProjectilesImpl` and before `updateProps` (or rebuild when needed), and use `bulletSpatialGrid.queryCircle(..., this.queryBulletScratch)` in `clearEnemyBulletsAlongPhaseBlade` and `clearEnemyProjectilesAroundProp` (replacing `splice` inside the prop micro-blank loop with setting `b.ttlSec = 0` or compacting cleanly — verify exact event emission!).
   - Track `playerProjectileCount` and `enemyProjectileCount` (or count only when `this.projectiles.length >= teamCap` with a fast maintained counter) so `sim-projectiles.ts:217` only scans to evict when that specific team actually reached `teamCap`!
   - Track `hasActiveSuperconductEnemy` on `WorldSim` during `updateEnemiesImpl` so `tryRedirectSuperconductRailServer` / `tryHoldSuperconductRailClient` (`sim-duo-boons.ts:578-627`) returns in O(1) when false, and queries `enemySpatialGrid.queryCircle(b.x, b.y, 100, sim.superconductEnemyScratch)` when true.
   - Replace per-tick allocations:
     - `sim-progression-bot.ts:426`: replace `new Set<number>()` wave count check with 2 primitive ints.
     - `sim-blessings-p4a-group34.ts:462`: early-exit unless `>= 2` `wall_tether_pylon` summons exist, reusing scratch arrays.
     - `sim-ashen-pacts-combat.ts:145, 227`: replace `.filter(...)` with `for` loops.
     - `sim-blessings.ts:91, 313, 395` & `sim-ashen-pacts.ts:363`: replace `new Set(sim.projectiles.map(p => p.id))` with `const prevLastId = sim.projectiles.length > 0 ? sim.projectiles[sim.projectiles.length - 1]!.id : -1;` / matching `(proj.id >>> 6) === ((volleyEv.eventId ?? 1) & 0x3fffff)` walking backward from `sim.projectiles.length - 1`!
     - `sim-weapon-cadence.ts:127-130`: gate `checkAndTriggerFragLauncherAirburst` and `checkAndTriggerVoidStaffImplosion` on player weapon slots or active grenade/void-orb presence.
     - `sim-weapon-specials-p1b-legendary.ts:67-90`: add optional `out` scratch array to `getSolarMiniSunPositions` for internal hot paths and clear `p.solarOrbHitTickByEnemy` on room transition (`enterRoom` / `enterHub`).
5. In `apps/client/src/net/p2p-wire-codec.ts` and `packages/shared/src/protocol/coop-room-authority.ts`:
   - Check which `SimPropState` fields `P2PSnapshotFastFrame` already transmits (`p2p-wire-codec.ts`): compute a fast 32-bit rolling hash (`computeBaselineFastHash(snap)`) over all baseline-relevant fields BEFORE calling `extractBaseline(snap)` + `JSON.stringify(baselineData)`, AND omit purely cosmetic client-unused timer jitter from triggering false baseline rebuilds if already carried in fast frame (verify against `test/p2p-wire-codec.test.ts` and `test/p2p-coop-client.test.ts`!). When `fastHash === this.lastBaselineFastHash && this.lastBaseline !== null`, skip both `extractBaseline(snap)` AND `JSON.stringify(baselineData)` completely!
   - In `CoopRoomAuthority.step` (`coop-room-authority.ts:136`), only call `this.emitStateChange()` when `inHub`, `playerCount`, `seed`, or `hostName` changed, OR every 15 ticks (`this.sim.tick % 15 === 0`), avoiding 60Hz lobby summary object allocations.

- [ ] **Step 4: Run focused and existing shared, P2P, and server tests to verify GREEN**

Run: `pnpm --filter @ashen-pact/shared exec vitest run test/perf-sim-determinism-and-spatial.test.ts test/phase2-sim.test.ts test/ap2-p0a-deterministic-projectiles.test.ts test/round4-navigation-terrain-barricades.test.ts test/p2p-netcode-smoothing.test.ts test/phase4-coop.test.ts test/coop-room-authority.test.ts test/ap2-p5-holistic-soak-balance.test.ts && pnpm --filter @ashen-pact/client exec vitest run test/p2p-wire-codec.test.ts test/p2p-coop-client.test.ts && pnpm --filter @ashen-pact/server test`
Expected: PASS across all listed shared, P2P client, and server test suites with 0 errors.

- [ ] **Step 5: Run workspace typecheck & lint and commit**

```bash
pnpm typecheck && pnpm lint
git add packages/shared/src/ apps/client/src/net/p2p-wire-codec.ts packages/shared/test/perf-sim-determinism-and-spatial.test.ts
git commit -m "perf(sim,p2p): optimize SpatialHashGrid, ArenaMap wall spans, bullet spatial queries, and P2P baseline hashing"
```
