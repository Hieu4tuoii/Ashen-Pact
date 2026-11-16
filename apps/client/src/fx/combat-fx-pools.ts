import { clamp, WORLD_VIEW_HEIGHT, WORLD_VIEW_WIDTH } from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { easeInOutCubic, easeOutBack, easeOutCubic } from '../art/easing.js';
import { hexToNum, PALETTE } from '../art/palette.js';
import { TextureBaker } from '../art/texture-baker.js';
import { getVisualQueryConfig } from '../core/visual-query.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import type { CombatFxManager } from './combat-fx.js';
import {
  applyBiomeToAmbientSlot,
  computeFxParticleScale,
  computeShellCasingShadowOffset,
  computeTorchMotePosition,
  type FxEaseCurve,
  resolveAmbientBudgetCount,
} from './combat-fx-spawners.js';
import {
  fillTaperedArcRibbon,
  fillTaperedLightningBolt,
} from './tapered-ribbon-builder.js';
import {
  ALL_CUTOUT_KIT_FRAME_KEYS,
} from '../art/texture-baker-fx.js';

const CUTOUT_KIT_SET = new Set<string>(ALL_CUTOUT_KIT_FRAME_KEYS);
export function isCutoutKitFrame(key: string): boolean {
  return CUTOUT_KIT_SET.has(key);
}

export const BIOME_AMBIENT_POOL_SLOTS = 80;
export const TORCH_MOTE_POOL_SLOTS = 16;

export interface PooledParticle {
  sprite: Phaser.GameObjects.Sprite;
  shadowSprite?: Phaser.GameObjects.Sprite;
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
  blendMode: 'NORMAL' | 'ADD';
  easeCurve: FxEaseCurve;
  scaleRatioY: number;
  flipY?: boolean;
  alignToVelocity: boolean;
  hasGroundShadow: boolean;
  depth?: number;
  baseFrame?: number;
  frameCount?: number;
  frameName?: string;
  kitFramePrefix?: string;
  preserveFlipbookAlpha?: boolean;
}

export interface ActivePerimeterRing {
  active: boolean;
  x: number;
  y: number;
  targetRadiusPx: number;
  currentRadiusPx: number;
  colorNum: number;
  alpha: number;
  age: number;
  ttl: number;
}

export interface ActiveArcRibbon {
  active: boolean;
  x: number;
  y: number;
  reachPx: number;
  angleRad: number;
  arcSpreadRad: number;
  colorNum: number;
  alpha: number;
  age: number;
  ttl: number;
}

export interface ActiveFloorTeleportFold {
  active: boolean;
  x: number;
  y: number;
  age: number;
  ttl: number;
}

export const DAMAGE_NUMERIC_SLOT_END = 42 as const;

export interface PooledDamageText {
  text: Phaser.GameObjects.Text;
  active: boolean;
  x: number;
  y: number;
  originX?: number;
  originY?: number;
  cellSlotIndex?: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  baseScale: number;
  targetId?: number;
  lastMergeMs?: number;
  accumulatedAmount?: number;
}

export interface PooledDecal {
  sprite: Phaser.GameObjects.Sprite;
  textureKey: string;
  active: boolean;
}

export interface PooledAfterimage {
  sprite: Phaser.GameObjects.Sprite;
  active: boolean;
  age: number;
  ttl: number;
  startAlpha: number;
}

export interface PooledAmbientParticle {
  sprite: Phaser.GameObjects.Sprite;
  kind: 'leaf' | 'firefly' | 'snow' | 'ember' | 'torch_mote';
  parallaxLayer: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  baseScale: number;
  anchorX?: number;
  anchorY?: number;
}

export interface PooledLightningArc {
  active: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  age: number;
  ttl: number;
  seed: number;
}

export function initCombatFxPools(
  this: CombatFxManager,
  scene: Phaser.Scene,
  particleCapacity = 300,
  damageCapacity = 48,
  decalCapacity = 120,
  afterimageCapacity = 24,
  ambientCapacity = 96,
): void {
  const invBake = 1 / TextureBaker.getBakeScale();
  const textRes = TextureBaker.getBakeScale();

  // 1. Persistent Floor Decals (depth 6, above floor/surfaces, below walls/entities)
  for (let i = 0; i < decalCapacity; i++) {
    const sprite = scene.add.sprite(-1000, -1000, 'fx_decal_scorch');
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setScale(invBake);
    sprite.setAlpha(0.32);
    sprite.setDepth(6);
    this.decalPool.push({
      sprite,
      textureKey: 'fx_decal_scorch',
      active: false,
    });
  }

  // 2. Dash Afterimage Ghosts (depth 26, right behind player/enemies)
  for (let i = 0; i < afterimageCapacity; i++) {
    const sprite = scene.add.sprite(-1000, -1000, 'fx_afterimage_vanguard');
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setScale(invBake);
    sprite.setDepth(26);
    this.afterimagePool.push({
      sprite,
      active: false,
      age: 0,
      ttl: 0.24,
      startAlpha: 0.55,
    });
  }

  // 3. Main Combat Particle Pool + Ground Shadows (shadow at depth 19)
  for (let i = 0; i < particleCapacity; i++) {
    const sprite = scene.add.sprite(-1000, -1000, 'fx_spark');
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setScale(invBake);
    sprite.setDepth(45);

    const shadowSprite = scene.add.sprite(-1000, -1000, 'fx_dust_puff');
    shadowSprite.setVisible(false);
    shadowSprite.setActive(false);
    shadowSprite.setTint(hexToNum(PALETTE.INK_DARK));
    shadowSprite.setScale(invBake * 0.5, invBake * 0.32);
    shadowSprite.setDepth(19);

    this.particlePool.push({
      sprite,
      shadowSprite,
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
      blendMode: 'ADD',
      easeCurve: 'linear',
      scaleRatioY: 1,
      alignToVelocity: false,
      hasGroundShadow: false,
      frameCount: 1,
      preserveFlipbookAlpha: false,
    });
  }

  // 4. Clear Biome Ambient Pool (0..79 biome particles + 80..95 torch brazier dust motes; ZERO mist)
  const tier = graphicsSettings.getBudget().tier;
  const biomeSlots = Math.min(BIOME_AMBIENT_POOL_SLOTS, ambientCapacity);
  for (let i = 0; i < ambientCapacity; i++) {
    if (i < biomeSlots) {
      const initX = (i * 97) % 1100;
      let initY = (i * 61) % 680;
      if (initX >= 420 && initX <= 540 && initY >= 240 && initY <= 340) {
        initY = (initY + 110) % 680;
      }
      const sprite = scene.add.sprite(initX, initY, 'fx_ambient_leaf');
      const amb: PooledAmbientParticle = {
        sprite,
        kind: 'leaf',
        parallaxLayer: i % 2 === 0 ? 0 : 1,
        x: initX,
        y: initY,
        vx: 16,
        vy: 14,
        swayAmp: 10,
        swayFreq: 2.0,
        phase: i * 0.7,
        baseScale: invBake,
      };
      applyBiomeToAmbientSlot(amb, i, this.currentBiome, tier, this.isBlizzardIntense(), invBake);
      this.ambientPool.push(amb);
    } else {
      const sprite = scene.add.sprite(-1000, -1000, 'fx_ember_mote');
      const baseScale = invBake * 0.82;
      sprite.setScale(baseScale);
      sprite.setBlendMode('ADD');
      sprite.setTint(hexToNum(i % 2 === 0 ? PALETTE.SOLAR_GOLD : PALETTE.FLAME_ORANGE));
      sprite.setDepth(36);
      sprite.setVisible(false);
      this.ambientPool.push({
        sprite,
        kind: 'torch_mote',
        parallaxLayer: i % 2 === 0 ? 0 : 1,
        x: -1000,
        y: -1000,
        vx: 0,
        vy: 0,
        swayAmp: 8,
        swayFreq: 2.1 + (i % 3) * 0.25,
        phase: i * 0.85,
        baseScale,
      });
    }
  }

  // 5. Chain Lightning & Ribbon Graphics (depth 44.0: strictly below bullets & sightlines)
  const sceneWithGfx = scene as unknown as {
    underActorGraphics?: Phaser.GameObjects.Graphics;
    weaponRibbonGraphics?: Phaser.GameObjects.Graphics;
  };
  if (!this.underActorGraphics) {
    this.underActorGraphics =
      sceneWithGfx.underActorGraphics ?? (scene.add ? scene.add.graphics() : ({} as Phaser.GameObjects.Graphics));
    if (this.underActorGraphics && typeof this.underActorGraphics.setDepth === 'function') {
      this.underActorGraphics.setDepth(26.6);
    }
  }
  sceneWithGfx.underActorGraphics = this.underActorGraphics;

  if (!this.weaponRibbonGraphics) {
    this.weaponRibbonGraphics =
      sceneWithGfx.weaponRibbonGraphics ?? (scene.add ? scene.add.graphics() : ({} as Phaser.GameObjects.Graphics));
    if (this.weaponRibbonGraphics && typeof this.weaponRibbonGraphics.setDepth === 'function') {
      this.weaponRibbonGraphics.setDepth(44.0);
    }
  }
  sceneWithGfx.weaponRibbonGraphics = this.weaponRibbonGraphics;
  this.lightningGraphics = scene.add ? scene.add.graphics() : (this.weaponRibbonGraphics as unknown as Phaser.GameObjects.Graphics);
  if (this.lightningGraphics && typeof this.lightningGraphics.setDepth === 'function') {
    this.lightningGraphics.setDepth(44.0);
  }
  for (let i = 0; i < 16; i++) {
    this.lightningPool.push({
      active: false,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0,
      age: 0,
      ttl: 0.16,
      seed: i + 1,
    });
  }

  if (!this.floorFoldGraphics) {
    this.floorFoldGraphics = scene.add ? scene.add.graphics() : ({} as Phaser.GameObjects.Graphics);
    if (this.floorFoldGraphics && typeof this.floorFoldGraphics.setDepth === 'function') {
      this.floorFoldGraphics.setDepth(15.0);
    }
  }
  for (let i = 0; i < 8; i++) {
    this.floorFoldFreePool.push({
      active: false,
      x: 0,
      y: 0,
      age: 0,
      ttl: 0.32,
    });
  }

  // 6. Floating Damage Text Pool
  const popupRes = Math.min(2, textRes);
  for (let i = 0; i < damageCapacity; i++) {
    const text = scene.add
      .text(-1000, -1000, '', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '14px',
        fontStyle: '800',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3.5,
        resolution: popupRes,
        padding: { top: 4, bottom: 3, left: 2, right: 2 },
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

export function refreshResolution(
  this: CombatFxManager,
  bakeScale: number,
  prevScale?: number,
): void {
  const invBake = 1 / bakeScale;
  const scaleRatio = prevScale && prevScale > 0 ? prevScale / bakeScale : 1;
  for (const p of this.particlePool) {
    if (p.frameCount && p.frameCount > 1) {
      const frameIdx = Math.min(
        p.frameCount - 1,
        Math.max(0, Math.floor((p.age / Math.max(0.01, p.ttl)) * p.frameCount + 1e-6)),
      );
      p.sprite.setTexture(p.textureKey, frameIdx);
    } else {
      p.sprite.setTexture(p.textureKey);
    }
    if (p.shadowSprite) {
      p.shadowSprite.setTexture('fx_dust_puff');
    }
    if (p.active && scaleRatio !== 1 && !(p.frameCount && p.frameCount > 1)) {
      p.startScale *= scaleRatio;
      p.endScale *= scaleRatio;
    } else if (!p.active) {
      p.sprite.setScale(invBake);
    }
  }
  for (const d of this.decalPool) {
    d.sprite.setTexture(d.textureKey);
    d.sprite.setScale(invBake);
  }
  for (const a of this.afterimagePool) {
    a.sprite.setTexture('fx_afterimage_vanguard');
    a.sprite.setScale(invBake * Math.sign(a.sprite.scaleX || 1), invBake);
  }
  const tier = graphicsSettings.getBudget().tier;
  const isBlizzard = this.currentBiome === 2 && this.isBlizzardIntense();
  for (let i = 0; i < this.ambientPool.length; i++) {
    const amb = this.ambientPool[i]!;
    if (i < BIOME_AMBIENT_POOL_SLOTS) {
      applyBiomeToAmbientSlot(amb, i, this.currentBiome, tier, isBlizzard, invBake);
    } else {
      amb.sprite.setTexture('fx_ember_mote');
      amb.baseScale = invBake * 0.82;
      amb.sprite.setScale(amb.baseScale);
    }
  }
  const popupRes = Math.min(2, bakeScale);
  for (const item of this.damagePool) {
    if (item.text.style.resolution !== popupRes) {
      item.text.setResolution(popupRes);
    }
  }
}

export function computeCameraShakeOffset(
  this: CombatFxManager,
  dtSec: number,
): {
  offsetX: number;
  offsetY: number;
} {
  this.shakeTime += dtSec;
  if (this.trauma <= 0.001) {
    this.trauma = 0;
    return { offsetX: 0, offsetY: 0 };
  }

  this.trauma = Math.max(0, this.trauma - dtSec * 2.1);
  const shakeIntensity = graphicsSettings.getState().screenShakeIntensity;
  const shakePower = this.trauma * this.trauma * shakeIntensity;
  const maxOffset = 5.5;

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

export function update(this: CombatFxManager, dtSec: number, camView?: Phaser.Geom.Rectangle): void {
  if (this.bossKillSlowMoTimer > 0) {
    this.bossKillSlowMoTimer = Math.max(0, this.bossKillSlowMoTimer - dtSec);
  }
  if (this.bossKillFlashTimer > 0) {
    this.bossKillFlashTimer = Math.max(0, this.bossKillFlashTimer - dtSec);
  }

  // 1. Update pooled particles, 14-frame Chiaroscuro flipbooks & shell casing ground shadows
  for (let i = 0; i < this.particlePool.length; i++) {
    const p = this.particlePool[i]!;
    if (!p.active) continue;

    p.age += dtSec;
    if (p.age >= p.ttl) {
      p.active = false;
      p.sprite.setVisible(false);
      if (p.shadowSprite?.visible) {
        p.shadowSprite.setVisible(false);
      }
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
    if (p.alignToVelocity) {
      p.sprite.setRotation(Math.atan2(p.vy, p.vx));
    } else if (p.vr !== 0) {
      p.sprite.rotation += p.vr * dtSec;
    }

    if (p.frameCount && p.frameCount > 1) {
      const frameOffset = Math.min(
        p.frameCount - 1,
        Math.max(0, Math.floor(progress * p.frameCount + 1e-6)),
      );
      const targetFrame = (p.baseFrame ?? 0) + frameOffset;
      if (p.kitFramePrefix) {
        p.sprite.setFrame(`${p.kitFramePrefix}_${targetFrame}`);
      } else if (isCutoutKitFrame(p.textureKey)) {
        p.sprite.setFrame(`${p.textureKey}_${targetFrame}`);
      } else {
        p.sprite.setFrame(targetFrame);
      }
    }

    const scale = computeFxParticleScale(p.startScale, p.endScale, progress, p.easeCurve);
    p.sprite.setScale(scale, scale * (p.scaleRatioY || 1));

    // Shader flipbooks dissolve organically via FBM noise threshold; keep alpha crisp until tail release
    const nextAlpha = p.preserveFlipbookAlpha
      ? progress > 0.55
        ? p.startAlpha * (1 - (progress - 0.55) / 0.45)
        : p.startAlpha
      : p.startAlpha * (1 - progress);
    p.sprite.setAlpha(nextAlpha);

    if (p.hasGroundShadow && p.shadowSprite) {
      const sh = computeShellCasingShadowOffset(p.age, p.ttl);
      p.shadowSprite.setPosition(p.x, p.y + sh.offsetY);
      p.shadowSprite.setScale(p.startScale * sh.scale, p.startScale * sh.scale * 0.65);
      p.shadowSprite.setAlpha(sh.alpha);
    }
  }

  // 2. Update dash afterimages
  for (let i = 0; i < this.afterimagePool.length; i++) {
    const a = this.afterimagePool[i]!;
    if (!a.active) continue;
    a.age += dtSec;
    if (a.age >= a.ttl) {
      a.active = false;
      a.sprite.setVisible(false);
      continue;
    }
    a.sprite.setAlpha(a.startAlpha * (1 - a.age / a.ttl));
  }

  // 3. Enforce decal budget dynamically, deduplicate overlapping floor decals & fade out over 6s
  const budget = graphicsSettings.getBudget();
  const maxDecals = budget.maxDecals;
  let activeDecalsCounted = 0;
  for (let i = 0; i < this.decalPool.length; i++) {
    const d = this.decalPool[i]! as PooledDecal & { age?: number; ttl?: number };
    if (!d.active) continue;
    if (i >= maxDecals) {
      d.active = false;
      d.sprite.setVisible(false);
      continue;
    }
    const spr = d.sprite as unknown as {
      x?: number;
      y?: number;
      alpha?: number;
      setAlpha?: (a: number) => void;
      setVisible: (v: boolean) => void;
    };
    if (d.age === undefined || d.age === 0) {
      d.age = dtSec;
      d.ttl = 6.0;
      spr.setAlpha?.(0.32);
      const dx0 = spr.x ?? 0;
      const dy0 = spr.y ?? 0;
      for (let j = 0; j < this.decalPool.length; j++) {
        if (j === i) continue;
        const other = this.decalPool[j]!;
        if (!other.active) continue;
        if (!d.textureKey?.includes('scorch') || !other.textureKey?.includes('scorch')) continue;
        const ospr = other.sprite as unknown as { x?: number; y?: number; alpha?: number };
        const ox = (ospr.x ?? 0) - dx0;
        const oy = (ospr.y ?? 0) - dy0;
        if (ox * ox + oy * oy <= 24 * 24) {
          if (j < i) {
            other.active = false;
            other.sprite.setVisible(false);
            activeDecalsCounted = Math.max(0, activeDecalsCounted - 1);
          }
        }
      }
    } else {
      d.age = (d.age ?? 0) + dtSec;
      const ttl = d.ttl ?? 6.0;
      if (d.age >= ttl) {
        d.active = false;
        spr.setVisible(false);
        continue;
      }
      const fade = 0.32 * (1 - Math.pow(d.age / ttl, 1.8));
      spr.setAlpha?.(fade);
    }
    activeDecalsCounted += 1;
  }
  this.activeDecalCount = activeDecalsCounted;

  const isBlizzard = this.currentBiome === 2 && this.isBlizzardIntense();
  const allowedAmbient = Math.min(
    BIOME_AMBIENT_POOL_SLOTS,
    resolveAmbientBudgetCount(this.currentBiome, budget.tier, isBlizzard),
  );
  const viewW = camView && camView.width > 0 ? camView.width : WORLD_VIEW_WIDTH;
  const viewH = camView && camView.height > 0 ? camView.height : WORLD_VIEW_HEIGHT;
  const minX = camView && camView.width > 0 ? camView.x - 40 : 0;
  const maxX = minX + viewW + 80;
  const minY = camView && camView.height > 0 ? camView.y - 40 : 0;
  const maxY = minY + viewH + 80;
  const ambDt =
    getVisualQueryConfig().freeze && !this.allowFreezeAmbientMotion ? 0 : dtSec;

  const biomeLimit = Math.min(BIOME_AMBIENT_POOL_SLOTS, this.ambientPool.length);
  for (let i = 0; i < biomeLimit; i++) {
    const amb = this.ambientPool[i]!;
    if (i >= allowedAmbient) {
      if (amb.sprite.visible) amb.sprite.setVisible(false);
      continue;
    }
    if (!amb.sprite.visible) amb.sprite.setVisible(true);

    amb.phase += ambDt * amb.swayFreq;
    amb.x += (amb.vx + Math.sin(amb.phase) * amb.swayAmp) * ambDt;
    amb.y += amb.vy * ambDt;

    if (amb.x > maxX) amb.x = minX;
    else if (amb.x < minX) amb.x = maxX;
    if (amb.y > maxY) amb.y = minY;
    else if (amb.y < minY) amb.y = maxY;

    amb.sprite.setPosition(amb.x, amb.y);
    if (amb.kind === 'firefly') {
      amb.sprite.setRotation(0);
      amb.sprite.setAlpha(0.38 + 0.48 * (0.5 + 0.5 * Math.sin(amb.phase * 1.6)));
    } else if (amb.kind === 'snow') {
      amb.sprite.setRotation(
        isBlizzard ? -0.45 + Math.sin(amb.phase) * 0.18 : Math.sin(amb.phase * 0.5) * 0.25,
      );
    } else if (amb.kind === 'ember') {
      amb.sprite.setRotation(0);
      amb.sprite.setAlpha(
        (amb.parallaxLayer === 1 ? 0.65 : 0.48) + 0.22 * (0.5 + 0.5 * Math.sin(amb.phase * 1.9)),
      );
    } else {
      amb.sprite.setRotation(Math.sin(amb.phase) * 0.6);
    }
  }

  // Torch Brazier warm light pool dust motes (indices 80..95)
  const torches = this.torchPositions;
  const showTorchMotes = budget.tier === 'high' && torches.length > 0;
  for (let i = BIOME_AMBIENT_POOL_SLOTS; i < this.ambientPool.length; i++) {
    const amb = this.ambientPool[i]!;
    if (!showTorchMotes) {
      if (amb.sprite.visible) amb.sprite.setVisible(false);
      continue;
    }
    const moteIdx = i - BIOME_AMBIENT_POOL_SLOTS;
    const torch = torches[moteIdx % torches.length]!;
    amb.phase += ambDt * amb.swayFreq;
    const pos = computeTorchMotePosition(torch.x, torch.y - 6, amb.phase, moteIdx);
    amb.x = pos.x;
    amb.y = pos.y;
    amb.anchorX = torch.x;
    amb.anchorY = torch.y - 6;
    amb.sprite.setPosition(pos.x, pos.y);
    amb.sprite.setAlpha(pos.alpha);
    if (!amb.sprite.visible) amb.sprite.setVisible(true);
  }

  // 4. Update & draw Cutout branched chain lightning arcs on weaponRibbonGraphics (depth 44.0)
  if (this.weaponRibbonGraphics) {
    this.weaponRibbonGraphics.clear();
  }
  if (this.lightningGraphics) {
    this.lightningGraphics.clear();
  }
  for (let i = 0; i < this.lightningPool.length; i++) {
    const arc = this.lightningPool[i]!;
    if (!arc.active) continue;
    arc.age += dtSec;
    if (arc.age >= arc.ttl) {
      arc.active = false;
      continue;
    }
    const progress = arc.age / arc.ttl;
    if (this.weaponRibbonGraphics) {
      fillTaperedLightningBolt(
        this.weaponRibbonGraphics,
        arc.fromX,
        arc.fromY,
        arc.toX,
        arc.toY,
        3.2,
        0xfffdf5,
        1 - progress,
        arc.seed,
      );
    }
  }

  // 4b. Draw perimeter rings and arc ribbons on underActorGraphics (depth 26.6)
  if (this.underActorGraphics) {
    this.underActorGraphics.clear();
    let writeRingIdx = 0;
    for (let i = 0; i < this.activePerimeterRings.length; i++) {
      const ring = this.activePerimeterRings[i]!;
      if (!ring.active) continue;
      ring.age += dtSec;
      if (ring.age >= ring.ttl) {
        ring.active = false;
        this.perimeterRingFreePool.push(ring);
        continue;
      }
      const rProgress = Math.min(1, ring.age / 0.05);
      const curR = ring.currentRadiusPx + (ring.targetRadiusPx - ring.currentRadiusPx) * rProgress;
      const alpha = ring.alpha * (1 - ring.age / ring.ttl);

      // Render as pointed fillTaperedArcRibbon crescents on underActorGraphics with inkPadPx = 1.80
      fillTaperedArcRibbon(
        this.underActorGraphics,
        ring.x,
        ring.y,
        curR,
        -Math.PI * 0.95,
        0.05 * Math.PI,
        3.6,
        ring.colorNum,
        alpha,
        8,
        1.80,
      );
      fillTaperedArcRibbon(
        this.underActorGraphics,
        ring.x,
        ring.y,
        curR,
        0.05 * Math.PI,
        1.05 * Math.PI,
        3.6,
        ring.colorNum,
        alpha,
        8,
        1.80,
      );

      if (writeRingIdx !== i) {
        this.activePerimeterRings[writeRingIdx] = ring;
      }
      writeRingIdx++;
    }
    this.activePerimeterRings.length = writeRingIdx;

    let writeRibbonIdx = 0;
    for (let i = 0; i < this.activeArcRibbons.length; i++) {
      const ribbon = this.activeArcRibbons[i]!;
      if (!ribbon.active) continue;
      ribbon.age += dtSec;
      if (ribbon.age >= ribbon.ttl) {
        ribbon.active = false;
        this.arcRibbonFreePool.push(ribbon);
        continue;
      }
      const halfSpread = ribbon.arcSpreadRad * 0.5;
      fillTaperedArcRibbon(
        this.underActorGraphics,
        ribbon.x,
        ribbon.y,
        ribbon.reachPx,
        ribbon.angleRad - halfSpread,
        ribbon.angleRad + halfSpread,
        3.5,
        ribbon.colorNum,
        ribbon.alpha * (1 - ribbon.age / ribbon.ttl),
        8,
        1.80,
      );

      if (writeRibbonIdx !== i) {
        this.activeArcRibbons[writeRibbonIdx] = ribbon;
      }
      writeRibbonIdx++;
    }
    this.activeArcRibbons.length = writeRibbonIdx;
  }

  // 4c. Draw floor teleport folds on floorFoldGraphics (depth 15.0)
  if (this.floorFoldGraphics && typeof this.floorFoldGraphics.clear === 'function') {
    this.floorFoldGraphics.clear();
    let writeFoldIdx = 0;
    for (let i = 0; i < this.activeFloorTeleportFolds.length; i++) {
      const fold = this.activeFloorTeleportFolds[i]!;
      if (!fold.active) continue;
      fold.age += dtSec;
      if (fold.age >= fold.ttl) {
        fold.active = false;
        this.floorFoldFreePool.push(fold);
        continue;
      }
      const p = Math.min(1, fold.age / fold.ttl);
      const rx = 18 + p * 16;
      const ry = rx / 2.12;
      const alpha = (1 - p) * 0.95;
      if (typeof this.floorFoldGraphics.strokeEllipse === 'function') {
        this.floorFoldGraphics.lineStyle(4.2, 0x141019, alpha * 0.75);
        this.floorFoldGraphics.strokeEllipse(fold.x, fold.y, rx * 2, ry * 2);
        this.floorFoldGraphics.lineStyle(2.2, 0x38bdf8, alpha);
        this.floorFoldGraphics.strokeEllipse(fold.x, fold.y, rx * 2, ry * 2);
        this.floorFoldGraphics.lineStyle(1.4, 0xfffdf5, alpha * 0.9);
        this.floorFoldGraphics.strokeEllipse(fold.x, fold.y, (rx - 1.5) * 2, (ry - 0.7) * 2);
      }
      if (writeFoldIdx !== i) {
        this.activeFloorTeleportFolds[writeFoldIdx] = fold;
      }
      writeFoldIdx++;
    }
    this.activeFloorTeleportFolds.length = writeFoldIdx;

    if (this.activeTeamComboFootRings && this.activeTeamComboFootRings.length > 0) {
      let writeComboIdx = 0;
      for (let i = 0; i < this.activeTeamComboFootRings.length; i++) {
        const ring = this.activeTeamComboFootRings[i]!;
        if (!ring.active) continue;
        ring.age += dtSec;
        if (ring.age >= ring.ttl) {
          ring.active = false;
          this.teamComboFootRingFreePool?.push(ring);
          continue;
        }
        const p = Math.min(1, ring.age / ring.ttl);
        const alpha = (1 - p) * 0.95;
        const outerRx = 22 + p * 6;
        const outerRy = outerRx / 2.12;
        const innerRx = 16 + p * 4;
        const innerRy = innerRx / 2.12;
        if (typeof this.floorFoldGraphics.strokeEllipse === 'function') {
          this.floorFoldGraphics.lineStyle(3.2, 0x141019, alpha * 0.85);
          this.floorFoldGraphics.strokeEllipse(ring.x, ring.y, outerRx * 2, outerRy * 2);
          this.floorFoldGraphics.lineStyle(1.8, 0xfde047, alpha);
          this.floorFoldGraphics.strokeEllipse(ring.x, ring.y, outerRx * 2, outerRy * 2);
          this.floorFoldGraphics.lineStyle(2.6, 0x141019, alpha * 0.85);
          this.floorFoldGraphics.strokeEllipse(ring.x, ring.y, innerRx * 2, innerRy * 2);
          this.floorFoldGraphics.lineStyle(1.4, 0xfffdf5, alpha * 0.95);
          this.floorFoldGraphics.strokeEllipse(ring.x, ring.y, innerRx * 2, innerRy * 2);
        }
        if (writeComboIdx !== i) {
          this.activeTeamComboFootRings[writeComboIdx] = ring;
        }
        writeComboIdx++;
      }
      this.activeTeamComboFootRings.length = writeComboIdx;
    }
  }

  // 5. Update pooled damage numbers & coalesced reaction banner timer
  this.tickReactionBanner(dtSec);
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
    d.text.setScale(computePopupScalePop(d.age, d.ttl, d.baseScale));
    d.text.setAlpha(progress > 0.65 ? 1 - (progress - 0.65) / 0.35 : 1);
  }
  resolveActivePopupOverlaps(this.damagePool);
  resolveTacticalAlertSlotOverlaps(this.damagePool, 4.0);
}

const scratchNumericActiveSlots: PooledDamageText[] = [];

export function resolveActivePopupOverlaps(pool: ReadonlyArray<PooledDamageText>): void {
  scratchNumericActiveSlots.length = 0;
  const limit = Math.min(pool.length, DAMAGE_NUMERIC_SLOT_END);
  for (let i = 0; i < limit; i++) {
    const d = pool[i]!;
    if (d.active && d.age < d.ttl && d.text.visible && d.text.alpha > 0.05) {
      scratchNumericActiveSlots.push(d);
    }
  }
  const count = scratchNumericActiveSlots.length;
  if (count < 2) return;

  const pad = 3.5;
  for (let pass = 0; pass < 2; pass++) {
    let anyMoved = false;
    for (let i = 0; i < count; i++) {
      const a = scratchNumericActiveSlots[i]!;
      const hwA = 0.5 * (a.text.width || 24) * Math.abs(a.text.scaleX || 1);
      const hhA = 0.5 * (a.text.height || 16) * Math.abs(a.text.scaleY || 1);

      for (let j = i + 1; j < count; j++) {
        const b = scratchNumericActiveSlots[j]!;
        const hwB = 0.5 * (b.text.width || 24) * Math.abs(b.text.scaleX || 1);
        const hhB = 0.5 * (b.text.height || 16) * Math.abs(b.text.scaleY || 1);

        const overlapX = (hwA + hwB + pad) - Math.abs(a.x - b.x);
        const overlapY = (hhA + hhB + pad) - Math.abs(a.y - b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;

        if (Math.abs(a.y - b.y) < 28) {
          const halfX = Math.ceil(overlapX * 0.5) + 2;
          if (a.x <= b.x) {
            a.x -= halfX;
            b.x += halfX;
          } else {
            a.x += halfX;
            b.x -= halfX;
          }
        } else {
          const shiftY = Math.ceil(overlapY) + 2;
          if (a.y <= b.y) {
            a.y -= shiftY;
            a.vy = Math.min(a.vy, b.vy);
          } else {
            b.y -= shiftY;
            b.vy = Math.min(b.vy, a.vy);
          }
        }
        a.text.setPosition(a.x, a.y);
        b.text.setPosition(b.x, b.y);
        anyMoved = true;
      }
    }
    if (!anyMoved) break;
  }
}

/**
 * Zero-alloc vertical repulsion pass across tactical alert slots [42..47].
 * Uses text dimensions and scale (NO text.getBounds() and ZERO heap allocations).
 * Pushes overlapping alerts apart vertically so 2..6 simultaneous alerts settle with 0 AABB overlaps.
 */
export function resolveTacticalAlertSlotOverlaps(
  damagePool: readonly PooledDamageText[],
  padYPx = 4.0,
): number {
  if (!damagePool || damagePool.length === 0) return 0;
  const startIdx = damagePool.length >= 48 ? DAMAGE_NUMERIC_SLOT_END : 0;
  const endIdx = damagePool.length;

  let totalResolvedPairs = 0;
  for (let pass = 0; pass < 8; pass++) {
    let movedThisPass = false;
    for (let i = startIdx; i < endIdx; i++) {
      const a = damagePool[i]!;
      if (!a.active) continue;
      const hwA = 0.5 * (a.text.width || 64) * Math.abs(a.text.scaleX || 1);
      const hhA = 0.5 * (a.text.height || 16) * Math.abs(a.text.scaleY || 1);

      for (let j = i + 1; j < endIdx; j++) {
        const b = damagePool[j]!;
        if (!b.active) continue;
        const hwB = 0.5 * (b.text.width || 64) * Math.abs(b.text.scaleX || 1);
        const hhB = 0.5 * (b.text.height || 16) * Math.abs(b.text.scaleY || 1);

        const dx = Math.abs(a.x - b.x);
        const reqDx = hwA + hwB + 4.0;
        if (dx >= reqDx) continue;

        const dy = Math.abs(a.y - b.y);
        const reqDy = hhA + hhB + padYPx;
        if (dy < reqDy) {
          const overlap = reqDy - dy;
          const halfPush = overlap * 0.5 + 0.1;
          if (a.y <= b.y) {
            a.y -= halfPush;
            b.y += halfPush;
          } else {
            a.y += halfPush;
            b.y -= halfPush;
          }
          if (typeof a.text.setPosition === 'function') {
            a.text.setPosition(a.x, a.y);
          }
          if ('x' in a.text) (a.text as { x: number }).x = a.x;
          if ('y' in a.text) (a.text as { y: number }).y = a.y;
          if (typeof b.text.setPosition === 'function') {
            b.text.setPosition(b.x, b.y);
          }
          if ('x' in b.text) (b.text as { x: number }).x = b.x;
          if ('y' in b.text) (b.text as { y: number }).y = b.y;
          movedThisPass = true;
          totalResolvedPairs++;
        }
      }
    }
    if (!movedThisPass) break;
  }
  return totalResolvedPairs;
}

export function computePopupScalePop(ageSec: number, ttlSec: number, baseScale = 1): number {
  const safeTtl = Math.max(0.1, ttlSec);
  const progress = clamp(ageSec / safeTtl, 0, 1);
  if (progress < 0.22) {
    const t = progress / 0.22;
    const pop = 0.72 + easeOutBack(t) * 0.28;
    return baseScale * pop;
  }
  return baseScale;
}

export interface SpatialCellPopupResolution {
  cellX: number;
  cellY: number;
  activeInCell: number;
  slotIndex: number;
  staggerOffsetY: number;
  evictIndex: number | null;
}

export function resolveSpatialPopupCellSlot(
  pool: ReadonlyArray<{
    active: boolean;
    x: number;
    y: number;
    originX?: number;
    originY?: number;
    cellSlotIndex?: number;
    age: number;
  }>,
  x: number,
  y: number,
  cellSize = 120,
  maxPerCell = 3,
  maxScanIndex?: number,
): SpatialCellPopupResolution {
  const safeCell = Math.max(16, cellSize);
  const cellX = Math.floor(x / safeCell);
  const cellY = Math.floor(y / safeCell);
  let activeInCell = 0;
  let oldestAge = -1;
  let evictIndex: number | null = null;
  let evictedSlotIndex: number | undefined;
  let usedSlotsMask = 0;
  const limit = Math.min(
    pool.length,
    maxScanIndex ?? (pool.length >= 48 ? DAMAGE_NUMERIC_SLOT_END : pool.length),
  );

  for (let i = 0; i < limit; i += 1) {
    const item = pool[i]!;
    if (!item.active) continue;
    const ix = item.originX ?? item.x;
    const iy = item.originY ?? item.y;
    if (Math.floor(ix / safeCell) === cellX && Math.floor(iy / safeCell) === cellY) {
      activeInCell += 1;
      if (item.cellSlotIndex !== undefined && item.cellSlotIndex >= 0 && item.cellSlotIndex < 16) {
        usedSlotsMask |= 1 << item.cellSlotIndex;
      }
      if (item.age > oldestAge) {
        oldestAge = item.age;
        evictIndex = i;
        evictedSlotIndex = item.cellSlotIndex;
      }
    }
  }

  let slotIndex = Math.min(maxPerCell - 1, activeInCell);
  if (activeInCell >= maxPerCell && evictedSlotIndex !== undefined) {
    slotIndex = evictedSlotIndex;
  } else {
    for (let s = 0; s < maxPerCell; s += 1) {
      if ((usedSlotsMask & (1 << s)) === 0) {
        slotIndex = s;
        break;
      }
    }
  }

  return {
    cellX,
    cellY,
    activeInCell,
    slotIndex,
    staggerOffsetY: slotIndex * 14,
    evictIndex: activeInCell >= maxPerCell ? evictIndex : null,
  };
}

export function getActiveDamagePopupCount(this: CombatFxManager): number {
  let count = 0;
  for (let i = 0; i < this.damagePool.length; i++) {
    if (this.damagePool[i]!.active) count += 1;
  }
  return count;
}

export function getActiveParticleCount(this: CombatFxManager): number {
  let count = 0;
  for (let i = 0; i < this.particlePool.length; i++) {
    if (this.particlePool[i]!.active) count += 1;
  }
  return count;
}

export function getActiveDecalCount(this: CombatFxManager): number {
  return this.activeDecalCount;
}

export function getActiveAfterimageCount(this: CombatFxManager): number {
  let count = 0;
  for (let i = 0; i < this.afterimagePool.length; i++) {
    if (this.afterimagePool[i]!.active) count += 1;
  }
  return count;
}

export function getActiveAmbientCount(this: CombatFxManager): number {
  let count = 0;
  const limit = Math.min(BIOME_AMBIENT_POOL_SLOTS, this.ambientPool.length);
  for (let i = 0; i < limit; i++) {
    if (this.ambientPool[i]!.sprite.visible) count += 1;
  }
  return count;
}

export function getActiveTorchMoteCount(this: CombatFxManager): number {
  let count = 0;
  for (let i = BIOME_AMBIENT_POOL_SLOTS; i < this.ambientPool.length; i++) {
    if (this.ambientPool[i]!.sprite.visible) count += 1;
  }
  return count;
}

export function acquireParticleSlot(this: CombatFxManager): PooledParticle | null {
  const maxSlots = Math.max(
    24,
    Math.floor(this.particlePool.length * graphicsSettings.getBudget().particleBudgetRatio),
  );
  for (let i = 0; i < maxSlots; i++) {
    const slot = this.particlePool[i]!;
    if (!slot.active) return slot;
  }
  return null;
}

export function acquireDamageSlot(
  this: CombatFxManager,
  targetX?: number,
  targetY?: number,
): PooledDamageText | null {
  const limit = Math.min(this.damagePool.length, DAMAGE_NUMERIC_SLOT_END);
  if (targetX !== undefined && targetY !== undefined) {
    const res = resolveSpatialPopupCellSlot(this.damagePool, targetX, targetY, 120, 3, limit);
    if (res.evictIndex !== null && res.evictIndex < limit) {
      return this.damagePool[res.evictIndex] ?? null;
    }
  }
  for (let i = 0; i < limit; i++) {
    const slot = this.damagePool[i]!;
    if (!slot.active) return slot;
  }
  return null;
}

export interface ChestOpenBouncePose {
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

export function computeChestOpenBounce(ageSec: number): ChestOpenBouncePose {
  if (ageSec <= 0 || ageSec >= 0.36) {
    return { offsetY: 0, scaleX: 1, scaleY: 1 };
  }
  const t = clamp(ageSec / 0.36, 0, 1);
  const arc = Math.sin(t * Math.PI);
  const back = Math.max(0.05, easeOutBack(1 - t * 0.85) * (1 - t));
  return {
    offsetY: -8.5 * arc * (0.65 + 0.35 * back),
    scaleX: 1 + 0.14 * arc * (0.7 + 0.3 * back),
    scaleY: 1 + 0.22 * arc * (0.7 + 0.3 * back),
  };
}

export interface WorldItemArcPose {
  x: number;
  y: number;
  arcOffsetY: number;
  rotationRad: number;
  inArc: boolean;
}

export function computeWorldItemArcPose(
  ageSec: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  idlePhaseRad = 0,
): WorldItemArcPose {
  const arcDurationSec = 0.34;
  if (ageSec >= 0 && ageSec < arcDurationSec) {
    const t = clamp(ageSec / arcDurationSec, 0, 1);
    const easeT = easeOutCubic(t);
    const x = fromX + (toX - fromX) * easeT;
    const baseY = fromY + (toY - fromY) * easeT;
    const arcOffsetY =
      t < 0.72
        ? -Math.sin((t / 0.72) * Math.PI) * 26
        : -Math.sin(((t - 0.72) / 0.28) * Math.PI) * 7;
    const rotationRad = Math.sin(t * Math.PI * 2) * 0.34 * (1 - t * 0.5);
    return {
      x,
      y: baseY + arcOffsetY,
      arcOffsetY,
      rotationRad,
      inArc: true,
    };
  }
  const hoverOffsetY = Math.sin(idlePhaseRad) * 2.5;
  return {
    x: toX,
    y: toY + hoverOffsetY,
    arcOffsetY: hoverOffsetY,
    rotationRad: 0,
    inArc: false,
  };
}

export interface EnemySpawnCircleSpec {
  outerRadius: number;
  innerRadius: number;
  runeRotationRad: number;
  counterRuneRotationRad: number;
  runeCount: 6 | 8;
  pillarHeightPx: number;
  pillarWidthPx: number;
  pillarAlpha: number;
  blendMode: 'ADD';
  primaryColorHex: string;
  coreColorHex: string;
}

export function computeEnemySpawnCircleSpec(
  radius: number,
  spawnProgress: number,
  isElite = false,
  isBoss = false,
): EnemySpawnCircleSpec {
  const p = clamp(spawnProgress, 0, 1);
  const baseOuter = radius + (isBoss ? 14 : isElite ? 10 : 8);
  const outerRadius = baseOuter * (0.45 + 0.55 * easeOutBack(Math.min(1, p * 1.25)));
  const innerRadius = outerRadius * 0.68;
  const runeRotationRad = p * Math.PI * 1.65;
  const counterRuneRotationRad = -p * Math.PI * 1.35;
  const runeCount: 6 | 8 = isBoss ? 8 : 6;
  const maxPillarH = isBoss ? 68 : isElite ? 56 : 46;
  const riseCurve = p < 0.7 ? easeOutCubic(p / 0.7) : 1 - ((p - 0.7) / 0.3) * 0.45;
  const pillarHeightPx = Math.max(8, maxPillarH * Math.max(0.18, riseCurve));
  const pillarWidthPx = Math.max(4, radius * (0.75 - p * 0.28));
  const pillarAlpha = clamp(0.22 + Math.sin(p * Math.PI) * 0.66, 0.18, 0.88);
  return {
    outerRadius,
    innerRadius,
    runeRotationRad,
    counterRuneRotationRad,
    runeCount,
    pillarHeightPx,
    pillarWidthPx,
    pillarAlpha,
    blendMode: 'ADD',
    primaryColorHex: isBoss || isElite ? PALETTE.SOLAR_GOLD : PALETTE.ELECTRIC_VIOLET,
    coreColorHex: isBoss || isElite ? PALETTE.BONE_WHITE : PALETTE.CYAN_FROST,
  };
}

export function computeBossKillFlashAlpha(flashTimerSec: number, durationSec = 0.28): number {
  if (flashTimerSec <= 0 || durationSec <= 0) return 0;
  const remainingRatio = clamp(flashTimerSec / durationSec, 0, 1);
  return easeOutCubic(remainingRatio) * 0.42;
}

export function computeIrisHoleRadius(progress: number, maxHoleRadius: number): number {
  const eased = easeInOutCubic(clamp(progress, 0, 1));
  return Math.max(2, maxHoleRadius * (1 - eased));
}
