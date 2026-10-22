import { describe, expect, it } from 'vitest';
import { ENEMIES, WorldSim, angleDiff } from '../src/index.js';

describe('Phase B2 — Boss Overhaul (HP, True 360° Radial Patterns, Cooldowns, & Authentic Orbs)', () => {
  it('B2.1a: updates Boss HP values (spore_king: 5200, kryssa_ice_queen: 6800, forge_titan: 9600)', () => {
    expect(ENEMIES.spore_king.hp).toBe(5200);
    expect(ENEMIES.kryssa_ice_queen.hp).toBe(6800);
    expect(ENEMIES.forge_titan.hp).toBe(9600);
  });

  it('B2.1b: enforces true 360° radial bullet patterns ((Math.PI * 2) / count) with no 90° blind spot and alternating start angles for all 3 bosses', () => {
    const sim = new WorldSim({
      seed: 202610,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    const p = sim.player;
    p.x = 260;
    p.y = 320;

    // 1. Spore King — Spore Ring Nova & Burrow Eruption
    const sporeKing = sim.spawnEnemy('spore_king', 540, 320, true);
    const angleToPlayer = Math.atan2(p.y - sporeKing.y, p.x - sporeKing.x);

    // Cycle 0: Spore Ring Nova (12 pellets in Phase 1)
    sim.projectiles.length = 0;
    sporeKing.bossPhase = 1;
    sporeKing.bossBurrowed = false;
    sporeKing.bossAttackCycle = 0;
    sim.executeBossSporeKingAttack(sporeKing, angleToPlayer);
    const ring0 = sim.projectiles.filter((b) => b.weaponId === 'boss_spore_ring');
    expect(ring0).toHaveLength(12);
    // Check uniform 360° spacing (2π / 12) and that a bullet aims directly toward player (diff ~ 0)
    const step12 = (Math.PI * 2) / 12;
    for (let i = 1; i < ring0.length; i++) {
      expect(Math.abs(angleDiff(ring0[i]!.angle, ring0[i - 1]!.angle))).toBeCloseTo(step12, 3);
    }
    expect(Math.min(...ring0.map((b) => Math.abs(angleDiff(b.angle, angleToPlayer))))).toBeLessThan(
      0.01,
    );

    // Cycle 1: Alternating angle offset shifted by half step (π / 12)
    sim.projectiles.length = 0;
    sporeKing.bossBurrowed = false;
    sporeKing.bossAttackCycle = 1;
    sim.executeBossSporeKingAttack(sporeKing, angleToPlayer);
    const ring1 = sim.projectiles.filter((b) => b.weaponId === 'boss_spore_ring');
    expect(ring1).toHaveLength(12);
    expect(Math.abs(angleDiff(ring1[0]!.angle, ring0[0]!.angle))).toBeCloseTo(step12 * 0.5, 3);

    // Burrow Eruption: 8 radial thorns at (2π / 8)
    sim.projectiles.length = 0;
    sporeKing.bossBurrowed = true;
    sporeKing.bossAttackCycle = 0;
    sim.executeBossSporeKingAttack(sporeKing, angleToPlayer);
    const thorns0 = sim.projectiles.filter((b) => b.weaponId === 'thorn_burst');
    expect(thorns0).toHaveLength(8);
    const step8 = (Math.PI * 2) / 8;
    for (let i = 1; i < thorns0.length; i++) {
      expect(Math.abs(angleDiff(thorns0[i]!.angle, thorns0[i - 1]!.angle))).toBeCloseTo(step8, 3);
    }

    // 2. Kryssa Ice Queen — Radial Frost Crystal Nova
    const kryssa = sim.spawnEnemy('kryssa_ice_queen', 540, 320, true);
    kryssa.bossPhase = 1;
    sim.projectiles.length = 0;
    kryssa.bossAttackCycle = 1; // odd cycle triggers frost nova (parity 0)
    sim.executeBossKryssaAttack(kryssa, p, angleToPlayer);
    const nova0 = sim.projectiles.filter((b) => b.weaponId === 'kryssa_frost_nova');
    expect(nova0).toHaveLength(10);
    const step10 = (Math.PI * 2) / 10;
    for (let i = 1; i < nova0.length; i++) {
      expect(Math.abs(angleDiff(nova0[i]!.angle, nova0[i - 1]!.angle))).toBeCloseTo(step10, 3);
    }

    sim.projectiles.length = 0;
    kryssa.bossAttackCycle = 3; // next odd cycle alternates angle offset by half step (π / 10)
    sim.executeBossKryssaAttack(kryssa, p, angleToPlayer);
    const nova1 = sim.projectiles.filter((b) => b.weaponId === 'kryssa_frost_nova');
    expect(nova1).toHaveLength(10);
    expect(Math.abs(angleDiff(nova1[0]!.angle, nova0[0]!.angle))).toBeCloseTo(step10 * 0.5, 3);

    // 3. Forge Titan — Magma Barrage & Phase 3 8-pellet Flame Sweep
    const titan = sim.spawnEnemy('forge_titan', 540, 320, true);
    titan.bossPhase = 3;
    sim.projectiles.length = 0;
    titan.bossAttackCycle = 1;
    sim.executeBossForgeTitanAttack(titan, angleToPlayer);
    const barrage0 = sim.projectiles.filter((b) => b.weaponId === 'titan_magma_barrage');
    const sweep0 = sim.projectiles.filter((b) => b.weaponId === 'titan_flame_sweep');
    expect(barrage0).toHaveLength(12);
    expect(sweep0).toHaveLength(8);
    for (let i = 1; i < barrage0.length; i++) {
      expect(Math.abs(angleDiff(barrage0[i]!.angle, barrage0[i - 1]!.angle))).toBeCloseTo(
        step12,
        3,
      );
    }
    for (let i = 1; i < sweep0.length; i++) {
      expect(Math.abs(angleDiff(sweep0[i]!.angle, sweep0[i - 1]!.angle))).toBeCloseTo(step8, 3);
    }

    sim.projectiles.length = 0;
    titan.bossAttackCycle = 3;
    sim.executeBossForgeTitanAttack(titan, angleToPlayer);
    const sweep1 = sim.projectiles.filter((b) => b.weaponId === 'titan_flame_sweep');
    expect(sweep1).toHaveLength(8);
    expect(Math.abs(angleDiff(sweep1[0]!.angle, sweep0[0]!.angle))).toBeCloseTo(step8 * 0.5, 3);
  });

  it('B2.1c: killing boss adds or forge_energy_core never spawns pickups at (pl.x, pl.y); spawns at (enemy.x, enemy.y) with 25% life_seed chance for adds', () => {
    const sim = new WorldSim({
      seed: 202611,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    const p = sim.player;
    p.x = 200;
    p.y = 200;

    const boss = sim.spawnEnemy('forge_titan', 620, 320, true);
    expect(boss.hp).toBeGreaterThan(0);

    // 1. Destroying forge_energy_core drops 1 life_seed (amount: 2) and 1 energy (amount: 12) at (core.x, core.y)
    sim.pickups.length = 0;
    const core = sim.spawnEnemy('forge_energy_core', 520, 280, true);
    sim.applyDamageToEnemy(core, 9999, false, 'none', 0, 0);
    expect(sim.pickups).toHaveLength(2);
    const coreLifeSeed = sim.pickups.find((pk) => pk.kind === 'life_seed')!;
    const coreEnergy = sim.pickups.find((pk) => pk.kind === 'energy')!;
    expect(coreLifeSeed).toBeDefined();
    expect(coreLifeSeed.amount).toBe(2);
    expect(coreLifeSeed.x).toBe(520);
    expect(coreLifeSeed.y).toBe(280);
    expect(Math.hypot(coreLifeSeed.vx, coreLifeSeed.vy)).toBeGreaterThan(0);
    expect(coreEnergy).toBeDefined();
    expect(coreEnergy.amount).toBe(12);
    expect(coreEnergy.x).toBe(520);
    expect(coreEnergy.y).toBe(280);
    expect(Math.hypot(coreEnergy.vx, coreEnergy.vy)).toBeGreaterThan(0);

    // 2. Killing boss adds never spawns pickups at (p.x, p.y) and drops life_seed at (add.x, add.y) with ~25% chance
    let lifeSeedDrops = 0;
    const trials = 160;
    for (let i = 0; i < trials; i++) {
      sim.pickups.length = 0;
      const add = sim.spawnEnemy('goblin_shooter', 500, 360, true);
      sim.applyDamageToEnemy(add, 999, false, 'none', 0, 0);
      for (const pk of sim.pickups) {
        expect(Math.hypot(pk.x - p.x, pk.y - p.y)).toBeGreaterThan(100);
        expect(pk.x).toBe(500);
        expect(pk.y).toBe(360);
      }
      const seeds = sim.pickups.filter((pk) => pk.kind === 'life_seed');
      if (seeds.length > 0) {
        expect(seeds).toHaveLength(1);
        expect(seeds[0]!.amount).toBe(1);
        lifeSeedDrops += 1;
      }
    }
    expect(lifeSeedDrops).toBeGreaterThanOrEqual(24);
    expect(lifeSeedDrops).toBeLessThanOrEqual(58);
  });

  it('B2.1d: Boss phase transition clears enemy projectiles only within 140px of players and spawns 1 life_seed (amount 1) + 2 energy (amount 8) at (boss.x, boss.y)', () => {
    const sim = new WorldSim({
      seed: 202612,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    const p = sim.player;
    p.x = 220;
    p.y = 320;

    const boss = sim.spawnEnemy('spore_king', 640, 320, true);

    // Projectile 1: enemy projectile within 140px of player (distance = 100px) -> MUST be cleared
    sim.projectiles.push(
      sim.acquireProjectile({
        id: 88001,
        ownerId: boss.id,
        x: p.x + 100,
        y: p.y,
        vx: -120,
        vy: 0,
        radius: 6,
        damage: 2,
        ttlSec: 2,
        isCrit: false,
        team: 'enemy',
        weaponId: 'boss_spore_ring',
        angle: Math.PI,
        knockback: 0,
        pierceRemaining: 0,
        bounceRemaining: 0,
        element: 'poison',
        amplifiedByShield: false,
      }),
    );

    // Projectile 2: enemy projectile far from player (distance = 260px, > 140px) -> MUST NOT be cleared
    sim.projectiles.push(
      sim.acquireProjectile({
        id: 88002,
        ownerId: boss.id,
        x: p.x + 260,
        y: p.y,
        vx: -120,
        vy: 0,
        radius: 6,
        damage: 2,
        ttlSec: 2,
        isCrit: false,
        team: 'enemy',
        weaponId: 'boss_spore_ring',
        angle: Math.PI,
        knockback: 0,
        pierceRemaining: 0,
        bounceRemaining: 0,
        element: 'poison',
        amplifiedByShield: false,
      }),
    );

    sim.pickups.length = 0;
    const dmgToPhase2 = Math.ceil(boss.maxHp * 0.36);
    sim.applyDamageToEnemy(boss, dmgToPhase2, false, 'none', 0, 0);

    expect(boss.bossPhase).toBe(2);
    expect(sim.projectiles.map((b) => b.id)).toEqual([88002]);

    const lifeSeeds = sim.pickups.filter((pk) => pk.kind === 'life_seed');
    const energyOrbs = sim.pickups.filter((pk) => pk.kind === 'energy');
    expect(lifeSeeds).toHaveLength(1);
    expect(lifeSeeds[0]!.amount).toBe(1);
    expect(lifeSeeds[0]!.x).toBe(boss.x);
    expect(lifeSeeds[0]!.y).toBe(boss.y);
    expect(Math.hypot(lifeSeeds[0]!.vx, lifeSeeds[0]!.vy)).toBeGreaterThan(0);

    expect(energyOrbs).toHaveLength(2);
    for (const orb of energyOrbs) {
      expect(orb.amount).toBe(8);
      expect(orb.x).toBe(boss.x);
      expect(orb.y).toBe(boss.y);
      expect(Math.hypot(orb.vx, orb.vy)).toBeGreaterThan(0);
    }
  });
});
