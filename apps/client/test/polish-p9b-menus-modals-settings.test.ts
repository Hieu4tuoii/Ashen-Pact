import { describe, expect, it } from 'vitest';
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
  resolveMenuButtonHierarchySpec,
  sanitizeMenuInputText,
  sanitizeMenuInputValue,
} from '../src/ui/html-input-overlay.js';
import {
  getSettingsModalTitle,
  getSettingsTabSpecs,
  SETTINGS_TABS,
} from '../src/ui/settings-modal.js';
import {
  computeSanctuaryCoopInputBounds,
  resolveBootGameSceneInitData,
  shouldRestoreSavedCharacter,
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
});
