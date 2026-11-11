# Gungeon-Style Enemy Bullet Silhouette & Trajectory Discipline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify enemy and Boss projectiles around *Enter the Gungeon* silhouette discipline (~90% 3-tier concentric round orbs matching circular hitboxes 1:1 + 1 streamlined teardrop `lance` strictly for fast linear sniper shots) while preserving 100% of Boss 5-pattern trajectory choreography and Spec 3.10 balance targets.

**Architecture:** Narrow `EnemyBulletShape` in `@ashen-pact/shared` from 6 shapes to `'small_orb' | 'orb' | 'heavy_orb' | 'lance'` and remap regular enemies plus all 15 Boss patterns with zero RNG/physics drift on calibrated volleys. In `@ashen-pact/client`, replace polygon/chakram textures (`wave`, `diamond`, `ring_bolt`) with a compact `proj_enemy_small_orb` bead and a smooth round-nosed teardrop `proj_enemy_lance`, normalize sprite scaling per orb tier's baked reference radius for 1:1 hitbox honesty, and lock sprite rotation strictly to `lance`.

**Tech Stack:** TypeScript (strict ESM monorepo), deterministic 60Hz `WorldSim` (`@ashen-pact/shared`), Phaser 3 offscreen Canvas texture baker (`@ashen-pact/client`), Vitest, ESLint.

**Spec:** `docs/superpowers/specs/2026-11-11-gungeon-bullet-silhouette-design.md`

## Global Constraints

- `EnemyBulletShape` union is strictly `'small_orb' | 'orb' | 'heavy_orb' | 'lance'`; retired values `'wave'`, `'diamond'`, and `'ring_bolt'` must not remain in source or tests.
- `bulletShape: 'lance'` is permitted ONLY on aimed linear shots (`radialStepRad === undefined`, `(angularVelRad ?? 0) === 0`, narrow spread `<= 0.44`). Never use `'lance'` on radial rings, curved spirals, or wide fans.
- Zero physics/RNG delta on regular enemies (`speed`, `radius`, `pelletCount`, `spreadRad`, and `sim.rng.nextUint32()` call counts unchanged) and zero cooldown/damage/pelletCount/RNG drift on Boss patterns so Spec 3.10 (`ap2-p3c-balance-targets.test.ts` and `ap2-p5-holistic-soak-balance.test.ts`) continues to pass 100%.
- Always pass `--no-file-parallelism` when running multiple Vitest files in `@ashen-pact/shared` to avoid uVM worker memory exhaustion.
- Enemy bullet visual palette invariants (`ENEMY_BULLET_VISUAL_SPEC`: fill `#E84545` / `PALETTE.CRIMSON_BRIGHT`, core `#FFFDF5` / `PALETTE.BONE_WHITE`, outline `#141019` / `PALETTE.INK_DARK`, `depth: 60`, `neverTintByElement: true`) remain intact.
- In `entity-sync.ts`, enemy projectiles rotate ONLY when `b.bulletShape === 'lance'` (`rot = b.angle`); all round orbs (`'small_orb'`, `'orb'`, `'heavy_orb'`, `undefined`) force `rot = 0`.

## Review Focus

1. **Pooled projectile `bulletShape` reset** — When an enemy bullet with `bulletShape: 'small_orb'` (or `alternateBulletShape: 'small_orb'`) expires into `projectilePool` and is recycled for an untagged volley (`bulletShape: undefined`), `reused.bulletShape` must be `undefined` (pinned in Task 1).
2. **`lance` linear-only invariant across all 15 Boss patterns** — Stepping all 5 patterns + active streams on `spore_king` (including burrow eruption), `kryssa_ice_queen`, and `forge_titan` must never emit a projectile with `bulletShape === 'lance'` and `(b.angularVelRad ?? 0) !== 0` (pinned in Task 1).
3. **`bakeProjectilesAndFx` canvas key parity** — Running `bakeProjectilesAndFx(scene, 2)` must register `'proj_enemy_small_orb'`, `'proj_enemy_orb'`, `'proj_enemy_heavy_orb'`, and `'proj_enemy_lance'` and must NOT register `'proj_enemy_wave'`, `'proj_enemy_diamond'`, or `'proj_enemy_ring_bolt'` (pinned in Task 2).
4. **No `heavy_orb` double-scaling** — `resolveProjectileRenderSpec({ team: 'enemy', bulletShape: 'heavy_orb', radius: 7.8 })` must return `scale: 1.0` (using per-tier reference radius `7.8` instead of `6.0`), and `radius: 8.6` must return `scale: 8.6 / 7.8` (pinned in Task 3).
5. **Pooled Phaser sprite rotation reset** — Recycling a pooled enemy projectile sprite that previously had non-zero rotation (`lance`) for a round orb (`'small_orb'`, `'orb'`, `'heavy_orb'`, or `undefined`) with `b.angle !== 0` must reset `entry.sprite.rotation` to `0` (pinned in Task 3).

---

### Task 1: Shared `EnemyBulletShape` Contract, Regular Enemies & Boss 15-Pattern Silhouette Mapping

**Files:**
- Modify: `packages/shared/src/sim/world-sim-types.ts:113-120`
- Modify: `packages/shared/src/sim/sim-enemies-core.ts:321-345`
- Modify: `packages/shared/src/sim/sim-enemies-biome1.ts:592-617,862-889`
- Modify: `packages/shared/src/sim/sim-enemies-biome2.ts:43-66,474-498`
- Modify: `packages/shared/src/sim/sim-enemies-tactical-b23.ts:298-305,342-352`
- Modify: `packages/shared/src/sim/sim-boss-patterns.ts:75-1184`
- Test: `packages/shared/test/boss-bullet-hell-kinematics-graze.test.ts`
- Test: `packages/shared/test/boss-bullet-hell-patterns.test.ts`

**Interfaces:**
- Consumes: `WorldSim.spawnDeterministicVolley(ev: BulletVolleySpawnEvent)` in `packages/shared/src/sim/sim-projectiles.ts`
- Produces: `export type EnemyBulletShape = 'small_orb' | 'orb' | 'heavy_orb' | 'lance'` in `packages/shared/src/sim/world-sim-types.ts` (re-exported via `@ashen-pact/shared`)

- [ ] **Step 1: Update shared unit tests to assert the 4-shape contract, pool reset, regular enemy tags, and `lance` linear-only Boss invariant**

In `packages/shared/test/boss-bullet-hell-kinematics-graze.test.ts`:
- Replace retired `'diamond'` and `'wave'` literals with `'small_orb'` / `'heavy_orb'` / `'orb'`.
- In the `projectilePool` recycling test, spawn with `bulletShape: 'small_orb'` and verify recycled untagged projectile has `reused.bulletShape === undefined`.
- In the regular enemy test at the bottom of the file, spawn and step attacks (or inspect emitted volleys) for `goblin_shooter` (`'lance'`), `thorn_turret` (`'small_orb'`), `frost_bat` (`'small_orb'`), `ice_mage` non-prism 3-way spread (`'orb'`), and `kryssa_clone` (`'small_orb'`).

In `packages/shared/test/boss-bullet-hell-patterns.test.ts`:
- Update `spore_king` Pattern 1 assertion from `bulletShape === 'wave'` / `'lance'` to:
  ```ts
  expect(
    sim.projectiles.some((b) => b.bulletShape === 'heavy_orb' && b.kinematicMode === 'decel'),
  ).toBe(true);
  expect(sim.projectiles.some((b) => b.bulletShape === 'small_orb')).toBe(true);
  ```
- Add test `'enforces Gungeon 4-shape discipline and linear-only lance invariant across all 15 Boss patterns and streams'` that executes Patterns `0..4` (plus 12 stream ticks each and `spore_king` burrow eruption) across `spore_king`, `kryssa_ice_queen`, and `forge_titan` and asserts:
  ```ts
  const allowed = new Set(['small_orb', 'orb', 'heavy_orb', 'lance']);
  expect(allowed.has(b.bulletShape!)).toBe(true);
  if (b.bulletShape === 'lance') {
    expect(b.angularVelRad ?? 0).toBe(0);
    expect(b.kinematicMode).not.toBe('spiral');
  }
  ```

- [ ] **Step 2: Run shared pattern & kinematics tests to verify they fail before implementation**

Run: `pnpm --filter @ashen-pact/shared exec vitest run --no-file-parallelism test/boss-bullet-hell-kinematics-graze.test.ts test/boss-bullet-hell-patterns.test.ts`
Expected: FAIL (`spore_king` Pattern 1 still emits `'wave'`/`'lance'`, and Boss patterns emit `'diamond'`/`'ring_bolt'`/`'wave'`).

- [ ] **Step 3: Narrow `EnemyBulletShape` and remap regular enemies & Boss 15-pattern volleys**

1. `packages/shared/src/sim/world-sim-types.ts`:
   ```ts
   export type EnemyBulletShape =
     | 'small_orb'
     | 'orb'
     | 'heavy_orb'
     | 'lance';
   ```
2. Regular enemies (preserve all `speed`, `radius`, `pelletCount`, `spreadRad`, and RNG calls):
   - `sim-enemies-core.ts` (`vengeful_ring`): add `bulletShape: 'orb'`.
   - `sim-enemies-biome1.ts`: `thorn_turret` (`thorn_burst` ~L608) -> `bulletShape: 'small_orb'`; `spore_king` burrow eruption (`thorn_burst` ~L879) -> `bulletShape: 'orb'`, `alternateBulletShape: 'small_orb'`.
   - `sim-enemies-biome2.ts`: `frost_bat` (`frost_shard` ~L57) -> `bulletShape: 'small_orb'`; `kryssa_clone` (`kryssa_frost_nova` ~L488) -> `bulletShape: 'small_orb'`.
   - `sim-enemies-tactical-b23.ts`: `ice_mage` 3-way `frost_orb` (~L301) -> `bulletShape: 'orb'`; `refractEnemyProjectileThroughCryoPrism` (~L348) -> `bulletShape: 'small_orb'` (keep prism snipe at ~L290 as `'lance'`).
3. Boss patterns in `packages/shared/src/sim/sim-boss-patterns.ts` (exact Spec §4.3 mapping, zero physics/RNG drift):
   - `updateBossProjectileStream`:
     - `spore_king`: `pat === 2` -> `bulletShape: step % 2 === 1 ? 'small_orb' : 'orb'`; `pat === 3` -> `bulletShape: 'small_orb'`; `pat === 4` -> `bulletShape: 'small_orb'`.
     - `kryssa_ice_queen`: `pat === 0` -> `'lance'`; `pat === 3` -> `bulletShape: sign === 1 ? 'orb' : 'small_orb'`; `pat === 4` -> `bulletShape: 'orb'`, `alternateBulletShape: 'small_orb'`.
     - `forge_titan`: `pat === 2` -> `bulletShape: 'orb'`, `alternateBulletShape: 'small_orb'`; `pat === 3` -> `bulletShape: step % 2 === 1 ? 'small_orb' : 'orb'`; `pat === 4` -> `bulletShape: 'small_orb'`.
   - `executeSporeKingSurfacePattern`:
     - `pat === 0`: `boss_spore_ring` -> `bulletShape: 'orb'`, `alternateBulletShape: 'small_orb'`; P3 `shaman_staff` -> `bulletShape: 'heavy_orb'`.
     - `pat === 1`: `spore_crescent_wave` -> `bulletShape: 'heavy_orb'`; `spore_thorn_fan` -> `bulletShape: 'small_orb'`.
     - `pat === 2`: `'orb'`; `pat === 3`: `'heavy_orb'`; `pat === 4`: `bulletShape: 'heavy_orb'`, `alternateBulletShape: 'orb'`.
   - `executeKryssaPattern`:
     - `pat === 0`: `'lance'`; `pat === 1` (`kryssa_glacier_wall`): `'heavy_orb'`; `pat === 2` (`kryssa_frost_nova`): `bulletShape: 'orb'`, `alternateBulletShape: 'small_orb'`; `pat === 3` (`kryssa_prism_vortex`): `bulletShape: sign === 1 ? 'orb' : 'small_orb'`; `pat === 4` (`kryssa_blizzard_climax`): outer ring `'heavy_orb'`, fan `bulletShape: 'orb'`, `alternateBulletShape: 'small_orb'`.
   - `executeForgeTitanPattern` & `spawnTitanMagmaBarrageVolley`:
     - Solo P3 `titan_slag_wave` (L897): `'lance'`.
     - `pat === 0` (`titan_anvil_ring`): `'heavy_orb'`.
     - `pat === 1`: `titan_slag_wave` -> `'heavy_orb'`; legacy P3 `titan_flame_sweep` -> `'orb'`.
     - `pat === 2` (`titan_flame_sweep`): `'orb'`; `pat === 3` (`titan_crucible_gear`): `'orb'`.
     - `pat === 4`: `titan_magma_barrage` -> `'heavy_orb'`; `titan_flame_sweep` -> `'orb'`.
     - `spawnTitanMagmaBarrageVolley`: `bulletShape: 'heavy_orb'`, `alternateBulletShape: 'small_orb'`.

- [ ] **Step 4: Verify `@ashen-pact/shared` build, typecheck, lint, unit tests, and Spec 3.10 balance gates**

Run:
```bash
pnpm --filter @ashen-pact/shared typecheck
pnpm --filter @ashen-pact/shared build
pnpm --filter @ashen-pact/shared exec vitest run --no-file-parallelism test/boss-bullet-hell-kinematics-graze.test.ts test/boss-bullet-hell-patterns.test.ts test/ap2-p0a-deterministic-projectiles.test.ts test/round3-surfaces-and-props.test.ts
pnpm --filter @ashen-pact/shared exec vitest run --no-file-parallelism test/ap2-p3c-balance-targets.test.ts test/ap2-p5-holistic-soak-balance.test.ts
npx eslint packages/shared/src/sim/world-sim-types.ts packages/shared/src/sim/sim-enemies-core.ts packages/shared/src/sim/sim-enemies-biome1.ts packages/shared/src/sim/sim-enemies-biome2.ts packages/shared/src/sim/sim-enemies-tactical-b23.ts packages/shared/src/sim/sim-boss-patterns.ts packages/shared/test/boss-bullet-hell-kinematics-graze.test.ts packages/shared/test/boss-bullet-hell-patterns.test.ts
```
Expected: All commands exit `0` with `allTargetsPassed === true`.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/shared/src/sim/world-sim-types.ts packages/shared/src/sim/sim-enemies-core.ts packages/shared/src/sim/sim-enemies-biome1.ts packages/shared/src/sim/sim-enemies-biome2.ts packages/shared/src/sim/sim-enemies-tactical-b23.ts packages/shared/src/sim/sim-boss-patterns.ts packages/shared/test/boss-bullet-hell-kinematics-graze.test.ts packages/shared/test/boss-bullet-hell-patterns.test.ts
git commit -m "feat(shared): unify enemy bullet shapes around 3-tier round orbs and linear lance"
```

---

### Task 2: Procedural Texture Baker for `proj_enemy_small_orb` & Streamlined Teardrop `proj_enemy_lance`

**Files:**
- Modify: `apps/client/src/art/texture-baker-fx.ts:17-60,195-475`
- Test: `apps/client/test/topdown-shader-vfx-baker.test.ts`

**Interfaces:**
- Consumes: `ENEMY_BULLET_VISUAL_SPEC`, `PALETTE`, `outlined`, `bakeCustomCanvas` in `apps/client/src/art/`
- Produces: Updated `BAKED_FX_TEXTURE_KEYS` and `bakeProjectilesAndFx(scene, scale)` registering `'proj_enemy_small_orb'`, `'proj_enemy_orb'`, `'proj_enemy_heavy_orb'`, `'proj_enemy_lance'`, and `'fx_enemy_bullet_glow'` (with `'proj_enemy_wave'`, `'proj_enemy_diamond'`, and `'proj_enemy_ring_bolt'` removed)

- [ ] **Step 1: Add failing texture-baker tests in `apps/client/test/topdown-shader-vfx-baker.test.ts`**

Extend `'preserves ENEMY_BULLET_VISUAL_SPEC (#E84545, depth 60) and core BAKED_FX_TEXTURE_KEYS invariants'` (and add a canvas-bake check calling `bakeProjectilesAndFx` on a mock Phaser scene / stubbed `document.createElement('canvas')` context if needed, or reuse the existing baker test harness in `topdown-shader-vfx-baker.test.ts`):
```ts
expect(BAKED_FX_TEXTURE_KEYS).toContain('proj_enemy_small_orb');
expect(BAKED_FX_TEXTURE_KEYS).toContain('proj_enemy_orb');
expect(BAKED_FX_TEXTURE_KEYS).toContain('proj_enemy_heavy_orb');
expect(BAKED_FX_TEXTURE_KEYS).toContain('proj_enemy_lance');
expect(BAKED_FX_TEXTURE_KEYS).not.toContain('proj_enemy_wave');
expect(BAKED_FX_TEXTURE_KEYS).not.toContain('proj_enemy_diamond');
expect(BAKED_FX_TEXTURE_KEYS).not.toContain('proj_enemy_ring_bolt');
```
Also invoke `bakeProjectilesAndFx` with a mock `scene.textures` recorder and assert the registered keys include `'proj_enemy_small_orb'`, `'proj_enemy_orb'`, `'proj_enemy_heavy_orb'`, `'proj_enemy_lance'` and exclude the 3 retired keys.

- [ ] **Step 2: Run baker test to verify it fails**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/topdown-shader-vfx-baker.test.ts`
Expected: FAIL (`proj_enemy_small_orb` missing; retired keys still present).

- [ ] **Step 3: Update `BAKED_FX_TEXTURE_KEYS` and `bakeProjectilesAndFx` in `apps/client/src/art/texture-baker-fx.ts`**

1. In `BAKED_FX_TEXTURE_KEYS`: replace `'proj_enemy_wave'`, `'proj_enemy_diamond'`, `'proj_enemy_ring_bolt'` with `'proj_enemy_small_orb'` alongside `'proj_enemy_orb'`, `'proj_enemy_heavy_orb'`, and `'proj_enemy_lance'`.
2. Bake `'proj_enemy_small_orb'` (`24x24` canvas):
   - Radial halo `r = 7.6` (`rgba(255, 85, 115, 0.22)` -> `rgba(232, 69, 69, 0)`).
   - `outlined` circle `r = 5.2` using `ENEMY_BULLET_VISUAL_SPEC.fill`, `shade: PALETTE.RUBY_CORE`, `highlight: '#FF758F'`, `outlineColor: ENEMY_BULLET_VISUAL_SPEC.outlineColor`, `outlineWidth: ENEMY_BULLET_VISUAL_SPEC.outlineWidth`.
   - Inner dark ruby ring `r = 3.0` (`PALETTE.RUBY_DARK`) and centered `ENEMY_BULLET_VISUAL_SPEC.core` pin-core `r = 2.1`.
3. Redesign `'proj_enemy_lance'` (`30x22` canvas) as a smooth round-nosed teardrop bolt pointing `+X`:
   - Subtle radial halo centered at `(1.5, 0)` with `r = 9.2` (`rgba(255, 92, 122, 0.22)` -> `0`).
   - Smooth closed path using tangential circular nose `ctx.arc(4.2, 0, 4.4, -Math.PI * 0.42, Math.PI * 0.42, false)` tapering smoothly to rounded tail `ctx.arc(-8.8, 0, 1.6, Math.PI * 0.58, -Math.PI * 0.58, false)`, rendered through `outlined(...)` with `ENEMY_BULLET_VISUAL_SPEC` colors (`outlineWidth: 1.5`).
   - Smooth inner teardrop core in `ENEMY_BULLET_VISUAL_SPEC.core` spanning `x = -4.2 .. +6.4` (`arc(4.0, 0, 2.2, -Math.PI * 0.45, Math.PI * 0.45)` to `(-4.2, 0)`).
4. Remove the `proj_enemy_wave`, `proj_enemy_diamond`, and `proj_enemy_ring_bolt` `bakeCustomCanvas` blocks (and remove unused imports if any).

- [ ] **Step 4: Run baker test and ESLint on `texture-baker-fx.ts`**

Run:
```bash
pnpm --filter @ashen-pact/client exec vitest run test/topdown-shader-vfx-baker.test.ts
npx eslint apps/client/src/art/texture-baker-fx.ts apps/client/test/topdown-shader-vfx-baker.test.ts
```
Expected: PASS with 0 lint errors.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/client/src/art/texture-baker-fx.ts apps/client/test/topdown-shader-vfx-baker.test.ts
git commit -m "feat(client): bake small_orb and streamlined teardrop lance projectile textures"
```

---

### Task 3: 1:1 Hitbox-Aligned Render Spec, `lance`-Only Entity Sync Rotation & Full Workspace Verification

**Files:**
- Modify: `apps/client/src/fx/combat-fx-spawners.ts:91-138`
- Modify: `apps/client/src/scenes/game-scene/entity-sync.ts:579-598`
- Test: `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts`

**Interfaces:**
- Consumes: `EnemyBulletShape` (`'small_orb' | 'orb' | 'heavy_orb' | 'lance'`) from `@ashen-pact/shared`; `'proj_enemy_small_orb'`, `'proj_enemy_orb'`, `'proj_enemy_heavy_orb'`, `'proj_enemy_lance'` from `BAKED_FX_TEXTURE_KEYS`
- Produces: `resolveProjectileRenderSpec(...) -> ProjectileRenderSpec` in `apps/client/src/fx/combat-fx-spawners.ts` and `syncProjectilesAndPickupsImpl` rotation/glow behavior in `apps/client/src/scenes/game-scene/entity-sync.ts`

- [ ] **Step 1: Update failing client FX & entity-sync tests in `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts`**

1. Update the `EnemyBulletShape` mapping test (~L95-130) to verify:
   - `[undefined, 'proj_enemy_orb', 6.0]`, `['small_orb', 'proj_enemy_small_orb', 5.2]`, `['orb', 'proj_enemy_orb', 6.0]`, `['heavy_orb', 'proj_enemy_heavy_orb', 7.8]`, `['lance', 'proj_enemy_lance', 6.0]`.
   - At `radius: 7.8`, `'heavy_orb'` returns `scale` `1.0` (`7.8 / 7.8`), and at `radius: 8.6`, `scale` is `8.6 / 7.8`.
   - At `radius: 5.2`, `'small_orb'` returns `scale` `1.0` (`5.2 / 5.2`).
   - Default `resolveProjectileRenderSpec({ team: 'enemy' })` returns `textureKey: 'proj_enemy_orb'` and `scale: 1.0`.
   - Lower/upper clamps return `0.75` (`radius: 2.0`) and `1.65` (`radius: 16.0`).
2. Update the `syncProjectilesAndPickupsImpl` test (~L670-794) to verify:
   - An enemy `'lance'` bullet with `angle: 0.65` renders with `textureKey === 'proj_enemy_lance'`, `entry.sprite.rotation === 0.65`, `entry.glowSprite.scale / entry.sprite.scale === 0.95`, and `alpha === 0.22 + 0.04 * Math.sin(0.5 * 9.0 + (bullet.id & 7))`.
   - Recycling that pooled sprite for a `'small_orb'` (or `'heavy_orb'`) bullet with `angle: 1.2` resets `entry.sprite.rotation` to `0`, updates `textureKey` to `'proj_enemy_small_orb'`, and sets `entry.glowSprite.scale / entry.sprite.scale` to `1.05`.

- [ ] **Step 2: Run client FX test to verify it fails**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/polish-p10b-fx-elemental-ambient.test.ts`
Expected: FAIL (`small_orb` falls back to `proj_enemy_orb`, `heavy_orb` scales by `/ 6.0`, min clamp is `0.85`).

- [ ] **Step 3: Implement per-tier 1:1 hitbox scaling in `combat-fx-spawners.ts` and `lance`-only rotation in `entity-sync.ts`**

1. In `apps/client/src/fx/combat-fx-spawners.ts` (`resolveProjectileRenderSpec`, `params.team === 'enemy'`):
   - Map shape to `{ textureKey, refRadius }`:
     - `isStress`: `'proj_stress_enemy'`, `scale = 1.0`
     - `'small_orb'`: `'proj_enemy_small_orb'`, `refRadius = 5.2`
     - `'heavy_orb'`: `'proj_enemy_heavy_orb'`, `refRadius = 7.8`
     - `'lance'`: `'proj_enemy_lance'`, `refRadius = 6.0`
     - `'orb'` / `undefined`: `'proj_enemy_orb'`, `refRadius = 6.0`
   - `scale = params.isStress ? 1.0 : clamp((params.radius ?? refRadius) / refRadius, 0.75, 1.65)`.
2. In `apps/client/src/scenes/game-scene/entity-sync.ts` (`syncProjectilesAndPickupsImpl`):
   - Replace multi-shape enemy rotation branches with:
     ```ts
     if (b.team === 'enemy') {
       rot = b.bulletShape === 'lance' ? b.angle : 0;
     }
     ```
   - Set enemy glow scale & subtle pulse:
     ```ts
     const glowMult = b.bulletShape === 'lance' ? 0.95 : 1.05;
     entry.glowSprite.setScale(projScale * specScale * glowMult);
     entry.glowSprite.setAlpha(0.22 + 0.04 * Math.sin(visualTimeSec * 9.0 + (b.id & 7)));
     ```

- [ ] **Step 4: Run full client test suite, workspace `typecheck`, `build`, and ESLint**

Run:
```bash
pnpm --filter @ashen-pact/client test
pnpm typecheck
pnpm build
npx eslint "packages/*/src/**/*.ts" "apps/*/src/**/*.ts" apps/client/test/polish-p10b-fx-elemental-ambient.test.ts
```
Expected: All `27/27` client test files pass, `pnpm typecheck` exits `0`, `pnpm build` exits `0`, and ESLint exits `0`.

- [ ] **Step 5: Commit Task 3**

```bash
git add apps/client/src/fx/combat-fx-spawners.ts apps/client/src/scenes/game-scene/entity-sync.ts apps/client/test/polish-p10b-fx-elemental-ambient.test.ts
git commit -m "feat(client): enforce 1:1 orb hitbox scaling and lance-only bullet rotation"
```
