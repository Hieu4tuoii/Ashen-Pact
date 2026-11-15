# Cutout 2.0 VFX Overhaul (Phase 5: Blessings/Pacts/Duo Purge, 7 Boss Beats, Alert Repulsion, 4P Co-op & Gates 1–5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Purge all remaining wireframe `strokeCircle` overlays across Blessings, Ashen Pacts, Weapon Mutators, and `6` Duo Boons, deliver high-craft Cutout choreography for all `7` Boss & Elite combat beats, guarantee zero-overlap `tacticalAlert` popups, unify 4-player Co-op suppression across every subsystem, and pass the full test + `Animation Verification Engine` (`Gates 1–5`) suite.

**Architecture:** Replace primitive `P1D`/`P2B`/`P4A`/`P4B` wireframe loops with `fx_cutout_kit_512` auxiliary projectile sprites (`proj_*`), `duo_rail_lock_10x10` target brackets, and `1:1` `depth 16.0 / 26.6` perimeter ribbons. Choreograph all `7` Boss beats (`boss_spawned`, `0.25s + 1.20s` `Phase Roar` hex cage, `6`-plate `Armor Shell`, `Armor Break`, `3->5` `Enrage` horns, `60Hz` 2-beat `Boss Kill`, `58.5` `Executioner` wave, `Supply Drop` brackets), partition `fx.damagePool` into numeric (`0..41`, `90ms` merge) vs `tacticalAlert` (`42..47`, zero-alloc AABB repulsion), and enforce `resolveAllyFxProfile` + `applyP1SafeHaloAlpha` across all `14` Co-op subsystems.

**Tech Stack:** TypeScript, Phaser 3 (`WebGL1` / `Canvas2D`), Vitest, Playwright (`pnpm e2e`, `pnpm shots` `Animation Verification Engine` `Gates 1–5`).

**Spec:** `docs/superpowers/specs/2026-11-15-cutout-vfx-and-ice-mirror-overhaul-design.md` (Sections 4.4, 5.4 `C.5–C.6`, 6.5, 6.7, 6.9, 6.15)

## Global Constraints

- `100%` wireframe `strokeCircle` purge across `combat-fx-blessings-p1d.ts`, `combat-fx-p2b.ts`, `combat-fx-p4a.ts`, and `combat-fx-p4b.ts` (`drawDeterministicTransientBursts` and vertical mortar shadow-stem lines deleted; `soul_chain` stretch warning `> 260px` preserved as `depth 17.0` crimson link).
- Enemy `#E84545` bullet core at `depth 60.0` (`BlendMode.NORMAL`) MUST never be occluded (`ashen_executioner_wave` strictly at `depth 58.5 < 60.0`).
- Zero `text.getBounds()` calls in `fx.damagePool` overlap resolution; use `0.5 * d.text.width * Math.abs(d.text.scaleX)` and `0.5 * d.text.height * Math.abs(d.text.scaleY)` with `padY = 4.0px`.
- Zero edits to `tools/visual-animation-gates.ts` evaluator thresholds; all `5` gates (`Gate 1..5`), `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm e2e` MUST pass cleanly.

## Review Focus

1. **`duo_superconduct_rail` `Ø 200px` circles, `duo_superheated_cyclone` `r != 56px`, or `duo_magnetic_bastion_ring` drawn past `220px`:** `duo_superconduct_rail` must render `duo_rail_lock_10x10` (`depth 46.5`), `duo_superheated_cyclone` must render `1:1` at `r = 56.0px` (`depth 26.6`), `duo_magnetic_bastion_ring` must gate on `dist <= 220.0px` (`±14px` at `depth 16.0`), and `soul_chain` must escalate at `dist > 260.0px` (`depth 17.0`) (pinned in Task 1 Step 1).
2. **`Phase Roar` visual ending at `0.25s` while Boss stays invulnerable for `1.20s`, or `ashen_executioner_wave` covering `#E84545` cores:** `Phase Roar` must keep a `depth 30.8` tight hex invulnerability cage (`92%` hollow) visible for the full `1.20s` (blinking `16 Hz` in the final `0.20s` `1.00..1.20s`), and `ashen_executioner_wave` must draw at `depth 58.5` (`< 60.0`) (pinned in Task 2 Step 1).
3. **`Boss Kill` slow-mo turning `8f` sprite playback choppy:** The `2`-beat `Boss Kill` sequence (`0.00..0.16s` `#141019` silhouette inversion + `5` `#F4F1EA` cracks at `depth 30.9`; `0.16..0.42s` twin `R = 132px` crescents + `12` boss-themed relics) must step on `60Hz` real-time `rawDtSec` (pinned in Task 2 Step 1).
4. **Overlapping `tacticalAlert` popups failing `Gate 4` (`nonNumericAlertOverlapCount > 0`) or allocating bounds objects:** `fx.damagePool[42..47]` must resolve vertical AABB collisions in-place with `padY = 4.0px` and `0` `getBounds()` allocations, while numeric damage slots `0..41` merge hits on the same `targetId` within `90 ms` (pinned in Task 3 Step 1).
5. **Dropped P2–P4 shot cues on `shotFxTriggeredOwnersScratch` or unsuppressed ally AoEs blinding P1:** `shotFxTriggeredOwnersScratch` must be a `Set<number>` tracking all firing owners per tick, and every ally effect within `18px + 0.35 * R` of local P1 must multiply alpha by `0.15` (`applyP1SafeHaloAlpha`) with `0` ally transient lights or camera shake (pinned in Task 3 Step 1).

---

## File Structure

- **Modify:** `apps/client/src/fx/combat-fx-blessings-p1d.ts`, `apps/client/src/fx/combat-fx-p2b.ts`, `apps/client/src/fx/combat-fx-p4a.ts`, `apps/client/src/fx/combat-fx-p4b.ts`, `apps/client/src/scenes/game-scene/entity-sync.ts` — Wireframe purge across Blessings, Pacts (`soul_chain` `> 260px` warning, `proj_relic_perpetual_rocket`), Mutators (`proj_mutator_boomerang_saw`, `proj_dash_phase_blade`, `proj_cluster_mortar_lob`, `proj_holster_surge_bolt`, `proj_holo_decoy_shot`, `proj_table_tech_rocket`, `proj_reload_tediore_chuck`; delete mortar stem & `drawDeterministicTransientBursts`), and `6` Duo Boons (`1:1` `r = 56px` cyclone, `duo_rail_lock_10x10`, `<= 220px` `bastion_ring`).
- **Modify:** `apps/client/src/scenes/game-scene/sim-events.ts`, `apps/client/src/scenes/game-scene/p11-drama-hud.ts`, `apps/client/src/fx/combat-fx-p3a.ts`, `apps/client/src/fx/combat-fx.ts`, `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts` — `7` Boss & Elite combat beats (`boss_spawned` biome branch, `0.25s + 1.20s` `Phase Roar` hex cage, `6`-plate `Armor Shell`, `Armor Break`, `3->5` `Enrage` horns, `60Hz` 2-beat `Boss Kill`, `58.5` `Executioner` wave, `Supply Drop` `17.0` brackets).
- **Modify:** `apps/client/src/fx/combat-fx-pools.ts`, `apps/client/src/fx/combat-fx-spawners.ts` — `fx.damagePool` `0..41` (`90ms` numeric merge) + `42..47` (`tacticalAlert` zero-alloc AABB repulsion), `shotFxTriggeredOwnersScratch: Set<number>`, and full `14`-subsystem `resolveAllyFxProfile` + `applyP1SafeHaloAlpha` audit.
- **Modify Tests:** `apps/client/test/ap2-p1d-blessing-ui-fx.test.ts`, `apps/client/test/ap2-p4b-duo-ui-fx.test.ts`, `packages/shared/test/ap2-p2b-ui-vfx.test.ts`, `apps/client/test/commercial-class-and-interaction-vfx.test.ts`, `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts`, `tests/e2e/polish-p11.spec.ts`.

---

### Task 1: `100%` Wireframe Purge Across Blessings (`P1D`), Pacts (`P2B`), Mutators (`P4A`) & `6` Duo Boons (`P4B`)

**Files:**
- Modify: `apps/client/src/fx/combat-fx-blessings-p1d.ts`
- Modify: `apps/client/src/fx/combat-fx-p2b.ts`
- Modify: `apps/client/src/fx/combat-fx-p4a.ts`
- Modify: `apps/client/src/fx/combat-fx-p4b.ts`
- Modify: `apps/client/src/scenes/game-scene/entity-sync.ts`
- Test: `apps/client/test/ap2-p1d-blessing-ui-fx.test.ts`, `apps/client/test/ap2-p4b-duo-ui-fx.test.ts`, `packages/shared/test/ap2-p2b-ui-vfx.test.ts`

**Interfaces:**
- Consumes: `CUTOUT_KIT_ATLAS_KEY` (`proj_mutator_boomerang_saw`, `proj_dash_phase_blade`, `proj_cluster_mortar_lob`, `proj_holster_surge_bolt`, `proj_holo_decoy_shot`, `proj_relic_perpetual_rocket`, `proj_table_tech_rocket`, `proj_reload_tediore_chuck`, `duo_rail_lock_10x10`) (`Plan 1 Task 2`); `fillTaperedArcRibbon`, `fillTaperedQuadraticBezier`, `fillTaperedLightningBolt` (`Plan 1 Task 3`); `routeCutoutBurstByRadius`, `resolveAllyFxProfile`, `applyP1SafeHaloAlpha` (`Plan 1 Task 4`).
- Produces:
  - `export function renderDuoSuperheatedCyclone(underGfx: Phaser.GameObjects.Graphics, x: number, y: number, radiusPx: number, phaseRad: number, alpha: number): void`
  - `export function renderDuoMagneticBastionTether(groundGfx: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, alpha: number): boolean`
  - `export function renderSoulChainTether(groundGfx: Phaser.GameObjects.Graphics, dangerGfx: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, alpha: number): { isOverstretched: boolean }`

- [ ] **Step 1: Write failing tests in `ap2-p1d-blessing-ui-fx.test.ts` and `ap2-p4b-duo-ui-fx.test.ts`**

```ts
it('renders duo_superheated_cyclone 1:1 at r=56px (depth 26.6), gates duo_magnetic_bastion_ring at <=220px, and replaces Ø200px rail circles with duo_rail_lock_10x10', () => {
  const underGfx = createRecordingGraphicsMock();
  renderDuoSuperheatedCyclone(underGfx as never, 200, 200, 56, 0, 1.0);
  const maxR = Math.max(...underGfx.fillTriangleCalls.map((t) => Math.hypot(t.x0 - 200, t.y0 - 200)));
  expect(maxR).toBeGreaterThan(54);
  expect(maxR).toBeLessThanOrEqual(58.5);
  expect(underGfx.strokeCircleCalls).toHaveLength(0);

  const groundGfx = createRecordingGraphicsMock();
  expect(renderDuoMagneticBastionTether(groundGfx as never, 0, 0, 210, 0, 1.0)).toBe(true);
  expect(renderDuoMagneticBastionTether(groundGfx as never, 0, 0, 240, 0, 1.0)).toBe(false);
});

it('escalates soul_chain to depth 17.0 danger link when dist > 260px and maps all auxiliary mutator projectiles to fx_cutout_kit_512 sprites', () => {
  const groundGfx = createRecordingGraphicsMock();
  const dangerGfx = createRecordingGraphicsMock();
  expect(renderSoulChainTether(groundGfx as never, dangerGfx as never, 0, 0, 275, 0, 1.0).isOverstretched).toBe(true);
  expect(dangerGfx.fillTriangleCalls.length).toBeGreaterThan(0);

  expect(resolveProjectileRenderSpec('mutator_boomerang_saw').textureKey).toContain('proj_mutator_boomerang_saw');
  expect(resolveProjectileRenderSpec('cluster_mortar_lob').textureKey).toContain('proj_cluster_mortar_lob');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/ap2-p1d-blessing-ui-fx.test.ts test/ap2-p4b-duo-ui-fx.test.ts`
Expected: FAIL (`renderDuoSuperheatedCyclone`, `renderDuoMagneticBastionTether`, `renderSoulChainTether` undefined; `strokeCircle` overlays still drawn).

- [ ] **Step 3: Implement the `P1D` / `P2B` / `P4A` / `P4B` wireframe purge and `6` Duo Boon Cutout visuals**

- **Blessings (`combat-fx-blessings-p1d.ts`) & Mutators (`combat-fx-p4a.ts`, `entity-sync.ts`):**
  - Map auxiliary projectile weaponIds (`mutator_boomerang_saw`, `dash_phase_blade`, `cluster_mortar_lob`, `holster_surge_bolt`, `holo_decoy_shot`, `relic_perpetual_rocket`, `table_tech_rocket`, `reload_tediore_chuck`) to their crisp `fx_cutout_kit_512` frames (`BlendMode.NORMAL`, `depth 41.0`, `1/3` scale).
  - Delete vertical mortar shadow-stem `lineBetween` (keep `depth 19.0` growing ground shadow + `1:1` `depth 16.0` impact bracket) and delete `drawDeterministicTransientBursts` wireframe circles (route transient bursts through `routeCutoutBurstByRadius`).
  - Clean up `table_tech_prism_split`, `bullet_split_bounce`, and `mutator_prism_splitter` client impact rings to compact `fx_micro_burst_4f` / pointed twin chevrons (`0` `strokeCircle`s, `WorldSim` mechanics untouched).
- **Ashen Pacts (`combat-fx-p2b.ts`):**
  - Render `soul_chain` on `groundHazardGraphics` (`depth 16.0`) via `fillTaperedQuadraticBezier` when `dist <= 260px`, escalating to pulsing `#E84545` + `#141019` stretch warning on `enemyGroundTelegraphGfx` (`depth 17.0`) + `2.12:1` foot warning ellipse when `dist > 260px`.
  - Render `blackCrystalEmpowered` as a compact `8×12px` obsidian crystal mote orbiting the player's weapon hand (`0` full-body circle).
- **6 Duo Boons (`combat-fx-p4b.ts`):**
  1. `duo_superheated_cyclone`: `1:1` `r = 56.0px` (`depth 26.6`) alternating `#F97316` flame & `#38BDF8` wind `fillTaperedArcRibbon` blades (`alpha = 0.35` for allies).
  2. `duo_superconduct_rail`: replace `Ø 200px` circles with `duo_rail_lock_10x10` (`depth 46.5`) on locked targets + `fillTaperedLightningBolt` rail snap.
  3. `duo_magnetic_bastion_ring`: draw `±14.0px` `#38BDF8`/`#F59E0B` magnetic floor rail (`depth 16.0`) **only** when ally pair distance `<= 220.0px`.
  4. `duo_cryo_shatter_spire`: `prop_cryo_spire` (`26×38px`) + `routeCutoutBurstByRadius(..., 'fx_sh_nova_cryo')`.
  5. `duo_venom_thorn_garden`: `5` jade/violet hooked briars (`depth 26.6`) + `fx_react_toxic_glob`.
  6. `duo_solar_anvil_cataclysm`: `routeCutoutBurstByRadius(..., 'fx_sh_anvil_storm')` + `4` solar hammer stamps (`depth 16.0`).

- [ ] **Step 4: Run Blessing, Pact, and Duo Boon tests**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/ap2-p1d-blessing-ui-fx.test.ts test/ap2-p4b-duo-ui-fx.test.ts && pnpm --filter @ashen-pact/shared exec vitest run test/ap2-p2b-ui-vfx.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/fx/combat-fx-blessings-p1d.ts apps/client/src/fx/combat-fx-p2b.ts apps/client/src/fx/combat-fx-p4a.ts apps/client/src/fx/combat-fx-p4b.ts apps/client/src/scenes/game-scene/entity-sync.ts apps/client/test/ap2-p1d-blessing-ui-fx.test.ts apps/client/test/ap2-p4b-duo-ui-fx.test.ts
git commit -m "feat(vfx): purge wireframe circles across blessings, pacts, mutators, and 6 duo boons"
```

---

### Task 2: All `7` Boss & Elite Combat Beats (`Phase Roar` `1.20s` Hex Cage, `Armor Shell/Break`, `Enrage`, `60Hz` `2`-Beat `Boss Kill`, `Executioner` `58.5` Wave & `Supply Drop`)

**Files:**
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Modify: `apps/client/src/scenes/game-scene/p11-drama-hud.ts`
- Modify: `apps/client/src/fx/combat-fx-p3a.ts`
- Modify: `apps/client/src/fx/combat-fx.ts`
- Modify: `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`
- Test: `apps/client/test/commercial-class-and-interaction-vfx.test.ts`, `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts`

**Interfaces:**
- Consumes: `CUTOUT_KIT_ATLAS_KEY` (`fx_boss_shell_plate`) (`Plan 1 Task 2`); `fillTaperedArcRibbon`, `strokeCutoutQuadStripFromScratch` (`Plan 1 Task 3`); `routeCutoutBurstByRadius` (`Plan 1 Task 4`).
- Produces:
  - `export function renderBossPhaseInvulnCage(gfx: Phaser.GameObjects.Graphics, x: number, y: number, radiusPx: number, elapsedSec: number, totalDurationSec?: number): boolean`
  - `export function renderBossArmorShellPlates(plates: readonly Phaser.GameObjects.Sprite[], boss: SimEnemyState, biome: 1 | 2 | 3, timeSec: number): void`
  - `export function stepBossKillTwoBeatSequence(fx: CombatFxManager, rawDtSec: number): { phase: 'idle' | 'invert_cracks' | 'twin_crescents'; progress01: number }`
  - `export function renderExecutionerCrescentProjectile(gfx: Phaser.GameObjects.Graphics, x: number, y: number, angleRad: number, radiusPx: number): void`

- [ ] **Step 1: Write failing tests in `commercial-class-and-interaction-vfx.test.ts`**

```ts
it('keeps Boss Phase Roar hex invulnerability cage visible for full 1.20s (blinking 16Hz in 1.00..1.20s) and renders Executioner crescent at depth 58.5 (< 60.0)', () => {
  const gfx = createRecordingGraphicsMock();
  expect(renderBossPhaseInvulnCage(gfx as never, 300, 300, 34, 0.6, 1.2)).toBe(true);
  // Blinking at 16Hz during final 0.20s (1.00..1.20s) alternates visibility across 31ms half-cycles
  const visA = renderBossPhaseInvulnCage(gfx as never, 300, 300, 34, 1.01, 1.2);
  const visB = renderBossPhaseInvulnCage(gfx as never, 300, 300, 34, 1.045, 1.2);
  expect(visA).not.toBe(visB);
  expect(renderBossPhaseInvulnCage(gfx as never, 300, 300, 34, 1.25, 1.2)).toBe(false);

  expect(EXECUTIONER_WAVE_CRESCENT_DEPTH).toBeCloseTo(58.5, 2);
  expect(EXECUTIONER_WAVE_CRESCENT_DEPTH).toBeLessThan(60.0);
});

it('advances 2-beat Boss Kill sequence on 60Hz rawDtSec (0.00..0.16s invert_cracks -> 0.16..0.42s twin_crescents)', () => {
  const { fx } = createTestCombatFx();
  fx.triggerBossKillSequence(400, 300, 2);
  expect(stepBossKillTwoBeatSequence(fx, 0.08).phase).toBe('invert_cracks');
  expect(stepBossKillTwoBeatSequence(fx, 0.12).phase).toBe('twin_crescents');
  expect(stepBossKillTwoBeatSequence(fx, 0.30).phase).toBe('idle');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/commercial-class-and-interaction-vfx.test.ts`
Expected: FAIL (`renderBossPhaseInvulnCage`, `stepBossKillTwoBeatSequence`, `EXECUTIONER_WAVE_CRESCENT_DEPTH` undefined).

- [ ] **Step 3: Implement all `7` Boss & Special Enemy combat beats**

1. **`boss_spawned` (`sim-events.ts`, `p11-drama-hud.ts`):** Branch entrance stamp by `currentBiome` (`1`: `fx_sh_spore_cloud` + emerald root ring; `2`: `fx_sh_nova_cryo` + frost crown; `3`: `fx_sh_nova_magma` + anvil sparks) while keeping HUD Boss title/sub-banner clean.
2. **`boss_phase_changed` (`Phase Roar`):** Spawn `0.25s` `depth 26.6` bullet-clear perimeter wave + **full `1.20s` tight hexagonal Cutout invulnerability cage at `depth 30.8`** (`92%` hollow around `(boss.x, boss.y)`, `#141019` `2.0px` + `#F4F1EA` `1.4px` rim, blinking at `16 Hz` during `1.00..1.20s` so players know exact vulnerability resumption).
3. **`Armor Shell`:** Orbit `6` biome-tinted `fx_boss_shell_plate` (`14×8px`, `depth 30.8`) around armored Bosses (`0` solid yellow circle).
4. **`armor_broken` (`Armor Break`):** Shatter the `6` `fx_boss_shell_plate` sprites outward (`depth 42.0`), orbit `3` Cutout stun stars (`depth 46.5`) overhead during stagger, and stamp `4` foot crack arcs (`depth 15.0`).
5. **`boss_enraged` (`Enrage`):** Attach `3 -> 5` crimson `#E84545` + `#141019` Cutout flame horns above Boss shoulders (`depth 30.8`, scaling count with `enrageLevel`).
6. **`Boss Kill` (`60Hz` `rawDtSec` 2-Beat Slow-Mo):**
   - `Beat 1` (`0.00..0.16s` real-time): invert Boss rig to `#141019` silhouette and draw `5` `#F4F1EA` chest fracture rays (`depth 30.9`).
   - `Beat 2` (`0.16..0.42s` real-time): sweep `60Hz` twin `fillTaperedArcRibbon` crescents (`R = 132px`, `depth 26.6`) + scatter `12` boss-themed Cutout shard relics (`depth 26.4 -> 6.0`).
7. **`ashen_executioner_wave` & `Supply Drop`:** Render Executioner's wave as a pointed `fillTaperedArcRibbon` crescent at `depth 58.5` (`< 60.0`, preserving `#E84545` core at `60.0`), and render Boss `Supply Drop` landing zone as `4` `#141019` + `#F59E0B` gold corner brackets at `depth 17.0` (`'SUPPLY DROP!'` alert preserved).

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/commercial-class-and-interaction-vfx.test.ts test/polish-p10b-fx-elemental-ambient.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/scenes/game-scene/sim-events.ts apps/client/src/scenes/game-scene/p11-drama-hud.ts apps/client/src/fx/combat-fx-p3a.ts apps/client/src/fx/combat-fx.ts apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts apps/client/test/commercial-class-and-interaction-vfx.test.ts
git commit -m "feat(vfx): implement all 7 Boss Cutout combat beats and 1.20s invuln cage"
```

---

### Task 3: `fx.damagePool[42..47]` Zero-Alloc Alert Repulsion, `shotFxTriggeredOwnersScratch`, Unified 4P Co-op Audit & Full `Gates 1–5` Verification

**Files:**
- Modify: `apps/client/src/fx/combat-fx-pools.ts`
- Modify: `apps/client/src/fx/combat-fx-spawners.ts`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Test: `apps/client/test/topdown-shader-vfx-spawners.test.ts`, `apps/client/test/ap2-p4b-duo-ui-fx.test.ts`

**Interfaces:**
- Consumes: `resolveAllyFxProfile`, `applyP1SafeHaloAlpha` (`Plan 1 Task 4`).
- Produces:
  - `export const DAMAGE_NUMERIC_SLOT_END = 42 as const;` (`0..41` numeric damage with `90 ms` per-target accumulator; `42..47` dedicated `tacticalAlert` slots)
  - `export function resolveTacticalAlertSlotOverlaps(damagePool: readonly PooledDamageText[], padYPx?: number): number`
  - `shotFxTriggeredOwnersScratch: Set<number>` in `apps/client/src/scenes/game-scene/sim-events.ts`

- [ ] **Step 1: Write failing tests for `damagePool[42..47]` zero-alloc AABB repulsion, `90ms` numeric damage merge, `Set<number>` shot owners, and `P1 18px Safe-Halo`**

```ts
it('separates overlapping tacticalAlert slots (42..47) with 0 AABB overlaps using width*abs(scaleX) and merges numeric hits within 90ms', () => {
  const { fx } = createTestCombatFx();
  fx.spawnFloatingAlert(300, 220, 'SUPPLY DROP!', '#F59E0B');
  fx.spawnFloatingAlert(302, 222, 'ARMOR BREAK!', '#F4F1EA');
  resolveTacticalAlertSlotOverlaps(fx.damagePool, 4.0);

  const alerts = fx.damagePool.slice(42, 48).filter((d) => d.active);
  expect(alerts).toHaveLength(2);
  const h0 = 0.5 * alerts[0]!.text.height * Math.abs(alerts[0]!.text.scaleY);
  const h1 = 0.5 * alerts[1]!.text.height * Math.abs(alerts[1]!.text.scaleY);
  expect(Math.abs(alerts[0]!.y - alerts[1]!.y)).toBeGreaterThanOrEqual(h0 + h1 + 3.9);

  fx.spawnDamageNumber(200, 200, 15, false, 'none', { targetId: 5, nowMs: 1000 });
  fx.spawnDamageNumber(200, 200, 12, false, 'none', { targetId: 5, nowMs: 1050 });
  const nums = fx.damagePool.slice(0, 42).filter((d) => d.active);
  expect(nums).toHaveLength(1);
  expect(nums[0]?.text.text).toBe('27');
});

it('attenuates ally AoEs inside P1 18px Safe-Halo by 0.15x and tracks multiple firing players per tick via Set<number>', () => {
  const profile = resolveAllyFxProfile(2, 1, 1.0);
  expect(profile.aoeAlpha).toBeCloseTo(0.35, 3);
  expect(profile.allowLightAndShake).toBe(false);
  expect(applyP1SafeHaloAlpha(profile.aoeAlpha, true, 20, 60)).toBeCloseTo(0.35 * 0.15, 4);
  expect(applyP1SafeHaloAlpha(profile.aoeAlpha, true, 80, 60)).toBeCloseTo(0.35, 4);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/topdown-shader-vfx-spawners.test.ts test/ap2-p4b-duo-ui-fx.test.ts`
Expected: FAIL (`resolveTacticalAlertSlotOverlaps` undefined, numeric damage spawns 2 separate popups within `50ms`).

- [ ] **Step 3: Implement `damagePool[42..47]` AABB repulsion, `90ms` numeric merge, `shotFxTriggeredOwnersScratch: Set<number>`, and final `14`-subsystem 4P Co-op pass**

- **`combat-fx-pools.ts` & `combat-fx-spawners.ts`:**
  - Partition `damagePool` (`48` slots at `depth 80.0`): slots `0..41` for numeric damage (merging consecutive non-alert numbers on the same `targetId` within `90 ms` by summing damage and popping `baseScale` by `+0.08`, clamped `<= 1.32`); slots `42..47` exclusively for `spawnFloatingAlert`.
  - Implement `resolveTacticalAlertSlotOverlaps(damagePool, padYPx = 4.0)` over slots `42..47` using half-extents `hw = 0.5 * d.text.width * Math.abs(d.text.scaleX)` and `hh = 0.5 * d.text.height * Math.abs(d.text.scaleY)` (`0` `getBounds()` calls), pushing overlapping alerts apart vertically so `nonNumericAlertOverlapCount === 0` in `Gate 4`.
- **`sim-events.ts` & 4P Co-op Suppression Audit:**
  - Replace scalar `shotFxTriggeredOwner` with reusable module-level `shotFxTriggeredOwnersScratch = new Set<number>()` (`clear()` at the start of `processSimEventsImpl`), ensuring P1–P4 firing in the same tick each get deterministic muzzle/recoil without dropping or duplicating cues.
  - Audit all `14` Co-op subsystems (`weapons-v2`, `weapons-p1a`, `weapons-p1b`, `classes`, `p1c`, `blessings-p1d`, `p2b`, `p4a`, `p4b`, `entity-sync`, `telegraphs-and-overlays`, `sim-events`) to confirm `resolveAllyFxProfile` + `applyP1SafeHaloAlpha` is applied everywhere and `isTeammate` never calls `spawnTransientLight`, `spawnCombatChromaticGlow`, or `addTrauma`.

- [ ] **Step 4: Run the complete workspace verification & `Animation Verification Engine` (`Gates 1–5`)**

Run:
1. `pnpm typecheck && pnpm lint`
2. `pnpm test`
3. `pnpm build`
4. `pnpm e2e`
5. `pnpm shots`
Expected: `100%` PASS across all unit tests, E2E specs, typecheck/lint/build, total VRAM `< 25.0 MB` (`24.816 MB`), boot bake `< 80 ms`, and **`Gates 1–5` (`0` failures)** in `pnpm shots`.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/fx/combat-fx-pools.ts apps/client/src/fx/combat-fx-spawners.ts apps/client/src/scenes/game-scene/sim-events.ts apps/client/test/topdown-shader-vfx-spawners.test.ts apps/client/test/ap2-p4b-duo-ui-fx.test.ts
git commit -m "feat(vfx): add zero-alloc alert repulsion, unify 4P co-op safe-halo suppression, and pass Gates 1-5"
```
