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

export type ElementalReactionId =
  | 'vaporize'
  | 'shatter'
  | 'superconduct'
  | 'toxic_blast'
  | 'paralysis'
  | 'overload';

export interface ElementalReactionMeta {
  id: ElementalReactionId;
  nameVi: string;
  nameEn: string;
  comboLabelVi: string;
  effectVi: string;
  colorHex: string;
}

export interface CharacterSkillDef {
  id: string;
  nameVi: string;
  nameEn: string;
  cooldownSec: number;
  durationSec: number;
  descriptionVi: string;
  synergyVi?: string;
  upgrades: readonly [
    { id: BuffId | string; nameVi: string; descriptionVi: string },
    { id: BuffId | string; nameVi: string; descriptionVi: string },
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

export type EnemyRole =
  | 'ranged'
  | 'charger'
  | 'exploder'
  | 'summoner_healer'
  | 'turret'
  | 'splitter'
  | 'shielder'
  | 'boss';

export type EliteModifier = 'fast' | 'shield' | 'explosive_death' | 'regen';

export type RoomType =
  | 'start'
  | 'combat'
  | 'treasure'
  | 'merchant'
  | 'shrine'
  | 'secret'
  | 'portal'
  | 'boss';

export type RoomDiscoveryState = 'hidden' | 'discovered' | 'visited' | 'cleared';

export type CardinalDir = 'N' | 'E' | 'S' | 'W';

export type BuffId =
  | 'vitality_surge'
  | 'iron_bastion'
  | 'arcane_wellspring'
  | 'eagle_precision'
  | 'gale_reflex'
  | 'ricochet_mastery'
  | 'vanguard_fortress'
  | 'vanguard_charge'
  | 'ranger_arrow_volley'
  | 'ranger_prey_chain'
  | 'elementalist_vortex'
  | 'elementalist_dual'
  | 'druid_poison_roots'
  | 'druid_sacred_grove'
  | 'engineer_twin_turrets'
  | 'engineer_self_destruct';

export interface BuffDef {
  id: BuffId;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  category: 'general' | 'skill_upgrade';
  characterId?: CharacterId;
  accentColor: string;
}

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
  isBoss?: boolean;
  subtitleVi?: string;
  flying?: boolean;
  frontShieldReduction?: number;
  isIllusion?: boolean;
}


export interface CoopScalingTier {
  playerCount: 1 | 2 | 3 | 4;
  enemyHpMultiplier: number;
  waveCountMultiplier: number;
  eliteChance: number;
  bossHpMultiplier: number;
  enemyFireRateBonus: number;
}

