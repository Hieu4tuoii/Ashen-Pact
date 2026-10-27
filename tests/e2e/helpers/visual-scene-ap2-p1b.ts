import type { Page } from '@playwright/test';
import type { EnemyTypeId, PropKind, RoomArchetypeId } from '@ashen-pact/shared';
import {
  DEFAULT_GAME_URL,
  ENVIRONMENT_SAMPLE_RECTS,
  lockCameraAndIrisToPlayer,
  makeScene,
  markPostWarmupStart,
  queueStepInput,
  stepDeterministicFrames,
  triggerFireWeapon,
  triggerReloadVent,
  type SampleRect,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const AP2_P1B_SCENE_IDS: readonly string[] = [
  'ap2-wep-laser-railgun',
  'ap2-wep-cleaver-boomerang',
  'ap2-wep-void-implosion',
  'ap2-wep-axe-guillotine',
  'ap2-wep-solar-supernova',
  'ap2-wep-magma-geysers',
  'ap2-wep-hammer-thunder',
] as const;

export const AP2_P1B_SCENE_GROUP = AP2_P1B_SCENE_IDS;

const TWIN_BRIDGES_SAMPLE_RECTS: readonly SampleRect[] = ENVIRONMENT_SAMPLE_RECTS.map((r) =>
  r.name === 'floor_center' ? { ...r, x: 512, y: 608 } : r,
);
const GAUNTLET_CHOKEPOINT_SAMPLE_RECTS: readonly SampleRect[] = ENVIRONMENT_SAMPLE_RECTS.map((r) =>
  r.name === 'floor_center' ? { ...r, x: 832, y: 664 } : r,
);

interface Ap2P1BArenaInitConfig {
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
  enemyBullets?: ReadonlyArray<readonly [number, number, number, number?]>;
  dummyEnemies?: boolean;
  rebuildDoors?: boolean;
}

async function initAp2P1BArena(
  page: Page,
  cfg: Ap2P1BArenaInitConfig,
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
      'flameFissures',
      'solarFireZones',
      'magmaTrails',
      'lightningPillars',
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
    });
    for (const [typeId, ex, ey, eliteMod] of c.enemies ?? []) {
      Object.assign(sim.spawnEnemy(typeId, ex, ey, true, eliteMod), {
        hp: 900,
        maxHp: 900,
        isDummy: c.dummyEnemies ?? false,
        moveSpeed: 0,
        attackCooldownTimer: 99,
        spawnWarmupTimer: 0,
        aiState: 'stunned',
        stateTimer: 8.0,
        stunTimer: 8.0,
        vx: 0,
        vy: 0,
      });
    }
    if (c.rebuildDoors) sim.rebuildCurrentRoomDoors();
  }, cfg);
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, warmupFrames);
  if (cfg.playerPatch || cfg.enemyBullets) {
    await page.evaluate((c) => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      if (c.playerPatch) Object.assign(sim.player, c.playerPatch);
      const ownerId = sim.enemies[0]?.id ?? 200;
      for (const [id, x, y, vx] of c.enemyBullets ?? []) {
        sim.projectiles.push(
          sim.acquireProjectile({
            id,
            ownerId,
            team: 'enemy',
            isEnemy: true,
            x,
            y,
            vx: vx ?? -115,
            vy: 0,
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
            knockback: 30,
          }),
        );
      }
    }, cfg);
    await stepDeterministicFrames(page, 1);
  }
  await markPostWarmupStart(page);
}

/** 1. ap2-wep-laser-railgun (8-frame strip + unlit) */
export async function setupAp2WepLaserRailgunScene(page: Page): Promise<void> {
  await initAp2P1BArena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    rebuildDoors: true,
    characterId: 'engineer',
    playerX: 356,
    playerY: 270,
    aimAngle: 0,
    props: [
      ['cryo_prism_pillar', 416, 270],
      ['moss_table', 6 * 32 + 16, 10 * 32 + 16],
      ['moss_table', 23 * 32 + 16, 10 * 32 + 16],
      ['volatile_spore_pod', 15 * 32 + 16, 6 * 32 + 16],
      ['rotten_totem_pillar', 6 * 32 + 16, 15 * 32 + 16],
      ['glow_mushroom', 5 * 32 + 16, 5 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 468, 240],
      ['wild_boar', 488, 270, 'shield'],
      ['goblin_shaman', 468, 300],
    ],
    playerPatch: {
      weaponSlots: ['focus_laser', 'rivet_gun'],
      activeWeaponSlot: 0,
      weaponHeat: 68,
      weaponSlotHeat: [68, 0],
      overheatLockTimer: 0,
      fireCooldownTimer: 0,
      reloadTimer: 0,
    },
    enemyBullets: [
      [99101, 412, 262, -110],
      [99102, 418, 270, -110],
      [99103, 412, 278, -110],
    ],
  });
}

/** 2. ap2-wep-cleaver-boomerang (12-frame strip) */
export async function setupAp2WepCleaverBoomerangScene(page: Page): Promise<void> {
  await initAp2P1BArena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    characterId: 'vanguard',
    playerX: 320,
    playerY: 270,
    aimAngle: 0,
    pillarBox: [16, 17, 7, 9],
    enemies: [
      ['goblin_shooter', 404, 248],
      ['wild_boar', 432, 270, 'shield'],
      ['goblin_shaman', 404, 292],
    ],
    playerPatch: {
      weaponSlots: ['emerald_cleaver', 'rivet_gun'],
      activeWeaponSlot: 0,
      meleeComboStep: 0,
      meleeComboResetTimer: 0,
      fireCooldownTimer: 0,
      reloadTimer: 0,
      weaponHeat: 0,
    },
    enemyBullets: [
      [99201, 562, 258, -120],
      [99202, 570, 270, -120],
      [99203, 562, 282, -120],
    ],
  });
}

/** 3. ap2-wep-void-implosion (8-frame strip) */
export async function setupAp2WepVoidImplosionScene(page: Page): Promise<void> {
  await initAp2P1BArena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    characterId: 'elementalist',
    playerX: 356,
    playerY: 270,
    aimAngle: 0,
    enemies: [
      ['goblin_shooter', 446, 240],
      ['wild_boar', 462, 270, 'shield'],
      ['goblin_shaman', 446, 300],
    ],
    playerPatch: {
      weaponSlots: ['void_staff', 'apprentice_staff'],
      activeWeaponSlot: 0,
      clipMax: 2,
      clipAmmo: 2,
      reloadDuration: 1.05,
      reloadTimer: 0,
      fireCooldownTimer: 0,
    },
    enemyBullets: [
      [99301, 434, 256, -110],
      [99302, 444, 270, -110],
      [99303, 434, 284, -110],
    ],
  });
}

/** 4. ap2-wep-axe-guillotine (12-frame strip) */
export async function setupAp2WepAxeGuillotineScene(page: Page): Promise<void> {
  await initAp2P1BArena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    characterId: 'vanguard',
    playerX: 308,
    playerY: 270,
    aimAngle: 0,
    pillarBox: [17, 18, 7, 9],
    enemies: [
      ['goblin_shooter', 376, 248],
      ['wild_boar', 462, 270, 'shield'],
      ['goblin_shaman', 474, 294],
    ],
    playerPatch: {
      weaponSlots: ['berserker_axe', 'rivet_gun'],
      activeWeaponSlot: 0,
      armor: 0,
      berserkerBloodlustStacks: 2,
      berserkerBloodlustTimer: 4.0,
      meleeComboStep: 0,
      meleeComboResetTimer: 0,
      fireCooldownTimer: 0,
      reloadTimer: 0,
      weaponHeat: 0,
    },
    enemyBullets: [
      [99401, 560, 258, -115],
      [99402, 568, 270, -115],
      [99403, 560, 282, -115],
    ],
  });
}

/** 5. ap2-wep-solar-supernova (8-frame strip + unlit) */
export async function setupAp2WepSolarSupernovaScene(page: Page): Promise<void> {
  await initAp2P1BArena(page, {
    archetype: 'TWIN_BRIDGES',
    roomSeed: 1338,
    fourBraziers: true,
    rebuildDoors: true,
    characterId: 'elementalist',
    playerX: 444,
    playerY: 266,
    aimAngle: 0,
    props: [
      ['moss_table', 11 * 32 + 16, 6 * 32 + 16],
      ['glow_mushroom', 5 * 32 + 16, 5 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 532, 240],
      ['wild_boar', 548, 266, 'shield'],
      ['goblin_shaman', 532, 292],
    ],
    playerPatch: {
      weaponSlots: ['solar_archon_staff', 'apprentice_staff'],
      activeWeaponSlot: 0,
      weaponHeat: 68,
      weaponSlotHeat: [68, 0],
      overheatLockTimer: 0,
      fireCooldownTimer: 0,
      aimWorldX: 540,
      aimWorldY: 266,
    },
    enemyBullets: [
      [99501, 560, 256, -80],
      [99502, 568, 266, -80],
      [99503, 560, 276, -80],
    ],
  });
}

/** 6. ap2-wep-magma-geysers (8-frame strip) */
export async function setupAp2WepMagmaGeysersScene(page: Page): Promise<void> {
  await initAp2P1BArena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    characterId: 'vanguard',
    playerX: 356,
    playerY: 270,
    aimAngle: 0,
    pillarBox: [16, 17, 7, 9],
    enemies: [
      ['goblin_shooter', 420, 254],
      ['wild_boar', 432, 270, 'shield'],
      ['goblin_shaman', 420, 286],
    ],
    playerPatch: {
      weaponSlots: ['magma_cannon', 'knight_sword'],
      activeWeaponSlot: 0,
      clipMax: 3,
      clipAmmo: 1,
      reloadDuration: 0.5,
      reloadTimer: 0,
      reloadLockout: false,
      fireCooldownTimer: 0,
    },
  });
}

/** 7. ap2-wep-hammer-thunder (12-frame strip) */
export async function setupAp2WepHammerThunderScene(page: Page): Promise<void> {
  await initAp2P1BArena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    characterId: 'vanguard',
    playerX: 320,
    playerY: 270,
    aimAngle: 0,
    pillarBox: [16, 17, 7, 9],
    enemies: [
      ['goblin_shooter', 392, 248],
      ['wild_boar', 436, 270, 'shield'],
      ['goblin_shaman', 452, 294],
    ],
    playerPatch: {
      weaponSlots: ['thunder_hammer', 'rivet_gun'],
      activeWeaponSlot: 0,
      elementalConvergenceTimer: 10,
      meleeComboStep: 0,
      meleeComboResetTimer: 0,
      fireCooldownTimer: 0,
      reloadTimer: 0,
      weaponHeat: 0,
    },
    enemyBullets: [
      [99701, 566, 258, -115],
      [99702, 574, 270, -115],
      [99703, 566, 282, -115],
    ],
  });
}

const ap2P1BScene = (
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

export const AP2_P1B_VISUAL_SCENES: readonly VisualSceneDef[] = [
  ap2P1BScene(
    'ap2-wep-laser-railgun',
    'Focus laser continuous beam refraction & Railgun Vent',
    setupAp2WepLaserRailgunScene,
    {
      includeUnlit: true,
      sampleRects: GAUNTLET_CHOKEPOINT_SAMPLE_RECTS,
      apexEvent: { simEventKind: 'focus_laser_railgun' },
      actionRoi: {
        mode: 'auto_bounds',
        includeProjectiles: 'none',
        propKinds: ['cryo_prism_pillar'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'ORANGE 68%' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'LASER BEAM',
          beforeStep: (page) => triggerFireWeapon(page, 0, 8),
        },
        { stepCount: 3, stage: 'active', label: 'PRISM SPLIT' },
        { stepCount: 3, stage: 'active', label: 'HEAT 73%' },
        {
          stepCount: 2,
          stage: 'apex',
          label: 'RAILGUN [R]!',
          beforeStep: (page) => triggerReloadVent(page),
        },
        { stepCount: 3, stage: 'sub_impact', label: 'PIERCE BLAST' },
        { stepCount: 4, stage: 'settled', label: 'COOLED 0%' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  ap2P1BScene(
    'ap2-wep-cleaver-boomerang',
    'Emerald cleaver 3-hit Poison combo & Jade Boomerang throw/spin/pull',
    setupAp2WepCleaverBoomerangScene,
    {
      frameCount: 12,
      heroFrameIndex: 9,
      apexEvent: {
        simEventKind: 'bullet_volley_spawned',
        simEventPredicate: (ev) => ev['weaponId'] === 'emerald_cleaver_boomerang',
      },
      actionRoi: {
        mode: 'auto_bounds',
        includeProjectiles: 'none',
        propKinds: [],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'CLEAVER READY' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'HIT 1 SLASH',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 14, stage: 'active', label: 'POISON ARC 1' },
        { stepCount: 15, stage: 'sub_impact', label: 'STEP 1 DONE' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'HIT 2 LUNGE',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 10, stage: 'active', label: 'POISON ARC 2' },
        { stepCount: 10, stage: 'sub_impact', label: 'STEP 2 DONE' },
        { stepCount: 4, stage: 'windup_hold', label: 'WINDUP HIT 3' },
        { stepCount: 5, stage: 'active', label: 'BULLETS IN' },
        {
          stepCount: 2,
          stage: 'apex',
          label: 'BOOMERANG!',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 8, stage: 'sub_impact', label: 'VORTEX SPIN' },
        { stepCount: 24, stage: 'settled', label: 'RETURN PULL' },
      ],
    },
  ),
  ap2P1BScene(
    'ap2-wep-void-implosion',
    'Void staff Black Hole orb swallowing bullets & Hold-Release Implosion',
    setupAp2WepVoidImplosionScene,
    {
      apexEvent: { simEventKind: 'void_implosion' },
      actionRoi: {
        mode: 'auto_bounds',
        includeProjectiles: 'none',
        propKinds: [],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'AIM VORTEX' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'HOLD ORB',
          beforeStep: (page) => triggerFireWeapon(page, 0, 8),
        },
        { stepCount: 3, stage: 'active', label: 'EAT BULLETS' },
        { stepCount: 3, stage: 'active', label: 'SUCTION PULL' },
        { stepCount: 2, stage: 'apex', label: 'IMPLOSION!' },
        { stepCount: 3, stage: 'sub_impact', label: 'GRAVITY SLAM' },
        { stepCount: 4, stage: 'settled', label: 'POISON NOVA' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  ap2P1BScene(
    'ap2-wep-axe-guillotine',
    'Berserker axe 3-hit Bloodlust combo & 96px Guillotine Flame Fissure',
    setupAp2WepAxeGuillotineScene,
    {
      frameCount: 12,
      heroFrameIndex: 9,
      apexEvent: { simEventKind: 'berserker_guillotine_slam' },
      actionRoi: {
        mode: 'auto_bounds',
        includeProjectiles: 'none',
        propKinds: [],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'BLOODLUST X2' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'HIT 1 CLEAVE',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 11, stage: 'active', label: 'CRIMSON ARC 1' },
        { stepCount: 12, stage: 'sub_impact', label: 'BLOODLUST X3' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'HIT 2 CLEAVE',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 8, stage: 'active', label: 'CRIMSON ARC 2' },
        { stepCount: 8, stage: 'sub_impact', label: 'BLOODLUST X4' },
        { stepCount: 4, stage: 'windup_hold', label: 'WINDUP LEAP' },
        { stepCount: 4, stage: 'active', label: 'SHIELD TARGET' },
        {
          stepCount: 2,
          stage: 'apex',
          label: 'GUILLOTINE!',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 4, stage: 'sub_impact', label: 'FLAME FISSURE' },
        { stepCount: 6, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  ap2P1BScene(
    'ap2-wep-solar-supernova',
    'Solar archon staff 3 Mini-Suns converging rays & Supernova [R]',
    setupAp2WepSolarSupernovaScene,
    {
      includeUnlit: true,
      sampleRects: TWIN_BRIDGES_SAMPLE_RECTS,
      apexEvent: { simEventKind: 'solar_supernova' },
      actionRoi: {
        mode: 'auto_bounds',
        includeProjectiles: 'none',
        propKinds: [],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: '3 MINI-SUNS' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'CONVERGE RAYS',
          beforeStep: (page) =>
            queueStepInput(page, {
              fire: true,
              aimAngle: 0,
              aimWorldX: 540,
              aimWorldY: 266,
              durationTicks: 1,
            }),
        },
        { stepCount: 3, stage: 'active', label: 'TRIPLE RAYS' },
        { stepCount: 3, stage: 'active', label: 'CONVERGE HIT' },
        {
          stepCount: 2,
          stage: 'apex',
          label: 'SUPERNOVA [R]!',
          beforeStep: (page) =>
            queueStepInput(page, {
              reloadVent: true,
              aimAngle: 0,
              aimWorldX: 540,
              aimWorldY: 266,
              durationTicks: 1,
            }),
        },
        { stepCount: 3, stage: 'sub_impact', label: 'SOLAR ZONE' },
        { stepCount: 4, stage: 'settled', label: 'BURN FIELD' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  ap2P1BScene(
    'ap2-wep-magma-geysers',
    'Magma cannon boulder bulldoze Wall-Slam & 4 Magma Geysers eruption',
    setupAp2WepMagmaGeysersScene,
    {
      apexEvent: { simEventKind: 'perfect_reload' },
      actionRoi: {
        mode: 'auto_bounds',
        includeProjectiles: 'none',
        propKinds: [],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'MAGMA LOADED' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'FIRE BOULDER',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 6, stage: 'active', label: 'BULLDOZE ROLL' },
        { stepCount: 7, stage: 'active', label: 'WALL SLAM!' },
        {
          stepCount: 2,
          stage: 'apex',
          label: 'GEYSERS [R]!',
          beforeStep: (page) => triggerReloadVent(page),
        },
        { stepCount: 3, stage: 'sub_impact', label: '4X PLUMES' },
        { stepCount: 4, stage: 'settled', label: 'MAGMA TRAIL' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  ap2P1BScene(
    'ap2-wep-hammer-thunder',
    'Thunder hammer 3-hit combo, Lightning Rod Pillar & 3x Lightning Strikes',
    setupAp2WepHammerThunderScene,
    {
      frameCount: 12,
      heroFrameIndex: 9,
      apexEvent: { simEventKind: 'thunder_hammer_pillar' },
      actionRoi: {
        mode: 'auto_bounds',
        includeProjectiles: 'none',
        propKinds: [],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'MJOLNIR READY' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'HIT 1 SMASH',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 14, stage: 'active', label: 'SHOCKWAVE 1' },
        { stepCount: 15, stage: 'sub_impact', label: 'STEP 1 DONE' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'HIT 2 SMASH',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 10, stage: 'active', label: 'SHOCKWAVE 2' },
        { stepCount: 10, stage: 'sub_impact', label: 'STEP 2 DONE' },
        { stepCount: 4, stage: 'windup_hold', label: 'WINDUP HIT 3' },
        { stepCount: 5, stage: 'active', label: 'BULLETS IN' },
        {
          stepCount: 2,
          stage: 'apex',
          label: 'THUNDER ROD!',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 4, stage: 'sub_impact', label: '3X LIGHTNING' },
        { stepCount: 6, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
];
