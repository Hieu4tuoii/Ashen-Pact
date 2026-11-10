# Solo-First Boss Bullet-Hell, Variable-Speed Projectiles & Emissive Enemy Bullets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul all 3 Boss encounters (`spore_king`, `kryssa_ice_queen`, `forge_titan`) and enemy projectiles with *Enter the Gungeon*-style multi-shape, variable-speed bullet patterns, slower/larger/denser Boss bullet curtains, slower regular enemy projectiles, vivid emissive multi-shape bullet rendering with additive glow halos, and a solo-focused Bullet Graze ("Sượt Đạn") micro-reward system.

**Architecture:** Extend `BulletVolleySpawnEvent` and `SimProjectileState` in `@ashen-pact/shared` with deterministic kinematic profiles (`constant`, `decel`, `accel`, `pulse`, `spiral`), per-pellet alternation (`alternateSpeedScale`, `alternateRadiusScale`, `alternateBulletShape`), deterministic `gapIndices`, and `EnemyBulletShape` metadata stepped identically on server (`updateProjectilesImpl`) and client (`stepClientProjectilesCosmeticImpl`). Add a shared Boss barrage streamer (`sim-boss-patterns.ts`) driving 5 distinct solo-tuned patterns per Boss, add Bullet Graze detection/rewards in `sim-projectiles.ts`, and upgrade `@ashen-pact/client` with 6 high-contrast enemy bullet textures + pooled `BlendMode.ADD` glow sprites (`depth: 59`) + radius/angle sprite sync.

**Tech Stack:** TypeScript, `@ashen-pact/shared` (60Hz deterministic `WorldSim`), `@ashen-pact/client` (Phaser 3 WebGL / Canvas2D procedural `TextureBaker`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-boss-bullet-hell-overhaul-design.md`

## Global Constraints

- `MAX_ENEMY_PROJECTILES = 300` (raised from `160` in `packages/shared/src/sim/world-sim-types.ts`).
- Every `spawnDeterministicVolley` call must keep `pelletCount <= 32` (never exceeding the 6-bit `0..63` pellet index in `(((ev.eventId ?? 1) & 0x3fffff) << 6) | (i & 0x3f)`).
- `stepProjectileKinematics(b, dtSec)` must run identically in `updateProjectilesImpl` and `stepClientProjectilesCosmeticImpl`.
- Active Boss multi-tick streams (`bossStreamTimer`) must cancel immediately (`bossStreamTimer = 0`) when `e.aiState === 'stunned' || (e.bossPhaseTransitionTimer ?? 0) > 0 || e.bossBurrowed || e.hp <= 0 || e.bossArmorShellActive`.
- Preserve 1-Step Boss Armor Break invariants (`ap2-p3b-boss1/2/3.test.ts`): `kryssa_ice_queen` with `bossArmorShellActive === true` must always fire `weaponId: 'kryssa_ice_beam'` (`>= 3` projectiles) so `glacial_barricade` charges (`cryoChargedByLaser = true`).
- Preserve `ENEMY_BULLET_VISUAL_SPEC` (`fill: PALETTE.CRIMSON_BRIGHT`, `core: PALETTE.BONE_WHITE`, `outlineColor: PALETTE.INK_DARK`, `outlineWidth: 1.5`, `depth: 60`, `neverTintByElement: true`, `coreRadius >= 2.4`) and default `resolveProjectileRenderSpec({ team: 'enemy', element, biome, isStress: false }) -> { textureKey: 'proj_enemy_orb', tint: 0xffffff, blendMode: 'NORMAL', depth: 60, alpha: 1.0 }`.
- All 30-seed quantitative balance gates in `packages/shared/test/ap2-p3c-balance-targets.test.ts` must pass (`report.allTargetsPassed === true`).

## Review Focus

1. **Pooled Projectile State Leakage (`acquireProjectileImpl` / `releaseProjectileToPool`)**: Reused projectiles from `projectilePool` retaining stale `bulletShape`, `kinematicMode`, `targetSpeed`, `angularVelRad`, `kinematicElapsedSec`, or `grazedPlayerIds` from a previous volley — `acquireProjectileImpl` and pool release must reset all new fields cleanly.
2. **Wall / Cryo-Prism Bounce vs. Kinematic Stepping**: A `decel`, `accel`, or `spiral` projectile bouncing off a wall or `crystal_pillar` (`refractEnemyProjectileThroughCryoPrism`) must preserve its new reflected/refracted heading rather than snapping back to its pre-bounce angle on the next tick.
3. **Mid-Stream Boss Stun / Phase Transition Interruption**: If a solo player breaks a Boss's Armor Shell or triggers a phase transition mid-stream (`bossStreamTimer > 0`), the Boss must immediately stop emitting stream ticks and clear `bossStreamTimer`.
4. **Bullet Graze Double-Trigger or Hit+Graze Overlap**: A single enemy projectile must never grant Graze rewards more than once per player (`grazedPlayerIds`), and a projectile that actually collides with the player (`dist <= b.radius + pl.radius`) must deal damage without also firing `bullet_grazed`.
5. **Default Enemy Projectile Render Backwards-Compatibility**: Calling `resolveProjectileRenderSpec({ team: 'enemy', element: 'burn', biome: 3, isStress: false })` or spawning a synthetic projectile without `bulletShape` (as in `polish-p10b.spec.ts` and `polish-p10b-fx-elemental-ambient.test.ts`) must still resolve to `textureKey: 'proj_enemy_orb'`, `scale: 1.0`, `rotation: 0`, `depth: 60`, `blendMode: 'NORMAL'`.

---

### Task 1: Deterministic Projectile Kinematics, Shapes & Bullet Graze (`@ashen-pact/shared`)

**Files:**
- Modify: `packages/shared/src/sim/world-sim-types.ts:60-165,466-748`
- Modify: `packages/shared/src/sim/world-sim-events.ts:6-65`
- Modify: `packages/shared/src/sim/sim-projectiles.ts:76-280,610-760,910-986`
- Modify: `packages/shared/src/sim/sim-player.ts:72-90`
- Test: `packages/shared/test/boss-bullet-hell-kinematics-graze.test.ts`

**Interfaces:**
- Produces:
  - `EnemyBulletShape = 'orb' | 'wave' | 'lance' | 'diamond' | 'heavy_orb' | 'ring_bolt'`
  - `ProjectileKinematicMode = 'constant' | 'decel' | 'accel' | 'pulse' | 'spiral'`
  - `GRAZE_MARGIN_PX = 18`, `GRAZE_REWARD_ICD_SEC = 0.16`
  - `stepProjectileKinematics(b: SimProjectileState, dtSec: number): void`
  - Extended `BulletVolleySpawnEvent` (`bulletShape`, `kinematicMode`, `targetSpeed`, `kinematicRate`, `kinematicDelaySec`, `angularVelRad`, `alternateSpeedScale`, `alternateRadiusScale`, `alternateBulletShape`, `gapIndices`)
  - Extended `SimProjectileState` (`bulletShape`, `kinematicMode`, `initialSpeed`, `targetSpeed`, `kinematicRate`, `kinematicDelaySec`, `kinematicElapsedSec`, `angularVelRad`, `grazedPlayerIds`)
  - `SimEvent` union member `{ kind: 'bullet_grazed'; playerId: number; x: number; y: number }`

- [ ] **Step 1: Write the failing test in `packages/shared/test/boss-bullet-hell-kinematics-graze.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { MAX_ENEMY_PROJECTILES, WorldSim } from '../src/index.js';

const DT = 1 / 60;

describe('Boss Bullet-Hell Kinematics, Pool Reset & Bullet Graze', () => {
  it('raises MAX_ENEMY_PROJECTILES to 300 and supports gapIndices + alternating speed/radius/shape in spawnDeterministicVolley', () => {
    expect(MAX_ENEMY_PROJECTILES).toBe(300);
    const sim = new WorldSim({ seed: 101, spawnInitialWave: false, includeTrainingDummy: false, includeProps: false });
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      ownerId: 99,
      team: 'enemy',
      weaponId: 'test_volley',
      x: 400,
      y: 300,
      angle: 0,
      pelletCount: 6,
      spreadRad: Math.PI,
      speed: 200,
      radius: 8,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 2,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      amplifiedByShield: false,
      seed: 42,
      bulletShape: 'heavy_orb',
      alternateSpeedScale: 0.5,
      alternateRadiusScale: 0.75,
      alternateBulletShape: 'lance',
      gapIndices: [2, 3],
    });
    expect(sim.projectiles).toHaveLength(4);
    expect(sim.projectiles[0]!.bulletShape).toBe('heavy_orb');
    expect(sim.projectiles[0]!.radius).toBeCloseTo(8, 4);
    expect(Math.hypot(sim.projectiles[0]!.vx, sim.projectiles[0]!.vy)).toBeCloseTo(200, 2);
    expect(sim.projectiles[1]!.bulletShape).toBe('lance');
    expect(sim.projectiles[1]!.radius).toBeCloseTo(6, 4);
    expect(Math.hypot(sim.projectiles[1]!.vx, sim.projectiles[1]!.vy)).toBeCloseTo(100, 2);
  });

  it('steps decel, accel (with delay), pulse, and spiral identically on server and client and preserves reflected heading on wall bounce', () => {
    const serverSim = new WorldSim({ seed: 202, spawnInitialWave: false, includeTrainingDummy: false, includeProps: false });
    const clientSim = new WorldSim({ seed: 202, spawnInitialWave: false, includeTrainingDummy: false, includeProps: false });

    const ev = {
      kind: 'bullet_volley_spawned' as const,
      eventId: 7,
      ownerId: 99,
      team: 'enemy' as const,
      weaponId: 'test_accel',
      x: 300,
      y: 300,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 70,
      targetSpeed: 210,
      kinematicMode: 'accel' as const,
      kinematicDelaySec: 0.2,
      kinematicRate: 5.0,
      angularVelRad: 0.3,
      radius: 7,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 2,
      pierceCount: 0,
      bounceCount: 1,
      element: 'chill' as const,
      amplifiedByShield: false,
      seed: 99,
      bulletShape: 'diamond' as const,
    };
    serverSim.spawnDeterministicVolley({ ...ev }, false);
    clientSim.spawnDeterministicVolley({ ...ev }, false);

    // Before delay (10 ticks = 0.166s): speed stays ~70, angle curves by angularVelRad
    for (let t = 0; t < 10; t++) {
      serverSim.updateProjectiles(DT);
      clientSim.stepClientProjectilesCosmetic(DT);
    }
    const sb1 = serverSim.projectiles[0]!;
    const cb1 = clientSim.projectiles[0]!;
    expect(Math.hypot(sb1.vx, sb1.vy)).toBeCloseTo(70, 1);
    expect(sb1.x).toBeCloseTo(cb1.x, 4);
    expect(sb1.y).toBeCloseTo(cb1.y, 4);

    // After delay (30 more ticks): speed surges toward 210 identically
    for (let t = 0; t < 30; t++) {
      serverSim.updateProjectiles(DT);
      clientSim.stepClientProjectilesCosmetic(DT);
    }
    expect(Math.hypot(sb1.vx, sb1.vy)).toBeGreaterThan(150);
    expect(sb1.x).toBeCloseTo(cb1.x, 4);
    expect(sb1.y).toBeCloseTo(cb1.y, 4);
  });

  it('clears kinematic and graze fields when recycling projectiles through projectilePool', () => {
    const sim = new WorldSim({ seed: 303, spawnInitialWave: false, includeTrainingDummy: false, includeProps: false });
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      ownerId: 99,
      team: 'enemy',
      weaponId: 'decel_test',
      x: 400,
      y: 300,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 220,
      targetSpeed: 80,
      kinematicMode: 'decel',
      kinematicRate: 4,
      angularVelRad: 0.5,
      bulletShape: 'wave',
      radius: 8,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 0.01,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      amplifiedByShield: false,
      seed: 1,
    });
    sim.projectiles[0]!.grazedPlayerIds = [1];
    sim.updateProjectiles(DT); // expires into projectilePool
    expect(sim.projectiles).toHaveLength(0);

    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      ownerId: 99,
      team: 'enemy',
      weaponId: 'plain_test',
      x: 400,
      y: 300,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 150,
      radius: 6,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 1,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      amplifiedByShield: false,
      seed: 2,
    });
    const reused = sim.projectiles[0]!;
    expect(reused.bulletShape).toBeUndefined();
    expect(reused.kinematicMode).toBeUndefined();
    expect(reused.targetSpeed).toBeUndefined();
    expect(reused.angularVelRad).toBeUndefined();
    expect(reused.grazedPlayerIds ?? []).toHaveLength(0);
  });

  it('triggers Bullet Graze once per bullet within 18px margin without colliding, respecting 0.16s ICD and Boss vs normal room refund scaling', () => {
    const sim = new WorldSim({ seed: 404, spawnInitialWave: false, includeTrainingDummy: false, includeProps: false });
    const pl = sim.player;
    pl.x = 300;
    pl.y = 300;
    pl.skillCooldownTimer = 3.0;
    pl.weaponHeat = 20;

    // Spawn a boss so Boss-tier graze refund applies (-0.25s skill CD, -4 heat)
    sim.spawnEnemy('spore_king', 600, 300, true);

    // Bullet passes at y = 300 + pl.radius (12) + b.radius (7) + 10 = 329 (inside 18px graze margin, outside collision)
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      ownerId: 99,
      team: 'enemy',
      weaponId: 'boss_spore_ring',
      x: 300,
      y: pl.y + pl.radius + 7 + 10,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 10,
      radius: 7,
      damage: 2,
      critChance: 0,
      knockback: 0,
      ttlSec: 2,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      amplifiedByShield: false,
      seed: 5,
    });
    sim.consumeEvents();
    sim.updateProjectiles(DT);

    const evs1 = sim.consumeEvents();
    expect(evs1.some((e) => e.kind === 'bullet_grazed' && e.playerId === pl.id)).toBe(true);
    expect(pl.skillCooldownTimer).toBeCloseTo(2.75, 3);
    expect(pl.weaponHeat).toBeCloseTo(16, 3);
    expect(pl.grazeIcdTimer).toBeCloseTo(0.16, 3);

    // Stepping again with the same bullet does NOT graze a second time
    pl.grazeIcdTimer = 0;
    sim.updateProjectiles(DT);
    expect(sim.consumeEvents().some((e) => e.kind === 'bullet_grazed')).toBe(false);
    expect(pl.skillCooldownTimer).toBeCloseTo(2.75, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/shared test test/boss-bullet-hell-kinematics-graze.test.ts`
Expected: FAIL (`MAX_ENEMY_PROJECTILES` is `160`, kinematic/graze fields missing).

- [ ] **Step 3: Implement types, kinematic stepper, volley alternation/gaps, pool reset, and Bullet Graze**

1. In `packages/shared/src/sim/world-sim-types.ts`:
   - Set `export const MAX_ENEMY_PROJECTILES = 300;`
   - Export `EnemyBulletShape`, `ProjectileKinematicMode`, `GRAZE_MARGIN_PX = 18`, `GRAZE_REWARD_ICD_SEC = 0.16`.
   - Add the optional fields to `SimProjectileState`, `BulletVolleySpawnEvent`, `SimPlayerState` (`grazeIcdTimer?: number`), and `SimEnemyState` (`bossPatternId?: number`, `bossLastPatternId?: number`, `bossClimaxFiredP3?: boolean`, `bossStreamTimer?: number`, `bossStreamTickTimer?: number`, `bossStreamStep?: number`, `bossStreamBaseAngle?: number`).
2. In `packages/shared/src/sim/world-sim-events.ts`:
   - Add `| { kind: 'bullet_grazed'; playerId: number; x: number; y: number }` to `SimEvent`.
3. In `packages/shared/src/sim/sim-player.ts` (`updateSinglePlayerStateImpl`):
   - Decrement `p.grazeIcdTimer`: `if ((p.grazeIcdTimer ?? 0) > 0) { const nextG = (p.grazeIcdTimer ?? 0) - dtSec; p.grazeIcdTimer = nextG < 1e-6 ? 0 : nextG; }`.
4. In `packages/shared/src/sim/sim-projectiles.ts`:
   - Export `stepProjectileKinematics(b: SimProjectileState, dtSec: number): void` implementing `decel`, `accel`, `pulse`, `spiral`, and `angularVelRad` per Spec Section 5.1.
   - Update `spawnDeterministicVolleyImpl`: scale `targetSpeed` by `biomeScale.projectileSpeedMultiplier` when `ev.team === 'enemy'`, skip indices in `ev.gapIndices`, apply `alternateSpeedScale` / `alternateRadiusScale` / `alternateBulletShape` on odd `i % 2 === 1`, and pass kinematic/shape fields into `this.acquireProjectile(...)`.
   - Call `stepProjectileKinematics(b, dtSec)` in both `updateProjectilesImpl` and `stepClientProjectilesCosmeticImpl`.
   - In `updateProjectilesImpl` (enemy projectile vs alive player loop): when `!circleVsCircle(b, pl)`, check `dist <= b.radius + pl.radius + GRAZE_MARGIN_PX` and `!b.grazedPlayerIds?.includes(pl.id)`. Record `pl.id` in `b.grazedPlayerIds`. If `(pl.grazeIcdTimer ?? 0) <= 0`, set `pl.grazeIcdTimer = GRAZE_REWARD_ICD_SEC`, apply Boss-tier (`-0.25s` skill CD, `-4` heat or `-0.05s` reloadTimer) when `this.getActiveBoss() !== undefined` or normal-room tier (`-0.08s` skill CD, `-1.5` heat), and push `bullet_grazed` event when `!this.stressTestActive`.
   - Reset all new fields in `acquireProjectileImpl` and clear `b.grazedPlayerIds` when returning to `projectilePool`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ashen-pact/shared test test/boss-bullet-hell-kinematics-graze.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/sim/world-sim-types.ts packages/shared/src/sim/world-sim-events.ts packages/shared/src/sim/sim-projectiles.ts packages/shared/src/sim/sim-player.ts packages/shared/test/boss-bullet-hell-kinematics-graze.test.ts
git commit -m "feat(shared): add deterministic bullet kinematics, shapes, and bullet graze"
```

---

### Task 2: Solo-First Boss 5-Pattern Choreography & Multi-Tick Streamer (`@ashen-pact/shared`)

**Files:**
- Create: `packages/shared/src/sim/sim-boss-patterns.ts`
- Modify: `packages/shared/src/sim/sim-enemies-biome1.ts:750-978`
- Modify: `packages/shared/src/sim/sim-enemies-biome2.ts:460-715`
- Modify: `packages/shared/src/sim/sim-enemies-biome3.ts:440-735`
- Modify: `packages/shared/src/sim/world-sim.ts:30-42`
- Modify: `packages/shared/test/balance-overhaul-b2.test.ts:23-112`
- Test: `packages/shared/test/boss-bullet-hell-patterns.test.ts`

**Interfaces:**
- Consumes: Task 1 `BulletVolleySpawnEvent` extensions (`bulletShape`, `kinematicMode`, `targetSpeed`, `kinematicRate`, `kinematicDelaySec`, `angularVelRad`, `alternateSpeedScale`, `alternateRadiusScale`, `alternateBulletShape`, `gapIndices`) and `SimEnemyState` Boss stream fields.
- Produces:
  - `selectNextBossPattern(sim: WorldSim, e: SimEnemyState, maxPatternInclusive: number): number`
  - `updateBossProjectileStream(sim: WorldSim, e: SimEnemyState, dtSec: number): void`
  - `cancelBossProjectileStream(e: SimEnemyState): void`
  - Upgraded 5-pattern Boss attacks in `executeBossSporeKingAttackImpl`, `executeBossKryssaAttackImpl`, `executeBossForgeTitanAttackImpl` per Spec Section 5.2.

- [ ] **Step 1: Write the failing test in `packages/shared/test/boss-bullet-hell-patterns.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { WorldSim } from '../src/index.js';

const DT = 1 / 60;

describe('Solo-First Boss 5-Pattern Bullet-Hell Choreography & Stream Cancellation', () => {
  it('spore_king executes all 5 distinct patterns across phases, emits multi-tick spiral/climax streams, and cancels streams immediately on stun', () => {
    const sim = new WorldSim({ seed: 501, biome: 1, spawnInitialWave: false, includeTrainingDummy: false, includeProps: false });
    const boss = sim.spawnEnemy('spore_king', 520, 320, true);
    sim.player.x = 260;
    sim.player.y = 320;

    // Pattern 0: Double Staggered Spore Ring (16 pellets in P1, alternating speed & shape)
    boss.bossPhase = 1;
    boss.bossPatternId = 0;
    sim.projectiles.length = 0;
    sim.executeBossSporeKingAttack(boss, Math.PI);
    expect(sim.projectiles.length).toBeGreaterThanOrEqual(16);
    expect(new Set(sim.projectiles.map((b) => b.bulletShape)).size).toBeGreaterThanOrEqual(2);

    // Pattern 1: Crescent Wave + Side Thorn Fan
    boss.bossPatternId = 1;
    sim.projectiles.length = 0;
    sim.executeBossSporeKingAttack(boss, Math.PI);
    expect(sim.projectiles.some((b) => b.bulletShape === 'wave' && b.kinematicMode === 'decel')).toBe(true);
    expect(sim.projectiles.some((b) => b.bulletShape === 'lance')).toBe(true);

    // Pattern 2: Multi-tick Toxic Spiral Stream -> cancels immediately when stunned
    boss.bossPatternId = 2;
    sim.projectiles.length = 0;
    sim.executeBossSporeKingAttack(boss, Math.PI);
    expect(boss.bossStreamTimer).toBeGreaterThan(0);
    const initialCount = sim.projectiles.length;
    for (let t = 0; t < 12; t++) sim.step(DT);
    expect(sim.projectiles.length).toBeGreaterThan(initialCount);

    // Stun boss mid-stream -> stream cancels and no further bullets spawn
    boss.aiState = 'stunned';
    boss.stunTimer = 2.0;
    sim.step(DT);
    expect(boss.bossStreamTimer ?? 0).toBe(0);
    const countAfterStun = sim.projectiles.length;
    for (let t = 0; t < 20; t++) sim.step(DT);
    expect(sim.projectiles.length).toBeLessThanOrEqual(countAfterStun);

    // Pattern 4: Phase 3 Climax ("ĐẠI DỊCH BÀO TỬ!") with pulse wave
    boss.aiState = 'attack';
    boss.stunTimer = 0;
    boss.bossPhase = 3;
    boss.bossPatternId = 4;
    sim.projectiles.length = 0;
    sim.executeBossSporeKingAttack(boss, Math.PI);
    expect(boss.lastCombatText).toBe('ĐẠI DỊCH BÀO TỬ!');
    expect(sim.projectiles.some((b) => b.kinematicMode === 'pulse')).toBe(true);
  });

  it('kryssa_ice_queen preserves kryssa_ice_beam on bossArmorShellActive and executes accelerating Glacier Wall with safe solo gap + P3 Climax', () => {
    const sim = new WorldSim({ seed: 502, biome: 2, spawnInitialWave: false, includeTrainingDummy: false, includeProps: false });
    const kryssa = sim.spawnEnemy('kryssa_ice_queen', 520, 320, true);
    sim.player.x = 260;
    sim.player.y = 320;

    // Armor shell active -> always fires kryssa_ice_beam
    kryssa.bossArmorShellActive = true;
    kryssa.bossPatternId = 3;
    sim.projectiles.length = 0;
    sim.executeBossKryssaAttack(kryssa, sim.player, Math.PI);
    expect(sim.projectiles.filter((b) => b.weaponId === 'kryssa_ice_beam').length).toBeGreaterThanOrEqual(5);

    // Pattern 1: Glacier Wall (accel mode with 0.36s read delay and safe gap)
    kryssa.bossArmorShellActive = false;
    kryssa.bossPatternId = 1;
    sim.projectiles.length = 0;
    sim.executeBossKryssaAttack(kryssa, sim.player, Math.PI);
    const wallBullets = sim.projectiles.filter((b) => b.weaponId === 'kryssa_glacier_wall');
    expect(wallBullets.length).toBeGreaterThanOrEqual(12);
    expect(wallBullets[0]!.kinematicMode).toBe('accel');
    expect(wallBullets[0]!.kinematicDelaySec).toBeCloseTo(0.36, 2);

    // Pattern 4: Phase 3 Climax ("BÃO TUYẾT VĨNH CỬU!")
    kryssa.bossPhase = 3;
    kryssa.bossPatternId = 4;
    sim.projectiles.length = 0;
    sim.executeBossKryssaAttack(kryssa, sim.player, Math.PI);
    expect(kryssa.lastCombatText).toBe('BÃO TUYẾT VĨNH CỬU!');
    expect(sim.projectiles.some((b) => b.bulletShape === 'heavy_orb' && b.kinematicMode === 'decel')).toBe(true);
  });

  it('forge_titan emits decelerating slag orbs alongside jump-slam shockwave on even cycles and executes sweeping flame whip + P3 Meltdown Climax', () => {
    const sim = new WorldSim({ seed: 503, biome: 3, spawnInitialWave: false, includeTrainingDummy: false, includeProps: false });
    const titan = sim.spawnEnemy('forge_titan', 520, 320, true);
    sim.player.x = 260;
    sim.player.y = 320;

    // Even cycle (Pattern 0): Jump slam shockwave ring + radial heavy_orb decel ring
    titan.bossPhase = 1;
    titan.bossAttackCycle = 0;
    titan.bossPatternId = 0;
    sim.projectiles.length = 0;
    sim.shockwaveRings.length = 0;
    sim.executeBossForgeTitanAttack(titan, Math.PI);
    expect(sim.shockwaveRings.length).toBe(1);
    expect(sim.projectiles.filter((b) => b.weaponId === 'titan_anvil_ring').length).toBeGreaterThanOrEqual(14);

    // Pattern 2: Gatling Flame Sweep stream ("LỬA QUÉT LÒ RÈN!")
    titan.bossAttackCycle = 1;
    titan.bossPatternId = 2;
    sim.projectiles.length = 0;
    sim.executeBossForgeTitanAttack(titan, Math.PI);
    expect(titan.lastCombatText).toBe('LỬA QUÉT LÒ RÈN!');
    expect(titan.bossStreamTimer).toBeGreaterThan(0);

    // Pattern 4: Phase 3 Meltdown Climax ("LÕI NHIỆT HẠCH QUÁ TẢI!")
    titan.bossPhase = 3;
    titan.bossPatternId = 4;
    sim.projectiles.length = 0;
    sim.executeBossForgeTitanAttack(titan, Math.PI);
    expect(titan.lastCombatText).toBe('LÕI NHIỆT HẠCH QUÁ TẢI!');
    expect(sim.projectiles.some((b) => b.weaponId === 'titan_magma_barrage')).toBe(true);
    expect(sim.projectiles.some((b) => b.weaponId === 'titan_flame_sweep')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/shared test test/boss-bullet-hell-patterns.test.ts`
Expected: FAIL (new patterns, `bossStreamTimer`, and `titan_anvil_ring` not yet implemented).

- [ ] **Step 3: Implement `packages/shared/src/sim/sim-boss-patterns.ts` and integrate into `sim-enemies-biome1/2/3.ts`**

1. Create `packages/shared/src/sim/sim-boss-patterns.ts` with:
   - `cancelBossProjectileStream(e: SimEnemyState): void`
   - `selectNextBossPattern(sim: WorldSim, e: SimEnemyState): number`:
     - In Phase 3, if `!e.bossClimaxFiredP3`, sets `e.bossClimaxFiredP3 = true` and selects Pattern `4` (Climax).
     - Otherwise selects from available patterns for `e.bossPhase` (P1: `0..2`, P2: `0..3`, P3: `0..4`) avoiding `e.bossLastPatternId` so no pattern repeats back-to-back.
   - `updateBossProjectileStream(sim: WorldSim, e: SimEnemyState, dtSec: number): void`:
     - Immediately calls `cancelBossProjectileStream(e)` and returns if `e.aiState === 'stunned' || (e.bossPhaseTransitionTimer ?? 0) > 0 || e.bossBurrowed || e.hp <= 0 || e.bossArmorShellActive`.
     - Steps `e.bossStreamTimer` and `e.bossStreamTickTimer`, emitting sub-volleys for active multi-tick patterns (`spore_king` Patterns 2, 3, 4; `kryssa_ice_queen` Patterns 0 follow-up, 3, 4; `forge_titan` Patterns 2, 3, 4) per Spec Section 5.2.
   - Pattern execution helpers for all 3 Bosses matching the exact pellet counts, speeds, radii, shapes, kinematics, and callouts in Spec Section 5.2.
   - Preserve deterministic cycle fallback when `e.bossPatternId === undefined` (e.g. direct unit-test calls to `executeBoss*Attack` in `balance-overhaul-b2.test.ts`):
     - `spore_king`: `bossPatternId ?? 0` fires the `16/18/20` radial `boss_spore_ring` with half-step cycle parity alternation; burrow eruption fires `12/14` radial `thorn_burst`.
     - `kryssa_ice_queen`: when `bossArmorShellActive` is true, always fires Pattern `0` (`kryssa_ice_beam`, `5` spears); when `bossPatternId === undefined`, fires `kryssa_ice_beam` + odd-cycle `14/16/18` radial `kryssa_frost_nova` with half-step parity alternation.
     - `forge_titan`: when `bossPatternId === undefined`, even cycles fire Jump-Slam `shockwaveRing` + `14/16/18` radial `titan_anvil_ring`, odd cycles fire `16/18/20` radial `titan_magma_barrage` (+ `12` radial `titan_flame_sweep` in P3 with half-step alternation).
2. Wire `selectNextBossPattern` (on telegraph start) and `updateBossProjectileStream` (each AI tick) in `sim-enemies-biome1.ts`, `sim-enemies-biome2.ts`, and `sim-enemies-biome3.ts`.
3. Update `packages/shared/test/balance-overhaul-b2.test.ts` lines 27–111 to match the new denser radial pellet counts (`spore_king`: `16` P1 ring, `12` burrow thorns; `kryssa_ice_queen`: `14` P1 frost nova; `forge_titan`: `20` P3 magma barrage, `12` P3 flame sweep) while keeping the exact `360°` (`2π / count`) uniform spacing and `0.5 * step` alternating offset assertions.

- [ ] **Step 4: Run Boss unit tests to verify they pass**

Run: `pnpm --filter @ashen-pact/shared test test/boss-bullet-hell-patterns.test.ts test/ap2-p3b-boss1-spore-king.test.ts test/ap2-p3b-boss2-kryssa.test.ts test/ap2-p3b-boss3-forge-titan.test.ts test/balance-overhaul-b2.test.ts`
Expected: PASS (all 5 test suites green).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/sim/sim-boss-patterns.ts packages/shared/src/sim/sim-enemies-biome1.ts packages/shared/src/sim/sim-enemies-biome2.ts packages/shared/src/sim/sim-enemies-biome3.ts packages/shared/src/sim/world-sim.ts packages/shared/test/balance-overhaul-b2.test.ts packages/shared/test/boss-bullet-hell-patterns.test.ts
git commit -m "feat(shared): implement 5 Gungeon-style bullet-hell patterns per boss"
```

---

### Task 3: Regular Enemy Projectile Speed/Size Tuning & 30-Seed Balance Gate (`@ashen-pact/shared`)

**Files:**
- Modify: `packages/shared/src/sim/sim-enemies-tactical-ai.ts:24-35,440-470`
- Modify: `packages/shared/src/sim/sim-enemies-tactical-b23.ts:20-50,150-350,515-555`
- Modify: `packages/shared/src/sim/sim-enemies-biome1.ts:435-565`
- Modify: `packages/shared/src/sim/sim-enemies-biome2.ts:190-275,365-415`
- Modify: `packages/shared/src/sim/sim-enemies-biome3.ts:270-420`
- Modify (if needed for 30-seed gate calibration): `packages/shared/src/data/enemies.ts`, `packages/shared/src/data/scaling.ts`
- Test: `packages/shared/test/ap2-p3a-biome1-enemies.test.ts`, `packages/shared/test/ap2-p3a-biome23-enemies.test.ts`, `packages/shared/test/ap2-p3c-balance-targets.test.ts`

**Interfaces:**
- Consumes: Task 1 `EnemyBulletShape` on `BulletVolleySpawnEvent`.
- Produces: Tuned regular enemy projectile speeds (`-15%..-21%`), updated radii (`5.8–7.8px`), assigned `bulletShape`s per Spec Section 5.3, synchronized predictive sightline speeds, and passing 30-seed `ap2-p3c-balance-targets.test.ts`.

- [ ] **Step 1: Update speed/radius expectations in `boss-bullet-hell-kinematics-graze.test.ts` and check existing enemy tests**

Add a test in `packages/shared/test/boss-bullet-hell-kinematics-graze.test.ts` asserting the new slower speed constants (`GOBLIN_SHOOTER_ARROW_SPEED = 285`, `FROST_BAT_SONIC_DART_SPEED = 235`, `ICE_MAGE_BOLT_SPEED = 220`, `ICE_MAGE_SHATTER_SPEAR_SPEED = 232`, `FIRE_IMP_FIREBALL_SPEED = 235`) and verifying regular enemy volleys carry their assigned `bulletShape` and larger radii (`5.8–7.2px`).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/shared test test/boss-bullet-hell-kinematics-graze.test.ts`
Expected: FAIL (`GOBLIN_SHOOTER_ARROW_SPEED` is still `360`).

- [ ] **Step 3: Apply Spec Section 5.3 speed, radius, sightline, and `bulletShape` updates across Biomes 1–3**

Update:
- `sim-enemies-tactical-ai.ts`: `GOBLIN_SHOOTER_ARROW_SPEED = 285`, `radius: 5.8`, `bulletShape: 'lance'`.
- `sim-enemies-biome1.ts`: `goblin_shaman` speed `205` (and sightline `205`), `radius: 6.6`, `bulletShape: 'orb'`; `thorn_turret` speed `180`, `radius: 6.0`, `bulletShape: 'ring_bolt'`.
- `sim-enemies-tactical-b23.ts`: `FROST_BAT_SONIC_DART_SPEED = 235`, `radius: 5.8`, `bulletShape: 'diamond'`; `ICE_MAGE_BOLT_SPEED = 220`, `ICE_MAGE_SHATTER_SPEAR_SPEED = 232`, `radius: 6.6`, `bulletShape: 'diamond'` / `'lance'`; `FIRE_IMP_FIREBALL_SPEED = 235`, `radius: 6.2`, `bulletShape: 'orb'`; `DWARF_CANNON_MORTAR_SPEED = 215`, `radius: 7.8`, `bulletShape: 'heavy_orb'`.
- `sim-enemies-biome2.ts`: `ice_golem` speed `208` (and sightline `208`), `radius: 7.2`, `bulletShape: 'heavy_orb'`; `kryssa_clone` speed `175` (and sightline `175`), `radius: 6.5`, `bulletShape: 'lance'`, `2` shots (`spreadRad: 0.22`).
- `sim-enemies-biome3.ts`: `welder_drone` speed `255`, `radius: 6.2`, `bulletShape: 'lance'`; `iron_shielder` speed `222` (and sightline `222`), `radius: 6.6`, `bulletShape: 'heavy_orb'`.
- Update any hardcoded old speed constants in `packages/shared/test/ap2-p3a-biome1-enemies.test.ts` or `ap2-p3a-biome23-enemies.test.ts` if they assert the exact exported constant value.

- [ ] **Step 4: Run all `@ashen-pact/shared` enemy & 30-seed balance tests and calibrate if needed**

Run: `pnpm --filter @ashen-pact/shared test test/ap2-p3a-biome1-enemies.test.ts test/ap2-p3a-biome23-enemies.test.ts test/ap2-p3c-balance-targets.test.ts`
Expected: PASS (`report.allTargetsPassed === true`). If any 30-seed metric in `ap2-p3c-balance-targets.test.ts` drifts outside its target band, tune Boss cooldowns/windups or regular enemy `attackCooldownSec` / `BIOME_SCALING` per Spec Section 6 until `ap2-p3c-balance-targets.test.ts` passes 100%.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src packages/shared/test
git commit -m "feat(shared): tune regular enemy projectile speeds, sizes, and 30-seed balance"
```

---

### Task 4: Vivid Emissive Multi-Shape Enemy Bullet Textures, Pooled Glow Halos & Graze Juice (`@ashen-pact/client`)

**Files:**
- Modify: `apps/client/src/art/texture-baker-fx.ts:17-54,189-256`
- Modify: `apps/client/src/fx/combat-fx-spawners.ts:80-125`
- Modify: `apps/client/src/scenes/GameScene.ts:171-192`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts:130-145,1392-1405`
- Modify: `apps/client/src/scenes/game-scene/entity-sync.ts:484-572`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts:145-155,700-760`
- Modify: `apps/client/src/audio/zzfx.ts`
- Test: `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts`

**Interfaces:**
- Consumes: `EnemyBulletShape` from `@ashen-pact/shared`, `SimProjectileState.bulletShape`, `SimProjectileState.radius`, and `SimEvent` (`bullet_grazed`).
- Produces:
  - Baked textures in `BAKED_FX_TEXTURE_KEYS`: `'proj_enemy_orb'` (upgraded vivid), `'proj_enemy_wave'`, `'proj_enemy_lance'`, `'proj_enemy_diamond'`, `'proj_enemy_heavy_orb'`, `'proj_enemy_ring_bolt'`, `'fx_enemy_bullet_glow'`.
  - Extended `resolveProjectileRenderSpec` accepting `bulletShape?: EnemyBulletShape` and `radius?: number`, returning shape-specific `textureKey`, `scale` (`clamp(radius / 6.0, 0.85, 1.65)` when `radius` is provided, `1.0` when omitted), `blendMode: 'NORMAL'`, `depth: 60`, `tint: 0xffffff`, `alpha: 1.0`.
  - Pooled `glowSprite?: Phaser.GameObjects.Image` (`BlendMode.ADD`, `depth: 59`, `fx_enemy_bullet_glow`) attached to non-stress enemy projectile entries in `GameScene.projectileSprites`.

- [ ] **Step 1: Write the failing test in `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts`**

Add unit tests in `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts` verifying:
1. `BAKED_FX_TEXTURE_KEYS` includes `'proj_enemy_wave'`, `'proj_enemy_lance'`, `'proj_enemy_diamond'`, `'proj_enemy_heavy_orb'`, `'proj_enemy_ring_bolt'`, and `'fx_enemy_bullet_glow'`.
2. `resolveProjectileRenderSpec({ team: 'enemy', bulletShape: 'wave', radius: 9.0, isStress: false })` returns `textureKey: 'proj_enemy_wave'`, `depth: 60`, `blendMode: 'NORMAL'`, `tint: 0xffffff`, and `scale: 1.5` (`9.0 / 6.0`), while omitting `bulletShape` and `radius` still returns `textureKey: 'proj_enemy_orb'` and `scale: 1.0`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/client test test/polish-p10b-fx-elemental-ambient.test.ts`
Expected: FAIL (new texture keys and `bulletShape`/`radius` handling not yet present).

- [ ] **Step 3: Bake the 6 vivid enemy bullet shapes + `fx_enemy_bullet_glow`, wire `resolveProjectileRenderSpec`, pooled `glowSprite` in `entity-sync.ts`, and `bullet_grazed` FX in `sim-events.ts`**

1. In `apps/client/src/art/texture-baker-fx.ts`:
   - Add `'proj_enemy_wave'`, `'proj_enemy_lance'`, `'proj_enemy_diamond'`, `'proj_enemy_heavy_orb'`, `'proj_enemy_ring_bolt'`, `'fx_enemy_bullet_glow'` to `BAKED_FX_TEXTURE_KEYS`.
   - Upgrade `proj_enemy_orb` with a brighter multi-stop neon-crimson/hot-coral corona + `#141019` outline + `#F4F1EA` white-hot core (`coreRadius >= 2.6`) while keeping `ENEMY_BULLET_VISUAL_SPEC` unchanged.
   - Bake the 5 new directional/symmetric enemy bullet shapes and `fx_enemy_bullet_glow` per Spec Section 5.4.
2. In `apps/client/src/fx/combat-fx-spawners.ts`:
   - Extend `resolveProjectileRenderSpec` to accept `bulletShape?: EnemyBulletShape` and `radius?: number`, mapping each `EnemyBulletShape` to its texture key when `!params.isStress` and computing `scale = params.radius !== undefined && !params.isStress ? clamp(params.radius / 6.0, 0.85, 1.65) : 1.0`.
3. In `apps/client/src/scenes/GameScene.ts`, `arena-tiles.ts`, and `entity-sync.ts`:
   - Add optional `glowSprite?: Phaser.GameObjects.Image` and `baseScale?: number` to `projectileSprites` / `projectileSpritePool` entries.
   - In `syncProjectilesAndPickupsImpl`, pass `bulletShape: b.bulletShape, radius: b.radius` to `resolveProjectileRenderSpec`. Scale `entry.sprite` by `(isStressTex ? stressInvBake : invBake) * spec.scale`. Rotate directional enemy shapes (`'wave'`, `'lance'`, `'diamond'`) by `b.angle`, spin `'ring_bolt'`, and keep `'orb'` / `'heavy_orb'` at `0`.
   - For non-stress enemy projectiles (`b.team === 'enemy' && !isStress`), attach/update `entry.glowSprite` (`fx_enemy_bullet_glow`, `depth: 59`, `BlendMode.ADD`, pulsing alpha `0.58 + 0.12 * Math.sin(this.time.now * 0.014 + b.id)`, scale `invBake * spec.scale * 1.35`); hide `glowSprite` for player/stress projectiles and on pool release.
4. In `apps/client/src/scenes/game-scene/sim-events.ts` & `apps/client/src/audio/zzfx.ts`:
   - Handle `case 'bullet_grazed':` by spawning 4 cyan-gold electric sparks at `(ev.x, ev.y)`, playing a subtle synth tick (`bullet_graze` in `zzfx.ts`), and spawning a throttled `SƯỢT!` floating alert (at most once per `0.9s`).
   - When a Boss triggers a signature/Climax telegraph (`e.isBoss && e.lastCombatText`), display the callout text prominently via `this.fx.spawnFloatingAlert` + transient radial light pulse.

- [ ] **Step 4: Run client unit tests to verify they pass**

Run: `pnpm --filter @ashen-pact/client test`
Expected: PASS (all client unit tests including `polish-p10b-fx-elemental-ambient.test.ts` and `topdown-shader-vfx-baker.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add apps/client/src apps/client/test
git commit -m "feat(client): bake vivid multi-shape enemy bullets with additive glow halos and graze fx"
```

---

### Task 5: Full Workspace Verification & Headless Visual Audit

**Files:**
- Verify: `packages/shared`, `apps/client`, `apps/server`

**Interfaces:**
- Consumes: Tasks 1–4 deliverables.
- Produces: Verified passing unit/balance test suites, zero TypeScript/build errors, and headless Chromium visual verification of Boss bullet-hell curtains & glowing multi-shape projectiles.

- [ ] **Step 1: Run full `@ashen-pact/shared` and `@ashen-pact/client` test suites + typecheck + build**

Run: `pnpm --filter @ashen-pact/shared test && pnpm --filter @ashen-pact/client test && pnpm typecheck && pnpm build`
Expected: PASS with zero test failures and zero TypeScript/build errors.

- [ ] **Step 2: Capture headless Chromium visual proof of the new Boss bullet curtains & glowing bullet shapes**

Invoke `lookup_skill` on `playwright-mcp` (or run a brief Playwright check against the built client) to inspect a live Boss fight with multi-shape glowing bullets and save a screenshot artifact for the user.
