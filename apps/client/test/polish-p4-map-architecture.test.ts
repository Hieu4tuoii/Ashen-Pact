import {
  ArenaMap,
  WALL_AO_NORTH,
  WALL_AO_NORTH_WEST,
  WALL_AO_WEST,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { srgbToCieL } from '../../../tools/visual-metrics.js';
import { ENV_PALETTE, getBiomeTheme, PALETTE } from '../src/art/palette.js';
import { bakeWallAoOverlay } from '../src/art/texture-baker-tiles.js';
import {
  buildRoomArchitecturePlan,
  computeTileDistToWall,
  isFloorDecalVisible,
  resolveHybridFloorVariant,
} from '../src/world/biome-architecture.js';

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function hexToL(hex: string): number {
  const [r, g, b] = hexToRgbTuple(hex);
  return srgbToCieL(r, g, b);
}

describe('Phase P4 — Hybrid Map Architecture, ENV_PALETTE & Biome 1 Golden Room', () => {
  it('defines exact ENV_PALETTE hex codes and photometric L* relationships for Hub (0), B1 (1), B2 (2), and B3 (3)', () => {
    expect(ENV_PALETTE[0]).toEqual({
      floor: '#414B61',
      seam: '#343B4C',
      var: '#47546C',
      wallTop: '#64708B',
      wallFront: '#2D3547',
      shadow: '#151A24',
      rim: '#8B97B5',
      accent: '#F59E42',
    });
    expect(ENV_PALETTE[1]).toEqual({
      floor: '#3D4F47',
      seam: '#303E38',
      var: '#43584E',
      wallTop: '#627468',
      wallFront: '#2B3731',
      shadow: '#16201C',
      rim: '#9C9286',
      accent: '#84CC16',
    });
    expect(ENV_PALETTE[2]).toEqual({
      floor: '#446E78',
      seam: '#3B5C64',
      var: '#4A7881',
      wallTop: '#6F949E',
      wallFront: '#345462',
      shadow: '#182A33',
      rim: '#CFE8EE',
      accent: '#22D3EE',
    });
    expect(ENV_PALETTE[3]).toEqual({
      floor: '#53433F',
      seam: '#413431',
      var: '#5D4B44',
      wallTop: '#7F6559',
      wallFront: '#3B2D29',
      shadow: '#1F1614',
      rim: '#FDBA74',
      accent: '#F97316',
    });

    const inkDarkL = hexToL(PALETTE.INK_DARK);
    for (const biome of [0, 1, 2, 3] as const) {
      const env = ENV_PALETTE[biome];
      const floorL = hexToL(env.floor);
      const wallTopL = hexToL(env.wallTop);
      const wallFrontL = hexToL(env.wallFront);

      if (biome === 2) {
        expect(floorL).toBeGreaterThanOrEqual(40);
        expect(floorL).toBeLessThanOrEqual(50);
      } else {
        expect(floorL).toBeGreaterThanOrEqual(28);
        expect(floorL).toBeLessThanOrEqual(40);
      }

      expect(floorL - inkDarkL).toBeGreaterThanOrEqual(22);

      const topDelta = wallTopL - floorL;
      expect(topDelta).toBeGreaterThanOrEqual(12);
      expect(topDelta).toBeLessThanOrEqual(18);

      const frontDelta = wallFrontL - floorL;
      expect(frontDelta).toBeGreaterThanOrEqual(-12);
      expect(frontDelta).toBeLessThanOrEqual(-8);

      const theme = getBiomeTheme(biome);
      expect(theme.floorBase).toBe(env.floor);
    }
  });

  it('computes Chebyshev distance to solid wall/pillar tiles and partitions floor variants into Perimeter (0..3) vs Center Arena (4..7)', () => {
    const map = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome: 1 });
    map.configureRoomLayout('combat', 1337, false, 1);

    // Border wall tile has distToWall === 0
    expect(computeTileDistToWall(map, 0, 0)).toBe(0);
    // Adjacent perimeter floor tile has distToWall === 1
    expect(computeTileDistToWall(map, 1, 5)).toBe(1);
    // Second ring perimeter floor tile has distToWall === 2
    expect(computeTileDistToWall(map, 2, 5)).toBe(2);
    // Center Arena floor tile far from walls and pillars has distToWall > 2
    expect(computeTileDistToWall(map, 10, 10)).toBeGreaterThan(2);

    let grateAtDist1Count = 0;
    for (let ty = 1; ty < map.rows - 1; ty++) {
      for (let tx = 1; tx < map.cols - 1; tx++) {
        if (map.isSolidTile(tx, ty)) continue;
        const dist = computeTileDistToWall(map, tx, ty);
        const variant = resolveHybridFloorVariant(tx, ty, dist);
        if (dist <= 2) {
          expect(variant).toBeGreaterThanOrEqual(0);
          expect(variant).toBeLessThanOrEqual(3);
          if (variant === 2) {
            expect(dist).toBe(1);
            grateAtDist1Count += 1;
          }
          if (dist === 2) {
            expect(variant).toBe(3);
          }
        } else {
          expect(variant).toBeGreaterThanOrEqual(4);
          expect(variant).toBeLessThanOrEqual(7);
        }
      }
    }
    expect(grateAtDist1Count).toBeGreaterThan(0);
  });

  it('builds Biome 1 Golden Room architecture plan respecting the 3 core environmental rules and density budgets', () => {
    const map = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome: 1 });
    map.configureRoomLayout('combat', 1337, false, 1);

    const plan = buildRoomArchitecturePlan(map, 'combat', 1, 1337);
    expect(plan.biome).toBe(1);
    expect(plan.roomType).toBe('combat');

    // 1. Solid/3D decor items (hasVolume === true) only on solid wall/pillar tiles
    expect(plan.solidDecors.length).toBeGreaterThan(0);
    for (const item of plan.solidDecors) {
      expect(item.hasVolume).toBe(true);
      expect(map.isSolidTile(item.tx, item.ty)).toBe(true);
    }

    // Check that Biome 1 includes root_base, mushroom_cluster, cliff_vines, and brazier_pedestal
    const solidKinds = new Set(plan.solidDecors.map((d) => d.kind));
    expect(solidKinds.has('root_base')).toBe(true);
    expect(solidKinds.has('mushroom_cluster')).toBe(true);
    expect(solidKinds.has('cliff_vines')).toBe(true);
    expect(solidKinds.has('brazier_pedestal')).toBe(true);

    // 2. Floor decals (hasVolume === false): 0 decals in Center Arena (except stepping_stone bordering surface),
    // and stepping_stone strictly on dry floor tiles (surface === 'none')
    const decalKinds = new Set(plan.floorDecals.map((d) => d.kind));
    expect(decalKinds.has('root_decal_tip')).toBe(true);
    expect(decalKinds.has('stepping_stone')).toBe(true);

    for (const decal of plan.floorDecals) {
      expect(decal.hasVolume).toBe(false);
      expect(map.isSolidTile(decal.tx, decal.ty)).toBe(false);
      expect(map.getSurface(decal.tx, decal.ty)).toBe('none');
      expect(isFloorDecalVisible(decal, map)).toBe(true);

      const dist = computeTileDistToWall(map, decal.tx, decal.ty);
      if (decal.kind === 'stepping_stone') {
        // Must immediately border a poison_swamp or water tile
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
      } else {
        expect(dist).toBeLessThanOrEqual(2);
      }
    }

    // 3. Density budget: largeDecorCount <= 8, smallPerimeterDecorCount <= floor(perimeterTileCount / 3), emptyPerimeterRatio >= 0.40
    expect(plan.budget.largeDecorCount).toBeLessThanOrEqual(8);
    expect(plan.budget.smallPerimeterDecorCount).toBeLessThanOrEqual(
      Math.floor(plan.budget.perimeterTileCount / 3),
    );
    expect(plan.budget.emptyPerimeterRatio).toBeGreaterThanOrEqual(0.4);
    expect(plan.budget.centerArenaSolidDecorCount).toBe(0);
  });

  it('hides floor decals automatically when dynamic surfaces flood their tile (including Boss Phase 3 toxic border)', () => {
    const bossMap = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome: 1 });
    bossMap.configureRoomLayout('boss', 1337, false, 1);

    const plan = buildRoomArchitecturePlan(bossMap, 'boss', 1, 1337);
    expect(plan.floorDecals.length).toBeGreaterThan(0);

    // Boss room outer 3 tiles must not have pathway-like stepping_stone decals
    for (const decal of plan.floorDecals) {
      if (decal.kind === 'stepping_stone') {
        const inOuter3 =
          decal.tx <= 3 ||
          decal.tx >= bossMap.cols - 4 ||
          decal.ty <= 2 ||
          decal.ty >= bossMap.rows - 3;
        expect(inOuter3).toBe(false);
      }
    }

    // Flood outer border with Boss Phase 3 poison_swamp
    bossMap.applyBossPhase3ToxicBorder();

    for (const decal of plan.floorDecals) {
      if (bossMap.getSurface(decal.tx, decal.ty) !== 'none') {
        expect(isFloorDecalVisible(decal, bossMap)).toBe(false);
      }
    }
  });

  it('builds architecture plans for Hub (0), Biome 2 (2), and Biome 3 (3) with biome-specific motifs and strict density budgets', () => {
    // 1. Hub (biome 0)
    const hubMap = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome: 1 });
    hubMap.configureRoomLayout('start', 1337, false, 1);
    const hubPlan = buildRoomArchitecturePlan(hubMap, 'start', 0, 1337);
    expect(hubPlan.biome).toBe(0);
    const hubSolidKinds = new Set(hubPlan.solidDecors.map((d) => d.kind));
    expect(hubSolidKinds.has('brazier_pedestal')).toBe(true);
    expect(hubSolidKinds.has('wrought_iron_fence')).toBe(true);
    expect(hubPlan.budget.largeDecorCount).toBeLessThanOrEqual(8);
    expect(hubPlan.budget.emptyPerimeterRatio).toBeGreaterThanOrEqual(0.4);
    expect(hubPlan.budget.centerArenaSolidDecorCount).toBe(0);

    // 2. Biome 2 (Hầm Băng Vĩnh Cửu)
    const b2Map = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome: 2 });
    b2Map.configureRoomLayout('combat', 1337, false, 2);
    const b2Plan = buildRoomArchitecturePlan(b2Map, 'combat', 2, 1337);
    expect(b2Plan.biome).toBe(2);
    const b2SolidKinds = new Set(b2Plan.solidDecors.map((d) => d.kind));
    expect(b2SolidKinds.has('brazier_pedestal')).toBe(true);
    expect(b2SolidKinds.has('ice_alcove')).toBe(true);
    expect(b2SolidKinds.has('frost_crystal_cluster')).toBe(true);
    for (const item of b2Plan.solidDecors) {
      expect(b2Map.isSolidTile(item.tx, item.ty)).toBe(true);
    }
    const b2DecalKinds = new Set(b2Plan.floorDecals.map((d) => d.kind));
    expect(b2DecalKinds.has('sunken_astrolabe')).toBe(true);
    expect(b2Plan.budget.largeDecorCount).toBeLessThanOrEqual(8);
    expect(b2Plan.budget.emptyPerimeterRatio).toBeGreaterThanOrEqual(0.4);
    expect(b2Plan.budget.centerArenaSolidDecorCount).toBe(0);

    // 3. Biome 3 (Lò Rèn Dung Nham)
    const b3Map = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome: 3 });
    b3Map.configureRoomLayout('combat', 1337, false, 3);
    const b3Plan = buildRoomArchitecturePlan(b3Map, 'combat', 3, 1337);
    expect(b3Plan.biome).toBe(3);
    const b3SolidKinds = new Set(b3Plan.solidDecors.map((d) => d.kind));
    expect(b3SolidKinds.has('brazier_pedestal')).toBe(true);
    expect(b3SolidKinds.has('brass_gear_wall')).toBe(true);
    expect(b3SolidKinds.has('steam_pipe_wall')).toBe(true);
    for (const item of b3Plan.solidDecors) {
      expect(b3Map.isSolidTile(item.tx, item.ty)).toBe(true);
    }
    const b3DecalKinds = new Set(b3Plan.floorDecals.map((d) => d.kind));
    expect(b3DecalKinds.has('grated_heat_channel')).toBe(true);
    for (const decal of b3Plan.floorDecals) {
      expect(b3Map.isSolidTile(decal.tx, decal.ty)).toBe(false);
      expect(computeTileDistToWall(b3Map, decal.tx, decal.ty)).toBeLessThanOrEqual(2);
      expect(isFloorDecalVisible(decal, b3Map)).toBe(true);
    }
    expect(b3Plan.budget.largeDecorCount).toBeLessThanOrEqual(8);
    expect(b3Plan.budget.emptyPerimeterRatio).toBeGreaterThanOrEqual(0.4);
    expect(b3Plan.budget.centerArenaSolidDecorCount).toBe(0);
  });

  it('keeps Center Arena (distToWall > 2) floor variants uniform within each 3x3 cluster without 1x1 checkerboard oscillation', () => {
    const seenClusterVariants = new Set<number>();
    for (let cy = 1; cy <= 5; cy++) {
      for (let cx = 1; cx <= 9; cx++) {
        const expected = resolveHybridFloorVariant(cx * 3, cy * 3, 6);
        expect(expected).toBeGreaterThanOrEqual(4);
        expect(expected).toBeLessThanOrEqual(7);
        seenClusterVariants.add(expected);
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            expect(resolveHybridFloorVariant(cx * 3 + dx, cy * 3 + dy, 6)).toBe(expected);
          }
        }
      }
    }
    expect(seenClusterVariants.size).toBe(4);
  });

  it('bakes 14x14 diagonal SE corner AO shadow only on outer NW corner masks (hasNW && !hasN && !hasW) across all 256 aoMask values', () => {
    const prevDoc = (globalThis as { document?: unknown }).document;
    let gradNCount = 0;
    let gradWCount = 0;
    let gradSECornerCount = 0;

    try {
      for (let aoMask = 0; aoMask < 256; aoMask++) {
        const gradients: Array<[number, number, number, number]> = [];
        const mockCtx = {
          save: () => {},
          restore: () => {},
          scale: () => {},
          createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
            gradients.push([x0, y0, x1, y1]);
            return { addColorStop: () => {} };
          },
          fillRect: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          fill: () => {},
          fillStyle: '',
        };
        (globalThis as { document?: unknown }).document = {
          createElement: () => ({
            width: 0,
            height: 0,
            getContext: () => mockCtx,
          }),
        };
        const mockScene = {
          textures: {
            exists: () => false,
            remove: () => {},
            addCanvas: () => {},
          },
        } as unknown as Phaser.Scene;

        bakeWallAoOverlay(mockScene, aoMask, 1);

        const hasN = (aoMask & WALL_AO_NORTH) !== 0;
        const hasW = (aoMask & WALL_AO_WEST) !== 0;
        const hasNW = (aoMask & WALL_AO_NORTH_WEST) !== 0;
        const drewN = gradients.some((g) => g[2] === 0 && g[3] === 7);
        const drewW = gradients.some((g) => g[2] === 7 && g[3] === 0);
        const drewSE = gradients.some((g) => g[2] === 14 && g[3] === 14);

        expect(drewN).toBe(hasN);
        expect(drewW).toBe(hasW);
        expect(drewSE).toBe(hasNW && !hasN && !hasW);

        if (drewN) gradNCount += 1;
        if (drewW) gradWCount += 1;
        if (drewSE) gradSECornerCount += 1;
      }
    } finally {
      (globalThis as { document?: unknown }).document = prevDoc;
    }

    expect(gradNCount).toBe(128);
    expect(gradWCount).toBe(128);
    expect(gradSECornerCount).toBe(32);
  });
});
