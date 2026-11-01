import type { ElementType } from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { PALETTE } from './palette.js';

export const SHADER_FX_FRAME_COUNT = 14;
export const SHADER_ATLAS_COLS = 7;
export const SHADER_ATLAS_ROWS = 2;

/**
 * In the baker fragment shader:
 *   p = (localPx - 0.5 * framePx) / (0.43 * framePx)
 * All radial novas and directional slash outer arcs reach canonical R_p = 0.78,
 * which equals 0.78 * 0.43 * framePx = 0.3354 * framePx pixels from frame center.
 */
export const SHADER_CANONICAL_NORM_SCALE = 0.43;
export const SHADER_CANONICAL_HITBOX_P = 0.78;
export const SHADER_CANONICAL_HITBOX_RADIUS_RATIO =
  SHADER_CANONICAL_HITBOX_P * SHADER_CANONICAL_NORM_SCALE;

/**
 * Canonical +X span for beam/cone strips (muzzleX = -0.72 .. headX = +0.78 -> 1.50 p-units).
 */
export const SHADER_CANONICAL_LANCE_SPAN_RATIO = 1.5 * SHADER_CANONICAL_NORM_SCALE;

export const SHADER_FX_TEXTURE_KEYS = [
  'fx_sh_slash_steel',
  'fx_sh_slash_emerald',
  'fx_sh_slash_crimson',
  'fx_sh_slash_thunder',
  'fx_sh_cone_blast',
  'fx_sh_beam_lance',
  'fx_sh_muzzle_burst',
  'fx_sh_hit_spark',
  'fx_sh_nova_solar',
  'fx_sh_nova_magma',
  'fx_sh_nova_thunder',
  'fx_sh_nova_cryo',
  'fx_sh_nova_venom',
  'fx_sh_nova_void',
  'fx_sh_vortex_gale',
  'fx_sh_bloom_briar',
  'fx_sh_spore_cloud',
  'fx_sh_anvil_storm',
  'fx_sh_geyser_plume',
  'fx_sh_shrapnel_corona',
  'fx_sh_aegis_crest',
  'fx_sh_falcon_sonic',
  'fx_sh_arcane_sigil',
  'fx_sh_muzzle_arcane',
] as const;

export type ShaderFxTextureKey = (typeof SHADER_FX_TEXTURE_KEYS)[number];

export type ShaderNovaKey =
  | 'fx_sh_nova_solar'
  | 'fx_sh_nova_magma'
  | 'fx_sh_nova_thunder'
  | 'fx_sh_nova_cryo'
  | 'fx_sh_nova_venom'
  | 'fx_sh_nova_void'
  | 'fx_sh_vortex_gale'
  | 'fx_sh_bloom_briar'
  | 'fx_sh_spore_cloud'
  | 'fx_sh_anvil_storm'
  | 'fx_sh_geyser_plume'
  | 'fx_sh_shrapnel_corona'
  | 'fx_sh_arcane_sigil';

export type ShaderSlashKey =
  | 'fx_sh_slash_steel'
  | 'fx_sh_slash_emerald'
  | 'fx_sh_slash_crimson'
  | 'fx_sh_slash_thunder';

export type ShaderDirectionalKey =
  | ShaderSlashKey
  | 'fx_sh_cone_blast'
  | 'fx_sh_beam_lance'
  | 'fx_sh_muzzle_burst'
  | 'fx_sh_hit_spark'
  | 'fx_sh_aegis_crest'
  | 'fx_sh_falcon_sonic'
  | 'fx_sh_muzzle_arcane';

interface ShaderStripEntry {
  key: ShaderFxTextureKey;
  shaderId: number;
  elemId: number;
  sizeClass: 'small' | 'medium' | 'large';
  fallbackPrimaryHex: string;
  fallbackVeinHex: string;
}

const SHADER_STRIP_CATALOG: readonly ShaderStripEntry[] = [
  {
    key: 'fx_sh_slash_steel',
    shaderId: 0,
    elemId: 0,
    sizeClass: 'medium',
    fallbackPrimaryHex: PALETTE.SOLAR_GOLD,
    fallbackVeinHex: '#0C0918',
  },
  {
    key: 'fx_sh_slash_emerald',
    shaderId: 1,
    elemId: 1,
    sizeClass: 'medium',
    fallbackPrimaryHex: PALETTE.LIME_GLOW,
    fallbackVeinHex: '#031812',
  },
  {
    key: 'fx_sh_slash_crimson',
    shaderId: 2,
    elemId: 3,
    sizeClass: 'medium',
    fallbackPrimaryHex: PALETTE.FLAME_ORANGE,
    fallbackVeinHex: '#17050B',
  },
  {
    key: 'fx_sh_slash_thunder',
    shaderId: 3,
    elemId: 4,
    sizeClass: 'medium',
    fallbackPrimaryHex: PALETTE.CYAN_FROST,
    fallbackVeinHex: '#0A061D',
  },
  {
    key: 'fx_sh_cone_blast',
    shaderId: 4,
    elemId: 2,
    sizeClass: 'medium',
    fallbackPrimaryHex: PALETTE.FLAME_ORANGE,
    fallbackVeinHex: '#17050B',
  },
  {
    key: 'fx_sh_beam_lance',
    shaderId: 5,
    elemId: 2,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.SOLAR_GOLD,
    fallbackVeinHex: '#17050B',
  },
  {
    key: 'fx_sh_muzzle_burst',
    shaderId: 6,
    elemId: 0,
    sizeClass: 'small',
    fallbackPrimaryHex: PALETTE.SOLAR_GOLD,
    fallbackVeinHex: '#17050B',
  },
  {
    key: 'fx_sh_hit_spark',
    shaderId: 7,
    elemId: 0,
    sizeClass: 'small',
    fallbackPrimaryHex: PALETTE.BONE_WHITE,
    fallbackVeinHex: '#0C0918',
  },
  {
    key: 'fx_sh_nova_solar',
    shaderId: 8,
    elemId: 2,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.SOLAR_GOLD,
    fallbackVeinHex: '#17050B',
  },
  {
    key: 'fx_sh_nova_magma',
    shaderId: 9,
    elemId: 3,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.FLAME_ORANGE,
    fallbackVeinHex: '#120307',
  },
  {
    key: 'fx_sh_nova_thunder',
    shaderId: 10,
    elemId: 4,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.CYAN_FROST,
    fallbackVeinHex: '#0A061D',
  },
  {
    key: 'fx_sh_nova_cryo',
    shaderId: 11,
    elemId: 5,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.CYAN_FROST,
    fallbackVeinHex: '#041020',
  },
  {
    key: 'fx_sh_nova_venom',
    shaderId: 12,
    elemId: 6,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.LIME_GLOW,
    fallbackVeinHex: '#091408',
  },
  {
    key: 'fx_sh_nova_void',
    shaderId: 13,
    elemId: 7,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.TOXIC_PURPLE,
    fallbackVeinHex: '#050209',
  },
  {
    key: 'fx_sh_vortex_gale',
    shaderId: 14,
    elemId: 5,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.CYAN_FROST,
    fallbackVeinHex: '#041820',
  },
  {
    key: 'fx_sh_bloom_briar',
    shaderId: 15,
    elemId: 1,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.LIME_GLOW,
    fallbackVeinHex: '#031812',
  },
  {
    key: 'fx_sh_spore_cloud',
    shaderId: 16,
    elemId: 6,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.LIME_GLOW,
    fallbackVeinHex: '#0B1406',
  },
  {
    key: 'fx_sh_anvil_storm',
    shaderId: 17,
    elemId: 4,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.VOLT_YELLOW,
    fallbackVeinHex: '#0A061D',
  },
  {
    key: 'fx_sh_geyser_plume',
    shaderId: 18,
    elemId: 3,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.FLAME_ORANGE,
    fallbackVeinHex: '#140307',
  },
  {
    key: 'fx_sh_shrapnel_corona',
    shaderId: 19,
    elemId: 2,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.SOLAR_GOLD,
    fallbackVeinHex: '#17050B',
  },
  {
    key: 'fx_sh_aegis_crest',
    shaderId: 20,
    elemId: 3,
    sizeClass: 'medium',
    fallbackPrimaryHex: PALETTE.CRIMSON_BRIGHT,
    fallbackVeinHex: '#17050B',
  },
  {
    key: 'fx_sh_falcon_sonic',
    shaderId: 21,
    elemId: 1,
    sizeClass: 'medium',
    fallbackPrimaryHex: PALETTE.LIME_GLOW,
    fallbackVeinHex: '#031812',
  },
  {
    key: 'fx_sh_arcane_sigil',
    shaderId: 22,
    elemId: 0,
    sizeClass: 'large',
    fallbackPrimaryHex: PALETTE.SOLAR_GOLD,
    fallbackVeinHex: '#0C0918',
  },
  {
    key: 'fx_sh_muzzle_arcane',
    shaderId: 23,
    elemId: 0,
    sizeClass: 'small',
    fallbackPrimaryHex: PALETTE.BONE_WHITE,
    fallbackVeinHex: '#0C0918',
  },
] as const;

const ENTRY_BY_KEY: Readonly<Record<ShaderFxTextureKey, ShaderStripEntry>> = Object.fromEntries(
  SHADER_STRIP_CATALOG.map((e) => [e.key, e]),
) as unknown as Record<ShaderFxTextureKey, ShaderStripEntry>;

export function resolveShaderStripFramePx(key: ShaderFxTextureKey, _bakeScale = 4): number {
  const entry = ENTRY_BY_KEY[key];
  // 7x2 Hi-DPI atlas grid keeps max texture dimension at 384 * 7 = 2688px (<= 4096px WebGL1 limit)
  // while boosting large nova resolution by +78% pixels for razor-sharp Cutout harmony
  if (entry.sizeClass === 'small') return 192;
  if (entry.sizeClass === 'medium') return 288;
  return 384;
}

/**
 * Computes exact 1:1 isotropic Phaser Sprite scale so canonical R_p = 0.78
 * matches `worldRadiusPx` (WorldSim Euclidean circular hitbox) to the pixel.
 */
export function computeShaderNovaScale(
  worldRadiusPx: number,
  key: ShaderFxTextureKey = 'fx_sh_nova_solar',
  bakeScale = 4,
): number {
  const framePx = resolveShaderStripFramePx(key, bakeScale);
  const safeR = Math.max(8, worldRadiusPx);
  return safeR / (SHADER_CANONICAL_HITBOX_RADIUS_RATIO * framePx);
}

/**
 * Computes exact 1:1 Phaser Sprite scale for directional +X slashes, cones, muzzle & hit sparks.
 */
export function computeShaderDirectionalScale(
  worldReachPx: number,
  key: ShaderFxTextureKey,
  bakeScale = 4,
): number {
  const framePx = resolveShaderStripFramePx(key, bakeScale);
  const safeReach = Math.max(8, worldReachPx);
  if (key === 'fx_sh_beam_lance' || key === 'fx_sh_cone_blast') {
    return safeReach / (SHADER_CANONICAL_LANCE_SPAN_RATIO * framePx);
  }
  return safeReach / (SHADER_CANONICAL_HITBOX_RADIUS_RATIO * framePx);
}

export function resolveElementToNovaKey(element?: ElementType): ShaderNovaKey {
  if (element === 'burn') return 'fx_sh_nova_magma';
  if (element === 'chill') return 'fx_sh_nova_cryo';
  if (element === 'shock') return 'fx_sh_nova_thunder';
  if (element === 'poison') return 'fx_sh_nova_venom';
  return 'fx_sh_nova_solar';
}

export function resolveColorHexToNovaKey(colorHex: string): ShaderNovaKey {
  const norm = (colorHex || '').trim().toUpperCase();
  if (
    norm === PALETTE.CYAN_FROST.toUpperCase() ||
    norm === PALETTE.ICE_WHITE.toUpperCase() ||
    norm === PALETTE.AZURE_CORE.toUpperCase() ||
    norm === '#38BDF8' ||
    norm === '#67E8F9' ||
    norm === '#0EA5E9'
  ) {
    return 'fx_sh_nova_cryo';
  }
  if (
    norm === PALETTE.VOLT_YELLOW.toUpperCase() ||
    norm === '#FDE047' ||
    norm === '#60A5FA' ||
    norm === '#818CF8'
  ) {
    return 'fx_sh_nova_thunder';
  }
  if (
    norm === PALETTE.LIME_GLOW.toUpperCase() ||
    norm === PALETTE.MINT_LIGHT.toUpperCase() ||
    norm === PALETTE.GOBLIN_GREEN.toUpperCase() ||
    norm === '#4ADE80' ||
    norm === '#84CC16' ||
    norm === '#10B981' ||
    norm === '#2DD4BF'
  ) {
    return 'fx_sh_nova_venom';
  }
  if (
    norm === PALETTE.TOXIC_PURPLE.toUpperCase() ||
    norm === '#A855F7' ||
    norm === '#C084FC' ||
    norm === '#E879F9'
  ) {
    return 'fx_sh_nova_void';
  }
  if (norm === PALETTE.SOLAR_GOLD.toUpperCase() || norm === '#FACC15' || norm === '#FEF08A') {
    return 'fx_sh_nova_solar';
  }
  return 'fx_sh_nova_magma';
}

const VERTEX_SHADER_SRC = `
  attribute vec2 aPos;
  void main() {
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const SHADER_COMMON_HEADER = `
  precision highp float;
  uniform float uFramePx;
  uniform float uFrameCount;
  uniform float uShaderId;
  uniform float uElemId;

  #define PI 3.14159265359

  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Loop-free 3-octave FBM (reaches Nyquist at 144..192px tile scale without D3D11 fxc loop-unroll blowup)
  float fbm(vec2 p) {
    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
    float v = 0.500 * vnoise(p);
    p = rot * p * 2.04 + vec2(11.3, 27.9);
    v += 0.250 * vnoise(p);
    p = rot * p * 2.04 + vec2(11.3, 27.9);
    v += 0.125 * vnoise(p);
    return v * 1.142857;
  }

  float warpedFbm(vec2 p, float flow) {
    vec2 q = vec2(fbm(p + vec2(0.0, flow)), fbm(p + vec2(4.7, 1.9 - flow)));
    return fbm(p + 1.65 * q);
  }

  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }

  mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, s, -s, c);
  }

  float sq(float x) {
    return x * x;
  }

  // GLSL ES 1.00 safe descending smoothstep (avoids edge0 >= edge1 undefined behavior & 0/0 NaN)
  float invSmooth(float hi, float lo, float x) {
    return 1.0 - smoothstep(lo, max(lo + 1e-5, hi), x);
  }

  vec3 elementalBodyRamp(int elem, float e) {
    vec3 c1, c2, c3;
    if (elem == 0) {
      c1 = vec3(0.140, 0.240, 0.420);
      c2 = vec3(0.920, 0.680, 0.200);
      c3 = vec3(1.000, 0.930, 0.600);
    } else if (elem == 1) {
      c1 = vec3(0.015, 0.280, 0.195);
      c2 = vec3(0.035, 0.680, 0.450);
      c3 = vec3(0.280, 0.960, 0.680);
    } else if (elem == 2) {
      c1 = vec3(0.540, 0.045, 0.075);
      c2 = vec3(0.980, 0.310, 0.045);
      c3 = vec3(1.000, 0.780, 0.120);
    } else if (elem == 3) {
      c1 = vec3(0.420, 0.020, 0.055);
      c2 = vec3(0.930, 0.165, 0.075);
      c3 = vec3(1.000, 0.580, 0.095);
    } else if (elem == 4) {
      c1 = vec3(0.210, 0.130, 0.760);
      c2 = vec3(0.110, 0.660, 0.980);
      c3 = vec3(0.980, 0.910, 0.340);
    } else if (elem == 5) {
      c1 = vec3(0.020, 0.270, 0.560);
      c2 = vec3(0.090, 0.650, 0.940);
      c3 = vec3(0.560, 0.930, 0.990);
    } else if (elem == 6) {
      c1 = vec3(0.150, 0.045, 0.270);
      c2 = vec3(0.130, 0.720, 0.250);
      c3 = vec3(0.640, 0.960, 0.240);
    } else {
      c1 = vec3(0.320, 0.050, 0.560);
      c2 = vec3(0.680, 0.240, 0.960);
      c3 = vec3(0.950, 0.620, 0.990);
    }
    vec3 col = mix(c1, c2, smoothstep(0.10, 0.52, e));
    col = mix(col, c3, smoothstep(0.52, 0.90, e));
    return col;
  }

  vec3 elementalGlowTint(int elem) {
    if (elem == 0) return vec3(1.00, 0.76, 0.26);
    if (elem == 1) return vec3(0.10, 0.92, 0.58);
    if (elem == 2) return vec3(1.00, 0.38, 0.06);
    if (elem == 3) return vec3(0.98, 0.22, 0.06);
    if (elem == 4) return vec3(0.28, 0.72, 1.00);
    if (elem == 5) return vec3(0.22, 0.78, 1.00);
    if (elem == 6) return vec3(0.34, 0.92, 0.22);
    return vec3(0.76, 0.28, 1.00);
  }

  vec3 elementalEdgeHdr(int elem) {
    if (elem == 0) return vec3(1.68, 1.58, 1.28);
    if (elem == 1) return vec3(1.30, 1.72, 1.48);
    if (elem == 2) return vec3(1.72, 1.46, 0.98);
    if (elem == 3) return vec3(1.75, 1.30, 0.90);
    if (elem == 4) return vec3(1.55, 1.62, 1.78);
    if (elem == 5) return vec3(1.35, 1.65, 1.82);
    if (elem == 6) return vec3(1.45, 1.75, 1.18);
    return vec3(1.62, 1.32, 1.78);
  }

  vec3 darkVeinTint(int elem) {
    if (elem == 0) return vec3(0.047, 0.035, 0.094);
    if (elem == 1) return vec3(0.012, 0.095, 0.070);
    if (elem == 2) return vec3(0.090, 0.018, 0.042);
    if (elem == 3) return vec3(0.070, 0.012, 0.028);
    if (elem == 4) return vec3(0.038, 0.022, 0.115);
    if (elem == 5) return vec3(0.016, 0.062, 0.125);
    if (elem == 6) return vec3(0.035, 0.078, 0.032);
    return vec3(0.018, 0.006, 0.036);
  }

  float crescentGapErode(float ang, float t, float wNoise, float seedShift) {
    float lobes = 0.5 + 0.5 * cos(ang * 4.0 + seedShift + sin(ang * 3.0 - seedShift * 0.7) * 0.85);
    float field = mix(wNoise, lobes, 0.48);
    float thresh = max(0.0, (t - 0.28) * 1.12);
    return smoothstep(thresh, thresh + 0.15, field);
  }

  void decodeAtlasCoord(vec2 fragCoord, float framePx, float frameCount, out float t, out vec2 p) {
    float col = clamp(floor(fragCoord.x / framePx), 0.0, 6.0);
    float glRow = clamp(floor(fragCoord.y / framePx), 0.0, 1.0);
    float canvasRow = 1.0 - glRow;
    float frameIndex = canvasRow * 7.0 + col;
    t = clamp(frameIndex / max(1.0, frameCount - 1.0), 0.0, 1.0);
    float localX = fragCoord.x - col * framePx;
    float localY = fragCoord.y - glRow * framePx;
    p = vec2(localX - 0.5 * framePx, 0.5 * framePx - localY) / (0.43 * framePx);
  }

  // Tapered diamond/dagger flying ember shards with #141019 obsidian ink casing for Cutout art harmony
  void radialDaggerSparks(
    float r,
    float ang,
    float cells,
    float seedSalt,
    float baseR,
    float travelSpan,
    float halfLen,
    float halfW,
    float gateMask,
    float alive,
    out float sparkHot,
    out float sparkInk
  ) {
    float idx = floor((ang + PI) / (2.0 * PI) * cells);
    float cAng = (idx + 0.5) / cells * 2.0 * PI - PI;
    float seed = hash21(vec2(idx, seedSalt));
    float sPos = baseR + travelSpan * (0.58 + 0.42 * seed);
    float dAng = abs(atan(sin(ang - cAng), cos(ang - cAng))) * max(r, 0.08);
    float dRad = abs(r - sPos);
    float diamond = dAng / max(0.003, halfW) + dRad / max(0.010, halfLen);
    float active = step(0.20, seed) * gateMask * alive;
    sparkHot = invSmooth(0.95, 0.22, diamond) * active;
    sparkInk = invSmooth(1.55, 0.78, diamond) * (1.0 - sparkHot * 0.85) * active * 0.86;
  }

  vec4 synthesizeChiaroscuroRgba(int elem, float energy, float edge, float vein, float sparks, float borderFade) {
    // Cel-stepped value posterization + crisp #141019 outer obsidian contour to match Chibi Cutout art
    float celStepped = floor(clamp(energy, 0.0, 1.15) * 3.8 + 0.28) / 3.8;
    float celE = mix(energy, celStepped, 0.44);
    vec3 bodyCol = elementalBodyRamp(elem, celE);
    float aBody = smoothstep(0.052, 0.148, energy) * 0.96;
    vec3 pmCol = (bodyCol * 1.42) * aBody;
    float alpha = aBody;

    float outerContour = smoothstep(0.036, 0.088, energy)
                       * invSmooth(0.22, 0.11, energy)
                       * invSmooth(0.34, 0.06, edge + sparks);
    float totalVein = clamp(max(vein, outerContour * 0.86), 0.0, 1.0);

    float aVein = clamp(totalVein * 0.95, 0.0, 0.95);
    pmCol = pmCol * (1.0 - aVein) + darkVeinTint(elem) * aVein;
    alpha = alpha + aVein * (1.0 - alpha);

    float veinMask = 1.0 - aVein * 0.90;
    vec3 hdrAdd = elementalGlowTint(elem) * sq(max(celE, 0.0)) * 0.72 * veinMask
                + elementalEdgeHdr(elem) * (edge * (1.0 - aVein * 0.42) + sparks * 1.42);
    pmCol += hdrAdd;

    float hdrPeak = max(hdrAdd.r, max(hdrAdd.g, hdrAdd.b));
    float aEmissive = clamp(hdrPeak * 0.88, 0.0, 0.98);
    alpha = clamp(max(alpha, aEmissive) * borderFade, 0.0, 0.99);

    if (alpha < 0.012) {
      return vec4(0.0);
    }

    vec3 straightRgb = aces((pmCol * borderFade) / max(alpha, 0.012));
    return vec4(straightRgb, alpha);
  }
`;

// FAMILY 0 (shaderId 0..7): Directional +X 360-degree Slashes, Cone Blast, Railgun Lance, Muzzle Burst, Hit Spark
const FRAG_DIRECTIONAL_SRC = SHADER_COMMON_HEADER + `
  void vfxSlash(vec2 rp, float t, int variant, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.8);

    vec2 sp = rp + vec2(0.08, 0.0);
    float r = length(sp);
    float ang = atan(sp.y, sp.x + 1e-6);

    float mainR = 0.56 + ease * 0.30;
    float sweepCenter = -0.30 + ease * 0.44;
    float span = (variant == 2 ? 1.66 : variant == 3 ? 1.58 : 1.50) - t * 0.12;
    float dAng = atan(sin(ang - sweepCenter), cos(ang - sweepCenter));
    float u = clamp((dAng + span) / (2.0 * span), 0.0, 1.0);
    float taper = pow(max(0.0, sin(u * PI)), 0.70);
    float headReveal = invSmooth(1.0, 0.86, u / clamp(0.44 + t * 2.5, 0.01, 1.0));
    float inArc = smoothstep(0.0, 0.08 + t * 0.22, u) * invSmooth(1.0, 0.90, u) * headReveal * step(abs(dAng), span);

    float freqA = variant == 1 ? 5.6 : variant == 2 ? 4.6 : 3.4;
    float wNoise = warpedFbm(vec2(ang * freqA - ease * 3.2, r * 6.5 - ease * 4.5), t * 3.2);

    // 4 Bespoke Melee Weapon Morphologies:
    // 0 = Knight Broadsword (clean twin-fuller steel arc + crossguard glint)
    // 1 = Emerald Great-Cleaver (7 hooked shark-tooth serrated poison fangs)
    // 2 = Berserker Great-Axe (wide asymmetric bearded-hatchet executioner wedge)
    // 3 = Mjolnir Thunder Hammer (blunt seismic hammer-anvil shockhead + dual lightning forks)
    float jag = (wNoise - 0.5) * 0.024;
    float trailMult = 0.88;
    if (variant == 1) {
      float sawPhase = fract(u * 7.0 - ease * 0.35);
      float tooth = (1.0 - sawPhase) * smoothstep(0.06, 0.22, sawPhase);
      jag = (tooth - 0.32) * 0.135 + (wNoise - 0.5) * 0.032;
      trailMult = 1.08;
    } else if (variant == 2) {
      float axeBeard = smoothstep(0.30, 0.54, u) * invSmooth(0.96, 0.80, u);
      float beardNotch = smoothstep(0.24, 0.36, u) * invSmooth(0.46, 0.36, u);
      jag = axeBeard * 0.072 - beardNotch * 0.048 + (wNoise - 0.5) * 0.056;
      trailMult = 0.74 + axeBeard * 1.05;
    } else if (variant == 3) {
      float anvilHead = exp(-sq((u - 0.64) / 0.22));
      float stepZig = (abs(fract(u * 9.0 + floor(t * 10.0) * 0.25) - 0.5) - 0.25) * 0.11;
      jag = anvilHead * 0.055 + stepZig + (wNoise - 0.5) * 0.036;
      trailMult = 0.84 + anvilHead * 0.78;
    }

    float dr = r - (mainR + jag * taper);
    float leadW = (variant == 3 ? 0.032 : 0.024) * taper;
    float trailW = (0.24 + 0.15 * wNoise) * trailMult * taper * (1.0 - t * 0.36);
    float body = dr > 0.0
      ? 1.0 - smoothstep(0.0, max(0.004, leadW), dr)
      : 1.0 - smoothstep(0.0, max(0.006, trailW), -dr);

    float wakeDissolve = smoothstep(t * 0.92 - 0.10, t * 0.92 + 0.24, body * (0.50 + 0.72 * wNoise));
    float mainSlash = body * inArc * wakeDissolve;

    float innerTrack = invSmooth(0.076 * taper, 0.014 * taper, abs(dr + 0.056 * taper));
    vein = innerTrack * inArc * smoothstep(0.26, 0.72, wNoise) * (1.0 - t * 0.68) * step(dr, -0.008);

    float extraDetail = 0.0;
    if (variant == 0) {
      // Twin chivalric broadsword fuller bevels separated by dark steel groove
      float fullerInner = invSmooth(0.013, 0.0, abs(dr + 0.095 * taper)) * inArc * (1.0 - pow(max(0.0, t), 1.6));
      extraDetail = fullerInner * 0.95;
      vein = max(vein, invSmooth(0.022, 0.004, abs(dr + 0.048 * taper)) * inArc * (1.0 - t * 0.55) * 0.88);
    } else if (variant == 2) {
      // Molten executioner axe-head fracture ribs
      float rib = abs(sin(u * 18.0 - 1.2));
      float magmaCrack = invSmooth(0.18, 0.0, rib) * smoothstep(0.36, 0.56, u) * invSmooth(0.92, 0.78, u) * mainSlash;
      extraDetail = magmaCrack * 0.85;
    }

    float razor = invSmooth(0.022, 0.0, abs(dr + 0.002)) * pow(max(0.0, taper), 0.82) * inArc * (1.0 - pow(max(0.0, t), 1.75));
    float echoR = mainR + 0.072 + 0.020 * wNoise;
    float echoU = clamp((dAng + span * 0.78 - 0.14) / (1.55 * span), 0.0, 1.0);
    float echoEnv = max(0.0, sin(echoU * PI)) * step(0.02, echoU) * step(echoU, 0.98) * (1.0 - t);
    float echoRibbon = (variant == 2 ? 0.45 : 1.0) * invSmooth(0.014, 0.0, abs(r - echoR)) * echoEnv;
    vein = max(vein, invSmooth(0.026, 0.006, abs(r - (echoR - 0.016))) * echoEnv * 0.74);

    float arcBolt = 0.0;
    if (variant == 3) {
      float zig1 = (abs(fract(ang * 5.5 + floor(t * 11.0) * 0.37) - 0.5) - 0.25) * 0.15;
      float zig2 = (abs(fract(ang * 8.5 - floor(t * 9.0) * 0.41) - 0.5) - 0.25) * 0.11;
      arcBolt = (exp(-sq((dr + 0.032 + zig1) / 0.012)) + 0.75 * exp(-sq((dr + 0.105 + zig2) / 0.010)))
              * inArc * (1.0 - pow(max(0.0, t), 1.9));
    }

    vec2 hitP = rp - vec2(variant == 0 ? 0.66 : 0.68, variant == 0 ? 0.02 : 0.06);
    float impEnv = max(0.0, sin(clamp(t / 0.32, 0.0, 1.0) * PI)) * step(t, 0.32);
    vec2 hpR = rot2(variant == 0 ? 0.0 : 0.38) * hitP;
    float starScale = variant == 0 ? 1.38 : 1.0;
    float star = (exp(-abs(hpR.y) * 58.0) * exp(-abs(hpR.x) * 4.4)
                + exp(-abs(hpR.x) * 58.0) * exp(-abs(hpR.y) * 4.8)) * impEnv * starScale;

    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, variant == 1 ? 14.0 : 16.0, 3.7 + float(variant), 0.44, ease * 0.48,
      0.082 * (1.0 - t * 0.48), 0.013, step(abs(dAng), span * 1.05), 1.0 - t * 0.80,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);

    energy = clamp(mainSlash * (0.60 + 0.62 * wNoise) + echoRibbon * 0.88 + arcBolt * 0.72 + extraDetail * 0.45, 0.0, 1.15);
    edge = razor * 1.22 + echoRibbon * 0.82 + star * 1.16 + arcBolt * 1.32 + extraDetail;
  }

  void vfxConeBlast(vec2 rp, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    vec2 cp = rp - vec2(-0.62, 0.0);
    float r = length(cp);
    float ang = atan(cp.y, cp.x);
    float coneSpan = 0.66;
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.9);

    float frontR = 0.24 + ease * 1.12;
    float inCone = invSmooth(coneSpan + 0.08, coneSpan - 0.08, abs(ang));
    float taper = pow(max(0.0, cos(ang / coneSpan * 0.5 * PI)), 0.55);

    float wNoise = warpedFbm(vec2(ang * 5.0, r * 6.0 - ease * 6.5), t * 3.8);
    float dr = r - (frontR + (wNoise - 0.5) * 0.11 * taper);
    float outerW = 0.032 * (1.0 - t * 0.35);
    float innerW = (0.30 + 0.18 * wNoise) * (1.0 - t * 0.45);
    float wave = (dr > 0.0
      ? 1.0 - smoothstep(0.0, max(0.005, outerW), dr)
      : 1.0 - smoothstep(0.0, max(0.008, innerW), -dr))
      * smoothstep(frontR * 0.28, frontR * 0.56, r) * inCone;

    float erode = smoothstep(t * 0.90 - 0.10, t * 0.90 + 0.24, wave * (0.48 + 0.76 * wNoise));
    energy = wave * erode * (0.58 + 0.65 * wNoise);

    vein = invSmooth(0.072, 0.012, abs(dr + 0.054)) * erode * inCone * smoothstep(0.25, 0.72, wNoise) * (1.0 - t * 0.70);
    float crestRazor = invSmooth(0.019, 0.0, abs(dr - 0.002)) * erode * inCone * taper * (1.0 - pow(max(0.0, t), 1.6));

    float impEnv = 1.0 - smoothstep(0.0, 0.24, t);
    float muzzleStar = (exp(-abs(cp.y) * 52.0) * exp(-abs(cp.x - 0.08) * 7.5)
                      + exp(-abs(cp.x - 0.08) * 48.0) * exp(-abs(cp.y) * 8.0)) * impEnv;

    float cells = 24.0;
    float idx = floor((ang + PI) / (2.0 * PI) * cells);
    float sa = (idx + 0.5) / cells * 2.0 * PI - PI;
    float seed = hash21(vec2(idx, 5.1));
    float sr = 0.18 + ease * (0.78 + seed * 0.38);
    sparks = invSmooth(0.011, 0.0, abs(ang - sa) * r)
           * invSmooth(0.11 * (1.0 - t * 0.5), 0.0, abs(r - sr))
           * (1.0 - t * 0.78) * step(abs(sa), coneSpan * 0.92) * step(0.16, seed);

    edge = crestRazor * 1.2 + muzzleStar * 1.25;
  }

  void vfxBeamLance(vec2 rp, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float muzzleX = -0.72;
    float headX = mix(-0.12, 0.78, clamp(t * 4.8, 0.0, 1.0));
    float inSpan = smoothstep(muzzleX - 0.02, muzzleX + 0.04, rp.x) * invSmooth(headX + 0.04, headX - 0.04, rp.x);

    float turb = warpedFbm(vec2(rp.x * 4.0 - t * 9.5, rp.y * 9.5), t * 4.5);
    float beamW = (0.165 - t * 0.095) * (0.76 + 0.52 * turb);
    float helix = sin(rp.x * 12.5 - t * 20.0) * 0.025 * (1.0 - t * 0.5);

    float sheath = (1.0 - smoothstep(0.01, max(0.015, beamW), abs(rp.y - helix))) * inSpan;
    float erode = smoothstep(t * 0.90 - 0.10, t * 0.90 + 0.24, sheath * (0.50 + 0.74 * turb));
    energy = sheath * erode * (0.55 + 0.65 * turb);

    float coreBreak = smoothstep(max(0.0, (t - 0.58) * 2.0), max(0.01, (t - 0.58) * 2.0 + 0.22), turb);
    float core = exp(-sq(rp.y / (0.016 * (1.0 - t * 0.55) + 0.004))) * inSpan * coreBreak;
    float machDiamonds = pow(max(0.0, 0.5 + 0.5 * cos(rp.x * 22.0 - t * 28.0)), 3.0)
                       * exp(-sq(rp.y / (0.042 * (1.0 - t * 0.45) + 0.008))) * inSpan * coreBreak;
    float outerRim = invSmooth(0.016, 0.0, abs(abs(rp.y - helix) - beamW * 0.86)) * inSpan * erode * (1.0 - pow(max(0.0, t), 1.6));
    edge += (core * 1.38 + machDiamonds * 0.72 + outerRim * 0.82) * (1.0 - pow(max(0.0, t), 2.2));

    float shearBand = smoothstep(0.013, 0.032, abs(rp.y)) * invSmooth(beamW * 0.78, beamW * 0.30, abs(rp.y));
    vein = shearBand * inSpan * erode * smoothstep(0.24, 0.66, turb) * (1.0 - t * 0.65) * 0.98;

    float tipDx = headX - rp.x;
    if (tipDx > -0.03 && tipDx < 0.42) {
      float coneY = 0.42 * sqrt(max(tipDx + 0.015, 0.0));
      float collarBody = invSmooth(0.055, 0.0, abs(abs(rp.y) - coneY)) * invSmooth(0.42, 0.0, tipDx);
      float collarEdge = invSmooth(0.017, 0.0, abs(abs(rp.y) - coneY)) * invSmooth(0.42, 0.0, tipDx);
      energy = max(energy, collarBody * (1.0 - t * 0.78) * 0.9);
      edge += collarEdge * (1.0 - pow(max(0.0, t), 1.55)) * 1.15;
    }

    vec2 tipP = rp - vec2(headX - 0.02, 0.0);
    float tipStar = (exp(-abs(tipP.y) * 66.0) * exp(-abs(tipP.x) * 6.5) + exp(-abs(tipP.x) * 66.0) * exp(-abs(tipP.y) * 6.5))
                  * (1.0 - pow(max(0.0, t), 1.45));
    edge += tipStar * 1.15;

    float laneId = floor((rp.y + 0.24) / 0.048);
    float laneY = (laneId + 0.5) * 0.048 - 0.24;
    float lSeed = hash21(vec2(laneId, 6.1));
    float sx = -0.52 + fract(lSeed * 1.7 + t * (1.1 + 0.3 * hash21(vec2(laneId, 2.3)))) * 1.24;
    sparks = invSmooth(0.065 * (1.0 - t * 0.55), 0.0, abs(rp.x - sx))
           * invSmooth(0.009, 0.0, abs(rp.y - laneY))
           * (1.0 - t * 0.85) * step(abs(laneY), 0.18 * (0.45 + t)) * step(0.20, lSeed);
  }

  void vfxMuzzleBurst(vec2 rp, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    vec2 mp = rp - vec2(-0.34, 0.0);
    float r = length(mp);
    float ang = atan(mp.y, mp.x);
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.8);

    float mainJet = exp(-abs(mp.y) * 34.0) * smoothstep(-0.08, 0.04, mp.x) * invSmooth(1.08 * (1.0 - t * 0.25), 0.05, mp.x);
    vec2 v1 = rot2(0.66) * mp;
    vec2 v2 = rot2(-0.66) * mp;
    float sideJets = (exp(-abs(v1.y) * 38.0) * smoothstep(-0.04, 0.04, v1.x) * invSmooth(0.62, 0.04, v1.x)
                    + exp(-abs(v2.y) * 38.0) * smoothstep(-0.04, 0.04, v2.x) * invSmooth(0.62, 0.04, v2.x));

    float wNoise = warpedFbm(vec2(mp.x * 5.5 - ease * 5.0, mp.y * 7.5), t * 4.0);
    float plumeR = 0.22 + ease * 0.56;
    float inFront = invSmooth(1.05, 0.25, abs(ang));
    float plume = invSmooth(plumeR, plumeR * 0.25, length(vec2(mp.x * 0.72, mp.y * 1.35))) * inFront;
    float erode = smoothstep(t * 0.92 - 0.12, t * 0.92 + 0.24, plume * (0.48 + 0.78 * wNoise));

    energy = clamp(plume * erode * (0.62 + 0.58 * wNoise) + (mainJet + sideJets * 0.8) * (1.0 - t * 0.7), 0.0, 1.15);
    vein = invSmooth(0.24, 0.06, abs(r - (0.18 + ease * 0.24))) * inFront * erode * smoothstep(0.32, 0.76, wNoise) * (1.0 - t * 0.65) * (1.0 - mainJet);
    edge = (mainJet * 1.45 + sideJets * 1.15 + exp(-r * 22.0)) * (1.0 - pow(max(0.0, t), 1.55));

    float cells = 20.0;
    float idx = floor((ang + PI) / (2.0 * PI) * cells);
    float sa = (idx + 0.5) / cells * 2.0 * PI - PI;
    float seed = hash21(vec2(idx, 8.2));
    float sr = 0.16 + ease * (0.52 + 0.30 * seed);
    sparks = invSmooth(0.013, 0.0, abs(ang - sa) * r)
           * invSmooth(0.09 * (1.0 - t * 0.5), 0.0, abs(r - sr))
           * (1.0 - t * 0.8) * step(abs(sa), 0.70) * step(0.20, seed);
  }

  void vfxHitSpark(vec2 rp, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(rp);
    float ang = atan(rp.y, rp.x);
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 3.0);

    float impEnv = 1.0 - smoothstep(0.0, 0.34, t);
    vec2 sp1 = rot2(0.32) * rp;
    float cutStar = (exp(-abs(sp1.y) * 54.0) * exp(-abs(sp1.x) * 3.6)
                   + exp(-abs(sp1.x) * 54.0) * exp(-abs(sp1.y) * 4.4)) * impEnv;

    float ringR = 0.14 + ease * 0.58;
    float wNoise = warpedFbm(vec2(ang * 4.0, r * 7.0 - ease * 5.0), t * 3.5);
    float cMask = invSmooth(1.85, 0.65, abs(ang));
    float dr = r - (ringR + (wNoise - 0.5) * 0.07);
    float band = (1.0 - smoothstep(0.0, 0.09 * (1.0 - t * 0.4), abs(dr))) * cMask * smoothstep(ringR * 0.4, ringR * 0.7, r);
    float erode = smoothstep(t * 0.90 - 0.10, t * 0.90 + 0.22, band * (0.5 + 0.72 * wNoise));

    energy = band * erode * (0.65 + 0.55 * wNoise);
    vein = invSmooth(0.045, 0.008, abs(dr + 0.032)) * erode * cMask * (1.0 - t * 0.7);
    edge = cutStar * 1.45 + invSmooth(0.018, 0.0, abs(dr - 0.002)) * erode * cMask * (1.0 - pow(max(0.0, t), 1.6)) * 1.15;

    float cells = 18.0;
    float idx = floor((ang + PI) / (2.0 * PI) * cells);
    float sa = (idx + 0.5) / cells * 2.0 * PI - PI;
    float seed = hash21(vec2(idx, 4.4));
    float sr = 0.12 + ease * (0.48 + 0.26 * seed);
    sparks = invSmooth(0.013, 0.0, abs(ang - sa) * r)
           * invSmooth(0.09 * (1.0 - t * 0.5), 0.0, abs(r - sr))
           * (1.0 - t * 0.8) * step(abs(sa), 1.22) * step(0.18, seed);
  }

  void main() {
    float t = 0.0;
    vec2 p = vec2(0.0);
    decodeAtlasCoord(gl_FragCoord.xy, uFramePx, uFrameCount, t, p);
    float borderFade = invSmooth(1.15, 1.02, max(abs(p.x), abs(p.y)));
    if (borderFade <= 0.001) { gl_FragColor = vec4(0.0); return; }

    int sid = int(uShaderId + 0.5);
    int elem = int(uElemId + 0.5);
    float energy = 0.0, edge = 0.0, vein = 0.0, sparks = 0.0;
    if (sid <= 3) vfxSlash(p, t, sid, energy, edge, vein, sparks);
    else if (sid == 4) vfxConeBlast(p, t, energy, edge, vein, sparks);
    else if (sid == 5) vfxBeamLance(p, t, energy, edge, vein, sparks);
    else if (sid == 6) vfxMuzzleBurst(p, t, energy, edge, vein, sparks);
    else vfxHitSpark(p, t, energy, edge, vein, sparks);

    gl_FragColor = synthesizeChiaroscuroRgba(elem, energy, edge, vein, sparks, borderFade);
  }
`;

// FAMILY 1 (shaderId 8..10): Solar Supernova, Magma Eruption, Thunder Radial Nova
const FRAG_NOVA_HOT_SRC = SHADER_COMMON_HEADER + `
  void vfxSolarOrMagmaNova(vec2 p, float t, int isMagma, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x);

    float impEnv = 1.0 - smoothstep(0.0, 0.24, t);
    if (impEnv > 0.0) {
      float rays8 = exp(-abs(p.y) * 58.0) * exp(-abs(p.x) * 3.5)
                  + exp(-abs(p.x) * 58.0) * exp(-abs(p.y) * 3.5)
                  + 0.72 * exp(-abs(p.x - p.y) * 52.0) * exp(-r * 4.8)
                  + 0.72 * exp(-abs(p.x + p.y) * 52.0) * exp(-r * 4.8);
      edge += (rays8 + exp(-r * 26.0)) * impEnv * 1.25;

      if (isMagma == 0) {
        float kSpan = 2.0 * PI / 3.0;
        float kIdx = floor(mod(ang - 0.52 + kSpan * 0.5 + 2.0 * PI, 2.0 * PI) / kSpan);
        float ka = kIdx * kSpan + 0.52;
        vec2 dir = vec2(cos(ka), sin(ka));
        float proj = dot(p, dir);
        float perp = abs(dot(p, vec2(-dir.y, dir.x)));
        float segStart = mix(0.74, 0.06, clamp(t / 0.24, 0.0, 1.0));
        float lance = invSmooth(0.015, 0.0, perp)
                    * smoothstep(segStart - 0.24, segStart, proj)
                    * invSmooth(segStart + 0.16, segStart, proj);
        edge += lance * impEnv * 1.05;
        energy = max(energy, lance * impEnv * 0.85);
      }
    }

    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.7);
    float ringR = 0.15 + ease * 0.545;
    float freq = isMagma == 1 ? 6.5 : 5.0;
    float wNoise = warpedFbm(vec2(ang * freq + t * 1.2, r * 7.2 - ease * 5.6), t * 3.4);

    float warpAmp = isMagma == 1 ? 0.102 : 0.086;
    float warpedR = ringR + (wNoise - 0.5) * warpAmp;
    float dr = r - warpedR;
    float outerW = 0.024 * (1.0 - t * 0.35);
    float innerW = (isMagma == 1 ? 0.21 : 0.17 + 0.13 * wNoise) * (1.0 - t * 0.48);
    float hollowGate = smoothstep(ringR * 0.46, ringR * 0.70, r);
    float corona = (dr > 0.0
      ? 1.0 - smoothstep(0.0, max(0.004, outerW), dr)
      : 1.0 - smoothstep(0.0, max(0.006, innerW), -dr)) * hollowGate;

    float erode = crescentGapErode(ang, t, wNoise, isMagma == 1 ? 1.9 : 0.6);
    float waveEnergy = corona * erode * (0.58 + 0.68 * wNoise);

    float veinW = isMagma == 1 ? 0.082 : 0.068;
    vein = invSmooth(veinW, 0.010, abs(dr + 0.046)) * hollowGate * erode * smoothstep(0.18, 0.56, wNoise) * (1.0 - t * 0.54);

    // Secondary inner harmonic filament adds double-crest Hades depth while keeping center 100% hollow
    float innerCrestR = ringR * 0.77 + (0.5 - wNoise) * 0.038;
    float innerFilament = invSmooth(0.014, 0.0, abs(r - innerCrestR)) * hollowGate * erode * (1.0 - pow(max(0.0, t), 1.45));
    float rimRazor = invSmooth(0.017, 0.0, abs(dr - 0.002)) * hollowGate * erode * (1.0 - pow(max(0.0, t), 1.6));

    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, 20.0, 9.1 + float(isMagma) * 3.3, 0.15, ease * 0.58,
      0.078 * (1.0 - t * 0.52), 0.012, 1.0, 1.0 - t * 0.78,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);

    energy = max(energy, waveEnergy + innerFilament * 0.36);
    edge += rimRazor * 1.22 + innerFilament * 0.76;
  }

  void vfxThunderRadial(vec2 p, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x);

    float impEnv = 1.0 - smoothstep(0.0, 0.22, t);
    if (impEnv > 0.0) {
      float star6 = invSmooth(0.026, 0.0, abs(sin(ang * 3.0)) * r) * invSmooth(0.56, 0.0, r);
      edge += (star6 + exp(-r * 26.0)) * impEnv * 1.3;
    }

    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.9);
    float hoopR = 0.16 + ease * 0.545;
    float stepSeed = floor(t * 14.0 * 0.8);
    float jitter = (fbm(vec2(ang * 8.0, stepSeed * 1.7)) - 0.5) * 0.074;
    float dr = r - (hoopR + jitter);

    float hollowGate = smoothstep(hoopR * 0.46, hoopR * 0.72, r);
    float plasmaBand = (dr > 0.0
      ? 1.0 - smoothstep(0.0, 0.024, dr)
      : 1.0 - smoothstep(0.0, 0.105 * (1.0 - t * 0.45), -dr))
      * hollowGate;
    float wNoise = warpedFbm(vec2(ang * 5.0, r * 7.0 - ease * 5.0), t * 4.0);
    float erode = crescentGapErode(ang, t, wNoise, 3.1);

    float hoopRazor = invSmooth(0.015, 0.0, abs(dr - 0.002)) * hollowGate * erode;
    float hoopVein = invSmooth(0.046, 0.009, abs(dr + 0.032)) * hollowGate * erode * (1.0 - t * 0.58);

    float sectorSpan = PI / 3.0;
    float sectorId = floor((ang + PI) / sectorSpan);
    float localA = mod(ang + PI, sectorSpan) - 0.5 * sectorSpan;

    float zig1 = (abs(fract(r * 6.5 + hash21(vec2(sectorId, stepSeed)) * 3.0) - 0.5) - 0.25) * 0.44;
    float zig2 = (abs(fract(r * 14.0 - stepSeed * 0.37 + sectorId) - 0.5) - 0.25) * 0.19;
    float boltOffset = (zig1 + zig2) / max(r * 2.1, 0.42);

    float perpDist = abs(localA - boltOffset) * r;
    float radialGate = smoothstep(0.18 + t * 0.24, 0.24 + t * 0.28, r) * invSmooth(hoopR + 0.03, hoopR - 0.02, r);
    float boltBreak = smoothstep(t * 0.66, t * 0.66 + 0.18, vnoise(vec2(r * 12.0, sectorId * 4.1 + stepSeed)));

    float mainBolt = exp(-sq(perpDist / 0.011)) * radialGate * boltBreak;
    float boltAura = exp(-sq(perpDist / 0.045)) * radialGate * boltBreak;

    float forkOffset = boltOffset + (mod(sectorId, 2.0) * 2.0 - 1.0) * (r - 0.34) * 0.68;
    float forkDist = abs(localA - forkOffset) * r;
    float forkBolt = exp(-sq(forkDist / 0.008)) * smoothstep(0.34, 0.40, r) * radialGate * boltBreak;

    float alive = 1.0 - pow(max(0.0, t), 2.2);
    energy = clamp(plasmaBand * erode * (0.6 + 0.5 * wNoise) + boltAura * 0.95 * alive, 0.0, 1.15);
    edge += (mainBolt * 1.35 + forkBolt * 1.05 + hoopRazor * 1.1) * alive;
    vein = clamp(hoopVein * 0.98 + boltAura * (1.0 - mainBolt * 1.4) * 0.72 * alive, 0.0, 1.0);

    float cells = 18.0;
    float idx = floor((ang + PI) / (2.0 * PI) * cells);
    float cAng = (idx + 0.5) / cells * 2.0 * PI - PI;
    float seed = hash21(vec2(idx, 6.3));
    float sPos = hoopR + (seed - 0.5) * 0.12;
    sparks = invSmooth(0.009, 0.0, abs(ang - cAng) * r)
           * invSmooth(0.058 * (1.0 - t * 0.55), 0.0, abs(r - sPos)) * alive * step(0.25, seed);
  }

  void main() {
    float t = 0.0;
    vec2 p = vec2(0.0);
    decodeAtlasCoord(gl_FragCoord.xy, uFramePx, uFrameCount, t, p);
    float borderFade = invSmooth(1.15, 1.02, max(abs(p.x), abs(p.y)));
    if (borderFade <= 0.001) { gl_FragColor = vec4(0.0); return; }

    int sid = int(uShaderId + 0.5);
    int elem = int(uElemId + 0.5);
    float energy = 0.0, edge = 0.0, vein = 0.0, sparks = 0.0;
    if (sid <= 9) vfxSolarOrMagmaNova(p, t, sid - 8, energy, edge, vein, sparks);
    else vfxThunderRadial(p, t, energy, edge, vein, sparks);

    gl_FragColor = synthesizeChiaroscuroRgba(elem, energy, edge, vein, sparks, borderFade);
  }
`;

// FAMILY 2 (shaderId 11..13): Cryo Shatter, Venom Spore-Thorn, Void Implosion
const FRAG_NOVA_COLD_SRC = SHADER_COMMON_HEADER + `
  void vfxCryoShatter(vec2 p, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x);

    float ease = 1.0 - pow(max(0.0, 1.0 - t), 3.1);
    float secSpan = PI / 4.0;
    float secId = floor((ang + PI + secSpan * 0.5) / secSpan);
    float a8 = mod(ang + PI + secSpan * 0.5, secSpan) - secSpan * 0.5;

    float isCard = 1.0 - mod(abs(secId), 2.0);
    float secJitter = hash21(vec2(secId, 2.7)) * 0.07;
    float tipR = 0.24 + ease * (0.37 + 0.085 * isCard + secJitter);
    float innerHollow = 0.19 + pow(max(0.0, t), 0.72) * 0.30;

    float radialNorm = clamp((r - innerHollow) / max(tipR - innerHollow, 0.06), 0.0, 1.15);
    float flareBase = min(radialNorm * 4.4, 1.0);
    float needleTaper = max(0.0, 1.0 - pow(max(0.0, radialNorm - 0.12) / 0.88, 0.84));
    float halfW = (0.056 + 0.016 * isCard) * flareBase * needleTaper;
    float latDist = abs(a8) * r;

    float inCrystal = invSmooth(halfW + 0.006, max(0.0, halfW - 0.005), latDist)
                    * smoothstep(innerHollow - 0.012, innerHollow + 0.022, r)
                    * invSmooth(tipR + 0.014, tipR - 0.012, r);

    float facetNoise = warpedFbm(p * 5.5 + vec2(secId * 1.7, -ease * 1.4), t * 1.8);
    float ringR = innerHollow + 0.055 + (facetNoise - 0.5) * 0.048;
    float frostCorona = invSmooth(0.054 * (1.0 - t * 0.45), 0.0, abs(r - ringR))
                      * smoothstep(innerHollow * 0.82, innerHollow * 1.08, r);

    float rawBody = clamp(max(inCrystal, frostCorona * 0.88), 0.0, 1.0);
    float erode = crescentGapErode(ang, t, facetNoise, 4.3);

    float litSide = smoothstep(-0.004, 0.008, a8 * r);
    float centerSpine = invSmooth(0.010, 0.0, latDist) * inCrystal * erode;
    float outerBevel = invSmooth(0.010, 0.0, abs(latDist - halfW)) * inCrystal * erode;
    float coronaRim = invSmooth(0.013, 0.0, abs(r - (ringR + 0.020))) * step(0.02, frostCorona) * erode;

    float alive = 1.0 - pow(max(0.0, t), 2.1);
    // CRITICAL: Gate energy by rawBody so early frames never flood the bounding square with an 8-wedge pinwheel!
    energy = clamp(rawBody * erode * (0.44 + 0.64 * litSide) * alive, 0.0, 1.1);
    edge = (centerSpine * 1.28 + outerBevel * 0.96 + coronaRim * 0.88) * (1.0 - pow(max(0.0, t), 1.7));
    vein = clamp((inCrystal * (1.0 - litSide) * (1.0 - outerBevel * 0.85) * 0.96
                + frostCorona * smoothstep(0.22, 0.62, facetNoise) * 0.68) * erode * alive, 0.0, 1.0);

    float shardSpan = 2.0 * PI / 12.0;
    float fi = floor(mod(ang - 0.20 + shardSpan * 0.5 + 2.0 * PI, 2.0 * PI) / shardSpan);
    float sa = fi * shardSpan + 0.20;
    float sr = 0.20 + ease * (0.38 + 0.16 * hash21(vec2(fi, 3.9)));
    vec2 sp = rot2(sa + t * 2.4) * (p - vec2(cos(sa), sin(sa)) * sr);
    sparks = invSmooth(0.022 * (1.0 - t * 0.55), 0.0, abs(sp.x) + abs(sp.y) * 2.0) * alive;
  }

  void vfxVenomNova(vec2 p, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x);

    float impEnv = 1.0 - smoothstep(0.0, 0.22, t);
    if (impEnv > 0.0) {
      float thornStar = invSmooth(0.024, 0.0, abs(sin(ang * 3.0 + 0.4)) * r) * invSmooth(0.54, 0.0, r);
      edge += (thornStar + exp(-r * 26.0)) * impEnv * 1.25;
    }

    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.75);
    float petalWave = cos(ang * 6.0 - ease * 1.8) * 0.042;
    float ringR = 0.16 + ease * 0.52 + petalWave;
    float wNoise = warpedFbm(vec2(ang * 4.5 - t * 1.6, r * 6.8 - ease * 5.2), t * 3.2);

    float dr = r - (ringR + (wNoise - 0.5) * 0.074);
    float hollowGate = smoothstep(ringR * 0.46, ringR * 0.72, r);
    float corona = (dr > 0.0
      ? 1.0 - smoothstep(0.0, 0.022 * (1.0 - t * 0.35), dr)
      : 1.0 - smoothstep(0.0, (0.18 + 0.11 * wNoise) * (1.0 - t * 0.46), -dr))
      * hollowGate;

    float erode = crescentGapErode(ang, t, wNoise, 2.4);
    energy = corona * erode * (0.60 + 0.65 * wNoise);
    vein = invSmooth(0.068, 0.011, abs(dr + 0.044)) * hollowGate * erode * smoothstep(0.20, 0.60, wNoise) * (1.0 - t * 0.56);
    edge += invSmooth(0.016, 0.0, abs(dr - 0.002)) * hollowGate * erode * (1.0 - pow(max(0.0, t), 1.6)) * 1.22;

    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, 18.0, 7.7, 0.16, ease * 0.56,
      0.074 * (1.0 - t * 0.52), 0.013, 1.0, 1.0 - t * 0.78,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);
  }

  void vfxVoidImplosion(vec2 p, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x);

    if (t < 0.36) {
      float it = t / 0.36;
      float pullR = mix(0.72, 0.18, pow(max(0.0, it), 0.85));
      float spiral = sin(4.0 * ang + 8.5 * log(r + 0.09) - it * 10.0);
      float turb = warpedFbm(vec2(ang * 3.2 - it * 4.0, r * 6.0 + it * 5.0), it * 3.0);

      float band = invSmooth(pullR + 0.05, pullR - 0.18, r) * smoothstep(0.10, 0.22, r);
      float arms = smoothstep(0.12, 0.86, spiral * 0.5 + 0.5) * band * (0.55 + 0.65 * turb);

      float horizon = exp(-sq((r - 0.17) / 0.075));
      float horizonRim = invSmooth(0.018, 0.0, abs(r - 0.22));

      energy = clamp(arms * 1.1 + horizonRim, 0.0, 1.1);
      edge = horizonRim * 1.25 + arms * smoothstep(0.68, 0.95, turb) * 0.65;
      vein = clamp(horizon * 1.1 + band * (1.0 - arms) * 0.78, 0.0, 1.0);
    } else {
      float ot = (t - 0.36) / 0.64;
      float ease = 1.0 - pow(max(0.0, 1.0 - ot), 2.6);
      float ringR = 0.16 + ease * 0.545;
      float wNoise = warpedFbm(vec2(ang * 5.0 - ot * 1.4, r * 7.0 - ease * 5.5), ot * 3.4);

      float warpedR = ringR + (wNoise - 0.5) * 0.072;
      float dr = r - warpedR;
      float outerW = 0.024 * (1.0 - ot * 0.38);
      float innerW = (0.16 + 0.11 * wNoise) * (1.0 - ot * 0.50);
      float hollowGate = smoothstep(ringR * 0.46, ringR * 0.70, r);
      float corona = (dr > 0.0
        ? 1.0 - smoothstep(0.0, max(0.004, outerW), dr)
        : 1.0 - smoothstep(0.0, max(0.006, innerW), -dr)) * hollowGate;

      float erode = crescentGapErode(ang, ot, wNoise, 5.2);
      energy = corona * erode * (0.58 + 0.65 * wNoise);

      vein = invSmooth(0.068, 0.012, abs(dr + 0.042)) * hollowGate * erode * smoothstep(0.22, 0.62, wNoise) * (1.0 - ot * 0.58);
      float innerVoidCrest = invSmooth(0.013, 0.0, abs(r - (ringR * 0.76 + (0.5 - wNoise) * 0.034))) * hollowGate * erode * (1.0 - pow(max(0.0, ot), 1.45));
      edge = invSmooth(0.017, 0.0, abs(dr - 0.002)) * hollowGate * erode * (1.0 - pow(max(0.0, ot), 1.55)) * 1.24 + innerVoidCrest * 0.74;
      energy += innerVoidCrest * 0.34;

      float sparkInk = 0.0;
      radialDaggerSparks(
        r, ang, 16.0, 4.9, 0.16, ease * 0.56,
        0.075 * (1.0 - ot * 0.54), 0.012, 1.0, 1.0 - ot * 0.78,
        sparks, sparkInk
      );
      vein = max(vein, sparkInk);
    }
  }

  void main() {
    float t = 0.0;
    vec2 p = vec2(0.0);
    decodeAtlasCoord(gl_FragCoord.xy, uFramePx, uFrameCount, t, p);
    float borderFade = invSmooth(1.15, 1.02, max(abs(p.x), abs(p.y)));
    if (borderFade <= 0.001) { gl_FragColor = vec4(0.0); return; }

    int sid = int(uShaderId + 0.5);
    int elem = int(uElemId + 0.5);
    float energy = 0.0, edge = 0.0, vein = 0.0, sparks = 0.0;
    if (sid == 11) vfxCryoShatter(p, t, energy, edge, vein, sparks);
    else if (sid == 12) vfxVenomNova(p, t, energy, edge, vein, sparks);
    else vfxVoidImplosion(p, t, energy, edge, vein, sparks);

    gl_FragColor = synthesizeChiaroscuroRgba(elem, energy, edge, vein, sparks, borderFade);
  }
`;

// FAMILY 3 (shaderId 14..18): Wind Hurricane Vortex, Botanical Briar Lotus, Bio-Caustic Spore Cloud, Sky-Anvil Storm Grid, Volcanic Star-Geyser
const FRAG_ARCHETYPE_NATURE_WIND_SRC = SHADER_COMMON_HEADER + `
  void vfxVortexGale(vec2 p, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x + 1e-6);
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.65);

    float innerEye = 0.16 + t * 0.24;
    float outerR = 0.28 + ease * 0.50;
    float radialGate = smoothstep(innerEye, innerEye + 0.08, r) * invSmooth(outerR + 0.04, outerR - 0.08, r);

    // 4-arm logarithmic hurricane turbine scythes
    float logR = log(max(r, 0.05));
    float spin = ang * (2.0 / PI) + logR * 1.55 - t * 3.2;
    float armPhase = fract(spin);
    float wNoise = warpedFbm(vec2(ang * 3.0 - t * 4.5, r * 6.5 - ease * 4.0), t * 3.6);

    float blade = smoothstep(0.05, 0.22, armPhase) * invSmooth(0.66 - t * 0.18, 0.24, armPhase) * radialGate;
    float erode = smoothstep(max(0.0, (t - 0.34) * 1.15), max(0.02, (t - 0.34) * 1.15 + 0.18), wNoise * 0.65 + blade * 0.55);

    float leadScythe = invSmooth(0.075, 0.0, abs(armPhase - 0.20)) * radialGate * erode;
    float innerShear = invSmooth(0.020, 0.0, abs(r - (innerEye + 0.035))) * erode * (1.0 - pow(max(0.0, t), 1.6));
    float alive = 1.0 - pow(max(0.0, t), 2.15);

    energy = clamp(blade * erode * (0.58 + 0.64 * wNoise) + innerShear * 0.45, 0.0, 1.12) * alive;
    vein = invSmooth(0.14, 0.02, abs(armPhase - 0.42)) * radialGate * erode * smoothstep(0.22, 0.66, wNoise) * (1.0 - t * 0.52);
    edge = (leadScythe * 1.32 + innerShear * 0.92) * (1.0 - pow(max(0.0, t), 1.65));

    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang + logR * 0.65, 16.0, 14.3, 0.18, ease * 0.58,
      0.086 * (1.0 - t * 0.48), 0.011, 1.0, 1.0 - t * 0.76,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);
  }

  void vfxBloomBriar(vec2 p, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x + 1e-6);
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.8);

    // 6 unfurling pointed botanical lotus petals + central midrib + interleaved hooked briar thorns
    float secSpan = PI / 3.0;
    float secId = floor((ang + PI + secSpan * 0.5) / secSpan);
    float localA = mod(ang + PI + secSpan * 0.5, secSpan) - secSpan * 0.5;
    float curlA = localA + sin(r * 5.5 - ease * 2.4) * 0.07 * (mod(secId, 2.0) * 2.0 - 1.0);

    float innerCup = 0.15 + pow(max(0.0, t), 0.78) * 0.25;
    float tipR = 0.26 + ease * (0.48 + 0.04 * mod(secId, 2.0));
    float uRad = clamp((r - innerCup) / max(0.06, tipR - innerCup), 0.0, 1.15);

    // Ogival pointed lotus petal width profile
    float petalArch = sin(clamp(uRad, 0.0, 1.0) * PI);
    float halfW = 0.115 * pow(max(0.0, petalArch), 0.72) * (1.0 - t * 0.22);
    float lat = abs(curlA) * r;
    float inPetal = invSmooth(halfW + 0.008, max(0.0, halfW - 0.012), lat)
                  * smoothstep(innerCup - 0.01, innerCup + 0.03, r)
                  * invSmooth(tipR + 0.015, tipR - 0.015, r);

    // Interleaved hooked briar thorn between petals
    float thornA = mod(ang + PI, secSpan) - secSpan * 0.5;
    float hookA = thornA - (r - 0.24) * 0.55;
    float thornTip = 0.22 + ease * 0.52;
    float thornW = 0.026 * max(0.0, 1.0 - clamp((r - innerCup) / max(0.06, thornTip - innerCup), 0.0, 1.0));
    float inThorn = invSmooth(thornW + 0.004, 0.0, abs(hookA) * r)
                  * smoothstep(innerCup, innerCup + 0.04, r)
                  * invSmooth(thornTip + 0.01, thornTip - 0.02, r);

    float wNoise = warpedFbm(p * 5.2 + vec2(secId * 1.3, -ease * 1.8), t * 2.4);
    float erode = crescentGapErode(ang, t, wNoise, 1.7);
    float midrib = invSmooth(0.010, 0.0, lat) * inPetal * erode;
    float petalRim = invSmooth(0.012, 0.0, abs(lat - halfW * 0.92)) * inPetal * erode;
    float alive = 1.0 - pow(max(0.0, t), 2.1);

    float body = clamp(max(inPetal * (0.56 + 0.54 * wNoise), inThorn * 0.95), 0.0, 1.0);
    energy = body * erode * alive;
    vein = clamp((inPetal * invSmooth(halfW * 0.72, halfW * 0.22, lat) * (1.0 - midrib) * 0.82 + inThorn * 0.45) * erode * alive, 0.0, 1.0);
    edge = (petalRim * 1.18 + midrib * 1.10 + inThorn * 0.92) * (1.0 - pow(max(0.0, t), 1.65));

    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, 12.0, 15.7, 0.18, ease * 0.56,
      0.064 * (1.0 - t * 0.45), 0.015, 1.0, 1.0 - t * 0.75,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);
  }

  void vfxSporeCloud(vec2 p, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x + 1e-6);
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.5);

    // 7 asymmetric bursting bio-caustic spore vesicles around a clearing hollow center
    float podSpan = 2.0 * PI / 7.0;
    float podId = floor(mod(ang + PI + podSpan * 0.5, 2.0 * PI) / podSpan);
    float seed = hash21(vec2(podId, 16.4));
    float podAng = podId * podSpan - PI + (seed - 0.5) * 0.22;
    float podDist = 0.16 + ease * (0.34 + 0.16 * seed);
    vec2 podC = vec2(cos(podAng), sin(podAng)) * podDist;
    float podR = (0.14 + 0.07 * seed) * (0.65 + 0.45 * ease) * (1.0 - t * 0.22);

    float dPod = length(p - podC);
    float wNoise = warpedFbm(p * 6.4 - vec2(cos(podAng), sin(podAng)) * ease * 2.5, t * 3.0);
    float dr = dPod - (podR + (wNoise - 0.5) * 0.055);

    // Hollow ruptured bio-vesicle crescent facing outward
    float outwardBias = smoothstep(-0.06, 0.08, dot(p - podC, vec2(cos(podAng), sin(podAng))));
    float vesicleShell = invSmooth(0.075, 0.008, abs(dr + 0.026)) * (0.38 + 0.62 * outwardBias);
    float hollowCenter = smoothstep(0.12 + t * 0.18, 0.22 + t * 0.22, r);
    float erode = smoothstep(max(0.0, (t - 0.30) * 1.15), max(0.02, (t - 0.30) * 1.15 + 0.18), wNoise * 0.72 + outwardBias * 0.38);

    float alive = 1.0 - pow(max(0.0, t), 2.15);
    energy = clamp(vesicleShell * hollowCenter * erode * (0.64 + 0.62 * wNoise), 0.0, 1.12) * alive;
    vein = invSmooth(0.052, 0.008, abs(dr + 0.044)) * hollowCenter * erode * smoothstep(0.20, 0.64, wNoise) * (1.0 - t * 0.48);
    edge = invSmooth(0.016, 0.0, abs(dr + 0.003)) * outwardBias * hollowCenter * erode * (1.0 - pow(max(0.0, t), 1.65)) * 1.26;

    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, 14.0, 16.9, 0.16, ease * 0.58,
      0.058 * (1.0 - t * 0.48), 0.016, 1.0, 1.0 - t * 0.76,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);
  }

  void vfxAnvilStorm(vec2 p, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x + 1e-6);
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 3.0);

    // Octagonal Faraday EMP perimeter + 8-way sky-anvil lightning crossbars
    float octSpan = PI / 4.0;
    float secId = floor((ang + PI + octSpan * 0.5) / octSpan);
    float localOct = mod(ang + PI + octSpan * 0.5, octSpan) - octSpan * 0.5;
    float polyDist = r * cos(localOct) / cos(octSpan * 0.5);

    float targetPolyR = 0.18 + ease * 0.56;
    float stepSeed = floor(t * 12.0);
    float wNoise = warpedFbm(p * 5.8 + vec2(stepSeed * 0.7, -ease * 3.0), t * 3.8);
    float erode = crescentGapErode(ang, t, wNoise, 3.8);

    float dOct = polyDist - targetPolyR;
    float outerOct = invSmooth(0.058 * (1.0 - t * 0.35), 0.0, abs(dOct + 0.018)) * smoothstep(targetPolyR * 0.5, targetPolyR * 0.75, polyDist);
    float innerOct = invSmooth(0.022, 0.0, abs(polyDist - targetPolyR * 0.68)) * (1.0 - t * 0.65);

    // 8 jagged lightning anvil spokes aligned to octagon vertices
    float vertexA = mod(ang + PI, octSpan) - octSpan * 0.5;
    float zig = (abs(fract(r * 9.0 + hash21(vec2(secId, stepSeed)) * 2.0) - 0.5) - 0.25) * 0.22 / max(r * 1.8, 0.36);
    float spokeDist = abs(vertexA - zig) * r;
    float spokeGate = smoothstep(0.14 + t * 0.22, 0.22 + t * 0.26, r) * invSmooth(targetPolyR + 0.05, targetPolyR - 0.02, polyDist);
    float boltCore = exp(-sq(spokeDist / 0.011)) * spokeGate;
    float boltSheath = exp(-sq(spokeDist / 0.038)) * spokeGate;

    float alive = 1.0 - pow(max(0.0, t), 2.15);
    energy = clamp((outerOct * (0.62 + 0.52 * wNoise) + innerOct * 0.65 + boltSheath * 0.92) * erode, 0.0, 1.15) * alive;
    vein = clamp((invSmooth(0.038, 0.006, abs(dOct + 0.036)) * outerOct + boltSheath * (1.0 - boltCore) * 0.78) * erode * alive, 0.0, 1.0);
    edge = (invSmooth(0.014, 0.0, abs(dOct)) * erode * 1.24 + boltCore * erode * 1.38 + innerOct * erode * 0.85) * (1.0 - pow(max(0.0, t), 1.7));

    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, 16.0, 17.5, 0.18, ease * 0.58,
      0.072 * (1.0 - t * 0.50), 0.011, 1.0, 1.0 - t * 0.78,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);
  }

  void vfxGeyserPlume(vec2 p, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x + 1e-6);
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.9);

    // 5-point volcanic star-crater tectonic fracture + erupting molten lava fangs
    float secSpan = 2.0 * PI / 5.0;
    float secId = floor((ang + PI + secSpan * 0.5) / secSpan);
    float a5 = mod(ang + PI + secSpan * 0.5, secSpan) - secSpan * 0.5;
    float fangProfile = pow(max(0.0, cos(a5 / (secSpan * 0.5) * 0.5 * PI)), 1.55);

    float wNoise = warpedFbm(vec2(ang * 5.0 + secId, r * 6.8 - ease * 5.4), t * 3.5);
    float starR = 0.18 + ease * (0.30 + 0.28 * fangProfile) + (wNoise - 0.5) * 0.068;
    float innerCrater = 0.14 + t * 0.24;

    float dr = r - starR;
    float inPlume = (dr > 0.0
      ? 1.0 - smoothstep(0.0, 0.022, dr)
      : 1.0 - smoothstep(0.0, (0.19 + 0.12 * fangProfile) * (1.0 - t * 0.42), -dr))
      * smoothstep(innerCrater, innerCrater + 0.07, r);

    float fissureSpine = invSmooth(0.016, 0.0, abs(a5) * r)
                       * smoothstep(innerCrater * 0.85, innerCrater + 0.04, r)
                       * invSmooth(starR + 0.02, starR - 0.05, r);
    float erode = crescentGapErode(ang, t, wNoise, 2.1);
    float alive = 1.0 - pow(max(0.0, t), 2.1);

    energy = clamp((inPlume * (0.60 + 0.66 * wNoise) + fissureSpine * 0.65) * erode, 0.0, 1.15) * alive;
    vein = clamp(invSmooth(0.078, 0.010, abs(dr + 0.052)) * inPlume * erode * smoothstep(0.16, 0.58, wNoise) * (1.0 - t * 0.45), 0.0, 1.0);
    edge = (invSmooth(0.016, 0.0, abs(dr)) * inPlume * 1.24 + fissureSpine * 1.22) * erode * (1.0 - pow(max(0.0, t), 1.65));

    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, 15.0, 18.2, 0.16, ease * 0.60,
      0.084 * (1.0 - t * 0.50), 0.014, 1.0, 1.0 - t * 0.76,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);
  }

  void main() {
    float t = 0.0;
    vec2 p = vec2(0.0);
    decodeAtlasCoord(gl_FragCoord.xy, uFramePx, uFrameCount, t, p);
    float borderFade = invSmooth(1.15, 1.02, max(abs(p.x), abs(p.y)));
    if (borderFade <= 0.001) { gl_FragColor = vec4(0.0); return; }

    int sid = int(uShaderId + 0.5);
    int elem = int(uElemId + 0.5);
    float energy = 0.0, edge = 0.0, vein = 0.0, sparks = 0.0;
    if (sid == 14) vfxVortexGale(p, t, energy, edge, vein, sparks);
    else if (sid == 15) vfxBloomBriar(p, t, energy, edge, vein, sparks);
    else if (sid == 16) vfxSporeCloud(p, t, energy, edge, vein, sparks);
    else if (sid == 17) vfxAnvilStorm(p, t, energy, edge, vein, sparks);
    else vfxGeyserPlume(p, t, energy, edge, vein, sparks);

    gl_FragColor = synthesizeChiaroscuroRgba(elem, energy, edge, vein, sparks, borderFade);
  }
`;

// FAMILY 4 (shaderId 19..23): Ballistic Shrapnel Starburst, Vanguard Aegis Shield-Crest, Ranger Falcon Sonic Chevron, Elementalist Arcane Hexagram, Arcane Cast Muzzle
const FRAG_ARCHETYPE_TACTICAL_CLASS_SRC = SHADER_COMMON_HEADER + `
  void vfxShrapnelCorona(vec2 p, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x + 1e-6);
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 3.15);

    // 12 asymmetric high-velocity ballistic flechette spears with gunpowder smoke wakes (zero continuous ring!)
    float secSpan = PI / 6.0;
    float secId = floor((ang + PI + secSpan * 0.5) / secSpan);
    float localA = mod(ang + PI + secSpan * 0.5, secSpan) - secSpan * 0.5;
    float seed = hash21(vec2(secId, 19.3));

    float tailR = 0.14 + t * (0.28 + 0.08 * seed);
    float tipR = 0.28 + ease * (0.36 + 0.15 * seed);
    float uSpear = clamp((r - tailR) / max(0.05, tipR - tailR), 0.0, 1.15);
    float spearW = (0.036 + 0.014 * mod(secId, 2.0)) * sin(clamp(uSpear, 0.0, 1.0) * PI) * (1.0 - t * 0.28);
    float lat = abs(localA + (seed - 0.5) * 0.05) * r;

    float inSpear = invSmooth(spearW + 0.005, max(0.0, spearW - 0.006), lat)
                  * smoothstep(tailR - 0.01, tailR + 0.03, r)
                  * invSmooth(tipR + 0.012, tipR - 0.012, r);

    float wNoise = warpedFbm(vec2(ang * 6.0, r * 8.0 - ease * 6.5), t * 3.8);
    float impBlast = (1.0 - smoothstep(0.0, 0.22, t)) * invSmooth(0.28, 0.06, r) * smoothstep(0.04, 0.11, r);
    float spearCore = invSmooth(0.008, 0.0, lat) * inSpear * smoothstep(0.35, 0.85, uSpear);
    float alive = 1.0 - pow(max(0.0, t), 2.05);

    energy = clamp((inSpear * (0.64 + 0.56 * wNoise) + impBlast * 0.85), 0.0, 1.15) * alive;
    vein = clamp(inSpear * (1.0 - spearCore) * invSmooth(0.62, 0.12, uSpear) * 0.86 * alive, 0.0, 1.0);
    edge = (spearCore * 1.42 + invSmooth(0.010, 0.0, abs(lat - spearW * 0.9)) * inSpear * 0.95 + impBlast * 1.1) * (1.0 - pow(max(0.0, t), 1.65));

    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, 18.0, 19.8, 0.20, ease * 0.58,
      0.088 * (1.0 - t * 0.45), 0.011, 1.0, 1.0 - t * 0.75,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);
  }

  void vfxAegisCrest(vec2 rp, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.9);

    // Directional +X Armored Hex-Phalanx Shield Chevron & Kinetic Shock-Ram
    float prowX = 0.16 + ease * 0.58;
    float absY = abs(rp.y);
    // 3-panel faceted tower-shield profile: flat reinforced nose + 42-degree swept flank plates
    float shieldFrontX = prowX - max(0.0, absY - 0.16) * 0.92 - absY * 0.18;
    float dx = rp.x - shieldFrontX;
    float inSpanY = invSmooth(0.70, 0.54, absY);

    float wNoise = warpedFbm(vec2(rp.x * 5.5 - ease * 4.5, rp.y * 6.5), t * 3.0);
    float plateThick = (0.20 - t * 0.07) * inSpanY;
    float inPlate = (dx > 0.0
      ? 1.0 - smoothstep(0.0, 0.024, dx)
      : 1.0 - smoothstep(0.0, max(0.01, plateThick), -dx)) * inSpanY;

    // Panel seam lines at |y| = 0.16 and |y| = 0.40 for armored phalanx plates
    float seam = (invSmooth(0.018, 0.003, abs(absY - 0.16)) + invSmooth(0.018, 0.003, abs(absY - 0.40))) * inPlate;
    float echoWave = invSmooth(0.020, 0.0, abs(dx + plateThick * 0.62)) * inSpanY;
    float erode = smoothstep(max(0.0, (t - 0.36) * 1.25), max(0.02, (t - 0.36) * 1.25 + 0.18), wNoise * 0.65 + inPlate * 0.55);
    float alive = 1.0 - pow(max(0.0, t), 2.1);

    energy = clamp((inPlate * (0.66 + 0.48 * wNoise) + echoWave * 0.72) * erode, 0.0, 1.15) * alive;
    vein = clamp((seam * 0.92 + invSmooth(0.055, 0.010, abs(dx + 0.052)) * inPlate * 0.78) * erode * alive, 0.0, 1.0);
    edge = (invSmooth(0.018, 0.0, abs(dx)) * inSpanY * 1.35 + echoWave * 0.95) * erode * (1.0 - pow(max(0.0, t), 1.65));

    float r = length(rp);
    float ang = atan(rp.y, rp.x + 1e-6);
    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, 16.0, 20.4, 0.20, ease * 0.56,
      0.076 * (1.0 - t * 0.48), 0.013, step(abs(ang), 1.15), 1.0 - t * 0.78,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);
  }

  void vfxFalconSonic(vec2 rp, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 3.1);

    // Directional +X Raptor Wing-V Double Mach Boom + Piercing Sniper Arrow Spine
    float headX = 0.12 + ease * 0.66;
    float absY = abs(rp.y);
    float wingSpan = invSmooth(0.72, 0.52, absY);

    float wing1X = headX - absY * 1.05 - sq(absY) * 0.38;
    float wing2X = (headX - 0.22) - absY * 0.92 - sq(absY) * 0.30;
    float dW1 = abs(rp.x - wing1X);
    float dW2 = abs(rp.x - wing2X);

    float wNoise = warpedFbm(vec2(rp.x * 5.0 - ease * 5.5, rp.y * 7.0), t * 3.5);
    float wing1 = invSmooth(0.085 * (1.0 - t * 0.32), 0.0, dW1) * wingSpan * step(rp.x, wing1X + 0.03);
    float wing2 = invSmooth(0.055 * (1.0 - t * 0.38), 0.0, dW2) * invSmooth(0.54, 0.38, absY);

    // Central piercing sniper arrow shaft + 4-point hawk-eye tip star
    float arrowShaft = exp(-sq(absY / 0.016)) * smoothstep(-0.52 + t * 0.35, -0.30 + t * 0.35, rp.x) * invSmooth(headX + 0.04, headX - 0.02, rp.x);
    vec2 tipP = rp - vec2(headX - 0.02, 0.0);
    float tipStar = (exp(-abs(tipP.y) * 62.0) * exp(-abs(tipP.x) * 6.0) + exp(-abs(tipP.x) * 62.0) * exp(-abs(tipP.y) * 6.5))
                  * (1.0 - pow(max(0.0, t), 1.5));

    float erode = smoothstep(max(0.0, (t - 0.34) * 1.2), max(0.02, (t - 0.34) * 1.2 + 0.18), wNoise * 0.62 + max(wing1, wing2) * 0.55);
    float alive = 1.0 - pow(max(0.0, t), 2.1);

    energy = clamp(((wing1 + wing2 * 0.82) * (0.62 + 0.55 * wNoise) + arrowShaft * 0.95) * erode, 0.0, 1.15) * alive;
    vein = clamp((invSmooth(0.045, 0.008, abs(rp.x - (wing1X - 0.042))) * wingSpan * 0.85) * erode * alive, 0.0, 1.0);
    edge = (invSmooth(0.016, 0.0, dW1) * wingSpan * 1.32 + invSmooth(0.013, 0.0, dW2) * wingSpan * 0.95 + arrowShaft * 1.38 + tipStar * 1.25)
         * erode * (1.0 - pow(max(0.0, t), 1.65));

    float r = length(rp);
    float ang = atan(rp.y, rp.x + 1e-6);
    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, 14.0, 21.2, 0.18, ease * 0.58,
      0.085 * (1.0 - t * 0.45), 0.010, step(abs(ang), 0.95), 1.0 - t * 0.75,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);
  }

  float sdEquilateralRim(vec2 p, float rad) {
    float a = atan(p.y, p.x + 1e-6);
    float span = 2.0 * PI / 3.0;
    float localA = mod(a + PI + span * 0.5, span) - span * 0.5;
    float polyR = length(p) * cos(localA) / cos(span * 0.5);
    return abs(polyR - rad);
  }

  void vfxArcaneSigil(vec2 p, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    float r = length(p);
    float ang = atan(p.y, p.x + 1e-6);
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.85);

    // Inscribed Sacred-Geometry Twin Hexagram + 12-Glyph Outer Rune Ring
    float sigilR = 0.20 + ease * 0.54;
    vec2 pA = rot2(t * 0.85) * p;
    vec2 pB = rot2(-t * 0.85 + PI / 3.0) * p;
    float triA = invSmooth(0.032, 0.0, sdEquilateralRim(pA, sigilR * 0.54));
    float triB = invSmooth(0.032, 0.0, sdEquilateralRim(pB, sigilR * 0.54));
    float hexagram = max(triA, triB) * smoothstep(sigilR * 0.24, sigilR * 0.34, r);

    float outerRing = invSmooth(0.048 * (1.0 - t * 0.28), 0.0, abs(r - sigilR));
    float innerRing = invSmooth(0.022, 0.0, abs(r - sigilR * 0.82));

    // 12 radial arcane rune ticks between innerRing and outerRing
    float tickSpan = PI / 6.0;
    float tickA = mod(ang + PI + tickSpan * 0.5, tickSpan) - tickSpan * 0.5;
    float runeTicks = invSmooth(0.014, 0.0, abs(tickA) * r)
                    * smoothstep(sigilR * 0.80, sigilR * 0.84, r)
                    * invSmooth(sigilR * 1.02, sigilR * 0.98, r);

    float wNoise = warpedFbm(p * 5.4 + vec2(t * 1.5, -t * 1.5), t * 2.8);
    float erode = crescentGapErode(ang, t, wNoise, 4.9);
    float rawSigil = clamp(max(max(outerRing, innerRing * 0.85), max(hexagram * 0.95, runeTicks)), 0.0, 1.0);
    float alive = 1.0 - pow(max(0.0, t), 2.15);

    energy = rawSigil * erode * (0.68 + 0.45 * wNoise) * alive;
    vein = clamp((invSmooth(0.034, 0.006, abs(r - (sigilR - 0.032))) + hexagram * 0.35) * erode * alive, 0.0, 1.0);
    edge = (invSmooth(0.013, 0.0, abs(r - sigilR)) * 1.28 + hexagram * 1.15 + runeTicks * 1.20) * erode * (1.0 - pow(max(0.0, t), 1.7));

    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, 12.0, 22.6, 0.20, ease * 0.56,
      0.068 * (1.0 - t * 0.48), 0.014, 1.0, 1.0 - t * 0.76,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);
  }

  void vfxMuzzleArcane(vec2 rp, float t, out float energy, out float edge, out float vein, out float sparks) {
    energy = 0.0; edge = 0.0; vein = 0.0; sparks = 0.0;
    vec2 mp = rp - vec2(-0.24, 0.0);
    float r = length(mp);
    float ang = atan(mp.y, mp.x + 1e-6);
    float ease = 1.0 - pow(max(0.0, 1.0 - t), 2.9);

    // 4-point crystalline mana-star + twin counter-curling arcane wisp crescents (tintable for staves/bows/bio/lasers)
    float starEnv = 1.0 - pow(max(0.0, t), 1.45);
    float manaStar = (exp(-abs(mp.y) * 44.0) * smoothstep(-0.18, 0.02, mp.x) * invSmooth(0.96, 0.04, mp.x)
                    + exp(-abs(mp.x - 0.06) * 42.0) * invSmooth(0.58, 0.02, abs(mp.y))) * starEnv;

    float arcR = 0.16 + ease * 0.48;
    float inFront = invSmooth(1.35, 0.35, abs(ang));
    float wisp = invSmooth(0.055 * (1.0 - t * 0.35), 0.0, abs(r - arcR)) * inFront;
    float wNoise = warpedFbm(mp * 6.0 - vec2(ease * 4.0, 0.0), t * 3.6);
    float erode = smoothstep(max(0.0, (t - 0.30) * 1.25), max(0.02, (t - 0.30) * 1.25 + 0.20), wNoise * 0.68 + wisp * 0.52);

    float alive = 1.0 - pow(max(0.0, t), 2.1);
    energy = clamp((wisp * erode * (0.68 + 0.48 * wNoise) + manaStar * 0.92), 0.0, 1.15) * alive;
    vein = clamp(invSmooth(0.044, 0.008, abs(r - (arcR - 0.036))) * inFront * erode * (1.0 - manaStar) * 0.85 * alive, 0.0, 1.0);
    edge = (manaStar * 1.45 + invSmooth(0.015, 0.0, abs(r - arcR)) * inFront * erode * 1.20) * (1.0 - pow(max(0.0, t), 1.6));

    float sparkInk = 0.0;
    radialDaggerSparks(
      r, ang, 12.0, 23.4, 0.14, ease * 0.54,
      0.075 * (1.0 - t * 0.48), 0.014, step(abs(ang), 1.05), 1.0 - t * 0.78,
      sparks, sparkInk
    );
    vein = max(vein, sparkInk);
  }

  void main() {
    float t = 0.0;
    vec2 p = vec2(0.0);
    decodeAtlasCoord(gl_FragCoord.xy, uFramePx, uFrameCount, t, p);
    float borderFade = invSmooth(1.15, 1.02, max(abs(p.x), abs(p.y)));
    if (borderFade <= 0.001) { gl_FragColor = vec4(0.0); return; }

    int sid = int(uShaderId + 0.5);
    int elem = int(uElemId + 0.5);
    float energy = 0.0, edge = 0.0, vein = 0.0, sparks = 0.0;
    if (sid == 19) vfxShrapnelCorona(p, t, energy, edge, vein, sparks);
    else if (sid == 20) vfxAegisCrest(p, t, energy, edge, vein, sparks);
    else if (sid == 21) vfxFalconSonic(p, t, energy, edge, vein, sparks);
    else if (sid == 22) vfxArcaneSigil(p, t, energy, edge, vein, sparks);
    else vfxMuzzleArcane(p, t, energy, edge, vein, sparks);

    gl_FragColor = synthesizeChiaroscuroRgba(elem, energy, edge, vein, sparks, borderFade);
  }
`;

let lastBakeUsedWebGL = false;

export function wasLastShaderBakeWebGL(): boolean {
  return lastBakeUsedWebGL;
}

interface CompiledGlFamilyProgram {
  program: WebGLProgram;
  aPos: number;
  uFramePx: WebGLUniformLocation | null;
  uFrameCount: WebGLUniformLocation | null;
  uShaderId: WebGLUniformLocation | null;
  uElemId: WebGLUniformLocation | null;
}

interface CompiledGlBaker {
  glCanvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  programs: readonly [
    CompiledGlFamilyProgram,
    CompiledGlFamilyProgram,
    CompiledGlFamilyProgram,
    CompiledGlFamilyProgram,
    CompiledGlFamilyProgram,
  ];
  vbo: WebGLBuffer;
}

function startCompileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  return sh;
}

function createOffscreenGlBaker(): CompiledGlBaker | null {
  if (typeof document === 'undefined') return null;
  const glCanvas = document.createElement('canvas');
  glCanvas.width = 256;
  glCanvas.height = 256;
  const gl = (glCanvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
  }) ||
    glCanvas.getContext('experimental-webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
    })) as WebGLRenderingContext | null;
  if (!gl) return null;

  // Kick off all shader compiles & program links BEFORE querying status so ANGLE/GPU threads compile in parallel
  const vs = startCompileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
  const fragSources = [
    FRAG_DIRECTIONAL_SRC,
    FRAG_NOVA_HOT_SRC,
    FRAG_NOVA_COLD_SRC,
    FRAG_ARCHETYPE_NATURE_WIND_SRC,
    FRAG_ARCHETYPE_TACTICAL_CLASS_SRC,
  ] as const;
  const fsList = fragSources.map((src) => startCompileShader(gl, gl.FRAGMENT_SHADER, src));
  if (!vs || fsList.some((fs) => !fs)) {
    if (vs) gl.deleteShader(vs);
    for (const fs of fsList) if (fs) gl.deleteShader(fs);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }

  const rawPrograms: WebGLProgram[] = [];
  for (const fs of fsList) {
    const prog = gl.createProgram();
    if (!prog || !fs) {
      for (const p of rawPrograms) gl.deleteProgram(p);
      gl.deleteShader(vs);
      for (const f of fsList) if (f) gl.deleteShader(f);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return null;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    rawPrograms.push(prog);
  }

  // Now check compile/link status after parallel compilation finishes
  const vsOk = Boolean(gl.getShaderParameter(vs, gl.COMPILE_STATUS));
  const fsOk = fsList.every((fs) => fs && Boolean(gl.getShaderParameter(fs, gl.COMPILE_STATUS)));
  const linkOk =
    vsOk &&
    fsOk &&
    rawPrograms.every((prog) => Boolean(gl.getProgramParameter(prog, gl.LINK_STATUS)));

  gl.deleteShader(vs);
  for (const fs of fsList) if (fs) gl.deleteShader(fs);

  if (!linkOk || rawPrograms.length !== 5) {
    for (const prog of rawPrograms) gl.deleteProgram(prog);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }

  const vbo = gl.createBuffer();
  if (!vbo) {
    for (const prog of rawPrograms) gl.deleteProgram(prog);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  const buildFamily = (program: WebGLProgram): CompiledGlFamilyProgram => ({
    program,
    aPos: gl.getAttribLocation(program, 'aPos'),
    uFramePx: gl.getUniformLocation(program, 'uFramePx'),
    uFrameCount: gl.getUniformLocation(program, 'uFrameCount'),
    uShaderId: gl.getUniformLocation(program, 'uShaderId'),
    uElemId: gl.getUniformLocation(program, 'uElemId'),
  });

  return {
    glCanvas,
    gl,
    programs: [
      buildFamily(rawPrograms[0]!),
      buildFamily(rawPrograms[1]!),
      buildFamily(rawPrograms[2]!),
      buildFamily(rawPrograms[3]!),
      buildFamily(rawPrograms[4]!),
    ],
    vbo,
  };
}

function destroyOffscreenGlBaker(baker: CompiledGlBaker): void {
  const { gl, programs, vbo, glCanvas } = baker;
  gl.deleteBuffer(vbo);
  for (const fam of programs) {
    gl.deleteProgram(fam.program);
  }
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  glCanvas.width = 1;
  glCanvas.height = 1;
}

function drawFallback2DStrip(
  ctx: CanvasRenderingContext2D,
  entry: ShaderStripEntry,
  framePx: number,
  frameCount: number,
): void {
  const rHit = SHADER_CANONICAL_HITBOX_RADIUS_RATIO * framePx;
  for (let f = 0; f < frameCount; f++) {
    const t = f / Math.max(1, frameCount - 1);
    const ease = 1 - Math.pow(1 - t, 2.7);
    const col = f % SHADER_ATLAS_COLS;
    const row = Math.floor(f / SHADER_ATLAS_COLS);
    const cx = col * framePx + framePx * 0.5;
    const cy = row * framePx + framePx * 0.5;

    ctx.save();
    ctx.translate(cx, cy);
    if (entry.shaderId <= 3 || entry.shaderId === 20 || entry.shaderId === 21) {
      const arcR = rHit * (0.68 + 0.32 * ease);
      ctx.strokeStyle = entry.fallbackVeinHex;
      ctx.lineWidth = Math.max(2, framePx * 0.055 * (1 - t * 0.5));
      ctx.beginPath();
      ctx.arc(-framePx * 0.03, 0, arcR * 0.92, -1.15, 1.15);
      ctx.stroke();

      ctx.strokeStyle = entry.fallbackPrimaryHex;
      ctx.lineWidth = Math.max(1.5, framePx * 0.038 * (1 - t * 0.5));
      ctx.beginPath();
      ctx.arc(0, 0, arcR, -1.2, 1.2);
      ctx.stroke();

      ctx.strokeStyle = PALETTE.BONE_WHITE;
      ctx.lineWidth = Math.max(1, framePx * 0.016);
      ctx.beginPath();
      ctx.arc(0, 0, arcR + 1.5, -1.05, 1.05);
      ctx.stroke();
    } else if (entry.shaderId <= 7 || entry.shaderId === 23) {
      const reach = rHit * (0.35 + 0.65 * ease);
      ctx.strokeStyle = entry.fallbackVeinHex;
      ctx.lineWidth = Math.max(2, framePx * 0.06 * (1 - t * 0.5));
      ctx.beginPath();
      ctx.moveTo(-reach * 0.6, 0);
      ctx.lineTo(reach, 0);
      ctx.stroke();

      ctx.strokeStyle = PALETTE.BONE_WHITE;
      ctx.lineWidth = Math.max(1.2, framePx * 0.022 * (1 - t * 0.4));
      ctx.beginPath();
      ctx.moveTo(-reach * 0.5, 0);
      ctx.lineTo(reach, 0);
      ctx.stroke();
    } else {
      const ringR = rHit * (0.22 + 0.78 * ease);
      ctx.strokeStyle = entry.fallbackVeinHex;
      ctx.lineWidth = Math.max(2, framePx * 0.055 * (1 - t * 0.55));
      ctx.beginPath();
      ctx.arc(0, 0, ringR * 0.92, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = entry.fallbackPrimaryHex;
      ctx.lineWidth = Math.max(1.5, framePx * 0.035 * (1 - t * 0.45));
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = PALETTE.BONE_WHITE;
      ctx.lineWidth = Math.max(1, framePx * 0.014 * (1 - t * 0.5));
      ctx.beginPath();
      ctx.arc(0, 0, ringR + 1.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * Bakes all 24 Chiaroscuro 1:1 Top-Down & 360° +X 14-frame sprite atlases (7x2)
 * using a single offscreen WebGL1 shader pass per strip, registers numbered frames 0..13
 * on Phaser's TextureManager, and immediately frees the WebGL baking context.
 */
export function bakeShaderVfxFlipbooks(scene: Phaser.Scene, bakeScale = 4): void {
  const glBaker = createOffscreenGlBaker();
  lastBakeUsedWebGL = Boolean(glBaker);
  (globalThis as { __ASHEN_SHADER_VFX_WEBGL__?: boolean }).__ASHEN_SHADER_VFX_WEBGL__ =
    lastBakeUsedWebGL;

  try {
    for (const entry of SHADER_STRIP_CATALOG) {
      const framePx = resolveShaderStripFramePx(entry.key, bakeScale);
      const stripW = framePx * SHADER_ATLAS_COLS;
      const stripH = framePx * SHADER_ATLAS_ROWS;

      const stripCanvas = document.createElement('canvas');
      stripCanvas.width = stripW;
      stripCanvas.height = stripH;
      const ctx2d = stripCanvas.getContext('2d');
      if (!ctx2d) continue;

      if (glBaker) {
        const { gl, glCanvas, programs } = glBaker;
        const famIdx =
          entry.shaderId <= 7
            ? 0
            : entry.shaderId <= 10
              ? 1
              : entry.shaderId <= 13
                ? 2
                : entry.shaderId <= 18
                  ? 3
                  : 4;
        const fam = programs[famIdx]!;
        if (glCanvas.width !== stripW || glCanvas.height !== stripH) {
          glCanvas.width = stripW;
          glCanvas.height = stripH;
        }
        gl.viewport(0, 0, stripW, stripH);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(fam.program);
        gl.enableVertexAttribArray(fam.aPos);
        gl.vertexAttribPointer(fam.aPos, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(fam.uFramePx, framePx);
        gl.uniform1f(fam.uFrameCount, SHADER_FX_FRAME_COUNT);
        gl.uniform1f(fam.uShaderId, entry.shaderId);
        gl.uniform1f(fam.uElemId, entry.elemId);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        ctx2d.clearRect(0, 0, stripW, stripH);
        ctx2d.drawImage(glCanvas, 0, 0);
      } else {
        ctx2d.clearRect(0, 0, stripW, stripH);
        drawFallback2DStrip(ctx2d, entry, framePx, SHADER_FX_FRAME_COUNT);
      }

      if (scene.textures.exists(entry.key)) {
        scene.textures.remove(entry.key);
      }
      const canvasTex = scene.textures.addCanvas(entry.key, stripCanvas);
      if (canvasTex && typeof canvasTex.add === 'function') {
        for (let f = 0; f < SHADER_FX_FRAME_COUNT; f++) {
          const col = f % SHADER_ATLAS_COLS;
          const row = Math.floor(f / SHADER_ATLAS_COLS);
          canvasTex.add(f, 0, col * framePx, row * framePx, framePx, framePx);
        }
      }
    }
  } finally {
    if (glBaker) {
      destroyOffscreenGlBaker(glBaker);
    }
  }
}
