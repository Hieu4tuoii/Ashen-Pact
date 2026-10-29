import { describe, expect, it } from 'vitest';
import {
  ALL_BLESSING_IDS,
  ALL_PHASE1_BLESSING_IDS,
  BLESSINGS,
  BLESSING_LIST,
  BULLET_MOD_BLESSING_IDS,
  CORE_ACTION_BLESSING_IDS,
  DASH_TECH_BLESSING_IDS,
  FLOOR_BUFFS,
  FLOOR_BUFF_LIST,
  MAX_BOUNCE_COUNT,
  RELOAD_TECH_BLESSING_IDS,
  SHOT_FLAG,
  SIM_STEP_SEC,
  SKILL_UPGRADE_BLESSING_IDS,
  TABLE_TECH_BLESSING_IDS,
  TILE_SIZE,
  WorldSim,
  computeWallSlamDamage,
  scaleBlessingDamage,
  triggerBossStaggerBurst,
} from '../src/index.js';

function createCleanArenaSim(seed = 20261027): WorldSim {
  const sim = new WorldSim({
    seed,
    startInHub: false,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
    autoRespawnWaves: false,
  });
  for (let ty = 2; ty < sim.map.rows - 2; ty++) {
    for (let tx = 2; tx < sim.map.cols - 2; tx++) {
      sim.map.setTile(tx, ty, 'floor');
      sim.map.setSurface(tx, ty, 'none', 0, true);
    }
  }
  sim.map.rebuildSolidBoxes();
  sim.props.length = 0;
  sim.enemies.length = 0;
  sim.projectiles.length = 0;
  sim.pickups.length = 0;
  sim.player.x = 10 * TILE_SIZE + 16;
  sim.player.y = 11 * TILE_SIZE + 16;
  sim.player.aimAngle = 0;
  sim.consumeEvents();
  return sim;
}

describe('AP2 Phase P1D.1 — Blessing Data Architecture (26 Phase 1 Cards) & Group 1 Table Techs', () => {
  it('defines all 26 Phase 1 blessings (16 Core Action Blessings + 10 Skill Upgrades), syncs FLOOR_BUFFS, and scales blessing damage by floor', () => {
    expect(ALL_PHASE1_BLESSING_IDS).toHaveLength(26);
    expect(CORE_ACTION_BLESSING_IDS).toHaveLength(16);
    expect(SKILL_UPGRADE_BLESSING_IDS).toHaveLength(10);
    expect(TABLE_TECH_BLESSING_IDS).toEqual([
      'table_tech_rocket',
      'table_tech_blank_nova',
      'table_tech_prism_split',
      'table_tech_billiard_master',
    ]);
    expect(DASH_TECH_BLESSING_IDS).toEqual([
      'dash_tidal_ram',
      'dash_venom_wake',
      'dash_flame_shackle',
      'dash_reload_acrobat',
    ]);
    expect(RELOAD_TECH_BLESSING_IDS).toEqual([
      'reload_tediore_chuck',
      'reload_frost_nova',
      'reload_magnet_vortex',
      'reload_repulsor_shock',
    ]);
    expect(BULLET_MOD_BLESSING_IDS).toEqual([
      'bullet_split_bounce',
      'bullet_ricochet_boom',
      'bullet_heavy_pinball',
      'bullet_coop_arc_relay',
    ]);

    expect(BLESSING_LIST).toHaveLength(ALL_BLESSING_IDS.length);
    expect(FLOOR_BUFF_LIST).toHaveLength(ALL_BLESSING_IDS.length);
    expect(Object.keys(FLOOR_BUFFS)).toHaveLength(ALL_BLESSING_IDS.length);

    for (const id of ALL_PHASE1_BLESSING_IDS) {
      const def = BLESSINGS[id];
      expect(def).toBeDefined();
      expect(FLOOR_BUFFS[id]).toEqual(def);
      expect(def.nameVi.length).toBeGreaterThan(3);
      expect(def.nameEn.length).toBeGreaterThan(3);
      expect(def.descriptionVi.length).toBeGreaterThan(10);
      expect(def.descriptionEn.length).toBeGreaterThan(10);
      expect(['table_tech', 'dash_tech', 'reload_tech', 'bullet_mod', 'skill_upgrade']).toContain(
        def.blessingGroup,
      );
      expect(['none', 'burn', 'chill', 'shock', 'poison']).toContain(def.element);
    }

    // Verify scaleBlessingDamage(baseDmg, globalFloor) = Math.round(baseDmg * (1 + 0.22 * (F - 1)))
    expect(scaleBlessingDamage(26, 1)).toBe(26);
    expect(scaleBlessingDamage(26, 2)).toBe(Math.round(26 * 1.22));
    expect(scaleBlessingDamage(26, 3)).toBe(Math.round(26 * 1.44));
    expect(scaleBlessingDamage(60, 1)).toBe(60);
    expect(scaleBlessingDamage(60, 6)).toBe(Math.round(60 * 2.1));
    expect(scaleBlessingDamage(22, 0)).toBe(22);
  });

  it('implements table_tech_rocket: [E] Flip Cover & Wall-Slam/BossStagger launch 2 homing Fire rockets (base 26 DMG); Dash-Kick charges barricade (620 px/s) to explode for base 60 Fire DMG (r=104px)', () => {
    const sim = createCleanArenaSim(7401);
    sim.currentFloor = 3; // M_floor(3) = 1.44
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'P2', 2);
    p1.blessingIds.push('table_tech_rocket');

    const table = sim.spawnProp('moss_table', 360, 352);
    const enemyTarget = sim.spawnEnemy('goblin_shooter', 500, 352, true);
    enemyTarget.hp = 500;
    enemyTarget.maxHp = 500;

    // 1. P1 flips cover -> table stays flipped & spawns 2 homing rockets (base 26 DMG scaled to floor 3)
    p1.x = 332;
    p1.y = 352;
    expect(sim.interactWithNearest(p1)).toBe(true);
    expect(table.coverState).toBe('flipped');
    expect(table.blocksEnemyProjectiles).toBe(true);

    const rockets = sim.projectiles.filter((b) => b.weaponId === 'table_tech_rocket');
    expect(rockets).toHaveLength(2);
    const expectedRocketDmg = scaleBlessingDamage(26, 3);
    for (const r of rockets) {
      expect(r.element).toBe('burn');
      expect(r.damage).toBe(expectedRocketDmg);
      expect(r.ownerId).toBe(p1.id);
    }

    // Advance simulation so the 2 homing rockets strike the target enemy
    const hpBeforeRockets = enemyTarget.hp;
    for (let t = 0; t < 35; t++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(enemyTarget.hp).toBeLessThan(hpBeforeRockets);
    expect(enemyTarget.burnTimer).toBeGreaterThan(0);

    // 2. P2 (without blessing) flips another table -> no rockets spawned
    sim.projectiles.length = 0;
    const tableP2 = sim.spawnProp('moss_table', 360, 420);
    p2.x = 332;
    p2.y = 420;
    expect(sim.interactWithNearest(p2)).toBe(true);
    expect(sim.projectiles.filter((b) => b.weaponId === 'table_tech_rocket')).toHaveLength(0);

    // 3. P1 Dash-Kicks the flipped table -> rocketCharged = true, speed = 620 px/s, explodes on impact (base 60 Fire DMG, r=104px)
    sim.consumeEvents();
    const clusterA = sim.spawnEnemy('goblin_shooter', 460, 352, true);
    clusterA.hp = 600;
    clusterA.maxHp = 600;
    const clusterB = sim.spawnEnemy('goblin_shooter', 495, 390, true);
    clusterB.hp = 600;
    clusterB.maxHp = 600;

    expect(sim.kickProp(table, p1, 0)).toBe(true);
    expect(table.rocketCharged).toBe(true);
    expect(Math.hypot(table.vx ?? 0, table.vy ?? 0)).toBeCloseTo(620, 1);

    for (let t = 0; t < 20; t++) {
      sim.step(SIM_STEP_SEC);
      if (table.hp <= 0) break;
    }
    expect(table.hp).toBe(0);
    const expectedBlastDmg = scaleBlessingDamage(60, 3);
    const events = sim.consumeEvents();
    const rocketBlastEv = events.find(
      (ev) => ev.kind === 'explosion' && ev.sourceDefId === 'table_tech_rocket',
    );
    expect(rocketBlastEv).toBeDefined();
    if (rocketBlastEv && rocketBlastEv.kind === 'explosion') {
      expect(rocketBlastEv.radius).toBe(104);
      expect(rocketBlastEv.damage).toBe(expectedBlastDmg);
    }
    expect(clusterA.hp).toBeLessThan(600);
    expect(clusterB.hp).toBeLessThan(600);

    // 4. Wall-Slam also triggers 2 homing rockets with a 0.6s ICD
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    const slammed = sim.spawnEnemy('goblin_shooter', 500, 368, true);
    slammed.hp = 500;
    slammed.maxHp = 500;
    slammed.lastHitPlayerId = p1.id;
    slammed.kbVx = 360;
    slammed.kbVy = 0;
    sim.map.setTile(18, 11, 'wall');
    sim.map.rebuildSolidBoxes();
    slammed.x = 18 * TILE_SIZE - 14;
    slammed.y = 11 * TILE_SIZE + 16;

    sim.step(SIM_STEP_SEC);
    expect(sim.projectiles.filter((b) => b.weaponId === 'table_tech_rocket')).toHaveLength(2);

    // Immediate second Wall-Slam within 0.6s ICD does not spam extra rockets
    sim.projectiles.length = 0;
    const slammed2 = sim.spawnEnemy('goblin_shooter', 500, 368, true);
    slammed2.hp = 500;
    slammed2.maxHp = 500;
    slammed2.lastHitPlayerId = p1.id;
    slammed2.kbVx = 360;
    slammed2.x = 18 * TILE_SIZE - 14;
    slammed2.y = 11 * TILE_SIZE + 16;
    sim.step(SIM_STEP_SEC);
    expect(sim.projectiles.filter((b) => b.weaponId === 'table_tech_rocket')).toHaveLength(0);
  });

  it('implements table_tech_blank_nova: expands bullet-clearing radius to r=160px and Freezes enemies for 1.5s on [E] Flip Cover, Elite/Boss Wall-Slam, and full bossStaggerAccum', () => {
    const sim = createCleanArenaSim(7402);
    const p1 = sim.player;
    p1.blessingIds.push('table_tech_blank_nova');

    const table = sim.spawnProp('moss_table', 400, 352);
    // Spawn enemy bullets at 135px (inside 160px nova, outside default 56px micro-blank) and 220px (outside)
    const bulletInside = sim.acquireProjectile({
      id: 9101,
      ownerId: 999,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: 400 + 135,
      y: 352,
      vx: -120,
      vy: 0,
      angle: Math.PI,
      radius: 5,
      damage: 1,
      isCrit: false,
      knockback: 0,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 3.0,
      element: 'none',
      amplifiedByShield: false,
    });
    const bulletOutside = sim.acquireProjectile({
      id: 9102,
      ownerId: 999,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: 400 + 220,
      y: 352,
      vx: -120,
      vy: 0,
      angle: Math.PI,
      radius: 5,
      damage: 1,
      isCrit: false,
      knockback: 0,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 3.0,
      element: 'none',
      amplifiedByShield: false,
    });
    sim.projectiles.push(bulletInside, bulletOutside);

    const enemyNear = sim.spawnEnemy('goblin_shooter', 400 + 145, 352, true);
    const enemyFar = sim.spawnEnemy('goblin_shooter', 400 + 230, 352, true);

    p1.x = 370;
    p1.y = 352;
    expect(sim.interactWithNearest(p1)).toBe(true);

    expect(sim.projectiles.some((b) => b.id === 9101)).toBe(false);
    expect(sim.projectiles.some((b) => b.id === 9102)).toBe(true);
    expect(enemyNear.frozenTimer).toBeGreaterThanOrEqual(1.5);
    expect(enemyFar.frozenTimer).toBe(0);

    // Also triggers on Elite/Boss Wall-Slam and full bossStaggerAccum
    enemyNear.frozenTimer = 0;
    const boss = sim.spawnEnemy('spore_king', 400, 352, true);
    boss.lastHitPlayerId = p1.id;
    boss.bossStaggerAccum = 100;
    const bulletNearBoss = sim.acquireProjectile({
      id: 9103,
      ownerId: boss.id,
      team: 'enemy',
      weaponId: 'spore_shot',
      x: 400 + 120,
      y: 352,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: 6,
      damage: 1,
      isCrit: false,
      knockback: 0,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 3.0,
      element: 'none',
      amplifiedByShield: false,
    });
    sim.projectiles.push(bulletNearBoss);

    expect(triggerBossStaggerBurst(sim, boss, p1.id)).toBe(true);
    expect(boss.bossStaggerAccum).toBe(0);
    expect(sim.projectiles.some((b) => b.id === 9103)).toBe(false);
    expect(enemyNear.frozenTimer).toBeGreaterThanOrEqual(1.5);
  });

  it('implements table_tech_prism_split: splits splitGeneration===0 player/ally bullets into 2 shock rays (±12°, +20% DMG, DYNAMIC_BOUNCE, replacedProjectileId) and enforces One-Split Rule on splitGeneration===1', () => {
    const sim = createCleanArenaSim(7403);
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Ally P2', 2);
    p1.blessingIds.push('table_tech_prism_split');

    const prismTable1 = sim.spawnProp('moss_table', 420, 352);
    p1.x = 390;
    p1.y = 352;
    expect(sim.interactWithNearest(p1)).toBe(true);
    expect(prismTable1.flippedByPlayerId).toBe(p1.id);
    expect(prismTable1.prismAuraActive).toBe(true);

    const prismTable2 = sim.spawnProp('moss_table', 560, 352);
    p1.x = 530;
    p1.y = 352;
    expect(sim.interactWithNearest(p1)).toBe(true);
    expect(prismTable2.prismAuraActive).toBe(true);

    // Ally P2 fires a single bullet (splitGeneration = 0, damage = 20) through prismTable1
    sim.consumeEvents();
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: p2.id,
      team: 'player',
      weaponId: 'hunter_crossbow',
      x: 395,
      y: 352,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 600,
      damage: 20,
      radius: 5,
      knockback: 120,
      pierceCount: 1,
      bounceCount: 1,
      ttlSec: 1.5,
      element: 'none',
      critChance: 0,
      amplifiedByShield: false,
      seed: 12345,
      shotFlags: 0,
      flags: 0,
    });
    expect(sim.projectiles).toHaveLength(1);
    const originalId = sim.projectiles[0]!.id;
    expect(sim.projectiles[0]!.splitGeneration).toBe(0);

    // Step until bullet passes through prismTable1 at x=420
    for (let t = 0; t < 5; t++) {
      sim.step(SIM_STEP_SEC);
      if (sim.projectiles.length === 2) break;
    }

    expect(sim.projectiles).toHaveLength(2);
    const [ray1, ray2] = sim.projectiles;
    expect(ray1!.splitGeneration).toBe(1);
    expect(ray2!.splitGeneration).toBe(1);
    expect(ray1!.element).toBe('shock');
    expect(ray2!.element).toBe('shock');
    expect(ray1!.damage).toBe(24); // 20 * 1.2 = 24 (+20% Additive DMG)
    expect(ray2!.damage).toBe(24);
    expect((ray1!.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).toBeTruthy();
    expect((ray2!.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).toBeTruthy();

    const expectedSpreadRad = (12 * Math.PI) / 180;
    const angles = [ray1!.angle, ray2!.angle].sort((a, b) => a - b);
    expect(angles[0]!).toBeCloseTo(-expectedSpreadRad, 3);
    expect(angles[1]!).toBeCloseTo(expectedSpreadRad, 3);

    const events = sim.consumeEvents();
    const splitVolleyEv = events.find(
      (ev) => ev.kind === 'bullet_volley_spawned' && ev.replacedProjectileId === originalId,
    );
    expect(splitVolleyEv).toBeDefined();

    // Now test One-Split Rule: aim a splitGeneration === 1 projectile straight through prismTable2 (x=560)
    sim.projectiles.length = 0;
    const gen1Bullet = sim.acquireProjectile({
      id: 9501,
      ownerId: p1.id,
      team: 'player',
      weaponId: 'hunter_crossbow',
      x: 535,
      y: 352,
      vx: 600,
      vy: 0,
      angle: 0,
      radius: 5,
      damage: 24,
      isCrit: false,
      knockback: 120,
      pierceRemaining: 1,
      bounceRemaining: 3,
      ttlSec: 1.5,
      element: 'none',
      amplifiedByShield: false,
      splitGeneration: 1,
    });
    sim.projectiles.push(gen1Bullet);

    for (let t = 0; t < 5; t++) {
      sim.step(SIM_STEP_SEC);
    }

    // Must NOT split into more projectiles! Instead receives +20% DMG, 'shock', and +1 bounce clamped to MAX_BOUNCE_COUNT (4)
    expect(sim.projectiles).toHaveLength(1);
    expect(sim.projectiles[0]!.id).toBe(9501);
    expect(sim.projectiles[0]!.splitGeneration).toBe(1);
    expect(sim.projectiles[0]!.damage).toBe(Math.round(24 * 1.2));
    expect(sim.projectiles[0]!.element).toBe('shock');
    expect(sim.projectiles[0]!.bounceRemaining).toBe(MAX_BOUNCE_COUNT);

    // Wall-Slam with table_tech_prism_split fires 2 shock prism rays (splitGeneration = 1, base 22 Shock DMG)
    sim.projectiles.length = 0;
    sim.currentFloor = 2;
    const slamTarget = sim.spawnEnemy('goblin_shooter', 700, 352, true);
    slamTarget.hp = 400;
    slamTarget.maxHp = 400;
    slamTarget.lastHitPlayerId = p1.id;
    slamTarget.kbVx = 240;
    sim.map.setTile(23, 11, 'wall');
    sim.map.rebuildSolidBoxes();
    slamTarget.x = 23 * TILE_SIZE - 16;
    slamTarget.y = 11 * TILE_SIZE + 16;

    sim.step(SIM_STEP_SEC);
    const slamRays = sim.projectiles.filter((b) => b.weaponId === 'table_tech_prism_split');
    expect(slamRays).toHaveLength(2);
    for (const sr of slamRays) {
      expect(sr.splitGeneration).toBe(1);
      expect(sr.element).toBe('shock');
      expect(sr.damage).toBe(scaleBlessingDamage(22, 2));
    }
  });

  it('implements table_tech_billiard_master: +35% kick velocity, >= 3 wall bounces on kicked props, +40% Wall-Slam damage, and +1 extra bossStaggerAccum', () => {
    const sim = createCleanArenaSim(7404);
    const p1 = sim.player;
    p1.blessingIds.push('table_tech_billiard_master');

    // 1. Kick velocity +35% and bouncesRemaining >= 3 on barricade, explosive barrel, and sliding ice block
    const table = sim.spawnProp('moss_table', 360, 320);
    p1.x = 330;
    p1.y = 320;
    expect(sim.interactWithNearest(p1)).toBe(true);
    expect(sim.kickProp(table, p1, 0)).toBe(true);
    expect(Math.hypot(table.vx ?? 0, table.vy ?? 0)).toBeCloseTo(520 * 1.35, 1);
    expect(table.bouncesRemaining).toBe(3);

    const barrel = sim.spawnProp('explosive_barrel', 360, 380);
    expect(sim.kickProp(barrel, p1, 0)).toBe(true);
    expect(Math.hypot(barrel.vx ?? 0, barrel.vy ?? 0)).toBeCloseTo(520 * 1.35, 1);
    expect(barrel.bouncesRemaining).toBe(3);

    const iceBlock = sim.spawnProp('sliding_ice_block', 360, 440);
    expect(sim.kickProp(iceBlock, p1, 0)).toBe(true);
    expect(Math.hypot(iceBlock.vx ?? 0, iceBlock.vy ?? 0)).toBeCloseTo(600 * 1.35, 1);
    expect(iceBlock.bouncesRemaining).toBe(3);

    // Verify table bounces off walls 3 times before breaking
    sim.props.length = 0;
    sim.map.setTile(8, 10, 'wall');
    sim.map.setTile(14, 10, 'wall');
    sim.map.rebuildSolidBoxes();
    const bouncingTable = sim.spawnProp('moss_table', 11 * TILE_SIZE + 16, 10 * TILE_SIZE + 16);
    bouncingTable.coverState = 'flipped';
    bouncingTable.hp = 60;
    expect(sim.kickProp(bouncingTable, p1, 0)).toBe(true);
    expect(bouncingTable.bouncesRemaining).toBe(3);

    let observedBounces = 0;
    let lastBouncesRem = bouncingTable.bouncesRemaining ?? 3;
    for (let t = 0; t < 90; t++) {
      sim.step(SIM_STEP_SEC);
      if ((bouncingTable.bouncesRemaining ?? 0) < lastBouncesRem) {
        observedBounces += lastBouncesRem - (bouncingTable.bouncesRemaining ?? 0);
        lastBouncesRem = bouncingTable.bouncesRemaining ?? 0;
      }
      if (bouncingTable.hp <= 0) break;
    }
    expect(observedBounces).toBe(3);
    expect(bouncingTable.hp).toBe(0);

    // 2. +40% Wall-Slam damage and +1 extra bossStaggerAccum
    const enemy = sim.spawnEnemy('goblin_shooter', 14 * TILE_SIZE - 16, 10 * TILE_SIZE + 16, true);
    enemy.hp = 500;
    enemy.maxHp = 500;
    enemy.lastHitDmg = 20;
    enemy.lastHitPlayerId = p1.id;
    enemy.kbVx = 240;

    const baseSlamDmg = computeWallSlamDamage(enemy, sim.currentFloor);
    const expectedBoostedSlamDmg = Math.round(baseSlamDmg * 1.4);

    sim.consumeEvents();
    sim.step(SIM_STEP_SEC);
    const slamEv = sim.consumeEvents().find((ev) => ev.kind === 'wall_slam' && ev.enemyId === enemy.id);
    expect(slamEv).toBeDefined();
    if (slamEv && slamEv.kind === 'wall_slam') {
      expect(slamEv.damage).toBe(expectedBoostedSlamDmg);
    }
    expect(enemy.hp).toBe(500 - expectedBoostedSlamDmg);

    const boss = sim.spawnEnemy('spore_king', 14 * TILE_SIZE - 36, 10 * TILE_SIZE + 16, true);
    boss.bossStaggerAccum = 0;
    boss.lastHitPlayerId = p1.id;
    boss.kbVx = 240;
    sim.step(SIM_STEP_SEC);
    expect(boss.bossStaggerAccum).toBeGreaterThanOrEqual(2);
  });
});
