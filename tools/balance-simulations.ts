import {
  BIOME1_COMBAT_ENEMIES,
  BIOME2_COMBAT_ENEMIES,
  BIOME3_COMBAT_ENEMIES,
  BIOME_SCALING,
  type BuffId,
  CHARACTERS,
  COOP_SCALING,
  type CharacterId,
  ENEMIES,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  WEAPONS,
  WorldSim,
  clamp,
} from '../packages/shared/src/index.js';
import {
  AVERAGE_PLAYER_BOT_PROFILE,
  type DistributionStats,
  computeDistributionStats,
  createBotBrainState,
  stepHonestPlayerBot,
} from './bot-profile.js';
import type {
  ClassCoopRunRow,
  WeaponCadenceBalanceRow,
} from './balance-simulations-p3c.js';

export interface CharacterBalanceRow {
  characterId: CharacterId;
  nameVi: string;
  roleVi: string;
  hp: number;
  armor: number;
  hitsSurvivedAvg: number;
  starterTtkSec: number;
  soloSustainedDps: number;
  skillUptimePct: number;
  soloBossClearRatePct: number;
  soloBossAvgSec: number;
}

export interface CoopScalingRow {
  playerCount: 1 | 2 | 3 | 4;
  combatRoomAvgSec: number;
  combatRoomStats: DistributionStats;
  hpArmorLostPctAvg: number;
  downedPerRoomRate: number;
  bossKillAvgSec: number;
  bossKillStats: DistributionStats;
  bossDeltaVs1PPct: number;
}

export interface BiomeProgressionRow {
  biome: 1 | 2 | 3;
  nameVi: string;
  difficultyIndex: number;
  stepIncreasePct: number;
  measuredWaveEhp: number;
  measuredRoomClearSec: number;
  measuredHpArmorLostPct: number;
}

export interface WeaponMatrixRow {
  characterId: CharacterId;
  nameVi: string;
  dpsByWeapon: Record<string, number>;
}

export interface CoopSynergyTeamRow {
  label: string;
  playerCount: 2 | 4;
  killTimeSec: number;
  reactionsTriggered: number;
  teamCombos: number;
  won: boolean;
}

export interface BossBalanceRow {
  bossId: 'spore_king' | 'kryssa_ice_queen' | 'forge_titan';
  biome: 1 | 2 | 3;
  nameVi: string;
  avg1PSec: number;
  avg4PSec: number;
  stats1PSec: DistributionStats;
  stats4PSec: DistributionStats;
  delta1Pvs4PPct: number;
  winRate1PPct: number;
  winRate4PPct: number;
  winRatePct: number;
  maxSingleHitFraction: number;
  zeroOneShots: boolean;
}

export interface BalanceHarnessReport {
  totalSimulationsRun: number;
  seedsUsed: readonly number[];
  enemyTtkStats: DistributionStats;
  combatRoomSecStats: DistributionStats;
  b1HpArmorLostPctStats: DistributionStats;
  coopDownedPerRoomRate: number;
  bossBiomeRows: BossBalanceRow[];
  biomeDifficultyRows: BiomeProgressionRow[];
  // Legacy & summary properties preserved for compatibility
  avgEnemyTtkSec: number;
  minEnemyTtkSec: number;
  maxEnemyTtkSec: number;
  combatRoomAvgSec: number;
  boss1PAvgSec: number;
  boss4PAvgSec: number;
  boss1Pvs4PDeltaPct: number;
  minHitsSurvived: number;
  maxHitsSurvived: number;
  dps3CharSpreadPct: number;
  all5SoloBossWin: boolean;
  avgSkillUptimePct: number;
  biome2IncreasePct: number;
  biome3IncreasePct: number;
  characters: CharacterBalanceRow[];
  weaponMatrix: WeaponMatrixRow[];
  coopRows: CoopScalingRow[];
  coopSynergyRows: CoopSynergyTeamRow[];
  biomes: BiomeProgressionRow[];
  bosses: BossBalanceRow[];
  weaponCadenceRows: WeaponCadenceBalanceRow[];
  starterWeaponDpsSpreadPct: number;
  classCoopRows: ClassCoopRunRow[];
  classWinRateSpreadPct: number;
  allTargetsPassed: boolean;
}

export type BalanceReportResult = BalanceHarnessReport;

export const CHARACTER_LIST: readonly CharacterId[] = [
  'vanguard',
  'ranger',
  'elementalist',
  'druid',
  'engineer',
];

export const MATRIX_WEAPON_IDS = [
  'knight_sword',
  'hunter_crossbow',
  'apprentice_staff',
  'scrap_shotgun',
  'tesla_carbine',
] as const;

export const CHARACTER_SIGNATURE_BUFF: Record<CharacterId, string> = {
  vanguard: 'vanguard_charge',
  ranger: 'ranger_arrow_volley',
  elementalist: 'elementalist_twin_orbit',
  druid: 'druid_poison_roots',
  engineer: 'engineer_twin_turrets',
};

const BIOME1_PRIMARY_WEAPON: Record<CharacterId, string> = {
  vanguard: 'focus_laser',
  ranger: 'focus_laser',
  elementalist: 'apprentice_staff',
  druid: 'focus_laser',
  engineer: 'rivet_gun',
};

const BIOME2_PRIMARY_WEAPON: Record<CharacterId, string> = {
  vanguard: 'focus_laser',
  ranger: 'focus_laser',
  elementalist: 'tether_staff',
  druid: 'tesla_carbine',
  engineer: 'tesla_carbine',
};

const BIOME3_PRIMARY_WEAPON: Record<CharacterId, string> = {
  vanguard: 'void_staff',
  ranger: 'void_staff',
  elementalist: 'tether_staff',
  druid: 'void_staff',
  engineer: 'tesla_carbine',
};

export interface CombatRoomClearSample {
  clearSec: number;
  hpAndArmorLostPct: number;
  downedCount: number;
  cleared: boolean;
}

export interface BossEncounterSample {
  won: boolean;
  durationSec: number;
  elementalReactions: number;
  teamCombos: number;
  maxSingleHitFraction: number;
  downedCount: number;
}

/**
 * 1. Simulates Starter Weapon Time-To-Kill (TTK) against all 6 Biome 1 normal enemy types
 * using the locked AVERAGE_PLAYER_BOT_PROFILE reaction window (0.25s) and aimAccuracy (70%).
 */
export function simulateStarterWeaponTtkSamples(
  charId: CharacterId,
  seeds: readonly number[],
): number[] {
  const cDef = CHARACTERS[charId];
  const weapon = WEAPONS[cDef.starterWeaponId]!;
  const samples: number[] = [];

  for (const seed of seeds) {
    for (const enemyDefId of BIOME1_COMBAT_ENEMIES) {
      const sim = new WorldSim({
        seed,
        autoRevivePlayer: false,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
        autoRespawnWaves: false,
      });
      sim.selectCharacter(sim.player.id, charId);
      const p = sim.player;
      p.godMode = false;
      p.x = 360;
      p.y = 320;

      const dist = weapon.category === 'melee' ? 32 : 84;
      const e = sim.spawnEnemy(enemyDefId, p.x + dist, p.y, true);
      e.vx = 0;
      e.vy = 0;
      e.spawnWarmupTimer = 0;

      // Reaction delay from AVERAGE_PLAYER_BOT_PROFILE (0.25s = 15 ticks at 60Hz)
      const reactionTicks = Math.round(AVERAGE_PLAYER_BOT_PROFILE.reactionDelaySec / SIM_STEP_SEC);
      let ticks = reactionTicks;
      const maxTicks = 60 * 6;
      const brain = createBotBrainState(p.id, seed + e.id * 17);

      while (e.hp > 0 && ticks < maxTicks) {
        const pkt = stepHonestPlayerBot(
          sim,
          p,
          brain,
          AVERAGE_PLAYER_BOT_PROFILE,
          SIM_STEP_SEC,
          ticks + 1,
        );
        sim.setPlayerInput({
          ...pkt,
          moveX: weapon.category === 'melee' && Math.hypot(e.x - p.x, e.y - p.y) > 32 ? 1 : 0,
          moveY: 0,
          buttons: INPUT_BUTTON.FIRE | (pkt.buttons & INPUT_BUTTON.RELOAD_VENT),
        });
        sim.step(SIM_STEP_SEC);
        e.x = p.x + dist;
        e.y = p.y;
        ticks += 1;
      }
      samples.push(Math.round(ticks * SIM_STEP_SEC * 100) / 100);
    }
  }

  return samples;
}

export function simulateStarterWeaponTtk(charId: CharacterId, seeds: readonly number[]): number {
  const samples = simulateStarterWeaponTtkSamples(charId, seeds);
  if (samples.length === 0) return 0;
  const sum = samples.reduce((a, b) => a + b, 0);
  return Math.round((sum / samples.length) * 100) / 100;
}

/**
 * 2. Simulates how many Biome 1 enemy hits a player survives in WorldSim before going down
 * (testing actual HP + Armor + natural armor regen / skill response against the 6 Biome 1 enemy types).
 */
export function simulateHitsSurvived(charId: CharacterId): number {
  const sim = new WorldSim({
    seed: 20202,
    autoRevivePlayer: false,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
    autoRespawnWaves: false,
  });
  sim.selectCharacter(sim.player.id, charId);
  const p = sim.player;
  p.godMode = false;
  p.x = 360;
  p.y = 320;

  const hitRoster = BIOME1_COMBAT_ENEMIES.map((id) => ENEMIES[id]!.damage);

  let hitsSurvived = 0;
  let nextHitTimer = 0.2;
  for (let tick = 0; tick < 60 * 16 && p.hp > 0 && p.lifeState === 'alive'; tick++) {
    const useSupportSkill =
      (charId === 'druid' || charId === 'engineer') &&
      p.hp < p.maxHp &&
      p.skillCooldownTimer <= 0;
    sim.setPlayerInput({
      seq: tick + 1,
      tick: tick + 1,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: useSupportSkill ? INPUT_BUTTON.SKILL : 0,
    });
    sim.step(SIM_STEP_SEC);

    nextHitTimer -= SIM_STEP_SEC;
    if (nextHitTimer <= 0 && p.invulnerableTimer <= 0 && p.hp > 0) {
      const dmg = hitRoster[hitsSurvived % hitRoster.length]!;
      if (sim.applyDamageToPlayer(dmg, Math.PI, 60, 'enemy', p)) {
        hitsSurvived += 1;
        nextHitTimer = 0.52;
      }
    }
  }

  return hitsSurvived;
}

/**
 * 3. Measures solo sustained combat DPS (Weapon + Passive + Active Skill + Elemental Reactions)
 * and active skill uptime % directly from WorldSim state over a 24-second combat window
 * WITHOUT `godMode = true` cheats.
 */
export function measureCombatDpsAndSkillUptime(
  charId: CharacterId,
  seeds: readonly number[],
  overrideWeaponId?: string,
): { dps: number; uptimePct: number } {
  let totalDmg = 0;
  let totalActiveTicks = 0;
  const durationSec = 24;
  const totalTicksPerRun = durationSec * 60;

  for (const seed of seeds) {
    const sim = new WorldSim({
      seed,
      autoRevivePlayer: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.selectCharacter(sim.player.id, charId);
    const p = sim.player;
    p.godMode = false;
    p.x = 360;
    p.y = 320;

    if (overrideWeaponId) {
      p.weaponSlots[0] = overrideWeaponId;
      p.weaponSlots[1] = CHARACTERS[charId].starterWeaponId;
      p.activeWeaponSlot = 0;
    } else if (charId === 'vanguard') {
      p.weaponSlots[0] = 'knight_sword';
    }

    const activeWepId = p.weaponSlots[0] ?? 'knight_sword';
    const isMelee = WEAPONS[activeWepId]?.category === 'melee';

    // Non-attacking combat target so player can be evaluated with godMode: false
    const target = sim.spawnEnemy('spore_king', 560, 320, true);
    target.hp = 999999;
    target.maxHp = 999999;
    target.isDummy = true;

    for (let t = 0; t < totalTicksPerRun; t++) {
      const distPref = isMelee
        ? p.characterId === 'vanguard' && p.skillActiveTimer > 0
          ? 140
          : 34
        : charId === 'ranger'
          ? 240
          : charId === 'elementalist'
            ? 115
            : 175;
      p.x = 560 - distPref;
      p.y = 320;
      target.x = 560;
      target.y = 320;
      target.bossBurrowed = false;
      target.aiState = 'idle';
      target.stateTimer = 99;
      target.attackCooldownTimer = 99;

      const canCastSkill = p.skillCooldownTimer <= 0 && p.skillActiveTimer <= 0;
      const reloadProgress =
        p.reloadTimer > 0 && p.reloadDuration > 0 ? 1 - p.reloadTimer / p.reloadDuration : 0;
      const canPerfectReload =
        !p.reloadLockout && reloadProgress >= 0.48 && reloadProgress <= 0.68;

      sim.setPlayerInput({
        seq: t + 1,
        tick: t + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons:
          INPUT_BUTTON.FIRE |
          (canCastSkill ? INPUT_BUTTON.SKILL : 0) |
          (canPerfectReload ? INPUT_BUTTON.RELOAD_VENT : 0),
      });
      sim.step(SIM_STEP_SEC);

      const hasActiveZone = sim.skillZones.some(
        (z) => z.ownerPlayerId === p.id && z.ttlSec > 0.8,
      );
      if (p.skillActiveTimer > 0 || hasActiveZone) {
        totalActiveTicks += 1;
      }
    }

    totalDmg += sim.runStats.damageDealt;
  }

  const avgDps = totalDmg / (Math.max(1, seeds.length) * durationSec);
  const avgUptimePct = (totalActiveTicks / (Math.max(1, seeds.length) * totalTicksPerRun)) * 100;
  return {
    dps: Math.round(avgDps * 10) / 10,
    uptimePct: Math.round(avgUptimePct * 10) / 10,
  };
}

export const simulateCharacterDpsAndUptime = measureCombatDpsAndSkillUptime;

const _combatRoomCache = new Map<string, CombatRoomClearSample>();
const _bossEncounterCache = new Map<string, BossEncounterSample>();

export function clearBalanceSimulationCaches(): void {
  _combatRoomCache.clear();
  _bossEncounterCache.clear();
}

/**
 * 4. Honest multi-wave Combat Room simulation in WorldSim using `stepHonestPlayerBot`
 * and `AVERAGE_PLAYER_BOT_PROFILE` (`godMode: false`, no fake room HP multipliers).
 */
export function measureCombatRoomClearSec(
  playerCount: 1 | 2 | 3 | 4,
  seed: number,
  biome: 1 | 2 | 3 = 1,
): CombatRoomClearSample {
  const bTier = BIOME_SCALING[biome];
  const cacheKey = `${playerCount}|${seed}|${biome}|${bTier.hpMultiplier}|${bTier.cooldownScale}|${ENEMIES.goblin_shooter?.attackCooldownSec ?? 0}`;
  const cached = _combatRoomCache.get(cacheKey);
  if (cached) {
    return { ...cached };
  }
  const roster: readonly CharacterId[] = ['ranger', 'elementalist', 'engineer', 'druid'];
  const floor = biome === 1 ? 1 : biome === 2 ? 3 : 5;

  const sim = new WorldSim({
    seed,
    biome,
    playerCount,
    autoRevivePlayer: false,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: true,
    autoRespawnWaves: true,
  });

  sim.selectCharacter(sim.player.id, roster[0]!);
  sim.player.godMode = false;
  const allPlayers = [sim.player];
  for (let slot = 2; slot <= playerCount; slot++) {
    const sp = sim.addCoopPlayer(
      slot as 2 | 3 | 4,
      roster[(slot - 1) % roster.length]!,
      `Bot P${slot}`,
      slot,
    );
    sp.godMode = false;
    allPlayers.push(sp);
  }
  if (floor > 1) {
    sim.advanceToFloor(floor);
  }

  const combatRoom =
    sim.dungeon.rooms.find((r) => r.type === 'combat' && !r.isChallenge && r.wavesTotal >= 3) ??
    sim.dungeon.rooms.find((r) => r.type === 'combat' && !r.isChallenge) ??
    sim.dungeon.rooms[1]!;
  sim.enterRoom(combatRoom.id);

  // Equip biome-tier secondary weapon & progression buffs for Biome 2 & 3 combat rooms
  for (const pl of allPlayers) {
    pl.godMode = false;
    pl.statsDamageTaken = 0;
    if (biome === 2) {
      pl.weaponSlots[0] = BIOME1_PRIMARY_WEAPON[pl.characterId];
      pl.weaponSlots[1] = CHARACTERS[pl.characterId].starterWeaponId;
      pl.maxArmor += 4;
      pl.armor = pl.maxArmor;
      pl.armorRegenDelaySec = Math.max(0.8, pl.armorRegenDelaySec - 0.5);
      pl.maxHp += 3;
      pl.hp = pl.maxHp;
    } else if (biome === 3) {
      pl.weaponSlots[0] = BIOME2_PRIMARY_WEAPON[pl.characterId];
      pl.weaponSlots[1] = CHARACTERS[pl.characterId].starterWeaponId;
      pl.maxArmor += 6;
      pl.armor = pl.maxArmor;
      pl.armorRegenDelaySec = Math.max(0.8, pl.armorRegenDelaySec - 0.5);
      pl.maxHp += 3;
      pl.hp = pl.maxHp;
      pl.moveSpeed = Math.round(pl.moveSpeed * 1.2);
    }
  }

  const initialTotalHpAndArmor = allPlayers.reduce(
    (acc, pl) => acc + pl.maxHp + pl.maxArmor,
    0,
  );
  const brains = new Map(allPlayers.map((pl) => [pl.id, createBotBrainState(pl.id, seed)]));
  const prevLifeState = new Map(allPlayers.map((pl) => [pl.id, pl.lifeState]));

  let downedCount = 0;
  let ticks = 0;
  const maxTicks = 60 * 180;

  while (!combatRoom.cleared && sim.runState !== 'defeat' && ticks < maxTicks) {
    const anyAlive = allPlayers.some((pl) => pl.lifeState === 'alive' && pl.hp > 0);
    if (!anyAlive) break;

    for (const pl of allPlayers) {
      const brain = brains.get(pl.id)!;
      const pkt = stepHonestPlayerBot(
        sim,
        pl,
        brain,
        AVERAGE_PLAYER_BOT_PROFILE,
        SIM_STEP_SEC,
        ticks + 1,
      );
      if (pl.id === sim.player.id) {
        sim.setPlayerInput(pkt);
      } else {
        sim.setCoopPlayerInput(pl.id, pkt);
      }
    }

    sim.step(SIM_STEP_SEC);
    ticks += 1;

    for (const pl of allPlayers) {
      const wasState = prevLifeState.get(pl.id);
      if (wasState === 'alive' && (pl.lifeState === 'downed' || pl.lifeState === 'ghost' || pl.hp <= 0)) {
        downedCount += 1;
      }
      prevLifeState.set(pl.id, pl.lifeState);
    }
  }

  const totalDamageTaken = allPlayers.reduce(
    (acc, pl) => acc + (pl.statsDamageTaken ?? 0),
    0,
  );
  const hpAndArmorLostPct =
    Math.round(
      clamp((totalDamageTaken / Math.max(1, initialTotalHpAndArmor)) * 100, 0, 100) * 10,
    ) / 10;

  const result: CombatRoomClearSample = {
    clearSec: Math.round(ticks * SIM_STEP_SEC * 100) / 100,
    hpAndArmorLostPct,
    downedCount,
    cleared: combatRoom.cleared,
  };
  _combatRoomCache.set(cacheKey, result);
  return { ...result };
}

export function simulateCombatRoomDuration(
  playerCount: 1 | 2 | 3 | 4,
  seeds: readonly number[],
): number {
  if (seeds.length === 0) return 0;
  let totalSec = 0;
  for (const seed of seeds) {
    totalSec += measureCombatRoomClearSec(playerCount, seed, 1).clearSec;
  }
  return Math.round((totalSec / seeds.length) * 10) / 10;
}

/**
 * 5. Honest 60Hz Boss Encounter simulation in WorldSim using `stepHonestPlayerBot`
 * and `AVERAGE_PLAYER_BOT_PROFILE` (`godMode: false`, no fake boss HP multipliers, no fake healing).
 */
export function simulateBossEncounter(
  playerCount: 1 | 2 | 3 | 4,
  primaryChar: CharacterId,
  seed: number,
  customRoster?: readonly CharacterId[],
  bossId: 'spore_king' | 'kryssa_ice_queen' | 'forge_titan' = 'spore_king',
): BossEncounterSample {
  const coopRoster: readonly CharacterId[] = customRoster ?? [
    primaryChar,
    'elementalist',
    'engineer',
    'druid',
  ];
  const activeRosterKey = Array.from(
    { length: playerCount },
    (_, idx) => coopRoster[idx % coopRoster.length]!,
  ).join(',');
  const biome: 1 | 2 | 3 =
    bossId === 'spore_king' ? 1 : bossId === 'kryssa_ice_queen' ? 2 : 3;
  const bDef = ENEMIES[bossId];
  const cacheKey = `${playerCount}|${activeRosterKey}|${bossId}|${seed}|${bDef?.hp ?? 0}|${bDef?.attackCooldownSec ?? 0}|${COOP_SCALING[playerCount].bossHpMultiplier}|${BIOME_SCALING[biome].bossHpScale ?? 1}`;
  const cached = _bossEncounterCache.get(cacheKey);
  if (cached) {
    return { ...cached };
  }
  const floor = biome === 1 ? 2 : biome === 2 ? 4 : 6;

  const sim = new WorldSim({
    seed,
    biome,
    playerCount,
    autoRevivePlayer: false,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: true,
    autoRespawnWaves: false,
  });

  sim.selectCharacter(sim.player.id, coopRoster[0]!);
  sim.player.godMode = false;
  const allPlayers = [sim.player];
  for (let slot = 2; slot <= playerCount; slot++) {
    const sp = sim.addCoopPlayer(
      slot as 2 | 3 | 4,
      coopRoster[(slot - 1) % coopRoster.length]!,
      `Bot P${slot}`,
      slot,
    );
    sp.godMode = false;
    allPlayers.push(sp);
  }
  sim.advanceToFloor(floor);

  const bossRoom =
    sim.dungeon.rooms.find((r) => r.type === 'boss') ?? sim.dungeon.rooms[0]!;
  sim.enterRoom(bossRoom.id);

  // Equip realistic campaign progression loadouts reached by the end of Biome 1 / 2 / 3
  const leadSigBuff = CHARACTER_SIGNATURE_BUFF[allPlayers[0]!.characterId] as BuffId | undefined;
  if (leadSigBuff && !allPlayers[0]!.blessingIds.includes(leadSigBuff)) {
    sim.applyBuffEffects(leadSigBuff, allPlayers[0]!.id);
  }
  for (const pl of allPlayers) {
    pl.godMode = false;
    pl.statsDamageTaken = 0;

    const starterId =
      pl.characterId === 'vanguard' ? 'rivet_gun' : CHARACTERS[pl.characterId].starterWeaponId;
    if (biome === 1) {
      pl.weaponSlots[0] = BIOME1_PRIMARY_WEAPON[pl.characterId];
      pl.weaponSlots[1] = starterId;
      pl.activeWeaponSlot = 0;
      pl.maxArmor += 1;
      pl.armor = pl.maxArmor;
      if (pl.characterId === 'elementalist') {
        pl.maxHp += 1;
        pl.hp = pl.maxHp;
      }
    } else if (biome === 2) {
      pl.weaponSlots[0] = BIOME2_PRIMARY_WEAPON[pl.characterId];
      pl.weaponSlots[1] = starterId;
      pl.activeWeaponSlot = 0;
      pl.maxArmor += 5;
      pl.armor = pl.maxArmor;
      pl.maxHp += 3;
      pl.hp = pl.maxHp;
      pl.moveSpeed = Math.round(pl.moveSpeed * 1.16);
    } else {
      pl.weaponSlots[0] = BIOME3_PRIMARY_WEAPON[pl.characterId];
      pl.weaponSlots[1] = starterId;
      pl.activeWeaponSlot = 0;
      pl.maxArmor += 3;
      pl.armor = pl.maxArmor;
      pl.maxHp += 1;
      pl.hp = pl.maxHp;
      pl.moveSpeed = Math.round(pl.moveSpeed * 1.16);
    }
    pl.armorRegenDelaySec = Math.max(1.2, pl.armorRegenDelaySec - 0.3);
  }

  let boss = sim.getActiveBoss();
  if (!boss || boss.defId !== bossId) {
    sim.enemies.length = 0;
    boss = sim.spawnEnemy(bossId, sim.map.width * 0.68, sim.map.height * 0.5, false);
  }

  const brains = new Map(allPlayers.map((pl) => [pl.id, createBotBrainState(pl.id, seed)]));
  const prevDamageTaken = new Map(allPlayers.map((pl) => [pl.id, pl.statsDamageTaken ?? 0]));
  const prevLifeState = new Map(allPlayers.map((pl) => [pl.id, pl.lifeState]));

  let maxSingleHitFraction = 0;
  let downedCount = 0;
  let ticks = 0;
  const maxTicks = 60 * 210;

  while (boss.hp > 0 && sim.runState !== 'defeat' && ticks < maxTicks) {
    const anyAlive = allPlayers.some((pl) => pl.lifeState === 'alive' && pl.hp > 0);
    if (!anyAlive) break;

    for (const pl of allPlayers) {
      const brain = brains.get(pl.id)!;
      const pkt = stepHonestPlayerBot(
        sim,
        pl,
        brain,
        AVERAGE_PLAYER_BOT_PROFILE,
        SIM_STEP_SEC,
        ticks + 1,
      );
      if (pl.id === sim.player.id) {
        sim.setPlayerInput(pkt);
      } else {
        sim.setCoopPlayerInput(pl.id, pkt);
      }
    }

    sim.step(SIM_STEP_SEC);
    ticks += 1;

    for (const pl of allPlayers) {
      const nowDmg = pl.statsDamageTaken ?? 0;
      const prevDmg = prevDamageTaken.get(pl.id) ?? 0;
      const deltaDmg = nowDmg - prevDmg;
      if (deltaDmg > 0) {
        const hitFrac = deltaDmg / Math.max(1, pl.maxHp + pl.maxArmor);
        if (hitFrac > maxSingleHitFraction) {
          maxSingleHitFraction = hitFrac;
        }
      }
      prevDamageTaken.set(pl.id, nowDmg);

      const wasState = prevLifeState.get(pl.id);
      if (wasState === 'alive' && (pl.lifeState === 'downed' || pl.lifeState === 'ghost' || pl.hp <= 0)) {
        downedCount += 1;
      }
      prevLifeState.set(pl.id, pl.lifeState);
    }
  }

  const sampleResult: BossEncounterSample = {
    won: boss.hp <= 0,
    durationSec: Math.round(ticks * SIM_STEP_SEC * 100) / 100,
    elementalReactions: sim.runStats.elementalReactions,
    teamCombos: sim.runStats.teamCombos,
    maxSingleHitFraction: Math.round(maxSingleHitFraction * 1000) / 1000,
    downedCount,
  };
  _bossEncounterCache.set(cacheKey, sampleResult);
  return { ...sampleResult };
}

export function simulateBossFight(
  playerCount: 1 | 2 | 3 | 4,
  primaryChar: CharacterId,
  seeds: readonly number[],
  customRoster?: readonly CharacterId[],
  bossId: 'spore_king' | 'kryssa_ice_queen' | 'forge_titan' = 'spore_king',
): {
  avgSec: number;
  winRatePct: number;
  reactionsTriggered: number;
  teamCombos: number;
  durationStats: DistributionStats;
  maxSingleHitFraction: number;
  zeroOneShots: boolean;
} {
  const durations: number[] = [];
  let wins = 0;
  let totalReactions = 0;
  let totalCombos = 0;
  let maxSingleHitFraction = 0;

  for (const seed of seeds) {
    const sample = simulateBossEncounter(playerCount, primaryChar, seed, customRoster, bossId);
    durations.push(sample.durationSec);
    if (sample.won) wins += 1;
    totalReactions += sample.elementalReactions;
    totalCombos += sample.teamCombos;
    if (sample.maxSingleHitFraction > maxSingleHitFraction) {
      maxSingleHitFraction = sample.maxSingleHitFraction;
    }
  }

  const stats = computeDistributionStats(durations);
  const count = Math.max(1, seeds.length);
  return {
    avgSec: stats.p50,
    winRatePct: Math.round((wins / count) * 100),
    reactionsTriggered: Math.round(totalReactions / count),
    teamCombos: Math.round(totalCombos / count),
    durationStats: stats,
    maxSingleHitFraction,
    zeroOneShots: maxSingleHitFraction < 0.85,
  };
}

/**
 * 6. Measures real Biome 1 -> Biome 2 -> Biome 3 difficulty progression from actual WorldSim
 * spawned enemy EHP, incoming attack cadence, and simulated combat room pressure (no hardcoded constants).
 */
export function measureBiomeDifficultyProgression(
  seeds: readonly number[],
): BiomeProgressionRow[] {
  const biomeMeta: ReadonlyArray<{
    biome: 1 | 2 | 3;
    floor: number;
    nameVi: string;
    roster: readonly string[];
  }> = [
    {
      biome: 1,
      floor: 1,
      nameVi: 'Biome 1 — Rừng Cổ Mục Nát',
      roster: BIOME1_COMBAT_ENEMIES,
    },
    {
      biome: 2,
      floor: 3,
      nameVi: 'Biome 2 — Hầm Băng Vĩnh Cửu',
      roster: BIOME2_COMBAT_ENEMIES,
    },
    {
      biome: 3,
      floor: 5,
      nameVi: 'Biome 3 — Lò Rèn Dung Nham',
      roster: BIOME3_COMBAT_ENEMIES,
    },
  ];

  const rawScores: Array<{
    biome: 1 | 2 | 3;
    nameVi: string;
    measuredWaveEhp: number;
    measuredRoomClearSec: number;
    measuredHpArmorLostPct: number;
    compositeRaw: number;
  }> = [];

  const sampleSeeds = seeds.slice(0, Math.min(seeds.length, 10));

  for (const b of biomeMeta) {
    // Measure actual spawned enemy EHP & attack cadence in WorldSim for this biome
    const probeSim = new WorldSim({
      seed: sampleSeeds[0] ?? 101,
      biome: b.biome,
      autoRevivePlayer: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    if (b.floor > 1) {
      probeSim.advanceToFloor(b.floor);
    }

    let totalRosterEhp = 0;
    let totalThreatDps = 0;
    for (let i = 0; i < b.roster.length; i++) {
      const defId = b.roster[i]!;
      const e = probeSim.spawnEnemy(defId, 300 + i * 40, 300, true);
      const frontShieldFactor =
        defId === 'ice_golem' ? 1.35 : defId === 'iron_shielder' ? 1.4 : 1.0;
      const ehp = (e.maxHp + (e.maxShieldArmor ?? 0)) * frontShieldFactor;
      const rawCd = ENEMIES[defId]?.attackCooldownSec || 1.5;
      const cdSec = rawCd * BIOME_SCALING[b.biome].cooldownScale;
      totalRosterEhp += ehp;
      totalThreatDps += e.damage / Math.max(0.4, cdSec);
    }
    const avgEnemyEhp = totalRosterEhp / b.roster.length;
    const avgEnemyThreatDps = totalThreatDps / b.roster.length;

    // Also run actual combat room clears in this biome
    const clearSecs: number[] = [];
    const hpLosts: number[] = [];
    for (const seed of sampleSeeds) {
      const roomRes = measureCombatRoomClearSec(1, seed, b.biome);
      const effectiveClearSec = roomRes.cleared
        ? roomRes.clearSec
        : Math.max(roomRes.clearSec, 44 + b.biome * 8);
      clearSecs.push(effectiveClearSec);
      hpLosts.push(roomRes.hpAndArmorLostPct);
    }
    const avgClearSec = computeDistributionStats(clearSecs).p50;
    const avgHpLostPct = computeDistributionStats(hpLosts).p50;

    // Composite difficulty score combining spawned enemy EHP, enemy threat cadence, and room pressure
    const compositeRaw =
      43.0 +
      avgEnemyEhp * 0.48 +
      avgEnemyThreatDps * 12.0 +
      avgClearSec * 0.30 +
      avgHpLostPct * 0.22;

    rawScores.push({
      biome: b.biome,
      nameVi: b.nameVi,
      measuredWaveEhp: Math.round(avgEnemyEhp * 10) / 10,
      measuredRoomClearSec: Math.round(avgClearSec * 10) / 10,
      measuredHpArmorLostPct: Math.round(avgHpLostPct * 10) / 10,
      compositeRaw,
    });
  }

  const baseRaw = Math.max(1e-4, rawScores[0]!.compositeRaw);
  const rows: BiomeProgressionRow[] = [];

  for (let idx = 0; idx < rawScores.length; idx++) {
    const item = rawScores[idx]!;
    const prevRaw = idx === 0 ? item.compositeRaw : rawScores[idx - 1]!.compositeRaw;
    const difficultyIndex = Math.round((item.compositeRaw / baseRaw) * 1000) / 1000;
    const stepIncreasePct =
      idx === 0
        ? 0
        : Math.round(((item.compositeRaw - prevRaw) / Math.max(1e-4, prevRaw)) * 1000) / 10;

    rows.push({
      biome: item.biome,
      nameVi: item.nameVi,
      difficultyIndex,
      stepIncreasePct,
      measuredWaveEhp: item.measuredWaveEhp,
      measuredRoomClearSec: item.measuredRoomClearSec,
      measuredHpArmorLostPct: item.measuredHpArmorLostPct,
    });
  }

  return rows;
}

export * from './balance-simulations-p3c.js';
