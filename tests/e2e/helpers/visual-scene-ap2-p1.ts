import type { Page } from '@playwright/test';
import type { EnemyTypeId, PropKind, RoomArchetypeId } from '@ashen-pact/shared';
import {
  DEFAULT_GAME_URL,
  ENVIRONMENT_SAMPLE_RECTS,
  lockCameraAndIrisToPlayer,
  makeScene,
  markPostWarmupStart,
  stepDeterministicFrames,
  triggerFireWeapon,
  triggerReloadVent,
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
    for (const k of [
      'enemies',
      'projectiles',
      'pickups',
      'chests',
      'worldItems',
      'magneticRivets',
      'summons',
      'tetherBeams',
    ] as const) {
      sim[k].length = 0;
    }
    if (c.archetype && c.roomSeed !== undefined) {
      sim.map.configureRoomLayout({
        roomSeed: c.roomSeed,
        archetype: c.archetype,
        biome: 1,
        activeDoorSides: ['N', 'S', 'E', 'W'],
      });
    }
    if (c.pillarBox) {
      const [x0, x1, y0, y1] = c.pillarBox;
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          sim.map.tiles[ty * sim.map.cols + tx] = 'pillar';
        }
      }
      sim.map.rebuildSolidBoxes();
      sim.map.mapRevision += 1;
    }
    sim.props.length = 0;
    const braziers = c.fourBraziers
      ? [
          [242, 148],
          [910, 148],
          [242, 556],
          [910, 556],
        ]
      : [
          [242, 148],
          [910, 148],
        ];
    for (const [bx, by] of braziers) sim.spawnProp('torch_brazier', bx!, by!);
    for (const [kind, px, py, flipped] of c.props ?? []) {
      const p = sim.spawnProp(kind, px, py);
      if (flipped) sim.flipCoverProp(p);
    }
    sim.consumeEvents();

    if (c.characterId) sim.selectCharacter(sim.player.id, c.characterId);
    Object.assign(sim.player, {
      godMode: true,
      x: c.playerX,
      y: c.playerY,
      prevX: c.playerX,
      prevY: c.playerY,
      vx: 0,
      vy: 0,
      aimAngle: c.aimAngle ?? 0,
      ...(c.playerPatch ?? {}),
    });
    for (const [typeId, ex, ey, eliteMod] of c.enemies ?? []) {
      Object.assign(sim.spawnEnemy(typeId, ex, ey, true, eliteMod), {
        hp: 900,
        maxHp: 900,
        isDummy: c.dummyEnemies ?? true,
        spawnWarmupTimer: 0,
        aiState: 'idle',
        stateTimer: 99,
        vx: 0,
        vy: 0,
      });
    }
    if (c.rebuildDoors) sim.rebuildCurrentRoomDoors();
  }, cfg);
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, warmupFrames);
  await markPostWarmupStart(page);
}

/** 1. ap2-wep-crossbow-rip (8-frame strip + unlit) */
export async function setupAp2WepCrossbowRipScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    rebuildDoors: true,
    characterId: 'ranger',
    playerX: 356,
    playerY: 270,
    aimAngle: 0,
    props: [
      ['moss_table', 6 * 32 + 16, 10 * 32 + 16],
      ['moss_table', 23 * 32 + 16, 10 * 32 + 16],
      ['volatile_spore_pod', 15 * 32 + 16, 6 * 32 + 16],
      ['rotten_totem_pillar', 6 * 32 + 16, 15 * 32 + 16],
      ['glow_mushroom', 5 * 32 + 16, 5 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 450, 236],
      ['wild_boar', 478, 270, 'shield'],
      ['goblin_shaman', 450, 304],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      weaponSlots: ['hunter_crossbow', 'rivet_gun'],
      activeWeaponSlot: 0,
      clipMax: 4,
      clipAmmo: 1,
      reloadDuration: 0.5,
      reloadTimer: 0,
      reloadLockout: false,
      fireCooldownTimer: 0,
    });
    for (const e of sim.enemies) {
      e.stuckArrows = 4;
    }
  });
  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

/** 2. ap2-wep-thorn-pull (8-frame strip) */
export async function setupAp2WepThornPullScene(page: Page): Promise<void> {
  const aimAngle = Math.atan2(252 - 266, 596 - 452);
  await initAp2P1Arena(page, {
    archetype: 'TWIN_BRIDGES',
    roomSeed: 1338,
    fourBraziers: true,
    rebuildDoors: true,
    characterId: 'druid',
    playerX: 452,
    playerY: 266,
    aimAngle,
    props: [
      ['moss_table', 11 * 32 + 16, 6 * 32 + 16],
      ['glow_mushroom', 5 * 32 + 16, 5 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 506, 250],
      ['wild_boar', 548, 252, 'shield'],
      ['goblin_shaman', 596, 252],
    ],
  });
  await page.evaluate((ang) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      aimAngle: ang,
      weaponSlots: ['thorn_staff', 'seed_gun'],
      activeWeaponSlot: 0,
      clipMax: 5,
      clipAmmo: 1,
      reloadDuration: 0.7,
      reloadTimer: 0,
      fireCooldownTimer: 0,
    });
    for (const e of sim.enemies) {
      Object.assign(e, {
        isDummy: false,
        moveSpeed: 0,
        attackCooldownTimer: 99,
        aiState: 'stunned',
        stateTimer: 5.0,
        stunTimer: 5.0,
        vx: 0,
        vy: 0,
        parasiticThorns: 4,
      });
    }
  }, aimAngle);
  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
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
    aimAngle: 0,
    pillarBox: [16, 17, 7, 9],
    props: [['moss_table', 368, 232, true]],
    enemies: [
      ['wild_boar', 476, 252],
      ['goblin_shooter', 478, 272],
      ['goblin_shaman', 474, 292],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      weaponSlots: ['scrap_shotgun', 'knight_sword'],
      activeWeaponSlot: 0,
      clipMax: 2,
      clipAmmo: 1,
      reloadDuration: 0.45,
      reloadTimer: 0,
      reloadLockout: false,
      fireCooldownTimer: 0,
    });
    for (const e of sim.enemies) {
      Object.assign(e, {
        isDummy: false,
        moveSpeed: 0,
        attackCooldownTimer: 99,
        aiState: 'stunned',
        stateTimer: 5.0,
        stunTimer: 5.0,
        vx: 0,
        vy: 0,
      });
    }
  });
  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

/** 4. ap2-wep-gale-vent (8-frame strip) */
export async function setupAp2WepGaleVentScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    characterId: 'ranger',
    playerX: 356,
    playerY: 268,
    aimAngle: 0,
    props: [['moss_table', 312, 232, true]],
    enemies: [
      ['goblin_shooter', 356, 244],
      ['wild_boar', 418, 268, 'shield'],
      ['goblin_shaman', 444, 268],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const ownerId = sim.enemies[0]?.id ?? 200;
    for (const [id, x, y] of [
      [99101, 412, 250],
      [99102, 420, 268],
      [99103, 412, 286],
      [99104, 434, 258],
      [99105, 434, 278],
    ] as const) {
      sim.projectiles.push(
        sim.acquireProjectile({
          id,
          ownerId,
          team: 'enemy',
          isEnemy: true,
          x,
          y,
          vx: -150,
          vy: 0,
          radius: 5.5,
          damage: 2,
          colorHex: '#E84545',
          ttlSec: 2.0,
          pierceCount: 0,
          bounceCount: 0,
          homingStrength: 0,
          explosionRadius: 0,
          isCrit: false,
          element: 'none',
          knockback: 40,
        }),
      );
    }
    for (const e of sim.enemies) {
      Object.assign(e, {
        isDummy: false,
        moveSpeed: 0,
        attackCooldownTimer: 99,
        aiState: 'stunned',
        stateTimer: 5.0,
        stunTimer: 5.0,
        vx: 0,
        vy: 0,
      });
    }
  });
  await stepDeterministicFrames(page, 1);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      weaponSlots: ['gale_smg', 'rivet_gun'],
      activeWeaponSlot: 0,
      weaponHeat: 76,
      weaponSlotHeat: [76, 0],
      overheatLockTimer: 0,
      ventCooldownTimer: 0,
      fireCooldownTimer: 0,
      fireHoldTimer: 1.2,
      galeOrangeShotCounter: 5,
    });
  });
  await markPostWarmupStart(page);
}

/** 5. ap2-wep-frag-airburst (8-frame strip) */
export async function setupAp2WepFragAirburstScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'CENTRAL_BASTION',
    roomSeed: 1340,
    fourBraziers: true,
    characterId: 'engineer',
    playerX: 350,
    playerY: 270,
    aimAngle: 0,
    props: [['moss_table', 392, 224, true]],
    enemies: [
      ['iron_shielder', 452, 250],
      ['iron_shielder', 452, 290],
      ['goblin_shaman', 482, 270],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      weaponSlots: ['frag_launcher', 'rivet_gun'],
      activeWeaponSlot: 0,
      clipMax: 3,
      clipAmmo: 3,
      reloadDuration: 1.1,
      reloadTimer: 0,
      fireCooldownTimer: 0,
    });
    for (const e of sim.enemies) {
      e.aimAngle = Math.PI;
    }
  });
  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

/** 6. ap2-wep-seed-bloom (8-frame strip + unlit) */
export async function setupAp2WepSeedBloomScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'TWIN_BRIDGES',
    roomSeed: 1338,
    fourBraziers: true,
    rebuildDoors: true,
    characterId: 'druid',
    playerX: 356,
    playerY: 268,
    aimAngle: 0,
    props: [
      ['moss_table', 11 * 32 + 16, 6 * 32 + 16],
      ['glow_mushroom', 5 * 32 + 16, 5 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 452, 236],
      ['wild_boar', 466, 268, 'shield'],
      ['spore_bomber', 452, 300],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      hp: 5,
      maxHp: 6,
      armor: 2,
      maxArmor: 5,
      weaponSlots: ['seed_gun', 'thorn_staff'],
      activeWeaponSlot: 0,
      clipMax: 4,
      clipAmmo: 1,
      reloadDuration: 0.5,
      reloadTimer: 0,
      reloadLockout: false,
      fireCooldownTimer: 0,
    });
    const budCoords: ReadonlyArray<readonly [number, number]> = [
      [438, 234],
      [486, 242],
      [438, 302],
    ];
    for (const [bx, by] of budCoords) {
      sim.spawnSeedGunLifeBlossom(sim.player.id, bx, by);
    }
  });
  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

/** 7. ap2-wep-tether-pull (8-frame strip) */
export async function setupAp2WepTetherPullScene(page: Page): Promise<void> {
  await initAp2P1Arena(page, {
    archetype: 'CENTRAL_BASTION',
    roomSeed: 1340,
    fourBraziers: true,
    characterId: 'elementalist',
    playerX: 316,
    playerY: 224,
    aimAngle: 0,
    props: [['moss_table', 456, 224, true]],
    enemies: [
      ['goblin_shooter', 412, 208],
      ['wild_boar', 418, 224, 'shield'],
      ['goblin_shaman', 412, 240],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      weaponSlots: ['tether_staff', 'rivet_gun'],
      activeWeaponSlot: 0,
      weaponHeat: 66,
      weaponSlotHeat: [66, 0],
      overheatLockTimer: 0,
      ventCooldownTimer: 0,
      fireCooldownTimer: 0,
    });
    for (const e of sim.enemies) {
      Object.assign(e, {
        isDummy: false,
        moveSpeed: 0,
        attackCooldownTimer: 99,
        aiState: 'stunned',
        stateTimer: 5.0,
        stunTimer: 5.0,
        vx: 0,
        vy: 0,
      });
    }
  });
  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

const ap2Scene = (
  id: string,
  desc: string,
  setup: (page: Page) => Promise<void>,
  opts?: Partial<VisualSceneDef>,
): VisualSceneDef =>
  makeScene(id, desc, DEFAULT_GAME_URL, 'GameScene', setup, {
    captureStrip: true,
    frameCount: 8,
    heroFrameIndex: 4,
    ...opts,
  });

export const AP2_P1A_VISUAL_SCENES: readonly VisualSceneDef[] = [
  ap2Scene('ap2-wep-crossbow-rip', 'Hunter crossbow Barbed Rip', setupAp2WepCrossbowRipScene, {
    includeUnlit: true,
    sampleRects: GAUNTLET_CHOKEPOINT_SAMPLE_RECTS,
    apexEvent: { simEventKind: 'crossbow_rip' },
    actionRoi: {
      mode: 'auto_bounds',
      includeProjectiles: 'none',
      propKinds: [],
    },
    stripSchedule: [
      { stepCount: 0, stage: 'windup_hold', label: 'STUCK ARROWS X4' },
      {
        stepCount: 2,
        stage: 'trigger',
        label: 'FIRE FINALE',
        beforeStep: (page) => triggerFireWeapon(page, 0, 1),
      },
      { stepCount: 3, stage: 'active', label: 'BOLT FLIGHT 1' },
      { stepCount: 3, stage: 'active', label: 'BOLT FLIGHT 2' },
      { stepCount: 2, stage: 'apex', label: 'BARBED RIP!' },
      { stepCount: 3, stage: 'sub_impact', label: 'CHILL SLOW' },
      { stepCount: 4, stage: 'settled', label: 'GOLDEN WINDOW' },
      { stepCount: 4, stage: 'settled', label: 'SETTLED' },
    ],
  }),
  ap2Scene('ap2-wep-thorn-pull', 'Thorn staff whip chasm pull & bloom', setupAp2WepThornPullScene, {
    apexEvent: { simEventKind: 'thorn_bloom' },
    actionRoi: {
      mode: 'auto_bounds',
      includeProjectiles: 'none',
      propKinds: [],
    },
    stripSchedule: [
      { stepCount: 0, stage: 'windup_hold', label: 'THORNS STACKED' },
      {
        stepCount: 2,
        stage: 'trigger',
        label: 'WHIP FINALE',
        beforeStep: (page) =>
          triggerFireWeapon(page, Math.atan2(252 - 266, 596 - 452), 1),
      },
      { stepCount: 4, stage: 'active', label: 'VINE LASH 1' },
      { stepCount: 4, stage: 'active', label: 'VINE LASH 2' },
      { stepCount: 3, stage: 'apex', label: 'PULL & BLOOM!' },
      { stepCount: 3, stage: 'sub_impact', label: 'RING-OUT!' },
      { stepCount: 4, stage: 'settled', label: 'POISON DOT' },
      { stepCount: 4, stage: 'settled', label: 'SETTLED' },
    ],
  }),
  ap2Scene(
    'ap2-wep-shotgun-wallslam',
    'Scrap shotgun Wall-Slam & hot shells',
    setupAp2WepShotgunWallslamScene,
    {
      apexEvent: { simEventKind: 'wall_slam' },
      actionRoi: {
        mode: 'auto_bounds',
        includeProjectiles: 'none',
        propKinds: ['moss_table'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'POINT BLANK' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'BLAST PELLETS',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 2, stage: 'active', label: 'HEAVY KNOCKBACK' },
        { stepCount: 2, stage: 'active', label: 'FLY TO WALL' },
        { stepCount: 1, stage: 'apex', label: 'WALL SLAM!' },
        { stepCount: 4, stage: 'sub_impact', label: 'RELOAD GOLD' },
        { stepCount: 4, stage: 'settled', label: 'STUNNED TARGETS' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  ap2Scene('ap2-wep-gale-vent', 'Gale SMG wind blade & Cyclone Vent', setupAp2WepGaleVentScene, {
    apexEvent: { simEventKind: 'tactical_vent' },
    actionRoi: {
      mode: 'auto_bounds',
      includeProjectiles: 'none',
      propKinds: ['moss_table'],
    },
    stripSchedule: [
      { stepCount: 0, stage: 'windup_hold', label: 'ORANGE 76%' },
      {
        stepCount: 2,
        stage: 'trigger',
        label: 'WIND BLADE!',
        beforeStep: (page) => triggerFireWeapon(page, 0, 1),
      },
      { stepCount: 3, stage: 'active', label: 'BLADE PIERCE' },
      { stepCount: 3, stage: 'active', label: 'BULLETS IN' },
      {
        stepCount: 2,
        stage: 'apex',
        label: 'CYCLONE [R]!',
        beforeStep: (page) => triggerReloadVent(page),
      },
      { stepCount: 3, stage: 'sub_impact', label: 'WALL SLAM!' },
      { stepCount: 4, stage: 'settled', label: 'SHOCKWAVE' },
      { stepCount: 4, stage: 'settled', label: 'SETTLED' },
    ],
  }),
  ap2Scene(
    'ap2-wep-frag-airburst',
    'Frag launcher hold-release Airburst',
    setupAp2WepFragAirburstScene,
    {
      apexEvent: {
        simEventKind: 'explosion',
        simEventPredicate: (ev) => ev['sourceDefId'] === 'frag_launcher',
      },
      actionRoi: {
        mode: 'auto_bounds',
        includeProjectiles: 'none',
        propKinds: ['moss_table'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'AIM SHIELDERS' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'HOLD FIRE',
          beforeStep: (page) => triggerFireWeapon(page, 0, 8),
        },
        { stepCount: 3, stage: 'active', label: 'ARMED FLIGHT 1' },
        { stepCount: 3, stage: 'active', label: 'OVER SHIELDS' },
        {
          stepCount: 2,
          stage: 'apex',
          label: 'AIRBURST!',
        },
        { stepCount: 3, stage: 'sub_impact', label: '5X CLUSTER' },
        { stepCount: 4, stage: 'settled', label: 'SHIELD BYPASS' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  ap2Scene('ap2-wep-seed-bloom', 'Seed gun Life Buds & Harvest Bloom', setupAp2WepSeedBloomScene, {
    includeUnlit: true,
    sampleRects: TWIN_BRIDGES_SAMPLE_RECTS,
    apexEvent: {
      simEventKind: 'explosion',
      simEventPredicate: (ev) => ev['sourceDefId'] === 'seed_gun',
      occurrence: 'last',
    },
    actionRoi: {
      mode: 'auto_bounds',
      includeProjectiles: 'none',
      propKinds: [],
    },
    stripSchedule: [
      { stepCount: 0, stage: 'windup_hold', label: '3 LIFE BUDS' },
      {
        stepCount: 2,
        stage: 'trigger',
        label: 'FIRE FINALE',
        beforeStep: (page) => triggerFireWeapon(page, 0, 1),
      },
      { stepCount: 3, stage: 'active', label: 'SEED FLIGHT 1' },
      { stepCount: 3, stage: 'active', label: 'SEED FLIGHT 2' },
      { stepCount: 2, stage: 'apex', label: 'HARVEST BLOOM!' },
      { stepCount: 3, stage: 'sub_impact', label: 'HEAL MIST + ROOT' },
      { stepCount: 4, stage: 'settled', label: 'POISON ROOT' },
      { stepCount: 4, stage: 'settled', label: 'SETTLED' },
    ],
  }),
  ap2Scene('ap2-wep-tether-pull', 'Tether staff beam & EM Yank Nova', setupAp2WepTetherPullScene, {
    apexEvent: { simEventKind: 'tactical_vent' },
    actionRoi: {
      mode: 'auto_bounds',
      includeProjectiles: 'none',
      propKinds: ['moss_table'],
    },
    stripSchedule: [
      { stepCount: 0, stage: 'windup_hold', label: 'HEAT 66%' },
      {
        stepCount: 2,
        stage: 'trigger',
        label: 'LATCH BEAM!',
        beforeStep: (page) => triggerFireWeapon(page, 0, 1),
      },
      { stepCount: 3, stage: 'active', label: 'BEAM CUT 1' },
      {
        stepCount: 3,
        stage: 'active',
        label: 'ORANGE HEAT',
      },
      {
        stepCount: 2,
        stage: 'apex',
        label: 'EM YANK [R]!',
        beforeStep: (page) => triggerReloadVent(page),
      },
      { stepCount: 3, stage: 'sub_impact', label: 'SHOCK NOVA' },
      { stepCount: 4, stage: 'settled', label: 'CLUSTER STUN' },
      { stepCount: 4, stage: 'settled', label: 'SETTLED' },
    ],
  }),
];
