import type { EnemyDefId } from '@ashen-pact/shared';
import type { Page } from '@playwright/test';
import {
  DEFAULT_GAME_URL,
  lockCameraAndIrisToPlayer,
  makeScene,
  markPostWarmupStart,
  queueStepInput,
  stepDeterministicFrames,
  triggerDash,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const AP2_P4A_SCENE_IDS: readonly string[] = [
  'ap2-p4a-wall-tether-pylons',
  'ap2-p4a-orbit-return-bullets',
  'ap2-p4a-thunder-decoy-dash',
  'ap2-p4a-holo-decoy-mutator',
] as const;

export const AP2_P4A_SCENE_GROUP = AP2_P4A_SCENE_IDS;

interface CleanArenaConfig {
  minTx: number;
  maxTx: number;
  minTy: number;
  maxTy: number;
  corridorWallRows?: readonly number[];
  enemies: readonly { defId: EnemyDefId; x: number; y: number; hp: number }[];
}

async function prepareCleanP4AArena(page: Page, cfg: CleanArenaConfig): Promise<void> {
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
        maxHp: sp.hp,
        moveSpeed: 0,
        aiState: 'cooldown',
        stateTimer: 20.0,
        attackCooldownTimer: 99,
        aimAngle: Math.PI,
        vx: 0,
        vy: 0,
      });
    }
  }, cfg);
}

const WALL_TETHER_AIM = Math.atan2(352 - 224, 466 - 368);

export async function setupAp2P4AWallTetherPylonsScene(page: Page): Promise<void> {
  await prepareCleanP4AArena(page, {
    minTx: 8,
    maxTx: 21,
    minTy: 3,
    maxTy: 13,
    corridorWallRows: [5, 11],
    enemies: [
      { defId: 'wild_boar', x: 462, y: 248, hp: 420 },
      { defId: 'goblin_shooter', x: 466, y: 296, hp: 420 },
    ],
  });

  await page.evaluate((aimAngle) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.selectCharacter(sim.player.id, 'engineer');
    Object.assign(sim.player, {
      godMode: true,
      x: 368,
      y: 224,
      prevX: 368,
      prevY: 224,
      vx: 0,
      vy: 0,
      aimAngle,
      aimWorldX: 466,
      aimWorldY: 352,
      weaponSlots: ['hunter_crossbow', 'rivet_gun'],
      activeWeaponSlot: 0,
      clipAmmo: 4,
      clipMax: 4,
      reloadTimer: 0,
      reloadDuration: 0.95,
      fireCooldownTimer: 0,
      overclockedNextShot: true,
      critChance: 0,
      blessingIds: ['bullet_wall_tether'],
    });
  }, WALL_TETHER_AIM);

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 36);

  await page.evaluate((aimAngle) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      x: 368,
      y: 224,
      prevX: 368,
      prevY: 224,
      vx: 0,
      vy: 0,
      aimAngle,
      aimWorldX: 466,
      aimWorldY: 352,
      clipAmmo: 4,
      clipMax: 4,
      reloadTimer: 0,
      fireCooldownTimer: 0,
      overclockedNextShot: true,
    });
    sim.summons.length = 0;
    sim.summons.push({
      id: ++sim.nextEntityId,
      ownerPlayerId: sim.player.id,
      kind: 'wall_tether_pylon',
      nameVi: 'Cọc Điện Cao Thế',
      x: 464,
      y: 202,
      radius: 10,
      auraRadius: 360,
      hp: 999,
      maxHp: 999,
      ttlSec: 4.5,
      maxTtlSec: 4.5,
      tickTimer: 0.25,
      fenceTickTimer: 1 / 60,
      healsRemaining: 0,
      charge: 0,
      poisonRoots: false,
      selfDestruct: false,
      rootedEnemyIds: [],
    });
    sim.consumeEvents();
  }, WALL_TETHER_AIM);

  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

export async function setupAp2P4AOrbitReturnBulletsScene(page: Page): Promise<void> {
  await prepareCleanP4AArena(page, {
    minTx: 6,
    maxTx: 24,
    minTy: 2,
    maxTy: 14,
    enemies: [
      { defId: 'goblin_shooter', x: 588, y: 262, hp: 440 },
      { defId: 'wild_boar', x: 516, y: 274, hp: 440 },
    ],
  });

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.selectCharacter(sim.player.id, 'ranger');
    Object.assign(sim.player, {
      godMode: true,
      x: 366,
      y: 242,
      prevX: 366,
      prevY: 242,
      vx: 0,
      vy: 0,
      aimAngle: -0.15,
      weaponSlots: ['scrap_shotgun', 'rivet_gun'],
      activeWeaponSlot: 0,
      clipAmmo: 2,
      clipMax: 2,
      reloadTimer: 0,
      reloadDuration: 0.85,
      fireCooldownTimer: 0,
      overclockedNextShot: false,
      critChance: 0,
      blessingIds: ['bullet_orbit_return'],
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 36);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      x: 366,
      y: 242,
      prevX: 366,
      prevY: 242,
      vx: 0,
      vy: 0,
      aimAngle: -0.15,
      clipAmmo: 2,
      clipMax: 2,
      reloadTimer: 0,
      fireCooldownTimer: 0,
      overclockedNextShot: false,
    });
    sim.consumeEvents();
  });

  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

export async function setupAp2P4AThunderDecoyDashScene(page: Page): Promise<void> {
  await prepareCleanP4AArena(page, {
    minTx: 7,
    maxTx: 23,
    minTy: 3,
    maxTy: 13,
    enemies: [
      { defId: 'wild_boar', x: 476, y: 238, hp: 420 },
      { defId: 'green_slime', x: 482, y: 304, hp: 420 },
      { defId: 'goblin_shooter', x: 544, y: 246, hp: 420 },
      { defId: 'goblin_shooter', x: 544, y: 298, hp: 420 },
    ],
  });

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.selectCharacter(sim.player.id, 'elementalist');
    Object.assign(sim.player, {
      godMode: true,
      x: 436,
      y: 272,
      prevX: 436,
      prevY: 272,
      vx: 0,
      vy: 0,
      aimAngle: 0,
      dashTimer: 0,
      dashCooldownTimer: 0,
      blessingIds: ['dash_thunder_decoy'],
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 36);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      x: 436,
      y: 272,
      prevX: 436,
      prevY: 272,
      vx: 0,
      vy: 0,
      aimAngle: 0,
      dashTimer: 0,
      dashCooldownTimer: 0,
    });
    sim.projectiles.length = 0;
    const shooterId = sim.enemies[2]?.id ?? 999;
    for (const sp of [
      { x: 509.5, y: 272, vx: -240, vy: 0 },
      { x: 522.0, y: 254, vx: -236, vy: 42 },
      { x: 524.0, y: 290, vx: -236, vy: -42 },
    ]) {
      sim.projectiles.push({
        id: ++sim.nextEntityId,
        ownerId: shooterId,
        team: 'enemy',
        weaponId: 'goblin_shooter',
        prevX: sp.x,
        prevY: sp.y,
        x: sp.x,
        y: sp.y,
        vx: sp.vx,
        vy: sp.vy,
        angle: Math.atan2(sp.vy, sp.vx),
        radius: 5.5,
        damage: 1,
        isCrit: false,
        knockback: 40,
        pierceRemaining: 0,
        bounceRemaining: 0,
        ttlSec: 2.0,
        element: 'none',
        amplifiedByShield: false,
        hitEntityIds: [],
      });
    }
    sim.consumeEvents();
  });

  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

export async function setupAp2P4AHoloDecoyMutatorScene(page: Page): Promise<void> {
  await prepareCleanP4AArena(page, {
    minTx: 7,
    maxTx: 23,
    minTy: 3,
    maxTy: 13,
    enemies: [
      { defId: 'wild_boar', x: 506, y: 266, hp: 460 },
      { defId: 'goblin_shooter', x: 538, y: 296, hp: 460 },
    ],
  });

  const aimAngle = Math.atan2(266 - 236, 506 - 374);
  await page.evaluate((aim) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.selectCharacter(sim.player.id, 'ranger');
    Object.assign(sim.player, {
      godMode: true,
      x: 374,
      y: 236,
      prevX: 374,
      prevY: 236,
      vx: 0,
      vy: 0,
      aimAngle: aim,
      aimWorldX: 506,
      aimWorldY: 266,
      weaponSlots: ['tesla_carbine', 'rivet_gun'],
      activeWeaponSlot: 0,
      weaponMutators: { 0: ['mutator_holo_decoy_gun'], 1: [] },
      clipAmmo: 0,
      clipMax: 8,
      reloadDuration: 1.0,
      reloadTimer: 0.46,
      reloadLockout: false,
      fireCooldownTimer: 0,
      critChance: 0,
      blessingIds: [],
    });
  }, aimAngle);

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 36);

  await page.evaluate((aim) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      x: 374,
      y: 236,
      prevX: 374,
      prevY: 236,
      vx: 0,
      vy: 0,
      aimAngle: aim,
      aimWorldX: 506,
      aimWorldY: 266,
      clipAmmo: 0,
      clipMax: 8,
      reloadDuration: 1.0,
      reloadTimer: 0.46,
      reloadLockout: false,
      fireCooldownTimer: 0,
    });
    sim.summons.length = 0;
    sim.consumeEvents();
  }, aimAngle);

  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

export const AP2_P4A_VISUAL_SCENES: readonly VisualSceneDef[] = [
  makeScene(
    'ap2-p4a-wall-tether-pylons',
    'Phase P4A bullet_wall_tether: Overclocked shot plants Pylon #2 on south corridor wall at F5, snapping the crackling Electric Cutter Wire across enemies between twin pylons',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2P4AWallTetherPylonsScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: { simEventKind: 'summon_spawned' },
      actionRoi: { width: 540, height: 360, includeProjectiles: 'player_and_parried', enemyKinds: ['wild_boar', 'goblin_shooter'] },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'PYLON #1 ARMED' },
        { stepCount: 2, stage: 'trigger', label: 'OVERCLOCKED SHOT!', beforeStep: (p) => queueStepInput(p, { fire: true, moveX: -0.65, moveY: 0.45, aimAngle: WALL_TETHER_AIM, durationTicks: 2 }) },
        { stepCount: 6, stage: 'active', label: 'BOLT IN FLIGHT', beforeStep: (p) => queueStepInput(p, { moveX: -0.65, moveY: 0.45, aimAngle: WALL_TETHER_AIM, durationTicks: 6 }) },
        { stepCount: 6, stage: 'active', label: 'SOUTH WALL NEAR', beforeStep: (p) => queueStepInput(p, { moveX: -0.6, moveY: 0.4, aimAngle: WALL_TETHER_AIM, durationTicks: 6 }) },
        { stepCount: 1, stage: 'apex', label: 'CUTTER WIRE SNAP!', beforeStep: (p) => queueStepInput(p, { moveX: -0.5, moveY: 0.35, aimAngle: WALL_TETHER_AIM, durationTicks: 1 }) },
        { stepCount: 4, stage: 'sub_impact', label: 'SHOCK SEAR ARC', beforeStep: (p) => queueStepInput(p, { moveX: -0.45, moveY: 0.25, aimAngle: 0, durationTicks: 4 }) },
        { stepCount: 5, stage: 'settled', label: 'TWIN PYLON FENCE', beforeStep: (p) => queueStepInput(p, { moveX: -0.35, moveY: 0.15, aimAngle: 0, durationTicks: 5 }) },
        { stepCount: 5, stage: 'settled', label: 'SETTLED', beforeStep: (p) => queueStepInput(p, { moveX: -0.25, moveY: 0, aimAngle: 0, durationTicks: 5 }) },
      ],
    },
  ),
  makeScene(
    'ap2-p4a-orbit-return-bullets',
    'Phase P4A bullet_orbit_return: Ranged volley reaches max range behind enemies and curves 180 degrees back at F5 with emerald-jade boomerang wakes toward strafing player',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2P4AOrbitReturnBulletsScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: { simEventKind: 'bullet_volley_spawned', occurrence: 'last' },
      actionRoi: { width: 680, height: 400, includeProjectiles: 'player_and_parried', enemyKinds: ['goblin_shooter', 'wild_boar'] },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'AIM PAST PACK' },
        { stepCount: 3, stage: 'trigger', label: 'FIRE & STRAFE!', beforeStep: (p) => queueStepInput(p, { fire: true, moveX: 0.42, moveY: 0.36, aimAngle: -0.15, durationTicks: 3 }) },
        { stepCount: 15, stage: 'active', label: 'FLANKING VOLLEY', beforeStep: (p) => queueStepInput(p, { moveX: 0.42, moveY: 0.36, aimAngle: -0.06, durationTicks: 15 }) },
        { stepCount: 14, stage: 'active', label: 'MAX RANGE APEX', beforeStep: (p) => queueStepInput(p, { moveX: 0.38, moveY: 0.34, aimAngle: -0.04, durationTicks: 14 }) },
        { stepCount: 2, stage: 'apex', label: '180° ORBIT RETURN!', beforeStep: (p) => queueStepInput(p, { moveX: 0.25, moveY: 0.22, aimAngle: -0.04, durationTicks: 2 }) },
        { stepCount: 6, stage: 'sub_impact', label: 'POISON BACKSTAB!', beforeStep: (p) => queueStepInput(p, { moveX: 0.15, moveY: 0.14, aimAngle: -0.05, durationTicks: 6 }) },
        { stepCount: 6, stage: 'settled', label: 'JADE WAKE SLICE', beforeStep: (p) => queueStepInput(p, { moveX: 0.1, moveY: 0.08, aimAngle: -0.06, durationTicks: 6 }) },
        { stepCount: 6, stage: 'settled', label: 'SETTLED', beforeStep: (p) => queueStepInput(p, { moveX: 0.06, moveY: 0, aimAngle: -0.06, durationTicks: 6 }) },
      ],
    },
  ),
  makeScene(
    'ap2-p4a-thunder-decoy-dash',
    'Phase P4A dash_thunder_decoy: Player dashes out of incoming #E84545 enemy fire leaving Thunder Decoy behind; bullet contact at F5 detonates r=88px Shock Nova',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2P4AThunderDecoyDashScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: { simEventKind: 'explosion' },
      actionRoi: { width: 580, height: 360, includeProjectiles: 'all_focused', enemyKinds: ['wild_boar', 'green_slime', 'goblin_shooter'] },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'INCOMING #E84545!' },
        { stepCount: 3, stage: 'trigger', label: 'DASH & DROP DECOY!', beforeStep: (p) => triggerDash(p, -1, -0.32, 0, 3) },
        { stepCount: 4, stage: 'active', label: 'TAUNT CONVERGE', beforeStep: (p) => queueStepInput(p, { moveX: -0.6, moveY: -0.2, aimAngle: 0, durationTicks: 4 }) },
        { stepCount: 3, stage: 'active', label: 'CONTACT IMMINENT', beforeStep: (p) => queueStepInput(p, { moveX: -0.4, moveY: 0.15, aimAngle: 0, durationTicks: 3 }) },
        { stepCount: 1, stage: 'apex', label: '88PX SHOCK NOVA!', beforeStep: (p) => queueStepInput(p, { moveX: -0.25, moveY: 0.25, aimAngle: 0, durationTicks: 1 }) },
        { stepCount: 3, stage: 'sub_impact', label: 'BULLETS CLEARED', beforeStep: (p) => queueStepInput(p, { moveX: 0.2, moveY: 0.25, aimAngle: 0, durationTicks: 3 }) },
        { stepCount: 4, stage: 'settled', label: 'SHOCKED PACK', beforeStep: (p) => queueStepInput(p, { moveX: 0.25, moveY: 0.15, aimAngle: 0, durationTicks: 4 }) },
        { stepCount: 4, stage: 'settled', label: 'SETTLED', beforeStep: (p) => queueStepInput(p, { moveX: 0.15, moveY: 0, aimAngle: 0, durationTicks: 4 }) },
      ],
    },
  ),
  makeScene(
    'ap2-p4a-holo-decoy-mutator',
    'Phase P4A mutator_holo_decoy_gun: Perfect Reload [R] inside Golden Window spawns cyan Holo-Decoy Turret while player repositions laterally for synchronized F5 crossfire volleys',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2P4AHoloDecoyMutatorScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: { simEventKind: 'bullet_volley_spawned', occurrence: 'first' },
      actionRoi: { width: 540, height: 360, includeProjectiles: 'player_and_parried', enemyKinds: ['wild_boar', 'goblin_shooter'] },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'GOLDEN WINDOW [R]' },
        { stepCount: 2, stage: 'trigger', label: 'PERFECT RELOAD!', beforeStep: (p) => queueStepInput(p, { reloadVent: true, moveX: 0.08, moveY: 1, aimWorldX: 506, aimWorldY: 266, aimAngle: 0.2, durationTicks: 2 }) },
        { stepCount: 9, stage: 'active', label: 'FLANK REPOSITION', beforeStep: (p) => queueStepInput(p, { moveX: 0.08, moveY: 1, aimWorldX: 506, aimWorldY: 266, aimAngle: -0.05, durationTicks: 9 }) },
        { stepCount: 8, stage: 'active', label: 'DECOY TARGET LOCK', beforeStep: (p) => queueStepInput(p, { moveX: 0.06, moveY: 0.9, aimWorldX: 506, aimWorldY: 266, aimAngle: -0.22, durationTicks: 8 }) },
        { stepCount: 2, stage: 'apex', label: 'SYNC CROSSFIRE!', beforeStep: (p) => queueStepInput(p, { fire: true, moveX: 0.05, moveY: 0.35, aimWorldX: 506, aimWorldY: 266, aimAngle: -0.26, durationTicks: 2 }) },
        { stepCount: 4, stage: 'sub_impact', label: 'TWIN VOLLEY HIT!', beforeStep: (p) => queueStepInput(p, { moveX: 0.1, moveY: -0.1, aimWorldX: 506, aimWorldY: 266, aimAngle: -0.24, durationTicks: 4 }) },
        { stepCount: 5, stage: 'settled', label: 'CROSSFIRE PRESSURE', beforeStep: (p) => queueStepInput(p, { moveX: 0.1, moveY: -0.15, aimWorldX: 506, aimWorldY: 266, aimAngle: -0.2, durationTicks: 5 }) },
        { stepCount: 5, stage: 'settled', label: 'SETTLED', beforeStep: (p) => queueStepInput(p, { moveX: 0, moveY: -0.08, aimWorldX: 506, aimWorldY: 266, aimAngle: -0.18, durationTicks: 5 }) },
      ],
    },
  ),
];
