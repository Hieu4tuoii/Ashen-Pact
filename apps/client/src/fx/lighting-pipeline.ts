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
import { hexToNum, PALETTE, PLAYER_SLOT_COLORS } from '../art/palette.js';
import { graphicsSettings } from '../ui/graphics-settings.js';

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
  public bloomStrength = 0.26;
  public vignetteStrength = 0.18;
  public chromaAmount = 0;
  public lowHpPulse = 0;
  public colorGradeTint: [number, number, number] = [0.98, 1.02, 1.0];
  public contrast = 1.04;

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

const BIOME_AMBIENT_COLORS: Record<1 | 2 | 3, number> = {
  1: 0x72918b, // Overgrown Ruins: softer moonlit emerald-slate ambient
  2: 0x6c89ab, // Frozen Depths: softer glacial cobalt ambient
  3: 0x90695e, // Molten Forge: softer smoky ember ambient
};

const BIOME_COLOR_GRADES: Record<1 | 2 | 3, [number, number, number]> = {
  1: [0.98, 1.03, 1.0],
  2: [0.95, 1.01, 1.06],
  3: [1.05, 0.98, 0.94],
};

const LIGHTMAP_RES_SCALE = 0.25;

/**
 * Dynamic Lighting & Post-FX Pipeline (Section 3.4 & 3.7):
 * - Multiplicative RenderTexture Lightmap at depth 34 (above floor/props/entities, below telegraphs/projectiles/particles/damage numbers so combat hazards stay bright & readable in the dark)
 * - Additive soft radial point lights for players, torches (flickering), glowing mushrooms,
 *   explosive barrels, lava/burning surfaces, electrified water, projectiles, and explosions
 * - Custom WebGL PostFX shader for Bloom, Vignette, Low-HP Heartbeat, Chromatic Aberration, and Biome Color Grading
 */
export class LightingPipeline {
  private readonly scene: Phaser.Scene;
  private readonly lightmapRt: Phaser.GameObjects.RenderTexture;
  private readonly brushSprite: Phaser.GameObjects.Image;
  private readonly transientPool: TransientLight[] = [];
  private biome: 1 | 2 | 3 = 1;
  private blizzardVeil = false;
  private elapsedSec = 0;
  private frameCounter = 0;
  private activeLightCount = 0;
  private postFxAttached = false;
  private currentLightmapScale = LIGHTMAP_RES_SCALE;
  private currentCoverW = WORLD_VIEW_WIDTH;
  private currentCoverH = WORLD_VIEW_HEIGHT;

  constructor(scene: Phaser.Scene, biome: 1 | 2 | 3 = 1) {
    this.scene = scene;
    this.biome = biome;

    // Offscreen brush sprite used for batched radial light draws into RenderTexture
    this.brushSprite = scene.make.image({ key: 'fx_light_radial', add: false });
    this.brushSprite.setOrigin(0.5, 0.5);

    this.currentLightmapScale = LIGHTMAP_RES_SCALE * graphicsSettings.getBudget().lightmapScale;
    this.lightmapRt = scene.add.renderTexture(
      0,
      0,
      Math.round(WORLD_VIEW_WIDTH * this.currentLightmapScale),
      Math.round(WORLD_VIEW_HEIGHT * this.currentLightmapScale),
    );
    this.lightmapRt.setOrigin(0, 0);
    this.lightmapRt.setScale(1 / this.currentLightmapScale);
    // Depth 34: multiplies floor (2), decals (6), props (18..22), pickups (25), afterimages (26), enemies (28), players (29..30), ambient leaves (32)
    // Leaves telegraphs (38), projectiles (42), particles (45..58), lightning (62), damage numbers (80), hitboxes (90) at 100% emissive brightness!
    this.lightmapRt.setDepth(34);
    this.lightmapRt.setBlendMode(Phaser.BlendModes.MULTIPLY);

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

    if (quality === 'low') {
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
    this.syncPostFxPipeline();
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
  }): void {
    const { dtSec, playerPos, player, simulatedPlayers, enemies, projectiles, props, map, trauma } =
      params;
    this.elapsedSec += dtSec;
    this.frameCounter += 1;

    const budget = graphicsSettings.getBudget();
    const isHeavySwarm = projectiles.length > 200;
    this.syncPostFxPipeline();
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const zoom = Math.max(0.1, cam.zoom || 1);
    const viewW = cam.width > 0 ? cam.width / zoom : view && view.width > 0 ? view.width : WORLD_VIEW_WIDTH;
    const viewH = cam.height > 0 ? cam.height / zoom : view && view.height > 0 ? view.height : WORLD_VIEW_HEIGHT;
    const rawViewX = cam.width > 0 ? cam.scrollX + cam.width * 0.5 - viewW * 0.5 : view && view.width > 0 ? view.x : 0;
    const rawViewY = cam.height > 0 ? cam.scrollY + cam.height * 0.5 - viewH * 0.5 : view && view.height > 0 ? view.y : 0;
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

    // 1. Update PostFX uniforms (Bloom, Vignette, Chromatic Aberration, Low-HP Heartbeat)
    if (this.postFxAttached) {
      const postPipelines = cam.getPostPipeline('BiomePostFxPipeline');
      const pipeline = Array.isArray(postPipelines) ? postPipelines[0] : postPipelines;
      if (pipeline instanceof BiomePostFxPipeline) {
        pipeline.bloomStrength = budget.enableBloomPostFx && !isHeavySwarm ? 0.28 : 0.0;
        pipeline.vignetteStrength = this.blizzardVeil ? 0.38 : 0.18;
        pipeline.chromaAmount = isHeavySwarm ? 0 : clamp(trauma * 1.4, 0, 1);
        pipeline.colorGradeTint = this.blizzardVeil
          ? [0.9, 1.0, 1.1]
          : BIOME_COLOR_GRADES[this.biome];
        pipeline.contrast = 1.04;

        if (player.hp <= 2 && player.hp > 0) {
          pipeline.lowHpPulse = 0.45 + 0.45 * Math.sin(this.elapsedSec * 9.5);
        } else {
          pipeline.lowHpPulse = 0;
        }
      }
    }

    // 2. Render Dynamic Lightmap into RenderTexture (amortized during 600+ bullet swarm)
    if (isHeavySwarm && this.frameCounter % 3 !== 0 && this.activeLightCount >= 30) {
      return;
    }

    const ambientColor = this.blizzardVeil ? 0x3e5672 : BIOME_AMBIENT_COLORS[this.biome];
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
      this.brushSprite.setScale(((radius * 2) / 128) * lmScale);
      this.brushSprite.setTint(colorNum);
      this.brushSprite.setAlpha(clamp(alpha, 0, 1));
      this.lightmapRt.batchDraw(this.brushSprite, lx * lmScale, ly * lmScale);
      lightsDrawn += 1;
    };

    // A. Main Player soft aura light + active shield glow (narrowed during Blizzard Phase 3)
    const mainPlayerVisionRadius = this.blizzardVeil ? 185 : 310;
    drawLight(playerPos.x, playerPos.y, mainPlayerVisionRadius, 0xe0f2fe, 0.96);
    drawLight(playerPos.x, playerPos.y, 145, hexToNum(PLAYER_SLOT_COLORS[player.slot].hex), 0.5);


    if (player.skillActiveTimer > 0) {
      drawLight(
        playerPos.x + Math.cos(player.aimAngle) * 28,
        playerPos.y + Math.sin(player.aimAngle) * 28,
        115,
        hexToNum(PALETTE.CRIMSON_BRIGHT),
        0.75,
      );
    }

    // B. Simulated Co-op Players (P2-P4) soft aura lights
    const allyVisionRadius = this.blizzardVeil ? 160 : 250;
    for (let i = 0; i < simulatedPlayers.length; i++) {
      const sp = simulatedPlayers[i]!;
      drawLight(sp.pos.x, sp.pos.y, allyVisionRadius, 0xe0f2fe, 0.86);
      drawLight(sp.pos.x, sp.pos.y, 115, hexToNum(PLAYER_SLOT_COLORS[sp.state.slot].hex), 0.45);

    }

    // C. Props: Flickering Torches, Bioluminescent Mushrooms, Crystal Pillars, Explosive Barrels
    for (let i = 0; i < props.length; i++) {
      const prop = props[i]!;
      if (prop.hp <= 0 || prop.lightRadius <= 0) continue;

      let radius = prop.lightRadius;
      let alpha = 0.78;
      if (prop.kind === 'torch_brazier') {
        const flicker =
          Math.sin(this.elapsedSec * 13 + prop.id * 1.7) * 0.08 +
          Math.cos(this.elapsedSec * 23 + prop.id * 0.9) * 0.05;
        radius = prop.lightRadius * (1 + flicker);
        alpha = 0.85 + flicker * 0.5;
      } else if (prop.kind === 'glow_mushroom' || prop.kind === 'crystal_pillar') {
        const pulse = Math.sin(this.elapsedSec * 3.2 + prop.id) * 0.08;
        radius = prop.lightRadius * (1 + pulse);
        alpha = 0.72 + pulse;
      } else if (prop.kind === 'explosive_barrel') {
        alpha = 0.52;
      }

      drawLight(prop.x, prop.y, radius * 1.25, hexToNum(prop.lightColorHex), alpha);
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
          drawLight(wx, wy, 82 + flick, hexToNum(PALETTE.FLAME_ORANGE), 0.72);
        } else if (surf === 'electrified_water' && ((tx + ty) & 1) === 0) {
          drawLight(wx, wy, 76, hexToNum(PALETTE.CYAN_FROST), 0.68);
        } else if (surf === 'lava' && tx % 2 === 0 && ty % 2 === 0) {
          drawLight(wx, wy, 90, hexToNum(PALETTE.FLAME_ORANGE), 0.68);
        } else if (surf === 'poison_swamp' && tx % 2 === 0 && ty % 2 === 0) {
          drawLight(wx, wy, 74, hexToNum(PALETTE.TOXIC_PURPLE), 0.48);
        }
      }
    }

    // F. Enemy status / telegraph lights (Spore Bomber glow, burning/frozen/shocked enemies)
    for (let i = 0; i < enemies.length; i += enemies.length > 30 ? 8 : 1) {
      const e = enemies[i]!;
      if (e.hp <= 0) continue;
      if (e.aiState === 'spawning') {
        drawLight(e.x, e.y, 52, hexToNum(PALETTE.ELECTRIC_VIOLET), 0.65);
      } else if (e.aiState === 'telegraph') {
        drawLight(e.x, e.y, 58, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.6);
      } else if (e.burnTimer > 0) {
        drawLight(e.x, e.y, 48, hexToNum(PALETTE.FLAME_ORANGE), 0.55);
      } else if (e.frozenTimer > 0) {
        drawLight(e.x, e.y, 48, hexToNum(PALETTE.CYAN_FROST), 0.55);
      } else if (e.shockTimer > 0) {
        drawLight(e.x, e.y, 54, hexToNum(PALETTE.VOLT_YELLOW), 0.65);
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

        drawLight(b.x, b.y, b.team === 'enemy' ? 38 : 34, col, 0.52);
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
    this.brushSprite.destroy();
    this.lightmapRt.destroy();
  }
}
