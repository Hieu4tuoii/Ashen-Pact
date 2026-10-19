export type CharacterId = 'vanguard' | 'ranger' | 'elementalist' | 'druid' | 'engineer';

export type ElementType = 'none' | 'burn' | 'chill' | 'shock' | 'poison';

export type WeaponRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type WeaponCategory =
  | 'melee'
  | 'pistol'
  | 'smg'
  | 'shotgun'
  | 'rifle'
  | 'crossbow'
  | 'staff'
  | 'laser'
  | 'launcher'
  | 'coop_special';

export type PlayerSlot = 1 | 2 | 3 | 4;

export interface CharacterSkillDef {
  id: string;
  nameVi: string;
  nameEn: string;
  cooldownSec: number;
  durationSec: number;
  descriptionVi: string;
  upgrades: readonly [
    { id: string; nameVi: string; descriptionVi: string },
    { id: string; nameVi: string; descriptionVi: string },
  ];
}

export interface CharacterStatsDef {
  id: CharacterId;
  nameVi: string;
  nameEn: string;
  titleVi: string;
  hp: number;
  armor: number;
  energy: number;
  armorRegenDelaySec: number;
  armorRegenPerSec: number;
  moveSpeed: number;
  speedMultiplierPct: number;
  baseCritChance: number;
  starterWeaponId: string;
  passiveNameVi: string;
  passiveDescriptionVi: string;
  skill: CharacterSkillDef;
}

export interface WeaponStatsDef {
  id: string;
  nameVi: string;
  nameEn: string;
  rarity: WeaponRarity;
  category: WeaponCategory;
  damage: number;
  pelletCount: number;
  fireRate: number;
  energyCost: number;
  projectileSpeed: number;
  spreadDeg: number;
  critChance: number;
  pierceCount: number;
  bounceCount: number;
  knockback: number;
  element: ElementType;
  destroysEnemyBullets: boolean;
}

export type EnemyRole = 'ranged' | 'charger' | 'exploder' | 'summoner_healer' | 'turret' | 'splitter' | 'shielder';

export interface EnemyStatsDef {
  id: string;
  nameVi: string;
  nameEn: string;
  biome: 1 | 2 | 3;
  role: EnemyRole;
  hp: number;
  moveSpeed: number;
  damage: number;
  radius: number;
  telegraphSec: number;
  attackCooldownSec: number;
}

export interface CoopScalingTier {
  playerCount: 1 | 2 | 3 | 4;
  enemyHpMultiplier: number;
  waveCountMultiplier: number;
  eliteChance: number;
  bossHpMultiplier: number;
  enemyFireRateBonus: number;
}
