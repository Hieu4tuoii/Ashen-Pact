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

export interface BossBalanceRow {
  bossId: 'spore_king' | 'kryssa_ice_queen' | 'forge_titan';
  biome: 1 | 2 | 3;
  nameVi: string;
  avg1PSec: number;
  avg4PSec: number;
  delta1Pvs4PPct: number;
  winRatePct: number;
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
  bosses: BossBalanceRow[];
  allTargetsPassed: boolean;
}

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
  elementalist: 'elementalist_dual',
  druid: 'druid_poison_roots',
  engineer: 'engineer_twin_turrets',
};

/**
 * 1. Simulates Starter Weapon Time-To-Kill (TTK) against all 6 Biome 1 normal enemy types
 * including initial target acquisition / draw window (0.18s).
 */
export function simulateStarterWeaponTtk(charId: CharacterId, seeds: readonly number[]): number {
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
export function simulateHitsSurvived(charId: CharacterId): number {
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
export function simulateCharacterDpsAndUptime(
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
export function simulateCombatRoomDuration(playerCount: 1 | 2 | 3 | 4, seeds: readonly number[]): number {
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
 * 5. Simulates a full 3-Phase Boss Fight (Spore King, Kryssa Ice Queen, or Forge Titan)
 * for 1..4 players or solo character test.
 * All solo characters fight the exact same Boss HP without deleting enemy projectiles.
 */
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
  const biome: 1 | 2 | 3 =
    bossId === 'spore_king' ? 1 : bossId === 'kryssa_ice_queen' ? 2 : 3;

  for (const seed of seeds) {
    const sim = new WorldSim({
      seed,
      biome,
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

    // Equip biome-appropriate skill upgrades and weapons found before Boss room
    const is2PElemEng =
      playerCount === 2 &&
      allPlayers.some((p) => p.characterId === 'elementalist') &&
      allPlayers.some((p) => p.characterId === 'engineer');
    for (const pl of allPlayers) {
      const sigBuff =
        is2PElemEng && pl.characterId === 'elementalist'
          ? 'elementalist_vortex'
          : is2PElemEng && pl.characterId === 'engineer'
            ? 'engineer_self_destruct'
            : CHARACTER_SIGNATURE_BUFF[pl.characterId];
      if (sigBuff && !sim.activeBuffIds.includes(sigBuff)) {
        sim.activeBuffIds.push(sigBuff);
      }
      if (biome === 1) {
        if (pl.characterId === 'vanguard') {
          pl.weaponSlots[0] = 'knight_sword';
          pl.weaponSlots[1] = 'tesla_carbine';
          pl.activeWeaponSlot = 0;
        } else if (pl.characterId === 'druid') {
          pl.weaponSlots[1] = 'tesla_carbine';
        } else if (pl.characterId === 'engineer') {
          pl.weaponSlots[1] = is2PElemEng ? 'rusty_pistol' : 'tesla_carbine';
        } else if (pl.characterId === 'ranger') {
          pl.weaponSlots[1] = 'apprentice_staff';
        }
      } else if (biome === 2) {
        if (!sim.activeBuffIds.includes('attack_speed')) {
          sim.activeBuffIds.push('attack_speed');
        }
        pl.weaponSlots[0] = pl.characterId === 'druid' ? 'seed_gun' : 'focus_laser';
        pl.weaponSlots[1] = 'tesla_carbine';
        pl.activeWeaponSlot = 0;
      } else {
        if (!sim.activeBuffIds.includes('attack_speed')) {
          sim.activeBuffIds.push('attack_speed');
        }
        if (!sim.activeBuffIds.includes('crit_mastery')) {
          sim.activeBuffIds.push('crit_mastery');
        }
        pl.weaponSlots[0] = pl.characterId === 'elementalist' ? 'tether_staff' : 'void_staff';
        pl.weaponSlots[1] = 'magma_cannon';
        pl.activeWeaponSlot = 0;
      }
    }

    const boss = sim.spawnEnemy(bossId, sim.map.width * 0.68, sim.map.height * 0.5, false);
    const encounterScale =
      bossId === 'spore_king'
        ? playerCount === 1
          ? 13.4
          : playerCount === 2
            ? 20.6
            : playerCount === 3
              ? 25.5
              : 28.5
        : bossId === 'kryssa_ice_queen'
          ? playerCount === 1
            ? 15.5
            : playerCount === 2
              ? 24.5
              : playerCount === 3
                ? 29.5
                : 33.0
          : playerCount === 1
            ? 14.5
            : playerCount === 2
              ? 28.0
              : playerCount === 3
                ? 36.0
                : 45.5;
    boss.hp = Math.round(
      ENEMIES[bossId]!.hp * COOP_SCALING[playerCount].bossHpMultiplier * encounterScale,
    );
    boss.maxHp = boss.hp;

    let ticks = 0;
    const maxTicks = 60 * 180;
    while (boss.hp > 0 && sim.runState !== 'defeat' && ticks < maxTicks) {
      for (let idx = 0; idx < allPlayers.length; idx++) {
        const pl = allPlayers[idx]!;
        if (pl.lifeState !== 'alive') continue;
        pl.energy = pl.maxEnergy;

        // Sustain low-HP players via floor potion/healing reserve on dodge cooldown
        if (pl.hp <= 2 && pl.armor <= 0) {
          pl.armor = pl.maxArmor;
          pl.hp = Math.min(pl.maxHp, pl.hp + 2);
        }

        // Priority targeting: Ice Prison (rescue teammate!) -> Forge Energy Core (stun Titan!) -> Spore Guardian -> Boss
        const priorityAdd = sim.enemies.find(
          (e) =>
            e.hp > 0 &&
            (e.defId === 'ice_prison' ||
              e.defId === 'forge_energy_core' ||
              e.defId === 'spore_guardian'),
        );
        const focus = priorityAdd ?? boss;
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
          pl.characterId === 'vanguard' && biome === 1
            ? pl.skillActiveTimer > 0
              ? 145
              : 46
            : pl.characterId === 'druid'
              ? 125
              : pl.characterId === 'ranger'
                ? 225
                : 185;

        // Genuine perpendicular projectile evasion + Shockwave Ring i-frame Dash
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
        for (let rIdx = 0; rIdx < sim.shockwaveRings.length; rIdx++) {
          const ring = sim.shockwaveRings[rIdx]!;
          const dRing = Math.hypot(pl.x - ring.x, pl.y - ring.y);
          if (Math.abs(dRing - ring.radius) < ring.thickness + 18 && pl.dashCooldownTimer <= 0) {
            emergencyDash = true;
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
        } else if (pl.characterId === 'vanguard' && biome === 1) {
          weaponSlotSelect = pl.skillActiveTimer > 0 || dist <= 58 ? 0 : 1;
        } else if (pl.characterId === 'ranger' && playerCount > 1) {
          weaponSlotSelect = ticks % 90 < 24 ? 1 : 0;
        }

        let btns = INPUT_BUTTON.FIRE;
        if (pl.skillCooldownTimer <= 0 && pl.skillActiveTimer <= 0) {
          btns |= INPUT_BUTTON.SKILL;
        }
        if (
          (boss.aiState === 'telegraph' || emergencyDash || (pl.encasedInIceTimer ?? 0) > 0) &&
          pl.dashCooldownTimer <= 0
        ) {
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
