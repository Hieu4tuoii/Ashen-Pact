import { afterEach, describe, expect, it, vi } from 'vitest';
import { PALETTE } from '../src/art/palette.js';
import {
  ALL_CUTOUT_KIT_FRAME_KEYS,
  BAKED_FX_TEXTURE_KEYS,
  bakeCutoutKit512,
  bakeElementalReactionMiniStrips,
  bakeProjectilesAndFx,
  computeRawAllSceneTexturesVramBytes,
  computeTotalVramBytes,
  CUTOUT_KIT_ATLAS_KEY,
  CUTOUT_KIT_BAKE_SCALE,
  type CutoutKitFrameKey,
  ELEMENTAL_REACTION_STRIP_KEYS,
  type ElementalReactionStripKey,
  ENEMY_BULLET_VISUAL_SPEC,
  getCutoutKitFrameSpec,
} from '../src/art/texture-baker-fx.js';
import { TextureBaker } from '../src/art/texture-baker.js';
import {
  bakeShaderVfxFlipbooks,
  computeShaderDirectionalScale,
  computeShaderNovaScale,
  computeSoftwareGlInkTexelWidth,
  getShaderBakerFamilySourcesForTest,
  getShaderBakerGlslSourceForTest,
  getShaderStripEntry,
  resolveColorHexToNovaKey,
  resolveElementToNovaKey,
  resolveShaderStripFramePx,
  SHADER_ATLAS_COLS,
  SHADER_ATLAS_ROWS,
  SHADER_CANONICAL_HITBOX_RADIUS_RATIO,
  SHADER_CANONICAL_LANCE_SPAN_RATIO,
  SHADER_FX_FRAME_COUNT,
  SHADER_FX_TEXTURE_KEYS,
  type ShaderFxTextureKey,
  type ShaderStripEntry,
} from '../src/art/texture-baker-shader-fx.js';

interface RegisteredStripRecord {
  width: number;
  height: number;
  frames: Array<{ name: number | string; sourceIndex: number; x: number; y: number; w: number; h: number }>;
}

const ORIGINAL_DOCUMENT = (globalThis as { document?: unknown }).document;

afterEach(() => {
  if (ORIGINAL_DOCUMENT === undefined) {
    delete (globalThis as { document?: unknown }).document;
  } else {
    (globalThis as { document?: unknown }).document = ORIGINAL_DOCUMENT;
  }
});

function createMock2dContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  };
}

function createMockPhaserSceneForBaker(customWebglContext?: unknown) {
  const registered = new Map<string, RegisteredStripRecord>();
  const mockDocument = {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`Unexpected element ${tag}`);
      return {
        width: 0,
        height: 0,
        getContext: (kind: string) => {
          if (kind === 'webgl' || kind === 'experimental-webgl') {
            return customWebglContext ?? null;
          }
          if (kind === '2d') {
            return createMock2dContext();
          }
          return null;
        },
      };
    },
  };

  (globalThis as unknown as { document: unknown }).document = mockDocument;

  const scene = {
    registered,
    textures: {
      exists: (key: string) => registered.has(key),
      remove: (key: string) => {
        registered.delete(key);
      },
      addCanvas: (key: string, canvas: { width: number; height: number }) => {
        const baseFrame = {
          cutX: 0,
          cutY: 0,
          cutWidth: canvas.width,
          cutHeight: canvas.height,
          width: canvas.width,
          height: canvas.height,
          halfWidth: Math.floor(canvas.width * 0.5),
          halfHeight: Math.floor(canvas.height * 0.5),
          centerX: Math.floor(canvas.width * 0.5),
          centerY: Math.floor(canvas.height * 0.5),
          realWidth: canvas.width,
          realHeight: canvas.height,
          data: {
            sourceSize: { w: canvas.width, h: canvas.height },
            spriteSourceSize: { w: canvas.width, h: canvas.height },
          },
          updateUVs: vi.fn(),
        };
        const rec: RegisteredStripRecord & { baseFrame?: typeof baseFrame } = {
          width: canvas.width,
          height: canvas.height,
          frames: [],
          baseFrame,
        };
        registered.set(key, rec);
        const texObj = {
          key,
          frames: { __BASE: baseFrame } as Record<string | number, unknown>,
          getSourceImage: () => ({ width: canvas.width, height: canvas.height }),
          source: [{ width: canvas.width, height: canvas.height }],
          width: canvas.width,
          height: canvas.height,
          add: (name: number | string, sourceIndex: number, x: number, y: number, w: number, h: number) => {
            const frameObj = { name, sourceIndex, x, y, w, h };
            rec.frames.push(frameObj);
            texObj.frames[name] = frameObj;
          },
        };
        return texObj;
      },
      get: (key: string) => {
        const rec = registered.get(key);
        if (!rec) return undefined;
        const framesRecord: Record<string | number, unknown> = { __BASE: rec.baseFrame };
        for (const f of rec.frames) {
          framesRecord[f.name] = f;
        }
        return {
          key,
          frames: framesRecord,
          getSourceImage: () => ({ width: rec.width, height: rec.height }),
          source: [{ width: rec.width, height: rec.height }],
          width: rec.width,
          height: rec.height,
          add: (name: number | string, sourceIndex: number, x: number, y: number, w: number, h: number) => {
            rec.frames.push({ name, sourceIndex, x, y, w, h });
          },
        };
      },
      getTextureKeys: () => Array.from(registered.keys()),
      get list() {
        const out: Record<string, unknown> = {};
        for (const k of registered.keys()) {
          out[k] = this.get(k);
        }
        return out;
      },
    },
  };

  return scene;
}

describe('1:1 Top-Down Cutout 2.0 Multi-Band SDF-Cel Shader Baker', () => {
  it('defines all 24 Cutout 2.0 8-frame flipbook texture keys (11 directional +X 360° + 13 circular 1:1)', () => {
    expect(SHADER_FX_FRAME_COUNT).toBe(8);
    expect(SHADER_ATLAS_COLS).toBe(4);
    expect(SHADER_ATLAS_ROWS).toBe(2);
    expect(SHADER_FX_TEXTURE_KEYS).toEqual([
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
    ]);
  });

  it('enforces 4x2 (8-frame) POT atlas geometry, [1.50, 2.20]px worldInkPx across all 24 entries, and neutral aegis_crest', () => {
    expect(SHADER_FX_FRAME_COUNT).toBe(8);
    expect(SHADER_ATLAS_COLS).toBe(4);
    expect(SHADER_ATLAS_ROWS).toBe(2);
    expect(SHADER_CANONICAL_HITBOX_RADIUS_RATIO).toBeCloseTo(0.41, 4);
    expect(SHADER_CANONICAL_LANCE_SPAN_RATIO).toBeCloseTo(0.82, 4);
    expect(getShaderStripEntry('fx_sh_aegis_crest').elemId).toBe(0);
    expect(getShaderStripEntry('fx_sh_slash_emerald').validRadiusBandPx).toEqual([63.0, 92.2]);

    for (const key of SHADER_FX_TEXTURE_KEYS) {
      const entry = getShaderStripEntry(key);
      const framePx = entry.sizeClass === 'small' ? 64 : entry.sizeClass === 'medium' ? 128 : 256;
      expect(Math.log2(framePx * 4) % 1).toBe(0);
      expect(Math.log2(framePx * 2) % 1).toBe(0);
      const denom = (entry.isLanceSpan ? 0.82 : 0.41) * framePx;
      const [rMin, rMax] = entry.validRadiusBandPx;
      expect((rMin / denom) * entry.canonicalInkTexels).toBeGreaterThanOrEqual(1.499);
      expect((rMax / denom) * entry.canonicalInkTexels).toBeLessThanOrEqual(2.201);
    }
  });

  it('guards GLSL against D3D11 pow(0, y) NaN and compensates uInkTexelWidth under software-GL 0.5x scale', () => {
    const glsl = getShaderBakerGlslSourceForTest();
    const stripped = glsl.replace(/float\s+safePow\s*\([^)]*\)\s*\{[^}]*\}/, '');
    expect(stripped).not.toMatch(/\bpow\s*\(/);
    expect(glsl).toContain('sdArcForwardX');
    expect(computeSoftwareGlInkTexelWidth(1.8, 32, 64)).toBeGreaterThanOrEqual(1.15);
  });

  it('maps 1:1 circular nova & archetype scales accurately to 1.0x WorldSim Euclidean hitbox radii with zero 3/4 squash', () => {
    expect(SHADER_CANONICAL_HITBOX_RADIUS_RATIO).toBeCloseTo(0.41, 4);
    expect(SHADER_CANONICAL_LANCE_SPAN_RATIO).toBeCloseTo(0.82, 4);

    const radialKeys: ShaderFxTextureKey[] = [
      'fx_sh_nova_solar',
      'fx_sh_vortex_gale',
      'fx_sh_bloom_briar',
      'fx_sh_spore_cloud',
      'fx_sh_anvil_storm',
      'fx_sh_geyser_plume',
      'fx_sh_shrapnel_corona',
      'fx_sh_arcane_sigil',
    ];

    for (const bakeScale of [4, 6, 8]) {
      for (const key of radialKeys) {
        for (const radiusPx of [48, 88, 110, 120]) {
          const framePx = resolveShaderStripFramePx(key, bakeScale);
          const scale = computeShaderNovaScale(radiusPx, key, bakeScale);
          const renderedWorldRadius = scale * SHADER_CANONICAL_HITBOX_RADIUS_RATIO * framePx;
          expect(renderedWorldRadius).toBeCloseTo(radiusPx, 4);
        }
      }

      for (const dirKey of [
        'fx_sh_slash_emerald',
        'fx_sh_aegis_crest',
        'fx_sh_falcon_sonic',
        'fx_sh_muzzle_arcane',
      ] as ShaderFxTextureKey[]) {
        const dirFramePx = resolveShaderStripFramePx(dirKey, bakeScale);
        const dirScale = computeShaderDirectionalScale(78, dirKey, bakeScale);
        expect(dirScale * SHADER_CANONICAL_HITBOX_RADIUS_RATIO * dirFramePx).toBeCloseTo(78, 4);
      }

      for (const spanKey of ['fx_sh_beam_lance', 'fx_sh_cone_blast'] as const) {
        const spanFramePx = resolveShaderStripFramePx(spanKey, bakeScale);
        const spanScale = computeShaderDirectionalScale(320, spanKey, bakeScale);
        expect(spanScale * SHADER_CANONICAL_LANCE_SPAN_RATIO * spanFramePx).toBeCloseTo(320, 4);
      }
    }
  });

  it('bakes all 24 4x2 POT sprite atlases (64/128/256px, <= 1024x512) and registers 8 square 1:1 frames (0..7) per texture', () => {
    const mockScene = createMockPhaserSceneForBaker();
    bakeShaderVfxFlipbooks(mockScene as never, 4);

    expect(mockScene.registered.size).toBe(24);
    expect(resolveShaderStripFramePx('fx_sh_hit_spark', 4)).toBe(64);
    expect(resolveShaderStripFramePx('fx_sh_muzzle_arcane', 4)).toBe(64);
    expect(resolveShaderStripFramePx('fx_sh_slash_steel', 4)).toBe(128);
    expect(resolveShaderStripFramePx('fx_sh_aegis_crest', 4)).toBe(64);
    expect(resolveShaderStripFramePx('fx_sh_falcon_sonic', 4)).toBe(64);
    expect(resolveShaderStripFramePx('fx_sh_nova_solar', 4)).toBe(256);
    expect(resolveShaderStripFramePx('fx_sh_vortex_gale', 4)).toBe(128);
    expect(resolveShaderStripFramePx('fx_sh_arcane_sigil', 4)).toBe(64);
    for (const key of SHADER_FX_TEXTURE_KEYS) {
      const rec = mockScene.registered.get(key);
      expect(rec, `Missing registered strip for ${key}`).toBeDefined();
      const expectedFramePx = resolveShaderStripFramePx(key, 4);
      expect(rec!.width).toBe(expectedFramePx * SHADER_ATLAS_COLS);
      expect(rec!.height).toBe(expectedFramePx * SHADER_ATLAS_ROWS);
      expect(rec!.width).toBeLessThanOrEqual(1024);
      expect(rec!.height).toBeLessThanOrEqual(512);
      expect(rec!.frames).toHaveLength(SHADER_FX_FRAME_COUNT);

      for (let f = 0; f < SHADER_FX_FRAME_COUNT; f++) {
        const col = f % SHADER_ATLAS_COLS;
        const row = Math.floor(f / SHADER_ATLAS_COLS);
        expect(rec!.frames[f]).toEqual({
          name: f,
          sourceIndex: 0,
          x: col * expectedFramePx,
          y: row * expectedFramePx,
          w: expectedFramePx,
          h: expectedFramePx,
        });
      }

      const baseFrame = (rec as unknown as {
        baseFrame?: {
          cutX: number;
          cutY: number;
          cutWidth: number;
          cutHeight: number;
          width: number;
          height: number;
          realWidth: number;
          realHeight: number;
          data: {
            sourceSize: { w: number; h: number };
            spriteSourceSize: { w: number; h: number };
          };
          updateUVs: ReturnType<typeof vi.fn>;
        };
      }).baseFrame;
      expect(baseFrame).toBeDefined();
      expect(baseFrame!.cutX).toBe(0);
      expect(baseFrame!.cutY).toBe(0);
      expect(baseFrame!.cutWidth).toBe(expectedFramePx);
      expect(baseFrame!.cutHeight).toBe(expectedFramePx);
      expect(baseFrame!.width).toBe(expectedFramePx);
      expect(baseFrame!.height).toBe(expectedFramePx);
      expect(baseFrame!.realWidth).toBe(expectedFramePx);
      expect(baseFrame!.realHeight).toBe(expectedFramePx);
      expect(baseFrame!.data.sourceSize.w).toBe(expectedFramePx);
      expect(baseFrame!.data.sourceSize.h).toBe(expectedFramePx);
      expect(baseFrame!.data.spriteSourceSize.w).toBe(expectedFramePx);
      expect(baseFrame!.data.spriteSourceSize.h).toBe(expectedFramePx);
      expect(baseFrame!.updateUVs).toHaveBeenCalledTimes(1);
    }
  });

  it('maps elements and palette hex colors deterministically to matching Chiaroscuro nova variants', () => {
    expect(resolveElementToNovaKey('burn')).toBe('fx_sh_nova_magma');
    expect(resolveElementToNovaKey('chill')).toBe('fx_sh_nova_cryo');
    expect(resolveElementToNovaKey('shock')).toBe('fx_sh_nova_thunder');
    expect(resolveElementToNovaKey('poison')).toBe('fx_sh_nova_venom');
    expect(resolveElementToNovaKey('none')).toBe('fx_sh_nova_solar');

    expect(resolveColorHexToNovaKey(PALETTE.CYAN_FROST)).toBe('fx_sh_nova_cryo');
    expect(resolveColorHexToNovaKey(PALETTE.FLAME_ORANGE)).toBe('fx_sh_nova_magma');
    expect(resolveColorHexToNovaKey(PALETTE.SOLAR_GOLD)).toBe('fx_sh_nova_solar');
    expect(resolveColorHexToNovaKey(PALETTE.VOLT_YELLOW)).toBe('fx_sh_nova_thunder');
    expect(resolveColorHexToNovaKey(PALETTE.LIME_GLOW)).toBe('fx_sh_nova_venom');
    expect(resolveColorHexToNovaKey(PALETTE.TOXIC_PURPLE)).toBe('fx_sh_nova_void');
  });

  it('preserves ENEMY_BULLET_VISUAL_SPEC (#E84545, depth 60) and core BAKED_FX_TEXTURE_KEYS invariants', () => {
    expect(ENEMY_BULLET_VISUAL_SPEC.fill).toBe(PALETTE.CRIMSON_BRIGHT);
    expect(ENEMY_BULLET_VISUAL_SPEC.core).toBe(PALETTE.BONE_WHITE);
    expect(ENEMY_BULLET_VISUAL_SPEC.outlineColor).toBe(PALETTE.INK_DARK);
    expect(ENEMY_BULLET_VISUAL_SPEC.depth).toBe(60);
    expect(ENEMY_BULLET_VISUAL_SPEC.neverTintByElement).toBe(true);
    expect(BAKED_FX_TEXTURE_KEYS).toContain('proj_enemy_small_orb');
    expect(BAKED_FX_TEXTURE_KEYS).toContain('proj_enemy_orb');
    expect(BAKED_FX_TEXTURE_KEYS).toContain('proj_enemy_heavy_orb');
    expect(BAKED_FX_TEXTURE_KEYS).toContain('proj_enemy_lance');
    expect(BAKED_FX_TEXTURE_KEYS).not.toContain('proj_enemy_wave');
    expect(BAKED_FX_TEXTURE_KEYS).not.toContain('proj_enemy_diamond');
    expect(BAKED_FX_TEXTURE_KEYS).not.toContain('proj_enemy_ring_bolt');
    expect(BAKED_FX_TEXTURE_KEYS).not.toContain('fx_ambient_mist');
  });

  it('bakes proj_enemy_small_orb, proj_enemy_orb, proj_enemy_heavy_orb, and streamlined proj_enemy_lance while excluding retired enemy projectile keys', () => {
    const mockScene = createMockPhaserSceneForBaker();
    const scale = 4;
    bakeProjectilesAndFx(mockScene as never, scale);

    expect(mockScene.registered.has('proj_enemy_small_orb')).toBe(true);
    expect(mockScene.registered.has('proj_enemy_orb')).toBe(true);
    expect(mockScene.registered.has('proj_enemy_heavy_orb')).toBe(true);
    expect(mockScene.registered.has('proj_enemy_lance')).toBe(true);
    expect(mockScene.registered.has('fx_enemy_bullet_glow')).toBe(true);

    expect(mockScene.registered.has('proj_enemy_wave')).toBe(false);
    expect(mockScene.registered.has('proj_enemy_diamond')).toBe(false);
    expect(mockScene.registered.has('proj_enemy_ring_bolt')).toBe(false);

    expect(mockScene.registered.get('proj_enemy_small_orb')).toMatchObject({
      width: 24 * scale,
      height: 24 * scale,
    });
    expect(mockScene.registered.get('proj_enemy_orb')).toMatchObject({
      width: 28 * scale,
      height: 28 * scale,
    });
    expect(mockScene.registered.get('proj_enemy_heavy_orb')).toMatchObject({
      width: 32 * scale,
      height: 32 * scale,
    });
    expect(mockScene.registered.get('proj_enemy_lance')).toMatchObject({
      width: 30 * scale,
      height: 22 * scale,
    });

    const expectedCanvasKeys = BAKED_FX_TEXTURE_KEYS.filter((k) => k !== 'fx_light_radial')
      .slice()
      .sort();
    expect([...mockScene.registered.keys()].sort()).toEqual(expectedCanvasKeys);
  });

  it('cleans up WebGL1 buffers, programs, and loses the offscreen WebGL context after baking and on link failure', () => {
    const createMockGl = (linkOk: boolean) => {
      const loseContext = vi.fn();
      let nextId = 1;
      return {
        loseContext,
        gl: {
          VERTEX_SHADER: 0x8b31,
          FRAGMENT_SHADER: 0x8b30,
          COMPILE_STATUS: 0x8b81,
          LINK_STATUS: 0x8b82,
          ARRAY_BUFFER: 0x8892,
          STATIC_DRAW: 0x88e4,
          BLEND: 0x0be2,
          DEPTH_TEST: 0x0b71,
          COLOR_BUFFER_BIT: 0x4000,
          FLOAT: 0x1406,
          TRIANGLE_STRIP: 0x0005,
          createShader: vi.fn(() => ({ id: nextId++ })),
          shaderSource: vi.fn(),
          compileShader: vi.fn(),
          getShaderParameter: vi.fn(() => true),
          deleteShader: vi.fn(),
          createProgram: vi.fn(() => ({ id: nextId++ })),
          attachShader: vi.fn(),
          linkProgram: vi.fn(),
          getProgramParameter: vi.fn(() => linkOk),
          deleteProgram: vi.fn(),
          createBuffer: vi.fn(() => ({ id: nextId++ })),
          bindBuffer: vi.fn(),
          bufferData: vi.fn(),
          deleteBuffer: vi.fn(),
          disable: vi.fn(),
          getAttribLocation: vi.fn(() => 0),
          getUniformLocation: vi.fn(() => ({ loc: nextId++ })),
          viewport: vi.fn(),
          clearColor: vi.fn(),
          clear: vi.fn(),
          useProgram: vi.fn(),
          enableVertexAttribArray: vi.fn(),
          vertexAttribPointer: vi.fn(),
          uniform1f: vi.fn(),
          drawArrays: vi.fn(),
          getExtension: vi.fn((ext: string) =>
            ext === 'WEBGL_lose_context' ? { loseContext } : null,
          ),
        },
      };
    };

    const okMock = createMockGl(true);
    const okScene = createMockPhaserSceneForBaker(okMock.gl);
    bakeShaderVfxFlipbooks(okScene as never, 4);
    expect(okScene.registered.size).toBe(24);
    expect(okMock.gl.drawArrays).toHaveBeenCalledTimes(24);
    expect(okMock.gl.deleteShader).toHaveBeenCalledTimes(6);
    expect(okMock.gl.deleteBuffer).toHaveBeenCalledTimes(1);
    expect(okMock.gl.deleteProgram).toHaveBeenCalledTimes(5);
    expect(okMock.loseContext).toHaveBeenCalledTimes(1);

    const failMock = createMockGl(false);
    const failScene = createMockPhaserSceneForBaker(failMock.gl);
    bakeShaderVfxFlipbooks(failScene as never, 4);
    // Falls back to deterministic 2D baker while still freeing shaders/programs & WebGL context
    expect(failScene.registered.size).toBe(24);
    expect(failMock.gl.deleteProgram).toHaveBeenCalledTimes(5);
    expect(failMock.loseContext).toHaveBeenCalledTimes(1);
  });

  it('generates WebGL1 LINEAR_MIPMAP_LINEAR mipmaps on small POT (256x128) textures uploaded to Phaser', () => {
    const mockGl = {
      TEXTURE_2D: 0x0de1,
      TEXTURE_MIN_FILTER: 0x2801,
      LINEAR_MIPMAP_LINEAR: 0x2703,
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      generateMipmap: vi.fn(),
    };
    const mockScene = {
      ...createMockPhaserSceneForBaker(),
      renderer: { gl: mockGl },
      game: { renderer: { gl: mockGl } },
    };
    const origAddCanvas = mockScene.textures.addCanvas;
    mockScene.textures.addCanvas = (key: string, canvas: { width: number; height: number }) => {
      const tex = origAddCanvas(key, canvas);
      (tex as unknown as { source: Array<{ glTexture: { webGLTexture: object } }> }).source = [
        { glTexture: { webGLTexture: { id: `tex_${key}` } } },
      ];
      return tex;
    };
    bakeShaderVfxFlipbooks(mockScene as never, 4);
    // 7 small keys should generate mipmaps
    expect(mockGl.generateMipmap).toHaveBeenCalledTimes(7);
    expect(mockGl.texParameteri).toHaveBeenCalledWith(
      mockGl.TEXTURE_2D,
      mockGl.TEXTURE_MIN_FILTER,
      mockGl.LINEAR_MIPMAP_LINEAR,
    );
  });

  it('downscales shader bake render viewport by 0.5x ONLY when headless automation is active, ?freeze=1 is off, and WebGL renderer is software GL', () => {
    const createSwiftShaderGl = (rendererName: string) => {
      let nextId = 1;
      const UNMASKED_RENDERER_WEBGL = 0x9246;
      return {
        VERTEX_SHADER: 0x8b31,
        FRAGMENT_SHADER: 0x8b30,
        COMPILE_STATUS: 0x8b81,
        LINK_STATUS: 0x8b82,
        ARRAY_BUFFER: 0x8892,
        STATIC_DRAW: 0x88e4,
        BLEND: 0x0be2,
        DEPTH_TEST: 0x0b71,
        COLOR_BUFFER_BIT: 0x4000,
        FLOAT: 0x1406,
        TRIANGLE_STRIP: 0x0005,
        RENDERER: 0x1f01,
        createShader: vi.fn(() => ({ id: nextId++ })),
        shaderSource: vi.fn(),
        compileShader: vi.fn(),
        getShaderParameter: vi.fn(() => true),
        deleteShader: vi.fn(),
        createProgram: vi.fn(() => ({ id: nextId++ })),
        attachShader: vi.fn(),
        linkProgram: vi.fn(),
        getProgramParameter: vi.fn(() => true),
        deleteProgram: vi.fn(),
        createBuffer: vi.fn(() => ({ id: nextId++ })),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        deleteBuffer: vi.fn(),
        disable: vi.fn(),
        getAttribLocation: vi.fn(() => 0),
        getUniformLocation: vi.fn(() => ({ loc: nextId++ })),
        viewport: vi.fn(),
        clearColor: vi.fn(),
        clear: vi.fn(),
        useProgram: vi.fn(),
        enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        uniform1f: vi.fn(),
        drawArrays: vi.fn(),
        getParameter: vi.fn((param: number) =>
          param === UNMASKED_RENDERER_WEBGL || param === 0x1f01 ? rendererName : null,
        ),
        getExtension: vi.fn((ext: string) => {
          if (ext === 'WEBGL_debug_renderer_info') return { UNMASKED_RENDERER_WEBGL };
          if (ext === 'WEBGL_lose_context') return { loseContext: vi.fn() };
          return null;
        }),
      };
    };

    try {
      // 1. Real user (webdriver: false) on software GL (llvmpipe / SwiftShader) -> full resolution (large nova: 256 * 4 = 1024, 256 * 2 = 512)
      vi.stubGlobal('navigator', { webdriver: false });
      vi.stubGlobal('window', { location: { search: '' } });
      const userSwGl = createSwiftShaderGl('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))');
      const userScene = createMockPhaserSceneForBaker(userSwGl);
      bakeShaderVfxFlipbooks(userScene as never, 4);
      expect(userSwGl.viewport).toHaveBeenCalledWith(0, 0, 256 * 4, 256 * 2);
      expect(userSwGl.viewport).not.toHaveBeenCalledWith(0, 0, 32 * 4, 32 * 2);

      // 2. Headless automation (webdriver: true) + ?freeze=1 on software GL -> full resolution
      vi.stubGlobal('navigator', { webdriver: true });
      vi.stubGlobal('window', { location: { search: '?freeze=1' } });
      const freezeSwGl = createSwiftShaderGl('Mesa llvmpipe (LLVM 15.0.6, 256 bits)');
      const freezeScene = createMockPhaserSceneForBaker(freezeSwGl);
      bakeShaderVfxFlipbooks(freezeScene as never, 4);
      expect(freezeSwGl.viewport).toHaveBeenCalledWith(0, 0, 256 * 4, 256 * 2);
      expect(freezeSwGl.viewport).not.toHaveBeenCalledWith(0, 0, 32 * 4, 32 * 2);

      // 3. Headless automation (webdriver: true) + hardware GPU -> full resolution
      vi.stubGlobal('navigator', { webdriver: true });
      vi.stubGlobal('window', { location: { search: '' } });
      const hwGl = createSwiftShaderGl('ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)');
      const hwScene = createMockPhaserSceneForBaker(hwGl);
      bakeShaderVfxFlipbooks(hwScene as never, 4);
      expect(hwGl.viewport).toHaveBeenCalledWith(0, 0, 256 * 4, 256 * 2);

      // 4. Headless automation (webdriver: true) + no ?freeze=1 + software GL -> 0.5x downscaled render viewport (128 * 4 = 512, 128 * 2 = 256)
      vi.stubGlobal('navigator', { webdriver: true });
      vi.stubGlobal('window', { location: { search: '' } });
      const autoSwGl = createSwiftShaderGl('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))');
      const autoScene = createMockPhaserSceneForBaker(autoSwGl);
      bakeShaderVfxFlipbooks(autoScene as never, 4);
      expect(autoSwGl.viewport).toHaveBeenCalledWith(0, 0, 128 * 4, 128 * 2);
      // Output atlas frames still preserve canonical 256px dimensions
      expect(autoScene.registered.get('fx_sh_nova_solar')?.width).toBe(256 * 4);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('verifies per-program GLSL symbol declaration, shaderId dispatch integrity, and 4+4 muzzle variant flips', () => {
    const families = getShaderBakerFamilySourcesForTest();
    expect(families).toHaveLength(5);

    const expectedGeneratorsPerFamily = [
      ['vfxSlash', 'vfxConeBlast', 'vfxBeamLance', 'vfxMuzzleBurst', 'vfxHitSpark'],
      ['vfxSolarOrMagmaNova', 'vfxThunderRadial'],
      ['vfxCryoShatter', 'vfxVenomNova', 'vfxVoidImplosion'],
      ['vfxVortexGale', 'vfxBloomBriar', 'vfxSporeCloud', 'vfxAnvilStorm', 'vfxGeyserPlume'],
      ['vfxShrapnelCorona', 'vfxAegisCrest', 'vfxFalconSonic', 'vfxArcaneSigil', 'vfxMuzzleArcane'],
    ];

    families.forEach((src, idx) => {
      // 1. Zero cross-family undeclared vfx* calls
      const declared = new Set(
        [...src.matchAll(/void\s+(vfx[A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1]),
      );
      const mainBody = src.slice(src.lastIndexOf('void main'));
      const calledInMain = [
        ...mainBody.matchAll(/\b(vfx[A-Za-z0-9_]+)\s*\(/g),
      ].map((m) => m[1]);

      for (const fn of calledInMain) {
        expect(declared.has(fn), `Undeclared call ${fn} in family ${idx}`).toBe(true);
      }

      // 2. All expected generators are present and called in main
      for (const fn of expectedGeneratorsPerFamily[idx]!) {
        expect(declared.has(fn), `Missing declaration for ${fn} in family ${idx}`).toBe(true);
        expect(calledInMain).toContain(fn);
      }
    });

    // 3. 4+4 variant flip in Family 0 (vfxMuzzleBurst) and Family 4 (vfxMuzzleArcane)
    for (const famIdx of [0, 4]) {
      const src = families[famIdx]!;
      expect(src).toMatch(/mod\s*\(\s*frameIdx\s*,\s*4\.0\s*\)/);
      expect(src).toMatch(/floor\s*\(\s*frameIdx\s*\/\s*4\.0\s*\)/);
    }
  });

  it('packs all 51 Cutout 2.0 kit entries inside 512x512 POT with +2px border and keeps total VRAM < 25.0 MB', () => {
    // 1. Verify empty scene has exactly 0 total VRAM (zero hardcoded byte floor)
    const emptyScene = createMockPhaserSceneForBaker();
    expect(computeTotalVramBytes(emptyScene as unknown as Phaser.Scene)).toBe(0);

    const scene = createMockPhaserSceneForBaker();
    TextureBaker.bakeAll(scene as unknown as Phaser.Scene, 1.5, true);

    const kitTex = scene.textures.get(CUTOUT_KIT_ATLAS_KEY);
    expect(kitTex).toBeDefined();
    expect(kitTex?.getSourceImage().width).toBe(512);
    expect(kitTex?.getSourceImage().height).toBe(512);

    expect(ALL_CUTOUT_KIT_FRAME_KEYS).toHaveLength(51);

    const rects: Array<{ key: string; x: number; y: number; w: number; h: number }> = [];
    for (const key of ALL_CUTOUT_KIT_FRAME_KEYS) {
      const spec = getCutoutKitFrameSpec(key);
      if (key === 'fx_compact_burst_4f') {
        expect(spec.w).toBe(256);
        expect(spec.h).toBe(64);
      } else {
        expect(spec.w).toBe((3 * spec.worldW + 4) * spec.frameCount);
        expect(spec.h).toBe(3 * spec.worldH + 4);
      }
      expect(spec.x + spec.w).toBeLessThanOrEqual(512);
      expect(spec.y + spec.h).toBeLessThanOrEqual(512);
      for (const prev of rects) {
        const overlaps =
          spec.x < prev.x + prev.w &&
          spec.x + spec.w > prev.x &&
          spec.y < prev.y + prev.h &&
          spec.y + spec.h > prev.y;
        expect(overlaps, `${key} overlaps ${prev.key}`).toBe(false);
      }
      rects.push({ key, ...spec });

      // Sub-frame registration verification on fx_cutout_kit_512
      expect(kitTex?.frames[key]).toBeDefined();
      if (spec.frameCount > 1) {
        for (let f = 0; f < spec.frameCount; f++) {
          expect(kitTex?.frames[`${key}_${f}`]).toBeDefined();
        }
      }
    }

    expect(ELEMENTAL_REACTION_STRIP_KEYS).toHaveLength(6);
    for (const rxKey of ELEMENTAL_REACTION_STRIP_KEYS) {
      const rxTex = scene.textures.get(rxKey);
      expect(rxTex).toBeDefined();
      expect(rxTex?.getSourceImage().width).toBe(256);
      expect(rxTex?.getSourceImage().height).toBe(64);
      for (let f = 0; f < 4; f++) {
        expect(rxTex?.frames[f] ?? rxTex?.frames[String(f)]).toBeDefined();
      }
    }

    // 2. Dynamic VRAM ledger checks
    const totalVram = computeTotalVramBytes(scene as unknown as Phaser.Scene);
    expect(totalVram).toBeGreaterThan(14_700_000);
    expect(totalVram).toBeLessThanOrEqual(24_950_000);

    const rawAllVram = computeRawAllSceneTexturesVramBytes(scene as unknown as Phaser.Scene);
    expect(rawAllVram).toBeGreaterThan(totalVram);

    // 3. Dynamic scene.textures iteration test: adding extra canvas texture increases VRAM by exact w*h*4 bytes
    const beforeRogue = computeTotalVramBytes(scene as unknown as Phaser.Scene);
    scene.textures.addCanvas('fx_rogue_probe', { width: 32, height: 16 });
    const afterRogue = computeTotalVramBytes(scene as unknown as Phaser.Scene);
    expect(afterRogue - beforeRogue).toBe(32 * 16 * 4); // 2048 bytes
    scene.textures.remove('fx_rogue_probe');

    // 4. Cache-hit guard check: removing CUTOUT_KIT_ATLAS_KEY and calling bakeAll with force=false re-bakes it
    scene.textures.remove(CUTOUT_KIT_ATLAS_KEY);
    expect(scene.textures.exists(CUTOUT_KIT_ATLAS_KEY)).toBe(false);
    TextureBaker.bakeAll(scene as unknown as Phaser.Scene, 1.5, false);
    expect(scene.textures.exists(CUTOUT_KIT_ATLAS_KEY)).toBe(true);
  });
});
