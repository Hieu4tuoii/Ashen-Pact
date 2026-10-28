import { CHARACTERS } from '../data/characters.js';
import { scaleBlessingDamage } from '../data/blessings.js';
import type { ElementType } from '../data/types.js';
import { angleDiff, clamp, distance, isCircleInCone } from '../math/vec2.js';
import { TILE_SIZE } from '../protocol/messages.js';
import {
  spawnElementalistOrbSkillZones,
  updateElementalistVortexPropsAndTwinBeam,
} from './sim-blessings.js';
import { tryTriggerExecutionerScytheSlash } from './sim-ashen-pacts.js';
import { triggerEnemyWallSlam, triggerMeleeKickProps } from './sim-tactical-physics.js';
import { ELEMENTALIST_ROTATION_ORDER, hasPlayerBlessing, MAX_DEPLOYABLES_PER_PLAYER, type SimSummonState, type SimPlayerState, type SimEnemyState, type SimPropState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-8) return distance(px, py, x1, y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

function findNearestWallOrObstacleForEnemy(sim: WorldSim, e: SimEnemyState): { x: number; y: number; prop?: SimPropState } {
  let bestX = e.x + 64;
  let bestY = e.y;
  let bestDist = Infinity;
  let bestProp: SimPropState | undefined;

  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0 || (prop.coverState !== 'flipped' && !prop.blocksMovement)) continue;
    const d = distance(e.x, e.y, prop.x, prop.y) - prop.radius;
    if (d < bestDist) {
      bestDist = d;
      bestX = prop.x;
      bestY = prop.y;
      bestProp = prop;
    }
  }
  const centerTx = Math.floor(e.x / TILE_SIZE);
  const centerTy = Math.floor(e.y / TILE_SIZE);
  for (let ty = centerTy - 8; ty <= centerTy + 8; ty++) {
    for (let tx = centerTx - 8; tx <= centerTx + 8; tx++) {
      if (tx < 0 || ty < 0 || tx >= sim.map.cols || ty >= sim.map.rows) continue;
      const tile = sim.map.getTile(tx, ty);
      if (tile !== 'wall' && tile !== 'pillar') continue;
      const wx = (tx + 0.5) * TILE_SIZE;
      const wy = (ty + 0.5) * TILE_SIZE;
      const d = distance(e.x, e.y, wx, wy);
      if (d < bestDist) {
        bestDist = d;
        bestX = wx;
        bestY = wy;
        bestProp = undefined;
      }
    }
  }
  return { x: bestX, y: bestY, prop: bestProp };
}

function lashDruidPoisonRootsIntoWall(sim: WorldSim, ownerId: number, e: SimEnemyState): void {
  if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) return;
  const obstacle = findNearestWallOrObstacleForEnemy(sim, e);
  const lashAngle = Math.atan2(obstacle.y - e.y, obstacle.x - e.x);
  const rootDmg = scaleBlessingDamage(14, sim.currentFloor);
  const kbSpeed = 240;

  e.lastHitPlayerId = ownerId;
  e.poisonTimer = Math.max(e.poisonTimer, 4.0);
  e.poisonStacks = Math.max(1, e.poisonStacks);
  sim.applyDamageToEnemy(e, rootDmg, false, 'poison', lashAngle, kbSpeed, true, ownerId);
  if (e.hp <= 0 || e.isBoss) return;

  e.kbVx = Math.cos(lashAngle) * kbSpeed;
  e.kbVy = Math.sin(lashAngle) * kbSpeed;
  const col = sim.map.resolveCircleCollision(
    obstacle.x - Math.cos(lashAngle) * (e.radius + 2),
    obstacle.y - Math.sin(lashAngle) * (e.radius + 2),
    e.radius,
    true,
  );
  e.x = col.x;
  e.y = col.y;
  e.wallSlamCooldownTimer = 0;
  triggerEnemyWallSlam(sim, e, obstacle.prop, kbSpeed);
  e.rootedTimer = Math.max(e.rootedTimer, 1.5);
}

function updateEngineerTwinTurretLaserFences(sim: WorldSim, dtSec: number): void {
  if (sim.summons.length < 2) return;

  for (let i = 0; i < sim.summons.length; i++) {
    const t1 = sim.summons[i]!;
    if (t1.kind !== 'tesla_turret' || t1.hp <= 0 || t1.ttlSec <= 0) continue;
    for (let j = i + 1; j < sim.summons.length; j++) {
      const t2 = sim.summons[j]!;
      if (t2.kind !== 'tesla_turret' || t2.hp <= 0 || t2.ttlSec <= 0 || t1.ownerPlayerId !== t2.ownerPlayerId) continue;

      t1.fenceTickTimer = (t1.fenceTickTimer ?? 0) - dtSec;
      const fireTick = (t1.fenceTickTimer ?? 0) <= 0;
      if (fireTick) t1.fenceTickTimer = 0.45;

      const minX = Math.min(t1.x, t2.x) - 36;
      const maxX = Math.max(t1.x, t2.x) + 36;
      const minY = Math.min(t1.y, t2.y) - 36;
      const maxY = Math.max(t1.y, t2.y) + 36;
      const fenceDmg = fireTick ? scaleBlessingDamage(10, sim.currentFloor) : 0;
      const fenceAng = fireTick ? Math.atan2(t2.y - t1.y, t2.x - t1.x) : 0;
      for (let k = 0; k < sim.enemies.length; k++) {
        const e = sim.enemies[k]!;
        if (e.hp <= 0 || e.isDummy || e.aiState === 'spawning' || e.bossBurrowed) continue;
        if (e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) continue;
        if (pointToSegmentDist(e.x, e.y, t1.x, t1.y, t2.x, t2.y) <= e.radius + 18) {
          e.chillTimer = Math.max(e.chillTimer, 1.5);
          e.slowTimer = Math.max(e.slowTimer ?? 0, 1.5);
          e.fenceSlow50Timer = Math.max(e.fenceSlow50Timer ?? 0, 0.5);
          if (fireTick) {
            sim.events.push({ kind: 'chain_lightning', fromX: t1.x, fromY: t1.y, toX: t2.x, toY: t2.y });
            sim.applyDamageToEnemy(e, fenceDmg, false, 'shock', fenceAng, 35, false, t1.ownerPlayerId);
          }
        }
      }
    }
  }
}

function triggerEngineerTurretSelfDestruct(sim: WorldSim, turret: SimSummonState): void {
  if (!turret.selfDestruct) return;
  turret.selfDestruct = false;
  turret.ttlSec = 0;
  turret.hp = 0;

  let bestTarget: SimEnemyState | null = null;
  let bestClusterCount = -1;
  let bestDist = Infinity;
  for (let i = 0; i < sim.enemies.length; i++) {
    const cand = sim.enemies[i]!;
    if (cand.hp <= 0 || cand.isDummy || cand.aiState === 'spawning' || cand.bossBurrowed) continue;
    const d = distance(turret.x, turret.y, cand.x, cand.y);
    if (d > 180) continue;
    let neighbors = 0;
    for (let j = 0; j < sim.enemies.length; j++) {
      const other = sim.enemies[j]!;
      if (other.hp > 0 && !other.isDummy && distance(cand.x, cand.y, other.x, other.y) <= 130) neighbors += 1;
    }
    if (neighbors > bestClusterCount || (neighbors === bestClusterCount && d < bestDist)) {
      bestClusterCount = neighbors;
      bestDist = d;
      bestTarget = cand;
    }
  }
  if (bestTarget) {
    turret.x = bestTarget.x;
    turret.y = bestTarget.y;
  }

  const blastR = 130;
  const blastDmg = scaleBlessingDamage(45, sim.currentFloor);
  sim.events.push({
    kind: 'explosion', x: turret.x, y: turret.y, radius: blastR,
    damage: blastDmg, sourceDefId: 'tesla_turret_self_destruct',
  });

  for (let j = 0; j < sim.enemies.length; j++) {
    const e = sim.enemies[j]!;
    if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
    if (distance(turret.x, turret.y, e.x, e.y) <= blastR + e.radius) {
      const ang = distance(turret.x, turret.y, e.x, e.y) > 1e-4 ? Math.atan2(e.y - turret.y, e.x - turret.x) : 0;
      sim.applyDamageToEnemy(e, blastDmg, true, 'burn', ang, 240, true, turret.ownerPlayerId);
      if (e.hp > 0) {
        sim.applyElementStatusToEnemy(e, 'shock', blastDmg, turret.ownerPlayerId);
        e.burnTimer = Math.max(e.burnTimer, 2.5);
        e.shockTimer = Math.max(e.shockTimer, 0.6);
      }
    }
  }
}

function tryReactivateEngineerSelfDestruct(sim: WorldSim, p: SimPlayerState): boolean {
  if (p.characterId !== 'engineer' || !hasPlayerBlessing(p, 'engineer_self_destruct')) return false;
  if (p.skillCooldownTimer <= 0 && p.skillActiveTimer <= 0) return false;
  const activeTurrets = sim.summons.filter(
    (s) => s.kind === 'tesla_turret' && s.ownerPlayerId === p.id && s.hp > 0 && s.ttlSec > 0,
  );
  if (activeTurrets.length === 0) return false;

  for (const t of activeTurrets) {
    t.selfDestruct = true;
    triggerEngineerTurretSelfDestruct(sim, t);
  }
  p.skillActiveTimer = 0;
  return true;
}

export function activateCharacterSkillImpl(this: WorldSim, p: SimPlayerState): void {
  const cDef = CHARACTERS[p.characterId] ?? CHARACTERS.vanguard;
  const skillDef = cDef.skill;

  if (p.characterId === 'vanguard') {
    if (p.skillActiveTimer > 0) {
      this.releaseVanguardShieldShockwave(p);
      tryTriggerExecutionerScytheSlash(this, p);
    } else if (p.skillCooldownTimer <= 0) {
      const bonusDur = p.blessingIds.includes('vanguard_bastion_prism') ? 1.5 : 0;
      p.skillActiveTimer = skillDef.durationSec + bonusDur;
      p.skillCooldownTimer = skillDef.cooldownSec;
      p.shieldStoredBullets = 0;
      if (p.blessingIds.includes('vanguard_bastion_prism')) {
        p.armor = Math.min(p.maxArmor, p.armor + 2);
      }
      this.events.push({
        kind: 'skill_cast',
        playerId: p.id,
        skillId: skillDef.id,
        x: p.x,
        y: p.y,
        angle: p.aimAngle,
      });
      tryTriggerExecutionerScytheSlash(this, p);
    }
    return;
  }

  if (tryReactivateEngineerSelfDestruct(this, p)) {
    tryTriggerExecutionerScytheSlash(this, p);
    return;
  }
  if (p.skillCooldownTimer > 0) return;
  p.skillCooldownTimer = skillDef.cooldownSec;
  p.skillActiveTimer =
    p.characterId === 'ranger'
      ? 3.8
      : p.characterId === 'elementalist'
        ? 4.2
        : p.characterId === 'druid'
          ? 6.0
          : 5.2;
  this.events.push({
    kind: 'skill_cast',
    playerId: p.id,
    skillId: skillDef.id,
    x: p.x,
    y: p.y,
    angle: p.aimAngle,
  });
  tryTriggerExecutionerScytheSlash(this, p);

  if (p.characterId === 'ranger') {
    // Predator Arrow: backflip i-frame + high-damage piercing arrow (or 5-arrow fan with ranger_arrow_volley)
    const hasVolley = p.blessingIds.includes('ranger_arrow_volley');
    p.dashTimer = 0.16;
    p.invulnerableTimer = Math.max(p.invulnerableTimer, 0.35);
    p.dashDirX = -Math.cos(p.aimAngle);
    p.dashDirY = -Math.sin(p.aimAngle);
    this.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: this.tick,
      ownerId: p.id,
      team: 'player',
      weaponId: 'predator_arrow',
      x: p.x + Math.cos(p.aimAngle) * 18,
      y: p.y + Math.sin(p.aimAngle) * 18,
      angle: p.aimAngle,
      pelletCount: hasVolley ? 5 : 1,
      spreadRad: hasVolley ? 0.48 : 0,
      speed: 680,
      damage: hasVolley ? 22 : 28,
      radius: 6.5,
      knockback: 180,
      pierceCount: 5,
      bounceCount: 0,
      ttlSec: 1.5,
      element: p.activeImbueElement !== 'none' ? p.activeImbueElement : 'none',
      critChance: 1.0,
      amplifiedByShield: true,
      seed: this.rng.nextUint32(),
    });
    return;
  }

  if (p.characterId === 'elementalist') {
    // Elemental Orb: throw an orb that detonates into a 5s Elemental Zone, then rotate Lửa -> Băng -> Sét
    const cycle = ELEMENTALIST_ROTATION_ORDER;
    const curIdx = Math.max(0, cycle.indexOf(p.activeImbueElement));
    const orbEl = cycle[curIdx] ?? 'burn';
    const nextEl = cycle[(curIdx + 1) % cycle.length] ?? 'chill';
    p.activeImbueElement = nextEl;

    spawnElementalistOrbSkillZones(this, p, orbEl, nextEl, skillDef.durationSec);
    return;
  }

  if (p.characterId === 'druid') {
    // Sacred Tree: plant 1 tree (or 2 with druid_sacred_grove).
    // Planting on a downed teammate revives them immediately with 2 HP (cooldown x2).
    const hasPoisonRoots = p.blessingIds.includes('druid_poison_roots');
    const hasSacredGrove = p.blessingIds.includes('druid_sacred_grove');

    let targetX = clamp(
      p.x + Math.cos(p.aimAngle) * 80,
      TILE_SIZE * 2.2,
      this.map.width - TILE_SIZE * 2.2,
    );
    let targetY = clamp(
      p.y + Math.sin(p.aimAngle) * 80,
      TILE_SIZE * 2.2,
      this.map.height - TILE_SIZE * 2.2,
    );

    let revivedAnyDowned = false;
    for (const ally of this.getAllPlayers()) {
      if (
        ally.lifeState === 'downed' &&
        (distance(p.x, p.y, ally.x, ally.y) <= 185 ||
          distance(targetX, targetY, ally.x, ally.y) <= 120)
      ) {
        targetX = ally.x;
        targetY = ally.y;
        ally.lifeState = 'alive';
        ally.hp = 2;
        ally.armor = Math.min(ally.maxArmor, 2);
        ally.invulnerableTimer = 1.5;
        ally.downedTimer = 0;
        ally.reviveProgress = 0;
        ally.reviverPlayerId = null;
        p.statsRevives = (p.statsRevives ?? 0) + 1;
        revivedAnyDowned = true;
        this.events.push({
          kind: 'player_revived',
          playerId: ally.id,
          reviverId: p.id,
          x: ally.x,
          y: ally.y,
        });
      }
    }
    if (revivedAnyDowned) {
      p.skillCooldownTimer = skillDef.cooldownSec * 2;
    }

    const treeCount = hasSacredGrove ? 2 : 1;
    const perpAngle = p.aimAngle + Math.PI * 0.5;
    for (let t = 0; t < treeCount; t++) {
      const offset = treeCount === 2 ? (t === 0 ? -34 : 34) : 0;
      const tx = clamp(
        targetX + Math.cos(perpAngle) * offset,
        TILE_SIZE * 2,
        this.map.width - TILE_SIZE * 2,
      );
      const ty = clamp(
        targetY + Math.sin(perpAngle) * offset,
        TILE_SIZE * 2,
        this.map.height - TILE_SIZE * 2,
      );
      const resolved = this.map.resolveCircleCollision(tx, ty, 16);
      const auraRadius = hasSacredGrove ? 105 : 120;
      const rootedIds: number[] = [];

      // Root nearby enemies for 1.5s on initial growth
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i]!;
        if (!e.isDummy && e.hp > 0 && distance(resolved.x, resolved.y, e.x, e.y) <= auraRadius) {
          e.rootedTimer = Math.max(e.rootedTimer, 1.5);
          rootedIds.push(e.id);
          this.events.push({
            kind: 'status_applied',
            targetId: e.id,
            status: 'rooted',
            x: e.x,
            y: e.y,
          });
          if (hasPoisonRoots) {
            lashDruidPoisonRootsIntoWall(this, p.id, e);
          }
        }
      }

      // Initial pulse heals allies +1 HP (2 more ticks of +1 HP every 2s = max 3 HP per cast)
      for (const ally of this.getAllPlayers()) {
        if (
          ally.lifeState === 'alive' &&
          distance(resolved.x, resolved.y, ally.x, ally.y) <= auraRadius
        ) {
          ally.hp = Math.min(ally.maxHp, ally.hp + 1);
        }
      }

      const tree: SimSummonState = {
        id: ++this.nextEntityId,
        ownerPlayerId: p.id,
        kind: 'sacred_tree',
        nameVi: 'Cây Thiêng',
        x: resolved.x,
        y: resolved.y,
        radius: hasSacredGrove ? 15 : 18,
        auraRadius,
        hp: hasSacredGrove ? 36 : 48,
        maxHp: hasSacredGrove ? 36 : 48,
        ttlSec: skillDef.durationSec,
        maxTtlSec: skillDef.durationSec,
        tickTimer: hasPoisonRoots ? 1.8 : 2.0,
        healsRemaining: 2,
        charge: 0,
        poisonRoots: hasPoisonRoots,
        sacredGrove: hasSacredGrove,
        selfDestruct: false,
        rootedEnemyIds: rootedIds,
      };
      const ownerSummons = this.summons.filter(
        (s) => s.ownerPlayerId === p.id && s.hp > 0 && s.ttlSec > 0,
      );
      if (ownerSummons.length >= MAX_DEPLOYABLES_PER_PLAYER) {
        ownerSummons[0]!.ttlSec = 0;
      }
      this.summons.push(tree);
      this.events.push({
        kind: 'summon_spawned',
        summonId: tree.id,
        summonKind: 'sacred_tree',
        ownerPlayerId: p.id,
        x: tree.x,
        y: tree.y,
      });
    }
    return;
  }

  if (p.characterId === 'engineer') {
    // Tesla Turret: deploy 1 turret (or up to 2 parallel turrets with engineer_twin_turrets)
    const hasTwinTurrets = p.blessingIds.includes('engineer_twin_turrets');
    const hasSelfDestruct = p.blessingIds.includes('engineer_self_destruct');
    const maxTurrets = hasTwinTurrets ? 2 : 1;

    const existingTurrets = this.summons.filter(
      (s) => s.kind === 'tesla_turret' && s.ownerPlayerId === p.id && s.hp > 0 && s.ttlSec > 0,
    );
    const spawnCount = hasTwinTurrets && existingTurrets.length === 0 ? 2 : 1;
    while (existingTurrets.length + spawnCount > maxTurrets && existingTurrets.length > 0) {
      const oldest = existingTurrets.shift()!;
      oldest.ttlSec = 0;
      oldest.hp = 0;
    }

    const perpAngle = p.aimAngle + Math.PI * 0.5;
    for (let t = 0; t < spawnCount; t++) {
      const lateral = spawnCount === 2 ? (t === 0 ? -28 : 28) : 0;
      const baseX = p.x + Math.cos(p.aimAngle) * 48 + Math.cos(perpAngle) * lateral;
      const baseY = p.y + Math.sin(p.aimAngle) * 48 + Math.sin(perpAngle) * lateral;
      const resolved = this.map.resolveCircleCollision(
        clamp(baseX, TILE_SIZE * 2, this.map.width - TILE_SIZE * 2),
        clamp(baseY, TILE_SIZE * 2, this.map.height - TILE_SIZE * 2),
        15,
      );

      const turret: SimSummonState = {
        id: ++this.nextEntityId,
        ownerPlayerId: p.id,
        kind: 'tesla_turret',
        nameVi: 'Trụ Tesla',
        x: resolved.x,
        y: resolved.y,
        radius: 15,
        auraRadius: 195,
        hp: 45,
        maxHp: 45,
        ttlSec: skillDef.durationSec,
        maxTtlSec: skillDef.durationSec,
        tickTimer: 0.15,
        healsRemaining: 0,
        charge: 0,
        poisonRoots: false,
        selfDestruct: hasSelfDestruct,
        rootedEnemyIds: [],
      };
      const ownerSummons = this.summons.filter(
        (s) => s.ownerPlayerId === p.id && s.hp > 0 && s.ttlSec > 0,
      );
      if (ownerSummons.length >= MAX_DEPLOYABLES_PER_PLAYER) {
        ownerSummons[0]!.ttlSec = 0;
      }
      this.summons.push(turret);
      this.events.push({
        kind: 'summon_spawned',
        summonId: turret.id,
        summonKind: 'tesla_turret',
        ownerPlayerId: p.id,
        x: turret.x,
        y: turret.y,
      });
    }

    // Immediate small armor boost to nearby allies on deployment
    for (const ally of this.getAllPlayers()) {
      if (ally.lifeState === 'alive' && distance(p.x, p.y, ally.x, ally.y) <= 140) {
        ally.armor = Math.min(ally.maxArmor, ally.armor + 1);
      }
    }
  }
}

export function updateSkillZonesAndSummonsImpl(this: WorldSim, dtSec: number): void {
  // 1. Update Elemental Skill Zones (Lam Hỏa's Cầu Nguyên Tố)
  let zoneWrite = 0;
  for (let i = 0; i < this.skillZones.length; i++) {
    const z = this.skillZones[i]!;
    z.ttlSec -= dtSec;
    if (z.ttlSec <= 0) continue;

    if (z.vortex) {
      const pullRadius = z.maxTtlSec <= 1.0 ? z.radius : Math.max(150, z.radius + 60);
      const basePullSpeed = z.maxTtlSec <= 1.0 ? 175 : 95;
      for (let j = 0; j < this.enemies.length; j++) {
        const e = this.enemies[j]!;
        if (
          e.hp <= 0 ||
          e.aiState === 'spawning' ||
          e.defId === 'thorn_turret' ||
          e.defId === 'spore_guardian' ||
          e.bossBurrowed
        ) {
          continue;
        }
        const d = distance(z.x, z.y, e.x, e.y);
        if (d > 10 && d <= pullRadius) {
          const pullStrength = (e.isBoss ? 38 : basePullSpeed) * dtSec;
          const nx = e.x + ((z.x - e.x) / d) * pullStrength;
          const ny = e.y + ((z.y - e.y) / d) * pullStrength;
          const col = this.map.resolveCircleCollision(nx, ny, e.radius);
          e.x = col.x;
          e.y = col.y;
        }
      }
    }

    z.tickTimer -= dtSec;
    const didTickThisStep = z.tickTimer <= 0;
    if (didTickThisStep) {
      z.tickTimer = 0.5;
      this.applyElementAtWorldPoint(z.x, z.y, z.element, z.radius * 0.65);
      for (let j = 0; j < this.enemies.length; j++) {
        const e = this.enemies[j]!;
        if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
        if (distance(z.x, z.y, e.x, e.y) <= z.radius + e.radius) {
          const ang = Math.atan2(e.y - z.y, e.x - z.x);
          this.applyDamageToEnemy(e, 6, false, z.element, ang, 20, false, z.ownerPlayerId);
          if (e.hp > 0 && z.secondaryElement !== 'none') {
            this.applyDamageToEnemy(
              e,
              5,
              false,
              z.secondaryElement,
              ang,
              15,
              false,
              z.ownerPlayerId,
            );
          }
        }
      }
    }
    updateElementalistVortexPropsAndTwinBeam(this, z, dtSec, didTickThisStep);

    this.skillZones[zoneWrite++] = z;
  }
  this.skillZones.length = zoneWrite;

  // 2. Update Summons (Mộc Linh's Cây Thiêng & Bánh Răng's Trụ Tesla / Ụ Pháo Cổ)
  let summonWrite = 0;
  for (let i = 0; i < this.summons.length; i++) {
    const s = this.summons[i]!;
    s.ttlSec -= dtSec;

    if (s.ttlSec > 0 && s.hp > 0) {
      if (s.kind === 'sacred_tree') {
        // Root any enemy entering Sacred Tree aura for the first time
        for (let j = 0; j < this.enemies.length; j++) {
          const e = this.enemies[j]!;
          if (e.isDummy || e.hp <= 0 || e.aiState === 'spawning') continue;
          if (
            distance(s.x, s.y, e.x, e.y) <= s.auraRadius + e.radius &&
            !s.rootedEnemyIds.includes(e.id)
          ) {
            s.rootedEnemyIds.push(e.id);
            e.rootedTimer = Math.max(e.rootedTimer, 1.5);
            this.events.push({
              kind: 'status_applied',
              targetId: e.id,
              status: 'rooted',
              x: e.x,
              y: e.y,
            });
          }
        }

        s.tickTimer -= dtSec;
        if (s.tickTimer <= 0) {
          s.tickTimer = s.poisonRoots ? 1.8 : 2.0;
          if (s.healsRemaining > 0) {
            s.healsRemaining -= 1;
            for (const ally of this.getAllPlayers()) {
              if (
                ally.lifeState === 'alive' &&
                distance(s.x, s.y, ally.x, ally.y) <= s.auraRadius
              ) {
                ally.hp = Math.min(ally.maxHp, ally.hp + 1);
              }
            }
          }
          if (s.poisonRoots) {
            for (let j = 0; j < this.enemies.length; j++) {
              const e = this.enemies[j]!;
              if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
              if (distance(s.x, s.y, e.x, e.y) <= s.auraRadius + e.radius) {
                lashDruidPoisonRootsIntoWall(this, s.ownerPlayerId, e);
              }
            }
          }
        }
      } else if (s.kind === 'tesla_turret' || s.kind === 'ancient_turret') {
        s.tickTimer -= dtSec;
        if (s.tickTimer <= 0) {
          const rateBoost = 1 + (s.charge / 100) * 0.65;
          s.tickTimer = (s.kind === 'ancient_turret' ? 0.7 : 0.85) / rateBoost;

          // Prioritize Marked targets (Synergy with Ranger's Predator Arrow!), otherwise nearest enemy
          let target: SimEnemyState | null = null;
          let bestScore = Infinity;
          for (let j = 0; j < this.enemies.length; j++) {
            const e = this.enemies[j]!;
            if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
            const d = distance(s.x, s.y, e.x, e.y);
            if (d > s.auraRadius) continue;
            // Marked enemies get a -10000 distance priority score so turret always locks onto them first!
            const score = (e.markedTimer > 0 ? -10000 : 0) + (e.isDummy ? 5000 : 0) + d;
            if (score < bestScore) {
              bestScore = score;
              target = e;
            }
          }

          if (target) {
            const ang = Math.atan2(target.y - s.y, target.x - s.x);
            let zapDmg = s.kind === 'ancient_turret' ? 12 : 11;
            let extraChainTargets = 0;

            // Helper to compute distance from point (px, py) to segment (s.x, s.y) -> (target.x, target.y)
            const segDx = target.x - s.x;
            const segDy = target.y - s.y;
            const segLenSq = segDx * segDx + segDy * segDy;
            const distToZapLine = (px: number, py: number): number => {
              const t =
                segLenSq > 0
                  ? clamp(((px - s.x) * segDx + (py - s.y) * segDy) / segLenSq, 0, 1)
                  : 0;
              return distance(px, py, s.x + t * segDx, s.y + t * segDy);
            };

            // Synergy 1: Turret firing through an active Vanguard Shield Wall gets +30% damage & +1 chain target
            const allPlayers = this.getAllPlayers();
            for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
              const pl = allPlayers[pIdx]!;
              if (
                pl.lifeState !== 'alive' ||
                pl.characterId !== 'vanguard' ||
                pl.skillActiveTimer <= 0
              ) {
                continue;
              }
              if (distToZapLine(pl.x, pl.y) <= 44) {
                const halfShieldArc = pl.blessingIds.includes('vanguard_bastion_prism')
                  ? Math.PI
                  : (65 * Math.PI) / 180;
                if (Math.abs(angleDiff(ang, pl.aimAngle)) <= halfShieldArc) {
                  zapDmg = Math.round(zapDmg * 1.3);
                  extraChainTargets = 1;
                  break;
                }
              }
            }

            // Synergy 2: Turret firing through an Elementalist Skill Zone gets +15% damage & imbues zone element(s)
            for (let zIdx = 0; zIdx < this.skillZones.length; zIdx++) {
              const z = this.skillZones[zIdx]!;
              if (z.ttlSec <= 0) continue;
              if (distToZapLine(z.x, z.y) <= z.radius) {
                zapDmg = Math.round(zapDmg * 1.15);
                this.applyElementStatusToEnemy(target, z.element, zapDmg, z.ownerPlayerId);
                if (z.secondaryElement && z.secondaryElement !== 'none') {
                  this.applyElementStatusToEnemy(
                    target,
                    z.secondaryElement,
                    zapDmg,
                    z.ownerPlayerId,
                  );
                }
              }
            }

            this.events.push({
              kind: 'chain_lightning',
              fromX: s.x,
              fromY: s.y,
              toX: target.x,
              toY: target.y,
            });
            this.applyDamageToEnemy(
              target,
              zapDmg,
              target.markedTimer > 0,
              'shock',
              ang,
              55,
              false,
              s.ownerPlayerId,
            );

            if (extraChainTargets > 0) {
              for (let cIdx = 0; cIdx < this.enemies.length; cIdx++) {
                const other = this.enemies[cIdx]!;
                if (
                  other.id === target.id ||
                  other.hp <= 0 ||
                  other.aiState === 'spawning' ||
                  other.bossBurrowed
                ) {
                  continue;
                }
                if (distance(target.x, target.y, other.x, other.y) <= 135) {
                  this.events.push({
                    kind: 'chain_lightning',
                    fromX: target.x,
                    fromY: target.y,
                    toX: other.x,
                    toY: other.y,
                  });
                  this.applyDamageToEnemy(
                    other,
                    Math.max(4, Math.round(zapDmg * 0.75)),
                    false,
                    'shock',
                    ang,
                    35,
                    false,
                    s.ownerPlayerId,
                    true,
                  );
                  break;
                }
              }
            }
          }
        }
      } else if (s.kind === 'life_blossom') {
        s.tickTimer -= dtSec;
        if (s.tickTimer <= 1e-6) {
          s.tickTimer += 1.0;
          if (s.tickTimer <= 0) {
            s.tickTimer = 1.0;
          }
          for (let j = 0; j < this.enemies.length; j++) {
            const e = this.enemies[j]!;
            if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
            if (distance(s.x, s.y, e.x, e.y) <= s.auraRadius + e.radius) {
              const ang = Math.atan2(e.y - s.y, e.x - s.x);
              e.poisonTimer = Math.max(e.poisonTimer, 1.2);
              if (e.poisonStacks <= 0) {
                e.poisonTickTimer = Math.max(e.poisonTickTimer, 2.0);
              }
              e.lastElementOwnerId = s.ownerPlayerId;
              e.lastElementApplied = 'poison';
              this.applyDamageToEnemy(e, 6, false, 'none', ang, 25, false, s.ownerPlayerId, true);
              const lastEv = this.events[this.events.length - 1];
              if (lastEv && lastEv.kind === 'damage_dealt' && lastEv.targetId === e.id) {
                lastEv.element = 'poison';
              }
            }
          }
        }
      }

      this.summons[summonWrite++] = s;
    } else {
      // Summon expired or destroyed: check Engineer's Self-Destruct upgrade!
      if (s.kind === 'tesla_turret' && s.selfDestruct) {
        triggerEngineerTurretSelfDestruct(this, s);
      }
    }
  }
  this.summons.length = summonWrite;
  updateEngineerTwinTurretLaserFences(this, dtSec);
}

export function triggerTeslaEmpBlastImpl(this: WorldSim, turret: SimSummonState): void {
  turret.charge = 0;
  const empRadius = 165;
  let bulletsCleared = 0;

  // 1. Clear all enemy bullets around the turret
  const destroyedIds: number[] = [];
  for (let i = 0; i < this.projectiles.length; i++) {
    const b = this.projectiles[i]!;
    if (
      b.team === 'enemy' &&
      b.ttlSec > 0 &&
      distance(turret.x, turret.y, b.x, b.y) <= empRadius
    ) {
      b.ttlSec = 0;
      bulletsCleared += 1;
      destroyedIds.push(b.id);
    }
  }
  if (destroyedIds.length > 0 && !this.stressTestActive) {
    this.events.push({
      kind: 'projectiles_destroyed',
      ids: destroyedIds,
    });
  }

  // 2. Stun and deal shock damage to all enemies in EMP radius
  for (let i = 0; i < this.enemies.length; i++) {
    const e = this.enemies[i]!;
    if (e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
    if (distance(turret.x, turret.y, e.x, e.y) <= empRadius + e.radius) {
      if (!e.isDummy) {
        if (e.isBoss) {
          if (!(e.bossPhase >= 3 && e.aiState === 'telegraph')) {
            if ((e.bossFreezeDrTimer ?? 0) <= 0) e.bossFreezeCountWindow = 0;
            e.bossFreezeDrTimer = 8.0;
            const c = e.bossFreezeCountWindow ?? 0;
            e.aiState = 'stunned';
            e.stateTimer = Math.max(e.stateTimer, c === 0 ? 0.6 : c === 1 ? 0.3 : 0.15);
            e.bossFreezeCountWindow = c + 1;
          }
        } else {
          e.aiState = 'stunned';
          e.stateTimer = Math.max(e.stateTimer, 1.5);
        }
      }
      const ang = Math.atan2(e.y - turret.y, e.x - turret.x);
      this.applyDamageToEnemy(e, 22, true, 'shock', ang, 180, true, turret.ownerPlayerId);
    }
  }

  this.events.push({
    kind: 'emp_blast',
    x: turret.x,
    y: turret.y,
    radius: empRadius,
    bulletsCleared,
  });
  this.events.push({
    kind: 'hit_stop',
    durationMs: 45,
    trauma: 0.4,
  });
}

export function releaseVanguardShieldShockwaveImpl(this: WorldSim, p: SimPlayerState = this.player): void {
  const skillDef = CHARACTERS.vanguard.skill;
  const stored = p.shieldStoredBullets;
  p.skillActiveTimer = 0;
  p.skillCooldownTimer = Math.max(p.skillCooldownTimer, skillDef.cooldownSec - skillDef.durationSec);
  p.shieldStoredBullets = 0;

  const hasFortressUpgrade = hasPlayerBlessing(p, 'vanguard_bastion_prism');
  const hasChargeUpgrade = hasPlayerBlessing(p, 'vanguard_charge');
  const startX = p.x;
  const startY = p.y;
  const dirX = Math.cos(p.aimAngle);
  const dirY = Math.sin(p.aimAngle);

  if (hasChargeUpgrade) {
    for (let s = 0; s < 13; s++) {
      const resolved = this.map.resolveCircleCollision(p.x + dirX * 10, p.y + dirY * 10, p.radius);
      p.x = resolved.x;
      p.y = resolved.y;
    }
    this.events.push({ kind: 'dash_started', playerId: p.id, x: p.x, y: p.y, dirX, dirY });
  }

  const baseShockDmg = 12 + stored * 4 + (hasFortressUpgrade ? 8 : 0);
  const shockwaveDamage = baseShockDmg * (hasChargeUpgrade ? 2 : 1);
  const shockElement: ElementType =
    p.activeImbueElement !== 'none' ? p.activeImbueElement : hasChargeUpgrade ? 'burn' : 'none';
  const halfArc = hasFortressUpgrade ? Math.PI : (65 * Math.PI) / 180;
  const range = hasChargeUpgrade ? 165 : hasFortressUpgrade ? 150 : 135;

  triggerMeleeKickProps(this, p, halfArc, range, p.aimAngle);

  for (let i = 0; i < this.enemies.length; i++) {
    const e = this.enemies[i]!;
    if (e.hp <= 0 || e.aiState === 'spawning') continue;
    const hitInChargeCorridor =
      hasChargeUpgrade && pointToSegmentDist(e.x, e.y, startX, startY, p.x, p.y) <= p.radius + e.radius + 24;
    if (hitInChargeCorridor || isCircleInCone(p.x, p.y, p.aimAngle, halfArc, range, e)) {
      const angleToEnemy = hitInChargeCorridor ? p.aimAngle : Math.atan2(e.y - p.y, e.x - p.x);
      if (hasChargeUpgrade) {
        if (e.isBoss) {
          if (!(e.bossPhase >= 3 && e.aiState === 'telegraph')) {
            if ((e.bossFreezeDrTimer ?? 0) <= 0) e.bossFreezeCountWindow = 0;
            e.bossFreezeDrTimer = 8.0;
            const c = e.bossFreezeCountWindow ?? 0;
            e.aiState = 'stunned';
            e.stateTimer = Math.max(e.stateTimer, c === 0 ? 0.6 : c === 1 ? 0.3 : 0.15);
            e.bossFreezeCountWindow = c + 1;
            e.vx = 0;
            e.vy = 0;
            e.bossBurrowed = false;
          }
        } else {
          e.aiState = 'stunned';
          e.stateTimer = Math.max(e.stateTimer, 1.2);
          e.vx = 0;
          e.vy = 0;
          e.bossBurrowed = false;
        }
      }
      this.applyDamageToEnemy(
        e, shockwaveDamage, stored >= 2 || hasChargeUpgrade || hasFortressUpgrade,
        shockElement, angleToEnemy, hasChargeUpgrade ? 340 : 260, true, p.id,
      );
      if (hasChargeUpgrade && e.hp > 0 && !e.isBoss) {
        e.kbVx = dirX * 340;
        e.kbVy = dirY * 340;
        for (let step = 0; step < 9; step++) {
          const col = this.map.resolveCircleCollision(e.x + dirX * 10, e.y + dirY * 10, e.radius, true);
          e.x = col.x;
          e.y = col.y;
          if (col.collided) {
            triggerEnemyWallSlam(this, e, undefined, 340);
            break;
          }
        }
      }
    }
  }

  this.events.push({
    kind: 'shield_shockwave', playerId: p.id, x: p.x, y: p.y,
    angle: p.aimAngle, storedBullets: stored, damage: shockwaveDamage,
  });
  this.events.push({ kind: 'hit_stop', durationMs: 40, trauma: 0.35 });
}
