import { angleDiff, clamp, distance } from '../math/vec2.js';
import { resolveEnemyChasmRingOut } from './sim-tactical-physics.js';
import {
  MAX_DEPLOYABLES_PER_PLAYER,
  type SimEnemyState,
  type SimPlayerState,
  type SimSummonState,
  type TetherAnchorKind,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const SEED_GUN_MAX_BUDS_PER_PLAYER = 4;
export const SEED_GUN_BUD_RADIUS = 88;
export const SEED_GUN_BUD_DOT_DMG_PER_SEC = 6;
export const SEED_GUN_HARVEST_BLOOM_DMG = 24;
export const SEED_GUN_HARVEST_BLOOM_ROOT_SEC = 1.0;
export const SEED_GUN_HEAL_ICD_SEC = 12.0;
export const SEED_GUN_MAX_HEALS_PER_ROOM = 2;

export const TETHER_STAFF_MAX_RANGE = 280;
export const TETHER_STAFF_TICK_INTERVAL_SEC = 0.25;
export const TETHER_STAFF_TICK_DMG = 11;
export const TETHER_STAFF_VENT_BLAST_DMG = 32;
export const TETHER_STAFF_VENT_BLAST_RADIUS = 88;
export const TETHER_STAFF_YANK_DIST = 64;

export function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-6) {
    return distance(px, py, x1, y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

/**
 * Seed Gun (Súng Phóng Hạt Sinh Mệnh):
 * Plants 1 Life Bud (life_blossom, max 4 active per player — replacing oldest on 5th)
 * that ticks for 6 Poison DMG/s in r = 88px.
 */
export function spawnSeedGunLifeBud(
  sim: WorldSim,
  ownerId: number,
  x: number,
  y: number,
): SimSummonState | null {
  if (sim.stressTestActive) return null;

  const ownerBudIndices: number[] = [];
  for (let i = 0; i < sim.summons.length; i++) {
    const s = sim.summons[i]!;
    if (s.ownerPlayerId === ownerId && s.kind === 'life_blossom' && s.hp > 0 && s.ttlSec > 0) {
      ownerBudIndices.push(i);
    }
  }
  while (ownerBudIndices.length >= SEED_GUN_MAX_BUDS_PER_PLAYER) {
    const oldestIdx = ownerBudIndices.shift()!;
    sim.summons.splice(oldestIdx, 1);
    for (let k = 0; k < ownerBudIndices.length; k++) {
      if (ownerBudIndices[k]! > oldestIdx) {
        ownerBudIndices[k]! -= 1;
      }
    }
  }

  const ownerSummons = sim.summons.filter(
    (s) => s.ownerPlayerId === ownerId && s.hp > 0 && s.ttlSec > 0,
  );
  if (ownerSummons.length >= MAX_DEPLOYABLES_PER_PLAYER) {
    ownerSummons[0]!.ttlSec = 0;
  }

  const col = sim.map.resolveCircleCollision(x, y, 14);
  const bud: SimSummonState = {
    id: ++sim.nextPuzzleEntityId,
    ownerPlayerId: ownerId,
    kind: 'life_blossom',
    nameVi: 'Nụ Hoa Sinh Mệnh',
    x: col.x,
    y: col.y,
    radius: 14,
    auraRadius: SEED_GUN_BUD_RADIUS,
    hp: 30,
    maxHp: 30,
    ttlSec: 8.0,
    maxTtlSec: 8.0,
    tickTimer: 1.0,
    healsRemaining: 0,
    charge: 0,
    poisonRoots: false,
    selfDestruct: false,
    rootedEnemyIds: [],
  };
  sim.summons.push(bud);
  return bud;
}

/**
 * Seed Gun Harvest Bloom (Finale Shot or Perfect Reload [R]):
 * Detonates all active Life Buds owned by the player for 24 Poison DMG + 1.0s Root (r = 88px).
 * Strict Anti-Exploit Healing Mist Rule:
 * ONLY when hitting >= 1 living enemy does it release Healing Mist (+1 Armor, +1 HP with 12.0s ICD, max 2 heals/room).
 */
export function triggerSeedGunHarvestBloom(
  sim: WorldSim,
  pOrPlayerId: SimPlayerState | number,
): number {
  const owner =
    typeof pOrPlayerId === 'number'
      ? (sim.getPlayerById(pOrPlayerId) ?? sim.player)
      : pOrPlayerId;
  const buds = sim.summons.filter(
    (s) => s.ownerPlayerId === owner.id && s.kind === 'life_blossom' && s.hp > 0 && s.ttlSec > 0,
  );
  if (buds.length === 0) return 0;

  let hitLivingEnemyCount = 0;
  const hitEnemyIds = new Set<number>();
  const rootDur = SEED_GUN_HARVEST_BLOOM_ROOT_SEC + 1 / 60 + 1e-6;

  for (let bIdx = 0; bIdx < buds.length; bIdx++) {
    const bud = buds[bIdx]!;
    bud.ttlSec = 0;
    bud.hp = 0;

    if (!sim.stressTestActive) {
      sim.events.push({
        kind: 'explosion',
        x: bud.x,
        y: bud.y,
        radius: SEED_GUN_BUD_RADIUS,
        damage: SEED_GUN_HARVEST_BLOOM_DMG,
        sourceDefId: 'seed_gun',
      });
    }

    for (let eIdx = 0; eIdx < sim.enemies.length; eIdx++) {
      const enemy = sim.enemies[eIdx]!;
      if (
        enemy.hp <= 0 ||
        enemy.aiState === 'spawning' ||
        enemy.bossBurrowed ||
        hitEnemyIds.has(enemy.id)
      ) {
        continue;
      }
      if (distance(bud.x, bud.y, enemy.x, enemy.y) <= SEED_GUN_BUD_RADIUS + enemy.radius) {
        hitEnemyIds.add(enemy.id);
        hitLivingEnemyCount += 1;
        const hitAng = Math.atan2(enemy.y - bud.y, enemy.x - bud.x);
        enemy.rootedTimer = Math.max(enemy.rootedTimer, rootDur);
        enemy.rootTimer = enemy.rootedTimer;
        enemy.vx = 0;
        enemy.vy = 0;
        if (!sim.stressTestActive) {
          sim.events.push({
            kind: 'status_applied',
            targetId: enemy.id,
            status: 'rooted',
            x: enemy.x,
            y: enemy.y,
          });
        }
        sim.applyDamageToEnemy(
          enemy,
          SEED_GUN_HARVEST_BLOOM_DMG,
          false,
          'poison',
          hitAng,
          40,
          false,
          owner.id,
          true,
        );
      }
    }
  }

  sim.summons = sim.summons.filter(
    (s) => !(s.ownerPlayerId === owner.id && s.kind === 'life_blossom' && s.ttlSec <= 0),
  );

  // Strict Anti-Exploit Rule: Healing Mist ONLY triggers when hitting >= 1 living enemy!
  if (hitLivingEnemyCount >= 1) {
    const allPlayers = sim.getAllPlayers();
    for (let i = 0; i < allPlayers.length; i++) {
      const ally = allPlayers[i]!;
      if (ally.lifeState !== 'alive') continue;
      const nearBud = buds.some(
        (b) => distance(b.x, b.y, ally.x, ally.y) <= SEED_GUN_BUD_RADIUS + 92,
      );
      if (
        ally.id !== owner.id &&
        !nearBud &&
        distance(owner.x, owner.y, ally.x, ally.y) > 220
      ) {
        continue;
      }

      ally.armor = Math.min(ally.maxArmor, ally.armor + 1);
      if (
        (ally.seedGunHealIcdTimer ?? 0) <= 0 &&
        (ally.seedGunRoomHealsUsed ?? 0) < SEED_GUN_MAX_HEALS_PER_ROOM
      ) {
        ally.hp = Math.min(ally.maxHp, ally.hp + 1);
        ally.seedGunHealIcdTimer = SEED_GUN_HEAL_ICD_SEC;
        ally.seedGunRoomHealsUsed = (ally.seedGunRoomHealsUsed ?? 0) + 1;
      }
    }
  }

  return buds.length;
}

function resolveTetherAnchorCoords(
  sim: WorldSim,
  p: SimPlayerState,
  targetKind: TetherAnchorKind,
  targetEntityId: number,
  fallbackX: number,
  fallbackY: number,
): { valid: boolean; x: number; y: number } {
  if (targetKind === 'player') {
    const pl = sim.getPlayerById(targetEntityId);
    if (pl && pl.id !== p.id && pl.lifeState === 'alive') {
      return {
        valid: distance(p.x, p.y, pl.x, pl.y) <= TETHER_STAFF_MAX_RANGE,
        x: pl.x,
        y: pl.y,
      };
    }
    return { valid: false, x: fallbackX, y: fallbackY };
  }
  if (targetKind === 'summon') {
    const sum = sim.summons.find(
      (s) => s.id === targetEntityId && s.hp > 0 && s.ttlSec > 0,
    );
    if (sum) {
      return {
        valid: distance(p.x, p.y, sum.x, sum.y) <= TETHER_STAFF_MAX_RANGE,
        x: sum.x,
        y: sum.y,
      };
    }
    return { valid: false, x: fallbackX, y: fallbackY };
  }
  if (targetKind === 'prop') {
    const pr = sim.props.find((prop) => prop.id === targetEntityId && prop.hp > 0);
    if (pr) {
      return {
        valid: distance(p.x, p.y, pr.x, pr.y) <= TETHER_STAFF_MAX_RANGE,
        x: pr.x,
        y: pr.y,
      };
    }
    return { valid: false, x: fallbackX, y: fallbackY };
  }
  if (targetKind === 'enemy') {
    const en = sim.enemies.find(
      (e) =>
        e.id === targetEntityId &&
        e.hp > 0 &&
        e.aiState !== 'spawning' &&
        !e.bossBurrowed,
    );
    if (en) {
      return {
        valid: distance(p.x, p.y, en.x, en.y) <= TETHER_STAFF_MAX_RANGE,
        x: en.x,
        y: en.y,
      };
    }
    return { valid: false, x: fallbackX, y: fallbackY };
  }
  return { valid: false, x: fallbackX, y: fallbackY };
}

function selectTetherAnchorTarget(
  sim: WorldSim,
  p: SimPlayerState,
): { targetKind: TetherAnchorKind; targetEntityId: number; x2: number; y2: number } {
  const halfArc = Math.PI / 3;
  const inConeOrRange = (x: number, y: number, requireCone: boolean): boolean => {
    const d = distance(p.x, p.y, x, y);
    if (d > TETHER_STAFF_MAX_RANGE) return false;
    if (!requireCone || d <= 1e-4) return true;
    const ang = Math.atan2(y - p.y, x - p.x);
    return Math.abs(angleDiff(ang, p.aimAngle)) <= halfArc;
  };

  // 1. Teammate (SimPlayerState)
  const allPlayers = sim.getAllPlayers();
  for (const requireCone of [true, false]) {
    let bestAlly: SimPlayerState | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < allPlayers.length; i++) {
      const cand = allPlayers[i]!;
      if (cand.id === p.id || cand.lifeState !== 'alive') continue;
      if (!inConeOrRange(cand.x, cand.y, requireCone)) continue;
      const d = distance(p.x, p.y, cand.x, cand.y);
      if (d < bestDist) {
        bestDist = d;
        bestAlly = cand;
      }
    }
    if (bestAlly) {
      return {
        targetKind: 'player',
        targetEntityId: bestAlly.id,
        x2: bestAlly.x,
        y2: bestAlly.y,
      };
    }
  }

  // 2. Summon (SimSummonState)
  for (const requireCone of [true, false]) {
    let bestSum: SimSummonState | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < sim.summons.length; i++) {
      const s = sim.summons[i]!;
      if (s.hp <= 0 || s.ttlSec <= 0) continue;
      if (!inConeOrRange(s.x, s.y, requireCone)) continue;
      const d = distance(p.x, p.y, s.x, s.y);
      if (d < bestDist) {
        bestDist = d;
        bestSum = s;
      }
    }
    if (bestSum) {
      return {
        targetKind: 'summon',
        targetEntityId: bestSum.id,
        x2: bestSum.x,
        y2: bestSum.y,
      };
    }
  }

  // 3. Flipped / Interactive Cover Prop (SimPropState)
  for (const requireCone of [true, false]) {
    let bestProp = null;
    let bestScore = Infinity;
    for (let i = 0; i < sim.props.length; i++) {
      const pr = sim.props[i]!;
      if (pr.hp <= 0) continue;
      if (!inConeOrRange(pr.x, pr.y, requireCone)) continue;
      const d = distance(p.x, p.y, pr.x, pr.y);
      const priorityBonus = pr.coverState === 'flipped' ? -1000 : 0;
      if (d + priorityBonus < bestScore) {
        bestScore = d + priorityBonus;
        bestProp = pr;
      }
    }
    if (bestProp) {
      return {
        targetKind: 'prop',
        targetEntityId: bestProp.id,
        x2: bestProp.x,
        y2: bestProp.y,
      };
    }
  }

  // 4. First Enemy along aim cone / within 280px
  for (const requireCone of [true, false]) {
    let bestEnemy: SimEnemyState | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
      if (!inConeOrRange(e.x, e.y, requireCone)) continue;
      const d = distance(p.x, p.y, e.x, e.y);
      if (d < bestDist) {
        bestDist = d;
        bestEnemy = e;
      }
    }
    if (bestEnemy) {
      return {
        targetKind: 'enemy',
        targetEntityId: bestEnemy.id,
        x2: bestEnemy.x,
        y2: bestEnemy.y,
      };
    }
  }

  const col = sim.map.resolveCircleCollision(
    p.x + Math.cos(p.aimAngle) * TETHER_STAFF_MAX_RANGE,
    p.y + Math.sin(p.aimAngle) * TETHER_STAFF_MAX_RANGE,
    10,
  );
  return {
    targetKind: 'point',
    targetEntityId: 0,
    x2: col.x,
    y2: col.y,
  };
}

function applyTetherShockDamage(
  sim: WorldSim,
  enemy: SimEnemyState,
  damage: number,
  hitAngle: number,
  knockback: number,
  isHeavy: boolean,
  ownerPlayerId: number,
): void {
  enemy.shockTimer = Math.max(enemy.shockTimer, 1.2);
  enemy.lastElementOwnerId = ownerPlayerId;
  enemy.lastElementApplied = 'shock';
  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'status_applied',
      targetId: enemy.id,
      status: 'shock',
      x: enemy.x,
      y: enemy.y,
    });
  }
  sim.applyDamageToEnemy(
    enemy,
    damage,
    false,
    'none',
    hitAngle,
    knockback,
    isHeavy,
    ownerPlayerId,
    true,
  );
  const lastEv = sim.events[sim.events.length - 1];
  if (lastEv && lastEv.kind === 'damage_dealt' && lastEv.targetId === enemy.id) {
    lastEv.element = 'shock';
  }
}

export function upsertTetherStaffBeamImpl(
  sim: WorldSim,
  p: SimPlayerState,
  baseDmg: number,
): void {
  const dmg = baseDmg > 0 ? baseDmg : TETHER_STAFF_TICK_DMG;
  const existingBeam = sim.tetherBeams.find((b) => b.ownerPlayerId === p.id && b.ttlSec > 0);
  if (existingBeam) {
    const resolved = resolveTetherAnchorCoords(
      sim,
      p,
      existingBeam.targetKind,
      existingBeam.targetEntityId,
      existingBeam.x2,
      existingBeam.y2,
    );
    if (resolved.valid) {
      existingBeam.x1 = p.x;
      existingBeam.y1 = p.y;
      existingBeam.x2 = resolved.x;
      existingBeam.y2 = resolved.y;
      existingBeam.ttlSec = 3.2;
      existingBeam.damage = dmg;
      return;
    }
  }

  const anchor = selectTetherAnchorTarget(sim, p);
  if (existingBeam) {
    existingBeam.targetKind = anchor.targetKind;
    existingBeam.targetEntityId = anchor.targetEntityId;
    existingBeam.x1 = p.x;
    existingBeam.y1 = p.y;
    existingBeam.x2 = anchor.x2;
    existingBeam.y2 = anchor.y2;
    existingBeam.ttlSec = 3.2;
    existingBeam.damage = dmg;
  } else {
    sim.tetherBeams.push({
      id: ++sim.nextPuzzleEntityId,
      ownerPlayerId: p.id,
      targetEntityId: anchor.targetEntityId,
      targetKind: anchor.targetKind,
      x1: p.x,
      y1: p.y,
      x2: anchor.x2,
      y2: anchor.y2,
      ttlSec: 3.2,
      tickTimer: TETHER_STAFF_TICK_INTERVAL_SEC,
      damage: dmg,
    });
  }
}

export function updateTetherStaffBeams(sim: WorldSim, dtSec: number): void {
  if (sim.tetherBeams.length === 0) return;
  let beamWrite = 0;
  for (let i = 0; i < sim.tetherBeams.length; i++) {
    const beam = sim.tetherBeams[i]!;
    beam.ttlSec -= dtSec;
    if (beam.ttlSec <= 0) continue;

    const owner = sim.getPlayerById(beam.ownerPlayerId);
    if (!owner || owner.lifeState !== 'alive') continue;
    beam.x1 = owner.x;
    beam.y1 = owner.y;

    const resolved = resolveTetherAnchorCoords(
      sim,
      owner,
      beam.targetKind,
      beam.targetEntityId,
      beam.x2,
      beam.y2,
    );
    if (resolved.valid) {
      beam.x2 = resolved.x;
      beam.y2 = resolved.y;
    }

    beam.tickTimer -= dtSec;
    if (beam.tickTimer <= 1e-6) {
      beam.tickTimer += TETHER_STAFF_TICK_INTERVAL_SEC;
      if (beam.tickTimer <= 0) {
        beam.tickTimer = TETHER_STAFF_TICK_INTERVAL_SEC;
      }
      const segDx = beam.x2 - beam.x1;
      const segDy = beam.y2 - beam.y1;
      const segLenSq = segDx * segDx + segDy * segDy;
      for (let j = 0; j < sim.enemies.length; j++) {
        const e = sim.enemies[j]!;
        if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
        const t =
          segLenSq > 0
            ? clamp(((e.x - beam.x1) * segDx + (e.y - beam.y1) * segDy) / segLenSq, 0, 1)
            : 0;
        const distToBeam = distance(e.x, e.y, beam.x1 + t * segDx, beam.y1 + t * segDy);
        if (distToBeam <= e.radius + 16) {
          const hitAng = Math.atan2(segDy, segDx) + Math.PI * 0.5;
          applyTetherShockDamage(sim, e, beam.damage, hitAng, 40, false, beam.ownerPlayerId);
        }
      }
    }

    sim.tetherBeams[beamWrite++] = beam;
  }
  sim.tetherBeams.length = beamWrite;
}

/**
 * Tether Staff Tactical Vent [R]:
 * Contracts the active tether line, yanking all enemies touching/near the tether
 * toward the anchor point and triggering a 32 Shock DMG Electromagnetic Blast.
 */
export function triggerTetherStaffTacticalVent(
  sim: WorldSim,
  pOrPlayerId: SimPlayerState | number,
): number {
  const p =
    typeof pOrPlayerId === 'number'
      ? (sim.getPlayerById(pOrPlayerId) ?? sim.player)
      : pOrPlayerId;

  const existingBeam = sim.tetherBeams.find((b) => b.ownerPlayerId === p.id && b.ttlSec > 0);
  let anchorX: number;
  let anchorY: number;

  if (existingBeam) {
    const resolved = resolveTetherAnchorCoords(
      sim,
      p,
      existingBeam.targetKind,
      existingBeam.targetEntityId,
      existingBeam.x2,
      existingBeam.y2,
    );
    anchorX = resolved.x;
    anchorY = resolved.y;
    existingBeam.ttlSec = 0;
  } else {
    const fallbackAnchor = selectTetherAnchorTarget(sim, p);
    anchorX = fallbackAnchor.x2;
    anchorY = fallbackAnchor.y2;
  }

  sim.tetherBeams = sim.tetherBeams.filter((b) => b.ownerPlayerId !== p.id);

  // 1. Yank all enemies near the tether segment (p.x, p.y) -> (anchorX, anchorY) toward the anchor point
  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    const distToSeg = pointToSegmentDist(enemy.x, enemy.y, p.x, p.y, anchorX, anchorY);
    const distToAnchor = distance(enemy.x, enemy.y, anchorX, anchorY);
    if (
      distToSeg <= TETHER_STAFF_YANK_DIST + enemy.radius ||
      distToAnchor <= TETHER_STAFF_VENT_BLAST_RADIUS + enemy.radius
    ) {
      const isImmobile =
        enemy.defId === 'thorn_turret' ||
        enemy.defId === 'spore_guardian' ||
        enemy.defId === 'ice_prison' ||
        enemy.defId === 'forge_energy_core';
      if (!isImmobile) {
        const dx = anchorX - enemy.x;
        const dy = anchorY - enemy.y;
        const d = Math.hypot(dx, dy);
        const targetX = d > 1e-4 ? anchorX - (dx / d) * Math.min(10, d * 0.1) : anchorX;
        const targetY = d > 1e-4 ? anchorY - (dy / d) * Math.min(10, d * 0.1) : anchorY;
        const col = sim.map.resolveCircleCollision(targetX, targetY, enemy.radius, true);
        enemy.x = col.x;
        enemy.y = col.y;
        enemy.kbVx = d > 1e-4 ? (dx / d) * 140 : 0;
        enemy.kbVy = d > 1e-4 ? (dy / d) * 140 : 0;
        if (!sim.stressTestActive) {
          resolveEnemyChasmRingOut(sim, enemy);
        }
      }
    }
  }

  // 2. Trigger Electromagnetic Blast (32 Shock DMG) at the anchor point
  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'explosion',
      x: anchorX,
      y: anchorY,
      radius: TETHER_STAFF_VENT_BLAST_RADIUS,
      damage: TETHER_STAFF_VENT_BLAST_DMG,
      sourceDefId: 'tether_staff',
    });
  }

  let hitCount = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    if (distance(anchorX, anchorY, enemy.x, enemy.y) <= TETHER_STAFF_VENT_BLAST_RADIUS + enemy.radius) {
      hitCount += 1;
      const hitAng =
        distance(anchorX, anchorY, enemy.x, enemy.y) > 1e-4
          ? Math.atan2(enemy.y - anchorY, enemy.x - anchorX)
          : p.aimAngle;
      applyTetherShockDamage(
        sim,
        enemy,
        TETHER_STAFF_VENT_BLAST_DMG,
        hitAng,
        120,
        true,
        p.id,
      );
    }
  }

  return hitCount;
}
