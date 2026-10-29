import { ENEMIES } from '../data/enemies.js';
import type { ElementalReactionId, ElementType } from '../data/types.js';
import { angleDiff, distance } from '../math/vec2.js';
import { TILE_SIZE } from '../protocol/messages.js';
import {
  despawnAshenExecutioners,
  purifyAshenPactsOnBossDefeated,
} from './sim-ashen-pacts.js';
import {
  BOSS_SINGLE_HIT_MAX_MULT,
  computeEnemyVulnerabilityMultiplier,
  computeReactionMultiplier,
} from './sim-damage-pipeline.js';
import {
  BULLET_HEAVY_PINBALL_KB_MULT,
  propagateRangerPreyChainDamageAndKnockback,
} from './sim-blessings.js';
import {
  addBossStaggerAccum,
  getBossArmorBreakVulnBonus,
  getBossArmorShellDamageMultiplier,
} from './sim-boss-armor-break.js';
import {
  ICE_GOLEM_FRONT_CONE_RAD,
  IRON_SHIELDER_FRONT_CONE_RAD,
  getShamanTotemDamageMultiplier,
  spawnCoalBombOnDeath,
  spawnSnowSpiritIceBlockOnDeath,
  triggerIronShielderShockArc,
  triggerWelderDroneEmpBlastOnDeath,
} from './sim-enemies-tactical-ai.js';
import { hasPlayerBlessing, type SimPlayerState, type SimEnemyState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export function applyDamageToEnemyImpl(
  this: WorldSim,
  enemy: SimEnemyState,
  amount: number,
  isCrit: boolean,
  element: ElementType,
  hitAngleRad: number,
  knockback: number,
  isHeavyAttack = false,
  attackerPlayerId = this.player.id,
  isChainDamage = false,
  procCoefficient = 1.0,
  isKickedPropHit = false,
): void {
  if (enemy.defId === 'ashen_executioner') {
    enemy.hp = enemy.maxHp;
    return;
  }
  if (
    enemy.hp <= 0 ||
    enemy.bossBurrowed ||
    (enemy.isBoss &&
      (enemy.bossPhaseTransitionTimer ?? 0) > 0 &&
      enemy.aiState !== 'stunned' &&
      amount < enemy.maxHp * 0.3)
  ) {
    return;
  }

  let finalAmount = amount;
  let finalCrit = isCrit;

  // Ranger Passive (Mắt Ưng): Damage increases with distance to target (up to +30%)
  if (attackerPlayerId > 0 && !isChainDamage) {
    const attacker = this.getPlayerById(attackerPlayerId);
    if (attacker && attacker.characterId === 'ranger') {
      const distToTarget = distance(attacker.x, attacker.y, enemy.x, enemy.y);
      const distBonus = Math.min(0.3, (distToTarget / 320) * 0.3);
      finalAmount *= 1 + distBonus;
    }
  }

  // 3-4P Boss Mechanic: while Spore Guardian Mushrooms are alive, Spore King takes 65% less damage
  if (enemy.isBoss && this.hasActiveBossGuardians()) {
    finalAmount = Math.max(1, finalAmount * 0.35);
  }
  finalAmount *= getShamanTotemDamageMultiplier(this, enemy);
  if (amount < enemy.maxHp * 0.3) {
    finalAmount *= getBossArmorShellDamageMultiplier(enemy);
  }

  // Biome 2 & 3 Front Shield Mechanic (ice_golem & iron_shielder):
  // Frontal attacks within a 150-degree forward cone are heavily reduced unless flanked from behind or frozen/stunned!
  let hitFrontShield = false;
  const frontShieldReduction = ENEMIES[enemy.defId]?.frontShieldReduction ?? 0;
  if (
    frontShieldReduction > 0 &&
    enemy.frozenTimer <= 0 &&
    enemy.aiState !== 'stunned' &&
    (enemy.shieldBrokenTimer ?? 0) <= 0
  ) {
    const incomingFromAngle = hitAngleRad + Math.PI;
    const coneHalfRad =
      enemy.defId === 'ice_golem'
        ? ICE_GOLEM_FRONT_CONE_RAD
        : enemy.defId === 'iron_shielder'
          ? IRON_SHIELDER_FRONT_CONE_RAD
          : (75 * Math.PI) / 180;
    if (Math.abs(angleDiff(incomingFromAngle, enemy.aimAngle)) < coneHalfRad) {
      finalAmount = Math.max(1, finalAmount * (1 - frontShieldReduction));
      hitFrontShield = true;
    }
  }

  // Enemy Vulnerability Bucket (hard-capped at 1.75x):
  // - Boss Armor Break Stun (+40%)
  // - Boss Forge Titan Overload Stun (+50%)
  // - Ranger Mark (+25%)
  // - Superconduct (+30% isolated, capped at 1.75x combined)
  finalAmount *= computeEnemyVulnerabilityMultiplier({
    marked: enemy.markedTimer > 0 ? 0.25 : 0,
    superconduct: enemy.superconductTimer > 0 ? 0.3 : 0,
    caustic: (enemy.causticVulnTimer ?? 0) > 0 ? 0.25 : 0,
    bossArmorBreak: getBossArmorBreakVulnBonus(enemy),
    extraVulnAdd:
      enemy.defId === 'forge_titan' &&
      enemy.aiState === 'stunned' &&
      (enemy.bossArmorBreakVulnTimer ?? 0) <= 0
        ? 0.5
        : 0,
  });

  // Section 6.2 & AP2 2.3: Freeze + heavy/crit -> Shatter (2.0x on regular/Elite, 1.35x cap on Boss)
  let triggeredShatter = false;
  if ((enemy.frozenTimer > 0 || enemy.chillStacks >= 2) && (isHeavyAttack || isCrit)) {
    finalAmount *= computeReactionMultiplier('shatter', enemy.isBoss);
    finalCrit = true;
    triggeredShatter = true;
    const primerId = enemy.lastElementOwnerId;
    enemy.frozenTimer = 0;
    enemy.chillTimer = 0;
    enemy.chillStacks = 0;
    enemy.lastElementOwnerId = 0;
    enemy.lastElementApplied = 'none';
    if (!this.stressTestActive) {
      this.events.push({
        kind: 'status_applied',
        targetId: enemy.id,
        status: 'shatter',
        x: enemy.x,
        y: enemy.y,
      });
    }
    this.triggerElementalReaction(
      enemy,
      'shatter',
      Math.round(finalAmount),
      primerId,
      attackerPlayerId,
    );
  }

  if (enemy.isBoss) {
    finalAmount = Math.min(finalAmount, amount * BOSS_SINGLE_HIT_MAX_MULT);
  }
  const dmg = Math.max(1, Math.round(finalAmount));
  let hitArmor = hitFrontShield || Boolean(enemy.isBoss && enemy.bossArmorShellActive);
  if (this.stressTestActive && enemy.hp <= dmg + 20) {
    enemy.hp = enemy.maxHp;
  } else if (enemy.shieldArmor > 0) {
    const prevShield = enemy.shieldArmor;
    const absorbed = Math.min(enemy.shieldArmor, dmg);
    enemy.shieldArmor -= absorbed;
    const rem = dmg - absorbed;
    hitArmor = hitArmor || (absorbed > 0 && rem === 0);
    enemy.hp = Math.max(0, enemy.hp - rem);
    if (prevShield > 0 && enemy.shieldArmor === 0) {
      this.events.push({
        kind: 'armor_broken',
        targetKind: 'enemy',
        targetId: enemy.id,
        x: enemy.x,
        y: enemy.y,
      });
    }
  } else {
    enemy.hp = Math.max(0, enemy.hp - dmg);
  }
  enemy.hitFlashTimer = 0.12;
  enemy.lastHitDmg = dmg;
  if (attackerPlayerId > 0) {
    enemy.lastHitPlayerId = attackerPlayerId;
  }
  this.recordDamageHistory(dmg);
  this.runStats.damageDealt += dmg;
  const attackerPl =
    attackerPlayerId > 0
      ? (this.getPlayerById(attackerPlayerId) ?? this.player)
      : this.player;
  attackerPl.statsDamageDealt = (attackerPl.statsDamageDealt ?? 0) + dmg;
  this.checkBossPhaseTransitions(enemy);

  const isImmobileTarget =
    enemy.defId === 'thorn_turret' ||
    enemy.defId === 'spore_guardian' ||
    enemy.defId === 'ice_prison' ||
    enemy.defId === 'forge_energy_core';
  const baseKbMult = enemy.isDummy ? 0.15 : isImmobileTarget ? 0 : enemy.isBoss ? 0.2 : 1.0;
  const pinballKbMult =
    !isChainDamage && hasPlayerBlessing(attackerPl, 'bullet_heavy_pinball')
      ? BULLET_HEAVY_PINBALL_KB_MULT
      : 1.0;
  const kbMult =
    baseKbMult *
    pinballKbMult *
    (this.map.getSurfaceAtWorld(enemy.x, enemy.y) === 'ice' ? 1.5 : 1.0);
  const kbX = Math.cos(hitAngleRad) * knockback * kbMult;
  const kbY = Math.sin(hitAngleRad) * knockback * kbMult;
  enemy.kbVx += kbX;
  enemy.kbVy += kbY;
  if (enemy.isBoss && enemy.hp > 0 && !isChainDamage && (isKickedPropHit || knockback > 0)) {
    addBossStaggerAccum(this, enemy, knockback, procCoefficient, isKickedPropHit, attackerPl);
  }

  // Shatter ice shards splash damage to nearby enemies within 85u
  if (triggeredShatter && !isChainDamage) {
    const shardDmg = Math.max(8, Math.round(amount * 1.1));
    for (let i = 0; i < this.enemies.length; i++) {
      const other = this.enemies[i]!;
      if (other.id === enemy.id || other.hp <= 0 || other.aiState === 'spawning') continue;
      if (distance(enemy.x, enemy.y, other.x, other.y) <= 85) {
        this.applyDotDamageToEnemy(other, shardDmg, 'chill');
      }
    }
  }

  // Ranger Upgrade 2 (Chuỗi Con Mồi / ranger_prey_chain): Marked target propagates 35% damage & knockback to nearby enemies
  propagateRangerPreyChainDamageAndKnockback(
    this,
    enemy,
    dmg,
    hitAngleRad,
    kbX,
    kbY,
    attackerPlayerId,
    attackerPl,
    isChainDamage,
  );

  // Apply Elemental Status & check Elemental Reactions
  if (element !== 'none') {
    this.applyElementStatusToEnemy(enemy, element, dmg, attackerPlayerId);
  }
  if (
    enemy.defId === 'iron_shielder' &&
    element === 'shock' &&
    (hitFrontShield || Math.abs(angleDiff(hitAngleRad, enemy.aimAngle)) < IRON_SHIELDER_FRONT_CONE_RAD)
  ) {
    triggerIronShielderShockArc(this, enemy, attackerPlayerId);
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
    this.handleEnemyKilled(enemy, attackerPl.id);
  }
}

export function triggerElementalReactionImpl(
  this: WorldSim,
  enemy: SimEnemyState,
  reaction: ElementalReactionId,
  damage: number,
  primerPlayerId: number,
  triggerPlayerId: number,
): void {
  this.runStats.elementalReactions += 1;
  const triggerPl =
    triggerPlayerId > 0
      ? (this.getPlayerById(triggerPlayerId) ?? this.player)
      : this.player;
  triggerPl.statsElementalReactions = (triggerPl.statsElementalReactions ?? 0) + 1;
  const isTeamCombo =
    primerPlayerId > 0 && triggerPlayerId > 0 && primerPlayerId !== triggerPlayerId;

  if (isTeamCombo) {
    this.teamComboCount += 1;
    this.runStats.teamCombos += 1;
    const allPlayers = this.getAllPlayers();
    for (let i = 0; i < allPlayers.length; i++) {
      const pl = allPlayers[i]!;
      if (pl.id === primerPlayerId || pl.id === triggerPlayerId) {
        if (pl.elementalConvergenceTimer <= 0) {
          pl.clipAmmo = pl.clipMax;
          pl.reloadTimer = 0;
          pl.reloadLockout = false;
          pl.weaponHeat = 0;
          pl.overheatLockTimer = 0;
        }
        pl.elementalConvergenceTimer = 3.0;
        pl.statsTeamCombos = (pl.statsTeamCombos ?? 0) + 1;
      }
    }
  }

  if (!this.stressTestActive) {
    this.events.push({
      kind: 'elemental_reaction',
      reaction,
      x: enemy.x,
      y: enemy.y,
      targetId: enemy.id,
      damage,
      isTeamCombo,
      primerPlayerId,
      triggerPlayerId,
      convergenceDurationSec: isTeamCombo ? 3.0 : undefined,
    });
    this.events.push({
      kind: 'hit_stop',
      durationMs: isTeamCombo ? 55 : 35,
      trauma: isTeamCombo ? 0.42 : 0.26,
    });
  }
}

export function handleEnemyKilledImpl(
  this: WorldSim,
  enemy: SimEnemyState,
  killerPlayerId = this.player.id,
): void {
  this.runStats.kills += 1;
  if (enemy.isElite) this.runStats.elitesKilled += 1;
  if (enemy.isBoss) this.runStats.bossesKilled += 1;
  const killerPl = this.getPlayerById(killerPlayerId) ?? this.player;
  killerPl.statsKills = (killerPl.statsKills ?? 0) + 1;

  this.events.push({
    kind: 'entity_killed',
    entityId: enemy.id,
    defId: enemy.defId,
    x: enemy.x,
    y: enemy.y,
  });

  const allPlayers = this.getAllPlayers();

  // Green Slime splits into 2 Mini Slimes on death!
  if (enemy.defId === 'green_slime' && !this.stressTestActive) {
    const m1 = this.spawnEnemy('mini_slime', enemy.x - 14, enemy.y - 8, true);
    const m2 = this.spawnEnemy('mini_slime', enemy.x + 14, enemy.y + 8, true);
    m1.kbVx = -95;
    m1.kbVy = -45;
    m2.kbVx = 95;
    m2.kbVy = 45;
  }

  // Biome 2 Snow Spirit freezes ground and crystallizes into sliding_ice_block on death
  if (enemy.defId === 'snow_spirit' && !this.stressTestActive) {
    this.map.freezeSurfaceInRadius(enemy.x, enemy.y, 52);
    spawnSnowSpiritIceBlockOnDeath(this, enemy);
  }

  // Biome 2 Kryssa Ice Prison destroyed -> rescue trapped player!
  if (enemy.defId === 'ice_prison') {
    for (let i = 0; i < allPlayers.length; i++) {
      const pl = allPlayers[i]!;
      if (pl.icePrisonId === enemy.id || (pl.encasedInIceTimer ?? 0) > 0) {
        pl.encasedInIceTimer = 0;
        pl.icePrisonId = 0;
        pl.invulnerableTimer = Math.max(pl.invulnerableTimer, 1.0);
      }
    }
    return;
  }

  // Biome 3 Coal Golem leaves a burning lava/fire pool and drops a 2.0s coal_bomb on death!
  if (enemy.defId === 'coal_golem' && !this.stressTestActive) {
    const tx = Math.floor(enemy.x / TILE_SIZE);
    const ty = Math.floor(enemy.y / TILE_SIZE);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 1) {
          this.map.setSurface(
            tx + dx,
            ty + dy,
            dx === 0 && dy === 0 ? 'lava' : 'burning_oil',
            8.0,
            false,
          );
        }
      }
    }
    this.events.push({ kind: 'surface_triggered', surface: 'lava', x: enemy.x, y: enemy.y });
    spawnCoalBombOnDeath(this, enemy);
  }

  // Biome 3 Welder Drone crashes on death and triggers a r=110px EMP Blast!
  if (enemy.defId === 'welder_drone' && !this.stressTestActive) {
    triggerWelderDroneEmpBlastOnDeath(this, enemy, killerPlayerId);
  }

  // Biome 3 Boss Forge Titan Energy Core destroyed -> check 3s Co-op / 6s Solo sync window!
  if (enemy.defId === 'forge_energy_core') {
    const remainingCores = this.enemies.filter(
      (m) => m.id !== enemy.id && m.defId === 'forge_energy_core' && m.hp > 0,
    );
    if (remainingCores.length > 0) {
      this.titanCoreWindowTimer = this.getActivePlayerCount() > 1 ? 3.0 : 6.0;
      this.titanFirstCoreBrokenId = enemy.id;
    } else {
      this.titanCoreWindowTimer = 0;
      this.titanFirstCoreBrokenId = 0;
      const titan = this.enemies.find((m) => m.defId === 'forge_titan' && m.hp > 0);
      if (titan) {
        const overloadSelfDmg = Math.max(25, Math.round(titan.maxHp * 0.08));
        titan.hp = Math.max(1, titan.hp - overloadSelfDmg);
        this.checkBossPhaseTransitions(titan);
        titan.bossArmorShellActive = false;
        titan.bossArmorShellReduction = 0;
        titan.bossPhaseTransitionTimer = 0;
        titan.aiState = 'stunned';
        titan.stateTimer = 4.5;
        titan.superconductTimer = 6.0;
        titan.vx = 0;
        titan.vy = 0;
        this.events.push({
          kind: 'emp_blast',
          x: titan.x,
          y: titan.y,
          radius: 160,
          bulletsCleared: 0,
        });
        this.events.push({
          kind: 'hit_stop',
          durationMs: 70,
          trauma: 0.65,
        });
      }
    }
    const coreSeedAng = this.rng.nextFloat(-Math.PI, Math.PI);
    this.pickups.push(
      this.acquirePickup({
        id: ++this.nextEntityId,
        kind: 'life_seed',
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(coreSeedAng) * 65,
        vy: Math.sin(coreSeedAng) * 65,
        amount: 2,
        ttlSec: 18,
      }),
    );
    return;
  }

  // Boss add killed during active Boss encounter has a 25% chance to drop 1 life_seed at (enemy.x, enemy.y)
  if (!enemy.isBoss && !this.stressTestActive && this.getActiveBoss() !== null) {
    if (this.rng.chance(0.25)) {
      const addSeedAng = this.rng.nextFloat(-Math.PI, Math.PI);
      this.pickups.push(
        this.acquirePickup({
          id: ++this.nextEntityId,
          kind: 'life_seed',
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(addSeedAng) * 70,
          vy: Math.sin(addSeedAng) * 70,
          amount: 1,
          ttlSec: 18,
        }),
      );
    }
  }

  // When a Boss dies, also clean up any active boss clones/cores/prisons and purify Ashen Pacts
  if (enemy.isBoss) {
    purifyAshenPactsOnBossDefeated(this);
    this.blizzardVeilActive = false;
    for (let i = 0; i < this.enemies.length; i++) {
      const m = this.enemies[i]!;
      if (
        m.id !== enemy.id &&
        m.hp > 0 &&
        (m.defId === 'kryssa_clone' ||
          m.defId === 'ice_prison' ||
          m.defId === 'forge_energy_core')
      ) {
        m.hp = 0;
      }
    }
    for (let i = 0; i < allPlayers.length; i++) {
      const pl = allPlayers[i]!;
      pl.encasedInIceTimer = 0;
      pl.icePrisonId = 0;
    }
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
    for (let i = 0; i < allPlayers.length; i++) {
      const pl = allPlayers[i]!;
      if (pl.lifeState !== 'alive') continue;
      if (distance(enemy.x, enemy.y, pl.x, pl.y) <= blastR + pl.radius) {
        const ang = Math.atan2(pl.y - enemy.y, pl.x - enemy.x);
        this.applyDamageToPlayer(2, ang, 180, enemy.defId, pl);
      }
    }
  }

  // Elite Vengeful Death: 0.5s warning telegraph ring -> 8 slow radial projectiles
  if (!this.stressTestActive && enemy.isElite && enemy.eliteModifier === 'vengeful') {
    this.pendingVengefulRings.push({
      id: ++this.nextEntityId,
      ownerId: enemy.id,
      x: enemy.x,
      y: enemy.y,
      timerSec: 0.5,
      damage: Math.max(2, enemy.damage),
    });
    this.events.push({
      kind: 'vengeful_telegraph',
      enemyId: enemy.id,
      x: enemy.x,
      y: enemy.y,
      delaySec: 0.5,
    });
  }

  const isCoop = allPlayers.length > 1;
  const isSummonedSplit =
    enemy.defId === 'mini_slime' ||
    enemy.defId === 'kryssa_clone' ||
    enemy.defId === 'spore_guardian';

  // Ranger Skill (Mũi Tên Săn Mồi): Killing a Marked enemy spawns a Prey Emblem (Huy Hiệu Con Mồi)
  if (enemy.markedTimer > 0) {
    for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
      const pl = allPlayers[pIdx]!;
      const instAng = pIdx * 0.8;
      this.pickups.push(
        this.acquirePickup({
          id: ++this.nextEntityId,
          kind: 'prey_emblem',
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(instAng) * 95,
          vy: Math.sin(instAng) * 95,
          amount: 1,
          ttlSec: 14,
          ownerPlayerId: isCoop ? pl.id : undefined,
        }),
      );
    }
  }

  // Druid Passive (Hạt Giống Sự Sống): 15% chance (100% on Elite/Boss) to drop a healing Life Seed
  const hasDruid = allPlayers.some((p) => p.characterId === 'druid');
  if (hasDruid && (enemy.isBoss || enemy.isElite || this.rng.chance(0.15))) {
    const seedAng = this.rng.nextFloat(-Math.PI, Math.PI);
    this.pickups.push(
      this.acquirePickup({
        id: ++this.nextEntityId,
        kind: 'life_seed',
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(seedAng) * 75,
        vy: Math.sin(seedAng) * 75,
        amount: 1,
        ttlSec: 16,
      }),
    );
  }

  if (!isSummonedSplit) {
    const goldDrops: number[] = [];
    if (enemy.isBoss) {
      const totalGold = this.rng.nextInt(20, 25);
      const baseAmt = Math.floor(totalGold / 5);
      const rem = totalGold % 5;
      for (let k = 0; k < 5; k++) {
        goldDrops.push(baseAmt + (k < rem ? 1 : 0));
      }
    } else if (enemy.isElite) {
      const totalGold = this.rng.nextInt(6, 9);
      const half = Math.floor(totalGold / 2);
      goldDrops.push(half, totalGold - half);
    } else if (this.rng.chance(0.6)) {
      goldDrops.push(this.rng.nextInt(1, 2));
    }

    for (let k = 0; k < goldDrops.length; k++) {
      const coinAmt = goldDrops[k]!;
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
            amount: coinAmt,
            ttlSec: 14,
            ownerPlayerId: isCoop ? pl.id : undefined,
          }),
        );
      }
    }
  }
  if (!this.hasActiveCombatEnemies()) {
    despawnAshenExecutioners(this);
  }
}

export function applyElementStatusToEnemyImpl(
  this: WorldSim,
  enemy: SimEnemyState,
  element: ElementType,
  hitDamage: number,
  attackerPlayerId = this.player.id,
): void {
  this.applyElementAtWorldPoint(enemy.x, enemy.y, element, 26);

  if (!this.stressTestActive) {
    const primerId = enemy.lastElementOwnerId || attackerPlayerId;

    // Check 6 Elemental Reactions before applying the new status
    // 1. Vaporize (Hơi Nước): Burn + Chill/Frozen -> x2 burst damage + 3s Steam Blindness cloud
    if (
      (element === 'chill' && enemy.burnTimer > 0) ||
      (element === 'burn' && (enemy.chillTimer > 0 || enemy.frozenTimer > 0))
    ) {
      enemy.burnTimer = 0;
      enemy.chillTimer = 0;
      enemy.chillStacks = 0;
      enemy.frozenTimer = 0;
      enemy.steamBlindTimer = 3.0;
      for (let i = 0; i < this.enemies.length; i++) {
        const other = this.enemies[i]!;
        if (other.id === enemy.id || other.hp <= 0 || other.aiState === 'spawning') continue;
        if (distance(enemy.x, enemy.y, other.x, other.y) <= 75) {
          other.steamBlindTimer = Math.max(other.steamBlindTimer, 3.0);
        }
      }
      const vaporizeDmg = Math.max(12, Math.round(hitDamage * 1.4));
      this.triggerElementalReaction(enemy, 'vaporize', vaporizeDmg, primerId, attackerPlayerId);
      this.applyDotDamageToEnemy(enemy, vaporizeDmg, 'burn', false);
      enemy.lastElementOwnerId = 0;
      enemy.lastElementApplied = 'none';
      return;
    }

    // 2. Superconduct (Siêu Dẫn): Chill/Frozen + Shock -> Armor shred + -30% defense (+30% damage taken) for 6s
    if (
      (element === 'shock' && (enemy.chillTimer > 0 || enemy.frozenTimer > 0)) ||
      (element === 'chill' && enemy.shockTimer > 0)
    ) {
      enemy.chillTimer = 0;
      enemy.chillStacks = 0;
      enemy.frozenTimer = 0;
      enemy.shockTimer = 0;
      enemy.shieldArmor = 0;
      enemy.superconductTimer = 6.0;
      const scDmg = Math.max(8, Math.round(hitDamage * 0.75));
      this.triggerElementalReaction(enemy, 'superconduct', scDmg, primerId, attackerPlayerId);
      this.applyDotDamageToEnemy(enemy, scDmg, 'shock', false);
      enemy.lastElementOwnerId = 0;
      enemy.lastElementApplied = 'none';
      return;
    }

    // 3. Toxic Blast (Nổ Độc): Poison + Burn -> Detonate poison stacks AoE + spread 1 stack Poison
    if (
      (element === 'burn' && enemy.poisonTimer > 0) ||
      (element === 'poison' && enemy.burnTimer > 0)
    ) {
      const stacks = Math.max(1, enemy.poisonStacks);
      const blastDmg = Math.max(14, Math.round(hitDamage * 1.15 + stacks * 10));
      enemy.poisonTimer = 0;
      enemy.poisonStacks = 0;
      enemy.burnTimer = 0;
      this.triggerElementalReaction(enemy, 'toxic_blast', blastDmg, primerId, attackerPlayerId);
      this.applyDotDamageToEnemy(enemy, blastDmg, 'poison', false);
      for (let i = 0; i < this.enemies.length; i++) {
        const other = this.enemies[i]!;
        if (other.id === enemy.id || other.hp <= 0 || other.aiState === 'spawning') continue;
        if (distance(enemy.x, enemy.y, other.x, other.y) <= 96) {
          other.poisonStacks = Math.max(1, other.poisonStacks);
          other.poisonTimer = Math.max(other.poisonTimer, 4.0);
          other.poisonTickTimer = 0.6;
          this.applyDotDamageToEnemy(other, Math.round(blastDmg * 0.7), 'poison');
        }
      }
      enemy.lastElementOwnerId = 0;
      enemy.lastElementApplied = 'none';
      return;
    }

    // 4. Paralysis (Tê Liệt): Poison + Shock -> Stun 1.0s + interrupt Elite/Boss telegraph (except Boss Phase 3)
    if (
      (element === 'shock' && enemy.poisonTimer > 0) ||
      (element === 'poison' && enemy.shockTimer > 0)
    ) {
      enemy.poisonTimer = 0;
      enemy.poisonStacks = 0;
      enemy.shockTimer = 0;
      if (!(enemy.isBoss && enemy.bossPhase >= 3 && enemy.aiState === 'telegraph')) {
        enemy.aiState = 'stunned';
        enemy.stateTimer = Math.max(enemy.stateTimer, 1.0);
        enemy.vx = 0;
        enemy.vy = 0;
        enemy.bossBurrowed = false;
      }
      const paraDmg = Math.max(8, Math.round(hitDamage * 0.7));
      this.triggerElementalReaction(enemy, 'paralysis', paraDmg, primerId, attackerPlayerId);
      this.applyDotDamageToEnemy(enemy, paraDmg, 'shock', false);
      enemy.lastElementOwnerId = 0;
      enemy.lastElementApplied = 'none';
      return;
    }

    // 5. Overload (Quá Tải): Burn + Shock -> Explosive shockwave AoE + heavy knockback + shield break
    if (
      (element === 'shock' && enemy.burnTimer > 0) ||
      (element === 'burn' && enemy.shockTimer > 0)
    ) {
      enemy.burnTimer = 0;
      enemy.shockTimer = 0;
      const overloadDmg = Math.max(14, Math.round(hitDamage * 1.35));
      this.triggerElementalReaction(enemy, 'overload', overloadDmg, primerId, attackerPlayerId);
      enemy.shieldArmor = 0;
      this.applyDotDamageToEnemy(enemy, overloadDmg, 'burn', false);
      for (let i = 0; i < this.enemies.length; i++) {
        const other = this.enemies[i]!;
        if (other.id === enemy.id || other.hp <= 0 || other.aiState === 'spawning') continue;
        if (distance(enemy.x, enemy.y, other.x, other.y) <= 92) {
          const pushAng = Math.atan2(other.y - enemy.y, other.x - enemy.x);
          other.kbVx += Math.cos(pushAng) * 260;
          other.kbVy += Math.sin(pushAng) * 260;
          other.shieldArmor = 0;
          this.applyDotDamageToEnemy(other, Math.round(overloadDmg * 0.75), 'shock');
        }
      }
      enemy.lastElementOwnerId = 0;
      enemy.lastElementApplied = 'none';
      return;
    }
  }

  enemy.lastElementOwnerId = attackerPlayerId;
  enemy.lastElementApplied = element;

  switch (element) {
    case 'burn': {
      if (enemy.burnTimer <= 0) enemy.burnTickTimer = 0.5;
      enemy.burnTimer = 3.0;
      enemy.burnStacks = 1;
      if (!this.stressTestActive) {
        this.events.push({ kind: 'status_applied', targetId: enemy.id, status: 'burn', x: enemy.x, y: enemy.y });
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
          if (enemy.isBoss) {
            if ((enemy.bossFreezeDrTimer ?? 0) <= 0) enemy.bossFreezeCountWindow = 0;
            enemy.bossFreezeDrTimer = 8.0;
            const count = enemy.bossFreezeCountWindow ?? 0;
            enemy.frozenTimer = count === 0 ? 0.6 : count === 1 ? 0.3 : 0.15;
            enemy.bossFreezeCountWindow = count + 1;
          } else {
            enemy.frozenTimer = 1.5;
          }
          enemy.vx = 0;
          enemy.vy = 0;
          if (!this.stressTestActive) {
            this.events.push({ kind: 'status_applied', targetId: enemy.id, status: 'frozen', x: enemy.x, y: enemy.y });
          }
        } else if (!this.stressTestActive) {
          this.events.push({ kind: 'status_applied', targetId: enemy.id, status: 'chill', x: enemy.x, y: enemy.y });
        }
      }
      break;
    }
    case 'shock': {
      enemy.shockTimer = 0.6;
      if (!this.stressTestActive) {
        this.events.push({ kind: 'status_applied', targetId: enemy.id, status: 'shock', x: enemy.x, y: enemy.y });
      }
      const maxChains = 2;
      const chainDmg = Math.max(2, Math.round(hitDamage * 0.5));
      let chained = 0;
      for (let i = 0; i < this.enemies.length && chained < maxChains; i++) {
        const other = this.enemies[i]!;
        if (other.id === enemy.id || other.hp <= 0 || other.aiState === 'spawning') continue;
        if (distance(enemy.x, enemy.y, other.x, other.y) <= 115) {
          chained += 1;
          other.shockTimer = 0.5;
          this.applyDotDamageToEnemy(other, chainDmg, 'shock');
          if (!this.stressTestActive) {
            this.events.push({ kind: 'chain_lightning', fromX: enemy.x, fromY: enemy.y, toX: other.x, toY: other.y });
          }
        }
      }
      break;
    }
    case 'poison': {
      if (enemy.poisonTimer <= 0) enemy.poisonTickTimer = 0.6;
      enemy.poisonStacks = Math.min(3, enemy.poisonStacks + 1);
      enemy.poisonTimer = 4.0;
      if (!this.stressTestActive) {
        this.events.push({ kind: 'status_applied', targetId: enemy.id, status: 'poison', x: enemy.x, y: enemy.y });
      }
      break;
    }
  }
}

export function applyDamageToPlayerImpl(
  this: WorldSim,
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
  const prevArmor = p.armor;
  const prevHp = p.hp;
  const armorAbsorbed = Math.min(p.armor, dmg);
  const hpDamage = dmg - armorAbsorbed;

  p.armor -= armorAbsorbed;
  p.hp = Math.max(0, p.hp - hpDamage);
  p.statsDamageTaken = (p.statsDamageTaken ?? 0) + dmg;
  if ((prevArmor > p.armor || prevHp > p.hp) && !this.inHub && !this.getCurrentRoom().cleared) {
    p.tookDamageInCurrentRoom = true;
  }

  if (prevArmor > 0 && p.armor === 0) {
    this.events.push({
      kind: 'armor_broken',
      targetKind: 'player',
      targetId: p.id,
      playerId: p.id,
      x: p.x,
      y: p.y,
    });
  }

  const isDotTick =
    _sourceId === 'burn' || _sourceId === 'poison' || _sourceId === 'electrified_water';
  if (isDotTick) {
    p.armorRegenTimer = Math.max(p.armorRegenTimer, 0.8);
  } else {
    p.armorRegenTimer = p.armorRegenDelaySec;
    p.armorRegenAccum = 0;
  }
  p.hurtFlashTimer = 0.16;
  p.invulnerableTimer = isDotTick ? Math.max(p.invulnerableTimer, 0.3) : 0.35;

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
    if (this.inHub || this.autoRevivePlayer) {
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
