import { ALL_BOSS_IDS } from '../data/enemies.js';
import type { CardinalDir, CharacterId, EliteModifier, ElementType, RoomType, WeaponRarity } from '../data/types.js';
import { ALL_WEAPON_IDS, MAX_WEAPON_SLOTS, PHASE6_WEAPON_IDS, estimateWeaponDps } from '../data/weapons.js';
import { clamp } from '../math/vec2.js';
import type { QuickEmoteId } from '../protocol/messages.js';

export const PHASE1_SAMPLE_WEAPONS = [
  'knight_sword',
  'rusty_pistol',
] as const;

export type Phase1WeaponId = (typeof PHASE1_SAMPLE_WEAPONS)[number];

export const PHASE1_SAMPLE_ENEMIES = ['goblin_shooter', 'wild_boar', 'spore_bomber'] as const;

export type Phase1EnemyId = (typeof PHASE1_SAMPLE_ENEMIES)[number];

export const BIOME1_ENEMY_IDS = [
  'goblin_shooter',
  'wild_boar',
  'spore_bomber',
  'green_slime',
  'mini_slime',
  'goblin_shaman',
  'thorn_turret',
  'spore_guardian',
  'spore_king',
] as const;

export const BIOME2_ENEMY_IDS = [
  'frost_bat',
  'baby_yeti',
  'ice_mage',
  'ice_golem',
  'snow_spirit',
  'kryssa_clone',
  'ice_prison',
  'kryssa_ice_queen',
] as const;

export const BIOME3_ENEMY_IDS = [
  'fire_imp',
  'dwarf_cannon',
  'coal_golem',
  'welder_drone',
  'iron_shielder',
  'forge_energy_core',
  'forge_titan',
] as const;

export { ALL_BOSS_IDS, ALL_WEAPON_IDS, MAX_WEAPON_SLOTS, PHASE6_WEAPON_IDS, estimateWeaponDps };

export const ELEMENT_CYCLE_ORDER: readonly ElementType[] = [
  'none',
  'burn',
  'chill',
  'shock',
  'poison',
] as const;

export const ELEMENTALIST_ROTATION_ORDER: readonly ElementType[] = [
  'burn',
  'chill',
  'shock',
] as const;

export const ALL_CHARACTER_IDS: readonly CharacterId[] = [
  'vanguard',
  'ranger',
  'elementalist',
  'druid',
  'engineer',
] as const;

export const PLAYER_RADIUS = 13;
export const DASH_DURATION_SEC = 0.22;
export const DASH_IFRAME_SEC = 0.2;
export const DASH_COOLDOWN_SEC = 1.2;
export const DASH_SPEED_MULTIPLIER = 2.6;
export const ENEMY_SPAWN_WARMUP_SEC = 0.8;
export const SPORE_EXPLOSION_RADIUS = 68;
export const BARREL_EXPLOSION_RADIUS = 88;
export const BOAR_CHARGE_SPEED = 380;
export const BOAR_CHARGE_DURATION_SEC = 0.55;
export const MELEE_RANGE = 50;
export const BOSS_ERUPT_RADIUS = 84;
export const SHAMAN_HEAL_RADIUS = 220;
export const DOWNED_BLEEDOUT_SEC = 20.0;
export const REVIVE_HOLD_DURATION_SEC = 2.5;
export const DRUID_REVIVE_HOLD_DURATION_SEC = 1.25;

export type EnemyAIState =
  'spawning' | 'idle' | 'move' | 'telegraph' | 'attack' | 'cooldown' | 'stunned';

export type PropKind =
  | 'wooden_crate'
  | 'clay_vase'
  | 'explosive_barrel'
  | 'torch_brazier'
  | 'glow_mushroom'
  | 'ancient_mechanism'
  | 'crystal_pillar';

export interface SimPropState {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  destructible: boolean;
  explosive: boolean;
  blocksMovement: boolean;
  lightRadius: number;
  lightColorHex: string;
  hitFlashTimer: number;
  fuseTimer: number;
  repaired?: boolean;
}

export type SummonKind = 'sacred_tree' | 'tesla_turret' | 'ancient_turret' | 'life_blossom';

export interface SimSummonState {
  id: number;
  ownerPlayerId: number;
  kind: SummonKind;
  nameVi: string;
  x: number;
  y: number;
  radius: number;
  auraRadius: number;
  hp: number;
  maxHp: number;
  ttlSec: number;
  maxTtlSec: number;
  tickTimer: number;
  healsRemaining: number;
  charge: number;
  poisonRoots: boolean;
  selfDestruct: boolean;
  rootedEnemyIds: number[];
}

export interface SimSkillZoneState {
  id: number;
  ownerPlayerId: number;
  x: number;
  y: number;
  radius: number;
  ttlSec: number;
  maxTtlSec: number;
  tickTimer: number;
  element: ElementType;
  secondaryElement: ElementType;
  vortex: boolean;
}

export interface SimPressurePlateState {
  id: number;
  x: number;
  y: number;
  radius: number;
  pressed: boolean;
}

export interface SimPushBlockState {
  id: number;
  x: number;
  y: number;
  radius: number;
}

export interface SimShockwaveRingState {
  id: number;
  sourceEnemyId: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  thickness: number;
  damage: number;
  hitPlayerIds: number[];
}

export interface SimTetherBeamState {
  id: number;
  ownerPlayerId: number;
  targetEntityId: number;
  targetKind: 'player' | 'summon';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  damage: number;
  ttlSec: number;
  tickTimer: number;
}

export interface SimDoorState {
  dir: CardinalDir;
  targetRoomId: number;
  targetRoomType: RoomType;
  x: number;
  y: number;
  radius: number;
  locked: boolean;
  isSecretPassage: boolean;
}

export interface SimChestState {
  id: number;
  x: number;
  y: number;
  radius: number;
  rarity: WeaponRarity;
  opened: boolean;
  droppedWeaponId: string;
}

export interface SimWorldItemState {
  id: number;
  kind: 'weapon' | 'health_potion' | 'armor_upgrade';
  weaponId?: string;
  rarity: WeaponRarity;
  nameVi: string;
  costGold: number;
  healAmount: number;
  x: number;
  y: number;
  radius: number;
  pickedUp: boolean;
  offerId?: string;
  /** If set, instanced to a specific player (only that player can pick it up). If undefined/0, shared. */
  ownerPlayerId?: number;
  droppedByPlayerId?: number;
  droppedAtTick?: number;
  fromX?: number;
  fromY?: number;
  isHubRackItem?: boolean;
}

export interface SimNpcState {
  id: number;
  kind: 'merchant' | 'shrine';
  nameVi: string;
  dialogueVi: string;
  x: number;
  y: number;
  radius: number;
  interacted: boolean;
  costHp: number;
  costGold?: number;
}

export interface SimHubStatue {
  characterId: CharacterId;
  nameVi: string;
  titleVi: string;
  x: number;
  y: number;
  radius: number;
}

export type PingMarkerKind = 'enemy' | 'loot' | 'revive' | 'move';

export interface SimPingMarker {
  id: number;
  playerId: number;
  playerSlot: 1 | 2 | 3 | 4;
  kind: PingMarkerKind;
  labelVi: string;
  x: number;
  y: number;
  ttlSec: number;
}

export interface RunSummaryStats {
  kills: number;
  elitesKilled: number;
  bossesKilled: number;
  damageDealt: number;
  goldEarned: number;
  roomsCleared: number;
  chestsOpened: number;
  floorReached: number;
  ticksElapsed: number;
  elementalReactions: number;
  teamCombos: number;
}

export type MvpAwardCategory = 'damage' | 'medic' | 'elemental' | 'slayer';

export interface MvpAwardEntry {
  category: MvpAwardCategory;
  titleKey: string;
  descKey: string;
  playerId: number;
  playerSlot: 1 | 2 | 3 | 4;
  displayName: string;
  characterId: CharacterId;
  colorHex: string;
  value: number;
  secondaryValue: number;
}

export type PlayerLifeState = 'alive' | 'downed' | 'ghost';

export interface SimPlayerState {
  id: number;
  slot: 1 | 2 | 3 | 4;
  characterId: CharacterId;
  displayName: string;
  colorHex: string;
  prevX: number;
  prevY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kbVx: number;
  kbVy: number;
  radius: number;
  aimAngle: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  energy: number;
  maxEnergy: number;
  gold: number;
  moveSpeed: number;
  armorRegenDelaySec: number;
  armorRegenPerSec: number;
  armorRegenTimer: number;
  armorRegenAccum: number;
  dashTimer: number;
  dashCooldownTimer: number;
  dashDirX: number;
  dashDirY: number;
  invulnerableTimer: number;
  hurtFlashTimer: number;
  weaponSlots: string[];
  activeWeaponSlot: number;
  weaponPickupLockTimer?: number;
  fireCooldownTimer: number;
  recoilTimer: number;
  skillActiveTimer: number;
  skillCooldownTimer: number;
  shieldStoredBullets: number;
  godMode: boolean;
  lastProcessedSeq: number;
  // Phase 2 Elemental & Surface states
  activeImbueElement: ElementType;
  burnTimer: number;
  burnTickTimer: number;
  chillTimer: number;
  poisonTimer: number;
  poisonTickTimer: number;
  shockTimer: number;
  surfaceTickTimer: number;
  grassRustleCooldown: number;
  // Phase 4 Co-op states
  lifeState: PlayerLifeState;
  downedTimer: number;
  reviveProgress: number;
  reviverPlayerId: number | null;
  ready: boolean;
  pingMs: number;
  emoteId: QuickEmoteId | null;
  emoteTimer: number;
  currentRoomId: number;
  // Phase 6 Ice Prison & Chasm states
  encasedInIceTimer?: number;
  icePrisonId?: number;
  // Phase 7 Per-Player Run Statistics & MVP Awards
  statsDamageDealt?: number;
  statsDamageTaken?: number;
  statsKills?: number;
  statsRevives?: number;
  statsElementalReactions?: number;
  statsTeamCombos?: number;
}

export interface SimEnemyState {
  id: number;
  defId: string;
  nameVi: string;
  role: string;
  isDummy: boolean;
  prevX: number;
  prevY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kbVx: number;
  kbVy: number;
  radius: number;
  aimAngle: number;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  damage: number;
  aiState: EnemyAIState;
  stateTimer: number;
  attackCooldownTimer: number;
  telegraphDurationSec: number;
  telegraphAngle: number;
  telegraphRadius: number;
  telegraphLength: number;
  hitFlashTimer: number;
  strafeSign: number;
  // Phase 2 Elemental & Surface states
  burnTimer: number;
  burnTickTimer: number;
  chillTimer: number;
  chillStacks: number;
  frozenTimer: number;
  poisonTimer: number;
  poisonStacks: number;
  poisonTickTimer: number;
  shockTimer: number;
  surfaceTickTimer: number;
  grassRustleCooldown: number;
  // Phase 3 Elite & Boss states
  isElite: boolean;
  eliteModifier: EliteModifier | null;
  shieldArmor: number;
  maxShieldArmor: number;
  regenAccum: number;
  isBoss: boolean;
  bossPhase: 1 | 2 | 3;
  bossBurrowed: boolean;
  bossTargetX: number;
  bossTargetY: number;
  bossAttackCycle: number;
  // Phase 5 Synergy & Elemental Reaction states
  markedTimer: number;
  markedByPlayerId: number;
  superconductTimer: number;
  rootedTimer: number;
  steamBlindTimer: number;
  lastElementOwnerId: number;
  lastElementApplied: ElementType;
}

export interface SimProjectileState {
  id: number;
  ownerId: number;
  team: 'player' | 'enemy';
  weaponId: string;
  prevX: number;
  prevY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  damage: number;
  isCrit: boolean;
  knockback: number;
  pierceRemaining: number;
  bounceRemaining: number;
  ttlSec: number;
  element: ElementType;
  amplifiedByShield: boolean;
  imbuedByZone?: boolean;
  imbuedElement?: ElementType;
  imbuedSecondaryElement?: ElementType;
  imbuedOwnerId?: number;
  hitEntityIds: number[];
}

export interface SimPickupState {
  id: number;
  kind: 'energy' | 'gold' | 'life_seed';
  prevX: number;
  prevY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  amount: number;
  ttlSec: number;
  /** If set, instanced to a specific player (only that player can collect it). */
  ownerPlayerId?: number;
}

export interface BulletVolleySpawnEvent {
  kind: 'bullet_volley_spawned';
  tick: number;
  ownerId: number;
  team: 'player' | 'enemy';
  weaponId: string;
  x: number;
  y: number;
  angle: number;
  pelletCount: number;
  spreadRad: number;
  radialStepRad?: number;
  muzzleOffset?: number;
  speed: number;
  damage: number;
  radius: number;
  knockback: number;
  pierceCount: number;
  bounceCount: number;
  ttlSec: number;
  element: ElementType;
  critChance: number;
  amplifiedByShield: boolean;
  seed: number;
}


export function lerpSpeed(dist: number, maxRange: number, maxSpeed: number): number {
  const t = 1 - clamp(dist / maxRange, 0, 1);
  return 110 + t * (maxSpeed - 110);
}
