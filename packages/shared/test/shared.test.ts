import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  COOP_SCALING,
  ENEMIES,
  FixedTimestepLoop,
  SeededRandom,
  SIM_STEP_MS,
  VIETNAMESE_VERIFICATION_STRING,
  WEAPONS,
  circleVsAABB,
  circleVsCircle,
  dequantizeAngle,
  dequantizeCoord,
  quantizeAngle,
  quantizeCoord,
} from '../src/index.js';

describe('SeededRandom (PRNG)', () => {
  it('produces identical sequences for the same numeric or string seed', () => {
    const rngA = new SeededRandom('ashen-pact-seed-42');
    const rngB = new SeededRandom('ashen-pact-seed-42');

    const seqA = Array.from({ length: 20 }, () => rngA.next());
    const seqB = Array.from({ length: 20 }, () => rngB.next());

    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds (including floats) and forks cleanly', () => {
    const rngA = new SeededRandom(12345);
    const rngB = new SeededRandom(54321);
    expect(rngA.next()).not.toBe(rngB.next());

    const rngFloat1 = new SeededRandom(0.25);
    const rngFloat2 = new SeededRandom(0.75);
    expect(rngFloat1.next()).not.toBe(rngFloat2.next());

    const fork1 = rngA.fork('loot');
    const fork2 = rngA.fork('map');
    expect(fork1.next()).not.toBe(fork2.next());
  });

  it('keeps nextInt within inclusive bounds and throws on empty pick', () => {
    const rng = new SeededRandom(999);
    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(3, 7);
      expect(val).toBeGreaterThanOrEqual(3);
      expect(val).toBeLessThanOrEqual(7);
      expect(Number.isInteger(val)).toBe(true);
    }
    expect(() => rng.pick([])).toThrow('Cannot pick from an empty array');
  });
});

describe('FixedTimestepLoop (60Hz)', () => {
  it('executes exact ticks and computes interpolation alpha', () => {
    const loop = new FixedTimestepLoop(60);
    let ticks = 0;

    // Half step -> 0 ticks, alpha ~ 0.5
    const half = loop.step(SIM_STEP_MS * 0.5, () => {
      ticks += 1;
    });
    expect(half.ticksExecuted).toBe(0);
    expect(half.alpha).toBeCloseTo(0.5, 4);

    // Another 1.25 steps -> total 1.75 steps -> 1 tick executed, alpha ~ 0.75
    const next = loop.step(SIM_STEP_MS * 1.25, () => {
      ticks += 1;
    });
    expect(next.ticksExecuted).toBe(1);
    expect(ticks).toBe(1);
    expect(next.tick).toBe(1);
    expect(next.alpha).toBeCloseTo(0.75, 4);
  });

  it('clamps huge delta spikes to prevent spiral of death', () => {
    const loop = new FixedTimestepLoop(60);
    const res = loop.step(5000, () => {});
    expect(res.ticksExecuted).toBeLessThanOrEqual(10);
  });
});

describe('Collision & Network Quantization', () => {
  it('detects circle-circle and circle-AABB collisions accurately', () => {
    expect(circleVsCircle({ x: 0, y: 0, radius: 10 }, { x: 15, y: 0, radius: 6 })).toBe(true);
    expect(circleVsCircle({ x: 0, y: 0, radius: 10 }, { x: 25, y: 0, radius: 6 })).toBe(false);

    const wall = { minX: 32, minY: 32, maxX: 64, maxY: 64 };
    expect(circleVsAABB({ x: 25, y: 48, radius: 8 }, wall)).toBe(true);
    expect(circleVsAABB({ x: 10, y: 48, radius: 8 }, wall)).toBe(false);
  });

  it('quantizes and dequantizes coordinates and angles within expected tolerance', () => {
    const x = 482.34;
    const qx = quantizeCoord(x);
    expect(dequantizeCoord(qx)).toBeCloseTo(482.3, 1);

    const angle = -1.5708;
    const qa = quantizeAngle(angle);
    expect(dequantizeAngle(qa)).toBeCloseTo(-1.571, 3);
  });
});

describe('Data-Driven Tables & Vietnamese String', () => {
  it('defines all 5 playable characters with valid starter weapons', () => {
    const charIds = Object.keys(CHARACTERS);
    expect(charIds).toEqual(['vanguard', 'ranger', 'elementalist', 'druid', 'engineer']);
    for (const char of Object.values(CHARACTERS)) {
      expect(char.hp).toBeGreaterThan(0);
      expect(WEAPONS[char.starterWeaponId]).toBeDefined();
      expect(char.skill.upgrades).toHaveLength(2);
    }
  });

  it('defines Biome 1 enemies and Co-op scaling tiers 1..4', () => {
    expect(ENEMIES.goblin_shooter?.hp).toBe(24);
    expect(COOP_SCALING[1].enemyHpMultiplier).toBe(1.0);
    expect(COOP_SCALING[4].enemyHpMultiplier).toBe(2.55);
    expect(VIETNAMESE_VERIFICATION_STRING).toContain('ắ ằ ẳ ẵ ặ');
    expect(VIETNAMESE_VERIFICATION_STRING).toContain('Đ đ');
  });
});
