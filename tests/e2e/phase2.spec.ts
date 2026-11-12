import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots/phase-2');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe('Phase 2 — Pipeline Hình Ảnh & Tương Tác Map', () => {
  test('verifies autotiled tilemap + AO shadows, dynamic lighting + PostFX, destructible props + barrel chain explosions, 6 interactive surfaces, 4 elemental statuses (Burn/Chill-Freeze-Shatter/Shock-Chain/Poison), quality settings, and 4P+80E+600B stress test at 1080p', async ({
    page,
  }) => {
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
    await page.goto('/?scene=game');

    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.scene === 'GameScene' &&
        window.__GAME_DEBUG__?.inHub === false &&
        (window.__GAME_DEBUG__?.tick ?? 0) >= 60,
      null,
      { timeout: 15000 },
    );

    // 1. Verify Tilemap Autotiling, AO Shadows, Dynamic Lighting & 6 Interactive Surfaces
    const mapAndLightCheck = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const map = sim.map;

      // Move player slightly toward the upper tactical zone so water, oil, grass, torches, barrels & cracked wall are all in view
      sim.player.x = 560;
      sim.player.y = 230;
      sim.player.prevX = 560;
      sim.player.prevY = 230;
      sim.player.godMode = true;

      const surfacesFound = new Set<string>();
      let autotiledWallCount = 0;
      let aoFloorCount = 0;

      for (let ty = 0; ty < map.rows; ty++) {
        for (let tx = 0; tx < map.cols; tx++) {
          const s = map.getSurface(tx, ty);
          if (s !== 'none') surfacesFound.add(s);
          if (map.getTile(tx, ty) !== 'floor' && map.getAutotileMask(tx, ty) > 0) {
            autotiledWallCount += 1;
          }
          if (map.getTile(tx, ty) === 'floor' && map.getWallAmbientOcclusionMask(tx, ty) > 0) {
            aoFloorCount += 1;
          }
        }
      }

      return {
        surfaces: Array.from(surfacesFound),
        autotiledWallCount,
        aoFloorCount,
        propCount: window.__GAME_DEBUG__.propCount,
        activeLightCount: window.__GAME_DEBUG__.activeLightCount,
        ambientParticleCount: window.__GAME_DEBUG__.ambientParticleCount,
      };
    });

    expect(mapAndLightCheck.surfaces).toEqual(
      expect.arrayContaining(['water', 'oil', 'grass', 'poison_swamp']),
    );
    expect(mapAndLightCheck.surfaces).not.toContain('lava');
    expect(mapAndLightCheck.surfaces).not.toContain('ice');
    expect(mapAndLightCheck.surfaces).not.toContain('conveyor');
    expect(mapAndLightCheck.autotiledWallCount).toBeGreaterThan(20);
    expect(mapAndLightCheck.aoFloorCount).toBeGreaterThan(20);
    expect(mapAndLightCheck.propCount).toBeGreaterThanOrEqual(10);
    expect(mapAndLightCheck.activeLightCount).toBeGreaterThan(6);
    expect(mapAndLightCheck.ambientParticleCount).toBeGreaterThan(10);

    await page.mouse.move(1180, 420);
    await page.waitForTimeout(280);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'dynamic-lighting-and-surfaces-1080p.png'),
    });

    // 2. Verify Dash Afterimages, Elemental Imbue Cycling, Barrel Chain Explosion, Cracked Wall Destruction, Burning Oil/Grass, Electrified Water & Freeze/Shatter
    await page.keyboard.down('D');
    await page.keyboard.press('Shift');
    await page.waitForTimeout(90);
    await page.keyboard.up('D');

    // Cycle elemental imbue with Alt+R key
    await page.keyboard.press('Alt+KeyR');
    await page.waitForTimeout(50);
    const imbueAfterR = await page.evaluate(() => window.__GAME_DEBUG__.activeImbueElement);
    expect(imbueAfterR).toBe('burn');

    const reactionResults = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();

      // Position player for a clear view of the upper-middle oil/grass/water & cracked wall zone
      sim.player.x = 576;
      sim.player.y = 210;
      sim.player.prevX = 576;
      sim.player.prevY = 210;
      sim.player.skillActiveTimer = 2.5;

      // Clear existing non-dummy enemies and place showcase targets
      sim.enemies = sim.enemies.filter((e) => e.isDummy);

      // A. Place an enemy on water (tx=12, ty=4 -> x=400, y=144) and another nearby to test Shock + Electrified Water + Chain Lightning
      const waterEnemy1 = sim.spawnEnemy('goblin_shooter', 400, 144, true);
      const waterEnemy2 = sim.spawnEnemy('wild_boar', 448, 144, true);
      sim.applyElementAtWorldPoint(400, 144, 'shock', 24);
      sim.applyDamageToEnemy(waterEnemy1, 14, false, 'shock', 0, 0);

      // B. Place an enemy in front of player and apply 3 Chill stacks -> Frozen, then test 3x Shatter on heavy hit
      const frozenTarget = sim.spawnEnemy('wild_boar', 490, 210, true);
      frozenTarget.maxHp = 200;
      frozenTarget.hp = 200;
      sim.applyDamageToEnemy(frozenTarget, 5, false, 'chill', 0, 0);
      sim.applyDamageToEnemy(frozenTarget, 5, false, 'chill', 0, 0);
      sim.applyDamageToEnemy(frozenTarget, 5, false, 'chill', 0, 0);
      const wasFrozen = frozenTarget.frozenTimer > 0;
      const hpBeforeShatter = frozenTarget.hp;
      sim.applyDamageToEnemy(frozenTarget, 20, true, 'none', 0, 0, true);
      const shatterDamageDealt = hpBeforeShatter - frozenTarget.hp;

      // Re-freeze another boar so screenshot shows the icy crystal encasement ring
      const visualFrozenBoar = sim.spawnEnemy('wild_boar', 475, 220, true);
      sim.applyDamageToEnemy(visualFrozenBoar, 4, false, 'chill', 0, 0);
      sim.applyDamageToEnemy(visualFrozenBoar, 4, false, 'chill', 0, 0);
      sim.applyDamageToEnemy(visualFrozenBoar, 4, false, 'chill', 0, 0);

      // C. Poison blocks Training Dummy self-healing
      const dummy = sim.enemies.find((e) => e.isDummy) ?? sim.spawnTrainingDummy(260, 260);
      sim.applyDamageToEnemy(dummy, 20, false, 'poison', 0, 0);
      const dummyHpAfterPoisonHit = dummy.hp;

      // D. Detonate the explosive barrel near the oil pool & north cracked wall (tx=18, ty=0)
      const crackedBefore = sim.map.getTile(18, 0);
      const topBarrels = sim.props.filter((p) => p.kind === 'explosive_barrel' && p.y < 300);
      for (const b of topBarrels) {
        if (b.hp > 0) {
          sim.damageProp(b, 999, 'burn');
        }
      }
      // Also ignite oil at (18, 4) and break a wooden crate so shards & flames are visible in the frame
      sim.map.igniteSurfaceInRadius(18 * 32 + 16, 4 * 32 + 16, 80);
      sim.map.destroyCrackedWall(18, 0);
      const crate = sim.props.find((p) => p.kind === 'wooden_crate' && p.hp > 0);
      if (crate) {
        sim.damageProp(crate, 999, 'none');
      }

      transport.step(16.6667);
      const healedWhilePoisoned =
        dummy.hp > dummyHpAfterPoisonHit ? dummy.hp - dummyHpAfterPoisonHit : 0;

      let burningTiles = 0;
      let electrifiedWaterTiles = 0;
      for (let ty = 0; ty < sim.map.rows; ty++) {
        for (let tx = 0; tx < sim.map.cols; tx++) {
          const s = sim.map.getSurface(tx, ty);
          if (s === 'burning_oil' || s === 'burning_grass') burningTiles += 1;
          if (s === 'electrified_water') electrifiedWaterTiles += 1;
        }
      }

      return {
        wasFrozen,
        shatterDamageDealt,
        healedWhilePoisoned,
        waterEnemy2Shocked: waterEnemy2.hp < waterEnemy2.maxHp,
        crackedBefore,
        crackedAfter: sim.map.getTile(18, 0),
        burningTiles,
        electrifiedWaterTiles,
      };
    });

    expect(reactionResults.wasFrozen).toBe(true);
    expect(reactionResults.shatterDamageDealt).toBe(40); // 20 base * 2.0x shatter multiplier (3-Bucket Damage Pipeline)
    expect(reactionResults.healedWhilePoisoned).toBe(0);
    expect(reactionResults.waterEnemy2Shocked).toBe(true);
    expect(reactionResults.crackedBefore).toBe('cracked_wall');
    expect(reactionResults.crackedAfter).toBe('floor');
    expect(reactionResults.burningTiles).toBeGreaterThan(4);
    expect(reactionResults.electrifiedWaterTiles).toBeGreaterThan(4);

    await page.waitForTimeout(160);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'elemental-reactions-and-barrels-1080p.png'),
    });

    const decalCountAfterExplosion = await page.evaluate(() => window.__GAME_DEBUG__.decalCount);
    expect(decalCountAfterExplosion).toBeGreaterThan(0);

    // 3. Verify Graphics Quality Presets (High / Medium / Low), localStorage persistence, and F1 Debug Overlay
    await page.keyboard.press('F1');
    await page.waitForTimeout(100);

    // Cycle High -> Medium -> Low -> High via G key
    await page.keyboard.press('KeyG');
    await page.waitForTimeout(80);
    const medState = await page.evaluate(() => ({
      quality: window.__GAME_DEBUG__.graphicsQuality,
      ambient: window.__GAME_DEBUG__.ambientParticleCount,
      stored: JSON.parse(localStorage.getItem('ashen_pact_graphics_settings') || '{}').quality,
    }));
    expect(medState.quality).toBe('medium');
    expect(medState.stored).toBe('medium');
    expect(medState.ambient).toBe(18);

    await page.keyboard.press('KeyG');
    await page.waitForTimeout(80);
    const lowState = await page.evaluate(() => ({
      quality: window.__GAME_DEBUG__.graphicsQuality,
      ambient: window.__GAME_DEBUG__.ambientParticleCount,
      decalCount: window.__GAME_DEBUG__.decalCount,
      activeLightCount: window.__GAME_DEBUG__.activeLightCount,
      stored: JSON.parse(localStorage.getItem('ashen_pact_graphics_settings') || '{}').quality,
    }));
    expect(lowState.quality).toBe('low');
    expect(lowState.stored).toBe('low');
    expect(lowState.ambient).toBe(0);
    expect(lowState.decalCount).toBeLessThanOrEqual(30);
    expect(lowState.activeLightCount).toBeLessThanOrEqual(12);

    // Cycle back to High quality
    await page.keyboard.press('KeyG');
    await page.waitForTimeout(100);
    const highState = await page.evaluate(() => window.__GAME_DEBUG__.graphicsQuality);
    expect(highState).toBe('high');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'graphics-quality-and-debug-1080p.png'),
    });

    // 4. Phase 2 Specific DoD Stress Test: 4 Simulated Players + 80 Active Enemies + >= 600 Projectiles + Particles + Dynamic Lighting at 1080p High
    await page.evaluate(() => {
      window.__GAME_SET_QUALITY__?.('high');
      window.__GAME_STRESS_TEST__?.(true);
    });

    // Wait for stress test to populate 4 players + 80 enemies + >= 600 active projectiles
    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.stressTestActive === true &&
        (window.__GAME_DEBUG__?.entityCount ?? 0) >= 84 &&
        (window.__GAME_DEBUG__?.bulletCount ?? 0) >= 600,
      null,
      { timeout: 10000 },
    );

    // Test viewport resize (1080p -> 2560x1080 -> 1280x1024 -> 1440p -> 1080p) while Stress Test is active
    // and verify HudScene isolation + uniform camera zoom (zoomX === zoomY) across aspect ratios
    const hudIsolationCheck = await page.evaluate(() => {
      const game = window.__PHASER_GAME__!;
      const gs = game.scene.getScene('GameScene') as unknown as {
        hudContainer: { scene: { scene: { key: string } } };
      };
      const hs = game.scene.getScene('HudScene');
      return {
        hudSceneActive: game.scene.isActive('HudScene'),
        hudScenePostPipelines: hs.cameras.main.postPipelines.length,
        hudContainerSceneKey: gs.hudContainer.scene.scene.key,
      };
    });
    expect(hudIsolationCheck.hudSceneActive).toBe(true);
    expect(hudIsolationCheck.hudScenePostPipelines).toBe(0);
    expect(hudIsolationCheck.hudContainerSceneKey).toBe('HudScene');

    await page.setViewportSize({ width: 2560, height: 1080 });
    await page.waitForTimeout(100);
    const ultrawideZoom = await page.evaluate(() => {
      const game = window.__PHASER_GAME__!;
      const gCam = game.scene.getScene('GameScene').cameras.main;
      const hCam = game.scene.getScene('HudScene').cameras.main;
      return {
        gZoomX: gCam.zoomX,
        gZoomY: gCam.zoomY,
        hZoomX: hCam.zoomX,
        hZoomY: hCam.zoomY,
      };
    });
    expect(ultrawideZoom.gZoomX).toBeCloseTo(ultrawideZoom.gZoomY, 5);
    expect(ultrawideZoom.hZoomX).toBeCloseTo(ultrawideZoom.hZoomY, 5);

    await page.setViewportSize({ width: 1280, height: 1024 });
    await page.waitForTimeout(100);
    const aspect5x4Zoom = await page.evaluate(() => {
      const game = window.__PHASER_GAME__!;
      const gCam = game.scene.getScene('GameScene').cameras.main;
      const hCam = game.scene.getScene('HudScene').cameras.main;
      return {
        gZoomX: gCam.zoomX,
        gZoomY: gCam.zoomY,
        hZoomX: hCam.zoomX,
        hZoomY: hCam.zoomY,
      };
    });
    expect(aspect5x4Zoom.gZoomX).toBeCloseTo(aspect5x4Zoom.gZoomY, 5);
    expect(aspect5x4Zoom.hZoomX).toBeCloseTo(aspect5x4Zoom.hZoomY, 5);

    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.waitForTimeout(150);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(250);

    const heapBefore = await page.evaluate(() => window.__GAME_DEBUG__.heapUsedMb);

    // Sustain stress test at 1080p High and sample uninterrupted performance metrics
    await page.waitForTimeout(2200);

    const stressMetrics = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const t0 = performance.now();
      transport.step(16.6667);
      const stepMs = performance.now() - t0;

      return {
        fps: window.__GAME_DEBUG__.fps,
        frameTimeMs: window.__GAME_DEBUG__.frameTimeMs,
        entityCount: window.__GAME_DEBUG__.entityCount,
        bulletCount: window.__GAME_DEBUG__.bulletCount,
        particleCount: window.__GAME_DEBUG__.particleCount,
        decalCount: window.__GAME_DEBUG__.decalCount,
        activeLightCount: window.__GAME_DEBUG__.activeLightCount,
        heapAfter: window.__GAME_DEBUG__.heapUsedMb,
        stepMs,
        errors: window.__GAME_DEBUG__.errors,
        warnings: window.__GAME_DEBUG__.warnings,
      };
    });

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'stress-test-4p-80e-600b-1080p.png'),
    });

    expect(stressMetrics.entityCount).toBeGreaterThanOrEqual(84);
    expect(stressMetrics.bulletCount).toBeGreaterThanOrEqual(600);
    expect(stressMetrics.activeLightCount).toBeGreaterThanOrEqual(30);
    expect(stressMetrics.stepMs).toBeLessThan(6.0);
    expect(stressMetrics.fps).toBeGreaterThanOrEqual(55);
    if (heapBefore > 0 && stressMetrics.heapAfter > 0) {
      expect(stressMetrics.heapAfter - heapBefore).toBeLessThan(20);
    }

    // Turn off stress test cleanly via F7
    await page.keyboard.press('F7');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.stressTestActive === false, null, {
      timeout: 5000,
    });

    expect(stressMetrics.errors).toEqual([]);
    expect(stressMetrics.warnings).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);
  });
});
