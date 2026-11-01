# 1:1 Top-Down Chiaroscuro Shader VFX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` and `superpowers:test-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul all combat VFX subsystems across *Ashen Pact* to the approved `1:1` Orthographic Top-Down & `360°` Chiaroscuro Domain-Warped WebGL1 Shader style while improving 4-player co-op readability and maintaining 60 FPS performance.

**Architecture:** Bake 14 multi-frame (`14f`) horizontal RGBA sprite sheets once at boot via a single temporary offscreen WebGL1 fragment shader (`premultipliedAlpha: false`, unpremultiplied ACES-tonemapped Chiaroscuro veins + `#FFFDF5` HDR edges, deterministic 2D canvas fallback for headless Vitest, immediate `WEBGL_lose_context` cleanup). Play flipbooks with zero allocations through `CombatFxManager.particlePool`, and separate persistent floor hazards & enemy ground telegraphs onto `GameScene.groundHazardGraphics` (`depth: 16`, strictly under shadows/entities) while keeping enemy `#E84545` bullets inviolable at `depth: 60`.

**Tech Stack:** TypeScript, Phaser 3 (WebGL1 / Canvas2D), Vitest, Playwright (`pnpm shots` Animation Verification Engine 2.6).

---

### Task 1: Offscreen WebGL1 `1:1` Chiaroscuro Shader Sprite-Sheet Baker & Base FX Textures

**Files:**
- Create: `apps/client/src/art/texture-baker-shader-fx.ts`
- Modify: `apps/client/src/art/texture-baker-fx.ts`
- Modify: `apps/client/src/art/texture-baker.ts`
- Test: `apps/client/test/topdown-shader-vfx-baker.test.ts`

- [ ] **Step 1: Write failing tests in `apps/client/test/topdown-shader-vfx-baker.test.ts`**
  Verify:
  - `SHADER_FX_TEXTURE_KEYS` defines all 14 `fx_sh_*` flipbook keys (`8` directional `+X` `360°` + `6` `1:1` circular hollow-core).
  - `SHADER_FX_FRAME_COUNT === 14` and `computeShaderNovaScale(worldRadiusPx)` maps canonical `R_norm = 0.78 * 0.43 * framePx` (`0.3354 * framePx`) to exact `1.0×` `WorldSim` Euclidean pixel radius (`scale * 0.3354 * framePx === worldRadiusPx`).
  - `bakeShaderVfxFlipbooks(mockScene, 4)` registers all 14 canvas textures and populates frames `0..13` with exact square `1:1` frame bounds `(f * framePx, 0, framePx, framePx)` even in headless/2D fallback mode.
  - `ENEMY_BULLET_VISUAL_SPEC` (`#E84545`, `depth: 60`) and `BAKED_FX_TEXTURE_KEYS` invariants remain 100% intact.
- [ ] **Step 2: Run Vitest on `topdown-shader-vfx-baker.test.ts` and confirm RED**
- [ ] **Step 3: Implement `texture-baker-shader-fx.ts` and upgrade `texture-baker-fx.ts` + `texture-baker.ts`**
  - Single offscreen WebGL1 shader program compiling all 14 procedural GLSL VFX (`fx_sh_slash_steel`, `fx_sh_slash_emerald`, `fx_sh_slash_crimson`, `fx_sh_slash_thunder`, `fx_sh_cone_blast`, `fx_sh_beam_lance`, `fx_sh_muzzle_burst`, `fx_sh_hit_spark`, `fx_sh_nova_solar`, `fx_sh_nova_magma`, `fx_sh_nova_thunder`, `fx_sh_nova_cryo`, `fx_sh_nova_venom`, `fx_sh_nova_void`) with `1:1` isotropic normalization (`+X` East, `+Y` South matching Phaser screen space), rich 3-stop saturated elemental body ramps, recessed dark Chiaroscuro veins, HDR `#FFFDF5` edges/sparks, ACES tonemapping, and `WEBGL_lose_context.loseContext()` cleanup.
  - Upgrade player bolts, crescent waves, slash arcs, impact/shockwave rings, muzzle flashes, and floor decals in `texture-baker-fx.ts` to crisp Chiaroscuro `1:1` / `+X` silhouettes without touching `proj_enemy_orb` or `proj_stress_enemy`.
  - Wire `bakeShaderVfxFlipbooks(scene, targetScale)` into `TextureBaker.bakeAll`.
- [ ] **Step 4: Run Vitest (`topdown-shader-vfx-baker.test.ts`, `art.test.ts`, `polish-p10b-fx-elemental-ambient.test.ts`) and confirm GREEN**

---

### Task 2: Zero-Allocation Flipbook Playback & Core Combat Spawners

**Files:**
- Modify: `apps/client/src/fx/combat-fx-pools.ts`
- Modify: `apps/client/src/fx/combat-fx-spawners.ts`
- Modify: `apps/client/src/fx/combat-fx.ts`
- Test: `apps/client/test/topdown-shader-vfx-spawners.test.ts`

- [ ] **Step 1: Write failing tests in `apps/client/test/topdown-shader-vfx-spawners.test.ts`**
  Verify:
  - `resolveParticleBlendAndDepth` assigns `blendMode: 'NORMAL'` and `44 <= depth <= 57` (`34 < depth < 60`) for all `fx_sh_*` keys while keeping `'ADD'` on legacy `fx_spark`, `fx_impact_ring`, `fx_shockwave_ring`, etc.
  - `activateParticle` + `update` advances `frameCount: 14` particles across frames `0 -> 7 -> 13` as `age / ttl` progresses and preserves crisp flipbook alpha (`>= 0.9 * startAlpha` before `88%` progress, zero linear fog-fade) before deactivating cleanly at `age >= ttl`.
  - `CombatFxManager.spawnShaderNova`, `spawnShaderSlash`, and `spawnShaderCone` compute exact `1:1` isotropic scales (`scaleRatioY = ±1`), respect `teammateFxOpacity`, and keep `depth < 60`.
  - `spawnExplosionBurst`, `spawnMeleeSlash`, `spawnMuzzleFlashAndCasing`, `spawnHitSparks`, and `spawnElementalReactionFx` spawn Chiaroscuro `fx_sh_*` flipbook slots alongside crisp radial/directional spark needles.
- [ ] **Step 2: Run Vitest on `topdown-shader-vfx-spawners.test.ts` and confirm RED**
- [ ] **Step 3: Implement flipbook playback in `combat-fx-pools.ts` and upgrade spawners in `combat-fx-spawners.ts` & `combat-fx.ts`**
- [ ] **Step 4: Run Vitest (`topdown-shader-vfx-spawners.test.ts` & `polish-p10b-fx-elemental-ambient.test.ts`) and confirm GREEN**

---

### Task 3: `depth: 16` `groundHazardGraphics` + All 18 Weapons (`V2`, `P1A`, `P1B`) & Alert Decluttering

**Files:**
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-v2.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1a.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1a-entities.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1b.ts`
- Modify: `apps/client/test/ap2-p1a-weapons-vfx-audio.test.ts`
- Modify: `apps/client/test/ap2-p1b-weapons-fx.test.ts`

- [ ] **Step 1: Update/add failing tests in `ap2-p1a-weapons-vfx-audio.test.ts` and `ap2-p1b-weapons-fx.test.ts`**
  Verify:
  - Batch-1 (`P1A`) and Batch-2 (`P1B`) weapon spawners trigger Chiaroscuro Shader flipbook calls (`spawnShaderNova`, `spawnShaderSlash`, `spawnShaderCone`) when available on `fx`, render perimeter-weighted `1:1` floor hazards (`fillAlpha <= 0.08`) onto `groundHazardGraphics` (`depth: 16`, falling back to `telegraphGraphics` when omitted), and emit **zero** spammy weapon `spawnFloatingAlert` shouts.
- [ ] **Step 2: Run Vitest on `ap2-p1a-weapons-vfx-audio.test.ts` and `ap2-p1b-weapons-fx.test.ts` and confirm RED**
- [ ] **Step 3: Implement `groundHazardGraphics` (`depth: 16`) in `GameScene.ts` + `telegraphs-and-overlays.ts`, overhaul `combat-fx-weapons-v2.ts`, `combat-fx-weapons-p1a*.ts`, `combat-fx-weapons-p1b.ts`, and deduplicate `sim-events.ts`**
- [ ] **Step 4: Run Vitest across `ap2-p0b`, `ap2-p1a`, `ap2-p1b` and confirm GREEN**

---

### Task 4: Tactical Props (`P1C`), Blessings/Skills (`P1D`), Pacts (`P2B`), Enemy/Boss Telegraphs (`P3A`/`P3B`), and Mutators & Duo Boons (`P4A`/`P4B`)

**Files:**
- Modify: `apps/client/src/fx/combat-fx-p1c.ts`
- Modify: `apps/client/src/fx/combat-fx-blessings-p1d.ts`
- Modify: `apps/client/src/fx/combat-fx-p2b.ts`
- Modify: `apps/client/src/fx/combat-fx-p3a.ts`
- Modify: `apps/client/src/fx/combat-fx-p4a.ts`
- Modify: `apps/client/src/fx/combat-fx-p4b.ts`
- Modify: `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`
- Test: `apps/client/test/ap2-p1c-props-fx.test.ts`, `apps/client/test/ap2-p1d-blessing-ui-fx.test.ts`, `apps/client/test/ap2-p4b-duo-ui-fx.test.ts`

- [ ] **Step 1: Add failing assertions for Chiaroscuro shader dispatch, `depth: 16` floor hazard routing, `< 0.08` floor fill opacity, deterministic `visualFreeze` rendering, and preserved `'SUPPLY DROP!'` alert**
- [ ] **Step 2: Run Vitest on `ap2-p1c`, `ap2-p1d`, `ap2-p4b` tests and confirm RED**
- [ ] **Step 3: Overhaul `P1C`, `P1D`, `P2B`, `P3A` + `telegraphs-and-overlays.ts`, `P4A`, and `P4B` to Chiaroscuro shader bursts, `depth: 16` `1:1` perimeter floor zones & `#E84545` serrated enemy danger telegraphs, and dark-shear-core energy tethers**
- [ ] **Step 4: Run full `pnpm test`, `pnpm typecheck`, and `pnpm lint` and confirm 100% GREEN**

---

### Task 5: Real-Image Visual Verification (`pnpm shots` + `read_file`), Build/Perf Gates & Whole-Branch Code Review

**Files:**
- Inspect via `read_file`: Captured PNG hero & multi-frame strip images under `docs/screenshots/` vs `docs/screenshots/ap2-p5/final/`
- Create: Walkthrough artifact with embedded Before/After in-game PNG comparisons

- [ ] **Step 1: Capture real in-game WebGL screenshots & animated strips via `pnpm shots` across core FX, 4P co-op (`b1-combat-4p`, `stress-4p`), Batch-1 & Batch-2 weapons, tactical props, skills, boss telegraphs, and Duo Boons**
- [ ] **Step 2: Open and inspect every captured PNG via `read_file` — verify `1:1` circularity, `360°` directional fidelity, Chiaroscuro dark veins, hollow centers, `depth: 16` entity visibility, and `depth: 60` red enemy bullet salience; fix & re-capture if any visual flaw is spotted**
- [ ] **Step 3: Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` — confirm 100% pass**
- [ ] **Step 4: Dispatch fresh whole-branch code-review subagent, address any findings via TDD, clean temporary screenshot outputs, and present Vietnamese visual walkthrough**
