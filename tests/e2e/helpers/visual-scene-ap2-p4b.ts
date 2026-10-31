import type { BuffId, DuoBoonId, EnemyDefId, WeaponDefId } from '@ashen-pact/shared';
import type { Page } from '@playwright/test';
import {
  DEFAULT_GAME_URL,
  lockCameraAndIrisToPlayer,
  makeScene,
  markPostWarmupStart,
  queueStepInput,
  stepDeterministicFrames,
  type StripStageKind,
  type StripStepSchedule,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const AP2_P4B_SCENE_IDS: readonly string[] = [
  'ap2-modal-duo-boon-card',
  'ap2-duo-magnetic-bastion-ring',
  'ap2-duo-superheated-cyclone',
  'ap2-duo-plasma-overload-star',
  'ap2-secret-arena-20s-trial',
] as const;

export const AP2_P4B_SCENE_GROUP = AP2_P4B_SCENE_IDS;

interface CleanP4BArenaConfig {
  minTx: number;
  maxTx: number;
  minTy: number;
  maxTy: number;
  corridorWallRows?: readonly number[];
  enemies: readonly {
    defId: EnemyDefId;
    x: number;
    y: number;
    hp: number;
    maxHp?: number;
    patch?: Record<string, unknown>;
  }[];
}

function stepInput(
  stepCount: number,
  stage: StripStageKind,
  label: string,
  moveX: number,
  moveY: number,
  aimAngle: number,
  extra?: { fire?: boolean; interact?: boolean },
): StripStepSchedule {
  return {
    stepCount,
    stage,
    label,
    beforeStep: (p) =>
      queueStepInput(p, {
        ...extra,
        moveX,
        moveY,
        aimAngle,
        durationTicks: stepCount,
      }),
  };
}

async function prepareCleanP4BArena(page: Page, cfg: CleanP4BArenaConfig): Promise<void> {
  await page.evaluate((c) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 2;
    sim.map.biome = 1;

    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    room.type = 'combat';
    room.cleared = true;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    room.cleared = false;
    sim.runState = 'playing';
    sim.portalActive = false;
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.props.length = 0;
    sim.summons.length = 0;
    sim.skillZones.length = 0;

    const wallRows = new Set(c.corridorWallRows ?? []);
    for (let ty = c.minTy; ty <= c.maxTy; ty++) {
      for (let tx = c.minTx; tx <= c.maxTx; tx++) {
        if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
          sim.map.tiles[ty * sim.map.cols + tx] = wallRows.has(ty) ? 'wall' : 'floor';
          sim.map.setSurface(tx, ty, 'none', 0, true);
        }
      }
    }
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;

    for (const sp of c.enemies) {
      const e = sim.spawnEnemy(sp.defId, sp.x, sp.y, true);
      Object.assign(e, {
        hp: sp.hp,
        maxHp: sp.maxHp ?? sp.hp,
        moveSpeed: 0,
        aiState: 'cooldown',
        stateTimer: 20.0,
        attackCooldownTimer: 99,
        spawnWarmupTimer: 0,
        aimAngle: Math.PI,
        vx: 0,
        vy: 0,
        ...(sp.patch ?? {}),
      });
    }
  }, cfg);
}

/** 1. ap2-modal-duo-boon-card (Static Vietnamese Floor Buff Modal with Slot-3 Duo Boon hovered + HUD Duo Boon chip) */
export async function setupAp2ModalDuoBoonCardScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(portalRoom.id);
    sim.skipCurrentRoomWaves();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.selectCharacter(sim.player.id, 'elementalist');
    sim.currentFloor = 3;
    Object.assign(sim.player, {
      x: sim.portalX - 36,
      y: sim.portalY,
      prevX: sim.portalX - 36,
      prevY: sim.portalY,
      weaponSlots: ['apprentice_staff', 'tesla_carbine'] as [WeaponDefId, WeaponDefId],
      duoBoonIds: ['duo_magnetic_bastion_ring'] as DuoBoonId[],
      blessingIds: ['dash_flame_shackle', 'reload_holster_surge'],
      buffChoices: [
        'table_tech_rocket',
        'reload_frost_nova',
        'duo_superheated_cyclone',
      ] as BuffId[],
    });
    sim.runState = 'buff_choice';

    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          buffHoveredIdx?: number | null;
          lastRunState?: string;
          lastHudHp?: number;
          invalidateAllHudCaches?: () => void;
        }
      | undefined;
    if (gs) {
      gs.buffHoveredIdx = 2;
      gs.lastRunState = '';
      gs.lastHudHp = -1;
      gs.invalidateAllHudCaches?.();
    }
  });

  await lockCameraAndIrisToPlayer(page);
  await page.mouse.move(1412, 536);
  await stepDeterministicFrames(page, 40);
  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | { buffHoveredIdx?: number | null; lastRunState?: string }
      | undefined;
    if (gs && gs.buffHoveredIdx !== 2) {
      gs.buffHoveredIdx = 2;
      gs.lastRunState = '';
    }
  });
  await stepDeterministicFrames(page, 5);
}

/** 2. ap2-duo-magnetic-bastion-ring (8-frame strip: [E] flips 2nd barricade <= 220px -> High-Voltage Magnetic Arc Grid sears crossing enemies) */
export async function setupAp2DuoMagneticBastionRingScene(page: Page): Promise<void> {
  await prepareCleanP4BArena(page, {
    minTx: 6,
    maxTx: 23,
    minTy: 3,
    maxTy: 13,
    enemies: [
      { defId: 'wild_boar', x: 464, y: 271, hp: 420 },
      { defId: 'goblin_shooter', x: 496, y: 256, hp: 420 },
      { defId: 'green_slime', x: 526, y: 243, hp: 420 },
    ],
  });

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.selectCharacter(sim.player.id, 'engineer');
    Object.assign(sim.player, {
      godMode: true, x: 378, y: 304, prevX: 378, prevY: 304, vx: 0, vy: 0, aimAngle: -0.32,
      weaponSlots: ['tesla_carbine', 'hunter_crossbow'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0, duoBoonIds: ['duo_magnetic_bastion_ring'] as DuoBoonId[],
      blessingIds: ['reload_holster_surge'],
    });
    const farAnchor = sim.spawnProp('moss_table', 568, 224);
    sim.flipCoverProp(farAnchor, sim.player);
    farAnchor.flippedByPlayerId = sim.player.id;
    farAnchor.microBlankTimer = 0;
    sim.spawnProp('moss_table', 408, 296);
    sim.consumeEvents();
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 41);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, { x: 378, y: 304, prevX: 378, prevY: 304, vx: 0, vy: 0, aimAngle: -0.32 });
    sim.tick = 51;
    sim.consumeEvents();
  });

  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

/** 3. ap2-duo-superheated-cyclone (8-frame strip: Frost orb triggers Vaporize on burning lead -> spawns 140 px/s Superheated Cyclone chasing pack) */
export async function setupAp2DuoSuperheatedCycloneScene(page: Page): Promise<void> {
  await prepareCleanP4BArena(page, {
    minTx: 6,
    maxTx: 24,
    minTy: 3,
    maxTy: 13,
    enemies: [
      { defId: 'wild_boar', x: 460, y: 264, hp: 20, maxHp: 120 },
      { defId: 'goblin_shooter', x: 536, y: 250, hp: 440 },
      { defId: 'goblin_shaman', x: 568, y: 286, hp: 440 },
    ],
  });

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.selectCharacter(sim.player.id, 'elementalist');
    Object.assign(sim.player, {
      godMode: true, x: 362, y: 264, prevX: 362, prevY: 264, vx: 0, vy: 0, aimAngle: 0,
      weaponSlots: ['apprentice_staff', 'solar_archon_staff'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0, duoBoonIds: ['duo_superheated_cyclone'] as DuoBoonId[],
      blessingIds: ['reload_frost_nova'],
    });
    sim.consumeEvents();
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 36);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      x: 362, y: 264, prevX: 362, prevY: 264, vx: 0, vy: 0, aimAngle: 0,
      apprenticeStaffShotCount: 1, staffShotCounter: 1, activeImbueElement: 'chill',
      weaponHeat: 0, fireCooldownTimer: 0, critChance: 0,
    });
    if (sim.enemies[0]) {
      Object.assign(sim.enemies[0], {
        x: 460, y: 264, hp: 20, burnTimer: 2.8, burnTickTimer: 0.9, burnStacks: 1,
        lastElementOwnerId: sim.player.id, lastElementApplied: 'burn',
      });
    }
    sim.summons.length = 0;
    sim.consumeEvents();
  });

  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

const PLASMA_CORRIDOR_AIM = Math.atan2(260 - 316, 416 - 348);

/** 4. ap2-duo-plasma-overload-star (8-frame strip: Shock shot triggers Overload in narrow corridor -> 420 px/s Plasma Star ricochets off walls piercing enemies) */
export async function setupAp2DuoPlasmaOverloadStarScene(page: Page): Promise<void> {
  await prepareCleanP4BArena(page, {
    minTx: 7,
    maxTx: 25,
    minTy: 4,
    maxTy: 13,
    corridorWallRows: [6, 11],
    enemies: [
      { defId: 'wild_boar', x: 416, y: 260, hp: 18, maxHp: 120 },
      { defId: 'goblin_shooter', x: 442, y: 244, hp: 460 },
      { defId: 'goblin_shaman', x: 512, y: 308, hp: 460 },
      { defId: 'wild_boar', x: 592, y: 272, hp: 460 },
    ],
  });

  await page.evaluate((aim) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.selectCharacter(sim.player.id, 'elementalist');
    Object.assign(sim.player, {
      godMode: true, x: 348, y: 316, prevX: 348, prevY: 316, vx: 0, vy: 0, aimAngle: aim,
      weaponSlots: ['hunter_crossbow', 'apprentice_staff'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0, duoBoonIds: ['duo_plasma_overload_star'] as DuoBoonId[],
      blessingIds: ['dash_flame_shackle'],
    });
    sim.consumeEvents();
  }, PLASMA_CORRIDOR_AIM);

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 36);

  await page.evaluate((aim) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      x: 348, y: 316, prevX: 348, prevY: 316, vx: 0, vy: 0, aimAngle: aim,
      aimWorldX: 416, aimWorldY: 260, activeImbueElement: 'shock',
      clipAmmo: 4, clipMax: 4, reloadTimer: 0, fireCooldownTimer: 0,
      critChance: 0, plasmaStarIcdTimer: 0,
    });
    if (sim.enemies[0]) {
      Object.assign(sim.enemies[0], {
        x: 416, y: 260, hp: 18, burnTimer: 2.8, burnTickTimer: 0.9, burnStacks: 1,
        lastElementOwnerId: sim.player.id, lastElementApplied: 'burn',
      });
    }
    sim.projectiles.length = 0;
    sim.consumeEvents();
  }, PLASMA_CORRIDOR_AIM);

  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

const SECRET_TRIAL_AIM = Math.atan2(-18, 132);

/** 5. ap2-secret-arena-20s-trial (8-frame strip: Live 20s Secret Arena countdown -> slaying final Elite <20.0s ascends Epic Chest to Legendary + +40 Gold banner) */
export async function setupAp2SecretArena20sTrialScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 2;
    sim.map.biome = 1;

    const secretRoom =
      sim.dungeon.rooms.find((r) => r.type === 'secret') ??
      sim.dungeon.rooms[sim.dungeon.secretRoomId]!;
    const parentId = secretRoom.secretWallDir
      ? secretRoom.connections[secretRoom.secretWallDir]
      : undefined;
    const parentRoom = parentId !== undefined ? sim.dungeon.rooms[parentId] : undefined;
    sim.secretWallBroken = true;
    if (parentRoom) parentRoom.secretWallBroken = true;
    Object.assign(secretRoom, {
      secretWallBroken: true,
      discovery: 'discovered',
      chestRarity: 'epic',
      chestOpened: false,
      secretTrialAttempted: false,
      secretTrialWon: false,
    });

    sim.enterRoom(secretRoom.id, parentRoom?.secretWallDir);
    sim.selectCharacter(sim.player.id, 'ranger');
    sim.player.godMode = true;
    sim.player.gold = 120;
    sim.pickups.length = 0;

    const crystal = sim.npcEntities.find((n) => n.kind === 'secret_challenge_crystal')!;
    Object.assign(sim.player, {
      x: crystal.x,
      y: crystal.y + 12,
      prevX: crystal.x,
      prevY: crystal.y + 12,
    });
    sim.interactWithNearest(sim.player);
    sim.consumeEvents();
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 84);

  await page.evaluate((aim) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;

    const trialCandidates = sim.enemies.filter((e) => e.secretTrialEnemy && e.hp > 0);
    const chosen =
      trialCandidates.find((e) => e.isElite && e.defId === 'wild_boar') ??
      trialCandidates.find((e) => e.isElite) ??
      trialCandidates[0] ??
      sim.spawnEnemy('wild_boar', cx + 68, cy - 6, false, 'giant');

    Object.assign(chosen, {
      secretTrialEnemy: true,
      isElite: true,
      eliteModifier: 'giant',
      shieldArmor: 0,
      x: cx + 68,
      y: cy - 6,
      prevX: cx + 68,
      prevY: cy - 6,
      vx: 0,
      vy: 0,
      kbVx: 0,
      kbVy: 0,
      hp: 12,
      maxHp: 180,
      moveSpeed: 0,
      aiState: 'cooldown',
      stateTimer: 20.0,
      attackCooldownTimer: 99,
      spawnWarmupTimer: 0,
      aimAngle: Math.PI,
    });
    sim.enemies = [chosen];
    sim.secretTrialRemainingEnemies = 1;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;

    const tables = sim.props.filter((pr) => pr.hp > 0 && pr.kind === 'moss_table');
    if (tables[0]) {
      tables[0].x = cx - 98;
      tables[0].y = cy - 48;
      sim.flipCoverProp(tables[0], sim.player);
      tables[0].microBlankTimer = 0;
    }
    if (tables[1]) {
      tables[1].x = cx + 92;
      tables[1].y = cy + 52;
    }
    const barrel = sim.props.find((pr) => pr.hp > 0 && pr.kind === 'explosive_barrel');
    if (barrel) {
      barrel.x = cx + 104;
      barrel.y = cy - 44;
    }
    const keepPropIds = new Set(
      [tables[0]?.id, tables[1]?.id, barrel?.id].filter((id): id is number => id !== undefined),
    );
    sim.props = sim.props.filter(
      (pr) => (pr.kind !== 'moss_table' && pr.kind !== 'explosive_barrel') || keepPropIds.has(pr.id),
    );

    Object.assign(sim.player, {
      godMode: true,
      gold: 120,
      x: cx - 64,
      y: cy + 12,
      prevX: cx - 64,
      prevY: cy + 12,
      vx: 0,
      vy: 0,
      aimAngle: aim,
      aimWorldX: cx + 68,
      aimWorldY: cy - 6,
      weaponSlots: ['hunter_crossbow', 'tesla_carbine'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      clipAmmo: 4,
      clipMax: 4,
      reloadTimer: 0,
      fireCooldownTimer: 0,
      critChance: 0,
      blessingIds: [],
      duoBoonIds: [] as DuoBoonId[],
    });
    sim.consumeEvents();
  }, SECRET_TRIAL_AIM);

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 2);
  await page.evaluate(() => {
    window.__GAME_TRANSPORT__?.getSim().consumeEvents();
  });
  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

export const AP2_P4B_VISUAL_SCENES: readonly VisualSceneDef[] = [
  makeScene(
    'ap2-modal-duo-boon-card',
    'Vietnamese Floor Blessing Modal featuring Slot-3 Elemental Duo Boon card with Diamond-Rainbow Prismatic Border, intersecting elemental emblems, and HUD Duo Boon diamond chip',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2ModalDuoBoonCardScene,
  ),
  makeScene(
    'ap2-duo-magnetic-bastion-ring',
    'Phase P4B duo_magnetic_bastion_ring: Flipping 2nd barricade [E] within <= 220px ignites High-Voltage Magnetic Arc Grid searing crossing enemies at F5',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2DuoMagneticBastionRingScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: { simEventKind: 'damage_dealt', occurrence: 'first' },
      actionRoi: {
        width: 580,
        height: 360,
        includeProjectiles: 'none',
        propKinds: ['moss_table'],
        enemyKinds: ['wild_boar', 'goblin_shooter', 'green_slime'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'BARRICADE #1 ARMED' },
        stepInput(2, 'trigger', 'FLIP COVER [E]!', -0.35, -0.75, -0.32, { interact: true }),
        stepInput(3, 'active', 'ARC GRID IGNITED', -0.25, -0.85, -0.22),
        stepInput(2, 'active', 'CAPACITOR SURGE', 0.15, -0.85, -0.12),
        stepInput(1, 'apex', '220PX ARC SEAR!', 0.35, -0.65, -0.05),
        stepInput(5, 'sub_impact', 'HIGH-VOLT CHAIN', 0.45, -0.45, 0.05),
        stepInput(5, 'settled', 'BASTION RING HOLD', 0.35, -0.25, 0.1),
        stepInput(5, 'settled', 'SETTLED', 0.2, 0, 0.12),
      ],
    },
  ),
  makeScene(
    'ap2-duo-superheated-cyclone',
    'Phase P4B duo_superheated_cyclone: Frost orb triggers Vaporize on burning lead at F5, spawning a 140 px/s Superheated Cyclone that chases the enemy pack across F6-F8',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2DuoSuperheatedCycloneScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: { simEventKind: 'elemental_reaction', occurrence: 'first' },
      actionRoi: {
        width: 600,
        height: 360,
        includeProjectiles: 'player_and_parried',
        enemyKinds: ['wild_boar', 'goblin_shooter', 'goblin_shaman'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'BURNING PRIMER' },
        stepInput(2, 'trigger', 'FROST ORB FIRE!', 0.25, 0.45, 0, { fire: true }),
        stepInput(3, 'active', 'FROST ORB INBOUND', 0.35, 0.65, 0),
        stepInput(3, 'active', 'VAPORIZE CONTACT', 0.4, 0.65, 0),
        stepInput(1, 'apex', 'CYCLONE SPAWN!', 0.45, 0.6, 0.04),
        stepInput(9, 'sub_impact', '140PX/S VORTEX CHASE', 0.65, 0.55, 0.06),
        stepInput(10, 'settled', 'BOILING STEAM SEAR', 0.68, 0.4, 0.08),
        stepInput(10, 'settled', 'PACK ENGULFED', 0.78, 0, 0.1),
      ],
    },
  ),
  makeScene(
    'ap2-duo-plasma-overload-star',
    'Phase P4B duo_plasma_overload_star: Shock shot triggers Overload in sculpted narrow corridor -> 420 px/s 6-pointed Plasma Star ricochets off walls piercing staggered enemy line',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2DuoPlasmaOverloadStarScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'projectile_impact',
        simEventPredicate: (ev) => ev['hitWall'] === true,
        occurrence: 'first',
      },
      actionRoi: {
        width: 640,
        height: 360,
        includeProjectiles: 'player_and_parried',
        enemyKinds: ['wild_boar', 'goblin_shooter', 'goblin_shaman'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'CORRIDOR PRIMER' },
        stepInput(2, 'trigger', 'SHOCK SHOT!', 0.45, -0.35, PLASMA_CORRIDOR_AIM, { fire: true }),
        stepInput(4, 'active', 'OVERLOAD STAR LAUNCH', 0.65, -0.35, PLASMA_CORRIDOR_AIM),
        stepInput(4, 'active', 'STAR PIERCE #1!', 0.72, -0.3, -0.18),
        stepInput(2, 'apex', 'TOP WALL RICOCHET!', 0.75, -0.2, -0.05),
        stepInput(10, 'sub_impact', 'CORRIDOR PIERCE #2', 0.78, 0.1, 0.05),
        stepInput(6, 'settled', 'BOTTOM WALL BOUNCE!', 0.72, 0.25, 0.08),
        stepInput(9, 'settled', 'ZIG-ZAG PIERCE #3!', 0.6, 0, 0.06),
      ],
    },
  ),
  makeScene(
    'ap2-secret-arena-20s-trial',
    'Phase P4B Secret Skill Arena 20s: Live 20s top-center countdown HUD while slaying final Elite <20.0s at F5 ascends Epic Chest to glowing Legendary tier with +40 Gold Victory Banner',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2SecretArena20sTrialScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: { simEventKind: 'secret_trial_resolved' },
      actionRoi: {
        width: 620,
        height: 380,
        includeProjectiles: 'player_and_parried',
        propKinds: ['moss_table', 'explosive_barrel'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: '20S TRIAL · 1 LEFT' },
        stepInput(2, 'trigger', 'FINAL VOLLEY!', 0.35, -0.5, SECRET_TRIAL_AIM, { fire: true }),
        stepInput(4, 'active', 'BOLT PAST CHEST', 0.35, -0.5, SECRET_TRIAL_AIM),
        stepInput(3, 'active', 'ELITE TARGET LOCK', 0.35, -0.4, SECRET_TRIAL_AIM),
        stepInput(2, 'apex', 'LEGENDARY ASCEND!', 0.3, -0.3, SECRET_TRIAL_AIM),
        stepInput(4, 'sub_impact', '+40 GOLD VICTORY!', 0.35, -0.2, -0.1),
        stepInput(5, 'settled', 'GOLDEN CHEST GLOW', 0.3, -0.1, -0.05),
        stepInput(5, 'settled', 'SETTLED', 0.15, 0, 0),
      ],
    },
  ),
];
