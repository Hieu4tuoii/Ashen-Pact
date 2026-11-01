import {
  clamp,
  ELEMENTAL_REACTIONS,
  type ElementalReactionId,
  type ElementType,
  i18n,
} from '@ashen-pact/shared';
import { easeOutBack, easeOutCubic } from '../art/easing.js';
import { hexToNum, PALETTE } from '../art/palette.js';
import { TextureBaker } from '../art/texture-baker.js';
import {
  computeShaderDirectionalScale,
  computeShaderNovaScale,
  resolveColorHexToNovaKey,
  SHADER_FX_FRAME_COUNT,
  type ShaderDirectionalKey,
  type ShaderNovaKey,
  type ShaderSlashKey,
} from '../art/texture-baker-shader-fx.js';
import { getClientFreezeRandom } from '../core/visual-query.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import type { CombatFxManager } from './combat-fx.js';
import {
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

export interface ProjectileRenderSpec {
  textureKey: string;
  texture: string;
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
      },
): ProjectileRenderSpec {
  const params =
    typeof paramsOrWeaponId === 'string'
      ? { team: 'player' as const, weaponId: paramsOrWeaponId }
      : paramsOrWeaponId;

  if (params.team === 'enemy') {
    const textureKey = params.isStress ? 'proj_stress_enemy' : 'proj_enemy_orb';
    return {
      textureKey,
      texture: textureKey,
      tint: 0xffffff,
      blendMode: 'NORMAL',
      depth: 60,
      alpha: 1.0,
      scale: 1.0,
    };
  }

  let textureKey = 'proj_player_bolt';
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
    textureKey = 'proj_knight_sword_wave';
    tint = 0x2dd4bf;
    scale = 1.28;
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

  const alpha = params.isTeammate ? clamp(params.teammateFxOpacity ?? 0.6, 0.25, 1.0) : 1.0;
  return { textureKey, texture: textureKey, tint, blendMode: 'ADD', depth: 42, alpha, scale };
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
  // 24 Chiaroscuro unpremultiplied RGBA shader flipbooks (NORMAL blend preserves dark veins + HDR edges, depth < 60!)
  fx_sh_muzzle_burst: 50,
  fx_sh_muzzle_arcane: 50,
  fx_sh_slash_steel: 52,
  fx_sh_slash_emerald: 52,
  fx_sh_slash_crimson: 53,
  fx_sh_slash_thunder: 53,
  fx_sh_cone_blast: 54,
  fx_sh_aegis_crest: 54,
  fx_sh_falcon_sonic: 54,
  fx_sh_beam_lance: 55,
  fx_sh_hit_spark: 55,
  fx_sh_arcane_sigil: 55,
  fx_sh_nova_solar: 56,
  fx_sh_nova_magma: 56,
  fx_sh_nova_thunder: 56,
  fx_sh_nova_cryo: 56,
  fx_sh_nova_venom: 56,
  fx_sh_nova_void: 56,
  fx_sh_vortex_gale: 56,
  fx_sh_bloom_briar: 56,
  fx_sh_spore_cloud: 56,
  fx_sh_anvil_storm: 56,
  fx_sh_geyser_plume: 56,
  fx_sh_shrapnel_corona: 56,
};

export function resolveParticleBlendAndDepth(textureKey: string): {
  blendMode: 'NORMAL' | 'ADD';
  depth: number;
} {
  const additiveDepth = ADDITIVE_FX_DEPTH_BY_KEY[textureKey];
  if (additiveDepth !== undefined) {
    return { blendMode: 'ADD', depth: additiveDepth };
  }
  return { blendMode: 'NORMAL', depth: OPAQUE_FX_DEPTH_BY_KEY[textureKey] ?? 35 };
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
    frameCount?: number;
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
  p.alignToVelocity = config.alignToVelocity ?? false;
  p.hasGroundShadow = config.hasGroundShadow ?? false;
  p.frameCount = frameCount;
  p.preserveFlipbookAlpha = preserveFlipbookAlpha;

  if (frameCount > 1) {
    p.sprite.setTexture(config.textureKey, 0);
    if (typeof p.sprite.setFrame === 'function') {
      p.sprite.setFrame(0);
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
): void {
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
      startAlpha: 0.98 * alphaMult,
      rotation: options.rotation ?? autoRotation,
      tint: options.tint ?? null,
      blendMode: 'NORMAL',
      depth: options.depth ?? 56,
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
}

export interface ShaderSlashSpawnOptions {
  ttl?: number;
  isTeammate?: boolean;
  flipY?: boolean;
  tint?: number | null;
  depth?: number;
}

export function spawnShaderSlashImpl(
  this: CombatFxManager,
  x: number,
  y: number,
  rangePx: number,
  angleRad: number,
  slashKey: ShaderSlashKey = 'fx_sh_slash_steel',
  options: ShaderSlashSpawnOptions = {},
): void {
  const bakeScale = TextureBaker.getBakeScale();
  const alphaMult = options.isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;

  const slot = this.acquireParticleSlot();
  if (!slot) return;
  const scale = computeShaderDirectionalScale(rangePx, slashKey, bakeScale);
  activateParticle(slot, {
    textureKey: slashKey,
    x,
    y,
    ttl: options.ttl ?? 0.2,
    startScale: scale,
    endScale: scale,
    startAlpha: 0.98 * alphaMult,
    rotation: angleRad,
    tint: options.tint ?? null,
    blendMode: 'NORMAL',
    depth: options.depth ?? 52,
    scaleRatioY: options.flipY ? -1 : 1,
    frameCount: SHADER_FX_FRAME_COUNT,
    preserveFlipbookAlpha: true,
  });
}

export interface ShaderConeSpawnOptions {
  ttl?: number;
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
): void {
  const bakeScale = TextureBaker.getBakeScale();
  const alphaMult = options.isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;

  const slot = this.acquireParticleSlot();
  if (!slot) return;
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
    startAlpha: 0.98 * alphaMult,
    rotation: angleRad,
    tint: options.tint ?? null,
    blendMode: 'NORMAL',
    depth: options.depth ?? 54,
    scaleRatioY: options.scaleRatioY ?? 1,
    frameCount: SHADER_FX_FRAME_COUNT,
    preserveFlipbookAlpha: true,
  });
}

export interface ShaderLanceSpawnOptions {
  ttl?: number;
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
): void {
  const bakeScale = TextureBaker.getBakeScale();
  const alphaMult = options.isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;

  const slot = this.acquireParticleSlot();
  if (!slot) return;
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
    startAlpha: 0.98 * alphaMult,
    rotation: angleRad,
    tint: options.tint ?? null,
    blendMode: 'NORMAL',
    depth: options.depth ?? 55,
    scaleRatioY: ratioY,
    frameCount: SHADER_FX_FRAME_COUNT,
    preserveFlipbookAlpha: true,
  });
}

export interface ShaderDirectionalSpawnOptions {
  ttl?: number;
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
): void {
  const bakeScale = TextureBaker.getBakeScale();
  const alphaMult = options.isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;

  const slot = this.acquireParticleSlot();
  if (!slot) return;
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
    startAlpha: 0.98 * alphaMult,
    rotation: angleRad,
    tint: options.tint ?? null,
    blendMode: 'NORMAL',
    depth: options.depth ?? 54,
    scaleRatioY: options.flipY ? -Math.abs(baseRatioY) : baseRatioY,
    frameCount: SHADER_FX_FRAME_COUNT,
    preserveFlipbookAlpha: true,
  });
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
    const shScale = computeShaderDirectionalScale(profile.reachPx, profile.muzzleKey, bakeScale);
    const muzzleFlip = this.totalSparksSpawned % 2 === 0 ? 1 : -1;
    const muzzleJitter = (((this.totalSparksSpawned * 0.618034) % 1) - 0.5) * 0.14;
    activateParticle(burst, {
      textureKey: profile.muzzleKey,
      x: muzzleX,
      y: muzzleY,
      ttl: profile.ttlSec,
      startScale: shScale,
      endScale: shScale,
      startAlpha: 0.98 * alphaMult,
      rotation: angleRad + muzzleJitter,
      tint: profile.muzzleTint,
      blendMode: 'NORMAL',
      depth: 50,
      scaleRatioY: muzzleFlip,
      frameCount: SHADER_FX_FRAME_COUNT,
      preserveFlipbookAlpha: true,
    });
  }

  const moteTint = hexToNum(profile.moteHex);
  const isStreak = profile.moteTexture === 'fx_spark_trail';
  for (let i = 0; i < 2; i++) {
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
  } = {},
): void {
  const bakeScale = TextureBaker.getBakeScale();
  const invBake = 1 / bakeScale;
  const budgetRatio = graphicsSettings.getBudget().particleBudgetRatio;
  const alphaMult = options.isTeammate
    ? clamp(graphicsSettings.getState().teammateFxOpacity, 0.25, 1.0)
    : 1.0;
  const rawCount = options.count ?? (options.isCrit ? 8 : 5);
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
      options.isCrit ? 30 : 21,
      'fx_sh_hit_spark',
      bakeScale,
    );
    const sparkFlip = this.totalSparksSpawned % 2 === 0 ? 1 : -1;
    const sparkJitter = (((this.totalSparksSpawned * 0.754877) % 1) - 0.5) * 0.22;
    activateParticle(shImpact, {
      textureKey: 'fx_sh_hit_spark',
      x,
      y,
      ttl: options.isCrit ? 0.19 : 0.14,
      startScale: shScale,
      endScale: shScale,
      startAlpha: 0.96 * alphaMult,
      rotation: spallAngle + sparkJitter,
      tint: shaderTint,
      blendMode: 'NORMAL',
      depth: 55,
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
      x,
      y,
      vx: Math.cos(dir) * spd,
      vy: Math.sin(dir) * spd,
      vr: isTrail ? 0 : (getClientFreezeRandom()() - 0.5) * 12,
      ttl: 0.15 + getClientFreezeRandom()() * 0.1,
      startScale: invBake * (options.isCrit ? 1.08 : 0.85),
      endScale: invBake * 0.16,
      startAlpha: alphaMult,
      damping: 8.5,
      rotation: dir,
      tint: i === 0 && options.isCrit ? hexToNum(PALETTE.BONE_WHITE) : tint,
      depth: 56,
      scaleRatioY: isTrail ? 0.42 : 1,
      alignToVelocity: isTrail,
    });
  }
}

export function spawnElementalReactionFxImpl(
  this: CombatFxManager,
  params: {
    reaction: ElementalReactionId;
    x: number;
    y: number;
    damage: number;
    isTeamCombo: boolean;
  },
): void {
  const invBake = 1 / TextureBaker.getBakeScale();
  const spec = resolveElementalReactionBurstSpec(params.reaction, params.isTeamCombo);
  this.spawnFloorDecal(spec.decalKind, params.x, params.y, params.isTeamCombo ? 1.25 : 1.0);

  // Primary Chiaroscuro 1:1 Hollow-Core Elemental Nova (6 distinct morphologies across 6 reactions!)
  const novaKey = REACTION_NOVA_KEY[params.reaction] ?? 'fx_sh_nova_solar';
  const novaTint = REACTION_NOVA_TINT[params.reaction] ?? null;
  const tacticalRadiusPx = params.isTeamCombo ? 84 : 66;
  spawnShaderNovaImpl.call(this, params.x, params.y, tacticalRadiusPx, novaKey, {
    ttl: params.isTeamCombo ? 0.36 : 0.3,
    tint: novaTint,
    depth: 56,
    sparkCount: 0,
  });

  // Crisp secondary dual-element C-notched harmonic accent ring
  const innerRing = this.acquireParticleSlot();
  if (innerRing) {
    activateParticle(innerRing, {
      textureKey: spec.innerRing.textureKey,
      x: params.x,
      y: params.y,
      vr: params.reaction === 'vaporize' ? 3.2 : -1.4,
      ttl: spec.innerRing.ttl,
      startScale: invBake * spec.innerRing.startScale,
      endScale: invBake * spec.innerRing.endScale,
      startAlpha: 0.84,
      tint: hexToNum(spec.secondaryColorHex),
      depth: spec.innerRing.depth,
      easeCurve: 'easeOutCubic',
    });
  }

  const count = Math.max(
    6,
    Math.round(spec.particleCount * graphicsSettings.getBudget().particleBudgetRatio),
  );
  const primaryTint = hexToNum(spec.primaryColorHex);
  const secondaryTint = hexToNum(spec.secondaryColorHex);
  for (let i = 0; i < count; i++) {
    const p = this.acquireParticleSlot();
    if (!p) break;
    const ang = (i / count) * Math.PI * 2 + (getClientFreezeRandom()() - 0.5) * 0.22;
    const spd = (params.isTeamCombo ? 175 : 138) * (0.68 + getClientFreezeRandom()() * 0.45);
    const texKey =
      params.reaction === 'shatter' && i % 2 === 0
        ? 'fx_ice_shard'
        : params.reaction === 'vaporize' && i % 2 === 1
          ? 'fx_ember_mote'
          : spec.particleTextures[i % spec.particleTextures.length]!;
    const isTrail = texKey === 'fx_spark_trail';
    activateParticle(p, {
      textureKey: texKey,
      x: params.x,
      y: params.y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - (params.reaction === 'vaporize' ? 28 : 0),
      vr: isTrail ? 0 : (getClientFreezeRandom()() - 0.5) * 10,
      ttl: 0.25 + (i % 3) * 0.04,
      startScale: invBake * (params.isTeamCombo ? 1.12 : 0.96),
      endScale: invBake * 0.18,
      startAlpha: 0.92,
      gravityY: params.reaction === 'shatter' ? 110 : params.reaction === 'vaporize' ? -35 : 0,
      damping: 6,
      rotation: ang,
      tint: texKey === 'fx_ice_shard' ? null : i % 2 === 0 ? primaryTint : secondaryTint,
      depth: 57,
      scaleRatioY: isTrail ? 0.42 : 1,
      alignToVelocity: isTrail,
    });
  }

  this.totalDamagePopupsSpawned += 1;
  this.activeReactionBanner = coalesceElementalReaction(
    this.activeReactionBanner,
    params.reaction,
    params.damage,
    params.isTeamCombo,
    0.4,
  );

  const reuseWorldSlot =
    this.activeWorldReactionPopupSlot &&
    this.activeWorldReactionPopupSlot.active &&
    this.activeWorldReactionPopupSlot.age <= 0.42 &&
    this.activeReactionBanner.count > 1
      ? this.activeWorldReactionPopupSlot
      : this.acquireDamageSlot(params.x, params.y);

  if (reuseWorldSlot) {
    this.activeWorldReactionPopupSlot = reuseWorldSlot;
    reuseWorldSlot.active = true;
    reuseWorldSlot.age = 0;
    reuseWorldSlot.ttl = 0.85;
    reuseWorldSlot.originX = params.x;
    reuseWorldSlot.originY = params.y;
    reuseWorldSlot.x = params.x;
    reuseWorldSlot.y = params.y - 34;
    reuseWorldSlot.vx = 0;
    reuseWorldSlot.vy = -38;
    reuseWorldSlot.baseScale = params.isTeamCombo ? 1.34 : 1.2;
    reuseWorldSlot.text.setText(`⚡ ${this.activeReactionBanner.label}`);
    reuseWorldSlot.text.setColor(this.activeReactionBanner.colorHex);
    reuseWorldSlot.text.setPosition(reuseWorldSlot.x, reuseWorldSlot.y);
    reuseWorldSlot.text.setScale(reuseWorldSlot.baseScale * 1.15);
    reuseWorldSlot.text.setAlpha(1);
    reuseWorldSlot.text.setVisible(true);
    reuseWorldSlot.text.setActive(true);
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
  this.spawnFloorDecal(decalKind, x, y, clamp(radius / 64, 0.8, 1.45));

  // True 1:1 hitbox-matched Chiaroscuro Hollow-Core Detonation + radial spark needles (zero muddy dust blobs!)
  spawnShaderNovaImpl.call(this, x, y, radius, novaKey, {
    ttl: clamp(0.28 + radius * 0.0008, 0.28, 0.4),
    depth: 56,
    sparkCount: 8,
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
