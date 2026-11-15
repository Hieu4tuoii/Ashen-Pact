import {
  clamp,
  ELEMENTAL_REACTIONS,
  type ElementalReactionId,
  type ElementType,
  type EnemyBulletShape,
  i18n,
} from '@ashen-pact/shared';
import { easeOutBack, easeOutCubic } from '../art/easing.js';
import { hexToNum, PALETTE } from '../art/palette.js';
import { TextureBaker } from '../art/texture-baker.js';
import { CUTOUT_KIT_ATLAS_KEY, type ElementalReactionStripKey } from '../art/texture-baker-fx.js';
import {
  computeShaderDirectionalScale,
  computeShaderNovaScale,
  getShaderStripEntry,
  resolveColorHexToNovaKey,
  SHADER_FX_FRAME_COUNT,
  type ShaderDirectionalKey,
  type ShaderNovaKey,
  type ShaderSlashKey,
  type ShaderStripEntry,
} from '../art/texture-baker-shader-fx.js';
import { getClientFreezeRandom } from '../core/visual-query.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import type { CombatFxManager } from './combat-fx.js';
import {
  isCutoutKitFrame,
  type PooledAmbientParticle,
  type PooledParticle,
  resolveActivePopupOverlaps,
} from './combat-fx-pools.js';

export type FxEaseCurve = 'linear' | 'easeOutCubic' | 'easeOutBack';

export interface CoalescedReactionBannerState {
  reaction: ElementalReactionId;
  count: number;
  totalDamage: number;
  isTeamCombo: boolean;
  windowTimerSec: number;
  displayTimerSec: number;
  label: string;
  colorHex: string;
}

export function coalesceElementalReaction(
  prev: CoalescedReactionBannerState | null,
  reaction: ElementalReactionId,
  damage: number,
  isTeamCombo: boolean,
  windowSec = 0.4,
): CoalescedReactionBannerState {
  const meta = ELEMENTAL_REACTIONS[reaction];
  const rxText = i18n.getReactionText(reaction);
  const baseName = (rxText.name || meta?.nameVi || reaction).toUpperCase();
  const colorHex = meta?.colorHex ?? PALETTE.SOLAR_GOLD;

  if (prev && prev.reaction === reaction && prev.windowTimerSec > 0) {
    const nextCount = prev.count + 1;
    return {
      reaction,
      count: nextCount,
      totalDamage: prev.totalDamage + damage,
      isTeamCombo: prev.isTeamCombo || isTeamCombo,
      windowTimerSec: windowSec,
      displayTimerSec: 1.6,
      label: `${baseName} ×${nextCount}`,
      colorHex,
    };
  }

  return {
    reaction,
    count: 1,
    totalDamage: damage,
    isTeamCombo,
    windowTimerSec: windowSec,
    displayTimerSec: 1.6,
    label: baseName,
    colorHex,
  };
}

export interface AllyFxProfile {
  isTeammate: boolean;
  bulletAlpha: number;
  aoeAlpha: number;
  turretRingAlpha: number;
  allowLightAndShake: boolean;
}

export function resolveAllyFxProfile(
  ownerPlayerId: number | string | undefined,
  localPlayerId: number | string | undefined,
  settingOpacity?: number,
): AllyFxProfile {
  const isTeammate =
    ownerPlayerId !== undefined &&
    localPlayerId !== undefined &&
    String(ownerPlayerId) !== String(localPlayerId);
  if (!isTeammate) {
    return {
      isTeammate: false,
      bulletAlpha: 1.0,
      aoeAlpha: 1.0,
      turretRingAlpha: 1.0,
      allowLightAndShake: true,
    };
  }
  const s = clamp(settingOpacity ?? 1.0, 0, 1);
  return {
    isTeammate: true,
    bulletAlpha: 0.42 * s,
    aoeAlpha: 0.35 * s,
    turretRingAlpha: 0,
    allowLightAndShake: false,
  };
}

export function applyP1SafeHaloAlpha(
  baseAlpha: number,
  isAllyOrSelf: boolean,
  distToLocal: number,
  radius: number,
): number {
  if (!isAllyOrSelf) return baseAlpha;
  const safeHaloThreshold = 18 + 0.35 * radius;
  if (distToLocal <= safeHaloThreshold) {
    return baseAlpha * 0.15;
  }
  return baseAlpha;
}

export interface ProjectileRenderSpec {
  textureKey: string;
  texture: string;
  frameName?: string;
  tint: number;
  blendMode: 'NORMAL' | 'ADD';
  depth: number;
  alpha: number;
  scale: number;
}

export function resolveProjectileRenderSpec(
  paramsOrWeaponId:
    | string
    | {
        team: 'player' | 'enemy';
        element?: ElementType;
        weaponId?: string;
        biome?: 1 | 2 | 3;
        isStress?: boolean;
        isTeammate?: boolean;
        teammateFxOpacity?: number;
        bulletShape?: EnemyBulletShape;
        radius?: number;
      },
): ProjectileRenderSpec {
  const params =
    typeof paramsOrWeaponId === 'string'
      ? { team: 'player' as const, weaponId: paramsOrWeaponId }
      : paramsOrWeaponId;

  if (params.team === 'enemy') {
    let textureKey = 'proj_enemy_orb';
    let refRadius = 6.0;
    if (params.isStress) {
      textureKey = 'proj_stress_enemy';
    } else if (params.bulletShape === 'small_orb') {
      textureKey = 'proj_enemy_small_orb';
      refRadius = 5.2;
    } else if (params.bulletShape === 'heavy_orb') {
      textureKey = 'proj_enemy_heavy_orb';
      refRadius = 7.8;
    } else if (params.bulletShape === 'lance') {
      textureKey = 'proj_enemy_lance';
      refRadius = 6.0;
    }
    const scale = params.isStress
      ? 1.0
      : clamp((params.radius ?? refRadius) / refRadius, 0.75, 1.65);
    return {
      textureKey,
      texture: textureKey,
      tint: 0xffffff,
      blendMode: 'NORMAL',
      depth: 60,
      alpha: 1.0,
      scale,
    };
  }

  let textureKey = 'proj_player_bolt';
  let frameName: string | undefined = undefined;
  let tint = 0xffffff;
  let scale = 1.0;
  if (params.weaponId === 'knight_sword_wave' && !params.isStress) {
    textureKey = 'proj_knight_sword_wave';
    tint = 0xfef08a;
    scale = 1.35;
  } else if (params.weaponId === 'knight_sword_parry' && !params.isStress) {
    textureKey = 'proj_player_bolt';
    tint = 0xfef08a;
    scale = 1.2;
  } else if (params.weaponId === 'gale_smg_wind_blade' && !params.isStress) {
    textureKey = CUTOUT_KIT_ATLAS_KEY;
    frameName = 'proj_gale_wind_blade';
    tint = 0xffffff;
    scale = 1 / 3;
  } else if (params.weaponId === 'thunder_hammer' && !params.isStress) {
    textureKey = CUTOUT_KIT_ATLAS_KEY;
    frameName = 'fx_thrown_thunder_hammer';
    tint = 0xffffff;
    scale = 1 / 3;
  } else if (params.weaponId === 'frag_launcher_sub' && !params.isStress) {
    textureKey = 'proj_player_pellet';
    tint = 0xf97316;
    scale = 1.15;
  } else if (params.weaponId === 'frag_launcher' && !params.isStress) {
    textureKey = 'proj_player_burn';
    tint = 0xfacc15;
    scale = 1.25;
  } else if (params.weaponId === 'thorn_staff' && !params.isStress) {
    textureKey = 'proj_player_poison';
    tint = 0x4ade80;
    scale = 1.2;
  } else if (params.weaponId === 'seed_gun' && !params.isStress) {
    textureKey = 'proj_player_poison';
    tint = 0x86efac;
    scale = 1.12;
  } else if (params.isStress) {
    textureKey = 'proj_stress_player';
    if (params.element === 'burn') tint = 0xfb923c;
    else if (params.element === 'chill') tint = 0x38bdf8;
    else if (params.element === 'shock') tint = 0xfde047;
    else if (params.element === 'poison') tint = 0x4ade80;
    else if (params.weaponId === 'scrap_shotgun') tint = 0xfacc15;
    else tint = 0x7dd3fc;
  } else if (params.element === 'burn') {
    textureKey = 'proj_player_burn';
  } else if (params.element === 'chill') {
    textureKey = 'proj_player_chill';
  } else if (params.element === 'shock') {
    textureKey = 'proj_player_shock';
  } else if (params.element === 'poison') {
    textureKey = 'proj_player_poison';
  } else if (params.weaponId === 'scrap_shotgun') {
    textureKey = 'proj_player_pellet';
  }

  const isTeammate = Boolean(params.isTeammate);
  const s = clamp(params.teammateFxOpacity ?? 1.0, 0, 1);
  const alpha = isTeammate ? 0.42 * s : 1.0;
  const depth = params.weaponId === 'thunder_hammer' ? 41.5 : 41;
  return { textureKey, texture: textureKey, frameName, tint, blendMode: 'NORMAL', depth, alpha, scale };
}

const ADDITIVE_FX_DEPTH_BY_KEY: Readonly<Record<string, number>> = {
  fx_spark: 55,
  fx_spark_trail: 55,
  fx_impact_ring: 54,
  fx_shockwave_ring: 56,
  fx_muzzle_flash: 49,
  fx_muzzle_core: 50,
  fx_slash_arc: 52,
  fx_ember_mote: 36,
  fx_ambient_firefly: 36,
  fx_rarity_beam: 46,
  fx_sparkle_mote: 47,
};

const OPAQUE_FX_DEPTH_BY_KEY: Readonly<Record<string, number>> = {
  fx_shell_casing: 22,
  fx_wood_shard: 38,
  fx_dust_puff: 18,
  fx_ambient_leaf: 32,
  fx_ambient_snow: 35,
  fx_ice_shard: 53,
  // 24 Cutout unpremultiplied RGBA shader flipbooks (NORMAL blend, depth 42.0..43.5 < enemy red bullets 60.0!)
  fx_sh_muzzle_burst: 42.0,
  fx_sh_muzzle_arcane: 42.0,
  fx_sh_slash_steel: 42.5,
  fx_sh_slash_emerald: 42.5,
  fx_sh_slash_crimson: 42.5,
  fx_sh_slash_thunder: 42.5,
  fx_sh_hit_spark: 42.5,
  fx_sh_cone_blast: 43.0,
  fx_sh_aegis_crest: 43.0,
  fx_sh_falcon_sonic: 43.0,
  fx_sh_beam_lance: 43.0,
  fx_sh_arcane_sigil: 43.0,
  fx_sh_nova_solar: 43.5,
  fx_sh_nova_magma: 43.5,
  fx_sh_nova_thunder: 43.5,
  fx_sh_nova_cryo: 43.5,
  fx_sh_nova_venom: 43.5,
  fx_sh_nova_void: 43.5,
  fx_sh_vortex_gale: 43.5,
  fx_sh_bloom_briar: 43.5,
  fx_sh_spore_cloud: 43.5,
  fx_sh_anvil_storm: 43.5,
  fx_sh_geyser_plume: 43.5,
  fx_sh_shrapnel_corona: 43.5,
};

export function resolveParticleBlendAndDepth(textureKey: string): {
  blendMode: 'NORMAL' | 'ADD';
  depth: number;
} {
  const additiveDepth = ADDITIVE_FX_DEPTH_BY_KEY[textureKey];
  if (additiveDepth !== undefined) {
    return { blendMode: 'ADD', depth: additiveDepth };
  }
  const opaqueDepth = OPAQUE_FX_DEPTH_BY_KEY[textureKey];
  if (opaqueDepth !== undefined) {
    return { blendMode: 'NORMAL', depth: opaqueDepth };
  }
  return { blendMode: 'NORMAL', depth: 42.5 };
}

export function computeFxParticleScale(
  startScale: number,
  endScale: number,
  progress: number,
  easeCurve: FxEaseCurve = 'linear',
): number {
  const t = clamp(progress, 0, 1);
  const eased =
    easeCurve === 'easeOutCubic'
      ? easeOutCubic(t)
      : easeCurve === 'easeOutBack'
        ? easeOutBack(t)
        : t;
  return startScale + (endScale - startScale) * eased;
}

export function computeShellCasingShadowOffset(
  ageSec: number,
  ttlSec: number,
): { offsetY: number; scale: number; alpha: number } {
  const safeTtl = Math.max(0.05, ttlSec);
  const t = clamp(ageSec / safeTtl, 0, 1);
  const arc = Math.sin(Math.pow(t, 0.82) * Math.PI);
  const baseFloorOffset = 6 * (1 - t * 0.65);
  const offsetY = Math.max(1.8, baseFloorOffset + arc * 11);
  const scale = 0.55 - arc * 0.16;
  const alpha = clamp((0.36 - arc * 0.08) * (1 - t * 0.45), 0.08, 0.42);
  return { offsetY, scale, alpha };
}

export interface ElementalReactionRingSpec {
  textureKey: 'fx_shockwave_ring' | 'fx_impact_ring';
  blendMode: 'ADD';
  easeCurve: 'easeOutCubic';
  depth: number;
  startScale: number;
  endScale: number;
  ttl: number;
  tintHex: string;
}

export interface ElementalReactionBurstSpec {
  reaction: ElementalReactionId;
  primaryColorHex: string;
  secondaryColorHex: string;
  primaryRing: ElementalReactionRingSpec;
  innerRing: ElementalReactionRingSpec;
  particleCount: number;
  particleTextures: readonly ('fx_spark_trail' | 'fx_spark' | 'fx_sparkle_mote')[];
  decalKind: 'scorch' | 'frost' | 'splatter';
}

const REACTION_SECONDARY_COLOR: Readonly<Record<ElementalReactionId, string>> = {
  vaporize: PALETTE.CYAN_FROST,
  shatter: PALETTE.ICE_WHITE,
  superconduct: PALETTE.CYAN_FROST,
  toxic_blast: PALETTE.FLAME_ORANGE,
  paralysis: PALETTE.LIME_GLOW,
  overload: PALETTE.SOLAR_GOLD,
};

const REACTION_NOVA_KEY: Readonly<Record<ElementalReactionId, ShaderNovaKey>> = {
  vaporize: 'fx_sh_vortex_gale',
  shatter: 'fx_sh_nova_cryo',
  superconduct: 'fx_sh_anvil_storm',
  toxic_blast: 'fx_sh_spore_cloud',
  paralysis: 'fx_sh_nova_thunder',
  overload: 'fx_sh_shrapnel_corona',
};

const REACTION_NOVA_TINT: Readonly<Record<ElementalReactionId, number | null>> = {
  vaporize: 0xbae6fd,
  shatter: null,
  superconduct: 0x67e8f9,
  toxic_blast: null,
  paralysis: 0xbef264,
  overload: 0xfde047,
};

export function resolveElementalReactionBurstSpec(
  reaction: ElementalReactionId,
  isTeamCombo: boolean,
): ElementalReactionBurstSpec {
  const meta = ELEMENTAL_REACTIONS[reaction];
  const primaryColorHex = meta?.colorHex ?? PALETTE.SOLAR_GOLD;
  const secondaryColorHex = REACTION_SECONDARY_COLOR[reaction] ?? PALETTE.BONE_WHITE;
  const decalKind: 'scorch' | 'frost' | 'splatter' =
    reaction === 'shatter' || reaction === 'superconduct'
      ? 'frost'
      : reaction === 'toxic_blast'
        ? 'splatter'
        : 'scorch';

  return {
    reaction,
    primaryColorHex,
    secondaryColorHex,
    primaryRing: {
      textureKey: 'fx_shockwave_ring',
      blendMode: 'ADD',
      easeCurve: 'easeOutCubic',
      depth: 56,
      startScale: 0.22,
      endScale: isTeamCombo ? 1.58 : 1.28,
      ttl: isTeamCombo ? 0.34 : 0.28,
      tintHex: primaryColorHex,
    },
    innerRing: {
      textureKey: 'fx_impact_ring',
      blendMode: 'ADD',
      easeCurve: 'easeOutCubic',
      depth: 57,
      startScale: 0.25,
      endScale: isTeamCombo ? 1.22 : 1.02,
      ttl: 0.22,
      tintHex: PALETTE.BONE_WHITE,
    },
    particleCount: isTeamCombo ? 14 : 10,
    particleTextures: ['fx_spark_trail', 'fx_spark', 'fx_sparkle_mote'],
    decalKind,
  };
}

export interface BiomeAmbientParticleSpec {
  kind: 'leaf' | 'firefly' | 'snow' | 'ember';
  textureKey: 'fx_ambient_leaf' | 'fx_ambient_firefly' | 'fx_ambient_snow' | 'fx_ember_mote';
  blendMode: 'NORMAL' | 'ADD';
  depth: number;
  tint: number;
  alpha: number;
  sizePx: number;
  scaleMult: number;
  vx: number;
  vy: number;
  swayAmp: number;
  swayFreq: number;
  parallaxLayer: 0 | 1;
  hasOutline: boolean;
}

export function resolveAmbientBudgetCount(
  biome: 1 | 2 | 3,
  qualityTier: 'high' | 'medium' | 'low',
  isBlizzard = false,
): number {
  if (qualityTier === 'low') return biome === 2 && isBlizzard ? 29 : 0;
  if (qualityTier === 'medium') {
    if (biome === 2) return isBlizzard ? 48 : 36;
    return biome === 3 ? 22 : 18;
  }
  if (biome === 2) return isBlizzard ? 80 : 68;
  return biome === 3 ? 40 : 36;
}

export function resolveBiomeAmbientSpec(
  biome: 1 | 2 | 3,
  index: number,
  _qualityTier: 'high' | 'medium' | 'low' = 'high',
  isBlizzard = false,
): BiomeAmbientParticleSpec {
  const parallaxLayer: 0 | 1 = index % 2 === 0 ? 0 : 1;

  if (biome === 2) {
    const sizePx = parallaxLayer === 1 ? 3.1 + (index % 3) * 0.42 : 2.0 + (index % 3) * 0.35;
    const vy =
      parallaxLayer === 1
        ? isBlizzard
          ? 140 + (index % 4) * 14
          : 38 + (index % 4) * 6
        : isBlizzard
          ? 95 + (index % 4) * 10
          : 22 + (index % 4) * 4;
    const vx =
      parallaxLayer === 1
        ? isBlizzard
          ? -185 - (index % 5) * 16
          : 18 + (index % 5) * 4
        : isBlizzard
          ? -135 - (index % 5) * 12
          : 10 + (index % 4) * 3;
    return {
      kind: 'snow',
      textureKey: 'fx_ambient_snow',
      blendMode: 'NORMAL',
      depth: parallaxLayer === 1 ? 36 : 33,
      tint: hexToNum(PALETTE.ICE_WHITE),
      alpha: parallaxLayer === 1 ? (isBlizzard ? 0.78 : 0.82) : isBlizzard ? 0.52 : 0.56,
      sizePx,
      scaleMult: sizePx / 4.4,
      vx,
      vy,
      swayAmp: parallaxLayer === 1 ? 18 + (index % 3) * 5 : 12 + (index % 3) * 4,
      swayFreq: parallaxLayer === 1 ? 2.4 + (index % 3) * 0.35 : 1.9 + (index % 3) * 0.3,
      parallaxLayer,
      hasOutline: false,
    };
  }

  if (biome === 3) {
    const sizePx = parallaxLayer === 1 ? 3.2 + (index % 3) * 0.35 : 2.2 + (index % 3) * 0.3;
    return {
      kind: 'ember',
      textureKey: 'fx_ember_mote',
      blendMode: 'ADD',
      depth: parallaxLayer === 1 ? 37 : 35,
      tint: hexToNum(index % 2 === 0 ? PALETTE.FLAME_ORANGE : PALETTE.SOLAR_GOLD),
      alpha: parallaxLayer === 1 ? 0.82 : 0.62,
      sizePx,
      scaleMult: sizePx / 3.6,
      vx: 8 + (index % 5) * 3,
      vy: -(24 + (index % 5) * 6 + parallaxLayer * 10),
      swayAmp: 10 + (index % 3) * 4,
      swayFreq: 2.3 + (index % 3) * 0.35,
      parallaxLayer,
      hasOutline: false,
    };
  }

  if (index % 3 === 2) {
    return {
      kind: 'firefly',
      textureKey: 'fx_ambient_firefly',
      blendMode: 'ADD',
      depth: 36,
      tint: hexToNum(index % 2 === 0 ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD),
      alpha: 0.78,
      sizePx: 3.5,
      scaleMult: 0.85 + (index % 3) * 0.15,
      vx: 6 + (index % 4) * 3,
      vy: -5 + (index % 3) * 3,
      swayAmp: 14 + (index % 3) * 4,
      swayFreq: 2.2 + (index % 3) * 0.4,
      parallaxLayer,
      hasOutline: false,
    };
  }

  return {
    kind: 'leaf',
    textureKey: 'fx_ambient_leaf',
    blendMode: 'NORMAL',
    depth: 32,
    tint: 0xffffff,
    alpha: 0.74,
    sizePx: 6,
    scaleMult: 0.75 + (index % 3) * 0.15,
    vx: 16 + (index % 5) * 4,
    vy: 14 + (index % 4) * 3,
    swayAmp: 10 + (index % 3) * 3,
    swayFreq: 1.8 + (index % 3) * 0.3,
    parallaxLayer,
    hasOutline: false,
  };
}

export function computeTorchMotePosition(
  anchorX: number,
  anchorY: number,
  phase: number,
  index: number,
): { x: number; y: number; radiusFromTorch: number; alpha: number } {
  const orbitBand = 14 + (index % 4) * 12;
  const radialWobble = Math.sin(phase * 1.4 + index * 1.1) * 8;
  const radiusFromTorch = clamp(orbitBand + radialWobble, 8, 66);
  const angle = phase * (0.65 + (index % 3) * 0.18) * (index % 2 === 0 ? 1 : -1) + index * 1.57;
  const x = anchorX + Math.cos(angle) * radiusFromTorch;
  const y = anchorY + Math.sin(angle) * radiusFromTorch;
  const pulse = 0.5 + 0.5 * Math.sin(phase * 2.6 + index * 0.9);
  const alpha = clamp(0.24 + pulse * 0.44, 0.18, 0.72);
  return { x, y, radiusFromTorch, alpha };
}

export function applyBiomeToAmbientSlot(
  amb: PooledAmbientParticle,
  index: number,
  biome: 1 | 2 | 3,
  qualityTier: 'high' | 'medium' | 'low',
  isBlizzard: boolean,
  invBake: number,
): void {
  const spec = resolveBiomeAmbientSpec(biome, index, qualityTier, isBlizzard);
  amb.kind = spec.kind;
  amb.parallaxLayer = spec.parallaxLayer;
  amb.vx = spec.vx;
  amb.vy = spec.vy;
  amb.swayAmp = spec.swayAmp;
  amb.swayFreq = spec.swayFreq;
  amb.baseScale = invBake * spec.scaleMult;
  amb.sprite.setTexture(spec.textureKey);
  if (spec.tint === 0xffffff) amb.sprite.clearTint();
  else amb.sprite.setTint(spec.tint);
  amb.sprite.setBlendMode(spec.blendMode);
  amb.sprite.setDepth(spec.depth);
  amb.sprite.setScale(amb.baseScale);
  amb.sprite.setAlpha(spec.alpha);
}

export function activateParticle(
  p: PooledParticle,
  config: {
    textureKey: string;
    x: number;
    y: number;
    vx?: number;
    vy?: number;
    vr?: number;
    ttl: number;
    startScale: number;
    endScale: number;
    startAlpha?: number;
    gravityY?: number;
    damping?: number;
    rotation?: number;
    tint?: number | null;
    blendMode?: 'NORMAL' | 'ADD';
    depth?: number;
    easeCurve?: FxEaseCurve;
    scaleRatioY?: number;
    alignToVelocity?: boolean;
    hasGroundShadow?: boolean;
    baseFrame?: number;
    frameCount?: number;
    frameName?: string;
    kitFramePrefix?: string;
    preserveFlipbookAlpha?: boolean;
  },
): void {
  const defaultMeta = resolveParticleBlendAndDepth(config.textureKey);
  const blendMode = config.blendMode ?? defaultMeta.blendMode;
  const depth = Math.min(59, config.depth ?? defaultMeta.depth);
  const scaleRatioY = config.scaleRatioY ?? 1;
  const vx = config.vx ?? 0;
  const vy = config.vy ?? 0;
  const startAlpha = config.startAlpha ?? 1;
  const frameCount = config.frameCount && config.frameCount > 1 ? config.frameCount : 1;
  const preserveFlipbookAlpha = config.preserveFlipbookAlpha ?? frameCount > 1;

  p.active = true;
  p.textureKey = config.textureKey;
  p.age = 0;
  p.ttl = config.ttl;
  p.x = config.x;
  p.y = config.y;
  p.vx = vx;
  p.vy = vy;
  p.vr = config.vr ?? 0;
  p.startScale = config.startScale;
  p.endScale = config.endScale;
  p.startAlpha = startAlpha;
  p.gravityY = config.gravityY ?? 0;
  p.damping = config.damping ?? 0;
  p.blendMode = blendMode;
  p.easeCurve = config.easeCurve ?? 'linear';
  p.scaleRatioY = scaleRatioY;
  p.flipY = scaleRatioY < 0;
  p.alignToVelocity = config.alignToVelocity ?? false;
  p.hasGroundShadow = config.hasGroundShadow ?? false;
  p.depth = depth;
  p.baseFrame = config.baseFrame;
  p.frameCount = frameCount;
  p.frameName = config.frameName;
  p.kitFramePrefix =
    config.kitFramePrefix ?? (isCutoutKitFrame(config.textureKey) ? config.textureKey : undefined);
  p.preserveFlipbookAlpha = preserveFlipbookAlpha;

  if (config.frameName) {
    p.sprite.setTexture(config.textureKey, config.frameName);
    if (typeof p.sprite.setFrame === 'function') {
      p.sprite.setFrame(config.frameName);
    }
  } else if (frameCount > 1) {
    const startFrame = config.baseFrame ?? 0;
    p.sprite.setTexture(config.textureKey, startFrame);
    if (typeof p.sprite.setFrame === 'function') {
      p.sprite.setFrame(startFrame);
    }
  } else {
    p.sprite.setTexture(config.textureKey);
  }
  if (config.tint !== undefined && config.tint !== null) p.sprite.setTint(config.tint);
  else p.sprite.clearTint();
  p.sprite.setBlendMode(blendMode);
  p.sprite.setPosition(config.x, config.y);
  p.sprite.setRotation(config.alignToVelocity ? Math.atan2(vy, vx) : (config.rotation ?? 0));
  p.sprite.setScale(config.startScale, config.startScale * scaleRatioY);
  p.sprite.setAlpha(startAlpha);
  if (p.sprite.depth !== depth) {
    p.sprite.setDepth(depth);
  }
  p.sprite.setVisible(true);

  if (p.shadowSprite) {
    if (p.hasGroundShadow) {
      const sh = computeShellCasingShadowOffset(0, p.ttl);
      p.shadowSprite.setPosition(p.x, p.y + sh.offsetY);
      p.shadowSprite.setScale(p.startScale * sh.scale, p.startScale * sh.scale * 0.65);
      p.shadowSprite.setAlpha(sh.alpha);
      p.shadowSprite.setVisible(true);
    } else if (p.shadowSprite.visible) {
      p.shadowSprite.setVisible(false);
    }
  }
}

export interface ShaderNovaSpawnOptions {
  ttl?: number;
  alpha?: number;
  isTeammate?: boolean;
  rotation?: number;
  tint?: number | null;
  depth?: number;
  sparkCount?: number;
  sparkHex?: string;
}

export function spawnShaderNovaImpl(
  this: CombatFxManager,
  x: number,
  y: number,
  radiusPx: number,
  novaKey: ShaderNovaKey = 'fx_sh_nova_solar',
  options: ShaderNovaSpawnOptions = {},
): PooledParticle | null {
  const bakeScale = TextureBaker.getBakeScale();
  const invBake = 1 / bakeScale;
  const alphaMult = options.isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;

  const slot = this.acquireParticleSlot();
  if (slot) {
    const scale = computeShaderNovaScale(radiusPx, novaKey, bakeScale);
    const mgrVar = this as CombatFxManager & { novaVarietyCursor?: number };
    const seq = ((mgrVar.novaVarietyCursor ?? 0) + 1) | 0;
    mgrVar.novaVarietyCursor = seq;
    // Golden-angle rotation + alternating ±1 chirality eliminates FBM pattern repetition on cluster novas
    const autoRotation =
      (((seq * 2.399963229728653 + x * 0.0173 + y * 0.0291) % (Math.PI * 2)) + Math.PI * 2) %
      (Math.PI * 2);
    const chirality = options.rotation !== undefined ? 1 : seq % 2 === 0 ? 1 : -1;
    activateParticle(slot, {
      textureKey: novaKey,
      x,
      y,
      ttl: options.ttl ?? 0.34,
      startScale: scale,
      endScale: scale,
      startAlpha: (options.alpha ?? 0.98) * alphaMult,
      rotation: options.rotation ?? autoRotation,
      tint: options.tint ?? null,
      blendMode: 'NORMAL',
      depth: options.depth ?? 43.5,
      scaleRatioY: chirality,
      frameCount: SHADER_FX_FRAME_COUNT,
      preserveFlipbookAlpha: true,
    });
  }

  const rawSparks = options.sparkCount ?? 6;
  if (rawSparks > 0) {
    const count = Math.max(
      2,
      Math.round(rawSparks * graphicsSettings.getBudget().particleBudgetRatio),
    );
    const sparkTint = hexToNum(
      options.sparkHex ??
        (novaKey === 'fx_sh_nova_cryo' || novaKey === 'fx_sh_vortex_gale'
          ? PALETTE.CYAN_FROST
          : novaKey === 'fx_sh_nova_thunder' || novaKey === 'fx_sh_anvil_storm'
            ? PALETTE.VOLT_YELLOW
            : novaKey === 'fx_sh_nova_venom' ||
                novaKey === 'fx_sh_bloom_briar' ||
                novaKey === 'fx_sh_spore_cloud'
              ? PALETTE.LIME_GLOW
              : novaKey === 'fx_sh_nova_void'
                ? PALETTE.TOXIC_PURPLE
                : novaKey === 'fx_sh_geyser_plume' || novaKey === 'fx_sh_nova_magma'
                  ? PALETTE.FLAME_ORANGE
                  : PALETTE.SOLAR_GOLD),
    );
    for (let i = 0; i < count; i++) {
      const p = this.acquireParticleSlot();
      if (!p) break;
      const ang = (i / count) * Math.PI * 2 + (getClientFreezeRandom()() - 0.5) * 0.25;
      const spd = Math.max(90, radiusPx * 2.4) * (0.65 + getClientFreezeRandom()() * 0.45);
      activateParticle(p, {
        textureKey: 'fx_spark_trail',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        ttl: 0.22 + (i % 3) * 0.04,
        startScale: invBake * 1.02,
        endScale: invBake * 0.16,
        startAlpha: 0.92 * alphaMult,
        damping: 7,
        rotation: ang,
        tint: sparkTint,
        depth: 57,
        scaleRatioY: 0.42,
        alignToVelocity: true,
      });
    }
  }

  return slot;
}

export interface ShaderSlashSpawnOptions {
  ttl?: number;
  alpha?: number;
  isTeammate?: boolean;
  flipY?: boolean;
  tint?: number | null;
  depth?: number;
  vx?: number;
  vy?: number;
  damping?: number;
}

export function spawnShaderSlashImpl(
  this: CombatFxManager,
  x: number,
  y: number,
  rangePx: number,
  angleRad: number,
  slashKey: ShaderSlashKey = 'fx_sh_slash_steel',
  options: ShaderSlashSpawnOptions = {},
): PooledParticle | null {
  const bakeScale = TextureBaker.getBakeScale();
  const alphaMult = options.isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;

  const slot = this.acquireParticleSlot();
  if (!slot) return null;
  const scale = computeShaderDirectionalScale(rangePx, slashKey, bakeScale);
  activateParticle(slot, {
    textureKey: slashKey,
    x,
    y,
    vx: options.vx ?? 0,
    vy: options.vy ?? 0,
    damping: options.damping ?? 0,
    ttl: options.ttl ?? 0.2,
    startScale: scale,
    endScale: scale,
    startAlpha: (options.alpha ?? 0.98) * alphaMult,
    rotation: angleRad,
    tint: options.tint ?? null,
    blendMode: 'NORMAL',
    depth: options.depth ?? 42.5,
    scaleRatioY: options.flipY ? -1 : 1,
    frameCount: SHADER_FX_FRAME_COUNT,
    preserveFlipbookAlpha: true,
  });
  return slot;
}

export interface ShaderConeSpawnOptions {
  ttl?: number;
  alpha?: number;
  isTeammate?: boolean;
  tint?: number | null;
  depth?: number;
  scaleRatioY?: number;
}

export function spawnShaderConeImpl(
  this: CombatFxManager,
  x: number,
  y: number,
  reachPx: number,
  angleRad: number,
  options: ShaderConeSpawnOptions = {},
): PooledParticle | null {
  const bakeScale = TextureBaker.getBakeScale();
  const alphaMult = options.isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;

  const slot = this.acquireParticleSlot();
  if (!slot) return null;
  const scale = computeShaderDirectionalScale(reachPx, 'fx_sh_cone_blast', bakeScale);
  const cx = x + Math.cos(angleRad) * reachPx * 0.44;
  const cy = y + Math.sin(angleRad) * reachPx * 0.44;
  activateParticle(slot, {
    textureKey: 'fx_sh_cone_blast',
    x: cx,
    y: cy,
    ttl: options.ttl ?? 0.22,
    startScale: scale,
    endScale: scale,
    startAlpha: (options.alpha ?? 0.98) * alphaMult,
    rotation: angleRad,
    tint: options.tint ?? null,
    blendMode: 'NORMAL',
    depth: options.depth ?? 43.0,
    scaleRatioY: options.scaleRatioY ?? 1,
    frameCount: SHADER_FX_FRAME_COUNT,
    preserveFlipbookAlpha: true,
  });
  return slot;
}

export interface ShaderLanceSpawnOptions {
  ttl?: number;
  alpha?: number;
  widthPx?: number;
  isTeammate?: boolean;
  tint?: number | null;
  depth?: number;
}

export function spawnShaderLanceImpl(
  this: CombatFxManager,
  x: number,
  y: number,
  lengthPx: number,
  angleRad: number,
  options: ShaderLanceSpawnOptions = {},
): PooledParticle | null {
  const bakeScale = TextureBaker.getBakeScale();
  const alphaMult = options.isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;

  const slot = this.acquireParticleSlot();
  if (!slot) return null;
  const scaleX = computeShaderDirectionalScale(lengthPx, 'fx_sh_beam_lance', bakeScale);
  const desiredWidthReach = Math.max(36, (options.widthPx ?? 36) * 2.4);
  const scaleY = computeShaderDirectionalScale(desiredWidthReach, 'fx_sh_beam_lance', bakeScale);
  const ratioY = clamp(scaleY / Math.max(0.01, scaleX), 0.14, 1.15);

  const midX = x + Math.cos(angleRad) * lengthPx * 0.48;
  const midY = y + Math.sin(angleRad) * lengthPx * 0.48;
  activateParticle(slot, {
    textureKey: 'fx_sh_beam_lance',
    x: midX,
    y: midY,
    ttl: options.ttl ?? 0.26,
    startScale: scaleX,
    endScale: scaleX,
    startAlpha: (options.alpha ?? 0.98) * alphaMult,
    rotation: angleRad,
    tint: options.tint ?? null,
    blendMode: 'NORMAL',
    depth: options.depth ?? 43.0,
    scaleRatioY: ratioY,
    frameCount: SHADER_FX_FRAME_COUNT,
    preserveFlipbookAlpha: true,
  });
  return slot;
}

export interface ShaderDirectionalSpawnOptions {
  ttl?: number;
  alpha?: number;
  isTeammate?: boolean;
  flipY?: boolean;
  tint?: number | null;
  depth?: number;
  scaleRatioY?: number;
  forwardOffsetRatio?: number;
}

export function spawnShaderDirectionalImpl(
  this: CombatFxManager,
  x: number,
  y: number,
  reachPx: number,
  angleRad: number,
  key: ShaderDirectionalKey,
  options: ShaderDirectionalSpawnOptions = {},
): PooledParticle | null {
  const bakeScale = TextureBaker.getBakeScale();
  const alphaMult = options.isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;

  const slot = this.acquireParticleSlot();
  if (!slot) return null;
  const scale = computeShaderDirectionalScale(reachPx, key, bakeScale);
  const fwd = (options.forwardOffsetRatio ?? 0) * reachPx;
  const cx = x + Math.cos(angleRad) * fwd;
  const cy = y + Math.sin(angleRad) * fwd;
  const baseRatioY = options.scaleRatioY ?? 1;
  activateParticle(slot, {
    textureKey: key,
    x: cx,
    y: cy,
    ttl: options.ttl ?? 0.24,
    startScale: scale,
    endScale: scale,
    startAlpha: (options.alpha ?? 0.98) * alphaMult,
    rotation: angleRad,
    tint: options.tint ?? null,
    blendMode: 'NORMAL',
    depth: options.depth ?? 43.0,
    scaleRatioY: options.flipY ? -Math.abs(baseRatioY) : baseRatioY,
    frameCount: SHADER_FX_FRAME_COUNT,
    preserveFlipbookAlpha: true,
  });
  return slot;
}

export interface CutoutRouterOptions extends ShaderNovaSpawnOptions {
  arcSpreadRad?: number;
  isAllyOrSelf?: boolean;
  alpha?: number;
  ttlSec?: number;
  suppressPerimeterRing?: boolean;
  isTeammate?: boolean;
}

function resolveEntryTint(entry?: ShaderStripEntry | null, overrideTint?: number | null): number {
  if (overrideTint !== undefined && overrideTint !== null) return overrideTint;
  if (!entry) return 0xffffff;
  if (entry.fallbackPrimaryHex) return hexToNum(entry.fallbackPrimaryHex);
  return 0xffffff;
}

export function routeCutoutBurstByRadius(
  fx: CombatFxManager,
  x: number,
  y: number,
  radiusPx: number,
  novaKey: ShaderNovaKey = 'fx_sh_nova_solar',
  options: CutoutRouterOptions = {},
): PooledParticle | null {
  const entry = getShaderStripEntry(novaKey);
  const [rMin, rMax] = entry ? entry.validRadiusBandPx : [24, 64];
  const tint = resolveEntryTint(entry, options.tint);
  const ttl = options.ttlSec;

  const px = fx.localPlayerPos?.x ?? 0;
  const py = fx.localPlayerPos?.y ?? 0;
  const distToP1 = fx.distanceToLocalPlayer
    ? fx.distanceToLocalPlayer(x, y)
    : Math.hypot(x - px, y - py);
  const isP1SelfBurst = distToP1 <= 24;
  const alpha =
    options.alpha !== undefined
      ? options.alpha
      : options.isTeammate
        ? applyP1SafeHaloAlpha(0.35, true, distToP1, radiusPx)
        : 1.0;

  const coreDepth = options.depth ?? (isP1SelfBurst ? 26.4 : 43.5);

  if (radiusPx < rMin) {
    if (!options.suppressPerimeterRing && fx.activePerimeterRings) {
      const ring = (fx.perimeterRingFreePool ? fx.perimeterRingFreePool.pop() : undefined) ?? {
        active: true,
        x,
        y,
        targetRadiusPx: radiusPx,
        currentRadiusPx: radiusPx * 0.3,
        colorNum: tint,
        alpha,
        age: 0,
        ttl: 0.05,
      };
      ring.active = true;
      ring.x = x;
      ring.y = y;
      ring.targetRadiusPx = radiusPx;
      ring.currentRadiusPx = radiusPx * 0.3;
      ring.colorNum = tint;
      ring.alpha = alpha;
      ring.age = 0;
      ring.ttl = 0.05;
      fx.activePerimeterRings.push(ring);
    }

    let kitKey: string;
    let baseTexelR: number;
    if (radiusPx < 14.6) {
      kitKey = 'fx_micro_burst_4f';
      baseTexelR = 11.04;
    } else if (radiusPx < 21.3) {
      kitKey = 'fx_small_burst_4f';
      baseTexelR = 16.56;
    } else if (radiusPx < 31.2) {
      kitKey = 'fx_mid_burst_4f';
      baseTexelR = 22.08;
    } else {
      kitKey = 'fx_compact_burst_4f';
      baseTexelR = 26.0;
    }
    const scale = radiusPx / baseTexelR;
    const slot = fx.acquireParticleSlot();
    if (slot) {
      activateParticle(slot, {
        textureKey: 'fx_cutout_kit_512',
        frameName: `${kitKey}_0`,
        kitFramePrefix: kitKey,
        x,
        y,
        ttl: ttl ?? 0.12,
        startScale: scale,
        endScale: scale,
        startAlpha: alpha,
        depth: coreDepth,
        blendMode: 'NORMAL',
        tint,
        frameCount: 4,
        preserveFlipbookAlpha: true,
      });
      if (isP1SelfBurst) {
        slot.sprite.setDepth(26.4);
      }
    }
    return slot;
  }

  let effectiveRadius = radiusPx;
  if (radiusPx > rMax) {
    effectiveRadius = rMax;
    if (!options.suppressPerimeterRing && fx.activePerimeterRings) {
      const ring = (fx.perimeterRingFreePool ? fx.perimeterRingFreePool.pop() : undefined) ?? {
        active: true,
        x,
        y,
        targetRadiusPx: radiusPx,
        currentRadiusPx: rMax,
        colorNum: tint,
        alpha,
        age: 0,
        ttl: 0.05,
      };
      ring.active = true;
      ring.x = x;
      ring.y = y;
      ring.targetRadiusPx = radiusPx;
      ring.currentRadiusPx = rMax;
      ring.colorNum = tint;
      ring.alpha = alpha;
      ring.age = 0;
      ring.ttl = 0.05;
      fx.activePerimeterRings.push(ring);
    }
  }

  const slot = fx.spawnShaderNova(x, y, effectiveRadius, novaKey, {
    ...options,
    depth: coreDepth,
    ttl: ttl ?? (radiusPx > rMax ? 0.16 : undefined),
    alpha,
    tint,
  });
  if (slot && isP1SelfBurst) {
    slot.sprite.setDepth(26.4);
  }
  return slot;
}

export function routeCutoutDirectionalByReach(
  fx: CombatFxManager,
  x: number,
  y: number,
  reachPx: number,
  angleRad: number,
  key: ShaderDirectionalKey = 'fx_sh_cone_blast',
  arcSpreadRad = Math.PI / 4,
  options: CutoutRouterOptions = {},
): PooledParticle | null {
  const entry = getShaderStripEntry(key);
  const [rMin, rMax] = entry ? entry.validRadiusBandPx : [48, 70];
  const tint = resolveEntryTint(entry, options.tint);
  const ttl = options.ttlSec;

  const px = fx.localPlayerPos?.x ?? 0;
  const py = fx.localPlayerPos?.y ?? 0;
  const distToP1 = fx.distanceToLocalPlayer
    ? fx.distanceToLocalPlayer(x, y)
    : Math.hypot(x - px, y - py);
  const isP1SelfBurst = distToP1 <= 24;
  const alpha =
    options.alpha !== undefined
      ? options.alpha
      : options.isTeammate
        ? applyP1SafeHaloAlpha(0.35, true, distToP1, reachPx)
        : 1.0;

  const coreDepth = options.depth ?? (isP1SelfBurst ? 26.4 : 43.0);

  if (reachPx < rMin) {
    if (!options.suppressPerimeterRing && fx.activeArcRibbons) {
      const ribbon = (fx.arcRibbonFreePool ? fx.arcRibbonFreePool.pop() : undefined) ?? {
        active: true,
        x,
        y,
        reachPx,
        angleRad,
        arcSpreadRad,
        colorNum: tint,
        alpha,
        age: 0,
        ttl: 0.05,
      };
      ribbon.active = true;
      ribbon.x = x;
      ribbon.y = y;
      ribbon.reachPx = reachPx;
      ribbon.angleRad = angleRad;
      ribbon.arcSpreadRad = arcSpreadRad;
      ribbon.colorNum = tint;
      ribbon.alpha = alpha;
      ribbon.age = 0;
      ribbon.ttl = 0.05;
      fx.activeArcRibbons.push(ribbon);
    }

    const fallbackKey: ShaderDirectionalKey =
      reachPx < 24.5 ? 'fx_sh_hit_spark' : 'fx_sh_aegis_crest';
    const fbEntry = getShaderStripEntry(fallbackKey);
    const [fbMin, fbMax] = fbEntry ? fbEntry.validRadiusBandPx : [24, 48];
    const clampedReach = clamp(reachPx, fbMin, fbMax);
    const slot = fx.spawnShaderDirectional(x, y, clampedReach, angleRad, fallbackKey, {
      ...options,
      depth: coreDepth,
      ttl: ttl ?? 0.12,
      alpha,
      tint,
    });
    if (slot && isP1SelfBurst) {
      slot.sprite.setDepth(26.4);
    }
    return slot;
  }

  let effectiveReach = reachPx;
  if (reachPx > rMax) {
    effectiveReach = rMax;
    if (!options.suppressPerimeterRing && fx.activeArcRibbons) {
      const ribbon = (fx.arcRibbonFreePool ? fx.arcRibbonFreePool.pop() : undefined) ?? {
        active: true,
        x,
        y,
        reachPx,
        angleRad,
        arcSpreadRad,
        colorNum: tint,
        alpha,
        age: 0,
        ttl: 0.22,
      };
      ribbon.active = true;
      ribbon.x = x;
      ribbon.y = y;
      ribbon.reachPx = reachPx;
      ribbon.angleRad = angleRad;
      ribbon.arcSpreadRad = arcSpreadRad;
      ribbon.colorNum = tint;
      ribbon.alpha = alpha;
      ribbon.age = 0;
      ribbon.ttl = 0.22;
      fx.activeArcRibbons.push(ribbon);
    }
  }

  const slot = fx.spawnShaderDirectional(x, y, effectiveReach, angleRad, key, {
    ...options,
    depth: coreDepth,
    ttl: ttl ?? (reachPx > rMax ? 0.15 : undefined),
    alpha,
    tint,
  });
  if (slot && isP1SelfBurst) {
    slot.sprite.setDepth(26.4);
  }
  return slot;
}

export interface WeaponMuzzleProfile {
  muzzleKey: 'fx_sh_muzzle_burst' | 'fx_sh_muzzle_arcane';
  ejectCasing: boolean;
  muzzleTint: number | null;
  moteTexture: 'fx_spark_trail' | 'fx_sparkle_mote' | 'fx_ambient_leaf' | 'fx_ember_mote' | 'fx_spark';
  moteHex: string;
  reachPx: number;
  ttlSec: number;
}

export function resolveWeaponMuzzleProfile(
  weaponId?: string,
  isShotgun = false,
): WeaponMuzzleProfile {
  switch (weaponId) {
    case 'solar_archon_staff':
      return {
        muzzleKey: 'fx_sh_muzzle_arcane',
        ejectCasing: false,
        muzzleTint: 0xfef08a,
        moteTexture: 'fx_sparkle_mote',
        moteHex: PALETTE.SOLAR_GOLD,
        reachPx: 26,
        ttlSec: 0.12,
      };
    case 'apprentice_staff':
      return {
        muzzleKey: 'fx_sh_muzzle_arcane',
        ejectCasing: false,
        muzzleTint: 0xfdba74,
        moteTexture: 'fx_sparkle_mote',
        moteHex: PALETTE.SOLAR_GOLD,
        reachPx: 24,
        ttlSec: 0.11,
      };
    case 'thorn_staff':
      return {
        muzzleKey: 'fx_sh_muzzle_arcane',
        ejectCasing: false,
        muzzleTint: 0x86efac,
        moteTexture: 'fx_ambient_leaf',
        moteHex: PALETTE.LIME_GLOW,
        reachPx: 25,
        ttlSec: 0.12,
      };
    case 'seed_gun':
      return {
        muzzleKey: 'fx_sh_muzzle_arcane',
        ejectCasing: false,
        muzzleTint: 0xa7f3d0,
        moteTexture: 'fx_ambient_leaf',
        moteHex: PALETTE.MINT_LIGHT,
        reachPx: 22,
        ttlSec: 0.1,
      };
    case 'tether_staff':
      return {
        muzzleKey: 'fx_sh_muzzle_arcane',
        ejectCasing: false,
        muzzleTint: 0xd8b4fe,
        moteTexture: 'fx_spark_trail',
        moteHex: PALETTE.TOXIC_PURPLE,
        reachPx: 24,
        ttlSec: 0.11,
      };
    case 'void_staff':
      return {
        muzzleKey: 'fx_sh_muzzle_arcane',
        ejectCasing: false,
        muzzleTint: 0xc084fc,
        moteTexture: 'fx_sparkle_mote',
        moteHex: PALETTE.TOXIC_PURPLE,
        reachPx: 26,
        ttlSec: 0.12,
      };
    case 'hunter_crossbow':
      return {
        muzzleKey: 'fx_sh_muzzle_arcane',
        ejectCasing: false,
        muzzleTint: 0xbae6fd,
        moteTexture: 'fx_spark_trail',
        moteHex: PALETTE.CYAN_FROST,
        reachPx: 24,
        ttlSec: 0.11,
      };
    case 'gale_smg':
    case 'gale_smg_wind_blade':
      return {
        muzzleKey: 'fx_sh_muzzle_arcane',
        ejectCasing: false,
        muzzleTint: 0x5eead4,
        moteTexture: 'fx_spark_trail',
        moteHex: PALETTE.CYAN_FROST,
        reachPx: 20,
        ttlSec: 0.085,
      };
    case 'tesla_carbine':
      return {
        muzzleKey: 'fx_sh_muzzle_arcane',
        ejectCasing: false,
        muzzleTint: 0xfef08a,
        moteTexture: 'fx_spark',
        moteHex: PALETTE.VOLT_YELLOW,
        reachPx: 22,
        ttlSec: 0.095,
      };
    case 'focus_laser':
      return {
        muzzleKey: 'fx_sh_muzzle_arcane',
        ejectCasing: false,
        muzzleTint: 0x7dd3fc,
        moteTexture: 'fx_sparkle_mote',
        moteHex: PALETTE.CYAN_FROST,
        reachPx: 23,
        ttlSec: 0.1,
      };
    case 'magma_cannon':
      return {
        muzzleKey: 'fx_sh_muzzle_burst',
        ejectCasing: false,
        muzzleTint: 0xff8a4c,
        moteTexture: 'fx_ember_mote',
        moteHex: PALETTE.FLAME_ORANGE,
        reachPx: 32,
        ttlSec: 0.13,
      };
    case 'knight_sword_wave':
    case 'knight_sword_parry':
      return {
        muzzleKey: 'fx_sh_muzzle_arcane',
        ejectCasing: false,
        muzzleTint: 0xfef08a,
        moteTexture: 'fx_spark_trail',
        moteHex: PALETTE.SOLAR_GOLD,
        reachPx: 20,
        ttlSec: 0.09,
      };
    case 'frag_launcher_sub':
      return {
        muzzleKey: 'fx_sh_muzzle_burst',
        ejectCasing: false,
        muzzleTint: 0xfb923c,
        moteTexture: 'fx_spark_trail',
        moteHex: PALETTE.FLAME_ORANGE,
        reachPx: 18,
        ttlSec: 0.08,
      };
    case 'frag_launcher':
    case 'scrap_shotgun':
      return {
        muzzleKey: 'fx_sh_muzzle_burst',
        ejectCasing: true,
        muzzleTint: null,
        moteTexture: 'fx_spark_trail',
        moteHex: PALETTE.FLAME_ORANGE,
        reachPx: 30,
        ttlSec: 0.12,
      };
    default:
      return {
        muzzleKey: 'fx_sh_muzzle_burst',
        ejectCasing: true,
        muzzleTint: null,
        moteTexture: 'fx_spark_trail',
        moteHex: isShotgun ? PALETTE.FLAME_ORANGE : PALETTE.SOLAR_GOLD,
        reachPx: isShotgun ? 30 : 21,
        ttlSec: isShotgun ? 0.12 : 0.095,
      };
  }
}

export function spawnMuzzleFlashAndCasingImpl(
  this: CombatFxManager,
  x: number,
  y: number,
  angleRad: number,
  isShotgun = false,
  isTeammate = false,
  weaponId?: string,
): void {
  const bakeScale = TextureBaker.getBakeScale();
  const invBake = 1 / bakeScale;
  const alphaMult = isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;
  const profile = resolveWeaponMuzzleProfile(weaponId, isShotgun);
  const muzzleX = x + Math.cos(angleRad) * 8;
  const muzzleY = y + Math.sin(angleRad) * 8;

  const burst = this.acquireParticleSlot();
  if (burst) {
    const shScale = computeShaderDirectionalScale(
      profile.reachPx * 0.72,
      profile.muzzleKey,
      bakeScale,
    );
    const variantIndex = (this.muzzleVariantCounter++ & 1);
    const baseFrame = variantIndex * 4;
    const muzzleFlip = (this.muzzleFlipCounter++ % 2 === 0) ? 1 : -1;
    activateParticle(burst, {
      textureKey: profile.muzzleKey,
      x: muzzleX,
      y: muzzleY,
      ttl: 0.067,
      startScale: shScale,
      endScale: shScale,
      startAlpha: 0.88 * alphaMult,
      rotation: angleRad,
      tint: profile.muzzleTint,
      blendMode: 'NORMAL',
      depth: 42.0,
      scaleRatioY: muzzleFlip,
      baseFrame,
      frameCount: 4,
      preserveFlipbookAlpha: true,
    });
  }

  const moteTint = hexToNum(profile.moteHex);
  const isStreak = profile.moteTexture === 'fx_spark_trail';
  const moteCount = isShotgun ? 2 : 1;
  for (let i = 0; i < moteCount; i++) {
    const streak = this.acquireParticleSlot();
    if (!streak) break;
    const dir = angleRad + (i === 0 ? -1 : 1) * (0.18 + getClientFreezeRandom()() * 0.22);
    const spd = (isStreak ? 115 : 82) + getClientFreezeRandom()() * 58;
    activateParticle(streak, {
      textureKey: profile.moteTexture,
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(dir) * spd,
      vy: Math.sin(dir) * spd,
      vr: isStreak ? 0 : (i === 0 ? -7 : 7),
      ttl: isStreak ? 0.085 : 0.15,
      startScale: invBake * (isStreak ? 0.68 : 0.82),
      endScale: invBake * 0.16,
      startAlpha: 0.88 * alphaMult,
      damping: isStreak ? 9 : 5.5,
      rotation: dir,
      tint: moteTint,
      depth: 51,
      scaleRatioY: isStreak ? 0.42 : 1,
      alignToVelocity: isStreak,
    });
  }

  if (weaponId === 'thorn_staff') {
    const barb = this.acquireParticleSlot();
    if (barb) {
      activateParticle(barb, {
        textureKey: CUTOUT_KIT_ATLAS_KEY,
        frameName: 'fx_muzzle_thorn_barb',
        startScale: 1 / 3,
        endScale: 1 / 3,
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(angleRad) * 45,
        vy: Math.sin(angleRad) * 45,
        rotation: angleRad,
        ttl: 0.1,
        startAlpha: 0.92 * alphaMult,
        depth: 42.0,
        blendMode: 'NORMAL',
        tint: 0x86efac,
      });
    }
  }

  if (profile.ejectCasing) {
    const casing = this.acquireParticleSlot();
    if (casing) {
      const ejectAngle = angleRad - Math.PI * 0.65 + (getClientFreezeRandom()() - 0.5) * 0.4;
      const spd = 75 + getClientFreezeRandom()() * 45;
      activateParticle(casing, {
        textureKey: 'fx_shell_casing',
        x,
        y,
        vx: Math.cos(ejectAngle) * spd,
        vy: Math.sin(ejectAngle) * spd - 25,
        vr: (getClientFreezeRandom()() - 0.5) * 18,
        ttl: 0.42,
        startScale: invBake,
        endScale: invBake * 0.85,
        startAlpha: 0.95 * alphaMult,
        gravityY: 180,
        damping: 3,
        rotation: getClientFreezeRandom()() * Math.PI,
        depth: 22,
        hasGroundShadow: true,
      });
    }
  }
}

export function spawnHitSparksImpl(
  this: CombatFxManager,
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
  const now =
    options.nowMs ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());

  let spawnX = x;
  let spawnY = y;
  if (
    options.targetX !== undefined &&
    options.targetY !== undefined &&
    options.targetRadius !== undefined
  ) {
    const dx = x - options.targetX;
    const dy = y - options.targetY;
    const angleFromTarget = Math.atan2(dy, dx);
    spawnX = options.targetX + Math.cos(angleFromTarget) * (0.85 * options.targetRadius);
    spawnY = options.targetY + Math.sin(angleFromTarget) * (0.85 * options.targetRadius);
  }

  const targetIdNum =
    typeof options.targetId === 'number'
      ? options.targetId
      : options.targetId !== undefined
        ? Number(options.targetId)
        : undefined;

  let isWithinIcd = false;
  if (targetIdNum !== undefined && !Number.isNaN(targetIdNum)) {
    const lastTime = this.lastHitSparkTimeByTargetId.get(targetIdNum);
    if (lastTime !== undefined && now - lastTime < 75) {
      isWithinIcd = true;
    } else {
      this.lastHitSparkTimeByTargetId.set(targetIdNum, now);
    }
  }

  if (isWithinIcd || options.isTeammate === true) {
    const glint = this.acquireParticleSlot();
    if (glint) {
      activateParticle(glint, {
        textureKey: 'fx_cutout_kit_512',
        frameName: 'fx_rim_glint',
        x: spawnX,
        y: spawnY,
        ttl: 0.034,
        startScale: 1 / 3,
        endScale: 1 / 3,
        startAlpha: options.isTeammate ? 0.35 : 0.9,
        depth: 43.0,
        blendMode: 'NORMAL',
        preserveFlipbookAlpha: true,
      });
    }
    return;
  }

  const bakeScale = TextureBaker.getBakeScale();
  const invBake = 1 / bakeScale;
  const budgetRatio = graphicsSettings.getBudget().particleBudgetRatio;
  const alphaMult = options.isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;
  const rawCount = options.count ?? (options.isCrit ? 5 : 3);
  const count = Math.max(1, Math.round(rawCount * budgetRatio));
  this.totalSparksSpawned += count;

  let tint = hexToNum(PALETTE.CYAN_FROST);
  let shaderTint: number | null = null;
  if (options.element === 'burn') {
    tint = hexToNum(PALETTE.FLAME_ORANGE);
    shaderTint = 0xffb380;
  } else if (options.element === 'chill') {
    tint = hexToNum(PALETTE.CYAN_FROST);
    shaderTint = 0x99ebff;
  } else if (options.element === 'shock') {
    tint = hexToNum(PALETTE.VOLT_YELLOW);
    shaderTint = 0xbfe6ff;
  } else if (options.element === 'poison') {
    tint = hexToNum(PALETTE.LIME_GLOW);
    shaderTint = 0xa3f79e;
  } else if (options.isCrit) {
    tint = hexToNum(PALETTE.SOLAR_GOLD);
  } else if (options.blockedByShield) {
    tint = hexToNum(PALETTE.CRIMSON_BRIGHT);
    shaderTint = 0xff99a8;
  } else if (options.hitWall) {
    tint = hexToNum(PALETTE.WARM_STONE);
  }

  const spallAngle = impactAngleRad + Math.PI;
  const shImpact = this.acquireParticleSlot();
  if (shImpact) {
    const shScale = computeShaderDirectionalScale(
      options.isCrit ? 20 : 14,
      'fx_sh_hit_spark',
      bakeScale,
    );
    const sparkFlip = this.totalSparksSpawned % 2 === 0 ? 1 : -1;
    const sparkJitter = (((this.totalSparksSpawned * 0.754877) % 1) - 0.5) * 0.22;
    activateParticle(shImpact, {
      textureKey: 'fx_sh_hit_spark',
      x: spawnX,
      y: spawnY,
      ttl: options.isCrit ? 0.13 : 0.1,
      startScale: shScale,
      endScale: shScale,
      startAlpha: 0.86 * alphaMult,
      rotation: spallAngle + sparkJitter,
      tint: shaderTint,
      blendMode: 'NORMAL',
      depth: 42.5,
      scaleRatioY: sparkFlip,
      frameCount: SHADER_FX_FRAME_COUNT,
      preserveFlipbookAlpha: true,
    });
  }

  for (let i = 0; i < count; i++) {
    const p = this.acquireParticleSlot();
    if (!p) break;
    const dir = spallAngle + (getClientFreezeRandom()() - 0.5) * 1.9;
    const spd = 95 + getClientFreezeRandom()() * 145;
    const isTrail = i % 2 === 0;
    activateParticle(p, {
      textureKey: isTrail ? 'fx_spark_trail' : 'fx_spark',
      x: spawnX,
      y: spawnY,
      vx: Math.cos(dir) * spd,
      vy: Math.sin(dir) * spd,
      vr: isTrail ? 0 : (getClientFreezeRandom()() - 0.5) * 12,
      ttl: 0.14 + getClientFreezeRandom()() * 0.08,
      startScale: invBake * (options.isCrit ? 0.96 : 0.78),
      endScale: invBake * 0.16,
      startAlpha: alphaMult,
      damping: 8.5,
      rotation: dir,
      tint: i === 0 && options.isCrit ? hexToNum(PALETTE.BONE_WHITE) : tint,
      depth: 42.5,
      scaleRatioY: isTrail ? 0.42 : 1,
      alignToVelocity: isTrail,
    });
  }
}

export function resolveReactionMiniStripKey(
  reaction: ElementalReactionId | 'corrosive_blast',
): ElementalReactionStripKey {
  switch (reaction) {
    case 'overload':
      return 'fx_react_overload_star';
    case 'shatter':
      return 'fx_react_shatter_pane';
    case 'vaporize':
      return 'fx_react_vapor_puff';
    case 'superconduct':
      return 'fx_react_superconduct_cross';
    case 'corrosive_blast':
    case 'toxic_blast':
      return 'fx_react_toxic_glob';
    case 'paralysis':
      return 'fx_react_paralysis_x';
  }
}

export function spawnElementalReactionFxImpl(
  this: CombatFxManager,
  params: {
    reaction: ElementalReactionId;
    x: number;
    y: number;
    damage?: number;
    radius?: number;
    isTeamCombo?: boolean;
    isTeammate?: boolean;
  },
): void;
export function spawnElementalReactionFxImpl(
  this: CombatFxManager,
  reaction: ElementalReactionId,
  x: number,
  y: number,
  radiusOrDamage?: number,
  isTeamCombo?: boolean,
  isTeammate?: boolean,
): void;
export function spawnElementalReactionFxImpl(
  this: CombatFxManager,
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
  const reaction = typeof arg1 === 'string' ? arg1 : arg1.reaction;
  const x = typeof arg1 === 'string' ? (arg2 ?? 0) : arg1.x;
  const y = typeof arg1 === 'string' ? (arg3 ?? 0) : arg1.y;
  const damage = typeof arg1 === 'string' ? (arg4 ?? 0) : (arg1.damage ?? 0);
  const radius = typeof arg1 === 'string' ? arg4 : (arg1.radius ?? arg1.damage);
  const isTeamCombo = typeof arg1 === 'string' ? Boolean(arg5) : Boolean(arg1.isTeamCombo);
  const isTeammate = typeof arg1 === 'string' ? Boolean(arg6) : Boolean(arg1.isTeammate);

  const spec = resolveElementalReactionBurstSpec(reaction, isTeamCombo);
  this.spawnFloorDecal(spec.decalKind, x, y, isTeamCombo ? 0.85 : 0.68);

  // 1. Spawns mapped fx_react_* 4f mini-strip (frameCount = 4, ttl = 0.20s, depth 42.5, BlendMode.NORMAL, 1/4 bake scale)
  const stripKey = resolveReactionMiniStripKey(reaction);
  const stripSlot = this.acquireParticleSlot();
  const aoeAlpha = isTeammate ? 0.35 : 1.0;
  const distToP1 = this.distanceToLocalPlayer ? this.distanceToLocalPlayer(x, y) : 999;
  let alpha = (isTeamCombo ? 1.0 : 0.9) * aoeAlpha;
  if (isTeammate) {
    alpha = applyP1SafeHaloAlpha(alpha, true, distToP1, radius ?? 32);
  }

  if (stripSlot) {
    activateParticle(stripSlot, {
      textureKey: stripKey,
      x,
      y,
      ttl: 0.2,
      startScale: 0.25,
      endScale: 0.25,
      startAlpha: alpha,
      depth: 42.5,
      blendMode: 'NORMAL',
      frameCount: 4,
      preserveFlipbookAlpha: true,
    });
  }

  // 2. Pairs with routeCutoutBurstByRadius perimeter crescent when AoE reaction radius applies
  if (radius && radius > 0) {
    const novaKey = REACTION_NOVA_KEY[reaction] ?? 'fx_sh_nova_solar';
    const novaTint = REACTION_NOVA_TINT[reaction] ?? null;
    routeCutoutBurstByRadius(this, x, y, radius, novaKey, {
      isTeammate,
      depth: 42.5,
      tint: novaTint,
    });
  }

  // 3. Spawns zero world-space damage/reaction text popups (activeReactionBanner feeds into HUD banner)
  this.activeWorldReactionPopupSlot = null;

  // 4. Feeds coalesceElementalReaction (0.40s window) into this.activeReactionBanner
  this.activeReactionBanner = coalesceElementalReaction(
    this.activeReactionBanner,
    reaction,
    damage,
    isTeamCombo,
    0.4,
  );

  // 5. Stamps a 0.45s double 2.12:1 foot-ellipse at depth 15.0 (NORMAL blend) under P1 when isTeamCombo === true
  if (isTeamCombo) {
    const p1x = this.localPlayerPos?.x ?? x;
    const p1y = (this.localPlayerPos?.y ?? y) + 12;
    this.stampTeamComboFootRing?.(p1x, p1y);
  }
}

export function spawnExplosionBurstImpl(
  this: CombatFxManager,
  x: number,
  y: number,
  radius: number,
  colorHex: string = PALETTE.FLAME_ORANGE,
): void {
  const novaKey = resolveColorHexToNovaKey(colorHex);
  const decalKind: 'scorch' | 'frost' | 'splatter' =
    novaKey === 'fx_sh_nova_cryo'
      ? 'frost'
      : novaKey === 'fx_sh_nova_venom'
        ? 'splatter'
        : 'scorch';
  this.spawnFloorDecal(decalKind, x, y, clamp(radius / 96, 0.55, 0.95));

  // True 1:1 hitbox-matched Chiaroscuro Hollow-Core Detonation + radial spark needles (zero muddy dust blobs!)
  spawnShaderNovaImpl.call(this, x, y, radius, novaKey, {
    ttl: clamp(0.28 + radius * 0.0008, 0.28, 0.4),
    depth: 56,
    sparkCount: 5,
    sparkHex: colorHex,
  });
}

export function spawnFloatingAlertImpl(
  this: CombatFxManager,
  x: number,
  y: number,
  label: string,
  colorHex: string = PALETTE.CYAN_FROST,
): void {
  let targetX = x;
  let targetY = y - 36;

  // 1. Deduplicate identical floating alerts spawned recently (< 0.25s) within 72px
  for (let i = 0; i < this.damagePool.length; i++) {
    const other = this.damagePool[i]!;
    if (!other.active || other.age >= other.ttl) continue;
    if (other.text.text === label && other.age < 0.25) {
      const origDist = Math.hypot((other.originX ?? other.x) - x, (other.originY ?? y) - y);
      const currDist = Math.hypot(other.x - targetX, other.y - targetY);
      if (origDist < 72 || currDist < 72) {
        return;
      }
    }
  }

  // 2. Enforce vertical separation (>= 26px) & horizontal clearance against active alerts & damage popups
  for (let pass = 0; pass < 4; pass++) {
    let shifted = false;
    for (let i = 0; i < this.damagePool.length; i++) {
      const other = this.damagePool[i]!;
      if (!other.active || other.age >= other.ttl) continue;
      const dx = targetX - other.x;
      const dy = targetY - other.y;
      if (Math.abs(dx) < 108 && Math.abs(dy) < 26) {
        targetY = other.y - 26;
        if (Math.abs(dx) >= 20 && targetX === x) {
          targetX += dx >= 0 ? 16 : -16;
        }
        shifted = true;
      }
    }
    if (!shifted) break;
  }

  const slot = this.acquireDamageSlot();
  if (!slot) return;
  this.totalDamagePopupsSpawned += 1;
  slot.active = true;
  slot.age = 0;
  slot.ttl = 0.65;
  slot.originX = x;
  slot.originY = y;
  slot.x = targetX;
  slot.y = targetY;
  slot.vx = 0;
  slot.vy = -56;
  slot.baseScale = 1.18;

  slot.text.setText(label);
  slot.text.setColor(colorHex);
  slot.text.setPosition(slot.x, slot.y);
  slot.text.setScale(slot.baseScale * 1.2);
  slot.text.setAlpha(1);
  slot.text.setVisible(true);
  slot.text.setActive(true);
  resolveActivePopupOverlaps(this.damagePool);
}
