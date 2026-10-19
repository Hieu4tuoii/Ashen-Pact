/**
 * Hash a string or number seed into an unsigned 32-bit integer using FNV-1a.
 */
export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number' && Number.isInteger(seed)) {
    const n = seed >>> 0;
    return n === 0 ? 0x6d2b79f5 : n;
  }
  const str = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const out = h >>> 0;
  return out === 0 ? 0x6d2b79f5 : out;
}

/**
 * Deterministic Seeded PRNG based on Mulberry32.
 * Used across map generation, loot rolls, AI decisions, and deterministic projectiles.
 */
export class SeededRandom {
  private state: number;
  public readonly initialSeed: number;

  constructor(seed: string | number = 0x1337c0de) {
    this.initialSeed = hashSeed(seed);
    this.state = this.initialSeed;
  }

  /**
   * Returns a deterministic float in [0, 1).
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this.state = t >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a deterministic float in [min, max).
   */
  public nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Returns a deterministic integer in [min, max] (inclusive).
   */
  public nextInt(min: number, max: number): number {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return Math.floor(this.next() * (hi - lo + 1)) + lo;
  }

  /**
   * Returns true with probability p in [0, 1].
   */
  public chance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.next() < probability;
  }

  /**
   * Picks a random element from a non-empty array.
   */
  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    const idx = this.nextInt(0, items.length - 1);
    return items[idx] as T;
  }

  /**
   * Returns a new shuffled copy of an array (Fisher-Yates).
   */
  public shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const tmp = copy[i] as T;
      copy[i] = copy[j] as T;
      copy[j] = tmp;
    }
    return copy;
  }

  /**
   * Creates an independent child PRNG stream derived from current state + salt.
   */
  public fork(salt: string | number): SeededRandom {
    const combined = (this.state ^ hashSeed(salt)) >>> 0;
    return new SeededRandom(combined);
  }

  public getState(): number {
    return this.state;
  }

  public setState(state: number): void {
    this.state = state >>> 0;
  }
}
