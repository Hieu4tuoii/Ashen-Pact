import { describe, expect, it } from 'vitest';
import {
  getClientFreezeRandom,
  parseVisualQuery,
  resetClientFreezeRandom,
} from '../src/core/visual-query.js';

describe('visual-query parser and deterministic client RNG', () => {
  it('parses ?seed= (decimal, hex, invalid fallback), ?freeze=1, ?lighting=0, ?debug=0|1, ?testHooks=1', () => {
    const def = parseVisualQuery('');
    expect(def.seed).toBe(0x1337c0de);
    expect(def.freeze).toBe(false);
    expect(def.lightingEnabled).toBe(true);
    expect(def.debugParam).toBeNull();
    expect(def.testHooksParam).toBe(false);

    const custom = parseVisualQuery('?seed=12345&freeze=1&lighting=0&debug=0&testHooks=1');
    expect(custom.seed).toBe(12345);
    expect(custom.freeze).toBe(true);
    expect(custom.lightingEnabled).toBe(false);
    expect(custom.debugParam).toBe(false);
    expect(custom.testHooksParam).toBe(true);

    const hex = parseVisualQuery('?seed=0xdeadbeef&debug=1');
    expect(hex.seed).toBe(0xdeadbeef);
    expect(hex.debugParam).toBe(true);

    const invalid = parseVisualQuery('?seed=notanumber');
    expect(invalid.seed).toBe(0x1337c0de);
  });

  it('produces identical random sequences when reset with the same seed', () => {
    resetClientFreezeRandom(42);
    const rng1 = getClientFreezeRandom(true);
    const seq1 = [rng1(), rng1(), rng1(), rng1()];

    resetClientFreezeRandom(42);
    const rng2 = getClientFreezeRandom(true);
    const seq2 = [rng2(), rng2(), rng2(), rng2()];

    expect(seq1).toEqual(seq2);
  });
});
