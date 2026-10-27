import type { Page } from '@playwright/test';
import type { EnemyTypeId, PropKind, RoomArchetypeId, WeaponDefId } from '@ashen-pact/shared';
import {
  DEFAULT_GAME_URL,
  ENVIRONMENT_SAMPLE_RECTS,
  lockCameraAndIrisToPlayer,
  makeScene,
  markPostWarmupStart,
  stepDeterministicFrames,
  triggerDash,
  triggerFireWeapon,
  triggerInteract,
  triggerReloadVent,
  type SampleRect,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const AP2_P0B_SCENE_IDS: readonly string[] = [
  'ap2-b1-twin-bridges',
  'ap2-b1-gauntlet-chokepoint',
  'ap2-b1-central-bastion',
  'ap2-flip-cover-microblank',
  'ap2-dash-kick-wall-slam',
  'ap2-chasm-ring-out',
  'ap2-microbar-perfect-reload',
  'ap2-heat-vent-staff',
  'ap2-melee-combo3-parry',
  'ap2-tesla-smart-bounce',
] as const;

export const AP2_P0B_SCENE_GROUP = AP2_P0B_SCENE_IDS;

const TWIN_BRIDGES_SAMPLE_RECTS = ENVIRONMENT_SAMPLE_RECTS.map((r) =>
  r.name === 'floor_center' ? { ...r, x: 512, y: 608 } : r,
);
const GAUNTLET_CHOKEPOINT_SAMPLE_RECTS = ENVIRONMENT_SAMPLE_RECTS.map((r) =>
  r.name === 'floor_center' ? { ...r, x: 832, y: 664 } : r,
);
const CENTRAL_BASTION_SAMPLE_RECTS = ENVIRONMENT_SAMPLE_RECTS.map((r) =>
  r.name === 'floor_center' ? { ...r, x: 512, y: 608 } : r,
);

interface Ap2ArenaInitConfig {
  archetype?: RoomArchetypeId;
  roomSeed?: number;
  fourBraziers?: boolean;
  characterId?: 'vanguard' | 'ranger' | 'elementalist' | 'engineer';
  playerX: number;
  playerY: number;
  aimAngle?: number;
  playerFields?: Record<string, unknown>;
  props?: ReadonlyArray<readonly [PropKind, number, number, boolean?]>;
  enemies?: ReadonlyArray<readonly [EnemyTypeId, number, number, ('shield' | undefined)?]>;
  dummyEnemies?: boolean;
  rebuildDoors?: boolean;
}

async function initAp2Arena(page: Page, cfg: Ap2ArenaInitConfig, warmupFrames = 40): Promise<void> {
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
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.magneticRivets.length = 0;

    if (c.archetype && c.roomSeed !== undefined) {
      sim.map.configureRoomLayout({
        roomSeed: c.roomSeed,
        archetype: c.archetype,
        biome: 1,
        activeDoorSides: ['N', 'S', 'E', 'W'],
      });
    }
    sim.props.length = 0;
    sim.spawnProp('torch_brazier', 7 * 32 + 18, 4 * 32 + 20);
    sim.spawnProp('torch_brazier', 28 * 32 + 14, 4 * 32 + 20);
    if (c.fourBraziers) {
      sim.spawnProp('torch_brazier', 7 * 32 + 18, 17 * 32 + 12);
      sim.spawnProp('torch_brazier', 28 * 32 + 14, 17 * 32 + 12);
    }
    for (const [kind, px, py, flipped] of c.props ?? []) {
      const p = sim.spawnProp(kind, px, py);
      if (flipped) sim.flipCoverProp(p);
    }
    sim.consumeEvents();

    if (c.characterId) sim.selectCharacter(sim.player.id, c.characterId);
    Object.assign(sim.player, {
      godMode: true, x: c.playerX, y: c.playerY, prevX: c.playerX, prevY: c.playerY,
      vx: 0, vy: 0, aimAngle: c.aimAngle ?? 0, ...(c.playerFields ?? {}),
    });

    for (const [typeId, ex, ey, eliteMod] of c.enemies ?? []) {
      const e = sim.spawnEnemy(typeId, ex, ey, true, eliteMod);
      Object.assign(e, {
        hp: 900, maxHp: 900, isDummy: c.dummyEnemies ?? true,
        spawnWarmupTimer: 0, aiState: 'idle', stateTimer: 99, vx: 0, vy: 0,
      });
    }
    if (c.rebuildDoors) sim.rebuildCurrentRoomDoors();
  }, cfg);
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, warmupFrames);
  await markPostWarmupStart(page);
}

async function spawnEnemyBullets(
  page: Page,
  bullets: ReadonlyArray<readonly [number, number, number, number, number]>,
): Promise<void> {
  await page.evaluate((list) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const ownerId = sim.enemies[0]?.id ?? 200;
    for (const [id, x, y, vx, vy] of list) {
      sim.projectiles.push(
        sim.acquireProjectile({
          id, ownerId, team: 'enemy', isEnemy: true, x, y, vx, vy, radius: 5.5, damage: 2,
          colorHex: '#E84545', ttlSec: 2.0, pierceCount: 0, bounceCount: 0,
          homingStrength: 0, explosionRadius: 0, isCrit: false, element: 'none', knockback: 40,
        }),
      );
    }
  }, bullets);
}

/** 1. ap2-b1-twin-bridges */
export async function setupAp2B1TwinBridgesScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'TWIN_BRIDGES',
    roomSeed: 1338,
    fourBraziers: true,
    rebuildDoors: true,
    playerX: 340,
    playerY: 268,
    props: [
      ['moss_table', 11 * 32 + 16, 6 * 32 + 16],
      ['moss_table', 23 * 32 + 16, 14 * 32 + 16],
      ['volatile_spore_pod', 11 * 32 + 16, 14 * 32 + 16],
      ['volatile_spore_pod', 23 * 32 + 16, 6 * 32 + 16],
      ['rotten_totem_pillar', 5 * 32 + 16, 15 * 32 + 16],
      ['rotten_totem_pillar', 25 * 32 + 16, 10 * 32 + 16],
      ['glow_mushroom', 5 * 32 + 16, 5 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 715, 205],
      ['wild_boar', 725, 315, 'shield'],
      ['spore_bomber', 775, 455],
    ],
  }, 45);
}

/** 2. ap2-b1-gauntlet-chokepoint */
export async function setupAp2B1GauntletChokepointScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    rebuildDoors: true,
    playerX: 310,
    playerY: 270,
    props: [
      ['moss_table', 6 * 32 + 16, 10 * 32 + 16],
      ['moss_table', 23 * 32 + 16, 10 * 32 + 16],
      ['volatile_spore_pod', 15 * 32 + 16, 6 * 32 + 16],
      ['volatile_spore_pod', 20 * 32 + 16, 15 * 32 + 16],
      ['rotten_totem_pillar', 6 * 32 + 16, 15 * 32 + 16],
      ['rotten_totem_pillar', 23 * 32 + 16, 7 * 32 + 16],
      ['ancient_mechanism', 17 * 32 + 16, 11 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 610, 210],
      ['wild_boar', 650, 310, 'shield'],
      ['goblin_shaman', 710, 255],
    ],
  }, 45);
}

/** 3. ap2-b1-central-bastion */
export async function setupAp2B1CentralBastionScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'CENTRAL_BASTION',
    roomSeed: 1340,
    fourBraziers: true,
    rebuildDoors: true,
    playerX: 330,
    playerY: 270,
    props: [
      ['moss_table', 12 * 32 + 16, 10 * 32 + 16],
      ['moss_table', 23 * 32 + 16, 11 * 32 + 16, true],
      ['moss_table', 17 * 32 + 16, 6 * 32 + 16],
      ['moss_table', 18 * 32 + 16, 15 * 32 + 16],
      ['volatile_spore_pod', 11 * 32 + 16, 6 * 32 + 16],
      ['volatile_spore_pod', 24 * 32 + 16, 15 * 32 + 16],
      ['rotten_totem_pillar', 5 * 32 + 16, 15 * 32 + 16],
      ['rotten_totem_pillar', 25 * 32 + 16, 6 * 32 + 16],
      ['ancient_mechanism', 17 * 32 + 16, 10 * 32 + 16],
    ],
    enemies: [
      ['thorn_turret', 592, 352],
      ['goblin_shooter', 710, 225],
      ['wild_boar', 715, 420, 'shield'],
    ],
  }, 45);
}

/** 4. ap2-flip-cover-microblank (8-frame strip) */
export async function setupAp2FlipCoverMicroblankScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    playerX: 372,
    playerY: 270,
    props: [
      ['moss_table', 405, 270],
    ],
    enemies: [
      ['goblin_shooter', 515, 238],
      ['thorn_turret', 530, 270],
      ['goblin_shooter', 515, 302],
    ],
  });
  await spawnEnemyBullets(page, [
    [97001, 456, 254, -180, 0],
    [97002, 464, 270, -180, 0],
    [97003, 456, 286, -180, 0],
    [97004, 472, 262, -180, 0],
    [97005, 472, 278, -180, 0],
    [97020, 496, 256, -180, -6],
    [97021, 504, 270, -180, 0],
    [97022, 496, 284, -180, 6],
    [97023, 514, 262, -180, -4],
    [97024, 514, 278, -180, 4],
  ]);
  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

/** 5. ap2-dash-kick-wall-slam (8-frame strip — Engine 2.6 Pilot 1) */
export async function setupAp2DashKickWallSlamScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    playerX: 618,
    playerY: 195,
    aimAngle: 0,
    playerFields: {
      armor: 2,
      maxArmor: 5,
    },
    props: [
      ['moss_table', 650, 195, true],
    ],
    enemies: [
      ['wild_boar', 746, 195],
      ['goblin_shooter', 716, 152],
      ['goblin_shaman', 716, 236],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
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

/** 6. ap2-chasm-ring-out (8-frame strip) */
export async function setupAp2ChasmRingOutScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'TWIN_BRIDGES',
    roomSeed: 1338,
    characterId: 'vanguard',
    playerX: 556,
    playerY: 204,
    aimAngle: Math.PI * 0.5,
    enemies: [
      ['goblin_shooter', 556, 238],
      ['green_slime', 536, 234],
      ['goblin_shaman', 576, 235, 'shield'],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      weaponSlots: ['knight_sword', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      meleeComboStep: 2,
      meleeComboResetTimer: 0.85,
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

/** 7. ap2-microbar-perfect-reload (8-frame strip — Engine 2.6 Pilot 2) */
export async function setupAp2MicrobarPerfectReloadScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    characterId: 'engineer',
    playerX: 356,
    playerY: 270,
    aimAngle: 0,
    enemies: [
      ['goblin_shooter', 480, 236],
      ['wild_boar', 510, 270, 'shield'],
      ['spore_bomber', 480, 304],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      weaponSlots: ['rivet_gun', 'tesla_carbine'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      clipMax: 6,
      clipAmmo: 1,
      reloadDuration: 0.6,
      reloadTimer: 0,
      reloadLockout: false,
      fireCooldownTimer: 0,
    });
    const [e1, e2, e3] = sim.enemies;
    const rivetCoords: Array<[number, number, number | null]> = [
      [468, 236, e1?.id ?? null],
      [492, 232, e1?.id ?? null],
      [502, 265, e2?.id ?? null],
      [518, 276, e2?.id ?? null],
      [492, 306, e3?.id ?? null],
      [468, 300, e3?.id ?? null],
    ];
    sim.magneticRivets = rivetCoords.map(([rx, ry, targetId], idx) => ({
      id: 98100 + idx,
      ownerPlayerId: sim.player.id,
      x: rx,
      y: ry,
      attachedEnemyId: targetId,
      attachedTargetId: targetId,
      attachedPropId: null,
      offsetX: 0,
      offsetY: 0,
      ttlSec: 12.0,
    }));
  });
  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

/** 8. ap2-heat-vent-staff (8-frame strip) */
export async function setupAp2HeatVentStaffScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    characterId: 'elementalist',
    playerX: 356,
    playerY: 270,
    aimAngle: 0,
    enemies: [
      ['goblin_shooter', 485, 238],
      ['wild_boar', 505, 270, 'shield'],
      ['goblin_shaman', 485, 302],
    ],
  });
  await spawnEnemyBullets(page, [
    [98300, 418, 250, -150, 0],
    [98301, 424, 270, -150, 0],
    [98302, 418, 290, -150, 0],
  ]);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      aimWorldX: 495,
      aimWorldY: 270,
      weaponSlots: ['apprentice_staff', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      weaponHeat: 66,
      weaponSlotHeat: [66, 0] as [number, number],
      overheatLockTimer: 0,
      ventCooldownTimer: 0,
      fireCooldownTimer: 0,
      staffShotCounter: 2,
      apprenticeStaffShotCount: 2,
    });
  });
  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

/** 9. ap2-melee-combo3-parry (12-frame strip — Engine 2.6 Pilot 3) */
export async function setupAp2MeleeCombo3ParryScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'TWIN_BRIDGES',
    roomSeed: 1338,
    characterId: 'vanguard',
    playerX: 300,
    playerY: 204,
    aimAngle: 0,
    enemies: [
      ['goblin_shooter', 435, 186],
      ['thorn_turret', 445, 204],
      ['goblin_shaman', 435, 222],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      weaponSlots: ['knight_sword', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      meleeComboStep: 0,
      meleeComboResetTimer: 0,
      fireCooldownTimer: 0,
      reloadTimer: 0,
      weaponHeat: 0,
    });
    const ownerId = sim.enemies[0]?.id ?? 200;
    const bullets: ReadonlyArray<readonly [number, number, number, number, number]> = [
      [98500, 508, 192, -120, 0],
      [98501, 514, 204, -120, 0],
      [98502, 508, 216, -120, 0],
    ];
    for (const [id, x, y, vx, vy] of bullets) {
      sim.projectiles.push(
        sim.acquireProjectile({
          id,
          ownerId,
          team: 'enemy',
          isEnemy: true,
          x,
          y,
          vx,
          vy,
          radius: 5.5,
          damage: 2,
          colorHex: '#E84545',
          ttlSec: 3.5,
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
  });
  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

/** 10. ap2-tesla-smart-bounce (8-frame strip) */
export async function setupAp2TeslaSmartBounceScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    characterId: 'ranger',
    playerX: 350,
    playerY: 272,
    aimAngle: 0,
    props: [['moss_table', 392, 272, true]],
    enemies: [
      ['goblin_shooter', 442, 272],
      ['goblin_shaman', 475, 206],
      ['spore_bomber', 505, 196],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    for (let ty = 8; ty <= 9; ty++) {
      for (let tx = 15; tx <= 16; tx++) {
        sim.map.tiles[ty * sim.map.cols + tx] = 'pillar';
      }
    }
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;
    Object.assign(sim.player, {
      weaponSlots: ['tesla_carbine', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      clipMax: 12,
      clipAmmo: 1,
      bonusBounceCurrentClip: 1,
      fireCooldownTimer: 0,
    });
  });
  await stepDeterministicFrames(page, 2);
  await markPostWarmupStart(page);
}

const ENV_SCENES: ReadonlyArray<
  readonly [string, string, (page: Page) => Promise<void>, readonly SampleRect[]]
> = [
  ['ap2-b1-twin-bridges', 'Biome 1 TWIN_BRIDGES tactical room with Y-branched chasm and two 3-tile bridges', setupAp2B1TwinBridgesScene, TWIN_BRIDGES_SAMPLE_RECTS],
  ['ap2-b1-gauntlet-chokepoint', 'Biome 1 GAUNTLET_CHOKEPOINT tactical room with 4 L-shaped pillar blocks and cross-corridor', setupAp2B1GauntletChokepointScene, GAUNTLET_CHOKEPOINT_SAMPLE_RECTS],
  ['ap2-b1-central-bastion', 'Biome 1 CENTRAL_BASTION tactical room with central fortress and 4 moss_table barricades', setupAp2B1CentralBastionScene, CENTRAL_BASTION_SAMPLE_RECTS],
];

export const AP2_P0B_VISUAL_SCENES: readonly VisualSceneDef[] = [
  ...ENV_SCENES.map(([id, desc, setup, sampleRects]) =>
    makeScene(id, desc, DEFAULT_GAME_URL, 'GameScene', setup, { includeUnlit: true, sampleRects }),
  ),
  makeScene(
    'ap2-flip-cover-microblank',
    'Player flipping moss_table with [E] emitting r=56px Micro-Blank wave clearing enemy bullets',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2FlipCoverMicroblankScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'cover_flipped',
        simEventPredicate: (ev) => Number(ev['bulletsCleared'] ?? 0) > 0,
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'VOLLEY IN' },
        { stepCount: 2, stage: 'active', label: 'CLOSE IN 1' },
        { stepCount: 2, stage: 'active', label: 'CLOSE IN 2' },
        { stepCount: 2, stage: 'active', label: 'DANGER ZONE' },
        {
          stepCount: 2,
          stage: 'apex',
          label: 'FLIP [E]!',
          beforeStep: (page) => triggerInteract(page),
        },
        { stepCount: 3, stage: 'sub_impact', label: 'MICRO-BLANK' },
        { stepCount: 4, stage: 'settled', label: 'COVER BLOCK' },
        { stepCount: 4, stage: 'settled', label: 'SAFE COVER' },
      ],
    },
  ),
  makeScene(
    'ap2-dash-kick-wall-slam',
    'Player Dash-Kicking flipped moss_table at 520 px/s into enemies triggering Wall-Slam',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2DashKickWallSlamScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: { simEventKind: 'wall_slam' },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'WINDUP' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'DASH KICK',
          beforeStep: (page) => triggerDash(page, 1, 0, 0),
        },
        { stepCount: 3, stage: 'active', label: 'SLIDE HIT 1' },
        { stepCount: 3, stage: 'active', label: 'SLIDE HIT 2' },
        { stepCount: 2, stage: 'apex', label: 'WALL SLAM!' },
        { stepCount: 3, stage: 'sub_impact', label: 'SHOCKWAVE' },
        { stepCount: 4, stage: 'settled', label: 'STUNNED' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-chasm-ring-out',
    'Player knocking infantry enemies off TWIN_BRIDGES into chasm with RING-OUT! callout',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2ChasmRingOutScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: { simEventKind: 'ring_out', occurrence: 'last' },
      actionRoi: {
        mode: 'auto_bounds',
        includeProjectiles: 'none',
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'LEDGE WINDUP' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'HEAVY SLASH',
          beforeStep: (page) => triggerFireWeapon(page, Math.PI * 0.5, 1),
        },
        { stepCount: 2, stage: 'active', label: 'WAVE PUSH' },
        { stepCount: 2, stage: 'sub_impact', label: 'RING-OUT 1' },
        { stepCount: 1, stage: 'apex', label: 'RING-OUT!' },
        { stepCount: 3, stage: 'sub_impact', label: 'LOOT FOUNTAIN' },
        { stepCount: 4, stage: 'settled', label: 'ELITE STUNNED' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-microbar-perfect-reload',
    'Player firing rivet_gun Finale Shot and hitting [R] in Golden Window on 32x5px Micro-Bar',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2MicrobarPerfectReloadScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: { simEventKind: 'perfect_reload' },
      actionRoi: {
        mode: 'auto_bounds',
        sceneCategory: 'microbar_ui',
        includeProjectiles: 'none',
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'LAST ROUND' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'FIRE FINALE',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 8, stage: 'active', label: 'RELOAD 25%' },
        { stepCount: 9, stage: 'active', label: 'GOLD ZONE 50%' },
        {
          stepCount: 2,
          stage: 'apex',
          label: 'PERFECT [R]!',
          beforeStep: (page) => triggerReloadVent(page),
        },
        { stepCount: 3, stage: 'sub_impact', label: 'RIVET WEB' },
        { stepCount: 4, stage: 'settled', label: 'OVERCLOCKED' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-heat-vent-staff',
    'Player at 80% Orange Heat on apprentice_staff pressing [R] Tactical Vent and firing beam',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2HeatVentStaffScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: { simEventKind: 'tactical_vent' },
      actionRoi: {
        mode: 'auto_bounds',
        sceneCategory: 'microbar_ui',
        includeProjectiles: 'none',
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'HEAT 66%' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: '3RD SHOT BEAM',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 3, stage: 'active', label: 'ORANGE 80%' },
        { stepCount: 3, stage: 'active', label: 'BULLETS IN' },
        {
          stepCount: 2,
          stage: 'apex',
          label: 'VENT [R]!',
          beforeStep: (page) => triggerReloadVent(page),
        },
        { stepCount: 3, stage: 'sub_impact', label: 'TRI-BLAST' },
        { stepCount: 4, stage: 'settled', label: 'COOLED 0%' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-melee-combo3-parry',
    'Vanguard wielding knight_sword swinging 3-hit combo, Crescent Wave and Parry Deflecting 3 bullets',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2MeleeCombo3ParryScene,
    {
      captureStrip: true,
      frameCount: 12,
      heroFrameIndex: 9,
      apexEvent: {
        simEventKind: 'melee_swing',
        simEventPredicate: (ev) => Number(ev['bulletsDestroyed'] ?? 0) >= 3,
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'COMBO READY' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'HIT 1 SLASH',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 14, stage: 'active', label: 'HIT 1 ARC' },
        { stepCount: 15, stage: 'sub_impact', label: 'STEP 1 DONE' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'HIT 2 LUNGE',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 10, stage: 'active', label: 'HIT 2 ARC' },
        { stepCount: 10, stage: 'sub_impact', label: 'STEP 2 DONE' },
        { stepCount: 4, stage: 'windup_hold', label: 'WINDUP HIT 3' },
        { stepCount: 5, stage: 'active', label: 'BULLETS IN' },
        {
          stepCount: 2,
          stage: 'apex',
          label: 'PARRY X3!',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 4, stage: 'sub_impact', label: 'WAVE CRASH' },
        { stepCount: 6, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-tesla-smart-bounce',
    'Player firing tesla_carbine through flipped moss_table and Smart Bouncing around L-corner',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2TeslaSmartBounceScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['bullet_volley_spawned', 'chain_lightning'],
        simEventPredicate: (ev) =>
          ev['kind'] === 'chain_lightning' || typeof ev['replacedProjectileId'] === 'number',
        occurrence: 'last',
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'AIM COVER' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'FIRE TESLA',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 3, stage: 'active', label: 'PASS COVER' },
        { stepCount: 3, stage: 'sub_impact', label: 'PIERCE HIT 1' },
        { stepCount: 3, stage: 'apex', label: 'SMART BOUNCE!' },
        { stepCount: 3, stage: 'active', label: 'CORNER SEEK' },
        { stepCount: 4, stage: 'sub_impact', label: 'CHAIN ARC!' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
];
