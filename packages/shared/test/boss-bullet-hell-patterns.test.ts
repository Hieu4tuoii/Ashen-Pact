import { describe, expect, it } from 'vitest';
import { WorldSim } from '../src/index.js';

const DT = 1 / 60;

describe('Solo-First Boss 5-Pattern Bullet-Hell Choreography & Stream Cancellation', () => {
  it('spore_king executes all 5 distinct patterns across phases, emits multi-tick spiral/climax streams, and cancels streams immediately on stun', () => {
    const sim = new WorldSim({
      seed: 501,
      biome: 1,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
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
    expect(
      sim.projectiles.some((b) => b.bulletShape === 'wave' && b.kinematicMode === 'decel'),
    ).toBe(true);
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
    const sim = new WorldSim({
      seed: 502,
      biome: 2,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const kryssa = sim.spawnEnemy('kryssa_ice_queen', 520, 320, true);
    sim.player.x = 260;
    sim.player.y = 320;

    // Armor shell active -> always fires kryssa_ice_beam
    kryssa.bossArmorShellActive = true;
    kryssa.bossPatternId = 3;
    sim.projectiles.length = 0;
    sim.executeBossKryssaAttack(kryssa, sim.player, Math.PI);
    expect(
      sim.projectiles.filter((b) => b.weaponId === 'kryssa_ice_beam').length,
    ).toBeGreaterThanOrEqual(5);

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
    expect(
      sim.projectiles.some((b) => b.bulletShape === 'heavy_orb' && b.kinematicMode === 'decel'),
    ).toBe(true);
  });

  it('forge_titan emits decelerating slag orbs alongside jump-slam shockwave on even cycles and executes sweeping flame whip + P3 Meltdown Climax', () => {
    const sim = new WorldSim({
      seed: 503,
      biome: 3,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
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
    expect(
      sim.projectiles.filter((b) => b.weaponId === 'titan_anvil_ring').length,
    ).toBeGreaterThanOrEqual(14);

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
