import { describe, expect, it } from 'vitest';
import {
  ALL_ROOM_ARCHETYPES,
  ALL_ROOM_SHAPES,
  ALL_ROOM_SIZE_PRESETS,
  ArenaMap,
  ENEMIES,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  TILE_SIZE,
  WorldSim,
  findInteractTarget,
  findNearestWalkablePoint,
  findNextWalkableWaypoint,
  getDoorTilesForMap,
  hasClearWalkableCorridor,
  isKickableProp,
  isPointBlockedByStationaryProp,
  resolveEnemyChasmRingOut,
  triggerMeleeKickProps,
  type RoomType,
  type SurfaceKind,
} from '../src/index.js';
import {
  syncAshenExecutionerInRoom,
  updateAshenExecutionerAI,
} from '../src/sim/sim-ashen-pacts-combat.js';
import { triggerDashFlameShackle } from '../src/sim/sim-blessings-dash-reload.js';
import {
  executeBossSporeKingAttackImpl,
  updateBossSporeKingAIImpl,
} from '../src/sim/sim-enemies-biome1.js';
import { spawnKryssaMirrorClonesImpl } from '../src/sim/sim-enemies-biome2.js';
import { spawnForgeTitanEnergyCoresImpl } from '../src/sim/sim-enemies-biome3.js';
import { applyChainHarpoonOnHit } from '../src/sim/sim-weapon-mutators.js';
import { updateEmeraldCleaverBoomerang } from '../src/sim/sim-weapon-specials-p1b-melee.js';
import {
  triggerVoidStaffImplosion,
  updateVoidStaffOrbInFlight,
} from '../src/sim/sim-weapon-specials-p1b-ranged.js';
import {
  spawnSeedGunLifeBud,
  triggerTetherStaffTacticalVent,
} from '../src/sim/sim-weapon-specials-rare.js';
import { distance } from '../src/math/vec2.js';

function createCleanSim(seed = 40401, biome: 1 | 2 | 3 = 1): WorldSim {
  const sim = new WorldSim({
    seed,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    autoRespawnWaves: false,
    startInHub: false,
  });
  sim.currentBiome = biome;
  sim.map.configureRoomLayout('combat', seed, false, biome);
  for (let ty = 1; ty < sim.map.rows - 1; ty++) {
    for (let tx = 1; tx < sim.map.cols - 1; tx++) {
      sim.map.setTile(tx, ty, 'floor');
      sim.map.setSurface(tx, ty, 'none', 0, true);
    }
  }
  sim.map.rebuildSolidBoxes();
  sim.props.length = 0;
  sim.enemies.length = 0;
  sim.projectiles.length = 0;
  sim.summons.length = 0;
  sim.chests.length = 0;
  sim.worldItems.length = 0;
  sim.player.x = 320;
  sim.player.y = 320;
  sim.player.hp = sim.player.maxHp;
  return sim;
}

describe('Round 4 — Zero-Alloc BFS Navigation, Biome Terrain Purity & 1-Step Barricade Launch', () => {
  describe('F20: Zero-Allocation BFS Navigation, Multi-Angle Steering, Unsticking & Safe Spawns/Pulls', () => {
    it('upgrades findNearestWalkablePoint, findNextWalkableWaypoint & hasClearWalkableCorridor with prop avoidance, large-radius clearance, and 2-step lookahead', () => {
      const sim = createCleanSim(41001);
      // Place a 2x2 pillar at (10..11, 9..10) and a blocking prop at (14 * 32 + 16, 10 * 32 + 16)
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          sim.map.setTile(10 + dx, 9 + dy, 'pillar');
        }
      }
      sim.map.rebuildSolidBoxes();
      const pillarProp = sim.spawnProp('rotten_totem_pillar', 14 * TILE_SIZE + 16, 10 * TILE_SIZE + 16);
      expect(pillarProp.blocksMovement).toBe(true);

      // 1. isPointBlockedByStationaryProp detects blocking props and ignores fallen/low props
      expect(isPointBlockedByStationaryProp(pillarProp.x, pillarProp.y, 14, sim.props)).toBe(true);
      const lowTable = sim.spawnProp('moss_table', 18 * TILE_SIZE + 16, 10 * TILE_SIZE + 16);
      expect(isPointBlockedByStationaryProp(lowTable.x, lowTable.y, 14, sim.props)).toBe(false);

      // 2. findNearestWalkablePoint for large-radius boss (r=34) embedded inside 2x2 pillar or blocking prop
      const safeFromPillar = findNearestWalkablePoint(
        sim.map,
        10 * TILE_SIZE + 16,
        9 * TILE_SIZE + 16,
        34,
        sim.props,
      );
      expect(sim.map.isSolidTile(Math.floor(safeFromPillar.x / TILE_SIZE), Math.floor(safeFromPillar.y / TILE_SIZE))).toBe(false);
      expect(sim.map.resolveCircleCollision(safeFromPillar.x, safeFromPillar.y, 34, false).collided).toBe(false);
      expect(isPointBlockedByStationaryProp(safeFromPillar.x, safeFromPillar.y, 34, sim.props)).toBe(false);

      const safeFromProp = findNearestWalkablePoint(
        sim.map,
        pillarProp.x,
        pillarProp.y,
        24,
        sim.props,
      );
      expect(isPointBlockedByStationaryProp(safeFromProp.x, safeFromProp.y, 24, sim.props)).toBe(false);

      // 3. hasClearWalkableCorridor detects blocking prop and wall along segment
      expect(
        hasClearWalkableCorridor(
          sim.map,
          12 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
          16 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
          14,
          sim.props,
        ),
      ).toBe(false);

      // 4. findNextWalkableWaypoint routes around stationary blocking props and uses 2-step lookahead
      const wpAroundProp = findNextWalkableWaypoint(
        sim.map,
        13 * TILE_SIZE + 16,
        10 * TILE_SIZE + 16,
        16 * TILE_SIZE + 16,
        10 * TILE_SIZE + 16,
        sim.props,
        false,
        14,
      );
      expect(isPointBlockedByStationaryProp(wpAroundProp.x, wpAroundProp.y, 14, sim.props)).toBe(false);
      expect(
        sim.map.isSolidTile(
          Math.floor(wpAroundProp.x / TILE_SIZE),
          Math.floor(wpAroundProp.y / TILE_SIZE),
        ),
      ).toBe(false);
    });

    it('steers ground enemies and bosses around carved room shapes (donut_ring, l_shape, t_shape, u_shape, multi_chamber, island_catwalk) and archetypes without getting stuck', () => {
      const shapesAndArchetypes: Array<{
        shape: (typeof ALL_ROOM_SHAPES)[number];
        archetype: (typeof ALL_ROOM_ARCHETYPES)[number];
      }> = [
        { shape: 'donut_ring', archetype: 'CENTRAL_BASTION' },
        { shape: 'l_shape', archetype: 'GAUNTLET_CHOKEPOINT' },
        { shape: 't_shape', archetype: 'PRISM_LABYRINTH' },
        { shape: 'u_shape', archetype: 'CRUMBLING_PILLAR_RING' },
        { shape: 'multi_chamber', archetype: 'CROSSFIRE_CONVEYORS' },
        { shape: 'island_catwalk', archetype: 'TWIN_BRIDGES' },
      ];

      for (let idx = 0; idx < shapesAndArchetypes.length; idx++) {
        const { shape, archetype } = shapesAndArchetypes[idx]!;
        const sim = createCleanSim(41100 + idx, 1);
        const layout = sim.map.configureRoomLayout(
          'combat',
          41100 + idx,
          false,
          1,
          archetype,
          undefined,
          { roomSizePreset: 'standard', roomShape: shape },
        );
        sim.props.length = 0;
        if (layout) {
          for (const anchor of layout.propAnchors) {
            sim.spawnProp(anchor.propKind, anchor.x, anchor.y);
          }
        }

        const doors = getDoorTilesForMap(sim.map);
        const pPt = findNearestWalkablePoint(
          sim.map,
          (doors.W.tx + 2) * TILE_SIZE + 16,
          doors.W.ty * TILE_SIZE + 16,
          14,
          sim.props,
        );
        const ePt = findNearestWalkablePoint(
          sim.map,
          (doors.E.tx - 2) * TILE_SIZE + 16,
          doors.E.ty * TILE_SIZE + 16,
          18,
          sim.props,
        );
        sim.player.x = pPt.x;
        sim.player.y = pPt.y;
        sim.player.godMode = true;

        const boar = sim.spawnEnemy('wild_boar', ePt.x, ePt.y, true);
        boar.hp = 9999;
        boar.maxHp = 9999;
        const initialDist = distance(boar.x, boar.y, sim.player.x, sim.player.y);

        for (let step = 0; step < 180; step++) {
          sim.step(SIM_STEP_SEC);
          const bTx = Math.floor(boar.x / TILE_SIZE);
          const bTy = Math.floor(boar.y / TILE_SIZE);
          expect(sim.map.isSolidTile(bTx, bTy)).toBe(false);
          expect(sim.map.getSurfaceAtWorld(boar.x, boar.y)).not.toBe('chasm');
        }

        const finalDist = distance(boar.x, boar.y, sim.player.x, sim.player.y);
        expect(finalDist).toBeLessThan(initialDist - 40);
      }
    });

    it('re-resolves map collision after prop push-out, rescues living ground enemies/bosses from solid/chasm tiles, and recovers via navStuckTimer', () => {
      const sim = createCleanSim(41200);
      // 1. Place a stationary prop right next to a wall tile and verify enemy squeezed between prop and wall never ends up in the wall
      sim.map.setTile(10, 10, 'wall');
      sim.map.rebuildSolidBoxes();
      const pillar = sim.spawnProp('rotten_totem_pillar', 11 * TILE_SIZE + 12, 10 * TILE_SIZE + 16);
      const enemy = sim.spawnEnemy('goblin_shooter', 11 * TILE_SIZE, 10 * TILE_SIZE + 16, true);
      enemy.x = pillar.x - pillar.radius - 2;
      enemy.y = pillar.y;
      sim.step(SIM_STEP_SEC);
      expect(
        sim.map.isSolidTile(Math.floor(enemy.x / TILE_SIZE), Math.floor(enemy.y / TILE_SIZE)),
      ).toBe(false);

      // 2. Force a living ground enemy and a boss onto a solid tile and chasm tile -> rescued on next step
      sim.map.setSurface(15, 10, 'chasm', 0, true);
      const boss = sim.spawnEnemy('spore_king', 20 * TILE_SIZE + 16, 10 * TILE_SIZE + 16, true);
      boss.x = 15 * TILE_SIZE + 16;
      boss.y = 10 * TILE_SIZE + 16;
      expect(sim.map.getSurfaceAtWorld(boss.x, boss.y)).toBe('chasm');

      sim.step(SIM_STEP_SEC);
      expect(sim.map.getSurfaceAtWorld(boss.x, boss.y)).not.toBe('chasm');
      expect(
        sim.map.isSolidTile(Math.floor(boss.x / TILE_SIZE), Math.floor(boss.y / TILE_SIZE)),
      ).toBe(false);

      // 3. Verify navStuckTimer flips strafeSign at >= 0.35s when colliding with wall/prop
      sim.map.setTile(9, 8, 'wall');
      sim.map.rebuildSolidBoxes();
      const stuckEnemy = sim.spawnEnemy('goblin_shooter', 8 * TILE_SIZE + 20, 8 * TILE_SIZE + 16, true);
      stuckEnemy.x = 9 * TILE_SIZE - stuckEnemy.radius + 1;
      stuckEnemy.y = 8 * TILE_SIZE + 16;
      stuckEnemy.navAnchorX = stuckEnemy.x;
      stuckEnemy.navAnchorY = stuckEnemy.y;
      stuckEnemy.navStuckTimer = 0.345;
      stuckEnemy.strafeSign = 1;
      sim.player.x = 18 * TILE_SIZE + 16;
      sim.player.y = 8 * TILE_SIZE + 16;
      sim.step(SIM_STEP_SEC);
      expect(stuckEnemy.strafeSign).toBe(-1);
    });

    it('validates boss unburrow/clones/cores/executioner, wave spawns, summons (sacred_tree, tesla_turret, life_blossom, superheated_cyclone), and pull/yank mechanics against walls, chasms, and props', () => {
      const sim = createCleanSim(41300, 1);
      sim.map.configureRoomLayout(
        'combat',
        41300,
        false,
        1,
        'CENTRAL_BASTION',
        undefined,
        { roomSizePreset: 'standard', roomShape: 'donut_ring' },
      );

      // 1. Spore King unburrow on top of a prop + minion summon near wall
      const sporeKing = sim.spawnEnemy('spore_king', 6 * TILE_SIZE + 16, 10 * TILE_SIZE + 16, true);
      const totemAtPlayer = sim.spawnProp('rotten_totem_pillar', sim.player.x, sim.player.y);
      sporeKing.bossPhase = 2;
      sporeKing.hp = Math.floor(sporeKing.maxHp * 0.5);
      sporeKing.bossBurrowed = true;
      sporeKing.bossBurrowTimer = 0.01;
      sporeKing.aiState = 'move';
      updateBossSporeKingAIImpl.call(
        sim,
        sporeKing,
        distance(sporeKing.x, sporeKing.y, sim.player.x, sim.player.y),
        0,
        0.05,
      );
      expect(
        sim.map.isSolidTile(
          Math.floor(sporeKing.x / TILE_SIZE),
          Math.floor(sporeKing.y / TILE_SIZE),
        ),
      ).toBe(false);
      expect(distance(sporeKing.x, sporeKing.y, totemAtPlayer.x, totemAtPlayer.y)).toBeGreaterThanOrEqual(
        sporeKing.radius + totemAtPlayer.radius - 1,
      );

      const enemiesBeforeSummon = sim.enemies.length;
      sporeKing.bossBurrowed = false;
      sporeKing.bossAttackCycle = 1;
      sporeKing.bossAttackPattern = 2;
      executeBossSporeKingAttackImpl.call(sim, sporeKing, sim.player.x, sim.player.y);
      expect(sim.enemies.length).toBeGreaterThan(enemiesBeforeSummon);
      for (const e of sim.enemies) {
        expect(sim.map.isSolidTile(Math.floor(e.x / TILE_SIZE), Math.floor(e.y / TILE_SIZE))).toBe(false);
        expect(sim.map.getSurfaceAtWorld(e.x, e.y)).not.toBe('chasm');
      }

      // 2. Kryssa Mirror Clones on donut_ring (center has monolith wall)
      const kryssa = sim.spawnEnemy('kryssa_ice_queen', 8 * TILE_SIZE + 16, 10 * TILE_SIZE + 16, true);
      spawnKryssaMirrorClonesImpl.call(sim, kryssa);
      const clones = sim.enemies.filter((e) => e.defId === 'kryssa_clone');
      expect(clones.length).toBeGreaterThanOrEqual(2);
      for (const c of clones) {
        expect(sim.map.isSolidTile(Math.floor(c.x / TILE_SIZE), Math.floor(c.y / TILE_SIZE))).toBe(false);
        expect(sim.map.getSurfaceAtWorld(c.x, c.y)).not.toBe('chasm');
      }

      // 3. Forge Titan Energy Cores near wall/monolith
      const titan = sim.spawnEnemy('forge_titan', 18 * TILE_SIZE + 16, 6 * TILE_SIZE + 16, true);
      spawnForgeTitanEnergyCoresImpl.call(sim, titan);
      const cores = sim.enemies.filter((e) => e.defId === 'forge_energy_core');
      expect(cores.length).toBeGreaterThanOrEqual(2);
      for (const core of cores) {
        expect(
          sim.map.isSolidTile(Math.floor(core.x / TILE_SIZE), Math.floor(core.y / TILE_SIZE)),
        ).toBe(false);
      }

      // 4. Ashen Executioner spawn in l_shape & wave firing while inside a wall tile
      sim.map.configureRoomLayout(
        'combat',
        41301,
        false,
        1,
        'GAUNTLET_CHOKEPOINT',
        undefined,
        { roomSizePreset: 'standard', roomShape: 'l_shape' },
      );
      const curRoom = sim.getCurrentRoom();
      curRoom.type = 'combat';
      curRoom.cleared = false;
      sim.player.activePactId = 'pact_ashen_hunted';
      syncAshenExecutionerInRoom(sim);
      const exec = sim.enemies.find((e) => e.defId === 'ashen_executioner');
      expect(exec).toBeDefined();
      if (exec) {
        expect(
          sim.map.isSolidTile(Math.floor(exec.x / TILE_SIZE), Math.floor(exec.y / TILE_SIZE)),
        ).toBe(false);
        // Place executioner on a wall tile ready to fire its wave
        exec.x = 2 * TILE_SIZE + 16;
        exec.y = 2 * TILE_SIZE + 16;
        sim.map.setTile(2, 2, 'wall');
        sim.map.rebuildSolidBoxes();
        exec.aiState = 'telegraph';
        exec.stateTimer = 0.01;
        exec.aimAngle = 0;
        updateAshenExecutionerAI(sim, exec, 0.05, sim.player);
        const wave = sim.projectiles.find((b) => b.weaponId === 'ashen_executioner_wave');
        expect(wave).toBeDefined();
      }

      // 5. Player summons: sacred_tree & tesla_turret aimed into wall/chasm, plus seed gun life_blossom over chasm
      const summonSim = createCleanSim(41302, 1);
      summonSim.map.setSurface(12, 10, 'chasm', 0, true);
      summonSim.player.characterId = 'druid';
      summonSim.player.x = 10 * TILE_SIZE + 16;
      summonSim.player.y = 10 * TILE_SIZE + 16;
      summonSim.player.aimAngle = 0;
      summonSim.player.skillCooldownTimer = 0;
      summonSim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.SKILL });
      const tree = summonSim.summons.find((s) => s.kind === 'sacred_tree');
      expect(tree).toBeDefined();
      if (tree) {
        expect(summonSim.map.getSurfaceAtWorld(tree.x, tree.y)).not.toBe('chasm');
        expect(
          summonSim.map.isSolidTile(Math.floor(tree.x / TILE_SIZE), Math.floor(tree.y / TILE_SIZE)),
        ).toBe(false);
      }

      summonSim.player.characterId = 'engineer';
      summonSim.player.skillCooldownTimer = 0;
      summonSim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      summonSim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.SKILL });
      const turret = summonSim.summons.find((s) => s.kind === 'tesla_turret');
      expect(turret).toBeDefined();
      if (turret) {
        expect(summonSim.map.getSurfaceAtWorld(turret.x, turret.y)).not.toBe('chasm');
        expect(
          summonSim.map.isSolidTile(
            Math.floor(turret.x / TILE_SIZE),
            Math.floor(turret.y / TILE_SIZE),
          ),
        ).toBe(false);
      }

      spawnSeedGunLifeBud(
        summonSim,
        summonSim.player,
        12 * TILE_SIZE + 16,
        10 * TILE_SIZE + 16,
      );
      const bud = summonSim.summons.find((s) => s.kind === 'life_blossom');
      expect(bud).toBeDefined();
      if (bud) {
        expect(summonSim.map.getSurfaceAtWorld(bud.x, bud.y)).not.toBe('chasm');
      }

      // 6. Superheated cyclone routes around an interior wall barrier toward target enemy
      const cycSim = createCleanSim(41303, 1);
      for (let ty = 6; ty <= 14; ty++) {
        cycSim.map.setTile(14, ty, 'wall');
      }
      cycSim.map.rebuildSolidBoxes();
      const cycTarget = cycSim.spawnEnemy('goblin_shooter', 17 * TILE_SIZE + 16, 10 * TILE_SIZE + 16, true);
      cycTarget.hp = 9999;
      cycSim.summons.push({
        id: 777,
        ownerId: cycSim.player.id,
        kind: 'superheated_cyclone',
        x: 13 * TILE_SIZE + 16,
        y: 10 * TILE_SIZE + 16,
        radius: 16,
        hp: 999,
        maxHp: 999,
        ttlSec: 5,
        maxTtlSec: 5,
        attackCooldownSec: 1,
        auraRadius: 96,
      });
      const cycStartY = cycSim.summons[0]!.y;
      for (let i = 0; i < 15; i++) {
        cycSim.step(SIM_STEP_SEC);
      }
      expect(Math.abs(cycSim.summons[0]!.y - cycStartY)).toBeGreaterThan(8);

      // 7. Pull/Yank prop standoff & chasm safety
      const pullSim = createCleanSim(41304, 1);
      const pullProp = pullSim.spawnProp('rotten_totem_pillar', 12 * TILE_SIZE + 16, 10 * TILE_SIZE + 16);
      const pulledEnemy = pullSim.spawnEnemy('goblin_shooter', 13 * TILE_SIZE + 16, 10 * TILE_SIZE + 16, true);
      pulledEnemy.hp = 900;
      pulledEnemy.maxHp = 900;
      pullSim.player.characterId = 'druid';
      pullSim.player.blessingIds = ['druid_poison_roots'];
      pullSim.player.x = 12 * TILE_SIZE + 16;
      pullSim.player.y = 10 * TILE_SIZE + 16;
      pullSim.player.skillCooldownTimer = 0;
      pullSim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.SKILL });
      expect(distance(pulledEnemy.x, pulledEnemy.y, pullProp.x, pullProp.y)).toBeGreaterThanOrEqual(
        pullProp.radius + pulledEnemy.radius - 1,
      );

      // Flame shackle yank into prop
      pullSim.player.blessingIds = ['dash_flame_shackle'];
      pulledEnemy.x = 14 * TILE_SIZE + 16;
      pulledEnemy.y = 10 * TILE_SIZE + 16;
      triggerDashFlameShackle(pullSim, pullSim.player, pullProp.x + 20, pullProp.y);
      expect(distance(pulledEnemy.x, pulledEnemy.y, pullProp.x, pullProp.y)).toBeGreaterThanOrEqual(
        pullProp.radius + pulledEnemy.radius - 1,
      );

      // Chain Harpoon on-hit with cover prop & wall
      applyChainHarpoonOnHit(pullSim, pullSim.player, pulledEnemy);
      expect(
        pullSim.map.isSolidTile(
          Math.floor(pulledEnemy.x / TILE_SIZE),
          Math.floor(pulledEnemy.y / TILE_SIZE),
        ),
      ).toBe(false);

      // Tether Staff tactical vent & Void Staff implosion / orb pull & Emerald Cleaver pull near prop
      pulledEnemy.tetherToX = pullProp.x;
      pulledEnemy.tetherToY = pullProp.y;
      pulledEnemy.tetherTimer = 2.0;
      triggerTetherStaffTacticalVent(pullSim, pullSim.player);
      expect(distance(pulledEnemy.x, pulledEnemy.y, pullProp.x, pullProp.y)).toBeGreaterThanOrEqual(
        pullProp.radius + pulledEnemy.radius - 1,
      );

      // Void Staff orb in flight & implosion pull
      const voidOrb = pullSim.acquireProjectile({
        id: 8801,
        ownerId: pullSim.player.id,
        team: 'player',
        weaponId: 'void_staff_orb',
        x: pullProp.x,
        y: pullProp.y,
        vx: 0,
        vy: 0,
        angle: 0,
        radius: 10,
        damage: 10,
        isCrit: false,
        knockback: 0,
        pierceRemaining: 5,
        bounceRemaining: 0,
        ttlSec: 1.0,
        element: 'none',
        amplifiedByShield: false,
      });
      updateVoidStaffOrbInFlight(pullSim, voidOrb, SIM_STEP_SEC);
      expect(distance(pulledEnemy.x, pulledEnemy.y, pullProp.x, pullProp.y)).toBeGreaterThanOrEqual(
        pullProp.radius + pulledEnemy.radius - 1,
      );

      triggerVoidStaffImplosion(pullSim, voidOrb);
      expect(distance(pulledEnemy.x, pulledEnemy.y, pullProp.x, pullProp.y)).toBeGreaterThanOrEqual(
        pullProp.radius + pulledEnemy.radius - 1,
      );

      // Chasm rescue for boss in resolveEnemyChasmRingOut
      pullSim.map.setSurface(18, 10, 'chasm', 0, true);
      const chasmBoss = pullSim.spawnEnemy('spore_king', 17 * TILE_SIZE + 16, 10 * TILE_SIZE + 16, true);
      chasmBoss.x = 18 * TILE_SIZE + 16;
      chasmBoss.y = 10 * TILE_SIZE + 16;
      expect(resolveEnemyChasmRingOut(pullSim, chasmBoss)).toBe(false);
      expect(pullSim.map.getSurfaceAtWorld(chasmBoss.x, chasmBoss.y)).not.toBe('chasm');
    });
  });

  describe('F21: 100% Strict Biome-Specific Terrain Separation Across Biomes 1, 2 & 3', () => {
    const FORBIDDEN_BY_BIOME: Record<1 | 2 | 3, readonly SurfaceKind[]> = {
      1: ['lava', 'ice', 'conveyor'],
      2: ['lava', 'poison_swamp', 'grass', 'burning_grass', 'conveyor', 'oil', 'burning_oil'],
      3: ['ice', 'poison_swamp', 'grass', 'burning_grass', 'water', 'electrified_water'],
    };

    const ALL_ROOM_TYPES: readonly RoomType[] = [
      'start',
      'combat',
      'boss',
      'treasure',
      'merchant',
      'shrine',
      'secret',
      'portal',
    ];

    it('enforces 0 cross-biome terrain contamination across all 3 biomes, 8 room types, 6 archetypes, 6 size presets, and 10 room shapes', () => {
      const map = new ArenaMap();

      for (const biome of [1, 2, 3] as const) {
        const forbidden = new Set<SurfaceKind>(FORBIDDEN_BY_BIOME[biome]);

        // 1. Direct buildLayout(true, true) check
        map.biome = biome;
        map.resize(36, 22);
        map.buildLayout(true, true);
        for (let i = 0; i < map.surfaces.length; i++) {
          const s = map.surfaces[i]!;
          expect(forbidden.has(s)).toBe(false);
        }

        // 2. All room types across all 6 size presets and all 10 room shapes
        for (const roomType of ALL_ROOM_TYPES) {
          for (const preset of ALL_ROOM_SIZE_PRESETS) {
            for (const shape of ALL_ROOM_SHAPES) {
              map.configureRoomLayout(
                roomType,
                5000 + biome * 100,
                false,
                biome,
                undefined,
                undefined,
                { roomSizePreset: preset, roomShape: shape },
              );
              for (let i = 0; i < map.surfaces.length; i++) {
                const s = map.surfaces[i]!;
                if (forbidden.has(s)) {
                  throw new Error(
                    `Forbidden surface '${s}' found in biome=${biome}, roomType=${roomType}, preset=${preset}, shape=${shape}`,
                  );
                }
              }
            }
          }
        }

        // 3. All 6 combat room archetypes across all 10 room shapes
        for (const archetype of ALL_ROOM_ARCHETYPES) {
          for (const shape of ALL_ROOM_SHAPES) {
            map.configureRoomLayout(
              'combat',
              6000 + biome * 100,
              false,
              biome,
              archetype,
              undefined,
              { roomSizePreset: 'standard', roomShape: shape },
            );
            for (let i = 0; i < map.surfaces.length; i++) {
              const s = map.surfaces[i]!;
              if (forbidden.has(s)) {
                throw new Error(
                  `Forbidden surface '${s}' found in biome=${biome}, archetype=${archetype}, shape=${shape}`,
                );
              }
            }
          }
        }
      }
    });

    it('preserves mid-combat elemental surface reactions (electrifyWaterAt)', () => {
      const map = new ArenaMap();
      map.configureRoomLayout('start', 42001, false, 1);
      // Water at (11, 3) -> shock electrifies water
      expect(map.getSurface(11, 3)).toBe('water');
      map.electrifyWaterAt(11, 3, 4.0);
      expect(map.getSurface(11, 3)).toBe('electrified_water');
    });
  });

  describe('F22: Direct 1-Step Barricade Launch on Melee Swing, Melee Wave Projectile & Dash Without [E] Flip', () => {
    it('never returns flip_cover from findInteractTarget and launches low moss_table, glacial_barricade, and forge_blast_shield in 1 step on melee swing, melee wave projectile, and dash while triggering micro-blank and Table Tech blessings', () => {
      const sim = createCleanSim(43001, 1);
      const p = sim.player;
      p.blessingIds.push(
        'table_tech_rocket',
        'table_tech_blank_nova',
        'table_tech_magnet_snare',
        'table_tech_billiard_master',
      );

      // 1. Low barricades are immediately kickable and never targeted by [E] findInteractTarget
      const table = sim.spawnProp('moss_table', 360, 320);
      const glacial = sim.spawnProp('glacial_barricade', 360, 420);
      const shield = sim.spawnProp('forge_blast_shield', 360, 220);

      expect(table.coverState).toBe('low');
      expect(glacial.coverState).toBe('low');
      expect(shield.coverState).toBe('low');
      expect(isKickableProp(table)).toBe(true);
      expect(isKickableProp(glacial)).toBe(true);
      expect(isKickableProp(shield)).toBe(true);

      p.x = 340;
      p.y = 320;
      expect(findInteractTarget(sim, p.id)).toBeNull();
      expect(sim.interactWithNearest(p)).toBe(false);
      expect(table.coverState).toBe('low');

      // 2. Direct 1-step Melee Swing launches 'low' moss_table -> transitions HP/micro-blank/Table Tech blessings and slides
      const enemyNearTable = sim.spawnEnemy('goblin_shooter', 490, 390, true);
      enemyNearTable.hp = 800;
      enemyNearTable.maxHp = 800;
      const enemyBulletNearTable = sim.acquireProjectile({
        id: 9901,
        ownerId: enemyNearTable.id,
        team: 'enemy',
        weaponId: 'goblin_bow',
        x: 385,
        y: 320,
        vx: -100,
        vy: 0,
        angle: Math.PI,
        radius: 5,
        damage: 10,
        isCrit: false,
        knockback: 0,
        pierceRemaining: 0,
        bounceRemaining: 0,
        ttlSec: 2.0,
        element: 'none',
        amplifiedByShield: false,
      });
      sim.projectiles.push(enemyBulletNearTable);

      p.weaponSlots = ['berserker_axe', 'rivet_gun'];
      p.activeWeaponSlot = 0;
      p.fireCooldownTimer = 0;
      p.aimAngle = 0;
      triggerMeleeKickProps(sim, p, Math.PI / 3, 72, 0);

      expect(table.coverState).toBe('sliding');
      expect(table.hp).toBe(60);
      expect(table.maxHp).toBe(60);
      expect(table.rocketCharged).toBe(true);
      expect(table.bouncesRemaining).toBe(3);
      // Enemy bullet within micro-blank / blank nova radius was cleared on 1-step launch!
      expect(sim.projectiles.some((b) => b.id === 9901)).toBe(false);
      // Table Tech Rocket spawned 2 homing rockets on 1-step launch!
      expect(sim.projectiles.filter((b) => b.weaponId === 'table_tech_rocket')).toHaveLength(2);
      // Table Tech Magnet Snare stunned the nearby enemy!
      expect(enemyNearTable.stunTimer).toBeGreaterThanOrEqual(0.8);

      // 3. Direct 1-step Dash launches 'low' glacial_barricade (HP = 65)
      p.x = 360 - glacial.radius - p.radius + 4;
      p.y = 420;
      p.dashTimer = 0.1;
      p.dashDirX = 1;
      p.dashDirY = 0;
      p.aimAngle = 0;
      sim.resolvePropMovementCollision(p);
      expect(glacial.coverState).toBe('sliding');
      expect(glacial.hp).toBe(65);
      expect(glacial.maxHp).toBe(65);

      // 4. Direct 1-step Melee Wave Projectile (knight_sword_wave / ruby_sword_wave) launches 'low' forge_blast_shield (HP = 85)
      const waveProj = sim.acquireProjectile({
        id: 9902,
        ownerId: p.id,
        team: 'player',
        weaponId: 'knight_sword_wave',
        x: shield.x - 10,
        y: shield.y,
        vx: 480,
        vy: 0,
        angle: 0,
        radius: 16,
        damage: 25,
        isCrit: false,
        knockback: 100,
        pierceRemaining: 3,
        bounceRemaining: 0,
        ttlSec: 0.5,
        element: 'none',
        amplifiedByShield: false,
      });
      sim.projectiles.push(waveProj);
      sim.step(SIM_STEP_SEC);
      expect(shield.coverState).toBe('sliding');
      expect(shield.hp).toBe(85);
      expect(shield.maxHp).toBe(85);

      // 5. Direct 1-step Emerald Cleaver Boomerang launches 'low' moss_table
      const tableBoomerang = sim.spawnProp('moss_table', 500, 220);
      expect(tableBoomerang.coverState).toBe('low');
      const cleaverProj = sim.acquireProjectile({
        id: 9903,
        ownerId: p.id,
        team: 'player',
        weaponId: 'emerald_cleaver_boomerang',
        x: tableBoomerang.x,
        y: tableBoomerang.y,
        vx: 400,
        vy: 0,
        angle: 0,
        radius: 18,
        damage: 30,
        isCrit: false,
        knockback: 100,
        pierceRemaining: 99,
        bounceRemaining: 0,
        ttlSec: 1.2,
        element: 'poison',
        amplifiedByShield: false,
      });
      updateEmeraldCleaverBoomerang(sim, cleaverProj, SIM_STEP_SEC);
      expect(tableBoomerang.coverState).toBe('sliding');
    });
  });
});
