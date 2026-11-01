# Commercial-Grade Diverse Signature VFX Overhaul — Design Specification

**Date:** 2026-11-01  
**Project:** Ashen Pact (`@ashen-pact/client`)  
**Status:** Active Authority Spec (User-Authorized Full Overhaul via `/using-superpowers`)

## 1. Intent & Why

Although the v2 Chiaroscuro GLSL shader upgrade established crisp cel-stepped posterization, `#141019` obsidian ink contours, and `1:1` hitbox fidelity, combat across *Ashen Pact* still suffered from **morphological repetition**:
1. **Circular Ring Collapse**: Almost every weapon special (`gale_smg` cyclone, `frag_launcher` airburst, `magma_cannon` geysers, `thorn_staff` / `seed_gun` blooms, `thunder_hammer` pillars, `tether_staff` EM yank), all 6 elemental reactions, and prop explosions routed to the same circular expanding ring (`fx_sh_nova_*`). Even wind skills (`gale_smg`, `tactical_vent`) spawned 8-spike ice crystals (`fx_sh_nova_cryo`).
2. **Uniform Weapon Attacks**: All 4 melee weapons shared virtually identical `vfxSlash` crescent curves (differing mainly by color), and all 14 ranged weapons—including magic staves, crossbows, bio-seed blasters, and continuous lasers—spawned the exact same golden firearm muzzle jet (`fx_sh_muzzle_burst`) and ejected brass bullet casings (`fx_shell_casing`).
3. **Understated Character Skills & World Beats**: The 5 playable classes' `skill_cast` events (`vanguard`, `ranger`, `elementalist`, `druid`, `engineer`) and dramatic world beats (`summon_spawned`, `shrine_blessing`, `player_revived`, `boss_phase_changed`, `boss_enraged`) triggered little more than a generic `spawnTransientLight` flash.

This overhaul gives every weapon, character class skill, elemental reaction, and tactical interaction its own **commercial-grade, lore-accurate silhouette and choreography** while preserving 60 FPS 4-player Co-op readability.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **24 Distinct Chiaroscuro GLSL Flipbook Morphologies**: Expand `SHADER_FX_TEXTURE_KEYS` from `14` to `24` `7×2` (`14`-frame) sprite sheets across 5 parallel-compiled WebGL1 fragment shader programs, plus differentiate the 4 melee slash variants (`sid 0..3`) into 4 distinct blade silhouettes.
- **Weapon-Family Muzzle & Casing Identity**: Differentiate primary fire muzzle flashes across 6 weapon families (`ballistic_gun`, `heavy_shotgun`, `crossbow`, `wind_tech`, `electro_laser`, `bio_botanical`, `arcane_staff`) so only true ballistic firearms eject brass casings.
- **18 Bespoke Weapon Signatures**: Give all 18 weapons unmistakable primary + finale/special visual identities.
- **5 Playable Class Skill Signatures**: Implement dedicated `skill_cast`, `summon_spawned`, `shield_shockwave`, `emp_blast`, and active world overlays for `vanguard`, `ranger`, `elementalist`, `druid`, and `engineer`.
- **6 Distinct Elemental Reaction Silhouettes**: Map `vaporize`, `shatter`, `superconduct`, `toxic_blast`, `paralysis`, and `overload` to 6 visually distinct morphologies + dual-element accents.
- **Tactical Prop, Shrine & Boss Beats**: Give `explosive_barrel`, `caustic_spore_pod`, `cover_flipped`, `tactical_vent`, `wall_slam`, `ring_out`, `shrine_blessing`, `player_revived`, `armor_broken`, `boss_phase_changed`, and `boss_enraged` distinct signature bursts.

### Non-Goals
- Modifying `@ashen-pact/shared` deterministic `WorldSim` gameplay numbers, hitboxes, cooldowns, or network protocol messages.

### Anti-Goals (Failure Conditions Even If Code Compiles)
- **Co-op Screen Blindness**: Never reintroduce opaque filled discs over combat centers or `BlendMode.ADD` whiteout stacks that obscure enemies or hazards.
- **Enemy Bullet Occlusion**: Never render any player/world VFX at `depth >= 60`; enemy bullets (`#E84545` + `#141019` outline + `#FFFDF5` core at `depth: 60`) remain inviolable on top.
- **Hitbox Dishonesty or `3/4` Perspective Squash**: Zero `scaleY < 1` foreshortening on circular AoEs; canonical `R_p = 0.78` (`0.3354 * framePx`) must match `1.0x` `WorldSim` Euclidean radii.
- **GLSL ES 1.00 / D3D11 ANGLE Regressions**: Zero dynamic loop bounds, zero inverted `smoothstep(hi, lo, x)` calls, and zero leaked offscreen WebGL contexts.

---

## 3. Architectural Approaches Evaluated

1. **Approach A (Selected — Expanded 24-Strip Chiaroscuro GLSL Archetype Library + Per-Weapon/Skill Composite Choreography)**:
   - Bake 24 `7×2` Hi-DPI (`192 / 288 / 384px`, max `2688×768 <= 4096px`) unpremultiplied RGBA flipbooks once at boot using 5 parallel-compiled WebGL1 fragment shader programs, immediately releasing the offscreen GL context via `WEBGL_lose_context`.
   - Combine each bespoke shader morphology with zero-allocation `Graphics` accents (`telegraphGraphics` + `groundHazardGraphics` at `depth: 16`) and particle pools per weapon, class skill, reaction, and interaction.
   - *Tradeoff*: Adds ~10 canvas textures (~3.6 MB VRAM, ~45ms extra one-time boot bake) in exchange for zero runtime shader cost, `BlendMode.NORMAL` obsidian-vein fidelity, and dramatic visual variety across 40+ combat actions.
2. **Approach B (Rejected — Pure 2D `Graphics` Procedural Lines for All New Effects)**:
   - Cannot produce cel-shaded Chiaroscuro plasma, botanical petals, bubbling bio-spores, or logarithmic wind-shear volumes, and increases per-frame CPU triangulation in 4P stress scenes.
3. **Approach C (Rejected — 60+ Individual Per-Ability Full-Size Atlases)**:
   - Triples boot time and exceeds `120 MB` canvas memory for redundant color variations better served by morphological archetypes + palette/accent choreography.

---

## 4. Detailed Visual & Technical Design

### 4.1 24 Chiaroscuro GLSL Flipbooks (`apps/client/src/art/texture-baker-shader-fx.ts`)

All 24 strips bake `14` square frames (`7×2` grid), `BlendMode.NORMAL`, `48 <= depth <= 57`, with 4-band cel-stepped posterization and `#141019` obsidian ink contours:

- **Family 0 (`FRAG_DIRECTIONAL_SRC`, `sid 0..7`, `+X` directional)**:
  - `0: fx_sh_slash_steel` (`288px`, `knight_sword`): Chivalric broadsword arc with twin parallel fuller ridges and a 4-point crossguard glint star.
  - `1: fx_sh_slash_emerald` (`288px`, `emerald_cleaver`): Serrated saw-cleaver arc with 7 hooked shark-tooth poison fangs carved along the outer edge and venom droplets.
  - `2: fx_sh_slash_crimson` (`288px`, `berserker_axe`): Heavy asymmetric bearded-axe wedge cleave (broad flared hatchet-head near leading third + molten cinder cracks).
  - `3: fx_sh_slash_thunder` (`288px`, `thunder_hammer`): Blunt seismic hammer shock-head + dual jagged high-voltage lightning forks.
  - `4: fx_sh_cone_blast` (`288px`): Wide directional blast wave (`scrap_shotgun`, `shield_shockwave`, `reload_repulsor_shock`).
  - `5: fx_sh_beam_lance` (`384px`): Mach-diamond hyper-velocity lance (`focus_laser_railgun`, `berserker_guillotine_slam`).
  - `6: fx_sh_muzzle_burst` (`192px`): Ballistic propellant flame-jet (`rivet_gun`, `scrap_shotgun`, `frag_launcher`, `magma_cannon`).
  - `7: fx_sh_hit_spark` (`192px`): Directional impact spall & cut-star.
- **Family 1 (`FRAG_NOVA_HOT_SRC`, `sid 8..10`, `1:1` radial)**:
  - `8: fx_sh_nova_solar` (`384px`): Celestial 3-lance convergence & double-crest solar prominence (`solar_supernova`).
  - `9: fx_sh_nova_magma` (`384px`): Molten combustion shock-ring (generic fire explosions).
  - `10: fx_sh_nova_thunder` (`384px`): 6-sector forked plasma ring (`paralysis`, shock bursts).
- **Family 2 (`FRAG_NOVA_COLD_SRC`, `sid 11..13`, `1:1` radial)**:
  - `11: fx_sh_nova_cryo` (`384px`): 8-needle faceted ice-crystal burst (`shatter`, `glacial_barricade`, `reload_frost_nova`).
  - `12: fx_sh_nova_venom` (`384px`): 6-lobe corrosive ring (poison status bursts).
  - `13: fx_sh_nova_void` (`384px`): 2-stage gravitational spiral collapse -> void shock-ring (`void_implosion`).
- **Family 3 (`FRAG_ARCHETYPE_NATURE_WIND_SRC`, `sid 14..18`, `1:1` radial)**:
  - `14: fx_sh_vortex_gale` (`384px`, `elem 1/5` teal-wind): 4-arm logarithmic hurricane turbine blades spinning around a hollow storm-eye with slicing air-feathers (`gale_smg` cyclone, `vaporize`, `tactical_vent`, `ring_out`, `reload_magnet_vortex`).
  - `15: fx_sh_bloom_briar` (`384px`, `elem 1` emerald-lotus): 6 unfurling pointed botanical lotus petals + counter-curved hooked briar thorns + drifting pollen diamonds (`seed_gun` bloom, `thorn_staff` bloom, `druid` `sacred_tree` & `player_revived`).
  - `16: fx_sh_spore_cloud` (`384px`, `elem 6` toxic-bio): 7 asymmetric bursting bio-vesicle puffs + toxic crescent clouds (`toxic_blast`, `caustic_spore_pod`, `volatile_spore_pod`, `ranger_arrow_wall_blast`).
  - `17: fx_sh_anvil_storm` (`384px`, `elem 4` volt-cyan): Octagonal Faraday EMP cage + 8-way sky-anvil lightning crossbars (`thunder_hammer` pillar, `engineer` `tesla_turret` & `emp_blast`, `superconduct`, `rivet_gun` web, `tether_staff` EM yank).
  - `18: fx_sh_geyser_plume` (`384px`, `elem 3` volcanic-magma): 5-plate star-crater tectonic fracture + erupting lava fangs & obsidian slag (`magma_cannon` geysers, `berserker_axe` slam origin, `wall_slam`, `pneumatic_press`, `slag_crucible`, `boss_enraged`).
- **Family 4 (`FRAG_ARCHETYPE_TACTICAL_CLASS_SRC`, `sid 19..23`, radial & `+X` directional)**:
  - `19: fx_sh_shrapnel_corona` (`384px`, `1:1` radial, `elem 2` ballistic-fire): 12 high-velocity asymmetric flechette spears + smoke-ribbon wakes (`frag_launcher` airburst, `explosive_barrel`, `overload`, `table_tech_rocket`, `reload_tediore_chuck`, `bullet_ricochet_boom`).
  - `20: fx_sh_aegis_crest` (`288px`, `+X` directional, `elem 3/2` ruby-gold): Armored hexagonal phalanx shield-chevron + twin shock-ribs (`vanguard` `ruby_shield_wall`, `shield_shockwave`, `vanguard_shield_charge`, `knight_sword` parry, `cover_flipped`, `armor_broken`).
  - `21: fx_sh_falcon_sonic` (`288px`, `+X` directional, `elem 1/0` emerald-gold): Swept-back raptor-wing double Mach boom chevron + piercing sniper star (`ranger` `predator_arrow`, `hunter_crossbow` charged shot & `crossbow_rip`).
  - `22: fx_sh_arcane_sigil` (`384px`, `1:1` radial, `elem 0/4` celestial-gold): Inscribed twin hexagram sacred-geometry rune ring fracturing into glyph shards (`elementalist` `elemental_orb`, `apprentice_staff` tri-beam seal, `solar_converge_burst`, `shrine_blessing`, `boss_phase_changed`).
  - `23: fx_sh_muzzle_arcane` (`192px`, `+X` directional, `elem 0` white-gold tintable): Crystalline 4-point mana-star & swirling wisp cast flash for staves, bows, wind SMGs, bio-blasters, and energy rifles.

### 4.2 Weapon-Family Muzzle Profiles (`resolveWeaponMuzzleProfile`)
- **`ballistic` (`rivet_gun`)**: `fx_sh_muzzle_burst`, golden sparks, ejects `fx_shell_casing`.
- **`shotgun` (`scrap_shotgun`)**: large `fx_sh_muzzle_burst`, orange sparks, ejects `fx_shell_casing`.
- **`launcher` (`frag_launcher`, `magma_cannon`)**: large `fx_sh_muzzle_burst` (`magma_cannon` omits brass casing and spawns molten ember motes; `frag_launcher` ejects grenade casing).
- **`crossbow` (`hunter_crossbow`)**: `fx_sh_muzzle_arcane` tinted `#BAE6FD` steel-cyan, V-bowstring snap streaks, **zero brass casing** (plus `fx_sh_falcon_sonic` when `SHOT_FLAG.CHARGED_SHOT` or `FINALE_SHOT` is present).
- **`wind` (`gale_smg`, `gale_smg_wind_blade`)**: `fx_sh_muzzle_arcane` tinted `#5EEAD4` teal wind-shear, **zero brass casing**.
- **`electro_laser` (`tesla_carbine`, `focus_laser`)**: `fx_sh_muzzle_arcane` tinted `#7DD3FC` / `#FDE047` plasma discharge, **zero brass casing**.
- **`bio` (`thorn_staff`, `seed_gun`)**: `fx_sh_muzzle_arcane` tinted `#86EFAC` botanical burst + leaf/pollen motes, **zero brass casing**.
- **`arcane` (`apprentice_staff`, `solar_archon_staff`, `tether_staff`, `void_staff`)**: `fx_sh_muzzle_arcane` tinted per staff (`#FDE047` solar, `#C4B5FD` tether, `#D8B4FE` void, `#FDBA74` apprentice) + `fx_sparkle_mote` rune motes, **zero brass casing**.

### 4.3 5 Playable Character Classes (`apps/client/src/fx/combat-fx-classes.ts`)
- **`vanguard` (`ruby_shield_wall`)**: `skill_cast` spawns directional `fx_sh_aegis_crest` (`74px`) + crimson sparks; active shield draws segmented Chiaroscuro ruby-gold phalanx plates with stored-charge chevrons; `shield_shockwave` spawns directional `fx_sh_aegis_crest` (`96px`) + `fx_sh_cone_blast` (`92px`).
- **`ranger` (`predator_arrow`)**: `skill_cast` spawns directional `fx_sh_falcon_sonic` (`88px`, aligned to `ev.angle`) + backflip wind-feather trail & hawk-eye glint.
- **`elementalist` (`elemental_orb`)**: `skill_cast` spawns `fx_sh_arcane_sigil` (`78px`, tinted to caster's active element) + elemental rune motes; active `skillZones` draw an inscribed 6-tick Chiaroscuro rune perimeter on `groundHazardGraphics` (`depth: 16`, `<= 0.05` fill) and an orbiting elemental crescent around the core.
- **`druid` (`sacred_tree`)**: `skill_cast` & `summon_spawned (sacred_tree)` spawn `fx_sh_bloom_briar` (`82px`) + floating `fx_ambient_leaf` motes; active `sacred_tree` renders 8 root-vine perimeter knots on `groundHazardGraphics` (`depth: 16`) and glowing golden life-fruits in its emerald canopy.
- **`engineer` (`tesla_turret`)**: `skill_cast` & `summon_spawned (tesla_turret)` spawn `fx_sh_anvil_storm` (`72px`, cyan-gold) + electric sparks; `emp_blast` spawns full-radius `fx_sh_anvil_storm` (`ev.radius`) + 4 radial chain-lightning arcs.
