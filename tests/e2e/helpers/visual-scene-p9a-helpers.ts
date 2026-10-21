import type { Page } from '@playwright/test';
import {
  lockCameraAndIrisToPlayer,
  setupStartRoomScene,
  stepDeterministicFrames,
  switchGameSceneToEnglish,
} from './visual-scene-helpers.js';

export const SCENE_GROUPS: Readonly<Record<string, readonly string[]>> = {
  p9a: [
    'b1-combat',
    'b1-combat-1440p',
    'b1-combat-ultrawide',
    'b1-combat-4p',
    'b1-combat-downed',
    'b1-boss-p1',
    'b1-boss-p3',
    'b2-combat',
    'b3-combat',
    'b1-hud-weapon-compare',
    'b1-hud-debug-on',
    'b1-combat-uiscale-80',
    'b1-combat-uiscale-130',
    'b1-hud-qol-showcase',
    'ui-vi-diacritics',
  ],
  p9b: [
    'menu',
    'menu-en',
    'menu-debug-on',
    'menu-join-input',
    'menu-settings',
    'menu-settings-en',
    'hub-solo',
    'hub-coop-2p',
    'hub-coop-2p-expanded',
    'hub-coop-invite-open',
    'hub-near-statue',
    'pause',
    'pause-en',
    'pause-confirm-exit',
    'pause-confirm-exit-en',
    'modal-buff',
    'modal-buff-en',
    'modal-victory',
    'modal-victory-en',
    'modal-defeat',
    'modal-defeat-en',
    'game-settings',
    'game-settings-en',
  ],
};

export async function setupHubCoop2pExpandedScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.enterHub();
    sim.addCoopPlayer(2, 'ranger', 'Ưng Nhãn P2', 2);
    sim.enterHub();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | { invitePanelVisible?: boolean; lastInvitePanelHash?: string }
      | undefined;
    if (gs) {
      gs.invitePanelVisible = true;
      gs.lastInvitePanelHash = '';
    }
  });
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 45);
}

export async function setupPauseConfirmExitScene(page: Page, english = false): Promise<void> {
  await lockCameraAndIrisToPlayer(page);
  if (english) {
    await switchGameSceneToEnglish(page);
  }
  await stepDeterministicFrames(page, 40);
  await page.keyboard.press('Escape');
  await page.mouse.move(960, 754);
  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | { openPauseConfirmExit?: () => void }
      | undefined;
    gs?.openPauseConfirmExit?.();
  });
  await stepDeterministicFrames(page, 5);
}

export async function setupGameSettingsScene(page: Page, english = false): Promise<void> {
  await setupStartRoomScene(page);
  if (english) {
    await switchGameSceneToEnglish(page);
  }
  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | { settingsModal?: { open: (k: 'settings') => void } }
      | undefined;
    gs?.settingsModal?.open('settings');
  });
  await stepDeterministicFrames(page, 5);
}

export async function setupCoop4pCombatScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(combatRoom.id);
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.summons.length = 0;
    sim.skillZones.length = 0;
    sim.nextEntityId = 5000;
    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'elementalist');
    p1.godMode = true;
    p1.x = 340;
    p1.y = 290;
    const p2 = sim.addCoopPlayer(2, 'druid', 'Mộc Linh P2', 2);
    const p3 = sim.addCoopPlayer(3, 'engineer', 'Bánh Răng P3', 3);
    const p4 = sim.addCoopPlayer(4, 'vanguard', 'Thiết Vệ P4', 4);
    p2.godMode = p3.godMode = p4.godMode = true;
    p2.x = 340;
    p2.y = 220;
    p3.x = 340;
    p3.y = 360;
    p4.x = 430;
    p4.y = 290;
    p4.skillActiveTimer = 3.5;
    const spawned = [
      sim.spawnEnemy('wild_boar', 600, 260, true, 'shield'),
      sim.spawnEnemy('goblin_shaman', 660, 330, true),
      sim.spawnEnemy('spore_bomber', 560, 350, true),
    ];
    for (const e of spawned) {
      e.hp = 1200;
      e.maxHp = 1200;
    }
    sim.activateCharacterSkill(p1);
    sim.activateCharacterSkill(p2);
    sim.activateCharacterSkill(p3);
  });
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 45);
}

export async function setupB1CombatDownedScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(combatRoom.id);
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'vanguard');
    Object.assign(p1, {
      godMode: true,
      x: 350,
      y: 280,
      prevX: 350,
      prevY: 280,
      hp: 2,
      maxHp: 8,
      armor: 0,
      maxArmor: 6,
      energy: 110,
      maxEnergy: 150,
      gold: 85,
      skillCooldownTimer: 2.8,
      dashCooldownTimer: 0.4,
    });
    const p2 = sim.addCoopPlayer(2, 'druid', 'Mộc Linh P2', 2);
    const p3 = sim.addCoopPlayer(3, 'engineer', 'Bánh Răng P3', 3);
    const p4 = sim.addCoopPlayer(4, 'elementalist', 'Lam Hỏa P4', 4);
    p2.godMode = p3.godMode = p4.godMode = true;
    Object.assign(p2, {
      x: 404,
      y: 286,
      prevX: 404,
      prevY: 286,
      hp: 0,
      armor: 0,
      lifeState: 'downed',
      downedTimer: 11.4,
      bleedoutTimer: 11.4,
      reviveProgress: 0.48,
    });
    Object.assign(p3, {
      x: 890,
      y: 245,
      prevX: 890,
      prevY: 245,
      hp: 0,
      armor: 0,
      lifeState: 'downed',
      downedTimer: 8.2,
      bleedoutTimer: 8.2,
      reviveProgress: 0,
    });
    Object.assign(p4, {
      x: 332,
      y: 218,
      prevX: 332,
      prevY: 218,
      hp: 4,
      maxHp: 6,
      armor: 2,
      maxArmor: 4,
      lifeState: 'alive',
    });
    const spawned = [
      sim.spawnEnemy('goblin_shooter', 560, 225, true),
      sim.spawnEnemy('wild_boar', 595, 310, true, 'shield'),
      sim.spawnEnemy('goblin_shaman', 665, 270, true),
    ];
    for (const e of spawned) e.hp = e.maxHp = 900;
  });
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 42);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | Record<string, unknown>
      | undefined;
    sim.player.hp = 2;
    sim.player.armor = 0;
    const p2 = sim.simulatedPlayers[0];
    if (p2) {
      p2.lifeState = 'downed';
      p2.hp = 0;
      p2.downedTimer = 11.2;
      p2.bleedoutTimer = 11.2;
      p2.reviveProgress = 0.52;
    }
    const p3 = sim.simulatedPlayers[1];
    if (p3) {
      p3.lifeState = 'downed';
      p3.hp = 0;
      p3.downedTimer = 8.0;
      p3.bleedoutTimer = 8.0;
      p3.reviveProgress = 0;
      p3.x = 1040;
      p3.prevX = 1040;
    }
    if (gs) {
      gs['trailingHpRatio'] = 0.65;
      gs['trailingArmorRatio'] = 0.45;
      gs['lastHudHp'] = -1;
      gs['lastCoopHudHash'] = '';
    }
  });
  await stepDeterministicFrames(page, 3);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | (Record<string, unknown> & { updateVectorHud?: () => void })
      | undefined;
    const p2 = sim.simulatedPlayers[0];
    if (p2) {
      p2.lifeState = 'downed';
      p2.downedTimer = 11.2;
      p2.bleedoutTimer = 11.2;
      p2.reviveProgress = 0.52;
    }
    const p3 = sim.simulatedPlayers[1];
    if (p3) {
      p3.lifeState = 'downed';
      p3.downedTimer = 8.0;
      p3.bleedoutTimer = 8.0;
      p3.x = 1040;
      p3.prevX = 1040;
    }
    if (gs) {
      gs['lastCoopHudHash'] = '';
      gs.updateVectorHud?.();
    }
  });
}

export async function setupB1HudWeaponCompareScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.worldItems.length = 0;
    sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: 'dragon_breath_shotgun',
      rarity: 'epic',
      nameVi: 'Shotgun Hỏa Long',
      costGold: 0,
      healAmount: 0,
      x: 500,
      y: 270,
    });
    Object.assign(sim.player, {
      godMode: true,
      x: 468,
      y: 270,
      prevX: 468,
      prevY: 270,
      hp: 6,
      maxHp: 8,
      armor: 3,
      maxArmor: 6,
      energy: 125,
      maxEnergy: 150,
      gold: 140,
      skillCooldownTimer: 3.6,
      dashCooldownTimer: 0.55,
    });
  });
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, 42);
  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | Record<string, unknown>
      | undefined;
    if (gs) {
      gs['trailingHpRatio'] = 0.92;
      gs['trailingArmorRatio'] = 0.82;
      gs['lastHudHp'] = -1;
      gs['lastWeaponCompareHash'] = '';
    }
  });
  await stepDeterministicFrames(page, 3);
}

export async function setupB1HudQolShowcaseScene(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    sim.enterRoom(combatRoom.id);
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.waveNumber = 2;
    Object.assign(sim.player, {
      godMode: true,
      x: 340,
      y: 270,
      prevX: 340,
      prevY: 270,
      hp: 6,
      maxHp: 8,
      armor: 3,
      maxArmor: 6,
      energy: 120,
      maxEnergy: 150,
      gold: 95,
    });
    const onScreen = sim.spawnEnemy('wild_boar', 530, 265, true, 'shield');
    const offTopRight = sim.spawnEnemy('goblin_shooter', 980, 130, true);
    const offBotRight = sim.spawnEnemy('spore_bomber', 980, 440, true);
    for (const e of [onScreen, offTopRight, offBotRight]) {
      e.hp = 900;
      e.maxHp = 900;
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
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | (Record<string, unknown> & {
          fx?: {
            spawnElementalReactionFx: (p: {
              reaction: 'vaporize';
              x: number;
              y: number;
              damage: number;
              isTeamCombo: boolean;
            }) => void;
            spawnDamagePopup: (p: {
              x: number;
              y: number;
              amount: number;
              isCrit: boolean;
              targetKind: 'player' | 'enemy';
              hitArmor: boolean;
              element?: 'burn' | 'chill' | 'shock' | 'poison' | 'none';
            }) => void;
          };
          triggerPlayerHitDirectionIndicator?: (angleRad: number) => void;
          triggerWaveBanner?: (wave: number, maxWaves: number) => void;
        })
      | undefined;

    sim.player.godMode = false;
    sim.player.invulnerableTimer = 0;
    sim.applyDamageToPlayer(1, -140, -25, 'goblin_shooter', sim.player);
    sim.player.godMode = true;

    if (sim.enemies[1]) {
      sim.enemies[1].x = 1060;
      sim.enemies[1].y = 145;
      sim.enemies[1].vx = 0;
      sim.enemies[1].vy = 0;
    }
    if (sim.enemies[2]) {
      sim.enemies[2].x = 1060;
      sim.enemies[2].y = 425;
      sim.enemies[2].vx = 0;
      sim.enemies[2].vy = 0;
    }

    gs?.triggerPlayerHitDirectionIndicator?.(-0.18);
    gs?.triggerWaveBanner?.(2, 3);
    if (gs?.fx) {
      gs.fx.spawnElementalReactionFx({
        reaction: 'vaporize',
        x: 530,
        y: 255,
        damage: 24,
        isTeamCombo: false,
      });
      gs.fx.spawnElementalReactionFx({
        reaction: 'vaporize',
        x: 536,
        y: 250,
        damage: 24,
        isTeamCombo: false,
      });
      gs.fx.spawnElementalReactionFx({
        reaction: 'vaporize',
        x: 524,
        y: 260,
        damage: 24,
        isTeamCombo: true,
      });
      gs.fx.spawnDamagePopup({
        x: 512,
        y: 268,
        amount: 18,
        isCrit: false,
        targetKind: 'enemy',
        hitArmor: false,
        element: 'burn',
      });
      gs.fx.spawnDamagePopup({
        x: 548,
        y: 258,
        amount: 46,
        isCrit: true,
        targetKind: 'enemy',
        hitArmor: false,
        element: 'chill',
      });
    }
  });
  await stepDeterministicFrames(page, 5);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          syncEnemyRigs?: (dt: number) => void;
          updateVectorHud?: () => void;
        }
      | undefined;
    if (sim.enemies[1]) {
      sim.enemies[1].x = 1080;
      sim.enemies[1].y = 175;
    }
    if (sim.enemies[2]) {
      sim.enemies[2].x = 1080;
      sim.enemies[2].y = 390;
    }
    gs?.syncEnemyRigs?.(0);
    gs?.updateVectorHud?.();
  });
}

export async function setupUiViDiacriticsScene(page: Page): Promise<void> {
  await setupStartRoomScene(page);
  await page.evaluate(() => {
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          uiScene?: {
            add: {
              container: (x: number, y: number) => {
                setDepth: (d: number) => unknown;
                add: (child: unknown) => void;
              };
              graphics: () => {
                fillStyle: (c: number, a?: number) => void;
                lineStyle: (w: number, c: number, a?: number) => void;
                fillRoundedRect: (x: number, y: number, w: number, h: number, r: number) => void;
                strokeRoundedRect: (x: number, y: number, w: number, h: number, r: number) => void;
              };
              text: (
                x: number,
                y: number,
                t: string,
                s: Record<string, unknown>,
              ) => unknown;
            };
          };
          renderViDiacriticsShowcase?: () => void;
        }
      | undefined;

    if (gs?.renderViDiacriticsShowcase) {
      gs.renderViDiacriticsShowcase();
      return;
    }

    const ui = gs?.uiScene;
    if (!ui) return;
    const c = ui.add.container(0, 0);
    c.setDepth(5200);
    const bg = ui.add.graphics();
    bg.fillStyle(0x0b090e, 0.96);
    bg.lineStyle(3, 0xfacc15, 1);
    bg.fillRoundedRect(48, 36, 864, 468, 10);
    bg.strokeRoundedRect(48, 36, 864, 468, 10);
    c.add(bg);

    const rows: Array<{ px1080: number; scenePx: number; sample: string }> = [
      {
        px1080: 12,
        scenePx: 6,
        sample:
          '[12px] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · ĐỢT 2/3 · PHÒNG ĐÃ DỌN SẠCH · TẦNG 1-2 · RỪNG CỔ MỤC NÁT · SƯƠNG ĐỘC · QUÁI TỰ NỔ',
      },
      {
        px1080: 14,
        scenePx: 7,
        sample:
          '[14px] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · ĐỢT 2/3 · PHÒNG ĐÃ DỌN SẠCH · TẦNG 1-2 · RỪNG CỔ MỤC NÁT · SƯƠNG ĐỘC · QUÁI TỰ NỔ',
      },
      {
        px1080: 16,
        scenePx: 8,
        sample:
          '[16px] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · ĐỢT 2/3 · PHÒNG ĐÃ DỌN SẠCH · TẦNG 1-2 · RỪNG CỔ MỤC NÁT · SƯƠNG ĐỘC',
      },
      {
        px1080: 20,
        scenePx: 10,
        sample: '[20px] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · ĐỢT 2/3 · PHÒNG ĐÃ DỌN SẠCH · SƯƠNG ĐỘC · QUÁI TỰ NỔ',
      },
      {
        px1080: 28,
        scenePx: 14,
        sample: '[28px] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · ĐỢT 2/3 · PHÒNG ĐÃ DỌN SẠCH',
      },
      {
        px1080: 40,
        scenePx: 20,
        sample: '[40px] Ở, Ữ, Ặ · HƠI NƯỚC ×3 · ĐỢT 2/3 · QUÁI TỰ NỔ',
      },
    ];

    let curY = 58;
    for (const row of rows) {
      const t = ui.add.text(72, curY, row.sample, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: `${row.scenePx}px`,
        fontStyle: '700',
        color: '#F4F1EA',
        stroke: '#141019',
        strokeThickness: 2.5,
        resolution: 2,
      });
      c.add(t);
      curY += Math.max(46, row.scenePx * 3.4);
    }
  });
  await stepDeterministicFrames(page, 2);
}
