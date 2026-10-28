import type { Page } from '@playwright/test';
import type { WeaponDefId } from '@ashen-pact/shared';
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
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const AP2_P2B_SCENE_IDS: readonly string[] = [
  'ap2-shrine-ashen-altar',
  'ap2-modal-ashen-pact-vi',
  'ap2-modal-ashen-pact-en',
  'ap2-pact-soul-chain-stretch',
  'ap2-pact-ashen-executioner',
  'ap2-relic-awakening-banner',
] as const;

export const AP2_P2B_SCENE_GROUP = AP2_P2B_SCENE_IDS;

/** 1. ap2-shrine-ashen-altar (Static Scene + captureUnlit: true in Odd-Floor Shrine room) */
export async function setupAp2ShrineAshenAltarScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 1;
    sim.map.biome = 1;

    const room = sim.dungeon.rooms.find((r) => r.type === 'shrine') ?? sim.dungeon.rooms[0]!;
    room.type = 'shrine';
    room.cleared = true;
    room.shrineUsed = false;
    room.shrineUsedByPlayerIds = [];
    sim.initializedRoomIds.delete(room.id);
    sim.enterRoom(room.id);
    sim.consumeEvents();

    const shrine = sim.npcEntities.find((n) => n.kind === 'shrine');
    if (shrine) {
      shrine.interacted = false;
      shrine.usedByPlayerIds = [];
      shrine.costGold = 0;
      shrine.costHp = 0;
    }
    const sx = shrine?.x ?? sim.map.width * 0.5;
    const sy = shrine?.y ?? sim.map.height * 0.5 - 18;

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true,
      x: sx - 32,
      y: sy + 20,
      prevX: sx - 32,
      prevY: sy + 20,
      vx: 0,
      vy: 0,
      aimAngle: -0.45,
      weaponSlots: ['hunter_crossbow', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      activePactId: null,
      awakenedRelicIds: [],
      pactChoices: [],
    });
  });
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 45);
}

/** 2. ap2-modal-ashen-pact-vi (Static Scene: Vietnamese Ashen Pact Altar Modal) */
export async function setupAp2ModalAshenPactViScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 1;
    sim.map.biome = 1;

    const room = sim.dungeon.rooms.find((r) => r.type === 'shrine') ?? sim.dungeon.rooms[0]!;
    room.type = 'shrine';
    room.cleared = true;
    room.shrineUsed = true;
    room.shrineUsedByPlayerIds = [sim.player.id];
    sim.initializedRoomIds.delete(room.id);
    sim.enterRoom(room.id);
    sim.consumeEvents();

    const shrine = sim.npcEntities.find((n) => n.kind === 'shrine');
    const sx = shrine?.x ?? sim.map.width * 0.5;
    const sy = shrine?.y ?? sim.map.height * 0.5 - 18;

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true,
      x: sx - 32,
      y: sy + 20,
      prevX: sx - 32,
      prevY: sy + 20,
      vx: 0,
      vy: 0,
      aimAngle: -0.45,
      activePactId: null,
      awakenedRelicIds: [],
      pactChoices: ['pact_soul_chain', 'pact_shattered_glass'],
    });
    sim.runState = 'playing';

    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          lastRunState?: string;
          lastHudHp?: number;
          invalidateAllHudCaches?: () => void;
        }
      | undefined;
    if (gs) {
      gs.lastRunState = '';
      gs.lastHudHp = -1;
      gs.invalidateAllHudCaches?.();
    }
  });
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 45);
}

/** 3. ap2-modal-ashen-pact-en (Static Scene: English Ashen Pact Altar Modal) */
export async function setupAp2ModalAshenPactEnScene(page: Page): Promise<void> {
  await switchGameSceneToEnglish(page);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 1;
    sim.map.biome = 1;

    const room = sim.dungeon.rooms.find((r) => r.type === 'shrine') ?? sim.dungeon.rooms[0]!;
    room.type = 'shrine';
    room.cleared = true;
    room.shrineUsed = true;
    room.shrineUsedByPlayerIds = [sim.player.id];
    sim.initializedRoomIds.delete(room.id);
    sim.enterRoom(room.id);
    sim.consumeEvents();

    const shrine = sim.npcEntities.find((n) => n.kind === 'shrine');
    const sx = shrine?.x ?? sim.map.width * 0.5;
    const sy = shrine?.y ?? sim.map.height * 0.5 - 18;

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true,
      x: sx - 32,
      y: sy + 20,
      prevX: sx - 32,
      prevY: sy + 20,
      vx: 0,
      vy: 0,
      aimAngle: -0.45,
      activePactId: null,
      awakenedRelicIds: [],
      pactChoices: ['pact_ashen_hunted', 'pact_ricochet_vow'],
    });
    sim.runState = 'playing';

    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          lastRunState?: string;
          lastHudHp?: number;
          invalidateAllHudCaches?: () => void;
        }
      | undefined;
    if (gs) {
      gs.lastRunState = '';
      gs.lastHudHp = -1;
      gs.invalidateAllHudCaches?.();
    }
  });
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 45);
}

/** 4. ap2-pact-soul-chain-stretch (8-frame strip: Soul Chain stretched >260px drains 1 Armor at 2.5s) */
export async function setupAp2PactSoulChainStretchScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 1;
    sim.map.biome = 1;

    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    room.type = 'combat';
    room.cleared = true;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();

    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.props.length = 0;

    sim.spawnProp('torch_brazier', 340, 190);
    sim.spawnProp('torch_brazier', 640, 190);
    sim.spawnProp('torch_brazier', 340, 360);
    sim.spawnProp('torch_brazier', 640, 360);

    const boar = sim.spawnEnemy('wild_boar', 368, 250, true);
    boar.hp = 500;
    boar.maxHp = 500;
    boar.moveSpeed = 0;
    boar.aiState = 'idle';
    boar.stateTimer = 999;
    boar.attackCooldownTimer = 999;

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: false,
      hp: 100,
      maxHp: 100,
      armor: 4,
      maxArmor: 4,
      x: 618,
      y: 330,
      prevX: 618,
      prevY: 330,
      vx: 0,
      vy: 0,
      aimAngle: -2.8,
      activePactId: 'pact_soul_chain',
      awakenedRelicIds: [],
      soulChainTargetId: boar.id,
      soulChainTargetKind: 'enemy',
      soulChainStretchTimer: 1.2,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const boar = sim.enemies[0];
    if (boar) {
      boar.x = 368;
      boar.y = 250;
      boar.vx = 0;
      boar.vy = 0;
      boar.moveSpeed = 0;
      boar.aiState = 'idle';
      boar.stateTimer = 999;
      boar.attackCooldownTimer = 999;
    }
    Object.assign(sim.player, {
      x: 618,
      y: 330,
      prevX: 618,
      prevY: 330,
      vx: 0,
      vy: 0,
      armor: 4,
      maxArmor: 4,
      soulChainStretchTimer: 2.5 - 12 / 60,
    });
    sim.consumeEvents();
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 2);
  await markPostWarmupStart(page);
}

/** 5. ap2-pact-ashen-executioner (8-frame strip: Bóng Ma Đao Phủ telegraphs & fires Dark Flame Wave) */
export async function setupAp2PactAshenExecutionerScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 1;
    sim.map.biome = 1;

    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    room.type = 'combat';
    room.cleared = false;
    room.wavesSpawned = 1;
    room.wavesTotal = 1;
    sim.enterRoom(room.id);
    sim.consumeEvents();

    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.props.length = 0;

    sim.spawnProp('torch_brazier', 380, 190);
    sim.spawnProp('torch_brazier', 620, 190);
    sim.spawnProp('torch_brazier', 380, 350);
    sim.spawnProp('torch_brazier', 620, 350);

    const anchorEnemy = sim.spawnEnemy('thorn_turret', 660, 210, true);
    anchorEnemy.hp = 999;
    anchorEnemy.maxHp = 999;
    anchorEnemy.attackCooldownTimer = 999;
    anchorEnemy.stateTimer = 999;

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true,
      x: 456,
      y: 292,
      prevX: 456,
      prevY: 292,
      vx: 0,
      vy: 0,
      aimAngle: -0.24,
      dashTimer: 0,
      dashCooldownTimer: 0,
      activePactId: 'pact_ashen_hunted',
      awakenedRelicIds: [],
    });

    const exec = sim.spawnEnemy('ashen_executioner', 556, 268, true);
    exec.hp = 9999;
    exec.maxHp = 9999;
    exec.aiState = 'chase';
    exec.stateTimer = 0;
    exec.attackCooldownTimer = 10;
    exec.executionerTargetPlayerId = sim.player.id;
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      x: 456,
      y: 292,
      prevX: 456,
      prevY: 292,
      vx: 0,
      vy: 0,
      aimAngle: -0.24,
      dashTimer: 0,
      dashCooldownTimer: 0,
    });
    const exec = sim.enemies.find((e) => e.defId === 'ashen_executioner');
    if (exec) {
      exec.x = 556;
      exec.y = 268;
      exec.vx = 0;
      exec.vy = 0;
      exec.aiState = 'telegraph';
      exec.stateTimer = 9 / 60;
      exec.telegraphDurationSec = 0.45;
      exec.telegraphAngle = Math.atan2(sim.player.y - exec.y, sim.player.x - exec.x);
      exec.telegraphRadius = 14;
      exec.telegraphLength = 260;
    }
    sim.consumeEvents();
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 2);
  await markPostWarmupStart(page);
}

/** 6. ap2-relic-awakening-banner (8-frame strip: Boss defeat purifies Pact into Awakened Relic + Banner) */
export async function setupAp2RelicAwakeningBannerScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 2;
    sim.map.biome = 1;

    const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss') ?? sim.dungeon.rooms[0]!;
    bossRoom.type = 'boss';
    bossRoom.cleared = false;
    sim.initializedRoomIds.delete(bossRoom.id);
    sim.roomChestsByRoomId.delete(bossRoom.id);
    sim.roomItemsByRoomId.delete(bossRoom.id);
    sim.enterRoom(bossRoom.id);
    sim.consumeEvents();

    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.portalActive = false;

    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;

    let boss = sim.enemies.find((e) => e.isBoss);
    if (!boss) {
      boss = sim.spawnEnemy('spore_king', cx + 44, cy, false);
    }
    sim.enemies.length = 0;
    sim.enemies.push(boss);

    Object.assign(boss, {
      x: cx + 44,
      y: cy,
      vx: 0,
      vy: 0,
      kbVx: 0,
      kbVy: 0,
      hp: 5,
      maxHp: 1200,
      bossPhase: 3,
      bossPhaseTransitionTimer: 0,
      moveSpeed: 0,
      aiState: 'idle',
      stateTimer: 999,
      attackCooldownTimer: 999,
      stunTimer: 999,
    });

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true,
      x: cx - 64,
      y: cy,
      prevX: cx - 64,
      prevY: cy,
      vx: 0,
      vy: 0,
      aimAngle: 0,
      critChance: 0,
      weaponSlots: ['tesla_carbine', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      clipAmmo: 8,
      clipMax: 8,
      reloadTimer: 0,
      reloadLockout: false,
      weaponHeat: 0,
      overheatLockTimer: 0,
      fireCooldownTimer: 0,
      activePactId: 'pact_ashen_hunted',
      awakenedRelicIds: [],
      tookDamageInCurrentRoom: true,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;
    const boss = sim.enemies.find((e) => e.isBoss);
    if (boss) {
      boss.x = cx + 44;
      boss.y = cy;
      boss.vx = 0;
      boss.vy = 0;
      boss.hp = 5;
      boss.maxHp = 1200;
      boss.moveSpeed = 0;
      boss.aiState = 'idle';
      boss.stateTimer = 999;
      boss.attackCooldownTimer = 999;
      boss.stunTimer = 999;
    }
    Object.assign(sim.player, {
      x: cx - 64,
      y: cy,
      prevX: cx - 64,
      prevY: cy,
      vx: 0,
      vy: 0,
      aimAngle: 0,
      clipAmmo: 8,
      clipMax: 8,
      reloadTimer: 0,
      reloadLockout: false,
      weaponHeat: 0,
      overheatLockTimer: 0,
      fireCooldownTimer: 0,
      activePactId: 'pact_ashen_hunted',
      awakenedRelicIds: [],
      tookDamageInCurrentRoom: true,
    });
    sim.consumeEvents();
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 2);
  await markPostWarmupStart(page);
}

export const AP2_P2B_VISUAL_SCENES: readonly VisualSceneDef[] = [
  makeScene(
    'ap2-shrine-ashen-altar',
    'Odd-Floor Shrine Room featuring the obsidian-crimson-gold Ashen Pact Altar and [E] Tế Đàn Khế Ước Tro Tàn prompt',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2ShrineAshenAltarScene,
    {
      captureUnlit: true,
    },
  ),
  makeScene(
    'ap2-modal-ashen-pact-vi',
    'Vietnamese Ashen Pact Altar Modal displaying 2 two-half Trial/Awakened Relic cards and [3] Khước Từ Khế Ước button',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2ModalAshenPactViScene,
  ),
  makeScene(
    'ap2-modal-ashen-pact-en',
    'English Ashen Pact Altar Modal (ASHEN PACT ALTAR) displaying [FULL-BIOME TRIAL], [★ AWAKENED RELIC], and [3] Decline Pact',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2ModalAshenPactEnScene,
  ),
  makeScene(
    'ap2-pact-soul-chain-stretch',
    'Player with pact_soul_chain stretched beyond 260px draining 1 Armor at 2.5s with crimson warning chain and drain spark',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2PactSoulChainStretchScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['damage_dealt'],
      },
      actionRoi: {
        includeProjectiles: 'none',
        enemyKinds: ['wild_boar'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'CHAIN >260PX' },
        {
          stepCount: 3,
          stage: 'trigger',
          label: 'STRETCH 88%',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 0.25, moveY: -1, aimAngle: -2.8, durationTicks: 3 }),
        },
        {
          stepCount: 3,
          stage: 'active',
          label: 'STRETCH 93%',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 0.25, moveY: -1, aimAngle: -2.8, durationTicks: 3 }),
        },
        {
          stepCount: 3,
          stage: 'active',
          label: 'STRETCH 98%',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 0.25, moveY: -1, aimAngle: -2.8, durationTicks: 3 }),
        },
        {
          stepCount: 1,
          stage: 'apex',
          label: '-1 ARMOR DRAIN!',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 0.25, moveY: -1, aimAngle: -2.8, durationTicks: 1 }),
        },
        {
          stepCount: 3,
          stage: 'sub_impact',
          label: 'DRAIN SPARKS',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 0.2, moveY: -1, aimAngle: -2.9, durationTicks: 3 }),
        },
        {
          stepCount: 3,
          stage: 'settled',
          label: 'CHAIN TAUT',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 0.2, moveY: -1, aimAngle: -2.9, durationTicks: 3 }),
        },
        {
          stepCount: 3,
          stage: 'settled',
          label: 'SETTLED',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 0.2, moveY: -1, aimAngle: -2.9, durationTicks: 3 }),
        },
      ],
    },
  ),
  makeScene(
    'ap2-pact-ashen-executioner',
    'Player with pact_ashen_hunted stalked by Bóng Ma Đao Phủ telegraphing and unleashing Dark Flame Wave while player dashes laterally',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2PactAshenExecutionerScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['bullet_volley_spawned', 'projectile_spawned'],
      },
      actionRoi: {
        includeProjectiles: 'none',
        enemyKinds: ['ashen_executioner'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'SCYTHE TELEGRAPH' },
        {
          stepCount: 3,
          stage: 'trigger',
          label: 'STALK & CLEAVE',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: -0.2, moveY: -0.8, aimAngle: -0.2, durationTicks: 3 }),
        },
        {
          stepCount: 3,
          stage: 'active',
          label: 'EVADE DASH!',
          beforeStep: (page) => triggerDash(page, -0.15, -1, -0.15, 3),
        },
        { stepCount: 1, stage: 'active', label: 'MID-DASH' },
        { stepCount: 1, stage: 'apex', label: 'DARK FLAME WAVE!' },
        { stepCount: 2, stage: 'sub_impact', label: 'CRESCENT SLICE' },
        {
          stepCount: 3,
          stage: 'settled',
          label: 'WAVE PASSES',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 0.4, moveY: -0.4, aimAngle: 0.1, durationTicks: 3 }),
        },
        {
          stepCount: 3,
          stage: 'settled',
          label: 'SETTLED',
          beforeStep: (page) =>
            queueStepInput(page, { moveX: 0.4, moveY: 0, aimAngle: 0.1, durationTicks: 3 }),
        },
      ],
    },
  ),
  makeScene(
    'ap2-relic-awakening-banner',
    'Biome Boss defeat purifying active Ashen Pact into Awakened Relic with Golden Relic Awakening Banner, Legendary Chest, and HUD Relic Badge',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2RelicAwakeningBannerScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['relic_awakened'],
      },
      actionRoi: {
        includeProjectiles: 'player_and_parried',
        enemyKinds: ['spore_king'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'BOSS 1% HP' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'FINAL SHOT!',
          beforeStep: (page) => triggerFireWeapon(page, 0, 1),
        },
        { stepCount: 2, stage: 'active', label: 'BOLT FLIGHT 1' },
        { stepCount: 1, stage: 'active', label: 'BOLT FLIGHT 2' },
        { stepCount: 1, stage: 'apex', label: 'RELIC AWAKENED!' },
        {
          stepCount: 2,
          stage: 'sub_impact',
          label: 'GOLDEN BURST',
          beforeStep: (page) => queueStepInput(page, { moveX: 1, aimAngle: 0, durationTicks: 2 }),
        },
        {
          stepCount: 3,
          stage: 'settled',
          label: 'PORTAL & CHEST',
          beforeStep: (page) => queueStepInput(page, { moveX: 1, aimAngle: 0, durationTicks: 3 }),
        },
        {
          stepCount: 3,
          stage: 'settled',
          label: 'SETTLED',
          beforeStep: (page) => queueStepInput(page, { moveX: 0.5, aimAngle: 0, durationTicks: 3 }),
        },
      ],
    },
  ),
];
