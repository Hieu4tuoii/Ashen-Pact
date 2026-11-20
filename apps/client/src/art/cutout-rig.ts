import Phaser from 'phaser';
import {
  type BackAccessorySpringState,
  type BackAccessorySpringStepParams,
  blendRigPoseSnapshots,
  computeEnemyArchetypeMotion,
  computeMeleeSwingArcOffset,
  createBackAccessorySpringState,
  createEmptyRigPoseSnapshot,
  createStateCrossfadeController,
  createWeaponRecoilSpringState,
  type EnemyArchetypeMotionModifiers,
  type EvaluateRigPoseParams,
  evaluateRigPose,
  resolveHitFlashTint,
  type RigAnimState,
  type RigPoseSnapshot,
  type StateCrossfadeController,
  stepBackAccessorySpringInPlace,
  stepMeleeLungeGlideOffsetInPlace,
  stepStateCrossfade,
  stepTorsoMoveLean,
  stepWeaponRecoilSpringInPlace,
  transitionRigAnimState,
  triggerWeaponRecoilImpulseInPlace,
  type WeaponRecoilSpringState,
} from './cutout-rig-math.js';
import { easeOutBack } from './easing.js';
import {
  type EntityRigDef,
  type RigPartDef,
  type RigPartId,
  WEAPON_VECTOR_DEFS,
} from './rig-defs.js';
import { TextureBaker } from './texture-baker.js';

export type { RigAnimState };

export interface CutoutRigOptions {
  playerSlot?: 1 | 2 | 3 | 4 | null;
  displayScale?: number;
  initialPhaseOffset?: number;
  fastComposite?: boolean;
  isBoss?: boolean;
}

function hashRigId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 100) * 0.017;
}

function createBoundSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  logicalKey: string,
): Phaser.GameObjects.Sprite {
  const binding = TextureBaker.resolveAtlasBinding(scene, logicalKey);
  return binding.frameName !== undefined
    ? scene.add.sprite(x, y, binding.textureKey, binding.frameName)
    : scene.add.sprite(x, y, binding.textureKey);
}

function applyBoundTexture(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  logicalKey: string,
): void {
  const binding = TextureBaker.resolveAtlasBinding(scene, logicalKey);
  if (binding.frameName !== undefined) {
    sprite.setTexture(binding.textureKey, binding.frameName);
  } else {
    sprite.setTexture(binding.textureKey);
  }
}

function canApplyWeaponBinding(
  scene: Phaser.Scene,
  binding: { textureKey: string; frameName?: string },
): boolean {
  return (
    binding.frameName !== undefined ||
    typeof scene.textures?.exists !== 'function' ||
    scene.textures.exists(binding.textureKey)
  );
}

/**
 * CutoutRig assembles pre-baked procedural vector part textures into a Phaser Container
 * and animates them parametrically at 60+ FPS using sin/cosine/spring/crossfade curves
 * (zero per-frame Graphics redraws).
 */
export class CutoutRig {
  public readonly container: Phaser.GameObjects.Container;
  public readonly bodyContainer: Phaser.GameObjects.Container;
  public def: EntityRigDef;

  private readonly scene: Phaser.Scene;
  private readonly partSprites = new Map<RigPartId, Phaser.GameObjects.Sprite>();
  private readonly partSpriteList: Array<{ partId: RigPartId; sprite: Phaser.GameObjects.Sprite }> =
    [];
  private readonly partDefs = new Map<RigPartId, RigPartDef>();
  private shadowSprite: Phaser.GameObjects.Sprite;
  private compositeSprite: Phaser.GameObjects.Sprite | null = null;
  private playerRingSprite: Phaser.GameObjects.Sprite | null = null;
  private fastComposite = false;
  private isBoss = false;

  private animState: RigAnimState = 'idle';
  private lifeState: 'alive' | 'downed' | 'ghost' = 'alive';
  private animTime = 0;
  private phaseSeed = 0;
  private aimAngleRad = 0;
  private facingSign = 1;
  private displayScale = 1;
  private playerSlot: 1 | 2 | 3 | 4 | null;
  private equippedWeaponId: string | null = null;

  // Cutout 2.0 locomotion, spring secondary motion, and zero-alloc crossfade scratch states
  private moveVx = 0;
  private moveVy = 0;
  private moveLeanRad = 0;
  private prevBodyY = 0;
  private crossfadeCtrl: StateCrossfadeController = createStateCrossfadeController('idle');
  private lastBlendedPose: RigPoseSnapshot | null = null;
  private readonly poseScratch: RigPoseSnapshot = createEmptyRigPoseSnapshot();
  private readonly blendFromScratch: RigPoseSnapshot = createEmptyRigPoseSnapshot();
  private readonly blendedPoseScratch: RigPoseSnapshot = createEmptyRigPoseSnapshot();
  private readonly archMotionScratch: EnemyArchetypeMotionModifiers = {
    scaleXMult: 1,
    scaleYMult: 1,
    bodyYOffset: 0,
    telegraphTorsoRotOffset: 0,
    telegraphArmRaiseOffset: 0,
    cadenceMult: 1,
    strideBounceMult: 1,
  };
  private backSpring: BackAccessorySpringState = createBackAccessorySpringState();
  private recoilSpring: WeaponRecoilSpringState = createWeaponRecoilSpringState();
  private readonly backSpringParamsScratch: BackAccessorySpringStepParams = {
    moveVx: 0,
    moveVy: 0,
    bodyBounceVelY: 0,
    facingSign: 1,
    isDashing: false,
    animState: 'idle',
    dtSec: 0,
  };
  private readonly poseParamsScratch: EvaluateRigPoseParams;

  // Combat & Game Feel states
  private recoilTimer = 0;
  private recoilStrength = 4;
  private meleeSwingTimer = 0;
  private meleeSwingDir = 1;
  private readonly lungeOffset = { x: 0, y: 0 };
  private hitFlashTimer = 0;
  private hitFlashCooldownTimer = 0;
  private hitFlashTint = 0xFFFBEB;
  private castPoseTimer = 0;
  private reviveProgress = 0;
  private isDashing = false;
  private telegraphProgress = 0; // 0 = none, (0..1] = active telegraph progress
  private spawnProgress = 1; // 1 = fully spawned
  private elementalStatusTint: number | null = null;

  // Cached tint state to eliminate redundant per-frame clearTint/setTint calls across all 8 sprites
  private lastTintMode: 'none' | 'hit_flash' | 'full_tint' | 'foot_frost' = 'none';
  private lastAppliedTint: number | null = null;
  private lastChilledFoot: number | null = null;
  private lastSilhouetteInverted: number | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    def: EntityRigDef,
    options: CutoutRigOptions = {},
  ) {
    this.scene = scene;
    this.def = def;
    this.displayScale = options.displayScale ?? 1;
    this.playerSlot = options.playerSlot ?? null;
    this.animTime = options.initialPhaseOffset ?? 0;
    this.phaseSeed = (options.initialPhaseOffset ?? 0) + hashRigId(def.id);
    this.fastComposite = options.fastComposite ?? false;
    this.isBoss =
      options.isBoss ??
      (def.id === 'spore_king' || def.id === 'kryssa_ice_queen' || def.id === 'forge_titan');
    this.poseParamsScratch = {
      def,
      animState: 'idle',
      animTime: this.animTime,
      localAim: 0,
      moveLeanRad: 0,
      recoilSpring: this.recoilSpring,
      backSpring: this.backSpring,
      meleeSwingOffsetRad: 0,
      telegraphProgress: 0,
      reviveProgress: 0,
      phaseSeed: this.phaseSeed,
    };

    this.container = scene.add.container(x, y);
    this.bodyContainer = scene.add.container(0, 0);

    const invBake = 1 / TextureBaker.getBakeScale();

    // 1. Optional Player Identification Ring (P1-P4)
    if (this.playerSlot) {
      this.playerRingSprite = createBoundSprite(
        scene,
        0,
        1,
        TextureBaker.getPlayerRingTextureKey(this.playerSlot),
      );
      this.playerRingSprite.setScale(invBake);
      this.container.add(this.playerRingSprite);
    }

    // 2. Elliptical Ground Shadow
    this.shadowSprite = createBoundSprite(scene, 0, 0, TextureBaker.getShadowTextureKey(def.id));
    this.shadowSprite.setScale(invBake);
    if (!this.fastComposite) {
      this.container.add(this.shadowSprite);
    } else {
      this.shadowSprite.setVisible(false);
      this.shadowSprite.setActive(false);
    }

    // 3. Sorted Cutout Parts (or single pre-baked composite sprite in fastComposite swarm mode)
    if (this.fastComposite) {
      const compInvBake = 1 / Math.min(2, TextureBaker.getBakeScale());
      this.compositeSprite = createBoundSprite(
        scene,
        0,
        0,
        TextureBaker.getFullRigTextureKey(def.id),
      );
      this.compositeSprite.setOrigin(0.5, 0.78);
      this.compositeSprite.setScale(compInvBake);
      this.container.add(this.compositeSprite);
      this.bodyContainer.setVisible(false);
    } else {
      const sortedParts = [...def.parts].sort((a, b) => a.zIndex - b.zIndex);
      for (const part of sortedParts) {
        const sprite = createBoundSprite(
          scene,
          part.offsetX,
          part.offsetY,
          TextureBaker.getPartTextureKey(def.id, part.id),
        );
        sprite.setOrigin(part.originX, part.originY);
        sprite.setScale(invBake);
        this.bodyContainer.add(sprite);
        this.partSprites.set(part.id, sprite);
        this.partSpriteList.push({ partId: part.id, sprite });
        this.partDefs.set(part.id, part);
      }
      this.container.add(this.bodyContainer);
    }

    this.container.setScale(this.displayScale);
  }

  public isFastComposite(): boolean {
    return this.fastComposite;
  }

  public setAnimState(state: RigAnimState): void {
    this.animState = state;
  }

  public getAnimState(): RigAnimState {
    return this.animState;
  }

  public getAnimTime(): number {
    return this.animTime;
  }

  public getCrossfadeAlpha(): number {
    if (!this.crossfadeCtrl.fromPose) return 1;
    const raw =
      this.crossfadeCtrl.crossfadeDurationSec > 0
        ? this.crossfadeCtrl.crossfadeElapsedSec / this.crossfadeCtrl.crossfadeDurationSec
        : 1;
    return Math.max(0, Math.min(1, raw));
  }

  public setMoveVelocity(vx: number, vy: number): void {
    this.moveVx = vx;
    this.moveVy = vy;
  }

  public getMoveLeanRad(): number {
    return this.moveLeanRad;
  }

  public getEyeBlinkScaleY(): number {
    return this.lastBlendedPose?.eyeBlinkScaleY ?? 1;
  }

  public triggerCastPose(durationSec = 0.42): void {
    this.castPoseTimer = durationSec <= 0 ? 0 : Math.max(this.castPoseTimer, durationSec);
  }

  public setReviveProgress(progress01: number): void {
    this.reviveProgress = Math.max(0, Math.min(1, progress01));
  }

  public setEquippedWeapon(weaponId: string): void {
    if (this.equippedWeaponId === weaponId) return;
    this.equippedWeaponId = weaponId;
    const weaponSprite = this.partSprites.get('weapon');
    const weaponVec = WEAPON_VECTOR_DEFS[weaponId];
    if (weaponSprite && weaponVec) {
      const key = TextureBaker.getWeaponTextureKey(weaponId);
      const binding = TextureBaker.resolveAtlasBinding(this.scene, key);
      if (canApplyWeaponBinding(this.scene, binding)) {
        if (binding.frameName !== undefined) {
          weaponSprite.setTexture(binding.textureKey, binding.frameName);
        } else {
          weaponSprite.setTexture(binding.textureKey);
        }
        weaponSprite.setOrigin(weaponVec.originX, weaponVec.originY);
      }
    }
  }

  public triggerRecoil(strength = 5): void {
    this.recoilTimer = 0.12;
    this.recoilStrength = strength;
    triggerWeaponRecoilImpulseInPlace(this.recoilSpring, strength);
  }

  public triggerMeleeSwing(lungeDx = 0, lungeDy = 0): void {
    this.meleeSwingTimer = 0.2;
    this.meleeSwingDir = -this.meleeSwingDir;
    if (Math.hypot(lungeDx, lungeDy) > 0.5) {
      this.lungeOffset.x = Math.max(-110, Math.min(110, this.lungeOffset.x - lungeDx));
      this.lungeOffset.y = Math.max(-110, Math.min(110, this.lungeOffset.y - lungeDy));
    } else {
      this.lungeOffset.x = Math.max(
        -48,
        Math.min(48, this.lungeOffset.x - Math.cos(this.aimAngleRad) * 6),
      );
      this.lungeOffset.y = Math.max(
        -48,
        Math.min(48, this.lungeOffset.y - Math.sin(this.aimAngleRad) * 6),
      );
    }
  }

  public stepLungeOffset(dtSec: number): void {
    if (this.lungeOffset.x === 0 && this.lungeOffset.y === 0) return;
    stepMeleeLungeGlideOffsetInPlace(this.lungeOffset, dtSec);
  }

  public getLungeOffset(): { x: number; y: number } {
    return this.lungeOffset;
  }

  public triggerHitFlash(durationSec = 0.034, tintColor?: number): void {
    const resolvedTint =
      tintColor ?? resolveHitFlashTint({ isPlayer: this.playerSlot !== null });
    if (this.hitFlashCooldownTimer > 0) {
      if (this.hitFlashTimer > 0 && tintColor !== undefined) {
        this.hitFlashTint = resolvedTint;
      }
      return;
    }
    this.hitFlashTint = resolvedTint;
    if (this.isBoss) {
      this.hitFlashTimer = Math.min(durationSec, 0.034);
      this.hitFlashCooldownTimer = 0.22;
    } else if (this.playerSlot !== null) {
      this.hitFlashTimer = Math.max(this.hitFlashTimer, durationSec);
      this.hitFlashCooldownTimer = 0.08;
    } else {
      this.hitFlashTimer = Math.min(durationSec, 0.034);
      this.hitFlashCooldownTimer = 0.15;
    }
  }

  public setDashActive(active: boolean): void {
    this.isDashing = active;
  }

  public setTelegraphProgress(progress01: number): void {
    this.telegraphProgress = Math.max(0, Math.min(1, progress01));
  }

  public setSpawnProgress(progress01: number): void {
    this.spawnProgress = Math.max(0, Math.min(1, progress01));
  }

  public setPlayerSlot(slot: 1 | 2 | 3 | 4 | null): void {
    this.playerSlot = slot;
    const invBake = 1 / TextureBaker.getBakeScale();
    if (!slot) {
      if (this.playerRingSprite) {
        this.playerRingSprite.setVisible(false);
      }
      return;
    }

    const key = TextureBaker.getPlayerRingTextureKey(slot);
    if (!this.playerRingSprite) {
      this.playerRingSprite = createBoundSprite(this.scene, 0, 1, key);
      this.playerRingSprite.setScale(invBake);
      this.container.addAt(this.playerRingSprite, 0);
    } else {
      applyBoundTexture(this.scene, this.playerRingSprite, key);
      this.playerRingSprite.setScale(invBake);
      this.playerRingSprite.setVisible(true);
    }
  }

  public setAimAngle(angleRad: number): void {
    this.aimAngleRad = angleRad;
    const cos = Math.cos(angleRad);
    if (Math.abs(cos) > 0.05) {
      this.facingSign = cos >= 0 ? 1 : -1;
    }
  }

  public getFacingSign(): number {
    return this.facingSign;
  }

  public setElementalStatusTint(color: number | null): void {
    this.elementalStatusTint = color;
  }

  public setLifeState(state: 'alive' | 'downed' | 'ghost'): void {
    this.lifeState = state;
  }

  public setShadowVisible(visible: boolean): void {
    if (!this.fastComposite) {
      this.shadowSprite.setVisible(visible);
    }
  }

  public setRigDef(def: EntityRigDef): void {
    if (this.def.id === def.id) return;
    this.def = def;
    this.poseParamsScratch.def = def;
    this.partDefs.clear();
    for (const part of def.parts) {
      this.partDefs.set(part.id, part);
      const sprite = this.partSprites.get(part.id);
      if (sprite) {
        sprite.setOrigin(part.originX, part.originY);
        sprite.setPosition(part.offsetX, part.offsetY);
      }
    }
    this.lastBlendedPose = null;
    this.refreshBakedTextures();
  }

  public refreshBakedTextures(): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    const compInvBake = 1 / Math.min(2, TextureBaker.getBakeScale());
    applyBoundTexture(this.scene, this.shadowSprite, TextureBaker.getShadowTextureKey(this.def.id));
    this.shadowSprite.setScale(invBake);
    if (this.playerRingSprite && this.playerSlot) {
      applyBoundTexture(
        this.scene,
        this.playerRingSprite,
        TextureBaker.getPlayerRingTextureKey(this.playerSlot),
      );
      this.playerRingSprite.setScale(invBake);
    }
    if (this.compositeSprite) {
      applyBoundTexture(
        this.scene,
        this.compositeSprite,
        TextureBaker.getFullRigTextureKey(this.def.id),
      );
      this.compositeSprite.setScale(compInvBake);
    }
    for (let i = 0; i < this.partSpriteList.length; i++) {
      const { partId, sprite } = this.partSpriteList[i]!;
      if (partId === 'weapon' && this.equippedWeaponId) {
        const wKey = TextureBaker.getWeaponTextureKey(this.equippedWeaponId);
        const wBinding = TextureBaker.resolveAtlasBinding(this.scene, wKey);
        if (canApplyWeaponBinding(this.scene, wBinding)) {
          if (wBinding.frameName !== undefined) {
            sprite.setTexture(wBinding.textureKey, wBinding.frameName);
          } else {
            sprite.setTexture(wBinding.textureKey);
          }
          sprite.setScale(invBake);
          continue;
        }
      }
      applyBoundTexture(
        this.scene,
        sprite,
        TextureBaker.getPartTextureKey(this.def.id, partId),
      );
      sprite.setScale(invBake);
    }
  }

  private resolveEffectiveAnimState(): RigAnimState {
    if (this.lifeState === 'downed') {
      return this.reviveProgress > 0.02 ? 'revive' : 'downed';
    }
    if (this.animState !== 'idle' && this.animState !== 'run') {
      return this.animState;
    }
    if (!this.isBoss && this.hitFlashTimer > 0.02) return 'hurt';
    if (this.isDashing) return 'dash';
    if (this.castPoseTimer > 0) return 'cast';
    if (this.meleeSwingTimer > 0.02) return 'attack';
    return this.animState;
  }

  /**
   * Lightweight offscreen clock step that advances timers and springs in place
   * without running `evaluateRigPose` or mutating Phaser Sprite transforms.
   */
  public advanceClockOnly(dtSec: number): void {
    this.animTime += dtSec;

    if (this.recoilTimer > 0) this.recoilTimer = Math.max(0, this.recoilTimer - dtSec);
    if (this.meleeSwingTimer > 0) this.meleeSwingTimer = Math.max(0, this.meleeSwingTimer - dtSec);
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dtSec);
    if (this.hitFlashCooldownTimer > 0) {
      this.hitFlashCooldownTimer = Math.max(0, this.hitFlashCooldownTimer - dtSec);
    }
    if (this.castPoseTimer > 0) this.castPoseTimer = Math.max(0, this.castPoseTimer - dtSec);

    const effectiveState = this.resolveEffectiveAnimState();
    if (effectiveState !== this.crossfadeCtrl.currentState) {
      this.crossfadeCtrl.currentState = effectiveState;
      this.crossfadeCtrl.prevState = effectiveState;
      this.crossfadeCtrl.fromPose = null;
      this.crossfadeCtrl.crossfadeElapsedSec = this.crossfadeCtrl.crossfadeDurationSec;
    }
    stepStateCrossfade(this.crossfadeCtrl, dtSec);

    const effectiveMoveVx =
      Math.abs(this.moveVx) > 0.1
        ? this.moveVx
        : effectiveState === 'run' || effectiveState === 'dash'
          ? 145 * this.facingSign
          : 0;
    const localMoveDirX = (effectiveMoveVx / 160) * this.facingSign;
    this.moveLeanRad = stepTorsoMoveLean(this.moveLeanRad, localMoveDirX, dtSec);

    if (this.recoilTimer > 0 && this.recoilSpring.displacement < 0.2) {
      triggerWeaponRecoilImpulseInPlace(this.recoilSpring, this.recoilStrength);
    }
    stepWeaponRecoilSpringInPlace(this.recoilSpring, dtSec);

    this.backSpringParamsScratch.moveVx = effectiveMoveVx;
    this.backSpringParamsScratch.moveVy = this.moveVy;
    this.backSpringParamsScratch.bodyBounceVelY = 0;
    this.backSpringParamsScratch.facingSign = this.facingSign;
    this.backSpringParamsScratch.isDashing = this.isDashing || effectiveState === 'dash';
    this.backSpringParamsScratch.animState = effectiveState;
    this.backSpringParamsScratch.dtSec = dtSec;
    stepBackAccessorySpringInPlace(this.backSpring, this.backSpringParamsScratch);
  }

  /**
   * Parametric Cutout 2.0 animation update with 0.12s state crossfade, moveDirX torso lean,
   * deterministic 3-5s eye blink, head/eye aim tracking, spring backAccessory, and 100% weapon aim.
   */
  public update(dtSec: number): void {
    this.animTime += dtSec;
    const invBake = 1 / TextureBaker.getBakeScale();

    if (this.recoilTimer > 0) this.recoilTimer = Math.max(0, this.recoilTimer - dtSec);
    if (this.meleeSwingTimer > 0) this.meleeSwingTimer = Math.max(0, this.meleeSwingTimer - dtSec);
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dtSec);
    if (this.hitFlashCooldownTimer > 0) {
      this.hitFlashCooldownTimer = Math.max(0, this.hitFlashCooldownTimer - dtSec);
    }
    if (this.castPoseTimer > 0) this.castPoseTimer = Math.max(0, this.castPoseTimer - dtSec);

    this.applyHitFlashAndStatusVisuals();

    const spawnScale = this.spawnProgress < 1 ? easeOutBack(this.spawnProgress) : 1;
    const hitPunch =
      this.hitFlashTimer > 0
        ? 1 + (this.hitFlashTimer / 0.12) * (this.isBoss ? 0.035 : 0.1)
        : 1;
    const effectiveState = this.resolveEffectiveAnimState();

    if (this.fastComposite && this.compositeSprite) {
      const compInvBake = 1 / Math.min(2, TextureBaker.getBakeScale());
      const arch = computeEnemyArchetypeMotion(
        this.def.id,
        effectiveState,
        this.animTime,
        this.telegraphProgress,
        this.archMotionScratch,
      );
      const dashStretchX = this.isDashing || effectiveState === 'dash' ? 1.14 : 1;
      const dashSquashY = this.isDashing || effectiveState === 'dash' ? 0.88 : 1;
      const nextSx =
        compInvBake * this.facingSign * spawnScale * hitPunch * dashStretchX * arch.scaleXMult;
      const nextSy = compInvBake * spawnScale * hitPunch * dashSquashY * arch.scaleYMult;
      const nextAlpha = this.spawnProgress < 1 ? 0.35 + this.spawnProgress * 0.65 : 1;
      let nextY: number;
      if (effectiveState === 'idle') {
        const s = Math.sin(this.animTime * ((Math.PI * 2) / 1.6));
        nextY = arch.bodyYOffset + s * 1.1;
      } else {
        const phase = this.animTime * ((Math.PI * 2) / 0.38) * arch.cadenceMult;
        nextY = arch.bodyYOffset - Math.abs(Math.sin(phase)) * 3.0 * arch.strideBounceMult;
      }
      if (!(Math.abs(this.compositeSprite.scaleX - nextSx) <= 1e-4)) {
        this.compositeSprite.scaleX = nextSx;
      }
      if (!(Math.abs(this.compositeSprite.scaleY - nextSy) <= 1e-4)) {
        this.compositeSprite.scaleY = nextSy;
      }
      if (!(Math.abs(this.compositeSprite.alpha - nextAlpha) <= 1e-4)) {
        this.compositeSprite.alpha = nextAlpha;
      }
      if (!(Math.abs(this.compositeSprite.y - nextY) <= 1e-4)) {
        this.compositeSprite.y = nextY;
      }
      return;
    }

    if (effectiveState !== this.crossfadeCtrl.currentState) {
      if (this.lastBlendedPose) {
        transitionRigAnimState(
          this.crossfadeCtrl,
          effectiveState,
          this.lastBlendedPose,
          this.blendFromScratch,
        );
      } else {
        this.crossfadeCtrl.currentState = effectiveState;
        this.crossfadeCtrl.prevState = effectiveState;
      }
    }

    const localAim =
      this.facingSign >= 0
        ? this.aimAngleRad
        : Math.atan2(Math.sin(this.aimAngleRad), -Math.cos(this.aimAngleRad));

    const effectiveMoveVx =
      Math.abs(this.moveVx) > 0.1
        ? this.moveVx
        : effectiveState === 'run' || effectiveState === 'dash'
          ? 145 * this.facingSign
          : 0;
    const localMoveDirX = (effectiveMoveVx / 160) * this.facingSign;
    this.moveLeanRad = stepTorsoMoveLean(this.moveLeanRad, localMoveDirX, dtSec);

    if (this.recoilTimer > 0 && this.recoilSpring.displacement < 0.2) {
      triggerWeaponRecoilImpulseInPlace(this.recoilSpring, this.recoilStrength);
    }
    stepWeaponRecoilSpringInPlace(this.recoilSpring, dtSec);

    const prevLastBodyY = this.lastBlendedPose ? this.lastBlendedPose.bodyY : null;
    const bodyBounceVelY =
      dtSec > 1e-4 && prevLastBodyY !== null ? (prevLastBodyY - this.prevBodyY) / dtSec : 0;
    this.backSpringParamsScratch.moveVx = effectiveMoveVx;
    this.backSpringParamsScratch.moveVy = this.moveVy;
    this.backSpringParamsScratch.bodyBounceVelY = bodyBounceVelY;
    this.backSpringParamsScratch.facingSign = this.facingSign;
    this.backSpringParamsScratch.isDashing = this.isDashing || effectiveState === 'dash';
    this.backSpringParamsScratch.animState = effectiveState;
    this.backSpringParamsScratch.dtSec = dtSec;
    stepBackAccessorySpringInPlace(this.backSpring, this.backSpringParamsScratch);

    let swingAngleOffset = 0;
    if (this.meleeSwingTimer > 0) {
      const p = 1 - this.meleeSwingTimer / 0.2;
      swingAngleOffset = computeMeleeSwingArcOffset(p, this.meleeSwingDir);
    }

    const poseParams = this.poseParamsScratch;
    poseParams.def = this.def;
    poseParams.animState = effectiveState;
    poseParams.animTime = this.animTime;
    poseParams.localAim = localAim;
    poseParams.moveLeanRad = this.moveLeanRad;
    poseParams.meleeSwingOffsetRad = swingAngleOffset;
    poseParams.telegraphProgress = this.telegraphProgress;
    poseParams.reviveProgress = this.reviveProgress;
    poseParams.phaseSeed = this.phaseSeed;

    const targetPose = evaluateRigPose(poseParams, this.poseScratch);

    const alpha = stepStateCrossfade(this.crossfadeCtrl, dtSec);
    const pose =
      this.crossfadeCtrl.fromPose && alpha < 1
        ? blendRigPoseSnapshots(
            this.crossfadeCtrl.fromPose,
            targetPose,
            alpha,
            this.blendedPoseScratch,
          )
        : targetPose;

    this.prevBodyY = prevLastBodyY ?? pose.bodyY;
    this.lastBlendedPose = pose;

    this.applyPoseSnapshot(pose, invBake, spawnScale, hitPunch, effectiveState);
  }

  private applyPoseSnapshot(
    pose: RigPoseSnapshot,
    invBake: number,
    spawnScale: number,
    hitPunch: number,
    effectiveState: RigAnimState,
  ): void {
    const nextBodyScaleX = this.facingSign * spawnScale * hitPunch * pose.bodyScaleX;
    const nextBodyScaleY = spawnScale * hitPunch * pose.bodyScaleY;
    const nextBodyRot = pose.bodyRotation * this.facingSign;
    if (!(Math.abs(this.bodyContainer.y - pose.bodyY) <= 1e-4)) {
      this.bodyContainer.y = pose.bodyY;
    }
    if (!(Math.abs(this.bodyContainer.scaleX - nextBodyScaleX) <= 1e-4)) {
      this.bodyContainer.scaleX = nextBodyScaleX;
    }
    if (!(Math.abs(this.bodyContainer.scaleY - nextBodyScaleY) <= 1e-4)) {
      this.bodyContainer.scaleY = nextBodyScaleY;
    }
    if (!(Math.abs(this.bodyContainer.rotation - nextBodyRot) <= 1e-4)) {
      this.bodyContainer.rotation = nextBodyRot;
    }

    const baseAlpha = this.spawnProgress < 1 ? 0.35 + this.spawnProgress * 0.65 : 1;
    const nextAlpha =
      this.lifeState === 'ghost' ? 0.52 + Math.sin(this.animTime * 4) * 0.08 : baseAlpha;
    if (!(Math.abs(this.bodyContainer.alpha - nextAlpha) <= 1e-4)) {
      this.bodyContainer.alpha = nextAlpha;
    }

    const nextShadowScale = invBake * pose.shadowScale;
    if (!(Math.abs(this.shadowSprite.scaleX - nextShadowScale) <= 1e-4)) {
      this.shadowSprite.scaleX = nextShadowScale;
    }
    if (!(Math.abs(this.shadowSprite.scaleY - nextShadowScale) <= 1e-4)) {
      this.shadowSprite.scaleY = nextShadowScale;
    }

    if (this.playerRingSprite && this.playerRingSprite.visible) {
      const castRingMult =
        effectiveState === 'cast' ? 1.12 + Math.sin(this.animTime * 10) * 0.06 : 1.0;
      const ringScale = invBake * castRingMult;
      if (!(Math.abs(this.playerRingSprite.scaleX - ringScale) <= 1e-4)) {
        this.playerRingSprite.setScale(ringScale);
      }
    }

    for (let i = 0; i < this.partSpriteList.length; i++) {
      const { partId, sprite } = this.partSpriteList[i]!;
      const pt = pose.parts[partId];
      const nextSx = invBake * pt.scaleX;
      const nextSy = invBake * pt.scaleY;
      if (!(Math.abs(sprite.x - pt.x) <= 1e-4)) sprite.x = pt.x;
      if (!(Math.abs(sprite.y - pt.y) <= 1e-4)) sprite.y = pt.y;
      if (!(Math.abs(sprite.rotation - pt.rotation) <= 1e-4)) sprite.rotation = pt.rotation;
      if (!(Math.abs(sprite.scaleX - nextSx) <= 1e-4)) sprite.scaleX = nextSx;
      if (!(Math.abs(sprite.scaleY - nextSy) <= 1e-4)) sprite.scaleY = nextSy;
    }
  }

  private applyHitFlashAndStatusVisuals(): void {
    const shouldTintHit = this.hitFlashTimer > 0;
    const shouldFlashTelegraph =
      !shouldTintHit && this.telegraphProgress > 0 && Math.floor(this.animTime * 18) % 2 === 0;

    if (shouldTintHit) {
      if (
        this.lastSilhouetteInverted === null &&
        this.lastTintMode === 'hit_flash' &&
        this.lastAppliedTint === this.hitFlashTint
      ) {
        return;
      }
      this.applyHitFlashTint();
      this.lastTintMode = 'hit_flash';
      this.lastAppliedTint = this.hitFlashTint;
      this.lastChilledFoot = null;
      this.lastSilhouetteInverted = null;
      return;
    }

    if (shouldFlashTelegraph || this.lifeState === 'downed' || this.lifeState === 'ghost') {
      const fullColor = shouldFlashTelegraph
        ? 0xff9e64
        : this.lifeState === 'downed'
          ? Math.floor(this.animTime * 6) % 2 === 0
            ? 0xf7768e
            : 0xff9e64
          : 0x7dcfff;
      if (
        this.lastSilhouetteInverted === null &&
        this.lastTintMode === 'full_tint' &&
        this.lastAppliedTint === fullColor
      ) {
        return;
      }
      this.applyMultiplicativeTint(fullColor);
      this.lastTintMode = 'full_tint';
      this.lastAppliedTint = fullColor;
      this.lastChilledFoot = null;
      this.lastSilhouetteInverted = null;
      return;
    }

    if (this.elementalStatusTint !== null) {
      if (
        this.lastSilhouetteInverted === null &&
        this.lastTintMode === 'foot_frost' &&
        this.lastChilledFoot === this.elementalStatusTint
      ) {
        return;
      }
      if (this.lastTintMode !== 'none' || this.lastSilhouetteInverted !== null) {
        this.clearPartTints();
      }
      this.applyFootFrostTint(this.elementalStatusTint);
      this.lastTintMode = 'foot_frost';
      this.lastAppliedTint = null;
      this.lastChilledFoot = this.elementalStatusTint;
      this.lastSilhouetteInverted = null;
      return;
    }

    if (this.lastTintMode !== 'none' || this.lastSilhouetteInverted !== null) {
      this.clearPartTints();
      this.lastTintMode = 'none';
      this.lastAppliedTint = null;
      this.lastChilledFoot = null;
      this.lastSilhouetteInverted = null;
    }
  }

  private applyHitFlashTint(): void {
    if (this.compositeSprite) {
      this.compositeSprite.setTint(this.hitFlashTint);
    }
    for (let i = 0; i < this.partSpriteList.length; i++) {
      const { partId, sprite } = this.partSpriteList[i]!;
      if (partId === 'torso' || partId === 'head') {
        sprite.setTint(this.hitFlashTint);
      } else {
        sprite.clearTint();
      }
    }
  }

  private applyFootFrostTint(color: number): void {
    if (this.compositeSprite) {
      this.compositeSprite.clearTint();
    }
    const legLeft = this.partSprites.get('legLeft');
    if (legLeft) legLeft.setTint(color);
    const legRight = this.partSprites.get('legRight');
    if (legRight) legRight.setTint(color);
  }

  private applyMultiplicativeTint(color: number): void {
    if (this.compositeSprite) {
      this.compositeSprite.setTint(color);
    }
    for (let i = 0; i < this.partSpriteList.length; i++) {
      this.partSpriteList[i]!.sprite.setTint(color);
    }
  }

  private clearPartTints(): void {
    if (this.compositeSprite) {
      this.compositeSprite.clearTint();
    }
    for (let i = 0; i < this.partSpriteList.length; i++) {
      this.partSpriteList[i]!.sprite.clearTint();
    }
  }

  public applySilhouetteInversion(color = 0x141019): void {
    if (this.lastSilhouetteInverted === color) return;
    if (this.compositeSprite) {
      if (typeof this.compositeSprite.setTintFill === 'function') {
        this.compositeSprite.setTintFill(color);
      } else {
        this.compositeSprite.setTint(color);
      }
    }
    for (let i = 0; i < this.partSpriteList.length; i++) {
      const sprite = this.partSpriteList[i]!.sprite;
      if (typeof sprite.setTintFill === 'function') {
        sprite.setTintFill(color);
      } else {
        sprite.setTint(color);
      }
    }
    this.lastSilhouetteInverted = color;
    this.lastTintMode = 'none';
    this.lastAppliedTint = null;
    this.lastChilledFoot = null;
  }

  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  public destroy(): void {
    if (this.fastComposite) {
      this.shadowSprite.destroy();
      this.bodyContainer.destroy(true);
    }
    this.container.destroy(true);
  }
}
