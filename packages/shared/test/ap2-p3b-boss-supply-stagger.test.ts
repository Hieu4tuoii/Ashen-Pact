import { describe, expect, it } from 'vitest';
import {
  BOSS_MIN_BARRICADES,
  BOSS_MIN_BIOME_TOYS,
  BOSS_STAGGER_COOLDOWN_SEC,
  BOSS_STAGGER_FLINCH_SEC,
  BOSS_STAGGER_MAX,
  BOSS_STAGGER_PROP_KICK_BONUS,
  BOSS_SUPPLY_DROP_INTERVAL_SEC,
  BOSS_SUPPLY_DROP_TELEGRAPH_SEC,
  DASH_COOLDOWN_SEC,
  WorldSim,
  addBossStaggerAccum,
  onEnemyWallSlammed,
  triggerBossInPlaceWallSlam,
  triggerBossPhaseSupplyDrop,
} from '../src/index.js';

const SIM_STEP_SEC = 1 / 60;

function createBossRoomSim(biome: 1 | 2 | 3, seed = 9101): WorldSim {
  const sim = new WorldSim({
    seed,
    biome,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
  });
  const bossRoom =
    sim.dungeon.rooms.find((r) => r.type === 'boss') ?? sim.dungeon.rooms[0]!;
  bossRoom.type = 'boss';
  bossRoom.cleared = false;
  sim.enterRoom(bossRoom.id);
  return sim;
}

describe('AP2 Phase P3B.1 — Boss Supply Drop 18s & bossStaggerAccum (0..100) In-Place Wall-Slam', () => {
  it('spawns 0.6s SimPendingBossSupplyDrop indicators every 18.0s in Biomes 1, 2, and 3 and lands >= 3 Barricades + 2 Biome Toys after 0.6s', () => {
    expect(BOSS_SUPPLY_DROP_INTERVAL_SEC).toBe(18.0);
    expect(BOSS_SUPPLY_DROP_TELEGRAPH_SEC).toBe(0.6);
    expect(BOSS_MIN_BARRICADES).toBe(3);
    expect(BOSS_MIN_BIOME_TOYS).toBe(2);

    const biomeSpecs = [
      {
        biome: 1 as const,
        bossDefId: 'spore_king',
        barricadeKind: 'moss_table',
        toyKinds: ['volatile_spore_pod'],
      },
      {
        biome: 2 as const,
        bossDefId: 'kryssa_ice_queen',
        barricadeKind: 'glacial_barricade',
        toyKinds: ['sliding_ice_block'],
      },
      {
        biome: 3 as const,
        bossDefId: 'forge_titan',
        barricadeKind: 'forge_blast_shield',
        toyKinds: ['coal_bomb', 'slag_crucible'],
      },
    ];

    for (const spec of biomeSpecs) {
      const sim = createBossRoomSim(spec.biome, 9100 + spec.biome);
      const boss = sim.getActiveBoss();
      expect(boss).not.toBeNull();
      expect(boss?.defId).toBe(spec.bossDefId);

      // Remove any tactical barricades/toys so count starts at 0
      sim.props = sim.props.filter(
        (p) =>
          p.kind !== spec.barricadeKind &&
          !spec.toyKinds.includes(p.kind),
      );
      expect(sim.pendingBossSupplyDrops).toHaveLength(0);

      // Step 18.0s (1080 ticks at 60Hz): supply drop telegraph rings should spawn with timer = 0.6s
      for (let t = 0; t < Math.round(BOSS_SUPPLY_DROP_INTERVAL_SEC * 60); t++) {
        sim.step(SIM_STEP_SEC);
      }

      expect(sim.pendingBossSupplyDrops).toHaveLength(
        BOSS_MIN_BARRICADES + BOSS_MIN_BIOME_TOYS,
      );
      const cx = sim.map.width * 0.5;
      const cy = sim.map.height * 0.5;
      for (const drop of sim.pendingBossSupplyDrops) {
        expect(drop.timer).toBeCloseTo(BOSS_SUPPLY_DROP_TELEGRAPH_SEC, 2);
        expect(drop.maxTimer).toBe(BOSS_SUPPLY_DROP_TELEGRAPH_SEC);
        expect(drop.radius).toBe(26);
        const distFromCenter = Math.hypot(drop.x - cx, drop.y - cy);
        expect(distFromCenter).toBeGreaterThanOrEqual(110);
        expect(distFromCenter).toBeLessThanOrEqual(210);
      }

      // Step 0.6s (36 ticks): all pending drops land and spawn actual props
      for (let t = 0; t < Math.round(BOSS_SUPPLY_DROP_TELEGRAPH_SEC * 60); t++) {
        sim.step(SIM_STEP_SEC);
      }

      expect(sim.pendingBossSupplyDrops).toHaveLength(0);

      const intactBarricades = sim.props.filter(
        (p) =>
          p.kind === spec.barricadeKind &&
          p.hp > 0 &&
          p.state !== 'broken' &&
          p.coverState !== 'fallen',
      );
      const intactToys = sim.props.filter(
        (p) =>
          spec.toyKinds.includes(p.kind) &&
          p.hp > 0 &&
          p.state !== 'broken' &&
          p.coverState !== 'fallen',
      );
      expect(intactBarricades.length).toBeGreaterThanOrEqual(BOSS_MIN_BARRICADES);
      expect(intactToys.length).toBeGreaterThanOrEqual(BOSS_MIN_BIOME_TOYS);
      expect(intactBarricades[0]?.lastCombatText).toBe('SUPPLY DROP!');
    }
  });

  it('triggers Boss Supply Drop immediately on Boss Phase transitions at 66% HP and 33% HP and clears pending drops on enterRoom / enterHub', () => {
    const sim = createBossRoomSim(1, 9110);
    const boss = sim.getActiveBoss()!;
    expect(boss).toBeDefined();
    boss.bossPhase = 1;
    boss.maxHp = 3000;
    boss.hp = 3000;

    // Leave only 1 intact moss_table and 1 volatile_spore_pod in the room
    sim.props = sim.props.filter(
      (p) => p.kind !== 'moss_table' && p.kind !== 'volatile_spore_pod',
    );
    sim.spawnProp('moss_table', 360, 260);
    sim.spawnProp('volatile_spore_pod', 420, 260);

    // Damage boss below 66% HP -> Phase 2 transition triggers supply drop for missing (2 barricades + 1 toy = 3 drops)
    boss.hp = Math.floor(boss.maxHp * 0.65);
    sim.checkBossPhaseTransitions(boss);
    expect(boss.bossPhase).toBe(2);
    expect(sim.pendingBossSupplyDrops).toHaveLength(3);

    // Step 0.6s to land Phase 2 supply drops
    for (let t = 0; t < 36; t++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.pendingBossSupplyDrops).toHaveLength(0);
    expect(
      sim.props.filter((p) => p.kind === 'moss_table' && p.hp > 0).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      sim.props.filter((p) => p.kind === 'volatile_spore_pod' && p.hp > 0).length,
    ).toBeGreaterThanOrEqual(2);

    // Destroy 2 moss_tables and transition to Phase 3 (<= 33% HP)
    const tables = sim.props.filter((p) => p.kind === 'moss_table' && p.hp > 0);
    tables[0]!.hp = 0;
    tables[0]!.state = 'broken';
    tables[1]!.hp = 0;
    tables[1]!.state = 'broken';

    boss.hp = Math.floor(boss.maxHp * 0.32);
    sim.checkBossPhaseTransitions(boss);
    expect(boss.bossPhase).toBe(3);
    expect(sim.pendingBossSupplyDrops).toHaveLength(2);

    // Verify enterRoom clears pendingBossSupplyDrops
    const startRoom = sim.dungeon.rooms[sim.dungeon.startRoomId]!;
    sim.enterRoom(startRoom.id);
    expect(sim.pendingBossSupplyDrops).toHaveLength(0);

    // Re-trigger via helper and verify enterHub clears pendingBossSupplyDrops
    const boss2 = sim.spawnEnemy('spore_king', 500, 350, true);
    triggerBossPhaseSupplyDrop(sim, boss2);
    expect(sim.pendingBossSupplyDrops.length).toBeGreaterThan(0);
    sim.enterHub();
    expect(sim.pendingBossSupplyDrops).toHaveLength(0);
  });

  it('accumulates bossStaggerAccum by (knockback / 12) * procCoefficient on knockback hits and +50 on Dash-Kicked / counter-kicked props', () => {
    expect(BOSS_STAGGER_MAX).toBe(100);
    expect(BOSS_STAGGER_PROP_KICK_BONUS).toBe(50);

    const sim = createBossRoomSim(1, 9120);
    const boss = sim.getActiveBoss()!;
    boss.maxHp = 5000;
    boss.hp = 5000;
    boss.bossStaggerAccum = 0;
    boss.bossStaggerCooldownTimer = 0;

    // 1. Hit with knockback = 120 and procCoefficient = 0.5 -> +(120 / 12) * 0.5 = +5
    addBossStaggerAccum(sim, boss, 120, 0.5, false, sim.player);
    expect(boss.bossStaggerAccum).toBeCloseTo(5, 5);

    // 2. Hit via applyDamageToEnemy with knockback = 180 (default procCoefficient = 1.0) -> +(180 / 12) * 1.0 = +15 (total 20)
    sim.applyDamageToEnemy(boss, 24, false, 'none', 0, 180, false, sim.player.id);
    expect(boss.bossStaggerAccum).toBeCloseTo(20, 5);

    // 3. Dash-Kick a flipped barricade into the Boss -> +50 (total 70)
    const table = sim.spawnProp('moss_table', boss.x - 42, boss.y);
    sim.flipCoverProp(table, sim.player);
    sim.kickProp(table, sim.player, 0);
    for (let t = 0; t < 6; t++) {
      sim.step(SIM_STEP_SEC);
      if ((boss.bossStaggerAccum ?? 0) >= 70) break;
    }
    expect(boss.bossStaggerAccum).toBeCloseTo(70, 5);
  });

  it('triggers in-place WALL-SLAM! at bossStaggerAccum >= 100 (resets to 0, 6.0s cooldown, 0.5s stun, emits wall_slam, triggers Wall-Slam blessings, blocks accumulation during cooldown)', () => {
    expect(BOSS_STAGGER_COOLDOWN_SEC).toBe(6.0);
    expect(BOSS_STAGGER_FLINCH_SEC).toBe(0.5);

    const sim = createBossRoomSim(2, 9130);
    const p1 = sim.player;
    p1.blessingIds.push('dash_tidal_ram', 'table_tech_rocket');
    p1.awakenedRelicIds.push('relic_executioner_scythe');
    p1.dashCooldownTimer = DASH_COOLDOWN_SEC;
    p1.dashTidalRamIcdTimer = 0;
    p1.tableTechRocketIcdTimer = 0;
    p1.executionerScytheIcdTimer = 0;

    const boss = sim.getActiveBoss()!;
    boss.maxHp = 6000;
    boss.hp = 6000;
    boss.bossStaggerAccum = 60;
    boss.bossStaggerCooldownTimer = 0;

    const fodder = sim.spawnEnemy('frost_bat', boss.x + 48, boss.y, true);
    fodder.maxHp = 400;
    fodder.hp = 400;

    sim.consumeEvents();
    const bossHpBefore = boss.hp;

    // Add +50 via kicked prop hit -> reaches 110 >= 100 -> triggers in-place WALL-SLAM!
    addBossStaggerAccum(sim, boss, 0, 1.0, true, p1);

    expect(boss.bossStaggerAccum).toBe(0);
    expect(boss.bossStaggerCooldownTimer).toBeCloseTo(BOSS_STAGGER_COOLDOWN_SEC, 5);
    expect(boss.stunTimer).toBeGreaterThanOrEqual(BOSS_STAGGER_FLINCH_SEC);
    expect(boss.aiState).toBe('stunned');
    expect(boss.lastCombatText).toBe('WALL-SLAM!');
    expect(boss.hp).toBeLessThan(bossHpBefore);

    const events = sim.consumeEvents();
    const slamEvent = events.find(
      (ev) => ev.kind === 'wall_slam' && ev.enemyId === boss.id,
    );
    expect(slamEvent).toBeDefined();

    // Verify Wall-Slam blessings triggered:
    // - dash_tidal_ram refunded 60% of DASH_COOLDOWN_SEC
    expect(p1.dashCooldownTimer).toBeCloseTo(DASH_COOLDOWN_SEC * 0.4, 3);
    // - table_tech_rocket spawned 2 homing rockets
    expect(
      sim.projectiles.filter((b) => b.weaponId === 'table_tech_rocket').length,
    ).toBeGreaterThanOrEqual(2);
    // - relic_executioner_scythe slashed nearby enemy
    expect(p1.executionerScytheIcdTimer).toBeGreaterThan(0);
    expect(fodder.hp).toBeLessThan(400);

    // While bossStaggerCooldownTimer > 0 (6.0s), bossStaggerAccum must NOT accumulate
    addBossStaggerAccum(sim, boss, 240, 1.0, false, p1);
    addBossStaggerAccum(sim, boss, 0, 1.0, true, p1);
    sim.applyDamageToEnemy(boss, 30, false, 'none', 0, 240, false, p1.id);
    expect(boss.bossStaggerAccum).toBe(0);

    // Step 6.0s so bossStaggerCooldownTimer expires, then verify accumulation resumes
    for (let t = 0; t < Math.round(BOSS_STAGGER_COOLDOWN_SEC * 60); t++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(boss.bossStaggerCooldownTimer).toBe(0);

    addBossStaggerAccum(sim, boss, 120, 1.0, false, p1);
    expect(boss.bossStaggerAccum).toBeCloseTo(10, 5);
    expect(typeof triggerBossInPlaceWallSlam).toBe('function');
    expect(typeof onEnemyWallSlammed).toBe('function');
  });
});
