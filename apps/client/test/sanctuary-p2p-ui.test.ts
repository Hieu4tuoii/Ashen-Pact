import { describe, expect, it, vi } from 'vitest';

const p2pMockState = {
  createPeerHostRoomImpl: vi.fn(),
  joinPeerClientRoomImpl: vi.fn(),
};

vi.mock('../src/net/p2p-coop-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/net/p2p-coop-client.js')>();
  return {
    ...actual,
    createPeerHostRoom: (opts: unknown) => p2pMockState.createPeerHostRoomImpl(opts),
    joinPeerClientRoom: (opts: unknown) => p2pMockState.joinPeerClientRoomImpl(opts),
  };
});

vi.mock('phaser', () => {
  class MockScene {
    constructor(_config?: unknown) {}
  }
  const PhaserMock = {
    Scene: MockScene,
    BlendModes: { NORMAL: 0, ADD: 1, MULTIPLY: 2, SCREEN: 3 },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Input: { Keyboard: { KeyCodes: {} } },
    Math: {
      Clamp: (v: number, min: number, max: number) => Math.max(min, Math.min(max, v)),
    },
    Renderer: {
      WebGL: {
        WebGLRenderer: class {},
        Pipelines: {
          PostFXPipeline: class {},
          SinglePipeline: class {},
        },
      },
    },
  };
  return { default: PhaserMock, ...PhaserMock };
});

import { GameScene } from '../src/scenes/GameScene.js';
import {
  bindCoopRoomHandlersImpl,
  connectCoopRoomImpl,
  fetchHostLanInfoImpl,
  forceCoopReconnectImpl,
  getResolvedWsUrlImpl,
  updateHostInviteUrlImpl,
} from '../src/scenes/game-scene/input-and-network.js';
import {
  normalizeServerHostPortDisplay,
  resolveBootGameSceneInitData,
  resolveSanctuaryWsUrl,
  switchSanctuaryCoopMode,
} from '../src/scenes/game-scene/sanctuary-lobby-ui.js';
import { applyMenuInputEdit, MENU_IP_MAX_LEN } from '../src/ui/html-input-overlay.js';

describe('Sanctuary Online P2P Co-op Routing, Guild Drawer & GameScene Integration', () => {
  it('raises MENU_IP_MAX_LEN to 96 so full Vercel invite URLs paste without truncation and preserves portless WSS domains', () => {
    expect(MENU_IP_MAX_LEN).toBe(96);

    const fullInviteUrl = 'https://ashen-pact-git-preview.vercel.app/?join=7K9M2P&p2p=1';
    const edited = applyMenuInputEdit(
      '',
      0,
      0,
      { kind: 'paste', text: fullInviteUrl },
      'ip',
      MENU_IP_MAX_LEN,
    );
    expect(edited.value).toBe(fullInviteUrl);

    expect(resolveSanctuaryWsUrl('wss://ashen-server.onrender.com')).toBe(
      'wss://ashen-server.onrender.com',
    );
    expect(normalizeServerHostPortDisplay('wss://ashen-server.onrender.com', '127.0.0.1:2567')).toBe(
      'ashen-server.onrender.com',
    );
    expect(normalizeServerHostPortDisplay('7K9M2P', '127.0.0.1:2567')).toBe('7K9M2P');
    expect(normalizeServerHostPortDisplay('192.168.1.25', '127.0.0.1:2567')).toBe(
      '192.168.1.25:2567',
    );
  });

  it('routes ?join=<CODE>&p2p=1 and HTTPS Vercel ?join=<CODE> to P2P while keeping HTTP LAN ?server=... on Colyseus', () => {
    const p2pBoot = resolveBootGameSceneInitData('?join=7k9m2p&p2p=1&name=BanBe', false);
    expect(p2pBoot).toEqual({
      targetScene: 'GameScene',
      initData: expect.objectContaining({
        coopMode: 'join',
        coopBackend: 'p2p',
        roomId: '7K9M2P',
        displayName: 'BanBe',
        startInHub: true,
      }),
    });

    // Simulate HTTPS Vercel deployment
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        origin: 'https://ashen-pact.vercel.app',
        hostname: 'ashen-pact.vercel.app',
        pathname: '/',
        port: '',
        search: '',
      },
      localStorage: { getItem: () => null, setItem: vi.fn() },
      sessionStorage: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() },
    });

    try {
      const gs = new GameScene();
      gs.init({ coopMode: 'solo', startInHub: true });
      expect(gs.preferredCoopTransport).toBe('p2p');
      expect(gs.serverHostPort).toBe('');

      // HTTPS ?join=7K9M2P without &p2p=1 still auto-routes to P2P
      (window.location as { search: string }).search = '?join=7k9m2p';
      gs.init();
      expect(gs.coopMode).toBe('join');
      expect(gs.coopBackend).toBe('p2p');
      expect(gs.requestedRoomId).toBe('7K9M2P');

      // HTTP LAN ?coop=host&server=192.168.1.25:2567 routes to Colyseus
      vi.stubGlobal('window', {
        location: {
          protocol: 'http:',
          origin: 'http://192.168.1.25:2567',
          hostname: '192.168.1.25',
          pathname: '/',
          port: '2567',
          search: '?coop=host&server=192.168.1.25:2567',
        },
        localStorage: { getItem: () => null, setItem: vi.fn() },
        sessionStorage: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() },
      });
      gs.init();
      expect(gs.coopMode).toBe('host');
      expect(gs.coopBackend).toBe('colyseus');
      expect(gs.serverHostPort).toBe('192.168.1.25:2567');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('smart-routes switchSanctuaryCoopMode for Online Host, Room Code Join, pasted Vercel Invite URL, empty-code prompt, and LAN-mode Room Code auto-detection', () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        origin: 'https://ashen-pact.vercel.app',
        hostname: 'ashen-pact.vercel.app',
        pathname: '/',
        port: '',
        search: '',
      },
      localStorage: { getItem: () => null, setItem: vi.fn() },
      sessionStorage: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    try {
      const gs = new GameScene();
      const restartSpy = vi.fn();
      (gs as unknown as { scene: { restart: typeof restartSpy; isActive: () => boolean } }).scene =
        {
          restart: restartSpy,
          isActive: () => true,
        };

      gs.init({ coopMode: 'solo', startInHub: true });
      expect(gs.preferredCoopTransport).toBe('p2p');

      // 1. Online Host with empty box -> starts P2P Host
      switchSanctuaryCoopMode(gs, 'host');
      expect(restartSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          coopMode: 'host',
          coopBackend: 'p2p',
          startInHub: true,
        }),
      );

      // 2. Online Join with empty box -> stays in Solo and sets localized prompt banner
      restartSpy.mockClear();
      gs.serverHostPort = '   ';
      switchSanctuaryCoopMode(gs, 'join');
      expect(restartSpy).not.toHaveBeenCalled();
      expect(gs.disconnectReason).toBeTruthy();
      expect(gs.disconnectBannerTimer).toBeGreaterThan(0);

      // 3. Online Join with pasted Vercel invite URL -> extracts 7K9M2P and starts P2P Join
      gs.serverHostPort = 'https://ashen-pact.vercel.app/?join=7k9-m2p&p2p=1';
      switchSanctuaryCoopMode(gs, 'join');
      expect(restartSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          coopMode: 'join',
          coopBackend: 'p2p',
          roomId: '7K9M2P',
          startInHub: true,
        }),
      );

      // 4. Even in LAN mode, typing a 6-character Room Code and clicking Join auto-routes to P2P
      restartSpy.mockClear();
      gs.preferredCoopTransport = 'lan';
      gs.serverHostPort = '9X4M2K';
      switchSanctuaryCoopMode(gs, 'join');
      expect(restartSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          coopMode: 'join',
          coopBackend: 'p2p',
          roomId: '9X4M2K',
        }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('builds Vercel P2P hostInviteUrl, exits cleanly to Solo on invalid Room Code, and leaves stale P2P rooms on epoch change', async () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        origin: 'https://ashen-pact.vercel.app',
        hostname: 'ashen-pact.vercel.app',
        pathname: '/',
        port: '',
        search: '',
      },
      localStorage: { getItem: () => null, setItem: vi.fn() },
      sessionStorage: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    try {
      const gs = new GameScene();
      const startSpy = vi.fn();
      (
        gs as unknown as {
          scene: { isActive: () => boolean; start: typeof startSpy; restart: ReturnType<typeof vi.fn> };
        }
      ).scene = {
        isActive: () => true,
        start: startSpy,
        restart: vi.fn(),
      };
      (gs as unknown as { time: { addEvent: ReturnType<typeof vi.fn> } }).time = {
        addEvent: vi.fn(),
      };
      gs.getResolvedWsUrl = () => getResolvedWsUrlImpl.call(gs);
      gs.fetchHostLanInfo = () => fetchHostLanInfoImpl.call(gs);
      gs.updateHostInviteUrl = () => updateHostInviteUrlImpl.call(gs);
      gs.bindCoopRoomHandlers = (r) => bindCoopRoomHandlersImpl.call(gs, r);

      // 1. P2P Host populates https://ashen-pact.vercel.app/?join=7K9M2P&p2p=1
      gs.init({ coopMode: 'host', coopBackend: 'p2p', startInHub: true });
      const fakeHostRoom = {
        roomId: '7K9M2P',
        send: vi.fn(),
        onMessage: vi.fn(),
        onLeave: vi.fn(),
        leave: vi.fn(async () => {}),
      };
      p2pMockState.createPeerHostRoomImpl.mockResolvedValueOnce(fakeHostRoom);

      await connectCoopRoomImpl.call(gs);
      expect(gs.room).toBe(fakeHostRoom);
      expect(gs.hostInviteUrl).toBe('https://ashen-pact.vercel.app/?join=7K9M2P&p2p=1');

      // 2. P2P Join rejection (e.g. wrong code ZZZZ99) calls exitToSoloSanctuary with error message
      gs.room = undefined;
      gs.init({
        coopMode: 'join',
        coopBackend: 'p2p',
        roomId: 'ZZZZ99',
        startInHub: true,
      });
      p2pMockState.joinPeerClientRoomImpl.mockRejectedValueOnce(
        new Error('Không tìm thấy phòng Online "ZZZZ99" hoặc Chủ phòng đã đóng phòng.'),
      );

      await connectCoopRoomImpl.call(gs);
      expect(startSpy).toHaveBeenCalledWith(
        'GameScene',
        expect.objectContaining({
          coopMode: 'solo',
          startInHub: true,
          disconnectReason: expect.stringContaining('ZZZZ99'),
        }),
      );

      // 3. Stale in-flight createPeerHostRoom leaves immediately when sceneSessionEpoch increments
      let resolveInFlightHost!: (room: typeof fakeHostRoom) => void;
      const staleLeaveSpy = vi.fn(async () => {});
      p2pMockState.createPeerHostRoomImpl.mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveInFlightHost = res;
          }),
      );

      gs.init({ coopMode: 'host', coopBackend: 'p2p', startInHub: true });
      const pendingConnect = connectCoopRoomImpl.call(gs);
      await Promise.resolve();

      // Restart back to Solo before P2P Host resolves
      gs.init({ coopMode: 'solo', startInHub: true });
      resolveInFlightHost({
        roomId: 'STALE1',
        send: vi.fn(),
        onMessage: vi.fn(),
        onLeave: vi.fn(),
        leave: staleLeaveSpy,
      });
      await pendingConnect;

      expect(staleLeaveSpy).toHaveBeenCalledWith(true);
      expect(gs.room).toBeUndefined();

      // 4. Failed P2P reconnect (Host closed room while client had 1006 drop) exits cleanly to Solo Sanctuary
      startSpy.mockClear();
      gs.init({ coopMode: 'join', coopBackend: 'p2p', roomId: 'GONE99', startInHub: true });
      p2pMockState.joinPeerClientRoomImpl.mockRejectedValueOnce(
        new Error('Không tìm thấy phòng Online "GONE99" hoặc Chủ phòng đã đóng phòng.'),
      );
      const reconnected = await forceCoopReconnectImpl.call(gs);
      expect(reconnected).toBe(false);
      expect(startSpy).toHaveBeenCalledWith(
        'GameScene',
        expect.objectContaining({
          coopMode: 'solo',
          startInHub: true,
          disconnectReason: expect.stringContaining('GONE99'),
        }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
