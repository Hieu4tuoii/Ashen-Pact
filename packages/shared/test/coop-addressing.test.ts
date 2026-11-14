import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  generateQrMatrix,
  generateRoomCode,
  normalizeRoomCode,
  parseCoopTargetInput,
  resolveWsEndpointUrl,
  roomCodeToPeerId,
} from '../src/index.js';

describe('Co-op P2P Room Code & Smart URL Addressing', () => {
  it('generates unambiguous 6-character uppercase room codes without 0/O/1/I', () => {
    expect(ROOM_CODE_ALPHABET).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    expect(ROOM_CODE_ALPHABET).toHaveLength(32);

    let step = 0;
    const deterministicCode = generateRoomCode(() => {
      const val = (step * 7) % ROOM_CODE_ALPHABET.length;
      step += 1;
      return val / ROOM_CODE_ALPHABET.length;
    });
    expect(deterministicCode).toHaveLength(6);
    expect(deterministicCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

    for (let i = 0; i < 64; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
      expect(code).not.toMatch(/[0O1I]/);
    }
  });

  it('normalizes formatted room codes and rejects IP/URL strings', () => {
    expect(normalizeRoomCode(' 7k9-m2p ')).toBe('7K9M2P');
    expect(normalizeRoomCode('ap-7k9m2p')).toBe('7K9M2P');
    expect(normalizeRoomCode('AP-7k9-m2p')).toBe('7K9M2P');
    expect(normalizeRoomCode('p2p:7k9m2p')).toBe('7K9M2P');
    expect(normalizeRoomCode('P2P:abcd23')).toBe('ABCD23');

    expect(normalizeRoomCode('')).toBeNull();
    expect(normalizeRoomCode('12')).toBeNull();
    expect(normalizeRoomCode('192.168.1.5:2567')).toBeNull();
    expect(normalizeRoomCode('192.168.1.5')).toBeNull();
    expect(normalizeRoomCode('https://ashen-pact.vercel.app')).toBeNull();
    expect(normalizeRoomCode('localhost')).toBeNull();
  });

  it('maps room codes deterministically to PeerJS IDs', () => {
    expect(roomCodeToPeerId('7K9M2P')).toBe('ashen-pact-v2-room-7k9m2p');
    expect(roomCodeToPeerId(' ap-7k9-m2p ')).toBe('ashen-pact-v2-room-7k9m2p');
  });

  it('parses Vercel P2P invite URLs, LAN invite URLs, cloud WSS domains, and bare IPv4s accurately', () => {
    expect(parseCoopTargetInput('   ')).toEqual({ kind: 'empty' });

    expect(
      parseCoopTargetInput('https://ashen-pact.vercel.app/?join=7k9m2p&p2p=1'),
    ).toEqual({
      kind: 'p2p',
      roomCode: '7K9M2P',
    });

    expect(parseCoopTargetInput('https://ashen-pact.vercel.app/?join=7K9M2P')).toEqual({
      kind: 'p2p',
      roomCode: '7K9M2P',
    });

    expect(parseCoopTargetInput('ap-7k9-m2p')).toEqual({
      kind: 'p2p',
      roomCode: '7K9M2P',
    });

    expect(parseCoopTargetInput('http://192.168.1.25:2567/?join=roomAbc12')).toEqual({
      kind: 'colyseus',
      wsUrl: 'ws://192.168.1.25:2567',
      hostPortDisplay: '192.168.1.25:2567',
      roomId: 'roomAbc12',
    });

    expect(
      parseCoopTargetInput(
        'https://ashen-pact.vercel.app/?join=roomAbc12&server=wss://ashen-server.onrender.com',
      ),
    ).toEqual({
      kind: 'colyseus',
      wsUrl: 'wss://ashen-server.onrender.com',
      hostPortDisplay: 'ashen-server.onrender.com',
      roomId: 'roomAbc12',
    });

    expect(parseCoopTargetInput('wss://ashen-server.onrender.com')).toEqual({
      kind: 'colyseus',
      wsUrl: 'wss://ashen-server.onrender.com',
      hostPortDisplay: 'ashen-server.onrender.com',
    });

    expect(parseCoopTargetInput('192.168.1.25', { pageProtocol: 'http:' })).toEqual({
      kind: 'colyseus',
      wsUrl: 'ws://192.168.1.25:2567',
      hostPortDisplay: '192.168.1.25:2567',
    });

    expect(resolveWsEndpointUrl('wss://ashen-server.onrender.com')).toBe(
      'wss://ashen-server.onrender.com',
    );
    expect(resolveWsEndpointUrl('https://ashen-server.onrender.com')).toBe(
      'wss://ashen-server.onrender.com',
    );
    expect(resolveWsEndpointUrl('192.168.1.88', 'http:')).toBe('ws://192.168.1.88:2567');
    expect(resolveWsEndpointUrl('localhost', 'http:')).toBe('ws://localhost:2567');
  });

  it('encodes long Vercel preview invite URLs (79..106 bytes) using QR Version 5-L (37x37) without truncation', () => {
    const shortUrl = 'http://192.168.1.25:2567/?join=7K9M2P'; // <= 53 bytes -> Version 3-L (29x29)
    expect(generateQrMatrix(shortUrl)).toHaveLength(29);

    const mediumUrl = 'https://ashen-pact-prod.vercel.app/?join=7K9M2P&p2p=1&lang=vi'; // 61 bytes -> Version 4-L (33x33)
    expect(generateQrMatrix(mediumUrl)).toHaveLength(33);

    const previewUrlA =
      'https://ashen-pact-git-feat-webrtc-hieu4tuoii.vercel.app/?join=7K9M2P&p2p=1&ref=roomA1'; // 86 bytes -> Version 5-L (37x37)
    const previewUrlB =
      'https://ashen-pact-git-feat-webrtc-hieu4tuoii.vercel.app/?join=7K9M2P&p2p=1&ref=roomB2'; // differs in bytes > 78!

    expect(Buffer.byteLength(previewUrlA, 'utf8')).toBeGreaterThan(78);
    expect(Buffer.byteLength(previewUrlA, 'utf8')).toBeLessThanOrEqual(106);

    const matrixA = generateQrMatrix(previewUrlA);
    const matrixB = generateQrMatrix(previewUrlB);
    expect(matrixA).toHaveLength(37);
    expect(matrixA[0]).toHaveLength(37);
    // Proves bytes > 78 were NOT truncated away:
    expect(matrixA).not.toEqual(matrixB);
  });
});
