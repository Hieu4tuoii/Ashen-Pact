import { afterEach, describe, expect, it, vi } from 'vitest';
import { PALETTE } from '../src/art/palette.js';
import {
  BAKED_FX_TEXTURE_KEYS,
  ENEMY_BULLET_VISUAL_SPEC,
} from '../src/art/texture-baker-fx.js';
import {
  bakeShaderVfxFlipbooks,
  computeShaderDirectionalScale,
  computeShaderNovaScale,
  resolveColorHexToNovaKey,
  resolveElementToNovaKey,
  resolveShaderStripFramePx,
  SHADER_CANONICAL_HITBOX_RADIUS_RATIO,
  SHADER_CANONICAL_LANCE_SPAN_RATIO,
  SHADER_FX_FRAME_COUNT,
  SHADER_FX_TEXTURE_KEYS,
  type ShaderFxTextureKey,
} from '../src/art/texture-baker-shader-fx.js';

interface RegisteredStripRecord {
  width: number;
  height: number;
  frames: Array<{ name: number; sourceIndex: number; x: number; y: number; w: number; h: number }>;
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
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
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
        const rec: RegisteredStripRecord = {
          width: canvas.width,
          height: canvas.height,
          frames: [],
        };
        registered.set(key, rec);
        return {
          add: (name: number, sourceIndex: number, x: number, y: number, w: number, h: number) => {
            rec.frames.push({ name, sourceIndex, x, y, w, h });
          },
        };
      },
    },
  };

  return scene;
}

describe('1:1 Top-Down Chiaroscuro Shader Sprite-Sheet Baker', () => {
  it('defines all 24 Chiaroscuro 14-frame flipbook texture keys (11 directional +X 360° + 13 circular 1:1)', () => {
    expect(SHADER_FX_FRAME_COUNT).toBe(14);
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

  it('maps 1:1 circular nova & archetype scales accurately to 1.0x WorldSim Euclidean hitbox radii with zero 3/4 squash', () => {
    expect(SHADER_CANONICAL_HITBOX_RADIUS_RATIO).toBeCloseTo(0.78 * 0.43, 5);

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

  it('bakes all 24 7x2 Hi-DPI sprite atlases (192/288/384px, <= 2688x768) and registers 14 square 1:1 frames (0..13) per texture', () => {
    const mockScene = createMockPhaserSceneForBaker();
    bakeShaderVfxFlipbooks(mockScene as never, 4);

    expect(mockScene.registered.size).toBe(24);
    expect(resolveShaderStripFramePx('fx_sh_hit_spark', 4)).toBe(192);
    expect(resolveShaderStripFramePx('fx_sh_muzzle_arcane', 4)).toBe(192);
    expect(resolveShaderStripFramePx('fx_sh_slash_steel', 4)).toBe(288);
    expect(resolveShaderStripFramePx('fx_sh_aegis_crest', 4)).toBe(288);
    expect(resolveShaderStripFramePx('fx_sh_falcon_sonic', 4)).toBe(288);
    expect(resolveShaderStripFramePx('fx_sh_nova_solar', 4)).toBe(384);
    expect(resolveShaderStripFramePx('fx_sh_vortex_gale', 4)).toBe(384);
    expect(resolveShaderStripFramePx('fx_sh_arcane_sigil', 4)).toBe(384);
    for (const key of SHADER_FX_TEXTURE_KEYS) {
      const rec = mockScene.registered.get(key);
      expect(rec, `Missing registered strip for ${key}`).toBeDefined();
      const expectedFramePx = resolveShaderStripFramePx(key, 4);
      expect(rec!.width).toBe(expectedFramePx * 7);
      expect(rec!.height).toBe(expectedFramePx * 2);
      expect(rec!.width).toBeLessThanOrEqual(4096);
      expect(rec!.height).toBeLessThanOrEqual(4096);
      expect(rec!.frames).toHaveLength(SHADER_FX_FRAME_COUNT);

      for (let f = 0; f < SHADER_FX_FRAME_COUNT; f++) {
        const col = f % 7;
        const row = Math.floor(f / 7);
        expect(rec!.frames[f]).toEqual({
          name: f,
          sourceIndex: 0,
          x: col * expectedFramePx,
          y: row * expectedFramePx,
          w: expectedFramePx,
          h: expectedFramePx,
        });
      }
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
    expect(ENEMY_BULLET_VISUAL_SPEC.depth).toBe(60);
    expect(ENEMY_BULLET_VISUAL_SPEC.neverTintByElement).toBe(true);
    expect(BAKED_FX_TEXTURE_KEYS).toContain('proj_enemy_orb');
    expect(BAKED_FX_TEXTURE_KEYS).not.toContain('fx_ambient_mist');
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
});
