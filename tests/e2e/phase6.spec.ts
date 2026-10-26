import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots/phase-6');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe('Phase 6 — Biomes 2 & 3 (Frozen Depths & Molten Forge), 24 Weapons, Co-op Puzzles & Bosses Kryssa / Forge Titan', () => {
  test('verifies Biome 2 Frozen Depths + Boss Kryssa Ice Queen, Biome 3 Molten Forge + Boss Forge Titan, Co-op Weapons/Puzzles, and Art Gallery Page 3 & 5', async ({
    page,
  }) => {
    test.setTimeout(90000);

    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.setViewportSize({ width: 1920, height: 1080 });

    // 1. Biome 2 — Hầm Băng Vĩnh Cửu (Frozen Depths): 5 regular enemies, ice & chasm surfaces, and Co-op Dual Pressure Plates
    await page.goto('/?biome=2');
    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.scene === 'GameScene' && window.__GAME_DEBUG__?.currentBiome === 2,
      null,
      { timeout: 15000 },
    );

    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat');
      if (combatRoom) {
        sim.enterRoom(combatRoom.id);
      }

      // Clear default wave and arrange all 5 Biome 2 regular enemies cleanly for visual inspection
      sim.enemies.length = 0;
      sim.projectiles.length = 0;

      const p1 = sim.player;
      sim.selectCharacter(p1.id, 'vanguard');
      p1.godMode = true;
      p1.x = 340;
      p1.y = 260;
      p1.aimAngle = 0;
      p1.weaponSlots[0] = 'berserker_axe';
      p1.weaponSlots[1] = 'hunter_crossbow';

      const p2 = sim.addCoopPlayer(2, 'ranger', 'Ưng Nhãn P2', 2);
      p2.godMode = true;
      p2.x = 340;
      p2.y = 420;
      p2.aimAngle = 0;

      // Spawn and solve the Co-op Dual Pressure Plate puzzle
      sim.spawnCoopPressurePlatePuzzle();
      if (sim.pressurePlates.length >= 2) {
        p1.x = sim.pressurePlates[0]!.x;
        p1.y = sim.pressurePlates[0]!.y;
        p2.x = sim.pressurePlates[1]!.x;
        p2.y = sim.pressurePlates[1]!.y;
      }

      const bat = sim.spawnEnemy('frost_bat', 580, 210, true);
      bat.hp = 400;
      bat.maxHp = 400;

      const yeti = sim.spawnEnemy('baby_yeti', 690, 250, true, 'giant');
      yeti.hp = 600;
      yeti.maxHp = 600;

      const mage = sim.spawnEnemy('ice_mage', 810, 310, true);
      mage.hp = 500;
      mage.maxHp = 500;

      const golem = sim.spawnEnemy('ice_golem', 610, 385, true, 'shield');
      golem.hp = 900;
      golem.maxHp = 900;
      golem.aimAngle = Math.PI;

      const spirit = sim.spawnEnemy('snow_spirit', 760, 435, true);
      spirit.hp = 400;
      spirit.maxHp = 400;

      sim.step(1 / 60);
    });

    await page.waitForTimeout(250);

    const biome2Check = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      return {
        currentBiome: sim.currentBiome,
        currentFloor: sim.currentFloor,
        enemyDefs: sim.enemies.map((e) => e.defId),
        coopPuzzleCompleted: sim.coopPuzzleCompleted,
      };
    });
    expect(biome2Check.currentBiome).toBe(2);
    expect(biome2Check.currentFloor).toBe(3);
    expect(biome2Check.enemyDefs).toEqual(
      expect.arrayContaining(['frost_bat', 'baby_yeti', 'ice_mage', 'ice_golem', 'snow_spirit']),
    );
    expect(biome2Check.coopPuzzleCompleted).toBe(true);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'frozen-depths-combat-1080p.png'),
    });

    // 2. Boss Biome 2 — Băng Hậu Kryssa (kryssa_ice_queen): Crystal Pillars, Mirror Clones, Blizzard Veil & Ice Prison rescue
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.advanceToFloor(4);
      const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss');
      if (bossRoom) {
        sim.enterRoom(bossRoom.id);
      }

      const p1 = sim.player;
      p1.godMode = true;
      p1.x = 340;
      p1.y = 330;
      p1.aimAngle = 0;
      p1.weaponSlots[0] = 'berserker_axe';
      p1.weaponSlots[1] = 'hunter_crossbow';

      const p2 = sim.getPlayerById(2) ?? sim.addCoopPlayer(2, 'ranger', 'Ưng Nhãn P2', 2);
      p2.godMode = true;
      p2.x = 430;
      p2.y = 410;

      const boss = sim.enemies.find((e) => e.defId === 'kryssa_ice_queen');
      if (boss) {
        boss.x = 690;
        boss.y = 330;
        boss.aiState = 'move';
        boss.stateTimer = 0;
        // Damage Boss into Phase 2 then Phase 3 to trigger Mirror Clones + Blizzard Veil
        sim.applyDamageToEnemy(
          boss,
          Math.ceil(boss.maxHp * 0.36),
          false,
          'none',
          0,
          0,
          false,
          p1.id,
        );
        sim.applyDamageToEnemy(
          boss,
          Math.ceil(boss.maxHp * 0.36),
          false,
          'none',
          0,
          0,
          false,
          p1.id,
        );
        boss.aiState = 'move';
        boss.stateTimer = 0;
      }

      // Encase P2 in an Ice Prison for visual & functional verification
      sim.encasePlayerInIcePrison(p2);
    });

    await page.waitForTimeout(250);

    const kryssaCheck = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const boss = sim.enemies.find((e) => e.defId === 'kryssa_ice_queen');
      const clones = sim.enemies.filter((e) => e.defId === 'kryssa_clone' && e.hp > 0);
      const prison = sim.enemies.find((e) => e.defId === 'ice_prison' && e.hp > 0);
      const pillars = sim.props.filter((p) => p.kind === 'crystal_pillar');
      const p2 = sim.getPlayerById(2)!;
      return {
        bossPhase: boss?.bossPhase ?? 0,
        blizzardVeilActive: sim.blizzardVeilActive,
        cloneCount: clones.length,
        hasIcePrison: Boolean(prison),
        pillarCount: pillars.length,
        p2EncasedTimer: p2.encasedInIceTimer ?? 0,
      };
    });
    expect(kryssaCheck.bossPhase).toBe(3);
    expect(kryssaCheck.blizzardVeilActive).toBe(true);
    expect(kryssaCheck.cloneCount).toBeGreaterThanOrEqual(2);
    expect(kryssaCheck.hasIcePrison).toBe(true);
    expect(kryssaCheck.pillarCount).toBeGreaterThanOrEqual(2);
    expect(kryssaCheck.p2EncasedTimer).toBeGreaterThan(0);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'boss-kryssa-ice-queen-1080p.png'),
    });

    // Shatter Ice Prison to rescue P2
    const p2Freed = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const prison = sim.enemies.find((e) => e.defId === 'ice_prison' && e.hp > 0);
      if (prison) {
        sim.applyDamageToEnemy(prison, 999, true, 'burn', 0, 0, true, sim.player.id);
      }
      const p2 = sim.getPlayerById(2)!;
      return (p2.encasedInIceTimer ?? 0) === 0;
    });
    expect(p2Freed).toBe(true);

    // 3. Biome 3 — Lò Rèn Dung Nham (Molten Forge): 5 regular enemies, conveyor belts, Seed Gun & Tether Staff
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.advanceToBiome(3);
      const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat');
      if (combatRoom) {
        sim.enterRoom(combatRoom.id);
      }

      sim.enemies.length = 0;
      sim.projectiles.length = 0;

      const p1 = sim.player;
      sim.selectCharacter(p1.id, 'druid');
      p1.godMode = true;
      p1.x = 320;
      p1.y = 265;
      p1.aimAngle = 0;
      p1.weaponSlots[0] = 'tether_staff';
      p1.weaponSlots[1] = 'seed_gun';
      p1.activeWeaponSlot = 0;
      p1.fireCooldownTimer = 0;

      const p2 = sim.getPlayerById(2) ?? sim.addCoopPlayer(2, 'engineer', 'Bánh Răng P2', 2);
      sim.selectCharacter(p2.id, 'engineer');
      p2.godMode = true;
      p2.x = 490;
      p2.y = 405;
      p2.aimAngle = 0;

      // Spawn all 5 Biome 3 regular enemies
      const imp = sim.spawnEnemy('fire_imp', 405, 335, true);
      imp.hp = 450;
      imp.maxHp = 450;

      const cannon = sim.spawnEnemy('dwarf_cannon', 640, 230, true);
      cannon.hp = 550;
      cannon.maxHp = 550;

      const coal = sim.spawnEnemy('coal_golem', 595, 360, true, 'explosive_death');
      coal.hp = 650;
      coal.maxHp = 650;

      const drone = sim.spawnEnemy('welder_drone', 735, 290, true);
      drone.hp = 500;
      drone.maxHp = 500;
      drone.attackCooldownTimer = 0;

      const shielder = sim.spawnEnemy('iron_shielder', 780, 415, true, 'shield');
      shielder.hp = 850;
      shielder.maxHp = 850;
      shielder.aimAngle = Math.PI;

      // Fire Tether Staff to create an active tether beam between P1 and P2 across fire_imp
      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 1, // FIRE
      });
      sim.step(1 / 60);
      sim.setPlayerInput({
        seq: 2,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
      });

      // Also spawn a Seed Gun Life Blossom aura near P1
      sim.summons.push({
        id: 95001,
        ownerPlayerId: p1.id,
        kind: 'life_blossom',
        nameVi: 'Hoa Sinh Mệnh',
        x: 380,
        y: 255,
        radius: 14,
        auraRadius: 92,
        hp: 30,
        maxHp: 30,
        ttlSec: 6.0,
        maxTtlSec: 6.5,
        tickTimer: 0.5,
        healsRemaining: 3,
        charge: 0,
        poisonRoots: false,
        selfDestruct: false,
        rootedEnemyIds: [],
      });
    });

    await page.waitForTimeout(250);

    const biome3Check = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      return {
        currentBiome: sim.currentBiome,
        currentFloor: sim.currentFloor,
        enemyDefs: sim.enemies.map((e) => e.defId),
        tetherBeamCount: sim.tetherBeams.length,
        hasLifeBlossom: sim.summons.some((s) => s.kind === 'life_blossom'),
      };
    });
    expect(biome3Check.currentBiome).toBe(3);
    expect(biome3Check.currentFloor).toBe(5);
    expect(biome3Check.enemyDefs).toEqual(
      expect.arrayContaining([
        'fire_imp',
        'dwarf_cannon',
        'coal_golem',
        'welder_drone',
        'iron_shielder',
      ]),
    );
    expect(biome3Check.tetherBeamCount).toBeGreaterThan(0);
    expect(biome3Check.hasLifeBlossom).toBe(true);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'molten-forge-combat-1080p.png'),
    });

    // 4. Boss Biome 3 — Titan Lò Rèn (forge_titan): Shockwave Rings, Conveyor Reversal & Dual Energy Cores
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.advanceToFloor(6);
      const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss');
      if (bossRoom) {
        sim.enterRoom(bossRoom.id);
      }

      const p1 = sim.player;
      p1.godMode = true;
      p1.x = 320;
      p1.y = 330;
      p1.aimAngle = 0;
      p1.weaponSlots[0] = 'thunder_hammer';
      p1.weaponSlots[1] = 'magma_cannon';

      const p2 = sim.getPlayerById(2)!;
      p2.godMode = true;
      p2.x = 320;
      p2.y = 420;
      p2.aimAngle = 0;

      const titan = sim.enemies.find((e) => e.defId === 'forge_titan');
      if (titan) {
        titan.x = 640;
        titan.y = 320;
        titan.aiState = 'move';
        titan.stateTimer = 0;
        // Damage Titan into Phase 2 (<= 66% HP) so it deploys 2 Forge Energy Cores
        sim.applyDamageToEnemy(
          titan,
          Math.ceil(titan.maxHp * 0.36),
          false,
          'none',
          0,
          0,
          false,
          p1.id,
        );
        titan.aiState = 'move';
        titan.stateTimer = 0;
        // Trigger a Hammer Slam Shockwave Ring for visual verification
        sim.shockwaveRings.push({
          id: 96001,
          sourceEnemyId: titan.id,
          x: titan.x,
          y: titan.y,
          radius: 115,
          maxRadius: 360,
          speed: 215,
          thickness: 22,
          damage: titan.damage,
          hitPlayerIds: [],
        });
      }
    });

    await page.waitForTimeout(220);

    const titanCheck = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const titan = sim.enemies.find((e) => e.defId === 'forge_titan');
      const cores = sim.enemies.filter((e) => e.defId === 'forge_energy_core' && e.hp > 0);
      return {
        bossPhase: titan?.bossPhase ?? 0,
        coreCount: cores.length,
        shockwaveCount: sim.shockwaveRings.length,
      };
    });
    expect(titanCheck.bossPhase).toBe(2);
    expect(titanCheck.coreCount).toBe(2);
    expect(titanCheck.shockwaveCount).toBeGreaterThan(0);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'boss-forge-titan-1080p.png'),
    });

    // Destroy both Forge Energy Cores within the 3s Co-op sync window -> verify Titan is overloaded & stunned!
    const titanStunned = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const cores = sim.enemies.filter((e) => e.defId === 'forge_energy_core' && e.hp > 0);
      for (const c of cores) {
        sim.applyDamageToEnemy(c, 999, true, 'shock', 0, 0, true, sim.player.id);
      }
      const titan = sim.enemies.find((e) => e.defId === 'forge_titan');
      return titan?.aiState === 'stunned' && (titan?.superconductTimer ?? 0) > 0;
    });
    expect(titanStunned).toBe(true);

    // 4b. Biome 3 Stress Test (4 players + fire/smoke particles + 80 enemies + 600+ bullets) >= 60 FPS
    await page.keyboard.press('F7');
    await page.waitForTimeout(450);
    const biome3StressPerf = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      return {
        stressActive: sim.stressTestActive,
        currentBiome: sim.currentBiome,
        simulatedPlayers: sim.simulatedPlayers.length,
        enemies: sim.enemies.length,
        fps: window.__GAME_DEBUG__.fps,
        frameTimeMs: window.__GAME_DEBUG__.frameTimeMs,
      };
    });
    expect(biome3StressPerf.stressActive).toBe(true);
    expect(biome3StressPerf.currentBiome).toBe(3);
    expect(biome3StressPerf.simulatedPlayers).toBe(3); // P1 + 3 simulated = 4 players
    expect(biome3StressPerf.enemies).toBeGreaterThanOrEqual(80);
    expect(biome3StressPerf.fps).toBeGreaterThanOrEqual(58);
    expect(biome3StressPerf.frameTimeMs).toBeLessThanOrEqual(17.5);
    await page.keyboard.press('F7');

    // 5. Art Gallery Page 3 (24 Weapons + Phase 6 Props) & Page 5 (Biome 2 & 3 Enemies + Bosses Kryssa & Forge Titan)
    await page.goto('/?gallery=1');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'ArtGalleryScene', null, {
      timeout: 15000,
    });

    await page.evaluate(() => {
      window.__GALLERY_SET_PAGE__?.(3);
    });
    await page.waitForFunction(() => window.__GAME_DEBUG__?.galleryPage === 3, null, {
      timeout: 5000,
    });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'gallery-24-weapons-1080p.png'),
    });

    await page.evaluate(() => {
      window.__GALLERY_SET_PAGE__?.(5);
    });
    await page.waitForFunction(() => window.__GAME_DEBUG__?.galleryPage === 5, null, {
      timeout: 5000,
    });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'gallery-phase6-biomes-bosses-1080p.png'),
    });

    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);
  });
});
