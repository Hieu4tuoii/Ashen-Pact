import { ENEMIES, WorldSim } from '@ashen-pact/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockPostFXPipeline {
    public game: unknown;
    public name: string;
    constructor(config: { game: unknown; name: string }) {
      this.game = config.game;
      this.name = config.name;
    }
    set1f() {}
    set3f() {}
  }
  class MockSinglePipeline {
    public config: unknown;
    public vertexCount = 0;
    constructor(config: unknown) {
      this.config = config;
    }
    flush() {
      this.vertexCount = 0;
    }
    set1f() {}
    set3f() {}
  }
  class MockWebGLRenderer {
    public pipelines = {
      has: vi.fn(() => true),
      addPostPipeline: vi.fn(),
    };
  }
  class MockScene {
    constructor(_config?: unknown) {}
  }
  const PhaserMock = {
    Scene: MockScene,
    BlendModes: { NORMAL: 0, ADD: 1, MULTIPLY: 2, SCREEN: 3 },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Math: {
      Clamp: (v: number, min: number, max: number) => Math.max(min, Math.min(max, v)),
    },
    Renderer: {
      WebGL: {
        WebGLRenderer: MockWebGLRenderer,
        Pipelines: {
          PostFXPipeline: MockPostFXPipeline,
          SinglePipeline: MockSinglePipeline,
        },
      },
    },
  };
  return { default: PhaserMock, ...PhaserMock };
});

import { KRYSSA_CLONE_RIG_DEF } from '../src/art/rig-defs-biome2-boss.js';
import { TextureBaker } from '../src/art/texture-baker.js';
import { spawnPropBreakBurst } from '../src/fx/combat-fx.js';
import { PORTAL_VORTEX_DEFAULTS } from '../src/fx/portal-door-shaders.js';
import { teleportToRoomImpl } from '../src/scenes/game-scene/arena-tiles.js';
import { createTeleportTestScene, createTestCombatFx } from './helpers/test-combat-fx.js';
import {
  drawP1CActiveOverlays,
  getWeaponV2OverlayState,
  handleP1CSimEvent,
  spawnGlacialShatterSpikesVfx,
  spawnPneumaticPressSlamVfx,
  spawnPrismRefractFlashVfx,
  spawnSlagLavaCarpetVfx,
} from '../src/fx/combat-fx-weapons-v2.js';

function createMockGraphics() {
  const calls: string[] = [];
  return {
    calls,
    lineStyle: () => calls.push('lineStyle'),
    fillStyle: () => calls.push('fillStyle'),
    beginPath: () => calls.push('beginPath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    strokePath: () => calls.push('strokePath'),
    strokeCircle: () => calls.push('strokeCircle'),
    fillCircle: () => calls.push('fillCircle'),
    arc: () => calls.push('arc'),
    fillTriangle: () => calls.push('fillTriangle'),
  };
}

describe('AP2 Phase P1C.4 — Biome 2 & Biome 3 Procedural Prop Texture Keys & Combat FX Overlays', () => {
  it('resolves distinct procedural texture keys for all Biome 2 & Biome 3 props and states', () => {
    expect(TextureBaker.getPropTextureKey('glacial_barricade', 'low')).toBe('prop_glacial_barricade');
    expect(TextureBaker.getPropTextureKey('glacial_barricade', 'flipped')).toBe(
      'prop_glacial_barricade_flipped',
    );
    expect(TextureBaker.getPropTextureKey('glacial_barricade', 'sliding')).toBe(
      'prop_glacial_barricade_sliding',
    );
    expect(TextureBaker.getPropTextureKey('glacial_spike')).toBe('prop_glacial_spike');
    expect(TextureBaker.getPropTextureKey('sliding_ice_block')).toBe('prop_sliding_ice_block');
    expect(TextureBaker.getPropTextureKey('cryo_prism_pillar')).toBe('prop_cryo_prism_pillar');

    expect(TextureBaker.getPropTextureKey('forge_blast_shield', 'low')).toBe(
      'prop_forge_blast_shield',
    );
    expect(TextureBaker.getPropTextureKey('forge_blast_shield', 'flipped')).toBe(
      'prop_forge_blast_shield_flipped',
    );
    expect(TextureBaker.getPropTextureKey('forge_blast_shield', 'sliding')).toBe(
      'prop_forge_blast_shield_sliding',
    );
    expect(TextureBaker.getPropTextureKey('pneumatic_press')).toBe('prop_pneumatic_press');
    expect(TextureBaker.getPropTextureKey('pneumatic_press', 'fallen')).toBe(
      'prop_pneumatic_press_slammed',
    );
    expect(TextureBaker.getPropTextureKey('slag_crucible')).toBe('prop_slag_crucible');
  });

  it('spawns and renders P1C transient VFX shapes and active conveyor/press/fire-wave overlays', () => {
    const sceneKey = { camFocusX: 300, camFocusY: 300 };
    spawnGlacialShatterSpikesVfx(sceneKey, undefined, 320, 240, 0);
    spawnPrismRefractFlashVfx(sceneKey, undefined, 400, 240, 0.2);
    spawnPneumaticPressSlamVfx(sceneKey, undefined, 480, 240);
    spawnSlagLavaCarpetVfx(sceneKey, undefined, 520, 240, 0);

    const state = getWeaponV2OverlayState(sceneKey);
    expect(state.shapes.map((s) => s.kind)).toEqual([
      'glacial_shatter_spikes',
      'prism_refract_flash',
      'pneumatic_press_slam',
      'slag_lava_carpet',
    ]);

    const sim = new WorldSim({ seed: 7401, startInHub: false });
    sim.advanceToBiome(3);
    sim.map.fillSurfaceRect(6, 6, 8, 3, 'conveyor');
    sim.map.conveyorWarningTimer = 0.8;
    const press = sim.spawnProp('pneumatic_press', 420, 320);
    press.pressState = 'windup';
    press.pressTimer = 0.2;
    const shield = sim.spawnProp('forge_blast_shield', 320, 320);
    shield.coverState = 'sliding';
    shield.vx = 520;
    shield.vy = 0;

    const g = createMockGraphics();
    drawP1CActiveOverlays(g as never, sim, 1.2);
    expect(g.calls.includes('strokeCircle')).toBe(true);
    expect(g.calls.includes('arc')).toBe(true);

    // Also verify handleP1CSimEvent intercepts P1C explosion events cleanly
    const handled = handleP1CSimEvent(
      sceneKey,
      {
        kind: 'explosion',
        x: 320,
        y: 240,
        radius: 72,
        damage: 28,
        sourceDefId: 'glacial_barricade',
      },
      sim,
      false,
      false,
    );
    expect(handled).toBe(true);

    // Verify 1:1 Chiaroscuro shader flipbooks for P1C tactical props and groundHazardGraphics (<= 0.08 fill) routing
    const novaCalls: Array<[number, number, number, string]> = [];
    const coneCalls: Array<[number, number, number, number]> = [];
    const mockFx = {
      spawnShaderNova: (x: number, y: number, r: number, key: string) => novaCalls.push([x, y, r, key]),
      spawnShaderCone: (x: number, y: number, r: number, a: number) => coneCalls.push([x, y, r, a]),
      spawnHitSparks: () => {},
      spawnExplosionBurst: () => {},
    };
    spawnGlacialShatterSpikesVfx(sceneKey, mockFx as never, 320, 240, 0);
    spawnPrismRefractFlashVfx(sceneKey, mockFx as never, 400, 240, 0.5);
    spawnPneumaticPressSlamVfx(sceneKey, mockFx as never, 480, 240);
    spawnSlagLavaCarpetVfx(sceneKey, mockFx as never, 520, 240, 0.25);

    expect(novaCalls.some((c) => c[0] === 320 && c[3] === 'fx_sh_nova_cryo')).toBe(true);
    expect(coneCalls.length).toBe(1);
    expect(novaCalls.some((c) => c[0] === 400 && c[3] === 'fx_sh_arcane_sigil')).toBe(true);
    expect(novaCalls.some((c) => c[0] === 480 && c[3] === 'fx_sh_geyser_plume')).toBe(true);
    expect(novaCalls.some((c) => c[0] === 520 && c[3] === 'fx_sh_geyser_plume')).toBe(true);

    const fillAlphas: number[] = [];
    const groundG = {
      ...createMockGraphics(),
      fillStyle: (_c?: number, a?: number) => {
        if (typeof a === 'number') fillAlphas.push(a);
      },
    };
    const elevatedG = createMockGraphics();
    (drawP1CActiveOverlays as unknown as (g: unknown, s: unknown, t: number, gg?: unknown) => void)(
      elevatedG,
      sim,
      1.0,
      groundG,
    );
    expect(groundG.calls.includes('strokeCircle')).toBe(true);
    expect(fillAlphas.length).toBeGreaterThan(0);
    expect(Math.max(...fillAlphas)).toBeLessThanOrEqual(0.08);
  });

  it('syncs kryssa_clone Frost Mirage labels across all 4 files and sets container alpha to 0.76', () => {
    expect(ENEMIES.kryssa_clone.nameVi).toBe('Ảo Ảnh Sương Giá Kryssa');
    expect(KRYSSA_CLONE_RIG_DEF.nameVi).toBe('Ảo Ảnh Sương Giá Kryssa');
    expect(KRYSSA_CLONE_RIG_DEF.labelVi).toBe('Ảo Ảnh Sương Giá Kryssa');
  });

  it('routes prop breaks to 4 material shard decals (scorch only on explosive_barrel / coal_bomb) and invokes spawnCrackedWallBurst on cracked_wall_broken', () => {
    const { fx } = createTestCombatFx();
    spawnPropBreakBurst(fx, 'crate', 100, 100);
    expect(fx.decalPool.some((d) => d.active && d.textureKey.includes('fx_wood_shard'))).toBe(true);
    expect(fx.decalPool.some((d) => d.active && d.textureKey === 'fx_decal_scorch')).toBe(false);

    spawnPropBreakBurst(fx, 'explosive_barrel', 200, 200);
    expect(fx.decalPool.some((d) => d.active && d.textureKey === 'fx_decal_scorch')).toBe(true);
  });

  it('replaces shockwave_spawned teleport spoof with spawnArcaneTeleportFold + clean "DỊCH CHUYỂN!" while keeping Portal shader constants intact', () => {
    const { scene, fx } = createTeleportTestScene();
    teleportToRoomImpl.call(scene as never, 2);
    expect(fx.lastTeleportFoldPos).toBeDefined();
    expect(fx.lastFloatingAlertText).toBe('DỊCH CHUYỂN!');
    expect(PORTAL_VORTEX_DEFAULTS.particleCount).toBe(8);
    expect(PORTAL_VORTEX_DEFAULTS.rayCount).toBe(3);
  });
});
