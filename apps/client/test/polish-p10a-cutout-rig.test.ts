import { describe, expect, it } from 'vitest';
import {
  blendRigPoseSnapshots,
  computeEnemyArchetypeMotion,
  computeEyeBlinkPeriodSec,
  computeEyeBlinkScaleY,
  computeHeadAimOffset,
  createBackAccessorySpringState,
  createStateCrossfadeController,
  createWeaponRecoilSpringState,
  evaluateRigPose,
  shouldEmitFootstepDust,
  shouldUseEnemyFastComposite,
  STATE_CROSSFADE_DURATION_SEC,
  stepBackAccessorySpring,
  stepStateCrossfade,
  stepTorsoMoveLean,
  stepWeaponRecoilSpring,
  transitionRigAnimState,
  triggerWeaponRecoilImpulse,
} from '../src/art/cutout-rig-math.js';
import { PALETTE } from '../src/art/palette.js';
import {
  resolveShapeMaterialProfile,
  STANDARD_OUTLINE_WIDTH,
} from '../src/art/primitives.js';
import {
  BOSS_OUTLINE_WIDTH,
  COAL_GOLEM_RIG_DEF,
  FORGE_TITAN_RIG_DEF,
  FROST_BAT_RIG_DEF,
  GOBLIN_SHOOTER_RIG_DEF,
  GREEN_SLIME_RIG_DEF,
  KRYSSA_CLONE_RIG_DEF,
  KRYSSA_ICE_QUEEN_RIG_DEF,
  SPORE_KING_RIG_DEF,
  VANGUARD_RIG_DEF,
} from '../src/art/rig-defs.js';

describe('Phase P10a — Cutout 2.0 Parametric Animation & Spring Math Engine', () => {
  it('1. crossfades smoothly between states over 0.12s (within 0.10-0.15s) with zero discontinuity at t=0', () => {
    expect(STATE_CROSSFADE_DURATION_SEC).toBeGreaterThanOrEqual(0.1);
    expect(STATE_CROSSFADE_DURATION_SEC).toBeLessThanOrEqual(0.15);
    expect(STATE_CROSSFADE_DURATION_SEC).toBeCloseTo(0.12, 3);

    const ctrl = createStateCrossfadeController('idle');
    const idlePose = evaluateRigPose({
      def: VANGUARD_RIG_DEF,
      animState: 'idle',
      animTime: 0.5,
      localAim: 0.1,
      moveLeanRad: 0,
      recoilSpring: createWeaponRecoilSpringState(),
      backSpring: createBackAccessorySpringState(),
      meleeSwingOffsetRad: 0,
      telegraphProgress: 0,
      reviveProgress: 0,
      phaseSeed: 1,
    });

    const runPose = evaluateRigPose({
      def: VANGUARD_RIG_DEF,
      animState: 'run',
      animTime: 0.5,
      localAim: 0.1,
      moveLeanRad: 0.1,
      recoilSpring: createWeaponRecoilSpringState(),
      backSpring: createBackAccessorySpringState(),
      meleeSwingOffsetRad: 0,
      telegraphProgress: 0,
      reviveProgress: 0,
      phaseSeed: 1,
    });

    transitionRigAnimState(ctrl, 'run', idlePose);
    expect(ctrl.currentState).toBe('run');
    expect(ctrl.prevState).toBe('idle');

    // At t = 0 immediately after state change: 0% target, 100% previous pose (no jump)
    const alpha0 = stepStateCrossfade(ctrl, 0);
    expect(alpha0).toBe(0);
    const blended0 = blendRigPoseSnapshots(ctrl.fromPose!, runPose, alpha0);
    expect(blended0.parts.torso.rotation).toBeCloseTo(idlePose.parts.torso.rotation, 5);
    expect(blended0.parts.legLeft.rotation).toBeCloseTo(idlePose.parts.legLeft.rotation, 5);
    expect(blended0.bodyY).toBeCloseTo(idlePose.bodyY, 5);

    // At t = 0.06s (50% of 0.12s): smoothly interpolated halfway between idle and run
    const alphaMid = stepStateCrossfade(ctrl, 0.06);
    expect(alphaMid).toBeCloseTo(0.5, 2);
    const blendedMid = blendRigPoseSnapshots(ctrl.fromPose!, runPose, alphaMid);
    expect(blendedMid.parts.torso.rotation).toBeGreaterThan(idlePose.parts.torso.rotation);
    expect(blendedMid.parts.torso.rotation).toBeLessThan(runPose.parts.torso.rotation);

    // At t >= 0.12s: 100% target run pose
    const alphaEnd = stepStateCrossfade(ctrl, 0.06);
    expect(alphaEnd).toBe(1);
    const blendedEnd = blendRigPoseSnapshots(ctrl.fromPose!, runPose, alphaEnd);
    expect(blendedEnd.parts.torso.rotation).toBeCloseTo(runPose.parts.torso.rotation, 5);
    expect(blendedEnd.parts.legLeft.rotation).toBeCloseTo(runPose.parts.legLeft.rotation, 5);
    expect(blendedEnd.bodyY).toBeCloseTo(runPose.bodyY, 5);
  });

  it('2. evaluates distinct parametric poses for attack, hurt, dash, cast, downed, and revive', () => {
    const baseParams = {
      def: VANGUARD_RIG_DEF,
      animTime: 0.25,
      localAim: 0.2,
      moveLeanRad: 0,
      recoilSpring: createWeaponRecoilSpringState(),
      backSpring: createBackAccessorySpringState(),
      meleeSwingOffsetRad: 0,
      telegraphProgress: 0,
      reviveProgress: 0.6,
      phaseSeed: 0,
    };

    const torsoDef = VANGUARD_RIG_DEF.parts.find((p) => p.id === 'torso')!;
    const armLDef = VANGUARD_RIG_DEF.parts.find((p) => p.id === 'armLeft')!;
    const armRDef = VANGUARD_RIG_DEF.parts.find((p) => p.id === 'armRight')!;
    const weaponDef = VANGUARD_RIG_DEF.parts.find((p) => p.id === 'weapon')!;

    // attack pose: forward torso lean + extended weapon & right arm along localAim
    const attackPose = evaluateRigPose({ ...baseParams, animState: 'attack' });
    expect(attackPose.parts.torso.rotation).toBeGreaterThan(0.12);
    expect(attackPose.parts.weapon.x).toBeGreaterThan(weaponDef.offsetX + 1.5);
    expect(attackPose.parts.armRight.x).toBeGreaterThan(armRDef.offsetX + 1.0);

    // hurt pose: backward torso/head recoil and backward tilt
    const hurtPose = evaluateRigPose({ ...baseParams, animState: 'hurt' });
    expect(hurtPose.parts.torso.x).toBeLessThan(torsoDef.offsetX - 1.5);
    expect(hurtPose.parts.torso.rotation).toBeLessThan(-0.12);
    expect(hurtPose.parts.head.rotation).toBeLessThan(-0.12);

    // dash pose: forward body stretch (scaleX > 1.1, scaleY < 0.92) + strong forward torso lean
    const dashPose = evaluateRigPose({ ...baseParams, animState: 'dash' });
    expect(dashPose.bodyScaleX).toBeGreaterThan(1.1);
    expect(dashPose.bodyScaleY).toBeLessThan(0.92);
    expect(dashPose.parts.torso.rotation).toBeGreaterThan(0.22);

    // cast pose: both arms raised upward and body levitating
    const castPose = evaluateRigPose({ ...baseParams, animState: 'cast' });
    expect(castPose.parts.armLeft.y).toBeLessThan(armLDef.offsetY - 2.5);
    expect(castPose.parts.armRight.y).toBeLessThan(armRDef.offsetY - 2.5);
    expect(castPose.parts.armLeft.rotation).toBeLessThan(-0.35);
    expect(castPose.bodyY).toBeLessThan(-1.5);

    // downed & revive poses
    const downedPose = evaluateRigPose({ ...baseParams, animState: 'downed' });
    const revivePose = evaluateRigPose({ ...baseParams, animState: 'revive' });
    expect(downedPose.bodyScaleY).toBeLessThan(0.8);
    expect(downedPose.parts.torso.rotation).toBeGreaterThan(0.15);
    expect(revivePose.bodyScaleY).toBeGreaterThan(downedPose.bodyScaleY);
    expect(revivePose.bodyY).toBeLessThan(0);
  });

  it('3. tilts torso proportionally to moveDirX and decays smoothly to 0 when stopping', () => {
    let leanRight = 0;
    let leanLeft = 0;
    for (let i = 0; i < 12; i++) {
      leanRight = stepTorsoMoveLean(leanRight, 1.0, 1 / 60);
      leanLeft = stepTorsoMoveLean(leanLeft, -1.0, 1 / 60);
    }
    expect(leanRight).toBeGreaterThan(0.08);
    expect(leanLeft).toBeLessThan(-0.08);
    expect(leanRight).toBeCloseTo(-leanLeft, 5);

    // Decay to 0 when standing still
    for (let i = 0; i < 30; i++) {
      leanRight = stepTorsoMoveLean(leanRight, 0, 1 / 60);
    }
    expect(Math.abs(leanRight)).toBeLessThan(0.01);
  });

  it('4. computes deterministic 3-5s eye blink cycle and tracks localAim with head position & tilt', () => {
    for (const seed of [0, 0.2, 0.4, 0.6, 0.8, 1.5]) {
      const period = computeEyeBlinkPeriodSec(seed);
      expect(period).toBeGreaterThanOrEqual(3.2);
      expect(period).toBeLessThanOrEqual(4.8);

      let minScaleY = 1.0;
      let openSamples = 0;
      const totalSamples = 400;
      for (let i = 0; i < totalSamples; i++) {
        const t = (i / totalSamples) * period;
        const s = computeEyeBlinkScaleY(t, seed);
        if (s < minScaleY) minScaleY = s;
        if (s === 1.0) openSamples += 1;
      }
      expect(minScaleY).toBeLessThanOrEqual(0.15);
      expect(openSamples).toBeGreaterThan(totalSamples * 0.9);
      // Deterministic repeat check
      expect(computeEyeBlinkScaleY(1.25, seed)).toBe(computeEyeBlinkScaleY(1.25, seed));
    }

    const aimRightUp = computeHeadAimOffset(-0.45);
    const aimRightDown = computeHeadAimOffset(0.45);
    expect(aimRightUp.offsetX).toBeGreaterThan(0.5);
    expect(aimRightUp.offsetY).toBeLessThan(0);
    expect(aimRightUp.rotation).toBeLessThan(0);
    expect(aimRightDown.offsetY).toBeGreaterThan(0);
    expect(aimRightDown.rotation).toBeGreaterThan(0);
  });

  it('5. simulates underdamped spring secondary motion for backAccessory with lag and overshoot', () => {
    let spring = createBackAccessorySpringState();
    // Apply sudden forward velocity impulse
    for (let i = 0; i < 8; i++) {
      spring = stepBackAccessorySpring(spring, {
        moveVx: 180,
        moveVy: 0,
        bodyBounceVelY: -12,
        facingSign: 1,
        isDashing: true,
        animState: 'dash',
        dtSec: 1 / 60,
      });
    }
    expect(spring.offsetX).toBeLessThan(-0.8);
    expect(spring.angle).toBeLessThan(-0.08);

    // Stop moving and verify underdamped overshoot + convergence to 0
    let maxPositiveOvershootAngle = 0;
    for (let i = 0; i < 90; i++) {
      spring = stepBackAccessorySpring(spring, {
        moveVx: 0,
        moveVy: 0,
        bodyBounceVelY: 0,
        facingSign: 1,
        isDashing: false,
        animState: 'idle',
        dtSec: 1 / 60,
      });
      if (spring.angle > maxPositiveOvershootAngle) {
        maxPositiveOvershootAngle = spring.angle;
      }
    }
    expect(maxPositiveOvershootAngle).toBeGreaterThan(0.005);
    expect(Math.abs(spring.angle)).toBeLessThan(0.02);
    expect(Math.abs(spring.offsetX)).toBeLessThan(0.15);
  });

  it('6. aims weapon 100% (1.0 * localAim) around hand pivot and recovers recoil via spring physics', () => {
    const aimAngle = 0.52;
    const poseAtZeroTime = evaluateRigPose({
      def: VANGUARD_RIG_DEF,
      animState: 'idle',
      animTime: 0,
      localAim: aimAngle,
      moveLeanRad: 0,
      recoilSpring: createWeaponRecoilSpringState(),
      backSpring: createBackAccessorySpringState(),
      meleeSwingOffsetRad: 0,
      telegraphProgress: 0,
      reviveProgress: 0,
      phaseSeed: 0,
    });
    // At animTime = 0 (breathing sin(0) = 0), weapon.rotation tracks 1.0 * localAim
    expect(poseAtZeroTime.parts.weapon.rotation).toBeCloseTo(aimAngle, 3);
    expect(poseAtZeroTime.parts.armRight.rotation).toBeGreaterThan(aimAngle * 0.7);

    // Spring recoil kick and recovery
    let recoil = createWeaponRecoilSpringState();
    recoil = triggerWeaponRecoilImpulse(recoil, 6);
    expect(recoil.displacement).toBeGreaterThan(3.5);
    expect(recoil.angleKick).toBeLessThan(-0.08);

    for (let i = 0; i < 45; i++) {
      recoil = stepWeaponRecoilSpring(recoil, 1 / 60);
    }
    expect(Math.abs(recoil.displacement)).toBeLessThan(0.15);
    expect(Math.abs(recoil.angleKick)).toBeLessThan(0.02);
  });

  it('7. applies distinct archetype idle/telegraph motion for slimes, flying units, and heavy golems', () => {
    const slimeMod = computeEnemyArchetypeMotion(GREEN_SLIME_RIG_DEF.id, 'idle', 0.2, 0);
    const batMod = computeEnemyArchetypeMotion(FROST_BAT_RIG_DEF.id, 'idle', 0.2, 0);
    const golemMod = computeEnemyArchetypeMotion(COAL_GOLEM_RIG_DEF.id, 'run', 0.1, 0.7);

    // Slime squashes & stretches noticeably
    expect(Math.abs(slimeMod.scaleXMult - 1)).toBeGreaterThan(0.02);
    expect(Math.abs(slimeMod.scaleYMult - 1)).toBeGreaterThan(0.02);

    // Flying bat hovers above ground (negative bodyYOffset)
    expect(batMod.bodyYOffset).toBeLessThan(-1.5);

    // Heavy golem with telegraph has strong wind-up crouch/lean
    expect(golemMod.telegraphTorsoRotOffset).not.toBe(0);
  });

  it('8. classifies shape materials (metal, cloth, crystal, organic) and returns 2-layer shading + -135 deg rim-light specs', () => {
    const metalProfile = resolveShapeMaterialProfile({
      fill: PALETTE.STEEL_LIGHT,
      shade: PALETTE.STEEL_DARK,
      highlight: PALETTE.SILVER_BRIGHT,
    });
    expect(metalProfile.material).toBe('metal');
    expect(metalProfile.rimLightAngleRad).toBeCloseTo(-Math.PI * 0.75, 5);
    expect(metalProfile.rimLightAlpha).toBeGreaterThanOrEqual(0.45);
    expect(metalProfile.softGradientTopLeftAlpha).toBeGreaterThan(0.1);
    expect(metalProfile.softGradientBottomRightAlpha).toBeGreaterThan(0.2);
    expect(metalProfile.highlightAlpha).toBeCloseTo(0.88, 2);
    expect(metalProfile.hasSecondaryGlint).toBe(true);

    const crystalProfile = resolveShapeMaterialProfile({
      fill: PALETTE.CYAN_FROST,
      shade: PALETTE.COBALT_SHADE,
      highlight: PALETTE.ICE_WHITE,
    });
    expect(crystalProfile.material).toBe('crystal');
    expect(crystalProfile.highlightAlpha).toBeCloseTo(0.92, 2);
    expect(crystalProfile.hasSecondaryGlint).toBe(true);

    const organicProfile = resolveShapeMaterialProfile({
      fill: PALETTE.GOBLIN_GREEN,
      shade: PALETTE.FOREST_SHADE,
      highlight: PALETTE.LIME_GLOW,
    });
    expect(organicProfile.material).toBe('organic');
    expect(organicProfile.highlightAlpha).toBeCloseTo(0.52, 2);
    expect(organicProfile.hasSecondaryGlint).toBe(false);

    const clothProfile = resolveShapeMaterialProfile({
      fill: PALETTE.LEATHER_MID,
      shade: PALETTE.LEATHER_DARK,
      highlight: PALETTE.LEATHER_LIGHT,
    });
    expect(clothProfile.material).toBe('cloth');
    expect(clothProfile.highlightAlpha).toBeCloseTo(0.52, 2);

    // Explicit style.material override is honored
    const overrideCrystal = resolveShapeMaterialProfile({
      fill: PALETTE.SLATE_DARK,
      material: 'crystal',
    });
    expect(overrideCrystal.material).toBe('crystal');
  });

  it('9. enforces BOSS_OUTLINE_WIDTH (3.5u) on all 3 Boss rigs and STANDARD_OUTLINE_WIDTH (2.5u) on standard heroes/enemies', () => {
    expect(BOSS_OUTLINE_WIDTH).toBe(3.5);
    expect(STANDARD_OUTLINE_WIDTH).toBe(2.5);

    const primaryPartIds = [
      'backAccessory',
      'legLeft',
      'legRight',
      'torso',
      'armLeft',
      'head',
      'armRight',
    ] as const;

    for (const bossRig of [
      SPORE_KING_RIG_DEF,
      KRYSSA_ICE_QUEEN_RIG_DEF,
      FORGE_TITAN_RIG_DEF,
    ]) {
      for (const partId of primaryPartIds) {
        const part = bossRig.parts.find((p) => p.id === partId);
        expect(part, `${bossRig.id}.${partId}`).toBeDefined();
        const firstOutlined = part!.shapes.find((s) => s.kind !== 'detailStroke');
        expect(firstOutlined, `${bossRig.id}.${partId} first shape`).toBeDefined();
        if (firstOutlined && firstOutlined.kind !== 'detailStroke') {
          expect(
            firstOutlined.style.outlineWidth,
            `${bossRig.id}.${partId} outlineWidth`,
          ).toBe(BOSS_OUTLINE_WIDTH);
        }
      }
    }

    // Clone & standard hero/enemy rigs use default 2.5u outlineWidth (undefined -> STANDARD_OUTLINE_WIDTH)
    for (const stdRig of [VANGUARD_RIG_DEF, GOBLIN_SHOOTER_RIG_DEF, KRYSSA_CLONE_RIG_DEF]) {
      const torsoPart = stdRig.parts.find((p) => p.id === 'torso')!;
      const firstShape = torsoPart.shapes[0]!;
      if (firstShape.kind !== 'detailStroke') {
        expect(firstShape.style.outlineWidth ?? STANDARD_OUTLINE_WIDTH).toBe(
          STANDARD_OUTLINE_WIDTH,
        );
      }
    }
  });

  it('10. selects full 8-part enemy rigs at High/Medium quality in normal rooms and fastComposite at Low or stress test', () => {
    // High & Medium in normal rooms (even with 25-36 enemies) -> full 8-part rig (fastComposite = false)
    expect(
      shouldUseEnemyFastComposite({
        quality: 'high',
        stressTestActive: false,
        enemyCount: 32,
        distFromCamera: 180,
      }),
    ).toBe(false);
    expect(
      shouldUseEnemyFastComposite({
        quality: 'medium',
        stressTestActive: false,
        enemyCount: 36,
        distFromCamera: 260,
      }),
    ).toBe(false);

    // Low quality or stress test -> fastComposite = true
    expect(
      shouldUseEnemyFastComposite({
        quality: 'low',
        stressTestActive: false,
        enemyCount: 6,
        distFromCamera: 80,
      }),
    ).toBe(true);
    expect(
      shouldUseEnemyFastComposite({
        quality: 'high',
        stressTestActive: true,
        enemyCount: 80,
        distFromCamera: 100,
      }),
    ).toBe(true);

    // Distance LOD fallback when enemyCount > 40 and far from camera (> 420u)
    expect(
      shouldUseEnemyFastComposite({
        quality: 'high',
        stressTestActive: false,
        enemyCount: 45,
        distFromCamera: 460,
      }),
    ).toBe(true);
    expect(
      shouldUseEnemyFastComposite({
        quality: 'high',
        stressTestActive: false,
        enemyCount: 45,
        distFromCamera: 220,
      }),
    ).toBe(false);
  });

  it('11. emits running footstep dust deterministically on 0.19s half-stride boundaries for ground units only', () => {
    // Crossing 0.19s boundary while moving on ground -> emits
    expect(shouldEmitFootstepDust(0.16, 0.20, true, false, false)).toBe(true);
    // Within same half-stride -> does not emit
    expect(shouldEmitFootstepDust(0.20, 0.26, true, false, false)).toBe(false);
    // Crossing 0.38s boundary -> emits
    expect(shouldEmitFootstepDust(0.36, 0.40, true, false, false)).toBe(true);

    // Idle, flying, or stress test -> never emits
    expect(shouldEmitFootstepDust(0.16, 0.20, false, false, false)).toBe(false);
    expect(shouldEmitFootstepDust(0.16, 0.20, true, true, false)).toBe(false);
    expect(shouldEmitFootstepDust(0.16, 0.20, true, 'frost_bat', false)).toBe(false);
    expect(shouldEmitFootstepDust(0.16, 0.20, true, 'snow_spirit', false)).toBe(false);
    expect(shouldEmitFootstepDust(0.16, 0.20, true, 'welder_drone', false)).toBe(false);
    expect(shouldEmitFootstepDust(0.16, 0.20, true, false, true)).toBe(false);
  });
});
