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
    enemyHpMultiplier: 1.9,
    waveCountMultiplier: 1.52,
    eliteChance: 0.15,
    bossHpMultiplier: 1.92,
    enemyFireRateBonus: 0.08,
  },
  3: {
    playerCount: 3,
    enemyHpMultiplier: 2.5,
    waveCountMultiplier: 1.85,
    eliteChance: 0.2,
    bossHpMultiplier: 2.95,
    enemyFireRateBonus: 0.16,
  },
  4: {
    playerCount: 4,
    enemyHpMultiplier: 2.9,
    waveCountMultiplier: 2.15,
    eliteChance: 0.25,
    bossHpMultiplier: 3.85,
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
  bossHpScale?: number;
}

export const BIOME_SCALING: Record<1 | 2 | 3, BiomeScalingTier> = {
  1: {
    biome: 1,
    hpMultiplier: 1.0,
    cooldownScale: 1.0,
    projectileSpeedMultiplier: 1.0,
    eliteBonusMultiplier: 1.0,
    eliteDamageBonus: 1,
    bossHpScale: 1.54,
  },
  2: {
    biome: 2,
    hpMultiplier: 1.16,
    cooldownScale: 1.01,
    projectileSpeedMultiplier: 1.06,
    eliteBonusMultiplier: 1.06,
    eliteDamageBonus: 1,
    bossHpScale: 1.09,
  },
  3: {
    biome: 3,
    hpMultiplier: 1.35,
    cooldownScale: 0.89,
    projectileSpeedMultiplier: 1.12,
    eliteBonusMultiplier: 1.12,
    eliteDamageBonus: 2,
    bossHpScale: 2.52,
  },
};
