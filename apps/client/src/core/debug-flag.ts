/// <reference types="vite/client" />

export const DEBUG_STORAGE_KEY = 'ashen_pact_debug';

export interface DebugFlagsInput {
  isDev: boolean;
  search: string;
  storageDebug: string | null;
  serverDebugAllowed: boolean;
  runtimeOverride?: boolean | null;
}

export interface ResolvedDebugFlags {
  debugUi: boolean;
  testHooks: boolean;
  effectiveCoopDebugUi: boolean;
}

export function resolveDebugFlags(input: DebugFlagsInput): ResolvedDebugFlags {
  const params = new URLSearchParams(input.search);
  const rawDebug = params.get('debug')?.trim().toLowerCase();
  const urlDebug =
    rawDebug === '1' || rawDebug === 'true'
      ? true
      : rawDebug === '0' || rawDebug === 'false'
        ? false
        : null;

  const rawTestHooks = params.get('testHooks')?.trim().toLowerCase();
  const urlTestHooks = rawTestHooks === '1' || rawTestHooks === 'true';

  let debugUi: boolean;
  if (typeof input.runtimeOverride === 'boolean') {
    debugUi = input.runtimeOverride;
  } else if (urlDebug === false) {
    debugUi = false;
  } else {
    debugUi = Boolean(input.isDev) || urlDebug === true || input.storageDebug === '1';
  }

  const testHooks =
    debugUi || (Boolean(input.isDev) && urlTestHooks) || Boolean(input.serverDebugAllowed);
  const effectiveCoopDebugUi = debugUi && Boolean(input.serverDebugAllowed);

  return {
    debugUi,
    testHooks,
    effectiveCoopDebugUi,
  };
}

let runtimeDebugUiOverride: boolean | null = null;
let serverDebugAllowedState: boolean | null = null;
let hotkeyInstalled = false;
let toastFadeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function getIsDev(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

function getSearchString(): string {
  if (typeof window !== 'undefined' && window.location && typeof window.location.search === 'string') {
    return window.location.search;
  }
  return '';
}

function getStorageDebugValue(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(DEBUG_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

function notifyDebugFlagsChanged(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  }
}

export function isServerDebugAllowed(): boolean {
  return serverDebugAllowedState ?? getIsDev();
}

export function setServerDebugAllowed(allowed: boolean): void {
  const next = Boolean(allowed);
  if (serverDebugAllowedState === next) return;
  serverDebugAllowedState = next;
  notifyDebugFlagsChanged();
}

export function isDebugUiEnabled(): boolean {
  return resolveDebugFlags({
    isDev: getIsDev(),
    search: getSearchString(),
    storageDebug: getStorageDebugValue(),
    serverDebugAllowed: serverDebugAllowedState === true,
    runtimeOverride: runtimeDebugUiOverride,
  }).debugUi;
}

export function isEffectiveDebugUiEnabled(isCoop = false): boolean {
  const debugUi = isDebugUiEnabled();
  if (!isCoop) return debugUi;
  return debugUi && isServerDebugAllowed();
}

export function isTestHooksEnabled(): boolean {
  return resolveDebugFlags({
    isDev: getIsDev(),
    search: getSearchString(),
    storageDebug: getStorageDebugValue(),
    serverDebugAllowed: serverDebugAllowedState === true,
    runtimeOverride: runtimeDebugUiOverride,
  }).testHooks;
}

export function showDebugToast(message: string): void {
  if (typeof document === 'undefined' || !document.body) return;
  let toast = document.getElementById('ashen-pact-debug-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ashen-pact-debug-toast';
    toast.style.position = 'fixed';
    toast.style.top = '14px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.zIndex = '99999';
    toast.style.pointerEvents = 'none';
    toast.style.padding = '6px 16px';
    toast.style.borderRadius = '6px';
    toast.style.background = 'rgba(11, 9, 14, 0.92)';
    toast.style.border = '1.5px solid #38bdf8';
    toast.style.color = '#f8fafc';
    toast.style.fontFamily = '"Be Vietnam Pro", monospace';
    toast.style.fontSize = '13px';
    toast.style.fontWeight = '700';
    toast.style.letterSpacing = '0.5px';
    toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
    toast.style.transition = 'opacity 0.25s ease';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  if (toastFadeTimer !== null) {
    clearTimeout(toastFadeTimer);
  }
  toastFadeTimer = setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
    }
    toastFadeTimer = null;
  }, 1800);
}

export function toggleDebugUi(): boolean {
  const next = !isDebugUiEnabled();
  runtimeDebugUiOverride = next;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DEBUG_STORAGE_KEY, next ? '1' : '0');
    }
  } catch {
    // Ignore storage write errors
  }
  showDebugToast(next ? 'Debug ON' : 'Debug OFF');
  notifyDebugFlagsChanged();
  return next;
}

export function onDebugFlagsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetDebugFlagsForTest(): void {
  runtimeDebugUiOverride = null;
  serverDebugAllowedState = null;
  listeners.clear();
}

export function installDebugHotkeyListener(): void {
  if (hotkeyInstalled) return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  hotkeyInstalled = true;
  window.addEventListener(
    'keydown',
    (ev: KeyboardEvent) => {
      if (
        (ev.ctrlKey || ev.metaKey) &&
        ev.shiftKey &&
        (ev.key === 'D' || ev.key === 'd' || ev.code === 'KeyD')
      ) {
        ev.preventDefault();
        ev.stopPropagation();
        toggleDebugUi();
      }
    },
    { capture: true },
  );
}
