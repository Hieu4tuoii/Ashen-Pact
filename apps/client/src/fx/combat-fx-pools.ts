import { WORLD_VIEW_HEIGHT, WORLD_VIEW_WIDTH } from '@ashen-pact/shared';
import type Phaser from 'phaser';
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
  kind: 'leaf' | 'mist';
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
  ambientCapacity = 36,
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

  // 4. Ambient Leaves / Snow / Embers & Mist Pool (depth 32)
  for (let i = 0; i < ambientCapacity; i++) {
    const isMist = i < 8;
    const tex = isMist ? 'fx_ambient_mist' : 'fx_ambient_leaf';
    const sprite = scene.add.sprite((i * 97) % 1100, (i * 61) % 680, tex);
    const baseScale = isMist ? invBake * 1.8 : invBake * (0.75 + (i % 3) * 0.15);
    sprite.setScale(baseScale);
    sprite.setAlpha(isMist ? 0.35 : 0.72);
    sprite.setDepth(32);
    this.ambientPool.push({
      sprite,
      kind: isMist ? 'mist' : 'leaf',
      x: sprite.x,
      y: sprite.y,
      vx: isMist ? 12 + (i % 4) * 3 : 16 + (i % 5) * 4,
      vy: isMist ? 2 : 14 + (i % 4) * 3,
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
  for (const amb of this.ambientPool) {
    const tex =
      amb.kind === 'mist'
        ? 'fx_ambient_mist'
        : this.currentBiome === 2
          ? 'fx_ice_shard'
          : this.currentBiome === 3
            ? 'fx_spark'
            : 'fx_ambient_leaf';
    amb.sprite.setTexture(tex);
    amb.baseScale = amb.kind === 'mist' ? invBake * 1.8 : invBake * 0.9;
    amb.sprite.setScale(amb.baseScale);
  }
  const popupRes = Math.min(2, bakeScale);
  for (const item of this.damagePool) {
    item.text.setResolution(popupRes);
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

  const allowedAmbient = budget.ambientCount;
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

    const ambDt = getVisualQueryConfig().freeze ? 0 : dtSec;
    amb.phase += ambDt * (amb.kind === 'leaf' ? 2.4 : 0.8);
    amb.x += (amb.vx + Math.sin(amb.phase) * 8) * ambDt;
    amb.y += amb.vy * ambDt;

    if (amb.x > maxX) amb.x = minX;
    else if (amb.x < minX) amb.x = maxX;
    if (amb.y > maxY) amb.y = minY;
    else if (amb.y < minY) amb.y = maxY;

    amb.sprite.setPosition(amb.x, amb.y);
    if (amb.kind === 'leaf') {
      amb.sprite.setRotation(Math.sin(amb.phase) * 0.6);
    }
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

  // 5. Update pooled damage numbers
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

export function acquireDamageSlot(this: CombatFxManager): PooledDamageText | null {
  for (let i = 0; i < this.damagePool.length; i++) {
    const slot = this.damagePool[i]!;
    if (!slot.active) return slot;
  }
  return null;
}
