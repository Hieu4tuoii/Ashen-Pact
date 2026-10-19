import { TILE_SIZE } from '../protocol/messages.js';
import { type AABB, clamp, resolveCircleVsAABB } from '../math/vec2.js';

export type TileKind = 'floor' | 'wall' | 'pillar';

export interface ArenaMapConfig {
  cols?: number;
  rows?: number;
  includePillars?: boolean;
}

/**
 * Tile-based Arena Map for collision detection (circle vs tile-AABB) in packages/shared.
 * Default test room is 36x22 tiles (1152x704 world units) with outer walls and 4 interior pillars.
 */
export class ArenaMap {
  public readonly cols: number;
  public readonly rows: number;
  public readonly width: number;
  public readonly height: number;
  public readonly tiles: TileKind[];
  public readonly solidBoxes: AABB[];

  constructor(config: ArenaMapConfig = {}) {
    this.cols = config.cols ?? 36;
    this.rows = config.rows ?? 22;
    this.width = this.cols * TILE_SIZE;
    this.height = this.rows * TILE_SIZE;
    this.tiles = new Array<TileKind>(this.cols * this.rows).fill('floor');
    this.solidBoxes = [];

    this.buildLayout(config.includePillars ?? true);
  }

  private buildLayout(includePillars: boolean): void {
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const isBorder = tx === 0 || ty === 0 || tx === this.cols - 1 || ty === this.rows - 1;
        if (isBorder) {
          this.setTile(tx, ty, 'wall');
        }
      }
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

    this.rebuildSolidBoxes();
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
  }

  public isSolidTile(tx: number, ty: number): boolean {
    const t = this.getTile(tx, ty);
    return t === 'wall' || t === 'pillar';
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

  /**
   * Resolves circle vs nearby solid tile-AABBs so entities slide smoothly along walls.
   */
  public resolveCircleCollision(
    x: number,
    y: number,
    radius: number,
  ): { x: number; y: number; collided: boolean; normalX: number; normalY: number } {
    let currX = clamp(x, TILE_SIZE + radius, this.width - TILE_SIZE - radius);
    let currY = clamp(y, TILE_SIZE + radius, this.height - TILE_SIZE - radius);
    let collided = currX !== x || currY !== y;
    let normalX = currX !== x ? Math.sign(currX - x) : 0;
    let normalY = currY !== y ? Math.sign(currY - y) : 0;

    const minTx = Math.max(0, Math.floor((currX - radius) / TILE_SIZE) - 1);
    const maxTx = Math.min(this.cols - 1, Math.floor((currX + radius) / TILE_SIZE) + 1);
    const minTy = Math.max(0, Math.floor((currY - radius) / TILE_SIZE) - 1);
    const maxTy = Math.min(this.rows - 1, Math.floor((currY + radius) / TILE_SIZE) + 1);

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!this.isSolidTile(tx, ty)) continue;
        const box: AABB = {
          minX: tx * TILE_SIZE,
          minY: ty * TILE_SIZE,
          maxX: (tx + 1) * TILE_SIZE,
          maxY: (ty + 1) * TILE_SIZE,
        };
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

    return { x: currX, y: currY, collided, normalX, normalY };
  }

  /**
   * Checks if a projectile circle hits any solid wall or pillar tile.
   */
  public checkProjectileWallHit(
    x: number,
    y: number,
    radius: number,
  ): { hit: boolean; normalX: number; normalY: number; resolvedX: number; resolvedY: number } {
    if (
      x - radius <= TILE_SIZE ||
      x + radius >= this.width - TILE_SIZE ||
      y - radius <= TILE_SIZE ||
      y + radius >= this.height - TILE_SIZE
    ) {
      let nx = 0;
      let ny = 0;
      if (x - radius <= TILE_SIZE) nx = 1;
      else if (x + radius >= this.width - TILE_SIZE) nx = -1;
      if (y - radius <= TILE_SIZE) ny = 1;
      else if (y + radius >= this.height - TILE_SIZE) ny = -1;
      return {
        hit: true,
        normalX: nx,
        normalY: ny,
        resolvedX: clamp(x, TILE_SIZE + radius, this.width - TILE_SIZE - radius),
        resolvedY: clamp(y, TILE_SIZE + radius, this.height - TILE_SIZE - radius),
      };
    }

    const minTx = Math.max(0, Math.floor((x - radius) / TILE_SIZE));
    const maxTx = Math.min(this.cols - 1, Math.floor((x + radius) / TILE_SIZE));
    const minTy = Math.max(0, Math.floor((y - radius) / TILE_SIZE));
    const maxTy = Math.min(this.rows - 1, Math.floor((y + radius) / TILE_SIZE));

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!this.isSolidTile(tx, ty)) continue;
        const box: AABB = {
          minX: tx * TILE_SIZE,
          minY: ty * TILE_SIZE,
          maxX: (tx + 1) * TILE_SIZE,
          maxY: (ty + 1) * TILE_SIZE,
        };
        const res = resolveCircleVsAABB(x, y, radius, box);
        if (res.collided) {
          return {
            hit: true,
            normalX: res.normalX,
            normalY: res.normalY,
            resolvedX: res.x,
            resolvedY: res.y,
          };
        }
      }
    }

    return { hit: false, normalX: 0, normalY: 0, resolvedX: x, resolvedY: y };
  }
}
