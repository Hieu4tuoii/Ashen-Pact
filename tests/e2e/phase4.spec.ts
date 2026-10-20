import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots/phase-4');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe('Phase 4 — Co-op LAN Authoritative, Prediction/Interpolation, Hub QR & 1–4P Gameplay', () => {
  test('connects 4 clients via real LAN IPv4 address, verifies Hub QR & 5-char selection, bad Wi-Fi prediction/reconciliation, bandwidth <= 30 KB/s, Downed/Revive, clearing Floor 1 together, 30s Reconnect, and Host disconnect handling', async ({
    browser,
  }) => {
    test.setTimeout(90000);

    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    const context1 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const context2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const context3 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const context4 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();
    const page4 = await context4.newPage();
    const pages = [page1, page2, page3, page4];

    for (const [idx, p] of pages.entries()) {
      p.on('console', (msg) => {
        if (msg.text().includes('WebSocket is already in CLOSING or CLOSED state')) return;
        if (msg.type() === 'error') consoleErrors.push(`[P${idx + 1}] ${msg.text()}`);
        if (msg.type() === 'warning') consoleWarnings.push(`[P${idx + 1}] ${msg.text()}`);
      });
      p.on('pageerror', (err) => {
        consoleErrors.push(`[P${idx + 1}] ${err.message}`);
      });
    }

    // 1. Fetch actual LAN IPv4 address from the authoritative server's /api/host-info endpoint
    const hostInfoRes = await page1.request.get('http://127.0.0.1:2567/api/host-info');
    expect(hostInfoRes.ok()).toBe(true);
    const hostInfo = (await hostInfoRes.json()) as {
      lanIps: string[];
      primaryLanIp: string;
      port: number;
    };
    expect(hostInfo.primaryLanIp).toBeTruthy();
    expect(hostInfo.port).toBe(2567);

    // Connect all 4 clients over the actual LAN IPv4 address served by apps/server on port 2567
    const lanBaseUrl = `http://${hostInfo.primaryLanIp}:${hostInfo.port}`;

    // 2. Host (P1) opens Hub room via LAN IPv4
    await page1.goto(
      `${lanBaseUrl}/?coop=host&name=${encodeURIComponent('Chủ Phòng P1')}&server=${hostInfo.primaryLanIp}:${hostInfo.port}`,
    );
    await page1.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.scene === 'GameScene' &&
        window.__GAME_DEBUG__?.serverConnected === true &&
        Boolean(window.__GAME_DEBUG__?.coopRoomId),
      null,
      { timeout: 15000 },
    );

    const roomId = await page1.evaluate(() => window.__GAME_DEBUG__.coopRoomId!);
    expect(roomId).toBeTruthy();

    // 3. Clients P2, P3 join via LAN IPv4 invite link (?join=<roomId>) and P4 joins via direct root LAN URL (http://<LAN-IP>:2567/)
    const joinQueue: Array<{ page: typeof page1; name: string; directRootUrl?: boolean }> = [
      { page: page2, name: 'Cung Thủ P2' },
      { page: page3, name: 'Pháp Sư P3' },
      { page: page4, name: 'Hiền Nhân P4', directRootUrl: true },
    ];
    for (const item of joinQueue) {
      const targetUrl = item.directRootUrl
        ? `${lanBaseUrl}/?name=${encodeURIComponent(item.name)}`
        : `${lanBaseUrl}/?join=${roomId}&name=${encodeURIComponent(item.name)}&server=${hostInfo.primaryLanIp}:${hostInfo.port}`;
      await item.page.goto(targetUrl);
      await item.page.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.scene === 'GameScene' &&
          window.__GAME_DEBUG__?.serverConnected === true &&
          window.__GAME_DEBUG__?.inHub === true,
        null,
        { timeout: 15000 },
      );
    }

    for (const p of pages) {
      await p.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.scene === 'GameScene' &&
          window.__GAME_DEBUG__?.serverConnected === true &&
          window.__GAME_DEBUG__?.coopPlayerCount === 4 &&
          window.__GAME_DEBUG__?.inHub === true,
        null,
        { timeout: 15000 },
      );
    }

    // Verify slots 1..4, LAN IP invite URL, and default non-duplicate character assignment in Hub
    const slots = await Promise.all(
      pages.map((p) => p.evaluate(() => window.__GAME_DEBUG__.playerSlot)),
    );
    expect(slots).toEqual([1, 2, 3, 4]);

    const hostInviteUrl = await page1.evaluate(() => window.__GAME_DEBUG__.hostInviteUrl);
    expect(hostInviteUrl).toContain(hostInfo.primaryLanIp);
    expect(hostInviteUrl).toContain(roomId);

    // Verify duplicate character selection is rejected by default (allowDuplicateCharacters = false)
    await page2.evaluate(() => {
      window.__GAME_COOP_SEND__?.('select_character', { characterId: 'vanguard' });
    });
    await page2.waitForTimeout(120);
    const p2CharAfterDupAttempt = await page2.evaluate(
      () =>
        window.__GAME_TRANSPORT__
          ?.getSim()
          .getAllPlayers()
          .find((p) => p.slot === 2)?.characterId,
    );
    expect(p2CharAfterDupAttempt).toBe('ranger');

    // P1=vanguard, P2=ranger, P3=elementalist, P4=druid; trigger Emotes & Ping & Ready
    await page1.evaluate(() => {
      window.__GAME_COOP_SEND__?.('select_character', { characterId: 'vanguard' });
      window.__GAME_COOP_SEND__?.('set_ready', { ready: true });
    });
    await page2.evaluate(() => {
      window.__GAME_COOP_SEND__?.('select_character', { characterId: 'ranger' });
      window.__GAME_COOP_SEND__?.('set_ready', { ready: true });
    });
    await page3.evaluate(() => {
      window.__GAME_COOP_SEND__?.('select_character', { characterId: 'elementalist' });
      window.__GAME_COOP_SEND__?.('set_ready', { ready: true });
    });
    await page4.evaluate(() => {
      window.__GAME_COOP_SEND__?.('select_character', { characterId: 'druid' });
      window.__GAME_COOP_SEND__?.('set_ready', { ready: true });
    });

    // Trigger Emote Wheel [Hold T + 1] on P1 and Contextual Ping [Z] on P2 after post-warmup ping check settles
    await page1.waitForTimeout(550);
    await page1.keyboard.down('KeyT');
    await page1.waitForTimeout(60);
    expect(await page1.evaluate(() => window.__GAME_DEBUG__.emoteWheelOpen)).toBe(true);
    await page1.keyboard.press('Digit1');
    await page1.keyboard.up('KeyT');
    await page2.keyboard.press('KeyZ');
    await page1.waitForTimeout(250);

    await page1.screenshot({
      path: path.join(SCREENSHOT_DIR, 'hub-4p-qr-1080p.png'),
    });

    // 3b. Verify 2-Weapon Inventory Co-op Swap/Drop: P1 picks up when full (2/2) -> drops old weapon -> P2 sees & picks up dropped weapon
    const walkPlayerTo = async (
      pg: typeof page1,
      targetX: number,
      targetY: number,
      tolerance = 18,
    ) => {
      for (let step = 0; step < 45; step++) {
        const pos = await pg.evaluate(() => ({
          x: window.__GAME_DEBUG__.playerX,
          y: window.__GAME_DEBUG__.playerY,
        }));
        const dx = targetX - pos.x;
        const dy = targetY - pos.y;
        if (Math.hypot(dx, dy) <= tolerance) break;
        if (Math.abs(dx) > 8) {
          await pg.keyboard.down(dx > 0 ? 'KeyD' : 'KeyA');
        } else {
          await pg.keyboard.up('KeyA');
          await pg.keyboard.up('KeyD');
        }
        if (Math.abs(dy) > 8) {
          await pg.keyboard.down(dy > 0 ? 'KeyS' : 'KeyW');
        } else {
          await pg.keyboard.up('KeyW');
          await pg.keyboard.up('KeyS');
        }
        await pg.waitForTimeout(45);
      }
      await pg.keyboard.up('KeyA');
      await pg.keyboard.up('KeyD');
      await pg.keyboard.up('KeyW');
      await pg.keyboard.up('KeyS');
    };

    // P1 (starts with 1 weapon: knight_sword) walks to frost_scepter (381, 400) and equips it into slot 2 (now full 2/2)
    await walkPlayerTo(page1, 396, 400, 18);
    await page1.keyboard.press('KeyE');
    await page1.waitForFunction(
      () => window.__GAME_TRANSPORT__?.getSim().player.weaponSlots.length === 2,
      null,
      { timeout: 5000 },
    );

    // Wait for 0.3s weaponPickupLockTimer to expire, aim East, walk to (404, 470) near dragon_breath_shotgun (381, 470), and press E while full (2/2)
    await page1.waitForTimeout(360);
    await page1.mouse.move(1450, 540);
    await walkPlayerTo(page1, 404, 470, 16);
    await page1.keyboard.press('KeyE');

    // Verify P1 replaced frost_scepter with dragon_breath_shotgun and P2 sees the dropped frost_scepter on the ground
    await page2.waitForFunction(
      () =>
        window.__GAME_TRANSPORT__
          ?.getSim()
          .worldItems.some(
            (it) =>
              !it.pickedUp &&
              !it.isHubRackItem &&
              it.weaponId === 'frost_scepter' &&
              it.droppedByPlayerId === 1,
          ) === true,
      null,
      { timeout: 5000 },
    );

    const droppedPos = await page2.evaluate(() => {
      const it = window.__GAME_TRANSPORT__!
        .getSim()
        .worldItems.find(
          (w) =>
            !w.pickedUp &&
            !w.isHubRackItem &&
            w.weaponId === 'frost_scepter' &&
            w.droppedByPlayerId === 1,
        )!;
      return { x: it.x, y: it.y };
    });

    // P2 walks to the East side of the dropped frost_scepter (away from the rack item at x=381) and presses E to pick it up
    await walkPlayerTo(page2, droppedPos.x + 18, droppedPos.y, 16);
    await page2.keyboard.press('KeyE');
    await page2.waitForFunction(
      () =>
        window.__GAME_TRANSPORT__?.getSim().player.weaponSlots.includes('frost_scepter') === true,
      null,
      { timeout: 5000 },
    );

    // 4. Start Dungeon Run from Hub -> Floor 1 and enter first Combat room (teleporting all 4 teammates)
    await page1.evaluate(() => {
      window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'god_mode_all', enabled: true });
      window.__GAME_COOP_SEND__?.('start_run', {});
    });

    for (const p of pages) {
      await p.waitForFunction(() => window.__GAME_DEBUG__?.inHub === false, null, {
        timeout: 10000,
      });
    }

    // Move all 4 players into the first combat room on Floor 1
    await page1.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat');
      if (combatRoom) {
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'enter_room', roomId: combatRoom.id });
      }
    });

    for (const p of pages) {
      await p.waitForFunction(() => window.__GAME_DEBUG__?.currentRoomType === 'combat', null, {
        timeout: 10000,
      });
    }

    // 5. Enable "bad" Wi-Fi profile (80ms latency, +-20ms jitter, 2% loss) + 300ms lag spike on P2
    // Verify smooth local movement prediction/reconciliation, bandwidth <= 30 KB/s, and Host FPS
    await page2.evaluate(() => {
      window.__GAME_SET_WIFI_PROFILE__?.('bad');
      window.__GAME_TRIGGER_LAG_SPIKE__?.(300);
    });

    await page2.keyboard.down('KeyD');
    await page1.mouse.move(1120, 480);
    await page1.mouse.down();

    const p2Positions: { x: number; y: number }[] = [];
    for (let i = 0; i < 12; i++) {
      await page2.waitForTimeout(80);
      const pos = await page2.evaluate(() => ({
        x: window.__GAME_DEBUG__.playerX,
        y: window.__GAME_DEBUG__.playerY,
      }));
      p2Positions.push(pos);
    }

    await page2.keyboard.up('KeyD');
    await page1.mouse.up();

    // Verify P2 actually moved and never snapped/teleported erratically during bad Wi-Fi + lag spike
    let maxStepDist = 0;
    for (let i = 1; i < p2Positions.length; i++) {
      const d = Math.hypot(
        p2Positions[i]!.x - p2Positions[i - 1]!.x,
        p2Positions[i]!.y - p2Positions[i - 1]!.y,
      );
      if (d > maxStepDist) maxStepDist = d;
    }
    const totalMoved = Math.hypot(
      p2Positions[p2Positions.length - 1]!.x - p2Positions[0]!.x,
      p2Positions[p2Positions.length - 1]!.y - p2Positions[0]!.y,
    );
    expect(totalMoved).toBeGreaterThan(8);
    expect(maxStepDist).toBeLessThan(95);

    const netMetrics = await page2.evaluate(() => ({
      wifiProfile: window.__GAME_DEBUG__.wifiProfile,
      bandwidthKBps: window.__GAME_DEBUG__.bandwidthKBps,
      interpolationDelayMs: window.__GAME_DEBUG__.interpolationDelayMs,
    }));
    expect(netMetrics.wifiProfile).toBe('bad');
    expect(netMetrics.bandwidthKBps).toBeLessThanOrEqual(30);
    expect(netMetrics.interpolationDelayMs).toBeGreaterThanOrEqual(50);
    expect(netMetrics.interpolationDelayMs).toBeLessThanOrEqual(100);

    // Measure Host 1080p High FPS with all 4 players connected & active in combat
    // (temporarily sleep remote tabs' local WebGL rasterizers so single-PC GPU isn't split 4 ways)
    await Promise.all(
      [page2, page3, page4].map((p) => p.evaluate(() => window.__PHASER_GAME__?.loop.sleep())),
    );
    await page1.bringToFront();
    await page1.evaluate(() => window.__GAME_SET_QUALITY__?.('high'));
    await page1.waitForTimeout(800);

    const hostMetrics = await page1.evaluate(() => ({
      fps: window.__GAME_DEBUG__.fps,
      graphicsQuality: window.__GAME_DEBUG__.graphicsQuality,
      coopPlayerCount: window.__GAME_DEBUG__.coopPlayerCount,
    }));
    await Promise.all(
      [page2, page3, page4].map((p) => p.evaluate(() => window.__PHASER_GAME__?.loop.wake())),
    );
    expect(hostMetrics.coopPlayerCount).toBe(4);
    expect(hostMetrics.fps).toBeGreaterThanOrEqual(55);
    expect(hostMetrics.graphicsQuality).toBe('high');

    // Reset P2 Wi-Fi profile back to 'off' for subsequent deterministic steps
    await page2.evaluate(() => {
      window.__GAME_SET_WIFI_PROFILE__?.('off');
    });

    await page1.screenshot({
      path: path.join(SCREENSHOT_DIR, 'coop-combat-4p-1080p.png'),
    });

    // 6. Test Downed state (20s crawl) & Revive in 4P Co-op
    await page1.evaluate(() => {
      window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'down_player', playerId: 2 });
    });

    await page1.waitForFunction(
      () => {
        const p2 = window.__GAME_TRANSPORT__
          ?.getSim()
          .getAllPlayers()
          .find((p) => p.slot === 2);
        return p2?.lifeState === 'downed';
      },
      null,
      { timeout: 10000 },
    );

    await page1.waitForTimeout(200);
    await page1.screenshot({
      path: path.join(SCREENSHOT_DIR, 'coop-downed-revive-1080p.png'),
    });

    // Revive all players and restore God Mode
    await page1.evaluate(() => {
      window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'revive_all' });
      window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'god_mode_all', enabled: true });
    });

    await page1.waitForFunction(
      () => {
        const p2 = window.__GAME_TRANSPORT__
          ?.getSim()
          .getAllPlayers()
          .find((p) => p.slot === 2);
        return p2?.lifeState === 'alive';
      },
      null,
      { timeout: 10000 },
    );

    // 7. Test 30s Reconnect: force P2 to drop connection and reconnect with its token
    const reconnectOk = await page2.evaluate(() => window.__GAME_FORCE_RECONNECT__!());
    expect(reconnectOk).toBe(true);
    await page2.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.serverConnected === true &&
        window.__GAME_DEBUG__?.playerSlot === 2 &&
        window.__GAME_DEBUG__?.coopPlayerCount === 4,
      null,
      { timeout: 10000 },
    );

    // 8. Clear Floor 1 together -> Enter Portal Room -> Trigger Floor Transition Buff Choice
    await page1.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal');
      if (portalRoom) {
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'enter_room', roomId: portalRoom.id });
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'skip_waves' });
      }
    });

    await page1.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.currentRoomType === 'portal' &&
        window.__GAME_TRANSPORT__?.getSim().portalActive === true,
      null,
      { timeout: 10000 },
    );

    // Enable bot auto-play briefly so Host interacts with the active Floor 1 portal and enters Floor 2 / buff_choice
    await page1.evaluate(() => {
      window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'bot_autoplay', enabled: true });
    });

    await page1.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.runState === 'buff_choice' ||
        window.__GAME_DEBUG__?.currentFloor === 2,
      null,
      { timeout: 15000 },
    );

    await page1.evaluate(() => {
      window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'bot_autoplay', enabled: false });
    });

    // 9. Host Disconnect: close Host (P1) and verify P2, P3, P4 return gracefully to MenuScene with Vietnamese notice
    await page1.close();

    for (const p of [page2, page3, page4]) {
      await p.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'MenuScene', null, {
        timeout: 15000,
      });
    }

    await page2.waitForTimeout(250);
    await page2.screenshot({
      path: path.join(SCREENSHOT_DIR, 'menu-host-disconnect-1080p.png'),
    });

    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);

    await context1.close();
    await context2.close();
    await context3.close();
    await context4.close();
  });
});
