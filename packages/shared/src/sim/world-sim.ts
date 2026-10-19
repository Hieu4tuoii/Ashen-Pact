import { SeededRandom } from '../core/prng.js';
import { CHARACTERS } from '../data/characters.js';
import {
  BIOME1_COMBAT_ENEMIES,
  ELITE_MODIFIERS,
  ELITE_MODIFIER_LABELS_VI,
  ENEMIES,
  FLOOR_BUFFS,
  FLOOR_BUFF_LIST,
} from '../data/enemies.js';
import type {
  BuffId,
  CardinalDir,
  CharacterId,
  EliteModifier,
  ElementType,
  RoomType,
  WeaponRarity,
} from '../data/types.js';
import { PHASE3_WEAPON_IDS, WEAPONS } from '../data/weapons.js';
import { SpatialHashGrid } from '../math/spatial-hash.js';
import {
  angleDiff,
  approach,
  circleVsCircle,
  clamp,
  distance,
  distanceSq,
  isCircleInCone,
} from '../math/vec2.js';
import { COOP_SCALING } from '../data/scaling.js';
import {
  INPUT_BUTTON,
  PLAYER_SLOT_COLORS,
  type PlayerInputPacket,
  QUICK_EMOTES_VI,
  type QuickEmoteId,
  TILE_SIZE,
} from '../protocol/messages.js';
import { ArenaMap, type ArenaMapConfig, type SurfaceKind } from './arena-map.js';
import {
  type DungeonFloorGraph,
  type DungeonRoomNode,
  OPPOSITE_DIR,
  generateDungeonFloor,
} from './dungeon-gen.js';

export const PHASE1_SAMPLE_WEAPONS = [
  'knight_sword',
  'rusty_pistol',
  'scrap_shotgun',
  'gale_smg',
] as const;

export type Phase1WeaponId = (typeof PHASE1_SAMPLE_WEAPONS)[number];

export const PHASE1_SAMPLE_ENEMIES = [
  'goblin_shooter',
  'wild_boar',
  'spore_bomber',
] as const;

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

export const ELEMENT_CYCLE_ORDER: readonly ElementType[] = [
  'none',
  'burn',
  'chill',
  'shock',
  'poison',
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
  | 'spawning'
  | 'idle'
  | 'move'
  | 'telegraph'
  | 'attack'
  | 'cooldown'
  | 'stunned';

export type PropKind =
  | 'wooden_crate'
  | 'clay_vase'
  | 'explosive_barrel'
  | 'torch_brazier'
  | 'glow_mushroom';

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
  hitEntityIds: number[];
}

export interface SimPickupState {
  id: number;
  kind: 'energy' | 'gold';
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

export type SimEvent =
  | {
      kind: 'projectile_spawned';
      projectileId: number;
      weaponId: string;
      team: 'player' | 'enemy';
      x: number;
      y: number;
      angle: number;
    }
  | {
      kind: 'melee_swing';
      playerId: number;
      weaponId: string;
      x: number;
      y: number;
      angle: number;
      arcRad: number;
      range: number;
      bulletsDestroyed: number;
    }
  | {
      kind: 'damage_dealt';
      targetId: number;
      targetKind: 'player' | 'enemy';
      x: number;
      y: number;
      amount: number;
      isCrit: boolean;
      hitArmor: boolean;
      element: ElementType;
      knockbackX: number;
      knockbackY: number;
    }
  | {
      kind: 'projectile_impact';
      x: number;
      y: number;
      angle: number;
      team: 'player' | 'enemy';
      hitWall: boolean;
      destroyedByMelee: boolean;
      blockedByShield: boolean;
      isCrit: boolean;
      element?: ElementType;
    }
  | {
      kind: 'entity_killed';
      entityId: number;
      defId: string;
      x: number;
      y: number;
    }
  | {
      kind: 'dash_started';
      playerId: number;
      x: number;
      y: number;
      dirX: number;
      dirY: number;
    }
  | {
      kind: 'enemy_telegraph';
      enemyId: number;
      defId: string;
      x: number;
      y: number;
      angle: number;
      durationSec: number;
      radius: number;
    }
  | {
      kind: 'explosion';
      x: number;
      y: number;
      radius: number;
      damage: number;
      sourceDefId: string;
    }
  | {
      kind: 'skill_cast';
      playerId: number;
      skillId: string;
      x: number;
      y: number;
      angle: number;
    }
  | {
      kind: 'shield_shockwave';
      playerId: number;
      x: number;
      y: number;
      angle: number;
      storedBullets: number;
      damage: number;
    }
  | {
      kind: 'pickup_collected';
      pickupKind: 'energy' | 'gold';
      amount: number;
      x: number;
      y: number;
    }
  | {
      kind: 'weapon_swapped';
      weaponId: string;
      slot: number;
    }
  | {
      kind: 'hit_stop';
      durationMs: number;
      trauma: number;
    }
  | {
      kind: 'prop_destroyed';
      propId: number;
      propKind: PropKind;
      x: number;
      y: number;
    }
  | {
      kind: 'cracked_wall_broken';
      tx: number;
      ty: number;
      x: number;
      y: number;
    }
  | {
      kind: 'chain_lightning';
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }
  | {
      kind: 'status_applied';
      targetId: number;
      status: 'burn' | 'chill' | 'frozen' | 'shock' | 'poison' | 'shatter';
      x: number;
      y: number;
    }
  | {
      kind: 'surface_triggered';
      surface: SurfaceKind;
      x: number;
      y: number;
    }
  | {
      kind: 'grass_rustle';
      x: number;
      y: number;
    }
  | {
      kind: 'shaman_heal';
      shamanId: number;
      x: number;
      y: number;
      radius: number;
      healedCount: number;
    }
  | {
      kind: 'boss_spawned';
      enemyId: number;
      nameVi: string;
    }
  | {
      kind: 'boss_phase_changed';
      enemyId: number;
      phase: 1 | 2 | 3;
      x: number;
      y: number;
    }
  | {
      kind: 'room_entered';
      roomId: number;
      roomType: RoomType;
      floorNumber: number;
    }
  | {
      kind: 'room_cleared';
      roomId: number;
      roomType: RoomType;
    }
  | {
      kind: 'chest_opened';
      chestId: number;
      rarity: WeaponRarity;
      weaponId: string;
      x: number;
      y: number;
    }
  | {
      kind: 'item_purchased';
      itemId: number;
      nameVi: string;
      costGold: number;
      x: number;
      y: number;
    }
  | {
      kind: 'shrine_blessing';
      x: number;
      y: number;
      rewardTextVi: string;
    }
  | {
      kind: 'portal_entered';
      floorNumber: number;
    }
  | {
      kind: 'buff_selected';
      buffId: BuffId;
      nameVi: string;
    }
  | {
      kind: 'player_downed';
      playerId: number;
      x: number;
      y: number;
    }
  | {
      kind: 'player_revived';
      playerId: number;
      reviverId: number;
      x: number;
      y: number;
    }
  | {
      kind: 'player_ghost';
      playerId: number;
      x: number;
      y: number;
    }
  | {
      kind: 'players_teleported_to_room';
      roomId: number;
      x: number;
      y: number;
    }
  | {
      kind: 'ping_issued';
      pingId: number;
      playerId: number;
      playerSlot: 1 | 2 | 3 | 4;
      pingKind: PingMarkerKind;
      labelVi: string;
      x: number;
      y: number;
    }
  | {
      kind: 'emote_triggered';
      playerId: number;
      emoteId: QuickEmoteId;
      labelVi: string;
      x: number;
      y: number;
    }
  | {
      kind: 'character_selected';
      playerId: number;
      characterId: CharacterId;
      nameVi: string;
    };

export interface WorldSimOptions {
  seed?: string | number;
  mapConfig?: ArenaMapConfig;
  spawnInitialWave?: boolean;
  includeTrainingDummy?: boolean;
  includeProps?: boolean;
  autoRespawnWaves?: boolean;
  autoRevivePlayer?: boolean;
  startInHub?: boolean;
  coopMode?: boolean;
  playerCount?: 1 | 2 | 3 | 4;
}

interface CoPlayerInputEntry {
  current: PlayerInputPacket;
  prevButtons: number;
  latchedButtons: number;
  latchedWeaponSlot: number | null;
  energyRegenAccum: number;
}

/**
 * Pure TypeScript 60Hz Authoritative World Simulation (packages/shared).
 * Zero Phaser or DOM dependencies. Used identically by LocalTransport and server room.
 */
export class WorldSim {
  public readonly rng: SeededRandom;
  public readonly map: ArenaMap;
  public readonly enemySpatialGrid = new SpatialHashGrid<SimEnemyState>(64);
  public readonly bulletSpatialGrid = new SpatialHashGrid<SimProjectileState>(64);

  public tick = 0;
  public waveNumber = 0;
  public stressTestActive = false;
  public botAutoPlayActive = false;
  public player: SimPlayerState;
  public simulatedPlayers: SimPlayerState[] = [];
  public enemies: SimEnemyState[] = [];
  public projectiles: SimProjectileState[] = [];
  public pickups: SimPickupState[] = [];
  public props: SimPropState[] = [];

  // Phase 4 Hub & Co-op State
  public inHub = false;
  public coopModeActive = false;
  public allowDuplicateCharacters = false;
  public hubStatues: SimHubStatue[] = [];
  public pings: SimPingMarker[] = [];
  private coopPlayerCountOverride: (1 | 2 | 3 | 4) | null = null;
  private readonly coopPlayerInputs = new Map<number, CoPlayerInputEntry>();

  // Phase 3 Dungeon, Rooms, Chests, Shop, Shrine, Buffs & Run Loop
  public readonly baseSeed: string | number;
  public currentFloor = 1;
  public dungeon: DungeonFloorGraph;
  public currentRoomId = 0;
  public secretWallBroken = false;
  public doors: SimDoorState[] = [];
  public chests: SimChestState[] = [];
  public worldItems: SimWorldItemState[] = [];
  public npcEntities: SimNpcState[] = [];
  public portalActive = false;
  public portalX = 0;
  public portalY = 0;
  public runState: 'playing' | 'buff_choice' | 'victory' | 'defeat' = 'playing';
  public activeBuffIds: BuffId[] = [];
  public pendingBuffChoices: BuffId[] = [];
  public runStats: RunSummaryStats = {
    kills: 0,
    elitesKilled: 0,
    bossesKilled: 0,
    damageDealt: 0,
    goldEarned: 0,
    roomsCleared: 1,
    chestsOpened: 0,
    floorReached: 1,
    ticksElapsed: 0,
  };

  private nextEntityId = 100;
  private eventsBufferA: SimEvent[] = [];
  private eventsBufferB: SimEvent[] = [];
  private activeEventsBuffer: 'A' | 'B' = 'A';
  private readonly emptyEvents: SimEvent[] = [];
  private prevButtons = 0;
  private latchedButtons = 0;
  private latchedWeaponSlot: number | null = null;
  private currentInput: PlayerInputPacket = {
    seq: 0,
    tick: 0,
    moveX: 0,
    moveY: 0,
    aimAngle: 0,
    buttons: 0,
    weaponSlotSelect: null,
  };

  private readonly autoRespawnWaves: boolean;
  private readonly autoRevivePlayer: boolean;
  private waveRespawnTimer = 0;
  private doorTransitionCooldown = 0;
  private energyRegenAccum = 0;
  private readonly queryEnemyScratch: SimEnemyState[] = [];
  private readonly queryBulletScratch: SimProjectileState[] = [];
  private readonly projectilePool: SimProjectileState[] = [];
  private readonly pickupPool: SimPickupState[] = [];
  private readonly damageHistory: { tick: number; amount: number }[] = [];
  private readonly damageHistoryPool: { tick: number; amount: number }[] = [];
  private readonly roomItemsByRoomId = new Map<number, SimWorldItemState[]>();
  private readonly roomChestsByRoomId = new Map<number, SimChestState[]>();
  private readonly initializedRoomIds = new Set<number>([0]);

  constructor(options: WorldSimOptions = {}) {
    const seedVal = options.seed ?? 0x1337c0de;
    this.baseSeed = seedVal;
    this.rng = new SeededRandom(seedVal);
    this.coopModeActive = options.coopMode ?? Boolean(options.startInHub);
    if (options.playerCount) {
      this.coopPlayerCountOverride = options.playerCount;
    }

    const spawnWave = options.startInHub ? false : (options.spawnInitialWave ?? true);
    this.map = new ArenaMap({
      seed: seedVal,
      includeSurfaces: spawnWave,
      ...options.mapConfig,
    });
    this.autoRespawnWaves = options.autoRespawnWaves ?? true;
    this.autoRevivePlayer = options.autoRevivePlayer ?? true;

    const initialPCount = this.coopPlayerCountOverride ?? 1;
    this.dungeon = generateDungeonFloor(seedVal, 1, 1, initialPCount);
    this.currentRoomId = this.dungeon.startRoomId;

    const startX = this.map.width * 0.35;
    const startY = this.map.height * 0.5;
    this.player = this.createPlayerState(1, 1, 'vanguard', startX, startY);

    if (options.startInHub) {
      this.enterHub();
      return;
    }

    if (options.includeTrainingDummy ?? true) {
      this.spawnTrainingDummy(210, 260);
    }

    if (options.includeProps ?? spawnWave) {
      this.spawnDefaultArenaProps();
    }

    if (spawnWave) {
      this.spawnSampleWave();
    }

    this.rebuildCurrentRoomDoors();
  }

  private get events(): SimEvent[] {
    return this.activeEventsBuffer === 'A' ? this.eventsBufferA : this.eventsBufferB;
  }

  public createPlayerState(
    id: number,
    slot: 1 | 2 | 3 | 4,
    characterId: CharacterId,
    x: number,
    y: number,
    displayName?: string,
  ): SimPlayerState {
    const cDef = CHARACTERS[characterId] ?? CHARACTERS.vanguard;
    const starterWeapons =
      characterId === 'vanguard'
        ? [...PHASE1_SAMPLE_WEAPONS]
        : [cDef.starterWeaponId, 'rusty_pistol', 'scrap_shotgun', 'gale_smg'];
    return {
      id,
      slot,
      characterId,
      displayName: displayName ?? `${cDef.nameVi} P${slot}`,
      colorHex: PLAYER_SLOT_COLORS[slot],
      prevX: x,
      prevY: y,
      x,
      y,
      vx: 0,
      vy: 0,
      kbVx: 0,
      kbVy: 0,
      radius: PLAYER_RADIUS,
      aimAngle: 0,
      hp: cDef.hp,
      maxHp: cDef.hp,
      armor: cDef.armor,
      maxArmor: cDef.armor,
      energy: cDef.energy,
      maxEnergy: cDef.energy,
      gold: 0,
      moveSpeed: cDef.moveSpeed,
      armorRegenDelaySec: cDef.armorRegenDelaySec,
      armorRegenPerSec: cDef.armorRegenPerSec,
      armorRegenTimer: 0,
      armorRegenAccum: 0,
      dashTimer: 0,
      dashCooldownTimer: 0,
      dashDirX: 1,
      dashDirY: 0,
      invulnerableTimer: 0,
      hurtFlashTimer: 0,
      weaponSlots: starterWeapons,
      activeWeaponSlot: 0,
      fireCooldownTimer: 0,
      recoilTimer: 0,
      skillActiveTimer: 0,
      skillCooldownTimer: 0,
      shieldStoredBullets: 0,
      godMode: false,
      lastProcessedSeq: 0,
      activeImbueElement: 'none',
      burnTimer: 0,
      burnTickTimer: 0,
      chillTimer: 0,
      poisonTimer: 0,
      poisonTickTimer: 0,
      shockTimer: 0,
      surfaceTickTimer: 0,
      grassRustleCooldown: 0,
      lifeState: 'alive',
      downedTimer: 0,
      reviveProgress: 0,
      reviverPlayerId: null,
      ready: false,
      pingMs: 0,
      emoteId: null,
      emoteTimer: 0,
      currentRoomId: this.currentRoomId,
    };
  }

  private readonly allPlayersScratch: SimPlayerState[] = [];

  public getAllPlayers(): SimPlayerState[] {
    this.allPlayersScratch.length = 0;
    this.allPlayersScratch.push(this.player);
    if (!this.stressTestActive) {
      for (let i = 0; i < this.simulatedPlayers.length; i++) {
        this.allPlayersScratch.push(this.simulatedPlayers[i]!);
      }
    }
    return this.allPlayersScratch;
  }

  public getActivePlayerCount(): 1 | 2 | 3 | 4 {
    if (this.coopPlayerCountOverride !== null) {
      return this.coopPlayerCountOverride;
    }
    if (this.stressTestActive) {
      return 1;
    }
    const total = clamp(1 + this.simulatedPlayers.length, 1, 4);
    return total as 1 | 2 | 3 | 4;
  }

  public setPlayerCountOverride(count: (1 | 2 | 3 | 4) | null): void {
    this.coopPlayerCountOverride = count;
  }

  public getPlayerById(playerId: number): SimPlayerState | undefined {
    if (this.player.id === playerId) return this.player;
    return this.simulatedPlayers.find((p) => p.id === playerId);
  }

  public getPlayerBySlot(slot: 1 | 2 | 3 | 4): SimPlayerState | undefined {
    if (this.player.slot === slot) return this.player;
    return this.simulatedPlayers.find((p) => p.slot === slot);
  }

  public addCoopPlayer(
    slotOrId: 1 | 2 | 3 | 4 | number,
    characterIdOrSlot: CharacterId | (1 | 2 | 3 | 4) = 'vanguard',
    displayNameOrChar?: string,
    idOrName?: number | string,
  ): SimPlayerState {
    this.coopModeActive = true;
    let slot: 1 | 2 | 3 | 4;
    let characterId: CharacterId;
    let displayName: string | undefined;
    let pid: number;

    if (typeof characterIdOrSlot === 'number') {
      pid = slotOrId;
      slot = clamp(characterIdOrSlot, 1, 4) as 1 | 2 | 3 | 4;
      characterId = (displayNameOrChar as CharacterId | undefined) ?? 'vanguard';
      displayName = typeof idOrName === 'string' ? idOrName : undefined;
    } else {
      slot = clamp(slotOrId, 1, 4) as 1 | 2 | 3 | 4;
      characterId = characterIdOrSlot;
      displayName = displayNameOrChar;
      pid = typeof idOrName === 'number' ? idOrName : slot;
    }

    const cx = this.map.width * 0.5;
    const cy = this.map.height * 0.5;
    const spawnOffsets: Record<1 | 2 | 3 | 4, [number, number]> = {
      1: [-90, 8],
      2: [15, 28],
      3: [-90, 68],
      4: [15, 88],
    };
    const [ox, oy] = spawnOffsets[slot];
    const resolved = this.map.resolveCircleCollision(cx + ox, cy + oy, PLAYER_RADIUS);

    if (slot === 1 && this.player.slot === 1) {
      this.player.id = pid;
      this.applyCharacterToPlayerState(this.player, characterId, displayName);
      this.player.x = resolved.x;
      this.player.y = resolved.y;
      this.player.prevX = resolved.x;
      this.player.prevY = resolved.y;
      return this.player;
    }

    const existingIdx = this.simulatedPlayers.findIndex((p) => p.slot === slot || p.id === pid);
    const state = this.createPlayerState(
      pid,
      slot,
      characterId,
      resolved.x,
      resolved.y,
      displayName,
    );
    if (existingIdx >= 0) {
      this.simulatedPlayers[existingIdx] = state;
    } else {
      this.simulatedPlayers.push(state);
      this.simulatedPlayers.sort((a, b) => a.slot - b.slot);
    }
    this.coopPlayerInputs.set(pid, {
      current: {
        seq: 0,
        tick: this.tick,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      },
      prevButtons: 0,
      latchedButtons: 0,
      latchedWeaponSlot: null,
      energyRegenAccum: 0,
    });
    return state;
  }

  public removeCoopPlayer(playerId: number): boolean {
    const idx = this.simulatedPlayers.findIndex((p) => p.id === playerId);
    if (idx >= 0) {
      this.simulatedPlayers.splice(idx, 1);
      this.coopPlayerInputs.delete(playerId);
      return true;
    }
    return false;
  }

  public setCoopPlayerInput(playerId: number, input: PlayerInputPacket): void {
    if (playerId === this.player.id) {
      this.setPlayerInput(input);
      if (typeof input.pingWorldX === 'number' && typeof input.pingWorldY === 'number') {
        this.triggerPing(playerId, input.pingWorldX, input.pingWorldY);
      }
      if (input.emoteId) {
        this.triggerEmote(playerId, input.emoteId);
      }
      return;
    }

    const sp = this.getPlayerById(playerId);
    if (!sp) return;
    let entry = this.coopPlayerInputs.get(playerId);
    if (!entry) {
      entry = {
        current: {
          seq: 0,
          tick: this.tick,
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          buttons: 0,
          weaponSlotSelect: null,
        },
        prevButtons: 0,
        latchedButtons: 0,
        latchedWeaponSlot: null,
        energyRegenAccum: 0,
      };
      this.coopPlayerInputs.set(playerId, entry);
    }
    const newEdges = input.buttons & ~entry.current.buttons;
    entry.latchedButtons |= newEdges;
    if (typeof input.weaponSlotSelect === 'number') {
      entry.latchedWeaponSlot = input.weaponSlotSelect;
    }
    entry.current.seq = input.seq;
    entry.current.tick = input.tick;
    entry.current.moveX = input.moveX;
    entry.current.moveY = input.moveY;
    entry.current.aimAngle = input.aimAngle;
    entry.current.buttons = input.buttons;
    entry.current.weaponSlotSelect = input.weaponSlotSelect ?? null;
    sp.lastProcessedSeq = input.seq;

    if (typeof input.pingWorldX === 'number' && typeof input.pingWorldY === 'number') {
      this.triggerPing(playerId, input.pingWorldX, input.pingWorldY);
    }
    if (input.emoteId) {
      this.triggerEmote(playerId, input.emoteId);
    }
  }

  private applyCharacterToPlayerState(
    p: SimPlayerState,
    characterId: CharacterId,
    displayName?: string,
  ): void {
    const cDef = CHARACTERS[characterId] ?? CHARACTERS.vanguard;
    p.characterId = characterId;
    if (displayName) {
      p.displayName = displayName;
    } else if (p.displayName.includes(' P')) {
      p.displayName = `${cDef.nameVi} P${p.slot}`;
    }
    p.maxHp = cDef.hp;
    p.hp = cDef.hp;
    p.maxArmor = cDef.armor;
    p.armor = cDef.armor;
    p.maxEnergy = cDef.energy;
    p.energy = cDef.energy;
    p.moveSpeed = cDef.moveSpeed;
    p.armorRegenDelaySec = cDef.armorRegenDelaySec;
    p.armorRegenPerSec = cDef.armorRegenPerSec;
    p.weaponSlots =
      characterId === 'vanguard'
        ? [...PHASE1_SAMPLE_WEAPONS]
        : [cDef.starterWeaponId, 'rusty_pistol', 'scrap_shotgun', 'gale_smg'];
    p.activeWeaponSlot = 0;
    p.skillActiveTimer = 0;
    p.skillCooldownTimer = 0;
  }

  public selectCharacter(
    playerId: number,
    characterId: CharacterId,
    allowDuplicateOverride?: boolean,
  ): boolean {
    if (!CHARACTERS[characterId]) return false;
    const p = this.getPlayerById(playerId);
    if (!p) return false;

    const allowDuplicates = allowDuplicateOverride ?? this.allowDuplicateCharacters;
    if (!allowDuplicates) {
      const all = this.getAllPlayers();
      const takenByOther = all.some(
        (other) => other.id !== playerId && other.characterId === characterId,
      );
      if (takenByOther) {
        return false;
      }
    }

    this.applyCharacterToPlayerState(p, characterId);
    this.events.push({
      kind: 'character_selected',
      playerId: p.id,
      characterId,
      nameVi: CHARACTERS[characterId].nameVi,
    });
    return true;
  }

  public togglePlayerReady(playerId: number, ready?: boolean): boolean {
    const p = this.getPlayerById(playerId);
    if (!p) return false;
    p.ready = ready ?? !p.ready;
    return p.ready;
  }

  public areAllPlayersReady(): boolean {
    const all = this.getAllPlayers();
    return all.length > 0 && all.every((p) => p.ready);
  }

  public enterHub(): void {
    this.inHub = true;
    this.coopModeActive = true;
    this.runState = 'playing';
    this.enemies.length = 0;
    this.projectiles.length = 0;
    this.pickups.length = 0;
    this.props.length = 0;
    this.chests.length = 0;
    this.worldItems.length = 0;
    this.npcEntities.length = 0;
    this.doors.length = 0;
    this.hubStatues.length = 0;

    this.map.configureRoomLayout('start', Number(this.baseSeed), false);
    this.map.clearInteriorForHub();
    const cx = this.map.width * 0.5;
    const cy = this.map.height * 0.5;

    // 5 Character Statues in a staggered arc at the top of the Hub Camp (left of Invite Panel)
    const statueCoords: readonly [CharacterId, number, number][] = [
      ['vanguard', cx - 325, cy - 96],
      ['ranger', cx - 235, cy - 182],
      ['elementalist', cx - 145, cy - 96],
      ['druid', cx - 55, cy - 182],
      ['engineer', cx + 35, cy - 96],
    ];
    for (const [cid, sx, sy] of statueCoords) {
      const cDef = CHARACTERS[cid];
      this.hubStatues.push({
        characterId: cid,
        nameVi: cDef.nameVi,
        titleVi: cDef.titleVi,
        x: sx,
        y: sy,
        radius: 24,
      });
    }

    // Central Campfire & Torch Braziers
    this.spawnProp('torch_brazier', cx - 35, cy - 10);
    this.spawnProp('torch_brazier', cx - 210, cy - 35);
    this.spawnProp('torch_brazier', cx + 135, cy - 35);
    this.spawnProp('glow_mushroom', cx - 310, cy + 10);
    this.spawnProp('glow_mushroom', cx + 165, cy + 20);

    // Training Dummy in the Hub (East-center side, left of Invite Panel)
    this.spawnTrainingDummy(cx + 95, cy + 95);

    // Weapon Test Rack (West side — 2x2 staggered grid so [E] labels never overlap)
    const rackWeapons = ['hunter_crossbow', 'frost_scepter', 'tesla_carbine', 'dragon_breath_shotgun'] as const;
    const rackOffsets: readonly [number, number][] = [
      [-320, 48],
      [-195, 48],
      [-320, 118],
      [-195, 118],
    ];
    for (let i = 0; i < rackWeapons.length; i++) {
      const wid = rackWeapons[i]!;
      const wep = WEAPONS[wid];
      if (!wep) continue;
      const [rx, ry] = rackOffsets[i % rackOffsets.length]!;
      this.spawnWorldItem({
        kind: 'weapon',
        weaponId: wep.id,
        rarity: wep.rarity,
        nameVi: wep.nameVi,
        costGold: 0,
        healAmount: 0,
        x: cx + rx,
        y: cy + ry,
      });
    }

    // Hub Expedition Portal at bottom center
    this.portalActive = true;
    this.portalX = cx - 30;
    this.portalY = cy + 142;

    // Position all players around the campfire in a wide vertically-staggered 2x2 formation
    const allPlayers = this.getAllPlayers();
    const offsets: readonly [number, number][] = [
      [-90, 8],
      [15, 28],
      [-90, 68],
      [15, 88],
    ];
    for (let i = 0; i < allPlayers.length; i++) {
      const p = allPlayers[i]!;
      const [ox, oy] = offsets[i % offsets.length]!;
      const pos = this.map.resolveCircleCollision(cx + ox, cy + oy, p.radius);
      p.x = pos.x;
      p.y = pos.y;
      p.prevX = pos.x;
      p.prevY = pos.y;
      p.vx = 0;
      p.vy = 0;
      p.lifeState = 'alive';
      p.hp = p.maxHp;
      p.armor = p.maxArmor;
      p.energy = p.maxEnergy;
      p.ready = false;
    }
  }

  public startDungeonRunFromHub(): void {
    this.inHub = false;
    this.hubStatues.length = 0;
    this.currentFloor = 1;
    this.runState = 'playing';
    this.roomChestsByRoomId.clear();
    this.roomItemsByRoomId.clear();
    this.initializedRoomIds.clear();

    const pCount = this.getActivePlayerCount();
    this.dungeon = generateDungeonFloor(this.baseSeed, 1, 1, pCount);
    this.currentRoomId = this.dungeon.startRoomId;

    const allPlayers = this.getAllPlayers();
    for (const p of allPlayers) {
      p.lifeState = 'alive';
      p.downedTimer = 0;
      p.reviveProgress = 0;
      p.reviverPlayerId = null;
      p.hp = p.maxHp;
      p.armor = p.maxArmor;
      p.energy = p.maxEnergy;
      p.ready = false;
      p.currentRoomId = this.currentRoomId;
    }

    this.enterRoom(this.dungeon.startRoomId);
  }

  public triggerPing(playerId: number, worldX: number, worldY: number): SimPingMarker | null {
    const p = this.getPlayerById(playerId);
    if (!p) return null;

    let kind: PingMarkerKind = 'move';
    let labelVi = 'Di chuyển tới đây!';
    let px = clamp(worldX, TILE_SIZE * 1.5, this.map.width - TILE_SIZE * 1.5);
    let py = clamp(worldY, TILE_SIZE * 1.5, this.map.height - TILE_SIZE * 1.5);

    if (p.lifeState === 'downed') {
      kind = 'revive';
      labelVi = 'Cứu tôi!';
      px = p.x;
      py = p.y;
    } else {
      const downedAlly = this.getAllPlayers().find(
        (ally) => ally.lifeState === 'downed' && distance(px, py, ally.x, ally.y) <= 64,
      );
      if (downedAlly) {
        kind = 'revive';
        labelVi = `Cứu ${downedAlly.displayName}!`;
        px = downedAlly.x;
        py = downedAlly.y;
      } else {
        const targetEnemy = this.enemies.find(
          (e) => !e.isDummy && e.hp > 0 && distance(px, py, e.x, e.y) <= 64,
        );
        if (targetEnemy) {
          kind = 'enemy';
          labelVi = `Tập trung: ${targetEnemy.nameVi}!`;
          px = targetEnemy.x;
          py = targetEnemy.y;
        } else {
          const targetItem = this.worldItems.find(
            (it) => !it.pickedUp && distance(px, py, it.x, it.y) <= 64,
          );
          const targetChest = this.chests.find(
            (c) => !c.opened && distance(px, py, c.x, c.y) <= 64,
          );
          if (targetItem) {
            kind = 'loot';
            labelVi = `Vật phẩm: ${targetItem.nameVi}`;
            px = targetItem.x;
            py = targetItem.y;
          } else if (targetChest) {
            kind = 'loot';
            labelVi = 'Rương Vũ Khí ở đây!';
            px = targetChest.x;
            py = targetChest.y;
          }
        }
      }
    }

    // Replace existing ping from the same player so spam doesn't clutter
    const existingIdx = this.pings.findIndex((m) => m.playerId === p.id);
    if (existingIdx >= 0) {
      this.pings.splice(existingIdx, 1);
    }

    const marker: SimPingMarker = {
      id: ++this.nextEntityId,
      playerId: p.id,
      playerSlot: p.slot,
      kind,
      labelVi,
      x: px,
      y: py,
      ttlSec: 4.0,
    };
    this.pings.push(marker);
    this.events.push({
      kind: 'ping_issued',
      pingId: marker.id,
      playerId: p.id,
      playerSlot: p.slot,
      pingKind: kind,
      labelVi,
      x: px,
      y: py,
    });
    return marker;
  }

  public triggerEmote(playerId: number, emoteId: QuickEmoteId): boolean {
    const p = this.getPlayerById(playerId);
    const labelVi = QUICK_EMOTES_VI[emoteId];
    if (!p || !labelVi) return false;
    p.emoteId = emoteId;
    p.emoteTimer = 2.5;
    this.events.push({
      kind: 'emote_triggered',
      playerId: p.id,
      emoteId,
      labelVi,
      x: p.x,
      y: p.y,
    });
    return true;
  }

  public dropActiveWeapon(playerId = this.player.id): SimWorldItemState | null {
    const p = this.getPlayerById(playerId);
    if (!p || p.lifeState !== 'alive' || p.weaponSlots.length <= 1) return null;
    const activeIdx = clamp(p.activeWeaponSlot, 0, p.weaponSlots.length - 1);
    const wid = p.weaponSlots[activeIdx]!;
    const wep = WEAPONS[wid];
    if (!wep) return null;

    p.weaponSlots.splice(activeIdx, 1);
    p.activeWeaponSlot = Math.min(activeIdx, p.weaponSlots.length - 1);

    const dropX = p.x + Math.cos(p.aimAngle) * 28;
    const dropY = p.y + Math.sin(p.aimAngle) * 28;
    const resolved = this.map.resolveCircleCollision(dropX, dropY, 15);
    const droppedItem = this.spawnWorldItem({
      kind: 'weapon',
      weaponId: wep.id,
      rarity: wep.rarity,
      nameVi: wep.nameVi,
      costGold: 0,
      healAmount: 0,
      x: resolved.x,
      y: resolved.y,
      ownerPlayerId: undefined, // Shared so any teammate can pick it up!
    });
    return droppedItem;
  }

  public spawnDefaultArenaProps(): void {
    this.props.length = 0;

    // 4 Pillar Torch Braziers (warm flickering point lights next to interior pillars)
    this.spawnProp('torch_brazier', 8 * TILE_SIZE - 14, 5 * TILE_SIZE - 12);
    this.spawnProp('torch_brazier', 28 * TILE_SIZE + 14, 5 * TILE_SIZE - 12);
    this.spawnProp('torch_brazier', 8 * TILE_SIZE - 14, 17 * TILE_SIZE + 12);
    this.spawnProp('torch_brazier', 28 * TILE_SIZE + 14, 17 * TILE_SIZE + 12);

    // Bioluminescent Glowing Mushrooms near water/grass/swamp
    this.spawnProp('glow_mushroom', 11 * TILE_SIZE - 12, 4 * TILE_SIZE + 16);
    this.spawnProp('glow_mushroom', 25 * TILE_SIZE + 12, 4 * TILE_SIZE + 16);
    this.spawnProp('glow_mushroom', 11 * TILE_SIZE - 12, 17 * TILE_SIZE + 16);
    this.spawnProp('glow_mushroom', 4 * TILE_SIZE + 16, 11 * TILE_SIZE);

    // Explosive Barrels (near oil slick and near north cracked secret wall for chain reaction!)
    this.spawnProp('explosive_barrel', 17 * TILE_SIZE + 16, 2 * TILE_SIZE + 10);
    this.spawnProp('explosive_barrel', 18 * TILE_SIZE + 28, 2 * TILE_SIZE + 22);
    this.spawnProp('explosive_barrel', 21 * TILE_SIZE + 16, 16 * TILE_SIZE + 16);

    // Destructible Wooden Crates & Clay Vases
    this.spawnProp('wooden_crate', 6 * TILE_SIZE + 16, 4 * TILE_SIZE + 16);
    this.spawnProp('wooden_crate', 6 * TILE_SIZE + 16, 17 * TILE_SIZE + 16);
    this.spawnProp('clay_vase', 7 * TILE_SIZE + 12, 4 * TILE_SIZE + 16);
    this.spawnProp('clay_vase', 30 * TILE_SIZE + 16, 10 * TILE_SIZE + 16);
    this.spawnProp('wooden_crate', 30 * TILE_SIZE + 16, 11 * TILE_SIZE + 20);
  }

  public spawnProp(kind: PropKind, x: number, y: number): SimPropState {
    let radius = 14;
    let hp = 16;
    let destructible = true;
    let explosive = false;
    let blocksMovement = true;
    let lightRadius = 0;
    let lightColorHex = '#F97316';

    switch (kind) {
      case 'wooden_crate':
        radius = 14;
        hp = 18;
        break;
      case 'clay_vase':
        radius = 11;
        hp = 10;
        break;
      case 'explosive_barrel':
        radius = 14;
        hp = 14;
        explosive = true;
        lightRadius = 85;
        lightColorHex = '#F97316';
        break;
      case 'torch_brazier':
        radius = 11;
        hp = 9999;
        destructible = false;
        blocksMovement = false;
        lightRadius = 185;
        lightColorHex = '#FACC15';
        break;
      case 'glow_mushroom':
        radius = 10;
        hp = 9999;
        destructible = false;
        blocksMovement = false;
        lightRadius = 135;
        lightColorHex = '#84CC16';
        break;
    }

    const prop: SimPropState = {
      id: ++this.nextEntityId,
      kind,
      x,
      y,
      radius,
      hp,
      maxHp: hp,
      destructible,
      explosive,
      blocksMovement,
      lightRadius,
      lightColorHex,
      hitFlashTimer: 0,
      fuseTimer: 0,
    };
    this.props.push(prop);
    return prop;
  }

  public cycleImbueElement(): ElementType {
    const idx = ELEMENT_CYCLE_ORDER.indexOf(this.player.activeImbueElement);
    const next = ELEMENT_CYCLE_ORDER[(idx + 1) % ELEMENT_CYCLE_ORDER.length] ?? 'none';
    this.player.activeImbueElement = next;
    return next;
  }

  public setImbueElement(element: ElementType): void {
    this.player.activeImbueElement = element;
  }

  /**
   * Configures Phase 2 Stress Test Mode:
   * - 4 simulated players (P1 Vanguard + P2 Ranger + P3 Elementalist + P4 Engineer)
   * - 80 active enemies
   * - >= 600 active projectiles continuously recycled via object pool
   */
  public configureStressTest(active: boolean): void {
    this.stressTestActive = active;
    if (!active) {
      this.simulatedPlayers.length = 0;
      this.enemies = this.enemies.filter((e) => e.isDummy);
      for (let i = 0; i < this.projectiles.length; i++) {
        const b = this.projectiles[i]!;
        b.ttlSec = 0;
        b.hitEntityIds.length = 0;
        this.projectilePool.push(b);
      }
      this.projectiles.length = 0;
      this.spawnSampleWave();
      return;
    }

    this.player.godMode = true;
    this.player.activeWeaponSlot = 3; // Gale SMG

    // Spawn 3 simulated co-op teammates (total 4 players: P1..P4)
    this.simulatedPlayers = [
      this.createPlayerState(2, 2, 'ranger', this.map.width * 0.45, this.map.height * 0.35),
      this.createPlayerState(3, 3, 'elementalist', this.map.width * 0.45, this.map.height * 0.65),
      this.createPlayerState(4, 4, 'engineer', this.map.width * 0.6, this.map.height * 0.5),
    ];
    this.simulatedPlayers[0]!.activeWeaponSlot = 1; // Rusty Pistol
    this.simulatedPlayers[0]!.activeImbueElement = 'chill';
    this.simulatedPlayers[1]!.activeWeaponSlot = 2; // Scrap Shotgun
    this.simulatedPlayers[1]!.activeImbueElement = 'burn';
    this.simulatedPlayers[2]!.activeWeaponSlot = 3; // Gale SMG
    this.simulatedPlayers[2]!.activeImbueElement = 'shock';

    // Remove dummy so all 80 enemies are combat enemies
    this.enemies.length = 0;
    const enemyTypes = PHASE1_SAMPLE_ENEMIES;
    for (let i = 0; i < 80; i++) {
      const defId = enemyTypes[i % enemyTypes.length]!;
      const col = i % 10;
      const row = Math.floor(i / 10);
      const ex = TILE_SIZE * 3.5 + col * ((this.map.width - TILE_SIZE * 7) / 9);
      const ey = TILE_SIZE * 2.5 + row * ((this.map.height - TILE_SIZE * 5) / 7);
      const e = this.spawnEnemy(defId, ex, ey, true);
      e.hp = 500;
      e.maxHp = 500;
    }

    this.topUpStressTestProjectiles(620);
  }

  private topUpStressTestProjectiles(targetCount: number): void {
    const elements: readonly ElementType[] = ['none', 'burn', 'chill', 'shock', 'poison'];
    while (this.projectiles.length < targetCount) {
      const idx = this.projectiles.length;
      const isEnemy = idx % 3 === 0;
      const angle = ((idx * 137.5) % 360) * (Math.PI / 180);
      const spd = isEnemy ? 260 : 420;
      const rx = this.rng.nextFloat(TILE_SIZE * 2.5, this.map.width - TILE_SIZE * 2.5);
      const ry = this.rng.nextFloat(TILE_SIZE * 2.5, this.map.height - TILE_SIZE * 2.5);
      const el = isEnemy ? 'none' : (elements[idx % elements.length] ?? 'none');

      const proj = this.acquireProjectile({
        id: ++this.nextEntityId,
        ownerId: isEnemy ? 100 + (idx % 80) : 1 + (idx % 4),
        team: isEnemy ? 'enemy' : 'player',
        weaponId: idx % 5 === 0 ? 'scrap_shotgun' : isEnemy ? 'goblin_bow' : 'gale_smg',
        x: rx,
        y: ry,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        angle,
        radius: isEnemy ? 5.5 : 4.8,
        damage: 2,
        isCrit: idx % 11 === 0,
        knockback: 15,
        pierceRemaining: 2,
        bounceRemaining: 3,
        ttlSec: this.rng.nextFloat(0.8, 2.4),
        element: el,
        amplifiedByShield: false,
      });
      this.projectiles.push(proj);
    }
  }

  public setPlayerInput(input: PlayerInputPacket): void {
    const newEdges = input.buttons & ~this.currentInput.buttons;
    this.latchedButtons |= newEdges;
    if (typeof input.weaponSlotSelect === 'number') {
      this.latchedWeaponSlot = input.weaponSlotSelect;
    }
    this.currentInput.seq = input.seq;
    this.currentInput.tick = input.tick;
    this.currentInput.moveX = input.moveX;
    this.currentInput.moveY = input.moveY;
    this.currentInput.aimAngle = input.aimAngle;
    this.currentInput.buttons = input.buttons;
    this.currentInput.weaponSlotSelect = input.weaponSlotSelect ?? null;
    this.player.lastProcessedSeq = input.seq;
  }

  public getActiveWeaponId(): string {
    return (
      this.player.weaponSlots[this.player.activeWeaponSlot] ??
      this.player.weaponSlots[0] ??
      'knight_sword'
    );
  }

  public equipWeaponSlot(slotIndex: number): void {
    if (slotIndex >= 0 && slotIndex < this.player.weaponSlots.length) {
      if (this.player.activeWeaponSlot !== slotIndex) {
        this.player.activeWeaponSlot = slotIndex;
        this.player.fireCooldownTimer = Math.min(this.player.fireCooldownTimer, 0.08);
        this.events.push({
          kind: 'weapon_swapped',
          weaponId: this.getActiveWeaponId(),
          slot: slotIndex,
        });
      }
    }
  }

  public cycleWeapon(direction = 1): void {
    const len = this.player.weaponSlots.length;
    if (len <= 1) return;
    const nextSlot = (this.player.activeWeaponSlot + direction + len) % len;
    this.equipWeaponSlot(nextSlot);
  }

  public spawnTrainingDummy(x: number, y: number): SimEnemyState {
    const resolved = this.map.resolveCircleCollision(x, y, 15);
    const dummy: SimEnemyState = {
      id: ++this.nextEntityId,
      defId: 'training_dummy',
      nameVi: 'Hình Nộm Tập Bắn',
      role: 'dummy',
      isDummy: true,
      prevX: resolved.x,
      prevY: resolved.y,
      x: resolved.x,
      y: resolved.y,
      vx: 0,
      vy: 0,
      kbVx: 0,
      kbVy: 0,
      radius: 15,
      aimAngle: 0,
      hp: 9999,
      maxHp: 9999,
      moveSpeed: 0,
      damage: 0,
      aiState: 'idle',
      stateTimer: 0,
      attackCooldownTimer: 999,
      telegraphDurationSec: 0,
      telegraphAngle: 0,
      telegraphRadius: 0,
      telegraphLength: 0,
      hitFlashTimer: 0,
      strafeSign: 1,
      burnTimer: 0,
      burnTickTimer: 0,
      chillTimer: 0,
      chillStacks: 0,
      frozenTimer: 0,
      poisonTimer: 0,
      poisonStacks: 0,
      poisonTickTimer: 0,
      shockTimer: 0,
      surfaceTickTimer: 0,
      grassRustleCooldown: 0,
      isElite: false,
      eliteModifier: null,
      shieldArmor: 0,
      maxShieldArmor: 0,
      regenAccum: 0,
      isBoss: false,
      bossPhase: 1,
      bossBurrowed: false,
      bossTargetX: resolved.x,
      bossTargetY: resolved.y,
      bossAttackCycle: 0,
    };
    this.enemies.push(dummy);
    return dummy;
  }

  public spawnEnemy(
    defId: string,
    x?: number,
    y?: number,
    skipSpawnWarmup = false,
    eliteModifier: EliteModifier | null = null,
  ): SimEnemyState {
    const def = ENEMIES[defId];
    if (!def) {
      throw new Error(`Unknown enemy defId: ${defId}`);
    }

    const playerCount = this.getActivePlayerCount();
    const scaling = COOP_SCALING[playerCount];
    const isElite = eliteModifier !== null && !def.isBoss;
    const radius = isElite ? Math.round(def.radius * 1.25) : def.radius;
    const rawHp = isElite ? Math.round(def.hp * 2.2) : def.hp;
    const hpMult = this.stressTestActive
      ? 1.0
      : def.isBoss
        ? scaling.bossHpMultiplier
        : scaling.enemyHpMultiplier;
    const baseHp = Math.max(1, Math.round(rawHp * hpMult));
    const moveSpeed =
      isElite && eliteModifier === 'fast' ? Math.round(def.moveSpeed * 1.38) : def.moveSpeed;
    const damage = isElite ? Math.max(def.damage + 1, Math.round(def.damage * 1.35)) : def.damage;
    const shieldArmor = isElite && eliteModifier === 'shield' ? Math.round(def.hp * 0.85 * hpMult) : 0;
    const nameVi =
      isElite && eliteModifier
        ? `[Tinh Anh] ${def.nameVi} (${ELITE_MODIFIER_LABELS_VI[eliteModifier]})`
        : def.nameVi;

    let spawnX = x ?? this.map.width * 0.7;
    let spawnY = y ?? this.map.height * 0.5;

    if (x === undefined || y === undefined) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const cx = this.rng.nextFloat(TILE_SIZE * 3, this.map.width - TILE_SIZE * 3);
        const cy = this.rng.nextFloat(TILE_SIZE * 3, this.map.height - TILE_SIZE * 3);
        const dSq = distanceSq(cx, cy, this.player.x, this.player.y);
        const hit = this.map.checkProjectileWallHit(cx, cy, radius + 6);
        if (dSq >= 150 * 150 && !hit.hit) {
          spawnX = cx;
          spawnY = cy;
          break;
        }
      }
    }

    const resolved = this.map.resolveCircleCollision(spawnX, spawnY, radius);
    const enemy: SimEnemyState = {
      id: ++this.nextEntityId,
      defId: def.id,
      nameVi,
      role: def.role,
      isDummy: false,
      prevX: resolved.x,
      prevY: resolved.y,
      x: resolved.x,
      y: resolved.y,
      vx: 0,
      vy: 0,
      kbVx: 0,
      kbVy: 0,
      radius,
      aimAngle: Math.atan2(this.player.y - resolved.y, this.player.x - resolved.x),
      hp: baseHp,
      maxHp: baseHp,
      moveSpeed,
      damage,
      aiState: skipSpawnWarmup ? 'move' : 'spawning',
      stateTimer: skipSpawnWarmup ? 0 : ENEMY_SPAWN_WARMUP_SEC,
      attackCooldownTimer: this.rng.nextFloat(0.4, 1.1),
      telegraphDurationSec: def.telegraphSec,
      telegraphAngle: 0,
      telegraphRadius:
        defId === 'spore_bomber'
          ? SPORE_EXPLOSION_RADIUS
          : defId === 'spore_king'
            ? BOSS_ERUPT_RADIUS
            : 0,
      telegraphLength: defId === 'wild_boar' ? 220 : 0,
      hitFlashTimer: 0,
      strafeSign: this.rng.chance(0.5) ? 1 : -1,
      burnTimer: 0,
      burnTickTimer: 0,
      chillTimer: 0,
      chillStacks: 0,
      frozenTimer: 0,
      poisonTimer: 0,
      poisonStacks: 0,
      poisonTickTimer: 0,
      shockTimer: 0,
      surfaceTickTimer: 0,
      grassRustleCooldown: 0,
      isElite,
      eliteModifier: isElite ? eliteModifier : null,
      shieldArmor,
      maxShieldArmor: shieldArmor,
      regenAccum: 0,
      isBoss: Boolean(def.isBoss),
      bossPhase: 1,
      bossBurrowed: false,
      bossTargetX: resolved.x,
      bossTargetY: resolved.y,
      bossAttackCycle: 0,
    };

    this.enemies.push(enemy);
    if (enemy.isBoss) {
      this.events.push({
        kind: 'boss_spawned',
        enemyId: enemy.id,
        nameVi: enemy.nameVi,
      });
      // Phase 4 Co-op 3-4P Boss Mechanic: Spore King spawns 2 Shield Guardian Mushrooms in 2 corners!
      if (playerCount >= 3 && defId === 'spore_king') {
        this.spawnBossGuardianMushrooms();
      }
    }
    return enemy;
  }

  public spawnBossGuardianMushrooms(): void {
    const existingGuardians = this.enemies.filter(
      (e) => e.defId === 'spore_guardian' && e.hp > 0,
    ).length;
    if (existingGuardians >= 2) return;
    this.spawnEnemy('spore_guardian', TILE_SIZE * 6.5, TILE_SIZE * 5.0, true);
    this.spawnEnemy(
      'spore_guardian',
      this.map.width - TILE_SIZE * 6.5,
      this.map.height - TILE_SIZE * 5.0,
      true,
    );
  }

  public hasActiveBossGuardians(): boolean {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (e.defId === 'spore_guardian' && e.hp > 0) {
        return true;
      }
    }
    return false;
  }

  public spawnSampleWave(): void {
    this.waveNumber += 1;
    this.enemies = this.enemies.filter((e) => e.isDummy);

    const cx = this.map.width * 0.72;
    const cy = this.map.height * 0.5;
    this.spawnEnemy('goblin_shooter', cx + 40, cy - 110, false);
    this.spawnEnemy('wild_boar', cx + 80, cy + 20, false);
    this.spawnEnemy('spore_bomber', cx - 30, cy + 120, false);
  }

  public getCurrentRoom(): DungeonRoomNode {
    return this.dungeon.rooms[this.currentRoomId] ?? this.dungeon.rooms[0]!;
  }

  public hasActiveCombatEnemies(): boolean {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (!e.isDummy && e.hp > 0) {
        return true;
      }
    }
    return false;
  }

  public getActiveBoss(): SimEnemyState | null {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (e.isBoss && e.hp > 0) {
        return e;
      }
    }
    return null;
  }

  public rebuildCurrentRoomDoors(): void {
    this.doors.length = 0;
    if (this.inHub) return;
    const room = this.getCurrentRoom();
    const hasCombat = this.hasActiveCombatEnemies();

    for (const [dir, targetRoomId] of Object.entries(room.connections) as [
      CardinalDir,
      number | undefined,
    ][]) {
      if (targetRoomId === undefined) continue;
      const targetRoom = this.dungeon.rooms[targetRoomId];
      if (!targetRoom) continue;

      let x = this.map.width * 0.5;
      let y = this.map.height * 0.5;
      if (dir === 'N') {
        x = 18 * TILE_SIZE + 16;
        y = 1 * TILE_SIZE + 18;
      } else if (dir === 'S') {
        x = 18 * TILE_SIZE + 16;
        y = (this.map.rows - 2) * TILE_SIZE + 14;
      } else if (dir === 'W') {
        x = 1 * TILE_SIZE + 18;
        y = 11 * TILE_SIZE + 16;
      } else if (dir === 'E') {
        x = (this.map.cols - 2) * TILE_SIZE + 14;
        y = 11 * TILE_SIZE + 16;
      }

      const isSecretPassage =
        (room.type === 'start' && targetRoom.type === 'secret') ||
        (room.type === 'secret' && targetRoom.type === 'start');
      const locked = isSecretPassage
        ? !this.secretWallBroken || hasCombat
        : hasCombat || (!room.cleared && room.type !== 'start');

      this.doors.push({
        dir,
        targetRoomId,
        targetRoomType: targetRoom.type,
        x,
        y,
        radius: 26,
        locked,
        isSecretPassage,
      });
    }
  }

  public enterRoom(roomId: number, entryDir?: CardinalDir): boolean {
    const targetRoom = this.dungeon.rooms[roomId];
    if (!targetRoom) return false;
    this.inHub = false;

    const prevRoomId = this.currentRoomId;
    if (this.initializedRoomIds.has(this.currentRoomId)) {
      this.roomChestsByRoomId.set(this.currentRoomId, [...this.chests]);
      this.roomItemsByRoomId.set(this.currentRoomId, [...this.worldItems]);
    }

    this.currentRoomId = roomId;
    targetRoom.discovery = targetRoom.cleared ? 'cleared' : 'visited';
    for (const adjId of Object.values(targetRoom.connections)) {
      if (adjId !== undefined) {
        const adjRoom = this.dungeon.rooms[adjId];
        if (adjRoom && adjRoom.discovery === 'hidden' && adjRoom.type !== 'secret') {
          adjRoom.discovery = 'discovered';
        }
      }
    }

    // Clear transient entities from previous room
    this.enemies.length = 0;
    for (let i = 0; i < this.projectiles.length; i++) {
      const b = this.projectiles[i]!;
      b.ttlSec = 0;
      b.hitEntityIds.length = 0;
      this.projectilePool.push(b);
    }
    this.projectiles.length = 0;
    for (let i = 0; i < this.pickups.length; i++) {
      this.pickupPool.push(this.pickups[i]!);
    }
    this.pickups.length = 0;
    this.props.length = 0;
    this.chests.length = 0;
    this.worldItems.length = 0;
    this.npcEntities.length = 0;
    this.portalActive = false;
    this.waveRespawnTimer = 0;
    this.doorTransitionCooldown = 0.55;

    if (this.map.getTile(18, 0) !== 'cracked_wall') {
      this.secretWallBroken = true;
    }

    const roomSeed = Number(this.dungeon.seed) + roomId * 997 + this.currentFloor * 7919;
    this.map.configureRoomLayout(targetRoom.type, roomSeed, this.secretWallBroken);

    // Position player(s) near the entrance door (opposite of entryDir)
    let spawnX = this.map.width * 0.35;
    let spawnY = this.map.height * 0.5;
    if (entryDir) {
      const arrivalSide = OPPOSITE_DIR[entryDir];
      if (arrivalSide === 'N') {
        spawnX = 18 * TILE_SIZE + 16;
        spawnY = 3 * TILE_SIZE + 20;
      } else if (arrivalSide === 'S') {
        spawnX = 18 * TILE_SIZE + 16;
        spawnY = (this.map.rows - 3) * TILE_SIZE - 8;
      } else if (arrivalSide === 'W') {
        spawnX = 3 * TILE_SIZE + 8;
        spawnY = 11 * TILE_SIZE + 16;
      } else if (arrivalSide === 'E') {
        spawnX = (this.map.cols - 3) * TILE_SIZE - 8;
        spawnY = 11 * TILE_SIZE + 16;
      }
    }
    const resolvedPos = this.map.resolveCircleCollision(spawnX, spawnY, this.player.radius);
    const hasCoopTeammates = !this.stressTestActive && this.simulatedPlayers.length > 0;
    const p1Pos = hasCoopTeammates
      ? this.map.resolveCircleCollision(resolvedPos.x - 68, resolvedPos.y - 28, this.player.radius)
      : resolvedPos;
    this.player.x = p1Pos.x;
    this.player.y = p1Pos.y;
    this.player.prevX = p1Pos.x;
    this.player.prevY = p1Pos.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.currentRoomId = roomId;

    // Teleport co-op teammates into the new room around the entrance!
    if (hasCoopTeammates) {
      const offsets: readonly [number, number][] = [
        [38, -28],
        [-18, 44],
        [88, 44],
        [0, -54],
      ];
      let anyTeleportedFromOutside = false;
      for (let i = 0; i < this.simulatedPlayers.length; i++) {
        const sp = this.simulatedPlayers[i]!;
        if (sp.currentRoomId !== roomId || prevRoomId !== roomId) {
          anyTeleportedFromOutside = true;
        }
        const [ox, oy] = offsets[i % offsets.length]!;
        const spPos = this.map.resolveCircleCollision(
          resolvedPos.x + ox,
          resolvedPos.y + oy,
          sp.radius,
        );
        sp.x = spPos.x;
        sp.y = spPos.y;
        sp.prevX = spPos.x;
        sp.prevY = spPos.y;
        sp.vx = 0;
        sp.vy = 0;
        sp.currentRoomId = roomId;
      }

      if (
        anyTeleportedFromOutside &&
        !targetRoom.cleared &&
        (targetRoom.type === 'combat' || targetRoom.type === 'portal' || targetRoom.type === 'boss')
      ) {
        this.events.push({
          kind: 'players_teleported_to_room',
          roomId: targetRoom.id,
          x: resolvedPos.x,
          y: resolvedPos.y,
        });
      }
    }

    this.populateRoomContents(targetRoom);
    this.initializedRoomIds.add(targetRoom.id);
    this.roomChestsByRoomId.set(targetRoom.id, [...this.chests]);
    this.roomItemsByRoomId.set(targetRoom.id, [...this.worldItems]);
    this.rebuildCurrentRoomDoors();

    this.events.push({
      kind: 'room_entered',
      roomId: targetRoom.id,
      roomType: targetRoom.type,
      floorNumber: this.currentFloor,
    });
    return true;
  }

  private populateRoomContents(room: DungeonRoomNode): void {
    const cx = this.map.width * 0.5;
    const cy = this.map.height * 0.5;
    const hasSavedState =
      room.id !== 0 &&
      this.initializedRoomIds.has(room.id) &&
      (this.roomChestsByRoomId.has(room.id) || this.roomItemsByRoomId.has(room.id));

    if (hasSavedState) {
      const savedChests = this.roomChestsByRoomId.get(room.id);
      if (savedChests) this.chests.push(...savedChests);
      const savedItems = this.roomItemsByRoomId.get(room.id);
      if (savedItems) this.worldItems.push(...savedItems);
    }

    switch (room.type) {
      case 'start': {
        this.spawnTrainingDummy(210, 260);
        this.spawnDefaultArenaProps();
        if (!room.cleared) {
          this.spawnSampleWave();
        }
        break;
      }
      case 'combat': {
        this.spawnProp('torch_brazier', 8 * TILE_SIZE - 14, 5 * TILE_SIZE - 12);
        this.spawnProp('torch_brazier', 28 * TILE_SIZE + 14, 5 * TILE_SIZE - 12);
        this.spawnProp('torch_brazier', 8 * TILE_SIZE - 14, 17 * TILE_SIZE + 12);
        this.spawnProp('torch_brazier', 28 * TILE_SIZE + 14, 17 * TILE_SIZE + 12);
        this.spawnProp('glow_mushroom', 11 * TILE_SIZE - 12, 4 * TILE_SIZE + 16);
        this.spawnProp('glow_mushroom', 25 * TILE_SIZE + 12, 17 * TILE_SIZE + 16);
        this.spawnProp('explosive_barrel', 15 * TILE_SIZE + 16, 6 * TILE_SIZE + 16);
        this.spawnProp('explosive_barrel', 21 * TILE_SIZE + 16, 15 * TILE_SIZE + 16);
        this.spawnProp('wooden_crate', 6 * TILE_SIZE + 16, 5 * TILE_SIZE + 16);
        this.spawnProp('clay_vase', 29 * TILE_SIZE + 16, 16 * TILE_SIZE + 16);

        if (!room.cleared) {
          room.wavesSpawned = 0;
          room.wavesTotal = Math.max(2, room.waves.length || room.wavesTotal);
          this.spawnNextRoomWave();
        }
        break;
      }
      case 'treasure': {
        this.spawnProp('torch_brazier', cx - 110, cy - 80);
        this.spawnProp('torch_brazier', cx + 110, cy - 80);
        this.spawnProp('glow_mushroom', cx - 110, cy + 80);
        this.spawnProp('glow_mushroom', cx + 110, cy + 80);
        if (!hasSavedState && !room.chestOpened) {
          const rarity = room.chestRarity ?? this.rollChestRarity(1);
          this.spawnChest(cx, cy, rarity, room.chestWeaponId ?? undefined);
        }
        break;
      }
      case 'secret': {
        this.secretWallBroken = true;
        this.spawnProp('glow_mushroom', cx - 95, cy - 65);
        this.spawnProp('glow_mushroom', cx + 95, cy - 65);
        this.spawnProp('clay_vase', cx - 80, cy + 65);
        this.spawnProp('clay_vase', cx + 80, cy + 65);
        if (!hasSavedState && !room.chestOpened) {
          const rarity: WeaponRarity =
            room.chestRarity ?? (this.rng.chance(0.45) ? 'legendary' : 'epic');
          this.spawnChest(cx, cy - 10, rarity, room.chestWeaponId ?? undefined);
          for (let i = 0; i < 3; i++) {
            this.pickups.push(
              this.acquirePickup({
                id: ++this.nextEntityId,
                kind: 'gold',
                x: cx + (i - 1) * 36,
                y: cy + 36,
                vx: 0,
                vy: 0,
                amount: 12,
                ttlSec: 60,
              }),
            );
          }
        }
        break;
      }
      case 'merchant': {
        this.spawnProp('torch_brazier', cx - 150, cy - 90);
        this.spawnProp('torch_brazier', cx + 150, cy - 90);
        this.npcEntities.push({
          id: ++this.nextEntityId,
          kind: 'merchant',
          nameVi: 'Thương Nhân Hắc Ám',
          dialogueVi: '“Vàng đổi lấy thần khí... chọn đi trước khi rừng sâu nuốt chửng ngươi!”',
          x: cx,
          y: cy - 72,
          radius: 18,
          interacted: false,
          costHp: 0,
        });
        if (!hasSavedState) {
          const positions: readonly [number, number][] = [
            [cx - 165, cy + 12],
            [cx, cy + 34],
            [cx + 165, cy + 12],
          ];
          if (room.shopOffers.length > 0) {
            for (let i = 0; i < room.shopOffers.length; i++) {
              const offer = room.shopOffers[i]!;
              const [ox, oy] = positions[i % positions.length]!;
              const item = this.spawnWorldItem({
                kind: offer.kind,
                weaponId: offer.weaponId,
                rarity:
                  offer.rarity ??
                  (offer.kind === 'armor_upgrade' ? 'rare' : 'uncommon'),
                nameVi: offer.nameVi,
                costGold: offer.costGold,
                healAmount: offer.kind === 'health_potion' ? 4 : 0,
                x: ox,
                y: oy,
                offerId: offer.id,
              });
              item.pickedUp = offer.purchased;
            }
          } else {
            this.spawnWorldItem({
              kind: 'health_potion',
              rarity: 'uncommon',
              nameVi: 'Bình Máu Cổ Ngữ (+4 HP)',
              costGold: 15,
              healAmount: 4,
              x: cx - 165,
              y: cy + 12,
            });
            const rareWepId = this.rollRandomWeaponByRarities(['uncommon', 'rare']);
            const rareWep = WEAPONS[rareWepId]!;
            this.spawnWorldItem({
              kind: 'weapon',
              weaponId: rareWep.id,
              rarity: rareWep.rarity,
              nameVi: rareWep.nameVi,
              costGold: rareWep.rarity === 'rare' ? 30 : 22,
              healAmount: 0,
              x: cx,
              y: cy + 34,
            });
            const epicWepId = this.rollRandomWeaponByRarities(['epic', 'legendary']);
            const epicWep = WEAPONS[epicWepId]!;
            this.spawnWorldItem({
              kind: 'weapon',
              weaponId: epicWep.id,
              rarity: epicWep.rarity,
              nameVi: epicWep.nameVi,
              costGold: epicWep.rarity === 'legendary' ? 50 : 38,
              healAmount: 0,
              x: cx + 165,
              y: cy + 12,
            });
          }
        }
        break;
      }
      case 'shrine': {
        this.spawnProp('glow_mushroom', cx - 110, cy - 75);
        this.spawnProp('glow_mushroom', cx + 110, cy - 75);
        this.spawnProp('torch_brazier', cx - 110, cy + 75);
        this.spawnProp('torch_brazier', cx + 110, cy + 75);
        this.npcEntities.push({
          id: ++this.nextEntityId,
          kind: 'shrine',
          nameVi: 'Tượng Thần Cổ Đại',
          dialogueVi: room.shrineUsed
            ? 'Tượng thần đã ban phước lành cổ ngữ.'
            : 'Dâng 25 Xu hoặc 2 Máu [E] để nhận Phước Lành & Thần Khí',
          x: cx,
          y: cy - 18,
          radius: 22,
          interacted: room.shrineUsed,
          costHp: 2,
          costGold: 25,
        });
        break;
      }
      case 'portal': {
        this.spawnProp('torch_brazier', cx - 130, cy - 90);
        this.spawnProp('torch_brazier', cx + 130, cy - 90);
        this.spawnProp('torch_brazier', cx - 130, cy + 90);
        this.spawnProp('torch_brazier', cx + 130, cy + 90);
        this.portalX = cx;
        this.portalY = cy;
        if (!room.cleared) {
          room.wavesSpawned = 0;
          room.wavesTotal = Math.max(1, room.waves.length || room.wavesTotal);
          this.spawnNextRoomWave();
        } else {
          this.portalActive = true;
        }
        break;
      }
      case 'boss': {
        this.spawnProp('torch_brazier', 6 * TILE_SIZE, 4 * TILE_SIZE);
        this.spawnProp('torch_brazier', 30 * TILE_SIZE, 4 * TILE_SIZE);
        this.spawnProp('torch_brazier', 6 * TILE_SIZE, 18 * TILE_SIZE);
        this.spawnProp('torch_brazier', 30 * TILE_SIZE, 18 * TILE_SIZE);
        this.portalX = cx;
        this.portalY = cy;
        if (!room.cleared) {
          room.wavesSpawned = 1;
          room.wavesTotal = 1;
          this.spawnEnemy('spore_king', this.map.width * 0.68, cy, false);
        } else {
          this.portalActive = true;
        }
        break;
      }
    }
  }

  public spawnNextRoomWave(): void {
    const room = this.getCurrentRoom();
    room.wavesSpawned += 1;
    this.waveNumber += 1;

    const cx = this.map.width * 0.64;
    const cy = this.map.height * 0.5;
    const offsets: readonly [number, number][] = [
      [-90, -110],
      [90, -110],
      [130, 0],
      [-80, 110],
      [90, 110],
      [0, -135],
    ];

    const waveDef = room.waves[room.wavesSpawned - 1];
    if (waveDef && waveDef.enemies.length > 0) {
      for (let i = 0; i < waveDef.enemies.length; i++) {
        const entry = waveDef.enemies[i]!;
        const [ox, oy] = offsets[i % offsets.length]!;
        const eliteMod: EliteModifier | null = entry.isElite
          ? (entry.eliteModifier ?? ELITE_MODIFIERS[(room.id + i) % ELITE_MODIFIERS.length]!)
          : null;
        this.spawnEnemy(entry.defId, cx + ox, cy + oy, false, eliteMod);
      }
    } else {
      // Guarantees full Biome 1 enemy variety across waves (all 6 enemy types represented)
      const count = this.currentFloor === 1 ? 4 : 5;
      for (let i = 0; i < count; i++) {
        const defId =
          BIOME1_COMBAT_ENEMIES[
            (room.id + room.wavesSpawned * 2 + i) % BIOME1_COMBAT_ENEMIES.length
          ]!;
        const [ox, oy] = offsets[i % offsets.length]!;
        const isEliteSlot =
          i === count - 1 && (room.wavesSpawned >= room.wavesTotal || room.type === 'portal');
        const eliteMod: EliteModifier | null = isEliteSlot
          ? ELITE_MODIFIERS[(room.id + this.currentFloor + i) % ELITE_MODIFIERS.length]!
          : null;
        this.spawnEnemy(defId, cx + ox, cy + oy, false, eliteMod);
      }
    }

    this.rebuildCurrentRoomDoors();
  }

  private onRoomCleared(room: DungeonRoomNode): void {
    room.cleared = true;
    room.discovery = 'cleared';
    this.runStats.roomsCleared += 1;
    const cx = this.map.width * 0.5;
    const cy = this.map.height * 0.5;

    // Phase 4 Co-op: Revive all Soul Ghosts & Downed teammates at 50% HP when a room is cleared!
    const allPlayers = this.getAllPlayers();
    for (const p of allPlayers) {
      if (p.lifeState === 'ghost' || p.lifeState === 'downed') {
        p.lifeState = 'alive';
        p.downedTimer = 0;
        p.reviveProgress = 0;
        p.reviverPlayerId = null;
        p.hp = Math.max(2, Math.ceil(p.maxHp * 0.5));
        p.armor = Math.min(p.maxArmor, 2);
        p.invulnerableTimer = 1.5;
        this.events.push({
          kind: 'player_revived',
          playerId: p.id,
          reviverId: 0,
          x: p.x,
          y: p.y,
        });
      }
    }

    if (room.type === 'combat') {
      const rarity = room.chestRarity ?? this.rollChestRarity(0);
      this.spawnChest(cx, cy, rarity, room.chestWeaponId ?? undefined);
    } else if (room.type === 'portal') {
      this.portalActive = true;
      this.portalX = cx;
      this.portalY = cy;
    } else if (room.type === 'boss') {
      this.portalActive = true;
      this.portalX = cx;
      this.portalY = cy;
      this.spawnChest(cx + 95, cy, 'legendary', room.chestWeaponId ?? 'solar_archon_staff');
      this.runState = 'victory';
    }

    this.roomChestsByRoomId.set(room.id, [...this.chests]);
    this.roomItemsByRoomId.set(room.id, [...this.worldItems]);
    this.rebuildCurrentRoomDoors();
    this.events.push({
      kind: 'room_cleared',
      roomId: room.id,
      roomType: room.type,
    });
  }

  public rollChestRarity(bonusTier = 0): WeaponRarity {
    const r = this.rng.next() + bonusTier * 0.18 + (this.currentFloor - 1) * 0.12;
    if (r >= 0.92) return 'legendary';
    if (r >= 0.72) return 'epic';
    if (r >= 0.45) return 'rare';
    if (r >= 0.2) return 'uncommon';
    return 'common';
  }

  public rollRandomWeaponByRarities(allowedRarities: readonly WeaponRarity[]): string {
    const candidates = PHASE3_WEAPON_IDS.filter((id) => {
      const w = WEAPONS[id];
      return w && allowedRarities.includes(w.rarity);
    });
    if (candidates.length === 0) return 'gale_smg';
    return this.rng.pick(candidates);
  }

  public spawnChest(
    x: number,
    y: number,
    rarity: WeaponRarity,
    preselectedWeaponId?: string,
  ): SimChestState {
    const droppedWeaponId =
      preselectedWeaponId && WEAPONS[preselectedWeaponId]
        ? preselectedWeaponId
        : this.rollRandomWeaponByRarities([rarity]);
    const chest: SimChestState = {
      id: ++this.nextEntityId,
      x,
      y,
      radius: 18,
      rarity,
      opened: false,
      droppedWeaponId,
    };
    this.chests.push(chest);
    return chest;
  }

  public spawnWorldItem(
    init: Omit<SimWorldItemState, 'id' | 'radius' | 'pickedUp'>,
  ): SimWorldItemState {
    const item: SimWorldItemState = {
      ...init,
      id: ++this.nextEntityId,
      radius: 15,
      pickedUp: false,
    };
    this.worldItems.push(item);
    return item;
  }

  public openChest(chest: SimChestState): boolean {
    if (chest.opened) return false;
    chest.opened = true;
    const room = this.getCurrentRoom();
    room.chestOpened = true;
    this.runStats.chestsOpened += 1;

    const wep = WEAPONS[chest.droppedWeaponId] ?? WEAPONS.gale_smg!;
    const allPlayers = this.getAllPlayers();

    if (allPlayers.length > 1) {
      // Phase 4 Co-op Instanced Loot: each player receives their own weapon drop & orbs!
      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const p = allPlayers[pIdx]!;
        const instancedWepId =
          pIdx === 0 ? wep.id : this.rollRandomWeaponByRarities([chest.rarity, wep.rarity]);
        const instancedWep = WEAPONS[instancedWepId] ?? wep;
        const offsetX = (pIdx - (allPlayers.length - 1) * 0.5) * 34;
        this.spawnWorldItem({
          kind: 'weapon',
          weaponId: instancedWep.id,
          rarity: instancedWep.rarity,
          nameVi: instancedWep.nameVi,
          costGold: 0,
          healAmount: 0,
          x: chest.x + offsetX,
          y: chest.y + 28,
          ownerPlayerId: p.id,
        });

        for (let i = 0; i < 3; i++) {
          const ang = -Math.PI * 0.5 + (i - 1) * 0.6 + pIdx * 0.25;
          this.pickups.push(
            this.acquirePickup({
              id: ++this.nextEntityId,
              kind: i === 1 ? 'energy' : 'gold',
              x: chest.x,
              y: chest.y,
              vx: Math.cos(ang) * 95,
              vy: Math.sin(ang) * 95,
              amount: i === 1 ? 15 : 10,
              ttlSec: 20,
              ownerPlayerId: p.id,
            }),
          );
        }
      }
    } else {
      this.spawnWorldItem({
        kind: 'weapon',
        weaponId: wep.id,
        rarity: wep.rarity,
        nameVi: wep.nameVi,
        costGold: 0,
        healAmount: 0,
        x: chest.x,
        y: chest.y + 28,
      });

      for (let i = 0; i < 3; i++) {
        const ang = -Math.PI * 0.5 + (i - 1) * 0.6;
        this.pickups.push(
          this.acquirePickup({
            id: ++this.nextEntityId,
            kind: i === 1 ? 'energy' : 'gold',
            x: chest.x,
            y: chest.y,
            vx: Math.cos(ang) * 95,
            vy: Math.sin(ang) * 95,
            amount: i === 1 ? 15 : 10,
            ttlSec: 20,
          }),
        );
      }
    }

    this.roomChestsByRoomId.set(room.id, [...this.chests]);
    this.roomItemsByRoomId.set(room.id, [...this.worldItems]);

    this.events.push({
      kind: 'chest_opened',
      chestId: chest.id,
      rarity: chest.rarity,
      weaponId: wep.id,
      x: chest.x,
      y: chest.y,
    });
    return true;
  }

  public pickupOrBuyWorldItem(
    item: SimWorldItemState,
    collector: SimPlayerState = this.player,
  ): boolean {
    if (item.pickedUp || collector.lifeState !== 'alive') return false;
    // Enforce Instanced Loot ownership if ownerPlayerId is set
    if (
      item.ownerPlayerId !== undefined &&
      item.ownerPlayerId !== 0 &&
      item.ownerPlayerId !== collector.id
    ) {
      return false;
    }

    if (item.costGold > 0) {
      if (collector.gold >= item.costGold) {
        collector.gold -= item.costGold;
      } else if (!collector.godMode) {
        return false;
      } else {
        collector.gold = 0;
      }
      this.events.push({
        kind: 'item_purchased',
        itemId: item.id,
        nameVi: item.nameVi,
        costGold: item.costGold,
        x: item.x,
        y: item.y,
      });
    }

    item.pickedUp = true;
    const room = this.getCurrentRoom();
    if (item.offerId) {
      const offer = room.shopOffers.find((o) => o.id === item.offerId);
      if (offer) offer.purchased = true;
    }
    this.roomItemsByRoomId.set(room.id, [...this.worldItems]);

    if (item.kind === 'health_potion') {
      collector.hp = Math.min(collector.maxHp, collector.hp + item.healAmount);
      collector.armor = Math.min(collector.maxArmor, collector.armor + 2);
      return true;
    }

    if (item.kind === 'armor_upgrade') {
      collector.maxArmor += 2;
      collector.armor = collector.maxArmor;
      return true;
    }

    if (item.kind === 'weapon' && item.weaponId && WEAPONS[item.weaponId]) {
      const existingIdx = collector.weaponSlots.indexOf(item.weaponId);
      if (existingIdx >= 0) {
        if (collector.id === this.player.id) {
          this.equipWeaponSlot(existingIdx);
        } else {
          collector.activeWeaponSlot = existingIdx;
        }
      } else if (collector.weaponSlots.length < 4) {
        collector.weaponSlots.push(item.weaponId);
        if (collector.id === this.player.id) {
          this.equipWeaponSlot(collector.weaponSlots.length - 1);
        } else {
          collector.activeWeaponSlot = collector.weaponSlots.length - 1;
        }
      } else {
        collector.weaponSlots[collector.activeWeaponSlot] = item.weaponId;
        this.events.push({
          kind: 'weapon_swapped',
          weaponId: item.weaponId,
          slot: collector.activeWeaponSlot,
        });
      }
      return true;
    }
    return false;
  }

  public activateShrine(shrine: SimNpcState, actor: SimPlayerState = this.player): boolean {
    if (shrine.kind !== 'shrine' || shrine.interacted || actor.lifeState !== 'alive') return false;
    const costGold = shrine.costGold ?? 25;
    if (actor.gold >= costGold) {
      actor.gold -= costGold;
    } else if (actor.hp > shrine.costHp) {
      actor.hp -= shrine.costHp;
    } else if (!actor.godMode) {
      return false;
    }

    shrine.interacted = true;
    const room = this.getCurrentRoom();
    room.shrineUsed = true;

    for (const p of this.getAllPlayers()) {
      p.maxEnergy += 30;
      p.energy = p.maxEnergy;
      p.armor = p.maxArmor;
    }

    // Also grant the room's shrineBlessingId buff if available
    const blessingId = room.shrineBlessingId as BuffId | null;
    if (blessingId && FLOOR_BUFFS[blessingId] && !this.activeBuffIds.includes(blessingId)) {
      this.applyBuffEffects(blessingId);
    }

    const blessedWepId = this.rollRandomWeaponByRarities(['epic', 'legendary']);
    const blessedWep = WEAPONS[blessedWepId]!;
    this.spawnWorldItem({
      kind: 'weapon',
      weaponId: blessedWep.id,
      rarity: blessedWep.rarity,
      nameVi: blessedWep.nameVi,
      costGold: 0,
      healAmount: 0,
      x: shrine.x,
      y: shrine.y + 62,
    });
    this.roomItemsByRoomId.set(room.id, [...this.worldItems]);

    const buffDef = blessingId ? FLOOR_BUFFS[blessingId] : undefined;
    shrine.dialogueVi = buffDef
      ? `Phước lành Cổ Ngữ: ${buffDef.nameVi} & ${blessedWep.nameVi}!`
      : `Phước lành Cổ Ngữ: +30 Năng Lượng & ${blessedWep.nameVi}!`;
    this.events.push({
      kind: 'shrine_blessing',
      x: shrine.x,
      y: shrine.y,
      rewardTextVi: shrine.dialogueVi,
    });
    return true;
  }

  public enterPortal(): boolean {
    if (!this.portalActive) return false;
    if (this.inHub) {
      this.startDungeonRunFromHub();
      return true;
    }
    if (this.currentFloor === 1) {
      this.runState = 'buff_choice';
      this.rollPendingBuffChoices();
      this.events.push({
        kind: 'portal_entered',
        floorNumber: this.currentFloor,
      });
      return true;
    }
    this.runState = 'victory';
    this.events.push({
      kind: 'portal_entered',
      floorNumber: this.currentFloor,
    });
    return true;
  }

  private rollPendingBuffChoices(): void {
    const available: BuffId[] = FLOOR_BUFF_LIST.map((b) => b.id).filter(
      (id) => !this.activeBuffIds.includes(id),
    );
    const choices: BuffId[] = [];

    // Ensure at least 1 Thiết Vệ skill upgrade is offered on Floor 1 -> 2 transition
    const skillUpgrades = available.filter(
      (id) => id === 'vanguard_fortress' || id === 'vanguard_charge',
    );
    if (skillUpgrades.length > 0) {
      const pickedSkill = this.rng.pick(skillUpgrades);
      choices.push(pickedSkill);
    }

    const rest = available.filter((id) => !choices.includes(id));
    while (choices.length < 3 && rest.length > 0) {
      const idx = this.rng.nextInt(0, rest.length - 1);
      choices.push(rest[idx]!);
      rest.splice(idx, 1);
    }
    this.pendingBuffChoices = choices;
  }

  private applyBuffEffects(buffId: BuffId): void {
    const def = FLOOR_BUFFS[buffId];
    if (!def || this.activeBuffIds.includes(buffId)) return;
    this.activeBuffIds.push(buffId);
    for (const p of this.getAllPlayers()) {
      if (buffId === 'vitality_surge') {
        p.maxHp += 3;
        p.hp = p.maxHp;
      } else if (buffId === 'iron_bastion') {
        p.maxArmor += 2;
        p.armor = p.maxArmor;
        p.armorRegenDelaySec = Math.max(0.8, p.armorRegenDelaySec - 0.5);
      } else if (buffId === 'arcane_wellspring') {
        p.maxEnergy += 60;
        p.energy = p.maxEnergy;
      } else if (buffId === 'gale_reflex') {
        p.moveSpeed = Math.round(p.moveSpeed * 1.2);
      }
    }
    this.events.push({
      kind: 'buff_selected',
      buffId,
      nameVi: def.nameVi,
    });
  }

  public selectFloorBuff(buffId: BuffId): boolean {
    const def = FLOOR_BUFFS[buffId];
    if (!def) return false;

    this.applyBuffEffects(buffId);

    this.pendingBuffChoices = [];
    if (this.currentFloor === 1) {
      this.advanceToFloor(2);
    } else {
      this.runState = 'playing';
    }
    return true;
  }

  public advanceToFloor(floorNumber: 1 | 2): void {
    this.currentFloor = floorNumber;
    this.runStats.floorReached = Math.max(this.runStats.floorReached, floorNumber);
    this.runState = 'playing';
    this.roomChestsByRoomId.clear();
    this.roomItemsByRoomId.clear();
    this.initializedRoomIds.clear();
    this.dungeon = generateDungeonFloor(this.baseSeed, floorNumber, 1, this.getActivePlayerCount());
    this.enterRoom(this.dungeon.startRoomId);
  }

  public skipCurrentRoomWaves(): void {
    const room = this.getCurrentRoom();
    room.wavesSpawned = room.wavesTotal;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (!e.isDummy && e.hp > 0) {
        e.shieldArmor = 0;
        this.applyDamageToEnemy(e, e.hp, true, 'burn', 0, 0, true);
      }
    }
    this.enemies = this.enemies.filter((e) => e.isDummy || e.hp > 0);
    if (!room.cleared) {
      this.onRoomCleared(room);
    } else {
      this.rebuildCurrentRoomDoors();
    }
  }

  public interactWithNearest(actor: SimPlayerState = this.player): boolean {
    if (actor.lifeState !== 'alive') return false;
    const p = actor;
    const interactRange = 64;

    // 0. Hub Character Statues
    if (this.inHub) {
      for (let i = 0; i < this.hubStatues.length; i++) {
        const statue = this.hubStatues[i]!;
        if (distance(p.x, p.y, statue.x, statue.y) <= interactRange + 8) {
          return this.selectCharacter(p.id, statue.characterId);
        }
      }
    }

    // 1. Unopened Chests
    for (let i = 0; i < this.chests.length; i++) {
      const chest = this.chests[i]!;
      if (!chest.opened && distance(p.x, p.y, chest.x, chest.y) <= interactRange) {
        return this.openChest(chest);
      }
    }

    // 2. World Items (Weapons / Shop Potions)
    for (let i = 0; i < this.worldItems.length; i++) {
      const item = this.worldItems[i]!;
      if (!item.pickedUp && distance(p.x, p.y, item.x, item.y) <= interactRange) {
        if (this.pickupOrBuyWorldItem(item, p)) {
          return true;
        }
      }
    }

    // 3. Ancient Shrine
    for (let i = 0; i < this.npcEntities.length; i++) {
      const npc = this.npcEntities[i]!;
      if (
        npc.kind === 'shrine' &&
        !npc.interacted &&
        distance(p.x, p.y, npc.x, npc.y) <= interactRange + 8
      ) {
        return this.activateShrine(npc, p);
      }
    }

    // 4. Active Portal
    if (this.portalActive && distance(p.x, p.y, this.portalX, this.portalY) <= interactRange + 8) {
      if (this.inHub) {
        p.ready = true;
        if (this.areAllPlayersReady()) {
          this.startDungeonRunFromHub();
        }
        return true;
      }
      return this.enterPortal();
    }

    // 5. Unlocked Doors
    for (let i = 0; i < this.doors.length; i++) {
      const door = this.doors[i]!;
      if (!door.locked && distance(p.x, p.y, door.x, door.y) <= interactRange + 8) {
        return this.enterRoom(door.targetRoomId, door.dir);
      }
    }

    return false;
  }

  /**
   * Executes a single 60Hz deterministic simulation tick (dtSec = 1/60).
   */
  public step(dtSec: number): void {
    this.tick += 1;
    this.runStats.ticksElapsed += 1;
    if (this.doorTransitionCooldown > 0) {
      this.doorTransitionCooldown = Math.max(0, this.doorTransitionCooldown - dtSec);
    }

    // Decay active contextual ping markers
    if (this.pings.length > 0) {
      let pingWrite = 0;
      for (let i = 0; i < this.pings.length; i++) {
        const m = this.pings[i]!;
        m.ttlSec -= dtSec;
        if (m.ttlSec > 0) {
          this.pings[pingWrite++] = m;
        }
      }
      this.pings.length = pingWrite;
    }

    if (this.botAutoPlayActive && !this.stressTestActive) {
      this.stepBotAutoPlay(dtSec);
    }

    // 1. Save previous positions for render interpolation
    this.player.prevX = this.player.x;
    this.player.prevY = this.player.y;
    for (let i = 0; i < this.simulatedPlayers.length; i++) {
      const sp = this.simulatedPlayers[i]!;
      sp.prevX = sp.x;
      sp.prevY = sp.y;
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      e.prevX = e.x;
      e.prevY = e.y;
    }
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i]!;
      p.prevX = p.x;
      p.prevY = p.y;
    }
    for (let i = 0; i < this.pickups.length; i++) {
      const pk = this.pickups[i]!;
      pk.prevX = pk.x;
      pk.prevY = pk.y;
    }

    // 2. Step dynamic elemental surfaces (fire propagation, electrified water decay, ice melt)
    this.map.stepSurfaces(dtSec);

    // 3. Rebuild enemy spatial grid once before player/enemy updates
    this.rebuildEnemySpatialGrid();

    // 4. Update Player & Co-op / Simulated Players
    this.updatePlayer(dtSec);
    if (this.simulatedPlayers.length > 0) {
      this.updateSimulatedPlayers(dtSec);
    }
    if (!this.stressTestActive && (this.coopModeActive || this.simulatedPlayers.length > 0)) {
      this.updateCoopDownedAndRevive(dtSec);
    }

    // 5. Update Destructible Props & Barrel Fuses
    this.updateProps(dtSec);

    // 6. Update Enemies, Elemental Status DoTs & AI
    this.updateEnemies(dtSec);

    // 7. Rebuild enemy spatial grid after enemy movement for projectile collision checks
    this.rebuildEnemySpatialGrid();

    // 8. Update Projectiles & Collisions
    this.updateProjectiles(dtSec);

    // 9. Update Pickups (Magnet & Collection)
    this.updatePickups(dtSec);

    // 10. Stress Test top-up or Dungeon Room / Wave progression
    if (this.stressTestActive) {
      const enemyTypes = PHASE1_SAMPLE_ENEMIES;
      while (this.enemies.length < 80) {
        const defId = enemyTypes[this.enemies.length % enemyTypes.length]!;
        const e = this.spawnEnemy(defId, undefined, undefined, true);
        e.hp = 500;
        e.maxHp = 500;
      }
      if (this.projectiles.length < 610) {
        this.topUpStressTestProjectiles(625);
      }
    } else if (!this.inHub) {
      this.updateCurrentRoomProgression(dtSec);
    }

    // Prune old DPS history (> 3 seconds = 180 ticks)
    const minTick = this.tick - 180;
    let firstValidIdx = 0;
    while (
      firstValidIdx < this.damageHistory.length &&
      this.damageHistory[firstValidIdx]!.tick < minTick
    ) {
      this.damageHistoryPool.push(this.damageHistory[firstValidIdx]!);
      firstValidIdx++;
    }
    if (firstValidIdx > 0) {
      let writeIdx = 0;
      for (let i = firstValidIdx; i < this.damageHistory.length; i++) {
        this.damageHistory[writeIdx++] = this.damageHistory[i]!;
      }
      this.damageHistory.length = writeIdx;
    }

    this.prevButtons = this.currentInput.buttons;
    this.latchedButtons = 0;
    this.latchedWeaponSlot = null;
  }

  private updateCurrentRoomProgression(dtSec: number): void {
    const room = this.getCurrentRoom();
    if (room.type === 'start' && this.map.getTile(18, 0) !== 'cracked_wall') {
      this.secretWallBroken = true;
    }

    const hasCombatEnemies = this.hasActiveCombatEnemies();

    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i]!;
      if (d.isSecretPassage) {
        d.locked = !this.secretWallBroken || hasCombatEnemies;
      } else {
        d.locked = hasCombatEnemies;
      }
    }

    if (!hasCombatEnemies) {
      if (!room.cleared) {
        if (room.wavesSpawned < room.wavesTotal) {
          this.waveRespawnTimer += dtSec;
          if (this.waveRespawnTimer >= 0.85) {
            this.waveRespawnTimer = 0;
            this.spawnNextRoomWave();
          }
        } else {
          this.onRoomCleared(room);
        }
      } else if (room.type === 'start' && this.autoRespawnWaves && !this.botAutoPlayActive) {
        this.waveRespawnTimer += dtSec;
        if (this.waveRespawnTimer >= 1.5) {
          this.waveRespawnTimer = 0;
          this.spawnSampleWave();
        }
      }
    } else {
      this.waveRespawnTimer = 0;
    }
  }

  public stepBotAutoPlay(_dtSec: number): void {
    const p = this.player;
    p.godMode = true;
    p.energy = p.maxEnergy;

    if (this.inHub) {
      for (const ally of this.getAllPlayers()) {
        ally.ready = true;
      }
      this.startDungeonRunFromHub();
      return;
    }

    if (this.runState === 'buff_choice' && this.pendingBuffChoices.length > 0) {
      this.selectFloorBuff(this.pendingBuffChoices[0]!);
      return;
    }
    if (this.runState === 'victory' || this.runState === 'defeat') {
      return;
    }

    // Equip best ranged weapon in slots
    let bestSlot = p.activeWeaponSlot;
    let bestScore = -1;
    for (let s = 0; s < p.weaponSlots.length; s++) {
      const wid = p.weaponSlots[s]!;
      const w = WEAPONS[wid];
      if (!w || w.category === 'melee') continue;
      const score = w.damage * w.fireRate * Math.max(1, w.pelletCount);
      if (score > bestScore) {
        bestScore = score;
        bestSlot = s;
      }
    }
    if (bestSlot !== p.activeWeaponSlot) {
      this.equipWeaponSlot(bestSlot);
    }

    // 1. Fight active non-dummy enemies
    let nearestEnemy: SimEnemyState | null = null;
    let nearestDist = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (e.isDummy || e.hp <= 0) continue;
      const d = distance(p.x, p.y, e.x, e.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestEnemy = e;
      }
    }

    if (nearestEnemy) {
      const angleToEnemy = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
      const orbitDir = Math.sin(this.tick * 0.025) >= 0 ? 1 : -1;
      const strafeAng = angleToEnemy + orbitDir * Math.PI * 0.5;
      let moveX = 0;
      let moveY = 0;
      if (nearestDist > 190) {
        moveX = Math.cos(angleToEnemy) * 0.8 + Math.cos(strafeAng) * 0.6;
        moveY = Math.sin(angleToEnemy) * 0.8 + Math.sin(strafeAng) * 0.6;
      } else if (nearestDist < 110) {
        moveX = -Math.cos(angleToEnemy) * 0.8 + Math.cos(strafeAng) * 0.6;
        moveY = -Math.sin(angleToEnemy) * 0.8 + Math.sin(strafeAng) * 0.6;
      } else {
        moveX = Math.cos(strafeAng);
        moveY = Math.sin(strafeAng);
      }

      let buttons = INPUT_BUTTON.FIRE;
      if (p.skillCooldownTimer <= 0 && p.skillActiveTimer <= 0) {
        buttons |= INPUT_BUTTON.SKILL;
      }
      if (p.dashCooldownTimer <= 0 && nearestDist < 105) {
        buttons |= INPUT_BUTTON.DASH;
      }

      this.setPlayerInput({
        seq: this.tick,
        tick: this.tick,
        moveX,
        moveY,
        aimAngle: angleToEnemy,
        buttons,
        weaponSlotSelect: null,
      });

      // Also drive co-op teammates in botAutoPlay mode so all 4 players fight together!
      for (let i = 0; i < this.simulatedPlayers.length; i++) {
        const sp = this.simulatedPlayers[i]!;
        sp.godMode = true;
        sp.energy = sp.maxEnergy;
        const spAng = Math.atan2(nearestEnemy.y - sp.y, nearestEnemy.x - sp.x);
        const spDist = distance(sp.x, sp.y, nearestEnemy.x, nearestEnemy.y);
        const spStrafe = spAng + (i % 2 === 0 ? 1 : -1) * Math.PI * 0.5;
        const spMoveX = spDist > 175 ? Math.cos(spAng) : Math.cos(spStrafe);
        const spMoveY = spDist > 175 ? Math.sin(spAng) : Math.sin(spStrafe);
        this.setCoopPlayerInput(sp.id, {
          seq: this.tick,
          tick: this.tick,
          moveX: spMoveX,
          moveY: spMoveY,
          aimAngle: spAng,
          buttons: INPUT_BUTTON.FIRE | (sp.skillCooldownTimer <= 0 ? INPUT_BUTTON.SKILL : 0),
          weaponSlotSelect: null,
        });
      }
      return;
    }

    // 2. Open unopened chests in current room
    const unopenedChest = this.chests.find((c) => !c.opened);
    if (unopenedChest) {
      const d = distance(p.x, p.y, unopenedChest.x, unopenedChest.y);
      if (d <= 56) {
        this.openChest(unopenedChest);
      } else {
        const ang = Math.atan2(unopenedChest.y - p.y, unopenedChest.x - p.x);
        this.setPlayerInput({
          seq: this.tick,
          tick: this.tick,
          moveX: Math.cos(ang),
          moveY: Math.sin(ang),
          aimAngle: ang,
          buttons: INPUT_BUTTON.INTERACT,
        });
      }
      return;
    }

    // 3. Pick up free weapons on the ground (belonging to P1 or shared)
    const freeItem = this.worldItems.find(
      (it) =>
        !it.pickedUp &&
        it.costGold === 0 &&
        (it.ownerPlayerId === undefined || it.ownerPlayerId === 0 || it.ownerPlayerId === p.id),
    );
    if (freeItem) {
      const d = distance(p.x, p.y, freeItem.x, freeItem.y);
      if (d <= 56) {
        this.pickupOrBuyWorldItem(freeItem, p);
      } else {
        const ang = Math.atan2(freeItem.y - p.y, freeItem.x - p.x);
        this.setPlayerInput({
          seq: this.tick,
          tick: this.tick,
          moveX: Math.cos(ang),
          moveY: Math.sin(ang),
          aimAngle: ang,
          buttons: INPUT_BUTTON.INTERACT,
        });
      }
      return;
    }

    // 4. Activate Shrine if present
    const unusedShrine = this.npcEntities.find((n) => n.kind === 'shrine' && !n.interacted);
    if (unusedShrine) {
      const d = distance(p.x, p.y, unusedShrine.x, unusedShrine.y);
      if (d <= 58) {
        this.activateShrine(unusedShrine, p);
      } else {
        const ang = Math.atan2(unusedShrine.y - p.y, unusedShrine.x - p.x);
        this.setPlayerInput({
          seq: this.tick,
          tick: this.tick,
          moveX: Math.cos(ang),
          moveY: Math.sin(ang),
          aimAngle: ang,
          buttons: INPUT_BUTTON.INTERACT,
        });
      }
      return;
    }

    // 5. Enter active portal if in portal/boss room
    if (this.portalActive) {
      const d = distance(p.x, p.y, this.portalX, this.portalY);
      if (d <= 58) {
        this.enterPortal();
      } else {
        const ang = Math.atan2(this.portalY - p.y, this.portalX - p.x);
        this.setPlayerInput({
          seq: this.tick,
          tick: this.tick,
          moveX: Math.cos(ang),
          moveY: Math.sin(ang),
          aimAngle: ang,
          buttons: INPUT_BUTTON.INTERACT,
        });
      }
      return;
    }

    // 6. Navigate via BFS to the next uncleared / unvisited room (or portal/boss room)
    const nextDoor = this.findNextBotDoor();
    if (nextDoor && !nextDoor.locked) {
      const d = distance(p.x, p.y, nextDoor.x, nextDoor.y);
      if (d <= 60) {
        this.enterRoom(nextDoor.targetRoomId, nextDoor.dir);
      } else {
        const cx = this.map.width * 0.5;
        const cy = this.map.height * 0.5;
        // Route through the central cross corridor if far from axis to avoid corner pillars
        let tx = nextDoor.x;
        let ty = nextDoor.y;
        if (
          (nextDoor.dir === 'N' || nextDoor.dir === 'S') &&
          Math.abs(p.x - nextDoor.x) > 90 &&
          Math.abs(p.y - cy) > 70
        ) {
          tx = cx;
          ty = cy;
        } else if (
          (nextDoor.dir === 'E' || nextDoor.dir === 'W') &&
          Math.abs(p.y - nextDoor.y) > 90 &&
          Math.abs(p.x - cx) > 70
        ) {
          tx = cx;
          ty = cy;
        }
        const ang = Math.atan2(ty - p.y, tx - p.x);
        this.setPlayerInput({
          seq: this.tick,
          tick: this.tick,
          moveX: Math.cos(ang),
          moveY: Math.sin(ang),
          aimAngle: ang,
          buttons: INPUT_BUTTON.INTERACT,
        });
      }
    }
  }

  private findNextBotDoor(): SimDoorState | null {
    const unlockedDoors = this.doors.filter((d) => !d.locked);
    if (unlockedDoors.length === 0) return null;

    // BFS from currentRoomId to find shortest path to exitRoomId (portal on Floor 1, boss on Floor 2)
    const queue: { roomId: number; firstDir: CardinalDir }[] = [];
    const visited = new Set<number>([this.currentRoomId]);

    for (const d of unlockedDoors) {
      visited.add(d.targetRoomId);
      queue.push({ roomId: d.targetRoomId, firstDir: d.dir });
    }

    let unvisitedDir: CardinalDir | null = null;
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const room = this.dungeon.rooms[curr.roomId];
      if (!room) continue;
      if (curr.roomId === this.dungeon.exitRoomId) {
        return unlockedDoors.find((d) => d.dir === curr.firstDir) ?? unlockedDoors[0]!;
      }
      if (
        unvisitedDir === null &&
        room.discovery !== 'visited' &&
        room.discovery !== 'cleared' &&
        room.type !== 'secret'
      ) {
        unvisitedDir = curr.firstDir;
      }
      for (const nextId of Object.values(room.connections)) {
        if (nextId !== undefined && !visited.has(nextId)) {
          visited.add(nextId);
          queue.push({ roomId: nextId, firstDir: curr.firstDir });
        }
      }
    }

    if (unvisitedDir !== null) {
      return unlockedDoors.find((d) => d.dir === unvisitedDir) ?? unlockedDoors[0]!;
    }
    return unlockedDoors[0]!;
  }

  private recordDamageHistory(amount: number): void {
    const last = this.damageHistory[this.damageHistory.length - 1];
    if (last && last.tick === this.tick) {
      last.amount += amount;
      return;
    }
    const entry = this.damageHistoryPool.pop();
    if (entry) {
      entry.tick = this.tick;
      entry.amount = amount;
      this.damageHistory.push(entry);
    } else {
      this.damageHistory.push({ tick: this.tick, amount });
    }
  }

  public getRollingDps(): number {
    let sum = 0;
    for (let i = 0; i < this.damageHistory.length; i++) {
      sum += this.damageHistory[i]!.amount;
    }
    return Math.round((sum / 3) * 10) / 10;
  }

  private rebuildEnemySpatialGrid(): void {
    this.enemySpatialGrid.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (e.hp > 0 && e.aiState !== 'spawning' && !e.bossBurrowed) {
        this.enemySpatialGrid.insert(e);
      }
    }
  }

  private rebuildEnemyBulletSpatialGrid(): void {
    this.bulletSpatialGrid.clear();
    for (let i = 0; i < this.projectiles.length; i++) {
      const b = this.projectiles[i]!;
      if (b.ttlSec > 0 && b.team === 'enemy') {
        this.bulletSpatialGrid.insert(b);
      }
    }
  }

  private updatePlayer(dtSec: number): void {
    const inp = this.currentInput;
    const justPressed = (inp.buttons & ~this.prevButtons) | this.latchedButtons;
    const selectedSlot = this.latchedWeaponSlot ?? inp.weaponSlotSelect;
    this.updateSinglePlayerState(this.player, inp, justPressed, selectedSlot ?? null, dtSec);
  }

  private updateSinglePlayerState(
    p: SimPlayerState,
    inp: PlayerInputPacket,
    justPressed: number,
    selectedSlot: number | null,
    dtSec: number,
  ): void {
    p.aimAngle = inp.aimAngle;

    if (p.emoteTimer > 0) {
      p.emoteTimer = Math.max(0, p.emoteTimer - dtSec);
      if (p.emoteTimer <= 0) {
        p.emoteId = null;
      }
    }

    if (justPressed & INPUT_BUTTON.PING) {
      const px =
        typeof inp.pingWorldX === 'number'
          ? inp.pingWorldX
          : p.x + Math.cos(p.aimAngle) * 110;
      const py =
        typeof inp.pingWorldY === 'number'
          ? inp.pingWorldY
          : p.y + Math.sin(p.aimAngle) * 110;
      this.triggerPing(p.id, px, py);
    }

    if (justPressed & INPUT_BUTTON.READY) {
      if (this.inHub) {
        this.togglePlayerReady(p.id);
      }
    }

    if (justPressed & INPUT_BUTTON.DROP_WEAPON) {
      this.dropActiveWeapon(p.id);
    }

    // Downed or Ghost players can only move slowly (crawl/float) and Ping/Emote
    if (p.lifeState !== 'alive') {
      let dirX = inp.moveX;
      let dirY = inp.moveY;
      const len = Math.hypot(dirX, dirY);
      if (len > 1e-4) {
        dirX /= len;
        dirY /= len;
      } else {
        dirX = 0;
        dirY = 0;
      }
      const crawlSpeed = p.lifeState === 'downed' ? 38 : p.moveSpeed * 0.85;
      p.vx = dirX * crawlSpeed;
      p.vy = dirY * crawlSpeed;
      const col = this.map.resolveCircleCollision(
        p.x + p.vx * dtSec,
        p.y + p.vy * dtSec,
        p.radius,
      );
      p.x = col.x;
      p.y = col.y;
      return;
    }

    if (
      typeof selectedSlot === 'number' &&
      selectedSlot >= 0 &&
      selectedSlot < p.weaponSlots.length
    ) {
      if (p.id === this.player.id) {
        this.equipWeaponSlot(selectedSlot);
      } else if (p.activeWeaponSlot !== selectedSlot) {
        p.activeWeaponSlot = selectedSlot;
        p.fireCooldownTimer = Math.min(p.fireCooldownTimer, 0.08);
      }
    } else if (justPressed & INPUT_BUTTON.SWAP) {
      if (p.id === this.player.id) {
        this.cycleWeapon(1);
      } else if (p.weaponSlots.length > 1) {
        p.activeWeaponSlot = (p.activeWeaponSlot + 1) % p.weaponSlots.length;
      }
    }

    if (justPressed & INPUT_BUTTON.INTERACT) {
      this.interactWithNearest(p);
    }

    if (p.dashCooldownTimer > 0) p.dashCooldownTimer = Math.max(0, p.dashCooldownTimer - dtSec);
    if (p.invulnerableTimer > 0) p.invulnerableTimer = Math.max(0, p.invulnerableTimer - dtSec);
    if (p.hurtFlashTimer > 0) p.hurtFlashTimer = Math.max(0, p.hurtFlashTimer - dtSec);
    if (p.fireCooldownTimer > 0) p.fireCooldownTimer = Math.max(0, p.fireCooldownTimer - dtSec);
    if (p.recoilTimer > 0) p.recoilTimer = Math.max(0, p.recoilTimer - dtSec);
    if (p.skillCooldownTimer > 0) p.skillCooldownTimer = Math.max(0, p.skillCooldownTimer - dtSec);
    if (p.grassRustleCooldown > 0)
      p.grassRustleCooldown = Math.max(0, p.grassRustleCooldown - dtSec);

    if (p.energy < p.maxEnergy) {
      const regenMult = this.activeBuffIds.includes('arcane_wellspring') ? 1.5 : 1.0;
      this.energyRegenAccum += dtSec * 3.5 * regenMult;
      if (this.energyRegenAccum >= 1) {
        const gain = Math.floor(this.energyRegenAccum);
        this.energyRegenAccum -= gain;
        p.energy = Math.min(p.maxEnergy, p.energy + gain);
      }
    }

    // Engineer passive: allies within 4 tiles (128u) regenerate armor 30% faster!
    let hasNearbyEngineer = p.characterId === 'engineer' && p.lifeState === 'alive';
    if (!hasNearbyEngineer && !this.stressTestActive) {
      if (
        this.player.characterId === 'engineer' &&
        this.player.lifeState === 'alive' &&
        distance(p.x, p.y, this.player.x, this.player.y) <= TILE_SIZE * 4
      ) {
        hasNearbyEngineer = true;
      } else {
        for (let i = 0; i < this.simulatedPlayers.length; i++) {
          const ally = this.simulatedPlayers[i]!;
          if (
            ally.characterId === 'engineer' &&
            ally.lifeState === 'alive' &&
            distance(p.x, p.y, ally.x, ally.y) <= TILE_SIZE * 4
          ) {
            hasNearbyEngineer = true;
            break;
          }
        }
      }
    }
    const armorRegenRate = p.armorRegenPerSec * (hasNearbyEngineer ? 1.3 : 1.0);

    if (p.armorRegenTimer > 0) {
      p.armorRegenTimer = Math.max(0, p.armorRegenTimer - dtSec);
      p.armorRegenAccum = 0;
    } else if (p.armor < p.maxArmor && p.hp > 0) {
      p.armorRegenAccum += dtSec * armorRegenRate;
      if (p.armorRegenAccum >= 1) {
        const pts = Math.floor(p.armorRegenAccum);
        p.armorRegenAccum -= pts;
        p.armor = Math.min(p.maxArmor, p.armor + pts);
      }
    }

    // Surface under player
    const surf = this.map.getSurfaceAtWorld(p.x, p.y);
    this.updatePlayerSurfaceAndStatus(p, surf, dtSec);

    let dirX = inp.moveX;
    let dirY = inp.moveY;
    if (this.stressTestActive && dirX === 0 && dirY === 0) {
      const orbitAng = this.tick * 0.035;
      dirX = Math.cos(orbitAng);
      dirY = Math.sin(orbitAng);
      p.aimAngle = orbitAng + Math.PI * 0.5;
    }

    const len = Math.hypot(dirX, dirY);
    if (len > 1e-4) {
      dirX /= len;
      dirY /= len;
    } else {
      dirX = 0;
      dirY = 0;
    }

    const triggerDash =
      (justPressed & INPUT_BUTTON.DASH) !== 0 ||
      (this.stressTestActive && p.dashCooldownTimer <= 0 && this.tick % 90 === 0);

    if (triggerDash && p.dashCooldownTimer <= 0 && p.dashTimer <= 0) {
      const dashCd = this.activeBuffIds.includes('gale_reflex')
        ? DASH_COOLDOWN_SEC * 0.75
        : DASH_COOLDOWN_SEC;
      p.dashTimer = DASH_DURATION_SEC;
      p.invulnerableTimer = Math.max(p.invulnerableTimer, DASH_IFRAME_SEC);
      p.dashCooldownTimer = dashCd;
      if (dirX !== 0 || dirY !== 0) {
        p.dashDirX = dirX;
        p.dashDirY = dirY;
      } else {
        p.dashDirX = Math.cos(p.aimAngle);
        p.dashDirY = Math.sin(p.aimAngle);
      }
      const dashSpeed = p.moveSpeed * DASH_SPEED_MULTIPLIER;
      p.vx = p.dashDirX * dashSpeed;
      p.vy = p.dashDirY * dashSpeed;
      this.events.push({
        kind: 'dash_started',
        playerId: p.id,
        x: p.x,
        y: p.y,
        dirX: p.dashDirX,
        dirY: p.dashDirY,
      });
    }

    if (justPressed & INPUT_BUTTON.SKILL) {
      this.activateCharacterSkill(p);
    }

    if (p.skillActiveTimer > 0) {
      p.skillActiveTimer -= dtSec;
      if (p.skillActiveTimer <= 0) {
        if (p.characterId === 'vanguard') {
          this.releaseVanguardShieldShockwave(p);
        } else {
          p.skillActiveTimer = 0;
        }
      }
    }

    // Surface speed & friction modifiers (oil slows by 15%, ice reduces traction)
    let speedMult = 1.0;
    if (surf === 'oil' || surf === 'poison_swamp') speedMult *= 0.85;
    if (p.chillTimer > 0) speedMult *= 0.7;

    if (p.dashTimer > 0) {
      p.dashTimer = Math.max(0, p.dashTimer - dtSec);
      const dashSpeed = p.moveSpeed * DASH_SPEED_MULTIPLIER;
      p.vx = p.dashDirX * dashSpeed;
      p.vy = p.dashDirY * dashSpeed;
    } else {
      const effectiveSpeed = p.moveSpeed * speedMult;
      const targetVx = dirX * effectiveSpeed;
      const targetVy = dirY * effectiveSpeed;
      let accelRate =
        dirX !== 0 || dirY !== 0 ? effectiveSpeed / 0.055 : effectiveSpeed / 0.045;
      if (surf === 'ice') {
        accelRate *= dirX !== 0 || dirY !== 0 ? 0.32 : 0.16;
      }
      const maxDeltaV = accelRate * dtSec;
      p.vx = approach(p.vx, targetVx, maxDeltaV);
      p.vy = approach(p.vy, targetVy, maxDeltaV);
    }

    const kbDecay = Math.exp(-14 * dtSec);
    p.kbVx *= kbDecay;
    p.kbVy *= kbDecay;
    if (Math.abs(p.kbVx) < 1) p.kbVx = 0;
    if (Math.abs(p.kbVy) < 1) p.kbVy = 0;

    const nextX = p.x + (p.vx + p.kbVx) * dtSec;
    const nextY = p.y + (p.vy + p.kbVy) * dtSec;
    const col = this.map.resolveCircleCollision(nextX, nextY, p.radius);
    p.x = col.x;
    p.y = col.y;
    this.resolvePropMovementCollision(p);

    if (surf === 'grass' && Math.hypot(p.vx, p.vy) > 25 && p.grassRustleCooldown <= 0) {
      p.grassRustleCooldown = 0.22;
      this.events.push({ kind: 'grass_rustle', x: p.x, y: p.y });
    }

    if ((inp.buttons & INPUT_BUTTON.FIRE) && p.fireCooldownTimer <= 0 && p.hp > 0) {
      this.tryFireActiveWeapon(p);
    }

    if (
      !this.inHub &&
      !this.stressTestActive &&
      this.doorTransitionCooldown <= 0 &&
      !this.hasActiveCombatEnemies()
    ) {
      for (let i = 0; i < this.doors.length; i++) {
        const door = this.doors[i]!;
        if (door.locked) continue;
        if (distance(p.x, p.y, door.x, door.y) <= 26) {
          const movingIntoDoor =
            (door.dir === 'N' && dirY < -0.3) ||
            (door.dir === 'S' && dirY > 0.3) ||
            (door.dir === 'W' && dirX < -0.3) ||
            (door.dir === 'E' && dirX > 0.3);
          if (movingIntoDoor) {
            this.enterRoom(door.targetRoomId, door.dir);
            break;
          }
        }
      }
    }
  }

  private activateCharacterSkill(p: SimPlayerState): void {
    const cDef = CHARACTERS[p.characterId] ?? CHARACTERS.vanguard;
    const skillDef = cDef.skill;

    if (p.characterId === 'vanguard') {
      if (p.skillActiveTimer > 0) {
        this.releaseVanguardShieldShockwave(p);
      } else if (p.skillCooldownTimer <= 0) {
        const bonusDur = this.activeBuffIds.includes('vanguard_fortress') ? 1.5 : 0;
        p.skillActiveTimer = skillDef.durationSec + bonusDur;
        p.shieldStoredBullets = 0;
        if (this.activeBuffIds.includes('vanguard_fortress')) {
          p.armor = Math.min(p.maxArmor, p.armor + 2);
        }
        this.events.push({
          kind: 'skill_cast',
          playerId: p.id,
          skillId: skillDef.id,
          x: p.x,
          y: p.y,
          angle: p.aimAngle,
        });
      }
      return;
    }

    if (p.skillCooldownTimer > 0) return;
    p.skillCooldownTimer = skillDef.cooldownSec;
    this.events.push({
      kind: 'skill_cast',
      playerId: p.id,
      skillId: skillDef.id,
      x: p.x,
      y: p.y,
      angle: p.aimAngle,
    });

    if (p.characterId === 'ranger') {
      // Predator Arrow: backflip i-frame + high-damage piercing arrow
      p.dashTimer = 0.16;
      p.invulnerableTimer = Math.max(p.invulnerableTimer, 0.35);
      p.dashDirX = -Math.cos(p.aimAngle);
      p.dashDirY = -Math.sin(p.aimAngle);
      const proj = this.acquireProjectile({
        id: ++this.nextEntityId,
        ownerId: p.id,
        team: 'player',
        weaponId: 'hunter_crossbow',
        x: p.x + Math.cos(p.aimAngle) * 18,
        y: p.y + Math.sin(p.aimAngle) * 18,
        vx: Math.cos(p.aimAngle) * 680,
        vy: Math.sin(p.aimAngle) * 680,
        angle: p.aimAngle,
        radius: 6.5,
        damage: 28,
        isCrit: true,
        knockback: 180,
        pierceRemaining: 5,
        bounceRemaining: 0,
        ttlSec: 1.5,
        element: p.activeImbueElement !== 'none' ? p.activeImbueElement : 'shock',
        amplifiedByShield: true,
      });
      this.projectiles.push(proj);
      return;
    }

    if (p.characterId === 'elementalist') {
      // Elemental Orb: cycle element Lửa -> Băng -> Sét and detonate elemental zone
      const cycle: readonly ElementType[] = ['burn', 'chill', 'shock'];
      const curIdx = cycle.indexOf(p.activeImbueElement);
      const nextEl = cycle[(curIdx + 1) % cycle.length] ?? 'burn';
      p.activeImbueElement = nextEl;
      const orbX = clamp(
        p.x + Math.cos(p.aimAngle) * 115,
        TILE_SIZE * 2,
        this.map.width - TILE_SIZE * 2,
      );
      const orbY = clamp(
        p.y + Math.sin(p.aimAngle) * 115,
        TILE_SIZE * 2,
        this.map.height - TILE_SIZE * 2,
      );
      this.applyElementAtWorldPoint(orbX, orbY, nextEl, 56);
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i]!;
        if (e.hp > 0 && distance(orbX, orbY, e.x, e.y) <= 68 + e.radius) {
          this.applyDamageToEnemy(
            e,
            20,
            true,
            nextEl,
            Math.atan2(e.y - orbY, e.x - orbX),
            150,
            true,
          );
        }
      }
      return;
    }

    if (p.characterId === 'druid') {
      // Sacred Tree: heal allies +2 HP, root/stun nearby enemies 1.5s, and INSTANTLY revive downed teammates!
      for (const ally of this.getAllPlayers()) {
        if (ally.lifeState === 'downed' && distance(p.x, p.y, ally.x, ally.y) <= 175) {
          ally.lifeState = 'alive';
          ally.hp = 2;
          ally.armor = Math.min(ally.maxArmor, 2);
          ally.invulnerableTimer = 1.5;
          ally.downedTimer = 0;
          ally.reviveProgress = 0;
          ally.reviverPlayerId = null;
          this.events.push({
            kind: 'player_revived',
            playerId: ally.id,
            reviverId: p.id,
            x: ally.x,
            y: ally.y,
          });
        } else if (ally.lifeState === 'alive') {
          ally.hp = Math.min(ally.maxHp, ally.hp + 2);
        }
      }
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i]!;
        if (!e.isDummy && e.hp > 0 && distance(p.x, p.y, e.x, e.y) <= 150) {
          e.aiState = 'stunned';
          e.stateTimer = 1.5;
          this.applyDamageToEnemy(e, 12, false, 'poison', Math.atan2(e.y - p.y, e.x - p.x), 80);
        }
      }
      return;
    }

    if (p.characterId === 'engineer') {
      // Tesla Turret / EMP Pulse: clear enemy bullets + chain lightning to nearby enemies + restore armor
      for (let i = 0; i < this.projectiles.length; i++) {
        const b = this.projectiles[i]!;
        if (b.team === 'enemy' && b.ttlSec > 0 && distance(p.x, p.y, b.x, b.y) <= 150) {
          b.ttlSec = 0;
        }
      }
      for (const ally of this.getAllPlayers()) {
        if (ally.lifeState === 'alive' && distance(p.x, p.y, ally.x, ally.y) <= 150) {
          ally.armor = Math.min(ally.maxArmor, ally.armor + 2);
        }
      }
      let zapped = 0;
      for (let i = 0; i < this.enemies.length && zapped < 4; i++) {
        const e = this.enemies[i]!;
        if (e.hp > 0 && distance(p.x, p.y, e.x, e.y) <= 185) {
          zapped += 1;
          this.applyDamageToEnemy(e, 18, true, 'shock', Math.atan2(e.y - p.y, e.x - p.x), 110);
          this.events.push({
            kind: 'chain_lightning',
            fromX: p.x,
            fromY: p.y,
            toX: e.x,
            toY: e.y,
          });
        }
      }
    }
  }

  private updateSimulatedPlayers(dtSec: number): void {
    if (!this.stressTestActive) {
      for (let i = 0; i < this.simulatedPlayers.length; i++) {
        const sp = this.simulatedPlayers[i]!;
        const entry = this.coopPlayerInputs.get(sp.id);
        if (entry) {
          const justPressed =
            (entry.current.buttons & ~entry.prevButtons) | entry.latchedButtons;
          const selectedSlot = entry.latchedWeaponSlot ?? entry.current.weaponSlotSelect;
          this.updateSinglePlayerState(sp, entry.current, justPressed, selectedSlot ?? null, dtSec);
          entry.prevButtons = entry.current.buttons;
          entry.latchedButtons = 0;
          entry.latchedWeaponSlot = null;
        }
      }
      return;
    }

    const cx = this.map.width * 0.5;
    const cy = this.map.height * 0.5;

    for (let i = 0; i < this.simulatedPlayers.length; i++) {
      const sp = this.simulatedPlayers[i]!;
      const phase = this.tick * 0.03 + (i + 1) * 2.09;
      const targetX = cx + Math.cos(phase) * 220;
      const targetY = cy + Math.sin(phase * 1.3) * 140;
      const dx = targetX - sp.x;
      const dy = targetY - sp.y;
      const dist = Math.hypot(dx, dy);

      sp.aimAngle = phase + Math.PI * 0.5;
      if (sp.dashCooldownTimer > 0) sp.dashCooldownTimer = Math.max(0, sp.dashCooldownTimer - dtSec);
      if (sp.dashTimer > 0) {
        sp.dashTimer = Math.max(0, sp.dashTimer - dtSec);
        sp.vx = sp.dashDirX * sp.moveSpeed * DASH_SPEED_MULTIPLIER;
        sp.vy = sp.dashDirY * sp.moveSpeed * DASH_SPEED_MULTIPLIER;
      } else if (sp.dashCooldownTimer <= 0 && (this.tick + i * 31) % 95 === 0) {
        sp.dashTimer = DASH_DURATION_SEC;
        sp.dashCooldownTimer = DASH_COOLDOWN_SEC;
        sp.dashDirX = dist > 1 ? dx / dist : 1;
        sp.dashDirY = dist > 1 ? dy / dist : 0;
        this.events.push({
          kind: 'dash_started',
          playerId: sp.id,
          x: sp.x,
          y: sp.y,
          dirX: sp.dashDirX,
          dirY: sp.dashDirY,
        });
      } else if (dist > 4) {
        sp.vx = (dx / dist) * sp.moveSpeed;
        sp.vy = (dy / dist) * sp.moveSpeed;
      } else {
        sp.vx = 0;
        sp.vy = 0;
      }

      const col = this.map.resolveCircleCollision(
        sp.x + sp.vx * dtSec,
        sp.y + sp.vy * dtSec,
        sp.radius,
      );
      sp.x = col.x;
      sp.y = col.y;
    }
  }

  private updateCoopDownedAndRevive(dtSec: number): void {
    const allPlayers = this.getAllPlayers();
    for (let i = 0; i < allPlayers.length; i++) {
      const downed = allPlayers[i]!;
      if (downed.lifeState !== 'downed') continue;

      // Find an alive teammate within 64 units holding INTERACT (E) or standing within 46 units
      let reviver: SimPlayerState | null = null;
      for (let j = 0; j < allPlayers.length; j++) {
        const ally = allPlayers[j]!;
        if (ally.id === downed.id || ally.lifeState !== 'alive') continue;
        const d = distance(downed.x, downed.y, ally.x, ally.y);
        if (d <= 64) {
          const allyButtons =
            ally.id === this.player.id
              ? this.currentInput.buttons
              : (this.coopPlayerInputs.get(ally.id)?.current.buttons ?? 0);
          if ((allyButtons & INPUT_BUTTON.INTERACT) !== 0 || (this.botAutoPlayActive && d <= 46)) {
            reviver = ally;
            break;
          }
        }
      }

      if (reviver) {
        downed.reviverPlayerId = reviver.id;
        const requiredSec =
          reviver.characterId === 'druid'
            ? DRUID_REVIVE_HOLD_DURATION_SEC
            : REVIVE_HOLD_DURATION_SEC;
        downed.reviveProgress = Math.min(1, downed.reviveProgress + dtSec / requiredSec);
        if (downed.reviveProgress >= 1) {
          downed.lifeState = 'alive';
          downed.hp = 2;
          downed.armor = Math.min(downed.maxArmor, 2);
          downed.invulnerableTimer = 1.5;
          downed.downedTimer = 0;
          downed.reviveProgress = 0;
          downed.reviverPlayerId = null;
          this.events.push({
            kind: 'player_revived',
            playerId: downed.id,
            reviverId: reviver.id,
            x: downed.x,
            y: downed.y,
          });
          continue;
        }
      } else {
        downed.reviverPlayerId = null;
        downed.reviveProgress = Math.max(0, downed.reviveProgress - dtSec * 0.5);
        downed.downedTimer = Math.max(0, downed.downedTimer - dtSec);
        if (downed.downedTimer <= 0) {
          downed.lifeState = 'ghost';
          downed.reviveProgress = 0;
          this.events.push({
            kind: 'player_ghost',
            playerId: downed.id,
            x: downed.x,
            y: downed.y,
          });
        }
      }
    }
  }

  private updatePlayerSurfaceAndStatus(
    p: SimPlayerState,
    surf: SurfaceKind,
    dtSec: number,
  ): void {
    if (surf === 'water') {
      p.burnTimer = 0;
    } else if (surf === 'burning_oil' || surf === 'burning_grass' || surf === 'lava') {
      p.burnTimer = Math.max(p.burnTimer, 2.0);
    } else if (surf === 'poison_swamp') {
      p.poisonTimer = Math.max(p.poisonTimer, 2.5);
    } else if (surf === 'electrified_water') {
      p.surfaceTickTimer += dtSec;
      if (p.surfaceTickTimer >= 0.75) {
        p.surfaceTickTimer = 0;
        this.applyDamageToPlayer(1, 0, 20, 'electrified_water', p);
      }
    }

    if (p.burnTimer > 0) {
      p.burnTimer = Math.max(0, p.burnTimer - dtSec);
      p.burnTickTimer += dtSec;
      if (p.burnTickTimer >= 0.8) {
        p.burnTickTimer = 0;
        this.applyDamageToPlayer(1, 0, 10, 'burn', p);
      }
    }
    if (p.poisonTimer > 0) {
      p.poisonTimer = Math.max(0, p.poisonTimer - dtSec);
      p.poisonTickTimer += dtSec;
      if (p.poisonTickTimer >= 1.0) {
        p.poisonTickTimer = 0;
        this.applyDamageToPlayer(1, 0, 10, 'poison', p);
      }
    }
    if (p.chillTimer > 0) {
      p.chillTimer = Math.max(0, p.chillTimer - dtSec);
    }
  }

  private resolvePropMovementCollision(entity: { x: number; y: number; radius: number }): void {
    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i]!;
      if (prop.hp <= 0 || !prop.blocksMovement) continue;
      const dx = entity.x - prop.x;
      const dy = entity.y - prop.y;
      const minDist = entity.radius + prop.radius;
      const dSq = dx * dx + dy * dy;
      if (dSq < minDist * minDist && dSq > 1e-6) {
        const d = Math.sqrt(dSq);
        const push = minDist - d;
        entity.x += (dx / d) * push;
        entity.y += (dy / d) * push;
      }
    }
  }

  private updateProps(dtSec: number): void {
    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i]!;
      if (prop.hp <= 0) continue;
      if (prop.hitFlashTimer > 0) {
        prop.hitFlashTimer = Math.max(0, prop.hitFlashTimer - dtSec);
      }
      if (prop.fuseTimer > 0) {
        prop.fuseTimer -= dtSec;
        if (prop.fuseTimer <= 0) {
          this.detonateExplosiveBarrel(prop);
        }
      }
    }

    let writeIdx = 0;
    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i]!;
      if (prop.hp > 0) {
        this.props[writeIdx++] = prop;
      }
    }
    this.props.length = writeIdx;
  }

  public damageProp(prop: SimPropState, amount: number, element: ElementType = 'none'): void {
    if (!prop.destructible || prop.hp <= 0) return;

    prop.hp = Math.max(0, prop.hp - amount);
    prop.hitFlashTimer = 0.1;

    if (prop.explosive && (prop.hp <= 0 || element === 'burn')) {
      this.detonateExplosiveBarrel(prop);
      return;
    }

    if (prop.hp <= 0) {
      this.events.push({
        kind: 'prop_destroyed',
        propId: prop.id,
        propKind: prop.kind,
        x: prop.x,
        y: prop.y,
      });

      const ang = this.rng.nextFloat(-Math.PI, Math.PI);
      this.pickups.push(
        this.acquirePickup({
          id: ++this.nextEntityId,
          kind: 'gold',
          x: prop.x,
          y: prop.y,
          vx: Math.cos(ang) * 75,
          vy: Math.sin(ang) * 75,
          amount: 4,
          ttlSec: 12,
        }),
      );
      this.pickups.push(
        this.acquirePickup({
          id: ++this.nextEntityId,
          kind: 'energy',
          x: prop.x,
          y: prop.y,
          vx: -Math.cos(ang) * 75,
          vy: -Math.sin(ang) * 75,
          amount: 6,
          ttlSec: 12,
        }),
      );
    }
  }

  public detonateExplosiveBarrel(barrel: SimPropState): void {
    if (barrel.hp <= 0 && barrel.fuseTimer <= 0 && !barrel.explosive) return;
    barrel.hp = 0;
    barrel.fuseTimer = 0;
    barrel.explosive = false; // prevent re-entry

    const blastR = BARREL_EXPLOSION_RADIUS;

    this.events.push({
      kind: 'prop_destroyed',
      propId: barrel.id,
      propKind: barrel.kind,
      x: barrel.x,
      y: barrel.y,
    });
    this.events.push({
      kind: 'explosion',
      x: barrel.x,
      y: barrel.y,
      radius: blastR,
      damage: 24,
      sourceDefId: 'explosive_barrel',
    });
    this.events.push({
      kind: 'hit_stop',
      durationMs: 45,
      trauma: 0.45,
    });

    // 1. Ignite oil/grass & melt ice in blast radius
    this.map.igniteSurfaceInRadius(barrel.x, barrel.y, blastR);

    // 2. Break any cracked secret walls within blast radius
    const minTx = Math.max(0, Math.floor((barrel.x - blastR) / TILE_SIZE));
    const maxTx = Math.min(this.map.cols - 1, Math.floor((barrel.x + blastR) / TILE_SIZE));
    const minTy = Math.max(0, Math.floor((barrel.y - blastR) / TILE_SIZE));
    const maxTy = Math.min(this.map.rows - 1, Math.floor((barrel.y + blastR) / TILE_SIZE));
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (this.map.getTile(tx, ty) === 'cracked_wall') {
          const wallCx = tx * TILE_SIZE + TILE_SIZE / 2;
          const wallCy = ty * TILE_SIZE + TILE_SIZE / 2;
          if (distance(barrel.x, barrel.y, wallCx, wallCy) <= blastR + TILE_SIZE * 0.7) {
            if (this.map.destroyCrackedWall(tx, ty)) {
              this.secretWallBroken = true;
              this.rebuildCurrentRoomDoors();
              this.events.push({
                kind: 'cracked_wall_broken',
                tx,
                ty,
                x: wallCx,
                y: wallCy,
              });
              for (let k = 0; k < 3; k++) {
                const ang = Math.PI * 0.25 + k * (Math.PI * 0.25);
                this.pickups.push(
                  this.acquirePickup({
                    id: ++this.nextEntityId,
                    kind: k === 1 ? 'energy' : 'gold',
                    x: wallCx,
                    y: wallCy + 10,
                    vx: Math.cos(ang) * 75,
                    vy: Math.sin(ang) * 75,
                    amount: k === 1 ? 15 : 10,
                    ttlSec: 15,
                  }),
                );
              }
            }
          }
        }
      }
    }

    // 3. Damage enemies in blast radius (+ apply burn or shatter frozen enemies!)
    const blastEnemyCount = this.enemies.length;
    for (let i = 0; i < blastEnemyCount; i++) {
      const e = this.enemies[i]!;
      if (e.hp <= 0 || e.aiState === 'spawning') continue;
      const d = distance(barrel.x, barrel.y, e.x, e.y);
      if (d <= blastR + e.radius) {
        const pushAngle = Math.atan2(e.y - barrel.y, e.x - barrel.x);
        this.applyDamageToEnemy(e, 24, true, 'burn', pushAngle, 260, true);
      }
    }

    // 4. Damage any alive player if too close
    for (const p of this.getAllPlayers()) {
      const distP = distance(barrel.x, barrel.y, p.x, p.y);
      if (distP <= blastR + p.radius) {
        const pushAngle = Math.atan2(p.y - barrel.y, p.x - barrel.x);
        this.applyDamageToPlayer(2, pushAngle, 220, 'explosive_barrel', p);
      }
    }

    // 5. Chain reaction to nearby barrels & destructible crates/vases
    for (let i = 0; i < this.props.length; i++) {
      const other = this.props[i]!;
      if (other.id === barrel.id || other.hp <= 0 || !other.destructible) continue;
      const d = distance(barrel.x, barrel.y, other.x, other.y);
      if (d <= blastR + other.radius + 16) {
        if (other.explosive) {
          other.fuseTimer = Math.min(other.fuseTimer > 0 ? other.fuseTimer : 0.06, 0.06);
        } else {
          this.damageProp(other, 24, 'burn');
        }
      }
    }
  }

  private releaseVanguardShieldShockwave(p: SimPlayerState = this.player): void {
    const skillDef = CHARACTERS.vanguard.skill;
    const stored = p.shieldStoredBullets;
    p.skillActiveTimer = 0;
    p.skillCooldownTimer = skillDef.cooldownSec;
    p.shieldStoredBullets = 0;

    const hasFortressUpgrade = this.activeBuffIds.includes('vanguard_fortress');
    const hasChargeUpgrade = this.activeBuffIds.includes('vanguard_charge');
    if (hasChargeUpgrade) {
      const stepDist = 11;
      const dirX = Math.cos(p.aimAngle);
      const dirY = Math.sin(p.aimAngle);
      for (let s = 0; s < 10; s++) {
        const nextX = p.x + dirX * stepDist;
        const nextY = p.y + dirY * stepDist;
        const resolved = this.map.resolveCircleCollision(nextX, nextY, p.radius);
        p.x = resolved.x;
        p.y = resolved.y;
      }
      this.events.push({
        kind: 'dash_started',
        playerId: p.id,
        x: p.x,
        y: p.y,
        dirX,
        dirY,
      });
    }

    const baseShockDmg = 12 + stored * 4 + (hasFortressUpgrade ? 8 : 0);
    const shockwaveDamage = baseShockDmg * (hasChargeUpgrade ? 2 : 1);
    const shockElement: ElementType =
      p.activeImbueElement !== 'none'
        ? p.activeImbueElement
        : hasChargeUpgrade
          ? 'burn'
          : 'none';
    const halfArc = hasFortressUpgrade ? Math.PI : (65 * Math.PI) / 180;
    const range = hasChargeUpgrade ? 165 : hasFortressUpgrade ? 150 : 135;

    const shockEnemyCount = this.enemies.length;
    for (let i = 0; i < shockEnemyCount; i++) {
      const e = this.enemies[i]!;
      if (e.hp <= 0 || e.aiState === 'spawning') continue;
      if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, range, e)) {
        const angleToEnemy = Math.atan2(e.y - p.y, e.x - p.x);
        this.applyDamageToEnemy(
          e,
          shockwaveDamage,
          stored >= 2 || hasChargeUpgrade || hasFortressUpgrade,
          shockElement,
          angleToEnemy,
          hasChargeUpgrade ? 340 : 260,
          true,
        );
      }
    }

    this.events.push({
      kind: 'shield_shockwave',
      playerId: p.id,
      x: p.x,
      y: p.y,
      angle: p.aimAngle,
      storedBullets: stored,
      damage: shockwaveDamage,
    });
    this.events.push({
      kind: 'hit_stop',
      durationMs: 40,
      trauma: 0.35,
    });
  }

  private tryFireActiveWeapon(p: SimPlayerState = this.player): void {
    const weaponId =
      p.weaponSlots[p.activeWeaponSlot] ?? p.weaponSlots[0] ?? 'knight_sword';
    const w = WEAPONS[weaponId];
    if (!w) return;

    const cost = p.godMode ? 0 : w.energyCost;
    if (p.energy < cost) {
      return;
    }

    const hasGaleReflex = this.activeBuffIds.includes('gale_reflex');
    const hasEaglePrecision = this.activeBuffIds.includes('eagle_precision');
    const hasRicochetMastery = this.activeBuffIds.includes('ricochet_mastery');

    p.energy = Math.max(0, p.energy - cost);
    const effectiveFireRate = w.fireRate * (hasGaleReflex ? 1.22 : 1);
    p.fireCooldownTimer = 1 / effectiveFireRate;
    p.recoilTimer = 0.12;
    const shotElement: ElementType =
      p.activeImbueElement !== 'none' ? p.activeImbueElement : w.element;

    if (w.category === 'melee') {
      const arcRad = (w.spreadDeg * Math.PI) / 180;
      const halfArc = arcRad / 2;
      let bulletsDestroyed = 0;

      if (w.destroysEnemyBullets) {
        this.rebuildEnemyBulletSpatialGrid();
        const nearbyBullets = this.bulletSpatialGrid.queryCircle(
          p.x,
          p.y,
          MELEE_RANGE + 12,
          this.queryBulletScratch,
        );
        for (let i = 0; i < nearbyBullets.length; i++) {
          const b = nearbyBullets[i]!;
          if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
          if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, MELEE_RANGE + 8, b)) {
            b.ttlSec = 0;
            bulletsDestroyed += 1;
            const shieldActive = p.skillActiveTimer > 0;
            if (shieldActive) {
              p.shieldStoredBullets += 1;
              p.energy = Math.min(p.maxEnergy, p.energy + 1);
            }
            this.events.push({
              kind: 'projectile_impact',
              x: b.x,
              y: b.y,
              angle: p.aimAngle,
              team: 'enemy',
              hitWall: false,
              destroyedByMelee: true,
              blockedByShield: shieldActive,
              isCrit: false,
            });
          }
        }
      }

      // Hit props in melee cone
      const baseMeleeDmg = hasEaglePrecision ? Math.round(w.damage * 1.2) : w.damage;
      for (let i = 0; i < this.props.length; i++) {
        const prop = this.props[i]!;
        if (!prop.destructible || prop.hp <= 0) continue;
        if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, MELEE_RANGE + 6, prop)) {
          this.damageProp(prop, baseMeleeDmg, shotElement);
        }
      }

      // Hit enemies in melee cone
      const baseCrit = CHARACTERS[p.characterId]?.baseCritChance ?? 0.05;
      let hitAny = false;
      let anyCrit = false;
      const meleeEnemyCount = this.enemies.length;
      for (let i = 0; i < meleeEnemyCount; i++) {
        const e = this.enemies[i]!;
        if (e.hp <= 0 || e.aiState === 'spawning') continue;
        if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, MELEE_RANGE, e)) {
          const critChance = clamp(
            baseCrit + w.critChance + (hasEaglePrecision ? 0.18 : 0),
            0,
            1,
          );
          const isCrit = this.rng.chance(critChance);
          const dmg = isCrit ? Math.round(baseMeleeDmg * 1.5) : baseMeleeDmg;
          const hitAngle = Math.atan2(e.y - p.y, e.x - p.x);
          this.applyDamageToEnemy(e, dmg, isCrit, shotElement, hitAngle, w.knockback, true);
          hitAny = true;
          if (isCrit) anyCrit = true;
        }
      }

      this.events.push({
        kind: 'melee_swing',
        playerId: p.id,
        weaponId: w.id,
        x: p.x,
        y: p.y,
        angle: p.aimAngle,
        arcRad,
        range: MELEE_RANGE,
        bulletsDestroyed,
      });

      if (hitAny) {
        this.events.push({
          kind: 'hit_stop',
          durationMs: anyCrit ? 50 : 35,
          trauma: anyCrit ? 0.36 : 0.24,
        });
      }
      return;
    }

    const pellets = Math.max(1, w.pelletCount);
    const spreadRad = (w.spreadDeg * Math.PI) / 180;
    const shieldBoost = p.skillActiveTimer > 0;
    const muzzleDist = 18;
    const spawnX = p.x + Math.cos(p.aimAngle) * muzzleDist;
    const spawnY = p.y + Math.sin(p.aimAngle) * muzzleDist;
    const baseCrit = CHARACTERS[p.characterId]?.baseCritChance ?? 0.05;
    const rawWeaponDmg = hasEaglePrecision ? Math.round(w.damage * 1.2) : w.damage;

    for (let i = 0; i < pellets; i++) {
      let angleOffset = 0;
      if (pellets > 1) {
        const t = i / (pellets - 1) - 0.5;
        angleOffset = t * spreadRad + this.rng.nextFloat(-spreadRad * 0.12, spreadRad * 0.12);
      } else if (spreadRad > 0) {
        angleOffset = this.rng.nextFloat(-spreadRad * 0.5, spreadRad * 0.5);
      }

      const shotAngle = p.aimAngle + angleOffset;
      const critChance = clamp(
        baseCrit + w.critChance + (hasEaglePrecision ? 0.18 : 0),
        0,
        1,
      );
      const isCrit = this.rng.chance(critChance);
      const baseDmg = shieldBoost ? Math.round(rawWeaponDmg * 1.3) : rawWeaponDmg;
      const finalDmg = isCrit ? Math.round(baseDmg * 1.5) : baseDmg;

      const proj = this.acquireProjectile({
        id: ++this.nextEntityId,
        ownerId: p.id,
        team: 'player',
        weaponId: w.id,
        x: spawnX,
        y: spawnY,
        vx: Math.cos(shotAngle) * w.projectileSpeed,
        vy: Math.sin(shotAngle) * w.projectileSpeed,
        angle: shotAngle,
        radius: w.category === 'shotgun' ? 4.5 : 5,
        damage: finalDmg,
        isCrit,
        knockback: w.knockback,
        pierceRemaining:
          w.pierceCount + (shieldBoost ? 1 : 0) + (hasRicochetMastery ? 1 : 0),
        bounceRemaining: w.bounceCount + (hasRicochetMastery ? 1 : 0),
        ttlSec: w.category === 'shotgun' ? 0.55 : 1.4,
        element: shotElement,
        amplifiedByShield: shieldBoost,
      });

      this.projectiles.push(proj);
      this.events.push({
        kind: 'projectile_spawned',
        projectileId: proj.id,
        weaponId: w.id,
        team: 'player',
        x: spawnX,
        y: spawnY,
        angle: shotAngle,
      });
    }
  }

  private findNearestAlivePlayer(x: number, y: number): SimPlayerState {
    if (this.stressTestActive || this.simulatedPlayers.length === 0) {
      return this.player;
    }
    let best = this.player;
    let bestDistSq =
      this.player.lifeState === 'alive' && this.player.hp > 0
        ? distanceSq(x, y, this.player.x, this.player.y)
        : Infinity;
    for (let i = 0; i < this.simulatedPlayers.length; i++) {
      const candidate = this.simulatedPlayers[i]!;
      if (candidate.lifeState !== 'alive' || candidate.hp <= 0) continue;
      const dSq = distanceSq(x, y, candidate.x, candidate.y);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = candidate;
      }
    }
    return best;
  }

  private getCoopEnemyCooldownScale(): number {
    const pCount = this.getActivePlayerCount();
    if (pCount <= 1 || this.stressTestActive) return 1.0;
    const bonus = COOP_SCALING[pCount].enemyFireRateBonus;
    return 1 / (1 + bonus);
  }

  private updateEnemies(dtSec: number): void {
    const coopCdScale = this.getCoopEnemyCooldownScale();

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (e.hp <= 0) continue;

      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dtSec);
      }
      if (e.attackCooldownTimer > 0) {
        e.attackCooldownTimer = Math.max(
          0,
          e.attackCooldownTimer - dtSec / coopCdScale,
        );
      }
      if (e.shockTimer > 0) {
        e.shockTimer = Math.max(0, e.shockTimer - dtSec);
      }
      if (e.grassRustleCooldown > 0) {
        e.grassRustleCooldown = Math.max(0, e.grassRustleCooldown - dtSec);
      }

      // Decay knockback
      const kbDecay = Math.exp(-12 * dtSec);
      e.kbVx *= kbDecay;
      e.kbVy *= kbDecay;
      if (Math.abs(e.kbVx) < 1) e.kbVx = 0;
      if (Math.abs(e.kbVy) < 1) e.kbVy = 0;

      // Update Elemental Status Timers & Surface interactions
      const surf = this.map.getSurfaceAtWorld(e.x, e.y);
      this.updateEnemyStatusAndSurface(e, surf, dtSec);
      if (e.hp <= 0) continue;

      if (e.isDummy) {
        // Poison blocks healing! Dummy only regenerates when not poisoned
        if (e.hp < e.maxHp && e.poisonTimer <= 0) {
          e.hp = e.maxHp;
        }
        continue;
      }

      if (e.aiState === 'spawning') {
        e.stateTimer -= dtSec;
        if (e.stateTimer <= 0) {
          e.aiState = 'move';
          e.stateTimer = 0;
        }
        continue;
      }

      // Frozen enemies cannot move or execute AI
      if (e.frozenTimer > 0) {
        e.vx = 0;
        e.vy = 0;
        e.frozenTimer = Math.max(0, e.frozenTimer - dtSec);
        continue;
      }

      // Elite Regen modifier: regenerates 4 HP/sec if not poisoned
      if (e.isElite && e.eliteModifier === 'regen' && e.hp < e.maxHp && e.poisonTimer <= 0) {
        e.regenAccum += dtSec * 4;
        if (e.regenAccum >= 1) {
          const healPts = Math.floor(e.regenAccum);
          e.regenAccum -= healPts;
          e.hp = Math.min(e.maxHp, e.hp + healPts);
        }
      }

      const targetPlayer = this.findNearestAlivePlayer(e.x, e.y);

      if (e.aiState === 'stunned') {
        e.vx = 0;
        e.vy = 0;
        e.stateTimer -= dtSec;
        if (e.stateTimer <= 0) {
          e.aiState = 'cooldown';
          e.stateTimer = 0.6;
        }
      } else {
        const dx = targetPlayer.x - e.x;
        const dy = targetPlayer.y - e.y;
        const distToPlayer = Math.hypot(dx, dy);
        const angleToPlayer = Math.atan2(dy, dx);

        if (e.defId === 'goblin_shooter') {
          this.updateGoblinShooterAI(e, distToPlayer, angleToPlayer, dtSec);
        } else if (e.defId === 'wild_boar') {
          this.updateWildBoarAI(e, distToPlayer, angleToPlayer, dtSec);
        } else if (e.defId === 'spore_bomber') {
          this.updateSporeBomberAI(e, distToPlayer, angleToPlayer, dtSec);
        } else if (e.defId === 'green_slime' || e.defId === 'mini_slime') {
          this.updateSlimeAI(e, distToPlayer, angleToPlayer, dtSec);
        } else if (e.defId === 'goblin_shaman') {
          this.updateGoblinShamanAI(e, distToPlayer, angleToPlayer, dtSec);
        } else if (e.defId === 'thorn_turret' || e.defId === 'spore_guardian') {
          this.updateThornTurretAI(e, distToPlayer, angleToPlayer, dtSec);
        } else if (e.defId === 'spore_king') {
          this.updateBossSporeKingAI(e, targetPlayer, distToPlayer, angleToPlayer, dtSec);
        }
      }

      // Stationary turrets & guardian mushrooms do not move or get knocked around
      if (e.defId === 'thorn_turret' || e.defId === 'spore_guardian') {
        e.vx = 0;
        e.vy = 0;
        e.kbVx = 0;
        e.kbVy = 0;
      }

      // Apply Chill (-30%) and Oil (-15%) movement speed modifiers
      let speedMult = 1.0;
      if (e.chillTimer > 0) speedMult *= 0.7;
      if ((surf === 'oil' || surf === 'poison_swamp') && !e.isBoss) speedMult *= 0.85;
      e.vx *= speedMult;
      e.vy *= speedMult;

      // Soft separation between nearby enemies
      const nearby = this.enemySpatialGrid.queryCircle(
        e.x,
        e.y,
        e.radius + 18,
        this.queryEnemyScratch,
      );
      let sepX = 0;
      let sepY = 0;
      if (e.defId !== 'thorn_turret' && e.defId !== 'spore_guardian' && !e.bossBurrowed) {
        for (let j = 0; j < nearby.length; j++) {
          const other = nearby[j]!;
          if (other.id === e.id || other.hp <= 0) continue;
          const odx = e.x - other.x;
          const ody = e.y - other.y;
          const d = Math.hypot(odx, ody);
          const minSep = e.radius + other.radius + 4;
          if (d > 0.001 && d < minSep) {
            const push = ((minSep - d) / minSep) * 90;
            sepX += (odx / d) * push;
            sepY += (ody / d) * push;
          }
        }
      }

      const nextX = e.x + (e.vx + e.kbVx + sepX) * dtSec;
      const nextY = e.y + (e.vy + e.kbVy + sepY) * dtSec;
      const col = this.map.resolveCircleCollision(nextX, nextY, e.radius);
      e.x = col.x;
      e.y = col.y;

      if (surf === 'grass' && Math.hypot(e.vx, e.vy) > 25 && e.grassRustleCooldown <= 0) {
        e.grassRustleCooldown = 0.35;
        if (!this.stressTestActive) {
          this.events.push({ kind: 'grass_rustle', x: e.x, y: e.y });
        }
      }

      if (e.defId === 'wild_boar' && e.aiState === 'attack' && col.collided) {
        e.aiState = 'stunned';
        e.stateTimer = 0.5;
        e.vx = 0;
        e.vy = 0;
        e.attackCooldownTimer =
          (ENEMIES.wild_boar?.attackCooldownSec ?? 2.6) * this.getEnemyCooldownScale(false);
        this.events.push({
          kind: 'hit_stop',
          durationMs: 30,
          trauma: 0.25,
        });
      }
    }

    let writeIdx = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (e.hp > 0) {
        this.enemies[writeIdx++] = e;
      }
    }
    this.enemies.length = writeIdx;
  }

  private getEnemyCooldownScale(isBoss: boolean): number {
    const count = this.getActivePlayerCount();
    const scaling = COOP_SCALING[count];
    const rate = isBoss ? 1 + scaling.enemyFireRateBonus * 0.75 : 1 + scaling.enemyFireRateBonus;
    return 1 / Math.max(1, rate);
  }

  private updateEnemyStatusAndSurface(
    e: SimEnemyState,
    surf: SurfaceKind,
    dtSec: number,
  ): void {
    if (surf === 'water') {
      e.burnTimer = 0;
    } else if (surf === 'burning_oil' || surf === 'burning_grass' || surf === 'lava') {
      if (e.burnTimer <= 0) {
        e.burnTickTimer = 0.25;
      }
      e.burnTimer = Math.max(e.burnTimer, 2.5);
    } else if (surf === 'poison_swamp' && !e.isBoss && e.defId !== 'spore_bomber') {
      if (e.poisonTimer <= 0) {
        e.poisonTickTimer = 0.3;
      }
      e.poisonTimer = Math.max(e.poisonTimer, 3.0);
      e.poisonStacks = Math.max(1, e.poisonStacks);
    } else if (surf === 'electrified_water') {
      e.surfaceTickTimer += dtSec;
      if (e.surfaceTickTimer >= 0.5) {
        e.surfaceTickTimer = 0;
        e.shockTimer = 0.45;
        this.applyDotDamageToEnemy(e, 4, 'shock');
        if (e.hp <= 0) return;
      }
    }

    if (e.burnTimer > 0) {
      e.burnTimer = Math.max(0, e.burnTimer - dtSec);
      if (!this.stressTestActive && (surf === 'oil' || surf === 'grass')) {
        this.map.igniteSurfaceInRadius(e.x, e.y, 18);
      }
      e.burnTickTimer -= dtSec;
      if (e.burnTickTimer <= 0) {
        e.burnTickTimer = 0.5;
        this.applyDotDamageToEnemy(e, 3, 'burn');
        if (e.hp <= 0) return;
      }
    }

    if (e.chillTimer > 0) {
      e.chillTimer = Math.max(0, e.chillTimer - dtSec);
      if (e.chillTimer <= 0) {
        e.chillStacks = 0;
      }
    }

    if (e.poisonTimer > 0) {
      e.poisonTimer = Math.max(0, e.poisonTimer - dtSec);
      e.poisonTickTimer -= dtSec;
      if (e.poisonTickTimer <= 0) {
        e.poisonTickTimer = 0.6;
        this.applyDotDamageToEnemy(e, 2 * Math.max(1, e.poisonStacks), 'poison');
        if (e.hp <= 0) return;
      }
      if (e.poisonTimer <= 0) {
        e.poisonStacks = 0;
      }
    }
  }

  private applyDotDamageToEnemy(
    enemy: SimEnemyState,
    amount: number,
    element: ElementType,
  ): void {
    if (enemy.hp <= 0) return;
    if (this.stressTestActive && enemy.hp <= amount + 20) {
      enemy.hp = enemy.maxHp;
      return;
    }
    enemy.hp = Math.max(0, enemy.hp - amount);
    this.recordDamageHistory(amount);
    this.runStats.damageDealt += amount;
    this.checkBossPhaseTransitions(enemy);

    if (!this.stressTestActive) {
      this.events.push({
        kind: 'damage_dealt',
        targetId: enemy.id,
        targetKind: 'enemy',
        x: enemy.x,
        y: enemy.y,
        amount,
        isCrit: false,
        hitArmor: false,
        element,
        knockbackX: 0,
        knockbackY: 0,
      });
    }

    if (enemy.hp <= 0 && !enemy.isDummy) {
      this.handleEnemyKilled(enemy);
    }
  }

  private updateGoblinShooterAI(
    e: SimEnemyState,
    distToPlayer: number,
    angleToPlayer: number,
    dtSec: number,
  ): void {
    const cdMult =
      (e.isElite && e.eliteModifier === 'fast' ? 0.72 : 1.0) * this.getEnemyCooldownScale(false);
    if (e.aiState === 'telegraph') {
      e.vx = 0;
      e.vy = 0;
      e.aimAngle = e.telegraphAngle;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        if (!this.stressTestActive || this.projectiles.length < 660) {
          const spreadRad = (15 * Math.PI) / 180;
          const bulletSpeed = 285;
          const muzzleX = e.x + Math.cos(e.telegraphAngle) * 14;
          const muzzleY = e.y + Math.sin(e.telegraphAngle) * 14;

          for (const mult of [-1, 0, 1]) {
            const shotAngle = e.telegraphAngle + mult * spreadRad;
            const proj = this.acquireProjectile({
              id: ++this.nextEntityId,
              ownerId: e.id,
              team: 'enemy',
              weaponId: 'goblin_bow',
              x: muzzleX,
              y: muzzleY,
              vx: Math.cos(shotAngle) * bulletSpeed,
              vy: Math.sin(shotAngle) * bulletSpeed,
              angle: shotAngle,
              radius: 5.5,
              damage: e.damage,
              isCrit: false,
              knockback: 90,
              pierceRemaining: 0,
              bounceRemaining: 0,
              ttlSec: 2.2,
              element: 'none',
              amplifiedByShield: false,
            });
            this.projectiles.push(proj);
            if (!this.stressTestActive) {
              this.events.push({
                kind: 'projectile_spawned',
                projectileId: proj.id,
                weaponId: 'goblin_bow',
                team: 'enemy',
                x: muzzleX,
                y: muzzleY,
                angle: shotAngle,
              });
            }
          }
        }

        e.aiState = 'cooldown';
        e.stateTimer = 0.35;
        e.attackCooldownTimer = (ENEMIES.goblin_shooter?.attackCooldownSec ?? 1.9) * cdMult;
      }
      return;
    }

    if (e.aiState === 'cooldown') {
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        e.aiState = 'move';
      }
    }

    e.aimAngle = angleToPlayer;

    if (e.attackCooldownTimer <= 0 && distToPlayer <= 350) {
      e.aiState = 'telegraph';
      e.stateTimer = e.telegraphDurationSec;
      e.telegraphAngle = angleToPlayer;
      e.vx = 0;
      e.vy = 0;
      if (!this.stressTestActive) {
        this.events.push({
          kind: 'enemy_telegraph',
          enemyId: e.id,
          defId: e.defId,
          x: e.x,
          y: e.y,
          angle: e.telegraphAngle,
          durationSec: e.telegraphDurationSec,
          radius: 0,
        });
      }
      return;
    }

    let moveDirX = 0;
    let moveDirY = 0;
    if (distToPlayer > 220) {
      moveDirX = Math.cos(angleToPlayer);
      moveDirY = Math.sin(angleToPlayer);
    } else if (distToPlayer < 125) {
      moveDirX = -Math.cos(angleToPlayer);
      moveDirY = -Math.sin(angleToPlayer);
    } else {
      const perpAngle = angleToPlayer + (Math.PI / 2) * e.strafeSign;
      moveDirX = Math.cos(perpAngle) * 0.75;
      moveDirY = Math.sin(perpAngle) * 0.75;
    }

    e.vx = moveDirX * e.moveSpeed;
    e.vy = moveDirY * e.moveSpeed;
  }

  private updateWildBoarAI(
    e: SimEnemyState,
    distToPlayer: number,
    angleToPlayer: number,
    dtSec: number,
  ): void {
    const cdMult =
      (e.isElite && e.eliteModifier === 'fast' ? 0.72 : 1.0) * this.getEnemyCooldownScale(false);
    if (e.aiState === 'telegraph') {
      e.vx = 0;
      e.vy = 0;
      e.aimAngle = e.telegraphAngle;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        e.aiState = 'attack';
        e.stateTimer = BOAR_CHARGE_DURATION_SEC;
        e.vx = Math.cos(e.telegraphAngle) * BOAR_CHARGE_SPEED;
        e.vy = Math.sin(e.telegraphAngle) * BOAR_CHARGE_SPEED;
      }
      return;
    }

    if (e.aiState === 'attack') {
      e.vx = Math.cos(e.telegraphAngle) * BOAR_CHARGE_SPEED;
      e.vy = Math.sin(e.telegraphAngle) * BOAR_CHARGE_SPEED;
      e.stateTimer -= dtSec;

      const allPlayers = this.getAllPlayers();
      for (let i = 0; i < allPlayers.length; i++) {
        const pl = allPlayers[i]!;
        if (pl.lifeState !== 'alive') continue;
        if (circleVsCircle(e, pl)) {
          this.applyDamageToPlayer(e.damage, e.telegraphAngle, 240, e.defId, pl);
          e.aiState = 'cooldown';
          e.stateTimer = 0.5;
          e.attackCooldownTimer = (ENEMIES.wild_boar?.attackCooldownSec ?? 2.6) * cdMult;
          e.vx = 0;
          e.vy = 0;
          return;
        }
      }

      if (e.stateTimer <= 0) {
        e.aiState = 'cooldown';
        e.stateTimer = 0.45;
        e.attackCooldownTimer = (ENEMIES.wild_boar?.attackCooldownSec ?? 2.6) * cdMult;
        e.vx = 0;
        e.vy = 0;
      }
      return;
    }

    if (e.aiState === 'cooldown') {
      e.vx = 0;
      e.vy = 0;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        e.aiState = 'move';
      }
      return;
    }

    e.aimAngle = angleToPlayer;
    if (e.attackCooldownTimer <= 0 && distToPlayer <= 250) {
      e.aiState = 'telegraph';
      e.stateTimer = e.telegraphDurationSec;
      e.telegraphAngle = angleToPlayer;
      e.vx = 0;
      e.vy = 0;
      if (!this.stressTestActive) {
        this.events.push({
          kind: 'enemy_telegraph',
          enemyId: e.id,
          defId: e.defId,
          x: e.x,
          y: e.y,
          angle: e.telegraphAngle,
          durationSec: e.telegraphDurationSec,
          radius: 0,
        });
      }
      return;
    }

    e.vx = Math.cos(angleToPlayer) * e.moveSpeed;
    e.vy = Math.sin(angleToPlayer) * e.moveSpeed;
  }

  private updateSporeBomberAI(
    e: SimEnemyState,
    distToPlayer: number,
    angleToPlayer: number,
    dtSec: number,
  ): void {
    if (e.aiState === 'telegraph') {
      e.vx = 0;
      e.vy = 0;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        this.detonateSporeBomber(e);
      }
      return;
    }

    e.aimAngle = angleToPlayer;
    if (distToPlayer <= 52 && !this.stressTestActive) {
      e.aiState = 'telegraph';
      e.stateTimer = e.telegraphDurationSec;
      e.telegraphAngle = angleToPlayer;
      e.telegraphRadius = SPORE_EXPLOSION_RADIUS;
      e.vx = 0;
      e.vy = 0;
      this.events.push({
        kind: 'enemy_telegraph',
        enemyId: e.id,
        defId: e.defId,
        x: e.x,
        y: e.y,
        angle: e.telegraphAngle,
        durationSec: e.telegraphDurationSec,
        radius: SPORE_EXPLOSION_RADIUS,
      });
      return;
    }

    e.vx = Math.cos(angleToPlayer) * e.moveSpeed;
    e.vy = Math.sin(angleToPlayer) * e.moveSpeed;
  }

  private detonateSporeBomber(e: SimEnemyState): void {
    const blastRadius = SPORE_EXPLOSION_RADIUS;
    e.hp = 0;

    // Leave a toxic poison_swamp puddle at the detonation site!
    const centerTx = Math.floor(e.x / TILE_SIZE);
    const centerTy = Math.floor(e.y / TILE_SIZE);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 1) {
          this.map.setSurface(centerTx + dx, centerTy + dy, 'poison_swamp', 9.0, false);
        }
      }
    }

    const allPlayers = this.getAllPlayers();
    for (let i = 0; i < allPlayers.length; i++) {
      const pl = allPlayers[i]!;
      if (pl.lifeState !== 'alive') continue;
      const distP = distance(e.x, e.y, pl.x, pl.y);
      if (distP <= blastRadius + pl.radius) {
        const pushAngle = Math.atan2(pl.y - e.y, pl.x - e.x);
        this.applyDamageToPlayer(e.damage, pushAngle, 230, e.defId, pl);
      }
    }

    for (let i = 0; i < this.enemies.length; i++) {
      const other = this.enemies[i]!;
      if (other.id === e.id || other.hp <= 0) continue;
      const d = distance(e.x, e.y, other.x, other.y);
      if (d <= blastRadius + other.radius) {
        const pushAngle = Math.atan2(other.y - e.y, other.x - e.x);
        other.kbVx += Math.cos(pushAngle) * 160;
        other.kbVy += Math.sin(pushAngle) * 160;
      }
    }

    this.events.push({
      kind: 'explosion',
      x: e.x,
      y: e.y,
      radius: blastRadius,
      damage: e.damage,
      sourceDefId: e.defId,
    });
    this.events.push({
      kind: 'entity_killed',
      entityId: e.id,
      defId: e.defId,
      x: e.x,
      y: e.y,
    });
    this.events.push({
      kind: 'hit_stop',
      durationMs: 45,
      trauma: 0.42,
    });
  }

  private updateSlimeAI(
    e: SimEnemyState,
    distToPlayer: number,
    angleToPlayer: number,
    dtSec: number,
  ): void {
    const lungeSpeed = e.defId === 'mini_slime' ? 255 : 225;
    const cdScale = this.getEnemyCooldownScale(false);
    if (e.aiState === 'telegraph') {
      e.vx = 0;
      e.vy = 0;
      e.aimAngle = e.telegraphAngle;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        e.aiState = 'attack';
        e.stateTimer = 0.24;
        e.vx = Math.cos(e.telegraphAngle) * lungeSpeed;
        e.vy = Math.sin(e.telegraphAngle) * lungeSpeed;
      }
      return;
    }

    if (e.aiState === 'attack') {
      e.vx = Math.cos(e.telegraphAngle) * lungeSpeed;
      e.vy = Math.sin(e.telegraphAngle) * lungeSpeed;
      e.stateTimer -= dtSec;
      const allPlayers = this.getAllPlayers();
      for (let i = 0; i < allPlayers.length; i++) {
        const pl = allPlayers[i]!;
        if (pl.lifeState !== 'alive') continue;
        if (circleVsCircle(e, pl)) {
          this.applyDamageToPlayer(e.damage, e.telegraphAngle, 160, e.defId, pl);
          e.aiState = 'cooldown';
          e.stateTimer = 0.35;
          e.attackCooldownTimer = (ENEMIES[e.defId]?.attackCooldownSec ?? 1.25) * cdScale;
          e.vx = 0;
          e.vy = 0;
          return;
        }
      }
      if (e.stateTimer <= 0) {
        e.aiState = 'cooldown';
        e.stateTimer = 0.3;
        e.attackCooldownTimer = (ENEMIES[e.defId]?.attackCooldownSec ?? 1.25) * cdScale;
        e.vx = 0;
        e.vy = 0;
      }
      return;
    }

    if (e.aiState === 'cooldown') {
      e.vx = 0;
      e.vy = 0;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        e.aiState = 'move';
      }
      return;
    }

    e.aimAngle = angleToPlayer;
    if (e.attackCooldownTimer <= 0 && distToPlayer <= 65) {
      e.aiState = 'telegraph';
      e.stateTimer = e.telegraphDurationSec;
      e.telegraphAngle = angleToPlayer;
      e.vx = 0;
      e.vy = 0;
      if (!this.stressTestActive) {
        this.events.push({
          kind: 'enemy_telegraph',
          enemyId: e.id,
          defId: e.defId,
          x: e.x,
          y: e.y,
          angle: e.telegraphAngle,
          durationSec: e.telegraphDurationSec,
          radius: 0,
        });
      }
      return;
    }

    e.vx = Math.cos(angleToPlayer) * e.moveSpeed;
    e.vy = Math.sin(angleToPlayer) * e.moveSpeed;
  }

  private updateGoblinShamanAI(
    e: SimEnemyState,
    distToPlayer: number,
    angleToPlayer: number,
    dtSec: number,
  ): void {
    const cdMult =
      (e.isElite && e.eliteModifier === 'fast' ? 0.72 : 1.0) * this.getEnemyCooldownScale(false);
    if (e.aiState === 'telegraph') {
      e.vx = 0;
      e.vy = 0;
      e.aimAngle = e.telegraphAngle;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        // 1. Heal injured allies within SHAMAN_HEAL_RADIUS (220u) if they are NOT poisoned!
        let healedCount = 0;
        for (let i = 0; i < this.enemies.length; i++) {
          const ally = this.enemies[i]!;
          if (ally.id === e.id || ally.isDummy || ally.hp <= 0) continue;
          if (
            ally.hp < ally.maxHp &&
            ally.poisonTimer <= 0 &&
            distance(e.x, e.y, ally.x, ally.y) <= SHAMAN_HEAL_RADIUS
          ) {
            ally.hp = Math.min(ally.maxHp, ally.hp + 10);
            healedCount += 1;
          }
        }
        if (healedCount > 0 && !this.stressTestActive) {
          this.events.push({
            kind: 'shaman_heal',
            shamanId: e.id,
            x: e.x,
            y: e.y,
            radius: SHAMAN_HEAL_RADIUS,
            healedCount,
          });
        }

        // 2. Fire a Poison Bolt toward the player
        const bulletSpeed = 245;
        const muzzleX = e.x + Math.cos(e.telegraphAngle) * 16;
        const muzzleY = e.y + Math.sin(e.telegraphAngle) * 16;
        const proj = this.acquireProjectile({
          id: ++this.nextEntityId,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'shaman_staff',
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(e.telegraphAngle) * bulletSpeed,
          vy: Math.sin(e.telegraphAngle) * bulletSpeed,
          angle: e.telegraphAngle,
          radius: 6,
          damage: e.damage,
          isCrit: false,
          knockback: 80,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 2.3,
          element: 'poison',
          amplifiedByShield: false,
        });
        this.projectiles.push(proj);
        if (!this.stressTestActive) {
          this.events.push({
            kind: 'projectile_spawned',
            projectileId: proj.id,
            weaponId: 'shaman_staff',
            team: 'enemy',
            x: muzzleX,
            y: muzzleY,
            angle: e.telegraphAngle,
          });
        }

        e.aiState = 'cooldown';
        e.stateTimer = 0.45;
        e.attackCooldownTimer = (ENEMIES.goblin_shaman?.attackCooldownSec ?? 2.5) * cdMult;
      }
      return;
    }

    if (e.aiState === 'cooldown') {
      e.vx = 0;
      e.vy = 0;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        e.aiState = 'move';
      }
      return;
    }

    e.aimAngle = angleToPlayer;
    if (e.attackCooldownTimer <= 0 && distToPlayer <= 380) {
      e.aiState = 'telegraph';
      e.stateTimer = e.telegraphDurationSec;
      e.telegraphAngle = angleToPlayer;
      e.telegraphRadius = 38;
      e.vx = 0;
      e.vy = 0;
      if (!this.stressTestActive) {
        this.events.push({
          kind: 'enemy_telegraph',
          enemyId: e.id,
          defId: e.defId,
          x: e.x,
          y: e.y,
          angle: e.telegraphAngle,
          durationSec: e.telegraphDurationSec,
          radius: 38,
        });
      }
      return;
    }

    // Keep supportive distance (160..260u)
    let moveDirX = 0;
    let moveDirY = 0;
    if (distToPlayer > 250) {
      moveDirX = Math.cos(angleToPlayer);
      moveDirY = Math.sin(angleToPlayer);
    } else if (distToPlayer < 155) {
      moveDirX = -Math.cos(angleToPlayer);
      moveDirY = -Math.sin(angleToPlayer);
    } else {
      const perpAngle = angleToPlayer + (Math.PI / 2) * e.strafeSign;
      moveDirX = Math.cos(perpAngle) * 0.7;
      moveDirY = Math.sin(perpAngle) * 0.7;
    }
    e.vx = moveDirX * e.moveSpeed;
    e.vy = moveDirY * e.moveSpeed;
  }

  private updateThornTurretAI(
    e: SimEnemyState,
    _distToPlayer: number,
    angleToPlayer: number,
    dtSec: number,
  ): void {
    const cdMult =
      (e.isElite && e.eliteModifier === 'fast' ? 0.72 : 1.0) * this.getEnemyCooldownScale(false);
    e.vx = 0;
    e.vy = 0;
    e.aimAngle = angleToPlayer;

    if (e.aiState === 'telegraph') {
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        // Fire 6 radial thorns in 360 degrees
        const bulletSpeed = 245;
        for (let k = 0; k < 6; k++) {
          const shotAngle = e.telegraphAngle + k * (Math.PI / 3);
          const mx = e.x + Math.cos(shotAngle) * 14;
          const my = e.y + Math.sin(shotAngle) * 14;
          const proj = this.acquireProjectile({
            id: ++this.nextEntityId,
            ownerId: e.id,
            team: 'enemy',
            weaponId: 'thorn_burst',
            x: mx,
            y: my,
            vx: Math.cos(shotAngle) * bulletSpeed,
            vy: Math.sin(shotAngle) * bulletSpeed,
            angle: shotAngle,
            radius: 5,
            damage: e.damage,
            isCrit: false,
            knockback: 75,
            pierceRemaining: 0,
            bounceRemaining: 0,
            ttlSec: 2.2,
            element: 'none',
            amplifiedByShield: false,
          });
          this.projectiles.push(proj);
          if (!this.stressTestActive) {
            this.events.push({
              kind: 'projectile_spawned',
              projectileId: proj.id,
              weaponId: 'thorn_burst',
              team: 'enemy',
              x: mx,
              y: my,
              angle: shotAngle,
            });
          }
        }
        e.aiState = 'cooldown';
        e.stateTimer = 0.4;
        e.attackCooldownTimer = (ENEMIES[e.defId]?.attackCooldownSec ?? 2.1) * cdMult;
      }
      return;
    }

    if (e.aiState === 'cooldown') {
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        e.aiState = 'move';
      }
      return;
    }

    if (e.attackCooldownTimer <= 0) {
      e.aiState = 'telegraph';
      e.stateTimer = e.telegraphDurationSec;
      e.telegraphAngle = angleToPlayer;
      e.telegraphRadius = 32;
      if (!this.stressTestActive) {
        this.events.push({
          kind: 'enemy_telegraph',
          enemyId: e.id,
          defId: e.defId,
          x: e.x,
          y: e.y,
          angle: e.telegraphAngle,
          durationSec: e.telegraphDurationSec,
          radius: 32,
        });
      }
    }
  }

  private checkBossPhaseTransitions(e: SimEnemyState): void {
    if (!e.isBoss || e.hp <= 0) return;
    const hpRatio = e.hp / e.maxHp;

    if (hpRatio <= 0.66 && e.bossPhase === 1) {
      e.bossPhase = 2;
      e.attackCooldownTimer = 0.15;
      this.events.push({
        kind: 'boss_phase_changed',
        enemyId: e.id,
        phase: 2,
        x: e.x,
        y: e.y,
      });
      this.events.push({
        kind: 'hit_stop',
        durationMs: 60,
        trauma: 0.6,
      });
    }

    if (hpRatio <= 0.33 && e.bossPhase < 3) {
      e.bossPhase = 3;
      e.attackCooldownTimer = 0.15;
      this.map.applyBossPhase3ToxicBorder();
      this.events.push({
        kind: 'boss_phase_changed',
        enemyId: e.id,
        phase: 3,
        x: e.x,
        y: e.y,
      });
      this.events.push({
        kind: 'hit_stop',
        durationMs: 80,
        trauma: 0.78,
      });
    }
  }

  private updateBossSporeKingAI(
    e: SimEnemyState,
    targetPlayer: SimPlayerState,
    distToPlayer: number,
    angleToPlayer: number,
    dtSec: number,
  ): void {
    this.checkBossPhaseTransitions(e);
    e.aimAngle = angleToPlayer;
    const bossCdScale = this.getEnemyCooldownScale(true);

    if (e.aiState === 'telegraph') {
      e.vx = 0;
      e.vy = 0;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        this.executeBossSporeKingAttack(e, angleToPlayer);
      }
      return;
    }

    if (e.aiState === 'cooldown') {
      e.vx = 0;
      e.vy = 0;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        e.aiState = 'move';
      }
      return;
    }

    if (e.attackCooldownTimer <= 0) {
      e.aiState = 'telegraph';
      e.stateTimer = (e.bossPhase === 3 ? 0.52 : e.telegraphDurationSec) * bossCdScale;
      e.telegraphAngle = angleToPlayer;

      // In Phase 2 & 3, every odd attack cycle burrows underground and targets player's position!
      if (e.bossPhase >= 2 && e.bossAttackCycle % 2 === 1) {
        e.bossBurrowed = true;
        const targetX = clamp(
          targetPlayer.x,
          TILE_SIZE * 3.5,
          this.map.width - TILE_SIZE * 3.5,
        );
        const targetY = clamp(
          targetPlayer.y,
          TILE_SIZE * 3.5,
          this.map.height - TILE_SIZE * 3.5,
        );
        e.bossTargetX = targetX;
        e.bossTargetY = targetY;
        e.x = targetX;
        e.y = targetY;
        e.prevX = targetX;
        e.prevY = targetY;
        e.telegraphRadius = BOSS_ERUPT_RADIUS;
      } else {
        e.bossBurrowed = false;
        e.telegraphRadius = 60;
      }

      e.vx = 0;
      e.vy = 0;
      this.events.push({
        kind: 'enemy_telegraph',
        enemyId: e.id,
        defId: e.defId,
        x: e.x,
        y: e.y,
        angle: e.telegraphAngle,
        durationSec: e.stateTimer,
        radius: e.telegraphRadius,
      });
      return;
    }

    const phaseSpeedMult = e.bossPhase === 3 ? 1.35 : e.bossPhase === 2 ? 1.18 : 1.0;
    const coopBossSpeed = 1 + COOP_SCALING[this.getActivePlayerCount()].enemyFireRateBonus * 0.75;
    if (distToPlayer > 95) {
      e.vx = Math.cos(angleToPlayer) * e.moveSpeed * phaseSpeedMult * coopBossSpeed;
      e.vy = Math.sin(angleToPlayer) * e.moveSpeed * phaseSpeedMult * coopBossSpeed;
    } else {
      const perp = angleToPlayer + Math.PI * 0.5 * e.strafeSign;
      e.vx = Math.cos(perp) * e.moveSpeed * 0.7 * coopBossSpeed;
      e.vy = Math.sin(perp) * e.moveSpeed * 0.7 * coopBossSpeed;
    }
  }

  private executeBossSporeKingAttack(e: SimEnemyState, angleToPlayer: number): void {
    const cycle = e.bossAttackCycle;
    e.bossAttackCycle += 1;
    const bossCdScale = this.getEnemyCooldownScale(true);

    if (e.bossBurrowed) {
      // Phase 2/3 Burrow Eruption!
      e.bossBurrowed = false;
      const blastR = BOSS_ERUPT_RADIUS;
      const tx = Math.floor(e.x / TILE_SIZE);
      const ty = Math.floor(e.y / TILE_SIZE);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          this.map.setSurface(tx + dx, ty + dy, 'poison_swamp', 10.0, false);
        }
      }

      const allPlayers = this.getAllPlayers();
      for (let i = 0; i < allPlayers.length; i++) {
        const pl = allPlayers[i]!;
        if (pl.lifeState !== 'alive') continue;
        if (distance(e.x, e.y, pl.x, pl.y) <= blastR + pl.radius) {
          const pushAng = Math.atan2(pl.y - e.y, pl.x - e.x);
          this.applyDamageToPlayer(e.damage + 1, pushAng, 260, e.defId, pl);
        }
      }

      // Erupt with 8 radial thorns
      for (let k = 0; k < 8; k++) {
        const ang = k * (Math.PI / 4) + (cycle % 2) * 0.2;
        const proj = this.acquireProjectile({
          id: ++this.nextEntityId,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'thorn_burst',
          x: e.x + Math.cos(ang) * 24,
          y: e.y + Math.sin(ang) * 24,
          vx: Math.cos(ang) * 255,
          vy: Math.sin(ang) * 255,
          angle: ang,
          radius: 5.5,
          damage: e.damage,
          isCrit: false,
          knockback: 110,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 2.3,
          element: 'poison',
          amplifiedByShield: false,
        });
        this.projectiles.push(proj);
      }

      this.events.push({
        kind: 'explosion',
        x: e.x,
        y: e.y,
        radius: blastR,
        damage: e.damage + 1,
        sourceDefId: e.defId,
      });
      this.events.push({
        kind: 'hit_stop',
        durationMs: 55,
        trauma: 0.55,
      });
    } else {
      // Spore Ring Nova + Summon Minions
      const ringCount = e.bossPhase === 3 ? 16 : e.bossPhase === 2 ? 14 : 12;
      const ringSpeed = e.bossPhase === 3 ? 255 : 225;
      const baseOffset = cycle * 0.26;
      for (let k = 0; k < ringCount; k++) {
        const shotAngle = baseOffset + (k / ringCount) * Math.PI * 2;
        const mx = e.x + Math.cos(shotAngle) * (e.radius + 6);
        const my = e.y + Math.sin(shotAngle) * (e.radius + 6);
        const proj = this.acquireProjectile({
          id: ++this.nextEntityId,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'boss_spore_ring',
          x: mx,
          y: my,
          vx: Math.cos(shotAngle) * ringSpeed,
          vy: Math.sin(shotAngle) * ringSpeed,
          angle: shotAngle,
          radius: 6,
          damage: e.damage,
          isCrit: false,
          knockback: 95,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 2.6,
          element: 'poison',
          amplifiedByShield: false,
        });
        this.projectiles.push(proj);
        this.events.push({
          kind: 'projectile_spawned',
          projectileId: proj.id,
          weaponId: 'boss_spore_ring',
          team: 'enemy',
          x: mx,
          y: my,
          angle: shotAngle,
        });
      }

      // Summon up to 2 spore minions on alternate cycles if active non-boss count < 4
      const activeMinions = this.enemies.filter(
        (m) => !m.isDummy && !m.isBoss && m.defId !== 'spore_guardian' && m.hp > 0,
      ).length;
      if (cycle % 2 === 1 && activeMinions < 3) {
        const minionDef = e.bossPhase >= 2 ? 'spore_bomber' : 'mini_slime';
        this.spawnEnemy(minionDef, e.x - 48, e.y - 36, false);
        this.spawnEnemy('mini_slime', e.x + 48, e.y + 36, false);
      }

      // Phase 3 aimed 3-way toxic burst
      if (e.bossPhase === 3) {
        for (const mult of [-1, 0, 1]) {
          const ang = angleToPlayer + mult * 0.22;
          const proj = this.acquireProjectile({
            id: ++this.nextEntityId,
            ownerId: e.id,
            team: 'enemy',
            weaponId: 'shaman_staff',
            x: e.x + Math.cos(ang) * 24,
            y: e.y + Math.sin(ang) * 24,
            vx: Math.cos(ang) * 290,
            vy: Math.sin(ang) * 290,
            angle: ang,
            radius: 6.5,
            damage: e.damage,
            isCrit: false,
            knockback: 110,
            pierceRemaining: 0,
            bounceRemaining: 0,
            ttlSec: 2.4,
            element: 'poison',
            amplifiedByShield: false,
          });
          this.projectiles.push(proj);
        }
      }
    }

    e.aiState = 'cooldown';
    e.stateTimer = (e.bossPhase === 3 ? 0.35 : 0.45) * bossCdScale;
    const baseCd = ENEMIES.spore_king?.attackCooldownSec ?? 2.2;
    e.attackCooldownTimer =
      (e.bossPhase === 3 ? baseCd * 0.65 : e.bossPhase === 2 ? baseCd * 0.82 : baseCd) * bossCdScale;
  }

  private updateProjectiles(dtSec: number): void {
    const allPlayers = this.getAllPlayers();
    let stressImpactEventsThisTick = 0;

    for (let i = 0; i < this.projectiles.length; i++) {
      const b = this.projectiles[i]!;
      if (b.ttlSec <= 0) continue;

      b.ttlSec -= dtSec;
      if (b.ttlSec <= 0) {
        if (b.element !== 'none') {
          this.applyElementAtWorldPoint(b.x, b.y, b.element, 20);
        }
        continue;
      }

      b.x += b.vx * dtSec;
      b.y += b.vy * dtSec;

      // Elemental projectiles flying over interactive surfaces can ignite/freeze/electrify them!
      if (!this.stressTestActive && b.element !== 'none') {
        const surfUnder = this.map.getSurfaceAtWorld(b.x, b.y);
        if (
          (b.element === 'burn' && (surfUnder === 'oil' || surfUnder === 'grass' || surfUnder === 'ice')) ||
          (b.element === 'chill' && (surfUnder === 'water' || surfUnder === 'burning_oil')) ||
          (b.element === 'shock' && surfUnder === 'water')
        ) {
          this.applyElementAtWorldPoint(b.x, b.y, b.element, 18);
        }
      }

      // 1. Check wall/pillar collision
      const wallHit = this.map.checkProjectileWallHit(b.x, b.y, b.radius);
      if (wallHit.hit) {
        if (
          wallHit.hitTx >= 0 &&
          this.map.getTile(wallHit.hitTx, wallHit.hitTy) === 'cracked_wall' &&
          (b.isCrit || b.element === 'burn')
        ) {
          if (this.map.destroyCrackedWall(wallHit.hitTx, wallHit.hitTy)) {
            this.secretWallBroken = true;
            this.rebuildCurrentRoomDoors();
            this.events.push({
              kind: 'cracked_wall_broken',
              tx: wallHit.hitTx,
              ty: wallHit.hitTy,
              x: wallHit.hitTx * TILE_SIZE + 16,
              y: wallHit.hitTy * TILE_SIZE + 16,
            });
          }
        }

        if (b.bounceRemaining > 0) {
          b.bounceRemaining -= 1;
          b.x = wallHit.resolvedX;
          b.y = wallHit.resolvedY;
          if (wallHit.normalX !== 0) b.vx = -b.vx;
          if (wallHit.normalY !== 0) b.vy = -b.vy;
          b.angle = Math.atan2(b.vy, b.vx);
        } else {
          b.ttlSec = 0;
          if (b.element !== 'none') {
            this.applyElementAtWorldPoint(wallHit.resolvedX, wallHit.resolvedY, b.element, 24);
          }
          if (!this.stressTestActive || stressImpactEventsThisTick < 3) {
            stressImpactEventsThisTick += 1;
            this.events.push({
              kind: 'projectile_impact',
              x: wallHit.resolvedX,
              y: wallHit.resolvedY,
              angle: b.angle,
              team: b.team,
              hitWall: true,
              destroyedByMelee: false,
              blockedByShield: false,
              isCrit: b.isCrit,
              element: b.element,
            });
          }
          continue;
        }
      }

      // 2. Check destructible props collision
      if (!this.stressTestActive && this.props.length > 0) {
        let hitProp = false;
        for (let k = 0; k < this.props.length; k++) {
          const prop = this.props[k]!;
          if (!prop.destructible || prop.hp <= 0) continue;
          if (circleVsCircle(b, prop)) {
            this.damageProp(prop, b.damage, b.element);
            b.ttlSec = 0;
            hitProp = true;
            this.events.push({
              kind: 'projectile_impact',
              x: b.x,
              y: b.y,
              angle: b.angle,
              team: b.team,
              hitWall: false,
              destroyedByMelee: false,
              blockedByShield: false,
              isCrit: b.isCrit,
              element: b.element,
            });
            break;
          }
        }
        if (hitProp) continue;
      }

      // 3. Player projectile vs Enemies (using SpatialHashGrid)
      if (b.team === 'player') {
        const candidates = this.enemySpatialGrid.queryCircle(
          b.x,
          b.y,
          b.radius,
          this.queryEnemyScratch,
        );
        for (let j = 0; j < candidates.length; j++) {
          const enemy = candidates[j]!;
          if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
          if (b.hitEntityIds.includes(enemy.id)) continue;

          if (circleVsCircle(b, enemy)) {
            b.hitEntityIds.push(enemy.id);
            this.applyDamageToEnemy(enemy, b.damage, b.isCrit, b.element, b.angle, b.knockback);

            if (!this.stressTestActive || stressImpactEventsThisTick < 4) {
              stressImpactEventsThisTick += 1;
              this.events.push({
                kind: 'projectile_impact',
                x: b.x,
                y: b.y,
                angle: b.angle,
                team: 'player',
                hitWall: false,
                destroyedByMelee: false,
                blockedByShield: false,
                isCrit: b.isCrit,
                element: b.element,
              });
              if (!this.stressTestActive) {
                this.events.push({
                  kind: 'hit_stop',
                  durationMs: b.isCrit ? 45 : 30,
                  trauma: b.isCrit ? 0.28 : 0.14,
                });
              }
            }

            if (b.pierceRemaining > 0) {
              b.pierceRemaining -= 1;
            } else {
              b.ttlSec = 0;
              break;
            }
          }
        }
      } else {
        // 4. Enemy projectile vs Vanguard Shield or any alive Player
        let blockedByAnyShield = false;
        for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
          const pl = allPlayers[pIdx]!;
          if (pl.lifeState !== 'alive') continue;
          if (pl.characterId === 'vanguard' && pl.skillActiveTimer > 0) {
            const shieldRadius = 38;
            const dToPlayer = distance(b.x, b.y, pl.x, pl.y);
            if (dToPlayer <= shieldRadius + b.radius && dToPlayer >= pl.radius * 0.5) {
              const angleFromPlayer = Math.atan2(b.y - pl.y, b.x - pl.x);
              const halfShieldArc = this.activeBuffIds.includes('vanguard_fortress')
                ? Math.PI
                : (60 * Math.PI) / 180;
              if (Math.abs(angleDiff(angleFromPlayer, pl.aimAngle)) <= halfShieldArc) {
                b.ttlSec = 0;
                pl.shieldStoredBullets += 1;
                pl.energy = Math.min(pl.maxEnergy, pl.energy + 1);
                this.events.push({
                  kind: 'projectile_impact',
                  x: b.x,
                  y: b.y,
                  angle: b.angle,
                  team: 'enemy',
                  hitWall: false,
                  destroyedByMelee: false,
                  blockedByShield: true,
                  isCrit: false,
                });
                blockedByAnyShield = true;
                break;
              }
            }
          }
        }
        if (blockedByAnyShield) continue;

        for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
          const pl = allPlayers[pIdx]!;
          if (pl.lifeState !== 'alive') continue;
          if (circleVsCircle(b, pl)) {
            b.ttlSec = 0;
            this.applyDamageToPlayer(b.damage, b.angle, b.knockback, b.weaponId, pl);
            if (!this.stressTestActive) {
              this.events.push({
                kind: 'projectile_impact',
                x: b.x,
                y: b.y,
                angle: b.angle,
                team: 'enemy',
                hitWall: false,
                destroyedByMelee: false,
                blockedByShield: false,
                isCrit: false,
              });
            }
            break;
          }
        }
      }
    }

    let projWriteIdx = 0;
    for (let i = 0; i < this.projectiles.length; i++) {
      const b = this.projectiles[i]!;
      if (b.ttlSec > 0) {
        this.projectiles[projWriteIdx++] = b;
      } else {
        b.hitEntityIds.length = 0;
        this.projectilePool.push(b);
      }
    }
    this.projectiles.length = projWriteIdx;
  }

  public applyElementAtWorldPoint(
    x: number,
    y: number,
    element: ElementType,
    radius = 24,
  ): void {
    if (this.stressTestActive) return;
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);

    if (element === 'burn') {
      const count = this.map.igniteSurfaceInRadius(x, y, radius);
      if (count > 0 && !this.stressTestActive) {
        this.events.push({ kind: 'surface_triggered', surface: 'burning_oil', x, y });
      }
    } else if (element === 'chill') {
      const count = this.map.freezeSurfaceInRadius(x, y, radius);
      if (count > 0 && !this.stressTestActive) {
        this.events.push({ kind: 'surface_triggered', surface: 'ice', x, y });
      }
    } else if (element === 'shock') {
      const count = this.map.electrifyWaterAt(tx, ty, 4.0);
      if (count > 0 && !this.stressTestActive) {
        this.events.push({ kind: 'surface_triggered', surface: 'electrified_water', x, y });
      }
    }
  }

  public applyDamageToEnemy(
    enemy: SimEnemyState,
    amount: number,
    isCrit: boolean,
    element: ElementType,
    hitAngleRad: number,
    knockback: number,
    isHeavyAttack = false,
  ): void {
    if (enemy.hp <= 0 || enemy.bossBurrowed) return;

    let finalAmount = amount;
    let finalCrit = isCrit;

    // 3-4P Boss Mechanic: while Spore Guardian Mushrooms are alive, Spore King takes 65% less damage
    if (enemy.isBoss && this.hasActiveBossGuardians()) {
      finalAmount = Math.max(1, finalAmount * 0.35);
    }

    // Section 6: Đóng Băng + đòn nặng (cận chiến/nổ/crit) -> Vỡ Băng (Shatter): Sát thương x3!
    if (enemy.frozenTimer > 0 && (isHeavyAttack || isCrit)) {
      finalAmount = finalAmount * 3;
      finalCrit = true;
      enemy.frozenTimer = 0;
      if (!this.stressTestActive) {
        this.events.push({
          kind: 'status_applied',
          targetId: enemy.id,
          status: 'shatter',
          x: enemy.x,
          y: enemy.y,
        });
      }
    }

    const dmg = Math.max(1, Math.round(finalAmount));
    let hitArmor = false;
    if (this.stressTestActive && enemy.hp <= dmg + 20) {
      enemy.hp = enemy.maxHp;
    } else if (enemy.shieldArmor > 0) {
      const absorbed = Math.min(enemy.shieldArmor, dmg);
      enemy.shieldArmor -= absorbed;
      const rem = dmg - absorbed;
      hitArmor = absorbed > 0 && rem === 0;
      enemy.hp = Math.max(0, enemy.hp - rem);
    } else {
      enemy.hp = Math.max(0, enemy.hp - dmg);
    }
    enemy.hitFlashTimer = 0.12;
    this.recordDamageHistory(dmg);
    this.runStats.damageDealt += dmg;
    this.checkBossPhaseTransitions(enemy);

    const kbMult =
      enemy.isDummy ? 0.15 : enemy.defId === 'thorn_turret' || enemy.defId === 'spore_guardian' ? 0 : enemy.isBoss ? 0.2 : 1.0;
    const kbX = Math.cos(hitAngleRad) * knockback * kbMult;
    const kbY = Math.sin(hitAngleRad) * knockback * kbMult;
    enemy.kbVx += kbX;
    enemy.kbVy += kbY;

    // Apply Elemental Status
    if (element !== 'none') {
      this.applyElementStatusToEnemy(enemy, element, dmg);
    }

    if (!this.stressTestActive || this.tick % 4 === 0) {
      this.events.push({
        kind: 'damage_dealt',
        targetId: enemy.id,
        targetKind: 'enemy',
        x: enemy.x,
        y: enemy.y,
        amount: dmg,
        isCrit: finalCrit,
        hitArmor,
        element,
        knockbackX: kbX,
        knockbackY: kbY,
      });
    }

    if (enemy.hp <= 0 && !enemy.isDummy) {
      this.handleEnemyKilled(enemy);
    }
  }

  private handleEnemyKilled(enemy: SimEnemyState): void {
    this.runStats.kills += 1;
    if (enemy.isElite) this.runStats.elitesKilled += 1;
    if (enemy.isBoss) this.runStats.bossesKilled += 1;

    this.events.push({
      kind: 'entity_killed',
      entityId: enemy.id,
      defId: enemy.defId,
      x: enemy.x,
      y: enemy.y,
    });

    // Green Slime splits into 2 Mini Slimes on death!
    if (enemy.defId === 'green_slime' && !this.stressTestActive) {
      const m1 = this.spawnEnemy('mini_slime', enemy.x - 14, enemy.y - 8, true);
      const m2 = this.spawnEnemy('mini_slime', enemy.x + 14, enemy.y + 8, true);
      m1.kbVx = -95;
      m1.kbVy = -45;
      m2.kbVx = 95;
      m2.kbVy = 45;
    }

    // Elite Explosive Death
    if (!this.stressTestActive && enemy.isElite && enemy.eliteModifier === 'explosive_death') {
      const blastR = 64;
      this.map.igniteSurfaceInRadius(enemy.x, enemy.y, blastR);
      this.events.push({
        kind: 'explosion',
        x: enemy.x,
        y: enemy.y,
        radius: blastR,
        damage: 14,
        sourceDefId: enemy.defId,
      });
      const allPlayers = this.getAllPlayers();
      for (let i = 0; i < allPlayers.length; i++) {
        const pl = allPlayers[i]!;
        if (pl.lifeState !== 'alive') continue;
        if (distance(enemy.x, enemy.y, pl.x, pl.y) <= blastR + pl.radius) {
          const ang = Math.atan2(pl.y - enemy.y, pl.x - enemy.x);
          this.applyDamageToPlayer(2, ang, 180, enemy.defId, pl);
        }
      }
    }

    const allPlayers = this.getAllPlayers();
    const isCoop = allPlayers.length > 1;
    const dropMult = enemy.isBoss ? 6 : enemy.isElite ? 3 : 1;
    for (let k = 0; k < 2 * dropMult; k++) {
      const ang = this.rng.nextFloat(-Math.PI, Math.PI);
      const spd = this.rng.nextFloat(60, 130);
      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const pl = allPlayers[pIdx]!;
        const instAng = ang + pIdx * 0.45;
        this.pickups.push(
          this.acquirePickup({
            id: ++this.nextEntityId,
            kind: 'energy',
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(instAng) * spd,
            vy: Math.sin(instAng) * spd,
            amount: 8,
            ttlSec: 14,
            ownerPlayerId: isCoop ? pl.id : undefined,
          }),
        );
      }
    }
    for (let k = 0; k < dropMult; k++) {
      const coinAng = this.rng.nextFloat(-Math.PI, Math.PI);
      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const pl = allPlayers[pIdx]!;
        const instAng = coinAng + pIdx * 0.45;
        this.pickups.push(
          this.acquirePickup({
            id: ++this.nextEntityId,
            kind: 'gold',
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(instAng) * 90,
            vy: Math.sin(instAng) * 90,
            amount: 5,
            ttlSec: 14,
            ownerPlayerId: isCoop ? pl.id : undefined,
          }),
        );
      }
    }
  }

  private applyElementStatusToEnemy(
    enemy: SimEnemyState,
    element: ElementType,
    hitDamage: number,
  ): void {
    this.applyElementAtWorldPoint(enemy.x, enemy.y, element, 26);

    switch (element) {
      case 'burn': {
        if (enemy.burnTimer <= 0) {
          enemy.burnTickTimer = 0.5;
        }
        enemy.burnTimer = 3.0;
        if (!this.stressTestActive) {
          this.events.push({
            kind: 'status_applied',
            targetId: enemy.id,
            status: 'burn',
            x: enemy.x,
            y: enemy.y,
          });
        }
        break;
      }
      case 'chill': {
        if (enemy.frozenTimer <= 0) {
          enemy.chillStacks += 1;
          enemy.chillTimer = 3.5;
          if (enemy.chillStacks >= 3) {
            enemy.chillStacks = 0;
            enemy.chillTimer = 0;
            enemy.frozenTimer = 1.5;
            enemy.vx = 0;
            enemy.vy = 0;
            if (!this.stressTestActive) {
              this.events.push({
                kind: 'status_applied',
                targetId: enemy.id,
                status: 'frozen',
                x: enemy.x,
                y: enemy.y,
              });
            }
          } else if (!this.stressTestActive) {
            this.events.push({
              kind: 'status_applied',
              targetId: enemy.id,
              status: 'chill',
              x: enemy.x,
              y: enemy.y,
            });
          }
        }
        break;
      }
      case 'shock': {
        enemy.shockTimer = 0.6;
        if (!this.stressTestActive) {
          this.events.push({
            kind: 'status_applied',
            targetId: enemy.id,
            status: 'shock',
            x: enemy.x,
            y: enemy.y,
          });
        }
        // Chain lightning to up to 2 nearby enemies within 115 units
        const maxChains = 2;
        const chainDmg = Math.max(2, Math.round(hitDamage * 0.5));
        let chained = 0;
        for (let i = 0; i < this.enemies.length && chained < maxChains; i++) {
          const other = this.enemies[i]!;
          if (other.id === enemy.id || other.hp <= 0 || other.aiState === 'spawning') continue;
          const d = distance(enemy.x, enemy.y, other.x, other.y);
          if (d <= 115) {
            chained += 1;
            other.shockTimer = 0.5;
            this.applyDotDamageToEnemy(other, chainDmg, 'shock');
            if (!this.stressTestActive) {
              this.events.push({
                kind: 'chain_lightning',
                fromX: enemy.x,
                fromY: enemy.y,
                toX: other.x,
                toY: other.y,
              });
            }
          }
        }
        break;
      }
      case 'poison': {
        if (enemy.poisonTimer <= 0) {
          enemy.poisonTickTimer = 0.6;
        }
        enemy.poisonStacks = Math.min(3, enemy.poisonStacks + 1);
        enemy.poisonTimer = 4.0;
        if (!this.stressTestActive) {
          this.events.push({
            kind: 'status_applied',
            targetId: enemy.id,
            status: 'poison',
            x: enemy.x,
            y: enemy.y,
          });
        }
        break;
      }
    }
  }

  public applyDamageToPlayer(
    rawDamage: number,
    hitAngleRad: number,
    knockback: number,
    _sourceId = 'enemy',
    targetPlayer: SimPlayerState = this.player,
  ): boolean {
    const p = targetPlayer;
    if (p.godMode || p.invulnerableTimer > 0 || p.hp <= 0 || p.lifeState !== 'alive') {
      return false;
    }

    const dmg = Math.max(1, Math.round(rawDamage));
    const armorAbsorbed = Math.min(p.armor, dmg);
    const hpDamage = dmg - armorAbsorbed;

    p.armor -= armorAbsorbed;
    p.hp = Math.max(0, p.hp - hpDamage);

    p.armorRegenTimer = p.armorRegenDelaySec;
    p.armorRegenAccum = 0;
    p.hurtFlashTimer = 0.16;
    p.invulnerableTimer = 0.35;

    const kbX = Math.cos(hitAngleRad) * knockback * 0.7;
    const kbY = Math.sin(hitAngleRad) * knockback * 0.7;
    p.kbVx += kbX;
    p.kbVy += kbY;

    this.events.push({
      kind: 'damage_dealt',
      targetId: p.id,
      targetKind: 'player',
      x: p.x,
      y: p.y,
      amount: dmg,
      isCrit: false,
      hitArmor: armorAbsorbed > 0 && hpDamage === 0,
      element: 'none',
      knockbackX: kbX,
      knockbackY: kbY,
    });
    this.events.push({
      kind: 'hit_stop',
      durationMs: 40,
      trauma: hpDamage > 0 ? 0.45 : 0.28,
    });

    if (p.hp <= 0) {
      if (this.autoRevivePlayer) {
        p.hp = p.maxHp;
        p.armor = p.maxArmor;
        p.invulnerableTimer = 1.2;
        p.lifeState = 'alive';
      } else if (this.getAllPlayers().length > 1) {
        p.lifeState = 'downed';
        p.downedTimer = 20.0;
        p.reviveProgress = 0;
        p.reviverPlayerId = null;
        this.events.push({
          kind: 'player_downed',
          playerId: p.id,
          x: p.x,
          y: p.y,
        });

        // Check if any teammate is still alive; if all players are downed/ghost, team wipe!
        const allPlayers = this.getAllPlayers();
        const anyAlive = allPlayers.some((pl) => pl.lifeState === 'alive' && pl.hp > 0);
        if (!anyAlive) {
          this.runState = 'defeat';
        }
      } else {
        this.runState = 'defeat';
      }
    }

    return true;
  }

  private updatePickups(dtSec: number): void {
    const allPlayers = this.getAllPlayers();
    for (let i = 0; i < this.pickups.length; i++) {
      const pk = this.pickups[i]!;
      pk.ttlSec -= dtSec;
      if (pk.ttlSec <= 0) continue;

      let closestPlayer: SimPlayerState | null = null;
      let closestDist = Infinity;
      for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
        const pl = allPlayers[pIdx]!;
        if (pl.lifeState !== 'alive') continue;
        if (pk.ownerPlayerId !== undefined && pk.ownerPlayerId !== pl.id) continue;
        const d = distance(pl.x, pl.y, pk.x, pk.y);
        if (d < closestDist) {
          closestDist = d;
          closestPlayer = pl;
        }
      }

      if (closestPlayer && closestDist < 130 && closestDist > 0.01) {
        const dx = closestPlayer.x - pk.x;
        const dy = closestPlayer.y - pk.y;
        const pullSpeed = lerpSpeed(closestDist, 130, 340);
        pk.vx = approach(pk.vx, (dx / closestDist) * pullSpeed, 1400 * dtSec);
        pk.vy = approach(pk.vy, (dy / closestDist) * pullSpeed, 1400 * dtSec);
      } else {
        const damping = Math.exp(-8 * dtSec);
        pk.vx *= damping;
        pk.vy *= damping;
      }

      pk.x += pk.vx * dtSec;
      pk.y += pk.vy * dtSec;

      if (closestPlayer && closestDist <= closestPlayer.radius + 10) {
        pk.ttlSec = 0;
        if (pk.kind === 'energy') {
          closestPlayer.energy = Math.min(closestPlayer.maxEnergy, closestPlayer.energy + pk.amount);
        } else {
          closestPlayer.gold += pk.amount;
          this.runStats.goldEarned += pk.amount;
        }
        this.events.push({
          kind: 'pickup_collected',
          pickupKind: pk.kind,
          amount: pk.amount,
          x: pk.x,
          y: pk.y,
        });
      }
    }

    let pickupWriteIdx = 0;
    for (let i = 0; i < this.pickups.length; i++) {
      const pk = this.pickups[i]!;
      if (pk.ttlSec > 0) {
        this.pickups[pickupWriteIdx++] = pk;
      } else {
        this.pickupPool.push(pk);
      }
    }
    this.pickups.length = pickupWriteIdx;
  }

  private acquireProjectile(
    init: Omit<SimProjectileState, 'prevX' | 'prevY' | 'hitEntityIds'>,
  ): SimProjectileState {
    const pooled = this.projectilePool.pop();
    if (pooled) {
      pooled.id = init.id;
      pooled.ownerId = init.ownerId;
      pooled.team = init.team;
      pooled.weaponId = init.weaponId;
      pooled.prevX = init.x;
      pooled.prevY = init.y;
      pooled.x = init.x;
      pooled.y = init.y;
      pooled.vx = init.vx;
      pooled.vy = init.vy;
      pooled.angle = init.angle;
      pooled.radius = init.radius;
      pooled.damage = init.damage;
      pooled.isCrit = init.isCrit;
      pooled.knockback = init.knockback;
      pooled.pierceRemaining = init.pierceRemaining;
      pooled.bounceRemaining = init.bounceRemaining;
      pooled.ttlSec = init.ttlSec;
      pooled.element = init.element;
      pooled.amplifiedByShield = init.amplifiedByShield;
      pooled.hitEntityIds.length = 0;
      return pooled;
    }
    return {
      ...init,
      prevX: init.x,
      prevY: init.y,
      hitEntityIds: [],
    };
  }

  private acquirePickup(init: Omit<SimPickupState, 'prevX' | 'prevY'>): SimPickupState {
    const pooled = this.pickupPool.pop();
    if (pooled) {
      pooled.id = init.id;
      pooled.kind = init.kind;
      pooled.prevX = init.x;
      pooled.prevY = init.y;
      pooled.x = init.x;
      pooled.y = init.y;
      pooled.vx = init.vx;
      pooled.vy = init.vy;
      pooled.amount = init.amount;
      pooled.ttlSec = init.ttlSec;
      pooled.ownerPlayerId = init.ownerPlayerId;
      return pooled;
    }
    return {
      ...init,
      prevX: init.x,
      prevY: init.y,
    };
  }

  public consumeEvents(): SimEvent[] {
    const current = this.events;
    if (current.length === 0) return this.emptyEvents;
    if (this.activeEventsBuffer === 'A') {
      this.activeEventsBuffer = 'B';
      this.eventsBufferB.length = 0;
    } else {
      this.activeEventsBuffer = 'A';
      this.eventsBufferA.length = 0;
    }
    return current;
  }
}

function lerpSpeed(dist: number, maxRange: number, maxSpeed: number): number {
  const t = 1 - clamp(dist / maxRange, 0, 1);
  return 110 + t * (maxSpeed - 110);
}
