# Cutout 2.0 VFX Overhaul (Phase 1: Core POT SDF-Cel Baker, Cutout Kit, Ribbon Builder, Z-Depth & Lighting) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the core VFX rendering foundation—`4×2` POT SDF-Cel GLSL flipbooks, the `512×512` `fx_cutout_kit_512` sprite kit, `6` reaction mini-strips, zero-allocation pointed `fillTriangle` ribbons, scale-band routers, the `2.0..80.0` Z-depth stack, deduplicated rim-clamped hit feedback, and chromatic `inkGuard` lighting—within `< 25.0 MB` total VRAM.

**Architecture:** Replace the `154.31 MB` `7×2` blurry `warpedFbm` baker with `24` `4×2` (`8-frame`) Power-Of-Two (`256×128`, `512×256`, `1024×512`) Euclidean SDF-Cel sheets wrapped in `#141019` ink outlines, paired with a single `512×512` POT Cutout 2.0 kit (`kitBakeScale = 3`, `+2px` padding) and `6` `256×64` reaction strips (`24.816 MB` total game VRAM). Preserve `1:1` low-level `spawnShader*` primitives while routing gameplay bursts/slashes through `routeCutoutBurstByRadius` and `routeCutoutDirectionalByReach` (`worldInkPx ∈ [1.50, 2.20] px`), dropping floor shockwaves under actors (`depth 26.4 / 26.6 < 28.0`), switching player bolts to `BlendMode.NORMAL` (`depth 41.0`), and protecting `#141019` ink in `BIOME_POSTFX_FRAG` via `inkGuard`.

**Tech Stack:** TypeScript, Phaser 3 (`WebGL1` / `Canvas2D`), GLSL ES 1.00, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-cutout-vfx-and-ice-mirror-overhaul-design.md` (Sections 4.1–4.5, 5.1, 6.2–6.5)

## Global Constraints

- Total game GPU texture VRAM MUST stay `<= 25,000,000 B` (`24,816,244 B` target; `100%` POT dimensions on all new/refactored VFX atlases) and GPU boot bake time MUST stay `< 80 ms`.
- Every world-space Cutout VFX border (`#141019`) MUST satisfy `worldInkPx ∈ [1.500 px, 2.200 px]` across `R ∈ [10, 180] px`, and every `WorldSim` collision zone MUST render `1:1` circular at physics `(x, y)` (`0.0 px` foot-offset or `2.12:1` squash drift).
- Zero `Curve.getPoints()`, zero `Graphics.fillPoints()` (`Earcut`), zero per-frame `.filter()`, zero `text.getBounds()`, zero `Math.random()` in deterministic render/VFX loops, and zero bare `pow(x, y)` calls in GLSL ES 1.00 (`safePow` required).
- Player projectiles MUST use `BlendMode.NORMAL` at `depth 41.0`; enemy `#E84545` bullet cores MUST remain inviolable at `depth 60.0` (`BlendMode.NORMAL`).
- Low-level `spawnShaderNova`, `spawnShaderSlash`, `spawnShaderDirectional`, `spawnShaderCone`, and `spawnShaderLance` MUST remain direct `1:1` primitives (`startScale === endScale`).

## Review Focus

1. **D3D11 ANGLE `pow(0.0, y)` `NaN` black quads or WebGL1 non-POT mipmap `INVALID_OPERATION`:** Every exponentiation in GLSL must go through `safePow(x, y) = pow(max(x, 1e-4), y)`, and only `256×128` POT `small` sheets may call `gl.generateMipmap(gl.TEXTURE_2D)` (pinned in Task 1 Step 1).
2. **Software-GL / headless `0.5×` render scale eroding `#141019` ink borders below `1px`:** `uInkTexelWidth` must scale by `Math.max(1.15, canonicalInkTexels * (renderFramePx / framePx))` and headless 2D fallback must register all `8` frames `0..7` (pinned in Task 1 Step 1).
3. **`gl.LINEAR` sub-frame bleeding across `fx_cutout_kit_512` or VRAM budget overrun:** Every packed sprite in `fx_cutout_kit_512` must allocate `W_tex = 3 * W_world + 4`, `H_tex = 3 * H_world + 4` (`+2px` transparent border per side) with zero rect overlap and total VRAM `< 25,000,000 B` (pinned in Task 2 Step 1).
4. **Degenerate `ptCount === 2` segment or blunt rectangular ends in `strokeCutoutQuadStripFromScratch`:** Passing `2` points with `hw = 0` must take the diamond needle branch (`4` triangles: `2` `#141019` ink + `2` core), and `ptCount >= 3` with `hw <= 0.05` must emit tangent needle tip triangles `tip = p ± t * pad * 1.35` with zero heap allocations (pinned in Task 3 Step 1).
5. **PostFX bloom washing `#141019` ink outlines gray or same-tick `projectile_impact` + `damage_dealt` double-spawning hit sparks:** `BIOME_POSTFX_FRAG` must gate bloom by `inkGuard = smoothstep(0.22, 0.48, centerLuma)` while keeping `POSTFX_DEFAULTS.bloomStrength === 0.14`, and hit-spark spawning must enforce a `75 ms` per-target ICD cleared on `enterRoom()` (pinned in Task 4 Step 1).

---

## File Structure

- **Modify:** `apps/client/src/art/texture-baker-shader-fx.ts` — `4×2` POT (`64`/`128`/`256` `framePx`) Euclidean SDF-Cel GLSL baker, `SHADER_STRIP_CATALOG` scale bands & `canonicalInkTexels`, `safePow`, `sdRhombus`, `sdCutoutStar4`, `sdArcForwardX`, WebGL1 `small` mipmaps, `4+4` muzzle variants.
- **Modify:** `apps/client/src/art/texture-baker-fx.ts` & `apps/client/src/art/texture-baker.ts` — Bake `fx_cutout_kit_512` (`512×512` POT @ `kitBakeScale = 3`, `+2px` border, all 51 named sprite entries), `6` `256×64` POT elemental reaction mini-strips (`4f × 64×64`), directional `BlendMode.NORMAL` player bolts (`L:W >= 1.8:1` + `1.6px` `#141019` ink), and `computeTotalVramBytes`.
- **Create:** `apps/client/src/fx/tapered-ribbon-builder.ts` — Module-static `Float32Array(20)` scratch buffers + 2-pass `gfx.fillTriangle()` builder (`strokeCutoutQuadStripFromScratch`, `fillTaperedQuadraticBezier`, `fillTaperedArcRibbon`, `fillTaperedLightningBolt` `< 28°` kink clamp).
- **Modify:** `apps/client/src/fx/combat-fx-pools.ts`, `apps/client/src/fx/combat-fx-spawners.ts`, `apps/client/src/fx/combat-fx.ts` — `8`-frame (`4+4` muzzle sub-range) zero-alloc playback, `decal` `startAlpha = maxAlpha = 0.32`, `routeCutoutBurstByRadius`, `routeCutoutDirectionalByReach`, `resolveAllyFxProfile`, `applyP1SafeHaloAlpha`, `BlendMode.NORMAL` `depth 41.0` player projectiles, `75 ms` rim-clamped `spawnHitSparks`.
- **Modify:** `apps/client/src/scenes/GameScene.ts`, `apps/client/src/scenes/game-scene/entity-sync.ts`, `apps/client/src/scenes/game-scene/sim-events.ts`, `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`, `apps/client/src/art/cutout-rig.ts`, `apps/client/src/fx/lighting-pipeline.ts` — Z-depth layers (`16.0`, `17.0`, `23.0` `pushable_stone`, `26.4`, `26.6`, `30.6` Boss, `44.0`, `46.0` top-8 single sightline), `damage_dealt` spark deduplication, `0xFFFBEB` normal hit-flash, `whiteWeight = 0.46`, `transientLights` priority `#2`, `combatChromaticGlowPool` (`depth 35.0`), and `BIOME_POSTFX_FRAG` `inkGuard`.
- **Create / Modify Tests:** `apps/client/test/topdown-shader-vfx-baker.test.ts`, `apps/client/test/tapered-ribbon-builder.test.ts` (new), `apps/client/test/topdown-shader-vfx-spawners.test.ts`, `apps/client/test/polish-p3-lighting-camera.test.ts`, `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts`.

---

### Task 1: POT `4×2` Multi-Band SDF-Cel WebGL1 Baker (`texture-baker-shader-fx.ts`)

**Files:**
- Modify: `apps/client/src/art/texture-baker-shader-fx.ts`
- Test: `apps/client/test/topdown-shader-vfx-baker.test.ts`

**Interfaces:**
- Consumes: `PALETTE` (`apps/client/src/art/palette.ts`), `detectSoftwareGlContext` (`apps/client/src/core/software-gl.ts`).
- Produces:
  - `SHADER_FX_FRAME_COUNT = 8`, `SHADER_ATLAS_COLS = 4`, `SHADER_ATLAS_ROWS = 2`
  - `SHADER_CANONICAL_NORM_SCALE = 0.5`, `SHADER_CANONICAL_HITBOX_P = 0.82`, `SHADER_CANONICAL_HITBOX_RADIUS_RATIO = 0.41`, `SHADER_CANONICAL_LANCE_SPAN_RATIO = 0.82`
  - `export interface ShaderStripEntry { key: ShaderFxTextureKey; shaderId: number; elemId: number; sizeClass: 'small' | 'medium' | 'large'; isLanceSpan?: boolean; validRadiusBandPx: readonly [number, number]; canonicalInkTexels: number; fallbackPrimaryHex: string; fallbackVeinHex: string; }`
  - `export function getShaderStripEntry(key: ShaderFxTextureKey): ShaderStripEntry`
  - `export function computeSoftwareGlInkTexelWidth(canonicalInkTexels: number, renderFramePx: number, framePx: number): number`
  - `export function computeShaderNovaScale(worldRadiusPx: number, key?: ShaderNovaKey): number`
  - `export function computeShaderDirectionalScale(reachPx: number, key?: ShaderDirectionalKey): number`
  - `export function getShaderBakerGlslSourceForTest(): string`

- [ ] **Step 1: Update and add failing tests in `apps/client/test/topdown-shader-vfx-baker.test.ts`**

```ts
it('enforces 4x2 (8-frame) POT atlas geometry, [1.50, 2.20]px worldInkPx across all 24 entries, and neutral aegis_crest', () => {
  expect(SHADER_FX_FRAME_COUNT).toBe(8);
  expect(SHADER_ATLAS_COLS).toBe(4);
  expect(SHADER_ATLAS_ROWS).toBe(2);
  expect(SHADER_CANONICAL_HITBOX_RADIUS_RATIO).toBeCloseTo(0.41, 4);
  expect(SHADER_CANONICAL_LANCE_SPAN_RATIO).toBeCloseTo(0.82, 4);
  expect(getShaderStripEntry('fx_sh_aegis_crest').elemId).toBe(0);
  expect(getShaderStripEntry('fx_sh_slash_emerald').validRadiusBandPx).toEqual([63.0, 92.2]);

  for (const key of SHADER_FX_TEXTURE_KEYS) {
    const entry = getShaderStripEntry(key);
    const framePx = entry.sizeClass === 'small' ? 64 : entry.sizeClass === 'medium' ? 128 : 256;
    expect(Math.log2(framePx * 4) % 1).toBe(0);
    expect(Math.log2(framePx * 2) % 1).toBe(0);
    const denom = (entry.isLanceSpan ? 0.82 : 0.41) * framePx;
    const [rMin, rMax] = entry.validRadiusBandPx;
    expect((rMin / denom) * entry.canonicalInkTexels).toBeGreaterThanOrEqual(1.499);
    expect((rMax / denom) * entry.canonicalInkTexels).toBeLessThanOrEqual(2.201);
  }
});

it('guards GLSL against D3D11 pow(0, y) NaN and compensates uInkTexelWidth under software-GL 0.5x scale', () => {
  const glsl = getShaderBakerGlslSourceForTest();
  const stripped = glsl.replace(/float\s+safePow\s*\([^)]*\)\s*\{[^}]*\}/, '');
  expect(stripped).not.toMatch(/\bpow\s*\(/);
  expect(glsl).toContain('sdArcForwardX');
  expect(computeSoftwareGlInkTexelWidth(1.8, 32, 64)).toBeGreaterThanOrEqual(1.15);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/topdown-shader-vfx-baker.test.ts`
Expected: FAIL (`SHADER_FX_FRAME_COUNT` is `14`, `getShaderStripEntry` / `getShaderBakerGlslSourceForTest` missing).

- [ ] **Step 3: Refactor `apps/client/src/art/texture-baker-shader-fx.ts` to POT `4×2` SDF-Cel GLSL**

Implement the exact catalog table from Spec Section 4.1 (`7 small` `64px` -> `256×128` including `fx_sh_cone_blast` with `isLanceSpan: true`; `15 medium` `128px` -> `512×256` including `fx_sh_beam_lance` with `isLanceSpan: true` and `fx_sh_slash_emerald` with `validRadiusBandPx: [63.0, 92.2], canonicalInkTexels: 1.25`; `2 large` `256px` -> `1024×512`; `fx_sh_aegis_crest` `elemId: 0`).
- In GLSL ES 1.00: implement `decodeAtlasCoord` for `4×2` (`col = clamp(floor(fragCoord.x / framePx), 0.0, 3.0)`, `canvasRow = 1.0 - clamp(floor(fragCoord.y / framePx), 0.0, 1.0)`, `frameIdx = canvasRow * 4.0 + col`, `p = (fract(fragCoord / framePx) - 0.5) / 0.50`); `safePow(x, y) = pow(max(x, 1e-4), y)`; Euclidean `sdRhombus`, `sdCutoutStar4`, `sdArcForwardX(p, sc, ra, rb) = sdArc(vec2(p.y, p.x), sc, ra, rb)`; and `synthesizeCutoutCelRgba` outputting 3 quantized `PALETTE` stops wrapped in `#141019` (`vec3(0.0784, 0.0627, 0.0980)`) ink of width `uInkTexelWidth`, with `> 80%` interior hollow-core erosion on frames `f >= 2` (and `4+4` Variant A `0..3` / Variant B `4..7` sub-ranges on `shaderId` `6` & `23`).
- For `small` (`256×128` POT) textures uploaded to Phaser WebGL1, bind the `WebGLTexture`, set `TEXTURE_MIN_FILTER = gl.LINEAR_MIPMAP_LINEAR`, and call `gl.generateMipmap(gl.TEXTURE_2D)`. Keep deterministic 2D Canvas fallback populating frames `0..7` (`col = f % 4`, `row = Math.floor(f / 4)`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/topdown-shader-vfx-baker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/art/texture-baker-shader-fx.ts apps/client/test/topdown-shader-vfx-baker.test.ts
git commit -m "feat(vfx): rebuild shader fx baker as 4x2 POT SDF-Cel sheets with #141019 ink"
```

---

### Task 2: `fx_cutout_kit_512` (`512×512` POT), `6` Reaction Mini-Strips (`256×64` POT), Player Bolts & VRAM Gate

**Files:**
- Modify: `apps/client/src/art/texture-baker-fx.ts`
- Modify: `apps/client/src/art/texture-baker.ts`
- Test: `apps/client/test/topdown-shader-vfx-baker.test.ts`, `apps/client/test/art.test.ts`

**Interfaces:**
- Consumes: `PALETTE` (`apps/client/src/art/palette.ts`), `bakeShaderVfxFlipbooks` (`apps/client/src/art/texture-baker-shader-fx.ts`).
- Produces:
  - `export const CUTOUT_KIT_ATLAS_KEY = 'fx_cutout_kit_512' as const;`
  - `export const CUTOUT_KIT_BAKE_SCALE = 3 as const;`
  - `export const ELEMENTAL_REACTION_STRIP_KEYS = ['fx_react_vapor_puff', 'fx_react_shatter_pane', 'fx_react_superconduct_cross', 'fx_react_toxic_glob', 'fx_react_paralysis_x', 'fx_react_overload_star'] as const;`
  - `export type ElementalReactionStripKey = (typeof ELEMENTAL_REACTION_STRIP_KEYS)[number];`
  - `export type CutoutKitFrameKey` (all `51` named sprite entries from Spec Section 4.2 categories 1–5, where `4 × status_badge_9x9` are `'status_badge_burn_9x9' | 'status_badge_chill_9x9' | 'status_badge_shock_9x9' | 'status_badge_poison_9x9'`)
  - `export function getCutoutKitFrameSpec(frame: CutoutKitFrameKey): { x: number; y: number; w: number; h: number; worldW: number; worldH: number; frameCount: 1 | 2 | 4; canonicalRadiusPx?: number }`
  - `export function bakeCutoutKit512(scene: Phaser.Scene): void`
  - `export function bakeElementalReactionMiniStrips(scene: Phaser.Scene): void`
  - `export function computeTotalVramBytes(scene: Phaser.Scene): number`

- [ ] **Step 1: Add failing tests for `fx_cutout_kit_512` packing, `+2px` border invariant, `6` reaction strips, and `< 25.0 MB` VRAM ledger in `apps/client/test/topdown-shader-vfx-baker.test.ts`**

```ts
it('packs all 51 Cutout 2.0 kit entries inside 512x512 POT with +2px border and keeps total VRAM < 25.0 MB', () => {
  const scene = createMockBakeScene();
  TextureBaker.bakeAll(scene, 4);

  const kitTex = scene.textures.get(CUTOUT_KIT_ATLAS_KEY);
  expect(kitTex.getSourceImage().width).toBe(512);
  expect(kitTex.getSourceImage().height).toBe(512);

  const rects: Array<{ key: string; x: number; y: number; w: number; h: number }> = [];
  for (const key of ALL_CUTOUT_KIT_FRAME_KEYS) {
    const spec = getCutoutKitFrameSpec(key);
    expect(spec.w).toBe((3 * spec.worldW + 4) * spec.frameCount);
    expect(spec.h).toBe(3 * spec.worldH + 4);
    expect(spec.x + spec.w).toBeLessThanOrEqual(512);
    expect(spec.y + spec.h).toBeLessThanOrEqual(512);
    for (const prev of rects) {
      const overlaps =
        spec.x < prev.x + prev.w &&
        spec.x + spec.w > prev.x &&
        spec.y < prev.y + prev.h &&
        spec.y + spec.h > prev.y;
      expect(overlaps, `${key} overlaps ${prev.key}`).toBe(false);
    }
    rects.push({ key, ...spec });
  }

  for (const rxKey of ELEMENTAL_REACTION_STRIP_KEYS) {
    const rxTex = scene.textures.get(rxKey);
    expect(rxTex.getSourceImage().width).toBe(256);
    expect(rxTex.getSourceImage().height).toBe(64);
  }

  expect(computeTotalVramBytes(scene)).toBeLessThanOrEqual(24_950_000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/topdown-shader-vfx-baker.test.ts test/art.test.ts`
Expected: FAIL (`CUTOUT_KIT_ATLAS_KEY`, `bakeCutoutKit512`, `ELEMENTAL_REACTION_STRIP_KEYS`, `computeTotalVramBytes` undefined).

- [ ] **Step 3: Implement `bakeCutoutKit512`, `bakeElementalReactionMiniStrips`, directional Cutout player bolts, and `computeTotalVramBytes`**

In `apps/client/src/art/texture-baker-fx.ts` and `apps/client/src/art/texture-baker.ts`:
- Shelf-pack all 51 sprite entries from Spec Section 4.2 onto a single `512×512` POT canvas (`fx_cutout_kit_512`) at fixed `CUTOUT_KIT_BAKE_SCALE = 3` with `+2px` transparent padding per frame (`W_cell = 3 * worldW + 4`, `H_cell = 3 * worldH + 4`; for `fx_compact_burst_4f`, cap cell at `64×64` with `r_tex = 26.0, ink = 1.25`, `canonicalRadiusPx = 31.2`). Draw crisp `#141019` `1.6–2.0px` Cutout silhouettes + `#F4F1EA` specular highlights + `PALETTE` cel fills for:
  - 4 neutral `4f` bursts (`fx_micro_burst_4f` `R_0=11.0`, `fx_small_burst_4f` `R_0=16.0`, `fx_mid_burst_4f` `R_0=21.3`, `fx_compact_burst_4f` `R_0=31.2`), registering sub-frames `key` (frame 0) and `${key}_0..3` on `fx_cutout_kit_512`.
  - 8 summon sprites (`summon_sacred_tree`, `summon_tesla_base`, `summon_tesla_head`, `summon_holo_base`, `summon_holo_head`, `summon_thunder_decoy`, `summon_life_blossom`, `summon_wall_tether_pylon`).
  - Heroic/Boss kit (`prop_cryo_spire`, `fx_thrown_thunder_hammer`, `fx_parry_winged_crest`, `fx_cutout_crescent`, `item_life_seed`, `fx_boss_shell_plate`).
  - Aux projectiles & attachments (`proj_mutator_boomerang_saw`, `proj_dash_phase_blade`, `proj_cluster_mortar_lob`, `proj_holster_surge_bolt`, `proj_holo_decoy_shot`, `proj_gale_wind_blade`, `proj_relic_perpetual_rocket`, `proj_table_tech_rocket`, `proj_reload_tediore_chuck`, `fx_solar_mini_sun`, `fx_frag_fuse_wheel`, `prop_rocket_nozzle`, `prop_cryo_node`).
  - Status (`status_burn_2f`, `status_chill_2f`, `status_shock_2f`, `status_poison_2f`, `status_freeze_cuff`, `status_badge_burn_9x9`, `status_badge_chill_9x9`, `status_badge_shock_9x9`, `status_badge_poison_9x9`), `duo_rail_lock_10x10`, 4 material shards (`fx_wood_shard`, `fx_ceramic_shard`, `fx_stone_chip`, `fx_ice_shard_decal` `<= 6×6`), and weapon micro-motes (`fx_rim_glint`, `fx_pellet_dent`, `fx_muzzle_thorn_barb`, `fx_seed_heal_wisp`, `fx_overheat_puff`, `fx_rivet_hex_head`).
- Bake `6` `256×64` POT (`4 × 64×64`, frames `0..3`) reaction mini-strips (`fx_react_vapor_puff`, `fx_react_shatter_pane`, `fx_react_superconduct_cross`, `fx_react_toxic_glob`, `fx_react_paralysis_x`, `fx_react_overload_star`) with `#141019` Cutout ink and element-coded cel fills.
- Update player projectile textures in `texture-baker-fx.ts` (`proj_player_bolt`, arrow, rune droplet, thorn dart, rivet, wind blade, plasma/laser bolts) to elongated `+X` silhouettes (`L : W >= 1.8 : 1`) wrapped in `1.6px` `#141019` ink (`proj_enemy_*` and `proj_stress_enemy` untouched).
- Implement `computeTotalVramBytes(scene)` summing `(w * h * 4)` across all baked Phaser canvas textures plus the `7 × 43,692 B` `small` shader mipmap pyramids.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/topdown-shader-vfx-baker.test.ts test/art.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/art/texture-baker-fx.ts apps/client/src/art/texture-baker.ts apps/client/test/topdown-shader-vfx-baker.test.ts apps/client/test/art.test.ts
git commit -m "feat(vfx): bake fx_cutout_kit_512 POT kit, 6 reaction mini-strips, and Cutout player bolts"
```

---

### Task 3: Zero-Allocation Pointed Scalar Quad-Strip Builder (`tapered-ribbon-builder.ts`)

**Files:**
- Create: `apps/client/src/fx/tapered-ribbon-builder.ts`
- Test: `apps/client/test/tapered-ribbon-builder.test.ts`

**Interfaces:**
- Consumes: `hexToNum`, `PALETTE` (`apps/client/src/art/palette.ts`).
- Produces:
  - `export const MAX_RIBBON_PTS = 20 as const;`
  - `export const SCRATCH_PX: Float32Array; export const SCRATCH_PY: Float32Array; export const SCRATCH_HW: Float32Array;`
  - `export function strokeCutoutQuadStripFromScratch(gfx: Phaser.GameObjects.Graphics, ptCount: number, fillColorNum: number, alpha: number, inkPadPx?: number, inkColorNum?: number): void`
  - `export function fillTaperedQuadraticBezier(gfx: Phaser.GameObjects.Graphics, x0: number, y0: number, cx: number, cy: number, x2: number, y2: number, startHalfWidthPx: number, midHalfWidthPx: number, endHalfWidthPx: number, fillColorNum: number, alpha: number, segments?: number, inkPadPx?: number): void`
  - `export function fillTaperedArcRibbon(gfx: Phaser.GameObjects.Graphics, cx: number, cy: number, radiusPx: number, startAngleRad: number, endAngleRad: number, peakHalfWidthPx: number, fillColorNum: number, alpha: number, segments?: number, inkPadPx?: number): void`
  - `export function fillTaperedLightningBolt(gfx: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, peakHalfWidthPx: number, fillColorNum: number, alpha: number, seed: number, segments?: number, inkPadPx?: number): void`

- [ ] **Step 1: Write failing unit tests in `apps/client/test/tapered-ribbon-builder.test.ts`**

```ts
it('renders a 2-point tapered needle via the diamond branch (4 fillTriangle calls, zero fillPoints/strokeCircle)', () => {
  const gfx = createRecordingGraphicsMock();
  SCRATCH_PX[0] = 100; SCRATCH_PY[0] = 100; SCRATCH_HW[0] = 0;
  SCRATCH_PX[1] = 140; SCRATCH_PY[1] = 100; SCRATCH_HW[1] = 0;
  strokeCutoutQuadStripFromScratch(gfx as never, 2, 0x38bdf8, 0.9, 1.8);

  expect(gfx.fillTriangleCalls.length).toBe(4);
  expect(gfx.fillStyleCalls[0]?.color).toBe(0x141019);
  expect(gfx.fillStyleCalls[1]?.color).toBe(0x38bdf8);
  // Tip0 extends backward along -X by 1.8 * 1.35 = 2.43px -> x = 97.57; Tip1 extends forward to 142.43
  const xs = gfx.fillTriangleCalls.flatMap((c) => [c.x0, c.x1, c.x2]);
  expect(Math.min(...xs)).toBeCloseTo(100 - 1.8 * 1.35, 2);
  expect(Math.max(...xs)).toBeCloseTo(140 + 1.8 * 1.35, 2);
  expect(gfx.fillPointsCalls.length).toBe(0);
});

it('adds pointed tangent needle caps on N>=3 arcs and clamps lightning kinks < 28 deg deterministically', () => {
  const gfx = createRecordingGraphicsMock();
  fillTaperedArcRibbon(gfx as never, 200, 200, 56, 0, Math.PI * 0.5, 4.0, 0x22c55e, 0.9, 8, 1.8);
  // 8 segments * 2 tris = 16 body tris + 2 needle caps = 18 ink tris + 16 core tris = 34
  expect(gfx.fillTriangleCalls.length).toBe(34);

  const gfxBoltA = createRecordingGraphicsMock();
  const gfxBoltB = createRecordingGraphicsMock();
  fillTaperedLightningBolt(gfxBoltA as never, 0, 0, 120, 0, 2.8, 0x38bdf8, 1.0, 42, 6, 1.8);
  fillTaperedLightningBolt(gfxBoltB as never, 0, 0, 120, 0, 2.8, 0x38bdf8, 1.0, 42, 6, 1.8);
  expect(gfxBoltA.fillTriangleCalls).toEqual(gfxBoltB.fillTriangleCalls);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/tapered-ribbon-builder.test.ts`
Expected: FAIL (`Cannot find module '../src/fx/tapered-ribbon-builder.js'`).

- [ ] **Step 3: Implement `apps/client/src/fx/tapered-ribbon-builder.ts`**

Allocate module-static `SCRATCH_PX`, `SCRATCH_PY`, `SCRATCH_HW`, `SCRATCH_NX`, `SCRATCH_NY` (`new Float32Array(20)`).
- In `strokeCutoutQuadStripFromScratch(gfx, ptCount, fillColorNum, alpha, inkPadPx = 1.8, inkColorNum = 0x141019)`:
  - Clamp `n = Math.min(ptCount, MAX_RIBBON_PTS)`; return early if `n < 2` or `alpha <= 0.005`.
  - When `n === 2`: compute unit tangent `(tx, ty)` and normal `(-ty, tx)`, mid-point `(mx, my)`, `midHw = Math.max(1.2, 0.5 * (SCRATCH_HW[0]! + SCRATCH_HW[1]!))`, `tip0 = p0 - t * inkPadPx * 1.35`, `tip1 = p1 + t * inkPadPx * 1.35`; draw `2` `#141019` diamond triangles (`tip0`..`mid±(midHw+inkPadPx)`..`tip1`) then `2` `fillColorNum` core triangles (`p0`..`mid±midHw`..`p1`).
  - When `n >= 3`: compute smoothed vertex normals into `SCRATCH_NX/NY`. Pass `0` (`inkColorNum`): draw `(n - 1) * 2` outset quad triangles (`hw_i + inkPadPx`), plus start needle cap triangle `(p0 - t0 * inkPadPx * 1.35, p0 + n0 * pad0, p0 - n0 * pad0)` if `SCRATCH_HW[0]! <= 0.05` and end needle cap triangle `(pLast + tLast * inkPadPx * 1.35, pLast - nLast * padLast, pLast + nLast * padLast)` if `SCRATCH_HW[n - 1]! <= 0.05`. Pass `1` (`fillColorNum`): draw `(n - 1) * 2` core quad triangles.
- Implement `fillTaperedQuadraticBezier` (`hw(t) = (1-t)^2 * startHw + 2(1-t)t * midHw + t^2 * endHw`), `fillTaperedArcRibbon` (`hw(u) = Math.sin(Math.PI * u) * peakHalfWidthPx` so `u=0` and `u=1` taper to `0.0`), and `fillTaperedLightningBolt` (deterministic integer hash from `seed` + segment index, perpendicular offset clamped to `<= segLen * Math.tan(27 * Math.PI / 180)` so every kink stays `< 28°`, `hw(u) = Math.sin(Math.PI * u) * peakHalfWidthPx`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/tapered-ribbon-builder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/fx/tapered-ribbon-builder.ts apps/client/test/tapered-ribbon-builder.test.ts
git commit -m "feat(vfx): add zero-alloc pointed fillTriangle ribbon builder"
```

---

### Task 4: Scale-Band Routers, Z-Depth Stack (`2.0..80.0`), Deduplicated Rim Hit Feedback & Chromatic `inkGuard` Lighting

**Files:**
- Modify: `apps/client/src/fx/combat-fx-pools.ts`
- Modify: `apps/client/src/fx/combat-fx-spawners.ts`
- Modify: `apps/client/src/fx/combat-fx.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/game-scene/entity-sync.ts`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Modify: `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`
- Modify: `apps/client/src/art/cutout-rig.ts`
- Modify: `apps/client/src/fx/lighting-pipeline.ts`
- Test: `apps/client/test/topdown-shader-vfx-spawners.test.ts`, `apps/client/test/polish-p3-lighting-camera.test.ts`, `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts`

**Interfaces:**
- Consumes: `getShaderStripEntry`, `SHADER_FX_FRAME_COUNT` (`Task 1`); `CUTOUT_KIT_ATLAS_KEY`, `ELEMENTAL_REACTION_STRIP_KEYS`, `getCutoutKitFrameSpec` (`Task 2`); `fillTaperedArcRibbon`, `fillTaperedLightningBolt` (`Task 3`).
- Produces:
  - `export interface AllyFxProfile { isTeammate: boolean; bulletAlpha: number; aoeAlpha: number; turretRingAlpha: number; allowLightAndShake: boolean; }`
  - `export function resolveAllyFxProfile(ownerPlayerId: number | undefined, localPlayerId: number | undefined, settingOpacity?: number): AllyFxProfile`
  - `export function applyP1SafeHaloAlpha(baseAlpha: number, isTeammate: boolean, distToP1Px: number, effectRadiusPx: number): number`
  - `export interface CutoutRouterOptions { isTeammate?: boolean; alpha?: number; depth?: number; ttlSec?: number; tint?: number; suppressPerimeterRing?: boolean; }`
  - `export function routeCutoutBurstByRadius(fx: CombatFxManager, x: number, y: number, worldRadiusPx: number, requestedKey: ShaderNovaKey, opts?: CutoutRouterOptions): void`
  - `export function routeCutoutDirectionalByReach(fx: CombatFxManager, x: number, y: number, reachPx: number, angleRad: number, requestedKey: ShaderDirectionalKey, arcSpreadRad: number, opts?: CutoutRouterOptions): void`
  - `CombatFxManager.underActorGraphics: Phaser.GameObjects.Graphics` (`depth 26.6`), `CombatFxManager.weaponRibbonGraphics: Phaser.GameObjects.Graphics` (`depth 44.0`), `CombatFxManager.lastHitSparkTimeByTargetId: Map<number, number>`, `CombatFxManager.distanceToLocalPlayer(x: number, y: number): number`, `CombatFxManager.resetRoomTransientState(): void`
  - `GameScene.groundHazardGraphics` (`depth 16.0`), `GameScene.enemyGroundTelegraphGfx` (`depth 17.0`), `GameScene.underActorGraphics` (`depth 26.6`), `GameScene.weaponRibbonGraphics` (`depth 44.0`), `GameScene.telegraphGraphics` (`depth 46.0`)
  - `LightingPipeline.spawnCombatChromaticGlow(x: number, y: number, radiusPx: number, colorHex: string, alpha?: number, ttlSec?: number): void`
  - `export function getBiomePostFxFragForTest(): string`

- [ ] **Step 1: Update and add failing tests in `topdown-shader-vfx-spawners.test.ts`, `polish-p3-lighting-camera.test.ts`, and `polish-p10b-fx-elemental-ambient.test.ts`**

```ts
it('preserves 1:1 low-level spawnShader* scales while routing out-of-band radii via routeCutoutBurstByRadius and dropping P1 self-bursts to depth 26.4', () => {
  const { fx } = createTestCombatFx({ localPlayerPos: { x: 200, y: 200 } });
  // Direct primitive stays 1:1
  const slot = fx.spawnShaderNova(400, 400, 104, 'fx_sh_shrapnel_corona');
  expect(slot?.startScale).toBeCloseTo(104 / (0.41 * 128), 4);
  expect(slot?.endScale).toBeCloseTo(slot!.startScale, 4);

  // Router clamps > rMax (64px) core at rMax and drops P1 self-centered burst (dist <= 24) to depth 26.4
  routeCutoutBurstByRadius(fx, 210, 200, 104, 'fx_sh_shrapnel_corona');
  const clampedCore = fx.particlePool.find((p) => p.active && p.textureKey === 'fx_sh_shrapnel_corona' && p !== slot);
  expect(clampedCore?.startScale).toBeCloseTo(64 / (0.41 * 128), 4);
  expect(clampedCore?.sprite.depth).toBeCloseTo(26.4, 2);
  expect(fx.activePerimeterRings.length).toBe(1);
  expect(fx.activePerimeterRings[0]?.targetRadiusPx).toBe(104);
});

it('switches player bolts to NORMAL depth 41.0, deduplicates hit sparks with 75ms per-target ICD, and protects #141019 ink in BIOME_POSTFX_FRAG', () => {
  const playerSpec = resolveProjectileRenderSpec({ team: 'player', weaponId: 'hunter_crossbow' });
  expect(playerSpec.blendMode).toBe('NORMAL');
  expect(playerSpec.depth).toBe(41);
  const enemySpec = resolveProjectileRenderSpec({ team: 'enemy', bulletShape: 'orb' });
  expect(enemySpec.blendMode).toBe('NORMAL');
  expect(enemySpec.depth).toBe(60);

  const { fx } = createTestCombatFx();
  fx.spawnHitSparks(300, 300, 0, { targetId: 7, targetX: 312, targetY: 300, targetRadius: 14, nowMs: 1000 });
  fx.spawnHitSparks(300, 300, 0, { targetId: 7, targetX: 312, targetY: 300, targetRadius: 14, nowMs: 1040 });
  const sparks = fx.particlePool.filter((p) => p.active && p.textureKey === 'fx_sh_hit_spark');
  expect(sparks).toHaveLength(1);
  expect(sparks[0]?.x).toBeCloseTo(312 - 0.85 * 14, 2);

  expect(POSTFX_DEFAULTS.bloomStrength).toBe(0.14);
  expect(getBiomePostFxFragForTest()).toContain('smoothstep(0.22, 0.48, centerLuma)');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/topdown-shader-vfx-spawners.test.ts test/polish-p3-lighting-camera.test.ts test/polish-p10b-fx-elemental-ambient.test.ts`
Expected: FAIL (`routeCutoutBurstByRadius`, `getBiomePostFxFragForTest` missing; player bolt `blendMode` is `'ADD'` / depth not `41`).

- [ ] **Step 3: Implement routers, `4+4` muzzle playback, Z-depth stack, hit deduplication, `0xFFFBEB` rig flash, and `inkGuard` lighting**

1. **`combat-fx-pools.ts` & `combat-fx-spawners.ts` & `combat-fx.ts`:**
   - Update flipbook playback default `frameCount = 8`. Add `baseFrame?: number` on `PooledParticle`: for `fx_sh_muzzle_burst` / `fx_sh_muzzle_arcane`, set `baseFrame = (fx.muzzleVariantCounter++ & 1) * 4`, `frameCount = 4`, `ttl = 0.067`, and toggle `flipY` via independent `fx.muzzleFlipCounter++` (never shared with melee `slashFlipToggle`). Support `fx_cutout_kit_512` `4f` sub-frame advancement (`${kitKey}_${frameIdx}`).
   - Initialize floor decals directly at `startAlpha = 0.32` (`depth 6.0`, `size <= 6px`, never starting at `0.78`).
   - Replace `lightningGraphics.lineBetween` in `combat-fx-pools.ts` with `fillTaperedLightningBolt` onto `weaponRibbonGraphics` (`depth 44.0`).
   - Implement `resolveAllyFxProfile` (`bulletAlpha = 0.42 * s`, `aoeAlpha = 0.35 * s`, `turretRingAlpha = 0`, `allowLightAndShake = false` when `isTeammate`) and `applyP1SafeHaloAlpha` (`alpha * 0.15` when `isTeammate && distToP1Px <= 18 + 0.35 * effectRadiusPx`).
   - Implement `routeCutoutBurstByRadius` and `routeCutoutDirectionalByReach` per Spec Section 4.3, driving a pooled `60Hz` `activePerimeterRings` / `activeArcRibbons` array rendered each frame on `underActorGraphics` (`depth 26.6`, `#141019` `1.80px` ink) while keeping low-level `spawnShader*` `1:1`.
   - Update `resolveProjectileRenderSpec` for player projectiles to `blendMode: 'NORMAL'`, `depth: 41`, `alpha: isTeammate ? 0.42 * s : 1.0`, plus optional `playerBulletGlowPool` (`depth 40.5 ADD`, `alpha <= 0.20`) for P1 heavy/magic shots only.
   - Rim-clamp `spawnHitSparks` to `(e.x - cos(theta) * 0.85 * r_e, e.y - sin(theta) * 0.85 * r_e)` with `75 ms` per-target ICD (`lastHitSparkTimeByTargetId`, cleared in `resetRoomTransientState()` on `enterRoom()`); follow-up hits within `75 ms` and all ally hits (`alpha = 0.35`) spawn a `2-tick` `fx_rim_glint` from `fx_cutout_kit_512`.
2. **`GameScene.ts`, `entity-sync.ts`, `sim-events.ts`, `telegraphs-and-overlays.ts`, `cutout-rig.ts`:**
   - Wire `groundHazardGraphics` (`16.0`), `enemyGroundTelegraphGfx` (`17.0`), `underActorGraphics` (`26.6`), `blizzardRimGraphics` (`36.0`, strictly `< 36.2` `voidMaskGraphics`), `weaponRibbonGraphics` (`44.0`), `telegraphGraphics` (`46.0`).
   - Decouple `pushable_stone` from `telegraphGraphics` to a dedicated pooled sprite (`prop_pushable_stone`) at `depth 23.0` (shadow at `19.0`).
   - Set Boss rig depth to `30.6` (`< 31.0` `bracketGraphics`), local P1 at `30.0`, allies at `29.0`, enemies at `28.0`.
   - Deduplicate enemy sniper sightlines into a single unified sightline on `telegraphGraphics` (`depth 46.0`), capped at the **top `8`** closest/soonest-to-fire aiming enemies; draw `100%` closed `#141019` (`3.2px`) + `#E84545` (`2.0px`) enemy/Boss ground AoE telegraphs on `enemyGroundTelegraphGfx` (`depth 17.0`).
   - In `sim-events.ts`, track target positions/IDs hit by `projectile_impact` in the current tick and skip duplicate `spawnHitSparks` on matching `damage_dealt` events.
   - In `cutout-rig.ts`, unify normal hit-flash to `2` ticks (`~33 ms`) of warm ivory `0xFFFBEB` across both full part-tinting and `fastComposite` modes (preserving `0xF4F1EA` for Parry).
3. **`lighting-pipeline.ts`:**
   - Change `liftAmbientTowardClearWhite` default `whiteWeight` from `0.68` to `0.46`.
   - Reorder the `48`-light draw priority to: (1) P1–P4 vision -> (2) `transientLights` (up to `16` combat lights) -> (3) interactable lights -> (4) static prop/surface lights, and add a `16`-slot `combatChromaticGlowPool` (`depth 35.0 ADD`, `alpha <= 0.18`, `ttl = 0.12–0.18s`).
   - Keep `POSTFX_DEFAULTS.bloomStrength = 0.14` and multiply bloom contribution in `BIOME_POSTFX_FRAG` (`lines 86-87`) by `float inkGuard = smoothstep(0.22, 0.48, centerLuma);`.

- [ ] **Step 4: Run tests and typecheck to verify everything passes**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/topdown-shader-vfx-spawners.test.ts test/polish-p3-lighting-camera.test.ts test/polish-p10b-fx-elemental-ambient.test.ts test/polish-p10a-cutout-rig.test.ts && pnpm typecheck`
Expected: PASS with `0` TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/fx/combat-fx-pools.ts apps/client/src/fx/combat-fx-spawners.ts apps/client/src/fx/combat-fx.ts apps/client/src/scenes/GameScene.ts apps/client/src/scenes/game-scene/entity-sync.ts apps/client/src/scenes/game-scene/sim-events.ts apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts apps/client/src/art/cutout-rig.ts apps/client/src/fx/lighting-pipeline.ts apps/client/test/topdown-shader-vfx-spawners.test.ts apps/client/test/polish-p3-lighting-camera.test.ts apps/client/test/polish-p10b-fx-elemental-ambient.test.ts
git commit -m "feat(vfx): wire scale-band routers, Z-depth stack, hit-spark ICD, and inkGuard lighting"
```
