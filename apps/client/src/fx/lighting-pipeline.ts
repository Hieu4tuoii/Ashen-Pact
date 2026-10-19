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
    vec2 caOffset = centered * uChromaAmount * 0.012;
    float r = texture2D(uMainSampler, clamp(uv + caOffset, 0.0, 1.0)).r;
    float g = texture2D(uMainSampler, uv).g;
    float b = texture2D(uMainSampler, clamp(uv - caOffset, 0.0, 1.0)).b;
    color = vec3(r, g, b);
  } else {
    color = texture2D(uMainSampler, uv).rgb;
  }

  // 2. Lightweight 4-tap Emissive Bloom on High quality
  if (uBloomStrength > 0.001) {
    vec2 off1 = vec2(0.0022, 0.0038);
    vec2 off2 = vec2(-0.0022, 0.0038);
    vec3 s1 = texture2D(uMainSampler, clamp(uv + off1, 0.0, 1.0)).rgb;
    vec3 s2 = texture2D(uMainSampler, clamp(uv - off1, 0.0, 1.0)).rgb;
    vec3 s3 = texture2D(uMainSampler, clamp(uv + off2, 0.0, 1.0)).rgb;
    vec3 s4 = texture2D(uMainSampler, clamp(uv - off2, 0.0, 1.0)).rgb;
    vec3 avg = (s1 + s2 + s3 + s4) * 0.25;
    float luma = dot(avg, vec3(0.299, 0.587, 0.114));
    float brightFactor = smoothstep(0.52, 0.92, luma);
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
  public vignetteStrength = 0.34;
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
  1: 0x3b524e, // Overgrown Ruins: deep moonlit emerald-slate ambient
  2: 0x354b68, // Frozen Depths: deep glacial cobalt ambient
  3: 0x52342c, // Molten Forge: deep smoky ember ambient
};

const BIOME_COLOR_GRADES: Record<1 | 2 | 3, [number, number, number]> = {
  1: [0.98, 1.03, 1.0],
  2: [0.95, 1.01, 1.06],
  3: [1.05, 0.98, 0.94],
};

const LIGHTMAP_RES_SCALE = 0.25;

/**
 * Dynamic Lighting & Post-FX Pipeline (Section 3.4):
 * - Multiplicative RenderTexture Lightmap with per-biome dark ambient
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
  private elapsedSec = 0;
  private frameCounter = 0;
  private activeLightCount = 0;
  private postFxAttached = false;

  constructor(scene: Phaser.Scene, biome: 1 | 2 | 3 = 1) {
    this.scene = scene;
    this.biome = biome;

    // Offscreen brush sprite used for batched radial light draws into RenderTexture
    this.brushSprite = scene.make.image({ key: 'fx_light_radial', add: false });
    this.brushSprite.setOrigin(0.5, 0.5);

    this.lightmapRt = scene.add.renderTexture(
      0,
      0,
      WORLD_VIEW_WIDTH * LIGHTMAP_RES_SCALE,
      WORLD_VIEW_HEIGHT * LIGHTMAP_RES_SCALE,
    );
    this.lightmapRt.setOrigin(0, 0);
    this.lightmapRt.setScale(1 / LIGHTMAP_RES_SCALE);
    this.lightmapRt.setDepth(780);
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

  public getActiveLightCount(): number {
    return this.activeLightCount;
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

  public syncPostFxPipeline(isHeavySwarm = false): void {
    const renderer = this.scene.game.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;

    if (!renderer.pipelines.has('BiomePostFxPipeline')) {
      renderer.pipelines.addPostPipeline('BiomePostFxPipeline', BiomePostFxPipeline);
    }

    const quality = graphicsSettings.getState().quality;
    const cam = this.scene.cameras.main;

    if (quality === 'low' || isHeavySwarm) {
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
    this.syncPostFxPipeline(isHeavySwarm);
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const viewX = view && view.width > 0 ? view.x : 0;
    const viewY = view && view.height > 0 ? view.y : 0;

    this.lightmapRt.setPosition(viewX, viewY);
    this.lightmapRt.setVisible(!isHeavySwarm);

    // 1. Update PostFX uniforms (Bloom, Vignette, Chromatic Aberration, Low-HP Heartbeat)
    if (this.postFxAttached) {
      const postPipelines = cam.getPostPipeline('BiomePostFxPipeline');
      const pipeline = Array.isArray(postPipelines) ? postPipelines[0] : postPipelines;
      if (pipeline instanceof BiomePostFxPipeline) {
        pipeline.bloomStrength = budget.enableBloomPostFx && !isHeavySwarm ? 0.28 : 0.0;
        pipeline.vignetteStrength = 0.34;
        pipeline.chromaAmount = isHeavySwarm ? 0 : clamp(trauma * 1.4, 0, 1);
        pipeline.colorGradeTint = BIOME_COLOR_GRADES[this.biome];
        pipeline.contrast = 1.04;

        if (player.hp <= 2 && player.hp > 0) {
          pipeline.lowHpPulse = 0.45 + 0.45 * Math.sin(this.elapsedSec * 9.5);
        } else {
          pipeline.lowHpPulse = 0;
        }
      }
    }

    if (isHeavySwarm) {
      this.activeLightCount =
        2 + simulatedPlayers.length * 2 + props.length + Math.min(24, projectiles.length);
      return;
    }

    // 2. Render Dynamic Lightmap into Quarter-Res RenderTexture
    const ambientColor = BIOME_AMBIENT_COLORS[this.biome];
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
      const lx = worldX - viewX;
      const ly = worldY - viewY;
      if (
        lx + radius < -16 ||
        lx - radius > WORLD_VIEW_WIDTH + 16 ||
        ly + radius < -16 ||
        ly - radius > WORLD_VIEW_HEIGHT + 16
      ) {
        return;
      }
      this.brushSprite.setScale(((radius * 2) / 128) * LIGHTMAP_RES_SCALE);
      this.brushSprite.setTint(colorNum);
      this.brushSprite.setAlpha(clamp(alpha, 0, 1));
      this.lightmapRt.batchDraw(
        this.brushSprite,
        lx * LIGHTMAP_RES_SCALE,
        ly * LIGHTMAP_RES_SCALE,
      );
      lightsDrawn += 1;
    };

    // A. Main Player soft aura light + active shield glow
    drawLight(playerPos.x, playerPos.y, 175, 0xe0f2fe, 0.88);
    drawLight(playerPos.x, playerPos.y, 85, hexToNum(PLAYER_SLOT_COLORS[player.slot].hex), 0.45);
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
    for (let i = 0; i < simulatedPlayers.length; i++) {
      const sp = simulatedPlayers[i]!;
      drawLight(sp.pos.x, sp.pos.y, 145, 0xe0f2fe, 0.72);
      drawLight(sp.pos.x, sp.pos.y, 75, hexToNum(PLAYER_SLOT_COLORS[sp.state.slot].hex), 0.42);
    }

    // C. Props: Flickering Torches, Bioluminescent Mushrooms, Explosive Barrels
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
      } else if (prop.kind === 'glow_mushroom') {
        const pulse = Math.sin(this.elapsedSec * 3.2 + prop.id) * 0.08;
        radius = prop.lightRadius * (1 + pulse);
        alpha = 0.68 + pulse;
      } else if (prop.kind === 'explosive_barrel') {
        alpha = 0.52;
      }

      drawLight(prop.x, prop.y, radius, hexToNum(prop.lightColorHex), alpha);
    }

    // D. Glowing Interactive Surfaces (Lava, Burning Oil/Grass, Electrified Water, Poison Swamp)
    const minTx = Math.max(1, Math.floor(viewX / TILE_SIZE));
    const maxTx = Math.min(map.cols - 2, Math.ceil((viewX + WORLD_VIEW_WIDTH) / TILE_SIZE));
    const minTy = Math.max(1, Math.floor(viewY / TILE_SIZE));
    const maxTy = Math.min(map.rows - 2, Math.ceil((viewY + WORLD_VIEW_HEIGHT) / TILE_SIZE));

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        // Sample every tile for active dynamic surfaces, or 2x2 stride for static swamp/lava to minimize overdraw
        const surf = map.getSurface(tx, ty);
        if (surf === 'none' || surf === 'water' || surf === 'oil' || surf === 'grass' || surf === 'ash' || surf === 'ice') {
          continue;
        }
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = ty * TILE_SIZE + TILE_SIZE / 2;
        if (surf === 'burning_oil' || surf === 'burning_grass') {
          const flick = Math.sin(this.elapsedSec * 16 + tx * 3 + ty * 5) * 6;
          drawLight(wx, wy, 68 + flick, hexToNum(PALETTE.FLAME_ORANGE), 0.65);
        } else if (surf === 'electrified_water') {
          drawLight(wx, wy, 64, hexToNum(PALETTE.CYAN_FROST), 0.62);
        } else if (surf === 'lava' && (tx + ty) % 2 === 0) {
          drawLight(wx, wy, 78, hexToNum(PALETTE.FLAME_ORANGE), 0.62);
        } else if (surf === 'poison_swamp' && (tx + ty) % 2 === 0) {
          drawLight(wx, wy, 62, hexToNum(PALETTE.TOXIC_PURPLE), 0.42);
        }
      }
    }

    // E. Enemy status / telegraph lights (Spore Bomber glow, burning/frozen/shocked enemies)
    for (let i = 0; i < enemies.length; i += enemies.length > 30 ? 4 : 1) {
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

    // F. Projectile Point Lights (adaptive stride when bullet count > 64 to keep 60+ FPS with 600+ bullets)
    if (budget.enableProjectileLights && projectiles.length > 0) {
      const maxBulletLights = isHeavySwarm ? 24 : budget.tier === 'high' ? 72 : 36;
      const stride = Math.max(1, Math.ceil(projectiles.length / maxBulletLights));
      for (let i = 0; i < projectiles.length; i += stride) {
        const b = projectiles[i]!;
        let col = hexToNum(PALETTE.CYAN_FROST);
        if (b.team === 'enemy') col = hexToNum(PALETTE.CRIMSON_BRIGHT);
        else if (b.element === 'burn') col = hexToNum(PALETTE.FLAME_ORANGE);
        else if (b.element === 'chill') col = hexToNum(PALETTE.CYAN_FROST);
        else if (b.element === 'shock') col = hexToNum(PALETTE.VOLT_YELLOW);
        else if (b.element === 'poison') col = hexToNum(PALETTE.LIME_GLOW);
        else if (b.weaponId === 'scrap_shotgun') col = hexToNum(PALETTE.SOLAR_GOLD);

        drawLight(b.x, b.y, b.team === 'enemy' ? 36 : 32, col, 0.48);
      }
    }

    // G. Transient Flash Lights (Muzzle flashes, Explosions, Lightning arcs)
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
