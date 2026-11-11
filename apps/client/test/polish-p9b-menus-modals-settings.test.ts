import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { formatHubInvitePlayerRowText } from '../src/scenes/game-scene/hud-hub-and-cards.js';
import {
  getResultScreenButtonSpecs,
  resolveLocalizedBuffText,
} from '../src/scenes/game-scene/hud-modals-and-debug.js';
import { computeCameraShakeOffset } from '../src/fx/combat-fx-pools.js';
import type { CombatFxManager } from '../src/fx/combat-fx.js';
import { DEFAULT_GRAPHICS_SETTINGS, graphicsSettings } from '../src/ui/graphics-settings.js';
import {
  applyMenuInputEdit,
  computeMenuInputOverlayRect,
  MENU_IP_MAX_LEN,
  MENU_NAME_MAX_LEN,
  MenuDomInputOverlay,
  resolveMenuButtonHierarchySpec,
  sanitizeMenuInputText,
  sanitizeMenuInputValue,
} from '../src/ui/html-input-overlay.js';
import {
  getSettingsModalTitle,
  getSettingsTabSpecs,
  SETTINGS_TABS,
} from '../src/ui/settings-modal.js';
import type { GameScene } from '../src/scenes/GameScene.js';
import {
  computeSanctuaryCoopInputBounds,
  resolveBootGameSceneInitData,
  resolveGameSceneStartInHub,
  setSanctuaryKeyboardSuspended,
  shouldRestoreSavedCharacter,
  syncSanctuaryDomInputsLayoutAndVisibility,
  syncSanctuaryOnStressTest,
  updateSanctuaryOverlayHudImpl,
} from '../src/scenes/game-scene/sanctuary-lobby-ui.js';

describe('Phase P9b — Menus, Hub Invite Panel, Modals, Pause Confirm & 4-Tab Settings', () => {
  it('defines 3-tier Main Menu button hierarchy and maps HTML <input> overlay coordinates accurately', () => {
    const primary = resolveMenuButtonHierarchySpec('playSolo');
    const secondary = resolveMenuButtonHierarchySpec('hostCoop');
    const utility = resolveMenuButtonHierarchySpec('settings');
    const debugBtn = resolveMenuButtonHierarchySpec('artGallery');

    expect(primary.tier).toBe('primary');
    expect(secondary.tier).toBe('secondary');
    expect(utility.tier).toBe('utility');
    expect(debugBtn.tier).toBe('debug');
    expect(primary.height).toBeGreaterThan(secondary.height);
    expect(secondary.height).toBeGreaterThan(utility.height);
    expect(primary.fontSizePx).toBeGreaterThan(secondary.fontSizePx);
    expect(debugBtn.debugOnly).toBe(true);

    const ipRect = computeMenuInputOverlayRect('ip', {
      left: 0,
      top: 0,
      width: 1920,
      height: 1080,
    });
    // At 1920x1080 (2x scale), IP input box (cx=610, cy=176) covers (1210, 352)
    expect(ipRect.leftPx).toBeLessThanOrEqual(1210);
    expect(ipRect.leftPx + ipRect.widthPx).toBeGreaterThanOrEqual(1210);
    expect(ipRect.topPx).toBeLessThanOrEqual(352);
    expect(ipRect.topPx + ipRect.heightPx).toBeGreaterThanOrEqual(352);
    expect(sanitizeMenuInputValue(' 10.0.0.5:2567 \r\n', 'ip')).toBe('10.0.0.5:2567');
  });

  it('supports Menu Name & IP text insertion, selection replacement, paste, Backspace, and Delete', () => {
    // 1. Paste into IP field replacing port selection (127.0.0.1:2567 -> 127.0.0.1:9999)
    const initialIp = '127.0.0.1:2567';
    const pastedPort = applyMenuInputEdit(
      initialIp,
      10,
      14,
      { kind: 'paste', text: '9999\r\n' },
      'ip',
      MENU_IP_MAX_LEN,
    );
    expect(pastedPort.value).toBe('127.0.0.1:9999');
    expect(pastedPort.caret).toBe(14);

    // 2. Full selection paste into Name field with Vietnamese diacritics
    const initialName = 'Hiệp Sĩ Tro';
    const pastedName = applyMenuInputEdit(
      initialName,
      0,
      initialName.length,
      { kind: 'paste', text: 'Chiến Thần Lửa' },
      'name',
      MENU_NAME_MAX_LEN,
    );
    expect(pastedName.value).toBe('Chiến Thần Lửa');

    // 3. Backspace single char vs selected range
    const bsSingle = applyMenuInputEdit(
      '127.0.0.1:2567',
      14,
      14,
      { kind: 'backspace' },
      'ip',
    );
    expect(bsSingle.value).toBe('127.0.0.1:256');
    expect(bsSingle.caret).toBe(13);

    const bsRange = applyMenuInputEdit(
      '127.0.0.1:2567',
      9,
      14,
      { kind: 'backspace' },
      'ip',
    );
    expect(bsRange.value).toBe('127.0.0.1');
    expect(bsRange.caret).toBe(9);

    // 4. Delete single char vs selected range
    const delSingle = applyMenuInputEdit(
      '127.0.0.1:2567',
      0,
      0,
      { kind: 'delete' },
      'ip',
    );
    expect(delSingle.value).toBe('27.0.0.1:2567');
    expect(delSingle.caret).toBe(0);

    // 5. Sanitizes control chars and whitespace in IP
    expect(sanitizeMenuInputText(' 192.168.1.50 : 2567 \n', 'ip')).toBe('192.168.1.50:2567');
  });

  it('truncates Hub Co-op Invite player row text when Kick button is present', () => {
    const rowWithKick = formatHubInvitePlayerRowText(
      2,
      'Chiến Binh Huyền Thoại Rất Dài',
      'Liệp Ưng',
      'Đang chọn',
      true,
    );
    expect(rowWithKick).toContain('P2 · ');
    expect(rowWithKick).toContain('…');
    expect(rowWithKick).toContain('(Liệp Ưng) — Đang chọn');

    const rowHost = formatHubInvitePlayerRowText(
      1,
      'Hiệp Sĩ Tro',
      'Thiết Vệ',
      '✓ Sẵn sàng',
      false,
    );
    expect(rowHost).toBe('P1 · Hiệp Sĩ Tro (Thiết Vệ) — ✓ Sẵn sàng');
  });

  it('resolves localized buff names (including legacy aliases) and defines 2 hierarchical Result Screen buttons (Play Again + Return to Hub)', () => {
    const vitVi = resolveLocalizedBuffText('bountiful_vitality', 'vi');
    const vitEn = resolveLocalizedBuffText('bountiful_vitality', 'en');
    expect(vitVi.name).toBe('Nâng Cấp: Pháo Đài Phản Xạ');
    expect(vitEn.name).toBe('Upgrade: Bastion Prism');

    const windVi = resolveLocalizedBuffText('swift_wind', 'vi');
    const windEn = resolveLocalizedBuffText('swift_wind', 'en');
    expect(windVi.name).toBe('Nâng Cấp: Song Tinh Cắt Không Gian');
    expect(windEn.name).toBe('Upgrade: Twin Orbit');

    const viBtns = getResultScreenButtonSpecs('vi');
    const enBtns = getResultScreenButtonSpecs('en');
    expect(viBtns).toHaveLength(2);
    expect(enBtns).toHaveLength(2);
    expect(viBtns.map((b) => b.id)).toEqual(['replay', 'returnHub']);
    expect(viBtns[0]!.tier).toBe('primary');
    expect(viBtns[1]!.tier).toBe('secondary');
    expect(viBtns[0]!.w).toBeGreaterThan(viBtns[1]!.w);
  });

  it('defines 4 Settings tabs, single-language headers, and persists UI Scale + Key Hints', () => {
    expect(SETTINGS_TABS).toEqual(['audio', 'video', 'gameplay', 'controls']);

    expect(getSettingsModalTitle('vi')).toBe('CÀI ĐẶT');
    expect(getSettingsModalTitle('vi')).not.toContain('SETTINGS');
    expect(getSettingsModalTitle('en')).toBe('SETTINGS');

    const viTabs = getSettingsTabSpecs('vi');
    const enTabs = getSettingsTabSpecs('en');
    expect(viTabs).toHaveLength(4);
    expect(enTabs).toHaveLength(4);
    expect(viTabs.map((t) => t.id)).toEqual(['audio', 'video', 'gameplay', 'controls']);

    graphicsSettings.resetDefaults();
    expect(DEFAULT_GRAPHICS_SETTINGS.screenShakeIntensity).toBe(0.4);
    expect(graphicsSettings.getState().screenShakeIntensity).toBe(0.4);
    expect(graphicsSettings.getState().uiScale).toBe(1.0);

    // Verify camera shake maxOffset is halved (5.5 instead of 11)
    graphicsSettings.setScreenShakeIntensity(1.0);
    const mockFx = { trauma: 1.0, shakeTime: 0 } as unknown as CombatFxManager;
    const shake = computeCameraShakeOffset.call(mockFx, 0);
    const expectedNx = Math.cos(1.3) * 0.3 + Math.sin(2.7) * 0.15;
    expect(shake.offsetX).toBeCloseTo(expectedNx * 5.5, 4);
    expect(graphicsSettings.getState().showKeyHints).toBe(true);

    graphicsSettings.setUiScale(1.25);
    graphicsSettings.setShowKeyHints(false);
    expect(graphicsSettings.getState().uiScale).toBe(1.25);
    expect(graphicsSettings.getState().showKeyHints).toBe(false);

    graphicsSettings.resetDefaults();
  });

  it('routes boot URLs directly into Solo Sanctuary, combat shortcuts, Co-op rooms, or privileged ArtGalleryScene', () => {
    expect(resolveBootGameSceneInitData('', false)).toEqual({
      targetScene: 'GameScene',
      initData: { coopMode: 'solo', startInHub: true },
    });
    expect(resolveBootGameSceneInitData('?test=1', true)).toEqual({
      targetScene: 'GameScene',
      initData: { coopMode: 'solo', startInHub: true },
    });
    expect(resolveBootGameSceneInitData('?scene=menu', false)).toEqual({
      targetScene: 'GameScene',
      initData: { coopMode: 'solo', startInHub: true },
    });
    expect(resolveBootGameSceneInitData('?scene=gallery', false)).toEqual({
      targetScene: 'GameScene',
      initData: { coopMode: 'solo', startInHub: true },
    });
    expect(resolveBootGameSceneInitData('?scene=gallery', true)).toEqual({
      targetScene: 'ArtGalleryScene',
    });
    expect(resolveBootGameSceneInitData('?gallery=1', true)).toEqual({
      targetScene: 'ArtGalleryScene',
    });
    expect(resolveBootGameSceneInitData('?scene=game&testHooks=1', true)).toEqual({
      targetScene: 'GameScene',
      initData: { coopMode: 'solo', startInHub: false },
    });
    expect(resolveBootGameSceneInitData('?scene=game&hub=1&testHooks=1', true)).toEqual({
      targetScene: 'GameScene',
      initData: { coopMode: 'solo', startInHub: true },
    });
    expect(resolveBootGameSceneInitData('?biome=2', true)).toEqual({
      targetScene: 'GameScene',
      initData: { coopMode: 'solo', startInHub: false },
    });
    expect(resolveBootGameSceneInitData('?biome=2', false)).toEqual({
      targetScene: 'GameScene',
      initData: { coopMode: 'solo', startInHub: true },
    });
    expect(resolveBootGameSceneInitData('?coop=host&name=HostHero', false)).toEqual({
      targetScene: 'GameScene',
      initData: {
        coopMode: 'host',
        roomId: undefined,
        displayName: 'HostHero',
        serverUrl: undefined,
        startInHub: true,
      },
    });
    expect(
      resolveBootGameSceneInitData('?join=room42&name=GuestHero&server=192.168.1.10:2567', false),
    ).toEqual({
      targetScene: 'GameScene',
      initData: {
        coopMode: 'join',
        roomId: 'room42',
        displayName: 'GuestHero',
        serverUrl: '192.168.1.10:2567',
        startInHub: true,
      },
    });

    expect(shouldRestoreSavedCharacter('')).toBe(true);
    expect(shouldRestoreSavedCharacter('?debug=1')).toBe(true);
    expect(shouldRestoreSavedCharacter('?freeze=1')).toBe(false);
    expect(shouldRestoreSavedCharacter('?test=1')).toBe(false);
    expect(shouldRestoreSavedCharacter('?testHooks=1')).toBe(false);
  });

  it('positions Sanctuary Co-op Guild Drawer DOM inputs strictly inside the right-hand drawer and maps accurately onto 1080p CSS pixels', () => {
    const customBounds = computeSanctuaryCoopInputBounds(1, 0, 0);
    expect(customBounds.name.cx).toBeGreaterThan(650);
    expect(customBounds.ip.cx).toBeGreaterThan(650);
    expect(customBounds.name.cx + customBounds.name.w * 0.5).toBeLessThanOrEqual(960);
    expect(customBounds.ip.cx + customBounds.ip.w * 0.5).toBeLessThanOrEqual(960);
    expect(
      Math.abs(customBounds.ip.cy - customBounds.name.cy),
    ).toBeGreaterThanOrEqual((customBounds.name.h + customBounds.ip.h) * 0.5 + 8);

    const ipRect = computeMenuInputOverlayRect(
      'ip',
      { left: 0, top: 0, width: 1920, height: 1080 },
      customBounds.ip,
    );
    expect(ipRect.leftPx).toBe(Math.round((customBounds.ip.cx - customBounds.ip.w * 0.5) * 2));
    expect(ipRect.topPx).toBe(Math.round((customBounds.ip.cy - customBounds.ip.h * 0.5) * 2));
    expect(ipRect.widthPx).toBe(Math.round(customBounds.ip.w * 2));
    expect(ipRect.heightPx).toBe(Math.round(customBounds.ip.h * 2));
    expect(ipRect.leftPx).toBeGreaterThan(1300);
    expect(ipRect.leftPx + ipRect.widthPx).toBeLessThanOrEqual(1920);
  });

  it('skips DOM layout getBoundingClientRect() while MenuDomInputOverlay is hidden or bounds are unchanged, and avoids per-frame enableGlobalCapture()', () => {
    interface MockElement {
      tagName: string;
      type?: string;
      value: string;
      maxLength?: number;
      autocomplete?: string;
      spellcheck?: boolean;
      style: Record<string, string>;
      attributes: Record<string, string>;
      children: MockElement[];
      parentElement: MockElement | null;
      setAttribute: (k: string, v: string) => void;
      addEventListener: ReturnType<typeof vi.fn>;
      appendChild: (child: MockElement) => MockElement;
      removeChild: (child: MockElement) => MockElement;
      blur: ReturnType<typeof vi.fn>;
      focus: ReturnType<typeof vi.fn>;
      setSelectionRange: ReturnType<typeof vi.fn>;
    }

    const createMockEl = (tag: string): MockElement => {
      const el: MockElement = {
        tagName: tag.toUpperCase(),
        value: '',
        style: {},
        attributes: {},
        children: [],
        parentElement: null,
        setAttribute(k, v) {
          el.attributes[k] = v;
        },
        addEventListener: vi.fn(),
        appendChild(child) {
          child.parentElement = el;
          el.children.push(child);
          return child;
        },
        removeChild(child) {
          el.children = el.children.filter((c) => c !== child);
          child.parentElement = null;
          return child;
        },
        blur: vi.fn(),
        focus: vi.fn(),
        setSelectionRange: vi.fn(),
      };
      return el;
    };

    const bodyEl = createMockEl('body');
    const getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 1920,
      height: 1080,
    }));
    const canvasEl = {
      parentElement: bodyEl,
      getBoundingClientRect,
    };

    vi.stubGlobal('document', {
      body: bodyEl,
      activeElement: null,
      createElement: (tag: string) => createMockEl(tag),
    });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { search: '' },
    });

    try {
      const boundsA = computeSanctuaryCoopInputBounds(1, 0, 0);
      const boundsB = computeSanctuaryCoopInputBounds(1.25, 0, 0);
      const mockSceneForOverlay = { game: { canvas: canvasEl } } as unknown as Phaser.Scene;

      const overlay = new MenuDomInputOverlay(
        mockSceneForOverlay,
        'Hiệp Sĩ Tro',
        '127.0.0.1:2567',
        { onFocusChange: vi.fn(), onValueChange: vi.fn() },
        boundsA,
      );
      expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

      // Hide overlay and verify zero getBoundingClientRect() calls while hidden
      overlay.setVisible(false);
      getBoundingClientRect.mockClear();

      overlay.reposition();
      overlay.setBounds(computeSanctuaryCoopInputBounds(1, 0, 0));
      overlay.setBounds(boundsB);
      expect(getBoundingClientRect).toHaveBeenCalledTimes(0);

      // Transitioning back to visible repositions once; identical bounds are no-ops
      overlay.setVisible(true);
      expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
      overlay.setBounds(computeSanctuaryCoopInputBounds(1.25, 0, 0));
      expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

      // Verify per-frame syncSanctuaryDomInputsLayoutAndVisibility & setSanctuaryKeyboardSuspended no-ops
      overlay.setVisible(false);
      getBoundingClientRect.mockClear();

      const enableGlobalCapture = vi.fn();
      const disableGlobalCapture = vi.fn();
      const resetKeys = vi.fn();
      const mockGameScene = {
        coopMode: 'solo',
        invitePanelVisible: false,
        pauseModalOpen: false,
        fullMapOpen: false,
        emoteWheelOpen: false,
        menuActiveInput: null,
        displayName: 'Hiệp Sĩ Tro',
        serverHostPort: '127.0.0.1:2567',
        currentHudUiScale: 1,
        hudPadX: 0,
        hudPadY: 0,
        sanctuaryDomInputs: overlay,
        input: {
          keyboard: {
            enabled: true,
            enableGlobalCapture,
            disableGlobalCapture,
            resetKeys,
          },
        },
        transport: {
          getSim: () => ({ inHub: false, stressTestActive: false }),
          getLocalPlayerState: () => ({ buffChoices: [], mutatorChoices: [], pactChoices: [] }),
        },
      } as unknown as GameScene;

      syncSanctuaryDomInputsLayoutAndVisibility(mockGameScene);
      syncSanctuaryDomInputsLayoutAndVisibility(mockGameScene);
      expect(getBoundingClientRect).toHaveBeenCalledTimes(0);
      expect(enableGlobalCapture).toHaveBeenCalledTimes(0);

      // Suspending and resuming keyboard transitions global capture cleanly once each
      setSanctuaryKeyboardSuspended(mockGameScene, true);
      setSanctuaryKeyboardSuspended(mockGameScene, true);
      expect(disableGlobalCapture).toHaveBeenCalledTimes(1);
      expect(mockGameScene.input.keyboard!.enabled).toBe(false);

      setSanctuaryKeyboardSuspended(mockGameScene, false);
      setSanctuaryKeyboardSuspended(mockGameScene, false);
      expect(enableGlobalCapture).toHaveBeenCalledTimes(1);
      expect(mockGameScene.input.keyboard!.enabled).toBe(true);

      overlay.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('clears Sanctuary HUD chrome, collapses Solo Co-op Drawer, and hides DOM inputs when entering Stress Test mode', () => {
    const hudRemoveAll = vi.fn();
    const footerRemoveAll = vi.fn();
    const domSetVisible = vi.fn();
    const domSetModalBlocked = vi.fn();
    const updateHubInvitePanel = vi.fn();

    const mockScene = {
      uiScene: {},
      coopMode: 'solo',
      invitePanelVisible: true,
      lastInvitePanelHash: 'solo:1:cached',
      lastSanctuaryHudHash: 'vi:1:1::idle:1',
      sanctuaryHubElapsedSec: 2.5,
      disconnectReason: null,
      disconnectBannerTimer: 0,
      fullMapOpen: false,
      pauseModalOpen: false,
      emoteWheelOpen: false,
      menuActiveInput: 'name',
      displayName: 'Hiệp Sĩ Tro',
      serverHostPort: '127.0.0.1:2567',
      currentHudUiScale: 1,
      hudPadX: 0,
      hudPadY: 0,
      sanctuaryHudContainer: { removeAll: hudRemoveAll },
      sanctuaryDebugFooterContainer: { removeAll: footerRemoveAll },
      sanctuaryPlaqueContainer: { setAlpha: vi.fn() },
      sanctuaryDomInputs: {
        setVisible: domSetVisible,
        setModalBlocked: domSetModalBlocked,
        setBounds: vi.fn(),
        syncValues: vi.fn(),
      },
      input: {
        keyboard: {
          enabled: false,
          enableGlobalCapture: vi.fn(),
          disableGlobalCapture: vi.fn(),
          resetKeys: vi.fn(),
        },
      },
      updateHubInvitePanel,
      updateSanctuaryOverlayHud(dtSec: number) {
        updateSanctuaryOverlayHudImpl.call(mockScene as unknown as GameScene, dtSec);
      },
      transport: {
        getSim: () => ({ inHub: false, stressTestActive: true }),
        getLocalPlayerState: () => ({ buffChoices: [], mutatorChoices: [], pactChoices: [] }),
      },
    } as unknown as GameScene;

    syncSanctuaryOnStressTest(mockScene, true);

    expect(mockScene.invitePanelVisible).toBe(false);
    expect(domSetVisible).toHaveBeenCalledWith(false);
    expect(mockScene.input.keyboard!.enabled).toBe(true);
    expect(hudRemoveAll).toHaveBeenCalledWith(true);
    expect(footerRemoveAll).toHaveBeenCalledWith(true);
    expect(mockScene.lastSanctuaryHudHash).toBe('');
    expect(updateHubInvitePanel).toHaveBeenCalledTimes(1);
  });

  it('honors explicit startInHub: false on Replay restart even when page URL contains ?hub=1', async () => {
    expect(resolveGameSceneStartInHub(undefined, '?scene=game&hub=1&testHooks=1', true)).toBe(
      true,
    );
    expect(
      resolveGameSceneStartInHub(
        { coopMode: 'solo', startInHub: false },
        '?scene=game&hub=1&testHooks=1',
        true,
      ),
    ).toBe(false);
    expect(
      resolveGameSceneStartInHub({ coopMode: 'solo', startInHub: true }, '?scene=game', true),
    ).toBe(true);

    const fs = await import('node:fs');
    const path = await import('node:path');
    const arenaTilesSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/scenes/game-scene/arena-tiles.ts'),
      'utf8',
    );
    expect(arenaTilesSrc).not.toContain("searchParams.get('hub') === '1'");
    expect(arenaTilesSrc).toContain('if (this.startInHub) {');

    const gameSceneSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/scenes/GameScene.ts'),
      'utf8',
    );
    expect(gameSceneSrc).not.toMatch(/if\s*\(\s*!sim\.stressTestActive\s*\)\s*\{\s*this\.updateSanctuaryOverlayHud/);
  });
});
