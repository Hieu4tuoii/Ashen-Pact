import { ELITE_MODIFIER_LABELS_VI, ENEMIES } from '../data/enemies.js';
import type { EliteModifier, ElementType, WeaponRarity } from '../data/types.js';
import { ALL_WEAPON_IDS, PHASE3_WEAPON_IDS, WEAPONS } from '../data/weapons.js';
import { distance, distanceSq } from '../math/vec2.js';
import { COOP_SCALING } from '../data/scaling.js';
import { type PlayerInputPacket, TILE_SIZE } from '../protocol/messages.js';
import type { DungeonRoomNode } from './dungeon-gen.js';
import { PHASE1_SAMPLE_ENEMIES, ELEMENT_CYCLE_ORDER, ENEMY_SPAWN_WARMUP_SEC, SPORE_EXPLOSION_RADIUS, BARREL_EXPLOSION_RADIUS, BOSS_ERUPT_RADIUS, type PropKind, type SimPropState, type SimChestState, type SimWorldItemState, type SimEnemyState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export function spawnDefaultArenaPropsImpl(this: WorldSim): void {
  this.props.length = 0;

  // 2 Entrance Pillar Torch Braziers flanking West entrance (preserving NW brazier for brazier_pool metric)
  this.spawnProp('torch_brazier', 8 * TILE_SIZE - 14, 5 * TILE_SIZE - 12);
  this.spawnProp('torch_brazier', 8 * TILE_SIZE - 14, 17 * TILE_SIZE + 12);

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

  // Ancient Mechanism that Engineer can repair & activate with [E]
  this.spawnProp('ancient_mechanism', 15 * TILE_SIZE + 16, 11 * TILE_SIZE + 16);
}

export function spawnPropImpl(this: WorldSim, kind: PropKind, x: number, y: number): SimPropState {
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
    case 'ancient_mechanism':
      radius = 15;
      hp = 9999;
      destructible = false;
      blocksMovement = false;
      lightRadius = 110;
      lightColorHex = '#38BDF8';
      break;
    case 'crystal_pillar':
      radius = 18;
      hp = 9999;
      destructible = false;
      blocksMovement = true;
      lightRadius = 150;
      lightColorHex = '#67E8F9';
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
    repaired: false,
  };
  this.props.push(prop);
  return prop;
}

export function cycleImbueElementImpl(this: WorldSim): ElementType {
  const idx = ELEMENT_CYCLE_ORDER.indexOf(this.player.activeImbueElement);
  const next = ELEMENT_CYCLE_ORDER[(idx + 1) % ELEMENT_CYCLE_ORDER.length] ?? 'none';
  this.player.activeImbueElement = next;
  return next;
}

export function setImbueElementImpl(this: WorldSim, element: ElementType): void {
  this.player.activeImbueElement = element;
}

export function configureStressTestImpl(this: WorldSim, active: boolean): void {
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
  this.player.weaponSlots = ['knight_sword', 'gale_smg'];
  this.player.activeWeaponSlot = 1; // Gale SMG

  // Spawn 3 simulated co-op teammates (total 4 players: P1..P4)
  this.simulatedPlayers = [
    this.createPlayerState(2, 2, 'ranger', this.map.width * 0.45, this.map.height * 0.35),
    this.createPlayerState(3, 3, 'elementalist', this.map.width * 0.45, this.map.height * 0.65),
    this.createPlayerState(4, 4, 'engineer', this.map.width * 0.6, this.map.height * 0.5),
  ];
  this.simulatedPlayers[0]!.weaponSlots = ['hunter_crossbow', 'rusty_pistol'];
  this.simulatedPlayers[0]!.activeWeaponSlot = 1; // Rusty Pistol
  this.simulatedPlayers[0]!.activeImbueElement = 'chill';
  this.simulatedPlayers[1]!.weaponSlots = ['apprentice_staff', 'scrap_shotgun'];
  this.simulatedPlayers[1]!.activeWeaponSlot = 1; // Scrap Shotgun
  this.simulatedPlayers[1]!.activeImbueElement = 'burn';
  this.simulatedPlayers[2]!.weaponSlots = ['rivet_gun', 'gale_smg'];
  this.simulatedPlayers[2]!.activeWeaponSlot = 1; // Gale SMG
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

export function topUpStressTestProjectilesImpl(this: WorldSim, targetCount: number): void {
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

export function setPlayerInputImpl(this: WorldSim, input: PlayerInputPacket): void {
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

export function getActiveWeaponIdImpl(this: WorldSim): string {
  return (
    this.player.weaponSlots[this.player.activeWeaponSlot] ??
    this.player.weaponSlots[0] ??
    'knight_sword'
  );
}

export function equipWeaponSlotImpl(this: WorldSim, slotIndex: number): void {
  if (slotIndex >= 0 && slotIndex < this.player.weaponSlots.length) {
    if (this.player.activeWeaponSlot !== slotIndex) {
      this.player.activeWeaponSlot = slotIndex;
      this.player.fireCooldownTimer = Math.min(this.player.fireCooldownTimer, 0.08);
      this.events.push({
        kind: 'weapon_swapped',
        playerId: this.player.id,
        weaponId: this.getActiveWeaponId(),
        slot: slotIndex,
      });
    }
  }
}

export function cycleWeaponImpl(this: WorldSim, direction = 1): void {
  const len = this.player.weaponSlots.length;
  if (len <= 1) return;
  const nextSlot = (this.player.activeWeaponSlot + direction + len) % len;
  this.equipWeaponSlot(nextSlot);
}

export function spawnTrainingDummyImpl(this: WorldSim, x: number, y: number): SimEnemyState {
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
    markedTimer: 0,
    markedByPlayerId: 0,
    superconductTimer: 0,
    rootedTimer: 0,
    steamBlindTimer: 0,
    lastElementOwnerId: 0,
    lastElementApplied: 'none',
  };
  this.enemies.push(dummy);
  return dummy;
}

export function spawnEnemyImpl(this: WorldSim,
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
  const shieldArmor =
    isElite && eliteModifier === 'shield' ? Math.round(def.hp * 0.85 * hpMult) : 0;
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
    markedTimer: 0,
    markedByPlayerId: 0,
    superconductTimer: 0,
    rootedTimer: 0,
    steamBlindTimer: 0,
    lastElementOwnerId: 0,
    lastElementApplied: 'none',
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

export function spawnBossGuardianMushroomsImpl(this: WorldSim): void {
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

export function hasActiveBossGuardiansImpl(this: WorldSim): boolean {
  for (let i = 0; i < this.enemies.length; i++) {
    const e = this.enemies[i]!;
    if (e.defId === 'spore_guardian' && e.hp > 0) {
      return true;
    }
  }
  return false;
}

export function spawnSampleWaveImpl(this: WorldSim): void {
  this.waveNumber += 1;
  this.enemies = this.enemies.filter((e) => e.isDummy);

  const cx = this.map.width * 0.72;
  const cy = this.map.height * 0.5;
  if (this.currentBiome === 2) {
    this.spawnEnemy('frost_bat', cx + 40, cy - 110, false);
    this.spawnEnemy('baby_yeti', cx + 80, cy + 20, false);
    this.spawnEnemy('ice_mage', cx - 30, cy + 120, false);
  } else if (this.currentBiome === 3) {
    this.spawnEnemy('fire_imp', cx + 40, cy - 110, false);
    this.spawnEnemy('dwarf_cannon', cx + 80, cy + 20, false);
    this.spawnEnemy('coal_golem', cx - 30, cy + 120, false);
  } else {
    this.spawnEnemy('goblin_shooter', cx + 40, cy - 110, false);
    this.spawnEnemy('wild_boar', cx + 80, cy + 20, false);
    this.spawnEnemy('spore_bomber', cx - 30, cy + 120, false);
  }
}

export function getCurrentRoomImpl(this: WorldSim): DungeonRoomNode {
  return this.dungeon.rooms[this.currentRoomId] ?? this.dungeon.rooms[0]!;
}

export function hasActiveCombatEnemiesImpl(this: WorldSim): boolean {
  for (let i = 0; i < this.enemies.length; i++) {
    const e = this.enemies[i]!;
    if (!e.isDummy && e.hp > 0) {
      return true;
    }
  }
  return false;
}

export function getActiveBossImpl(this: WorldSim): SimEnemyState | null {
  for (let i = 0; i < this.enemies.length; i++) {
    const e = this.enemies[i]!;
    if (e.isBoss && e.hp > 0) {
      return e;
    }
  }
  return null;
}

export function rollChestRarityImpl(this: WorldSim, bonusTier = 0): WeaponRarity {
  const r = this.rng.next() + bonusTier * 0.18 + (this.currentFloor - 1) * 0.12;
  if (r >= 0.92) return 'legendary';
  if (r >= 0.72) return 'epic';
  if (r >= 0.45) return 'rare';
  if (r >= 0.2) return 'uncommon';
  return 'common';
}

export function rollRandomWeaponByRaritiesImpl(this: WorldSim, allowedRarities: readonly WeaponRarity[]): string {
  const weaponPool =
    this.currentBiome === 1 && this.campaignMaxFloors === 2 ? PHASE3_WEAPON_IDS : ALL_WEAPON_IDS;
  const candidates = weaponPool.filter((id) => {
    const w = WEAPONS[id];
    return w && allowedRarities.includes(w.rarity);
  });
  if (candidates.length === 0) return 'gale_smg';
  return this.rng.pick(candidates);
}

export function spawnChestImpl(this: WorldSim,
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

export function spawnWorldItemImpl(this: WorldSim,
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

export function resolvePropMovementCollisionImpl(this: WorldSim, entity: { x: number; y: number; radius: number }): void {
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

export function updatePropsImpl(this: WorldSim, dtSec: number): void {
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

export function damagePropImpl(this: WorldSim, prop: SimPropState, amount: number, element: ElementType = 'none'): void {
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

export function detonateExplosiveBarrelImpl(this: WorldSim, barrel: SimPropState): void {
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

export function applyElementAtWorldPointImpl(this: WorldSim, x: number, y: number, element: ElementType, radius = 24): void {
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
