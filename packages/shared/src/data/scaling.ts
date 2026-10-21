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
    enemyHpMultiplier: 1.72,
    waveCountMultiplier: 1.4,
    eliteChance: 0.15,
    bossHpMultiplier: 2.05,
    enemyFireRateBonus: 0.08,
  },
  3: {
    playerCount: 3,
    enemyHpMultiplier: 2.3,
    waveCountMultiplier: 1.75,
    eliteChance: 0.2,
    bossHpMultiplier: 3.25,
    enemyFireRateBonus: 0.16,
  },
  4: {
    playerCount: 4,
    enemyHpMultiplier: 2.9,
    waveCountMultiplier: 2.05,
    eliteChance: 0.25,
    bossHpMultiplier: 4.65,
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
    projectileSpeedMultiplier: 1.0,
    eliteBonusMultiplier: 1.0,
    eliteDamageBonus: 1,
  },
  2: {
    biome: 2,
    hpMultiplier: 1.27,
    cooldownScale: 0.91,
    projectileSpeedMultiplier: 1.06,
    eliteBonusMultiplier: 1.08,
    eliteDamageBonus: 1,
  },
  3: {
    biome: 3,
    hpMultiplier: 1.48,
    cooldownScale: 0.85,
    projectileSpeedMultiplier: 1.12,
    eliteBonusMultiplier: 1.16,
    eliteDamageBonus: 2,
  },
};
