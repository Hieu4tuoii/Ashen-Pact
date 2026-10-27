import { describe, expect, it } from 'vitest';
import {
  ALL_ROOM_ARCHETYPES,
  ArenaMap,
  DOOR_VESTIBULE_RECTS,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  TILE_SIZE,
  WorldSim,
  areActiveDoorsConnectedBfs,
  configureRoomLayout,
  getConveyorVelocityAtWorld,
} from '../src/index.js';

describe('AP2 Phase P1C.1 — 3 New Tactical Room Archetypes (CROSSFIRE_CONVEYORS, PRISM_LABYRINTH, CRUMBLING_PILLAR_RING)', () => {
  it('implements CROSSFIRE_CONVEYORS with two parallel 3-tile-wide lanes (ty: 6..8 East +110 px/s, ty: 13..15 West -110 px/s) carrying players, enemies, and sliding props', () => {
    const sim = new WorldSim({
      seed: 7100,
      biome: 3,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const layout = configureRoomLayout(sim.map, {
      roomSeed: 7100,
      archetype: 'CROSSFIRE_CONVEYORS',
      biome: 3,
      activeDoorSides: ['N', 'S', 'E', 'W'],
    });
    expect(layout.archetype).toBe('CROSSFIRE_CONVEYORS');

    // Verify parallel 3-tile-wide conveyor lanes at ty: 6..8 (East) and ty: 13..15 (West)
    for (let tx = 6; tx <= 29; tx++) {
      for (const ty of [6, 7, 8]) {
        expect(sim.map.getSurface(tx, ty)).toBe('conveyor');
        expect(
          getConveyorVelocityAtWorld(sim.map, tx * TILE_SIZE + 16, ty * TILE_SIZE + 16),
        ).toBe(110);
      }
      for (const ty of [13, 14, 15]) {
        expect(sim.map.getSurface(tx, ty)).toBe('conveyor');
        expect(
          getConveyorVelocityAtWorld(sim.map, tx * TILE_SIZE + 16, ty * TILE_SIZE + 16),
        ).toBe(-110);
      }
    }

    // 1. Player standing idle on top lane (ty = 7) is carried East at ~110 px/s
    sim.player.x = 12 * TILE_SIZE + 16;
    sim.player.y = 7 * TILE_SIZE + 16;
    sim.player.vx = 0;
    sim.player.vy = 0;
    const playerStartX = sim.player.x;

    // 2. Enemy standing on bottom lane (ty = 14) is carried West at ~110 px/s
    const enemy = sim.spawnEnemy('goblin_shooter', 22 * TILE_SIZE + 16, 14 * TILE_SIZE + 16, true);
    enemy.moveSpeed = 0;
    enemy.aiState = 'stunned';
    enemy.stateTimer = 5.0;
    enemy.stunTimer = 5.0;
    const enemyStartX = enemy.x;

    // 3. Sliding barricade on top lane (ty = 7) moving vertically also drifts East with the 110 px/s belt
    const shield = sim.spawnProp('forge_blast_shield', 16 * TILE_SIZE + 16, 6 * TILE_SIZE + 16);
    sim.flipCoverProp(shield);
    sim.kickProp(shield, sim.player, Math.PI / 2); // Kicked straight South across the Eastward conveyor
    const shieldStartX = shield.x;

    for (let t = 0; t < 12; t++) {
      sim.setPlayerInput({
        seq: t + 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
      });
      sim.step(SIM_STEP_SEC);
    }

    expect(sim.player.x - playerStartX).toBeCloseTo(110 * (12 / 60), 0);
    expect(enemy.x - enemyStartX).toBeCloseTo(-110 * (12 / 60), 0);
    expect(shield.x).toBeGreaterThan(shieldStartX + 12);
  });

  it('implements PRISM_LABYRINTH with 5 staggered 2x4 cover walls in a checkerboard pattern and interleaved prism/totem/press props', () => {
    const mapB2 = new ArenaMap({ cols: 36, rows: 22, biome: 2 });
    const layoutB2 = configureRoomLayout(mapB2, {
      roomSeed: 7104,
      archetype: 'PRISM_LABYRINTH',
      biome: 2,
      activeDoorSides: ['N', 'S', 'E', 'W'],
    });

    expect(layoutB2.archetype).toBe('PRISM_LABYRINTH');
    expect(areActiveDoorsConnectedBfs(mapB2, ['N', 'S', 'E', 'W'])).toBe(true);

    // Count pillar tiles from the 5 staggered 2x4 walls (5 * 8 = 40 pillar tiles)
    let pillarTileCount = 0;
    for (let ty = 1; ty < mapB2.rows - 1; ty++) {
      for (let tx = 1; tx < mapB2.cols - 1; tx++) {
        if (mapB2.getTile(tx, ty) === 'pillar') {
          pillarTileCount += 1;
        }
      }
    }
    expect(pillarTileCount).toBeGreaterThanOrEqual(40);

    // Verify interleaved pillar_toy anchors (cryo_prism_pillar in Biome 2, rotten_totem_pillar in Biome 1, pneumatic_press in Biome 3)
    const b2PillarToys = layoutB2.propAnchors.filter((a) => a.role === 'pillar_toy');
    expect(b2PillarToys.length).toBeGreaterThanOrEqual(3);
    expect(b2PillarToys.every((a) => a.propKind === 'cryo_prism_pillar')).toBe(true);

    const mapB1 = new ArenaMap({ cols: 36, rows: 22, biome: 1 });
    const layoutB1 = configureRoomLayout(mapB1, {
      roomSeed: 7104,
      archetype: 'PRISM_LABYRINTH',
      biome: 1,
    });
    expect(
      layoutB1.propAnchors
        .filter((a) => a.role === 'pillar_toy')
        .every((a) => a.propKind === 'rotten_totem_pillar'),
    ).toBe(true);

    const mapB3 = new ArenaMap({ cols: 36, rows: 22, biome: 3 });
    const layoutB3 = configureRoomLayout(mapB3, {
      roomSeed: 7104,
      archetype: 'PRISM_LABYRINTH',
      biome: 3,
    });
    expect(
      layoutB3.propAnchors
        .filter((a) => a.role === 'pillar_toy')
        .every((a) => a.propKind === 'pneumatic_press'),
    ).toBe(true);
  });

  it('implements CRUMBLING_PILLAR_RING with 6 hexagonal 2x2 pillars and 4 gap barricades that collapse (160px crush zone) and open floor tiles when shot or Wall-Slammed', () => {
    const sim = new WorldSim({
      seed: 7108,
      biome: 1,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const layout = configureRoomLayout(sim.map, {
      roomSeed: 7108,
      archetype: 'CRUMBLING_PILLAR_RING',
      biome: 1,
      activeDoorSides: ['N', 'S', 'E', 'W'],
    });
    expect(layout.archetype).toBe('CRUMBLING_PILLAR_RING');

    // Spawn props from layout anchors
    sim.props.length = 0;
    for (const a of layout.propAnchors) {
      sim.spawnProp(a.propKind, a.x, a.y);
    }

    const barricades = layout.propAnchors.filter((a) => a.role === 'barricade');
    expect(barricades).toHaveLength(4);

    const ringPillars = sim.props.filter((p) => p.kind === 'rotten_totem_pillar');
    expect(ringPillars).toHaveLength(6);

    // Pick the first ring pillar and verify its 2x2 tile footprint is initially solid 'pillar'
    const pillar0 = ringPillars[0]!;
    const pTx = Math.floor(pillar0.x / TILE_SIZE);
    const pTy = Math.floor(pillar0.y / TILE_SIZE);
    let solidBefore = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (sim.map.getTile(pTx + dx, pTy + dy) === 'pillar') {
          solidBefore += 1;
        }
      }
    }
    expect(solidBefore).toBeGreaterThanOrEqual(4);

    // Place an enemy 110px East of pillar0 to verify the 160px collapse crush zone
    const victim = sim.spawnEnemy('wild_boar', pillar0.x + 110, pillar0.y, true);
    victim.hp = 400;
    victim.maxHp = 400;
    const victimHpBefore = victim.hp;

    // Shoot / destroy pillar0 from West -> collapses Eastward (angle = 0), crushes victim within 160px, and clears 2x2 pillar tiles to floor!
    sim.player.x = pillar0.x - 64;
    sim.player.y = pillar0.y;
    sim.player.aimAngle = 0;
    sim.damageProp(pillar0, 999, 'none');

    expect(pillar0.coverState).toBe('fallen');
    expect(victim.hp).toBeLessThan(victimHpBefore);
    expect(victim.stunTimer).toBeGreaterThanOrEqual(1.4);

    let solidAfter = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (sim.map.getTile(pTx + dx, pTy + dy) === 'pillar') {
          solidAfter += 1;
        }
      }
    }
    expect(solidAfter).toBe(0);

    // Also verify a second ring pillar collapses when an enemy is Wall-Slammed into it!
    const pillar1 = ringPillars[1]!;
    const slamEnemy = sim.spawnEnemy('goblin_shooter', pillar1.x - 46, pillar1.y, true);
    slamEnemy.hp = 300;
    slamEnemy.maxHp = 300;
    slamEnemy.kbVx = 260;
    slamEnemy.kbVy = 0;
    sim.step(SIM_STEP_SEC);
    expect(pillar1.coverState).toBe('fallen');
  });

  it('guarantees flipX/flipY, Prop Jitter ±1..2, 3x3 Door Clearance, and 100% BFS door connectivity across 500 seeds for all 6 archetypes', () => {
    expect(ALL_ROOM_ARCHETYPES).toEqual([
      'TWIN_BRIDGES',
      'GAUNTLET_CHOKEPOINT',
      'CENTRAL_BASTION',
      'CROSSFIRE_CONVEYORS',
      'PRISM_LABYRINTH',
      'CRUMBLING_PILLAR_RING',
    ]);

    const map = new ArenaMap({ cols: 36, rows: 22, biome: 1 });
    for (let seed = 1; seed <= 500; seed++) {
      const archetype = ALL_ROOM_ARCHETYPES[seed % ALL_ROOM_ARCHETYPES.length]!;
      const biome = (((seed % 3) + 1) as 1 | 2 | 3);
      const res = configureRoomLayout(map, {
        roomSeed: seed,
        archetype,
        biome,
        activeDoorSides: ['N', 'S', 'E', 'W'],
      });

      expect(res.flipX).toBe((seed & 1) !== 0);
      expect(res.flipY).toBe((seed & 2) !== 0);
      expect(areActiveDoorsConnectedBfs(map, ['N', 'S', 'E', 'W'])).toBe(true);

      for (const dir of ['N', 'S', 'E', 'W'] as const) {
        const rect = DOOR_VESTIBULE_RECTS[dir];
        for (let ty = rect.minTy; ty <= rect.maxTy; ty++) {
          for (let tx = rect.minTx; tx <= rect.maxTx; tx++) {
            expect(map.isSolidTile(tx, ty)).toBe(false);
            expect(map.getSurface(tx, ty)).toBe('none');
          }
        }
      }

      for (const anchor of res.propAnchors) {
        expect(Math.abs(anchor.jitterDx)).toBeLessThanOrEqual(2);
        expect(Math.abs(anchor.jitterDy)).toBeLessThanOrEqual(2);
        expect(map.getSurface(anchor.tx, anchor.ty)).not.toBe('chasm');
      }
    }
  });
});
