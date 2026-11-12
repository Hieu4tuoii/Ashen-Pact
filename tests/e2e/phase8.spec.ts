import { chromium, expect, test } from '@playwright/test';
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { packageRelease } from '../../tools/package-release.js';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots/phase-8');
const POLISH_P1_AFTER_DIR = path.resolve(process.cwd(), 'docs/screenshots/polish-p1/after');
const RELEASE_DIR = path.resolve(process.cwd(), 'release/AshenPact-v2.0.0-win-x64');
const RELEASE_EXE = path.join(RELEASE_DIR, 'AshenPact-Host.exe');
const RELEASE_ZIP = path.resolve(process.cwd(), 'release/AshenPact-v2.0.0-win-x64.zip');
const RELEASE_PORT = 2578;
const NO_DEBUG_PORT = RELEASE_PORT + 1;

test.describe.configure({ timeout: 120000 });

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(POLISH_P1_AFTER_DIR, { recursive: true });
  packageRelease({ skipBuild: false });
});

test.describe('Phase 8 — Standalone Windows Release Package (v2.0.0), Real LAN IP Co-op & Cross-Browser Verification', () => {
  test('stages AshenPact-v2.0.0-win-x64 into a clean path with spaces & Vietnamese Unicode, launches AshenPact-Host.exe with --debug, connects Chromium + Edge over real LAN IPv4, and verifies full Co-op Dungeon + Boss Victory stats', async ({
    browser,
  }) => {
    test.setTimeout(90000);

    expect(fs.existsSync(RELEASE_ZIP)).toBe(true);
    const zipStat = fs.statSync(RELEASE_ZIP);
    expect(zipStat.size).toBeGreaterThan(10 * 1024 * 1024);
    const zipFd = fs.openSync(RELEASE_ZIP, 'r');
    const pkHeader = Buffer.alloc(4);
    fs.readSync(zipFd, pkHeader, 0, 4, 0);
    fs.closeSync(zipFd);
    expect(pkHeader[0]).toBe(0x50); // 'P'
    expect(pkHeader[1]).toBe(0x4b); // 'K'

    expect(fs.existsSync(RELEASE_EXE)).toBe(true);
    expect(fs.existsSync(path.join(RELEASE_DIR, 'runtime/node.exe'))).toBe(true);
    expect(fs.existsSync(path.join(RELEASE_DIR, 'server-bundle.cjs'))).toBe(true);
    expect(fs.existsSync(path.join(RELEASE_DIR, 'start-host.bat'))).toBe(true);
    expect(fs.existsSync(path.join(RELEASE_DIR, 'start-host-debug.bat'))).toBe(true);
    expect(fs.existsSync(path.join(RELEASE_DIR, 'allow-firewall-port-2567.bat'))).toBe(true);
    expect(fs.existsSync(path.join(RELEASE_DIR, 'client/index.html'))).toBe(true);

    // 1. Spawn standalone AshenPact-Host.exe with --debug from the clean release directory
    let hostProc: ChildProcessWithoutNullStreams | null = null;
    let consoleStdout = '';

    try {
      hostProc = spawn(RELEASE_EXE, ['--port', String(RELEASE_PORT), '--debug'], {
        cwd: RELEASE_DIR,
        env: {
          ...process.env,
          ASHEN_PACT_NO_OPEN_BROWSER: '1',
          ASHEN_PACT_NO_FIREWALL_PROMPT: '1',
        },
      });

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(
            new Error(`Timeout waiting for AshenPact-Host.exe stdout. Got:\n${consoleStdout}`),
          );
        }, 12000);

        hostProc!.stdout.on('data', (chunk: Buffer) => {
          consoleStdout += chunk.toString('utf8');
          if (
            consoleStdout.includes('MỜI BẠN BÈ CÙNG WI-FI / LAN') &&
            consoleStdout.includes('█')
          ) {
            clearTimeout(timer);
            resolve();
          }
        });

        hostProc!.once('exit', (code) => {
          clearTimeout(timer);
          reject(new Error(`AshenPact-Host.exe exited prematurely with code ${code}`));
        });
      });

      // Verify console banner printed LAN IP and Unicode half-block QR Code
      expect(consoleStdout).toContain('ASHEN PACT v2.0.0');
      expect(consoleStdout).toContain(`:${RELEASE_PORT}`);
      expect(consoleStdout).toContain('█');
      expect(consoleStdout).toContain('▀');

      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];

      // 3. Launch Host in Chromium and Client 2 in Microsoft Edge (cross-browser verification!)
      const hostContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      let edgeBrowser = null;
      try {
        edgeBrowser = await chromium.launch({
          channel: 'msedge',
          args: [
            '--use-gl=angle',
            '--use-angle=d3d11',
            '--enable-webgl',
            '--ignore-gpu-blocklist',
          ],
        });
      } catch {
        // Fallback if msedge channel is unavailable on a headless runner
        edgeBrowser = null;
      }
      const client2Context = await (edgeBrowser ?? browser).newContext({
        viewport: { width: 1920, height: 1080 },
      });

      const pageHost = await hostContext.newPage();
      const pageClient2 = await client2Context.newPage();
      const pages = [pageHost, pageClient2];

      for (const [idx, p] of pages.entries()) {
        p.on('console', (msg) => {
          if (msg.text().includes('GPU stall due to ReadPixels')) return;
          if (msg.type() === 'error') consoleErrors.push(`[P${idx + 1}] ${msg.text()}`);
          if (msg.type() === 'warning') consoleWarnings.push(`[P${idx + 1}] ${msg.text()}`);
        });
        p.on('pageerror', (err) => {
          consoleErrors.push(`[P${idx + 1}] ${err.message}`);
        });
      }

      // 4. Query /api/host-info from the standalone release server to obtain the machine's real LAN IPv4
      const hostInfoRes = await pageHost.request.get(
        `http://127.0.0.1:${RELEASE_PORT}/api/host-info`,
      );
      expect(hostInfoRes.ok()).toBe(true);
      const hostInfo = (await hostInfoRes.json()) as {
        version: string;
        primaryLanIp: string;
        port: number;
        debugAllowed: boolean;
      };
      expect(hostInfo.version).toBe('2.0.0');
      expect(hostInfo.port).toBe(RELEASE_PORT);
      expect(hostInfo.debugAllowed).toBe(true);
      expect(hostInfo.primaryLanIp).toBeTruthy();

      const lanBaseUrl = `http://${hostInfo.primaryLanIp}:${hostInfo.port}`;

      // 5. Connect Host (P1) and Client 2 (P2 - MS Edge) over the real LAN IPv4 address with &debug=1
      await pageHost.goto(
        `${lanBaseUrl}/?coop=host&debug=1&name=${encodeURIComponent('Chủ Phòng v0.2')}&server=${hostInfo.primaryLanIp}:${hostInfo.port}`,
      );
      await pageHost.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.scene === 'GameScene' &&
          window.__GAME_DEBUG__?.serverConnected === true &&
          window.__GAME_DEBUG__?.inHub === true,
        null,
        { timeout: 15000 },
      );

      await pageClient2.goto(`${lanBaseUrl}/?coop=join&name=${encodeURIComponent('Đồng Đội Edge P2')}&debug=1`);
      for (const p of pages) {
        await p.waitForFunction(
          () =>
            window.__GAME_DEBUG__?.scene === 'GameScene' &&
            window.__GAME_DEBUG__?.serverConnected === true &&
            window.__GAME_DEBUG__?.coopPlayerCount === 2 &&
            window.__GAME_DEBUG__?.inHub === true,
          null,
          { timeout: 15000 },
        );
      }

      // Select Elementalist (P1) + Engineer (P2) and set Ready in Hub
      await pageHost.evaluate(() => {
        window.__GAME_COOP_SEND__?.('select_character', { characterId: 'elementalist' });
        window.__GAME_COOP_SEND__?.('set_ready', { ready: true });
      });
      await pageClient2.evaluate(() => {
        window.__GAME_COOP_SEND__?.('select_character', { characterId: 'engineer' });
        window.__GAME_COOP_SEND__?.('set_ready', { ready: true });
      });
      await pageHost.waitForTimeout(400);

      // Verify custom display names with " P" were preserved after character selection
      const hubPlayerNames = await pageHost.evaluate(() =>
        window.__GAME_TRANSPORT__!.getSim().getAllPlayers().map((pl) => pl.displayName),
      );
      expect(hubPlayerNames).toEqual(['Chủ Phòng v0.2', 'Đồng Đội Edge P2']);

      await pageHost.screenshot({
        path: path.join(SCREENSHOT_DIR, 'release-hub-lan-coop-1080p.png'),
      });

      // 6. Start Dungeon Run from Hub -> Floor 1 -> Enter Combat Room & fight
      await pageHost.evaluate(() => {
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'god_mode_all', enabled: true });
        window.__GAME_COOP_SEND__?.('start_run', {});
      });

      for (const p of pages) {
        await p.waitForFunction(() => window.__GAME_DEBUG__?.inHub === false, null, {
          timeout: 10000,
        });
      }

      await pageHost.evaluate(() => {
        const sim = window.__GAME_TRANSPORT__!.getSim();
        const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat');
        if (combatRoom) {
          window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'enter_room', roomId: combatRoom.id });
        }
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'bot_autoplay', enabled: true });
      });

      await pageHost.waitForFunction(
        () => window.__GAME_DEBUG__?.currentRoomType === 'combat',
        null,
        { timeout: 10000 },
      );
      await pageHost.waitForTimeout(1200);

      await pageHost.screenshot({
        path: path.join(SCREENSHOT_DIR, 'release-dungeon-combat-1080p.png'),
      });

      // Toggle F1 debug overlay on and capture release-debug-on.png for Phase P1 visual verification
      await pageHost.keyboard.press('F1');
      await pageHost.waitForFunction(() => window.__GAME_DEBUG__?.overlayVisible === true, null, {
        timeout: 5000,
      });
      await pageHost.screenshot({
        path: path.join(POLISH_P1_AFTER_DIR, 'release-debug-on.png'),
      });
      await pageHost.keyboard.press('F1');

      // Clear Combat room & Portal room on Floor 1 -> Advance to Floor 6 Boss Room -> Defeat Boss!
      await pageHost.evaluate(() => {
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'skip_waves' });
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'advance_floor', floor: 6 });
      });

      await pageHost.waitForFunction(() => window.__GAME_DEBUG__?.currentFloor === 6, null, {
        timeout: 10000,
      });

      await pageHost.evaluate(() => {
        const sim = window.__GAME_TRANSPORT__!.getSim();
        const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss');
        if (bossRoom) {
          window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'enter_room', roomId: bossRoom.id });
        }
      });

      await pageHost.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.currentRoomType === 'boss' &&
          window.__GAME_DEBUG__?.bossActive === true,
        null,
        { timeout: 10000 },
      );
      await pageHost.waitForTimeout(800);

      // Defeat Boss to complete the run from the standalone release build
      await pageHost.evaluate(() => {
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'skip_waves' });
      });

      for (const p of pages) {
        await p.waitForFunction(() => window.__GAME_DEBUG__?.runState === 'victory', null, {
          timeout: 10000,
        });
      }

      // Sleep secondary browser loop briefly to measure clean single-GPU Host FPS
      await pageClient2.evaluate(() => window.__PHASER_GAME__?.loop.sleep());
      await pageHost.bringToFront();
      await pageHost.waitForTimeout(600);

      const finalMetrics = await pageHost.evaluate(() => {
        const sim = window.__GAME_TRANSPORT__!.getSim();
        return {
          fps: window.__GAME_DEBUG__.fps,
          runState: window.__GAME_DEBUG__.runState,
          coopPlayerCount: window.__GAME_DEBUG__.coopPlayerCount,
          runStats: { ...sim.runStats },
          players: sim.getAllPlayers().map((pl) => ({
            displayName: pl.displayName,
            damageDealt: pl.statsDamageDealt,
            kills: pl.statsKills,
            elementalReactions: pl.statsElementalReactions,
          })),
          mvpAwards: sim.computeMvpAwards(),
        };
      });

      expect(finalMetrics.runState).toBe('victory');
      expect(finalMetrics.coopPlayerCount).toBe(2);
      expect(finalMetrics.fps).toBeGreaterThanOrEqual(55);
      // Verify Victory screen runStats and MVP awards are synchronized and non-zero!
      expect(finalMetrics.runStats.kills).toBeGreaterThan(0);
      expect(finalMetrics.runStats.damageDealt).toBeGreaterThan(0);
      expect(finalMetrics.runStats.bossesKilled).toBeGreaterThanOrEqual(1);
      expect(finalMetrics.runStats.roomsCleared).toBeGreaterThanOrEqual(2);
      expect(finalMetrics.players.map((p) => p.displayName)).toEqual([
        'Chủ Phòng v0.2',
        'Đồng Đội Edge P2',
      ]);
      expect(finalMetrics.players.reduce((sum, p) => sum + p.damageDealt, 0)).toBeGreaterThan(0);
      expect(finalMetrics.mvpAwards.length).toBe(4);
      expect(
        finalMetrics.mvpAwards.find((a) => a.category === 'damage')?.value ?? 0,
      ).toBeGreaterThan(0);

      await pageHost.screenshot({
        path: path.join(SCREENSHOT_DIR, 'release-boss-victory-1080p.png'),
      });

      // Wake Client 2 and verify [H] Về Doanh Trại (return_to_hub) synchronizes both players back to Hub
      await pageClient2.evaluate(() => window.__PHASER_GAME__?.loop.wake());
      await pageHost.evaluate(() => {
        window.__GAME_COOP_SEND__?.('return_to_hub', {});
      });
      for (const p of pages) {
        await p.waitForFunction(
          () =>
            window.__GAME_DEBUG__?.inHub === true && window.__GAME_DEBUG__?.runState === 'playing',
          null,
          { timeout: 10000 },
        );
      }

      expect(consoleErrors).toEqual([]);
      expect(consoleWarnings).toEqual([]);

      await hostContext.close();
      await client2Context.close();
      if (edgeBrowser) {
        await edgeBrowser.close();
      }
    } finally {
      if (hostProc && !hostProc.killed) {
        hostProc.kill();
      }
    }
  });

  test('verifies standalone release default mode (without --debug) hides all debug UI/hooks, enforces read-only __GAME_DEBUG__, and rejects debug commands on the server', async ({
    browser,
  }) => {
    test.setTimeout(90000);

    let hostProc: ChildProcessWithoutNullStreams | null = null;
    let consoleStdout = '';
    let consoleStderr = '';

    const cleanEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ASHEN_PACT_NO_OPEN_BROWSER: '1',
      ASHEN_PACT_NO_FIREWALL_PROMPT: '1',
    };
    delete cleanEnv.ASHEN_PACT_DEBUG;

    try {
      hostProc = spawn(RELEASE_EXE, ['--port', String(NO_DEBUG_PORT)], {
        cwd: RELEASE_DIR,
        env: cleanEnv,
      });

      hostProc.stderr.on('data', (chunk: Buffer) => {
        consoleStderr += chunk.toString('utf8');
      });

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(
            new Error(
              `Timeout waiting for default AshenPact-Host.exe stdout. Got:\n${consoleStdout}`,
            ),
          );
        }, 12000);

        hostProc!.stdout.on('data', (chunk: Buffer) => {
          consoleStdout += chunk.toString('utf8');
          if (
            consoleStdout.includes('MỜI BẠN BÈ CÙNG WI-FI / LAN') &&
            consoleStdout.includes('█')
          ) {
            clearTimeout(timer);
            resolve();
          }
        });

        hostProc!.once('exit', (code) => {
          clearTimeout(timer);
          reject(new Error(`Default AshenPact-Host.exe exited prematurely with code ${code}`));
        });
      });

      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];

      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();
      page.on('console', (msg) => {
        if (msg.text().includes('GPU stall due to ReadPixels')) return;
        if (msg.type() === 'error') consoleErrors.push(msg.text());
        if (msg.type() === 'warning') consoleWarnings.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      // 1. Verify /api/host-info reports debugAllowed: false
      const hostInfoRes = await page.request.get(
        `http://127.0.0.1:${NO_DEBUG_PORT}/api/host-info`,
      );
      expect(hostInfoRes.ok()).toBe(true);
      const hostInfo = (await hostInfoRes.json()) as {
        primaryLanIp: string;
        port: number;
        debugAllowed: boolean;
      };
      expect(hostInfo.port).toBe(NO_DEBUG_PORT);
      expect(hostInfo.debugAllowed).toBe(false);

      const noDebugBaseUrl = `http://${hostInfo.primaryLanIp}:${hostInfo.port}`;

      // 2. Verify Sanctuary Lobby in default release mode hides debug overlay, test hooks, and Gallery/Anim debug pills, and redirects ?scene=gallery
      await page.goto(`${noDebugBaseUrl}/?scene=menu`);
      await page.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.scene === 'GameScene' &&
          window.__GAME_DEBUG__?.inHub === true &&
          window.__GAME_DEBUG__?.fontsLoaded === true,
        null,
        { timeout: 15000 },
      );
      await page.waitForTimeout(300);

      const menuReleaseDebugCheck = await page.evaluate(() => ({
        overlayVisible: window.__GAME_DEBUG__.overlayVisible,
        godMode: window.__GAME_DEBUG__.godMode,
        animState: window.__GAME_DEBUG__.animState,
        hasPhaserGame: typeof window.__PHASER_GAME__ !== 'undefined',
        hasTransport: typeof window.__GAME_TRANSPORT__ !== 'undefined',
        hasCoopSend: typeof window.__GAME_COOP_SEND__ !== 'undefined',
        hasStressTest: typeof window.__GAME_STRESS_TEST__ !== 'undefined',
      }));
      expect(menuReleaseDebugCheck).toEqual({
        overlayVisible: false,
        godMode: false,
        animState: 'idle',
        hasPhaserGame: false,
        hasTransport: false,
        hasCoopSend: false,
        hasStressTest: false,
      });

      // Verify F1/F2 hotkeys and debug-only Gallery (1208, 108) / Anim (1288, 108) pill coordinates are inactive/hidden on /?scene=menu
      await page.keyboard.press('F1');
      await page.keyboard.press('F2');
      await page.mouse.click(1208, 108);
      await page.mouse.click(1288, 108);
      await page.waitForTimeout(150);

      const menuAfterDebugProbe = await page.evaluate(() => ({
        scene: window.__GAME_DEBUG__.scene,
        inHub: window.__GAME_DEBUG__.inHub,
        overlayVisible: window.__GAME_DEBUG__.overlayVisible,
        godMode: window.__GAME_DEBUG__.godMode,
        animState: window.__GAME_DEBUG__.animState,
      }));
      expect(menuAfterDebugProbe).toEqual({
        scene: 'GameScene',
        inHub: true,
        overlayVisible: false,
        godMode: false,
        animState: 'idle',
      });

      await page.screenshot({
        path: path.join(POLISH_P1_AFTER_DIR, 'release-menu-no-debug.png'),
      });

      await page.goto(`${noDebugBaseUrl}/?scene=gallery`);
      await page.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.scene === 'GameScene' &&
          window.__GAME_DEBUG__?.inHub === true,
        null,
        { timeout: 10000 },
      );
      const galleryRedirectCheck = await page.evaluate(() => ({
        overlayVisible: window.__GAME_DEBUG__.overlayVisible,
        hasPhaserGame: typeof window.__PHASER_GAME__ !== 'undefined',
      }));
      expect(galleryRedirectCheck).toEqual({
        overlayVisible: false,
        hasPhaserGame: false,
      });

      // 3. Open Host Co-op Hub in default release mode (without ?debug=1)
      await page.goto(
        `${noDebugBaseUrl}/?coop=host&name=HostRelease&server=${hostInfo.primaryLanIp}:${hostInfo.port}`,
      );
      await page.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.scene === 'GameScene' &&
          window.__GAME_DEBUG__?.serverConnected === true &&
          window.__GAME_DEBUG__?.inHub === true,
        null,
        { timeout: 15000 },
      );

      // 4. Verify all test hooks on window are undefined in default release mode
      const hooksCheck = await page.evaluate(() => ({
        hasTransport: typeof window.__GAME_TRANSPORT__ !== 'undefined',
        hasCoopSend: typeof window.__GAME_COOP_SEND__ !== 'undefined',
        hasStressTest: typeof window.__GAME_STRESS_TEST__ !== 'undefined',
        hasPhaserGame: typeof window.__PHASER_GAME__ !== 'undefined',
      }));
      expect(hooksCheck).toEqual({
        hasTransport: false,
        hasCoopSend: false,
        hasStressTest: false,
        hasPhaserGame: false,
      });

      // 5. Verify window.__GAME_DEBUG__ is a read-only Proxy
      const readOnlyCheck = await page.evaluate(() => {
        try {
          (window.__GAME_DEBUG__ as unknown as { godMode: boolean }).godMode = true;
        } catch {
          // Expected TypeError in strict mode when Proxy set trap returns false
        }
        return {
          godMode: window.__GAME_DEBUG__.godMode,
          overlayVisible: window.__GAME_DEBUG__.overlayVisible,
        };
      });
      expect(readOnlyCheck.godMode).toBe(false);
      expect(readOnlyCheck.overlayVisible).toBe(false);

      // 6. Verify pressing F1, F2, G, R does nothing when debug mode is disabled
      await page.keyboard.press('F1');
      await page.keyboard.press('F2');
      await page.keyboard.press('KeyG');
      await page.keyboard.press('KeyR');
      await page.waitForTimeout(200);

      const afterKeysCheck = await page.evaluate(() => ({
        overlayVisible: window.__GAME_DEBUG__.overlayVisible,
        godMode: window.__GAME_DEBUG__.godMode,
        activeImbueElement: window.__GAME_DEBUG__.activeImbueElement,
      }));
      expect(afterKeysCheck).toEqual({
        overlayVisible: false,
        godMode: false,
        activeImbueElement: 'none',
      });

      await page.screenshot({
        path: path.join(POLISH_P1_AFTER_DIR, 'release-default-no-debug.png'),
      });

      // 7. Verify server rejects debug_cmd and set_god_mode even if a client forces ?debug=1 on URL
      const attackerPage = await context.newPage();
      attackerPage.on('console', (msg) => {
        if (msg.text().includes('GPU stall due to ReadPixels')) return;
        if (msg.type() === 'error') consoleErrors.push(`[Attacker] ${msg.text()}`);
        if (msg.type() === 'warning') consoleWarnings.push(`[Attacker] ${msg.text()}`);
      });
      attackerPage.on('pageerror', (err) => {
        consoleErrors.push(`[Attacker] ${err.message}`);
      });

      await attackerPage.goto(
        `${noDebugBaseUrl}/?coop=join&debug=1&name=Attacker&server=${hostInfo.primaryLanIp}:${hostInfo.port}`,
      );
      await attackerPage.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.scene === 'GameScene' &&
          window.__GAME_DEBUG__?.serverConnected === true &&
          window.__GAME_DEBUG__?.coopPlayerCount === 2,
        null,
        { timeout: 15000 },
      );

      // Even with ?debug=1 in URL, co-op effective debug UI & F1/F2 hotkeys remain off because serverDebugAllowed is false
      await attackerPage.keyboard.press('F1');
      await attackerPage.keyboard.press('F2');
      await attackerPage.waitForTimeout(150);
      expect(await attackerPage.evaluate(() => window.__GAME_DEBUG__.overlayVisible)).toBe(false);
      expect(await attackerPage.evaluate(() => window.__GAME_DEBUG__.godMode)).toBe(false);

      // Attempt sending set_god_mode and debug_cmd directly to the server
      await attackerPage.evaluate(() => {
        window.__GAME_COOP_SEND__?.('set_god_mode', { godMode: true });
      });
      await attackerPage.waitForFunction(
        () => window.__GAME_DEBUG__?.lastDebugRejected === 'set_god_mode',
        null,
        { timeout: 5000 },
      );

      await attackerPage.evaluate(() => {
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'god_mode_all', enabled: true });
      });
      await attackerPage.waitForFunction(
        () => window.__GAME_DEBUG__?.lastDebugRejected === 'debug_cmd',
        null,
        { timeout: 5000 },
      );

      expect(await page.evaluate(() => window.__GAME_DEBUG__.godMode)).toBe(false);
      expect(await attackerPage.evaluate(() => window.__GAME_DEBUG__.godMode)).toBe(false);

      const combinedServerLogs = `${consoleStdout}\n${consoleStderr}`;
      expect(combinedServerLogs).toContain('[CoopRoom] Ignored debug command "set_god_mode"');
      expect(combinedServerLogs).toContain('[CoopRoom] Ignored debug command "debug_cmd"');

      expect(consoleErrors).toEqual([]);
      expect(consoleWarnings).toEqual([]);

      await context.close();
    } finally {
      if (hostProc && !hostProc.killed) {
        hostProc.kill();
      }
    }
  });
});
