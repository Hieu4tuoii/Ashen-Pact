import Phaser from 'phaser';
import { clamp } from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../art/palette.js';
import { RIG_DEFS_BY_ID } from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';

interface PooledParticle {
  sprite: Phaser.GameObjects.Sprite;
  textureKey: string;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vr: number;
  age: number;
  ttl: number;
  startScale: number;
  endScale: number;
  startAlpha: number;
  gravityY: number;
  damping: number;
}

interface PooledDamageText {
  text: Phaser.GameObjects.Text;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  baseScale: number;
}

/**
 * Object-pooled Combat FX & Game Feel ("Juice") system:
 * - Hit-stop freeze frames (30-60ms)
 * - Trauma-based screen shake (Perlin-like harmonic noise)
 * - Pooled floating damage numbers (normal, crit, armor, player hurt)
 * - Pooled vector sprites for muzzle flash, shell casings, sword slash arcs, sparks, dust, and enemy death part bursts
 */
export class CombatFxManager {
  private readonly particlePool: PooledParticle[] = [];
  private readonly damagePool: PooledDamageText[] = [];

  private hitStopRemainingMs = 0;
  private trauma = 0;
  private shakeTime = 0;
  private shakeIntensitySetting = 1.0;
  private popupSpreadIndex = 0;

  public totalHitStopsTriggered = 0;
  public totalShakesTriggered = 0;
  public totalSparksSpawned = 0;
  public totalDamagePopupsSpawned = 0;

  constructor(scene: Phaser.Scene, particleCapacity = 160, damageCapacity = 40) {
    const invBake = 1 / TextureBaker.getBakeScale();
    const textRes = TextureBaker.getBakeScale();

    for (let i = 0; i < particleCapacity; i++) {
      const sprite = scene.add.sprite(-1000, -1000, 'fx_spark');
      sprite.setVisible(false);
      sprite.setActive(false);
      sprite.setScale(invBake);
      sprite.setDepth(45);
      this.particlePool.push({
        sprite,
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
        endScale: 0.2,
        startAlpha: 1,
        gravityY: 0,
        damping: 4,
      });
    }

    for (let i = 0; i < damageCapacity; i++) {
      const text = scene.add
        .text(-1000, -1000, '', {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '14px',
          fontStyle: '800',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 3.5,
          resolution: textRes,
        })
        .setOrigin(0.5);
      text.setVisible(false);
      text.setActive(false);
      text.setDepth(80);
      this.damagePool.push({
        text,
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        age: 0,
        ttl: 0.65,
        baseScale: 1,
      });
    }
  }

  public refreshResolution(bakeScale: number, prevScale?: number): void {
    const invBake = 1 / bakeScale;
    const scaleRatio = prevScale && prevScale > 0 ? prevScale / bakeScale : 1;
    for (const p of this.particlePool) {
      p.sprite.setTexture(p.textureKey);
      if (p.active && scaleRatio !== 1) {
        p.startScale *= scaleRatio;
        p.endScale *= scaleRatio;
      } else if (!p.active) {
        p.sprite.setScale(invBake);
      }
    }
    for (const item of this.damagePool) {
      item.text.setResolution(bakeScale);
    }
  }

  public triggerHitStop(durationMs: number): void {
    this.hitStopRemainingMs = Math.max(this.hitStopRemainingMs, clamp(durationMs, 0, 65));
    this.totalHitStopsTriggered += 1;
  }

  public consumeHitStopDelta(rawDeltaMs: number): { simDeltaMs: number; isHitStopped: boolean } {
    if (this.hitStopRemainingMs <= 0) {
      return { simDeltaMs: rawDeltaMs, isHitStopped: false };
    }
    if (rawDeltaMs <= this.hitStopRemainingMs) {
      this.hitStopRemainingMs -= rawDeltaMs;
      return { simDeltaMs: 0, isHitStopped: true };
    }
    const rem = rawDeltaMs - this.hitStopRemainingMs;
    this.hitStopRemainingMs = 0;
    return { simDeltaMs: rem, isHitStopped: false };
  }

  public addTrauma(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, 1);
    this.totalShakesTriggered += 1;
  }

  public getTrauma(): number {
    return this.trauma;
  }

  public computeCameraShakeOffset(dtSec: number): { offsetX: number; offsetY: number } {
    this.shakeTime += dtSec;
    if (this.trauma <= 0.001) {
      this.trauma = 0;
      return { offsetX: 0, offsetY: 0 };
    }

    this.trauma = Math.max(0, this.trauma - dtSec * 2.1);
    const shakePower = this.trauma * this.trauma * this.shakeIntensitySetting;
    const maxOffset = 11;

    // Multi-frequency continuous Perlin-like wave so camera never teleports abruptly
    const nx =
      Math.sin(this.shakeTime * 43.0) * 0.55 +
      Math.cos(this.shakeTime * 71.0 + 1.3) * 0.3 +
      Math.sin(this.shakeTime * 113.0 + 2.7) * 0.15;
    const ny =
      Math.cos(this.shakeTime * 47.0 + 0.7) * 0.55 +
      Math.sin(this.shakeTime * 79.0 + 2.1) * 0.3 +
      Math.cos(this.shakeTime * 127.0 + 0.4) * 0.15;

    return {
      offsetX: nx * maxOffset * shakePower,
      offsetY: ny * maxOffset * shakePower,
    };
  }

  public spawnDamagePopup(params: {
    x: number;
    y: number;
    amount: number;
    isCrit: boolean;
    targetKind: 'player' | 'enemy';
    hitArmor: boolean;
  }): void {
    const slot = this.acquireDamageSlot();
    if (!slot) return;

    this.totalDamagePopupsSpawned += 1;
    const fanIdx = this.popupSpreadIndex++ % 5;
    const fanLane = fanIdx - 2; // -2, -1, 0, 1, 2

    slot.active = true;
    slot.age = 0;
    slot.ttl = params.isCrit ? 0.78 : 0.62;
    slot.x = params.x + fanLane * 8 + (Math.random() - 0.5) * 4;
    slot.y = params.y - 16 - Math.abs(fanLane) * 4;
    slot.vx = fanLane * 18 + (Math.random() - 0.5) * 10;
    slot.vy = (params.isCrit ? -78 : -58) - (fanIdx % 2) * 10;
    slot.baseScale = params.isCrit ? 1.32 : 1.0;

    let color: string = PALETTE.BONE_WHITE;
    let label = `${params.amount}`;
    if (params.targetKind === 'player') {
      color = params.hitArmor ? PALETTE.CYAN_FROST : PALETTE.CRIMSON_BRIGHT;
      label = `-${params.amount}`;
    } else if (params.isCrit) {
      color = PALETTE.SOLAR_GOLD;
      label = `${params.amount}!`;
    }

    slot.text.setText(label);
    slot.text.setColor(color);
    slot.text.setPosition(slot.x, slot.y);
    slot.text.setScale(slot.baseScale * 1.25);
    slot.text.setAlpha(1);
    slot.text.setVisible(true);
    slot.text.setActive(true);
  }

  public spawnMuzzleFlashAndCasing(x: number, y: number, angleRad: number, isShotgun = false): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    const flash = this.acquireParticleSlot();
    if (flash) {
      flash.active = true;
      flash.textureKey = 'fx_muzzle_flash';
      flash.age = 0;
      flash.ttl = 0.075;
      flash.x = x + Math.cos(angleRad) * 6;
      flash.y = y + Math.sin(angleRad) * 6;
      flash.vx = 0;
      flash.vy = 0;
      flash.vr = 0;
      flash.startScale = invBake * (isShotgun ? 1.45 : 1.05);
      flash.endScale = invBake * 0.4;
      flash.startAlpha = 1;
      flash.gravityY = 0;
      flash.damping = 0;

      flash.sprite.setTexture(flash.textureKey);
      flash.sprite.clearTint();
      flash.sprite.setPosition(flash.x, flash.y);
      flash.sprite.setRotation(angleRad);
      flash.sprite.setScale(flash.startScale);
      flash.sprite.setAlpha(1);
      flash.sprite.setDepth(48);
      flash.sprite.setVisible(true);
    }

    const casing = this.acquireParticleSlot();
    if (casing) {
      const ejectAngle = angleRad - Math.PI * 0.65 + (Math.random() - 0.5) * 0.4;
      const spd = 75 + Math.random() * 45;
      casing.active = true;
      casing.textureKey = 'fx_shell_casing';
      casing.age = 0;
      casing.ttl = 0.42;
      casing.x = x;
      casing.y = y;
      casing.vx = Math.cos(ejectAngle) * spd;
      casing.vy = Math.sin(ejectAngle) * spd - 25;
      casing.vr = (Math.random() - 0.5) * 18;
      casing.startScale = invBake;
      casing.endScale = invBake * 0.85;
      casing.startAlpha = 0.95;
      casing.gravityY = 180;
      casing.damping = 3;

      casing.sprite.setTexture(casing.textureKey);
      casing.sprite.clearTint();
      casing.sprite.setPosition(casing.x, casing.y);
      casing.sprite.setRotation(Math.random() * Math.PI);
      casing.sprite.setScale(casing.startScale);
      casing.sprite.setAlpha(casing.startAlpha);
      casing.sprite.setDepth(22);
      casing.sprite.setVisible(true);
    }
  }

  public spawnMeleeSlash(x: number, y: number, angleRad: number): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    const slash = this.acquireParticleSlot();
    if (!slash) return;

    slash.active = true;
    slash.textureKey = 'fx_slash_arc';
    slash.age = 0;
    slash.ttl = 0.14;
    slash.x = x + Math.cos(angleRad) * 8;
    slash.y = y + Math.sin(angleRad) * 8;
    slash.vx = Math.cos(angleRad) * 40;
    slash.vy = Math.sin(angleRad) * 40;
    slash.vr = 0;
    slash.startScale = invBake * 0.95;
    slash.endScale = invBake * 1.18;
    slash.startAlpha = 0.95;
    slash.gravityY = 0;
    slash.damping = 6;

    slash.sprite.setTexture(slash.textureKey);
    slash.sprite.clearTint();
    slash.sprite.setPosition(slash.x, slash.y);
    slash.sprite.setRotation(angleRad);
    slash.sprite.setScale(slash.startScale);
    slash.sprite.setAlpha(slash.startAlpha);
    slash.sprite.setDepth(52);
    slash.sprite.setVisible(true);
  }

  public spawnHitSparks(
    x: number,
    y: number,
    impactAngleRad: number,
    options: { isCrit?: boolean; hitWall?: boolean; blockedByShield?: boolean; count?: number } = {},
  ): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    const count = options.count ?? (options.isCrit ? 10 : 6);
    this.totalSparksSpawned += count;

    let tint = hexToNum(PALETTE.CYAN_FROST);
    if (options.isCrit) tint = hexToNum(PALETTE.SOLAR_GOLD);
    else if (options.blockedByShield) tint = hexToNum(PALETTE.CRIMSON_BRIGHT);
    else if (options.hitWall) tint = hexToNum(PALETTE.WARM_STONE);

    for (let i = 0; i < count; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;

      const spread = (Math.random() - 0.5) * 2.2;
      const dir = impactAngleRad + Math.PI + spread;
      const spd = 70 + Math.random() * 130;

      p.active = true;
      p.textureKey = 'fx_spark';
      p.age = 0;
      p.ttl = 0.18 + Math.random() * 0.12;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(dir) * spd;
      p.vy = Math.sin(dir) * spd;
      p.vr = (Math.random() - 0.5) * 12;
      p.startScale = invBake * (options.isCrit ? 1.2 : 0.9);
      p.endScale = invBake * 0.15;
      p.startAlpha = 1;
      p.gravityY = 0;
      p.damping = 8;

      p.sprite.setTexture(p.textureKey);
      p.sprite.setTint(tint);
      p.sprite.setPosition(p.x, p.y);
      p.sprite.setRotation(dir);
      p.sprite.setScale(p.startScale);
      p.sprite.setAlpha(1);
      p.sprite.setDepth(55);
      p.sprite.setVisible(true);
    }
  }

  public spawnDashDust(x: number, y: number): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    for (let i = 0; i < 4; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;
      const ang = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 45;
      p.active = true;
      p.textureKey = 'fx_dust_puff';
      p.age = 0;
      p.ttl = 0.26 + Math.random() * 0.1;
      p.x = x + (Math.random() - 0.5) * 10;
      p.y = y + (Math.random() - 0.5) * 6;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 12;
      p.vr = 0;
      p.startScale = invBake * 0.95;
      p.endScale = invBake * 0.2;
      p.startAlpha = 0.75;
      p.gravityY = 0;
      p.damping = 5;

      p.sprite.setTexture(p.textureKey);
      p.sprite.setTint(hexToNum(PALETTE.CYAN_FROST));
      p.sprite.setPosition(p.x, p.y);
      p.sprite.setScale(p.startScale);
      p.sprite.setAlpha(p.startAlpha);
      p.sprite.setDepth(18);
      p.sprite.setVisible(true);
    }
  }

  /**
   * Section 3.3: Enemy death breaks cutout rig parts apart and fades out.
   */
  public spawnEnemyDeathBurst(defId: string, x: number, y: number): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    const rigDef = RIG_DEFS_BY_ID[defId];
    const rigFootY = y + 12;
    if (rigDef) {
      for (const part of rigDef.parts) {
        const p = this.acquireParticleSlot();
        if (!p) break;
        const ang = Math.random() * Math.PI * 2;
        const spd = 65 + Math.random() * 95;
        const texKey = TextureBaker.getPartTextureKey(rigDef.id, part.id);
        p.active = true;
        p.textureKey = texKey;
        p.age = 0;
        p.ttl = 0.55;
        p.x = x + part.offsetX * 0.5;
        p.y = rigFootY + part.offsetY * 0.5;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd - 40;
        p.vr = (Math.random() - 0.5) * 14;
        p.startScale = invBake * 0.9;
        p.endScale = invBake * 0.4;
        p.startAlpha = 0.95;
        p.gravityY = 210;
        p.damping = 4;

        p.sprite.setTexture(texKey);
        p.sprite.clearTint();
        p.sprite.setPosition(p.x, p.y);
        p.sprite.setRotation(0);
        p.sprite.setScale(p.startScale);
        p.sprite.setAlpha(p.startAlpha);
        p.sprite.setDepth(35);
        p.sprite.setVisible(true);
      }
    }

    this.spawnHitSparks(x, y, 0, { isCrit: true, count: 10 });
  }

  public spawnExplosionBurst(x: number, y: number, radius: number, colorHex: string = PALETTE.TOXIC_PURPLE): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    const tint = hexToNum(colorHex);
    for (let i = 0; i < 16; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;
      const ang = (i / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const spd = (radius / 0.28) * (0.6 + Math.random() * 0.5);
      const texKey = i % 2 === 0 ? 'fx_spark' : 'fx_dust_puff';
      p.active = true;
      p.textureKey = texKey;
      p.age = 0;
      p.ttl = 0.34;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.vr = (Math.random() - 0.5) * 10;
      p.startScale = invBake * 1.4;
      p.endScale = invBake * 0.2;
      p.startAlpha = 1;
      p.gravityY = 0;
      p.damping = 6;

      p.sprite.setTexture(texKey);
      p.sprite.setTint(i % 3 === 0 ? hexToNum(PALETTE.LIME_GLOW) : tint);
      p.sprite.setPosition(p.x, p.y);
      p.sprite.setRotation(ang);
      p.sprite.setScale(p.startScale);
      p.sprite.setAlpha(1);
      p.sprite.setDepth(58);
      p.sprite.setVisible(true);
    }
  }

  public update(dtSec: number): void {
    // 1. Update pooled particles
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i]!;
      if (!p.active) continue;

      p.age += dtSec;
      if (p.age >= p.ttl) {
        p.active = false;
        p.sprite.setVisible(false);
        continue;
      }

      const progress = p.age / p.ttl;
      if (p.damping > 0) {
        const damp = Math.exp(-p.damping * dtSec);
        p.vx *= damp;
        p.vy *= damp;
      }
      p.vy += p.gravityY * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;

      p.sprite.setPosition(p.x, p.y);
      if (p.vr !== 0) {
        p.sprite.rotation += p.vr * dtSec;
      }
      const scale = p.startScale + (p.endScale - p.startScale) * progress;
      p.sprite.setScale(scale);
      p.sprite.setAlpha(p.startAlpha * (1 - progress));
    }

    // 2. Update pooled damage numbers
    for (let i = 0; i < this.damagePool.length; i++) {
      const d = this.damagePool[i]!;
      if (!d.active) continue;

      d.age += dtSec;
      if (d.age >= d.ttl) {
        d.active = false;
        d.text.setVisible(false);
        continue;
      }

      const progress = d.age / d.ttl;
      d.vy += 120 * dtSec;
      d.x += d.vx * dtSec;
      d.y += d.vy * dtSec;

      d.text.setPosition(d.x, d.y);
      const popScale = progress < 0.18 ? 1.25 - (progress / 0.18) * 0.25 : 1.0;
      d.text.setScale(d.baseScale * popScale);
      d.text.setAlpha(progress > 0.65 ? 1 - (progress - 0.65) / 0.35 : 1);
    }
  }

  public getActiveDamagePopupCount(): number {
    let count = 0;
    for (let i = 0; i < this.damagePool.length; i++) {
      if (this.damagePool[i]!.active) count += 1;
    }
    return count;
  }

  public getActiveParticleCount(): number {
    let count = 0;
    for (let i = 0; i < this.particlePool.length; i++) {
      if (this.particlePool[i]!.active) count += 1;
    }
    return count;
  }

  private acquireParticleSlot(): PooledParticle | null {
    for (let i = 0; i < this.particlePool.length; i++) {
      const slot = this.particlePool[i]!;
      if (!slot.active) return slot;
    }
    return null;
  }

  private acquireDamageSlot(): PooledDamageText | null {
    for (let i = 0; i < this.damagePool.length; i++) {
      const slot = this.damagePool[i]!;
      if (!slot.active) return slot;
    }
    return null;
  }
}
