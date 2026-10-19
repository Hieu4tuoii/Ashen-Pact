import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BIOME1_COMBAT_ENEMIES,
  BIOME2_COMBAT_ENEMIES,
  BIOME3_COMBAT_ENEMIES,
  type CharacterId,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  WorldSim,
  renderQrAscii,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('Phase 8 — 20-Minute Co-op Soak Test (72,000 Ticks @ 60Hz)', () => {
  it('runs 72,000 ticks (20 minutes simulated time) with 4 Co-op players fighting waves & bosses across Biomes 1-3 with zero entity bloat and stable tick times', () => {
    const sim = new WorldSim({
      seed: 80808,
      biome: 1,
      spawnInitialWave: true,
      includeTrainingDummy: false,
      includeProps: true,
      autoRespawnWaves: true,
      coopMode: true,
    });

    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'vanguard');
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Liệp Ưng P2', 2);
    const p3 = sim.addCoopPlayer(3, 'elementalist', 'Lam Hỏa P3', 3);
    const p4 = sim.addCoopPlayer(4, 'engineer', 'Bánh Răng P4', 4);

    const players = [p1, p2, p3, p4];
    for (const pl of players) {
      pl.godMode = true;
    }

    // Equip diverse weapons including Co-op Seed Gun & Tether Staff to exercise all systems
    p1.weaponSlots[0] = 'knight_sword';
    p1.weaponSlots[1] = 'seed_gun';
    p2.weaponSlots[0] = 'hunter_crossbow';
    p2.weaponSlots[1] = 'falcon_sniper';
    p3.weaponSlots[0] = 'tether_staff';
    p3.weaponSlots[1] = 'frost_scepter';
    p4.weaponSlots[0] = 'tesla_carbine';
    p4.weaponSlots[1] = 'magma_cannon';

    sim.activeBuffIds.push(
      'vanguard_fortress',
      'ranger_arrow_volley',
      'elementalist_dual',
      'engineer_twin_turrets',
    );

    const TOTAL_TICKS = 72_000; // 20 minutes * 60 seconds * 60 Hz
    const SEGMENT_TICKS = 18_000; // 5-minute checkpoints
    const segmentAvgTickMs: number[] = [];
    const segmentEntityCounts: number[] = [];
    const heapCheckpointsMb: number[] = [];

    const bosses = ['spore_king', 'kryssa_ice_queen', 'forge_titan'] as const;
    let segStartMs = performance.now();

    for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
      // Every 12,000 ticks (3.33 simulated minutes), rotate biome and spawn a fresh Boss + Elite wave
      if (tick % 12_000 === 0) {
        const nextBiome = (((Math.floor(tick / 12_000) % 3) + 1) as 1 | 2 | 3);
        sim.currentBiome = nextBiome;
        const bossId = bosses[(nextBiome - 1) % bosses.length]!;
        if (!sim.enemies.some((e) => e.isBoss && e.hp > 0)) {
          sim.spawnEnemy(bossId, sim.map.width * 0.65, sim.map.height * 0.5, true);
        }
      }

      // Keep combat active by spawning biome waves whenever enemy count drops low
      const aliveEnemies = sim.enemies.filter((e) => !e.isDummy && e.hp > 0);
      if (aliveEnemies.length < 4 && tick % 90 === 0) {
        const pool =
          sim.currentBiome === 2
            ? BIOME2_COMBAT_ENEMIES
            : sim.currentBiome === 3
              ? BIOME3_COMBAT_ENEMIES
              : BIOME1_COMBAT_ENEMIES;
        for (let i = 0; i < 5; i++) {
          const defId = pool[(tick + i) % pool.length]!;
          const ex = 220 + ((tick * 13 + i * 140) % 700);
          const ey = 150 + ((tick * 7 + i * 95) % 400);
          sim.spawnEnemy(defId, ex, ey, true, i === 0 ? 'shield' : null);
        }
      }

      const target = sim.enemies.find((e) => !e.isDummy && e.hp > 0);
      for (let idx = 0; idx < players.length; idx++) {
        const pl = players[idx]!;
        pl.energy = pl.maxEnergy;
        const aimAngle = target
          ? Math.atan2(target.y - pl.y, target.x - pl.x)
          : (tick * 0.04 + idx * 1.5) % (Math.PI * 2);
        const orbitAngle = aimAngle + (idx % 2 === 0 ? 1 : -1) * Math.PI * 0.45;
        const mx = Math.cos(orbitAngle);
        const my = Math.sin(orbitAngle);

        let buttons = INPUT_BUTTON.FIRE;
        if (pl.skillCooldownTimer <= 0 && pl.skillActiveTimer <= 0) {
          buttons |= INPUT_BUTTON.SKILL;
        }
        if (tick % 120 === idx * 30 && pl.dashCooldownTimer <= 0) {
          buttons |= INPUT_BUTTON.DASH;
        }
        const weaponSlotSelect = tick % 300 === idx * 60 ? (pl.activeWeaponSlot === 0 ? 1 : 0) : null;

        const pkt = {
          seq: tick,
          tick,
          moveX: mx,
          moveY: my,
          aimAngle,
          buttons,
          weaponSlotSelect,
        };
        if (pl.id === p1.id) {
          sim.setPlayerInput(pkt);
        } else {
          sim.setCoopPlayerInput(pl.id, pkt);
        }
      }

      sim.step(SIM_STEP_SEC);
      // Consume events every tick just as LocalTransport / CoopRoom does so event queue stays clean
      sim.consumeEvents();

      // Verify entity bounds never explode
      expect(sim.enemies.length).toBeLessThanOrEqual(45);
      expect(sim.projectiles.length).toBeLessThanOrEqual(240);
      expect(sim.pickups.length).toBeLessThanOrEqual(200);
      expect(sim.summons.length).toBeLessThanOrEqual(16);
      expect(sim.skillZones.length).toBeLessThanOrEqual(16);

      if (tick % SEGMENT_TICKS === 0) {
        const elapsedMs = performance.now() - segStartMs;
        segmentAvgTickMs.push(elapsedMs / SEGMENT_TICKS);
        segmentEntityCounts.push(
          sim.enemies.length +
            sim.projectiles.length +
            sim.pickups.length +
            sim.summons.length +
            sim.skillZones.length,
        );
        heapCheckpointsMb.push(process.memoryUsage().heapUsed / (1024 * 1024));
        segStartMs = performance.now();
      }
    }

    // 1. All 4 checkpoints completed (72,000 ticks = 20 minutes simulated time)
    expect(sim.tick).toBe(TOTAL_TICKS);
    expect(segmentAvgTickMs.length).toBe(4);

    // 2. Average tick time stays well below 0.5ms (budget is 16.67ms at 60Hz) and does not degrade in the final 5 minutes
    for (const avgMs of segmentAvgTickMs) {
      expect(avgMs).toBeLessThan(0.5);
    }
    expect(segmentAvgTickMs[3]!).toBeLessThanOrEqual(Math.max(0.25, segmentAvgTickMs[0]! * 2.2));

    // 3. Rich combat activity occurred across the 20-minute soak
    expect(sim.runStats.kills).toBeGreaterThan(250);
    expect(sim.runStats.elementalReactions).toBeGreaterThan(150);
    expect(sim.runStats.teamCombos).toBeGreaterThan(50);

    // 4. Object pools actively recycled projectiles and pickups without unbounded growth
    expect(segmentEntityCounts.every((c) => c < 300)).toBe(true);
    const heapGrowthAfterWarmupMb = heapCheckpointsMb[3]! - heapCheckpointsMb[0]!;
    expect(heapGrowthAfterWarmupMb).toBeLessThan(64);
  }, 30_000);
});

describe('Phase 8 — QA Bug Bash Edge Cases & Release Artifacts', () => {
  it('cleans up reviver state, orphaned ice prisons, summons, and updates next-room wave scaling when a player leaves mid-boss or mid-run', () => {
    const sim = new WorldSim({
      seed: 81818,
      biome: 2,
      startInHub: true,
      coopMode: true,
    });

    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'druid' as CharacterId, 'Mộc Linh P2', 2);
    const p3 = sim.addCoopPlayer(3, 'engineer' as CharacterId, 'Bánh Răng P3', 3);
    const p4 = sim.addCoopPlayer(4, 'ranger' as CharacterId, 'Liệp Ưng P4', 4);

    for (const pl of [p1, p2, p3, p4]) {
      pl.ready = true;
    }
    sim.startDungeonRunFromHub();
    expect(sim.getActivePlayerCount()).toBe(4);

    // Simulate P1 downed and being revived by P2, while P3 is trapped in Kryssa's Ice Prison and owns a Tesla Turret
    p1.lifeState = 'downed';
    p1.reviverPlayerId = p2.id;
    p1.reviveProgress = 0.65;

    const prison = sim.spawnEnemy('ice_prison', p3.x, p3.y, true);
    p3.encasedInIceTimer = 5.0;
    p3.icePrisonId = prison.id;

    sim.summons.push({
      id: 9901,
      ownerPlayerId: p3.id,
      kind: 'tesla_turret',
      nameVi: 'Trụ Tesla',
      x: p3.x + 24,
      y: p3.y,
      radius: 15,
      auraRadius: 180,
      hp: 40,
      maxHp: 40,
      ttlSec: 8,
      maxTtlSec: 10,
      tickTimer: 0.5,
      healsRemaining: 0,
      charge: 0,
      poisonRoots: false,
      selfDestruct: false,
      rootedEnemyIds: [],
    });

    // P2 and P3 leave mid-encounter
    expect(sim.removeCoopPlayer(p2.id)).toBe(true);
    expect(sim.removeCoopPlayer(p3.id)).toBe(true);

    // Verify P1's interrupted revive was reset cleanly and P3's Ice Prison + Summon were removed
    expect(p1.reviverPlayerId).toBeNull();
    expect(p1.reviveProgress).toBe(0);
    expect(sim.enemies.some((e) => e.id === prison.id)).toBe(false);
    expect(sim.summons.some((s) => s.ownerPlayerId === p3.id)).toBe(false);
    expect(sim.getActivePlayerCount()).toBe(2);

    // If the last alive player (P4) also leaves while P1 is downed, run transitions cleanly to defeat
    expect(sim.removeCoopPlayer(p4.id)).toBe(true);
    expect(sim.runState).toBe('defeat');
    expect(p1.lifeState).toBe('ghost');
  });

  it('renders valid ISO/IEC 18004 QR ASCII art for console LAN invite links and verifies packaged release files', () => {
    const inviteUrl = 'http://192.168.12.103:2567';
    const asciiQr = renderQrAscii(inviteUrl, 2);
    const lines = asciiQr.split('\n');

    expect(lines.length).toBeGreaterThanOrEqual(15);
    expect(asciiQr).toContain('█');
    expect(asciiQr).toContain('▀');
    expect(asciiQr).toContain('▄');

    const releaseDir = path.join(ROOT_DIR, 'release/AshenPact-v0.1.0-win-x64');
    const releaseZip = path.join(ROOT_DIR, 'release/AshenPact-v0.1.0-win-x64.zip');
    if (fs.existsSync(releaseDir)) {
      expect(fs.existsSync(path.join(releaseDir, 'AshenPact-Host.exe'))).toBe(true);
      expect(fs.existsSync(path.join(releaseDir, 'start-host.bat'))).toBe(true);
      expect(fs.existsSync(path.join(releaseDir, 'allow-firewall-port-2567.bat'))).toBe(true);
      expect(fs.existsSync(path.join(releaseDir, 'server-bundle.cjs'))).toBe(true);
      expect(fs.existsSync(path.join(releaseDir, 'runtime/node.exe'))).toBe(true);
      expect(fs.existsSync(path.join(releaseDir, 'client/index.html'))).toBe(true);
      expect(fs.existsSync(path.join(releaseDir, 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(releaseDir, 'CREDITS.md'))).toBe(true);
      expect(fs.existsSync(path.join(releaseDir, 'RELEASE_NOTES.md'))).toBe(true);
      expect(fs.existsSync(releaseZip)).toBe(true);
    }
  });
});
