import type { Page } from '@playwright/test';
import type {
  EnemyTypeId,
  PropKind,
  RoomArchetypeId,
  SurfaceKind,
} from '@ashen-pact/shared';
import {
  BIOME2_GAME_URL,
  BIOME3_GAME_URL,
  DEFAULT_GAME_URL,
  ENVIRONMENT_SAMPLE_RECTS,
  lockCameraAndIrisToPlayer,
  makeScene,
  markPostWarmupStart,
  queueStepInput,
  stepDeterministicFrames,
  triggerDash,
  triggerFireWeapon,
  triggerInteract,
  type SampleRect,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const AP2_P1C_SCENE_IDS: readonly string[] = [
  'ap2-b2-prism-labyrinth',
  'ap2-b2-glacial-kick-spikes',
  'ap2-b2-prism-refract',
  'ap2-b3-crossfire-conveyors',
  'ap2-b3-pneumatic-press-crush',
  'ap2-b3-blast-shield-wave',
  'ap2-crumbling-pillar-ring',
] as const;

export const AP2_P1C_SCENE_GROUP = AP2_P1C_SCENE_IDS;

const PRISM_LABYRINTH_SAMPLE_RECTS: SampleRect[] = ENVIRONMENT_SAMPLE_RECTS.map((r) => {
  if (r.name === 'floor_center') return { ...r, x: 512, y: 608 };
  if (r.name === 'corner_bl') return { ...r, x: 256, y: 768 };
  return r;
});

const CROSSFIRE_CONVEYORS_SAMPLE_RECTS: SampleRect[] = ENVIRONMENT_SAMPLE_RECTS.map((r) => {
  if (r.name === 'floor_center') return { ...r, x: 512, y: 608 };
  if (r.name === 'corner_tr') return { ...r, x: 1796, y: 584 };
  if (r.name === 'corner_bl') return { ...r, x: 256, y: 768 };
  return r;
});

interface Ap2P1CArenaInitConfig {
  biome: 1 | 2 | 3;
  archetype: RoomArchetypeId;
  roomSeed: number;
  fourBraziers?: boolean;
  characterId?: 'vanguard' | 'ranger' | 'elementalist' | 'druid' | 'engineer';
  playerX: number;
  playerY: number;
  aimAngle?: number;
  playerPatch?: Record<string, unknown>;
  clearPillarRects?: ReadonlyArray<readonly [number, number, number, number]>;
  surfaceRects?: ReadonlyArray<readonly [number, number, number, number, SurfaceKind]>;
  spawnArchetypeProps?: boolean;
  props?: ReadonlyArray<readonly [PropKind, number, number, boolean?]>;
  enemies?: ReadonlyArray<
    readonly [EnemyTypeId, number, number, ('shield' | 'giant' | undefined)?, Record<string, unknown>?]
  >;
  dummyEnemies?: boolean;
  rebuildDoors?: boolean;
  conveyorWarningSec?: number;
}

async function initAp2P1CArena(
  page: Page,
  cfg: Ap2P1CArenaInitConfig,
  warmupFrames = 40,
): Promise<void> {
  await page.evaluate((c) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = c.biome;
    sim.currentFloor = c.biome === 1 ? 1 : c.biome === 2 ? 3 : 5;
    sim.map.biome = c.biome;

    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    room.type = 'combat';
    room.roomArchetype = c.archetype;
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

    const layout = sim.map.configureRoomLayout({
      roomSeed: c.roomSeed,
      archetype: c.archetype,
      biome: c.biome,
      activeDoorSides: ['N', 'S', 'E', 'W'],
    });

    for (const [x0, y0, w, h] of c.clearPillarRects ?? []) {
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const tx = x0 + dx;
          const ty = y0 + dy;
          if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
            sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
          }
        }
      }
      sim.map.rebuildSolidBoxes();
      sim.map.mapRevision += 1;
    }

    for (const [x0, y0, w, h, surf] of c.surfaceRects ?? []) {
      sim.map.fillSurfaceRect(x0, y0, w, h, surf);
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

    if (c.spawnArchetypeProps) {
      for (const anchor of layout.propAnchors) {
        if (anchor.role === 'pillar_toy' || anchor.role === 'hazard') {
          sim.spawnProp(anchor.propKind, anchor.x, anchor.y);
        }
      }
    }

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

    for (const [typeId, ex, ey, eliteMod, extraPatch] of c.enemies ?? []) {
      const e = sim.spawnEnemy(typeId, ex, ey, true, eliteMod ?? null);
      Object.assign(e, {
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
        ...(extraPatch ?? {}),
      });
    }
    if (c.rebuildDoors) sim.rebuildCurrentRoomDoors();
  }, cfg);

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, warmupFrames);

  if (cfg.playerPatch || cfg.conveyorWarningSec !== undefined) {
    await page.evaluate((c) => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      Object.assign(sim.player, {
        x: c.playerX,
        y: c.playerY,
        prevX: c.playerX,
        prevY: c.playerY,
        vx: 0,
        vy: 0,
        ...(c.playerPatch ?? {}),
      });
      if (c.conveyorWarningSec !== undefined) {
        sim.map.conveyorCycleTimer = 8.0 - c.conveyorWarningSec;
        sim.map.conveyorWarningTimer = c.conveyorWarningSec;
      }
    }, cfg);
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 1);
  }

  await markPostWarmupStart(page);
}

/** 1. ap2-b2-prism-labyrinth (static + unlit) */
export async function setupAp2B2PrismLabyrinthScene(page: Page): Promise<void> {
  await initAp2P1CArena(
    page,
    {
      biome: 2,
      archetype: 'PRISM_LABYRINTH',
      roomSeed: 7104,
      fourBraziers: true,
      rebuildDoors: true,
      characterId: 'ranger',
      playerX: 368,
      playerY: 270,
      aimAngle: 0,
      dummyEnemies: true,
      props: [
        ['cryo_prism_pillar', 14 * 32 + 16, 6 * 32 + 16],
        ['cryo_prism_pillar', 21 * 32 + 16, 6 * 32 + 16],
        ['cryo_prism_pillar', 14 * 32 + 16, 15 * 32 + 16],
        ['glacial_barricade', 13 * 32 + 16, 10 * 32 + 16, false],
        ['glacial_barricade', 22 * 32 + 16, 11 * 32 + 16, true],
        ['sliding_ice_block', 12 * 32 + 16, 8 * 32 + 16],
        ['sliding_ice_block', 20 * 32 + 16, 13 * 32 + 16],
      ],
      enemies: [
        ['frost_bat', 624, 196],
        ['baby_yeti', 664, 276, 'shield'],
        ['ice_mage', 724, 240],
        ['ice_golem', 640, 400],
        ['snow_spirit', 512, 430],
      ],
    },
    45,
  );
}

/** 2. ap2-b2-glacial-kick-spikes (8-frame strip) */
export async function setupAp2B2GlacialKickSpikesScene(page: Page): Promise<void> {
  await initAp2P1CArena(page, {
    biome: 2,
    archetype: 'PRISM_LABYRINTH',
    roomSeed: 7104,
    fourBraziers: true,
    characterId: 'vanguard',
    playerX: 380,
    playerY: 192,
    aimAngle: 0,
    surfaceRects: [[11, 5, 9, 3, 'ice']],
    props: [['glacial_barricade', 408, 192, false]],
    enemies: [
      ['baby_yeti', 516, 192],
      ['frost_bat', 532, 168],
      ['ice_mage', 532, 216, 'shield'],
    ],
  });
}

/** 3. ap2-b2-prism-refract (8-frame strip) */
export async function setupAp2B2PrismRefractScene(page: Page): Promise<void> {
  await initAp2P1CArena(page, {
    biome: 2,
    archetype: 'PRISM_LABYRINTH',
    roomSeed: 7104,
    fourBraziers: true,
    characterId: 'ranger',
    playerX: 356,
    playerY: 208,
    aimAngle: 0,
    surfaceRects: [[11, 5, 9, 3, 'ice']],
    props: [['cryo_prism_pillar', 478, 208]],
    enemies: [
      ['frost_bat', 536, 184],
      ['baby_yeti', 544, 208, 'shield'],
      ['ice_mage', 536, 232],
    ],
    playerPatch: {
      weaponSlots: ['hunter_crossbow', 'rivet_gun'],
      activeWeaponSlot: 0,
      clipMax: 4,
      clipAmmo: 4,
      reloadTimer: 0,
      fireCooldownTimer: 0,
    },
  });
}

/** 4. ap2-b3-crossfire-conveyors (static + unlit) */
export async function setupAp2B3CrossfireConveyorsScene(page: Page): Promise<void> {
  await initAp2P1CArena(
    page,
    {
      biome: 3,
      archetype: 'CROSSFIRE_CONVEYORS',
      roomSeed: 7100,
      fourBraziers: true,
      rebuildDoors: true,
      characterId: 'engineer',
      playerX: 336,
      playerY: 270,
      aimAngle: 0,
      dummyEnemies: true,
      conveyorWarningSec: 0.85,
      props: [
        ['forge_blast_shield', 10 * 32 + 16, 5 * 32 + 16, false],
        ['forge_blast_shield', 22 * 32 + 16, 16 * 32 + 16, true],
        ['pneumatic_press', 15 * 32 + 16, 10 * 32 + 16],
        ['pneumatic_press', 20 * 32 + 16, 11 * 32 + 16],
        ['slag_crucible', 14 * 32 + 16, 7 * 32 + 16],
        ['slag_crucible', 21 * 32 + 16, 14 * 32 + 16],
      ],
      enemies: [
        ['fire_imp', 560, 216],
        ['dwarf_cannon', 640, 224],
        ['coal_golem', 610, 320, 'shield'],
        ['welder_drone', 704, 290],
        ['iron_shielder', 660, 448],
      ],
    },
    44,
  );
}

/** 5. ap2-b3-pneumatic-press-crush (8-frame strip + unlit) */
export async function setupAp2B3PneumaticPressCrushScene(page: Page): Promise<void> {
  await initAp2P1CArena(page, {
    biome: 3,
    archetype: 'CROSSFIRE_CONVEYORS',
    roomSeed: 7100,
    fourBraziers: true,
    rebuildDoors: true,
    characterId: 'vanguard',
    playerX: 382,
    playerY: 270,
    aimAngle: 0,
    clearPillarRects: [[11, 10, 2, 2]],
    surfaceRects: [[11, 7, 9, 3, 'none']],
    props: [
      ['forge_blast_shield', 412, 270, true],
      ['pneumatic_press', 500, 270],
    ],
    enemies: [
      ['dwarf_cannon', 424, 246],
      ['iron_shielder', 580, 254, 'shield'],
      [
        'coal_golem',
        582,
        286,
        'shield',
        {
          isBoss: true,
          shieldArmor: 40,
          maxShieldArmor: 80,
        },
      ],
    ],
    playerPatch: {
      x: 382,
      y: 270,
    },
  });
}

/** 6. ap2-b3-blast-shield-wave (8-frame strip) */
export async function setupAp2B3BlastShieldWaveScene(page: Page): Promise<void> {
  await initAp2P1CArena(page, {
    biome: 3,
    archetype: 'CROSSFIRE_CONVEYORS',
    roomSeed: 7100,
    fourBraziers: true,
    characterId: 'vanguard',
    playerX: 360,
    playerY: 304,
    aimAngle: 0,
    clearPillarRects: [[11, 10, 2, 2]],
    surfaceRects: [[13, 9, 7, 2, 'oil']],
    props: [['forge_blast_shield', 388, 304, false]],
    enemies: [
      ['fire_imp', 496, 282],
      ['dwarf_cannon', 498, 304, 'shield'],
      ['welder_drone', 496, 326],
    ],
  });
}

/** 7. ap2-crumbling-pillar-ring (8-frame strip) */
export async function setupAp2CrumblingPillarRingScene(page: Page): Promise<void> {
  await initAp2P1CArena(page, {
    biome: 1,
    archetype: 'CRUMBLING_PILLAR_RING',
    roomSeed: 7108,
    fourBraziers: false,
    characterId: 'vanguard',
    playerX: 326,
    playerY: 192,
    aimAngle: 0,
    spawnArchetypeProps: true,
    props: [['moss_table', 356, 192, true]],
    enemies: [
      ['goblin_shooter', 384, 176],
      ['wild_boar', 512, 192, 'shield'],
      ['goblin_shaman', 554, 178],
      ['spore_bomber', 554, 206],
    ],
  });
}

export const AP2_P1C_VISUAL_SCENES: readonly VisualSceneDef[] = [
  makeScene(
    'ap2-b2-prism-labyrinth',
    'Biome 2 PRISM_LABYRINTH tactical room with staggered 2x4 cover walls, ice lanes, cryo_prism_pillar, glacial_barricade, and sliding_ice_block',
    BIOME2_GAME_URL,
    'GameScene',
    setupAp2B2PrismLabyrinthScene,
    {
      includeUnlit: true,
      sampleRects: PRISM_LABYRINTH_SAMPLE_RECTS,
    },
  ),
  makeScene(
    'ap2-b2-glacial-kick-spikes',
    'Player flipping glacial_barricade with [E] and Dash-Kicking on ice into enemy pack, shattering into 3 glacial_spike pillars and freezing enemies',
    BIOME2_GAME_URL,
    'GameScene',
    setupAp2B2GlacialKickSpikesScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'explosion',
        simEventPredicate: (ev) => ev['sourceDefId'] === 'glacial_barricade',
      },
      actionRoi: {
        includeProjectiles: 'none',
        propKinds: ['glacial_barricade', 'glacial_spike'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'ICE BARRICADE' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'FLIP [E]!',
          beforeStep: (page) => triggerInteract(page),
        },
        {
          stepCount: 2,
          stage: 'active',
          label: 'DASH KICK!',
          beforeStep: (page) => triggerDash(page, 1, 0, 0),
        },
        { stepCount: 3, stage: 'active', label: 'ICE SLIDE 1.5X' },
        { stepCount: 2, stage: 'apex', label: '3X ICE SPIKES!' },
        { stepCount: 3, stage: 'sub_impact', label: 'FROZEN PACK' },
        { stepCount: 4, stage: 'settled', label: 'SPIKE COVER' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-b2-prism-refract',
    'Player shooting cryo_prism_pillar to refract projectile into 3 fan chill rays toward enemy cluster',
    BIOME2_GAME_URL,
    'GameScene',
    setupAp2B2PrismRefractScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'bullet_volley_spawned',
        simEventPredicate: (ev) =>
          ev['replacedProjectileId'] !== undefined && Number(ev['pelletCount']) === 3,
      },
      actionRoi: {
        includeProjectiles: 'none',
        propKinds: ['cryo_prism_pillar'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'AIM PRISM' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'FIRE BOLT',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        {
          stepCount: 3,
          stage: 'active',
          label: 'BOLT FLIGHT 1',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 1, aimAngle: 0, durationTicks: 6 }),
        },
        { stepCount: 3, stage: 'active', label: 'BOLT FLIGHT 2' },
        { stepCount: 2, stage: 'apex', label: 'PRISM 3X SPLIT!' },
        { stepCount: 3, stage: 'sub_impact', label: 'CHILL RAYS HIT' },
        { stepCount: 4, stage: 'settled', label: 'ICE KNOCKBACK' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-b3-crossfire-conveyors',
    'Biome 3 CROSSFIRE_CONVEYORS tactical room with opposing conveyor belts, flashing reversal chevrons, forge_blast_shield, pneumatic_press, and slag_crucible',
    BIOME3_GAME_URL,
    'GameScene',
    setupAp2B3CrossfireConveyorsScene,
    {
      includeUnlit: true,
      sampleRects: CROSSFIRE_CONVEYORS_SAMPLE_RECTS,
    },
  ),
  makeScene(
    'ap2-b3-pneumatic-press-crush',
    'Player Dash-Kicking prop into pneumatic_press sensor triggering 0.35s windup and piston slam crushing enemies and breaking Boss armor',
    BIOME3_GAME_URL,
    'GameScene',
    setupAp2B3PneumaticPressCrushScene,
    {
      includeUnlit: true,
      sampleRects: CROSSFIRE_CONVEYORS_SAMPLE_RECTS,
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'explosion',
        simEventPredicate: (ev) => ev['sourceDefId'] === 'pneumatic_press',
      },
      actionRoi: {
        includeProjectiles: 'none',
        propKinds: ['forge_blast_shield', 'pneumatic_press'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'PRESS IDLE' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'KICK TO SENSOR',
          beforeStep: (page) => triggerDash(page, 1, 0, 0),
        },
        { stepCount: 10, stage: 'active', label: 'WINDUP RING 1' },
        { stepCount: 11, stage: 'active', label: 'WINDUP RING 2' },
        { stepCount: 2, stage: 'apex', label: 'PISTON SLAM!' },
        { stepCount: 3, stage: 'sub_impact', label: 'ARMOR BROKEN!' },
        { stepCount: 4, stage: 'settled', label: 'PRESS COOLDOWN' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-b3-blast-shield-wave',
    'Player flipping forge_blast_shield with [E] and Dash-Kicking across oil corridor projecting 88px Fire Wave',
    BIOME3_GAME_URL,
    'GameScene',
    setupAp2B3BlastShieldWaveScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'damage_dealt',
        simEventPredicate: (ev) => ev['element'] === 'burn',
      },
      actionRoi: {
        includeProjectiles: 'none',
        propKinds: ['forge_blast_shield'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'BLAST SHIELD' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'FLIP [E]!',
          beforeStep: (page) => triggerInteract(page),
        },
        {
          stepCount: 2,
          stage: 'active',
          label: 'DASH KICK!',
          beforeStep: (page) => triggerDash(page, 1, 0, 0),
        },
        { stepCount: 3, stage: 'active', label: '88PX FIRE WAVE' },
        { stepCount: 2, stage: 'apex', label: 'BURN IMPACT!' },
        { stepCount: 3, stage: 'sub_impact', label: 'OIL IGNITED' },
        { stepCount: 4, stage: 'settled', label: 'BLAZE CORRIDOR' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-crumbling-pillar-ring',
    'CRUMBLING_PILLAR_RING hexagonal pillar collapsing along 160x56px crush lane and opening 2x2 solid footprint to walkable floor',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2CrumblingPillarRingScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['totem_pillar_collapsed', 'prop_destroyed'],
        simEventPredicate: (ev) =>
          ev['kind'] === 'totem_pillar_collapsed' || ev['propKind'] === 'rotten_totem_pillar',
      },
      actionRoi: {
        includeProjectiles: 'none',
        propKinds: ['moss_table'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'HEX PILLAR RING' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'DASH KICK!',
          beforeStep: (page) => triggerDash(page, 1, 0, 0),
        },
        { stepCount: 2, stage: 'active', label: 'SLIDE TO PILLAR' },
        { stepCount: 1, stage: 'active', label: 'IMPACT WINDUP' },
        { stepCount: 2, stage: 'apex', label: 'PILLAR CRUSH!' },
        {
          stepCount: 3,
          stage: 'sub_impact',
          label: '160PX LANE SLAM',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 1, aimAngle: 0, durationTicks: 12 }),
        },
        { stepCount: 4, stage: 'settled', label: '2X2 FLOOR OPEN' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
];
