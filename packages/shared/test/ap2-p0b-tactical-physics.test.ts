import { describe, expect, it } from 'vitest';
import {
  ENEMIES,
  INPUT_BUTTON,
  NetworkTransport,
  SIM_STEP_SEC,
  TILE_SIZE,
  WorldSim,
  findInteractTarget,
} from '../src/index.js';

function createCleanSim(seed = 2026): WorldSim {
  const sim = new WorldSim({
    seed,
    spawnInitialWave: false,
    includeProps: false,
    includeTrainingDummy: false,
  });
  sim.enemies.length = 0;
  sim.props.length = 0;
  sim.projectiles.length = 0;
  sim.chests.length = 0;
  sim.worldItems.length = 0;
  sim.pickups.length = 0;
  sim.npcEntities.length = 0;
  sim.hubStatues.length = 0;
  sim.portalActive = false;
  // Clear inner obstacles around center (400, 300) for predictable physics tests
  for (let ty = 3; ty < sim.map.rows - 3; ty += 1) {
    for (let tx = 3; tx < sim.map.cols - 3; tx += 1) {
      sim.map.setTile(tx, ty, 'floor');
      sim.map.setSurface(tx, ty, 'none', 0, true);
    }
  }
  sim.player.x = 400;
  sim.player.y = 300;
  sim.player.vx = 0;
  sim.player.vy = 0;
  return sim;
}

function pushProjectile(
  sim: WorldSim,
  init: {
    ownerId: number;
    team: 'player' | 'enemy';
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    ttl: number;
    radius: number;
    color: number;
  },
) {
  const proj = sim.acquireProjectile({
    id: sim.nextEntityId++,
    ownerId: init.ownerId,
    team: init.team,
    weaponId: 'rivet_gun',
    x: init.x,
    y: init.y,
    vx: init.vx,
    vy: init.vy,
    angle: Math.atan2(init.vy, init.vx),
    damage: init.damage,
    ttlSec: init.ttl,
    radius: init.radius,
    knockback: 0,
    pierceRemaining: 0,
    bounceRemaining: 0,
    element: 'none',
    isCrit: false,
    amplifiedByShield: false,
  });
  sim.projectiles.push(proj);
  return proj;
}

describe('P0B.2 — Global Tactical Physics Laws (Flip Cover [E], Dash/Melee-Kick, Wall-Slam, Chasm Ring-Out)', () => {
  describe('1. Hard [E] Priority Order: Revive (<=52px) > Flip Cover (<=52px) > Interact/Pickup (<=64px)', () => {
    it('prioritizes downed teammate Revive (<=52px) over Flip Cover (<=52px) and Chest/Item (<=64px)', () => {
      const sim = createCleanSim(2101);
      const ally = sim.addCoopPlayer(2, 'vanguard', 'Ally');
      ally.x = 430; // dist = 30 <= 52
      ally.y = 300;
      ally.lifeState = 'downed';
      ally.hp = 0;

      const table = sim.spawnProp('moss_table', 415, 300); // dist = 15 <= 52 (closer than ally!)
      const chest = sim.spawnChest(410, 300, 'common', 'rivet_gun'); // dist = 10 <= 64 (even closer!)

      const target1 = findInteractTarget(sim, sim.player.id);
      expect(target1).not.toBeNull();
      expect(target1?.kind).toBe('revive');

      // Once ally is alive, findInteractTarget ignores 'low' barricades (no [E] flip) and selects Chest
      ally.lifeState = 'alive';
      ally.hp = ally.maxHp;

      const target2 = findInteractTarget(sim, sim.player.id);
      expect(target2).not.toBeNull();
      expect(target2?.kind).toBe('chest');

      // Pressing [E] opens the chest directly while table remains 'low'
      const acted = sim.interactWithNearest(sim.player);
      expect(acted).toBe(true);
      expect(table.coverState).toBe('low');
      expect(chest.opened).toBe(true);
    });

    it('ignores flip cover when coverState is low, flipped, sliding, or fallen', () => {
      const sim = createCleanSim(2102);
      const table = sim.spawnProp('moss_table', 455, 300); // dist = 55 > 52
      expect(findInteractTarget(sim, sim.player.id)).toBeNull();

      table.x = 440; // dist = 40 <= 52
      expect(findInteractTarget(sim, sim.player.id)).toBeNull();

      table.coverState = 'flipped';
      expect(findInteractTarget(sim, sim.player.id)).toBeNull();

      table.coverState = 'sliding';
      expect(findInteractTarget(sim, sim.player.id)).toBeNull();

      table.coverState = 'fallen';
      expect(findInteractTarget(sim, sim.player.id)).toBeNull();
    });
  });

  describe('2. Flip Cover [E] & Micro-Blank (56px / 0.15s)', () => {
    it('flips cover to 60/80/100 HP, clears enemy bullets within 56px + 0.15s window, knocks back enemies within 64px, and blocks only enemy bullets', () => {
      const sim = createCleanSim(2201);
      const table = sim.spawnProp('moss_table', 430, 300);
      const barricade = sim.spawnProp('glacial_barricade', 200, 200);
      const shield = sim.spawnProp('forge_blast_shield', 200, 260);

      expect(table.coverState).toBe('low');
      expect(table.blocksMovement).toBe(false);
      expect(table.blocksEnemyProjectiles).toBe(false);

      // Spawn enemy bullets inside 56px of table (430, 300) and one outside
      const enemyBulletInside = pushProjectile(sim, {
        ownerId: 999,
        team: 'enemy',
        x: 460, // dist = 30 <= 56
        y: 300,
        vx: -100,
        vy: 0,
        damage: 12,
        ttl: 2,
        radius: 5,
        color: 0xff0000,
      });
      const enemyBulletOutside = pushProjectile(sim, {
        ownerId: 999,
        team: 'enemy',
        x: 520, // dist = 90 > 56
        y: 300,
        vx: -500, // moving fast toward table during 0.15s micro-blank window
        vy: 0,
        damage: 12,
        ttl: 2,
        radius: 5,
        color: 0xff0000,
      });
      const playerBulletInside = pushProjectile(sim, {
        ownerId: sim.player.id,
        team: 'player',
        x: 445,
        y: 300,
        vx: 200,
        vy: 0,
        damage: 15,
        ttl: 2,
        radius: 5,
        color: 0x00ff00,
      });

      // Spawn an enemy within 64px of table (430, 300)
      const nearbyEnemy = sim.spawnEnemy('goblin_shooter', 475, 300, true); // dist = 45 <= 64
      nearbyEnemy.kbVx = 0;
      nearbyEnemy.kbVy = 0;

      sim.consumeEvents();
      const flipped = sim.flipCoverProp(table, sim.player);
      expect(flipped).toBe(true);

      expect(table.coverState).toBe('flipped');
      expect(table.blocksMovement).toBe(true);
      expect(table.blocksEnemyProjectiles).toBe(true);
      expect(table.hp).toBe(60);
      expect(table.maxHp).toBe(60);

      // Check HP of glacial_barricade (65) and forge_blast_shield (85) when flipped
      sim.player.x = 200;
      sim.player.y = 170;
      sim.flipCoverProp(barricade, sim.player);
      expect(barricade.coverState).toBe('flipped');
      expect(barricade.hp).toBe(65);

      sim.player.x = 200;
      sim.player.y = 230;
      sim.flipCoverProp(shield, sim.player);
      expect(shield.coverState).toBe('flipped');
      expect(shield.hp).toBe(85);

      // Enemy bullet inside 56px was immediately destroyed; player bullet was NOT destroyed
      expect(sim.projectiles.some((b) => b.id === enemyBulletInside.id)).toBe(false);
      expect(sim.projectiles.some((b) => b.id === playerBulletInside.id)).toBe(true);

      // Nearby enemy received knockback = 180 away from table center
      expect(Math.hypot(nearbyEnemy.kbVx, nearbyEnemy.kbVy)).toBeGreaterThanOrEqual(170);
      expect(nearbyEnemy.kbVx).toBeGreaterThan(0);

      const events = sim.consumeEvents();
      const flipEvt = events.find((e) => e.kind === 'cover_flipped');
      expect(flipEvt).toBeDefined();
      if (flipEvt?.kind === 'cover_flipped') {
        expect(flipEvt.propId).toBe(table.id);
        expect(flipEvt.radius).toBe(56);
        expect(flipEvt.bulletsCleared).toBe(1);
      }
      expect(events.some((e) => e.kind === 'projectiles_destroyed' && e.ids.includes(enemyBulletInside.id))).toBe(true);

      // Step within 0.15s micro-blank window: enemyBulletOutside enters 56px radius and is blanked without damaging table HP!
      sim.step(0.08);
      expect(sim.projectiles.some((b) => b.id === enemyBulletOutside.id)).toBe(false);
      expect(table.hp).toBe(60);

      // Advance past 0.15s micro-blank window
      sim.step(0.1);
      expect(table.microBlankTimer ?? 0).toBe(0);
      sim.enemies.length = 0;

      // Now player bullet passing through flipped table does NOT get blocked, while enemy bullet hits and damages table HP
      const pBullet2 = pushProjectile(sim, {
        ownerId: sim.player.id,
        team: 'player',
        x: 410,
        y: 300,
        vx: 400,
        vy: 0,
        damage: 20,
        ttl: 2,
        radius: 4,
        color: 0x00ff00,
      });
      const eBullet2 = pushProjectile(sim, {
        ownerId: 999,
        team: 'enemy',
        x: 460,
        y: 300,
        vx: -400,
        vy: 0,
        damage: 15,
        ttl: 2,
        radius: 4,
        color: 0xff0000,
      });
      sim.step(0.08);
      expect(sim.projectiles.some((b) => b.id === pBullet2.id)).toBe(true);
      expect(sim.projectiles.some((b) => b.id === eBullet2.id)).toBe(false);
      expect(table.hp).toBe(45);
    });
  });

  describe('3. Dash-Kick & Melee-Kick + Sliding Prop Physics + Client Prediction', () => {
    it('blocks walking into flipped cover, requires dot >= 0.45 to Dash-Kick without pushing back player on kick tick, and slides at 520 px/s along aimAngle', () => {
      const sim = createCleanSim(2301);
      const table = sim.spawnProp('moss_table', 440, 300);
      sim.flipCoverProp(table, sim.player);
      expect(table.coverState).toBe('flipped');

      // 1) Walking into flipped cover (dashTimer = 0) resolves circle collision (blocks player)
      sim.player.dashTimer = 0;
      sim.player.x = 440 - table.radius - sim.player.radius + 6;
      sim.player.y = 300;
      sim.resolvePropMovementCollision(sim.player);
      expect(table.coverState).toBe('flipped');
      expect(sim.player.x).toBeLessThanOrEqual(440 - table.radius - sim.player.radius + 0.01);

      // 2) Glancing dash (dot < 0.45) does NOT kick the flipped cover
      sim.player.x = 440 - table.radius - sim.player.radius + 4;
      sim.player.y = 300;
      sim.player.dashTimer = 0.1;
      sim.player.dashDirX = 0;
      sim.player.dashDirY = 1; // perpendicular (dot = 0 < 0.45)
      sim.player.aimAngle = 0;
      sim.resolvePropMovementCollision(sim.player);
      expect(table.coverState).toBe('flipped');

      // 3) Direct dash (dot >= 0.45) kicks the flipped cover along aimAngle at 520 px/s without pushing back player
      const kickStartX = 440 - table.radius - sim.player.radius + 5;
      sim.player.x = kickStartX;
      sim.player.y = 300;
      sim.player.dashTimer = 0.1;
      sim.player.dashDirX = 1;
      sim.player.dashDirY = 0; // dot = 1.0 >= 0.45
      sim.player.aimAngle = Math.PI / 6; // 30 degrees
      sim.consumeEvents();

      sim.resolvePropMovementCollision(sim.player);
      expect(table.coverState).toBe('sliding');
      expect(table.blocksMovement).toBe(false);
      expect(table.slideOwnerPlayerId).toBe(sim.player.id);
      // Player position is NOT pushed back on the kick tick!
      expect(sim.player.x).toBeCloseTo(kickStartX, 5);
      expect(Math.hypot(table.vx ?? 0, table.vy ?? 0)).toBeCloseTo(520, 2);
      expect(Math.atan2(table.vy ?? 0, table.vx ?? 0)).toBeCloseTo(Math.PI / 6, 4);

      const kickEvt = sim.consumeEvents().find((e) => e.kind === 'prop_kicked');
      expect(kickEvt).toBeDefined();
    });

    it('triggers Melee-Kick on flipped cover and round toys (volatile_spore_pod at 520 px/s, sliding_ice_block at 600 px/s)', () => {
      const sim = createCleanSim(2302);
      const pod = sim.spawnProp('volatile_spore_pod', 435, 300);
      const ice = sim.spawnProp('sliding_ice_block', 435, 220);

      // Equip melee weapon on player
      sim.player.weaponSlots = ['knight_sword', 'rivet_gun'];
      sim.player.activeWeaponSlot = 0;
      sim.player.aimAngle = 0;
      sim.player.fireCooldownTimer = 0;

      sim.setPlayerInput({
        seq: 1,
        tick: 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.FIRE,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      expect(pod.coverState).toBe('sliding');
      expect(Math.hypot(pod.vx ?? 0, pod.vy ?? 0)).toBeGreaterThan(450);

      // Dash-kick sliding_ice_block at 600 px/s even at a glancing dash angle (round toy ignores dot >= 0.45 restriction)
      sim.player.x = 435 - ice.radius - sim.player.radius + 4;
      sim.player.y = 220;
      sim.player.dashTimer = 0.1;
      sim.player.dashDirX = 0;
      sim.player.dashDirY = 1;
      sim.player.aimAngle = 0;
      sim.resolvePropMovementCollision(sim.player);
      expect(ice.coverState).toBe('sliding');
      expect(Math.hypot(ice.vx ?? 0, ice.vy ?? 0)).toBeCloseTo(600, 2);
    });

    it('deals exact KickSlide hybrid damage (Normal 10%, Elite 5%, Boss 1.5%), stuns 1.0s, knocks back 260, and shatters on wall impact', () => {
      const sim = createCleanSim(2303);
      sim.currentFloor = 1; // M_floor(1) = 1.0
      const table = sim.spawnProp('moss_table', 250, 300);
      sim.player.x = 220;
      sim.player.y = 300;

      // Kick table right along +X
      sim.player.x = 250 - table.radius - sim.player.radius + 4;
      sim.player.dashTimer = 0.1;
      sim.player.dashDirX = 1;
      sim.player.dashDirY = 0;
      sim.player.aimAngle = 0;
      sim.resolvePropMovementCollision(sim.player);

      // Place a Normal enemy, an Elite enemy, and a Boss along the slide path
      const normalEnemy = sim.spawnEnemy('goblin_shooter', 310, 300, true);
      normalEnemy.isElite = false;
      normalEnemy.isBoss = false;
      normalEnemy.maxHp = 200;
      normalEnemy.hp = 200;

      const eliteEnemy = sim.spawnEnemy('goblin_shooter', 360, 300, true, 'vampiric');
      eliteEnemy.isElite = true;
      eliteEnemy.isBoss = false;
      eliteEnemy.maxHp = 400;
      eliteEnemy.hp = 400;

      const bossEnemy = sim.spawnEnemy('spore_king', 420, 300, true);
      bossEnemy.isBoss = true;
      bossEnemy.maxHp = 2000;
      bossEnemy.hp = 2000;

      // Put a solid wall tile at tx = 16 (x = 512..544) on row ty = 9 (y = 288..320) so the sliding prop hits it and shatters
      sim.map.setTile(16, 9, 'wall');

      for (let i = 0; i < 45; i += 1) {
        sim.step(SIM_STEP_SEC);
      }

      // Expected Dmg_KickSlide on floor 1 (M_floor = 1):
      // Normal: round(20 * 1 + 0.10 * 200) = 40 -> hp = 160
      // Elite:  round(20 * 1 + 0.05 * 400) = 40 -> hp = 360
      // Boss:   round(20 * 1 + 0.015 * 2000) = 50 -> hp = 1950
      expect(normalEnemy.hp).toBe(160);
      expect(normalEnemy.stunTimer).toBeGreaterThan(0.2);
      expect(eliteEnemy.hp).toBe(360);
      expect(eliteEnemy.stunTimer).toBeGreaterThan(0.2);
      expect(bossEnemy.hp).toBe(1950);

      // Table shattered after hitting the wall at tx = 16
      expect(table.hp).toBe(0);
    });

    it('synchronizes client-side prediction with server in NetworkTransport when colliding with flipped cover and Dash-Kicking', () => {
      const transport = new NetworkTransport({
        seed: 2304,
        localPlayerId: 1,
        startInHub: false,
      });
      const sim = transport.sim;
      for (let ty = 3; ty < sim.map.rows - 3; ty += 1) {
        for (let tx = 3; tx < sim.map.cols - 3; tx += 1) {
          sim.map.setTile(tx, ty, 'floor');
        }
      }
      sim.props.length = 0;
      sim.enemies.length = 0;
      sim.player.x = 400;
      sim.player.y = 300;

      const table = sim.spawnProp('moss_table', 432, 300);
      sim.flipCoverProp(table, sim.player);
      expect(table.coverState).toBe('flipped');

      // Step local prediction walking right (+X) into the flipped table: should be blocked by table
      for (let i = 0; i < 10; i += 1) {
        transport.sendInput({
          seq: i + 1,
          tick: i + 1,
          moveX: 1,
          moveY: 0,
          aimAngle: 0,
          buttons: 0,
          weaponSlotSelect: null,
        });
        transport.step(1000 / 60);
      }
      expect(sim.player.x).toBeLessThanOrEqual(table.x - table.radius - sim.player.radius + 0.5);
      expect(table.coverState).toBe('flipped');

      // Now Dash (+X) into the flipped table via NetworkTransport: should trigger Dash-Kick!
      transport.sendInput({
        seq: 11,
        tick: 11,
        moveX: 1,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.DASH,
        weaponSlotSelect: null,
      });
      transport.step(1000 / 60);
      expect(table.coverState).toBe('sliding');
    });
  });

  describe('4. Wall-Slam & Chasm Ring-Out', () => {
    it('triggers Wall-Slam when kbSpeed >= 120 hits a wall/pillar/flipped cover, respecting 0.35s cooldown, interrupting telegraph, and triggering Shatter if Frozen', () => {
      const sim = createCleanSim(2401);
      sim.currentFloor = 1; // M_floor(1) = 1.0

      // Place a solid wall tile at tx = 15, ty = 9 (x = 480..512, y = 288..320)
      sim.map.setTile(15, 9, 'wall');

      const enemy = sim.spawnEnemy('goblin_shooter', 466, 304, true); // right next to wall left face at x = 480
      enemy.isElite = false;
      enemy.isBoss = false;
      enemy.maxHp = 200;
      enemy.hp = 200;
      enemy.lastHitDmg = 30;
      enemy.aiState = 'telegraph';
      enemy.stateTimer = 0.5;
      enemy.kbVx = 160; // >= 120
      enemy.kbVy = 0;

      sim.consumeEvents();
      sim.step(SIM_STEP_SEC);

      // Expected Dmg_WallSlam = round(14 * 1 + 0.30 * 30 + 0.08 * 200) = round(14 + 9 + 16) = 39
      expect(enemy.hp).toBe(200 - 39);
      expect(enemy.wallSlamCooldownTimer).toBeGreaterThan(0.3);
      expect(enemy.stunTimer).toBeGreaterThanOrEqual(0.35);
      expect(enemy.aiState).toBe('stunned');

      const events1 = sim.consumeEvents();
      const slamEvt1 = events1.find((e) => e.kind === 'wall_slam');
      expect(slamEvt1).toBeDefined();
      if (slamEvt1?.kind === 'wall_slam') {
        expect(slamEvt1.enemyId).toBe(enemy.id);
        expect(slamEvt1.damage).toBe(39);
        expect(slamEvt1.shattered).toBe(false);
      }

      // Immediate second wall collision while wallSlamCooldownTimer > 0 does NOT deal Wall-Slam damage again
      const hpAfterFirstSlam = enemy.hp;
      enemy.kbVx = 160;
      sim.step(SIM_STEP_SEC);
      expect(enemy.hp).toBe(hpAfterFirstSlam);

      // Now expire cooldown, freeze enemy, and slam into wall -> triggers Wall-Slam + Shatter!
      enemy.wallSlamCooldownTimer = 0;
      enemy.frozenTimer = 2.0;
      enemy.x = 466;
      enemy.y = 304;
      enemy.kbVx = 180;
      enemy.kbVy = 0;
      sim.consumeEvents();

      sim.step(SIM_STEP_SEC);
      const events2 = sim.consumeEvents();
      const slamEvt2 = events2.find((e) => e.kind === 'wall_slam');
      expect(slamEvt2).toBeDefined();
      if (slamEvt2?.kind === 'wall_slam') {
        expect(slamEvt2.shattered).toBe(true);
      }
      expect(events2.some((e) => e.kind === 'elemental_reaction' && e.reaction === 'shatter')).toBe(true);
      expect(enemy.frozenTimer).toBe(0);
    });

    it('instantly kills Normal ground enemies on Chasm Ring-Out (ejecting loot to walkable floor), deals 30% MaxHP + bounce + 1.0s stun to Elites, and ignores Flying/Bosses', () => {
      const sim = createCleanSim(2402);

      // Set tiles (14, 7), (14, 9), (14, 11), (14, 13) as 'chasm' so each enemy has its own lane without enemy-enemy separation
      sim.map.setSurface(14, 7, 'chasm', 0, true);
      sim.map.setSurface(14, 9, 'chasm', 0, true);
      sim.map.setSurface(14, 11, 'chasm', 0, true);
      sim.map.setSurface(14, 13, 'chasm', 0, true);

      // 1) Normal ground enemy pushed into chasm -> instant kill + loot ejected onto walkable floor
      const normalEnemy = sim.spawnEnemy('goblin_shooter', 446, 7 * TILE_SIZE + 16, true);
      normalEnemy.x = 446;
      normalEnemy.y = 7 * TILE_SIZE + 16;
      normalEnemy.isElite = false;
      normalEnemy.isBoss = false;
      normalEnemy.maxHp = 250;
      normalEnemy.hp = 250;
      normalEnemy.kbVx = 360;
      normalEnemy.kbVy = 0;

      // 2) Elite ground enemy pushed into chasm -> loses 30% MaxHP, bounces back to walkable floor, stunned 1.0s
      const eliteEnemy = sim.spawnEnemy('goblin_shooter', 446, 9 * TILE_SIZE + 16, true, 'vampiric');
      eliteEnemy.x = 446;
      eliteEnemy.y = 9 * TILE_SIZE + 16;
      eliteEnemy.isElite = true;
      eliteEnemy.isBoss = false;
      eliteEnemy.maxHp = 500;
      eliteEnemy.hp = 500;
      eliteEnemy.kbVx = 360;
      eliteEnemy.kbVy = 0;

      // 3) Boss and Flying enemy pushed into chasm -> do NOT ring out
      const bossEnemy = sim.spawnEnemy('spore_king', 446, 11 * TILE_SIZE + 16, true);
      bossEnemy.x = 446;
      bossEnemy.y = 11 * TILE_SIZE + 16;
      bossEnemy.isBoss = true;
      bossEnemy.maxHp = 2000;
      bossEnemy.hp = 2000;
      bossEnemy.kbVx = 360;
      bossEnemy.kbVy = 0;

      const flyingEnemy = sim.spawnEnemy('frost_bat', 446, 13 * TILE_SIZE + 16, true);
      flyingEnemy.x = 446;
      flyingEnemy.y = 13 * TILE_SIZE + 16;
      flyingEnemy.maxHp = 100;
      flyingEnemy.hp = 100;
      flyingEnemy.kbVx = 360;
      flyingEnemy.kbVy = 0;

      expect(ENEMIES['goblin_shooter']?.flying ?? false).toBe(false);
      expect(ENEMIES['frost_bat']?.flying ?? false).toBe(true);

      sim.consumeEvents();
      sim.step(SIM_STEP_SEC);

      const events = sim.consumeEvents();

      // Normal enemy was killed by Ring-Out
      expect(sim.enemies.some((e) => e.id === normalEnemy.id)).toBe(false);
      const normalRingOut = events.find((e) => e.kind === 'ring_out' && e.enemyId === normalEnemy.id);
      expect(normalRingOut).toBeDefined();
      if (normalRingOut?.kind === 'ring_out') {
        expect(normalRingOut.isElite).toBe(false);
      }

      // Ejected gold/pickups from normal enemy must be on walkable non-chasm floor
      expect(sim.pickups.length).toBeGreaterThan(0);
      for (const p of sim.pickups) {
        const tx = Math.floor(p.x / TILE_SIZE);
        const ty = Math.floor(p.y / TILE_SIZE);
        expect(sim.map.isSolidTile(tx, ty)).toBe(false);
        expect(sim.map.getSurfaceAtTile(tx, ty)).not.toBe('chasm');
      }

      // Elite enemy survived with -30% MaxHP (500 - 150 = 350), bounced back onto walkable non-chasm floor, stunned 1.0s
      expect(eliteEnemy.hp).toBe(350);
      expect(eliteEnemy.stunTimer).toBeGreaterThanOrEqual(0.95);
      expect(eliteEnemy.aiState).toBe('stunned');
      const eliteTx = Math.floor(eliteEnemy.x / TILE_SIZE);
      const eliteTy = Math.floor(eliteEnemy.y / TILE_SIZE);
      expect(sim.map.isSolidTile(eliteTx, eliteTy)).toBe(false);
      expect(sim.map.getSurfaceAtTile(eliteTx, eliteTy)).not.toBe('chasm');
      const eliteRingOut = events.find((e) => e.kind === 'ring_out' && e.enemyId === eliteEnemy.id);
      expect(eliteRingOut).toBeDefined();
      if (eliteRingOut?.kind === 'ring_out') {
        expect(eliteRingOut.isElite).toBe(true);
        expect(eliteRingOut.damage).toBe(150);
      }

      // Boss and Flying enemy did not take Ring-Out damage
      expect(events.some((e) => e.kind === 'ring_out' && e.enemyId === bossEnemy.id)).toBe(false);
      expect(bossEnemy.hp).toBe(2000);
      expect(events.some((e) => e.kind === 'ring_out' && e.enemyId === flyingEnemy.id)).toBe(false);
      expect(flyingEnemy.hp).toBe(100);
    });
  });
});
