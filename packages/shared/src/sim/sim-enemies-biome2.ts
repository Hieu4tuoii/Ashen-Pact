import { ENEMIES } from '../data/enemies.js';
import { angleDiff, circleVsCircle, clamp, distance } from '../math/vec2.js';
import { COOP_SCALING } from '../data/scaling.js';
import { findNearestWalkablePoint } from './arena-room-archetypes.js';
import {
  FROST_BAT_SONIC_DART_SPEED,
  ICE_MAGE_BOLT_SPEED,
  findIceMageTargetPrism,
  fireIceMagePrismShotOrVolley,
  resolveEnemyAimTarget,
  spawnSnowSpiritIceBlockOnDeath,
  stepEnemyTelegraphSightline,
  tryBabyYetiPushIceBlock,
  updateEnemyPredictiveSightline,
} from './sim-enemies-tactical-ai.js';
import {
  executeKryssaPattern,
  selectNextBossPattern,
} from './sim-boss-patterns.js';
import type { SimPlayerState, SimEnemyState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export function updateFrostBatAIImpl(
  this: WorldSim,
  e: SimEnemyState,
  distToPlayer: number,
  angleToPlayer: number,
  dtSec: number,
): void {
  const cdMult =
    (e.isElite && e.eliteModifier === 'fast' ? 0.72 : 1.0) * this.getEnemyCooldownScale(false);
  if (e.aiState === 'telegraph') {
    if (
      stepEnemyTelegraphSightline(
        this,
        e,
        resolveEnemyAimTarget(this, e),
        FROST_BAT_SONIC_DART_SPEED,
        dtSec,
      )
    ) {
      if (!this.stressTestActive || this.projectiles.length < 660) {
        this.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: this.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'frost_shard',
          x: e.x + Math.cos(e.telegraphAngle) * 14,
          y: e.y + Math.sin(e.telegraphAngle) * 14,
          angle: e.telegraphAngle,
          pelletCount: 2,
          spreadRad: 0.72,
          speed: FROST_BAT_SONIC_DART_SPEED,
          damage: e.damage,
          radius: 5.2,
          bulletShape: 'diamond',
          knockback: 75,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 2.0,
          element: 'chill',
          critChance: 0,
          amplifiedByShield: false,
          seed: this.rng.nextUint32(),
        });
      }
      e.aiState = 'cooldown';
      e.stateTimer = 0.28;
      e.attackCooldownTimer = (ENEMIES.frost_bat?.attackCooldownSec ?? 1.32) * cdMult;
    }
    return;
  }

  if (e.aiState === 'cooldown') {
    e.stateTimer -= dtSec;
    if (e.stateTimer <= 0) e.aiState = 'move';
  }

  e.aimAngle = angleToPlayer;
  if (e.attackCooldownTimer <= 0 && distToPlayer <= 340) {
    e.aiState = 'telegraph';
    e.stateTimer = e.telegraphDurationSec;
    e.leadSightlineActive = false;
    e.telegraphAngle = updateEnemyPredictiveSightline(
      this,
      e,
      resolveEnemyAimTarget(this, e),
      FROST_BAT_SONIC_DART_SPEED,
    );
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

  const perp = angleToPlayer + (Math.PI / 2) * e.strafeSign;
  const approachWeight = distToPlayer > 175 ? 0.65 : distToPlayer < 95 ? -0.6 : 0.1;
  e.vx = (Math.cos(angleToPlayer) * approachWeight + Math.cos(perp) * 0.85) * e.moveSpeed;
  e.vy = (Math.sin(angleToPlayer) * approachWeight + Math.sin(perp) * 0.85) * e.moveSpeed;
}

export function updateBabyYetiAIImpl(
  this: WorldSim,
  e: SimEnemyState,
  distToPlayer: number,
  angleToPlayer: number,
  dtSec: number,
): void {
  const cdMult =
    (e.isElite && e.eliteModifier === 'fast' ? 0.72 : 1.0) * this.getEnemyCooldownScale(false);
  const slideSpeed = 355;
  if (e.aiState === 'telegraph') {
    e.vx = 0;
    e.vy = 0;
    e.aimAngle = e.telegraphAngle;
    e.stateTimer -= dtSec;
    if (e.stateTimer <= 0) {
      e.aiState = 'attack';
      e.stateTimer = 0.56;
      e.vx = Math.cos(e.telegraphAngle) * slideSpeed;
      e.vy = Math.sin(e.telegraphAngle) * slideSpeed;
    }
    return;
  }

  if (e.aiState === 'attack') {
    e.vx = Math.cos(e.telegraphAngle) * slideSpeed;
    e.vy = Math.sin(e.telegraphAngle) * slideSpeed;
    e.stateTimer -= dtSec;

    const allPlayers = this.getAllPlayers();
    for (let i = 0; i < allPlayers.length; i++) {
      const pl = allPlayers[i]!;
      if (pl.lifeState !== 'alive') continue;
      if (circleVsCircle(e, pl)) {
        pl.chillTimer = Math.max(pl.chillTimer, 2.5);
        this.applyDamageToPlayer(e.damage, e.telegraphAngle, 250, e.defId, pl);
        e.aiState = 'cooldown';
        e.stateTimer = 0.45;
        e.attackCooldownTimer = (ENEMIES.baby_yeti?.attackCooldownSec ?? 2.0) * cdMult;
        e.vx = 0;
        e.vy = 0;
        return;
      }
    }

    if (e.stateTimer <= 0) {
      e.aiState = 'cooldown';
      e.stateTimer = 0.4;
      e.attackCooldownTimer = (ENEMIES.baby_yeti?.attackCooldownSec ?? 2.0) * cdMult;
      e.vx = 0;
      e.vy = 0;
    }
    return;
  }

  if (e.aiState === 'cooldown') {
    e.vx = 0;
    e.vy = 0;
    e.stateTimer -= dtSec;
    if (e.stateTimer <= 0) e.aiState = 'move';
    return;
  }

  e.aimAngle = angleToPlayer;
  if (!this.stressTestActive && this.props.length > 0 && tryBabyYetiPushIceBlock(this, e)) {
    return;
  }
  if (e.attackCooldownTimer <= 0 && distToPlayer <= 180) {
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

export function updateIceMageAIImpl(
  this: WorldSim,
  e: SimEnemyState,
  _targetPlayer: SimPlayerState,
  distToPlayer: number,
  angleToPlayer: number,
  dtSec: number,
): void {
  const cdMult =
    (e.isElite && e.eliteModifier === 'fast' ? 0.72 : 1.0) * this.getEnemyCooldownScale(false);
  if (e.aiState === 'telegraph') {
    const aimTarget = resolveEnemyAimTarget(this, e, _targetPlayer);
    const nearbyPrism = !this.stressTestActive ? findIceMageTargetPrism(this, e, false) : null;
    if (nearbyPrism) {
      e.vx = 0;
      e.vy = 0;
      e.telegraphAngle = Math.atan2(nearbyPrism.y - e.y, nearbyPrism.x - e.x);
      e.aimAngle = e.telegraphAngle;
      e.stateTimer -= dtSec;
      if (e.stateTimer <= 0) {
        this.map.freezeSurfaceInRadius(e.x, e.y, 44);
        fireIceMagePrismShotOrVolley(this, e, aimTarget);
        e.aiState = 'cooldown';
        e.stateTimer = 0.4;
        e.attackCooldownTimer = (ENEMIES.ice_mage?.attackCooldownSec ?? 1.82) * cdMult;
      }
      return;
    }
    if (stepEnemyTelegraphSightline(this, e, aimTarget, ICE_MAGE_BOLT_SPEED, dtSec)) {
      if (!this.stressTestActive) {
        this.map.freezeSurfaceInRadius(e.x, e.y, 44);
      }
      if (!this.stressTestActive || this.projectiles.length < 660) {
        fireIceMagePrismShotOrVolley(this, e, aimTarget);
      }
      e.aiState = 'cooldown';
      e.stateTimer = 0.4;
      e.attackCooldownTimer = (ENEMIES.ice_mage?.attackCooldownSec ?? 1.82) * cdMult;
    }
    return;
  }

  if (e.aiState === 'cooldown') {
    e.vx = 0;
    e.vy = 0;
    e.stateTimer -= dtSec;
    if (e.stateTimer <= 0) e.aiState = 'move';
    return;
  }

  e.aimAngle = angleToPlayer;
  if (e.attackCooldownTimer <= 0 && distToPlayer <= 390) {
    const aimTarget = resolveEnemyAimTarget(this, e, _targetPlayer);
    const nearbyPrism = !this.stressTestActive ? findIceMageTargetPrism(this, e, false) : null;
    e.aiState = 'telegraph';
    e.stateTimer = e.telegraphDurationSec;
    e.leadSightlineActive = false;
    e.telegraphAngle = nearbyPrism
      ? Math.atan2(nearbyPrism.y - e.y, nearbyPrism.x - e.x)
      : updateEnemyPredictiveSightline(this, e, aimTarget, ICE_MAGE_BOLT_SPEED);
    e.aimAngle = e.telegraphAngle;
    e.telegraphRadius = 40;
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
        radius: 40,
      });
    }
    return;
  }

  if (distToPlayer > 250) {
    e.vx = Math.cos(angleToPlayer) * e.moveSpeed;
    e.vy = Math.sin(angleToPlayer) * e.moveSpeed;
  } else if (distToPlayer < 150) {
    e.vx = -Math.cos(angleToPlayer) * e.moveSpeed;
    e.vy = -Math.sin(angleToPlayer) * e.moveSpeed;
  } else {
    const perp = angleToPlayer + (Math.PI / 2) * e.strafeSign;
    e.vx = Math.cos(perp) * e.moveSpeed * 0.75;
    e.vy = Math.sin(perp) * e.moveSpeed * 0.75;
  }
}

export function updateIceGolemAIImpl(
  this: WorldSim,
  e: SimEnemyState,
  distToPlayer: number,
  angleToPlayer: number,
  dtSec: number,
): void {
  const cdMult =
    (e.isElite && e.eliteModifier === 'fast' ? 0.72 : 1.0) * this.getEnemyCooldownScale(false);
  if (e.aiState === 'telegraph') {
    if (stepEnemyTelegraphSightline(this, e, resolveEnemyAimTarget(this, e), 208, dtSec)) {
      if (!this.stressTestActive || this.projectiles.length < 660) {
        this.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: this.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'glacier_spike',
          x: e.x + Math.cos(e.telegraphAngle) * 18,
          y: e.y + Math.sin(e.telegraphAngle) * 18,
          angle: e.telegraphAngle,
          pelletCount: 5,
          spreadRad: 1.68,
          speed: 208,
          damage: e.damage,
          radius: 6.5,
          bulletShape: 'heavy_orb',
          knockback: 130,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 2.1,
          element: 'chill',
          critChance: 0,
          amplifiedByShield: false,
          seed: this.rng.nextUint32(),
        });
      }
      e.aiState = 'cooldown';
      e.stateTimer = 0.55;
      e.attackCooldownTimer = (ENEMIES.ice_golem?.attackCooldownSec ?? 2.25) * cdMult;
    }
    return;
  }

  if (e.aiState === 'cooldown') {
    e.vx = 0;
    e.vy = 0;
    e.stateTimer -= dtSec;
    if (e.stateTimer <= 0) e.aiState = 'move';
    return;
  }

  // Ice Golem turns its front ice shield slowly so players can flank behind it!
  const maxTurn = 2.1 * dtSec;
  const diff = angleDiff(angleToPlayer, e.aimAngle);
  e.aimAngle += clamp(diff, -maxTurn, maxTurn);

  if (e.attackCooldownTimer <= 0 && distToPlayer <= 280) {
    e.aiState = 'telegraph';
    e.stateTimer = e.telegraphDurationSec;
    e.leadSightlineActive = false;
    e.telegraphAngle = updateEnemyPredictiveSightline(this, e, resolveEnemyAimTarget(this, e), 208);
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

  e.vx = Math.cos(e.aimAngle) * e.moveSpeed;
  e.vy = Math.sin(e.aimAngle) * e.moveSpeed;
}

export function updateSnowSpiritAIImpl(
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
      this.detonateSnowSpirit(e);
    }
    return;
  }

  e.aimAngle = angleToPlayer;
  if (distToPlayer <= 54 && !this.stressTestActive) {
    e.aiState = 'telegraph';
    e.stateTimer = e.telegraphDurationSec;
    e.telegraphAngle = angleToPlayer;
    e.telegraphRadius = 64;
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
      radius: 64,
    });
    return;
  }

  e.vx = Math.cos(angleToPlayer) * e.moveSpeed;
  e.vy = Math.sin(angleToPlayer) * e.moveSpeed;
}

export function detonateSnowSpiritImpl(this: WorldSim, e: SimEnemyState): void {
  const blastRadius = 64;
  e.hp = 0;

  this.map.freezeSurfaceInRadius(e.x, e.y, blastRadius);
  spawnSnowSpiritIceBlockOnDeath(this, e);

  const allPlayers = this.getAllPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const pl = allPlayers[i]!;
    if (pl.lifeState !== 'alive') continue;
    if (distance(e.x, e.y, pl.x, pl.y) <= blastRadius + pl.radius) {
      pl.chillTimer = Math.max(pl.chillTimer, 3.0);
      const pushAngle = Math.atan2(pl.y - e.y, pl.x - e.x);
      this.applyDamageToPlayer(e.damage, pushAngle, 210, e.defId, pl);
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
    durationMs: 40,
    trauma: 0.36,
  });
}

export function updateKryssaCloneAIImpl(
  this: WorldSim,
  e: SimEnemyState,
  distToPlayer: number,
  angleToPlayer: number,
  dtSec: number,
): void {
  const cdScale = this.getEnemyCooldownScale(false);
  if (e.aiState === 'telegraph') {
    if (stepEnemyTelegraphSightline(this, e, resolveEnemyAimTarget(this, e), 175, dtSec)) {
      if (!this.stressTestActive || this.projectiles.length < 660) {
        this.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: this.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'kryssa_frost_nova',
          x: e.x + Math.cos(e.telegraphAngle) * 16,
          y: e.y + Math.sin(e.telegraphAngle) * 16,
          angle: e.telegraphAngle,
          pelletCount: 2,
          spreadRad: 0.22,
          speed: 175,
          damage: e.damage,
          radius: 6.5,
          bulletShape: 'lance',
          knockback: 80,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 1.5,
          element: 'chill',
          critChance: 0,
          amplifiedByShield: false,
          seed: this.rng.nextUint32(),
        });
      }
      e.aiState = 'cooldown';
      e.stateTimer = 0.35;
      e.attackCooldownTimer = (ENEMIES.kryssa_clone?.attackCooldownSec ?? 1.95) * cdScale;
    }
    return;
  }

  if (e.aiState === 'cooldown') {
    e.vx = 0;
    e.vy = 0;
    e.stateTimer -= dtSec;
    if (e.stateTimer <= 0) e.aiState = 'move';
    return;
  }

  e.aimAngle = angleToPlayer;
  if (e.attackCooldownTimer <= 0 && distToPlayer <= 380) {
    e.aiState = 'telegraph';
    e.stateTimer = e.telegraphDurationSec;
    e.leadSightlineActive = false;
    e.telegraphAngle = updateEnemyPredictiveSightline(this, e, resolveEnemyAimTarget(this, e), 175);
    e.vx = 0;
    e.vy = 0;
    return;
  }

  const perp = angleToPlayer + (Math.PI / 2) * e.strafeSign;
  const approach = distToPlayer > 55 ? 0.9 : 0;
  e.vx = (Math.cos(angleToPlayer) * approach + Math.cos(perp) * 0.65) * e.moveSpeed;
  e.vy = (Math.sin(angleToPlayer) * approach + Math.sin(perp) * 0.65) * e.moveSpeed;
}

export function spawnKryssaMirrorClonesImpl(this: WorldSim, boss: SimEnemyState): void {
  const existingClones = this.enemies.filter(
    (m) => m.defId === 'kryssa_clone' && m.hp > 0,
  ).length;
  if (existingClones >= 2) return;
  const cx = this.map.width * 0.5;
  const cy = this.map.height * 0.5;
  const cloneRadius = ENEMIES.kryssa_clone?.radius ?? 16;
  const pt1 = findNearestWalkablePoint(
    this.map,
    clamp(cx - 170, 96, this.map.width - 96),
    clamp(cy - 90, 96, this.map.height - 96),
    cloneRadius,
    this.props,
  );
  const pt2 = findNearestWalkablePoint(
    this.map,
    clamp(cx + 170, 96, this.map.width - 96),
    clamp(cy + 90, 96, this.map.height - 96),
    cloneRadius,
    this.props,
  );
  this.spawnEnemy('kryssa_clone', pt1.x, pt1.y, true);
  this.spawnEnemy('kryssa_clone', pt2.x, pt2.y, true);
  boss.prevX = boss.x;
  boss.prevY = boss.y;
}

export function encasePlayerInIcePrisonImpl(
  this: WorldSim,
  target: SimPlayerState,
): SimEnemyState | null {
  if (target.lifeState !== 'alive' || (target.encasedInIceTimer ?? 0) > 0) return null;
  const prison = this.spawnEnemy('ice_prison', target.x, target.y, true);
  target.encasedInIceTimer = 4.5;
  target.icePrisonId = prison.id;
  target.vx = 0;
  target.vy = 0;
  if (!this.stressTestActive) {
    this.events.push({
      kind: 'status_applied',
      targetId: target.id,
      status: 'frozen',
      x: target.x,
      y: target.y,
    });
  }
  return prison;
}

export function updateBossKryssaAIImpl(
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
    if (stepEnemyTelegraphSightline(this, e, targetPlayer, 195, dtSec)) {
      this.executeBossKryssaAttack(e, targetPlayer, e.telegraphAngle);
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
    if (e.bossArmorShellActive) {
      e.bossPatternId = 0;
    } else {
      selectNextBossPattern(this, e);
    }
    e.stateTimer = Math.max(
      0.38,
      (e.bossPhase === 3 ? 0.42 : e.telegraphDurationSec * 0.85) * bossCdScale,
    );
    e.leadSightlineActive = false;
    e.telegraphAngle = updateEnemyPredictiveSightline(this, e, targetPlayer, 195);
    e.telegraphRadius = 56;
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
      bossPatternId: e.bossArmorShellActive ? 0 : e.bossPatternId,
    });
    return;
  }

  const phaseSpeedMult = e.bossPhase === 3 ? 1.32 : e.bossPhase === 2 ? 1.16 : 1.0;
  const coopBossSpeed = 1 + COOP_SCALING[this.getActivePlayerCount()].enemyFireRateBonus * 0.75;
  if (distToPlayer > 175) {
    e.vx = Math.cos(angleToPlayer) * e.moveSpeed * phaseSpeedMult * coopBossSpeed;
    e.vy = Math.sin(angleToPlayer) * e.moveSpeed * phaseSpeedMult * coopBossSpeed;
  } else {
    const perp = angleToPlayer + Math.PI * 0.5 * e.strafeSign;
    e.vx = Math.cos(perp) * e.moveSpeed * 0.85 * coopBossSpeed;
    e.vy = Math.sin(perp) * e.moveSpeed * 0.85 * coopBossSpeed;
  }
}

export function executeBossKryssaAttackImpl(
  this: WorldSim,
  e: SimEnemyState,
  targetPlayer: SimPlayerState,
  angleToPlayer: number,
): void {
  const cycle = e.bossAttackCycle;
  e.bossAttackCycle += 1;
  const bossCdScale = this.getEnemyCooldownScale(true);

  executeKryssaPattern(this, e, targetPlayer, angleToPlayer, cycle);

  e.aiState = 'cooldown';
  e.stateTimer = (e.bossPhase === 3 ? 0.29 : 0.37) * bossCdScale;
  const baseCd = (ENEMIES.kryssa_ice_queen?.attackCooldownSec ?? 1.75) * 0.85;
  e.attackCooldownTimer =
    (e.bossPhase === 3 ? baseCd * 0.66 : e.bossPhase === 2 ? baseCd * 0.82 : baseCd) *
    bossCdScale;
}
