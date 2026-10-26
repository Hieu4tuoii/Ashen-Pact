import { describe, expect, it } from 'vitest';
import {
  ArenaMap,
  type CardinalDir,
  DOOR_TILES,
  DOOR_VESTIBULE_RECTS,
  INPUT_BUTTON,
  PHASE0B_ROOM_ARCHETYPES,
  type RoomArchetypeId,
  SIM_STEP_SEC,
  TILE_SIZE,
  WorldSim,
  areActiveDoorsConnectedBfs,
  configureRoomLayout,
  isWalkableTileForBfs,
  selectBiome1RoomArchetype,
} from '../src/index.js';

function runWalkableBfs(
  map: ArenaMap,
  startTx: number,
  startTy: number,
  targetTx: number,
  targetTy: number,
  blockedRowPredicate?: (tx: number, ty: number) => boolean,
): boolean {
  const isPassable = (tx: number, ty: number): boolean => {
    if (tx <= 0 || tx >= map.cols - 1 || ty <= 0 || ty >= map.rows - 1) return false;
    if (blockedRowPredicate?.(tx, ty)) return false;
    return !map.isSolidTile(tx, ty) && map.getSurfaceAtTile(tx, ty) !== 'chasm';
  };

  if (!isPassable(startTx, startTy) || !isPassable(targetTx, targetTy)) {
    return false;
  }

  const visited = new Uint8Array(map.cols * map.rows);
  const queueX = new Int16Array(map.cols * map.rows);
  const queueY = new Int16Array(map.cols * map.rows);
  let head = 0;
  let tail = 0;

  visited[startTy * map.cols + startTx] = 1;
  queueX[tail] = startTx;
  queueY[tail] = startTy;
  tail += 1;

  const dirs: readonly [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (head < tail) {
    const cx = queueX[head]!;
    const cy = queueY[head]!;
    head += 1;
    if (cx === targetTx && cy === targetTy) return true;

    for (let i = 0; i < dirs.length; i++) {
      const nx = cx + dirs[i]![0];
      const ny = cy + dirs[i]![1];
      if (!isPassable(nx, ny)) continue;
      const idx = ny * map.cols + nx;
      if (visited[idx]) continue;
      visited[idx] = 1;
      queueX[tail] = nx;
      queueY[tail] = ny;
      tail += 1;
    }
  }

  return false;
}

describe('AP2 Phase P0B.1 — Tactical Room Archetypes (TWIN_BRIDGES, GAUNTLET_CHOKEPOINT, CENTRAL_BASTION) & Chasm Surface', () => {
  it('supports SurfaceKind = chasm: projectiles fly over chasm, normal walking is blocked, dash crosses narrow chasm, and forced knockback enters chasm', () => {
    const sim = new WorldSim({
      seed: 1001,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    // Clear interior to pure floor and place a 1-tile chasm strip at tx = 15, ty = 8..14
    for (let ty = 1; ty < sim.map.rows - 1; ty++) {
      for (let tx = 1; tx < sim.map.cols - 1; tx++) {
        sim.map.setTile(tx, ty, 'floor');
        sim.map.setSurface(tx, ty, 'none', 0, true);
      }
    }
    sim.map.rebuildSolidBoxes();
    for (let ty = 8; ty <= 14; ty++) {
      sim.map.setSurface(15, ty, 'chasm', 0, true);
    }

    expect(sim.map.getSurfaceAtTile(15, 11)).toBe('chasm');
    expect(sim.map.isChasmTile(15, 11)).toBe(true);
    expect(sim.map.isWalkableTile(15, 11)).toBe(false);
    expect(isWalkableTileForBfs(sim.map, 15, 11)).toBe(false);

    // 1. Projectiles pass freely over chasm tiles
    const chasmWorldX = 15 * TILE_SIZE + TILE_SIZE * 0.5;
    const chasmWorldY = 11 * TILE_SIZE + TILE_SIZE * 0.5;
    expect(sim.map.checkProjectileWallHit(chasmWorldX, chasmWorldY, 6).hit).toBe(false);

    // 2. Normal player walking is blocked by chasm without dealing self-damage on brushing the edge
    const p = sim.player;
    p.x = 14 * TILE_SIZE + TILE_SIZE * 0.5;
    p.y = chasmWorldY;
    const startHp = p.hp;
    const startArmor = p.armor;

    for (let t = 0; t < 25; t++) {
      sim.setPlayerInput({
        seq: t + 1,
        tick: sim.tick,
        moveX: 1,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);
      expect(sim.map.getSurfaceAtWorld(p.x, p.y)).not.toBe('chasm');
    }
    expect(p.x).toBeLessThan(15 * TILE_SIZE);
    expect(p.hp).toBe(startHp);
    expect(p.armor).toBe(startArmor);

    // 3. Player dashing crosses the narrow 1-tile chasm to tx >= 16
    p.dashCooldownTimer = 0;
    for (let t = 0; t < 18; t++) {
      sim.setPlayerInput({
        seq: 100 + t,
        tick: sim.tick,
        moveX: 1,
        moveY: 0,
        aimAngle: 0,
        buttons: t === 0 ? INPUT_BUTTON.DASH : 0,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);
    }
    expect(p.x).toBeGreaterThan(16 * TILE_SIZE);
    expect(sim.map.getSurfaceAtWorld(p.x, p.y)).toBe('none');

    // 4. Ground enemy walking is blocked by chasm, but forced knockback pushes enemy into chasm
    const enemy = sim.spawnEnemy('goblin_shooter', 14 * TILE_SIZE + 16, chasmWorldY, true);
    enemy.vx = 180;
    enemy.vy = 0;
    enemy.kbVx = 0;
    enemy.kbVy = 0;
    p.x = 20 * TILE_SIZE;
    p.y = chasmWorldY;
    sim.step(SIM_STEP_SEC);
    expect(sim.map.getSurfaceAtWorld(enemy.x, enemy.y)).not.toBe('chasm');

    // Apply strong knockback toward chasm (tx = 15)
    enemy.x = 14 * TILE_SIZE + 28;
    enemy.y = chasmWorldY;
    enemy.aiState = 'stunned';
    enemy.stateTimer = 0.5;
    enemy.kbVx = 650;
    enemy.kbVy = 0;
    sim.step(SIM_STEP_SEC);
    expect(sim.map.getSurfaceAtWorld(enemy.x, enemy.y)).toBe('chasm');
  });

  it('guarantees 100% BFS door connectivity and 3x3 Door Clearance across 500 consecutive roomSeeds and activeDoorSides combinations for all 3 archetypes', () => {
    const map = new ArenaMap({ cols: 36, rows: 22 });
    const doorCombos: readonly (readonly CardinalDir[])[] = [
      ['N', 'S', 'E', 'W'],
      ['W', 'E'],
      ['N', 'S'],
      ['W', 'N', 'E'],
      ['W', 'S', 'E'],
      ['N', 'E'],
      ['S', 'W'],
    ];

    for (const archetype of PHASE0B_ROOM_ARCHETYPES) {
      for (let seed = 1; seed <= 500; seed++) {
        const activeDoorSides = doorCombos[seed % doorCombos.length]!;
        const biome = ((seed % 3) + 1) as 1 | 2 | 3;
        const res = configureRoomLayout(map, {
          roomSeed: seed,
          archetype,
          biome,
          activeDoorSides,
        });

        expect(res.archetype).toBe(archetype);
        expect(res.flipX).toBe((seed & 1) !== 0);
        expect(res.flipY).toBe((seed & 2) !== 0);

        // 1. Verify 3x3 vestibule inside every active door has 0 solid tiles and 0 chasm tiles
        for (const dir of activeDoorSides) {
          const rect = DOOR_VESTIBULE_RECTS[dir];
          for (let ty = rect.minTy; ty <= rect.maxTy; ty++) {
            for (let tx = rect.minTx; tx <= rect.maxTx; tx++) {
              expect(
                map.isSolidTile(tx, ty),
                `Solid tile in ${dir} vestibule at (${tx},${ty}) for ${archetype} seed=${seed}`,
              ).toBe(false);
              expect(
                map.getSurfaceAtTile(tx, ty),
                `Chasm in ${dir} vestibule at (${tx},${ty}) for ${archetype} seed=${seed}`,
              ).not.toBe('chasm');
            }
          }
        }

        // 2. Verify 100% BFS connectivity between all active doors (and all 4 standard doors)
        expect(areActiveDoorsConnectedBfs(map, activeDoorSides)).toBe(true);
        const firstDoor = DOOR_TILES[activeDoorSides[0]!];
        for (let i = 1; i < activeDoorSides.length; i++) {
          const targetDoor = DOOR_TILES[activeDoorSides[i]!];
          expect(
            runWalkableBfs(map, firstDoor.tx, firstDoor.ty, targetDoor.tx, targetDoor.ty),
            `BFS failed from ${activeDoorSides[0]} to ${activeDoorSides[i]} on ${archetype} seed=${seed}`,
          ).toBe(true);
        }
      }
    }
  });

  it('enforces True Chokepoint in TWIN_BRIDGES across 500 consecutive roomSeeds: zero bypass around North/South doors when bridges (ty: 5..7 and ty: 14..16) are blocked', () => {
    const map = new ArenaMap({ cols: 36, rows: 22 });
    const allDoors: readonly CardinalDir[] = ['N', 'S', 'E', 'W'];

    for (let seed = 1; seed <= 500; seed++) {
      const res = configureRoomLayout(map, {
        roomSeed: seed,
        archetype: 'TWIN_BRIDGES',
        biome: 1,
        activeDoorSides: allDoors,
      });

      expect(res.bridgeRows).toEqual([
        [5, 7],
        [14, 16],
      ]);

      // With bridges open, all 4 doors N(18,1), S(18,20), W(1,11), E(34,11) are 100% mutually reachable
      expect(runWalkableBfs(map, 1, 11, 34, 11)).toBe(true);
      expect(runWalkableBfs(map, 18, 1, 34, 11)).toBe(true);
      expect(runWalkableBfs(map, 18, 20, 1, 11)).toBe(true);
      expect(runWalkableBfs(map, 18, 1, 18, 20)).toBe(true);

      // Temporarily mark the two 3-tile-wide bridge rows (ty: 5..7 and ty: 14..16) unwalkable:
      // BFS from West (1,11) to East (34,11) MUST return false on 100% of seeds!
      const canBypassBridges = runWalkableBfs(
        map,
        1,
        11,
        34,
        11,
        (_tx, ty) => (ty >= 5 && ty <= 7) || (ty >= 14 && ty <= 16),
      );
      expect(
        canBypassBridges,
        `Bridge bypass detected on TWIN_BRIDGES seed=${seed}`,
      ).toBe(false);
    }
  });

  it('builds GAUNTLET_CHOKEPOINT L-walls + cross corridor (160..220px) and CENTRAL_BASTION box fortification with 2 entrances', () => {
    const map = new ArenaMap({ cols: 36, rows: 22 });

    // 1. GAUNTLET_CHOKEPOINT
    configureRoomLayout(map, {
      roomSeed: 300,
      archetype: 'GAUNTLET_CHOKEPOINT',
      biome: 1,
      activeDoorSides: ['N', 'S', 'E', 'W'],
    });
    // Verify 4 corner L-blocks exist in (8..11, 4..6), (24..27, 4..6), (8..11, 15..17), (24..27, 15..17)
    let tlSolid = 0;
    let trSolid = 0;
    let blSolid = 0;
    let brSolid = 0;
    for (let ty = 4; ty <= 6; ty++) {
      for (let tx = 8; tx <= 11; tx++) if (map.isSolidTile(tx, ty)) tlSolid++;
      for (let tx = 24; tx <= 27; tx++) if (map.isSolidTile(tx, ty)) trSolid++;
    }
    for (let ty = 15; ty <= 17; ty++) {
      for (let tx = 8; tx <= 11; tx++) if (map.isSolidTile(tx, ty)) blSolid++;
      for (let tx = 24; tx <= 27; tx++) if (map.isSolidTile(tx, ty)) brSolid++;
    }
    expect(tlSolid).toBeGreaterThanOrEqual(6);
    expect(trSolid).toBeGreaterThanOrEqual(6);
    expect(blSolid).toBeGreaterThanOrEqual(6);
    expect(brSolid).toBeGreaterThanOrEqual(6);

    // 2. CENTRAL_BASTION: verify box walls at tx: 15..20, ty: 8..13 with walkable interior (16..19, 9..12) and exactly 2 opposite entrances depending on flipX/flipY
    for (const seed of [8, 9, 10, 11]) {
      const res = configureRoomLayout(map, {
        roomSeed: seed,
        archetype: 'CENTRAL_BASTION',
        biome: 1,
        activeDoorSides: ['N', 'S', 'E', 'W'],
      });
      for (let ty = 9; ty <= 12; ty++) {
        for (let tx = 16; tx <= 19; tx++) {
          expect(map.isSolidTile(tx, ty)).toBe(false);
        }
      }
      const nsGates = [
        [17, 8],
        [18, 8],
        [17, 13],
        [18, 13],
      ] as const;
      const weGates = [
        [15, 10],
        [15, 11],
        [20, 10],
        [20, 11],
      ] as const;
      if (res.flipX !== res.flipY) {
        for (const [tx, ty] of nsGates) {
          expect(map.getTile(tx, ty)).toBe('floor');
          expect(map.isSolidTile(tx, ty)).toBe(false);
        }
        for (const [tx, ty] of weGates) {
          expect(map.getTile(tx, ty)).toBe('pillar');
          expect(map.isSolidTile(tx, ty)).toBe(true);
        }
      } else {
        for (const [tx, ty] of weGates) {
          expect(map.getTile(tx, ty)).toBe('floor');
          expect(map.isSolidTile(tx, ty)).toBe(false);
        }
        for (const [tx, ty] of nsGates) {
          expect(map.getTile(tx, ty)).toBe('pillar');
          expect(map.isSolidTile(tx, ty)).toBe(true);
        }
      }
      // Walkable from West door (1,11) and North door (18,1) into the center of the bastion (17, 10)
      expect(runWalkableBfs(map, 1, 11, 17, 10)).toBe(true);
      expect(runWalkableBfs(map, 18, 1, 17, 10)).toBe(true);
    }
  });

  it('applies deterministic flipX, flipY, and Prop Jitter (±1..2 tiles) without placing any prop anchor on solid tiles, chasm, or 3x3 door vestibules', () => {
    const map = new ArenaMap({ cols: 36, rows: 22 });

    for (const archetype of PHASE0B_ROOM_ARCHETYPES) {
      const anchorFingerprints = new Set<string>();

      for (let seed = 1; seed <= 120; seed++) {
        const resA = configureRoomLayout(map, {
          roomSeed: seed,
          archetype,
          biome: 1,
          activeDoorSides: ['N', 'S', 'E', 'W'],
        });
        const resB = configureRoomLayout(map, {
          roomSeed: seed,
          archetype,
          biome: 1,
          activeDoorSides: ['N', 'S', 'E', 'W'],
        });

        // Deterministic for identical seed
        expect(resA.propAnchors).toEqual(resB.propAnchors);
        expect(resA.propAnchors.length).toBeGreaterThanOrEqual(6);

        anchorFingerprints.add(resA.propAnchors.map((a) => `${a.tx},${a.ty}`).join('|'));

        for (const anchor of resA.propAnchors) {
          // Jitter is bounded within ±2 tiles of mirrored base anchor
          expect(Math.abs(anchor.jitterDx)).toBeLessThanOrEqual(2);
          expect(Math.abs(anchor.jitterDy)).toBeLessThanOrEqual(2);
          expect(anchor.tx).toBe(anchor.baseTx + anchor.jitterDx);
          expect(anchor.ty).toBe(anchor.baseTy + anchor.jitterDy);

          // Never on a solid tile or chasm tile
          expect(map.isSolidTile(anchor.tx, anchor.ty)).toBe(false);
          expect(map.getSurfaceAtTile(anchor.tx, anchor.ty)).not.toBe('chasm');

          // Never inside any 3x3 door vestibule
          for (const dir of ['N', 'S', 'E', 'W'] as const) {
            const v = DOOR_VESTIBULE_RECTS[dir];
            const inVestibule =
              anchor.tx >= v.minTx &&
              anchor.tx <= v.maxTx &&
              anchor.ty >= v.minTy &&
              anchor.ty <= v.maxTy;
            expect(inVestibule).toBe(false);
          }
        }
      }

      // Across 120 seeds, flipX/flipY + Prop Jitter produces multiple distinct anchor layouts
      expect(anchorFingerprints.size).toBeGreaterThanOrEqual(8);
    }
  });

  it('connects configureRoomLayout & roomArchetype into WorldSim combat/challenge rooms deterministically', () => {
    const seenArchetypes = new Set<RoomArchetypeId>();

    for (const seed of [101, 202, 303, 404, 505, 606]) {
      const sim = new WorldSim({
        seed,
        spawnInitialWave: false,
        includeTrainingDummy: false,
      });

      const combatRooms = sim.dungeon.rooms.filter((r) => r.type === 'combat');
      expect(combatRooms.length).toBeGreaterThanOrEqual(4);

      for (const room of combatRooms) {
        expect(room.roomArchetype).toBeDefined();
        expect(PHASE0B_ROOM_ARCHETYPES).toContain(room.roomArchetype);

        sim.enterRoom(room.id);
        expect(sim.roomArchetype).toBe(room.roomArchetype);
        expect(sim.map.roomArchetype).toBe(room.roomArchetype);
        seenArchetypes.add(room.roomArchetype!);

        // Verify all doors in the combat room are mutually reachable via walkable floor BFS
        const activeDirs = Object.keys(room.connections) as CardinalDir[];
        expect(areActiveDoorsConnectedBfs(sim.map, activeDirs)).toBe(true);

        // Verify no spawned prop or enemy is on a solid tile or chasm tile
        for (const prop of sim.props) {
          const ptx = Math.floor(prop.x / TILE_SIZE);
          const pty = Math.floor(prop.y / TILE_SIZE);
          expect(sim.map.isSolidTile(ptx, pty)).toBe(false);
          expect(sim.map.getSurfaceAtTile(ptx, pty)).not.toBe('chasm');
        }
        for (const e of sim.enemies) {
          if (e.isDummy || e.hp <= 0) continue;
          expect(sim.map.getSurfaceAtWorld(e.x, e.y)).not.toBe('chasm');
        }
      }
    }

    expect(seenArchetypes.has('TWIN_BRIDGES')).toBe(true);
    expect(seenArchetypes.has('GAUNTLET_CHOKEPOINT')).toBe(true);
    expect(seenArchetypes.has('CENTRAL_BASTION')).toBe(true);
    expect(selectBiome1RoomArchetype(300)).toBe('GAUNTLET_CHOKEPOINT');
  });
});
