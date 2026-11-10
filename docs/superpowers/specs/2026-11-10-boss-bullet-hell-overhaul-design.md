# Solo-First Boss Bullet-Hell, Variable-Speed Projectiles & Emissive Enemy Bullets — Design Specification

**Date:** 2026-11-10  
**Project:** Ashen Pact (`@ashen-pact/shared`, `@ashen-pact/client`)  
**Status:** Draft (Pending Builder Check & User Approval)

---

## 1. Intent & Why

Currently, Boss encounters (`spore_king`, `kryssa_ice_queen`, `forge_titan`) and ranged combat in *Ashen Pact* lack the dramatic bullet-curtain tension and moment-to-moment dodging satisfaction of *Enter the Gungeon* for four concrete reasons:

1. **Repetitive, Single-Beat Boss Attacks**: Each Boss essentially cycles through 1–2 instant radial or 3-way bursts (`boss_spore_ring`, `kryssa_ice_beam` / `kryssa_frost_nova`, `titan_magma_barrage`) with uniform bullet silhouettes (`proj_enemy_orb`) and constant velocities (`215–265 px/s`). Even cycles on `forge_titan` emit zero bullets in Phases 1–2.
2. **Too Fast, Too Sparse, Too Small**: Enemy projectiles travel fast (Bosses `215–265 px/s`; regular enemies `265–360 px/s` effective) with small hitboxes (`radius = 5.0–6.0px`), turning dodging into twitch evasion of isolated tiny dots rather than reading and weaving through rich, tangible bullet curtains.
3. **Flat Visual Presence**: `proj_enemy_orb` renders at `BlendMode.NORMAL` with `#E84545` (luminance `0.46`, below `BiomePostFxPipeline`'s `0.74` bloom threshold), no additive glow halo, fixed `1.0` scale regardless of `b.radius`, and hardcoded `0` rotation (`entity-sync.ts` line 560).
4. **Missing Close-Dodge Drama in Solo Play**: In 1-player runs—where 100% of Boss aggro, bullet curtains, and arena prop interactions fall on the solo player—weaving millimetres past enemy fire has no tactile feedback or micro-reward, and Phase 3 (`<= 33%` HP) lacks a true signature bullet-hell climax.

This design transforms all 3 Bosses and enemy projectiles around a **solo-first (1P) bullet-hell experience**: diverse multi-shape/variable-speed *Gungeon*-inspired Boss patterns, slightly slower yet larger and denser Boss bullet curtains with guaranteed solo weaving lanes, slower regular enemy projectiles, vivid glowing multi-shape enemy bullets, **Bullet Graze ("Sượt Đạn")** solo micro-rewards, and **Boss Signature Windups + Phase 3 Climax barrages**.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **5 Distinct *Enter the Gungeon*-Style Patterns per Boss (15 Total)**: Equip `spore_king`, `kryssa_ice_queen`, and `forge_titan` with 5 distinct attack patterns each (3 active from Phase 1, +1 unlocked in Phase 2, +1 signature Climax unlocked in Phase 3, plus upgraded burrow/clone/shockwave beats) using an anti-repeat solo selector.
- **Deterministic Variable-Speed & Multi-Shape Projectiles**: Support decelerating brake orbs (`decel`), read-then-surge walls (`accel`), pulsing waves (`pulse`), curving spirals (`spiral`), and alternating fast/slow concentric rings (`alternateSpeedScale`) across 6 distinct enemy bullet silhouettes (`orb`, `wave`, `lance`, `diamond`, `heavy_orb`, `ring_bolt`).
- **Clearer Solo Bullet-Curtain Dodging (Slower + Larger + Denser)**:
  - **Bosses**: Reduce base projectile speeds by ~18–25% (`125–210 px/s` effective), increase projectile radii (`6.8–9.5px`, vs old `5.5–6.0px`), and increase volley pellet density by +40–75% while preserving human-readable solo weaving lanes and recovery windows.
  - **Regular Enemies**: Reduce projectile speeds by ~15–20% across all Biomes 1–3 ranged enemies (`180–285 px/s` base, vs old `215–360 px/s`) and modestly bump tiny `5.0px` radii to `5.8–6.5px` where solo crossfire readability improves, keeping predictive sightlines synchronized.
- **Vivid, Emissive Enemy Bullets**: Upgrade baked enemy bullet textures with high-saturation neon-crimson/hot-coral/magenta rims + `#F4F1EA` white-hot cores + `#141019` ink outlines, pair every non-stress enemy projectile with a pooled `BlendMode.ADD` emissive halo sprite (`depth: 59`), and scale/rotate sprites accurately by `b.radius` and `b.angle`.
- **Solo Gameplay Drama Enhancements**:
  - **Bullet Graze ("Sượt Đạn")**: Reward tight solo dodging near enemy bullets with crisp cyan-gold graze sparks, subtle audio, and a capped micro-utility boost (`-0.25s` `skillCooldownTimer` and `-4` `weaponHeat` / `-0.06s` active `reloadTimer`).
  - **Signature Pattern Telegraph Cues & Phase 3 Climax**: Give Boss signature patterns distinct telegraph callout cues and guarantee a dramatic Phase 3 climax barrage once `<= 33%` HP is reached.

### Non-Goals
- Adding new Boss arena floor-tile hazards or changing dungeon room geometry (the user selected Option 1 over Option 2).
- Changing Boss HP pools (`5200 / 6800 / 9600`), 1-Step Armor Break mechanics, or network WebSocket frame formats.
- Rebalancing player weapon damage tables or blessing formulas.

### Anti-Goals (Failure Conditions Even If Code Compiles)
- **Unfair 1P Overlapping Traps**: Never allow a multi-tick Boss stream to continue firing while the Boss is `stunned` (during Armor Break punish windows), `bossBurrowed`, or in `bossPhaseTransitionTimer > 0`; never spawn zero-gap walls faster than a solo player (`moveSpeed ~ 190–220 px/s` + Dash) can read and cross.
- **Threat-Color Confusion**: Never tint enemy bullet bodies into cool player-only hues (pure cyan/green/blue without hot crimson/magenta/amber threat dominance) or drop `#141019` outline + `#F4F1EA` core contrast; player vs. enemy fire must remain instant-read in 50ms.
- **Co-op Desync or ID Collisions**: Never exceed `64` pellets in a single `spawnDeterministicVolley` call (due to `(((ev.eventId ?? 1) & 0x3fffff) << 6) | (i & 0x3f)` ID packing in `sim-projectiles.ts`), and never step projectile kinematics differently between `updateProjectilesImpl` and `stepClientProjectilesCosmeticImpl`.
- **Quantitative Balance Gate Regressions**: Never break the 30-seed simulation gates in `packages/shared/test/ap2-p3c-balance-targets.test.ts`.

---

## 3. Constraints & Existing Codebase Invariants

1. **1-Step Boss Armor Break Invariants (`ap2-p3b-boss1/2/3` test suites)**:
   - `spore_king`: At `<= 66%` and `<= 33%` MaxHP, `bossArmorShellActive` (`70%` DR) triggers supply drops (`moss_table`, `volatile_spore_pod`) and forces a charge telegraph (`telegraphLength = 340`) that shatters on `rotten_totem_pillar` or kicked props (`6%` MaxHP true dmg, `3.5s` stun, `+40%` vuln).
   - `kryssa_ice_queen`: At `<= 66%` and `<= 33%` MaxHP, `bossArmorShellActive` (`75%` DR) triggers supply drops (`glacial_barricade`, `sliding_ice_block`) and **must** prepare & fire `weaponId: 'kryssa_ice_beam'` (`>= 3` projectiles) toward the target player so a flipped `glacial_barricade` absorbs it (`cryoChargedByLaser = true`). `tryChargeGlacialBarricadeWithCryoLaser` checks `weaponId === 'kryssa_ice_beam' || weaponId === 'kryssa_frost_nova'`.
   - `forge_titan`: At `<= 66%` and `<= 33%` MaxHP, `bossArmorShellActive` (`75%` DR) triggers supply drops (`forge_blast_shield`, `coal_bomb` / `slag_crucible`), spawns `1–2` floor `coal_bomb`s (`fuseTimer = 3.5s`), spawns 2 `forge_energy_core`s on Phase 2 entry, and breaks via kicked props or `pneumatic_press` (`4.0s` stun, `+40%` vuln).
2. **Enemy Projectile Pool Cap (`world-sim-types.ts`)**:
   - Raise `MAX_ENEMY_PROJECTILES` from `160` to `300` so overlapping Boss rings/spirals (`60–140` active bullets) never silently evict live outer-ring bullets mid-flight.
3. **Client Visual Invariant Compatibility (`polish-p10b-fx-elemental-ambient.test.ts`, `topdown-shader-vfx-baker.test.ts`, `tests/e2e/polish-p10b.spec.ts`)**:
   - Keep `ENEMY_BULLET_VISUAL_SPEC` (`fill: PALETTE.CRIMSON_BRIGHT`, `core: PALETTE.BONE_WHITE`, `outlineColor: PALETTE.INK_DARK`, `outlineWidth: 1.5`, `depth: 60`, `neverTintByElement: true`, `coreRadius >= 2.4`) intact.
   - Default `resolveProjectileRenderSpec({ team: 'enemy', element, biome, isStress: false })` (when `bulletShape` is `'orb'` or omitted and `weaponId` has no non-orb shape override, such as `'enemy_fireball'`) continues returning `textureKey: 'proj_enemy_orb'`, `tint: 0xffffff`, `blendMode: 'NORMAL'`, `depth: 60`, `alpha: 1.0`.
   - Shaped enemy bullets also render their main body sprite at `depth: 60`, `blendMode: 'NORMAL'`, `tint: 0xffffff`, `alpha: 1.0`, while the new additive emissive glow lives on a pooled companion `glowSprite` at `depth: 59` (`BlendMode.ADD`).
4. **Legacy Boss Test Alignment (`balance-overhaul-b2.test.ts`)**:
   - Preserve `B2.1a` (Boss HP `5200 / 6800 / 9600`), `B2.1c` (add/core pickup drops), and `B2.1d` (`140px` phase-transition bullet clear + `life_seed` drop). Update `B2.1b` to assert true `360°` uniform spacing (`2π / count`) and alternating half-step offsets on the new denser radial patterns.
5. **30-Seed Balance Gate (`ap2-p3c-balance-targets.test.ts`)**:
   - Solo Boss winrates: B1 `80–95%`, B2 `70–90%`, B3 `60–85%`; 1P & 4P Boss kill times `60–120s` (delta `<= 20%`); zero one-shots (`maxSingleHitFraction < 0.85`); B1 solo combat room HP+Armor loss `25–50%`; B2 & B3 difficulty progression `+20%..+25%`.

---

## 4. Approaches Considered & User Selection

1. **Approach A (Selected by User — Solo-Focused Deterministic Volley Kinematics + Multi-Tick Boss Streamer + Pooled Additive Glow Halo)**:
   - Extend `BulletVolleySpawnEvent` and `SimProjectileState` with deterministic kinematic profiles (`constant`, `decel`, `accel`, `pulse`, `spiral`, plus per-volley `alternateSpeedScale` / `alternateRadiusScale`) stepped identically in `updateProjectilesImpl` and `stepClientProjectilesCosmeticImpl`.
   - Add a lightweight multi-tick Boss barrage streamer on `SimEnemyState` so Bosses execute sustained spirals, sweeping flame whips, delayed follow-up fans, and Phase 3 climaxes tuned specifically around **1P solo dodging rhythm, lane widths, and recovery windows**.
   - Bake 6 vivid enemy projectile textures (`proj_enemy_orb` upgraded + 5 new shapes) paired with a pooled `BlendMode.ADD` `glowSprite` (`depth: 59`), true radius scaling, directional rotation, and solo **Bullet Graze** feedback/rewards.
   - *Trade-off*: Touches both `@ashen-pact/shared` simulation and `@ashen-pact/client` rendering, in exchange for authentic *Enter the Gungeon* variable-speed bullet choreography, zero extra Co-op snapshot bandwidth, and 60 FPS performance on all quality tiers.
2. **Approach B (Rejected — Server-Driven Per-Bullet Redirect / Snapshot Sync)**:
   - Re-broadcasting per-bullet velocity changes or `snapshot.projectiles` at 80–180 active Boss bullets inflates Co-op bandwidth and introduces Wi-Fi jitter during tight dodges without helping solo play.
3. **Approach C (Rejected — Constant-Speed Multi-Wave Volleys + Post-FX Bloom Only)**:
   - Cannot produce mid-flight braking rings or slow-read -> fast-surge walls, and loses bullet glow whenever WebGL Post-FX bloom is disabled or below threshold.

---

## 5. Detailed Design

### 5.1 Deterministic Projectile Kinematics & Shapes (`packages/shared`)

**User-decided:** Bosses must shoot bullets with multiple shapes and variable speeds (fast/slow/accelerating/decelerating), with reduced base speed and increased size + density.  
**Builder calls (ours):** Exact data fields and mathematical stepping formulas so solo & Co-op stay 100% deterministic.

#### Data Types (`packages/shared/src/sim/world-sim-types.ts`)
- Raise `MAX_ENEMY_PROJECTILES = 300` (from `160`).
- Define:
  ```ts
  export type EnemyBulletShape =
    | 'orb'
    | 'wave'
    | 'lance'
    | 'diamond'
    | 'heavy_orb'
    | 'ring_bolt';

  export type ProjectileKinematicMode =
    | 'constant'
    | 'decel'
    | 'accel'
    | 'pulse'
    | 'spiral';
  ```
- Add optional fields to both `BulletVolleySpawnEvent` and `SimProjectileState`:
  - `bulletShape?: EnemyBulletShape`
  - `kinematicMode?: ProjectileKinematicMode` (defaults to `'constant'`)
  - `initialSpeed?: number` (resolved post-`BIOME_SCALING` spawn speed for each pellet)
  - `targetSpeed?: number` (scaled by the same `biomeScale.projectileSpeedMultiplier` at volley spawn when `ev.team === 'enemy'`)
  - `kinematicRate?: number` (rate parameter: exponential decay/growth rate `s⁻¹` for `decel`/`accel`, or oscillation frequency `rad/s` for `pulse`)
  - `kinematicDelaySec?: number` (countdown before `decel`/`accel` begins ramping; allows e.g. `0.35s` slow read before surging)
  - `kinematicElapsedSec?: number` (runtime accumulator on `SimProjectileState`, initialized to `0`)
  - `angularVelRad?: number` (continuous angular turn rate in `rad/s`, applied during flight)
- Add optional per-pellet alternation fields to `BulletVolleySpawnEvent`:
  - `alternateSpeedScale?: number` (if set, odd pellets `i % 2 === 1` spawn with `pelletSpeed = speed * alternateSpeedScale` and scaled `targetSpeed`)
  - `alternateRadiusScale?: number` (if set, odd pellets `i % 2 === 1` spawn with `pelletRadius = ev.radius * alternateRadiusScale`)
  - `alternateBulletShape?: EnemyBulletShape` (if set, odd pellets `i % 2 === 1` use `alternateBulletShape`, allowing e.g. alternating `heavy_orb` + `lance` in one `360°` volley)
  - `gapIndices?: number[]` (optional pellet indices skipped during loop in `spawnDeterministicVolleyImpl` so aimed arcs/walls can carve deterministic safe solo corridors cleanly while keeping `i` deterministic!)

#### Shared Step Function (`stepProjectileKinematics(b, dtSec)` in `sim-projectiles.ts`)
Called identically in **both** `updateProjectilesImpl` and `stepClientProjectilesCosmeticImpl` immediately before `b.x += b.vx * dtSec; b.y += b.vy * dtSec;` (skipped when `(b.awaitingServerRedirectTimer ?? 0) > 0` or `b.vx === 0 && b.vy === 0`):
1. Advance `b.kinematicElapsedSec = (b.kinematicElapsedSec ?? 0) + dtSec`.
2. Compute current heading `ang = Math.atan2(b.vy, b.vx)` and current scalar `curSpd = Math.hypot(b.vx, b.vy)`.
3. If `b.angularVelRad` is non-zero, rotate heading: `ang += b.angularVelRad * dtSec`. (Note: wall/prism bounces preserve `Math.atan2(b.vy, b.vx)` naturally because heading is derived from `vx, vy`!).
4. Compute new scalar `nextSpd = curSpd` based on `b.kinematicMode`:
   - `'decel'` / `'accel'`: If `b.kinematicElapsedSec > (b.kinematicDelaySec ?? 0)` and `b.targetSpeed !== undefined`:
     `const k = Math.min(1, (b.kinematicRate ?? 3.0) * dtSec); nextSpd = curSpd + (b.targetSpeed - curSpd) * k;`
   - `'pulse'`: Oscillates smoothly between `baseSpd = b.initialSpeed ?? curSpd` and `targetSpd = b.targetSpeed ?? baseSpd * 0.55`:
     `const mid = 0.5 * (baseSpd + targetSpd); const amp = 0.5 * (baseSpd - targetSpd); nextSpd = Math.max(40, mid + amp * Math.cos((b.kinematicElapsedSec ?? 0) * (b.kinematicRate ?? 7.5)));`
   - `'spiral'` / `'constant'`: `nextSpd = curSpd` (with `angularVelRad` curving `'spiral'`).
5. Write back `b.vx = Math.cos(ang) * nextSpd; b.vy = Math.sin(ang) * nextSpd; b.angle = ang;`.

---

### 5.2 Solo-First Boss Pattern Choreography & Multi-Tick Streamer

**User-decided:** Focus heavily on the single-player experience; rich *Enter the Gungeon*-like pattern variety; slower, larger, denser Boss bullets; extra gameplay drama.  
**Builder calls (ours):** Anti-repeat pattern deck, multi-tick barrage streamer that auto-cancels on stun/phase-change, solo gap geometry (`>= 68px` mid-range corridors), and 5 tailored patterns per Boss.

#### Boss Barrage State (`SimEnemyState` in `world-sim-types.ts`)
- `bossPatternId?: number` (active pattern index `0..4`)
- `bossLastPatternId?: number` (prevents back-to-back repeats)
- `bossClimaxFiredP3?: boolean` (ensures Pattern 4 — Phase 3 Climax — fires immediately on the first non-shell attack of Phase 3)
- `bossStreamTimer?: number` (remaining duration of an active multi-tick barrage)
- `bossStreamTickTimer?: number` (countdown to next sub-volley tick)
- `bossStreamStep?: number` (0-indexed tick counter within the stream)
- `bossStreamBaseAngle?: number` (locked initial player aim angle at stream start so solo players can out-strafe sweeping/corridor patterns fairly without aimbot tracking mid-stream!)

**Cancellation & Solo Fairness Rules:**
- Whenever `e.aiState === 'stunned' || (e.bossPhaseTransitionTimer ?? 0) > 0 || e.bossBurrowed || e.hp <= 0 || e.bossArmorShellActive`, `e.bossStreamTimer = 0` immediately. A solo player who earns an Armor Break stun gets a 100% clean punish window.
- Each `spawnDeterministicVolley` call stays `<= 32` pellets (well below the `64`-pellet ID limit).

#### Boss 1: `spore_king` — Mục Vương Nấm Độc (Biome 1, `×1.00` speed multiplier)
*Old state:* Only `boss_spore_ring` (`12/14/16` pellets @ `215/235 px/s`, `r=5.5`), burrow `thorn_burst` (`8` @ `225`, `r=5.5`), P3 `shaman_staff` (`3` @ `245`, `r=6`).  
*New 5-Pattern Arsenal (when `!bossArmorShellActive` and not executing scheduled charge/burrow):*

| ID | Phase | Pattern Name & Callout | Shapes & Radii | Speed / Kinematics (Effective B1) | Density & Solo Dodge Read |
|----|-------|------------------------|----------------|-----------------------------------|---------------------------|
| `0` | P1+ | **Vòng Bào Tử Đan Kép** (`boss_spore_ring`) | Even: `ring_bolt` (`r=7.8`), Odd: `orb` (`r=6.8`) | `172 px/s` & `124 px/s` (`alternateSpeedScale: 0.72`), constant, half-step cycle offset | `16 / 18 / 20` radial (`360°`). Splits into 2 staggered concentric rings with wide solo step-through pockets. |
| `1` | P1+ | **Lưỡi Liềm Độc & Nanh Gai** (`spore_crescent_wave`) | Center: `wave` (`r=9.2`); Flanks: `lance` (`r=6.8`) | Center `decel` `205 -> 138 px/s` (`3` overlapping crescents, `spread: 0.28`); Two side `4`-dart fans at `±0.62 rad` (`162 px/s`) | `11` total pellets. Punishes lazy standing while leaving two crisp `±0.32 rad` diagonal lanes open for solo footwork. |
| `2` | P1+ | **Xoắn Ốc Khuẩn Ty** (`spore_spiral_stream`) | `orb` (`r=7.2`) | Multi-tick stream (`0.72s`, `6` steps × `0.12s`), `spiral` `154 px/s`, `angularVelRad: ±0.32` (flips sign per step-pair) | `3` arms (P1) / `4` arms (P2–P3) = `18–24` bullets. Classic *Gungeon* rotating spiral you circle-strafe smoothly. |
| `3` | P2+ | **Bào Tử Phanh Nổ** (`spore_cluster_orb`) | Ring: `heavy_orb` (`r=9.2`); Follow-up: `diamond` (`r=6.8`) | `12` radial `heavy_orb`s with `decel` (`220 -> 92 px/s`, `rate: 3.4`), + `0.24s` delayed `5`-way aimed `diamond` fan (`175 px/s`) | `17` pellets. Heavy orbs brake into a glowing mid-ring perimeter while the solo player sidesteps the 5-way dart fan. |
| `4` | P3 (`<=33%`) | **Đại Dịch Nở Rộ (Climax)** (`spore_miasma_climax` — *"ĐẠI DỊCH BÀO TỬ!"*) | Wave A: `ring_bolt` (`r=8.0`); Stream: `wave` (`r=7.6`) | `18` radial `pulse` (`165 <-> 105 px/s`, `rate: 8.0`) + `4` stream ticks (`0.14s`) of `4`-way rotating `wave` crescents (`158 px/s`) | `34` bullets across `0.56s` with breathing rhythm waves. |
| *Burrow* | P2/P3 | **Trồi Đất Phun Gai** (`thorn_burst` on emerge) | `lance` (`r=7.2`) | `162 px/s` & `122 px/s` (`alternateSpeedScale: 0.75`) | `12` (P2) / `14` (P3) radial `360°` (up from `8` @ `225 px/s`). |

---

#### Boss 2: `kryssa_ice_queen` — Nữ Hoàng Băng Giá Kryssa (Biome 2, `×1.06` speed multiplier)
*Old state:* `kryssa_ice_beam` (`3/4/5` @ raw `250 -> 265`, `r=5.5`), odd cycles `kryssa_frost_nova` (`10/14` @ raw `250 -> 265`, `r=5.5`).  
*Armor Shell Invariant:* Whenever `e.bossArmorShellActive === true`, Kryssa **always** executes Pattern `0` (`kryssa_ice_beam`, `5` aimed spears, `bounceCount: 3`) so solo `glacial_barricade` charging (`ap2-p3b-boss2-kryssa.test.ts`) works 100% deterministically.

| ID | Phase | Pattern Name & Callout | Shapes & Radii | Speed / Kinematics (Raw -> Effective B2 `×1.06`) | Density & Solo Dodge Read |
|----|-------|------------------------|----------------|--------------------------------------------------|---------------------------|
| `0` | P1+ / Shell | **Giáo Băng Khúc Xạ** (`kryssa_ice_beam`) | `lance` (`r=7.0`) | Wave 1: `5/6/7` aimed spears @ raw `188` (`199 px/s`), `bounceCount: 3`; Wave 2 (when `!bossArmorShellActive`, `+0.18s`): `4/5` gap-filling spears @ raw `154` (`163 px/s`), `bounceCount: 1` | `9–12` refracting spears (vs old `3–5` @ `265 px/s`). Slower, larger crystal lances make pillar-refraction trajectories readable in 1P. |
| `1` | P1+ | **Tường Băng Gia Tốc** (`kryssa_glacier_wall` — *"TƯỜNG BĂNG!"*) | `diamond` (`r=7.6`) | `accel`: spawns slow @ raw `66` (`70 px/s`), holds `kinematicDelaySec: 0.36s`, then surges to raw `198` (`210 px/s`, `rate: 4.5`) | `15` (P1) / `17` (P2–P3) pellets across `120°` fan with **3 adjacent pellets omitted (`gapIndices`)** forming a glowing `~80px` safe solo doorway offset slightly left/right of player! |
| `2` | P1+ | **Tinh Thể Sương Nảy** (`kryssa_frost_nova`) | `diamond` (`r=7.4`) | Raw `162` (`172 px/s`) & `123` (`130 px/s`, `alternateSpeedScale: 0.76`), `bounceCount: 1`, half-step parity alternation | `14 / 16 / 18` radial `360°` (up from `10/14` @ `265 px/s`). |
| `3` | P2+ | **Xoáy Lăng Kính Đảo Chiều** (`kryssa_prism_vortex`) | `diamond` (`r=7.0`) | Multi-tick stream (`0.65s`, `5` steps × `0.13s`), dual counter-rotating `4`-arm `spiral` @ raw `146` (`155 px/s`, `angularVelRad: +0.40` & `-0.40`) | `40` crisp prism shards forming rhythmic diamond-lattice openings around Kryssa. |
| `4` | P3 (`<=33%`) | **Thánh Đường Độ Không Tuyệt Đối (Climax)** (`kryssa_blizzard_climax` — *"BÃO TUYẾT VĨNH CỬU!"*) | Ring: `heavy_orb` (`r=8.8`); Sweep: `wave` (`r=7.8`) | `16` radial `heavy_orb`s (`decel` raw `196 -> 104`, i.e. `208 -> 110 px/s`) + `3` staggered `5`-way aimed `wave` arcs (`0.16s` apart, raw `168` = `178 px/s`) | `31` multi-shape cryo projectiles with dramatic slow-ring + crescent contrast. |
| *Clone* | P2/P3 | **`kryssa_clone` Mirage Shot** | `lance` (`r=6.5`) | Raw `175` (`185 px/s`, down from `265 px/s`!) | `2` aimed shots (`spread: 0.22`) so solo players aren't cross-sniped at `265 px/s` while dodging Kryssa. |

---

#### Boss 3: `forge_titan` — Titan Lò Rèn (Biome 3, `×1.12` speed multiplier)
*Old state:* Even cycles emitted only a shockwave ring (`0` bullets in P1/P2!); odd cycles fired `titan_magma_barrage` (`8/10/12` @ raw `215 -> 241`, `r=6`) + P3 `titan_flame_sweep` (`8` @ raw `225 -> 252`, `r=6`).  
*New 5-Pattern Arsenal:*

| ID | Phase | Pattern Name & Callout | Shapes & Radii | Speed / Kinematics (Raw -> Effective B3 `×1.12`) | Density & Solo Dodge Read |
|----|-------|------------------------|----------------|--------------------------------------------------|---------------------------|
| `0` | P1+ (Jump Slam) | **Búa Địa Chấn & Xỉ Nóng Chảy** (`titan_anvil_ring` + `shockwaveRing`) | `heavy_orb` (`r=8.6`) + expanding `shockwaveRing` (`speed: 185`) | `decel` raw `172 -> 105` (`193 -> 118 px/s`, `rate: 2.8`) | `14 / 16 / 18` radial `360°` erupted on hammer impact alongside the shockwave ring—even cycles are now thrilling weave + dash beats! |
| `1` | P1+ | **Mưa Nhiệt Hạch Tương Phản** (`titan_magma_barrage`) | Even: `heavy_orb` (`r=9.2`); Odd: `lance` (`r=7.0`) | `16 / 18 / 20` radial with `alternateSpeedScale: 1.38`, `alternateRadiusScale: 0.76`, `alternateBulletShape: 'lance'` -> slow giant cores (raw `128` = `143 px/s`) + fast slag spears (`198 px/s`) | `16–20` radial (`360°`) + `3` aimed `wave` crescents (`r=8.2`, `178 px/s`). High-contrast 2-speed curtain. |
| `2` | P1+ | **Quạt Lửa Gatling Quét Ngang** (`titan_flame_sweep` — *"LỬA QUÉT LÒ RÈN!"*) | `wave` (`r=7.6`) | Multi-tick stream (`0.72s`, `6` steps × `0.12s`), sweeps locked angle `-0.85 rad -> +0.85 rad`, firing `3`-pellet tight cluster (`spread: 0.18`) per step @ raw `155` (`174 px/s`) | `18` sweeping flame crescents; solo player either outruns the sweep arc or Dashes cleanly *through* the whip once. |
| `3` | P2+ | **Bánh Răng Lò Luyện** (`titan_crucible_gear`) | `ring_bolt` (`r=7.6`) | Multi-tick stream (`0.65s`, `5` steps × `0.13s`), `8` radial spokes rotating `+0.16 rad` per step with slight `spiral` (`angularVelRad: 0.24`) @ raw `142` (`159 px/s`) | `40` bullets arranged in 8 clean rotating cog-lanes around Titan—very clear solo corridor rotation. |
| `4` | P3 (`<=33%`) | **Quá Tải Lõi Lò Rèn (Climax)** (`titan_meltdown_climax` — *"LÕI NHIỆT HẠCH QUÁ TẢI!"*) | Barrage: `heavy_orb` (`r=8.8`); Surge: `wave` (`r=7.8`) | `16` radial `titan_magma_barrage` (`157 px/s`) + half-step offset `12` radial `titan_flame_sweep` (`accel` raw `85 -> 182`, i.e. `95 -> 204 px/s`, `delay: 0.28s`) + `2` delayed `8`-spoke bursts | `44` multi-speed glowing forge projectiles for a true final-boss bullet-hell climax. |

*(Compatibility note for direct unit-test calls to `executeBossSporeKingAttack`, `executeBossKryssaAttack`, and `executeBossForgeTitanAttack`: when invoked directly with explicit `bossAttackCycle` in unit tests, deterministic cycle parity maps cleanly onto radial patterns so `360°` spacing and half-step alternation tests remain deterministic and verifiable.)*

---

### 5.3 Regular Enemy Projectile Speed & Size Tuning

**User-decided:** Slightly reduce regular enemy projectile speeds; adjust regular enemy bullet sizes at our discretion for the best gameplay feel.  
**Builder calls (ours):** ~16–21% speed reduction across all ranged enemies, slight radius bumps (`+0.5` to `+0.8px`) on tiny `r=5` darts for crisp visibility, fitting `bulletShape` per archetype, and 1:1 updates to predictive sightline speed arguments.

| Biome | Enemy (`defId`) | Old Base -> Eff. Speed (`px/s`) | New Base -> Eff. Speed (`px/s`) | Old -> New Radius (`px`) | Shape (`bulletShape`) | File & Sightline Sync |
|-------|-----------------|---------------------------------|---------------------------------|--------------------------|-----------------------|-----------------------|
| B1 (`×1.00`) | `goblin_shooter` | `360 -> 360` | **`285 -> 285`** (-21%) | `5.0 -> 5.8` | `'lance'` | `sim-enemies-tactical-ai.ts` (`GOBLIN_SHOOTER_ARROW_SPEED = 285`, sightline synced automatically) |
| B1 (`×1.00`) | `goblin_shaman` | `245 -> 245` | **`205 -> 205`** (-16%) | `6.0 -> 6.6` | `'orb'` | `sim-enemies-biome1.ts` (update sightline `245 -> 205`) |
| B1 (`×1.00`) | `thorn_turret` | `215 -> 215` | **`180 -> 180`** (-16%) | `5.0 -> 6.0` | `'ring_bolt'` | `sim-enemies-biome1.ts` |
| B2 (`×1.06`) | `frost_bat` | `285 -> 302` | **`235 -> 249`** (-18%) | `5.0 -> 5.8` | `'diamond'` | `sim-enemies-tactical-b23.ts` (`FROST_BAT_SONIC_DART_SPEED = 235`, sightline synced) |
| B2 (`×1.06`) | `ice_mage` (fan / shatter) | `265/280 -> 281/297` | **`220/232 -> 233/246`** (-17%) | `6.0 -> 6.6` | `'diamond'` / `'lance'` | `sim-enemies-tactical-b23.ts` (`ICE_MAGE_BOLT_SPEED = 220`, `ICE_MAGE_SHATTER_SPEAR_SPEED = 232`) |
| B2 (`×1.06`) | `ice_golem` | `250 -> 265` | **`208 -> 220`** (-17%) | `6.5 -> 7.2` | `'heavy_orb'` | `sim-enemies-biome2.ts` (update sightline `250 -> 208`) |
| B2 (`×1.06`) | `kryssa_clone` | `250 -> 265` | **`175 -> 185`** (-30%) | `5.5 -> 6.5` | `'lance'` | `sim-enemies-biome2.ts` (update sightline `250 -> 175`) |
| B3 (`×1.12`) | `fire_imp` | `290 -> 325` | **`235 -> 263`** (-19%) | `5.5 -> 6.2` | `'orb'` | `sim-enemies-tactical-b23.ts` (`FIRE_IMP_FIREBALL_SPEED = 235`, sightline synced) |
| B3 (`×1.12`) | `welder_drone` | `320 -> 358` | **`255 -> 286`** (-20%) | `5.5 -> 6.2` | `'lance'` | `sim-enemies-biome3.ts` |
| B3 (`×1.12`) | `iron_shielder` | `270 -> 302` | **`222 -> 249`** (-18%) | `6.0 -> 6.6` | `'heavy_orb'` | `sim-enemies-biome3.ts` (update sightline `270 -> 222`) |
| B3 (`×1.12`) | `dwarf_cannon` (stress direct shot) | `255 -> 286` | **`215 -> 241`** (-16%) | `7.5 -> 7.8` | `'heavy_orb'` | `sim-enemies-tactical-b23.ts` (`DWARF_CANNON_MORTAR_SPEED` stress fallback; lobbed mortar arc unchanged) |

---

### 5.4 Vivid, Emissive Multi-Shape Enemy Bullets (`apps/client`)

**User-decided:** Make enemy bullets stand out visually (brighter, fresher, glowing feel — details entrusted to us) with multiple bullet shapes.  
**Builder calls (ours):** Canvas-baked threat shapes with bright neon-coral/crimson/magenta gradients + `#141019` ink outlines + `#F4F1EA` white-hot cores, paired with a pooled `BlendMode.ADD` `glowSprite` at `depth: 59`, radius-proportional scaling, and directional rotation.

#### 1. Six Enemy Projectile Canvas Textures (`apps/client/src/art/texture-baker-fx.ts`)
Add 5 new keys to `BAKED_FX_TEXTURE_KEYS` alongside upgraded `proj_enemy_orb` + 1 dedicated soft glow ring `fx_enemy_bullet_glow`:
- **`proj_enemy_orb` (`28×28`, upgraded in-place)**: Soft outer neon-coral/crimson aura (`rgba(255, 77, 94, 0.52)`) -> `#141019` `1.5u` outline -> vibrant `#FF4757` / `#E84545` body with hot solar-orange inner corona (`#FF7B54`) -> thin `#6E1423` bullseye ring -> enlarged `#F4F1EA` (`ENEMY_BULLET_VISUAL_SPEC.core`) white-hot center (`coreRadius: 3.0 >= 2.4`). Keeps every `ENEMY_BULLET_VISUAL_SPEC` constant invariant intact.
- **`proj_enemy_wave` (`36×30`, `+X` directional crescent)**: Swept razor crescent arc (`#FF3B5C` hot crimson-rose -> `#FF9E44` solar flare rim, `#141019` outline, wide `#F4F1EA` glowing leading spine). Rotates along `b.angle`.
- **`proj_enemy_lance` (`32×18`, `+X` directional spearhead)**: Elongated needle-spear (`#FF4D6D` neon crimson -> `#FF758F` highlight, `#141019` outline, long `#F4F1EA` diamond needle core). Distinct wider flared barbs vs. sleek cyan/elemental player bolts. Rotates along `b.angle`.
- **`proj_enemy_diamond` (`28×24`, `+X` faceted prism shard)**: 4-point sharp crystal rhombus (`#FF2E63` hot ruby-magenta -> `#FF85A1` facet edge, `#141019` outline, crisp `#F4F1EA` inner rhomb). Rotates along `b.angle`.
- **`proj_enemy_heavy_orb` (`34×34`, symmetric heavy core)**: Large pulsing magma/bio sphere (`#FF3838` outer -> `#FF9F1C` bright amber-orange inner ring -> `#141019` outline -> `#F4F1EA` blazing star-core). Subtle continuous spin/pulse in flight.
- **`proj_enemy_ring_bolt` (`30×30`, symmetric torus/chakram)**: Glowing spiked energy torus (`#FF477E` vibrant magenta-crimson ring + 4 micro-fins, `#141019` outline, `#F4F1EA` bright core ring). Spins smoothly (`sim.tick`) in flight.
- **`fx_enemy_bullet_glow` (`48×48`, radial emissive halo)**: High-chroma radial gradient (`rgba(255, 92, 108, 0.95)` center -> `rgba(255, 56, 88, 0.42)` mid -> `rgba(255, 30, 70, 0)` edge) rendered on pooled `glowSprite` with `BlendMode.ADD` at `depth: 59`.

#### 2. Render Spec & Sprite Sync (`combat-fx-spawners.ts` & `entity-sync.ts`)
- Extend `resolveProjectileRenderSpec` input object with optional `bulletShape?: EnemyBulletShape` and `radius?: number`:
  - When `team === 'enemy'` and `!isStress`:
    - `bulletShape === 'wave'` -> `'proj_enemy_wave'`
    - `bulletShape === 'lance'` -> `'proj_enemy_lance'`
    - `bulletShape === 'diamond'` -> `'proj_enemy_diamond'`
    - `bulletShape === 'heavy_orb'` -> `'proj_enemy_heavy_orb'`
    - `bulletShape === 'ring_bolt'` -> `'proj_enemy_ring_bolt'`
    - `'orb'` or `undefined` -> `'proj_enemy_orb'` (preserving all existing unit & E2E tests!).
    - All return `{ textureKey, texture: textureKey, tint: 0xffffff, blendMode: 'NORMAL', depth: 60, alpha: 1.0, scale }` where `scale` scales proportionally when `radius` is provided (`clamp(radius / 6.0, 0.85, 1.65)`, defaulting to `1.0` when `radius` is omitted!).
- In `syncProjectilesAndPickupsImpl` (`entity-sync.ts`):
  - Extend `ProjectileSpriteEntry` with `glowSprite?: Phaser.GameObjects.Image` (pooled via `enemyBulletGlowPool: Phaser.GameObjects.Image[]` on `GameScene`, hidden & returned to pool when projectile despawns or when `isStress` is active).
  - Position `glowSprite` at `(rx, ry)`, `depth: 59`, `BlendMode.ADD`, `alpha: 0.58 + 0.12 * Math.sin(this.time.now * 0.014 + b.id)` (subtle living emissive pulse!), scaled to `spriteScale * 1.35`!
  - Apply `entry.sprite.setScale(spec.scale)` and set rotation:
    - Directional shapes (`'wave'`, `'lance'`, `'diamond'`): `b.angle`
    - `'ring_bolt'`: `(this.time.now * 0.006 + (b.id & 7)) % (Math.PI * 2)`
    - `'orb'` / `'heavy_orb'`: `0`

---

### 5.5 Solo Drama Enhancements: Bullet Graze ("Sượt Đạn") & Boss Signature Callouts

**User-decided:** Option 1 — add complementary gameplay/drama features to make Boss fights and solo gameplay more exciting and dramatic.  
**Builder calls (ours):**

1. **Bullet Graze ("Sượt Đạn") Mechanic (`packages/shared` + `apps/client`)**:
   - **Detection (`sim-projectiles.ts` enemy projectile loop)**:
     - When an enemy projectile `b` checks alive player `pl` and does **not** collide (`dist > b.radius + pl.radius`), check if `pl.lifeState === 'alive'`, `!b.hitEntityIds.includes(pl.id)`, and `!b.grazedPlayerIds?.includes(pl.id)` within `dist <= b.radius + pl.radius + GRAZE_MARGIN_PX` (`GRAZE_MARGIN_PX = 18`). Allowing graze both on tight footwork and during Dashes rewards bold *Gungeon*-style curtain weaving.
     - Record `pl.id` in `b.grazedPlayerIds` (reset to `[]` when `b` returns to `projectilePool`) so each bullet can only be grazed **once** per player.
   - **Solo-Tuned Micro-Reward (Builder Call — Boss-Weighted Tiering + ICD)**:
     - Add `grazeIcdTimer?: number` on `SimPlayerState` (`GRAZE_REWARD_ICD_SEC = 0.16`, max ~6 reward procs/sec).
     - When `grazeIcdTimer <= 0`:
       - Set `pl.grazeIcdTimer = 0.16` and emit `{ kind: 'bullet_grazed', playerId: pl.id, x: (pl.x + b.x) * 0.5, y: (pl.y + b.y) * 0.5 }` (suppressed when `stressTestActive` is true) in **all** rooms for tactile dodging juice.
       - Apply full combat refunds during active Boss encounters (`this.getActiveBoss() !== undefined`): shave `0.25s` off `pl.skillCooldownTimer`, vent `4` `pl.weaponHeat` (or shave `0.05s` off active `pl.reloadTimer`). Outside Boss encounters, apply a lighter micro-refund (`-0.08s` `skillCooldownTimer`, `-1.5` `weaponHeat`) so normal combat room clear times and Biome 1 attrition stay balanced.
   - **Client Juice (`sim-events.ts`)**:
     - On `bullet_grazed`: spawn crisp golden-cyan electric sparks (`fx_spark`, `4` motes) at the graze midpoint, play a light high-pitch synth tick, and show a subtle micro floating tag (`SƯỢT!`) throttled to at most once every `0.9s` so the screen stays crystal clear.
2. **Boss Signature Telegraph Callouts & Phase 3 Climax Beat**:
   - When a Boss initiates its signature windup (`kryssa_glacier_wall`, `titan_flame_sweep`) or enters its **Phase 3 Climax** (`spore_miasma_climax`, `kryssa_blizzard_climax`, `titan_meltdown_climax`), emit an `enemy_telegraph` + set `e.lastCombatText` / floating alert with the localized Vietnamese callout (e.g., `"TƯỜNG BĂNG!"`, `"LỬA QUÉT LÒ RÈN!"`, `"ĐẠI DỊCH BÀO TỬ!"`, `"BÃO TUYẾT VĨNH CỬU!"`, `"LÕI NHIỆT HẠCH QUÁ TẢI!"`) accompanied by a transient radial light pulse so the solo player feels every dramatic escalation beat.

---

## 6. What Is Left to the Builder

- **Empirical 30-Seed Balance Calibration (`ap2-p3c-balance-targets.test.ts`)**:
  - Tune Boss telegraph windups (`0.38s–0.55s`), Boss post-attack recovery windows (`1.15s–1.65s`), and—if slowing regular enemy projectiles shifts Biome 1 room HP+Armor loss (`25–50%`, currently `25.0%` baseline), room clear duration (`>= 35s`), or Biome 2/3 difficulty progression (`+20%..+25%`)—fine-tune regular-enemy `attackCooldownSec` in `packages/shared/src/data/enemies.ts`, exact regular-enemy speed/radius deltas (within `-12%..-21%` speed and `+0.6..+1.4px` radius), and/or `BIOME_SCALING` so every quantitative 30-seed gate passes cleanly while preserving the slower, more readable bullet feel.
- Exact 2D canvas bezier/polygon vertex coordinates for the 5 new enemy projectile textures in `apps/client/src/art/texture-baker-fx.ts` and `zzfx` parameter curve for the subtle graze tick.
- Clean helper modularization if any Boss file approaches lint/size thresholds (e.g. extracting shared Boss projectile pattern helpers into a dedicated `sim-boss-patterns.ts` module imported by `sim-enemies-biome1/2/3.ts`).

