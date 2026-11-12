import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const PLAYWRIGHT_OUT_DIR = path.resolve(process.cwd(), 'output/playwright');

test.beforeAll(() => {
  fs.mkdirSync(PLAYWRIGHT_OUT_DIR, { recursive: true });
});

test.describe('Phase P9b — Menus, Hub Invite Panel, Modals, Pause Confirm & 4-Tab Settings', () => {
  test('verifies Menu Name/IP typing & paste, 4-tab Settings with UI Scale, Key Hints & Custom Keybindings (capture, auto-swap, live Sanctuary input, restore defaults), Hub Co-op 2P Invite Panel, Pause Exit Confirmation, and Buff/Victory/Defeat modals', async ({
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

    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.scene === 'GameScene' &&
        window.__GAME_DEBUG__?.inHub === true &&
        window.__GAME_DEBUG__?.irisTransitionProgress === 0,
      null,
      { timeout: 15000 },
    );

    // 1. Sanctuary Co-op Guild Drawer: collapsed initially -> [I] opens -> native typing, spaces, WASD isolation & clipboard paste
    expect(await page.evaluate(() => window.__GAME_DEBUG__.invitePanelVisible)).toBe(false);
    await page.keyboard.press('KeyI');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.invitePanelVisible === true, null, {
      timeout: 5000,
    });

    const startState = await page.evaluate(() => ({
      x: window.__GAME_DEBUG__.playerX,
      y: window.__GAME_DEBUG__.playerY,
      language: window.__GAME_DEBUG__.language,
    }));

    const nameInput = page.locator('[data-testid="menu-name-input"]');
    const ipInput = page.locator('[data-testid="menu-ip-input"]');
    await expect(nameInput).toBeVisible();
    await expect(ipInput).toBeVisible();

    // Focus Name input, select all, Backspace, exercise full hotkey alphabet 'wasdeiokcl ' + Space typing without triggering modals, locale, drawer close, or movement
    await nameInput.click();
    await nameInput.selectText();
    await page.keyboard.press('Backspace');
    await page.keyboard.type('wasdeiokcl ');

    const hotkeySuppressionCheck = await page.evaluate(() => ({
      name: window.__GAME_DEBUG__.menuDisplayName,
      invitePanelVisible: window.__GAME_DEBUG__.invitePanelVisible,
      settingsModalOpen: window.__GAME_DEBUG__.settingsModalOpen,
      controlsModalOpen: window.__GAME_DEBUG__.controlsModalOpen,
      creditsModalOpen: window.__GAME_DEBUG__.creditsModalOpen,
      pauseModalOpen: window.__GAME_DEBUG__.pauseModalOpen,
      language: window.__GAME_DEBUG__.language,
      x: window.__GAME_DEBUG__.playerX,
      y: window.__GAME_DEBUG__.playerY,
    }));
    expect(hotkeySuppressionCheck).toEqual({
      name: 'wasdeiokcl ',
      invitePanelVisible: true,
      settingsModalOpen: false,
      controlsModalOpen: false,
      creditsModalOpen: false,
      pauseModalOpen: false,
      language: startState.language,
      x: startState.x,
      y: startState.y,
    });

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

    // Focus IP input, select all, Delete, and paste new LAN IP:Port
    await ipInput.click();
    await ipInput.selectText();
    await page.keyboard.press('Delete');
    await ipInput.evaluate((el: HTMLInputElement) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', '192.168.1.88:2567');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    });
    await page.keyboard.press('Enter');

    const afterTyping = await page.evaluate(() => ({
      ip: window.__GAME_DEBUG__.menuServerHostPort,
      x: window.__GAME_DEBUG__.playerX,
      y: window.__GAME_DEBUG__.playerY,
    }));
    expect(afterTyping.ip).toBe('192.168.1.88:2567');
    expect(afterTyping.x).toBe(startState.x);
    expect(afterTyping.y).toBe(startState.y);

    // Close the Solo Co-op Guild Drawer with [I] and verify DOM inputs hide immediately
    await page.keyboard.press('KeyI');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.invitePanelVisible === false, null, {
      timeout: 5000,
    });
    await expect(nameInput).toBeHidden();
    await expect(ipInput).toBeHidden();

    // 2. Open 4-Tab Settings Modal [O] directly in Sanctuary, cycle 4 tabs, adjust UI Scale & Key Hints, verify localStorage
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

    const flushSoftwareGlFrame = async (): Promise<void> => {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const game = window.__PHASER_GAME__ as
              | { __forceNextSoftwareRender?: boolean }
              | undefined;
            if (game) {
              game.__forceNextSoftwareRender = true;
            }
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
    };

    // 2a. Click `interact` row (index = 6, col = 0, row = 3, design (324, 272) -> 1080p (648, 544)) -> listening state -> Escape cancels without closing modal
    await page.mouse.click(648, 544);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.rebindingAction === 'interact', null, {
      timeout: 5000,
    });
    expect(await page.evaluate(() => window.__GAME_DEBUG__.rebindingAction)).toBe('interact');
    await flushSoftwareGlFrame();
    await page.screenshot({
      path: path.join(PLAYWRIGHT_OUT_DIR, 'controls-rebind-listening-vi.png'),
    });

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.rebindingAction === null, null, {
      timeout: 5000,
    });
    expect(await page.evaluate(() => window.__GAME_DEBUG__.rebindingAction)).toBeNull();
    expect(await page.evaluate(() => window.__GAME_DEBUG__.controlsModalOpen)).toBe(true);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.settingsModalOpen)).toBe(true);

    // 2b. Click `interact` row (648, 544) again and rebind to 'KeyF'
    await page.mouse.click(648, 544);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.rebindingAction === 'interact', null, {
      timeout: 5000,
    });
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.rebindingAction === null, null, {
      timeout: 5000,
    });
    expect(await page.evaluate(() => window.__GAME_DEBUG__.rebindingAction)).toBeNull();
    const afterInteractRebind = await page.evaluate(() => {
      const raw = window.localStorage.getItem('ashen_pact_graphics_settings');
      return raw ? (JSON.parse(raw) as { keybindings: Record<string, string> }) : null;
    });
    expect(afterInteractRebind).not.toBeNull();
    expect(afterInteractRebind!.keybindings.interact).toBe('KeyF');

    // 2c. Test conflict auto-swap: click `dash` row (index = 5, col = 1, row = 2, design (636, 241) -> 1080p (1272, 482)) and press 'KeyQ'
    await page.mouse.click(1272, 482);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.rebindingAction === 'dash', null, {
      timeout: 5000,
    });
    await page.keyboard.press('KeyQ');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.rebindingAction === null, null, {
      timeout: 5000,
    });
    const afterDashSwap = await page.evaluate(() => {
      const raw = window.localStorage.getItem('ashen_pact_graphics_settings');
      return raw ? (JSON.parse(raw) as { keybindings: Record<string, string> }) : null;
    });
    expect(afterDashSwap).not.toBeNull();
    expect(afterDashSwap!.keybindings.dash).toBe('KeyQ');
    expect(afterDashSwap!.keybindings.swapWeapon).toBe('Shift');
    await flushSoftwareGlFrame();
    await page.screenshot({
      path: path.join(PLAYWRIGHT_OUT_DIR, 'controls-rebind-swapped-vi.png'),
    });

    // 2d. Close Settings [Escape] and test live gameplay input in Sanctuary (old 'KeyE' inert, rebound 'KeyF' selects Ranger & Vanguard)
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.settingsModalOpen === false &&
        window.__GAME_DEBUG__?.controlsModalOpen === false,
      null,
      { timeout: 5000 },
    );
    expect(await page.evaluate(() => window.__GAME_DEBUG__.playerCharacterId)).toBe('vanguard');

    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const rangerStatue =
        sim.hubStatues.find((s) => s.characterId === 'ranger') ?? sim.hubStatues[1]!;
      sim.player.x = rangerStatue.x;
      sim.player.y = rangerStatue.y + 28;
      sim.player.prevX = sim.player.x;
      sim.player.prevY = sim.player.y;
      sim.player.vx = 0;
      sim.player.vy = 0;
    });
    await page.waitForFunction(
      () => window.__GAME_DEBUG__?.hubPreviewCharacterId === 'ranger',
      null,
      { timeout: 5000 },
    );

    // Old 'KeyE' must NOT trigger interact
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.playerCharacterId)).toBe('vanguard');

    // Rebound 'KeyF' triggers live Hero Station selection -> 'ranger'
    await page.keyboard.press('KeyF');
    await page.waitForFunction(
      () => window.__GAME_DEBUG__?.playerCharacterId === 'ranger',
      null,
      { timeout: 5000 },
    );
    expect(await page.evaluate(() => window.__GAME_DEBUG__.playerCharacterId)).toBe('ranger');

    // Switch back to 'vanguard' via rebound 'KeyF' on Vanguard's station and restore P1 start position
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const vanguardStatue =
        sim.hubStatues.find((s) => s.characterId === 'vanguard') ?? sim.hubStatues[0]!;
      sim.player.x = vanguardStatue.x;
      sim.player.y = vanguardStatue.y + 28;
      sim.player.prevX = sim.player.x;
      sim.player.prevY = sim.player.y;
      sim.player.vx = 0;
      sim.player.vy = 0;
    });
    await page.waitForFunction(
      () => window.__GAME_DEBUG__?.hubPreviewCharacterId === 'vanguard',
      null,
      { timeout: 5000 },
    );
    await page.keyboard.press('KeyF');
    await page.waitForFunction(
      () => window.__GAME_DEBUG__?.playerCharacterId === 'vanguard',
      null,
      { timeout: 5000 },
    );
    await page.evaluate(
      (pos) => {
        const sim = window.__GAME_TRANSPORT__!.getSim();
        sim.player.x = pos.x;
        sim.player.y = pos.y;
        sim.player.prevX = pos.x;
        sim.player.prevY = pos.y;
        sim.player.vx = 0;
        sim.player.vy = 0;
      },
      { x: startState.x, y: startState.y },
    );
    await page.waitForFunction(
      (pos) =>
        Math.abs((window.__GAME_DEBUG__?.playerX ?? 0) - pos.x) < 0.5 &&
        Math.abs((window.__GAME_DEBUG__?.playerY ?? 0) - pos.y) < 0.5,
      { x: startState.x, y: startState.y },
      { timeout: 5000 },
    );

    // 2e. Reopen Controls [K], verify EN Controls layout at 1080p, click Restore Defaults (1068, 932), verify defaults restored, and close [Escape]
    await page.keyboard.press('KeyK');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.controlsModalOpen === true, null, {
      timeout: 5000,
    });

    // Switch to Tab 3 (Gameplay at 1116, 216), toggle Display Language to EN (Row 0 at 1270, 324), return to Tab 4 (Controls at 1426, 216) for EN visual audit
    await page.mouse.click(1116, 216);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.settingsActiveTab === 'gameplay', null, {
      timeout: 5000,
    });
    await page.mouse.click(1270, 324);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.language === 'en', null, {
      timeout: 5000,
    });
    await page.mouse.click(1426, 216);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.controlsModalOpen === true, null, {
      timeout: 5000,
    });
    await flushSoftwareGlFrame();
    await page.screenshot({
      path: path.join(PLAYWRIGHT_OUT_DIR, 'controls-rebind-en.png'),
    });

    // Click Restore Defaults (1068, 932) -> restores keybindings, uiScale, showKeyHints, and 'vi' locale
    await page.mouse.click(1068, 932);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.language === 'vi', null, {
      timeout: 5000,
    });
    const restoredSettings = await page.evaluate(() => {
      const raw = window.localStorage.getItem('ashen_pact_graphics_settings');
      return raw
        ? (JSON.parse(raw) as {
            uiScale: number;
            showKeyHints: boolean;
            language: string;
            keybindings: Record<string, string>;
          })
        : null;
    });
    expect(restoredSettings).not.toBeNull();
    expect(restoredSettings!.keybindings.interact).toBe('KeyE');
    expect(restoredSettings!.keybindings.dash).toBe('Shift');
    expect(restoredSettings!.keybindings.swapWeapon).toBe('KeyQ');
    expect(restoredSettings!.uiScale).toBe(1);
    expect(restoredSettings!.showKeyHints).toBe(true);
    expect(restoredSettings!.language).toBe('vi');
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.controlsModalOpen === false &&
        window.__GAME_DEBUG__?.settingsModalOpen === false,
      null,
      { timeout: 5000 },
    );

    const postControlsState = await page.evaluate(() => ({
      playerCharacterId: window.__GAME_DEBUG__.playerCharacterId,
      x: window.__GAME_DEBUG__.playerX,
      y: window.__GAME_DEBUG__.playerY,
      settingsModalOpen: window.__GAME_DEBUG__.settingsModalOpen,
      controlsModalOpen: window.__GAME_DEBUG__.controlsModalOpen,
      rebindingAction: window.__GAME_DEBUG__.rebindingAction,
      language: window.__GAME_DEBUG__.language,
    }));
    expect(postControlsState).toEqual({
      playerCharacterId: 'vanguard',
      x: startState.x,
      y: startState.y,
      settingsModalOpen: false,
      controlsModalOpen: false,
      rebindingAction: null,
      language: startState.language,
    });

    // 3. Hub Co-op 2P in Sanctuary: switch scene coopMode to 'host' with 2 players, verify Invite Panel collapsed, expand with [I], verify no overlap with "Đuổi"
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.enterHub();
      sim.addCoopPlayer(2, 'ranger', 'Chiến Binh Rất Dài P2', 2);
      sim.enterHub();
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            coopMode?: 'solo' | 'host' | 'join';
            lastInvitePanelHash?: string;
            updateHubInvitePanel?: () => void;
          }
        | undefined;
      if (gs) {
        gs.coopMode = 'host';
        window.__GAME_DEBUG__.coopMode = 'host';
        gs.lastInvitePanelHash = '';
        gs.updateHubInvitePanel?.();
      }
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

    // Switch back to Solo with Co-op Drawer open so inputs are visible, then enter combat (inHub === false) and verify DOM inputs hide
    await page.evaluate(() => {
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            coopMode?: 'solo' | 'host' | 'join';
            invitePanelVisible?: boolean;
            lastInvitePanelHash?: string;
            updateHubInvitePanel?: () => void;
          }
        | undefined;
      if (gs) {
        gs.coopMode = 'solo';
        gs.invitePanelVisible = true;
        window.__GAME_DEBUG__.coopMode = 'solo';
        window.__GAME_DEBUG__.invitePanelVisible = true;
        gs.lastInvitePanelHash = '';
        gs.updateHubInvitePanel?.();
      }
    });
    await expect(nameInput).toBeVisible();
    await expect(ipInput).toBeVisible();

    // 4. Verify Buff Choice Modal & Victory/Defeat Result Screen (no Dismiss button, no raw buff IDs) and DOM inputs hidden in combat
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
            updateHubInvitePanel?: () => void;
            updateModalHud?: () => void;
            modalContainer?: { list?: Array<{ text?: string }> };
          }
        | undefined;
      gs?.updateHubInvitePanel?.();
      gs?.updateModalHud?.();
      const buffTexts = (gs?.modalContainer?.list ?? [])
        .map((o) => o.text)
        .filter((t): t is string => typeof t === 'string');

      // Switch to Victory screen with legacy buff aliases
      sim.player.blessingIds = ['bountiful_vitality' as never, 'swift_wind' as never];
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

    await page.waitForFunction(() => window.__GAME_DEBUG__?.inHub === false, null, {
      timeout: 5000,
    });
    await expect(nameInput).toBeHidden();
    await expect(ipInput).toBeHidden();

    expect(modalAudit.buffTexts.some((t) => t.includes('Nhấn [1] Chọn'))).toBe(true);
    expect(modalAudit.victoryTexts.some((t) => t.includes('Chơi lại [Enter]'))).toBe(true);
    expect(modalAudit.victoryTexts.some((t) => t.includes('Về Hub [H]'))).toBe(true);
    expect(modalAudit.victoryTexts.some((t) => t.includes('Menu Chính'))).toBe(false);
    expect(modalAudit.victoryTexts.some((t) => t.includes('Đóng Bảng'))).toBe(false);
    expect(modalAudit.victoryTexts.some((t) => t.includes('bountiful_vitality'))).toBe(false);
    expect(modalAudit.victoryTexts.some((t) => t.includes('Pháo Đài Phản Xạ'))).toBe(true);

    // 5. Pause Modal -> "Về Menu" Confirmation Dialog -> Cancel stays in match -> Confirm exits to Solo Sanctuary
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
    expect(await page.evaluate(() => window.__GAME_DEBUG__.inHub)).toBe(false);

    // Click "Hủy [Esc]" at (784, 644) in 1080p -> stays in dungeon match with Pause open
    await page.mouse.click(784, 644);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.pauseConfirmExitOpen === false, null, {
      timeout: 5000,
    });
    expect(await page.evaluate(() => window.__GAME_DEBUG__.inHub)).toBe(false);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.pauseModalOpen)).toBe(true);

    // Click "🏠 Về Menu Chính [M]" again -> click "Xác nhận thoát [Enter]" at (1136, 644) -> returns to Solo Sanctuary
    await page.mouse.click(960, 754);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.pauseConfirmExitOpen === true, null, {
      timeout: 5000,
    });
    await page.mouse.click(1136, 644);
    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.scene === 'GameScene' &&
        window.__GAME_DEBUG__?.inHub === true &&
        window.__GAME_DEBUG__?.coopMode === 'solo',
      null,
      { timeout: 10000 },
    );

    expect(consoleErrors).toEqual([]);
  });
});
