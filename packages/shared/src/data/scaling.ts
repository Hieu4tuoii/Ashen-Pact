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
    enemyHpMultiplier: 1.55,
    waveCountMultiplier: 1.4,
    eliteChance: 0.15,
    bossHpMultiplier: 1.9,
    enemyFireRateBonus: 0.08,
  },
  3: {
    playerCount: 3,
    enemyHpMultiplier: 2.05,
    waveCountMultiplier: 1.75,
    eliteChance: 0.2,
    bossHpMultiplier: 2.8,
    enemyFireRateBonus: 0.16,
  },
  4: {
    playerCount: 4,
    enemyHpMultiplier: 2.55,
    waveCountMultiplier: 2.05,
    eliteChance: 0.25,
    bossHpMultiplier: 3.7,
    enemyFireRateBonus: 0.24,
  },
};

export interface BiomeScalingTier {
  biome: 1 | 2 | 3;
  hpMultiplier: number;
  cooldownScale: number;
  projectileSpeedMultiplier: number;
  eliteBonusMultiplier: number;
  eliteDamageBonus: number;
}

export const BIOME_SCALING: Record<1 | 2 | 3, BiomeScalingTier> = {
  1: {
    biome: 1,
    hpMultiplier: 1.0,
    cooldownScale: 1.0,
    projectileSpeedMultiplier: 1.12,
    eliteBonusMultiplier: 1.0,
    eliteDamageBonus: 1,
  },
  2: {
    biome: 2,
    hpMultiplier: 1.12,
    cooldownScale: 0.92,
    projectileSpeedMultiplier: 1.14,
    eliteBonusMultiplier: 1.08,
    eliteDamageBonus: 1,
  },
  3: {
    biome: 3,
    hpMultiplier: 1.63,
    cooldownScale: 0.805,
    projectileSpeedMultiplier: 1.15,
    eliteBonusMultiplier: 1.16,
    eliteDamageBonus: 2,
  },
};
