import Phaser from 'phaser';
import {
  type BackAccessorySpringState,
  blendRigPoseSnapshots,
  computeEnemyArchetypeMotion,
  computeMeleeSwingArcOffset,
  createBackAccessorySpringState,
  createStateCrossfadeController,
  createWeaponRecoilSpringState,
  evaluateRigPose,
  resolveHitFlashTint,
  type RigAnimState,
  type RigPoseSnapshot,
  type StateCrossfadeController,
  stepBackAccessorySpring,
  stepMeleeLungeGlideOffset,
  stepStateCrossfade,
  stepTorsoMoveLean,
  stepWeaponRecoilSpring,
  transitionRigAnimState,
  triggerWeaponRecoilImpulse,
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

  // Cutout 2.0 locomotion, spring secondary motion, and crossfade states
  private moveVx = 0;
  private moveVy = 0;
  private moveLeanRad = 0;
  private prevBodyY = 0;
  private crossfadeCtrl: StateCrossfadeController = createStateCrossfadeController('idle');
  private lastBlendedPose: RigPoseSnapshot | null = null;
  private backSpring: BackAccessorySpringState = createBackAccessorySpringState();
  private recoilSpring: WeaponRecoilSpringState = createWeaponRecoilSpringState();

  // Combat & Game Feel states
  private recoilTimer = 0;
  private recoilStrength = 4;
  private meleeSwingTimer = 0;
  private meleeSwingDir = 1;
  private lungeOffsetX = 0;
  private lungeOffsetY = 0;
  private hitFlashTimer = 0;
  private hitFlashCooldownTimer = 0;
  private hitFlashTint = 0xff6b6b;
  private castPoseTimer = 0;
  private reviveProgress = 0;
  private isHitFlashing = false;
  private isStatusTinted = false;
  private isDashing = false;
  private telegraphProgress = 0; // 0 = none, (0..1] = active telegraph progress
  private spawnProgress = 1; // 1 = fully spawned
  private elementalStatusTint: number | null = null;

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

    this.container = scene.add.container(x, y);
    this.bodyContainer = scene.add.container(0, 0);

    const invBake = 1 / TextureBaker.getBakeScale();

    // 1. Optional Player Identification Ring (P1-P4)
    if (this.playerSlot) {
      this.playerRingSprite = scene.add.sprite(
        0,
        1,
        TextureBaker.getPlayerRingTextureKey(this.playerSlot),
      );
      this.playerRingSprite.setScale(invBake);
      this.container.add(this.playerRingSprite);
    }

    // 2. Elliptical Ground Shadow
    this.shadowSprite = scene.add.sprite(0, 0, TextureBaker.getShadowTextureKey(def.id));
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
      this.compositeSprite = scene.add.sprite(0, 0, TextureBaker.getFullRigTextureKey(def.id));
      this.compositeSprite.setOrigin(0.5, 0.78);
      this.compositeSprite.setScale(compInvBake);
      this.container.add(this.compositeSprite);
      this.bodyContainer.setVisible(false);
    } else {
      const sortedParts = [...def.parts].sort((a, b) => a.zIndex - b.zIndex);
      for (const part of sortedParts) {
        const sprite = scene.add.sprite(
          part.offsetX,
          part.offsetY,
          TextureBaker.getPartTextureKey(def.id, part.id),
        );
        sprite.setOrigin(part.originX, part.originY);
        sprite.setScale(invBake);
        this.bodyContainer.add(sprite);
        this.partSprites.set(part.id, sprite);
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
      if (this.scene.textures.exists(key)) {
        weaponSprite.setTexture(key);
        weaponSprite.setOrigin(weaponVec.originX, weaponVec.originY);
      }
    }
  }

  public triggerRecoil(strength = 5): void {
    this.recoilTimer = 0.12;
    this.recoilStrength = strength;
    this.recoilSpring = triggerWeaponRecoilImpulse(this.recoilSpring, strength);
  }

  public triggerMeleeSwing(lungeDx = 0, lungeDy = 0): void {
    this.meleeSwingTimer = 0.2;
    this.meleeSwingDir = -this.meleeSwingDir;
    if (Math.hypot(lungeDx, lungeDy) > 0.5) {
      this.lungeOffsetX = Math.max(-110, Math.min(110, this.lungeOffsetX - lungeDx));
      this.lungeOffsetY = Math.max(-110, Math.min(110, this.lungeOffsetY - lungeDy));
    } else {
      this.lungeOffsetX = Math.max(-48, Math.min(48, this.lungeOffsetX - Math.cos(this.aimAngleRad) * 6));
      this.lungeOffsetY = Math.max(-48, Math.min(48, this.lungeOffsetY - Math.sin(this.aimAngleRad) * 6));
    }
  }

  public stepLungeOffset(dtSec: number): void {
    if (this.lungeOffsetX === 0 && this.lungeOffsetY === 0) return;
    const next = stepMeleeLungeGlideOffset(this.lungeOffsetX, this.lungeOffsetY, dtSec);
    this.lungeOffsetX = next.x;
    this.lungeOffsetY = next.y;
  }

  public getLungeOffset(): { x: number; y: number } {
    return { x: this.lungeOffsetX, y: this.lungeOffsetY };
  }

  public triggerHitFlash(durationSec = 0.075, tintColor?: number): void {
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
      this.hitFlashTimer = Math.min(durationSec, 0.055);
      this.hitFlashCooldownTimer = 0.22;
    } else if (this.playerSlot !== null) {
      this.hitFlashTimer = Math.max(this.hitFlashTimer, durationSec);
      this.hitFlashCooldownTimer = 0.08;
    } else {
      this.hitFlashTimer = Math.min(durationSec, 0.075);
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
      this.playerRingSprite = this.scene.add.sprite(0, 1, key);
      this.playerRingSprite.setScale(invBake);
      this.container.addAt(this.playerRingSprite, 0);
    } else {
      this.playerRingSprite.setTexture(key);
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
    this.shadowSprite.setTexture(TextureBaker.getShadowTextureKey(this.def.id));
    this.shadowSprite.setScale(invBake);
    if (this.playerRingSprite && this.playerSlot) {
      this.playerRingSprite.setTexture(TextureBaker.getPlayerRingTextureKey(this.playerSlot));
      this.playerRingSprite.setScale(invBake);
    }
    if (this.compositeSprite) {
      this.compositeSprite.setTexture(TextureBaker.getFullRigTextureKey(this.def.id));
      this.compositeSprite.setScale(compInvBake);
    }
    for (const [partId, sprite] of this.partSprites.entries()) {
      if (partId === 'weapon' && this.equippedWeaponId) {
        const wKey = TextureBaker.getWeaponTextureKey(this.equippedWeaponId);
        if (this.scene.textures.exists(wKey)) {
          sprite.setTexture(wKey);
          sprite.setScale(invBake);
          continue;
        }
      }
      sprite.setTexture(TextureBaker.getPartTextureKey(this.def.id, partId));
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

    // Multiplicative hit tint, telegraph flash, life state tint, or elemental status tint
    const shouldTintHit = this.hitFlashTimer > 0;
    const shouldFlashTelegraph =
      !shouldTintHit && this.telegraphProgress > 0 && Math.floor(this.animTime * 18) % 2 === 0;

    if (shouldTintHit) {
      this.applyHitFlashTint();
      this.isHitFlashing = true;
      this.isStatusTinted = false;
    } else if (shouldFlashTelegraph) {
      this.applyMultiplicativeTint(0xff9e64);
      this.isHitFlashing = true;
      this.isStatusTinted = false;
    } else if (this.lifeState === 'downed') {
      const pulse = Math.floor(this.animTime * 6) % 2 === 0 ? 0xf7768e : 0xff9e64;
      this.applyMultiplicativeTint(pulse);
      this.isHitFlashing = false;
      this.isStatusTinted = true;
    } else if (this.lifeState === 'ghost') {
      this.applyMultiplicativeTint(0x7dcfff);
      this.isHitFlashing = false;
      this.isStatusTinted = true;
    } else if (this.elementalStatusTint !== null) {
      this.applyMultiplicativeTint(this.elementalStatusTint);
      this.isHitFlashing = false;
      this.isStatusTinted = true;
    } else if (this.isHitFlashing || this.isStatusTinted) {
      this.clearPartTints();
      this.isHitFlashing = false;
      this.isStatusTinted = false;
    }

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
      );
      const dashStretchX = this.isDashing || effectiveState === 'dash' ? 1.14 : 1;
      const dashSquashY = this.isDashing || effectiveState === 'dash' ? 0.88 : 1;
      this.compositeSprite.scaleX =
        compInvBake * this.facingSign * spawnScale * hitPunch * dashStretchX * arch.scaleXMult;
      this.compositeSprite.scaleY =
        compInvBake * spawnScale * hitPunch * dashSquashY * arch.scaleYMult;
      this.compositeSprite.alpha = this.spawnProgress < 1 ? 0.35 + this.spawnProgress * 0.65 : 1;
      if (effectiveState === 'idle') {
        const s = Math.sin(this.animTime * ((Math.PI * 2) / 1.6));
        this.compositeSprite.y = arch.bodyYOffset + s * 1.1;
      } else {
        const phase = this.animTime * ((Math.PI * 2) / 0.38) * arch.cadenceMult;
        this.compositeSprite.y =
          arch.bodyYOffset - Math.abs(Math.sin(phase)) * 3.0 * arch.strideBounceMult;
      }
      return;
    }

    if (effectiveState !== this.crossfadeCtrl.currentState) {
      if (this.lastBlendedPose) {
        transitionRigAnimState(this.crossfadeCtrl, effectiveState, this.lastBlendedPose);
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
      this.recoilSpring = triggerWeaponRecoilImpulse(this.recoilSpring, this.recoilStrength);
    }
    this.recoilSpring = stepWeaponRecoilSpring(this.recoilSpring, dtSec);

    const bodyBounceVelY =
      dtSec > 1e-4 && this.lastBlendedPose
        ? (this.lastBlendedPose.bodyY - this.prevBodyY) / dtSec
        : 0;
    this.backSpring = stepBackAccessorySpring(this.backSpring, {
      moveVx: effectiveMoveVx,
      moveVy: this.moveVy,
      bodyBounceVelY,
      facingSign: this.facingSign,
      isDashing: this.isDashing || effectiveState === 'dash',
      animState: effectiveState,
      dtSec,
    });

    let swingAngleOffset = 0;
    if (this.meleeSwingTimer > 0) {
      const p = 1 - this.meleeSwingTimer / 0.2;
      swingAngleOffset = computeMeleeSwingArcOffset(p, this.meleeSwingDir);
    }

    const targetPose = evaluateRigPose({
      def: this.def,
      animState: effectiveState,
      animTime: this.animTime,
      localAim,
      moveLeanRad: this.moveLeanRad,
      recoilSpring: this.recoilSpring,
      backSpring: this.backSpring,
      meleeSwingOffsetRad: swingAngleOffset,
      telegraphProgress: this.telegraphProgress,
      reviveProgress: this.reviveProgress,
      phaseSeed: this.phaseSeed,
    });

    const alpha = stepStateCrossfade(this.crossfadeCtrl, dtSec);
    const pose =
      this.crossfadeCtrl.fromPose && alpha < 1
        ? blendRigPoseSnapshots(this.crossfadeCtrl.fromPose, targetPose, alpha)
        : targetPose;

    this.prevBodyY = this.lastBlendedPose?.bodyY ?? pose.bodyY;
    this.lastBlendedPose = pose;

    this.bodyContainer.y = pose.bodyY;
    this.bodyContainer.scaleX = this.facingSign * spawnScale * hitPunch * pose.bodyScaleX;
    this.bodyContainer.scaleY = spawnScale * hitPunch * pose.bodyScaleY;
    this.bodyContainer.rotation = pose.bodyRotation * this.facingSign;

    const baseAlpha = this.spawnProgress < 1 ? 0.35 + this.spawnProgress * 0.65 : 1;
    this.bodyContainer.alpha =
      this.lifeState === 'ghost' ? 0.52 + Math.sin(this.animTime * 4) * 0.08 : baseAlpha;

    this.shadowSprite.scaleX = invBake * pose.shadowScale;
    this.shadowSprite.scaleY = invBake * pose.shadowScale;

    if (this.playerRingSprite && this.playerRingSprite.visible) {
      const castRingMult =
        effectiveState === 'cast' ? 1.12 + Math.sin(this.animTime * 10) * 0.06 : 1.0;
      this.playerRingSprite.setScale(invBake * castRingMult);
    }

    for (const [partId, sprite] of this.partSprites.entries()) {
      const pt = pose.parts[partId];
      sprite.x = pt.x;
      sprite.y = pt.y;
      sprite.rotation = pt.rotation;
      sprite.scaleX = invBake * pt.scaleX;
      sprite.scaleY = invBake * pt.scaleY;
    }
  }

  private applyHitFlashTint(): void {
    if (this.compositeSprite) {
      this.compositeSprite.setTint(this.hitFlashTint);
    }
    for (const [partId, sprite] of this.partSprites.entries()) {
      if (partId === 'torso' || partId === 'head') {
        sprite.setTint(this.hitFlashTint);
      } else {
        sprite.clearTint();
      }
    }
  }

  private applyMultiplicativeTint(color: number): void {
    if (this.compositeSprite) {
      this.compositeSprite.setTint(color);
    }
    for (const sprite of this.partSprites.values()) {
      sprite.setTint(color);
    }
  }

  private clearPartTints(): void {
    if (this.compositeSprite) {
      this.compositeSprite.clearTint();
    }
    for (const sprite of this.partSprites.values()) {
      sprite.clearTint();
    }
  }

  public destroy(): void {
    if (this.fastComposite) {
      this.shadowSprite.destroy();
      this.bodyContainer.destroy(true);
    }
    this.container.destroy(true);
  }
}
