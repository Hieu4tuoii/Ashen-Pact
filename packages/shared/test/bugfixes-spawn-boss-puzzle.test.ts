import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  NetworkTransport,
  SIM_STEP_SEC,
  WorldSim,
  distance,
  encodeWorldSnapshot,
} from '../src/index.js';

describe('Bugfixes: Enemy Obstacle Spawning, Boss Phase Energy Reward, & Solo Pressure Plate Push Block', () => {
  it('Bug 1: resolves circles inside 2x2 pillars completely outside and never spawns or traps enemies inside pillars, crates, barrels, or props', () => {
    const sim = new WorldSim({
      seed: 1001,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    // Configure combat room style 0 (has 2x2 pillar at tx=9..10, ty=5..6 -> [288..352, 160..224])
    sim.map.configureRoomLayout('combat', 300, false, 1);
    expect(sim.map.isSolidTile(9, 5)).toBe(true);
    expect(sim.map.isSolidTile(10, 5)).toBe(true);
    expect(sim.map.isSolidTile(9, 6)).toBe(true);
    expect(sim.map.isSolidTile(10, 6)).toBe(true);

    // Point (336, 187) is inside tile (10, 5) of the 2x2 pillar (the exact [-160, -115] wave offset!)
    const col = sim.map.resolveCircleCollision(336, 187, 14);
    expect(sim.map.checkProjectileWallHit(col.x, col.y, 14).hit).toBe(false);

    // Spawning an enemy directly at a 2x2 pillar coordinate or on top of props must place it outside
    const crate = sim.spawnProp('wooden_crate', 480, 320);
    const barrel = sim.spawnProp('explosive_barrel', 540, 320);
    const crystal = sim.spawnProp('crystal_pillar', 600, 320);
    const mech = sim.spawnProp('ancient_mechanism', 496, 368);

    const eFromPillar = sim.spawnEnemy('goblin_shooter', 336, 187, true);
    expect(sim.map.checkProjectileWallHit(eFromPillar.x, eFromPillar.y, eFromPillar.radius).hit).toBe(
      false,
    );

    const eFromCrate = sim.spawnEnemy('goblin_shooter', crate.x, crate.y, true);
    expect(distance(eFromCrate.x, eFromCrate.y, crate.x, crate.y)).toBeGreaterThanOrEqual(
      eFromCrate.radius + crate.radius - 0.5,
    );

    const eFromBarrel = sim.spawnEnemy('wild_boar', barrel.x, barrel.y, true);
    expect(distance(eFromBarrel.x, eFromBarrel.y, barrel.x, barrel.y)).toBeGreaterThanOrEqual(
      eFromBarrel.radius + barrel.radius - 0.5,
    );

    const eFromCrystal = sim.spawnEnemy('ice_mage', crystal.x, crystal.y, true);
    expect(distance(eFromCrystal.x, eFromCrystal.y, crystal.x, crystal.y)).toBeGreaterThanOrEqual(
      eFromCrystal.radius + crystal.radius - 0.5,
    );

    const eFromMech = sim.spawnEnemy('goblin_shaman', mech.x, mech.y, true);
    expect(distance(eFromMech.x, eFromMech.y, mech.x, mech.y)).toBeGreaterThanOrEqual(
      eFromMech.radius + mech.radius - 0.5,
    );

    // Entering combat rooms across seeds and spawning waves must never place any enemy inside a pillar or prop
    for (const seed of [101, 202, 303, 404, 505]) {
      const runSim = new WorldSim({
        seed,
        spawnInitialWave: true,
        includeTrainingDummy: false,
      });
      const combatRooms = runSim.dungeon.rooms.filter((r) => r.type === 'combat');
      for (const room of combatRooms) {
        runSim.enterRoom(room.id);
        for (let t = 0; t < 15; t++) {
          runSim.step(SIM_STEP_SEC);
        }
        for (const e of runSim.enemies) {
          if (e.isDummy || e.hp <= 0) continue;
          expect(runSim.map.checkProjectileWallHit(e.x, e.y, e.radius - 1).hit).toBe(false);
          for (const prop of runSim.props) {
            if (prop.hp <= 0) continue;
            if (prop.blocksMovement || prop.kind === 'ancient_mechanism') {
              expect(distance(e.x, e.y, prop.x, prop.y)).toBeGreaterThanOrEqual(
                e.radius + prop.radius - 1,
              );
            }
          }
        }
      }
    }
  });

  it('Adjustment 2: drops a sustain life_seed orb on each Boss phase transition without spawning legacy energy pickups', () => {
    const sim = new WorldSim({
      seed: 2002,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const p1 = sim.player;
    p1.x = 240;
    p1.y = 320;

    const boss = sim.spawnEnemy('spore_king', 640, 320, true);
    expect(boss.bossPhase).toBe(1);

    // Transition Phase 1 -> Phase 2 (<= 66% HP)
    sim.applyDamageToEnemy(boss, Math.ceil(boss.maxHp * 0.36), false, 'none', 0, 0, false, p1.id);
    expect(boss.bossPhase).toBe(2);
    expect(sim.pickups.filter((pk) => pk.kind === 'life_seed').length).toBeGreaterThanOrEqual(1);
    expect(sim.pickups.filter((pk) => (pk.kind as string) === 'energy')).toHaveLength(0);

    // Transition Phase 2 -> Phase 3 (<= 33% HP)
    sim.applyDamageToEnemy(boss, Math.ceil(boss.maxHp * 0.35), false, 'none', 0, 0, false, p1.id);
    expect(boss.bossPhase).toBe(3);
    expect(sim.pickups.filter((pk) => pk.kind === 'life_seed').length).toBeGreaterThanOrEqual(2);
    expect(sim.pickups.filter((pk) => (pk.kind as string) === 'energy')).toHaveLength(0);
  });

  it('Bug 3: allows Solo player to smoothly push the block onto the pressure plate without lateral slip or overshooting, and syncs puzzle state over NetworkTransport', () => {
    const sim = new WorldSim({
      seed: 3003,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });

    const treasureRoom = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
    expect(treasureRoom).toBeDefined();
    sim.enterRoom(treasureRoom.id);

    expect(sim.pressurePlates).toHaveLength(2);
    expect(sim.pushBlocks).toHaveLength(1);
    const plate0 = sim.pressurePlates[0]!;
    const plate1 = sim.pressurePlates[1]!;
    const block = sim.pushBlocks[0]!;

    // Ensure no torch_brazier is obstructing the straight path between block and plate1
    for (const prop of sim.props) {
      if (prop.kind === 'torch_brazier') {
        expect(Math.abs(prop.x - block.x)).toBeGreaterThan(25);
      }
    }

    // Position player below the push block, slightly off-center by 8px (which previously caused lateral slip!)
    // and hold W (moveY = -1) for 90 ticks — even if the player keeps holding W after the block reaches the plate,
    // the block must snap and stay locked on plate1!
    sim.player.x = block.x - 8;
    sim.player.y = block.y + 32;
    for (let i = 0; i < 90; i++) {
      sim.setPlayerInput({
        seq: i + 1,
        tick: sim.tick,
        moveX: 0,
        moveY: -1,
        aimAngle: -Math.PI / 2,
        buttons: 0,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);
    }

    expect(distance(block.x, block.y, plate1.x, plate1.y)).toBeLessThanOrEqual(6);
    expect(plate1.pressed).toBe(true);

    // Now move player onto plate0 -> puzzle completes and spawns bonus Epic chest!
    sim.player.x = plate0.x;
    sim.player.y = plate0.y;
    const chestsBefore = sim.chests.length;
    sim.setPlayerInput({
      seq: 100,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.INTERACT,
      weaponSlotSelect: null,
    });
    sim.step(SIM_STEP_SEC);

    expect(sim.coopPuzzleCompleted).toBe(true);
    expect(sim.chests.length).toBe(chestsBefore + 1);

    // Verify encodeWorldSnapshot & NetworkTransport sync pressurePlates, pushBlocks, and coopPuzzleCompleted
    const snap = encodeWorldSnapshot(sim, []);
    expect(snap.coopPuzzleCompleted).toBe(true);
    expect(snap.pressurePlates).toHaveLength(2);
    expect(snap.pushBlocks).toHaveLength(1);

    const net = new NetworkTransport({
      seed: 3003,
      startInHub: false,
      localPlayerId: 1,
      localPlayerSlot: 1,
    });
    net.receiveSnapshot(snap);
    net.step(16.67);
    expect(net.getSim().coopPuzzleCompleted).toBe(true);
    expect(net.getSim().pressurePlates).toHaveLength(2);
    expect(net.getSim().pushBlocks).toHaveLength(1);
    expect(distance(net.getSim().pushBlocks[0]!.x, net.getSim().pushBlocks[0]!.y, plate1.x, plate1.y)).toBeLessThanOrEqual(6);
  });
});
