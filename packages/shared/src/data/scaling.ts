import type { CoopScalingTier } from './types.js';

export const COOP_SCALING: Record<1 | 2 | 3 | 4, CoopScalingTier> = {
  1: {
    playerCount: 1,
    enemyHpMultiplier: 1.0,
    waveCountMultiplier: 1.0,
    eliteChance: 0.1,
    bossHpMultiplier: 1.0,
    enemyFireRateBonus: 0,
  },
  2: {
    playerCount: 2,
    enemyHpMultiplier: 1.4,
    waveCountMultiplier: 1.35,
    eliteChance: 0.15,
    bossHpMultiplier: 1.9,
    enemyFireRateBonus: 0.08,
  },
  3: {
    playerCount: 3,
    enemyHpMultiplier: 1.8,
    waveCountMultiplier: 1.7,
    eliteChance: 0.2,
    bossHpMultiplier: 2.8,
    enemyFireRateBonus: 0.16,
  },
  4: {
    playerCount: 4,
    enemyHpMultiplier: 2.2,
    waveCountMultiplier: 2.0,
    eliteChance: 0.25,
    bossHpMultiplier: 3.7,
    enemyFireRateBonus: 0.24,
  },
};
