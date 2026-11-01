# Ashen Pact — 1:1 Top-Down Chiaroscuro Domain-Warped Shader VFX Overhaul Design Spec

**Date:** 2026-11-01  
**Visual Reference:** Approved `1:1` Orthographic Top-Down & `360°` Free-Aim WebGL1 GLSL Style (`ashen-pact-hades-vfx-master-prompt.md` + `ashen-pact-topdown-1to1-shader-vfx.html`)

## 1. Goals & Visual Direction
1. **Studio-Grade Top-Down Chiaroscuro Shader Aesthetics:** Replace bloated programmer-art concentric rings, opaque cartoon strokes, and screen-blinding additive white-outs across *Ashen Pact* with crisp, domain-warped FBM + Chiaroscuro dark-vein + `#FFFDF5` razor-edge + ACES-tonemapped combat VFX.
2. **True `1:1` Orthographic Top-Down & `360°` Rotation Fidelity:**
   - Zero `3/4` isometric squash (`xScale = yScale = 1.0`).
   - Radial AoEs, shockwaves, implosions, and floor sigils map `1.0×` to `WorldSim` Euclidean circular hitboxes (`R_norm = 0.78` inside each square flipbook frame).
   - Directional slashes, cones, railgun lances, muzzle flashes, and projectiles are baked canonically along `+X` (`0 rad`) in `1:1` space so Phaser rotates them smoothly across `360°` (`setRotation(aimAngle)`).
3. **4-Player Co-op Tactical Clarity & Depth Hierarchy:**
   - **2-Phase Hollow-Core Detonations:** `<80ms` (`F01–F02`) tight anisotropic star ignition (`<= 12px` core) → `F03–F14` **100% hollow-core** expanding Chiaroscuro corona eroding organically via FBM noise threshold into C-arcs and spark needles (never uniform alpha-fog fade).
   - **Strict Z-Depth Separation:**
     - `depth: 6`: Persistent floor scars/decals (`fx_decal_scorch`, `fx_decal_frost`, `fx_decal_splatter`).
     - `depth: 16`: New `GameScene.groundHazardGraphics` strictly **below** drop shadows (`19`) and characters (`28..31`). Persistent player ground zones (`solarFireZones`, `magmaTrails`, `flameFissures`, `lightningPillars`, `seed_healing_mist`, `slag_lava_carpet`, `superheated_cyclone`, `secret_trial`, etc.) and enemy floor telegraphs render at `depth: 16` with perimeter-weighted `15%` rims and `< 0.06` interior fill (`<= 0.10` serrated `#E84545` danger rims for enemy telegraphs).
     - `depth: 34`: `lightmapRt` multiply pass.
     - `depth: 38`: `telegraphGraphics` reserved strictly for crisp elevated tactical indicators, tethers/beams, HP bars, and sightlines.
     - `depth: 42..57`: Airborne player projectiles & Chiaroscuro Shader flipbook VFX (`BlendModes.NORMAL` with unpremultiplied ACES-tonemapped RGBA so dark Chiaroscuro veins AND glowing `#FFFDF5` rims render without 4P additive white-out; scaled by `teammateFxOpacity` for allies).
     - `depth: 60`: **Inviolable** enemy red bullseye projectiles (`proj_enemy_orb` / `ENEMY_BULLET_VISUAL_SPEC`, `#E84545` + `#141019` outline + `#FFFDF5` core).
   - **Alert Decluttering:** Remove spammy mid-combat weapon/microbar `spawnFloatingAlert` callouts (`RÚT TÊN!`, `ĐOẠN ĐẦU ĐÀI!`, `SIÊU TÂN TINH HỘI TỤ!`, etc.) while keeping `'SUPPLY DROP!'` (required by Gate 1 in `ap2-p3b`) and high-signal room/boss/tactical callouts.
4. **60 FPS Zero-Allocation Runtime (`stress-4p`):**
   - Single temporary offscreen WebGL1 `<canvas>` (`premultipliedAlpha: false`) bakes 14 horizontal sprite sheets (`14` frames × `128×128` px = `1792×128` px per strip, `~12.8 MB` total VRAM, `< 35ms` boot time), registers Phaser `CanvasTexture` frames `0..13`, and immediately releases the WebGL context via `WEBGL_lose_context.loseContext()`.
   - Runtime playback uses existing pre-allocated `CombatFxManager.particlePool` advancing `sprite.setFrame(frameIdx)` with zero per-frame allocations and zero runtime fragment shader cost.

## 2. Shader Sprite-Sheet Catalog (`texture-baker-shader-fx.ts`)
- **Directional `+X` `360°` Flipbooks (14 frames):**
  1. `fx_sh_slash_steel` — Physical/Gold-Steel crescent slash (`knight_sword`, `vanguard`, `phase_blade`).
  2. `fx_sh_slash_emerald` — Jade-Emerald flame crescent (`emerald_cleaver`, `thorn_staff`, `druid`).
  3. `fx_sh_slash_crimson` — Blood-Flame heavy cleave (`berserker_axe`, `ashen_executioner`).
  4. `fx_sh_slash_thunder` — Storm-Indigo/Cyan-Volt electric cleave (`thunder_hammer`).
  5. `fx_sh_cone_blast` — Directional `+X` conical shock/shotgun wave (`scrap_shotgun`, `forge_fire_wave`, `vanguard_shield_charge`, `ranger_arrow_wall_blast`).
  6. `fx_sh_beam_lance` — Supersonic `+X` railgun/piercing Mach collar & shear-core lance (`focus_laser_railgun`, `prism_refract_flash`, `berserker_guillotine_slam`).
  7. `fx_sh_muzzle_burst` — Anisotropic `+X` Chiaroscuro muzzle star + dark smoke shear (`spawnMuzzleFlashAndCasing`).
  8. `fx_sh_hit_spark` — Directional `+X` anisotropic impact cut-star + micro C-wave (`spawnHitSparks`).
- **Isotropic `1:1` Circular Hollow-Core Flipbooks (14 frames, `R_hitbox = 0.78 * 0.5 * framePx`):**
  9. `fx_sh_nova_solar` — Astrolabe 8-point star ignition → hollow solar-gold/flame-orange corona (`solar_supernova`, `solar_converge_burst`, `pneumatic_press_slam`, `plasma_overload_star`, `overload`).
  10. `fx_sh_nova_magma` — Cracked obsidian dark-vein eruption → hollow crimson-magma wave (`frag_launcher`, `magma_geyser`, `napalm_chain_plague`, `explosive_barrel`).
  11. `fx_sh_nova_thunder` — 6-branch radial fractal lightning → hollow storm-cyan/volt hoop (`thunder_hammer_pillar`, `tether_em_yank`, `thunder_decoy_nova`, `paralysis`, `shielder_shock`).
  12. `fx_sh_nova_cryo` — 8 straight-faceted glacier crystal spikes + frost corona (`glacial_shatter_spikes`, `reload_frost_nova`, `duo_cryo_shatter_spire`, `shatter`, `vaporize`, `superconduct`).
  13. `fx_sh_nova_venom` — Botanical jade/acid-violet spore crown → hollow bio-corona (`thorn_bloom`, `seed_harvest_bloom`, `caustic_pod_burst`, `toxic_blast`).
  14. `fx_sh_nova_void` — `F01–F05` logarithmic spiral inward accretion + dark event-horizon → `F06–F14` hollow violet rift shockwave (`void_implosion`, `gale_cyclone_vortex`, `reload_magnet_vortex`, `secret_trial`).

## 3. Subsystem Coverage
- **Core Combat FX (`combat-fx-pools.ts`, `combat-fx-spawners.ts`, `combat-fx.ts`, `texture-baker-fx.ts`):** Projectiles, muzzle bursts, hit sparks, melee slashes, generic explosions (`colorHex` → matched `fx_sh_nova_*`), 6 elemental reactions, boss kill burst, status bursts, and crisp Chiaroscuro decals.
- **Scene Layering & Event Dispatch (`GameScene.ts`, `telegraphs-and-overlays.ts`, `sim-events.ts`):** `groundHazardGraphics` at `depth: 16` vs `telegraphGraphics` at `depth: 38`; clean enemy danger telegraphs at `depth: 16`.
- **All 18 Weapons (`combat-fx-weapons-v2.ts`, `combat-fx-weapons-p1a.ts`, `combat-fx-weapons-p1b.ts`):** Full Batch-1 (`P1A`), Batch-2 (`P1B`), and Core V2 tactical events upgraded to Chiaroscuro shader flipbooks + `depth: 16` perimeter ground zones + shear-core energy filaments; weapon shout spam removed.
- **Props, Blessings, Pacts, Enemies/Bosses, Mutators & Duo Boons (`combat-fx-p1c.ts`, `combat-fx-blessings-p1d.ts`, `combat-fx-p2b.ts`, `combat-fx-p3a.ts`, `combat-fx-p4a.ts`, `combat-fx-p4b.ts`):** Upgraded end-to-end with deterministic `visualFreeze` compatibility and `0.5×` / `teammateFxOpacity` co-op scaling.

## 4. Verification Strategy
1. Unit & integration tests (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`).
2. Real-image visual verification via `pnpm shots` across core combat, 4P co-op (`b1-combat-4p`, `stress-4p`), Batch-1 & Batch-2 weapon strip scenes, tactical props, blessings, boss armor break, and Duo Boons — opening and inspecting actual rendered `.png` screenshots and multi-frame strips via `read_file` and iterating on any visual defects before completion.
