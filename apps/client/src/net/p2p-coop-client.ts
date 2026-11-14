import {
  CoopRoomAuthority,
  type CoopAuthorityPeer,
  SIM_STEP_MS,
  generateRoomCode,
  normalizeRoomCode,
  roomCodeToPeerId,
} from '@ashen-pact/shared';
import { isDebugUiEnabled, isTestHooksEnabled } from '../core/debug-flag.js';
import { createBackgroundTicker, type BackgroundTickerHandle } from './background-ticker.js';
import { type CoopRoomConnection } from './coop-room-connection.js';

export interface PeerDataConnectionLike {
  readonly peer: string;
  readonly open: boolean;
  send(data: unknown): void;
  close(): void;
  on(event: 'open', cb: () => void): void;
  on(event: 'data', cb: (data: unknown) => void): void;
  on(event: 'close', cb: () => void): void;
  on(event: 'error', cb: (err: unknown) => void): void;
}

export interface PeerInstanceLike {
  readonly id: string;
  readonly destroyed: boolean;
  readonly disconnected?: boolean;
  connect(
    peerId: string,
    options?: { reliable?: boolean; serialization?: string },
  ): PeerDataConnectionLike;
  reconnect?(): void;
  destroy(): void;
  on(event: 'open', cb: (id: string) => void): void;
  on(event: 'connection', cb: (conn: PeerDataConnectionLike) => void): void;
  on(event: 'error', cb: (err: { type?: string; message?: string }) => void): void;
  on(event: 'disconnected' | 'close', cb: () => void): void;
}

export interface PeerSignalingEndpointConfig {
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
  key?: string;
  debug: number;
  iceServers?: RTCIceServer[];
}

export type PeerLikeFactory = (
  peerId: string | undefined,
  options: PeerSignalingEndpointConfig,
) => Promise<PeerInstanceLike> | PeerInstanceLike;

export interface CreatePeerHostRoomOptions {
  requestedRoomCode?: string;
  hostDisplayName: string;
  characterId?: string;
  seed?: number;
  isDebugEnabled?: () => boolean;
  peerFactory?: PeerLikeFactory;
  signaling?: Partial<PeerSignalingEndpointConfig>;
  reconnectGraceMs?: number;
  randomFn?: () => number;
}

export interface JoinPeerClientRoomOptions {
  roomCode: string;
  displayName: string;
  characterId?: string;
  reconnectToken?: string;
  timeoutMs?: number;
  peerFactory?: PeerLikeFactory;
  signaling?: Partial<PeerSignalingEndpointConfig>;
}

type P2PWireEnvelope =
  | { t: '__join__'; opts?: Record<string, unknown> }
  | { t: '__leave__'; consented?: boolean }
  | { t: '__close__'; code: number }
  | { t: string; p?: unknown };

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

function getDefaultEnv(): Record<string, string | undefined> {
  try {
    return (import.meta.env ?? {}) as Record<string, string | undefined>;
  } catch {
    return {};
  }
}

function getDefaultSearch(): string {
  if (typeof window !== 'undefined' && typeof window.location?.search === 'string') {
    return window.location.search;
  }
  return '';
}

/**
 * Resolves PeerJS signaling + ICE (STUN/TURN) configuration.
 * Always enforces `debug: 0` so PeerJS never emits console warnings/errors.
 */
export function resolvePeerRuntimeOptions(
  search: string = getDefaultSearch(),
  env: Record<string, string | undefined> = getDefaultEnv(),
): PeerSignalingEndpointConfig {
  const iceServers: RTCIceServer[] = DEFAULT_STUN_SERVERS.map((s) => ({
    ...s,
    urls: Array.isArray(s.urls) ? [...s.urls] : s.urls,
  }));

  const turnUrlsRaw = env.VITE_TURN_URLS?.trim();
  if (turnUrlsRaw) {
    const urls = turnUrlsRaw
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length > 0) {
      const turnEntry: RTCIceServer = { urls };
      if (env.VITE_TURN_USERNAME?.trim()) {
        turnEntry.username = env.VITE_TURN_USERNAME.trim();
      }
      if (env.VITE_TURN_CREDENTIAL?.trim()) {
        turnEntry.credential = env.VITE_TURN_CREDENTIAL.trim();
      }
      iceServers.push(turnEntry);
    }
  }

  const out: PeerSignalingEndpointConfig = {
    debug: 0,
    iceServers,
  };

  if (env.VITE_PEER_HOST?.trim()) {
    out.host = env.VITE_PEER_HOST.trim();
    if (env.VITE_PEER_PORT?.trim()) {
      const parsedPort = Number(env.VITE_PEER_PORT.trim());
      if (Number.isFinite(parsedPort) && parsedPort > 0) {
        out.port = parsedPort;
      }
    }
    if (env.VITE_PEER_PATH?.trim()) {
      out.path = env.VITE_PEER_PATH.trim();
    }
    if (env.VITE_PEER_SECURE !== undefined) {
      out.secure = env.VITE_PEER_SECURE === 'true' || env.VITE_PEER_SECURE === '1';
    }
    if (env.VITE_PEER_KEY?.trim()) {
      out.key = env.VITE_PEER_KEY.trim();
    }
  }

  if (typeof window !== 'undefined') {
    const winOverride = (
      window as unknown as { __ASHEN_PACT_PEER_OPTIONS__?: Partial<PeerSignalingEndpointConfig> }
    ).__ASHEN_PACT_PEER_OPTIONS__;
    if (winOverride && typeof winOverride === 'object') {
      if (typeof winOverride.host === 'string' && winOverride.host.trim()) {
        out.host = winOverride.host.trim();
      }
      if (typeof winOverride.port === 'number' && winOverride.port > 0) {
        out.port = winOverride.port;
      }
      if (typeof winOverride.path === 'string' && winOverride.path.trim()) {
        out.path = winOverride.path.trim();
      }
      if (typeof winOverride.secure === 'boolean') {
        out.secure = winOverride.secure;
      }
      if (typeof winOverride.key === 'string' && winOverride.key.trim()) {
        out.key = winOverride.key.trim();
      }
      if (Array.isArray(winOverride.iceServers)) {
        out.iceServers = winOverride.iceServers;
      }
    }
  }

  const params = new URLSearchParams(search);
  const peerSignal = params.get('peerSignal')?.trim();
  if (peerSignal) {
    try {
      const parsed = new URL(peerSignal);
      const isSecure = parsed.protocol === 'https:' || parsed.protocol === 'wss:';
      out.host = parsed.hostname;
      out.port = parsed.port ? Number(parsed.port) : isSecure ? 443 : 80;
      out.path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/';
      out.secure = isSecure;
      const keyParam = parsed.searchParams.get('key')?.trim();
      if (keyParam) {
        out.key = keyParam;
      }
    } catch {
      // Ignore malformed peerSignal query override
    }
  }

  if ((out.host === '127.0.0.1' || out.host === 'localhost') && !turnUrlsRaw) {
    out.iceServers =
      typeof out.port === 'number' && out.port > 0
        ? [{ urls: `stun:${out.host}:${out.port}` }]
        : [];
  }

  out.debug = 0;
  return out;
}

const defaultPeerFactory: PeerLikeFactory = async (peerId, options) => {
  const mod = await import('peerjs');
  const PeerCtor = mod.Peer ?? mod.default;
  const peerOpts: ConstructorParameters<typeof PeerCtor>[1] = {
    debug: 0,
    config: {
      iceServers: options.iceServers ?? DEFAULT_STUN_SERVERS,
    },
  };
  if (options.host) peerOpts.host = options.host;
  if (typeof options.port === 'number') peerOpts.port = options.port;
  if (options.path) peerOpts.path = options.path;
  if (typeof options.secure === 'boolean') peerOpts.secure = options.secure;
  if (options.key) peerOpts.key = options.key;

  const instance = peerId ? new PeerCtor(peerId, peerOpts) : new PeerCtor(peerOpts);
  return instance as unknown as PeerInstanceLike;
};

class MessageDispatcher {
  private readonly handlers = new Map<string, Set<(payload: unknown) => void>>();
  private readonly pendingMessages = new Map<string, unknown[]>();
  private readonly leaveHandlers = new Set<(code: number) => void>();
  private pendingLeaveCode: number | null = null;

  public onMessage<T = unknown>(type: string, callback: (message: T) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const wrapped = callback as (payload: unknown) => void;
    set.add(wrapped);

    const buffered = this.pendingMessages.get(type);
    if (buffered && buffered.length > 0) {
      const items = buffered.splice(0, buffered.length);
      this.pendingMessages.delete(type);
      queueMicrotask(() => {
        for (const msg of items) {
          if (set?.has(wrapped)) {
            wrapped(msg);
          }
        }
      });
    }

    return () => {
      set?.delete(wrapped);
    };
  }

  public emitMessage(type: string, payload: unknown): void {
    const set = this.handlers.get(type);
    if (set && set.size > 0) {
      for (const cb of set) {
        cb(payload);
      }
      return;
    }
    let queue = this.pendingMessages.get(type);
    if (!queue) {
      queue = [];
      this.pendingMessages.set(type, queue);
    }
    if (queue.length < 32) {
      queue.push(payload);
    }
  }

  public onLeave(callback: (code: number) => void): () => void {
    this.leaveHandlers.add(callback);
    if (this.pendingLeaveCode !== null) {
      const code = this.pendingLeaveCode;
      queueMicrotask(() => {
        if (this.leaveHandlers.has(callback)) {
          callback(code);
        }
      });
    }
    return () => {
      this.leaveHandlers.delete(callback);
    };
  }

  public emitLeave(code: number): void {
    if (this.pendingLeaveCode !== null) return;
    this.pendingLeaveCode = code;
    for (const cb of this.leaveHandlers) {
      cb(code);
    }
  }

  public clear(): void {
    this.handlers.clear();
    this.pendingMessages.clear();
    this.leaveHandlers.clear();
  }
}

async function instantiatePeerWithListeners<T>(
  factory: PeerLikeFactory,
  peerId: string | undefined,
  signaling: PeerSignalingEndpointConfig,
  setup: (
    peer: PeerInstanceLike,
    resolve: (val: T) => void,
    reject: (err: unknown) => void,
  ) => void,
): Promise<{ peer: PeerInstanceLike; result: T }> {
  const maybePromise = factory(peerId, signaling);
  const peer =
    typeof (maybePromise as Promise<PeerInstanceLike>).then === 'function'
      ? await (maybePromise as Promise<PeerInstanceLike>)
      : (maybePromise as PeerInstanceLike);

  const result = await new Promise<T>((resolve, reject) => {
    setup(peer, resolve, reject);
  });
  return { peer, result };
}

async function openRegisteredHostPeer(
  factory: PeerLikeFactory,
  signaling: PeerSignalingEndpointConfig,
  requestedCode: string | null,
  randomFn?: () => number,
): Promise<{ peer: PeerInstanceLike; roomCode: string }> {
  const maxAttempts = requestedCode ? 1 : 4;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = requestedCode ?? generateRoomCode(randomFn);
    const peerId = roomCodeToPeerId(code);
    let createdPeer: PeerInstanceLike | null = null;

    try {
      const { peer } = await instantiatePeerWithListeners<void>(
        factory,
        peerId,
        signaling,
        (p, resolve, reject) => {
          createdPeer = p;
          let settled = false;
          const timer = globalThis.setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error('Không thể kết nối máy chủ tín hiệu P2P (quá thời gian chờ).'));
          }, 10_000);

          p.on('open', () => {
            if (settled) return;
            settled = true;
            globalThis.clearTimeout(timer);
            resolve();
          });

          p.on('error', (err) => {
            if (settled) return;
            settled = true;
            globalThis.clearTimeout(timer);
            reject(err);
          });
        },
      );

      return { peer, roomCode: code };
    } catch (err) {
      lastErr = err;
      try {
        (createdPeer as PeerInstanceLike | null)?.destroy();
      } catch {
        // Ignore cleanup errors
      }
      const errType = (err as { type?: string } | null)?.type;
      if (!requestedCode && errType === 'unavailable-id' && attempt + 1 < maxAttempts) {
        continue;
      }
      if (errType === 'unavailable-id') {
        throw new Error(`Mã phòng "${code}" đang được sử dụng. Hãy tạo mã khác!`);
      }
      throw err instanceof Error
        ? err
        : new Error(err?.toString() ?? 'Không thể khởi tạo phòng Online P2P.');
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('Không thể khởi tạo phòng Online P2P.');
}

const LOCAL_HOST_SESSION_ID = '__local_p2p_host__';

/**
 * Opens a serverless WebRTC P2P Co-op room in the Host player's browser, running the
 * authoritative 60Hz `CoopRoomAuthority` stepped by `BackgroundTicker`.
 */
export async function createPeerHostRoom(
  options: CreatePeerHostRoomOptions,
): Promise<CoopRoomConnection> {
  const factory = options.peerFactory ?? defaultPeerFactory;
  const baseSignaling = resolvePeerRuntimeOptions();
  const signaling: PeerSignalingEndpointConfig = {
    ...baseSignaling,
    ...options.signaling,
    debug: 0,
  };

  const normalizedRequested = options.requestedRoomCode
    ? normalizeRoomCode(options.requestedRoomCode)
    : null;
  const { peer, roomCode } = await openRegisteredHostPeer(
    factory,
    signaling,
    normalizedRequested,
    options.randomFn,
  );

  const dispatcher = new MessageDispatcher();
  let closed = false;
  let remoteConnSeq = 1;
  const remoteConnections = new Set<PeerDataConnectionLike>();
  const pendingCloseTimers = new Set<ReturnType<typeof globalThis.setTimeout>>();
  const emptyWaiters = new Set<() => void>();
  let signalingReconnectTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  const clearPendingTimers = () => {
    if (signalingReconnectTimer !== null) {
      globalThis.clearTimeout(signalingReconnectTimer);
      signalingReconnectTimer = null;
    }
    for (const timer of pendingCloseTimers) {
      globalThis.clearTimeout(timer);
    }
    pendingCloseTimers.clear();
  };

  const notifyIfRemoteEmpty = () => {
    if (remoteConnections.size === 0 && emptyWaiters.size > 0) {
      const cbs = [...emptyWaiters];
      emptyWaiters.clear();
      for (const cb of cbs) cb();
    }
  };

  const authority = new CoopRoomAuthority({
    roomId: roomCode,
    seed: options.seed,
    startInHub: true,
    isDebugEnabled:
      options.isDebugEnabled ?? (() => isDebugUiEnabled() || isTestHooksEnabled()),
    reconnectGraceMs: options.reconnectGraceMs,
  });

  const localHostPeer: CoopAuthorityPeer = {
    sessionId: LOCAL_HOST_SESSION_ID,
    send(type, payload) {
      if (closed) return;
      dispatcher.emitMessage(type, payload);
    },
    close(code) {
      if (closed) return;
      dispatcher.emitLeave(code);
    },
  };

  authority.joinPeer(localHostPeer, {
    name: options.hostDisplayName,
    characterId: options.characterId,
  });

  const ticker: BackgroundTickerHandle = createBackgroundTicker(SIM_STEP_MS, (deltaMs) => {
    authority.step(deltaMs);
  });

  peer.on('disconnected', () => {
    if (closed || peer.destroyed || typeof peer.reconnect !== 'function') return;
    if (signalingReconnectTimer !== null) {
      globalThis.clearTimeout(signalingReconnectTimer);
    }
    signalingReconnectTimer = globalThis.setTimeout(() => {
      signalingReconnectTimer = null;
      if (!closed && !peer.destroyed) {
        try {
          peer.reconnect?.();
        } catch {
          // Ignore transient signaling reconnect errors
        }
      }
    }, 1_000);
  });

  peer.on('connection', (conn) => {
    if (closed) {
      conn.close();
      return;
    }
    remoteConnections.add(conn);
    const sessionId = `p2p_peer_${remoteConnSeq++}_${conn.peer}`;
    let joined = false;
    let closedByAuthority = false;
    let clientConsentedLeave = false;
    let connCloseFallbackTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

    const clearConnCloseFallback = () => {
      if (connCloseFallbackTimer !== null) {
        globalThis.clearTimeout(connCloseFallbackTimer);
        pendingCloseTimers.delete(connCloseFallbackTimer);
        connCloseFallbackTimer = null;
      }
    };

    const remotePeerAdapter: CoopAuthorityPeer = {
      sessionId,
      send(type, payload) {
        if (!conn.open) return;
        const env: P2PWireEnvelope = { t: type, p: payload };
        conn.send(env);
      },
      close(code) {
        closedByAuthority = true;
        if (conn.open) {
          const closeEnv: P2PWireEnvelope = { t: '__close__', code };
          conn.send(closeEnv);
          clearConnCloseFallback();
          connCloseFallbackTimer = globalThis.setTimeout(() => {
            connCloseFallbackTimer = null;
            try {
              conn.close();
            } catch {
              // Ignore close error
            }
          }, 250);
          pendingCloseTimers.add(connCloseFallbackTimer);
        }
      },
    };

    conn.on('data', (raw) => {
      if (closed || !raw || typeof raw !== 'object') return;
      const env = raw as P2PWireEnvelope;
      if (typeof env.t !== 'string') return;

      if (env.t === '__join__') {
        if (joined) return;
        joined = true;
        const joinPayload =
          'opts' in env && env.opts && typeof env.opts === 'object' ? env.opts : {};
        authority.joinPeer(remotePeerAdapter, joinPayload);
        return;
      }

      if (env.t === '__leave__') {
        if (!joined) return;
        clientConsentedLeave = Boolean((env as { consented?: boolean }).consented);
        closedByAuthority = true;
        authority.leavePeer(sessionId, clientConsentedLeave);
        try {
          conn.close();
        } catch {
          // Ignore close error
        }
        return;
      }

      if (!joined) return;
      authority.handleMessage(sessionId, env.t, (env as { p?: unknown }).p);
    });

    conn.on('close', () => {
      clearConnCloseFallback();
      remoteConnections.delete(conn);
      notifyIfRemoteEmpty();
      if (joined && !closedByAuthority && !closed) {
        authority.leavePeer(sessionId, clientConsentedLeave);
      }
    });

    conn.on('error', () => {
      clearConnCloseFallback();
      remoteConnections.delete(conn);
      notifyIfRemoteEmpty();
      if (joined && !closedByAuthority && !closed) {
        authority.leavePeer(sessionId, false);
      }
    });
  });

  const unregisterWindowLifecycle = () => {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('pagehide', onHostWindowUnload);
      window.removeEventListener('beforeunload', onHostWindowUnload);
    }
  };

  const onHostWindowUnload = () => {
    unregisterWindowLifecycle();
    if (closed) return;
    closed = true;
    ticker.stop();
    authority.leavePeer(LOCAL_HOST_SESSION_ID, true);
    authority.dispose();
    clearPendingTimers();
    for (const c of remoteConnections) {
      try {
        if (c.open) {
          c.send({ t: '__close__', code: 4000 } satisfies P2PWireEnvelope);
        }
        c.close();
      } catch {
        // Ignore
      }
    }
    remoteConnections.clear();
    notifyIfRemoteEmpty();
    try {
      peer.destroy();
    } catch {
      // Ignore
    }
    dispatcher.clear();
  };

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', onHostWindowUnload);
    window.addEventListener('beforeunload', onHostWindowUnload);
  }

  return {
    roomId: roomCode,
    send(type: string, message?: unknown): void {
      if (closed) return;
      authority.handleMessage(LOCAL_HOST_SESSION_ID, type, message);
    },
    onMessage<T = unknown>(type: string, callback: (message: T) => void): () => void {
      return dispatcher.onMessage(type, callback);
    },
    onLeave(callback: (code: number) => void): () => void {
      return dispatcher.onLeave(callback);
    },
    async leave(consented = true): Promise<void> {
      unregisterWindowLifecycle();
      if (closed) return;
      closed = true;
      ticker.stop();
      authority.leavePeer(LOCAL_HOST_SESSION_ID, consented);
      authority.dispose();
      // Wait until remote clients acknowledge/close after receiving __close__(4000) or 150ms flush window
      if (remoteConnections.size > 0) {
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            emptyWaiters.delete(finish);
            globalThis.clearTimeout(flushTimer);
            resolve();
          };
          const flushTimer = globalThis.setTimeout(finish, 150);
          emptyWaiters.add(finish);
        });
      }
      clearPendingTimers();
      for (const c of remoteConnections) {
        try {
          c.close();
        } catch {
          // Ignore
        }
      }
      remoteConnections.clear();
      try {
        peer.destroy();
      } catch {
        // Ignore
      }
      dispatcher.clear();
    },
  };
}

/**
 * Joins an existing Host player's Online P2P room using its 6-character Room Code over WebRTC DataChannel.
 */
export async function joinPeerClientRoom(
  options: JoinPeerClientRoomOptions,
): Promise<CoopRoomConnection> {
  const roomCode = normalizeRoomCode(options.roomCode);
  if (!roomCode) {
    throw new Error('Mã phòng Online không hợp lệ. Hãy nhập mã 6 ký tự (VD: 7K9M2P).');
  }

  const factory = options.peerFactory ?? defaultPeerFactory;
  const baseSignaling = resolvePeerRuntimeOptions();
  const signaling: PeerSignalingEndpointConfig = {
    ...baseSignaling,
    ...options.signaling,
    debug: 0,
  };

  const timeoutMs = options.timeoutMs ?? 10_000;
  const hostPeerId = roomCodeToPeerId(roomCode);
  const dispatcher = new MessageDispatcher();

  let createdPeer: PeerInstanceLike | null = null;
  let conn: PeerDataConnectionLike | null = null;
  let intentionalLeave = false;
  let closed = false;

  try {
    const opened = await instantiatePeerWithListeners<PeerDataConnectionLike>(
      factory,
      undefined,
      signaling,
      (p, resolve, reject) => {
        createdPeer = p;
        let settled = false;
        const timer = globalThis.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(
            new Error(
              `Không thể kết nối tới phòng "${roomCode}" (quá thời gian chờ mạng P2P).`,
            ),
          );
        }, timeoutMs);

        const fail = (err: Error) => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(timer);
          reject(err);
        };

        p.on('error', (err) => {
          const errType = err?.type ?? '';
          if (errType === 'peer-unavailable') {
            fail(
              new Error(
                `Không tìm thấy phòng Online "${roomCode}" hoặc Chủ phòng đã đóng phòng.`,
              ),
            );
            return;
          }
          fail(
            new Error(
              err?.message || `Lỗi kết nối P2P tới mã phòng "${roomCode}".`,
            ),
          );
        });

        p.on('open', () => {
          if (settled) return;
          const dc = p.connect(hostPeerId, { reliable: true });

          dc.on('open', () => {
            if (settled) return;
            settled = true;
            globalThis.clearTimeout(timer);
            resolve(dc);
          });

          dc.on('error', (dcErr) => {
            fail(
              dcErr instanceof Error
                ? dcErr
                : new Error(`Lỗi kênh dữ liệu P2P tới phòng "${roomCode}".`),
            );
          });
        });
      },
    );
    createdPeer = opened.peer;
    conn = opened.result;
  } catch (err) {
    try {
      (createdPeer as PeerInstanceLike | null)?.destroy();
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }

  const peer = createdPeer!;

  const activeConn = conn;

  activeConn.on('data', (raw) => {
    if (closed || !raw || typeof raw !== 'object') return;
    const env = raw as P2PWireEnvelope;
    if (typeof env.t !== 'string') return;

    if (env.t === '__close__') {
      const closeCode = typeof (env as { code?: unknown }).code === 'number'
        ? (env as { code: number }).code
        : 4000;
      closed = true;
      dispatcher.emitLeave(closeCode);
      queueMicrotask(() => {
        try {
          activeConn.close();
          peer.destroy();
        } catch {
          // Ignore
        }
      });
      return;
    }

    dispatcher.emitMessage(env.t, (env as { p?: unknown }).p);
  });

  const handleUnexpectedDisconnect = () => {
    if (closed || intentionalLeave) return;
    closed = true;
    try {
      peer.destroy();
    } catch {
      // Ignore
    }
    dispatcher.emitLeave(1006);
  };

  activeConn.on('close', handleUnexpectedDisconnect);
  activeConn.on('error', handleUnexpectedDisconnect);

  const joinEnvelope: P2PWireEnvelope = {
    t: '__join__',
    opts: {
      name: options.displayName,
      characterId: options.characterId,
      reconnectToken: options.reconnectToken,
    },
  };
  activeConn.send(joinEnvelope);

  return {
    roomId: roomCode,
    send(type: string, message?: unknown): void {
      if (closed || !activeConn.open) return;
      const env: P2PWireEnvelope = { t: type, p: message };
      activeConn.send(env);
    },
    onMessage<T = unknown>(type: string, callback: (message: T) => void): () => void {
      return dispatcher.onMessage(type, callback);
    },
    onLeave(callback: (code: number) => void): () => void {
      return dispatcher.onLeave(callback);
    },
    async leave(consented = true): Promise<void> {
      if (closed) return;
      intentionalLeave = true;
      closed = true;
      if (activeConn.open) {
        const leaveEnv: P2PWireEnvelope = { t: '__leave__', consented };
        activeConn.send(leaveEnv);
        // Wait for Host to process __leave__ and close the channel (or 150ms WAN fallback)
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            globalThis.clearTimeout(flushTimer);
            resolve();
          };
          const flushTimer = globalThis.setTimeout(finish, 150);
          activeConn.on('close', finish);
          activeConn.on('error', finish);
        });
        try {
          activeConn.close();
        } catch {
          // Ignore
        }
      }
      try {
        peer.destroy();
      } catch {
        // Ignore
      }
      dispatcher.clear();
    },
  };
}
