import type { Page } from '@playwright/test';
import type { SampleRect } from '../../../tools/visual-metrics.js';

export interface VisualSceneDef {
  id: string;
  description: string;
  url: string;
  expectedScene: 'MenuScene' | 'GameScene' | 'ArtGalleryScene';
  viewport?: { width: number; height: number };
  captureUnlit?: boolean;
  captureStrip?: boolean;
  grayscaleFrom?: string;
  sampleRects?: SampleRect[];
  freezeMaskRects?: SampleRect[];
  setup: (page: Page) => Promise<void>;
}

interface RafGateWindow {
  __STEP_RAF_FRAMES__?: (count: number) => Promise<void>;
}

const DEFAULT_GAME_URL = '/?scene=game&seed=1337&freeze=1&debug=0&testHooks=1';
const DEFAULT_HUB_URL = '/?scene=game&hub=1&seed=1337&freeze=1&debug=0&testHooks=1';
const DEFAULT_MENU_URL = '/?scene=menu&seed=1337&freeze=1&debug=0&testHooks=1';
const DEFAULT_GALLERY_URL = '/?scene=gallery&seed=1337&freeze=1&debug=0&testHooks=1';
const BIOME2_GAME_URL = '/?scene=game&biome=2&seed=1337&freeze=1&debug=0&testHooks=1';
const BIOME3_GAME_URL = '/?scene=game&biome=3&seed=1337&freeze=1&debug=0&testHooks=1';

export const ENVIRONMENT_SAMPLE_RECTS: SampleRect[] = [
  { name: 'floor_all', x: 240, y: 200, width: 1200, height: 640 },
  { name: 'center_arena', x: 760, y: 420, width: 320, height: 200 },
  { name: 'corner_tl', x: 140, y: 160, width: 180, height: 120 },
  { name: 'corner_tr', x: 1320, y: 160, width: 180, height: 120 },
  { name: 'corner_bl', x: 140, y: 760, width: 180, height: 120 },
  { name: 'corner_br', x: 1480, y: 760, width: 180, height: 120 },
  { name: 'brazier_pool', x: 380, y: 260, width: 70, height: 70 },
];

export const DEFAULT_FREEZE_MASK_RECTS: SampleRect[] = [
  { name: 'debug_ping_mask', x: 16, y: 76, width: 368, height: 48 },
];

/**
 * Installs a deterministic requestAnimationFrame gate and mocks /api/host-info
 * so every scene starts with clean localStorage, identical LAN IP/QR state,
 * and executes an exact deterministic number of 16.6667ms frames.
 */
export async function installDeterministicRafGate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage?.clear();
      window.sessionStorage?.clear();
    } catch {
      // Ignore storage access errors
    }

    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (urlStr.includes('/api/host-info')) {
        return new Response(
          JSON.stringify({
            lanIps: ['127.0.0.1'],
            primaryLanIp: '127.0.0.1',
            port: 2567,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return origFetch(input, init);
    };

    const origRAF = window.requestAnimationFrame.bind(window);
    let gateActive = false;
    let remainingSteps = 0;
    let syntheticTime = 1000;
    const pendingCallbacks: FrameRequestCallback[] = [];
    const waitResolvers: Array<() => void> = [];

    function pump(): void {
      origRAF(() => {
        const dbg = (
          window as unknown as {
            __GAME_DEBUG__?: { scene?: string; fontsLoaded?: boolean };
          }
        ).__GAME_DEBUG__;
        const isTargetReady =
          dbg !== undefined &&
          dbg.fontsLoaded === true &&
          (dbg.scene === 'MenuScene' ||
            dbg.scene === 'GameScene' ||
            dbg.scene === 'ArtGalleryScene');

        if (!gateActive && isTargetReady) {
          gateActive = true;
          remainingSteps = 2;
        }

        if (!gateActive || remainingSteps > 0) {
          if (gateActive && remainingSteps > 0) {
            remainingSteps -= 1;
          }
          syntheticTime += 16.6667;
          const cbs = pendingCallbacks.splice(0, pendingCallbacks.length);
          for (const cb of cbs) {
            cb(syntheticTime);
          }
          if (gateActive && remainingSteps === 0 && waitResolvers.length > 0) {
            const resolvers = waitResolvers.splice(0, waitResolvers.length);
            for (const r of resolvers) {
              r();
            }
          }
        }
        pump();
      });
    }

    window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      pendingCallbacks.push(cb);
      return pendingCallbacks.length;
    };

    (window as unknown as RafGateWindow).__STEP_RAF_FRAMES__ = (count: number): Promise<void> => {
      return new Promise<void>((resolve) => {
        if (count <= 0) {
          resolve();
          return;
        }
        gateActive = true;
        remainingSteps += count;
        waitResolvers.push(resolve);
      });
    };

    pump();
  });
}

export async function stepDeterministicFrames(page: Page, frameCount = 45): Promise<void> {
  await page.evaluate(async (count) => {
    const stepFn = (window as unknown as RafGateWindow).__STEP_RAF_FRAMES__;
    if (stepFn) {
      await stepFn(count);
    } else {
      for (let i = 0; i < count; i++) {
        await new Promise<void>((r) => window.requestAnimationFrame(() => r()));
      }
    }
  }, frameCount);
}

/**
 * Toggles scene lighting & PostFX on or off and renders 2 static frames
 * while keeping simulation, particles, rigs, and camera completely frozen.
 */
export async function setSceneLightingAndRenderStaticFrame(
  page: Page,
  enabled: boolean,
): Promise<void> {
  await page.evaluate(async (lightOn) => {
    window.__GAME_SET_LIGHTING__?.(lightOn);
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | Record<string, unknown>
      | undefined;
    const stepFn = (window as unknown as RafGateWindow).__STEP_RAF_FRAMES__;
    if (gs && stepFn) {
      const snap = {
        pauseModalOpen: gs['pauseModalOpen'],
        coopMode: gs['coopMode'],
        camFocusX: gs['camFocusX'],
        camFocusY: gs['camFocusY'],
        trailingHpRatio: gs['trailingHpRatio'],
        trailingArmorRatio: gs['trailingArmorRatio'],
        trailingBossHpRatio: gs['trailingBossHpRatio'],
      };
      gs['pauseModalOpen'] = true;
      gs['coopMode'] = 'solo';
      await stepFn(2);
      Object.assign(gs, snap);
    } else if (stepFn) {
      await stepFn(2);
    }
  }, enabled);
}

async function lockCameraAndIrisToPlayer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__?.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | Record<string, unknown>
      | undefined;
    if (sim && gs) {
      sim.player.prevX = sim.player.x;
      sim.player.prevY = sim.player.y;
      Object.assign(gs, {
        camFocusX: sim.player.x,
        camFocusY: sim.player.y,
        irisTransitionProgress: 0,
        irisTransitionDir: 0,
        primaryLanIp: '127.0.0.1',
        serverPort: 2567,
        hostInviteUrl: 'http://127.0.0.1:2567/?coop=join',
        lastInvitePanelHash: '',
      });
    }
  });
}

async function setupB1CombatState(page: Page, lowQuality = false): Promise<void> {
  await page.evaluate((isLow) => {
    if (isLow) window.__GAME_SET_QUALITY__?.('low');
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(combatRoom.id);
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    Object.assign(sim.player, { godMode: true, x: 340, y: 270, prevX: 340, prevY: 270, aimAngle: 0 });
    const spawned = [
      sim.spawnEnemy('goblin_shooter', 520, 210, true),
      sim.spawnEnemy('green_slime', 580, 250, true),
      sim.spawnEnemy('spore_bomber', 650, 215, true),
      sim.spawnEnemy('wild_boar', 540, 330, true),
      sim.spawnEnemy('goblin_shaman', 640, 340, true),
      sim.spawnEnemy('thorn_turret', 720, 275, true),
      sim.spawnEnemy('wild_boar', 600, 280, true, 'shield'),
    ];
    for (const e of spawned) e.hp = e.maxHp = 900;
  }, lowQuality);
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const ownerId = sim.enemies[0]?.id ?? 200;
    [-0.22, 0, 0.22].forEach((ang, idx) => {
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 81000 + idx, ownerId, isEnemy: true,
          x: 470 - idx * 24, y: 235 + idx * 28,
          vx: Math.cos(Math.PI + ang) * 180, vy: Math.sin(Math.PI + ang) * 180,
          radius: 5, damage: 2, colorHex: '#E84545', ttlSec: 2.5,
          pierceCount: 0, bounceCount: 0, homingStrength: 0, explosionRadius: 0,
          isCrit: false, element: 'none', knockback: 40,
        }),
      );
    });
  });
  await stepDeterministicFrames(page, 5);
}

async function setupB2CombatState(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(combatRoom.id);
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    Object.assign(sim.player, { godMode: true, x: 340, y: 270 });
    const spawned = [
      sim.spawnEnemy('frost_bat', 540, 210, true),
      sim.spawnEnemy('baby_yeti', 640, 240, true, 'giant'),
      sim.spawnEnemy('ice_mage', 720, 290, true),
      sim.spawnEnemy('ice_golem', 560, 350, true, 'shield'),
      sim.spawnEnemy('snow_spirit', 680, 370, true),
    ];
    for (const e of spawned) e.hp = e.maxHp = 900;
  });
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    for (let i = 0; i < 3; i++) {
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 82000 + i, ownerId: sim.enemies[0]?.id ?? 200, isEnemy: true,
          x: 470 - i * 22, y: 245 + i * 24, vx: -180, vy: (i - 1) * 35,
          radius: 5, damage: 2, colorHex: '#E84545', ttlSec: 2.5,
          pierceCount: 0, bounceCount: 0, homingStrength: 0, explosionRadius: 0,
          isCrit: false, element: 'chill', knockback: 40,
        }),
      );
    }
  });
  await stepDeterministicFrames(page, 5);
}

async function setupB3CombatState(page: Page, lowQuality = false): Promise<void> {
  await page.evaluate((isLow) => {
    if (isLow) window.__GAME_SET_QUALITY__?.('low');
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(combatRoom.id);
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    Object.assign(sim.player, { godMode: true, x: 340, y: 270 });
    const spawned = [
      sim.spawnEnemy('fire_imp', 510, 220, true),
      sim.spawnEnemy('dwarf_cannon', 630, 215, true),
      sim.spawnEnemy('coal_golem', 575, 325, true, 'explosive_death'),
      sim.spawnEnemy('welder_drone', 690, 285, true),
      sim.spawnEnemy('iron_shielder', 660, 375, true, 'shield'),
    ];
    for (const e of spawned) e.hp = e.maxHp = 900;
  }, lowQuality);
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const coords: readonly [number, number][] = [[265, 165], [445, 250], [485, 290], [530, 220]];
    coords.forEach(([bx, by], idx) => {
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 83000 + idx, ownerId: sim.enemies[0]?.id ?? 200, isEnemy: true,
          x: bx, y: by, vx: -165, vy: (idx - 1.5) * 25,
          radius: 5.5, damage: 3, colorHex: '#E84545', ttlSec: 2.5,
          pierceCount: 0, bounceCount: 0, homingStrength: 0, explosionRadius: 0,
          isCrit: false, element: 'burn', knockback: 40,
        }),
      );
    });
  });
  await stepDeterministicFrames(page, 5);
}

async function setupStartRoomScene(page: Page): Promise<void> {
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
  await stepDeterministicFrames(page, 45);
}

async function setupHubSoloScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.enterHub();
    sim.player.x = 340;
    sim.player.y = 270;
  });
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 45);
}

async function setupWeaponGroundDistanceScene(page: Page, distOffset: number): Promise<void> {
  await page.evaluate((offset) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.worldItems.length = 0;
    sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: 'dragon_breath_shotgun',
      rarity: 'epic',
      nameVi: 'Shotgun Hỏa Long',
      costGold: 0,
      healAmount: 0,
      x: 520,
      y: 270,
    });
    sim.player.godMode = true;
    sim.player.x = 520 - offset;
    sim.player.y = 270;
  }, distOffset);
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 45);
}

async function setupBossScene(
  page: Page,
  floor: number,
  phase: 1 | 2 | 3,
  withShockwave = false,
): Promise<void> {
  await page.evaluate(
    ({ targetFloor, targetPhase, addRing }) => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      sim.advanceToFloor(targetFloor);
      const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
      sim.enterRoom(bossRoom.id);
      sim.player.godMode = true;
      sim.player.x = 350;
      sim.player.y = 300;
      const boss = sim.getActiveBoss();
      if (boss) {
        boss.x = 650;
        boss.y = 300;
        boss.spawnWarmupTimer = 0;
        if (targetPhase >= 2) {
          sim.applyDamageToEnemy(boss, Math.ceil(boss.maxHp * 0.36), false, 'none', 0, 0);
        }
        if (targetPhase >= 3) {
          sim.applyDamageToEnemy(boss, Math.ceil(boss.maxHp * 0.36), false, 'none', 0, 0);
        }
        boss.aiState = 'move';
        boss.stateTimer = 0;
        if (addRing) {
          sim.shockwaveRings.push({
            id: 96001,
            sourceEnemyId: boss.id,
            x: boss.x,
            y: boss.y,
            radius: 90,
            maxRadius: 360,
            speed: 40,
            thickness: 22,
            damage: boss.damage,
            hitPlayerIds: [],
          });
        }
      }
    },
    { targetFloor: floor, targetPhase: phase, addRing: withShockwave },
  );
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 45);
}

async function setupRunResultModalScene(
  page: Page,
  state: 'victory' | 'defeat',
  english = false,
): Promise<void> {
  await page.evaluate((runResult) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;

    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'vanguard');
    p1.displayName = 'Thiết Vệ P1';
    p1.gold = 310;
    p1.statsDamageDealt = 940;
    p1.statsKills = 34;
    p1.statsRevives = 1;
    p1.statsDamageTaken = 18;
    p1.statsElementalReactions = 3;
    p1.statsTeamCombos = 2;

    const p2 = sim.addCoopPlayer(2, 'ranger', 'Liệp Ưng P2', 2);
    p2.statsDamageDealt = 2480;
    p2.statsKills = 22;
    p2.statsDamageTaken = 8;
    p2.statsElementalReactions = 4;
    p2.statsTeamCombos = 1;

    const p3 = sim.addCoopPlayer(3, 'elementalist', 'Lam Hỏa P3', 3);
    p3.statsDamageDealt = 1650;
    p3.statsKills = 14;
    p3.statsDamageTaken = 6;
    p3.statsElementalReactions = 14;
    p3.statsTeamCombos = 6;

    const p4 = sim.addCoopPlayer(4, 'druid', 'Mộc Linh P4', 4);
    p4.statsDamageDealt = 780;
    p4.statsKills = 8;
    p4.statsRevives = 4;
    p4.statsDamageTaken = 14;

    sim.runStats.kills = 78;
    sim.runStats.elitesKilled = 6;
    sim.runStats.damageDealt = 5850;
    sim.runStats.goldEarned = 420;
    sim.runStats.roomsCleared = 14;
    sim.runStats.ticksElapsed = 60 * 385;
    sim.runStats.elementalReactions = 21;
    sim.runStats.teamCombos = 9;
    sim.teamComboCount = 9;
    sim.currentBiome = 3;
    sim.currentFloor = 6;
    sim.activeBuffIds = ['bountiful_vitality', 'swift_wind'];
    sim.runState = runResult;
  }, state);
  await lockCameraAndIrisToPlayer(page);
  if (english) {
    await switchGameSceneToEnglish(page);
  }
  await stepDeterministicFrames(page, 45);
}

async function switchGameSceneToEnglish(page: Page): Promise<void> {
  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | { settingsModal?: { open: (k: 'settings') => void } }
      | undefined;
    if (window.__GAME_DEBUG__?.language !== 'en') {
      gs?.settingsModal?.open('settings');
    }
  });
  await stepDeterministicFrames(page, 2);
  const langNow = await page.evaluate(() => window.__GAME_DEBUG__?.language);
  if (langNow !== 'en') {
    await page.mouse.click(1290, 762);
    await stepDeterministicFrames(page, 2);
  }
  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          settingsModal?: { close: () => void };
          invalidateAllHudCaches?: () => void;
          rebuildPauseModal?: () => void;
          pauseModalOpen?: boolean;
        }
      | undefined;
    gs?.settingsModal?.close();
    gs?.invalidateAllHudCaches?.();
    if (gs?.pauseModalOpen) {
      gs.rebuildPauseModal?.();
    }
  });
  await page.mouse.move(960, 540);
}

function makeScene(
  id: string,
  description: string,
  url: string,
  expectedScene: 'MenuScene' | 'GameScene' | 'ArtGalleryScene',
  setup: (page: Page) => Promise<void>,
  opts?: Partial<
    Pick<
      VisualSceneDef,
      'viewport' | 'captureUnlit' | 'captureStrip' | 'grayscaleFrom' | 'sampleRects'
    >
  >,
): VisualSceneDef {
  return {
    id,
    description,
    url,
    expectedScene,
    freezeMaskRects: DEFAULT_FREEZE_MASK_RECTS,
    ...opts,
    setup,
  };
}

export const VISUAL_SCENES: readonly VisualSceneDef[] = [
  // 1. Menu
  makeScene('menu', 'Main menu campfire hub in Vietnamese', DEFAULT_MENU_URL, 'MenuScene', async (page) => {
    await stepDeterministicFrames(page, 45);
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
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
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
      sim.player.x = 280;
      sim.player.y = 270;
      sim.spawnChest(610, 175, 'epic', 'arc_lightning_rifle');
      sim.spawnWorldItem({ kind: 'weapon', weaponId: 'dragon_breath_shotgun', rarity: 'legendary', nameVi: 'Shotgun Hỏa Long', costGold: 0, healAmount: 0, x: 610, y: 255 });
      sim.spawnWorldItem({ kind: 'weapon', weaponId: 'frost_bow', rarity: 'rare', nameVi: 'Cung Băng Giá', costGold: 55, healAmount: 0, x: 610, y: 335, offerId: 1 });
      sim.npcEntities.push({ id: ++sim.nextEntityId, kind: 'shrine', nameVi: 'Điện Thờ Cổ Đại', dialogueVi: 'Hiến tế máu đổi lấy phước lành.', x: 710, y: 215, radius: 20, interacted: false, costHp: 2 });
      sim.portalActive = true;
      sim.portalX = 710;
      sim.portalY = 325;
    });
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 45);
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
  }),

  // 4. Biome 2 & 3
  makeScene('b2-start-room', 'Biome 2 Frozen Depths start room', BIOME2_GAME_URL, 'GameScene', setupStartRoomScene, {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b2-combat', 'Biome 2 Frozen Depths combat room', BIOME2_GAME_URL, 'GameScene', setupB2CombatState, {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b3-start-room', 'Biome 3 Molten Forge start room', BIOME3_GAME_URL, 'GameScene', setupStartRoomScene, {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('b3-combat', 'Biome 3 Molten Forge combat room with enemy bullets near braziers', BIOME3_GAME_URL, 'GameScene', (p) => setupB3CombatState(p, false), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
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
  }),

  // 5. Bosses
  makeScene('boss-b1', 'Biome 1 Boss Mục Vương Nấm Độc (Phase 1)', DEFAULT_GAME_URL, 'GameScene', (p) => setupBossScene(p, 2, 1)),
  makeScene('boss-b2', 'Biome 2 Boss Băng Hậu Kryssa (Phase 1)', BIOME2_GAME_URL, 'GameScene', (p) => setupBossScene(p, 4, 1)),
  makeScene('boss-b3', 'Biome 3 Boss Titan Lò Rèn (Phase 2 with Energy Cores & Shockwave)', BIOME3_GAME_URL, 'GameScene', (p) => setupBossScene(p, 6, 2, true)),
  makeScene('boss-b1-phase3', 'Biome 1 Boss Mục Vương Phase 3 with creeping poison border', DEFAULT_GAME_URL, 'GameScene', (p) => setupBossScene(p, 2, 3)),
  makeScene('boss-b2-blizzard', 'Biome 2 Boss Kryssa Phase 3 with Blizzard Veil', BIOME2_GAME_URL, 'GameScene', (p) => setupBossScene(p, 4, 3), {
    captureUnlit: true,
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
  }),
  makeScene('boss-b3-phase3', 'Biome 3 Boss Forge Titan Phase 3 with molten lava border', BIOME3_GAME_URL, 'GameScene', (p) => setupBossScene(p, 6, 3)),

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
  makeScene('b3-combat-low', 'Biome 3 combat at Low quality', BIOME3_GAME_URL, 'GameScene', (p) => setupB3CombatState(p, true)),
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
    await lockCameraAndIrisToPlayer(page);
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
    await stepDeterministicFrames(page, 45);
  }),
  makeScene('modal-victory-en', 'Run Victory Summary Modal in English locale', DEFAULT_GAME_URL, 'GameScene', (p) => setupRunResultModalScene(p, 'victory', true)),
];
