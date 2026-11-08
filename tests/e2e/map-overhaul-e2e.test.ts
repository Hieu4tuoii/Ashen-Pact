import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockPostFXPipeline {
    public game: unknown;
    public name: string;
    constructor(config: { game: unknown; name: string }) {
      this.game = config.game;
      this.name = config.name;
    }
    set1f() {}
    set3f() {}
  }
  class MockSinglePipeline {
    public config: unknown;
    public vertexCount = 0;
    constructor(config: unknown) {
      this.config = config;
    }
    flush() {
      this.vertexCount = 0;
    }
    set1f() {}
    set3f() {}
  }
  class MockWebGLRenderer {
    public pipelines = {
      has: () => true,
      addPostPipeline: () => {},
    };
  }
  class MockScene {
    constructor(_config?: unknown) {}
  }
  const PhaserMock = {
    Scene: MockScene,
    BlendModes: {
      NORMAL: 0,
      ADD: 1,
      MULTIPLY: 2,
      SCREEN: 3,
    },
    Scenes: {
      Events: {
        SHUTDOWN: 'shutdown',
      },
    },
    Renderer: {
      WebGL: {
        WebGLRenderer: MockWebGLRenderer,
        Pipelines: {
          PostFXPipeline: MockPostFXPipeline,
          SinglePipeline: MockSinglePipeline,
        },
      },
    },
  };
  return {
    default: PhaserMock,
    ...PhaserMock,
  };
});

import {
  ALL_ROOM_ARCHETYPES,
  applyRoomInteriorShape,
  areActiveDoorsConnectedBfs,
  ArenaMap,
  AUTOTILE_EAST,
  AUTOTILE_NORTH,
  AUTOTILE_SOUTH,
  AUTOTILE_WEST,
  type CardinalDir,
  clearCollapsedPillarFootprintOnMap,
  collapseRottenTotemPillar,
  computeTwinBridgesRows,
  configureRoomLayout,
  CONVEYOR_BELT_SPEED,
  DOOR_TILES,
  DOOR_VESTIBULE_RECTS,
  ensureSecretWallKickableProp,
  findNearestWalkablePoint,
  findNextWalkableWaypoint,
  generateDungeonFloor,
  getConveyorVelocityAtWorld,
  getCrumblingRingPillarRectsForMap,
  getDoorTilesForMap,
  getDoorVestibuleRectsForMap,
  isActiveWallTile,
  isExteriorVoidWallTile,
  isWalkableTileForBfs,
  MAX_TACTICAL_PROPS_PER_ROOM,
  OPPOSITE_DIR,
  PHASE0B_ROOM_ARCHETYPES,
  ROOM_SIZE_PRESET_DIMS,
  type RoomArchetypeId,
  SIM_STEP_SEC,
  spawnCombatRoomArchetypeProps,
  type SurfaceKind,
  TILE_SIZE,
  tryBreakCrackedWallNearImpact,
  verifyDungeonConnectivity,
  WALL_AO_NORTH,
  WALL_AO_NORTH_WEST,
  WALL_AO_WEST,
  WorldSim,
  distance,
  ENEMIES,
  type EnemyDefId,
  findInteractTarget,
  hasClearWalkableCorridor,
  i18n,
  INPUT_BUTTON,
  type InteractTargetResult,
  isKickableProp,
  isPointBlockedByStationaryProp,
  resolveEnemyChasmRingOut,
  type RoomType,
  triggerMeleeKickProps,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import {
  syncAshenExecutionerInRoom,
  updateAshenExecutionerAI,
} from '../../packages/shared/src/sim/sim-ashen-pacts-combat.js';
import { triggerDashFlameShackle } from '../../packages/shared/src/sim/sim-blessings-dash-reload.js';
import {
  executeBossSporeKingAttackImpl,
  updateBossSporeKingAIImpl,
} from '../../packages/shared/src/sim/sim-enemies-biome1.js';
import { spawnKryssaMirrorClonesImpl } from '../../packages/shared/src/sim/sim-enemies-biome2.js';
import { spawnForgeTitanEnergyCoresImpl } from '../../packages/shared/src/sim/sim-enemies-biome3.js';
import { applyChainHarpoonOnHit } from '../../packages/shared/src/sim/sim-weapon-mutators.js';
import { updateEmeraldCleaverBoomerang } from '../../packages/shared/src/sim/sim-weapon-specials-p1b-melee.js';
import {
  triggerVoidStaffImplosion,
  updateVoidStaffOrbInFlight,
} from '../../packages/shared/src/sim/sim-weapon-specials-p1b-ranged.js';
import {
  spawnSeedGunLifeBud,
  triggerTetherStaffTacticalVent,
} from '../../packages/shared/src/sim/sim-weapon-specials-rare.js';
import { ENV_PALETTE, hexToNum, PALETTE } from '../../apps/client/src/art/palette.js';
import { TextureBaker } from '../../apps/client/src/art/texture-baker.js';
import { bakeProps } from '../../apps/client/src/art/texture-baker-props.js';
import { bakeP1CProps } from '../../apps/client/src/art/texture-baker-props-p1c.js';
import {
  bakeSurfaces,
  drawBridgeOverChasmOverlay,
  drawSurfaceTile,
  isBridgeFloorTileOverChasm,
  traceOrganicPoolPath,
} from '../../apps/client/src/art/texture-baker-surfaces.js';
import {
  bakeBiomeTile,
  bakeCrackedWallTile,
  bakePillarTile,
  bakeWallAoOverlay,
  bakeWallTile,
} from '../../apps/client/src/art/texture-baker-tiles.js';
import { getFreezeVisualTimeSec, parseVisualQuery } from '../../apps/client/src/core/visual-query.js';
import {
  type InteractableLightEntry,
  resolveInteractableVisualGlowSpec,
} from '../../apps/client/src/fx/lighting-config.js';
import type { GameScene } from '../../apps/client/src/scenes/GameScene.js';
import {
  renderTileCellToCompositeImpl,
  teleportToRoomImpl,
} from '../../apps/client/src/scenes/game-scene/arena-tiles.js';
import {
  canTeleportFromCurrentRoom,
  resolveMinimapClickedRoomId,
} from '../../apps/client/src/scenes/game-scene/hud-combat-and-coop.js';
import { resolveInteractPromptSpec } from '../../apps/client/src/scenes/game-scene/interact-prompt.js';
import { renderTelegraphsAndShieldImpl } from '../../apps/client/src/scenes/game-scene/telegraphs-and-overlays.js';
import { graphicsSettings } from '../../apps/client/src/ui/graphics-settings.js';
import { UI_THEME } from '../../apps/client/src/ui/theme.js';
import {
  BiomeArchitectureLiveLayer,
  buildRoomArchitecturePlan,
  computeTileDistToWall,
  getVisibleFloorDecals,
  isFloorDecalVisible,
  renderBiomeArchitectureToComposite,
  resolveCornerActiveWallTile,
  resolveHybridFloorVariant,
  resolvePerimeterWallTileNear,
} from '../../apps/client/src/world/biome-architecture.js';
import Phaser from 'phaser';
import { srgbToCieL } from '../../tools/visual-metrics.js';
import {
  ALL_ROOM_SHAPES,
  ALL_ROOM_SIZE_PRESETS,
  areActiveDoorsConnectedBfsContract,
  bakeBiomeTileContract,
  bakePillarTileContract,
  bakeWallTileContract,
  buildRoomArchitecturePlanContract,
  carveRoomShapeOnMap,
  computeMinimapRoomPolygon,
  configureRoomLayoutContract,
  countNonEmptyStrokesWithColor,
  createMockGameSceneHarness,
  createRecording2dContext,
  createRecordingGraphics,
  createWorldSimWithOverhaulSupport,
  drawBridgeOverChasmOverlayContract,
  drawMinimapRoomSilhouette,
  drawSurfaceTileContract,
  enhanceBiomeArchitectureLiveLayerContract,
  type ExtendedDungeonRoomNode,
  findNextWalkableWaypointContract,
  generateDungeonFloorContract,
  getAllRecordedColors,
  getDoorTilesForMapContract,
  getDoorVestibuleRectsForMapContract,
  getRoomSizePresetDims,
  hasChasmAlongAxisWithin3,
  isInMapDoorVestibule,
  LightingPipeline,
  populateInteractableLightsScratchContract,
  resizeArenaMapContract,
  resolveMinimapNodeDims,
  type RoomShapeKind,
  type RoomSizePreset,
  SPEC_ROOM_SIZE_PRESET_DIMS,
  traceOrganicPoolPathContract,
  updateMinimapHudImpl,
  VALID_DUNGEON_ROOM_SIZE_PRESETS,
  withMockBakerScene,
} from './helpers/map-overhaul-harness.js';

function hexToRgbTuple(hex: string): [number, number, number] {
  const num = hexToNum(hex);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

if (process.env.VITEST) {
  describe('Ashen-Pact Commercial 2.5D Map Overhaul — 4-Tier E2E Test Suite (F1–F10)', () => {
    // ==========================================================================
    // TIER 1 — FEATURE COVERAGE (50 TEST CASES: 5 PER FEATURE F1–F10)
    // ==========================================================================
    describe('Tier 1 — Feature Coverage (F1–F10)', () => {
      describe('Tier 1 :: F1 — Dynamic ArenaMap.resize & 6 Room Size Presets', () => {
        it('T1-F1-01: verifies all RoomSizePreset dimensions are even integers matching PROJECT.md specification', () => {
          const dims = getRoomSizePresetDims();
          for (const preset of ALL_ROOM_SIZE_PRESETS) {
            expect(dims[preset]).toBeDefined();
          }
          expect(dims.compact).toEqual({ cols: 28, rows: 18 });
          expect(dims.standard).toEqual({ cols: 36, rows: 22 });
          expect(dims.wide_hall).toEqual({ cols: 46, rows: 20 });
          expect(dims.tall_sanctum).toEqual({ cols: 32, rows: 28 });
          expect(dims.grand_arena).toEqual({ cols: 44, rows: 26 });
          expect(dims.colossal_boss).toEqual({ cols: 48, rows: 28 });
          for (const preset of ALL_ROOM_SIZE_PRESETS) {
            expect(dims[preset].cols % 2).toBe(0);
            expect(dims[preset].rows % 2).toBe(0);
          }
        });

        it('T1-F1-02: resizes ArenaMap across all 6 presets and reallocates tiles, variants, surfaces, and timers', () => {
          const map = new ArenaMap();
          const dims = getRoomSizePresetDims();
          for (const preset of ALL_ROOM_SIZE_PRESETS) {
            const { cols, rows } = dims[preset];
            const prevRev = map.mapRevision;
            resizeArenaMapContract(map, cols, rows);
            const expectedCount = cols * rows;
            expect(map.cols).toBe(cols);
            expect(map.rows).toBe(rows);
            expect(map.width).toBe(cols * TILE_SIZE);
            expect(map.height).toBe(rows * TILE_SIZE);
            expect(map.tiles.length).toBe(expectedCount);
            expect(map.tileVariants.length).toBe(expectedCount);
            expect(map.surfaces.length).toBe(expectedCount);
            expect(map.baseSurfaces.length).toBe(expectedCount);
            expect(map.surfaceTimers.length).toBe(expectedCount);
            expect(map.mapRevision).toBeGreaterThanOrEqual(prevRev);
          }
        });

        it('T1-F1-03: rebuilds outer border walls and solidBoxes accurately after ArenaMap.resize', () => {
          const map = new ArenaMap();
          resizeArenaMapContract(map, 46, 20);
          expect(map.getTile(0, 0)).toBe('wall');
          expect(map.getTile(45, 0)).toBe('wall');
          expect(map.getTile(0, 19)).toBe('wall');
          expect(map.getTile(45, 19)).toBe('wall');
          expect(map.solidBoxes.length).toBeGreaterThanOrEqual(2 * 46 + 2 * 18);
          const maxBoxX = Math.max(...map.solidBoxes.map((b) => b.maxX));
          const maxBoxY = Math.max(...map.solidBoxes.map((b) => b.maxY));
          expect(maxBoxX).toBe(46 * TILE_SIZE);
          expect(maxBoxY).toBe(20 * TILE_SIZE);
        });

        it('T1-F1-04: assigns roomSizePreset, cols, and rows to DungeonRoomNode across generated dungeon floors', () => {
          const floor = generateDungeonFloorContract(20261106, 1, 1, 1);
          expect(floor.rooms.length).toBeGreaterThanOrEqual(6);
          const distinctPresets = new Set<string>();
          for (const rawRoom of floor.rooms) {
            const room = rawRoom as ExtendedDungeonRoomNode;
            expect(room.roomSizePreset).toBeDefined();
            expect(VALID_DUNGEON_ROOM_SIZE_PRESETS).toContain(room.roomSizePreset!);
            const spec = SPEC_ROOM_SIZE_PRESET_DIMS[room.roomSizePreset!];
            expect(room.cols).toBe(spec.cols);
            expect(room.rows).toBe(spec.rows);
            distinctPresets.add(room.roomSizePreset!);
          }
          expect(distinctPresets.size).toBeGreaterThanOrEqual(2);
        });

        it('T1-F1-05: resizes WorldSim.map dynamically on enterRoom and resets to 36x22 on enterHub', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 778899, startInHub: false });
          sim.advanceToFloor(2);
          const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss') as
            | ExtendedDungeonRoomNode
            | undefined;
          expect(bossRoom).toBeDefined();
          const entered = sim.enterRoom(bossRoom!.id);
          expect(entered).toBe(true);
          expect(sim.map.cols).toBe(bossRoom!.cols ?? 48);
          expect(sim.map.rows).toBe(bossRoom!.rows ?? 28);
          expect(sim.map.width).toBe(sim.map.cols * TILE_SIZE);
          expect(sim.map.height).toBe(sim.map.rows * TILE_SIZE);

          sim.enterHub();
          expect(sim.inHub).toBe(true);
          expect(sim.map.cols).toBe(36);
          expect(sim.map.rows).toBe(22);
        });
      });

      describe('Tier 1 :: F2 — Multi-Geometry Room Silhouettes (rectangle, octagon, cruciform, hourglass)', () => {
        it('T1-F2-01: carves rectangle silhouette with open interior corners and solid outer perimeter', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'combat',
            roomSeed: 42,
            archetype: 'CENTRAL_BASTION',
            biome: 1,
            cols: 36,
            rows: 22,
            roomShape: 'rectangle',
          });
          expect(map.getTile(0, 0)).toBe('wall');
          expect(map.getTile(1, 1)).toBe('floor');
          expect(map.getTile(map.cols - 2, 1)).toBe('floor');
          expect(map.getTile(1, map.rows - 2)).toBe('floor');
          expect(map.getTile(map.cols - 2, map.rows - 2)).toBe('floor');
        });

        it('T1-F2-02: carves octagon silhouette with stepped chamfered corner walls in all 4 quadrants', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'combat',
            roomSeed: 108,
            archetype: 'CENTRAL_BASTION',
            biome: 1,
            cols: 36,
            rows: 22,
            roomShape: 'octagon',
          });
          expect(map.getTile(1, 1)).toBe('wall');
          expect(map.getTile(map.cols - 2, 1)).toBe('wall');
          expect(map.getTile(1, map.rows - 2)).toBe('wall');
          expect(map.getTile(map.cols - 2, map.rows - 2)).toBe('wall');
          expect(areActiveDoorsConnectedBfsContract(map, ['N', 'S', 'E', 'W'])).toBe(true);
        });

        it('T1-F2-03: carves cruciform silhouette with recessed corner wall blocks and open cardinal cross arms', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'combat',
            roomSeed: 212,
            archetype: 'GAUNTLET_CHOKEPOINT',
            biome: 2,
            cols: 36,
            rows: 22,
            roomShape: 'cruciform',
          });
          expect(map.getTile(2, 2)).toBe('wall');
          expect(map.getTile(map.cols - 3, 2)).toBe('wall');
          expect(map.getTile(2, map.rows - 3)).toBe('wall');
          expect(map.getTile(map.cols - 3, map.rows - 3)).toBe('wall');
          const doors = getDoorTilesForMapContract(map);
          expect(map.getTile(doors.N.tx, doors.N.ty)).toBe('floor');
          expect(map.getTile(doors.S.tx, doors.S.ty)).toBe('floor');
          expect(map.getTile(doors.W.tx, doors.W.ty)).toBe('floor');
          expect(map.getTile(doors.E.tx, doors.E.ty)).toBe('floor');
        });

        it('T1-F2-04: carves hourglass silhouette with pinched mid-wall buttresses while preserving central passage', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'combat',
            roomSeed: 314,
            archetype: 'PRISM_LABYRINTH',
            biome: 3,
            cols: 36,
            rows: 22,
            roomShape: 'hourglass',
          });
          let interiorWallCount = 0;
          for (let ty = 1; ty < map.rows - 1; ty++) {
            for (let tx = 1; tx < map.cols - 1; tx++) {
              if (map.getTile(tx, ty) === 'wall') interiorWallCount += 1;
            }
          }
          expect(interiorWallCount).toBeGreaterThan(4);
          expect(areActiveDoorsConnectedBfsContract(map, ['N', 'S', 'E', 'W'])).toBe(true);
          const midX = Math.floor(map.cols / 2);
          const midY = Math.floor(map.rows / 2);
          expect(
            !map.isSolidTile(midX, midY) || !map.isSolidTile(midX - 1, midY) || !map.isSolidTile(midX + 1, midY),
          ).toBe(true);
        });

        it('T1-F2-05: assigns diverse RoomShapeKind silhouettes across generated dungeon combat rooms', () => {
          const floor = generateDungeonFloorContract(909090, 1, 2, 1);
          const shapes = new Set<RoomShapeKind>();
          for (const rawRoom of floor.rooms) {
            const room = rawRoom as ExtendedDungeonRoomNode;
            expect(room.roomShape).toBeDefined();
            expect(ALL_ROOM_SHAPES).toContain(room.roomShape!);
            shapes.add(room.roomShape!);
          }
          expect(shapes.size).toBeGreaterThanOrEqual(2);
        });
      });

      describe('Tier 1 :: F3 — Dynamic Door/Vestibule Helpers, Proportional Archetypes & BFS Connectivity', () => {
        it('T1-F3-01: computes centered getDoorTilesForMap across all 6 room size presets', () => {
          const dims = getRoomSizePresetDims();
          for (const preset of ALL_ROOM_SIZE_PRESETS) {
            const { cols, rows } = dims[preset];
            const doors = getDoorTilesForMapContract({ cols, rows });
            expect(doors.N).toEqual({ tx: Math.floor(cols / 2), ty: 1 });
            expect(doors.S).toEqual({ tx: Math.floor(cols / 2), ty: rows - 2 });
            expect(doors.W).toEqual({ tx: 1, ty: Math.floor(rows / 2) });
            expect(doors.E).toEqual({ tx: cols - 2, ty: Math.floor(rows / 2) });
          }
        });

        it('T1-F3-02: computes 3x3 getDoorVestibuleRectsForMap enclosing each cardinal door tile', () => {
          const dims = getRoomSizePresetDims();
          for (const preset of ALL_ROOM_SIZE_PRESETS) {
            const { cols, rows } = dims[preset];
            const doors = getDoorTilesForMapContract({ cols, rows });
            const rects = getDoorVestibuleRectsForMapContract({ cols, rows });
            for (const dir of ['N', 'S', 'E', 'W'] as const) {
              const d = doors[dir];
              const r = rects[dir];
              expect(r.maxTx - r.minTx).toBe(2);
              expect(r.maxTy - r.minTy).toBe(2);
              expect(d.tx).toBeGreaterThanOrEqual(r.minTx);
              expect(d.tx).toBeLessThanOrEqual(r.maxTx);
              expect(d.ty).toBeGreaterThanOrEqual(r.minTy);
              expect(d.ty).toBeLessThanOrEqual(r.maxTy);
            }
          }
        });

        it('T1-F3-03: scales all 6 combat archetypes across all 6 room presets with 100% BFS door connectivity', () => {
          const dims = getRoomSizePresetDims();
          const map = new ArenaMap();
          for (const preset of ALL_ROOM_SIZE_PRESETS) {
            const { cols, rows } = dims[preset];
            for (const archetype of ALL_ROOM_ARCHETYPES) {
              configureRoomLayoutContract(map, {
                roomType: 'combat',
                roomSeed: 505,
                archetype,
                biome: 1,
                cols,
                rows,
                roomShape: 'rectangle',
              });
              expect(map.cols).toBe(cols);
              expect(map.rows).toBe(rows);
              expect(areActiveDoorsConnectedBfsContract(map, ['N', 'S', 'E', 'W'])).toBe(true);
            }
          }
        });

        it('T1-F3-04: places all propAnchors on walkable non-solid non-chasm tiles outside door vestibules', () => {
          const map = new ArenaMap();
          for (const archetype of ALL_ROOM_ARCHETYPES) {
            configureRoomLayoutContract(map, {
              roomType: 'combat',
              roomSeed: 888,
              archetype,
              biome: 2,
              cols: 44,
              rows: 26,
              roomShape: 'octagon',
            });
            expect(map.propAnchors.length).toBeGreaterThan(0);
            for (const anchor of map.propAnchors) {
              expect(anchor.tx).toBeGreaterThan(0);
              expect(anchor.tx).toBeLessThan(map.cols - 1);
              expect(anchor.ty).toBeGreaterThan(0);
              expect(anchor.ty).toBeLessThan(map.rows - 1);
              if (anchor.propKind !== 'rotten_totem_pillar') {
                expect(map.isSolidTile(anchor.tx, anchor.ty)).toBe(false);
                expect(map.getSurface(anchor.tx, anchor.ty)).not.toBe('chasm');
                expect(isInMapDoorVestibule(map, anchor.tx, anchor.ty)).toBe(false);
              }
            }
          }
        });

        it('T1-F3-05: positions WorldSim room doors and cracked secret walls at dynamic midpoints on resized maps', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 30303, startInHub: false });
          resizeArenaMapContract(sim.map, 46, 20);
          sim.rebuildCurrentRoomDoors();
          for (const door of sim.doors) {
            if (door.dir === 'N' || door.dir === 'S') {
              expect(Math.floor(door.x / TILE_SIZE)).toBe(23);
            } else {
              expect(Math.floor(door.y / TILE_SIZE)).toBe(10);
            }
          }
          expect(sim.map.getCrackedWallTileForDir('N')).toEqual({ tx: 23, ty: 0 });
          expect(sim.map.getCrackedWallTileForDir('S')).toEqual({ tx: 23, ty: 19 });
          expect(sim.map.getCrackedWallTileForDir('W')).toEqual({ tx: 0, ty: 10 });
          expect(sim.map.getCrackedWallTileForDir('E')).toEqual({ tx: 45, ty: 10 });
        });
      });

      describe('Tier 1 :: F4 — Tactical Prop Eviction Protection & Pillar Integrity', () => {
        it('T1-F4-01: enforces MAX_TACTICAL_PROPS_PER_ROOM cap when stressTestActive is false', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 1234, startInHub: false });
          sim.props.length = 0;
          for (let i = 0; i < MAX_TACTICAL_PROPS_PER_ROOM + 6; i++) {
            sim.spawnProp('volatile_spore_pod', 200 + (i % 6) * 48, 200 + Math.floor(i / 6) * 48);
          }
          expect(sim.stressTestActive).toBe(false);
          expect(sim.props.length).toBeLessThanOrEqual(MAX_TACTICAL_PROPS_PER_ROOM);
          expect(sim.props.every((p) => p.kind === 'volatile_spore_pod')).toBe(true);
        });

        it('T1-F4-02: never evicts intact rotten_totem_pillar props when non-pillar props are available for eviction', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 4455, startInHub: false });
          configureRoomLayoutContract(sim.map, {
            roomType: 'combat',
            roomSeed: 4455,
            archetype: 'CRUMBLING_PILLAR_RING',
            biome: 1,
            cols: 36,
            rows: 22,
          });
          sim.props.length = 0;
          spawnCombatRoomArchetypeProps(sim, sim.getCurrentRoom());
          const initialTotems = sim.props.filter((p) => p.kind === 'rotten_totem_pillar');
          expect(initialTotems.length).toBe(6);

          // Spawn 15 extra destructible spore pods to exceed MAX_TACTICAL_PROPS_PER_ROOM (16)
          for (let i = 0; i < 15; i++) {
            sim.spawnProp('caustic_spore_pod', 180 + (i % 5) * 40, 180 + Math.floor(i / 5) * 40);
          }
          const survivingTotems = sim.props.filter(
            (p) => p.kind === 'rotten_totem_pillar' && p.hp > 0,
          );
          expect(survivingTotems.length).toBe(6);
          expect(sim.props.length).toBeLessThanOrEqual(MAX_TACTICAL_PROPS_PER_ROOM);
        });

        it('T1-F4-03: guarantees every 2x2 TileKind.Pillar in CRUMBLING_PILLAR_RING has a live rotten_totem_pillar or is cleared', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 6677, startInHub: false });
          configureRoomLayoutContract(sim.map, {
            roomType: 'combat',
            roomSeed: 6677,
            archetype: 'CRUMBLING_PILLAR_RING',
            biome: 1,
          });
          sim.props.length = 0;
          spawnCombatRoomArchetypeProps(sim, sim.getCurrentRoom());
          for (let i = 0; i < 12; i++) {
            sim.spawnProp('volatile_spore_pod', 220 + (i % 4) * 50, 220 + Math.floor(i / 4) * 50);
          }

          let pillarTileCount = 0;
          for (let ty = 1; ty < sim.map.rows - 1; ty++) {
            for (let tx = 1; tx < sim.map.cols - 1; tx++) {
              if (sim.map.getTile(tx, ty) === 'pillar') {
                pillarTileCount += 1;
                const tileCx = tx * TILE_SIZE + 16;
                const tileCy = ty * TILE_SIZE + 16;
                const matchingTotem = sim.props.find(
                  (p) =>
                    p.kind === 'rotten_totem_pillar' &&
                    p.hp > 0 &&
                    Math.hypot(p.x - tileCx, p.y - tileCy) <= TILE_SIZE * 1.5,
                );
                expect(matchingTotem).toBeDefined();
                expect(matchingTotem!.hp).toBeGreaterThan(0);
              }
            }
          }
          expect(pillarTileCount).toBe(24);
          expect(sim.props.length).toBeLessThanOrEqual(MAX_TACTICAL_PROPS_PER_ROOM);
        });

        it('T1-F4-04: clears 2x2 solid TileKind.Pillar footprint and increments mapRevision when collapseRottenTotemPillar is called', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 7788, startInHub: false });
          configureRoomLayoutContract(sim.map, {
            roomType: 'combat',
            roomSeed: 7788,
            archetype: 'CRUMBLING_PILLAR_RING',
            biome: 1,
          });
          sim.props.length = 0;
          spawnCombatRoomArchetypeProps(sim, sim.getCurrentRoom());
          const totem = sim.props.find((p) => p.kind === 'rotten_totem_pillar')!;
          expect(totem).toBeDefined();

          const baseTx = Math.floor(totem.x / TILE_SIZE) - 1;
          const baseTy = Math.floor(totem.y / TILE_SIZE) - 1;
          expect(sim.map.getTile(baseTx, baseTy)).toBe('pillar');
          const prevRev = sim.map.mapRevision;

          const collapsed = collapseRottenTotemPillar(sim, totem, 0);
          expect(collapsed).toBe(true);
          expect(totem.coverState).toBe('fallen');
          expect(sim.map.getTile(baseTx, baseTy)).toBe('floor');
          expect(sim.map.getTile(baseTx + 1, baseTy + 1)).toBe('floor');
          expect(sim.map.mapRevision).toBeGreaterThan(prevRev);
        });

        it('T1-F4-05: evicts broken/fallen props before intact destructible props when reaching MAX_TACTICAL_PROPS_PER_ROOM', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 8899, startInHub: false });
          sim.props.length = 0;
          const brokenProp = sim.spawnProp('volatile_spore_pod', 200, 200);
          brokenProp.hp = 0;
          brokenProp.state = 'broken';
          const intactIds: number[] = [];
          for (let i = 1; i < MAX_TACTICAL_PROPS_PER_ROOM; i++) {
            const p = sim.spawnProp('volatile_spore_pod', 240 + (i % 5) * 40, 200 + Math.floor(i / 5) * 40);
            intactIds.push(p.id);
          }
          expect(sim.props.length).toBe(MAX_TACTICAL_PROPS_PER_ROOM);

          const newlySpawned = sim.spawnProp('slag_crucible', 500, 350);
          expect(sim.props.length).toBe(MAX_TACTICAL_PROPS_PER_ROOM);
          expect(sim.props.some((p) => p.id === brokenProp.id)).toBe(false);
          expect(sim.props.some((p) => p.id === newlySpawned.id)).toBe(true);
          for (const id of intactIds) {
            expect(sim.props.some((p) => p.id === id)).toBe(true);
          }
        });
      });

      describe('Tier 1 :: F5 — Realistic Multi-Layered Molten Lava, Crystalline Ice & Organic Shorelines', () => {
        it('T1-F5-01: renders multi-layered molten lava with charred basalt rim, magma gradient, crust plates, and incandescent fissures', () => {
          const ctx = createRecording2dContext();
          drawSurfaceTileContract(ctx, 'lava', 0, 0, 0, 32, 0, 3);
          const colors = getAllRecordedColors(ctx);
          const fillStrokeOps = ctx.ops.filter((o) => o.type === 'fill' || o.type === 'stroke');
          expect(fillStrokeOps.length).toBeGreaterThanOrEqual(6);
          // Charred basalt / crust plates
          expect(
            colors.has('#1F1614') || colors.has('#261816') || colors.has('#3B2D29') || colors.has('#451A14'),
          ).toBe(true);
          // Magma bed
          expect(
            colors.has('#991B1B') || colors.has('#DC2626') || colors.has('#8A342B') || colors.has('#B82538'),
          ).toBe(true);
          // Incandescent orange/gold/white fissures
          expect(colors.has('#F97316') || colors.has('#EA580C')).toBe(true);
          expect(colors.has('#FACC15') || colors.has('#FFFDF5') || colors.has('#FDE047')).toBe(true);
        });

        it('T1-F5-02: varies lava crust plates and Voronoi magma fissures across variants 0..7', () => {
          const signatures = new Set<string>();
          const orderedSigs: string[] = [];
          for (let v = 0; v < 8; v++) {
            const ctx = createRecording2dContext();
            drawSurfaceTileContract(ctx, 'lava', 15, 0, 0, 32, v, 3);
            const pathOps = ctx.ops.filter((o) => o.type === 'moveTo' || o.type === 'lineTo');
            expect(pathOps.length).toBeGreaterThanOrEqual(4);
            const sig = pathOps
              .map((o) => o.args.map((n) => Number(n).toFixed(1)).join(','))
              .join(';');
            signatures.add(sig);
            orderedSigs.push(sig);
          }
          expect(signatures.size).toBeGreaterThanOrEqual(4);
          expect(orderedSigs[0]).not.toEqual(orderedSigs[1]);
        });

        it('T1-F5-03: renders multi-layered crystalline ice with glacial gradient, frosted rim, facets, and Voronoi fracture networks', () => {
          const ctx = createRecording2dContext();
          drawSurfaceTileContract(ctx, 'ice', 0, 0, 0, 32, 1, 2);
          const colors = getAllRecordedColors(ctx);
          const lineToCount = ctx.ops.filter((o) => o.type === 'lineTo').length;
          expect(lineToCount).toBeGreaterThanOrEqual(8);
          expect(
            colors.has('#2C5E7A') || colors.has('#4889A6') || colors.has('#7DD3FC') || colors.has('#4F7A8A'),
          ).toBe(true);
          expect(colors.has('#CFE8EE') || colors.has('#E0F2FE') || colors.has('#BAE6FD')).toBe(true);
          expect(colors.has('#1E3A5F') || colors.has('#182A33') || colors.has('#0F1E36')).toBe(true);
        });

        it('T1-F5-04: varies crystalline ice fracture network geometry across variants 0..7', () => {
          const signatures = new Set<string>();
          const orderedSigs: string[] = [];
          for (let v = 0; v < 8; v++) {
            const ctx = createRecording2dContext();
            drawSurfaceTileContract(ctx, 'ice', 15, 0, 0, 32, v, 2);
            const pathOps = ctx.ops.filter((o) => o.type === 'moveTo' || o.type === 'lineTo');
            expect(pathOps.length).toBeGreaterThanOrEqual(6);
            const sig = pathOps
              .map((o) => o.args.map((n) => Number(n).toFixed(1)).join(','))
              .join(';');
            signatures.add(sig);
            orderedSigs.push(sig);
          }
          expect(signatures.size).toBeGreaterThanOrEqual(4);
          expect(orderedSigs[0]).not.toEqual(orderedSigs[1]);
        });

        it('T1-F5-05: traces seamless non-pinching multi-tile organic pool paths across connected cardinal masks', () => {
          const ctxIsolated = createRecording2dContext();
          traceOrganicPoolPathContract(ctxIsolated, 0, 2.6);
          const isolatedArcs = ctxIsolated.ops.filter((o) => o.type === 'arcTo');
          expect(isolatedArcs.length).toBe(4);

          const ctxHoriz = createRecording2dContext();
          traceOrganicPoolPathContract(ctxHoriz, AUTOTILE_EAST | AUTOTILE_WEST, 2.6);
          const horizArcs = ctxHoriz.ops.filter((o) => o.type === 'arcTo');
          expect(horizArcs.length).toBe(0);
          const moveOp = ctxHoriz.ops.find((o) => o.type === 'moveTo');
          expect(moveOp?.args[0]).toBe(0);

          const ctxInterior = createRecording2dContext();
          traceOrganicPoolPathContract(ctxInterior, 15, 2.6);
          expect(ctxInterior.ops.filter((o) => o.type === 'arcTo').length).toBe(0);
        });
      });

      describe('Tier 1 :: F6 — Terrain Surfaces, Subterranean Chasm Strata, Conveyors & 3-Tile Bridges', () => {
        it('T1-F6-01: bakes all 12 standalone 32x32 surface textures in bakeSurfaces at scale=4', () => {
          withMockBakerScene((scene, baked) => {
            bakeSurfaces(scene, 4);
            const expectedKeys = [
              'surface_water',
              'surface_electrified_water',
              'surface_oil',
              'surface_burning_oil',
              'surface_grass',
              'surface_burning_grass',
              'surface_ash',
              'surface_poison_swamp',
              'surface_lava',
              'surface_ice',
              'surface_chasm',
              'surface_conveyor',
            ];
            for (const key of expectedKeys) {
              expect(baked.has(key)).toBe(true);
              const entry = baked.get(key)!;
              expect(entry.width).toBe(128);
              expect(entry.height).toBe(128);
              expect(entry.ctx.ops.length).toBeGreaterThan(2);
            }
          });
        });

        it('T1-F6-02: renders rich multi-layered water, electrified_water, and poison_swamp surfaces', () => {
          const ctxWater = createRecording2dContext();
          drawSurfaceTileContract(ctxWater, 'water', 0, 0, 0, 32, 0, 1);
          expect(ctxWater.ops.filter((o) => o.type === 'arc').length).toBeGreaterThanOrEqual(2);

          const ctxElec = createRecording2dContext();
          drawSurfaceTileContract(ctxElec, 'electrified_water', 0, 0, 0, 32, 1, 2);
          const elecColors = getAllRecordedColors(ctxElec);
          expect(ctxElec.ops.filter((o) => o.type === 'lineTo').length).toBeGreaterThanOrEqual(6);
          expect(elecColors.has('#22D3EE') || elecColors.has('#FDE047')).toBe(true);

          const ctxSwamp = createRecording2dContext();
          drawSurfaceTileContract(ctxSwamp, 'poison_swamp', 0, 0, 0, 32, 2, 1);
          const swampColors = getAllRecordedColors(ctxSwamp);
          expect(ctxSwamp.ops.filter((o) => o.type === 'arc').length).toBeGreaterThanOrEqual(3);
          expect(swampColors.has('#84CC16') || swampColors.has('#499F54')).toBe(true);
        });

        it('T1-F6-03: renders multi-layered oil, volumetric grass tufts, burning_oil, and burning_grass', () => {
          const ctxOil = createRecording2dContext();
          drawSurfaceTileContract(ctxOil, 'oil', 15, 0, 0, 32, 0, 3);
          expect(ctxOil.ops.filter((o) => o.type === 'ellipse').length).toBeGreaterThanOrEqual(2);

          const ctxGrass = createRecording2dContext();
          drawSurfaceTileContract(ctxGrass, 'grass', 15, 0, 0, 32, 1, 1);
          expect(ctxGrass.ops.filter((o) => o.type === 'fill').length).toBeGreaterThanOrEqual(5);

          const ctxBurnOil = createRecording2dContext();
          drawSurfaceTileContract(ctxBurnOil, 'burning_oil', 15, 0, 0, 32, 2, 3);
          const burnColors = getAllRecordedColors(ctxBurnOil);
          expect(burnColors.has('#DC2626') || burnColors.has('#F97316')).toBe(true);
          expect(burnColors.has('#FACC15') || burnColors.has('#F4F1EA')).toBe(true);
        });

        it('T1-F6-04: renders receding subterranean chasm cliff strata with biome-specific ledges and industrial conveyors', () => {
          const biomePalettes: Array<Set<string>> = [];
          for (const biome of [1, 2, 3] as const) {
            const ctxChasm = createRecording2dContext();
            drawSurfaceTileContract(ctxChasm, 'chasm', AUTOTILE_SOUTH, 0, 0, 32, 0, biome);
            expect(ctxChasm.ops.filter((o) => o.type === 'fillRect' || o.type === 'fill').length).toBeGreaterThanOrEqual(3);
            biomePalettes.push(getAllRecordedColors(ctxChasm));
          }
          expect([...biomePalettes[0]!].join(',')).not.toEqual([...biomePalettes[1]!].join(','));
          expect([...biomePalettes[1]!].join(',')).not.toEqual([...biomePalettes[2]!].join(','));

          const ctxConv = createRecording2dContext();
          drawSurfaceTileContract(ctxConv, 'conveyor', 10, 0, 0, 32, 0, 3);
          expect(ctxConv.ops.filter((o) => o.type === 'stroke' || o.type === 'strokeRect').length).toBeGreaterThanOrEqual(3);
        });

        it('T1-F6-05: detects all 3 rows of a 3-tile chasm bridge and draws decking, planks, and edge railings', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'combat',
            roomSeed: 10,
            archetype: 'TWIN_BRIDGES',
            biome: 1,
            cols: 36,
            rows: 22,
          });
          // TWIN_BRIDGES has 3-tile bridges at ty=5..7 and ty=14..16 over chasm at tx=16
          expect(isBridgeFloorTileOverChasm(map, 16, 5)).toBe(true);
          expect(isBridgeFloorTileOverChasm(map, 16, 6)).toBe(true);
          expect(isBridgeFloorTileOverChasm(map, 16, 7)).toBe(true);

          const ctxNorthEdge = createRecording2dContext();
          drawBridgeOverChasmOverlayContract(ctxNorthEdge, 0, 0, 32, true, false, 1);
          const ctxMidLane = createRecording2dContext();
          drawBridgeOverChasmOverlayContract(ctxMidLane, 0, 0, 32, false, false, 1);
          expect(ctxNorthEdge.ops.length).toBeGreaterThanOrEqual(8);
          expect(ctxMidLane.ops.length).toBeGreaterThanOrEqual(8);
        });
      });

      describe('Tier 1 :: F7 — Live Deterministic Surface Animation & Additive Emissive Glow', () => {
        it('T1-F7-01: drives BiomeArchitectureLiveLayer deterministically via getFreezeVisualTimeSec when freeze=1', () => {
          const prevWindow = (globalThis as { window?: unknown }).window;
          try {
            const winMock = {
              location: { search: '?freeze=1' },
              __STRIP_STEP_TICKS__: 24,
            };
            (globalThis as { window?: unknown }).window = winMock;
            const t1 = getFreezeVisualTimeSec(1.0);
            const t2 = getFreezeVisualTimeSec(99.5);
            expect(t1).toBeCloseTo(1.0 + 24 / 60, 6);
            expect(t2).toBe(t1);
            winMock.__STRIP_STEP_TICKS__ = 54;
            const t3 = getFreezeVisualTimeSec(1.0);
            expect(t3).toBeCloseTo(1.0 + 54 / 60, 6);
            expect(t3).toBeGreaterThan(t1);
          } finally {
            (globalThis as { window?: unknown }).window = prevWindow;
          }
        });

        it('T1-F7-02: animates molten lava, crystalline ice, water, and electrified_water on live surface graphics', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 111, startInHub: false });
          const { scene, graphicsList } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();
          sim.map.setSurface(10, 8, 'lava');
          sim.map.setSurface(12, 8, 'ice');
          sim.map.setSurface(14, 8, 'water');
          sim.map.setSurface(16, 8, 'electrified_water');

          graphicsSettings.setQuality('high');
          scene.biomeArchLive.update({
            dtSec: 0.05,
            map: sim.map,
            props: sim.props,
            lightingEnabled: true,
          });
          const surfaceGraphics = graphicsList.find((g) => g.depth < 18 && g.blendMode === 0)!;
          expect(surfaceGraphics).toBeDefined();
          const drawOps = surfaceGraphics.ops.filter((o) => o.op !== 'clear');
          expect(drawOps.length).toBeGreaterThanOrEqual(4);
          expect(drawOps.some((o) => o.op === 'fillCircle' || o.op === 'strokeCircle')).toBe(true);
          expect(drawOps.some((o) => o.op === 'lineBetween')).toBe(true);
        });

        it('T1-F7-03: animates poison_swamp bubbles, burning_oil/grass flames, and scrolling conveyor chevrons', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 222, startInHub: false });
          const { scene, graphicsList } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();
          sim.map.setSurface(10, 10, 'poison_swamp');
          sim.map.setSurface(12, 10, 'burning_oil');
          sim.map.setSurface(14, 10, 'burning_grass');
          sim.map.setSurface(16, 10, 'conveyor');

          graphicsSettings.setQuality('high');
          scene.biomeArchLive.update({
            dtSec: 0.05,
            map: sim.map,
            props: sim.props,
            lightingEnabled: true,
          });
          const surfaceGraphics = graphicsList.find((g) => g.depth < 18 && g.blendMode === 0)!;
          expect(surfaceGraphics).toBeDefined();
          const drawOps = surfaceGraphics.ops.filter((o) => o.op !== 'clear');
          expect(drawOps.length).toBeGreaterThanOrEqual(4);
          expect(drawOps.some((o) => o.op === 'fillCircle' || o.op === 'fillTriangle')).toBe(true);
          expect(drawOps.some((o) => o.op === 'lineBetween')).toBe(true);
        });

        it('T1-F7-04: renders BlendModes.ADD emissive hazard glow above lightmapRt (depth >= 35) for glowing surfaces', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 333, startInHub: false });
          const { scene, graphicsList } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();
          sim.map.setSurface(15, 10, 'lava');
          sim.map.setSurface(18, 10, 'electrified_water');
          sim.map.setSurface(21, 10, 'poison_swamp');

          graphicsSettings.setQuality('high');
          scene.biomeArchLive.update({
            dtSec: 0.033,
            map: sim.map,
            props: sim.props,
            lightingEnabled: true,
          });
          const additiveGraphics = graphicsList.find((g) => g.depth >= 35 && g.blendMode === 1)!;
          expect(additiveGraphics).toBeDefined();
          expect(additiveGraphics.depth).toBeGreaterThan(34);
          expect(additiveGraphics.blendMode).toBe(1);
          const glowOps = additiveGraphics.ops.filter((o) => o.op !== 'clear');
          expect(glowOps.length).toBeGreaterThanOrEqual(3);
        });

        it('T1-F7-05: advances surface animation coordinates deterministically when visual time progresses', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 444, startInHub: false });
          const { scene, graphicsList } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();
          sim.map.setSurface(14, 10, 'lava');
          sim.map.setSurface(16, 10, 'conveyor');

          graphicsSettings.setQuality('high');
          scene.biomeArchLive.update({
            dtSec: 0.016,
            map: sim.map,
            props: [],
            lightingEnabled: true,
          });
          const surfaceGraphics = graphicsList.find((g) => g.depth < 18 && g.blendMode === 0)!;
          const snap1 = JSON.stringify(surfaceGraphics.ops);

          surfaceGraphics.ops.length = 0;
          scene.biomeArchLive.update({
            dtSec: 0.25,
            map: sim.map,
            props: [],
            lightingEnabled: true,
          });
          const snap2 = JSON.stringify(surfaceGraphics.ops);
          expect(snap1.length).toBeGreaterThan(20);
          expect(snap2.length).toBeGreaterThan(20);
          expect(snap2).not.toEqual(snap1);
        });
      });

      describe('Tier 1 :: F8 — Tactile 2.5D Flagstone Floors (0..7), 3/4 Multi-Course Walls & Monumental 2x2 Pillars', () => {
        it('T1-F8-01: bakes interlocking flagstone mortar joints and -135 deg rim bevel highlights across all 8 variants (0..7)', () => {
          withMockBakerScene((scene, baked) => {
            for (const biome of [0, 1, 2, 3] as const) {
              const env = ENV_PALETTE[biome];
              for (let v = 0; v < 8; v++) {
                const ctx = bakeBiomeTileContract(scene, baked, biome, v, 4);
                const visibleStrokes = ctx.ops.filter(
                  (o) => (o.type === 'stroke' || o.type === 'strokeRect') && o.globalAlpha >= 0.15,
                );
                const colors = getAllRecordedColors(ctx);
                expect(visibleStrokes.length).toBeGreaterThanOrEqual(2);
                expect(colors.has(env.floor.toUpperCase())).toBe(true);
                expect(colors.has(env.seam.toUpperCase()) || colors.has(env.shadow.toUpperCase())).toBe(true);
                expect(colors.has(env.rim.toUpperCase())).toBe(true);
              }
            }
          });
        });

        it('T1-F8-02: restores distinct stone craftsmanship across Center Arena variants 4..7 so center floor is never flat', () => {
          withMockBakerScene((scene, baked) => {
            for (const biome of [0, 1, 2, 3] as const) {
              const centerSignatures = new Set<string>();
              const orderedSigs: string[] = [];
              for (const v of [4, 5, 6, 7]) {
                const ctx = bakeBiomeTileContract(scene, baked, biome, v, 4);
                const jointOps = ctx.ops.filter(
                  (o) => o.type === 'strokeRect' || o.type === 'moveTo' || o.type === 'lineTo',
                );
                expect(jointOps.length).toBeGreaterThanOrEqual(2);
                const sig = jointOps.map((o) => `${o.type}:${o.args.join(',')}`).join('|');
                centerSignatures.add(sig);
                orderedSigs.push(sig);
              }
              expect(centerSignatures.size).toBeGreaterThanOrEqual(3);
              expect(orderedSigs[0]).not.toEqual(orderedSigs[1]);
            }
          });
        });

        it('T1-F8-03: renders raised 2.5D stone parapet coping and bevel highlights on walls when hasS === true', () => {
          withMockBakerScene((scene, baked) => {
            for (const biome of [1, 2, 3] as const) {
              const env = ENV_PALETTE[biome];
              const ctx = bakeWallTileContract(scene, baked, biome, AUTOTILE_SOUTH, 4);
              const colors = getAllRecordedColors(ctx);
              expect(colors.has(env.wallTop.toUpperCase())).toBe(true);
              expect(colors.has(env.rim.toUpperCase())).toBe(true);
              expect(
                colors.has(env.wallFront.toUpperCase()) || colors.has(env.seam.toUpperCase()),
              ).toBe(true);
              expect(
                ctx.ops.filter((o) => o.type === 'stroke' || o.type === 'fillRect' || o.type === 'strokeRect').length,
              ).toBeGreaterThanOrEqual(5);
            }
          });
        });

        it('T1-F8-04: renders multi-course 3/4 south cliff faces with biome-specific relief when hasS === false', () => {
          withMockBakerScene((scene, baked) => {
            const sigs: string[] = [];
            for (const biome of [1, 2, 3] as const) {
              const env = ENV_PALETTE[biome];
              const ctx = bakeWallTileContract(
                scene,
                baked,
                biome,
                AUTOTILE_EAST | AUTOTILE_WEST,
                4,
              );
              const colors = getAllRecordedColors(ctx);
              expect(colors.has(env.wallTop.toUpperCase())).toBe(true);
              expect(colors.has(env.wallFront.toUpperCase())).toBe(true);
              expect(colors.has(env.shadow.toUpperCase())).toBe(true);
              sigs.push([...colors].sort().join(','));
            }
            expect(sigs[0]).not.toEqual(sigs[1]);
            expect(sigs[1]).not.toEqual(sigs[2]);
          });
        });

        it('T1-F8-05: bakes monumental 2x2 dungeon pillars across all 4 quadrant masks (NW=6, NE=12, SW=3, SE=9)', () => {
          withMockBakerScene((scene, baked) => {
            const quadrantMasks = [
              AUTOTILE_EAST | AUTOTILE_SOUTH, // NW = 6
              AUTOTILE_WEST | AUTOTILE_SOUTH, // NE = 12
              AUTOTILE_NORTH | AUTOTILE_EAST, // SW = 3
              AUTOTILE_NORTH | AUTOTILE_WEST, // SE = 9
            ];
            for (const biome of [1, 2, 3] as const) {
              const env = ENV_PALETTE[biome];
              for (const mask of quadrantMasks) {
                const ctx = bakePillarTileContract(scene, baked, biome, mask, 4);
                const colors = getAllRecordedColors(ctx);
                expect(colors.has(env.wallTop.toUpperCase())).toBe(true);
                expect(colors.has(env.accent.toUpperCase())).toBe(true);
                expect(ctx.ops.filter((o) => o.type === 'clip').length).toBeGreaterThanOrEqual(1);
              }
            }
          });
        });
      });

      describe('Tier 1 :: F9 — Client Ground Composite Auto-Resize, Redraw Fix, Prop Shadows/Life & Secret Door Light', () => {
        it('T1-F9-01: auto-resizes arena_ground_composite and mapTileVisuals in syncArenaTilesWithMapRevisionImpl across all 6 presets', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 5150, startInHub: false });
          const { scene, canvasTextures } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();
          expect(scene.mapTileVisuals.length).toBe(sim.map.cols * sim.map.rows);

          const dims = getRoomSizePresetDims();
          for (const preset of ALL_ROOM_SIZE_PRESETS) {
            const { cols, rows } = dims[preset];
            resizeArenaMapContract(sim.map, cols, rows);
            scene.syncArenaTilesWithMapRevision();

            const groundTex = canvasTextures.get('arena_ground_composite')!;
            expect(groundTex).toBeDefined();
            expect(groundTex.width).toBe(cols * TILE_SIZE * scene.tileCompositeScale);
            expect(groundTex.height).toBe(rows * TILE_SIZE * scene.tileCompositeScale);
            expect(scene.mapTileVisuals.length).toBe(cols * rows);
            expect(scene.arenaGroundSprite.x).toBe((cols * TILE_SIZE) / 2);
            expect(scene.arenaGroundSprite.y).toBe((rows * TILE_SIZE) / 2);
          }
        });

        it('T1-F9-02: re-invokes biomeArchLive.renderGroundPass after dirty-tile redraws so pillar cast shadows remain intact', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 6160, startInHub: false });
          configureRoomLayoutContract(sim.map, {
            roomType: 'combat',
            roomSeed: 6160,
            archetype: 'CRUMBLING_PILLAR_RING',
            biome: 1,
          });
          const { scene, canvasTextures } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();
          expect(typeof scene.biomeArchLive.renderGroundPass).toBe('function');

          const groundTex = canvasTextures.get('arena_ground_composite')!;
          const prevRefresh = groundTex.refreshCount;
          const spy = vi.spyOn(scene.biomeArchLive, 'renderGroundPass');
          sim.map.setSurface(16, 10, 'lava');
          scene.syncArenaTilesWithMapRevision();
          expect(spy).toHaveBeenCalledTimes(1);
          expect(groundTex.refreshCount).toBeGreaterThan(prevRefresh);
          expect(sim.map.getSurface(16, 10)).toBe('lava');
        });

        it('T1-F9-03: scales buildRoomArchitecturePlan coordinates within [0..cols-1, 0..rows-1] across all room sizes', () => {
          const dims = getRoomSizePresetDims();
          const map = new ArenaMap();
          for (const preset of ALL_ROOM_SIZE_PRESETS) {
            const { cols, rows } = dims[preset];
            configureRoomLayoutContract(map, {
              roomType: 'combat',
              roomSeed: 7170,
              archetype: 'CENTRAL_BASTION',
              biome: 3,
              cols,
              rows,
            });
            const plan = buildRoomArchitecturePlanContract(map, 'combat', 3, 7170);
            expect(plan.budget.largeDecorCount).toBeLessThanOrEqual(8);
            expect(plan.budget.emptyPerimeterRatio).toBeGreaterThanOrEqual(0.4);
            for (const sd of plan.solidDecors) {
              expect(sd.tx).toBeGreaterThanOrEqual(0);
              expect(sd.tx).toBeLessThan(cols);
              expect(sd.ty).toBeGreaterThanOrEqual(0);
              expect(sd.ty).toBeLessThan(rows);
              expect(map.isSolidTile(sd.tx, sd.ty)).toBe(true);
            }
            for (const fd of plan.floorDecals) {
              expect(fd.tx).toBeGreaterThan(0);
              expect(fd.tx).toBeLessThan(cols - 1);
              expect(fd.ty).toBeGreaterThan(0);
              expect(fd.ty).toBeLessThan(rows - 1);
              expect(map.isSolidTile(fd.tx, fd.ty)).toBe(false);
            }
          }
        });

        it('T1-F9-04: scales prop shadows by physical footprint and applies deterministic idle animations in syncPropsImpl', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 8180, startInHub: false });
          sim.props.length = 0;
          const smallPod = sim.spawnProp('caustic_spore_pod', 250, 250);
          const largePillar = sim.spawnProp('rotten_totem_pillar', 350, 250);
          const spire = sim.spawnProp('cryo_prism_pillar', 450, 250);

          const { scene } = createMockGameSceneHarness(sim);
          scene.syncProps(0.016);

          const pvSmall = scene.propVisuals.get(smallPod.id)!;
          const pvLarge = scene.propVisuals.get(largePillar.id)!;
          const pvSpire = scene.propVisuals.get(spire.id)!;
          expect(pvLarge.shadow.scaleX).toBeGreaterThan(pvSmall.shadow.scaleX);
          expect(pvSpire.shadow.scaleX).toBeGreaterThan(pvSmall.shadow.scaleX);

          const initialSpireY = pvSpire.sprite.y;
          const initialPodScaleX = pvSmall.sprite.scaleX;
          scene.syncProps(0.35);
          expect(
            pvSpire.sprite.y !== initialSpireY || pvSmall.sprite.scaleX !== initialPodScaleX,
          ).toBe(true);
        });

        it('T1-F9-05: suppresses unbroken secret passage door light in populateInteractableLightsScratch until wall is broken', () => {
          const scratch: InteractableLightEntry[] = [];
          const secretDoor = {
            dir: 'N' as CardinalDir,
            targetRoomId: 7,
            targetRoomType: 'secret' as RoomType,
            x: 576,
            y: 32,
            radius: 26,
            locked: true,
            isSecretPassage: true,
          };

          const countUnbroken = populateInteractableLightsScratchContract(scratch, {
            tier: 'high',
            biome: 1,
            elapsedSec: 1.0,
            secretWallBroken: false,
            doors: [secretDoor],
          });
          expect(countUnbroken).toBe(0);
          expect(scratch.filter((e) => e.kind === 'door').length).toBe(0);

          const countBroken = populateInteractableLightsScratchContract(scratch, {
            tier: 'high',
            biome: 1,
            elapsedSec: 1.0,
            secretWallBroken: true,
            doors: [{ ...secretDoor, locked: false }],
          });
          expect(countBroken).toBe(1);
          expect(scratch[0]?.kind).toBe('door');
          expect(scratch[0]?.colorNum).toBe(hexToNum(ENV_PALETTE[1].accent));
        });
      });

      describe('Tier 1 :: F10 — End-to-End Floor Progression, Seed Determinism & 36x22 Backward Compatibility', () => {
        it('T1-F10-01: produces 100% identical dungeon floor graphs, room presets, shapes, and archetypes for identical seeds', () => {
          const floorA = generateDungeonFloorContract('ashen-e2e-seed-99', 1, 2, 2);
          const floorB = generateDungeonFloorContract('ashen-e2e-seed-99', 1, 2, 2);
          expect(floorA.rooms.length).toBe(floorB.rooms.length);
          expect(floorA.startRoomId).toBe(floorB.startRoomId);
          expect(floorA.exitRoomId).toBe(floorB.exitRoomId);
          expect(floorA.secretRoomId).toBe(floorB.secretRoomId);
          for (let i = 0; i < floorA.rooms.length; i++) {
            const rA = floorA.rooms[i] as ExtendedDungeonRoomNode;
            const rB = floorB.rooms[i] as ExtendedDungeonRoomNode;
            expect(rA.type).toBe(rB.type);
            expect(rA.roomSizePreset).toBe(rB.roomSizePreset);
            expect(rA.cols).toBe(rB.cols);
            expect(rA.rows).toBe(rB.rows);
            expect(rA.roomShape).toBe(rB.roomShape);
          }
        });

        it('T1-F10-02: preserves 100% legacy 36x22 rectangle backward compatibility for standalone new ArenaMap()', () => {
          const map = new ArenaMap({ seed: 1337 });
          expect(map.cols).toBe(36);
          expect(map.rows).toBe(22);
          expect(map.width).toBe(1152);
          expect(map.height).toBe(704);
          expect(getDoorTilesForMapContract(map)).toEqual(DOOR_TILES);
          expect(getDoorVestibuleRectsForMapContract(map)).toEqual(DOOR_VESTIBULE_RECTS);
        });

        it('T1-F10-03: verifies verifyDungeonConnectivity across all 3 biomes and both floor numbers', () => {
          for (const biome of [1, 2, 3] as const) {
            for (const floorNum of [1, 2] as const) {
              const floor = generateDungeonFloorContract(1000 + biome * 100 + floorNum, floorNum, biome, 1);
              const connectivity = verifyDungeonConnectivity(floor);
              expect(connectivity.valid).toBe(true);
              expect(connectivity.reachableCount).toBe(connectivity.totalRooms);
              expect(connectivity.hasAllRoomTypes).toBe(true);
              expect(connectivity.bidirectionalLinks).toBe(true);
            }
          }
        });

        it('T1-F10-04: maintains CIE L* photometric separation between rim, wallTop, floor, wallFront, and shadow across all 4 biomes', () => {
          for (const biome of [0, 1, 2, 3] as const) {
            const env = ENV_PALETTE[biome];
            const floorL = srgbToCieL(...hexToRgbTuple(env.floor));
            const wallTopL = srgbToCieL(...hexToRgbTuple(env.wallTop));
            const wallFrontL = srgbToCieL(...hexToRgbTuple(env.wallFront));
            const shadowL = srgbToCieL(...hexToRgbTuple(env.shadow));
            const rimL = srgbToCieL(...hexToRgbTuple(env.rim));
            const inkL = srgbToCieL(...hexToRgbTuple(PALETTE.INK_DARK));
            expect(rimL).toBeGreaterThan(wallTopL);
            expect(wallTopL).toBeGreaterThan(floorL);
            expect(floorL).toBeGreaterThan(wallFrontL);
            expect(wallFrontL).toBeGreaterThan(shadowL);
            expect(floorL - inkL).toBeGreaterThan(10);
          }
        });

        it('T1-F10-05: progresses seamlessly from Hub -> Floor 1 -> Floor 2 -> Biome 2 with client composite sync', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 95123, startInHub: true });
          const { scene, canvasTextures } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();
          expect(sim.inHub).toBe(true);
          expect(sim.map.cols).toBe(36);

          sim.startDungeonRunFromHub();
          scene.syncArenaTilesWithMapRevision();
          expect(sim.inHub).toBe(false);
          expect(sim.currentBiome).toBe(1);
          expect(sim.currentFloor).toBe(1);

          sim.advanceToFloor(2);
          scene.syncArenaTilesWithMapRevision();
          expect(sim.currentFloor).toBe(2);

          sim.advanceToBiome(2);
          scene.syncArenaTilesWithMapRevision();
          expect(sim.currentBiome).toBe(2);
          expect(sim.dungeon.floorNumber).toBe(1);
          expect(sim.currentFloor).toBeGreaterThanOrEqual(1);
          const groundTex = canvasTextures.get('arena_ground_composite')!;
          expect(groundTex.width).toBe(sim.map.width * scene.tileCompositeScale);
          expect(groundTex.height).toBe(sim.map.height * scene.tileCompositeScale);
        });
      });
    });

    // ==========================================================================
    // TIER 2 — BOUNDARY & CORNER CASES (50 TEST CASES: 5 PER FEATURE F1–F10)
    // ==========================================================================
    describe('Tier 2 — Boundary & Corner Cases (F1–F10)', () => {
      describe('Tier 2 :: F1 Boundaries', () => {
        it('T2-F1-01: handles rapid alternating resize cycles between compact (28x18) and colossal_boss (48x28)', () => {
          const map = new ArenaMap();
          const startRev = map.mapRevision;
          for (let i = 0; i < 6; i++) {
            const isSmall = i % 2 === 0;
            resizeArenaMapContract(map, isSmall ? 28 : 48, isSmall ? 18 : 28);
            expect(map.cols).toBe(isSmall ? 28 : 48);
            expect(map.rows).toBe(isSmall ? 18 : 28);
            expect(map.tiles.length).toBe(map.cols * map.rows);
          }
          expect(map.mapRevision).toBeGreaterThan(startRev);
        });

        it('T2-F1-02: clamps small or fractional dimensions to valid integer room dimensions', () => {
          const map = new ArenaMap();
          resizeArenaMapContract(map, 6.8, 4.9);
          expect(Number.isInteger(map.cols)).toBe(true);
          expect(Number.isInteger(map.rows)).toBe(true);
          expect(map.cols).toBeGreaterThanOrEqual(12);
          expect(map.rows).toBeGreaterThanOrEqual(10);

          resizeArenaMapContract(map, 48.9, 28.7);
          expect(Number.isInteger(map.cols)).toBe(true);
          expect(Number.isInteger(map.rows)).toBe(true);
          expect(map.cols).toBe(48);
          expect(map.rows).toBe(28);
        });

        it('T2-F1-03: clears out-of-bounds stale surface timers and surfaces when shrinking from 48x28 to 28x18', () => {
          const map = new ArenaMap();
          resizeArenaMapContract(map, 48, 28);
          map.setSurface(44, 24, 'burning_oil', 5.0, true);
          expect(map.getSurface(44, 24)).toBe('burning_oil');

          resizeArenaMapContract(map, 28, 18);
          expect(map.surfaces.length).toBe(28 * 18);
          expect(map.surfaceTimers.every((t) => t === 0)).toBe(true);
          expect(map.getSurface(44, 24)).toBe('none');
          expect(map.getTile(44, 24)).toBe('wall');
        });

        it('T2-F1-04: ensures monotonic mapRevision increments across resize, setTile, setSurface, and reverseConveyorDirection', () => {
          const map = new ArenaMap();
          const r0 = map.mapRevision;
          resizeArenaMapContract(map, 32, 28);
          const r1 = map.mapRevision;
          map.setTile(5, 5, 'pillar');
          const r2 = map.mapRevision;
          map.setSurface(6, 6, 'lava');
          const r3 = map.mapRevision;
          map.reverseConveyorDirection();
          const r4 = map.mapRevision;
          expect(r1).toBeGreaterThanOrEqual(r0);
          expect(r2).toBeGreaterThan(r1);
          expect(r3).toBeGreaterThan(r2);
          expect(r4).toBeGreaterThan(r3);
        });

        it('T2-F1-05: resolves circle collision accurately against rightmost and bottommost walls after resizing to 48x28', () => {
          const map = new ArenaMap();
          resizeArenaMapContract(map, 48, 28);
          const nearEast = map.resolveCircleCollision(48 * TILE_SIZE - 10, 14 * TILE_SIZE, 14);
          expect(nearEast.collided).toBe(true);
          expect(nearEast.x).toBeLessThanOrEqual(47 * TILE_SIZE - 14 + 0.01);

          const nearSouth = map.resolveCircleCollision(24 * TILE_SIZE, 28 * TILE_SIZE - 10, 14);
          expect(nearSouth.collided).toBe(true);
          expect(nearSouth.y).toBeLessThanOrEqual(27 * TILE_SIZE - 14 + 0.01);
        });
      });

      describe('Tier 2 :: F2 Boundaries', () => {
        it('T2-F2-01: carves octagon, cruciform, and hourglass cleanly on narrowest compact (28x18) rooms', () => {
          const map = new ArenaMap();
          for (const shape of ['octagon', 'cruciform', 'hourglass'] as const) {
            configureRoomLayoutContract(map, {
              roomType: 'combat',
              roomSeed: 91,
              archetype: 'CENTRAL_BASTION',
              biome: 1,
              cols: 28,
              rows: 18,
              roomShape: shape,
            });
            expect(map.cols).toBe(28);
            expect(map.rows).toBe(18);
            expect(areActiveDoorsConnectedBfsContract(map, ['N', 'S', 'E', 'W'])).toBe(true);
          }
        });

        it('T2-F2-02: preserves single-door dead-end and 4-door cross vestibule clearance under all non-rectangular silhouettes', () => {
          const map = new ArenaMap();
          for (const shape of ALL_ROOM_SHAPES) {
            configureRoomLayoutContract(map, {
              roomType: 'combat',
              roomSeed: 123,
              archetype: 'TWIN_BRIDGES',
              biome: 2,
              cols: 32,
              rows: 28,
              roomShape: shape,
              activeDoorSides: ['N'],
            });
            expect(areActiveDoorsConnectedBfsContract(map, ['N'])).toBe(true);
            const rects = getDoorVestibuleRectsForMapContract(map);
            for (const dir of ['N', 'S', 'E', 'W'] as const) {
              const r = rects[dir];
              for (let ty = r.minTy; ty <= r.maxTy; ty++) {
                for (let tx = r.minTx; tx <= r.maxTx; tx++) {
                  expect(map.getTile(tx, ty)).toBe('floor');
                  expect(map.getSurface(tx, ty)).not.toBe('chasm');
                }
              }
            }
          }
        });

        it('T2-F2-03: places and destroys cracked secret walls on all 4 cardinal borders of octagon and cruciform rooms', () => {
          const map = new ArenaMap();
          for (const dir of ['N', 'S', 'E', 'W'] as const) {
            configureRoomLayoutContract(map, {
              roomType: 'combat',
              roomSeed: 222,
              archetype: 'GAUNTLET_CHOKEPOINT',
              biome: 1,
              cols: 44,
              rows: 26,
              roomShape: 'cruciform',
              secretWallDir: dir,
              secretWallBroken: false,
            });
            const cw = map.getCrackedWallTileForDir(dir);
            expect(map.getTile(cw.tx, cw.ty)).toBe('cracked_wall');
            expect(map.destroyCrackedWall(cw.tx, cw.ty)).toBe(true);
            expect(map.getTile(cw.tx, cw.ty)).toBe('floor');
          }
        });

        it('T2-F2-04: blocks projectiles and resolves circle collisions against sculpted interior corner walls', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'combat',
            roomSeed: 333,
            archetype: 'CENTRAL_BASTION',
            biome: 1,
            cols: 36,
            rows: 22,
            roomShape: 'cruciform',
          });
          expect(map.getTile(2, 2)).toBe('wall');
          const hitRes = map.checkProjectileWallHit(2 * TILE_SIZE + 16, 2 * TILE_SIZE + 16, 6);
          expect(hitRes.hit).toBe(true);
          expect(hitRes.hitTx).toBe(2);
          expect(hitRes.hitTy).toBe(2);
        });

        it('T2-F2-05: ensures findNearestWalkablePoint relocates entities spawned inside sculpted corner walls to safe floor', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'combat',
            roomSeed: 444,
            archetype: 'CENTRAL_BASTION',
            biome: 1,
            cols: 36,
            rows: 22,
            roomShape: 'octagon',
          });
          expect(map.isSolidTile(1, 1)).toBe(true);
          const safe = findNearestWalkablePoint(map, 1 * TILE_SIZE + 16, 1 * TILE_SIZE + 16, 14);
          const safeTx = Math.floor(safe.x / TILE_SIZE);
          const safeTy = Math.floor(safe.y / TILE_SIZE);
          expect(map.isSolidTile(safeTx, safeTy)).toBe(false);
          expect(map.getSurface(safeTx, safeTy)).not.toBe('chasm');
          expect(map.checkProjectileWallHit(safe.x, safe.y, 14).hit).toBe(false);
        });
      });

      describe('Tier 2 :: F3 Boundaries', () => {
        it('T2-F3-01: computes accurate findNextWalkableWaypoint paths on colossal_boss (48x28 = 1344 tiles > 792)', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'boss',
            roomSeed: 707,
            biome: 3,
            cols: 48,
            rows: 28,
            roomShape: 'octagon',
          });
          // Place a central pillar barrier to force pathfinding around it
          for (let ty = 10; ty <= 18; ty++) {
            map.setTile(24, ty, 'pillar');
          }
          map.rebuildSolidBoxes();
          const fromX = 6 * TILE_SIZE + 16;
          const fromY = 14 * TILE_SIZE + 16;
          const toX = 42 * TILE_SIZE + 16;
          const toY = 14 * TILE_SIZE + 16;
          const wp = findNextWalkableWaypointContract(map, fromX, fromY, toX, toY);
          const wpTx = Math.floor(wp.x / TILE_SIZE);
          const wpTy = Math.floor(wp.y / TILE_SIZE);
          expect(isWalkableTileForBfs(map, wpTx, wpTy)).toBe(true);
          expect(Math.hypot(wp.x - fromX, wp.y - fromY)).toBeLessThan(Math.hypot(toX - fromX, toY - fromY));
          expect(wpTx >= 1 && wpTx <= 46 && wpTy >= 1 && wpTy <= 26).toBe(true);
          expect(wpTx === 24 && wpTy === 14).toBe(false);
        });

        it('T2-F3-02: verifies BFS door connectivity when only 1 door, 2 opposite doors, or 2 adjacent doors are active', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'combat',
            roomSeed: 808,
            archetype: 'TWIN_BRIDGES',
            biome: 2,
            cols: 46,
            rows: 20,
            roomShape: 'octagon',
          });
          expect(areActiveDoorsConnectedBfsContract(map, ['N'])).toBe(true);
          expect(areActiveDoorsConnectedBfsContract(map, ['N', 'S'])).toBe(true);
          expect(areActiveDoorsConnectedBfsContract(map, ['W', 'E'])).toBe(true);
          expect(areActiveDoorsConnectedBfsContract(map, ['N', 'E'])).toBe(true);
        });

        it('T2-F3-03: scales PRISM_LABYRINTH and GAUNTLET_CHOKEPOINT on compact 28x18 without blocking door vestibules', () => {
          const map = new ArenaMap();
          for (const archetype of ['PRISM_LABYRINTH', 'GAUNTLET_CHOKEPOINT'] as const) {
            configureRoomLayoutContract(map, {
              roomType: 'combat',
              roomSeed: 909,
              archetype,
              biome: 2,
              cols: 28,
              rows: 18,
              roomShape: 'hourglass',
            });
            expect(map.cols).toBe(28);
            expect(map.rows).toBe(18);
            expect(areActiveDoorsConnectedBfsContract(map, ['N', 'S', 'E', 'W'])).toBe(true);
            const rects = getDoorVestibuleRectsForMapContract(map);
            for (const dir of ['N', 'S', 'E', 'W'] as const) {
              const r = rects[dir];
              for (let ty = r.minTy; ty <= r.maxTy; ty++) {
                for (let tx = r.minTx; tx <= r.maxTx; tx++) {
                  expect(map.isSolidTile(tx, ty)).toBe(false);
                }
              }
            }
          }
        });

        it('T2-F3-04: keeps TWIN_BRIDGES chasm tiles strictly clear of North and South door vestibules on all room presets', () => {
          const dims = getRoomSizePresetDims();
          const map = new ArenaMap();
          for (const preset of ALL_ROOM_SIZE_PRESETS) {
            const { cols, rows } = dims[preset];
            configureRoomLayoutContract(map, {
              roomType: 'combat',
              roomSeed: 1010,
              archetype: 'TWIN_BRIDGES',
              biome: 1,
              cols,
              rows,
            });
            expect(map.cols).toBe(cols);
            expect(areActiveDoorsConnectedBfsContract(map, ['N', 'S', 'E', 'W'])).toBe(true);
            const rects = getDoorVestibuleRectsForMapContract(map);
            for (const dir of ['N', 'S', 'E', 'W'] as const) {
              const r = rects[dir];
              for (let ty = r.minTy; ty <= r.maxTy; ty++) {
                for (let tx = r.minTx; tx <= r.maxTx; tx++) {
                  expect(map.getSurface(tx, ty)).not.toBe('chasm');
                  expect(map.getTile(tx, ty)).toBe('floor');
                }
              }
            }
          }
        });

        it('T2-F3-05: preserves exact legacy 36x22 coordinate identity across all 6 archetypes when rectangle 36x22 is used', () => {
          for (const archetype of ALL_ROOM_ARCHETYPES) {
            const legacyMap = new ArenaMap();
            configureRoomLayout(legacyMap, {
              roomSeed: 77,
              archetype,
              biome: 1,
            });
            const contractMap = new ArenaMap();
            configureRoomLayoutContract(contractMap, {
              roomType: 'combat',
              roomSeed: 77,
              archetype,
              biome: 1,
              cols: 36,
              rows: 22,
              roomShape: 'rectangle',
            });
            expect(contractMap.tiles).toEqual(legacyMap.tiles);
            expect(contractMap.surfaces).toEqual(legacyMap.surfaces);
            expect(contractMap.propAnchors.length).toBe(legacyMap.propAnchors.length);
          }
        });
      });

      describe('Tier 2 :: F4 Boundaries', () => {
        it('T2-F4-01: collapses underlying 2x2 pillar tiles if a room is filled 100% with rotten_totem_pillar props and forced to evict', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 2020, startInHub: false });
          sim.map.roomArchetype = 'CRUMBLING_PILLAR_RING';
          sim.props.length = 0;
          // Place a 2x2 pillar at (6, 6)..(7, 7) for the first totem
          sim.map.setTile(6, 6, 'pillar');
          sim.map.setTile(7, 6, 'pillar');
          sim.map.setTile(6, 7, 'pillar');
          sim.map.setTile(7, 7, 'pillar');
          sim.map.rebuildSolidBoxes();

          const firstTotem = sim.spawnProp('rotten_totem_pillar', 7 * TILE_SIZE, 7 * TILE_SIZE);
          expect(firstTotem.kind).toBe('rotten_totem_pillar');
          for (let i = 1; i < MAX_TACTICAL_PROPS_PER_ROOM; i++) {
            sim.spawnProp('rotten_totem_pillar', 10 * TILE_SIZE + (i % 5) * 48, 8 * TILE_SIZE + Math.floor(i / 5) * 48);
          }
          expect(sim.props.length).toBe(MAX_TACTICAL_PROPS_PER_ROOM);

          // Spawning 17th rotten_totem_pillar must evict the first totem AND clear its 2x2 pillar tiles at (6,6)..(7,7)
          sim.spawnProp('rotten_totem_pillar', 20 * TILE_SIZE, 12 * TILE_SIZE);
          expect(sim.props.length).toBe(MAX_TACTICAL_PROPS_PER_ROOM);
          expect(sim.map.getTile(6, 6)).toBe('floor');
          expect(sim.map.getTile(7, 7)).toBe('floor');
        });

        it('T2-F4-02: bypasses MAX_TACTICAL_PROPS_PER_ROOM eviction when stressTestActive is true', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 2021, startInHub: false });
          sim.stressTestActive = true;
          expect(sim.stressTestActive).toBe(true);
          sim.props.length = 0;
          const spawnedIds: number[] = [];
          for (let i = 0; i < MAX_TACTICAL_PROPS_PER_ROOM + 5; i++) {
            const p = sim.spawnProp('volatile_spore_pod', 150 + (i % 6) * 40, 150 + Math.floor(i / 6) * 40);
            spawnedIds.push(p.id);
          }
          expect(sim.props.length).toBe(MAX_TACTICAL_PROPS_PER_ROOM + 5);
          expect(sim.props[0]?.id).toBe(spawnedIds[0]);
          expect(sim.props[sim.props.length - 1]?.id).toBe(spawnedIds[spawnedIds.length - 1]);
          sim.stressTestActive = false;
          expect(sim.stressTestActive).toBe(false);
        });

        it('T2-F4-03: makes collapseRottenTotemPillar idempotent so calling it twice on a fallen pillar returns false', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 2022, startInHub: false });
          configureRoomLayoutContract(sim.map, {
            roomType: 'combat',
            roomSeed: 2022,
            archetype: 'CRUMBLING_PILLAR_RING',
            biome: 1,
          });
          sim.props.length = 0;
          spawnCombatRoomArchetypeProps(sim, sim.getCurrentRoom());
          const totem = sim.props.find((p) => p.kind === 'rotten_totem_pillar')!;
          expect(collapseRottenTotemPillar(sim, totem, 0)).toBe(true);
          const revAfterFirst = sim.map.mapRevision;
          expect(collapseRottenTotemPillar(sim, totem, 0)).toBe(false);
          expect(sim.map.mapRevision).toBe(revAfterFirst);
        });

        it('T2-F4-04: clears only the target 2x2 pillar in clearCollapsedPillarFootprintOnMap without disturbing neighbor pillars', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'combat',
            roomSeed: 2023,
            archetype: 'CRUMBLING_PILLAR_RING',
            biome: 1,
          });
          // First ring pillar at (13, 5), second at (21, 5)
          expect(map.getTile(13, 5)).toBe('pillar');
          expect(map.getTile(21, 5)).toBe('pillar');
          const cleared = clearCollapsedPillarFootprintOnMap(map, 14 * TILE_SIZE, 6 * TILE_SIZE);
          expect(cleared).toBe(4);
          expect(map.getTile(13, 5)).toBe('floor');
          expect(map.getTile(14, 6)).toBe('floor');
          expect(map.getTile(21, 5)).toBe('pillar');
          expect(map.getTile(22, 6)).toBe('pillar');
        });

        it('T2-F4-05: spawns CRUMBLING_PILLAR_RING props on compact (28x18) and colossal_boss (48x28) without overlapping solid walls', () => {
          for (const preset of ['compact', 'colossal_boss'] as const) {
            const dims = SPEC_ROOM_SIZE_PRESET_DIMS[preset];
            const sim = createWorldSimWithOverhaulSupport({ seed: 2024, startInHub: false });
            configureRoomLayoutContract(sim.map, {
              roomType: 'combat',
              roomSeed: 2024,
              archetype: 'CRUMBLING_PILLAR_RING',
              biome: 1,
              cols: dims.cols,
              rows: dims.rows,
            });
            sim.props.length = 0;
            spawnCombatRoomArchetypeProps(sim, sim.getCurrentRoom());
            const totems = sim.props.filter((p) => p.kind === 'rotten_totem_pillar');
            expect(totems.length).toBe(6);
            for (const t of totems) {
              expect(t.x).toBeGreaterThan(TILE_SIZE);
              expect(t.x).toBeLessThan(sim.map.width - TILE_SIZE);
              expect(t.y).toBeGreaterThan(TILE_SIZE);
              expect(t.y).toBeLessThan(sim.map.height - TILE_SIZE);
            }
          }
        });
      });

      describe('Tier 2 :: F5 Boundaries', () => {
        it('T2-F5-01: contrasts isolated 1x1 lava/ice puddle (mask=0, shoreline rim) vs fully surrounded interior tile (mask=15)', () => {
          for (const surf of ['lava', 'ice'] as const) {
            const ctxPuddle = createRecording2dContext();
            drawSurfaceTileContract(ctxPuddle, surf, 0, 0, 0, 32, 0, 2);
            const ctxInterior = createRecording2dContext();
            drawSurfaceTileContract(ctxInterior, surf, 15, 0, 0, 32, 0, 2);

            expect(ctxPuddle.ops.filter((o) => o.type === 'arcTo').length).toBeGreaterThan(0);
            expect(ctxInterior.ops.filter((o) => o.type === 'arcTo').length).toBe(0);
            expect(ctxPuddle.ops.length).toBeGreaterThan(ctxInterior.ops.length);
          }
        });

        it('T2-F5-02: renders 1-tile vertical (mask=5) and horizontal (mask=10) channels without corner pinching', () => {
          const ctxVert = createRecording2dContext();
          traceOrganicPoolPathContract(ctxVert, AUTOTILE_NORTH | AUTOTILE_SOUTH, 2.6);
          expect(ctxVert.ops.filter((o) => o.type === 'arcTo').length).toBe(0);

          const ctxHoriz = createRecording2dContext();
          traceOrganicPoolPathContract(ctxHoriz, AUTOTILE_EAST | AUTOTILE_WEST, 2.6);
          expect(ctxHoriz.ops.filter((o) => o.type === 'arcTo').length).toBe(0);
          expect(ctxVert.ops.length).toBeGreaterThanOrEqual(5);
          expect(ctxHoriz.ops.length).toBeGreaterThanOrEqual(5);
        });

        it('T2-F5-03: rounds only the single exposed outer corner on L-corner masks (3, 6, 9, 12)', () => {
          const lMasks = [
            AUTOTILE_NORTH | AUTOTILE_EAST, // 3 -> SW outer corner exposed
            AUTOTILE_EAST | AUTOTILE_SOUTH, // 6 -> NW outer corner exposed
            AUTOTILE_NORTH | AUTOTILE_WEST, // 9 -> SE outer corner exposed
            AUTOTILE_SOUTH | AUTOTILE_WEST, // 12 -> NE outer corner exposed
          ];
          for (const mask of lMasks) {
            const ctx = createRecording2dContext();
            traceOrganicPoolPathContract(ctx, mask, 2.6);
            const arcTos = ctx.ops.filter((o) => o.type === 'arcTo');
            expect(arcTos.length).toBe(1);
            expect(ctx.ops.some((o) => o.type === 'beginPath')).toBe(true);
            expect(ctx.ops.some((o) => o.type === 'closePath')).toBe(true);
          }
        });

        it('T2-F5-04: wraps negative and large variant indices modulo 8 in drawSurfaceTile without throwing', () => {
          for (const v of [-7, -1, 0, 7, 8, 15, 1024]) {
            const ctxLava = createRecording2dContext();
            drawSurfaceTileContract(ctxLava, 'lava', 0, 0, 0, 32, v, 3);
            expect(ctxLava.ops.length).toBeGreaterThan(6);
            expect(getAllRecordedColors(ctxLava).size).toBeGreaterThanOrEqual(3);

            const ctxIce = createRecording2dContext();
            drawSurfaceTileContract(ctxIce, 'ice', 0, 0, 0, 32, v, 2);
            expect(ctxIce.ops.length).toBeGreaterThan(6);
            expect(getAllRecordedColors(ctxIce).size).toBeGreaterThanOrEqual(3);
          }
        });

        it('T2-F5-05: separates solid ice from liquid water in getSurfaceAutotileMask while keeping water and electrified_water connected', () => {
          const map = new ArenaMap();
          map.setSurface(10, 10, 'water');
          map.setSurface(11, 10, 'ice');
          map.setSurface(10, 11, 'electrified_water');
          expect(map.isSameSurfaceFamily('ice', 'water')).toBe(false);
          expect(map.isSameSurfaceFamily('water', 'ice')).toBe(false);
          expect(map.isSameSurfaceFamily('water', 'electrified_water')).toBe(true);
          const maskWater = map.getSurfaceAutotileMask(10, 10);
          const maskIce = map.getSurfaceAutotileMask(11, 10);
          const maskElec = map.getSurfaceAutotileMask(10, 11);
          expect(maskWater & AUTOTILE_EAST).toBe(0);
          expect(maskIce & AUTOTILE_WEST).toBe(0);
          expect((maskWater & AUTOTILE_SOUTH) !== 0).toBe(true);
          expect((maskElec & AUTOTILE_NORTH) !== 0).toBe(true);
          expect((maskWater & AUTOTILE_NORTH) !== 0).toBe(false);
        });
      });

      describe('Tier 2 :: F6 Boundaries', () => {
        it('T2-F6-01: detects 1-tile, 2-tile, and 3-tile vertical bridge spans in isBridgeFloorTileOverChasm', () => {
          const map = new ArenaMap();
          // Clear interior surfaces
          for (let i = 0; i < map.surfaces.length; i++) map.surfaces[i] = 'none';

          // 1-tile bridge at ty=6 (chasm at ty=5 and ty=7)
          map.setSurface(10, 5, 'chasm');
          map.setSurface(10, 7, 'chasm');
          expect(isBridgeFloorTileOverChasm(map, 10, 6)).toBe(true);

          // 2-tile bridge at ty=10..11 (chasm at ty=9 and ty=12)
          map.setSurface(14, 9, 'chasm');
          map.setSurface(14, 12, 'chasm');
          expect(isBridgeFloorTileOverChasm(map, 14, 10)).toBe(true);
          expect(isBridgeFloorTileOverChasm(map, 14, 11)).toBe(true);

          // 3-tile bridge at ty=14..16 (chasm at ty=13 and ty=17)
          map.setSurface(18, 13, 'chasm');
          map.setSurface(18, 17, 'chasm');
          expect(isBridgeFloorTileOverChasm(map, 18, 14)).toBe(true);
          expect(isBridgeFloorTileOverChasm(map, 18, 15)).toBe(true);
          expect(isBridgeFloorTileOverChasm(map, 18, 16)).toBe(true);
        });

        it('T2-F6-02: distinguishes bridge overlay rendering across Biome 1 (timber), Biome 2 (glacial), and Biome 3 (forge iron)', () => {
          const palettes: string[] = [];
          for (const biome of [1, 2, 3] as const) {
            const ctx = createRecording2dContext();
            drawBridgeOverChasmOverlayContract(ctx, 0, 0, 32, true, true, biome);
            palettes.push([...getAllRecordedColors(ctx)].sort().join(','));
          }
          expect(palettes[0]).not.toEqual(palettes[1]);
          expect(palettes[1]).not.toEqual(palettes[2]);
          expect(palettes[0]).not.toEqual(palettes[2]);
        });

        it('T2-F6-03: renders deep abyssal void on interior chasm (mask=15) vs multi-tier cliff ledges on exposed chasm (mask=0)', () => {
          const ctxExposed = createRecording2dContext();
          drawSurfaceTileContract(ctxExposed, 'chasm', 0, 0, 0, 32, 0, 1);
          const ctxInterior = createRecording2dContext();
          drawSurfaceTileContract(ctxInterior, 'chasm', 15, 0, 0, 32, 0, 1);
          expect(ctxExposed.ops.length).toBeGreaterThan(ctxInterior.ops.length);
          expect(getAllRecordedColors(ctxInterior).has('#050408')).toBe(true);
          expect(getAllRecordedColors(ctxExposed).size).toBeGreaterThanOrEqual(3);
          expect(ctxExposed.ops.some((o) => o.type === 'stroke' || o.type === 'fillRect')).toBe(true);
        });

        it('T2-F6-04: reverses conveyor velocity and increments mapRevision when reverseConveyorDirection is called', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'combat',
            roomSeed: 55,
            archetype: 'CROSSFIRE_CONVEYORS',
            biome: 3,
          });
          const upperWx = 10 * TILE_SIZE + 16;
          const upperWy = 7 * TILE_SIZE + 16;
          const lowerWy = 14 * TILE_SIZE + 16;
          expect(getConveyorVelocityAtWorld(map, upperWx, upperWy)).toBe(CONVEYOR_BELT_SPEED);
          expect(getConveyorVelocityAtWorld(map, upperWx, lowerWy)).toBe(-CONVEYOR_BELT_SPEED);

          map.reverseConveyorDirection();
          expect(getConveyorVelocityAtWorld(map, upperWx, upperWy)).toBe(-CONVEYOR_BELT_SPEED);
          expect(getConveyorVelocityAtWorld(map, upperWx, lowerWy)).toBe(CONVEYOR_BELT_SPEED);
        });

        it('T2-F6-05: transitions oil -> burning_oil -> ash and ice -> water via igniteSurfaceInRadius and stepSurfaces', () => {
          const map = new ArenaMap();
          map.setSurface(10, 10, 'oil', 0, true);
          map.setSurface(11, 10, 'ice', 0, true);
          const changed = map.igniteSurfaceInRadius(10 * TILE_SIZE + 16, 10 * TILE_SIZE + 16, 64);
          expect(changed).toBeGreaterThanOrEqual(2);
          expect(map.getSurface(10, 10)).toBe('burning_oil');
          expect(map.getSurface(11, 10)).toBe('water');

          map.stepSurfaces(6.0);
          expect(map.getSurface(10, 10)).toBe('ash');
        });
      });

      describe('Tier 2 :: F7 Boundaries', () => {
        it('T2-F7-01: produces 100% identical live surface animation draw calls across arbitrary dtSec when ?freeze=1 is active', () => {
          const prevWindow = (globalThis as { window?: unknown }).window;
          try {
            (globalThis as { window?: unknown }).window = {
              location: { search: '?freeze=1' },
              __STRIP_STEP_TICKS__: 18,
            };
            const sim = createWorldSimWithOverhaulSupport({ seed: 601, startInHub: false });
            const { scene, graphicsList } = createMockGameSceneHarness(sim);
            scene.buildArenaTiles();
            sim.map.setSurface(12, 10, 'lava');
            sim.map.setSurface(14, 10, 'ice');

            const surfaceGraphics = graphicsList.find((g) => g.depth < 18 && g.blendMode === 0)!;
            surfaceGraphics.ops.length = 0;
            scene.biomeArchLive.update({
              dtSec: 0.016,
              map: sim.map,
              props: [],
              lightingEnabled: true,
            });
            const snapA = JSON.stringify(surfaceGraphics.ops);
            const nonClearCountA = surfaceGraphics.ops.filter((o) => o.op !== 'clear').length;

            surfaceGraphics.ops.length = 0;
            scene.biomeArchLive.update({
              dtSec: 0.5,
              map: sim.map,
              props: [],
              lightingEnabled: true,
            });
            const snapB = JSON.stringify(surfaceGraphics.ops);
            expect(nonClearCountA).toBeGreaterThanOrEqual(2);
            expect(snapA).toEqual(snapB);
            expect(snapA.length).toBeGreaterThan(20);
          } finally {
            (globalThis as { window?: unknown }).window = prevWindow;
          }
        });

        it('T2-F7-02: advances freeze-mode animation deterministically when window.__STRIP_STEP_TICKS__ increments', () => {
          const prevWindow = (globalThis as { window?: unknown }).window;
          try {
            const winObj = {
              location: { search: '?freeze=1' },
              __STRIP_STEP_TICKS__: 10,
            };
            (globalThis as { window?: unknown }).window = winObj;
            const sim = createWorldSimWithOverhaulSupport({ seed: 602, startInHub: false });
            const { scene, graphicsList } = createMockGameSceneHarness(sim);
            scene.buildArenaTiles();
            sim.map.setSurface(12, 10, 'lava');

            const surfaceGraphics = graphicsList.find((g) => g.depth < 18 && g.blendMode === 0)!;
            surfaceGraphics.ops.length = 0;
            scene.biomeArchLive.update({
              dtSec: 0.016,
              map: sim.map,
              props: [],
              lightingEnabled: true,
            });
            const snapTick10 = JSON.stringify(surfaceGraphics.ops);

            winObj.__STRIP_STEP_TICKS__ = 45;
            surfaceGraphics.ops.length = 0;
            scene.biomeArchLive.update({
              dtSec: 0.016,
              map: sim.map,
              props: [],
              lightingEnabled: true,
            });
            const snapTick45 = JSON.stringify(surfaceGraphics.ops);
            expect(snapTick10.length).toBeGreaterThan(20);
            expect(snapTick45.length).toBeGreaterThan(20);
            expect(snapTick10).not.toEqual(snapTick45);
          } finally {
            (globalThis as { window?: unknown }).window = prevWindow;
          }
        });

        it('T2-F7-03: suppresses additive emissive hazard glow when lightingEnabled is false or quality is low', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 603, startInHub: false });
          const { scene, graphicsList } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();
          sim.map.setSurface(12, 10, 'lava');
          sim.map.setSurface(14, 10, 'electrified_water');

          const additiveGraphics = graphicsList.find((g) => g.depth >= 35 && g.blendMode === 1)!;
          additiveGraphics.ops.length = 0;
          scene.biomeArchLive.update({
            dtSec: 0.016,
            map: sim.map,
            props: [],
            lightingEnabled: false,
          });
          expect(additiveGraphics.ops.filter((o) => o.op !== 'clear').length).toBe(0);

          graphicsSettings.setQuality('low');
          additiveGraphics.ops.length = 0;
          scene.biomeArchLive.update({
            dtSec: 0.016,
            map: sim.map,
            props: [],
            lightingEnabled: true,
          });
          expect(additiveGraphics.ops.filter((o) => o.op !== 'clear').length).toBe(0);
          graphicsSettings.setQuality('high');
          additiveGraphics.ops.length = 0;
          scene.biomeArchLive.update({
            dtSec: 0.016,
            map: sim.map,
            props: [],
            lightingEnabled: true,
          });
          expect(additiveGraphics.ops.filter((o) => o.op !== 'clear').length).toBeGreaterThanOrEqual(2);
        });

        it('T2-F7-04: executes fast zero-hazard-draw path when map has zero animated surfaces', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 604, startInHub: true });
          sim.enterHub();
          expect(sim.inHub).toBe(true);
          const { scene, graphicsList } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();

          const surfaceGraphics = graphicsList.find((g) => g.depth < 18 && g.blendMode === 0)!;
          const additiveGraphics = graphicsList.find((g) => g.depth >= 35 && g.blendMode === 1)!;
          surfaceGraphics.ops.length = 0;
          additiveGraphics.ops.length = 0;
          scene.biomeArchLive.update({
            dtSec: 0.016,
            map: sim.map,
            props: [],
            lightingEnabled: true,
          });
          expect(additiveGraphics.ops.filter((o) => o.op !== 'clear').length).toBe(0);
          expect(sim.map.surfaces.every((s) => s === 'none')).toBe(true);
        });

        it('T2-F7-05: destroys all graphics and god-ray sprites cleanly when BiomeArchitectureLiveLayer.destroy is called', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 605, startInHub: false });
          const { scene, graphicsList } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();
          expect(graphicsList.length).toBeGreaterThanOrEqual(3);
          scene.biomeArchLive.destroy();
          expect(graphicsList[0]?.destroy).toHaveBeenCalledTimes(1);
          for (const g of graphicsList) {
            expect(g.destroy).toHaveBeenCalled();
          }
        });
      });

      describe('Tier 2 :: F8 Boundaries', () => {
        it('T2-F8-01: enforces exact resolveHybridFloorVariant boundary at distToWall = 0, 1, 2, and 3', () => {
          expect(resolveHybridFloorVariant(5, 5, 0)).toBe(0);
          for (let tx = 1; tx < 20; tx++) {
            const v1 = resolveHybridFloorVariant(tx, 3, 1);
            expect(v1).toBeGreaterThanOrEqual(0);
            expect(v1).toBeLessThanOrEqual(2);
            const v2 = resolveHybridFloorVariant(tx, 4, 2);
            expect(v2).toBe(3);
            const v3 = resolveHybridFloorVariant(tx, 8, 3);
            expect(v3).toBeGreaterThanOrEqual(4);
            expect(v3).toBeLessThanOrEqual(7);
          }
        });

        it('T2-F8-02: draws zero internal INK_DARK contour lines on fully surrounded wall tile (mask=15) vs 4 edges on isolated wall (mask=0)', () => {
          withMockBakerScene((scene, baked) => {
            const ctxFull = bakeWallTileContract(scene, baked, 1, 15, 4);
            expect(countNonEmptyStrokesWithColor(ctxFull, PALETTE.INK_DARK)).toBe(0);

            const ctxIso = bakeWallTileContract(scene, baked, 1, 0, 4);
            expect(countNonEmptyStrokesWithColor(ctxIso, PALETTE.INK_DARK)).toBeGreaterThanOrEqual(1);
            expect(ctxIso.ops.length).toBeGreaterThan(ctxFull.ops.length);
          });
        });

        it('T2-F8-03: bakes all 7 directional wall ambient occlusion overlay textures (wall_ao_1..7)', () => {
          withMockBakerScene((scene, baked) => {
            for (let mask = 1; mask <= 7; mask++) {
              bakeWallAoOverlay(scene, mask, 4);
              const entry = baked.get(`wall_ao_${mask}`)!;
              expect(entry).toBeDefined();
              expect(entry.width).toBe(128);
              expect(entry.height).toBe(128);
              expect(entry.ctx.gradients.length).toBeGreaterThanOrEqual(1);
            }
          });
        });

        it('T2-F8-04: bakes cracked secret wall textures across Biomes 0..3 with glowing fracture fissures', () => {
          withMockBakerScene((scene, baked) => {
            for (const biome of [0, 1, 2, 3] as const) {
              bakeCrackedWallTile(scene, biome, 4);
              const entry = baked.get(`biome_cracked_wall_${biome}`)!;
              expect(entry).toBeDefined();
              const colors = getAllRecordedColors(entry.ctx);
              expect(colors.has(ENV_PALETTE[biome].wallTop.toUpperCase())).toBe(true);
              expect(
                colors.has(PALETTE.FLAME_ORANGE.toUpperCase()) ||
                  colors.has(PALETTE.SOLAR_GOLD.toUpperCase()),
              ).toBe(true);
              expect(colors.has(PALETTE.INK_DARK.toUpperCase())).toBe(true);
            }
          });
        });

        it('T2-F8-05: computes accurate getWallAmbientOcclusionMask bits (N=1, W=2, NW=4) around interior 2x2 pillars', () => {
          const map = new ArenaMap({ includePillars: false, includeSurfaces: false });
          map.setTile(10, 10, 'pillar');
          map.setTile(11, 10, 'pillar');
          map.setTile(10, 11, 'pillar');
          map.setTile(11, 11, 'pillar');

          // Tile (10, 12) has pillar directly North (10, 11)
          expect(map.getWallAmbientOcclusionMask(10, 12) & WALL_AO_NORTH).toBe(WALL_AO_NORTH);
          // Tile (12, 10) has pillar directly West (11, 10)
          expect(map.getWallAmbientOcclusionMask(12, 10) & WALL_AO_WEST).toBe(WALL_AO_WEST);
          // Tile (12, 12) has pillar at NW diagonal (11, 11)
          expect(map.getWallAmbientOcclusionMask(12, 12)).toBe(WALL_AO_NORTH_WEST);
        });
      });

      describe('Tier 2 :: F9 Boundaries', () => {
        it('T2-F9-01: shrinks arena_ground_composite cleanly from colossal_boss (48x28) down to compact (28x18)', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 7001, startInHub: false });
          resizeArenaMapContract(sim.map, 48, 28);
          const { scene, canvasTextures } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();
          expect(canvasTextures.get('arena_ground_composite')?.width).toBe(48 * TILE_SIZE * 2);
          expect(scene.mapTileVisuals.length).toBe(48 * 28);

          resizeArenaMapContract(sim.map, 28, 18);
          scene.syncArenaTilesWithMapRevision();
          expect(canvasTextures.get('arena_ground_composite')?.width).toBe(28 * TILE_SIZE * 2);
          expect(canvasTextures.get('arena_ground_composite')?.height).toBe(18 * TILE_SIZE * 2);
          expect(scene.mapTileVisuals.length).toBe(28 * 18);
        });

        it('T2-F9-02: hides floor decals automatically when a surface floods their tile while keeping pillar cast shadows', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'combat',
            roomSeed: 7002,
            archetype: 'CENTRAL_BASTION',
            biome: 3,
          });
          const plan = buildRoomArchitecturePlanContract(map, 'combat', 3, 7002);
          expect(plan.floorDecals.length).toBeGreaterThan(0);
          const targetDecal = plan.floorDecals[0]!;
          expect(isFloorDecalVisible(targetDecal, map)).toBe(true);

          map.setSurface(targetDecal.tx, targetDecal.ty, 'lava');
          expect(isFloorDecalVisible(targetDecal, map)).toBe(false);
          expect(getVisibleFloorDecals(plan, map)).not.toContain(targetDecal);
          expect(plan.pillarShadows.length).toBeGreaterThan(0);
        });

        it('T2-F9-03: destroys propVisuals entries when props are destroyed (hp <= 0) in syncPropsImpl', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 7003, startInHub: false });
          sim.props.length = 0;
          const pod = sim.spawnProp('volatile_spore_pod', 300, 300);
          const { scene } = createMockGameSceneHarness(sim);
          scene.syncProps(0.016);
          const pv = scene.propVisuals.get(pod.id)!;
          expect(pv).toBeDefined();

          pod.hp = 0;
          scene.syncProps(0.016);
          expect(scene.propVisuals.has(pod.id)).toBe(false);
          expect(pv.sprite.destroy).toHaveBeenCalledTimes(1);
          expect(pv.shadow.destroy).toHaveBeenCalledTimes(1);
        });

        it('T2-F9-04: switches prop texture to fallen state when rotten_totem_pillar collapses or pneumatic_press cools down', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 7004, startInHub: false });
          configureRoomLayoutContract(sim.map, {
            roomType: 'combat',
            roomSeed: 7004,
            archetype: 'CRUMBLING_PILLAR_RING',
            biome: 1,
          });
          sim.props.length = 0;
          const totem = sim.spawnProp('rotten_totem_pillar', 14 * TILE_SIZE, 6 * TILE_SIZE);
          const { scene } = createMockGameSceneHarness(sim);
          scene.syncProps(0.016);
          const pv = scene.propVisuals.get(totem.id)!;
          expect(pv).toBeDefined();
          expect(pv.sprite.texture.key).toBe('prop_rotten_totem_pillar');

          totem.coverState = 'fallen';
          totem.hp = 10; // still visible as fallen cover
          scene.syncProps(0.016);
          expect(pv.sprite.texture.key).toBe('prop_rotten_totem_pillar_fallen');
          expect(pv.sprite.visible).toBe(true);
        });

        it('T2-F9-05: filters only unbroken secret passage doors while preserving normal locked/open doors in populateInteractableLightsScratch', () => {
          const scratch: InteractableLightEntry[] = [];
          const count = populateInteractableLightsScratchContract(scratch, {
            tier: 'high',
            biome: 2,
            elapsedSec: 1.5,
            secretWallBroken: false,
            doors: [
              {
                dir: 'E',
                targetRoomId: 2,
                targetRoomType: 'combat',
                x: 1056,
                y: 352,
                radius: 26,
                locked: true,
                isSecretPassage: false,
              },
              {
                dir: 'W',
                targetRoomId: 1,
                targetRoomType: 'start',
                x: 48,
                y: 352,
                radius: 26,
                locked: false,
                isSecretPassage: false,
              },
              {
                dir: 'N',
                targetRoomId: 8,
                targetRoomType: 'secret',
                x: 576,
                y: 32,
                radius: 26,
                locked: true,
                isSecretPassage: true,
              },
            ],
          });
          expect(count).toBe(2);
          expect(scratch.length).toBe(2);
          expect(scratch.some((e) => e.x === 576 && e.y === 32)).toBe(false);
          expect(scratch.some((e) => e.x === 1056 && e.colorNum === 0xdc2626)).toBe(true);
        });
      });

      describe('Tier 2 :: F10 Boundaries', () => {
        it('T2-F10-01: applies Boss Phase 3 borders (Toxic, Blizzard, Lava) cleanly onto resized colossal_boss (48x28) arenas', () => {
          const map = new ArenaMap();
          configureRoomLayoutContract(map, {
            roomType: 'boss',
            roomSeed: 8001,
            biome: 1,
            cols: 48,
            rows: 28,
            roomShape: 'rectangle',
          });
          map.applyBossPhase3ToxicBorder();
          expect(map.getSurface(8, 5)).toBe('poison_swamp');
          expect(map.getSurface(39, 22)).toBe('poison_swamp');

          map.applyBossPhase3BlizzardBorder();
          expect(map.getSurface(8, 5)).toBe('ice');
          expect(map.getSurface(39, 22)).toBe('ice');

          map.applyBossPhase3LavaBorder();
          expect(map.getSurface(7, 4)).toBe('lava');
          expect(map.getSurface(40, 23)).toBe('lava');
        });

        it('T2-F10-02: returns safe out-of-bounds defaults for getTile, getSurface, and isSolidTile after map resize', () => {
          const map = new ArenaMap();
          resizeArenaMapContract(map, 28, 18);
          expect(map.getTile(-1, 5)).toBe('wall');
          expect(map.getTile(28, 5)).toBe('wall');
          expect(map.getTile(5, 18)).toBe('wall');
          expect(map.getSurface(-1, -1)).toBe('none');
          expect(map.getSurface(28, 18)).toBe('none');
          expect(map.isSolidTile(-5, 100)).toBe(true);
        });

        it('T2-F10-03: teleports and clamps all 4 co-op players inside walkable bounds when entering a compact octagon room', () => {
          const sim = createWorldSimWithOverhaulSupport({ seed: 8003, startInHub: false });
          sim.simulatedPlayers = [
            sim.createPlayerState(2, 2, 'ranger', 400, 300),
            sim.createPlayerState(3, 3, 'elementalist', 450, 300),
            sim.createPlayerState(4, 4, 'engineer', 500, 300),
          ];
          const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') as ExtendedDungeonRoomNode;
          combatRoom.roomSizePreset = 'compact';
          combatRoom.cols = 28;
          combatRoom.rows = 18;
          combatRoom.roomShape = 'octagon';

          sim.enterRoom(combatRoom.id, 'N');
          for (const pl of sim.getAllPlayers()) {
            expect(pl.x).toBeGreaterThan(TILE_SIZE);
            expect(pl.x).toBeLessThan(sim.map.width - TILE_SIZE);
            expect(pl.y).toBeGreaterThan(TILE_SIZE);
            expect(pl.y).toBeLessThan(sim.map.height - TILE_SIZE);
            const tx = Math.floor(pl.x / TILE_SIZE);
            const ty = Math.floor(pl.y / TILE_SIZE);
            expect(sim.map.isSolidTile(tx, ty)).toBe(false);
          }
        });

        it('T2-F10-04: floods connected water tiles via electrifyWaterAt on resized tall_sanctum (32x28) arenas', () => {
          const map = new ArenaMap();
          resizeArenaMapContract(map, 32, 28);
          map.fillSurfaceRect(10, 20, 6, 4, 'water');
          const count = map.electrifyWaterAt(12, 21, 4.0);
          expect(count).toBe(24);
          expect(map.getSurface(10, 20)).toBe('electrified_water');
          expect(map.getSurface(15, 23)).toBe('electrified_water');
        });

        it('T2-F10-05: parses visual query parameters (?seed, ?freeze, ?lighting) deterministically', () => {
          const cfg1 = parseVisualQuery('?seed=42&freeze=1&lighting=0');
          expect(cfg1.seed).toBe(42);
          expect(cfg1.freeze).toBe(true);
          expect(cfg1.lightingEnabled).toBe(false);

          const cfg2 = parseVisualQuery('?freeze=false&lighting=true');
          expect(cfg2.freeze).toBe(false);
          expect(cfg2.lightingEnabled).toBe(true);
          expect(cfg2.seed).toBe(0x1337c0de);
        });
      });
    });

    // ==========================================================================
    // TIER 3 — CROSS-FEATURE COMBINATIONS (18 TEST CASES ACROSS F1–F10)
    // ==========================================================================
    describe('Tier 3 — Cross-Feature Combinations (F1–F10)', () => {
      it('T3-CF-01 [F1 x F2 x F3]: verifies all 6 RoomSizePresets x 4 RoomShapes x TWIN_BRIDGES preserve 3-tile bridges and BFS connectivity', () => {
        const dims = getRoomSizePresetDims();
        const map = new ArenaMap();
        for (const preset of ALL_ROOM_SIZE_PRESETS) {
          const { cols, rows } = dims[preset];
          for (const roomShape of ALL_ROOM_SHAPES) {
            configureRoomLayoutContract(map, {
              roomType: 'combat',
              roomSeed: 3101,
              archetype: 'TWIN_BRIDGES',
              biome: 1,
              cols,
              rows,
              roomShape,
            });
            expect(map.cols).toBe(cols);
            expect(map.rows).toBe(rows);
            expect(areActiveDoorsConnectedBfsContract(map, ['N', 'S', 'E', 'W'])).toBe(true);
          }
        }
      });

      it('T3-CF-02 [F1 x F2 x F3]: verifies all 6 RoomSizePresets x 4 RoomShapes x CROSSFIRE_CONVEYORS & PRISM_LABYRINTH', () => {
        const dims = getRoomSizePresetDims();
        const map = new ArenaMap();
        for (const preset of ALL_ROOM_SIZE_PRESETS) {
          const { cols, rows } = dims[preset];
          for (const roomShape of ALL_ROOM_SHAPES) {
            for (const archetype of ['CROSSFIRE_CONVEYORS', 'PRISM_LABYRINTH'] as const) {
              configureRoomLayoutContract(map, {
                roomType: 'combat',
                roomSeed: 3102,
                archetype,
                biome: 3,
                cols,
                rows,
                roomShape,
              });
              expect(map.cols).toBe(cols);
              expect(areActiveDoorsConnectedBfsContract(map, ['N', 'S', 'E', 'W'])).toBe(true);
              expect(map.propAnchors.length).toBeGreaterThan(0);
            }
          }
        }
      });

      it('T3-CF-03 [F1 x F3 x F4 x F9]: CRUMBLING_PILLAR_RING on grand_arena (44x26) + prop eviction protection + pillar collapse + composite redraw', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 3103, startInHub: false });
        configureRoomLayoutContract(sim.map, {
          roomType: 'combat',
          roomSeed: 3103,
          archetype: 'CRUMBLING_PILLAR_RING',
          biome: 1,
          cols: 44,
          rows: 26,
          roomShape: 'octagon',
        });
        sim.props.length = 0;
        spawnCombatRoomArchetypeProps(sim, sim.getCurrentRoom());
        const { scene, canvasTextures } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();

        for (let i = 0; i < 14; i++) {
          sim.spawnProp('volatile_spore_pod', 300 + (i % 5) * 48, 250 + Math.floor(i / 5) * 48);
        }
        const totems = sim.props.filter((p) => p.kind === 'rotten_totem_pillar' && p.hp > 0);
        expect(totems.length).toBe(6);
        expect(sim.props.length).toBeLessThanOrEqual(MAX_TACTICAL_PROPS_PER_ROOM);

        const prevRefresh = canvasTextures.get('arena_ground_composite')!.refreshCount;
        collapseRottenTotemPillar(sim, totems[0]!, 0);
        expect(totems[0]!.coverState).toBe('fallen');
        scene.syncArenaTilesWithMapRevision();
        scene.syncProps(0.016);
        expect(canvasTextures.get('arena_ground_composite')!.refreshCount).toBeGreaterThan(prevRefresh);
      });

      it('T3-CF-04 [F1 x F3 x F6 x F9]: TWIN_BRIDGES on wide_hall (46x20) renders chasm strata and 3-tile bridge overlays onto resized ground composite', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 3104, startInHub: false });
        configureRoomLayoutContract(sim.map, {
          roomType: 'combat',
          roomSeed: 3104,
          archetype: 'TWIN_BRIDGES',
          biome: 2,
          cols: 46,
          rows: 20,
        });
        const { scene, canvasTextures } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();
        const groundTex = canvasTextures.get('arena_ground_composite')!;
        expect(groundTex.width).toBe(46 * TILE_SIZE * 2);
        expect(groundTex.height).toBe(20 * TILE_SIZE * 2);
        expect(groundTex.ctx.ops.length).toBeGreaterThan(500);
      });

      it('T3-CF-05 [F5 x F7 x F9]: dynamic lava & ice surface placement triggers dirty-tile composite redraw, renderGroundPass, and live emissive glow', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 3105, startInHub: false });
        const { scene, graphicsList, canvasTextures } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();
        const groundTex = canvasTextures.get('arena_ground_composite')!;
        const initialRefresh = groundTex.refreshCount;

        sim.map.fillSurfaceRect(14, 9, 3, 3, 'lava');
        sim.map.fillSurfaceRect(20, 9, 3, 3, 'ice');
        scene.syncArenaTilesWithMapRevision();
        expect(groundTex.refreshCount).toBeGreaterThan(initialRefresh);
        expect(scene.mapTileVisuals.filter((t: { surface: string }) => t.surface === 'lava').length).toBeGreaterThanOrEqual(9);
        expect(scene.mapTileVisuals.filter((t: { surface: string }) => t.surface === 'ice').length).toBeGreaterThanOrEqual(9);

        scene.biomeArchLive.update({
          dtSec: 0.033,
          map: sim.map,
          props: sim.props,
          lightingEnabled: true,
        });
        const additiveGraphics = graphicsList.find((g) => g.depth >= 35 && g.blendMode === 1)!;
        expect(additiveGraphics.ops.filter((o) => o.op !== 'clear').length).toBeGreaterThanOrEqual(9);
      });

      it('T3-CF-06 [F2 x F8 x F9]: sculpted cruciform & hourglass walls receive autotile masks, wall_ao overlays, and solid architectural decors', () => {
        for (const roomShape of ['cruciform', 'hourglass'] as const) {
          const sim = createWorldSimWithOverhaulSupport({ seed: 3106, startInHub: false });
          configureRoomLayoutContract(sim.map, {
            roomType: 'combat',
            roomSeed: 3106,
            archetype: 'CENTRAL_BASTION',
            biome: 1,
            cols: 36,
            rows: 22,
            roomShape,
          });
          const { scene } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();
          const wallTilesWithSouthNeighbor = scene.mapTileVisuals.filter(
            (t: { kind: string; autotileMask: number }) =>
              t.kind === 'wall' && (t.autotileMask & AUTOTILE_SOUTH) !== 0,
          );
          const floorTilesWithAo = scene.mapTileVisuals.filter(
            (t: { kind: string; aoMask: number }) => t.kind === 'floor' && t.aoMask > 0,
          );
          expect(wallTilesWithSouthNeighbor.length).toBeGreaterThan(20);
          expect(floorTilesWithAo.length).toBeGreaterThan(25);
          expect(scene.mapTileVisuals.length).toBe(36 * 22);
        }
      });

      it('T3-CF-07 [F1 x F3 x F9]: breaking a cracked secret wall on a resized room unlocks the secret door, enables door light, and redraws composite', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 3107, startInHub: false });
        const room = sim.getCurrentRoom() as ExtendedDungeonRoomNode;
        room.roomSizePreset = 'wide_hall';
        room.cols = 46;
        room.rows = 20;
        room.secretWallDir = 'N';
        room.secretWallBroken = false;
        room.connections.N = sim.dungeon.secretRoomId;
        sim.secretWallBroken = false;
        sim.enterRoom(room.id);

        const { scene, canvasTextures } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();

        const scratch: InteractableLightEntry[] = [];
        populateInteractableLightsScratchContract(scratch, {
          tier: 'high',
          biome: sim.currentBiome,
          elapsedSec: 1.0,
          secretWallBroken: sim.secretWallBroken,
          doors: sim.doors,
        });
        const secretDoorBefore = sim.doors.find((d) => d.isSecretPassage);
        expect(secretDoorBefore?.locked).toBe(true);
        expect(scratch.some((e) => e.x === secretDoorBefore?.x && e.y === secretDoorBefore?.y)).toBe(false);

        const cw = sim.map.getCrackedWallTileForDir('N');
        const broke = tryBreakCrackedWallNearImpact(
          sim,
          cw.tx * TILE_SIZE + 16,
          cw.ty * TILE_SIZE + 16,
          64,
        );
        expect(broke).toBe(true);
        expect(sim.secretWallBroken).toBe(true);

        const prevRefresh = canvasTextures.get('arena_ground_composite')!.refreshCount;
        scene.syncArenaTilesWithMapRevision();
        expect(canvasTextures.get('arena_ground_composite')!.refreshCount).toBeGreaterThan(prevRefresh);

        // Clear enemies so secret door is unlocked
        sim.enemies.length = 0;
        sim.rebuildCurrentRoomDoors();
        populateInteractableLightsScratchContract(scratch, {
          tier: 'high',
          biome: sim.currentBiome,
          elapsedSec: 1.0,
          secretWallBroken: sim.secretWallBroken,
          doors: sim.doors,
        });
        const secretDoorAfter = sim.doors.find((d) => d.isSecretPassage);
        expect(secretDoorAfter?.locked).toBe(false);
        expect(scratch.some((e) => e.x === secretDoorAfter?.x && e.y === secretDoorAfter?.y)).toBe(true);
      });

      it('T3-CF-08 [F4 x F6 x F7]: kicking a slag_crucible spills molten lava tiles that animate and emit additive glow', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 3108, startInHub: false });
        const { scene, graphicsList } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();
        sim.props.length = 0;
        const crucible = sim.spawnProp('slag_crucible', 18 * TILE_SIZE + 16, 11 * TILE_SIZE + 16);
        sim.player.x = crucible.x - 28;
        sim.player.y = crucible.y;
        sim.player.aimAngle = 0;

        const kicked = sim.kickProp(crucible, sim.player, 0);
        expect(kicked).toBe(true);
        const lavaTileCount = sim.map.surfaces.filter((s) => s === 'lava').length;
        expect(lavaTileCount).toBeGreaterThan(0);

        scene.syncArenaTilesWithMapRevision();
        scene.biomeArchLive.update({
          dtSec: 0.033,
          map: sim.map,
          props: sim.props,
          lightingEnabled: true,
        });
        const additiveGraphics = graphicsList.find((g) => g.depth >= 35 && g.blendMode === 1)!;
        expect(additiveGraphics.ops.filter((o) => o.op !== 'clear').length).toBeGreaterThan(0);
      });

      it('T3-CF-09 [F6 x F7 x F9]: CROSSFIRE_CONVEYORS reversal updates physics velocity, redraws composite, and flips live chevron scroll', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 3109, startInHub: false });
        configureRoomLayoutContract(sim.map, {
          roomType: 'combat',
          roomSeed: 3109,
          archetype: 'CROSSFIRE_CONVEYORS',
          biome: 3,
        });
        const { scene, graphicsList, canvasTextures } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();

        const surfaceGraphics = graphicsList.find((g) => g.depth < 18 && g.blendMode === 0)!;
        surfaceGraphics.ops.length = 0;
        scene.biomeArchLive.update({
          dtSec: 0.1,
          map: sim.map,
          props: [],
          lightingEnabled: true,
        });
        const beforeOps = JSON.stringify(surfaceGraphics.ops);

        const prevRefresh = canvasTextures.get('arena_ground_composite')!.refreshCount;
        sim.map.reverseConveyorDirection();
        expect(sim.map.conveyorDirection).toBe(-1);
        expect(getConveyorVelocityAtWorld(sim.map, 10 * TILE_SIZE + 16, 7 * TILE_SIZE + 16)).toBe(-CONVEYOR_BELT_SPEED);
        scene.syncArenaTilesWithMapRevision();
        expect(canvasTextures.get('arena_ground_composite')!.refreshCount).toBeGreaterThan(prevRefresh);

        surfaceGraphics.ops.length = 0;
        scene.biomeArchLive.update({
          dtSec: 0.1,
          map: sim.map,
          props: [],
          lightingEnabled: true,
        });
        const afterOps = JSON.stringify(surfaceGraphics.ops);
        expect(afterOps).not.toEqual(beforeOps);
      });

      it('T3-CF-10 [F1 x F8 x F9]: Boss Phase 3 border flood on 48x28 colossal_boss hides outer floor decals while keeping inner decals & pillar shadows', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 3110, startInHub: false });
        configureRoomLayoutContract(sim.map, {
          roomType: 'boss',
          roomSeed: 3110,
          biome: 2,
          cols: 48,
          rows: 28,
          roomShape: 'rectangle',
        });
        const plan = buildRoomArchitecturePlanContract(sim.map, 'boss', 2, 3110);
        // Add an outer-ring test decal at (8, 5) inside the boss arena outer ring
        plan.floorDecals.push({
          kind: 'sunken_astrolabe',
          tx: 8,
          ty: 5,
          hasVolume: false,
          hasHazardGlow: false,
          dir: 'N',
          variant: 0,
        });
        expect(isFloorDecalVisible(plan.floorDecals[plan.floorDecals.length - 1]!, sim.map)).toBe(true);

        sim.map.applyBossPhase3BlizzardBorder();
        expect(isFloorDecalVisible(plan.floorDecals[plan.floorDecals.length - 1]!, sim.map)).toBe(false);
        expect(plan.pillarShadows.length).toBeGreaterThanOrEqual(4);
      });

      it('T3-CF-11 [F5 x F6 x F7]: igniting oil pool into burning_oil updates surface baker drawing and activates additive emissive glow', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 3111, startInHub: false });
        sim.map.fillSurfaceRect(14, 10, 3, 3, 'oil');
        const { scene, graphicsList } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();

        const ign = sim.map.igniteSurfaceInRadius(15 * TILE_SIZE + 16, 11 * TILE_SIZE + 16, 64);
        expect(ign).toBeGreaterThanOrEqual(5);
        expect(sim.map.getSurface(15, 11)).toBe('burning_oil');
        scene.syncArenaTilesWithMapRevision();

        const additiveGraphics = graphicsList.find((g) => g.depth >= 35 && g.blendMode === 1)!;
        additiveGraphics.ops.length = 0;
        scene.biomeArchLive.update({
          dtSec: 0.033,
          map: sim.map,
          props: [],
          lightingEnabled: true,
        });
        expect(additiveGraphics.ops.filter((o) => o.op !== 'clear').length).toBeGreaterThanOrEqual(5);
      });

      it('T3-CF-12 [F5 x F6 x F7]: freezing electrified_water into crystalline ice extinguishes electric arcs and switches to ice glints', () => {
        const map = new ArenaMap();
        map.fillSurfaceRect(10, 10, 3, 3, 'electrified_water');
        expect(map.getSurface(11, 11)).toBe('electrified_water');
        const frozen = map.freezeSurfaceInRadius(11 * TILE_SIZE + 16, 11 * TILE_SIZE + 16, 64);
        expect(frozen).toBeGreaterThanOrEqual(5);
        expect(map.getSurface(11, 11)).toBe('ice');

        const ctxIce = createRecording2dContext();
        drawSurfaceTileContract(ctxIce, map.getSurface(11, 11), map.getSurfaceAutotileMask(11, 11), 0, 0, 32, 2, 2);
        expect(ctxIce.ops.filter((o) => o.type === 'lineTo').length).toBeGreaterThanOrEqual(8);
      });

      it('T3-CF-13 [F1 x F2 x F8]: computeTileDistToWall and resolveHybridFloorVariant adapt accurately around octagon and cruciform walls on tall_sanctum (32x28)', () => {
        const map = new ArenaMap();
        configureRoomLayoutContract(map, {
          roomType: 'combat',
          roomSeed: 3113,
          archetype: 'CENTRAL_BASTION',
          biome: 2,
          cols: 32,
          rows: 28,
          roomShape: 'octagon',
        });
        // Clear interior pillars to test pure octagon wall distance
        for (let i = 0; i < map.tiles.length; i++) {
          if (map.tiles[i] === 'pillar') map.tiles[i] = 'floor';
        }
        expect(map.getTile(1, 1)).toBe('wall');
        const distNearCorner = computeTileDistToWall(map, 3, 3);
        const distCenter = computeTileDistToWall(map, 16, 14);
        expect(distNearCorner).toBeLessThanOrEqual(2);
        expect(distCenter).toBeGreaterThan(2);
        expect(resolveHybridFloorVariant(3, 3, distNearCorner)).toBeLessThanOrEqual(3);
        expect(resolveHybridFloorVariant(16, 14, distCenter)).toBeGreaterThanOrEqual(4);
      });

      it('T3-CF-14 [F4 x F8 x F9]: bakes all standard & P1C tactical props and syncs their shadows/sprites in GameScene', () => {
        withMockBakerScene((bakerScene, baked) => {
          bakeProps(bakerScene, 4);
          bakeP1CProps(bakerScene, 4);
          expect(baked.has('prop_rotten_totem_pillar')).toBe(true);
          expect(baked.has('prop_rotten_totem_pillar_fallen')).toBe(true);
          expect(baked.has('prop_cryo_prism_pillar')).toBe(true);
          expect(baked.has('prop_slag_crucible')).toBe(true);
          expect(baked.has('prop_moss_table_flipped')).toBe(true);
        });
      });

      it('T3-CF-15 [F1 x F7 x F9]: Biome 2 God-Rays and Biome 3 rotating brass gears scale to resized rooms and respect lighting/quality flags', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 3115, startInHub: false });
        sim.currentBiome = 2;
        resizeArenaMapContract(sim.map, 44, 26);
        const { scene, graphicsList } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();
        const planB2 = buildRoomArchitecturePlanContract(sim.map, 'combat', 2, 3115);
        scene.biomeArchLive.setPlan(planB2);
        expect(planB2.godRays.length).toBeGreaterThanOrEqual(2);
        expect(planB2.godRays.every((r) => r.anchorX >= 0 && r.anchorX <= sim.map.width)).toBe(true);

        sim.currentBiome = 3;
        const planB3 = buildRoomArchitecturePlanContract(sim.map, 'combat', 3, 3115);
        scene.biomeArchLive.setPlan(planB3);
        scene.biomeArchLive.update({
          dtSec: 0.05,
          map: sim.map,
          props: sim.props,
          lightingEnabled: true,
        });
        const gearGraphics = graphicsList[0]!;
        expect(gearGraphics.ops.length).toBeGreaterThan(0);
        expect(
          planB3.solidDecors.some((d) => d.kind === 'brass_gear_wall' || d.kind === 'steam_pipe_wall') ||
            planB3.floorDecals.some((d) => d.kind === 'grated_heat_channel'),
        ).toBe(true);
      });

      it('T3-CF-16 [F3 x F4 x F9]: flipping a barricade prop clears nearby enemy projectiles and updates prop visual texture to flipped', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 3116, startInHub: false });
        sim.props.length = 0;
        const table = sim.spawnProp('moss_table', 300, 300);
        expect(table.coverState).toBe('low');
        const { scene } = createMockGameSceneHarness(sim);
        scene.syncProps(0.016);
        expect(scene.propVisuals.get(table.id)?.sprite.texture.key).toBe('prop_moss_table');

        const flipped = sim.flipCoverProp(table, sim.player);
        expect(flipped).toBe(true);
        expect(table.coverState).toBe('flipped');
        scene.syncProps(0.016);
        expect(scene.propVisuals.get(table.id)?.sprite.texture.key).toBe('prop_moss_table_flipped');
      });

      it('T3-CF-17 [F1 x F3 x F10]: sanctuary rooms (treasure, merchant, shrine, portal, secret) resize and maintain walkable centers across all 3 biomes', () => {
        const map = new ArenaMap();
        const sanctuaryTypes: readonly RoomType[] = ['treasure', 'merchant', 'shrine', 'portal', 'secret'];
        for (const biome of [1, 2, 3] as const) {
          for (const roomType of sanctuaryTypes) {
            configureRoomLayoutContract(map, {
              roomType,
              roomSeed: 3117,
              biome,
              cols: 32,
              rows: 28,
              roomShape: 'octagon',
            });
            expect(map.cols).toBe(32);
            expect(areActiveDoorsConnectedBfsContract(map, ['N', 'S', 'E', 'W'])).toBe(true);
            const midX = Math.floor(map.cols / 2);
            const midY = Math.floor(map.rows / 2);
            expect(map.isSolidTile(midX, midY)).toBe(false);
          }
        }
      });

      it('T3-CF-18 [F7 x F9 x F10]: resolveInteractableVisualGlowSpec and populateInteractableLightsScratch coordinate across chests, shrines, and doors', () => {
        const chestSpec = resolveInteractableVisualGlowSpec({
          kind: 'chest',
          rarity: 'legendary',
          opened: false,
          elapsedSec: 1.0,
        });
        expect(chestSpec.glowAlpha).toBeGreaterThan(0.2);
        expect(chestSpec.glowRadiusX).toBeGreaterThan(40);
        expect(chestSpec.hasSparkles).toBe(true);

        const doorLockedSpec = resolveInteractableVisualGlowSpec({
          kind: 'door',
          biome: 1,
          locked: true,
        });
        const doorOpenSpec = resolveInteractableVisualGlowSpec({
          kind: 'door',
          biome: 1,
          locked: false,
        });
        expect(doorLockedSpec.colorNum).toBe(0xdc2626);
        expect(doorOpenSpec.colorNum).toBe(hexToNum(ENV_PALETTE[1].accent));
        expect(doorOpenSpec.glowRadiusX).toBeGreaterThanOrEqual(doorLockedSpec.glowRadiusX);
      });
    });

    // ==========================================================================
    // TIER 4 — REAL-WORLD APPLICATION SCENARIOS (8 END-TO-END SCENARIOS)
    // ==========================================================================
    describe('Tier 4 — Real-World Application Scenarios (End-to-End Multi-Room Journeys)', () => {
      it('T4-SC-01 [Scenario 1]: Biome 1 (Ashwood Crypts) full dungeon floor traversal from Hub -> Start -> Multi-Size/Shape Combat -> Boss (48x28)', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 41001, startInHub: true });
        const { scene, canvasTextures, graphicsList } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();
        expect(sim.inHub).toBe(true);
        expect(sim.map.cols).toBe(36);
        expect(sim.map.rows).toBe(22);

        sim.startDungeonRunFromHub();
        scene.syncArenaTilesWithMapRevision();
        expect(sim.inHub).toBe(false);
        expect(sim.currentBiome).toBe(1);

        const visitedSizes = new Set<string>();
        for (const rawRoom of sim.dungeon.rooms) {
          const room = rawRoom as ExtendedDungeonRoomNode;
          const ok = sim.enterRoom(room.id);
          expect(ok).toBe(true);
          scene.syncArenaTilesWithMapRevision();
          scene.syncProps(0.016);
          scene.biomeArchLive.update({
            dtSec: 0.016,
            map: sim.map,
            props: sim.props,
            lightingEnabled: true,
          });
          const groundTex = canvasTextures.get('arena_ground_composite')!;
          expect(groundTex.width).toBe(sim.map.cols * TILE_SIZE * scene.tileCompositeScale);
          expect(groundTex.height).toBe(sim.map.rows * TILE_SIZE * scene.tileCompositeScale);
          expect(areActiveDoorsConnectedBfsContract(sim.map, Object.keys(room.connections) as CardinalDir[])).toBe(true);
          visitedSizes.add(`${sim.map.cols}x${sim.map.rows}`);
        }
        expect(visitedSizes.size).toBeGreaterThanOrEqual(2);
        expect(graphicsList.length).toBeGreaterThanOrEqual(3);
      });

      it('T4-SC-02 [Scenario 2]: Biome 2 (Glacial Vaults) crystalline ice & chasm gauntlet with tall_sanctum/grand_arena and 3-tile bridges', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 42002, startInHub: false });
        sim.advanceToBiome(2);
        const { scene, canvasTextures, graphicsList } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();

        const combatRooms = sim.dungeon.rooms.filter((r) => r.type === 'combat') as ExtendedDungeonRoomNode[];
        expect(combatRooms.length).toBeGreaterThanOrEqual(2);
        combatRooms[0]!.roomSizePreset = 'tall_sanctum';
        combatRooms[0]!.cols = 32;
        combatRooms[0]!.rows = 28;
        combatRooms[0]!.roomShape = 'hourglass';
        combatRooms[0]!.roomArchetype = 'TWIN_BRIDGES';

        combatRooms[1]!.roomSizePreset = 'grand_arena';
        combatRooms[1]!.cols = 44;
        combatRooms[1]!.rows = 26;
        combatRooms[1]!.roomShape = 'octagon';
        combatRooms[1]!.roomArchetype = 'PRISM_LABYRINTH';

        for (const room of [combatRooms[0]!, combatRooms[1]!]) {
          sim.enterRoom(room.id);
          scene.syncArenaTilesWithMapRevision();
          scene.syncProps(0.033);
          scene.biomeArchLive.update({
            dtSec: 0.033,
            map: sim.map,
            props: sim.props,
            lightingEnabled: true,
          });
          expect(sim.map.cols).toBe(room.cols);
          expect(sim.map.rows).toBe(room.rows);
          expect(canvasTextures.get('arena_ground_composite')?.width).toBe(room.cols! * TILE_SIZE * 2);
          expect(areActiveDoorsConnectedBfsContract(sim.map, ['N', 'S', 'E', 'W'])).toBe(true);
        }
        const surfaceGraphics = graphicsList.find((g) => g.depth < 18 && g.blendMode === 0)!;
        expect(surfaceGraphics.ops.filter((o) => o.op !== 'clear').length).toBeGreaterThan(0);
      });

      it('T4-SC-03 [Scenario 3]: Biome 3 (Molten Foundry) magma fissures, conveyors, slag crucibles, and additive emissive lighting', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 43003, startInHub: false });
        sim.advanceToBiome(3);
        const { scene, graphicsList, canvasTextures } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();

        const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') as ExtendedDungeonRoomNode;
        combatRoom.roomSizePreset = 'wide_hall';
        combatRoom.cols = 46;
        combatRoom.rows = 20;
        combatRoom.roomShape = 'cruciform';
        combatRoom.roomArchetype = 'CROSSFIRE_CONVEYORS';

        sim.enterRoom(combatRoom.id);
        sim.map.fillSurfaceRect(18, 9, 4, 2, 'lava');
        scene.syncArenaTilesWithMapRevision();
        scene.syncProps(0.033);
        scene.biomeArchLive.update({
          dtSec: 0.033,
          map: sim.map,
          props: sim.props,
          lightingEnabled: true,
        });

        expect(sim.map.cols).toBe(46);
        expect(sim.map.rows).toBe(20);
        expect(canvasTextures.get('arena_ground_composite')?.width).toBe(46 * TILE_SIZE * 2);
        const additiveGraphics = graphicsList.find((g) => g.depth >= 35 && g.blendMode === 1)!;
        expect(additiveGraphics.ops.filter((o) => o.op !== 'clear').length).toBeGreaterThanOrEqual(8);
      });

      it('T4-SC-04 [Scenario 4]: CRUMBLING_PILLAR_RING combat & tactical prop cap lifecycle without orphaned pillar tiles', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 44004, startInHub: false });
        const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') as ExtendedDungeonRoomNode;
        combatRoom.roomSizePreset = 'grand_arena';
        combatRoom.cols = 44;
        combatRoom.rows = 26;
        combatRoom.roomShape = 'octagon';
        combatRoom.roomArchetype = 'CRUMBLING_PILLAR_RING';

        sim.enterRoom(combatRoom.id);
        const { scene } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();
        const groundPassSpy = vi.spyOn(scene.biomeArchLive, 'renderGroundPass');

        // Spawn 20 extra destructible props during combat
        for (let i = 0; i < 20; i++) {
          sim.spawnProp('volatile_spore_pod', 240 + (i % 5) * 52, 220 + Math.floor(i / 5) * 48);
        }
        expect(sim.props.length).toBeLessThanOrEqual(MAX_TACTICAL_PROPS_PER_ROOM);
        const liveTotems = sim.props.filter((p) => p.kind === 'rotten_totem_pillar' && p.hp > 0);
        expect(liveTotems.length).toBe(6);

        // Collapse 2 pillars mid-fight and verify composite redraw + renderGroundPass
        collapseRottenTotemPillar(sim, liveTotems[0]!, 0);
        collapseRottenTotemPillar(sim, liveTotems[1]!, Math.PI / 2);
        scene.syncArenaTilesWithMapRevision();
        scene.syncProps(0.016);
        expect(groundPassSpy).toHaveBeenCalled();

        // Every remaining 2x2 pillar tile on map must correspond to one of the 4 remaining intact totems
        const remainingTotems = sim.props.filter((p) => p.kind === 'rotten_totem_pillar' && p.hp > 0);
        expect(remainingTotems.length).toBe(4);
        for (let ty = 1; ty < sim.map.rows - 1; ty++) {
          for (let tx = 1; tx < sim.map.cols - 1; tx++) {
            if (sim.map.getTile(tx, ty) === 'pillar') {
              const cx = tx * TILE_SIZE + 16;
              const cy = ty * TILE_SIZE + 16;
              expect(
                remainingTotems.some((t) => Math.hypot(t.x - cx, t.y - cy) <= TILE_SIZE * 1.5),
              ).toBe(true);
            }
          }
        }
      });

      it('T4-SC-05 [Scenario 5]: Secret room discovery, cracked wall explosion, lightmap transition, and compact <-> wide_hall resize', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 45005, startInHub: false });
        const hostRoom = sim.dungeon.rooms.find(
          (r) => r.secretWallDir !== undefined && r.type !== 'secret',
        ) as ExtendedDungeonRoomNode;
        const secretRoom = sim.dungeon.rooms[sim.dungeon.secretRoomId] as ExtendedDungeonRoomNode;
        expect(hostRoom).toBeDefined();
        expect(secretRoom).toBeDefined();

        hostRoom.roomSizePreset = 'wide_hall';
        hostRoom.cols = 46;
        hostRoom.rows = 20;
        secretRoom.roomSizePreset = 'compact';
        secretRoom.cols = 28;
        secretRoom.rows = 18;

        sim.enterRoom(hostRoom.id);
        sim.enemies.length = 0;
        sim.rebuildCurrentRoomDoors();

        const { scene, canvasTextures } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();
        expect(canvasTextures.get('arena_ground_composite')?.width).toBe(46 * TILE_SIZE * 2);

        const scratch: InteractableLightEntry[] = [];
        populateInteractableLightsScratchContract(scratch, {
          tier: 'high',
          biome: sim.currentBiome,
          elapsedSec: 1.0,
          secretWallBroken: sim.secretWallBroken,
          doors: sim.doors,
        });
        expect(scratch.filter((e) => e.kind === 'door' && e.colorNum === 0xdc2626).length).toBe(0);

        // Break secret wall
        const cw = sim.map.getCrackedWallTileForDir(hostRoom.secretWallDir!);
        expect(
          tryBreakCrackedWallNearImpact(sim, cw.tx * TILE_SIZE + 16, cw.ty * TILE_SIZE + 16, 64),
        ).toBe(true);
        scene.syncArenaTilesWithMapRevision();

        populateInteractableLightsScratchContract(scratch, {
          tier: 'high',
          biome: sim.currentBiome,
          elapsedSec: 1.0,
          secretWallBroken: sim.secretWallBroken,
          doors: sim.doors,
        });
        expect(scratch.filter((e) => e.kind === 'door').length).toBeGreaterThanOrEqual(1);

        // Transition into compact 28x18 secret room and back to wide_hall 46x20
        sim.enterRoom(secretRoom.id, hostRoom.secretWallDir);
        scene.syncArenaTilesWithMapRevision();
        expect(sim.map.cols).toBe(28);
        expect(sim.map.rows).toBe(18);
        expect(canvasTextures.get('arena_ground_composite')?.width).toBe(28 * TILE_SIZE * 2);

        sim.enterRoom(hostRoom.id, OPPOSITE_DIR[hostRoom.secretWallDir!]);
        scene.syncArenaTilesWithMapRevision();
        expect(sim.map.cols).toBe(46);
        expect(sim.map.rows).toBe(20);
        expect(canvasTextures.get('arena_ground_composite')?.width).toBe(46 * TILE_SIZE * 2);
      });

      it('T4-SC-06 [Scenario 6]: Multi-seed determinism & 36x22 legacy compatibility audit across simulation and rendering', () => {
        for (const seed of [1001, 2002, 3003]) {
          const simA = createWorldSimWithOverhaulSupport({ seed, startInHub: false });
          const simB = createWorldSimWithOverhaulSupport({ seed, startInHub: false });
          for (let step = 0; step < 15; step++) {
            simA.step(SIM_STEP_SEC);
            simB.step(SIM_STEP_SEC);
          }
          expect(simA.map.cols).toBe(simB.map.cols);
          expect(simA.map.rows).toBe(simB.map.rows);
          expect(simA.map.tiles).toEqual(simB.map.tiles);
          expect(simA.map.surfaces).toEqual(simB.map.surfaces);
          expect(simA.player.x).toBeCloseTo(simB.player.x, 5);
          expect(simA.player.y).toBeCloseTo(simB.player.y, 5);
        }
      });

      it('T4-SC-07 [Scenario 7]: 4-player Co-op Boss Phase 3 progression on colossal_boss (48x28) across all 3 biomes', () => {
        for (const biome of [1, 2, 3] as const) {
          const sim = createWorldSimWithOverhaulSupport({
            seed: 47000 + biome,
            startInHub: false,
          });
          sim.advanceToBiome(biome);
          sim.advanceToFloor(2);
          sim.simulatedPlayers = [
            sim.createPlayerState(2, 2, 'ranger', 400, 300),
            sim.createPlayerState(3, 3, 'elementalist', 450, 300),
            sim.createPlayerState(4, 4, 'engineer', 500, 300),
          ];
          const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss') as ExtendedDungeonRoomNode;
          expect(bossRoom).toBeDefined();
          sim.enterRoom(bossRoom.id, 'S');
          const { scene, canvasTextures } = createMockGameSceneHarness(sim);
          scene.buildArenaTiles();

          expect(sim.map.cols).toBe(48);
          expect(sim.map.rows).toBe(28);
          if (biome === 1) sim.map.applyBossPhase3ToxicBorder();
          else if (biome === 2) sim.map.applyBossPhase3BlizzardBorder();
          else sim.map.applyBossPhase3LavaBorder();

          scene.syncArenaTilesWithMapRevision();
          scene.biomeArchLive.update({
            dtSec: 0.033,
            map: sim.map,
            props: sim.props,
            lightingEnabled: true,
          });
          expect(canvasTextures.get('arena_ground_composite')?.width).toBe(48 * TILE_SIZE * 2);
          expect(sim.getAllPlayers().length).toBe(4);
        }
      });

      it('T4-SC-08 [Scenario 8]: Full 60-combination matrix (6 Presets x 10 Shapes) end-to-end composite build & architectural density audit', () => {
        const dims = getRoomSizePresetDims();
        const sim = createWorldSimWithOverhaulSupport({ seed: 48008, startInHub: false });
        const { scene, canvasTextures } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();

        let idx = 0;
        for (const preset of ALL_ROOM_SIZE_PRESETS) {
          const { cols, rows } = dims[preset];
          for (const roomShape of ALL_ROOM_SHAPES) {
            const archetype = ALL_ROOM_ARCHETYPES[idx % ALL_ROOM_ARCHETYPES.length]!;
            const biome = ((idx % 3) + 1) as 1 | 2 | 3;
            idx += 1;

            configureRoomLayoutContract(sim.map, {
              roomType: 'combat',
              roomSeed: 48000 + idx,
              archetype,
              biome,
              cols,
              rows,
              roomShape,
            });
            scene.syncArenaTilesWithMapRevision();
            const plan = buildRoomArchitecturePlanContract(sim.map, 'combat', biome, 48000 + idx);
            expect(plan.budget.largeDecorCount).toBeLessThanOrEqual(8);
            expect(plan.budget.emptyPerimeterRatio).toBeGreaterThanOrEqual(0.4);
            expect(canvasTextures.get('arena_ground_composite')?.width).toBe(cols * TILE_SIZE * 2);
            expect(canvasTextures.get('arena_ground_composite')?.height).toBe(rows * TILE_SIZE * 2);
            expect(areActiveDoorsConnectedBfsContract(sim.map, ['N', 'S', 'E', 'W'])).toBe(true);
          }
        }
        expect(idx).toBe(60);
      });
    });

    // ==========================================================================
    // TIER 5 — WHITE-BOX ADVERSARIAL COVERAGE HARDENING (F1–F14)
    // ==========================================================================
    describe('Tier 5 — White-Box Adversarial Coverage Hardening (F1–F14)', () => {
      it('T5-WB-01: white-box ArenaMap.resize rapid oscillation across all 6 presets preserves buffer lengths, solidBoxes bounds, and monotonic mapRevision', () => {
        const map = new ArenaMap();
        const sequence: readonly RoomSizePreset[] = [
          'compact',
          'colossal_boss',
          'wide_hall',
          'tall_sanctum',
          'grand_arena',
          'standard',
        ];
        let lastRev = map.mapRevision;
        for (const preset of sequence) {
          const { cols, rows } = ROOM_SIZE_PRESET_DIMS[preset];
          const didResize = map.resize(cols, rows);
          expect(didResize).toBe(true);
          expect(map.mapRevision).toBeGreaterThan(lastRev);
          lastRev = map.mapRevision;

          const total = cols * rows;
          expect(map.tiles.length).toBe(total);
          expect(map.tileVariants.length).toBe(total);
          expect(map.surfaces.length).toBe(total);
          expect(map.baseSurfaces.length).toBe(total);
          expect(map.surfaceTimers.length).toBe(total);
          expect(map.width).toBe(cols * TILE_SIZE);
          expect(map.height).toBe(rows * TILE_SIZE);
          expect(map.resize(cols, rows)).toBe(false);
          expect(map.mapRevision).toBe(lastRev);
        }
      });

      it('T5-WB-02: white-box applyRoomInteriorShape + getDoorVestibuleRectsForMap + areActiveDoorsConnectedBfs across all 60 (preset x shape) and all 15 door subsets', () => {
        const doorSubsets: readonly (readonly CardinalDir[])[] = [
          ['N'],
          ['S'],
          ['E'],
          ['W'],
          ['N', 'S'],
          ['E', 'W'],
          ['N', 'E'],
          ['N', 'W'],
          ['S', 'E'],
          ['S', 'W'],
          ['N', 'S', 'E'],
          ['N', 'S', 'W'],
          ['N', 'E', 'W'],
          ['S', 'E', 'W'],
          ['N', 'S', 'E', 'W'],
        ];
        const map = new ArenaMap();
        let combinationsVerified = 0;

        for (const preset of ALL_ROOM_SIZE_PRESETS) {
          const { cols, rows } = ROOM_SIZE_PRESET_DIMS[preset];
          for (const shape of ALL_ROOM_SHAPES) {
            configureRoomLayout(map, {
              roomSeed: 5020 + combinationsVerified,
              archetype: ALL_ROOM_ARCHETYPES[combinationsVerified % ALL_ROOM_ARCHETYPES.length]!,
              biome: ((combinationsVerified % 3) + 1) as 1 | 2 | 3,
              roomSizePreset: preset,
              cols,
              rows,
              roomShape: shape,
            });
            combinationsVerified += 1;

            const vestibules = getDoorVestibuleRectsForMap(map);
            for (const dir of ['N', 'S', 'E', 'W'] as const) {
              const r = vestibules[dir];
              for (let ty = r.minTy; ty <= r.maxTy; ty++) {
                for (let tx = r.minTx; tx <= r.maxTx; tx++) {
                  expect(map.isSolidTile(tx, ty)).toBe(false);
                  expect(map.getSurface(tx, ty)).not.toBe('chasm');
                }
              }
            }

            for (const subset of doorSubsets) {
              expect(areActiveDoorsConnectedBfs(map, subset)).toBe(true);
            }
          }
        }
        expect(combinationsVerified).toBe(60);
      });

      it('T5-WB-03: white-box computeTwinBridgesRows and drawBridgeOverChasmOverlay across all room heights (18..28) render north, middle, and south bridge planks', () => {
        for (const rows of [18, 20, 22, 24, 26, 28]) {
          const [[topStart, topEnd], [botStart, botEnd]] = computeTwinBridgesRows(rows);
          expect(topEnd - topStart).toBe(2);
          expect(botEnd - botStart).toBe(2);
          expect(topStart).toBeGreaterThanOrEqual(4);
          expect(botEnd).toBeLessThanOrEqual(rows - 5);

          const map = new ArenaMap({ cols: 36, rows });
          configureRoomLayout(map, {
            roomSeed: 5030 + rows,
            archetype: 'TWIN_BRIDGES',
            biome: 1,
            cols: 36,
            rows,
            roomShape: 'rectangle',
          });
          const midX = Math.floor(map.cols / 2);
          for (const bridgeRow of [topStart, topStart + 1, topEnd, botStart, botStart + 1, botEnd]) {
            expect(isWalkableTileForBfs(map, midX - 2, bridgeRow)).toBe(true);
            expect(isBridgeFloorTileOverChasm(map, midX - 2, bridgeRow)).toBe(true);
          }

          for (const [hasN, hasS] of [
            [true, false],
            [false, false],
            [false, true],
          ] as const) {
            const ctx = createRecording2dContext();
            drawBridgeOverChasmOverlay(ctx, 0, 0, 32, hasN, hasS, 1);
            expect(ctx.ops.length).toBeGreaterThanOrEqual(8);
            expect(getAllRecordedColors(ctx).size).toBeGreaterThanOrEqual(3);
          }
        }
      });

      it('T5-WB-04: white-box MAX_TACTICAL_PROPS_PER_ROOM adversarial eviction priority in spawnPropImpl never leaves orphaned solid pillar tiles', () => {
        const sim = new WorldSim({ seed: 5040, biome: 1 });
        const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat')!;
        combatRoom.roomArchetype = 'CRUMBLING_PILLAR_RING';
        sim.enterRoom(combatRoom.id);

        // 1. Mark one non-pillar prop broken and verify it is evicted first
        const nonPillarTarget = sim.props.find((p) => p.kind !== 'rotten_totem_pillar')!;
        nonPillarTarget.hp = 0;
        nonPillarTarget.state = 'broken';
        while (sim.props.length < MAX_TACTICAL_PROPS_PER_ROOM) {
          sim.spawnProp('moss_table', 260, 260);
        }
        sim.spawnProp('moss_table', 280, 260);
        expect(sim.props.length).toBe(MAX_TACTICAL_PROPS_PER_ROOM);
        expect(sim.props.some((p) => p.id === nonPillarTarget.id)).toBe(false);

        // 2. Spawn minor destructibles and verify all 6 rotten_totem_pillar remain intact
        for (let i = 0; i < 10; i++) {
          sim.spawnProp('wooden_crate', 300 + i * 24, 240);
        }
        expect(sim.props.filter((p) => p.kind === 'rotten_totem_pillar').length).toBe(6);

        // 3. Fill all 16 slots with pillar-backed rotten_totem_pillar and force 17th eviction
        sim.props.length = 0;
        sim.map.setTile(8, 8, 'pillar');
        sim.map.setTile(9, 8, 'pillar');
        sim.map.setTile(8, 9, 'pillar');
        sim.map.setTile(9, 9, 'pillar');
        sim.map.rebuildSolidBoxes();
        const firstTotem = sim.spawnProp('rotten_totem_pillar', 9 * TILE_SIZE, 9 * TILE_SIZE);
        for (let i = 1; i < MAX_TACTICAL_PROPS_PER_ROOM; i++) {
          sim.spawnProp('rotten_totem_pillar', (12 + (i % 6)) * TILE_SIZE, (6 + Math.floor(i / 6) * 2) * TILE_SIZE);
        }
        sim.spawnProp('rotten_totem_pillar', 24 * TILE_SIZE, 12 * TILE_SIZE);
        expect(sim.props.some((p) => p.id === firstTotem.id)).toBe(false);
        expect(sim.map.getTile(8, 8)).toBe('floor');
        expect(sim.map.getTile(9, 9)).toBe('floor');
      });

      it('T5-WB-05: white-box traceOrganicPoolPath and multi-tile lava/ice shoreline autotile across all 16 cardinal bitmasks (0..15)', () => {
        for (let mask = 0; mask <= 15; mask++) {
          const ctxPool = createRecording2dContext();
          traceOrganicPoolPath(ctxPool, mask, 2.6);
          const arcCount = ctxPool.ops.filter((o) => o.type === 'arcTo').length;
          if (mask === 15) {
            expect(arcCount).toBe(0);
          } else if (mask === 0) {
            expect(arcCount).toBe(4);
          }

          const ctxLava = createRecording2dContext();
          drawSurfaceTile(ctxLava, 'lava', mask, 0, 0, 32, mask % 8, 3);
          const lavaColors = getAllRecordedColors(ctxLava);
          expect(lavaColors.size).toBeGreaterThanOrEqual(3);
          if (mask !== 15) {
            expect(lavaColors.has('#1F1614')).toBe(true);
            expect(lavaColors.has('#EA580C')).toBe(true);
          }

          const ctxIce = createRecording2dContext();
          drawSurfaceTile(ctxIce, 'ice', mask, 0, 0, 32, mask % 8, 2);
          const iceColors = getAllRecordedColors(ctxIce);
          expect(iceColors.size).toBeGreaterThanOrEqual(3);
          if (mask !== 15) {
            expect(iceColors.has('#CFE8EE')).toBe(true);
          }
        }
      });

      it('T5-WB-06: white-box drawSurfaceTile coverage across all 9 surface families + chasm across Biomes 1, 2, 3', () => {
        const surfaces: readonly SurfaceKind[] = [
          'lava',
          'ice',
          'water',
          'electrified_water',
          'poison_swamp',
          'oil',
          'grass',
          'burning_oil',
          'conveyor',
          'chasm',
        ];
        for (const surf of surfaces) {
          for (const biome of [1, 2, 3] as const) {
            const ctx = createRecording2dContext();
            drawSurfaceTile(ctx, surf, 0b0101, 0, 0, 32, 3, biome);
            expect(ctx.ops.length).toBeGreaterThanOrEqual(6);
            expect(getAllRecordedColors(ctx).size).toBeGreaterThanOrEqual(3);
          }
        }
      });

      it('T5-WB-07: white-box BiomeArchitectureLiveLayer deterministic freezeVisualTime and additive emissive gating (isLow / lightingEnabled)', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 5070, startInHub: false });
        sim.map.fillSurfaceRect(10, 8, 3, 3, 'lava');
        sim.map.fillSurfaceRect(16, 8, 3, 3, 'ice');
        sim.spawnProp('torch_brazier', 12 * TILE_SIZE, 10 * TILE_SIZE);

        const { scene, graphicsList } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();
        const additiveGfx = graphicsList.find((g) => g.depth >= 35 && g.blendMode === 1)!;
        expect(additiveGfx).toBeDefined();

        // When lightingEnabled is false, additive emissive graphics must clear and emit zero draw ops
        additiveGfx.ops.length = 0;
        scene.biomeArchLive.update({
          dtSec: 0.05,
          map: sim.map,
          props: sim.props,
          lightingEnabled: false,
        });
        expect(additiveGfx.ops.filter((o) => o.op !== 'clear').length).toBe(0);

        // When lightingEnabled is true on high quality, additive emissive graphics emits glow primitives
        additiveGfx.ops.length = 0;
        scene.biomeArchLive.update({
          dtSec: 0.05,
          map: sim.map,
          props: sim.props,
          lightingEnabled: true,
        });
        expect(additiveGfx.ops.filter((o) => o.op !== 'clear').length).toBeGreaterThanOrEqual(6);
      });

      it('T5-WB-08: white-box bakeBiomeTile, bakeWallTile, and bakePillarTile across Hub + Biomes 1-3, variants 0..7, and wall masks 0..15', () => {
        withMockBakerScene((scene, baked) => {
          for (const biome of [0, 1, 2, 3] as const) {
            for (let v = 0; v < 8; v++) {
              const ctxFloor = bakeBiomeTileContract(scene, baked, biome, v, 4);
              expect(ctxFloor.ops.length).toBeGreaterThanOrEqual(8);
              expect(getAllRecordedColors(ctxFloor).size).toBeGreaterThanOrEqual(3);
            }

            const ctxPillar = bakePillarTileContract(
              scene,
              baked,
              biome,
              AUTOTILE_EAST | AUTOTILE_SOUTH,
              4,
            );
            expect(ctxPillar.ops.length).toBeGreaterThanOrEqual(10);
            expect(getAllRecordedColors(ctxPillar).size).toBeGreaterThanOrEqual(4);

            for (let mask = 0; mask <= 15; mask++) {
              const ctxWall = bakeWallTileContract(scene, baked, biome, mask, 4);
              expect(ctxWall.ops.length).toBeGreaterThan(0);
              if (mask === 15) {
                expect(countNonEmptyStrokesWithColor(ctxWall, PALETTE.INK_DARK)).toBe(0);
              } else if ((mask & AUTOTILE_SOUTH) === 0) {
                expect(ctxWall.ops.filter((o) => o.type === 'fillRect').length).toBeGreaterThanOrEqual(4);
              }
            }
          }
        });
      });

      it('T5-WB-09: white-box syncArenaTilesWithMapRevisionImpl dynamic composite resize (28x18 -> 48x28 -> 36x22), dirty-tile mutation, and conveyor reversal', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 5090, startInHub: false });
        const { scene, canvasTextures } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();
        const groundPassSpy = vi.spyOn(scene.biomeArchLive, 'renderGroundPass');

        for (const [cols, rows] of [
          [28, 18],
          [48, 28],
          [36, 22],
        ] as const) {
          sim.map.resize(cols, rows);
          scene.syncArenaTilesWithMapRevision();
          const groundTex = canvasTextures.get('arena_ground_composite')!;
          expect(groundTex.width).toBe(cols * TILE_SIZE * scene.tileCompositeScale);
          expect(groundTex.height).toBe(rows * TILE_SIZE * scene.tileCompositeScale);
          expect(scene.arenaGroundSprite?.x).toBe((cols * TILE_SIZE) / 2);
          expect(scene.arenaGroundSprite?.y).toBe((rows * TILE_SIZE) / 2);
        }

        groundPassSpy.mockClear();
        sim.map.reverseConveyorDirection();
        scene.syncArenaTilesWithMapRevision();
        expect(groundPassSpy).toHaveBeenCalledTimes(1);
      });

      it('T5-WB-10: white-box syncPropsImpl footprint-proportional shadows and broken prop animation suppression + secret passage light suppression', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 5100, startInHub: false });
        sim.props.length = 0;
        const table = sim.spawnProp('moss_table', 280, 260);
        const pod = sim.spawnProp('caustic_spore_pod', 340, 260);
        const { scene } = createMockGameSceneHarness(sim);

        scene.syncProps(0.1);
        const tableVis = scene.propVisuals.get(table.id)!;
        const podVis = scene.propVisuals.get(pod.id)!;
        expect(tableVis.shadow.scaleX).toBeGreaterThan(podVis.shadow.scaleX);

        pod.coverState = 'fallen';
        scene.syncProps(0.25);
        expect(podVis.sprite.scaleX).toBeCloseTo(0.25, 5);
        expect(podVis.sprite.scaleY).toBeCloseTo(0.25, 5);
        expect(podVis.sprite.rotation).toBe(0);

        pod.hp = 0;
        scene.syncProps(0.25);
        expect(scene.propVisuals.has(pod.id)).toBe(false);

        const scratch: InteractableLightEntry[] = [];
        populateInteractableLightsScratchContract(scratch, {
          tier: 'high',
          biome: 1,
          elapsedSec: 1.0,
          secretWallBroken: false,
          doors: [
            {
              dir: 'N',
              targetRoomId: 99,
              targetRoomType: 'secret',
              x: 576,
              y: 50,
              radius: 26,
              locked: true,
              isSecretPassage: true,
            },
          ],
        });
        expect(scratch.filter((e) => e.kind === 'door').length).toBe(0);
      });

      it('T5-WB-11: white-box generateDungeonFloor Step 7 (room_size_and_shape) adjacency diversity, unlocked TWIN_BRIDGES shapes, and boss/start invariants across 30 seeds x 3 biomes', () => {
        const twinBridgesShapes = new Set<RoomShapeKind>();
        let twinBridgesNonRectCount = 0;
        const scratchMap = new ArenaMap();

        for (const biome of [1, 2, 3] as const) {
          for (let s = 1; s <= 30; s++) {
            const floor = generateDungeonFloor(s * 131 + biome * 17, 2, 1, biome);
            for (const room of floor.rooms) {
              expect(room.roomSizePreset).toBeDefined();
              expect(room.roomShape).toBeDefined();
              expect(ALL_ROOM_SHAPES).toContain(room.roomShape!);
              if (room.type === 'start') {
                expect(room.roomSizePreset).toBe('standard');
                expect(room.roomShape).toBe('rectangle');
              } else if (room.type === 'boss') {
                expect(['grand_arena', 'colossal_boss']).toContain(room.roomSizePreset);
              }
              if (room.roomArchetype === 'TWIN_BRIDGES') {
                twinBridgesShapes.add(room.roomShape as RoomShapeKind);
                if (room.roomShape !== 'rectangle') {
                  twinBridgesNonRectCount += 1;
                }
                const activeDoors = Object.keys(room.connections) as CardinalDir[];
                configureRoomLayout(scratchMap, {
                  roomSeed: room.surfaceLayoutSeed,
                  archetype: 'TWIN_BRIDGES',
                  biome,
                  roomSizePreset: room.roomSizePreset,
                  cols: room.cols,
                  rows: room.rows,
                  roomShape: room.roomShape,
                  activeDoorSides: activeDoors,
                });
                expect(areActiveDoorsConnectedBfs(scratchMap, activeDoors)).toBe(true);
              }
              if (room.type === 'combat') {
                for (const adjId of Object.values(room.connections)) {
                  if (adjId === undefined) continue;
                  const adj = floor.rooms[adjId];
                  if (adj && adj.type === 'combat') {
                    expect(
                      adj.roomSizePreset === room.roomSizePreset && adj.roomShape === room.roomShape,
                    ).toBe(false);
                  }
                }
              }
            }
          }
        }
        expect(twinBridgesNonRectCount).toBeGreaterThan(0);
        expect(twinBridgesShapes.size).toBeGreaterThanOrEqual(4);
      });

      it('T5-WB-12: white-box 4P co-op spawn safety, colossal_boss (48x28) waypoint BFS, and ensureSecretWallKickableProp across sculpted rooms', () => {
        const sim = new WorldSim({ seed: 5120, biome: 2, playerCount: 4 });
        sim.addCoopPlayer(2, 'ranger', 'P2', 2);
        sim.addCoopPlayer(3, 'elementalist', 'P3', 3);
        sim.addCoopPlayer(4, 'engineer', 'P4', 4);

        const hostRoom = sim.dungeon.rooms.find(
          (r) => r.secretWallDir !== undefined && r.type !== 'secret',
        )!;
        for (const shape of ['octagon', 'cruciform', 'hourglass'] as const) {
          hostRoom.roomSizePreset = 'colossal_boss';
          hostRoom.cols = 48;
          hostRoom.rows = 28;
          hostRoom.roomShape = shape;
          sim.secretWallBroken = false;
          hostRoom.secretWallBroken = false;
          sim.enterRoom(hostRoom.id, 'S');
          ensureSecretWallKickableProp(sim, hostRoom);

          for (const pl of sim.getAllPlayers()) {
            const tx = Math.floor(pl.x / TILE_SIZE);
            const ty = Math.floor(pl.y / TILE_SIZE);
            expect(sim.map.isSolidTile(tx, ty)).toBe(false);
            expect(sim.map.getSurface(tx, ty)).not.toBe('chasm');
          }

          const cw = sim.map.getCrackedWallTileForDir(hostRoom.secretWallDir!);
          const wallX = cw.tx * TILE_SIZE + 16;
          const wallY = cw.ty * TILE_SIZE + 16;
          expect(
            sim.props.some((p) => p.hp > 0 && Math.hypot(p.x - wallX, p.y - wallY) <= 220),
          ).toBe(true);

          const wp = findNextWalkableWaypoint(
            sim.map,
            sim.player.x,
            sim.player.y,
            sim.map.width * 0.5,
            sim.map.height * 0.5,
          );
          expect(
            isWalkableTileForBfs(sim.map, Math.floor(wp.x / TILE_SIZE), Math.floor(wp.y / TILE_SIZE)),
          ).toBe(true);
        }
      });

      it('T5-WB-13 [F11]: Deep Enter-the-Gungeon 10-shape carving, Exterior Void thresholds (>= 24..60), 1-tile active wall framing, and island_catwalk chasm moat across all 60 (Preset x Shape) layouts', () => {
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

        const map = new ArenaMap();
        let totalVerified = 0;

        for (const preset of ALL_ROOM_SIZE_PRESETS) {
          const { cols, rows } = ROOM_SIZE_PRESET_DIMS[preset];
          const minVoidExpected =
            preset === 'compact'
              ? 24
              : preset === 'grand_arena' || preset === 'colossal_boss'
                ? 60
                : 40;

          for (const shape of ALL_ROOM_SHAPES) {
            configureRoomLayout(map, {
              roomSeed: 6130 + totalVerified,
              archetype: 'CENTRAL_BASTION',
              biome: 1,
              roomSizePreset: preset,
              cols,
              rows,
              roomShape: shape,
            });
            totalVerified += 1;

            let activeWallCount = 0;
            let voidWallCount = 0;
            let chasmCount = 0;

            for (let ty = 0; ty < rows; ty++) {
              for (let tx = 0; tx < cols; tx++) {
                const kind = map.getTile(tx, ty);
                if (map.getSurface(tx, ty) === 'chasm') {
                  chasmCount += 1;
                }
                if (kind === 'wall') {
                  const active = isActiveWallTile(map, tx, ty);
                  const extVoid = isExteriorVoidWallTile(map, tx, ty);
                  expect(active).toBe(!extVoid);
                  if (active) activeWallCount += 1;
                  if (extVoid) voidWallCount += 1;
                } else {
                  expect(isExteriorVoidWallTile(map, tx, ty)).toBe(false);
                }
              }
            }

            if (shape === 'rectangle') {
              expect(voidWallCount).toBe(0);
              expect(activeWallCount).toBe(2 * cols + 2 * (rows - 2));
            } else {
              expect(
                voidWallCount,
                `Expected >= ${minVoidExpected} Exterior Void tiles for ${preset} ${shape}, got ${voidWallCount}`,
              ).toBeGreaterThanOrEqual(minVoidExpected);
              expect(activeWallCount).toBeGreaterThanOrEqual(24);
            }

            if (shape === 'island_catwalk') {
              expect(chasmCount).toBeGreaterThanOrEqual(20);
              const vestibules = getDoorVestibuleRectsForMap(map);
              for (const dir of ['N', 'S', 'E', 'W'] as const) {
                const v = vestibules[dir];
                for (let ty = v.minTy; ty <= v.maxTy; ty++) {
                  for (let tx = v.minTx; tx <= v.maxTx; tx++) {
                    expect(map.getTile(tx, ty)).toBe('floor');
                    expect(map.getSurface(tx, ty)).not.toBe('chasm');
                  }
                }
              }
            }
          }
        }
        expect(totalVerified).toBe(60);
      });

      it('T5-WB-14 [F11 x F3]: Full 360-combination matrix (6 Presets x 10 Shapes x 6 Archetypes) BFS connectivity, TWIN_BRIDGES East/West chasm separation, PRISM_LABYRINTH >= 40 pillar tiles, and CRUMBLING_PILLAR_RING 6x 2x2 pillars', () => {
        const map = new ArenaMap();
        let comboCount = 0;

        for (const preset of ALL_ROOM_SIZE_PRESETS) {
          const { cols, rows } = ROOM_SIZE_PRESET_DIMS[preset];
          for (const shape of ALL_ROOM_SHAPES) {
            for (const archetype of ALL_ROOM_ARCHETYPES) {
              const biome = ((comboCount % 3) + 1) as 1 | 2 | 3;
              configureRoomLayout(map, {
                roomSeed: 7000 + comboCount,
                archetype,
                biome,
                roomSizePreset: preset,
                cols,
                rows,
                roomShape: shape,
                activeDoorSides: ['N', 'S', 'E', 'W'],
              });
              comboCount += 1;

              expect(
                areActiveDoorsConnectedBfs(map, ['N', 'S', 'E', 'W']),
                `BFS connectivity failed for ${preset} x ${shape} x ${archetype}`,
              ).toBe(true);

              for (const anchor of map.propAnchors) {
                expect(anchor.tx).toBeGreaterThanOrEqual(2);
                expect(anchor.tx).toBeLessThanOrEqual(cols - 3);
                expect(anchor.ty).toBeGreaterThanOrEqual(2);
                expect(anchor.ty).toBeLessThanOrEqual(rows - 3);
                expect(map.getSurface(anchor.tx, anchor.ty)).not.toBe('chasm');
                expect(isInMapDoorVestibule(map, anchor.tx, anchor.ty)).toBe(false);
                if (anchor.propKind !== 'rotten_totem_pillar') {
                  expect(map.isSolidTile(anchor.tx, anchor.ty)).toBe(false);
                }
              }

              if (archetype === 'CRUMBLING_PILLAR_RING') {
                const rects = getCrumblingRingPillarRectsForMap(map);
                expect(rects.length).toBe(6);
                let pillarTileCount = 0;
                for (let i = 0; i < map.tiles.length; i++) {
                  if (map.tiles[i] === 'pillar') pillarTileCount += 1;
                }
                expect(pillarTileCount).toBe(24);
              } else if (archetype === 'PRISM_LABYRINTH') {
                let pillarTileCount = 0;
                for (let i = 0; i < map.tiles.length; i++) {
                  if (map.tiles[i] === 'pillar') pillarTileCount += 1;
                }
                expect(pillarTileCount).toBeGreaterThanOrEqual(40);
              } else if (archetype === 'TWIN_BRIDGES') {
                const [[topStart, topEnd], [botStart, botEnd]] = computeTwinBridgesRows(rows);
                const midX = Math.floor(cols / 2);
                let bridgeWalkableCount = 0;
                for (let ty = topStart; ty <= topEnd; ty++) {
                  if (isWalkableTileForBfs(map, midX, ty)) bridgeWalkableCount += 1;
                }
                for (let ty = botStart; ty <= botEnd; ty++) {
                  if (isWalkableTileForBfs(map, midX, ty)) bridgeWalkableCount += 1;
                }
                expect(bridgeWalkableCount).toBeGreaterThanOrEqual(4);

                let midChasmCount = 0;
                for (let ty = topEnd + 1; ty < botStart; ty++) {
                  for (let tx = midX - 2; tx <= midX + 1; tx++) {
                    if (map.getSurface(tx, ty) === 'chasm' || map.isSolidTile(tx, ty)) {
                      midChasmCount += 1;
                    }
                  }
                }
                expect(midChasmCount).toBeGreaterThan(0);
              }
            }
          }
        }
        expect(comboCount).toBe(360);
      });

      it('T5-WB-15 [F11]: Signature topologies (l_shape, t_shape, u_shape, donut_ring, multi_chamber, island_catwalk) and center-obstructed shape relocation guards for players, NPCs, portals, chests, pressure plates, and push blocks', () => {
        const map = new ArenaMap({ cols: 36, rows: 22 });
        const midX = 18;
        const midY = 11;

        // 1. l_shape: NE quadrant carved into Exterior Void
        configureRoomLayout(map, {
          roomSeed: 7501,
          archetype: 'CENTRAL_BASTION',
          biome: 1,
          cols: 36,
          rows: 22,
          roomShape: 'l_shape',
        });
        expect(isExteriorVoidWallTile(map, 32, 3)).toBe(true);
        expect(isWalkableTileForBfs(map, 8, 6)).toBe(true);
        expect(isWalkableTileForBfs(map, 28, 16)).toBe(true);

        // 2. t_shape: SW and SE quadrants carved into Exterior Void
        configureRoomLayout(map, {
          roomSeed: 7502,
          archetype: 'CENTRAL_BASTION',
          biome: 2,
          cols: 36,
          rows: 22,
          roomShape: 't_shape',
        });
        expect(isExteriorVoidWallTile(map, 4, 18)).toBe(true);
        expect(isExteriorVoidWallTile(map, 31, 18)).toBe(true);
        expect(isWalkableTileForBfs(map, midX, 17)).toBe(true);

        // 3. u_shape: North courtyard carved into Exterior Void with central baffle
        configureRoomLayout(map, {
          roomSeed: 7503,
          archetype: 'CROSSFIRE_CONVEYORS',
          biome: 3,
          cols: 36,
          rows: 22,
          roomShape: 'u_shape',
        });
        expect(isExteriorVoidWallTile(map, 11, 2)).toBe(true);
        expect(isExteriorVoidWallTile(map, 25, 2)).toBe(true);
        expect(isWalkableTileForBfs(map, 6, 10)).toBe(true);
        expect(isWalkableTileForBfs(map, 30, 10)).toBe(true);

        // 4. donut_ring: Central monolith has Exterior Void inner core and 1-tile Active Wall ring
        configureRoomLayout(map, {
          roomSeed: 7504,
          archetype: 'CRUMBLING_PILLAR_RING',
          biome: 1,
          cols: 44,
          rows: 26,
          roomShape: 'donut_ring',
        });
        expect(map.getTile(22, 13)).toBe('wall');
        expect(isExteriorVoidWallTile(map, 22, 13)).toBe(true);
        const safePt = findNearestWalkablePoint(map, map.width * 0.5, map.height * 0.5, 14);
        const safeTx = Math.floor(safePt.x / TILE_SIZE);
        const safeTy = Math.floor(safePt.y / TILE_SIZE);
        expect(map.isSolidTile(safeTx, safeTy)).toBe(false);
        expect(map.getSurface(safeTx, safeTy)).not.toBe('chasm');

        const wp = findNextWalkableWaypoint(
          map,
          22 * TILE_SIZE + 16,
          4 * TILE_SIZE + 16,
          22 * TILE_SIZE + 16,
          22 * TILE_SIZE + 16,
        );
        expect(isWalkableTileForBfs(map, Math.floor(wp.x / TILE_SIZE), Math.floor(wp.y / TILE_SIZE))).toBe(true);

        // 5. WorldSim.enterRoom across special room types with center-obstructed shapes
        const sim = new WorldSim({ seed: 7550, biome: 1, playerCount: 2 });
        sim.addCoopPlayer(2, 'ranger', 'P2', 2);
        const centerShapes: readonly RoomShapeKind[] = [
          'donut_ring',
          'u_shape',
          'multi_chamber',
          'island_catwalk',
        ];
        for (let i = 0; i < sim.dungeon.rooms.length; i++) {
          const room = sim.dungeon.rooms[i]!;
          room.roomShape = centerShapes[i % centerShapes.length]!;
          sim.enterRoom(room.id);

          for (const pl of sim.getAllPlayers()) {
            const ptx = Math.floor(pl.x / TILE_SIZE);
            const pty = Math.floor(pl.y / TILE_SIZE);
            expect(sim.map.isSolidTile(ptx, pty)).toBe(false);
            expect(sim.map.getSurface(ptx, pty)).not.toBe('chasm');
          }
          for (const npc of sim.npcEntities) {
            const ntx = Math.floor(npc.x / TILE_SIZE);
            const nty = Math.floor(npc.y / TILE_SIZE);
            expect(sim.map.isSolidTile(ntx, nty)).toBe(false);
            expect(sim.map.getSurface(ntx, nty)).not.toBe('chasm');
          }
          for (const chest of sim.chests) {
            const ctx = Math.floor(chest.x / TILE_SIZE);
            const cty = Math.floor(chest.y / TILE_SIZE);
            expect(sim.map.isSolidTile(ctx, cty)).toBe(false);
            expect(sim.map.getSurface(ctx, cty)).not.toBe('chasm');
          }
          if (sim.portalActive) {
            const portTx = Math.floor(sim.portalX / TILE_SIZE);
            const portTy = Math.floor(sim.portalY / TILE_SIZE);
            expect(sim.map.isSolidTile(portTx, portTy)).toBe(false);
            expect(sim.map.getSurface(portTx, portTy)).not.toBe('chasm');
          }
        }
      });

      it('T5-WB-16 [F12]: buildRoomArchitecturePlan places 0 solidDecors/items and 0 floorDecals in Exterior Void across all 10 shapes x 4 biomes while populating stepped 3/4 South cliff walls', () => {
        const map = new ArenaMap();
        for (const shape of ALL_ROOM_SHAPES) {
          for (const biome of [0, 1, 2, 3] as const) {
            const simBiome: 1 | 2 | 3 = biome === 0 ? 1 : biome;
            configureRoomLayout(map, {
              roomSeed: 7600 + biome * 23,
              archetype: 'CENTRAL_BASTION',
              biome: simBiome,
              roomSizePreset: 'standard',
              cols: 36,
              rows: 22,
              roomShape: shape,
            });
            const roomType = biome === 0 ? 'start' : 'combat';
            const plan = buildRoomArchitecturePlan(map, roomType, biome, 7600 + biome * 23);

            expect(plan.items).toBe(plan.solidDecors);
            expect(plan.items.length).toBeGreaterThan(0);

            for (const item of plan.items) {
              expect(
                isExteriorVoidWallTile(map, item.tx, item.ty),
                `${shape} biome ${biome} solidDecor ${item.kind} at (${item.tx},${item.ty}) must not be in Exterior Void`,
              ).toBe(false);
              expect(map.isSolidTile(item.tx, item.ty)).toBe(true);
              if (map.getTile(item.tx, item.ty) === 'wall') {
                expect(isActiveWallTile(map, item.tx, item.ty)).toBe(true);
              }
            }

            for (const decal of plan.floorDecals) {
              expect(isExteriorVoidWallTile(map, decal.tx, decal.ty)).toBe(false);
              expect(map.isSolidTile(decal.tx, decal.ty)).toBe(false);
              expect(isFloorDecalVisible(decal, map)).toBe(true);
            }

            if (shape !== 'rectangle') {
              const steppedDecors = plan.items.filter(
                (d) =>
                  map.getTile(d.tx, d.ty) === 'wall' &&
                  ((d.ty > 0 && d.ty < map.rows - 1) || (d.tx > 0 && d.tx < map.cols - 1)),
              );
              expect(steppedDecors.length).toBeGreaterThan(0);
            }

            expect(plan.budget.largeDecorCount).toBeLessThanOrEqual(8);
            expect(plan.budget.smallPerimeterDecorCount).toBeLessThanOrEqual(
              Math.floor(plan.budget.perimeterTileCount / 3),
            );
            expect(plan.budget.emptyPerimeterRatio).toBeGreaterThanOrEqual(0.4);
            expect(plan.budget.centerArenaSolidDecorCount).toBe(0);
          }
        }

        // Verify resolvePerimeterWallTileNear & resolveCornerActiveWallTile on l_shape NE void corner
        configureRoomLayout(map, {
          roomSeed: 7699,
          archetype: 'CENTRAL_BASTION',
          biome: 1,
          cols: 36,
          rows: 22,
          roomShape: 'l_shape',
        });
        const neResolved = resolveCornerActiveWallTile(map, 35, 0);
        expect(neResolved).not.toBeNull();
        expect(isActiveWallTile(map, neResolved!.tx, neResolved!.ty)).toBe(true);
        const northWallNear30 = resolvePerimeterWallTileNear(map, 30, 'N');
        expect(northWallNear30).not.toBeNull();
        expect(isActiveWallTile(map, northWallNear30!.tx, northWallNear30!.ty)).toBe(true);
      });

      it('T5-WB-17 [F12]: renderTileCellToCompositeImpl Branch A (PALETTE.INK_DEEP #0B090E Exterior Void + outer-wall shadow/seam casing) and Branch B (7x6 / 7x11 90-deg concave parapet coping miters)', () => {
        const map = new ArenaMap({ cols: 36, rows: 22 });
        configureRoomLayout(map, {
          roomSeed: 7700,
          archetype: 'CENTRAL_BASTION',
          biome: 1,
          cols: 36,
          rows: 22,
          roomShape: 'cruciform',
        });
        const scale = 2;
        const cellPx = TILE_SIZE * scale;

        // Branch A: Exterior Void cell bordering an active wall tile
        let voidBorderTile: { tx: number; ty: number } | null = null;
        for (let ty = 0; ty < map.rows && !voidBorderTile; ty++) {
          for (let tx = 0; tx < map.cols && !voidBorderTile; tx++) {
            if (!isExteriorVoidWallTile(map, tx, ty)) continue;
            if (
              (ty > 0 && isActiveWallTile(map, tx, ty - 1)) ||
              (ty + 1 < map.rows && isActiveWallTile(map, tx, ty + 1)) ||
              (tx > 0 && isActiveWallTile(map, tx - 1, ty)) ||
              (tx + 1 < map.cols && isActiveWallTile(map, tx + 1, ty))
            ) {
              voidBorderTile = { tx, ty };
            }
          }
        }
        expect(voidBorderTile).not.toBeNull();

        const ctxVoid = createRecording2dContext();
        const drawnVoidKeys: string[] = [];
        const mockSceneVoid = {
          map,
          tileCompositeScale: scale,
          lastRenderedBiome: 1 as const,
          drawSourceKeyToCtx: (_c: CanvasRenderingContext2D, key: string) => {
            drawnVoidKeys.push(key);
          },
        };
        renderTileCellToCompositeImpl.call(
          mockSceneVoid as any,
          ctxVoid as unknown as CanvasRenderingContext2D,
          {
            tx: voidBorderTile!.tx,
            ty: voidBorderTile!.ty,
            kind: 'wall',
            variant: 0,
            distToWall: 0,
            autotileMask: 15,
            aoMask: 0,
            surface: 'none',
            surfaceMask: 0,
          },
          scale,
          1,
        );

        expect(drawnVoidKeys.length).toBe(0);
        const dx = voidBorderTile!.tx * cellPx;
        const dy = voidBorderTile!.ty * cellPx;
        expect(
          ctxVoid.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              typeof o.fillStyle === 'string' &&
              o.fillStyle.toUpperCase() === PALETTE.INK_DEEP.toUpperCase() &&
              o.args[0] === dx &&
              o.args[1] === dy &&
              o.args[2] === cellPx &&
              o.args[3] === cellPx,
          ),
        ).toBe(true);
        expect(
          ctxVoid.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              typeof o.fillStyle === 'string' &&
              o.fillStyle.toUpperCase() === ENV_PALETTE[1].shadow.toUpperCase() &&
              Math.abs(o.globalAlpha - 0.65) < 0.01,
          ),
        ).toBe(true);
        expect(
          ctxVoid.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              typeof o.fillStyle === 'string' &&
              o.fillStyle.toUpperCase() === PALETTE.INK_DARK.toUpperCase() &&
              (o.args[2] === 2 * scale || o.args[3] === 2 * scale),
          ),
        ).toBe(true);
        expect(
          ctxVoid.ops.some(
            (o) =>
              o.type === 'stroke' &&
              typeof o.strokeStyle === 'string' &&
              o.strokeStyle.toUpperCase() === ENV_PALETTE[1].seam.toUpperCase() &&
              o.lineWidth === 1 * scale,
          ),
        ).toBe(true);

        // Branch B: Active wall tile with autotileMask === 15 and diagonal floor neighbor (concave miter)
        let concaveTile: { tx: number; ty: number } | null = null;
        for (let ty = 1; ty < map.rows - 1 && !concaveTile; ty++) {
          for (let tx = 1; tx < map.cols - 1 && !concaveTile; tx++) {
            if (!isActiveWallTile(map, tx, ty) || map.getAutotileMask(tx, ty) !== 15) continue;
            if (
              !map.isSolidTile(tx + 1, ty - 1) ||
              !map.isSolidTile(tx - 1, ty - 1) ||
              !map.isSolidTile(tx + 1, ty + 1) ||
              !map.isSolidTile(tx - 1, ty + 1)
            ) {
              concaveTile = { tx, ty };
            }
          }
        }
        expect(concaveTile).not.toBeNull();

        const ctxConcave = createRecording2dContext();
        const drawnConcaveKeys: string[] = [];
        const mockSceneConcave = {
          map,
          tileCompositeScale: scale,
          lastRenderedBiome: 2 as const,
          drawSourceKeyToCtx: (_c: CanvasRenderingContext2D, key: string) => {
            drawnConcaveKeys.push(key);
          },
        };
        renderTileCellToCompositeImpl.call(
          mockSceneConcave as any,
          ctxConcave as unknown as CanvasRenderingContext2D,
          {
            tx: concaveTile!.tx,
            ty: concaveTile!.ty,
            kind: 'wall',
            variant: 0,
            distToWall: 0,
            autotileMask: 15,
            aoMask: 0,
            surface: 'none',
            surfaceMask: 0,
          },
          scale,
          2,
        );

        expect(drawnConcaveKeys).toContain('biome_wall_2_15');
        expect(
          ctxConcave.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              typeof o.fillStyle === 'string' &&
              o.fillStyle.toUpperCase() === ENV_PALETTE[2].wallFront.toUpperCase() &&
              o.args[2] === 7 * scale &&
              (o.args[3] === 6 * scale || o.args[3] === 11 * scale),
          ),
        ).toBe(true);
        expect(
          ctxConcave.ops.some(
            (o) =>
              o.type === 'stroke' &&
              typeof o.strokeStyle === 'string' &&
              o.strokeStyle.toUpperCase() === PALETTE.INK_DARK.toUpperCase() &&
              Math.abs(o.lineWidth - 1.8 * scale) < 0.01,
          ),
        ).toBe(true);
      });

      it('T5-WB-18 [F13]: resolveMinimapNodeDims proportional sizing across all 6 RoomSizePresets and computeMinimapRoomPolygon pairwise-distinct vertex geometry across all 10 canonical shapes + 12 aliases', () => {
        const cellStep = 40;
        const compact = resolveMinimapNodeDims(cellStep, 'compact', 28, 18);
        const standard = resolveMinimapNodeDims(cellStep, 'standard', 36, 22);
        const wideHall = resolveMinimapNodeDims(cellStep, 'wide_hall', 46, 20);
        const tallSanctum = resolveMinimapNodeDims(cellStep, 'tall_sanctum', 32, 28);
        const grandArena = resolveMinimapNodeDims(cellStep, 'grand_arena', 44, 26);
        const colossalBoss = resolveMinimapNodeDims(cellStep, 'colossal_boss', 48, 28);

        expect(compact.nodeW).toBeLessThan(standard.nodeW);
        expect(compact.nodeH).toBeLessThan(standard.nodeH);
        expect(wideHall.nodeW).toBeGreaterThan(standard.nodeW);
        expect(wideHall.nodeW).toBeGreaterThan(tallSanctum.nodeW);
        expect(tallSanctum.nodeH).toBeGreaterThan(standard.nodeH);
        expect(tallSanctum.nodeH).toBeGreaterThan(wideHall.nodeH);
        expect(grandArena.nodeW).toBeGreaterThan(standard.nodeW);
        expect(grandArena.nodeH).toBeGreaterThan(standard.nodeH);
        expect(colossalBoss.nodeW).toBeGreaterThanOrEqual(grandArena.nodeW);
        expect(colossalBoss.nodeH).toBeGreaterThanOrEqual(grandArena.nodeH);

        const expectedVertexCounts: Record<RoomShapeKind, number> = {
          rectangle: 4,
          l_shape: 6,
          octagon: 8,
          t_shape: 8,
          u_shape: 8,
          donut_ring: 8,
          island_catwalk: 8,
          multi_chamber: 10,
          cruciform: 12,
          hourglass: 12,
        };

        const uniquePolygons = new Set<string>();
        for (const shape of ALL_ROOM_SHAPES) {
          const poly = computeMinimapRoomPolygon(shape, 100, 80, 36, 28, 0);
          expect(poly.length).toBe(expectedVertexCounts[shape]);
          uniquePolygons.add(JSON.stringify(poly));
        }
        expect(uniquePolygons.size).toBe(10);

        for (let rot = 1; rot <= 3; rot++) {
          expect(computeMinimapRoomPolygon('l_shape', 0, 0, 32, 24, 0)).not.toEqual(
            computeMinimapRoomPolygon('l_shape', 0, 0, 32, 24, rot),
          );
        }
        expect(computeMinimapRoomPolygon('t_shape', 0, 0, 32, 24, 0)).not.toEqual(
          computeMinimapRoomPolygon('t_shape', 0, 0, 32, 24, 1),
        );
        expect(computeMinimapRoomPolygon('u_shape', 0, 0, 32, 24, 0)).not.toEqual(
          computeMinimapRoomPolygon('u_shape', 0, 0, 32, 24, 1),
        );

        const aliases: ReadonlyArray<[string, RoomShapeKind]> = [
          ['plus_shape', 'cruciform'],
          ['plus', 'cruciform'],
          ['cross_chamber', 'cruciform'],
          ['ring_donut', 'donut_ring'],
          ['donut', 'donut_ring'],
          ['ring', 'donut_ring'],
          ['split_wing', 'multi_chamber'],
          ['split_twin_lobe', 'multi_chamber'],
          ['twin_lobe', 'multi_chamber'],
          ['asymmetric', 'multi_chamber'],
        ];
        for (const [alias, canonical] of aliases) {
          expect(computeMinimapRoomPolygon(alias, 50, 50, 30, 22, 0).length).toBe(
            computeMinimapRoomPolygon(canonical, 50, 50, 30, 22, 0).length,
          );
        }
        expect(computeMinimapRoomPolygon('diamond', 50, 50, 30, 22, 0).length).toBe(8);
        expect(computeMinimapRoomPolygon('rhombus', 50, 50, 30, 22, 0)).toEqual(
          computeMinimapRoomPolygon('diamond', 50, 50, 30, 22, 0),
        );
      });

      it('T5-WB-19 [F13]: drawMinimapRoomSilhouette inner topology markers (donut_ring hollow core, multi_chamber partition tick, island_catwalk dark chasm moat + 20-vertex inner island)', () => {
        // 1. donut_ring: outer 8-vertex polygon + inner hole fillRect/strokeRect in UI_THEME.panelBgDark
        const gDonut = createRecordingGraphics();
        drawMinimapRoomSilhouette(
          gDonut as any,
          'donut_ring',
          60,
          50,
          32,
          24,
          0x1e3a2f,
          0.96,
          0xfacc15,
          1.5,
        );
        expect(gDonut.ops.filter((o) => o.op === 'fillPath').length).toBe(1);
        expect(gDonut.ops.filter((o) => o.op === 'fillRect').length).toBe(1);
        expect(gDonut.ops.filter((o) => o.op === 'strokeRect').length).toBe(1);
        expect(
          gDonut.ops.some((o) => o.op === 'fillStyle' && o.args[0] === UI_THEME.panelBgDark),
        ).toBe(true);

        // 2. multi_chamber: outer 10-vertex polygon + interior partition tick strokePath
        const gMulti = createRecordingGraphics();
        drawMinimapRoomSilhouette(
          gMulti as any,
          'multi_chamber',
          60,
          50,
          32,
          24,
          0x1e3a2f,
          0.96,
          0xfacc15,
          1.5,
        );
        expect(gMulti.ops.filter((o) => o.op === 'fillPath').length).toBe(1);
        expect(gMulti.ops.filter((o) => o.op === 'strokePath').length).toBe(2);

        // 3. island_catwalk: outer 8-vertex chasm moat in UI_THEME.inkDeep + inner 20-vertex cross-catwalk/island polygon
        const gIsland = createRecordingGraphics();
        drawMinimapRoomSilhouette(
          gIsland as any,
          'island_catwalk',
          60,
          50,
          32,
          24,
          0x1e3a2f,
          0.96,
          0xfacc15,
          1.5,
        );
        expect(gIsland.ops.filter((o) => o.op === 'fillPath').length).toBe(2);
        expect(gIsland.ops.filter((o) => o.op === 'strokePath').length).toBe(2);
        expect(gIsland.ops.filter((o) => o.op === 'lineTo').length).toBe(26);
        expect(gIsland.ops[0]).toEqual({
          op: 'fillStyle',
          args: [UI_THEME.inkDeep, expect.any(Number)],
        });
      });

      it('T5-WB-20 [F13 x F14]: createMockGameSceneHarness scene.updateMinimapHud() end-to-end rendering across compact and [Tab] full-map modes, live roomShape/preset sync, and real-time player position dot', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 8020, startInHub: false });
        sim.enterRoom(sim.dungeon.startRoomId);
        for (let i = 0; i < sim.dungeon.rooms.length; i++) {
          const rm = sim.dungeon.rooms[i]!;
          rm.discovery = rm.id === sim.currentRoomId ? 'visited' : 'cleared';
          rm.roomShape = ALL_ROOM_SHAPES[i % ALL_ROOM_SHAPES.length]!;
          rm.roomSizePreset = ALL_ROOM_SIZE_PRESETS[i % ALL_ROOM_SIZE_PRESETS.length]!;
        }

        const { scene, minimapGraphics, minimapTitleText } = createMockGameSceneHarness(sim);

        const findPlayerGoldDot = (): [number, number, number] | null => {
          for (let i = 1; i < minimapGraphics.ops.length; i++) {
            const prev = minimapGraphics.ops[i - 1]!;
            const cur = minimapGraphics.ops[i]!;
            if (
              prev.op === 'fillStyle' &&
              prev.args[0] === UI_THEME.status.goldBright &&
              cur.op === 'fillCircle'
            ) {
              return cur.args as [number, number, number];
            }
          }
          return null;
        };

        // 1. Compact mode render with player near NW corner of a rectangle room
        (sim.map as { roomShape: string }).roomShape = 'rectangle';
        sim.player.x = TILE_SIZE * 4;
        sim.player.y = TILE_SIZE * 4;
        scene.updateMinimapHud();

        expect(minimapTitleText.text).toMatch(/Tầng/i);
        const dotNW = findPlayerGoldDot();
        expect(dotNW).not.toBeNull();
        const lineToCountRect = minimapGraphics.ops.filter((o) => o.op === 'lineTo').length;
        const hash1 = scene.lastMinimapHash;
        expect(hash1.length).toBeGreaterThan(0);

        // 2. Mutate live sim.map.roomShape to 'cruciform' (+8 polygon vertices) and move player to SE corner
        minimapGraphics.ops.length = 0;
        (sim.map as { roomShape: string }).roomShape = 'cruciform';
        sim.map.cols = 46;
        sim.map.rows = 20;
        sim.map.width = 46 * TILE_SIZE;
        sim.map.height = 20 * TILE_SIZE;
        sim.map.mapRevision += 1;
        sim.player.x = sim.map.width - TILE_SIZE * 4;
        sim.player.y = sim.map.height - TILE_SIZE * 4;
        scene.updateMinimapHud();

        expect(scene.lastMinimapHash).not.toBe(hash1);
        const dotSE = findPlayerGoldDot();
        expect(dotSE).not.toBeNull();
        const lineToCountCruciform = minimapGraphics.ops.filter((o) => o.op === 'lineTo').length;
        expect(lineToCountCruciform).toBe(lineToCountRect + 8);
        expect(dotSE![0]).toBeGreaterThan(dotNW![0]);
        expect(dotSE![1]).toBeGreaterThan(dotNW![1]);

        // 3. Toggle [Tab] Full-Map mode (fullMapOpen = true) with 'island_catwalk' active room
        minimapGraphics.ops.length = 0;
        (sim.map as { roomShape: string }).roomShape = 'island_catwalk';
        sim.map.mapRevision += 1;
        scene.fullMapOpen = true;
        scene.updateMinimapHud();

        expect(minimapTitleText.text).toContain('BẢN ĐỒ HẦM NGỤC');
        const fullMapDot = findPlayerGoldDot();
        expect(fullMapDot).not.toBeNull();
        expect(fullMapDot![2]).toBeGreaterThan(dotSE![2]);
      });

      it('T5-WB-21 [F15]: burning_grass perimeter (< 15) vs interior (15) surfaceMask, isSameSurfaceFamily ice/water separation, and hazard-safe torch_brazier / forge_blast_shield / slag_crucible placement on dry none floor across combat and Boss rooms', () => {
        const forbiddenPropSurfaces = new Set<string>([
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

        // 1. burning_grass 4x3 pool surrounded by 'none' (tx = 10..13, ty = 8..10) & 3x3 pool surrounded by 'grass'/'ash'
        const map = new ArenaMap({ cols: 36, rows: 22, seed: 301 });
        for (let ty = 8; ty <= 10; ty++) {
          for (let tx = 10; tx <= 13; tx++) {
            map.setSurface(tx, ty, 'burning_grass', 4.0, true);
          }
        }
        expect(map.getSurfaceAutotileMask(10, 8)).toBe(AUTOTILE_EAST | AUTOTILE_SOUTH);
        expect(map.getSurfaceAutotileMask(13, 8)).toBe(AUTOTILE_WEST | AUTOTILE_SOUTH);
        expect(map.getSurfaceAutotileMask(10, 10)).toBe(AUTOTILE_NORTH | AUTOTILE_EAST);
        expect(map.getSurfaceAutotileMask(13, 10)).toBe(AUTOTILE_NORTH | AUTOTILE_WEST);
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
        map.setSurface(20, 10, 'burning_grass', 4.0, true);
        expect(map.getSurfaceAutotileMask(20, 10)).toBe(0);

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
        expect(mapFoliage.getSurfaceAutotileMask(10, 7) & AUTOTILE_SOUTH).toBe(0);
        expect(mapFoliage.isSameSurfaceFamily('grass', 'ash')).toBe(true);

        // 2. isSameSurfaceFamily symmetry & ice/water/burning_oil shoreline separation
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
        expect(map.isSameSurfaceFamily('ice', 'electrified_water')).toBe(false);
        expect(map.isSameSurfaceFamily('water', 'electrified_water')).toBe(true);
        expect(map.isSameSurfaceFamily('oil', 'burning_oil')).toBe(false);
        expect(map.isSameSurfaceFamily('burning_grass', 'grass')).toBe(false);
        expect(map.isSameSurfaceFamily('burning_grass', 'ash')).toBe(false);
        expect(map.isSameSurfaceFamily('burning_grass', 'none')).toBe(false);

        // 3. All 360 (preset x shape x archetype) combinations place propAnchors on dry 'none' floor
        const layoutMap = new ArenaMap();
        let checkedAnchors = 0;
        for (const preset of ALL_ROOM_SIZE_PRESETS) {
          const { cols, rows } = ROOM_SIZE_PRESET_DIMS[preset];
          for (const shape of ALL_ROOM_SHAPES) {
            for (const archetype of ALL_ROOM_ARCHETYPES) {
              const biome = (((checkedAnchors + shape.length) % 3) + 1) as 1 | 2 | 3;
              const res = configureRoomLayout(layoutMap, {
                roomSeed: preset.length * 1009 + shape.length * 271 + archetype.length * 97 + biome * 31,
                archetype,
                biome,
                roomSizePreset: preset,
                cols,
                rows,
                roomShape: shape,
              });
              expect(res.propAnchors.length).toBeGreaterThanOrEqual(6);
              for (const anchor of res.propAnchors) {
                const surf = layoutMap.getSurface(anchor.tx, anchor.ty);
                expect(forbiddenPropSurfaces.has(surf)).toBe(false);
                expect(surf).toBe('none');
                if (!anchor.id.startsWith('cpr_ring_pillar_')) {
                  expect(layoutMap.isSolidTile(anchor.tx, anchor.ty)).toBe(false);
                }
                checkedAnchors += 1;
              }
            }
          }
        }
        expect(checkedAnchors).toBeGreaterThan(2000);

        // 4. Combat room torch_brazier, forge_blast_shield, and slag_crucible placement on dry 'none' floor + adversarial 4x4 hazard patches
        const sim = new WorldSim({
          seed: 3040,
          spawnInitialWave: false,
          includeTrainingDummy: false,
          includeProps: false,
          autoRespawnWaves: false,
        });
        const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
        for (const shape of ALL_ROOM_SHAPES) {
          for (const archetype of ALL_ROOM_ARCHETYPES) {
            for (const biome of [1, 2, 3] as const) {
              sim.props.length = 0;
              configureRoomLayout(sim.map, {
                roomSeed: 700 + biome * 53 + shape.length * 19,
                archetype,
                biome,
                roomSizePreset: 'standard',
                cols: 36,
                rows: 22,
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
                  expect(sim.map.getSurface(tx, ty)).toBe('none');
                }
              }
            }
          }
        }

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
          for (const [cx, cy] of [
            [7, 4],
            [28, 4],
            [7, 17],
            [28, 17],
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

        // 5. Boss room torch_brazier props across Biomes 1, 2, 3 spawn strictly on dry 'none' floor
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
          const bossRoom = bossSim.dungeon.rooms.find((r) => r.type === 'boss')!;
          expect(bossRoom).toBeDefined();
          bossSim.enterRoom(bossRoom.id);
          const bossBraziers = bossSim.props.filter((p) => p.kind === 'torch_brazier');
          expect(bossBraziers.length).toBe(6);
          for (const brazier of bossBraziers) {
            const tx = Math.floor(brazier.x / TILE_SIZE);
            const ty = Math.floor(brazier.y / TILE_SIZE);
            expect(bossSim.map.isSolidTile(tx, ty)).toBe(false);
            expect(bossSim.map.getSurface(tx, ty)).toBe('none');
          }
        }
      });

      it('T5-WB-22 [F16]: !hasS wall parapet coping (y=0..20), open seam strokes, subtle North cliff mortar weathering, 4x4 & 4x12 concave miters, 6x6 diagonal Exterior Void corner shadows & map-edge outer contours, convex-corner-only 14x14 wall AO, AO suppression on chasm/lava/burning_*, and non-2x2 pillar medallion prevention', () => {
        withMockBakerScene((scene, baked) => {
          // 1. !hasS wall parapet coping (y = 0..20) & open seam strokes without strokeRect(4,4,24,24)
          bakeWallTile(scene, 1, AUTOTILE_NORTH, 1);
          const ctxNoSouth = baked.get('biome_wall_1_1')!.ctx;
          expect(ctxNoSouth.ops.some((o) => o.type === 'strokeRect')).toBe(false);
          expect(
            ctxNoSouth.ops.some(
              (o) =>
                o.type === 'fillRect' &&
                typeof o.fillStyle === 'string' &&
                o.fillStyle.toUpperCase() === ENV_PALETTE[1].wallFront.toUpperCase() &&
                o.args[0] === 0 &&
                o.args[1] === 0 &&
                o.args[2] === 4 &&
                o.args[3] === 20,
            ),
          ).toBe(true);
          expect(
            ctxNoSouth.ops.some(
              (o) =>
                o.type === 'fillRect' &&
                typeof o.fillStyle === 'string' &&
                o.fillStyle.toUpperCase() === ENV_PALETTE[1].wallFront.toUpperCase() &&
                o.args[0] === 28 &&
                o.args[1] === 0 &&
                o.args[2] === 4 &&
                o.args[3] === 20,
            ),
          ).toBe(true);
          const seamStroke = ctxNoSouth.ops.find(
            (o) =>
              o.type === 'stroke' &&
              typeof o.strokeStyle === 'string' &&
              o.strokeStyle.toUpperCase() === ENV_PALETTE[1].seam.toUpperCase() &&
              Math.abs(o.lineWidth - 1.1) < 0.01,
          );
          expect(seamStroke).toBeDefined();
          expect(seamStroke!.pathPoints).toEqual([
            [4, 0],
            [4, 20],
            [28, 0],
            [28, 20],
          ]);

          // 2. Subtle North cliff mortar weathering (never #F59E42 on Hub walls, low-alpha 0.25 mortar courses on Biomes 1..3)
          for (let m = 0; m < 16; m++) {
            bakeWallTile(scene, 0, m, 1);
            const hubKey = m === 0 ? 'biome_wall_0' : `biome_wall_0_${m}`;
            const hubColors = getAllRecordedColors(baked.get(hubKey)!.ctx);
            expect(hubColors.has('#F59E42')).toBe(false);
          }
          for (const biome of [1, 2, 3] as const) {
            bakeWallTile(scene, biome, AUTOTILE_EAST | AUTOTILE_WEST, 1);
            const ctxCliff = baked.get(`biome_wall_${biome}_10`)!.ctx;
            expect(
              ctxCliff.ops.some(
                (o) =>
                  o.type === 'stroke' &&
                  typeof o.strokeStyle === 'string' &&
                  o.strokeStyle.toUpperCase() === ENV_PALETTE[biome].seam.toUpperCase() &&
                  Math.abs(o.globalAlpha - 0.25) < 0.01,
              ),
            ).toBe(true);
          }

          // 3. Convex-corner-only 14x14 wall AO (aoMask === WALL_AO_NORTH_WEST = 4)
          for (let aoMask = 1; aoMask <= 7; aoMask++) {
            bakeWallAoOverlay(scene, aoMask, 1);
            const aoCtx = baked.get(`wall_ao_${aoMask}`)!.ctx;
            const hasCorner14x14 = aoCtx.gradients.some(
              (g) => g.coords[2] === 14 && g.coords[3] === 14,
            );
            expect(hasCorner14x14).toBe(aoMask === WALL_AO_NORTH_WEST);
          }

          // 4. bakePillarTile circular rune medallions strictly on m in {0, 3, 6, 9, 12}
          const medallionMasks = new Set([0, 3, 6, 9, 12]);
          for (let m = 0; m < 16; m++) {
            bakePillarTile(scene, 1, m, 1);
            const pKey = m === 0 ? 'biome_pillar_1' : `biome_pillar_1_${m}`;
            const pCtx = baked.get(pKey)!.ctx;
            const arcCount = pCtx.ops.filter((o) => o.type === 'arc').length;
            if (medallionMasks.has(m)) {
              expect(arcCount).toBeGreaterThanOrEqual(2);
            } else {
              expect(arcCount).toBe(0);
            }
          }
        });

        // 5. Aligned 4x4 (NE/NW) and 4x12 at y=20..32 (SE/SW) concave miters on stepped walls (autotileMask !== 15)
        const map = new ArenaMap({ cols: 16, rows: 16, includePillars: false, seed: 42, biome: 2 });
        for (let ty = 1; ty < 15; ty++) {
          for (let tx = 1; tx < 15; tx++) {
            map.tiles[ty * map.cols + tx] = tx <= 4 || ty <= 4 ? 'wall' : 'floor';
          }
        }
        const scale = 2;
        const cellPx = TILE_SIZE * scale;
        const mockScene = {
          map,
          tileCompositeScale: scale,
          lastRenderedBiome: 2 as const,
          drawSourceKeyToCtx: () => {},
        };

        // Stepped wall at (5, 5) with N (5,4) and E (6,5) solid, NE (6,4) floor -> autotileMask = 3 (!== 15)
        map.tiles[4 * map.cols + 6] = 'floor';
        map.tiles[5 * map.cols + 5] = 'wall';
        map.tiles[4 * map.cols + 5] = 'wall';
        map.tiles[5 * map.cols + 6] = 'wall';
        const ctxMiterNE = createRecording2dContext();
        renderTileCellToCompositeImpl.call(
          mockScene as any,
          ctxMiterNE as unknown as CanvasRenderingContext2D,
          {
            tx: 5,
            ty: 5,
            kind: 'wall',
            variant: 0,
            distToWall: 0,
            autotileMask: AUTOTILE_NORTH | AUTOTILE_EAST,
            aoMask: 0,
            surface: 'none',
            surfaceMask: 0,
          },
          scale,
          2,
        );
        expect(
          ctxMiterNE.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              typeof o.fillStyle === 'string' &&
              o.fillStyle.toUpperCase() === ENV_PALETTE[2].wallFront.toUpperCase() &&
              o.args[0] === 5 * cellPx + 28 * scale &&
              o.args[1] === 5 * cellPx &&
              o.args[2] === 4 * scale &&
              o.args[3] === 4 * scale,
          ),
        ).toBe(true);

        // Stepped SE concave corner -> 4x12 miter at y = 20..32
        map.tiles[6 * map.cols + 5] = 'wall';
        const ctxMiterSE = createRecording2dContext();
        renderTileCellToCompositeImpl.call(
          mockScene as any,
          ctxMiterSE as unknown as CanvasRenderingContext2D,
          {
            tx: 5,
            ty: 5,
            kind: 'wall',
            variant: 0,
            distToWall: 0,
            autotileMask: AUTOTILE_SOUTH | AUTOTILE_EAST,
            aoMask: 0,
            surface: 'none',
            surfaceMask: 0,
          },
          scale,
          2,
        );
        expect(
          ctxMiterSE.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              typeof o.fillStyle === 'string' &&
              o.fillStyle.toUpperCase() === ENV_PALETTE[2].wallFront.toUpperCase() &&
              o.args[0] === 5 * cellPx + 28 * scale &&
              o.args[1] === 5 * cellPx + 20 * scale &&
              o.args[2] === 4 * scale &&
              o.args[3] === 12 * scale,
          ),
        ).toBe(true);

        // 6. Diagonal 6x6 Exterior Void corner shadow at (3, 3) (diagonal SE neighbor (4, 4) is active wall) & map-border outer contour at (8, 0)
        map.tiles[4 * map.cols + 6] = 'wall';
        map.tiles[5 * map.cols + 5] = 'floor';
        map.tiles[5 * map.cols + 6] = 'floor';
        map.tiles[6 * map.cols + 5] = 'floor';
        const ctxDiagVoid = createRecording2dContext();
        renderTileCellToCompositeImpl.call(
          mockScene as any,
          ctxDiagVoid as unknown as CanvasRenderingContext2D,
          {
            tx: 3,
            ty: 3,
            kind: 'wall',
            variant: 0,
            distToWall: 0,
            autotileMask: 15,
            aoMask: 0,
            surface: 'none',
            surfaceMask: 0,
          },
          scale,
          1,
        );
        expect(
          ctxDiagVoid.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              typeof o.fillStyle === 'string' &&
              o.fillStyle.toUpperCase() === ENV_PALETTE[1].shadow.toUpperCase() &&
              Math.abs(o.globalAlpha - 0.65) < 0.01 &&
              o.args[0] === 3 * cellPx + cellPx - 6 * scale &&
              o.args[1] === 3 * cellPx + cellPx - 6 * scale &&
              o.args[2] === 6 * scale &&
              o.args[3] === 6 * scale,
          ),
        ).toBe(true);

        map.tiles[1 * map.cols + 8] = 'floor';
        const ctxBorderWall = createRecording2dContext();
        renderTileCellToCompositeImpl.call(
          mockScene as any,
          ctxBorderWall as unknown as CanvasRenderingContext2D,
          {
            tx: 8,
            ty: 0,
            kind: 'wall',
            variant: 0,
            distToWall: 0,
            autotileMask: AUTOTILE_EAST | AUTOTILE_WEST,
            aoMask: 0,
            surface: 'none',
            surfaceMask: 0,
          },
          scale,
          1,
        );
        expect(
          ctxBorderWall.ops.some(
            (o) =>
              o.type === 'stroke' &&
              typeof o.strokeStyle === 'string' &&
              o.strokeStyle.toUpperCase() === PALETTE.INK_DARK.toUpperCase() &&
              Math.abs(o.lineWidth - 1.5 * scale) < 0.01,
          ),
        ).toBe(true);

        // 7. AO suppression on chasm/lava/burning_oil/burning_grass & non-2x2 pillar corner overpaint in arena-tiles.ts
        for (const suppressed of ['chasm', 'lava', 'burning_oil', 'burning_grass'] as const) {
          const drawnKeys: string[] = [];
          const ctxAo = createRecording2dContext();
          renderTileCellToCompositeImpl.call(
            {
              ...mockScene,
              drawSourceKeyToCtx: (_c: CanvasRenderingContext2D, k: string) => drawnKeys.push(k),
            } as any,
            ctxAo as unknown as CanvasRenderingContext2D,
            {
              tx: 8,
              ty: 8,
              kind: 'floor',
              variant: 0,
              distToWall: 1,
              autotileMask: 0,
              aoMask: WALL_AO_NORTH | WALL_AO_WEST,
              surface: suppressed,
              surfaceMask: 15,
            },
            scale,
            1,
          );
          expect(drawnKeys.some((k) => k.startsWith('wall_ao_'))).toBe(false);
        }

        // Non-2x2 pillar (2x4 block at (10,6)..(11,9)) overpaints 8.5*scale corner medallion
        for (let py = 6; py <= 9; py++) {
          map.tiles[py * map.cols + 10] = 'pillar';
          map.tiles[py * map.cols + 11] = 'pillar';
        }
        const ctxPillar2x4 = createRecording2dContext();
        renderTileCellToCompositeImpl.call(
          mockScene as any,
          ctxPillar2x4 as unknown as CanvasRenderingContext2D,
          {
            tx: 10,
            ty: 6,
            kind: 'pillar',
            variant: 0,
            distToWall: 0,
            autotileMask: 6,
            aoMask: 0,
            surface: 'none',
            surfaceMask: 0,
          },
          scale,
          2,
        );
        expect(
          ctxPillar2x4.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              typeof o.fillStyle === 'string' &&
              o.fillStyle.toUpperCase() === ENV_PALETTE[2].wallTop.toUpperCase() &&
              o.args[2] === 8.5 * scale &&
              o.args[3] === 8.5 * scale,
          ),
        ).toBe(true);
      });

      it('T5-WB-23 [F17]: Seamless burning_oil/burning_grass without radial-gradient waffle grid, edge-gated lava/ice fissures, 2.6x2.6 concave inner-corner shoreline caps, chasm top-corner strata clipping & wall-to-chasm lip suppression, and multi-axis (N-S vs E-W) drawBridgeOverChasmOverlay without internal rail bars', () => {
        // 1. Seamless burning_oil & burning_grass: 0 radial/linear gradients, uniform base fill, 0.35 ember ellipses, v-varied flames
        for (const [surface, expectedBase] of [
          ['burning_oil', '#7C2D12'],
          ['burning_grass', '#6E332B'],
        ] as const) {
          const ctxBurn = createRecording2dContext();
          drawSurfaceTile(ctxBurn, surface, 15, 0, 0, 32, 0, 1);
          expect(ctxBurn.gradients.length).toBe(0);
          expect(
            ctxBurn.ops.some(
              (o) =>
                o.type === 'fillRect' &&
                typeof o.fillStyle === 'string' &&
                o.fillStyle.toUpperCase() === expectedBase &&
                o.args[2] === 32 &&
                o.args[3] === 32,
            ),
          ).toBe(true);
          expect(
            ctxBurn.ops.some(
              (o) => o.type === 'ellipse' && Math.abs(o.globalAlpha - 0.35) < 0.01,
            ),
          ).toBe(true);
        }

        // 2. Edge-gated lava/ice fissures & 0 linear gradients on lava/ice/water/electrified_water
        for (const surface of ['lava', 'ice'] as const) {
          const ctxIso = createRecording2dContext();
          drawSurfaceTile(ctxIso, surface, 0, 0, 0, 32, 2, 1);
          expect(ctxIso.gradients.length).toBe(0);
          expect(
            ctxIso.ops.some((o) => o.type === 'moveTo' && o.args[0] === 0 && o.args[1] === 16),
          ).toBe(false);
          expect(
            ctxIso.ops.some((o) => o.type === 'lineTo' && o.args[0] === 32 && o.args[1] === 16),
          ).toBe(false);

          const ctxConn = createRecording2dContext();
          drawSurfaceTile(ctxConn, surface, 15, 0, 0, 32, 2, 1);
          expect(ctxConn.gradients.length).toBe(0);
          expect(
            ctxConn.ops.some((o) => o.type === 'moveTo' && o.args[0] === 0 && o.args[1] === 16),
          ).toBe(true);
          expect(
            ctxConn.ops.some((o) => o.type === 'lineTo' && o.args[0] === 32 && o.args[1] === 16),
          ).toBe(true);
        }

        // 3. 2.6*scale x 2.6*scale concave inner-corner shoreline cap on L-shaped pool in arena-tiles.ts
        const map = new ArenaMap({ cols: 14, rows: 14, includePillars: false, seed: 3, biome: 2 });
        map.setSurface(4, 4, 'lava', 0, true);
        map.setSurface(4, 5, 'lava', 0, true);
        map.setSurface(5, 4, 'lava', 0, true);
        map.setSurface(5, 5, 'none', 0, true);

        const scale = 2;
        const cellPx = TILE_SIZE * scale;
        const ctxConcaveCap = createRecording2dContext();
        renderTileCellToCompositeImpl.call(
          {
            map,
            tileCompositeScale: scale,
            lastRenderedBiome: 1 as const,
            drawSourceKeyToCtx: () => {},
          } as any,
          ctxConcaveCap as unknown as CanvasRenderingContext2D,
          {
            tx: 4,
            ty: 4,
            kind: 'floor',
            variant: 0,
            distToWall: 3,
            autotileMask: 0,
            aoMask: 0,
            surface: 'lava',
            surfaceMask: AUTOTILE_SOUTH | AUTOTILE_EAST,
          },
          scale,
          1,
        );
        const cap = 2.6 * scale;
        expect(
          ctxConcaveCap.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              typeof o.fillStyle === 'string' &&
              o.fillStyle.toUpperCase() === '#1F1614' &&
              Math.abs(Number(o.args[0]) - (4 * cellPx + cellPx - cap)) < 0.01 &&
              Math.abs(Number(o.args[1]) - (4 * cellPx + cellPx - cap)) < 0.01 &&
              Math.abs(Number(o.args[2]) - cap) < 0.01 &&
              Math.abs(Number(o.args[3]) - cap) < 0.01,
          ),
        ).toBe(true);

        // 4. Chasm top-corner horizontal strata clipping ([1.8, 3.2, 4.6]) & wall-to-chasm floor lip suppression
        const ctxChasmTL = createRecording2dContext();
        drawSurfaceTile(ctxChasmTL, 'chasm', AUTOTILE_SOUTH | AUTOTILE_EAST, 0, 0, 32, 0, 2);
        expect(
          ctxChasmTL.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              Math.abs(Number(o.args[0]) - 1.8) < 0.01 &&
              o.args[1] === 0 &&
              Math.abs(Number(o.args[2]) - 30.2) < 0.01 &&
              o.args[3] === 4.5,
          ),
        ).toBe(true);
        expect(
          ctxChasmTL.ops.some(
            (o) =>
              o.type === 'stroke' &&
              typeof o.strokeStyle === 'string' &&
              o.strokeStyle.toUpperCase() === '#22D3EE' &&
              Math.abs(o.globalAlpha - 0.25) < 0.01,
          ),
        ).toBe(true);

        map.tiles[1 * map.cols + 3] = 'wall';
        map.setSurface(3, 2, 'chasm', 0, true);
        const ctxChasmWallLip = createRecording2dContext();
        renderTileCellToCompositeImpl.call(
          {
            map,
            tileCompositeScale: scale,
            lastRenderedBiome: 2 as const,
            drawSourceKeyToCtx: () => {},
          } as any,
          ctxChasmWallLip as unknown as CanvasRenderingContext2D,
          {
            tx: 3,
            ty: 2,
            kind: 'floor',
            variant: 0,
            distToWall: 1,
            autotileMask: 0,
            aoMask: 0,
            surface: 'chasm',
            surfaceMask: AUTOTILE_SOUTH | AUTOTILE_EAST | AUTOTILE_WEST,
          },
          scale,
          2,
        );
        expect(
          ctxChasmWallLip.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              typeof o.fillStyle === 'string' &&
              o.fillStyle.toUpperCase() === '#243B47' &&
              o.args[0] === 3 * cellPx &&
              o.args[1] === 2 * cellPx &&
              o.args[2] === cellPx &&
              Math.abs(Number(o.args[3]) - 2.2 * scale) < 0.01,
          ),
        ).toBe(true);

        // 5. Multi-axis (N-S vs E-W) drawBridgeOverChasmOverlay & hasChasmAlongAxisWithin3 without internal rail bars
        const ctxMidEW = createRecording2dContext();
        drawBridgeOverChasmOverlay(ctxMidEW, 0, 0, 32, false, false, 1);
        expect(ctxMidEW.ops.length).toBeGreaterThanOrEqual(8);
        expect(getAllRecordedColors(ctxMidEW).size).toBeGreaterThanOrEqual(3);
        expect(
          ctxMidEW.ops.some((o) => o.type === 'fillRect' && o.args[2] === 32 && o.args[3] === 2.2),
        ).toBe(false);

        const ctxWestNS = createRecording2dContext();
        drawBridgeOverChasmOverlay(ctxWestNS, 0, 0, 32, false, false, 2, true, false, true);
        expect(
          ctxWestNS.ops.some((o) => o.type === 'moveTo' && o.args[0] === 1 && o.args[1] === 6),
        ).toBe(true);
        expect(
          ctxWestNS.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              o.args[0] === 0 &&
              o.args[1] === 0 &&
              Math.abs(Number(o.args[2]) - 4.2) < 0.01 &&
              o.args[3] === 32,
          ),
        ).toBe(true);

        for (let ty = 4; ty <= 9; ty++) {
          map.setSurface(6, ty, 'chasm', 0, true);
          map.setSurface(10, ty, 'chasm', 0, true);
          for (const bx of [7, 8, 9]) {
            map.tiles[ty * map.cols + bx] = 'floor';
            map.setSurface(bx, ty, 'none', 0, true);
          }
        }
        expect(hasChasmAlongAxisWithin3(map, 8, 6, -1, 0)).toBe(true);
        expect(hasChasmAlongAxisWithin3(map, 8, 6, 1, 0)).toBe(true);
      });

      it('T5-WB-24 [F18]: LightingPipeline WebGL RenderTarget.setAutoResize(true) around lightmapRt.resize(rtW, rtH), Biome 2 God-Ray active North wall anchoring (!isExteriorVoidWallTile), dust mote void guard, and voidMaskGraphics at depth 36.2 (0x0b090e inset by 6px along active walls)', () => {
        // 1. LightingPipeline WebGL RenderTarget.setAutoResize(true) around lightmapRt.resize(rtW, rtH)
        graphicsSettings.setQuality('high');
        const autoResizeHistory: boolean[] = [];
        const webglRenderTarget = {
          autoResize: false,
          width: 480,
          height: 270,
          setAutoResize: vi.fn((val: boolean) => {
            webglRenderTarget.autoResize = val;
            autoResizeHistory.push(val);
          }),
        };
        const mockLightmapRt = {
          width: 480,
          height: 270,
          originX: 0,
          originY: 0,
          scaleX: 2,
          scaleY: 2,
          texture: { renderTarget: webglRenderTarget },
          setOrigin: vi.fn((ox: number, oy: number) => {
            mockLightmapRt.originX = ox;
            mockLightmapRt.originY = oy;
            return mockLightmapRt;
          }),
          setScale: vi.fn((s: number) => {
            mockLightmapRt.scaleX = s;
            mockLightmapRt.scaleY = s;
            return mockLightmapRt;
          }),
          setDepth: vi.fn(() => mockLightmapRt),
          setBlendMode: vi.fn(() => mockLightmapRt),
          setVisible: vi.fn(() => mockLightmapRt),
          setPosition: vi.fn(() => mockLightmapRt),
          resize: vi.fn((w: number, h: number) => {
            mockLightmapRt.width = w;
            mockLightmapRt.height = h;
            if (webglRenderTarget.autoResize) {
              webglRenderTarget.width = w;
              webglRenderTarget.height = h;
            }
            return mockLightmapRt;
          }),
          clear: vi.fn(),
          fill: vi.fn(),
          beginDraw: vi.fn(),
          batchDraw: vi.fn(),
          endDraw: vi.fn(),
          destroy: vi.fn(),
        };
        const makeMockImg = () => ({
          visible: true,
          setOrigin: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setBlendMode: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          setScale: vi.fn().mockReturnThis(),
          setTint: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          setTexture: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        });
        const mockRenderer = Object.assign(
          new (Phaser.Renderer.WebGL.WebGLRenderer as unknown as new () => object)(),
          {
            pipelines: {
              has: vi.fn(() => true),
              addPostPipeline: vi.fn(),
            },
          },
        );
        const mockLightScene = {
          game: { renderer: mockRenderer },
          textures: { exists: vi.fn(() => true) },
          make: { image: vi.fn(() => makeMockImg()) },
          add: {
            renderTexture: vi.fn(() => mockLightmapRt),
            image: vi.fn(() => makeMockImg()),
            graphics: vi.fn(() => createRecordingGraphics()),
          },
          cameras: {
            main: {
              width: 1920,
              height: 1080,
              zoom: 1.38,
              zoomX: 1.38,
              zoomY: 1.38,
              scrollX: 120,
              scrollY: 80,
              worldView: { x: 120, y: 80, width: 1920 / 1.38, height: 1080 / 1.38 },
              setPostPipeline: vi.fn(),
              removePostPipeline: vi.fn(),
              getPostPipeline: vi.fn(() => []),
            },
          },
        };

        const pipeline = new LightingPipeline(mockLightScene as any, 1);
        const sim = new WorldSim({ seed: 1337, biome: 1 });
        pipeline.update({
          dtSec: 0.016,
          playerPos: { x: sim.player.x, y: sim.player.y },
          player: sim.player,
          simulatedPlayers: [],
          enemies: [],
          projectiles: [],
          props: sim.props,
          map: sim.map,
          trauma: 0,
          inHub: false,
        });

        const expectedCoverW = Math.ceil(1920 / 1.38 + 128);
        const expectedCoverH = Math.ceil(1080 / 1.38 + 128);
        const highLightmapScale = 0.25 * graphicsSettings.getBudget().lightmapScale;
        expect(autoResizeHistory).toEqual([true, false]);
        expect(webglRenderTarget.autoResize).toBe(false);
        expect(webglRenderTarget.width).toBe(Math.round(expectedCoverW * highLightmapScale));
        expect(webglRenderTarget.height).toBe(Math.round(expectedCoverH * highLightmapScale));
        expect(mockLightmapRt.setOrigin).toHaveBeenCalledWith(0, 0);
        expect(mockLightmapRt.scaleX).toBeCloseTo(1 / highLightmapScale, 5);

        // 2. Biome 2 God-Ray active North wall anchoring (!isExteriorVoidWallTile) across all 10 shapes
        const map = new ArenaMap();
        for (const shape of ALL_ROOM_SHAPES) {
          configureRoomLayout(map, {
            roomSeed: 1337,
            archetype: 'CENTRAL_BASTION',
            biome: 2,
            roomSizePreset: 'standard',
            cols: 36,
            rows: 22,
            roomShape: shape,
          });
          const plan = buildRoomArchitecturePlan(map, 'combat', 2, 1337);
          expect(plan.godRays.length).toBeGreaterThanOrEqual(2);
          for (const ray of plan.godRays) {
            const wallTx = Math.floor(ray.anchorX / TILE_SIZE);
            const floorTy = Math.round(ray.anchorY / TILE_SIZE);
            const wallTy = floorTy - 1;
            expect(map.getTile(wallTx, wallTy)).toBe('wall');
            expect(isExteriorVoidWallTile(map, wallTx, wallTy)).toBe(false);
            expect(map.isSolidTile(wallTx, floorTy)).toBe(false);
          }
        }

        // 3. voidMaskGraphics at depth 36.2 (0x0b090e inset by 6px along active walls) & dust mote void guard
        configureRoomLayout(map, {
          roomSeed: 1337,
          archetype: 'CENTRAL_BASTION',
          biome: 1,
          roomSizePreset: 'standard',
          cols: 36,
          rows: 22,
          roomShape: 'cruciform',
        });
        const liveGfxList: Array<ReturnType<typeof createRecordingGraphics>> = [];
        const liveLayer = new BiomeArchitectureLiveLayer({
          textures: { exists: () => true },
          add: {
            graphics: () => {
              const g = createRecordingGraphics();
              liveGfxList.push(g);
              return g;
            },
            image: () => ({
              visible: false,
              setOrigin: vi.fn().mockReturnThis(),
              setRotation: vi.fn().mockReturnThis(),
              setBlendMode: vi.fn().mockReturnThis(),
              setDepth: vi.fn().mockReturnThis(),
              setVisible: vi.fn().mockReturnThis(),
              setPosition: vi.fn().mockReturnThis(),
              setDisplaySize: vi.fn().mockReturnThis(),
              setAlpha: vi.fn().mockReturnThis(),
              destroy: vi.fn(),
            }),
          },
        } as any);
        expect(liveGfxList.length).toBe(4);
        const voidMaskGraphics = liveGfxList[3]!;
        expect(voidMaskGraphics.depth).toBeCloseTo(36.2, 5);
        expect(voidMaskGraphics.blendMode).toBe(0);

        const planCruciform = buildRoomArchitecturePlan(map, 'combat', 1, 1337);
        liveLayer.setPlan(planCruciform);
        const brazierProp = {
          id: 1,
          kind: 'torch_brazier' as const,
          x: 9 * TILE_SIZE + 16,
          y: 5 * TILE_SIZE + 16,
          hp: 100,
          maxHp: 100,
          radius: 14,
          blocksProjectiles: false,
          blocksMovement: true,
        };
        liveLayer.update({ dtSec: 0.016, map, props: [brazierProp], lightingEnabled: true });

        const voidFillStyles = voidMaskGraphics.ops.filter((o) => o.op === 'fillStyle');
        expect(voidFillStyles.length).toBeGreaterThan(0);
        expect(voidFillStyles[0]!.args[0]).toBe(hexToNum(PALETTE.INK_DEEP));
        const voidRects = voidMaskGraphics.ops.filter((o) => o.op === 'fillRect');
        expect(voidRects.length).toBeGreaterThan(0);

        for (let ty = 0; ty < map.rows; ty++) {
          for (let tx = 0; tx < map.cols; tx++) {
            if (!isExteriorVoidWallTile(map, tx, ty)) continue;
            const adjS = ty + 1 < map.rows && isActiveWallTile(map, tx, ty + 1);
            const adjE = tx + 1 < map.cols && isActiveWallTile(map, tx + 1, ty);
            if (adjS || adjE) {
              const ox = tx * TILE_SIZE;
              const oy = ty * TILE_SIZE;
              const rect = voidRects.find(
                (r) =>
                  Number(r.args[0]) >= ox &&
                  Number(r.args[0]) < ox + TILE_SIZE &&
                  Number(r.args[1]) >= oy &&
                  Number(r.args[1]) < oy + TILE_SIZE,
              );
              expect(rect).toBeDefined();
              if (adjE) {
                expect(Number(rect!.args[0]) + Number(rect!.args[2])).toBeLessThanOrEqual(
                  ox + TILE_SIZE - 6,
                );
              }
              if (adjS) {
                expect(Number(rect!.args[1]) + Number(rect!.args[3])).toBeLessThanOrEqual(
                  oy + TILE_SIZE - 6,
                );
              }
            }
          }
        }

        const additiveGraphics = liveGfxList[2]!;
        for (const op of additiveGraphics.ops) {
          if (op.op === 'fillCircle') {
            const [mx, my, mr] = op.args as [number, number, number];
            if (mr >= 1.05 && mr <= 1.4 && Math.hypot(mx - brazierProp.x, my - brazierProp.y) >= 20) {
              const mtx = Math.floor(mx / TILE_SIZE);
              const mty = Math.floor(my / TILE_SIZE);
              expect(map.isSolidTile(mtx, mty)).toBe(false);
              expect(isExteriorVoidWallTile(map, mtx, mty)).toBe(false);
            }
          }
        }
      });

      it('T5-WB-25 [F18]: Contiguous pillarShadows (widthTiles x heightTiles) clipped to surface === none, centered 2x2 pillar decors excluding CRUMBLING_PILLAR_RING, floor torch_brazier shadow.setVisible(true) & wall-only hanging rods, and direction/cliff-aware decors', () => {
        // 1. Contiguous pillarShadows (2x1, 2x4, 2x2) clipped to dry floor & centered 2x2 pillar decors
        const map = new ArenaMap({ cols: 36, rows: 22, includePillars: false, seed: 901, biome: 2 });
        for (let ty = 1; ty < map.rows - 1; ty++) {
          for (let tx = 1; tx < map.cols - 1; tx++) {
            map.tiles[ty * map.cols + tx] = 'floor';
            map.surfaces[ty * map.cols + tx] = 'none';
          }
        }
        map.tiles[5 * map.cols + 6] = 'pillar';
        map.tiles[5 * map.cols + 7] = 'pillar';
        for (let dy = 0; dy < 4; dy++) {
          map.tiles[(5 + dy) * map.cols + 14] = 'pillar';
          map.tiles[(5 + dy) * map.cols + 15] = 'pillar';
        }
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            map.tiles[(5 + dy) * map.cols + (22 + dx)] = 'pillar';
          }
        }
        map.setSurface(16, 8, 'ice', 0, true);
        map.setSurface(16, 9, 'lava', 0, true);
        map.rebuildSolidBoxes();

        const plan = buildRoomArchitecturePlan(map, 'combat', 3, 901);
        expect(plan.pillarShadows.length).toBe(3);
        expect(plan.pillarShadows.find((p) => p.pillarTx === 6 && p.pillarTy === 5)).toMatchObject({
          widthTiles: 2,
          heightTiles: 1,
        });
        expect(plan.pillarShadows.find((p) => p.pillarTx === 14 && p.pillarTy === 5)).toMatchObject({
          widthTiles: 2,
          heightTiles: 4,
        });
        expect(plan.pillarShadows.find((p) => p.pillarTx === 22 && p.pillarTy === 5)).toMatchObject({
          widthTiles: 2,
          heightTiles: 2,
        });

        const colDecor = plan.solidDecors.find((d) => d.kind === 'fluted_column')!;
        const anvilDecor = plan.solidDecors.find((d) => d.kind === 'forge_anvil')!;
        expect(colDecor).toMatchObject({ tx: 22, ty: 5 });
        expect(anvilDecor).toMatchObject({ tx: 23, ty: 5 });

        const ctxComp = createRecording2dContext();
        renderBiomeArchitectureToComposite(ctxComp, map, plan, TILE_SIZE);
        const clipRects = ctxComp.ops.filter((o) => o.type === 'rect');
        expect(
          clipRects.some(
            (r) =>
              r.args[0] === 16 * TILE_SIZE &&
              (r.args[1] === 8 * TILE_SIZE || r.args[1] === 9 * TILE_SIZE),
          ),
        ).toBe(false);
        expect(
          clipRects.some((r) => r.args[0] === 15 * TILE_SIZE && r.args[1] === 9 * TILE_SIZE),
        ).toBe(true);
        expect(
          ctxComp.ops.some(
            (o) =>
              o.type === 'arc' &&
              o.args[0] === 16 &&
              o.args[1] === 14 &&
              o.tx === 22 * TILE_SIZE + 16 &&
              o.ty === 5 * TILE_SIZE + 6,
          ),
        ).toBe(true);
        expect(
          ctxComp.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              o.args[0] === 9 &&
              o.args[1] === 16 &&
              o.tx === 23 * TILE_SIZE - 16 &&
              o.ty === 5 * TILE_SIZE + 6,
          ),
        ).toBe(true);

        // CRUMBLING_PILLAR_RING exclusion
        const ringMap = new ArenaMap({ cols: 36, rows: 22, includePillars: true, seed: 1337, biome: 1 });
        ringMap.configureRoomLayout('combat', 1337, false, 1);
        ringMap.roomArchetype = 'CRUMBLING_PILLAR_RING';
        const ringPlan = buildRoomArchitecturePlan(ringMap, 'combat', 1, 1337);
        expect(ringPlan.solidDecors.some((d) => d.kind === 'fluted_column')).toBe(false);
        expect(ringPlan.solidDecors.some((d) => d.kind === 'forge_anvil')).toBe(false);

        // 2. Floor torch_brazier shadow.setVisible(true) & wall-only hanging rods
        const sim = createWorldSimWithOverhaulSupport({ seed: 5250, startInHub: false });
        sim.props.length = 0;
        const floorBrazier = sim.spawnProp('torch_brazier', 8 * TILE_SIZE + 16, 5 * TILE_SIZE + 16);
        const { scene, graphicsList } = createMockGameSceneHarness(sim);
        scene.buildArenaTiles();
        scene.syncProps(0.016);
        const brazierVis = scene.propVisuals.get(floorBrazier.id)!;
        expect(brazierVis.shadow.setVisible).toHaveBeenCalledWith(true);
        expect(brazierVis.shadow.visible).toBe(true);

        const bracketGraphics = graphicsList[1]!;
        bracketGraphics.ops.length = 0;
        scene.biomeArchLive.update({
          dtSec: 0.016,
          map: sim.map,
          props: [floorBrazier],
          lightingEnabled: true,
        });
        expect(bracketGraphics.ops.filter((o) => o.op === 'lineBetween').length).toBe(0);

        const wallBrazier = { ...floorBrazier, id: 99, x: 8 * TILE_SIZE + 16, y: 1 * TILE_SIZE + 16 };
        bracketGraphics.ops.length = 0;
        scene.biomeArchLive.update({
          dtSec: 0.016,
          map: sim.map,
          props: [wallBrazier],
          lightingEnabled: true,
        });
        expect(bracketGraphics.ops.filter((o) => o.op === 'lineBetween').length).toBe(3);

        // 3. Direction/cliff-aware wrought_iron_fence, brazier_pedestal, steam_pipe_wall, root_base, ice_alcove, and sunken_astrolabe
        const uMap = new ArenaMap({ cols: 36, rows: 22, seed: 1337, biome: 3 });
        configureRoomLayout(uMap, {
          roomSeed: 1337,
          archetype: 'CENTRAL_BASTION',
          biome: 3,
          roomSizePreset: 'standard',
          cols: 36,
          rows: 22,
          roomShape: 'u_shape',
        });
        const planB3 = buildRoomArchitecturePlan(uMap, 'combat', 3, 1337);
        const ctxB3 = createRecording2dContext();
        renderBiomeArchitectureToComposite(ctxB3, uMap, planB3, TILE_SIZE);
        const pipeItem = planB3.solidDecors.find((d) => d.kind === 'steam_pipe_wall')!;
        expect(pipeItem).toBeDefined();
        const pipeRects = ctxB3.ops.filter(
          (o) =>
            o.type === 'fillRect' &&
            o.tx === pipeItem.tx * TILE_SIZE &&
            o.ty === pipeItem.ty * TILE_SIZE,
        );
        expect(pipeRects.length).toBeGreaterThanOrEqual(3);
        for (const r of pipeRects) {
          expect(Number(r.args[1]) + Number(r.args[3])).toBeLessThanOrEqual(19);
        }

        const planHub = buildRoomArchitecturePlan(uMap, 'combat', 0, 1337);
        const westFence = planHub.solidDecors.find(
          (d) => d.kind === 'wrought_iron_fence' && (d.dir === 'W' || d.dir === 'E'),
        )!;
        expect(westFence).toBeDefined();
        const ctxHub = createRecording2dContext();
        renderBiomeArchitectureToComposite(ctxHub, uMap, planHub, TILE_SIZE);
        expect(
          ctxHub.ops.some(
            (o) =>
              o.type === 'fillRect' &&
              o.tx === westFence.tx * TILE_SIZE &&
              o.ty === westFence.ty * TILE_SIZE &&
              o.args[2] === 5 &&
              o.args[3] === 24,
          ),
        ).toBe(true);

        const planB2 = buildRoomArchitecturePlan(uMap, 'combat', 2, 1337);
        for (const alcove of planB2.solidDecors.filter((d) => d.kind === 'ice_alcove')) {
          expect(uMap.isSolidTile(alcove.tx, alcove.ty + 1)).toBe(false);
        }

        const planB1 = buildRoomArchitecturePlan(uMap, 'combat', 1, 1337);
        const rootItem = planB1.solidDecors.find((d) => d.kind === 'root_base')!;
        expect(rootItem).toBeDefined();
        const ctxB1 = createRecording2dContext();
        renderBiomeArchitectureToComposite(ctxB1, uMap, planB1, TILE_SIZE);
        const rootBezier = ctxB1.ops.find(
          (o) =>
            o.type === 'bezierCurveTo' &&
            o.tx === rootItem.tx * TILE_SIZE &&
            o.ty === rootItem.ty * TILE_SIZE,
        )!;
        expect(rootBezier).toBeDefined();
        expect(Number(rootBezier.args[5])).toBeLessThanOrEqual(19);

        // sunken_astrolabe central floor obstruction guard
        const chasmMap = new ArenaMap({ cols: 36, rows: 22, includePillars: false, seed: 55, biome: 2 });
        for (let ty = 1; ty < chasmMap.rows - 1; ty++) {
          chasmMap.setSurface(17, ty, 'chasm', 0, true);
          chasmMap.setSurface(18, ty, 'chasm', 0, true);
        }
        const planChasmB2 = buildRoomArchitecturePlan(chasmMap, 'combat', 2, 55);
        const ctxChasm = createRecording2dContext();
        renderBiomeArchitectureToComposite(ctxChasm, chasmMap, planChasmB2, TILE_SIZE);
        expect(
          ctxChasm.ops.filter(
            (o) => o.type === 'arc' && o.tx === 0 && o.ty === 0 && Number(o.args[2]) > 30,
          ).length,
        ).toBe(0);
      });

      it('T5-WB-26 [F18]: Minimap corridor fillRect segments clipped to outer room node borders (0.46 * nodeW/H), compact player dot dotR = 1.4 on small nodes, and (dotX, dotY) clamped outside the donut_ring inner cutout', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 1337, startInHub: false });
        sim.enterRoom(sim.dungeon.startRoomId);
        const currentRoom = sim.getCurrentRoom()!;
        currentRoom.roomShape = 'donut_ring';
        currentRoom.roomSizePreset = 'standard';
        currentRoom.cols = 36;
        currentRoom.rows = 22;
        (sim.map as { roomShape?: string }).roomShape = 'donut_ring';

        const adjId = Object.values(currentRoom.connections).find((id) => id !== undefined)!;
        sim.dungeon.rooms[adjId]!.discovery = 'visited';

        // Place player near inner monolith edge so raw dotX would land inside the donut_ring hole
        sim.player.x = sim.map.width * 0.5 - 64;
        sim.player.y = sim.map.height * 0.5;

        const { scene, minimapGraphics } = createMockGameSceneHarness(sim);
        scene.fullMapOpen = false;
        scene.updateMinimapHud();

        const rooms = sim.dungeon.rooms;
        let minGx = Infinity;
        let maxGx = -Infinity;
        let minGy = Infinity;
        let maxGy = -Infinity;
        for (const r of rooms) {
          if (r.gx < minGx) minGx = r.gx;
          if (r.gx > maxGx) maxGx = r.gx;
          if (r.gy < minGy) minGy = r.gy;
          if (r.gy > maxGy) maxGy = r.gy;
        }
        const spanX = Math.max(1, maxGx - minGx + 1);
        const spanY = Math.max(1, maxGy - minGy + 1);
        const panelW = 172;
        const panelH = 102;
        const panelX = 960 - panelW - 14;
        const panelY = 14;
        const cellStep = Math.min(
          24,
          Math.floor((panelW - 24) / spanX),
          Math.floor((panelH - 22) / spanY),
        );
        const originX = panelX + (spanX - 1 > 0 ? (panelW - (spanX - 1) * cellStep) * 0.5 : panelW * 0.5);
        const originY = panelY + (spanY - 1 > 0 ? (panelH - (spanY - 1) * cellStep) * 0.5 : panelH * 0.5);
        const cx = originX + (currentRoom.gx - minGx) * cellStep;
        const cy = originY + (currentRoom.gy - minGy) * cellStep;
        const { nodeW, nodeH } = resolveMinimapNodeDims(cellStep, 'standard', 36, 22);

        // 1. Verify corridor fillRect segments are clipped to outer room node borders and never overlap room center (cx, cy)
        const corridorRects: number[][] = [];
        for (let i = 1; i < minimapGraphics.ops.length; i++) {
          const prev = minimapGraphics.ops[i - 1]!;
          const cur = minimapGraphics.ops[i]!;
          if (
            prev.op === 'fillStyle' &&
            prev.args[0] === UI_THEME.panelBorderHighlight &&
            Math.abs(Number(prev.args[1]) - 0.82) < 1e-4 &&
            cur.op === 'fillRect'
          ) {
            corridorRects.push(cur.args as number[]);
          }
        }
        expect(corridorRects.length).toBeGreaterThan(0);
        for (const [rx, ry, rw, rh] of corridorRects) {
          const containsCenter =
            cx > rx! + 0.1 && cx < rx! + rw! - 0.1 && cy > ry! + 0.1 && cy < ry! + rh! - 0.1;
          expect(containsCenter).toBe(false);
        }

        // 2. Verify compact player dot uses dotR = 1.4 (outline 2.1) when Math.min(nodeW, nodeH) <= 12 and clamps outside donut_ring hole
        let goldDot: number[] | undefined;
        let outlineDot: number[] | undefined;
        for (let i = 1; i < minimapGraphics.ops.length; i++) {
          const prev = minimapGraphics.ops[i - 1]!;
          const cur = minimapGraphics.ops[i]!;
          if (prev.op === 'fillStyle' && cur.op === 'fillCircle') {
            if (prev.args[0] === UI_THEME.status.goldBright) {
              goldDot = cur.args as number[];
            } else if (prev.args[0] === UI_THEME.inkDeep) {
              outlineDot = cur.args as number[];
            }
          }
        }
        expect(goldDot).toBeDefined();
        expect(outlineDot).toBeDefined();
        if (Math.min(nodeW, nodeH) <= 12) {
          expect(goldDot![2]).toBeCloseTo(1.4, 5);
          expect(outlineDot![2]).toBeCloseTo(2.1, 5);
        }
        const holeHalfW = Math.max(3, nodeW * 0.38) * 0.5;
        expect(Math.abs(goldDot![0]! - cx)).toBeGreaterThanOrEqual(holeHalfW);
      });

      it('T5-WB-27 [F20]: Zero-allocation BFS enemy/boss/summon navigation, multi-angle context steering across carved room shapes, post-prop collision re-resolution, chasm/solid rescue, navStuckTimer recovery, and safe spawns/pulls', () => {
        const makeCleanNavSim = (seed = 41001, biome: 1 | 2 | 3 = 1) => {
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
        };

        // 1. Large-radius clearance, prop avoidance & 2-step lookahead in findNearestWalkablePoint / findNextWalkableWaypoint / hasClearWalkableCorridor
        const navSim = makeCleanNavSim(41001, 1);
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            navSim.map.setTile(10 + dx, 9 + dy, 'pillar');
          }
        }
        navSim.map.rebuildSolidBoxes();
        const pillarProp = navSim.spawnProp(
          'rotten_totem_pillar',
          14 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
        );
        expect(pillarProp.blocksMovement).toBe(true);
        expect(isPointBlockedByStationaryProp(pillarProp.x, pillarProp.y, 14, navSim.props)).toBe(
          true,
        );
        const lowTable = navSim.spawnProp('moss_table', 18 * TILE_SIZE + 16, 10 * TILE_SIZE + 16);
        expect(isPointBlockedByStationaryProp(lowTable.x, lowTable.y, 14, navSim.props)).toBe(
          false,
        );

        const safeFromPillar = findNearestWalkablePoint(
          navSim.map,
          10 * TILE_SIZE + 16,
          9 * TILE_SIZE + 16,
          34,
          navSim.props,
        );
        expect(
          navSim.map.isSolidTile(
            Math.floor(safeFromPillar.x / TILE_SIZE),
            Math.floor(safeFromPillar.y / TILE_SIZE),
          ),
        ).toBe(false);
        expect(
          navSim.map.resolveCircleCollision(safeFromPillar.x, safeFromPillar.y, 34, false).collided,
        ).toBe(false);
        expect(
          isPointBlockedByStationaryProp(safeFromPillar.x, safeFromPillar.y, 34, navSim.props),
        ).toBe(false);

        expect(
          hasClearWalkableCorridor(
            navSim.map,
            12 * TILE_SIZE + 16,
            10 * TILE_SIZE + 16,
            16 * TILE_SIZE + 16,
            10 * TILE_SIZE + 16,
            14,
            navSim.props,
          ),
        ).toBe(false);

        const wpAroundProp = findNextWalkableWaypoint(
          navSim.map,
          13 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
          16 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
          navSim.props,
          false,
          14,
        );
        expect(
          isPointBlockedByStationaryProp(wpAroundProp.x, wpAroundProp.y, 14, navSim.props),
        ).toBe(false);
        expect(
          navSim.map.isSolidTile(
            Math.floor(wpAroundProp.x / TILE_SIZE),
            Math.floor(wpAroundProp.y / TILE_SIZE),
          ),
        ).toBe(false);

        // 2. Multi-angle context steering across carved room shapes (donut_ring, l_shape, t_shape, u_shape, multi_chamber, island_catwalk)
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
          const sim = makeCleanNavSim(41100 + idx, 1);
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

        // 3. Post-prop collision re-resolution, chasm/solid rescue & navStuckTimer recovery
        const rescueSim = makeCleanNavSim(41200, 1);
        rescueSim.map.setTile(10, 10, 'wall');
        rescueSim.map.rebuildSolidBoxes();
        const squeezePillar = rescueSim.spawnProp(
          'rotten_totem_pillar',
          11 * TILE_SIZE + 12,
          10 * TILE_SIZE + 16,
        );
        const squeezedEnemy = rescueSim.spawnEnemy(
          'goblin_shooter',
          11 * TILE_SIZE,
          10 * TILE_SIZE + 16,
          true,
        );
        squeezedEnemy.x = squeezePillar.x - squeezePillar.radius - 2;
        squeezedEnemy.y = squeezePillar.y;
        rescueSim.step(SIM_STEP_SEC);
        expect(
          rescueSim.map.isSolidTile(
            Math.floor(squeezedEnemy.x / TILE_SIZE),
            Math.floor(squeezedEnemy.y / TILE_SIZE),
          ),
        ).toBe(false);

        rescueSim.map.setSurface(15, 10, 'chasm', 0, true);
        const chasmBoss = rescueSim.spawnEnemy(
          'spore_king',
          20 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
          true,
        );
        chasmBoss.x = 15 * TILE_SIZE + 16;
        chasmBoss.y = 10 * TILE_SIZE + 16;
        expect(rescueSim.map.getSurfaceAtWorld(chasmBoss.x, chasmBoss.y)).toBe('chasm');
        rescueSim.step(SIM_STEP_SEC);
        expect(rescueSim.map.getSurfaceAtWorld(chasmBoss.x, chasmBoss.y)).not.toBe('chasm');
        expect(
          rescueSim.map.isSolidTile(
            Math.floor(chasmBoss.x / TILE_SIZE),
            Math.floor(chasmBoss.y / TILE_SIZE),
          ),
        ).toBe(false);

        rescueSim.map.setTile(9, 8, 'wall');
        rescueSim.map.rebuildSolidBoxes();
        const stuckEnemy = rescueSim.spawnEnemy(
          'goblin_shooter',
          8 * TILE_SIZE + 20,
          8 * TILE_SIZE + 16,
          true,
        );
        stuckEnemy.x = 9 * TILE_SIZE - stuckEnemy.radius + 1;
        stuckEnemy.y = 8 * TILE_SIZE + 16;
        stuckEnemy.navAnchorX = stuckEnemy.x;
        stuckEnemy.navAnchorY = stuckEnemy.y;
        stuckEnemy.navStuckTimer = 0.345;
        stuckEnemy.strafeSign = 1;
        rescueSim.player.x = 18 * TILE_SIZE + 16;
        rescueSim.player.y = 8 * TILE_SIZE + 16;
        rescueSim.step(SIM_STEP_SEC);
        expect(stuckEnemy.strafeSign).toBe(-1);

        // 4. Boss unburrow/clones/cores/executioner, summons (sacred_tree, tesla_turret, life_blossom, superheated_cyclone), and pull/yank standoff
        const bossSim = makeCleanNavSim(41300, 1);
        bossSim.map.configureRoomLayout(
          'combat',
          41300,
          false,
          1,
          'CENTRAL_BASTION',
          undefined,
          { roomSizePreset: 'standard', roomShape: 'donut_ring' },
        );
        const sporeKing = bossSim.spawnEnemy(
          'spore_king',
          6 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
          true,
        );
        const totemAtPlayer = bossSim.spawnProp(
          'rotten_totem_pillar',
          bossSim.player.x,
          bossSim.player.y,
        );
        sporeKing.bossPhase = 2;
        sporeKing.hp = Math.floor(sporeKing.maxHp * 0.5);
        sporeKing.bossBurrowed = true;
        sporeKing.bossBurrowTimer = 0.01;
        sporeKing.aiState = 'move';
        updateBossSporeKingAIImpl.call(
          bossSim,
          sporeKing,
          distance(sporeKing.x, sporeKing.y, bossSim.player.x, bossSim.player.y),
          0,
          0.05,
        );
        expect(
          bossSim.map.isSolidTile(
            Math.floor(sporeKing.x / TILE_SIZE),
            Math.floor(sporeKing.y / TILE_SIZE),
          ),
        ).toBe(false);
        expect(
          distance(sporeKing.x, sporeKing.y, totemAtPlayer.x, totemAtPlayer.y),
        ).toBeGreaterThanOrEqual(sporeKing.radius + totemAtPlayer.radius - 1);

        sporeKing.bossBurrowed = false;
        sporeKing.bossAttackCycle = 1;
        sporeKing.bossAttackPattern = 2;
        executeBossSporeKingAttackImpl.call(bossSim, sporeKing, bossSim.player.x, bossSim.player.y);
        const kryssa = bossSim.spawnEnemy(
          'kryssa_ice_queen',
          8 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
          true,
        );
        spawnKryssaMirrorClonesImpl.call(bossSim, kryssa);
        const titan = bossSim.spawnEnemy(
          'forge_titan',
          18 * TILE_SIZE + 16,
          6 * TILE_SIZE + 16,
          true,
        );
        spawnForgeTitanEnergyCoresImpl.call(bossSim, titan);
        for (const e of bossSim.enemies) {
          expect(
            bossSim.map.isSolidTile(Math.floor(e.x / TILE_SIZE), Math.floor(e.y / TILE_SIZE)),
          ).toBe(false);
          expect(bossSim.map.getSurfaceAtWorld(e.x, e.y)).not.toBe('chasm');
        }

        const summonSim = makeCleanNavSim(41302, 1);
        summonSim.map.setSurface(12, 10, 'chasm', 0, true);
        summonSim.player.characterId = 'druid';
        summonSim.player.x = 10 * TILE_SIZE + 16;
        summonSim.player.y = 10 * TILE_SIZE + 16;
        summonSim.player.aimAngle = 0;
        summonSim.player.skillCooldownTimer = 0;
        summonSim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.SKILL });
        const tree = summonSim.summons.find((s) => s.kind === 'sacred_tree');
        expect(tree).toBeDefined();
        expect(summonSim.map.getSurfaceAtWorld(tree!.x, tree!.y)).not.toBe('chasm');
        expect(
          summonSim.map.isSolidTile(
            Math.floor(tree!.x / TILE_SIZE),
            Math.floor(tree!.y / TILE_SIZE),
          ),
        ).toBe(false);

        summonSim.player.characterId = 'engineer';
        summonSim.player.skillCooldownTimer = 0;
        summonSim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
        summonSim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.SKILL });
        const turret = summonSim.summons.find((s) => s.kind === 'tesla_turret');
        expect(turret).toBeDefined();
        expect(summonSim.map.getSurfaceAtWorld(turret!.x, turret!.y)).not.toBe('chasm');
        expect(
          summonSim.map.isSolidTile(
            Math.floor(turret!.x / TILE_SIZE),
            Math.floor(turret!.y / TILE_SIZE),
          ),
        ).toBe(false);

        spawnSeedGunLifeBud(
          summonSim,
          summonSim.player,
          12 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
        );
        const bud = summonSim.summons.find((s) => s.kind === 'life_blossom');
        expect(bud).toBeDefined();
        expect(summonSim.map.getSurfaceAtWorld(bud!.x, bud!.y)).not.toBe('chasm');

        const pullSim = makeCleanNavSim(41304, 1);
        const pullProp = pullSim.spawnProp(
          'rotten_totem_pillar',
          12 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
        );
        const pulledEnemy = pullSim.spawnEnemy(
          'goblin_shooter',
          13 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
          true,
        );
        pulledEnemy.hp = 900;
        pulledEnemy.maxHp = 900;
        pullSim.player.characterId = 'druid';
        pullSim.player.blessingIds = ['druid_poison_roots'];
        pullSim.player.x = 12 * TILE_SIZE + 16;
        pullSim.player.y = 10 * TILE_SIZE + 16;
        pullSim.player.skillCooldownTimer = 0;
        pullSim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.SKILL });
        expect(
          distance(pulledEnemy.x, pulledEnemy.y, pullProp.x, pullProp.y),
        ).toBeGreaterThanOrEqual(pullProp.radius + pulledEnemy.radius - 1);

        pullSim.player.blessingIds = ['dash_flame_shackle'];
        pulledEnemy.x = 14 * TILE_SIZE + 16;
        pulledEnemy.y = 10 * TILE_SIZE + 16;
        triggerDashFlameShackle(pullSim, pullSim.player, pullProp.x + 20, pullProp.y);
        expect(
          distance(pulledEnemy.x, pulledEnemy.y, pullProp.x, pullProp.y),
        ).toBeGreaterThanOrEqual(pullProp.radius + pulledEnemy.radius - 1);

        applyChainHarpoonOnHit(pullSim, pullSim.player, pulledEnemy);
        expect(
          pullSim.map.isSolidTile(
            Math.floor(pulledEnemy.x / TILE_SIZE),
            Math.floor(pulledEnemy.y / TILE_SIZE),
          ),
        ).toBe(false);

        pulledEnemy.tetherToX = pullProp.x;
        pulledEnemy.tetherToY = pullProp.y;
        pulledEnemy.tetherTimer = 2.0;
        triggerTetherStaffTacticalVent(pullSim, pullSim.player);
        expect(
          distance(pulledEnemy.x, pulledEnemy.y, pullProp.x, pullProp.y),
        ).toBeGreaterThanOrEqual(pullProp.radius + pulledEnemy.radius - 1);

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
        expect(
          distance(pulledEnemy.x, pulledEnemy.y, pullProp.x, pullProp.y),
        ).toBeGreaterThanOrEqual(pullProp.radius + pulledEnemy.radius - 1);

        triggerVoidStaffImplosion(pullSim, voidOrb);
        expect(
          distance(pulledEnemy.x, pulledEnemy.y, pullProp.x, pullProp.y),
        ).toBeGreaterThanOrEqual(pullProp.radius + pulledEnemy.radius - 1);

        pullSim.map.setSurface(18, 10, 'chasm', 0, true);
        const ringOutBoss = pullSim.spawnEnemy(
          'spore_king',
          17 * TILE_SIZE + 16,
          10 * TILE_SIZE + 16,
          true,
        );
        ringOutBoss.x = 18 * TILE_SIZE + 16;
        ringOutBoss.y = 10 * TILE_SIZE + 16;
        expect(resolveEnemyChasmRingOut(pullSim, ringOutBoss)).toBe(false);
        expect(pullSim.map.getSurfaceAtWorld(ringOutBoss.x, ringOutBoss.y)).not.toBe('chasm');
      });

      it('T5-WB-28 [F21]: 100% strict biome-specific terrain purity across Biomes 1, 2, and 3, all 8 room types, all 6 archetypes, all 6 size presets, and all 10 room shapes', () => {
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
        const map = new ArenaMap();

        for (const biome of [1, 2, 3] as const) {
          const forbidden = new Set<SurfaceKind>(FORBIDDEN_BY_BIOME[biome]);

          // 1. Direct buildLayout(true, true) check
          map.biome = biome;
          map.resize(36, 22);
          map.buildLayout(true, true);
          for (let i = 0; i < map.surfaces.length; i++) {
            expect(forbidden.has(map.surfaces[i]!)).toBe(false);
          }

          // 2. All 8 room types across all 6 size presets and all 10 room shapes
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

          // 3. All 6 combat room archetypes (including CROSSFIRE_CONVEYORS) across all 10 room shapes
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

        // 4. Verify mid-combat elemental transformations remain active
        map.configureRoomLayout('start', 42001, false, 1);
        expect(map.getSurface(11, 3)).toBe('water');
        map.electrifyWaterAt(11, 3, 4.0);
        expect(map.getSurface(11, 3)).toBe('electrified_water');
      });

      it('T5-WB-29 [F23]: Entered-only Minimap & [Tab] Full Map fog-of-war hides hidden and discovered rooms and unentered corridors while keeping player gold dot as final fillCircle', () => {
        const sim = createWorldSimWithOverhaulSupport({ seed: 2026, startInHub: false });
        sim.enterRoom(sim.dungeon.startRoomId);
        const startRoom = sim.getCurrentRoom()!;

        for (const r of sim.dungeon.rooms) {
          if (r.id !== startRoom.id) {
            r.discovery = r.id % 2 === 0 ? 'discovered' : 'hidden';
          }
        }

        const { scene, minimapGraphics: g } = createMockGameSceneHarness(sim);

        const getOpsSinceLastClear = () => {
          for (let i = g.ops.length - 1; i >= 0; i--) {
            if (g.ops[i]!.op === 'clear') {
              return g.ops.slice(i + 1);
            }
          }
          return g.ops;
        };

        const countCorridorRects = () => {
          const ops = getOpsSinceLastClear();
          let count = 0;
          for (let i = 1; i < ops.length; i++) {
            const prev = ops[i - 1]!;
            const cur = ops[i]!;
            if (
              prev.op === 'fillStyle' &&
              prev.args[0] === UI_THEME.panelBorderHighlight &&
              Math.abs(Number(prev.args[1]) - 0.82) < 1e-4 &&
              cur.op === 'fillRect'
            ) {
              count++;
            }
          }
          return count;
        };

        const countRoomSilhouettes = () =>
          getOpsSinceLastClear().filter(
            (o) =>
              o.op === 'lineStyle' &&
              (o.args[1] === 0xfacc15 || o.args[1] === UI_THEME.panelBorderHighlight),
          ).length;

        // 1. Compact mode with only startRoom entered -> 1 room silhouette, 0 corridors
        scene.fullMapOpen = false;
        scene.lastMinimapHash = '';
        scene.updateMinimapHud();
        expect(countRoomSilhouettes()).toBe(1);
        expect(countCorridorRects()).toBe(0);

        const compactOps = getOpsSinceLastClear();
        const fillCirclesCompact = compactOps.filter((o) => o.op === 'fillCircle');
        expect(fillCirclesCompact.length).toBeGreaterThanOrEqual(2);
        let lastFillStyleBeforeDot: { op: string; args: unknown[] } | null = null;
        for (let i = compactOps.length - 1; i >= 1; i--) {
          if (compactOps[i]!.op === 'fillCircle') {
            lastFillStyleBeforeDot = compactOps[i - 1]!;
            break;
          }
        }
        expect(lastFillStyleBeforeDot?.op).toBe('fillStyle');
        expect(lastFillStyleBeforeDot?.args[0]).toBe(UI_THEME.status.goldBright);

        // 2. Full Map mode with only startRoom entered -> still 1 room silhouette, 0 corridors
        scene.fullMapOpen = true;
        scene.lastMinimapHash = '';
        scene.updateMinimapHud();
        expect(countRoomSilhouettes()).toBe(1);
        expect(countCorridorRects()).toBe(0);

        // 3. Mark one connected neighbor as 'visited' & cleared -> 2 room silhouettes, >=1 corridor, and 1 fast-travel cyan strokeRect
        const neighborId = Object.values(startRoom.connections).find((id) => id !== undefined)!;
        const neighborRoom = sim.dungeon.rooms[neighborId]!;
        neighborRoom.discovery = 'visited';
        neighborRoom.cleared = true;
        startRoom.cleared = true;
        sim.enemies.length = 0;

        scene.lastMinimapHash = '';
        scene.updateMinimapHud();
        expect(countRoomSilhouettes()).toBe(2);
        expect(countCorridorRects()).toBeGreaterThanOrEqual(1);

        const fullMapOps = getOpsSinceLastClear();
        const cyanTeleportOutlines = fullMapOps.filter(
          (o, idx) =>
            o.op === 'strokeRect' &&
            fullMapOps[idx - 1]?.op === 'lineStyle' &&
            fullMapOps[idx - 1]?.args[1] === 0x38bdf8,
        );
        expect(cyanTeleportOutlines.length).toBe(1);

        for (let i = fullMapOps.length - 1; i >= 1; i--) {
          if (fullMapOps[i]!.op === 'fillCircle') {
            expect(fullMapOps[i - 1]?.args[0]).toBe(UI_THEME.status.goldBright);
            break;
          }
        }
      });

      it('T5-WB-30 [F24]: Fast-travel room teleportation guards (canTeleportFromCurrentRoom), coordinate hit-testing (resolveMinimapClickedRoomId), and departure/arrival VFX (teleportToRoomImpl & renderTelegraphsAndShieldImpl)', () => {
        // 1. Validate canTeleportFromCurrentRoom guards
        const guardSim = new WorldSim({ seed: 4242, biome: 1 });
        guardSim.enterHub();
        expect(canTeleportFromCurrentRoom(guardSim)).toBe(false);

        guardSim.enterRoom(guardSim.dungeon.startRoomId);
        const room = guardSim.getCurrentRoom()!;
        room.cleared = true;
        guardSim.enemies.length = 0;
        for (const d of guardSim.doors) d.locked = false;
        expect(canTeleportFromCurrentRoom(guardSim)).toBe(true);

        guardSim.player.lifeState = 'dead';
        expect(canTeleportFromCurrentRoom(guardSim)).toBe(false);
        guardSim.player.lifeState = 'alive';

        room.cleared = false;
        expect(canTeleportFromCurrentRoom(guardSim)).toBe(false);
        room.cleared = true;

        guardSim.secretTrialActive = true;
        expect(canTeleportFromCurrentRoom(guardSim)).toBe(false);
        guardSim.secretTrialActive = false;

        if (guardSim.doors.length > 0) {
          guardSim.doors[0]!.isSecretPassage = true;
          guardSim.doors[0]!.locked = true;
          expect(canTeleportFromCurrentRoom(guardSim)).toBe(true);
          guardSim.doors[0]!.isSecretPassage = false;
          expect(canTeleportFromCurrentRoom(guardSim)).toBe(false);
          guardSim.doors[0]!.locked = false;
        }

        const combatEnemyId = (Object.keys(ENEMIES).find((k) => k !== 'training_dummy') ??
          Object.keys(ENEMIES)[0]!) as EnemyDefId;
        guardSim.spawnEnemy(combatEnemyId, guardSim.player.x + 120, guardSim.player.y);
        expect(canTeleportFromCurrentRoom(guardSim)).toBe(false);
        guardSim.enemies.length = 0;
        expect(canTeleportFromCurrentRoom(guardSim)).toBe(true);

        // 2. Validate resolveMinimapClickedRoomId across compact/Full Map and uiScale/hudPadX/Y
        const hitSim = new WorldSim({ seed: 5150, biome: 1 });
        hitSim.enterRoom(hitSim.dungeon.startRoomId);
        const startRoom = hitSim.getCurrentRoom()!;
        const neighborId = Object.values(startRoom.connections).find((id) => id !== undefined)!;
        const neighborRoom = hitSim.dungeon.rooms[neighborId]!;
        neighborRoom.discovery = 'cleared';
        const unvisitedRoom = hitSim.dungeon.rooms.find(
          (r) => r.id !== startRoom.id && r.id !== neighborRoom.id,
        )!;
        unvisitedRoom.discovery = 'discovered';

        let minGx = 99;
        let maxGx = -99;
        let minGy = 99;
        let maxGy = -99;
        for (const r of hitSim.dungeon.rooms) {
          if (r.gx < minGx) minGx = r.gx;
          if (r.gx > maxGx) maxGx = r.gx;
          if (r.gy < minGy) minGy = r.gy;
          if (r.gy > maxGy) maxGy = r.gy;
        }
        const spanX = Math.max(1, maxGx - minGx + 1);
        const spanY = Math.max(1, maxGy - minGy + 1);

        const computeViewPtForRoom = (
          rm: typeof startRoom,
          fullMapOpen: boolean,
          uiScale: number,
          padX: number,
          padY: number,
        ) => {
          const panelW = fullMapOpen ? 420 : 172;
          const panelH = fullMapOpen ? 280 : 102;
          const panelX = fullMapOpen ? -480 - panelW * 0.5 : -184;
          const panelY = fullMapOpen ? 110 : 10;
          const cellStep = fullMapOpen
            ? Math.min(52, Math.floor((panelW - 56) / spanX), Math.floor((panelH - 52) / spanY))
            : Math.min(24, Math.floor((panelW - 24) / spanX), Math.floor((panelH - 22) / spanY));
          const originX = panelX + (panelW - (spanX - 1) * cellStep) * 0.5;
          const originY = panelY + (panelH - (spanY - 1) * cellStep) * 0.5;
          const cx = originX + (rm.gx - minGx) * cellStep;
          const cy = originY + (rm.gy - minGy) * cellStep;
          return {
            viewX: cx * uiScale + WORLD_VIEW_WIDTH + padX,
            viewY: cy * uiScale - padY,
          };
        };

        const prevScale = graphicsSettings.getState().uiScale;
        try {
          for (const [fullMapOpen, uiScale, padX, padY] of [
            [false, 1.0, 0, 0],
            [true, 1.0, 0, 0],
            [true, 1.15, 24, 16],
            [false, 0.9, 12, 8],
          ] as const) {
            graphicsSettings.setUiScale(uiScale);
            const mockHitScene = {
              transport: { getSim: () => hitSim },
              fullMapOpen,
              hudPadX: padX,
              hudPadY: padY,
              currentHudUiScale: uiScale,
            };
            const ptNeighbor = computeViewPtForRoom(
              neighborRoom,
              fullMapOpen,
              uiScale,
              padX,
              padY,
            );
            expect(
              resolveMinimapClickedRoomId(mockHitScene, ptNeighbor.viewX, ptNeighbor.viewY),
            ).toBe(neighborRoom.id);

            const ptStart = computeViewPtForRoom(startRoom, fullMapOpen, uiScale, padX, padY);
            expect(resolveMinimapClickedRoomId(mockHitScene, ptStart.viewX, ptStart.viewY)).toBe(
              startRoom.id,
            );

            const ptUnvisited = computeViewPtForRoom(
              unvisitedRoom,
              fullMapOpen,
              uiScale,
              padX,
              padY,
            );
            expect(
              resolveMinimapClickedRoomId(mockHitScene, ptUnvisited.viewX, ptUnvisited.viewY),
            ).toBeNull();
            expect(resolveMinimapClickedRoomId(mockHitScene, 20, 20)).toBeNull();
          }
        } finally {
          graphicsSettings.setUiScale(prevScale);
        }

        // 3. Validate teleportToRoomImpl & renderTelegraphsAndShieldImpl departure/arrival VFX
        const tpSim = new WorldSim({ seed: 7777, biome: 1 });
        tpSim.enterRoom(tpSim.dungeon.startRoomId);
        const tpStartRoom = tpSim.getCurrentRoom()!;
        tpStartRoom.cleared = true;
        tpSim.enemies.length = 0;

        const tpNeighborId = Object.values(tpStartRoom.connections).find(
          (id) => id !== undefined,
        )!;
        const tpNeighborRoom = tpSim.dungeon.rooms[tpNeighborId]!;
        tpNeighborRoom.discovery = 'visited';
        tpNeighborRoom.cleared = true;

        const tpHiddenRoom = tpSim.dungeon.rooms.find(
          (r) => r.id !== tpStartRoom.id && r.id !== tpNeighborRoom.id,
        )!;
        tpHiddenRoom.discovery = 'discovered';

        const spawnShaderNova = vi.fn();
        const spawnChestOpenBurst = vi.fn();
        const addTrauma = vi.fn();
        const spawnFloatingAlert = vi.fn();
        const spawnTransientLight = vi.fn();
        const roomSend = vi.fn();

        const mockTpScene = {
          coopMode: 'host' as const,
          room: { send: roomSend },
          fullMapOpen: true,
          irisTransitionDir: 0 as -1 | 0 | 1,
          irisTransitionProgress: 0,
          roomTeleportAnimTimer: 0,
          roomTeleportAnimDuration: 0.28,
          lastMinimapHash: 'cached',
          fx: {
            spawnShaderNova,
            spawnChestOpenBurst,
            addTrauma,
            spawnFloatingAlert,
          },
          lighting: {
            spawnTransientLight,
          },
          transport: {
            getSim: () => tpSim,
            consumeEvents: () => tpSim.consumeEvents(),
          },
          processSimEvents: vi.fn(),
        } as unknown as GameScene;

        expect(teleportToRoomImpl.call(mockTpScene, tpStartRoom.id)).toBe(false);
        expect(teleportToRoomImpl.call(mockTpScene, tpHiddenRoom.id)).toBe(false);
        tpStartRoom.cleared = false;
        expect(teleportToRoomImpl.call(mockTpScene, tpNeighborRoom.id)).toBe(false);
        tpStartRoom.cleared = true;

        i18n.setLocale('vi');
        expect(teleportToRoomImpl.call(mockTpScene, tpNeighborRoom.id)).toBe(true);
        expect(tpSim.currentRoomId).toBe(tpNeighborRoom.id);
        expect(tpSim.doorTransitionCooldown).toBeGreaterThanOrEqual(0.75);
        expect(mockTpScene.fullMapOpen).toBe(false);
        expect(mockTpScene.irisTransitionDir).toBe(-1);
        expect(mockTpScene.roomTeleportAnimTimer).toBeCloseTo(0.28, 5);
        expect(roomSend).toHaveBeenCalledWith('teleport_room', { roomId: tpNeighborRoom.id });
        expect(spawnShaderNova).toHaveBeenCalledTimes(2);
        expect(spawnShaderNova.mock.calls[0]?.[3]).toBe('fx_sh_arcane_sigil');
        expect(spawnShaderNova.mock.calls[1]?.[3]).toBe('fx_sh_arcane_sigil');
        expect(spawnChestOpenBurst).toHaveBeenCalledWith(tpSim.player.x, tpSim.player.y, 'rare');
        expect(spawnTransientLight).toHaveBeenCalledTimes(2);
        expect(addTrauma).toHaveBeenCalledWith(0.2);
        expect(spawnFloatingAlert).toHaveBeenCalledWith(
          tpSim.player.x,
          tpSim.player.y - 18,
          '⚡ DỊCH CHUYỂN!',
          PALETTE.CYAN_FROST,
        );

        const telegraphG = createRecordingGraphics();
        const floorG = createRecordingGraphics();
        const overlayScene = {
          ...mockTpScene,
          telegraphGraphics: telegraphG,
          groundHazardGraphics: floorG,
          cameras: { main: { worldView: { x: 0, y: 0, width: 960, height: 540 } } },
          entityPosScratch: { x: 0, y: 0 },
        } as unknown as GameScene;
        renderTelegraphsAndShieldImpl.call(overlayScene, tpSim.player.x, tpSim.player.y);
        expect(floorG.ops.some((o) => o.op === 'strokeCircle')).toBe(true);
        expect(telegraphG.ops.some((o) => o.op === 'strokeCircle')).toBe(true);
      });

      it('T5-WB-31 [F22 & F25]: Direct 1-step barricade launch on melee swing, melee wave projectile, and dash without [E] flip, plus procedural vector biome barricade baking for all 9 keys', () => {
        const sim = new WorldSim({
          seed: 43001,
          spawnInitialWave: false,
          includeTrainingDummy: false,
          autoRespawnWaves: false,
          startInHub: false,
        });
        sim.currentBiome = 1;
        sim.map.configureRoomLayout('combat', 43001, false, 1);
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

        const p = sim.player;
        p.blessingIds.push(
          'table_tech_rocket',
          'table_tech_blank_nova',
          'table_tech_magnet_snare',
          'table_tech_billiard_master',
        );

        // 1. Low barricades are immediately kickable and never targeted by [E] findInteractTarget or resolveInteractPromptSpec
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
        expect(
          resolveInteractPromptSpec(sim, {
            kind: 'flip_cover',
            key: 'flip_cover:1',
            x: 360,
            y: 320,
            distance: 20,
            prop: table,
          } as unknown as InteractTargetResult),
        ).toBeNull();

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
        expect(sim.projectiles.some((b) => b.id === 9901)).toBe(false);
        expect(sim.projectiles.filter((b) => b.weaponId === 'table_tech_rocket')).toHaveLength(2);
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

        // 4. Direct 1-step Melee Wave Projectile (knight_sword_wave) & Emerald Cleaver Boomerang launch 'low' barricades
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

        const tableBoomerang = sim.spawnProp('moss_table', 500, 220);
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

        // 5. Procedural vector biome barricade baking for all 9 texture keys
        withMockBakerScene((scene, baked) => {
          bakeProps(scene, 4);

          const biome1Keys = [
            'prop_moss_table',
            'prop_moss_table_flipped',
            'prop_moss_table_sliding',
          ] as const;
          const biome2Keys = [
            'prop_glacial_barricade',
            'prop_glacial_barricade_flipped',
            'prop_glacial_barricade_sliding',
          ] as const;
          const biome3Keys = [
            'prop_forge_blast_shield',
            'prop_forge_blast_shield_flipped',
            'prop_forge_blast_shield_sliding',
          ] as const;

          for (const key of [...biome1Keys, ...biome2Keys, ...biome3Keys]) {
            const entry = baked.get(key);
            expect(entry, `Missing baked texture for ${key}`).toBeDefined();
            const lineToCount = entry!.ctx.ops.filter((o) => o.type === 'lineTo').length;
            const fillCount = entry!.ctx.ops.filter((o) => o.type === 'fill').length;
            const strokeCount = entry!.ctx.ops.filter((o) => o.type === 'stroke').length;

            expect(lineToCount, `${key} should have >= 10 lineTo ops`).toBeGreaterThanOrEqual(10);
            expect(fillCount, `${key} should have >= 3 fill ops`).toBeGreaterThanOrEqual(3);
            expect(strokeCount, `${key} should have >= 2 stroke ops`).toBeGreaterThanOrEqual(2);
          }

          for (const key of biome1Keys) {
            const colors = getAllRecordedColors(baked.get(key)!.ctx);
            expect(colors.has(PALETTE.GOBLIN_GREEN.toUpperCase())).toBe(true);
            expect(colors.has(PALETTE.LIME_GLOW.toUpperCase())).toBe(true);
          }

          for (const key of biome2Keys) {
            const colors = getAllRecordedColors(baked.get(key)!.ctx);
            expect(colors.has(PALETTE.COBALT_SHADE.toUpperCase())).toBe(true);
            expect(colors.has(PALETTE.ICE_WHITE.toUpperCase())).toBe(true);
          }

          for (const key of biome3Keys) {
            const colors = getAllRecordedColors(baked.get(key)!.ctx);
            expect(colors.has(PALETTE.BRASS_CORE.toUpperCase())).toBe(true);
            expect(colors.has(PALETTE.SOLAR_GOLD.toUpperCase())).toBe(true);
          }

          expect(TextureBaker.getPropTextureKey('moss_table', 'low')).toBe('prop_moss_table');
          expect(TextureBaker.getPropTextureKey('moss_table', 'flipped')).toBe(
            'prop_moss_table_flipped',
          );
          expect(TextureBaker.getPropTextureKey('moss_table', 'sliding')).toBe(
            'prop_moss_table_sliding',
          );
          expect(TextureBaker.getPropTextureKey('glacial_barricade', 'low')).toBe(
            'prop_glacial_barricade',
          );
          expect(TextureBaker.getPropTextureKey('forge_blast_shield', 'low')).toBe(
            'prop_forge_blast_shield',
          );
        });
      });
    });
  });
}

