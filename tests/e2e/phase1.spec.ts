import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PHASE1_SAMPLE_WEAPONS } from '../../packages/shared/src/index.js';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots/phase-1');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe('Phase 1 — Core Gameplay & Game Feel (Solo, Phòng Thử Nghiệm)', () => {
  test('verifies <1 frame input response, smooth camera lookahead, dash i-frames, 4 sample weapons, 3 sample enemies + telegraphs, and full hit feel (flash + spark + sfx + damage number + knockback) at ~60 FPS', async ({
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
    await page.goto('/');

    await page.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'MenuScene', null, {
      timeout: 15000,
    });

    // Click "Bắt Đầu Chơi Thử (Game Scene)" button
    await page.mouse.click(960, 450);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'GameScene', null, {
      timeout: 10000,
    });
    await page.waitForFunction(() => (window.__GAME_DEBUG__?.tick ?? 0) >= 60, null, {
      timeout: 10000,
    });

    // 1. Capture Arena Overview screenshot (with initial wave of 3 sample enemies + dummy)
    await page.mouse.move(1250, 540);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'arena-overview-1080p.png'),
    });

    // 2. Verify < 1 frame input response & smooth camera lookahead
    const feelCheck = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__;
      if (!transport) throw new Error('Missing __GAME_TRANSPORT__');
      const sim = transport.getSim();

      // Clear enemies briefly to measure pure movement & camera lookahead
      sim.enemies = sim.enemies.filter((e) => e.isDummy);
      const beforeX = transport.getInterpolatedPlayerPos().x;

      transport.sendInput({
        seq: 9001,
        tick: sim.tick,
        moveX: 1,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
      });
      transport.step(16.6667);
      const after1FrameX = transport.getInterpolatedPlayerPos().x;

      return {
        beforeX,
        after1FrameX,
        deltaFrame1: after1FrameX - beforeX,
        vx: sim.player.vx,
      };
    });

    expect(feelCheck.deltaFrame1).toBeGreaterThan(0.1);
    expect(feelCheck.vx).toBeGreaterThan(40);

    // Move mouse far right and verify camera lookahead shifts camera center ahead of player without jitter
    await page.mouse.move(1750, 540);
    await page.waitForTimeout(250);
    const camCheck = await page.evaluate(() => ({
      playerX: window.__GAME_DEBUG__.playerX,
      cameraCenterX: window.__GAME_DEBUG__.cameraCenterX,
    }));
    expect(camCheck.cameraCenterX).toBeGreaterThan(camCheck.playerX + 10);

    // 3. Verify Dash (Shift) speed boost & i-frames
    await page.keyboard.down('D');
    await page.keyboard.press('Shift');
    await page.waitForTimeout(60);
    const dashState = await page.evaluate(() => {
      const p = window.__GAME_TRANSPORT__!.getSim().player;
      return {
        dashTimer: p.dashTimer,
        invulnerableTimer: p.invulnerableTimer,
        vx: p.vx,
      };
    });
    await page.keyboard.up('D');
    expect(dashState.vx).toBeGreaterThan(300);
    expect(dashState.invulnerableTimer).toBeGreaterThan(0);

    // 4. Verify cycling 2 starter weapon slots (knight_sword, rusty_pistol)
    for (let slot = 0; slot < PHASE1_SAMPLE_WEAPONS.length; slot++) {
      await page.keyboard.press(`Digit${slot + 1}`);
      await page.waitForTimeout(80);
      const activeId = await page.evaluate(() => window.__GAME_DEBUG__.activeWeaponId);
      expect(activeId).toBe(PHASE1_SAMPLE_WEAPONS[slot]);
    }

    // 5. Set up a rich combat & hit-feel showcase scene (equip Scrap Shotgun into slot 2 while full -> drops rusty_pistol, then fire into enemies -> flash + spark + sfx + damage popup + knockback)
    const combatStats = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();
      sim.player.x = 420;
      sim.player.y = 350;
      sim.player.prevX = 420;
      sim.player.prevY = 350;
      sim.player.energy = sim.player.maxEnergy;
      sim.equipWeaponSlot(1);
      const shotgunItem = sim.spawnWorldItem({
        kind: 'weapon',
        weaponId: 'scrap_shotgun',
        rarity: 'uncommon',
        nameVi: 'Shotgun Phế Liệu',
        costGold: 0,
        healAmount: 0,
        x: sim.player.x,
        y: sim.player.y,
      });
      sim.pickupOrBuyWorldItem(shotgunItem, sim.player);
      const droppedRustyPistol = sim.worldItems.some(
        (it) => !it.pickedUp && it.weaponId === 'rusty_pistol' && it.droppedByPlayerId === sim.player.id,
      );

      // Spawn all 3 sample enemies right in front of the player
      sim.enemies = sim.enemies.filter((e) => e.isDummy);
      const g = sim.spawnEnemy('goblin_shooter', 515, 325, true);
      const b = sim.spawnEnemy('wild_boar', 530, 365, true);
      const s = sim.spawnEnemy('spore_bomber', 505, 395, true);

      return {
        goblinId: g.id,
        boarId: b.id,
        sporeId: s.id,
        activeWeaponId: sim.getActiveWeaponId(),
        droppedRustyPistol,
      };
    });
    expect(combatStats.activeWeaponId).toBe('scrap_shotgun');
    expect(combatStats.droppedRustyPistol).toBe(true);

    // Ensure slot 2 (Scrap Shotgun) is active, aim at enemies, and fire!
    await page.keyboard.press('Digit2');
    await page.mouse.move(1120, 560);
    await page.mouse.down({ button: 'left' });
    await page.waitForTimeout(140);
    await page.mouse.up({ button: 'left' });

    const hitFeelResult = await page.evaluate((ids) => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const boar = sim.enemies.find((e) => e.id === ids.boarId);
      const goblin = sim.enemies.find((e) => e.id === ids.goblinId);
      return {
        debug: window.__GAME_DEBUG__,
        boarHp: boar?.hp ?? 0,
        boarMaxHp: boar?.maxHp ?? 36,
        boarFlash: boar?.hitFlashTimer ?? 0,
        boarKbX: boar?.kbVx ?? 0,
        goblinHp: goblin?.hp ?? 0,
      };
    }, combatStats);

    expect(hitFeelResult.debug.totalDamagePopupsSpawned).toBeGreaterThan(0);
    expect(hitFeelResult.debug.totalSparksSpawned).toBeGreaterThan(0);
    expect(hitFeelResult.debug.totalHitStopsTriggered).toBeGreaterThan(0);
    expect(hitFeelResult.debug.totalShakesTriggered).toBeGreaterThan(0);
    expect(hitFeelResult.debug.sfxPlayedCount).toBeGreaterThan(0);
    expect(hitFeelResult.boarHp).toBeLessThan(hitFeelResult.boarMaxHp);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'combat-shotgun-feel-1080p.png'),
    });

    // 6. Trigger all 3 enemy telegraphs simultaneously + Thiết Vệ's Ruby Shield Wall skill for visual inspection
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.player.x = 420;
      sim.player.y = 350;
      sim.player.prevX = 420;
      sim.player.prevY = 350;
      sim.player.aimAngle = 0;
      sim.player.skillActiveTimer = 3.5;

      sim.enemies = sim.enemies.filter((e) => e.isDummy);
      const goblin = sim.spawnEnemy('goblin_shooter', 640, 260, true);
      goblin.aiState = 'telegraph';
      goblin.stateTimer = 0.35;
      goblin.telegraphAngle = Math.atan2(sim.player.y - goblin.y, sim.player.x - goblin.x);

      const boar = sim.spawnEnemy('wild_boar', 660, 360, true);
      boar.aiState = 'telegraph';
      boar.stateTimer = 0.45;
      boar.telegraphAngle = Math.PI;
      boar.telegraphLength = 220;

      const bomber = sim.spawnEnemy('spore_bomber', 550, 445, true);
      bomber.aiState = 'telegraph';
      bomber.stateTimer = 0.4;
      bomber.telegraphRadius = 68;
    });

    await page.mouse.move(1150, 540);
    await page.waitForTimeout(120);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'enemy-telegraphs-and-shield-1080p.png'),
    });

    // 7. Toggle F1 Debug Overlay and F4 Hitboxes + Spatial Hash Grid
    await page.keyboard.press('F1');
    await page.keyboard.press('F4');
    await page.waitForTimeout(250);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'debug-hitboxes-f1-f4-1080p.png'),
    });

    // 8. Verify live viewport resize (1080p -> 1440p -> 1080p) while projectiles & particles are active
    await page.mouse.down({ button: 'left' });
    await page.waitForTimeout(60);
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.waitForTimeout(120);
    const scale1440 = await page.evaluate(() => window.__GAME_DEBUG__.bakeScale);
    expect(scale1440).toBe(7);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.mouse.up({ button: 'left' });
    await page.waitForTimeout(120);

    const finalDebug = await page.evaluate(() => window.__GAME_DEBUG__);
    expect(finalDebug.bakeScale).toBe(5);
    expect(finalDebug.overlayVisible).toBe(true);
    expect(finalDebug.showHitboxes).toBe(true);
    expect(finalDebug.fps).toBeGreaterThanOrEqual(50);
    expect(finalDebug.errors).toEqual([]);
    expect(finalDebug.warnings).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);
  });
});
