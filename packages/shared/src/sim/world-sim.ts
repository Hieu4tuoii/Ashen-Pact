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
import { ArenaMap, type ArenaMapConfig } from './arena-map.js';

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

export const PLAYER_RADIUS = 13;
export const DASH_DURATION_SEC = 0.22;
export const DASH_IFRAME_SEC = 0.2;
export const DASH_COOLDOWN_SEC = 1.2;
export const DASH_SPEED_MULTIPLIER = 2.6;
export const ENEMY_SPAWN_WARMUP_SEC = 0.8;
export const SPORE_EXPLOSION_RADIUS = 68;
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

export interface SimPlayerState {
  id: number;
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
    };

export interface WorldSimOptions {
  seed?: string | number;
  mapConfig?: ArenaMapConfig;
  spawnInitialWave?: boolean;
  includeTrainingDummy?: boolean;
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
  public player: SimPlayerState;
  public enemies: SimEnemyState[] = [];
  public projectiles: SimProjectileState[] = [];
  public pickups: SimPickupState[] = [];

  private nextEntityId = 100;
  private events: SimEvent[] = [];
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
  private readonly damageHistory: { tick: number; amount: number }[] = [];

  constructor(options: WorldSimOptions = {}) {
    this.rng = new SeededRandom(options.seed ?? 0x1337c0de);
    this.map = new ArenaMap(options.mapConfig);
    this.autoRespawnWaves = options.autoRespawnWaves ?? true;
    this.autoRevivePlayer = options.autoRevivePlayer ?? true;

    const vanguard = CHARACTERS.vanguard;
    const startX = this.map.width * 0.35;
    const startY = this.map.height * 0.5;

    this.player = {
      id: 1,
      characterId: 'vanguard',
      prevX: startX,
      prevY: startY,
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      kbVx: 0,
      kbVy: 0,
      radius: PLAYER_RADIUS,
      aimAngle: 0,
      hp: vanguard.hp,
      maxHp: vanguard.hp,
      armor: vanguard.armor,
      maxArmor: vanguard.armor,
      energy: vanguard.energy,
      maxEnergy: vanguard.energy,
      gold: 0,
      moveSpeed: vanguard.moveSpeed,
      armorRegenDelaySec: vanguard.armorRegenDelaySec,
      armorRegenPerSec: vanguard.armorRegenPerSec,
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
    };

    if (options.includeTrainingDummy ?? true) {
      this.spawnTrainingDummy(210, 260);
    }

    if (options.spawnInitialWave ?? true) {
      this.spawnSampleWave();
    }
  }

  public setPlayerInput(input: PlayerInputPacket): void {
    const newEdges = input.buttons & ~this.currentInput.buttons;
    this.latchedButtons |= newEdges;
    if (typeof input.weaponSlotSelect === 'number') {
      this.latchedWeaponSlot = input.weaponSlotSelect;
    }
    this.currentInput = { ...input };
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
      // Pick a safe position at least 150 world units away from the player and not inside pillars
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
    };

    this.enemies.push(enemy);
    return enemy;
  }

  public spawnSampleWave(): void {
    this.waveNumber += 1;
    // Clear existing non-dummy enemies
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

    // 2. Rebuild spatial hash grids before player weapon/melee checks
    this.rebuildSpatialGrids();

    // 3. Update Player movement, dash, skill, weapons, and armor regen
    this.updatePlayer(dtSec);

    // 4. Update Enemies & AI
    this.updateEnemies(dtSec);

    // 5. Rebuild spatial grids after enemy movement
    this.rebuildSpatialGrids();

    // 6. Update Projectiles & Collisions
    this.updateProjectiles(dtSec);

    // 7. Update Pickups (Magnet & Collection)
    this.updatePickups(dtSec);

    // 8. Check wave completion in solo test arena
    if (this.autoRespawnWaves) {
      const combatEnemies = this.enemies.filter((e) => !e.isDummy && e.hp > 0);
      if (combatEnemies.length === 0) {
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
    while (this.damageHistory.length > 0 && this.damageHistory[0]!.tick < minTick) {
      this.damageHistory.shift();
    }

    this.prevButtons = this.currentInput.buttons;
    this.latchedButtons = 0;
    this.latchedWeaponSlot = null;
  }

  public getRollingDps(): number {
    let sum = 0;
    for (let i = 0; i < this.damageHistory.length; i++) {
      sum += this.damageHistory[i]!.amount;
    }
    return Math.round((sum / 3) * 10) / 10;
  }

  private rebuildSpatialGrids(): void {
    this.enemySpatialGrid.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      if (e.hp > 0 && e.aiState !== 'spawning') {
        this.enemySpatialGrid.insert(e);
      }
    }

    this.bulletSpatialGrid.clear();
    for (let i = 0; i < this.projectiles.length; i++) {
      const b = this.projectiles[i]!;
      if (b.ttlSec > 0) {
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

    // Weapon slot selection via direct slot or SWAP button
    if (
      typeof selectedSlot === 'number' &&
      selectedSlot >= 0 &&
      selectedSlot < p.weaponSlots.length
    ) {
      this.equipWeaponSlot(selectedSlot);
    } else if (justPressed & INPUT_BUTTON.SWAP) {
      this.cycleWeapon(1);
    }

    // Cooldown & flash timers
    if (p.dashCooldownTimer > 0) p.dashCooldownTimer = Math.max(0, p.dashCooldownTimer - dtSec);
    if (p.invulnerableTimer > 0) p.invulnerableTimer = Math.max(0, p.invulnerableTimer - dtSec);
    if (p.hurtFlashTimer > 0) p.hurtFlashTimer = Math.max(0, p.hurtFlashTimer - dtSec);
    if (p.fireCooldownTimer > 0) p.fireCooldownTimer = Math.max(0, p.fireCooldownTimer - dtSec);
    if (p.recoilTimer > 0) p.recoilTimer = Math.max(0, p.recoilTimer - dtSec);
    if (p.skillCooldownTimer > 0) p.skillCooldownTimer = Math.max(0, p.skillCooldownTimer - dtSec);

    // Passive energy trickle in test arena so player never gets permanently stuck at 0 energy
    if (p.energy < p.maxEnergy) {
      this.energyRegenAccum += dtSec * 3.5;
      if (this.energyRegenAccum >= 1) {
        const gain = Math.floor(this.energyRegenAccum);
        this.energyRegenAccum -= gain;
        p.energy = Math.min(p.maxEnergy, p.energy + gain);
      }
    }

    // Armor regeneration (Thiết Vệ passive "Ý Chí Thép": 2.0s delay, 1.0 armor/sec)
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

    // Normalize input movement vector
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

    // Dash trigger (Shift)
    if ((justPressed & INPUT_BUTTON.DASH) && p.dashCooldownTimer <= 0 && p.dashTimer <= 0) {
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

    // Active Skill: Thiết Vệ "Tường Khiên Hồng Ngọc" (Right Click / Space)
    if (justPressed & INPUT_BUTTON.SKILL) {
      if (p.skillActiveTimer > 0) {
        // Recast releases shockwave early!
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

    // Acceleration / Deceleration or Dash movement
    if (p.dashTimer > 0) {
      p.dashTimer = Math.max(0, p.dashTimer - dtSec);
      const dashSpeed = p.moveSpeed * DASH_SPEED_MULTIPLIER;
      p.vx = p.dashDirX * dashSpeed;
      p.vy = p.dashDirY * dashSpeed;
    } else {
      const targetVx = dirX * p.moveSpeed;
      const targetVy = dirY * p.moveSpeed;
      // Snappy acceleration (~0.055s to max speed) and crisp stop (~0.045s)
      const accelRate = dirX !== 0 || dirY !== 0 ? p.moveSpeed / 0.055 : p.moveSpeed / 0.045;
      const maxDeltaV = accelRate * dtSec;
      p.vx = approach(p.vx, targetVx, maxDeltaV);
      p.vy = approach(p.vy, targetVy, maxDeltaV);
    }

    // Decay knockback impulse
    const kbDecay = Math.exp(-14 * dtSec);
    p.kbVx *= kbDecay;
    p.kbVy *= kbDecay;
    if (Math.abs(p.kbVx) < 1) p.kbVx = 0;
    if (Math.abs(p.kbVy) < 1) p.kbVy = 0;

    // Integrate position and resolve wall/pillar tile-AABB collisions
    const nextX = p.x + (p.vx + p.kbVx) * dtSec;
    const nextY = p.y + (p.vy + p.kbVy) * dtSec;
    const col = this.map.resolveCircleCollision(nextX, nextY, p.radius);
    p.x = col.x;
    p.y = col.y;

    // Weapon firing (Hold Left Mouse)
    if ((inp.buttons & INPUT_BUTTON.FIRE) && p.fireCooldownTimer <= 0 && p.hp > 0) {
      this.tryFireActiveWeapon();
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
        this.applyDamageToEnemy(e, shockwaveDamage, stored >= 2, 'none', angleToEnemy, 260);
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

    if (w.category === 'melee') {
      // Melee arc attack (e.g. Kiếm Hiệp Sĩ)
      const arcRad = (w.spreadDeg * Math.PI) / 180;
      const halfArc = arcRad / 2;
      let bulletsDestroyed = 0;

      // Destroy enemy bullets within melee slash cone if weapon supports it
      if (w.destroysEnemyBullets) {
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
            this.events.push({
              kind: 'projectile_impact',
              x: b.x,
              y: b.y,
              angle: p.aimAngle,
              team: 'enemy',
              hitWall: false,
              destroyedByMelee: true,
              blockedByShield: false,
              isCrit: false,
            });
          }
        }
      }

      // Hit enemies in melee cone
      let hitAny = false;
      let anyCrit = false;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i]!;
        if (e.hp <= 0 || e.aiState === 'spawning') continue;
        if (isCircleInCone(p.x, p.y, p.aimAngle, halfArc, MELEE_RANGE, e)) {
          const critChance = clamp(p.characterId === 'vanguard' ? 0.05 + w.critChance : w.critChance, 0, 1);
          const isCrit = this.rng.chance(critChance);
          const dmg = isCrit ? Math.round(w.damage * 1.5) : w.damage;
          const hitAngle = Math.atan2(e.y - p.y, e.x - p.x);
          this.applyDamageToEnemy(e, dmg, isCrit, w.element, hitAngle, w.knockback);
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

    // Ranged projectile weapon (pistol, shotgun, smg, etc.)
    const pellets = Math.max(1, w.pelletCount);
    const spreadRad = (w.spreadDeg * Math.PI) / 180;
    const shieldBoost = p.skillActiveTimer > 0;
    const muzzleDist = 18;
    const spawnX = p.x + Math.cos(p.aimAngle) * muzzleDist;
    const spawnY = p.y + Math.sin(p.aimAngle) * muzzleDist;

    for (let i = 0; i < pellets; i++) {
      let angleOffset = 0;
      if (pellets > 1) {
        const t = i / (pellets - 1) - 0.5;
        angleOffset = t * spreadRad + this.rng.nextFloat(-spreadRad * 0.12, spreadRad * 0.12);
      } else if (spreadRad > 0) {
        angleOffset = this.rng.nextFloat(-spreadRad * 0.5, spreadRad * 0.5);
      }

      const shotAngle = p.aimAngle + angleOffset;
      const critChance = clamp(0.05 + w.critChance, 0, 1);
      const isCrit = this.rng.chance(critChance);
      const baseDmg = shieldBoost ? Math.round(w.damage * 1.3) : w.damage;
      const finalDmg = isCrit ? Math.round(baseDmg * 1.5) : baseDmg;

      const proj: SimProjectileState = {
        id: ++this.nextEntityId,
        ownerId: p.id,
        team: 'player',
        weaponId: w.id,
        prevX: spawnX,
        prevY: spawnY,
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
        element: w.element,
        amplifiedByShield: shieldBoost,
        hitEntityIds: [],
      };

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

      // Decay knockback
      const kbDecay = Math.exp(-12 * dtSec);
      e.kbVx *= kbDecay;
      e.kbVy *= kbDecay;
      if (Math.abs(e.kbVx) < 1) e.kbVx = 0;
      if (Math.abs(e.kbVy) < 1) e.kbVy = 0;

      if (e.isDummy) {
        // Dummy stays in place, regenerates to 9999 so it never dies
        if (e.hp < e.maxHp) e.hp = e.maxHp;
        continue;
      }

      // 1. Spawning warmup state (0.8s magic circle on floor)
      if (e.aiState === 'spawning') {
        e.stateTimer -= dtSec;
        if (e.stateTimer <= 0) {
          e.aiState = 'move';
          e.stateTimer = 0;
        }
        continue;
      }

      // 2. Stunned state (e.g. Wild Boar after hitting a pillar)
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

      // Soft separation between nearby enemies so they don't stack on top of each other
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

      // If Wild Boar is charging and slams into a wall/pillar, stun it!
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

    // Remove dead enemies
    this.enemies = this.enemies.filter((e) => e.hp > 0);
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
        // Fire 3-way spread (-15 deg, 0 deg, +15 deg)
        const spreadRad = (15 * Math.PI) / 180;
        const bulletSpeed = 285;
        const muzzleX = e.x + Math.cos(e.telegraphAngle) * 14;
        const muzzleY = e.y + Math.sin(e.telegraphAngle) * 14;

        for (const mult of [-1, 0, 1]) {
          const shotAngle = e.telegraphAngle + mult * spreadRad;
          const proj: SimProjectileState = {
            id: ++this.nextEntityId,
            ownerId: e.id,
            team: 'enemy',
            weaponId: 'goblin_bow',
            prevX: muzzleX,
            prevY: muzzleY,
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
            hitEntityIds: [],
          };
          this.projectiles.push(proj);
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

    // Trigger telegraph if in range and cooldown ready
    if (e.attackCooldownTimer <= 0 && distToPlayer <= 350) {
      e.aiState = 'telegraph';
      e.stateTimer = e.telegraphDurationSec;
      e.telegraphAngle = angleToPlayer;
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
        radius: 0,
      });
      return;
    }

    // Maintain preferred distance [130..220] and strafe
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

      // Check contact with player during charge
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
    if (distToPlayer <= 52) {
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

    // Damage player if within blast radius
    const distP = distance(e.x, e.y, this.player.x, this.player.y);
    if (distP <= blastRadius + this.player.radius) {
      const pushAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      this.applyDamageToPlayer(e.damage, pushAngle, 230, e.defId);
    }

    // Also knockback nearby enemies
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

    for (let i = 0; i < this.projectiles.length; i++) {
      const b = this.projectiles[i]!;
      if (b.ttlSec <= 0) continue;

      b.ttlSec -= dtSec;
      if (b.ttlSec <= 0) continue;

      b.x += b.vx * dtSec;
      b.y += b.vy * dtSec;

      // 1. Check wall/pillar collision
      const wallHit = this.map.checkProjectileWallHit(b.x, b.y, b.radius);
      if (wallHit.hit) {
        if (b.bounceRemaining > 0) {
          b.bounceRemaining -= 1;
          b.x = wallHit.resolvedX;
          b.y = wallHit.resolvedY;
          if (wallHit.normalX !== 0) b.vx = -b.vx;
          if (wallHit.normalY !== 0) b.vy = -b.vy;
          b.angle = Math.atan2(b.vy, b.vx);
        } else {
          b.ttlSec = 0;
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
          });
          continue;
        }
      }

      // 2. Player projectile vs Enemies (using SpatialHashGrid)
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
            });
            this.events.push({
              kind: 'hit_stop',
              durationMs: b.isCrit ? 45 : 30,
              trauma: b.isCrit ? 0.28 : 0.14,
            });

            if (b.pierceRemaining > 0) {
              b.pierceRemaining -= 1;
            } else {
              b.ttlSec = 0;
              break;
            }
          }
        }
      } else {
        // 3. Enemy projectile vs Vanguard Shield or Player
        if (p.skillActiveTimer > 0) {
          const shieldRadius = 38;
          const dToPlayer = distance(b.x, b.y, p.x, p.y);
          if (dToPlayer <= shieldRadius + b.radius && dToPlayer >= p.radius * 0.5) {
            const angleFromPlayer = Math.atan2(b.y - p.y, b.x - p.x);
            const halfShieldArc = (60 * Math.PI) / 180; // 120 deg total arc
            if (Math.abs(angleDiff(angleFromPlayer, p.aimAngle)) <= halfShieldArc) {
              b.ttlSec = 0;
              p.shieldStoredBullets += 1;
              // Thiết Vệ Passive "Ý Chí Thép": blocking a bullet with skill restores +1 Energy
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

    this.projectiles = this.projectiles.filter((b) => b.ttlSec > 0);
  }

  public applyDamageToEnemy(
    enemy: SimEnemyState,
    amount: number,
    isCrit: boolean,
    element: ElementType,
    hitAngleRad: number,
    knockback: number,
  ): void {
    if (enemy.hp <= 0) return;

    const dmg = Math.max(1, Math.round(amount));
    enemy.hp = Math.max(0, enemy.hp - dmg);
    enemy.hitFlashTimer = 0.12;
    this.damageHistory.push({ tick: this.tick, amount: dmg });

    const kbMult = enemy.isDummy ? 0.15 : 1.0;
    const kbX = Math.cos(hitAngleRad) * knockback * kbMult;
    const kbY = Math.sin(hitAngleRad) * knockback * kbMult;
    enemy.kbVx += kbX;
    enemy.kbVy += kbY;

    this.events.push({
      kind: 'damage_dealt',
      targetId: enemy.id,
      targetKind: 'enemy',
      x: enemy.x,
      y: enemy.y,
      amount: dmg,
      isCrit,
      hitArmor: false,
      element,
      knockbackX: kbX,
      knockbackY: kbY,
    });

    if (enemy.hp <= 0 && !enemy.isDummy) {
      this.events.push({
        kind: 'entity_killed',
        entityId: enemy.id,
        defId: enemy.defId,
        x: enemy.x,
        y: enemy.y,
      });

      // Spawn energy & gold pickups that scatter and magnetize to player
      for (let k = 0; k < 2; k++) {
        const ang = this.rng.nextFloat(-Math.PI, Math.PI);
        const spd = this.rng.nextFloat(60, 130);
        this.pickups.push({
          id: ++this.nextEntityId,
          kind: 'energy',
          prevX: enemy.x,
          prevY: enemy.y,
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          amount: 8,
          ttlSec: 12,
        });
      }
      const coinAng = this.rng.nextFloat(-Math.PI, Math.PI);
      this.pickups.push({
        id: ++this.nextEntityId,
        kind: 'gold',
        prevX: enemy.x,
        prevY: enemy.y,
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(coinAng) * 90,
        vy: Math.sin(coinAng) * 90,
        amount: 5,
        ttlSec: 12,
      });
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

    // Reset armor regen delay timer on taking any hit
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
      // In solo test arena, restore HP/Armor so player can keep testing seamlessly
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

      // Magnet pull when within 130 units
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

    this.pickups = this.pickups.filter((pk) => pk.ttlSec > 0);
  }

  public consumeEvents(): SimEvent[] {
    if (this.events.length === 0) return [];
    const out = this.events;
    this.events = [];
    return out;
  }
}

function lerpSpeed(dist: number, maxRange: number, maxSpeed: number): number {
  const t = 1 - clamp(dist / maxRange, 0, 1);
  return 110 + t * (maxSpeed - 110);
}
