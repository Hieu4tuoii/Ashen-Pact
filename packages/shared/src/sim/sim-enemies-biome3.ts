import { ENEMIES } from '../data/enemies.js';
import { angleDiff, circleVsCircle, clamp, distance } from '../math/vec2.js';
import { COOP_SCALING } from '../data/scaling.js';
import { TILE_SIZE } from '../protocol/messages.js';
import type { MvpAwardEntry, SimPlayerState, SimEnemyState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export function updateFireImpAIImpl(
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
        this.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: this.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'imp_fireball',
          x: e.x + Math.cos(e.telegraphAngle) * 14,
          y: e.y + Math.sin(e.telegraphAngle) * 14,
          angle: e.telegraphAngle,
          pelletCount: 2,
          spreadRad: 0.68,
          speed: 290,
          damage: e.damage,
          radius: 5.5,
          knockback: 80,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 2.0,
          element: 'burn',
          critChance: 0,
          amplifiedByShield: false,
          seed: this.rng.nextUint32(),
        });
      }
      e.aiState = 'cooldown';
      e.stateTimer = 0.25;
      e.attackCooldownTimer = (ENEMIES.fire_imp?.attackCooldownSec ?? 1.44) * cdMult;
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

  const perp = angleToPlayer + (Math.PI / 2) * e.strafeSign;
  const approachDir = distToPlayer > 180 ? 0.7 : distToPlayer < 105 ? -0.65 : 0.15;
  e.vx = (Math.cos(angleToPlayer) * approachDir + Math.cos(perp) * 0.85) * e.moveSpeed;
  e.vy = (Math.sin(angleToPlayer) * approachDir + Math.sin(perp) * 0.85) * e.moveSpeed;
}

export function updateDwarfCannonAIImpl(
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
        this.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: this.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'dwarf_mortar',
          x: e.x + Math.cos(e.telegraphAngle) * 18,
          y: e.y + Math.sin(e.telegraphAngle) * 18,
          angle: e.telegraphAngle,
          pelletCount: 1,
          spreadRad: 0.08,
          speed: 255,
          damage: e.damage,
          radius: 7.5,
          knockback: 150,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 1.5,
          element: 'burn',
          critChance: 0,
          amplifiedByShield: false,
          seed: this.rng.nextUint32(),
        });
      }
      e.aiState = 'cooldown';
      e.stateTimer = 0.5;
      e.attackCooldownTimer = (ENEMIES.dwarf_cannon?.attackCooldownSec ?? 2.18) * cdMult;
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
  if (e.attackCooldownTimer <= 0 && distToPlayer <= 400) {
    e.aiState = 'telegraph';
    e.stateTimer = e.telegraphDurationSec;
    e.telegraphAngle = angleToPlayer;
    e.telegraphRadius = 48;
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
        radius: 48,
      });
    }
    return;
  }

  if (distToPlayer > 260) {
    e.vx = Math.cos(angleToPlayer) * e.moveSpeed;
    e.vy = Math.sin(angleToPlayer) * e.moveSpeed;
  } else if (distToPlayer < 140) {
    e.vx = -Math.cos(angleToPlayer) * e.moveSpeed;
    e.vy = -Math.sin(angleToPlayer) * e.moveSpeed;
  } else {
    e.vx = 0;
    e.vy = 0;
  }
}

export function updateCoalGolemAIImpl(
  this: WorldSim,
  e: SimEnemyState,
  distToPlayer: number,
  angleToPlayer: number,
  dtSec: number,
): void {
  const cdScale = this.getEnemyCooldownScale(false);
  const lungeSpeed = 240;
  if (e.aiState === 'telegraph') {
    e.vx = 0;
    e.vy = 0;
    e.aimAngle = e.telegraphAngle;
    e.stateTimer -= dtSec;
    if (e.stateTimer <= 0) {
      e.aiState = 'attack';
      e.stateTimer = 0.28;
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
        pl.burnTimer = Math.max(pl.burnTimer, 2.0);
        this.applyDamageToPlayer(e.damage, e.telegraphAngle, 190, e.defId, pl);
        e.aiState = 'cooldown';
        e.stateTimer = 0.4;
        e.attackCooldownTimer = (ENEMIES.coal_golem?.attackCooldownSec ?? 2.1) * cdScale;
        e.vx = 0;
        e.vy = 0;
        return;
      }
    }
    if (e.stateTimer <= 0) {
      e.aiState = 'cooldown';
      e.stateTimer = 0.35;
      e.attackCooldownTimer = (ENEMIES.coal_golem?.attackCooldownSec ?? 2.1) * cdScale;
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
  if (e.attackCooldownTimer <= 0 && distToPlayer <= 80) {
    e.aiState = 'telegraph';
    e.stateTimer = e.telegraphDurationSec;
    e.telegraphAngle = angleToPlayer;
    e.vx = 0;
    e.vy = 0;
    return;
  }

  e.vx = Math.cos(angleToPlayer) * e.moveSpeed;
  e.vy = Math.sin(angleToPlayer) * e.moveSpeed;
}

export function updateWelderDroneAIImpl(
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
      // Weld / grant shieldArmor (+10 up to 24) to nearby allies within 200u!
      let weldedCount = 0;
      for (let i = 0; i < this.enemies.length; i++) {
        const ally = this.enemies[i]!;
        if (ally.id === e.id || ally.isDummy || ally.hp <= 0) continue;
        if (distance(e.x, e.y, ally.x, ally.y) <= 200) {
          ally.shieldArmor = Math.min(24, ally.shieldArmor + 10);
          weldedCount += 1;
        }
      }
      if (weldedCount > 0 && !this.stressTestActive) {
        this.events.push({
          kind: 'shaman_heal',
          shamanId: e.id,
          x: e.x,
          y: e.y,
          radius: 200,
          healedCount: weldedCount,
        });
      }

      if (!this.stressTestActive || this.projectiles.length < 660) {
        this.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: this.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'welder_arc',
          x: e.x + Math.cos(e.telegraphAngle) * 14,
          y: e.y + Math.sin(e.telegraphAngle) * 14,
          angle: e.telegraphAngle,
          pelletCount: 1,
          spreadRad: 0,
          speed: 320,
          damage: e.damage,
          radius: 5.5,
          knockback: 75,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 1.9,
          element: 'shock',
          critChance: 0,
          amplifiedByShield: false,
          seed: this.rng.nextUint32(),
        });
      }

      e.aiState = 'cooldown';
      e.stateTimer = 0.35;
      e.attackCooldownTimer = (ENEMIES.welder_drone?.attackCooldownSec ?? 2.25) * cdMult;
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
  if (e.attackCooldownTimer <= 0 && distToPlayer <= 360) {
    e.aiState = 'telegraph';
    e.stateTimer = e.telegraphDurationSec;
    e.telegraphAngle = angleToPlayer;
    e.vx = 0;
    e.vy = 0;
    return;
  }

  const perp = angleToPlayer + (Math.PI / 2) * e.strafeSign;
  const approachDir = distToPlayer > 220 ? 0.6 : distToPlayer < 135 ? -0.6 : 0;
  e.vx = (Math.cos(angleToPlayer) * approachDir + Math.cos(perp) * 0.8) * e.moveSpeed;
  e.vy = (Math.sin(angleToPlayer) * approachDir + Math.sin(perp) * 0.8) * e.moveSpeed;
}

export function updateIronShielderAIImpl(
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
        this.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: this.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'shielder_slug',
          x: e.x + Math.cos(e.telegraphAngle) * 18,
          y: e.y + Math.sin(e.telegraphAngle) * 18,
          angle: e.telegraphAngle,
          pelletCount: 3,
          spreadRad: 0.96,
          speed: 270,
          damage: e.damage,
          radius: 6,
          knockback: 115,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 2.1,
          element: 'burn',
          critChance: 0,
          amplifiedByShield: false,
          seed: this.rng.nextUint32(),
        });
      }
      e.aiState = 'cooldown';
      e.stateTimer = 0.45;
      e.attackCooldownTimer = (ENEMIES.iron_shielder?.attackCooldownSec ?? 2.0) * cdMult;
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

  // Iron Shielder turns its frontal iron shield slowly so teammates can flank!
  const maxTurn = 2.0 * dtSec;
  const diff = angleDiff(angleToPlayer, e.aimAngle);
  e.aimAngle += clamp(diff, -maxTurn, maxTurn);

  if (e.attackCooldownTimer <= 0 && distToPlayer <= 310) {
    e.aiState = 'telegraph';
    e.stateTimer = e.telegraphDurationSec;
    e.telegraphAngle = e.aimAngle;
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

export function spawnForgeTitanEnergyCoresImpl(this: WorldSim, boss: SimEnemyState): void {
  const existing = this.enemies.filter((m) => m.defId === 'forge_energy_core' && m.hp > 0).length;
  if (existing > 0) return;
  const leftX = clamp(boss.x - 125, TILE_SIZE * 3, this.map.width - TILE_SIZE * 3);
  const rightX = clamp(boss.x + 125, TILE_SIZE * 3, this.map.width - TILE_SIZE * 3);
  const coreY = clamp(boss.y, TILE_SIZE * 3, this.map.height - TILE_SIZE * 3);
  this.spawnEnemy('forge_energy_core', leftX, coreY, true);
  this.spawnEnemy('forge_energy_core', rightX, coreY, true);
  this.titanCoreWindowTimer = 0;
  this.titanFirstCoreBrokenId = 0;
}

export function updateBossForgeTitanAIImpl(
  this: WorldSim,
  e: SimEnemyState,
  _targetPlayer: SimPlayerState,
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
      this.executeBossForgeTitanAttack(e, e.telegraphAngle);
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

  const hasCloseShockwave = this.shockwaveRings.some(
    (r) => r.sourceEnemyId === e.id && r.radius < 265,
  );
  if (e.attackCooldownTimer <= 0 && !hasCloseShockwave) {
    e.aiState = 'telegraph';
    e.stateTimer = Math.max(
      0.38,
      (e.bossPhase === 3 ? 0.46 : e.telegraphDurationSec * 0.85) * bossCdScale,
    );
    e.telegraphAngle = angleToPlayer;
    e.telegraphRadius = 72;
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

  const phaseSpeedMult = e.bossPhase === 3 ? 1.3 : e.bossPhase === 2 ? 1.15 : 1.0;
  const coopBossSpeed = 1 + COOP_SCALING[this.getActivePlayerCount()].enemyFireRateBonus * 0.75;
  if (distToPlayer > 140) {
    e.vx = Math.cos(angleToPlayer) * e.moveSpeed * phaseSpeedMult * coopBossSpeed;
    e.vy = Math.sin(angleToPlayer) * e.moveSpeed * phaseSpeedMult * coopBossSpeed;
  } else {
    const perp = angleToPlayer + Math.PI * 0.5 * e.strafeSign;
    e.vx = Math.cos(perp) * e.moveSpeed * 0.75 * coopBossSpeed;
    e.vy = Math.sin(perp) * e.moveSpeed * 0.75 * coopBossSpeed;
  }
}

export function executeBossForgeTitanAttackImpl(
  this: WorldSim,
  e: SimEnemyState,
  angleToPlayer: number,
): void {
  const cycle = e.bossAttackCycle;
  e.bossAttackCycle += 1;
  const bossCdScale = this.getEnemyCooldownScale(true);

  // 1. Hammer Slam Shockwave Ring (players Dash through with i-frames) + Reverse Conveyor Belts!
  this.map.reverseConveyorDirection();
  if (cycle % 2 === 0) {
    this.shockwaveRings.push({
      id: ++this.nextPuzzleEntityId,
      sourceEnemyId: e.id,
      x: e.x,
      y: e.y,
      radius: e.radius,
      maxRadius: 360,
      speed: e.bossPhase === 3 ? 215 : 205,
      thickness: 28,
      damage: e.damage,
      hitPlayerIds: [],
    });
  }
  this.events.push({
    kind: 'hit_stop',
    durationMs: 50,
    trauma: 0.52,
  });

  // 2. Magma Barrage Volley
  if (cycle % 2 === 1 || e.bossPhase === 3) {
    const barrageCount = e.bossPhase === 3 ? 12 : e.bossPhase === 2 ? 10 : 8;
    const barrageStep = (Math.PI * 2) / barrageCount;
    const barrageParity = (e.bossPhase === 3 ? cycle : Math.floor(cycle / 2)) % 2;
    this.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: this.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'titan_magma_barrage',
      x: e.x,
      y: e.y,
      angle: angleToPlayer + (barrageParity === 1 ? barrageStep * 0.5 : 0),
      pelletCount: barrageCount,
      spreadRad: 0,
      radialStepRad: barrageStep,
      muzzleOffset: e.radius + 8,
      speed: 215,
      damage: e.damage,
      radius: 6,
      knockback: 115,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 1.55,
      element: 'burn',
      critChance: 0,
      amplifiedByShield: false,
      seed: this.rng.nextUint32(),
    });
  }

  // 3. Phase 3 Overheat: 360-degree Rotating Flame Sweep
  if (e.bossPhase === 3 && cycle % 2 === 1) {
    const sweepStep = (Math.PI * 2) / 8;
    const sweepParity = Math.floor(cycle / 2) % 2;
    this.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: this.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'titan_flame_sweep',
      x: e.x,
      y: e.y,
      angle: angleToPlayer + (sweepParity === 1 ? sweepStep * 0.5 : 0),
      pelletCount: 8,
      spreadRad: 0,
      radialStepRad: sweepStep,
      muzzleOffset: e.radius + 10,
      speed: 225,
      damage: e.damage,
      radius: 6,
      knockback: 110,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 1.5,
      element: 'burn',
      critChance: 0,
      amplifiedByShield: false,
      seed: this.rng.nextUint32(),
    });
  }

  e.aiState = 'cooldown';
  e.stateTimer = (e.bossPhase === 3 ? 0.3 : 0.38) * bossCdScale;
  const baseCd = (ENEMIES.forge_titan?.attackCooldownSec ?? 1.9) * 0.85;
  e.attackCooldownTimer =
    (e.bossPhase === 3 ? baseCd * 0.65 : e.bossPhase === 2 ? baseCd * 0.82 : baseCd) *
    bossCdScale;
}

export function computeMvpAwardsImpl(this: WorldSim): MvpAwardEntry[] {
  const players = [...this.getAllPlayers()];
  if (players.length === 0) return [];

  // Pick best damage dealer
  let bestDmgPlayer = players[0]!;
  let bestDmg = bestDmgPlayer.statsDamageDealt ?? 0;
  for (let i = 1; i < players.length; i++) {
    const p = players[i]!;
    const d = p.statsDamageDealt ?? 0;
    if (d > bestDmg) {
      bestDmg = d;
      bestDmgPlayer = p;
    }
  }
  if (players.length === 1 && bestDmg === 0) {
    bestDmg = this.runStats.damageDealt;
  }

  // Pick best slayer (kills)
  let bestSlayerPlayer = players[0]!;
  let bestKills = bestSlayerPlayer.statsKills ?? 0;
  for (let i = 1; i < players.length; i++) {
    const p = players[i]!;
    const k = p.statsKills ?? 0;
    if (k > bestKills) {
      bestKills = k;
      bestSlayerPlayer = p;
    }
  }
  if (players.length === 1 && bestKills === 0) {
    bestKills = this.runStats.kills;
  }

  // Pick best elemental grandmaster
  let bestElemPlayer = players[0]!;
  let bestElemScore =
    (bestElemPlayer.statsElementalReactions ?? 0) +
    (bestElemPlayer.statsTeamCombos ?? 0) * 2;
  for (let i = 1; i < players.length; i++) {
    const p = players[i]!;
    const score = (p.statsElementalReactions ?? 0) + (p.statsTeamCombos ?? 0) * 2;
    if (score > bestElemScore) {
      bestElemScore = score;
      bestElemPlayer = p;
    }
  }
  const elemReactions =
    players.length === 1 && (bestElemPlayer.statsElementalReactions ?? 0) === 0
      ? this.runStats.elementalReactions
      : (bestElemPlayer.statsElementalReactions ?? 0);
  const elemCombos =
    players.length === 1 && (bestElemPlayer.statsTeamCombos ?? 0) === 0
      ? this.runStats.teamCombos
      : (bestElemPlayer.statsTeamCombos ?? 0);

  // Pick best guardian / medic
  let bestMedicPlayer = players[0]!;
  let bestMedicScore =
    (bestMedicPlayer.statsRevives ?? 0) * 100 + (bestMedicPlayer.statsDamageTaken ?? 0);
  for (let i = 1; i < players.length; i++) {
    const p = players[i]!;
    const score = (p.statsRevives ?? 0) * 100 + (p.statsDamageTaken ?? 0);
    if (score > bestMedicScore) {
      bestMedicScore = score;
      bestMedicPlayer = p;
    }
  }

  return [
    {
      category: 'damage',
      titleKey: 'ui.result.mvpDamageTitle',
      descKey: 'ui.result.mvpDamageDesc',
      playerId: bestDmgPlayer.id,
      playerSlot: bestDmgPlayer.slot,
      displayName: bestDmgPlayer.displayName,
      characterId: bestDmgPlayer.characterId,
      colorHex: bestDmgPlayer.colorHex,
      value: bestDmg,
      secondaryValue: 0,
    },
    {
      category: 'slayer',
      titleKey: 'ui.result.mvpSlayerTitle',
      descKey: 'ui.result.mvpSlayerDesc',
      playerId: bestSlayerPlayer.id,
      playerSlot: bestSlayerPlayer.slot,
      displayName: bestSlayerPlayer.displayName,
      characterId: bestSlayerPlayer.characterId,
      colorHex: bestSlayerPlayer.colorHex,
      value: bestKills,
      secondaryValue: this.runStats.elitesKilled + this.runStats.bossesKilled,
    },
    {
      category: 'elemental',
      titleKey: 'ui.result.mvpElementalTitle',
      descKey: 'ui.result.mvpElementalDesc',
      playerId: bestElemPlayer.id,
      playerSlot: bestElemPlayer.slot,
      displayName: bestElemPlayer.displayName,
      characterId: bestElemPlayer.characterId,
      colorHex: bestElemPlayer.colorHex,
      value: elemReactions,
      secondaryValue: elemCombos,
    },
    {
      category: 'medic',
      titleKey: 'ui.result.mvpMedicTitle',
      descKey: 'ui.result.mvpMedicDesc',
      playerId: bestMedicPlayer.id,
      playerSlot: bestMedicPlayer.slot,
      displayName: bestMedicPlayer.displayName,
      characterId: bestMedicPlayer.characterId,
      colorHex: bestMedicPlayer.colorHex,
      value: bestMedicPlayer.statsRevives ?? 0,
      secondaryValue: bestMedicPlayer.statsDamageTaken ?? 0,
    },
  ];
}
