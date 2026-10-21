import { expect, test } from '@playwright/test';

test.describe('Phase P9b — Menus, Hub Invite Panel, Modals, Pause Confirm & 4-Tab Settings', () => {
  test('verifies Menu Name/IP typing & paste, 4-tab Settings with UI Scale & Key Hints persistence, Hub Co-op 2P collapsed/expanded Invite Panel without Kick overlap, Pause Exit Confirmation dialog, and Buff/Victory/Defeat modals in VI & EN', async ({
    page,
  }) => {
    test.setTimeout(90000);

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/?test=1');

    await page.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'MenuScene', null, {
      timeout: 15000,
    });

    // 1. Menu Name & LAN IP Inputs: native typing, Backspace/Delete & clipboard paste
    const nameInput = page.locator('[data-testid="menu-name-input"]');
    const ipInput = page.locator('[data-testid="menu-ip-input"]');
    await expect(nameInput).toBeAttached();
    await expect(ipInput).toBeAttached();

    // Focus Name input, select all, Backspace, type + paste Vietnamese name
    await nameInput.click();
    await nameInput.selectText();
    await page.keyboard.press('Backspace');
    await page.keyboard.type('Chiến ');
    await nameInput.evaluate((el: HTMLInputElement) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'Thần Tro');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });

    const updatedName = await page.evaluate(() => window.__GAME_DEBUG__.menuDisplayName);
    expect(updatedName).toBe('Chiến Thần Tro');

    // Focus IP input, select port, Delete, and paste new LAN IP:Port
    await ipInput.click();
    await ipInput.selectText();
    await page.keyboard.press('Delete');
    await ipInput.evaluate((el: HTMLInputElement) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', '192.168.1.88:2567');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await page.keyboard.press('Enter');

    const updatedIp = await page.evaluate(() => window.__GAME_DEBUG__.menuServerHostPort);
    expect(updatedIp).toBe('192.168.1.88:2567');

    // 2. Open 4-Tab Settings Modal [O] on MenuScene, cycle 4 tabs, adjust UI Scale & Key Hints, verify localStorage
    await page.keyboard.press('o');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.settingsModalOpen === true, null, {
      timeout: 5000,
    });
    expect(await page.evaluate(() => window.__GAME_DEBUG__.settingsActiveTab)).toBe('audio');

    // Click Tab 2 (Video at 804, 216 in 1080p)
    await page.mouse.click(804, 216);
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.settingsActiveTab)).toBe('video');

    // Click Tab 3 (Gameplay at 1116, 216 in 1080p)
    await page.mouse.click(1116, 216);
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.settingsActiveTab)).toBe('gameplay');

    // Adjust UI Scale (+ button on Row 1 at x = 666 * 2 = 1332, y = 216 * 2 = 432) and toggle Key Hints (Row 2 at x = 635 * 2 = 1270, y = 270 * 2 = 540)
    await page.mouse.click(1332, 432);
    await page.mouse.click(1270, 540);
    await page.waitForTimeout(80);

    const savedSettings = await page.evaluate(() => {
      const raw = window.localStorage.getItem('ashen_pact_graphics_settings');
      return raw ? (JSON.parse(raw) as { uiScale: number; showKeyHints: boolean }) : null;
    });
    expect(savedSettings).not.toBeNull();
    expect(savedSettings!.uiScale).toBe(1.05);
    expect(savedSettings!.showKeyHints).toBe(false);

    // Click Tab 4 (Controls at 1426, 216 in 1080p)
    await page.mouse.click(1426, 216);
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.settingsActiveTab)).toBe('controls');
    expect(await page.evaluate(() => window.__GAME_DEBUG__.controlsModalOpen)).toBe(true);

    // Restore defaults (button at 534 * 2 = 1068, 466 * 2 = 932) and close Settings [Escape]
    await page.mouse.click(1068, 932);
    await page.waitForTimeout(80);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.settingsModalOpen === false, null, {
      timeout: 5000,
    });

    // 3. Enter GameScene -> Hub Co-op 2P: verify Invite Panel collapsed by default, expand with [I], verify no overlap with "Đuổi"
    await page.mouse.click(960, 450);
    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.scene === 'GameScene' &&
        (window.__GAME_DEBUG__?.tick ?? 0) >= 35,
      null,
      { timeout: 10000 },
    );

    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.enterHub();
      sim.addCoopPlayer(2, 'ranger', 'Chiến Binh Rất Dài P2', 2);
      sim.enterHub();
    });
    await page.waitForTimeout(150);

    // Default state in Hub: Invite Panel is collapsed
    const collapsedCheck = await page.evaluate(() => ({
      inHub: window.__GAME_DEBUG__.inHub,
      invitePanelVisible: window.__GAME_DEBUG__.invitePanelVisible,
    }));
    expect(collapsedCheck.inHub).toBe(true);
    expect(collapsedCheck.invitePanelVisible).toBe(false);

    // Press [I] to expand Invite Panel and verify P2 row text does not overlap the "Đuổi" button
    await page.keyboard.press('KeyI');
    await page.waitForTimeout(150);

    const expandedOverlapCheck = await page.evaluate(() => {
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            invitePanelVisible?: boolean;
            invitePanelContainer?: {
              list?: Array<{
                type?: string;
                text?: string;
                x?: number;
                y?: number;
                width?: number;
              }>;
            };
          }
        | undefined;
      const list = gs?.invitePanelContainer?.list ?? [];
      const p2RowTxt = list.find((o) => typeof o.text === 'string' && o.text.startsWith('P2 · '));
      const kickBtnTxt = list.find(
        (o) => typeof o.text === 'string' && (o.text === 'Đuổi' || o.text === 'Kick'),
      );
      const p2RightEdge = p2RowTxt ? (p2RowTxt.x ?? 0) + (p2RowTxt.width ?? 0) : 0;
      const kickBtnLeftEdge = kickBtnTxt ? (kickBtnTxt.x ?? 0) - 21 : 0;
      return {
        invitePanelVisible: gs?.invitePanelVisible === true,
        hasP2Row: Boolean(p2RowTxt),
        hasKickBtn: Boolean(kickBtnTxt),
        p2RightEdge,
        kickBtnLeftEdge,
        nonOverlapping: p2RightEdge <= kickBtnLeftEdge,
      };
    });
    expect(expandedOverlapCheck.invitePanelVisible).toBe(true);
    expect(expandedOverlapCheck.hasP2Row).toBe(true);
    expect(expandedOverlapCheck.hasKickBtn).toBe(true);
    expect(expandedOverlapCheck.nonOverlapping).toBe(true);

    // 4. Verify Buff Choice Modal & Victory/Defeat Result Screen (no Dismiss button, no raw buff IDs)
    const modalAudit = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.inHub = false;
      const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal')!;
      sim.enterRoom(portalRoom.id);
      sim.skipCurrentRoomWaves();
      sim.player.x = sim.portalX;
      sim.player.y = sim.portalY;
      sim.interactWithNearest();
      window.__GAME_TRANSPORT__!.step(16.6667);

      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            updateModalHud?: () => void;
            modalContainer?: { list?: Array<{ text?: string }> };
          }
        | undefined;
      gs?.updateModalHud?.();
      const buffTexts = (gs?.modalContainer?.list ?? [])
        .map((o) => o.text)
        .filter((t): t is string => typeof t === 'string');

      // Switch to Victory screen with legacy buff aliases
      sim.activeBuffIds = ['bountiful_vitality' as never, 'swift_wind' as never];
      sim.runState = 'victory';
      gs?.updateModalHud?.();
      const victoryTexts = (gs?.modalContainer?.list ?? [])
        .map((o) => o.text)
        .filter((t): t is string => typeof t === 'string');

      sim.runState = 'playing';
      gs?.updateModalHud?.();

      return {
        buffTexts,
        victoryTexts,
      };
    });

    expect(modalAudit.buffTexts.some((t) => t.includes('Nhấn [1] Chọn'))).toBe(true);
    expect(modalAudit.victoryTexts.some((t) => t.includes('Chơi lại [Enter]'))).toBe(true);
    expect(modalAudit.victoryTexts.some((t) => t.includes('Về Hub [H]'))).toBe(true);
    expect(modalAudit.victoryTexts.some((t) => t.includes('Menu Chính'))).toBe(false);
    expect(modalAudit.victoryTexts.some((t) => t.includes('Đóng Bảng'))).toBe(false);
    expect(modalAudit.victoryTexts.some((t) => t.includes('bountiful_vitality'))).toBe(false);
    expect(modalAudit.victoryTexts.some((t) => t.includes('Trái Tim Cổ Thụ'))).toBe(true);

    // 5. Pause Modal -> "Về Menu" Confirmation Dialog -> Cancel stays in match -> Confirm exits to MenuScene
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.pauseModalOpen === true, null, {
      timeout: 5000,
    });
    expect(await page.evaluate(() => window.__GAME_DEBUG__.pauseConfirmExitOpen)).toBe(false);

    // Click "🏠 Về Menu Chính [M]" at (960, 754) in 1080p
    await page.mouse.click(960, 754);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.pauseConfirmExitOpen === true, null, {
      timeout: 5000,
    });
    expect(await page.evaluate(() => window.__GAME_DEBUG__.scene)).toBe('GameScene');

    // Click "Hủy [Esc]" at (784, 644) in 1080p -> stays in GameScene with Pause open
    await page.mouse.click(784, 644);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.pauseConfirmExitOpen === false, null, {
      timeout: 5000,
    });
    expect(await page.evaluate(() => window.__GAME_DEBUG__.scene)).toBe('GameScene');
    expect(await page.evaluate(() => window.__GAME_DEBUG__.pauseModalOpen)).toBe(true);

    // Click "🏠 Về Menu Chính [M]" again -> click "Xác nhận thoát [Enter]" at (1136, 644) -> returns to MenuScene
    await page.mouse.click(960, 754);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.pauseConfirmExitOpen === true, null, {
      timeout: 5000,
    });
    await page.mouse.click(1136, 644);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'MenuScene', null, {
      timeout: 10000,
    });

    expect(consoleErrors).toEqual([]);
  });
});
