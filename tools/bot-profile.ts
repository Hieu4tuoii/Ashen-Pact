import {
  INPUT_BUTTON,
  type PlayerInputPacket,
  type SimEnemyState,
  type SimPlayerState,
  WEAPONS,
  type WorldSim,
} from '../packages/shared/src/index.js';

export interface AveragePlayerBotProfile {
  readonly id: 'average-player-v1';
  /** Aim accuracy in [0.65, 0.75] per Spec Section 3.10 */
  readonly aimAccuracy: 0.7;
  /** Human reaction delay in [0.20, 0.30] seconds per Spec Section 3.10 */
  readonly reactionDelaySec: 0.25;
  /** Probability in [0.60, 0.70] of executing a Dash dodge against a detected threat */
  readonly dashDodgeProbability: 0.65;
  /** Strictly false — no invulnerability cheats */
  readonly godMode: false;
  /** 30 deterministic run seeds for median (p50) and p10/p90 reporting */
  readonly seeds: readonly number[];
}

const LOCKED_30_SEEDS: readonly number[] = Object.freeze([
  101, 202, 303, 404, 505, 606, 707, 808, 909, 1010,
  1111, 1212, 1313, 1414, 1515, 1616, 1717, 1818, 1919, 2020,
  2121, 2222, 2323, 2424, 2525, 2626, 2727, 2828, 2929, 3030,
]);

/**
 * Locked "Average Player" Bot Profile (Spec Section 3.10 Step 1).
 * Committed and frozen BEFORE Step 2 balance tuning so gameplay numbers must adapt to the bot,
 * never the bot to the numbers.
 */
export const AVERAGE_PLAYER_BOT_PROFILE: AveragePlayerBotProfile = Object.freeze({
  id: 'average-player-v1',
  aimAccuracy: 0.7,
  reactionDelaySec: 0.25,
  dashDodgeProbability: 0.65,
  godMode: false,
  seeds: LOCKED_30_SEEDS,
});

export interface DistributionStats {
  mean: number;
  p10: number;
  p50: number;
  p90: number;
  min: number;
  max: number;
}

function roundStat(val: number): number {
  return Math.round(val * 100) / 100;
}

function percentileSorted(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const weight = pos - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

export function computeDistributionStats(values: readonly number[]): DistributionStats {
  if (values.length === 0) {
    return { mean: 0, p10: 0, p50: 0, p90: 0, min: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    mean: roundStat(sum / sorted.length),
    p10: roundStat(percentileSorted(sorted, 0.1)),
    p50: roundStat(percentileSorted(sorted, 0.5)),
    p90: roundStat(percentileSorted(sorted, 0.9)),
    min: roundStat(sorted[0]!),
    max: roundStat(sorted[sorted.length - 1]!),
  };
}

export interface BotBrainState {
  playerId: number;
  rngState: number;
  activeThreatKey: number;
  threatSeenTimerSec: number;
  threatDodgeApproved: boolean;
  threatDashConsumed: boolean;
  aimUpdateTimer: number;
  currentAimErrorRad: number;
  orbitSign: 1 | -1;
  strafeSwapTimer: number;
}

export function createBotBrainState(playerId: number, seed: number): BotBrainState {
  const initialRng = ((seed ^ Math.imul(playerId + 1, 0x9e3779b9)) >>> 0) || 0x13579bdf;
  return {
    playerId,
    rngState: initialRng,
    activeThreatKey: 0,
    threatSeenTimerSec: 0,
    threatDodgeApproved: false,
    threatDashConsumed: false,
    aimUpdateTimer: 0,
    currentAimErrorRad: 0,
    orbitSign: playerId % 2 === 0 ? -1 : 1,
    strafeSwapTimer: 1.8,
  };
}

function nextBrainFloat(brain: BotBrainState): number {
  let x = brain.rngState >>> 0;
  if (x === 0) x = 0x6d2b79f5;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  brain.rngState = x >>> 0;
  return (brain.rngState >>> 0) / 0x100000000;
}

function hasLineOfSight(sim: WorldSim, x1: number, y1: number, x2: number, y2: number): boolean {
  const steps = 4;
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const tx = Math.floor(px / 32);
    const ty = Math.floor(py / 32);
    if (sim.map.isSolidTile(tx, ty)) {
      return false;
    }
  }
  return true;
}

function selectTargetEnemy(sim: WorldSim, player: SimPlayerState): SimEnemyState | null {
  // Priority 1: Critical boss mechanics (Ice Prison rescue, Forge Titan Energy Cores, Spore Guardian, Kryssa Clones)
  let bestPriority: SimEnemyState | null = null;
  let bestPriorityDist = Infinity;
  let bestGeneral: SimEnemyState | null = null;
  let bestGeneralScore = Infinity;

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.isDummy || e.hp <= 0 || e.aiState === 'spawning' || e.bossBurrowed) continue;
    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    if (
      e.defId === 'ice_prison' ||
      e.defId === 'forge_energy_core' ||
      e.defId === 'spore_guardian' ||
      e.defId === 'kryssa_clone'
    ) {
      if (dist < bestPriorityDist) {
        bestPriorityDist = dist;
        bestPriority = e;
      }
      continue;
    }

    // Prefer nearby dangerous enemies (bombers, shamans, close adds) or the boss
    const losPenalty = hasLineOfSight(sim, player.x, player.y, e.x, e.y) ? 0 : 95;
    const roleBias =
      e.defId === 'spore_bomber' || e.defId === 'snow_spirit'
        ? -85
        : e.defId === 'goblin_shaman' || e.defId === 'welder_drone'
          ? -60
          : !e.isBoss && dist < 170
            ? -55
            : e.isBoss
              ? -35
              : 0;
    const score = dist + roleBias + losPenalty;
    if (score < bestGeneralScore) {
      bestGeneralScore = score;
      bestGeneral = e;
    }
  }

  return bestPriority ?? bestGeneral;
}

/**
 * Steps a single player using the locked Average Player Bot Profile.
 * Enforces:
 * - No godMode
 * - 250ms reactionDelaySec before responding to new enemy telegraphs / shockwaves / incoming projectiles
 * - 65% dashDodgeProbability rolled deterministically once per threat
 * - 70% aimAccuracy (70% on-target, 30% angular dispersion)
 * - Weapon slot swapping when active weapon is locked out by reload or overheat
 */
export function stepHonestPlayerBot(
  sim: WorldSim,
  player: SimPlayerState,
  brain: BotBrainState,
  profile: AveragePlayerBotProfile = AVERAGE_PLAYER_BOT_PROFILE,
  dtSec: number,
  seq: number,
): PlayerInputPacket {
  // Strictly enforce anti-cheat invariants
  if ( !profile.godMode && player.godMode ) {
    player.godMode = false;
  }

  if (player.lifeState !== 'alive') {
    return {
      seq,
      tick: sim.tick + 1,
      moveX: 0,
      moveY: 0,
      aimAngle: player.aimAngle,
      buttons: 0,
      weaponSlotSelect: null,
    };
  }

  // Periodic strafe direction swap so bot doesn't get cornered
  brain.strafeSwapTimer -= dtSec;
  if (brain.strafeSwapTimer <= 0) {
    brain.strafeSwapTimer = 1.6 + nextBrainFloat(brain) * 1.1;
    if (nextBrainFloat(brain) < 0.35) {
      brain.orbitSign = brain.orbitSign === 1 ? -1 : 1;
    }
  }

  // Detect highest-priority active threat (enemy telegraph, expanding shockwave ring, or close incoming projectile)
  let detectedThreatKey = 0;
  let imminentDashThreat = false;
  let nearbyBulletCount = 0;
  let threatX = player.x;
  let threatY = player.y;
  let evadeVecX = 0;
  let evadeVecY = 0;

  // 1) Enemy telegraphs within danger radius (or Boss burrow telegraph)
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0 || e.isDummy) continue;
    const dist = Math.hypot(e.x - player.x, e.y - player.y);
    if (e.aiState === 'telegraph') {
      if (!e.isBoss && dist <= 185) {
        detectedThreatKey = e.id * 31 + 1;
        imminentDashThreat = true;
        threatX = e.x;
        threatY = e.y;
        const awayAng = Math.atan2(player.y - e.y, player.x - e.x);
        evadeVecX += Math.cos(awayAng + brain.orbitSign * 0.65) * 1.55;
        evadeVecY += Math.sin(awayAng + brain.orbitSign * 0.65) * 1.55;
        break;
      }
      if (e.isBoss && e.bossBurrowed && dist <= 155) {
        detectedThreatKey = e.id * 31 + 1 + (e.bossAttackCycle % 17) * 997;
        imminentDashThreat = dist <= 120;
        threatX = e.x;
        threatY = e.y;
        const awayAng = Math.atan2(player.y - e.y, player.x - e.x);
        evadeVecX += Math.cos(awayAng) * 1.85;
        evadeVecY += Math.sin(awayAng) * 1.85;
        break;
      }
    }
  }

  // 2) Shockwave rings approaching player (Dash through ring with i-frames when within pass-through window)
  for (let i = 0; i < sim.shockwaveRings.length; i++) {
    const ring = sim.shockwaveRings[i]!;
    if (ring.hitPlayerIds.includes(player.id)) continue;
    const dRing = Math.hypot(player.x - ring.x, player.y - ring.y);
    if (dRing >= ring.radius - 14 && dRing <= ring.radius + ring.thickness + 175) {
      if (detectedThreatKey === 0) {
        detectedThreatKey = ring.id * 31 + 2;
        threatX = ring.x;
        threatY = ring.y;
      }
      if (dRing <= ring.radius + ring.thickness + 62) {
        imminentDashThreat = true;
        const towardAng = Math.atan2(ring.y - player.y, ring.x - player.x);
        evadeVecX += Math.cos(towardAng) * 1.45;
        evadeVecY += Math.sin(towardAng) * 1.45;
      }
      break;
    }
  }

  // 3) Incoming enemy projectiles heading toward player (weave into radial gaps; sidestep tight fans!)
  let minBulletAbsLat = Infinity;
  let hasPosLat = false;
  let hasNegLat = false;
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
    const rx = player.x - b.x;
    const ry = player.y - b.y;
    const d = Math.hypot(rx, ry);
    if (d > 235) continue;

    const spd = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / spd;
    const uy = b.vy / spd;
    const along = rx * ux + ry * uy;
    if (along <= -8) continue;

    const nx = -uy;
    const ny = ux;
    const lat = rx * nx + ry * ny;
    const absLat = Math.abs(lat);
    const corridor = player.radius + b.radius + 20;
    if (absLat < corridor && along < 205) {
      if (lat >= 0) hasPosLat = true;
      else hasNegLat = true;
    }
  }

  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
    const rx = player.x - b.x;
    const ry = player.y - b.y;
    const d = Math.hypot(rx, ry);
    if (d > 235) continue;

    const spd = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / spd;
    const uy = b.vy / spd;
    const along = rx * ux + ry * uy;
    if (along <= -8) continue;

    nearbyBulletCount += 1;
    const nx = -uy;
    const ny = ux;
    const lat = rx * nx + ry * ny;
    const absLat = Math.abs(lat);
    if (along < 195 && absLat < minBulletAbsLat) {
      minBulletAbsLat = absLat;
    }
    const corridor = player.radius + b.radius + 20;

    if (absLat < corridor && along < 205) {
      if (detectedThreatKey === 0) {
        detectedThreatKey = (b.ownerId || 1) * 31 + 3;
        threatX = b.x;
        threatY = b.y;
      }
      if (d < 54 && absLat < player.radius + b.radius + 5) {
        imminentDashThreat = true;
      }
      const side = hasPosLat && hasNegLat ? brain.orbitSign : lat >= 0 ? 1 : -1;
      const urgency = ((corridor - absLat) / corridor) * (2.1 + (205 - along) / 110);
      evadeVecX += nx * side * urgency;
      evadeVecY += ny * side * urgency;
    }
  }

  // Update threat reaction timer (human reaction delay: 250ms)
  if (detectedThreatKey !== 0) {
    if (brain.activeThreatKey !== detectedThreatKey) {
      const wasAlreadyTracking = brain.activeThreatKey !== 0 && brain.threatSeenTimerSec > 0;
      brain.activeThreatKey = detectedThreatKey;
      brain.threatSeenTimerSec = wasAlreadyTracking
        ? brain.threatSeenTimerSec + dtSec
        : dtSec;
      brain.threatDodgeApproved = nextBrainFloat(brain) < profile.dashDodgeProbability;
      brain.threatDashConsumed = false;
    } else {
      brain.threatSeenTimerSec += dtSec;
    }
  } else {
    brain.activeThreatKey = 0;
    brain.threatSeenTimerSec = 0;
    brain.threatDodgeApproved = false;
    brain.threatDashConsumed = false;
  }

  const reactionReady =
    detectedThreatKey !== 0 && brain.threatSeenTimerSec >= profile.reactionDelaySec;

  const target = selectTargetEnemy(sim, player);
  let aimX = target ? target.x : player.x + Math.cos(player.aimAngle) * 100;
  let aimY = target ? target.y : player.y + Math.sin(player.aimAngle) * 100;

  // Engineer occasionally shoots own Tesla Turret to trigger EMP synergy
  if (player.characterId === 'engineer' && sim.summons.length > 0 && seq % 72 < 5) {
    const turret = sim.summons.find(
      (s) => s.kind === 'tesla_turret' && s.ownerPlayerId === player.id && s.hp > 0,
    );
    if (turret) {
      aimX = turret.x;
      aimY = turret.y;
    }
  }

  const trueAimAngle = Math.atan2(aimY - player.y, aimX - player.x);

  // Sample aim error according to profile.aimAccuracy (0.70 -> 70% accurate, 30% missed angle)
  brain.aimUpdateTimer -= dtSec;
  if (brain.aimUpdateTimer <= 0) {
    brain.aimUpdateTimer = 0.12;
    const hitRoll = nextBrainFloat(brain);
    if (hitRoll <= profile.aimAccuracy) {
      // On-target shot: tiny jitter within [-0.045, +0.045] rad
      brain.currentAimErrorRad = (nextBrainFloat(brain) * 2 - 1) * 0.045;
    } else {
      // Missed shot (30%): angular dispersion of 0.25..0.42 rad left or right
      const missSign = nextBrainFloat(brain) < 0.5 ? -1 : 1;
      brain.currentAimErrorRad = missSign * (0.25 + nextBrainFloat(brain) * 0.17);
    }
  }

  const aimAngle = trueAimAngle + brain.currentAimErrorRad;

  // Weapon slot selection: swap to slot 1 if slot 0 weapon is locked out by reload/overheat
  let weaponSlotSelect: number | null = null;
  const slot0Id = player.weaponSlots[0];
  const slot1Id = player.weaponSlots[1];
  const slot0Wep = slot0Id ? WEAPONS[slot0Id] : undefined;
  const slot1Wep = slot1Id ? WEAPONS[slot1Id] : undefined;
  const activeWep = player.activeWeaponSlot === 0 ? slot0Wep : slot1Wep;

  if (activeWep && (player.reloadLockout || player.overheatLockTimer > 0)) {
    const otherSlot = player.activeWeaponSlot === 0 ? 1 : 0;
    const otherWep = otherSlot === 0 ? slot0Wep : slot1Wep;
    if (otherWep) {
      weaponSlotSelect = otherSlot;
    }
  } else if (
    player.activeWeaponSlot === 1 &&
    slot0Wep &&
    !player.reloadLockout &&
    player.overheatLockTimer <= 0 &&
    ((player.holsterReloadTimers?.[0] ?? 0) <= 0 ||
      (player.holsterReloadTimers?.[0] ?? 0) >= 2.0)
  ) {
    weaponSlotSelect = 0;
  }

  const effectiveWep =
    weaponSlotSelect === 0 ? slot0Wep : weaponSlotSelect === 1 ? slot1Wep : activeWep;
  const isMelee = effectiveWep?.category === 'melee';
  const activeBoss = sim.getActiveBoss();
  const fightingBoss = activeBoss !== undefined;
  const desiredDist = isMelee
    ? player.characterId === 'vanguard' && player.skillActiveTimer > 0
      ? 145
      : fightingBoss
        ? 64
        : 38
    : fightingBoss
      ? player.characterId === 'ranger'
        ? 235
        : 215
      : player.characterId === 'ranger'
        ? 215
        : player.characterId === 'druid'
          ? 145
          : 180;

  let moveX = 0;
  let moveY = 0;

  // Check if a downed teammate needs reviving nearby or a life_seed/prey_emblem pickup is safely reachable
  const downedAlly = sim
    .getAllPlayers()
    .find((ally) => ally.id !== player.id && ally.lifeState === 'downed');

  let bestPickup: { x: number; y: number; dist: number } | null = null;
  for (let i = 0; i < sim.pickups.length; i++) {
    const pk = sim.pickups[i]!;
    if (pk.ttlSec <= 0) continue;
    if (pk.ownerPlayerId !== undefined && pk.ownerPlayerId !== player.id) continue;
    if (activeBoss && Math.hypot(pk.x - activeBoss.x, pk.y - activeBoss.y) < 92) continue;
    const wantsSeed =
      pk.kind === 'life_seed' && player.hp <= Math.max(3, Math.floor(player.maxHp * 0.75));
    const wantsEmblem = pk.kind === 'prey_emblem';
    if (!wantsSeed && !wantsEmblem) continue;
    const dPk = Math.hypot(pk.x - player.x, pk.y - player.y);
    if (dPk < 210 && (!bestPickup || dPk < bestPickup.dist)) {
      bestPickup = { x: pk.x, y: pk.y, dist: dPk };
    }
  }

  const cx = sim.map.width * 0.5;
  const cy = sim.map.height * 0.5;
  const nearWall =
    player.x < 155 ||
    player.x > sim.map.width - 155 ||
    player.y < 145 ||
    player.y > sim.map.height - 145;

  if (downedAlly && Math.hypot(downedAlly.x - player.x, downedAlly.y - player.y) < 280) {
    const allyAng = Math.atan2(downedAlly.y - player.y, downedAlly.x - player.x);
    const dAlly = Math.hypot(downedAlly.x - player.x, downedAlly.y - player.y);
    if (dAlly > 24) {
      moveX = Math.cos(allyAng);
      moveY = Math.sin(allyAng);
    }
  } else if (bestPickup && !imminentDashThreat) {
    const pkAng = Math.atan2(bestPickup.y - player.y, bestPickup.x - player.x);
    moveX = Math.cos(pkAng);
    moveY = Math.sin(pkAng);
  } else if (target) {
    const dist = Math.hypot(target.x - player.x, target.y - player.y);
    const hasLos = hasLineOfSight(sim, player.x, player.y, target.x, target.y);
    if (nearWall) {
      const orb1Ang = trueAimAngle + Math.PI * 0.5;
      const orb2Ang = trueAimAngle - Math.PI * 0.5;
      const d1 = Math.hypot(
        player.x + Math.cos(orb1Ang) * 65 - cx,
        player.y + Math.sin(orb1Ang) * 65 - cy,
      );
      const d2 = Math.hypot(
        player.x + Math.cos(orb2Ang) * 65 - cx,
        player.y + Math.sin(orb2Ang) * 65 - cy,
      );
      brain.orbitSign = d1 <= d2 ? 1 : -1;
    }
    const orbitAng = trueAimAngle + brain.orbitSign * Math.PI * 0.5;
    const inSafeBulletGap =
      nearbyBulletCount > 0 && fightingBoss && hasLos && !nearWall && minBulletAbsLat >= player.radius + 18;
    const orbitScale = !hasLos
      ? 1.15
      : inSafeBulletGap
        ? 0
        : nearbyBulletCount > 0 && fightingBoss
          ? 0.12
          : 0.72;
    moveX = Math.cos(orbitAng) * orbitScale;
    moveY = Math.sin(orbitAng) * orbitScale;

    const effDesiredDist = !hasLos ? Math.min(desiredDist, 95) : desiredDist;
    if (dist > effDesiredDist + 24 && !inSafeBulletGap) {
      moveX += Math.cos(trueAimAngle) * 0.95;
      moveY += Math.sin(trueAimAngle) * 0.95;
    } else if (dist < effDesiredDist - 22 && (!inSafeBulletGap || dist < 135)) {
      if (nearWall) {
        const toCenterAng = Math.atan2(cy - player.y, cx - player.x);
        moveX += Math.cos(toCenterAng) * 1.15 + Math.cos(orbitAng) * 0.75;
        moveY += Math.sin(toCenterAng) * 1.15 + Math.sin(orbitAng) * 0.75;
      } else {
        moveX -= Math.cos(trueAimAngle) * 1.1;
        moveY -= Math.sin(trueAimAngle) * 1.1;
      }
    }
  }

  // Apply evasive vector once reactionDelaySec has elapsed
  if (reactionReady && (evadeVecX !== 0 || evadeVecY !== 0)) {
    moveX += evadeVecX;
    moveY += evadeVecY;
  }

  // Avoid hazardous floor surfaces (lava, burning_oil, burning_grass, poison_swamp, chasm)
  const curSurf = sim.map.getSurfaceAtWorld(player.x, player.y);
  const lookSurf = sim.map.getSurfaceAtWorld(player.x + moveX * 34, player.y + moveY * 34);
  if (
    curSurf === 'lava' ||
    curSurf === 'burning_oil' ||
    curSurf === 'burning_grass' ||
    curSurf === 'poison_swamp' ||
    curSurf === 'chasm' ||
    lookSurf === 'lava' ||
    lookSurf === 'chasm'
  ) {
    const toCenterAng = Math.atan2(sim.map.height * 0.5 - player.y, sim.map.width * 0.5 - player.x);
    moveX += Math.cos(toCenterAng) * 1.35;
    moveY += Math.sin(toCenterAng) * 1.35;
  }

  // Keep away from outer room walls / hazard borders
  const margin = 96;
  if (player.x < margin) moveX += 0.95;
  if (player.x > sim.map.width - margin) moveX -= 0.95;
  if (player.y < margin) moveY += 0.95;
  if (player.y > sim.map.height - margin) moveY -= 0.95;

  const moveLen = Math.hypot(moveX, moveY);
  if (moveLen > 1e-4) {
    moveX /= moveLen;
    moveY /= moveLen;
  }

  let buttons = target ? INPUT_BUTTON.FIRE : 0;

  // Trigger Perfect Reload [R] when reload progress enters the [0.45, 0.70] sweet spot
  if (player.reloadTimer > 0 && player.reloadDuration > 0 && !player.reloadLockout) {
    const progress = 1 - player.reloadTimer / player.reloadDuration;
    if (progress >= 0.48 && progress <= 0.68) {
      buttons |= INPUT_BUTTON.RELOAD_VENT;
    }
  }

  // Use active skill tactically when off cooldown
  if (
    target &&
    player.skillCooldownTimer <= 0 &&
    player.skillActiveTimer <= 0 &&
    (player.characterId !== 'druid' ||
      player.hp < player.maxHp ||
      downedAlly !== undefined ||
      target.isBoss)
  ) {
    buttons |= INPUT_BUTTON.SKILL;
  }

  // Execute Dash dodge only after reactionDelaySec, when threat is imminent, and if the deterministic 65% roll succeeded
  if (
    player.dashCooldownTimer <= 0 &&
    ((reactionReady &&
      imminentDashThreat &&
      brain.threatDodgeApproved &&
      !brain.threatDashConsumed) ||
      (player.encasedInIceTimer ?? 0) > 0)
  ) {
    buttons |= INPUT_BUTTON.DASH;
    brain.threatDashConsumed = true;
  }

  return {
    seq,
    tick: sim.tick + 1,
    moveX,
    moveY,
    aimAngle,
    buttons,
    weaponSlotSelect,
  };
}
