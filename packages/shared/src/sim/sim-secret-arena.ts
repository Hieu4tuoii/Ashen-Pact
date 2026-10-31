import { ELITE_MODIFIERS } from '../data/enemies.js';
import { COOP_SCALING } from '../data/scaling.js';
import type { EliteModifier } from '../data/types.js';
import { ALL_WEAPON_IDS, WEAPONS } from '../data/weapons.js';
import { distance } from '../math/vec2.js';
import { findNearestWalkablePoint } from './arena-room-archetypes.js';
import type { DungeonRoomNode } from './dungeon-gen.js';
import type { PropKind, SimNpcState, SimPlayerState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export const SECRET_ARENA_DURATION_SEC = 20.0;
export const SECRET_ARENA_VICTORY_GOLD = 40;
export const SECRET_ARENA_BARRICADE_COUNT = 4;
export const SECRET_ARENA_BARREL_COUNT = 2;
const SECRET_ARENA_BANNER_DURATION_SEC = 4.0;

const SECRET_ARENA_BIOME_POOLS: Record<1 | 2 | 3, readonly string[]> = {
  1: ['goblin_shooter', 'wild_boar', 'spore_bomber', 'goblin_shaman'],
  2: ['frost_bat', 'baby_yeti', 'ice_mage', 'ice_golem'],
  3: ['fire_imp', 'dwarf_cannon', 'coal_golem', 'iron_shielder'],
};

const LEGENDARY_WEAPON_IDS: readonly string[] = ALL_WEAPON_IDS.filter(
  (id) => WEAPONS[id]?.rarity === 'legendary',
);

function getBiomeBarricadeKind(biome: 1 | 2 | 3): PropKind {
  if (biome === 2) return 'glacial_barricade';
  if (biome === 3) return 'forge_blast_shield';
  return 'moss_table';
}

function rollGuaranteedLegendaryWeaponId(sim: WorldSim): string {
  const rolled = sim.rollRandomWeaponByRarities(['legendary']);
  if (WEAPONS[rolled]?.rarity === 'legendary') {
    return rolled;
  }
  return LEGENDARY_WEAPON_IDS.length > 0 ? sim.rng.pick(LEGENDARY_WEAPON_IDS) : rolled;
}

function countAliveSecretTrialEnemies(sim: WorldSim): number {
  let count = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.secretTrialEnemy && !e.isDummy && e.defId !== 'ashen_executioner' && e.hp > 0) {
      count += 1;
    }
  }
  return count;
}

function purgeEnemyProjectilesAndHazards(sim: WorldSim): void {
  const destroyedIds: number[] = [];
  let writeIdx = 0;
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team === 'enemy') {
      destroyedIds.push(b.id);
      sim.releaseProjectileToPool(b);
    } else {
      sim.projectiles[writeIdx++] = b;
    }
  }
  sim.projectiles.length = writeIdx;
  if (destroyedIds.length > 0) {
    sim.recordDestroyedProjectiles(destroyedIds);
  }
  sim.pendingVengefulRings.length = 0;
  sim.pendingMortarStrikes.length = 0;
  sim.shockwaveRings.length = 0;
}

function resolveSafePropPoint(
  sim: WorldSim,
  targetX: number,
  targetY: number,
  radius: number,
): { x: number; y: number } {
  let x = targetX;
  let y = targetY;
  const players = sim.getAllPlayers();
  for (let i = 0; i < players.length; i++) {
    const pl = players[i]!;
    if (pl.lifeState !== 'alive') continue;
    const minSep = pl.radius + radius + 16;
    const d = distance(x, y, pl.x, pl.y);
    if (d < minSep) {
      const ang = d > 1e-3 ? Math.atan2(y - pl.y, x - pl.x) : 0;
      x = pl.x + Math.cos(ang) * minSep;
      y = pl.y + Math.sin(ang) * minSep;
    }
  }
  return findNearestWalkablePoint(sim.map, x, y, radius);
}

export function spawnSecretChallengeCrystal(sim: WorldSim, room: DungeonRoomNode): SimNpcState {
  const cx = sim.map.width * 0.5;
  const cy = sim.map.height * 0.5;
  const pt = findNearestWalkablePoint(sim.map, cx, cy - 96, 20);
  const attempted = Boolean(room.secretTrialAttempted);
  const crystal: SimNpcState = {
    id: ++sim.nextEntityId,
    kind: 'secret_challenge_crystal',
    nameVi: 'Tinh Thể Khiêu Chiến Bí Mật',
    dialogueVi: attempted
      ? 'Tinh Thể Khiêu Chiến đã khép lại.'
      : '[E] KHIÊU CHIẾN 20 GIÂY — THĂNG HOA RƯƠNG HUYỀN THOẠI',
    x: pt.x,
    y: pt.y,
    radius: 20,
    interacted: attempted,
    costHp: 0,
    costGold: 0,
  };
  sim.npcEntities.push(crystal);
  return crystal;
}

export function activateSecretChallengeCrystal(
  sim: WorldSim,
  crystal: SimNpcState,
  actor?: SimPlayerState,
): boolean {
  if (
    crystal.kind !== 'secret_challenge_crystal' ||
    crystal.interacted ||
    sim.secretTrialActive
  ) {
    return false;
  }
  if (actor && actor.lifeState !== 'alive') {
    return false;
  }
  const room = sim.getCurrentRoom();
  if (room.secretTrialAttempted) {
    crystal.interacted = true;
    return false;
  }

  crystal.interacted = true;
  crystal.dialogueVi = 'Tinh Thể Khiêu Chiến đã khép lại.';
  room.secretTrialAttempted = true;

  const cx = sim.map.width * 0.5;
  const cy = sim.map.height * 0.5;
  const barricadeKind = getBiomeBarricadeKind(sim.currentBiome);

  const barricadeAnchors: readonly [number, number][] = [
    [cx - 170, cy - 85],
    [cx + 170, cy - 85],
    [cx - 170, cy + 85],
    [cx + 170, cy + 85],
  ];
  for (let i = 0; i < SECRET_ARENA_BARRICADE_COUNT; i++) {
    const [bx, by] = barricadeAnchors[i % barricadeAnchors.length]!;
    const pt = resolveSafePropPoint(sim, bx, by, 18);
    sim.spawnProp(barricadeKind, pt.x, pt.y);
  }

  const barrelAnchors: readonly [number, number][] = [
    [cx - 236, cy],
    [cx + 236, cy],
  ];
  for (let i = 0; i < SECRET_ARENA_BARREL_COUNT; i++) {
    const [ex, ey] = barrelAnchors[i % barrelAnchors.length]!;
    const pt = resolveSafePropPoint(sim, ex, ey, 15);
    sim.spawnProp('explosive_barrel', pt.x, pt.y);
  }

  const playerCount = sim.getActivePlayerCount();
  const baseCount = sim.currentFloor >= 3 ? 5 : 4;
  const totalEnemies = Math.max(
    4,
    Math.min(8, Math.round(baseCount * COOP_SCALING[playerCount].waveCountMultiplier)),
  );
  const eliteCount = playerCount >= 2 || sim.currentFloor >= 3 ? 3 : 2;
  const pool = SECRET_ARENA_BIOME_POOLS[sim.currentBiome];
  const alivePlayers = sim.getAllPlayers().filter((pl) => pl.lifeState === 'alive');

  const spawnAnchors: readonly [number, number][] = [
    [cx - 310, cy - 155],
    [cx + 310, cy - 155],
    [cx - 310, cy + 155],
    [cx + 310, cy + 155],
    [cx, cy + 195],
    [cx - 340, cy],
    [cx + 340, cy],
    [cx, cy - 185],
  ];

  for (let i = 0; i < totalEnemies; i++) {
    const defId = pool[(room.id + sim.currentFloor + i) % pool.length]!;
    const eliteMod: EliteModifier | null =
      i < eliteCount ? sim.rng.pick(ELITE_MODIFIERS) : null;

    let bestPt = { x: cx + 260, y: cy + 120 };
    let bestMinDist = -1;
    for (let k = 0; k < spawnAnchors.length; k++) {
      const [ax, ay] = spawnAnchors[(i + k) % spawnAnchors.length]!;
      const cand = findNearestWalkablePoint(sim.map, ax, ay, 18);
      let minDist = Infinity;
      for (let pIdx = 0; pIdx < alivePlayers.length; pIdx++) {
        const pl = alivePlayers[pIdx]!;
        const d = distance(cand.x, cand.y, pl.x, pl.y);
        if (d < minDist) minDist = d;
      }
      if (minDist >= 155) {
        bestPt = cand;
        break;
      }
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestPt = cand;
      }
    }

    const spawned = sim.spawnEnemy(defId, bestPt.x, bestPt.y, false, eliteMod);
    spawned.secretTrialEnemy = true;
  }

  sim.secretTrialActive = true;
  sim.secretTrialTimer = SECRET_ARENA_DURATION_SEC;
  sim.secretTrialResult = 'active';
  sim.secretTrialBannerTimer = 0;
  sim.secretTrialRemainingEnemies = countAliveSecretTrialEnemies(sim);
  sim.secretTrialActivatedTick = sim.tick;
  sim.rebuildCurrentRoomDoors();

  sim.events.push({
    kind: 'secret_trial_started',
    roomId: room.id,
    durationSec: SECRET_ARENA_DURATION_SEC,
    x: crystal.x,
    y: crystal.y,
  });

  return true;
}

function resolveSecretTrialVictory(sim: WorldSim): void {
  const room = sim.getCurrentRoom();
  sim.enemies = sim.enemies.filter((e) => !e.secretTrialEnemy);
  purgeEnemyProjectilesAndHazards(sim);

  const allPlayers = sim.getAllPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const pl = allPlayers[i]!;
    pl.gold += SECRET_ARENA_VICTORY_GOLD;
    sim.runStats.goldEarned += SECRET_ARENA_VICTORY_GOLD;
  }

  const primaryLegId = rollGuaranteedLegendaryWeaponId(sim);
  const chest = sim.chests[0];
  room.chestRarity = 'legendary';
  room.chestWeaponId = primaryLegId;

  if (chest && !chest.opened) {
    chest.rarity = 'legendary';
    chest.droppedWeaponId = primaryLegId;
  } else {
    if (chest) {
      chest.rarity = 'legendary';
      chest.droppedWeaponId = primaryLegId;
    }
    const baseX = chest ? chest.x : sim.map.width * 0.5;
    const baseY = chest ? chest.y : sim.map.height * 0.5 - 10;
    const isCoop = allPlayers.length > 1;
    for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
      const pl = allPlayers[pIdx]!;
      const wepId = pIdx === 0 ? primaryLegId : rollGuaranteedLegendaryWeaponId(sim);
      const wep = WEAPONS[wepId] ?? WEAPONS[primaryLegId]!;
      const offsetX = isCoop ? (pIdx - (allPlayers.length - 1) * 0.5) * 34 : 0;
      sim.spawnWorldItem({
        kind: 'weapon',
        weaponId: wep.id,
        rarity: 'legendary',
        nameVi: wep.nameVi,
        costGold: 0,
        healAmount: 0,
        x: baseX + offsetX,
        y: baseY + 28,
        fromX: baseX,
        fromY: baseY - 6,
        droppedAtTick: sim.tick,
        ownerPlayerId: isCoop ? pl.id : undefined,
      });
    }
  }

  sim.roomChestsByRoomId.set(room.id, [...sim.chests]);
  sim.roomItemsByRoomId.set(room.id, [...sim.worldItems]);

  room.secretTrialWon = true;
  sim.secretTrialActive = false;
  sim.secretTrialResult = 'victory';
  sim.secretTrialBannerTimer = SECRET_ARENA_BANNER_DURATION_SEC;
  sim.secretTrialRemainingEnemies = 0;
  sim.rebuildCurrentRoomDoors();

  sim.events.push({
    kind: 'secret_trial_resolved',
    roomId: room.id,
    victory: true,
    bonusGold: SECRET_ARENA_VICTORY_GOLD,
    x: chest ? chest.x : sim.map.width * 0.5,
    y: chest ? chest.y : sim.map.height * 0.5,
  });
}

function resolveSecretTrialExpired(sim: WorldSim): void {
  const room = sim.getCurrentRoom();
  // Remove remaining trial enemies directly without handleEnemyKilled (0 death explosion, 0 vengeful ring, 0 gold)
  sim.enemies = sim.enemies.filter((e) => !e.secretTrialEnemy);
  purgeEnemyProjectilesAndHazards(sim);

  sim.secretTrialActive = false;
  sim.secretTrialTimer = 0;
  sim.secretTrialResult = 'expired';
  sim.secretTrialBannerTimer = SECRET_ARENA_BANNER_DURATION_SEC;
  sim.secretTrialRemainingEnemies = 0;
  sim.rebuildCurrentRoomDoors();

  const chest = sim.chests[0];
  sim.events.push({
    kind: 'secret_trial_resolved',
    roomId: room.id,
    victory: false,
    bonusGold: 0,
    x: chest ? chest.x : sim.map.width * 0.5,
    y: chest ? chest.y : sim.map.height * 0.5,
  });
}

export function updateSecretSkillArena(sim: WorldSim, dtSec: number): void {
  if (!sim.secretTrialActive) {
    if (sim.secretTrialBannerTimer > 0) {
      sim.secretTrialBannerTimer = Math.max(0, sim.secretTrialBannerTimer - dtSec);
      if (sim.secretTrialBannerTimer <= 1e-6) {
        sim.secretTrialBannerTimer = 0;
      }
    }
    return;
  }

  const alive = countAliveSecretTrialEnemies(sim);
  sim.secretTrialRemainingEnemies = alive;

  if (alive === 0 && sim.secretTrialTimer > 0) {
    resolveSecretTrialVictory(sim);
    return;
  }

  if (sim.secretTrialActivatedTick !== sim.tick) {
    sim.secretTrialTimer = Math.max(0, sim.secretTrialTimer - dtSec);
    if (sim.secretTrialTimer <= 1e-6) {
      sim.secretTrialTimer = 0;
    }
  }

  if (sim.secretTrialTimer <= 0) {
    resolveSecretTrialExpired(sim);
  }
}

export function resetSecretSkillArenaState(sim: WorldSim): void {
  sim.secretTrialActive = false;
  sim.secretTrialTimer = 0;
  sim.secretTrialResult = 'idle';
  sim.secretTrialBannerTimer = 0;
  sim.secretTrialRemainingEnemies = 0;
  sim.secretTrialActivatedTick = -1;
}
