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
      sim.projectiles.some((b) => b.bulletShape === 'heavy_orb' && b.kinematicMode === 'decel'),
    ).toBe(true);
    expect(sim.projectiles.some((b) => b.bulletShape === 'small_orb')).toBe(true);

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

  it('clamps bossPatternId when bossArmorShellActive is true on spore_king, kryssa_ice_queen, and forge_titan (preventing truncated streams, preserving titan shockwaves, deferring P3 Climax, and propagating bossPatternId in enemy_telegraph)', () => {
    // 1. Spore King: stale Pattern 2 with bossArmorShellActive = true resets to 0 on telegraph, never starts stream, and defers P3 Climax until shell breaks
    const sim1 = new WorldSim({
      seed: 601,
      biome: 1,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const spore = sim1.spawnEnemy('spore_king', 520, 320, true);
    sim1.player.x = 260;
    sim1.player.y = 320;
    spore.bossPhase = 3;
    spore.bossPhaseTransitionTimer = 0;
    spore.bossClimaxFiredP3 = false;
    spore.bossArmorShellActive = true;
    spore.bossPatternId = 2;
    spore.bossAttackCycle = 0;
    spore.aiState = 'move';
    spore.attackCooldownTimer = 0;
    sim1.consumeEvents();
    sim1.step(DT);

    expect(spore.aiState).toBe('telegraph');
    expect(spore.bossPatternId).toBe(0);
    expect(spore.bossClimaxFiredP3).toBeFalsy();
    const sporeTele = sim1.consumeEvents().find((ev) => ev.kind === 'enemy_telegraph');
    expect(sporeTele?.kind === 'enemy_telegraph' ? sporeTele.bossPatternId : undefined).toBe(0);

    // Even if executeBossSporeKingAttack is called with stale bossPatternId = 2 while shell active, it clamps to Pattern 0 with zero stream
    spore.bossPatternId = 2;
    sim1.projectiles.length = 0;
    sim1.executeBossSporeKingAttack(spore, Math.PI);
    expect(spore.bossStreamTimer ?? 0).toBe(0);
    expect(sim1.projectiles.some((b) => b.weaponId === 'boss_spore_ring')).toBe(true);
    expect(sim1.projectiles.some((b) => b.weaponId === 'spore_spiral_stream')).toBe(false);

    // Once armor shell breaks, P3 Climax (Pattern 4) fires and propagates bossPatternId = 4 in enemy_telegraph
    spore.bossArmorShellActive = false;
    spore.bossAttackCycle = 0;
    spore.aiState = 'move';
    spore.attackCooldownTimer = 0;
    sim1.consumeEvents();
    sim1.step(DT);
    expect(spore.bossPatternId).toBe(4);
    expect(spore.bossClimaxFiredP3).toBe(true);
    const sporeClimaxTele = sim1.consumeEvents().find((ev) => ev.kind === 'enemy_telegraph');
    expect(
      sporeClimaxTele?.kind === 'enemy_telegraph' ? sporeClimaxTele.bossPatternId : undefined,
    ).toBe(4);

    // 2. Kryssa: resets stale bossPatternId to 0 while shell active and propagates bossPatternId in enemy_telegraph
    const sim2 = new WorldSim({
      seed: 602,
      biome: 2,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const kryssa = sim2.spawnEnemy('kryssa_ice_queen', 520, 320, true);
    sim2.player.x = 260;
    sim2.player.y = 320;
    kryssa.bossPhase = 3;
    kryssa.bossPhaseTransitionTimer = 0;
    kryssa.bossClimaxFiredP3 = false;
    kryssa.bossArmorShellActive = true;
    kryssa.bossPatternId = 3;
    kryssa.aiState = 'move';
    kryssa.attackCooldownTimer = 0;
    sim2.consumeEvents();
    sim2.step(DT);
    expect(kryssa.bossPatternId).toBe(0);
    expect(kryssa.bossClimaxFiredP3).toBeFalsy();
    const kryssaShellTele = sim2.consumeEvents().find((ev) => ev.kind === 'enemy_telegraph');
    expect(
      kryssaShellTele?.kind === 'enemy_telegraph' ? kryssaShellTele.bossPatternId : undefined,
    ).toBe(0);

    // 3. Forge Titan: stale Pattern 2 with bossArmorShellActive = true clamps to 0/1 by cycle parity, never starts stream, and keeps shockwaveRings active on even cycles
    const sim3 = new WorldSim({
      seed: 603,
      biome: 3,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const titan = sim3.spawnEnemy('forge_titan', 520, 320, true);
    sim3.player.x = 260;
    sim3.player.y = 320;
    titan.bossPhase = 3;
    titan.bossPhaseTransitionTimer = 0;
    titan.bossClimaxFiredP3 = false;
    titan.bossArmorShellActive = true;
    titan.bossPatternId = 2;
    titan.bossAttackCycle = 0;
    titan.aiState = 'move';
    titan.attackCooldownTimer = 0;
    sim3.consumeEvents();
    sim3.step(DT);

    expect(titan.aiState).toBe('telegraph');
    expect(titan.bossPatternId).toBe(0);
    expect(titan.bossClimaxFiredP3).toBeFalsy();
    const titanShellTele = sim3.consumeEvents().find((ev) => ev.kind === 'enemy_telegraph');
    expect(
      titanShellTele?.kind === 'enemy_telegraph' ? titanShellTele.bossPatternId : undefined,
    ).toBe(0);

    // Even if executeBossForgeTitanAttack is called with stale bossPatternId = 2 while shell active, even cycle emits shockwaveRing + anvil ring with zero stream
    titan.bossPatternId = 2;
    titan.bossAttackCycle = 0;
    sim3.projectiles.length = 0;
    sim3.shockwaveRings.length = 0;
    sim3.executeBossForgeTitanAttack(titan, Math.PI);
    expect(titan.bossStreamTimer ?? 0).toBe(0);
    expect(sim3.shockwaveRings.length).toBe(1);
    expect(sim3.projectiles.some((b) => b.weaponId === 'titan_anvil_ring')).toBe(true);
    expect(sim3.projectiles.some((b) => b.weaponId === 'titan_flame_sweep')).toBe(false);
  });

  it('enforces Gungeon 4-shape discipline and linear-only lance invariant across all 15 Boss patterns and streams', () => {
    const allowed = new Set(['small_orb', 'orb', 'heavy_orb', 'lance']);

    const assertProjectilesAndVolleys = (sim: WorldSim) => {
      const enemyBullets = sim.projectiles.filter((b) => b.team === 'enemy');
      expect(enemyBullets.length).toBeGreaterThan(0);
      for (const b of enemyBullets) {
        expect(allowed.has(b.bulletShape!)).toBe(true);
        if (b.bulletShape === 'lance') {
          expect(b.angularVelRad ?? 0).toBe(0);
          expect(b.kinematicMode).not.toBe('spiral');
        }
      }
      for (const ev of sim.consumeEvents()) {
        if (ev.kind === 'bullet_volley_spawned' && ev.team === 'enemy') {
          expect(allowed.has(ev.bulletShape!)).toBe(true);
          if (ev.alternateBulletShape !== undefined) {
            expect(allowed.has(ev.alternateBulletShape)).toBe(true);
          }
          if (ev.bulletShape === 'lance' || ev.alternateBulletShape === 'lance') {
            expect(ev.radialStepRad).toBeUndefined();
            expect(ev.angularVelRad ?? 0).toBe(0);
            expect(ev.spreadRad).toBeLessThanOrEqual(0.44);
          }
        }
      }
    };

    const bossConfigs = [
      { defId: 'spore_king', biome: 1 as const },
      { defId: 'kryssa_ice_queen', biome: 2 as const },
      { defId: 'forge_titan', biome: 3 as const },
    ];

    for (const cfg of bossConfigs) {
      for (let pat = 0; pat <= 4; pat++) {
        const sim = new WorldSim({
          seed: 800 + cfg.biome * 10 + pat,
          biome: cfg.biome,
          spawnInitialWave: false,
          includeTrainingDummy: false,
          includeProps: false,
        });
        const boss = sim.spawnEnemy(cfg.defId, 480, 320, true);
        sim.player.x = 140;
        sim.player.y = 140;
        boss.bossPhase = 3;
        boss.bossArmorShellActive = false;
        boss.bossPatternId = pat;
        boss.bossLastPatternId = pat;
        boss.bossAttackCycle = cfg.defId === 'forge_titan' && pat === 0 ? 14 : 0;
        boss.aiState = 'cooldown';
        boss.stateTimer = 5.0;
        boss.attackCooldownTimer = 5.0;

        sim.projectiles.length = 0;
        sim.consumeEvents();

        if (cfg.defId === 'spore_king') {
          sim.executeBossSporeKingAttack(boss, Math.PI);
        } else if (cfg.defId === 'kryssa_ice_queen') {
          sim.executeBossKryssaAttack(boss, sim.player, Math.PI);
        } else {
          sim.executeBossForgeTitanAttack(boss, Math.PI);
        }

        // Step 12 stream ticks and continue through full stream duration (36 sim ticks = 0.60s)
        for (let t = 0; t < 12; t++) sim.step(DT);
        assertProjectilesAndVolleys(sim);
        for (let t = 0; t < 24; t++) sim.step(DT);
        assertProjectilesAndVolleys(sim);
      }
    }

    // Spore King burrow eruption -> alternating 'orb' and 'small_orb' (no 'lance' radial ring)
    const burrowSim = new WorldSim({
      seed: 899,
      biome: 1,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const burrowBoss = burrowSim.spawnEnemy('spore_king', 480, 320, true);
    burrowSim.player.x = 140;
    burrowSim.player.y = 140;
    burrowBoss.bossPhase = 3;
    burrowBoss.bossLastPatternId = 0;
    burrowBoss.bossBurrowed = true;
    burrowSim.projectiles.length = 0;
    burrowSim.consumeEvents();
    burrowSim.executeBossSporeKingAttack(burrowBoss, Math.PI);
    assertProjectilesAndVolleys(burrowSim);
    expect(burrowSim.projectiles.some((b) => b.bulletShape === 'orb')).toBe(true);
    expect(burrowSim.projectiles.some((b) => b.bulletShape === 'small_orb')).toBe(true);

    // Forge Titan legacy P3 odd-cycle flame sweep -> 'orb'
    const legacyTitanSim = new WorldSim({
      seed: 900,
      biome: 3,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const legacyTitan = legacyTitanSim.spawnEnemy('forge_titan', 480, 320, true);
    legacyTitanSim.player.x = 140;
    legacyTitanSim.player.y = 140;
    legacyTitan.bossPhase = 3;
    legacyTitan.bossPatternId = undefined;
    legacyTitan.bossAttackCycle = 1;
    legacyTitanSim.projectiles.length = 0;
    legacyTitanSim.consumeEvents();
    legacyTitanSim.executeBossForgeTitanAttack(legacyTitan, Math.PI);
    assertProjectilesAndVolleys(legacyTitanSim);
  });
});
