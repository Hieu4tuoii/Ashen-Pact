import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/screenshots/phase-5');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe('Phase 5 — 5 Playable Characters, Skills & 10 Upgrades, 6 Elemental Reactions & Co-op Team Combo', () => {
  test('verifies Hub 5-character statues + Skill/Synergy Preview panel, Art Gallery Page 4 (5 Characters), and Co-op Elemental Reactions + Team Combo (+15 Energy) in combat', async ({
    page,
  }) => {
    test.setTimeout(60000);

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

    // 1. Open Hub room and verify 5 character statues & Skill/Synergy Preview panel
    await page.goto('/?hub=1');
    await page.waitForFunction(
      () => window.__GAME_DEBUG__?.scene === 'GameScene' && window.__GAME_DEBUG__?.inHub === true,
      null,
      { timeout: 15000 },
    );

    const statueCount = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      return sim.hubStatues.length;
    });
    expect(statueCount).toBe(5);

    // Move player next to Lam Hỏa (elementalist) statue at Hub and interact [E] to select + show Skill & Synergy Preview
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const statue = sim.hubStatues.find((s) => s.characterId === 'elementalist');
      if (statue) {
        sim.player.x = statue.x;
        sim.player.y = statue.y + 44;
        sim.interactWithNearest(sim.player);
      }
    });
    await page.waitForTimeout(350);

    const selectedChar = await page.evaluate(() => window.__GAME_DEBUG__.playerCharacterId);
    expect(selectedChar).toBe('elementalist');
    const previewChar = await page.evaluate(() => window.__GAME_DEBUG__.hubPreviewCharacterId);
    expect(previewChar).toBe('elementalist');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'hub-5-characters-skill-preview-1080p.png'),
    });

    // 2. Enter Dungeon Combat Room and showcase all 5 characters' skills, summons, zones, 6 Elemental Reactions & Co-op Team Combo
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.startDungeonRunFromHub();
      const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat');
      if (combatRoom) {
        sim.enterRoom(combatRoom.id);
      }

      const p1 = sim.player;
      sim.selectCharacter(p1.id, 'elementalist');
      p1.godMode = true;
      p1.x = 365;
      p1.y = 355;
      p1.aimAngle = 0;

      // Add Co-op teammates representing Druid, Engineer, and Vanguard
      const p2 = sim.addCoopPlayer(2, 'druid', 'Mộc Linh P2', 2);
      p2.godMode = true;
      p2.x = 365;
      p2.y = 275;

      const p3 = sim.addCoopPlayer(3, 'engineer', 'Bánh Răng P3', 3);
      p3.godMode = true;
      p3.x = 365;
      p3.y = 430;

      const p4 = sim.addCoopPlayer(4, 'vanguard', 'Thiết Vệ P4', 4);
      p4.godMode = true;
      p4.x = 468;
      p4.y = 345;
      p4.skillActiveTimer = 3.8;

      // Enable skill upgrades for rich visual verification
      p1.blessingIds.push('elementalist_vortex', 'elementalist_twin_orbit');
      p2.blessingIds.push('druid_poison_roots', 'druid_sacred_grove');
      p3.blessingIds.push('engineer_twin_turrets');
      p4.blessingIds.push('vanguard_bastion_prism');

      // Spawn high-HP enemies well-separated so Marks, Roots, Elemental Zones & Team Combo popups never overlap
      const bossTarget = sim.spawnEnemy('wild_boar', 635, 420, true, 'shield');
      bossTarget.hp = 1500;
      bossTarget.maxHp = 1500;
      bossTarget.markedTimer = 5.5;
      bossTarget.rootedTimer = 3.0;
      bossTarget.superconductTimer = 4.5;
      bossTarget.burnTimer = 4.0;
      bossTarget.lastElementOwnerId = p1.id;
      bossTarget.lastElementApplied = 'burn';

      const enemy2 = sim.spawnEnemy('goblin_shaman', 575, 255, true);
      enemy2.hp = 900;
      enemy2.maxHp = 900;
      enemy2.markedTimer = 5.0;
      enemy2.burnTimer = 4.0;
      enemy2.lastElementOwnerId = p1.id;
      enemy2.lastElementApplied = 'burn';

      const enemy3 = sim.spawnEnemy('goblin_shooter', 790, 355, true);
      enemy3.hp = 900;
      enemy3.maxHp = 900;
      enemy3.burnTimer = 4.0;
      enemy3.shockTimer = 3.0;

      // Spawn Elementalist Dual-Element Vortex Zone
      sim.skillZones.push({
        id: 9001,
        ownerPlayerId: p1.id,
        x: 645,
        y: 415,
        radius: 72,
        ttlSec: 4.5,
        maxTtlSec: 5.0,
        tickTimer: 0.4,
        element: 'burn',
        secondaryElement: 'chill',
        vortex: true,
      });

      // Spawn Druid Sacred Tree + Engineer Tesla Turret (charged 85%)
      sim.summons.push(
        {
          id: 9002,
          ownerPlayerId: p2.id,
          kind: 'sacred_tree',
          nameVi: 'Cây Thiêng',
          x: 525,
          y: 280,
          radius: 18,
          auraRadius: 110,
          hp: 48,
          maxHp: 48,
          ttlSec: 5.5,
          maxTtlSec: 6.0,
          tickTimer: 1.5,
          healsRemaining: 2,
          charge: 0,
          poisonRoots: true,
          selfDestruct: false,
          rootedEnemyIds: [bossTarget.id],
        },
        {
          id: 9003,
          ownerPlayerId: p3.id,
          kind: 'tesla_turret',
          nameVi: 'Trụ Tesla',
          x: 525,
          y: 425,
          radius: 15,
          auraRadius: 195,
          hp: 45,
          maxHp: 45,
          ttlSec: 9.2,
          maxTtlSec: 10.0,
          tickTimer: 0.4,
          healsRemaining: 0,
          charge: 85,
          poisonRoots: false,
          selfDestruct: true,
          rootedEnemyIds: [],
        },
      );

      // Trigger Co-op Team Combo Elemental Reactions (P1 primed Burn, P3 triggers Overload & P2 triggers Vaporize!)
      p1.energy = 100;
      p3.energy = 100;
      sim.applyDamageToEnemy(bossTarget, 22, true, 'shock', 0, 0, true, p3.id);
      sim.applyDamageToEnemy(enemy2, 20, true, 'chill', 0, 0, false, p2.id);
    });

    await page.waitForTimeout(180);

    const combatCheck = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      return {
        teamComboCount: sim.teamComboCount,
        elementalReactions: sim.runStats.elementalReactions,
        summonCount: sim.summons.length,
        zoneCount: sim.skillZones.length,
        p1Energy: sim.player.energy,
      };
    });
    expect(combatCheck.teamComboCount).toBeGreaterThanOrEqual(2);
    expect(combatCheck.elementalReactions).toBeGreaterThanOrEqual(2);
    expect(combatCheck.summonCount).toBeGreaterThanOrEqual(2);
    expect(combatCheck.zoneCount).toBeGreaterThanOrEqual(1);
    expect(combatCheck.p1Energy).toBeGreaterThan(100); // +15 Energy from Team Combo!

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'combat-elemental-reactions-team-combo-1080p.png'),
    });

    // 3. Open Art Gallery Page 4 (4. 5 Nhân Vật) and capture 1080p showcase
    await page.goto('/?gallery=1');
    await page.waitForFunction(() => window.__GAME_DEBUG__?.scene === 'ArtGalleryScene', null, {
      timeout: 15000,
    });
    await page.evaluate(() => {
      window.__GALLERY_SET_PAGE__?.(4);
    });
    await page.waitForFunction(() => window.__GAME_DEBUG__?.galleryPage === 4, null, {
      timeout: 5000,
    });
    await page.waitForTimeout(350);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'gallery-5-characters-1080p.png'),
    });

    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);
  });
});
