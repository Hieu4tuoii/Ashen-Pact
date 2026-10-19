import { exec } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import cors from 'cors';
import express from 'express';
import { CoopRoom } from './rooms/CoopRoom.js';
import { HelloRoom } from './rooms/HelloRoom.js';
import { getLanIPv4Addresses } from './utils/network.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCliPort(): number | null {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--port' && args[i + 1]) {
      const p = Number(args[i + 1]);
      if (Number.isFinite(p) && p > 0) return p;
    } else if (arg.startsWith('--port=')) {
      const p = Number(arg.slice('--port='.length));
      if (Number.isFinite(p) && p > 0) return p;
    }
  }
  return null;
}

const DEFAULT_PORT = parseCliPort() ?? Number(process.env.PORT ?? 2567);

function openBrowserUrl(url: string): void {
  if (process.env.ASHEN_PACT_NO_OPEN_BROWSER === '1' || process.env.CI) return;
  const platform = process.platform;
  const cmd =
    platform === 'win32'
      ? `start "" "${url}"`
      : platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {
    // Ignore errors in headless environments
  });
}

export async function startServer(initialPort = DEFAULT_PORT): Promise<{
  port: number;
  gameServer: Server;
}> {
  const app = express();
  app.use(cors());
  app.use(express.json());

  let activePort = initialPort;

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      game: 'Ashen Pact',
      port: activePort,
      lanAddresses: getLanIPv4Addresses(),
    });
  });

  app.get('/api/host-info', (_req, res) => {
    const lanAddresses = getLanIPv4Addresses();
    const urls = lanAddresses.map((info) => ({
      interfaceName: info.interfaceName,
      address: info.address,
      url: `http://${info.address}:${activePort}`,
      preferred: info.preferred,
    }));
    const primaryLanIp =
      lanAddresses.find((info) => info.preferred)?.address ??
      lanAddresses[0]?.address ??
      '127.0.0.1';
    res.json({
      port: activePort,
      localUrl: `http://localhost:${activePort}`,
      primaryLanIp,
      lanIps: lanAddresses.map((info) => info.address),
      lanUrls: urls,
    });
  });

  // Serve built static client when available
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
  }

  const httpServer = http.createServer(app);
  const gameServer = new Server({
    transport: new WebSocketTransport({
      server: httpServer,
    }),
  });

  gameServer.define('hello_room', HelloRoom);
  gameServer.define('coop_room', CoopRoom);

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidatePort = initialPort + attempt;
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (err: NodeJS.ErrnoException) => {
          httpServer.off('error', onError);
          reject(err);
        };
        httpServer.once('error', onError);
        httpServer.listen(candidatePort, '0.0.0.0', () => {
          httpServer.off('error', onError);
          resolve();
        });
      });
      activePort = candidatePort;
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EADDRINUSE' && attempt < 9) {
        continue;
      }
      throw err;
    }
  }

  const lanList = getLanIPv4Addresses();
  console.log('==========================================================');
  console.log(`[AshenPact Server] Listening on http://localhost:${activePort}`);
  for (const lan of lanList) {
    console.log(
      `[AshenPact LAN] ${lan.interfaceName}: http://${lan.address}:${activePort}${lan.preferred ? ' (Ưu tiên LAN)' : ''}`,
    );
  }
  console.log('==========================================================');

  if (process.argv.includes('--host')) {
    openBrowserUrl(`http://localhost:${activePort}/?coop=host`);
  }

  return { port: activePort, gameServer };
}

if (process.env.ASHEN_PACT_NO_AUTOSTART !== '1') {
  startServer().catch((err) => {
    console.error('[AshenPact Server] Failed to start:', err);
    process.exit(1);
  });
}
