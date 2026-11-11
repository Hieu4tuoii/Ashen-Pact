# Gungeon-Style Enemy Bullet Silhouette & Trajectory Discipline — Design Spec

**Date:** 2026-11-11  
**Status:** Draft (Pending User Approval)  
**Selected Approach:** Hướng 1 — *Enter the Gungeon* Silhouette Discipline (~90% 3-Tier Concentric Round Orbs + 1 Directional Linear Sniper Bolt `lance`)

---

## 1. Intent & Why

Currently, enemy and Boss volleys mix six different shapes (`orb`, `wave`, `lance`, `diamond`, `heavy_orb`, `ring_bolt`) — including curved crescents (`proj_enemy_wave`), 4-point diamonds (`proj_enemy_diamond`), and continuously spinning 4-fin chakrams (`proj_enemy_ring_bolt`). In dense solo bullet-hell curtains, mixing polygonal and spinning shapes causes two gameplay problems:

1. **Visual Clutter & Readability Fatigue:** Spinning chakrams and wide crescents compete for attention, making safe dodge lanes harder to parse at a glance.
2. **Hitbox Dishonesty:** Every projectile in `packages/shared` resolves player collision via `circleVsCircle(b, pl)`. Wide crescents and elongated diamonds visually protrude outside — or leave empty corners inside — their circular collision radius, while `proj_enemy_heavy_orb` (baked at `r = 8.6`) is scaled against `6.0` (`scale = radius / 6.0`), inflating its rendered radius ~26–43% beyond its actual hitbox.

Following *Enter the Gungeon*'s bullet-hell readability principle and the user's choice (**Hướng 1**), enemy projectiles will unify around **clean concentric round silhouettes (~90% of all volleys)** across **three size/weight tiers** (`small_orb`, `orb`, `heavy_orb`) whose rendered bodies match their circular hitboxes 1:1, plus **one streamlined round-nosed directional bolt (`lance`)** reserved strictly for fast, aimed, linear sniper/spear shots. Combat variety is expressed through **attack choreography, formation geometry, speed kinematics (`decel`, `accel`, `pulse`, `alternateSpeedScale`), trajectory curvature (`spiral` / `angularVelRad`, wall `bounceCount`), and orb scale contrast** rather than novelty polygon shapes.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- Narrow `EnemyBulletShape` from 6 shapes to **4 disciplined silhouettes**: `'small_orb' | 'orb' | 'heavy_orb' | 'lance'`.
- Retire `proj_enemy_wave`, `proj_enemy_diamond`, and `proj_enemy_ring_bolt` from client texture baking, sprite rotation, and tests.
- Bake a crisp compact bead texture (`proj_enemy_small_orb`) and redesign `proj_enemy_lance` as a sleek *Gungeon*-style round-nosed teardrop bolt (eliminating angular polygon corners).
- Align rendered orb body radii 1:1 with `SimProjectileState.radius` via per-tier reference radii so safe gaps between bullets are pixel-accurate.
- Restrict sprite rotation on enemy bullets strictly to `bulletShape === 'lance'` (`rot = b.angle`); all round orb tiers render with `rot = 0` (zero spinning jitter).
- Preserve 100% of existing Boss 5-pattern choreography, trajectory diversity (`decel`, `accel`, `pulse`, `spiral`, `gapIndices`, `alternateSpeedScale`, `alternateRadiusScale`, wall bounces), Co-op determinism (`BulletVolleySpawnEvent`), and Spec 3.10 / Phase P3C / Phase P5 quantitative balance targets.

### Non-Goals
- Modifying player weapon projectile textures (`proj_player_*`, `proj_knight_sword_wave`) or player VFX.
- Adding non-circular (capsule/OBB) collision primitives to `WorldSim`.
- Changing Boss HP, cooldowns, damage numbers, `BIOME_SCALING`, or minion spawn rules.

### Anti-Goals (Failure Conditions Even If Code Compiles)
- Using `lance` on radial rings, curved `spiral` streams (`angularVelRad !== 0`), or wide slow shotgun spreads where an elongated sprite misrepresents its circular hitbox or curves sideways.
- Altering RNG call counts (`sim.rng.nextUint32()`) or regular-enemy projectile physics (`speed`, `radius`, `pelletCount`, `spreadRad`) in ways that shift `ap2-p3c-balance-targets.test.ts` or `ap2-p5-holistic-soak-balance.test.ts` out of Spec 3.10 bounds.
- Re-introducing large blurry additive glow halos or white strobe flashes on bullets/enemies.

---

## 3. Approaches Considered

1. **Hướng 1 (Selected): ~90% 3-Tier Concentric Round Orbs (`small_orb`, `orb`, `heavy_orb`) + 1 Streamlined Directional Sniper Bolt (`lance`)**
   - *Pros:* Instant gap readability and 1:1 circular hitbox honesty across all rings, spirals, walls, and curtains, while high-velocity linear snipes (`goblin_shooter`, `welder_drone`, `ice_mage` prism spear, `kryssa_ice_beam`, `forge_titan` solo aimed spear) immediately telegraph fast straight-line danger.
   - *Cons:* Requires clear rules constraining where `lance` is allowed (solved via explicit invariant below).
2. **Hướng 2: 100% Round Orbs Only (`small_orb`, `orb`, `heavy_orb`)**
   - *Pros:* Absolute geometric uniformity.
   - *Cons:* Fast sniper arrows/beams (`goblin_bow`, `kryssa_ice_beam`) lose instant directional velocity cue at spawn. Rejected per user selection of Hướng 1.
3. **Keep Multi-Shape Polygons & Resize Only**
   - *Pros:* Minimal code churn.
   - *Cons:* Retains crescent/diamond/chakram visual noise and circular hitbox mismatch. Rejected.

---

## 4. Technical Design

### 4.1 Shared Simulation Contract (`packages/shared`)

In `packages/shared/src/sim/world-sim-types.ts`:
```ts
export type EnemyBulletShape =
  | 'small_orb'
  | 'orb'
  | 'heavy_orb'
  | 'lance';
```

**`lance` Discipline Invariant:**
`bulletShape: 'lance'` is permitted **only** when all three conditions hold:
1. Aimed linear shot (`radialStepRad === undefined` and `(angularVelRad ?? 0) === 0`).
2. High-speed projectile (`speed >= 185` on primary shot, or Kryssa's aimed `kryssa_ice_beam` follow-up at `speed >= 154` with `bounceCount >= 1` where `sim-projectiles.ts` updates `b.angle = Math.atan2(b.vy, b.vx)` on bounce).
3. Focused count (`pelletCount <= 6` aimed narrow spread `spreadRad <= 0.44`).

Every radial ring, spiral stream, wide shotgun fan (`spreadRad >= 0.6`), glacier wall, mortar, and refracted split uses `'small_orb'`, `'orb'`, or `'heavy_orb'`.

### 4.2 Regular Enemy Mapping (Zero Physics Delta)

All regular enemy `speed`, `radius`, `pelletCount`, `spreadRad`, and RNG calls remain **unchanged** so Biome 1–3 balance metrics stay bit-identical:

| Enemy / Mechanic | File | Weapon ID | Trajectory & Speed | New `bulletShape` |
|---|---|---|---|---|
| `goblin_shooter` | `sim-enemies-tactical-ai.ts` | `goblin_bow` | Aimed 2-arrow spread + 1 predictive lead (`speed: 285`, `r: 5.8`) | `'lance'` |
| `goblin_shaman` | `sim-enemies-biome1.ts` | `shaman_staff` | Single aimed poison orb (`speed: 205`, `r: 6.6`) | `'orb'` |
| `thorn_turret` | `sim-enemies-biome1.ts` | `thorn_burst` | 6-way 360° radial ring (`speed: 180`, `r: 6.0`) | `'small_orb'` |
| `vengeful` elite ring | `sim-enemies-core.ts` | `vengeful_ring` | 8-way death ring (`speed: 175`, `r: 6.0`) | `'orb'` |
| `frost_bat` | `sim-enemies-biome2.ts` | `frost_shard` | Fast 2-pellet wide dart (`speed: 235`, `spread: 0.72`, `r: 5.2`) | `'small_orb'` |
| `ice_mage` (prism snipe) | `sim-enemies-tactical-b23.ts` | `frost_orb` | 1 aimed shatter spear into Cryo Prism (`speed: 232`, `r: 6.6`) | `'lance'` |
| `ice_mage` (3-way fan) | `sim-enemies-tactical-b23.ts` | `frost_orb` | 3-pellet wide spread (`speed: 220`, `spread: 0.96`, `r: 6.6`) | `'orb'` |
| Cryo Prism refraction | `sim-enemies-tactical-b23.ts` | `frost_orb` | 3-way refracted split fan (`r: b.radius`) | `'small_orb'` |
| `ice_golem` | `sim-enemies-biome2.ts` | `glacier_spike` | 5-pellet wide heavy shotgun (`speed: 208`, `spread: 1.68`, `r: 6.5`) | `'heavy_orb'` |
| `kryssa_clone` | `sim-enemies-biome2.ts` | `kryssa_frost_nova` | 2-pellet clone frost shot (`speed: 175`, `r: 6.5`) | `'small_orb'` |
| `fire_imp` | `sim-enemies-biome3.ts` | `imp_fireball` | 2-pellet twin fireball (`speed: 235`, `spread: 0.68`, `r: 6.2`) | `'orb'` |
| `dwarf_cannon` (stress) | `sim-enemies-biome3.ts` | `dwarf_mortar` | Heavy cannonball (`speed: 215`, `r: 7.8`) | `'heavy_orb'` |
| `welder_drone` | `sim-enemies-biome3.ts` | `welder_arc` | 1 fast aimed shock bolt (`speed: 255`, `r: 6.2`) | `'lance'` |
| `iron_shielder` | `sim-enemies-biome3.ts` | `shielder_slug` | 3-pellet wide heavy slug (`speed: 222`, `spread: 0.96`, `r: 6.6`) | `'heavy_orb'` |

### 4.3 Boss 5-Pattern Choreography & Silhouette Mapping

All calibrated Boss `damage`, `pelletCount`, cooldowns, RNG calls, and primary collision `radius`/`speed` values are preserved so Spec 3.10 Boss kill times and solo/co-op winrates remain intact, while pairing each pattern's kinematic profile with clear 3-tier round orb contrast (plus `lance` only on aimed linear beams/spears):

1. **Boss 1 — `spore_king` (`sim-enemies-biome1.ts` & `sim-boss-patterns.ts`)**
   - **Burrow Eruption (`thorn_burst`):** 8/10/12 radial ring with `alternateSpeedScale: 0.78` -> `bulletShape: 'orb'`, `alternateBulletShape: 'small_orb'` (dual-speed concentric spore rings).
   - **Pattern 0 (`boss_spore_ring` + P3 `shaman_staff`):** `16/18` radial ring (`speed: 174`, `alternateSpeedScale: 0.76`, `radius: 7.0`, `alternateRadiusScale: 0.88`) -> `bulletShape: 'orb'`, `alternateBulletShape: 'small_orb'`; P3 aimed 2-pellet `shaman_staff` -> `bulletShape: 'heavy_orb'`.
   - **Pattern 1 (`spore_crescent_wave` + `spore_thorn_fan`):** Center 2-pellet `decel` (`194 -> 138`, `r: 8.4`) -> `bulletShape: 'heavy_orb'`; flanking left/right 3-pellet fans (`±0.86 rad`, `speed: 162`, `r: 6.8`) -> `bulletShape: 'small_orb'`.
   - **Pattern 2 (`spore_spiral_stream`):** 3-arm alternating `spiral` stream (`angularVelRad: ±0.08`, `speed: 158`, `r: 6.8`) -> initial volley `'orb'`, stream steps alternate `step % 2 === 1 ? 'small_orb' : 'orb'` for rhythmic bead-chain visibility.
   - **Pattern 3 (`spore_cluster_orb` + stream `spore_cluster_dart`):** Outer 10-orb `decel` ring (`198 -> 108`, `r: 8.0`) -> `'heavy_orb'`; delayed aimed 2-pellet inner dart (`speed: 172`, `r: 6.8`) -> `'small_orb'`.
   - **Pattern 4 Climax (`spore_miasma_climax` — "ĐẠI DỊCH BÀO TỬ!"):** Initial 14-pellet `pulse` ring (`165 <-> 112`, `r: 7.4`) -> `bulletShape: 'heavy_orb'`, `alternateBulletShape: 'orb'`; 4-arm rotating stream (`speed: 158`, `r: 7.0`) -> `bulletShape: 'small_orb'`.

2. **Boss 2 — `kryssa_ice_queen` (`sim-boss-patterns.ts`)**
   - **Pattern 0 (`kryssa_ice_beam` + stream follow-up):** Fast aimed bouncing/piercing beam (`speed: 188`, `bounceCount: 3`, `pierceCount: 1`) + aimed bouncing follow-up (`speed: 154`, `bounceCount: 1`) -> **`bulletShape: 'lance'`** (Kryssa's signature linear ice-spear snipe).
   - **Pattern 1 (`kryssa_glacier_wall` — "TƯỜNG BĂNG!"):** `15/17`-pellet arc with 3-pellet solo `gapIndices` and delayed `accel` (`66 -> 198` after `0.36s`, `r: 7.6`) -> `bulletShape: 'heavy_orb'` (unmistakable circular gap).
   - **Pattern 2 (`kryssa_frost_nova`):** `14/16/18` bouncing radial ring (`alternateSpeedScale: 0.76`, `bounceCount: 1`, `r: 7.4`) -> `bulletShape: 'orb'`, `alternateBulletShape: 'small_orb'`.
   - **Pattern 3 (`kryssa_prism_vortex`):** Dual counter-rotating 4-arm `spiral` streams (`angularVelRad: ±0.4`, `speed: 146`, `r: 7.0`) -> `sign === 1 ? 'orb' : 'small_orb'` (woven medium/small counter-spiral lattice).
   - **Pattern 4 Climax (`kryssa_blizzard_climax` — "BÃO TUYẾT VĨNH CỬU!"):** Outer 16-pellet `decel` ring (`196 -> 104`, `r: 8.8`) -> `'heavy_orb'`; initial + alternating stream 5-pellet sweeping fans (`speed: 168`, `r: 7.8`) -> `bulletShape: 'orb'`, `alternateBulletShape: 'small_orb'`.

3. **Boss 3 — `forge_titan` (`sim-boss-patterns.ts`)**
   - **Solo P3 Aimed Spear (`titan_slag_wave`, cycles 14–18 solo, `pelletCount: 3`, `spreadRad: 0.24`, `speed: 192`):** **`bulletShape: 'lance'`**.
   - **Pattern 0 (`titan_anvil_ring` + shockwave):** `14/16/18`-pellet `decel` ring (`178 -> 112`, `r: 8.6`) -> `'heavy_orb'`.
   - **Pattern 1 (`titan_magma_barrage` + `titan_slag_wave` / legacy `titan_flame_sweep`):** `spawnTitanMagmaBarrageVolley` (`speed: 142`, `alternateSpeedScale: 1.32`, `r: 8.6`, `alternateRadiusScale: 0.76`) -> `bulletShape: 'heavy_orb'`, `alternateBulletShape: 'small_orb'`; aimed 2-pellet `titan_slag_wave` (`r: 8.0`) -> `'heavy_orb'`; legacy P3 12-way `titan_flame_sweep` -> `'orb'`.
   - **Pattern 2 (`titan_flame_sweep` — "LỬA QUÉT LÒ RÈN!"):** Initial 2-pellet + sweeping 3-pellet flamethrower stream (`-0.82 .. +0.82 rad`, `speed: 162/166`, `r: 7.4/7.6`) -> initial `'orb'`, stream `bulletShape: 'orb'`, `alternateBulletShape: 'small_orb'`.
   - **Pattern 3 (`titan_crucible_gear`):** 8-spoke rotating `spiral` gear (`angularVelRad: 0.06 / 0.14 * strafeSign`, `r: 7.4/7.6`) -> initial `'orb'`, stream steps alternate `step % 2 === 1 ? 'small_orb' : 'orb'`.
   - **Pattern 4 Climax (`titan_meltdown_climax` — "LÕI NHIỆT HẠCH QUÁ TẢI!"):** Outer 16-pellet ring (`r: 8.8`) -> `'heavy_orb'`; inner 12-pellet delayed `accel` ring (`92 -> 185`, `r: 7.8`) -> `'orb'`; 8-spoke stream (`speed: 160`, `r: 7.6`) -> `'small_orb'`.

### 4.4 Client Texture Baking, 1:1 Hitbox Scaling & Entity Sync (`apps/client`)

1. **`BAKED_FX_TEXTURE_KEYS` & `bakeProjectilesAndFx` (`apps/client/src/art/texture-baker-fx.ts`):**
   - Remove `'proj_enemy_wave'`, `'proj_enemy_diamond'`, and `'proj_enemy_ring_bolt'`.
   - Add `'proj_enemy_small_orb'` (`24x24` canvas):
     - Subtle tight radial halo (`r = 7.6`, `rgba(255, 85, 115, 0.22) -> 0`).
     - Crisp circular body (`r = 5.2`) using `ENEMY_BULLET_VISUAL_SPEC.fill` (`#E84545`), `outlineColor` (`#141019`), `outlineWidth: 1.5`, and centered `#FFFDF5` pin-core (`r = 2.1`).
   - Keep `'proj_enemy_orb'` (`28x28`, body `r = 6.8`, dark ruby inner band, `#FFFDF5` core `r = 2.8`) and `'proj_enemy_heavy_orb'` (`32x32`, body `r = 8.6`, `1.8u` outline, `#FFB703` inner ring `r = 5.6`, `#FFFDF5` core `r = 3.6`).
   - Redesign `'proj_enemy_lance'` (`30x22` canvas) as a streamlined *Gungeon*-style round-nosed teardrop bolt pointing `+X`:
     - Smooth circular nose (`arc` centered at `x = 4.2, y = 0, r = 4.4`) tapering tangentially to a rounded tail (`arc` at `x = -8.8, y = 0, r = 1.6`), outlined with `1.5u` `#141019`, filled `#E84545`, with a `#FFFDF5` teardrop inner core (`x = -4.2 .. +6.4`).

2. **`resolveProjectileRenderSpec` (`apps/client/src/fx/combat-fx-spawners.ts`):**
   - Map enemy `bulletShape`:
     - `isStress === true` -> `'proj_stress_enemy'` (`scale = 1.0`)
     - `'small_orb'` -> `'proj_enemy_small_orb'` (reference radius `5.2`)
     - `'orb'` or `undefined` -> `'proj_enemy_orb'` (reference radius `6.0`)
     - `'heavy_orb'` -> `'proj_enemy_heavy_orb'` (reference radius `7.8`)
     - `'lance'` -> `'proj_enemy_lance'` (reference radius `6.0`)
   - Compute `scale = clamp((params.radius ?? refRadius) / refRadius, 0.75, 1.65)` so every orb tier renders at honest 1:1 visual-to-collision radius without double-scaling `heavy_orb`, while default `resolveProjectileRenderSpec({ team: 'enemy' })` still returns `textureKey: 'proj_enemy_orb'` and `scale: 1.0`.

3. **Sprite Rotation & Glow (`apps/client/src/scenes/game-scene/entity-sync.ts`):**
   - For `b.team === 'enemy'`:
     ```ts
     rot = b.bulletShape === 'lance' ? b.angle : 0;
     ```
     All round orbs (`'small_orb'`, `'orb'`, `'heavy_orb'`, `undefined`) never rotate or spin.
   - Keep `glowSprite` (`fx_enemy_bullet_glow`) subtle (`scale = projScale * specScale * (b.bulletShape === 'lance' ? 0.95 : 1.05)`, `alpha = 0.22 + 0.04 * Math.sin(...)`).

---

## 5. What Is Left to the Builder

- Exact tangential control angles for the smooth `arc` / `quadraticCurveTo` teardrop path of `proj_enemy_lance` within the `30x22` canvas.
- Updating unit test expectations in `packages/shared/test/boss-bullet-hell-patterns.test.ts`, `packages/shared/test/boss-bullet-hell-kinematics-graze.test.ts`, `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts`, and `apps/client/test/topdown-shader-vfx-baker.test.ts` to cover the 4-shape `EnemyBulletShape` contract, per-tier reference-radius scaling, and `lance`-only rotation.
