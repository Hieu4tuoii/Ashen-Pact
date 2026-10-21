import { ELEMENTAL_REACTIONS, type ElementalReactionId, type ElementType, i18n } from '@ashen-pact/shared';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/art/palette.js';
import {
  BAKED_FX_TEXTURE_KEYS,
  ENEMY_BULLET_VISUAL_SPEC,
} from '../src/art/texture-baker-fx.js';
import {
  coalesceElementalReaction,
  computeFxParticleScale,
  computeShellCasingShadowOffset,
  computeTorchMotePosition,
  resolveAmbientBudgetCount,
  resolveBiomeAmbientSpec,
  resolveElementalReactionBurstSpec,
  resolveParticleBlendAndDepth,
  resolveProjectileRenderSpec,
} from '../src/fx/combat-fx.js';

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
});
