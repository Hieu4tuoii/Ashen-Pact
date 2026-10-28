import type { Page } from '@playwright/test';
import {
  BIOME2_GAME_URL,
  BIOME3_GAME_URL,
  DEFAULT_GAME_URL,
  lockCameraAndIrisToPlayer,
  makeScene,
  markPostWarmupStart,
  queueStepInput,
  stepDeterministicFrames,
  triggerDash,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const AP2_P3B_SCENE_IDS: readonly string[] = [
  'ap2-boss-supply-drop',
  'ap2-boss1-armor-break',
  'ap2-boss2-armor-break',
  'ap2-boss3-armor-break',
] as const;

export const AP2_P3B_SCENE_GROUP = AP2_P3B_SCENE_IDS;

/**
 * 1. ap2-boss-supply-drop (8-frame strip, heroFrameIndex: 4):
 * Boss Room where 5 golden supply drop rings (0.6s telegraph, #F59E0B / #FBBF24) descend
 * onto the arena floor on F1..F4 and land at F5 ('SUPPLY DROP!') to replenish
 * 3 Barricades (moss_table) + 2 Biome Toys (volatile_spore_pod), while the Boss HUD
 * displays the Orange-Gold Stagger Bar beneath the Boss HP bar.
 */
export async function setupAp2BossSupplyDropScene(page: Page): Promise<void> {
  await page.evaluate(() => {
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
    room.type = 'boss';
    room.cleared = false;
    sim.map.isBossRoom = true;
    sim.runState = 'playing';
    sim.portalActive = false;
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.props.length = 0;
    sim.pendingBossSupplyDrops.length = 0;

    for (let ty = 4; ty <= 13; ty++) {
      for (let tx = 8; tx <= 22; tx++) {
        if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
          sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
          sim.map.setSurface(tx, ty, 'none', 0, true);
        }
      }
    }
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;

    for (const [bx, by] of [[330, 180], [630, 180], [330, 360], [630, 360]] as const) {
      sim.spawnProp('torch_brazier', bx, by);
    }

    const boss = sim.spawnEnemy('spore_king', 494, 268, true);
    Object.assign(boss, {
      hp: 3800,
      maxHp: 5200,
      bossPhase: 1,
      bossStaggerAccum: 68,
      bossStaggerCooldownTimer: 0,
      bossSupplyDropTimer: 18.0,
      bossCombatElapsedSec: 17.5,
      moveSpeed: 0,
      spawnWarmupTimer: 0,
      aiState: 'cooldown',
      stateTimer: 12.0,
      attackCooldownTimer: 99,
      aimAngle: Math.PI,
      vx: 0,
      vy: 0,
    });

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true, x: 386, y: 274, prevX: 386, prevY: 274,
      vx: 0, vy: 0, aimAngle: 0, dashTimer: 0, dashCooldownTimer: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 38);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const drops: Array<{ x: number; y: number; propKind: 'moss_table' | 'volatile_spore_pod' }> = [
      { x: 428, y: 242, propKind: 'moss_table' },
      { x: 428, y: 300, propKind: 'moss_table' },
      { x: 468, y: 312, propKind: 'moss_table' },
      { x: 458, y: 230, propKind: 'volatile_spore_pod' },
      { x: 524, y: 302, propKind: 'volatile_spore_pod' },
    ];
    sim.pendingBossSupplyDrops = drops.map((d, idx) => ({
      id: 900 + idx,
      x: d.x,
      y: d.y,
      propKind: d.propKind,
      timer: 8 / 60,
      maxTimer: 0.6,
      radius: 26,
    }));
  });

  await stepDeterministicFrames(page, 1);
  await markPostWarmupStart(page);
}

/**
 * 2. ap2-boss1-armor-break (8-frame strip, heroFrameIndex: 4):
 * Biome 1 Boss spore_king at <= 66% MaxHP with Reinforced Spore Shell active (-70% DMG +
 * HUD tactical hint "⚡ SÚT BÀN ĐÁ / BÀO TỬ PHÁ GIÁP!"). Player Dash-Kicks a volatile_spore_pod
 * into spore_king, shattering the shell at F5 ('armor_broken', -6% MaxHP true damage, 3.5s Stun,
 * and HUD banner "✦ VỠ GIÁP! +40% SÁT THƯƠNG NHẬN VÀO").
 */
export async function setupAp2Boss1ArmorBreakScene(page: Page): Promise<void> {
  await page.evaluate(() => {
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
    room.type = 'boss';
    room.cleared = false;
    sim.map.isBossRoom = true;
    sim.runState = 'playing';
    sim.portalActive = false;
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.props.length = 0;
    sim.pendingBossSupplyDrops.length = 0;

    for (let ty = 4; ty <= 13; ty++) {
      for (let tx = 8; tx <= 22; tx++) {
        if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
          sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
          sim.map.setSurface(tx, ty, 'none', 0, true);
        }
      }
    }
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;

    for (const [bx, by] of [[330, 180], [630, 180], [330, 360], [630, 360]] as const) {
      sim.spawnProp('torch_brazier', bx, by);
    }

    sim.spawnProp('moss_table', 432, 224);
    sim.spawnProp('moss_table', 432, 316);
    sim.spawnProp('volatile_spore_pod', 410, 270);

    const boss = sim.spawnEnemy('spore_king', 516, 270, true);
    Object.assign(boss, {
      hp: 3400,
      maxHp: 5200,
      bossPhase: 2,
      bossPhaseTransitionTimer: 0,
      bossArmorShellActive: true,
      bossArmorShellReduction: 0.7,
      bossArmorPhase66Triggered: true,
      bossStaggerAccum: 74,
      bossStaggerCooldownTimer: 0,
      bossSupplyDropTimer: 18.0,
      moveSpeed: 0,
      spawnWarmupTimer: 0,
      aiState: 'cooldown',
      stateTimer: 12.0,
      attackCooldownTimer: 99,
      aimAngle: Math.PI,
      vx: 0,
      vy: 0,
    });

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true, x: 378, y: 270, prevX: 378, prevY: 270,
      vx: 0, vy: 0, aimAngle: 0, dashTimer: 0, dashCooldownTimer: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);
  await markPostWarmupStart(page);
}

/**
 * 3. ap2-boss2-armor-break (8-frame strip, heroFrameIndex: 4):
 * Biome 2 Boss kryssa_ice_queen at <= 66% MaxHP with Glacial Shield active (-75% DMG +
 * HUD tactical hint "⚡ LẬT PHIẾN BĂNG CHẶN LASER & SÚT PHÁ KHIÊN!"). A flipped glacial_barricade
 * absorbs kryssa_ice_beam (cryoChargedByLaser = true) and the player Dash-Kicks it into Kryssa
 * to shatter the Glacial Shield at F5 ('armor_broken', -6% MaxHP true damage, 3.0s Freeze/Stun,
 * +40% EnemyVuln).
 */
export async function setupAp2Boss2ArmorBreakScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 2;
    sim.currentFloor = 4;
    sim.map.biome = 2;

    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    room.type = 'combat';
    room.cleared = true;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    room.type = 'boss';
    room.cleared = false;
    sim.map.isBossRoom = true;
    sim.runState = 'playing';
    sim.portalActive = false;
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.props.length = 0;
    sim.pendingBossSupplyDrops.length = 0;

    for (let ty = 4; ty <= 13; ty++) {
      for (let tx = 8; tx <= 22; tx++) {
        if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
          sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
          sim.map.setSurface(tx, ty, 'none', 0, true);
        }
      }
    }
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;

    for (const [bx, by] of [[330, 180], [630, 180], [330, 360], [630, 360]] as const) {
      sim.spawnProp('torch_brazier', bx, by);
    }

    sim.spawnProp('sliding_ice_block', 436, 222);
    sim.spawnProp('glacial_barricade', 436, 318);

    const barricade = sim.spawnProp('glacial_barricade', 410, 270);
    sim.flipCoverProp(barricade, sim.player);
    barricade.microBlankTimer = 0;
    barricade.cryoChargedByLaser = true;
    sim.consumeEvents();

    const boss = sim.spawnEnemy('kryssa_ice_queen', 516, 270, true);
    Object.assign(boss, {
      hp: 4400,
      maxHp: 6800,
      bossPhase: 2,
      bossPhaseTransitionTimer: 0,
      bossArmorShellActive: true,
      bossArmorShellReduction: 0.75,
      bossArmorPhase66Triggered: true,
      bossStaggerAccum: 76,
      bossStaggerCooldownTimer: 0,
      bossSupplyDropTimer: 18.0,
      moveSpeed: 0,
      spawnWarmupTimer: 0,
      aiState: 'cooldown',
      stateTimer: 12.0,
      attackCooldownTimer: 99,
      aimAngle: Math.PI,
      vx: 0,
      vy: 0,
    });

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true, x: 378, y: 270, prevX: 378, prevY: 270,
      vx: 0, vy: 0, aimAngle: 0, dashTimer: 0, dashCooldownTimer: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);
  await markPostWarmupStart(page);
}

/**
 * 4. ap2-boss3-armor-break (8-frame strip, heroFrameIndex: 4):
 * Biome 3 Boss forge_titan at <= 66% MaxHP with Thermonuclear Armor active (-75% DMG +
 * HUD tactical hint "⚡ SÚT KHIÊN THÉP / LÕI NĂNG LƯỢNG HOẶC DẬP BÚA MÁY!"). Player Dash-Kicks
 * a flipped forge_blast_shield into forge_titan to shatter the Thermonuclear Armor at F5
 * ('armor_broken', -6% MaxHP true damage, 4.0s Stun, +40% EnemyVuln).
 */
export async function setupAp2Boss3ArmorBreakScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.currentBiome = 3;
    sim.currentFloor = 6;
    sim.map.biome = 3;

    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    room.type = 'combat';
    room.cleared = true;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    room.type = 'boss';
    room.cleared = false;
    sim.map.isBossRoom = true;
    sim.runState = 'playing';
    sim.portalActive = false;
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.props.length = 0;
    sim.pendingBossSupplyDrops.length = 0;

    for (let ty = 4; ty <= 13; ty++) {
      for (let tx = 8; tx <= 22; tx++) {
        if (tx > 0 && ty > 0 && tx < sim.map.cols - 1 && ty < sim.map.rows - 1) {
          sim.map.tiles[ty * sim.map.cols + tx] = 'floor';
          sim.map.setSurface(tx, ty, 'none', 0, true);
        }
      }
    }
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;

    for (const [bx, by] of [[330, 180], [630, 180], [330, 360], [630, 360]] as const) {
      sim.spawnProp('torch_brazier', bx, by);
    }

    const coalBomb = sim.spawnProp('coal_bomb', 446, 222);
    coalBomb.fuseTimer = 3.5;
    sim.spawnProp('slag_crucible', 446, 318);

    const shield = sim.spawnProp('forge_blast_shield', 410, 270);
    sim.flipCoverProp(shield, sim.player);
    shield.microBlankTimer = 0;
    sim.consumeEvents();

    const boss = sim.spawnEnemy('forge_titan', 546, 270, true);
    Object.assign(boss, {
      hp: 6200,
      maxHp: 9600,
      bossPhase: 2,
      bossPhaseTransitionTimer: 0,
      bossArmorShellActive: true,
      bossArmorShellReduction: 0.75,
      bossArmorPhase66Triggered: true,
      bossStaggerAccum: 78,
      bossStaggerCooldownTimer: 0,
      bossSupplyDropTimer: 18.0,
      moveSpeed: 0,
      spawnWarmupTimer: 0,
      aiState: 'cooldown',
      stateTimer: 12.0,
      attackCooldownTimer: 99,
      aimAngle: Math.PI,
      vx: 0,
      vy: 0,
    });

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true, x: 378, y: 270, prevX: 378, prevY: 270,
      vx: 0, vy: 0, aimAngle: 0, dashTimer: 0, dashCooldownTimer: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);
  await markPostWarmupStart(page);
}

export const AP2_P3B_VISUAL_SCENES: readonly VisualSceneDef[] = [
  makeScene(
    'ap2-boss-supply-drop',
    'Boss room 0.6s golden supply drop rings landing at F5 (SUPPLY DROP!) to replenish 3 moss_table barricades + 2 volatile_spore_pod toys while showing the Boss Orange-Gold Stagger Bar',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2BossSupplyDropScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        alertSubstring: 'SUPPLY DROP!',
      },
      actionRoi: {
        width: 440,
        height: 320,
        includeProjectiles: 'none',
        enemyKinds: ['spore_king'],
        propKinds: ['moss_table', 'volatile_spore_pod'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: '0.6S DROP RINGS' },
        { stepCount: 2, stage: 'trigger', label: 'CRATES DESCEND', beforeStep: (page) => queueStepInput(page, { moveX: 0.8, moveY: -0.4, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 2, stage: 'active', label: 'BEACON LOCK', beforeStep: (page) => queueStepInput(page, { moveX: 0.8, moveY: -0.3, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 2, stage: 'active', label: 'IMPACT IMMINENT', beforeStep: (page) => queueStepInput(page, { moveX: 0.7, moveY: 0.3, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 1, stage: 'apex', label: 'SUPPLY DROP!', beforeStep: (page) => queueStepInput(page, { moveX: 0.7, moveY: 0.4, aimAngle: 0, durationTicks: 1 }) },
        { stepCount: 2, stage: 'sub_impact', label: '3 COVER + 2 PODS', beforeStep: (page) => queueStepInput(page, { moveX: 0.6, moveY: 0.4, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 3, stage: 'settled', label: 'ARENA RESUPPLIED', beforeStep: (page) => queueStepInput(page, { moveX: 0.5, moveY: 0.2, aimAngle: 0, durationTicks: 3 }) },
        { stepCount: 3, stage: 'settled', label: 'SETTLED', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: 0, aimAngle: 0, durationTicks: 3 }) },
      ],
    },
  ),
  makeScene(
    'ap2-boss1-armor-break',
    'Biome 1 Boss spore_king Reinforced Spore Shell (-70% DMG) shattered at F5 via 1-Step Dash-Kick of volatile_spore_pod (-6% MaxHP true damage, 3.5s Stun, +40% EnemyVuln)',
    DEFAULT_GAME_URL,
    'GameScene',
    setupAp2Boss1ArmorBreakScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'armor_broken',
      },
      actionRoi: {
        width: 440,
        height: 320,
        includeProjectiles: 'none',
        enemyKinds: ['spore_king'],
        propKinds: ['volatile_spore_pod', 'moss_table'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'SPORE SHELL -70%' },
        { stepCount: 2, stage: 'trigger', label: 'DASH KICK POD!', beforeStep: (page) => triggerDash(page, 1, 0, 0, 2) },
        { stepCount: 2, stage: 'active', label: 'POD SLIDE 520', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: -0.5, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 2, stage: 'active', label: 'CLOSING IN', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: -0.4, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 1, stage: 'apex', label: 'SHELL SHATTERED!', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: 0.3, aimAngle: 0, durationTicks: 1 }) },
        { stepCount: 2, stage: 'sub_impact', label: '+40% VULN 3.5S', beforeStep: (page) => queueStepInput(page, { moveX: 0.5, moveY: 0.3, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 3, stage: 'settled', label: 'BOSS STUNNED', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: 0.2, aimAngle: 0, durationTicks: 3 }) },
        { stepCount: 3, stage: 'settled', label: 'SETTLED', beforeStep: (page) => queueStepInput(page, { moveX: 0.2, moveY: 0, aimAngle: 0, durationTicks: 3 }) },
      ],
    },
  ),
  makeScene(
    'ap2-boss2-armor-break',
    'Biome 2 Boss kryssa_ice_queen Glacial Shield (-75% DMG) shattered at F5 via Dash-Kicking a laser-charged glacial_barricade (-6% MaxHP true damage, 3.0s Freeze/Stun, +40% EnemyVuln)',
    BIOME2_GAME_URL,
    'GameScene',
    setupAp2Boss2ArmorBreakScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'armor_broken',
      },
      actionRoi: {
        width: 440,
        height: 320,
        includeProjectiles: 'none',
        enemyKinds: ['kryssa_ice_queen'],
        propKinds: ['glacial_barricade', 'sliding_ice_block'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'CRYO SHIELD -75%' },
        { stepCount: 2, stage: 'trigger', label: 'KICK CRYO COVER!', beforeStep: (page) => triggerDash(page, 1, 0, 0, 2) },
        { stepCount: 2, stage: 'active', label: 'CHARGED SLIDE', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: -0.5, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 2, stage: 'active', label: 'FROST PAYLOAD', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: -0.4, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 1, stage: 'apex', label: 'SHIELD SHATTER!', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: 0.3, aimAngle: 0, durationTicks: 1 }) },
        { stepCount: 2, stage: 'sub_impact', label: 'FROZEN 3.0S!', beforeStep: (page) => queueStepInput(page, { moveX: 0.5, moveY: 0.3, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 3, stage: 'settled', label: '+40% VULN WINDOW', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: 0.2, aimAngle: 0, durationTicks: 3 }) },
        { stepCount: 3, stage: 'settled', label: 'SETTLED', beforeStep: (page) => queueStepInput(page, { moveX: 0.2, moveY: 0, aimAngle: 0, durationTicks: 3 }) },
      ],
    },
  ),
  makeScene(
    'ap2-boss3-armor-break',
    'Biome 3 Boss forge_titan Thermonuclear Armor (-75% DMG) shattered at F5 via Dash-Kicking a forge_blast_shield (-6% MaxHP true damage, 4.0s Stun, +40% EnemyVuln)',
    BIOME3_GAME_URL,
    'GameScene',
    setupAp2Boss3ArmorBreakScene,
    {
      captureStrip: true,
      frameCount: 8,
      heroFrameIndex: 4,
      apexEvent: {
        simEventKind: 'armor_broken',
      },
      actionRoi: {
        width: 520,
        height: 340,
        includeProjectiles: 'none',
        enemyKinds: ['forge_titan'],
        propKinds: ['forge_blast_shield', 'coal_bomb', 'slag_crucible'],
      },
      stripSchedule: [
        { stepCount: 0, stage: 'windup_hold', label: 'THERMAL ARMOR -75%' },
        { stepCount: 2, stage: 'trigger', label: 'KICK BLAST SHIELD!', beforeStep: (page) => triggerDash(page, 1, 0, 0, 2) },
        { stepCount: 2, stage: 'active', label: 'FIRE WAVE 520', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: -0.5, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 2, stage: 'active', label: 'THERMAL SURGE', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: -0.4, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 1, stage: 'apex', label: 'ARMOR OVERLOAD!', beforeStep: (page) => queueStepInput(page, { moveX: 0.4, moveY: 0.3, aimAngle: 0, durationTicks: 1 }) },
        { stepCount: 2, stage: 'sub_impact', label: 'STUNNED 4.0S!', beforeStep: (page) => queueStepInput(page, { moveX: 0.5, moveY: 0.3, aimAngle: 0, durationTicks: 2 }) },
        { stepCount: 3, stage: 'settled', label: '+40% VULN WINDOW', beforeStep: (page) => queueStepInput(page, { moveX: 0.3, moveY: 0.2, aimAngle: 0, durationTicks: 3 }) },
        { stepCount: 3, stage: 'settled', label: 'SETTLED', beforeStep: (page) => queueStepInput(page, { moveX: 0.2, moveY: 0, aimAngle: 0, durationTicks: 3 }) },
      ],
    },
  ),
];
