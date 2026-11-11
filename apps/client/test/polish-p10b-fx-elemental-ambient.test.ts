import {
  ELEMENTAL_REACTIONS,
  type ElementalReactionId,
  type ElementType,
  type EnemyBulletShape,
  i18n,
  type SimEvent,
  WorldSim,
} from '@ashen-pact/shared';
import { describe, expect, it, vi } from 'vitest';

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
  BAKED_FX_TEXTURE_KEYS,
  ENEMY_BULLET_VISUAL_SPEC,
} from '../src/art/texture-baker-fx.js';
import { SFX_PRESETS } from '../src/audio/zzfx.js';
import {
  coalesceElementalReaction,
  CombatFxManager,
  computeBossKillFlashAlpha,
  computeChestOpenBounce,
  computeEnemySpawnCircleSpec,
  computeFxParticleScale,
  computeIrisHoleRadius,
  computeShellCasingShadowOffset,
  computeTorchMotePosition,
  computeWorldItemArcPose,
  resolveAmbientBudgetCount,
  resolveBiomeAmbientSpec,
  resolveElementalReactionBurstSpec,
  resolveParticleBlendAndDepth,
  resolveProjectileRenderSpec,
} from '../src/fx/combat-fx.js';
import { syncProjectilesAndPickupsImpl } from '../src/scenes/game-scene/entity-sync.js';
import { processSimEventsImpl } from '../src/scenes/game-scene/sim-events.js';

describe('Phase P10b — Combat FX (BlendMode.ADD), Elemental Combo FX & Clear Biome Ambient', () => {
  describe('1. Enemy Bullet Visual Spec & Salience Invariants (depth = 60, untinted concentric bullseye)', () => {
    it('defines ENEMY_BULLET_VISUAL_SPEC with #E84545 body, #FFFDF5 core, 1.5u #141019 outline, and depth 60', () => {
      expect(ENEMY_BULLET_VISUAL_SPEC.fill).toBe(PALETTE.CRIMSON_BRIGHT);
      expect(ENEMY_BULLET_VISUAL_SPEC.core).toBe(PALETTE.BONE_WHITE);
      expect(ENEMY_BULLET_VISUAL_SPEC.outlineColor).toBe(PALETTE.INK_DARK);
      expect(ENEMY_BULLET_VISUAL_SPEC.outlineWidth).toBe(1.5);
      expect(ENEMY_BULLET_VISUAL_SPEC.depth).toBe(60);
      expect(ENEMY_BULLET_VISUAL_SPEC.neverTintByElement).toBe(true);
      expect(ENEMY_BULLET_VISUAL_SPEC.coreRadius).toBeGreaterThanOrEqual(2.4);
    });

    it('preserves tint = 0xffffff, blendMode = NORMAL, depth = 60, and alpha = 1.0 for enemy bullets across all elements and biomes', () => {
      const elements: readonly ElementType[] = ['none', 'burn', 'chill', 'shock', 'poison'];
      const biomes: readonly (1 | 2 | 3)[] = [1, 2, 3];

      for (const biome of biomes) {
        for (const element of elements) {
          const normalEnemySpec = resolveProjectileRenderSpec({
            team: 'enemy',
            element,
            biome,
            isStress: false,
          });
          expect(normalEnemySpec.textureKey).toBe('proj_enemy_orb');
          expect(normalEnemySpec.tint).toBe(0xffffff);
          expect(normalEnemySpec.blendMode).toBe('NORMAL');
          expect(normalEnemySpec.depth).toBe(60);
          expect(normalEnemySpec.alpha).toBe(1.0);

          const stressEnemySpec = resolveProjectileRenderSpec({
            team: 'enemy',
            element,
            biome,
            isStress: true,
          });
          expect(stressEnemySpec.textureKey).toBe('proj_stress_enemy');
          expect(stressEnemySpec.tint).toBe(0xffffff);
          expect(stressEnemySpec.blendMode).toBe('NORMAL');
          expect(stressEnemySpec.depth).toBe(60);
          expect(stressEnemySpec.alpha).toBe(1.0);
        }
      }
    });

    it('maps all 6 EnemyBulletShape values to vivid multi-shape textures and clamps radius scale while defaulting to proj_enemy_orb', () => {
      const shapeMappings: readonly [EnemyBulletShape | undefined, string][] = [
        [undefined, 'proj_enemy_orb'],
        ['orb', 'proj_enemy_orb'],
        ['wave', 'proj_enemy_wave'],
        ['lance', 'proj_enemy_lance'],
        ['diamond', 'proj_enemy_diamond'],
        ['heavy_orb', 'proj_enemy_heavy_orb'],
        ['ring_bolt', 'proj_enemy_ring_bolt'],
      ];
      expect(BAKED_FX_TEXTURE_KEYS).toContain('fx_enemy_bullet_glow');

      for (const [shape, expectedKey] of shapeMappings) {
        expect(BAKED_FX_TEXTURE_KEYS).toContain(expectedKey);
        const spec = resolveProjectileRenderSpec({
          team: 'enemy',
          bulletShape: shape,
          radius: 7.2,
          isStress: false,
        });
        expect(spec.textureKey).toBe(expectedKey);
        expect(spec.texture).toBe(expectedKey);
        expect(spec.tint).toBe(0xffffff);
        expect(spec.blendMode).toBe('NORMAL');
        expect(spec.depth).toBe(60);
        expect(spec.alpha).toBe(1.0);
        expect(spec.scale).toBeCloseTo(7.2 / 6.0, 4);
      }

      // Default radius (omitted) -> scale 1.0; tiny radius -> lower clamp; huge radius -> upper clamp
      expect(resolveProjectileRenderSpec({ team: 'enemy' }).scale).toBeCloseTo(1.0, 4);
      const minClamped = resolveProjectileRenderSpec({ team: 'enemy', radius: 2.0 });
      const maxClamped = resolveProjectileRenderSpec({ team: 'enemy', radius: 16.0 });
      expect(minClamped.scale).toBeCloseTo(0.85, 4);
      expect(maxClamped.scale).toBeCloseTo(1.65, 4);
    });

    it('assigns blendMode = ADD, depth = 42, and scales alpha by teammateFxOpacity for teammate player projectiles', () => {
      const localSpec = resolveProjectileRenderSpec({
        team: 'player',
        element: 'burn',
        isTeammate: false,
        teammateFxOpacity: 0.45,
      });
      expect(localSpec.textureKey).toBe('proj_player_burn');
      expect(localSpec.blendMode).toBe('ADD');
      expect(localSpec.depth).toBe(42);
      expect(localSpec.alpha).toBeCloseTo(1.0, 4);

      const teammateSpec = resolveProjectileRenderSpec({
        team: 'player',
        element: 'chill',
        isTeammate: true,
        teammateFxOpacity: 0.45,
      });
      expect(teammateSpec.textureKey).toBe('proj_player_chill');
      expect(teammateSpec.blendMode).toBe('ADD');
      expect(teammateSpec.depth).toBe(42);
      expect(teammateSpec.alpha).toBeCloseTo(0.45, 4);
    });
  });

  describe('2. Additive FX (BlendMode.ADD) Above Lightmap (> 34), easeOutCubic Rings & Shell Casing Shadow', () => {
    it('bakes all required P10b FX textures and completely removes fx_ambient_mist', () => {
      expect(BAKED_FX_TEXTURE_KEYS).not.toContain('fx_ambient_mist');
      expect(BAKED_FX_TEXTURE_KEYS).toContain('fx_impact_ring');
      expect(BAKED_FX_TEXTURE_KEYS).toContain('fx_shockwave_ring');
      expect(BAKED_FX_TEXTURE_KEYS).toContain('fx_spark_trail');
      expect(BAKED_FX_TEXTURE_KEYS).toContain('fx_muzzle_core');
      expect(BAKED_FX_TEXTURE_KEYS).toContain('fx_ambient_firefly');
      expect(BAKED_FX_TEXTURE_KEYS).toContain('fx_ambient_snow');
      expect(BAKED_FX_TEXTURE_KEYS).toContain('fx_ember_mote');
    });

    it('assigns BlendMode.ADD and 34 < depth < 60 to all glowing FX textures, and NORMAL to physical opaque particles', () => {
      const glowingKeys = [
        'fx_spark',
        'fx_spark_trail',
        'fx_impact_ring',
        'fx_shockwave_ring',
        'fx_muzzle_flash',
        'fx_muzzle_core',
        'fx_slash_arc',
        'fx_ember_mote',
        'fx_ambient_firefly',
        'fx_rarity_beam',
        'fx_sparkle_mote',
      ];
      for (const key of glowingKeys) {
        const spec = resolveParticleBlendAndDepth(key);
        expect(spec.blendMode, `Expected ${key} to use ADD`).toBe('ADD');
        expect(spec.depth, `Expected ${key} depth > 34`).toBeGreaterThan(34);
        expect(spec.depth, `Expected ${key} depth < 60 (below enemy bullets)`).toBeLessThan(60);
      }

      const opaqueKeys = ['fx_shell_casing', 'fx_wood_shard', 'fx_dust_puff', 'fx_ambient_leaf'];
      for (const key of opaqueKeys) {
        const spec = resolveParticleBlendAndDepth(key);
        expect(spec.blendMode, `Expected ${key} to use NORMAL`).toBe('NORMAL');
      }
    });

    it('computes easeOutCubic particle scaling for fast shockwave/impact ring expansion', () => {
      const linearMid = computeFxParticleScale(0.2, 1.2, 0.5, 'linear');
      const cubicMid = computeFxParticleScale(0.2, 1.2, 0.5, 'easeOutCubic');
      expect(linearMid).toBeCloseTo(0.7, 4);
      // easeOutCubic(0.5) = 0.875 => 0.2 + 1.0 * 0.875 = 1.075
      expect(cubicMid).toBeCloseTo(1.075, 4);
      expect(cubicMid).toBeGreaterThan(linearMid);
      expect(computeFxParticleScale(0.2, 1.2, 0, 'easeOutCubic')).toBeCloseTo(0.2, 4);
      expect(computeFxParticleScale(0.2, 1.2, 1, 'easeOutCubic')).toBeCloseTo(1.2, 4);
    });

    it('computes a positive ground shadow vertical offset for arcing shell casings that converges on landing', () => {
      const start = computeShellCasingShadowOffset(0.02, 0.42);
      const mid = computeShellCasingShadowOffset(0.16, 0.42);
      const end = computeShellCasingShadowOffset(0.42, 0.42);

      expect(start.offsetY).toBeGreaterThan(0);
      expect(mid.offsetY).toBeGreaterThan(start.offsetY);
      expect(mid.offsetY).toBeGreaterThan(end.offsetY);
      expect(end.offsetY).toBeGreaterThan(0);
      expect(mid.alpha).toBeGreaterThan(0.15);
    });
  });

  describe('3. Elemental Combo FX (easeOutCubic Shockwaves, Additive Particles & 0.4s Coalescing)', () => {
    it('produces easeOutCubic shockwave rings and BlendMode.ADD particle burst specs for all 6 elemental reactions', () => {
      const reactions = Object.keys(ELEMENTAL_REACTIONS) as ElementalReactionId[];
      expect(reactions).toEqual([
        'vaporize',
        'shatter',
        'superconduct',
        'toxic_blast',
        'paralysis',
        'overload',
      ]);

      for (const rx of reactions) {
        const soloSpec = resolveElementalReactionBurstSpec(rx, false);
        const comboSpec = resolveElementalReactionBurstSpec(rx, true);

        expect(soloSpec.primaryRing.textureKey).toBe('fx_shockwave_ring');
        expect(soloSpec.primaryRing.blendMode).toBe('ADD');
        expect(soloSpec.primaryRing.easeCurve).toBe('easeOutCubic');
        expect(soloSpec.primaryRing.depth).toBeGreaterThan(34);
        expect(soloSpec.primaryRing.depth).toBeLessThan(60);

        expect(soloSpec.innerRing.textureKey).toBe('fx_impact_ring');
        expect(soloSpec.innerRing.blendMode).toBe('ADD');
        expect(soloSpec.innerRing.easeCurve).toBe('easeOutCubic');

        expect(comboSpec.primaryRing.endScale).toBeGreaterThan(soloSpec.primaryRing.endScale);
        expect(comboSpec.particleCount).toBeGreaterThan(soloSpec.particleCount);
        expect(soloSpec.particleTextures.length).toBeGreaterThan(0);
        for (const tex of soloSpec.particleTextures) {
          expect(resolveParticleBlendAndDepth(tex).blendMode).toBe('ADD');
        }
      }
    });

    it('coalesces repeated elemental reactions within 0.4s into "HƠI NƯỚC ×3" (VI) and "VAPORIZE ×3" (EN)', () => {
      i18n.setLocale('vi');
      let state = coalesceElementalReaction(null, 'vaporize', 24, false, 0.4);
      expect(state.label).toBe('HƠI NƯỚC');
      expect(state.count).toBe(1);

      state = coalesceElementalReaction(state, 'vaporize', 26, false, 0.4);
      expect(state.label).toBe('HƠI NƯỚC ×2');
      expect(state.count).toBe(2);

      state = coalesceElementalReaction(state, 'vaporize', 30, true, 0.4);
      expect(state.label).toBe('HƠI NƯỚC ×3');
      expect(state.count).toBe(3);
      expect(state.totalDamage).toBe(80);
      expect(state.isTeamCombo).toBe(true);

      i18n.setLocale('en');
      let enState = coalesceElementalReaction(null, 'vaporize', 20, false, 0.4);
      enState = coalesceElementalReaction(enState, 'vaporize', 20, false, 0.4);
      enState = coalesceElementalReaction(enState, 'vaporize', 20, true, 0.4);
      expect(enState.label).toBe('VAPORIZE ×3');
      i18n.setLocale('vi');
    });
  });

  describe('4. Clear Biome Ambient Particles (Zero Fog, B1 Leaves+Fireflies, B2 60-80 2-Layer Snow, B3 <= 4px Rising Embers & Torch Motes)', () => {
    it('never returns fx_ambient_mist across any biome, index, quality tier, or blizzard state', () => {
      for (const biome of [1, 2, 3] as const) {
        for (const tier of ['high', 'medium', 'low'] as const) {
          for (const blizzard of [false, true]) {
            const count = resolveAmbientBudgetCount(biome, tier, blizzard);
            for (let i = 0; i < count; i++) {
              const spec = resolveBiomeAmbientSpec(biome, i, tier, blizzard);
              expect(spec.textureKey).not.toBe('fx_ambient_mist');
            }
          }
        }
      }
    });

    it('configures Biome 1 with drifting forest leaves (NORMAL) and glowing fireflies (ADD, un-outlined)', () => {
      const count = resolveAmbientBudgetCount(1, 'high', false);
      expect(count).toBeGreaterThanOrEqual(28);
      let leafCount = 0;
      let fireflyCount = 0;
      for (let i = 0; i < count; i++) {
        const spec = resolveBiomeAmbientSpec(1, i, 'high', false);
        if (spec.kind === 'leaf') {
          leafCount += 1;
          expect(spec.textureKey).toBe('fx_ambient_leaf');
          expect(spec.blendMode).toBe('NORMAL');
        } else if (spec.kind === 'firefly') {
          fireflyCount += 1;
          expect(spec.textureKey).toBe('fx_ambient_firefly');
          expect(spec.blendMode).toBe('ADD');
          expect(spec.depth).toBeGreaterThan(34);
          expect(spec.hasOutline).toBe(false);
        }
      }
      expect(leafCount).toBeGreaterThan(0);
      expect(fireflyCount).toBeGreaterThan(0);
    });

    it('configures Biome 2 with 60-80 soft round 2-4px snowflakes (never fx_ice_shard), sinusoidal sway, and 2-layer parallax', () => {
      const normalCount = resolveAmbientBudgetCount(2, 'high', false);
      const blizzardCount = resolveAmbientBudgetCount(2, 'high', true);
      expect(normalCount).toBeGreaterThanOrEqual(60);
      expect(normalCount).toBeLessThanOrEqual(80);
      expect(blizzardCount).toBeGreaterThanOrEqual(60);
      expect(blizzardCount).toBeLessThanOrEqual(80);

      let layer0Count = 0;
      let layer1Count = 0;
      let layer0SpeedSum = 0;
      let layer1SpeedSum = 0;
      let layer0SizeSum = 0;
      let layer1SizeSum = 0;

      for (let i = 0; i < normalCount; i++) {
        const spec = resolveBiomeAmbientSpec(2, i, 'high', false);
        expect(spec.kind).toBe('snow');
        expect(spec.textureKey).toBe('fx_ambient_snow');
        expect(spec.textureKey).not.toBe('fx_ice_shard');
        expect(spec.hasOutline).toBe(false);
        expect(spec.sizePx).toBeGreaterThanOrEqual(2);
        expect(spec.sizePx).toBeLessThanOrEqual(4);
        expect(spec.swayAmp).toBeGreaterThan(0);
        expect(spec.swayFreq).toBeGreaterThan(0);
        expect(spec.vy).toBeGreaterThan(0);

        if (spec.parallaxLayer === 0) {
          layer0Count += 1;
          layer0SpeedSum += spec.vy;
          layer0SizeSum += spec.sizePx;
        } else {
          layer1Count += 1;
          layer1SpeedSum += spec.vy;
          layer1SizeSum += spec.sizePx;
        }
      }

      expect(layer0Count).toBeGreaterThan(20);
      expect(layer1Count).toBeGreaterThan(20);
      // Foreground layer 1 moves faster and renders larger than background layer 0
      expect(layer1SpeedSum / layer1Count).toBeGreaterThan(layer0SpeedSum / layer0Count);
      expect(layer1SizeSum / layer1Count).toBeGreaterThan(layer0SizeSum / layer0Count);
    });

    it('configures Biome 3 with <= 4px un-outlined rising embers (ADD, vy < 0) distinct from enemy bullets', () => {
      const count = resolveAmbientBudgetCount(3, 'high', false);
      expect(count).toBeGreaterThanOrEqual(30);
      for (let i = 0; i < count; i++) {
        const spec = resolveBiomeAmbientSpec(3, i, 'high', false);
        expect(spec.kind).toBe('ember');
        expect(spec.textureKey).toBe('fx_ember_mote');
        expect(spec.blendMode).toBe('ADD');
        expect(spec.depth).toBeGreaterThan(34);
        expect(spec.depth).toBeLessThan(60);
        expect(spec.sizePx).toBeLessThanOrEqual(4);
        expect(spec.vy).toBeLessThan(0);
        expect(spec.hasOutline).toBe(false);
      }
    });

    it('keeps torch brazier dust motes strictly within the warm light pool radius (<= 72u)', () => {
      const anchorX = 480;
      const anchorY = 240;
      for (let idx = 0; idx < 16; idx++) {
        for (const phase of [0, 0.8, 1.7, 3.1, 4.9]) {
          const pos = computeTorchMotePosition(anchorX, anchorY, phase, idx);
          const dist = Math.hypot(pos.x - anchorX, pos.y - anchorY);
          expect(dist).toBeCloseTo(pos.radiusFromTorch, 4);
          expect(pos.radiusFromTorch).toBeLessThanOrEqual(72);
          expect(pos.alpha).toBeGreaterThan(0);
          expect(pos.alpha).toBeLessThanOrEqual(0.75);
        }
      }
    });
  });

  describe('5. Chest Open Loot Arc & Lid Pop Bounce, Enemy Spawn Rune Pillar, Boss Kill Slow-Mo/Flash & Iris Easing', () => {
    it('sets fromX = chest.x, fromY = chest.y - 6, and droppedAtTick = sim.tick on weapons spawned by openChest (solo & co-op) and arcs them parabolically', () => {
      // Solo chest open
      const soloSim = new WorldSim({ seed: 4242 });
      soloSim.tick = 120;
      const soloChest = soloSim.spawnChest(480, 260, 'legendary', 'solar_archon_staff');
      expect(soloSim.openChest(soloChest)).toBe(true);
      expect(soloSim.worldItems.length).toBe(1);
      const soloDrop = soloSim.worldItems[0]!;
      expect(soloDrop.fromX).toBe(480);
      expect(soloDrop.fromY).toBe(254);
      expect(soloDrop.droppedAtTick).toBe(120);
      expect(soloDrop.y).toBe(288);

      // Parabolic trajectory check via computeWorldItemArcPose
      const startPose = computeWorldItemArcPose(
        0,
        soloDrop.fromX!,
        soloDrop.fromY!,
        soloDrop.x,
        soloDrop.y,
      );
      const peakPose = computeWorldItemArcPose(
        0.12,
        soloDrop.fromX!,
        soloDrop.fromY!,
        soloDrop.x,
        soloDrop.y,
      );
      const settledPose = computeWorldItemArcPose(
        0.4,
        soloDrop.fromX!,
        soloDrop.fromY!,
        soloDrop.x,
        soloDrop.y,
      );
      expect(startPose.inArc).toBe(true);
      expect(startPose.x).toBeCloseTo(480, 3);
      expect(startPose.y).toBeCloseTo(254, 3);
      expect(peakPose.inArc).toBe(true);
      expect(peakPose.arcOffsetY).toBeLessThan(-18);
      expect(peakPose.y).toBeLessThan(soloDrop.fromY!);
      expect(settledPose.inArc).toBe(false);
      expect(settledPose.x).toBeCloseTo(soloDrop.x, 3);

      // 2-player co-op chest open
      const coopSim = new WorldSim({ seed: 4242, coopMode: true });
      coopSim.addCoopPlayer(2, 2, 'ranger', 'Teammate');
      coopSim.tick = 240;
      const coopChest = coopSim.spawnChest(500, 300, 'epic');
      expect(coopSim.openChest(coopChest)).toBe(true);
      expect(coopSim.worldItems.length).toBe(2);
      for (const item of coopSim.worldItems) {
        expect(item.fromX).toBe(500);
        expect(item.fromY).toBe(294);
        expect(item.droppedAtTick).toBe(240);
        expect(item.x).not.toBe(500);
        expect(item.y).toBe(328);
      }
    });

    it('computes easeOutBack lid pop bounce during the first 0.36s after opening a chest and settles cleanly afterward', () => {
      const midBounce = computeChestOpenBounce(0.12);
      expect(midBounce.offsetY).toBeLessThan(0);
      expect(midBounce.scaleX).toBeGreaterThan(1);
      expect(midBounce.scaleY).toBeGreaterThan(1);

      const settledBefore = computeChestOpenBounce(0);
      expect(settledBefore).toEqual({ offsetY: 0, scaleX: 1, scaleY: 1 });

      const settledAfter = computeChestOpenBounce(0.4);
      expect(settledAfter).toEqual({ offsetY: 0, scaleX: 1, scaleY: 1 });
    });

    it('computes counter-rotating arcane rune circle and rising vertical light pillar (ADD) for spawning enemies', () => {
      const early = computeEnemySpawnCircleSpec(14, 0.2, false, false);
      const mid = computeEnemySpawnCircleSpec(14, 0.55, false, false);
      const bossSpec = computeEnemySpawnCircleSpec(28, 0.55, true, true);

      expect(early.outerRadius).toBeGreaterThan(early.innerRadius);
      expect(early.runeCount).toBe(6);
      expect(bossSpec.runeCount).toBe(8);
      expect(mid.runeRotationRad).toBeGreaterThan(early.runeRotationRad);
      expect(mid.counterRuneRotationRad).toBeLessThan(early.counterRuneRotationRad);
      expect(mid.pillarHeightPx).toBeGreaterThan(0);
      expect(bossSpec.pillarHeightPx).toBeGreaterThan(mid.pillarHeightPx);
      expect(mid.pillarAlpha).toBeGreaterThan(0);
      expect(mid.blendMode).toBe('ADD');
    });

    it('computes boss kill flash alpha decay, scales consumeHitStopDelta by 0.25x during boss kill slow-mo, and uses smooth easeInOutCubic iris transition hole radius', () => {
      const dummyFx = Object.create(CombatFxManager.prototype) as CombatFxManager;
      dummyFx.hitStopRemainingMs = 0;
      dummyFx.bossKillSlowMoTimer = 0.42;
      dummyFx.bossKillFlashTimer = 0.28;

      const slowMoStep = dummyFx.consumeHitStopDelta(16);
      expect(slowMoStep.isHitStopped).toBe(false);
      expect(slowMoStep.simDeltaMs).toBeCloseTo(4, 4);

      expect(computeBossKillFlashAlpha(0.28, 0.28)).toBeGreaterThan(0.35);
      expect(computeBossKillFlashAlpha(0.14, 0.28)).toBeGreaterThan(0.1);
      expect(computeBossKillFlashAlpha(0, 0.28)).toBe(0);

      const maxR = 600;
      expect(computeIrisHoleRadius(0, maxR)).toBeCloseTo(600, 4);
      expect(computeIrisHoleRadius(0.5, maxR)).toBeCloseTo(300, 4);
      expect(computeIrisHoleRadius(1, maxR)).toBeCloseTo(2, 4);

      // Verify easeInOutCubic differs from linear at progress = 0.25 and 0.75
      const rQuarter = computeIrisHoleRadius(0.25, maxR);
      const rThreeQuarter = computeIrisHoleRadius(0.75, maxR);
      expect(rQuarter).toBeGreaterThan(maxR * 0.75); // easeInOutCubic(0.25) = 0.0625 => hole stays wider initially
      expect(rThreeQuarter).toBeLessThan(maxR * 0.25); // easeInOutCubic(0.75) = 0.9375 => hole closes smoothly at end
    });
  });

  describe('6. Boss Signature/Climax Co-op Callouts, Transient Light Pulse, 900ms Bullet Graze Throttle & Ring-Bolt Spin', () => {
    it('defines crisp high-pitch SFX_PRESETS.bullet_graze synth tick', () => {
      const preset = SFX_PRESETS.bullet_graze;
      expect(preset).toBeDefined();
      expect(preset.freq).toBeGreaterThanOrEqual(900);
      expect(preset.decaySec).toBeLessThanOrEqual(0.08);
      expect(preset.minIntervalMs).toBeGreaterThanOrEqual(60);
    });

    it('uses ev.bossPatternId in Co-op when boss.bossPatternId is undefined, spawns boss-colored transient light pulse, suppresses callouts during bossArmorShellActive, and keeps bullet_grazed free of floating text clutter', () => {
      i18n.setLocale('vi');
      const sim = new WorldSim({
        seed: 707,
        biome: 2,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
      });
      const kryssa = sim.spawnEnemy('kryssa_ice_queen', 500, 280, true);
      // Simulate Co-op client where QuantizedEnemySnap omits bossPatternId
      kryssa.bossPatternId = undefined;

      const floatingAlerts: { x: number; y: number; text: string; color?: string }[] = [];
      const transientLights: {
        x: number;
        y: number;
        radius: number;
        color: string;
        alpha: number;
        durationSec: number;
      }[] = [];

      const mockScene = {
        transport: { getSim: () => sim },
        time: { now: 0 },
        fx: {
          spawnFloatingAlert: vi.fn((x: number, y: number, text: string, color?: string) => {
            floatingAlerts.push({ x, y, text, color });
          }),
          spawnHitSparks: vi.fn(),
        },
        lighting: {
          spawnTransientLight: vi.fn(
            (
              x: number,
              y: number,
              radius: number,
              color: string,
              alpha: number,
              durationSec: number,
            ) => {
              transientLights.push({ x, y, radius, color, alpha, durationSec });
            },
          ),
        },
        coopPlayerRigs: new Map(),
        simPlayerRigs: new Map(),
        enemyRigs: new Map(),
        camFocusX: 480,
        camFocusY: 270,
      };

      // 1. Co-op enemy_telegraph with ev.bossPatternId = 4 triggers callout + CYAN_FROST transient light pulse
      processSimEventsImpl.call(mockScene as never, [
        {
          kind: 'enemy_telegraph',
          enemyId: kryssa.id,
          defId: 'kryssa_ice_queen',
          x: 500,
          y: 280,
          angle: 0,
          durationSec: 0.42,
          radius: 56,
          bossPatternId: 4,
        } as SimEvent,
      ]);
      expect(floatingAlerts).toHaveLength(1);
      expect(floatingAlerts[0]!.text).toBe('🌨️ BÃO TUYẾT VĨNH CỬU!');
      expect(transientLights).toContainEqual({
        x: 500,
        y: 280,
        radius: 150,
        color: PALETTE.CYAN_FROST,
        alpha: 0.85,
        durationSec: 0.32,
      });

      // 2. When boss.bossArmorShellActive is true, callouts & telegraph light pulses are suppressed even if stale pattern is 4
      floatingAlerts.length = 0;
      transientLights.length = 0;
      kryssa.bossArmorShellActive = true;
      kryssa.bossPatternId = 4;
      processSimEventsImpl.call(mockScene as never, [
        {
          kind: 'enemy_telegraph',
          enemyId: kryssa.id,
          defId: 'kryssa_ice_queen',
          x: 500,
          y: 280,
          angle: 0,
          durationSec: 0.42,
          radius: 56,
          bossPatternId: 4,
        } as SimEvent,
      ]);
      expect(floatingAlerts).toHaveLength(0);
      expect(transientLights).toHaveLength(0);

      // 3. bullet_grazed spawns subtle sparks & glint but NEVER spawns cluttered floating text
      sim.tick = 1;
      mockScene.time.now = 0;
      processSimEventsImpl.call(mockScene as never, [
        { kind: 'bullet_grazed', playerId: sim.player.id, x: 310, y: 290 },
      ]);
      expect(floatingAlerts).toHaveLength(0);
      expect(mockScene.fx.spawnHitSparks).toHaveBeenCalledTimes(1);

      sim.tick = 3;
      mockScene.time.now = 1200;
      processSimEventsImpl.call(mockScene as never, [
        { kind: 'bullet_grazed', playerId: sim.player.id, x: 312, y: 292 },
      ]);
      expect(floatingAlerts).toHaveLength(0);
      expect(mockScene.fx.spawnHitSparks).toHaveBeenCalledTimes(2);
    });

    it('spins ring_bolt enemy bullets, applies subtle 1.05x low-alpha glowSprite halo, and stores specScale on projectileSprites entries', () => {
      const sim = new WorldSim({
        seed: 808,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
      });
      sim.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        ownerId: 99,
        team: 'enemy',
        weaponId: 'boss_spore_ring',
        x: 320,
        y: 260,
        angle: 0,
        pelletCount: 1,
        spreadRad: 0,
        speed: 150,
        radius: 7.2,
        damage: 2,
        critChance: 0,
        knockback: 0,
        ttlSec: 2,
        pierceCount: 0,
        bounceCount: 0,
        element: 'poison',
        amplifiedByShield: false,
        seed: 1,
        bulletShape: 'ring_bolt',
      });
      const bullet = sim.projectiles[0]!;

      const makeMockDisplayObj = () => {
        const obj = {
          depth: 0,
          blendMode: 0,
          visible: false,
          scale: 1,
          alpha: 1,
          rotation: 0,
          x: 0,
          y: 0,
          setDepth(d: number) {
            obj.depth = d;
            return obj;
          },
          setBlendMode(m: number) {
            obj.blendMode = m;
            return obj;
          },
          setVisible(v: boolean) {
            obj.visible = v;
            return obj;
          },
          setActive() {
            return obj;
          },
          setScale(s: number) {
            obj.scale = s;
            return obj;
          },
          setAlpha(a: number) {
            obj.alpha = a;
            return obj;
          },
          setRotation(r: number) {
            obj.rotation = r;
            return obj;
          },
          setPosition(x: number, y: number) {
            obj.x = x;
            obj.y = y;
            return obj;
          },
          setTexture() {
            return obj;
          },
          setTint() {
            return obj;
          },
          clearTint() {
            return obj;
          },
          setDisplaySize() {
            return obj;
          },
        };
        return obj;
      };

      const mockScene = {
        transport: {
          getSim: () => sim,
          getInterpolatedProjectilePos: (b: { x: number; y: number }, out: { x: number; y: number }) => {
            out.x = b.x;
            out.y = b.y;
            return out;
          },
          getInterpolatedPickupPos: (p: { x: number; y: number }, out: { x: number; y: number }) => {
            out.x = p.x;
            out.y = p.y;
            return out;
          },
        },
        cameras: { main: { worldView: { x: 0, y: 0, width: 960, height: 540 } } },
        lighting: { getElapsedSec: () => 0.5, isLightmapVisible: () => true },
        add: {
          sprite: vi.fn(() => makeMockDisplayObj()),
          image: vi.fn(() => makeMockDisplayObj()),
        },
        projectileSprites: new Map(),
        projectileSpritePool: [],
        pickupSprites: new Map(),
        pickupSpritePool: [],
        activeProjIds: new Set<number>(),
        activePickupIds: new Set<number>(),
        entityPosScratch: { x: 0, y: 0 },
      };

      syncProjectilesAndPickupsImpl.call(mockScene as never);
      const entry = mockScene.projectileSprites.get(bullet.id) as {
        sprite: ReturnType<typeof makeMockDisplayObj>;
        glowSprite: ReturnType<typeof makeMockDisplayObj>;
        textureKey: string;
        specScale?: number;
      };
      expect(entry).toBeDefined();
      expect(entry.textureKey).toBe('proj_enemy_ring_bolt');
      expect(entry.specScale).toBeCloseTo(1.2, 4);
      const expectedRot = (0.5 * 6.0 + (bullet.id & 7)) % (Math.PI * 2);
      expect(entry.sprite.rotation).toBeCloseTo(expectedRot, 4);
      expect(entry.glowSprite.scale / entry.sprite.scale).toBeCloseTo(1.05, 4);
      const expectedAlpha = 0.24 + 0.04 * Math.sin(0.5 * 9.0 + (bullet.id & 7));
      expect(entry.glowSprite.alpha).toBeCloseTo(expectedAlpha, 4);
    });
  });
});
