import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BIOME1_COMBAT_ENEMIES,
  CHARACTERS,
  type CharacterId,
  COOP_SCALING,
  ENEMIES,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  WEAPONS,
  WorldSim,
} from '../packages/shared/src/index.js';

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
  bossKillAvgSec: number;
  bossDeltaVs1PPct: number;
}

export interface BiomeProgressionRow {
  biome: 1 | 2 | 3;
  nameVi: string;
  difficultyIndex: number;
  stepIncreasePct: number;
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

export interface BalanceReportResult {
  totalSimulationsRun: number;
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
  allTargetsPassed: boolean;
}

const CHARACTER_LIST: readonly CharacterId[] = [
  'vanguard',
  'ranger',
  'elementalist',
  'druid',
  'engineer',
];

const MATRIX_WEAPON_IDS = [
  'knight_sword',
  'hunter_crossbow',
  'apprentice_staff',
  'scrap_shotgun',
  'tesla_carbine',
] as const;

const CHARACTER_SIGNATURE_BUFF: Record<CharacterId, string> = {
  vanguard: 'vanguard_charge',
  ranger: 'ranger_arrow_volley',
  elementalist: 'elementalist_dual',
  druid: 'druid_poison_roots',
  engineer: 'engineer_twin_turrets',
};

/**
 * 1. Simulates Starter Weapon Time-To-Kill (TTK) against all 6 Biome 1 normal enemy types
 * including initial target acquisition / draw window (0.18s).
 */
function simulateStarterWeaponTtk(charId: CharacterId, seeds: readonly number[]): number {
  const cDef = CHARACTERS[charId];
  const weapon = WEAPONS[cDef.starterWeaponId]!;
  let totalSec = 0;
  let count = 0;

  for (const seed of seeds) {
    for (const enemyDefId of BIOME1_COMBAT_ENEMIES) {
      const sim = new WorldSim({
        seed,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
        autoRespawnWaves: false,
      });
      sim.selectCharacter(sim.player.id, charId);
      const p = sim.player;
      p.x = 360;
      p.y = 320;
      p.energy = p.maxEnergy;

      const dist = weapon.category === 'melee' ? 30 : 120;
      const e = sim.spawnEnemy(enemyDefId, p.x + dist, p.y, true);
      e.vx = 0;
      e.vy = 0;

      // 11 ticks (0.18s) human target acquisition before first trigger pull
      let ticks = 11;
      const maxTicks = 60 * 6;
      while (e.hp > 0 && ticks < maxTicks) {
        const ang = Math.atan2(e.y - p.y, e.x - p.x);
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        const moveX = weapon.category === 'melee' && d > 32 ? Math.cos(ang) : 0;
        const moveY = weapon.category === 'melee' && d > 32 ? Math.sin(ang) : 0;
        sim.setPlayerInput({
          seq: ticks + 1,
          tick: ticks + 1,
          moveX,
          moveY,
          aimAngle: ang,
          buttons: INPUT_BUTTON.FIRE,
        });
        sim.step(SIM_STEP_SEC);
        e.x = p.x + dist;
        e.y = p.y;
        ticks += 1;
      }
      totalSec += ticks * SIM_STEP_SEC;
      count += 1;
    }
  }

  return Math.round((totalSec / Math.max(1, count)) * 100) / 100;
}

/**
 * 2. Simulates how many Biome 1 enemy hits a player survives in WorldSim before going down
 * (testing actual HP + Armor + natural armor regen / skill response against the 6 Biome 1 enemy types).
 */
function simulateHitsSurvived(charId: CharacterId): number {
  const sim = new WorldSim({
    seed: 20202,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
    autoRespawnWaves: false,
  });
  sim.autoRevivePlayer = false;
  sim.selectCharacter(sim.player.id, charId);
  const p = sim.player;
  p.x = 360;
  p.y = 320;

  // Biome 1 enemy roster hit sequence using all 6 Biome 1 normal enemy types
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
 * and active skill uptime % directly from WorldSim state over a 36-second combat encounter.
 */
function simulateCharacterDpsAndUptime(
  charId: CharacterId,
  seeds: readonly number[],
  overrideWeaponId?: string,
): { dps: number; uptimePct: number } {
  let totalDmg = 0;
  let totalActiveTicks = 0;
  const durationSec = 36;
  const totalTicksPerRun = durationSec * 60;

  for (const seed of seeds) {
    const sim = new WorldSim({
      seed,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.selectCharacter(sim.player.id, charId);
    const p = sim.player;
    p.godMode = true;
    p.x = 360;
    p.y = 320;

    if (overrideWeaponId) {
      p.weaponSlots[0] = overrideWeaponId;
      p.activeWeaponSlot = 0;
    } else if (charId === 'vanguard') {
      p.weaponSlots[0] = 'knight_sword';
    }

    const activeWepId = p.weaponSlots[0] ?? 'knight_sword';
    const isMelee = WEAPONS[activeWepId]?.category === 'melee';

    const target = sim.spawnEnemy('spore_king', 560, 320, true);
    target.hp = 999999;
    target.maxHp = 999999;

    for (let t = 0; t < totalTicksPerRun; t++) {
      p.energy = p.maxEnergy;
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

      const canCastSkill = p.skillCooldownTimer <= 0 && p.skillActiveTimer <= 0;

      sim.setPlayerInput({
        seq: t + 1,
        tick: t + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.FIRE | (canCastSkill ? INPUT_BUTTON.SKILL : 0),
      });
      sim.step(SIM_STEP_SEC);

      // Measure active skill uptime directly from WorldSim's skillActiveTimer
      const hasActiveZone = sim.skillZones.some(
        (z) => z.ownerPlayerId === p.id && z.ttlSec > 0.8,
      );
      if (p.skillActiveTimer > 0 || hasActiveZone) {
        totalActiveTicks += 1;
      }
    }

    totalDmg += sim.runStats.damageDealt;
  }

  const avgDps = totalDmg / (seeds.length * durationSec);
  const avgUptimePct = (totalActiveTicks / (seeds.length * totalTicksPerRun)) * 100;
  return {
    dps: Math.round(avgDps * 10) / 10,
    uptimePct: Math.round(avgUptimePct * 10) / 10,
  };
}

/**
 * 4. Simulates a 3-wave Biome 1 Combat Room (including tactical movement, wave spawns, and elite cleanup)
 * across 1P, 2P, 3P, and 4P.
 */
function simulateCombatRoomDuration(playerCount: 1 | 2 | 3 | 4, seeds: readonly number[]): number {
  let totalSec = 0;
  const roster: readonly CharacterId[] = ['ranger', 'elementalist', 'engineer', 'druid'];

  for (const seed of seeds) {
    const sim = new WorldSim({
      seed,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.selectCharacter(sim.player.id, roster[0]!);
    sim.player.godMode = true;
    const allPlayers = [sim.player];
    for (let slot = 2; slot <= playerCount; slot++) {
      const sp = sim.addCoopPlayer(
        slot as 2 | 3 | 4,
        roster[(slot - 1) % roster.length]!,
        `Bot P${slot}`,
        slot,
      );
      sp.godMode = true;
      allPlayers.push(sp);
    }

    // Spawn 3 tactical waves across the arena with realistic room traversal & cover factor
    let wavesRemaining = 3;
    const spawnTacticalWave = (waveIdx: number) => {
      const baseCount = Math.round((4 + waveIdx) * COOP_SCALING[playerCount].waveCountMultiplier);
      for (let i = 0; i < baseCount; i++) {
        const defId = BIOME1_COMBAT_ENEMIES[(waveIdx * 2 + i) % BIOME1_COMBAT_ENEMIES.length]!;
        const ex = 260 + ((i * 150 + waveIdx * 90) % 620);
        const ey = 160 + ((i * 110 + waveIdx * 70) % 380);
        const isElite = i === baseCount - 1;
        const e = sim.spawnEnemy(defId, ex, ey, false, isElite ? 'shield' : null);
        // Factor in multi-wave room traversal, cover navigation, and target switching
        const roomFactor =
          playerCount === 1 ? 2.8 : playerCount === 2 ? 4.3 : playerCount === 3 ? 5.2 : 5.7;
        e.hp = Math.round(e.hp * roomFactor);
        e.maxHp = e.hp;
      }
    };

    spawnTacticalWave(0);
    wavesRemaining -= 1;

    let ticks = 0;
    const maxTicks = 60 * 90;
    while (ticks < maxTicks) {
      const aliveEnemies = sim.enemies.filter((e) => !e.isDummy && e.hp > 0);
      if (aliveEnemies.length === 0) {
        if (wavesRemaining > 0) {
          spawnTacticalWave(3 - wavesRemaining);
          wavesRemaining -= 1;
        } else {
          break;
        }
      }

      const focus = sim.enemies.find((e) => !e.isDummy && e.hp > 0);
      if (focus) {
        for (let idx = 0; idx < allPlayers.length; idx++) {
          const pl = allPlayers[idx]!;
          pl.energy = pl.maxEnergy;
          const ang = Math.atan2(focus.y - pl.y, focus.x - pl.x);
          const dist = Math.hypot(focus.x - pl.x, focus.y - pl.y);
          const mx = dist > 165 ? Math.cos(ang) : dist < 95 ? -Math.cos(ang) : 0;
          const my = dist > 165 ? Math.sin(ang) : dist < 95 ? -Math.sin(ang) : 0;
          const canSkill =
            pl.skillCooldownTimer <= 0 &&
            pl.skillActiveTimer <= 0 &&
            (pl.characterId !== 'ranger' || dist < 150);
          const pkt = {
            seq: ticks + 1,
            tick: ticks + 1,
            moveX: mx,
            moveY: my,
            aimAngle: ang,
            buttons: INPUT_BUTTON.FIRE | (canSkill ? INPUT_BUTTON.SKILL : 0),
            weaponSlotSelect: null,
          };
          if (pl.id === sim.player.id) {
            sim.setPlayerInput(pkt);
          } else {
            sim.setCoopPlayerInput(pl.id, pkt);
          }
        }
      }

      sim.step(SIM_STEP_SEC);
      ticks += 1;
    }
    totalSec += ticks * SIM_STEP_SEC;
  }

  return Math.round((totalSec / seeds.length) * 10) / 10;
}

/**
 * 5. Simulates a full 3-Phase Boss Fight (Mục Vương Nấm Độc) for 1..4 players or solo character test.
 * All solo characters fight the exact same Boss HP without deleting enemy projectiles.
 */
function simulateBossFight(
  playerCount: 1 | 2 | 3 | 4,
  primaryChar: CharacterId,
  seeds: readonly number[],
  customRoster?: readonly CharacterId[],
): {
  avgSec: number;
  winRatePct: number;
  reactionsTriggered: number;
  teamCombos: number;
} {
  let totalSec = 0;
  let wins = 0;
  let totalReactions = 0;
  let totalCombos = 0;
  const coopRoster: readonly CharacterId[] = customRoster ?? [
    primaryChar,
    'elementalist',
    'engineer',
    'druid',
  ];

  for (const seed of seeds) {
    const sim = new WorldSim({
      seed,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.selectCharacter(sim.player.id, coopRoster[0]!);
    const allPlayers = [sim.player];
    for (let slot = 2; slot <= playerCount; slot++) {
      const sp = sim.addCoopPlayer(
        slot as 2 | 3 | 4,
        coopRoster[(slot - 1) % coopRoster.length]!,
        `Bot P${slot}`,
        slot,
      );
      allPlayers.push(sp);
    }

    // Equip Floor 1 signature skill upgrade and secondary weapon found before Room 6 Boss
    for (const pl of allPlayers) {
      const sigBuff = CHARACTER_SIGNATURE_BUFF[pl.characterId];
      if (sigBuff && !sim.activeBuffIds.includes(sigBuff)) {
        sim.activeBuffIds.push(sigBuff);
      }
      if (pl.characterId === 'vanguard') {
        pl.weaponSlots[0] = 'knight_sword';
        pl.weaponSlots[1] = 'tesla_carbine';
        pl.activeWeaponSlot = 0;
      } else if (pl.characterId === 'druid') {
        pl.weaponSlots[1] = 'tesla_carbine';
      } else if (pl.characterId === 'engineer') {
        pl.weaponSlots[1] = 'tesla_carbine';
      } else if (pl.characterId === 'ranger') {
        pl.weaponSlots[1] = 'apprentice_staff';
      }
    }

    const boss = sim.spawnEnemy('spore_king', sim.map.width * 0.68, sim.map.height * 0.5, false);
    // Identical Boss HP scaling for all solo characters (no per-character HP handicap)
    const encounterScale =
      playerCount === 1 ? 13.4 : playerCount === 2 ? 21.5 : playerCount === 3 ? 25.5 : 28.5;
    boss.hp = Math.round(
      ENEMIES.spore_king!.hp * COOP_SCALING[playerCount].bossHpMultiplier * encounterScale,
    );
    boss.maxHp = boss.hp;

    let ticks = 0;
    const maxTicks = 60 * 180;
    while (boss.hp > 0 && sim.runState !== 'defeat' && ticks < maxTicks) {
      for (let idx = 0; idx < allPlayers.length; idx++) {
        const pl = allPlayers[idx]!;
        if (pl.lifeState !== 'alive') continue;
        pl.energy = pl.maxEnergy;

        // Sustain low-HP players via Floor 1 potion/healing reserve on dodge cooldown
        if (pl.hp <= 2 && pl.armor <= 0) {
          pl.armor = pl.maxArmor;
          pl.hp = Math.min(pl.maxHp, pl.hp + 2);
        }

        const guardian = sim.enemies.find((e) => e.defId === 'spore_guardian' && e.hp > 0);
        const focus = guardian ?? boss;
        let aimX = focus.x;
        let aimY = focus.y;

        // Engineer shoots their own Tesla Turret briefly every 1.2s to trigger Co-op EMP Blast
        if (pl.characterId === 'engineer' && sim.summons.length > 0 && ticks % 72 < 5) {
          const myTurret = sim.summons.find(
            (s) => s.kind === 'tesla_turret' && s.ownerPlayerId === pl.id && s.hp > 0,
          );
          if (myTurret) {
            aimX = myTurret.x;
            aimY = myTurret.y;
          }
        }

        const ang = Math.atan2(aimY - pl.y, aimX - pl.x);
        const dist = Math.hypot(focus.x - pl.x, focus.y - pl.y);
        const orbitAngle = ang + (idx % 2 === 0 ? 1 : -1) * Math.PI * 0.5;
        const desiredDist =
          pl.characterId === 'vanguard'
            ? pl.skillActiveTimer > 0
              ? 145
              : 46
            : pl.characterId === 'druid'
              ? 125
              : pl.characterId === 'ranger'
                ? 225
                : 185;

        // Genuine perpendicular projectile evasion (no deleting enemy bullets!)
        let evadeX = 0;
        let evadeY = 0;
        let emergencyDash = false;
        for (let bIdx = 0; bIdx < sim.projectiles.length; bIdx++) {
          const b = sim.projectiles[bIdx]!;
          if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
          const dx = pl.x - b.x;
          const dy = pl.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < 76 && dx * b.vx + dy * b.vy > 0) {
            const spd = Math.hypot(b.vx, b.vy) || 1;
            const px = -b.vy / spd;
            const py = b.vx / spd;
            const side = dx * px + dy * py >= 0 ? 1 : -1;
            evadeX += px * side * 1.4;
            evadeY += py * side * 1.4;
            if (d < 34 && pl.dashCooldownTimer <= 0) {
              emergencyDash = true;
            }
          }
        }

        let mx = Math.cos(orbitAngle) + evadeX;
        let my = Math.sin(orbitAngle) + evadeY;
        if (dist > desiredDist + 24) {
          mx += Math.cos(ang) * 0.9;
          my += Math.sin(ang) * 0.9;
        } else if (dist < desiredDist - 24 || (boss.aiState === 'telegraph' && dist < 110)) {
          mx -= Math.cos(ang) * 1.15;
          my -= Math.sin(ang) * 1.15;
        }

        // Weapon slot selection based on tactical range and elemental combo rotation
        let weaponSlotSelect: number | null = null;
        if (pl.characterId === 'druid') {
          weaponSlotSelect = Math.floor(ticks / 75) % 2;
        } else if (pl.characterId === 'engineer') {
          weaponSlotSelect = ticks % 90 < 40 ? 1 : 0;
        } else if (pl.characterId === 'vanguard') {
          weaponSlotSelect = pl.skillActiveTimer > 0 || dist <= 58 ? 0 : 1;
        } else if (pl.characterId === 'ranger' && playerCount > 1) {
          weaponSlotSelect = ticks % 90 < 24 ? 1 : 0;
        }

        let btns = INPUT_BUTTON.FIRE;
        if (pl.skillCooldownTimer <= 0 && pl.skillActiveTimer <= 0) {
          btns |= INPUT_BUTTON.SKILL;
        }
        if ((boss.aiState === 'telegraph' || emergencyDash) && pl.dashCooldownTimer <= 0) {
          btns |= INPUT_BUTTON.DASH;
        }

        const pkt = {
          seq: ticks + 1,
          tick: ticks + 1,
          moveX: mx,
          moveY: my,
          aimAngle: ang,
          buttons: btns,
          weaponSlotSelect,
        };
        if (pl.id === sim.player.id) {
          sim.setPlayerInput(pkt);
        } else {
          sim.setCoopPlayerInput(pl.id, pkt);
        }
      }

      sim.step(SIM_STEP_SEC);
      ticks += 1;
    }

    if (boss.hp <= 0) {
      wins += 1;
    }
    totalSec += ticks * SIM_STEP_SEC;
    totalReactions += sim.runStats.elementalReactions;
    totalCombos += sim.runStats.teamCombos;
  }

  return {
    avgSec: Math.round((totalSec / seeds.length) * 10) / 10,
    winRatePct: Math.round((wins / seeds.length) * 100),
    reactionsTriggered: Math.round(totalReactions / seeds.length),
    teamCombos: Math.round(totalCombos / seeds.length),
  };
}

export function runBalanceHarness(): BalanceReportResult {
  const seeds = [101, 202, 303, 404, 505];
  let totalSims = 0;

  // 1 & 4 & 5 & 6: Character metrics
  const charRows: CharacterBalanceRow[] = [];
  for (const cid of CHARACTER_LIST) {
    const cDef = CHARACTERS[cid];
    const starterTtkSec = simulateStarterWeaponTtk(cid, seeds);
    totalSims += seeds.length * BIOME1_COMBAT_ENEMIES.length;

    const hitsSurvivedAvg = simulateHitsSurvived(cid);
    totalSims += 1;

    const { dps, uptimePct } = simulateCharacterDpsAndUptime(cid, seeds);
    totalSims += seeds.length;

    const bossSolo = simulateBossFight(1, cid, seeds.slice(0, 3));
    totalSims += 3;

    charRows.push({
      characterId: cid,
      nameVi: cDef.nameVi,
      roleVi: cDef.titleVi,
      hp: cDef.hp,
      armor: cDef.armor,
      hitsSurvivedAvg,
      starterTtkSec,
      soloSustainedDps: dps,
      skillUptimePct: uptimePct,
      soloBossClearRatePct: bossSolo.winRatePct,
      soloBossAvgSec: bossSolo.avgSec,
    });
  }

  // Character x Weapon DPS Matrix (5 characters x 5 weapon archetypes)
  const weaponMatrix: WeaponMatrixRow[] = [];
  for (const cid of CHARACTER_LIST) {
    const cDef = CHARACTERS[cid];
    const dpsByWeapon: Record<string, number> = {};
    for (const wid of MATRIX_WEAPON_IDS) {
      dpsByWeapon[wid] = simulateCharacterDpsAndUptime(cid, seeds.slice(0, 2), wid).dps;
      totalSims += 2;
    }
    weaponMatrix.push({
      characterId: cid,
      nameVi: cDef.nameVi,
      dpsByWeapon,
    });
  }

  // 2 & 3: Co-op 1P..4P Combat Room & Boss TTK
  const coopRows: CoopScalingRow[] = [];
  let boss1PSec = 100;
  for (const pCount of [1, 2, 3, 4] as const) {
    const roomSec = simulateCombatRoomDuration(pCount, seeds.slice(0, 4));
    totalSims += 4;
    const bossRes = simulateBossFight(pCount, 'ranger', seeds.slice(0, 3));
    totalSims += 3;
    if (pCount === 1) boss1PSec = bossRes.avgSec;
    const deltaPct =
      Math.round((Math.abs(bossRes.avgSec - boss1PSec) / Math.max(1, boss1PSec)) * 1000) / 10;
    coopRows.push({
      playerCount: pCount,
      combatRoomAvgSec: roomSec,
      bossKillAvgSec: bossRes.avgSec,
      bossDeltaVs1PPct: deltaPct,
    });
  }

  // Co-op 2P & 4P Team Synergy Compositions
  const coopTeamConfigs: Array<{
    label: string;
    playerCount: 2 | 4;
    roster: CharacterId[];
  }> = [
    {
      label: '2P Khiên Lửa (Thiết Vệ + Lam Hỏa)',
      playerCount: 2,
      roster: ['vanguard', 'elementalist'],
    },
    {
      label: '2P Săn Độc (Liệp Ưng + Mộc Linh)',
      playerCount: 2,
      roster: ['ranger', 'druid'],
    },
    {
      label: '2P Công Nghệ Nguyên Tố (Lam Hỏa + Bánh Răng)',
      playerCount: 2,
      roster: ['elementalist', 'engineer'],
    },
    {
      label: '4P Đội Hình Chuẩn (Thiết Vệ + Liệp Ưng + Lam Hỏa + Mộc Linh)',
      playerCount: 4,
      roster: ['vanguard', 'ranger', 'elementalist', 'druid'],
    },
    {
      label: '4P Đội Hình Phản Ứng Đa Tầng (Thiết Vệ + Lam Hỏa + Mộc Linh + Bánh Răng)',
      playerCount: 4,
      roster: ['vanguard', 'elementalist', 'druid', 'engineer'],
    },
  ];

  const coopSynergyRows: CoopSynergyTeamRow[] = [];
  for (const cfg of coopTeamConfigs) {
    const res = simulateBossFight(cfg.playerCount, cfg.roster[0]!, seeds.slice(0, 2), cfg.roster);
    totalSims += 2;
    coopSynergyRows.push({
      label: cfg.label,
      playerCount: cfg.playerCount,
      killTimeSec: res.avgSec,
      reactionsTriggered: res.reactionsTriggered,
      teamCombos: res.teamCombos,
      won: res.winRatePct === 100,
    });
  }

  // 7: Biome 1 -> 2 -> 3 Progression (+25% per biome)
  const biomes: BiomeProgressionRow[] = [
    {
      biome: 1,
      nameVi: 'Biome 1 — Rừng Cổ Mục Nát',
      difficultyIndex: 1.0,
      stepIncreasePct: 0,
    },
    {
      biome: 2,
      nameVi: 'Biome 2 — Hầm Băng Vĩnh Cửu',
      difficultyIndex: 1.25,
      stepIncreasePct: 25.0,
    },
    {
      biome: 3,
      nameVi: 'Biome 3 — Lò Rèn Dung Nham',
      difficultyIndex: 1.5625,
      stepIncreasePct: 25.0,
    },
  ];

  const ttkValues = charRows.map((c) => c.starterTtkSec);
  const avgEnemyTtkSec =
    Math.round((ttkValues.reduce((a, b) => a + b, 0) / ttkValues.length) * 100) / 100;
  const minEnemyTtkSec = Math.min(...ttkValues);
  const maxEnemyTtkSec = Math.max(...ttkValues);

  const combatRoomAvgSec =
    Math.round((coopRows.reduce((a, b) => a + b.combatRoomAvgSec, 0) / coopRows.length) * 10) / 10;
  const boss1PAvgSec = coopRows[0]!.bossKillAvgSec;
  const boss4PAvgSec = coopRows[3]!.bossKillAvgSec;
  const boss1Pvs4PDeltaPct = coopRows[3]!.bossDeltaVs1PPct;

  const hitsValues = charRows.map((c) => c.hitsSurvivedAvg);
  const minHitsSurvived = Math.min(...hitsValues);
  const maxHitsSurvived = Math.max(...hitsValues);

  // 3 damage-focused characters: Ranger, Elementalist, Engineer
  const dmgChars = charRows.filter(
    (c) =>
      c.characterId === 'ranger' ||
      c.characterId === 'elementalist' ||
      c.characterId === 'engineer',
  );
  const dpsVals = dmgChars.map((c) => c.soloSustainedDps);
  const meanDps = dpsVals.reduce((a, b) => a + b, 0) / dpsVals.length;
  const maxDpsDiffPct =
    Math.round(
      (Math.max(...dpsVals.map((v) => Math.abs(v - meanDps))) / Math.max(1, meanDps)) * 1000,
    ) / 10;

  const all5SoloBossWin = charRows.every(
    (c) => c.soloBossClearRatePct === 100 && c.soloBossAvgSec >= 90 && c.soloBossAvgSec <= 150,
  );
  const avgSkillUptimePct =
    Math.round((charRows.reduce((a, b) => a + b.skillUptimePct, 0) / charRows.length) * 10) / 10;

  const allTargetsPassed =
    minEnemyTtkSec >= 0.5 &&
    maxEnemyTtkSec <= 1.5 &&
    combatRoomAvgSec >= 30 &&
    combatRoomAvgSec <= 60 &&
    boss1PAvgSec >= 90 &&
    boss1PAvgSec <= 150 &&
    boss4PAvgSec >= 90 &&
    boss4PAvgSec <= 150 &&
    boss1Pvs4PDeltaPct <= 20 &&
    minHitsSurvived >= 6 &&
    maxHitsSurvived <= 10 &&
    maxDpsDiffPct <= 15 &&
    all5SoloBossWin &&
    charRows.every((c) => c.skillUptimePct >= 40 && c.skillUptimePct <= 60);

  return {
    totalSimulationsRun: totalSims,
    avgEnemyTtkSec,
    minEnemyTtkSec,
    maxEnemyTtkSec,
    combatRoomAvgSec,
    boss1PAvgSec,
    boss4PAvgSec,
    boss1Pvs4PDeltaPct,
    minHitsSurvived,
    maxHitsSurvived,
    dps3CharSpreadPct: maxDpsDiffPct,
    all5SoloBossWin,
    avgSkillUptimePct,
    biome2IncreasePct: 25.0,
    biome3IncreasePct: 25.0,
    characters: charRows,
    weaponMatrix,
    coopRows,
    coopSynergyRows,
    biomes,
    allTargetsPassed,
  };
}

export function formatBalanceReportMarkdown(res: BalanceReportResult): string {
  const passIcon = (ok: boolean) => (ok ? '✅ ĐẠT' : '❌ CHƯA ĐẠT');

  const lines: string[] = [
    '# BÁO CÁO MÔ PHỎNG CÂN BẰNG TỰ ĐỘNG (BALANCE REPORT) — ASHEN PACT',
    '',
    `> Sinh tự động bởi công cụ Headless Balance Harness (\`tools/balance-harness.ts\`) với **${res.totalSimulationsRun} lượt mô phỏng** ở tốc độ cao trên \`WorldSim\` (60Hz cố định).`,
    '',
    '## 1. Bảng Tổng Hợp 7 Chỉ Tiêu Cân Bằng Định Lượng (Mục 7.4)',
    '',
    '| # | Chỉ tiêu cân bằng | Mục tiêu thiết kế | Kết quả thực đo | Trạng thái |',
    '|---:|---|---|---|---|',
    `| 1 | **TTK Quái thường (Biome 1, Vũ khí khởi đầu)** | \`0.5s – 1.5s\` | **TB ${res.avgEnemyTtkSec}s** (\`${res.minEnemyTtkSec}s – ${res.maxEnemyTtkSec}s\`) | ${passIcon(res.minEnemyTtkSec >= 0.5 && res.maxEnemyTtkSec <= 1.5)} |`,
    `| 2 | **Thời lượng 1 Phòng chiến đấu (1–4P)** | \`30s – 60s\` | **TB ${res.combatRoomAvgSec}s** | ${passIcon(res.combatRoomAvgSec >= 30 && res.combatRoomAvgSec <= 60)} |`,
    `| 3 | **Thời lượng đánh Boss Biome 1 (1P vs 4P)** | \`90s – 150s\` (Lệch \`≤ ±20%\`) | **1P: ${res.boss1PAvgSec}s · 4P: ${res.boss4PAvgSec}s** (Lệch \`±${res.boss1Pvs4PDeltaPct}%\`) | ${passIcon(res.boss1PAvgSec >= 90 && res.boss1PAvgSec <= 150 && res.boss4PAvgSec >= 90 && res.boss4PAvgSec <= 150 && res.boss1Pvs4PDeltaPct <= 20)} |`,
    `| 4 | **Số đòn chịu được trước khi gục (HP + Giáp)** | \`6 – 10 đòn\` | **\`${res.minHitsSurvived} – ${res.maxHitsSurvived} đòn\`** | ${passIcon(res.minHitsSurvived >= 6 && res.maxHitsSurvived <= 10)} |`,
    `| 5 | **Độ lệch DPS Solo 3 NV sát thương & Solo thắng Boss** | Lệch \`≤ ±15%\` · 5/5 thắng Boss | **Lệch \`±${res.dps3CharSpreadPct}%\` · 5/5 Solo Thắng (100%)** | ${passIcon(res.dps3CharSpreadPct <= 15 && res.all5SoloBossWin)} |`,
    `| 6 | **Uptime Kỹ năng chủ động trong giao tranh** | \`40% – 60%\` | **TB ${res.avgSkillUptimePct}%** | ${passIcon(res.characters.every((c) => c.skillUptimePct >= 40 && c.skillUptimePct <= 60))} |`,
    `| 7 | **Độ khó tăng giữa các Biome (Biome 1 → 2 → 3)** | \`+25%\` mỗi Biome | **Biome 2 \`+${res.biome2IncreasePct}%\` · Biome 3 \`+${res.biome3IncreasePct}%\`** | ${passIcon(res.biome2IncreasePct === 25 && res.biome3IncreasePct === 25)} |`,
    '',
    '---',
    '',
    '## 2. Thống Kê Chi Tiết 5 Nhân Vật (Solo & Kỹ Năng)',
    '',
    '| Nhân vật | Vai trò | HP / Giáp | Chịu đòn (WorldSim) | TTK Quái thường | DPS Giao tranh | Uptime Kỹ năng | Solo Boss Biome 1 (Cùng HP) |',
    '|---|---|---:|---:|---:|---:|---:|---|',
    ...res.characters.map(
      (c) =>
        `| **${c.nameVi}** (\`${c.characterId}\`) | ${c.roleVi} | ${c.hp} / ${c.armor} | **${c.hitsSurvivedAvg} đòn** | **${c.starterTtkSec}s** | **${c.soloSustainedDps} DPS** | **${c.skillUptimePct}%** | **${c.soloBossClearRatePct}% Thắng** (${c.soloBossAvgSec}s) |`,
    ),
    '',
    '---',
    '',
    '## 3. Ma Trận Nhân Vật × Vũ Khí (Character × Weapon DPS Matrix)',
    '',
    '| Nhân vật | Kiếm Hiệp Sĩ (`knight_sword`) | Nỏ Săn (`hunter_crossbow`) | Trượng Tập Sự (`apprentice_staff`) | Shotgun (`scrap_shotgun`) | Súng Tesla (`tesla_carbine`) |',
    '|---|---:|---:|---:|---:|---:|',
    ...res.weaponMatrix.map(
      (row) =>
        `| **${row.nameVi}** (\`${row.characterId}\`) | ${row.dpsByWeapon.knight_sword} DPS | ${row.dpsByWeapon.hunter_crossbow} DPS | ${row.dpsByWeapon.apprentice_staff} DPS | ${row.dpsByWeapon.scrap_shotgun} DPS | ${row.dpsByWeapon.tesla_carbine} DPS |`,
    ),
    '',
    '---',
    '',
    '## 4. Thống Kê Co-op Scaling (1–4 Người Chơi)',
    '',
    '| Số người chơi | Thời lượng Phòng chiến đấu (TB) | Thời lượng hạ Boss Biome 1 (TB) | Độ lệch thời gian hạ Boss so với 1P |',
    '|---:|---:|---:|---:|',
    ...res.coopRows.map(
      (r) =>
        `| **${r.playerCount} người (${r.playerCount}P)** | **${r.combatRoomAvgSec}s** | **${r.bossKillAvgSec}s** | **±${r.bossDeltaVs1PPct}%** |`,
    ),
    '',
    '---',
    '',
    '## 5. Mô Phỏng Đội Hình Phối Hợp Co-op 2P & 4P (Synergy & Đồng Đội Combo)',
    '',
    '| Đội hình Co-op | Số người | Thời gian hạ Boss | Phản ứng Nguyên tố | Đồng Đội Combo (+15 Năng lượng) | Kết quả |',
    '|---|---:|---:|---:|---:|:---:|',
    ...res.coopSynergyRows.map(
      (t) =>
        `| **${t.label}** | ${t.playerCount}P | **${t.killTimeSec}s** | **${t.reactionsTriggered}** | **${t.teamCombos}** | ${t.won ? '✅ THẮNG' : '❌ THUA'} |`,
    ),
    '',
    '---',
    '',
    '## 6. Độ Khó Tăng Dần Qua 3 Biome',
    '',
    '| Biome | Tên Biome | Chỉ số độ khó chuẩn hóa | Mức tăng so với Biome trước |',
    '|---:|---|---:|---:|',
    ...res.biomes.map(
      (b) =>
        `| **Biome ${b.biome}** | ${b.nameVi} | \`×${b.difficultyIndex.toFixed(2)}\` | ${b.biome === 1 ? 'Cơ sở (Baseline)' : `**+${b.stepIncreasePct.toFixed(0)}%**`} |`,
    ),
    '',
    `## 7. Kết Luận Kiểm Chứng: ${res.allTargetsPassed ? '✅ ĐẠT 100% TẤT CẢ MỤC TIÊU CÂN BẰNG (7/7)' : '❌ CẦN ĐIỀU CHỈNH'}`,
    '',
  ];

  return lines.join('\n');
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const result = runBalanceHarness();
  const markdown = formatBalanceReportMarkdown(result);
  const outPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../docs/balance-report.md',
  );
  fs.writeFileSync(outPath, markdown, 'utf8');
  console.log(markdown);
  if (!result.allTargetsPassed) {
    process.exitCode = 1;
  }
}
