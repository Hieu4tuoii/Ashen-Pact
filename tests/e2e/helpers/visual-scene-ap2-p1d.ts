import type { Page } from '@playwright/test';
import type {
  BlessingId,
  CharacterId,
  EnemyTypeId,
  PropKind,
  RoomArchetypeId,
  WeaponDefId,
} from '@ashen-pact/shared';
import {
  DEFAULT_GAME_URL,
  lockCameraAndIrisToPlayer,
  makeScene,
  markPostWarmupStart,
  queueStepInput,
  stepDeterministicFrames,
  switchGameSceneToEnglish,
  triggerDash,
  triggerFireWeapon,
  triggerInteract,
  triggerReloadVent,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const AP2_P1D_SCENE_IDS: readonly string[] = [
  'ap2-modal-blessing-vi',
  'ap2-modal-blessing-en',
  'ap2-blessing-table-rocket',
  'ap2-blessing-prism-split',
  'ap2-blessing-tediore-chuck',
  'ap2-skill-vanguard-prism',
  'ap2-skill-elementalist-twin',
] as const;

export const AP2_P1D_SCENE_GROUP = AP2_P1D_SCENE_IDS;

interface Ap2P1DArenaInitConfig {
  archetype?: RoomArchetypeId;
  roomSeed?: number;
  characterId: CharacterId;
  playerX: number;
  playerY: number;
  aimAngle?: number;
  blessingIds: readonly BlessingId[];
  playerPatch?: Record<string, unknown>;
  clearPillarRects?: ReadonlyArray<readonly [number, number, number, number]>;
  props?: ReadonlyArray<readonly [PropKind, number, number, boolean?]>;
  enemies?: ReadonlyArray<
    readonly [EnemyTypeId, number, number, ('shield' | 'giant' | undefined)?, Record<string, unknown>?]
  >;
  enemyBullets?: ReadonlyArray<readonly [number, number, number, number, number]>;
}

async function initAp2P1DArena(
  page: Page,
  cfg: Ap2P1DArenaInitConfig,
  warmupFrames = 40,
): Promise<void> {
  await page.evaluate((c) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 2;
    sim.map.biome = 1;

    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    room.type = 'combat';
    room.roomArchetype = c.archetype ?? 'GAUNTLET_CHOKEPOINT';
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
      'skillZones',
      'tetherBeams',
      'flameFissures',
      'solarFireZones',
      'magmaTrails',
      'lightningPillars',
    ] as const) {
      sim[k].length = 0;
    }

    sim.map.configureRoomLayout({
      roomSeed: c.roomSeed ?? 1336,
      archetype: c.archetype ?? 'GAUNTLET_CHOKEPOINT',
      biome: 1,
      activeDoorSides: ['N', 'S', 'E', 'W'],
    });

    for (const [x0, y0, w, h] of c.clearPillarRects ?? [[10, 6, 12, 6]]) {
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

    sim.selectCharacter(sim.player.id, c.characterId);
    sim.player.blessingIds = [...c.blessingIds];

    sim.props.length = 0;
    sim.spawnProp('torch_brazier', 242, 148);
    sim.spawnProp('torch_brazier', 910, 148);
    sim.spawnProp('torch_brazier', 242, 556);
    sim.spawnProp('torch_brazier', 910, 556);

    for (const [kind, px, py, flipped] of c.props ?? []) {
      const p = sim.spawnProp(kind, px, py);
      if (flipped) {
        sim.flipCoverProp(p, sim.player);
        p.microBlankTimer = 0;
      }
    }
    sim.consumeEvents();

    Object.assign(sim.player, {
      godMode: true,
      x: c.playerX,
      y: c.playerY,
      prevX: c.playerX,
      prevY: c.playerY,
      vx: 0,
      vy: 0,
      aimAngle: c.aimAngle ?? 0,
      blessingIds: [...c.blessingIds],
    });

    for (const [typeId, ex, ey, eliteMod, extraPatch] of c.enemies ?? []) {
      const e = sim.spawnEnemy(typeId, ex, ey, true, eliteMod ?? null);
      Object.assign(e, {
        hp: 900,
        maxHp: 900,
        isDummy: false,
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
  }, cfg);

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, warmupFrames);

  if (cfg.playerPatch || (cfg.enemyBullets && cfg.enemyBullets.length > 0)) {
    await page.evaluate((c) => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      Object.assign(sim.player, {
        x: c.playerX,
        y: c.playerY,
        prevX: c.playerX,
        prevY: c.playerY,
        vx: 0,
        vy: 0,
        blessingIds: [...c.blessingIds],
        ...(c.playerPatch ?? {}),
      });
      const ownerId = sim.enemies[0]?.id ?? 200;
      for (const [id, bx, by, bvx, bvy] of c.enemyBullets ?? []) {
        sim.projectiles.push(
          sim.acquireProjectile({
            id,
            ownerId,
            team: 'enemy',
            isEnemy: true,
            x: bx,
            y: by,
            vx: bvx,
            vy: bvy,
            radius: 5.5,
            damage: 2,
            colorHex: '#E84545',
            ttlSec: 2.5,
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
    }, cfg);
    await lockCameraAndIrisToPlayer(page);
    await stepDeterministicFrames(page, 1);
  }

  await markPostWarmupStart(page);
}

async function setupBlessingModalScene(
  page: Page,
  opts: {
    english: boolean;
    characterId: CharacterId;
    ownedBlessings: readonly BlessingId[];
    choices: readonly BlessingId[];
  },
): Promise<void> {
  if (opts.english) {
    await switchGameSceneToEnglish(page);
  }
  await page.evaluate((o) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(portalRoom.id);
    sim.skipCurrentRoomWaves();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.selectCharacter(sim.player.id, o.characterId);
    sim.currentFloor = 2;
    sim.player.x = sim.portalX - 36;
    sim.player.y = sim.portalY;
    sim.player.prevX = sim.player.x;
    sim.player.prevY = sim.player.y;
    sim.player.blessingIds = [...o.ownedBlessings];
    sim.player.buffChoices = [...o.choices];
    sim.runState = 'buff_choice';
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          lastRunState?: string;
          lastHudHp?: number;
          invalidateAllHudCaches?: () => void;
          updateVectorHud?: () => void;
          updateModalHud?: () => void;
        }
      | undefined;
    if (gs) {
      gs.lastRunState = '';
      gs.lastHudHp = -1;
      gs.invalidateAllHudCaches?.();
    }
  }, opts);
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 45);
}

/** 1. ap2-modal-blessing-vi (static modal in Vietnamese) */
export async function setupAp2ModalBlessingViScene(page: Page): Promise<void> {
  await setupBlessingModalScene(page, {
    english: false,
    characterId: 'vanguard',
    ownedBlessings: [
      'table_tech_prism_split',
      'dash_tidal_ram',
      'reload_tediore_chuck',
      'bullet_split_bounce',
    ],
    choices: ['table_tech_rocket', 'dash_reload_acrobat', 'vanguard_bastion_prism'],
  });
}

/** 2. ap2-modal-blessing-en (static modal in English) */
export async function setupAp2ModalBlessingEnScene(page: Page): Promise<void> {
  await setupBlessingModalScene(page, {
    english: true,
    characterId: 'elementalist',
    ownedBlessings: ['table_tech_billiard_master', 'dash_flame_shackle', 'reload_frost_nova'],
    choices: ['table_tech_prism_split', 'reload_tediore_chuck', 'elementalist_twin_orbit'],
  });
}

/** 3. ap2-blessing-table-rocket (8-frame strip) */
export async function setupAp2BlessingTableRocketScene(page: Page): Promise<void> {
  await initAp2P1DArena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    characterId: 'vanguard',
    playerX: 360,
    playerY: 270,
    aimAngle: 0,
    blessingIds: ['table_tech_rocket'],
    props: [['moss_table', 388, 270, false]],
    enemies: [
      ['wild_boar', 488, 270, 'shield'],
      ['goblin_shooter', 512, 246],
      ['goblin_shaman', 512, 294],
    ],
  });
}

/** 4. ap2-blessing-prism-split (8-frame strip) */
export async function setupAp2BlessingPrismSplitScene(page: Page): Promise<void> {
  await initAp2P1DArena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    characterId: 'ranger',
    playerX: 356,
    playerY: 270,
    aimAngle: 0,
    blessingIds: ['table_tech_prism_split'],
    props: [['moss_table', 424, 270, true]],
    enemies: [
      ['goblin_shooter', 524, 252],
      ['wild_boar', 530, 270, 'shield'],
      ['goblin_shaman', 524, 288],
    ],
    playerPatch: {
      weaponSlots: ['hunter_crossbow', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      clipMax: 4,
      clipAmmo: 4,
      weaponSlotClipAmmo: [4, 6],
      reloadTimer: 0,
      fireCooldownTimer: 0,
    },
  });
}

/** 5. ap2-blessing-tediore-chuck (8-frame strip) */
export async function setupAp2BlessingTedioreChuckScene(page: Page): Promise<void> {
  await initAp2P1DArena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    characterId: 'engineer',
    playerX: 356,
    playerY: 270,
    aimAngle: 0,
    blessingIds: ['reload_tediore_chuck'],
    enemies: [
      ['wild_boar', 462, 270, 'shield'],
      ['goblin_shooter', 484, 246],
      ['spore_bomber', 484, 294],
    ],
    playerPatch: {
      weaponSlots: ['tesla_carbine', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      clipMax: 12,
      clipAmmo: 0,
      weaponSlotClipAmmo: [0, 6],
      reloadDuration: 0.6,
      reloadTimer: 0.34,
      reloadLockout: false,
      reloadBlessingIcdTimer: 0,
      fireCooldownTimer: 0,
    },
  });
}

/** 6. ap2-skill-vanguard-prism (8-frame strip) */
export async function setupAp2SkillVanguardPrismScene(page: Page): Promise<void> {
  await initAp2P1DArena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    characterId: 'vanguard',
    playerX: 356,
    playerY: 270,
    aimAngle: 0,
    blessingIds: ['vanguard_bastion_prism'],
    enemies: [
      ['goblin_shooter', 490, 252],
      ['wild_boar', 494, 270, 'shield'],
      ['goblin_shaman', 490, 288],
    ],
    enemyBullets: [
      [99101, 398, 258, -180, 0],
      [99102, 398, 282, -180, 0],
    ],
    playerPatch: {
      armor: 2,
      maxArmor: 6,
      skillActiveTimer: 0,
      skillCooldownTimer: 0,
      weaponSlots: ['hunter_crossbow', 'knight_sword'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      clipMax: 4,
      clipAmmo: 4,
      weaponSlotClipAmmo: [4, 0],
      reloadTimer: 0,
      fireCooldownTimer: 0,
    },
  });
}

/** 7. ap2-skill-elementalist-twin (8-frame strip) */
export async function setupAp2SkillElementalistTwinScene(page: Page): Promise<void> {
  await initAp2P1DArena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    characterId: 'elementalist',
    playerX: 356,
    playerY: 270,
    aimAngle: 0,
    blessingIds: ['elementalist_twin_orbit'],
    enemies: [
      ['wild_boar', 471, 270, 'shield'],
      ['goblin_shooter', 512, 232],
      ['goblin_shaman', 512, 308],
    ],
    playerPatch: {
      activeImbueElement: 'burn',
      skillActiveTimer: 0,
      skillCooldownTimer: 0,
      fireCooldownTimer: 0,
    },
  });
}

export const AP2_P1D_VISUAL_SCENES: readonly VisualSceneDef[] = [
  makeScene(
    'ap2-modal-blessing-vi',
    'Floor Blessing Choice Modal in Vietnamese with 3 action/skill cards and owned blessing HUD chips',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2ModalBlessingViScene,
  ),
  makeScene(
    'ap2-modal-blessing-en',
    'Floor Blessing Choice Modal in English with 3 action/skill cards and owned blessing HUD chips',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2ModalBlessingEnScene,
  ),
  makeScene(
    'ap2-blessing-table-rocket',
    'Player with table_tech_rocket flipping moss_table (2 homing rockets) and Dash-Kicking rocket-charged barricade into enemies for r=104px blast',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2BlessingTableRocketScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['table_rocket_blast', 'explosion', 'damage_dealt'],
        simEventPredicate: (ev) =>
          ev['sourceDefId'] === 'table_tech_rocket' && Number(ev['radius'] ?? 0) >= 100,
      },
      actionRoi: {
        includeProjectiles: 'none',
        propKinds: ['moss_table'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'ROCKET TABLE' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'FLIP + 2 ROCKETS',
          beforeStep: (page) => triggerInteract(page),
        },
        {
          stepCount: 2,
          stage: 'active',
          label: 'DASH KICK 620!',
          beforeStep: (page) => triggerDash(page, 1, 0, 0),
        },
        { stepCount: 3, stage: 'active', label: 'JET PAYLOAD' },
        { stepCount: 2, stage: 'apex', label: '104PX BLAST!' },
        { stepCount: 3, stage: 'sub_impact', label: 'BURN WAVE' },
        { stepCount: 4, stage: 'settled', label: 'SCORCHED FLOOR' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-blessing-prism-split',
    'Player with table_tech_prism_split firing through prism-aura flipped moss_table to split bolt into 2 Shock rays',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2BlessingPrismSplitScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['prism_split_shot', 'damage_dealt'],
        simEventPredicate: (ev) => ev['element'] === 'shock',
      },
      actionRoi: {
        includeProjectiles: 'none',
        propKinds: ['moss_table'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'PRISM COVER' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'FIRE BOLT',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        {
          stepCount: 3,
          stage: 'active',
          label: 'PRISM 2X SPLIT',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 1, aimAngle: 0, durationTicks: 8 }),
        },
        { stepCount: 3, stage: 'active', label: 'TWIN SHOCK RAYS' },
        { stepCount: 2, stage: 'apex', label: 'PRISM STRIKE!' },
        { stepCount: 3, stage: 'sub_impact', label: 'SHOCK IMPACT' },
        { stepCount: 4, stage: 'settled', label: 'KNOCKBACK' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-blessing-tediore-chuck',
    'Player with reload_tediore_chuck hitting Perfect Reload [R] to hurl volatile magazine at 520 px/s exploding on enemy pack',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2BlessingTedioreChuckScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['tediore_chuck_blast', 'explosion', 'damage_dealt'],
        simEventPredicate: (ev) => ev['sourceDefId'] === 'reload_tediore_chuck',
      },
      actionRoi: {
        includeProjectiles: 'none',
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'GOLD WINDOW' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'CHUCK MAG [R]!',
          beforeStep: (page) => triggerReloadVent(page),
        },
        {
          stepCount: 3,
          stage: 'active',
          label: 'SPINNING MAG 1',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 1, aimAngle: 0, durationTicks: 8 }),
        },
        { stepCount: 3, stage: 'active', label: 'SPINNING MAG 2' },
        { stepCount: 2, stage: 'apex', label: 'TEDIORE BLAST!' },
        { stepCount: 3, stage: 'sub_impact', label: 'BURN SHRAPNEL' },
        { stepCount: 4, stage: 'settled', label: 'FULL CLIP' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-skill-vanguard-prism',
    'Vanguard with vanguard_bastion_prism raising 360 Bastion Prism Shield to reflect enemy bullets as Fire bolts and split player shots into 2 rays',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2SkillVanguardPrismScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['prism_split_shot', 'damage_dealt'],
        simEventPredicate: (ev) => ev['targetKind'] === 'enemy',
      },
      actionRoi: {
        includeProjectiles: 'none',
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'VOLLEY IN' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'BASTION PRISM!',
          beforeStep: (page) =>
            queueStepInput(page, { skill: true, fire: true, aimAngle: 0, durationTicks: 1 }),
        },
        {
          stepCount: 3,
          stage: 'active',
          label: 'REFLECT + SPLIT',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 1, aimAngle: 0, durationTicks: 8 }),
        },
        { stepCount: 3, stage: 'active', label: 'RAYS CONVERGE' },
        { stepCount: 2, stage: 'apex', label: 'PRISM BARRAGE!' },
        { stepCount: 3, stage: 'sub_impact', label: 'BURN + PIERCE' },
        { stepCount: 4, stage: 'settled', label: 'FORTRESS HOLD' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-skill-elementalist-twin',
    'Elementalist with elementalist_twin_orbit deploying twin Burn & Chill spheres 160px apart linked by Reaction Cutter Beam triggering Vaporize',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2SkillElementalistTwinScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['elemental_reaction', 'chain_lightning', 'damage_dealt'],
        simEventPredicate: (ev) =>
          ev['kind'] === 'elemental_reaction' || ev['kind'] === 'chain_lightning',
      },
      actionRoi: {
        includeProjectiles: 'none',
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'ORB READY' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'TWIN ORBIT [Q]!',
          beforeStep: (page) => queueStepInput(page, { skill: true, durationTicks: 1 }),
        },
        {
          stepCount: 12,
          stage: 'active',
          label: 'BURN + CHILL 160PX',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 1, aimAngle: 0, durationTicks: 8 }),
        },
        { stepCount: 12, stage: 'active', label: 'CUTTER BEAM CHARGE' },
        { stepCount: 2, stage: 'apex', label: 'REACTION BEAM!' },
        { stepCount: 3, stage: 'sub_impact', label: 'VAPORIZE BURST' },
        { stepCount: 4, stage: 'settled', label: 'DUAL ZONES' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
];
