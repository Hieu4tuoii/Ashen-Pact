# Cutout 2.0 VFX Overhaul (Phase 2: Bespoke 18-Weapon Choreography, `HEAT_VENT` Puffs & Hitbox-Honest Weapon Hazards) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement compact, unmistakable, `1:1` hitbox-honest Cutout 2.0 visual choreography across all `18` weapons—eliminating wireframe `strokeCircle` clutter, pellet flipbook spam, `O(N^2)` tether webs, and oversized washout explosions while preserving gameplay readability in 4-player Co-op.

**Architecture:** Route all weapon bursts and slashes through Phase 1's `routeCutoutBurstByRadius` and `routeCutoutDirectionalByReach`, draw curved beams/whips/arcs via zero-allocation `fillTaperedQuadraticBezier` / `fillTaperedArcRibbon` / `fillTaperedLightningBolt` (`tapered-ribbon-builder.ts`), and render persistent weapon AoE perimeters at `depth 16.0` (`groundHazardGraphics`) + `depth 26.6` (`underActorGraphics`) strictly beneath actors (`depth >= 28.0`). Unify overheat feedback across all `5` `HEAT_VENT` weapons via `fx_overheat_puff` (`6×6px`, `0.18s` cadence).

**Tech Stack:** TypeScript, Phaser 3 (`WebGL1` / `Canvas2D`), Vitest, Playwright (`tests/e2e/polish-p10b.spec.ts`).

**Spec:** `docs/superpowers/specs/2026-11-15-cutout-vfx-and-ice-mirror-overhaul-design.md` (Sections 5.1–5.2, 6.3, 6.5, 6.8)

## Global Constraints

- Every weapon AoE, slash reach, orbit radius, cyclone, geyser, and corridor MUST match `WorldSim` `1:1` at physics `(x, y)` (`0.0 px` center or radius drift).
- Zero `Graphics.strokeCircle` full-ring calls on airborne projectiles, solar orbits, or active black holes; zero `Curve.getPoints()` or `Graphics.fillPoints()` (`Earcut`).
- Ally weapon VFX MUST scale through `resolveAllyFxProfile` (`0.42×` bullets, `0.35×` AoE/melee/beams, `allowLightAndShake = false`) + `applyP1SafeHaloAlpha` (`× 0.15` within `18px + 0.35 * R` of local P1).
- Zero spammy weapon `spawnFloatingAlert` shouts unless explicitly preserved by the spec.

## Review Focus

1. **`emerald_cleaver` combo 3 double-slash or boomerang radius mismatch (`22px` flight vs `56px` spin):** `comboStep === 3` in `combat-fx-weapons-p1a.ts` must `return true` (with `PALETTE.LIME_GLOW` transient light) so `combat-fx-weapons-v2.ts` does not stack a second slash, and `boomerangPhase === 'spinning'` must render 3 `fillTaperedArcRibbon` crescents at `r = 56.0px` (`depth 26.6`) vs `r = 22.0px` in flight (pinned in Task 1 Step 1).
2. **`berserker_axe` `Guillotine Slam` stopping early at interior pillars or vanishing over `chasm` tiles:** The `8`-segment (`20px` step, `160 × 36px` = `±18.0px`) corridor must stop **only** at outer room perimeter walls, rendering jagged fissures on `groundHazardGraphics` (`depth 16.0`, naturally under `depth 25.0` pillars) and switching to a `depth 26.6` `±18.0px` fire-arc bridge across `TileKind.Chasm` cells (pinned in Task 1 Step 1).
3. **`focus_laser` `Railgun` (`28px = ±14px`) additive whiteout or missing Co-op Vanguard shield fan refraction:** `Railgun` must use the `2`-frame `#141019` inverted-ink core + `#F4F1EA` center + dashed `±14.0px` shock-rails (`depth 44.0`, tapered at muzzle), render `ev.refractedRays` through Vanguard shields with the same Cutout treatment, and emit `fx_overheat_puff` across all `5` `HEAT_VENT` weapons (pinned in Task 2 Step 1).
4. **`scrap_shotgun` 8-pellet flipbook explosion or `rivet_gun` `O(N^2)` web clutter:** Regular shotgun pellet hits must spawn `0` `fx_sh_*` flipbooks (using `fx_pellet_dent` `8×6px` + a single `26px` air-compression fan when `>= 3` pellets strike one target), and `rivet_gun` magnetic links must enforce `O(N)` nearest-neighbor chains (`degree <= 2`) (pinned in Task 3 Step 1).
5. **`magma_cannon` hiding active damage zones when geysers overlap `< 46px` or `frag_launcher` / `void_staff` drawing `Ø 208–220px` circles:** `magma_cannon` must render `100%` of `r = 56.0px` floor rims (`depth 16.0 + 26.6`) while downgrading only the vertical plume sprite to a `12px` magma boil (`depth 26.4`) when `< 46px` from an active tall plume; `frag_launcher` replaces the airborne `r = 104px` circle with `fx_frag_fuse_wheel` (`14×14px`), and `void_staff` replaces solid circles with `4` open `fillTaperedArcRibbon` arcs (`68%` open) at `r = 110.0px` (pinned in Task 3 Step 1).

---

## File Structure

- **Modify:** `apps/client/src/fx/combat-fx-weapons-v2.ts` — Base melee/ranged dispatch, `knight_sword` 3-hit combo & `Parry` (`fx_parry_winged_crest`), `scrap_shotgun` `0`-flipbook `fx_pellet_dent` + `>=3`-hit air fan, `HEAT_VENT` `fx_overheat_puff` ticker (`0.18s` cadence).
- **Modify:** `apps/client/src/fx/combat-fx-weapons-p1a.ts` & `apps/client/src/fx/combat-fx-weapons-p1a-entities.ts` — Batch-1 weapons: `hunter_crossbow` (`crossbow_rip` S-whip), `apprentice_staff` (`TriElementalBeam` `r = 36px`), `thorn_staff` (5 hooked briars), `rivet_gun` (`O(N)` hex rivets), `gale_smg` (`depth 26.6` `r = 96px` cyclone), `tesla_carbine` (`< 28°` lightning + `r = 88px` dome), `emerald_cleaver` (`1:1` `92.0px` slash + `56.0px` spin crescents), `solar_archon_staff` (`R = 48px` mini-suns + `R = 120px` eclipse supernova).
- **Modify:** `apps/client/src/fx/combat-fx-weapons-p1b.ts` — Batch-2 weapons: `frag_launcher` (`fx_frag_fuse_wheel` + `R = 104px` airburst), `seed_gun` (`Harvest Bloom` + 3 `fx_seed_heal_wisp`), `tether_staff` (S-curve + 4 magnetic jaws), `focus_laser` (heat tiers + `2`-frame `#141019` inverted `Railgun` `±14px` + Vanguard fan rays), `void_staff` (`r = 110px` open arcs + `4t` collapse), `berserker_axe` (`160×36px` corridor under pillars & chasm bridge), `magma_cannon` (`100%` `r = 56px` rims + `< 46px` plume height governor), `thunder_hammer` (`28×28px` spin/catch + `R = 110px` pillar).
- **Modify:** `apps/client/src/scenes/game-scene/sim-events.ts` & `apps/client/src/scenes/game-scene/entity-sync.ts` — Route weapon events and projectile overlays (`fx_frag_fuse_wheel`, `fx_thrown_thunder_hammer`, `proj_gale_wind_blade`, `fx_rivet_hex_head`, `HEAT_VENT` puff emitter) to the new weapon FX functions.
- **Modify Tests:** `apps/client/test/ap2-p1a-weapons-vfx-audio.test.ts`, `apps/client/test/ap2-p1b-weapons-fx.test.ts`, `apps/client/test/topdown-shader-vfx-spawners.test.ts`, `tests/e2e/polish-p10b.spec.ts`.

---

### Task 1: Melee & Hybrid Weapons (`knight_sword`, `emerald_cleaver`, `berserker_axe`, `thunder_hammer`)

**Files:**
- Modify: `apps/client/src/fx/combat-fx-weapons-v2.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1a.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1a-entities.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1b.ts`
- Test: `apps/client/test/ap2-p1a-weapons-vfx-audio.test.ts`, `apps/client/test/ap2-p1b-weapons-fx.test.ts`, `apps/client/test/topdown-shader-vfx-spawners.test.ts`

**Interfaces:**
- Consumes: `routeCutoutBurstByRadius`, `routeCutoutDirectionalByReach`, `resolveAllyFxProfile` (`Plan 1 Task 4`); `fillTaperedArcRibbon`, `fillTaperedLightningBolt`, `strokeCutoutQuadStripFromScratch` (`Plan 1 Task 3`); `CUTOUT_KIT_ATLAS_KEY` (`fx_parry_winged_crest`, `fx_thrown_thunder_hammer`) (`Plan 1 Task 2`).
- Produces:
  - `export function spawnKnightSwordComboSlash(fx: CombatFxManager, x: number, y: number, angleRad: number, rangePx: number, comboStep: 1 | 2 | 3, isTeammate: boolean): void`
  - `export function spawnMeleeParryDeflectFx(fx: CombatFxManager, x: number, y: number, angleRad: number, deflectedCount: number, isTeammate: boolean): void`
  - `export function spawnEmeraldCleaverSlash(fx: CombatFxManager, x: number, y: number, angleRad: number, rangePx: number, comboStep: 1 | 2 | 3, isTeammate: boolean): boolean`
  - `export function renderEmeraldBoomerangOverlay(underGfx: Phaser.GameObjects.Graphics, x: number, y: number, phase: 'outbound' | 'spinning' | 'returning', spinAngleRad: number, alpha: number): void`
  - `export function renderBerserkerGuillotineCorridor(groundGfx: Phaser.GameObjects.Graphics, underGfx: Phaser.GameObjects.Graphics, map: Pick<ArenaMap, 'width' | 'height' | 'getTile'>, x1: number, y1: number, x2: number, y2: number, halfWidthPx: number, alpha: number): { renderedSegments: number; chasmBridgeSegments: number }`
  - `export function spawnThunderHammerPillarFx(fx: CombatFxManager, ev: Extract<SimEvent, { kind: 'thunder_hammer_pillar' }>, isTeammate: boolean): void`

- [ ] **Step 1: Write failing tests in `ap2-p1a-weapons-vfx-audio.test.ts` and `ap2-p1b-weapons-fx.test.ts`**

```ts
it('renders emerald_cleaver 92px 1:1 on fx_sh_slash_emerald, returns true on combo 3 with LIME_GLOW, and draws 56px spin crescents', () => {
  const { fx, lights } = createTestWeaponFxHarness();
  const handled = spawnEmeraldCleaverSlash(fx, 200, 200, 0, 92, 3, false);
  expect(handled).toBe(true);
  const slash = fx.particlePool.find((p) => p.active && p.textureKey === 'fx_sh_slash_emerald');
  expect(slash?.startScale).toBeCloseTo(92 / (0.41 * 128), 3);
  expect(lights.lastColorHex).toBe(PALETTE.LIME_GLOW);

  const underGfx = createRecordingGraphicsMock();
  renderEmeraldBoomerangOverlay(underGfx as never, 300, 300, 'spinning', 0, 1.0);
  const maxDist = Math.max(...underGfx.fillTriangleCalls.flatMap((t) => [Math.hypot(t.x0 - 300, t.y0 - 300), Math.hypot(t.x1 - 300, t.y1 - 300)]));
  expect(maxDist).toBeGreaterThan(54);
  expect(maxDist).toBeLessThanOrEqual(56 + 1.8 * 1.36);
});

it('advances berserker_axe 160x36px corridor through interior pillars (depth 16) and bridges chasm tiles on depth 26.6, stopping only at outer perimeter walls', () => {
  const map = createTestMapWithInteriorPillarAndChasm(); // pillar at step 2, chasm at step 4, outer wall at step 7
  const groundGfx = createRecordingGraphicsMock();
  const underGfx = createRecordingGraphicsMock();
  const res = renderBerserkerGuillotineCorridor(groundGfx as never, underGfx as never, map, 96, 160, 256, 160, 18, 1.0);
  expect(res.renderedSegments).toBe(6);
  expect(res.chasmBridgeSegments).toBe(1);
  expect(underGfx.fillTriangleCalls.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/ap2-p1a-weapons-vfx-audio.test.ts test/ap2-p1b-weapons-fx.test.ts`
Expected: FAIL (`spawnEmeraldCleaverSlash`, `renderEmeraldBoomerangOverlay`, `renderBerserkerGuillotineCorridor` undefined or mismatch).

- [ ] **Step 3: Implement melee & hybrid weapon choreography (`knight_sword`, `emerald_cleaver`, `berserker_axe`, `thunder_hammer`)**

- **`knight_sword` (`range = 56px`):** Combo 1 (`slash_steel`), Combo 2 (reverse `flipY` + sharp tip glint), Combo 3 (wide twin-edge `slash_steel` with `#141019` negative wind-channel + `26px` floor stone nick on `groundHazardGraphics` `depth 16.0` — remove `fx_sh_aegis_crest` crab-claw stacking). `spawnMeleeParryDeflectFx` spawns `fx_parry_winged_crest` (`32×16px`, `depth 43.0`) + `45°` `26px` air-compression fan (`depth 26.6`) + `2f` `0xF4F1EA` rig flash.
- **`emerald_cleaver` (`range = 92.0px`, `SPIN_RADIUS = 56.0px`):** `spawnEmeraldCleaverSlash` spawns `fx_sh_slash_emerald` (`1:1` at `92.0px`), emits `PALETTE.LIME_GLOW` transient light on P1 hit 3, and returns `true` for all combo steps `1..3`. `renderEmeraldBoomerangOverlay` renders `r = 22.0px` spinning Cutout blade in `'outbound' | 'returning'` (`depth 41.5`) and `3` `120°`-spaced `fillTaperedArcRibbon` jade crescents at `r = 56.0px` on `underActorGraphics` (`depth 26.6`) during `'spinning'`.
- **`berserker_axe` (`range = 66px`, `Guillotine Slam = 160 × 36px`):** Step `8` segments (`20px` step, `halfWidthPx = 18.0`) from `(x1, y1)` toward `(x2, y2)`. Stop **only** when a sample hits an outer room perimeter wall (`tx <= 0 || ty <= 0 || tx >= map.width - 1 || ty >= map.height - 1`). On `TileKind.Chasm`, draw a `±18.0px` pointed fire-arc bridge on `underActorGraphics` (`depth 26.6`); on floor/interior-pillar cells, draw jagged `#141019` + `#EA580C` ember fissure plates on `groundHazardGraphics` (`depth 16.0`, naturally passing beneath `depth 25.0` interior pillars).
- **`thunder_hammer` (`R = 110px`):** Render thrown hammer via `fx_thrown_thunder_hammer` (`28×28px`, `depth 41.5`) + `fillTaperedLightningBolt` recall tether + `18px` T-spark on catch. `spawnThunderHammerPillarFx` drops a `-90px` vertical `fillTaperedLightningBolt` (`depth 42.5`), stamps a 6-branch radial fissure (`depth 16.0`), and routes `ev.radius` (`110px`) via `routeCutoutBurstByRadius(fx, s.x, s.y, s.radius, 'fx_sh_nova_thunder')` (`60Hz` `depth 26.6` perimeter ring + clamped `8f` core).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/ap2-p1a-weapons-vfx-audio.test.ts test/ap2-p1b-weapons-fx.test.ts test/topdown-shader-vfx-spawners.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/fx/combat-fx-weapons-v2.ts apps/client/src/fx/combat-fx-weapons-p1a.ts apps/client/src/fx/combat-fx-weapons-p1a-entities.ts apps/client/src/fx/combat-fx-weapons-p1b.ts apps/client/test/ap2-p1a-weapons-vfx-audio.test.ts apps/client/test/ap2-p1b-weapons-fx.test.ts apps/client/test/topdown-shader-vfx-spawners.test.ts
git commit -m "feat(vfx): implement bespoke Cutout VFX for melee and hybrid weapons"
```

---

### Task 2: `HEAT_VENT` Weapons (`apprentice_staff`, `gale_smg`, `solar_archon_staff`, `tether_staff`, `focus_laser`) & Unified `overheat_puff`

**Files:**
- Modify: `apps/client/src/fx/combat-fx-weapons-v2.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1a.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1a-entities.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1b.ts`
- Modify: `apps/client/src/scenes/game-scene/entity-sync.ts`
- Test: `apps/client/test/ap2-p1a-weapons-vfx-audio.test.ts`, `apps/client/test/ap2-p1b-weapons-fx.test.ts`

**Interfaces:**
- Consumes: `fillTaperedQuadraticBezier`, `fillTaperedArcRibbon`, `strokeCutoutQuadStripFromScratch` (`Plan 1 Task 3`); `routeCutoutBurstByRadius`, `resolveAllyFxProfile` (`Plan 1 Task 4`); `CUTOUT_KIT_ATLAS_KEY` (`fx_overheat_puff`, `fx_solar_mini_sun`, `proj_gale_wind_blade`) (`Plan 1 Task 2`).
- Produces:
  - `export const HEAT_VENT_WEAPON_IDS = ['apprentice_staff', 'gale_smg', 'solar_archon_staff', 'tether_staff', 'focus_laser'] as const;`
  - `export function tickPlayerOverheatVentPuffs(fx: CombatFxManager, playerId: number, weaponId: string, overheated: boolean, muzzleX: number, muzzleY: number, dtSec: number, isTeammate: boolean): void`
  - `export function renderFocusLaserRailgunShot(ribbonGfx: Phaser.GameObjects.Graphics, ev: Extract<SimEvent, { kind: 'focus_laser_railgun' }>, frameIndex: number, alpha: number): void`
  - `export function spawnSolarSupernovaFx(fx: CombatFxManager, ev: Extract<SimEvent, { kind: 'solar_supernova' }>, isTeammate: boolean): void`

- [ ] **Step 1: Add failing tests for `HEAT_VENT` `fx_overheat_puff`, `focus_laser` `2`-frame `#141019` inverted `Railgun` (`±14px`), `solar_archon_staff` (`48px` / `120px`), and `gale_smg` (`depth 26.6`)**

```ts
it('emits fx_overheat_puff every 0.18s for all 5 HEAT_VENT weapons when overheated and scales ally alpha to 0.25', () => {
  const { fx } = createTestWeaponFxHarness();
  for (const wid of HEAT_VENT_WEAPON_IDS) {
    tickPlayerOverheatVentPuffs(fx, 1, wid, true, 120, 120, 0.19, false);
  }
  const puffs = fx.particlePool.filter((p) => p.active && p.textureKey.includes('fx_overheat_puff'));
  expect(puffs).toHaveLength(5);
  expect(puffs[0]?.vy).toBeCloseTo(-22, 1);
  expect(puffs[0]?.startAlpha).toBeCloseTo(0.85, 2);
});

it('renders focus_laser Railgun within ±14.0px with 2-frame #141019 inverted-ink flash and zero strokeCircle calls on solar_archon_staff', () => {
  const gfx = createRecordingGraphicsMock();
  renderFocusLaserRailgunShot(gfx as never, {
    kind: 'focus_laser_railgun', playerId: 1, x1: 100, y1: 200, x2: 400, y2: 200, angle: 0, width: 28, damage: 90, alertTextVi: '',
  }, 0, 1.0);
  expect(gfx.fillStyleCalls.some((c) => c.color === 0x141019)).toBe(true);
  const ys = gfx.fillTriangleCalls.flatMap((t) => [t.y0, t.y1, t.y2]);
  expect(Math.max(...ys) - 200).toBeLessThanOrEqual(15.9);
  expect(200 - Math.min(...ys)).toBeLessThanOrEqual(15.9);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/ap2-p1a-weapons-vfx-audio.test.ts test/ap2-p1b-weapons-fx.test.ts`
Expected: FAIL (`HEAT_VENT_WEAPON_IDS`, `tickPlayerOverheatVentPuffs`, `renderFocusLaserRailgunShot` undefined).

- [ ] **Step 3: Implement the `5` `HEAT_VENT` weapon choreographies and `tickPlayerOverheatVentPuffs`**

- **Unified `tickPlayerOverheatVentPuffs`:** Maintain per-player accumulator (`Map<number, number>`, cleared on room reset); when `overheated && HEAT_VENT_WEAPON_IDS.includes(weaponId)`, emit `1` `fx_overheat_puff` (`6×6px`, `depth 42.0`, `vy = -22`, `ttl = 0.24s`, `alpha = isTeammate ? 0.25 : 0.85`) every `0.18s`.
- **`apprentice_staff`:** `TriElementalBeam` (`r = 36px`) weaves `3` `120°`-phased `fillTaperedQuadraticBezier` ribbons (`#F97316` / `#22D3EE` / `#FDE047`, `depth 44.0`) into `1:1` `fx_sh_arcane_sigil` (`R = 36px`).
- **`gale_smg`:** `proj_gale_wind_blade` (`18×9px`); `Gale Cyclone` (`r = 96px`) draws `3` pointed spiral `fillTaperedArcRibbon` wind-blades at `depth 26.6` (`underActorGraphics`, `r_eye = 28px` hollow); personal speed buff renders as a subtle `2.12 : 1` foot wind-ring at `(p.x, p.y + 12)` (`depth 15.0`).
- **`solar_archon_staff`:** Render `3` `fx_solar_mini_sun` (`12×12px`, `depth 41.5`) at `(p.x, p.y) ± 48.0px` with **zero** connecting `strokeCircle`; `solar_converge_burst` (`r = 52px`) via `fx_sh_nova_magma` tinted `#F59E0B`; `solar_supernova` (`R = 120px`) via `fx_sh_nova_solar` (`1:1` `#141019` eclipse disc `r = 26px` eroding hollow at `50 ms`) + `8` `60Hz` corona lances reaching `r = 120.0px` on `underActorGraphics` (`depth 26.6`).
- **`tether_staff`:** `fillTaperedQuadraticBezier` beam (`depth 44.0`) + `2` sliding `#CFFAFE` diamond pulses (P1 only); `Electromagnetic Yank` snaps `4` inward `fillTaperedArcRibbon` magnetic jaws from `ev.radius` (`depth 26.6`).
- **`focus_laser`:** Continuous beam scales width `2.4px -> 4.0px` (`#38BDF8 -> #F59E0B -> #F4F1EA` wrapped in `#141019`) with `1` sliding 4-point star on the hit rim (`refractedRays` through active Vanguard shields rendered identically). `Railgun` (`width = 28px = ±14px`) renders a `2`-frame `#141019` inverted-ink flash (`±14px` tapered to `±4px` at muzzle, `#F4F1EA` `4px` spine) followed by `4` frames of dashed Cutout shock-rails at `±14.0px` (`depth 44.0`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/ap2-p1a-weapons-vfx-audio.test.ts test/ap2-p1b-weapons-fx.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/fx/combat-fx-weapons-v2.ts apps/client/src/fx/combat-fx-weapons-p1a.ts apps/client/src/fx/combat-fx-weapons-p1a-entities.ts apps/client/src/fx/combat-fx-weapons-p1b.ts apps/client/src/scenes/game-scene/entity-sync.ts apps/client/test/ap2-p1a-weapons-vfx-audio.test.ts apps/client/test/ap2-p1b-weapons-fx.test.ts
git commit -m "feat(vfx): implement HEAT_VENT weapon ribbons, inverted Railgun, and overheat puffs"
```

---

### Task 3: Ballistic, Ordnance & Botanical Weapons (`hunter_crossbow`, `thorn_staff`, `rivet_gun`, `scrap_shotgun`, `tesla_carbine`, `frag_launcher`, `seed_gun`, `void_staff`, `magma_cannon`)

**Files:**
- Modify: `apps/client/src/fx/combat-fx-weapons-v2.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1a.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1a-entities.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1b.ts`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Test: `apps/client/test/ap2-p1a-weapons-vfx-audio.test.ts`, `apps/client/test/ap2-p1b-weapons-fx.test.ts`, `tests/e2e/polish-p10b.spec.ts`

**Interfaces:**
- Consumes: `routeCutoutBurstByRadius` (`Plan 1 Task 4`); `fillTaperedQuadraticBezier`, `fillTaperedArcRibbon`, `fillTaperedLightningBolt`, `strokeCutoutQuadStripFromScratch` (`Plan 1 Task 3`); `CUTOUT_KIT_ATLAS_KEY` (`fx_pellet_dent`, `fx_muzzle_thorn_barb`, `fx_rivet_hex_head`, `fx_frag_fuse_wheel`, `fx_seed_heal_wisp`) (`Plan 1 Task 2`).
- Produces:
  - `export function buildLinearRivetTetherPairs(rivets: ReadonlyArray<{ id: number; x: number; y: number }>): Array<[number, number]>`
  - `export function recordScrapShotgunPelletHit(fx: CombatFxManager, targetId: number, hitX: number, hitY: number, angleRad: number, tick: number, isTeammate: boolean): void`
  - `export function spawnMagmaGeyserClusterFx(fx: CombatFxManager, ev: Extract<SimEvent, { kind: 'magma_geyser_eruption' }>, isTeammate: boolean): { rimCount: number; tallPlumeCount: number; lowBoilCount: number }`

- [ ] **Step 1: Write failing tests in `ap2-p1a-weapons-vfx-audio.test.ts` and `ap2-p1b-weapons-fx.test.ts`**

```ts
it('caps rivet_gun tethers at O(N) degree <= 2 and spawns 0 shader flipbooks on regular scrap_shotgun pellets', () => {
  const pairs = buildLinearRivetTetherPairs([
    { id: 1, x: 0, y: 0 }, { id: 2, x: 40, y: 0 }, { id: 3, x: 80, y: 0 }, { id: 4, x: 120, y: 0 },
  ]);
  expect(pairs.length).toBeLessThanOrEqual(3);

  const { fx } = createTestWeaponFxHarness();
  for (let i = 0; i < 8; i++) {
    recordScrapShotgunPelletHit(fx, 99, 250, 250, 0, 10, false);
  }
  const shaderFlipbooks = fx.particlePool.filter((p) => p.active && p.textureKey.startsWith('fx_sh_'));
  expect(shaderFlipbooks).toHaveLength(0);
  expect(fx.activeArcRibbons.length).toBe(1); // single 26px air-compression fan on >= 3 hits
});

it('renders 100% of magma_cannon r=56px floor rims while capping tall plumes within 46px to low boils', () => {
  const { fx } = createTestWeaponFxHarness();
  const counts = spawnMagmaGeyserClusterFx(fx, {
    kind: 'magma_geyser_eruption',
    playerId: 1,
    damage: 40,
    radius: 56,
    alertTextVi: '',
    geysers: [
      { x: 200, y: 200, radius: 56, damage: 40 },
      { x: 230, y: 200, radius: 56, damage: 40 }, // dist 30px < 46px -> low boil, but rim still drawn!
      { x: 300, y: 200, radius: 56, damage: 40 }, // dist >= 46px -> tall plume
    ],
  }, false);
  expect(counts.rimCount).toBe(3);
  expect(counts.tallPlumeCount).toBe(2);
  expect(counts.lowBoilCount).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/ap2-p1a-weapons-vfx-audio.test.ts test/ap2-p1b-weapons-fx.test.ts`
Expected: FAIL (`buildLinearRivetTetherPairs`, `recordScrapShotgunPelletHit`, `spawnMagmaGeyserClusterFx` undefined).

- [ ] **Step 3: Implement the remaining `9` weapons and update `tests/e2e/polish-p10b.spec.ts`**

- **`hunter_crossbow`:** Rim-pinned barbed bolt (`14×7px`); `crossbow_rip` draws S-whip `fillTaperedQuadraticBezier` (`depth 44.0`) + `24px` 3-prong crimson rip flash (`fx_small_burst_4f` tinted crimson).
- **`thorn_staff`:** `fx_muzzle_thorn_barb` (`12×6px`); `thorn_bloom` whips `5` hooked briar quad-strips (`depth 26.6`) inward from exact `1.000 * R_sim`.
- **`rivet_gun`:** `fx_rivet_hex_head` (`8×8px`); `buildLinearRivetTetherPairs` links each rivet to its nearest unvisited neighbor (`degree <= 2`), detonating via `fillTaperedLightningBolt` + `20px` X-slag burst + `2` hex washers to `decalPool` (`depth 6.0`).
- **`scrap_shotgun`:** `recordScrapShotgunPelletHit` stamps `fx_pellet_dent` (`8×6px`, `3` ticks, `0` shader flipbooks) on enemy rim and emits `1` `26px` air-compression fan (`depth 26.6`) when a target reaches `3` pellet hits in the same tick; `Shell Eject` routes `1:1` via `routeCutoutBurstByRadius(..., 'fx_sh_shrapnel_corona')`.
- **`tesla_carbine`:** `fillTaperedLightningBolt` (`< 28°`, `depth 44.0`, `4` ticks); `Dome Discharge` (`r = 88px`) routes via `routeCutoutBurstByRadius(fx, x, y, 88, 'fx_sh_anvil_storm')`.
- **`frag_launcher`:** Replace airborne `r = 104px` `strokeCircle` on `armedForAirburst` with spinning `fx_frag_fuse_wheel` (`14×14px`, `depth 41.5`); `Airburst` (`R = 104px`) routes `1:1` via `routeCutoutBurstByRadius(fx, x, y, 104, 'fx_sh_shrapnel_corona')`.
- **`seed_gun`:** `10×6px` seed dart; `Harvest Bloom` opens a `5`-petal jade bloom (`depth 26.6`, `1:1` `ev.radius`), curving `3` `fx_seed_heal_wisp` (`8×8px`) into `(player.x, player.y)` when `releasedHealingMist === true`.
- **`void_staff`:** `#0B090E` `r = 11px` core (`1.8px` `#A855F7` + `#141019` rim) + `4` subtle inward `fillTaperedArcRibbon` arcs at `r = 110.0px` (`depth 26.6`, `alpha = 0.22` P1 / `0.07` Ally, `68%` open); `void_implosion` collapses `110px -> 0px` over `4` ticks + `fx_sh_nova_void`.
- **`magma_cannon`:** Draw `100%` of `r = 56.0px` geyser floor rims (`depth 16.0` + `depth 26.6`); if a geyser center is `< 46.0px` from an already-spawned tall `fx_sh_geyser_plume` in the cluster/active list, spawn a low `12px` `fx_micro_burst_4f` magma boil at `depth 26.4` instead of stacking tall vertical plumes.
- Update `tests/e2e/polish-p10b.spec.ts` assertions for `BlendMode.NORMAL` `depth 41.0` player bolts and `0`-flipbook shotgun `fx_pellet_dent` hits.

- [ ] **Step 4: Run weapon tests and typecheck**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/ap2-p1a-weapons-vfx-audio.test.ts test/ap2-p1b-weapons-fx.test.ts test/ap2-p0b-microbar-fx.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/fx/combat-fx-weapons-v2.ts apps/client/src/fx/combat-fx-weapons-p1a.ts apps/client/src/fx/combat-fx-weapons-p1a-entities.ts apps/client/src/fx/combat-fx-weapons-p1b.ts apps/client/src/scenes/game-scene/sim-events.ts apps/client/test/ap2-p1a-weapons-vfx-audio.test.ts apps/client/test/ap2-p1b-weapons-fx.test.ts tests/e2e/polish-p10b.spec.ts
git commit -m "feat(vfx): complete bespoke Cutout VFX across all 18 weapons"
```
