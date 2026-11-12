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
import { getFreezeVisualTimeSec, getVisualQueryConfig } from '../core/visual-query.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import {
  BIOME_LIGHTING_CONFIG,
  type BiomeLightingEntry,
  computeUniformViewportMetrics,
  getInteractableLightQuota,
  INTERACTABLE_LIGHT_QUOTA,
  type InteractableLightEntry,
  POSTFX_DEFAULTS,
  resolveSceneLightingConfig,
  type UniformViewportMetrics,
} from './lighting-config.js';

export {
  BIOME_LIGHTING_CONFIG,
  type BiomeLightingEntry,
  computeUniformViewportMetrics,
  getInteractableLightQuota,
  INTERACTABLE_LIGHT_QUOTA,
  type InteractableLightEntry,
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
    float edgeMask = smoothstep(0.38, 0.72, dist);
    vec2 caOffset = centered * uChromaAmount * edgeMask * 0.0012;
    float r = texture2D(uMainSampler, clamp(uv + caOffset, 0.0, 1.0)).r;
    float g = texture2D(uMainSampler, uv).g;
    float b = texture2D(uMainSampler, clamp(uv - caOffset, 0.0, 1.0)).b;
    color = vec3(r, g, b);
  } else {
    color = texture2D(uMainSampler, uv).rgb;
  }

  // 2. Symmetric 4-tap Emissive Bloom on High quality (no diagonal double-image ghosting)
  if (uBloomStrength > 0.001) {
    vec2 off1 = vec2(0.0011, 0.0016);
    vec2 off2 = vec2(-0.0011, 0.0016);
    vec3 s1 = texture2D(uMainSampler, clamp(uv + off1, 0.0, 1.0)).rgb;
    vec3 s2 = texture2D(uMainSampler, clamp(uv - off1, 0.0, 1.0)).rgb;
    vec3 s3 = texture2D(uMainSampler, clamp(uv + off2, 0.0, 1.0)).rgb;
    vec3 s4 = texture2D(uMainSampler, clamp(uv - off2, 0.0, 1.0)).rgb;
    vec3 avg = (s1 + s2 + s3 + s4) * 0.25;
    float centerLuma = dot(color, vec3(0.299, 0.587, 0.114));
    float haloLuma = dot(avg, vec3(0.299, 0.587, 0.114));
    float brightFactor = smoothstep(0.74, 0.95, max(centerLuma, haloLuma * 0.92));
    color += avg * brightFactor * (uBloomStrength * 0.65);
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

function liftAmbientTowardClearWhite(ambientColor: number, whiteWeight = 0.68): number {
  const r = (ambientColor >> 16) & 0xff;
  const g = (ambientColor >> 8) & 0xff;
  const b = ambientColor & 0xff;
  const nr = Math.min(255, Math.round(r * (1 - whiteWeight) + 255 * whiteWeight));
  const ng = Math.min(255, Math.round(g * (1 - whiteWeight) + 255 * whiteWeight));
  const nb = Math.min(255, Math.round(b * (1 - whiteWeight) + 255 * whiteWeight));
  return (nr << 16) | (ng << 8) | nb;
}

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
  private activeInteractableLightCount = 0;
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

  public getActiveInteractableLightCount(): number {
    return this.activeInteractableLightCount;
  }

  public getElapsedSec(): number {
    return this.elapsedSec;
  }

  public setLightingEnabled(enabled: boolean): void {
    this.lightingEnabled = enabled;
    this.lightmapRt.setVisible(enabled);
    if (!enabled) {
      this.activeLightCount = 0;
      this.activeInteractableLightCount = 0;
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
    if (
      (this.scene.game as { __softwareLogicOnlyStep?: boolean } | undefined)
        ?.__softwareLogicOnlyStep
    ) {
      return;
    }
    const renderer = this.scene.game.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;

    if (!renderer.pipelines.has('BiomePostFxPipeline')) {
      renderer.pipelines.addPostPipeline('BiomePostFxPipeline', BiomePostFxPipeline);
    }

    const budget = graphicsSettings.getBudget();
    const targetScale = LIGHTMAP_RES_SCALE * budget.lightmapScale;
    if (Math.abs(targetScale - this.currentLightmapScale) > 0.001) {
      this.currentLightmapScale = targetScale;
      const rtW = Math.round(this.currentCoverW * this.currentLightmapScale);
      const rtH = Math.round(this.currentCoverH * this.currentLightmapScale);
      const webglRt = (
        this.lightmapRt.texture as unknown as {
          renderTarget?: { setAutoResize?: (v: boolean) => void };
        }
      )?.renderTarget;
      webglRt?.setAutoResize?.(true);
      this.lightmapRt.resize(rtW, rtH);
      webglRt?.setAutoResize?.(false);
      this.lightmapRt.setOrigin(0, 0);
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
    // Thin, subtle outer frost rim along 4 viewport edges so HUD edges remain crisp
    this.blizzardRimGraphics.lineStyle(10, iceColor, 0.035);
    this.blizzardRimGraphics.strokeRect(rawViewX + 5, rawViewY + 5, viewW - 10, viewH - 10);

    // Whisper-soft inner frost rim
    this.blizzardRimGraphics.lineStyle(20, iceColor, 0.018);
    this.blizzardRimGraphics.strokeRect(rawViewX + 15, rawViewY + 15, viewW - 30, viewH - 30);

    // Subtle diagonal frost crystal streaks at the 4 corners (alpha <= 0.06, pure #CFE8EE)
    this.blizzardRimGraphics.lineStyle(2.0, iceColor, 0.06);
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
    interactableLights?: readonly InteractableLightEntry[];
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
      interactableLights,
      map,
      trauma,
      inHub = false,
    } = params;
    if (getVisualQueryConfig().freeze) {
      this.elapsedSec = getFreezeVisualTimeSec(this.elapsedSec);
    } else {
      this.elapsedSec += dtSec;
    }

    if (!this.lightingEnabled) {
      this.lightmapRt.setVisible(false);
      this.activeLightCount = 0;
      this.activeInteractableLightCount = 0;
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
    const hasWorldView = Boolean(view && view.width > 0 && view.height > 0);
    const viewW = hasWorldView
      ? view.width
      : cam.width > 0
        ? cam.width / zoomX
        : WORLD_VIEW_WIDTH;
    const viewH = hasWorldView
      ? view.height
      : cam.height > 0
        ? cam.height / zoomY
        : WORLD_VIEW_HEIGHT;
    const rawViewX = hasWorldView
      ? view.x
      : cam.width > 0
        ? cam.scrollX + cam.width * 0.5 - viewW * 0.5
        : 0;
    const rawViewY = hasWorldView
      ? view.y
      : cam.height > 0
        ? cam.scrollY + cam.height * 0.5 - viewH * 0.5
        : 0;
    const pad = 64;
    const viewX = rawViewX - pad;
    const viewY = rawViewY - pad;
    const coverW = Math.ceil(viewW + pad * 2);
    const coverH = Math.ceil(viewH + pad * 2);
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
        pipeline.chromaAmount =
          isHeavySwarm || trauma <= 0.35 ? 0 : clamp((trauma - 0.35) * 0.85, 0, 0.45);
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
    const skipRtDraw = Boolean(
      (this.scene.game as { __softwareLogicOnlyStep?: boolean } | undefined)
        ?.__softwareLogicOnlyStep,
    );
    const needsResize = coverW !== this.currentCoverW || coverH !== this.currentCoverH;
    if (
      !needsResize &&
      isHeavySwarm &&
      this.frameCounter % 3 !== 0 &&
      this.activeLightCount >= 30
    ) {
      return;
    }

    if (needsResize && !skipRtDraw) {
      this.currentCoverW = coverW;
      this.currentCoverH = coverH;
      const rtW = Math.round(this.currentCoverW * this.currentLightmapScale);
      const rtH = Math.round(this.currentCoverH * this.currentLightmapScale);
      const webglRt = (
        this.lightmapRt.texture as unknown as {
          renderTarget?: { setAutoResize?: (v: boolean) => void };
        }
      )?.renderTarget;
      webglRt?.setAutoResize?.(true);
      this.lightmapRt.resize(rtW, rtH);
      webglRt?.setAutoResize?.(false);
      this.lightmapRt.setOrigin(0, 0);
      this.lightmapRt.setScale(1 / this.currentLightmapScale);
    }

    this.lightmapRt.setPosition(viewX, viewY);

    const ambientColor = liftAmbientTowardClearWhite(sceneConfig.ambientColor, 0.68);
    const lmScale = this.currentLightmapScale;
    const maxLights = budget.tier === 'high' ? 48 : budget.tier === 'medium' ? 28 : 12;
    if (!skipRtDraw) {
      this.lightmapRt.clear();
      this.lightmapRt.fill(ambientColor, 1.0);
      this.lightmapRt.beginDraw();
    }

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
      if (!skipRtDraw) {
        this.brushSprite.setScale(((radius * 2) / this.brushBaseTexWidth) * lmScale);
        this.brushSprite.setTint(colorNum);
        this.brushSprite.setAlpha(clamp(alpha, 0, 1));
        this.lightmapRt.batchDraw(this.brushSprite, lx * lmScale, ly * lmScale);
      }
      lightsDrawn += 1;
    };

    // A. Main Player subtle foot presence (no fog-of-war spotlight circle)
    const dashBoost = player.dashTimer > 0 ? 1 : 0;
    if (dashBoost > 0) {
      drawLight(playerPos.x, playerPos.y, 110, 0xfff3d6, 0.12);
    }

    if (player.skillActiveTimer > 0) {
      drawLight(
        playerPos.x + Math.cos(player.aimAngle) * 28,
        playerPos.y + Math.sin(player.aimAngle) * 28,
        105,
        hexToNum(PALETTE.CRIMSON_BRIGHT),
        0.28,
      );
    }

    // B. Simulated Co-op Players (P2-P4) — no fog-of-war spotlight circles
    void simulatedPlayers;

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
          Math.sin(this.elapsedSec * 7.5 + prop.id * 1.7) * 0.03 +
          Math.cos(this.elapsedSec * 12.0 + prop.id * 0.9) * 0.02;
        const flickerA = 1 + flicker * 0.4;
        const radius = prop.lightRadius * (1 + flicker);
        const alpha = 0.42 + flicker * 0.25;

        drawLight(prop.x, prop.y, radius * 1.15, hexToNum(prop.lightColorHex), alpha);
        braziersActive += 1;
        scenePropLightsActive += 1;

        if (warmGlowCursor + 1 < this.warmGlowPool.length) {
          const outerGlow = this.warmGlowPool[warmGlowCursor++]!;
          const outerRadius = prop.lightRadius * 1.1;
          outerGlow.setPosition(prop.x, prop.y);
          outerGlow.setTint(0xf59e42);
          outerGlow.setAlpha(clamp(0.14 * flickerA, 0, 1));
          outerGlow.setScale((outerRadius * 2) / this.brushBaseTexWidth);
          outerGlow.setVisible(true);

          const innerGlow = this.warmGlowPool[warmGlowCursor++]!;
          const innerRadius = prop.lightRadius * 0.55;
          innerGlow.setPosition(prop.x, prop.y);
          innerGlow.setTint(0xffd27a);
          innerGlow.setAlpha(clamp(0.11 * flickerA, 0, 1));
          innerGlow.setScale((innerRadius * 2) / this.brushBaseTexWidth);
          innerGlow.setVisible(true);
        }
        continue;
      }

      if (scenePropLightsActive >= maxScenePropLights) {
        continue;
      }

      let radius = prop.lightRadius;
      let alpha = 0.28;
      if (prop.kind === 'glow_mushroom') {
        const pulse = Math.sin(this.elapsedSec * 3.2 + prop.id) * 0.04;
        radius = prop.lightRadius * (1 + pulse);
        alpha = clamp(0.22 + pulse, 0.12, 0.28);
      } else if (prop.kind === 'crystal_pillar') {
        const pulse = Math.sin(this.elapsedSec * 3.2 + prop.id) * 0.05;
        radius = prop.lightRadius * (1 + pulse);
        alpha = 0.32 + pulse;
      } else if (prop.kind === 'explosive_barrel') {
        alpha = 0.25;
      }

      drawLight(prop.x, prop.y, radius * 1.1, hexToNum(prop.lightColorHex), alpha);
      scenePropLightsActive += 1;
    }

    for (let i = warmGlowCursor; i < this.warmGlowPool.length; i++) {
      const g = this.warmGlowPool[i]!;
      if (g.visible) g.setVisible(false);
    }

    // C2. Phase P6 Interactable & Pickup Lights (reserved quota: 16 High / 10 Medium / 6 Low, alpha <= 0.35)
    const interactableQuota = getInteractableLightQuota(budget.tier);
    let interactableLightsDrawn = 0;
    if (interactableLights && interactableLights.length > 0) {
      for (
        let i = 0;
        i < interactableLights.length &&
        interactableLightsDrawn < interactableQuota &&
        lightsDrawn < maxLights;
        i++
      ) {
        const entry = interactableLights[i]!;
        const lx = entry.x - viewX;
        const ly = entry.y - viewY;
        const r = entry.radius;
        if (
          lx + r < -16 ||
          lx - r > coverW + 16 ||
          ly + r < -16 ||
          ly - r > coverH + 16
        ) {
          continue;
        }
        if (!skipRtDraw) {
          this.brushSprite.setScale(((r * 2) / this.brushBaseTexWidth) * lmScale);
          this.brushSprite.setTint(entry.colorNum);
          this.brushSprite.setAlpha(clamp(entry.alpha, 0, 0.35));
          this.lightmapRt.batchDraw(this.brushSprite, lx * lmScale, ly * lmScale);

          if (
            entry.secondaryColorNum !== undefined &&
            entry.secondaryRadius !== undefined &&
            entry.secondaryAlpha !== undefined &&
            entry.secondaryRadius > 0 &&
            entry.secondaryAlpha > 0
          ) {
            this.brushSprite.setScale(
              ((entry.secondaryRadius * 2) / this.brushBaseTexWidth) * lmScale,
            );
            this.brushSprite.setTint(entry.secondaryColorNum);
            this.brushSprite.setAlpha(clamp(entry.secondaryAlpha, 0, 0.35));
            this.lightmapRt.batchDraw(this.brushSprite, lx * lmScale, ly * lmScale);
          }
        }

        interactableLightsDrawn += 1;
        lightsDrawn += 1;
      }
    }

    // D. Transient Flash Lights (Explosions, Lightning arcs, Heavy impacts)
    for (let i = 0; i < this.transientPool.length; i++) {
      const t = this.transientPool[i]!;
      if (!t.active) continue;
      t.age += dtSec;
      if (t.age >= t.ttl) {
        t.active = false;
        continue;
      }
      const p = 1 - t.age / t.ttl;
      drawLight(t.x, t.y, t.radius * (0.75 + 0.25 * p), t.color, t.intensity * p * 0.45);
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
          const flick = Math.sin(this.elapsedSec * 10 + tx * 3 + ty * 5) * 4;
          drawLight(wx, wy, 72 + flick, hexToNum(PALETTE.FLAME_ORANGE), 0.28);
        } else if (surf === 'electrified_water' && ((tx + ty) & 1) === 0) {
          drawLight(wx, wy, 68, hexToNum(PALETTE.CYAN_FROST), 0.26);
        } else if (surf === 'lava' && tx % 2 === 0 && ty % 2 === 0) {
          drawLight(wx, wy, 80, hexToNum(PALETTE.FLAME_ORANGE), 0.28);
        } else if (surf === 'poison_swamp' && tx % 2 === 0 && ty % 2 === 0) {
          drawLight(wx, wy, 68, hexToNum(PALETTE.TOXIC_PURPLE), 0.2);
        }
      }
    }

    // F. Enemy status / telegraph lights (subtle accent, no blotchy floor spotlights)
    for (let i = 0; i < enemies.length; i += enemies.length > 30 ? 8 : 2) {
      const e = enemies[i]!;
      if (e.hp <= 0) continue;
      if (e.aiState === 'spawning') {
        drawLight(e.x, e.y, 44, hexToNum(PALETTE.ELECTRIC_VIOLET), 0.2);
      } else if (e.aiState === 'telegraph' && e.isBoss) {
        drawLight(e.x, e.y, 56, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.22);
      }
    }

    // G. Projectile Point Lights — omitted from low-res lightmapRt so fast bullets never leave blocky spotlight trails,
    // while additive bullet glow sprites remain active emitters counted toward the tier light budget
    const projectileGlowLights = budget.enableProjectileLights
      ? Math.min(Math.max(0, maxLights - lightsDrawn), projectiles.length)
      : 0;

    if (!skipRtDraw) {
      this.lightmapRt.endDraw();
    }
    this.activeLightCount = lightsDrawn + projectileGlowLights;
    this.activeInteractableLightCount = interactableLightsDrawn;
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
