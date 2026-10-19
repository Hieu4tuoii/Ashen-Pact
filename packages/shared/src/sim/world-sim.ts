import { SeededRandom } from '../core/prng.js';
import { CHARACTERS } from '../data/characters.js';
import { ENEMIES } from '../data/enemies.js';
import type { CharacterId, ElementType } from '../data/types.js';
import { WEAPONS } from '../data/weapons.js';
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
import { INPUT_BUTTON, type PlayerInputPacket, TILE_SIZE } from '../protocol/messages.js';
import { ArenaMap, type ArenaMapConfig, type SurfaceKind } from './arena-map.js';

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

export const ELEMENT_CYCLE_ORDER: readonly ElementType[] = [
  'none',
  'burn',
  'chill',
  'shock',
  'poison',
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

export interface SimPlayerState {
  id: number;
  slot: 1 | 2 | 3 | 4;
  characterId: CharacterId;
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
    };

export interface WorldSimOptions {
  seed?: string | number;
  mapConfig?: ArenaMapConfig;
  spawnInitialWave?: boolean;
  includeTrainingDummy?: boolean;
  includeProps?: boolean;
  autoRespawnWaves?: boolean;
  autoRevivePlayer?: boolean;
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
  public player: SimPlayerState;
  public simulatedPlayers: SimPlayerState[] = [];
  public enemies: SimEnemyState[] = [];
  public projectiles: SimProjectileState[] = [];
  public pickups: SimPickupState[] = [];
  public props: SimPropState[] = [];

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
  private energyRegenAccum = 0;
  private readonly queryEnemyScratch: SimEnemyState[] = [];
  private readonly queryBulletScratch: SimProjectileState[] = [];
  private readonly projectilePool: SimProjectileState[] = [];
  private readonly pickupPool: SimPickupState[] = [];
  private readonly damageHistory: { tick: number; amount: number }[] = [];
  private readonly damageHistoryPool: { tick: number; amount: number }[] = [];

  constructor(options: WorldSimOptions = {}) {
    const seedVal = options.seed ?? 0x1337c0de;
    this.rng = new SeededRandom(seedVal);
    const spawnWave = options.spawnInitialWave ?? true;
    this.map = new ArenaMap({
      seed: seedVal,
      includeSurfaces: spawnWave,
      ...options.mapConfig,
    });
    this.autoRespawnWaves = options.autoRespawnWaves ?? true;
    this.autoRevivePlayer = options.autoRevivePlayer ?? true;

    const startX = this.map.width * 0.35;
    const startY = this.map.height * 0.5;
    this.player = this.createPlayerState(1, 1, 'vanguard', startX, startY);

    if (options.includeTrainingDummy ?? true) {
      this.spawnTrainingDummy(210, 260);
    }

    if (options.includeProps ?? spawnWave) {
      this.spawnDefaultArenaProps();
    }

    if (spawnWave) {
      this.spawnSampleWave();
    }
  }

  private get events(): SimEvent[] {
    return this.activeEventsBuffer === 'A' ? this.eventsBufferA : this.eventsBufferB;
  }

  private createPlayerState(
    id: number,
    slot: 1 | 2 | 3 | 4,
    characterId: CharacterId,
    x: number,
    y: number,
  ): SimPlayerState {
    const cDef = CHARACTERS[characterId] ?? CHARACTERS.vanguard;
    return {
      id,
      slot,
      characterId,
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
      weaponSlots: [...PHASE1_SAMPLE_WEAPONS],
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
    };
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
    };
    this.enemies.push(dummy);
    return dummy;
  }

  public spawnEnemy(
    defId: Phase1EnemyId,
    x?: number,
    y?: number,
    skipSpawnWarmup = false,
  ): SimEnemyState {
    const def = ENEMIES[defId];
    if (!def) {
      throw new Error(`Unknown enemy defId: ${defId}`);
    }

    let spawnX = x ?? this.map.width * 0.7;
    let spawnY = y ?? this.map.height * 0.5;

    if (x === undefined || y === undefined) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const cx = this.rng.nextFloat(TILE_SIZE * 3, this.map.width - TILE_SIZE * 3);
        const cy = this.rng.nextFloat(TILE_SIZE * 3, this.map.height - TILE_SIZE * 3);
        const dSq = distanceSq(cx, cy, this.player.x, this.player.y);
        const hit = this.map.checkProjectileWallHit(cx, cy, def.radius + 6);
        if (dSq >= 150 * 150 && !hit.hit) {
          spawnX = cx;
          spawnY = cy;
          break;
        }
      }
    }

    const resolved = this.map.resolveCircleCollision(spawnX, spawnY, def.radius);
    const enemy: SimEnemyState = {
      id: ++this.nextEntityId,
      defId: def.id,
      nameVi: def.nameVi,
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
      radius: def.radius,
      aimAngle: Math.atan2(this.player.y - resolved.y, this.player.x - resolved.x),
      hp: def.hp,
      maxHp: def.hp,
      moveSpeed: def.moveSpeed,
      damage: def.damage,
      aiState: skipSpawnWarmup ? 'move' : 'spawning',
      stateTimer: skipSpawnWarmup ? 0 : ENEMY_SPAWN_WARMUP_SEC,
      attackCooldownTimer: this.rng.nextFloat(0.4, 1.1),
      telegraphDurationSec: def.telegraphSec,
      telegraphAngle: 0,
      telegraphRadius: defId === 'spore_bomber' ? SPORE_EXPLOSION_RADIUS : 0,
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
    };

    this.enemies.push(enemy);
    return enemy;
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

  /**
   * Executes a single 60Hz deterministic simulation tick (dtSec = 1/60).
   */
  public step(dtSec: number): void {
    this.tick += 1;

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

    // 4. Update Player & Simulated Co-op Players
    this.updatePlayer(dtSec);
    if (this.simulatedPlayers.length > 0) {
      this.updateSimulatedPlayers(dtSec);
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

    // 10. Stress Test top-up or normal wave completion
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
    } else if (this.autoRespawnWaves) {
      let hasCombatEnemies = false;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i]!;
        if (!e.isDummy && e.hp > 0) {
          hasCombatEnemies = true;
          break;
        }
      }
      if (!hasCombatEnemies) {
        this.waveRespawnTimer += dtSec;
        if (this.waveRespawnTimer >= 1.5) {
          this.waveRespawnTimer = 0;
          this.spawnSampleWave();
        }
      } else {
        this.waveRespawnTimer = 0;
      }
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
      if (e.hp > 0 && e.aiState !== 'spawning') {
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
    const p = this.player;
    const inp = this.currentInput;
    const justPressed = (inp.buttons & ~this.prevButtons) | this.latchedButtons;
    const selectedSlot = this.latchedWeaponSlot ?? inp.weaponSlotSelect;

    p.aimAngle = inp.aimAngle;

    if (
      typeof selectedSlot === 'number' &&
      selectedSlot >= 0 &&
      selectedSlot < p.weaponSlots.length
    ) {
      this.equipWeaponSlot(selectedSlot);
    } else if (justPressed & INPUT_BUTTON.SWAP) {
      this.cycleWeapon(1);
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
      this.energyRegenAccum += dtSec * 3.5;
      if (this.energyRegenAccum >= 1) {
        const gain = Math.floor(this.energyRegenAccum);
        this.energyRegenAccum -= gain;
        p.energy = Math.min(p.maxEnergy, p.energy + gain);
      }
    }

    if (p.armorRegenTimer > 0) {
      p.armorRegenTimer = Math.max(0, p.armorRegenTimer - dtSec);
      p.armorRegenAccum = 0;
    } else if (p.armor < p.maxArmor && p.hp > 0) {
      p.armorRegenAccum += dtSec * p.armorRegenPerSec;
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
      p.dashTimer = DASH_DURATION_SEC;
      p.invulnerableTimer = Math.max(p.invulnerableTimer, DASH_IFRAME_SEC);
      p.dashCooldownTimer = DASH_COOLDOWN_SEC;
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
      if (p.skillActiveTimer > 0) {
        this.releaseVanguardShieldShockwave();
      } else if (p.skillCooldownTimer <= 0) {
        const skillDef = CHARACTERS.vanguard.skill;
        p.skillActiveTimer = skillDef.durationSec;
        p.shieldStoredBullets = 0;
        this.events.push({
          kind: 'skill_cast',
          playerId: p.id,
          skillId: skillDef.id,
          x: p.x,
          y: p.y,
          angle: p.aimAngle,
        });
      }
    }

    if (p.skillActiveTimer > 0) {
      p.skillActiveTimer -= dtSec;
      if (p.skillActiveTimer <= 0) {
        this.releaseVanguardShieldShockwave();
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
      this.tryFireActiveWeapon();
    }
  }

  private updateSimulatedPlayers(dtSec: number): void {
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
        this.applyDamageToPlayer(1, 0, 20, 'electrified_water');
      }
    }

    if (p.burnTimer > 0) {
      p.burnTimer = Math.max(0, p.burnTimer - dtSec);
      p.burnTickTimer += dtSec;
      if (p.burnTickTimer >= 0.8) {
        p.burnTickTimer = 0;
        this.applyDamageToPlayer(1, 0, 10, 'burn');
      }
    }
    if (p.poisonTimer > 0) {
      p.poisonTimer = Math.max(0, p.poisonTimer - dtSec);
      p.poisonTickTimer += dtSec;
      if (p.poisonTickTimer >= 1.0) {
        p.poisonTickTimer = 0;
        this.applyDamageToPlayer(1, 0, 10, 'poison');
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
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (e.hp <= 0 || e.aiState === 'spawning') continue;
      const d = distance(barrel.x, barrel.y, e.x, e.y);
      if (d <= blastR + e.radius) {
        const pushAngle = Math.atan2(e.y - barrel.y, e.x - barrel.x);
        this.applyDamageToEnemy(e, 24, true, 'burn', pushAngle, 260, true);
      }
    }

    // 4. Damage player if too close
    const distP = distance(barrel.x, barrel.y, this.player.x, this.player.y);
    if (distP <= blastR + this.player.radius) {
      const pushAngle = Math.atan2(this.player.y - barrel.y, this.player.x - barrel.x);
      this.applyDamageToPlayer(2, pushAngle, 220, 'explosive_barrel');
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

  private releaseVanguardShieldShockwave(): void {
    const p = this.player;
    const skillDef = CHARACTERS.vanguard.skill;
    const stored = p.shieldStoredBullets;
    p.skillActiveTimer = 0;
    p.skillCooldownTimer = skillDef.cooldownSec;
    p.shieldStoredBullets = 0;

    const shockwaveDamage = 12 + stored * 4;
    const halfArc = (65 * Math.PI) / 180;
    const range = 135;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (e.hp <= 0 || e.aiState === 'spawning') continue;
      if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, range, e)) {
        const angleToEnemy = Math.atan2(e.y - p.y, e.x - p.x);
        this.applyDamageToEnemy(
          e,
          shockwaveDamage,
          stored >= 2,
          p.activeImbueElement,
          angleToEnemy,
          260,
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

  private tryFireActiveWeapon(): void {
    const p = this.player;
    const weaponId = this.getActiveWeaponId();
    const w = WEAPONS[weaponId];
    if (!w) return;

    const cost = p.godMode ? 0 : w.energyCost;
    if (p.energy < cost) {
      return;
    }

    p.energy = Math.max(0, p.energy - cost);
    p.fireCooldownTimer = 1 / w.fireRate;
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
      for (let i = 0; i < this.props.length; i++) {
        const prop = this.props[i]!;
        if (!prop.destructible || prop.hp <= 0) continue;
        if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, MELEE_RANGE + 6, prop)) {
          this.damageProp(prop, w.damage, shotElement);
        }
      }

      // Hit enemies in melee cone
      const baseCrit = CHARACTERS[p.characterId]?.baseCritChance ?? 0.05;
      let hitAny = false;
      let anyCrit = false;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i]!;
        if (e.hp <= 0 || e.aiState === 'spawning') continue;
        if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, MELEE_RANGE, e)) {
          const critChance = clamp(baseCrit + w.critChance, 0, 1);
          const isCrit = this.rng.chance(critChance);
          const dmg = isCrit ? Math.round(w.damage * 1.5) : w.damage;
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

    for (let i = 0; i < pellets; i++) {
      let angleOffset = 0;
      if (pellets > 1) {
        const t = i / (pellets - 1) - 0.5;
        angleOffset = t * spreadRad + this.rng.nextFloat(-spreadRad * 0.12, spreadRad * 0.12);
      } else if (spreadRad > 0) {
        angleOffset = this.rng.nextFloat(-spreadRad * 0.5, spreadRad * 0.5);
      }

      const shotAngle = p.aimAngle + angleOffset;
      const critChance = clamp(baseCrit + w.critChance, 0, 1);
      const isCrit = this.rng.chance(critChance);
      const baseDmg = shieldBoost ? Math.round(w.damage * 1.3) : w.damage;
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
        pierceRemaining: w.pierceCount + (shieldBoost ? 1 : 0),
        bounceRemaining: w.bounceCount,
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

  private updateEnemies(dtSec: number): void {
    const p = this.player;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (e.hp <= 0) continue;

      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dtSec);
      }
      if (e.attackCooldownTimer > 0) {
        e.attackCooldownTimer = Math.max(0, e.attackCooldownTimer - dtSec);
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

      if (e.aiState === 'stunned') {
        e.vx = 0;
        e.vy = 0;
        e.stateTimer -= dtSec;
        if (e.stateTimer <= 0) {
          e.aiState = 'cooldown';
          e.stateTimer = 0.6;
        }
      } else {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const distToPlayer = Math.hypot(dx, dy);
        const angleToPlayer = Math.atan2(dy, dx);

        if (e.defId === 'goblin_shooter') {
          this.updateGoblinShooterAI(e, distToPlayer, angleToPlayer, dtSec);
        } else if (e.defId === 'wild_boar') {
          this.updateWildBoarAI(e, distToPlayer, angleToPlayer, dtSec);
        } else if (e.defId === 'spore_bomber') {
          this.updateSporeBomberAI(e, distToPlayer, angleToPlayer, dtSec);
        }
      }

      // Apply Chill (-30%) and Oil (-15%) movement speed modifiers
      let speedMult = 1.0;
      if (e.chillTimer > 0) speedMult *= 0.7;
      if (surf === 'oil' || surf === 'poison_swamp') speedMult *= 0.85;
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
        e.attackCooldownTimer = ENEMIES.wild_boar?.attackCooldownSec ?? 2.6;
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
    } else if (surf === 'poison_swamp') {
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
      this.events.push({
        kind: 'entity_killed',
        entityId: enemy.id,
        defId: enemy.defId,
        x: enemy.x,
        y: enemy.y,
      });
    }
  }

  private updateGoblinShooterAI(
    e: SimEnemyState,
    distToPlayer: number,
    angleToPlayer: number,
    dtSec: number,
  ): void {
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
        e.attackCooldownTimer = ENEMIES.goblin_shooter?.attackCooldownSec ?? 1.9;
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

      if (circleVsCircle(e, this.player)) {
        this.applyDamageToPlayer(e.damage, e.telegraphAngle, 240, e.defId);
        e.aiState = 'cooldown';
        e.stateTimer = 0.5;
        e.attackCooldownTimer = ENEMIES.wild_boar?.attackCooldownSec ?? 2.6;
        e.vx = 0;
        e.vy = 0;
        return;
      }

      if (e.stateTimer <= 0) {
        e.aiState = 'cooldown';
        e.stateTimer = 0.45;
        e.attackCooldownTimer = ENEMIES.wild_boar?.attackCooldownSec ?? 2.6;
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

    const distP = distance(e.x, e.y, this.player.x, this.player.y);
    if (distP <= blastRadius + this.player.radius) {
      const pushAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      this.applyDamageToPlayer(e.damage, pushAngle, 230, e.defId);
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

  private updateProjectiles(dtSec: number): void {
    const p = this.player;
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
          if (enemy.hp <= 0 || enemy.aiState === 'spawning') continue;
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
        // 4. Enemy projectile vs Vanguard Shield or Player
        if (p.skillActiveTimer > 0) {
          const shieldRadius = 38;
          const dToPlayer = distance(b.x, b.y, p.x, p.y);
          if (dToPlayer <= shieldRadius + b.radius && dToPlayer >= p.radius * 0.5) {
            const angleFromPlayer = Math.atan2(b.y - p.y, b.x - p.x);
            const halfShieldArc = (60 * Math.PI) / 180;
            if (Math.abs(angleDiff(angleFromPlayer, p.aimAngle)) <= halfShieldArc) {
              b.ttlSec = 0;
              p.shieldStoredBullets += 1;
              p.energy = Math.min(p.maxEnergy, p.energy + 1);
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
              continue;
            }
          }
        }

        if (circleVsCircle(b, p)) {
          b.ttlSec = 0;
          this.applyDamageToPlayer(b.damage, b.angle, b.knockback, b.weaponId);
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
    if (enemy.hp <= 0) return;

    let finalAmount = amount;
    let finalCrit = isCrit;

    // Section 6: Đóng Băng + đòn nặng (cận chiến/nổ/crit) -> Vỡ Băng (Shatter): Sát thương x3!
    if (enemy.frozenTimer > 0 && (isHeavyAttack || isCrit)) {
      finalAmount = amount * 3;
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
    if (this.stressTestActive && enemy.hp <= dmg + 20) {
      enemy.hp = enemy.maxHp;
    } else {
      enemy.hp = Math.max(0, enemy.hp - dmg);
    }
    enemy.hitFlashTimer = 0.12;
    this.recordDamageHistory(dmg);

    const kbMult = enemy.isDummy ? 0.15 : 1.0;
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
        hitArmor: false,
        element,
        knockbackX: kbX,
        knockbackY: kbY,
      });
    }

    if (enemy.hp <= 0 && !enemy.isDummy) {
      this.events.push({
        kind: 'entity_killed',
        entityId: enemy.id,
        defId: enemy.defId,
        x: enemy.x,
        y: enemy.y,
      });

      for (let k = 0; k < 2; k++) {
        const ang = this.rng.nextFloat(-Math.PI, Math.PI);
        const spd = this.rng.nextFloat(60, 130);
        this.pickups.push(
          this.acquirePickup({
            id: ++this.nextEntityId,
            kind: 'energy',
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            amount: 8,
            ttlSec: 12,
          }),
        );
      }
      const coinAng = this.rng.nextFloat(-Math.PI, Math.PI);
      this.pickups.push(
        this.acquirePickup({
          id: ++this.nextEntityId,
          kind: 'gold',
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(coinAng) * 90,
          vy: Math.sin(coinAng) * 90,
          amount: 5,
          ttlSec: 12,
        }),
      );
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
        const chainDmg = Math.max(2, Math.round(hitDamage * 0.5));
        let chained = 0;
        for (let i = 0; i < this.enemies.length && chained < 2; i++) {
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
  ): boolean {
    const p = this.player;
    if (p.godMode || p.invulnerableTimer > 0 || p.hp <= 0) {
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

    if (p.hp <= 0 && this.autoRevivePlayer) {
      p.hp = p.maxHp;
      p.armor = p.maxArmor;
      p.invulnerableTimer = 1.2;
    }

    return true;
  }

  private updatePickups(dtSec: number): void {
    const p = this.player;
    for (let i = 0; i < this.pickups.length; i++) {
      const pk = this.pickups[i]!;
      pk.ttlSec -= dtSec;
      if (pk.ttlSec <= 0) continue;

      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 130 && dist > 0.01) {
        const pullSpeed = lerpSpeed(dist, 130, 340);
        pk.vx = approach(pk.vx, (dx / dist) * pullSpeed, 1400 * dtSec);
        pk.vy = approach(pk.vy, (dy / dist) * pullSpeed, 1400 * dtSec);
      } else {
        const damping = Math.exp(-8 * dtSec);
        pk.vx *= damping;
        pk.vy *= damping;
      }

      pk.x += pk.vx * dtSec;
      pk.y += pk.vy * dtSec;

      if (dist <= p.radius + 10) {
        pk.ttlSec = 0;
        if (pk.kind === 'energy') {
          p.energy = Math.min(p.maxEnergy, p.energy + pk.amount);
        } else {
          p.gold += pk.amount;
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
