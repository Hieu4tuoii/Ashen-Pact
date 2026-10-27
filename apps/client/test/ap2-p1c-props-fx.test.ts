import { WorldSim } from '@ashen-pact/shared';
import { describe, expect, it } from 'vitest';
import { TextureBaker } from '../src/art/texture-baker.js';
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
  });
});
