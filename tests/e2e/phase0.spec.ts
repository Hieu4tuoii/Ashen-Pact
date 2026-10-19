import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { VIETNAMESE_VERIFICATION_STRING } from '../../packages/shared/src/index.js';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots/phase-0');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe('Phase 0 — Foundation, Procedural Vector Art & E2E Smoke', () => {
  test('MenuScene & GameScene load at 60 FPS with Colyseus HelloRoom and 0 console errors/warnings', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await page.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'MenuScene', null, {
      timeout: 15000,
    });
    await page.waitForTimeout(600);

    const menuDebug = await page.evaluate(() => window.__GAME_DEBUG__);
    expect(menuDebug.vietnameseSampleText).toBe(VIETNAMESE_VERIFICATION_STRING);
    expect(menuDebug.errors).toEqual([]);
    expect(menuDebug.warnings).toEqual([]);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'menu-1080p.png'),
    });

    // Navigate to GameScene and verify Colyseus HelloRoom + F1 debug overlay + 60 FPS
    await page.goto('/?scene=game');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'GameScene', null, {
      timeout: 15000,
    });
    await page.waitForFunction(() => window.__GAME_DEBUG__?.serverConnected === true, null, {
      timeout: 10000,
    });
    await page.waitForFunction(() => (window.__GAME_DEBUG__?.tick ?? 0) >= 30, null, {
      timeout: 10000,
    });

    // Toggle F1 Debug Overlay on
    await page.keyboard.press('F1');
    await page.waitForTimeout(400);

    const gameDebug = await page.evaluate(() => window.__GAME_DEBUG__);
    expect(gameDebug.overlayVisible).toBe(true);
    expect(gameDebug.serverConnected).toBe(true);
    expect(gameDebug.fps).toBeGreaterThanOrEqual(50);
    expect(gameDebug.errors).toEqual([]);
    expect(gameDebug.warnings).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'game-1080p.png'),
    });
  });

  test('ArtGalleryScene renders crisp procedural rigs at 1080p and 1440p with animation & P1-P4 controls', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    // 1. Verify at 1080p (1920x1080)
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/?scene=gallery');

    await page.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'ArtGalleryScene', null, {
      timeout: 15000,
    });
    await page.waitForTimeout(700);

    const gallery1080 = await page.evaluate(() => window.__GAME_DEBUG__);
    expect(gallery1080.bakeScale).toBeGreaterThanOrEqual(4);
    expect(gallery1080.fps).toBeGreaterThanOrEqual(50);
    expect(gallery1080.animState).toBe('idle');
    expect(gallery1080.playerSlot).toBe(1);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'art-gallery-1080p-idle.png'),
    });

    // Switch animation to RUN and Player Slot to P2
    await page.evaluate(() => {
      window.__GALLERY_SET_ANIM__?.('run');
      window.__GALLERY_SET_SLOT__?.(2);
      window.__GALLERY_SET_BIOME__?.(2);
    });
    await page.waitForTimeout(500);

    const galleryRun = await page.evaluate(() => window.__GAME_DEBUG__);
    expect(galleryRun.animState).toBe('run');
    expect(galleryRun.playerSlot).toBe(2);
    expect(galleryRun.biome).toBe(2);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'art-gallery-1080p-run-p2.png'),
    });

    // 2. Verify at 1440p (2560x1440)
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.evaluate(() => {
      window.__GALLERY_SET_ANIM__?.('idle');
      window.__GALLERY_SET_SLOT__?.(1);
      window.__GALLERY_SET_BIOME__?.(1);
    });
    await page.waitForTimeout(700);

    const gallery1440 = await page.evaluate(() => window.__GAME_DEBUG__);
    expect(gallery1440.bakeScale).toBeGreaterThanOrEqual(4);
    expect(gallery1440.fps).toBeGreaterThanOrEqual(50);
    expect(gallery1440.errors).toEqual([]);
    expect(gallery1440.warnings).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'art-gallery-1440p.png'),
    });
  });
});
