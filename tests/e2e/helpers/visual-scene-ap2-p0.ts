import type { Page } from '@playwright/test';
import type { EnemyTypeId, PropKind, RoomArchetypeId, WeaponDefId } from '@ashen-pact/shared';
import {
  DEFAULT_GAME_URL,
  ENVIRONMENT_SAMPLE_RECTS,
  lockCameraAndIrisToPlayer,
  makeScene,
  stepDeterministicFrames,
  type SampleRect,
  type VisualSceneDef,
} from './visual-scene-helpers.js';

export const AP2_P0B_SCENE_IDS: readonly string[] = [
  'ap2-b1-twin-bridges',
  'ap2-b1-gauntlet-chokepoint',
  'ap2-b1-central-bastion',
  'ap2-flip-cover-microblank',
  'ap2-dash-kick-wall-slam',
  'ap2-chasm-ring-out',
  'ap2-microbar-perfect-reload',
  'ap2-heat-vent-staff',
  'ap2-melee-combo3-parry',
  'ap2-tesla-smart-bounce',
] as const;

export const AP2_P0B_SCENE_GROUP = AP2_P0B_SCENE_IDS;

const TWIN_BRIDGES_SAMPLE_RECTS = ENVIRONMENT_SAMPLE_RECTS.map((r) =>
  r.name === 'floor_center' ? { ...r, x: 512, y: 608 } : r,
);
const GAUNTLET_CHOKEPOINT_SAMPLE_RECTS = ENVIRONMENT_SAMPLE_RECTS.map((r) =>
  r.name === 'floor_center' ? { ...r, x: 832, y: 664 } : r,
);
const CENTRAL_BASTION_SAMPLE_RECTS = ENVIRONMENT_SAMPLE_RECTS.map((r) =>
  r.name === 'floor_center' ? { ...r, x: 512, y: 608 } : r,
);

interface Ap2ArenaInitConfig {
  archetype?: RoomArchetypeId;
  roomSeed?: number;
  fourBraziers?: boolean;
  characterId?: 'vanguard' | 'ranger' | 'elementalist' | 'engineer';
  playerX: number;
  playerY: number;
  aimAngle?: number;
  playerFields?: Record<string, unknown>;
  props?: ReadonlyArray<readonly [PropKind, number, number, boolean?]>;
  enemies?: ReadonlyArray<readonly [EnemyTypeId, number, number, ('shield' | undefined)?]>;
  dummyEnemies?: boolean;
  rebuildDoors?: boolean;
}

async function initAp2Arena(page: Page, cfg: Ap2ArenaInitConfig, warmupFrames = 40): Promise<void> {
  await page.evaluate((c) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.rng.setState(sim.rng.initialSeed);
    const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
    room.type = 'combat';
    if (c.archetype) room.roomArchetype = c.archetype;
    if (c.rebuildDoors) room.connections = { N: 0, S: 0, E: 0, W: 0 };
    sim.enterRoom(room.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();
    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.magneticRivets.length = 0;

    if (c.archetype && c.roomSeed !== undefined) {
      sim.map.configureRoomLayout({
        roomSeed: c.roomSeed,
        archetype: c.archetype,
        biome: 1,
        activeDoorSides: ['N', 'S', 'E', 'W'],
      });
    }
    sim.props.length = 0;
    sim.spawnProp('torch_brazier', 7 * 32 + 18, 4 * 32 + 20);
    sim.spawnProp('torch_brazier', 28 * 32 + 14, 4 * 32 + 20);
    if (c.fourBraziers) {
      sim.spawnProp('torch_brazier', 7 * 32 + 18, 17 * 32 + 12);
      sim.spawnProp('torch_brazier', 28 * 32 + 14, 17 * 32 + 12);
    }
    for (const [kind, px, py, flipped] of c.props ?? []) {
      const p = sim.spawnProp(kind, px, py);
      if (flipped) sim.flipCoverProp(p);
    }
    sim.consumeEvents();

    if (c.characterId) sim.selectCharacter(sim.player.id, c.characterId);
    Object.assign(sim.player, {
      godMode: true, x: c.playerX, y: c.playerY, prevX: c.playerX, prevY: c.playerY,
      vx: 0, vy: 0, aimAngle: c.aimAngle ?? 0, ...(c.playerFields ?? {}),
    });

    for (const [typeId, ex, ey, eliteMod] of c.enemies ?? []) {
      const e = sim.spawnEnemy(typeId, ex, ey, true, eliteMod);
      Object.assign(e, {
        hp: 900, maxHp: 900, isDummy: c.dummyEnemies ?? true,
        spawnWarmupTimer: 0, aiState: 'idle', stateTimer: 99, vx: 0, vy: 0,
      });
    }
    if (c.rebuildDoors) sim.rebuildCurrentRoomDoors();
  }, cfg);
  await lockCameraAndIrisToPlayer(page);
  await stepDeterministicFrames(page, warmupFrames);
}

async function spawnEnemyBullets(
  page: Page,
  bullets: ReadonlyArray<readonly [number, number, number, number, number]>,
): Promise<void> {
  await page.evaluate((list) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const ownerId = sim.enemies[0]?.id ?? 200;
    for (const [id, x, y, vx, vy] of list) {
      sim.projectiles.push(
        sim.acquireProjectile({
          id, ownerId, isEnemy: true, x, y, vx, vy, radius: 5.5, damage: 2,
          colorHex: '#E84545', ttlSec: 2.0, pierceCount: 0, bounceCount: 0,
          homingStrength: 0, explosionRadius: 0, isCrit: false, element: 'none', knockback: 40,
        }),
      );
    }
  }, bullets);
}

/** 1. ap2-b1-twin-bridges */
export async function setupAp2B1TwinBridgesScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'TWIN_BRIDGES',
    roomSeed: 1338,
    fourBraziers: true,
    rebuildDoors: true,
    playerX: 340,
    playerY: 268,
    props: [
      ['moss_table', 11 * 32 + 16, 6 * 32 + 16],
      ['moss_table', 23 * 32 + 16, 14 * 32 + 16],
      ['volatile_spore_pod', 11 * 32 + 16, 14 * 32 + 16],
      ['volatile_spore_pod', 23 * 32 + 16, 6 * 32 + 16],
      ['rotten_totem_pillar', 5 * 32 + 16, 15 * 32 + 16],
      ['rotten_totem_pillar', 25 * 32 + 16, 10 * 32 + 16],
      ['glow_mushroom', 5 * 32 + 16, 5 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 715, 205],
      ['wild_boar', 725, 315, 'shield'],
      ['spore_bomber', 775, 455],
    ],
  }, 45);
}

/** 2. ap2-b1-gauntlet-chokepoint */
export async function setupAp2B1GauntletChokepointScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    fourBraziers: true,
    rebuildDoors: true,
    playerX: 310,
    playerY: 270,
    props: [
      ['moss_table', 6 * 32 + 16, 10 * 32 + 16],
      ['moss_table', 23 * 32 + 16, 10 * 32 + 16],
      ['volatile_spore_pod', 15 * 32 + 16, 6 * 32 + 16],
      ['volatile_spore_pod', 20 * 32 + 16, 15 * 32 + 16],
      ['rotten_totem_pillar', 6 * 32 + 16, 15 * 32 + 16],
      ['rotten_totem_pillar', 23 * 32 + 16, 7 * 32 + 16],
      ['ancient_mechanism', 17 * 32 + 16, 11 * 32 + 16],
    ],
    enemies: [
      ['goblin_shooter', 610, 210],
      ['wild_boar', 650, 310, 'shield'],
      ['goblin_shaman', 710, 255],
    ],
  }, 45);
}

/** 3. ap2-b1-central-bastion */
export async function setupAp2B1CentralBastionScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'CENTRAL_BASTION',
    roomSeed: 1340,
    fourBraziers: true,
    rebuildDoors: true,
    playerX: 330,
    playerY: 270,
    props: [
      ['moss_table', 12 * 32 + 16, 10 * 32 + 16],
      ['moss_table', 23 * 32 + 16, 11 * 32 + 16, true],
      ['moss_table', 17 * 32 + 16, 6 * 32 + 16],
      ['moss_table', 18 * 32 + 16, 15 * 32 + 16],
      ['volatile_spore_pod', 11 * 32 + 16, 6 * 32 + 16],
      ['volatile_spore_pod', 24 * 32 + 16, 15 * 32 + 16],
      ['rotten_totem_pillar', 5 * 32 + 16, 15 * 32 + 16],
      ['rotten_totem_pillar', 25 * 32 + 16, 6 * 32 + 16],
      ['ancient_mechanism', 17 * 32 + 16, 10 * 32 + 16],
    ],
    enemies: [
      ['thorn_turret', 592, 352],
      ['goblin_shooter', 710, 225],
      ['wild_boar', 715, 420, 'shield'],
    ],
  }, 45);
}

/** 4. ap2-flip-cover-microblank (8-frame strip) */
export async function setupAp2FlipCoverMicroblankScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    playerX: 372,
    playerY: 270,
    props: [
      ['moss_table', 405, 270],
      ['moss_table', 390, 345],
    ],
    enemies: [
      ['goblin_shooter', 575, 235],
      ['thorn_turret', 605, 270],
      ['goblin_shooter', 575, 305],
    ],
  });
  await spawnEnemyBullets(page, [
    [97001, 428, 254, -210, 0], [97002, 436, 270, -210, 0],
    [97003, 428, 286, -210, 0], [97004, 445, 262, -210, 0],
    [97020, 482, 256, -240, -8], [97021, 496, 270, -240, 0],
    [97022, 482, 284, -240, 8], [97023, 524, 260, -240, -5],
    [97024, 538, 270, -240, 0], [97025, 524, 280, -240, 5],
    [97026, 564, 265, -240, -4], [97027, 564, 275, -240, 4],
  ]);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const table = sim.props.find((p) => p.kind === 'moss_table' && p.coverState === 'low')!;
    sim.flipCoverProp(table, sim.player);
  });
  await stepDeterministicFrames(page, 1);
}

/** 5. ap2-dash-kick-wall-slam (8-frame strip) */
export async function setupAp2DashKickWallSlamScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    playerX: 382,
    playerY: 255,
    dummyEnemies: false,
    props: [
      ['moss_table', 688, 195, true],
      ['moss_table', 415, 255, true],
    ],
    enemies: [
      ['goblin_shooter', 748, 195],
      ['wild_boar', 515, 255],
      ['goblin_shaman', 595, 255],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    sim.player.armor = 2;
    sim.player.maxArmor = 5;
    const e1 = sim.enemies[0];
    if (e1) Object.assign(e1, { x: 752, y: 195, kbVx: 320, kbVy: 0, lastHitDmg: 28 });
    const tables = sim.props.filter((p) => p.kind === 'moss_table');
    if (tables[0]) {
      Object.assign(tables[0], { x: 736, y: 195 });
      sim.kickProp(tables[0], sim.player, 0);
    }
    if (tables[1]) {
      Object.assign(sim.player, { dashTimer: 0.16, dashDirX: 1, dashDirY: 0 });
      sim.events.push({
        kind: 'dash_started', playerId: sim.player.id, x: sim.player.x, y: sim.player.y, dirX: 1, dirY: 0,
      });
      sim.kickProp(tables[1], sim.player, 0);
    }
  });
  await stepDeterministicFrames(page, 2);
}

/** 6. ap2-chasm-ring-out (8-frame strip) */
export async function setupAp2ChasmRingOutScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'TWIN_BRIDGES',
    roomSeed: 1338,
    playerX: 520,
    playerY: 218,
    aimAngle: Math.PI * 0.45,
    dummyEnemies: false,
    props: [['moss_table', 11 * 32 + 16, 6 * 32 + 16]],
    enemies: [
      ['goblin_shooter', 548, 252],
      ['green_slime', 585, 224],
      ['goblin_shaman', 625, 206],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    for (const e of sim.enemies) Object.assign(e, { aiState: 'stunned', stateTimer: 2.0 });
    const [e1, e2, e3] = sim.enemies;
    if (e1) Object.assign(e1, { x: 548, y: 258, kbVx: 20, kbVy: 240 });
    if (e2) Object.assign(e2, { x: 585, y: 232, kbVx: 15, kbVy: 210 });
    if (e3) Object.assign(e3, { x: 625, y: 212, kbVx: 10, kbVy: 195 });
    for (let i = 0; i < 4; i++) {
      sim.pickups.push(
        sim.acquirePickup({
          id: 97400 + i, kind: i === 3 ? 'prey_emblem' : 'gold',
          x: 540 + i * 16, y: 236 - (i % 2) * 10, vx: (i - 1.5) * 45, vy: -95 - i * 15,
          amount: 10, ttlSec: 20,
        }),
      );
    }
  });
  await stepDeterministicFrames(page, 2);
}

/** 7. ap2-microbar-perfect-reload (8-frame strip) */
export async function setupAp2MicrobarPerfectReloadScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    characterId: 'engineer',
    playerX: 340,
    playerY: 270,
    enemies: [
      ['goblin_shooter', 505, 220],
      ['wild_boar', 545, 270, 'shield'],
      ['spore_bomber', 505, 320],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | { syncProjectilesAndPickups?: () => void; __ap2PerfectReloadHookInstalled?: boolean }
      | undefined;
    Object.assign(sim.player, {
      weaponSlots: ['rivet_gun', 'tesla_carbine'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0, clipMax: 6, clipAmmo: 1, reloadDuration: 1.15, reloadTimer: 0, reloadLockout: false,
    });
    const [e1, e2, e3] = sim.enemies;
    const rivetCoords: Array<[number, number, number | null]> = [
      [485, 220, e1?.id ?? null], [525, 215, e1?.id ?? null],
      [540, 265, e2?.id ?? null], [555, 280, e2?.id ?? null],
      [525, 322, e3?.id ?? null], [485, 315, e3?.id ?? null],
    ];
    sim.magneticRivets = rivetCoords.map(([rx, ry, targetId], idx) => ({
      id: 98100 + idx, ownerPlayerId: sim.player.id, x: rx, y: ry,
      attachedEnemyId: targetId, attachedTargetId: targetId, attachedPropId: null,
      offsetX: 0, offsetY: 0, ttlSec: 12.0,
    }));
    sim.tryFireActiveWeapon(sim.player);
    sim.player.reloadDuration = 1.15;
    sim.player.reloadTimer = 1.15 * 0.5;
    sim.player.reloadLockout = false;
    sim.events.push(
      { kind: 'perfect_reload', playerId: sim.player.id, weaponId: 'rivet_gun', x: sim.player.x, y: sim.player.y },
      { kind: 'chain_lightning', fromX: 485, fromY: 220, toX: 545, toY: 270 },
      { kind: 'chain_lightning', fromX: 545, fromY: 270, toX: 505, toY: 320 },
    );
    if (gs && !gs.__ap2PerfectReloadHookInstalled && gs.syncProjectilesAndPickups) {
      gs.__ap2PerfectReloadHookInstalled = true;
      let stepIdx = 0;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        stepIdx += 1;
        if (stepIdx === 6 && sim.player.reloadTimer > 0) {
          (gs as unknown as { reloadVentQueued?: boolean }).reloadVentQueued = true;
        }
        origSync();
      };
    }
  });
  await stepDeterministicFrames(page, 1);
}

/** 8. ap2-heat-vent-staff (8-frame strip) */
export async function setupAp2HeatVentStaffScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    characterId: 'elementalist',
    playerX: 340,
    playerY: 270,
    enemies: [
      ['goblin_shooter', 525, 235],
      ['wild_boar', 545, 270, 'shield'],
      ['goblin_shaman', 525, 305],
    ],
  });
  await spawnEnemyBullets(page, [
    [98300, 395, 245, -150, 0],
    [98301, 402, 270, -150, 0],
    [98302, 395, 295, -150, 0],
  ]);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | { syncProjectilesAndPickups?: () => void; __ap2HeatVentHookInstalled?: boolean }
      | undefined;
    Object.assign(sim.player, {
      aimWorldX: 535, aimWorldY: 270,
      weaponSlots: ['apprentice_staff', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0, weaponHeat: 80, weaponSlotHeat: [80, 0] as [number, number],
      overheatLockTimer: 0, staffShotCounter: 2, apprenticeStaffShotCount: 2,
    });
    sim.tryFireActiveWeapon(sim.player);
    sim.player.weaponHeat = 80;
    sim.player.weaponSlotHeat = [80, 0];
    sim.player.overheatLockTimer = 0;
    sim.events.push(
      { kind: 'tactical_vent', playerId: sim.player.id, weaponId: 'apprentice_staff', x: sim.player.x, y: sim.player.y },
      { kind: 'explosion', x: 535, y: 270, radius: 72, damage: 22, sourceDefId: 'apprentice_staff' },
    );
    if (gs && !gs.__ap2HeatVentHookInstalled && gs.syncProjectilesAndPickups) {
      gs.__ap2HeatVentHookInstalled = true;
      let stepIdx = 0;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        stepIdx += 1;
        if (stepIdx < 4) {
          sim.player.weaponHeat = 80;
          sim.player.weaponSlotHeat = [80, 0];
        } else if (stepIdx === 4) {
          (gs as unknown as { reloadVentQueued?: boolean }).reloadVentQueued = true;
        }
        origSync();
      };
    }
  });
  await stepDeterministicFrames(page, 1);
}

/** 9. ap2-melee-combo3-parry (8-frame strip) */
export async function setupAp2MeleeCombo3ParryScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'TWIN_BRIDGES',
    roomSeed: 1338,
    characterId: 'vanguard',
    playerX: 454,
    playerY: 316,
    enemies: [
      ['goblin_shooter', 665, 292],
      ['thorn_turret', 672, 316],
      ['goblin_shaman', 665, 340],
    ],
  });
  await spawnEnemyBullets(page, [
    [98500, 486, 300, -210, 0],
    [98501, 494, 316, -210, 0],
    [98502, 486, 332, -210, 0],
  ]);
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    Object.assign(sim.player, {
      weaponSlots: ['knight_sword', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0, meleeComboStep: 2, meleeComboResetTimer: 0.8, reloadTimer: 0, weaponHeat: 0,
    });
    sim.tryFireActiveWeapon(sim.player);
    sim.player.meleeComboStep = 2;
    sim.player.meleeComboResetTimer = 0.9;
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | { fx?: { spawnFloatingAlert: (x: number, y: number, t: string, c?: string) => void } }
      | undefined;
    gs?.fx?.spawnFloatingAlert(sim.player.x + 24, sim.player.y - 18, 'PARRY ×3!', '#FEF08A');
  });
  await stepDeterministicFrames(page, 2);
}

/** 10. ap2-tesla-smart-bounce (8-frame strip) */
export async function setupAp2TeslaSmartBounceScene(page: Page): Promise<void> {
  await initAp2Arena(page, {
    archetype: 'GAUNTLET_CHOKEPOINT',
    roomSeed: 1336,
    characterId: 'ranger',
    playerX: 330,
    playerY: 272,
    props: [['moss_table', 400, 272, true]],
    enemies: [
      ['goblin_shooter', 456, 272],
      ['goblin_shaman', 548, 185],
      ['spore_bomber', 605, 165],
    ],
  });
  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    for (let ty = 8; ty <= 9; ty++) {
      for (let tx = 16; tx <= 17; tx++) {
        sim.map.tiles[ty * sim.map.cols + tx] = 'pillar';
      }
    }
    sim.map.rebuildSolidBoxes();
    sim.map.mapRevision += 1;
    Object.assign(sim.player, {
      weaponSlots: ['tesla_carbine', 'rivet_gun'] as [WeaponDefId, WeaponDefId],
      activeWeaponSlot: 0, clipMax: 12, clipAmmo: 10, bonusBounceCurrentClip: 1,
    });
  });
  await stepDeterministicFrames(page, 2);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          fx?: {
            spawnChainLightningArc: (x1: number, y1: number, x2: number, y2: number) => void;
            spawnFloatingAlert: (x: number, y: number, t: string, c?: string) => void;
          };
          syncProjectilesAndPickups?: () => void;
          __ap2TeslaBounceHookInstalled?: boolean;
        }
      | undefined;
    sim.tryFireActiveWeapon(sim.player);
    for (let s = 0; s < 6; s++) sim.step(1000 / 60);
    sim.player.fireCooldownTimer = 0;
    sim.tryFireActiveWeapon(sim.player);

    gs?.fx?.spawnChainLightningArc(456, 272, 507, 272);
    gs?.fx?.spawnChainLightningArc(507, 272, 548, 185);
    gs?.fx?.spawnChainLightningArc(548, 185, 605, 165);
    gs?.fx?.spawnFloatingAlert(507, 248, '⚡ SMART BOUNCE +35%!', '#38BDF8');

    if (gs && !gs.__ap2TeslaBounceHookInstalled && gs.syncProjectilesAndPickups) {
      gs.__ap2TeslaBounceHookInstalled = true;
      let stepIdx = 0;
      const origSync = gs.syncProjectilesAndPickups.bind(gs);
      gs.syncProjectilesAndPickups = () => {
        stepIdx += 1;
        if (stepIdx % 4 === 0) {
          sim.player.fireCooldownTimer = 0;
          sim.player.clipAmmo = Math.max(2, sim.player.clipAmmo);
          sim.tryFireActiveWeapon(sim.player);
          gs.fx?.spawnChainLightningArc(507, 272, 548, 185);
        }
        origSync();
      };
    }
  });
  await stepDeterministicFrames(page, 1);
}

const ENV_SCENES: ReadonlyArray<
  readonly [string, string, (page: Page) => Promise<void>, readonly SampleRect[]]
> = [
  ['ap2-b1-twin-bridges', 'Biome 1 TWIN_BRIDGES tactical room with Y-branched chasm and two 3-tile bridges', setupAp2B1TwinBridgesScene, TWIN_BRIDGES_SAMPLE_RECTS],
  ['ap2-b1-gauntlet-chokepoint', 'Biome 1 GAUNTLET_CHOKEPOINT tactical room with 4 L-shaped pillar blocks and cross-corridor', setupAp2B1GauntletChokepointScene, GAUNTLET_CHOKEPOINT_SAMPLE_RECTS],
  ['ap2-b1-central-bastion', 'Biome 1 CENTRAL_BASTION tactical room with central fortress and 4 moss_table barricades', setupAp2B1CentralBastionScene, CENTRAL_BASTION_SAMPLE_RECTS],
];

const STRIP_SCENES: ReadonlyArray<readonly [string, string, (page: Page) => Promise<void>]> = [
  ['ap2-flip-cover-microblank', 'Player flipping moss_table with [E] emitting r=56px Micro-Blank wave clearing enemy bullets', setupAp2FlipCoverMicroblankScene],
  ['ap2-dash-kick-wall-slam', 'Player Dash-Kicking flipped moss_table at 520 px/s into enemies triggering Wall-Slam', setupAp2DashKickWallSlamScene],
  ['ap2-chasm-ring-out', 'Player knocking infantry enemies off TWIN_BRIDGES into chasm with RING-OUT! callout', setupAp2ChasmRingOutScene],
  ['ap2-microbar-perfect-reload', 'Player firing rivet_gun Finale Shot and hitting [R] in Golden Window on 32x5px Micro-Bar', setupAp2MicrobarPerfectReloadScene],
  ['ap2-heat-vent-staff', 'Player at 80% Orange Heat on apprentice_staff pressing [R] Tactical Vent and firing beam', setupAp2HeatVentStaffScene],
  ['ap2-melee-combo3-parry', 'Vanguard wielding knight_sword swinging Combo Hit 3 Crescent Wave and Parry Deflecting bullets', setupAp2MeleeCombo3ParryScene],
  ['ap2-tesla-smart-bounce', 'Player firing tesla_carbine through flipped moss_table and Smart Bouncing around L-corner', setupAp2TeslaSmartBounceScene],
];

export const AP2_P0B_VISUAL_SCENES: readonly VisualSceneDef[] = [
  ...ENV_SCENES.map(([id, desc, setup, sampleRects]) =>
    makeScene(id, desc, DEFAULT_GAME_URL, 'GameScene', setup, { includeUnlit: true, sampleRects }),
  ),
  ...STRIP_SCENES.map(([id, desc, setup]) =>
    makeScene(id, desc, DEFAULT_GAME_URL, 'GameScene', setup, { captureStrip: true, stripFramesPerStep: 2 }),
  ),
];
