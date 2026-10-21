import { ArenaMap, type RoomType, TILE_SIZE, WorldSim } from '@ashen-pact/shared';
import { describe, expect, it } from 'vitest';
import {
  buildRoomArchitecturePlan,
  computeTileDistToWall,
  getVisibleFloorDecals,
  isFloorDecalVisible,
} from '../src/world/biome-architecture.js';

function canReachAllFourDoorsViaBfs(map: ArenaMap): boolean {
  const midX = Math.floor(map.cols / 2);
  const midY = Math.floor(map.rows / 2);
  const doors: readonly [number, number][] = [
    [midX, 1], // North door floor tile
    [midX, map.rows - 2], // South door floor tile
    [1, midY], // West door floor tile
    [map.cols - 2, midY], // East door floor tile
  ];

  for (const [dx, dy] of doors) {
    if (map.isSolidTile(dx, dy)) return false;
  }

  const start = doors[2]!;
  const visited = new Set<string>([`${start[0]},${start[1]}`]);
  const queue: [number, number][] = [start];

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    const neighbors: readonly [number, number][] = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx <= 0 || nx >= map.cols - 1 || ny <= 0 || ny >= map.rows - 1) continue;
      if (map.isSolidTile(nx, ny)) continue;
      const key = `${nx},${ny}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }

  return doors.every(([dx, dy]) => visited.has(`${dx},${dy}`));
}

describe('Phase P5 — Biome Architectural Identity (P1/P2/P3/P4), Room Brazier Counts & 5 DoD Invariants', () => {
  it('(1) preserves 100% walkable BFS connectivity between all 4 room doors (N, S, E, W) across all biomes and room types with 0 solid decors on walkable floor', () => {
    const roomTypes: readonly RoomType[] = [
      'start',
      'combat',
      'treasure',
      'merchant',
      'shrine',
      'portal',
      'boss',
    ];
    for (const biome of [0, 1, 2, 3] as const) {
      for (const roomType of roomTypes) {
        const simBiome: 1 | 2 | 3 = biome === 0 ? 1 : biome;
        const map = new ArenaMap({
          cols: 36,
          rows: 22,
          includePillars: true,
          seed: 1337 + biome * 31,
          biome: simBiome,
        });
        map.configureRoomLayout(roomType, 1337 + biome * 31, false, simBiome);

        const plan = buildRoomArchitecturePlan(map, roomType, biome, 1337 + biome * 31);
        expect(canReachAllFourDoorsViaBfs(map)).toBe(true);

        // No solid decor on walkable floor tiles
        for (const item of plan.solidDecors) {
          expect(map.isSolidTile(item.tx, item.ty)).toBe(true);
        }
        // Floor decals must never have volume or sit on solid tiles
        for (const decal of plan.floorDecals) {
          expect(decal.hasVolume).toBe(false);
          expect(map.isSolidTile(decal.tx, decal.ty)).toBe(false);
        }
      }
    }
  });

  it('(2) places every volume-bearing solidDecor strictly on wall/pillar tiles, and places forge_anvil & fluted_column strictly on pillar tiles', () => {
    const seenKinds = new Set<string>();

    for (const biome of [0, 1, 2, 3] as const) {
      for (const seed of [101, 202, 303, 1337, 4040, 7777]) {
        const simBiome: 1 | 2 | 3 = biome === 0 ? 1 : biome;
        const map = new ArenaMap({
          cols: 36,
          rows: 22,
          includePillars: true,
          seed,
          biome: simBiome,
        });
        map.configureRoomLayout('combat', seed, false, simBiome);
        const plan = buildRoomArchitecturePlan(map, 'combat', biome, seed);

        for (const item of plan.solidDecors) {
          seenKinds.add(item.kind);
          expect(item.hasVolume).toBe(true);
          expect(map.isSolidTile(item.tx, item.ty)).toBe(true);

          if (item.kind === 'forge_anvil' || item.kind === 'fluted_column') {
            expect(map.getTile(item.tx, item.ty)).toBe('pillar');
          }
        }

        // Every pillar shadow has length in [40, 64]u (South-East -135 deg key light)
        for (const shadow of plan.pillarShadows) {
          expect(shadow.shadowLengthU).toBeGreaterThanOrEqual(40);
          expect(shadow.shadowLengthU).toBeLessThanOrEqual(64);
        }
      }
    }

    // Verify all P5 solid architectural motif kinds are exercised
    expect(seenKinds.has('brazier_pedestal')).toBe(true);
    expect(seenKinds.has('fluted_column')).toBe(true);
    expect(seenKinds.has('fluted_pilaster')).toBe(true);
    expect(seenKinds.has('forge_anvil')).toBe(true);
    expect(seenKinds.has('brass_gear_wall')).toBe(true);
    expect(seenKinds.has('steam_pipe_wall')).toBe(true);
    expect(seenKinds.has('ice_alcove')).toBe(true);
    expect(seenKinds.has('frost_crystal_cluster')).toBe(true);
    expect(seenKinds.has('root_base')).toBe(true);
    expect(seenKinds.has('mushroom_cluster')).toBe(true);
    expect(seenKinds.has('cliff_vines')).toBe(true);
    expect(seenKinds.has('wrought_iron_fence')).toBe(true);
  });

  it('(3) enforces density budgets (<= 8 large, <= 1/3 small perimeter, >= 40% empty perimeter, 0 center solid), 2-of-3 perimeter motif selection per seed, B2 God-rays, and WorldSim room-type brazier counts', () => {
    // 3a. Density budget + 2-of-3 perimeter motif selection across seeds
    for (const biome of [1, 2, 3] as const) {
      const distinctMotifPairs = new Set<string>();
      for (const seed of [11, 22, 33, 44, 55, 66, 77, 88, 99, 1337]) {
        const map = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed, biome });
        map.configureRoomLayout('combat', seed, false, biome);
        const plan = buildRoomArchitecturePlan(map, 'combat', biome, seed);

        expect(plan.selectedMotifs.length).toBe(2);
        expect(plan.selectedMotifs[0]).not.toBe(plan.selectedMotifs[1]);
        distinctMotifPairs.add([...plan.selectedMotifs].sort().join('+'));

        expect(plan.budget.largeDecorCount).toBeLessThanOrEqual(8);
        expect(plan.budget.smallPerimeterDecorCount).toBeLessThanOrEqual(
          Math.floor(plan.budget.perimeterTileCount / 3),
        );
        expect(plan.budget.emptyPerimeterRatio).toBeGreaterThanOrEqual(0.4);
        expect(plan.budget.centerArenaSolidDecorCount).toBe(0);

        if (biome === 2) {
          expect(plan.godRays.length).toBeGreaterThanOrEqual(2);
          expect(plan.godRays.length).toBeLessThanOrEqual(3);
          for (const ray of plan.godRays) {
            expect(ray.angleDeg).toBe(-135);
            expect(ray.widthU).toBeGreaterThanOrEqual(60);
            expect(ray.widthU).toBeLessThanOrEqual(90);
            expect(ray.maxAlpha).toBeLessThanOrEqual(0.06);
          }
        } else {
          expect(plan.godRays.length).toBe(0);
        }
      }
      expect(distinctMotifPairs.size).toBeGreaterThanOrEqual(2);
    }

    // 3b. WorldSim room-type torch_brazier counts (Spec 3.5 & Ruling 1)
    const sim = new WorldSim({ seed: 1337, biome: 1 });
    const countBraziers = (): number =>
      sim.props.filter((p) => p.kind === 'torch_brazier').length;

    // Start room: 2 braziers flanking entrance, preserving NW brazier at (8 * TILE_SIZE - 14, 5 * TILE_SIZE - 12)
    sim.enterRoom(sim.dungeon.startRoomId);
    const startBraziers = sim.props.filter((p) => p.kind === 'torch_brazier');
    expect(startBraziers.length).toBe(2);
    expect(
      startBraziers.some(
        (b) => b.x === 8 * TILE_SIZE - 14 && b.y === 5 * TILE_SIZE - 12,
      ),
    ).toBe(true);
    expect(
      startBraziers.some(
        (b) => b.x === 8 * TILE_SIZE - 14 && b.y === 17 * TILE_SIZE + 12,
      ),
    ).toBe(true);

    // Combat rooms: 3 or 4 braziers (first combat room keeps 4; non-first combat rooms can drop 1 by seed)
    const seenCombatCounts = new Set<number>();
    for (const testSeed of [1337, 2026, 4096, 8192]) {
      const s = new WorldSim({ seed: testSeed, biome: 1 });
      const combatRooms = s.dungeon.rooms.filter((r) => r.type === 'combat');
      for (const r of combatRooms) {
        s.enterRoom(r.id);
        const c = s.props.filter((p) => p.kind === 'torch_brazier').length;
        expect(c).toBeGreaterThanOrEqual(3);
        expect(c).toBeLessThanOrEqual(4);
        seenCombatCounts.add(c);
      }
    }
    expect(seenCombatCounts.has(4)).toBe(true);
    expect(seenCombatCounts.has(3)).toBe(true);

    // Treasure, Merchant, Shrine, Portal: 2 braziers each
    for (const rType of ['treasure', 'merchant', 'shrine', 'portal'] as const) {
      const room = sim.dungeon.rooms.find((r) => r.type === rType);
      if (room) {
        sim.enterRoom(room.id);
        expect(countBraziers()).toBe(2);
      }
    }

    // Boss room (advance to floor 2 where boss room exists): 6..8 symmetrical braziers
    sim.advanceToFloor(2);
    const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
    sim.enterRoom(bossRoom.id);
    const bossBrazierCount = countBraziers();
    expect(bossBrazierCount).toBeGreaterThanOrEqual(6);
    expect(bossBrazierCount).toBeLessThanOrEqual(8);
  });

  it('(4) forbids hazard-like glowing decor outside real sim surfaces (hasHazardGlow === false, stepping_stone on dry floor only, grated_heat_channel covered by iron grate in perimeter)', () => {
    for (const biome of [0, 1, 2, 3] as const) {
      const simBiome: 1 | 2 | 3 = biome === 0 ? 1 : biome;
      const map = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome: simBiome });
      map.configureRoomLayout('combat', 1337, false, simBiome);
      const plan = buildRoomArchitecturePlan(map, 'combat', biome, 1337);

      for (const solid of plan.solidDecors) {
        expect(solid.hasHazardGlow).toBe(false);
      }

      for (const decal of plan.floorDecals) {
        expect(decal.hasHazardGlow).toBe(false);
        expect(map.getSurface(decal.tx, decal.ty)).toBe('none');

        if (decal.kind === 'stepping_stone') {
          expect(map.getSurface(decal.tx, decal.ty)).toBe('none');
          const bordersWet =
            map.getSurface(decal.tx - 1, decal.ty) === 'poison_swamp' ||
            map.getSurface(decal.tx + 1, decal.ty) === 'poison_swamp' ||
            map.getSurface(decal.tx, decal.ty - 1) === 'poison_swamp' ||
            map.getSurface(decal.tx, decal.ty + 1) === 'poison_swamp' ||
            map.getSurface(decal.tx - 1, decal.ty) === 'water' ||
            map.getSurface(decal.tx + 1, decal.ty) === 'water' ||
            map.getSurface(decal.tx, decal.ty - 1) === 'water' ||
            map.getSurface(decal.tx, decal.ty + 1) === 'water';
          expect(bordersWet).toBe(true);
        }

        if (decal.kind === 'grated_heat_channel') {
          expect(decal.hasIronGrateCover).toBe(true);
          expect(decal.maxGlowAlpha).toBeLessThanOrEqual(0.3);
          expect(computeTileDistToWall(map, decal.tx, decal.ty)).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('(5) hides all floor decals on tiles flooded by applyBossPhase3ToxicBorder(), applyBossPhase3BlizzardBorder(), and applyBossPhase3LavaBorder()', () => {
    const bossConfigs: ReadonlyArray<{
      biome: 1 | 2 | 3;
      applyPhase3: (m: ArenaMap) => void;
    }> = [
      { biome: 1, applyPhase3: (m) => m.applyBossPhase3ToxicBorder() },
      { biome: 2, applyPhase3: (m) => m.applyBossPhase3BlizzardBorder() },
      { biome: 3, applyPhase3: (m) => m.applyBossPhase3LavaBorder() },
    ];

    for (const { biome, applyPhase3 } of bossConfigs) {
      // Check both combat room plan (which has perimeter floor decals) and boss room plan
      for (const roomType of ['combat', 'boss'] as const) {
        const map = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome });
        map.configureRoomLayout(roomType, 1337, false, biome);
        const plan = buildRoomArchitecturePlan(map, roomType, biome, 1337);

        applyPhase3(map);

        const visibleDecals = getVisibleFloorDecals(plan, map);
        for (const decal of visibleDecals) {
          expect(map.getSurface(decal.tx, decal.ty)).toBe('none');
          expect(isFloorDecalVisible(decal, map)).toBe(true);
        }

        for (const decal of plan.floorDecals) {
          if (map.getSurface(decal.tx, decal.ty) !== 'none') {
            expect(isFloorDecalVisible(decal, map)).toBe(false);
            expect(visibleDecals.includes(decal)).toBe(false);
          }
        }
      }
    }
  });
});
