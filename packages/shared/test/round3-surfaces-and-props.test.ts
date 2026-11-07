import { describe, expect, it } from 'vitest';
import {
  ALL_ROOM_ARCHETYPES,
  ALL_ROOM_SHAPES,
  ALL_ROOM_SIZE_PRESETS,
  AUTOTILE_EAST,
  AUTOTILE_NORTH,
  AUTOTILE_SOUTH,
  AUTOTILE_WEST,
  ArenaMap,
  ROOM_SIZE_PRESET_DIMS,
  TILE_SIZE,
  WorldSim,
  configureRoomLayout,
  generateDungeonFloor,
  spawnCombatRoomArchetypeProps,
  type SurfaceKind,
} from '../src/index.js';
import {
  AVERAGE_PLAYER_BOT_PROFILE,
  measureBiomeDifficultyProgression,
} from '../../../tools/balance-harness.js';

const FORBIDDEN_PROP_SURFACES = new Set<string>([
  'chasm',
  'ice',
  'lava',
  'conveyor',
  'conveyor_north',
  'conveyor_south',
  'conveyor_east',
  'conveyor_west',
  'burning_oil',
  'burning_grass',
]);

describe('Round 3 (M1_r3_sim_surfaces_and_props / F15): Surface Autotile Families & Hazard-Safe Prop/Brazier Placement', () => {
  it('computes perimeter autotile masks (< 15) on outer borders and 15 only on interior tiles of burning_grass pools surrounded by none, grass, or ash', () => {
    const map = new ArenaMap({ cols: 36, rows: 22, seed: 301 });

    // 1. 4x3 burning_grass pool surrounded by 'none' at tx = 10..13, ty = 8..10
    for (let ty = 8; ty <= 10; ty++) {
      for (let tx = 10; tx <= 13; tx++) {
        map.setSurface(tx, ty, 'burning_grass', 4.0, true);
      }
    }

    // 4 outer corners have exactly 2 neighbor bits (< 15)
    expect(map.getSurfaceAutotileMask(10, 8)).toBe(AUTOTILE_EAST | AUTOTILE_SOUTH);
    expect(map.getSurfaceAutotileMask(13, 8)).toBe(AUTOTILE_WEST | AUTOTILE_SOUTH);
    expect(map.getSurfaceAutotileMask(10, 10)).toBe(AUTOTILE_NORTH | AUTOTILE_EAST);
    expect(map.getSurfaceAutotileMask(13, 10)).toBe(AUTOTILE_NORTH | AUTOTILE_WEST);

    // Non-corner outer edges have 3 neighbor bits (< 15)
    expect(map.getSurfaceAutotileMask(11, 8)).toBe(AUTOTILE_EAST | AUTOTILE_SOUTH | AUTOTILE_WEST);
    expect(map.getSurfaceAutotileMask(12, 8)).toBe(AUTOTILE_EAST | AUTOTILE_SOUTH | AUTOTILE_WEST);
    expect(map.getSurfaceAutotileMask(11, 10)).toBe(AUTOTILE_NORTH | AUTOTILE_EAST | AUTOTILE_WEST);
    expect(map.getSurfaceAutotileMask(12, 10)).toBe(AUTOTILE_NORTH | AUTOTILE_EAST | AUTOTILE_WEST);
    expect(map.getSurfaceAutotileMask(10, 9)).toBe(AUTOTILE_NORTH | AUTOTILE_EAST | AUTOTILE_SOUTH);
    expect(map.getSurfaceAutotileMask(13, 9)).toBe(AUTOTILE_NORTH | AUTOTILE_SOUTH | AUTOTILE_WEST);

    // Every outer border tile has mask < 15; strictly interior tiles have mask === 15
    for (let ty = 8; ty <= 10; ty++) {
      for (let tx = 10; tx <= 13; tx++) {
        const mask = map.getSurfaceAutotileMask(tx, ty);
        const isInterior = tx > 10 && tx < 13 && ty > 8 && ty < 10;
        if (isInterior) {
          expect(mask).toBe(15);
        } else {
          expect(mask).toBeLessThan(15);
        }
      }
    }

    // Isolated 1x1 burning_grass tile has mask === 0
    map.setSurface(20, 10, 'burning_grass', 4.0, true);
    expect(map.getSurfaceAutotileMask(20, 10)).toBe(0);

    // 2. 3x3 burning_grass pool surrounded by 'grass' and 'ash'
    const mapFoliage = new ArenaMap({ cols: 36, rows: 22, seed: 302 });
    for (let ty = 6; ty <= 12; ty++) {
      for (let tx = 8; tx <= 14; tx++) {
        mapFoliage.setSurface(tx, ty, tx >= 12 ? 'ash' : 'grass', 0, true);
      }
    }
    for (let ty = 8; ty <= 10; ty++) {
      for (let tx = 10; tx <= 12; tx++) {
        mapFoliage.setSurface(tx, ty, 'burning_grass', 4.0, true);
      }
    }

    for (let ty = 8; ty <= 10; ty++) {
      for (let tx = 10; tx <= 12; tx++) {
        const mask = mapFoliage.getSurfaceAutotileMask(tx, ty);
        if (tx === 11 && ty === 9) {
          expect(mask).toBe(15);
        } else {
          expect(mask).toBeLessThan(15);
        }
      }
    }

    // Neighboring grass/ash tiles do not set autotile bits toward burning_grass
    expect(mapFoliage.getSurfaceAutotileMask(10, 7) & AUTOTILE_SOUTH).toBe(0);
    expect(mapFoliage.getSurfaceAutotileMask(9, 9) & AUTOTILE_EAST).toBe(0);
    expect(mapFoliage.getSurfaceAutotileMask(13, 9) & AUTOTILE_WEST).toBe(0);
    // Grass and ash still connect seamlessly with each other
    expect(mapFoliage.isSameSurfaceFamily('grass', 'ash')).toBe(true);
    expect(mapFoliage.isSameSurfaceFamily('ash', 'grass')).toBe(true);
    expect(mapFoliage.getSurfaceAutotileMask(11, 7) & AUTOTILE_EAST).toBe(AUTOTILE_EAST);
    expect(mapFoliage.getSurfaceAutotileMask(12, 7) & AUTOTILE_WEST).toBe(AUTOTILE_WEST);
  });

  it('separates solid ice from water/electrified_water and oil from burning_oil while keeping water + electrified_water connected', () => {
    const map = new ArenaMap({ cols: 36, rows: 22, seed: 303 });

    // Direct family symmetry and separation assertions
    const allSurfaces: SurfaceKind[] = [
      'none',
      'water',
      'electrified_water',
      'oil',
      'burning_oil',
      'grass',
      'burning_grass',
      'ash',
      'poison_swamp',
      'lava',
      'ice',
      'chasm',
      'conveyor',
    ];
    for (const a of allSurfaces) {
      expect(map.isSameSurfaceFamily(a, a)).toBe(true);
      for (const b of allSurfaces) {
        expect(map.isSameSurfaceFamily(a, b)).toBe(map.isSameSurfaceFamily(b, a));
      }
    }

    expect(map.isSameSurfaceFamily('ice', 'water')).toBe(false);
    expect(map.isSameSurfaceFamily('water', 'ice')).toBe(false);
    expect(map.isSameSurfaceFamily('ice', 'electrified_water')).toBe(false);
    expect(map.isSameSurfaceFamily('water', 'electrified_water')).toBe(true);
    expect(map.isSameSurfaceFamily('oil', 'burning_oil')).toBe(false);
    expect(map.isSameSurfaceFamily('burning_grass', 'grass')).toBe(false);
    expect(map.isSameSurfaceFamily('burning_grass', 'ash')).toBe(false);
    expect(map.isSameSurfaceFamily('burning_grass', 'none')).toBe(false);

    // Adjacent 3x3 ice pool (10..12, 10..12), 3x3 water pool (13..15, 10..12), and 3x3 electrified_water pool (10..12, 13..15)
    for (let ty = 10; ty <= 12; ty++) {
      for (let tx = 10; tx <= 12; tx++) {
        map.setSurface(tx, ty, 'ice', 0, true);
      }
      for (let tx = 13; tx <= 15; tx++) {
        map.setSurface(tx, ty, 'water', 0, true);
      }
    }
    for (let ty = 13; ty <= 15; ty++) {
      for (let tx = 10; tx <= 12; tx++) {
        map.setSurface(tx, ty, 'electrified_water', 2.0, true);
      }
    }

    // Vertical boundary tx = 12 (ice) | tx = 13 (water): neither connects across the boundary
    for (let ty = 10; ty <= 12; ty++) {
      expect(map.getSurfaceAutotileMask(12, ty) & AUTOTILE_EAST).toBe(0);
      expect(map.getSurfaceAutotileMask(13, ty) & AUTOTILE_WEST).toBe(0);
    }

    // Horizontal boundary ty = 12 (ice) | ty = 13 (electrified_water): neither connects across the boundary
    for (let tx = 10; tx <= 12; tx++) {
      expect(map.getSurfaceAutotileMask(tx, 12) & AUTOTILE_SOUTH).toBe(0);
      expect(map.getSurfaceAutotileMask(tx, 13) & AUTOTILE_NORTH).toBe(0);
    }

    // Water and electrified_water DO connect across their shared boundary
    map.setSurface(20, 10, 'water', 0, true);
    map.setSurface(21, 10, 'electrified_water', 2.0, true);
    expect(map.getSurfaceAutotileMask(20, 10) & AUTOTILE_EAST).toBe(AUTOTILE_EAST);
    expect(map.getSurfaceAutotileMask(21, 10) & AUTOTILE_WEST).toBe(AUTOTILE_WEST);

    // Oil and burning_oil do NOT connect across their boundary
    map.setSurface(24, 10, 'oil', 0, true);
    map.setSurface(25, 10, 'burning_oil', 2.0, true);
    expect(map.getSurfaceAutotileMask(24, 10) & AUTOTILE_EAST).toBe(0);
    expect(map.getSurfaceAutotileMask(25, 10) & AUTOTILE_WEST).toBe(0);
  });

  it('places all propAnchors (including forge_blast_shield and slag_crucible) onto dry none floor across all 360 (preset x shape x archetype) combinations and biomes 1..3', () => {
    const map = new ArenaMap();
    let totalAnchorsChecked = 0;

    for (const preset of ALL_ROOM_SIZE_PRESETS) {
      const { cols, rows } = ROOM_SIZE_PRESET_DIMS[preset];
      for (const shape of ALL_ROOM_SHAPES) {
        for (const archetype of ALL_ROOM_ARCHETYPES) {
          for (const biome of [1, 2, 3] as const) {
            const roomSeed =
              preset.length * 1009 + shape.length * 271 + archetype.length * 97 + biome * 31;
            const res = configureRoomLayout(map, {
              roomSeed,
              archetype,
              biome,
              roomSizePreset: preset,
              cols,
              rows,
              roomShape: shape,
            });

            expect(res.propAnchors.length).toBeGreaterThanOrEqual(6);
            for (const anchor of res.propAnchors) {
              const surface = map.getSurface(anchor.tx, anchor.ty);
              expect(FORBIDDEN_PROP_SURFACES.has(surface)).toBe(false);
              expect(surface).toBe('none');
              if (!anchor.id.startsWith('cpr_ring_pillar_')) {
                expect(map.isSolidTile(anchor.tx, anchor.ty)).toBe(false);
              }
              totalAnchorsChecked += 1;
            }
          }
        }
      }
    }

    expect(totalAnchorsChecked).toBeGreaterThan(6000);
  });

  it('spawns torch_brazier, forge_blast_shield, and slag_crucible props strictly on dry walkable floor across TWIN_BRIDGES, CROSSFIRE_CONVEYORS, all room shapes, Boss rooms, and adversarial hazard patches', () => {
    const sim = new WorldSim({
      seed: 3040,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;

    // 1. Verify across all 10 room shapes x 6 archetypes x biomes 1..3 on standard and compact presets
    for (const preset of ['standard', 'compact', 'wide_hall'] as const) {
      const { cols, rows } = ROOM_SIZE_PRESET_DIMS[preset];
      for (const shape of ALL_ROOM_SHAPES) {
        for (const archetype of ALL_ROOM_ARCHETYPES) {
          for (const biome of [1, 2, 3] as const) {
            sim.props.length = 0;
            configureRoomLayout(sim.map, {
              roomSeed: 700 + biome * 53 + shape.length * 19,
              archetype,
              biome,
              roomSizePreset: preset,
              cols,
              rows,
              roomShape: shape,
            });
            spawnCombatRoomArchetypeProps(sim, combatRoom);

            const braziers = sim.props.filter((p) => p.kind === 'torch_brazier');
            expect(braziers.length).toBeGreaterThanOrEqual(3);

            for (const p of sim.props) {
              if (
                p.kind === 'torch_brazier' ||
                p.kind === 'forge_blast_shield' ||
                p.kind === 'slag_crucible' ||
                p.kind === 'glacial_barricade' ||
                p.kind === 'sliding_ice_block'
              ) {
                const tx = Math.floor(p.x / TILE_SIZE);
                const ty = Math.floor(p.y / TILE_SIZE);
                expect(sim.map.isSolidTile(tx, ty)).toBe(false);
                const surface = sim.map.getSurface(tx, ty);
                expect(FORBIDDEN_PROP_SURFACES.has(surface)).toBe(false);
                expect(surface).toBe('none');
              }
            }
          }
        }
      }
    }

    // 2. Verify Boss room torch_brazier props in Biomes 1, 2, 3 never spawn on lava, ice, or conveyor
    for (const biome of [1, 2, 3] as const) {
      const bossSim = new WorldSim({
        seed: 4100 + biome * 111,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: true,
        autoRespawnWaves: false,
      });
      bossSim.currentBiome = biome;
      bossSim.dungeon = generateDungeonFloor(4100 + biome * 111, 2, 1, biome);
      const bossRoom = bossSim.dungeon.rooms.find((r) => r.type === 'boss');
      expect(bossRoom).toBeDefined();
      bossSim.enterRoom(bossRoom!.id);

      const bossBraziers = bossSim.props.filter((p) => p.kind === 'torch_brazier');
      expect(bossBraziers.length).toBe(6);
      for (const brazier of bossBraziers) {
        const tx = Math.floor(brazier.x / TILE_SIZE);
        const ty = Math.floor(brazier.y / TILE_SIZE);
        expect(bossSim.map.isSolidTile(tx, ty)).toBe(false);
        expect(bossSim.map.getSurface(tx, ty)).toBe('none');
      }
    }

    // 3. Adversarial case: default brazier corners covered by 4x4 ice, lava, and conveyor patches
    for (const hazardSurface of ['ice', 'lava', 'conveyor'] as const) {
      sim.props.length = 0;
      configureRoomLayout(sim.map, {
        roomSeed: 999,
        archetype: 'TWIN_BRIDGES',
        biome: 3,
        roomSizePreset: 'standard',
        cols: 36,
        rows: 22,
        roomShape: 'rectangle',
      });
      const bLeftX = Math.max(5, Math.round((7 * sim.map.cols) / 36));
      const bRightX = sim.map.cols - 1 - bLeftX;
      const bTopY = Math.max(3, Math.round((4 * sim.map.rows) / 22));
      const bBotY = sim.map.rows - 1 - bTopY;
      for (const [cx, cy] of [
        [bLeftX, bTopY],
        [bRightX, bTopY],
        [bLeftX, bBotY],
        [bRightX, bBotY],
      ] as const) {
        for (let dy = -1; dy <= 2; dy++) {
          for (let dx = -1; dx <= 2; dx++) {
            sim.map.setSurface(cx + dx, cy + dy, hazardSurface, 0, true);
          }
        }
      }

      spawnCombatRoomArchetypeProps(sim, combatRoom);
      const braziers = sim.props.filter((p) => p.kind === 'torch_brazier');
      expect(braziers.length).toBeGreaterThanOrEqual(3);
      for (const brazier of braziers) {
        const tx = Math.floor(brazier.x / TILE_SIZE);
        const ty = Math.floor(brazier.y / TILE_SIZE);
        expect(sim.map.isSolidTile(tx, ty)).toBe(false);
        expect(sim.map.getSurface(tx, ty)).toBe('none');
      }
    }
  });

  it('preserves Spec 3.10 biome difficulty progression (+20.0% to +25.0% step increase across Biomes 1 -> 2 -> 3)', () => {
    const rows = measureBiomeDifficultyProgression(AVERAGE_PLAYER_BOT_PROFILE.seeds);
    expect(rows.length).toBe(3);
    expect(rows[1]!.stepIncreasePct).toBeGreaterThanOrEqual(20.0);
    expect(rows[1]!.stepIncreasePct).toBeLessThanOrEqual(25.0);
    expect(rows[2]!.stepIncreasePct).toBeGreaterThanOrEqual(20.0);
    expect(rows[2]!.stepIncreasePct).toBeLessThanOrEqual(25.0);
  });
});

