import { distanceSq } from './vec2.js';

export interface SpatialEntity {
  id: number;
  x: number;
  y: number;
  radius: number;
}

/**
 * Uniform Spatial Hash Grid (default cell size 64x64 world units).
 * Used for broadphase collision queries of projectiles vs enemies/players
 * without O(N*M) nested checks or per-frame heap allocations.
 */
export class SpatialHashGrid<T extends SpatialEntity> {
  public readonly cellSize: number;
  private readonly invCellSize: number;
  private readonly buckets = new Map<number, T[]>();
  private readonly seenIds = new Set<number>();

  constructor(cellSize = 64) {
    this.cellSize = Math.max(8, cellSize);
    this.invCellSize = 1 / this.cellSize;
  }

  private hashCoords(cx: number, cy: number): number {
    // Pack two signed 16-bit cell coordinates into a single 32-bit integer key
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }

  public clear(): void {
    for (const bucket of this.buckets.values()) {
      bucket.length = 0;
    }
  }

  public insert(item: T): void {
    const r = Math.max(0, item.radius);
    const minCx = Math.floor((item.x - r) * this.invCellSize);
    const maxCx = Math.floor((item.x + r) * this.invCellSize);
    const minCy = Math.floor((item.y - r) * this.invCellSize);
    const maxCy = Math.floor((item.y + r) * this.invCellSize);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = this.hashCoords(cx, cy);
        let bucket = this.buckets.get(key);
        if (!bucket) {
          bucket = [];
          this.buckets.set(key, bucket);
        }
        bucket.push(item);
      }
    }
  }

  /**
   * Queries all unique entities whose bounding circle intersects the query circle (x, y, radius).
   * Writes into `out` array (cleared first) and returns it.
   */
  public queryCircle(x: number, y: number, radius: number, out: T[] = []): T[] {
    out.length = 0;
    this.seenIds.clear();

    const r = Math.max(0, radius);
    const minCx = Math.floor((x - r) * this.invCellSize);
    const maxCx = Math.floor((x + r) * this.invCellSize);
    const minCy = Math.floor((y - r) * this.invCellSize);
    const maxCy = Math.floor((y + r) * this.invCellSize);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.buckets.get(this.hashCoords(cx, cy));
        if (!bucket || bucket.length === 0) continue;

        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i]!;
          if (this.seenIds.has(item.id)) continue;
          this.seenIds.add(item.id);

          const sumR = r + item.radius;
          if (distanceSq(x, y, item.x, item.y) <= sumR * sumR) {
            out.push(item);
          }
        }
      }
    }

    return out;
  }

  public getActiveCellCount(): number {
    let count = 0;
    for (const bucket of this.buckets.values()) {
      if (bucket.length > 0) count += 1;
    }
    return count;
  }
}
