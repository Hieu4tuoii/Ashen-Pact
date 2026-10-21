import type { Page } from '@playwright/test';
import {
  DEFAULT_GALLERY_URL,
  DEFAULT_GAME_URL,
  lockCameraAndIrisToPlayer,
  makeScene,
  stepDeterministicFrames,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const P10A_SCENE_GROUP: readonly string[] = [
  'gallery-p1',
  'gallery-characters-idle',
  'gallery-characters',
  'gallery-characters-attack',
  'gallery-characters-dash',
  'gallery-characters-hurt',
  'gallery-characters-crossfade',
  'gallery-enemies-b1',
  'gallery-enemies',
  'p10a-ingame-poses',
  'hub-solo',
  'b1-combat',
  'b2-combat',
  'b3-combat',
  'b1-combat-4p',
  'b1-combat-downed',
  'boss-b1',
  'boss-b2',
  'boss-b3',
];

export async function setupP10aIngamePosesScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    sim.enterRoom(sim.dungeon.startRoomId);
    sim.skipCurrentRoomWaves();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.worldItems.length = 0;
    sim.summons.length = 0;
    sim.skillZones.length = 0;

    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'vanguard');
    Object.assign(p1, {
      godMode: true,
      x: 340,
      y: 265,
      prevX: 340,
      prevY: 265,
      vx: 0,
      vy: 0,
      aimAngle: 0.08,
      recoilTimer: 0.1,
    });

    const p2 = sim.addCoopPlayer(2, 'ranger', 'Ưng Nhãn P2', 2);
    const p3 = sim.addCoopPlayer(3, 'elementalist', 'Lam Hỏa P3', 3);
    const p4 = sim.addCoopPlayer(4, 'druid', 'Mộc Linh P4', 4);
    const p5 = sim.createPlayerState(5, 1, 'engineer', 340, 200, 'Bánh Răng P5');
    sim.simulatedPlayers.push(p5);
    sim.coopPlayerInputs.clear();

    Object.assign(p2, {
      godMode: true,
      x: 268,
      y: 222,
      prevX: 268,
      prevY: 222,
      vx: 210,
      vy: 0,
      dashTimer: 0.28,
      aimAngle: 0.05,
    });
    Object.assign(p3, {
      godMode: true,
      x: 268,
      y: 308,
      prevX: 268,
      prevY: 308,
      vx: 0,
      vy: 0,
      skillActiveTimer: 2.2,
      aimAngle: -0.06,
    });
    Object.assign(p4, {
      godMode: true,
      x: 340,
      y: 332,
      prevX: 340,
      prevY: 332,
      vx: -48,
      vy: 0,
      hurtFlashTimer: 0.09,
      aimAngle: 0.12,
    });
    Object.assign(p5, {
      godMode: true,
      x: 340,
      y: 202,
      prevX: 340,
      prevY: 202,
      vx: 155,
      vy: 0,
      aimAngle: 0.04,
    });

    const e1 = sim.spawnEnemy('goblin_shooter', 492, 214, true);
    const e2 = sim.spawnEnemy('ice_golem', 548, 270, true, 'shield');
    const e3 = sim.spawnEnemy('fire_imp', 492, 326, true);
    for (const e of [e1, e2, e3]) {
      e.hp = 5000;
      e.maxHp = 5000;
      e.isDummy = true;
      e.spawnWarmupTimer = 0;
      e.aimAngle = Math.PI;
    }
    e1.vx = -115;
    e1.vy = 0;
    e1.aiState = 'move';

    e2.vx = 0;
    e2.vy = 0;
    e2.aiState = 'telegraph';
    e2.telegraphDurationSec = 1.0;
    e2.stateTimer = 0.42;

    e3.vx = -80;
    e3.vy = 0;
    e3.aiState = 'idle';
    e3.hitFlashTimer = 0.08;
  });

  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 38);

  await page.evaluate(() => {
    type ShowcaseRig = {
      setAnimState?: (s: string) => void;
      setDashActive?: (a: boolean) => void;
      setMoveVelocity?: (vx: number, vy: number) => void;
      triggerRecoil?: (s?: number) => void;
      triggerMeleeSwing?: () => void;
      triggerHitFlash?: (d?: number) => void;
      triggerCastPose?: (d?: number) => void;
      setTelegraphProgress?: (p: number) => void;
      update?: (dt: number) => void;
    };
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          playerRig?: ShowcaseRig;
          coopPlayerRigs?: Map<number, { rig: ShowcaseRig }>;
          enemyRigs?: Map<number, ShowcaseRig>;
          __p10aPoseHookInstalled?: boolean;
          syncEnemyRigs?: (dt: number) => void;
        }
      | undefined;
    const sim = window.__GAME_TRANSPORT__?.getSim();
    if (!gs || !sim) return;

    const applyShowcasePoses = () => {
      sim.player.x = 340;
      sim.player.y = 265;
      sim.player.prevX = 340;
      sim.player.prevY = 265;
      sim.player.recoilTimer = 0.1;

      const p1Rig = gs.playerRig;
      if (p1Rig) {
        p1Rig.setMoveVelocity?.(90, 0);
        p1Rig.setAnimState?.('attack');
      }

      const p2Rig = gs.coopPlayerRigs?.get(2)?.rig;
      if (p2Rig) {
        p2Rig.setDashActive?.(true);
        p2Rig.setMoveVelocity?.(220, 0);
        p2Rig.setAnimState?.('dash');
      }

      const p3Rig = gs.coopPlayerRigs?.get(3)?.rig;
      if (p3Rig) {
        p3Rig.setMoveVelocity?.(0, 0);
        p3Rig.triggerCastPose?.(0.5);
        p3Rig.setAnimState?.('cast');
      }

      const p4Rig = gs.coopPlayerRigs?.get(4)?.rig;
      if (p4Rig) {
        p4Rig.setMoveVelocity?.(-60, 0);
        p4Rig.setAnimState?.('hurt');
      }

      const p5Rig = gs.coopPlayerRigs?.get(5)?.rig;
      if (p5Rig) {
        p5Rig.setMoveVelocity?.(155, 0);
        p5Rig.setAnimState?.('run');
      }

      const e1 = sim.enemies[0];
      const e2 = sim.enemies[1];
      const e3 = sim.enemies[2];
      if (e1) {
        const r1 = gs.enemyRigs?.get(e1.id);
        r1?.setMoveVelocity?.(-115, 0);
        r1?.setAnimState?.('run');
      }
      if (e2) {
        const r2 = gs.enemyRigs?.get(e2.id);
        r2?.setTelegraphProgress?.(0.65);
        r2?.setAnimState?.('attack');
      }
      if (e3) {
        const r3 = gs.enemyRigs?.get(e3.id);
        r3?.setMoveVelocity?.(-80, 0);
        r3?.setAnimState?.('hurt');
      }
    };

    gs.playerRig?.triggerMeleeSwing?.();
    gs.playerRig?.triggerRecoil?.(5);
    applyShowcasePoses();

    if (!gs.__p10aPoseHookInstalled && gs.syncEnemyRigs) {
      gs.__p10aPoseHookInstalled = true;
      const origSyncEnemies = gs.syncEnemyRigs.bind(gs);
      gs.syncEnemyRigs = (dt: number) => {
        origSyncEnemies(dt);
        applyShowcasePoses();
      };
    }
  });

  await stepDeterministicFrames(page, 2);
}

export const P10A_VISUAL_SCENES: readonly VisualSceneDef[] = [
  makeScene(
    'gallery-p1',
    'ArtGalleryScene Page 1 standard showcase (Vanguard & Goblin Shooter 1x & 2.25x) with 8-frame strip',
    DEFAULT_GALLERY_URL,
    'ArtGalleryScene',
    async (page) => {
      await page.evaluate(() => {
        window.__GALLERY_SET_PAGE__?.(1);
        window.__GALLERY_SET_ANIM__?.('idle');
      });
      await stepDeterministicFrames(page, 45);
    },
    { captureStrip: true },
  ),
  makeScene(
    'gallery-characters-idle',
    'ArtGalleryScene Page 4 (5 Playable Characters in IDLE with breathing & eye blink) with 8-frame strip',
    DEFAULT_GALLERY_URL,
    'ArtGalleryScene',
    async (page) => {
      await page.evaluate(() => {
        window.__GALLERY_SET_PAGE__?.(4);
        window.__GALLERY_SET_ANIM__?.('idle');
      });
      await stepDeterministicFrames(page, 45);
    },
    { captureStrip: true, stripFramesPerStep: 8 },
  ),
  makeScene(
    'gallery-characters-attack',
    'ArtGalleryScene Page 4 (5 Playable Characters in ATTACK pose) with 8-frame strip',
    DEFAULT_GALLERY_URL,
    'ArtGalleryScene',
    async (page) => {
      await page.evaluate(() => {
        window.__GALLERY_SET_PAGE__?.(4);
        window.__GALLERY_SET_ANIM__?.('attack');
      });
      await stepDeterministicFrames(page, 18);
    },
    { captureStrip: true, stripFramesPerStep: 2 },
  ),
  makeScene(
    'gallery-characters-dash',
    'ArtGalleryScene Page 4 (5 Playable Characters in DASH pose with stretch & lean) with 8-frame strip',
    DEFAULT_GALLERY_URL,
    'ArtGalleryScene',
    async (page) => {
      await page.evaluate(() => {
        window.__GALLERY_SET_PAGE__?.(4);
        window.__GALLERY_SET_ANIM__?.('dash');
      });
      await stepDeterministicFrames(page, 18);
    },
    { captureStrip: true, stripFramesPerStep: 2 },
  ),
  makeScene(
    'gallery-characters-hurt',
    'ArtGalleryScene Page 4 (5 Playable Characters in HURT recoil pose) with 8-frame strip',
    DEFAULT_GALLERY_URL,
    'ArtGalleryScene',
    async (page) => {
      await page.evaluate(() => {
        window.__GALLERY_SET_PAGE__?.(4);
        window.__GALLERY_SET_ANIM__?.('hurt');
      });
      await stepDeterministicFrames(page, 18);
    },
    { captureStrip: true, stripFramesPerStep: 2 },
  ),
  makeScene(
    'gallery-characters-crossfade',
    'ArtGalleryScene Page 4 capturing 0.12s smooth state crossfade (idle -> run) across 8-frame strip',
    DEFAULT_GALLERY_URL,
    'ArtGalleryScene',
    async (page) => {
      await page.evaluate(() => {
        window.__GALLERY_SET_PAGE__?.(4);
        window.__GALLERY_SET_ANIM__?.('idle');
      });
      await stepDeterministicFrames(page, 30);
      await page.evaluate(() => {
        window.__GALLERY_SET_ANIM__?.('run');
      });
      await stepDeterministicFrames(page, 1);
    },
    { captureStrip: true, stripFramesPerStep: 2 },
  ),
  makeScene(
    'gallery-enemies-b1',
    'ArtGalleryScene Page 2 (Biome 1 Enemies & Spore King Boss in run state) with 8-frame strip',
    DEFAULT_GALLERY_URL,
    'ArtGalleryScene',
    async (page) => {
      await page.evaluate(() => {
        window.__GALLERY_SET_PAGE__?.(2);
        window.__GALLERY_SET_ANIM__?.('run');
      });
      await stepDeterministicFrames(page, 45);
    },
    { captureStrip: true },
  ),
  makeScene(
    'p10a-ingame-poses',
    'Biome 1 in-game showcase of 5 heroes and 3 representative enemies across active Cutout 2.0 combat poses with 8-frame strip',
    DEFAULT_GAME_URL,
    'GameScene',
    setupP10aIngamePosesScene,
    { captureStrip: true, stripFramesPerStep: 3 },
  ),
];
