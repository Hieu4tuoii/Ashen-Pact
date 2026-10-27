import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  SIM_STEP_SEC,
  TILE_SIZE,
  WEAPONS,
  WorldSim,
} from '../src/index.js';

function createBiome3Sim(seed = 7301): WorldSim {
  const sim = new WorldSim({ seed, startInHub: false });
  sim.advanceToBiome(3);
  for (let ty = 2; ty < sim.map.rows - 2; ty++) {
    for (let tx = 2; tx < sim.map.cols - 2; tx++) {
      sim.map.setTile(tx, ty, 'floor');
      sim.map.setSurface(tx, ty, 'none', 0, true);
    }
  }
  sim.map.conveyorDirection = 1;
  sim.map.conveyorCycleTimer = 0;
  sim.map.conveyorWarningTimer = 0;
  sim.map.rebuildSolidBoxes();
  sim.props.length = 0;
  sim.enemies.length = 0;
  sim.projectiles.length = 0;
  sim.pickups.length = 0;
  sim.magmaTrails.length = 0;
  sim.player.x = 8 * TILE_SIZE + 16;
  sim.player.y = 11 * TILE_SIZE + 16;
  sim.consumeEvents();
  return sim;
}

describe('AP2 Phase P1C.3 — Biome 3 Survival Law ("Nhịp Đập Lò Nung") & 3 Interactive Props', () => {
  it('enforces Biome 3 Law: synchronous 8.0s conveyor reversal cycle with 1.2s warning timer, +15% HEAT_VENT heat gain, and r=110px Tactical Vent [R]', () => {
    const sim = createBiome3Sim(7301);
    sim.map.fillSurfaceRect(6, 6, 12, 3, 'conveyor');
    expect(sim.map.conveyorDirection).toBe(1);
    expect(sim.map.conveyorWarningTimer).toBe(0);

    // Advance 7.0s (420 ticks): inside the [6.8s, 8.0s) 1.2s warning window before reversal
    for (let t = 0; t < 420; t++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.map.conveyorDirection).toBe(1);
    expect(sim.map.conveyorWarningTimer).toBeGreaterThan(0.8);
    expect(sim.map.conveyorWarningTimer).toBeLessThanOrEqual(1.2);

    // Advance another 1.1s (66 ticks -> 8.1s total): conveyor reverses to -1 and warning resets to 0
    for (let t = 0; t < 66; t++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.map.conveyorDirection).toBe(-1);
    expect(sim.map.conveyorWarningTimer).toBe(0);

    // Verify HEAT_VENT weapon gains +15% heat per shot in Biome 3
    sim.player.weaponSlots = ['apprentice_staff'];
    sim.player.activeWeaponSlot = 0;
    sim.player.weaponHeat = 0;
    sim.player.fireCooldownTimer = 0;
    const baseHeatPerShot = WEAPONS['apprentice_staff']!.heatPerShot;
    sim.tryFireActiveWeapon(sim.player);
    expect(sim.player.weaponHeat).toBeCloseTo(baseHeatPerShot * 1.15, 2);

    // Verify Tactical Vent [R] in Biome 3 clears enemy projectiles up to r = 110px (1.5x wider)
    sim.player.weaponHeat = 75; // Orange zone (65..95)
    sim.player.overheatLockTimer = 0;
    sim.projectiles.length = 0;
    // Spawn an enemy projectile at distance 102px from player (> 56px default, <= 110px Biome 3 radius)
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      eventId: sim.nextVolleyEventId++,
      ownerId: 999,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: sim.player.x + 102,
      y: sim.player.y,
      angle: Math.PI,
      pelletCount: 1,
      spreadRad: 0,
      speed: 10,
      damage: 10,
      critChance: 0,
      knockback: 0,
      radius: 5,
      ttlSec: 3.0,
      pierceCount: 0,
      bounceCount: 0,
      element: 'none',
      seed: 301,
    });
    expect(sim.projectiles.filter((b) => b.team === 'enemy' && b.ttlSec > 0).length).toBe(1);

    sim.setPlayerInput({
      seq: 10,
      tick: sim.tick + 1,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.RELOAD_VENT,
      weaponSlotSelect: null,
    });
    sim.step(SIM_STEP_SEC);

    expect(sim.player.weaponHeat).toBe(0);
    expect(sim.projectiles.filter((b) => b.team === 'enemy' && b.ttlSec > 0).length).toBe(0);
  });

  it('implements forge_blast_shield: [E] flips to 85 HP shield; Dash-Kick projects an 88px-wide Fire Wave burning enemies and igniting oil', () => {
    const sim = createBiome3Sim(7302);
    const shield = sim.spawnProp('forge_blast_shield', 320, 352);
    sim.player.x = 290;
    sim.player.y = 352;
    expect(sim.interactWithNearest(sim.player)).toBe(true);
    expect(shield.coverState).toBe('flipped');
    expect(shield.hp).toBe(85);
    expect(shield.maxHp).toBe(85);

    // Place an enemy 38px off-center from the slide axis (within the 88px-wide wave: halfWidth = 44px, outside shield.radius = 18px!)
    const flankEnemy = sim.spawnEnemy('goblin_shooter', 420, 352 + 38, true);
    flankEnemy.hp = 400;
    flankEnemy.maxHp = 400;

    // Place an oil patch along the slide corridor
    sim.map.setSurface(13, 11, 'oil', 0, true);

    sim.kickProp(shield, sim.player, 0);
    for (let t = 0; t < 18; t++) {
      sim.step(SIM_STEP_SEC);
    }

    expect(flankEnemy.hp).toBeLessThan(400);
    expect(flankEnemy.burnTimer).toBeGreaterThan(0);
    expect(sim.map.getSurface(13, 11)).toBe('burning_oil');
  });

  it('implements pneumatic_press: 0.35s windup on prop/enemy/Boss entering sensor, crushes enemies + breaks Boss armor (4.0s cooldown), and pushes player out with 0 damage', () => {
    const sim = createBiome3Sim(7303);
    const press = sim.spawnProp('pneumatic_press', 480, 352);

    const fodder = sim.spawnEnemy('goblin_shooter', 495, 352, true);
    fodder.hp = 500;
    fodder.maxHp = 500;

    const boss = sim.spawnEnemy('forge_titan', 465, 352, true);
    boss.isBoss = true;
    boss.hp = 4000;
    boss.maxHp = 4000;
    boss.shieldArmor = 300;
    boss.maxShieldArmor = 300;
    boss.bossStaggerAccum = 0;

    // Put player right inside the press crush zone to verify 0 player damage + safe push-out
    sim.player.x = 475;
    sim.player.y = 365;
    const playerHpBefore = sim.player.hp;
    const playerArmorBefore = sim.player.armor;

    // Step 1 tick: sensor detects enemy/Boss and enters 'windup' (0.35s)
    sim.step(SIM_STEP_SEC);
    expect(press.pressState).toBe('windup');

    // Step 25 ticks (~0.42s > 0.35s): press slams down and enters 4.0s cooldown
    for (let t = 0; t < 25; t++) {
      sim.step(SIM_STEP_SEC);
    }

    expect(press.pressState).toBe('cooldown');
    expect(press.pressTimer).toBeGreaterThan(3.5);
    expect(fodder.hp).toBeLessThan(500);
    expect(boss.hp).toBeLessThan(4000);
    expect(boss.shieldArmor).toBe(0);
    expect(boss.bossStaggerAccum).toBeGreaterThanOrEqual(1);

    // Player took 0 damage and was pushed safely outside the crush zone
    expect(sim.player.hp).toBe(playerHpBefore);
    expect(sim.player.armor).toBe(playerArmorBefore);
    expect(Math.hypot(sim.player.x - press.x, sim.player.y - press.y)).toBeGreaterThanOrEqual(65);
  });

  it('implements slag_crucible: spills a 192px-long Molten Lava Carpet when Dash-Kicked or shot to 0 HP, burning a row of enemies', () => {
    const sim = createBiome3Sim(7304);
    const crucible = sim.spawnProp('slag_crucible', 320, 352);

    const rowEnemy1 = sim.spawnEnemy('goblin_shooter', 380, 352, true);
    rowEnemy1.hp = 400;
    rowEnemy1.maxHp = 400;

    const rowEnemy2 = sim.spawnEnemy('goblin_shooter', 480, 352, true);
    rowEnemy2.hp = 400;
    rowEnemy2.maxHp = 400;

    // Shoot / destroy crucible along +X (fallAngle = 0)
    crucible.fallAngle = 0;
    sim.damageProp(crucible, 999, 'none');

    expect(crucible.hp).toBe(0);
    expect(rowEnemy1.hp).toBeLessThan(400);
    expect(rowEnemy1.burnTimer).toBeGreaterThan(0);
    expect(rowEnemy2.hp).toBeLessThan(400);
    expect(rowEnemy2.burnTimer).toBeGreaterThan(0);

    // Verify lava tiles were spilled along the 192px corridor (+X from x=320 to x=512)
    let lavaTileCount = 0;
    for (let tx = 10; tx <= 16; tx++) {
      if (sim.map.getSurface(tx, 11) === 'lava') {
        lavaTileCount += 1;
      }
    }
    expect(lavaTileCount).toBeGreaterThanOrEqual(4);
  });
});
