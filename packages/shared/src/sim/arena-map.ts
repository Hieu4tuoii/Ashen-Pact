import { SeededRandom } from '../core/prng.js';
import type { CardinalDir, RoomType } from '../data/types.js';
import { TILE_SIZE } from '../protocol/messages.js';
import { type AABB, clamp, resolveCircleVsAABB } from '../math/vec2.js';
import {
  type RoomArchetypeId,
  type RoomInteriorShape,
  type RoomLayoutOptions,
  type RoomLayoutResult,
  type RoomPropAnchor,
  type RoomShapeKind,
  type RoomSizePreset,
  ROOM_SIZE_PRESET_DIMS,
  applyRoomInteriorShape,
  configureRoomLayout as configureArchetypeRoomLayout,
  getDoorVestibuleRectsForMap,
  selectCombatRoomArchetype,
} from './arena-room-archetypes.js';
export {
  ALL_ROOM_ARCHETYPES,
  ALL_ROOM_INTERIOR_SHAPES,
  ALL_ROOM_SHAPES,
  ALL_ROOM_SIZE_PRESETS,
  DOOR_TILES,
  DOOR_VESTIBULE_RECTS,
  P0B_COMBAT_ARCHETYPES,
  PHASE0B_ROOM_ARCHETYPES,
  ROOM_SIZE_PRESET_DIMS,
  ROOM_SIZE_PRESETS,
  type RoomArchetypeId,
  type RoomInteriorShape,
  type RoomLayoutOptions,
  type RoomLayoutResult,
  type RoomPropAnchor,
  type RoomPropAnchorRole,
  type RoomShapeKind,
  type RoomSizePreset,
  applyRoomInteriorShape,
  areActiveDoorsConnectedBfs,
  computeTwinBridgesRows,
  configureRoomLayout,
  findNearestWalkablePoint,
  findNextWalkableWaypoint,
  getCrumblingRingPillarRectsForMap,
  getDoorTilesForMap,
  getDoorVestibuleRectsForMap,
  isActiveWallTile,
  isExteriorVoidWallTile,
  isInDoorClearanceZone,
  isInDoorVestibule,
  isWalkableTileForBfs,
  selectBiome1RoomArchetype,
  selectCombatRoomArchetype,
  spawnCombatRoomArchetypeProps,
} from './arena-room-archetypes.js';

export type TileKind = 'floor' | 'wall' | 'pillar' | 'cracked_wall';
export type SurfaceKind =
  | 'none' | 'water' | 'electrified_water' | 'oil' | 'burning_oil' | 'grass'
  | 'burning_grass' | 'ash' | 'poison_swamp' | 'lava' | 'ice' | 'chasm' | 'conveyor';

export const AUTOTILE_NORTH = 1;
export const AUTOTILE_EAST = 2;
export const AUTOTILE_SOUTH = 4;
export const AUTOTILE_WEST = 8;
export const WALL_AO_NORTH = 1;
export const WALL_AO_WEST = 2;
export const WALL_AO_NORTH_WEST = 4;

export interface ArenaMapConfig {
  cols?: number;
  rows?: number;
  includePillars?: boolean;
  includeSurfaces?: boolean;
  seed?: number | string;
  biome?: 1 | 2 | 3;
  roomShape?: RoomInteriorShape;
}

/**
 * Tile-based Arena Map for collision detection (circle vs tile-AABB), autotiling,
 * wall depth/ambient-occlusion masks, cracked secret walls, and interactive elemental surfaces.
 */
export class ArenaMap {
  public cols: number;
  public rows: number;
  public width: number;
  public height: number;
  public tiles: TileKind[];
  public tileVariants: number[];
  public surfaces: SurfaceKind[];
  public baseSurfaces: SurfaceKind[];
  public surfaceTimers: number[];
  public readonly solidBoxes: AABB[];
  public biome: 1 | 2 | 3;
  public conveyorDirection: 1 | -1 = 1;
  public conveyorCycleTimer = 0;
  public conveyorWarningTimer = 0;
  public mapRevision = 1;
  public roomArchetype?: RoomArchetypeId;
  public roomShape: RoomShapeKind = 'rectangle';
  public roomSizePreset?: RoomSizePreset;
  public propAnchors: RoomPropAnchor[] = [];
  public lastLayoutResult: RoomLayoutResult | null = null;
  public lastRoomLayout: RoomLayoutResult | null = null;
  public isBossRoom = false;

  constructor(config: ArenaMapConfig = {}) {
    this.cols = config.cols ?? 36;
    this.rows = config.rows ?? 22;
    this.width = this.cols * TILE_SIZE;
    this.height = this.rows * TILE_SIZE;
    this.biome = config.biome ?? 1;
    this.roomShape = config.roomShape ?? 'rectangle';

    const count = this.cols * this.rows;
    this.tiles = new Array<TileKind>(count).fill('floor');
    this.tileVariants = new Array<number>(count).fill(0);
    this.surfaces = new Array<SurfaceKind>(count).fill('none');
    this.baseSurfaces = new Array<SurfaceKind>(count).fill('none');
    this.surfaceTimers = new Array<number>(count).fill(0);
    this.solidBoxes = [];

    const rng = new SeededRandom(config.seed ?? 0x1337c0de).fork('arena_map');
    for (let i = 0; i < count; i++) {
      this.tileVariants[i] = rng.nextInt(0, 7);
    }

    this.buildLayout(config.includePillars ?? true, config.includeSurfaces ?? true);
  }

  /**
   * Resizes the map grid and reallocates tile/surface buffers in place when entering a room
   * with a different RoomSizePreset ('compact' 28x18, 'standard' 36x22, 'wide_hall' 46x20,
   * 'tall_sanctum' 32x28, 'grand_arena' 44x26, 'colossal_boss' 48x28).
   */
  public resize(cols: number, rows: number): boolean {
    const nextCols = Math.max(12, Math.trunc(cols));
    const nextRows = Math.max(10, Math.trunc(rows));
    if (
      this.cols === nextCols &&
      this.rows === nextRows &&
      this.tiles.length === nextCols * nextRows
    ) {
      return false;
    }
    this.cols = nextCols;
    this.rows = nextRows;
    this.width = nextCols * TILE_SIZE;
    this.height = nextRows * TILE_SIZE;
    const count = nextCols * nextRows;
    this.tiles = new Array<TileKind>(count).fill('floor');
    this.tileVariants = new Array<number>(count).fill(0);
    this.surfaces = new Array<SurfaceKind>(count).fill('none');
    this.baseSurfaces = new Array<SurfaceKind>(count).fill('none');
    this.surfaceTimers = new Array<number>(count).fill(0);
    const rng = new SeededRandom(0x1337c0de).fork('arena_map');
    for (let i = 0; i < count; i++) {
      this.tileVariants[i] = rng.nextInt(0, 7);
    }
    this.rebuildSolidBoxes();
    this.mapRevision += 1;
    return true;
  }

  public reverseConveyorDirection(): 1 | -1 {
    this.conveyorDirection = this.conveyorDirection === 1 ? -1 : 1;
    this.conveyorCycleTimer = 0;
    this.conveyorWarningTimer = 0;
    this.mapRevision += 1;
    return this.conveyorDirection;
  }

  public configureRoomLayout(
    roomTypeOrOpts: RoomType | RoomLayoutOptions,
    roomSeedOrBiome = 1,
    secretWallBrokenOrSeed: boolean | number = false,
    biomeOrActiveDoors: 1 | 2 | 3 | readonly CardinalDir[] = this.biome,
    archetypeOrOpts?:
      | RoomArchetypeId
      | {
          cols?: number;
          rows?: number;
          roomShape?: RoomShapeKind;
          roomSizePreset?: RoomSizePreset;
          archetype?: RoomArchetypeId;
          secretWallBroken?: boolean;
        },
    activeDoorSidesArg?: readonly CardinalDir[],
    shapeOrDims?:
      | RoomShapeKind
      | {
          cols?: number;
          rows?: number;
          roomShape?: RoomShapeKind;
          roomSizePreset?: RoomSizePreset;
        },
  ): RoomLayoutResult | void {
    if (typeof roomTypeOrOpts === 'object' && roomTypeOrOpts !== null) {
      this.isBossRoom = false;
      return configureArchetypeRoomLayout(this, roomTypeOrOpts);
    }
    const roomType = roomTypeOrOpts;
    this.isBossRoom = roomType === 'boss';

    // Detect 5-arg signature: configureRoomLayout(roomType, biome, seed, activeDoorSides?, options?)
    const isFiveArgContract =
      typeof secretWallBrokenOrSeed === 'number' ||
      Array.isArray(biomeOrActiveDoors) ||
      (typeof archetypeOrOpts === 'object' && archetypeOrOpts !== null);

    let roomSeed: number;
    let secretWallBroken: boolean;
    let biome: 1 | 2 | 3;
    let archetype: RoomArchetypeId | undefined;
    let activeDoorSides: readonly CardinalDir[] | undefined;
    let resolvedShapeOrDims:
      | RoomShapeKind
      | {
          cols?: number;
          rows?: number;
          roomShape?: RoomShapeKind;
          roomSizePreset?: RoomSizePreset;
        }
      | undefined;

    if (isFiveArgContract) {
      biome =
        roomSeedOrBiome === 1 || roomSeedOrBiome === 2 || roomSeedOrBiome === 3
          ? roomSeedOrBiome
          : this.biome;
      roomSeed =
        typeof secretWallBrokenOrSeed === 'number' ? secretWallBrokenOrSeed : roomSeedOrBiome;
      activeDoorSides = Array.isArray(biomeOrActiveDoors)
        ? biomeOrActiveDoors
        : activeDoorSidesArg;
      if (typeof archetypeOrOpts === 'object' && archetypeOrOpts !== null) {
        archetype = archetypeOrOpts.archetype;
        secretWallBroken = Boolean(archetypeOrOpts.secretWallBroken);
        resolvedShapeOrDims = archetypeOrOpts;
      } else {
        archetype = archetypeOrOpts;
        secretWallBroken = false;
        resolvedShapeOrDims = shapeOrDims;
      }
    } else {
      roomSeed = roomSeedOrBiome;
      secretWallBroken = Boolean(secretWallBrokenOrSeed);
      biome =
        biomeOrActiveDoors === 1 || biomeOrActiveDoors === 2 || biomeOrActiveDoors === 3
          ? biomeOrActiveDoors
          : this.biome;
      archetype = typeof archetypeOrOpts === 'string' ? archetypeOrOpts : undefined;
      activeDoorSides = activeDoorSidesArg;
      resolvedShapeOrDims = shapeOrDims;
    }

    let targetCols: number | undefined;
    let targetRows: number | undefined;
    let targetPreset: RoomSizePreset | undefined;
    let targetShape: RoomShapeKind = 'rectangle';
    if (typeof resolvedShapeOrDims === 'object' && resolvedShapeOrDims !== null) {
      targetPreset = resolvedShapeOrDims.roomSizePreset;
      const presetDims = targetPreset ? ROOM_SIZE_PRESET_DIMS[targetPreset] : undefined;
      targetCols = resolvedShapeOrDims.cols ?? presetDims?.cols;
      targetRows = resolvedShapeOrDims.rows ?? presetDims?.rows;
      targetShape = resolvedShapeOrDims.roomShape ?? 'rectangle';
    } else if (typeof resolvedShapeOrDims === 'string') {
      targetShape = resolvedShapeOrDims;
    }
    if (targetPreset) {
      this.roomSizePreset = targetPreset;
    }
    if (targetCols && targetRows) {
      this.resize(targetCols, targetRows);
    }
    this.roomShape = roomType === 'start' ? 'rectangle' : targetShape;
    if (roomType === 'combat') {
      return configureArchetypeRoomLayout(this, {
        roomSeed,
        archetype: archetype ?? selectCombatRoomArchetype(roomSeed),
        biome,
        activeDoorSides,
        secretWallBroken,
        roomShape: this.roomShape,
        roomSizePreset: targetPreset,
        cols: targetCols,
        rows: targetRows,
      });
    }

    this.roomArchetype = undefined;
    this.propAnchors = [];
    this.lastLayoutResult = null;
    this.lastRoomLayout = null;
    this.biome = biome;
    this.conveyorDirection = 1;
    this.conveyorCycleTimer = 0;
    this.conveyorWarningTimer = 0;
    const count = this.cols * this.rows;
    const rng = new SeededRandom(roomSeed).fork(`room_${roomType}`);
    for (let i = 0; i < count; i++) {
      this.tiles[i] = 'floor';
      this.surfaces[i] = 'none';
      this.baseSurfaces[i] = 'none';
      this.surfaceTimers[i] = 0;
      this.tileVariants[i] = rng.nextInt(0, 7);
    }

    if (roomType === 'start') {
      this.buildLayout(true, true);
      if (secretWallBroken && this.cols >= 24) {
        this.setTile(Math.floor(this.cols / 2), 0, 'floor');
        this.rebuildSolidBoxes();
      }
      this.mapRevision += 1;
      return;
    }

    // Border walls
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (tx === 0 || ty === 0 || tx === this.cols - 1 || ty === this.rows - 1) {
          this.tiles[ty * this.cols + tx] = 'wall';
        }
      }
    }

    applyRoomInteriorShape(this, this.roomShape);

    const placePillar2x2 = (px: number, py: number) => {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          if (px + dx > 0 && px + dx < this.cols - 1 && py + dy > 0 && py + dy < this.rows - 1) {
            const idx = (py + dy) * this.cols + (px + dx);
            if (this.tiles[idx] !== 'wall') {
              this.tiles[idx] = 'pillar';
              this.surfaces[idx] = 'none';
              this.baseSurfaces[idx] = 'none';
            }
          }
        }
      }
    };

    const midX = Math.floor(this.cols / 2);
    const midY = Math.floor(this.rows / 2);

    if (roomType === 'boss') {
      // Wide open Boss Arena with 4 corner cover pillars centered around (midX, midY)
      placePillar2x2(midX - 11, midY - 7);
      placePillar2x2(midX + 9, midY - 7);
      placePillar2x2(midX - 11, midY + 5);
      placePillar2x2(midX + 9, midY + 5);
      if (biome === 2) {
        // Ice Queen Kryssa Arena: slippery ice rings and freezing water pools
        this.fillSurfaceRect(midX - 7, midY - 7, 5, 3, 'ice');
        this.fillSurfaceRect(midX + 2, midY - 7, 5, 3, 'ice');
        this.fillSurfaceRect(midX - 7, midY + 4, 5, 3, 'water');
        this.fillSurfaceRect(midX + 2, midY + 4, 5, 3, 'ice');
      } else if (biome === 3) {
        // Forge Titan Arena: twin horizontal conveyor lanes + corner lava pools
        this.fillSurfaceRect(midX - 7, midY - 6, 14, 2, 'conveyor');
        this.fillSurfaceRect(midX - 7, midY + 4, 14, 2, 'conveyor');
        this.fillSurfaceRect(midX - 14, midY - 7, 2, 3, 'lava');
        this.fillSurfaceRect(midX + 13, midY - 7, 2, 3, 'lava');
        this.fillSurfaceRect(midX - 14, midY + 4, 2, 3, 'lava');
        this.fillSurfaceRect(midX + 13, midY + 4, 2, 3, 'lava');
      } else {
        this.fillSurfaceRect(midX - 8, midY - 7, 3, 2, 'grass');
        this.fillSurfaceRect(midX + 5, midY - 7, 3, 2, 'grass');
        this.fillSurfaceRect(midX - 8, midY + 5, 3, 2, 'water');
        this.fillSurfaceRect(midX + 5, midY + 5, 3, 2, 'poison_swamp');
      }
    } else {
      // Sanctuary rooms: treasure, merchant, shrine, secret, portal
      const pLeftX = Math.max(5, Math.round((7 * this.cols) / 36));
      const pRightX = this.cols - 2 - pLeftX;
      const pTopY = Math.max(3, Math.round((4 * this.rows) / 22));
      const pBotY = this.rows - 2 - pTopY;
      placePillar2x2(pLeftX, pTopY);
      placePillar2x2(pRightX, pTopY);
      placePillar2x2(pLeftX, pBotY);
      placePillar2x2(pRightX, pBotY);
      const accentA: SurfaceKind = biome === 2 ? 'ice' : biome === 3 ? 'conveyor' : 'water';
      const accentB: SurfaceKind = biome === 2 ? 'water' : biome === 3 ? 'oil' : 'grass';
      if (roomType === 'shrine' || roomType === 'portal') {
        const sTopY = Math.max(4, midY - 6);
        const sBotY = this.rows - 3 - sTopY;
        this.fillSurfaceRect(midX - 6, sTopY, 3, 3, accentA);
        this.fillSurfaceRect(midX + 3, sTopY, 3, 3, accentA);
        this.fillSurfaceRect(midX - 6, sBotY, 3, 3, accentB);
        this.fillSurfaceRect(midX + 3, sBotY, 3, 3, accentB);
      } else if (roomType === 'secret') {
        const sTopY = Math.max(4, midY - 6);
        this.fillSurfaceRect(midX - 7, sTopY, 3, 3, accentB);
        this.fillSurfaceRect(midX + 4, sTopY, 3, 3, accentB);
      } else {
        const sTopY = Math.max(4, midY - 6);
        this.fillSurfaceRect(midX - 8, sTopY, 3, 2, accentB);
        this.fillSurfaceRect(midX + 5, sTopY, 3, 2, accentB);
      }
    }

    const vestibuleRects = getDoorVestibuleRectsForMap(this);
    for (const dir of ['N', 'S', 'E', 'W'] as const) {
      const rect = vestibuleRects[dir];
      for (let ty = rect.minTy; ty <= rect.maxTy; ty++) {
        for (let tx = rect.minTx; tx <= rect.maxTx; tx++) {
          const idx = ty * this.cols + tx;
          this.tiles[idx] = 'floor';
          this.surfaces[idx] = 'none';
          this.baseSurfaces[idx] = 'none';
          this.surfaceTimers[idx] = 0;
        }
      }
    }

    this.rebuildSolidBoxes();
    this.mapRevision += 1;
  }

  public clearInteriorForHub(): void {
    if (this.cols !== 36 || this.rows !== 22) {
      this.resize(36, 22);
    }
    this.roomShape = 'rectangle';
    this.roomSizePreset = 'standard';
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const idx = ty * this.cols + tx;
        const isBorder = tx === 0 || ty === 0 || tx === this.cols - 1 || ty === this.rows - 1;
        this.tiles[idx] = isBorder ? 'wall' : 'floor';
        this.surfaces[idx] = 'none';
        this.baseSurfaces[idx] = 'none';
        this.surfaceTimers[idx] = 0;
      }
    }
    if (this.cols >= 24) {
      this.tiles[Math.floor(this.cols / 2)] = 'wall';
    }
    this.rebuildSolidBoxes();
    this.mapRevision += 1;
  }

  /**
   * Boss Phase 3 ("Mây Độc Thu Hẹp Mép Phòng"): floods the outer 2-tile ring of the Boss Arena
   * with creeping toxic swamp mist, shrinking the safe combat zone in the center.
   */
  public applyBossPhase3ToxicBorder(): void {
    const midX = Math.floor(this.cols / 2);
    const midY = Math.floor(this.rows / 2);
    for (let ty = 1; ty < this.rows - 1; ty++) {
      for (let tx = 1; tx < this.cols - 1; tx++) {
        const isOuterRing =
          tx <= midX - 15 || tx >= midX + 14 || ty <= midY - 9 || ty >= midY + 8;
        if (isOuterRing && !this.isSolidTile(tx, ty)) {
          this.setSurface(tx, ty, 'poison_swamp', 0, true);
        }
      }
    }
  }

  /**
   * Boss 2 Kryssa Phase 3 ("Bão Tuyết Vĩnh Cửu"): freezes the outer ring of the Boss Arena into slippery ice.
   */
  public applyBossPhase3BlizzardBorder(): void {
    const midX = Math.floor(this.cols / 2);
    const midY = Math.floor(this.rows / 2);
    for (let ty = 1; ty < this.rows - 1; ty++) {
      for (let tx = 1; tx < this.cols - 1; tx++) {
        const isOuterRing =
          tx <= midX - 15 || tx >= midX + 14 || ty <= midY - 9 || ty >= midY + 8;
        if (isOuterRing && !this.isSolidTile(tx, ty)) {
          this.setSurface(tx, ty, 'ice', 0, true);
        }
      }
    }
  }

  /**
   * Boss 3 Forge Titan Phase 3 ("Quá Nhiệt Dung Nham"): floods the outer ring of the Boss Arena with molten lava.
   */
  public applyBossPhase3LavaBorder(): void {
    const midX = Math.floor(this.cols / 2);
    const midY = Math.floor(this.rows / 2);
    for (let ty = 1; ty < this.rows - 1; ty++) {
      for (let tx = 1; tx < this.cols - 1; tx++) {
        const isOuterRing =
          tx <= midX - 17 || tx >= midX + 16 || ty <= midY - 10 || ty >= midY + 9;
        if (isOuterRing && !this.isSolidTile(tx, ty)) {
          this.setSurface(tx, ty, 'lava', 0, true);
        }
      }
    }
  }

  private buildLayout(includePillars: boolean, includeSurfaces: boolean): void {
    this.surfaces.fill('none');
    this.baseSurfaces.fill('none');
    this.surfaceTimers.fill(0);
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const isBorder = tx === 0 || ty === 0 || tx === this.cols - 1 || ty === this.rows - 1;
        if (isBorder) {
          this.setTile(tx, ty, 'wall');
        }
      }
    }

    // Cracked secret wall segment on the north border (tx = 17..18, ty = 0)
    if (this.cols >= 24) {
      const midX = Math.floor(this.cols / 2);
      this.setTile(midX, 0, 'cracked_wall');
    }

    if (includePillars && this.cols >= 24 && this.rows >= 16) {
      const pillarCoords: readonly [number, number][] = [
        [8, 5],
        [26, 5],
        [8, 15],
        [26, 15],
      ];
      for (const [px, py] of pillarCoords) {
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            if (px + dx < this.cols - 1 && py + dy < this.rows - 1) {
              this.setTile(px + dx, py + dy, 'pillar');
            }
          }
        }
      }
    }

    if (includeSurfaces && this.cols >= 32 && this.rows >= 20) {
      if (this.biome === 2) {
        this.fillSurfaceRect(11, 3, 4, 3, 'ice');
        this.fillSurfaceRect(17, 3, 4, 3, 'water');
        this.fillSurfaceRect(22, 3, 3, 3, 'chasm');
        this.fillSurfaceRect(3, 7, 3, 4, 'ice');
        this.fillSurfaceRect(11, 16, 4, 3, 'ice');
        this.fillSurfaceRect(16, 16, 4, 3, 'ice');
        this.fillSurfaceRect(22, 16, 3, 3, 'water');
      } else if (this.biome === 3) {
        this.fillSurfaceRect(11, 3, 9, 2, 'conveyor');
        this.fillSurfaceRect(22, 3, 3, 3, 'lava');
        this.fillSurfaceRect(3, 7, 3, 4, 'oil');
        this.fillSurfaceRect(11, 16, 4, 3, 'oil');
        this.fillSurfaceRect(16, 16, 5, 2, 'conveyor');
        this.fillSurfaceRect(22, 16, 3, 3, 'lava');
      } else {
        // Place Biome 1 (Whispering Woods) interactive surfaces in distinct tactical zones outside the central spawn lane (y = 8..13)
        // 1. Water puddle (Top-Left inner courtyard: tx 11..14, ty 3..5)
        this.fillSurfaceRect(11, 3, 4, 3, 'water');
        // 2. Oil slick (Top-Center-Right: tx 17..20, ty 3..5)
        this.fillSurfaceRect(17, 3, 4, 3, 'oil');
        // 3. Lush Grass patch (Top-Right: tx 22..24, ty 3..5 & Left flank: tx 3..5, ty 7..10)
        this.fillSurfaceRect(22, 3, 3, 3, 'grass');
        this.fillSurfaceRect(3, 7, 3, 4, 'grass');
        // 4. Poison Swamp (Bottom-Left: tx 11..14, ty 16..18)
        this.fillSurfaceRect(11, 16, 4, 3, 'poison_swamp');
        // 5. Lush Grass & Poison Swamp patches (Bottom-Center & Bottom-Right)
        this.fillSurfaceRect(16, 16, 4, 3, 'grass');
        this.fillSurfaceRect(22, 16, 3, 3, 'poison_swamp');
      }
    }

    this.rebuildSolidBoxes();
  }

  public fillSurfaceRect(
    startTx: number,
    startTy: number,
    w: number,
    h: number,
    surface: SurfaceKind,
  ): void {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = startTx + dx;
        const ty = startTy + dy;
        if (!this.isSolidTile(tx, ty) && (surface === 'chasm' || this.getSurface(tx, ty) !== 'chasm')) {
          this.setSurface(tx, ty, surface, 0, true);
        }
      }
    }
  }

  public getTile(tx: number, ty: number): TileKind {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) {
      return 'wall';
    }
    return this.tiles[ty * this.cols + tx] ?? 'wall';
  }

  public setTile(tx: number, ty: number, kind: TileKind): void {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return;
    this.tiles[ty * this.cols + tx] = kind;
    this.mapRevision += 1;
  }

  public getTileVariant(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return 0;
    return this.tileVariants[ty * this.cols + tx] ?? 0;
  }

  public isSolidTile(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    return this.tiles[ty * this.cols + tx] !== 'floor';
  }

  /**
   * 4-bit cardinal neighbor mask (N=1, E=2, S=4, W=8) for seamless wall/pillar autotiling.
   */
  public getAutotileMask(tx: number, ty: number): number {
    let mask = 0;
    if (this.isSolidTile(tx, ty - 1)) mask |= AUTOTILE_NORTH;
    if (this.isSolidTile(tx + 1, ty)) mask |= AUTOTILE_EAST;
    if (this.isSolidTile(tx, ty + 1)) mask |= AUTOTILE_SOUTH;
    if (this.isSolidTile(tx - 1, ty)) mask |= AUTOTILE_WEST;
    return mask;
  }

  /**
   * Computes directional ambient occlusion shadow bitmask on floor tiles cast by adjacent N/W/NW walls
   * (matching the global Top-Left -135 deg light source defined in ART_GUIDE.md).
   */
  public getWallAmbientOcclusionMask(tx: number, ty: number): number {
    if (this.isSolidTile(tx, ty)) return 0;
    let mask = 0;
    if (this.isSolidTile(tx, ty - 1)) mask |= WALL_AO_NORTH;
    if (this.isSolidTile(tx - 1, ty)) mask |= WALL_AO_WEST;
    if (this.isSolidTile(tx - 1, ty - 1)) mask |= WALL_AO_NORTH_WEST;
    return mask;
  }

  public getCrackedWallTileForDir(dir: CardinalDir): { tx: number; ty: number } {
    if (dir === 'N') return { tx: Math.floor(this.cols / 2), ty: 0 };
    if (dir === 'S') return { tx: Math.floor(this.cols / 2), ty: this.rows - 1 };
    if (dir === 'W') return { tx: 0, ty: Math.floor(this.rows / 2) };
    return { tx: this.cols - 1, ty: Math.floor(this.rows / 2) };
  }

  public placeCrackedSecretWall(dir?: CardinalDir, broken = false): { tx: number; ty: number } | null {
    const midX = Math.floor(this.cols / 2);
    if (this.getTile(midX, 0) === 'cracked_wall' && dir !== 'N') {
      this.setTile(midX, 0, 'wall');
    }
    if (!dir) {
      this.rebuildSolidBoxes();
      return null;
    }
    const { tx, ty } = this.getCrackedWallTileForDir(dir);
    this.setTile(tx, ty, broken ? 'floor' : 'cracked_wall');
    this.rebuildSolidBoxes();
    return { tx, ty };
  }

  public destroyCrackedWall(tx: number, ty: number): boolean {
    if (this.getTile(tx, ty) !== 'cracked_wall') return false;
    this.setTile(tx, ty, 'floor');
    this.rebuildSolidBoxes();
    return true;
  }

  public getSurface(tx: number, ty: number): SurfaceKind {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return 'none';
    return this.surfaces[ty * this.cols + tx] ?? 'none';
  }

  public getSurfaceAtTile(tx: number, ty: number): SurfaceKind {
    return this.getSurface(tx, ty);
  }

  public isChasmTile(tx: number, ty: number): boolean {
    return this.getSurface(tx, ty) === 'chasm';
  }

  public getSurfaceAtWorld(x: number, y: number): SurfaceKind {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    return this.getSurface(tx, ty);
  }

  /**
   * 4-bit cardinal neighbor mask (N=1, E=2, S=4, W=8) for seamless surface pool rendering.
   */
  public getSurfaceAutotileMask(tx: number, ty: number): number {
    const s = this.getSurface(tx, ty);
    if (s === 'none') return 0;
    let mask = 0;
    if (this.isSameSurfaceFamily(s, this.getSurface(tx, ty - 1))) mask |= AUTOTILE_NORTH;
    if (this.isSameSurfaceFamily(s, this.getSurface(tx + 1, ty))) mask |= AUTOTILE_EAST;
    if (this.isSameSurfaceFamily(s, this.getSurface(tx, ty + 1))) mask |= AUTOTILE_SOUTH;
    if (this.isSameSurfaceFamily(s, this.getSurface(tx - 1, ty))) mask |= AUTOTILE_WEST;
    return mask;
  }

  public isSameSurfaceFamily(a: SurfaceKind, b: SurfaceKind): boolean {
    if (a === b) return true;
    if (
      (a === 'water' || a === 'electrified_water') &&
      (b === 'water' || b === 'electrified_water')
    ) {
      return true;
    }
    if ((a === 'grass' || a === 'ash') && (b === 'grass' || b === 'ash')) {
      return true;
    }
    return false;
  }

  public setSurface(
    tx: number,
    ty: number,
    surface: SurfaceKind,
    durationSec = 0,
    updateBase = false,
  ): void {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return;
    if (this.isSolidTile(tx, ty)) return;
    const idx = ty * this.cols + tx;
    if (this.surfaces[idx] !== surface) {
      this.surfaces[idx] = surface;
      this.mapRevision += 1;
    }
    this.surfaceTimers[idx] = durationSec;
    if (updateBase) {
      this.baseSurfaces[idx] = surface;
    }
  }

  private readonly electrifyQueueX: number[] = [];
  private readonly electrifyQueueY: number[] = [];
  private electrifyVisited = new Uint32Array(1024);
  private electrifyStamp = 1;

  /**
   * Flood-fills connected water/electrified_water tiles starting from (startTx, startTy)
   * into electrified_water for durationSec. Returns the number of tiles electrified.
   */
  public electrifyWaterAt(startTx: number, startTy: number, durationSec = 4.0): number {
    const startSurf = this.getSurface(startTx, startTy);
    if (startSurf !== 'water' && startSurf !== 'electrified_water') return 0;

    if (this.electrifyVisited.length < this.cols * this.rows) {
      this.electrifyVisited = new Uint32Array(this.cols * this.rows);
    }
    let stamp = (this.electrifyStamp + 1) >>> 0;
    if (stamp === 0) {
      stamp = 1;
      this.electrifyVisited.fill(0);
    }
    this.electrifyStamp = stamp;

    const queueX = this.electrifyQueueX;
    const queueY = this.electrifyQueueY;
    queueX.length = 0;
    queueY.length = 0;
    queueX.push(startTx);
    queueY.push(startTy);
    let count = 0;

    while (queueX.length > 0) {
      const tx = queueX.pop()!;
      const ty = queueY.pop()!;
      const idx = ty * this.cols + tx;
      if (this.electrifyVisited[idx] === stamp) continue;
      this.electrifyVisited[idx] = stamp;
      const s = this.surfaces[idx];
      if (s !== 'water' && s !== 'electrified_water') continue;

      this.setSurface(tx, ty, 'electrified_water', durationSec, false);
      count += 1;

      for (let k = 0; k < ArenaMap.CARDINAL_OFFSETS.length; k++) {
        const [dx, dy] = ArenaMap.CARDINAL_OFFSETS[k]!;
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx >= 0 && ny >= 0 && nx < this.cols && ny < this.rows) {
          const nIdx = ny * this.cols + nx;
          if (this.electrifyVisited[nIdx] === stamp) continue;
          const ns = this.surfaces[nIdx];
          if (ns === 'water' || ns === 'electrified_water') {
            queueX.push(nx);
            queueY.push(ny);
          }
        }
      }
    }
    return count;
  }

  /**
   * Applies Fire/Burn at tile (tx, ty) and optional radius:
   * - Ignites 'oil' -> 'burning_oil' (5.0s)
   * - Ignites 'grass' -> 'burning_grass' (3.5s)
   * - Melts 'ice' -> 'water'
   */
  public igniteSurfaceInRadius(worldX: number, worldY: number, radius: number): number {
    const minTx = Math.max(1, Math.floor((worldX - radius) / TILE_SIZE));
    const maxTx = Math.min(this.cols - 2, Math.floor((worldX + radius) / TILE_SIZE));
    const minTy = Math.max(1, Math.floor((worldY - radius) / TILE_SIZE));
    const maxTy = Math.min(this.rows - 2, Math.floor((worldY + radius) / TILE_SIZE));
    const maxDist = radius + TILE_SIZE * 0.65;
    const maxDistSq = maxDist * maxDist;

    let changed = 0;
    for (let ty = minTy; ty <= maxTy; ty++) {
      const rowOffset = ty * this.cols;
      const dy = ty * TILE_SIZE + TILE_SIZE / 2 - worldY;
      const dySq = dy * dy;
      if (dySq > maxDistSq) continue;
      for (let tx = minTx; tx <= maxTx; tx++) {
        const s = this.surfaces[rowOffset + tx]!;
        if (s !== 'oil' && s !== 'grass' && s !== 'poison_swamp' && s !== 'ice') continue;
        const dx = tx * TILE_SIZE + TILE_SIZE / 2 - worldX;
        if (dx * dx + dySq > maxDistSq) continue;

        if (s === 'oil') {
          this.setSurface(tx, ty, 'burning_oil', 5.0, false);
          changed += 1;
        } else if (s === 'grass' || (s === 'poison_swamp' && !this.isBossRoom)) {
          this.setSurface(tx, ty, 'burning_grass', 3.5, false);
          changed += 1;
        } else if (s === 'ice') {
          this.setSurface(tx, ty, 'water', 0, false);
          changed += 1;
        }
      }
    }
    return changed;
  }

  /**
   * Applies Chill/Ice at world position & radius:
   * - Freezes 'water' or 'electrified_water' -> 'ice' (6.0s)
   * - Extinguishes 'burning_oil' -> 'oil' and 'burning_grass' -> 'ash'
   */
  public freezeSurfaceInRadius(worldX: number, worldY: number, radius: number): number {
    const minTx = Math.max(1, Math.floor((worldX - radius) / TILE_SIZE));
    const maxTx = Math.min(this.cols - 2, Math.floor((worldX + radius) / TILE_SIZE));
    const minTy = Math.max(1, Math.floor((worldY - radius) / TILE_SIZE));
    const maxTy = Math.min(this.rows - 2, Math.floor((worldY + radius) / TILE_SIZE));
    const maxDist = radius + TILE_SIZE * 0.65;
    const maxDistSq = maxDist * maxDist;

    let changed = 0;
    for (let ty = minTy; ty <= maxTy; ty++) {
      const rowOffset = ty * this.cols;
      const dy = ty * TILE_SIZE + TILE_SIZE / 2 - worldY;
      const dySq = dy * dy;
      if (dySq > maxDistSq) continue;
      for (let tx = minTx; tx <= maxTx; tx++) {
        const s = this.surfaces[rowOffset + tx]!;
        if (s !== 'water' && s !== 'electrified_water' && s !== 'burning_oil' && s !== 'burning_grass') continue;
        const dx = tx * TILE_SIZE + TILE_SIZE / 2 - worldX;
        if (dx * dx + dySq > maxDistSq) continue;

        if (s === 'water' || s === 'electrified_water') {
          this.setSurface(tx, ty, 'ice', 6.0, false);
          changed += 1;
        } else if (s === 'burning_oil') {
          this.setSurface(tx, ty, 'oil', 0, false);
          changed += 1;
        } else if (s === 'burning_grass') {
          this.setSurface(tx, ty, 'ash', 0, false);
          changed += 1;
        }
      }
    }
    return changed;
  }

  private readonly toIgniteOil: number[] = [];
  private readonly toIgniteGrass: number[] = [];
  private static readonly CARDINAL_OFFSETS: readonly [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  /**
   * Advances surface timers and spreads fire across adjacent oil/grass tiles (zero-allocation).
   */
  public stepSurfaces(dtSec: number): void {
    this.toIgniteOil.length = 0;
    this.toIgniteGrass.length = 0;

    for (let ty = 1; ty < this.rows - 1; ty++) {
      const rowOffset = ty * this.cols;
      for (let tx = 1; tx < this.cols - 1; tx++) {
        const idx = rowOffset + tx;
        const timer = this.surfaceTimers[idx]!;
        const surf = this.surfaces[idx]!;
        if (timer <= 0 && surf !== 'burning_oil' && surf !== 'burning_grass') continue;

        if (surf === 'burning_oil' || surf === 'burning_grass') {
          // Spread fire to cardinal neighbors at 320 px/s (~10 tiles/s = 0.10s per tile)
          const maxDur = surf === 'burning_oil' ? 5.0 : 3.5;
          const spreadThresholdSec = this.isBossRoom ? 0.25 : TILE_SIZE / 320;
          const elapsedBurn = this.isBossRoom
            ? maxDur - timer
            : maxDur - Math.max(0, timer - dtSec);
          if (elapsedBurn + 1e-6 >= spreadThresholdSec) {
            for (let k = 0; k < ArenaMap.CARDINAL_OFFSETS.length; k++) {
              const [dx, dy] = ArenaMap.CARDINAL_OFFSETS[k]!;
              const nTx = tx + dx;
              const nTy = ty + dy;
              const nIdx = nTy * this.cols + nTx;
              const nSurf = this.surfaces[nIdx];
              if (nSurf === 'oil') {
                this.toIgniteOil.push(nIdx);
              } else if (nSurf === 'grass' || (nSurf === 'poison_swamp' && !this.isBossRoom)) {
                this.toIgniteGrass.push(nIdx);
              }
            }
          }
        }

        if (timer > 0) {
          const nextTimer = timer - dtSec;
          if (nextTimer <= 0) {
            this.surfaceTimers[idx] = 0;
            const base = this.baseSurfaces[idx] ?? 'none';
            if (surf === 'burning_oil' || surf === 'burning_grass') {
              this.surfaces[idx] = 'ash';
            } else if (surf === 'electrified_water') {
              this.surfaces[idx] = 'water';
            } else if (surf === 'ice' && base === 'water') {
              this.surfaces[idx] = 'water';
            } else {
              this.surfaces[idx] = base;
            }
            this.mapRevision += 1;
          } else {
            this.surfaceTimers[idx] = nextTimer;
          }
        }
      }
    }

    for (let i = 0; i < this.toIgniteOil.length; i++) {
      const idx = this.toIgniteOil[i]!;
      if (this.surfaces[idx] === 'oil') {
        this.surfaces[idx] = 'burning_oil';
        this.surfaceTimers[idx] = 5.0;
        this.mapRevision += 1;
      }
    }
    for (let i = 0; i < this.toIgniteGrass.length; i++) {
      const idx = this.toIgniteGrass[i]!;
      if (this.surfaces[idx] === 'grass' || (this.surfaces[idx] === 'poison_swamp' && !this.isBossRoom)) {
        this.surfaces[idx] = 'burning_grass';
        this.surfaceTimers[idx] = 3.5;
        this.mapRevision += 1;
      }
    }
  }

  public rebuildSolidBoxes(): void {
    this.solidBoxes.length = 0;
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (this.isSolidTile(tx, ty)) {
          this.solidBoxes.push({
            minX: tx * TILE_SIZE,
            minY: ty * TILE_SIZE,
            maxX: (tx + 1) * TILE_SIZE,
            maxY: (ty + 1) * TILE_SIZE,
          });
        }
      }
    }
  }

  private readonly scratchBox: AABB = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private readonly circleResOut = {
    x: 0,
    y: 0,
    collided: false,
    normalX: 0,
    normalY: 0,
  };
  private readonly wallHitOut = {
    hit: false,
    normalX: 0,
    normalY: 0,
    resolvedX: 0,
    resolvedY: 0,
    hitTx: -1,
    hitTy: -1,
  };

  public isWalkableTile(tx: number, ty: number): boolean {
    if (tx <= 0 || ty <= 0 || tx >= this.cols - 1 || ty >= this.rows - 1) return false;
    return !this.isSolidTile(tx, ty) && this.getSurface(tx, ty) !== 'chasm';
  }

  private isBlockingTile(tx: number, ty: number, ignoreChasm: boolean): boolean {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return true;
    const idx = ty * this.cols + tx;
    if (this.tiles[idx] !== 'floor') return true;
    return !ignoreChasm && this.surfaces[idx] === 'chasm';
  }

  private isColumnBlocking(tx: number, minTy: number, maxTy: number, ignoreChasm: boolean): boolean {
    for (let y = minTy; y <= maxTy; y++) {
      if (!this.isBlockingTile(tx, y, ignoreChasm)) return false;
    }
    return true;
  }

  /**
   * Resolves circle vs nearby solid tile-AABBs (and chasm tiles when ignoreChasm=false)
   * so entities slide smoothly along walls, pillars, and chasm ledges without snagging on internal seams.
   * Clamps to outer map bounds [radius..width-radius] so broken cracked_wall tiles on the border are passable.
   */
  public resolveCircleCollision(
    x: number,
    y: number,
    radius: number,
    ignoreChasm = false,
  ): { x: number; y: number; collided: boolean; normalX: number; normalY: number } {
    const curTx = clamp(Math.floor(x / TILE_SIZE), 0, this.cols - 1);
    const curTy = clamp(Math.floor(y / TILE_SIZE), 0, this.rows - 1);
    const minBoundX = this.isSolidTile(0, curTy) ? TILE_SIZE + radius : radius;
    const maxBoundX = this.isSolidTile(this.cols - 1, curTy)
      ? this.width - TILE_SIZE - radius
      : this.width - radius;
    const minBoundY = this.isSolidTile(curTx, 0) ? TILE_SIZE + radius : radius;
    const maxBoundY = this.isSolidTile(curTx, this.rows - 1)
      ? this.height - TILE_SIZE - radius
      : this.height - radius;

    let currX = clamp(x, minBoundX, maxBoundX);
    let currY = clamp(y, minBoundY, maxBoundY);
    let collided = currX !== x || currY !== y;
    let normalX = currX !== x ? Math.sign(currX - x) : 0;
    let normalY = currY !== y ? Math.sign(currY - y) : 0;

    const oMinTx = Math.max(0, Math.floor((currX - radius) / TILE_SIZE));
    const oMaxTx = Math.min(this.cols - 1, Math.floor((currX + radius) / TILE_SIZE));
    const oMinTy = Math.max(0, Math.floor((currY - radius) / TILE_SIZE));
    const oMaxTy = Math.min(this.rows - 1, Math.floor((currY + radius) / TILE_SIZE));
    let hasNearbyBlocking = false;
    for (let ty = oMinTy; ty <= oMaxTy && !hasNearbyBlocking; ty++) {
      for (let tx = oMinTx; tx <= oMaxTx; tx++) {
        if (this.isBlockingTile(tx, ty, ignoreChasm)) {
          hasNearbyBlocking = true;
          break;
        }
      }
    }
    if (!hasNearbyBlocking) {
      const out = this.circleResOut;
      out.x = currX;
      out.y = currY;
      out.collided = collided;
      out.normalX = normalX;
      out.normalY = normalY;
      return out;
    }

    // Pass 1: cardinal face overlaps; Pass 2: remaining outer-corner overlaps
    for (let pass = 0; pass < 2; pass++) {
      const pMinTx = Math.max(0, Math.floor((currX - radius) / TILE_SIZE));
      const pMaxTx = Math.min(this.cols - 1, Math.floor((currX + radius) / TILE_SIZE));
      const pMinTy = Math.max(0, Math.floor((currY - radius) / TILE_SIZE));
      const pMaxTy = Math.min(this.rows - 1, Math.floor((currY + radius) / TILE_SIZE));
      for (let ty = pMinTy; ty <= pMaxTy; ty++) {
        for (let tx = pMinTx; tx <= pMaxTx; tx++) {
          if (!this.isBlockingTile(tx, ty, ignoreChasm)) continue;
          let bMinTx = tx;
          let bMaxTx = tx;
          let bMinTy = ty;
          let bMaxTy = ty;
          const isInterior = tx > 0 && tx < this.cols - 1 && ty > 0 && ty < this.rows - 1;
          if (isInterior) {
            if (!this.roomArchetype) {
              while (bMinTx > 1 && this.isBlockingTile(bMinTx - 1, ty, ignoreChasm)) bMinTx -= 1;
              while (bMaxTx < this.cols - 2 && this.isBlockingTile(bMaxTx + 1, ty, ignoreChasm)) {
                bMaxTx += 1;
              }
              while (bMinTy > 1 && this.isBlockingTile(tx, bMinTy - 1, ignoreChasm)) bMinTy -= 1;
              while (bMaxTy < this.rows - 2 && this.isBlockingTile(tx, bMaxTy + 1, ignoreChasm)) {
                bMaxTy += 1;
              }
            } else {
              while (bMinTy > 1 && this.isBlockingTile(tx, bMinTy - 1, ignoreChasm)) bMinTy -= 1;
              while (bMaxTy < this.rows - 2 && this.isBlockingTile(tx, bMaxTy + 1, ignoreChasm)) {
                bMaxTy += 1;
              }
              while (bMinTx > 1 && this.isColumnBlocking(bMinTx - 1, bMinTy, bMaxTy, ignoreChasm)) {
                bMinTx -= 1;
              }
              while (
                bMaxTx < this.cols - 2 &&
                this.isColumnBlocking(bMaxTx + 1, bMinTy, bMaxTy, ignoreChasm)
              ) {
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
          if ((pass === 0 && !isCardinalFace) || (pass === 1 && isCardinalFace)) {
            continue;
          }

          this.scratchBox.minX = minX;
          this.scratchBox.minY = minY;
          this.scratchBox.maxX = maxX;
          this.scratchBox.maxY = maxY;

          const res = resolveCircleVsAABB(currX, currY, radius, this.scratchBox);
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

    const out = this.circleResOut;
    out.x = currX;
    out.y = currY;
    out.collided = collided;
    out.normalX = normalX;
    out.normalY = normalY;
    return out;
  }

  public checkProjectileWallHit(
    x: number,
    y: number,
    radius: number,
  ): { hit: boolean; normalX: number; normalY: number; resolvedX: number; resolvedY: number; hitTx: number; hitTy: number } {
    const out = this.wallHitOut;
    const minTx = Math.max(0, Math.floor((x - radius) / TILE_SIZE));
    const maxTx = Math.min(this.cols - 1, Math.floor((x + radius) / TILE_SIZE));
    const minTy = Math.max(0, Math.floor((y - radius) / TILE_SIZE));
    const maxTy = Math.min(this.rows - 1, Math.floor((y + radius) / TILE_SIZE));

    for (let ty = minTy; ty <= maxTy; ty++) {
      const rowOffset = ty * this.cols;
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (this.tiles[rowOffset + tx] === 'floor') continue;
        this.scratchBox.minX = tx * TILE_SIZE;
        this.scratchBox.minY = ty * TILE_SIZE;
        this.scratchBox.maxX = (tx + 1) * TILE_SIZE;
        this.scratchBox.maxY = (ty + 1) * TILE_SIZE;

        const res = resolveCircleVsAABB(x, y, radius, this.scratchBox);
        if (res.collided) {
          out.hit = true;
          out.normalX = res.normalX;
          out.normalY = res.normalY;
          out.resolvedX = res.x;
          out.resolvedY = res.y;
          out.hitTx = tx;
          out.hitTy = ty;
          return out;
        }
      }
    }

    if (x - radius <= 0 || x + radius >= this.width || y - radius <= 0 || y + radius >= this.height) {
      let nx = 0;
      let ny = 0;
      let hitTx = clamp(Math.floor(x / TILE_SIZE), 0, this.cols - 1);
      let hitTy = clamp(Math.floor(y / TILE_SIZE), 0, this.rows - 1);
      if (x - radius <= 0) { nx = 1; hitTx = 0; }
      else if (x + radius >= this.width) { nx = -1; hitTx = this.cols - 1; }
      if (y - radius <= 0) { ny = 1; hitTy = 0; }
      else if (y + radius >= this.height) { ny = -1; hitTy = this.rows - 1; }
      out.hit = true;
      out.normalX = nx;
      out.normalY = ny;
      out.resolvedX = clamp(x, radius, this.width - radius);
      out.resolvedY = clamp(y, radius, this.height - radius);
      out.hitTx = hitTx;
      out.hitTy = hitTy;
      return out;
    }

    out.hit = false;
    out.normalX = 0;
    out.normalY = 0;
    out.resolvedX = x;
    out.resolvedY = y;
    out.hitTx = -1;
    out.hitTy = -1;
    return out;
  }
}
