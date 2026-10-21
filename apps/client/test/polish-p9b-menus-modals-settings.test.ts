import { describe, expect, it } from 'vitest';
import { formatHubInvitePlayerRowText } from '../src/scenes/game-scene/hud-hub-and-cards.js';
import {
  getResultScreenButtonSpecs,
  resolveLocalizedBuffText,
} from '../src/scenes/game-scene/hud-modals-and-debug.js';
import { graphicsSettings } from '../src/ui/graphics-settings.js';
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
    expect(vitVi.name).toBe('Trái Tim Cổ Thụ');
    expect(vitEn.name).toBe('Ancient Heart');

    const windVi = resolveLocalizedBuffText('swift_wind', 'vi');
    const windEn = resolveLocalizedBuffText('swift_wind', 'en');
    expect(windVi.name).toBe('Cuồng Phong Trợ Lực');
    expect(windEn.name).toBe('Gale Reflex');

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
    expect(graphicsSettings.getState().uiScale).toBe(1.0);
    expect(graphicsSettings.getState().showKeyHints).toBe(true);

    graphicsSettings.setUiScale(1.25);
    graphicsSettings.setShowKeyHints(false);
    expect(graphicsSettings.getState().uiScale).toBe(1.25);
    expect(graphicsSettings.getState().showKeyHints).toBe(false);

    graphicsSettings.resetDefaults();
  });
});
