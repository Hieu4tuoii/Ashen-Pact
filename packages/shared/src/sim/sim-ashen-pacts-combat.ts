import { scaleRelicDamage } from '../data/ashen-pacts.js';
import type { WeaponRarity } from '../data/types.js';
import {
  MAX_MUTATORS_PER_WEAPON_SLOT,
  getCompatibleWeaponMutators,
} from '../data/weapon-mutators.js';
import { ALL_WEAPON_IDS, WEAPONS } from '../data/weapons.js';
import { clamp, distance } from '../math/vec2.js';
import { TILE_SIZE } from '../protocol/messages.js';
import { findNearestWalkablePoint } from './arena-room-archetypes.js';
import { equipPlayerWeaponSlot } from './sim-weapon-cadence.js';
import type { WorldSim } from './world-sim.js';
import type { SimEnemyState, SimPlayerState } from './world-sim-types.js';

export const VOLATILE_ARSENAL_BOSS_MORPH_INTERVAL_SEC = 20.0;
export const VOLATILE_ARSENAL_KEEP_MORPHED_WINDOW_SEC = 5.0;

export const ASHEN_EXECUTIONER_BASE_SPEED = 98;
export const ASHEN_EXECUTIONER_COOP_SPEED_MULT = 1.2;
export const ASHEN_EXECUTIONER_TARGET_SWITCH_SEC = 6.0;
export const ASHEN_EXECUTIONER_WAVE_COOLDOWN_SEC = 2.4;
export const ASHEN_EXECUTIONER_TELEGRAPH_SEC = 0.45;
export const ASHEN_EXECUTIONER_WAVE_SPEED = 340;
export const ASHEN_EXECUTIONER_WAVE_DAMAGE = 2;

export const EXECUTIONER_SCYTHE_RADIUS = 96;
export const EXECUTIONER_SCYTHE_BASE_DAMAGE = 45;
export const EXECUTIONER_SCYTHE_ICD_SEC = 4.0;
export const EXECUTIONER_SCYTHE_EXECUTE_THRESHOLD = 0.2;

export function getVolatileArsenalRarityPool(biome: 1 | 2 | 3): readonly WeaponRarity[] {
  if (biome === 1) return ['common', 'uncommon', 'rare'];
  if (biome === 2) return ['uncommon', 'rare', 'epic'];
  return ['rare', 'epic', 'legendary'];
}

export function morphPlayerVolatileArsenalWeapon(
  sim: WorldSim,
  player: SimPlayerState,
): string | null {
  if (player.lifeState !== 'alive' || player.hp <= 0) return null;
  if (player.activePactId !== 'pact_volatile_arsenal') return null;

  const slot = player.pactVolatileSlot ?? player.activeWeaponSlot ?? 0;
  const currentWeaponId = player.weaponSlots[slot] ?? player.weaponSlots[0] ?? 'rivet_gun';
  const allowedRarities = getVolatileArsenalRarityPool(sim.currentBiome);

  const candidates = ALL_WEAPON_IDS.filter((id) => {
    const def = WEAPONS[id];
    if (!def) return false;
    return id !== currentWeaponId && allowedRarities.includes(def.rarity);
  });

  if (candidates.length === 0) return currentWeaponId;
  const nextWeaponId = sim.rng.pick(candidates);
  equipPlayerWeaponSlot(player, slot, nextWeaponId);
  return nextWeaponId;
}

export function morphAllVolatileArsenalPlayers(sim: WorldSim): void {
  for (const p of sim.getAllPlayers()) {
    if (p.lifeState === 'alive' && p.hp > 0 && p.activePactId === 'pact_volatile_arsenal') {
      morphPlayerVolatileArsenalWeapon(sim, p);
    }
  }
}

export function purifyVolatileArsenalIntoMasterForgeSeal(
  sim: WorldSim,
  p: SimPlayerState,
): void {
  const slot = p.pactVolatileSlot ?? p.activeWeaponSlot ?? 0;
  const currentMorphedId = p.weaponSlots[slot] ?? null;
  const restoredId = p.pactOriginalWeaponId ?? currentMorphedId ?? 'rivet_gun';

  if (currentMorphedId && currentMorphedId !== restoredId) {
    p.pactKeepMorphedWeaponId = currentMorphedId;
    p.pactKeepMorphedTimer = VOLATILE_ARSENAL_KEEP_MORPHED_WINDOW_SEC;
  } else {
    p.pactKeepMorphedWeaponId = null;
    p.pactKeepMorphedTimer = 0;
  }

  equipPlayerWeaponSlot(p, slot, restoredId);

  p.weaponUpgradeLevels ??= { 0: 0, 1: 0 };
  p.weaponUpgradeLevels[slot] = Math.min(3, (p.weaponUpgradeLevels[slot] ?? 0) + 1);

  p.weaponMutators ??= { 0: [], 1: [] };
  const slotMutators = (p.weaponMutators[slot] ??= []);
  if (slotMutators.length < MAX_MUTATORS_PER_WEAPON_SLOT) {
    const compatible = getCompatibleWeaponMutators(restoredId, slotMutators);
    if (compatible.length > 0) {
      slotMutators.push(sim.rng.pick(compatible));
    }
  }

  p.volatileArsenalBossTimer = 0;
  p.pactOriginalWeaponId = null;
}

export function tryKeepVolatileMorphedWeaponOnInteract(p: SimPlayerState): boolean {
  if ((p.pactKeepMorphedTimer ?? 0) <= 0 || !p.pactKeepMorphedWeaponId) return false;
  const slot = p.pactVolatileSlot ?? p.activeWeaponSlot ?? 0;
  equipPlayerWeaponSlot(p, slot, p.pactKeepMorphedWeaponId);
  p.pactKeepMorphedWeaponId = null;
  p.pactKeepMorphedTimer = 0;
  return true;
}

export function despawnAshenExecutioners(sim: WorldSim): void {
  for (let i = sim.enemies.length - 1; i >= 0; i--) {
    if (sim.enemies[i]!.defId === 'ashen_executioner') {
      sim.enemies.splice(i, 1);
    }
  }
}

export function syncAshenExecutionerInRoom(sim: WorldSim): SimEnemyState | null {
  let anyHunted =
    sim.player.lifeState === 'alive' &&
    sim.player.hp > 0 &&
    sim.player.activePactId === 'pact_ashen_hunted';
  if (!anyHunted) {
    for (let i = 0; i < sim.simulatedPlayers.length; i++) {
      const sp = sim.simulatedPlayers[i]!;
      if (sp.lifeState === 'alive' && sp.hp > 0 && sp.activePactId === 'pact_ashen_hunted') {
        anyHunted = true;
        break;
      }
    }
  }
  let hasExistingExec = false;
  for (let i = 0; i < sim.enemies.length; i++) {
    if (sim.enemies[i]!.defId === 'ashen_executioner') {
      hasExistingExec = true;
      break;
    }
  }
  if (!anyHunted && !hasExistingExec) {
    return null;
  }

  const room = sim.getCurrentRoom();
  const huntedPlayers = sim
    .getAllPlayers()
    .filter((pl) => pl.lifeState === 'alive' && pl.hp > 0 && pl.activePactId === 'pact_ashen_hunted');

  const isCombatRoom =
    !room.cleared &&
    (room.type === 'combat' || room.type === 'portal' || room.type === 'boss');
  const hasRealCombatThreat =
    sim.hasActiveCombatEnemies() || (room.wavesTotal > 0 && room.wavesSpawned < room.wavesTotal);

  if (!isCombatRoom || !hasRealCombatThreat || huntedPlayers.length === 0) {
    despawnAshenExecutioners(sim);
    return null;
  }

  let primaryExec: SimEnemyState | null = null;
  for (let i = sim.enemies.length - 1; i >= 0; i--) {
    const e = sim.enemies[i]!;
    if (e.defId === 'ashen_executioner') {
      if (!primaryExec) {
        primaryExec = e;
      } else {
        sim.enemies.splice(i, 1);
      }
    }
  }

  if (primaryExec) {
    primaryExec.hp = 9999;
    primaryExec.maxHp = 9999;
    return primaryExec;
  }

  const anchor = huntedPlayers[0]!;
  const rawSpawnX = clamp(
    anchor.x + (anchor.x > sim.map.width * 0.5 ? -180 : 180),
    64,
    sim.map.width - 64,
  );
  const rawSpawnY = clamp(
    anchor.y + (anchor.y > sim.map.height * 0.5 ? -140 : 140),
    64,
    sim.map.height - 64,
  );
  const safeSpawn = findNearestWalkablePoint(sim.map, rawSpawnX, rawSpawnY, 18, sim.props);

  const exec = sim.spawnEnemy('ashen_executioner', safeSpawn.x, safeSpawn.y, true);
  exec.hp = 9999;
  exec.maxHp = 9999;
  exec.isElite = false;
  exec.eliteModifier = null;
  exec.shieldArmor = 0;
  exec.maxShieldArmor = 0;
  exec.aiState = 'chase';
  exec.stateTimer = 0;
  exec.attackCooldownTimer =
    ASHEN_EXECUTIONER_WAVE_COOLDOWN_SEC - ASHEN_EXECUTIONER_TELEGRAPH_SEC;
  exec.executionerTargetPlayerId = anchor.id;
  exec.executionerTargetSwitchTimer = 0;
  exec.moveSpeed =
    huntedPlayers.length >= 2
      ? ASHEN_EXECUTIONER_BASE_SPEED * ASHEN_EXECUTIONER_COOP_SPEED_MULT
      : ASHEN_EXECUTIONER_BASE_SPEED;
  return exec;
}

export function updateAshenExecutionerAI(
  sim: WorldSim,
  e: SimEnemyState,
  dtSec: number,
): void {
  e.hp = 9999;
  e.maxHp = 9999;
  e.stunTimer = 0;
  e.frozenTimer = 0;
  e.rootedTimer = 0;
  e.rootTimer = 0;
  e.chillTimer = 0;
  e.chillStacks = 0;
  e.kbVx = 0;
  e.kbVy = 0;

  const huntedPlayers = sim
    .getAllPlayers()
    .filter((pl) => pl.lifeState === 'alive' && pl.hp > 0 && pl.activePactId === 'pact_ashen_hunted');

  if (huntedPlayers.length === 0 || !sim.hasActiveCombatEnemies()) {
    despawnAshenExecutioners(sim);
    return;
  }

  e.moveSpeed =
    huntedPlayers.length >= 2
      ? ASHEN_EXECUTIONER_BASE_SPEED * ASHEN_EXECUTIONER_COOP_SPEED_MULT
      : ASHEN_EXECUTIONER_BASE_SPEED;

  let target = huntedPlayers.find((pl) => pl.id === e.executionerTargetPlayerId);
  if (!target) {
    target = huntedPlayers[0]!;
    e.executionerTargetPlayerId = target.id;
    e.executionerTargetSwitchTimer = 0;
  } else if (huntedPlayers.length >= 2) {
    e.executionerTargetSwitchTimer = (e.executionerTargetSwitchTimer ?? 0) + dtSec;
    if (e.executionerTargetSwitchTimer >= ASHEN_EXECUTIONER_TARGET_SWITCH_SEC) {
      e.executionerTargetSwitchTimer -= ASHEN_EXECUTIONER_TARGET_SWITCH_SEC;
      const curIdx = huntedPlayers.findIndex((pl) => pl.id === target!.id);
      const nextPlayer = huntedPlayers[(curIdx + 1) % huntedPlayers.length]!;
      target = nextPlayer;
      e.executionerTargetPlayerId = nextPlayer.id;
    }
  }

  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy);
  const ang = dist > 0.001 ? Math.atan2(dy, dx) : e.aimAngle;
  e.aimAngle = ang;
  e.vx = dist > 4 ? Math.cos(ang) * e.moveSpeed : 0;
  e.vy = dist > 4 ? Math.sin(ang) * e.moveSpeed : 0;
  e.x = clamp(e.x + e.vx * dtSec, e.radius, sim.map.width - e.radius);
  e.y = clamp(e.y + e.vy * dtSec, e.radius, sim.map.height - e.radius);

  if (dist <= e.radius + target.radius) {
    sim.applyDamageToPlayer(e.damage, ang, 160, 'ashen_executioner', target);
  }

  if (e.aiState === 'telegraph') {
    e.stateTimer -= dtSec;
    e.telegraphAngle = ang;
    if (e.stateTimer <= 0) {
      e.aiState = 'chase';
      e.attackCooldownTimer =
        ASHEN_EXECUTIONER_WAVE_COOLDOWN_SEC - ASHEN_EXECUTIONER_TELEGRAPH_SEC;
      let waveX = e.x;
      let waveY = e.y;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      const muzzleDist = e.radius + 4;
      if (
        sim.map.isSolidTile(Math.floor(waveX / TILE_SIZE), Math.floor(waveY / TILE_SIZE)) ||
        sim.map.checkProjectileWallHit(waveX + cosA * muzzleDist, waveY + sinA * muzzleDist, 10).hit
      ) {
        let cleared = false;
        for (let step = 1; step <= 4; step++) {
          const testX = e.x + cosA * (step * 16);
          const testY = e.y + sinA * (step * 16);
          const muzX = testX + cosA * muzzleDist;
          const muzY = testY + sinA * muzzleDist;
          if (
            !sim.map.isSolidTile(Math.floor(muzX / TILE_SIZE), Math.floor(muzY / TILE_SIZE)) &&
            !sim.map.checkProjectileWallHit(muzX, muzY, 10).hit
          ) {
            waveX = testX;
            waveY = testY;
            cleared = true;
            break;
          }
        }
        if (!cleared) {
          const safeWavePt = findNearestWalkablePoint(sim.map, e.x, e.y, 12);
          waveX = safeWavePt.x;
          waveY = safeWavePt.y;
        }
      }
      sim.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: sim.tick,
        ownerId: e.id,
        team: 'enemy',
        weaponId: 'ashen_executioner_wave',
        x: waveX,
        y: waveY,
        angle: ang,
        pelletCount: 1,
        spreadRad: 0,
        muzzleOffset: muzzleDist,
        speed: ASHEN_EXECUTIONER_WAVE_SPEED,
        damage: ASHEN_EXECUTIONER_WAVE_DAMAGE,
        radius: 10,
        knockback: 90,
        pierceCount: 99,
        bounceCount: 0,
        ttlSec: 2.0,
        element: 'burn',
        critChance: 0,
        amplifiedByShield: false,
        seed: (sim.rng.nextUint32() & 0xffff) >>> 0,
      });
    }
  } else {
    e.attackCooldownTimer = Math.max(0, e.attackCooldownTimer - dtSec);
    if (e.attackCooldownTimer <= 0) {
      e.aiState = 'telegraph';
      e.stateTimer = ASHEN_EXECUTIONER_TELEGRAPH_SEC;
      e.telegraphDurationSec = ASHEN_EXECUTIONER_TELEGRAPH_SEC;
      e.telegraphAngle = ang;
      e.telegraphRadius = 14;
      e.telegraphLength = 260;
      sim.events.push({
        kind: 'enemy_telegraph',
        enemyId: e.id,
        defId: e.defId,
        x: e.x,
        y: e.y,
        angle: ang,
        radius: 14,
        durationSec: ASHEN_EXECUTIONER_TELEGRAPH_SEC,
      });
    }
  }
}

export function tryTriggerExecutionerScytheSlash(
  sim: WorldSim,
  player: SimPlayerState | undefined | null,
  centerX?: number,
  centerY?: number,
): boolean {
  if (!player || player.lifeState !== 'alive' || player.hp <= 0) return false;
  if (!Array.isArray(player.awakenedRelicIds) || !player.awakenedRelicIds.includes('relic_executioner_scythe')) {
    return false;
  }
  if ((player.executionerScytheIcdTimer ?? 0) > 0) return false;

  player.executionerScytheIcdTimer = EXECUTIONER_SCYTHE_ICD_SEC;

  let cx = centerX;
  let cy = centerY;
  if (cx === undefined || cy === undefined) {
    let bestEnemy: SimEnemyState | null = null;
    let bestDist = 220;
    for (const e of sim.enemies) {
      if (e.hp <= 0 || e.isDummy || e.defId === 'ashen_executioner') continue;
      const d = distance(player.x, player.y, e.x, e.y);
      if (d <= bestDist) {
        bestDist = d;
        bestEnemy = e;
      }
    }
    if (bestEnemy) {
      cx = bestEnemy.x;
      cy = bestEnemy.y;
    } else {
      cx = player.x + Math.cos(player.aimAngle) * 56;
      cy = player.y + Math.sin(player.aimAngle) * 56;
    }
  }

  const dmg = scaleRelicDamage(EXECUTIONER_SCYTHE_BASE_DAMAGE, sim.currentFloor);
  sim.events.push({
    kind: 'explosion',
    x: cx,
    y: cy,
    radius: EXECUTIONER_SCYTHE_RADIUS,
    damage: dmg,
    sourceDefId: 'relic_executioner_scythe',
  });

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.defId === 'ashen_executioner' || e.aiState === 'spawning') continue;
    if (distance(cx, cy, e.x, e.y) > EXECUTIONER_SCYTHE_RADIUS + e.radius) continue;

    const hitAngle = Math.atan2(e.y - cy, e.x - cx);
    const canExecute = !e.isBoss && !e.isElite && !e.isDummy;
    const preHitLowHp = canExecute && e.hp <= e.maxHp * EXECUTIONER_SCYTHE_EXECUTE_THRESHOLD;

    if (preHitLowHp) {
      e.shieldArmor = 0;
      const execDmg = Math.max(dmg, e.hp);
      sim.applyDamageToEnemy(e, execDmg, true, 'burn', hitAngle, 140, true, player.id);
      if (e.hp > 0) {
        e.hp = 0;
        sim.handleEnemyKilled(e, player.id);
      }
      continue;
    }

    sim.applyDamageToEnemy(e, dmg, false, 'burn', hitAngle, 120, true, player.id);
    if (e.hp > 0 && canExecute && e.hp <= e.maxHp * EXECUTIONER_SCYTHE_EXECUTE_THRESHOLD) {
      e.shieldArmor = 0;
      e.hp = 0;
      sim.handleEnemyKilled(e, player.id);
    }
  }

  return true;
}

export function applyRicochetVowOrGeometryEyeDamageMultiplier(
  owner: SimPlayerState | undefined | null,
  baseDamage: number,
  bouncesDone: number,
): number {
  if (!owner) return baseDamage;
  if (owner.activePactId === 'pact_ricochet_vow') {
    return bouncesDone >= 1
      ? Math.max(1, Math.round(baseDamage * 1.7))
      : Math.max(1, Math.round(baseDamage * 0.65));
  }
  if (
    Array.isArray(owner.awakenedRelicIds) &&
    owner.awakenedRelicIds.includes('relic_ancient_geometry_eye')
  ) {
    return bouncesDone >= 1
      ? Math.max(1, Math.round(baseDamage * 1.55))
      : Math.max(1, Math.round(baseDamage * 0.9));
  }
  return baseDamage;
}

export function applyRicochetVowOrGeometryEyeWallSlamBonus(
  owner: SimPlayerState | undefined | null,
  baseSlamDamage: number,
): number {
  if (!owner) return baseSlamDamage;
  if (owner.activePactId === 'pact_ricochet_vow') {
    return Math.max(1, Math.round(baseSlamDamage * 1.7));
  }
  if (
    Array.isArray(owner.awakenedRelicIds) &&
    owner.awakenedRelicIds.includes('relic_ancient_geometry_eye')
  ) {
    return Math.max(1, Math.round(baseSlamDamage * 1.35));
  }
  return baseSlamDamage;
}

export function applyRicochetVowTacticalPropBonus(
  owner: SimPlayerState | undefined | null,
  basePropDamage: number,
): number {
  if (!owner) return basePropDamage;
  if (owner.activePactId === 'pact_ricochet_vow') {
    return Math.max(1, Math.round(basePropDamage * 1.7));
  }
  return basePropDamage;
}
