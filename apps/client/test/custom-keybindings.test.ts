import { collectLeafKeys, enLocale, i18n, viLocale } from '@ashen-pact/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  };
  return { default: PhaserMock, ...PhaserMock };
});

import { initGlobalDebugState } from '../src/ui/debug-overlay.js';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  GraphicsSettingsManager,
  graphicsSettings,
} from '../src/ui/graphics-settings.js';
import {
  applyKeybindingChange,
  DEFAULT_KEYBINDINGS,
  getActionDisplayLabel,
  getKeybindDisplayLabel,
  getKeyCodeForBinding,
  isBindingCodeUsed,
  KEYBIND_ACTION_IDS,
  normalizeBindingCode,
  normalizeKeyEventToBindingCode,
  sanitizeKeybindings,
  serializeKeybindingsHash,
  shouldCaptureBrowserKey,
} from '../src/ui/keybindings.js';

function createFakeWindow(initialEntries: Array<[string, string]> = []) {
  const store = new Map<string, string>(initialEntries);
  return {
    store,
    windowObj: {
      devicePixelRatio: 1,
      location: { search: '' },
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, val: string) => {
          store.set(key, val);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    },
  };
}

describe('Customizable Keybindings — Task 1: Registry, Persistence, Debug State & Bilingual i18n', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    graphicsSettings.resetDefaults();
    i18n.setLocale('vi');
  });

  it('defines 14 default keybindings with self-contained numeric keyCodes and display labels without Phaser KeyCodes', () => {
    expect(KEYBIND_ACTION_IDS).toEqual([
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
    ]);
    expect(KEYBIND_ACTION_IDS).toHaveLength(14);

    expect(DEFAULT_KEYBINDINGS).toEqual({
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
    });
    expect(DEFAULT_KEYBINDINGS.interact).toBe('KeyE');

    expect(getKeyCodeForBinding('KeyW')).toBe(87);
    expect(getKeyCodeForBinding('KeyA')).toBe(65);
    expect(getKeyCodeForBinding('KeyZ')).toBe(90);
    expect(getKeyCodeForBinding('Shift')).toBe(16);
    expect(getKeyCodeForBinding('Control')).toBe(17);
    expect(getKeyCodeForBinding('Alt')).toBe(18);
    expect(getKeyCodeForBinding('Space')).toBe(32);
    expect(getKeyCodeForBinding('Tab')).toBe(9);
    expect(getKeyCodeForBinding('Backspace')).toBe(8);
    expect(getKeyCodeForBinding('ArrowUp')).toBe(38);
    expect(getKeyCodeForBinding('ArrowDown')).toBe(40);
    expect(getKeyCodeForBinding('ArrowLeft')).toBe(37);
    expect(getKeyCodeForBinding('ArrowRight')).toBe(39);
    expect(getKeyCodeForBinding('Comma')).toBe(188);
    expect(getKeyCodeForBinding('Slash')).toBe(191);

    expect(getKeybindDisplayLabel('ArrowUp')).toBe('↑');
    expect(getKeybindDisplayLabel('ArrowDown')).toBe('↓');
    expect(getKeybindDisplayLabel('ArrowLeft')).toBe('←');
    expect(getKeybindDisplayLabel('ArrowRight')).toBe('→');
    expect(getKeybindDisplayLabel('Control')).toBe('Ctrl');
    expect(getKeybindDisplayLabel('Backspace')).toBe('Bksp');
    expect(getKeybindDisplayLabel('KeyE')).toBe('E');

    expect(getActionDisplayLabel('interact')).toBe('E');
    expect(getActionDisplayLabel('interact', { ...DEFAULT_KEYBINDINGS, interact: 'KeyF' })).toBe(
      'F',
    );

    expect(shouldCaptureBrowserKey('Tab')).toBe(true);
    expect(shouldCaptureBrowserKey('Space')).toBe(true);
    expect(shouldCaptureBrowserKey('ArrowUp')).toBe(true);
    expect(shouldCaptureBrowserKey('KeyE')).toBe(false);

    expect(isBindingCodeUsed(DEFAULT_KEYBINDINGS, 'KeyE')).toBe(true);
    expect(isBindingCodeUsed(DEFAULT_KEYBINDINGS, 'KeyF')).toBe(false);

    const defaultHash = serializeKeybindingsHash(DEFAULT_KEYBINDINGS);
    const modifiedHash = serializeKeybindingsHash({ ...DEFAULT_KEYBINDINGS, interact: 'KeyF' });
    expect(defaultHash.length).toBeGreaterThan(0);
    expect(modifiedHash).not.toBe(defaultHash);
  });

  it('normalizes DOM KeyboardEvents including ShiftLeft/ShiftRight, code-less synthetic key events, Escape cancel, and reserved Digit/Enter/Function keys', () => {
    expect(normalizeKeyEventToBindingCode({ code: 'ShiftLeft', key: 'Shift' })).toEqual({
      status: 'valid',
      code: 'Shift',
      keyCode: 16,
      displayLabel: 'Shift',
    });
    expect(normalizeKeyEventToBindingCode({ code: 'ShiftRight', key: 'Shift' })).toEqual({
      status: 'valid',
      code: 'Shift',
      keyCode: 16,
      displayLabel: 'Shift',
    });
    expect(normalizeKeyEventToBindingCode({ code: 'ControlLeft', key: 'Control' })).toEqual({
      status: 'valid',
      code: 'Control',
      keyCode: 17,
      displayLabel: 'Ctrl',
    });
    expect(normalizeKeyEventToBindingCode({ code: 'AltRight', key: 'Alt' })).toEqual({
      status: 'valid',
      code: 'Alt',
      keyCode: 18,
      displayLabel: 'Alt',
    });

    // Code-less or Unidentified-code synthetic KeyboardEvents
    expect(normalizeKeyEventToBindingCode({ key: 'f' })).toEqual({
      status: 'valid',
      code: 'KeyF',
      keyCode: 70,
      displayLabel: 'F',
    });
    expect(normalizeKeyEventToBindingCode({ code: 'Unidentified', key: 'f' })).toEqual({
      status: 'valid',
      code: 'KeyF',
      keyCode: 70,
      displayLabel: 'F',
    });
    expect(normalizeKeyEventToBindingCode({ key: ' ' })).toEqual({
      status: 'valid',
      code: 'Space',
      keyCode: 32,
      displayLabel: 'Space',
    });

    expect(normalizeBindingCode('ShiftLeft')).toBe('Shift');
    expect(normalizeBindingCode('KeyE')).toBe('KeyE');
    expect(normalizeBindingCode('Digit1')).toBeNull();

    // Escape cancel
    expect(normalizeKeyEventToBindingCode({ code: 'Escape', key: 'Escape' })).toEqual({
      status: 'cancel',
    });

    // Reserved system / slot / function keys
    for (const ev of [
      { code: 'Digit1', key: '1' },
      { code: 'Numpad2', key: '2' },
      { code: 'Enter', key: 'Enter' },
      { code: 'F5', key: 'F5' },
      { code: 'CapsLock', key: 'CapsLock' },
      { code: 'MetaLeft', key: 'Meta' },
    ]) {
      const captured = normalizeKeyEventToBindingCode(ev);
      expect(captured.status, `${ev.code} should be reserved`).toBe('reserved');
      if (captured.status === 'reserved') {
        expect(captured.displayLabel.length).toBeGreaterThan(0);
      }
    }

    // Unsupported media / unmapped key
    const unsupported = normalizeKeyEventToBindingCode({
      code: 'AudioVolumeUp',
      key: 'AudioVolumeUp',
    });
    expect(unsupported.status).toBe('unsupported');
  });

  it('auto-swaps conflicting gameplay actions atomically and rejects reserved codes without mutating bindings', () => {
    const initial = { ...DEFAULT_KEYBINDINGS };

    const swapped = applyKeybindingChange(initial, 'dash', 'KeyQ');
    expect(swapped).toEqual({
      ok: true,
      changed: true,
      keybindings: {
        ...DEFAULT_KEYBINDINGS,
        dash: 'KeyQ',
        swapWeapon: 'Shift',
      },
      swappedWith: 'swapWeapon',
      boundCode: 'KeyQ',
      previousCode: 'Shift',
    });
    // Original object is never mutated
    expect(initial.dash).toBe('Shift');
    expect(initial.swapWeapon).toBe('KeyQ');

    const rejected = applyKeybindingChange(swapped.keybindings, 'dash', 'Digit1');
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.reason).toBe('reserved');
      expect(rejected.swappedWith).toBeNull();
      expect(rejected.displayLabel.length).toBeGreaterThan(0);
      expect(rejected.keybindings.dash).toBe('KeyQ');
      expect(rejected.keybindings.swapWeapon).toBe('Shift');
    }

    const noOp = applyKeybindingChange(initial, 'interact', 'KeyE');
    expect(noOp).toEqual({
      ok: true,
      changed: false,
      keybindings: initial,
      swappedWith: null,
      boundCode: 'KeyE',
      previousCode: 'KeyE',
    });
  });

  it('sanitizes corrupted, legacy ShiftLeft, missing, or duplicate localStorage keybindings into 14 pairwise-unique bindings', () => {
    const sanitized = sanitizeKeybindings({
      interact: 'KeyF',
      moveUp: 'KeyF',
      dash: 'ShiftLeft',
      skill: 'Digit1',
    });

    expect(sanitized.interact).toBe('KeyF');
    expect(sanitized.moveUp).toBe('KeyW');
    expect(sanitized.dash).toBe('Shift');
    expect(sanitized.skill).toBe('Space');
    expect(Object.keys(sanitized)).toEqual([...KEYBIND_ACTION_IDS]);
    expect(new Set(Object.values(sanitized)).size).toBe(14);

    // When a custom key claims another action's default, the displaced action still gets a valid unique key
    const displaced = sanitizeKeybindings({ interact: 'KeyW' });
    expect(displaced.interact).toBe('KeyW');
    expect(displaced.moveUp).toBe('KeyE');
    expect(new Set(Object.values(displaced)).size).toBe(14);
  });

  it('persists custom keybindings in GraphicsSettingsManager localStorage, notifies listeners, resets via resetDefaults(), and maintains VI/EN i18n parity', () => {
    const { store, windowObj } = createFakeWindow();
    vi.stubGlobal('window', windowObj);

    const mgr = new GraphicsSettingsManager();
    const listener = vi.fn();
    const unsub = mgr.onChange(listener);

    expect(mgr.getActionKeyLabel('interact')).toBe('E');
    const updateRes = mgr.setKeybinding('interact', 'KeyF');
    expect(updateRes.ok).toBe(true);
    expect(mgr.getKeybindings().interact).toBe('KeyF');
    expect(mgr.getActionKeyLabel('interact')).toBe('F');
    expect(listener).toHaveBeenCalledTimes(1);

    const savedRaw = store.get('ashen_pact_graphics_settings');
    expect(savedRaw).toBeDefined();
    const savedParsed = JSON.parse(savedRaw!) as { keybindings: Record<string, string> };
    expect(savedParsed.keybindings.interact).toBe('KeyF');

    // Reserved key does not mutate or notify
    const badRes = mgr.setKeybinding('interact', 'Digit1');
    expect(badRes.ok).toBe(false);
    expect(mgr.getKeybindings().interact).toBe('KeyF');
    expect(listener).toHaveBeenCalledTimes(1);

    // Fresh manager instance reloads persisted keybindings from localStorage
    const reloaded = new GraphicsSettingsManager();
    expect(reloaded.getKeybindings().interact).toBe('KeyF');
    expect(reloaded.getActionKeyLabel('interact')).toBe('F');

    // resetKeybindings resets only keybindings while preserving other settings
    reloaded.setUiScale(1.2);
    reloaded.resetKeybindings();
    expect(reloaded.getKeybindings().interact).toBe('KeyE');
    expect(reloaded.getState().uiScale).toBe(1.2);

    // resetDefaults restores all settings including keybindings without mutating DEFAULT_GRAPHICS_SETTINGS
    reloaded.setKeybinding('dash', 'KeyQ');
    expect(reloaded.getKeybindings().dash).toBe('KeyQ');
    expect(DEFAULT_GRAPHICS_SETTINGS.keybindings.dash).toBe('Shift');

    reloaded.resetDefaults();
    expect(reloaded.getKeybindings().interact).toBe('KeyE');
    expect(reloaded.getKeybindings().dash).toBe('Shift');
    expect(reloaded.getState().uiScale).toBe(1.0);
    expect(reloaded.getKeybindings()).not.toBe(DEFAULT_GRAPHICS_SETTINGS.keybindings);

    unsub();

    // Global debug state initializes rebindingAction to null
    expect(initGlobalDebugState().rebindingAction).toBeNull();

    // Bilingual VI/EN key-tree parity & ui.controls keys
    expect(collectLeafKeys(viLocale)).toEqual(collectLeafKeys(enLocale));

    for (const locale of ['vi', 'en'] as const) {
      i18n.setLocale(locale);
      for (const noticeKey of [
        'ui.controls.rebindHint',
        'ui.controls.listeningPrompt',
        'ui.controls.swappedNotice',
        'ui.controls.reservedNotice',
        'ui.controls.cancelledNotice',
      ]) {
        expect(i18n.hasKey(noticeKey, locale), `Missing ${noticeKey} in ${locale}`).toBe(true);
      }
      for (const actionId of KEYBIND_ACTION_IDS) {
        const actionKey = `ui.controls.actions.${actionId}`;
        expect(i18n.hasKey(actionKey, locale), `Missing ${actionKey} in ${locale}`).toBe(true);
        expect(i18n.t(actionKey)).not.toBe(actionKey);
      }
      expect(
        i18n.t('ui.controls.swappedNotice', {
          action: 'Dash',
          key: 'Q',
          otherAction: 'Swap',
        }),
      ).toContain('Q');
      expect(i18n.t('ui.controls.reservedNotice', { key: '1' })).toContain('1');
      expect(i18n.t('ui.controls.listeningPrompt', { action: 'Dash' })).toContain('Dash');
    }
  });
});
