import { SeededRandom } from '../core/prng.js';
import type { ElementType, WeaponMutatorId, WeaponStatsDef } from '../data/types.js';
import {
  MAX_MUTATORS_PER_WEAPON_SLOT,
  getCompatibleWeaponMutators,
  isMutatorCompatibleWithWeapon,
} from '../data/weapon-mutators.js';
import { WEAPONS } from '../data/weapons.js';
import { findNearestWalkablePoint } from './arena-room-archetypes.js';
import type { DungeonRoomNode } from './dungeon-gen.js';
import {
  PERPETUAL_CORE_WINDOW_EXPAND_RATIO,
  hasPlayerAwakenedRelic,
} from './sim-ashen-pacts.js';
import { ACROBAT_RELOAD_WINDOW_MAX, ACROBAT_RELOAD_WINDOW_MIN } from './sim-blessings.js';
import { computeAdditivePoolMultiplier, computeUpgradeMultiplier } from './sim-damage-pipeline.js';
import { triggerEnemyWallSlam } from './sim-tactical-physics.js';
import { resolveSecondaryInfusedElementForShot } from './sim-weapon-mutators-p4a.js';
import type { WorldSim } from './world-sim.js';
import type {
  SimEnemyState,
  SimNpcState,
  SimPlayerState,
  SimProjectileState,
  SimPropState,
} from './world-sim-types.js';

const SINGULARITY_PULL_PROP_KINDS = new Set([
  'explosive_barrel',
  'volatile_spore_pod',
  'sliding_ice_block',
  'slag_crucible',
]);

export function getActiveSlotMutators(
  p: SimPlayerState | undefined | null,
): WeaponMutatorId[] {
  if (!p || !p.weaponMutators) return [];
  const list = p.weaponMutators[p.activeWeaponSlot];
  return Array.isArray(list) ? list : [];
}

export function hasActiveWeaponMutator(
  p: SimPlayerState | undefined | null,
  mutatorId: WeaponMutatorId,
): boolean {
  return getActiveSlotMutators(p).includes(mutatorId);
}

export function getClipReloadGoldenWindow(p: SimPlayerState): { min: number; max: number } {
  let min = p.acrobatExpandedWindow ? ACROBAT_RELOAD_WINDOW_MIN : 0.45;
  let max = p.acrobatExpandedWindow ? ACROBAT_RELOAD_WINDOW_MAX : 0.7;
  if (hasActiveWeaponMutator(p, 'mutator_thermal_meltdown')) {
    min = Math.min(min, 0.38);
    max = Math.max(max, 0.77);
  }
  if (hasPlayerAwakenedRelic(p, 'relic_perpetual_core')) {
    const halfExpand = (max - min) * (PERPETUAL_CORE_WINDOW_EXPAND_RATIO * 0.5);
    min = Math.max(0.05, min - halfExpand);
    max = Math.min(0.95, max + halfExpand);
  }
  return { min, max };
}

export function getHeatVentOrangeZone(p: SimPlayerState): { min: number; max: number } {
  let min = hasActiveWeaponMutator(p, 'mutator_thermal_meltdown') ? 50 : 65;
  const max = 95;
  if (hasPlayerAwakenedRelic(p, 'relic_perpetual_core')) {
    min = Math.max(25, min - (max - min) * PERPETUAL_CORE_WINDOW_EXPAND_RATIO);
  }
  return { min, max };
}

export function populateTreasureForgeWorkshop(
  sim: WorldSim,
  room: DungeonRoomNode,
  hasSavedState = false,
): void {
  const cx = sim.map.width * 0.5;
  const cy = sim.map.height * 0.5;

  if (!hasSavedState && !room.chestOpened) {
    const rarity = room.chestRarity ?? sim.rollChestRarity(1);
    sim.spawnChest(cx - 64, cy + 12, rarity, room.chestWeaponId ?? undefined);
  }

  const localFloor: 1 | 2 = sim.currentFloor % 2 === 1 ? 1 : 2;
  const anvilKind = localFloor === 1 ? 'daedalus_anvil' : 'upgrade_anvil';
  const anvilPos = findNearestWalkablePoint(sim.map, cx + 64, cy - 12, 18);
  const anvilX = anvilPos.x;
  const anvilY = anvilPos.y;
  const usedIds = room.anvilUsedByPlayerIds ? [...room.anvilUsedByPlayerIds] : [];
  room.anvilUsedByPlayerIds = usedIds;

  sim.npcEntities.push({
    id: sim.nextEntityId++,
    kind: anvilKind,
    nameVi: anvilKind === 'daedalus_anvil' ? 'Đe Rèn Daedalus' : 'Đe Rèn Cường Hóa',
    dialogueVi:
      anvilKind === 'daedalus_anvil'
        ? '[E] ĐỘ BÚA RÈN DAEDALUS'
        : '[E] CƯỜNG HÓA VŨ KHÍ (+20% DMG)',
    x: anvilX,
    y: anvilY,
    radius: 26,
    interacted: false,
    costHp: 0,
    usedByPlayerIds: usedIds,
  });

  sim.props.push({
    id: sim.nextEntityId++,
    kind: anvilKind,
    x: anvilX,
    y: anvilY,
    radius: 18,
    hp: 9999,
    maxHp: 9999,
    destructible: false,
    explosive: false,
    blocksMovement: true,
    lightRadius: 84,
    lightColorHex: anvilKind === 'daedalus_anvil' ? '#f97316' : '#38bdf8',
    hitFlashTimer: 0,
    fuseTimer: 0,
  });
}

export function hasPlayerUsedAnvil(
  npc: SimNpcState,
  room: DungeonRoomNode | undefined,
  playerId: number,
): boolean {
  if (npc.usedByPlayerIds?.includes(playerId)) return true;
  if (room?.anvilUsedByPlayerIds?.includes(playerId)) return true;
  return false;
}

function markPlayerUsedAnvil(
  npc: SimNpcState,
  room: DungeonRoomNode | undefined,
  playerId: number,
): void {
  npc.usedByPlayerIds ??= [];
  if (!npc.usedByPlayerIds.includes(playerId)) {
    npc.usedByPlayerIds.push(playerId);
  }
  if (room) {
    room.anvilUsedByPlayerIds ??= [];
    if (!room.anvilUsedByPlayerIds.includes(playerId)) {
      room.anvilUsedByPlayerIds.push(playerId);
    }
  }
}

export function activateDaedalusAnvilImpl(
  sim: WorldSim,
  npc: SimNpcState,
  targetPlayer?: SimPlayerState,
): boolean {
  const p = targetPlayer ?? sim.player;
  if (!p || p.lifeState !== 'alive') return false;
  const room = sim.getCurrentRoom();
  if (hasPlayerUsedAnvil(npc, room, p.id)) return false;

  const slot = p.activeWeaponSlot;
  const weaponId = p.weaponSlots[slot] ?? p.weaponSlots[0] ?? 'knight_sword';
  p.weaponMutators ??= { 0: [], 1: [] };
  const existing = p.weaponMutators[slot] ?? [];
  if (existing.length >= MAX_MUTATORS_PER_WEAPON_SLOT) return false;

  const pool = getCompatibleWeaponMutators(weaponId, existing);
  if (pool.length === 0) return false;

  const seed =
    (Number(sim.baseSeed) || 0x1337c0de) ^
    Math.imul(sim.currentFloor, 0x9e3779b1) ^
    Math.imul(sim.currentRoomId + 1, 0x85ebca6b) ^
    Math.imul(p.id, 0xc2b2ae35);
  const rng = new SeededRandom(seed >>> 0);
  const candidates = [...pool];
  const choices: WeaponMutatorId[] = [];
  while (choices.length < 2 && candidates.length > 0) {
    const idx = rng.nextInt(0, candidates.length - 1);
    choices.push(candidates[idx]!);
    candidates.splice(idx, 1);
  }

  p.mutatorChoices = choices;
  sim.events.push({
    kind: 'status_applied',
    targetId: p.id,
    status: 'burn',
    x: npc.x,
    y: npc.y,
  });
  return true;
}

export function selectWeaponMutatorImpl(
  sim: WorldSim,
  mutatorId: WeaponMutatorId,
  playerId?: number,
): boolean {
  const p = playerId !== undefined ? (sim.getPlayerById(playerId) ?? sim.player) : sim.player;
  if (!p) return false;
  if (!p.mutatorChoices || !p.mutatorChoices.includes(mutatorId)) return false;

  const slot = p.activeWeaponSlot;
  const weaponId = p.weaponSlots[slot] ?? p.weaponSlots[0] ?? 'knight_sword';
  if (!isMutatorCompatibleWithWeapon(mutatorId, weaponId)) return false;

  p.weaponMutators ??= { 0: [], 1: [] };
  const slotMutators = (p.weaponMutators[slot] ??= []);
  if (slotMutators.length >= MAX_MUTATORS_PER_WEAPON_SLOT) return false;
  if (slotMutators.includes(mutatorId)) return false;

  slotMutators.push(mutatorId);
  p.mutatorChoices = [];

  const room = sim.getCurrentRoom();
  const anvil = sim.npcEntities.find((n) => n.kind === 'daedalus_anvil');
  if (anvil) {
    markPlayerUsedAnvil(anvil, room, p.id);
  } else if (room) {
    room.anvilUsedByPlayerIds ??= [];
    if (!room.anvilUsedByPlayerIds.includes(p.id)) {
      room.anvilUsedByPlayerIds.push(p.id);
    }
  }

  sim.events.push({
    kind: 'status_applied',
    targetId: p.id,
    status: 'burn',
    x: p.x,
    y: p.y,
  });
  return true;
}

export function activateUpgradeAnvilImpl(
  sim: WorldSim,
  npc: SimNpcState,
  targetPlayer?: SimPlayerState,
): boolean {
  const p = targetPlayer ?? sim.player;
  if (!p || p.lifeState !== 'alive') return false;
  const room = sim.getCurrentRoom();
  if (hasPlayerUsedAnvil(npc, room, p.id)) return false;

  const slot = p.activeWeaponSlot;
  p.weaponUpgradeLevels ??= { 0: 0, 1: 0 };
  const currentLevel = p.weaponUpgradeLevels[slot] ?? 0;
  if (currentLevel >= 3) return false;

  p.weaponUpgradeLevels[slot] = Math.min(3, currentLevel + 1);
  markPlayerUsedAnvil(npc, room, p.id);

  sim.events.push({
    kind: 'status_applied',
    targetId: p.id,
    status: 'shock',
    x: npc.x,
    y: npc.y,
  });
  return true;
}

export function applyFinaleJoltSafeRecoil(
  sim: WorldSim,
  p: SimPlayerState,
  aimAngle: number,
  distance = 48,
): void {
  const recoilAngle = aimAngle + Math.PI;
  const dirX = Math.cos(recoilAngle);
  const dirY = Math.sin(recoilAngle);
  const steps = 24;
  const stepLen = distance / steps;

  for (let i = 0; i < steps; i++) {
    const candX = p.x + dirX * stepLen;
    const candY = p.y + dirY * stepLen;
    if (
      sim.map.getSurfaceAtWorld(candX, candY) === 'chasm' ||
      sim.map.getSurfaceAtWorld(candX + dirX * (p.radius + 2), candY + dirY * (p.radius + 2)) ===
        'chasm'
    ) {
      break;
    }
    const wallResolved = sim.map.resolveCircleCollision(candX, candY, p.radius, false);
    const propEntity = { x: wallResolved.x, y: wallResolved.y, radius: p.radius };
    sim.resolvePropMovementCollision(propEntity);
    if (sim.map.getSurfaceAtWorld(propEntity.x, propEntity.y) === 'chasm') {
      break;
    }
    p.x = propEntity.x;
    p.y = propEntity.y;
  }
}

export function triggerFinaleJoltVentBurst(
  sim: WorldSim,
  p: SimPlayerState,
  weaponId: string,
): void {
  if (!hasActiveWeaponMutator(p, 'mutator_finale_jolt')) return;
  const weapon = WEAPONS[weaponId];
  if (!weapon || weapon.category === 'melee') return;

  const slotUpgradeLevel = p.weaponUpgradeLevels?.[p.activeWeaponSlot] ?? 0;
  const upgradeMult = computeUpgradeMultiplier(slotUpgradeLevel);
  const tempBuffMult = p.elementalConvergenceTimer > 0 ? 1.25 : 1.0;
  let damage = Math.max(
    1,
    Math.round(
      weapon.damage *
        upgradeMult *
        computeAdditivePoolMultiplier(0.4) *
        tempBuffMult,
    ),
  );
  if (hasActiveWeaponMutator(p, 'mutator_prism_splitter')) {
    damage = Math.max(1, Math.round(damage * 0.8));
  }

  const bypassShield = hasActiveWeaponMutator(p, 'mutator_thermal_meltdown');
  const singularity = hasActiveWeaponMutator(p, 'mutator_gravity_singularity');
  const harpoon = hasActiveWeaponMutator(p, 'mutator_chain_harpoon');

  const volleyEvent = {
    kind: 'bullet_volley_spawned' as const,
    eventId: sim.nextVolleyEventId++,
    tick: sim.tick,
    ownerId: p.id,
    team: 'player' as const,
    weaponId: weapon.id,
    x: p.x + Math.cos(p.aimAngle) * (p.radius + 8),
    y: p.y + Math.sin(p.aimAngle) * (p.radius + 8),
    angle: p.aimAngle,
    pelletCount: 3,
    spreadRad: Math.max((weapon.spreadDeg * Math.PI) / 180, 0.2),
    speed: Math.max(420, weapon.projectileSpeed || 500),
    damage,
    radius: 5,
    knockback: weapon.knockback,
    pierceCount: weapon.pierceCount,
    bounceCount: weapon.bounceCount + p.bonusBounceCurrentClip,
    ttlSec: 1.35,
    element: p.activeImbueElement !== 'none' ? p.activeImbueElement : weapon.element,
    critChance: weapon.critChance,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    gravitySingularityShot: singularity || undefined,
    chainHarpoonShot: harpoon || undefined,
    bypassFrontShield: bypassShield || undefined,
    clusterMortarLob: hasActiveWeaponMutator(p, 'mutator_cluster_mortar') || undefined,
    secondaryInfusedElement: resolveSecondaryInfusedElementForShot(p, true),
  };

  sim.spawnDeterministicVolley(volleyEvent);
  sim.events.push(volleyEvent);
  applyFinaleJoltSafeRecoil(sim, p, p.aimAngle, 48);
}

export function spawnShockwaveEdgeBlade(
  sim: WorldSim,
  p: SimPlayerState,
  weapon: WeaponStatsDef,
  baseMeleeDmg: number,
  element: ElementType,
  critChance: number,
): void {
  const speed = 560;
  const ttlSec = 180 / speed;
  const damage = Math.max(1, Math.round(baseMeleeDmg * 0.6));
  const singularity =
    hasActiveWeaponMutator(p, 'mutator_gravity_singularity') && p.meleeComboStep === 2;

  const volleyEvent = {
    kind: 'bullet_volley_spawned' as const,
    eventId: sim.nextVolleyEventId++,
    tick: sim.tick,
    ownerId: p.id,
    team: 'player' as const,
    weaponId: 'shockwave_edge_blade',
    x: p.x + Math.cos(p.aimAngle) * (p.radius + 10),
    y: p.y + Math.sin(p.aimAngle) * (p.radius + 10),
    angle: p.aimAngle,
    pelletCount: 1,
    spreadRad: 0,
    speed,
    damage,
    radius: 12,
    knockback: Math.round(weapon.knockback * 0.6),
    pierceCount: 3,
    bounceCount: 0,
    ttlSec,
    element,
    critChance,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    gravitySingularityShot: singularity || undefined,
  };

  sim.spawnDeterministicVolley(volleyEvent);
  sim.events.push(volleyEvent);
}

export function applyGravitySingularityOnHit(
  sim: WorldSim,
  b: SimProjectileState,
  e: SimEnemyState,
): void {
  e.gravitySingularityTimer = 1.8;
  e.gravitySingularityOwnerId = b.ownerId;
  sim.events.push({
    kind: 'status_applied',
    targetId: e.id,
    status: 'shock',
    x: e.x,
    y: e.y,
  });
}

export function updateGravitySingularities(sim: WorldSim, dtSec: number): void {
  const pullRadius = 140;
  const pullSpeed = 160;

  for (let i = 0; i < sim.enemies.length; i++) {
    const anchor = sim.enemies[i]!;
    if (anchor.hp <= 0 || !anchor.gravitySingularityTimer || anchor.gravitySingularityTimer <= 0) {
      continue;
    }
    anchor.gravitySingularityTimer = Math.max(0, anchor.gravitySingularityTimer - dtSec);

    for (let j = 0; j < sim.enemies.length; j++) {
      const other = sim.enemies[j]!;
      if (other.id === anchor.id || other.hp <= 0 || other.bossBurrowed) continue;
      const dx = anchor.x - other.x;
      const dy = anchor.y - other.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 10 || dist > pullRadius) continue;

      const step = Math.min(dist - 10, pullSpeed * dtSec);
      const nx = other.x + (dx / dist) * step;
      const ny = other.y + (dy / dist) * step;
      if (sim.map.getSurfaceAtWorld(nx, ny) === 'chasm') continue;
      const resolved = sim.map.resolveCircleCollision(nx, ny, other.radius, false);
      other.x = resolved.x;
      other.y = resolved.y;
    }

    for (let k = 0; k < sim.props.length; k++) {
      const prop = sim.props[k]!;
      if (prop.hp <= 0 || !SINGULARITY_PULL_PROP_KINDS.has(prop.kind)) continue;
      const dx = anchor.x - prop.x;
      const dy = anchor.y - prop.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 10 || dist > pullRadius) continue;

      const step = Math.min(dist - 10, pullSpeed * dtSec);
      const nx = prop.x + (dx / dist) * step;
      const ny = prop.y + (dy / dist) * step;
      if (sim.map.getSurfaceAtWorld(nx, ny) === 'chasm') continue;
      const resolved = sim.map.resolveCircleCollision(nx, ny, prop.radius, false);
      prop.x = resolved.x;
      prop.y = resolved.y;
    }
  }
}

export function applyChainHarpoonOnHit(
  sim: WorldSim,
  b: SimProjectileState,
  e: SimEnemyState,
): void {
  if (e.hp <= 0) return;
  const maxRange = 220;

  let nearestCover: SimPropState | undefined;
  let nearestCoverDist = maxRange + 1;
  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0 || prop.coverState !== 'flipped') continue;
    const d = Math.hypot(prop.x - e.x, prop.y - e.y);
    if (d <= maxRange && d < nearestCoverDist) {
      nearestCoverDist = d;
      nearestCover = prop;
    }
  }

  e.lastHitPlayerId = b.ownerId;
  e.wallSlamCooldownTimer = 0;

  if (nearestCover) {
    const dx = nearestCover.x - e.x;
    const dy = nearestCover.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const stopDist = nearestCover.radius + e.radius + 2;
    const col = sim.map.resolveCircleCollision(
      nearestCover.x - dirX * stopDist,
      nearestCover.y - dirY * stopDist,
      e.radius,
      false,
    );
    e.x = col.x;
    e.y = col.y;
    if (!sim.stressTestActive) {
      sim.resolvePropMovementCollision(e);
      const postCol = sim.map.resolveCircleCollision(e.x, e.y, e.radius, false);
      e.x = postCol.x;
      e.y = postCol.y;
    }
    e.kbVx = dirX * 260;
    e.kbVy = dirY * 260;
    triggerEnemyWallSlam(sim, e, nearestCover, 260);
    return;
  }

  // Otherwise find nearest wall/obstacle within 220px across 16 ray directions
  let bestWallX = e.x;
  let bestWallY = e.y;
  let bestDirX = Math.cos(b.angle);
  let bestDirY = Math.sin(b.angle);
  let foundWallDist = maxRange + 1;

  for (let ray = 0; ray < 16; ray++) {
    const angle = (ray * Math.PI * 2) / 16;
    const rdx = Math.cos(angle);
    const rdy = Math.sin(angle);
    for (let dist = 16; dist <= maxRange; dist += 16) {
      const tx = e.x + rdx * dist;
      const ty = e.y + rdy * dist;
      const res = sim.map.resolveCircleCollision(tx, ty, e.radius, false);
      if (res.collided && dist < foundWallDist) {
        foundWallDist = dist;
        bestWallX = res.x;
        bestWallY = res.y;
        bestDirX = rdx;
        bestDirY = rdy;
        break;
      }
    }
  }

  if (foundWallDist <= maxRange) {
    e.x = bestWallX;
    e.y = bestWallY;
    if (!sim.stressTestActive) {
      sim.resolvePropMovementCollision(e);
      const postCol = sim.map.resolveCircleCollision(e.x, e.y, e.radius, false);
      e.x = postCol.x;
      e.y = postCol.y;
    }
    e.kbVx = bestDirX * 260;
    e.kbVy = bestDirY * 260;
    triggerEnemyWallSlam(sim, e, undefined, 260);
  }
}

export * from './sim-weapon-mutators-p4a.js';
