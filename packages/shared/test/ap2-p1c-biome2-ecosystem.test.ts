import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  MAX_TACTICAL_PROPS_PER_ROOM,
  SHOT_FLAG,
  SIM_STEP_SEC,
  TILE_SIZE,
  WorldSim,
} from '../src/index.js';

function createBiome2Sim(seed = 7201): WorldSim {
  const sim = new WorldSim({ seed, startInHub: false });
  sim.advanceToBiome(2);
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
  sim.consumeEvents();
  return sim;
}

describe('AP2 Phase P1C.2 — Biome 2 Survival Law ("Quán Tính Băng Vĩnh Cửu") & 3 Interactive Props', () => {
  it('enforces Biome 2 Law: +50% knockback & sliding prop speed on ice surface, and Wall-Slam pulses r=64px Chill stack', () => {
    const sim = createBiome2Sim(7201);

    // 1. Compare enemy knockback on normal floor vs 'ice' surface (+50%)
    const enemyFloor = sim.spawnEnemy('goblin_shooter', 320, 220, true);
    enemyFloor.hp = 500;
    enemyFloor.maxHp = 500;
    sim.applyDamageToEnemy(enemyFloor, 20, false, 'none', 0, 120);
    const kbFloor = enemyFloor.kbVx;

    sim.map.fillSurfaceRect(8, 10, 8, 4, 'ice');
    const enemyIce = sim.spawnEnemy('goblin_shooter', 10 * TILE_SIZE + 16, 11 * TILE_SIZE + 16, true);
    enemyIce.hp = 500;
    enemyIce.maxHp = 500;
    sim.applyDamageToEnemy(enemyIce, 20, false, 'none', 0, 120);
    const kbIce = enemyIce.kbVx;

    expect(kbIce).toBeCloseTo(kbFloor * 1.5, 2);

    // 2. Sliding prop speed on 'ice' increases by +50% (520 -> 780 px/s for moss_table / glacial_barricade)
    const blockOnIce = sim.spawnProp('sliding_ice_block', 11 * TILE_SIZE + 16, 11 * TILE_SIZE + 16);
    sim.kickProp(blockOnIce, sim.player, 0);
    expect(Math.hypot(blockOnIce.vx ?? 0, blockOnIce.vy ?? 0)).toBeCloseTo(600 * 1.5, 1);

    // 3. Wall-Slam in Biome 2 pulses r = 64px applying 1 stack of Chill to nearby enemies
    sim.enemies.length = 0;
    sim.props.length = 0;
    sim.map.setTile(16, 11, 'wall');
    sim.map.rebuildSolidBoxes();

    const slammedEnemy = sim.spawnEnemy('goblin_shooter', 16 * TILE_SIZE - 14, 11 * TILE_SIZE + 16, true);
    slammedEnemy.hp = 400;
    slammedEnemy.maxHp = 400;
    slammedEnemy.kbVx = 220;
    slammedEnemy.kbVy = 0;

    const bystanderNear = sim.spawnEnemy('goblin_shooter', 16 * TILE_SIZE - 52, 11 * TILE_SIZE + 16, true);
    bystanderNear.hp = 400;
    bystanderNear.maxHp = 400;

    const bystanderFar = sim.spawnEnemy('goblin_shooter', 16 * TILE_SIZE - 160, 11 * TILE_SIZE + 16, true);
    bystanderFar.hp = 400;
    bystanderFar.maxHp = 400;

    sim.step(SIM_STEP_SEC);

    expect(bystanderNear.chillStacks).toBeGreaterThanOrEqual(1);
    expect(bystanderNear.chillTimer).toBeGreaterThan(0);
    expect(bystanderFar.chillStacks).toBe(0);
  });

  it('implements glacial_barricade: [E] flips to 65 HP cover; Dash-Kick into enemy/wall shatters into 3 glacial_spike pillars (4.0s TTL, Freeze 1.5s + Dmg_Hazard, <= MAX_TACTICAL_PROPS_PER_ROOM)', () => {
    const sim = createBiome2Sim(7202);
    const barricade = sim.spawnProp('glacial_barricade', 360, 320);
    expect(barricade.coverState).toBe('low');

    sim.player.x = 330;
    sim.player.y = 320;
    const flipped = sim.interactWithNearest(sim.player);
    expect(flipped).toBe(true);
    expect(barricade.coverState).toBe('flipped');
    expect(barricade.hp).toBe(65);
    expect(barricade.maxHp).toBe(65);
    expect(barricade.blocksEnemyProjectiles).toBe(true);

    // Place an enemy at (460, 320) and Dash-Kick the glacial_barricade into it
    const target = sim.spawnEnemy('goblin_shooter', 460, 320, true);
    target.hp = 500;
    target.maxHp = 500;
    const hpBefore = target.hp;

    sim.kickProp(barricade, sim.player, 0);
    expect(barricade.coverState).toBe('sliding');

    for (let t = 0; t < 20; t++) {
      sim.step(SIM_STEP_SEC);
      if (barricade.hp <= 0) break;
    }

    // Barricade shattered on impact, dealt Dmg_Hazard, froze target for 1.5s, and spawned 3 glacial_spike props
    expect(barricade.hp).toBe(0);
    expect(target.hp).toBeLessThan(hpBefore);
    expect(target.frozenTimer).toBeGreaterThanOrEqual(1.3);

    const spikes = sim.props.filter((p) => p.kind === 'glacial_spike' && p.hp > 0);
    expect(spikes.length).toBe(3);
    for (const sp of spikes) {
      expect(sp.blocksMovement).toBe(true);
      expect(sp.blocksEnemyProjectiles).toBe(true);
      expect(sp.ttlSec).toBeGreaterThan(3.5);
    }
    expect(sim.props.length).toBeLessThanOrEqual(MAX_TACTICAL_PROPS_PER_ROOM);

    // Advance 4.1s: glacial_spike pillars expire automatically
    for (let t = 0; t < 250; t++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.props.filter((p) => p.kind === 'glacial_spike' && p.hp > 0).length).toBe(0);
  });

  it('implements sliding_ice_block: launches at 600 px/s, bounces 1 time off a wall like a billiard ball, and knocks back a line of enemies', () => {
    const sim = createBiome2Sim(7203);
    // Place a solid wall at tx = 18, ty = 10 (x = 576..608)
    sim.map.setTile(18, 10, 'wall');
    sim.map.rebuildSolidBoxes();

    const iceBlock = sim.spawnProp('sliding_ice_block', 480, 10 * TILE_SIZE + 16);
    expect(iceBlock.bouncesRemaining).toBe(1);

    const enemy1 = sim.spawnEnemy('goblin_shooter', 525, 10 * TILE_SIZE + 16, true);
    enemy1.hp = 400;
    enemy1.maxHp = 400;

    // Kick right (+X) at 600 px/s toward enemy1 and wall at tx = 18
    sim.kickProp(iceBlock, sim.player, 0);
    expect(Math.hypot(iceBlock.vx ?? 0, iceBlock.vy ?? 0)).toBeCloseTo(600, 1);

    let bouncedLeft = false;
    for (let t = 0; t < 30; t++) {
      sim.step(SIM_STEP_SEC);
      if ((iceBlock.vx ?? 0) < 0 && iceBlock.hp > 0) {
        bouncedLeft = true;
        break;
      }
    }

    expect(enemy1.hp).toBeLessThan(400);
    expect(enemy1.stunTimer).toBeGreaterThan(0.5);
    expect(bouncedLeft).toBe(true);
    expect(iceBlock.bouncesRemaining).toBe(0);
  });

  it('implements cryo_prism_pillar: refracts splitGeneration=0 player bullet into 3 Chill fan rays (+20% DMG, DYNAMIC_BOUNCE) toward densest enemy cluster, and caps splitGeneration=1 without re-splitting', () => {
    const sim = createBiome2Sim(7204);
    const prism = sim.spawnProp('cryo_prism_pillar', 420, 320);

    // Dense enemy cluster of 3 enemies to the North-East of the prism (around 560, 200)
    const c1 = sim.spawnEnemy('goblin_shooter', 560, 200, true);
    const c2 = sim.spawnEnemy('goblin_shooter', 580, 210, true);
    const c3 = sim.spawnEnemy('goblin_shooter', 550, 190, true);
    // Lone enemy to the South (420, 480)
    sim.spawnEnemy('goblin_shooter', 420, 480, true);

    const expectedClusterAngle = Math.atan2(c1.y - prism.y, c1.x - prism.x);

    // Fire a splitGeneration = 0 player projectile into the prism along +X (angle = 0)
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      eventId: sim.nextVolleyEventId++,
      ownerId: sim.player.id,
      team: 'player',
      weaponId: 'hunter_crossbow',
      x: 370,
      y: 320,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 600,
      damage: 50,
      critChance: 0,
      knockback: 40,
      radius: 5,
      ttlSec: 1.5,
      pierceCount: 1,
      bounceCount: 0,
      element: 'none',
      seed: 1001,
    });

    for (let t = 0; t < 12; t++) {
      sim.step(SIM_STEP_SEC);
      if (sim.projectiles.length >= 3) break;
    }

    expect(sim.projectiles.length).toBe(3);
    for (const ray of sim.projectiles) {
      expect(ray.splitGeneration).toBe(1);
      expect(ray.element).toBe('chill');
      expect(ray.damage).toBe(60); // 50 * 1.20 (+20% Additive DMG)
      expect((ray.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).not.toBe(0);
    }

    // Middle ray should be aimed toward the NE enemy cluster
    const angles = sim.projectiles.map((p) => p.angle).sort((a, b) => a - b);
    expect(angles[1]!).toBeCloseTo(expectedClusterAngle, 1);

    // Now test anti-infinite-split rule: a splitGeneration = 1 projectile hitting a second prism must NOT split into 3 more rays!
    const prism2 = sim.spawnProp('cryo_prism_pillar', 480, 320);
    sim.projectiles.length = 0;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      eventId: sim.nextVolleyEventId++,
      ownerId: sim.player.id,
      team: 'player',
      weaponId: 'hunter_crossbow',
      x: 445,
      y: 320,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 600,
      damage: 60,
      critChance: 0,
      knockback: 40,
      radius: 5,
      ttlSec: 1.5,
      pierceCount: 1,
      bounceCount: 1,
      element: 'chill',
      seed: 1002,
    });
    const gen1Bullet = sim.projectiles[0]!;
    gen1Bullet.splitGeneration = 1;
    gen1Bullet.hitEntityIds.push(prism.id);

    for (let t = 0; t < 10; t++) {
      sim.step(SIM_STEP_SEC);
      if (gen1Bullet.hitEntityIds.includes(prism2.id)) break;
    }

    // Still only 1 projectile, with damage boosted +20% (72) and bounceRemaining incremented (2 <= 4)
    expect(sim.projectiles.length).toBe(1);
    expect(gen1Bullet.damage).toBe(72);
    expect(gen1Bullet.bounceRemaining).toBe(2);

    // Also verify a critical projectile (isCrit = true) refracting through prism does NOT double-multiply 1.5x crit damage
    const prism3 = sim.spawnProp('cryo_prism_pillar', 520, 420);
    sim.projectiles.length = 0;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      eventId: sim.nextVolleyEventId++,
      ownerId: sim.player.id,
      team: 'player',
      weaponId: 'hunter_crossbow',
      x: 485,
      y: 420,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 600,
      damage: 100,
      critChance: 1, // 100 * 1.5 = 150 crit damage
      knockback: 40,
      radius: 5,
      ttlSec: 1.5,
      pierceCount: 1,
      bounceCount: 0,
      element: 'none',
      seed: 1003,
    });
    expect(sim.projectiles[0]!.damage).toBe(100);
    expect(sim.projectiles[0]!.isCrit).toBe(true);
    for (let t = 0; t < 10; t++) {
      sim.step(SIM_STEP_SEC);
      if (sim.projectiles.length >= 3) break;
    }
    expect(sim.projectiles.length).toBe(3);
    for (const r of sim.projectiles) {
      expect(r.isCrit).toBe(true);
      expect(r.damage).toBe(120); // 100 * 1.20 (+20%), preserving isCrit
    }
    void prism3;
  });
});
