# Cutout 2.0 VFX Overhaul (Phase 3: Biome 2 Ice Mirror & Bullet-Split Removal, Tactical Props & World Interactions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all mirror glare and chaotic environmental pillar bullet-splitting/laser-bouncing in Biome 2 (*Hầm Băng Vĩnh Cửu*), sync `kryssa_clone` to *Frost Mirage*, and upgrade all Biome 1–3 tactical props, material break shards, world shrines/chests, doors, and room teleports to crisp Cutout 2.0.

**Architecture:** Execute `Track A-Clean` (delete `arch_b2_godray_shaft` `-107,520 B` VRAM and per-frame `'ice'` glints; rebake `'ice'` tiles as matte **Packed Frosted Rime-Glacier** `#31627D` / `#2C5E7A` / `#1E3A5F` / `#6BA6C2`), `Track B-Gameplay+Visual` (replace `cryo_prism_pillar` 3-way bullet splitting with **`Cryo Tuning Obelisk`** `r = 72px` enemy-only Chill pulse on `1.20s` ICD, and replace `crystal_pillar` laser bouncing with **`Permafrost Bastion Pillar`** solid cover across server and client prediction), and `Track C` (`kryssa_clone` `alpha = 0.76` Frost Mirage). Upgrade remaining tactical props, `4` material break shard decals, `Wall-Slam` / `Ring-Out` / `Cracked Wall`, gothic `DOOR_BARRIER_FRAG`, and `spawnArcaneTeleportFold`.

**Tech Stack:** TypeScript, `@ashen-pact/shared` (`WorldSim` deterministic physics), Phaser 3 (`WebGL1` / `Canvas2D`), Vitest, Playwright visual scene helpers.

**Spec:** `docs/superpowers/specs/2026-11-15-cutout-vfx-and-ice-mirror-overhaul-design.md` (Sections 5.3, 5.4 `C.3`, 6.1, 6.6–6.7, 6.10–6.14, 7.1–7.3)

## Global Constraints

- Player opt-in Blessings/Mutators (`table_tech_prism_split`, `bullet_split_bounce`, `mutator_prism_splitter`) and Co-op Vanguard shield `focus_laser` refraction MUST retain their `WorldSim` mechanics; ONLY environmental `cryo_prism_pillar` and `crystal_pillar` lose bullet-splitting/bouncing.
- Keep `prop.kind = 'cryo_prism_pillar'` and `prop.kind = 'crystal_pillar'` unchanged in `SimPropState` so Biome 2 room archetype layouts and seeds remain `100%` deterministic.
- `triggerCryoTuningObeliskPulse` MUST consume `0` `sim.rng` calls and deal `0` friendly-fire damage to players/allies.
- `Portal` shader constants (`particleCount = 8`, `rayCount = 3`) and `#0B090E` Exterior Void (`depth 36.2 > 36.0`) MUST remain untouched.

## Review Focus

1. **Canvas2D `ctx.save()` leak or `T1-F5-03` / `T5-WB-05` / `T5-WB-23` surface palette regression in `drawSurfaceTile('ice')`:** `drawSurfaceTile('ice')` must close **both** inner and outer `ctx.restore()` calls before `return;`, keep `#31627D` base (`ΔRGB >= 42/255` from `'electrified_water'` `#234463`), `#2C5E7A` recess, `#1E3A5F` + `#6BA6C2` + `#141019` Voronoi cracks anchored at `(0,16)/(32,16)`, and `#CFE8EE` shoreline (pinned in Task 1 Step 1).
2. **Client-prediction `0.12s` bullet freeze (`awaitingServerRedirectTimer`) on Biome 2 pillars:** Removing `pr.kind === 'cryo_prism_pillar' ||` from `sim-weapon-cadence.ts:779` AND terminating bullets immediately at `crystal_pillar` in client cosmetic prediction (`sim-projectiles.ts:831-840`) are mandatory so client bullets terminate cleanly instead of hanging in mid-air (pinned in Task 2 Step 1).
3. **`Cryo Tuning Obelisk` RNG drift, friendly fire, or broken Vanguard shield `focus_laser` refraction:** Hitting `cryo_prism_pillar` with a player bullet or `focus_laser` must trigger `14` Chill DMG + `2.0s` `'chill'` (`r = 72.0px`, `1.20s` per-prop ICD) on enemies only (`0` RNG calls), while firing `focus_laser` through an active Vanguard shield must still refract into fan rays (pinned in Task 2 Step 1).
4. **4-file `kryssa_clone` name desync or missing `0.76` illusion alpha:** `vi.json`, `en.json`, `enemies.ts`, and `rig-defs-biome2-boss.ts` must all match `"Ảo Ảnh Sương Giá Kryssa"` / `"Kryssa Frost Mirage"`, and `entity-sync.ts:309` must set `rig.container.setAlpha(isIllusion ? 0.76 : 1.0)` (pinned in Task 2 Step 1).
5. **Swallowed `cracked_wall_broken` burst (`hud-pact-and-forge-modals.ts:708`) or scorch decals on non-explosive props:** `cracked_wall_broken` must invoke `spawnCrackedWallBurst` before returning, and `fx_decal_scorch` must only spawn for `explosive_barrel` and `coal_bomb` while wood/ceramic/stone/ice props scatter `<= 6px` material shards (pinned in Task 3 Step 1).

---

## File Structure

- **Modify (Track A — Client Biome 2 Mirror Removal):** `apps/client/src/world/biome-architecture.ts`, `apps/client/src/world/biome-architecture-render.ts`, `apps/client/src/art/texture-baker-surfaces.ts`, `apps/client/src/scenes/game-scene/arena-tiles.ts`, `apps/client/src/art/texture-baker-props-p1c.ts`, `tests/e2e/helpers/map-overhaul-harness.ts`.
- **Modify (Track B & C — `WorldSim` + Client Pillars & `kryssa_clone`):** `packages/shared/src/sim/world-sim-types.ts`, `packages/shared/src/sim/sim-tactical-physics-p1c.ts`, `packages/shared/src/sim/sim-projectiles.ts`, `packages/shared/src/sim/sim-weapon-cadence.ts`, `packages/shared/src/sim/sim-weapon-specials-p1b-ranged.ts`, `packages/shared/src/sim/sim-enemies-tactical-b23.ts`, `packages/shared/src/i18n/vi.json`, `packages/shared/src/i18n/en.json`, `packages/shared/src/data/enemies.ts`, `apps/client/src/art/rig-defs-biome2-boss.ts`, `apps/client/src/art/texture-baker-props.ts`, `apps/client/src/fx/combat-fx-p1c.ts`, `apps/client/src/fx/lighting-pipeline.ts`, `apps/client/src/scenes/game-scene/entity-sync.ts`, `tests/e2e/helpers/visual-scene-ap2-p1c.ts`, `tests/e2e/helpers/visual-scene-ap2-p1b.ts`.
- **Modify (Props, Shards, World, Door, Teleport, Docs):** `apps/client/src/fx/combat-fx-p3a.ts`, `apps/client/src/fx/combat-fx-p4a.ts`, `apps/client/src/fx/combat-fx.ts`, `apps/client/src/fx/portal-door-shaders.ts`, `apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts`, `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts`, `apps/client/src/scenes/game-scene/room-entities-sync.ts`, `PROJECT.md`.
- **Modify Tests:** `apps/client/test/polish-p5-biome-architecture.test.ts`, `apps/client/test/round3-lighting-architecture-minimap.test.ts`, `apps/client/test/round3-tiles-surfaces-bridges.test.ts`, `tests/e2e/map-overhaul-e2e.test.ts`, `packages/shared/test/ap2-p1c-biome2-ecosystem.test.ts`, `packages/shared/test/ap2-p3a-biome2-enemies.test.ts`, `packages/shared/test/ap2-p1b-ranged-weapons.test.ts`, `packages/shared/test/boss-bullet-hell-kinematics-graze.test.ts`, `packages/shared/test/phase6-biomes.test.ts`, `apps/client/test/ap2-p1c-props-fx.test.ts`, `apps/client/test/round4-minimap-teleport-barricades.test.ts`, `apps/client/test/polish-p8-portal-door.test.ts`.

---

### Task 1: Biome 2 `Track A-Clean` — Remove God-Rays & Ice Glints, Rebake Matte Rime-Glacier `'ice'` Surface & Ice Props

**Files:**
- Modify: `apps/client/src/world/biome-architecture.ts:958-988`
- Modify: `apps/client/src/world/biome-architecture-render.ts:717-786, 837, 909, 930-942, 991-1025, 1210-1213`
- Modify: `apps/client/src/art/texture-baker-surfaces.ts:212-233, 533-643`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts:630-640`
- Modify: `apps/client/src/art/texture-baker-props-p1c.ts:154-263, 294-331`
- Modify: `tests/e2e/helpers/map-overhaul-harness.ts:1725, 2327, 2364-2368`
- Test: `apps/client/test/polish-p5-biome-architecture.test.ts`, `apps/client/test/round3-lighting-architecture-minimap.test.ts`, `apps/client/test/round3-tiles-surfaces-bridges.test.ts`, `tests/e2e/map-overhaul-e2e.test.ts`

**Interfaces:**
- Consumes: `PALETTE` (`apps/client/src/art/palette.ts`).
- Produces:
  - `buildBiomeArchitecturePlan(map)` returns `godRays: []` for all biomes (`1`, `2`, `3`); `'arch_b2_godray_shaft'` texture is never created (`-107,520 B` VRAM).
  - `resolveSurfaceShorelineColors('ice')` returns `{ outerBank: '#31627D', innerLip: '#CFE8EE' }`.

- [ ] **Step 1: Update and add failing tests in `polish-p5-biome-architecture.test.ts`, `round3-lighting-architecture-minimap.test.ts`, `round3-tiles-surfaces-bridges.test.ts`, and `map-overhaul-e2e.test.ts`**

```ts
it('emits zero godRays in Biome 2, removes arch_b2_godray_shaft, and balances ctx.save/restore in drawSurfaceTile("ice")', () => {
  const b2Plan = buildBiomeArchitecturePlan(createBiomeTestMap(2));
  expect(b2Plan.godRays).toHaveLength(0);

  const ctx = createSpyCanvas2DContext();
  drawSurfaceTile(ctx as never, 'ice', 0, 15);
  expect(ctx.saveCount).toBe(ctx.restoreCount);
  expect(ctx.strokeColors).toEqual(expect.arrayContaining(['#6BA6C2', '#1E3A5F', '#141019']));
  expect(ctx.fillColors).toEqual(expect.arrayContaining(['#31627D', '#2C5E7A']));
  expect(resolveSurfaceShorelineColors('ice')).toEqual({ outerBank: '#31627D', innerLip: '#CFE8EE' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/polish-p5-biome-architecture.test.ts test/round3-lighting-architecture-minimap.test.ts test/round3-tiles-surfaces-bridges.test.ts`
Expected: FAIL (`b2Plan.godRays.length > 0`, `outerBank` is not `'#31627D'`).

- [ ] **Step 3: Implement Biome 2 `Track A-Clean` across architecture, `'ice'` surface baker, shoreline colors, and ice props**

- In `biome-architecture.ts:958-988`: return `godRays: []` for Biome 2.
- In `biome-architecture-render.ts`: delete `GOD_RAY_TEX_KEY` (`'arch_b2_godray_shaft'`), `ensureGodRayTexture`, `godRaySprites` (`717-786, 837, 930-942, 1210-1213`), remove `s === 'ice' ||` from `hasAnimatedSurface` (`:909`), add `s === 'ice'` to the early `continue` (`:991-997`), and delete per-frame `'ice'` `0xe0f2fe` glint rendering (`:1015-1025`).
- In `texture-baker-surfaces.ts:533-643` (`drawSurfaceTile('ice')`) and `:212-233` (`'surface_ice'`): paint **Packed Frosted Rime-Glacier** — `#31627D` opaque base (`globalAlpha = 1.0`), `#2C5E7A` deep recess pocket (`globalAlpha = 1.0`), `#3B7391` (`globalAlpha = 0.55`) asymmetric matte slab, 3-pass Voronoi fissure (`#6BA6C2` `2.0px @ 0.50`, `#1E3A5F` `1.40px @ 0.68`, `#141019` `0.95px @ 0.82`, anchored at `(0, 16)` / `(32, 16)` when `hasW` / `hasE` for seamless cross-tile continuity), `#141019` `3.2px` + `#CFE8EE` `1.7px` shoreline rim when `surfaceMask !== 15`, and **close both inner and outer `ctx.restore()` calls before `return;`**.
- In `arena-tiles.ts:634`: set `'ice'` shoreline to `{ outerBank: '#31627D', innerLip: '#CFE8EE' }`.
- In `texture-baker-props-p1c.ts`: rebake `prop_sliding_ice_block` (`:294-331`, matte `#3B7391` / `#264E66` with recessed directional cross-chevron, zero `45°` `ICE_WHITE` mirror slash) and `prop_glacial_barricade` (`:154-263`, `#356D8E` / `#264E66`, `< 15%` `#CFE8EE` top crest).
- In `tests/e2e/helpers/map-overhaul-harness.ts`: add `&& !colors.has('#31627D')` at `:1725` and remove `'ice'` animated glint expectations at `:2327, 2364-2368`; update `map-overhaul-e2e.test.ts` (`2668-2678, 5105-5124`) to assert `0` `godRays` and absence of `'arch_b2_godray_shaft'`.

- [ ] **Step 4: Run surface, architecture, and map-overhaul E2E tests**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/polish-p5-biome-architecture.test.ts test/round3-lighting-architecture-minimap.test.ts test/round3-tiles-surfaces-bridges.test.ts && pnpm exec vitest run --config tests/e2e/vitest.config.ts tests/e2e/map-overhaul-e2e.test.ts`
Expected: PASS (`T1-F5-03`, `T5-WB-05`, `T5-WB-23`, and all Biome 2 architecture checks green).

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/world/biome-architecture.ts apps/client/src/world/biome-architecture-render.ts apps/client/src/art/texture-baker-surfaces.ts apps/client/src/scenes/game-scene/arena-tiles.ts apps/client/src/art/texture-baker-props-p1c.ts apps/client/test/polish-p5-biome-architecture.test.ts apps/client/test/round3-lighting-architecture-minimap.test.ts apps/client/test/round3-tiles-surfaces-bridges.test.ts tests/e2e/helpers/map-overhaul-harness.ts tests/e2e/map-overhaul-e2e.test.ts
git commit -m "feat(biome2): remove god-rays and ice mirror glare, bake matte rime-glacier ice"
```

---

### Task 2: Biome 2 `Track B-Gameplay+Visual` & `Track C` — `Cryo Tuning Obelisk`, `Permafrost Bastion Pillar` & `Kryssa Frost Mirage`

**Files:**
- Modify: `packages/shared/src/sim/world-sim-types.ts:155-201`
- Modify: `packages/shared/src/sim/sim-tactical-physics-p1c.ts:201-330, 678-705`
- Modify: `packages/shared/src/sim/sim-projectiles.ts:447-498, 831-870`
- Modify: `packages/shared/src/sim/sim-weapon-cadence.ts:774-782`
- Modify: `packages/shared/src/sim/sim-weapon-specials-p1b-ranged.ts:118-174, 195-210`
- Modify: `packages/shared/src/sim/sim-enemies-tactical-b23.ts:254-365`
- Modify: `packages/shared/src/i18n/vi.json:666`, `packages/shared/src/i18n/en.json:666`, `packages/shared/src/data/enemies.ts:198-199`
- Modify: `apps/client/src/art/rig-defs-biome2-boss.ts:330-390`, `apps/client/src/art/texture-baker-props.ts`, `apps/client/src/art/texture-baker-props-p1c.ts`, `apps/client/src/fx/combat-fx-p1c.ts`, `apps/client/src/fx/lighting-pipeline.ts:666-672`, `apps/client/src/scenes/game-scene/entity-sync.ts:305-315, 440-455`
- Modify: `tests/e2e/helpers/visual-scene-ap2-p1c.ts:480-518`, `tests/e2e/helpers/visual-scene-ap2-p1b.ts:199, 445-478`
- Test: `packages/shared/test/ap2-p1c-biome2-ecosystem.test.ts`, `packages/shared/test/ap2-p3a-biome2-enemies.test.ts`, `packages/shared/test/ap2-p1b-ranged-weapons.test.ts`, `packages/shared/test/boss-bullet-hell-kinematics-graze.test.ts`, `packages/shared/test/phase6-biomes.test.ts`, `apps/client/test/ap2-p1c-props-fx.test.ts`

**Interfaces:**
- Consumes: `routeCutoutBurstByRadius`, `routeCutoutDirectionalByReach` (`Plan 1 Task 4`).
- Produces:
  - `SimPropState.prismPulseCooldownSec?: number;`
  - `export const CRYO_OBELISK_PULSE_RADIUS = 72;`
  - `export const CRYO_OBELISK_PULSE_DAMAGE = 14;`
  - `export const CRYO_OBELISK_PULSE_CHILL_SEC = 2.0;`
  - `export const CRYO_OBELISK_PULSE_COOLDOWN_SEC = 1.2;`
  - `export function triggerCryoTuningObeliskPulse(sim: WorldSim, obelisk: SimPropState, ownerPlayerId?: number): boolean`

- [ ] **Step 1: Write failing shared & client tests for `Cryo Tuning Obelisk`, `Permafrost Bastion Pillar` (server + client prediction), Vanguard shield `focus_laser`, and `kryssa_clone`**

```ts
it('absorbs player bullets on cryo_prism_pillar without splitting, emits r=72px enemy-only Chill pulse (14 DMG, 2.0s chill, 1.20s ICD, 0 RNG calls), and does not freeze client prediction', () => {
  const sim = createBiome2TestSim();
  const obelisk = spawnTestProp(sim, 'cryo_prism_pillar', 300, 300);
  const enemy = spawnTestEnemy(sim, 'frost_archer', 355, 300); // dist 55 <= 72 + r
  const rngBefore = sim.rng.getState();

  firePlayerBoltIntoProp(sim, obelisk);
  expect(sim.projectiles.filter((p) => p.team === 'player' && p.ttlSec > 0)).toHaveLength(0);
  expect(( sim.projectiles[0]?.shotFlags ?? 0 ) & SHOT_FLAG.DYNAMIC_BOUNCE).toBe(0);
  expect(enemy.chillTimer).toBeGreaterThanOrEqual(1.9);
  expect(obelisk.prismPulseCooldownSec).toBeCloseTo(1.2, 2);
  expect(sim.rng.getState()).toBe(rngBefore);
});

it('terminates kryssa_ice_beam and bullets on crystal_pillar across both server and client cosmetic prediction while preserving Vanguard shield focus_laser refraction', () => {
  const sim = createBiome2TestSim();
  const bastion = spawnTestProp(sim, 'crystal_pillar', 320, 240);
  spawnEnemyBeamBolt(sim, 'kryssa_ice_beam', 260, 240, 0);
  sim.step(1 / 60);
  expect(sim.projectiles.filter((p) => p.weaponId === 'kryssa_ice_beam' && p.ttlSec > 0)).toHaveLength(0);

  const clientSim = createClientCosmeticSimWithProp('crystal_pillar', 320, 240);
  const predBolt = spawnPredictedPlayerBolt(clientSim, 315, 240, 0);
  clientSim.stepCosmeticProjectiles(1 / 60);
  expect(predBolt.awaitingServerRedirectTimer ?? 0).toBe(0);
  expect(predBolt.ttlSec).toBeLessThanOrEqual(0);
});

it('syncs kryssa_clone Frost Mirage labels across all 4 files and sets container alpha to 0.76', () => {
  expect(ENEMIES.kryssa_clone.nameVi).toBe('Ảo Ảnh Sương Giá Kryssa');
  expect(viJson.enemies.kryssa_clone.name).toBe('Ảo Ảnh Sương Giá Kryssa');
  expect(enJson.enemies.kryssa_clone.name).toBe('Kryssa Frost Mirage');
  expect(KRYSSA_CLONE_RIG_DEF.labelVi).toBe('Ảo Ảnh Sương Giá Kryssa');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/shared exec vitest run test/ap2-p1c-biome2-ecosystem.test.ts test/ap2-p3a-biome2-enemies.test.ts test/ap2-p1b-ranged-weapons.test.ts test/phase6-biomes.test.ts`
Expected: FAIL (bullets split into 3 rays, `kryssa_ice_beam` bounces off `crystal_pillar`, `kryssa_clone` still named `"Phân Thân Gương Kryssa"`).

- [ ] **Step 3: Implement `Track B-Gameplay+Visual` & `Track C` across `@ashen-pact/shared`, `@ashen-pact/client`, and visual scene helpers**

1. **`Cryo Tuning Obelisk` (`cryo_prism_pillar`):**
   - Add `prismPulseCooldownSec?: number;` to `SimPropState` (`world-sim-types.ts`) and tick it down by `dtSec` inside `updateP1CTacticalProps` (`sim-tactical-physics-p1c.ts`).
   - Replace 3-way volley splitting in `sim-tactical-physics-p1c.ts` with `triggerCryoTuningObeliskPulse(sim, obelisk, ownerPlayerId)`: sets `obelisk.hitFlashTimer = 0.16`; if `(obelisk.prismPulseCooldownSec ?? 0) > 0`, returns `false`; otherwise sets `obelisk.prismPulseCooldownSec = 1.20`, emits `{ kind: 'explosion', x: obelisk.x, y: obelisk.y, radius: 72, damage: 14, sourceDefId: 'cryo_prism_pillar' }`, and applies `14` Chill damage + `2.0s` `'chill'` (`1` stack) to alive enemies within `72 + e.radius` (`0` friendly-fire, `0` `sim.rng` calls).
   - In `sim-projectiles.ts:485-498`: on player bullet impact with `cryo_prism_pillar`, set `b.ttlSec = 0`, call `triggerCryoTuningObeliskPulse(this, prop, b.ownerId)`, `hitProp = true; break;`; on enemy bullet impact, set `prop.hitFlashTimer = 0.12`, `b.ttlSec = 0`, `hitProp = true; break;`.
   - In `sim-weapon-cadence.ts:779`: remove `pr.kind === 'cryo_prism_pillar' ||` (keep `pr.prismAuraActive` for `table_tech_prism_split`).
   - In `sim-weapon-specials-p1b-ranged.ts:118-133, 201`: stop refracting `focus_laser` on `cryo_prism_pillar` (clamp the beam segment at the Obelisk surface and call `triggerCryoTuningObeliskPulse` instead), while **keeping** lines `135-169` so `focus_laser` still refracts through active Vanguard shields!
   - In `sim-enemies-tactical-b23.ts:254-365`: make `findIceMageTargetPrism` return `null` so `ice_mage` aims directly at players.
   - Client art & FX: rebake `prop_cryo_prism_pillar` (`42×48px` 3-pronged tuning-fork stone monolith, `#264E66` / `PALETTE.SLATE_DARK`, `2.0px` `#141019` ink, `lightRadius = 72, alpha = 0.14`, `bob = 0` in `entity-sync.ts:445`, Y-rune `#38BDF8` when `(prop.prismPulseCooldownSec ?? 0) <= 0` else `#1E3A5F`); route `'cryo_prism_pillar'` explosion in `combat-fx-p1c.ts` via `routeCutoutBurstByRadius(fx, ev.x, ev.y, 72, 'fx_sh_nova_cryo')`.
2. **`Permafrost Bastion Pillar` (`crystal_pillar`):**
   - In `sim-projectiles.ts:447-467` (server) AND `sim-projectiles.ts:831-840` (client cosmetic prediction): delete `kryssa_ice_beam` / `+0.65π` reflection and `awaitingServerRedirectTimer`; terminate hitting projectiles cleanly (`prop.hitFlashTimer = 0.16`, `b.ttlSec = 0`, `hitProp = true`, `pushImpactEvent(..., hitWall = true)`), with `120 ms` per-`propId` wall-clamped `r <= 16px` frost-chip directional burst on the client.
   - Rebake `prop_crystal_pillar` (`38×44px` flat-top octagonal frost-stone bastion `#264E66` / `#1D3557`, `2.0px` `#141019` ink, hollow `#38BDF8` `6×10px` diamond glyph, `bob = 0`, steady `alpha = 0.16`, `lightRadius = 84` in `lighting-pipeline.ts:666`).
3. **`Track C` (`kryssa_clone`):**
   - Sync `"Ảo Ảnh Sương Giá Kryssa"` / `"Kryssa Frost Mirage"` in `vi.json:666`, `en.json:666`, `enemies.ts:198-199`, and `rig-defs-biome2-boss.ts:336`; recolor `KRYSSA_CLONE_RIG_DEF` to `#356D8E` / `#6BA6C2` / `#5B4B8A` (`outlineWidth: 1.8` `#141019`); set `rig.container.setAlpha(isIllusion ? 0.76 : 1.0)` in `entity-sync.ts:309`.
4. Update `visual-scene-ap2-p1c.ts:480-518` (`ap2-b2-prism-refract` -> `Cryo Tuning Obelisk` pulse, `apexEvent: 'explosion'`) and `visual-scene-ap2-p1b.ts:199, 445-478` (test `focus_laser` fan refraction via active Vanguard shield).

- [ ] **Step 4: Run shared & client Biome 2 tests and typecheck**

Run: `pnpm --filter @ashen-pact/shared exec vitest run test/ap2-p1c-biome2-ecosystem.test.ts test/ap2-p3a-biome2-enemies.test.ts test/ap2-p1b-ranged-weapons.test.ts test/boss-bullet-hell-kinematics-graze.test.ts test/phase6-biomes.test.ts test/shared.test.ts && pnpm --filter @ashen-pact/client exec vitest run test/ap2-p1c-props-fx.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared apps/client/src/art/rig-defs-biome2-boss.ts apps/client/src/art/texture-baker-props.ts apps/client/src/art/texture-baker-props-p1c.ts apps/client/src/fx/combat-fx-p1c.ts apps/client/src/fx/lighting-pipeline.ts apps/client/src/scenes/game-scene/entity-sync.ts apps/client/test/ap2-p1c-props-fx.test.ts tests/e2e/helpers/visual-scene-ap2-p1c.ts tests/e2e/helpers/visual-scene-ap2-p1b.ts
git commit -m "feat(biome2): replace prism bullet-splitting and laser bouncing with Cryo Tuning Obelisk and Permafrost Bastion"
```

---

### Task 3: Remaining Tactical Props (`P1C`/`P3A`), `4` Material Break Shards, World Interactions, Gothic Door Shader & `spawnArcaneTeleportFold`

**Files:**
- Modify: `apps/client/src/fx/combat-fx-p1c.ts`
- Modify: `apps/client/src/fx/combat-fx-p3a.ts`
- Modify: `apps/client/src/fx/combat-fx-p4a.ts`
- Modify: `apps/client/src/fx/combat-fx.ts`
- Modify: `apps/client/src/fx/portal-door-shaders.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts:705-716`
- Modify: `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts`
- Modify: `apps/client/src/scenes/game-scene/room-entities-sync.ts`
- Modify: `PROJECT.md:35-65, 110-125`
- Test: `apps/client/test/ap2-p1c-props-fx.test.ts`, `apps/client/test/round4-minimap-teleport-barricades.test.ts`, `apps/client/test/polish-p8-portal-door.test.ts`, `tests/e2e/map-overhaul-e2e.test.ts`

**Interfaces:**
- Consumes: `routeCutoutBurstByRadius`, `routeCutoutDirectionalByReach` (`Plan 1 Task 4`); `fillTaperedArcRibbon`, `strokeCutoutQuadStripFromScratch` (`Plan 1 Task 3`); `CUTOUT_KIT_ATLAS_KEY` (`fx_wood_shard`, `fx_ceramic_shard`, `fx_stone_chip`, `fx_ice_shard_decal`, `prop_cryo_node`, `prop_rocket_nozzle`, `prop_cryo_spire`) (`Plan 1 Task 2`).
- Produces:
  - `export function spawnPropBreakBurst(fx: CombatFxManager, propKind: PropKind, x: number, y: number): void`
  - `export function spawnCrackedWallBurst(fx: CombatFxManager, x: number, y: number): void`
  - `export function spawnArcaneTeleportFold(fx: CombatFxManager, x: number, y: number): void`

- [ ] **Step 1: Write failing tests in `ap2-p1c-props-fx.test.ts`, `round4-minimap-teleport-barricades.test.ts`, and `polish-p8-portal-door.test.ts`**

```ts
it('routes prop breaks to 4 material shard decals (scorch only on explosive_barrel / coal_bomb) and invokes spawnCrackedWallBurst on cracked_wall_broken', () => {
  const { fx } = createTestCombatFx();
  spawnPropBreakBurst(fx, 'crate', 100, 100);
  expect(fx.decalPool.some((d) => d.active && d.textureKey.includes('fx_wood_shard'))).toBe(true);
  expect(fx.decalPool.some((d) => d.active && d.textureKey === 'fx_decal_scorch')).toBe(false);

  spawnPropBreakBurst(fx, 'explosive_barrel', 200, 200);
  expect(fx.decalPool.some((d) => d.active && d.textureKey === 'fx_decal_scorch')).toBe(true);
});

it('replaces shockwave_spawned teleport spoof with spawnArcaneTeleportFold + clean "DỊCH CHUYỂN!" while keeping Portal shader constants intact', () => {
  const { scene, fx } = createTeleportTestScene();
  teleportToRoomImpl.call(scene, 2);
  expect(fx.lastTeleportFoldPos).toBeDefined();
  expect(fx.lastFloatingAlertText).toBe('DỊCH CHUYỂN!');
  expect(PORTAL_VORTEX_DEFAULTS.particleCount).toBe(8);
  expect(PORTAL_VORTEX_DEFAULTS.rayCount).toBe(3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/ap2-p1c-props-fx.test.ts test/round4-minimap-teleport-barricades.test.ts test/polish-p8-portal-door.test.ts`
Expected: FAIL (`crate` spawns scorch or lacks `fx_wood_shard`; `teleportToRoomImpl` still spoofs `shockwave_spawned`).

- [ ] **Step 3: Implement tactical prop overlays, `4` material shards, world shrines/chests, gothic `DOOR_BARRIER_FRAG`, `spawnArcaneTeleportFold`, and `PROJECT.md` sync**

- **Barricades & Tactical Props (`combat-fx-p1c.ts`, `combat-fx-p3a.ts`, `combat-fx-p4a.ts`):**
  - Unify sliding prop trails to a single V-groove floor scrape (`depth 16.0`).
  - Replace all `4` barricade status `strokeCircle`s with sprite/corner attachments: `cryoChargedByLaser` -> `prop_cryo_node` (`6×6px` pulsing frost crystal), `prismAuraActive` -> `4` emerald corner arcs, `rocketCharged` -> `prop_rocket_nozzle` (`10×6px` + `1` ember), `bouncesRemaining` -> `2` steel bumper caps; `cryoShatterSpire` -> `prop_cryo_spire` (`26×38px`).
  - Bespoke prop choreography: `forge_blast_shield` (`depth 26.6` `fillTaperedArcRibbon` heat wave), `pneumatic_press` (`4` industrial `#141019` + `#F59E0B` L-brackets on `depth 16.0` + `4` cardinal steam puffs), `slag_crucible` (3-phase tilt/pour/basalt-crust rim at `depth 16.0`), `rotten_totem_pillar` (falling trunk shadow + `depth 26.4` `spore_cloud`), `caustic_spore_pod` (organic pulse, delete double wireframe rings).
- **Material Shards & Environmental Impacts (`combat-fx.ts`, `hud-pact-and-forge-modals.ts:708`):**
  - Route `spawnPropBreakBurst` to `fx_wood_shard` (`crate`, `moss_table`, `rotten_totem_pillar`), `fx_ceramic_shard` (`vase`, `spore_pod`, `volatile_spore_pod`, `caustic_spore_pod`), `fx_stone_chip` (`brazier`, `forge_blast_shield`, `slag_crucible`, `shaman_totem`), and `fx_ice_shard_decal` (`glacial_barricade`, `glacial_spike`, `sliding_ice_block`, `cryo_prism_pillar`) at `depth 6.0` (`alpha = 0.32`, `<= 6px`), spawning `fx_decal_scorch` **only** on `explosive_barrel` and `coal_bomb`.
  - Clamp `wall_slam` impact to a `180°` wall-aligned crescent (`routeCutoutDirectionalByReach`, zero bleeding inside solid wall tiles); render `ring_out` as a crisp `4`-point abyssal star; invoke `spawnCrackedWallBurst` before returning in `hud-pact-and-forge-modals.ts:708`.
- **World, Doors & Teleport (`room-entities-sync.ts`, `portal-door-shaders.ts`, `hud-qol-and-minimap.ts`, `PROJECT.md`):**
  - Render vertical Cutout trapezoid light shafts (`alpha <= 0.16`, `depth 35.0`) + `2.12 : 1` `depth 15.0` highlight foot-rings for Chest, Upgrade/Daedalus Anvil, Shrine, and Pact Altar; replace `salvageHoldTimer` circle with a `3`-jaw mechanical clamp.
  - Upgrade `DOOR_BARRIER_FRAG` (`portal-door-shaders.ts`) to vertical gothic iron bars wrapped in `#141019` ink + horizontal arcane lock-chain (`Portal` `PORTAL_VORTEX_FRAG` keeps `particleCount = 8, rayCount = 3`).
  - Implement `spawnArcaneTeleportFold` (`depth 15.0` `2.12:1` rune ellipse + vertical `#38BDF8` fold slit + `'DỊCH CHUYỂN!'`), update `round4-minimap-teleport-barricades.test.ts` & `map-overhaul-e2e.test.ts` (`T5-WB-30`), and sync `PROJECT.md` (`lines 38, 60, 117`).

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/ap2-p1c-props-fx.test.ts test/round4-minimap-teleport-barricades.test.ts test/polish-p8-portal-door.test.ts && pnpm exec vitest run --config tests/e2e/vitest.config.ts tests/e2e/map-overhaul-e2e.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/fx/combat-fx-p1c.ts apps/client/src/fx/combat-fx-p3a.ts apps/client/src/fx/combat-fx-p4a.ts apps/client/src/fx/combat-fx.ts apps/client/src/fx/portal-door-shaders.ts apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts apps/client/src/scenes/game-scene/room-entities-sync.ts apps/client/test/ap2-p1c-props-fx.test.ts apps/client/test/round4-minimap-teleport-barricades.test.ts apps/client/test/polish-p8-portal-door.test.ts tests/e2e/map-overhaul-e2e.test.ts PROJECT.md
git commit -m "feat(vfx): upgrade tactical props, 4 material shards, gothic door shader, and arcane teleport fold"
```
