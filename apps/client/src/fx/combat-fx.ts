import {
  clamp,
  ELEMENTAL_REACTIONS,
  type ElementalReactionId,
  type ElementType,
  i18n,
  type PropKind,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE, PLAYER_SLOT_COLORS } from '../art/palette.js';
import { RIG_DEFS_BY_ID } from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import {
  acquireDamageSlot,
  acquireParticleSlot,
  computeCameraShakeOffset,
  getActiveAfterimageCount,
  getActiveAmbientCount,
  getActiveDamagePopupCount,
  getActiveDecalCount,
  getActiveParticleCount,
  initCombatFxPools,
  type PooledAfterimage,
  type PooledAmbientParticle,
  type PooledDamageText,
  type PooledDecal,
  type PooledLightningArc,
  type PooledParticle,
  refreshResolution,
  update,
} from './combat-fx-pools.js';

export * from './combat-fx-pools.js';

/**
 * Object-pooled Combat FX, Decals, Dash Afterimages, Ambient Particles & Game Feel ("Juice") system:
 * - Hit-stop freeze frames (30-60ms)
 * - Trauma-based screen shake (Perlin-like harmonic noise)
 * - Pooled floating damage numbers (normal, crit, armor, player hurt, elemental color)
 * - Pooled vector sprites for muzzle flash, shell casings, sword slash arcs, sparks, dust, shards, and enemy death part bursts
 * - Persistent floor decal ring-buffer (scorch marks, monster splatters, frost scars)
 * - Dash afterimage ghost pool
 * - Ambient biome leaves & parallax mist pool
 */
export class CombatFxManager {
  public readonly particlePool: PooledParticle[] = [];
  public readonly damagePool: PooledDamageText[] = [];
  public readonly decalPool: PooledDecal[] = [];
  public readonly afterimagePool: PooledAfterimage[] = [];
  public readonly ambientPool: PooledAmbientParticle[] = [];
  public readonly lightningPool: PooledLightningArc[] = [];
  public lightningGraphics!: Phaser.GameObjects.Graphics;

  public decalWriteCursor = 0;
  public activeDecalCount = 0;
  public hitStopRemainingMs = 0;
  public trauma = 0;
  public shakeTime = 0;
  public popupSpreadIndex = 0;
  public currentBiome: 1 | 2 | 3 = 1;

  public totalHitStopsTriggered = 0;
  public totalShakesTriggered = 0;
  public totalSparksSpawned = 0;
  public totalDamagePopupsSpawned = 0;
  public totalDecalsSpawned = 0;
  public totalAfterimagesSpawned = 0;

  constructor(
    scene: Phaser.Scene,
    particleCapacity = 300,
    damageCapacity = 48,
    decalCapacity = 120,
    afterimageCapacity = 24,
    ambientCapacity = 36,
  ) {
    initCombatFxPools.call(
      this,
      scene,
      particleCapacity,
      damageCapacity,
      decalCapacity,
      afterimageCapacity,
      ambientCapacity,
    );
  }

  public setBiome(biome: 1 | 2 | 3): void {
    if (this.currentBiome === biome) return;
    this.currentBiome = biome;
    const invBake = 1 / TextureBaker.getBakeScale();
    for (let i = 0; i < this.ambientPool.length; i++) {
      const amb = this.ambientPool[i]!;
      if (amb.kind === 'mist') {
        amb.sprite.setTexture('fx_ambient_mist');
        if (biome === 2) {
          amb.sprite.setTint(hexToNum(PALETTE.CYAN_FROST));
        } else if (biome === 3) {
          amb.sprite.setTint(hexToNum(PALETTE.ASH_GRAY));
        } else {
          amb.sprite.clearTint();
        }
      } else {
        if (biome === 2) {
          amb.sprite.setTexture('fx_ice_shard');
          amb.sprite.setTint(hexToNum(PALETTE.ICE_WHITE));
          amb.vy = 22 + (i % 5) * 4;
        } else if (biome === 3) {
          amb.sprite.setTexture('fx_spark');
          amb.sprite.setTint(hexToNum(i % 2 === 0 ? PALETTE.FLAME_ORANGE : PALETTE.SOLAR_GOLD));
          amb.vy = -(18 + (i % 5) * 4);
        } else {
          amb.sprite.setTexture('fx_ambient_leaf');
          amb.sprite.clearTint();
          amb.vy = 14 + (i % 4) * 3;
        }
        amb.baseScale = invBake * (0.75 + (i % 3) * 0.15);
        amb.sprite.setScale(amb.baseScale);
      }
    }
  }

  public spawnFrostBreath(x: number, y: number, facingSign: number): void {
    const p = this.acquireParticleSlot();
    if (!p) return;
    const invBake = 1 / TextureBaker.getBakeScale();
    p.active = true;
    p.textureKey = 'fx_dust_puff';
    p.age = 0;
    p.ttl = 0.42;
    p.x = x + facingSign * 8;
    p.y = y - 10;
    p.vx = facingSign * (14 + Math.random() * 10);
    p.vy = -12 - Math.random() * 8;
    p.vr = 0;
    p.startScale = invBake * 0.55;
    p.endScale = invBake * 0.95;
    p.startAlpha = 0.52;
    p.gravityY = -8;
    p.damping = 2.5;

    p.sprite.setTexture(p.textureKey);
    p.sprite.setTint(hexToNum(PALETTE.ICE_WHITE));
    p.sprite.setPosition(p.x, p.y);
    p.sprite.setScale(p.startScale);
    p.sprite.setAlpha(p.startAlpha);
    p.sprite.setDepth(33);
    p.sprite.setVisible(true);
  }

  public refreshResolution(bakeScale: number, prevScale?: number): void {
    refreshResolution.call(this, bakeScale, prevScale);
  }

  public triggerHitStop(durationMs: number): void {
    this.hitStopRemainingMs = Math.max(this.hitStopRemainingMs, clamp(durationMs, 0, 65));
    this.totalHitStopsTriggered += 1;
  }

  public consumeHitStopDelta(rawDeltaMs: number): {
    simDeltaMs: number;
    isHitStopped: boolean;
  } {
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

  public computeCameraShakeOffset(dtSec: number): {
    offsetX: number;
    offsetY: number;
  } {
    return computeCameraShakeOffset.call(this, dtSec);
  }

  public spawnFloorDecal(
    kind: 'scorch' | 'splatter' | 'frost',
    x: number,
    y: number,
    scaleMult = 1.0,
  ): void {
    const maxAllowed = graphicsSettings.getBudget().maxDecals;
    if (maxAllowed <= 0) return;

    const idx = this.decalWriteCursor % Math.min(maxAllowed, this.decalPool.length);
    this.decalWriteCursor += 1;
    const slot = this.decalPool[idx];
    if (!slot) return;

    const invBake = 1 / TextureBaker.getBakeScale();
    const texKey =
      kind === 'scorch'
        ? 'fx_decal_scorch'
        : kind === 'frost'
          ? 'fx_decal_frost'
          : 'fx_decal_splatter';

    slot.active = true;
    slot.textureKey = texKey;
    slot.sprite.setTexture(texKey);
    slot.sprite.setPosition(x, y);
    slot.sprite.setRotation((this.decalWriteCursor * 1.17) % (Math.PI * 2));
    slot.sprite.setScale(invBake * scaleMult);
    slot.sprite.setAlpha(0.82);
    slot.sprite.setVisible(true);

    this.totalDecalsSpawned += 1;
    this.activeDecalCount = Math.min(maxAllowed, this.activeDecalCount + 1);
  }

  public spawnDashAfterimage(
    x: number,
    y: number,
    facingSign: number,
    slot: 1 | 2 | 3 | 4 = 1,
  ): void {
    for (let i = 0; i < this.afterimagePool.length; i++) {
      const ghost = this.afterimagePool[i]!;
      if (!ghost.active) {
        const invBake = 1 / TextureBaker.getBakeScale();
        ghost.active = true;
        ghost.age = 0;
        ghost.ttl = 0.22;
        ghost.startAlpha = 0.55;
        ghost.sprite.setPosition(x, y - 14);
        ghost.sprite.setScale(invBake * (facingSign >= 0 ? 1 : -1), invBake);
        ghost.sprite.setTint(hexToNum(PLAYER_SLOT_COLORS[slot].hex));
        ghost.sprite.setAlpha(ghost.startAlpha);
        ghost.sprite.setVisible(true);
        this.totalAfterimagesSpawned += 1;
        return;
      }
    }
  }

  public spawnChainLightningArc(fromX: number, fromY: number, toX: number, toY: number): void {
    for (let i = 0; i < this.lightningPool.length; i++) {
      const arc = this.lightningPool[i]!;
      if (!arc.active) {
        arc.active = true;
        arc.fromX = fromX;
        arc.fromY = fromY;
        arc.toX = toX;
        arc.toY = toY;
        arc.age = 0;
        arc.ttl = 0.16;
        arc.seed = this.totalSparksSpawned + i * 17;
        return;
      }
    }
  }

  public spawnGrassRustle(x: number, y: number): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    for (let i = 0; i < 3; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;
      const ang = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.6;
      const spd = 25 + Math.random() * 35;
      p.active = true;
      p.textureKey = 'fx_ambient_leaf';
      p.age = 0;
      p.ttl = 0.35;
      p.x = x + (Math.random() - 0.5) * 12;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 15;
      p.vr = (Math.random() - 0.5) * 10;
      p.startScale = invBake * 0.95;
      p.endScale = invBake * 0.4;
      p.startAlpha = 0.9;
      p.gravityY = 90;
      p.damping = 3;

      p.sprite.setTexture(p.textureKey);
      p.sprite.clearTint();
      p.sprite.setPosition(p.x, p.y);
      p.sprite.setScale(p.startScale);
      p.sprite.setAlpha(p.startAlpha);
      p.sprite.setDepth(32);
      p.sprite.setVisible(true);
    }
  }

  public spawnPropBreakBurst(kind: PropKind, x: number, y: number): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    if (kind === 'explosive_barrel') {
      this.spawnFloorDecal('scorch', x, y, 1.25);
      return;
    }

    this.spawnFloorDecal('scorch', x, y, 0.65);
    const count = 8;
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;
      const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const spd = 65 + Math.random() * 85;
      p.active = true;
      p.textureKey = 'fx_wood_shard';
      p.age = 0;
      p.ttl = 0.45;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 30;
      p.vr = (Math.random() - 0.5) * 16;
      p.startScale = invBake * 1.05;
      p.endScale = invBake * 0.45;
      p.startAlpha = 1;
      p.gravityY = 200;
      p.damping = 4;

      p.sprite.setTexture(p.textureKey);
      if (kind === 'clay_vase') {
        p.sprite.setTint(hexToNum(PALETTE.COPPER_LIGHT));
      } else {
        p.sprite.clearTint();
      }
      p.sprite.setPosition(p.x, p.y);
      p.sprite.setRotation(ang);
      p.sprite.setScale(p.startScale);
      p.sprite.setAlpha(1);
      p.sprite.setDepth(38);
      p.sprite.setVisible(true);
    }
  }

  public spawnStatusBurst(
    status: 'burn' | 'chill' | 'frozen' | 'shock' | 'poison' | 'shatter' | 'marked' | 'rooted',
    x: number,
    y: number,
  ): void {
    if (status === 'marked' || status === 'rooted') {
      this.spawnHitSparks(x, y - 10, -Math.PI / 2, {
        isCrit: status === 'marked',
        element: status === 'rooted' ? 'poison' : 'none',
        count: 6,
      });
      return;
    }
    if (status === 'frozen' || status === 'shatter') {
      this.spawnFloorDecal('frost', x, y, status === 'shatter' ? 1.2 : 0.9);
      const invBake = 1 / TextureBaker.getBakeScale();
      const shardCount = status === 'shatter' ? 10 : 5;
      for (let i = 0; i < shardCount; i++) {
        const p = this.acquireParticleSlot();
        if (!p) break;
        const ang = (i / shardCount) * Math.PI * 2;
        const spd = status === 'shatter' ? 110 + Math.random() * 70 : 55;
        p.active = true;
        p.textureKey = 'fx_ice_shard';
        p.age = 0;
        p.ttl = 0.35;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(ang) * spd;
        p.vy = Math.sin(ang) * spd - 20;
        p.vr = 10;
        p.startScale = invBake * 1.1;
        p.endScale = invBake * 0.3;
        p.startAlpha = 1;
        p.gravityY = 120;
        p.damping = 4;

        p.sprite.setTexture(p.textureKey);
        p.sprite.clearTint();
        p.sprite.setPosition(p.x, p.y);
        p.sprite.setScale(p.startScale);
        p.sprite.setAlpha(1);
        p.sprite.setDepth(56);
        p.sprite.setVisible(true);
      }
    }
  }

  public spawnElementalReactionFx(params: {
    reaction: ElementalReactionId;
    x: number;
    y: number;
    damage: number;
    isTeamCombo: boolean;
  }): void {
    const meta = ELEMENTAL_REACTIONS[params.reaction];
    this.spawnExplosionBurst(
      params.x,
      params.y,
      params.isTeamCombo ? 84 : 62,
      meta?.colorHex ?? PALETTE.SOLAR_GOLD,
    );

    // Count nearby active large popups to stagger vertical height and prevent overlap
    let nearbyCount = 0;
    for (let i = 0; i < this.damagePool.length; i++) {
      const existing = this.damagePool[i]!;
      if (
        existing.active &&
        existing.baseScale >= 1.1 &&
        Math.abs(existing.x - params.x) < 110 &&
        Math.abs(existing.y - (params.y - 48)) < 64
      ) {
        nearbyCount += 1;
      }
    }
    const yStagger = nearbyCount * 22;

    const rxSlot = this.acquireDamageSlot();
    if (rxSlot) {
      this.totalDamagePopupsSpawned += 1;
      rxSlot.active = true;
      rxSlot.age = 0;
      rxSlot.ttl = 1.05;
      rxSlot.x = params.x;
      rxSlot.y = params.y - 40 - yStagger;
      rxSlot.vx = 0;
      rxSlot.vy = -68;
      rxSlot.baseScale = 1.18;

      const rxText = i18n.getReactionText(params.reaction);
      const label = `${(rxText.name || meta?.nameVi || params.reaction).toUpperCase()}! +${params.damage}`;
      rxSlot.text.setText(label);
      rxSlot.text.setColor(meta?.colorHex ?? PALETTE.SOLAR_GOLD);
      rxSlot.text.setPosition(rxSlot.x, rxSlot.y);
      rxSlot.text.setScale(rxSlot.baseScale * 1.2);
      rxSlot.text.setAlpha(1);
      rxSlot.text.setVisible(true);
      rxSlot.text.setActive(true);
    }

    if (params.isTeamCombo) {
      const comboSlot = this.acquireDamageSlot();
      if (comboSlot) {
        this.totalDamagePopupsSpawned += 1;
        comboSlot.active = true;
        comboSlot.age = 0;
        comboSlot.ttl = 1.25;
        comboSlot.x = params.x;
        comboSlot.y = params.y - 64 - yStagger;
        comboSlot.vx = 0;
        comboSlot.vy = -74;
        comboSlot.baseScale = 1.26;

        const comboLabel =
          i18n.getLocale() === 'en' ? '⚡ TEAM COMBO! +15 EN' : '⚡ ĐỒNG ĐỘI COMBO! +15 NL';
        comboSlot.text.setText(comboLabel);
        comboSlot.text.setColor(PALETTE.SOLAR_GOLD);
        comboSlot.text.setPosition(comboSlot.x, comboSlot.y);
        comboSlot.text.setScale(comboSlot.baseScale * 1.2);
        comboSlot.text.setAlpha(1);
        comboSlot.text.setVisible(true);
        comboSlot.text.setActive(true);
      }
    }
  }

  public spawnDamagePopup(params: {
    x: number;
    y: number;
    amount: number;
    isCrit: boolean;
    targetKind: 'player' | 'enemy';
    hitArmor: boolean;
    element?: ElementType;
  }): void {
    if (!graphicsSettings.getState().showDamageNumbers) return;
    const slot = this.acquireDamageSlot();
    if (!slot) return;

    this.totalDamagePopupsSpawned += 1;
    const fanIdx = this.popupSpreadIndex++ % 5;
    const fanLane = fanIdx - 2;

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
    } else if (params.element === 'burn') {
      color = PALETTE.FLAME_ORANGE;
    } else if (params.element === 'chill') {
      color = PALETTE.CYAN_FROST;
    } else if (params.element === 'shock') {
      color = PALETTE.VOLT_YELLOW;
    } else if (params.element === 'poison') {
      color = PALETTE.LIME_GLOW;
    }

    slot.text.setText(label);
    slot.text.setColor(color);
    slot.text.setPosition(slot.x, slot.y);
    slot.text.setScale(slot.baseScale * 1.25);
    slot.text.setAlpha(1);
    slot.text.setVisible(true);
    slot.text.setActive(true);
  }

  public spawnMuzzleFlashAndCasing(
    x: number,
    y: number,
    angleRad: number,
    isShotgun = false,
  ): void {
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
    options: {
      isCrit?: boolean;
      hitWall?: boolean;
      blockedByShield?: boolean;
      element?: ElementType;
      count?: number;
    } = {},
  ): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    const budgetRatio = graphicsSettings.getBudget().particleBudgetRatio;
    const rawCount = options.count ?? (options.isCrit ? 10 : 6);
    const count = Math.max(1, Math.round(rawCount * budgetRatio));
    this.totalSparksSpawned += count;

    let tint = hexToNum(PALETTE.CYAN_FROST);
    if (options.element === 'burn') tint = hexToNum(PALETTE.FLAME_ORANGE);
    else if (options.element === 'chill') tint = hexToNum(PALETTE.CYAN_FROST);
    else if (options.element === 'shock') tint = hexToNum(PALETTE.VOLT_YELLOW);
    else if (options.element === 'poison') tint = hexToNum(PALETTE.LIME_GLOW);
    else if (options.isCrit) tint = hexToNum(PALETTE.SOLAR_GOLD);
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
   * Section 3.3 & 3.5: Enemy death breaks cutout rig parts apart, fades out, and leaves a persistent splatter decal.
   */
  public spawnEnemyDeathBurst(defId: string, x: number, y: number): void {
    this.spawnFloorDecal('splatter', x, y + 6, 1.0);

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

  public spawnExplosionBurst(
    x: number,
    y: number,
    radius: number,
    colorHex: string = PALETTE.TOXIC_PURPLE,
  ): void {
    this.spawnFloorDecal('scorch', x, y, clamp(radius / 64, 0.8, 1.5));

    const invBake = 1 / TextureBaker.getBakeScale();
    const tint = hexToNum(colorHex);
    const count = Math.max(6, Math.round(16 * graphicsSettings.getBudget().particleBudgetRatio));
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;
      const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
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
      p.sprite.setTint(i % 3 === 0 ? hexToNum(PALETTE.SOLAR_GOLD) : tint);
      p.sprite.setPosition(p.x, p.y);
      p.sprite.setRotation(ang);
      p.sprite.setScale(p.startScale);
      p.sprite.setAlpha(1);
      p.sprite.setDepth(58);
      p.sprite.setVisible(true);
    }
  }

  public update(dtSec: number, camView?: Phaser.Geom.Rectangle): void {
    update.call(this, dtSec, camView);
  }

  public getActiveDamagePopupCount(): number {
    return getActiveDamagePopupCount.call(this);
  }

  public getActiveParticleCount(): number {
    return getActiveParticleCount.call(this);
  }

  public getActiveDecalCount(): number {
    return getActiveDecalCount.call(this);
  }

  public getActiveAfterimageCount(): number {
    return getActiveAfterimageCount.call(this);
  }

  public getActiveAmbientCount(): number {
    return getActiveAmbientCount.call(this);
  }

  public acquireParticleSlot(): PooledParticle | null {
    return acquireParticleSlot.call(this);
  }

  public acquireDamageSlot(): PooledDamageText | null {
    return acquireDamageSlot.call(this);
  }
}
