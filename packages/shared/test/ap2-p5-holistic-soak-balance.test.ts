import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { LATE_GAME_SYNERGY_LOADOUTS, measureLateGameSynergyFloor6Boss } from '../../../tools/balance-harness.js';
import { AVERAGE_PLAYER_BOT_PROFILE } from '../../../tools/bot-profile.js';
import {
  ALL_ASHEN_RELIC_IDS, ALL_DUO_BOON_IDS, BIOME1_COMBAT_ENEMIES, BIOME2_COMBAT_ENEMIES, BIOME3_COMBAT_ENEMIES,
  BLESSINGS, INPUT_BUTTON, MAX_DEPLOYABLES_PER_PLAYER, MAX_ENEMY_PROJECTILES, MAX_PLAYER_PROJECTILES,
  MAX_TACTICAL_PROPS_PER_ROOM, NetworkTransport, type PropKind, SIM_STEP_SEC, TILE_SIZE, WEAPONS,
  WEAPON_MUTATORS, WorldSim, decodeWorldSnapshot, encodeWorldSnapshot, findNearestWalkablePoint,
  findSalvageableWeaponNearPlayer, isMutatorCompatibleWithWeapon,
} from '../src/index.js';

function computePercentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function isWalkableWorldPoint(sim: WorldSim, x: number, y: number): boolean {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  if (tx <= 1 || ty <= 1 || tx >= sim.map.cols - 2 || ty >= sim.map.rows - 2) {
    return false;
  }
  return !sim.map.isSolidTile(tx, ty) && sim.map.getSurface(tx, ty) !== 'chasm';
}

describe('AP2 Phase P5.2 — Final Late-Game Synergy Floor 6 Boss Audit & 60Hz 4P 200-Cycle Soak', () => {
  it('1. enforces 3-Bucket Damage Pipeline & >= 45.0s survival on Floor 6 Boss forge_titan across 3 full-synergy late-game loadouts (godMode = false)', () => {
    expect(AVERAGE_PLAYER_BOT_PROFILE.godMode).toBe(false);
    expect(LATE_GAME_SYNERGY_LOADOUTS.length).toBeGreaterThanOrEqual(3);

    const seenChars = new Set<string>();
    const seenPrimaryWeapons = new Set<string>();
    const coveredDuoBoons = new Set<string>();
    const coveredRelics = new Set<string>();

    for (const loadout of LATE_GAME_SYNERGY_LOADOUTS) {
      seenChars.add(loadout.characterId);
      seenPrimaryWeapons.add(loadout.primaryWeaponId);
      expect(WEAPONS[loadout.primaryWeaponId]).toBeDefined();
      expect(WEAPONS[loadout.secondaryWeaponId]).toBeDefined();
      expect(loadout.mutators.length).toBe(2);
      for (const mutId of loadout.mutators) {
        expect(WEAPON_MUTATORS[mutId]).toBeDefined();
        expect(isMutatorCompatibleWithWeapon(mutId, loadout.primaryWeaponId)).toBe(true);
      }
      expect(loadout.blessings.length).toBe(6);
      for (const bId of loadout.blessings) {
        expect(BLESSINGS[bId]).toBeDefined();
      }
      expect(loadout.duoBoons.length).toBe(2);
      for (const dId of loadout.duoBoons) {
        expect(ALL_DUO_BOON_IDS).toContain(dId);
        coveredDuoBoons.add(dId);
      }
      expect(loadout.relics.length).toBe(2);
      for (const rId of loadout.relics) {
        expect(ALL_ASHEN_RELIC_IDS).toContain(rId);
        coveredRelics.add(rId);
      }
    }

    expect(seenChars.size).toBeGreaterThanOrEqual(3);
    expect(seenPrimaryWeapons.size).toBeGreaterThanOrEqual(3);
    expect(coveredDuoBoons.size).toBe(ALL_DUO_BOON_IDS.length);
    expect(coveredRelics.size).toBe(ALL_ASHEN_RELIC_IDS.length);

    const lockedSeeds = AVERAGE_PLAYER_BOT_PROFILE.seeds.slice(0, 8);
    const result = measureLateGameSynergyFloor6Boss(lockedSeeds, 8);
    expect(result.rows.length).toBe(LATE_GAME_SYNERGY_LOADOUTS.length);
    expect(result.simulationsRun).toBe(LATE_GAME_SYNERGY_LOADOUTS.length * 8);

    for (const row of result.rows) {
      expect(row.runs).toBe(8);
      expect(row.godModeAlwaysFalse).toBe(true);
      expect(row.singleHitCapRespected).toBe(true);
      expect(row.maxPlayerHitDamage).toBeLessThanOrEqual(row.bossSingleHitCapDamage);
      expect(row.avgSec).toBeGreaterThanOrEqual(45.0);
      expect(row.avgSec).toBeLessThanOrEqual(125.0);
      expect(row.zeroOneShots).toBe(true);
      expect(row.maxSingleHitFraction).toBeLessThan(0.85);
    }
    expect(result.minAvgSec).toBeGreaterThanOrEqual(45.0);
  }, 180_000);

  it('2. sustains 60Hz 4P Co-op LAN 200-cycle soak (>=200 enterRoom, >=200 Hold-[X] salvages, >=200 Flip+Dash-Kicks) with p95 < 4.5ms, bounded pools & non-monotonic snapshots', () => {
    const sim = new WorldSim({
      seed: 20260502, biome: 1, playerCount: 4, coopMode: true, autoRevivePlayer: false,
      spawnInitialWave: false, includeTrainingDummy: false, includeProps: true, autoRespawnWaves: false,
    });

    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'vanguard');
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Liệp Ưng P2', 2);
    const p3 = sim.addCoopPlayer(3, 'elementalist', 'Lam Hỏa P3', 3);
    const p4 = sim.addCoopPlayer(4, 'engineer', 'Bánh Răng P4', 4);
    const players = [p1, p2, p3, p4];

    // Equip DYNAMIC_BOUNCE weapons + P4A Mutators & Blessings + P4B Duo Boons + Ashen Pacts/Relics
    p1.weaponSlots = ['berserker_axe', 'seed_gun'];
    p2.weaponSlots = ['hunter_crossbow', 'tesla_carbine'];
    p3.weaponSlots = ['tether_staff', 'solar_archon_staff'];
    p4.weaponSlots = ['tesla_carbine', 'magma_cannon'];

    p1.weaponMutators = { 0: ['mutator_shockwave_edge', 'mutator_gravity_singularity'], 1: [] };
    p2.weaponMutators = { 0: ['mutator_prism_splitter', 'mutator_boomerang_core'], 1: [] };
    p3.weaponMutators = { 0: ['mutator_finale_jolt', 'mutator_elemental_infusion'], 1: [] };
    p4.weaponMutators = { 0: ['mutator_holo_decoy_gun', 'mutator_thermal_meltdown'], 1: [] };

    for (const bId of ['table_tech_rocket', 'dash_phase_blade'] as const) sim.applyBuffEffects(bId, p1.id);
    for (const bId of ['bullet_ricochet_boom', 'table_tech_magnet_snare'] as const) sim.applyBuffEffects(bId, p2.id);
    for (const bId of ['bullet_wall_tether', 'holster_elemental_surge'] as const) sim.applyBuffEffects(bId, p3.id);
    for (const bId of ['dash_thunder_decoy', 'table_tech_toxic_shrapnel'] as const) sim.applyBuffEffects(bId, p4.id);

    sim.applyBuffEffects('duo_superheated_cyclone', p1.id);
    sim.applyBuffEffects('duo_superconduct_rail', p2.id);
    sim.applyBuffEffects('duo_plasma_overload_star', p3.id);
    sim.applyBuffEffects('duo_magnetic_bastion_ring', p4.id);

    p1.activePactId = 'pact_ricochet_vow';
    p2.awakenedRelicIds = ['relic_ancient_geometry_eye'];
    p3.activePactId = 'pact_overheat_reactor';
    p4.awakenedRelicIds = ['relic_perpetual_core'];

    for (const pl of players) {
      pl.godMode = false;
      pl.activeWeaponSlot = 0;
      pl.weaponUpgradeLevels = { 0: 2, 1: 1 };
    }

    const clientTransport = new NetworkTransport({
      seed: 20260502, coopMode: true, localPlayerSlot: 2, localPlayerId: p2.id,
      startInHub: false, spawnInitialWave: false, includeTrainingDummy: false,
    });

    const salvageWeaponPool = ['rivet_gun', 'scrap_shotgun', 'tesla_carbine', 'void_staff', 'solar_archon_staff'] as const;
    const approachOffsets = [[-28, 0], [28, 0], [0, -28], [0, 28]] as const;

    const TOTAL_CYCLES = 204;
    const WARMUP_CYCLES = 5;
    let seq = 1;
    let totalRoomTransitions = 0;
    let totalWeaponSalvages = 0;
    let totalCoverFlips = 0;
    let totalDashKicks = 0;
    let godModeAlwaysFalse = true;
    let crossRoomLeakViolations = 0;
    let poolCapViolations = 0;
    let peakSnapshotBytes = 0;
    let maxSnapEventCount = 0;

    const tickDurationsMs: number[] = [];
    const snapshotBytesByCycle = new Map<number, number>();
    let heapAfterWarmupBytes = 0;

    const setInputForPlayer = (
      plId: number,
      moveX: number,
      moveY: number,
      aimAngle: number,
      buttons: number,
    ): void => {
      const pkt = {
        seq: seq++,
        tick: sim.tick + 1,
        moveX,
        moveY,
        aimAngle,
        buttons,
        weaponSlotSelect: null,
      };
      if (plId === p1.id) {
        sim.setPlayerInput(pkt);
      } else {
        sim.setCoopPlayerInput(plId, pkt);
      }
    };

    const stepAndAuditTick = (cycleIdx: number) => {
      for (const pl of players) {
        if (pl.godMode !== false) godModeAlwaysFalse = false;
      }
      const t0 = performance.now();
      sim.step(SIM_STEP_SEC);
      const elapsedMs = performance.now() - t0;
      if (cycleIdx >= WARMUP_CYCLES) {
        tickDurationsMs.push(elapsedMs);
      }

      let playerProjectiles = 0;
      let enemyProjectiles = 0;
      for (let i = 0; i < sim.projectiles.length; i++) {
        if (sim.projectiles[i]!.team === 'enemy') enemyProjectiles += 1;
        else playerProjectiles += 1;
      }
      if (
        playerProjectiles > MAX_PLAYER_PROJECTILES ||
        enemyProjectiles > MAX_ENEMY_PROJECTILES ||
        sim.props.length > MAX_TACTICAL_PROPS_PER_ROOM
      ) {
        poolCapViolations += 1;
      }
      for (const pl of players) {
        if (pl.godMode !== false) godModeAlwaysFalse = false;
        const ownedDeployables =
          sim.summons.filter((s) => s.ownerPlayerId === pl.id).length +
          sim.magneticRivets.filter((r) => r.ownerPlayerId === pl.id).length;
        if (ownedDeployables > MAX_DEPLOYABLES_PER_PLAYER) {
          poolCapViolations += 1;
        }
      }
      return sim.drainEvents();
    };

    const auditSnapshotRoundTrip = (cycleIdx: number, events: ReturnType<WorldSim['drainEvents']>): number => {
      const snap = encodeWorldSnapshot(sim, events, false, Math.round(sim.tick * (1000 / 60)));
      if (snap.events.length > maxSnapEventCount) {
        maxSnapEventCount = snap.events.length;
      }
      if (snap.events.length > 64) {
        crossRoomLeakViolations += 1;
      }
      const json = JSON.stringify(snap);
      const bytes = Buffer.byteLength(json, 'utf8');
      if (bytes > peakSnapshotBytes) {
        peakSnapshotBytes = bytes;
      }
      const decoded = decodeWorldSnapshot(json);
      expect(decoded.tick).toBe(sim.tick);
      expect(decoded.players.length).toBe(4);
      clientTransport.receiveSnapshot(decoded);
      snapshotBytesByCycle.set(cycleIdx + 1, bytes);
      return bytes;
    };

    for (let c = 0; c < TOTAL_CYCLES; c++) {
      if (c > 0 && c % 12 === 0) {
        const nextFloor = ((Math.floor(c / 12)) % 6) + 1;
        sim.advanceToFloor(nextFloor);
      }

      const candidateRooms = sim.dungeon.rooms.filter(
        (r) =>
          r.id !== sim.currentRoomId &&
          (r.type === 'combat' || r.type === 'elite' || r.type === 'treasure' || r.type === 'secret'),
      );
      const fallbackRooms = sim.dungeon.rooms.filter((r) => r.id !== sim.currentRoomId);
      const roomPool = candidateRooms.length > 0 ? candidateRooms : fallbackRooms;
      const nextRoom = roomPool[c % roomPool.length] ?? sim.dungeon.rooms[0]!;
      sim.enterRoom(nextRoom.id);
      totalRoomTransitions += 1;

      // Verify enterRoom cleanly flushed cross-room transient combat arrays
      if (
        sim.projectiles.length !== 0 ||
        sim.magneticRivets.length !== 0 ||
        sim.tetherBeams.length !== 0 ||
        sim.summons.length !== 0 ||
        sim.skillZones.length !== 0 ||
        sim.props.length > MAX_TACTICAL_PROPS_PER_ROOM ||
        sim.worldItems.length > 16
      ) {
        crossRoomLeakViolations += 1;
      }

      // Restore alive combat readiness between rooms while strictly keeping godMode = false
      sim.runState = 'playing';
      for (const pl of players) {
        pl.godMode = false;
        pl.lifeState = 'alive';
        pl.hp = pl.maxHp;
        pl.armor = pl.maxArmor;
        pl.encasedInIceTimer = 0;
        pl.salvageHoldTimer = 0;
        pl.salvageTargetItemId = 0;
      }
      sim.drainEvents();

      // Ensure active biome enemies exist for 4P 60Hz combat
      if (sim.enemies.filter((e) => !e.isDummy && e.hp > 0).length < 3) {
        const enemyPool =
          sim.currentBiome === 2
            ? BIOME2_COMBAT_ENEMIES
            : sim.currentBiome === 3
              ? BIOME3_COMBAT_ENEMIES
              : BIOME1_COMBAT_ENEMIES;
        for (let i = 0; i < 4; i++) {
          const defId = enemyPool[(c + i) % enemyPool.length]!;
          const spawnPt = findNearestWalkablePoint(
            sim.map,
            sim.map.width * 0.65 + (i - 1.5) * 44,
            sim.map.height * 0.5 + ((i % 2) * 2 - 1) * 38,
            18,
          );
          sim.spawnEnemy(defId, spawnPt.x, spawnPt.y, true);
        }
      }

      // Spawn a clean upright biome barricade at walkable arena center for [E] Flip + Dash-Kick
      const barKind: PropKind =
        sim.currentBiome === 2
          ? 'glacial_barricade'
          : sim.currentBiome === 3
            ? 'forge_blast_shield'
            : 'moss_table';
      const centerPt = findNearestWalkablePoint(
        sim.map,
        sim.map.width * 0.46,
        sim.map.height * 0.5,
        36,
      );
      for (let i = sim.props.length - 1; i >= 0; i--) {
        const pr = sim.props[i]!;
        if (Math.hypot(pr.x - centerPt.x, pr.y - centerPt.y) < 64) {
          sim.props.splice(i, 1);
        }
      }
      const bar = sim.spawnProp(barKind, centerPt.x, centerPt.y);
      let standX = bar.x - 28;
      let standY = bar.y;
      for (const [ox, oy] of approachOffsets) {
        if (isWalkableWorldPoint(sim, bar.x + ox, bar.y + oy)) {
          standX = bar.x + ox;
          standY = bar.y + oy;
          break;
        }
      }
      const aimToBar = Math.atan2(bar.y - standY, bar.x - standX);
      const kicker = players[c % players.length]!;

      // Phase A (14 ticks): Tick 0 primes edge state; Tick 1 presses [E] Flip; Tick 2 presses [Shift] Dash-Kick; Ticks 3..13 run 4P combat
      for (let t = 0; t < 14; t++) {
        if (t <= 2) {
          kicker.x = standX;
          kicker.y = standY;
          kicker.kbVx = 0;
          kicker.kbVy = 0;
          if (t === 2) {
            kicker.dashCooldownTimer = 0;
            kicker.dashTimer = 0;
          }
        }
        const foe = sim.enemies.find((e) => !e.isDummy && e.hp > 0);
        for (let idx = 0; idx < players.length; idx++) {
          const pl = players[idx]!;
          if (pl.id === kicker.id && t === 0) {
            setInputForPlayer(pl.id, 0, 0, aimToBar, INPUT_BUTTON.FIRE);
          } else if (pl.id === kicker.id && t === 1) {
            setInputForPlayer(pl.id, 0, 0, aimToBar, INPUT_BUTTON.INTERACT | INPUT_BUTTON.FIRE);
          } else if (pl.id === kicker.id && t === 2) {
            setInputForPlayer(
              pl.id,
              Math.cos(aimToBar),
              Math.sin(aimToBar),
              aimToBar,
              INPUT_BUTTON.DASH | INPUT_BUTTON.FIRE,
            );
          } else {
            const ang = foe
              ? Math.atan2(foe.y - pl.y, foe.x - pl.x)
              : ((sim.tick + idx * 17) * 0.09) % (Math.PI * 2);
            const strafe = ang + (idx % 2 === 0 ? 1 : -1) * Math.PI * 0.5;
            let btns = INPUT_BUTTON.FIRE;
            if (pl.skillCooldownTimer <= 0 && pl.skillActiveTimer <= 0) {
              btns |= INPUT_BUTTON.SKILL;
            }
            if (t === 8 && pl.reloadTimer > 0 && !pl.reloadLockout) {
              btns |= INPUT_BUTTON.RELOAD_VENT;
            }
            setInputForPlayer(pl.id, Math.cos(strafe), Math.sin(strafe), ang, btns);
          }
        }

        const evs = stepAndAuditTick(c);
        for (let i = 0; i < evs.length; i++) {
          const ev = evs[i]!;
          if (ev.kind === 'cover_flipped') totalCoverFlips += 1;
          else if (ev.kind === 'prop_kicked') totalDashKicks += 1;
        }
        if (t === 9) {
          auditSnapshotRoundTrip(c, evs);
        }
      }

      // Phase B (31 ticks): Clear room enemies -> spawn ground weapon -> Hold [X] (DROP_WEAPON) for >= 0.50s (30 ticks) to salvage
      for (let i = 0; i < sim.enemies.length; i++) {
        if (!sim.enemies[i]!.isDummy) sim.enemies[i]!.hp = 0;
      }
      const salvager = players[(c + 1) % players.length]!;
      salvager.lifeState = 'alive';
      salvager.hp = Math.max(1, salvager.hp);
      const salvagePos = findNearestWalkablePoint(sim.map, salvager.x, salvager.y, 20);
      salvager.x = salvagePos.x;
      salvager.y = salvagePos.y;
      salvager.kbVx = 0;
      salvager.kbVy = 0;
      salvager.dashTimer = 0;
      salvager.salvageHoldTimer = 0;
      salvager.salvageTargetItemId = 0;

      const wepId = salvageWeaponPool[c % salvageWeaponPool.length]!;
      const wepDef = WEAPONS[wepId]!;
      const dropItem = sim.spawnWorldItem({
        kind: 'weapon',
        weaponId: wepDef.id,
        rarity: wepDef.rarity,
        nameVi: wepDef.nameVi,
        costGold: 0,
        healAmount: 0,
        x: salvager.x + 12,
        y: salvager.y,
      });
      expect(findSalvageableWeaponNearPlayer(sim, salvager, 48)?.id).toBe(dropItem.id);

      let lastCycleEvents: ReturnType<WorldSim['drainEvents']> = [];
      for (let t = 0; t < 31; t++) {
        for (let idx = 0; idx < players.length; idx++) {
          const pl = players[idx]!;
          if (pl.id === salvager.id) {
            setInputForPlayer(pl.id, 0, 0, 0, INPUT_BUTTON.DROP_WEAPON);
          } else {
            setInputForPlayer(pl.id, 0, 0, idx * 0.7, 0);
          }
        }
        const evs = stepAndAuditTick(c);
        for (let i = 0; i < evs.length; i++) {
          if (evs[i]!.kind === 'weapon_salvaged') {
            totalWeaponSalvages += 1;
          }
        }
        lastCycleEvents = evs;
      }

      auditSnapshotRoundTrip(c, lastCycleEvents);

      if (c === WARMUP_CYCLES) {
        (globalThis as { gc?: () => void }).gc?.();
        heapAfterWarmupBytes = process.memoryUsage().heapUsed;
      }
    }

    (globalThis as { gc?: () => void }).gc?.();
    const heapEndBytes = process.memoryUsage().heapUsed;
    const heapDeltaBytes = Math.max(0, heapEndBytes - heapAfterWarmupBytes);
    const p95TickMs = computePercentile(tickDurationsMs, 95);

    let earlyBytesSum = 0;
    let earlyCount = 0;
    for (let cyc = 21; cyc <= 40; cyc++) {
      earlyBytesSum += snapshotBytesByCycle.get(cyc) ?? 0;
      earlyCount += 1;
    }
    let lateBytesSum = 0;
    let lateCount = 0;
    for (let cyc = 181; cyc <= 200; cyc++) {
      lateBytesSum += snapshotBytesByCycle.get(cyc) ?? 0;
      lateCount += 1;
    }
    const earlyAvgBytes = earlyBytesSum / Math.max(1, earlyCount);
    const lateAvgBytes = lateBytesSum / Math.max(1, lateCount);
    console.info(
      `[P5.2 200-Cycle 4P Soak] rooms=${totalRoomTransitions} salvages=${totalWeaponSalvages} flips=${totalCoverFlips} kicks=${totalDashKicks} p95=${p95TickMs.toFixed(3)}ms peakSnap=${peakSnapshotBytes}B earlyAvg=${Math.round(earlyAvgBytes)}B lateAvg=${Math.round(lateAvgBytes)}B heapDelta=${(heapDeltaBytes / (1024 * 1024)).toFixed(2)}MB`,
    );

    expect(godModeAlwaysFalse).toBe(true);
    expect(totalRoomTransitions).toBeGreaterThanOrEqual(200);
    expect(totalWeaponSalvages).toBeGreaterThanOrEqual(200);
    expect(totalCoverFlips).toBeGreaterThanOrEqual(200);
    expect(totalDashKicks).toBeGreaterThanOrEqual(200);
    expect(p95TickMs).toBeLessThan(4.5);
    expect(poolCapViolations).toBe(0);
    expect(crossRoomLeakViolations).toBe(0);
    expect(maxSnapEventCount).toBeLessThanOrEqual(64);
    expect(peakSnapshotBytes).toBeLessThanOrEqual(32_768);
    expect(lateAvgBytes).toBeLessThanOrEqual(earlyAvgBytes * 1.2);
    expect(heapDeltaBytes).toBeLessThan(48 * 1024 * 1024);
  }, 120_000);
});
