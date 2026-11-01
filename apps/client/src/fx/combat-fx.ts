import {
  clamp,
  type ElementalReactionId,
  type ElementType,
  type PropKind,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE, PLAYER_SLOT_COLORS } from '../art/palette.js';
import { RIG_DEFS_BY_ID } from '../art/rig-defs.js';
import { TextureBaker } from '../art/texture-baker.js';
import type {
  ShaderDirectionalKey,
  ShaderNovaKey,
  ShaderSlashKey,
} from '../art/texture-baker-shader-fx.js';
import { getClientFreezeRandom } from '../core/visual-query.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import {
  acquireDamageSlot,
  acquireParticleSlot,
  BIOME_AMBIENT_POOL_SLOTS,
  computeCameraShakeOffset,
  computePopupScalePop,
  getActiveAfterimageCount,
  getActiveAmbientCount,
  getActiveDamagePopupCount,
  getActiveDecalCount,
  getActiveParticleCount,
  getActiveTorchMoteCount,
  initCombatFxPools,
  type PooledAfterimage,
  type PooledAmbientParticle,
  type PooledDamageText,
  type PooledDecal,
  type PooledLightningArc,
  type PooledParticle,
  refreshResolution,
  resolveActivePopupOverlaps,
  resolveSpatialPopupCellSlot,
  update,
} from './combat-fx-pools.js';
import {
  activateParticle,
  applyBiomeToAmbientSlot,
  type CoalescedReactionBannerState,
  type ShaderConeSpawnOptions,
  type ShaderDirectionalSpawnOptions,
  type ShaderLanceSpawnOptions,
  type ShaderNovaSpawnOptions,
  type ShaderSlashSpawnOptions,
  spawnElementalReactionFxImpl,
  spawnExplosionBurstImpl,
  spawnFloatingAlertImpl,
  spawnHitSparksImpl,
  spawnMuzzleFlashAndCasingImpl,
  spawnShaderConeImpl,
  spawnShaderDirectionalImpl,
  spawnShaderLanceImpl,
  spawnShaderNovaImpl,
  spawnShaderSlashImpl,
} from './combat-fx-spawners.js';

export * from './combat-fx-pools.js';
export * from './combat-fx-spawners.js';

/**
 * Object-pooled Combat FX, Chiaroscuro 1:1 Shader Flipbooks, Decals, Dash Afterimages, Clear Biome Ambient & Juice system.
 */
export class CombatFxManager {
  private readonly sceneRef: Phaser.Scene;
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
  public bossKillSlowMoTimer = 0;
  public bossKillFlashTimer = 0;
  public trauma = 0;
  public shakeTime = 0;
  public popupSpreadIndex = 0;
  public slashFlipToggle = false;
  public currentBiome: 1 | 2 | 3 = 1;
  private blizzardIntense = false;
  public allowFreezeAmbientMotion = false;
  public torchPositions: Array<{ x: number; y: number }> = [];

  public totalHitStopsTriggered = 0;
  public totalShakesTriggered = 0;
  public totalSparksSpawned = 0;
  public totalDamagePopupsSpawned = 0;
  public totalDecalsSpawned = 0;
  public totalAfterimagesSpawned = 0;
  public activeReactionBanner: CoalescedReactionBannerState | null = null;
  public activeWorldReactionPopupSlot: PooledDamageText | null = null;

  constructor(
    scene: Phaser.Scene,
    particleCapacity = 300,
    damageCapacity = 48,
    decalCapacity = 120,
    afterimageCapacity = 24,
    ambientCapacity = 96,
  ) {
    this.sceneRef = scene;
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

  public setAllowFreezeAmbientMotion(active: boolean): void {
    this.allowFreezeAmbientMotion = active;
  }

  public syncTorchPositions(
    props: ReadonlyArray<{ kind: string; x: number; y: number; hp: number }>,
  ): void {
    this.torchPositions.length = 0;
    for (let i = 0; i < props.length; i++) {
      const p = props[i]!;
      if (p.hp > 0 && p.kind === 'torch_brazier') {
        this.torchPositions.push({ x: p.x, y: p.y });
      }
    }
  }

  public setBlizzardIntense(active: boolean): void {
    if (this.blizzardIntense === active) return;
    this.blizzardIntense = active;
    if (this.currentBiome === 2) {
      const invBake = 1 / TextureBaker.getBakeScale();
      const tier = graphicsSettings.getBudget().tier;
      const limit = Math.min(BIOME_AMBIENT_POOL_SLOTS, this.ambientPool.length);
      for (let i = 0; i < limit; i++) {
        applyBiomeToAmbientSlot(this.ambientPool[i]!, i, 2, tier, active, invBake);
      }
    }
  }

  public isBlizzardIntense(): boolean {
    return this.blizzardIntense;
  }

  public setBiome(biome: 1 | 2 | 3): void {
    if (this.currentBiome === biome) return;
    this.currentBiome = biome;
    const invBake = 1 / TextureBaker.getBakeScale();
    const tier = graphicsSettings.getBudget().tier;
    const isBlizzard = biome === 2 && this.blizzardIntense;
    const limit = Math.min(BIOME_AMBIENT_POOL_SLOTS, this.ambientPool.length);
    for (let i = 0; i < limit; i++) {
      applyBiomeToAmbientSlot(this.ambientPool[i]!, i, biome, tier, isBlizzard, invBake);
    }
  }

  public spawnShaderNova(
    x: number,
    y: number,
    radiusPx: number,
    novaKey: ShaderNovaKey = 'fx_sh_nova_solar',
    options?: ShaderNovaSpawnOptions,
  ): void {
    spawnShaderNovaImpl.call(this, x, y, radiusPx, novaKey, options);
  }

  public spawnShaderSlash(
    x: number,
    y: number,
    rangePx: number,
    angleRad: number,
    slashKey: ShaderSlashKey = 'fx_sh_slash_steel',
    options?: ShaderSlashSpawnOptions,
  ): void {
    spawnShaderSlashImpl.call(this, x, y, rangePx, angleRad, slashKey, options);
  }

  public spawnShaderCone(
    x: number,
    y: number,
    reachPx: number,
    angleRad: number,
    options?: ShaderConeSpawnOptions,
  ): void {
    spawnShaderConeImpl.call(this, x, y, reachPx, angleRad, options);
  }

  public spawnShaderLance(
    x: number,
    y: number,
    lengthPx: number,
    angleRad: number,
    options?: ShaderLanceSpawnOptions,
  ): void {
    spawnShaderLanceImpl.call(this, x, y, lengthPx, angleRad, options);
  }

  public spawnShaderDirectional(
    x: number,
    y: number,
    reachPx: number,
    angleRad: number,
    key: ShaderDirectionalKey,
    options?: ShaderDirectionalSpawnOptions,
  ): void {
    spawnShaderDirectionalImpl.call(this, x, y, reachPx, angleRad, key, options);
  }

  public spawnFloatingAlert(
    x: number,
    y: number,
    label: string,
    colorHex: string = PALETTE.CYAN_FROST,
  ): void {
    spawnFloatingAlertImpl.call(this, x, y, label, colorHex);
  }

  public spawnFrostBreath(x: number, y: number, facingSign: number): void {
    const p = this.acquireParticleSlot();
    if (!p) return;
    const invBake = 1 / TextureBaker.getBakeScale();
    activateParticle(p, {
      textureKey: 'fx_dust_puff',
      x: x + facingSign * 8,
      y: y - 10,
      vx: facingSign * (14 + getClientFreezeRandom()() * 10),
      vy: -12 - getClientFreezeRandom()() * 8,
      vr: 0,
      ttl: 0.42,
      startScale: invBake * 0.55,
      endScale: invBake * 0.95,
      startAlpha: 0.52,
      gravityY: -8,
      damping: 2.5,
      tint: hexToNum(PALETTE.ICE_WHITE),
      blendMode: 'NORMAL',
      depth: 33,
    });
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
      const slowMoMult = this.bossKillSlowMoTimer > 0 ? 0.25 : 1.0;
      return { simDeltaMs: rawDeltaMs * slowMoMult, isHitStopped: false };
    }
    if (rawDeltaMs <= this.hitStopRemainingMs) {
      this.hitStopRemainingMs -= rawDeltaMs;
      return { simDeltaMs: 0, isHitStopped: true };
    }
    const rem = rawDeltaMs - this.hitStopRemainingMs;
    this.hitStopRemainingMs = 0;
    const slowMoMult = this.bossKillSlowMoTimer > 0 ? 0.25 : 1.0;
    return { simDeltaMs: rem * slowMoMult, isHitStopped: false };
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
    isTeammate = false,
  ): void {
    const alphaMult = isTeammate
      ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
      : 1.0;
    for (let i = 0; i < this.afterimagePool.length; i++) {
      const ghost = this.afterimagePool[i]!;
      if (!ghost.active) {
        const invBake = 1 / TextureBaker.getBakeScale();
        ghost.active = true;
        ghost.age = 0;
        ghost.ttl = 0.22;
        ghost.startAlpha = 0.55 * alphaMult;
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
      const ang = -Math.PI * 0.5 + (getClientFreezeRandom()() - 0.5) * 1.6;
      const spd = 25 + getClientFreezeRandom()() * 35;
      activateParticle(p, {
        textureKey: 'fx_ambient_leaf',
        x: x + (getClientFreezeRandom()() - 0.5) * 12,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 15,
        vr: (getClientFreezeRandom()() - 0.5) * 10,
        ttl: 0.35,
        startScale: invBake * 0.95,
        endScale: invBake * 0.4,
        startAlpha: 0.9,
        gravityY: 90,
        damping: 3,
        blendMode: 'NORMAL',
        depth: 32,
      });
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
      const ang = (i / count) * Math.PI * 2 + (getClientFreezeRandom()() - 0.5) * 0.4;
      const spd = 65 + getClientFreezeRandom()() * 85;
      activateParticle(p, {
        textureKey: 'fx_wood_shard',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 30,
        vr: (getClientFreezeRandom()() - 0.5) * 16,
        ttl: 0.45,
        startScale: invBake * 1.05,
        endScale: invBake * 0.45,
        startAlpha: 1,
        gravityY: 200,
        damping: 4,
        rotation: ang,
        tint: kind === 'clay_vase' ? hexToNum(PALETTE.COPPER_LIGHT) : null,
        blendMode: 'NORMAL',
        depth: 38,
      });
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
      if (status === 'shatter') {
        this.spawnShaderNova(x, y, 52, 'fx_sh_nova_cryo', { ttl: 0.26, sparkCount: 4 });
      }
      const invBake = 1 / TextureBaker.getBakeScale();
      const shardCount = status === 'shatter' ? 8 : 5;
      for (let i = 0; i < shardCount; i++) {
        const p = this.acquireParticleSlot();
        if (!p) break;
        const ang = (i / shardCount) * Math.PI * 2;
        const spd = status === 'shatter' ? 110 + getClientFreezeRandom()() * 70 : 55;
        activateParticle(p, {
          textureKey: 'fx_ice_shard',
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 20,
          vr: 10,
          ttl: 0.35,
          startScale: invBake * 1.05,
          endScale: invBake * 0.3,
          startAlpha: 1,
          gravityY: 120,
          damping: 4,
          blendMode: 'NORMAL',
          depth: 56,
        });
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
    spawnElementalReactionFxImpl.call(this, params);
  }

  public spawnChestOpenBurst(
    x: number,
    y: number,
    rarity: 'common' | 'rare' | 'epic' | 'legendary' = 'rare',
  ): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    const colorHex =
      rarity === 'legendary'
        ? PALETTE.SOLAR_GOLD
        : rarity === 'epic'
          ? PALETTE.TOXIC_PURPLE
          : rarity === 'rare'
            ? PALETTE.CYAN_FROST
            : PALETTE.BONE_WHITE;
    const tint = hexToNum(colorHex);

    const beam = this.acquireParticleSlot();
    if (beam) {
      activateParticle(beam, {
        textureKey: 'fx_rarity_beam',
        x,
        y: y - 28,
        vy: -14,
        ttl: 0.52,
        startScale: invBake * 0.85,
        endScale: invBake * 1.35,
        startAlpha: 0.92,
        damping: 2,
        tint,
        depth: 46,
        easeCurve: 'easeOutBack',
        scaleRatioY: 1.45,
      });
    }

    const ring = this.acquireParticleSlot();
    if (ring) {
      activateParticle(ring, {
        textureKey: 'fx_impact_ring',
        x,
        y,
        ttl: 0.34,
        startScale: invBake * 0.25,
        endScale: invBake * (rarity === 'legendary' ? 1.65 : 1.3),
        startAlpha: 0.9,
        tint,
        depth: 54,
        easeCurve: 'easeOutCubic',
      });
    }

    const count = rarity === 'legendary' ? 14 : 10;
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;
      const ang = -Math.PI * 0.5 + (i / (count - 1) - 0.5) * 1.45;
      const spd = 75 + (i % 4) * 28;
      const isMote = i % 2 === 0;
      activateParticle(p, {
        textureKey: isMote ? 'fx_sparkle_mote' : 'fx_spark_trail',
        x,
        y: y - 6,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35,
        vr: isMote ? 6 : 0,
        ttl: 0.46,
        startScale: invBake * 1.05,
        endScale: invBake * 0.22,
        startAlpha: 0.96,
        gravityY: 140,
        damping: 2.5,
        rotation: ang,
        tint: i % 3 === 0 ? hexToNum(PALETTE.BONE_WHITE) : tint,
        depth: 47,
        scaleRatioY: isMote ? 1 : 0.45,
        alignToVelocity: !isMote,
      });
    }
  }

  public spawnBossKillBurst(x: number, y: number, defId = 'spore_king'): void {
    this.bossKillSlowMoTimer = 0.42;
    this.bossKillFlashTimer = 0.28;
    this.triggerHitStop(55);
    this.addTrauma(0.85);

    const invBake = 1 / TextureBaker.getBakeScale();
    const novaKey: ShaderNovaKey =
      defId === 'kryssa_ice_queen'
        ? 'fx_sh_nova_cryo'
        : defId === 'forge_titan'
          ? 'fx_sh_geyser_plume'
          : defId === 'spore_king'
            ? 'fx_sh_spore_cloud'
            : 'fx_sh_nova_solar';
    const primaryHex =
      defId === 'kryssa_ice_queen'
        ? PALETTE.CYAN_FROST
        : defId === 'forge_titan'
          ? PALETTE.FLAME_ORANGE
          : defId === 'spore_king'
            ? PALETTE.LIME_GLOW
            : PALETTE.SOLAR_GOLD;

    this.spawnShaderNova(x, y, 132, novaKey, { ttl: 0.48, depth: 56, sparkCount: 0 });

    const count = 18;
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;
      const ang = (i / count) * Math.PI * 2;
      const spd = 140 + (i % 4) * 55;
      const isTrail = i % 2 === 0;
      activateParticle(p, {
        textureKey: isTrail ? 'fx_spark_trail' : 'fx_sparkle_mote',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        vr: isTrail ? 0 : 8,
        ttl: 0.44,
        startScale: invBake * 1.28,
        endScale: invBake * 0.2,
        damping: 4.2,
        rotation: ang,
        tint: hexToNum(i % 2 === 0 ? primaryHex : PALETTE.SOLAR_GOLD),
        depth: 58,
        scaleRatioY: isTrail ? 0.45 : 1,
        alignToVelocity: isTrail,
      });
    }
  }

  public tickReactionBanner(dtSec: number): void {
    if (!this.activeReactionBanner) return;
    this.activeReactionBanner.windowTimerSec = Math.max(
      0,
      this.activeReactionBanner.windowTimerSec - dtSec,
    );
    this.activeReactionBanner.displayTimerSec = Math.max(
      0,
      this.activeReactionBanner.displayTimerSec - dtSec,
    );
    if (this.activeReactionBanner.displayTimerSec <= 0) {
      this.activeReactionBanner = null;
    }
  }

  public getActiveReactionBanner(): Readonly<CoalescedReactionBannerState> | null {
    return this.activeReactionBanner;
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
    const cellRes = resolveSpatialPopupCellSlot(this.damagePool, params.x, params.y, 120, 3);
    if (cellRes.activeInCell >= 3 && cellRes.evictIndex !== null) {
      const oldest = this.damagePool[cellRes.evictIndex];
      if (!oldest || oldest.age < 0.48) {
        return;
      }
    }
    const slot =
      cellRes.evictIndex !== null
        ? (this.damagePool[cellRes.evictIndex] ?? null)
        : this.acquireDamageSlot();
    if (!slot) return;

    this.totalDamagePopupsSpawned += 1;
    const fanIdx = this.popupSpreadIndex++ % 5;
    const fanLane = fanIdx - 2;

    slot.active = true;
    slot.age = 0;
    slot.ttl = params.isCrit ? 0.78 : 0.62;
    slot.originX = params.x;
    slot.originY = params.y;
    slot.cellSlotIndex = cellRes.slotIndex;
    slot.x = params.x + fanLane * 6 + (getClientFreezeRandom()() - 0.5) * 4;
    slot.y = params.y - 16 - cellRes.staggerOffsetY;
    slot.vx = fanLane * 14 + (getClientFreezeRandom()() - 0.5) * 8;
    slot.vy = (params.isCrit ? -72 : -54) - (fanIdx % 2) * 8;
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

    if (slot.text.style.color !== color) {
      slot.text.setColor(color);
    }
    if (slot.text.text !== label) {
      slot.text.setText(label);
    }
    slot.text.setPosition(slot.x, slot.y);
    slot.text.setScale(computePopupScalePop(0, slot.ttl, slot.baseScale));
    slot.text.setAlpha(1);
    slot.text.setVisible(true);
    slot.text.setActive(true);
    resolveActivePopupOverlaps(this.damagePool);
  }

  public spawnMuzzleFlashAndCasing(
    x: number,
    y: number,
    angleRad: number,
    isShotgun = false,
    isTeammate = false,
    weaponId?: string,
  ): void {
    spawnMuzzleFlashAndCasingImpl.call(this, x, y, angleRad, isShotgun, isTeammate, weaponId);
  }

  public spawnMeleeSlash(
    x: number,
    y: number,
    angleRad: number,
    isTeammate = false,
    rangeOrOptions:
      | number
      | { weaponId?: string; comboStep?: number; rangePx?: number } = 68,
    slashKeyArg: ShaderSlashKey = 'fx_sh_slash_steel',
  ): void {
    const opts = typeof rangeOrOptions === 'object' ? rangeOrOptions : undefined;
    const baseRangePx =
      typeof rangeOrOptions === 'number' ? rangeOrOptions : (opts?.rangePx ?? 68);
    const comboStep = opts?.comboStep;
    const weaponId = opts?.weaponId;
    const resolvedKey: ShaderSlashKey =
      weaponId === 'emerald_cleaver'
        ? 'fx_sh_slash_emerald'
        : weaponId === 'berserker_axe'
          ? 'fx_sh_slash_crimson'
          : weaponId === 'thunder_hammer'
            ? 'fx_sh_slash_thunder'
            : slashKeyArg;
    const rangePx = comboStep === 2 ? baseRangePx * 1.16 : baseRangePx;
    let flipY: boolean;
    if (typeof comboStep === 'number') {
      flipY = comboStep === 1;
    } else {
      this.slashFlipToggle = !this.slashFlipToggle;
      flipY = !this.slashFlipToggle;
    }
    this.spawnShaderSlash(x, y, rangePx, angleRad, resolvedKey, {
      ttl: comboStep === 2 ? 0.23 : 0.19,
      isTeammate,
      flipY,
      depth: 52,
    });

    // 3rd-hit combo finishers (comboStep === 2) emit bespoke weapon-signature flourishes
    if (comboStep === 2) {
      if (weaponId === 'emerald_cleaver') {
        this.spawnShaderSlash(
          x,
          y,
          rangePx * 0.94,
          angleRad + (flipY ? -0.26 : 0.26),
          'fx_sh_slash_emerald',
          {
            ttl: 0.21,
            isTeammate,
            flipY: !flipY,
            depth: 53,
          },
        );
      } else if (weaponId === 'berserker_axe') {
        this.spawnHitSparks(
          x + Math.cos(angleRad) * rangePx * 0.72,
          y + Math.sin(angleRad) * rangePx * 0.72,
          angleRad + Math.PI,
          { isCrit: true, element: 'burn', count: 6, isTeammate },
        );
      } else if (weaponId === 'thunder_hammer') {
        this.spawnHitSparks(
          x + Math.cos(angleRad) * rangePx * 0.72,
          y + Math.sin(angleRad) * rangePx * 0.72,
          angleRad + Math.PI,
          { isCrit: true, element: 'shock', count: 6, isTeammate },
        );
      } else {
        this.spawnShaderDirectional(x, y, rangePx * 0.92, angleRad, 'fx_sh_aegis_crest', {
          ttl: 0.22,
          isTeammate,
          tint: 0xfef08a,
          forwardOffsetRatio: 0.22,
          depth: 53,
        });
      }
    }
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
      isTeammate?: boolean;
    } = {},
  ): void {
    spawnHitSparksImpl.call(this, x, y, impactAngleRad, options);
  }

  public spawnDashDust(x: number, y: number): void {
    const invBake = 1 / TextureBaker.getBakeScale();
    for (let i = 0; i < 4; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;
      const ang = getClientFreezeRandom()() * Math.PI * 2;
      const spd = 20 + getClientFreezeRandom()() * 45;
      activateParticle(p, {
        textureKey: 'fx_dust_puff',
        x: x + (getClientFreezeRandom()() - 0.5) * 10,
        y: y + (getClientFreezeRandom()() - 0.5) * 6,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 12,
        vr: 0,
        ttl: 0.26 + getClientFreezeRandom()() * 0.1,
        startScale: invBake * 0.95,
        endScale: invBake * 0.2,
        startAlpha: 0.75,
        gravityY: 0,
        damping: 5,
        tint: hexToNum(PALETTE.CYAN_FROST),
        blendMode: 'NORMAL',
        depth: 18,
      });
    }
  }

  public spawnFootstepDust(x: number, y: number, biome: 1 | 2 | 3 = this.currentBiome): void {
    if (graphicsSettings.getState().quality === 'low') return;
    const invBake = 1 / TextureBaker.getBakeScale();
    const tint = hexToNum(
      biome === 2 ? PALETTE.ICE_WHITE : biome === 3 ? PALETTE.COPPER_LIGHT : PALETTE.WARM_STONE,
    );
    for (let i = 0; i < 2; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;
      const side = i === 0 ? -1 : 1;
      activateParticle(p, {
        textureKey: 'fx_dust_puff',
        x: x + side * 3.5,
        y: y - 1,
        vx: side * (10 + getClientFreezeRandom()() * 8),
        vy: -8 - getClientFreezeRandom()() * 6,
        vr: 0,
        ttl: 0.24,
        startScale: invBake * 0.45,
        endScale: invBake * 0.15,
        startAlpha: 0.42,
        gravityY: -6,
        damping: 4,
        tint,
        blendMode: 'NORMAL',
        depth: 18,
      });
    }
  }

  public spawnEnemyDeathBurst(defId: string, x: number, y: number): void {
    this.spawnFloorDecal('splatter', x, y + 6, 1.0);

    if (defId === 'spore_king' || defId === 'kryssa_ice_queen' || defId === 'forge_titan') {
      this.spawnBossKillBurst(x, y, defId);
    }

    const invBake = 1 / TextureBaker.getBakeScale();
    const rigDef = RIG_DEFS_BY_ID[defId];
    const rigFootY = y + 12;
    if (rigDef) {
      for (const part of rigDef.parts) {
        const p = this.acquireParticleSlot();
        if (!p) break;
        const radialAng = Math.atan2(part.offsetY + 14, part.offsetX || 0.1);
        const ang = radialAng + (getClientFreezeRandom()() - 0.5) * 0.55;
        const spd = 72 + getClientFreezeRandom()() * 88;
        const texKey = TextureBaker.getPartTextureKey(rigDef.id, part.id);
        activateParticle(p, {
          textureKey: texKey,
          x: x + part.offsetX * 0.65,
          y: rigFootY + part.offsetY * 0.65,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 46,
          vr: (part.offsetX >= 0 ? 1 : -1) * (6 + getClientFreezeRandom()() * 9),
          ttl: 0.55,
          startScale: invBake * 0.92,
          endScale: invBake * 0.36,
          startAlpha: 0.96,
          gravityY: 210,
          damping: 3.8,
          blendMode: 'NORMAL',
          depth: 35,
        });
      }
    }

    this.spawnHitSparks(x, y, 0, { isCrit: true, count: 8 });
  }

  public spawnExplosionBurst(
    x: number,
    y: number,
    radius: number,
    colorHex: string = PALETTE.FLAME_ORANGE,
  ): void {
    spawnExplosionBurstImpl.call(this, x, y, radius, colorHex);
  }

  public update(dtSec: number, camView?: Phaser.Geom.Rectangle): void {
    const simProps = (
      this.sceneRef as unknown as {
        transport?: {
          getSim?: () => {
            props?: ReadonlyArray<{ kind: string; x: number; y: number; hp: number }>;
          };
        };
      }
    ).transport?.getSim?.()?.props;
    if (simProps) {
      this.syncTorchPositions(simProps);
    }
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

  public getActiveTorchMoteCount(): number {
    return getActiveTorchMoteCount.call(this);
  }

  public acquireParticleSlot(): PooledParticle | null {
    return acquireParticleSlot.call(this);
  }

  public acquireDamageSlot(targetX?: number, targetY?: number): PooledDamageText | null {
    return acquireDamageSlot.call(this, targetX, targetY);
  }
}
