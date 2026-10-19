import Phaser from 'phaser';
import { easeOutBack, easeOutCubic } from './easing.js';
import {
  type EntityRigDef,
  type RigPartDef,
  type RigPartId,
  WEAPON_VECTOR_DEFS,
} from './rig-defs.js';
import { TextureBaker } from './texture-baker.js';

export type RigAnimState = 'idle' | 'run';

export interface CutoutRigOptions {
  playerSlot?: 1 | 2 | 3 | 4 | null;
  displayScale?: number;
  initialPhaseOffset?: number;
}

/**
 * CutoutRig assembles pre-baked procedural vector part textures into a Phaser Container
 * and animates them parametrically at 60+ FPS using sin/cosine/easing curves (zero per-frame Graphics redraws).
 */
export class CutoutRig {
  public readonly container: Phaser.GameObjects.Container;
  public readonly bodyContainer: Phaser.GameObjects.Container;
  public readonly def: EntityRigDef;

  private readonly scene: Phaser.Scene;
  private readonly partSprites = new Map<RigPartId, Phaser.GameObjects.Sprite>();
  private readonly partDefs = new Map<RigPartId, RigPartDef>();
  private shadowSprite: Phaser.GameObjects.Sprite;
  private playerRingSprite: Phaser.GameObjects.Sprite | null = null;

  private animState: RigAnimState = 'idle';
  private animTime = 0;
  private aimAngleRad = 0;
  private facingSign = 1;
  private displayScale = 1;
  private playerSlot: 1 | 2 | 3 | 4 | null;
  private equippedWeaponId: string | null = null;

  // Combat & Game Feel states
  private recoilTimer = 0;
  private recoilStrength = 4;
  private meleeSwingTimer = 0;
  private meleeSwingDir = 1;
  private hitFlashTimer = 0;
  private isHitFlashing = false;
  private isDashing = false;
  private telegraphProgress = 0; // 0 = none, (0..1] = active telegraph progress
  private spawnProgress = 1; // 1 = fully spawned

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
    this.container.add(this.shadowSprite);

    // 3. Sorted Cutout Parts
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
    this.container.setScale(this.displayScale);
  }

  public setAnimState(state: RigAnimState): void {
    this.animState = state;
  }

  public getAnimState(): RigAnimState {
    return this.animState;
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
  }

  public triggerMeleeSwing(): void {
    this.meleeSwingTimer = 0.18;
    this.meleeSwingDir = -this.meleeSwingDir;
  }

  public triggerHitFlash(durationSec = 0.11): void {
    this.hitFlashTimer = Math.max(this.hitFlashTimer, durationSec);
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

  public refreshBakedTextures(): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    this.shadowSprite.setTexture(TextureBaker.getShadowTextureKey(this.def.id));
    this.shadowSprite.setScale(invBake);
    if (this.playerRingSprite && this.playerSlot) {
      this.playerRingSprite.setTexture(TextureBaker.getPlayerRingTextureKey(this.playerSlot));
      this.playerRingSprite.setScale(invBake);
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

  /**
   * Parametric animation update adhering to docs/ART_GUIDE.md section 4.2 + combat juice states.
   */
  public update(dtSec: number): void {
    this.animTime += dtSec;
    const invBake = 1 / TextureBaker.getBakeScale();

    if (this.recoilTimer > 0) this.recoilTimer = Math.max(0, this.recoilTimer - dtSec);
    if (this.meleeSwingTimer > 0) this.meleeSwingTimer = Math.max(0, this.meleeSwingTimer - dtSec);
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dtSec);

    // Hit flash or telegraph flash tint
    const shouldFlashWhite = this.hitFlashTimer > 0;
    const shouldFlashTelegraph =
      !shouldFlashWhite &&
      this.telegraphProgress > 0 &&
      Math.floor(this.animTime * 18) % 2 === 0;

    if (shouldFlashWhite) {
      this.applyTintFill(0xffffff);
      this.isHitFlashing = true;
    } else if (shouldFlashTelegraph) {
      this.applyTintFill(0xfde047);
      this.isHitFlashing = true;
    } else if (this.isHitFlashing) {
      this.clearPartTints();
      this.isHitFlashing = false;
    }

    const torso = this.partSprites.get('torso');
    const head = this.partSprites.get('head');
    const legL = this.partSprites.get('legLeft');
    const legR = this.partSprites.get('legRight');
    const armL = this.partSprites.get('armLeft');
    const armR = this.partSprites.get('armRight');
    const back = this.partSprites.get('backAccessory');
    const weapon = this.partSprites.get('weapon');

    const torsoDef = this.partDefs.get('torso');
    const headDef = this.partDefs.get('head');
    const legLDef = this.partDefs.get('legLeft');
    const legRDef = this.partDefs.get('legRight');
    const armLDef = this.partDefs.get('armLeft');
    const armRDef = this.partDefs.get('armRight');
    const backDef = this.partDefs.get('backAccessory');
    const weaponDef = this.partDefs.get('weapon');

    // Spawn scale & hit punch scale
    const spawnScale = this.spawnProgress < 1 ? easeOutBack(this.spawnProgress) : 1;
    const hitPunch = this.hitFlashTimer > 0 ? 1 + (this.hitFlashTimer / 0.12) * 0.12 : 1;
    const dashStretchX = this.isDashing ? 1.14 : 1;
    const dashSquashY = this.isDashing ? 0.88 : 1;

    // Telegraph swell for Spore Bomber / crouch for Boar & Goblin
    let telegraphScaleX = 1;
    let telegraphScaleY = 1;
    if (this.telegraphProgress > 0) {
      if (this.def.id === 'spore_bomber') {
        const swell = Math.sin(this.animTime * 28) * 0.08 + this.telegraphProgress * 0.22;
        telegraphScaleX = 1 + swell;
        telegraphScaleY = 1 + swell;
      } else {
        telegraphScaleX = 1 + this.telegraphProgress * 0.1;
        telegraphScaleY = 1 - this.telegraphProgress * 0.12;
      }
    }

    this.bodyContainer.scaleX =
      this.facingSign * spawnScale * hitPunch * dashStretchX * telegraphScaleX;
    this.bodyContainer.scaleY = spawnScale * hitPunch * dashSquashY * telegraphScaleY;
    this.bodyContainer.alpha = this.spawnProgress < 1 ? 0.35 + this.spawnProgress * 0.65 : 1;

    // Normalize local aim angle relative to facing direction
    const localAim =
      this.facingSign >= 0
        ? this.aimAngleRad
        : Math.atan2(Math.sin(this.aimAngleRad), -Math.cos(this.aimAngleRad));

    // Weapon recoil & melee swing offset
    const recoilT = this.recoilTimer > 0 ? easeOutCubic(this.recoilTimer / 0.12) : 0;
    const recoilDist = recoilT * this.recoilStrength;
    const recoilX = -Math.cos(localAim) * recoilDist;
    const recoilY = -Math.sin(localAim) * recoilDist;

    let swingAngleOffset = 0;
    if (this.meleeSwingTimer > 0) {
      const p = 1 - this.meleeSwingTimer / 0.18;
      swingAngleOffset = this.meleeSwingDir * Math.sin(p * Math.PI) * 1.35;
    }

    if (this.animState === 'idle') {
      const omega = (Math.PI * 2) / 1.6;
      const s = Math.sin(this.animTime * omega);
      const sDelayed = Math.sin(this.animTime * omega - 0.4);

      this.bodyContainer.y = 0;
      this.shadowSprite.scaleX = invBake * (1 - s * 0.03);
      this.shadowSprite.scaleY = invBake * (1 - s * 0.03);

      if (torso && torsoDef) {
        torso.x = torsoDef.offsetX;
        torso.y = torsoDef.offsetY + s * 1.2;
        torso.rotation = 0;
        torso.scaleX = invBake * (1 - s * 0.02);
        torso.scaleY = invBake * (1 + s * 0.03);
      }

      if (head && headDef) {
        head.x = headDef.offsetX + Math.cos(localAim) * 0.8;
        head.y = headDef.offsetY + sDelayed * 1.6;
        head.rotation = Math.sin(localAim) * 0.08;
      }

      if (legL && legLDef) {
        legL.x = legLDef.offsetX;
        legL.y = legLDef.offsetY;
        legL.rotation = 0;
      }
      if (legR && legRDef) {
        legR.x = legRDef.offsetX;
        legR.y = legRDef.offsetY;
        legR.rotation = 0;
      }

      if (armL && armLDef) {
        armL.x = armLDef.offsetX;
        armL.y = armLDef.offsetY + s * 0.9;
        armL.rotation = s * 0.06;
      }

      if (back && backDef) {
        back.x = backDef.offsetX;
        back.y = backDef.offsetY + sDelayed * 1.0;
        back.rotation = sDelayed * 0.04;
      }

      if (weapon && weaponDef) {
        weapon.x = weaponDef.offsetX + recoilX;
        weapon.y = weaponDef.offsetY + s * 0.8 + recoilY;
        weapon.rotation = localAim * 0.65 + s * 0.04 + swingAngleOffset;
      }

      if (armR && armRDef) {
        armR.x = armRDef.offsetX + recoilX * 0.65;
        armR.y = armRDef.offsetY + s * 0.8 + recoilY * 0.65;
        armR.rotation = localAim * 0.45 + swingAngleOffset * 0.7;
      }
    } else {
      const omega = (Math.PI * 2) / 0.38;
      const phase = this.animTime * omega;
      const swing = Math.sin(phase);
      const bounce = -Math.abs(Math.sin(phase)) * 3.2;
      const squash = Math.cos(phase * 2);

      this.bodyContainer.y = bounce;
      this.shadowSprite.scaleX = invBake * (1 + bounce * 0.025);
      this.shadowSprite.scaleY = invBake * (1 + bounce * 0.025);

      if (torso && torsoDef) {
        torso.x = torsoDef.offsetX;
        torso.y = torsoDef.offsetY;
        torso.rotation = this.isDashing ? 0.25 : 0.12;
        torso.scaleX = invBake * (1 - squash * 0.04);
        torso.scaleY = invBake * (1 + squash * 0.05);
      }

      if (head && headDef) {
        head.x = headDef.offsetX + 1.0 + Math.cos(localAim) * 0.6;
        head.y = headDef.offsetY + Math.sin(phase - 0.3) * 1.1;
        head.rotation = 0.05 + Math.sin(phase) * 0.05 + Math.sin(localAim) * 0.06;
      }

      if (legL && legLDef) {
        legL.x = legLDef.offsetX - swing * 2.4;
        legL.y = legLDef.offsetY - Math.max(0, swing) * 1.8;
        legL.rotation = swing * 0.55;
      }

      if (legR && legRDef) {
        legR.x = legRDef.offsetX + swing * 2.4;
        legR.y = legRDef.offsetY - Math.max(0, -swing) * 1.8;
        legR.rotation = -swing * 0.55;
      }

      if (armL && armLDef) {
        armL.x = armLDef.offsetX + swing * 1.5;
        armL.y = armLDef.offsetY;
        armL.rotation = -swing * 0.32;
      }

      if (back && backDef) {
        back.x = backDef.offsetX - 1.5;
        back.y = backDef.offsetY;
        back.rotation = -0.18 + Math.sin(phase - 0.5) * 0.14;
      }

      if (weapon && weaponDef) {
        weapon.x = weaponDef.offsetX - swing * 1.2 + recoilX;
        weapon.y = weaponDef.offsetY + recoilY;
        weapon.rotation = localAim * 0.65 - swing * 0.14 + swingAngleOffset;
      }

      if (armR && armRDef) {
        armR.x = armRDef.offsetX - swing * 1.2 + recoilX * 0.65;
        armR.y = armRDef.offsetY + recoilY * 0.65;
        armR.rotation = localAim * 0.45 - swing * 0.14 + swingAngleOffset * 0.7;
      }
    }
  }

  private applyTintFill(color: number): void {
    for (const sprite of this.partSprites.values()) {
      sprite.setTintFill(color);
    }
  }

  private clearPartTints(): void {
    for (const sprite of this.partSprites.values()) {
      sprite.clearTint();
    }
  }

  public destroy(): void {
    this.container.destroy(true);
  }
}
