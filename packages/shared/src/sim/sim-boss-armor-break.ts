import { distance } from '../math/vec2.js';
import { TILE_SIZE } from '../protocol/messages.js';
import {
  applyRicochetVowOrGeometryEyeWallSlamBonus,
  tryTriggerExecutionerScytheSlash,
} from './sim-ashen-pacts.js';
import {
  TABLE_TECH_BILLIARD_SLAM_DMG_MULT,
  triggerTableTechOnWallSlamOrStagger,
} from './sim-blessings.js';
import { triggerBiome2WallSlamCryoPulse } from './sim-tactical-physics-p1c.js';
import { computeWallSlamDamage, isFlippableBarricadeProp } from './sim-tactical-physics.js';
import {
  hasPlayerBlessing,
  type PropKind,
  type SimEnemyState,
  type SimPlayerState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const BOSS_SUPPLY_DROP_INTERVAL_SEC = 18.0;
export const BOSS_SUPPLY_DROP_TELEGRAPH_SEC = 0.6;
export const BOSS_MIN_BARRICADES = 3;
export const BOSS_MIN_BIOME_TOYS = 2;
export const BOSS_SUPPLY_DROP_RING_RADIUS = 26;

export const BOSS_STAGGER_MAX = 100;
export const BOSS_STAGGER_PROP_KICK_BONUS = 50;
export const BOSS_STAGGER_COOLDOWN_SEC = 6.0;
export const BOSS_STAGGER_FLINCH_SEC = 0.5;

export function isBossBiomeToyProp(kind: PropKind): boolean {
  return (
    kind === 'volatile_spore_pod' ||
    kind === 'sliding_ice_block' ||
    kind === 'coal_bomb' ||
    kind === 'slag_crucible'
  );
}

export function getBossSupplyDropPropKinds(
  sim: Pick<WorldSim, 'currentBiome'>,
  boss?: Pick<SimEnemyState, 'defId'> | null,
): { barricadeKind: PropKind; toyKinds: readonly PropKind[] } {
  const defId = boss?.defId;
  if (defId === 'kryssa_ice_queen' || (!defId && sim.currentBiome === 2)) {
    return {
      barricadeKind: 'glacial_barricade',
      toyKinds: ['sliding_ice_block'],
    };
  }
  if (defId === 'forge_titan' || (!defId && sim.currentBiome === 3)) {
    return {
      barricadeKind: 'forge_blast_shield',
      toyKinds: ['coal_bomb', 'slag_crucible'],
    };
  }
  return {
    barricadeKind: 'moss_table',
    toyKinds: ['volatile_spore_pod'],
  };
}

function isIntactBossRoomProp(prop: {
  hp: number;
  state?: string;
  coverState?: string;
}): boolean {
  return (
    prop.hp > 0 &&
    prop.state !== 'broken' &&
    prop.coverState !== 'fallen' &&
    prop.coverState !== 'sliding'
  );
}

function findBossSupplyDropPosition(
  sim: WorldSim,
  dropIndex: number,
): { x: number; y: number } {
  const cx = sim.map.width * 0.5;
  const cy = sim.map.height * 0.5;
  const radii = [145, 175, 125, 195, 160] as const;
  const angleSteps = 16;
  const alivePlayers = sim.getAllPlayers().filter((p) => p.lifeState === 'alive' && p.hp > 0);

  for (let rIdx = 0; rIdx < radii.length; rIdx++) {
    const r = radii[(rIdx + dropIndex) % radii.length]!;
    for (let aIdx = 0; aIdx < angleSteps; aIdx++) {
      const ang =
        ((aIdx + dropIndex * 3 + rIdx * 2) % angleSteps) *
        ((Math.PI * 2) / angleSteps);
      const candX = Math.round(cx + Math.cos(ang) * r);
      const candY = Math.round(cy + Math.sin(ang) * r);
      const distCenter = Math.hypot(candX - cx, candY - cy);
      if (distCenter < 110 || distCenter > 210) continue;

      const tx = Math.floor(candX / TILE_SIZE);
      const ty = Math.floor(candY / TILE_SIZE);
      if (
        tx <= 1 ||
        ty <= 1 ||
        tx >= sim.map.cols - 2 ||
        ty >= sim.map.rows - 2 ||
        sim.map.isSolidTile(tx, ty) ||
        sim.map.getSurface(tx, ty) === 'chasm' ||
        sim.map.checkProjectileWallHit(candX, candY, 20).hit
      ) {
        continue;
      }

      let blocked = false;
      for (let i = 0; i < alivePlayers.length; i++) {
        const pl = alivePlayers[i]!;
        if (distance(candX, candY, pl.x, pl.y) < pl.radius + 30) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      for (let i = 0; i < sim.props.length; i++) {
        const prop = sim.props[i]!;
        if (prop.hp <= 0) continue;
        if (distance(candX, candY, prop.x, prop.y) < prop.radius + 26) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      for (let i = 0; i < sim.pendingBossSupplyDrops.length; i++) {
        const pend = sim.pendingBossSupplyDrops[i]!;
        if (distance(candX, candY, pend.x, pend.y) < 44) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        return { x: candX, y: candY };
      }
    }
  }

  const fallbackAng = (dropIndex * Math.PI * 0.5) % (Math.PI * 2);
  return {
    x: Math.round(cx + Math.cos(fallbackAng) * 150),
    y: Math.round(cy + Math.sin(fallbackAng) * 150),
  };
}

export function triggerBossPhaseSupplyDrop(
  sim: WorldSim,
  boss?: SimEnemyState | null,
): number {
  const activeBoss = boss ?? sim.getActiveBoss();
  if (!activeBoss || !activeBoss.isBoss || activeBoss.hp <= 0) {
    return 0;
  }

  const { barricadeKind, toyKinds } = getBossSupplyDropPropKinds(sim, activeBoss);
  let barricadeCount = 0;
  let toyCount = 0;
  let coalBombCount = 0;

  for (let i = 0; i < sim.props.length; i++) {
    const p = sim.props[i]!;
    if (!isIntactBossRoomProp(p)) continue;
    if (isFlippableBarricadeProp(p.kind)) {
      barricadeCount += 1;
    } else if (isBossBiomeToyProp(p.kind)) {
      toyCount += 1;
      if (p.kind === 'coal_bomb') coalBombCount += 1;
    }
  }

  for (let i = 0; i < sim.pendingBossSupplyDrops.length; i++) {
    const d = sim.pendingBossSupplyDrops[i]!;
    if (isFlippableBarricadeProp(d.propKind)) {
      barricadeCount += 1;
    } else if (isBossBiomeToyProp(d.propKind)) {
      toyCount += 1;
      if (d.propKind === 'coal_bomb') coalBombCount += 1;
    }
  }

  let spawnedDrops = 0;
  const missingBarricades = Math.max(0, BOSS_MIN_BARRICADES - barricadeCount);
  for (let i = 0; i < missingBarricades; i++) {
    const pos = findBossSupplyDropPosition(sim, spawnedDrops);
    sim.pendingBossSupplyDrops.push({
      id: ++sim.nextEntityId,
      x: pos.x,
      y: pos.y,
      propKind: barricadeKind,
      timer: BOSS_SUPPLY_DROP_TELEGRAPH_SEC,
      maxTimer: BOSS_SUPPLY_DROP_TELEGRAPH_SEC,
      radius: BOSS_SUPPLY_DROP_RING_RADIUS,
    });
    spawnedDrops += 1;
  }

  const missingToys = Math.max(0, BOSS_MIN_BIOME_TOYS - toyCount);
  for (let i = 0; i < missingToys; i++) {
    const pos = findBossSupplyDropPosition(sim, spawnedDrops);
    let toyKind = toyKinds[i % toyKinds.length]!;
    if (toyKinds.length > 1) {
      toyKind = coalBombCount === 0 ? 'coal_bomb' : 'slag_crucible';
      if (toyKind === 'coal_bomb') coalBombCount += 1;
    }
    sim.pendingBossSupplyDrops.push({
      id: ++sim.nextEntityId,
      x: pos.x,
      y: pos.y,
      propKind: toyKind,
      timer: BOSS_SUPPLY_DROP_TELEGRAPH_SEC,
      maxTimer: BOSS_SUPPLY_DROP_TELEGRAPH_SEC,
      radius: BOSS_SUPPLY_DROP_RING_RADIUS,
    });
    spawnedDrops += 1;
  }

  return spawnedDrops;
}

export function stepBossSupplyDropsAndStagger(sim: WorldSim, dtSec: number): void {
  if (sim.pendingBossSupplyDrops.length > 0) {
    const activeBoss = sim.getActiveBoss();
    let writeIdx = 0;
    for (let i = 0; i < sim.pendingBossSupplyDrops.length; i++) {
      const drop = sim.pendingBossSupplyDrops[i]!;
      drop.timer -= dtSec;
      if (drop.timer > 1e-6) {
        sim.pendingBossSupplyDrops[writeIdx++] = drop;
      } else {
        for (let pIdx = sim.props.length - 1; pIdx >= 0; pIdx--) {
          const existing = sim.props[pIdx]!;
          if (existing.hp <= 0 || existing.state === 'broken' || existing.coverState === 'fallen') {
            sim.props.splice(pIdx, 1);
          }
        }
        const landed = sim.spawnProp(drop.propKind, drop.x, drop.y);
        landed.lastCombatText = 'SUPPLY DROP!';
        if (activeBoss) {
          activeBoss.lastCombatText = 'SUPPLY DROP!';
        }
      }
    }
    sim.pendingBossSupplyDrops.length = writeIdx;
  }

  if (sim.stressTestActive || sim.inHub) return;

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (!e.isBoss || e.hp <= 0) continue;

    if ((e.bossStaggerCooldownTimer ?? 0) > 0) {
      const nextCd = (e.bossStaggerCooldownTimer ?? 0) - dtSec;
      e.bossStaggerCooldownTimer = nextCd <= 1e-6 ? 0 : nextCd;
    }

    if (e.supplyDropTimer === undefined) {
      e.supplyDropTimer = BOSS_SUPPLY_DROP_INTERVAL_SEC;
    }
    e.supplyDropTimer -= dtSec;
    if (e.supplyDropTimer <= 1e-6) {
      e.supplyDropTimer = BOSS_SUPPLY_DROP_INTERVAL_SEC;
      triggerBossPhaseSupplyDrop(sim, e);
    }
  }
}

function resolveAttackerPlayer(
  sim: WorldSim,
  enemy: SimEnemyState,
  attacker?: SimPlayerState | number,
): SimPlayerState {
  if (attacker && typeof attacker === 'object') {
    return attacker;
  }
  const pid = typeof attacker === 'number' ? attacker : (enemy.lastHitPlayerId ?? sim.player.id);
  return sim.getPlayerById(pid) ?? sim.player;
}

export function onEnemyWallSlammed(
  sim: WorldSim,
  enemy: SimEnemyState,
  attacker?: SimPlayerState | number,
  shattered = false,
): void {
  const attackerPlayer = resolveAttackerPlayer(sim, enemy, attacker);
  triggerBiome2WallSlamCryoPulse(sim, enemy, attackerPlayer.id);
  triggerTableTechOnWallSlamOrStagger(
    sim,
    attackerPlayer,
    enemy.x,
    enemy.y,
    shattered ? enemy.id : undefined,
    enemy.id,
  );
  tryTriggerExecutionerScytheSlash(sim, attackerPlayer, enemy.x, enemy.y);
}

export function triggerBossInPlaceWallSlam(
  sim: WorldSim,
  boss: SimEnemyState,
  attacker?: SimPlayerState | number,
): boolean {
  if (!boss.isBoss || boss.hp <= 0) return false;

  const attackerPlayer = resolveAttackerPlayer(sim, boss, attacker);
  boss.bossStaggerAccum = 0;
  boss.bossStaggerCooldownTimer = BOSS_STAGGER_COOLDOWN_SEC;
  boss.stunTimer = Math.max(boss.stunTimer ?? 0, BOSS_STAGGER_FLINCH_SEC);
  boss.aiState = 'stunned';
  boss.stateTimer = Math.max(boss.stateTimer, BOSS_STAGGER_FLINCH_SEC);
  boss.vx = 0;
  boss.vy = 0;
  boss.lastCombatText = 'WALL-SLAM!';

  const rawSlam = computeWallSlamDamage(boss, sim.currentFloor);
  const billiardSlam = hasPlayerBlessing(attackerPlayer, 'table_tech_billiard_master')
    ? Math.round(rawSlam * TABLE_TECH_BILLIARD_SLAM_DMG_MULT)
    : rawSlam;
  const slamDmg = applyRicochetVowOrGeometryEyeWallSlamBonus(attackerPlayer, billiardSlam);

  let shattered = false;
  if (boss.frozenTimer > 0) {
    shattered = true;
    boss.frozenTimer = 0;
    boss.chillTimer = 0;
    boss.chillStacks = 0;
    sim.events.push({
      kind: 'status_applied',
      targetId: boss.id,
      status: 'shatter',
      x: boss.x,
      y: boss.y,
    });
  }

  if (!boss.bossBurrowed && (boss.bossPhaseTransitionTimer ?? 0) <= 0) {
    const effectiveDmg = sim.hasActiveBossGuardians()
      ? Math.max(1, Math.round(slamDmg * 0.35))
      : slamDmg;
    boss.hp = Math.max(0, boss.hp - effectiveDmg);
    boss.hitFlashTimer = 0.14;
    sim.events.push({
      kind: 'damage_dealt',
      targetId: boss.id,
      targetKind: 'enemy',
      x: boss.x,
      y: boss.y,
      amount: effectiveDmg,
      isCrit: false,
      hitArmor: false,
      element: 'none',
      knockbackX: 0,
      knockbackY: 0,
    });
  }

  sim.events.push({
    kind: 'wall_slam',
    enemyId: boss.id,
    x: boss.x,
    y: boss.y,
    damage: slamDmg,
    shattered,
  });

  onEnemyWallSlammed(sim, boss, attackerPlayer, shattered);
  if (shattered && boss.hp > 0) {
    sim.triggerElementalReaction(
      boss,
      'shatter',
      Math.max(18, Math.round(slamDmg * 1.35)),
      boss.lastElementOwnerId || attackerPlayer.id,
      attackerPlayer.id,
    );
  }
  sim.checkBossPhaseTransitions(boss);
  if (boss.hp <= 0) {
    sim.handleEnemyKilled(boss, attackerPlayer.id);
  }
  return true;
}

export function addBossStaggerAccum(
  sim: WorldSim,
  boss: SimEnemyState,
  knockback: number,
  procCoefficient = 1.0,
  isKickedPropHit = false,
  attacker?: SimPlayerState | number,
): number {
  if (!boss.isBoss || boss.hp <= 0) {
    return boss.bossStaggerAccum ?? 0;
  }
  if ((boss.bossStaggerCooldownTimer ?? 0) > 0) {
    return boss.bossStaggerAccum ?? 0;
  }

  const deltaStagger = isKickedPropHit
    ? BOSS_STAGGER_PROP_KICK_BONUS
    : knockback > 0
      ? (knockback / 12) * procCoefficient
      : 0;
  if (deltaStagger <= 0) {
    return boss.bossStaggerAccum ?? 0;
  }

  const nextAccum = (boss.bossStaggerAccum ?? 0) + deltaStagger;
  boss.bossStaggerAccum = nextAccum;
  if (nextAccum >= BOSS_STAGGER_MAX) {
    triggerBossInPlaceWallSlam(sim, boss, attacker);
    return 0;
  }
  return boss.bossStaggerAccum;
}
