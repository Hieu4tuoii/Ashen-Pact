# Commercial-Grade Diverse Signature VFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline continuous execution authorized by user) and superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate VFX silhouette repetition across *Ashen Pact* by expanding the Chiaroscuro GLSL shader flipbook baker from 14 to 24 bespoke morphologies and wiring signature per-weapon, per-class-skill, per-elemental-reaction, and per-interaction choreography.

**Architecture:** Compile 5 parallel offscreen WebGL1 fragment shader families at boot (`texture-baker-shader-fx.ts`) to bake 24 `7×2` (`14`-frame) `BlendMode.NORMAL` Chiaroscuro sprite sheets with `#141019` obsidian contours and `1:1` hitbox scaling, then immediately release the GL context. Route all 18 weapons (muzzle profiles + melee morphologies + specials), 5 character class active skills/summons (`combat-fx-classes.ts`), 6 elemental reactions, and tactical world/boss events to distinct shader archetypes + zero-allocation `Graphics` (`groundHazardGraphics` at `depth: 16`, `telegraphGraphics` below `depth: 60`).

**Tech Stack:** TypeScript, Phaser 3 (`CanvasTexture`, `Graphics`, `Sprite`), WebGL1 GLSL ES 1.00, Vitest, Playwright Chromium WebGL1 (`pnpm shots`).

**Spec:** `docs/superpowers/specs/2026-11-01-commercial-diverse-vfx-design.md`

## Global Constraints

- `1:1` Euclidean top-down scaling (`SHADER_CANONICAL_HITBOX_P = 0.78`, `SHADER_CANONICAL_NORM_SCALE = 0.43`, `0%` `3/4` Y-squash on circular AoEs).
- All 24 `fx_sh_*` flipbooks MUST render with `BlendMode.NORMAL` at `44 <= depth < 60`; enemy bullets (`#E84545`, `depth: 60`) MUST remain strictly on top.
- Persistent ground zones/auras MUST draw on `groundHazardGraphics` (`depth: 16`) with interior fill alpha `<= 0.08`.
- Strict GLSL ES 1.00 compliance: loop-free FBM, safe `invSmooth(hi, lo, x)` helper (`edge0 < edge1`), parallel compile/link before querying status, and mandatory `WEBGL_lose_context` cleanup in `finally`.
- Zero per-frame heap allocations in hot `update` / `renderTelegraphsAndShieldImpl` loops and 100% deterministic `visualFreeze` / `pnpm shots` compatibility.

## Review Focus

1. **Non-ballistic weapons ejecting brass casings**: `apprentice_staff`, `thorn_staff`, `solar_archon_staff`, `tether_staff`, `void_staff`, `seed_gun`, `hunter_crossbow`, `gale_smg`, `tesla_carbine`, and `focus_laser` must NOT spawn `fx_shell_casing` when `weaponId` is supplied, while `rivet_gun`, `scrap_shotgun`, and `frag_launcher` MUST still spawn `fx_shell_casing` (and legacy callers omitting `weaponId` remain backward-compatible).
2. **Directional `+X` scale math for new directional strips**: `computeShaderDirectionalScale` must accurately map `fx_sh_aegis_crest`, `fx_sh_falcon_sonic`, and `fx_sh_muzzle_arcane` so world reach matches `1:1` pixel expectations across `bakeScale` `4 / 6 / 8`.
3. **WebGL1 context cleanup with 5 shader programs**: Both normal bake completion and partial shader link failure must delete all 5 programs/shaders and invoke `WEBGL_lose_context`.
4. **6 Elemental Reactions distinctness**: `vaporize`, `shatter`, `superconduct`, `toxic_blast`, `paralysis`, and `overload` must each dispatch their own distinct `ShaderRadialKey` (no two reactions sharing identical texture + tint).
5. **Headless / partial mock `fx` compatibility in existing unit tests**: Scene helpers calling `fx?.spawnShaderDirectional?.(...)` or `fx?.spawnShaderNova?.(...)` must use optional chaining or fallback gracefully when unit tests pass partial mock `fx` objects.

---

### Task 1: Expand Chiaroscuro GLSL Shader Baker (`14 -> 24` Morphologies & 4 Bespoke Melee Slash Geometries)

**Files:**
- Modify: `apps/client/src/art/texture-baker-shader-fx.ts`
- Test: `apps/client/test/topdown-shader-vfx-baker.test.ts`

**Interfaces:**
- Produces:
  - `SHADER_FX_TEXTURE_KEYS` (24 keys)
  - `ShaderFxTextureKey`, `ShaderNovaKey` (12 radial keys: `fx_sh_nova_solar | fx_sh_nova_magma | fx_sh_nova_thunder | fx_sh_nova_cryo | fx_sh_nova_venom | fx_sh_nova_void | fx_sh_vortex_gale | fx_sh_bloom_briar | fx_sh_spore_cloud | fx_sh_anvil_storm | fx_sh_geyser_plume | fx_sh_shrapnel_corona | fx_sh_arcane_sigil` -> 13 radial keys!), `ShaderSlashKey`, `ShaderDirectionalKey` (`ShaderSlashKey | 'fx_sh_cone_blast' | 'fx_sh_beam_lance' | 'fx_sh_muzzle_burst' | 'fx_sh_hit_spark' | 'fx_sh_aegis_crest' | 'fx_sh_falcon_sonic' | 'fx_sh_muzzle_arcane'`)

- [ ] **Step 1: Write failing tests in `apps/client/test/topdown-shader-vfx-baker.test.ts`**
  Assert `SHADER_FX_TEXTURE_KEYS` contains all 24 keys, `bakeShaderVfxFlipbooks` registers 24 `7×2` canvas textures (`192 / 288 / 384px`, `<= 2688×768`), `computeShaderNovaScale` and `computeShaderDirectionalScale` map all new radial & directional keys `1:1` across `bakeScale` `4, 6, 8`, and WebGL1 cleanup deletes all 5 compiled programs and calls `loseContext`.
- [ ] **Step 2: Run baker unit test to verify RED**
  Run: `pnpm --filter @ashen-pact/client test -- topdown-shader-vfx-baker.test.ts`
  Expected: FAIL (`expected 14 to be 24`).
- [ ] **Step 3: Implement 4 distinct melee slash geometries (`sid 0..3`) and 10 new shader archetypes (`sid 14..23`) in `apps/client/src/art/texture-baker-shader-fx.ts`**
  Add `FRAG_ARCHETYPE_NATURE_WIND_SRC` (`sid 14..18`: `vfxVortexGale`, `vfxBloomBriar`, `vfxSporeCloud`, `vfxAnvilStorm`, `vfxGeyserPlume`) and `FRAG_ARCHETYPE_TACTICAL_CLASS_SRC` (`sid 19..23`: `vfxShrapnelCorona`, `vfxAegisCrest`, `vfxFalconSonic`, `vfxArcaneSigil`, `vfxMuzzleArcane`), upgrade `vfxSlash` variants `0..3` into 4 distinct blade silhouettes, update `drawFallback2DStrip` and 5-program parallel WebGL baker.
- [ ] **Step 4: Run baker unit test to verify GREEN**
  Run: `pnpm --filter @ashen-pact/client test -- topdown-shader-vfx-baker.test.ts`
  Expected: PASS.

---

### Task 2: Weapon-Family Muzzle Profiles, Directional Archetype Spawner & 6 Distinct Elemental Reactions

**Files:**
- Modify: `apps/client/src/fx/combat-fx-spawners.ts`
- Modify: `apps/client/src/fx/combat-fx.ts`
- Test: `apps/client/test/topdown-shader-vfx-spawners.test.ts`

**Interfaces:**
- Consumes: `ShaderNovaKey`, `ShaderDirectionalKey`, `computeShaderDirectionalScale` from Task 1.
- Produces:
  - `resolveWeaponMuzzleProfile(weaponId?: string, isShotgun?: boolean): WeaponMuzzleProfile`
  - `CombatFxManager.prototype.spawnShaderDirectional(x, y, reachPx, angleRad, key, options?)`
  - `CombatFxManager.prototype.spawnMuzzleFlashAndCasing(x, y, angleRad, isShotgun?, isTeammate?, weaponId?)`
  - 6-way distinct `REACTION_NOVA_KEY` & dual-layer choreography in `spawnElementalReactionFxImpl`

- [x] **Step 1: Write failing tests in `apps/client/test/topdown-shader-vfx-spawners.test.ts`**
  Assert: (a) all 24 `fx_sh_*` keys resolve to `BlendMode.NORMAL` and `44 <= depth < 60`; (b) `resolveWeaponMuzzleProfile` & `spawnMuzzleFlashAndCasing` eject `fx_shell_casing` + `fx_sh_muzzle_burst` for ballistic guns (`rivet_gun`, `scrap_shotgun`, `frag_launcher`), while staves/bows/wind/bio/electro (`solar_archon_staff`, `hunter_crossbow`, `gale_smg`, `seed_gun`, `tesla_carbine`) use `fx_sh_muzzle_arcane` with element-matched tint and ZERO `fx_shell_casing`; (c) `spawnShaderDirectional` spawns `fx_sh_aegis_crest` and `fx_sh_falcon_sonic` at exact `1:1` reach and angle; (d) all 6 `ElementalReactionId`s (`vaporize`, `shatter`, `superconduct`, `toxic_blast`, `paralysis`, `overload`) spawn 6 distinct texture/tint combinations.
- [x] **Step 2: Run spawners unit test to verify RED**
  Run: `pnpm --filter @ashen-pact/client test -- topdown-shader-vfx-spawners.test.ts`
  Expected: FAIL on missing `resolveWeaponMuzzleProfile` / `spawnShaderDirectional` / duplicate reaction nova keys.
- [x] **Step 3: Implement muzzle profiles, `spawnShaderDirectional`, combo-finisher melee flourishes, and 6 distinct elemental reactions in `combat-fx-spawners.ts` & `combat-fx.ts`**
- [x] **Step 4: Run spawners unit test to verify GREEN**
  Run: `pnpm --filter @ashen-pact/client test -- topdown-shader-vfx-spawners.test.ts`
  Expected: PASS.

---

### Task 3: Remap All 18 Weapons' Specials, Tactical Props & Blessings to Bespoke Morphologies (P1A, P1B, P1C, P1D, V2)

**Files:**
- Modify: `apps/client/src/fx/combat-fx-weapons-p1a.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1b.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-v2.ts`
- Modify: `apps/client/src/fx/combat-fx-p1c.ts`
- Modify: `apps/client/src/fx/combat-fx-blessings-p1d.ts`
- Test: `apps/client/test/ap2-p1a-weapons-vfx-audio.test.ts`
- Test: `apps/client/test/ap2-p1b-weapons-fx.test.ts`
- Test: `apps/client/test/ap2-p1c-props-fx.test.ts`
- Test: `apps/client/test/ap2-p1d-blessing-ui-fx.test.ts`

**Interfaces:**
- Consumes: 24 `ShaderNovaKey` / `ShaderDirectionalKey` & `spawnShaderDirectional` from Tasks 1–2.

- [x] **Step 1: Update & add failing assertions in `ap2-p1a-weapons-vfx-audio.test.ts`, `ap2-p1b-weapons-fx.test.ts`, `ap2-p1c-props-fx.test.ts`, and `ap2-p1d-blessing-ui-fx.test.ts`**
  Pin distinct archetype keys: `thorn_bloom` & `seed_gun` -> `fx_sh_bloom_briar`; `gale_smg` cyclone -> `fx_sh_vortex_gale`; `frag_launcher` airburst -> `fx_sh_shrapnel_corona`; `tether_staff` EM yank -> `fx_sh_anvil_storm`; `crossbow_rip` -> `fx_sh_falcon_sonic`; `berserker_guillotine_slam` & `magma_geyser_eruption` -> `fx_sh_geyser_plume`; `solar_converge_burst` -> `fx_sh_arcane_sigil`; `solar_supernova` -> `fx_sh_nova_solar`; `thunder_hammer_pillar` -> `fx_sh_anvil_storm`; `pneumatic_press` & `slag_crucible` -> `fx_sh_geyser_plume`; `table_tech_rocket` & `reload_tediore_chuck` & `bullet_ricochet_boom` -> `fx_sh_shrapnel_corona`; `reload_magnet_vortex` -> `fx_sh_vortex_gale`; `ranger_arrow_wall_blast` -> `fx_sh_spore_cloud`.
- [x] **Step 2: Run the 4 weapon/prop/blessing test suites to verify RED**
  Run: `pnpm --filter @ashen-pact/client test -- ap2-p1a-weapons-vfx-audio.test.ts ap2-p1b-weapons-fx.test.ts ap2-p1c-props-fx.test.ts ap2-p1d-blessing-ui-fx.test.ts`
  Expected: FAIL on old generic `fx_sh_nova_*` expectations.
- [x] **Step 3: Upgrade shader dispatches and Chiaroscuro transient vector details across `combat-fx-weapons-p1a.ts`, `combat-fx-weapons-p1b.ts`, `combat-fx-weapons-v2.ts`, `combat-fx-p1c.ts`, and `combat-fx-blessings-p1d.ts`**
  Enhance transient shapes (6-petal lotus on `seed_harvest_bloom`, hooked briars on `thorn_bloom_burst`, logarithmic wind blades on `gale_cyclone_vortex`, `#141019`-cased warheads on `frag_airburst_ring`, 8-point solar crown on `solar_supernova_blast`, jagged basalt teeth on `berserker_guillotine_slam`, anvil cross-sigil on `thunder_pillar_strike`, tri-element braided beam + `fx_sh_arcane_sigil` on `spawnTriElementalBeamVfx`, `fx_sh_aegis_crest` on `knight_sword` parry & `cover_flipped`, `fx_sh_vortex_gale` on `tactical_vent` & `ring_out`, `fx_sh_geyser_plume` on `wall_slam`).
- [x] **Step 4: Run the 4 test suites to verify GREEN**
  Run: `pnpm --filter @ashen-pact/client test -- ap2-p1a-weapons-vfx-audio.test.ts ap2-p1b-weapons-fx.test.ts ap2-p1c-props-fx.test.ts ap2-p1d-blessing-ui-fx.test.ts`
  Expected: PASS.

---

### Task 4: Bespoke VFX for All 5 Character Class Skills, Summons & Dramatic World/Boss Events

**Files:**
- Create: `apps/client/src/fx/combat-fx-classes.ts`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Modify: `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`
- Create: `apps/client/test/commercial-class-and-interaction-vfx.test.ts`

**Interfaces:**
- Consumes: `CombatFxManager` (`spawnShaderNova`, `spawnShaderDirectional`, `spawnShaderCone`, `spawnMuzzleFlashAndCasing`, `spawnChainLightningArc`, `spawnHitSparks`), `getWeaponV2OverlayState`.
- Produces:
  - `spawnClassSkillCastVfx(scene, fx, characterId, x, y, angleRad, activeElement?, isTeammate?)`
  - `spawnClassSummonSpawnedVfx(scene, fx, summonKind, x, y)`
  - `drawVanguardRubyPhalanxShield(g, px, py, aimAngle, isBastionPrism, storedBullets, clockSec)`
  - `drawInscribedElementalistZone(floorG, g, zone, tick)`
  - `drawSacredTreeChiaroscuro(floorG, g, summon, tick)`
  - `drawEngineerTurretChiaroscuro(floorG, g, summon, nowMs)`

- [x] **Step 1: Write failing unit tests in `apps/client/test/commercial-class-and-interaction-vfx.test.ts`**
  Test: (a) all 5 `characterId`s (`vanguard`, `ranger`, `elementalist`, `druid`, `engineer`) dispatch 5 distinct shader archetypes & transient lights on `skill_cast`; (b) `shield_shockwave` dispatches directional `fx_sh_aegis_crest` + `fx_sh_cone_blast`; (c) `summon_spawned` dispatches `fx_sh_bloom_briar` for `sacred_tree` and `fx_sh_anvil_storm` for `tesla_turret`; (d) `emp_blast` dispatches `fx_sh_anvil_storm` + radial lightning arcs; (e) `processSimEventsImpl` passes `ev.weaponId` to `spawnMuzzleFlashAndCasing`, triggers `fx_sh_falcon_sonic` on charged `hunter_crossbow` shots, routes `explosive_barrel` to `fx_sh_shrapnel_corona` and `caustic_spore_pod` to `fx_sh_spore_cloud`, and spawns signature shaders on `shrine_blessing`, `player_revived`, `armor_broken`, `boss_phase_changed`, and `boss_enraged`; (f) upgraded class world overlays enforce `<= 0.06` floor fill on `groundHazardGraphics`.
- [x] **Step 2: Run new class & interaction test suite to verify RED**
  Run: `pnpm --filter @ashen-pact/client test -- commercial-class-and-interaction-vfx.test.ts`
  Expected: FAIL (`Cannot find module '../src/fx/combat-fx-classes.js'`).
- [x] **Step 3: Implement `apps/client/src/fx/combat-fx-classes.ts` and wire into `sim-events.ts` & `telegraphs-and-overlays.ts`**
- [x] **Step 4: Run test suite to verify GREEN**
  Run: `pnpm --filter @ashen-pact/client test -- commercial-class-and-interaction-vfx.test.ts`
  Expected: PASS.

---

### Task 5: Independent Whole-Branch Review, Full Monorepo Quality Gates, Real WebGL1 `pnpm shots` Verification & Showcase Update

**Files:**
- Modify: `C:\Users\ADMIN\.gemini\antigravity\brain\ad836915-c208-40da-abcc-42de665b1bbd\ashen-pact-14-shaders-after-live.html`
- Modify: `C:\Users\ADMIN\.gemini\antigravity\brain\ad836915-c208-40da-abcc-42de665b1bbd\ashen-pact-all-vfx-after-showcase.md`

- [x] **Step 1: Run full workspace unit test, typecheck, lint & build pre-review check**
  Run: `pnpm typecheck; if ($LASTEXITCODE -eq 0) { pnpm lint }; if ($LASTEXITCODE -eq 0) { pnpm test }; if ($LASTEXITCODE -eq 0) { pnpm build }`
  Expected: Exit 0 across all packages.
- [x] **Step 2: Dispatch fresh Whole-Branch Code Reviewer subagent (`invoke_subagent`)**
  Verify spec compliance, GLSL ES 1.00 safety, zero-allocation hot loops, `1:1` hitbox fidelity, and `depth < 60` enemy bullet readability; fix any Critical/Important findings via RED->GREEN TDD.
- [x] **Step 3: Run real Chromium WebGL1 `pnpm shots` across weapon, class, reaction, prop, boss & 4P stress scenes**
  Visually inspect rendered `.png` screenshots via `read_file`, copy updated PNGs into `vfx-after/`, and update both the interactive 24-shader live gallery HTML and the comprehensive markdown showcase artifact.
