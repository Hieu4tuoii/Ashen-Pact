import {
  collectLeafKeys,
  enLocale,
  findInteractTarget,
  i18n,
  viLocale,
  WEAPONS,
  WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
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

import type { GameScene } from '../src/scenes/GameScene.js';
import { formatWeaponCadenceHudLabel } from '../src/scenes/game-scene/hud-micro-reload-bar.js';
import { computeWeaponSalvageHudState } from '../src/scenes/game-scene/hud-pact-and-forge-modals.js';
import {
  setupKeyboardBindingsImpl,
  syncSceneKeybindings,
} from '../src/scenes/game-scene/input-and-network.js';
import { resolveInteractPromptSpec } from '../src/scenes/game-scene/interact-prompt.js';
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
import {
  getControlsActionRowBounds,
  ModalOverlayManager,
} from '../src/ui/settings-modal.js';

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

interface MockDisplayNode {
  kind: 'container' | 'graphics' | 'text' | 'rect';
  text?: string;
  visible: boolean;
  active: boolean;
  list?: MockDisplayNode[];
}

function createModalMockScene() {
  const makeContainer = (): MockDisplayNode & Record<string, unknown> => {
    const node: MockDisplayNode & Record<string, unknown> = {
      kind: 'container',
      visible: true,
      active: true,
      list: [],
      setDepth() {
        return node;
      },
      setVisible(v: boolean) {
        node.visible = v;
        return node;
      },
      setPosition() {
        return node;
      },
      add(item: MockDisplayNode | MockDisplayNode[]) {
        if (Array.isArray(item)) {
          node.list!.push(...item);
        } else {
          node.list!.push(item);
        }
        return node;
      },
      removeAll() {
        node.list!.length = 0;
        return node;
      },
    };
    return node;
  };

  let rootContainer: (MockDisplayNode & Record<string, unknown>) | null = null;

  const scene = {
    cameras: {
      main: {
        midPoint: { x: 480, y: 270 },
        renderList: [],
      },
    },
    input: {
      preUpdate: vi.fn(),
    },
    scale: {
      isFullscreen: false,
      startFullscreen: vi.fn(),
      stopFullscreen: vi.fn(),
    },
    events: {
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
    },
    add: {
      container: vi.fn(() => {
        const c = makeContainer();
        if (!rootContainer) rootContainer = c;
        return c;
      }),
      graphics: vi.fn(() => {
        const g: MockDisplayNode & Record<string, unknown> = {
          kind: 'graphics',
          visible: true,
          active: true,
          clear: vi.fn(),
          fillStyle: vi.fn(),
          lineStyle: vi.fn(),
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          fillRoundedRect: vi.fn(),
          strokeRoundedRect: vi.fn(),
          lineBetween: vi.fn(),
        };
        return g;
      }),
      rectangle: vi.fn(() => {
        const r: MockDisplayNode & Record<string, unknown> = {
          kind: 'rect',
          visible: true,
          active: true,
          input: null as unknown,
          setInteractive() {
            r.input = { enabled: true };
            return r;
          },
          on() {
            return r;
          },
        };
        return r;
      }),
      text: vi.fn((_x: number, _y: number, content: string, style?: Record<string, unknown>) => {
        const t: MockDisplayNode & Record<string, unknown> = {
          kind: 'text',
          text: content,
          visible: true,
          active: true,
          width: content.length * 6.5,
          style: style ?? {},
          setOrigin() {
            return t;
          },
          setScale() {
            return t;
          },
          setResolution() {
            return t;
          },
          setText(next: string) {
            t.text = next;
            t.width = next.length * 6.5;
            return t;
          },
          setColor() {
            return t;
          },
        };
        return t;
      }),
    },
  };

  const collectVisibleTexts = (): string[] => {
    const out: string[] = [];
    const visit = (n: MockDisplayNode | undefined) => {
      if (!n || !n.visible) return;
      if (n.kind === 'text' && typeof n.text === 'string') {
        out.push(n.text);
      }
      if (n.list) {
        for (const child of n.list) visit(child);
      }
    };
    if (rootContainer) visit(rootContainer);
    return out;
  };

  return { scene: scene as unknown as Phaser.Scene, collectVisibleTexts };
}

function createCaptureFakeWindow() {
  const store = new Map<string, string>();
  type KeyListenerEntry = {
    type: string;
    fn: (ev: KeyboardEvent) => void;
    capture: boolean;
  };
  const listeners: KeyListenerEntry[] = [];

  const isCaptureOpt = (opts?: boolean | AddEventListenerOptions | EventListenerOptions): boolean =>
    typeof opts === 'boolean' ? opts : Boolean(opts?.capture);

  const windowObj = {
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
    addEventListener: vi.fn(
      (
        type: string,
        fn: (ev: KeyboardEvent) => void,
        opts?: boolean | AddEventListenerOptions,
      ) => {
        const capture = isCaptureOpt(opts);
        if (!listeners.some((l) => l.type === type && l.fn === fn && l.capture === capture)) {
          listeners.push({ type, fn, capture });
        }
      },
    ),
    removeEventListener: vi.fn(
      (type: string, fn: (ev: KeyboardEvent) => void, opts?: boolean | EventListenerOptions) => {
        const capture = isCaptureOpt(opts);
        const idx = listeners.findIndex(
          (l) => l.type === type && l.fn === fn && l.capture === capture,
        );
        if (idx >= 0) listeners.splice(idx, 1);
      },
    ),
    dispatchEvent: vi.fn(),
  };

  const dispatchKeydown = (init: { code?: string; key?: string; cancelable?: boolean }) => {
    let defaultPrevented = false;
    let immediateStopped = false;
    const ev = {
      type: 'keydown',
      code: init.code ?? '',
      key: init.key ?? '',
      cancelable: init.cancelable ?? true,
      get defaultPrevented() {
        return defaultPrevented;
      },
      preventDefault: vi.fn(() => {
        if (init.cancelable !== false) defaultPrevented = true;
      }),
      stopImmediatePropagation: vi.fn(() => {
        immediateStopped = true;
      }),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;

    for (const entry of [...listeners]) {
      if (entry.type === 'keydown' && entry.capture) {
        entry.fn(ev);
        if (immediateStopped) return ev;
      }
    }
    for (const entry of [...listeners]) {
      if (entry.type === 'keydown' && !entry.capture) {
        entry.fn(ev);
        if (immediateStopped) return ev;
      }
    }
    return ev;
  };

  const getCaptureKeydownListenerCount = () =>
    listeners.filter((l) => l.type === 'keydown' && l.capture).length;

  return { windowObj, dispatchKeydown, getCaptureKeydownListenerCount };
}

class MockPhaserKey {
  public readonly keyCode: number;
  public isDown = false;
  public altKey = false;
  private readonly handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  constructor(keyCode: number) {
    this.keyCode = keyCode;
  }

  public on(event: string, fn: (...args: unknown[]) => void): this {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn);
    return this;
  }

  public off(event: string, fn?: (...args: unknown[]) => void): this {
    if (!fn) {
      this.handlers.delete(event);
      return this;
    }
    this.handlers.get(event)?.delete(fn);
    return this;
  }

  public reset(): void {
    this.isDown = false;
  }

  public listenerCount(event: string): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  public emitDown(domEvent?: Partial<KeyboardEvent>): void {
    this.isDown = true;
    for (const fn of [...(this.handlers.get('down') ?? [])]) {
      fn(this, domEvent);
    }
  }

  public emitUp(domEvent?: Partial<KeyboardEvent>): void {
    this.isDown = false;
    for (const fn of [...(this.handlers.get('up') ?? [])]) {
      fn(this, domEvent);
    }
  }
}

function createMockKeyboardPlugin() {
  const keyMap = new Map<number, MockPhaserKey>();
  const eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const captures = new Set<number>();

  const getOrCreateKey = (keyCode: number) => {
    let k = keyMap.get(keyCode);
    if (!k) {
      k = new MockPhaserKey(keyCode);
      keyMap.set(keyCode, k);
    }
    return k;
  };

  return {
    keyMap,
    captures,
    plugin: {
      addKey: vi.fn((keyCode: number, enableCapture = true) => {
        if (enableCapture) captures.add(keyCode);
        return getOrCreateKey(keyCode);
      }),
      addCapture: vi.fn((keyCode: number) => {
        captures.add(keyCode);
      }),
      removeCapture: vi.fn((keyCode: number) => {
        captures.delete(keyCode);
      }),
      on: vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        let set = eventHandlers.get(event);
        if (!set) {
          set = new Set();
          eventHandlers.set(event, set);
        }
        set.add(fn);
      }),
      emit: (event: string, ...args: unknown[]) => {
        for (const fn of [...(eventHandlers.get(event) ?? [])]) {
          fn(...args);
        }
      },
    },
  };
}

describe('Customizable Keybindings — Task 2: Controls Tab UI, Live GameScene Rebinding & Dynamic HUD Keycaps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    graphicsSettings.resetDefaults();
    initGlobalDebugState().rebindingAction = null;
    i18n.setLocale('vi');
  });

  it('computes non-overlapping 7x2 Controls tab row bounds strictly inside card body (y=136..434) and manages capture lifecycle on Escape, conflict swap, reserved key, tab switch, and close', () => {
    const { windowObj, dispatchKeydown, getCaptureKeydownListenerCount } =
      createCaptureFakeWindow();
    vi.stubGlobal('window', windowObj);
    initGlobalDebugState();

    const { scene, collectVisibleTexts } = createModalMockScene();
    const onLocaleChanged = vi.fn();
    const modal = new ModalOverlayManager(scene, onLocaleChanged);

    // Bubble listener simulating downstream Phaser keydown-ESC handler
    const bubbleKeydownSpy = vi.fn((ev: KeyboardEvent) => {
      if (ev.code === 'Escape' && modal.isOpen()) {
        modal.close();
      }
    });
    windowObj.addEventListener('keydown', bubbleKeydownSpy, false);

    modal.open('controls');
    expect(modal.isOpen()).toBe(true);
    expect(modal.getActiveTab()).toBe('controls');
    expect(modal.getRebindingAction()).toBeNull();

    // Verify all 14 action row bounds fit strictly inside [174..786] × [165..380] (within card body y=136..434) with zero pairwise overlap
    const allBounds = KEYBIND_ACTION_IDS.map((action, idx) => {
      const byIndex = getControlsActionRowBounds(idx);
      const byAction = getControlsActionRowBounds(action);
      expect(byAction).toEqual(byIndex);
      expect(byAction.action).toBe(action);
      expect(byAction.index).toBe(idx);
      expect(byAction.x).toBeGreaterThanOrEqual(174);
      expect(byAction.x + byAction.w).toBeLessThanOrEqual(786);
      expect(byAction.y).toBeGreaterThanOrEqual(165);
      expect(byAction.y + byAction.h).toBeLessThanOrEqual(380);
      expect(byAction.y).toBeGreaterThanOrEqual(136);
      expect(byAction.y + byAction.h).toBeLessThanOrEqual(434);
      expect(byAction.keyPillCx - byAction.keyPillW * 0.5).toBeGreaterThan(byAction.x);
      expect(byAction.keyPillCx + byAction.keyPillW * 0.5).toBeLessThanOrEqual(
        byAction.x + byAction.w,
      );
      return byAction;
    });
    expect(allBounds).toHaveLength(14);

    for (let i = 0; i < allBounds.length; i++) {
      for (let j = i + 1; j < allBounds.length; j++) {
        const a = allBounds[i]!;
        const b = allBounds[j]!;
        const overlapsX = a.x < b.x + b.w && a.x + a.w > b.x;
        const overlapsY = a.y < b.y + b.h && a.y + a.h > b.y;
        expect(overlapsX && overlapsY, `Row ${a.action} overlaps ${b.action}`).toBe(false);
      }
    }

    // Start rebinding 'interact'
    modal.startRebinding('interact');
    expect(modal.getRebindingAction()).toBe('interact');
    expect(window.__GAME_DEBUG__.rebindingAction).toBe('interact');
    expect(getCaptureKeydownListenerCount()).toBe(1);

    // Reserved key 'Digit1': keeps capture open, shows reserved feedback, calls preventDefault + stopImmediatePropagation
    const reservedEv = dispatchKeydown({ code: 'Digit1', key: '1', cancelable: true });
    expect(reservedEv.preventDefault).toHaveBeenCalledTimes(1);
    expect(bubbleKeydownSpy).not.toHaveBeenCalled();
    expect(modal.isOpen()).toBe(true);
    expect(modal.getRebindingAction()).toBe('interact');
    expect(graphicsSettings.getKeybindings().interact).toBe('KeyE');
    expect(
      collectVisibleTexts().some((t) => t === i18n.t('ui.controls.reservedNotice', { key: '1' })),
    ).toBe(true);

    // Escape during active capture: cancels capture in window capture phase WITHOUT closing modal
    const escCaptureEv = dispatchKeydown({ code: 'Escape', key: 'Escape', cancelable: true });
    expect(escCaptureEv.preventDefault).toHaveBeenCalledTimes(1);
    expect(bubbleKeydownSpy).not.toHaveBeenCalled();
    expect(modal.isOpen()).toBe(true);
    expect(modal.getRebindingAction()).toBeNull();
    expect(window.__GAME_DEBUG__.rebindingAction).toBeNull();
    expect(getCaptureKeydownListenerCount()).toBe(0);

    // Start rebinding 'dash' -> press 'KeyQ' -> auto-swaps dash = 'KeyQ' and swapWeapon = 'Shift'
    modal.startRebinding('dash');
    expect(modal.getRebindingAction()).toBe('dash');
    expect(getCaptureKeydownListenerCount()).toBe(1);

    const swapEv = dispatchKeydown({ code: 'KeyQ', key: 'q', cancelable: true });
    expect(swapEv.preventDefault).toHaveBeenCalledTimes(1);
    expect(modal.getRebindingAction()).toBeNull();
    expect(window.__GAME_DEBUG__.rebindingAction).toBeNull();
    expect(getCaptureKeydownListenerCount()).toBe(0);
    expect(graphicsSettings.getKeybindings().dash).toBe('KeyQ');
    expect(graphicsSettings.getKeybindings().swapWeapon).toBe('Shift');
    expect(onLocaleChanged).toHaveBeenCalled();

    // Cleanup on selectTab('audio')
    modal.startRebinding('reload');
    expect(getCaptureKeydownListenerCount()).toBe(1);
    modal.selectTab('audio');
    expect(modal.getRebindingAction()).toBeNull();
    expect(window.__GAME_DEBUG__.rebindingAction).toBeNull();
    expect(getCaptureKeydownListenerCount()).toBe(0);

    // Cleanup on close()
    modal.selectTab('controls');
    modal.startRebinding('ping');
    expect(getCaptureKeydownListenerCount()).toBe(1);
    modal.close();
    expect(modal.isOpen()).toBe(false);
    expect(modal.getRebindingAction()).toBeNull();
    expect(getCaptureKeydownListenerCount()).toBe(0);

    // Cleanup on destroy()
    modal.open('controls');
    modal.startRebinding('emote');
    expect(getCaptureKeydownListenerCount()).toBe(1);
    modal.destroy();
    expect(modal.getRebindingAction()).toBeNull();
    expect(getCaptureKeydownListenerCount()).toBe(0);
  });

  it('hot-swaps GameScene Phaser Key bindings via syncSceneKeybindings without duplicate listeners and guards Hub letter shortcuts when bound', () => {
    const { windowObj } = createCaptureFakeWindow();
    vi.stubGlobal('window', windowObj);

    const sim = new WorldSim({
      seed: 'keybind-runtime-test',
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.enterHub();

    const { keyMap, plugin } = createMockKeyboardPlugin();
    const openModalSpy = vi.fn();

    const scene = {
      coopMode: 'solo',
      menuActiveInput: null,
      pauseModalOpen: false,
      pauseConfirmExitOpen: false,
      fullMapOpen: false,
      emoteWheelOpen: false,
      emoteWheelHoveredId: null,
      invitePanelVisible: false,
      resultDismissed: false,
      dashQueued: false,
      skillQueued: false,
      wheelSwapQueued: false,
      interactQueued: false,
      reloadVentQueued: false,
      dropWeaponQueued: false,
      readyToggleQueued: false,
      pingQueued: null,
      queuedEmote: null,
      queuedWeaponSlot: null,
      lastShakeX: 0,
      lastShakeY: 0,
      lastInvitePanelHash: 'cached',
      input: {
        keyboard: plugin,
        activePointer: { x: 240, y: 135 },
      },
      cameras: {
        main: {
          getWorldPoint: (x: number, y: number) => ({ x, y }),
        },
      },
      transport: {
        getSim: () => sim,
        getLocalPlayerState: () => sim.player,
      },
      settingsModal: {
        isOpen: () => false,
        open: openModalSpy,
        close: vi.fn(),
      },
      invalidateAllHudCaches: vi.fn(),
      togglePauseModal: vi.fn(),
      rebuildPauseModal: vi.fn(),
      openPauseConfirmExit: vi.fn(),
      triggerIrisTransition: vi.fn(),
    } as unknown as GameScene;

    setupKeyboardBindingsImpl.call(scene);

    // Rebind interact 'KeyE' -> 'KeyF' and dash 'Shift' <-> 'KeyQ'
    graphicsSettings.setKeybinding('interact', 'KeyF');
    graphicsSettings.setKeybinding('dash', 'KeyQ');
    syncSceneKeybindings(scene);

    // Firing old 'KeyE' (69) must NOT queue interact
    scene.interactQueued = false;
    keyMap.get(getKeyCodeForBinding('KeyE'))?.emitDown();
    expect(scene.interactQueued).toBe(false);

    // Firing new 'KeyF' (70) queues interact cleanly
    expect(keyMap.get(getKeyCodeForBinding('KeyF'))?.listenerCount('down')).toBe(1);
    keyMap.get(getKeyCodeForBinding('KeyF'))?.emitDown();
    expect(scene.interactQueued).toBe(true);

    // Swapped dash ('KeyQ') and swapWeapon ('Shift') fire their new actions cleanly
    scene.dashQueued = false;
    scene.wheelSwapQueued = false;
    keyMap.get(getKeyCodeForBinding('KeyQ'))?.emitDown();
    expect(scene.dashQueued).toBe(true);
    expect(scene.wheelSwapQueued).toBe(false);

    scene.dashQueued = false;
    keyMap.get(getKeyCodeForBinding('Shift'))?.emitDown();
    expect(scene.wheelSwapQueued).toBe(true);
    expect(scene.dashQueued).toBe(false);

    // Rebind 'KeyF' -> 'KeyE' and verify 'KeyE' fires once with zero duplicate listeners
    scene.interactQueued = false;
    graphicsSettings.setKeybinding('interact', 'KeyE');
    syncSceneKeybindings(scene);

    const keyE = keyMap.get(getKeyCodeForBinding('KeyE'))!;
    expect(keyE.listenerCount('down')).toBe(1);
    let interactObservedCount = 0;
    Object.defineProperty(scene, 'interactQueued', {
      configurable: true,
      get: () => interactObservedCount > 0,
      set: (val: boolean) => {
        if (val) interactObservedCount += 1;
      },
    });
    keyE.emitDown();
    expect(interactObservedCount).toBe(1);

    // Binding an action to 'KeyO' suppresses unpaused Hub 'keydown-O' modal shortcut while preserving pauseModalOpen '[O]'
    graphicsSettings.setKeybinding('ping', 'KeyO');
    syncSceneKeybindings(scene);

    scene.pauseModalOpen = false;
    plugin.emit('keydown-O');
    expect(openModalSpy).not.toHaveBeenCalled();

    scene.pauseModalOpen = true;
    plugin.emit('keydown-O');
    expect(openModalSpy).toHaveBeenCalledWith('settings');
  });

  it("propagates custom key labels into resolveInteractPromptSpec, formatWeaponCadenceHudLabel, and computeWeaponSalvageHudState while keeping default 'E'/'R'/'X' unchanged", () => {
    const { windowObj } = createCaptureFakeWindow();
    vi.stubGlobal('window', windowObj);

    const sim = new WorldSim({
      seed: 'keybind-hud-labels-test',
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.enemies.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.doors.length = 0;
    sim.inHub = false;
    sim.player.x = 480;
    sim.player.y = 320;

    const clipWeapon = Object.values(WEAPONS).find((w) => w.cadenceKind === 'CLIP_RELOAD')!;
    const heatWeapon = Object.values(WEAPONS).find((w) => w.cadenceKind === 'HEAT_VENT')!;

    sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: clipWeapon.id,
      rarity: 'rare',
      nameVi: clipWeapon.nameVi,
      costGold: 0,
      x: 492,
      y: 320,
    });

    sim.player.reloadTimer = 0.5;
    sim.player.weaponHeat = 80;
    sim.player.overheatLockTimer = 0;

    // 1. Default bindings: 'E', 'R', 'X'
    const target = findInteractTarget(sim, sim.player.id);
    expect(resolveInteractPromptSpec(sim, target)?.keycapText).toBe('E');
    expect(formatWeaponCadenceHudLabel(sim.player, clipWeapon, 'en').barText).toContain('[R]');
    expect(formatWeaponCadenceHudLabel(sim.player, heatWeapon, 'vi').barText).toContain('[R]');
    expect(formatWeaponCadenceHudLabel(sim.player, heatWeapon, 'en').compareStatText).toContain(
      '[R]',
    );
    expect(computeWeaponSalvageHudState(sim, sim.player, true).promptText).toContain('[X]');
    expect(computeWeaponSalvageHudState(sim, sim.player, false).promptText).toContain('[X]');

    // 2. Custom bindings: interact -> 'KeyF', reload -> 'KeyC', dropWeapon -> 'KeyB'
    graphicsSettings.setKeybinding('interact', 'KeyF');
    graphicsSettings.setKeybinding('reload', 'KeyC');
    graphicsSettings.setKeybinding('dropWeapon', 'KeyB');

    expect(resolveInteractPromptSpec(sim, target)?.keycapText).toBe('F');
    expect(
      resolveInteractPromptSpec(sim, target, { keycapText: 'Space' })?.keycapText,
    ).toBe('Space');
    expect(formatWeaponCadenceHudLabel(sim.player, clipWeapon, 'en').barText).toContain('[C]');
    expect(formatWeaponCadenceHudLabel(sim.player, clipWeapon, 'vi').barText).toContain('[C]');
    expect(formatWeaponCadenceHudLabel(sim.player, heatWeapon, 'vi').barText).toContain('[C]');
    expect(formatWeaponCadenceHudLabel(sim.player, heatWeapon, 'en').compareStatText).toContain(
      '[C]',
    );
    expect(computeWeaponSalvageHudState(sim, sim.player, true).promptText).toContain('[B]');
    expect(computeWeaponSalvageHudState(sim, sim.player, false).promptText).toContain('[B]');
  });
});

