# Cutout 2.0 Combat VFX & Biome 2 Ice Mirror Overhaul — Master Design Specification

**Date:** 2026-11-15  
**Status:** Approved  
**Selected Architecture:** Hướng 2 — POT Multi-Band SDF-Cel GLSL Baker (`4×2` POT, `< 25.0 MB` VRAM) + Hybrid `60Hz` Cutout Perimeter (`depth 26.6`) + Zero-Alloc Pointed Scalar Quad-Strip + `512×512` Cutout 2.0 Kit + Biome 2 Full Mirror & Bullet-Split Removal (`Track A-Clean` + `Track B-Gameplay+Visual` + `Track C`)

---

## 1. Intent & Why

Currently, *Ashen Pact*'s combat and environmental visual effects suffer from severe visual clutter ("rối mắt") while simultaneously looking rough and inconsistent ("to, rộng nhưng làm sơ sài") against the game's crisp **Cutout 2.0 (`#141019` `INK_DARK`)** character and world art:

1. **Art-Style & VRAM Breakdown:** `texture-baker-shader-fx.ts` bakes 24 `7×2` (`14-frame`) sprite sheets using blurry `warpedFbm` clouds without `#141019` ink outlines, inflates quad bounds to `2.98×` true hitbox radius, and consumes **`154.31 MB` VRAM** (`164.80 MB` total game VRAM vs. the `< 25.0 MB` budget).
2. **Z-Depth Inversion & Additive Washout:** Player explosions render at `depth 56` (`alpha = 0.98`) on top of players (`30`), enemies (`28`), and Bosses (`31`). Player bullets force `BlendMode.ADD`, erasing their baked `#141019` ink borders and turning 4-player Co-op volleys into white confetti.
3. **Wireframe Circle Soup & Duplicate Triggers:** Hundreds of per-frame `Graphics.strokeCircle` / `lineBetween` calls draw AutoCAD-like rings (`Ø 200–440px`), 6 summons render as unshaded primitives at `depth 38`, every bullet impact triggers `spawnHitSparks` twice, enemy sightlines render twice at diverging angles, `lightmapRt` `whiteWeight = 0.68` washes out ~94% of colored lighting, and 14 subsystems ignore `teammateFxOpacity`.
4. **Biome 2 ("Hầm Băng Vĩnh Cửu") Mirror Glare & Chaotic Bullet-Split Clutter:** Biome 2 overlays 2–3 huge blurry `-45°` `arch_b2_godray_shaft` additive trapezoids (`depth 35.2`), paints bright mirror-sheen slabs + per-frame blinking `0xe0f2fe` glints on every `'ice'` tile, and uses shiny mirror/prism pillars (`cryo_prism_pillar` & `crystal_pillar`) that split bullets/beams 3 ways and bounce Boss lasers unpredictably — flooding the screen with stray projectiles.

**User Mandate:** Redesign all VFX systems (weapons, projectiles, hit feedback, status effects, tactical props, world interactions, class skills, summons, elemental reactions, blessings/pacts/mutators/duo boons, Boss beats, lighting, floating text, 4P Co-op suppression) to prioritize **compact, intricate, high-craft Cutout 2.0 detail ("nhỏ, chi tiết, đẹp và chỉnh chu")** inspired by *Cult of the Lamb*, *Hades / Hades II*, *Enter the Gungeon*, *Wizard of Legend*, and *Curse of the Dead Gods*, **and completely remove both the mirror glare layers and the chaotic pillar bullet-splitting/deflecting mechanics in Map Băng (Biome 2)**.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- Cut total game GPU texture VRAM from `164.800 MB` down to **`24,816,244 B = 24.816 MB` (`23.667 MiB`) `< 25.000 MB`**, 100% Power-Of-Two (POT) for all new/refactored atlases, with GPU boot bake time **`~18–26 ms << 80 ms`**.
- Enforce a mathematical `#141019` world-space ink border invariant **`worldInkPx ∈ [1.500 px, 2.200 px]`** across all radial bursts (`R ∈ [10, 180] px`) and directional slashes/cones/lances (`reach ∈ [14, 180] px`) via `routeCutoutBurstByRadius` and `routeCutoutDirectionalByReach`.
- Guarantee **`1:1` Euclidean hitbox honesty** (`0.0 px` center or radius drift) at physics center `(x, y)` for every gameplay AoE, weapon reach, aura, summon zone, and Boss telegraph, while keeping actors readable above floor shockwaves (`depth 26.4 / 26.6 < 28.0`) and enemy `#E84545` bullets inviolable at `depth 60.0`.
- Craft bespoke silhouettes and micro-choreography for all **18 weapons**, **5 class skills**, **6 Cutout summons (`depth 28.4–28.6`)**, **4 peripheral shoulder status attachments (`depth 28.2`)**, **6 elemental reaction mini-strips (`256×64` POT)**, **tactical props & 4 material shard types**, **7 Boss combat beats**, and **unified 4P Co-op ally suppression (`resolveAllyFxProfile` + `18px` P1 Safe-Halo)**.
- **Biome 2 Ice Map Overhaul:** Delete `arch_b2_godray_shaft` (`-107,520 B` VRAM) and per-frame `'ice'` glints; replace mirror-sheen `'ice'` tiles with matte **Packed Frosted Rime-Glacier (`#31627D` / `#2C5E7A` / `#1E3A5F` / `#6BA6C2`)**; replace 3-way bullet-splitting `cryo_prism_pillar` with **`Cryo Tuning Obelisk`** (`r = 72px` enemy-only Chill shock-ring, `0` bullet split) and laser-reflecting `crystal_pillar` with **`Permafrost Bastion Pillar`** (solid beam/bullet blocker across server & client prediction); update `kryssa_clone` to **Frost Mirage (`alpha = 0.76`)**.

### Non-Goals
- Altering player opt-in Blessing/Mutator gameplay mechanics outside Biome 2 environmental pillars (`table_tech_prism_split`, `bullet_split_bounce`, `mutator_prism_splitter` retain their `WorldSim` mechanics, with their noisy wireframe circles cleaned up in `combat-fx-blessings-p1d.ts` / `combat-fx-p4a.ts`).
- Changing weapon DPS, enemy HP/speed, room layouts, or `BIOME_SCALING` numbers outside the approved Biome 2 `cryo_prism_pillar` / `crystal_pillar` mechanic replacement.
- Introducing external PNG sprite assets or third-party runtime shader libraries.

### Anti-Goals (Hard Failure Conditions)
- Any `WorldSim` collision zone rendered at foot offset `(x, y + 12)` or squashed `2.12 : 1` instead of `1:1` at `(x, y)`.
- Any `Curve.getPoints()`, `Graphics.fillPoints()` (`Earcut`), per-frame `.filter()`, `text.getBounds()`, or `Math.random()` inside deterministic render/VFX loops.
- Any blurry `warpedFbm` cloud without `#141019` cel-ink border, `BlendMode.ADD` on player projectile bodies, `pow(0.0, y)` `NaN` on D3D11 ANGLE, or leaked Canvas2D `ctx.save()` state.
- Exceeding `25.000 MB` (`25,000,000 B`) total VRAM or `80 ms` boot bake time, or breaking any of the 5 `Animation Verification Engine` gates (`Gate 1..5` — with `Gate 2` intentionally updated only for the Biome 2 `ap2-b2-prism-refract` scene where the user explicitly removed bullet-splitting).

---

## 3. Approaches Considered & User Decisions

1. **Hướng 1 — Pure 2D CPU Canvas Cel-Vector Flipbooks (Rejected):** Matches `CutoutRig` ink style, but baking 24 multi-frame procedural sheets on single-threaded JS CPU takes `190–340 ms` (failing the `< 80 ms` boot gate).
2. **Hướng 2 — POT Multi-Band SDF-Cel GLSL + Hybrid `60Hz` Cutout Perimeter + Pointed Scalar Quad-Strip + `512×512` Cutout Kit (Selected):** Rewrites the offscreen WebGL1 fragment shaders around exact Euclidean SDFs (`|\nabla d| === 1.0`) + quantized `PALETTE` cel-ramps + `#141019` ink borders on `4×2` POT sheets (`18–26 ms` GPU bake, `24.816 MB` total VRAM), pairs `50 ms` hollow-core `8f` impacts with smooth `60Hz` `depth 26.6` perimeter crescents, and bakes static/2f/4f Cutout sprites into a `512×512` POT kit.
3. **Hướng 3 — Conservative Scale/Alpha Tuning Only (Rejected):** Leaves `164.8 MB` VRAM untouched and turns bright FBM blobs into muddy gray smudges while keeping wireframe circles.
4. **Biome 2 Ice Mirror Scope (User Decision Locked):**
   - **Surface & Screen Mirror Glare (`Track A-Clean`):** Approved — remove `arch_b2_godray_shaft` and per-frame `'ice'` glints; replace mirror-sheen `'ice'` tiles & ice prop slashes with matte Cutout rime-glacier.
   - **Biome 2 Prism/Mirror Pillars (`Track B-Gameplay+Visual`):** User explicitly selected **removing the bullet-splitting/deflecting mechanic** (*"Bỏ cơ chế chẻ đạn vì nó gây đạn bay loạn xạ rối mắt"*), locking in `Cryo Tuning Obelisk` (`r = 72px` Chill pulse, `0` split bullets) and `Permafrost Bastion Pillar` (solid cover severing lasers & stopping bullets).

---

## 4. Architecture, VRAM Proof, Z-Depth, GLSL & Ribbon Primitives

### 4.1. `SHADER_STRIP_CATALOG` (`24` POT `4×2` Keys) & `[1.50px, 2.20px]` Ink Border Proof

All 24 keys in `SHADER_FX_TEXTURE_KEYS` (`apps/client/src/art/texture-baker-shader-fx.ts`) keep their exact key names and default `origin(0.5, 0.5)` on a **`4 columns × 2 rows = 8 frames`** POT grid with `NORM_SCALE = 0.50`, `HITBOX_P = 0.82`:
- `SHADER_CANONICAL_HITBOX_RADIUS_RATIO = 0.4100` (`R_0 = 0.41 * framePx`)
- `SHADER_CANONICAL_LANCE_SPAN_RATIO = 0.8200` (`L_0 = 0.82 * framePx`)
- **`small` (`7` keys):** `framePx = 64` $\rightarrow$ **`256 × 128` POT** (`131,072 B` + `43,692 B` mipmap; `gl.generateMipmap` + `gl.LINEAR_MIPMAP_LINEAR` enabled on WebGL1). `R_0 = 26.24 px`, `L_0 = 52.48 px`.
- **`medium` (`15` keys):** `framePx = 128` $\rightarrow$ **`512 × 256` POT** (`524,288 B`; `gl.LINEAR`, scale-band router enforces `scale >= 0.819×`). `R_0 = 52.48 px`, `L_0 = 104.96 px`.
- **`large` (`2` keys):** `framePx = 256` $\rightarrow$ **`1024 × 512` POT** (`2,097,152 B`; `gl.LINEAR`, `scale >= 0.857×`). `R_0 = 104.96 px`.

| # | Texture Key (`key`) | `shaderId` | `elemId` | POT Class (`framePx` → Atlas) | `denom_k` | `validRadiusBandPx` `[R_min, R_max]` | `scale` `[S_min, S_max]` | `canonicalInkTexels` | World `#141019` Ink `worldInkPx` |
| :-: | :--- | :-: | :-: | :--- | :-: | :-: | :-: | :-: | :-: |
| 1 | `fx_sh_muzzle_burst` | `6` | `0` | `small` (`64` → `256×128`) | `26.24 px` | `[17.0, 24.5] px` | `[0.648, 0.934]` | `2.34` | `[1.52, 2.19] px` |
| 2 | `fx_sh_muzzle_arcane` | `23` | `0` | `small` (`64` → `256×128`) | `26.24 px` | `[17.0, 24.5] px` | `[0.648, 0.934]` | `2.34` | `[1.52, 2.19] px` |
| 3 | `fx_sh_hit_spark` | `7` | `0` | `small` (`64` → `256×128`) | `26.24 px` | `[17.0, 24.5] px` | `[0.648, 0.934]` | `2.34` | `[1.52, 2.19] px` |
| 4 | `fx_sh_aegis_crest` | `20` | `0` *(Neutral)* | `small` (`64` → `256×128`) | `26.24 px` | `[22.0, 32.0] px` | `[0.838, 1.220]` | `1.80` | `[1.51, 2.20] px` |
| 5 | `fx_sh_falcon_sonic` | `21` | `1` | `small` (`64` → `256×128`) | `26.24 px` | `[22.0, 32.0] px` | `[0.838, 1.220]` | `1.80` | `[1.51, 2.20] px` |
| 6 | `fx_sh_arcane_sigil` | `22` | `0` | `small` (`64` → `256×128`) | `26.24 px` | `[26.0, 38.0] px` | `[0.991, 1.448]` | `1.52` | `[1.51, 2.20] px` |
| 7 | `fx_sh_cone_blast` | `4` | `2` | `small` (`64` → `256×128`) | `52.48 px` *(Lance)* | `[48.0, 70.0] px` | `[0.915, 1.334]` | `1.64` | `[1.50, 2.19] px` |
| 8 | `fx_sh_slash_steel` | `0` | `0` | `medium` (`128` → `512×256`) | `52.48 px` | `[54.0, 78.0] px` | `[1.029, 1.486]` | `1.48` | `[1.52, 2.20] px` |
| 9 | `fx_sh_slash_emerald` | `1` | `1` | `medium` (`128` → `512×256`) | `52.48 px` | **`[63.0, 92.2] px`** | `[1.200, 1.757]` | **`1.25`** | **`[1.50, 2.20] px`** *(92px → 2.191px)* |
| 10 | `fx_sh_slash_crimson` | `2` | `3` | `medium` (`128` → `512×256`) | `52.48 px` | `[54.0, 78.0] px` | `[1.029, 1.486]` | `1.48` | `[1.52, 2.20] px` |
| 11 | `fx_sh_slash_thunder` | `3` | `4` | `medium` (`128` → `512×256`) | `52.48 px` | `[54.0, 78.0] px` | `[1.029, 1.486]` | `1.48` | `[1.52, 2.20] px` |
| 12 | `fx_sh_beam_lance` | `5` | `2` | `medium` (`128` → `512×256`) | `104.96 px` *(Lance)* | `[86.0, 126.0] px` | `[0.819, 1.200]` | `1.83` | `[1.50, 2.20] px` |
| 13–22 | `fx_sh_nova_magma` (`9`,`3`), `nova_thunder` (`10`,`4`), `nova_cryo` (`11`,`5`), `nova_venom` (`12`,`6`), `vortex_gale` (`14`,`5`), `bloom_briar` (`15`,`1`), `spore_cloud` (`16`,`6`), `anvil_storm` (`17`,`4`), `geyser_plume` (`18`,`3`), `shrapnel_corona` (`19`,`2`) | `9..19` | `1..6` | `medium` (`128` → `512×256`) | `52.48 px` | `[44.0, 64.0] px` | `[0.838, 1.220]` | `1.80` | `[1.51, 2.20] px` |
| 23 | `fx_sh_nova_solar` | `8` | `2` | `large` (`256` → `1024×512`) | `104.96 px` | `[90.0, 132.0] px` | `[0.857, 1.258]` | `1.75` | `[1.50, 2.20] px` |
| 24 | `fx_sh_nova_void` | `13` | `7` | `large` (`256` → `1024×512`) | `104.96 px` | `[90.0, 132.0] px` | `[0.857, 1.258]` | `1.75` | `[1.50, 2.20] px` |

### 4.2. Byte-Exact VRAM Ledger & `fx_cutout_kit_512` (`512×512` POT @ `kitBakeScale = 3`)

| GPU Texture Category | Dimensions & Count | Exact Bytes | MB ($10^6$ B) | MiB ($2^{20}$ B) |
| :--- | :--- | ---: | :-: | :-: |
| 1. `small` Shader Strips (`7` keys) | `7 × (256 × 128 × 4 B)` | `917,504 B` | `0.918 MB` | `0.875 MiB` |
| 2. Full Mipmap Pyramid for `7 small` Strips | `7 × 10,923 texels × 4 B` | `305,844 B` | `0.306 MB` | `0.292 MiB` |
| 3. `medium` Shader Strips (`15` keys) | `15 × (512 × 256 × 4 B)` | `7,864,320 B` | `7.864 MB` | `7.500 MiB` |
| 4. `large` Shader Strips (`2` keys) | `2 × (1024 × 512 × 4 B)` | `4,194,304 B` | `4.194 MB` | `4.000 MiB` |
| 5. Elemental Reaction Mini-Strips (`6` keys) | `6 × (256 × 64 × 4 B)` (`4f × 64×64`) | `393,216 B` | `0.393 MB` | `0.375 MiB` |
| 6. Cutout 2.0 Kit Atlas (`fx_cutout_kit_512`) | `1 × (512 × 512 × 4 B)` (`kitBakeScale = 3`, `78.56%` packed) | `1,048,576 B` | `1.049 MB` | `1.000 MiB` |
| 7. Existing Game Atlases minus `arch_b2_godray_shaft` | `10,200,000 B - 107,520 B` (`96×280×4` deleted) | `10,092,480 B` | `10.092 MB` | `9.625 MiB` |
| **GRAND TOTAL GAME VRAM** | **100% compliant `< 25.000 MB` in both MB and MiB** | **`24,816,244 B`** | **`24.816 MB`** | **`23.667 MiB`** |

**`fx_cutout_kit_512` (`512×512` POT, `kitBakeScale = 3`, `+2px` transparent padding per side, `W_tex = 3*W_world + 4`):**
1. **4 Neutral Multi-Band `4f` Bursts (`65,536` texels):** `fx_micro_burst_4f` (`R_0 = 11.0px, ink = 1.65`), `fx_small_burst_4f` (`R_0 = 16.0px, ink = 1.65`), `fx_mid_burst_4f` (`R_0 = 21.3px, ink = 1.50`), `fx_compact_burst_4f` (`R_0 = 31.2px, ink = 1.50`, drawn at `r_tex = 26.0px, ink = 1.25px` inside `64×64` frame).
2. **6 Cutout Summons / `8` Sprites (`62,024` texels):** `summon_sacred_tree` (`38×42`), `summon_tesla_base` (`28×24`), `summon_tesla_head` (`26×18`), `summon_holo_base` (`28×28`), `summon_holo_head` (`26×18`), `summon_thunder_decoy` (`28×34`), `summon_life_blossom` (`26×26`), `summon_wall_tether_pylon` (`24×28`).
3. **Heroic & Boss Kit (`29,736` texels):** `prop_cryo_spire` (`26×38`), `fx_thrown_thunder_hammer` (`28×28`), `fx_parry_winged_crest` (`32×16`), `fx_cutout_crescent` (`14×14`), `item_life_seed` (`18×20`), `fx_boss_shell_plate` (`14×8`).
4. **Aux Projectiles & Prop Attachments (`24,580` texels):** `proj_mutator_boomerang_saw` (`24×24`), `proj_dash_phase_blade` (`26×12`), `proj_cluster_mortar_lob` (`12×10`), `proj_holster_surge_bolt` (`18×8`), `proj_holo_decoy_shot` (`18×8`), `proj_gale_wind_blade` (`18×9`), `proj_relic_perpetual_rocket` (`16×8`), `proj_table_tech_rocket` (`14×7`), `proj_reload_tediore_chuck` (`14×10`), `fx_solar_mini_sun` (`12×12`), `fx_frag_fuse_wheel` (`14×14`), `prop_rocket_nozzle` (`10×6`), `prop_cryo_node` (`6×6`).
5. **Peripheral Status (`2f`), Badges, Shards & Micro-Motes (`24,060` texels):** `status_burn_2f` (`12×15`), `status_chill_2f` (`13×9`), `status_shock_2f` (`15×9`), `status_poison_2f` (`10×10`), `status_freeze_cuff` (`14×8`), `4 × status_badge_9x9` (`9×9`), `duo_rail_lock_10x10` (`10×10`), `fx_wood_shard` / `fx_ceramic_shard` / `fx_stone_chip` / `fx_ice_shard_decal` (`6×6`), `fx_rim_glint` (`6×4`), `fx_pellet_dent` (`8×6`), `fx_muzzle_thorn_barb` (`12×6`), `fx_seed_heal_wisp` (`8×8`), `fx_overheat_puff` (`6×6`), `fx_rivet_hex_head` (`8×8`). Total = `205,936 / 262,144` texels (`78.56%`, `56,208` free slack texels). Register sub-frames onto `scene.textures.get('fx_cutout_kit_512').add(frameName, 0, x, y, w, h)` (or individual frame aliases via shared atlas source) so `Sprite.setTexture('fx_cutout_kit_512', frameName)` batches into a **single WebGL1 `MultiPipeline` draw call**.

### 4.3. Scale-Band Routers, Hybrid `60Hz` Motion & `(x, y)` `1:1` Law

- **Low-level primitive preservation (`M-6a`):** `spawnShaderNova`, `spawnShaderSlash`, `spawnShaderDirectional`, `spawnShaderCone`, and `spawnShaderLance` remain direct `1:1` primitives (`startScale === endScale === computeShader*Scale(...)`). High-level gameplay spawners route through:
  - **`routeCutoutBurstByRadius(fx, x, y, worldRadiusPx, requestedKey, opts)`:**
    - If `!opts?.isTeammate && fx.distanceToLocalPlayer(x, y) <= 24.0`, sets `coreDepth = 26.4` (under P1 `30.0`), else `opts?.depth ?? 42.5`.
    - `R ∈ [rMin, rMax]`: calls `fx.spawnShaderNova(x, y, R, requestedKey, resolvedOpts)`.
    - `R < rMin`: spawns `60Hz` perimeter crescent ring (`depth 26.6`, `1.80px` ink) at `1.000 * R` + neutral `4f` burst (`fx_micro_burst_4f` `<14.6`, `fx_small_burst_4f` `<21.3`, `fx_mid_burst_4f` `<31.2`, `fx_compact_burst_4f` `<44.0`) tinted by `entry.elemId`.
    - `R > rMax`: spawns `60Hz` perimeter crescent ring (`depth 26.6`, `1.80px` ink) reaching `1.000 * R` in `50 ms` + clamps `8f` core nova at `rMax` (`ttl = 0.16s`, `worldInkPx = 2.20px`).
  - **`routeCutoutDirectionalByReach(fx, x, y, reachPx, angleRad, requestedKey, arcSpreadRad, opts)`:**
    - `reach ∈ [rMin, rMax]`: `1:1` direct directional flipbook.
    - `reach > rMax`: `60Hz` `fillTaperedArcRibbon` (`depth 26.6`, `1.80px` ink) at `1.000 * reach` + `8f` core clamped at `rMax` (`ttl = 0.15s`).
    - `reach < rMin`: `60Hz` `fillTaperedArcRibbon` at `1.000 * reach` + clamped `small` fallback (`fx_sh_hit_spark` `< 24.5px`, else `fx_sh_aegis_crest`).
- **Muzzle `4 + 4` Sub-Range:** `fx_sh_muzzle_burst` & `fx_sh_muzzle_arcane` pack Variant A (`frames 0..3`) and Variant B (`frames 4..7`); `activateParticle` sets `baseFrame = (variantIndex & 1) * 4`, `frameCount = 4`, `ttl = 0.067s`, and flips `flipY` via an independent `muzzleFlipCounter`.
- **`(x, y)` `1:1` vs `(x, y + 12)` `2.12 : 1` Law:** Every `WorldSim` spatial collision/interaction radius renders circular `1:1` at `(x, y)`. Only non-hitbox personal status cues (P1–P4 foot ring, shadows, `gale_smg` speed buff, Elite foot stamp, single-target `freeze_cuff`, `Team Combo` foot ring, `soul_chain` stretch warning, shrine prompt foot ring) render as `2.12 : 1` ellipses at `(x, y + 12)` (`depth 15.0`).

### 4.4. Z-Depth Master Stack (`2.0 .. 80.0`)

- `2.0`: `arenaGroundSprite` (`Multi NORMAL`)
- `6.0`: `decalPool` (`Multi NORMAL`, initialized directly at `startAlpha = maxAlpha = 0.32`, `size <= 6px`)
- `14.0`: `BiomeArchitectureLiveLayer.gearGraphics` (`Graphics NORMAL`)
- `15.0`: `groundStampSprites` & `interactHighlightGraphics` (`NORMAL`, `2.12:1` foot ellipses, sunken astrolabe, sacred tree roots, rear half of `icePrison`)
- `16.0`: `groundHazardGraphics` (`Graphics NORMAL` — `berserker_axe` fissure under pillars, `magma_cannon` / `slag_crucible` pools, `bastion_ring` / `soul_chain` floor tethers, press L-brackets, `downed` `r = 64` brackets)
- `17.0`: `enemyGroundTelegraphGfx` (`Graphics NORMAL` — `100%` closed `#141019` `3.2px` + `#E84545` `2.0px` enemy/Boss progress-fill telegraphs, `Supply Drop` corner brackets)
- `19.0 – 25.0`: Shadows (`19.0`), dropped items & `item_life_seed` (`22.0`), `pushable_stone` sprite (`23.0` — decoupled from `telegraphGraphics`!), props (`24.0`), 3/4 walls (`25.0`)
- **`26.4`**: **`underActorShockPool`** (`Multi NORMAL` — P1 self-centered explosion cores `dist <= 24px`, table-flip dust, `spore_cloud`, low magma boil, `glacial_spike`, flying shards)
- **`26.6`**: **`underActorGraphics`** (`Graphics NORMAL` — all `60Hz` perimeter crescents, directional arc ribbons, `gale_cyclone`, `superheated_cyclone`, `electric_cutter`, `berserker_axe` chasm fire-bridge, Boss `0.25s` roar wave)
- `28.0 – 28.6`: Enemies (`28.0`), **`statusRimPool` shoulder attachments (`28.2`)**, **6 Cutout Summons (`28.4` base / `28.5` body / `28.6` rotating turret head)**
- `29.0 – 30.9`: Co-op allies (`29.0`), **Local Player P1 (`30.0`)**, front `icePrison` bars (`30.3`), front `bastion_prism` plates (`30.4`), **Boss (`30.6 < 31.0`)**, Boss `1.20s` hex invuln cage / armor plates / enrage horns (`30.8`), Boss kill chest cracks (`30.9`)
- `31.0`: `BiomeArchitectureLiveLayer.bracketGraphics` (`Graphics NORMAL`)
- `32.0`: Unlit ambient particles (`leaf`, `snow`, `ash_flake`, `NORMAL`)
- `34.0`: `lightmapRt` (`MULTIPLY`, `whiteWeight = 0.46`)
- `35.0 – 35.1`: `warmGlowPool` & `combatChromaticGlowPool` (`35.0 ADD`), `firefly` & `torch_mote` (`35.1 ADD` — `godRaySprites` `35.2` deleted!)
- `35.5`: `BiomeArchitectureLiveLayer.additiveGraphics` (`Graphics ADD`)
- `36.0`: `blizzardRimGraphics` (`Graphics NORMAL`, strictly `< 36.2`)
- `36.2`: `BiomeArchitectureLiveLayer.voidMaskGraphics` (`#0B090E` Exterior Void mask)
- `40.5`: `playerBulletGlowPool` (P1 heavy/magic shots only, `alpha <= 0.20 ADD`)
- `41.0 – 43.5`: Player projectiles (`41.0 NORMAL`), thrown hammer (`41.5`), foreground slashes / `overheat_puff` / `8f` cores far from P1 (`42.0–42.5`), `4f` muzzles / `fx_parry_winged_crest` / rim-clamped `hit_spark` (`43.0–43.5 NORMAL`)
- `44.0 – 46.0`: `weaponRibbonGraphics` (`44.0`) + **`telegraphGraphics` (`46.0` — single unified enemy sniper sightline, capped at top 8 most dangerous)**
- `46.5 – 48.0`: `duo_rail_lock_10x10` & Boss stun stars (`46.5`), Enemy/Summon HP bars + 2nd status `status_badge_9x9` (`48.0`)
- `58.5 – 60.0`: `ashen_executioner_wave` pointed crescent (`58.5`), `fx_enemy_bullet_glow` (`59.0 ADD`), **Inviolable `#E84545` Enemy Bullet Core (`60.0 NORMAL`)**
- `80.0`: `fx.damagePool` (`0..41` numeric damage merged over `90ms`; `42..47` dedicated `tacticalAlert` slots with zero-alloc AABB vertical repulsion using `0.5 * d.text.width * Math.abs(d.text.scaleX)` and `0.5 * d.text.height * Math.abs(d.text.scaleY)`, `padY = 4.0px`)

### 4.5. GLSL ES 1.00 Hardware Safety, Pointed Ribbon Builder & Lighting `inkGuard`

- **GLSL ES 1.00 (`texture-baker-shader-fx.ts`):**
  - `decodeAtlasCoord`: `4×2` grid (`col = clamp(floor(fragCoord.x / framePx), 0.0, 3.0)`, `canvasRow = 1.0 - clamp(floor(fragCoord.y / framePx), 0.0, 1.0)`, `frameIdx = canvasRow * 4.0 + col`, `t = clamp(frameIdx / 7.0, 0.0, 1.0)`, `p = (fract(fragCoord / framePx) - 0.5) / 0.50`).
  - `safePow(x, y) = pow(max(x, 1e-4), y)` everywhere (zero `pow(0, y)` `NaN` on D3D11 `fxc`).
  - Exact Euclidean SDFs (`|\nabla d| === 1.0`): `sdRhombus`, `sdCutoutStar4`, and `sdArcForwardX(p, sc, ra, rb) = sdArc(vec2(p.y, p.x), sc, ra, rb)` aligned to `+X` (`angle = 0`). `shaderConeBlast` and `shaderBeamLance` span `[-0.82, +0.82]`.
  - Software-GL CI compensation: `uInkTexelWidth = Math.max(1.15, entry.canonicalInkTexels * (renderFramePx / framePx))`.
  - `synthesizeCutoutCelRgba`: 3 quantized `PALETTE` bands (`#F4F1EA` core, element primary, element shade) wrapped in solid `#141019` (`vec3(0.0784, 0.0627, 0.0980)`) ink border (`50ms` `>80%` hollow core erosion from `f >= 2`).
- **Zero-Alloc Pointed Scalar Quad-Strip (`apps/client/src/fx/tapered-ribbon-builder.ts`):**
  - Module-static `Float32Array(20)` buffers (`SCRATCH_PX`, `SCRATCH_PY`, `SCRATCH_HW`, `SCRATCH_NX`, `SCRATCH_NY`) rendered via `gfx.fillTriangle()` in 2 passes (`pass 0`: `#141019` ink outset `pad = 1.8px` with tangent needle tip triangles `tip0 = p0 - t0 * pad * 1.35` and `tipN = pN + tN * pad * 1.35` whenever `hw <= 0.05`, plus `ptCount === 2` diamond needle branch; `pass 1`: core fill). Exports `strokeCutoutQuadStripFromScratch`, `fillTaperedQuadraticBezier`, `fillTaperedArcRibbon`, and `fillTaperedLightningBolt` (`< 28°` kink clamp).
- **Lighting & PostFX (`apps/client/src/fx/lighting-pipeline.ts`):**
  - Lower `liftAmbientTowardClearWhite` `whiteWeight` from `0.68` to **`0.46`**; prioritize `48` lights as: (1) P1–P4 vision $\rightarrow$ (2) `transientLights` (up to `16`) $\rightarrow$ (3) interactables $\rightarrow$ (4) static surface lights; add `16`-slot `combatChromaticGlowPool` (`depth 35.0 ADD`, `alpha <= 0.18`, `ttl = 0.12–0.18s`).
  - Keep `POSTFX_DEFAULTS.bloomStrength = 0.14`, and add `inkGuard = smoothstep(0.22, 0.48, dot(color, vec3(0.299, 0.587, 0.114)))` inside `BIOME_POSTFX_FRAG` so bloom is `0.000` on `#141019` ink outlines (`centerLuma ≈ 0.073`).

---

## 5. Subsystem Micro-Specifications (All Systems + Biome 2 Mirror Removal)

### 5.1. Player Projectiles, `HEAT_VENT`, Hit Feedback & Peripheral Status (`C.1`)
- **Player Projectiles:** Render with `BlendMode.NORMAL` at `depth 41.0` (`L : W >= 1.8 : 1` directional Cutout silhouettes with `1.6px` `#141019` ink border). All 5 `HEAT_VENT` weapons (`apprentice_staff`, `gale_smg`, `solar_archon_staff`, `tether_staff`, `focus_laser`) emit 1 `fx_overheat_puff` (`6×6px`, `depth 42.0`, `-22px/s` for `0.24s`, `alpha = 0.85` P1 / `0.25` Ally) every `0.18s` while `overheated`.
- **Hit Feedback Deduplication & Rim Clamping:** Suppress duplicate `spawnHitSparks` on `damage_dealt` when `projectile_impact` already fired in the same tick. Anchor `fx_sh_hit_spark` at `(e.x - cos(theta) * 0.85 * r_e, e.y - sin(theta) * 0.85 * r_e)` with a per-target **`75 ms` ICD** (`lastHitSparkTimeByTargetId`, cleared on `enterRoom()`); follow-up hits within `75 ms` (and all ally hits at `alpha = 0.35`) spawn only a 2-tick `fx_rim_glint` (`6×4px`). Unify `CutoutRig` normal hit-flash to `2 ticks` of warm ivory `0xFFFBEB` across both full and `fastComposite` modes (preserving `0xF4F1EA` for Parry).
- **Peripheral Status (`statusRimPool`, `64` slots at `depth 28.2`):** Delete full-body rainbow `applyStatusTint` and belly `strokeCircle`s. Attach `2-frame` Cutout shoulder badges: `burn` (paired `12×15px` flames `8 Hz`), `chill` (`13×9px` shoulder rime spikes + `25%` foot-only frost tint; `status_freeze_cuff` at `(e.x, e.y + 12)` `depth 28.3` when `frozen`), `shock` (`15×9px` Z-arc deterministic corner hash `((enemy.id * 31 + Math.floor(sim.tick / 7)) & 3)`), `poison` (`10×10px` asymmetric twin bubbles). Secondary active element renders as `status_badge_9x9` at `depth 48.0` (left of HP bar when `hp < maxHp`, or fallback `(e.x, e.y - r_e - 10)` when HP bar is hidden). Bake dedicated `item_life_seed` (`18×20px` at `depth 22.0`).

### 5.2. Bespoke 18-Weapon Specifications (`C.2` — `1:1` Hitbox Parity)
1. **`knight_sword` (`range = 56px`):** Distinct 3-hit combo (`slash_steel`, combo 3 twin-edge cut with `#141019` negative wind-channel + `26px` floor stone nick at `depth 16.0`, no `aegis_crest` crab-claw); `Parry` spawns `fx_parry_winged_crest` (`32×16px`, `depth 43.0`) + `45°` `26px` air fan (`depth 26.6`) + `2f` `0xF4F1EA` flash.
2. **`hunter_crossbow`:** Barbed bolt pin (`14×7px`) on enemy rim; `crossbow_rip` draws S-whip `fillTaperedQuadraticBezier` (`depth 44.0`) + `24px` 3-prong crimson rip flash.
3. **`apprentice_staff` (`HEAT_VENT`):** Rune droplet bolt; `TriElementalBeam` (`r = 36px`) weaves 3 `120°`-phased `fillTaperedQuadraticBezier` strands (`#F97316` / `#22D3EE` / `#FDE047`) into `1:1` `fx_sh_arcane_sigil` (`R = 36px`).
4. **`thorn_staff`:** `fx_muzzle_thorn_barb` (`12×6px`); `Thorn Bloom` whips 5 hooked briar quad-strips (`depth 26.6`) from exact `1.000 * R_sim` inward.
5. **`rivet_gun`:** Glowing `fx_rivet_hex_head` (`8×8px`); `O(N)` degree `<= 2` tether + `fillTaperedLightningBolt` detonation + `20px` X-slag burst + 2 hex washers to `depth 6.0`.
6. **`scrap_shotgun`:** `0` flipbooks on regular pellets — each hit stamps `fx_pellet_dent` (`8×6px`, `3 ticks`) on enemy rim (+ `26px` air-compression fan at `depth 26.6` when `>= 3` pellets hit one target); `Shell Eject` routes `1:1` via `routeCutoutBurstByRadius(..., 'fx_sh_shrapnel_corona')`.
7. **`gale_smg` (`HEAT_VENT`):** `proj_gale_wind_blade` (`18×9px`); `Gale Cyclone` (`r = 96px`) renders 3 pointed spiral wind-blades at `depth 26.6` under actors (`r_eye = 28px` hollow).
8. **`tesla_carbine`:** `fillTaperedLightningBolt` (`< 28°`, `depth 44.0`, `4 ticks`); `Dome Discharge` (`r = 88px`) routes via `routeCutoutBurstByRadius(88, 'fx_sh_anvil_storm')`.
9. **`emerald_cleaver` (`range = 92.0px`, `SPIN_RADIUS = 56.0px`):** `1:1` `92.0px` crystal-stepped slash on `fx_sh_slash_emerald` (`[63.0, 92.2]`, `LIME_GLOW` light, `return true` on hit 3); boomerang renders `r = 22px` blade in flight and 3 `fillTaperedArcRibbon` jade crescents (`r = 56.0px`, `depth 26.6`) during `boomerangPhase === 'spinning'`.
10. **`solar_archon_staff` (`HEAT_VENT`, `R_orbit = 48px`, `Supernova = 120px`):** 3 `fx_solar_mini_sun` (`12×12px`, zero connecting circle) at `(p.x, p.y) ± 48px`; `solar_converge_burst` (`r = 52px`); `solar_supernova` (`R = 120px`) opens `#141019` solar-eclipse disc (`r = 26px`) eroding hollow at `50 ms` (`fx_sh_nova_solar`) + 8 `60Hz` corona lances at `r = 120px` (`depth 26.6`).
11. **`frag_launcher` (`R = 104px`):** Replace `Ø 208px` ring on `armedForAirburst` with spinning `fx_frag_fuse_wheel` (`14×14px`); `Airburst` routes `1:1` via `routeCutoutBurstByRadius(104, 'fx_sh_shrapnel_corona')`.
12. **`seed_gun`:** `10×6px` seed dart; `Harvest Bloom` opens 5-petal jade bloom at `depth 26.6` (`1:1` `ev.radius`), and when `releasedHealingMist === true`, curves 3 `fx_seed_heal_wisp` (`8×8px`) into `(player.x, player.y)`.
13. **`tether_staff` (`HEAT_VENT`):** `fillTaperedQuadraticBezier` beam (`depth 44.0`) + 2 sliding `#CFFAFE` pulses (P1 only); `Electromagnetic Yank` snaps 4 magnetic jaws inward from `ev.radius` (`depth 26.6`).
14. **`focus_laser` (`HEAT_VENT`):** Heat-tiered beam (`2.4px -> 4.0px`) with 1 sliding star on target rim; `Railgun` (`28px = ±14px`) uses 2-frame `#141019` inverted-ink flash (`depth 44.0`, tapered at muzzle) + dashed shock-rails at `±14.0px` (including Co-op Vanguard shield fan beams).
15. **`void_staff` (`r = 110px`):** `#0B090E` `r = 11px` core + 4 subtle inward `fillTaperedArcRibbon` arcs at `r = 110.0px` (`depth 26.6`, `alpha = 0.22` P1 / `0.07` Ally, `68%` open); `Implosion` collapses `110px -> 0px` (`4 ticks`) + `fx_sh_nova_void`.
16. **`berserker_axe` (`range = 66px`, `Guillotine Slam = 160 × 36px`):** 8-segment (`20px` step) corridor from `(f.x1, f.y1)` to `(f.x2, f.y2)` stopping **only at outer room perimeter walls** — renders `±18.0px` jagged ember fissure at `depth 16.0` (passing naturally under `depth 25.0` interior pillars) and switches to a `depth 26.6` `±18.0px` fire-arc bridge across `chasm` tiles!
17. **`magma_cannon` (`MAGMA_GEYSER_RADIUS = 56.0px`):** Renders `100%` of geyser `r = 56.0px` floor rims (`depth 16.0 + 26.6`); if a new geyser is `< 46px` from an active tall plume, downgrades its center sprite to a low `12px` magma boil (`depth 26.4`) while the primary keeps `fx_sh_geyser_plume(56)`.
18. **`thunder_hammer` (`R = 110px`):** Spinning `fx_thrown_thunder_hammer` (`28×28px`, `depth 41.5`) + lightning recall ribbon + T-spark on catch; `Thunder Pillar` drops `-90px` bolt (`depth 42.5`), stamps 6-branch fissure (`depth 16.0`), and sweeps `60Hz` `r = 110.0px` arc ring (`depth 26.6`).

### 5.3. Biome 2 ("Hầm Băng Vĩnh Cửu") Complete Mirror & Bullet-Split Removal (`C.7` / Addendum `v2.0`)
1. **Track A (`A-Clean` — Client Surface, Glare & Ice Props, `-107,520 B` VRAM):**
   - Return `godRays: []` for Biome 2 in `apps/client/src/world/biome-architecture.ts:958-988`.
   - Delete `GOD_RAY_TEX_KEY` (`'arch_b2_godray_shaft'`), `ensureGodRayTexture`, `godRaySprites` (`lines 717-786, 837, 930-942, 1210-1213`), remove `s === 'ice' ||` at line `909`, add `'ice'` to early `continue` (`lines 991-997`), and delete per-frame `'ice'` glint drawing (`lines 1015-1025`) in `apps/client/src/world/biome-architecture-render.ts`.
   - Replace `drawSurfaceTile('ice')` in `apps/client/src/art/texture-baker-surfaces.ts:533-643` with **Packed Frosted Rime-Glacier**: base fill `#31627D` (`globalAlpha = 1.0`, `ΔRGB = 42.09/255` = `5.78×` separated from `'electrified_water'` `#234463`), deep recess ellipse `#2C5E7A` (`globalAlpha = 1.0`), asymmetric matte slab `#3B7391` (`globalAlpha = 0.55`), 3-pass Voronoi fissure (`#6BA6C2` `2.0px @ 0.50` + `#1E3A5F` `1.40px @ 0.68` + `#141019` `0.95px @ 0.82` anchored at `(0,16)/(32,16)` when `hasW/hasE`), shoreline rim (`#141019` `3.2px` + `#CFE8EE` `1.7px` when `surfaceMask !== 15`), and **close both inner and outer `ctx.restore()` calls before `return;`**!
   - Sync `resolveSurfaceShorelineColors('ice')` in `apps/client/src/scenes/game-scene/arena-tiles.ts:634` (`{ outerBank: '#31627D', innerLip: '#CFE8EE' }`), legacy `'surface_ice'` (`texture-baker-surfaces.ts:212-233`), `prop_sliding_ice_block` (`texture-baker-props-p1c.ts:294-331` — matte `#3B7391`/`#264E66` with recessed directional cross-chevron, zero `45°` `ICE_WHITE` slash), and `prop_glacial_barricade` (`#356D8E`/`#264E66`, `< 15%` `#CFE8EE` crest).
2. **Track B (`Option B-Gameplay+Visual` Locked — Full Removal of Pillar Bullet-Split & Laser-Bounce):**
   - **`cryo_prism_pillar` $\rightarrow$ `Cryo Tuning Obelisk` (Cột Âm Thoa Hàn Khí):** Keep `prop.kind = 'cryo_prism_pillar'` for deterministic room spawning. Rebake `prop_cryo_prism_pillar` (`42×48px`) as a 3-pronged stone tuning-fork monolith (`PALETTE.SLATE_DARK` base, `#264E66` body, `2.0px` `#141019` ink, `bob = 0` in `entity-sync.ts:445`, `lightRadius = 72, alpha = 0.14`, center Y-rune `#38BDF8` ready $\leftrightarrow$ `#1E3A5F` during cooldown).
     - **`WorldSim` Mechanics (`sim-tactical-physics-p1c.ts`, `sim-projectiles.ts:485-498`, `sim-weapon-cadence.ts:779`, `sim-weapon-specials-p1b-ranged.ts:118-133, 201`, `sim-enemies-tactical-b23.ts:254-335`):** Remove all 3-way player/enemy bullet splitting and `focus_laser` pillar splitting; remove `pr.kind === 'cryo_prism_pillar' ||` from `sim-weapon-cadence.ts:779`; make `findIceMageTargetPrism` return `null` so `ice_mage` fires normally at players. When a player projectile or `focus_laser` hits an intact `cryo_prism_pillar`, absorb the projectile (`b.ttlSec = 0`, `prop.hitFlashTimer = 0.16`) and if `(prop.prismPulseCooldownSec ?? 0) <= 0` (**`1.20 s` ICD** per prop), set `prop.prismPulseCooldownSec = 1.20` and trigger an enemy-only Chill resonance pulse (`radius = 72.0 px`, `14` Chill damage + `2.0s` `'chill'` status to enemies within `72 + e.radius`, `0` friendly-fire, `0` extra RNG calls), rendered via `routeCutoutBurstByRadius(fx, prop.x, prop.y, 72, 'fx_sh_nova_cryo')`. Enemy bullets hitting `cryo_prism_pillar` terminate cleanly (`b.ttlSec = 0`).
   - **`crystal_pillar` $\rightarrow$ `Permafrost Bastion Pillar` (Trụ Pháo Đài Đá Băng Chắn Tia):** Keep `prop.kind = 'crystal_pillar'` (`destructible: false`). Rebake `prop_crystal_pillar` (`38×44px`) as a wide-shouldered flat-top octagonal frost-stone bastion (`#264E66` / `#1D3557`, `2.0px` `#141019` ink, hollow `#38BDF8` `6×10px` diamond glyph, `bob = 0`, `lightRadius = 84, alpha = 0.16` in `lighting-pipeline.ts:666`).
     - **`WorldSim` + Client Prediction (`sim-projectiles.ts:447-467` & `831-840`):** Delete `kryssa_ice_beam` redirection and `+0.65π` bullet bounce on both server and client cosmetic prediction; terminate impacting projectiles cleanly at the pillar surface (`prop.hitFlashTimer = 0.16`, `b.ttlSec = 0`, `hitProp = true`), spawning a wall-clamped frost-chip burst (`r <= 16px` via `routeCutoutDirectionalByReach(..., 24, normalRad, 'fx_sh_cone_blast')`, **`120 ms` ICD** per `propId`).
3. **Track C (`kryssa_clone` — Frost Mirage):** Update all 4 label definitions (`packages/shared/src/i18n/vi.json:666` `"Ảo Ảnh Sương Giá Kryssa"`, `en.json:666` `"Kryssa Frost Mirage"`, `packages/shared/src/data/enemies.ts:198-199`, `apps/client/src/art/rig-defs-biome2-boss.ts:336`), set explicit `rig.container.setAlpha(isIllusion ? 0.76 : 1.0)` in `entity-sync.ts:309`, and recolor `KRYSSA_CLONE_RIG_DEF` to matte twilight frost (`#356D8E` / `#6BA6C2` / `#5B4B8A`, `outlineWidth: 1.8` `#141019`).

### 5.4. Other Props, World Interactions, Skills, Summons, Reactions, Duo Boons, Boss Beats & 4P Co-op (`C.3–C.6`)
- **Props & World Interactions (`C.3`):** Fix `fx_sh_aegis_crest` to neutral `elemId: 0`; unify sliding trail to 1 V-groove (`depth 16.0`); replace 4 barricade status `strokeCircle`s with `prop_cryo_node`, 4 emerald corner arcs, `prop_rocket_nozzle`, and 2 steel bumper caps; bespoke choreography for `forge_blast_shield` (`depth 26.6` heat arc), `pneumatic_press` (4 L-brackets + 4 steam puffs), `slag_crucible` (3-phase tilt/pour/basalt-crust), `rotten_totem_pillar` (falling trunk + spore dust), `caustic_spore_pod` (organic pulse, delete double rings); split `spawnPropBreakBurst` into 4 material shards (`wood`, `ceramic`, `stone`, `ice` `<= 6px` to `depth 6.0`; scorch decal restricted to `explosive_barrel` & `coal_bomb`); `180°` wall-clamped `Wall-Slam`; `Ring-Out` diamond star; fix `cracked_wall_broken` early return (`hud-pact-and-forge-modals.ts:708`); vertical trapezoid light shafts for Chest/Anvil/Shrine + `depth 15.0` highlight ellipses; 3-jaw salvage clamp; gothic iron `DOOR_BARRIER_FRAG` (`Portal` keeps `particleCount = 8, rayCount = 3`); `spawnArcaneTeleportFold` + `'DỊCH CHUYỂN!'`.
- **Skills & 6 Cutout Summons (`C.4`):** `downed` `r = 64px` `1:1` 4-bracket ring at `(downed.x, downed.y)`; `vanguard_bastion_prism` 6 faceted plates on `1:1` `shieldR` (`depth 26.4` rear / `30.4` front); split `icePrison` (`15.0` rear / `30.3` front); 5 class skills routed via `routeCutout*` (Engineer turret range shown `0.65s` on placement for P1 only, `0.00` for allies); all 6 summons rendered from `fx_cutout_kit_512` at `depth 28.4–28.6` with `depth 19.0` shadows (`tesla_turret` and `holo_decoy_turret` split into fixed base + `360°` recoiling head; `electric_cutter` rendered via `fillTaperedLightningBolt` at `depth 26.6`).
- **6 Reactions, Blessings/Pacts/Mutators & 6 Duo Boons (`C.5`):** Bake 6 dedicated `256×64` POT `4f` reaction mini-strips (`fx_react_vapor_puff`, `fx_react_shatter_pane`, `fx_react_superconduct_cross`, `fx_react_toxic_glob`, `fx_react_paralysis_x`, `fx_react_overload_star`) + `0.40s` `HUD Reaction Banner` aggregator + P1 `Team Combo` double foot ellipse; purge `100%` of wireframe `strokeCircle`s in `combat-fx-blessings-p1d.ts`, `combat-fx-p2b.ts` (preserving `> 260px` `soul_chain` stretch warning at `depth 17.0`), `combat-fx-p4a.ts` (deleting `drawDeterministicTransientBursts` and mortar shadow-stem line), and `combat-fx-p4b.ts` (`duo_superheated_cyclone` `r = 56px` at `depth 26.6`, `duo_rail_lock_10x10` replacing `Ø 200px` circles, `duo_magnetic_bastion_ring` `<= 220px` `±14px` at `depth 16.0`).
- **7 Boss Beats & 4P Co-op (`C.6`):** Biome-branched `boss_spawned`; `Phase Roar` = `0.25s` `depth 26.6` bullet-clear ring + **full `1.20s` tight hex invulnerability cage (`depth 30.8`, `92%` hollow, blinking `16 Hz` in final `0.20s`)**; `Armor Shell` = 6 biome-tinted `fx_boss_shell_plate`s; `Armor Break` = 6 shattering plates + 3 overhead stun stars (`depth 46.5`) + 4 foot crack arcs; `Enrage` = `3->5` crimson Cutout horns (`depth 30.8`); **2-Beat `60Hz` Slow-Mo `Boss Kill`** (`0.00..0.16s` `#141019` silhouette inversion with 5 `#F4F1EA` cracks + `0.16..0.42s` `60Hz` twin crescents `R = 132px` & 12 boss-themed relics); `ashen_executioner_wave` pointed `fillTaperedArcRibbon` at `depth 58.5` preserving `#E84545` core at `60.0`; `Supply Drop` 4 gold corner brackets (`depth 17.0`). Fix `shotFxTriggeredOwnersScratch: Set<number>`, enforce `resolveAllyFxProfile` (`0.42×` bullets, `0.35×` AoE/melee/boons, `0.00×` turret rings, zero ally `spawnTransientLight`/`addTrauma`), and apply **`P1 18px Safe-Halo` (`alpha × 0.15` within `18px + 0.35*R` of P1)**.

---

## 6. Complete Test & Documentation Migration Matrix (`19` Contract Groups + `PROJECT.md`)

1. **`PROJECT.md` (`38, 60, 117`):** Update `teleportToRoom` contract to `spawnArcaneTeleportFold` + clean `'DỊCH CHUYỂN!'` and document Biome 2 `Cryo Tuning Obelisk` / `Permafrost Bastion Pillar`.
2. **`topdown-shader-vfx-baker.test.ts`:** Update to `8` frames (`4×2` POT `64/128/256`), `0.41` / `0.82` ratios, `aegis_crest` `elemId: 0`, and `0..3` / `4..7` muzzle sub-range checks.
3. **`topdown-shader-vfx-spawners.test.ts`:** Preserve `startScale === endScale` and low-level `spawnShader*` `1:1` primitives; update depths (`26.4–26.6` / `42.0–43.5`), `frameCount = 8` (`4` for `muzzle_*`), `'fx_react_overload_star'`, `knight_sword` / `emerald_cleaver` combo 3, `fillTriangle` lightning, and `decal` `0.32`.
4. **`polish-p3-lighting-camera.test.ts` (`46-48`):** Native pass (`POSTFX_DEFAULTS.bloomStrength === 0.14` preserved).
5. **`polish-p10b-fx-elemental-ambient.test.ts` & `tests/e2e/polish-p10b.spec.ts`:** Native pass for `firefly` (`depth 35.1 ADD`), `resolveBiomeAmbientSpec(2)`, and `normalHitColor = 0xFFFBEB !== 0xF4F1EA`; update player bullet (`NORMAL` `41.0`), shotgun `fx_pellet_dent`, Boss sub-banner, and `HUD Reaction Banner` assertions.
6. **`round4-minimap-teleport-barricades.test.ts` (`680-704`) & `map-overhaul-e2e.test.ts` (`T5-WB-30`):** Update fast-travel assertions to `spawnArcaneTeleportFold` + `'DỊCH CHUYỂN!'` (`#0B090E` Exterior Void passes natively via `36.0 < 36.2`).
7. **`commercial-class-and-interaction-vfx.test.ts`:** Update to 2-layer `routeCutoutDirectionalByReach`, `fx_boss_shell_plate`, trapezoid chest/shrine shafts, and `depth 28.4–28.6` `summon_*` sprites.
8. **`ap2-p1a-weapons-vfx-audio.test.ts` & `ap2-p1b-weapons-fx.test.ts`:** Native pass on `fx.damagePool` alert slot & `30px` geyser count; update `strokeCircle` checks to `fillTriangle` quad-strips / `1:1` arcs (`92px` cleaver, `56px` spin, `110px` void, `48px` solar, `160×36px` axe corridor).
9. **`ap2-p1d-blessing-ui-fx.test.ts` & `ap2-p4b-duo-ui-fx.test.ts`:** Update summon overlay assertions to `summon_*` sprites, `duo_rail_lock_10x10`, `resolveAllyFxProfile` (`0.35`), `r = 56px` cyclone, and `<= 220px` `bastion_ring`.
10. **`polish-p8-portal-door.test.ts` (`85-86`):** Native pass (`particleCount = 8`, `rayCount = 3`).
11. **`map-overhaul-e2e.test.ts` (`T1-F5-03` `:698-703`, `T5-WB-05` `:3255-3262`, `T5-WB-23` `:4811-4830`) & `round3-tiles-surfaces-bridges.test.ts` (`:931-960`):** **Native 100% pass** via `#2C5E7A`, `#1E3A5F`, `#CFE8EE`, and `(0,16)/(32,16)` Voronoi anchors. Add `&& !colors.has('#31627D')` in `tests/e2e/helpers/map-overhaul-harness.ts:1725` and remove `'ice'` glint checks at `:2327, 2364-2368`.
12. **`polish-p5-biome-architecture.test.ts` (`158-169`), `round3-lighting-architecture-minimap.test.ts` (`607-624`), `map-overhaul-e2e.test.ts` (`2668-2678, 5105-5124`):** Assert `expect(plan.godRays).toHaveLength(0)` across all biomes and absence of `'arch_b2_godray_shaft'`.
13. **Biome 2 Pillar Mechanics & Visual Strips (`ap2-p1c-props-fx.test.ts`, `ap2-p1c-biome2-ecosystem.test.ts`, `ap2-p3a-biome2-enemies.test.ts`, `ap2-p1b-ranged-weapons.test.ts`, `boss-bullet-hell-kinematics-graze.test.ts`, `phase6-biomes.test.ts`, `tests/e2e/helpers/visual-scene-ap2-p1c.ts:480-518`, `visual-scene-ap2-p1b.ts:199, 445-478`):** Migrate from 3-way prism bullet-split / laser-bounce to `Cryo Tuning Obelisk` (`r = 72px` enemy-only Chill pulse, `1.20s` ICD, `apexEvent: 'explosion'`) and `Permafrost Bastion Pillar` (beam/bullet severing across server & client prediction, `focus_laser` refraction tested via active Vanguard shield).
14. **Boss 2 Clone (`vi.json:666`, `en.json:666`, `enemies.ts:198-199`, `rig-defs-biome2-boss.ts:336`, `entity-sync.ts:309`):** Sync `"Ảo Ảnh Sương Giá Kryssa"` / `"Kryssa Frost Mirage"` and `alpha = 0.76`.
15. **`tools/visual-animation-gates.ts` (`Gates 1–5`):** Zero changes to gate evaluator code; all 5 gates pass naturally (`damagePool[42..47]` AABB repulsion guarantees `nonNumericAlertOverlapCount === 0` for `Gate 4`; `#F4F1EA` + `combatChromaticGlowPool` guarantees `deltaP95Luma >= +0.065 > 0.04` for `Gate 3`).

---

## 7. Explicit Builder Calls & What Is Left to the Builder

### Builder Calls Made Explicitly in This Spec (For User Review)
1. **Opt-in Player Split Blessings/Mutators Preserved:** Only environmental Biome 2 pillars (`cryo_prism_pillar` & `crystal_pillar`) have their bullet-splitting/bouncing mechanics removed. Player opt-in upgrades (`table_tech_prism_split`, `bullet_split_bounce`, `mutator_prism_splitter`) keep their simulation mechanics so existing Blessing/Mutator builds and balance soak tests stay intact, while their noisy wireframe `strokeCircle` overlays are removed.
2. **Co-op Vanguard Shield `Focus Laser` Synergy Preserved:** `focus_laser` stops splitting on `cryo_prism_pillar` (triggering the Obelisk's `r = 72px` Chill pulse instead), while keeping its intentional 4P Co-op synergy when fired through an ally's raised Vanguard shield (`sim-weapon-specials-p1b-ranged.ts`).
3. **`Cryo Tuning Obelisk` Exact Numbers:** `14` Chill damage + `2.0s` `'chill'` (`1` stack) to enemies within `r = 72.0px`, `1.20s` per-prop ICD, `0` friendly-fire, `0` RNG calls consumed.
4. **5-Plan Modular Decomposition Recommended:** Because this overhaul spans 5 testable vertical slices (Core Baker/Z-Depth/Lighting, 18 Weapons, Biome 2 Mirror Removal & Props/World, Class Skills/Summons/Status/Reactions, and Blessings/Pacts/Duo/Boss/4P Co-op), implementation should be organized into 5 sequential, independently testable phases/plans.

### Left to the Builder During Implementation
- Exact shelf-packing `(x, y)` coordinates of sprites inside `fx_cutout_kit_512` (`512×512`), provided every sprite includes the `+2px` transparent border (`W_tex = 3*W_world + 4`) and total packed height stays `<= 512px`.
- Internal helper decomposition across `apps/client/src/fx/*` files to keep individual modules clean and maintainable, provided all exported signatures and test hooks remain compatible.
- Exact Voronoi cell seed constants inside the 24 individual GLSL fragment cases, provided `|\nabla d| === 1.0`, `safePow` is used everywhere, `Frame 2+` erodes `> 80%` of the interior core, and `worldInkPx ∈ [1.50px, 2.20px]` holds.
