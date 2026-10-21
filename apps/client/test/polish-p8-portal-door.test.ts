import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import {
  createDoorAnimState,
  createDoorBarrierPipeline,
  createPortalAnimState,
  createPortalVortexPipeline,
  DOOR_BARRIER_PIPELINE_KEY,
  DOOR_COMBAT_LOCKUP_DURATION_SEC,
  DOOR_UNLOCK_DISSOLVE_DURATION_SEC,
  type DoorShaderSprite,
  PORTAL_BURST_DURATION_SEC,
  PORTAL_ENTER_DURATION_SEC,
  PORTAL_VORTEX_PIPELINE_KEY,
  type PortalShaderSprite,
  resolveDoorVisualState,
  resolvePortalVisualState,
  stepDoorAnimState,
  stepPortalAnimState,
  triggerDoorCombatLockupState,
  triggerDoorUnlockDissolveState,
  triggerPortalActivationBurstState,
  triggerPortalEnterSequenceState,
} from '../src/fx/portal-door-shaders.js';

describe('Phase P8 — Portals & Room Doors Visual State & Animation Resolvers', () => {
  describe('resolvePortalVisualState', () => {
    it('hides portal in non-portal dungeon rooms when inactive', () => {
      const state = resolvePortalVisualState({
        inHub: false,
        hubReady: false,
        portalActive: false,
        roomType: 'combat',
        quality: 'high',
        elapsedSec: 1.0,
      });
      expect(state.visible).toBe(false);
      expect(state.mode).toBe('hidden');
    });

    it('resolves dungeon_inactive in portal room with dark gray-purple colors, slow spin, and low activity', () => {
      const state = resolvePortalVisualState({
        inHub: false,
        hubReady: false,
        portalActive: false,
        roomType: 'portal',
        quality: 'high',
        elapsedSec: 1.0,
      });
      expect(state.visible).toBe(true);
      expect(state.mode).toBe('dungeon_inactive');
      expect(state.useShader).toBe(true);
      expect(state.spinSpeedRadPerSec).toBeCloseTo(0.65, 2);
      expect(state.activityLevel).toBeCloseTo(0.35, 2);
      expect(state.outerColorHex).toBe('#4C3D63');
      expect(state.coreColorHex).toBe('#6D5B87');
      expect(state.rayCount).toBe(0);
    });

    it('resolves dungeon_active with vibrant arcane purple (#A855F7), cyan core (#22D3EE), fast spin (~2.6), and full activity', () => {
      const state = resolvePortalVisualState({
        inHub: false,
        hubReady: false,
        portalActive: true,
        roomType: 'portal',
        quality: 'high',
        elapsedSec: 1.0,
      });
      expect(state.visible).toBe(true);
      expect(state.mode).toBe('dungeon_active');
      expect(state.useShader).toBe(true);
      expect(state.outerColorHex).toBe('#A855F7');
      expect(state.coreColorHex).toBe('#22D3EE');
      expect(state.spinSpeedRadPerSec).toBeCloseTo(2.6, 2);
      expect(state.activityLevel).toBeCloseTo(1.0, 2);
      expect(state.particleCount).toBeGreaterThanOrEqual(8);
      expect(state.rayCount).toBeGreaterThanOrEqual(3);
    });

    it('resolves hub_waiting with cool slate-blue colors (#64748B / #38BDF8) and moderate spin (~1.4)', () => {
      const state = resolvePortalVisualState({
        inHub: true,
        hubReady: false,
        portalActive: true,
        roomType: 'start',
        quality: 'high',
        elapsedSec: 1.0,
      });
      expect(state.visible).toBe(true);
      expect(state.mode).toBe('hub_waiting');
      expect(state.outerColorHex).toBe('#64748B');
      expect(state.coreColorHex).toBe('#38BDF8');
      expect(state.spinSpeedRadPerSec).toBeCloseTo(1.4, 2);
    });

    it('resolves hub_ready with warm solar gold colors (#F59E42 / #FEF08A) and energetic spin (~2.8)', () => {
      const state = resolvePortalVisualState({
        inHub: true,
        hubReady: true,
        portalActive: true,
        roomType: 'start',
        quality: 'high',
        elapsedSec: 1.0,
      });
      expect(state.visible).toBe(true);
      expect(state.mode).toBe('hub_ready');
      expect(state.outerColorHex).toBe('#F59E42');
      expect(state.coreColorHex).toBe('#FEF08A');
      expect(state.rimColorHex).toBe('#FACC15');
      expect(state.spinSpeedRadPerSec).toBeCloseTo(2.8, 2);
      expect(state.activityLevel).toBeCloseTo(1.0, 2);
    });

    it('disables shader on low quality while keeping multi-layer sprite rotation active', () => {
      const state = resolvePortalVisualState({
        inHub: false,
        hubReady: false,
        portalActive: true,
        roomType: 'portal',
        quality: 'low',
        elapsedSec: 1.0,
      });
      expect(state.visible).toBe(true);
      expect(state.useShader).toBe(false);
      expect(state.spinSpeedRadPerSec).toBeCloseTo(2.6, 2);
      expect(Math.abs(state.coreSpinSpeedRadPerSec)).toBeGreaterThan(2.0);
    });
  });

  describe('stepPortalAnimState', () => {
    it('advances 0.72s activation burst when portalActive transitions false -> true and settles at 0', () => {
      expect(PORTAL_BURST_DURATION_SEC).toBeGreaterThanOrEqual(0.6);
      expect(PORTAL_BURST_DURATION_SEC).toBeLessThanOrEqual(0.8);

      const anim = createPortalAnimState();
      // Frame 1: inactive in portal room
      const s0 = stepPortalAnimState(anim, {
        dtSec: 0.016,
        roomKey: '1_4',
        portalActive: false,
        inHub: false,
      });
      expect(s0.burstProgress).toBe(0);
      expect(s0.burstTriggered).toBe(false);

      // Frame 2: portal activates!
      const s1 = stepPortalAnimState(anim, {
        dtSec: 0.18,
        roomKey: '1_4',
        portalActive: true,
        inHub: false,
      });
      expect(s1.burstTriggered).toBe(true);
      expect(s1.burstProgress).toBeCloseTo(0.18 / PORTAL_BURST_DURATION_SEC, 3);
      expect(s1.shockwaveRadius).toBeGreaterThan(20);
      expect(s1.shockwaveAlpha).toBeGreaterThan(0.2);
      expect(s1.flashAlpha).toBeGreaterThan(0.1);

      // Mid-burst
      const s2 = stepPortalAnimState(anim, {
        dtSec: 0.36,
        roomKey: '1_4',
        portalActive: true,
        inHub: false,
      });
      expect(s2.burstProgress).toBeCloseTo(0.54 / PORTAL_BURST_DURATION_SEC, 3);
      expect(s2.shockwaveRadius).toBeGreaterThan(s1.shockwaveRadius);

      // Complete burst (> 0.72s total)
      const s3 = stepPortalAnimState(anim, {
        dtSec: 0.25,
        roomKey: '1_4',
        portalActive: true,
        inHub: false,
      });
      expect(s3.burstProgress).toBe(0);
      expect(s3.shockwaveAlpha).toBe(0);
      expect(anim.burstActive).toBe(false);
    });

    it('supports explicit triggerPortalActivationBurstState for deterministic strip capture', () => {
      const anim = createPortalAnimState();
      triggerPortalActivationBurstState(anim);
      const step = stepPortalAnimState(anim, {
        dtSec: 0.09,
        roomKey: '1_4',
        portalActive: true,
        inHub: false,
      });
      expect(step.burstProgress).toBeCloseTo(0.09 / PORTAL_BURST_DURATION_SEC, 3);
      expect(step.shockwaveAlpha).toBeGreaterThan(0.5);
    });

    it('advances 0.30s player-enter stretch/spiral sequence and fires enterCompleted at 0.30s', () => {
      expect(PORTAL_ENTER_DURATION_SEC).toBeCloseTo(0.3, 3);

      const anim = createPortalAnimState();
      triggerPortalEnterSequenceState(anim, 400, 270, 448, 270);
      expect(anim.enterActive).toBe(true);

      // Step 0.15s (halfway)
      const mid = stepPortalAnimState(anim, {
        dtSec: 0.15,
        roomKey: '1_4',
        portalActive: true,
        inHub: false,
      });
      expect(mid.enterActive).toBe(true);
      expect(mid.enterCompleted).toBe(false);
      expect(mid.enterProgress).toBeCloseTo(0.5, 3);
      expect(mid.playerX).toBeGreaterThan(405);
      expect(mid.playerX).toBeLessThan(448);
      expect(mid.playerScaleX).toBeLessThan(0.75);
      expect(mid.playerScaleY).toBeGreaterThan(1.1);
      expect(mid.playerRotationRad).toBeGreaterThan(0.5);
      expect(mid.enterFlashAlpha).toBeGreaterThan(0.4);

      // Step remaining 0.16s (completes 0.30s enter sequence)
      const done = stepPortalAnimState(anim, {
        dtSec: 0.16,
        roomKey: '1_4',
        portalActive: true,
        inHub: false,
      });
      expect(done.enterCompleted).toBe(true);
      expect(done.enterActive).toBe(false);
      expect(done.playerX).toBeCloseTo(448, 1);
      expect(done.playerY).toBeCloseTo(270, 1);
      expect(done.playerAlpha).toBeLessThanOrEqual(0.15);
    });
  });

  describe('resolveDoorVisualState & stepDoorAnimState', () => {
    it('uses distinct N/S vs E/W texture keys and keeps frameRotationRad === 0 for all 4 directions', () => {
      for (const dir of ['N', 'S', 'E', 'W'] as const) {
        const lockedState = resolveDoorVisualState({
          dir,
          locked: true,
          biome: 2,
          inHub: false,
          quality: 'high',
        });
        expect(lockedState.frameRotationRad).toBe(0);
        expect(lockedState.barrierRotationRad).toBe(0);
        if (dir === 'N' || dir === 'S') {
          expect(lockedState.orientation).toBe('ns');
          expect(lockedState.isVertical).toBe(false);
          expect(lockedState.frameTextureKey).toBe('door_frame_ns_2');
          expect(lockedState.barrierTextureKey).toBe('door_barrier_ns');
          expect(lockedState.openArchTextureKey).toBe('door_open_arch_ns');
        } else {
          expect(lockedState.orientation).toBe('ew');
          expect(lockedState.isVertical).toBe(true);
          expect(lockedState.frameTextureKey).toBe('door_frame_ew_2');
          expect(lockedState.barrierTextureKey).toBe('door_barrier_ew');
          expect(lockedState.openArchTextureKey).toBe('door_open_arch_ew');
        }
        expect(lockedState.barrierVisible).toBe(true);
        expect(lockedState.useShader).toBe(true);
      }
    });

    it('advances 380ms (0.38s) unlock dissolve animation when locked transitions true -> false and emits sparks', () => {
      expect(DOOR_UNLOCK_DISSOLVE_DURATION_SEC).toBeGreaterThanOrEqual(0.3);
      expect(DOOR_UNLOCK_DISSOLVE_DURATION_SEC).toBeLessThanOrEqual(0.45);

      const anim = createDoorAnimState(true);
      // Still locked
      const s0 = stepDoorAnimState(anim, { dtSec: 0.016, locked: true });
      expect(s0.dissolveProgress).toBe(0);
      expect(s0.emitUnlockSparks).toBe(false);

      // Unlocks!
      const s1 = stepDoorAnimState(anim, { dtSec: 0.19, locked: false });
      expect(s1.emitUnlockSparks).toBe(true);
      expect(s1.dissolveActive).toBe(true);
      expect(s1.dissolveProgress).toBeCloseTo(0.19 / DOOR_UNLOCK_DISSOLVE_DURATION_SEC, 3);

      // While dissolving, barrier remains visible with dissolveProgress > 0
      const visMid = resolveDoorVisualState({
        dir: 'E',
        locked: false,
        biome: 1,
        quality: 'high',
        dissolveProgress: s1.dissolveProgress,
      });
      expect(visMid.barrierVisible).toBe(true);
      expect(visMid.openArchVisible).toBe(true);

      // Finish dissolve
      const s2 = stepDoorAnimState(anim, { dtSec: 0.22, locked: false });
      expect(s2.dissolveActive).toBe(false);
      expect(s2.dissolveProgress).toBe(1);

      const visDone = resolveDoorVisualState({
        dir: 'E',
        locked: false,
        biome: 1,
        quality: 'high',
        dissolveProgress: s2.dissolveProgress,
      });
      expect(visDone.barrierVisible).toBe(false);
      expect(visDone.openArchVisible).toBe(true);
    });

    it('advances 250ms (0.25s) combat lock-up animation when entering a combat room with locked doors', () => {
      expect(DOOR_COMBAT_LOCKUP_DURATION_SEC).toBeCloseTo(0.25, 3);

      const anim = createDoorAnimState(true);
      triggerDoorCombatLockupState(anim);

      const s1 = stepDoorAnimState(anim, { dtSec: 0.125, locked: true });
      expect(s1.emitLockupSound).toBe(true);
      expect(s1.lockupActive).toBe(true);
      expect(s1.lockupProgress).toBeCloseTo(0.5, 3);

      const s2 = stepDoorAnimState(anim, { dtSec: 0.15, locked: true });
      expect(s2.lockupActive).toBe(false);
      expect(s2.lockupProgress).toBe(1);
    });

    it('supports explicit triggerDoorUnlockDissolveState and Low quality fallback without shader', () => {
      const anim = createDoorAnimState(false);
      triggerDoorUnlockDissolveState(anim);
      const step = stepDoorAnimState(anim, { dtSec: 0.095, locked: false });
      expect(step.dissolveActive).toBe(true);
      expect(step.dissolveProgress).toBeCloseTo(0.095 / DOOR_UNLOCK_DISSOLVE_DURATION_SEC, 3);

      const lowVis = resolveDoorVisualState({
        dir: 'N',
        locked: true,
        biome: 1,
        quality: 'low',
      });
      expect(lowVis.useShader).toBe(false);
      expect(lowVis.barrierVisible).toBe(true);
      expect(lowVis.frameTextureKey).toBe('door_frame_ns_1');
      expect(lowVis.barrierTextureKey).toBe('door_barrier_ns');
    });
  });

  describe('PortalVortexPipeline & DoorBarrierPipeline per-object uniform flushing', () => {
    it('flushes previous batch vertices in onBind when vertexCount > 0 and sets per-sprite uniforms', () => {
      class MockSinglePipeline {
        public config: Record<string, unknown>;
        public vertexCount = 0;
        public flushCount = 0;
        public uniforms1f = new Map<string, number>();
        public uniforms3f = new Map<string, [number, number, number]>();

        constructor(config: Record<string, unknown>) {
          this.config = config;
        }

        public onBind(_gameObject?: unknown): void {}

        public flush(): void {
          this.flushCount += 1;
          this.vertexCount = 0;
        }

        public set1f(name: string, val: number): void {
          this.uniforms1f.set(name, val);
        }

        public set3f(name: string, x: number, y: number, z: number): void {
          this.uniforms3f.set(name, [x, y, z]);
        }
      }

      const mockPhaser = {
        Renderer: {
          WebGL: {
            Pipelines: {
              SinglePipeline: MockSinglePipeline,
            },
          },
        },
      } as unknown as typeof Phaser;

      const portalPipe = createPortalVortexPipeline(
        {} as Phaser.Game,
        mockPhaser,
      ) as unknown as MockSinglePipeline;
      expect(portalPipe.config.name).toBe(PORTAL_VORTEX_PIPELINE_KEY);
      portalPipe.vertexCount = 6;
      const mockPortalSprite = {
        __portalUniforms: {
          time: 2.5,
          spinSpeed: 2.8,
          activity: 1.0,
          pulse: 0.75,
          burstProgress: 0.4,
          outerRgb: [0.96, 0.62, 0.26] as [number, number, number],
          coreRgb: [1.0, 0.94, 0.54] as [number, number, number],
          rimRgb: [0.98, 0.8, 0.08] as [number, number, number],
        },
      } as unknown as PortalShaderSprite;

      portalPipe.onBind(mockPortalSprite);
      expect(portalPipe.flushCount).toBe(1);
      expect(portalPipe.uniforms1f.get('uTime')).toBeCloseTo(2.5, 3);
      expect(portalPipe.uniforms1f.get('uBurstProgress')).toBeCloseTo(0.4, 3);
      expect(portalPipe.uniforms3f.get('uOuterColor')?.[0]).toBeCloseTo(0.96, 2);

      const doorPipe = createDoorBarrierPipeline(
        {} as Phaser.Game,
        mockPhaser,
      ) as unknown as MockSinglePipeline;
      expect(doorPipe.config.name).toBe(DOOR_BARRIER_PIPELINE_KEY);
      doorPipe.vertexCount = 12;
      const mockDoorSprite = {
        __doorUniforms: {
          time: 1.2,
          lockupProgress: 0.6,
          dissolveProgress: 0.35,
          isVertical: 1.0,
          primaryRgb: [0.86, 0.15, 0.15] as [number, number, number],
          rimRgb: [0.98, 0.75, 0.14] as [number, number, number],
        },
      } as unknown as DoorShaderSprite;

      doorPipe.onBind(mockDoorSprite);
      expect(doorPipe.flushCount).toBe(1);
      expect(doorPipe.uniforms1f.get('uLockupProgress')).toBeCloseTo(0.6, 3);
      expect(doorPipe.uniforms1f.get('uDissolveProgress')).toBeCloseTo(0.35, 3);
      expect(doorPipe.uniforms1f.get('uIsVertical')).toBe(1.0);
    });
  });
});
