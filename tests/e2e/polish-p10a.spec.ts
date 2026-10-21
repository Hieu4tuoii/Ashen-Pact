import { expect, test } from '@playwright/test';

test.describe('Phase P10a — Cutout 2.0 Parametric Poses, 0.12s State Crossfade & Full-Rig Enemies', () => {
  test('verifies ArtGalleryScene Cutout 2.0 poses & 0.12s crossfade, and GameScene full 8-part enemy rigs at High/Medium vs fastComposite at Low', async ({
    page,
  }) => {
    test.setTimeout(90000);

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

    // 1. ArtGalleryScene: verify Cutout 2.0 poses (idle, run, attack, dash, hurt, cast) & 0.12s crossfade
    await page.goto('/?scene=gallery&testHooks=1');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'ArtGalleryScene', null, {
      timeout: 15000,
    });
    await page.waitForTimeout(300);

    // Switch to Page 4 (5 Playable Heroes)
    await page.keyboard.press('Digit4');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.galleryPage)).toBe(4);

    // Keyboard shortcuts 6/7/8/9 for attack, dash, hurt, cast
    await page.keyboard.press('Digit6');
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.animState)).toBe('attack');

    await page.keyboard.press('Digit7');
    await page.waitForTimeout(160);
    const dashSnapshot = await page.evaluate(() => {
      const scene = window.__PHASER_GAME__?.scene.getScene('ArtGalleryScene') as
        | {
            rigs?: Array<{
              getAnimState: () => string;
              getMoveLeanRad: () => number;
              container: { parentContainer?: { visible?: boolean } };
              bodyContainer: { scaleX: number; scaleY: number };
            }>;
          }
        | undefined;
      const rig =
        scene?.rigs?.find((r) => r.container.parentContainer?.visible !== false) ??
        scene?.rigs?.[0];
      return {
        animState: window.__GAME_DEBUG__.animState,
        rigState: rig?.getAnimState(),
        moveLeanRad: rig?.getMoveLeanRad() ?? 0,
        scaleX: Math.abs(rig?.bodyContainer.scaleX ?? 1),
        scaleY: rig?.bodyContainer.scaleY ?? 1,
      };
    });
    expect(dashSnapshot.animState).toBe('dash');
    expect(dashSnapshot.rigState).toBe('dash');
    expect(dashSnapshot.moveLeanRad).toBeGreaterThan(0.05);
    expect(dashSnapshot.scaleX).toBeGreaterThan(dashSnapshot.scaleY);

    await page.keyboard.press('Digit8');
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.animState)).toBe('hurt');

    await page.keyboard.press('Digit9');
    await page.waitForTimeout(80);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.animState)).toBe('cast');

    // Verify smooth 0.12s crossfade progression from idle -> run
    const crossfadeCheck = await page.evaluate(() => {
      window.__GALLERY_SET_ANIM__?.('idle');
      const scene = window.__PHASER_GAME__?.scene.getScene('ArtGalleryScene') as
        | {
            rigs?: Array<{
              update: (dt: number) => void;
              getCrossfadeAlpha: () => number;
              container: { parentContainer?: { visible?: boolean } };
            }>;
          }
        | undefined;
      const rig =
        scene?.rigs?.find((r) => r.container.parentContainer?.visible !== false) ??
        scene?.rigs?.[0];
      if (!rig) return null;
      rig.update(0.2);

      window.__GALLERY_SET_ANIM__?.('run');
      rig.update(0.03);
      const alphaAt30ms = rig.getCrossfadeAlpha();
      rig.update(0.03);
      const alphaAt60ms = rig.getCrossfadeAlpha();
      rig.update(0.08);
      const alphaAt140ms = rig.getCrossfadeAlpha();
      return { alphaAt30ms, alphaAt60ms, alphaAt140ms };
    });
    expect(crossfadeCheck).not.toBeNull();
    expect(crossfadeCheck!.alphaAt30ms).toBeGreaterThan(0);
    expect(crossfadeCheck!.alphaAt30ms).toBeLessThan(0.5);
    expect(crossfadeCheck!.alphaAt60ms).toBeCloseTo(0.5, 1);
    expect(crossfadeCheck!.alphaAt140ms).toBe(1);

    // 2. GameScene: verify full 8-part enemy rigs at High & Medium vs fastComposite at Low
    await page.goto('/?scene=game&testHooks=1');
    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.scene === 'GameScene' &&
        (window.__GAME_DEBUG__?.tick ?? 0) >= 25,
      null,
      { timeout: 15000 },
    );

    const setupCombatEnemies = async () =>
      page.evaluate(() => {
        const sim = window.__GAME_TRANSPORT__!.getSim();
        sim.inHub = false;
        const combatRoom =
          sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[1]!;
        sim.enterRoom(combatRoom.id);
        if (sim.enemies.length === 0) {
          sim.spawnEnemy('goblin_shooter', sim.player.x + 120, sim.player.y);
          sim.spawnEnemy('green_slime', sim.player.x - 110, sim.player.y + 40);
        }
        window.__GAME_SET_QUALITY__?.('high');
      });

    await setupCombatEnemies();
    await page.waitForTimeout(150);

    const inspectEnemyRigs = async () =>
      page.evaluate(() => {
        const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
          | {
              enemyRigs?: Map<
                number,
                {
                  isFastComposite: () => boolean;
                  bodyContainer: { visible: boolean; list: unknown[] };
                }
              >;
            }
          | undefined;
        const entries = Array.from(gs?.enemyRigs?.values() ?? []);
        return {
          quality: window.__GAME_DEBUG__.graphicsQuality,
          count: entries.length,
          allFullRig:
            entries.length > 0 &&
            entries.every(
              (r) =>
                r.isFastComposite() === false &&
                r.bodyContainer.visible === true &&
                r.bodyContainer.list.length === 8,
            ),
          allFastComposite:
            entries.length > 0 &&
            entries.every(
              (r) => r.isFastComposite() === true && r.bodyContainer.visible === false,
            ),
        };
      });

    const highRigCheck = await inspectEnemyRigs();
    expect(highRigCheck.quality).toBe('high');
    expect(highRigCheck.count).toBeGreaterThan(0);
    expect(highRigCheck.allFullRig).toBe(true);

    // Switch to Medium quality -> enemies still use full 8-part rigs
    await page.evaluate(() => window.__GAME_SET_QUALITY__?.('medium'));
    await page.waitForTimeout(120);
    const mediumRigCheck = await inspectEnemyRigs();
    expect(mediumRigCheck.quality).toBe('medium');
    expect(mediumRigCheck.count).toBeGreaterThan(0);
    expect(mediumRigCheck.allFullRig).toBe(true);

    // Switch to Low quality -> enemies immediately downgrade to fastComposite
    await page.evaluate(() => window.__GAME_SET_QUALITY__?.('low'));
    await page.waitForTimeout(120);
    const lowRigCheck = await inspectEnemyRigs();
    expect(lowRigCheck.quality).toBe('low');
    expect(lowRigCheck.count).toBeGreaterThan(0);
    expect(lowRigCheck.allFastComposite).toBe(true);

    // Restore High quality -> enemies upgrade back to full 8-part rigs
    await page.evaluate(() => window.__GAME_SET_QUALITY__?.('high'));
    await page.waitForTimeout(120);
    const restoredHighCheck = await inspectEnemyRigs();
    expect(restoredHighCheck.quality).toBe('high');
    expect(restoredHighCheck.allFullRig).toBe(true);

    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);
  });
});
