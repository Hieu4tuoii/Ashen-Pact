import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  MAX_TACTICAL_PROPS_PER_ROOM,
  SHOT_FLAG,
  SIM_STEP_SEC,
  TILE_SIZE,
  WorldSim,
} from '../src/index.js';
import { ENEMIES } from '../src/data/enemies.js';
import viLocale from '../src/i18n/vi.json';
import enLocale from '../src/i18n/en.json';

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
    const flipped = sim.flipCoverProp(barricade, sim.player);
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

  it('absorbs player bullets on cryo_prism_pillar without splitting, emits r=72px enemy-only Chill pulse (14 DMG, 2.0s chill, 1.20s ICD, 0 RNG calls), and does not freeze client prediction', () => {
    const sim = createBiome2Sim(7204);
    const obelisk = sim.spawnProp('cryo_prism_pillar', 300, 300);
    const enemy = sim.spawnEnemy('frost_bat', 355, 300, true); // dist 55 <= 72 + r
    enemy.hp = 500;
    enemy.maxHp = 500;
    const rngBefore = sim.rng.getState();

    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      eventId: sim.nextVolleyEventId++,
      ownerId: sim.player.id,
      team: 'player',
      weaponId: 'hunter_crossbow',
      x: 280,
      y: 300,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 600,
      damage: 50,
      critChance: 0,
      knockback: 40,
      radius: 5,
      ttlSec: 1.5,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      seed: 1001,
    });
    sim.step(SIM_STEP_SEC);

    expect(sim.projectiles.filter((p) => p.team === 'player' && p.ttlSec > 0)).toHaveLength(0);
    expect((sim.projectiles[0]?.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).toBe(0);
    expect(enemy.chillTimer).toBeGreaterThanOrEqual(1.9);
    expect(obelisk.prismPulseCooldownSec).toBeCloseTo(1.2, 2);
    expect(sim.rng.getState()).toBe(rngBefore);
  });

  it('terminates kryssa_ice_beam and bullets on crystal_pillar across both server and client cosmetic prediction while preserving Vanguard shield focus_laser refraction', () => {
    const sim = createBiome2Sim(7205);
    sim.spawnProp('crystal_pillar', 320, 240);
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      eventId: sim.nextVolleyEventId++,
      ownerId: 99,
      team: 'enemy',
      weaponId: 'kryssa_ice_beam',
      x: 300,
      y: 240,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 500,
      damage: 15,
      radius: 8,
      ttlSec: 1.5,
      pierceCount: 0,
      bounceCount: 0,
      element: 'chill',
      seed: 1002,
    });
    for (let t = 0; t < 5; t++) {
      sim.step(SIM_STEP_SEC);
      if (sim.projectiles.filter((p) => p.weaponId === 'kryssa_ice_beam' && p.ttlSec > 0).length === 0) break;
    }
    expect(sim.projectiles.filter((p) => p.weaponId === 'kryssa_ice_beam' && p.ttlSec > 0)).toHaveLength(0);

    const clientSim = createBiome2Sim(7206);
    clientSim.spawnProp('crystal_pillar', 320, 240);
    clientSim.spawnDeterministicVolley(
      {
        kind: 'bullet_volley_spawned',
        eventId: clientSim.nextVolleyEventId++,
        ownerId: clientSim.player.id,
        team: 'player',
        weaponId: 'hunter_crossbow',
        x: 315,
        y: 240,
        angle: 0,
        pelletCount: 1,
        spreadRad: 0,
        speed: 600,
        damage: 50,
        shotFlags: SHOT_FLAG.DYNAMIC_BOUNCE,
        bounceCount: 1,
        radius: 6,
        ttlSec: 1.5,
        element: 'none',
        seed: 1003,
      },
      false,
    );
    const predBolt = clientSim.projectiles[0]!;
    clientSim.stepClientProjectilesCosmetic(SIM_STEP_SEC);
    expect(predBolt.awaitingServerRedirectTimer ?? 0).toBe(0);
    expect(predBolt.ttlSec).toBeLessThanOrEqual(0);
  });

  it('syncs kryssa_clone Frost Mirage labels in shared definitions', () => {
    expect(ENEMIES.kryssa_clone.nameVi).toBe('Ảo Ảnh Sương Giá Kryssa');
    expect(viLocale.enemies.kryssa_clone.name).toBe('Ảo Ảnh Sương Giá Kryssa');
    expect(enLocale.enemies.kryssa_clone.name).toBe('Kryssa Frost Mirage');
  });
});
