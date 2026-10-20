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
  stripFramesPerStep?: number;
  grayscaleFrom?: string;
  sampleRects?: SampleRect[];
  freezeMaskRects?: SampleRect[];
  setup: (page: Page) => Promise<void>;
}

interface RafGateWindow {
  __STEP_RAF_FRAMES__?: (count: number) => Promise<void>;
}

export const DEFAULT_GAME_URL = '/?scene=game&seed=1337&freeze=1&debug=0&testHooks=1';
export const DEFAULT_HUB_URL = '/?scene=game&hub=1&seed=1337&freeze=1&debug=0&testHooks=1';
export const DEFAULT_MENU_URL = '/?scene=menu&seed=1337&freeze=1&debug=0&testHooks=1';
export const DEFAULT_GALLERY_URL = '/?scene=gallery&seed=1337&freeze=1&debug=0&testHooks=1';
export const BIOME2_GAME_URL = '/?scene=game&biome=2&seed=1337&freeze=1&debug=0&testHooks=1';
export const BIOME3_GAME_URL = '/?scene=game&biome=3&seed=1337&freeze=1&debug=0&testHooks=1';
export const DEBUG_MENU_URL = '/?scene=menu&seed=1337&freeze=1&debug=1&testHooks=1';
export const DEBUG_GAME_URL = '/?scene=game&seed=1337&freeze=1&debug=1&testHooks=1';

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

export async function lockCameraAndIrisToPlayer(page: Page): Promise<void> {
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

export async function setupB1CombatState(page: Page, lowQuality = false): Promise<void> {
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

export async function setupB2CombatState(page: Page): Promise<void> {
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

export async function setupB3CombatState(page: Page, lowQuality = false): Promise<void> {
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

export async function setupStartRoomScene(page: Page): Promise<void> {
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

export async function setupHubSoloScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.enterHub();
    sim.player.x = 340;
    sim.player.y = 270;
  });
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 45);
}

export async function setupWeaponGroundDistanceScene(
  page: Page,
  distOffset: number,
): Promise<void> {
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

export async function setupBossScene(
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

export async function setupRunResultModalScene(
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

export async function switchGameSceneToEnglish(page: Page): Promise<void> {
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

export function makeScene(
  id: string,
  description: string,
  url: string,
  expectedScene: 'MenuScene' | 'GameScene' | 'ArtGalleryScene',
  setup: (page: Page) => Promise<void>,
  opts?: Partial<
    Pick<
      VisualSceneDef,
      | 'viewport'
      | 'captureUnlit'
      | 'captureStrip'
      | 'stripFramesPerStep'
      | 'grayscaleFrom'
      | 'sampleRects'
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
