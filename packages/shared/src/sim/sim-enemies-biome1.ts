import { ENEMIES } from '../data/enemies.js';
import { circleVsCircle, clamp, distance } from '../math/vec2.js';
import { COOP_SCALING } from '../data/scaling.js';
import { TILE_SIZE } from '../protocol/messages.js';
import {
  SPORE_EXPLOSION_RADIUS,
  BOAR_CHARGE_SPEED,
  BOAR_CHARGE_DURATION_SEC,
  BOSS_ERUPT_RADIUS,
  SHAMAN_HEAL_RADIUS,
  type SimPlayerState,
  type SimEnemyState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export function updateGoblinShooterAIImpl(
  this: WorldSim,
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
        const muzzleX = e.x + Math.cos(e.telegraphAngle) * 14;
        const muzzleY = e.y + Math.sin(e.telegraphAngle) * 14;

        this.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: this.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'goblin_bow',
          x: muzzleX,
          y: muzzleY,
          angle: e.telegraphAngle,
          pelletCount: 3,
          spreadRad,
          speed: 250,
          damage: e.damage,
          radius: 5,
          knockback: 90,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 2.0,
          element: 'none',
          critChance: 0,
          amplifiedByShield: false,
          seed: this.rng.nextUint32(),
        });
      }

      e.aiState = 'cooldown';
      e.stateTimer = 0.35;
      e.attackCooldownTimer = (ENEMIES.goblin_shooter?.attackCooldownSec ?? 1.65) * cdMult;
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

export function updateWildBoarAIImpl(
  this: WorldSim,
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
        e.attackCooldownTimer = (ENEMIES.wild_boar?.attackCooldownSec ?? 2.25) * cdMult;
        e.vx = 0;
        e.vy = 0;
        return;
      }
    }

    if (e.stateTimer <= 0) {
      e.aiState = 'cooldown';
      e.stateTimer = 0.45;
      e.attackCooldownTimer = (ENEMIES.wild_boar?.attackCooldownSec ?? 2.25) * cdMult;
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

export function updateSporeBomberAIImpl(
  this: WorldSim,
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

export function detonateSporeBomberImpl(this: WorldSim, e: SimEnemyState): void {
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

export function updateSlimeAIImpl(
  this: WorldSim,
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

export function updateGoblinShamanAIImpl(
  this: WorldSim,
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
      this.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: this.tick,
        ownerId: e.id,
        team: 'enemy',
        weaponId: 'shaman_staff',
        x: muzzleX,
        y: muzzleY,
        angle: e.telegraphAngle,
        pelletCount: 1,
        spreadRad: 0,
        speed: bulletSpeed,
        damage: e.damage,
        radius: 6,
        knockback: 80,
        pierceCount: 0,
        bounceCount: 0,
        ttlSec: 2.3,
        element: 'poison',
        critChance: 0,
        amplifiedByShield: false,
        seed: this.rng.nextUint32(),
      });

      e.aiState = 'cooldown';
      e.stateTimer = 0.45;
      e.attackCooldownTimer = (ENEMIES.goblin_shaman?.attackCooldownSec ?? 3.3) * cdMult;
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

export function updateThornTurretAIImpl(
  this: WorldSim,
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
      const bulletSpeed = 215;
      this.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: this.tick,
        ownerId: e.id,
        team: 'enemy',
        weaponId: 'thorn_burst',
        x: e.x,
        y: e.y,
        angle: 0,
        pelletCount: 6,
        spreadRad: 0,
        radialStepRad: Math.PI / 3,
        muzzleOffset: 14,
        speed: bulletSpeed,
        damage: e.damage,
        radius: 5,
        knockback: 75,
        pierceCount: 0,
        bounceCount: 0,
        ttlSec: 2.2,
        element: 'none',
        critChance: 0,
        amplifiedByShield: false,
        seed: this.rng.nextUint32(),
      });
      e.aiState = 'cooldown';
      e.stateTimer = 0.4;
      e.attackCooldownTimer = (ENEMIES[e.defId]?.attackCooldownSec ?? 2.45) * cdMult;
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

export function updateBossSporeKingAIImpl(
  this: WorldSim,
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
      this.executeBossSporeKingAttack(e, e.telegraphAngle);
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
    e.telegraphAngle = angleToPlayer;

    // In Phase 2 & 3, every 3rd attack cycle burrows underground and targets near player's position!
    if (e.bossPhase >= 2 && e.bossAttackCycle % 3 === 2) {
      e.bossBurrowed = true;
      e.stateTimer = Math.max(0.72, 0.78 * bossCdScale);
      const offsetX = Math.cos(angleToPlayer + Math.PI) * 95;
      const offsetY = Math.sin(angleToPlayer + Math.PI) * 95;
      const targetX = clamp(
        targetPlayer.x + offsetX,
        TILE_SIZE * 3.5,
        this.map.width - TILE_SIZE * 3.5,
      );
      const targetY = clamp(
        targetPlayer.y + offsetY,
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
      e.stateTimer = Math.max(0.45, (e.bossPhase === 3 ? 0.54 : e.telegraphDurationSec) * bossCdScale);
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

export function executeBossSporeKingAttackImpl(
  this: WorldSim,
  e: SimEnemyState,
  angleToPlayer: number,
): void {
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

    // Also erupt with 8 radial thorns
    this.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: this.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'thorn_burst',
      x: e.x,
      y: e.y,
      angle: angleToPlayer + 0.65,
      pelletCount: 8,
      spreadRad: 0,
      radialStepRad: (Math.PI * 1.55) / 8,
      muzzleOffset: 24,
      speed: 225,
      damage: e.damage,
      radius: 5.5,
      knockback: 110,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 1.85,
      element: 'poison',
      critChance: 0,
      amplifiedByShield: false,
      seed: this.rng.nextUint32(),
    });

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
    const ringSpeed = e.bossPhase === 3 ? 235 : 215;
    this.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: this.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'boss_spore_ring',
      x: e.x,
      y: e.y,
      angle: angleToPlayer + 0.68,
      pelletCount: ringCount,
      spreadRad: 0,
      radialStepRad: (Math.PI * 1.5) / ringCount,
      muzzleOffset: e.radius + 6,
      speed: ringSpeed,
      damage: e.damage,
      radius: 5.5,
      knockback: 95,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 1.85,
      element: 'poison',
      critChance: 0,
      amplifiedByShield: false,
      seed: this.rng.nextUint32(),
    });

    // Summon spore minion on alternate cycles if active non-boss count < 2
    const activeMinions = this.enemies.filter(
      (m) => !m.isDummy && !m.isBoss && m.defId !== 'spore_guardian' && m.hp > 0,
    ).length;
    if (cycle % 2 === 1 && activeMinions < 2) {
      const minionDef = e.bossPhase >= 2 && cycle % 4 === 3 ? 'spore_bomber' : 'mini_slime';
      this.spawnEnemy(minionDef, e.x + 48, e.y + 36, false);
    }

    // Phase 3 aimed 3-way toxic burst
    if (e.bossPhase === 3 && cycle % 2 === 0) {
      this.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: this.tick,
        ownerId: e.id,
        team: 'enemy',
        weaponId: 'shaman_staff',
        x: e.x,
        y: e.y,
        angle: angleToPlayer,
        pelletCount: 3,
        spreadRad: 0.38,
        muzzleOffset: 24,
        speed: 245,
        damage: e.damage + 1,
        radius: 6,
        knockback: 110,
        pierceCount: 0,
        bounceCount: 0,
        ttlSec: 1.8,
        element: 'poison',
        critChance: 0,
        amplifiedByShield: false,
        seed: this.rng.nextUint32(),
      });
    }
  }

  e.aiState = 'cooldown';
  e.stateTimer = (e.bossPhase === 3 ? 0.35 : 0.45) * bossCdScale;
  const baseCd = ENEMIES.spore_king?.attackCooldownSec ?? 1.85;
  e.attackCooldownTimer =
    (e.bossPhase === 3 ? baseCd * 0.65 : e.bossPhase === 2 ? baseCd * 0.82 : baseCd) *
    bossCdScale;
}
