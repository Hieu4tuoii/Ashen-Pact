import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ArenaMap,
  MAX_PLAYER_PROJECTILES,
  SeededRandom,
  SpatialHashGrid,
  TILE_SIZE,
  WorldSim,
  clamp,
  clearCollapsedPillarFootprintOnMap,
  clearEnemyBulletsAlongPhaseBlade,
  clearEnemyProjectilesAroundProp,
  encodeWorldSnapshot,
  resolveCircleVsAABB,
  type AABB,
  type RoomShapeKind,
  type SpatialEntity,
} from '../src/index.js';
import {
  P2PSnapshotDecoder,
  P2PSnapshotEncoder,
} from '../../../apps/client/src/net/p2p-wire-codec.js';

/**
 * Pure reference implementation of ArenaMap.resolveCircleCollision's original 4-while-loop
 * span expansion, used to assert bit-identical (x, y) float parity across 1,000+ circle tests.
 */
function referenceResolveCircleCollision(
  map: ArenaMap,
  x: number,
  y: number,
  radius: number,
  ignoreChasm = false,
): { x: number; y: number; collided: boolean; normalX: number; normalY: number } {
  const isBlocking = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= map.cols || ty >= map.rows) return true;
    const idx = ty * map.cols + tx;
    if (map.tiles[idx] !== 'floor') return true;
    return !ignoreChasm && map.surfaces[idx] === 'chasm';
  };
  const isColumnBlocking = (tx: number, minTy: number, maxTy: number): boolean => {
    for (let cy = minTy; cy <= maxTy; cy++) {
      if (!isBlocking(tx, cy)) return false;
    }
    return true;
  };

  const curTx = clamp(Math.floor(x / TILE_SIZE), 0, map.cols - 1);
  const curTy = clamp(Math.floor(y / TILE_SIZE), 0, map.rows - 1);
  const minBoundX = map.isSolidTile(0, curTy) ? TILE_SIZE + radius : radius;
  const maxBoundX = map.isSolidTile(map.cols - 1, curTy)
    ? map.width - TILE_SIZE - radius
    : map.width - radius;
  const minBoundY = map.isSolidTile(curTx, 0) ? TILE_SIZE + radius : radius;
  const maxBoundY = map.isSolidTile(curTx, map.rows - 1)
    ? map.height - TILE_SIZE - radius
    : map.height - radius;

  let currX = clamp(x, minBoundX, maxBoundX);
  let currY = clamp(y, minBoundY, maxBoundY);
  let collided = currX !== x || currY !== y;
  let normalX = currX !== x ? Math.sign(currX - x) : 0;
  let normalY = currY !== y ? Math.sign(currY - y) : 0;

  const oMinTx = Math.max(0, Math.floor((currX - radius) / TILE_SIZE));
  const oMaxTx = Math.min(map.cols - 1, Math.floor((currX + radius) / TILE_SIZE));
  const oMinTy = Math.max(0, Math.floor((currY - radius) / TILE_SIZE));
  const oMaxTy = Math.min(map.rows - 1, Math.floor((currY + radius) / TILE_SIZE));
  let hasNearbyBlocking = false;
  for (let ty = oMinTy; ty <= oMaxTy && !hasNearbyBlocking; ty++) {
    for (let tx = oMinTx; tx <= oMaxTx; tx++) {
      if (isBlocking(tx, ty)) {
        hasNearbyBlocking = true;
        break;
      }
    }
  }
  if (!hasNearbyBlocking) {
    return { x: currX, y: currY, collided, normalX, normalY };
  }

  const box: AABB = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  for (let pass = 0; pass < 2; pass++) {
    const pMinTx = Math.max(0, Math.floor((currX - radius) / TILE_SIZE));
    const pMaxTx = Math.min(map.cols - 1, Math.floor((currX + radius) / TILE_SIZE));
    const pMinTy = Math.max(0, Math.floor((currY - radius) / TILE_SIZE));
    const pMaxTy = Math.min(map.rows - 1, Math.floor((currY + radius) / TILE_SIZE));
    for (let ty = pMinTy; ty <= pMaxTy; ty++) {
      for (let tx = pMinTx; tx <= pMaxTx; tx++) {
        if (!isBlocking(tx, ty)) continue;
        let bMinTx = tx;
        let bMaxTx = tx;
        let bMinTy = ty;
        let bMaxTy = ty;
        const isInterior = tx > 0 && tx < map.cols - 1 && ty > 0 && ty < map.rows - 1;
        if (isInterior) {
          if (!map.roomArchetype) {
            while (bMinTx > 1 && isBlocking(bMinTx - 1, ty)) bMinTx -= 1;
            while (bMaxTx < map.cols - 2 && isBlocking(bMaxTx + 1, ty)) bMaxTx += 1;
            while (bMinTy > 1 && isBlocking(tx, bMinTy - 1)) bMinTy -= 1;
            while (bMaxTy < map.rows - 2 && isBlocking(tx, bMaxTy + 1)) bMaxTy += 1;
          } else {
            while (bMinTy > 1 && isBlocking(tx, bMinTy - 1)) bMinTy -= 1;
            while (bMaxTy < map.rows - 2 && isBlocking(tx, bMaxTy + 1)) bMaxTy += 1;
            while (bMinTx > 1 && isColumnBlocking(bMinTx - 1, bMinTy, bMaxTy)) bMinTx -= 1;
            while (bMaxTx < map.cols - 2 && isColumnBlocking(bMaxTx + 1, bMinTy, bMaxTy)) {
              bMaxTx += 1;
            }
          }
        }
        const minX = bMinTx * TILE_SIZE;
        const minY = bMinTy * TILE_SIZE;
        const maxX = (bMaxTx + 1) * TILE_SIZE;
        const maxY = (bMaxTy + 1) * TILE_SIZE;
        const isCardinalFace =
          (currX >= minX && currX <= maxX) || (currY >= minY && currY <= maxY);
        if ((pass === 0 && !isCardinalFace) || (pass === 1 && isCardinalFace)) continue;

        box.minX = minX;
        box.minY = minY;
        box.maxX = maxX;
        box.maxY = maxY;
        const res = resolveCircleVsAABB(currX, currY, radius, box);
        if (res.collided) {
          currX = res.x;
          currY = res.y;
          collided = true;
          normalX = res.normalX;
          normalY = res.normalY;
        }
      }
    }
  }
  return { x: currX, y: currY, collided, normalX, normalY };
}

describe('Task 6 — Deterministic WorldSim, SpatialHashGrid, ArenaMap Span Tables & P2P Baseline Hashing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. SpatialHashGrid deduplicates high bit-packed projectile IDs and puzzle IDs across 4 cells with zero Set.prototype.add calls and zero object mutation', () => {
    const grid = new SpatialHashGrid<SpatialEntity & { tag: string }>(64);
    const entities: Array<SpatialEntity & { tag: string }> = [
      { id: (500 << 6) | 3, x: 64, y: 64, radius: 18, tag: 'packed_proj_32003' },
      { id: 90005, x: 66, y: 62, radius: 16, tag: 'puzzle_90005' },
      { id: (12000 << 6) | 63, x: 62, y: 66, radius: 20, tag: 'packed_proj_768063' },
    ];
    // Add 280 extra high-ID entities to also exercise lazy Int32Array slot growth (> 256)
    for (let i = 0; i < 280; i++) {
      entities.push({
        id: 50000 + i,
        x: 64 + (i % 5) * 2,
        y: 64 + ((i * 3) % 5) * 2,
        radius: 14,
        tag: `extra_${i}`,
      });
    }

    const keysBefore = entities.map((e) => Object.keys(e));
    const ownKeysBefore = entities.map((e) => Reflect.ownKeys(e));

    const setAddSpy = vi.spyOn(Set.prototype, 'add');
    setAddSpy.mockClear();

    for (const ent of entities) {
      grid.insert(ent);
    }

    const scratch: Array<SpatialEntity & { tag: string }> = [];
    let mismatchCount = 0;
    let lastHitCount = 0;
    for (let q = 0; q < 50; q++) {
      const hits = grid.queryCircle(64, 64, 48, scratch);
      lastHitCount = hits.length;
      if (hits.length !== entities.length) {
        mismatchCount += 1;
      } else {
        for (let i = 0; i < entities.length; i++) {
          if (hits[i] !== entities[i]) {
            mismatchCount += 1;
          }
        }
      }
    }

    expect(setAddSpy).toHaveBeenCalledTimes(0);
    setAddSpy.mockRestore();

    expect(lastHitCount).toBe(entities.length);
    expect(mismatchCount).toBe(0);
    expect(entities.map((e) => Object.keys(e))).toEqual(keysBefore);
    expect(entities.map((e) => Reflect.ownKeys(e))).toEqual(ownKeysBefore);
  });

  it('2. ArenaMap.resolveCircleCollision span tables match 4-while-loop reference bit-identically across all room shapes & wall breaks, and stepSurfaces early-exits in O(1) when idle', () => {
    const shapes: readonly RoomShapeKind[] = [
      'rectangle',
      'l_shape',
      'donut_ring',
      'island_catwalk',
    ];
    const rng = new SeededRandom(0xcafe1234);

    for (let sIdx = 0; sIdx < shapes.length; sIdx++) {
      const shape = shapes[sIdx]!;
      const map = new ArenaMap({ seed: 1000 + sIdx, biome: 2, roomShape: shape });
      map.configureRoomLayout('combat', 2, 7700 + sIdx, ['N', 'S', 'E', 'W'], {
        archetype: sIdx % 2 === 0 ? 'TWIN_BRIDGES' : 'CRUMBLING_PILLAR_RING',
        roomShape: shape,
        secretWallBroken: false,
      });
      map.placeCrackedSecretWall('N', false);

      // 250 random circles per shape BEFORE wall/pillar break (= 1,000 total pre-break)
      for (let i = 0; i < 250; i++) {
        const cx = rng.nextFloat(-8, map.width + 8);
        const cy = rng.nextFloat(-8, map.height + 8);
        const radius = rng.nextFloat(6, 26);
        const ignoreChasm = (i & 1) === 1;

        const ref = referenceResolveCircleCollision(map, cx, cy, radius, ignoreChasm);
        const got = map.resolveCircleCollision(cx, cy, radius, ignoreChasm);
        expect(Object.is(got.x, ref.x)).toBe(true);
        expect(Object.is(got.y, ref.y)).toBe(true);
        expect(got.collided).toBe(ref.collided);
        expect(got.normalX).toBe(ref.normalX);
        expect(got.normalY).toBe(ref.normalY);
      }

      // Break cracked wall + collapse an interior pillar (increments mapRevision)
      const prevRev = map.mapRevision;
      const cracked = map.getCrackedWallTileForDir('N');
      expect(map.destroyCrackedWall(cracked.tx, cracked.ty)).toBe(true);
      clearCollapsedPillarFootprintOnMap(map, map.width * 0.5, map.height * 0.5);
      expect(map.mapRevision).toBeGreaterThan(prevRev);

      // 250 random circles per shape AFTER wall/pillar break (= 1,000 total post-break)
      for (let i = 0; i < 250; i++) {
        const cx = rng.nextFloat(-8, map.width + 8);
        const cy = rng.nextFloat(-8, map.height + 8);
        const radius = rng.nextFloat(6, 26);
        const ignoreChasm = (i & 1) === 1;

        const ref = referenceResolveCircleCollision(map, cx, cy, radius, ignoreChasm);
        const got = map.resolveCircleCollision(cx, cy, radius, ignoreChasm);
        expect(Object.is(got.x, ref.x)).toBe(true);
        expect(Object.is(got.y, ref.y)).toBe(true);
        expect(got.collided).toBe(ref.collided);
        expect(got.normalX).toBe(ref.normalX);
        expect(got.normalY).toBe(ref.normalY);
      }
    }

    // Verify non-archetype room (boss/start) span parity as well
    const nonArchMap = new ArenaMap({ seed: 42, biome: 2 });
    nonArchMap.configureRoomLayout('boss', 2, 4242);
    for (let i = 0; i < 200; i++) {
      const cx = rng.nextFloat(0, nonArchMap.width);
      const cy = rng.nextFloat(0, nonArchMap.height);
      const radius = rng.nextFloat(8, 24);
      const ignoreChasm = (i & 1) === 0;
      const ref = referenceResolveCircleCollision(nonArchMap, cx, cy, radius, ignoreChasm);
      const got = nonArchMap.resolveCircleCollision(cx, cy, radius, ignoreChasm);
      expect(Object.is(got.x, ref.x)).toBe(true);
      expect(Object.is(got.y, ref.y)).toBe(true);
      expect(got.collided).toBe(ref.collided);
    }

    // Verify activeDynamicSurfaceCount O(1) early-exit & full burn/electrify lifecycle
    const surfMap = new ArenaMap({ seed: 8080, biome: 1, includeSurfaces: true });
    expect((surfMap as ArenaMap & { activeDynamicSurfaceCount: number }).activeDynamicSurfaceCount).toBe(0);

    // Replace surfaceTimers with a Proxy that counts index reads when idle: O(1) early exit must read 0 elements!
    let timerReadsWhileIdle = 0;
    const origTimers = surfMap.surfaceTimers;
    surfMap.surfaceTimers = new Proxy(origTimers, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && prop !== 'length' && !Number.isNaN(Number(prop))) {
          timerReadsWhileIdle += 1;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    surfMap.stepSurfaces(1 / 60);
    expect(timerReadsWhileIdle).toBe(0);
    surfMap.surfaceTimers = origTimers;

    // Ignite oil (17..20, 3..5) and electrify water (11..14, 3..5)
    expect(surfMap.igniteSurfaceInRadius(18 * TILE_SIZE + 16, 4 * TILE_SIZE + 16, 24)).toBeGreaterThan(0);
    expect(surfMap.electrifyWaterAt(12, 4, 4.0)).toBeGreaterThan(0);
    expect((surfMap as ArenaMap & { activeDynamicSurfaceCount: number }).activeDynamicSurfaceCount).toBeGreaterThan(0);

    for (let tick = 0; tick < 420; tick++) {
      surfMap.stepSurfaces(1 / 60);
    }
    expect(surfMap.getSurface(18, 4)).toBe('ash');
    expect(surfMap.getSurface(12, 4)).toBe('water');
    expect((surfMap as ArenaMap & { activeDynamicSurfaceCount: number }).activeDynamicSurfaceCount).toBe(0);
  });

  it('3. WorldSim tracks playerProjectileCount / enemyProjectileCount without false cross-team eviction and uses bulletSpatialGrid without mutating queryEnemyScratch', () => {
    const sim = new WorldSim({
      seed: 0x998877,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    const p2 = sim.addCoopPlayer(2, 'ranger', 'AllyP2', 2);

    // Spawn 220 enemy bullets + 40 player bullets => total 260 >= MAX_PLAYER_PROJECTILES (240)
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: 1,
      ownerId: 900,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: 500,
      y: 320,
      angle: Math.PI,
      pelletCount: 220,
      spreadRad: 0,
      radialStepRad: (Math.PI * 2) / 220,
      speed: 140,
      damage: 4,
      radius: 5,
      knockback: 0,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 3.0,
      element: 'none',
      critChance: 0,
      amplifiedByShield: false,
      seed: 111,
    });
    for (let v = 0; v < 8; v++) {
      sim.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: 1,
        ownerId: sim.player.id,
        team: 'player',
        weaponId: 'scrap_shotgun',
        x: 240,
        y: 320,
        angle: 0,
        pelletCount: 5,
        spreadRad: 0.3,
        speed: 420,
        damage: 8,
        radius: 4.5,
        knockback: 20,
        pierceCount: 0,
        bounceCount: 0,
        ttlSec: 2.0,
        element: 'none',
        critChance: 0,
        amplifiedByShield: false,
        seed: 200 + v,
      });
    }

    expect(sim.projectiles).toHaveLength(260);
    expect(sim.projectiles.length).toBeGreaterThanOrEqual(MAX_PLAYER_PROJECTILES);
    expect((sim as WorldSim & { playerProjectileCount: number }).playerProjectileCount).toBe(40);
    expect((sim as WorldSim & { enemyProjectileCount: number }).enemyProjectileCount).toBe(220);

    // Spawn 12 player shotgun pellets (two 6-pellet volleys): must NOT evict any bullet!
    for (const shooterId of [sim.player.id, p2.id]) {
      sim.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: 2,
        ownerId: shooterId,
        team: 'player',
        weaponId: 'scrap_shotgun',
        x: 250,
        y: 320,
        angle: 0,
        pelletCount: 6,
        spreadRad: 0.35,
        speed: 420,
        damage: 8,
        radius: 4.5,
        knockback: 20,
        pierceCount: 0,
        bounceCount: 0,
        ttlSec: 2.0,
        element: 'none',
        critChance: 0,
        amplifiedByShield: false,
        seed: 300 + shooterId,
      });
    }

    expect(sim.projectiles).toHaveLength(272);
    expect((sim as WorldSim & { playerProjectileCount: number }).playerProjectileCount).toBe(52);
    expect((sim as WorldSim & { enemyProjectileCount: number }).enemyProjectileCount).toBe(220);

    // Verify Phase Blade & Barricade Micro-Blank use bulletSpatialGrid without touching queryEnemyScratch
    const sentinelEnemy = sim.spawnEnemy('goblin_shooter', 700, 320, true);
    sim.queryEnemyScratch.length = 0;
    sim.queryEnemyScratch.push(sentinelEnemy);

    const bulletGridSpy = vi.spyOn(sim.bulletSpatialGrid, 'queryCircle');

    const nearBladeBullet = sim.acquireProjectile({
      id: 777001,
      ownerId: 900,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: 340,
      y: 220,
      vx: -120,
      vy: 0,
      angle: Math.PI,
      radius: 5,
      damage: 5,
      isCrit: false,
      knockback: 0,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 2.0,
      element: 'none',
      amplifiedByShield: false,
    });
    const farEnemyBullet = sim.acquireProjectile({
      id: 777002,
      ownerId: 900,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: 820,
      y: 520,
      vx: -120,
      vy: 0,
      angle: Math.PI,
      radius: 5,
      damage: 5,
      isCrit: false,
      knockback: 0,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 2.0,
      element: 'none',
      amplifiedByShield: false,
    });
    const phaseBlade = sim.acquireProjectile({
      id: 777003,
      ownerId: sim.player.id,
      team: 'player',
      weaponId: 'dash_phase_blade',
      x: 350,
      y: 220,
      vx: 560,
      vy: 0,
      angle: 0,
      radius: 18,
      damage: 28,
      isCrit: false,
      knockback: 160,
      pierceRemaining: 8,
      bounceRemaining: 0,
      ttlSec: 0.34,
      element: 'none',
      amplifiedByShield: false,
    });
    phaseBlade.prevX = 325;
    phaseBlade.prevY = 220;
    sim.projectiles.push(nearBladeBullet, farEnemyBullet, phaseBlade);

    const destroyedByBlade: number[] = [];
    const bladeCleared = clearEnemyBulletsAlongPhaseBlade(sim, phaseBlade, destroyedByBlade);
    expect(bladeCleared).toBeGreaterThanOrEqual(1);
    expect(destroyedByBlade).toContain(777001);
    expect(destroyedByBlade).not.toContain(777002);
    expect(nearBladeBullet.ttlSec).toBe(0);
    expect(farEnemyBullet.ttlSec).toBeGreaterThan(0);
    expect(bulletGridSpy).toHaveBeenCalled();
    expect(sim.queryEnemyScratch).toEqual([sentinelEnemy]);

    // Barricade micro-blank around (820, 520) clears farEnemyBullet and preserves queryEnemyScratch
    const table = sim.spawnProp('moss_table', 820, 520);
    bulletGridSpy.mockClear();
    const propCleared = clearEnemyProjectilesAroundProp(sim, table.x, table.y, 56, table);
    expect(propCleared).toBeGreaterThanOrEqual(1);
    expect(sim.projectiles.some((b) => b.id === 777002)).toBe(false);
    expect(bulletGridSpy).toHaveBeenCalled();
    expect(sim.queryEnemyScratch).toEqual([sentinelEnemy]);
  });

  it('4. Locked-seed 600-tick 4-player combat determinism (seed 0x51a71c) produces bit-identical world state', () => {
    const createCombatSim = (): WorldSim => {
      const sim = new WorldSim({
        seed: 0x51a71c,
        startInHub: false,
        coopMode: true,
        spawnInitialWave: true,
        includeTrainingDummy: false,
        includeProps: true,
        autoRevivePlayer: true,
      });
      const p2 = sim.addCoopPlayer(2, 'ranger', 'RangerBot', 2);
      const p3 = sim.addCoopPlayer(3, 'elementalist', 'MageBot', 3);
      const p4 = sim.addCoopPlayer(4, 'engineer', 'EngiBot', 4);

      sim.player.activeImbueElement = 'burn';
      sim.player.blessingIds.push('dash_phase_blade', 'table_tech_rocket', 'bullet_split_bounce');
      sim.player.duoBoonIds.push('duo_superconduct_rail');

      p2.activeImbueElement = 'chill';
      p2.blessingIds.push('bullet_orbit_return', 'table_tech_prism_split');

      p3.activeImbueElement = 'shock';
      p3.blessingIds.push('bullet_wall_tether', 'dash_thunder_decoy');
      p3.duoBoonIds.push('duo_superconduct_rail');

      p4.activeImbueElement = 'poison';
      p4.blessingIds.push('table_tech_toxic_shrapnel', 'table_tech_magnet_snare');

      sim.botAutoPlayActive = true;
      return sim;
    };

    const simA = createCombatSim();
    const simB = createCombatSim();

    for (let t = 0; t < 600; t++) {
      simA.step(1 / 60);
      simA.consumeEvents();
      simB.step(1 / 60);
      simB.consumeEvents();
    }

    expect(simA.tick).toBe(600);
    expect(simB.tick).toBe(600);

    expect(
      simA.getAllPlayers().map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        hp: p.hp,
        armor: p.armor,
      })),
    ).toEqual(
      simB.getAllPlayers().map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        hp: p.hp,
        armor: p.armor,
      })),
    );

    expect(
      simA.enemies.map((e) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        hp: e.hp,
      })),
    ).toEqual(
      simB.enemies.map((e) => ({
        id: e.id,
        x: e.x,
        y: e.y,
        hp: e.hp,
      })),
    );

    expect(
      simA.projectiles.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
      })),
    ).toEqual(
      simB.projectiles.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
      })),
    );
  });

  it('5. P2PSnapshotEncoder skips JSON.stringify and baseline re-transmission across 30 combat snapshots when props only tick volatile timers, while still updating dynamic prop hp/pos/state', () => {
    const sim = new WorldSim({
      seed: 91919,
      startInHub: false,
      spawnInitialWave: true,
      includeTrainingDummy: false,
      includeProps: true,
    });
    sim.addCoopPlayer(2, 'ranger', 'P2', 2);
    sim.addCoopPlayer(3, 'elementalist', 'P3', 3);
    sim.addCoopPlayer(4, 'engineer', 'P4', 4);

    const barricade = sim.spawnProp('glacial_barricade', 380, 260);
    const spike = sim.spawnProp('glacial_spike', 420, 280);
    spike.ttlSec = 4.0;
    const obelisk = sim.spawnProp('cryo_prism_pillar', 460, 300);
    obelisk.prismPulseCooldownSec = 1.8;
    obelisk.hitFlashTimer = 0.16;
    const bomb = sim.spawnProp('coal_bomb', 500, 320);
    bomb.fuseTimer = 2.0;

    const baseSnap = encodeWorldSnapshot(sim, [], false, 1700001000000);
    const encoder = new P2PSnapshotEncoder();
    const decoder = new P2PSnapshotDecoder();

    const stringifySpy = vi.spyOn(JSON, 'stringify');
    let baselineTransmissions = 0;

    for (let f = 0; f < 30; f++) {
      const frameSnap = structuredClone(baseSnap);
      frameSnap.snapshotSeq = f + 1;
      frameSnap.tick = baseSnap.tick + f * 2;
      frameSnap.serverTimeMs = baseSnap.serverTimeMs + f * 33;

      // Move players & enemies every 30Hz snapshot
      for (const pl of frameSnap.players) {
        pl.qx += f * 12;
        pl.qy -= f * 8;
        pl.clipAmmo = Math.max(0, pl.clipAmmo - (f % 3));
      }
      for (const en of frameSnap.enemies) {
        en.qx -= f * 10;
        en.qy += f * 6;
        en.hp = Math.max(1, en.hp - (f % 4));
      }

      // Tick volatile prop timers every 30Hz snapshot
      for (const pr of frameSnap.props) {
        if (pr.hitFlashTimer > 0) pr.hitFlashTimer = Math.max(0, pr.hitFlashTimer - 0.033);
        if (pr.ttlSec !== undefined) pr.ttlSec = Math.max(0.1, pr.ttlSec - 0.033);
        if (pr.fuseTimer > 0) pr.fuseTimer = Math.max(0.1, pr.fuseTimer - 0.033);
        if (pr.prismPulseCooldownSec !== undefined) {
          pr.prismPulseCooldownSec = Math.max(0, pr.prismPulseCooldownSec - 0.033);
        }
      }

      const encoded = encoder.encode(frameSnap);
      if (encoded.baseline) {
        baselineTransmissions += 1;
        decoder.applyBaseline(encoded.baseline.rev, encoded.baseline.data);
      }
      const decoded = decoder.decodeFast(encoded.fast);
      expect(decoded).not.toBeNull();
      expect(decoded!.tick).toBe(frameSnap.tick);
      expect(decoded!.enemies.map((e) => e.qx)).toEqual(frameSnap.enemies.map((e) => e.qx));
    }

    // Only frame 1 should emit baseline or call JSON.stringify!
    expect(baselineTransmissions).toBe(1);
    expect(stringifySpy.mock.calls.length).toBeLessThanOrEqual(1);

    // Frame 31: barricade is flipped & damaged and moves -> MUST emit rev 2 and decode accurately!
    const structuralSnap = structuredClone(baseSnap);
    structuralSnap.snapshotSeq = 31;
    structuralSnap.tick = baseSnap.tick + 60;
    const targetProp = structuralSnap.props.find((pr) => pr.id === barricade.id)!;
    targetProp.hp = 42;
    targetProp.x = 412;
    targetProp.y = 276;
    targetProp.state = 'sliding';
    targetProp.coverState = 'sliding';

    const enc31 = encoder.encode(structuralSnap);
    expect(enc31.baseline).toBeDefined();
    expect(enc31.baseline!.rev).toBe(2);
    decoder.applyBaseline(enc31.baseline!.rev, enc31.baseline!.data);
    const dec31 = decoder.decodeFast(enc31.fast)!;
    const decProp = dec31.props.find((pr) => pr.id === barricade.id)!;
    expect(decProp.hp).toBe(42);
    expect(decProp.x).toBe(412);
    expect(decProp.y).toBe(276);
    expect(decProp.state).toBe('sliding');
    expect(decProp.coverState).toBe('sliding');
  });
});
