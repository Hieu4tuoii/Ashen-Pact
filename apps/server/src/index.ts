import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { HelloRoom } from './rooms/HelloRoom.js';
import { getLanIPv4Addresses } from './utils/network.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = Number(process.env.PORT ?? 2567);

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
    res.json({
      port: activePort,
      localUrl: `http://localhost:${activePort}`,
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
  console.log(`[AshenPact Server] Listening on http://localhost:${activePort}`);
  for (const lan of lanList) {
    console.log(
      `[AshenPact LAN] ${lan.interfaceName}: http://${lan.address}:${activePort}${lan.preferred ? ' (Preferred)' : ''}`,
    );
  }

  return { port: activePort, gameServer };
}

if (process.env.ASHEN_PACT_NO_AUTOSTART !== '1') {
  startServer().catch((err) => {
    console.error('[AshenPact Server] Failed to start:', err);
    process.exit(1);
  });
}
