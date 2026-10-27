import { describe, expect, it } from 'vitest';
import {
  DASH_COOLDOWN_SEC,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  TILE_SIZE,
  WorldSim,
  equipPlayerWeaponSlot,
  scaleBlessingDamage,
  triggerDashFlameShackle,
  triggerDashTidalRamStep,
  triggerReloadVentOrFinisherBlessings,
} from '../src/index.js';

function createCleanArenaSim(seed = 20261028): WorldSim {
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
  sim.skillZones.length = 0;
  sim.player.x = 10 * TILE_SIZE + 16;
  sim.player.y = 11 * TILE_SIZE + 16;
  sim.player.aimAngle = 0;
  sim.consumeEvents();
  return sim;
}

describe('AP2 Phase P1D.2 — Group 2 (Dash Techs) & Group 3 (Reload, Vent & Finisher Techs)', () => {
  it('implements dash_tidal_ram: rams non-boss enemies along dash path (base 20 Ice DMG, KB=280, chill, max 1 hit/enemy/dash) and refunds 60% Dash cooldown on Wall-Slam with 1.2s ICD', () => {
    const sim = createCleanArenaSim(7501);
    sim.currentFloor = 2; // M_floor(2) = 1.22
    const p1 = sim.player;
    p1.blessingIds.push('dash_tidal_ram');

    // Place a wall ahead at tx = 14 so the rammed enemy slams into it
    sim.map.setTile(14, 11, 'wall');
    sim.map.rebuildSolidBoxes();

    p1.x = 10 * TILE_SIZE + 16; // 336
    p1.y = 11 * TILE_SIZE + 16; // 368
    const enemy = sim.spawnEnemy('goblin_shooter', 376, 368, true);
    enemy.hp = 500;
    enemy.maxHp = 500;

    // Trigger Dash eastward (+X) through enemy toward the wall at x = 14 * 32 = 448
    sim.step({
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.DASH,
    });

    const expectedRamDmg = scaleBlessingDamage(20, 2);
    expect(p1.dashHitEnemyIds).toContain(enemy.id);
    expect(enemy.chillTimer).toBeGreaterThan(0);
    expect(enemy.hp).toBeLessThanOrEqual(500 - expectedRamDmg);

    // Step a few ticks while dashing so enemy hits the wall at tx=14 and triggers Wall-Slam
    const hpAfterFirstRam = enemy.hp;
    let wallSlamTriggered = false;
    for (let t = 0; t < 12; t++) {
      sim.step({ moveX: 1, moveY: 0, aimAngle: 0, buttons: 0 });
      const evs = sim.consumeEvents();
      if (evs.some((e) => e.kind === 'wall_slam' && e.enemyId === enemy.id)) {
        wallSlamTriggered = true;
        break;
      }
    }

    expect(wallSlamTriggered).toBe(true);
    // Enemy must only be rammed once during the same dash (only Wall-Slam damage added, not multiple ram ticks)
    expect(enemy.hp).toBeLessThan(hpAfterFirstRam);
    // 60% of DASH_COOLDOWN_SEC (1.85s) refunded -> remaining cooldown should be <= 0.40 * 1.85
    expect(p1.dashCooldownTimer).toBeLessThanOrEqual(DASH_COOLDOWN_SEC * 0.41);
    expect(p1.dashTidalRamIcdTimer).toBeGreaterThan(0);

    // Second Wall-Slam within 1.2s ICD must NOT refund another 60% cooldown
    p1.dashCooldownTimer = DASH_COOLDOWN_SEC;
    const cdBeforeIcdSlam = p1.dashCooldownTimer;
    const enemy2 = sim.spawnEnemy('goblin_shooter', 14 * TILE_SIZE - 16, 368, true);
    enemy2.hp = 500;
    enemy2.maxHp = 500;
    enemy2.lastHitPlayerId = p1.id;
    enemy2.kbVx = 280;
    p1.dashHitEnemyIds = [enemy2.id];
    sim.step(SIM_STEP_SEC);
    expect(p1.dashCooldownTimer).toBeGreaterThan(cdBeforeIcdSlam - 0.15);
    expect(typeof triggerDashTidalRamStep).toBe('function');
  });

  it('implements dash_venom_wake: leaves 3.5s poison_swamp wake along dash and refills 50% clip ammo / vents 40% Heat once per dash when cutting through an enemy or Dash-Kicking a prop', () => {
    const sim = createCleanArenaSim(7502);
    const p1 = sim.player;
    p1.blessingIds.push('dash_venom_wake');
    equipPlayerWeaponSlot(p1, 0, 'rivet_gun'); // clipMax = 6
    p1.clipAmmo = 1;
    p1.reloadDuration = 0.9;
    p1.reloadTimer = 0.7;

    p1.x = 320;
    p1.y = 352;
    const enemy = sim.spawnEnemy('goblin_shooter', 355, 352, true);
    enemy.hp = 400;
    enemy.maxHp = 400;

    // 1. Dash through enemy -> leaves poison_swamp (3.5s) and refills 50% clip (+3 ammo: 1 -> 4), once per dash
    sim.step({
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.DASH,
    });
    for (let t = 0; t < 6; t++) {
      sim.step({ moveX: 1, moveY: 0, aimAngle: 0, buttons: 0 });
    }

    expect(p1.dashVenomWakeTriggeredThisDash).toBe(true);
    expect(p1.clipAmmo).toBe(4); // 1 + ceil(6 * 0.5) = 4
    const startTx = Math.floor(320 / TILE_SIZE);
    const startTy = Math.floor(352 / TILE_SIZE);
    expect(sim.map.getSurface(startTx, startTy)).toBe('poison_swamp');
    expect(sim.map.surfaceTimers[startTy * sim.map.cols + startTx]).toBeGreaterThan(3.0);
    expect(enemy.poisonTimer).toBeGreaterThan(0);

    // Wait for dash to finish and test Dash-Kick prop with HEAT_VENT weapon -> vents 40% Heat
    p1.dashTimer = 0;
    p1.dashCooldownTimer = 0;
    equipPlayerWeaponSlot(p1, 0, 'apprentice_staff');
    p1.weaponHeat = 75;

    const barrel = sim.spawnProp('explosive_barrel', 460, 352);
    p1.x = 430;
    p1.y = 352;
    sim.step({
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.DASH,
    });
    for (let t = 0; t < 5; t++) {
      sim.step({ moveX: 1, moveY: 0, aimAngle: 0, buttons: 0 });
    }

    expect(barrel.coverState).toBe('sliding');
    expect(p1.dashVenomWakeTriggeredThisDash).toBe(true);
    expect(p1.weaponHeat).toBeLessThanOrEqual(35); // 75 - 40 = 35
  });

  it('implements dash_flame_shackle: yanks nearest enemy within 88px during Dash into the nearest wall or flipped barricade for instant Wall-Slam + base 24 Fire DMG', () => {
    const sim = createCleanArenaSim(7503);
    sim.currentFloor = 3; // M_floor(3) = 1.44
    const p1 = sim.player;
    p1.blessingIds.push('dash_flame_shackle');

    // Place a solid wall tile right above the enemy at (tx=12, ty=9)
    sim.map.setTile(12, 9, 'wall');
    sim.map.rebuildSolidBoxes();

    p1.x = 12 * TILE_SIZE - 40;
    p1.y = 11 * TILE_SIZE + 16;
    const target = sim.spawnEnemy('goblin_shooter', 12 * TILE_SIZE + 16, 10 * TILE_SIZE + 24, true);
    target.hp = 600;
    target.maxHp = 600;

    sim.consumeEvents();
    sim.step({
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.DASH,
    });

    const events = sim.consumeEvents();
    const slamEv = events.find((ev) => ev.kind === 'wall_slam' && ev.enemyId === target.id);
    expect(slamEv).toBeDefined();
    expect(target.burnTimer).toBeGreaterThan(0);

    const expectedFireDmg = scaleBlessingDamage(24, 3);
    expect(target.hp).toBeLessThanOrEqual(600 - expectedFireDmg - (slamEv && slamEv.kind === 'wall_slam' ? slamEv.damage : 1));
    expect(typeof triggerDashFlameShackle).toBe('function');

    // Also verify yanking an enemy into a flipped barricade prop when it is the nearest obstacle
    sim.enemies.length = 0;
    const flippedTable = sim.spawnProp('moss_table', 620, 352);
    sim.flipCoverProp(flippedTable, p1);
    const propTarget = sim.spawnEnemy('goblin_shooter', 620, 402, true);
    propTarget.hp = 600;
    propTarget.maxHp = 600;
    p1.x = 580;
    p1.y = 402;
    p1.dashFlameShackleEnemyIds = [];
    sim.consumeEvents();
    expect(triggerDashFlameShackle(sim, p1, p1.x, p1.y)).toBe(true);
    expect(
      sim.consumeEvents().some((ev) => ev.kind === 'wall_slam' && ev.enemyId === propTarget.id),
    ).toBe(true);
  });

  it('implements dash_reload_acrobat: dashing while reloading or at >= 50% Heat advances reload by 40% / cools 35% Heat and expands the next [R] Golden Window to 35%–80%', () => {
    const sim = createCleanArenaSim(7504);
    const p1 = sim.player;
    p1.blessingIds.push('dash_reload_acrobat');
    equipPlayerWeaponSlot(p1, 0, 'rivet_gun');

    // Start reload (duration = 1.0s, timer = 0.90s -> 10% progress)
    p1.clipAmmo = 0;
    p1.reloadDuration = 1.0;
    p1.reloadTimer = 0.9;
    p1.dashCooldownTimer = 0;

    // Dash while reloading -> advances reload by 40% (0.90 - 0.40 = 0.50s) and sets acrobatExpandedWindow = true
    sim.step({
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.DASH,
    });

    expect(p1.acrobatExpandedWindow).toBe(true);
    expect(p1.reloadTimer).toBeLessThanOrEqual(0.51);

    // Test pressing [R] at 76% progress (reloadTimer = 0.24s), which is OUTSIDE default 45%-70% window but INSIDE expanded 35%-80% window!
    p1.reloadDuration = 1.0;
    p1.reloadTimer = 0.24;
    sim.consumeEvents();
    sim.step({
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.RELOAD_VENT,
    });

    const reloadEvs = sim.consumeEvents();
    expect(reloadEvs.some((ev) => ev.kind === 'perfect_reload')).toBe(true);
    expect(p1.clipAmmo).toBe(p1.clipMax);
    expect(p1.overclockedNextShot).toBe(true);
    // Expanded window flag is consumed after pressing [R]
    expect(p1.acrobatExpandedWindow).toBe(false);

    // Now test HEAT_VENT weapon at >= 50% Heat: Dashing cools 35% Heat and expands next vent window to 55%–95%
    p1.dashTimer = 0;
    p1.dashCooldownTimer = 0;
    equipPlayerWeaponSlot(p1, 0, 'apprentice_staff');
    p1.weaponHeat = 60;

    sim.step({
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.DASH,
    });
    expect(p1.weaponHeat).toBeLessThanOrEqual(25); // 60 - 35 = 25
    expect(p1.acrobatExpandedWindow).toBe(true);

    // With acrobatExpandedWindow = true, venting at 58% Heat (below default 65% orange min, inside 55%–95%) succeeds!
    p1.weaponHeat = 58;
    sim.consumeEvents();
    sim.step({
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.RELOAD_VENT,
    });
    expect(sim.consumeEvents().some((ev) => ev.kind === 'tactical_vent')).toBe(true);
    expect(p1.weaponHeat).toBe(0);
    expect(p1.acrobatExpandedWindow).toBe(false);
  });

  it('implements reload_tediore_chuck: hurls exploding magazine toward cursor (520 px/s, r=76px) dealing scaleBlessingDamage(18 + 4 * shotsFired, F) Fire DMG', () => {
    const sim = createCleanArenaSim(7505);
    sim.currentFloor = 2; // M_floor(2) = 1.22
    const p1 = sim.player;
    p1.blessingIds.push('reload_tediore_chuck');
    equipPlayerWeaponSlot(p1, 0, 'rivet_gun'); // clipMax = 6

    // Player fired 5 shots (1 remaining in clip) and is in the Perfect Reload window
    p1.clipMax = 6;
    p1.clipAmmo = 1;
    p1.reloadDuration = 0.9;
    p1.reloadTimer = 0.4; // progress = 55.5% (in 45%..70%)
    p1.x = 320;
    p1.y = 352;
    p1.aimAngle = 0;

    const target = sim.spawnEnemy('goblin_shooter', 430, 352, true);
    target.hp = 600;
    target.maxHp = 600;

    sim.consumeEvents();
    sim.step({
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.RELOAD_VENT,
    });

    const chuckProj = sim.projectiles.find((b) => b.weaponId === 'reload_tediore_chuck');
    expect(chuckProj).toBeDefined();
    const expectedDmg = scaleBlessingDamage(18 + 4 * 5, 2); // 18 + 20 = 38 scaled by floor 2
    expect(chuckProj!.damage).toBe(expectedDmg);
    expect(Math.hypot(chuckProj!.vx, chuckProj!.vy)).toBeCloseTo(520, 1);
    expect(chuckProj!.explosionRadius).toBe(76);
    expect(chuckProj!.element).toBe('burn');
    expect(p1.reloadBlessingIcdTimer).toBeCloseTo(1.5, 1);

    // Step until the chucked magazine hits the enemy and explodes (r = 76px)
    let exploded = false;
    for (let t = 0; t < 20; t++) {
      sim.step(SIM_STEP_SEC);
      const evs = sim.consumeEvents();
      if (evs.some((ev) => ev.kind === 'explosion' && ev.sourceDefId === 'reload_tediore_chuck')) {
        exploded = true;
        break;
      }
    }
    expect(exploded).toBe(true);
    expect(target.hp).toBeLessThanOrEqual(600 - expectedDmg);
    expect(target.burnTimer).toBeGreaterThan(0);
  });

  it('implements reload_frost_nova: pulses r=110px Frost Nova (base 22 Ice DMG), applies 2 Chill stacks, and destroys enemy bullets in r=110px', () => {
    const sim = createCleanArenaSim(7506);
    sim.currentFloor = 3;
    const p1 = sim.player;
    p1.blessingIds.push('reload_frost_nova');
    equipPlayerWeaponSlot(p1, 0, 'rivet_gun');

    p1.x = 400;
    p1.y = 352;
    p1.clipAmmo = 0;
    p1.reloadDuration = 1.0;
    p1.reloadTimer = 0.45; // 55% progress

    const enemyInRange = sim.spawnEnemy('goblin_shooter', 400 + 95, 352, true);
    enemyInRange.hp = 500;
    enemyInRange.maxHp = 500;
    const enemyOutOfRange = sim.spawnEnemy('goblin_shooter', 400 + 160, 352, true);
    enemyOutOfRange.hp = 500;
    enemyOutOfRange.maxHp = 500;

    const enemyBullet = sim.acquireProjectile({
      id: 9601,
      ownerId: enemyInRange.id,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: 400 + 100,
      y: 352,
      vx: -140,
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
    sim.projectiles.push(enemyBullet);

    sim.consumeEvents();
    sim.step({
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.RELOAD_VENT,
    });

    const events = sim.consumeEvents();
    expect(
      events.some((ev) => ev.kind === 'projectiles_destroyed' && ev.ids.includes(9601)),
    ).toBe(true);
    expect(sim.projectiles.some((b) => b.id === 9601)).toBe(false);

    const expectedNovaDmg = scaleBlessingDamage(22, 3);
    expect(enemyInRange.hp).toBe(500 - expectedNovaDmg);
    expect(enemyInRange.chillStacks).toBe(2);
    expect(enemyInRange.chillTimer).toBeGreaterThan(0);
    expect(enemyOutOfRange.hp).toBe(500);
    expect(enemyOutOfRange.chillStacks).toBe(0);
  });

  it('implements reload_magnet_vortex: launches magnetic anchor 140px ahead (r=135px, 0.8s) pulling surrounding enemies together and dealing base 16 Shock DMG', () => {
    const sim = createCleanArenaSim(7507);
    sim.currentFloor = 2;
    const p1 = sim.player;
    p1.blessingIds.push('reload_magnet_vortex');
    equipPlayerWeaponSlot(p1, 0, 'apprentice_staff');

    p1.x = 320;
    p1.y = 352;
    p1.aimAngle = 0;
    p1.weaponHeat = 80; // Orange zone 65..95

    const anchorX = 320 + 140; // 460
    const anchorY = 352;
    const enemyA = sim.spawnEnemy('goblin_shooter', anchorX, anchorY - 95, true);
    enemyA.hp = 500;
    enemyA.maxHp = 500;
    const enemyB = sim.spawnEnemy('goblin_shooter', anchorX + 90, anchorY + 60, true);
    enemyB.hp = 500;
    enemyB.maxHp = 500;

    const initialDistA = Math.hypot(enemyA.x - anchorX, enemyA.y - anchorY);
    const initialDistB = Math.hypot(enemyB.x - anchorX, enemyB.y - anchorY);

    sim.step({
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.RELOAD_VENT,
    });

    const expectedVortexDmg = scaleBlessingDamage(16, 2);
    expect(enemyA.hp).toBeLessThanOrEqual(500 - expectedVortexDmg);
    expect(enemyB.hp).toBeLessThanOrEqual(500 - expectedVortexDmg);
    expect(enemyA.shockTimer).toBeGreaterThan(0);
    expect(enemyB.shockTimer).toBeGreaterThan(0);

    // Step 15 ticks (~0.25s) while the 0.8s vortex pulls enemies toward (anchorX, anchorY)
    for (let t = 0; t < 15; t++) {
      sim.step(SIM_STEP_SEC);
    }

    const afterDistA = Math.hypot(enemyA.x - anchorX, enemyA.y - anchorY);
    const afterDistB = Math.hypot(enemyB.x - anchorX, enemyB.y - anchorY);
    expect(afterDistA).toBeLessThan(initialDistA - 15);
    expect(afterDistB).toBeLessThan(initialDistB - 15);
  });

  it('implements reload_repulsor_shock: unleashes 140° cone (r=165px, base 20 DMG) blasting status-afflicted enemies into walls to trigger Wall-Slam', () => {
    const sim = createCleanArenaSim(7508);
    sim.currentFloor = 2;
    const p1 = sim.player;
    p1.blessingIds.push('reload_repulsor_shock');
    equipPlayerWeaponSlot(p1, 0, 'rivet_gun');

    // Place wall at tx = 15 (x = 480)
    sim.map.setTile(15, 11, 'wall');
    sim.map.rebuildSolidBoxes();

    p1.x = 340;
    p1.y = 368;
    p1.aimAngle = 0;
    p1.clipAmmo = 0;
    p1.reloadDuration = 1.0;
    p1.reloadTimer = 0.45;

    const afflictedEnemy = sim.spawnEnemy('goblin_shooter', 445, 368, true);
    afflictedEnemy.hp = 600;
    afflictedEnemy.maxHp = 600;
    afflictedEnemy.burnTimer = 2.5; // Afflicted by elemental status

    sim.consumeEvents();
    sim.step({
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.RELOAD_VENT,
    });

    let slammed = false;
    for (let t = 0; t < 8; t++) {
      const evs = sim.consumeEvents();
      if (evs.some((ev) => ev.kind === 'wall_slam' && ev.enemyId === afflictedEnemy.id)) {
        slammed = true;
        break;
      }
      sim.step(SIM_STEP_SEC);
    }

    expect(slammed).toBe(true);
    expect(afflictedEnemy.hp).toBeLessThan(600 - scaleBlessingDamage(20, 2));
  });

  it('STRICT HARD PROHIBITION: Group 3 NEVER triggers on 3rd Melee Combo swing into empty air, ONLY triggers when hitting >= 1 living enemy or parrying >= 1 enemy bullet, and enforces 1.5s gun / 2.0s melee ICD', () => {
    const sim = createCleanArenaSim(7509);
    const p1 = sim.player;
    p1.blessingIds.push('reload_tediore_chuck', 'reload_frost_nova');
    equipPlayerWeaponSlot(p1, 0, 'knight_sword');

    p1.x = 350;
    p1.y = 352;
    p1.aimAngle = 0;

    // 1. Swing 3rd Melee Combo step into EMPTY AIR (no enemies hit, no bullets parried)
    p1.meleeComboStep = 2;
    p1.fireCooldownTimer = 0;
    sim.consumeEvents();
    sim.step({
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
    });

    // Must NOT spawn reload_tediore_chuck projectile and must NOT put reloadBlessingIcdTimer on cooldown!
    expect(sim.projectiles.filter((b) => b.weaponId === 'reload_tediore_chuck')).toHaveLength(0);
    expect(p1.reloadBlessingIcdTimer ?? 0).toBe(0);

    // Also verify direct helper call with hitAny=false and bulletsDestroyed=0 returns false
    expect(
      triggerReloadVentOrFinisherBlessings(sim, p1, 'melee_finisher', {
        hitAny: false,
        bulletsDestroyed: 0,
      }),
    ).toBe(false);

    // 2. Swing 3rd Melee Combo step hitting a living enemy -> MUST trigger Group 3 and set 2.0s melee ICD!
    const meleeTarget = sim.spawnEnemy('goblin_shooter', 388, 352, true);
    meleeTarget.hp = 600;
    meleeTarget.maxHp = 600;
    const novaSideTarget = sim.spawnEnemy('goblin_shooter', 350, 352 + 85, true);
    novaSideTarget.hp = 600;
    novaSideTarget.maxHp = 600;

    p1.meleeComboStep = 2;
    p1.fireCooldownTimer = 0;
    sim.step({
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
    });

    const chucksOnHit = sim.projectiles.filter((b) => b.weaponId === 'reload_tediore_chuck');
    expect(chucksOnHit).toHaveLength(1);
    expect(chucksOnHit[0]!.damage).toBe(scaleBlessingDamage(18 + 4 * 4, sim.currentFloor));
    expect(novaSideTarget.chillStacks).toBe(2);
    expect(p1.reloadBlessingIcdTimer).toBeCloseTo(2.0, 1);

    // 3. Another 3rd Melee hit while 2.0s ICD is active must NOT trigger Group 3 again
    sim.projectiles.length = 0;
    p1.meleeComboStep = 2;
    p1.fireCooldownTimer = 0;
    sim.step({
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
    });
    expect(sim.projectiles.filter((b) => b.weaponId === 'reload_tediore_chuck')).toHaveLength(0);

    // 4. After 2.0s ICD expires, 3rd Melee Combo step that ONLY parries an enemy bullet (hitAny=false, bulletsDestroyed > 0) MUST trigger Group 3!
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    p1.reloadBlessingIcdTimer = 0;
    p1.meleeComboStep = 2;
    p1.fireCooldownTimer = 0;

    const incomingBullet = sim.acquireProjectile({
      id: 9701,
      ownerId: 999,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: p1.x + 30,
      y: p1.y,
      vx: -180,
      vy: 0,
      angle: Math.PI,
      radius: 5,
      damage: 1,
      isCrit: false,
      knockback: 0,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 2.0,
      element: 'none',
      amplifiedByShield: false,
    });
    sim.projectiles.push(incomingBullet);

    sim.step({
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
    });

    expect(sim.projectiles.filter((b) => b.weaponId === 'reload_tediore_chuck')).toHaveLength(1);
    expect(p1.reloadBlessingIcdTimer).toBeCloseTo(2.0, 1);
  });
});
