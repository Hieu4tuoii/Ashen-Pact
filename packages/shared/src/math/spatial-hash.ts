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
  private readonly fastBuckets: T[][] = Array.from({ length: 32 * 16 }, () => []);
  private readonly buckets = new Map<number, T[]>();
  private readonly activeBuckets: T[][] = [];
  private readonly seenIds = new Set<number>();
  private readonly seenById = new Int32Array(16384);
  private seenStamp = 1;

  constructor(cellSize = 64) {
    this.cellSize = Math.max(8, cellSize);
    this.invCellSize = 1 / this.cellSize;
  }

  private hashCoords(cx: number, cy: number): number {
    // Pack two signed 16-bit cell coordinates into a single 32-bit integer key
    return ((cx & 0xffff) << 16) | (cy & 0xffff);
  }

  private getBucket(cx: number, cy: number): T[] | undefined {
    if (cx >= 0 && cx < 32 && cy >= 0 && cy < 16) {
      return this.fastBuckets[(cy << 5) | cx];
    }
    return this.buckets.get(this.hashCoords(cx, cy));
  }

  public clear(): void {
    for (let i = 0; i < this.activeBuckets.length; i++) {
      this.activeBuckets[i]!.length = 0;
    }
    this.activeBuckets.length = 0;
  }

  public insert(item: T): void {
    const r = Math.max(0, item.radius);
    const minCx = Math.floor((item.x - r) * this.invCellSize);
    const maxCx = Math.floor((item.x + r) * this.invCellSize);
    const minCy = Math.floor((item.y - r) * this.invCellSize);
    const maxCy = Math.floor((item.y + r) * this.invCellSize);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        let bucket: T[];
        if (cx >= 0 && cx < 32 && cy >= 0 && cy < 16) {
          bucket = this.fastBuckets[(cy << 5) | cx]!;
        } else {
          const key = this.hashCoords(cx, cy);
          let b = this.buckets.get(key);
          if (!b) {
            b = [];
            this.buckets.set(key, b);
          }
          bucket = b;
        }
        if (bucket.length === 0) {
          this.activeBuckets.push(bucket);
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
    if (this.activeBuckets.length === 0) return out;

    const r = Math.max(0, radius);
    const minCx = Math.floor((x - r) * this.invCellSize);
    const maxCx = Math.floor((x + r) * this.invCellSize);
    const minCy = Math.floor((y - r) * this.invCellSize);
    const maxCy = Math.floor((y + r) * this.invCellSize);

    if (minCx === maxCx && minCy === maxCy) {
      const bucket = this.getBucket(minCx, minCy);
      if (!bucket || bucket.length === 0) return out;
      for (let i = 0; i < bucket.length; i++) {
        const item = bucket[i]!;
        const sumR = r + item.radius;
        if (distanceSq(x, y, item.x, item.y) <= sumR * sumR) {
          out.push(item);
        }
      }
      return out;
    }

    let stamp = (this.seenStamp + 1) | 0;
    if (stamp <= 0) {
      stamp = 1;
      this.seenById.fill(0);
    }
    this.seenStamp = stamp;
    let usedFallbackSet = false;

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.getBucket(cx, cy);
        if (!bucket || bucket.length === 0) continue;

        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i]!;
          const id = item.id;
          if (id >= 0 && id < 16384) {
            if (this.seenById[id] === stamp) continue;
            this.seenById[id] = stamp;
          } else {
            if (!usedFallbackSet) {
              this.seenIds.clear();
              usedFallbackSet = true;
            }
            if (this.seenIds.has(id)) continue;
            this.seenIds.add(id);
          }

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
    return this.activeBuckets.length;
  }
}
