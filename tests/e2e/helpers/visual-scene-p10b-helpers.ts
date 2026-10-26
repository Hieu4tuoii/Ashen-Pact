import type { Page } from '@playwright/test';
import {
  BIOME2_GAME_URL,
  BIOME3_GAME_URL,
  DEFAULT_GAME_URL,
  lockCameraAndIrisToPlayer,
  makeScene,
  stepDeterministicFrames,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const P10B_SCENE_GROUP: readonly string[] = [
  'p10b-fx-shoot-hit',
  'p10b-fx-explosion',
  'p10b-fx-elemental-combo',
  'p10b-fx-chest-open',
  'p10b-fx-enemy-spawn',
  'p10b-fx-boss-kill',
  'p10b-ambient-b1',
  'p10b-ambient-b2',
  'p10b-ambient-b3',
  'b1-combat',
  'b2-combat',
  'b3-combat',
  'b1-combat-4p',
  'stress-4p',
  'boss-b2-blizzard',
  'hub-solo',
];

export async function setupP10bShootHitScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;

    sim.selectCharacter(sim.player.id, 'vanguard');
    Object.assign(sim.player, {
      godMode: true,
      x: 340,
      y: 270,
      prevX: 340,
      prevY: 270,
      vx: 0,
      vy: 0,
      aimAngle: 0,
      weaponSlots: ['gale_smg', 'scrap_shotgun'],
      activeWeaponSlot: 0,
    });

    const e1 = sim.spawnEnemy('goblin_shooter', 475, 224, true);
    const e2 = sim.spawnEnemy('wild_boar', 495, 270, true);
    const e3 = sim.spawnEnemy('iron_shielder', 475, 318, true, 'shield');
    for (const e of [e1, e2, e3]) {
      e.hp = 9999;
      e.maxHp = 9999;
      e.isDummy = true;
      e.spawnWarmupTimer = 0;
      e.aiState = 'idle';
      e.stateTimer = 99;
      e.vx = 0;
      e.vy = 0;
      e.aimAngle = Math.PI;
    }
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 42);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          fx?: {
            spawnMuzzleFlashAndCasing: (
              x: number,
              y: number,
              angleRad: number,
              isShotgun?: boolean,
            ) => void;
            spawnHitSparks: (
              x: number,
              y: number,
              impactAngleRad: number,
              options?: {
                isCrit?: boolean;
                hitWall?: boolean;
                blockedByShield?: boolean;
                element?: 'none' | 'burn' | 'chill' | 'shock' | 'poison';
                count?: number;
              },
            ) => void;
            spawnDamagePopup: (params: {
              x: number;
              y: number;
              amount: number;
              isCrit: boolean;
              targetKind: 'player' | 'enemy';
              hitArmor: boolean;
              element?: 'none' | 'burn' | 'chill' | 'shock' | 'poison';
            }) => void;
          };
          playerRig?: { triggerRecoil?: (s?: number) => void };
          syncProjectilesAndPickups?: () => void;
          __p10bShootHookInstalled?: boolean;
        }
      | undefined;
    if (!gs || !gs.fx) return;

    let stepCounter = 0;
    const triggerBurst = (stepIdx: number) => {
      const fx = gs.fx!;
      sim.player.x = 340;
      sim.player.y = 270;
      sim.player.prevX = 340;
      sim.player.prevY = 270;
      for (const e of sim.enemies) {
        e.vx = 0;
        e.vy = 0;
        e.kbVx = 0;
        e.kbVy = 0;
      }
      if (sim.enemies[0]) {
        sim.enemies[0].x = 475;
        sim.enemies[0].y = 224;
      }
      if (sim.enemies[1]) {
        sim.enemies[1].x = 495;
        sim.enemies[1].y = 270;
      }
      if (sim.enemies[2]) {
        sim.enemies[2].x = 475;
        sim.enemies[2].y = 318;
      }

      if (stepIdx % 2 === 0) {
        const shotIdx = Math.floor(stepIdx / 2);
        const angleOffset = ((shotIdx % 3) - 1) * 0.06;
        fx.spawnMuzzleFlashAndCasing(362, 266, angleOffset, shotIdx % 2 === 0);
        gs.playerRig?.triggerRecoil?.(5.2);

        fx.spawnHitSparks(470, 224, 0, {
          isCrit: shotIdx % 2 === 1,
          element: 'burn',
          count: 7,
        });
        fx.spawnHitSparks(488, 270, 0, {
          isCrit: true,
          element: 'shock',
          count: 9,
        });
        fx.spawnHitSparks(468, 318, 0, {
          isCrit: false,
          blockedByShield: true,
          element: 'chill',
          count: 6,
        });

        if (shotIdx % 2 === 0) {
          fx.spawnDamagePopup({
            x: 495,
            y: 268,
            amount: 38 + shotIdx * 3,
            isCrit: true,
            targetKind: 'enemy',
            hitArmor: false,
            element: 'shock',
          });
          fx.spawnDamagePopup({
            x: 475,
            y: 222,
            amount: 19 + shotIdx * 2,
            isCrit: false,
            targetKind: 'enemy',
            hitArmor: false,
            element: 'burn',
          });
        }
      }

      // Keep active player & enemy projectiles clearly visible in flight
      sim.projectiles.length = 0;
      const travel = (stepIdx * 7) % 56;
      const pBullets: Array<{
        id: number;
        x: number;
        y: number;
        element: 'none' | 'burn' | 'chill' | 'shock' | 'poison';
        weaponId: string;
      }> = [
        { id: 91001, x: 382 + travel, y: 236, element: 'burn', weaponId: 'gale_smg' },
        { id: 91002, x: 398 + travel, y: 266, element: 'shock', weaponId: 'gale_smg' },
        { id: 91003, x: 374 + travel, y: 274, element: 'none', weaponId: 'scrap_shotgun' },
        { id: 91004, x: 386 + travel, y: 304, element: 'chill', weaponId: 'gale_smg' },
      ];
      for (const pb of pBullets) {
        sim.projectiles.push(
          sim.acquireProjectile({
            id: pb.id,
            ownerId: sim.player.id,
            isEnemy: false,
            x: pb.x,
            y: pb.y,
            vx: 420,
            vy: 0,
            radius: 4,
            damage: 12,
            colorHex: '#38BDF8',
            ttlSec: 1.5,
            pierceCount: 0,
            bounceCount: 0,
            homingStrength: 0,
            explosionRadius: 0,
            isCrit: pb.element === 'shock',
            element: pb.element,
            knockback: 25,
            weaponId: pb.weaponId,
          }),
        );
      }

      const enemyOwnerId = sim.enemies[0]?.id ?? 200;
      const eBullets: Array<[number, number, 'none' | 'burn' | 'chill']> = [
        [436 - travel * 0.6, 198, 'none'],
        [448 - travel * 0.6, 248, 'burn'],
        [432 - travel * 0.6, 344, 'chill'],
      ];
      eBullets.forEach(([bx, by, elem], idx) => {
        sim.projectiles.push(
          sim.acquireProjectile({
            id: 91100 + idx,
            ownerId: enemyOwnerId,
            isEnemy: true,
            x: bx,
            y: by,
            vx: -165,
            vy: 0,
            radius: 5.5,
            damage: 2,
            colorHex: '#E84545',
            ttlSec: 2.5,
            pierceCount: 0,
            bounceCount: 0,
            homingStrength: 0,
            explosionRadius: 0,
            isCrit: false,
            element: elem,
            knockback: 40,
          }),
        );
      });
    };

    triggerBurst(0);

    if (!gs.__p10bShootHookInstalled && gs.syncProjectilesAndPickups) {
      gs.__p10bShootHookInstalled = true;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        stepCounter += 1;
        triggerBurst(stepCounter);
        origSync();
      };
    }
  });

  await stepDeterministicFrames(page, 1);
}

export async function setupP10bExplosionScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;

    Object.assign(sim.player, {
      godMode: true,
      x: 315,
      y: 270,
      prevX: 315,
      prevY: 270,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });

    const e1 = sim.spawnEnemy('goblin_shooter', 455, 215, true);
    const e2 = sim.spawnEnemy('spore_bomber', 555, 305, true);
    for (const e of [e1, e2]) {
      e.hp = 9999;
      e.maxHp = 9999;
      e.isDummy = true;
      e.spawnWarmupTimer = 0;
      e.aiState = 'idle';
      e.stateTimer = 99;
    }
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 42);

  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          fx?: {
            spawnExplosionBurst: (
              x: number,
              y: number,
              radius: number,
              colorHex?: string,
            ) => void;
            spawnPropBreakBurst: (
              kind: 'wooden_crate' | 'clay_vase' | 'explosive_barrel',
              x: number,
              y: number,
            ) => void;
          };
          lighting?: {
            spawnTransientLight: (
              x: number,
              y: number,
              radius: number,
              colorHex: string,
              alpha: number,
              ttlSec: number,
            ) => void;
          };
          syncProjectilesAndPickups?: () => void;
          __p10bExplosionHookInstalled?: boolean;
        }
      | undefined;
    if (!gs || !gs.fx) return;

    gs.fx.spawnExplosionBurst(445, 235, 82, '#F97316');
    gs.fx.spawnExplosionBurst(540, 295, 86, '#A855F7');
    gs.fx.spawnPropBreakBurst('wooden_crate', 485, 252);
    gs.fx.spawnPropBreakBurst('clay_vase', 495, 320);
    gs.lighting?.spawnTransientLight(445, 235, 165, '#F97316', 1.0, 0.38);
    gs.lighting?.spawnTransientLight(540, 295, 175, '#A855F7', 1.0, 0.38);

    let stepCounter = 0;
    if (!gs.__p10bExplosionHookInstalled && gs.syncProjectilesAndPickups) {
      gs.__p10bExplosionHookInstalled = true;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        stepCounter += 1;
        if (stepCounter === 4) {
          gs.fx?.spawnExplosionBurst(492, 266, 78, '#FACC15');
          gs.lighting?.spawnTransientLight(492, 266, 160, '#FACC15', 1.0, 0.36);
        } else if (stepCounter === 8) {
          gs.fx?.spawnExplosionBurst(455, 305, 74, '#F97316');
          gs.fx?.spawnPropBreakBurst('wooden_crate', 520, 232);
          gs.lighting?.spawnTransientLight(455, 305, 155, '#F97316', 1.0, 0.36);
        }
        origSync();
      };
    }
  });

  await stepDeterministicFrames(page, 1);
}

export async function setupP10bElementalComboScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;

    sim.selectCharacter(sim.player.id, 'elementalist');
    Object.assign(sim.player, {
      godMode: true,
      x: 330,
      y: 270,
      prevX: 330,
      prevY: 270,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });

    const e1 = sim.spawnEnemy('wild_boar', 465, 220, true);
    const e2 = sim.spawnEnemy('goblin_shaman', 535, 270, true, 'shield');
    const e3 = sim.spawnEnemy('spore_bomber', 465, 320, true);
    for (const e of [e1, e2, e3]) {
      e.hp = 9999;
      e.maxHp = 9999;
      e.isDummy = true;
      e.spawnWarmupTimer = 0;
      e.aiState = 'idle';
      e.stateTimer = 99;
      e.vx = 0;
      e.vy = 0;
    }
    e1.chillStacks = 2;
    e1.frozenTimer = 2.5;
    e2.burnTimer = 4.0;
    e2.chillStacks = 2;
    e2.shockTimer = 4.0;
    e3.poisonStacks = 3;
    e3.shockTimer = 4.0;
    e3.superconductTimer = 4.0;
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 42);

  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          fx?: {
            spawnElementalReactionFx: (params: {
              reaction:
                | 'vaporize'
                | 'shatter'
                | 'superconduct'
                | 'toxic_blast'
                | 'paralysis'
                | 'overload';
              x: number;
              y: number;
              damage: number;
              isTeamCombo: boolean;
            }) => void;
            spawnChainLightningArc: (
              fromX: number,
              fromY: number,
              toX: number,
              toY: number,
            ) => void;
          };
          lighting?: {
            spawnTransientLight: (
              x: number,
              y: number,
              radius: number,
              colorHex: string,
              alpha: number,
              ttlSec: number,
            ) => void;
          };
          syncProjectilesAndPickups?: () => void;
          __p10bComboHookInstalled?: boolean;
        }
      | undefined;
    if (!gs || !gs.fx) return;

    gs.fx.spawnElementalReactionFx({
      reaction: 'shatter',
      x: 465,
      y: 220,
      damage: 36,
      isTeamCombo: false,
    });
    gs.fx.spawnElementalReactionFx({
      reaction: 'superconduct',
      x: 465,
      y: 320,
      damage: 28,
      isTeamCombo: true,
    });
    // Coalesce 3 rapid vaporize reactions so banner & world callout show "HƠI NƯỚC ×3"
    gs.fx.spawnElementalReactionFx({
      reaction: 'vaporize',
      x: 535,
      y: 270,
      damage: 26,
      isTeamCombo: false,
    });
    gs.fx.spawnElementalReactionFx({
      reaction: 'vaporize',
      x: 538,
      y: 266,
      damage: 26,
      isTeamCombo: false,
    });
    gs.fx.spawnElementalReactionFx({
      reaction: 'vaporize',
      x: 532,
      y: 274,
      damage: 34,
      isTeamCombo: true,
    });
    gs.fx.spawnChainLightningArc(465, 220, 535, 270);
    gs.fx.spawnChainLightningArc(535, 270, 465, 320);
    gs.lighting?.spawnTransientLight(535, 270, 170, '#38BDF8', 0.96, 0.38);

    let stepCounter = 0;
    if (!gs.__p10bComboHookInstalled && gs.syncProjectilesAndPickups) {
      gs.__p10bComboHookInstalled = true;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        stepCounter += 1;
        if (stepCounter === 4) {
          gs.fx?.spawnElementalReactionFx({
            reaction: 'overload',
            x: 465,
            y: 320,
            damage: 32,
            isTeamCombo: false,
          });
          gs.fx?.spawnElementalReactionFx({
            reaction: 'vaporize',
            x: 535,
            y: 270,
            damage: 28,
            isTeamCombo: true,
          });
          gs.fx?.spawnChainLightningArc(465, 320, 535, 270);
        } else if (stepCounter === 8) {
          gs.fx?.spawnElementalReactionFx({
            reaction: 'toxic_blast',
            x: 465,
            y: 220,
            damage: 30,
            isTeamCombo: false,
          });
          gs.fx?.spawnElementalReactionFx({
            reaction: 'vaporize',
            x: 535,
            y: 270,
            damage: 30,
            isTeamCombo: true,
          });
        }
        origSync();
      };
    }
  });

  await stepDeterministicFrames(page, 1);
}

export async function setupP10bChestOpenScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const room = sim.dungeon.rooms.find((r) => r.type === 'treasure') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(room.id);
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.pickups.length = 0;
    sim.consumeEvents();

    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;
    sim.spawnChest(cx - 28, cy - 12, 'legendary', 'solar_archon_staff');
    sim.spawnChest(cx + 42, cy + 16, 'epic', 'scrap_shotgun');

    Object.assign(sim.player, {
      godMode: true,
      x: cx - 92,
      y: cy + 8,
      prevX: cx - 92,
      prevY: cy + 8,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 42);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    for (const ch of sim.chests) {
      sim.openChest(ch);
    }
  });

  await stepDeterministicFrames(page, 1);
}

export async function setupP10bEnemySpawnScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;

    Object.assign(sim.player, {
      godMode: true,
      x: 330,
      y: 270,
      prevX: 330,
      prevY: 270,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 42);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const e1 = sim.spawnEnemy('goblin_shooter', 465, 215, false);
    const e2 = sim.spawnEnemy('wild_boar', 545, 238, false);
    const e3 = sim.spawnEnemy('spore_bomber', 475, 322, false);
    const e4 = sim.spawnEnemy('goblin_shaman', 565, 315, false, 'shield');
    const timers = [0.72, 0.62, 0.52, 0.68];
    [e1, e2, e3, e4].forEach((e, idx) => {
      e.hp = 999;
      e.maxHp = 999;
      e.aiState = 'spawning';
      e.stateTimer = timers[idx]!;
      e.spawnWarmupTimer = timers[idx]!;
    });
  });

  await stepDeterministicFrames(page, 1);
}

export async function setupP10bBossKillScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.advanceToFloor(2);
    const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
    sim.enterRoom(bossRoom.id);
    sim.consumeEvents();

    Object.assign(sim.player, {
      godMode: true,
      x: 355,
      y: 300,
      prevX: 355,
      prevY: 300,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });

    const boss = sim.getActiveBoss();
    if (boss) {
      sim.enemies = [boss];
      boss.x = 525;
      boss.y = 295;
      boss.prevX = 525;
      boss.prevY = 295;
      boss.vx = 0;
      boss.vy = 0;
      boss.spawnWarmupTimer = 0;
      boss.aiState = 'idle';
      boss.stateTimer = 99;
    }
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 42);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const boss = sim.getActiveBoss() ?? sim.enemies[0];
    if (boss) {
      boss.hp = 0;
      sim.handleEnemyKilled(boss, sim.player.id);
    }
  });

  await stepDeterministicFrames(page, 1);
}

export async function setupP10bAmbientB1Scene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;

    // Place 4 braziers around the camera view to showcase warm light pool dust motes alongside forest leaves & fireflies
    sim.spawnProp('torch_brazier', 390, 205);
    sim.spawnProp('torch_brazier', 570, 205);
    sim.spawnProp('torch_brazier', 390, 335);
    sim.spawnProp('torch_brazier', 570, 335);

    Object.assign(sim.player, {
      godMode: true,
      x: 480,
      y: 270,
      prevX: 480,
      prevY: 270,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | { fx?: { setAllowFreezeAmbientMotion?: (active: boolean) => void } }
      | undefined;
    gs?.fx?.setAllowFreezeAmbientMotion?.(true);
  });
  await stepDeterministicFrames(page, 45);
}

export async function setupP10bAmbientB2Scene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;

    Object.assign(sim.player, {
      godMode: true,
      x: 480,
      y: 270,
      prevX: 480,
      prevY: 270,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });
  });

  await lockCameraAndIrisToPlayer(page);
  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | { fx?: { setAllowFreezeAmbientMotion?: (active: boolean) => void } }
      | undefined;
    gs?.fx?.setAllowFreezeAmbientMotion?.(true);
  });
  await stepDeterministicFrames(page, 45);
}

export async function setupP10bAmbientB3Scene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;

    sim.spawnProp('torch_brazier', 395, 205);
    sim.spawnProp('torch_brazier', 565, 205);
    sim.spawnProp('torch_brazier', 395, 335);
    sim.spawnProp('torch_brazier', 565, 335);

    Object.assign(sim.player, {
      godMode: true,
      x: 360,
      y: 270,
      prevX: 360,
      prevY: 270,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });

    const imp = sim.spawnEnemy('fire_imp', 600, 270, true);
    imp.hp = 9999;
    imp.maxHp = 9999;
    imp.isDummy = true;
    imp.spawnWarmupTimer = 0;
    imp.aiState = 'idle';
    imp.stateTimer = 99;
  });

  await lockCameraAndIrisToPlayer(page);
  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | { fx?: { setAllowFreezeAmbientMotion?: (active: boolean) => void } }
      | undefined;
    gs?.fx?.setAllowFreezeAmbientMotion?.(true);
  });
  await stepDeterministicFrames(page, 40);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const ownerId = sim.enemies[0]?.id ?? 200;
    const coords: readonly [number, number][] = [
      [535, 225],
      [560, 270],
      [535, 315],
    ];
    coords.forEach(([bx, by], idx) => {
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 93000 + idx,
          ownerId,
          isEnemy: true,
          x: bx,
          y: by,
          vx: -80,
          vy: 0,
          radius: 5.5,
          damage: 3,
          colorHex: '#E84545',
          ttlSec: 3.0,
          pierceCount: 0,
          bounceCount: 0,
          homingStrength: 0,
          explosionRadius: 0,
          isCrit: false,
          element: 'burn',
          knockback: 40,
        }),
      );
    });
  });

  await stepDeterministicFrames(page, 5);
}

export const P10B_VISUAL_SCENES: readonly VisualSceneDef[] = [
  makeScene(
    'p10b-fx-shoot-hit',
    'Biome 1 combat FX showcase: multi-layer additive muzzle flash, shell casing with shadow, hit spark trails, and impact rings with 8-frame strip',
    DEFAULT_GAME_URL,
    'GameScene',
    setupP10bShootHitScene,
    { captureStrip: true, stripFramesPerStep: 2 },
  ),
  makeScene(
    'p10b-fx-explosion',
    'Biome 1 explosion & prop break FX showcase with shockwave rings and scorch decals across 8-frame strip',
    DEFAULT_GAME_URL,
    'GameScene',
    setupP10bExplosionScene,
    { captureStrip: true, stripFramesPerStep: 2 },
  ),
  makeScene(
    'p10b-fx-elemental-combo',
    'Biome 1 Elemental Reactions showcase with expanding shockwave rings, additive elemental bursts, and coalesced HƠI NƯỚC ×3 callout across 8-frame strip',
    DEFAULT_GAME_URL,
    'GameScene',
    setupP10bElementalComboScene,
    { captureStrip: true, stripFramesPerStep: 2 },
  ),
  makeScene(
    'p10b-fx-chest-open',
    'Biome 1 treasure room chest opening with lid bounce, rarity light pillar, and parabolic loot arc across 8-frame strip',
    DEFAULT_GAME_URL,
    'GameScene',
    setupP10bChestOpenScene,
    { captureStrip: true, stripFramesPerStep: 2 },
  ),
  makeScene(
    'p10b-fx-enemy-spawn',
    'Biome 1 enemy spawning warmup with counter-rotating rune summoning circles and vertical light pillars across 8-frame strip',
    DEFAULT_GAME_URL,
    'GameScene',
    setupP10bEnemySpawnScene,
    { captureStrip: true, stripFramesPerStep: 3 },
  ),
  makeScene(
    'p10b-fx-boss-kill',
    'Biome 1 Spore King boss defeat with slow-mo flash, double shockwave rings, and cutout shatter burst across 8-frame strip',
    DEFAULT_GAME_URL,
    'GameScene',
    setupP10bBossKillScene,
    { captureStrip: true, stripFramesPerStep: 2 },
  ),
  makeScene(
    'p10b-ambient-b1',
    'Biome 1 clear ambient particles (drifting forest leaves, glowing fireflies, torch brazier dust motes, zero fog) across 8-frame strip',
    DEFAULT_GAME_URL,
    'GameScene',
    setupP10bAmbientB1Scene,
    { captureStrip: true, stripFramesPerStep: 4 },
  ),
  makeScene(
    'p10b-ambient-b2',
    'Biome 2 clear ambient particles (60-80 soft round 2-4px snowflakes with sinusoidal sway and 2-layer parallax, zero fog) across 8-frame strip',
    BIOME2_GAME_URL,
    'GameScene',
    setupP10bAmbientB2Scene,
    { captureStrip: true, stripFramesPerStep: 4 },
  ),
  makeScene(
    'p10b-ambient-b3',
    'Biome 3 clear ambient particles (<= 4px un-outlined rising embers + torch dust motes vs distinct enemy bullets) across 8-frame strip',
    BIOME3_GAME_URL,
    'GameScene',
    setupP10bAmbientB3Scene,
    { captureStrip: true, stripFramesPerStep: 4 },
  ),
];
