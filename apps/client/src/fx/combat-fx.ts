import {
  clamp,
  type ElementalReactionId,
  type ElementType,
  type PropKind,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE, PLAYER_SLOT_COLORS } from '../art/palette.js';
import { RIG_DEFS_BY_ID } from '../art/rig-defs.js';
import { CUTOUT_KIT_ATLAS_KEY } from '../art/texture-baker-fx.js';
import { TextureBaker } from '../art/texture-baker.js';
import type {
  ShaderDirectionalKey,
  ShaderNovaKey,
  ShaderSlashKey,
} from '../art/texture-baker-shader-fx.js';
import { getClientFreezeRandom } from '../core/visual-query.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import { fillTaperedArcRibbon } from './tapered-ribbon-builder.js';
import {
  acquireDamageSlot,
  acquireParticleSlot,
  BIOME_AMBIENT_POOL_SLOTS,
  computeCameraShakeOffset,
  computePopupScalePop,
  DAMAGE_NUMERIC_SLOT_END,
  getActiveAfterimageCount,
  getActiveAmbientCount,
  getActiveDamagePopupCount,
  getActiveDecalCount,
  getActiveParticleCount,
  getActiveTorchMoteCount,
  initCombatFxPools,
  type ActiveArcRibbon,
  type ActiveFloorTeleportFold,
  type ActivePerimeterRing,
  type PooledAfterimage,
  type PooledAmbientParticle,
  type PooledDamageText,
  type PooledDecal,
  type PooledLightningArc,
  type PooledParticle,
  refreshResolution,
  resolveActivePopupOverlaps,
  resolveSpatialPopupCellSlot,
  resolveTacticalAlertSlotOverlaps,
  update,
} from './combat-fx-pools.js';

export {
  DAMAGE_NUMERIC_SLOT_END,
  resolveTacticalAlertSlotOverlaps,
} from './combat-fx-pools.js';
import {
  activateParticle,
  applyBiomeToAmbientSlot,
  type CoalescedReactionBannerState,
  routeCutoutBurstByRadius,
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
import { resetPlayerOverheatVentPuffs } from './combat-fx-weapons-v2.js';

export * from './combat-fx-pools.js';
export * from './combat-fx-spawners.js';

/**
 * Object-pooled Combat FX, Chiaroscuro 1:1 Shader Flipbooks, Decals, Dash Afterimages, Clear Biome Ambient & Juice system.
 */
export class CombatFxManager {
  public readonly sceneRef: Phaser.Scene;
  public readonly particlePool: PooledParticle[] = [];
  public readonly damagePool: PooledDamageText[] = [];
  public readonly decalPool: PooledDecal[] = [];
  public readonly afterimagePool: PooledAfterimage[] = [];
  public readonly ambientPool: PooledAmbientParticle[] = [];
  public readonly lightningPool: PooledLightningArc[] = [];
  public lightningGraphics!: Phaser.GameObjects.Graphics;
  public underActorGraphics!: Phaser.GameObjects.Graphics;
  public weaponRibbonGraphics!: Phaser.GameObjects.Graphics;
  public floorFoldGraphics!: Phaser.GameObjects.Graphics;
  public activeFloorTeleportFolds: ActiveFloorTeleportFold[] = [];
  public floorFoldFreePool: ActiveFloorTeleportFold[] = [];
  public activeTeamComboFootRings: ActiveFloorTeleportFold[] = [];
  public teamComboFootRingFreePool: ActiveFloorTeleportFold[] = [];
  public lastHitSparkTimeByTargetId: Map<number, number> = new Map();
  public activePerimeterRings: ActivePerimeterRing[] = [];
  public activeArcRibbons: ActiveArcRibbon[] = [];
  public perimeterRingFreePool: ActivePerimeterRing[] = [];
  public arcRibbonFreePool: ActiveArcRibbon[] = [];
  public muzzleVariantCounter = 0;
  public muzzleFlipCounter = 0;
  public localPlayerPos = { x: 0, y: 0 };

  public decalWriteCursor = 0;
  public activeDecalCount = 0;
  public hitStopRemainingMs = 0;
  public bossKillSlowMoTimer = 0;
  public bossKillFlashTimer = 0;
  public bossKillSequenceState: BossKillSequenceState | null = null;
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

  public setLocalPlayerPosition(x: number, y: number): void {
    this.localPlayerPos.x = x;
    this.localPlayerPos.y = y;
  }

  public distanceToLocalPlayer(x: number, y: number): number {
    const dx = x - this.localPlayerPos.x;
    const dy = y - this.localPlayerPos.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public stampTeamComboFootRing(x: number, y: number): void {
    const ring = this.teamComboFootRingFreePool.pop() ?? {
      active: true,
      x,
      y,
      age: 0,
      ttl: 0.45,
    };
    ring.active = true;
    ring.x = x;
    ring.y = y;
    ring.age = 0;
    ring.ttl = 0.45;
    this.activeTeamComboFootRings.push(ring);
  }

  public resetRoomTransientState(): void {
    this.lastHitSparkTimeByTargetId.clear();
    this.activePerimeterRings.length = 0;
    this.activeArcRibbons.length = 0;
    this.activeFloorTeleportFolds.length = 0;
    this.activeTeamComboFootRings.length = 0;
    resetPlayerOverheatVentPuffs();
  }

  public spawnShaderNova(
    x: number,
    y: number,
    radiusPx: number,
    novaKey: ShaderNovaKey = 'fx_sh_nova_solar',
    options?: ShaderNovaSpawnOptions,
  ): PooledParticle | null {
    return spawnShaderNovaImpl.call(this, x, y, radiusPx, novaKey, options);
  }

  public spawnShaderSlash(
    x: number,
    y: number,
    rangePx: number,
    angleRad: number,
    slashKey: ShaderSlashKey = 'fx_sh_slash_steel',
    options?: ShaderSlashSpawnOptions,
  ): PooledParticle | null {
    return spawnShaderSlashImpl.call(this, x, y, rangePx, angleRad, slashKey, options);
  }

  public spawnShaderCone(
    x: number,
    y: number,
    reachPx: number,
    angleRad: number,
    options?: ShaderConeSpawnOptions,
  ): PooledParticle | null {
    return spawnShaderConeImpl.call(this, x, y, reachPx, angleRad, options);
  }

  public spawnShaderLance(
    x: number,
    y: number,
    lengthPx: number,
    angleRad: number,
    options?: ShaderLanceSpawnOptions,
  ): PooledParticle | null {
    return spawnShaderLanceImpl.call(this, x, y, lengthPx, angleRad, options);
  }

  public spawnShaderDirectional(
    x: number,
    y: number,
    reachPx: number,
    angleRad: number,
    key: ShaderDirectionalKey,
    options?: ShaderDirectionalSpawnOptions,
  ): PooledParticle | null {
    return spawnShaderDirectionalImpl.call(this, x, y, reachPx, angleRad, key, options);
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
    (slot as { age?: number }).age = 0;
    (slot as { ttl?: number }).ttl = 6.0;
    slot.textureKey = texKey;
    slot.sprite.setTexture(texKey);
    slot.sprite.setPosition(x, y);
    slot.sprite.setRotation((this.decalWriteCursor * 1.17) % (Math.PI * 2));
    slot.sprite.setScale(invBake * scaleMult);
    slot.sprite.setAlpha(0.32);
    slot.sprite.setDepth(6);
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

  public spawnPropBreakBurst(kind: PropKind | string, x: number, y: number): void {
    spawnPropBreakBurst(this, kind, x, y);
  }

  public spawnCrackedWallBurst(x: number, y: number): void {
    spawnCrackedWallBurst(this, x, y);
  }

  public spawnArcaneTeleportFold(x: number, y: number): void {
    spawnArcaneTeleportFold(this, x, y);
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
    damage?: number;
    radius?: number;
    isTeamCombo?: boolean;
    isTeammate?: boolean;
  }): void;
  public spawnElementalReactionFx(
    reaction: ElementalReactionId,
    x: number,
    y: number,
    radiusOrDamage?: number,
    isTeamCombo?: boolean,
    isTeammate?: boolean,
  ): void;
  public spawnElementalReactionFx(
    arg1:
      | {
          reaction: ElementalReactionId;
          x: number;
          y: number;
          damage?: number;
          radius?: number;
          isTeamCombo?: boolean;
          isTeammate?: boolean;
        }
      | ElementalReactionId,
    arg2?: number,
    arg3?: number,
    arg4?: number,
    arg5?: boolean,
    arg6?: boolean,
  ): void {
    if (typeof arg1 === 'string') {
      (spawnElementalReactionFxImpl as (this: CombatFxManager, ...args: unknown[]) => void).call(
        this,
        arg1,
        arg2 ?? 0,
        arg3 ?? 0,
        arg4,
        arg5 ?? false,
        arg6 ?? false,
      );
    } else {
      (spawnElementalReactionFxImpl as (this: CombatFxManager, ...args: unknown[]) => void).call(this, arg1);
    }
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

  public triggerBossKillSequence(
    x: number,
    y: number,
    biome: 1 | 2 | 3 = 1,
    bossId?: number,
    defId?: string,
  ): void {
    this.bossKillSequenceState = {
      active: true,
      x,
      y,
      biome,
      elapsedSec: 0,
      beat2Spawned: false,
      bossId,
      defId,
    };
  }

  public spawnBossKillBurst(
    x: number,
    y: number,
    defId = 'spore_king',
    bossId?: number,
  ): void {
    this.bossKillSlowMoTimer = 0.42;
    this.bossKillFlashTimer = 0.28;
    this.triggerHitStop(55);
    this.addTrauma(0.85);

    const bossBiome: 1 | 2 | 3 =
      defId === 'kryssa_ice_queen' ? 2 : defId === 'forge_titan' ? 3 : 1;
    this.triggerBossKillSequence(x, y, bossBiome, bossId, defId);

    const invBake = 1 / TextureBaker.getBakeScale();
    const primaryHex =
      defId === 'kryssa_ice_queen'
        ? PALETTE.CYAN_FROST
        : defId === 'forge_titan'
          ? PALETTE.FLAME_ORANGE
          : defId === 'spore_king'
            ? PALETTE.LIME_GLOW
            : PALETTE.SOLAR_GOLD;

    // Defer the main Cutout nova to Beat 2 (t = 0.16s) inside stepBossKillTwoBeatSequence so Beat 1
    // displays pure, unobstructed #141019 silhouette inversion + radial chest fracture rays!
    const count = 8;
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;
      const ang = (i / count) * Math.PI * 2;
      const spd = 125 + (i % 3) * 45;
      const isTrail = i % 2 === 0;
      activateParticle(p, {
        textureKey: isTrail ? 'fx_spark_trail' : 'fx_sparkle_mote',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        vr: isTrail ? 0 : 8,
        ttl: 0.34,
        startScale: invBake * 1.05,
        endScale: invBake * 0.2,
        damping: 4.2,
        rotation: ang,
        tint: hexToNum(i % 2 === 0 ? primaryHex : PALETTE.SOLAR_GOLD),
        depth: 43,
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
    targetId?: number;
    nowMs?: number;
  }): void {
    if (!graphicsSettings.getState().showDamageNumbers) return;

    const nowMs =
      params.nowMs ??
      (typeof performance !== 'undefined' ? performance.now() : Date.now());

    const numericLimit = Math.min(this.damagePool.length, DAMAGE_NUMERIC_SLOT_END);

    // Merge hits within 90ms on same targetId
    if (params.targetId !== undefined) {
      for (let i = 0; i < numericLimit; i++) {
        const s = this.damagePool[i]!;
        if (
          s.active &&
          s.targetId === params.targetId &&
          s.lastMergeMs !== undefined &&
          nowMs - s.lastMergeMs <= 90
        ) {
          const total = (s.accumulatedAmount ?? 0) + params.amount;
          s.accumulatedAmount = total;
          s.lastMergeMs = nowMs;
          s.age = 0;
          s.ttl = Math.max(s.ttl, params.isCrit ? 0.78 : 0.62);
          s.baseScale = Math.min(1.32, s.baseScale + 0.08);

          let newColor: string | undefined;
          if (params.isCrit) {
            newColor = PALETTE.SOLAR_GOLD;
          } else if (params.element === 'burn') {
            newColor = PALETTE.FLAME_ORANGE;
          } else if (params.element === 'chill') {
            newColor = PALETTE.CYAN_FROST;
          } else if (params.element === 'shock') {
            newColor = PALETTE.VOLT_YELLOW;
          } else if (params.element === 'poison') {
            newColor = PALETTE.LIME_GLOW;
          }
          if (newColor && s.text.style.color !== newColor) {
            s.text.setColor(newColor);
          }

          let label = `${total}`;
          if (params.targetKind === 'player') {
            label = `-${total}`;
          } else if (params.isCrit || s.text.text?.endsWith('!')) {
            label = `${total}!`;
          }
          s.text.setText(label);
          s.text.setScale(computePopupScalePop(0, s.ttl, s.baseScale));
          resolveTacticalAlertSlotOverlaps(this.damagePool, 4.0);
          return;
        }
      }
    }

    const cellRes = resolveSpatialPopupCellSlot(this.damagePool, params.x, params.y, 120, 3, numericLimit);
    if (cellRes.activeInCell >= 3 && cellRes.evictIndex !== null) {
      const oldest = this.damagePool[cellRes.evictIndex];
      if (!oldest || oldest.age < 0.48) {
        return;
      }
    }
    const slot =
      cellRes.evictIndex !== null && cellRes.evictIndex < numericLimit
        ? (this.damagePool[cellRes.evictIndex] ?? null)
        : this.acquireDamageSlot(params.x, params.y);
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
    slot.targetId = params.targetId;
    slot.lastMergeMs = nowMs;
    slot.accumulatedAmount = params.amount;

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
    resolveTacticalAlertSlotOverlaps(this.damagePool, 4.0);
  }

  public spawnDamageNumber(
    x: number,
    y: number,
    amount: number,
    isCrit = false,
    element: ElementType | 'none' = 'none',
    options?: { targetId?: number; nowMs?: number },
  ): void {
    this.spawnDamagePopup({
      x,
      y,
      amount,
      isCrit,
      targetKind: 'enemy',
      hitArmor: false,
      element: element === 'none' ? undefined : element,
      targetId: options?.targetId,
      nowMs: options?.nowMs,
    });
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
      | {
          weaponId?: string;
          comboStep?: number;
          rangePx?: number;
          lungeDx?: number;
          lungeDy?: number;
        } = 68,
    slashKeyArg: ShaderSlashKey = 'fx_sh_slash_steel',
  ): void {
    const opts = typeof rangeOrOptions === 'object' ? rangeOrOptions : undefined;
    const baseRangePx =
      typeof rangeOrOptions === 'number' ? rangeOrOptions : (opts?.rangePx ?? 68);
    const comboStep = opts?.comboStep;
    const weaponId = opts?.weaponId;
    const lungeDx = opts?.lungeDx ?? 0;
    const lungeDy = opts?.lungeDy ?? 0;
    const hasLunge = Math.hypot(lungeDx, lungeDy) > 0.5;
    const startX = hasLunge ? x - lungeDx : x;
    const startY = hasLunge ? y - lungeDy : y;
    const glideVx = hasLunge ? lungeDx * 18 : 0;
    const glideVy = hasLunge ? lungeDy * 18 : 0;
    const glideDamping = hasLunge ? 18 : 0;
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
    this.spawnShaderSlash(startX, startY, rangePx, angleRad, resolvedKey, {
      ttl: comboStep === 2 ? 0.23 : 0.19,
      isTeammate,
      flipY,
      depth: 52,
      vx: glideVx,
      vy: glideVy,
      damping: glideDamping,
    });

    // 3rd-hit combo finishers (comboStep === 2) emit bespoke weapon-signature flourishes
    if (comboStep === 2) {
      if (weaponId === 'emerald_cleaver') {
        this.spawnShaderSlash(
          startX,
          startY,
          rangePx * 0.94,
          angleRad + (flipY ? -0.26 : 0.26),
          'fx_sh_slash_emerald',
          {
            ttl: 0.21,
            isTeammate,
            flipY: !flipY,
            depth: 53,
            vx: glideVx,
            vy: glideVy,
            damping: glideDamping,
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
      } else if (weaponId === 'knight_sword') {
        this.spawnShaderSlash(
          startX,
          startY,
          rangePx * 0.94,
          angleRad + (flipY ? -0.22 : 0.22),
          'fx_sh_slash_steel',
          {
            ttl: 0.21,
            isTeammate,
            flipY: !flipY,
            depth: 53,
            vx: glideVx,
            vy: glideVy,
            damping: glideDamping,
          },
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
      targetId?: string | number;
      targetX?: number;
      targetY?: number;
      targetRadius?: number;
      nowMs?: number;
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

  public spawnEnemyDeathBurst(defId: string, x: number, y: number, bossId?: number): void {
    this.spawnFloorDecal('splatter', x, y + 6, 1.0);

    const isBoss = defId === 'spore_king' || defId === 'kryssa_ice_queen' || defId === 'forge_titan';
    if (isBoss) {
      this.spawnBossKillBurst(x, y, defId, bossId);
      return;
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
      this.sceneRef as unknown as
        | {
            transport?: {
              getSim?: () => {
                props?: ReadonlyArray<{ kind: string; x: number; y: number; hp: number }>;
              };
            };
          }
        | undefined
    )?.transport?.getSim?.()?.props;
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

export function resolvePropMaterialShardKey(propKind: PropKind | string): {
  isScorch: boolean;
  shardKey:
    | 'fx_wood_shard'
    | 'fx_ceramic_shard'
    | 'fx_stone_chip'
    | 'fx_ice_shard_decal'
    | 'fx_decal_scorch';
} {
  const k = String(propKind).toLowerCase();
  if (k === 'explosive_barrel' || k === 'coal_bomb') {
    return { isScorch: true, shardKey: 'fx_decal_scorch' };
  }
  if (
    k.includes('wood') ||
    k.includes('crate') ||
    k.includes('moss_table') ||
    k.includes('rotten_totem')
  ) {
    return { isScorch: false, shardKey: 'fx_wood_shard' };
  }
  if (
    k.includes('vase') ||
    k.includes('clay') ||
    k.includes('spore_pod') ||
    k.includes('caustic') ||
    k.includes('volatile')
  ) {
    return { isScorch: false, shardKey: 'fx_ceramic_shard' };
  }
  if (
    k.includes('ice') ||
    k.includes('glacial') ||
    k.includes('cryo') ||
    k.includes('crystal')
  ) {
    return { isScorch: false, shardKey: 'fx_ice_shard_decal' };
  }
  return { isScorch: false, shardKey: 'fx_stone_chip' };
}

export function spawnPropBreakBurst(
  fx: CombatFxManager,
  propKind: PropKind | string,
  x: number,
  y: number,
): void {
  const { isScorch, shardKey } = resolvePropMaterialShardKey(propKind);
  if (isScorch) {
    fx.spawnFloorDecal('scorch', x, y, 1.25);
    fx.spawnExplosionBurst?.(x, y, 48, PALETTE.FLAME_ORANGE);
    fx.addTrauma?.(0.24);
    return;
  }

  const maxAllowed = graphicsSettings.getBudget().maxDecals;
  if (maxAllowed > 0 && fx.decalPool.length > 0) {
    const shardCount = 3;
    for (let s = 0; s < shardCount; s++) {
      const idx = fx.decalWriteCursor % Math.min(maxAllowed, fx.decalPool.length);
      fx.decalWriteCursor += 1;
      const slot = fx.decalPool[idx];
      if (!slot) continue;
      const offDist = s === 0 ? 0 : 5 + s * 4;
      const offAng = (s * 2.1) % (Math.PI * 2);
      const sx = x + Math.cos(offAng) * offDist;
      const sy = y + Math.sin(offAng) * offDist;
      slot.active = true;
      slot.textureKey = shardKey;
      (slot as { age?: number }).age = 0;
      (slot as { ttl?: number }).ttl = 6.0;
      slot.sprite.setTexture('fx_cutout_kit_512', shardKey);
      slot.sprite.setPosition(sx, sy);
      slot.sprite.setRotation(offAng + s * 0.7);
      slot.sprite.setScale(1 / 3);
      slot.sprite.setAlpha(0.32);
      slot.sprite.setDepth(6);
      slot.sprite.setVisible(true);
      fx.totalDecalsSpawned += 1;
      fx.activeDecalCount = Math.min(maxAllowed, fx.activeDecalCount + 1);
    }
  }

  const count = 8;
  for (let i = 0; i < count; i++) {
    const p = fx.acquireParticleSlot();
    if (!p) break;
    const ang = (i / count) * Math.PI * 2 + (getClientFreezeRandom()() - 0.5) * 0.4;
    const spd = 65 + getClientFreezeRandom()() * 85;
    activateParticle(p, {
      textureKey: CUTOUT_KIT_ATLAS_KEY,
      frameName: shardKey,
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 30,
      vr: (getClientFreezeRandom()() - 0.5) * 16,
      ttl: 0.45,
      startScale: (1 / 3) * 1.05,
      endScale: (1 / 3) * 0.45,
      startAlpha: 1,
      gravityY: 200,
      damping: 4,
      rotation: ang,
      blendMode: 'NORMAL',
      depth: 38,
    });
  }
}

export function spawnCrackedWallBurst(
  fx: CombatFxManager,
  x: number,
  y: number,
): void {
  const maxAllowed = graphicsSettings.getBudget().maxDecals;
  if (maxAllowed > 0 && fx.decalPool.length > 0) {
    const shardCount = 4;
    for (let s = 0; s < shardCount; s++) {
      const idx = fx.decalWriteCursor % Math.min(maxAllowed, fx.decalPool.length);
      fx.decalWriteCursor += 1;
      const slot = fx.decalPool[idx];
      if (!slot) continue;
      const offDist = s === 0 ? 0 : 6 + s * 4;
      const offAng = (s * 1.8) % (Math.PI * 2);
      const sx = x + Math.cos(offAng) * offDist;
      const sy = y + Math.sin(offAng) * offDist;
      slot.active = true;
      slot.textureKey = 'fx_stone_chip';
      (slot as { age?: number }).age = 0;
      (slot as { ttl?: number }).ttl = 6.0;
      slot.sprite.setTexture('fx_cutout_kit_512', 'fx_stone_chip');
      slot.sprite.setPosition(sx, sy);
      slot.sprite.setRotation(offAng);
      slot.sprite.setScale(1 / 3);
      slot.sprite.setAlpha(0.32);
      slot.sprite.setDepth(6);
      slot.sprite.setVisible(true);
      fx.totalDecalsSpawned += 1;
      fx.activeDecalCount = Math.min(maxAllowed, fx.activeDecalCount + 1);
    }
  }

  const count = 8;
  for (let i = 0; i < count; i++) {
    const p = fx.acquireParticleSlot();
    if (!p) break;
    const ang = (i / count) * Math.PI * 2 + (getClientFreezeRandom()() - 0.5) * 0.4;
    const spd = 75 + getClientFreezeRandom()() * 85;
    activateParticle(p, {
      textureKey: CUTOUT_KIT_ATLAS_KEY,
      frameName: 'fx_stone_chip',
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 30,
      vr: (getClientFreezeRandom()() - 0.5) * 16,
      ttl: 0.45,
      startScale: (1 / 3) * 1.1,
      endScale: (1 / 3) * 0.4,
      startAlpha: 1,
      gravityY: 220,
      damping: 4,
      rotation: ang,
      blendMode: 'NORMAL',
      depth: 38,
    });
  }

  fx.spawnExplosionBurst?.(x, y, 44);
  fx.spawnHitSparks?.(x, y, Math.PI, { hitWall: true });
  fx.addTrauma?.(0.28);
}

export function spawnArcaneTeleportFold(
  fx: CombatFxManager,
  x: number,
  y: number,
): void {
  (fx as unknown as { lastTeleportFoldPos?: { x: number; y: number } }).lastTeleportFoldPos = {
    x,
    y,
  };
  const fold = fx.floorFoldFreePool?.pop() ?? { active: true, x, y, age: 0, ttl: 0.32 };
  fold.active = true;
  fold.x = x;
  fold.y = y;
  fold.age = 0;
  fold.ttl = 0.32;
  if (Array.isArray(fx.activeFloorTeleportFolds)) {
    fx.activeFloorTeleportFolds.push(fold);
  }

  routeCutoutBurstByRadius(fx, x, y, 56, 'fx_sh_arcane_sigil', {
    tint: 0x38bdf8,
    ttlSec: 0.28,
  });

  const p = typeof fx.acquireParticleSlot === 'function' ? fx.acquireParticleSlot() : null;
  if (p) {
    const invBake = 1 / TextureBaker.getBakeScale();
    activateParticle(p, {
      textureKey: 'fx_spark',
      x,
      y: y - 10,
      vx: 0,
      vy: 0,
      vr: 0,
      ttl: 0.24,
      startScale: invBake * 0.9,
      endScale: invBake * 0.1,
      scaleRatioY: 4.5,
      startAlpha: 0.95,
      gravityY: 0,
      damping: 0,
      tint: 0x38bdf8,
      blendMode: 'ADD',
      depth: 35,
    });
  }
}

export interface BossKillSequenceState {
  active: boolean;
  x: number;
  y: number;
  biome: 1 | 2 | 3;
  elapsedSec: number;
  beat2Spawned: boolean;
  bossId?: number;
  defId?: string;
}

export function stepBossKillTwoBeatSequence(
  fx: CombatFxManager,
  rawDtSec: number,
): { phase: 'idle' | 'invert_cracks' | 'twin_crescents'; progress01: number } {
  const state = fx.bossKillSequenceState;
  if (!state || !state.active) {
    return { phase: 'idle', progress01: 0 };
  }

  state.elapsedSec += rawDtSec;
  if (state.elapsedSec >= 0.42) {
    state.active = false;
    return { phase: 'idle', progress01: 1 };
  }

  if (state.elapsedSec < 0.16) {
    const progress01 = Math.min(1, Math.max(0, state.elapsedSec / 0.16));
    const scene = fx.sceneRef as unknown as {
      bossFractureGraphics?: Phaser.GameObjects.Graphics;
    };
    const fracG = scene?.bossFractureGraphics;
    if (fracG) {
      const rayLen = 16 + progress01 * 34;
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 + 0.3;
        const x2 = state.x + Math.cos(ang) * rayLen;
        const y2 = state.y + Math.sin(ang) * rayLen;
        if (typeof fracG.fillTriangle === 'function' && typeof fracG.fillStyle === 'function') {
          fracG.fillStyle(0x141019, 0.95);
          fracG.fillTriangle(state.x, state.y, x2 - 1.5, y2, x2 + 1.5, y2);
          fracG.fillStyle(hexToNum(PALETTE.BONE_WHITE), 0.98);
          fracG.fillTriangle(state.x, state.y, x2 - 0.7, y2, x2 + 0.7, y2);
        } else if (typeof fracG.lineBetween === 'function' && typeof fracG.lineStyle === 'function') {
          fracG.lineStyle(1.8, hexToNum(PALETTE.BONE_WHITE), 1.0);
          fracG.lineBetween(state.x, state.y, x2, y2);
        }
      }
    }
    return { phase: 'invert_cracks', progress01 };
  }

  // Beat 2: 0.16..0.42s (duration 0.26s)
  const progress01 = Math.min(1, Math.max(0, (state.elapsedSec - 0.16) / 0.26));
  const underG = fx.underActorGraphics;
  if (underG) {
    const baseAngle = progress01 * Math.PI * 1.5;
    const span = 0.85;
    const color =
      state.biome === 2
        ? 0x38bdf8
        : state.biome === 3
          ? 0xf97316
          : 0x4ade80;
    fillTaperedArcRibbon(
      underG,
      state.x,
      state.y,
      132,
      baseAngle - span,
      baseAngle + span,
      4.0,
      color,
      0.9,
      8,
      1.8,
    );
    fillTaperedArcRibbon(
      underG,
      state.x,
      state.y,
      132,
      baseAngle + Math.PI - span,
      baseAngle + Math.PI + span,
      4.0,
      color,
      0.9,
      8,
      1.8,
    );
  }

  // Scatter 12 Cutout shard relics + destroy dying boss rig + rig burst once on Beat 2 start
  if (!state.beat2Spawned) {
    state.beat2Spawned = true;

    const novaKey: ShaderNovaKey =
      state.defId === 'kryssa_ice_queen' || state.biome === 2
        ? 'fx_sh_nova_cryo'
        : state.defId === 'forge_titan' || state.biome === 3
          ? 'fx_sh_geyser_plume'
          : state.defId === 'spore_king'
            ? 'fx_sh_spore_cloud'
            : 'fx_sh_nova_solar';
    routeCutoutBurstByRadius(fx, state.x, state.y, 92, novaKey, {
      ttlSec: 0.26,
      depth: 43.5,
      sparkCount: 0,
      suppressPerimeterRing: true,
    });

    // Destroy dying Boss rig at Beat 2 transition
    const gameScene = fx.sceneRef as unknown as {
      enemyRigs?: Map<number, { destroy: () => void }>;
    };
    if (gameScene?.enemyRigs && state.bossId !== undefined) {
      const dyingRig = gameScene.enemyRigs.get(state.bossId);
      if (dyingRig) {
        dyingRig.destroy();
        gameScene.enemyRigs.delete(state.bossId);
      }
    }

    // Scatter Boss rig parts at Beat 2 start
    const rigDef = state.defId ? RIG_DEFS_BY_ID[state.defId] : undefined;
    if (rigDef) {
      const invBake = 1 / TextureBaker.getBakeScale();
      const rigFootY = state.y + 12;
      for (const part of rigDef.parts) {
        const p = fx.acquireParticleSlot();
        if (!p) break;
        const radialAng = Math.atan2(part.offsetY + 14, part.offsetX || 0.1);
        const ang = radialAng + (getClientFreezeRandom()() - 0.5) * 0.55;
        const spd = 72 + getClientFreezeRandom()() * 88;
        const texKey = TextureBaker.getPartTextureKey(rigDef.id, part.id);
        activateParticle(p, {
          textureKey: texKey,
          x: state.x + part.offsetX * 0.65,
          y: rigFootY + part.offsetY * 0.65,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 46,
          vr: (part.offsetX >= 0 ? 1 : -1) * (6 + getClientFreezeRandom()() * 9),
          ttl: 0.55,
          startScale: invBake * 1.05,
          endScale: invBake * 0.25,
          startAlpha: 0.98,
          gravityY: 160,
          damping: 2.2,
          rotation: ang,
          depth: 46,
        });
      }
    }

    const shardKey =
      state.biome === 2
        ? 'fx_ice_shard_decal'
        : state.biome === 3
          ? 'fx_stone_chip'
          : 'fx_ceramic_shard';

    const maxAllowed = graphicsSettings.getBudget().maxDecals;
    if (maxAllowed > 0 && fx.decalPool.length > 0) {
      for (let s = 0; s < 12; s++) {
        const idx = fx.decalWriteCursor % Math.min(maxAllowed, fx.decalPool.length);
        fx.decalWriteCursor += 1;
        const slot = fx.decalPool[idx];
        if (!slot) continue;
        const offDist = 18 + s * 7;
        const offAng = (s / 12) * Math.PI * 2 + s * 0.4;
        const sx = state.x + Math.cos(offAng) * offDist;
        const sy = state.y + Math.sin(offAng) * offDist;
        slot.active = true;
        slot.textureKey = shardKey;
        (slot as unknown as { age?: number }).age = 0;
        (slot as unknown as { ttl?: number }).ttl = 12.0;
        slot.sprite.setTexture('fx_cutout_kit_512', shardKey);
        slot.sprite.setPosition(sx, sy);
        slot.sprite.setRotation(offAng);
        slot.sprite.setScale(1 / 3);
        slot.sprite.setAlpha(0.32);
        slot.sprite.setDepth(6);
        slot.sprite.setVisible(true);
        fx.totalDecalsSpawned += 1;
        fx.activeDecalCount = Math.min(maxAllowed, fx.activeDecalCount + 1);
      }
    }

    for (let i = 0; i < 12; i++) {
      const p = fx.acquireParticleSlot();
      if (!p) break;
      const ang = (i / 12) * Math.PI * 2;
      const spd = 90 + (i % 3) * 45;
      activateParticle(p, {
        textureKey: CUTOUT_KIT_ATLAS_KEY,
        frameName: shardKey,
        x: state.x,
        y: state.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 30,
        vr: (i % 2 === 0 ? 1 : -1) * 8,
        ttl: 0.42,
        startScale: 1 / 3,
        endScale: (1 / 3) * 0.6,
        startAlpha: 0.95,
        gravityY: 140,
        damping: 3.5,
        rotation: ang,
        blendMode: 'NORMAL',
        depth: 26.4,
      });
    }
  }

  return { phase: 'twin_crescents', progress01 };
}
