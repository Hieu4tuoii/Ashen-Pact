import type { ElementType } from '../data/types.js';
import { WEAPONS } from '../data/weapons.js';
import { angleDiff, distance } from '../math/vec2.js';
import { SHOT_FLAG } from '../protocol/messages.js';
import {
  type BulletVolleySpawnEvent,
  ELEMENTALIST_ROTATION_ORDER,
  type SimEnemyState,
  type SimMagneticRivetState,
  type SimPlayerState,
  type SimProjectileState,
} from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const MAX_ACTIVE_RIVETS_PER_PLAYER = 6;
export const RIVET_WEB_MAX_LINK_DIST = 180;

function pointToSegmentDistance(
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
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return distance(px, py, projX, projY);
}

export function plantMagneticRivet(
  sim: WorldSim,
  ownerPlayerId: number,
  x: number,
  y: number,
  attachedEnemyId: number | null,
  attachedPropId: number | null,
): SimMagneticRivetState {
  let ownerCount = 0;
  let oldestIdx = -1;
  for (let i = 0; i < sim.magneticRivets.length; i++) {
    if (sim.magneticRivets[i]!.ownerPlayerId === ownerPlayerId) {
      if (oldestIdx === -1) oldestIdx = i;
      ownerCount += 1;
    }
  }
  if (ownerCount >= MAX_ACTIVE_RIVETS_PER_PLAYER && oldestIdx >= 0) {
    sim.magneticRivets.splice(oldestIdx, 1);
  }

  let offsetX = 0;
  let offsetY = 0;
  if (attachedEnemyId !== null) {
    const enemy = sim.enemies.find((e) => e.id === attachedEnemyId);
    if (enemy) {
      offsetX = x - enemy.x;
      offsetY = y - enemy.y;
    }
  } else if (attachedPropId !== null) {
    const prop = sim.props.find((pr) => pr.id === attachedPropId);
    if (prop) {
      offsetX = x - prop.x;
      offsetY = y - prop.y;
    }
  }

  const rivet: SimMagneticRivetState = {
    id: ++sim.nextEntityId,
    ownerPlayerId,
    x,
    y,
    attachedEnemyId,
    attachedTargetId: attachedEnemyId,
    attachedPropId,
    offsetX,
    offsetY,
    ttlSec: 12.0,
  };
  sim.magneticRivets.push(rivet);
  return rivet;
}

export function updateMagneticRivets(sim: WorldSim, dtSec: number): void {
  if (sim.magneticRivets.length === 0) return;
  let writeIdx = 0;
  for (let i = 0; i < sim.magneticRivets.length; i++) {
    const r = sim.magneticRivets[i]!;
    r.ttlSec -= dtSec;
    if (r.ttlSec <= 0) continue;

    const targetId = r.attachedTargetId ?? r.attachedEnemyId;
    if (targetId !== null) {
      const e = sim.enemies.find((en) => en.id === targetId && en.hp > 0);
      if (e) {
        r.x = e.x + r.offsetX;
        r.y = e.y + r.offsetY;
      } else {
        r.attachedEnemyId = null;
        r.attachedTargetId = null;
      }
    } else if (r.attachedPropId !== null) {
      const pr = sim.props.find((p) => p.id === r.attachedPropId && p.hp > 0);
      if (pr) {
        r.x = pr.x + r.offsetX;
        r.y = pr.y + r.offsetY;
      } else {
        r.attachedPropId = null;
      }
    }

    sim.magneticRivets[writeIdx++] = r;
  }
  sim.magneticRivets.length = writeIdx;
}

export function detonatePlayerMagneticRivets(
  sim: WorldSim,
  ownerPlayerId: number,
  isPerfectReload: boolean,
): number {
  const playerRivets = sim.magneticRivets.filter((r) => r.ownerPlayerId === ownerPlayerId);
  if (playerRivets.length === 0) return 0;

  const dmgPerRivet = isPerfectReload ? 7.5 : 5;

  // Build connected pairs within 180px
  const links: Array<[SimMagneticRivetState, SimMagneticRivetState]> = [];
  for (let i = 0; i < playerRivets.length; i++) {
    for (let j = i + 1; j < playerRivets.length; j++) {
      const a = playerRivets[i]!;
      const b = playerRivets[j]!;
      if (distance(a.x, a.y, b.x, b.y) <= RIVET_WEB_MAX_LINK_DIST) {
        links.push([a, b]);
      }
    }
  }

  for (let eIdx = 0; eIdx < sim.enemies.length; eIdx++) {
    const enemy = sim.enemies[eIdx]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;

    const contributingRivetIds = new Set<number>();

    for (let rIdx = 0; rIdx < playerRivets.length; rIdx++) {
      const r = playerRivets[rIdx]!;
      const targetId = r.attachedTargetId ?? r.attachedEnemyId;
      if (
        targetId === enemy.id ||
        distance(enemy.x, enemy.y, r.x, r.y) <= enemy.radius + 28
      ) {
        contributingRivetIds.add(r.id);
      }
    }

    for (let lIdx = 0; lIdx < links.length; lIdx++) {
      const [a, b] = links[lIdx]!;
      const segDist = pointToSegmentDistance(enemy.x, enemy.y, a.x, a.y, b.x, b.y);
      if (segDist <= enemy.radius + 20) {
        contributingRivetIds.add(a.id);
        contributingRivetIds.add(b.id);
      }
    }

    // If enemy touched any rivet or arc in a connected web cluster (<=180px), all rivets within 180px of that cluster discharge through the web!
    if (contributingRivetIds.size > 0) {
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (let lIdx = 0; lIdx < links.length; lIdx++) {
          const [a, b] = links[lIdx]!;
          const hasA = contributingRivetIds.has(a.id);
          const hasB = contributingRivetIds.has(b.id);
          if (hasA && !hasB) {
            contributingRivetIds.add(b.id);
            expanded = true;
          } else if (hasB && !hasA) {
            contributingRivetIds.add(a.id);
            expanded = true;
          }
        }
      }

      const arcDamage = Math.max(1, Math.round(contributingRivetIds.size * dmgPerRivet));
      enemy.shockTimer = Math.max(enemy.shockTimer, 0.6);
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
        arcDamage,
        false,
        'none',
        0,
        85,
        isPerfectReload,
        ownerPlayerId,
        true,
      );
    }
  }

  if (!sim.stressTestActive && playerRivets.length > 0) {
    const first = playerRivets[0]!;
    const second = playerRivets[1] ?? first;
    sim.events.push({
      kind: 'chain_lightning',
      fromX: first.x,
      fromY: first.y,
      toX: second.x,
      toY: second.y,
    });
  }

  sim.magneticRivets = sim.magneticRivets.filter((r) => r.ownerPlayerId !== ownerPlayerId);
  return playerRivets.length;
}

export function triggerApprenticeStaffTacticalVent(sim: WorldSim, p: SimPlayerState): void {
  // 1. Pulse r = 56px around player clearing enemy bullets
  const pulseRadius = 56;
  const destroyedIds: number[] = [];
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
    if (distance(p.x, p.y, b.x, b.y) <= pulseRadius + b.radius) {
      b.ttlSec = 0;
      destroyedIds.push(b.id);
    }
  }
  if (destroyedIds.length > 0 && !sim.stressTestActive) {
    sim.events.push({
      kind: 'projectiles_destroyed',
      ids: destroyedIds,
    });
  }

  // 2. Tri-Elemental Beam to cursor position (22 DMG, explodes r = 72px, 100% status)
  const targetX =
    typeof p.aimWorldX === 'number' && Number.isFinite(p.aimWorldX)
      ? p.aimWorldX
      : p.x + Math.cos(p.aimAngle) * 140;
  const targetY =
    typeof p.aimWorldY === 'number' && Number.isFinite(p.aimWorldY)
      ? p.aimWorldY
      : p.y + Math.sin(p.aimAngle) * 140;
  const blastRadius = 72;
  const beamDamage = 22;

  if (!sim.stressTestActive) {
    sim.events.push({
      kind: 'explosion',
      x: targetX,
      y: targetY,
      radius: blastRadius,
      damage: beamDamage,
      sourceDefId: 'apprentice_staff',
    });
  }

  const rotOrder = ELEMENTALIST_ROTATION_ORDER;
  const primaryElem: ElementType =
    rotOrder[(p.staffShotCounter ?? 0) % rotOrder.length] ?? 'burn';

  for (let i = 0; i < sim.enemies.length; i++) {
    const enemy = sim.enemies[i]!;
    if (enemy.hp <= 0 || enemy.aiState === 'spawning' || enemy.bossBurrowed) continue;
    if (distance(targetX, targetY, enemy.x, enemy.y) <= blastRadius + enemy.radius) {
      const hitAng = Math.atan2(enemy.y - targetY, enemy.x - targetX);
      sim.applyDamageToEnemy(
        enemy,
        beamDamage,
        false,
        primaryElem,
        hitAng,
        140,
        true,
        p.id,
      );
      if (enemy.hp > 0) {
        sim.applyElementStatusToEnemy(enemy, primaryElem, beamDamage, p.id);
      }
    }
  }
}

export function spawnKnightSwordCrescentWave(
  sim: WorldSim,
  p: SimPlayerState,
  damage: number,
  critChance: number,
  element: ElementType,
  shotFlags: number,
): void {
  const waveSpeed = 600;
  const waveRange = 240;
  const waveTtl = waveRange / waveSpeed; // 0.40s -> 240px
  const volleyEv: BulletVolleySpawnEvent = {
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: p.id,
    team: 'player',
    weaponId: 'knight_sword_wave',
    x: p.x,
    y: p.y,
    angle: p.aimAngle,
    pelletCount: 1,
    spreadRad: 0,
    muzzleOffset: 16,
    speed: waveSpeed,
    damage,
    radius: 16,
    knockback: 260,
    pierceCount: 99,
    bounceCount: 0,
    ttlSec: waveTtl,
    element,
    critChance,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    shotFlags,
    flags: shotFlags,
  };
  sim.spawnDeterministicVolley(volleyEv, true);
}

export function processMeleeParryDeflect(sim: WorldSim, p: SimPlayerState): number {
  if (p.meleeParryWindowTimer <= 0) return 0;
  const maxParryPerWindow = 3;
  const currentParried = p.parriedCountCurrentWindow ?? 0;
  if (currentParried >= maxParryPerWindow) return 0;

  const activeWepId = p.weaponSlots[p.activeWeaponSlot] ?? p.weaponSlots[0] ?? 'knight_sword';
  const wep = WEAPONS[activeWepId] ?? WEAPONS.knight_sword!;
  const parryRange = (wep.range ?? 56) + 14;
  const halfArc = Math.max((55 * Math.PI) / 180, ((wep.spreadDeg ?? 85) * Math.PI) / 180 * 0.65);
  const deflectDamage = wep.comboDamages?.[2] ?? Math.round(wep.damage * 1.7);

  const deflectedIds: number[] = [];
  for (let i = 0; i < sim.projectiles.length; i++) {
    if (p.parriedCountCurrentWindow >= maxParryPerWindow) break;
    const b = sim.projectiles[i]!;
    if (b.team !== 'enemy' || b.ttlSec <= 0) continue;

    const d = distance(p.x, p.y, b.x, b.y);
    if (d <= parryRange + b.radius) {
      const ang = Math.atan2(b.y - p.y, b.x - p.x);
      if (d <= p.radius + b.radius + 8 || Math.abs(angleDiff(ang, p.aimAngle)) <= halfArc) {
        b.ttlSec = 0;
        deflectedIds.push(b.id);
        p.parriedCountCurrentWindow += 1;

        if (p.characterId === 'vanguard' && p.skillActiveTimer > 0) {
          p.shieldStoredBullets += 1;
          p.vanguardShieldBonusAdd = Math.min(0.75, (p.vanguardShieldBonusAdd ?? 0) + 0.15);
        }

        const deflectVolley: BulletVolleySpawnEvent = {
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: p.id,
          team: 'player',
          weaponId: 'knight_sword_parry',
          x: b.x,
          y: b.y,
          angle: p.aimAngle,
          pelletCount: 1,
          spreadRad: 0,
          muzzleOffset: 0,
          speed: 760,
          damage: deflectDamage,
          radius: 7,
          knockback: 220,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 0.9,
          element: p.activeImbueElement !== 'none' ? p.activeImbueElement : wep.element,
          critChance: wep.critChance,
          amplifiedByShield: false,
          seed: sim.rng.nextUint32(),
          shotFlags: 0,
          flags: 0,
          explosionRadius: 36,
        };
        sim.spawnDeterministicVolley(deflectVolley, true);
      }
    }
  }

  if (deflectedIds.length > 0 && !sim.stressTestActive) {
    sim.events.push({
      kind: 'projectiles_destroyed',
      ids: deflectedIds,
    });
  }

  return deflectedIds.length;
}

export function triggerTeslaFinaleChainLightning(
  sim: WorldSim,
  b: SimProjectileState,
  firstEnemy: SimEnemyState,
): void {
  const maxTargets = 3;
  const chainRadius = 180;
  const hitIds = new Set<number>([firstEnemy.id]);
  const chainTargets: Array<{ id: number; x: number; y: number }> = [
    { id: firstEnemy.id, x: firstEnemy.x, y: firstEnemy.y },
  ];
  let currX = firstEnemy.x;
  let currY = firstEnemy.y;
  const chainDmg = Math.max(4, Math.round(b.damage * 0.6));

  // Ensure 100% shock status on the primary target
  if (firstEnemy.hp > 0) {
    sim.applyElementStatusToEnemy(firstEnemy, 'shock', b.damage, b.ownerId);
  }

  while (chainTargets.length < maxTargets) {
    let bestEnemy: SimEnemyState | null = null;
    let bestDist = chainRadius;
    for (let i = 0; i < sim.enemies.length; i++) {
      const cand = sim.enemies[i]!;
      if (cand.hp <= 0 || cand.aiState === 'spawning' || cand.bossBurrowed) continue;
      if (hitIds.has(cand.id)) continue;
      const d = distance(currX, currY, cand.x, cand.y);
      if (d <= bestDist) {
        bestDist = d;
        bestEnemy = cand;
      }
    }
    if (!bestEnemy) break;
    hitIds.add(bestEnemy.id);
    chainTargets.push({ id: bestEnemy.id, x: bestEnemy.x, y: bestEnemy.y });
    const ang = Math.atan2(bestEnemy.y - currY, bestEnemy.x - currX);
    sim.applyDamageToEnemy(bestEnemy, chainDmg, false, 'shock', ang, 60, false, b.ownerId, true);
    if (!sim.stressTestActive) {
      sim.events.push({
        kind: 'chain_lightning',
        fromX: currX,
        fromY: currY,
        toX: bestEnemy.x,
        toY: bestEnemy.y,
      });
    }
    currX = bestEnemy.x;
    currY = bestEnemy.y;
  }
}

export function tryTeslaSmartWallBounce(
  sim: WorldSim,
  b: SimProjectileState,
  resolvedX: number,
  resolvedY: number,
  normalX: number,
  normalY: number,
): boolean {
  const isDynamicBounce =
    b.weaponId === 'tesla_carbine' || ((b.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE) !== 0;
  if (!isDynamicBounce || b.bounceRemaining <= 0) {
    return false;
  }

  const qualifiesForSmartRedirect =
    b.hitEntityIds.length > 0 || Boolean(b.passedThroughCoverOrPrism);

  const nextBounceRemaining = b.bounceRemaining - 1;
  let nextVx = normalX !== 0 ? -b.vx : b.vx;
  let nextVy = normalY !== 0 ? -b.vy : b.vy;
  let nextAngle = Math.atan2(nextVy, nextVx);
  let nextDamage = b.damage;
  const speed = Math.hypot(b.vx, b.vy) || 580;

  if (qualifiesForSmartRedirect) {
    nextDamage = Math.round(b.damage * 1.35);
    let nearestEnemy: SimEnemyState | null = null;
    let nearestDist = Infinity;

    for (let i = 0; i < sim.enemies.length; i++) {
      const e = sim.enemies[i]!;
      if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
      if (b.hitEntityIds.includes(e.id)) continue;
      const d = distance(resolvedX, resolvedY, e.x, e.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestEnemy = e;
      }
    }
    if (!nearestEnemy && (b.splitGeneration ?? 0) === 0) {
      for (let i = 0; i < sim.enemies.length; i++) {
        const e = sim.enemies[i]!;
        if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
        const d = distance(resolvedX, resolvedY, e.x, e.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestEnemy = e;
        }
      }
    }

    if (nearestEnemy) {
      nextAngle = Math.atan2(nearestEnemy.y - resolvedY, nearestEnemy.x - resolvedX);
      nextVx = Math.cos(nextAngle) * speed;
      nextVy = Math.sin(nextAngle) * speed;
    }
  }

  const oldId = b.id;
  const nextGen = (b.splitGeneration ?? 0) + 1;
  const preservedHitIds = nextGen > 1 ? [...b.hitEntityIds] : [];
  const preservedPierce = b.pierceRemaining;
  const preservedTtl = Math.max(0.35, b.ttlSec);
  const preservedFlags = b.shotFlags ?? SHOT_FLAG.DYNAMIC_BOUNCE;
  const preservedElement = b.element;
  const preservedOwnerId = b.ownerId;
  const preservedWeaponId = b.weaponId;
  const preservedRadius = b.radius;
  const preservedKnockback = b.knockback;
  const preservedAmplified = b.amplifiedByShield;

  // Terminate the old projectile and spawn the deterministic replacement volley
  b.ttlSec = 0;

  const bounceVolley: BulletVolleySpawnEvent = {
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: preservedOwnerId,
    team: 'player',
    weaponId: preservedWeaponId,
    x: resolvedX + Math.cos(nextAngle) * 4,
    y: resolvedY + Math.sin(nextAngle) * 4,
    angle: nextAngle,
    pelletCount: 1,
    spreadRad: 0,
    muzzleOffset: 0,
    speed,
    damage: nextDamage,
    radius: preservedRadius,
    knockback: preservedKnockback,
    pierceCount: preservedPierce,
    bounceCount: nextBounceRemaining,
    ttlSec: preservedTtl,
    element: preservedElement,
    critChance: b.isCrit ? 1 : 0,
    amplifiedByShield: preservedAmplified,
    seed: sim.rng.nextUint32(),
    shotFlags: preservedFlags,
    flags: preservedFlags,
    replacedProjectileId: oldId,
  };

  sim.spawnDeterministicVolley(bounceVolley, true);
  const spawned = sim.projectiles[sim.projectiles.length - 1];
  if (spawned && spawned.weaponId === preservedWeaponId) {
    spawned.passedThroughCoverOrPrism = qualifiesForSmartRedirect;
    spawned.splitGeneration = Math.min(1, nextGen) as 0 | 1;
    if (preservedHitIds.length > 0) {
      spawned.hitEntityIds.push(...preservedHitIds);
    }
  }
  return true;
}
