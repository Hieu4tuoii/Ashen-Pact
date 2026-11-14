import dgram from 'node:dgram';
import type http from 'node:http';
import type https from 'node:https';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { PeerServer } from 'peer';

let peerHttpServer: http.Server | https.Server | null = null;
let stunUdpSocket: dgram.Socket | null = null;
let peerPort = 0;

/**
 * Minimal RFC 5389 STUN Binding Response (0x0101) with XOR-MAPPED-ADDRESS (0x0020)
 * on 127.0.0.1:<peerPort> (UDP) so isolated loopback-only Linux containers without
 * eth0 can gather srflx 127.0.0.1 ICE candidates completely offline.
 */
function startLocalLoopbackStunServer(port: number): Promise<dgram.Socket> {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    sock.once('error', reject);
    sock.on('message', (msg, rinfo) => {
      if (msg.length < 20 || msg.readUInt16BE(0) !== 0x0001) return;
      const magic = 0x2112a442;
      const txId = msg.subarray(8, 20);
      const ipParts = rinfo.address.split('.').map(Number);
      if (ipParts.length !== 4) return;
      const ipInt =
        ((ipParts[0]! << 24) | (ipParts[1]! << 16) | (ipParts[2]! << 8) | ipParts[3]!) >>> 0;
      const xPort = (rinfo.port ^ (magic >>> 16)) & 0xffff;
      const xIp = (ipInt ^ magic) >>> 0;

      const attr = Buffer.alloc(12);
      attr.writeUInt16BE(0x0020, 0);
      attr.writeUInt16BE(8, 2);
      attr.writeUInt8(0, 4);
      attr.writeUInt8(0x01, 5);
      attr.writeUInt16BE(xPort, 6);
      attr.writeUInt32BE(xIp, 8);

      const hdr = Buffer.alloc(20);
      hdr.writeUInt16BE(0x0101, 0);
      hdr.writeUInt16BE(attr.length, 2);
      hdr.writeUInt32BE(magic, 4);
      txId.copy(hdr, 8);

      sock.send(Buffer.concat([hdr, attr]), rinfo.port, rinfo.address);
    });
    sock.bind(port, '127.0.0.1', () => {
      sock.removeListener('error', reject);
      resolve(sock);
    });
  });
}

test.beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    try {
      PeerServer(
        {
          host: '127.0.0.1',
          port: 0,
          path: '/peerjs',
        },
        (server) => {
          peerHttpServer = server;
          const addr = server.address() as AddressInfo | null;
          if (!addr || typeof addr.port !== 'number') {
            reject(new Error('Failed to bind ephemeral PeerServer port'));
            return;
          }
          peerPort = addr.port;
          resolve();
        },
      );
    } catch (err) {
      reject(err);
    }
  });
  stunUdpSocket = await startLocalLoopbackStunServer(peerPort);
});

test.afterAll(async () => {
  if (stunUdpSocket) {
    const sock = stunUdpSocket;
    stunUdpSocket = null;
    await new Promise<void>((resolve) => {
      sock.close(() => resolve());
    });
  }
  if (peerHttpServer) {
    const srv = peerHttpServer;
    peerHttpServer = null;
    srv.closeAllConnections?.();
    await new Promise<void>((resolve) => {
      srv.close(() => resolve());
    });
  }
});

test.describe('Online WebRTC P2P Co-op — Room Codes, Invite Links, Sanctuary UI & Reconnect', () => {
  test('connects 3 Chromium browsers over real WebRTC DataChannels via 6-char Room Code & Invite URL without Colyseus :2567', async ({
    browser,
  }) => {
    test.setTimeout(120000);

    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const p1AndP2Port2567Requests: string[] = [];

    const context1 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const context2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const context3 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });

    try {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      const page3 = await context3.newPage();
      const pages = [page1, page2, page3];

      for (const p of [page1, page2]) {
        p.on('request', (req) => {
          if (req.url().includes(':2567')) {
            p1AndP2Port2567Requests.push(req.url());
          }
        });
      }

      for (const [idx, p] of pages.entries()) {
        p.on('console', (msg) => {
          const text = msg.text();
          if (text.includes('WebSocket is already in CLOSING or CLOSED state')) return;
          if (text.includes('GPU stall due to ReadPixels')) return;
          if (msg.type() === 'error') consoleErrors.push(`[P${idx + 1}] ${text}`);
          if (msg.type() === 'warning') consoleWarnings.push(`[P${idx + 1}] ${text}`);
        });
        p.on('pageerror', (err) => {
          consoleErrors.push(`[P${idx + 1}] ${err.message}`);
        });
      }

      const peerSignalUrl = `http://127.0.0.1:${peerPort}/peerjs`;

      // 1. P1 (Host) creates an Online P2P room and receives a 6-char Room Code + shareable Invite URL
      await page1.goto(
        `http://localhost:5173/?coop=host&p2p=1&name=${encodeURIComponent('Chủ Phòng P1')}&peerSignal=${encodeURIComponent(peerSignalUrl)}`,
      );
      await page1.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.scene === 'GameScene' &&
          window.__GAME_DEBUG__?.serverConnected === true &&
          window.__GAME_DEBUG__?.coopBackend === 'p2p' &&
          window.__GAME_DEBUG__?.inHub === true &&
          /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(window.__GAME_DEBUG__?.coopRoomId ?? ''),
        null,
        { timeout: 30000 },
      );

      const roomCode = await page1.evaluate(() => window.__GAME_DEBUG__.coopRoomId!);
      const hostInviteUrl = await page1.evaluate(() => window.__GAME_DEBUG__.hostInviteUrl!);
      expect(roomCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      expect(hostInviteUrl).toContain(`?join=${roomCode}&p2p=1`);

      // 2. P2 joins directly via P1's generated Invite URL
      await page2.goto(`${hostInviteUrl}&name=${encodeURIComponent('Bạn Bè P2')}`);
      await page2.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.scene === 'GameScene' &&
          window.__GAME_DEBUG__?.serverConnected === true &&
          window.__GAME_DEBUG__?.coopBackend === 'p2p' &&
          window.__GAME_DEBUG__?.playerSlot === 2 &&
          window.__GAME_DEBUG__?.coopPlayerCount >= 2 &&
          window.__GAME_DEBUG__?.inHub === true,
        null,
        { timeout: 30000 },
      );

      // 3. P3 boots in Solo Sanctuary, opens [I] Co-op Guild Drawer, types the 6-char Room Code, and clicks Join
      await page3.goto(
        `http://localhost:5173/?test=1&peerSignal=${encodeURIComponent(peerSignalUrl)}`,
      );
      await page3.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.scene === 'GameScene' &&
          window.__GAME_DEBUG__?.inHub === true &&
          window.__GAME_DEBUG__?.irisTransitionProgress === 0,
        null,
        { timeout: 25000 },
      );

      await page3.keyboard.press('KeyI');
      await page3.waitForFunction(() => window.__GAME_DEBUG__?.invitePanelVisible === true, null, {
        timeout: 5000,
      });

      const ipInput = page3.locator('[data-testid="menu-ip-input"]');
      await expect(ipInput).toBeVisible();
      await ipInput.click();
      await ipInput.selectText();
      await page3.keyboard.press('Delete');
      await page3.keyboard.type(roomCode.toLowerCase());
      await page3.keyboard.press('Enter');

      // Click the Join button inside Solo Co-op Guild Drawer (1080p coordinates: 1736, 600)
      await page3.mouse.click(1736, 600);

      for (const p of pages) {
        await p.waitForFunction(
          () =>
            window.__GAME_DEBUG__?.scene === 'GameScene' &&
            window.__GAME_DEBUG__?.serverConnected === true &&
            window.__GAME_DEBUG__?.coopBackend === 'p2p' &&
            window.__GAME_DEBUG__?.coopPlayerCount === 3 &&
            window.__GAME_DEBUG__?.inHub === true,
          null,
          { timeout: 30000 },
        );
      }

      const slots = await Promise.all(
        pages.map((p) => p.evaluate(() => window.__GAME_DEBUG__.playerSlot)),
      );
      expect(slots).toEqual([1, 2, 3]);
      expect(p1AndP2Port2567Requests).toEqual([]);

      // 4. Verify non-duplicate character guard + Ready + Floor 1 Dungeon transition
      await page2.evaluate(() => {
        window.__GAME_COOP_SEND__?.('select_character', { characterId: 'vanguard' });
      });
      await page2.waitForTimeout(150);
      const p2CharAfterDupAttempt = await page2.evaluate(
        () =>
          window.__GAME_TRANSPORT__
            ?.getSim()
            .getAllPlayers()
            .find((pl) => pl.slot === 2)?.characterId,
      );
      expect(p2CharAfterDupAttempt).toBe('ranger');

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

      await page1.waitForTimeout(200);
      await page1.evaluate(() => {
        window.__GAME_COOP_SEND__?.('start_run', {});
      });

      for (const p of pages) {
        await p.waitForFunction(
          () =>
            window.__GAME_DEBUG__?.inHub === false &&
            window.__GAME_DEBUG__?.currentFloor === 1 &&
            window.__GAME_DEBUG__?.runState === 'playing',
          null,
          { timeout: 20000 },
        );
      }

      // 5. Verify 30s WebRTC reconnect recovery on P2 (__GAME_FORCE_RECONNECT__) preserves slot 2
      const reconnected = await page2.evaluate(() => window.__GAME_FORCE_RECONNECT__!());
      expect(reconnected).toBe(true);

      await page2.waitForFunction(
        () =>
          window.__GAME_DEBUG__?.serverConnected === true &&
          window.__GAME_DEBUG__?.coopBackend === 'p2p' &&
          window.__GAME_DEBUG__?.playerSlot === 2 &&
          window.__GAME_DEBUG__?.coopPlayerCount === 3 &&
          window.__GAME_DEBUG__?.inHub === false &&
          window.__GAME_DEBUG__?.currentFloor === 1,
        null,
        { timeout: 20000 },
      );

      // 6. Close P1 Host tab and verify P2 & P3 gracefully return to Solo Sanctuary
      await page1.close();

      for (const p of [page2, page3]) {
        await p.waitForFunction(
          () =>
            window.__GAME_DEBUG__?.scene === 'GameScene' &&
            window.__GAME_DEBUG__?.coopMode === 'solo' &&
            window.__GAME_DEBUG__?.inHub === true,
          null,
          { timeout: 25000 },
        );
      }

      expect(consoleErrors).toEqual([]);
      expect(consoleWarnings).toEqual([]);
    } finally {
      await Promise.allSettled([context1.close(), context2.close(), context3.close()]);
    }
  });
});
