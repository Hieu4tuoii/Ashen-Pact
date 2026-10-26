import { describe, expect, it } from 'vitest';
import {
  ArenaMap,
  INPUT_BUTTON,
  MAX_TACTICAL_PROPS_PER_ROOM,
  PHASE0B_ROOM_ARCHETYPES,
  SIM_STEP_SEC,
  TILE_SIZE,
  WorldSim,
  configureRoomLayout,
} from '../src/index.js';

function createCleanBiome1Sim(seed = 3001): WorldSim {
  const sim = new WorldSim({
    seed,
    biome: 1,
    spawnInitialWave: false,
    includeProps: false,
    includeTrainingDummy: false,
    autoRespawnWaves: false,
  });
  sim.enemies.length = 0;
  sim.props.length = 0;
  sim.projectiles.length = 0;
  sim.chests.length = 0;
  sim.worldItems.length = 0;
  sim.pickups.length = 0;
  sim.npcEntities.length = 0;
  sim.portalActive = false;
  for (let ty = 2; ty < sim.map.rows - 2; ty++) {
    for (let tx = 2; tx < sim.map.cols - 2; tx++) {
      sim.map.setTile(tx, ty, 'floor');
      sim.map.setSurface(tx, ty, 'none', 0, true);
    }
  }
  sim.map.rebuildSolidBoxes();
  sim.player.x = 400;
  sim.player.y = 300;
  sim.player.vx = 0;
  sim.player.vy = 0;
  return sim;
}

describe('AP2 Phase P0B.3 — Biome 1 Survival Law (Thảm Thực Vật Cộng Hưởng) & 3 Tactical Props (moss_table, volatile_spore_pod, rotten_totem_pillar)', () => {
  describe('1. Biome 1 Survival Law: Thảm Thực Vật Cộng Hưởng (Grass Pollen Boost & 320 px/s Chain Fire)', () => {
    it('grants +25% movement speed for 2.0s (pollenSpeedBoostTimer = 2.0) when Dashing or hitting Perfect Reload [R] on grass', () => {
      const sim = createCleanBiome1Sim(3101);
      const p = sim.player;

      // Place a grass patch around (12, 9) -> world (384..480, 288..352)
      sim.map.fillSurfaceRect(11, 8, 8, 4, 'grass');
      p.x = 12 * TILE_SIZE + 16;
      p.y = 9 * TILE_SIZE + 16;
      p.dashCooldownTimer = 0;
      p.dashTimer = 0;

      // 1) Dash on grass triggers pollenSpeedBoostTimer = 2.0
      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick,
        moveX: 1,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.DASH,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);
      expect(p.pollenSpeedBoostTimer).toBeGreaterThan(1.95);
      expect(p.pollenSpeedBoostTimer).toBeLessThanOrEqual(2.0);

      // Wait for dash to finish (~0.25s = 15 ticks), then walk on normal floor while pollenSpeedBoostTimer > 0
      for (let i = 0; i < 16; i++) {
        sim.setPlayerInput({
          seq: 2 + i,
          tick: sim.tick,
          moveX: 1,
          moveY: 0,
          aimAngle: 0,
          buttons: 0,
          weaponSlotSelect: null,
        });
        sim.step(SIM_STEP_SEC);
      }

      // Now dashTimer === 0, pollenSpeedBoostTimer > 1.5s; verify walking speed reaches 1.25 * p.moveSpeed
      expect(p.dashTimer).toBe(0);
      expect(p.pollenSpeedBoostTimer).toBeGreaterThan(1.4);
      for (let i = 0; i < 10; i++) {
        sim.setPlayerInput({
          seq: 30 + i,
          tick: sim.tick,
          moveX: 1,
          moveY: 0,
          aimAngle: 0,
          buttons: 0,
          weaponSlotSelect: null,
        });
        sim.step(SIM_STEP_SEC);
      }
      expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(p.moveSpeed * 1.25, 1);

      // Expire pollenSpeedBoostTimer completely (> 2.0s)
      for (let i = 0; i < 120; i++) {
        sim.setPlayerInput({
          seq: 50 + i,
          tick: sim.tick,
          moveX: 1,
          moveY: 0,
          aimAngle: 0,
          buttons: 0,
          weaponSlotSelect: null,
        });
        sim.step(SIM_STEP_SEC);
      }
      expect(p.pollenSpeedBoostTimer ?? 0).toBe(0);
      expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(p.moveSpeed, 1);

      // 2) Perfect Reload [R] on grass triggers pollenSpeedBoostTimer = 2.0
      p.x = 12 * TILE_SIZE + 16;
      p.y = 9 * TILE_SIZE + 16;
      p.weaponSlots = ['rivet_gun'];
      p.activeWeaponSlot = 0;
      p.clipMax = 6;
      p.clipAmmo = 0;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45; // 55% progress -> inside [45%..70%] Golden Window
      p.reloadLockout = false;
      p.overclockedNextShot = false;

      sim.setPlayerInput({
        seq: 200,
        tick: sim.tick,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      expect(p.reloadTimer).toBe(0);
      expect(p.clipAmmo).toBe(6);
      expect(p.overclockedNextShot).toBe(true);
      expect(p.pollenSpeedBoostTimer).toBeGreaterThan(1.95);
    });

    it('propagates chain fire at 320 px/s (~0.10s per tile) across connected grass and poison_swamp tiles and burns enemies standing on them', () => {
      const sim = createCleanBiome1Sim(3102);

      // Create a 4-tile connected strip at ty = 6:
      // (10, 6) = grass, (11, 6) = grass, (12, 6) = poison_swamp, (13, 6) = poison_swamp
      sim.map.setSurface(10, 6, 'grass', 0, true);
      sim.map.setSurface(11, 6, 'grass', 0, true);
      sim.map.setSurface(12, 6, 'poison_swamp', 0, true);
      sim.map.setSurface(13, 6, 'poison_swamp', 0, true);

      // Place an enemy at the far end of the strip on (13, 6)
      const enemyOnSwamp = sim.spawnEnemy(
        'goblin_shooter',
        13 * TILE_SIZE + 16,
        6 * TILE_SIZE + 16,
        true,
      );
      enemyOnSwamp.rootedTimer = 10; // keep stationary on tile (13, 6)
      expect(enemyOnSwamp.burnTimer).toBe(0);

      // Fire projectile or apply 'burn' element at tile (10, 6)
      sim.applyElementAtWorldPoint(10 * TILE_SIZE + 16, 6 * TILE_SIZE + 16, 'burn', 12);
      expect(sim.map.getSurface(10, 6)).toBe('burning_grass');
      expect(sim.map.getSurface(11, 6)).toBe('grass');

      // At 320 px/s (10 tiles/s = 0.10s = 6 ticks per tile):
      // After 6 ticks (0.10s), tile (11, 6) ignites into 'burning_grass'
      for (let i = 0; i < 6; i++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(sim.map.getSurface(11, 6)).toBe('burning_grass');
      expect(sim.map.getSurface(12, 6)).toBe('poison_swamp');

      // After another 6 ticks (total 0.20s), tile (12, 6) ignites into 'burning_grass'
      for (let i = 0; i < 6; i++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(sim.map.getSurface(12, 6)).toBe('burning_grass');
      expect(sim.map.getSurface(13, 6)).toBe('poison_swamp');

      // After another 6 ticks (total 0.30s), tile (13, 6) ignites into 'burning_grass' and burns enemyOnSwamp!
      for (let i = 0; i < 6; i++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(sim.map.getSurface(13, 6)).toBe('burning_grass');

      // Step 1 more tick so enemy surface check applies burnTimer
      sim.step(SIM_STEP_SEC);
      expect(enemyOnSwamp.burnTimer).toBeGreaterThan(0);
    });
  });

  describe('2. Biome 1 Tactical Prop 1: moss_table (Bàn Đá Rêu Cổ)', () => {
    it('spawns low with 60 HP, flips via [E], and bursts Pollen Armor Restore (+1 Armor within r=72px up to maxArmor) when shot or Dash-Kicked into a wall', () => {
      const sim = createCleanBiome1Sim(3201);
      const p1 = sim.player;
      const p2 = sim.addCoopPlayer(2, 'ranger', 'Near Ally');
      const p3 = sim.addCoopPlayer(3, 'elementalist', 'Far Ally');

      const table1 = sim.spawnProp('moss_table', 400, 300);
      expect(table1.coverState).toBe('low');
      expect(table1.hp).toBe(60);
      expect(table1.maxHp).toBe(60);

      // Flip table1 with [E]
      p1.x = 370;
      p1.y = 300;
      expect(sim.interactWithNearest(p1)).toBe(true);
      expect(table1.coverState).toBe('flipped');
      expect(table1.hp).toBe(60);
      expect(table1.maxHp).toBe(60);
      expect(table1.blocksMovement).toBe(true);
      expect(table1.blocksEnemyProjectiles).toBe(true);

      // Reduce armor on p1, p2, p3
      p1.armor = 1;
      p1.maxArmor = 5;
      p2.x = 400 + 65; // dist = 65 <= 72
      p2.y = 300;
      p2.armor = 2;
      p2.maxArmor = 3;
      p3.x = 400 + 140; // dist = 140 > 72
      p3.y = 300;
      p3.armor = 0;
      p3.maxArmor = 3;

      // 1) Shoot/destroy table1 in place -> p1 and p2 gain +1 Armor, p3 outside 72px does not
      sim.damageProp(table1, 60, 'none');
      expect(table1.hp).toBe(0);
      expect(p1.armor).toBe(2);
      expect(p2.armor).toBe(3);
      expect(p3.armor).toBe(0);

      // 2) Dash-Kick table2 into a wall -> bursts +1 Armor within r=72px of wall impact (capped at maxArmor)
      sim.map.setTile(16, 9, 'wall'); // wall at x = 512..544, y = 288..320
      const table2 = sim.spawnProp('moss_table', 460, 304);
      p1.x = 435;
      p1.y = 304;
      sim.interactWithNearest(p1);
      expect(table2.coverState).toBe('flipped');

      // Position p2 near the wall (within 72px of impact) at full armor (3/3) and p1 within 72px at (2/5)
      p1.x = 460 - table2.radius - p1.radius + 4;
      p1.y = 304;
      p1.dashTimer = 0.12;
      p1.dashDirX = 1;
      p1.dashDirY = 0;
      p1.aimAngle = 0;
      p2.x = 490;
      p2.y = 304;
      p2.armor = 3; // already at maxArmor = 3

      sim.resolvePropMovementCollision(p1);
      expect(table2.coverState).toBe('sliding');

      for (let i = 0; i < 15; i++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(table2.hp).toBe(0);
      expect(p1.armor).toBe(3); // 2 -> 3
      expect(p2.armor).toBe(3); // capped at maxArmor = 3
    });
  });

  describe('3. Biome 1 Tactical Prop 2: volatile_spore_pod (Túi Bào Tử Căng Phồng)', () => {
    it('initializes with radius=16, hp=25, launches at 520 px/s on Dash-Kick/Melee, and detonates Poison + 1.2s Root (r=96px) + Dmg_KickSlide on direct enemy hit', () => {
      const sim = createCleanBiome1Sim(3301);
      sim.currentFloor = 1; // M_floor(1) = 1.0

      const pod = sim.spawnProp('volatile_spore_pod', 300, 300);
      expect(pod.radius).toBe(16);
      expect(pod.hp).toBe(25);
      expect(pod.maxHp).toBe(25);
      expect(pod.blocksMovement).toBe(true);

      // Direct hit target at (380, 300) and nearby enemy within r=96px at (380, 375) (dist = 75 <= 96)
      const directTarget = sim.spawnEnemy('goblin_shooter', 380, 300, true);
      directTarget.isElite = false;
      directTarget.isBoss = false;
      directTarget.maxHp = 200;
      directTarget.hp = 200;

      const splashTarget = sim.spawnEnemy('goblin_shooter', 380, 375, true);
      splashTarget.isElite = false;
      splashTarget.isBoss = false;
      splashTarget.maxHp = 200;
      splashTarget.hp = 200;

      const farTarget = sim.spawnEnemy('goblin_shooter', 380, 440, true); // dist = 140 > 96
      farTarget.maxHp = 200;
      farTarget.hp = 200;

      // Dash-Kick pod along +X (aimAngle = 0) at 520 px/s
      const p = sim.player;
      p.x = 300 - pod.radius - p.radius + 4;
      p.y = 300;
      p.dashTimer = 0.1;
      p.dashDirX = 1;
      p.dashDirY = 0;
      p.aimAngle = 0;

      sim.resolvePropMovementCollision(p);
      expect(pod.coverState).toBe('sliding');
      expect(Math.hypot(pod.vx ?? 0, pod.vy ?? 0)).toBeCloseTo(520, 2);

      // Step until pod hits directTarget (~0.15s)
      for (let i = 0; i < 12; i++) {
        sim.step(SIM_STEP_SEC);
        if (pod.hp <= 0) break;
      }

      expect(pod.hp).toBe(0);
      // Direct target took Dmg_KickSlide = round(20 * 1 + 0.10 * 200) = 40 -> hp <= 160
      expect(directTarget.hp).toBeLessThanOrEqual(160);
      expect(directTarget.poisonTimer).toBeGreaterThan(0);
      expect(directTarget.poisonStacks).toBeGreaterThanOrEqual(1);
      expect(directTarget.rootedTimer).toBeGreaterThan(1.0);

      // Splash target within r=96px is also Poisoned and Rooted for 1.2s
      expect(splashTarget.poisonTimer).toBeGreaterThan(0);
      expect(splashTarget.poisonStacks).toBeGreaterThanOrEqual(1);
      expect(splashTarget.rootedTimer).toBeGreaterThan(1.0);

      // Far target outside r=96px is unaffected
      expect(farTarget.poisonTimer).toBe(0);
      expect(farTarget.rootedTimer).toBe(0);
    });

    it('detonates Poison + 1.2s Root in r=96px when shot to 0 HP in place', () => {
      const sim = createCleanBiome1Sim(3302);
      const pod = sim.spawnProp('volatile_spore_pod', 400, 300);
      const enemyNear = sim.spawnEnemy('wild_boar', 460, 300, true); // dist = 60 <= 96

      sim.damageProp(pod, 25, 'none');
      expect(pod.hp).toBe(0);
      expect(enemyNear.poisonTimer).toBeGreaterThan(0);
      expect(enemyNear.rootedTimer).toBeCloseTo(1.2, 2);
    });
  });

  describe('4. Biome 1 Tactical Prop 3: rotten_totem_pillar (Trụ Đá Mục)', () => {
    it('initializes with radius=20, hp=45, blocksMovement=true, and collapses along fallAngle into a 160x56px rectangle dealing Dmg_Hazard + 1.5s Stun when shot, Wall-Slammed, or hit by a Dash-Kicked prop', () => {
      const sim = createCleanBiome1Sim(3401);
      sim.currentFloor = 1; // M_floor(1) = 1.0

      // Case A: Shot to 0 HP -> collapses along projectile/impact angle (0 rad = +X)
      const pillarA = sim.spawnProp('rotten_totem_pillar', 300, 200);
      expect(pillarA.radius).toBe(20);
      expect(pillarA.hp).toBe(45);
      expect(pillarA.maxHp).toBe(45);
      expect(pillarA.blocksMovement).toBe(true);

      // Normal enemy inside 160x56px along +X: at (420, 215) -> along = 120 <= 160, perp = 15 <= 28
      const normalHit = sim.spawnEnemy('goblin_shooter', 420, 215, true);
      normalHit.isBoss = false;
      normalHit.maxHp = 200;
      normalHit.hp = 200;

      // Boss inside 160x56px along +X: at (380, 185) -> along = 80 <= 160, perp = -15 <= 28
      const bossHit = sim.spawnEnemy('spore_king', 380, 185, true);
      bossHit.isBoss = true;
      bossHit.maxHp = 1000;
      bossHit.hp = 1000;

      // Enemy outside 160x56px rectangle: behind pillar at (240, 200) and wide off-axis at (380, 280)
      const enemyBehind = sim.spawnEnemy('goblin_shooter', 240, 200, true);
      enemyBehind.maxHp = 200;
      enemyBehind.hp = 200;
      const enemyWide = sim.spawnEnemy('goblin_shooter', 380, 280, true);
      enemyWide.maxHp = 200;
      enemyWide.hp = 200;

      // Position player at (220, 200) aiming right (0 rad) and destroy pillarA
      sim.player.x = 220;
      sim.player.y = 200;
      sim.player.aimAngle = 0;
      sim.damageProp(pillarA, 45, 'none');

      expect(pillarA.hp).toBe(0);
      // Normal enemy Dmg_Hazard = round(28 * 1 + 0.20 * 200) = round(28 + 40) = 68 -> hp = 132
      expect(normalHit.hp).toBe(200 - 68);
      expect(normalHit.stunTimer).toBeCloseTo(1.5, 2);

      // Boss Dmg_Hazard = round(0.06 * 1000) = 60 -> hp = 940
      expect(bossHit.hp).toBe(1000 - 60);
      expect(bossHit.stunTimer).toBeCloseTo(1.5, 2);

      // Enemies outside rectangle take 0 damage
      expect(enemyBehind.hp).toBe(200);
      expect(enemyWide.hp).toBe(200);

      // Case B: Enemy Wall-Slammed into rotten_totem_pillar along +Y (Math.PI / 2) collapses pillar downward!
      const pillarB = sim.spawnProp('rotten_totem_pillar', 600, 250);
      const slammedEnemy = sim.spawnEnemy('goblin_shooter', 600, 200, true);
      slammedEnemy.x = 600;
      slammedEnemy.y = 250 - pillarB.radius - slammedEnemy.radius + 4;
      slammedEnemy.maxHp = 300;
      slammedEnemy.hp = 300;
      slammedEnemy.kbVx = 0;
      slammedEnemy.kbVy = 220; // >= 120 toward +Y

      const crushedDownward = sim.spawnEnemy('goblin_shooter', 600, 360, true); // 110px along +Y (inside 160x56px)
      crushedDownward.maxHp = 200;
      crushedDownward.hp = 200;

      sim.resolvePropMovementCollision(slammedEnemy);
      expect(pillarB.hp).toBe(0);
      expect(crushedDownward.hp).toBe(200 - 68);
      expect(crushedDownward.stunTimer).toBeCloseTo(1.5, 2);

      // Case C: Dash-Kicked prop sliding into rotten_totem_pillar collapses it along slideAngle!
      const pillarC = sim.spawnProp('rotten_totem_pillar', 750, 450);
      const tableC = sim.spawnProp('moss_table', 690, 450);
      sim.player.x = 665;
      sim.player.y = 450;
      sim.interactWithNearest(sim.player);
      expect(tableC.coverState).toBe('flipped');

      const crushedBySlideCollapse = sim.spawnEnemy('goblin_shooter', 850, 450, true); // 100px +X from pillarC
      crushedBySlideCollapse.maxHp = 200;
      crushedBySlideCollapse.hp = 200;

      sim.kickProp(tableC, sim.player, 0);
      for (let i = 0; i < 15; i++) {
        sim.step(SIM_STEP_SEC);
        if (pillarC.hp <= 0) break;
      }
      expect(pillarC.hp).toBe(0);
      expect(crushedBySlideCollapse.hp).toBe(200 - 68);
      expect(crushedBySlideCollapse.stunTimer).toBeGreaterThan(1.2);
    });
  });

  describe('5. Biome 1 Archetype Prop Spawning & Grass Patches', () => {
    it('spawns moss_table, volatile_spore_pod, and rotten_totem_pillar at propAnchors across all 3 Biome 1 combat archetypes while respecting MAX_TACTICAL_PROPS_PER_ROOM = 16', () => {
      const map = new ArenaMap({ cols: 36, rows: 22, biome: 1 });

      for (const archetype of PHASE0B_ROOM_ARCHETYPES) {
        const res = configureRoomLayout(map, {
          roomSeed: 42,
          archetype,
          biome: 1,
          activeDoorSides: ['N', 'S', 'E', 'W'],
        });

        const anchorKinds = new Set(res.propAnchors.map((a) => a.propKind));
        expect(anchorKinds.has('moss_table')).toBe(true);
        expect(anchorKinds.has('volatile_spore_pod')).toBe(true);
        expect(anchorKinds.has('rotten_totem_pillar')).toBe(true);

        // Verify grass and poison_swamp surfaces exist in every Biome 1 combat archetype
        let grassCount = 0;
        let swampCount = 0;
        for (let ty = 1; ty < map.rows - 1; ty++) {
          for (let tx = 1; tx < map.cols - 1; tx++) {
            const s = map.getSurface(tx, ty);
            if (s === 'grass') grassCount++;
            if (s === 'poison_swamp') swampCount++;
          }
        }
        expect(grassCount).toBeGreaterThanOrEqual(6);
        expect(swampCount).toBeGreaterThanOrEqual(6);
      }

      // Verify WorldSim combat room population spawns all 3 Biome 1 tactical props and stays <= 16 total props
      const sim = new WorldSim({
        seed: 3501,
        biome: 1,
        spawnInitialWave: false,
        includeTrainingDummy: false,
      });
      const combatRooms = sim.dungeon.rooms.filter((r) => r.type === 'combat');
      expect(combatRooms.length).toBeGreaterThanOrEqual(3);

      for (const room of combatRooms) {
        sim.enterRoom(room.id);
        expect(sim.props.length).toBeLessThanOrEqual(MAX_TACTICAL_PROPS_PER_ROOM);
        const kinds = new Set(sim.props.map((p) => p.kind));
        expect(kinds.has('moss_table')).toBe(true);
        expect(kinds.has('volatile_spore_pod')).toBe(true);
        expect(kinds.has('rotten_totem_pillar')).toBe(true);
      }
    });
  });
});
