import { describe, expect, it } from 'vitest';
import {
  AVERAGE_PLAYER_BOT_PROFILE,
  createBotBrainState,
  stepHonestPlayerBot,
} from '../../../tools/bot-profile.js';
import {
  INPUT_BUTTON,
  SIM_STEP_SEC,
  WorldSim,
  activateBossArmorShell,
  populateTreasureForgeWorkshop,
} from '../src/index.js';

describe('AP2 Phase P3C.1 — Human-Like Bot Profile & Tactical / Out-of-Combat AI', () => {
  it('(a) locks AVERAGE_PLAYER_BOT_PROFILE with perfectReloadSuccessRate=0.5, tacticalCoverKickProbability=0.4, bossArmorBreakWindowSec=[3.0, 6.0], and godMode=false', () => {
    expect(Object.isFrozen(AVERAGE_PLAYER_BOT_PROFILE)).toBe(true);
    expect(AVERAGE_PLAYER_BOT_PROFILE.aimAccuracy).toBe(0.7);
    expect(AVERAGE_PLAYER_BOT_PROFILE.reactionDelaySec).toBe(0.25);
    expect(AVERAGE_PLAYER_BOT_PROFILE.dashDodgeProbability).toBe(0.65);
    expect(AVERAGE_PLAYER_BOT_PROFILE.perfectReloadSuccessRate).toBe(0.5);
    expect(AVERAGE_PLAYER_BOT_PROFILE.tacticalCoverKickProbability).toBe(0.4);
    expect(AVERAGE_PLAYER_BOT_PROFILE.bossArmorBreakWindowSec).toEqual([3.0, 6.0]);
    expect(Object.isFrozen(AVERAGE_PLAYER_BOT_PROFILE.bossArmorBreakWindowSec)).toBe(true);
    expect(AVERAGE_PLAYER_BOT_PROFILE.godMode).toBe(false);
  });

  it('(b) rolls once per reload/vent cycle and achieves a Perfect Reload / Tactical Vent [R] success rate in [0.35, 0.65] across >= 40 cycles', () => {
    // 1. Test CLIP_RELOAD across >= 50 reload cycles
    const simClip = new WorldSim({
      seed: 3101,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    simClip.selectCharacter(simClip.player.id, 'ranger');
    const pClip = simClip.player;
    pClip.godMode = false;
    pClip.x = 320;
    pClip.y = 320;
    pClip.weaponSlots = ['hunter_crossbow'];
    simClip.equipWeaponSlot(0);

    const targetClip = simClip.spawnEnemy('spore_king', 520, 320, true);
    targetClip.hp = 999999;
    targetClip.maxHp = 999999;
    targetClip.isDummy = false;

    const brainClip = createBotBrainState(pClip.id, 3101);
    let reloadCycles = 0;
    let perfectReloadCount = 0;
    let wasReloading = false;
    let lastReloadTimer = 0;

    for (let t = 1; t <= 6500 && reloadCycles < 50; t++) {
      targetClip.x = 520;
      targetClip.y = 320;
      targetClip.vx = 0;
      targetClip.vy = 0;
      targetClip.aiState = 'idle';
      targetClip.stateTimer = 99;
      targetClip.attackCooldownTimer = 99;

      const pkt = stepHonestPlayerBot(
        simClip,
        pClip,
        brainClip,
        AVERAGE_PLAYER_BOT_PROFILE,
        SIM_STEP_SEC,
        t,
      );
      simClip.setPlayerInput(pkt);
      simClip.step(SIM_STEP_SEC);

      const evs = simClip.consumeEvents();
      const prThisTick = evs.some((e) => e.kind === 'perfect_reload' && e.playerId === pClip.id);
      if (prThisTick) {
        perfectReloadCount += 1;
      }

      if (pClip.reloadTimer > 0) {
        if (!wasReloading || pClip.reloadTimer > lastReloadTimer + 1e-4) {
          reloadCycles += 1;
        }
        wasReloading = true;
        lastReloadTimer = pClip.reloadTimer;
      } else {
        if (prThisTick && !wasReloading) {
          reloadCycles += 1;
        }
        wasReloading = false;
        lastReloadTimer = 0;
      }
    }

    expect(reloadCycles).toBeGreaterThanOrEqual(40);
    const clipSuccessRate = perfectReloadCount / reloadCycles;
    expect(clipSuccessRate).toBeGreaterThanOrEqual(0.35);
    expect(clipSuccessRate).toBeLessThanOrEqual(0.65);

    // 2. Test HEAT_VENT across >= 40 orange-zone heat cycles
    const simHeat = new WorldSim({
      seed: 3102,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    simHeat.selectCharacter(simHeat.player.id, 'elementalist');
    const pHeat = simHeat.player;
    pHeat.godMode = false;
    pHeat.x = 320;
    pHeat.y = 320;
    pHeat.weaponSlots = ['apprentice_staff'];
    simHeat.equipWeaponSlot(0);

    const targetHeat = simHeat.spawnEnemy('spore_king', 520, 320, true);
    targetHeat.hp = 999999;
    targetHeat.maxHp = 999999;
    targetHeat.isDummy = false;

    const brainHeat = createBotBrainState(pHeat.id, 3102);
    let heatCycles = 0;
    let tacticalVentCount = 0;
    let wasInOrangeZone = false;

    for (let t = 1; t <= 9000 && heatCycles < 45; t++) {
      targetHeat.x = 520;
      targetHeat.y = 320;
      targetHeat.vx = 0;
      targetHeat.vy = 0;
      targetHeat.aiState = 'idle';
      targetHeat.stateTimer = 99;
      targetHeat.attackCooldownTimer = 99;

      const inOrangeBefore = pHeat.weaponHeat >= 65 && pHeat.weaponHeat <= 95 && pHeat.overheatLockTimer <= 0;
      if (inOrangeBefore && !wasInOrangeZone) {
        heatCycles += 1;
        wasInOrangeZone = true;
      } else if (pHeat.weaponHeat < 65 || pHeat.overheatLockTimer > 0) {
        wasInOrangeZone = false;
      }

      const pkt = stepHonestPlayerBot(
        simHeat,
        pHeat,
        brainHeat,
        AVERAGE_PLAYER_BOT_PROFILE,
        SIM_STEP_SEC,
        t,
      );
      simHeat.setPlayerInput(pkt);
      simHeat.step(SIM_STEP_SEC);

      const evs = simHeat.consumeEvents();
      if (evs.some((e) => e.kind === 'tactical_vent' && e.playerId === pHeat.id)) {
        tacticalVentCount += 1;
        wasInOrangeZone = false;
      }
    }

    expect(heatCycles).toBeGreaterThanOrEqual(40);
    const heatSuccessRate = tacticalVentCount / heatCycles;
    expect(heatSuccessRate).toBeGreaterThanOrEqual(0.35);
    expect(heatSuccessRate).toBeLessThanOrEqual(0.65);
  });

  it('(c) flips nearby barricade [E] and executes Dash-Kick with ~40% probability (tacticalCoverKickProbability = 0.4) when enemy projectiles approach', () => {
    const trials = 80;
    let coverKickTriggeredCount = 0;

    for (let i = 0; i < trials; i++) {
      const sim = new WorldSim({
        seed: 4100 + i * 37,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
        autoRespawnWaves: false,
      });
      sim.selectCharacter(sim.player.id, 'ranger');
      const p = sim.player;
      p.godMode = false;
      p.x = 360;
      p.y = 320;
      p.dashCooldownTimer = 0;

      const enemy = sim.spawnEnemy('goblin_shooter', 560, 320, true);
      enemy.hp = 500;
      enemy.maxHp = 500;
      enemy.aiState = 'idle';
      enemy.stateTimer = 99;
      enemy.attackCooldownTimer = 99;

      // Spawn a low moss_table right in front of the player toward the enemy
      const table = sim.spawnProp('moss_table', 392, 320);
      expect(table.coverState).toBe('low');

      // Spawn incoming enemy projectile heading toward the player
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 90000 + i,
          ownerId: enemy.id,
          team: 'enemy',
          weaponId: 'goblin_bow',
          x: 510,
          y: 320,
          vx: -220,
          vy: 0,
          angle: Math.PI,
          radius: 5,
          damage: 2,
          isCrit: false,
          knockback: 20,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 2.0,
          element: 'none',
          amplifiedByShield: false,
        }),
      );

      const brain = createBotBrainState(p.id, 4100 + i * 37);
      let flippedCover = false;
      let kickedCover = false;

      for (let t = 1; t <= 24; t++) {
        const pkt = stepHonestPlayerBot(
          sim,
          p,
          brain,
          AVERAGE_PLAYER_BOT_PROFILE,
          SIM_STEP_SEC,
          t,
        );
        sim.setPlayerInput(pkt);
        sim.step(SIM_STEP_SEC);

        const evs = sim.consumeEvents();
        if (evs.some((ev) => ev.kind === 'cover_flipped' && ev.propId === table.id)) {
          flippedCover = true;
        }
        if (
          evs.some((ev) => ev.kind === 'prop_kicked' && ev.propId === table.id) ||
          table.coverState === 'sliding'
        ) {
          kickedCover = true;
          break;
        }
      }

      if (flippedCover && kickedCover) {
        coverKickTriggeredCount += 1;
      }
    }

    const observedRate = coverKickTriggeredCount / trials;
    expect(observedRate).toBeGreaterThanOrEqual(0.28);
    expect(observedRate).toBeLessThanOrEqual(0.52);
  });

  it('(d) steers to nearest barricade / biome toy, flips if needed, and Dash-Kicks to break Boss armor within 3.0-6.0s (<= 360 ticks) with godMode=false across all 3 Bosses', () => {
    const bossConfigs: ReadonlyArray<{
      bossId: 'spore_king' | 'kryssa_ice_queen' | 'forge_titan';
      biome: 1 | 2 | 3;
      floor: 2 | 4 | 6;
    }> = [
      { bossId: 'spore_king', biome: 1, floor: 2 },
      { bossId: 'kryssa_ice_queen', biome: 2, floor: 4 },
      { bossId: 'forge_titan', biome: 3, floor: 6 },
    ];

    for (const cfg of bossConfigs) {
      // 1. Test via stepHonestPlayerBot
      const sim = new WorldSim({
        seed: 5200 + cfg.biome * 101,
        biome: cfg.biome,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: true,
        autoRespawnWaves: false,
      });
      sim.selectCharacter(sim.player.id, 'ranger');
      sim.advanceToFloor(cfg.floor);
      const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss') ?? sim.dungeon.rooms[0]!;
      sim.enterRoom(bossRoom.id);

      const p = sim.player;
      p.godMode = false;
      p.maxHp = 12;
      p.hp = 12;
      p.maxArmor = 10;
      p.armor = 10;

      const boss = sim.getActiveBoss()!;
      expect(boss).toBeDefined();
      expect(boss.defId).toBe(cfg.bossId);

      // Trigger Phase 2 armor shell at 66% HP
      boss.hp = Math.floor(boss.maxHp * 0.66);
      boss.bossPhaseTransitionTimer = 0;
      activateBossArmorShell(sim, boss);
      expect(boss.bossArmorShellActive).toBe(true);

      const brain = createBotBrainState(p.id, 5200 + cfg.biome * 101);
      let breakTick = -1;

      for (let t = 1; t <= 360; t++) {
        // Keep player alive legitimately with high HP/Armor pool, strictly godMode = false
        expect(p.godMode).toBe(false);
        const pkt = stepHonestPlayerBot(
          sim,
          p,
          brain,
          AVERAGE_PLAYER_BOT_PROFILE,
          SIM_STEP_SEC,
          t,
        );
        expect(p.godMode).toBe(false);
        sim.setPlayerInput(pkt);
        sim.step(SIM_STEP_SEC);

        if (!boss.bossArmorShellActive) {
          breakTick = t;
          break;
        }
      }

      expect(boss.bossArmorShellActive).toBe(false);
      expect(breakTick).toBeGreaterThanOrEqual(180); // >= 3.0s
      expect(breakTick).toBeLessThanOrEqual(360); // <= 6.0s

      // 2. Also verify stepBotAutoPlayImpl breaks Boss armor within <= 360 ticks with godMode = false
      const autoSim = new WorldSim({
        seed: 6200 + cfg.biome * 101,
        biome: cfg.biome,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: true,
        autoRespawnWaves: false,
      });
      autoSim.advanceToFloor(cfg.floor);
      const autoBossRoom =
        autoSim.dungeon.rooms.find((r) => r.type === 'boss') ?? autoSim.dungeon.rooms[0]!;
      autoSim.enterRoom(autoBossRoom.id);
      autoSim.botAutoPlayActive = true;
      autoSim.player.godMode = false;
      autoSim.player.maxHp = 14;
      autoSim.player.hp = 14;
      autoSim.player.maxArmor = 12;
      autoSim.player.armor = 12;

      const autoBoss = autoSim.getActiveBoss()!;
      autoBoss.hp = Math.floor(autoBoss.maxHp * 0.66);
      autoBoss.bossPhaseTransitionTimer = 0;
      activateBossArmorShell(autoSim, autoBoss);
      expect(autoBoss.bossArmorShellActive).toBe(true);

      let autoBreakTick = -1;
      for (let t = 1; t <= 360; t++) {
        autoSim.step(SIM_STEP_SEC);
        expect(autoSim.player.godMode).toBe(false);
        if (!autoBoss.bossArmorShellActive) {
          autoBreakTick = t;
          break;
        }
      }
      expect(autoBoss.bossArmorShellActive).toBe(false);
      expect(autoBreakTick).toBeGreaterThan(0);
      expect(autoBreakTick).toBeLessThanOrEqual(360);
    }
  });

  it('(e) out of combat: attaches WeaponMutator at daedalus_anvil, upgrades weapon at upgrade_anvil, signs Ashen Pact at shrine, holds DROP_WEAPON 0.5s (30 ticks) to salvage spare ground weapons into Gold, and buys items at merchant', () => {
    const sim = new WorldSim({
      seed: 7301,
      biome: 1,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.botAutoPlayActive = true;
    const p = sim.player;
    p.godMode = false;
    p.weaponSlots = ['hunter_crossbow', 'solar_archon_staff'];
    sim.equipWeaponSlot(1);

    // 1. Odd floor (Floor 1) Treasure Room: open chest, salvage spare weapon for Gold, and attach WeaponMutator at daedalus_anvil
    const treasureRoom1 = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
    sim.enterRoom(treasureRoom1.id);
    if (!sim.npcEntities.some((n) => n.kind === 'daedalus_anvil')) {
      populateTreasureForgeWorkshop(sim, treasureRoom1, false);
    }
    // Spawn a spare common weapon on the floor that is weaker than equipped weapons
    sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: 'knight_sword',
      rarity: 'common',
      nameVi: 'Kiếm Hiệp Sĩ',
      costGold: 0,
      healAmount: 0,
      x: p.x + 28,
      y: p.y,
    });
    const goldBeforeSalvage = p.gold;
    let salvagedEventSeen = false;

    for (let t = 0; t < 240; t++) {
      sim.step(SIM_STEP_SEC);
      const evs = sim.consumeEvents();
      if (evs.some((e) => e.kind === 'weapon_salvaged' && e.playerId === p.id)) {
        salvagedEventSeen = true;
      }
    }

    expect(salvagedEventSeen).toBe(true);
    expect(p.gold).toBeGreaterThan(goldBeforeSalvage);
    expect((p.weaponMutators[p.activeWeaponSlot] ?? []).length).toBeGreaterThanOrEqual(1);

    // 2. Odd floor (Floor 1) Shrine Room: interact with shrine and sign an Ashen Pact
    const shrineRoom = sim.dungeon.rooms.find((r) => r.type === 'shrine')!;
    sim.enterRoom(shrineRoom.id);
    p.hp = p.maxHp;
    for (let t = 0; t < 180 && p.activePactId === null; t++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(p.activePactId).not.toBeNull();

    // 3. Merchant Room: buy affordable shop items with Gold
    const merchantRoom = sim.dungeon.rooms.find((r) => r.type === 'merchant')!;
    sim.enterRoom(merchantRoom.id);
    p.gold = 120;
    const goldBeforeShop = p.gold;
    let purchasedAny = false;
    for (let t = 0; t < 240; t++) {
      sim.step(SIM_STEP_SEC);
      const evs = sim.consumeEvents();
      if (evs.some((e) => e.kind === 'item_purchased')) {
        purchasedAny = true;
        break;
      }
    }
    expect(purchasedAny).toBe(true);
    expect(p.gold).toBeLessThan(goldBeforeShop);

    // 4. Even floor (Floor 2) Treasure Room: interact with upgrade_anvil to upgrade weapon level (+1)
    sim.advanceToFloor(2);
    const treasureRoom2 = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
    sim.enterRoom(treasureRoom2.id);
    if (!sim.npcEntities.some((n) => n.kind === 'upgrade_anvil')) {
      populateTreasureForgeWorkshop(sim, treasureRoom2, false);
    }
    const levelBefore = p.weaponUpgradeLevels?.[p.activeWeaponSlot] ?? 0;
    for (let t = 0; t < 180; t++) {
      sim.step(SIM_STEP_SEC);
      if ((p.weaponUpgradeLevels?.[p.activeWeaponSlot] ?? 0) > levelBefore) {
        break;
      }
    }
    expect(p.weaponUpgradeLevels?.[p.activeWeaponSlot] ?? 0).toBe(levelBefore + 1);
    expect(p.godMode).toBe(false);
  });
});
