import Phaser from 'phaser';
import type { EntityRigDef, RigPartDef, RigPartId } from './rig-defs.js';
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
      sprite.setTexture(TextureBaker.getPartTextureKey(this.def.id, partId));
      sprite.setScale(invBake);
    }
  }

  /**
   * Parametric animation update adhering to docs/ART_GUIDE.md section 4.2.
   */
  public update(dtSec: number): void {
    this.animTime += dtSec;
    const invBake = 1 / TextureBaker.getBakeScale();

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

    this.bodyContainer.scaleX = this.facingSign;

    // Normalize local aim angle relative to facing direction
    const localAim =
      this.facingSign >= 0
        ? this.aimAngleRad
        : Math.atan2(Math.sin(this.aimAngleRad), -Math.cos(this.aimAngleRad));

    if (this.animState === 'idle') {
      // Idle breathing cycle T = 1.6s (omega = 2*PI / 1.6)
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
        weapon.x = weaponDef.offsetX;
        weapon.y = weaponDef.offsetY + s * 0.8;
        weapon.rotation = localAim * 0.35 + s * 0.04;
      }

      if (armR && armRDef) {
        armR.x = armRDef.offsetX;
        armR.y = armRDef.offsetY + s * 0.8;
        armR.rotation = localAim * 0.25;
      }
    } else {
      // Run cycle T = 0.38s (omega = 2*PI / 0.38)
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
        torso.rotation = 0.12;
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
        weapon.x = weaponDef.offsetX - swing * 1.2;
        weapon.y = weaponDef.offsetY;
        weapon.rotation = localAim * 0.3 - swing * 0.18;
      }

      if (armR && armRDef) {
        armR.x = armRDef.offsetX - swing * 1.2;
        armR.y = armRDef.offsetY;
        armR.rotation = localAim * 0.25 - swing * 0.18;
      }
    }
  }

  public destroy(): void {
    this.container.destroy(true);
  }
}
