import type { Page } from '@playwright/test';
import {
  BIOME3_GAME_URL,
  DEFAULT_GAME_URL,
  lockCameraAndIrisToPlayer,
  makeScene,
  stepDeterministicFrames,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const P11_SCENE_IDS: readonly string[] = [
  'p11-boss-phase-transition',
  'p11-boss-enrage',
  'p11-wave-overlap-challenge',
  'boss-b1',
  'boss-b2',
  'boss-b3',
  'b1-combat',
  'b2-combat',
  'b3-combat',
];

export const P11_SCENE_GROUP = P11_SCENE_IDS;

/**
 * Biome 1 Boss `spore_king` in boss room just after transitioning into Phase 2 at ~64% HP.
 * In `before` (pre-P11), enemy projectiles remain in flight around the boss and no transition invuln/roar exists.
 * In `after` (P11), transitioning into Phase 2 clears active enemy projectiles, triggers 1.2s invulnerability +
 * roar shockwave ring + opening combo telegraph, and displays the phase transition state on the Boss HUD.
 */
export async function setupP11BossPhaseTransitionScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.advanceToFloor(2);
    const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
    sim.enterRoom(bossRoom.id);
    sim.consumeEvents();
    sim.projectiles.length = 0;
    sim.pickups.length = 0;

    Object.assign(sim.player, {
      godMode: true,
      x: 350,
      y: 300,
      prevX: 350,
      prevY: 300,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });

    const boss = sim.getActiveBoss();
    if (boss) {
      sim.enemies = [boss];
      Object.assign(boss, {
        x: 620,
        y: 300,
        prevX: 620,
        prevY: 300,
        vx: 0,
        vy: 0,
        spawnWarmupTimer: 0,
        aiState: 'idle',
        stateTimer: 1.0,
        bossPhase: 1,
        hp: boss.maxHp,
      });
    }
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const boss = sim.getActiveBoss();
    if (!boss) return;

    // Pre-existing enemy projectiles before Phase 2 transition (cleared in P11 `after` on phase change!)
    const preBullets: readonly [number, number, number, number][] = [
      [520, 245, -145, -25],
      [505, 285, -155, 0],
      [520, 325, -145, 25],
      [555, 265, -135, -15],
      [555, 335, -135, 15],
    ];
    preBullets.forEach(([bx, by, vx, vy], idx) => {
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 94100 + idx,
          ownerId: boss.id,
          isEnemy: true,
          x: bx,
          y: by,
          vx,
          vy,
          radius: 5.5,
          damage: 2,
          colorHex: '#E84545',
          ttlSec: 2.5,
          pierceCount: 0,
          bounceCount: 0,
          homingStrength: 0,
          explosionRadius: 0,
          isCrit: false,
          element: 'poison',
          knockback: 40,
        }),
      );
    });

    // Bring boss from 100% -> ~64% HP to trigger Phase 1 -> Phase 2 transition
    const damageToPhase2 = Math.ceil(boss.maxHp * 0.36);
    sim.applyDamageToEnemy(boss, damageToPhase2, false, 'none', 0, 0, true, sim.player.id);
    boss.x = 620;
    boss.y = 300;
    boss.prevX = 620;
    boss.prevY = 300;
    boss.vx = 0;
    boss.vy = 0;

    let minionIdx = 0;
    for (const e of sim.enemies) {
      if (e.id !== boss.id) {
        e.x = 560;
        e.y = minionIdx % 2 === 0 ? 225 : 375;
        e.prevX = e.x;
        e.prevY = e.y;
        e.vx = 0;
        e.vy = 0;
        e.spawnWarmupTimer = 0;
        minionIdx += 1;
      }
    }
  });

  await stepDeterministicFrames(page, 2);
}

/**
 * Biome 3 Boss `forge_titan` in boss room during late-fight Enrage (> 90s elapsed, ~30% HP).
 * In `before` (pre-P11), the boss has no soft-enrage timer/stacks, no crimson enrage aura, and no HUD enrage badge.
 * In `after` (P11), elapsed fight time >= 120s activates soft enrage stacks (cooldown x0.81..x0.75), crimson aura/border,
 * and HUD Enrage indicator.
 */
export async function setupP11BossEnrageScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.advanceToFloor(6);
    const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
    sim.enterRoom(bossRoom.id);
    sim.consumeEvents();
    sim.projectiles.length = 0;
    sim.pickups.length = 0;

    Object.assign(sim.player, {
      godMode: true,
      x: 350,
      y: 300,
      prevX: 350,
      prevY: 300,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });

    const boss = sim.getActiveBoss();
    if (boss) {
      boss.x = 640;
      boss.y = 300;
      boss.prevX = 640;
      boss.prevY = 300;
      boss.spawnWarmupTimer = 0;
      // Transition through Phase 2 and into Phase 3 (~30% HP)
      sim.applyDamageToEnemy(boss, Math.ceil(boss.maxHp * 0.36), false, 'none', 0, 0);
      boss.bossPhaseTransitionTimer = 0;
      sim.applyDamageToEnemy(boss, Math.ceil(boss.maxHp * 0.34), false, 'none', 0, 0);
      boss.bossPhaseTransitionTimer = 0;
      boss.x = 640;
      boss.y = 300;
      boss.prevX = 640;
      boss.prevY = 300;
      boss.vx = 0;
      boss.vy = 0;
      boss.aiState = 'telegraph';
      boss.stateTimer = 0.48;
      boss.telegraphDurationSec = 0.54;

      // Set P11 soft-enrage state (135s elapsed -> 3 enrage stacks after 90s threshold)
      boss.bossCombatElapsedSec = 135;
      boss.bossEnrageLevel = 3;
      const bossExt = boss as unknown as Record<string, unknown>;
      bossExt.bossFightElapsedSec = 135;
      bossExt.bossEnrageStacks = 3;
      bossExt.bossEnraged = true;
      bossExt.bossPhaseTransitionTimer = 0;
      bossExt.invulnerableTimer = 0;

      const simExt = sim as unknown as Record<string, unknown>;
      simExt.bossFightElapsedSec = 135;

      let minionIdx = 0;
      for (const e of sim.enemies) {
        if (e.id !== boss.id) {
          e.x = 565;
          e.y = minionIdx % 2 === 0 ? 215 : 385;
          e.prevX = e.x;
          e.prevY = e.y;
          e.vx = 0;
          e.vy = 0;
          e.spawnWarmupTimer = 0;
          e.aiState = 'idle';
          e.stateTimer = 99;
          minionIdx += 1;
        }
      }

      sim.shockwaveRings.push({
        id: 96111,
        sourceEnemyId: boss.id,
        x: boss.x,
        y: boss.y,
        radius: 96,
        maxRadius: 360,
        speed: 45,
        thickness: 22,
        damage: boss.damage,
        hitPlayerIds: [],
      });

      const barrageAngles = [-0.28, -0.14, 0, 0.14, 0.28];
      barrageAngles.forEach((ang, idx) => {
        sim.projectiles.push(
          sim.acquireProjectile({
            id: 94200 + idx,
            ownerId: boss.id,
            isEnemy: true,
            x: boss.x - 54,
            y: boss.y + (idx - 2) * 20,
            vx: Math.cos(Math.PI + ang) * 185,
            vy: Math.sin(Math.PI + ang) * 185,
            radius: 6,
            damage: 3,
            colorHex: '#E84545',
            ttlSec: 2.5,
            pierceCount: 0,
            bounceCount: 0,
            homingStrength: 0,
            explosionRadius: 0,
            isCrit: false,
            element: 'burn',
            knockback: 45,
          }),
        );
      });
    }
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 42);
}

/**
 * Biome 1 Combat room with overlapping wave spawn (Wave 2 spawning with 0.8s summoning circles while Wave 1
 * still has active enemies + Elites (`volley` / `vengeful` / `shield`)).
 */
export async function setupP11WaveOverlapChallengeScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(combatRoom.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;

    combatRoom.cleared = false;
    combatRoom.wavesTotal = 3;
    combatRoom.wavesSpawned = 2;
    combatRoom.isChallenge = true;
    sim.waveNumber = 2;
    (combatRoom as unknown as Record<string, unknown>).isChallengeRoom = true;

    Object.assign(sim.player, {
      godMode: true,
      x: 335,
      y: 270,
      prevX: 335,
      prevY: 270,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });

    // Remaining Wave 1 enemies (25% left -> triggers Wave 2 overlap!)
    const w1EliteA = sim.spawnEnemy('goblin_shooter', 495, 225, true, 'volley');
    const w1EliteB = sim.spawnEnemy('wild_boar', 510, 320, true, 'vengeful');
    // Tag elite modifiers so P11 `after` can showcase new `volley` / `vengeful` modifiers
    (w1EliteA as unknown as Record<string, unknown>).p11PreferredModifier = 'volley';
    (w1EliteB as unknown as Record<string, unknown>).p11PreferredModifier = 'vengeful';

    for (const e of [w1EliteA, w1EliteB]) {
      e.hp = 900;
      e.maxHp = 900;
      e.isDummy = false;
      e.spawnWarmupTimer = 0;
      e.aiState = 'idle';
      e.stateTimer = 99;
      e.vx = 0;
      e.vy = 0;
    }
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 40);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    // Spawn overlapping Wave 2 enemies with 0.8s summoning warning circles alongside Wave 1 survivors
    const w2Spawns: Array<[string, number, number, 'shield' | 'fast' | null, number]> = [
      ['goblin_shooter', 600, 195, null, 0.76],
      ['spore_bomber', 655, 245, null, 0.72],
      ['goblin_shaman', 610, 345, 'shield', 0.68],
      ['thorn_turret', 690, 295, null, 0.74],
    ];
    for (const [defId, ex, ey, mod, timer] of w2Spawns) {
      const e = sim.spawnEnemy(defId, ex, ey, false, mod);
      e.hp = 900;
      e.maxHp = 900;
      e.waveIndex = 2;
      e.aiState = 'spawning';
      e.stateTimer = timer;
      e.spawnWarmupTimer = timer;
      e.vx = 0;
      e.vy = 0;
    }

    // Active Vengeful death ring telegraph on floor
    sim.pendingVengefulRings.push({
      id: 99001,
      ownerId: 299,
      x: 535,
      y: 275,
      timerSec: 0.25,
      damage: 2,
    });

    // Active enemy volley from Wave 1 Elite
    const ownerId = sim.enemies[0]?.id ?? 200;
    [-0.18, 0, 0.18].forEach((ang, idx) => {
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 94300 + idx,
          ownerId,
          isEnemy: true,
          x: 455 - idx * 14,
          y: 225 + (idx - 1) * 18,
          vx: Math.cos(Math.PI + ang) * 175,
          vy: Math.sin(Math.PI + ang) * 175,
          radius: 5,
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
    });

    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          hudScene?: {
            triggerWaveBanner?: (wave: number, total: number, isChallenge?: boolean) => void;
          };
        }
      | undefined;
    gs?.hudScene?.triggerWaveBanner?.(2, 3, true);
  });

  await stepDeterministicFrames(page, 2);
}

export const P11_VISUAL_SCENES: readonly VisualSceneDef[] = [
  makeScene(
    'p11-boss-phase-transition',
    'Biome 1 Boss Mục Vương Nấm Độc transitioning into Phase 2 (~64% HP) with 8-frame strip',
    DEFAULT_GAME_URL,
    'GameScene',
    setupP11BossPhaseTransitionScene,
    { captureStrip: true, stripFramesPerStep: 5 },
  ),
  makeScene(
    'p11-boss-enrage',
    'Biome 3 Boss Titan Lò Rèn during late-fight Enrage (~30% HP, >90s elapsed) with 8-frame strip',
    BIOME3_GAME_URL,
    'GameScene',
    setupP11BossEnrageScene,
    { captureStrip: true, stripFramesPerStep: 5 },
  ),
  makeScene(
    'p11-wave-overlap-challenge',
    'Biome 1 Combat room with Wave 2 overlapping spawn circles alongside active Wave 1 Elites across 8-frame strip',
    DEFAULT_GAME_URL,
    'GameScene',
    setupP11WaveOverlapChallengeScene,
    { captureStrip: true, stripFramesPerStep: 5 },
  ),
];
