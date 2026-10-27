import type { Page } from '@playwright/test';
import type { EnemyTypeId, PropKind, RoomArchetypeId } from '@ashen-pact/shared';
import {
  DEFAULT_GAME_URL,
  ENVIRONMENT_SAMPLE_RECTS,
  lockCameraAndIrisToPlayer,
  makeScene,
  stepDeterministicFrames,
  type SampleRect,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const AP2_P1A_SCENE_IDS: readonly string[] = [
  'ap2-wep-crossbow-rip',
  'ap2-wep-thorn-pull',
  'ap2-wep-shotgun-wallslam',
  'ap2-wep-gale-vent',
  'ap2-wep-frag-airburst',
  'ap2-wep-seed-bloom',
  'ap2-wep-tether-pull',
] as const;

export const AP2_P1A_SCENE_GROUP = AP2_P1A_SCENE_IDS;

const TWIN_BRIDGES_SAMPLE_RECTS: readonly SampleRect[] = ENVIRONMENT_SAMPLE_RECTS.map((r) =>
  r.name === 'floor_center' ? { ...r, x: 512, y: 608 } : r,
);
const GAUNTLET_CHOKEPOINT_SAMPLE_RECTS: readonly SampleRect[] = ENVIRONMENT_SAMPLE_RECTS.map((r) =>
  r.name === 'floor_center' ? { ...r, x: 832, y: 664 } : r,
);

type GameSceneHookTarget = {
  pauseModalOpen?: boolean;
  reloadVentQueued?: boolean;
  syncProjectilesAndPickups?: () => void;
  [key: string]: unknown;
};

interface Ap2P1ArenaInitConfig {
  archetype?: RoomArchetypeId;
  roomSeed?: number;
  fourBraziers?: boolean;
  characterId?: 'vanguard' | 'ranger' | 'elementalist' | 'druid' | 'engineer';
  playerX: number;
  playerY: number;
  aimAngle?: number;
  playerPatch?: Record<string, unknown>;
  pillarBox?: readonly [number, number, number, number];
  props?: ReadonlyArray<readonly [PropKind, number, number, boolean?]>;
  enemies?: ReadonlyArray<readonly [EnemyTypeId, number, number, ('shield' | undefined)?]>;
  dummyEnemies?: boolean;
  rebuildDoors?: boolean;
}

async function initAp2P1Arena(
  page: Page,
  cfg: Ap2P1ArenaInitConfig,
  warmupFrames = 40,
): Promise<void> {
  await page.evaluate((c) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    room.type = 'combat';
    if (c.archetype) room.roomArchetype = c.archetype;
    if (c.rebuildDoors) room.connections = { N: 0, S: 0, E: 0, W: 0 };
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();
    for (const k of ['enemies', 'projectiles', 'pickups', 'chests', 'worldItems', 'magneticRivets', 'summons', 'tetherBeams'] as const) {
      sim[k].length = 0;
    }
    if (c.archetype && c.roomSeed !== undefined) {
      sim.map.configureRoomLayout({ roomSeed: c.roomSeed, archetype: c.archetype, biome: 1, activeDoorSides: ['N', 'S', 'E', 'W'] });
    }
    if (c.pillarBox) {
      const [x0, x1, y0, y1] = c.pillarBox;
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) sim.map.tiles[ty * sim.map.cols + tx] = 'pillar';
      sim.map.rebuildSolidBoxes();
      sim.map.mapRevision += 1;
    }
    sim.props.length = 0;
    const braziers = c.fourBraziers ? [[242, 148], [910, 148], [242, 556], [910, 556]] : [[242, 148], [910, 148]];
    for (const [bx, by] of braziers) sim.spawnProp('torch_brazier', bx!, by!);
    for (const [kind, px, py, flipped] of c.props ?? []) {
      const p = sim.spawnProp(kind, px, py);
      if (flipped) sim.flipCoverProp(p);
    }
    sim.consumeEvents();

    if (c.characterId) sim.selectCharacter(sim.player.id, c.characterId);
    Object.assign(sim.player, { godMode: true, x: c.playerX, y: c.playerY, prevX: c.playerX, prevY: c.playerY, vx: 0, vy: 0, aimAngle: c.aimAngle ?? 0, ...(c.playerPatch ?? {}) });
    for (const [typeId, ex, ey, eliteMod] of c.enemies ?? []) {
      Object.assign(sim.spawnEnemy(typeId, ex, ey, true, eliteMod), { hp: 900, maxHp: 900, isDummy: c.dummyEnemies ?? true, spawnWarmupTimer: 0, aiState: 'idle', stateTimer: 99, vx: 0, vy: 0 });
    }
    if (c.rebuildDoors) sim.rebuildCurrentRoomDoors();
  }, cfg);
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, warmupFrames);
}

/** 1. ap2-wep-crossbow-rip (8-frame strip + unlit) */
export async function setupAp2WepCrossbowRipScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    rebuildDoors: true,
    characterId: 'ranger',
    playerX: 340,
    playerY: 270,
    playerPatch: {
      weaponSlots: ['hunter_crossbow', 'rivet_gun'],
      activeWeaponSlot: 0,
      clipMax: 4,
      clipAmmo: 2,
      reloadDuration: 0.95,
      reloadTimer: 0,
      reloadLockout: false,
      crossbowChargeTimer: 0.45,
      fireHoldTimer: 0.45,
    },
    props: [
      ['moss_table', 6 * 32 + 16, 10 * 32 + 16],
      ['moss_table', 23 * 32 + 16, 10 * 32 + 16],
      ['volatile_spore_pod', 15 * 32 + 16, 6 * 32 + 16],
      ['rotten_totem_pillar', 6 * 32 + 16, 15 * 32 + 16],
      ['glow_mushroom', 5 * 32 + 16, 5 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 495, 224],
      ['wild_boar', 535, 270, 'shield'],
      ['goblin_shaman', 495, 316],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as GameSceneHookTarget | undefined;
    for (const e of sim.enemies) e.stuckArrows = 4;
    sim.tryFireActiveWeapon(sim.player);
    Object.assign(sim.player, { reloadDuration: 0.95, reloadTimer: 0.95 * 0.52, reloadLockout: false });
    sim.prevButtons = 0;
    if (gs) gs.reloadVentQueued = true;

    if (gs && !gs.__ap2CrossbowRipHook && gs.syncProjectilesAndPickups) {
      gs.__ap2CrossbowRipHook = true;
      let stepIdx = 0;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        if (!gs.pauseModalOpen) {
          stepIdx += 1;
          if (stepIdx === 1) {
            for (const e of sim.enemies) e.stuckArrows = 4;
            Object.assign(sim.player, { reloadDuration: 0.95, reloadTimer: 0.95 * 0.52, reloadLockout: false });
          } else if (stepIdx === 6) {
            Object.assign(sim.player, { reloadTimer: 0, clipAmmo: 2, fireCooldownTimer: 0, crossbowChargeTimer: 0.45, fireHoldTimer: 0.45 });
            sim.tryFireActiveWeapon(sim.player);
            Object.assign(sim.player, { reloadDuration: 0.95, reloadTimer: 0.95 * 0.52 });
            sim.prevButtons = 0;
            gs.reloadVentQueued = true;
          } else if (stepIdx === 7) {
            for (const e of sim.enemies) e.stuckArrows = 3;
          }
        }
        origSync();
      };
    }
  });
  await stepDeterministicFrames(page, 1);
}

/** 2. ap2-wep-thorn-pull (8-frame strip) */
export async function setupAp2WepThornPullScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'TWIN_BRIDGES',
    roomSeed: 1338,
    fourBraziers: true,
    rebuildDoors: true,
    characterId: 'druid',
    playerX: 444,
    playerY: 242,
    dummyEnemies: false,
    playerPatch: {
      aimAngle: Math.atan2(276 - 242, 658 - 444),
      weaponSlots: ['thorn_staff', 'seed_gun'],
      activeWeaponSlot: 0,
      clipMax: 5,
      clipAmmo: 1,
      reloadDuration: 1.0,
      reloadTimer: 0,
    },
    props: [
      ['moss_table', 11 * 32 + 16, 6 * 32 + 16],
      ['glow_mushroom', 5 * 32 + 16, 5 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 518, 246],
      ['wild_boar', 575, 250, 'shield'],
      ['goblin_shaman', 658, 276],
      ['spore_bomber', 545, 212],
    ],
  });
  await page.mouse.move(1160, 570);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as GameSceneHookTarget | undefined;
    for (const e of sim.enemies) e.parasiticThorns = 5;
    sim.tryFireActiveWeapon(sim.player);
    const whipProj = sim.projectiles[sim.projectiles.length - 1];
    if (whipProj) Object.assign(whipProj, { hitEntityIds: sim.enemies.map((e) => e.id), ttlSec: 0.005 });

    if (gs && !gs.__ap2ThornPullHook && gs.syncProjectilesAndPickups) {
      gs.__ap2ThornPullHook = true;
      let stepIdx = 0;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        if (!gs.pauseModalOpen) {
          stepIdx += 1;
          if (stepIdx === 1) {
            for (const e of sim.enemies) if (e.hp > 0) e.parasiticThorns = 5;
          } else if (stepIdx === 6) {
            Object.assign(sim.player, { reloadTimer: 0, clipAmmo: 1, fireCooldownTimer: 0 });
            sim.tryFireActiveWeapon(sim.player);
            sim.events.push({
              kind: 'thorn_bloom',
              playerId: sim.player.id,
              targetIds: sim.enemies.filter((e) => e.hp > 0).map((e) => e.id),
              totalThorns: 15,
              x: sim.player.x,
              y: sim.player.y,
            });
          }
        }
        origSync();
      };
    }
  });
  await stepDeterministicFrames(page, 1);
}

/** 3. ap2-wep-shotgun-wallslam (8-frame strip) */
export async function setupAp2WepShotgunWallslamScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    characterId: 'vanguard',
    playerX: 416,
    playerY: 270,
    dummyEnemies: false,
    pillarBox: [16, 17, 7, 9],
    playerPatch: {
      weaponSlots: ['scrap_shotgun', 'knight_sword'],
      activeWeaponSlot: 0,
      clipMax: 2,
      clipAmmo: 1,
      reloadDuration: 0.85,
      reloadTimer: 0,
      reloadLockout: false,
    },
    props: [
      ['moss_table', 356, 224, true],
      ['rotten_totem_pillar', 585, 210],
    ],
    enemies: [
      ['wild_boar', 494, 250],
      ['goblin_shooter', 495, 272],
      ['goblin_shaman', 484, 296],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as GameSceneHookTarget | undefined;
    sim.tryFireActiveWeapon(sim.player);
    const [e1, e2] = sim.enemies;
    if (e1) Object.assign(e1, { x: 496, kbVx: 380, kbVy: 0, lastHitDmg: 28, lastHitPlayerId: sim.player.id });
    if (e2) Object.assign(e2, { x: 496, kbVx: 360, kbVy: 0, lastHitDmg: 28, lastHitPlayerId: sim.player.id });
    Object.assign(sim.player, { reloadDuration: 0.85, reloadTimer: 0.85 * 0.52, reloadLockout: false });
    sim.prevButtons = 0;
    if (gs) gs.reloadVentQueued = true;

    if (gs && !gs.__ap2ShotgunWallslamHook && gs.syncProjectilesAndPickups) {
      gs.__ap2ShotgunWallslamHook = true;
      let stepIdx = 0;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        if (!gs.pauseModalOpen) {
          stepIdx += 1;
          if (stepIdx === 1) {
            Object.assign(sim.player, { reloadDuration: 0.85, reloadTimer: 0.85 * 0.52, reloadLockout: false });
          } else if (stepIdx === 6) {
            Object.assign(sim.player, { reloadTimer: 0, clipAmmo: 1, fireCooldownTimer: 0, overclockedNextShot: true });
            sim.tryFireActiveWeapon(sim.player);
            Object.assign(sim.player, { reloadDuration: 0.85, reloadTimer: 0.85 * 0.52 });
            sim.prevButtons = 0;
            gs.reloadVentQueued = true;
          }
        }
        origSync();
      };
    }
  });
  await stepDeterministicFrames(page, 1);
}

/** 4. ap2-wep-gale-vent (8-frame strip) */
export async function setupAp2WepGaleVentScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    characterId: 'ranger',
    playerX: 356,
    playerY: 270,
    dummyEnemies: false,
    playerPatch: {
      weaponSlots: ['gale_smg', 'rivet_gun'],
      activeWeaponSlot: 0,
      weaponHeat: 78,
      weaponSlotHeat: [78, 0],
      overheatLockTimer: 0,
      fireHoldTimer: 1.2,
      galeOrangeShotCounter: 5,
    },
    props: [
      ['moss_table', 310, 224, true],
      ['volatile_spore_pod', 560, 215],
    ],
    enemies: [
      ['goblin_shooter', 436, 268],
      ['wild_boar', 432, 270, 'shield'],
      ['goblin_shaman', 515, 270],
      ['spore_bomber', 424, 305],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as GameSceneHookTarget | undefined;
    const ownerId = sim.enemies[0]?.id ?? 200;
    for (const [id, x, y] of [
      [99101, 396, 250],
      [99102, 408, 266],
      [99103, 396, 286],
      [99104, 422, 258],
      [99105, 472, 254],
      [99106, 488, 270],
      [99107, 472, 286],
      [99108, 512, 262],
    ] as const) {
      sim.projectiles.push(
        sim.acquireProjectile({
          id, ownerId, isEnemy: true, x, y, vx: -195, vy: 0, radius: 5.5, damage: 2, colorHex: '#E84545',
          ttlSec: 2.0, pierceCount: 0, bounceCount: 0, homingStrength: 0, explosionRadius: 0, isCrit: false, element: 'none', knockback: 40,
        }),
      );
    }
    sim.tryFireActiveWeapon(sim.player);
    const e1 = sim.enemies[0];
    if (e1) Object.assign(e1, { x: 440, y: 268, kbVx: 0, kbVy: -380, lastHitDmg: 24, lastHitPlayerId: sim.player.id });
    Object.assign(sim.player, { weaponHeat: 78, weaponSlotHeat: [78, 0] });
    sim.prevButtons = 0;
    if (gs) gs.reloadVentQueued = true;

    if (gs && !gs.__ap2GaleVentHook && gs.syncProjectilesAndPickups) {
      gs.__ap2GaleVentHook = true;
      let stepIdx = 0;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        if (!gs.pauseModalOpen) {
          stepIdx += 1;
          Object.assign(sim.player, { fireHoldTimer: 1.2, weaponHeat: 78, weaponSlotHeat: [78, 0] });
          if (stepIdx === 5) {
            Object.assign(sim.player, { fireCooldownTimer: 0, galeOrangeShotCounter: 5 });
            sim.tryFireActiveWeapon(sim.player);
          } else if (stepIdx === 8) {
            sim.player.ventCooldownTimer = 0;
            sim.prevButtons = 0;
            gs.reloadVentQueued = true;
          }
        }
        origSync();
      };
    }
  });
  await stepDeterministicFrames(page, 1);
}

/** 5. ap2-wep-frag-airburst (8-frame strip) */
export async function setupAp2WepFragAirburstScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'CENTRAL_BASTION',
    roomSeed: 1340,
    fourBraziers: true,
    characterId: 'engineer',
    playerX: 330,
    playerY: 270,
    dummyEnemies: false,
    playerPatch: {
      weaponSlots: ['frag_launcher', 'rivet_gun'],
      activeWeaponSlot: 0,
      clipMax: 3,
      clipAmmo: 3,
      reloadDuration: 1.1,
      reloadTimer: 0,
    },
    props: [
      ['moss_table', 392, 218, true],
      ['moss_table', 392, 322, true],
    ],
    enemies: [
      ['iron_shielder', 492, 270],
      ['iron_shielder', 522, 226],
      ['goblin_shaman', 542, 304],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as GameSceneHookTarget | undefined;
    for (const e of sim.enemies) e.aimAngle = Math.PI;
    sim.tryFireActiveWeapon(sim.player);
    const g1 = sim.projectiles[sim.projectiles.length - 1];
    if (g1) Object.assign(g1, { x: 504, y: 268, prevX: 492, prevY: 268, armedForAirburst: true });
    sim.player.fireCooldownTimer = 0;
    sim.tryFireActiveWeapon(sim.player);
    const g2 = sim.projectiles[sim.projectiles.length - 1];
    if (g2 && g2.weaponId === 'frag_launcher') {
      Object.assign(g2, { x: 418, y: 244, prevX: 410, prevY: 246, armedForAirburst: false });
    }

    if (gs && !gs.__ap2FragAirburstHook && gs.syncProjectilesAndPickups) {
      gs.__ap2FragAirburstHook = true;
      let stepIdx = 0;
      const origStep = sim.step.bind(sim);
      sim.step = (dtOrCmd?: Parameters<typeof sim.step>[0]) => {
        if (stepIdx >= 1 && stepIdx < 6) {
          for (const b of sim.projectiles) if (b.weaponId === 'frag_launcher') b.armedForAirburst = false;
        }
        origStep(dtOrCmd);
      };
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        if (!gs.pauseModalOpen) {
          stepIdx += 1;
          for (const b of sim.projectiles) {
            if (b.weaponId === 'frag_launcher' && b.ttlSec > 0) b.armedForAirburst = true;
          }
        }
        origSync();
      };
    }
  });
  await stepDeterministicFrames(page, 1);
}

/** 6. ap2-wep-seed-bloom (8-frame strip + unlit) */
export async function setupAp2WepSeedBloomScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'TWIN_BRIDGES',
    roomSeed: 1338,
    fourBraziers: true,
    rebuildDoors: true,
    characterId: 'druid',
    playerX: 350,
    playerY: 268,
    dummyEnemies: false,
    playerPatch: {
      hp: 5,
      maxHp: 6,
      armor: 2,
      maxArmor: 5,
      weaponSlots: ['seed_gun', 'thorn_staff'],
      activeWeaponSlot: 0,
      clipMax: 4,
      clipAmmo: 1,
      reloadDuration: 1.0,
      reloadTimer: 0,
    },
    props: [
      ['moss_table', 11 * 32 + 16, 6 * 32 + 16],
      ['glow_mushroom', 5 * 32 + 16, 5 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 468, 224],
      ['wild_boar', 506, 268, 'shield'],
      ['spore_bomber', 468, 312],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as GameSceneHookTarget | undefined;
    const budCoords: ReadonlyArray<readonly [number, number]> = [
      [446, 222],
      [512, 232],
      [512, 304],
      [446, 314],
    ];
    for (const [bx, by] of budCoords) sim.spawnSeedGunLifeBlossom(sim.player.id, bx, by);
    sim.tryFireActiveWeapon(sim.player);
    Object.assign(sim.player, { reloadDuration: 1.0, reloadTimer: 1.0 * 0.52, reloadLockout: false });
    sim.prevButtons = 0;
    if (gs) gs.reloadVentQueued = true;

    if (gs && !gs.__ap2SeedBloomHook && gs.syncProjectilesAndPickups) {
      gs.__ap2SeedBloomHook = true;
      let stepIdx = 0;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        if (!gs.pauseModalOpen) {
          stepIdx += 1;
          if (stepIdx === 1 || stepIdx === 7) {
            for (const [bx, by] of budCoords) sim.spawnSeedGunLifeBlossom(sim.player.id, bx, by);
            if (stepIdx === 1) Object.assign(sim.player, { reloadDuration: 1.0, reloadTimer: 1.0 * 0.52 });
          } else if (stepIdx === 6) {
            Object.assign(sim.player, { reloadDuration: 1.0, reloadTimer: 1.0 * 0.52, reloadLockout: false });
            sim.prevButtons = 0;
            gs.reloadVentQueued = true;
          }
        }
        origSync();
      };
    }
  });
  await stepDeterministicFrames(page, 1);
}

/** 7. ap2-wep-tether-pull (8-frame strip) */
export async function setupAp2WepTetherPullScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'CENTRAL_BASTION',
    roomSeed: 1340,
    fourBraziers: true,
    characterId: 'elementalist',
    playerX: 330,
    playerY: 270,
    dummyEnemies: false,
    playerPatch: {
      weaponSlots: ['tether_staff', 'rivet_gun'],
      activeWeaponSlot: 0,
      weaponHeat: 82,
      weaponSlotHeat: [82, 0],
      overheatLockTimer: 0,
    },
    props: [
      ['moss_table', 542, 270, true],
      ['moss_table', 12 * 32 + 16, 6 * 32 + 16],
      ['rotten_totem_pillar', 25 * 32 + 16, 6 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 435, 248],
      ['wild_boar', 475, 270, 'shield'],
      ['goblin_shaman', 445, 294],
      ['spore_bomber', 512, 248],
    ],
  });
  await page.evaluate(() => window.__GAME_TRANSPORT__!.getSim().tryFireActiveWeapon(window.__GAME_TRANSPORT__!.getSim().player));
  await stepDeterministicFrames(page, 1);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as GameSceneHookTarget | undefined;
    Object.assign(sim.player, { weaponHeat: 82, weaponSlotHeat: [82, 0] });
    sim.prevButtons = 0;
    if (gs) gs.reloadVentQueued = true;

    if (gs && !gs.__ap2TetherPullHook && gs.syncProjectilesAndPickups) {
      gs.__ap2TetherPullHook = true;
      let stepIdx = 0;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        if (!gs.pauseModalOpen) {
          stepIdx += 1;
          Object.assign(sim.player, { weaponHeat: 78, weaponSlotHeat: [78, 0] });
          if (stepIdx === 1) {
            sim.player.fireCooldownTimer = 0;
            sim.tryFireActiveWeapon(sim.player);
            const [e1, e2, e3, e4] = sim.enemies;
            if (e1) Object.assign(e1, { x: 454, y: 252, kbVx: 90, kbVy: 18 });
            if (e2) Object.assign(e2, { x: 492, y: 270, kbVx: 75, kbVy: 0 });
            if (e3) Object.assign(e3, { x: 462, y: 288, kbVx: 85, kbVy: -18 });
            if (e4) Object.assign(e4, { x: 514, y: 252, kbVx: 45, kbVy: 15 });
          } else if (stepIdx === 6) {
            sim.player.ventCooldownTimer = 0;
            sim.prevButtons = 0;
            gs.reloadVentQueued = true;
          } else if (stepIdx === 7) {
            sim.player.fireCooldownTimer = 0;
            sim.tryFireActiveWeapon(sim.player);
          }
        }
        origSync();
      };
    }
  });
  await stepDeterministicFrames(page, 1);
}

const ap2Scene = (
  id: string,
  desc: string,
  setup: (page: Page) => Promise<void>,
  opts?: Partial<VisualSceneDef>,
): VisualSceneDef =>
  makeScene(id, desc, DEFAULT_GAME_URL, 'GameScene', setup, {
    captureStrip: true,
    stripFramesPerStep: 2,
    ...opts,
  });

export const AP2_P1A_VISUAL_SCENES: readonly VisualSceneDef[] = [
  ap2Scene('ap2-wep-crossbow-rip', 'Hunter crossbow Barbed Rip', setupAp2WepCrossbowRipScene, {
    includeUnlit: true,
    sampleRects: GAUNTLET_CHOKEPOINT_SAMPLE_RECTS,
  }),
  ap2Scene('ap2-wep-thorn-pull', 'Thorn staff whip chasm pull & bloom', setupAp2WepThornPullScene),
  ap2Scene('ap2-wep-shotgun-wallslam', 'Scrap shotgun Wall-Slam & hot shells', setupAp2WepShotgunWallslamScene),
  ap2Scene('ap2-wep-gale-vent', 'Gale SMG wind blade & Cyclone Vent', setupAp2WepGaleVentScene),
  ap2Scene('ap2-wep-frag-airburst', 'Frag launcher hold-release Airburst', setupAp2WepFragAirburstScene),
  ap2Scene('ap2-wep-seed-bloom', 'Seed gun Life Buds & Harvest Bloom', setupAp2WepSeedBloomScene, {
    includeUnlit: true,
    sampleRects: TWIN_BRIDGES_SAMPLE_RECTS,
  }),
  ap2Scene('ap2-wep-tether-pull', 'Tether staff beam & EM Yank Nova', setupAp2WepTetherPullScene),
];
