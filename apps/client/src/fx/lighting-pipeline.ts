import Phaser from 'phaser';
import {
  clamp,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
  type SimPropState,
  TILE_SIZE,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import type { ArenaMap } from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../art/palette.js';
import { getVisualQueryConfig } from '../core/visual-query.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import {
  BIOME_LIGHTING_CONFIG,
  type BiomeLightingEntry,
  computeUniformViewportMetrics,
  POSTFX_DEFAULTS,
  resolveSceneLightingConfig,
  type UniformViewportMetrics,
} from './lighting-config.js';

export {
  BIOME_LIGHTING_CONFIG,
  type BiomeLightingEntry,
  computeUniformViewportMetrics,
  POSTFX_DEFAULTS,
  resolveSceneLightingConfig,
  type UniformViewportMetrics,
};

const BIOME_POSTFX_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uMainSampler;
varying vec2 outTexCoord;

uniform float uBloomStrength;
uniform float uVignetteStrength;
uniform float uChromaAmount;
uniform float uLowHpPulse;
uniform vec3 uColorGradeTint;
uniform float uContrast;

void main() {
  vec2 uv = outTexCoord;
  vec2 centered = uv - vec2(0.5);
  float dist = length(centered);

  // 1. Subtle Chromatic Aberration on heavy hit / trauma (single lookup fast path when chroma == 0)
  vec3 color;
  if (uChromaAmount > 0.001) {
    float edgeMask = smoothstep(0.24, 0.62, dist);
    vec2 caOffset = centered * uChromaAmount * edgeMask * 0.0025;
    float r = texture2D(uMainSampler, clamp(uv + caOffset, 0.0, 1.0)).r;
    float g = texture2D(uMainSampler, uv).g;
    float b = texture2D(uMainSampler, clamp(uv - caOffset, 0.0, 1.0)).b;
    color = vec3(r, g, b);
  } else {
    color = texture2D(uMainSampler, uv).rgb;
  }

  // 2. Lightweight 2-tap Emissive Bloom on High quality
  if (uBloomStrength > 0.001) {
    vec2 off = vec2(0.0022, 0.0035);
    vec3 s1 = texture2D(uMainSampler, clamp(uv + off, 0.0, 1.0)).rgb;
    vec3 s2 = texture2D(uMainSampler, clamp(uv - off, 0.0, 1.0)).rgb;
    vec3 avg = (color + s1 + s2) * 0.3333;
    float luma = dot(avg, vec3(0.299, 0.587, 0.114));
    float brightFactor = smoothstep(0.50, 0.90, luma);
    color += avg * brightFactor * uBloomStrength;
  }

  // 3. Biome Color Grading & Contrast
  color = ((color - 0.5) * uContrast + 0.5) * uColorGradeTint;

  // 4. Smooth Vignette + Low-HP Red Heartbeat Edge Pulse
  float vig = smoothstep(0.36, 0.78, dist);
  color *= (1.0 - vig * uVignetteStrength);
  if (uLowHpPulse > 0.001) {
    color = mix(color, vec3(0.91, 0.18, 0.22), vig * uLowHpPulse * 0.65);
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

export class BiomePostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  public bloomStrength: number = POSTFX_DEFAULTS.bloomStrength;
  public vignetteStrength: number = POSTFX_DEFAULTS.vignetteStrength;
  public chromaAmount = 0;
  public lowHpPulse = 0;
  public colorGradeTint: [number, number, number] = [...BIOME_LIGHTING_CONFIG[1].colorGradeTint];
  public contrast: number = POSTFX_DEFAULTS.contrast;

  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'BiomePostFxPipeline',
      fragShader: BIOME_POSTFX_FRAG,
    });
  }

  public override onPreRender(): void {
    this.set1f('uBloomStrength', this.bloomStrength);
    this.set1f('uVignetteStrength', this.vignetteStrength);
    this.set1f('uChromaAmount', this.chromaAmount);
    this.set1f('uLowHpPulse', this.lowHpPulse);
    this.set3f(
      'uColorGradeTint',
      this.colorGradeTint[0],
      this.colorGradeTint[1],
      this.colorGradeTint[2],
    );
    this.set1f('uContrast', this.contrast);
  }
}

interface TransientLight {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  color: number;
  intensity: number;
  age: number;
  ttl: number;
}

const LIGHTMAP_RES_SCALE = 0.25;
const WARM_GLOW_POOL_SIZE = 32; // 16 braziers * 2 additive layers (outer #F59E42 + inner #FFD27A)

/**
 * Dynamic Lighting & Post-FX Pipeline (Full-Screen Clear Visibility Model):
 * - Multiplicative RenderTexture Lightmap at depth 34 with bright biome ambient (~84-90%)
 * - Additive (BlendModes.ADD) brush draws into lightmapRt so colored lights never darken other channels
 * - Zero-allocation pool of 32 warm ADD glow sprites at depth 35 above lightmapRt for torch_brazier pools
 * - Frost rim overlay at depth 36 for Boss 2 Kryssa Phase 3 blizzard without darkening the arena
 */
export class LightingPipeline {
  private readonly scene: Phaser.Scene;
  private readonly lightmapRt: Phaser.GameObjects.RenderTexture;
  private readonly brushSprite: Phaser.GameObjects.Image;
  private readonly warmGlowPool: Phaser.GameObjects.Image[] = [];
  private readonly blizzardRimGraphics: Phaser.GameObjects.Graphics;
  private readonly transientPool: TransientLight[] = [];
  private readonly brushBaseTexWidth = 128;
  private biome: 1 | 2 | 3 = 1;
  private blizzardVeil = false;
  private elapsedSec = 0;
  private frameCounter = 0;
  private activeLightCount = 0;
  private postFxAttached = false;
  private lightingEnabled = getVisualQueryConfig().lightingEnabled;
  private currentLightmapScale = LIGHTMAP_RES_SCALE;
  private currentCoverW = WORLD_VIEW_WIDTH;
  private currentCoverH = WORLD_VIEW_HEIGHT;

  constructor(scene: Phaser.Scene, biome: 1 | 2 | 3 = 1) {
    this.scene = scene;
    this.biome = biome;

    // Offscreen brush sprite used for batched radial light draws into RenderTexture
    this.brushSprite = scene.make.image({ key: 'fx_light_radial', add: false });
    this.brushSprite.setOrigin(0.5, 0.5);
    this.brushSprite.setBlendMode(Phaser.BlendModes.ADD);

    this.currentLightmapScale = LIGHTMAP_RES_SCALE * graphicsSettings.getBudget().lightmapScale;
    this.lightmapRt = scene.add.renderTexture(
      0,
      0,
      Math.round(WORLD_VIEW_WIDTH * this.currentLightmapScale),
      Math.round(WORLD_VIEW_HEIGHT * this.currentLightmapScale),
    );
    this.lightmapRt.setOrigin(0, 0);
    this.lightmapRt.setScale(1 / this.currentLightmapScale);
    this.lightmapRt.setDepth(34);
    this.lightmapRt.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.lightmapRt.setVisible(this.lightingEnabled);

    // Pre-allocate 32 warm additive glow sprites at depth 35 (above lightmapRt at depth 34)
    for (let i = 0; i < WARM_GLOW_POOL_SIZE; i++) {
      const glow = scene.add.image(-1000, -1000, 'fx_light_radial');
      glow.setOrigin(0.5, 0.5);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setDepth(35);
      glow.setVisible(false);
      this.warmGlowPool.push(glow);
    }

    // Frost rim graphics for Kryssa Phase 3 Blizzard (depth 36, pure ice tint #CFE8EE, never black)
    this.blizzardRimGraphics = scene.add.graphics();
    this.blizzardRimGraphics.setDepth(36);

    for (let i = 0; i < 32; i++) {
      this.transientPool.push({
        active: false,
        x: 0,
        y: 0,
        radius: 60,
        color: 0xffffff,
        intensity: 1,
        age: 0,
        ttl: 0.2,
      });
    }

    this.syncPostFxPipeline();
  }

  public setBiome(biome: 1 | 2 | 3): void {
    this.biome = biome;
  }

  public setBlizzardVeil(active: boolean): void {
    this.blizzardVeil = active;
  }

  public isBlizzardVeilActive(): boolean {
    return this.blizzardVeil;
  }

  public getActiveLightCount(): number {
    return this.activeLightCount;
  }

  public setLightingEnabled(enabled: boolean): void {
    this.lightingEnabled = enabled;
    this.lightmapRt.setVisible(enabled);
    if (!enabled) {
      this.activeLightCount = 0;
      for (let i = 0; i < this.warmGlowPool.length; i++) {
        const g = this.warmGlowPool[i]!;
        if (g.visible) g.setVisible(false);
      }
      this.blizzardRimGraphics.clear();
    }
    this.syncPostFxPipeline();
  }

  public isLightmapVisible(): boolean {
    return this.lightmapRt.visible;
  }

  public spawnTransientLight(
    x: number,
    y: number,
    radius: number,
    colorHex: string,
    intensity = 0.95,
    ttl = 0.22,
  ): void {
    for (let i = 0; i < this.transientPool.length; i++) {
      const slot = this.transientPool[i]!;
      if (!slot.active) {
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.radius = radius;
        slot.color = hexToNum(colorHex);
        slot.intensity = intensity;
        slot.age = 0;
        slot.ttl = ttl;
        return;
      }
    }
  }

  public syncPostFxPipeline(): void {
    const renderer = this.scene.game.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;

    if (!renderer.pipelines.has('BiomePostFxPipeline')) {
      renderer.pipelines.addPostPipeline('BiomePostFxPipeline', BiomePostFxPipeline);
    }

    const budget = graphicsSettings.getBudget();
    const targetScale = LIGHTMAP_RES_SCALE * budget.lightmapScale;
    if (Math.abs(targetScale - this.currentLightmapScale) > 0.001) {
      this.currentLightmapScale = targetScale;
      this.lightmapRt.resize(
        Math.round(this.currentCoverW * this.currentLightmapScale),
        Math.round(this.currentCoverH * this.currentLightmapScale),
      );
      this.lightmapRt.setScale(1 / this.currentLightmapScale);
    }

    const quality = graphicsSettings.getState().quality;
    const cam = this.scene.cameras.main;

    if (!this.lightingEnabled || quality === 'low') {
      if (this.postFxAttached) {
        cam.removePostPipeline('BiomePostFxPipeline');
        this.postFxAttached = false;
      }
    } else if (!this.postFxAttached) {
      cam.setPostPipeline('BiomePostFxPipeline');
      this.postFxAttached = true;
    }
  }

  public refreshResolution(): void {
    this.brushSprite.setTexture('fx_light_radial');
    this.brushSprite.setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < this.warmGlowPool.length; i++) {
      this.warmGlowPool[i]!.setTexture('fx_light_radial');
    }
    this.syncPostFxPipeline();
  }

  private drawBlizzardRim(rawViewX: number, rawViewY: number, viewW: number, viewH: number): void {
    this.blizzardRimGraphics.clear();
    if (!this.blizzardVeil || !this.lightingEnabled) {
      return;
    }

    const iceColor = 0xcfe8ee;
    // Outer frost rim along 4 viewport edges
    this.blizzardRimGraphics.lineStyle(18, iceColor, 0.11);
    this.blizzardRimGraphics.strokeRect(rawViewX + 9, rawViewY + 9, viewW - 18, viewH - 18);

    // Inner softer frost rim
    this.blizzardRimGraphics.lineStyle(36, iceColor, 0.06);
    this.blizzardRimGraphics.strokeRect(rawViewX + 27, rawViewY + 27, viewW - 54, viewH - 54);

    // Subtle diagonal frost crystal streaks at the 4 corners (alpha <= 0.12, pure #CFE8EE)
    this.blizzardRimGraphics.lineStyle(2.5, iceColor, 0.12);
    const corners: readonly [number, number, number, number][] = [
      [rawViewX + 6, rawViewY + 6, 1, 1],
      [rawViewX + viewW - 6, rawViewY + 6, -1, 1],
      [rawViewX + 6, rawViewY + viewH - 6, 1, -1],
      [rawViewX + viewW - 6, rawViewY + viewH - 6, -1, -1],
    ];
    for (let c = 0; c < corners.length; c++) {
      const [cx, cy, sx, sy] = corners[c]!;
      this.blizzardRimGraphics.beginPath();
      this.blizzardRimGraphics.moveTo(cx, cy + sy * 42);
      this.blizzardRimGraphics.lineTo(cx + sx * 42, cy);
      this.blizzardRimGraphics.moveTo(cx, cy + sy * 64);
      this.blizzardRimGraphics.lineTo(cx + sx * 64, cy);
      this.blizzardRimGraphics.strokePath();
    }
  }

  public update(params: {
    dtSec: number;
    playerPos: { x: number; y: number };
    player: SimPlayerState;
    simulatedPlayers: readonly { pos: { x: number; y: number }; state: SimPlayerState }[];
    enemies: readonly SimEnemyState[];
    projectiles: readonly SimProjectileState[];
    props: readonly SimPropState[];
    map: ArenaMap;
    trauma: number;
    inHub?: boolean;
  }): void {
    const {
      dtSec,
      playerPos,
      player,
      simulatedPlayers,
      enemies,
      projectiles,
      props,
      map,
      trauma,
      inHub = false,
    } = params;
    if (getVisualQueryConfig().freeze) {
      this.elapsedSec = 1.0;
    } else {
      this.elapsedSec += dtSec;
    }

    if (!this.lightingEnabled) {
      this.lightmapRt.setVisible(false);
      this.activeLightCount = 0;
      for (let i = 0; i < this.warmGlowPool.length; i++) {
        const g = this.warmGlowPool[i]!;
        if (g.visible) g.setVisible(false);
      }
      this.blizzardRimGraphics.clear();
      this.syncPostFxPipeline();
      return;
    }
    this.frameCounter += 1;

    const budget = graphicsSettings.getBudget();
    const isHeavySwarm = projectiles.length > 200;
    this.syncPostFxPipeline();
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const zoomX = Math.max(0.1, cam.zoomX || cam.zoom || 1);
    const zoomY = Math.max(0.1, cam.zoomY || cam.zoom || 1);
    const viewW =
      cam.width > 0 ? cam.width / zoomX : view && view.width > 0 ? view.width : WORLD_VIEW_WIDTH;
    const viewH =
      cam.height > 0 ? cam.height / zoomY : view && view.height > 0 ? view.height : WORLD_VIEW_HEIGHT;
    const rawViewX =
      cam.width > 0
        ? cam.scrollX + cam.width * 0.5 - viewW * 0.5
        : view && view.width > 0
          ? view.x
          : 0;
    const rawViewY =
      cam.height > 0
        ? cam.scrollY + cam.height * 0.5 - viewH * 0.5
        : view && view.height > 0
          ? view.y
          : 0;
    const pad = 64;
    const viewX = rawViewX - pad;
    const viewY = rawViewY - pad;
    const coverW = Math.ceil(viewW + pad * 2);
    const coverH = Math.ceil(viewH + pad * 2);
    if (coverW !== this.currentCoverW || coverH !== this.currentCoverH) {
      this.currentCoverW = coverW;
      this.currentCoverH = coverH;
      this.lightmapRt.resize(
        Math.round(this.currentCoverW * this.currentLightmapScale),
        Math.round(this.currentCoverH * this.currentLightmapScale),
      );
      this.lightmapRt.setScale(1 / this.currentLightmapScale);
    }

    this.lightmapRt.setPosition(viewX, viewY);
    this.lightmapRt.setVisible(true);

    const sceneConfig = resolveSceneLightingConfig(this.biome, inHub, this.blizzardVeil);

    // 1. Update PostFX uniforms (Bloom, Vignette, Chromatic Aberration, Low-HP Heartbeat)
    if (this.postFxAttached) {
      const postPipelines = cam.getPostPipeline('BiomePostFxPipeline');
      const pipeline = Array.isArray(postPipelines) ? postPipelines[0] : postPipelines;
      if (pipeline instanceof BiomePostFxPipeline) {
        pipeline.bloomStrength =
          budget.enableBloomPostFx && !isHeavySwarm ? POSTFX_DEFAULTS.bloomStrength : 0.0;
        pipeline.vignetteStrength = sceneConfig.vignetteStrength;
        pipeline.chromaAmount = isHeavySwarm ? 0 : clamp(trauma * 1.4, 0, 1);
        pipeline.colorGradeTint = sceneConfig.colorGradeTint;
        pipeline.contrast = POSTFX_DEFAULTS.contrast;

        if (player.hp <= 2 && player.hp > 0) {
          pipeline.lowHpPulse = 0.45 + 0.45 * Math.sin(this.elapsedSec * 9.5);
        } else {
          pipeline.lowHpPulse = 0;
        }
      }
    }

    // Draw frost rim when Kryssa Phase 3 blizzardVeil is active
    this.drawBlizzardRim(rawViewX, rawViewY, viewW, viewH);

    // 2. Render Dynamic Lightmap into RenderTexture (amortized during 600+ bullet swarm)
    if (isHeavySwarm && this.frameCounter % 3 !== 0 && this.activeLightCount >= 30) {
      return;
    }

    const ambientColor = sceneConfig.ambientColor;
    const lmScale = this.currentLightmapScale;
    const maxLights = budget.tier === 'high' ? 48 : budget.tier === 'medium' ? 28 : 12;
    this.lightmapRt.clear();
    this.lightmapRt.fill(ambientColor, 1.0);
    this.lightmapRt.beginDraw();

    let lightsDrawn = 0;
    const drawLight = (
      worldX: number,
      worldY: number,
      radius: number,
      colorNum: number,
      alpha: number,
    ) => {
      if (lightsDrawn >= maxLights) return;
      const lx = worldX - viewX;
      const ly = worldY - viewY;
      if (
        lx + radius < -16 ||
        lx - radius > coverW + 16 ||
        ly + radius < -16 ||
        ly - radius > coverH + 16
      ) {
        return;
      }
      this.brushSprite.setScale(((radius * 2) / this.brushBaseTexWidth) * lmScale);
      this.brushSprite.setTint(colorNum);
      this.brushSprite.setAlpha(clamp(alpha, 0, 1));
      this.lightmapRt.batchDraw(this.brushSprite, lx * lmScale, ly * lmScale);
      lightsDrawn += 1;
    };

    // A. Main Player gentle foot aura (no fog-of-war vision circle)
    const dashBoost = player.dashTimer > 0 ? 1 : 0;
    drawLight(
      playerPos.x,
      playerPos.y,
      160 + dashBoost * 20,
      0xfff3d6,
      0.24 + dashBoost * 0.08,
    );

    if (player.skillActiveTimer > 0) {
      drawLight(
        playerPos.x + Math.cos(player.aimAngle) * 28,
        playerPos.y + Math.sin(player.aimAngle) * 28,
        115,
        hexToNum(PALETTE.CRIMSON_BRIGHT),
        0.55,
      );
    }

    // B. Simulated Co-op Players (P2-P4) gentle foot aura
    for (let i = 0; i < simulatedPlayers.length; i++) {
      const sp = simulatedPlayers[i]!;
      drawLight(sp.pos.x, sp.pos.y, 145, 0xe8f4ff, 0.22);
    }

    // C. Props: Flickering Torches (with Warm ADD Glow Pool at depth 35), Bioluminescent Mushrooms (B1 only), Crystal Pillars, Explosive Barrels
    // On Low quality tier, Spec 3.5 caps scene lights at 2 closest braziers to camera center
    const camCenterX = rawViewX + viewW * 0.5;
    const camCenterY = rawViewY + viewH * 0.5;
    const isLowTier = budget.tier === 'low';
    const maxBrazierCount = isLowTier ? 2 : 16;

    let lowBestBrazierIdx1 = -1;
    let lowBestBrazierIdx2 = -1;
    if (isLowTier) {
      let bestDist1 = Infinity;
      let bestDist2 = Infinity;
      for (let i = 0; i < props.length; i++) {
        const pr = props[i]!;
        if (pr.hp <= 0 || pr.lightRadius <= 0 || pr.kind !== 'torch_brazier') continue;
        const lx = pr.x - viewX;
        const ly = pr.y - viewY;
        const r = pr.lightRadius * 1.25;
        if (lx + r < -16 || lx - r > coverW + 16 || ly + r < -16 || ly - r > coverH + 16) {
          continue;
        }
        const dSq =
          (pr.x - camCenterX) * (pr.x - camCenterX) + (pr.y - camCenterY) * (pr.y - camCenterY);
        if (dSq < bestDist1) {
          bestDist2 = bestDist1;
          lowBestBrazierIdx2 = lowBestBrazierIdx1;
          bestDist1 = dSq;
          lowBestBrazierIdx1 = i;
        } else if (dSq < bestDist2) {
          bestDist2 = dSq;
          lowBestBrazierIdx2 = i;
        }
      }
    }

    let warmGlowCursor = 0;
    let braziersActive = 0;
    let scenePropLightsActive = 0;
    const maxScenePropLights = isLowTier ? 2 : 32;

    for (let i = 0; i < props.length; i++) {
      const prop = props[i]!;
      if (prop.hp <= 0 || prop.lightRadius <= 0) continue;

      // Client-only biome filter: glow_mushroom is strictly Biome 1 dungeon only
      if (prop.kind === 'glow_mushroom' && (this.biome !== 1 || inHub)) {
        continue;
      }

      if (prop.kind === 'torch_brazier') {
        if (isLowTier && i !== lowBestBrazierIdx1 && i !== lowBestBrazierIdx2) {
          continue;
        }
        if (braziersActive >= maxBrazierCount || scenePropLightsActive >= maxScenePropLights) {
          continue;
        }
        const lx = prop.x - viewX;
        const ly = prop.y - viewY;
        const checkR = prop.lightRadius * 1.25;
        if (
          lx + checkR < -16 ||
          lx - checkR > coverW + 16 ||
          ly + checkR < -16 ||
          ly - checkR > coverH + 16
        ) {
          continue;
        }

        const flicker =
          Math.sin(this.elapsedSec * 13 + prop.id * 1.7) * 0.08 +
          Math.cos(this.elapsedSec * 23 + prop.id * 0.9) * 0.05;
        const flickerA = 1 + flicker * 0.5;
        const radius = prop.lightRadius * (1 + flicker);
        const alpha = 0.85 + flicker * 0.5;

        drawLight(prop.x, prop.y, radius * 1.25, hexToNum(prop.lightColorHex), alpha);
        braziersActive += 1;
        scenePropLightsActive += 1;

        if (warmGlowCursor + 1 < this.warmGlowPool.length) {
          const outerGlow = this.warmGlowPool[warmGlowCursor++]!;
          const outerRadius = prop.lightRadius * 1.15;
          outerGlow.setPosition(prop.x, prop.y);
          outerGlow.setTint(0xf59e42);
          outerGlow.setAlpha(clamp(0.22 * flickerA, 0, 1));
          outerGlow.setScale((outerRadius * 2) / this.brushBaseTexWidth);
          outerGlow.setVisible(true);

          const innerGlow = this.warmGlowPool[warmGlowCursor++]!;
          const innerRadius = prop.lightRadius * 0.6;
          innerGlow.setPosition(prop.x, prop.y);
          innerGlow.setTint(0xffd27a);
          innerGlow.setAlpha(clamp(0.16 * flickerA, 0, 1));
          innerGlow.setScale((innerRadius * 2) / this.brushBaseTexWidth);
          innerGlow.setVisible(true);
        }
        continue;
      }

      if (scenePropLightsActive >= maxScenePropLights) {
        continue;
      }

      let radius = prop.lightRadius;
      let alpha = 0.52;
      if (prop.kind === 'glow_mushroom') {
        const pulse = Math.sin(this.elapsedSec * 3.2 + prop.id) * 0.05;
        radius = prop.lightRadius * (1 + pulse);
        alpha = clamp(0.3 + pulse, 0.15, 0.35);
      } else if (prop.kind === 'crystal_pillar') {
        const pulse = Math.sin(this.elapsedSec * 3.2 + prop.id) * 0.08;
        radius = prop.lightRadius * (1 + pulse);
        alpha = 0.55 + pulse;
      } else if (prop.kind === 'explosive_barrel') {
        alpha = 0.45;
      }

      drawLight(prop.x, prop.y, radius * 1.15, hexToNum(prop.lightColorHex), alpha);
      scenePropLightsActive += 1;
    }

    for (let i = warmGlowCursor; i < this.warmGlowPool.length; i++) {
      const g = this.warmGlowPool[i]!;
      if (g.visible) g.setVisible(false);
    }

    // D. Transient Flash Lights (Muzzle flashes, Explosions, Lightning arcs)
    for (let i = 0; i < this.transientPool.length; i++) {
      const t = this.transientPool[i]!;
      if (!t.active) continue;
      t.age += dtSec;
      if (t.age >= t.ttl) {
        t.active = false;
        continue;
      }
      const p = 1 - t.age / t.ttl;
      drawLight(t.x, t.y, t.radius * (0.7 + 0.3 * p), t.color, t.intensity * p);
    }

    // E. Glowing Interactive Surfaces (Lava, Burning Oil/Grass, Electrified Water, Poison Swamp)
    const minTx = Math.max(1, Math.floor(viewX / TILE_SIZE));
    const maxTx = Math.min(map.cols - 2, Math.ceil((viewX + coverW) / TILE_SIZE));
    const minTy = Math.max(1, Math.floor(viewY / TILE_SIZE));
    const maxTy = Math.min(map.rows - 2, Math.ceil((viewY + coverH) / TILE_SIZE));

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const surf = map.getSurface(tx, ty);
        if (
          surf === 'none' ||
          surf === 'water' ||
          surf === 'oil' ||
          surf === 'grass' ||
          surf === 'ash' ||
          surf === 'ice' ||
          surf === 'chasm' ||
          surf === 'conveyor'
        ) {
          continue;
        }
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = ty * TILE_SIZE + TILE_SIZE / 2;
        if ((surf === 'burning_oil' || surf === 'burning_grass') && ((tx + ty) & 1) === 0) {
          const flick = Math.sin(this.elapsedSec * 16 + tx * 3 + ty * 5) * 7;
          drawLight(wx, wy, 82 + flick, hexToNum(PALETTE.FLAME_ORANGE), 0.55);
        } else if (surf === 'electrified_water' && ((tx + ty) & 1) === 0) {
          drawLight(wx, wy, 76, hexToNum(PALETTE.CYAN_FROST), 0.52);
        } else if (surf === 'lava' && tx % 2 === 0 && ty % 2 === 0) {
          drawLight(wx, wy, 90, hexToNum(PALETTE.FLAME_ORANGE), 0.52);
        } else if (surf === 'poison_swamp' && tx % 2 === 0 && ty % 2 === 0) {
          drawLight(wx, wy, 74, hexToNum(PALETTE.TOXIC_PURPLE), 0.35);
        }
      }
    }

    // F. Enemy status / telegraph lights (Spore Bomber glow, burning/frozen/shocked enemies)
    for (let i = 0; i < enemies.length; i += enemies.length > 30 ? 8 : 1) {
      const e = enemies[i]!;
      if (e.hp <= 0) continue;
      if (e.aiState === 'spawning') {
        drawLight(e.x, e.y, 52, hexToNum(PALETTE.ELECTRIC_VIOLET), 0.45);
      } else if (e.aiState === 'telegraph') {
        drawLight(e.x, e.y, 58, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.45);
      } else if (e.burnTimer > 0) {
        drawLight(e.x, e.y, 48, hexToNum(PALETTE.FLAME_ORANGE), 0.42);
      } else if (e.frozenTimer > 0) {
        drawLight(e.x, e.y, 48, hexToNum(PALETTE.CYAN_FROST), 0.42);
      } else if (e.shockTimer > 0) {
        drawLight(e.x, e.y, 54, hexToNum(PALETTE.VOLT_YELLOW), 0.48);
      }
    }

    // G. Projectile Point Lights (adaptive stride when bullet count > 64 to keep 60+ FPS with 600+ bullets)
    if (budget.enableProjectileLights && projectiles.length > 0 && lightsDrawn < maxLights) {
      const remaining = Math.max(1, maxLights - lightsDrawn);
      const stride = Math.max(1, Math.ceil(projectiles.length / remaining));
      for (let i = 0; i < projectiles.length && lightsDrawn < maxLights; i += stride) {
        const b = projectiles[i]!;
        let col = hexToNum(PALETTE.CYAN_FROST);
        if (b.team === 'enemy') col = hexToNum(PALETTE.CRIMSON_BRIGHT);
        else if (b.element === 'burn') col = hexToNum(PALETTE.FLAME_ORANGE);
        else if (b.element === 'chill') col = hexToNum(PALETTE.CYAN_FROST);
        else if (b.element === 'shock') col = hexToNum(PALETTE.VOLT_YELLOW);
        else if (b.element === 'poison') col = hexToNum(PALETTE.LIME_GLOW);
        else if (b.weaponId === 'scrap_shotgun') col = hexToNum(PALETTE.SOLAR_GOLD);

        drawLight(b.x, b.y, b.team === 'enemy' ? 38 : 34, col, 0.38);
      }
    }

    this.lightmapRt.endDraw();
    this.activeLightCount = lightsDrawn;
  }

  public destroy(): void {
    const cam = this.scene.cameras?.main;
    if (cam && this.postFxAttached) {
      cam.removePostPipeline('BiomePostFxPipeline');
      this.postFxAttached = false;
    }
    for (let i = 0; i < this.warmGlowPool.length; i++) {
      this.warmGlowPool[i]!.destroy();
    }
    this.warmGlowPool.length = 0;
    this.blizzardRimGraphics.destroy();
    this.brushSprite.destroy();
    this.lightmapRt.destroy();
  }
}
