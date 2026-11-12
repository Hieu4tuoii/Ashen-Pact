export const KEYBIND_ACTION_IDS = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'skill',
  'dash',
  'interact',
  'swapWeapon',
  'reload',
  'dropWeapon',
  'toggleMap',
  'ping',
  'emote',
  'coopPanel',
] as const;

export type KeybindActionId = (typeof KEYBIND_ACTION_IDS)[number];

export type KeybindingsMap = Record<KeybindActionId, string>;

export const DEFAULT_KEYBINDINGS: Readonly<KeybindingsMap> = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  skill: 'Space',
  dash: 'Shift',
  interact: 'KeyE',
  swapWeapon: 'KeyQ',
  reload: 'KeyR',
  dropWeapon: 'KeyX',
  toggleMap: 'Tab',
  ping: 'KeyZ',
  emote: 'KeyT',
  coopPanel: 'KeyI',
};

export type NormalizedKeyCapture =
  | { status: 'valid'; code: string; displayLabel: string; keyCode: number }
  | { status: 'cancel' }
  | { status: 'reserved'; displayLabel: string }
  | { status: 'unsupported'; displayLabel: string };

export type KeybindUpdateResult =
  | {
      ok: true;
      changed: boolean;
      keybindings: KeybindingsMap;
      swappedWith: KeybindActionId | null;
      boundCode: string;
      previousCode: string;
    }
  | {
      ok: false;
      reason: 'reserved' | 'unsupported';
      displayLabel: string;
      keybindings: KeybindingsMap;
      swappedWith: null;
    };

interface CanonicalBindingSpec {
  code: string;
  keyCode: number;
  displayLabel: string;
  captureBrowserDefault: boolean;
}

const CANONICAL_BINDINGS = new Map<string, CanonicalBindingSpec>();
const ALIAS_TO_CANONICAL = new Map<string, string>();
const KEYCODE_TO_CANONICAL = new Map<number, string>();

function registerBinding(
  code: string,
  keyCode: number,
  displayLabel: string,
  captureBrowserDefault: boolean,
  aliases: readonly string[] = [],
): void {
  CANONICAL_BINDINGS.set(code, { code, keyCode, displayLabel, captureBrowserDefault });
  ALIAS_TO_CANONICAL.set(code, code);
  ALIAS_TO_CANONICAL.set(code.toLowerCase(), code);
  KEYCODE_TO_CANONICAL.set(keyCode, code);
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(alias, code);
    if (alias.length > 1) {
      ALIAS_TO_CANONICAL.set(alias.toLowerCase(), code);
    }
  }
}

for (let i = 0; i < 26; i++) {
  const upper = String.fromCharCode(65 + i);
  const lower = upper.toLowerCase();
  registerBinding(`Key${upper}`, 65 + i, upper, false, [upper, lower]);
}

registerBinding('Shift', 16, 'Shift', false, ['ShiftLeft', 'ShiftRight']);
registerBinding('Control', 17, 'Ctrl', false, ['ControlLeft', 'ControlRight', 'Ctrl']);
registerBinding('Alt', 18, 'Alt', true, ['AltLeft', 'AltRight']);
registerBinding('Space', 32, 'Space', true, [' ', 'Spacebar']);
registerBinding('Tab', 9, 'Tab', true);
registerBinding('Backspace', 8, 'Bksp', true);
registerBinding('ArrowUp', 38, '↑', true, ['Up']);
registerBinding('ArrowDown', 40, '↓', true, ['Down']);
registerBinding('ArrowLeft', 37, '←', true, ['Left']);
registerBinding('ArrowRight', 39, '→', true, ['Right']);
registerBinding('Comma', 188, ',', false, [',', '<']);
registerBinding('Period', 190, '.', false, ['.', '>']);
registerBinding('Slash', 191, '/', false, ['/', '?']);
registerBinding('Semicolon', 186, ';', false, [';', ':']);
registerBinding('Quote', 222, "'", false, ["'", '"']);
registerBinding('BracketLeft', 219, '[', false, ['[', '{']);
registerBinding('BracketRight', 221, ']', false, [']', '}']);
registerBinding('Backslash', 220, '\\', false, ['\\', '|']);
registerBinding('Minus', 189, '-', false, ['-', '_']);
registerBinding('Equal', 187, '=', false, ['=', '+']);
registerBinding('Backquote', 192, '`', false, ['`', '~']);

const KEYBIND_ACTION_SET = new Set<string>(KEYBIND_ACTION_IDS);

const RESERVED_EXACT_LABELS = new Map<string, string>([
  ['enter', 'Enter'],
  ['numpadenter', 'Enter'],
  ['metaleft', 'Meta'],
  ['metaright', 'Meta'],
  ['meta', 'Meta'],
  ['osleft', 'Meta'],
  ['osright', 'Meta'],
  ['os', 'Meta'],
  ['super', 'Meta'],
  ['contextmenu', 'Menu'],
  ['capslock', 'CapsLock'],
  ['numlock', 'NumLock'],
  ['scrolllock', 'ScrollLock'],
  ['printscreen', 'PrtSc'],
  ['pause', 'Pause'],
  ['insert', 'Ins'],
  ['delete', 'Del'],
  ['home', 'Home'],
  ['end', 'End'],
  ['pageup', 'PgUp'],
  ['pagedown', 'PgDn'],
]);

const RESERVED_KEYCODE_LABELS = new Map<number, string>([
  [13, 'Enter'],
  [19, 'Pause'],
  [20, 'CapsLock'],
  [33, 'PgUp'],
  [34, 'PgDn'],
  [35, 'End'],
  [36, 'Home'],
  [44, 'PrtSc'],
  [45, 'Ins'],
  [46, 'Del'],
  [91, 'Meta'],
  [92, 'Meta'],
  [93, 'Menu'],
  [144, 'NumLock'],
  [145, 'ScrollLock'],
]);

function classifyReservedToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digitMatch = /^Digit([0-9])$/i.exec(trimmed);
  if (digitMatch) return digitMatch[1]!;

  if (/^[0-9]$/.test(trimmed)) return trimmed;

  const numpadMatch = /^Numpad([0-9])$/i.exec(trimmed);
  if (numpadMatch) return `Num${numpadMatch[1]!}`;

  const fnMatch = /^F([1-9]|1[0-9]|2[0-4])$/i.exec(trimmed);
  if (fnMatch) return `F${fnMatch[1]!}`;

  return RESERVED_EXACT_LABELS.get(trimmed.toLowerCase()) ?? null;
}

function classifyReservedKeyCode(keyCode: number): string | null {
  if (keyCode >= 48 && keyCode <= 57) {
    return String(keyCode - 48);
  }
  if (keyCode >= 96 && keyCode <= 105) {
    return `Num${keyCode - 96}`;
  }
  if (keyCode >= 112 && keyCode <= 135) {
    return `F${keyCode - 111}`;
  }
  return RESERVED_KEYCODE_LABELS.get(keyCode) ?? null;
}

export function normalizeBindingCode(rawCode: string): string | null {
  if (typeof rawCode !== 'string' || rawCode.length === 0) return null;
  if (rawCode === ' ') return 'Space';

  const trimmed = rawCode.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  if (lowered === 'escape' || lowered === 'esc') return null;
  if (classifyReservedToken(trimmed) !== null) return null;

  const direct = ALIAS_TO_CANONICAL.get(trimmed) ?? ALIAS_TO_CANONICAL.get(lowered);
  return direct ?? null;
}

export function normalizeKeyEventToBindingCode(event: {
  code?: string;
  key?: string;
  keyCode?: number;
}): NormalizedKeyCapture {
  const rawCode = typeof event.code === 'string' ? event.code : '';
  const rawKey = typeof event.key === 'string' ? event.key : '';
  const rawKeyCode = typeof event.keyCode === 'number' ? event.keyCode : undefined;

  if (
    rawCode.trim().toLowerCase() === 'escape' ||
    rawKey.trim().toLowerCase() === 'escape' ||
    rawKey.trim().toLowerCase() === 'esc' ||
    rawKeyCode === 27
  ) {
    return { status: 'cancel' };
  }

  const trimmedCode = rawCode.trim();
  const hasPhysicalCode = trimmedCode.length > 0 && trimmedCode !== 'Unidentified';

  // 1. Prefer physical KeyboardEvent.code when present
  if (hasPhysicalCode) {
    const reservedByCode = classifyReservedToken(trimmedCode);
    if (reservedByCode !== null) {
      return { status: 'reserved', displayLabel: reservedByCode };
    }
    const normalizedByCode = normalizeBindingCode(trimmedCode);
    if (normalizedByCode !== null) {
      const spec = CANONICAL_BINDINGS.get(normalizedByCode)!;
      return {
        status: 'valid',
        code: spec.code,
        displayLabel: spec.displayLabel,
        keyCode: spec.keyCode,
      };
    }
  }

  // 2. Fallback to KeyboardEvent.key for synthetic or Unidentified-code events
  const hasMeaningfulKey = rawKey.length > 0 && rawKey !== 'Unidentified';
  if (!hasPhysicalCode && hasMeaningfulKey) {
    const reservedByKey = classifyReservedToken(rawKey);
    if (reservedByKey !== null) {
      return { status: 'reserved', displayLabel: reservedByKey };
    }
    const normalizedByKey = normalizeBindingCode(rawKey);
    if (normalizedByKey !== null) {
      const spec = CANONICAL_BINDINGS.get(normalizedByKey)!;
      return {
        status: 'valid',
        code: spec.code,
        displayLabel: spec.displayLabel,
        keyCode: spec.keyCode,
      };
    }
  }

  // 3. Fallback to numeric keyCode when neither code nor key resolved
  if (rawKeyCode !== undefined && !hasPhysicalCode && !hasMeaningfulKey) {
    const reservedByKeyCode = classifyReservedKeyCode(rawKeyCode);
    if (reservedByKeyCode !== null) {
      return { status: 'reserved', displayLabel: reservedByKeyCode };
    }
    const canonicalByKeyCode = KEYCODE_TO_CANONICAL.get(rawKeyCode);
    if (canonicalByKeyCode !== undefined) {
      const spec = CANONICAL_BINDINGS.get(canonicalByKeyCode)!;
      return {
        status: 'valid',
        code: spec.code,
        displayLabel: spec.displayLabel,
        keyCode: spec.keyCode,
      };
    }
  }

  const fallbackLabel =
    (hasPhysicalCode ? trimmedCode : '') || (hasMeaningfulKey ? rawKey.trim() : '') || '?';
  return { status: 'unsupported', displayLabel: fallbackLabel };
}

export function getKeyCodeForBinding(code: string): number {
  const normalized = normalizeBindingCode(code);
  if (!normalized) return 0;
  return CANONICAL_BINDINGS.get(normalized)?.keyCode ?? 0;
}

export function getKeybindDisplayLabel(code: string): string {
  const normalized = normalizeBindingCode(code);
  if (normalized) {
    const spec = CANONICAL_BINDINGS.get(normalized);
    if (spec) return spec.displayLabel;
  }
  const reserved = classifyReservedToken(code);
  if (reserved) return reserved;
  const trimmed = code.trim();
  return trimmed || '?';
}

export function getActionDisplayLabel(
  action: KeybindActionId,
  bindings: Readonly<KeybindingsMap> = DEFAULT_KEYBINDINGS,
): string {
  const code = bindings[action] ?? DEFAULT_KEYBINDINGS[action];
  return getKeybindDisplayLabel(code);
}

export function applyKeybindingChange(
  current: Readonly<KeybindingsMap>,
  action: KeybindActionId,
  rawCode: string,
): KeybindUpdateResult {
  const capture = normalizeKeyEventToBindingCode({ code: rawCode, key: rawCode });
  if (capture.status === 'cancel') {
    return {
      ok: false,
      reason: 'reserved',
      displayLabel: 'Esc',
      keybindings: { ...current },
      swappedWith: null,
    };
  }
  if (capture.status === 'reserved' || capture.status === 'unsupported') {
    return {
      ok: false,
      reason: capture.status,
      displayLabel: capture.displayLabel,
      keybindings: { ...current },
      swappedWith: null,
    };
  }

  const nextCode = capture.code;
  const previousCode = normalizeBindingCode(current[action]) ?? DEFAULT_KEYBINDINGS[action];
  const next: KeybindingsMap = { ...current };

  if (previousCode === nextCode && current[action] === nextCode) {
    return {
      ok: true,
      changed: false,
      keybindings: next,
      swappedWith: null,
      boundCode: nextCode,
      previousCode,
    };
  }

  let swappedWith: KeybindActionId | null = null;
  for (const otherAction of KEYBIND_ACTION_IDS) {
    if (otherAction === action) continue;
    const otherNormalized = normalizeBindingCode(current[otherAction]) ?? current[otherAction];
    if (otherNormalized === nextCode) {
      swappedWith = otherAction;
      break;
    }
  }

  next[action] = nextCode;
  if (swappedWith !== null) {
    next[swappedWith] = previousCode;
  }

  return {
    ok: true,
    changed: true,
    keybindings: next,
    swappedWith,
    boundCode: nextCode,
    previousCode,
  };
}

export function sanitizeKeybindings(raw: unknown): KeybindingsMap {
  const assigned: Partial<Record<KeybindActionId, string>> = {};
  const usedCodes = new Set<string>();

  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!KEYBIND_ACTION_SET.has(key) || typeof value !== 'string') continue;
      const normalized = normalizeBindingCode(value);
      if (!normalized || usedCodes.has(normalized)) continue;
      assigned[key as KeybindActionId] = normalized;
      usedCodes.add(normalized);
    }
  }

  // Prefer each unassigned action's own default binding when unclaimed
  for (const action of KEYBIND_ACTION_IDS) {
    if (assigned[action] !== undefined) continue;
    const defaultCode = DEFAULT_KEYBINDINGS[action];
    if (!usedCodes.has(defaultCode)) {
      assigned[action] = defaultCode;
      usedCodes.add(defaultCode);
    }
  }

  // Assign remaining displaced actions from unclaimed defaults, then canonical bindings
  for (const action of KEYBIND_ACTION_IDS) {
    if (assigned[action] !== undefined) continue;
    let fallback: string | undefined;
    for (const candidateAction of KEYBIND_ACTION_IDS) {
      const candidateCode = DEFAULT_KEYBINDINGS[candidateAction];
      if (!usedCodes.has(candidateCode)) {
        fallback = candidateCode;
        break;
      }
    }
    if (!fallback) {
      for (const candidateCode of CANONICAL_BINDINGS.keys()) {
        if (!usedCodes.has(candidateCode)) {
          fallback = candidateCode;
          break;
        }
      }
    }
    const chosen = fallback ?? DEFAULT_KEYBINDINGS[action];
    assigned[action] = chosen;
    usedCodes.add(chosen);
  }

  const result = {} as KeybindingsMap;
  for (const action of KEYBIND_ACTION_IDS) {
    result[action] = assigned[action]!;
  }
  return result;
}

export function isBindingCodeUsed(bindings: Readonly<KeybindingsMap>, code: string): boolean {
  const target = normalizeBindingCode(code);
  if (!target) return false;
  for (const action of KEYBIND_ACTION_IDS) {
    if (normalizeBindingCode(bindings[action]) === target) {
      return true;
    }
  }
  return false;
}

export function shouldCaptureBrowserKey(code: string): boolean {
  const normalized = normalizeBindingCode(code);
  if (!normalized) return false;
  return CANONICAL_BINDINGS.get(normalized)?.captureBrowserDefault ?? false;
}

export function serializeKeybindingsHash(bindings: Readonly<KeybindingsMap>): string {
  return `${bindings.moveUp}|${bindings.moveDown}|${bindings.moveLeft}|${bindings.moveRight}|${bindings.skill}|${bindings.dash}|${bindings.interact}|${bindings.swapWeapon}|${bindings.reload}|${bindings.dropWeapon}|${bindings.toggleMap}|${bindings.ping}|${bindings.emote}|${bindings.coopPanel}`;
}
