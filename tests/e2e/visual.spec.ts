import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, test, expect, type Page } from '@playwright/test';
import {
  BIOME2_GAME_URL,
  BIOME3_GAME_URL,
  DEFAULT_FREEZE_MASK_RECTS,
  DEFAULT_GAME_URL,
  DEFAULT_HUB_URL,
  ENVIRONMENT_SAMPLE_RECTS,
  HUB_SAMPLE_RECTS,
} from './helpers/visual-scene-helpers.js';
import {
  VISUAL_SCENES,
  type VisualSceneDef,
  installDeterministicRafGate,
  setSceneLightingAndRenderStaticFrame,
  stepDeterministicFrames,
} from './helpers/visual-scenes.js';
import {
  type CapturedAnimatedSceneResult,
  captureAnimatedStripAndHeroScene,
  installSceneStripInstrumentation,
} from './helpers/visual-strip-harness.js';
import {
  analyzePngBufferRegions,
  comparePngBuffers,
  computeSceneEnvironmentSummary,
  convertPngBufferToGrayscale,
  stitchPngBuffersHorizontal,
  type AnimationGatesEvaluationResult,
  type RegionMetrics,
  type SceneEnvironmentSummary,
  type SceneManifestEntry,
} from '../../tools/visual-metrics.js';

const SYSTEM_CHROME_PATH = fs.existsSync('/usr/bin/chromium')
  ? '/usr/bin/chromium'
  : fs.existsSync('/usr/bin/google-chrome')
    ? '/usr/bin/google-chrome'
    : undefined;

test.use({
  channel: undefined,
  launchOptions: {
    ...(SYSTEM_CHROME_PATH ? { executablePath: SYSTEM_CHROME_PATH } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-proxy-server',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  },
});

interface TopologyShowcaseConfig {
  roomSeed: number;
  biome: 1 | 2 | 3;
  preset: 'compact' | 'standard' | 'wide_hall' | 'tall_sanctum' | 'grand_arena' | 'colossal_boss';
  cols: number;
  rows: number;
  shape:
    | 'rectangle'
    | 'octagon'
    | 'cruciform'
    | 'hourglass'
    | 'l_shape'
    | 't_shape'
    | 'u_shape'
    | 'donut_ring'
    | 'multi_chamber'
    | 'island_catwalk';
  archetype:
    | 'TWIN_BRIDGES'
    | 'GAUNTLET_CHOKEPOINT'
    | 'CENTRAL_BASTION'
    | 'CROSSFIRE_CONVEYORS'
    | 'PRISM_LABYRINTH'
    | 'CRUMBLING_PILLAR_RING';
  zoom: number;
  playerOffset?: { dx: number; dy: number };
  extraSurfaces?: ReadonlyArray<{
    tx: number;
    ty: number;
    w: number;
    h: number;
    surface:
      | 'lava'
      | 'ice'
      | 'water'
      | 'electrified_water'
      | 'poison_swamp'
      | 'oil'
      | 'burning_oil'
      | 'grass'
      | 'burning_grass'
      | 'chasm'
      | 'conveyor';
  }>;
  enemies?: ReadonlyArray<{
    defId: string;
    tx: number;
    ty: number;
    elite?: 'shield' | 'giant' | 'explosive_death';
  }>;
}

async function setupTopologyShowcaseScene(
  page: Page,
  cfg: TopologyShowcaseConfig,
): Promise<void> {
  await page.evaluate((c) => {
    const sim = window.__GAME_TRANSPORT__!.getSim();
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | (Record<string, unknown> & {
          cameras?: {
            main?: {
              setZoom: (z: number) => void;
              centerOn: (x: number, y: number) => void;
            };
          };
          destroyPortalAndDoorVisuals?: () => void;
          syncArenaTilesWithMapRevision?: () => void;
          syncProps?: (dt: number) => void;
          syncRoomEntities?: (dt: number) => void;
          invalidateAllHudCaches?: () => void;
          updateVectorHud?: () => void;
          updateMinimapHud?: () => void;
          updateBossHud?: () => void;
          lastMapRevision?: number;
          lastMinimapHash?: string;
          lastBossHudHash?: string;
          camFocusX?: number;
          camFocusY?: number;
          lastShakeX?: number;
          lastShakeY?: number;
          irisTransitionProgress?: number;
          irisTransitionDir?: number;
          lastRenderedBiome?: number;
          updateCameraWithLookaheadAndShake?: (...args: unknown[]) => void;
        })
      | undefined;

    sim.inHub = false;
    sim.currentBiome = c.biome;
    sim.currentFloor = c.biome === 1 ? 1 : c.biome === 2 ? 3 : 5;
    sim.map.biome = c.biome;
    const combatRoom =
      sim.dungeon.rooms.find((r) => r.type === 'combat' && Object.keys(r.connections).length >= 3) ??
      sim.dungeon.rooms.find((r) => r.type === 'combat') ??
      sim.dungeon.rooms[0]!;
    sim.enterRoom(combatRoom.id);
    sim.inHub = false;
    sim.currentBiome = c.biome;
    sim.currentFloor = c.biome === 1 ? 1 : c.biome === 2 ? 3 : 5;
    sim.map.biome = c.biome;
    (sim as { waveBannerTimer?: number }).waveBannerTimer = 0;

    const showcaseShapes = [
      'octagon',
      'cruciform',
      'hourglass',
      'l_shape',
      't_shape',
      'u_shape',
      'donut_ring',
      'multi_chamber',
      'island_catwalk',
      'rectangle',
    ] as const;
    const showcasePresets = [
      'standard',
      'grand_arena',
      'wide_hall',
      'tall_sanctum',
      'compact',
      'colossal_boss',
    ] as const;
    const neighborIds = new Set(
      Object.values(combatRoom.connections).filter((id): id is number => id !== undefined),
    );
    for (let i = 0; i < sim.dungeon.rooms.length; i++) {
      const rm = sim.dungeon.rooms[i]!;
      if (rm.id === combatRoom.id) {
        rm.roomShape = c.shape;
        rm.roomSizePreset = c.preset;
        rm.cols = c.cols;
        rm.rows = c.rows;
        rm.discovery = 'visited';
        rm.cleared = false;
      } else if (rm.type !== 'secret') {
        rm.roomShape = showcaseShapes[i % showcaseShapes.length]!;
        rm.roomSizePreset = showcasePresets[i % showcasePresets.length]!;
        if (rm.type === 'start' || neighborIds.has(rm.id)) {
          rm.discovery = 'cleared';
          rm.cleared = true;
        } else {
          rm.discovery = 'discovered';
          rm.cleared = false;
        }
      }
    }

    sim.map.roomSizePreset = c.preset;
    sim.map.configureRoomLayout({
      roomSeed: c.roomSeed,
      archetype: c.archetype,
      biome: c.biome,
      activeDoorSides: ['N', 'S', 'E', 'W'],
      roomShape: c.shape,
      roomSizePreset: c.preset,
      cols: c.cols,
      rows: c.rows,
    });
    (sim.map as { roomShape?: string }).roomShape = c.shape;

    if (c.extraSurfaces) {
      for (const s of c.extraSurfaces) {
        for (let dy = 0; dy < s.h; dy++) {
          for (let dx = 0; dx < s.w; dx++) {
            const tx = s.tx + dx;
            const ty = s.ty + dy;
            if (
              tx > 0 &&
              ty > 0 &&
              tx < sim.map.cols - 1 &&
              ty < sim.map.rows - 1 &&
              !sim.map.isSolidTile(tx, ty) &&
              sim.map.getSurface(tx, ty) !== 'chasm'
            ) {
              sim.map.setSurface(tx, ty, s.surface, 0, true);
            }
          }
        }
      }
    }

    sim.rebuildCurrentRoomDoors();

    // Respawn room props + 6 well-distributed torch_braziers relocated to nearest walkable floor
    // so every sculpted corner, concave miter, and Exterior Void wall boundary is brightly lit
    sim.props.length = 0;
    const bLeftX = Math.max(4, Math.round((6 * sim.map.cols) / 36));
    const bRightX = sim.map.cols - 1 - bLeftX;
    const bMidX = Math.floor(sim.map.cols / 2);
    const bTopY = Math.max(3, Math.round((4 * sim.map.rows) / 22));
    const bBotY = sim.map.rows - 1 - bTopY;
    const brazierTargets: readonly [number, number][] = [
      [bLeftX, bTopY],
      [bRightX, bTopY],
      [bLeftX, bBotY],
      [bRightX, bBotY],
      [bMidX - 5, Math.floor(sim.map.rows / 2)],
      [bMidX + 5, Math.floor(sim.map.rows / 2)],
    ];
    const isDryShowcasePropTile = (tx: number, ty: number, minDistPx = 28): boolean => {
      if (tx <= 1 || ty <= 1 || tx >= sim.map.cols - 2 || ty >= sim.map.rows - 2) return false;
      if (sim.map.isSolidTile(tx, ty) || sim.map.getSurface(tx, ty) !== 'none') return false;
      const wx = tx * 32 + 16;
      const wy = ty * 32 + 16;
      for (const p of sim.props) {
        if (Math.hypot(p.x - wx, p.y - wy) < minDistPx) return false;
      }
      return true;
    };

    for (const [rawBx, rawBy] of brazierTargets) {
      let btx = rawBx;
      let bty = rawBy;
      if (!isDryShowcasePropTile(btx, bty)) {
        let found = false;
        for (let ring = 1; ring <= 14 && !found; ring++) {
          for (let dy = -ring; dy <= ring && !found; dy++) {
            for (let dx = -ring; dx <= ring && !found; dx++) {
              const nx = rawBx + dx;
              const ny = rawBy + dy;
              if (isDryShowcasePropTile(nx, ny)) {
                btx = nx;
                bty = ny;
                found = true;
              }
            }
          }
        }
      }
      if (isDryShowcasePropTile(btx, bty)) {
        sim.spawnProp('torch_brazier', btx * 32 + 16, bty * 32 + 16);
      }
    }
    for (const a of sim.map.propAnchors) {
      let atx = a.tx;
      let aty = a.ty;
      const isRingPillar = a.id.startsWith('cpr_ring_pillar_');
      if (!isRingPillar && !isDryShowcasePropTile(atx, aty, 24)) {
        let found = false;
        for (let ring = 1; ring <= 12 && !found; ring++) {
          for (let dy = -ring; dy <= ring && !found; dy++) {
            for (let dx = -ring; dx <= ring && !found; dx++) {
              const nx = a.tx + dx;
              const ny = a.ty + dy;
              if (isDryShowcasePropTile(nx, ny, 24)) {
                atx = nx;
                aty = ny;
                found = true;
              }
            }
          }
        }
      }
      const spawnX = atx === a.tx && aty === a.ty ? a.x : atx * 32 + 16;
      const spawnY = atx === a.tx && aty === a.ty ? a.y : aty * 32 + 16;
      if (isRingPillar || sim.map.getSurface(atx, aty) === 'none') {
        sim.spawnProp(a.propKind, spawnX, spawnY);
      }
    }

    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;
    const rawPx = cx + (c.playerOffset?.dx ?? -96);
    const rawPy = cy + (c.playerOffset?.dy ?? 0);
    let safePx = rawPx;
    let safePy = rawPy;
    const ptx = Math.floor(rawPx / 32);
    const pty = Math.floor(rawPy / 32);
    if (sim.map.isSolidTile(ptx, pty) || sim.map.getSurface(ptx, pty) === 'chasm') {
      for (let ring = 1; ring < 20; ring++) {
        let found = false;
        for (let dy = -ring; dy <= ring && !found; dy++) {
          for (let dx = -ring; dx <= ring && !found; dx++) {
            const tx = ptx + dx;
            const ty = pty + dy;
            if (
              tx > 1 &&
              ty > 1 &&
              tx < sim.map.cols - 2 &&
              ty < sim.map.rows - 2 &&
              !sim.map.isSolidTile(tx, ty) &&
              sim.map.getSurface(tx, ty) !== 'chasm'
            ) {
              safePx = tx * 32 + 16;
              safePy = ty * 32 + 16;
              found = true;
            }
          }
        }
        if (found) break;
      }
    }
    Object.assign(sim.player, {
      godMode: true,
      x: safePx,
      y: safePy,
      prevX: safePx,
      prevY: safePy,
      vx: 0,
      vy: 0,
      aimAngle: 0,
    });

    sim.enemies.length = 0;
    sim.projectiles.length = 0;
    sim.pickups.length = 0;
    for (const eSpec of c.enemies ?? []) {
      let etx = Math.min(sim.map.cols - 3, Math.max(2, eSpec.tx));
      let ety = Math.min(sim.map.rows - 3, Math.max(2, eSpec.ty));
      if (sim.map.isSolidTile(etx, ety) || sim.map.getSurface(etx, ety) === 'chasm') {
        for (let r = 1; r <= 12; r++) {
          let ok = false;
          for (let dy = -r; dy <= r && !ok; dy++) {
            for (let dx = -r; dx <= r && !ok; dx++) {
              const nx = etx + dx;
              const ny = ety + dy;
              if (
                nx > 1 &&
                ny > 1 &&
                nx < sim.map.cols - 2 &&
                ny < sim.map.rows - 2 &&
                !sim.map.isSolidTile(nx, ny) &&
                sim.map.getSurface(nx, ny) !== 'chasm'
              ) {
                etx = nx;
                ety = ny;
                ok = true;
              }
            }
          }
          if (ok) break;
        }
      }
      const spawned = sim.spawnEnemy(
        eSpec.defId as Parameters<typeof sim.spawnEnemy>[0],
        etx * 32 + 16,
        ety * 32 + 16,
        true,
        eSpec.elite,
      );
      spawned.hp = spawned.maxHp = 900;
      spawned.vx = 0;
      spawned.vy = 0;
      spawned.aiState = 'idle';
      spawned.stateTimer = 99;
    }

    sim.map.mapRevision += 1;
    if (gs) {
      gs.destroyPortalAndDoorVisuals?.();
      gs.lastRenderedBiome = -1;
      gs.lastMapRevision = -1;
      gs.syncArenaTilesWithMapRevision?.();
      gs.syncProps?.(0);
      gs.syncRoomEntities?.(0);
      gs.camFocusX = cx;
      gs.camFocusY = cy;
      gs.lastShakeX = 0;
      gs.lastShakeY = 0;
      gs.irisTransitionProgress = 0;
      gs.irisTransitionDir = 0;
      if (gs.cameras?.main) {
        gs.cameras.main.setZoom(c.zoom);
        gs.cameras.main.centerOn(cx, cy);
      }
      gs.updateCameraWithLookaheadAndShake = () => {
        const cam = gs.cameras?.main;
        const mx = sim.map.width * 0.5;
        const my = sim.map.height * 0.5;
        gs.camFocusX = mx;
        gs.camFocusY = my;
        gs.lastShakeX = 0;
        gs.lastShakeY = 0;
        if (cam) {
          cam.setZoom(c.zoom);
          cam.centerOn(mx, my);
        }
      };
      gs.invalidateAllHudCaches?.();
      gs.lastMinimapHash = '';
      gs.lastBossHudHash = '__force__';
      (gs as Record<string, { destroy?: () => void }>).__p11WaveBannerContainer?.destroy?.();
      gs.updateBossHud?.();
      gs.updateVectorHud?.();
      gs.updateMinimapHud?.();
    }
  }, cfg);

  await stepDeterministicFrames(page, 40);

  await page.evaluate(() => {
    const sim = window.__GAME_TRANSPORT__?.getSim() as { waveBannerTimer?: number } | undefined;
    if (sim) sim.waveBannerTimer = 0;
    const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
      | {
          lastMinimapHash?: string;
          lastBossHudHash?: string;
          invalidateAllHudCaches?: () => void;
          updateBossHud?: () => void;
          updateVectorHud?: () => void;
          updateMinimapHud?: () => void;
        }
      | undefined;
    if (gs) {
      gs.invalidateAllHudCaches?.();
      gs.lastMinimapHash = '';
      gs.lastBossHudHash = '__force__';
      (gs as Record<string, { destroy?: () => void }>).__p11WaveBannerContainer?.destroy?.();
      gs.updateBossHud?.();
      gs.updateVectorHud?.();
      gs.updateMinimapHud?.();
    }
  });
  await stepDeterministicFrames(page, 5);
}

function defineOverhaulScene(def: VisualSceneDef): VisualSceneDef {
  return {
    freezeMaskRects: DEFAULT_FREEZE_MASK_RECTS,
    ...def,
  };
}

const MAP_OVERHAUL_SCENES: readonly VisualSceneDef[] = [
  defineOverhaulScene({
    id: '01-hub-sanctuary',
    description:
      'Hub Sanctuary (36x22 rectangle runic flagstones, active golden departure portal, character statues, weapon rack, braziers, rectangular Minimap node)',
    url: DEFAULT_HUB_URL,
    expectedScene: 'GameScene',
    sampleRects: HUB_SAMPLE_RECTS,
    setup: async (page) => {
      await page.evaluate(() => {
        const sim = window.__GAME_TRANSPORT__!.getSim();
        const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
          | (Record<string, unknown> & {
              cameras?: {
                main?: {
                  setZoom: (z: number) => void;
                  centerOn: (x: number, y: number) => void;
                };
              };
              invalidateAllHudCaches?: () => void;
              updateVectorHud?: () => void;
              updateMinimapHud?: () => void;
              lastMinimapHash?: string;
              camFocusX?: number;
              camFocusY?: number;
              lastShakeX?: number;
              lastShakeY?: number;
              irisTransitionProgress?: number;
              irisTransitionDir?: number;
              updateCameraWithLookaheadAndShake?: (...args: unknown[]) => void;
            })
          | undefined;
        sim.enterHub();
        sim.togglePlayerReady(sim.player.id, true);
        Object.assign(sim.player, {
          x: 480,
          y: 325,
          prevX: 480,
          prevY: 325,
          vx: 0,
          vy: 0,
          aimAngle: 0,
        });
        if (gs) {
          gs.camFocusX = 540;
          gs.camFocusY = 335;
          gs.lastShakeX = 0;
          gs.lastShakeY = 0;
          gs.irisTransitionProgress = 0;
          gs.irisTransitionDir = 0;
          if (gs.cameras?.main) {
            gs.cameras.main.setZoom(1.65);
            gs.cameras.main.centerOn(540, 335);
          }
          gs.updateCameraWithLookaheadAndShake = () => {
            if (gs.cameras?.main) {
              gs.cameras.main.setZoom(1.65);
              gs.cameras.main.centerOn(540, 335);
            }
          };
          gs.lastMinimapHash = '';
          gs.invalidateAllHudCaches?.();
          gs.updateVectorHud?.();
          gs.updateMinimapHud?.();
        }
      });
      await stepDeterministicFrames(page, 45);
    },
  }),
  defineOverhaulScene({
    id: '02-biome1-ashwood-crypts',
    description:
      'Biome 1 Ashwood Crypts (standard 36x22 rectangle CENTRAL_BASTION with poison_swamp, electrified_water, burning_grass, 2x2 pillars)',
    url: DEFAULT_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await setupTopologyShowcaseScene(page, {
        roomSeed: 102,
        biome: 1,
        preset: 'standard',
        cols: 36,
        rows: 22,
        shape: 'rectangle',
        archetype: 'CENTRAL_BASTION',
        zoom: 1.52,
        playerOffset: { dx: -110, dy: -16 },
        extraSurfaces: [
          { tx: 9, ty: 5, w: 6, h: 5, surface: 'poison_swamp' },
          { tx: 16, ty: 4, w: 5, h: 3, surface: 'water' },
          { tx: 18, ty: 14, w: 5, h: 3, surface: 'electrified_water' },
          { tx: 22, ty: 5, w: 5, h: 4, surface: 'grass' },
          { tx: 11, ty: 14, w: 5, h: 4, surface: 'burning_grass' },
        ],
        enemies: [
          { defId: 'goblin_shooter', tx: 22, ty: 8 },
          { defId: 'green_slime', tx: 13, ty: 8 },
          { defId: 'spore_bomber', tx: 24, ty: 13 },
          { defId: 'goblin_shaman', tx: 26, ty: 10 },
          { defId: 'wild_boar', tx: 20, ty: 11, elite: 'shield' },
        ],
      });
    },
  }),
  defineOverhaulScene({
    id: '03-biome2-glacial-vaults',
    description:
      'Biome 2 Glacial Vaults (TWIN_BRIDGES unlocked on non-rectangular octagon 36x22 with #0B090E Exterior Void corners, chasm strata, 3-tile bridges, crystalline ice, octagonal Minimap node)',
    url: BIOME2_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await setupTopologyShowcaseScene(page, {
        roomSeed: 203,
        biome: 2,
        preset: 'standard',
        cols: 36,
        rows: 22,
        shape: 'octagon',
        archetype: 'TWIN_BRIDGES',
        zoom: 1.38,
        playerOffset: { dx: -112, dy: 0 },
        extraSurfaces: [
          { tx: 7, ty: 6, w: 6, h: 4, surface: 'ice' },
          { tx: 22, ty: 8, w: 6, h: 5, surface: 'ice' },
          { tx: 6, ty: 13, w: 5, h: 3, surface: 'water' },
        ],
        enemies: [
          { defId: 'ice_golem', tx: 23, ty: 10, elite: 'shield' },
          { defId: 'ice_mage', tx: 26, ty: 9 },
          { defId: 'baby_yeti', tx: 24, ty: 13, elite: 'giant' },
          { defId: 'frost_bat', tx: 12, ty: 8 },
        ],
      });
    },
  }),
  defineOverhaulScene({
    id: '04-biome3-molten-foundry',
    description:
      'Biome 3 Molten Foundry (CROSSFIRE_CONVEYORS on sculpted octagon 36x22 with molten lava, scrolling conveyors, slag crucibles, octagonal Minimap node)',
    url: BIOME3_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await setupTopologyShowcaseScene(page, {
        roomSeed: 304,
        biome: 3,
        preset: 'standard',
        cols: 36,
        rows: 22,
        shape: 'octagon',
        archetype: 'CROSSFIRE_CONVEYORS',
        zoom: 1.38,
        playerOffset: { dx: -112, dy: 0 },
        extraSurfaces: [
          { tx: 13, ty: 4, w: 6, h: 3, surface: 'lava' },
          { tx: 21, ty: 15, w: 6, h: 3, surface: 'lava' },
          { tx: 8, ty: 15, w: 4, h: 2, surface: 'burning_oil' },
        ],
        enemies: [
          { defId: 'coal_golem', tx: 22, ty: 11, elite: 'explosive_death' },
          { defId: 'dwarf_cannon', tx: 26, ty: 8 },
          { defId: 'welder_drone', tx: 25, ty: 13 },
          { defId: 'fire_imp', tx: 16, ty: 9 },
          { defId: 'iron_shielder', tx: 20, ty: 12, elite: 'shield' },
        ],
      });
    },
  }),
  defineOverhaulScene({
    id: '05-topology-octagon-cruciform',
    description:
      'Deep Cruciform Chamber (grand_arena 44x26 CRUMBLING_PILLAR_RING with all 4 deep 10x6 #0B090E Exterior Void corner cutouts, 1-tile perimeter walls, 90-deg concave parapet miters, and + cross Minimap silhouette)',
    url: DEFAULT_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await setupTopologyShowcaseScene(page, {
        roomSeed: 505,
        biome: 1,
        preset: 'grand_arena',
        cols: 44,
        rows: 26,
        shape: 'cruciform',
        archetype: 'CRUMBLING_PILLAR_RING',
        zoom: 1.24,
        playerOffset: { dx: -96, dy: 0 },
        extraSurfaces: [
          { tx: 16, ty: 9, w: 4, h: 3, surface: 'poison_swamp' },
          { tx: 24, ty: 13, w: 4, h: 3, surface: 'burning_grass' },
          { tx: 18, ty: 15, w: 4, h: 3, surface: 'water' },
        ],
        enemies: [
          { defId: 'wild_boar', tx: 22, ty: 12, elite: 'shield' },
          { defId: 'goblin_shaman', tx: 26, ty: 11 },
          { defId: 'spore_bomber', tx: 25, ty: 15 },
          { defId: 'thorn_turret', tx: 15, ty: 11 },
        ],
      });
    },
  }),
  defineOverhaulScene({
    id: '06-colossal-boss-arena',
    description:
      'Deep Octagon Colossal Boss Arena (48x28 Floor 6 Boss Arena with deep 7-tile diagonal chamfered #0B090E Exterior Void corners, monumental 2x2 boss columns, molten lava/oil, and octagonal boss Minimap silhouette)',
    url: BIOME3_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await page.evaluate(() => {
        const sim = window.__GAME_TRANSPORT__!.getSim();
        const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
          | (Record<string, unknown> & {
              cameras?: {
                main?: {
                  setZoom: (z: number) => void;
                  centerOn: (x: number, y: number) => void;
                };
              };
              destroyPortalAndDoorVisuals?: () => void;
              syncArenaTilesWithMapRevision?: () => void;
              syncProps?: (dt: number) => void;
              syncRoomEntities?: (dt: number) => void;
              invalidateAllHudCaches?: () => void;
              updateVectorHud?: () => void;
              updateMinimapHud?: () => void;
              lastMapRevision?: number;
              lastMinimapHash?: string;
              camFocusX?: number;
              camFocusY?: number;
              lastShakeX?: number;
              lastShakeY?: number;
              irisTransitionProgress?: number;
              irisTransitionDir?: number;
              lastRenderedBiome?: number;
              updateCameraWithLookaheadAndShake?: (...args: unknown[]) => void;
            })
          | undefined;

        sim.inHub = false;
        sim.currentBiome = 3;
        sim.map.biome = 3;
        sim.advanceToFloor(6);
        sim.inHub = false;
        sim.currentBiome = 3;
        sim.map.biome = 3;
        const bossRoom =
          sim.dungeon.rooms.find((r) => r.type === 'boss') ??
          sim.dungeon.rooms[sim.dungeon.rooms.length - 1]!;
        bossRoom.roomSizePreset = 'colossal_boss';
        bossRoom.cols = 48;
        bossRoom.rows = 28;
        bossRoom.roomShape = 'octagon';
        sim.enterRoom(bossRoom.id);
        sim.inHub = false;
        sim.currentBiome = 3;
        sim.map.biome = 3;

        const showcaseShapes = [
          'octagon',
          'cruciform',
          'hourglass',
          'l_shape',
          't_shape',
          'u_shape',
          'donut_ring',
          'multi_chamber',
          'island_catwalk',
          'rectangle',
        ] as const;
        const bossNeighborIds = new Set(
          Object.values(bossRoom.connections).filter((id): id is number => id !== undefined),
        );
        for (let i = 0; i < sim.dungeon.rooms.length; i++) {
          const rm = sim.dungeon.rooms[i]!;
          if (rm.id === bossRoom.id) {
            rm.roomShape = 'octagon';
            rm.roomSizePreset = 'colossal_boss';
            rm.cols = 48;
            rm.rows = 28;
            rm.discovery = 'visited';
          } else if (rm.type !== 'secret') {
            rm.roomShape = showcaseShapes[i % showcaseShapes.length]!;
            if (rm.type === 'start' || bossNeighborIds.has(rm.id)) {
              rm.discovery = 'cleared';
              rm.cleared = true;
            } else {
              rm.discovery = 'discovered';
              rm.cleared = false;
            }
          }
        }

        // Explicitly carve deep 7-tile diagonal chamfered octagon corners on the 48x28 boss arena
        const cols = sim.map.cols;
        const rows = sim.map.rows;
        const midX = Math.floor(cols / 2);
        const midY = Math.floor(rows / 2);
        const chamfer = 7;
        for (let ty = 1; ty < rows - 1; ty++) {
          for (let tx = 1; tx < cols - 1; tx++) {
            const inDoorVestibule =
              (Math.abs(tx - midX) <= 1 && (ty <= 3 || ty >= rows - 4)) ||
              (Math.abs(ty - midY) <= 1 && (tx <= 3 || tx >= cols - 4));
            if (inDoorVestibule) continue;
            const dx = Math.min(tx - 1, cols - 2 - tx);
            const dy = Math.min(ty - 1, rows - 2 - ty);
            if (dx + dy < chamfer) {
              const idx = ty * cols + tx;
              sim.map.tiles[idx] = 'wall';
              sim.map.surfaces[idx] = 'none';
              sim.map.baseSurfaces[idx] = 'none';
              sim.map.surfaceTimers[idx] = 0;
            }
          }
        }
        (sim.map as { roomShape?: string }).roomShape = 'octagon';
        sim.map.roomSizePreset = 'colossal_boss';
        sim.map.rebuildSolidBoxes();

        sim.map.fillSurfaceRect(19, 9, 6, 4, 'lava');
        sim.map.fillSurfaceRect(19, 16, 6, 3, 'lava');
        sim.map.fillSurfaceRect(26, 10, 4, 3, 'burning_oil');

        // Spawn perimeter braziers near the octagonal corners to illuminate all 8 walls
        for (const [rawBx, rawBy] of [
          [9, 5],
          [38, 5],
          [9, 22],
          [38, 22],
          [16, 8],
          [31, 8],
          [16, 19],
          [31, 19],
        ] as const) {
          let btx = rawBx;
          let bty = rawBy;
          if (sim.map.isSolidTile(btx, bty) || sim.map.getSurface(btx, bty) !== 'none') {
            let found = false;
            for (let ring = 1; ring <= 8 && !found; ring++) {
              for (let dy = -ring; dy <= ring && !found; dy++) {
                for (let dx = -ring; dx <= ring && !found; dx++) {
                  const nx = rawBx + dx;
                  const ny = rawBy + dy;
                  if (
                    nx > 1 &&
                    ny > 1 &&
                    nx < sim.map.cols - 2 &&
                    ny < sim.map.rows - 2 &&
                    !sim.map.isSolidTile(nx, ny) &&
                    sim.map.getSurface(nx, ny) === 'none'
                  ) {
                    btx = nx;
                    bty = ny;
                    found = true;
                  }
                }
              }
            }
          }
          if (!sim.map.isSolidTile(btx, bty) && sim.map.getSurface(btx, bty) === 'none') {
            sim.spawnProp('torch_brazier', btx * 32 + 16, bty * 32 + 16);
          }
        }

        Object.assign(sim.player, {
          godMode: true,
          x: 640,
          y: 448,
          prevX: 640,
          prevY: 448,
          vx: 0,
          vy: 0,
          aimAngle: 0,
        });

        let boss = sim.enemies.find((e) => e.isBoss);
        if (!boss) {
          boss = sim.spawnEnemy('forge_titan', 832, 448, true);
        }
        Object.assign(boss, {
          x: 832,
          y: 448,
          vx: 0,
          vy: 0,
          bossPhase: 2,
          hp: Math.floor(boss.maxHp * 0.62),
          aiState: 'attack',
          stateTimer: 10,
        });

        sim.map.mapRevision += 1;
        const cx = sim.map.width * 0.5;
        const cy = sim.map.height * 0.5;
        if (gs) {
          gs.destroyPortalAndDoorVisuals?.();
          gs.lastRenderedBiome = -1;
          gs.lastMapRevision = -1;
          gs.syncArenaTilesWithMapRevision?.();
          gs.syncProps?.(0);
          gs.syncRoomEntities?.(0);
          gs.camFocusX = cx;
          gs.camFocusY = cy;
          gs.lastShakeX = 0;
          gs.lastShakeY = 0;
          gs.irisTransitionProgress = 0;
          gs.irisTransitionDir = 0;
          if (gs.cameras?.main) {
            gs.cameras.main.setZoom(1.16);
            gs.cameras.main.centerOn(cx, cy);
          }
          gs.updateCameraWithLookaheadAndShake = () => {
            const cam = gs.cameras?.main;
            const mx = sim.map.width * 0.5;
            const my = sim.map.height * 0.5;
            gs.camFocusX = mx;
            gs.camFocusY = my;
            gs.lastShakeX = 0;
            gs.lastShakeY = 0;
            if (cam) {
              cam.setZoom(1.16);
              cam.centerOn(mx, my);
            }
          };
          gs.lastMinimapHash = '';
          gs.invalidateAllHudCaches?.();
          gs.updateVectorHud?.();
          gs.updateMinimapHud?.();
        }
      });
      await stepDeterministicFrames(page, 40);
      await page.evaluate(() => {
        const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
          | {
              lastMinimapHash?: string;
              invalidateAllHudCaches?: () => void;
              updateVectorHud?: () => void;
              updateMinimapHud?: () => void;
            }
          | undefined;
        if (gs) {
          gs.lastMinimapHash = '';
          gs.invalidateAllHudCaches?.();
          gs.updateVectorHud?.();
          gs.updateMinimapHud?.();
        }
      });
      await stepDeterministicFrames(page, 5);
    },
  }),
  defineOverhaulScene({
    id: '07-shape-hourglass',
    description:
      'Deep Hourglass Chamber (standard 36x22 GAUNTLET_CHOKEPOINT with deep North/South pinched waist #0B090E Exterior Void cutouts and pinched hourglass Minimap silhouette)',
    url: BIOME2_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await setupTopologyShowcaseScene(page, {
        roomSeed: 707,
        biome: 2,
        preset: 'standard',
        cols: 36,
        rows: 22,
        shape: 'hourglass',
        archetype: 'GAUNTLET_CHOKEPOINT',
        zoom: 1.38,
        playerOffset: { dx: -80, dy: 0 },
        extraSurfaces: [
          { tx: 14, ty: 9, w: 4, h: 4, surface: 'ice' },
          { tx: 19, ty: 9, w: 4, h: 4, surface: 'water' },
        ],
        enemies: [
          { defId: 'ice_golem', tx: 22, ty: 11, elite: 'shield' },
          { defId: 'ice_mage', tx: 26, ty: 8 },
          { defId: 'baby_yeti', tx: 26, ty: 14, elite: 'giant' },
          { defId: 'snow_spirit', tx: 11, ty: 8 },
        ],
      });
    },
  }),
  defineOverhaulScene({
    id: '08-shape-l-shape',
    description:
      'Deep L-Shape Chamber (standard 36x22 CENTRAL_BASTION with entire NE quadrant carved into #0B090E Exterior Void, continuous 1-tile L-wall, and L-shaped Minimap silhouette)',
    url: DEFAULT_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await setupTopologyShowcaseScene(page, {
        roomSeed: 808,
        biome: 1,
        preset: 'standard',
        cols: 36,
        rows: 22,
        shape: 'l_shape',
        archetype: 'CENTRAL_BASTION',
        zoom: 1.38,
        playerOffset: { dx: -96, dy: -64 },
        extraSurfaces: [
          { tx: 8, ty: 5, w: 5, h: 4, surface: 'poison_swamp' },
          { tx: 22, ty: 13, w: 5, h: 4, surface: 'electrified_water' },
          { tx: 13, ty: 15, w: 5, h: 3, surface: 'burning_grass' },
        ],
        enemies: [
          { defId: 'goblin_shooter', tx: 16, ty: 6 },
          { defId: 'wild_boar', tx: 20, ty: 14, elite: 'shield' },
          { defId: 'spore_bomber', tx: 26, ty: 15 },
          { defId: 'goblin_shaman', tx: 11, ty: 15 },
        ],
      });
    },
  }),
  defineOverhaulScene({
    id: '09-shape-t-shape',
    description:
      'Deep T-Shape Chamber (standard 36x22 PRISM_LABYRINTH with SW and SE quadrants carved into #0B090E Exterior Void, wide Northern crossbar, central Southern stem, and T-shaped Minimap silhouette)',
    url: BIOME2_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await setupTopologyShowcaseScene(page, {
        roomSeed: 909,
        biome: 2,
        preset: 'standard',
        cols: 36,
        rows: 22,
        shape: 't_shape',
        archetype: 'PRISM_LABYRINTH',
        zoom: 1.38,
        playerOffset: { dx: -96, dy: -64 },
        extraSurfaces: [
          { tx: 8, ty: 6, w: 5, h: 4, surface: 'ice' },
          { tx: 23, ty: 6, w: 5, h: 4, surface: 'ice' },
          { tx: 16, ty: 14, w: 4, h: 4, surface: 'water' },
        ],
        enemies: [
          { defId: 'ice_golem', tx: 18, ty: 15, elite: 'shield' },
          { defId: 'ice_mage', tx: 25, ty: 8 },
          { defId: 'baby_yeti', tx: 11, ty: 8, elite: 'giant' },
          { defId: 'frost_bat', tx: 18, ty: 7 },
        ],
      });
    },
  }),
  defineOverhaulScene({
    id: '10-shape-u-shape',
    description:
      'Deep U-Shape Chamber (standard 36x22 CROSSFIRE_CONVEYORS with deep North courtyard #0B090E Exterior Void cutouts, central baffle wall, West/South/East wrap-around wings, and U-shaped Minimap silhouette)',
    url: BIOME3_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await setupTopologyShowcaseScene(page, {
        roomSeed: 1010,
        biome: 3,
        preset: 'standard',
        cols: 36,
        rows: 22,
        shape: 'u_shape',
        archetype: 'CROSSFIRE_CONVEYORS',
        zoom: 1.38,
        playerOffset: { dx: -160, dy: -32 },
        extraSurfaces: [
          { tx: 14, ty: 15, w: 8, h: 3, surface: 'lava' },
          { tx: 5, ty: 9, w: 4, h: 3, surface: 'burning_oil' },
          { tx: 27, ty: 9, w: 4, h: 3, surface: 'oil' },
        ],
        enemies: [
          { defId: 'coal_golem', tx: 18, ty: 14, elite: 'explosive_death' },
          { defId: 'dwarf_cannon', tx: 28, ty: 8 },
          { defId: 'welder_drone', tx: 27, ty: 13 },
          { defId: 'iron_shielder', tx: 10, ty: 14, elite: 'shield' },
        ],
      });
    },
  }),
  defineOverhaulScene({
    id: '11-shape-donut-ring',
    description:
      'Deep Donut-Ring Chamber (grand_arena 44x26 CRUMBLING_PILLAR_RING with chamfered #0B090E Exterior Void corners, massive hollow-core central architectural wall monolith, perimeter ring corridor, and hollow-ring Minimap silhouette)',
    url: DEFAULT_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await setupTopologyShowcaseScene(page, {
        roomSeed: 1111,
        biome: 1,
        preset: 'grand_arena',
        cols: 44,
        rows: 26,
        shape: 'donut_ring',
        archetype: 'CRUMBLING_PILLAR_RING',
        zoom: 1.24,
        playerOffset: { dx: -192, dy: 0 },
        extraSurfaces: [
          { tx: 10, ty: 10, w: 4, h: 5, surface: 'poison_swamp' },
          { tx: 30, ty: 10, w: 4, h: 5, surface: 'electrified_water' },
          { tx: 19, ty: 5, w: 6, h: 3, surface: 'burning_grass' },
          { tx: 19, ty: 18, w: 6, h: 3, surface: 'water' },
        ],
        enemies: [
          { defId: 'wild_boar', tx: 22, ty: 6, elite: 'shield' },
          { defId: 'goblin_shaman', tx: 32, ty: 12 },
          { defId: 'spore_bomber', tx: 22, ty: 19 },
          { defId: 'goblin_shooter', tx: 12, ty: 14 },
        ],
      });
    },
  }),
  defineOverhaulScene({
    id: '12-shape-multi-chamber',
    description:
      'Deep Multi-Chamber / Split-Wing Chamber (standard 36x22 GAUNTLET_CHOKEPOINT with staggered NE and SW #0B090E Exterior Void quadrants, interior partition wall wings with narrow doorway chokepoints, and twin-lobe multi_chamber Minimap silhouette)',
    url: BIOME2_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await setupTopologyShowcaseScene(page, {
        roomSeed: 1212,
        biome: 2,
        preset: 'standard',
        cols: 36,
        rows: 22,
        shape: 'multi_chamber',
        archetype: 'GAUNTLET_CHOKEPOINT',
        zoom: 1.38,
        playerOffset: { dx: -128, dy: -64 },
        extraSurfaces: [
          { tx: 6, ty: 6, w: 5, h: 4, surface: 'ice' },
          { tx: 16, ty: 10, w: 4, h: 3, surface: 'water' },
          { tx: 25, ty: 13, w: 5, h: 4, surface: 'ice' },
        ],
        enemies: [
          { defId: 'ice_golem', tx: 18, ty: 11, elite: 'shield' },
          { defId: 'baby_yeti', tx: 27, ty: 15, elite: 'giant' },
          { defId: 'ice_mage', tx: 9, ty: 8 },
          { defId: 'snow_spirit', tx: 21, ty: 15 },
        ],
      });
    },
  }),
  defineOverhaulScene({
    id: '13-shape-island-catwalk',
    description:
      'Deep Island / Catwalk over Chasm Chamber (standard 36x22 CENTRAL_BASTION with chamfered #0B090E Exterior Void corners, wide 360-deg perimeter Chasm moat surrounding the central combat island, 3-tile cardinal stone catwalks, and island/catwalk Minimap silhouette)',
    url: BIOME3_GAME_URL,
    expectedScene: 'GameScene',
    sampleRects: ENVIRONMENT_SAMPLE_RECTS,
    setup: async (page) => {
      await setupTopologyShowcaseScene(page, {
        roomSeed: 1313,
        biome: 3,
        preset: 'standard',
        cols: 36,
        rows: 22,
        shape: 'island_catwalk',
        archetype: 'CENTRAL_BASTION',
        zoom: 1.38,
        playerOffset: { dx: -96, dy: 0 },
        extraSurfaces: [
          { tx: 11, ty: 6, w: 4, h: 3, surface: 'lava' },
          { tx: 21, ty: 13, w: 4, h: 3, surface: 'lava' },
        ],
        enemies: [
          { defId: 'coal_golem', tx: 22, ty: 10, elite: 'explosive_death' },
          { defId: 'dwarf_cannon', tx: 24, ty: 7 },
          { defId: 'welder_drone', tx: 13, ty: 14 },
          { defId: 'iron_shielder', tx: 19, ty: 13, elite: 'shield' },
        ],
      });
    },
  }),
];

interface CapturedSceneBuffers {
  litBuffer: Buffer;
  unlitBuffer?: Buffer;
  stripBuffer?: Buffer;
  animResult?: CapturedAnimatedSceneResult;
}

async function captureSingleSceneOnce(
  page: Page,
  scene: VisualSceneDef,
  capturedBuffers: Map<string, Buffer>,
): Promise<CapturedSceneBuffers> {
  const viewport = scene.viewport ?? { width: 1920, height: 1080 };
  await page.setViewportSize(viewport);

  if (scene.grayscaleFrom && capturedBuffers.has(scene.grayscaleFrom)) {
    const sourceBuffer = capturedBuffers.get(scene.grayscaleFrom)!;
    return {
      litBuffer: convertPngBufferToGrayscale(sourceBuffer),
    };
  }

  const isOverhaulScene = MAP_OVERHAUL_SCENES.some((s) => s.id === scene.id);
  const alreadyInGameScene = isOverhaulScene
    ? await page
        .evaluate((expected: string) => {
          const dbg = (
            window as unknown as {
              __GAME_DEBUG__?: { scene?: string; fontsLoaded?: boolean };
            }
          ).__GAME_DEBUG__;
          return dbg?.scene === expected && dbg?.fontsLoaded === true;
        }, scene.expectedScene)
        .catch(() => false)
    : false;

  if (!alreadyInGameScene) {
    await page
      .evaluate(() => {
        const win = window as unknown as {
          __PHASER_GAME__?: { destroy?: (removeCanvas: boolean) => void };
        };
        try {
          win.__PHASER_GAME__?.destroy?.(true);
          win.__PHASER_GAME__ = undefined;
        } catch {
          // Ignore teardown errors
        }
      })
      .catch(() => {});

    const targetUrl = scene.url.startsWith('http') ? scene.url : `http://127.0.0.1:5189${scene.url}`;
    await page.goto(targetUrl);
    const waitDeadline = Date.now() + 45_000;
    let sceneReady = false;
    while (Date.now() < waitDeadline) {
      sceneReady = await page
        .evaluate((expected: string) => {
          const w = window as unknown as {
            __GAME_DEBUG__?: { scene?: string; fontsLoaded?: boolean };
            __STEP_RAF_FRAMES__?: (count: number) => Promise<void>;
          };
          const dbg = w.__GAME_DEBUG__;
          if (dbg?.scene === expected && dbg?.fontsLoaded === true) {
            return true;
          }
          w.__STEP_RAF_FRAMES__?.(4);
          return false;
        }, scene.expectedScene)
        .catch(() => false);
      if (sceneReady) break;
      await new Promise((r) => setTimeout(r, 60));
    }
    expect(
      sceneReady,
      `Scene "${scene.id}" (${scene.expectedScene}) failed to become ready within 45s`,
    ).toBe(true);
  }

  // Move mouse cursor to deterministic viewport center
  await page.mouse.move(Math.floor(viewport.width / 2), Math.floor(viewport.height / 2));

  if (scene.captureStrip && scene.expectedScene === 'GameScene') {
    await installSceneStripInstrumentation(page);
  }

  await scene.setup(page);

  if (scene.captureStrip) {
    if (scene.expectedScene !== 'GameScene') {
      const count = scene.frameCount ?? 8;
      const framesPerStep = scene.stripFramesPerStep ?? 4;
      const frameBuffers: Buffer[] = [];
      for (let fIdx = 0; fIdx < count; fIdx += 1) {
        if (fIdx > 0) {
          await stepDeterministicFrames(page, framesPerStep);
        }
        frameBuffers.push(await page.screenshot({ type: 'png' }));
      }
      const heroIdx = Math.min(Math.max(0, scene.heroFrameIndex ?? 0), frameBuffers.length - 1);
      const rawHero = frameBuffers[heroIdx]!;
      const litBuffer = scene.grayscaleFrom
        ? convertPngBufferToGrayscale(rawHero)
        : rawHero;
      const stripBuffer = stitchPngBuffersHorizontal(frameBuffers);
      await page.keyboard.up('KeyT');
      return {
        litBuffer,
        stripBuffer,
      };
    }

    const requiresHardAssert =
      scene.id.startsWith('ap2-') ||
      scene.stripSchedule !== undefined ||
      scene.apexEvent !== undefined;
    const effectiveGateMode: 'WARN_ONLY' | 'HARD_ASSERT' = requiresHardAssert
      ? process.env['ASHEN_ANIM_GATE_MODE'] === 'WARN_ONLY'
        ? 'WARN_ONLY'
        : 'HARD_ASSERT'
      : 'WARN_ONLY';

    const animResult = await captureAnimatedStripAndHeroScene(page, {
      id: scene.id,
      captureUnlit: scene.captureUnlit,
      grayscaleFrom: scene.grayscaleFrom,
      frameCount: scene.frameCount,
      stripFramesPerStep: scene.stripFramesPerStep,
      stripSchedule: scene.stripSchedule,
      heroFrameIndex: scene.heroFrameIndex,
      apexEvent: scene.apexEvent,
      actionRoi: scene.actionRoi,
      assertApexFlash: scene.assertApexFlash,
      gateMode: effectiveGateMode,
      setSceneLightingAndRenderStaticFrame,
    });
    await page.keyboard.up('KeyT');
    return {
      litBuffer: animResult.litBuffer,
      unlitBuffer: animResult.unlitBuffer,
      stripBuffer: animResult.stripBuffer,
      animResult,
    };
  }

  const rawLitBuffer = await page.screenshot({ type: 'png' });
  const litBuffer = scene.grayscaleFrom
    ? convertPngBufferToGrayscale(rawLitBuffer)
    : rawLitBuffer;

  let unlitBuffer: Buffer | undefined;
  if (scene.captureUnlit) {
    await setSceneLightingAndRenderStaticFrame(page, false);
    unlitBuffer = await page.screenshot({ type: 'png' });
    await setSceneLightingAndRenderStaticFrame(page, true);
  }

  await page.keyboard.up('KeyT');

  return {
    litBuffer,
    unlitBuffer,
  };
}

async function captureSingleScene(
  page: Page,
  scene: VisualSceneDef,
  capturedBuffers: Map<string, Buffer>,
): Promise<CapturedSceneBuffers> {
  try {
    return await captureSingleSceneOnce(page, scene, capturedBuffers);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Execution context was destroyed') || msg.includes('Target closed')) {
      return await captureSingleSceneOnce(page, scene, capturedBuffers);
    }
    throw err;
  }
}

test.describe('@visual Deterministic Visual Scene Catalog', () => {
  test.setTimeout(2_700_000);

  test('captures requested visual scenes, computes metrics, and optionally verifies freeze determinism', async () => {
    const ipv4Port = 5189;
    const ipv4BaseUrl = `http://127.0.0.1:${ipv4Port}`;
    const viteProc = spawn(
      'pnpm',
      [
        '--filter',
        '@ashen-pact/client',
        'dev',
        '--host',
        '127.0.0.1',
        '--port',
        String(ipv4Port),
        '--strictPort',
      ],
      {
        cwd: process.cwd(),
        stdio: 'ignore',
        detached: true,
      },
    );

    const startWait = Date.now();
    while (Date.now() - startWait < 25_000) {
      try {
        const res = await fetch(`${ipv4BaseUrl}/`);
        if (res.ok) break;
      } catch {
        // wait for server
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    const browser = await chromium.launch({
      ...(SYSTEM_CHROME_PATH ? { executablePath: SYSTEM_CHROME_PATH } : {}),
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-proxy-server',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
      ],
    });
    const context = await browser.newContext({
      baseURL: ipv4BaseUrl,
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    try {
      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
        if (msg.type() === 'warning') consoleWarnings.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

    const phase = (process.env['ASHEN_SHOTS_PHASE'] ?? 'p0').trim();
    const label = (process.env['ASHEN_SHOTS_LABEL'] ?? 'baseline').trim();
    const scenesFilterRaw = (process.env['ASHEN_SHOTS_SCENES'] ?? '').trim();
    const verifyFreeze =
      process.env['ASHEN_VERIFY_FREEZE'] === '1' ||
      process.env['ASHEN_VERIFY_FREEZE'] === 'true';

    const requestedIds = scenesFilterRaw
      ? scenesFilterRaw
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : null;

    const allCatalogScenes: readonly VisualSceneDef[] = [
      ...MAP_OVERHAUL_SCENES,
      ...VISUAL_SCENES,
    ];

    const selectedScenes: VisualSceneDef[] = requestedIds
      ? requestedIds.map((id) => {
          const found = allCatalogScenes.find((s) => s.id === id);
          if (!found) {
            throw new Error(
              `Unknown visual scene id "${id}". Available scenes: ${allCatalogScenes.map((s) => s.id).join(', ')}`,
            );
          }
          return found;
        })
      : [...MAP_OVERHAUL_SCENES];

    const shotDir = path.resolve(
      process.cwd(),
      'docs/screenshots',
      phase.startsWith('ap2-') || phase.startsWith('polish-') || phase.startsWith('phase-')
        ? phase
        : `polish-${phase}`,
      label,
    );
    fs.mkdirSync(shotDir, { recursive: true });

    const mapOverhaulDir = path.resolve(process.cwd(), 'output/playwright/map-overhaul');
    fs.mkdirSync(mapOverhaulDir, { recursive: true });

    await page.addInitScript(() => {
      window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
        return window.setTimeout(() => cb(performance.now()), 8);
      };
    });
    await installDeterministicRafGate(page);

    const capturedPass1 = new Map<string, Buffer>();
    const capturedStripPass1 = new Map<string, Buffer>();
    const capturedAnimPass1 = new Map<string, CapturedAnimatedSceneResult>();
    const manifestEntries: SceneManifestEntry[] = [];
    const metricsOutput: Record<
      string,
      {
        lit?: Record<string, RegionMetrics>;
        unlit?: Record<string, RegionMetrics>;
        summary?: SceneEnvironmentSummary;
        animationGates?: AnimationGatesEvaluationResult;
      }
    > = {};

    for (const scene of selectedScenes) {
      const { litBuffer, unlitBuffer, stripBuffer, animResult } = await captureSingleScene(
        page,
        scene,
        capturedPass1,
      );

      capturedPass1.set(scene.id, litBuffer);
      if (stripBuffer) {
        capturedStripPass1.set(scene.id, stripBuffer);
      }
      if (animResult) {
        capturedAnimPass1.set(scene.id, animResult);
      }

      const litFilename = `${scene.id}.png`;
      fs.writeFileSync(path.join(shotDir, litFilename), litBuffer);
      if (MAP_OVERHAUL_SCENES.some((s) => s.id === scene.id)) {
        fs.writeFileSync(path.join(mapOverhaulDir, litFilename), litBuffer);
      }

      // Auto-generate b3-combat-grayscale.png whenever b3-combat is captured
      if (scene.id === 'b3-combat') {
        const grayBuf = convertPngBufferToGrayscale(litBuffer);
        capturedPass1.set('b3-combat-grayscale', grayBuf);
        fs.writeFileSync(path.join(shotDir, 'b3-combat-grayscale.png'), grayBuf);
      }

      let unlitFilename: string | undefined;
      if (unlitBuffer) {
        unlitFilename = `${scene.id}-unlit.png`;
        fs.writeFileSync(path.join(shotDir, unlitFilename), unlitBuffer);
      }

      if (stripBuffer) {
        const stripFilename = `${scene.id}-strip.png`;
        fs.writeFileSync(path.join(shotDir, stripFilename), stripBuffer);
      }

      if (animResult) {
        for (const sheet of animResult.roiSheets) {
          fs.writeFileSync(
            path.join(shotDir, `${scene.id}-roi-${sheet.sheetIndex}.png`),
            sheet.pngBuffer,
          );
        }
        fs.writeFileSync(
          path.join(shotDir, `${scene.id}-telemetry-summary.md`),
          animResult.telemetrySummaryMd,
          'utf8',
        );
        fs.writeFileSync(
          path.join(shotDir, `${scene.id}-telemetry.json`),
          JSON.stringify(
            {
              roiMode: animResult.roiMode,
              telemetryInput: animResult.telemetryInput,
              gateReport: animResult.gateReport,
            },
            null,
            2,
          ),
          'utf8',
        );

        metricsOutput[scene.id] = {
          ...(metricsOutput[scene.id] ?? {}),
          animationGates: animResult.gateReport,
        };

        if (animResult.gateReport.mode === 'HARD_ASSERT') {
          expect(
            animResult.gateReport.passed,
            `Animation Gates failed for scene "${scene.id}": ${animResult.gateReport.failedGates.join(' | ')}`,
          ).toBe(true);
        } else if (
          animResult.gateReport.failedGates.length > 0 ||
          animResult.gateReport.warnings.length > 0
        ) {
          process.stdout.write(
            `[WARN_ONLY][${scene.id}] failedGates=${animResult.gateReport.failedGates.join(',')} | ${animResult.gateReport.warnings.join(' | ')}\n`,
          );
        }
      }

      if (scene.sampleRects && scene.sampleRects.length > 0) {
        const litRegions = analyzePngBufferRegions(litBuffer, scene.sampleRects);
        const unlitRegions = unlitBuffer
          ? analyzePngBufferRegions(unlitBuffer, scene.sampleRects)
          : undefined;
        const summary = computeSceneEnvironmentSummary(
          unlitRegions ?? litRegions,
          litRegions,
        );

        metricsOutput[scene.id] = {
          ...(metricsOutput[scene.id] ?? {}),
          lit: litRegions,
          ...(unlitRegions ? { unlit: unlitRegions } : {}),
          summary,
        };

        manifestEntries.push({
          id: scene.id,
          file: litFilename,
          ...(unlitFilename ? { unlitFile: unlitFilename } : {}),
          sampleRects: scene.sampleRects,
        });
      }
    }

    const manifestPath = path.join(shotDir, 'scene-manifest.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ scenes: manifestEntries }, null, 2),
      'utf8',
    );

    const freezeDiffs: Record<
      string,
      {
        diffPixels: number;
        totalPixels: number;
        diffRatio: number;
        roiDiffRatios?: Record<string, number>;
        traceHashMatched?: boolean;
      }
    > = {};

    const metricsPath = path.join(shotDir, 'metrics.json');
    const writeMetricsFile = (): void => {
      fs.writeFileSync(
        metricsPath,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            phase,
            label,
            scenes: metricsOutput,
            ...(verifyFreeze ? { freezeDiffs } : {}),
          },
          null,
          2,
        ),
        'utf8',
      );
    };

    writeMetricsFile();

    if (verifyFreeze) {
      const capturedPass2 = new Map<string, Buffer>();
      for (const scene of selectedScenes) {
        const pass1Buf = capturedPass1.get(scene.id);
        expect(pass1Buf, `Pass 1 buffer missing for scene ${scene.id}`).toBeDefined();

        const pass2 = await captureSingleScene(page, scene, capturedPass2);
        capturedPass2.set(scene.id, pass2.litBuffer);

        const diff = comparePngBuffers(
          pass1Buf!,
          pass2.litBuffer,
          scene.freezeMaskRects,
        );

        const roiDiffRatios: Record<string, number> = {};
        let traceHashMatched: boolean | undefined;

        const pass1Anim = capturedAnimPass1.get(scene.id);
        const pass1Strip = capturedStripPass1.get(scene.id);
        if (pass1Anim && pass2.animResult) {
          traceHashMatched =
            pass1Anim.perTickTraceHash === pass2.animResult.perTickTraceHash;
          expect(
            traceHashMatched,
            `Freeze determinism perTickTrace mismatch for strip scene "${scene.id}"`,
          ).toBe(true);

          for (let sIdx = 0; sIdx < pass1Anim.roiSheets.length; sIdx += 1) {
            const s1 = pass1Anim.roiSheets[sIdx]!;
            const s2 = pass2.animResult.roiSheets[sIdx];
            expect(s2, `Pass 2 ROI sheet ${s1.sheetIndex} missing for ${scene.id}`).toBeDefined();
            const roiDiff = comparePngBuffers(s1.pngBuffer, s2!.pngBuffer);
            const roiKey = `roi-${s1.sheetIndex}`;
            roiDiffRatios[roiKey] = roiDiff.diffRatio;
            if (roiDiff.diffRatio >= 0.005) {
              fs.writeFileSync(
                path.join(shotDir, `${scene.id}-${roiKey}-freeze-pass2.png`),
                s2!.pngBuffer,
              );
              fs.writeFileSync(
                path.join(shotDir, `${scene.id}-${roiKey}-freeze-diff.png`),
                roiDiff.diffPngBuffer,
              );
            }
            expect(
              roiDiff.diffRatio,
              `Freeze determinism failed for "${scene.id}" ${roiKey}: diffRatio=${(roiDiff.diffRatio * 100).toFixed(4)}% exceeds 0.5% threshold`,
            ).toBeLessThan(0.005);
          }
        } else if (pass1Strip && pass2.stripBuffer) {
          const stripDiff = comparePngBuffers(pass1Strip, pass2.stripBuffer);
          roiDiffRatios['strip'] = stripDiff.diffRatio;
          if (stripDiff.diffRatio >= 0.005) {
            fs.writeFileSync(
              path.join(shotDir, `${scene.id}-strip-freeze-pass2.png`),
              pass2.stripBuffer,
            );
            fs.writeFileSync(
              path.join(shotDir, `${scene.id}-strip-freeze-diff.png`),
              stripDiff.diffPngBuffer,
            );
          }
          expect(
            stripDiff.diffRatio,
            `Freeze determinism failed for "${scene.id}" strip: diffRatio=${(stripDiff.diffRatio * 100).toFixed(4)}% exceeds 0.5% threshold`,
          ).toBeLessThan(0.005);
        }

        freezeDiffs[scene.id] = {
          diffPixels: diff.diffPixels,
          totalPixels: diff.totalPixels,
          diffRatio: diff.diffRatio,
          ...(Object.keys(roiDiffRatios).length > 0 ? { roiDiffRatios } : {}),
          ...(traceHashMatched !== undefined ? { traceHashMatched } : {}),
        };

        if (diff.diffRatio >= 0.005) {
          fs.writeFileSync(
            path.join(shotDir, `${scene.id}-freeze-pass2.png`),
            pass2.litBuffer,
          );
          fs.writeFileSync(
            path.join(shotDir, `${scene.id}-freeze-diff.png`),
            diff.diffPngBuffer,
          );
        }

        expect(
          diff.diffRatio,
          `Freeze determinism failed for scene "${scene.id}": diffRatio=${(diff.diffRatio * 100).toFixed(4)}% (${diff.diffPixels}/${diff.totalPixels} pixels) exceeds 0.5% threshold`,
        ).toBeLessThan(0.005);
      }

      writeMetricsFile();
    }

      expect(consoleErrors, 'Expected 0 console errors during visual capture').toEqual([]);
      expect(consoleWarnings, 'Expected 0 console warnings during visual capture').toEqual([]);
    } finally {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
      if (viteProc.pid) {
        try {
          process.kill(-viteProc.pid, 'SIGKILL');
        } catch {
          // ignore
        }
      }
      try {
        viteProc.kill('SIGKILL');
      } catch {
        // ignore
      }
    }
  });
});
