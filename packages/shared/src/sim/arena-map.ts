import { SeededRandom } from '../core/prng.js';
import { TILE_SIZE } from '../protocol/messages.js';
import { type AABB, clamp, resolveCircleVsAABB } from '../math/vec2.js';

export type TileKind = 'floor' | 'wall' | 'pillar' | 'cracked_wall';

export type SurfaceKind =
  | 'none'
  | 'water'
  | 'electrified_water'
  | 'oil'
  | 'burning_oil'
  | 'grass'
  | 'burning_grass'
  | 'ash'
  | 'poison_swamp'
  | 'lava'
  | 'ice';

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
}

/**
 * Tile-based Arena Map for collision detection (circle vs tile-AABB), autotiling,
 * wall depth/ambient-occlusion masks, cracked secret walls, and interactive elemental surfaces.
 */
export class ArenaMap {
  public readonly cols: number;
  public readonly rows: number;
  public readonly width: number;
  public readonly height: number;
  public readonly tiles: TileKind[];
  public readonly tileVariants: number[];
  public readonly surfaces: SurfaceKind[];
  public readonly baseSurfaces: SurfaceKind[];
  public readonly surfaceTimers: number[];
  public readonly solidBoxes: AABB[];
  public mapRevision = 1;

  constructor(config: ArenaMapConfig = {}) {
    this.cols = config.cols ?? 36;
    this.rows = config.rows ?? 22;
    this.width = this.cols * TILE_SIZE;
    this.height = this.rows * TILE_SIZE;

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

  private buildLayout(includePillars: boolean, includeSurfaces: boolean): void {
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
      // Place all 6 interactive surfaces in distinct tactical zones outside the central spawn lane (y = 8..13)
      // 1. Water puddle (Top-Left inner courtyard: tx 11..14, ty 3..5)
      this.fillSurfaceRect(11, 3, 4, 3, 'water');
      // 2. Oil slick (Top-Center-Right: tx 17..20, ty 3..5)
      this.fillSurfaceRect(17, 3, 4, 3, 'oil');
      // 3. Lush Grass patch (Top-Right: tx 22..24, ty 3..5 & Left flank: tx 3..5, ty 7..10)
      this.fillSurfaceRect(22, 3, 3, 3, 'grass');
      this.fillSurfaceRect(3, 7, 3, 4, 'grass');
      // 4. Poison Swamp (Bottom-Left: tx 11..14, ty 16..18)
      this.fillSurfaceRect(11, 16, 4, 3, 'poison_swamp');
      // 5. Molten Lava fissure (Bottom-Right: tx 22..24, ty 16..18)
      this.fillSurfaceRect(22, 16, 3, 3, 'lava');
      // 6. Slippery Ice sheet (Bottom-Center: tx 16..19, ty 16..18)
      this.fillSurfaceRect(16, 16, 4, 3, 'ice');
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
        if (!this.isSolidTile(tx, ty)) {
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
    const t = this.getTile(tx, ty);
    return t === 'wall' || t === 'pillar' || t === 'cracked_wall';
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

  private isSameSurfaceFamily(a: SurfaceKind, b: SurfaceKind): boolean {
    if (a === b) return true;
    if (
      (a === 'water' || a === 'electrified_water' || a === 'ice') &&
      (b === 'water' || b === 'electrified_water' || b === 'ice')
    ) {
      return true;
    }
    if ((a === 'oil' || a === 'burning_oil') && (b === 'oil' || b === 'burning_oil')) {
      return true;
    }
    if (
      (a === 'grass' || a === 'burning_grass' || a === 'ash') &&
      (b === 'grass' || a === 'burning_grass' || b === 'ash')
    ) {
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

  /**
   * Flood-fills connected water/electrified_water tiles starting from (startTx, startTy)
   * into electrified_water for durationSec. Returns the number of tiles electrified.
   */
  public electrifyWaterAt(startTx: number, startTy: number, durationSec = 4.0): number {
    const startSurf = this.getSurface(startTx, startTy);
    if (startSurf !== 'water' && startSurf !== 'electrified_water') return 0;

    const queueX: number[] = [startTx];
    const queueY: number[] = [startTy];
    const visited = new Set<number>();
    let count = 0;

    while (queueX.length > 0) {
      const tx = queueX.pop()!;
      const ty = queueY.pop()!;
      const idx = ty * this.cols + tx;
      if (visited.has(idx)) continue;
      visited.add(idx);

      const s = this.getSurface(tx, ty);
      if (s !== 'water' && s !== 'electrified_water') continue;

      this.setSurface(tx, ty, 'electrified_water', durationSec, false);
      count += 1;

      const dirs: readonly [number, number][] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dy] of dirs) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx >= 0 && ny >= 0 && nx < this.cols && ny < this.rows) {
          const ns = this.getSurface(nx, ny);
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

    let changed = 0;
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const cx = tx * TILE_SIZE + TILE_SIZE / 2;
        const cy = ty * TILE_SIZE + TILE_SIZE / 2;
        if (Math.hypot(cx - worldX, cy - worldY) > radius + TILE_SIZE * 0.65) continue;

        const s = this.getSurface(tx, ty);
        if (s === 'oil') {
          this.setSurface(tx, ty, 'burning_oil', 5.0, false);
          changed += 1;
        } else if (s === 'grass') {
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

    let changed = 0;
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const cx = tx * TILE_SIZE + TILE_SIZE / 2;
        const cy = ty * TILE_SIZE + TILE_SIZE / 2;
        if (Math.hypot(cx - worldX, cy - worldY) > radius + TILE_SIZE * 0.65) continue;

        const s = this.getSurface(tx, ty);
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
      for (let tx = 1; tx < this.cols - 1; tx++) {
        const idx = ty * this.cols + tx;
        const surf = this.surfaces[idx]!;
        const timer = this.surfaceTimers[idx]!;

        if (surf === 'burning_oil' || surf === 'burning_grass') {
          // Spread fire to cardinal neighbors after burning for at least 0.25s
          const maxDur = surf === 'burning_oil' ? 5.0 : 3.5;
          if (maxDur - timer >= 0.25) {
            for (let k = 0; k < ArenaMap.CARDINAL_OFFSETS.length; k++) {
              const [dx, dy] = ArenaMap.CARDINAL_OFFSETS[k]!;
              const nIdx = (ty + dy) * this.cols + (tx + dx);
              const nSurf = this.surfaces[nIdx];
              if (nSurf === 'oil') this.toIgniteOil.push(nIdx);
              else if (nSurf === 'grass') this.toIgniteGrass.push(nIdx);
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
      if (this.surfaces[idx] === 'grass') {
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

  /**
   * Resolves circle vs nearby solid tile-AABBs so entities slide smoothly along walls and pillars
   * without snagging on internal seams between adjacent tiles.
   * Clamps to outer map bounds [radius..width-radius] so broken cracked_wall tiles on the border are passable.
   */
  public resolveCircleCollision(
    x: number,
    y: number,
    radius: number,
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

    const minTx = Math.max(0, Math.floor((currX - radius) / TILE_SIZE) - 1);
    const maxTx = Math.min(this.cols - 1, Math.floor((currX + radius) / TILE_SIZE) + 1);
    const minTy = Math.max(0, Math.floor((currY - radius) / TILE_SIZE) - 1);
    const maxTy = Math.min(this.rows - 1, Math.floor((currY + radius) / TILE_SIZE) + 1);

    // Pass 1: Resolve cardinal face overlaps first so sliding across tile seams never snags on internal corners
    // Pass 2: Resolve any remaining true outer-corner overlaps
    for (let pass = 0; pass < 2; pass++) {
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          if (!this.isSolidTile(tx, ty)) continue;
          const minX = tx * TILE_SIZE;
          const minY = ty * TILE_SIZE;
          const maxX = minX + TILE_SIZE;
          const maxY = minY + TILE_SIZE;

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

    return { x: currX, y: currY, collided, normalX, normalY };
  }

  /**
   * Checks if a projectile circle hits any solid wall or pillar tile.
   */
  public checkProjectileWallHit(
    x: number,
    y: number,
    radius: number,
  ): {
    hit: boolean;
    normalX: number;
    normalY: number;
    resolvedX: number;
    resolvedY: number;
    hitTx: number;
    hitTy: number;
  } {
    const minTx = Math.max(0, Math.floor((x - radius) / TILE_SIZE));
    const maxTx = Math.min(this.cols - 1, Math.floor((x + radius) / TILE_SIZE));
    const minTy = Math.max(0, Math.floor((y - radius) / TILE_SIZE));
    const maxTy = Math.min(this.rows - 1, Math.floor((y + radius) / TILE_SIZE));

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!this.isSolidTile(tx, ty)) continue;
        this.scratchBox.minX = tx * TILE_SIZE;
        this.scratchBox.minY = ty * TILE_SIZE;
        this.scratchBox.maxX = (tx + 1) * TILE_SIZE;
        this.scratchBox.maxY = (ty + 1) * TILE_SIZE;

        const res = resolveCircleVsAABB(x, y, radius, this.scratchBox);
        if (res.collided) {
          return {
            hit: true,
            normalX: res.normalX,
            normalY: res.normalY,
            resolvedX: res.x,
            resolvedY: res.y,
            hitTx: tx,
            hitTy: ty,
          };
        }
      }
    }

    if (
      x - radius <= 0 ||
      x + radius >= this.width ||
      y - radius <= 0 ||
      y + radius >= this.height
    ) {
      let nx = 0;
      let ny = 0;
      let hitTx = clamp(Math.floor(x / TILE_SIZE), 0, this.cols - 1);
      let hitTy = clamp(Math.floor(y / TILE_SIZE), 0, this.rows - 1);
      if (x - radius <= 0) {
        nx = 1;
        hitTx = 0;
      } else if (x + radius >= this.width) {
        nx = -1;
        hitTx = this.cols - 1;
      }
      if (y - radius <= 0) {
        ny = 1;
        hitTy = 0;
      } else if (y + radius >= this.height) {
        ny = -1;
        hitTy = this.rows - 1;
      }
      return {
        hit: true,
        normalX: nx,
        normalY: ny,
        resolvedX: clamp(x, radius, this.width - radius),
        resolvedY: clamp(y, radius, this.height - radius),
        hitTx,
        hitTy,
      };
    }

    return {
      hit: false,
      normalX: 0,
      normalY: 0,
      resolvedX: x,
      resolvedY: y,
      hitTx: -1,
      hitTy: -1,
    };
  }
}

