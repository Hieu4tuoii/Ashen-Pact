import { describe, expect, it } from 'vitest';
import {
  ALL_ROOM_ARCHETYPES,
  ALL_ROOM_SHAPES,
  ALL_ROOM_SIZE_PRESETS,
  ArenaMap,
  DOOR_TILES,
  DOOR_VESTIBULE_RECTS,
  MAX_TACTICAL_PROPS_PER_ROOM,
  ROOM_SIZE_PRESET_DIMS,
  TILE_SIZE,
  WorldSim,
  areActiveDoorsConnectedBfs,
  configureRoomLayout,
  findNearestWalkablePoint,
  findNextWalkableWaypoint,
  generateDungeonFloor,
  getCrumblingRingPillarRectsForMap,
  getDoorTilesForMap,
  getDoorVestibuleRectsForMap,
  isActiveWallTile,
  isExteriorVoidWallTile,
  isInDoorVestibule,
  isWalkableTileForBfs,
} from '../src/index.js';

describe('Milestone 1 (M1_room_topology_sim): F1–F4 Dynamic Room Sizes, Shapes, Proportional Archetypes & Eviction Protection', () => {
  it('F1: defines all 6 RoomSizePreset dimensions and supports ArenaMap.resize(cols, rows) with full buffer reallocation', () => {
    expect(ALL_ROOM_SIZE_PRESETS).toEqual([
      'compact',
      'standard',
      'wide_hall',
      'tall_sanctum',
      'grand_arena',
      'colossal_boss',
    ]);
    expect(ROOM_SIZE_PRESET_DIMS).toEqual({
      compact: { cols: 28, rows: 18 },
      standard: { cols: 36, rows: 22 },
      wide_hall: { cols: 46, rows: 20 },
      tall_sanctum: { cols: 32, rows: 28 },
      grand_arena: { cols: 44, rows: 26 },
      colossal_boss: { cols: 48, rows: 28 },
    });

    const map = new ArenaMap();
    expect(map.cols).toBe(36);
    expect(map.rows).toBe(22);
    expect(map.resize(36, 22)).toBe(false);

    for (const preset of ALL_ROOM_SIZE_PRESETS) {
      const { cols, rows } = ROOM_SIZE_PRESET_DIMS[preset];
      expect(cols % 2).toBe(0);
      expect(rows % 2).toBe(0);
      const prevRev = map.mapRevision;
      const changed = map.resize(cols, rows);
      if (changed) {
        expect(map.mapRevision).toBeGreaterThan(prevRev);
      }
      expect(map.cols).toBe(cols);
      expect(map.rows).toBe(rows);
      expect(map.width).toBe(cols * TILE_SIZE);
      expect(map.height).toBe(rows * TILE_SIZE);
      const count = cols * rows;
      expect(map.tiles.length).toBe(count);
      expect(map.tileVariants.length).toBe(count);
      expect(map.surfaces.length).toBe(count);
      expect(map.baseSurfaces.length).toBe(count);
      expect(map.surfaceTimers.length).toBe(count);
      expect(map.tileVariants.some((v) => v > 0)).toBe(true);
    }

    map.clearInteriorForHub();
    expect(map.cols).toBe(36);
    expect(map.rows).toBe(22);
  });

  it('F2: generates multi-size, multi-shape dungeon floors with >= 3 presets, >= 2 shapes, unlocked TWIN_BRIDGES non-rectangular shapes, and zero adjacent combat rooms sharing (roomSizePreset, roomShape)', () => {
    expect(ALL_ROOM_SHAPES).toEqual([
      'rectangle',
      'octagon',
      'cruciform',
      'hourglass',
      'l_shape',
      't_shape',
      'u_shape',
      'donut_ring',
      'multi_chamber',
      'island_catwalk',
    ]);

    const twinBridgesShapes = new Set<string>();
    const allShapesAcrossSeeds = new Set<string>();

    for (const biome of [1, 2, 3] as const) {
      for (const floorNumber of [1, 2] as const) {
        for (let seed = 1; seed <= 30; seed++) {
          const floor = generateDungeonFloor(seed * 97 + biome * 13, floorNumber, 1, biome);
          const presetsOnFloor = new Set<string>();
          const shapesOnFloor = new Set<string>();

          for (const room of floor.rooms) {
            expect(room.roomSizePreset).toBeDefined();
            expect(room.roomShape).toBeDefined();
            const expectedDims = ROOM_SIZE_PRESET_DIMS[room.roomSizePreset!];
            expect(room.cols).toBe(expectedDims.cols);
            expect(room.rows).toBe(expectedDims.rows);
            presetsOnFloor.add(room.roomSizePreset!);
            shapesOnFloor.add(room.roomShape!);
            allShapesAcrossSeeds.add(room.roomShape!);

            if (room.type === 'start') {
              expect(room.roomSizePreset).toBe('standard');
              expect(room.roomShape).toBe('rectangle');
            } else if (room.type === 'boss') {
              expect(room.roomSizePreset).toBe('colossal_boss');
              expect(room.roomShape).toBe('octagon');
            } else if (room.type === 'shrine' || room.type === 'merchant' || room.type === 'treasure') {
              expect(room.roomSizePreset).toBe('compact');
            } else if (room.type === 'combat' && room.isChallenge) {
              expect(room.roomSizePreset).toBe('grand_arena');
            }

            if (room.roomArchetype === 'TWIN_BRIDGES') {
              expect(ALL_ROOM_SHAPES).toContain(room.roomShape!);
              twinBridgesShapes.add(room.roomShape!);
            }

            if (room.type === 'combat') {
              for (const adjId of Object.values(room.connections)) {
                if (adjId === undefined) continue;
                const adj = floor.rooms[adjId];
                if (adj && adj.type === 'combat') {
                  const samePair =
                    adj.roomSizePreset === room.roomSizePreset && adj.roomShape === room.roomShape;
                  expect(samePair).toBe(false);
                }
              }
            }
          }

          expect(presetsOnFloor.size).toBeGreaterThanOrEqual(3);
          expect(shapesOnFloor.size).toBeGreaterThanOrEqual(2);
        }
      }
    }

    expect(twinBridgesShapes.size).toBeGreaterThanOrEqual(4);
    expect([...twinBridgesShapes].some((s) => s !== 'rectangle')).toBe(true);
    expect(allShapesAcrossSeeds.size).toBe(ALL_ROOM_SHAPES.length);
  });

  it('F3: scales door tiles, vestibules, and all 6 combat archetypes across all 6 presets x 10 shapes (360 combinations) with 100% BFS connectivity', () => {
    const stdMap = new ArenaMap({ cols: 36, rows: 22 });
    expect(getDoorTilesForMap(stdMap)).toEqual(DOOR_TILES);
    expect(getDoorVestibuleRectsForMap(stdMap)).toEqual(DOOR_VESTIBULE_RECTS);

    const map = new ArenaMap();
    for (const preset of ALL_ROOM_SIZE_PRESETS) {
      const { cols, rows } = ROOM_SIZE_PRESET_DIMS[preset];
      for (const shape of ALL_ROOM_SHAPES) {
        for (const archetype of ALL_ROOM_ARCHETYPES) {
          for (const seed of [101, 202, 303, 404]) {
            const res = configureRoomLayout(map, {
              roomSeed: seed,
              archetype,
              biome: ((seed % 3) + 1) as 1 | 2 | 3,
              roomSizePreset: preset,
              cols,
              rows,
              roomShape: shape,
            });

            expect(map.cols).toBe(cols);
            expect(map.rows).toBe(rows);
            expect(areActiveDoorsConnectedBfs(map, ['N', 'S', 'E', 'W'])).toBe(true);

            const vestibules = getDoorVestibuleRectsForMap(map);
            for (const dir of ['N', 'S', 'E', 'W'] as const) {
              const rect = vestibules[dir];
              for (let ty = rect.minTy; ty <= rect.maxTy; ty++) {
                for (let tx = rect.minTx; tx <= rect.maxTx; tx++) {
                  expect(map.isSolidTile(tx, ty)).toBe(false);
                  expect(map.getSurface(tx, ty)).toBe('none');
                }
              }
            }

            for (const anchor of res.propAnchors) {
              expect(anchor.tx).toBeGreaterThanOrEqual(2);
              expect(anchor.tx).toBeLessThanOrEqual(cols - 3);
              expect(anchor.ty).toBeGreaterThanOrEqual(2);
              expect(anchor.ty).toBeLessThanOrEqual(rows - 3);
              expect(Math.abs(anchor.jitterDx)).toBeLessThanOrEqual(2);
              expect(Math.abs(anchor.jitterDy)).toBeLessThanOrEqual(2);
              expect(map.getSurface(anchor.tx, anchor.ty)).not.toBe('chasm');
              expect(isInDoorVestibule(anchor.tx, anchor.ty, map)).toBe(false);
              if (!anchor.id.startsWith('cpr_ring_pillar_')) {
                expect(map.isSolidTile(anchor.tx, anchor.ty)).toBe(false);
              }
            }

            if (archetype === 'TWIN_BRIDGES') {
              expect(res.bridgeRows.length).toBe(2);
              const [[topStart, topEnd], [botStart, botEnd]] = res.bridgeRows as [
                [number, number],
                [number, number],
              ];
              const doorTiles = getDoorTilesForMap(map);
              const visited = new Uint8Array(cols * rows);
              const q: [number, number][] = [[doorTiles.W.tx, doorTiles.W.ty]];
              visited[doorTiles.W.ty * cols + doorTiles.W.tx] = 1;
              while (q.length > 0) {
                const [cx, cy] = q.shift()!;
                for (const [dx, dy] of [
                  [1, 0],
                  [-1, 0],
                  [0, 1],
                  [0, -1],
                ] as const) {
                  const nx = cx + dx;
                  const ny = cy + dy;
                  if (!isWalkableTileForBfs(map, nx, ny)) continue;
                  const onBridgeRow =
                    (ny >= topStart && ny <= topEnd) || (ny >= botStart && ny <= botEnd);
                  if (onBridgeRow && Math.abs(nx - Math.floor(cols / 2)) <= 2) continue;
                  const idx = ny * cols + nx;
                  if (visited[idx]) continue;
                  visited[idx] = 1;
                  q.push([nx, ny]);
                }
              }
              expect(visited[doorTiles.E.ty * cols + doorTiles.E.tx]).toBe(0);
            }

            if (archetype === 'PRISM_LABYRINTH') {
              const pillarCount = map.tiles.filter((t) => t === 'pillar').length;
              expect(pillarCount).toBeGreaterThanOrEqual(40);
            }

            if (archetype === 'CRUMBLING_PILLAR_RING') {
              const ringRects = getCrumblingRingPillarRectsForMap(map);
              expect(ringRects.length).toBe(6);
              for (const [px, py] of ringRects) {
                for (let dy = 0; dy < 2; dy++) {
                  for (let dx = 0; dx < 2; dx++) {
                    expect(map.getTile(px + dx, py + dy)).toBe('pillar');
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  it('F3: WorldSim.enterRoom and enterHub resize the map and spawn all room props, chests, and items on walkable tiles', () => {
    for (const biome of [1, 2, 3] as const) {
      const sim = new WorldSim({ seed: 2026 + biome * 111, biome });
      for (const floorNum of [1, 2] as const) {
        if (floorNum === 2) sim.advanceToFloor(2);
        for (const room of sim.dungeon.rooms) {
          expect(sim.enterRoom(room.id)).toBe(true);
          expect(sim.map.cols).toBe(room.cols);
          expect(sim.map.rows).toBe(room.rows);
          expect(areActiveDoorsConnectedBfs(sim.map, Object.keys(room.connections) as any)).toBe(
            true,
          );

          for (const p of sim.props) {
            const ptx = Math.floor(p.x / TILE_SIZE);
            const pty = Math.floor(p.y / TILE_SIZE);
            expect(ptx).toBeGreaterThan(0);
            expect(ptx).toBeLessThan(sim.map.cols - 1);
            expect(pty).toBeGreaterThan(0);
            expect(pty).toBeLessThan(sim.map.rows - 1);
            expect(sim.map.getSurface(ptx, pty)).not.toBe('chasm');
            if (!(p.kind === 'rotten_totem_pillar' && sim.map.roomArchetype === 'CRUMBLING_PILLAR_RING')) {
              expect(sim.map.isSolidTile(ptx, pty)).toBe(false);
            }
          }

          for (const chest of sim.chests) {
            const ctx = Math.floor(chest.x / TILE_SIZE);
            const cty = Math.floor(chest.y / TILE_SIZE);
            expect(sim.map.isSolidTile(ctx, cty)).toBe(false);
            expect(sim.map.getSurface(ctx, cty)).not.toBe('chasm');
          }

          for (const item of sim.worldItems) {
            const itx = Math.floor(item.x / TILE_SIZE);
            const ity = Math.floor(item.y / TILE_SIZE);
            expect(sim.map.isSolidTile(itx, ity)).toBe(false);
            expect(sim.map.getSurface(itx, ity)).not.toBe('chasm');
          }
        }
      }

      sim.enterHub();
      expect(sim.map.cols).toBe(36);
      expect(sim.map.rows).toBe(22);
    }
  });

  it('F4: protects rotten_totem_pillar from eviction under MAX_TACTICAL_PROPS_PER_ROOM and clears pillar tiles if ever forced out', () => {
    const sim = new WorldSim({ seed: 4242, biome: 1 });
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat')!;
    combatRoom.roomArchetype = 'CRUMBLING_PILLAR_RING';
    combatRoom.roomSizePreset = 'grand_arena';
    combatRoom.cols = ROOM_SIZE_PRESET_DIMS.grand_arena.cols;
    combatRoom.rows = ROOM_SIZE_PRESET_DIMS.grand_arena.rows;
    combatRoom.roomShape = 'octagon';

    sim.enterRoom(combatRoom.id);
    expect(sim.props.length).toBeLessThanOrEqual(MAX_TACTICAL_PROPS_PER_ROOM);

    const ringRects = getCrumblingRingPillarRectsForMap(sim.map);
    expect(ringRects.length).toBe(6);
    expect(sim.props.filter((p) => p.kind === 'rotten_totem_pillar').length).toBe(6);

    // Spawn 6 additional destructible props beyond the 16-prop room cap
    for (let i = 0; i < 6; i++) {
      sim.spawnProp('wooden_crate', (10 + i) * TILE_SIZE + 16, 8 * TILE_SIZE + 16);
    }

    expect(sim.props.length).toBe(MAX_TACTICAL_PROPS_PER_ROOM);
    // All 6 rotten_totem_pillar props must still be intact and present!
    const remainingPillars = sim.props.filter(
      (p) => p.kind === 'rotten_totem_pillar' && p.coverState !== 'fallen',
    );
    expect(remainingPillars.length).toBe(6);
    for (const [px, py] of ringRects) {
      expect(sim.map.getTile(px, py)).toBe('pillar');
    }

    // Even if 16 rotten_totem_pillar props fill every slot and a 17th is spawned,
    // the evicted pillar's 2x2 solid 'pillar' footprint must be cleared to 'floor' (never orphaned).
    for (let i = 0; i < 12; i++) {
      sim.spawnProp('rotten_totem_pillar', 6 * TILE_SIZE + 16, 6 * TILE_SIZE + 16);
    }
    const [firstPx, firstPy] = ringRects[0]!;
    const stillHasFirstRingPillarProp = sim.props.some(
      (p) =>
        p.kind === 'rotten_totem_pillar' &&
        Math.hypot(p.x - (firstPx + 1) * TILE_SIZE, p.y - (firstPy + 1) * TILE_SIZE) < 8,
    );
    if (!stillHasFirstRingPillarProp) {
      expect(sim.map.getTile(firstPx, firstPy)).toBe('floor');
      expect(sim.map.getTile(firstPx + 1, firstPy + 1)).toBe('floor');
    }
  });

  it('Adversarial Regressions: 4P co-op spawn walkability on TWIN_BRIDGES hourglass, boss room 4-door BFS on all presets, and totem vs brazier eviction', () => {
    const sim = new WorldSim({ seed: 7777, biome: 2, playerCount: 4 });
    sim.addCoopPlayer(2, 'ranger', 'P2', 2);
    sim.addCoopPlayer(3, 'elementalist', 'P3', 3);
    sim.addCoopPlayer(4, 'engineer', 'P4', 4);
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat')!;

    for (const preset of ALL_ROOM_SIZE_PRESETS) {
      const dims = ROOM_SIZE_PRESET_DIMS[preset];
      for (const shape of ALL_ROOM_SHAPES) {
        combatRoom.roomSizePreset = preset;
        combatRoom.cols = dims.cols;
        combatRoom.rows = dims.rows;
        combatRoom.roomShape = shape;
        combatRoom.roomArchetype = 'TWIN_BRIDGES';
        for (const entryDir of ['N', 'S', 'E', 'W'] as const) {
          sim.enterRoom(combatRoom.id, entryDir);
          for (const pl of sim.getAllPlayers()) {
            const tx = Math.floor(pl.x / TILE_SIZE);
            const ty = Math.floor(pl.y / TILE_SIZE);
            expect(sim.map.isSolidTile(tx, ty)).toBe(false);
            expect(sim.map.getSurface(tx, ty)).not.toBe('chasm');
            expect(sim.map.checkProjectileWallHit(pl.x, pl.y, pl.radius - 0.5).hit).toBe(false);
          }
        }

        // Boss room 4-door BFS connectivity even when activeDoorSides has 1 door
        sim.map.configureRoomLayout('boss', 7777, false, 2, undefined, ['S'], {
          cols: dims.cols,
          rows: dims.rows,
          roomShape: shape,
          roomSizePreset: preset,
        });
        expect(areActiveDoorsConnectedBfs(sim.map, ['N', 'S', 'E', 'W'])).toBe(true);
      }
    }

    // Eviction priority: torch_brazier must be evicted before pillar-backed rotten_totem_pillar
    sim.enterRoom(combatRoom.id);
    sim.props.length = 0;
    sim.map.setTile(10, 8, 'pillar');
    sim.map.rebuildSolidBoxes();
    const totem = sim.spawnProp('rotten_totem_pillar', 10 * TILE_SIZE + 16, 8 * TILE_SIZE + 16);
    for (let i = 1; i < MAX_TACTICAL_PROPS_PER_ROOM; i++) {
      sim.spawnProp('torch_brazier', (6 + (i % 6)) * TILE_SIZE + 16, 5 * TILE_SIZE + 16);
    }
    expect(sim.props.length).toBe(MAX_TACTICAL_PROPS_PER_ROOM);
    sim.spawnProp('torch_brazier', 14 * TILE_SIZE + 16, 5 * TILE_SIZE + 16);
    expect(sim.props.some((p) => p.id === totem.id)).toBe(true);
  });

  it('F11: carves deep Enter-the-Gungeon silhouettes (10 RoomShapeKinds) with >= 24..60 Exterior Void tiles, 1-tile active sculpted walls, and center-walkability relocation guards', () => {
    const map = new ArenaMap();
    for (const preset of ALL_ROOM_SIZE_PRESETS) {
      const { cols, rows } = ROOM_SIZE_PRESET_DIMS[preset];
      const minExpectedVoid =
        preset === 'compact' ? 24 : preset === 'grand_arena' || preset === 'colossal_boss' ? 60 : 40;

      for (const shape of ALL_ROOM_SHAPES) {
        configureRoomLayout(map, {
          roomSeed: 909,
          archetype: 'GAUNTLET_CHOKEPOINT',
          biome: 1,
          roomSizePreset: preset,
          cols,
          rows,
          roomShape: shape,
        });

        let voidCount = 0;
        let activeWallCount = 0;
        let chasmCount = 0;
        for (let ty = 0; ty < rows; ty++) {
          for (let tx = 0; tx < cols; tx++) {
            if (isExteriorVoidWallTile(map, tx, ty)) {
              voidCount += 1;
              expect(map.getTile(tx, ty)).toBe('wall');
              expect(isActiveWallTile(map, tx, ty)).toBe(false);
            }
            if (isActiveWallTile(map, tx, ty)) {
              activeWallCount += 1;
            }
            if (map.getSurface(tx, ty) === 'chasm') {
              chasmCount += 1;
            }
          }
        }

        expect(activeWallCount).toBeGreaterThan(20);
        if (shape === 'rectangle') {
          expect(voidCount).toBe(0);
        } else {
          expect(voidCount).toBeGreaterThanOrEqual(minExpectedVoid);
        }
        if (shape === 'island_catwalk') {
          expect(chasmCount).toBeGreaterThanOrEqual(20);
        }
      }
    }

    // Center-walkability relocation on donut_ring, u_shape, multi_chamber, and island_catwalk
    const sim = new WorldSim({ seed: 5150, biome: 1, playerCount: 1 });
    for (const shape of ['donut_ring', 'u_shape', 'multi_chamber', 'island_catwalk'] as const) {
      for (const room of sim.dungeon.rooms) {
        if (room.type === 'start') continue;
        room.roomShape = shape;
        expect(sim.enterRoom(room.id)).toBe(true);

        for (const npc of sim.npcEntities) {
          const ntx = Math.floor(npc.x / TILE_SIZE);
          const nty = Math.floor(npc.y / TILE_SIZE);
          expect(sim.map.isSolidTile(ntx, nty)).toBe(false);
          expect(sim.map.getSurface(ntx, nty)).not.toBe('chasm');
        }
        if (room.type === 'portal' || room.type === 'boss') {
          const ptx = Math.floor(sim.portalX / TILE_SIZE);
          const pty = Math.floor(sim.portalY / TILE_SIZE);
          expect(sim.map.isSolidTile(ptx, pty)).toBe(false);
          expect(sim.map.getSurface(ptx, pty)).not.toBe('chasm');
        }
        for (const pk of sim.pickups) {
          const ktx = Math.floor(pk.x / TILE_SIZE);
          const kty = Math.floor(pk.y / TILE_SIZE);
          expect(sim.map.isSolidTile(ktx, kty)).toBe(false);
          expect(sim.map.getSurface(ktx, kty)).not.toBe('chasm');
        }

        const safeCenter = findNearestWalkablePoint(
          sim.map,
          sim.map.width * 0.5,
          sim.map.height * 0.5,
          14,
        );
        expect(
          isWalkableTileForBfs(
            sim.map,
            Math.floor(safeCenter.x / TILE_SIZE),
            Math.floor(safeCenter.y / TILE_SIZE),
          ),
        ).toBe(true);

        sim.spawnCoopPressurePlatePuzzle(room.id);
        for (const plate of sim.pressurePlates) {
          const plTx = Math.floor(plate.x / TILE_SIZE);
          const plTy = Math.floor(plate.y / TILE_SIZE);
          expect(sim.map.isSolidTile(plTx, plTy)).toBe(false);
          expect(sim.map.getSurface(plTx, plTy)).not.toBe('chasm');
        }
        for (const block of sim.pushBlocks) {
          const bTx = Math.floor(block.x / TILE_SIZE);
          const bTy = Math.floor(block.y / TILE_SIZE);
          expect(sim.map.isSolidTile(bTx, bTy)).toBe(false);
          expect(sim.map.getSurface(bTx, bTy)).not.toBe('chasm');
        }

        const wp = findNextWalkableWaypoint(
          sim.map,
          sim.player.x,
          sim.player.y,
          sim.map.width * 0.5,
          sim.map.height * 0.5,
        );
        expect(
          isWalkableTileForBfs(
            sim.map,
            Math.floor(wp.x / TILE_SIZE),
            Math.floor(wp.y / TILE_SIZE),
          ),
        ).toBe(true);
      }
    }
  });
});
