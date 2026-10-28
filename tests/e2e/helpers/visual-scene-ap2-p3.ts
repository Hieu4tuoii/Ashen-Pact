import type { Page } from '@playwright/test';
import type { WeaponDefId } from '@ashen-pact/shared';
import {
  BIOME2_GAME_URL,
  BIOME3_GAME_URL,
  DEFAULT_GAME_URL,
  installSceneStripInstrumentation,
  lockCameraAndIrisToPlayer,
  makeScene,
  markPostWarmupStart,
  queueStepInput,
  stepDeterministicFrames,
  triggerDash,
  triggerFireWeapon,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const AP2_P3A_SCENE_IDS: readonly string[] = [
  'ap2-ai-lead-aim-telegraph',
  'ap2-ai-boar-pillar-crash',
  'ap2-ai-spore-bomber-kick',
  'ap2-ai-yeti-iceblock-counter',
  'ap2-ai-shielder-shock-arc',
  'ap2-ai-dwarf-mortar-lob',
] as const;

export const AP2_P3A_SCENE_GROUP = AP2_P3A_SCENE_IDS;

/**
 * 1. ap2-ai-lead-aim-telegraph (Static Scene):
 * Player strafing with non-zero velocity while goblin_shooter (behind moss_table) and an Elite ranged
 * shooter are in the final 0.35s telegraph window (stateTimer = 0.20s, leadSightlineActive = true),
 * displaying #FF5722 red-orange + #FFF7ED core predictive sightlines aiming ahead of player movement,
 * alongside a goblin_shaman with an active shaman_totem emerald link beam.
 */
export async function setupAp2AiLeadAimTelegraphScene(page: Page): Promise<void> {
  await installSceneStripInstrumentation(page);
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

    for (let ty = 4; ty <= 13; ty++) {
      for (let tx = 9; tx <= 21; tx++) {
        if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
          sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
          sim.map.setSurface(tx, ty, 'none', 0, true);
        }
      }
    }
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;

    for (const [bx, by] of [[330, 180], [640, 180], [330, 380], [640, 380]] as const) {
      sim.spawnProp('torch_brazier', bx, by);
    }
    sim.spawnProp('moss_table', 506, 236);

    const shooter = sim.spawnEnemy('goblin_shooter', 544, 236, true);
    Object.assign(shooter, {
      hp: 400, maxHp: 400, moveSpeed: 0, spawnWarmupTimer: 0,
      aiState: 'telegraph', stateTimer: 57 / 60, telegraphDurationSec: 0.95,
      telegraphLength: 320, leadSightlineActive: false,
    });

    const eliteShooter = sim.spawnEnemy('goblin_shooter', 552, 326, true, 'volley');
    Object.assign(eliteShooter, {
      hp: 600, maxHp: 600, moveSpeed: 0, spawnWarmupTimer: 0,
      aiState: 'telegraph', stateTimer: 56 / 60, telegraphDurationSec: 0.95,
      telegraphLength: 340, leadSightlineActive: false,
    });

    const shaman = sim.spawnEnemy('goblin_shaman', 606, 280, true);
    Object.assign(shaman, {
      hp: 500, maxHp: 500, moveSpeed: 0, spawnWarmupTimer: 0,
      aiState: 'cooldown', stateTimer: 10.0, attackCooldownTimer: 10.0, aimAngle: Math.PI,
    });

    const totem = sim.spawnProp('shaman_totem', 572, 280);
    Object.assign(totem, {
      hp: 65, maxHp: 65, radius: 18, state: 'intact', linkedShamanId: shaman.id,
    });

    sim.selectCharacter(sim.player.id, 'ranger');
    Object.assign(sim.player, {
      godMode: true, x: 382, y: 356, prevX: 382, prevY: 356, vx: 0, vy: 0, aimAngle: -0.12,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 25);
  await queueStepInput(page, { moveX: 0.28, moveY: -1, aimAngle: -0.1, durationTicks: 22 });
  await stepDeterministicFrames(page, 20);
}

/**
 * 2. ap2-ai-boar-pillar-crash (8-frame strip):
 * Player baits a charging wild_boar (410 px/s) into an intact rotten_totem_pillar and dashes aside;
 * at F5 (heroFrameIndex: 4), the wild_boar crashes into the pillar, collapsing it onto itself.
 */
export async function setupAp2AiBoarPillarCrashScene(page: Page): Promise<void> {
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

    for (let ty = 4; ty <= 13; ty++) {
      for (let tx = 9; tx <= 21; tx++) {
        if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
          sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
          sim.map.setSurface(tx, ty, 'none', 0, true);
        }
      }
    }
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;

    for (const [bx, by] of [[340, 180], [620, 180], [340, 360], [620, 360]] as const) {
      sim.spawnProp('torch_brazier', bx, by);
    }
    sim.spawnProp('rotten_totem_pillar', 470, 270);

    const boar = sim.spawnEnemy('wild_boar', 573, 270, true, 'shield');
    Object.assign(boar, {
      hp: 320, maxHp: 320, shieldArmor: 20, maxShieldArmor: 20, spawnWarmupTimer: 0,
      aiState: 'telegraph', stateTimer: 41 / 60, telegraphDurationSec: 0.7,
      telegraphAngle: Math.PI, aimAngle: Math.PI, vx: 0, vy: 0,
    });

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true, x: 424, y: 270, prevX: 424, prevY: 270,
      vx: 0, vy: 0, aimAngle: 0, dashTimer: 0, dashCooldownTimer: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);
  await markPostWarmupStart(page);
}

/**
 * 3. ap2-ai-spore-bomber-kick (8-frame strip):
 * spore_bomber enters its 0.65s self-destruct telegraph near the player; player executes a Dash-Kick
 * punting the spore_bomber (520 px/s) backward into a cluster of enemies where it detonates at F5.
 */
export async function setupAp2AiSporeBomberKickScene(page: Page): Promise<void> {
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

    for (let ty = 4; ty <= 13; ty++) {
      for (let tx = 9; tx <= 21; tx++) {
        if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
          sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
          sim.map.setSurface(tx, ty, 'none', 0, true);
        }
      }
    }
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;

    for (const [bx, by] of [[340, 180], [620, 180], [340, 360], [620, 360]] as const) {
      sim.spawnProp('torch_brazier', bx, by);
    }

    const bomber = sim.spawnEnemy('spore_bomber', 412, 270, true);
    Object.assign(bomber, {
      hp: 220, maxHp: 220, spawnWarmupTimer: 0,
      aiState: 'telegraph', stateTimer: 79 / 60, telegraphDurationSec: 0.65,
      telegraphRadius: 95, telegraphAngle: Math.PI, aimAngle: Math.PI, vx: 0, vy: 0,
    });

    const shooter = sim.spawnEnemy('goblin_shooter', 492, 270, true);
    const shaman = sim.spawnEnemy('goblin_shaman', 506, 248, true, 'shield');
    const slime = sim.spawnEnemy('green_slime', 506, 292, true);
    for (const target of [shooter, shaman, slime]) {
      Object.assign(target, {
        hp: 340, maxHp: 340, moveSpeed: 0, spawnWarmupTimer: 0,
        aiState: 'stunned', stateTimer: 8.0, stunTimer: 8.0,
        attackCooldownTimer: 99, aimAngle: Math.PI, vx: 0, vy: 0,
      });
    }

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true, x: 380, y: 270, prevX: 380, prevY: 270,
      vx: 0, vy: 0, aimAngle: 0, dashTimer: 0, dashCooldownTimer: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);
  await markPostWarmupStart(page);
}

/**
 * 4. ap2-ai-yeti-iceblock-counter (8-frame strip):
 * baby_yeti pushes a sliding_ice_block (460 px/s) toward the player; player counter-kicks (Dash-Kick)
 * reversing the ice block at 600 px/s so it smashes into baby_yeti and shatters an ice_golem's
 * frontal ice armor at F5 ('COUNTER ICE KICK!' / 'ICE ARMOR SHATTERED!').
 */
export async function setupAp2AiYetiIceblockCounterScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 2;
    sim.currentFloor = 3;
    sim.map.biome = 2;

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

    for (let ty = 4; ty <= 13; ty++) {
      for (let tx = 9; tx <= 21; tx++) {
        if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
          sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
          sim.map.setSurface(tx, ty, 'none', 0, true);
        }
      }
    }
    sim.map.tiles[8 * sim.map.cols + 17] = 'wall';
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;

    for (const [bx, by] of [[340, 180], [620, 180], [340, 360], [620, 360]] as const) {
      sim.spawnProp('torch_brazier', bx, by);
    }

    const iceBlock = sim.spawnProp('sliding_ice_block', 442, 270);
    Object.assign(iceBlock, { state: 'intact', hp: 120, maxHp: 120, bouncesRemaining: 0 });

    const yeti = sim.spawnEnemy('baby_yeti', 485, 256, true);
    Object.assign(yeti, {
      hp: 360, maxHp: 360, moveSpeed: 0, spawnWarmupTimer: 0,
      aiState: 'cooldown', stateTimer: 36 / 60, attackCooldownTimer: 99,
      aimAngle: Math.PI, vx: 0, vy: 0,
    });

    const golem = sim.spawnEnemy('ice_golem', 504, 270, true, 'shield');
    Object.assign(golem, {
      hp: 450, maxHp: 450, shieldArmor: 30, maxShieldArmor: 30, shieldBrokenTimer: 0,
      moveSpeed: 0, spawnWarmupTimer: 0, aiState: 'cooldown', stateTimer: 10.0,
      attackCooldownTimer: 99, aimAngle: Math.PI, vx: 0, vy: 0,
    });

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true, x: 380, y: 270, prevX: 380, prevY: 270,
      vx: 0, vy: 0, aimAngle: 0, dashTimer: 0, dashCooldownTimer: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);
  await markPostWarmupStart(page);
}

/**
 * 5. ap2-ai-shielder-shock-arc (8-frame strip):
 * Player with tesla_carbine fires a Shock bolt into the frontal iron shield of iron_shielder,
 * conducting electricity and discharging the rear lightning arc cone (r = 160px, ±65°) at F5
 * ('SHIELD SHOCK ARC!') stunning the enemies hiding behind the shield.
 */
export async function setupAp2AiShielderShockArcScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 3;
    sim.currentFloor = 5;
    sim.map.biome = 3;

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

    for (let ty = 4; ty <= 13; ty++) {
      for (let tx = 9; tx <= 21; tx++) {
        if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
          sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
          sim.map.setSurface(tx, ty, 'none', 0, true);
        }
      }
    }
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;

    for (const [bx, by] of [[340, 180], [620, 180], [340, 360], [620, 360]] as const) {
      sim.spawnProp('torch_brazier', bx, by);
    }

    const shielder = sim.spawnEnemy('iron_shielder', 478, 270, true, 'shield');
    Object.assign(shielder, {
      hp: 380, maxHp: 380, shieldArmor: 28, maxShieldArmor: 28, shieldBrokenTimer: 0,
      moveSpeed: 0, spawnWarmupTimer: 0, aiState: 'cooldown', stateTimer: 10.0,
      attackCooldownTimer: 99, aimAngle: Math.PI, vx: 0, vy: 0,
    });

    const rearImp = sim.spawnEnemy('fire_imp', 524, 248, true);
    const rearCannon = sim.spawnEnemy('dwarf_cannon', 528, 292, true);
    for (const rear of [rearImp, rearCannon]) {
      Object.assign(rear, {
        hp: 300, maxHp: 300, moveSpeed: 0, spawnWarmupTimer: 0,
        aiState: 'cooldown', stateTimer: 10.0, attackCooldownTimer: 99,
        aimAngle: Math.PI, vx: 0, vy: 0,
      });
    }

    sim.selectCharacter(sim.player.id, 'engineer');
    Object.assign(sim.player, {
      godMode: true, x: 380, y: 270, prevX: 380, prevY: 270,
      vx: 0, vy: 0, aimAngle: 0, critChance: 0,
      weaponSlots: ['tesla_carbine', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0, clipAmmo: 8, clipMax: 8,
      reloadTimer: 0, reloadLockout: false, fireCooldownTimer: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);
  await markPostWarmupStart(page);
}

/**
 * 6. ap2-ai-dwarf-mortar-lob (8-frame strip):
 * dwarf_cannon fires a Lobbed Mortar arcing in a high parabola over a flipped forge_blast_shield
 * (F1..F4 in flight with red r = 56px floor target indicator ring visible), detonating on impact at F5.
 */
export async function setupAp2AiDwarfMortarLobScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 3;
    sim.currentFloor = 5;
    sim.map.biome = 3;

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
    sim.pendingMortarStrikes.length = 0;

    for (let ty = 4; ty <= 13; ty++) {
      for (let tx = 9; tx <= 21; tx++) {
        if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
          sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
          sim.map.setSurface(tx, ty, 'none', 0, true);
        }
      }
    }
    sim.map.fillSurfaceRect(11, 8, 3, 2, 'oil');
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;

    for (const [bx, by] of [[340, 180], [620, 180], [340, 360], [620, 360]] as const) {
      sim.spawnProp('torch_brazier', bx, by);
    }

    const shieldCover = sim.spawnProp('forge_blast_shield', 446, 270);
    sim.flipCoverProp(shieldCover);
    shieldCover.microBlankTimer = 0;
    sim.consumeEvents();

    const cannon = sim.spawnEnemy('dwarf_cannon', 518, 270, true, 'shield');
    Object.assign(cannon, {
      hp: 360, maxHp: 360, shieldArmor: 24, maxShieldArmor: 24, moveSpeed: 0,
      spawnWarmupTimer: 0, aiState: 'telegraph', stateTimer: 4 / 60,
      telegraphDurationSec: 0.65, telegraphAngle: Math.PI, aimAngle: Math.PI,
      attackCooldownTimer: 99, vx: 0, vy: 0,
    });

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true, x: 382, y: 270, prevX: 382, prevY: 270,
      vx: 0, vy: 0, aimAngle: 0, dashTimer: 0, dashCooldownTimer: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 41);
  await markPostWarmupStart(page);
}

export const AP2_P3A_VISUAL_SCENES: readonly VisualSceneDef[] = [
  makeScene(
    'ap2-ai-lead-aim-telegraph',
    'Biome 1 predictive lead-aiming showcase with strafing player, goblin_shooter behind moss_table, Elite ranged shooter locking #FF5722/#FFF7ED predictive sightlines ahead of player velocity, and goblin_shaman Ward Totem emerald tether beams',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2AiLeadAimTelegraphScene,
  ),
  makeScene(
    'ap2-ai-boar-pillar-crash',
    'Player baiting a 410 px/s charging wild_boar into an intact rotten_totem_pillar and dashing aside so the pillar collapses onto the boar at F5 (PILLAR CRASH!, 1.5s stun)',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2AiBoarPillarCrashScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'prop_destroyed',
        simEventPredicate: (ev) => ev['propKind'] === 'rotten_totem_pillar',
      },
      actionRoi: {
        width: 420,
        height: 320,
        includeProjectiles: 'none',
        enemyKinds: ['wild_boar'],
        propKinds: ['rotten_totem_pillar'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'BOAR TELEGRAPH' },
        { stepCount: 3, stage: 'trigger', label: 'BAIT & DASH!', beforeStep: (page) => queueStepInput(page, { moveX: -0.2, moveY: -1, aimAngle: 0, durationTicks: 3 }) },
        { stepCount: 2, stage: 'active', label: 'CHARGE 410PX/S', beforeStep: (page) => queueStepInput(page, { moveX: 0.2, moveY: -1, aimAngle: 0.2, durationTicks: 2 }) },
        { stepCount: 2, stage: 'active', label: 'NEARING PILLAR', beforeStep: (page) => queueStepInput(page, { moveX: 0.5, moveY: -0.6, aimAngle: 0.25, durationTicks: 2 }) },
        { stepCount: 1, stage: 'apex', label: 'PILLAR CRASH!', beforeStep: (page) => queueStepInput(page, { moveX: 0.6, moveY: 0.3, aimAngle: 0.25, durationTicks: 1 }) },
        { stepCount: 2, stage: 'sub_impact', label: 'STUNNED 1.5S', beforeStep: (page) => queueStepInput(page, { moveX: 0.6, moveY: 0.5, aimAngle: 0.2, durationTicks: 2 }) },
        { stepCount: 3, stage: 'settled', label: 'PILLAR FALLEN', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: 0.4, aimAngle: 0.15, durationTicks: 3 }) },
        { stepCount: 3, stage: 'settled', label: 'SETTLED', beforeStep: (page) => queueStepInput(page, { moveX: 0.2, moveY: 0.2, aimAngle: 0.1, durationTicks: 3 }) },
      ],
    },
  ),
  makeScene(
    'ap2-ai-spore-bomber-kick',
    'Player Dash-Kicking a 0.65s self-destruct telegraphing spore_bomber backward at 520 px/s into an enemy pack where it detonates at F5',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2AiSporeBomberKickScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'explosion',
        simEventPredicate: (ev) => ev['sourceDefId'] === 'spore_bomber',
      },
      actionRoi: {
        width: 420,
        height: 320,
        includeProjectiles: 'none',
        enemyKinds: ['spore_bomber', 'goblin_shooter', 'goblin_shaman', 'green_slime'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: '0.65S SWELL' },
        { stepCount: 2, stage: 'trigger', label: 'DASH KICK!', beforeStep: (page) => triggerDash(page, 1, 0, 0, 2) },
        { stepCount: 2, stage: 'active', label: 'PUNT 520PX/S', beforeStep: (page) => queueStepInput(page, { moveX: -0.5, moveY: -0.6, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 1, stage: 'active', label: 'INBOUND PACK', beforeStep: (page) => queueStepInput(page, { moveX: -0.4, moveY: -0.5, aimAngle: 0, durationTicks: 1 }) },
        { stepCount: 1, stage: 'apex', label: 'SPORE BLAST!', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: 0.4, aimAngle: 0, durationTicks: 1 }) },
        { stepCount: 2, stage: 'sub_impact', label: 'POISON SHOCKWAVE', beforeStep: (page) => queueStepInput(page, { moveX: 0.5, moveY: 0.3, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 3, stage: 'settled', label: 'SWAMP PUDDLE', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: 0.2, aimAngle: 0, durationTicks: 3 }) },
        { stepCount: 3, stage: 'settled', label: 'SETTLED', beforeStep: (page) => queueStepInput(page, { moveX: 0.2, moveY: 0, aimAngle: 0, durationTicks: 3 }) },
      ],
    },
  ),
  makeScene(
    'ap2-ai-yeti-iceblock-counter',
    'Player counter-kicking an incoming 460 px/s baby_yeti sliding_ice_block back at 600 px/s to smash baby_yeti and shatter ice_golem frontal armor at F5',
    BIOME2_GAME_URL,
    'GameScene',
    setupAp2AiYetiIceblockCounterScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'armor_broken',
      },
      actionRoi: {
        width: 420,
        height: 320,
        includeProjectiles: 'none',
        enemyKinds: ['baby_yeti', 'ice_golem'],
        propKinds: ['sliding_ice_block'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'YETI PUSH 460' },
        { stepCount: 2, stage: 'trigger', label: 'COUNTER KICK!', beforeStep: (page) => triggerDash(page, 1, 0, 0, 2) },
        { stepCount: 2, stage: 'active', label: 'REVERSE 600PX/S', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: -0.5, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 2, stage: 'active', label: 'HURTLING BACK', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: -0.4, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 2, stage: 'apex', label: 'ARMOR SHATTERED!', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: 0.3, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 2, stage: 'sub_impact', label: 'CRYO SHARDS', beforeStep: (page) => queueStepInput(page, { moveX: 0.5, moveY: 0.3, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 2, stage: 'settled', label: 'GOLEM STUNNED', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: 0.2, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 2, stage: 'settled', label: 'SETTLED', beforeStep: (page) => queueStepInput(page, { moveX: 0.2, moveY: 0, aimAngle: 0, durationTicks: 2 }) },
      ],
    },
  ),
  makeScene(
    'ap2-ai-shielder-shock-arc',
    'Player firing tesla_carbine Shock bolt into iron_shielder frontal shield to conduct electricity and discharge a r=160px rear lightning arc cone stunning rear enemies at F5',
    BIOME3_GAME_URL,
    'GameScene',
    setupAp2AiShielderShockArcScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'chain_lightning',
      },
      actionRoi: {
        width: 420,
        height: 320,
        includeProjectiles: 'player_and_parried',
        enemyKinds: ['iron_shielder', 'fire_imp', 'dwarf_cannon'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'SHIELD WALL' },
        {
          stepCount: 2,
          stage: 'trigger',
          label: 'TESLA SHOT!',
          beforeStep: async (page) => {
            await triggerFireWeapon(page, 0, 1);
            await queueStepInput(page, { moveX: 0.6, moveY: -0.4, aimAngle: 0, durationTicks: 1 });
          },
        },
        { stepCount: 2, stage: 'active', label: 'BOLT FLIGHT 1', beforeStep: (page) => queueStepInput(page, { moveX: 0.6, moveY: -0.4, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 1, stage: 'active', label: 'BOLT FLIGHT 2', beforeStep: (page) => queueStepInput(page, { moveX: 0.5, moveY: 0.4, aimAngle: 0, durationTicks: 1 }) },
        { stepCount: 1, stage: 'apex', label: 'SHIELD SHOCK ARC!', beforeStep: (page) => queueStepInput(page, { moveX: 0.5, moveY: 0.4, aimAngle: 0, durationTicks: 1 }) },
        { stepCount: 2, stage: 'sub_impact', label: 'REAR CONE STUN', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: 0.3, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 3, stage: 'settled', label: 'PACK PARALYZED', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: -0.2, aimAngle: 0, durationTicks: 3 }) },
        { stepCount: 3, stage: 'settled', label: 'SETTLED', beforeStep: (page) => queueStepInput(page, { moveX: 0.2, moveY: 0, aimAngle: 0, durationTicks: 3 }) },
      ],
    },
  ),
  makeScene(
    'ap2-ai-dwarf-mortar-lob',
    'dwarf_cannon Lobbed Mortar arcing in a high parabola over a flipped forge_blast_shield onto a r=56px red floor target ring and detonating at F5',
    BIOME3_GAME_URL,
    'GameScene',
    setupAp2AiDwarfMortarLobScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'explosion',
        simEventPredicate: (ev) => ev['sourceDefId'] === 'dwarf_mortar',
      },
      actionRoi: {
        width: 420,
        height: 320,
        includeProjectiles: 'none',
        enemyKinds: ['dwarf_cannon'],
        propKinds: ['forge_blast_shield'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'MORTAR ARC HIGH' },
        { stepCount: 4, stage: 'trigger', label: 'OVER SHIELD!', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: -1, aimAngle: 0, durationTicks: 4 }) },
        { stepCount: 4, stage: 'active', label: 'RED RING LOCK', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: -0.8, aimAngle: 0.12, durationTicks: 4 }) },
        { stepCount: 4, stage: 'active', label: 'SHELL DESCENT', beforeStep: (page) => queueStepInput(page, { moveX: 0.5, moveY: -0.4, aimAngle: 0.15, durationTicks: 4 }) },
        { stepCount: 2, stage: 'apex', label: 'MORTAR BLAST!', beforeStep: (page) => queueStepInput(page, { moveX: 0.5, moveY: 0.3, aimAngle: 0.1, durationTicks: 2 }) },
        { stepCount: 3, stage: 'sub_impact', label: 'OIL IGNITED!', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: 0.5, aimAngle: 0.1, durationTicks: 3 }) },
        { stepCount: 3, stage: 'settled', label: 'CRATER BLAZE', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: 0.4, aimAngle: 0.05, durationTicks: 3 }) },
        { stepCount: 3, stage: 'settled', label: 'SETTLED', beforeStep: (page) => queueStepInput(page, { moveX: 0.2, moveY: 0.2, aimAngle: 0, durationTicks: 3 }) },
      ],
    },
  ),
];

export {
  AP2_P3B_SCENE_GROUP,
  AP2_P3B_SCENE_IDS,
  AP2_P3B_VISUAL_SCENES,
  setupAp2Boss1ArmorBreakScene,
  setupAp2Boss2ArmorBreakScene,
  setupAp2Boss3ArmorBreakScene,
  setupAp2BossSupplyDropScene,
} from './visual-scene-ap2-p3b.js';
