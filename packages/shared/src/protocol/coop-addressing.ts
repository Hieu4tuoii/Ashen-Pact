/**
 * Co-op Room Code generation, normalization, PeerJS ID mapping, and smart target URL/endpoint parsing.
 * Shared across @ashen-pact/client and @ashen-pact/shared tests.
 */

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const DEFAULT_ROOM_CODE_LENGTH = 6;
const PEER_ID_PREFIX = 'ashen-pact-v2-room-';

/**
 * Generates an unambiguous 6-character uppercase alphanumeric Room Code (excludes 0, O, 1, I).
 */
export function generateRoomCode(randomFn: () => number = Math.random): string {
  let out = '';
  const len = ROOM_CODE_ALPHABET.length;
  for (let i = 0; i < DEFAULT_ROOM_CODE_LENGTH; i++) {
    const raw = randomFn();
    const idx = Math.min(len - 1, Math.max(0, Math.floor(raw * len)));
    out += ROOM_CODE_ALPHABET[idx]!;
  }
  return out;
}

/**
 * Normalizes a user-typed or pasted Room Code (e.g. `' 7k9-m2p '`, `'ap-7k9m2p'`, `'p2p:7k9m2p'`)
 * into canonical uppercase (`'7K9M2P'`), or returns `null` if the string looks like an IP/domain/URL
 * or is outside 4..12 alphanumeric characters.
 */
export function normalizeRoomCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/[./?&=\\@]/.test(trimmed)) return null;

  let body = trimmed;
  if (/^p2p:/i.test(body)) {
    body = body.slice(4);
  } else if (/^ap-/i.test(body)) {
    body = body.slice(3);
  }

  if (body.includes(':')) return null;

  const cleaned = body.replace(/[-\s]+/g, '').toUpperCase();
  if (!cleaned || cleaned === 'LOCALHOST') return null;
  if (!/^[A-Z0-9]{4,12}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Deterministically maps a Room Code to its public PeerJS signaling ID.
 */
export function roomCodeToPeerId(roomCode: string): string {
  const normalized = normalizeRoomCode(roomCode) ?? roomCode.trim();
  return `${PEER_ID_PREFIX}${normalized.toLowerCase()}`;
}

function isBareIpv4OrLocalhost(hostWithoutScheme: string): boolean {
  const lower = hostWithoutScheme.toLowerCase();
  if (lower === 'localhost') return true;
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(lower);
}

/**
 * Formats a host/port or URL string for clean display in the Sanctuary input box without
 * falsely appending `:2567` to portless domains (`wss://foo.onrender.com` -> `foo.onrender.com`),
 * while appending `:2567` to bare IPv4 / `localhost` (`192.168.1.25` -> `192.168.1.25:2567`).
 */
export function formatCoopHostPortDisplay(hostPortOrUrl: string): string {
  const trimmed = hostPortOrUrl.trim();
  if (!trimmed) return '';

  const withoutScheme = trimmed
    .replace(/^(?:wss?|https?):\/\//i, '')
    .replace(/\/.*$/, '');
  if (!withoutScheme) return '';

  if (withoutScheme.includes(':')) {
    return withoutScheme;
  }
  if (isBareIpv4OrLocalhost(withoutScheme)) {
    return `${withoutScheme}:2567`;
  }
  return withoutScheme;
}

/**
 * Resolves a Colyseus WebSocket endpoint URL (`ws://` or `wss://`) from a user-provided
 * IP, `host:port`, `http(s)://` URL, or `ws(s)://` URL. Appends `:2567` ONLY when the host
 * is a bare IPv4 address or `localhost` without an explicit port.
 */
export function resolveWsEndpointUrl(hostPortOrUrl: string, pageProtocol?: string): string {
  const trimmed = hostPortOrUrl.trim();
  const preferSecure = pageProtocol === 'https:';

  if (!trimmed) {
    return `${preferSecure ? 'wss:' : 'ws:'}//127.0.0.1:2567`;
  }

  if (/^wss?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return trimmed.replace(/\/+$/, '');
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProto}//${parsed.host}`;
    } catch {
      const wsProto = /^https:/i.test(trimmed) ? 'wss:' : 'ws:';
      const rest = trimmed.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      return `${wsProto}//${rest}`;
    }
  }

  const hostOnly = trimmed.replace(/\/.*$/, '');
  if (hostOnly.includes(':')) {
    return `${preferSecure ? 'wss:' : 'ws:'}//${hostOnly}`;
  }
  if (isBareIpv4OrLocalhost(hostOnly)) {
    return `${preferSecure ? 'wss:' : 'ws:'}//${hostOnly}:2567`;
  }
  const domainScheme = pageProtocol === 'http:' ? 'ws:' : 'wss:';
  return `${domainScheme}//${hostOnly}`;
}

export type ParsedCoopTarget =
  | { kind: 'empty' }
  | { kind: 'p2p'; roomCode: string }
  | { kind: 'colyseus'; wsUrl: string; hostPortDisplay: string; roomId?: string };

export interface ParseCoopTargetOptions {
  pageProtocol?: string;
  pageOrigin?: string;
  preferredTransport?: 'p2p' | 'lan';
}

/**
 * Classifies any user input in the Sanctuary Room Code / IP box:
 * - Pasted Vercel/HTTPS invite URL (`https://.../?join=7K9M2P&p2p=1` or `https://.../?join=7K9M2P`) -> `p2p`
 * - Bare or formatted Room Code (`7K9M2P`, `ap-7k9-m2p`, `p2p:7K9M2P`) -> `p2p`
 * - Pasted LAN invite URL (`http://192.168.1.25:2567/?join=abc` or `?server=...`) -> `colyseus`
 * - Cloud `wss://` / `https://` domain or LAN IPv4 / `localhost` -> `colyseus`
 */
export function parseCoopTargetInput(
  rawInput: string,
  opts?: ParseCoopTargetOptions,
): ParsedCoopTarget {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { kind: 'empty' };
  }

  if (/^(?:https?|wss?):\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const p2pFlag =
        url.searchParams.get('p2p') === '1' || url.searchParams.get('p2p') === 'true';
      const joinParam = url.searchParams.get('join')?.trim() ?? '';
      const serverParam = url.searchParams.get('server')?.trim() ?? '';

      if (serverParam) {
        return {
          kind: 'colyseus',
          wsUrl: resolveWsEndpointUrl(serverParam, url.protocol),
          hostPortDisplay: formatCoopHostPortDisplay(serverParam),
          ...(joinParam ? { roomId: joinParam } : {}),
        };
      }

      if (p2pFlag && joinParam) {
        const code = normalizeRoomCode(joinParam);
        if (code) {
          return { kind: 'p2p', roomCode: code };
        }
      }

      if (
        joinParam &&
        (url.protocol === 'https:' || /^p2p:/i.test(joinParam)) &&
        url.port !== '2567'
      ) {
        const code = normalizeRoomCode(joinParam);
        if (code) {
          return { kind: 'p2p', roomCode: code };
        }
      }

      const wsUrl = resolveWsEndpointUrl(`${url.protocol}//${url.host}`, opts?.pageProtocol);
      const hostPortDisplay = formatCoopHostPortDisplay(`${url.protocol}//${url.host}`);
      return {
        kind: 'colyseus',
        wsUrl,
        hostPortDisplay,
        ...(joinParam ? { roomId: joinParam } : {}),
      };
    } catch {
      // Fall through to non-URL handling if URL is malformed
    }
  }

  const roomCode = normalizeRoomCode(trimmed);
  if (roomCode) {
    return { kind: 'p2p', roomCode };
  }

  return {
    kind: 'colyseus',
    wsUrl: resolveWsEndpointUrl(trimmed, opts?.pageProtocol),
    hostPortDisplay: formatCoopHostPortDisplay(trimmed),
  };
}
