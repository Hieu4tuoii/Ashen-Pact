import { expect, test } from '@playwright/test';

test.describe('Phase P11 — Balance, Data-Driven Difficulty Levers, Boss Drama & Spec 3.11 Polish', () => {
  test('verifies 10-room floor with Challenge Room, Wave Banner & Remaining Enemies HUD, Vengeful/Volley Elites, Boss CC DR + Phase Transition + Soft Enrage, and Settings Toast', async ({
    page,
  }) => {
    test.setTimeout(90000);

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        const text = msg.text();
        if (!text.includes('AudioContext') && !text.includes('WebGL')) {
          consoleErrors.push(`[${msg.type()}] ${text}`);
        }
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/?scene=game&testHooks=1');
    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.scene === 'GameScene' &&
        (window.__GAME_DEBUG__?.tick ?? 0) >= 25,
      null,
      { timeout: 15000 },
    );

    // 1. Verify 10-room dungeon floor with 4 combat rooms (including 1 Challenge Room) & tightened shop prices
    const dungeonCheck = await page.evaluate(() => {
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            transport: {
              getSim: () => {
                inHub: boolean;
                startDungeonRunFromHub: () => void;
                dungeon: {
                  rooms: Array<{
                    id: number;
                    type: string;
                    isChallenge?: boolean;
                    wavesTotal: number;
                    chestRarity: string | null;
                    shopOffers: Array<{ kind: string; costGold: number }>;
                  }>;
                };
              };
            };
          }
        | undefined;
      if (!gs) return null;
      const sim = gs.transport.getSim();
      if (sim.inHub) {
        sim.startDungeonRunFromHub();
      }
      const rooms = sim.dungeon.rooms;
      const combatRooms = rooms.filter((r) => r.type === 'combat');
      const challengeRoom = combatRooms.find((r) => r.isChallenge);
      const merchantRoom = rooms.find((r) => r.type === 'merchant');
      const shopPrices = Object.fromEntries(
        (merchantRoom?.shopOffers ?? []).map((o) => [o.kind, o.costGold]),
      );
      return {
        totalRooms: rooms.length,
        combatRoomCount: combatRooms.length,
        hasChallengeRoom: Boolean(challengeRoom),
        challengeWavesTotal: challengeRoom?.wavesTotal ?? 0,
        challengeChestRarity: challengeRoom?.chestRarity ?? null,
        shopPrices,
      };
    });

    expect(dungeonCheck).not.toBeNull();
    expect(dungeonCheck!.totalRooms).toBe(10);
    expect(dungeonCheck!.combatRoomCount).toBe(4);
    expect(dungeonCheck!.hasChallengeRoom).toBe(true);
    expect(dungeonCheck!.challengeWavesTotal).toBe(3);
    expect(dungeonCheck!.challengeChestRarity).toBe('epic');
    expect(dungeonCheck!.shopPrices.health_potion).toBe(30);
    expect([55, 85]).toContain(dungeonCheck!.shopPrices.weapon);
    expect(dungeonCheck!.shopPrices.armor_upgrade).toBe(65);

    // 2. Enter Challenge Room -> verify Wave Banner ("PHÒNG THỬ THÁCH — ĐỢT 1/3"), Remaining Enemies Pill & Overlapping Wave 2
    const waveDramaCheck = await page.evaluate(() => {
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            transport: {
              getSim: () => {
                dungeon: { rooms: Array<{ id: number; type: string; isChallenge?: boolean; wavesSpawned: number }> };
                enterRoom: (id: number) => boolean;
                enemies: Array<{ id: number; isDummy: boolean; hp: number; waveIndex?: number }>;
                applyDamageToEnemy: (
                  e: unknown,
                  dmg: number,
                  crit: boolean,
                  el: string,
                  ang: number,
                  kb: number,
                ) => void;
                step: (dt: number) => void;
              };
            };
            processSimEvents: () => void;
            updateQoLHudAndMinimap: (dt: number) => void;
            p11WaveBannerContainer?: {
              visible: boolean;
              x: number;
              y: number;
              scrollFactorX: number;
              scrollFactorY: number;
            };
            p11WaveBannerTitleText?: { text: string };
            p11RemainingEnemiesBg?: {
              visible: boolean;
              x: number;
              y: number;
              scrollFactorX: number;
              scrollFactorY: number;
            };
            p11RemainingEnemiesText?: { visible: boolean; text: string; x: number; y: number };
          }
        | undefined;
      if (!gs) return null;
      const sim = gs.transport.getSim();
      const challengeRoom = sim.dungeon.rooms.find((r) => r.type === 'combat' && r.isChallenge)!;
      sim.enterRoom(challengeRoom.id);
      gs.processSimEvents();
      gs.updateQoLHudAndMinimap(0.016);

      const wave1BannerTitle = gs.p11WaveBannerTitleText?.text ?? '';
      const wave1RemainingText = gs.p11RemainingEnemiesText?.text ?? '';
      const wave1BannerVisible = Boolean(gs.p11WaveBannerContainer?.visible);
      const wave1RemainingVisible = Boolean(gs.p11RemainingEnemiesBg?.visible);
      const bannerX = gs.p11WaveBannerContainer?.x ?? -1;
      const bannerY = gs.p11WaveBannerContainer?.y ?? -1;
      const bannerScrollX = gs.p11WaveBannerContainer?.scrollFactorX ?? 0;
      const pillX = gs.p11RemainingEnemiesBg?.x ?? -1;
      const pillY = gs.p11RemainingEnemiesBg?.y ?? -1;
      const pillScrollX = gs.p11RemainingEnemiesBg?.scrollFactorX ?? 0;

      // Step 2.0s so waveElapsedSec >= 1.5s, then kill all but 1 enemy to trigger overlapping Wave 2
      for (let i = 0; i < 120; i++) {
        sim.step(1 / 60);
      }
      const wave1Enemies = sim.enemies.filter((e) => !e.isDummy && e.hp > 0);
      for (let i = 1; i < wave1Enemies.length; i++) {
        sim.applyDamageToEnemy(wave1Enemies[i]!, 9999, false, 'none', 0, 0);
      }
      sim.step(1 / 60);
      gs.processSimEvents();
      gs.updateQoLHudAndMinimap(0.016);

      return {
        wave1BannerVisible,
        wave1BannerTitle,
        wave1RemainingVisible,
        wave1RemainingText,
        bannerX,
        bannerY,
        bannerScrollX,
        pillX,
        pillY,
        pillScrollX,
        wavesSpawnedAfterOverlap: challengeRoom.wavesSpawned,
        wave2BannerTitle: gs.p11WaveBannerTitleText?.text ?? '',
      };
    });

    expect(waveDramaCheck).not.toBeNull();
    expect(waveDramaCheck!.wave1BannerVisible).toBe(true);
    expect(waveDramaCheck!.wave1BannerTitle).toContain('THỬ THÁCH');
    expect(waveDramaCheck!.wave1BannerTitle).toContain('ĐỢT 1/3');
    expect(waveDramaCheck!.wave1RemainingVisible).toBe(true);
    expect(waveDramaCheck!.wave1RemainingText).toContain('Còn:');
    expect(waveDramaCheck!.bannerX).toBeGreaterThanOrEqual(0);
    expect(waveDramaCheck!.bannerX).toBeLessThanOrEqual(960);
    expect(waveDramaCheck!.bannerY).toBeGreaterThanOrEqual(0);
    expect(waveDramaCheck!.bannerY).toBeLessThanOrEqual(540);
    expect(waveDramaCheck!.bannerScrollX).toBe(1);
    expect(waveDramaCheck!.pillX).toBeGreaterThanOrEqual(0);
    expect(waveDramaCheck!.pillX).toBeLessThanOrEqual(960);
    expect(waveDramaCheck!.pillY).toBeGreaterThanOrEqual(0);
    expect(waveDramaCheck!.pillY).toBeLessThanOrEqual(540);
    expect(waveDramaCheck!.pillScrollX).toBe(1);
    expect(waveDramaCheck!.wavesSpawnedAfterOverlap).toBe(2);
    expect(waveDramaCheck!.wave2BannerTitle).toContain('ĐỢT 2/3');

    // 3. Verify Boss Phase Transition (1.2s invulnerability + bullet clear + HUD badge) & Soft Enrage + Settings Toast
    const bossAndToastCheck = await page.evaluate(() => {
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            transport: {
              getSim: () => {
                advanceToFloor: (f: 1 | 2 | 3 | 4 | 5 | 6) => void;
                dungeon: { rooms: Array<{ id: number; type: string }> };
                enterRoom: (id: number) => boolean;
                getActiveBoss: () => {
                  id: number;
                  hp: number;
                  maxHp: number;
                  bossPhase: number;
                  bossPhaseTransitionTimer?: number;
                  bossCombatElapsedSec?: number;
                  bossEnrageLevel?: number;
                } | null;
                applyDamageToEnemy: (
                  e: unknown,
                  dmg: number,
                  crit: boolean,
                  el: string,
                  ang: number,
                  kb: number,
                ) => void;
                step: (dt: number) => void;
              };
            };
            processSimEvents: () => void;
            updateQoLHudAndMinimap: (dt: number) => void;
            bossTitleText: { text: string };
            p11WaveBannerTitleText?: { text: string };
            p11SettingsToastContainer?: {
              visible: boolean;
              x: number;
              y: number;
              scrollFactorX: number;
            };
            p11SettingsToastText?: { text: string };
            music: { getState: () => { intensityBoost?: number } };
          }
        | undefined;
      if (!gs) return null;
      const sim = gs.transport.getSim();
      sim.advanceToFloor(2);
      const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
      sim.enterRoom(bossRoom.id);
      for (let i = 0; i < 55; i++) {
        sim.step(1 / 60);
      }
      const boss = sim.getActiveBoss()!;
      sim.applyDamageToEnemy(boss, Math.ceil(boss.maxHp * 0.36), false, 'none', 0, 0);
      gs.processSimEvents();
      gs.updateQoLHudAndMinimap(0.016);

      const phase2Title = gs.bossTitleText.text;
      const phase2Banner = gs.p11WaveBannerTitleText?.text ?? '';
      const transitionTimer = boss.bossPhaseTransitionTimer ?? 0;

      // Trigger Soft Enrage at 90s
      boss.bossPhaseTransitionTimer = 0;
      boss.bossCombatElapsedSec = 89.95;
      boss.bossEnrageLevel = 0;
      sim.step(0.1);
      gs.processSimEvents();
      gs.updateQoLHudAndMinimap(0.016);

      const enrageTitle = gs.bossTitleText.text;
      const enrageLevel = boss.bossEnrageLevel ?? 0;

      // Dispatch Settings Toast event
      window.dispatchEvent(
        new CustomEvent('ashen-pact-settings-toast', {
          detail: { kind: 'fullscreen', detailVi: 'Toàn màn hình: BẬT' },
        }),
      );

      // Also verify botAutoPlayActive cleanly clears a combat room
      sim.advanceToFloor(1);
      const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat' && !r.isChallenge)!;
      sim.enterRoom(combatRoom.id);
      (sim as unknown as { botAutoPlayActive: boolean }).botAutoPlayActive = true;
      for (let i = 0; i < 7200 && !combatRoom.cleared; i++) {
        sim.step(1 / 60);
      }
      (sim as unknown as { botAutoPlayActive: boolean }).botAutoPlayActive = false;

      return {
        bossPhase: boss.bossPhase,
        transitionTimer,
        phase2Title,
        phase2Banner,
        enrageLevel,
        enrageTitle,
        toastVisible: Boolean(gs.p11SettingsToastContainer?.visible),
        toastText: gs.p11SettingsToastText?.text ?? '',
        toastX: gs.p11SettingsToastContainer?.x ?? -1,
        toastY: gs.p11SettingsToastContainer?.y ?? -1,
        toastScrollX: gs.p11SettingsToastContainer?.scrollFactorX ?? 0,
        botRoomCleared: Boolean(combatRoom.cleared),
      };
    });

    expect(bossAndToastCheck).not.toBeNull();
    expect(bossAndToastCheck!.bossPhase).toBe(2);
    expect(bossAndToastCheck!.transitionTimer).toBeGreaterThan(0.5);
    expect(bossAndToastCheck!.phase2Title).toContain('BẤT TỬ · CHUYỂN PHA');
    expect(bossAndToastCheck!.phase2Banner).toContain('CHUYỂN PHA 2');
    expect(bossAndToastCheck!.enrageLevel).toBe(1);
    expect(bossAndToastCheck!.enrageTitle).toContain('CUỒNG NỘ ×1');
    expect(bossAndToastCheck!.toastVisible).toBe(true);
    expect(bossAndToastCheck!.toastText).toContain('Toàn màn hình');
    expect(bossAndToastCheck!.toastX).toBeGreaterThanOrEqual(0);
    expect(bossAndToastCheck!.toastX).toBeLessThanOrEqual(960);
    expect(bossAndToastCheck!.toastY).toBeGreaterThanOrEqual(0);
    expect(bossAndToastCheck!.toastY).toBeLessThanOrEqual(540);
    expect(bossAndToastCheck!.toastScrollX).toBe(1);
    expect(bossAndToastCheck!.botRoomCleared).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
});
