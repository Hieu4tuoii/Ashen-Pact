# Ashen Pact — Post-VFX-Overhaul Frame-Time, WebGL Batching & Zero-GC Performance Optimization Spec

**Date:** 2026-11-20  
**Status:** Approved (Autonomous Execution)  
**Target Branch:** `perf/vfx-and-sim-optimization` → `main`

---

## 1. Problem Statement & Empirical Baseline

Following the Cutout 2.0 VFX & Ice-Mirror overhaul (`6859ca6..494d795`), players experience noticeable frame-time stutter, periodic GC pauses, and sustained FPS drops in both the Sanctuary Hub and active/boss/4P co-op combat.

Live Chromium + WebGL instrumentation (`1920×1080`, `quality: 'high'`, dynamic lighting enabled) measured the following baseline bottlenecks:

| Metric | Sanctuary Hub | Active Combat (15E + VFX) | Boss Combat | Stress (4P + 80E + 600B) |
|---|---|---|---|---|
| `gl.bufferSubData` per frame | **2,580.0 KB/frame** | **1,243.8 KB/frame** | **863.1 KB/frame** | **818.2 KB/frame** |
| `MultiPipeline.flush` / frame | **33.0** | **34.0** | **27.9** | **41.4** |
| `gl.bindTexture` / frame | **118.0** | **218.1** | **101.7** | **98.4** |
| `gl.texImage2D` / frame | `0.0` | **1.67 / frame** | **1.54 / frame** | `0.20 / frame` |
| `GameScene.depthSort` / frame | `1.0` | **1.0 (1,224 objs)** | **1.0 (1,195 objs)** | **1.0 (2,891 objs)** |
| `syncArenaTiles` max spike | `0.1 ms` | **4,095.9 ms** | `0.1 ms` | `0.1 ms` |
| JS Heap growth / frame | `-` | `-` | **+40.3 KB/frame** | **+91.7 KB/frame** |

### Verified Root Causes
1. **Unchecked `Phaser.GameObjects.Text.setColor()` & Coupled HUD Hashes (`gl.texImage2D` Storm)**:
   - Phaser 3's `Text.setColor()` has **no equality check** and unconditionally calls `updateText()`, rasterizing a 2D `<canvas>` and uploading via `gl.texImage2D`. `updateP11RemainingEnemiesHud` (`p11-drama-hud.ts:418-419`), `weaponHash` coupled to `cadenceStateHash` (`hud-combat-and-coop.ts:438, 493-530`), `pactRelicHudText`, `bossHintText`, `SecretArenaHud`, `secret_challenge_crystal`, and damage popups (`setText` followed by `setColor`) trigger **60–120+ `gl.texImage2D` uploads/sec** during combat.
2. **Static & Per-Frame `Phaser.GameObjects.Graphics` CPU Earcut Triangulation + Full-Arena `texImage2D` Uploads**:
   - `Phaser.GameObjects.Graphics` has no persistent GPU VBO; every visible `Graphics` re-triangulates all commands on CPU and streams vertices via `gl.bufferSubData` every frame.
   - `SanctuaryVisualLayer.floorGraphics` (`depth: 6`) holds **7,274 static commands** (`2.58 MB/frame` in Hub).
   - `BiomeArchitectureLiveLayer.voidMaskGraphics` (`depth: 36.2`) holds **1,443 static commands**, while `additiveGraphics` (`depth: 35.5`) and `gearGraphics` (`depth: 14`) invoke 80–180 `fillCircle` Earcut triangulations/frame for `1–3px` motes.
   - `syncArenaTilesWithMapRevisionImpl` (`arena-tiles.ts:1551-1560`) re-runs full-room `renderGroundPass` and calls `arenaGroundTex.refresh()` (uploading the full 16–22 MB arena canvas via `gl.texImage2D`) whenever a single tile surface ignites, freezes, or burns out.
   - 22 split-depth world `Graphics` layers remain `visible: true` and are unconditionally `.clear()`ed every frame, while `drawEnemyHealthAndStatusBarImpl` runs `2× fillRoundedRect` + `fillCircle` Earcut per hurt enemy every frame.
3. **Per-Frame `DisplayList.depthSort()` & 100+ Standalone `CanvasTexture`s**:
   - Phaser's `setDepth(d)` sets `sortChildrenFlag = true` even when `depth === d`, forcing TimSort over 1,200–2,891 objects every frame.
   - `CombatFxManager` keeps 300 unused `shadowSprite`s permanently in `GameScene.children` when only `fx_shell_casing` needs shadows.
   - Every `CutoutRig` part (`rig_*`), `weapon_vec_*`, and `prop_*` is baked as a separate `WebGLTexture`, exhausting `MultiPipeline` texture units across articulated enemies and players.
4. **Per-Frame V8 Heap Churn (`CutoutRig`, Projectiles, Overlays, Lighting, Audio)**:
   - `evaluateRigPose` allocates `new Map()` + closures + ~25–40 objects per rig per frame, including offscreen enemies.
   - `syncProjectilesAndPickups` allocates 2 objects per bullet per frame (`resolveProjectileRenderSpec`).
   - `telegraphs-and-overlays.ts` runs `withInterpolatedProjectilesAndPlayer` 3×/frame, `syncBatch1WeaponRoomEntities` 2×/frame (cloning `tetherBeams`), and `drawWorldWeaponSalvageRing` 2×/frame.
   - `LightingPipeline.update` scans ~680 tiles via `map.getSurface` every frame; `zzfx.ts` procedural fallback synthesizes uncached `AudioBuffer`s on the main thread.
5. **`WorldSim` Collision/Navigation/Spatial & P2P Wire Codec Overhead**:
   - `ArenaMap.resolveCircleCollision` dynamically merges wall spans with 4 inner `while` loops per solid tile on thousands of calls/tick; `ArenaMap.stepSurfaces` scans all interior tiles even when no dynamic surfaces exist.
   - `SpatialHashGrid` falls back to `Set` when `id >= 16384` (exceeded after 256 bullet volleys); `bulletSpatialGrid` is unpopulated while 10+ mechanics linearly scan `sim.projectiles` and `teamCap` checks `this.projectiles.length >= 240`.
   - `P2PSnapshotEncoder.encode` runs `extractBaseline` + `JSON.stringify` at 30Hz per peer and includes volatile prop state in the baseline.

---

## 2. Non-Negotiable Preservation Invariants (Zero Feature / Visual / Test Regression)

1. **100% Gameplay & Simulation Determinism**:
   - `WorldSim` PRNG (`this.rng` and `this.volleyRng`) call counts and order, projectile bit-packed IDs (`((eventId & 0x3fffff) << 6) | (i & 0x3f)`), `MAX_PLAYER_PROJECTILES = 240` / `MAX_ENEMY_PROJECTILES = 300` FIFO eviction, and BFS `CARDINAL_DIRS` tie-breaking MUST produce bit-identical simulation results across all locked-seed balance and soak tests.
   - Nested spatial queries MUST NEVER alias `sim.queryEnemyScratch` while an outer loop iterates `sim.queryEnemyScratch`.
2. **100% Cutout 2.0 Visual & Texture Contract Fidelity**:
   - `fx_cutout_kit_512` (`512×512`, 51 named frames + `_${0..3}` subframes), all 24 `SHADER_FX_TEXTURE_KEYS`, all `BAKED_FX_TEXTURE_KEYS`, and all 6 `ELEMENTAL_REACTION_STRIP_KEYS` MUST remain intact in `scene.textures`.
   - `computeTotalVramBytes(scene)` at DPR `1.5` (`bakeScale = 3`) MUST remain strictly within `[14_700_000, 24_950_000]` bytes (`topdown-shader-vfx-baker.test.ts`). Any new shared atlas for non-VFX rigs/weapons/props MUST use prefix `atlas_rig_prop_` and be excluded by `isPreExistingNonVfxWorldOrRigTextureKey`.
   - `BIOME_POSTFX_FRAG` MUST retain `smoothstep(0.22, 0.48, centerLuma)` and `POSTFX_DEFAULTS.bloomStrength === 0.14`.
   - Enemy bullets keep `depth = 60` (`NORMAL`) + `glowSprite` at `depth = 59` (`ADD`); player bolts keep `depth = 41` (`NORMAL`); `fx_shell_casing` keeps visible `shadowSprite` at `depth = 19`.
3. **100% Backwards-Compatible Public Signatures & Test Hooks**:
   - Pure math exports (`evaluateRigPose`, `blendRigPoseSnapshots`, `stepBackAccessorySpring`, `stepWeaponRecoilSpring`, `stepMeleeLungeGlideOffset`, `findNextWalkableWaypoint`) MUST allocate fresh return objects when optional `out` is omitted so unit tests comparing two return values remain isolated.
   - `tapered-ribbon-builder.ts` triangle counts for explicit `segments` arguments MUST NOT change (`tapered-ribbon-builder.test.ts`).
   - Do NOT alter primitive calls inside `drawEnemyEmbeddedArrows`, `drawEnemyParasiticThorns`, `drawSeedGunLifeBlossom`, or `drawVoidStaffBlackHole` where mock call-count tests assert exact `fillCircle`/`strokeCircle`/`strokePath` counts.
   - `window.__GAME_DEBUG__`, `window.__P11_REMAINING_HUD_TEXT__`, `window.__LAST_P11_WAVE_BANNER__`, `gs.playerRig`, `gs.enemyRigs`, `gs.projectileSprites`, and `gs.fx.damagePool` MUST continue updating accurately even when F3 debug overlay is hidden.

---

## 3. Architecture of the 6 Optimization Subsystems

### Subsystem 1: `Phaser.Text` Upload Guard, HUD Hash Decoupling & O(1) Debug State
- Introduce `apps/client/src/ui/phaser-text-guard.ts` with `setTextIfChanged(txt, next)`, `setColorIfChanged(txt, nextColor)`, and `setTextAndColorIfChanged(txt, nextText, nextColor)` (mutating `txt.style.color` prior to `txt.setText` when both text and color change so `updateText()` runs once instead of twice, and guarding `txt.style.color !== nextColor` when text is unchanged).
- Cache `lastRemainingHudSig` in `p11-drama-hud.ts`; strip `cadenceStateHash` from `weaponHash` in `hud-combat-and-coop.ts` (since `cardMetaText` and slot backgrounds depend only on weapon definitions, active slot, keybind labels, and locale); guard `setColor` across `hud-ashen-pact-modal.ts`, `hud-combat-and-coop.ts`, `secret-arena-hud.ts`, and `hud-qol-and-minimap.ts`.
- Replace string-concatenated `roomsTopologySig` in `hud-qol-and-minimap.ts` with a 32-bit FNV-1a integer hash + cached keybindings revision.
- In `hud-modals-and-debug.ts`, cache `mvpAwardsCount` during `'playing'` (recomputing immediately on `'victory'`/`'defeat'` or at most every 15 ticks when kill/damage stats change) and read O(1) FX counters.

### Subsystem 2: Static World Layer Rasterization, Dirty-Rect `texSubImage2D` & Earcut-Free Live Architecture
- **`SanctuaryVisualLayer`**: Render `drawStaticFloor` into `floorGraphics`, bake once per `(mapW, mapH, locale)` via `generateTexture` / `CanvasTexture` onto a static `Phaser.GameObjects.Image` at `depth: 6`, then `.clear()` and hide `floorGraphics` (eliminating `7,274` per-frame `Graphics` commands in Hub; gracefully fall back to `floorGraphics` in unit tests without WebGL/Canvas textures). Guard `setDepth` on Hub sprites.
- **`BiomeArchitectureLiveLayer`**:
  - Bake `voidMask` once per `voidMaskSig` onto a static `CanvasTexture` + `Image` at `depth: 36.2` (with row-merged `fillRect` spans as fallback when `textures.createCanvas` is absent in unit tests), eliminating `1,443` per-frame `Graphics` commands.
  - Replace tiny `r <= 3.0px` `fillCircle` calls for brazier embers, warm dust motes, and hazard glints/bubbles in `additiveGraphics` & `gearGraphics` with crisp `fillRect` / 2-triangle diamond primitives (zero Earcut calls).
  - Cache `getVisibleFloorDecals` per `(plan, map.mapRevision)` in `biome-architecture.ts`.
- **Incremental `arenaGroundTex` Updates (`arena-tiles.ts`)**:
  - When `scratchDirtyTiles.length <= 64` (e.g. elemental surface ignition/spread/burnout or cracked wall break), compute the dirty tile bounding box expanded by 1 tile (plus any overlapping pillar shadow bounds), re-render tiles in that dirty region, clip `renderGroundPass` strictly to that pixel rectangle (`ctx.save(); ctx.beginPath(); ctx.rect(...); ctx.clip();`), and upload **only** that dirty sub-rectangle via WebGL `gl.texSubImage2D` (falling back to `arenaGroundTex.refresh()` on Canvas renderer or full rebuilds).

### Subsystem 3: Zero-Alloc `CutoutRig`, DisplayList `setDepth` Guard, Frustum Culling & Projectile Spec Cache
- Pre-index `EntityRigDef.parts` in a `WeakMap<EntityRigDef, Partial<Record<RigPartId, RigPartDef>>>` inside `cutout-rig-math.ts`, add optional `out` parameters to `evaluateRigPose` and `blendRigPoseSnapshots`, and add in-place spring helpers used by `CutoutRig.update()`.
- Dirty-check child sprite transforms and cache `lastAppliedTint` / `lastChilledFoot` on `CutoutRig` so `clearTint()`/`setTint()` only run on state transitions.
- Add `setDepthIfChanged(obj, depth)` and `setBlendModeIfChanged(obj, mode)` across `entity-sync.ts`, `room-entities-sync.ts`, and `portal-door-sync.ts` so `GameScene.children.depthSort()` only runs when a depth actually changes.
- Cache `ProjectileRenderSpec` invariants on `ProjectileVisualEntry` upon spawn/rebind in `entity-sync.ts`, frustum-cull offscreen enemy `CutoutRig.update()` pose evaluation and offscreen projectile/door shader updates, guard `emoteBg.clear()`, and fix `secret_challenge_crystal` `setColor` in `room-entities-sync.ts`.
- Remove duplicate `syncBatch1WeaponRoomEntities` and duplicate `drawWorldWeaponSalvageRing` calls between `room-entities-sync.ts` and `telegraphs-and-overlays.ts`, and gate `resolveMinimapClickedRoomId` in `GameScene.ts` behind pointer-down/click checks.

### Subsystem 4: `CombatFxManager`, World Overlays, Lighting Surface Cache & Cached Procedural Audio
- **Pools & Particles (`combat-fx-pools.ts`, `combat-fx.ts`, `combat-fx-spawners.ts`)**:
  - Maintain incremental `activeParticleCount` and `activeDamagePopupCount` counters + compact active-slot index arrays for `particlePool` and `decalPool`.
  - Replace 300 permanent `shadowSprite`s with a lazy/pooled 32-sprite casing shadow pool (`depth = 19`), removing ~268 idle `Sprite`s from `GameScene.children`.
  - Precompute static kit subframe string tables (`KIT_SUBFRAME_TABLE`) and cache `lastFrameIndex` per particle so `setFrame` only runs when the frame index advances.
  - Guard `.setDepth()`/`.setBlendMode()` in `activateParticle`; apply `setTextAndColorIfChanged` on damage/alert popups; add `activeCount < 2` fast exits + cached text half-extents in popup overlap solvers; make `syncTorchPositions` zero-alloc and gated by `(mapRevision, props.length)`.
  - Hide idle split-depth `Graphics` layers (`setVisible(false)`) when `commandBuffer.length === 0` and eliminate unused `lightningGraphics` work.
- **Overlays (`telegraphs-and-overlays.ts`, `combat-fx-weapons-p1a-entities.ts`, `combat-fx-blessings-p1d.ts`, `combat-fx-p2b.ts`, `combat-fx-p3a.ts`, `sim-events.ts`)**:
  - Collapse 3 `withInterpolatedProjectilesAndPlayer` calls into 1; pool `scratchAimingSightlines` and `tetherBeams` in place; replace `drawEnemyHealthAndStatusBarImpl` `fillRoundedRect`/`fillCircle` calls with Earcut-free `fillRect`/diamond quads; fast-reject ordinary/enemy bullets at the top of `drawP1DBlessingProjectileOverlay`; reuse numeric `Set<number>` in `combat-fx-p2b.ts`; guard `plate.setDepth` in `combat-fx-p3a.ts`; pre-index `events` in `sim-events.ts` to eliminate nested `.some()`/`.find()` scans.
- **Lighting & Audio (`lighting-pipeline.ts`, `zzfx.ts`)**:
  - Cache glowing surface tiles per `(map, map.mapRevision)` in `LightingPipeline`; hoist `hexToNum` constants; raise `BIOME_POSTFX_FRAG` bloom luma early-out from `0.58` to `0.68` while preserving `smoothstep(0.22, 0.48, centerLuma)`.
  - Cache unit-gain procedural fallback `AudioBuffer`s per `(AudioContext, SfxId)` in `zzfx.ts`, skip `StereoPannerNode` when `|pan| < 0.01`, swap-pop `activeVoices`, and `.disconnect()` ended WebAudio nodes.

### Subsystem 5: Shared Runtime Sprite Atlas for `CutoutRig` Parts, Weapons & Props
- Remove `{ willReadFrequently: true }` on GPU-uploaded canvases in `texture-baker-canvas.ts`.
- Pack baked `rig_*`, `rig_shadow_*`, `rig_ring_*`, `weapon_vec_*`, and `prop_*` sprites onto shared `2048×2048` POT `CanvasTexture` atlases (`atlas_rig_prop_0`, `atlas_rig_prop_1`, +2px gutter) during `TextureBaker.bakeStageRigsAndArsenal` / `bakeStageWorldAndPortals`, registering named frames on the atlas while keeping `TextureBaker.resolveAtlasFrame(scene, key)` lookup and excluding `atlas_rig_prop_` in `isPreExistingNonVfxWorldOrRigTextureKey` so `computeTotalVramBytes` remains unchanged within `[14.7 MB, 24.95 MB]`.
- Update `CutoutRig` and `syncProps` to bind `(atlasKey, frameName)` whenever available, collapsing dozens of per-rig texture binds into 1–2 batched WebGL draw calls.

### Subsystem 6: Bit-Identical `WorldSim`, `SpatialHashGrid`, Navigation & P2P Wire Codec Optimization
- Stamp `_gridStamp` directly on queried entities in `SpatialHashGrid` (`spatial-hash.ts`), removing the `16384` ID cap and `Set` fallback.
- Lazily precompute `Uint8Array` contiguous wall/chasm span tables per `mapRevision` in `ArenaMap` (`arena-map.ts`) for O(1) span lookups in `resolveCircleCollision`, and maintain `activeDynamicSurfaceCount` to skip `stepSurfaces` when 0 dynamic surfaces exist.
- Pre-filter stationary movement-blocking props per tick, hoist BFS helpers, add optional `out` scratch to `findNextWalkableWaypoint`, and cache `bfsPropBlockedStampScratch` per `(tick, mapRevision, padExtra)` (`arena-room-archetypes.ts`, `sim-enemies-core.ts`).
- Populate `bulletSpatialGrid` + per-team projectile counters (`playerProjectileCount`, `enemyProjectileCount`) in `WorldSim` (`sim-projectiles.ts`), fixing the `teamCap` O(P) scan and accelerating Phase Blade, Barricade micro-blank, Void Orb, Boomerang, and Parry enemy-bullet queries via dedicated `queryBulletScratch`; add `hasActiveSuperconductEnemy` fast-exit + dedicated `superconductEnemyScratch`; eliminate per-tick `Set`/`Map`/`filter`/`[0,1,2].map` allocations and reset `solarOrbHitTickByEnemy` on room entry.
- Replace 30Hz `JSON.stringify(baselineData)` in `P2PSnapshotEncoder` (`p2p-wire-codec.ts`) with a lightweight revision/field hash check and gate `CoopRoomAuthority.emitStateChange` (`coop-room-authority.ts`) on actual state summary changes.
