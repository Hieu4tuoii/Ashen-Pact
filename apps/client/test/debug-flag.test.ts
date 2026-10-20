import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isDebugUiEnabled,
  isEffectiveDebugUiEnabled,
  isServerDebugAllowed,
  isTestHooksEnabled,
  onDebugFlagsChanged,
  resetDebugFlagsForTest,
  resolveDebugFlags,
  setServerDebugAllowed,
  toggleDebugUi,
} from '../src/core/debug-flag.js';

describe('debug-flag resolution and runtime toggle', () => {
  beforeEach(() => {
    resetDebugFlagsForTest();
  });

  it('resolves debugUi, testHooks, and effectiveCoopDebugUi across dev and release combinations', () => {
    expect(
      resolveDebugFlags({
        isDev: true,
        search: '',
        storageDebug: null,
        serverDebugAllowed: false,
      }),
    ).toEqual({
      debugUi: true,
      testHooks: true,
      effectiveCoopDebugUi: false,
    });

    expect(
      resolveDebugFlags({
        isDev: true,
        search: '?debug=0',
        storageDebug: '1',
        serverDebugAllowed: false,
      }),
    ).toEqual({
      debugUi: false,
      testHooks: false,
      effectiveCoopDebugUi: false,
    });

    expect(
      resolveDebugFlags({
        isDev: true,
        search: '?debug=0&testHooks=1',
        storageDebug: null,
        serverDebugAllowed: false,
      }),
    ).toEqual({
      debugUi: false,
      testHooks: true,
      effectiveCoopDebugUi: false,
    });

    expect(
      resolveDebugFlags({
        isDev: false,
        search: '',
        storageDebug: null,
        serverDebugAllowed: false,
      }),
    ).toEqual({
      debugUi: false,
      testHooks: false,
      effectiveCoopDebugUi: false,
    });

    expect(
      resolveDebugFlags({
        isDev: false,
        search: '?testHooks=1',
        storageDebug: null,
        serverDebugAllowed: false,
      }),
    ).toEqual({
      debugUi: false,
      testHooks: false,
      effectiveCoopDebugUi: false,
    });

    expect(
      resolveDebugFlags({
        isDev: false,
        search: '',
        storageDebug: null,
        serverDebugAllowed: true,
      }),
    ).toEqual({
      debugUi: false,
      testHooks: true,
      effectiveCoopDebugUi: false,
    });

    expect(
      resolveDebugFlags({
        isDev: false,
        search: '?debug=1',
        storageDebug: null,
        serverDebugAllowed: true,
      }),
    ).toEqual({
      debugUi: true,
      testHooks: true,
      effectiveCoopDebugUi: true,
    });

    expect(
      resolveDebugFlags({
        isDev: false,
        search: '?debug=1',
        storageDebug: null,
        serverDebugAllowed: false,
      }),
    ).toEqual({
      debugUi: true,
      testHooks: true,
      effectiveCoopDebugUi: false,
    });

    expect(
      resolveDebugFlags({
        isDev: false,
        search: '',
        storageDebug: '1',
        serverDebugAllowed: true,
      }),
    ).toEqual({
      debugUi: true,
      testHooks: true,
      effectiveCoopDebugUi: true,
    });
  });

  it('toggles debugUi at runtime, persists to localStorage, and notifies listeners', () => {
    const store = new Map<string, string>();
    const fakeWindow = {
      location: { search: '?debug=0' },
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, val: string) => {
          store.set(key, val);
        },
      },
    };
    vi.stubGlobal('window', fakeWindow);

    resetDebugFlagsForTest();
    expect(isDebugUiEnabled()).toBe(false);
    expect(isTestHooksEnabled()).toBe(false);

    const listener = vi.fn();
    const unsub = onDebugFlagsChanged(listener);

    const next1 = toggleDebugUi();
    expect(next1).toBe(true);
    expect(isDebugUiEnabled()).toBe(true);
    expect(isTestHooksEnabled()).toBe(true);
    expect(store.get('ashen_pact_debug')).toBe('1');
    expect(listener).toHaveBeenCalledTimes(1);

    const next2 = toggleDebugUi();
    expect(next2).toBe(false);
    expect(isDebugUiEnabled()).toBe(false);
    expect(store.get('ashen_pact_debug')).toBe('0');
    expect(listener).toHaveBeenCalledTimes(2);

    setServerDebugAllowed(false);
    expect(isServerDebugAllowed()).toBe(false);
    expect(isEffectiveDebugUiEnabled(true)).toBe(false);

    toggleDebugUi();
    expect(isDebugUiEnabled()).toBe(true);
    expect(isEffectiveDebugUiEnabled(false)).toBe(true);
    expect(isEffectiveDebugUiEnabled(true)).toBe(false);

    setServerDebugAllowed(true);
    expect(isEffectiveDebugUiEnabled(true)).toBe(true);

    unsub();
    vi.unstubAllGlobals();
  });
});
