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

export type WeaponCadenceKind = 'CLIP_RELOAD' | 'HEAT_VENT' | 'MELEE_COMBO';

export type PlayerSlot = 1 | 2 | 3 | 4;

export type ElementalReactionId =
  'vaporize' | 'shatter' | 'superconduct' | 'toxic_blast' | 'paralysis' | 'overload';

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
  baseDamage?: number;
  pelletCount: number;
  fireRate: number;
  cooldownSec?: number;
  cadenceKind: WeaponCadenceKind;
  clipSize: number;
  reloadDurationSec: number;
  reloadSec?: number;
  heatPerShot: number;
  heatPerSec?: number;
  procCoefficient: number;
  procCoeff?: number;
  submunitionProcCoefficient?: number;
  projectileSpeed: number;
  spreadDeg: number;
  critChance: number;
  pierceCount: number;
  pierce?: number;
  bounceCount: number;
  bounce?: number;
  knockback: number;
  element: ElementType;
  destroysEnemyBullets: boolean;
  comboHits?: number;
  comboRecoverySec?: number;
  range?: number;
  comboDamages?: readonly [number, number, number];
  comboKnockbacks?: readonly [number, number, number];
  finaleDamage?: number;
  finaleElement?: ElementType;
  chargedDamage?: number;
  chargedHoldSec?: number;
  chargedPierceCount?: number;
  chargedKnockback?: number;
}

export type EnemyRole =
  | 'ranged'
  | 'charger'
  | 'exploder'
  | 'summoner_healer'
  | 'turret'
  | 'splitter'
  | 'shielder'
  | 'stalker'
  | 'boss';

export type EliteModifier =
  | 'fast'
  | 'shield'
  | 'explosive_death'
  | 'regen'
  | 'volley'
  | 'vengeful';

export type RoomType =
  'start' | 'combat' | 'treasure' | 'merchant' | 'shrine' | 'secret' | 'portal' | 'boss';

export type RoomDiscoveryState = 'hidden' | 'discovered' | 'visited' | 'cleared';

export type CardinalDir = 'N' | 'E' | 'S' | 'W';

export type ActionBlessingId =
  | 'table_tech_rocket'
  | 'table_tech_blank_nova'
  | 'table_tech_prism_split'
  | 'table_tech_billiard_master'
  | 'table_tech_toxic_shrapnel'
  | 'table_tech_magnet_snare'
  | 'dash_tidal_ram'
  | 'dash_venom_wake'
  | 'dash_flame_shackle'
  | 'dash_reload_acrobat'
  | 'dash_thunder_decoy'
  | 'dash_phase_blade'
  | 'reload_tediore_chuck'
  | 'reload_frost_nova'
  | 'reload_magnet_vortex'
  | 'reload_repulsor_shock'
  | 'reload_caustic_pod'
  | 'reload_holster_surge'
  | 'bullet_split_bounce'
  | 'bullet_ricochet_boom'
  | 'bullet_heavy_pinball'
  | 'bullet_coop_arc_relay'
  | 'bullet_wall_tether'
  | 'bullet_orbit_return';

export type SkillUpgradeId =
  | 'vanguard_bastion_prism'
  | 'vanguard_charge'
  | 'ranger_arrow_volley'
  | 'ranger_prey_chain'
  | 'elementalist_vortex'
  | 'elementalist_twin_orbit'
  | 'druid_poison_roots'
  | 'druid_sacred_grove'
  | 'engineer_twin_turrets'
  | 'engineer_self_destruct';

export type BlessingId = ActionBlessingId | SkillUpgradeId;

export type BuffId = BlessingId;

export type WeaponMutatorId =
  | 'mutator_finale_jolt'
  | 'mutator_gravity_singularity'
  | 'mutator_shockwave_edge'
  | 'mutator_chain_harpoon'
  | 'mutator_prism_splitter'
  | 'mutator_thermal_meltdown'
  | 'mutator_holo_decoy_gun'
  | 'mutator_cluster_mortar'
  | 'mutator_boomerang_core'
  | 'mutator_elemental_infusion';

export type DuoBoonId =
  | 'duo_superheated_cyclone'
  | 'duo_cryo_shatter_spires'
  | 'duo_superconduct_rail'
  | 'duo_napalm_chain_plague'
  | 'duo_plasma_overload_star'
  | 'duo_magnetic_bastion_ring';

export type AshenPactId =
  | 'pact_soul_chain'
  | 'pact_shattered_glass'
  | 'pact_searing_trigger'
  | 'pact_volatile_arsenal'
  | 'pact_ashen_hunted'
  | 'pact_ricochet_vow';

export type AshenRelicId =
  | 'relic_blood_oath_tether'
  | 'relic_black_crystal_heart'
  | 'relic_perpetual_core'
  | 'relic_master_forge_seal'
  | 'relic_executioner_scythe'
  | 'relic_ancient_geometry_eye';

export type BlessingGroup =
  | 'table_tech'
  | 'dash_tech'
  | 'reload_tech'
  | 'bullet_mod'
  | 'skill_upgrade';

export interface BuffDef {
  id: BlessingId;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn?: string;
  category: 'general' | 'skill_upgrade';
  blessingGroup?: BlessingGroup;
  element?: ElementType;
  characterId?: CharacterId;
  accentColor: string;
}

export interface BlessingDef extends BuffDef {
  descriptionEn: string;
  blessingGroup: BlessingGroup;
  element: ElementType;
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
