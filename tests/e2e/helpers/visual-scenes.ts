import {
  BIOME2_GAME_URL,
  BIOME3_GAME_URL,
  DEBUG_GAME_URL,
  DEBUG_MENU_URL,
  DEFAULT_FREEZE_MASK_RECTS,
  DEFAULT_GALLERY_URL,
  DEFAULT_GAME_URL,
  DEFAULT_HUB_URL,
  DEFAULT_MENU_URL,
  ENVIRONMENT_SAMPLE_RECTS,
  HUB_SAMPLE_RECTS,
  installDeterministicRafGate,
  lockCameraAndIrisToPlayer,
  makeScene,
  setSceneLightingAndRenderStaticFrame,
  setupB1CombatState,
  setupB2CombatState,
  setupB3CombatState,
  setupBossScene,
  setupHubSoloScene,
  setupRunResultModalScene,
  setupStartRoomScene,
  setupWeaponGroundDistanceScene,
  stepDeterministicFrames,
  switchGameSceneToEnglish,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export {
  DEFAULT_FREEZE_MASK_RECTS,
  ENVIRONMENT_SAMPLE_RECTS,
  HUB_SAMPLE_RECTS,
  installDeterministicRafGate,
  setSceneLightingAndRenderStaticFrame,
  stepDeterministicFrames,
  type VisualSceneDef,
};

export const VISUAL_SCENES: readonly VisualSceneDef[] = [
  // 1. Menu
  makeScene('menu', 'Main menu campfire hub in Vietnamese', DEFAULT_MENU_URL, 'MenuScene', async (page) => {
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('menu-debug-on', 'Main menu with ?debug=1 showing Art Gallery, Toggle Anim & Vietnamese debug footer', DEBUG_MENU_URL, 'MenuScene', async (page) => {
    await page.mouse.click(1136, 706);
    await stepDeterministicFrames(page, 2);
    const toggledToRun = await page.evaluate(() => window.__GAME_DEBUG__?.animState === 'run');
    if (!toggledToRun) {
      throw new Error('Expected Toggle Anim (Đổi Hoạt Ảnh) debug button to be visible and interactive in menu-debug-on');
    }
    await page.mouse.click(1136, 706);
    await page.mouse.move(960, 540);
    await stepDeterministicFrames(page, 45);
    const menuCheck = await page.evaluate(() => ({
      animState: window.__GAME_DEBUG__?.animState,
      hasViFooterSample: Boolean(window.__GAME_DEBUG__?.vietnameseSampleText?.includes('Tiếng Việt')),
    }));
    if (menuCheck.animState !== 'idle' || !menuCheck.hasViFooterSample) {
      throw new Error(`menu-debug-on verification failed: ${JSON.stringify(menuCheck)}`);
    }
  }),
  makeScene('menu-settings', 'Main menu with Settings modal open', DEFAULT_MENU_URL, 'MenuScene', async (page) => {
    await page.keyboard.press('o');
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('menu-join-input', 'Main menu with LAN Co-op Join IP input active', DEFAULT_MENU_URL, 'MenuScene', async (page) => {
    await page.mouse.click(1210, 352);
    await page.mouse.move(960, 540);
    await stepDeterministicFrames(page, 45);
  }),

  // 2. Hub
  makeScene('hub-solo', 'Hub courtyard solo with statues and weapon rack', DEFAULT_HUB_URL, 'GameScene', setupHubSoloScene, {
    captureUnlit: true,
    sampleRects: HUB_SAMPLE_RECTS,
  }),
  makeScene('hub-coop-2p', 'Hub courtyard with 2 Co-op players and LAN Invite QR panel', DEFAULT_HUB_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.enterHub();
      sim.addCoopPlayer(2, 'ranger', 'Ưng Nhãn P2', 2);
      sim.enterHub();
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('hub-near-statue', 'Hub courtyard with player near a Character Statue', DEFAULT_HUB_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.enterHub();
      const statue = sim.hubStatues[0]!;
      sim.player.x = statue.x;
      sim.player.y = statue.y + 28;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('hub-near-rack', 'Hub courtyard with player near Practice Weapon Rack', DEFAULT_HUB_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.enterHub();
      const rackItem = sim.worldItems[0]!;
      sim.player.x = rackItem.x;
      sim.player.y = rackItem.y + 28;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),

  // 3. Biome 1
  makeScene('b1-start-room', 'Biome 1 start room with braziers and cleared waves', DEFAULT_GAME_URL, 'GameScene', setupStartRoomScene, {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b1-hud-debug-on', 'Biome 1 start room with ?debug=1 and F1 DebugOverlay open', DEBUG_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.enterRoom(sim.dungeon.startRoomId);
      sim.skipCurrentRoomWaves();
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      sim.player.x = 340;
      sim.player.y = 270;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 40);
    await page.keyboard.press('F1');
    await stepDeterministicFrames(page, 5);
    const hudCheck = await page.evaluate(() => {
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            elementBtnText?: { visible: boolean; text: string };
            qualityBtnText?: { visible: boolean; text: string };
            galleryBtnText?: { visible: boolean; text: string };
            statsLineText?: { visible: boolean; text: string };
            statusText?: { visible: boolean; text: string };
            debugOverlay?: { container?: { visible: boolean } };
          }
        | undefined;
      return {
        overlayVisible: window.__GAME_DEBUG__?.overlayVisible === true,
        overlayContainerVisible: gs?.debugOverlay?.container?.visible === true,
        elementVisible: gs?.elementBtnText?.visible === true && Boolean(gs.elementBtnText.text.includes('[R] Ng.Tố')),
        qualityVisible: gs?.qualityBtnText?.visible === true && Boolean(gs.qualityBtnText.text.includes('[G] Đồ Họa')),
        galleryVisible: gs?.galleryBtnText?.visible === true && gs.galleryBtnText.text === '[Art Gallery]',
        hasDps: Boolean(gs?.statsLineText?.text.includes('DPS')),
        hasDebugHint: Boolean(gs?.statusText?.text.includes('F1-F7: Debug')),
      };
    });
    if (
      !hudCheck.overlayVisible ||
      !hudCheck.overlayContainerVisible ||
      !hudCheck.elementVisible ||
      !hudCheck.qualityVisible ||
      !hudCheck.galleryVisible ||
      !hudCheck.hasDps ||
      !hudCheck.hasDebugHint
    ) {
      throw new Error(`b1-hud-debug-on verification failed: ${JSON.stringify(hudCheck)}`);
    }
  }),
  makeScene('b1-combat', 'Biome 1 combat room with all 6 enemy types, 1 elite, and bullets', DEFAULT_GAME_URL, 'GameScene', (p) => setupB1CombatState(p, false), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b1-chest-closed-far', 'Biome 1 treasure room with closed chest from far away', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const room = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
      sim.enterRoom(room.id);
      const chest = sim.chests[0]!;
      sim.player.x = chest.x - 210;
      sim.player.y = chest.y;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('b1-chest-near', 'Biome 1 treasure room with player near chest', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const room = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
      sim.enterRoom(room.id);
      const chest = sim.chests[0]!;
      sim.player.x = chest.x;
      sim.player.y = chest.y + 28;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('b1-weapon-ground-far', 'Biome 1 dropped weapon from far (> 180u)', DEFAULT_GAME_URL, 'GameScene', (p) => setupWeaponGroundDistanceScene(p, 210)),
  makeScene('b1-weapon-ground-mid', 'Biome 1 dropped weapon from mid (~100u)', DEFAULT_GAME_URL, 'GameScene', (p) => setupWeaponGroundDistanceScene(p, 100)),
  makeScene('b1-weapon-ground-near', 'Biome 1 dropped weapon within interact range (<= 64u)', DEFAULT_GAME_URL, 'GameScene', (p) => setupWeaponGroundDistanceScene(p, 32)),
  makeScene('b1-weapon-drop', 'Biome 1 active weapon drop [X] with 2-slot HUD empty state and 8-frame 0.25s parabolic toss arc strip', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.enterRoom(sim.dungeon.startRoomId);
      sim.skipCurrentRoomWaves();
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      sim.worldItems.length = 0;
      sim.player.x = 340;
      sim.player.y = 270;
      sim.player.weaponSlots = ['knight_sword', 'solar_archon_staff'];
      sim.player.activeWeaponSlot = 1;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 43);
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.player.aimAngle = 0;
      const dropped = sim.dropActiveWeapon(sim.player.id);
      if (dropped) {
        dropped.fromX = sim.player.x + 24;
        dropped.x = sim.player.x + 58;
      }
    });
    await stepDeterministicFrames(page, 2);
  }, { captureStrip: true, stripFramesPerStep: 2 }),
  makeScene('b1-merchant', 'Biome 1 Dark Merchant room with shop items', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const room = sim.dungeon.rooms.find((r) => r.type === 'merchant')!;
      sim.enterRoom(room.id);
      sim.player.gold = 250;
      sim.player.x = sim.map.width * 0.5 - 60;
      sim.player.y = sim.map.height * 0.5 + 10;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('b1-shrine', 'Biome 1 Ancient Shrine room with blood altar', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const room = sim.dungeon.rooms.find((r) => r.type === 'shrine')!;
      sim.enterRoom(room.id);
      sim.player.x = sim.map.width * 0.5;
      sim.player.y = sim.map.height * 0.5 + 24;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('b1-door-locked', 'Biome 1 locked iron gate during active combat lockdown', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
      sim.enterRoom(combatRoom.id);
      sim.enemies.length = 0;
      const keeper = sim.spawnEnemy('thorn_turret', 680, 270, true);
      keeper.hp = 9999;
      keeper.maxHp = 9999;
      const door = sim.doors[0];
      sim.player.godMode = true;
      sim.player.x = door ? door.x + 64 : 180;
      sim.player.y = door ? door.y : 270;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('b1-door-open', 'Biome 1 unlocked corridor doors after room clear', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
      sim.enterRoom(combatRoom.id);
      sim.skipCurrentRoomWaves();
      sim.enemies.length = 0;
      const door = sim.doors[0];
      sim.player.x = door ? door.x + 64 : 180;
      sim.player.y = door ? door.y : 270;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('b1-portal-inactive', 'Biome 1 portal room before clearing final guard wave', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal')!;
      sim.enterRoom(portalRoom.id);
      sim.enemies.length = 0;
      const guard = sim.spawnEnemy('thorn_turret', 720, 270, true);
      guard.hp = 9999;
      guard.maxHp = 9999;
      sim.portalActive = false;
      sim.player.godMode = true;
      sim.player.x = sim.portalX - 72;
      sim.player.y = sim.portalY;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('b1-portal-active', 'Biome 1 active swirling floor portal with 8-frame strip', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal')!;
      sim.enterRoom(portalRoom.id);
      sim.skipCurrentRoomWaves();
      sim.enemies.length = 0;
      sim.portalActive = true;
      sim.player.x = sim.portalX - 48;
      sim.player.y = sim.portalY;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }, { captureStrip: true }),
  makeScene('b1-dark-interactables', 'Biome 1 interactables outside torch light from far away', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
      sim.enterRoom(room.id);
      sim.skipCurrentRoomWaves();
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      sim.props.length = 0;
      sim.chests.length = 0;
      sim.worldItems.length = 0;
      sim.npcEntities.length = 0;
      sim.pickups.length = 0;
      sim.events.length = 0;
      sim.player.x = 260;
      sim.player.y = 270;
      sim.spawnChest(555, 205, 'epic', 'arc_lightning_rifle');
      sim.spawnWorldItem({ kind: 'weapon', weaponId: 'dragon_breath_shotgun', rarity: 'legendary', nameVi: 'Shotgun Hỏa Long', costGold: 0, healAmount: 0, x: 555, y: 280 });
      sim.spawnWorldItem({ kind: 'weapon', weaponId: 'frost_bow', rarity: 'rare', nameVi: 'Cung Băng Giá', costGold: 55, healAmount: 0, x: 555, y: 355, offerId: 1 });
      sim.npcEntities.push({ id: ++sim.nextEntityId, kind: 'shrine', nameVi: 'Điện Thờ Cổ Đại', dialogueVi: 'Hiến tế máu đổi lấy phước lành.', x: 650, y: 225, radius: 20, interacted: false, costHp: 2 });
      sim.portalActive = true;
      sim.portalX = 650;
      sim.portalY = 335;
      sim.pickups.push(
        sim.acquirePickup({ id: ++sim.nextEntityId, kind: 'gold', x: 605, y: 250, vx: 0, vy: 0, amount: 12, ttlSec: 30 }),
        sim.acquirePickup({ id: ++sim.nextEntityId, kind: 'energy', x: 615, y: 258, vx: 0, vy: 0, amount: 10, ttlSec: 30 }),
        sim.acquirePickup({ id: ++sim.nextEntityId, kind: 'life_seed', x: 602, y: 264, vx: 0, vy: 0, amount: 2, ttlSec: 30 }),
      );
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 60);
  }),
  makeScene('b1-poison-swamp', 'Biome 1 poison swamp surface pool with enemies', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
      sim.enterRoom(room.id);
      sim.skipCurrentRoomWaves();
      sim.enemies.length = 0;
      sim.map.fillSurfaceRect(12, 7, 10, 7, 'poison_swamp');
      sim.map.mapRevision += 1;
      sim.player.godMode = true;
      sim.player.x = 340;
      sim.player.y = 280;
      const e1 = sim.spawnEnemy('green_slime', 480, 270, true);
      const e2 = sim.spawnEnemy('spore_bomber', 560, 310, true);
      e1.hp = 900;
      e1.maxHp = 900;
      e2.hp = 900;
      e2.maxHp = 900;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }, {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS.map((r) =>
      r.name === 'floor_center' ? { ...r, x: 384, y: 640 } : r,
    ),
  }),

  // 4. Biome 2 & 3
  makeScene('b2-start-room', 'Biome 2 Frozen Depths start room', BIOME2_GAME_URL, 'GameScene', setupStartRoomScene, {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b2-combat', 'Biome 2 Frozen Depths combat room', BIOME2_GAME_URL, 'GameScene', (p) => setupB2CombatState(p, false), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b2-chest', 'Biome 2 treasure room with player near chest', BIOME2_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const room = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
      sim.enterRoom(room.id);
      const chest = sim.chests[0]!;
      sim.player.x = chest.x;
      sim.player.y = chest.y + 28;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('b3-start-room', 'Biome 3 Molten Forge start room', BIOME3_GAME_URL, 'GameScene', setupStartRoomScene, {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b3-combat', 'Biome 3 Molten Forge combat room with enemy bullets near braziers', BIOME3_GAME_URL, 'GameScene', (p) => setupB3CombatState(p, false), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b3-chest', 'Biome 3 treasure room with player near chest', BIOME3_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const room = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
      sim.enterRoom(room.id);
      const chest = sim.chests[0]!;
      sim.player.x = chest.x;
      sim.player.y = chest.y + 28;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('b3-combat-grayscale', 'Grayscale conversion of b3-combat', BIOME3_GAME_URL, 'GameScene', (p) => setupB3CombatState(p, false), {
    grayscaleFrom: 'b3-combat',
  }),
  makeScene('b3-lava-surface', 'Biome 3 molten lava hazard surface and conveyor lanes', BIOME3_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
      sim.enterRoom(room.id);
      sim.skipCurrentRoomWaves();
      sim.enemies.length = 0;
      sim.map.fillSurfaceRect(11, 6, 8, 5, 'lava');
      sim.map.fillSurfaceRect(11, 12, 10, 2, 'conveyor');
      sim.map.mapRevision += 1;
      sim.player.godMode = true;
      sim.player.x = 310;
      sim.player.y = 270;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }, {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS.map((r) =>
      r.name === 'floor_center' ? { ...r, x: 1280, y: 576 } : r,
    ),
  }),

  // 5. Bosses
  makeScene('boss-b1', 'Biome 1 Boss Mục Vương Nấm Độc (Phase 1)', DEFAULT_GAME_URL, 'GameScene', (p) => setupBossScene(p, 2, 1)),
  makeScene('boss-b2', 'Biome 2 Boss Băng Hậu Kryssa (Phase 1)', BIOME2_GAME_URL, 'GameScene', (p) => setupBossScene(p, 4, 1), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('boss-b3', 'Biome 3 Boss Titan Lò Rèn (Phase 2 with Energy Cores & Shockwave)', BIOME3_GAME_URL, 'GameScene', (p) => setupBossScene(p, 6, 2, true)),
  makeScene('boss-b1-phase3', 'Biome 1 Boss Mục Vương Phase 3 with creeping poison border', DEFAULT_GAME_URL, 'GameScene', (p) => setupBossScene(p, 2, 3), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS.map((r) =>
      r.name === 'corner_tl'
        ? { ...r, x: 324, y: 420 }
        : r.name === 'corner_bl'
          ? { ...r, x: 324, y: 740 }
          : r,
    ),
  }),
  makeScene('boss-b2-blizzard', 'Biome 2 Boss Kryssa Phase 3 with Blizzard Veil', BIOME2_GAME_URL, 'GameScene', (p) => setupBossScene(p, 4, 3), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('boss-b3-phase3', 'Biome 3 Boss Forge Titan Phase 3 with molten lava border', BIOME3_GAME_URL, 'GameScene', (p) => setupBossScene(p, 6, 3), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS.map((r) =>
      r.name === 'corner_tl'
        ? { ...r, x: 324, y: 420 }
        : r.name === 'corner_bl'
          ? { ...r, x: 324, y: 740 }
          : r,
    ),
  }),

  // 6. Co-op & Stress
  makeScene('coop-4p-combat', '4-player Co-op combat with skills and teammate HUD', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
      sim.enterRoom(combatRoom.id);
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      const p1 = sim.player;
      sim.selectCharacter(p1.id, 'elementalist');
      p1.godMode = true;
      p1.x = 340;
      p1.y = 290;
      const p2 = sim.addCoopPlayer(2, 'druid', 'Mộc Linh P2', 2);
      const p3 = sim.addCoopPlayer(3, 'engineer', 'Bánh Răng P3', 3);
      const p4 = sim.addCoopPlayer(4, 'vanguard', 'Thiết Vệ P4', 4);
      p2.godMode = p3.godMode = p4.godMode = true;
      p2.x = 340;
      p2.y = 220;
      p3.x = 340;
      p3.y = 360;
      p4.x = 430;
      p4.y = 290;
      p4.skillActiveTimer = 3.5;
      const spawned = [
        sim.spawnEnemy('wild_boar', 600, 260, true, 'shield'),
        sim.spawnEnemy('goblin_shaman', 660, 330, true),
        sim.spawnEnemy('spore_bomber', 560, 350, true),
      ];
      for (const e of spawned) {
        e.hp = 1200;
        e.maxHp = 1200;
      }
      sim.activateCharacterSkill(p1);
      sim.activateCharacterSkill(p2);
      sim.activateCharacterSkill(p3);
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('stress-4p', '4-player + 80 enemies + 600+ bullets stress test scene', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => window.__GAME_STRESS_TEST__?.(true));
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),

  // 7. Modals & Typography
  makeScene('modal-buff', 'Between-floor Buff Selection Modal (Vietnamese)', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal')!;
      sim.enterRoom(portalRoom.id);
      sim.skipCurrentRoomWaves();
      sim.player.x = sim.portalX;
      sim.player.y = sim.portalY;
      sim.interactWithNearest();
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('modal-victory', 'Run Victory Summary Modal with 4P stats & MVP awards', DEFAULT_GAME_URL, 'GameScene', (p) => setupRunResultModalScene(p, 'victory', false)),
  makeScene('modal-defeat', 'Run Defeat Summary Modal with 4P stats & MVP awards', DEFAULT_GAME_URL, 'GameScene', (p) => setupRunResultModalScene(p, 'defeat', false)),
  makeScene('pause', 'Pause Overlay Modal in GameScene (Vietnamese)', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 40);
    await page.keyboard.press('Escape');
    await stepDeterministicFrames(page, 5);
  }),
  makeScene('pause-confirm-exit', 'Pause Overlay Modal focused on Leave to Menu action', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 40);
    await page.keyboard.press('Escape');
    await page.mouse.move(960, 754);
    await stepDeterministicFrames(page, 5);
  }),
  makeScene('ui-vi-diacritics', 'Vietnamese stacked diacritics verification across 12px-40px', DEFAULT_MENU_URL, 'MenuScene', async (page) => {
    await page.evaluate(() => {
      const sample = 'Tiếng Việt: ắ ằ ẳ ẵ ặ ầ ẩ ẫ ậ ỡ ự ữ ỹ Đ đ — 0123456789';
      const sizes = [12, 14, 16, 20, 28, 40];
      const host = document.createElement('div');
      host.id = 'vi-diacritics-showcase';
      host.style.cssText =
        'position:fixed;inset:48px 120px;background:rgba(14,18,26,0.97);border:3px solid #facc15;border-radius:14px;padding:32px 48px;z-index:99999;display:flex;flex-direction:column;justify-content:space-between;font-family:"Be Vietnam Pro",sans-serif;color:#f8fafc;box-sizing:border-box;';
      for (const sz of sizes) {
        const row = document.createElement('div');
        row.style.cssText = `font-size:${sz}px;font-weight:700;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px solid rgba(148,163,184,0.22);padding-bottom:6px;`;
        row.textContent = `[${sz}px] ${sample}`;
        host.appendChild(row);
      }
      document.body.appendChild(host);
    });
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('ui-emote-wheel', 'In-game 4-quadrant radial Emote Wheel while holding [T]', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.keyboard.up('KeyT');
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.enterRoom(sim.dungeon.startRoomId);
      sim.skipCurrentRoomWaves();
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      sim.player.x = 480;
      sim.player.y = 270;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 42);
    await page.mouse.move(960, 300);
    await page.keyboard.down('KeyT');
    await stepDeterministicFrames(page, 3);
    const wheelOpen = await page.evaluate(() => window.__GAME_DEBUG__?.emoteWheelOpen === true);
    if (!wheelOpen) {
      throw new Error('Expected Emote Wheel to be open in ui-emote-wheel scene');
    }
  }),

  // 8. Gallery
  makeScene('gallery-characters', 'ArtGalleryScene Page 4 (5 Playable Characters) with 8-frame strip', DEFAULT_GALLERY_URL, 'ArtGalleryScene', async (page) => {
    await page.evaluate(() => {
      window.__GALLERY_SET_PAGE__?.(4);
      window.__GALLERY_SET_ANIM__?.('run');
    });
    await stepDeterministicFrames(page, 45);
  }, { captureStrip: true }),
  makeScene('gallery-enemies', 'ArtGalleryScene Page 5 (Biome 2 & 3 Enemies and Bosses)', DEFAULT_GALLERY_URL, 'ArtGalleryScene', async (page) => {
    await page.evaluate(() => window.__GALLERY_SET_PAGE__?.(5));
    await stepDeterministicFrames(page, 45);
  }),

  // 9. Variants
  makeScene('b1-combat-1440p', 'Biome 1 combat at 2560x1440', DEFAULT_GAME_URL, 'GameScene', (p) => setupB1CombatState(p, false), { viewport: { width: 2560, height: 1440 } }),
  makeScene('b1-combat-ultrawide', 'Biome 1 combat at 2560x1080', DEFAULT_GAME_URL, 'GameScene', (p) => setupB1CombatState(p, false), { viewport: { width: 2560, height: 1080 } }),
  makeScene('b1-combat-1280x1024', 'Biome 1 combat at 1280x1024', DEFAULT_GAME_URL, 'GameScene', (p) => setupB1CombatState(p, false), { viewport: { width: 1280, height: 1024 } }),
  makeScene('hub-solo-1440p', 'Hub solo at 2560x1440', DEFAULT_HUB_URL, 'GameScene', setupHubSoloScene, { viewport: { width: 2560, height: 1440 } }),
  makeScene('hub-solo-ultrawide', 'Hub solo at 2560x1080', DEFAULT_HUB_URL, 'GameScene', setupHubSoloScene, { viewport: { width: 2560, height: 1080 } }),
  makeScene('hub-solo-1280x1024', 'Hub solo at 1280x1024', DEFAULT_HUB_URL, 'GameScene', setupHubSoloScene, { viewport: { width: 1280, height: 1024 } }),
  makeScene('b1-combat-low', 'Biome 1 combat at Low quality', DEFAULT_GAME_URL, 'GameScene', (p) => setupB1CombatState(p, true), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b2-combat-low', 'Biome 2 combat at Low quality', BIOME2_GAME_URL, 'GameScene', (p) => setupB2CombatState(p, true), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b3-combat-low', 'Biome 3 combat at Low quality', BIOME3_GAME_URL, 'GameScene', (p) => setupB3CombatState(p, true), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b1-portal-active-low', 'Biome 1 active portal at Low quality', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await page.evaluate(() => {
      window.__GAME_SET_QUALITY__?.('low');
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal')!;
      sim.enterRoom(portalRoom.id);
      sim.skipCurrentRoomWaves();
      sim.enemies.length = 0;
      sim.portalActive = true;
      sim.player.x = sim.portalX - 48;
      sim.player.y = sim.portalY;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('menu-en', 'Main menu in English locale', DEFAULT_MENU_URL, 'MenuScene', async (page) => {
    await page.keyboard.press('l');
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('menu-settings-en', 'Main menu Settings modal in English locale', DEFAULT_MENU_URL, 'MenuScene', async (page) => {
    await page.keyboard.press('l');
    await page.keyboard.press('o');
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('pause-en', 'Pause Overlay Modal in English locale', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await lockCameraAndIrisToPlayer(page);
    await switchGameSceneToEnglish(page);
    await stepDeterministicFrames(page, 40);
    await page.keyboard.press('Escape');
    await stepDeterministicFrames(page, 5);
  }),
  makeScene('modal-buff-en', 'Between-floor Buff Selection Modal in English locale', DEFAULT_GAME_URL, 'GameScene', async (page) => {
    await switchGameSceneToEnglish(page);
    await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal')!;
      sim.enterRoom(portalRoom.id);
      sim.skipCurrentRoomWaves();
      sim.player.x = sim.portalX;
      sim.player.y = sim.portalY;
      sim.interactWithNearest();
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('modal-victory-en', 'Run Victory Summary Modal in English locale', DEFAULT_GAME_URL, 'GameScene', (p) => setupRunResultModalScene(p, 'victory', true)),
];
