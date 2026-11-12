import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots/phase-7');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe('Phase 7 — UI/UX & Âm Thanh Hoàn Thiện (Polished HUD, Modals, i18n, MVP Awards & Dynamic Audio)', () => {
  test('verifies Dynamic Campfire Menu + Settings/Controls/Credits/Language Modals, Vector HUD + Trailing Bars + Weapon Comparison + Pause Overlay, Dynamic Music Themes & Victory Screen with 4 MVP Awards', async ({
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
    await page.goto('/');

    // 1. Sanctuary Lobby: Living 5-Wing Hub, 5 Hero Rigs, Music Theme, Language Toggle [L], Controls [K], Credits [C] & Settings [O]
    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.scene === 'GameScene' &&
        window.__GAME_DEBUG__?.inHub === true &&
        window.__GAME_DEBUG__?.irisTransitionProgress === 0,
      null,
      { timeout: 15000 },
    );

    await page.waitForTimeout(250);
    const initialSanctuaryDebug = await page.evaluate(() => ({
      scene: window.__GAME_DEBUG__.scene,
      inHub: window.__GAME_DEBUG__.inHub,
      language: window.__GAME_DEBUG__.language,
      musicTheme: window.__GAME_DEBUG__.musicTheme,
    }));
    expect(initialSanctuaryDebug.scene).toBe('GameScene');
    expect(initialSanctuaryDebug.inHub).toBe(true);
    expect(initialSanctuaryDebug.language).toBe('vi');
    expect(initialSanctuaryDebug.musicTheme).toBe('menu_hub');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'menu-campfire-hub-1080p.png'),
    });

    // Toggle language to English [L], open Settings modal [O], and capture English screenshot
    await page.keyboard.press('l');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.language)).toBe('en');

    await page.keyboard.press('o');
    await page.waitForTimeout(180);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.settingsModalOpen)).toBe(true);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'menu-settings-en-1080p.png'),
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Switch back to Vietnamese [L]
    await page.keyboard.press('l');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.language)).toBe('vi');

    // Open & close Controls modal [K]
    await page.keyboard.press('k');
    await page.waitForTimeout(120);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.controlsModalOpen)).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.controlsModalOpen)).toBe(false);

    // Open & close Credits modal [C]
    await page.keyboard.press('c');
    await page.waitForTimeout(120);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.creditsModalOpen)).toBe(true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.creditsModalOpen)).toBe(false);

    // Open Settings modal [O] in Vietnamese and capture screenshot
    await page.keyboard.press('o');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.settingsModalOpen)).toBe(true);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'menu-campfire-settings.png'),
    });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    expect(await page.evaluate(() => window.__GAME_DEBUG__.settingsModalOpen)).toBe(false);

    // 2. Move P1 near a Hero Station in Sanctuary to verify Guidance Signs + Skill Preview Card + Hero Selection
    const rangerScreenPt = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const rangerStatue =
        sim.hubStatues.find((s) => s.characterId === 'ranger') ?? sim.hubStatues[1]!;
      sim.player.x = rangerStatue.x;
      sim.player.y = rangerStatue.y + 28;
      const gs = window.__PHASER_GAME__!.scene.getScene('GameScene') as {
        cameras: {
          main: { scrollX: number; scrollY: number; width: number; height: number; zoom: number };
        };
      };
      const cam = gs.cameras.main;
      const midX = cam.scrollX + cam.width * 0.5;
      const midY = cam.scrollY + cam.height * 0.5;
      return {
        x: (rangerStatue.x - midX) * cam.zoom + cam.width * 0.5,
        y: (rangerStatue.y - midY) * cam.zoom + cam.height * 0.5,
      };
    });
    await page.waitForFunction(
      () => window.__GAME_DEBUG__?.hubPreviewCharacterId === 'ranger',
      null,
      { timeout: 5000 },
    );
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'hub-guide-skill-preview-1080p.png'),
    });

    // Select Ranger via [E] interact, then re-compute screen coords after camera smooth-follow and click Vanguard station to switch back
    await page.keyboard.press('e');
    await page.waitForFunction(
      () => window.__GAME_DEBUG__?.playerCharacterId === 'ranger',
      null,
      { timeout: 5000 },
    );
    expect(rangerScreenPt.x).toBeGreaterThan(0);
    await page.waitForTimeout(200);
    const vanguardScreenPt = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const vanguardStatue =
        sim.hubStatues.find((s) => s.characterId === 'vanguard') ?? sim.hubStatues[0]!;
      const gs = window.__PHASER_GAME__!.scene.getScene('GameScene') as {
        cameras: {
          main: { scrollX: number; scrollY: number; width: number; height: number; zoom: number };
        };
      };
      const cam = gs.cameras.main;
      const midX = cam.scrollX + cam.width * 0.5;
      const midY = cam.scrollY + cam.height * 0.5;
      return {
        x: (vanguardStatue.x - midX) * cam.zoom + cam.width * 0.5,
        y: (vanguardStatue.y - midY) * cam.zoom + cam.height * 0.5,
      };
    });
    await page.mouse.click(vanguardScreenPt.x, vanguardScreenPt.y);
    await page.waitForFunction(
      () => window.__GAME_DEBUG__?.playerCharacterId === 'vanguard',
      null,
      { timeout: 5000 },
    );

    // Step into North Expedition Portal -> capture Iris sweep -> enter Floor 1 Dungeon
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.player.x = sim.portalX;
      sim.player.y = sim.portalY;
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | { triggerPortalEnterSequence?: (commit?: boolean) => void }
        | undefined;
      gs?.triggerPortalEnterSequence?.(true);
    });
    await page.waitForFunction(
      () => (window.__GAME_DEBUG__?.irisTransitionProgress ?? 0) > 0.05,
      null,
      { timeout: 10000 },
    );

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'iris-transition-1080p.png'),
    });

    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.inHub === false &&
        window.__GAME_DEBUG__?.irisTransitionProgress === 0,
      null,
      { timeout: 10000 },
    );

    // 3. Enter a combat room, spawn a weapon drop near the player for the Weapon Comparison Card, and test trailing HP/Armor bars + Armor Break SFX
    const hudCheck = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.inHub = false;
      const combatRoom =
        sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
      sim.enterRoom(combatRoom.id);
      sim.skipCurrentRoomWaves();
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      sim.pickups.length = 0;
      sim.chests.length = 0;
      sim.props.length = 0;

      const p1 = sim.player;
      p1.godMode = false;
      p1.invulnerableTimer = 0;
      p1.x = sim.map.width * 0.5;
      p1.y = sim.map.height * 0.5;
      p1.hp = p1.maxHp;
      p1.armor = 2;

      // Spawn a high-rarity weapon right next to P1 (dist <= 64u) to trigger Weapon Comparison Tooltip
      sim.spawnWorldItem({
        kind: 'weapon',
        weaponId: 'scrap_shotgun',
        rarity: 'epic',
        nameVi: 'Shotgun Phế Liệu',
        costGold: 0,
        healAmount: 0,
        x: p1.x + 48,
        y: p1.y + 18,
      });

      // Damage P1 directly to break armor (2 -> 0) and reduce HP (8 -> 6) so trailing bars & armor_break SFX trigger
      sim.applyDamageToPlayer(4, 0, 0, 'goblin_shooter', p1);

      // Trigger dash & skill cooldowns so bottom-left ability sweep cards display active cooldown progress
      p1.skillCooldownTimer = 4.2;
      p1.dashCooldownTimer = 0.7;

      return {
        hp: p1.hp,
        maxHp: p1.maxHp,
        armor: p1.armor,
      };
    });

    expect(hudCheck.armor).toBe(0);
    expect(hudCheck.hp).toBeLessThan(hudCheck.maxHp);

    // Wait for Iris transition to finish opening so HUD + Weapon Comparison Card are unobstructed
    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__.playerHp < window.__GAME_DEBUG__.playerMaxHp &&
        window.__GAME_DEBUG__.weaponComparisonVisible === true &&
        window.__GAME_DEBUG__.irisTransitionProgress === 0,
      null,
      { timeout: 5000 },
    );
    const trailingState = await page.evaluate(() => ({
      trailingHpRatio: window.__GAME_DEBUG__.trailingHpRatio,
      trailingArmorRatio: window.__GAME_DEBUG__.trailingArmorRatio,
      hpRatio: window.__GAME_DEBUG__.playerHp / window.__GAME_DEBUG__.playerMaxHp,
      sfxPlayedCount: window.__GAME_DEBUG__.sfxPlayedCount,
      comparedWeaponId: window.__GAME_DEBUG__.comparedWeaponId,
    }));
    expect(trailingState.trailingHpRatio).toBeGreaterThanOrEqual(trailingState.hpRatio);
    expect(trailingState.sfxPlayedCount).toBeGreaterThan(0);
    expect(trailingState.comparedWeaponId).toBe('scrap_shotgun');

    // Capture HUD + Weapon Comparison Tooltip screenshot before opening Pause modal
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'hud-weapon-compare-1080p.png'),
    });

    // 4. Press [Escape] to open Pause Overlay and verify Solo simulation freezes while paused
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);

    const pauseCheck1 = await page.evaluate(() => ({
      pauseModalOpen: window.__GAME_DEBUG__.pauseModalOpen,
      tickAtPause: window.__GAME_DEBUG__.tick,
    }));
    expect(pauseCheck1.pauseModalOpen).toBe(true);

    await page.waitForTimeout(250);
    const tickWhilePaused = await page.evaluate(() => window.__GAME_DEBUG__.tick);
    expect(tickWhilePaused).toBe(pauseCheck1.tickAtPause);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'hud-weapon-compare-pause.png'),
    });

    // Resume from Pause Overlay via [Escape] and verify simulation tick advances again
    await page.keyboard.press('Escape');
    await page.waitForTimeout(220);
    const pauseCheck2 = await page.evaluate(() => ({
      pauseModalOpen: window.__GAME_DEBUG__.pauseModalOpen,
      tickAfterResume: window.__GAME_DEBUG__.tick,
    }));
    expect(pauseCheck2.pauseModalOpen).toBe(false);
    expect(pauseCheck2.tickAfterResume).toBeGreaterThan(tickWhilePaused);

    // 5. Verify Dynamic Procedural Music Theme & Combat Layer Crossfade + 4-Player Co-op Victory MVP Awards Screen
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.spawnEnemy('goblin_shooter', 640, 260, true);
    });
    await page.waitForTimeout(220);
    const combatMusicCheck = await page.evaluate(() => ({
      musicTheme: window.__GAME_DEBUG__.musicTheme,
      musicCombatMix: window.__GAME_DEBUG__.musicCombatMix,
    }));
    expect(combatMusicCheck.musicTheme).toBe('biome1');
    expect(combatMusicCheck.musicCombatMix).toBeGreaterThan(0);

    // Setup 4 Co-op players with rich combat statistics and trigger Run Victory screen with 4 MVP Awards + Per-Player Performance Table
    const mvpAwards = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.enemies.length = 0;

      const p1 = sim.player;
      sim.selectCharacter(p1.id, 'vanguard');
      p1.displayName = 'Thiết Vệ P1';
      p1.gold = 310;
      p1.statsDamageDealt = 940;
      p1.statsKills = 34; // Slayer MVP
      p1.statsRevives = 1;
      p1.statsDamageTaken = 18;
      p1.statsElementalReactions = 3;
      p1.statsTeamCombos = 2;

      const p2 = sim.addCoopPlayer(2, 'ranger', 'Liệp Ưng P2', 2);
      p2.statsDamageDealt = 2480; // Damage MVP
      p2.statsKills = 22;
      p2.statsDamageTaken = 8;
      p2.statsElementalReactions = 4;
      p2.statsTeamCombos = 1;

      const p3 = sim.addCoopPlayer(3, 'elementalist', 'Lam Hỏa P3', 3);
      p3.statsDamageDealt = 1650;
      p3.statsKills = 14;
      p3.statsDamageTaken = 6;
      p3.statsElementalReactions = 14; // Elemental MVP
      p3.statsTeamCombos = 6;

      const p4 = sim.addCoopPlayer(4, 'druid', 'Mộc Linh P4', 4);
      p4.statsDamageDealt = 780;
      p4.statsKills = 8;
      p4.statsRevives = 4; // Medic MVP
      p4.statsDamageTaken = 14;

      sim.runStats.kills = 78;
      sim.runStats.elitesKilled = 6;
      sim.runStats.damageDealt = 5850;
      sim.runStats.goldEarned = 420;
      sim.runStats.roomsCleared = 14;
      sim.runStats.elementalReactions = 21;
      sim.runStats.teamCombos = 9;
      sim.teamComboCount = 9;
      sim.currentBiome = 3;
      sim.currentFloor = 6;
      sim.runState = 'victory';

      return sim.computeMvpAwards();
    });

    expect(mvpAwards).toHaveLength(4);
    expect(mvpAwards.find((a) => a.category === 'damage')?.playerSlot).toBe(2);
    expect(mvpAwards.find((a) => a.category === 'slayer')?.playerSlot).toBe(1);
    expect(mvpAwards.find((a) => a.category === 'elemental')?.playerSlot).toBe(3);
    expect(mvpAwards.find((a) => a.category === 'medic')?.playerSlot).toBe(4);

    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__.runState === 'victory' &&
        window.__GAME_DEBUG__.mvpAwardsCount === 4 &&
        window.__GAME_DEBUG__.fps >= 50,
      null,
      { timeout: 4000 },
    );
    const victoryDebug = await page.evaluate(() => ({
      runState: window.__GAME_DEBUG__.runState,
      mvpAwardsCount: window.__GAME_DEBUG__.mvpAwardsCount,
      lastSfxId: window.__GAME_DEBUG__.lastSfxId,
      fps: window.__GAME_DEBUG__.fps,
    }));
    expect(victoryDebug.runState).toBe('victory');
    expect(victoryDebug.mvpAwardsCount).toBe(4);
    expect(victoryDebug.lastSfxId).toBe('ui_victory');
    expect(victoryDebug.fps).toBeGreaterThanOrEqual(50);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'victory-mvp-awards.png'),
    });

    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);
  });
});
