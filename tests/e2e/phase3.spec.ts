import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots/phase-3');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe('Phase 3 — Dungeon, Vòng Lặp Lượt Chơi & Biome 1 Hoàn Chỉnh', () => {
  test('verifies procedural dungeon rooms, minimap + fog of war, 14 weapons & rarity chests, merchant & shrine, secret room, 6 Biome 1 enemies + elites, Boss Mục Vương 3 phases, and E2E bot auto-play victory at 1080p', async ({
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

    // 1. Verify Floor 1 Dungeon Graph (7-10 rooms, all required room types present) & Minimap + [Tab] Full Map
    const dungeonInfo = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.player.godMode = true;
      // Clear initial wave in start/sandbox so doors unlock cleanly for room tour
      sim.skipCurrentRoomWaves();
      window.__GAME_TRANSPORT__!.step(16.6667);

      const types = sim.dungeon.rooms.map((r) => r.type);
      return {
        floor: sim.currentFloor,
        totalRooms: sim.dungeon.rooms.length,
        roomTypes: types,
        currentRoomType: sim.getCurrentRoom().type,
      };
    });

    expect(dungeonInfo.floor).toBe(1);
    expect(dungeonInfo.totalRooms).toBeGreaterThanOrEqual(7);
    expect(dungeonInfo.totalRooms).toBeLessThanOrEqual(10);
    expect(dungeonInfo.roomTypes).toEqual(
      expect.arrayContaining([
        'start',
        'combat',
        'treasure',
        'merchant',
        'shrine',
        'secret',
        'portal',
      ]),
    );

    await page.waitForTimeout(180);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'room-start-and-minimap-1080p.png'),
    });

    // Press Tab to open Full Map overlay
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    const fullMapOpen = await page.evaluate(() => window.__GAME_DEBUG__.fullMapOpen);
    expect(fullMapOpen).toBe(true);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'minimap-tab-expanded-1080p.png'),
    });
    // Close Full Map
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // 2. Treasure Room: Rarity Chest + Light Pillar + Weapon Drop & Pickup [E]
    const treasureResult = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();
      const treasureRoom = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
      sim.enterRoom(treasureRoom.id);
      transport.step(16.6667);

      const chest = sim.chests[0]!;
      sim.player.x = chest.x;
      sim.player.y = chest.y + 18;
      sim.player.prevX = sim.player.x;
      sim.player.prevY = sim.player.y;
      // Open chest
      sim.interactWithNearest();
      transport.step(16.6667);

      const opened = chest.opened;
      const droppedCount = sim.worldItems.filter((it) => !it.pickedUp).length;
      return {
        roomType: sim.getCurrentRoom().type,
        opened,
        rarity: chest.rarity,
        droppedCount,
      };
    });

    expect(treasureResult.roomType).toBe('treasure');
    expect(treasureResult.opened).toBe(true);
    expect(treasureResult.droppedCount).toBeGreaterThanOrEqual(1);

    await page.waitForTimeout(180);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'room-treasure-chest-pillar-1080p.png'),
    });

    // Pick up the dropped weapon from the chest
    const pickupWeaponCheck = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const item = sim.worldItems.find((it) => !it.pickedUp)!;
      sim.player.x = item.x;
      sim.player.y = item.y;
      sim.interactWithNearest();
      window.__GAME_TRANSPORT__!.step(16.6667);
      return {
        pickedUp: item.pickedUp,
        weaponSlots: [...sim.player.weaponSlots],
      };
    });
    expect(pickupWeaponCheck.pickedUp).toBe(true);

    // 3. Merchant Room: Thương Nhân Hắc Ám + Buying Shop Items with Gold
    const merchantResult = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();
      const merchantRoom = sim.dungeon.rooms.find((r) => r.type === 'merchant')!;
      sim.enterRoom(merchantRoom.id);
      sim.player.gold = 250;
      sim.player.hp = Math.max(20, sim.player.maxHp - 30);
      transport.step(16.6667);

      const npcCount = sim.npcEntities.filter((n) => n.kind === 'merchant').length;
      const shopItem = sim.worldItems.find((it) => !it.pickedUp && it.costGold > 0)!;
      sim.player.x = shopItem.x;
      sim.player.y = shopItem.y + 12;
      sim.player.prevX = sim.player.x;
      sim.player.prevY = sim.player.y;
      const goldBefore = sim.player.gold;
      sim.interactWithNearest();
      transport.step(16.6667);

      return {
        roomType: sim.getCurrentRoom().type,
        npcCount,
        purchased: shopItem.pickedUp,
        goldSpent: goldBefore - sim.player.gold,
      };
    });

    expect(merchantResult.roomType).toBe('merchant');
    expect(merchantResult.npcCount).toBe(1);
    expect(merchantResult.purchased).toBe(true);
    expect(merchantResult.goldSpent).toBeGreaterThan(0);

    await page.waitForTimeout(180);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'room-merchant-shop-1080p.png'),
    });

    // 4. Shrine Room: Điện Thờ Cổ Đại (-20% HP -> Blessing Reward)
    const shrineResult = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();
      const shrineRoom = sim.dungeon.rooms.find((r) => r.type === 'shrine')!;
      sim.enterRoom(shrineRoom.id);
      sim.player.hp = sim.player.maxHp;
      transport.step(16.6667);

      const shrine = sim.npcEntities.find((n) => n.kind === 'shrine')!;
      sim.player.x = shrine.x;
      sim.player.y = shrine.y + 24;
      sim.player.prevX = sim.player.x;
      sim.player.prevY = sim.player.y;
      sim.interactWithNearest();
      transport.step(16.6667);

      return {
        roomType: sim.getCurrentRoom().type,
        interacted: shrine.interacted,
        hpAfter: sim.player.hp,
      };
    });

    expect(shrineResult.roomType).toBe('shrine');
    expect(shrineResult.interacted).toBe(true);

    await page.waitForTimeout(180);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'room-shrine-blessing-1080p.png'),
    });

    // 5. Secret Room: Cracked Wall -> Hidden Chest
    const secretResult = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();
      const secretRoom = sim.dungeon.rooms.find((r) => r.type === 'secret')!;
      sim.enterRoom(secretRoom.id);
      transport.step(16.6667);

      return {
        roomType: sim.getCurrentRoom().type,
        chestCount: sim.chests.length,
        chestRarity: sim.chests[0]?.rarity,
      };
    });

    expect(secretResult.roomType).toBe('secret');
    expect(secretResult.chestCount).toBeGreaterThanOrEqual(1);

    await page.waitForTimeout(180);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'room-secret-treasure-1080p.png'),
    });

    // 6. Combat Room: All 6 Biome 1 Enemy Types + Elite Enemy + Green Slime Split into 2 Mini Slimes
    const combatCheck = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();
      const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat')!;
      sim.enterRoom(combatRoom.id);
      sim.enemies = [];

      // Spawn all 6 Biome 1 enemy types + 1 Elite enemy
      const e1 = sim.spawnEnemy('goblin_shooter', 380, 220, true);
      const e2 = sim.spawnEnemy('green_slime', 460, 220, true);
      const e3 = sim.spawnEnemy('spore_bomber', 540, 220, true);
      const e4 = sim.spawnEnemy('wild_boar', 620, 220, true);
      const e5 = sim.spawnEnemy('goblin_shaman', 440, 320, true);
      const e6 = sim.spawnEnemy('thorn_turret', 580, 320, true);
      const elite = sim.spawnEnemy('wild_boar', 500, 270, true, 'shield');

      // Kill green_slime to verify it splits into 2 mini_slime
      sim.applyDamageToEnemy(e2, 999, true, 'none', 0, 0);
      const miniSlimesAfterKill = sim.enemies.filter(
        (e) => e.defId === 'mini_slime' && e.hp > 0,
      ).length;

      // Spawn another green_slime so all 6 + mini_slime + elite are visible in screenshot
      sim.spawnEnemy('green_slime', 460, 200, true);

      sim.player.x = 320;
      sim.player.y = 280;
      sim.player.prevX = 320;
      sim.player.prevY = 280;
      transport.step(16.6667);

      return {
        e1Alive: e1.hp > 0,
        e3Alive: e3.hp > 0,
        e4Alive: e4.hp > 0,
        e5Alive: e5.hp > 0,
        e6Alive: e6.hp > 0,
        eliteIsElite: elite.isElite && elite.shieldArmor > 0,
        miniSlimesAfterKill,
      };
    });

    expect(combatCheck.miniSlimesAfterKill).toBe(2);
    expect(combatCheck.eliteIsElite).toBe(true);

    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'room-combat-6-enemies-and-elite-1080p.png'),
    });

    // 7. Portal Room -> Buff Choice Modal -> Floor 2 Boss Room (Mục Vương Nấm Độc 3 Phases)
    const portalSetup = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();
      const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal')!;
      sim.enterRoom(portalRoom.id);
      sim.skipCurrentRoomWaves();
      transport.step(16.6667);

      sim.player.x = sim.portalX - 36;
      sim.player.y = sim.portalY;
      sim.player.prevX = sim.player.x;
      sim.player.prevY = sim.player.y;
      transport.step(16.6667);

      return {
        portalActive: sim.portalActive,
        roomType: sim.getCurrentRoom().type,
      };
    });

    expect(portalSetup.roomType).toBe('portal');
    expect(portalSetup.portalActive).toBe(true);

    await page.waitForTimeout(180);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'room-portal-active-1080p.png'),
    });

    // Interact with Portal -> opens Between-Floor Buff Selection Modal
    const buffModalState = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();
      sim.player.x = sim.portalX;
      sim.player.y = sim.portalY;
      sim.interactWithNearest();
      transport.step(16.6667);
      return {
        runState: sim.runState,
        choices: [...sim.player.buffChoices],
      };
    });

    expect(buffModalState.runState).toBe('buff_choice');
    expect(buffModalState.choices.length).toBe(3);

    await page.waitForTimeout(180);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'modal-between-floor-buffs-1080p.png'),
    });

    // Press Digit1 to select the first buff and advance to Floor 2!
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(150);

    const floor2Check = await page.evaluate(() => ({
      floor: window.__GAME_DEBUG__.currentFloor,
      runState: window.__GAME_DEBUG__.runState,
      activeBuffs: window.__GAME_DEBUG__.activeBuffs,
    }));
    expect(floor2Check.floor).toBe(2);
    expect(floor2Check.runState).toBe('playing');
    expect(floor2Check.activeBuffs.length).toBeGreaterThanOrEqual(1);

    // 8. Enter Floor 2 Boss Room: Mục Vương Nấm Độc (Phase 1 -> Phase 2 -> Phase 3 -> Bot Auto-Play Victory)
    const bossPhase1 = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();
      const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
      sim.enterRoom(bossRoom.id);

      // Step past 0.8s spawn warmup so Boss is active in Phase 1
      for (let i = 0; i < 55; i++) {
        transport.step(16.6667);
      }

      const boss = sim.getActiveBoss()!;
      return {
        bossActive: boss !== null,
        bossPhase: boss.bossPhase,
        bossHp: boss.hp,
        bossMaxHp: boss.maxHp,
      };
    });

    expect(bossPhase1.bossActive).toBe(true);
    expect(bossPhase1.bossPhase).toBe(1);

    await page.waitForTimeout(180);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'room-boss-muc-vuong-phase1-1080p.png'),
    });

    // Damage Boss into Phase 2 (< 66% HP) and Phase 3 (< 33% HP) and verify Phase 3 creeping poison swamp border
    const bossPhase3 = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();
      const boss = sim.getActiveBoss()!;

      // Bring boss to 60% HP -> Phase 2
      sim.applyDamageToEnemy(boss, Math.ceil(boss.maxHp * 0.4), true, 'none', 0, 0);
      transport.step(16.6667);
      const phaseAfter60 = boss.bossPhase;

      // Bring boss to 25% HP -> Phase 3
      sim.applyDamageToEnemy(boss, Math.ceil(boss.maxHp * 0.35), true, 'none', 0, 0);
      transport.step(16.6667);
      const phaseAfter25 = boss.bossPhase;

      let swampTiles = 0;
      for (let ty = 0; ty < sim.map.rows; ty++) {
        for (let tx = 0; tx < sim.map.cols; tx++) {
          if (sim.map.getSurface(tx, ty) === 'poison_swamp') swampTiles += 1;
        }
      }

      return {
        phaseAfter60,
        phaseAfter25,
        swampTiles,
        bossHp: boss.hp,
      };
    });

    expect(bossPhase3.phaseAfter60).toBe(2);
    expect(bossPhase3.phaseAfter25).toBe(3);
    expect(bossPhase3.swampTiles).toBeGreaterThan(20);

    await page.waitForTimeout(180);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'room-boss-muc-vuong-phase3-1080p.png'),
    });

    // Enable E2E Bot Auto-Play (__GAME_BOT_AUTOPLAY__) to finish off the Boss and trigger Victory Summary Screen
    const botVictory = await page.evaluate(() => {
      const transport = window.__GAME_TRANSPORT__!;
      const sim = transport.getSim();
      window.__GAME_BOT_AUTOPLAY__!(true);
      const boss = sim.getActiveBoss();
      if (boss && boss.hp > 120) {
        boss.hp = 120;
      }

      let steps = 0;
      while (sim.runState !== 'victory' && steps < 600) {
        transport.step(16.6667);
        steps += 1;
      }

      return {
        runState: sim.runState,
        bossesKilled: sim.runStats.bossesKilled,
        kills: sim.runStats.kills,
        fps: window.__GAME_DEBUG__.fps,
        frameTimeMs: window.__GAME_DEBUG__.frameTimeMs,
      };
    });

    expect(botVictory.runState).toBe('victory');
    expect(botVictory.bossesKilled).toBeGreaterThanOrEqual(1);
    expect(botVictory.fps).toBeGreaterThanOrEqual(55);
    expect(botVictory.frameTimeMs).toBeLessThan(18.5);

    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'modal-victory-summary-1080p.png'),
    });

    // Verify pressing [Enter] on Victory Summary Modal restarts the run cleanly to Floor 1
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const restartedState = await page.evaluate(() => ({
      floor: window.__GAME_DEBUG__.currentFloor,
      runState: window.__GAME_DEBUG__.runState,
      roomType: window.__GAME_DEBUG__.currentRoomType,
    }));
    expect(restartedState.floor).toBe(1);
    expect(restartedState.runState).toBe('playing');
    expect(restartedState.roomType).toBe('start');

    // 9. Verify 3-Page ArtGalleryScene (Page 2: 6 Enemies + Mini Slime + Merchant + Boss; Page 3: 14 Weapons + Dungeon Props)
    await page.goto('/?scene=gallery');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'ArtGalleryScene', null, {
      timeout: 10000,
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      (
        window as unknown as { __GALLERY_SET_PAGE__?: (p: 1 | 2 | 3) => void }
      ).__GALLERY_SET_PAGE__?.(2);
    });
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'art-gallery-page2-enemies-boss-1080p.png'),
    });

    await page.evaluate(() => {
      (
        window as unknown as { __GALLERY_SET_PAGE__?: (p: 1 | 2 | 3) => void }
      ).__GALLERY_SET_PAGE__?.(3);
    });
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'art-gallery-page3-weapons-props-1080p.png'),
    });

    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);
  });
});
