import { clamp, WORLD_VIEW_HEIGHT, WORLD_VIEW_WIDTH } from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { easeOutBack } from '../art/easing.js';
import { hexToNum, PALETTE } from '../art/palette.js';
import { TextureBaker } from '../art/texture-baker.js';
import { getVisualQueryConfig } from '../core/visual-query.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import type { CombatFxManager } from './combat-fx.js';

export interface PooledParticle {
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
  kind: 'leaf';
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  baseScale: number;
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

  // 3. Main Combat Particle Pool
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

  // 4. Ambient Leaves / Snow / Embers Pool (depth 32, no mist)
  for (let i = 0; i < ambientCapacity; i++) {
    const sprite = scene.add.sprite((i * 97) % 1100, (i * 61) % 680, 'fx_ambient_leaf');
    const baseScale = invBake * (0.75 + (i % 3) * 0.15);
    sprite.setScale(baseScale);
    sprite.setAlpha(0.72);
    sprite.setDepth(32);
    this.ambientPool.push({
      sprite,
      kind: 'leaf',
      x: sprite.x,
      y: sprite.y,
      vx: 16 + (i % 5) * 4,
      vy: 14 + (i % 4) * 3,
      phase: i * 0.7,
      baseScale,
    });
  }

  // 5. Chain Lightning Graphics (depth 62)
  this.lightningGraphics = scene.add.graphics();
  this.lightningGraphics.setDepth(62);
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
    p.sprite.setTexture(p.textureKey);
    if (p.active && scaleRatio !== 1) {
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
  for (let i = 0; i < this.ambientPool.length; i++) {
    const amb = this.ambientPool[i]!;
    const tex =
      this.currentBiome === 2
        ? 'fx_ice_shard'
        : this.currentBiome === 3
          ? 'fx_ember_mote'
          : 'fx_ambient_leaf';
    amb.sprite.setTexture(tex);
    amb.baseScale = invBake * (0.75 + (i % 3) * 0.15);
    amb.sprite.setScale(amb.baseScale);
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
  const maxOffset = 11;

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

  // 3. Enforce decal budget dynamically & update ambient leaves/mist
  const budget = graphicsSettings.getBudget();
  const maxDecals = budget.maxDecals;
  if (this.activeDecalCount > maxDecals) {
    let count = 0;
    for (let i = 0; i < this.decalPool.length; i++) {
      const d = this.decalPool[i]!;
      if (!d.active) continue;
      if (i >= maxDecals) {
        d.active = false;
        d.sprite.setVisible(false);
      } else {
        count += 1;
      }
    }
    this.activeDecalCount = count;
  }

  const isBlizzard = this.currentBiome === 2 && this.isBlizzardIntense();
  const baseLimit = budget.tier === 'high' ? 32 : budget.tier === 'medium' ? 18 : 10;
  const allowedAmbient = isBlizzard
    ? Math.min(this.ambientPool.length, budget.tier === 'low' ? 29 : baseLimit * 3)
    : budget.ambientCount;
  const invBake = 1 / TextureBaker.getBakeScale();
  const viewW = camView && camView.width > 0 ? camView.width : WORLD_VIEW_WIDTH;
  const viewH = camView && camView.height > 0 ? camView.height : WORLD_VIEW_HEIGHT;
  const minX = camView && camView.width > 0 ? camView.x - 40 : 0;
  const maxX = minX + viewW + 80;
  const minY = camView && camView.height > 0 ? camView.y - 40 : 0;
  const maxY = minY + viewH + 80;

  for (let i = 0; i < this.ambientPool.length; i++) {
    const amb = this.ambientPool[i]!;
    if (i >= allowedAmbient) {
      if (amb.sprite.visible) amb.sprite.setVisible(false);
      continue;
    }
    if (!amb.sprite.visible) amb.sprite.setVisible(true);

    if (isBlizzard) {
      amb.vx = -165 - (i % 5) * 18;
      amb.vy = 115 + (i % 4) * 14;
      amb.sprite.setAlpha(0.55 + (i % 3) * 0.12);
      amb.sprite.setScale(invBake * (0.65 + (i % 3) * 0.2));
    }

    const ambDt = getVisualQueryConfig().freeze ? 0 : dtSec;
    amb.phase += ambDt * 2.4;
    amb.x += (amb.vx + Math.sin(amb.phase) * 8) * ambDt;
    amb.y += amb.vy * ambDt;

    if (amb.x > maxX) amb.x = minX;
    else if (amb.x < minX) amb.x = maxX;
    if (amb.y > maxY) amb.y = minY;
    else if (amb.y < minY) amb.y = maxY;

    amb.sprite.setPosition(amb.x, amb.y);
    amb.sprite.setRotation(isBlizzard ? -0.58 + Math.sin(amb.phase) * 0.25 : Math.sin(amb.phase) * 0.6);
  }

  // 4. Update & draw chain lightning arcs
  this.lightningGraphics.clear();
  for (let i = 0; i < this.lightningPool.length; i++) {
    const arc = this.lightningPool[i]!;
    if (!arc.active) continue;
    arc.age += dtSec;
    if (arc.age >= arc.ttl) {
      arc.active = false;
      continue;
    }
    const alpha = 1 - arc.age / arc.ttl;
    const dx = arc.toX - arc.fromX;
    const dy = arc.toY - arc.fromY;
    const nx = -dy * 0.18;
    const ny = dx * 0.18;
    const jitter = Math.sin(arc.age * 90 + arc.seed) >= 0 ? 1 : -1;

    const mid1X = arc.fromX + dx * 0.33 + nx * jitter;
    const mid1Y = arc.fromY + dy * 0.33 + ny * jitter;
    const mid2X = arc.fromX + dx * 0.66 - nx * jitter * 0.8;
    const mid2Y = arc.fromY + dy * 0.66 - ny * jitter * 0.8;

    this.lightningGraphics.lineStyle(4.5, hexToNum(PALETTE.INK_DARK), alpha * 0.85);
    this.lightningGraphics.beginPath();
    this.lightningGraphics.moveTo(arc.fromX, arc.fromY);
    this.lightningGraphics.lineTo(mid1X, mid1Y);
    this.lightningGraphics.lineTo(mid2X, mid2Y);
    this.lightningGraphics.lineTo(arc.toX, arc.toY);
    this.lightningGraphics.strokePath();

    this.lightningGraphics.lineStyle(2.2, hexToNum(PALETTE.VOLT_YELLOW), alpha);
    this.lightningGraphics.beginPath();
    this.lightningGraphics.moveTo(arc.fromX, arc.fromY);
    this.lightningGraphics.lineTo(mid1X, mid1Y);
    this.lightningGraphics.lineTo(mid2X, mid2Y);
    this.lightningGraphics.lineTo(arc.toX, arc.toY);
    this.lightningGraphics.strokePath();
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
): SpatialCellPopupResolution {
  const safeCell = Math.max(16, cellSize);
  const cellX = Math.floor(x / safeCell);
  const cellY = Math.floor(y / safeCell);
  let activeInCell = 0;
  let oldestAge = -1;
  let evictIndex: number | null = null;
  let evictedSlotIndex: number | undefined;
  let usedSlotsMask = 0;

  for (let i = 0; i < pool.length; i += 1) {
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
  for (let i = 0; i < this.ambientPool.length; i++) {
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
  if (targetX !== undefined && targetY !== undefined) {
    const res = resolveSpatialPopupCellSlot(this.damagePool, targetX, targetY, 120, 3);
    if (res.evictIndex !== null) {
      return this.damagePool[res.evictIndex] ?? null;
    }
  }
  for (let i = 0; i < this.damagePool.length; i++) {
    const slot = this.damagePool[i]!;
    if (!slot.active) return slot;
  }
  return null;
}
