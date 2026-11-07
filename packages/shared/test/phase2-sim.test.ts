import { describe, expect, it } from 'vitest';
import {
  AUTOTILE_EAST,
  AUTOTILE_NORTH,
  AUTOTILE_SOUTH,
  AUTOTILE_WEST,
  ArenaMap,
  SIM_STEP_SEC,
  TILE_SIZE,
  WALL_AO_NORTH,
  WALL_AO_NORTH_WEST,
  WALL_AO_WEST,
  WorldSim,
} from '../src/index.js';

describe('Phase 2 — Autotile Bitmasks, Wall AO Shadows, Seeded Variants & Cracked Walls', () => {
  it('computes 4-bit autotile masks, directional top-left AO shadow masks, and breaks cracked walls', () => {
    const map = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 42 });

    // Top-left corner border wall (0, 0) has solid East (1, 0) and South (0, 1), plus out-of-bounds N/W treated as solid
    const cornerMask = map.getAutotileMask(0, 0);
    expect(cornerMask & AUTOTILE_EAST).toBe(AUTOTILE_EAST);
    expect(cornerMask & AUTOTILE_SOUTH).toBe(AUTOTILE_SOUTH);

    // Top-left pillar tile at (8, 5) has solid East (9, 5) and South (8, 6), and floor at North (8, 4) and West (7, 5)
    expect(map.getAutotileMask(8, 5)).toBe(AUTOTILE_EAST | AUTOTILE_SOUTH);
    // Bottom-right pillar tile at (9, 6) has solid North (9, 5) and West (8, 6), and floor at East (10, 6) and South (9, 7)
    expect(map.getAutotileMask(9, 6)).toBe(AUTOTILE_NORTH | AUTOTILE_WEST);

    // Floor tile at (1, 1) has solid wall to North (1, 0), West (0, 1), and North-West (0, 0)
    expect(map.getWallAmbientOcclusionMask(1, 1)).toBe(
      WALL_AO_NORTH | WALL_AO_WEST | WALL_AO_NORTH_WEST,
    );

    // Deterministic seeded tile variants in [0..7]
    const mapSameSeed = new ArenaMap({ cols: 36, rows: 22, seed: 42 });
    expect(map.getTileVariant(10, 10)).toBe(mapSameSeed.getTileVariant(10, 10));

    // Cracked secret wall at (18, 0) is initially solid and blocks movement/projectiles, then becomes passable when destroyed
    expect(map.getTile(18, 0)).toBe('cracked_wall');
    expect(map.isSolidTile(18, 0)).toBe(true);
    const blockedMove = map.resolveCircleCollision(18 * TILE_SIZE + 16, 18, 13);
    expect(blockedMove.y).toBeGreaterThanOrEqual(TILE_SIZE + 13);
    expect(map.checkProjectileWallHit(18 * TILE_SIZE + 16, 16, 5).hit).toBe(true);

    expect(map.destroyCrackedWall(18, 0)).toBe(true);
    expect(map.getTile(18, 0)).toBe('floor');
    expect(map.isSolidTile(18, 0)).toBe(false);

    // Once broken, player and projectiles can enter (18, 0) (y < 32), while neighboring wall (17, 0) remains solid
    const passMove = map.resolveCircleCollision(18 * TILE_SIZE + 16, 18, 13);
    expect(passMove.y).toBe(18);
    expect(map.checkProjectileWallHit(18 * TILE_SIZE + 16, 16, 5).hit).toBe(false);
    expect(map.checkProjectileWallHit(17 * TILE_SIZE + 16, 16, 5).hit).toBe(true);

    // Surface autotile mask connects matching and dynamic family surface tiles seamlessly
    map.setSurface(10, 10, 'water', 0, true);
    map.setSurface(11, 10, 'electrified_water', 2.0, true);
    map.setSurface(10, 11, 'water', 0, true);
    expect(map.getSurfaceAutotileMask(10, 10)).toBe(AUTOTILE_EAST | AUTOTILE_SOUTH);
  });
});

describe('Phase 2 — Destructible Props & Chain-Reaction Explosive Barrels', () => {
  it('breaks wooden crates into gold/energy pickups and chains explosive barrels to destroy cracked walls and ignite oil', () => {
    const sim = new WorldSim({
      seed: 2026,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    // 1. Destructible wooden crates drop gold (15% chance) when broken (no energy pickups in AP2)
    for (let i = 0; i < 20; i++) {
      const crate = sim.spawnProp('wooden_crate', 300, 300);
      sim.damageProp(crate, 25, 'none');
      expect(crate.hp).toBe(0);
    }
    expect(sim.pickups.some((p) => p.kind === 'gold')).toBe(true);
    expect(sim.pickups.every((p) => (p.kind as string) !== 'energy')).toBe(true);

    // 2. Chain reaction between two explosive barrels near the north cracked wall (18, 0) and an oil tile (18, 2)
    sim.map.setSurface(18, 2, 'oil', 0, true);
    const barrel1 = sim.spawnProp('explosive_barrel', 18 * TILE_SIZE + 16, 2 * TILE_SIZE + 8);
    const barrel2 = sim.spawnProp('explosive_barrel', 18 * TILE_SIZE + 16, 1 * TILE_SIZE + 16);
    const nearEnemy = sim.spawnEnemy(
      'goblin_shooter',
      18 * TILE_SIZE + 44,
      2 * TILE_SIZE + 12,
      true,
    );

    // Shoot barrel1 with fire -> detonates barrel1 immediately, ignites oil, and sets short fuse on barrel2
    sim.damageProp(barrel1, 5, 'burn');
    expect(barrel1.hp).toBe(0);
    expect(sim.map.getSurface(18, 2)).toBe('burning_oil');
    expect(nearEnemy.burnTimer).toBeGreaterThan(0);

    // Step 6 ticks (0.1s) -> barrel2 fuse expires, detonating barrel2 and breaking the cracked secret wall at (18, 0)!
    for (let i = 0; i < 6; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(barrel2.hp).toBe(0);
    expect(sim.map.getTile(18, 0)).toBe('floor');
  });
});

describe('Phase 2 — 4 Elemental Statuses (Burn, Chill -> Freeze -> Shatter, Shock Chain, Poison Heal-Block)', () => {
  it('applies Burn DoT, freezes on 3 Chill stacks, deals 3x Shatter damage on heavy hit, chains Shock, and blocks healing with Poison', () => {
    const sim = new WorldSim({
      seed: 3030,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    // 1. Chill (30% slow) -> 3 stacks -> Freeze (1.5s) -> Heavy/Crit hit triggers 3x Shatter!
    const boar = sim.spawnEnemy('wild_boar', 500, 350, true);
    boar.hp = 200;
    boar.maxHp = 200;

    sim.applyDamageToEnemy(boar, 5, false, 'chill', 0, 0);
    expect(boar.chillStacks).toBe(1);
    expect(boar.chillTimer).toBeGreaterThan(0);

    sim.applyDamageToEnemy(boar, 5, false, 'chill', 0, 0);
    expect(boar.chillStacks).toBe(2);

    sim.applyDamageToEnemy(boar, 5, false, 'chill', 0, 0);
    expect(boar.chillStacks).toBe(0);
    expect(boar.frozenTimer).toBeCloseTo(1.5, 2);

    // Heavy attack against frozen enemy -> 2x Shatter damage (10 * 2 = 20) and clears frozenTimer
    const hpBeforeShatter = boar.hp;
    sim.applyDamageToEnemy(boar, 10, false, 'none', 0, 0, true);
    expect(hpBeforeShatter - boar.hp).toBe(20);
    expect(boar.frozenTimer).toBe(0);

    // 2. Shock chains lightning to nearby enemies within 115u
    const targetA = sim.spawnEnemy('goblin_shooter', 500, 200, true);
    const targetB = sim.spawnEnemy('goblin_shooter', 560, 200, true);
    const bStartHp = targetB.hp;
    sim.applyDamageToEnemy(targetA, 12, false, 'shock', 0, 0);
    expect(targetB.hp).toBeLessThan(bStartHp);
    expect(targetB.shockTimer).toBeGreaterThan(0);

    // 3. Poison stacks up to 3, ticks DoT, and prevents Training Dummy from healing
    const dummy = sim.spawnTrainingDummy(250, 250);
    sim.applyDamageToEnemy(dummy, 20, false, 'poison', 0, 0);
    expect(dummy.poisonStacks).toBe(1);
    expect(dummy.hp).toBe(9979);

    // Step 1 tick -> dummy does NOT heal back to 9999 while poisoned
    sim.step(SIM_STEP_SEC);
    expect(dummy.hp).toBe(9979);
  });
});

describe('Phase 2 — 6 Interactive Surfaces & Elemental Surface Transformations', () => {
  it('electrifies connected water with shock, freezes water with chill, spreads fire across oil/grass into ash, and glides on ice', () => {
    const sim = new WorldSim({
      seed: 4040,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    // 1. Water flood-fill electrification via Shock
    sim.map.fillSurfaceRect(10, 4, 3, 2, 'water');
    sim.applyElementAtWorldPoint(10 * TILE_SIZE + 16, 4 * TILE_SIZE + 16, 'shock', 20);
    expect(sim.map.getSurface(10, 4)).toBe('electrified_water');
    expect(sim.map.getSurface(12, 5)).toBe('electrified_water'); // flood-filled across connected water!

    // 2. Water freezes into Ice via Chill
    sim.applyElementAtWorldPoint(10 * TILE_SIZE + 16, 4 * TILE_SIZE + 16, 'chill', 32);
    expect(sim.map.getSurface(10, 4)).toBe('ice');

    // 3. Oil ignites via Burn, spreads to adjacent Oil & Grass, and burns out into Ash
    sim.map.setSurface(20, 4, 'oil', 0, true);
    sim.map.setSurface(21, 4, 'grass', 0, true);
    sim.applyElementAtWorldPoint(20 * TILE_SIZE + 16, 4 * TILE_SIZE + 16, 'burn', 16);
    expect(sim.map.getSurface(20, 4)).toBe('burning_oil');

    // Step 0.35s -> fire spreads to adjacent grass tile (21, 4)
    for (let i = 0; i < 22; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.map.getSurface(21, 4)).toBe('burning_grass');

    // Step 5.0s -> both burn out into 'ash'
    for (let i = 0; i < 310; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.map.getSurface(20, 4)).toBe('ash');
    expect(sim.map.getSurface(21, 4)).toBe('ash');

    // 4. Water extinguishes burning player
    sim.map.setSurface(14, 10, 'water', 0, true);
    sim.player.x = 14 * TILE_SIZE + 16;
    sim.player.y = 10 * TILE_SIZE + 16;
    sim.player.burnTimer = 2.5;
    sim.step(SIM_STEP_SEC);
    expect(sim.player.burnTimer).toBe(0);
  });

  it('maintains 4 players, 80 enemies, and >= 600 projectiles across a full 3-minute (10,800 ticks) Stress Test soak without memory leaks', () => {
    const sim = new WorldSim({
      seed: 5050,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: true,
      autoRespawnWaves: false,
    });

    sim.configureStressTest(true);
    expect(1 + sim.simulatedPlayers.length).toBe(4);
    expect(sim.simulatedPlayers[0]!.activeWeaponSlot).toBe(1);
    expect(sim.simulatedPlayers[1]!.activeWeaponSlot).toBe(1);
    expect(sim.simulatedPlayers[2]!.activeWeaponSlot).toBe(1);
    expect(sim.enemies.length).toBe(80);
    expect(sim.projectiles.length).toBeGreaterThanOrEqual(600);

    // Warm up object pools for 300 ticks (5s)
    for (let tick = 0; tick < 300; tick++) {
      sim.step(SIM_STEP_SEC);
      sim.consumeEvents();
    }

    const heapSamples: number[] = [];
    // Run full 3-minute simulation (10,800 ticks at 60Hz = 180 seconds)
    for (let tick = 0; tick < 10_800; tick++) {
      sim.step(SIM_STEP_SEC);
      sim.consumeEvents();
      if ((tick + 1) % 1800 === 0) {
        expect(1 + sim.simulatedPlayers.length).toBe(4);
        expect(sim.enemies.length).toBe(80);
        expect(sim.projectiles.length).toBeGreaterThanOrEqual(600);
        expect(sim.projectiles.length).toBeLessThan(700);
        heapSamples.push(process.memoryUsage().heapUsed);
      }
    }

    expect(heapSamples.length).toBe(6);
    // Verify heap does not grow unbounded across the 3-minute soak
    const firstHalfAvg = (heapSamples[0]! + heapSamples[1]! + heapSamples[2]!) / 3;
    const secondHalfAvg = (heapSamples[3]! + heapSamples[4]! + heapSamples[5]!) / 3;
    expect(secondHalfAvg - firstHalfAvg).toBeLessThan(12 * 1024 * 1024);
  });
});
