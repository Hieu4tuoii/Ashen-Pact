import { describe, expect, it, vi } from 'vitest';
import { PALETTE } from '../src/art/palette.js';
import {
  computeShaderDirectionalScale,
  computeShaderNovaScale,
  SHADER_FX_FRAME_COUNT,
  SHADER_FX_TEXTURE_KEYS,
} from '../src/art/texture-baker-shader-fx.js';
import {
  activateParticle,
  CombatFxManager,
  type PooledParticle,
  refreshResolution,
  resolveParticleBlendAndDepth,
  resolveWeaponMuzzleProfile,
  update,
} from '../src/fx/combat-fx.js';

function createMockSprite() {
  const state = {
    textureKey: '',
    frame: 0 as number | string | undefined,
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    depth: 45,
    visible: false,
    active: false,
    blendMode: 'NORMAL' as string | number,
    tint: null as number | null,
  };
  return {
    state,
    get depth() {
      return state.depth;
    },
    get visible() {
      return state.visible;
    },
    get rotation() {
      return state.rotation;
    },
    set rotation(v: number) {
      state.rotation = v;
    },
    get scaleX() {
      return state.scaleX;
    },
    setTexture: vi.fn((key: string, frame?: number | string) => {
      state.textureKey = key;
      if (frame !== undefined) state.frame = frame;
    }),
    setFrame: vi.fn((frame: number | string) => {
      state.frame = frame;
    }),
    setPosition: vi.fn((x: number, y: number) => {
      state.x = x;
      state.y = y;
    }),
    setRotation: vi.fn((r: number) => {
      state.rotation = r;
    }),
    setScale: vi.fn((sx: number, sy?: number) => {
      state.scaleX = sx;
      state.scaleY = sy ?? sx;
    }),
    setAlpha: vi.fn((a: number) => {
      state.alpha = a;
    }),
    setDepth: vi.fn((d: number) => {
      state.depth = d;
    }),
    setVisible: vi.fn((v: boolean) => {
      state.visible = v;
    }),
    setActive: vi.fn((v: boolean) => {
      state.active = v;
    }),
    setBlendMode: vi.fn((m: string | number) => {
      state.blendMode = m;
    }),
    setTint: vi.fn((t: number) => {
      state.tint = t;
    }),
    clearTint: vi.fn(() => {
      state.tint = null;
    }),
  };
}

function createHeadlessFxManager(particleSlots = 32): CombatFxManager {
  const mgr = Object.create(CombatFxManager.prototype) as CombatFxManager;
  Object.assign(mgr, {
    particlePool: [] as PooledParticle[],
    damagePool: [],
    decalPool: [],
    afterimagePool: [],
    ambientPool: [],
    lightningPool: [],
    lightningGraphics: {
      clear: vi.fn(),
      lineStyle: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokePath: vi.fn(),
    },
    decalWriteCursor: 0,
    activeDecalCount: 0,
    hitStopRemainingMs: 0,
    bossKillSlowMoTimer: 0,
    bossKillFlashTimer: 0,
    trauma: 0,
    shakeTime: 0,
    popupSpreadIndex: 0,
    currentBiome: 1,
    allowFreezeAmbientMotion: false,
    torchPositions: [],
    totalHitStopsTriggered: 0,
    totalShakesTriggered: 0,
    totalSparksSpawned: 0,
    totalDamagePopupsSpawned: 0,
    totalDecalsSpawned: 0,
    totalAfterimagesSpawned: 0,
    activeReactionBanner: null,
    activeWorldReactionPopupSlot: null,
  });

  for (let i = 0; i < particleSlots; i++) {
    const sprite = createMockSprite();
    const shadowSprite = createMockSprite();
    mgr.particlePool.push({
      sprite: sprite as never,
      shadowSprite: shadowSprite as never,
      textureKey: 'fx_spark',
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      vr: 0,
      age: 0,
      ttl: 0.3,
      startScale: 1,
      endScale: 1,
      startAlpha: 1,
      gravityY: 0,
      damping: 0,
      blendMode: 'ADD',
      easeCurve: 'linear',
      scaleRatioY: 1,
      alignToVelocity: false,
      hasGroundShadow: false,
      frameCount: 1,
      preserveFlipbookAlpha: false,
    });
  }
  return mgr;
}

describe('1:1 Top-Down Chiaroscuro Flipbook Playback & Core Combat Spawners', () => {
  it('assigns BlendMode.NORMAL and 44 <= depth < 60 to all 14 fx_sh_* Chiaroscuro shader flipbooks', () => {
    for (const key of SHADER_FX_TEXTURE_KEYS) {
      const meta = resolveParticleBlendAndDepth(key);
      expect(meta.blendMode, `Expected ${key} to use NORMAL blend for Chiaroscuro dark veins`).toBe(
        'NORMAL',
      );
      expect(meta.depth, `Expected ${key} above lightmap (> 34)`).toBeGreaterThanOrEqual(44);
      expect(meta.depth, `Expected ${key} strictly below enemy bullets (< 60)`).toBeLessThan(60);
    }
  });

  it('advances 14-frame flipbook particles across frames 0..13 without muddy linear alpha-fog fade', () => {
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

    // Advance to 50% lifetime -> frame 7, alpha preserved crisp (no 50% muddy fog fade!)
    update.call(mgr, 0.14);
    expect(mockSpr.state.frame).toBe(7);
    expect(mockSpr.state.alpha).toBeCloseTo(0.96, 3);

    // Advance to ~93% lifetime -> frame 13, clean tail release
    update.call(mgr, 0.12);
    expect(mockSpr.state.frame).toBe(13);
    expect(mockSpr.state.alpha).toBeLessThan(0.96);

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
    expect(novaSlot.frameCount).toBe(14);
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
      mgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_shrapnel_corona'),
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
    mgr.spawnMeleeSlash(250, 220, 0, false, {
      weaponId: 'knight_sword',
      comboStep: 2,
      rangePx: 72,
    });
    expect(mgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_slash_steel')).toBe(
      true,
    );
    expect(mgr.particlePool.some((p) => p.active && p.textureKey === 'fx_sh_aegis_crest')).toBe(
      true,
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
      ['vaporize', 'fx_sh_vortex_gale'],
      ['shatter', 'fx_sh_nova_cryo'],
      ['superconduct', 'fx_sh_anvil_storm'],
      ['toxic_blast', 'fx_sh_spore_cloud'],
      ['paralysis', 'fx_sh_nova_thunder'],
      ['overload', 'fx_sh_shrapnel_corona'],
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
        mgr.particlePool.some((p) => p.active && p.textureKey === expectedKey),
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

  it('renders branched Chiaroscuro chain lightning with #141019 casing, fork offshoot, and 4-point target star', () => {
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

    const lg = mgr.lightningGraphics as unknown as {
      lineStyle: ReturnType<typeof vi.fn>;
      strokePath: ReturnType<typeof vi.fn>;
    };
    // 3 Chiaroscuro layers * (1 main jagged bolt + 1 mid-span fork + 2 star axes) = 12 strokes
    expect(lg.strokePath).toHaveBeenCalledTimes(12);
    const colorsUsed = lg.lineStyle.mock.calls.map((c: unknown[]) => c[1]);
    expect(colorsUsed).toContain(0x141019);
    expect(colorsUsed).toContain(0xfffdf5);
  });

  it('caps floor decal alpha at 0.42, deduplicates overlapping decals within 24px, and fades decals out over 6.0s', () => {
    const mgr = createHeadlessFxManager(4);
    const makeDecalSprite = (x: number, y: number, alpha = 0.82) => {
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

    const s1 = makeDecalSprite(300, 240, 0.82);
    const s2 = makeDecalSprite(310, 245, 0.82); // within 24px of s1 -> deduplicated
    const s3 = makeDecalSprite(420, 240, 0.82); // > 24px away -> kept active
    mgr.decalPool.push(
      { sprite: s1 as never, textureKey: 'fx_decal_scorch', active: true },
      { sprite: s2 as never, textureKey: 'fx_decal_scorch', active: true },
      { sprite: s3 as never, textureKey: 'fx_decal_scorch', active: true },
    );
    mgr.activeDecalCount = 3;

    update.call(mgr, 1 / 60);
    // s1 is replaced by newer overlapping s2 within 24px, and active decals are capped at alpha 0.42
    expect(mgr.decalPool[0]!.active).toBe(false);
    expect(mgr.decalPool[1]!.active).toBe(true);
    expect(s2.alpha).toBeCloseTo(0.42, 4);
    expect(mgr.decalPool[2]!.active).toBe(true);
    expect(s3.alpha).toBeCloseTo(0.42, 4);
    expect(mgr.activeDecalCount).toBe(2);

    // Advance 3.0s -> decals fade smoothly below 0.42
    update.call(mgr, 3.0);
    expect(s2.alpha).toBeLessThan(0.42);
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
});

