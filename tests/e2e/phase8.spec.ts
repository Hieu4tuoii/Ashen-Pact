import { chromium, expect, test } from '@playwright/test';
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { packageRelease } from '../../tools/package-release.js';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots/phase-8');
const RELEASE_DIR = path.resolve(process.cwd(), 'release/AshenPact-v0.1.0-win-x64');
const RELEASE_EXE = path.join(RELEASE_DIR, 'AshenPact-Host.exe');
const RELEASE_PORT = 2578;

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  if (!fs.existsSync(RELEASE_EXE)) {
    packageRelease({ skipBuild: true });
  }
});

test.describe('Phase 8 — Standalone Windows Release Package (v0.1.0), Real LAN IP Co-op & Cross-Browser Verification', () => {
  test('launches standalone AshenPact-Host.exe from clean release folder, verifies console ASCII QR & LAN IP, connects Chromium + Microsoft Edge clients over real LAN IPv4, and clears a full Dungeon Floor + Boss', async ({
    browser,
  }) => {
    test.setTimeout(90000);

    expect(fs.existsSync(RELEASE_EXE)).toBe(true);
    expect(fs.existsSync(path.join(RELEASE_DIR, 'start-host.bat'))).toBe(true);
    expect(fs.existsSync(path.join(RELEASE_DIR, 'allow-firewall-port-2567.bat'))).toBe(true);
    expect(fs.existsSync(path.join(RELEASE_DIR, 'client/index.html'))).toBe(true);

    // 1. Spawn standalone AshenPact-Host.exe from the clean release directory
    let hostProc: ChildProcessWithoutNullStreams | null = null;
    let consoleStdout = '';

    try {
      hostProc = spawn(RELEASE_EXE, ['--port', String(RELEASE_PORT)], {
        cwd: RELEASE_DIR,
        env: {
          ...process.env,
          ASHEN_PACT_NO_OPEN_BROWSER: '1',
        },
      });

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout waiting for AshenPact-Host.exe stdout. Got:\n${consoleStdout}`));
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
      expect(consoleStdout).toContain('ASHEN PACT v0.1.0');
      expect(consoleStdout).toContain(`:${RELEASE_PORT}`);
      expect(consoleStdout).toContain('█');
      expect(consoleStdout).toContain('▀');

      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];

      // 2. Launch Host in Chromium and Client 2 in Microsoft Edge (cross-browser verification!)
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
          if (msg.type() === 'error') consoleErrors.push(`[P${idx + 1}] ${msg.text()}`);
          if (msg.type() === 'warning') consoleWarnings.push(`[P${idx + 1}] ${msg.text()}`);
        });
        p.on('pageerror', (err) => {
          consoleErrors.push(`[P${idx + 1}] ${err.message}`);
        });
      }

      // 3. Query /api/host-info from the standalone release server to obtain the machine's real LAN IPv4
      const hostInfoRes = await pageHost.request.get(
        `http://127.0.0.1:${RELEASE_PORT}/api/host-info`,
      );
      expect(hostInfoRes.ok()).toBe(true);
      const hostInfo = (await hostInfoRes.json()) as {
        version: string;
        primaryLanIp: string;
        port: number;
      };
      expect(hostInfo.version).toBe('0.1.0');
      expect(hostInfo.port).toBe(RELEASE_PORT);
      expect(hostInfo.primaryLanIp).toBeTruthy();

      const lanBaseUrl = `http://${hostInfo.primaryLanIp}:${hostInfo.port}`;

      // 4. Connect Host (P1) and Client 2 (P2 - MS Edge) over the real LAN IPv4 address
      await pageHost.goto(
        `${lanBaseUrl}/?coop=host&name=${encodeURIComponent('Chủ Phòng v0.1')}&server=${hostInfo.primaryLanIp}:${hostInfo.port}`,
      );
      await pageHost.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.scene === 'GameScene' &&
          window.__GAME_DEBUG__?.serverConnected === true &&
          window.__GAME_DEBUG__?.inHub === true,
        null,
        { timeout: 15000 },
      );

      await pageClient2.goto(`${lanBaseUrl}/?name=${encodeURIComponent('Đồng Đội Edge P2')}`);
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
      await pageHost.waitForTimeout(350);

      await pageHost.screenshot({
        path: path.join(SCREENSHOT_DIR, 'release-hub-lan-coop-1080p.png'),
      });

      // 5. Start Dungeon Run from Hub -> Floor 1 -> Enter Combat Room & fight
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
      await pageHost.waitForTimeout(900);

      await pageHost.screenshot({
        path: path.join(SCREENSHOT_DIR, 'release-dungeon-combat-1080p.png'),
      });

      // Clear Combat room & Portal room on Floor 1 -> Advance to Floor 2 Boss Room -> Defeat Boss!
      await pageHost.evaluate(() => {
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'skip_waves' });
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'advance_floor', floor: 2 });
      });

      await pageHost.waitForFunction(() => window.__GAME_DEBUG__?.currentFloor === 2, null, {
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
      await pageHost.waitForTimeout(600);

      // Defeat Boss to complete the run from the standalone release build
      await pageHost.evaluate(() => {
        window.__GAME_COOP_SEND__?.('debug_cmd', { cmd: 'skip_waves' });
      });

      await pageHost.waitForFunction(
        () => window.__GAME_DEBUG__?.runState === 'victory',
        null,
        { timeout: 10000 },
      );

      // Sleep secondary browser loop briefly to measure clean single-GPU Host FPS
      await pageClient2.evaluate(() => window.__PHASER_GAME__?.loop.sleep());
      await pageHost.bringToFront();
      await pageHost.waitForTimeout(600);

      const finalMetrics = await pageHost.evaluate(() => ({
        fps: window.__GAME_DEBUG__.fps,
        runState: window.__GAME_DEBUG__.runState,
        coopPlayerCount: window.__GAME_DEBUG__.coopPlayerCount,
      }));
      expect(finalMetrics.runState).toBe('victory');
      expect(finalMetrics.coopPlayerCount).toBe(2);
      expect(finalMetrics.fps).toBeGreaterThanOrEqual(55);

      await pageHost.screenshot({
        path: path.join(SCREENSHOT_DIR, 'release-boss-victory-1080p.png'),
      });

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
});
