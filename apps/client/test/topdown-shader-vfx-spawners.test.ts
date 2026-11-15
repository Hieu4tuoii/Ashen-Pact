import { describe, expect, it, vi } from 'vitest';
import { WorldSim } from '@ashen-pact/shared';

vi.mock('phaser', () => {
  class MockScene {}
  class MockPostFXPipeline {}
  const phaserStub = {
    Scene: MockScene,
    BlendModes: { NORMAL: 0, ADD: 1, MULTIPLY: 2, SCREEN: 3 },
    Math: { Clamp: (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)) },
    Renderer: { WebGL: { Pipelines: { PostFXPipeline: MockPostFXPipeline } } },
  };
  return { default: phaserStub, ...phaserStub };
});

import { PALETTE } from '../src/art/palette.js';
import {
  computeShaderDirectionalScale,
  computeShaderNovaScale,
  SHADER_FX_FRAME_COUNT,
  SHADER_FX_TEXTURE_KEYS,
} from '../src/art/texture-baker-shader-fx.js';
import {
  activateParticle,
  applyP1SafeHaloAlpha,
  CombatFxManager,
  type PooledParticle,
  refreshResolution,
  resolveAllyFxProfile,
  resolveParticleBlendAndDepth,
  resolveWeaponMuzzleProfile,
  routeCutoutBurstByRadius,
  routeCutoutDirectionalByReach,
  update,
} from '../src/fx/combat-fx.js';
import {
  createHeadlessFxManager,
  createMockSprite,
  createTestCombatFx,
} from './helpers/test-combat-fx.js';
import { renderTelegraphsAndShieldImpl } from '../src/scenes/game-scene/telegraphs-and-overlays.js';

describe('1:1 Top-Down Chiaroscuro Flipbook Playback & Core Combat Spawners', () => {
  it('assigns BlendMode.NORMAL and 42 <= depth <= 43.5 to all 24 fx_sh_* Chiaroscuro shader flipbooks', () => {
    for (const key of SHADER_FX_TEXTURE_KEYS) {
      const meta = resolveParticleBlendAndDepth(key);
      expect(meta.blendMode, `Expected ${key} to use NORMAL blend for Chiaroscuro dark veins`).toBe(
        'NORMAL',
      );
      expect(meta.depth, `Expected ${key} >= 42.0`).toBeGreaterThanOrEqual(42.0);
      expect(meta.depth, `Expected ${key} <= 43.5`).toBeLessThanOrEqual(43.5);
    }
  });

  it('advances 8-frame flipbook particles across frames 0..7 without muddy linear alpha-fog fade', () => {
    const mgr = createHeadlessFxManager(4);
    const slot = mgr.particlePool[0]!;
    const mockSpr = slot.sprite as unknown as ReturnType<typeof createMockSprite>;

    activateParticle(slot, {
      textureKey: 'fx_sh_nova_solar',
      x: 320,
      y: 240,
      ttl: 0.28,
      startScale: 1.5,
      endScale: 1.5,
      startAlpha: 0.96,
      frameCount: SHADER_FX_FRAME_COUNT,
      preserveFlipbookAlpha: true,
    });

    expect(mockSpr.state.textureKey).toBe('fx_sh_nova_solar');
    expect(mockSpr.state.frame).toBe(0);
    expect(mockSpr.state.blendMode).toBe('NORMAL');

    // Advance to 50% lifetime -> frame 4 (with 8 frames: floor(0.5 * 8) = 4)
    update.call(mgr, 0.14);
    expect(mockSpr.state.frame).toBe(4);
    expect(mockSpr.state.alpha).toBeCloseTo(0.96, 3);

    // Advance to ~87.5% lifetime -> frame 7
    update.call(mgr, 0.105);
    expect(mockSpr.state.frame).toBe(7);

    // Advance past 100% -> deactivated & hidden
    update.call(mgr, 0.05);
    expect(slot.active).toBe(false);
    expect(mockSpr.state.visible).toBe(false);
  });

  it('spawns 1:1 hitbox-matched Chiaroscuro novas, 360° slashes, and directional cones/lances with teammate opacity support', () => {
    const mgr = createHeadlessFxManager(16);

    mgr.spawnShaderNova(400, 260, 110, 'fx_sh_nova_void', { isTeammate: false, sparkCount: 0 });
    const novaSlot = mgr.particlePool[0]!;
    const expectedScale = computeShaderNovaScale(110, 'fx_sh_nova_void', 4);
    expect(novaSlot.active).toBe(true);
    expect(novaSlot.textureKey).toBe('fx_sh_nova_void');
    expect(novaSlot.frameCount).toBe(SHADER_FX_FRAME_COUNT);
    expect(novaSlot.startScale).toBeCloseTo(expectedScale, 4);
    expect(novaSlot.endScale).toBeCloseTo(expectedScale, 4);
    expect(Math.abs(novaSlot.scaleRatioY)).toBe(1);

    mgr.spawnShaderSlash(250, 200, 78, -Math.PI / 3, 'fx_sh_slash_emerald', {
      flipY: true,
      isTeammate: true,
    });
    const slashSlot = mgr.particlePool[1]!;
    const slashSpr = slashSlot.sprite as unknown as ReturnType<typeof createMockSprite>;
    expect(slashSlot.active).toBe(true);
    expect(slashSlot.textureKey).toBe('fx_sh_slash_emerald');
    expect(slashSlot.scaleRatioY).toBe(-1);
    expect(slashSpr.state.rotation).toBeCloseTo(-Math.PI / 3, 4);
    expect(slashSlot.startAlpha).toBeLessThan(1.0);

    mgr.spawnShaderLance(300, 240, 520, Math.PI / 4, { widthPx: 40 });
    const lanceSlot = mgr.particlePool[2]!;
    const lanceSpr = lanceSlot.sprite as unknown as ReturnType<typeof createMockSprite>;
    expect(lanceSlot.active).toBe(true);
    expect(lanceSlot.textureKey).toBe('fx_sh_beam_lance');
    expect(lanceSpr.state.rotation).toBeCloseTo(Math.PI / 4, 4);
    // Transverse scaleY is clamped tightly so a 520px railgun stays sleek instead of ballooning 520px wide
    expect(Math.abs(lanceSlot.scaleRatioY)).toBeLessThan(0.35);
  });

  it('upgrades core explosions, melee slashes, muzzle flashes, hit sparks, and elemental reactions to spawn fx_sh_* flipbooks', () => {
    const mgr = createHeadlessFxManager(64);

    mgr.spawnExplosionBurst(300, 220, 96, PALETTE.CYAN_FROST);
    expect(mgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_nova_cryo')).toBe(true);
    // Default uncolored explosions resolve to fiery magma nova rather than purple void vortex
    mgr.spawnExplosionBurst(340, 220, 64);
    expect(mgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_nova_magma')).toBe(
      true,
    );
    expect(mgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_nova_void')).toBe(
      false,
    );
    // Zero muddy fx_dust_puff smoke blobs inside explosions
    expect(mgr.particlePool.some((p) => p.active && p.textureKey === 'fx_dust_puff')).toBe(false);

    mgr.spawnMeleeSlash(200, 200, 0.5);
    expect(mgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_slash_steel')).toBe(
      true,
    );

    mgr.spawnMuzzleFlashAndCasing(180, 180, 0);
    expect(mgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_muzzle_burst')).toBe(
      true,
    );

    mgr.spawnHitSparks(220, 180, 0, { isCrit: true, element: 'shock' });
    expect(mgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_hit_spark')).toBe(true);

    mgr.spawnElementalReactionFx({
      reaction: 'overload',
      x: 360,
      y: 260,
      damage: 45,
      isTeamCombo: true,
    });
    expect(
      mgr.particlePool.some((p) => p.active && p.textureKey === 'fx_react_overload_star'),
    ).toBe(true);
  });

  it('spawns directional +X archetypes (fx_sh_aegis_crest, fx_sh_falcon_sonic) at exact 1:1 reach and angle, plus combo-finisher melee flourishes', () => {
    const mgr = createHeadlessFxManager(24);

    mgr.spawnShaderDirectional(300, 200, 84, Math.PI / 6, 'fx_sh_aegis_crest', {
      forwardOffsetRatio: 0.25,
    });
    const crestSlot = mgr.particlePool[0]!;
    const crestSpr = crestSlot.sprite as unknown as ReturnType<typeof createMockSprite>;
    expect(crestSlot.active).toBe(true);
    expect(crestSlot.textureKey).toBe('fx_sh_aegis_crest');
    expect(crestSlot.startScale).toBeCloseTo(
      computeShaderDirectionalScale(84, 'fx_sh_aegis_crest', 4),
      4,
    );
    expect(crestSpr.state.rotation).toBeCloseTo(Math.PI / 6, 4);

    mgr.spawnShaderDirectional(220, 180, 92, -Math.PI / 4, 'fx_sh_falcon_sonic');
    expect(mgr.particlePool[1]!.textureKey).toBe('fx_sh_falcon_sonic');

    // 3rd-hit combo finishers (comboStep === 2) add weapon-signature finisher flourishes
    const swordMgr = createHeadlessFxManager(16);
    swordMgr.spawnMeleeSlash(250, 220, 0, false, {
      weaponId: 'knight_sword',
      comboStep: 2,
      rangePx: 72,
    });
    const steelSlashes = swordMgr.particlePool.filter(
      (p) => p.active && p.textureKey === 'fx_sh_slash_steel',
    );
    expect(steelSlashes.length).toBeGreaterThanOrEqual(2);
    expect(swordMgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_aegis_crest')).toBe(
      false,
    );

    const cleaverMgr = createHeadlessFxManager(16);
    cleaverMgr.spawnMeleeSlash(250, 220, 0.3, false, {
      weaponId: 'emerald_cleaver',
      comboStep: 2,
      rangePx: 70,
    });
    const emeraldSlashes = cleaverMgr.particlePool.filter(
      (p) => p.active && p.textureKey === 'fx_sh_slash_emerald',
    );
    // Twin X-cross fangs on 3rd combo finisher
    expect(emeraldSlashes.length).toBeGreaterThanOrEqual(2);
  });

  it('assigns weapon-family muzzle profiles so ballistic guns eject brass casings while staves, crossbows, bio-guns, wind SMGs, and lasers use arcane/elemental muzzles with ZERO brass casings', () => {
    expect(resolveWeaponMuzzleProfile('rivet_gun').ejectCasing).toBe(true);
    expect(resolveWeaponMuzzleProfile('scrap_shotgun', true).ejectCasing).toBe(true);
    expect(resolveWeaponMuzzleProfile('frag_launcher').ejectCasing).toBe(true);

    for (const nonBallisticId of [
      'apprentice_staff',
      'thorn_staff',
      'solar_archon_staff',
      'tether_staff',
      'void_staff',
      'seed_gun',
      'hunter_crossbow',
      'gale_smg',
      'tesla_carbine',
      'focus_laser',
      'magma_cannon',
    ]) {
      const prof = resolveWeaponMuzzleProfile(nonBallisticId);
      expect(prof.ejectCasing, `${nonBallisticId} must NEVER eject brass shell casings`).toBe(
        false,
      );
    }

    const gunMgr = createHeadlessFxManager(16);
    gunMgr.spawnMuzzleFlashAndCasing(200, 200, 0, false, false, 'rivet_gun');
    expect(gunMgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_muzzle_burst')).toBe(
      true,
    );
    expect(gunMgr.particlePool.some((p) => p.active && p.textureKey === 'fx_shell_casing')).toBe(
      true,
    );

    const staffMgr = createHeadlessFxManager(16);
    staffMgr.spawnMuzzleFlashAndCasing(200, 200, 0, false, false, 'solar_archon_staff');
    expect(
      staffMgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_muzzle_arcane'),
    ).toBe(true);
    expect(staffMgr.particlePool.some((p) => p.active && p.textureKey === 'fx_shell_casing')).toBe(
      false,
    );

    const bowMgr = createHeadlessFxManager(16);
    bowMgr.spawnMuzzleFlashAndCasing(200, 200, 0, false, false, 'hunter_crossbow');
    expect(
      bowMgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_muzzle_arcane'),
    ).toBe(true);
    expect(bowMgr.particlePool.some((p) => p.active && p.textureKey === 'fx_shell_casing')).toBe(
      false,
    );
  });

  it('gives all 6 ElementalReactionIds 6 distinct Chiaroscuro shader silhouettes instead of colliding on 2 rings', () => {
    const expectedReactionKeys = [
      ['vaporize', 'fx_react_vapor_puff'],
      ['shatter', 'fx_react_shatter_pane'],
      ['superconduct', 'fx_react_superconduct_cross'],
      ['toxic_blast', 'fx_react_toxic_glob'],
      ['paralysis', 'fx_react_paralysis_x'],
      ['overload', 'fx_react_overload_star'],
    ] as const;

    const distinctKeys = new Set<string>();
    for (const [reaction, expectedKey] of expectedReactionKeys) {
      const mgr = createHeadlessFxManager(32);
      mgr.spawnElementalReactionFx({
        reaction,
        x: 320,
        y: 240,
        damage: 50,
        isTeamCombo: false,
      });
      expect(
        mgr.particlePool.some((p) => p.active && p.textureKey === expectedKey && p.frameCount === 4),
        `Expected ${reaction} to spawn bespoke morphology ${expectedKey}`,
      ).toBe(true);
      distinctKeys.add(expectedKey);
    }
    expect(distinctKeys.size).toBe(6);
  });

  it('preserves 1:1 fixed-resolution shader flipbook scales across refreshResolution zoom changes while rescaling DPR-dependent particles', () => {
    const mgr = createHeadlessFxManager(4);

    // Slot 0: fixed-resolution 14-frame shader flipbook
    const novaScale = computeShaderNovaScale(110, 'fx_sh_nova_solar', 4);
    activateParticle(mgr.particlePool[0]!, {
      textureKey: 'fx_sh_nova_solar',
      x: 320,
      y: 240,
      ttl: 0.3,
      startScale: novaScale,
      endScale: novaScale,
      startAlpha: 0.96,
      frameCount: SHADER_FX_FRAME_COUNT,
      preserveFlipbookAlpha: true,
    });

    // Slot 1: DPR-scaled single-frame particle
    activateParticle(mgr.particlePool[1]!, {
      textureKey: 'fx_spark',
      x: 200,
      y: 200,
      ttl: 0.3,
      startScale: 0.25,
      endScale: 0.1,
      startAlpha: 1,
      frameCount: 1,
    });

    refreshResolution.call(mgr, 6, 4);

    // 14-frame flipbook keeps exact 1:1 world scale (288px strip is independent of bakeScale)
    expect(mgr.particlePool[0]!.startScale).toBeCloseTo(novaScale, 5);
    expect(mgr.particlePool[0]!.endScale).toBeCloseTo(novaScale, 5);

    // Single-frame DPR-baked particle rescales by prevScale / bakeScale (4 / 6)
    expect(mgr.particlePool[1]!.startScale).toBeCloseTo(0.25 * (4 / 6), 5);
    expect(mgr.particlePool[1]!.endScale).toBeCloseTo(0.1 * (4 / 6), 5);
  });

  it('diversifies consecutive radial novas with distinct 360° rotations and ±1 chirality flips to eliminate FBM pattern repetition', () => {
    const mgr = createHeadlessFxManager(12);
    const rotations = new Set<string>();
    const chiralities = new Set<number>();

    for (let i = 0; i < 6; i++) {
      mgr.spawnShaderNova(260 + i * 28, 220, 64, 'fx_sh_nova_magma', { sparkCount: 0 });
      const slot = mgr.particlePool[i]!;
      const spr = slot.sprite as unknown as ReturnType<typeof createMockSprite>;
      rotations.add(spr.state.rotation.toFixed(3));
      chiralities.add(slot.scaleRatioY);
    }

    // All 6 sequential geyser/cluster novas get unique orientations and both mirror chiralities
    expect(rotations.size).toBe(6);
    expect(chiralities.has(1)).toBe(true);
    expect(chiralities.has(-1)).toBe(true);

    // Explicit rotation override is still honored verbatim
    mgr.spawnShaderNova(400, 300, 80, 'fx_sh_nova_solar', { rotation: 1.25, sparkCount: 0 });
    const explicitSpr = mgr.particlePool[6]!.sprite as unknown as ReturnType<typeof createMockSprite>;
    expect(explicitSpr.state.rotation).toBeCloseTo(1.25, 5);
  });

  it('renders branched chain lightning via fillTaperedLightningBolt on weaponRibbonGraphics', () => {
    const mgr = createHeadlessFxManager(4);
    mgr.lightningPool.push({
      active: true,
      fromX: 200,
      fromY: 200,
      toX: 340,
      toY: 260,
      age: 0,
      ttl: 0.16,
      seed: 2.4,
    });

    update.call(mgr, 1 / 60);

    const wrg = mgr.weaponRibbonGraphics as unknown as {
      fillTriangle: ReturnType<typeof vi.fn>;
    };
    expect(wrg.fillTriangle).toHaveBeenCalled();
  });

  it('caps floor decal alpha at 0.32, deduplicates overlapping decals within 24px, and fades decals out over 6.0s', () => {
    const mgr = createHeadlessFxManager(4);
    const makeDecalSprite = (x: number, y: number, alpha = 0.32) => {
      const spr = {
        x,
        y,
        alpha,
        visible: true,
        setAlpha: vi.fn((a: number) => {
          spr.alpha = a;
        }),
        setVisible: vi.fn((v: boolean) => {
          spr.visible = v;
        }),
      };
      return spr;
    };

    const s1 = makeDecalSprite(300, 240, 0.32);
    const s2 = makeDecalSprite(310, 245, 0.32); // within 24px of s1 -> deduplicated
    const s3 = makeDecalSprite(420, 240, 0.32); // > 24px away -> kept active
    mgr.decalPool.push(
      { sprite: s1 as never, textureKey: 'fx_decal_scorch', active: true },
      { sprite: s2 as never, textureKey: 'fx_decal_scorch', active: true },
      { sprite: s3 as never, textureKey: 'fx_decal_scorch', active: true },
    );
    mgr.activeDecalCount = 3;

    update.call(mgr, 1 / 60);
    // s1 is replaced by newer overlapping s2 within 24px, and active decals are capped at alpha 0.32
    expect(mgr.decalPool[0]!.active).toBe(false);
    expect(mgr.decalPool[1]!.active).toBe(true);
    expect(s2.alpha).toBeCloseTo(0.32, 4);
    expect(mgr.decalPool[2]!.active).toBe(true);
    expect(s3.alpha).toBeCloseTo(0.32, 4);
    expect(mgr.activeDecalCount).toBe(2);

    // Advance 3.0s -> decals fade smoothly below 0.32
    update.call(mgr, 3.0);
    expect(s2.alpha).toBeLessThan(0.32);
    expect(s2.alpha).toBeGreaterThan(0);

    // Advance past 6.0s total -> decals deactivate and hide
    update.call(mgr, 3.5);
    expect(mgr.decalPool[1]!.active).toBe(false);
    expect(s2.visible).toBe(false);
  });

  it('glides melee slash flipbook smoothly from pre-lunge to post-lunge position when lungeDx/lungeDy are provided', () => {
    const mgr = createHeadlessFxManager(8);
    mgr.spawnMeleeSlash(324, 260, 0, false, {
      weaponId: 'knight_sword',
      comboStep: 0,
      rangePx: 68,
      lungeDx: 24,
      lungeDy: 0,
    });
    const slashSlot = mgr.particlePool.find(
      (p) => p.active && p.textureKey === 'fx_sh_slash_steel',
    )!;
    expect(slashSlot).toBeDefined();
    // Starts at pre-lunge x = 324 - 24 = 300 with forward damped glide velocity
    expect(slashSlot.x).toBeCloseTo(300, 2);
    expect(slashSlot.vx).toBeGreaterThan(300);
    expect(slashSlot.damping).toBeGreaterThanOrEqual(15);

    // Step 4 frames -> slash glides smoothly toward 324
    for (let i = 0; i < 4; i++) {
      update.call(mgr, 1 / 60);
    }
    expect(slashSlot.x).toBeGreaterThan(310);
    expect(slashSlot.x).toBeLessThan(324);
  });

  it('preserves 1:1 low-level spawnShader* scales while routing out-of-band radii via routeCutoutBurstByRadius and dropping P1 self-bursts to depth 26.4', () => {
    const { fx } = createTestCombatFx({ localPlayerPos: { x: 200, y: 200 } });
    // Direct primitive stays 1:1
    const slot = fx.spawnShaderNova(400, 400, 104, 'fx_sh_shrapnel_corona');
    expect(slot?.startScale).toBeCloseTo(104 / (0.41 * 128), 4);
    expect(slot?.endScale).toBeCloseTo(slot!.startScale, 4);

    // Router clamps > rMax (64px) core at rMax and drops P1 self-centered burst (dist <= 24) to depth 26.4
    routeCutoutBurstByRadius(fx, 210, 200, 104, 'fx_sh_shrapnel_corona');
    const clampedCore = fx.particlePool.find((p) => p.active && p.textureKey === 'fx_sh_shrapnel_corona' && p !== slot);
    expect(clampedCore?.startScale).toBeCloseTo(64 / (0.41 * 128), 4);
    expect(clampedCore?.sprite.depth).toBeCloseTo(26.4, 2);
    expect(fx.activePerimeterRings.length).toBe(1);
    expect(fx.activePerimeterRings[0]?.targetRadiusPx).toBe(104);
  });

  it('routes directional slashes/cones via routeCutoutDirectionalByReach with arc ribbons', () => {
    const { fx } = createTestCombatFx();
    // In-band: [48, 70]
    routeCutoutDirectionalByReach(fx, 100, 100, 60, 0, 'fx_sh_cone_blast', Math.PI / 4);
    const inBand = fx.particlePool.find((p) => p.active && p.textureKey === 'fx_sh_cone_blast');
    expect(inBand).toBeDefined();

    // Out-of-band > rMax (70px): clamps core to 70 and adds to activeArcRibbons
    routeCutoutDirectionalByReach(fx, 100, 100, 90, 0, 'fx_sh_cone_blast', Math.PI / 4);
    expect(fx.activeArcRibbons.length).toBe(1);
    expect(fx.activeArcRibbons[0]?.reachPx).toBe(90);
  });

  it('plays 4+4 sub-range variants for muzzle flipbooks with independent flipY and ttl = 0.067', () => {
    const { fx } = createTestCombatFx();
    fx.spawnMuzzleFlashAndCasing(100, 100, 0, false, false, 'rivet_gun');
    const p1 = fx.particlePool.find((p) => p.active && p.textureKey === 'fx_sh_muzzle_burst');
    expect(p1?.frameCount).toBe(4);
    expect(p1?.ttl).toBeCloseTo(0.067, 3);
    expect(p1?.baseFrame).toBe(0);

    fx.spawnMuzzleFlashAndCasing(100, 100, 0, false, false, 'rivet_gun');
    const p2 = fx.particlePool.filter((p) => p.active && p.textureKey === 'fx_sh_muzzle_burst')[1];
    expect(p2?.baseFrame).toBe(4);
    expect(p2?.scaleRatioY).not.toBe(p1?.scaleRatioY);
  });

  it('resolves ally FX profile and applies P1 safe-halo alpha scaling', () => {
    const localProfile = resolveAllyFxProfile(1, 1, 0.7);
    expect(localProfile.isTeammate).toBe(false);
    expect(localProfile.bulletAlpha).toBe(1.0);
    expect(localProfile.aoeAlpha).toBe(1.0);
    expect(localProfile.turretRingAlpha).toBe(1.0);
    expect(localProfile.allowLightAndShake).toBe(true);

    const allyProfile = resolveAllyFxProfile(2, 1, 0.7);
    expect(allyProfile.isTeammate).toBe(true);
    expect(allyProfile.bulletAlpha).toBeCloseTo(0.42 * 0.7, 4);
    expect(allyProfile.aoeAlpha).toBeCloseTo(0.35 * 0.7, 4);
    expect(allyProfile.turretRingAlpha).toBe(0);
    expect(allyProfile.allowLightAndShake).toBe(false);

    // Safe halo: within 18 + 0.35 * R
    const r = 50;
    expect(applyP1SafeHaloAlpha(1.0, true, 20, r)).toBeCloseTo(0.15, 4);
    expect(applyP1SafeHaloAlpha(1.0, true, 40, r)).toBeCloseTo(1.0, 4);
    expect(applyP1SafeHaloAlpha(1.0, false, 20, r)).toBeCloseTo(1.0, 4);
  });

  it('enforces 75ms per-target ICD on hit sparks: keeps fx_sh_hit_spark count at 1 on rapid double-hit and spawns fx_rim_glint fallback on second hit', () => {
    const { fx } = createTestCombatFx();
    // 1st hit on targetId 42
    fx.spawnHitSparks(100, 100, 0, {
      targetId: 42,
      targetX: 90,
      targetY: 100,
      targetRadius: 16,
      nowMs: 1000,
    });
    const firstHitSparkCount = fx.particlePool.filter(
      (p) => p.active && p.textureKey === 'fx_sh_hit_spark',
    ).length;
    expect(firstHitSparkCount).toBe(1);

    // 2nd hit on same targetId within 75ms (nowMs = 1040, diff = 40ms < 75ms)
    fx.spawnHitSparks(100, 100, 0, {
      targetId: 42,
      targetX: 90,
      targetY: 100,
      targetRadius: 16,
      nowMs: 1040,
    });
    // fx_sh_hit_spark count MUST remain 1 (no duplicate shader spark)
    const secondHitSparkCount = fx.particlePool.filter(
      (p) => p.active && p.textureKey === 'fx_sh_hit_spark',
    ).length;
    expect(secondHitSparkCount).toBe(1);

    // Instead, a 2-tick fx_rim_glint from fx_cutout_kit_512 was spawned!
    const glint = fx.particlePool.find(
      (p) => p.active && p.textureKey === 'fx_cutout_kit_512' && p.frameName === 'fx_rim_glint',
    );
    expect(glint).toBeDefined();
    expect(glint?.ttl).toBeCloseTo(0.034, 3);
    expect(glint?.startScale).toBeCloseTo(1 / 3, 4);
    expect(glint?.depth).toBe(43.0);
    expect(glint?.startAlpha).toBe(0.9);

    // 3rd hit from teammate -> always spawns fx_rim_glint with alpha 0.35
    fx.spawnHitSparks(150, 150, 0, {
      isTeammate: true,
      targetId: 99,
      nowMs: 2000,
    });
    const teammateGlint = fx.particlePool.find(
      (p) =>
        p.active &&
        p.textureKey === 'fx_cutout_kit_512' &&
        p.frameName === 'fx_rim_glint' &&
        p !== glint,
    );
    expect(teammateGlint).toBeDefined();
    expect(teammateGlint?.startAlpha).toBe(0.35);
  });

  it('implements Spec Section 4.3 R < rMin neutral 4f kit burst & reachPx < rMin small directional fallback with suppressPerimeterRing option', () => {
    const { fx } = createTestCombatFx();

    // R = 10px (< 14.6px -> fx_micro_burst_4f, baseTexelR = 11.04)
    routeCutoutBurstByRadius(fx, 300, 300, 10, 'fx_sh_nova_solar');
    const microBurst = fx.particlePool.find(
      (p) =>
        p.active &&
        p.textureKey === 'fx_cutout_kit_512' &&
        p.frameName === 'fx_micro_burst_4f_0',
    );
    expect(microBurst).toBeDefined();
    expect(microBurst?.startScale).toBeCloseTo(10 / 11.04, 4);
    expect(microBurst?.frameCount).toBe(4);
    expect(fx.activePerimeterRings.length).toBe(1);

    // suppressPerimeterRing = true suppresses ring push
    routeCutoutBurstByRadius(fx, 300, 300, 10, 'fx_sh_nova_solar', {
      suppressPerimeterRing: true,
    });
    expect(fx.activePerimeterRings.length).toBe(1);

    // reachPx = 20px (< 24.5px -> fallback fx_sh_hit_spark)
    routeCutoutDirectionalByReach(fx, 300, 300, 20, 0, 'fx_sh_cone_blast', Math.PI / 4);
    const hitSparkFallback = fx.particlePool.find(
      (p) => p.active && p.textureKey === 'fx_sh_hit_spark',
    );
    expect(hitSparkFallback).toBeDefined();
    expect(fx.activeArcRibbons.length).toBe(1);

    // suppressPerimeterRing = true suppresses arc ribbon push
    routeCutoutDirectionalByReach(fx, 300, 300, 20, 0, 'fx_sh_cone_blast', Math.PI / 4, {
      suppressPerimeterRing: true,
    });
    expect(fx.activeArcRibbons.length).toBe(1);
  });

  it('correctly passes inkPadPx to fillTaperedArcRibbon and advances R < rMin kit burst sub-frames as strings', () => {
    const { fx } = createTestCombatFx();

    // 1. Assert stepping fx.update(0.025) with an active perimeter ring draws fillTriangle vertices within <= targetRadiusPx + 10
    const ring = {
      active: true,
      x: 200,
      y: 200,
      targetRadiusPx: 25,
      currentRadiusPx: 10,
      colorNum: 0xff8800,
      alpha: 1.0,
      age: 0,
      ttl: 0.05,
    };
    fx.activePerimeterRings.push(ring);
    fx.update(0.025);

    const fillTriMock = fx.underActorGraphics.fillTriangle as unknown as ReturnType<typeof vi.fn>;
    expect(fillTriMock.mock.calls.length).toBeGreaterThan(0);
    let maxDist = 0;
    for (const call of fillTriMock.mock.calls) {
      const [x0, y0, x1, y1, x2, y2] = call as [number, number, number, number, number, number];
      maxDist = Math.max(
        maxDist,
        Math.hypot(x0 - ring.x, y0 - ring.y),
        Math.hypot(x1 - ring.x, y1 - ring.y),
        Math.hypot(x2 - ring.x, y2 - ring.y),
      );
    }
    expect(maxDist).toBeLessThanOrEqual(ring.targetRadiusPx + 10);

    // 2. Assert spawning an R < rMin burst and stepping fx.update(0.05) advances sprite frame to 'fx_micro_burst_4f_1' or 'fx_micro_burst_4f_2' (string sub-frame)
    const { fx: fx2 } = createTestCombatFx();
    const burstSlot = routeCutoutBurstByRadius(fx2, 300, 300, 12, 'fx_sh_nova_magma');
    expect(burstSlot).toBeDefined();
    expect(burstSlot?.textureKey).toBe('fx_cutout_kit_512');
    expect(burstSlot?.kitFramePrefix).toBe('fx_micro_burst_4f');

    fx2.update(0.05);
    const mockSpr = burstSlot!.sprite as unknown as ReturnType<typeof createMockSprite>;
    expect(typeof mockSpr.state.frame).toBe('string');
    expect(['fx_micro_burst_4f_1', 'fx_micro_burst_4f_2']).toContain(mockSpr.state.frame);
    expect(mockSpr.state.frame).not.toBe(1);
    expect(mockSpr.state.frame).not.toBe(2);
  });

  it('unifies aiming enemy sniper sightlines onto telegraphGraphics at depth 46.0 and caps at top 8 most dangerous', () => {
    const drawnLines: Array<{ width: number; color: number; alpha: number }> = [];
    const mockTelegraphGraphics = {
      depth: 46.0,
      lineStyle: vi.fn((width: number, color: number, alpha: number) => {
        drawnLines.push({ width, color, alpha });
      }),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      clear: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      fillPath: vi.fn(),
      closePath: vi.fn(),
    };
    const mockFloorG = {
      lineStyle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
      fillStyle: vi.fn(),
      fillCircle: vi.fn(),
      strokeCircle: vi.fn(),
      clear: vi.fn(),
    };

    // 10 aiming enemies with different stateTimers
    const mockEnemies = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      hp: 100,
      maxHp: 100,
      x: 100 + i * 20,
      y: 100,
      radius: 16,
      defId: 'goblin_shooter',
      aiState: 'telegraph',
      telegraphAngle: 0,
      telegraphLength: 200,
      telegraphDurationSec: 1.0,
      stateTimer: 0.1 * (i + 1),
    }));

    const sim = new WorldSim();
    sim.enemies = mockEnemies as never;
    sim.player.x = 100;
    sim.player.y = 100;

    const mockScene = {
      telegraphGraphics: mockTelegraphGraphics,
      groundHazardGraphics: mockFloorG,
      enemyGroundTelegraphGfx: mockFloorG,
      transport: {
        getSim: () => sim,
        getInterpolatedEnemyPos: (e: { x: number; y: number }) => ({ x: e.x, y: e.y }),
      },
      entityPosAlpha: 1,
      fx: { bossKillFlashTimer: 0 },
      cameras: { main: { worldView: { x: 0, y: 0, width: 1000, height: 1000 } } },
      drawEnemyHealthAndStatusBar: vi.fn(),
      camFocusX: 100,
      camFocusY: 100,
    };

    renderTelegraphsAndShieldImpl.call(mockScene as never, 100, 100);

    // Verify exactly 8 enemies rendered (each gets border 5.2 and core 2.0 -> 8 border calls and 8 core calls)
    const borderCalls = drawnLines.filter((l) => l.width === 5.2 && l.color === 0x141019);
    const coreCalls = drawnLines.filter((l) => l.width === 2.0 && l.color === 0xe84545);
    expect(borderCalls.length).toBe(8);
    expect(coreCalls.length).toBe(8);
    expect(mockTelegraphGraphics.depth).toBe(46.0);
  });
});

