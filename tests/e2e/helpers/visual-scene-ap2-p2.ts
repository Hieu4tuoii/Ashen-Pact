import type { Page } from '@playwright/test';
import type { WeaponDefId } from '@ashen-pact/shared';
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

export const AP2_P2A_SCENE_IDS: readonly string[] = [
  'ap2-treasure-forge-workshop',
  'ap2-modal-daedalus-mutator',
  'ap2-weapon-salvage-hold',
  'ap2-secret-wall-crack-break',
] as const;

export const AP2_P2A_SCENE_GROUP = AP2_P2A_SCENE_IDS;

/** 1. ap2-treasure-forge-workshop (Static Scene in Floor 1 Treasure Forge Workshop) */
export async function setupAp2TreasureForgeWorkshopScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 1;
    sim.map.biome = 1;

    const room = sim.dungeon.rooms.find((r) => r.type === 'treasure') ?? sim.dungeon.rooms[0]!;
    room.type = 'treasure';
    room.cleared = true;
    room.chestOpened = false;
    room.chestRarity = 'epic';
    room.chestWeaponId = 'hunter_crossbow';
    room.anvilUsedByPlayerIds = [];
    sim.initializedRoomIds.delete(room.id);
    sim.roomChestsByRoomId.delete(room.id);
    sim.roomItemsByRoomId.delete(room.id);
    sim.enterRoom(room.id);
    sim.consumeEvents();

    const anvil = sim.npcEntities.find((n) => n.kind === 'daedalus_anvil');
    const ax = anvil?.x ?? sim.map.width * 0.5 + 64;
    const ay = anvil?.y ?? sim.map.height * 0.5 - 12;

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true,
      x: ax - 36,
      y: ay + 16,
      prevX: ax - 36,
      prevY: ay + 16,
      vx: 0,
      vy: 0,
      aimAngle: -0.38,
      weaponSlots: ['hunter_crossbow', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      mutatorChoices: [],
    });
  });
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 45);
}

/** 2. ap2-modal-daedalus-mutator (Static Scene with Ancient Daedalus Anvil Modal open) */
export async function setupAp2ModalDaedalusMutatorScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 1;
    sim.map.biome = 1;

    const room = sim.dungeon.rooms.find((r) => r.type === 'treasure') ?? sim.dungeon.rooms[0]!;
    room.type = 'treasure';
    room.cleared = true;
    room.chestOpened = false;
    room.chestRarity = 'epic';
    room.chestWeaponId = 'hunter_crossbow';
    room.anvilUsedByPlayerIds = [];
    sim.initializedRoomIds.delete(room.id);
    sim.roomChestsByRoomId.delete(room.id);
    sim.roomItemsByRoomId.delete(room.id);
    sim.enterRoom(room.id);
    sim.consumeEvents();

    const anvil = sim.npcEntities.find((n) => n.kind === 'daedalus_anvil');
    const ax = anvil?.x ?? sim.map.width * 0.5 + 64;
    const ay = anvil?.y ?? sim.map.height * 0.5 - 12;

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true,
      x: ax - 36,
      y: ay + 16,
      prevX: ax - 36,
      prevY: ay + 16,
      vx: 0,
      vy: 0,
      aimAngle: -0.38,
      weaponSlots: ['hunter_crossbow', 'tesla_carbine'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
      weaponUpgradeLevels: { 0: 1, 1: 0 },
      weaponMutators: { 0: ['mutator_prism_splitter'], 1: [] },
      mutatorChoices: ['mutator_finale_jolt', 'mutator_gravity_singularity'],
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

/** 3. ap2-weapon-salvage-hold (8-frame strip: Hold [X] 0.5s to salvage ground weapon into +30 Gold) */
export async function setupAp2WeaponSalvageHoldScene(page: Page): Promise<void> {
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

    sim.spawnProp('torch_brazier', 380, 200);
    sim.spawnProp('torch_brazier', 580, 200);
    sim.spawnProp('torch_brazier', 380, 340);
    sim.spawnProp('torch_brazier', 580, 340);

    sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: 'scrap_shotgun',
      rarity: 'epic',
      nameVi: 'Shotgun Phế Liệu',
      costGold: 0,
      healAmount: 0,
      x: 492,
      y: 270,
    });

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true,
      x: 468,
      y: 270,
      prevX: 468,
      prevY: 270,
      vx: 0,
      vy: 0,
      aimAngle: 0,
      gold: 120,
      salvageHoldTimer: 0,
      salvageTargetItemId: 0,
      weaponSlots: ['hunter_crossbow', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 42);
  await markPostWarmupStart(page);
}

/** 4. ap2-secret-wall-crack-break (8-frame strip: Dash-Kick moss_table into glowing East cracked_wall) */
export async function setupAp2SecretWallCrackBreakScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 1;
    sim.currentFloor = 1;
    sim.map.biome = 1;

    const secretRoom =
      sim.dungeon.rooms.find((r) => r.type === 'secret') ??
      sim.dungeon.rooms[sim.dungeon.secretRoomId]!;
    const room =
      sim.dungeon.rooms.find((r) => r.type === 'combat' && r.id !== secretRoom?.id) ??
      sim.dungeon.rooms[0]!;

    room.type = 'combat';
    room.cleared = true;
    room.secretWallDir = 'E';
    room.secretWallBroken = false;
    sim.secretWallBroken = false;
    if (secretRoom) {
      room.connections.E = secretRoom.id;
      secretRoom.connections.W = room.id;
      secretRoom.secretWallDir = 'W';
      secretRoom.secretWallBroken = false;
      secretRoom.discovery = 'hidden';
    }

    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();

    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.props.length = 0;

    sim.map.configureRoomLayout({
      roomSeed: 1338,
      archetype: 'GAUNTLET_CHOKEPOINT',
      biome: 1,
      activeDoorSides: ['N', 'S', 'W'],
      secretWallBroken: false,
    });

    for (let ty = 8; ty <= 14; ty++) {
      for (let tx = 26; tx < sim.map.cols - 1; tx++) {
        sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
        sim.map.surfaces[ty * sim.map.cols + tx] = 'none';
      }
    }
    sim.map.placeCrackedSecretWall('E', false);
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;
    sim.rebuildCurrentRoomDoors();

    sim.spawnProp('torch_brazier', 980, 292);
    sim.spawnProp('torch_brazier', 980, 444);

    const table = sim.spawnProp('moss_table', 1040, 368);
    sim.flipCoverProp(table, sim.player);
    table.microBlankTimer = 0;
    sim.consumeEvents();

    sim.selectCharacter(sim.player.id, 'vanguard');
    sim.doorTransitionCooldown = 99;
    Object.assign(sim.player, {
      godMode: true,
      x: 1008,
      y: 368,
      prevX: 1008,
      prevY: 368,
      vx: 0,
      vy: 0,
      aimAngle: 0,
      dashTimer: 0,
      dashCooldownTimer: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);
  await markPostWarmupStart(page);
}

export const AP2_P2A_VISUAL_SCENES: readonly VisualSceneDef[] = [
  makeScene(
    'ap2-treasure-forge-workshop',
    'Floor 1 Treasure Forge Workshop showing Epic Weapon Chest, glowing Ancient Daedalus Anvil, and [E] Daedalus Anvil interact prompt',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2TreasureForgeWorkshopScene,
  ),
  makeScene(
    'ap2-modal-daedalus-mutator',
    'Ancient Daedalus Anvil Modal displaying 2 Weapon Mutator cards with vector emblems and +1 upgraded active weapon with attached mutator gem',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2ModalDaedalusMutatorScene,
  ),
  makeScene(
    'ap2-weapon-salvage-hold',
    'Player holding [X] for 0.5s out of combat to salvage a ground Epic weapon with world-space progress ring and +30 Gold burst',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2WeaponSalvageHoldScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['weapon_salvaged'],
      },
      actionRoi: {
        includeProjectiles: 'none',
        sceneCategory: 'microbar_ui',
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'SALVAGE 0%' },
        {
          stepCount: 11,
          stage: 'trigger',
          label: 'HOLD [X] 37%',
          beforeStep: (page) =>
            queueStepInput(page, { dropWeapon: true, aimAngle: 0.16, durationTicks: 11 }),
        },
        {
          stepCount: 11,
          stage: 'active',
          label: 'HOLD [X] 73%',
          beforeStep: (page) =>
            queueStepInput(page, { dropWeapon: true, aimAngle: -0.16, durationTicks: 11 }),
        },
        {
          stepCount: 7,
          stage: 'active',
          label: 'HOLD [X] 97%',
          beforeStep: (page) =>
            queueStepInput(page, { dropWeapon: true, aimAngle: 0.1, durationTicks: 7 }),
        },
        {
          stepCount: 1,
          stage: 'apex',
          label: '+30G SALVAGED!',
          beforeStep: (page) =>
            queueStepInput(page, { dropWeapon: true, aimAngle: 0, durationTicks: 1 }),
        },
        {
          stepCount: 3,
          stage: 'sub_impact',
          label: 'GOLD SPARKS',
          beforeStep: (page) => queueStepInput(page, { moveX: 1, aimAngle: 0, durationTicks: 3 }),
        },
        { stepCount: 4, stage: 'settled', label: 'GOLD ADDED' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
  makeScene(
    'ap2-secret-wall-crack-break',
    'Player Dash-Kicking flipped moss_table into glowing East cracked_wall to shatter secret wall and unlock Secret Room passage',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2SecretWallCrackBreakScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: ['cracked_wall_broken'],
      },
      actionRoi: {
        includeProjectiles: 'none',
        propKinds: ['moss_table'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'CRACKED WALL' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'DASH KICK!',
          beforeStep: (page) => triggerDash(page, 1, 0, 0),
        },
        { stepCount: 2, stage: 'active', label: 'TABLE SLIDE 1' },
        { stepCount: 2, stage: 'active', label: 'TABLE SLIDE 2' },
        { stepCount: 2, stage: 'apex', label: 'WALL BROKEN!' },
        { stepCount: 3, stage: 'sub_impact', label: 'SECRET PASSAGE!' },
        { stepCount: 4, stage: 'settled', label: 'DOOR UNLOCKED' },
        { stepCount: 4, stage: 'settled', label: 'SETTLED' },
      ],
    },
  ),
];
