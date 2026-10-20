# Phase P0 — Visual Verification Infrastructure & Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic screenshot capture catalog (`@visual` / `pnpm shots`), automated CIE L\*/HSL metrics & pixel-diff analyzer (`tools/visual-metrics.ts`), headed GPU performance benchmark (`pnpm perf`), client query hooks (`?seed=`, `?freeze=1`, `?lighting=0`, `?testHooks=1`), and capture the full v0.1.0 baseline (`docs/screenshots/polish-p0/baseline/`, `metrics.json`, `review-baseline.md`, `docs/POLISH_BASELINE.md`).

**Architecture:** We add a pure TypeScript PNG analysis & diff module (`tools/visual-metrics.ts`) backed by `pngjs` and `pixelmatch` and tested via Vitest TDD on synthetic PNG buffers. On the client, a small query-param module (`apps/client/src/core/visual-query.ts`) parses `?seed=`, `?freeze=1`, `?lighting=0`, and `?testHooks=1` so scenes run with fixed `1/60s` delta, seeded client RNG, and toggleable lighting/PostFX. Playwright's `@visual` suite (`tests/e2e/visual.spec.ts` + `tests/e2e/helpers/visual-scenes.ts`) is separated from `pnpm e2e` (`--grep-invert @visual`) and invoked via `pnpm shots` (`tools/run-shots.ts`), while `pnpm perf` (`tools/run-perf.ts`) measures headed real-GPU frame times (`p50`/`p95`) and FPS.

**Tech Stack:** TypeScript 5.9 (strict), Vitest 2, Playwright 1.64, Phaser 3, `pngjs`, `pixelmatch`.

**Spec:** `docs/superpowers/specs/2026-10-20-polish-v0.2.0-design.md` (Sections 0.3, 0.4, 4 — Phase P0, 5, 6).

## Global Constraints

- `pnpm verify` xanh: typecheck, lint, test, build, e2e. Không được skip hay xóa test để "cho pass". Bộ chụp ảnh `@visual` **không** nằm trong `pnpm verify` (tách ở P0) để gate không chậm hay flaky.
- 0 error/warning console trong E2E.
- **Hiệu năng:** đo ở chế độ **headed với GPU thật**. Ghi model GPU vào PROGRESS, lấy bằng `WEBGL_debug_renderer_info` (`UNMASKED_RENDERER_WEBGL`) ngay trong trang; nếu ra SwiftShader/ANGLE software thì kết quả không hợp lệ. Số đo so sánh là **frame time p50/p95 (ms)**, chạy Chromium với `--disable-gpu-vsync --disable-frame-rate-limit`, khởi động ấm 5s rồi đo 20s. Ngưỡng: Stress test (`__GAME_STRESS_TEST__`, 4P + 80 quái + 600 đạn) ở 1080p High: **≥ 58 FPS trung bình khi bật vsync bình thường**, và **frame time p95 không tăng quá 15% so với baseline P0**; Cảnh chơi thường ≥ 60 FPS (vsync bật); Không tăng heap liên tục.
- Co-op không vỡ: test phase4 (4 client qua IP LAN) vẫn pass. Mọi thay đổi chỉ mang tính hình ảnh phải **nằm ở client**, không đụng `packages/shared` sim.
- Giữ kỷ luật kiến trúc module hóa (`< 1000` dòng/file).
- Định nghĩa bắt buộc trong `tools/visual-metrics.ts`: Độ sáng = CIE L\* (0–100), tính từ sRGB; Tương phản sàn = ΔL\* (p95 − p5); Saturation = HSL S (0–1); Mỗi cảnh môi trường được đo hai lần: một lần với `?lighting=0` (chỉ texture, không có lightmap/PostFX) và một lần có lighting đầy đủ.
- DoD P0: 2 lần chạy `pnpm shots` liên tiếp với `?freeze=1` cho pixel-diff < 0.5% trên mọi cảnh (được mask vùng động như ping/FPS); `metrics.json` có số đo sàn của 3 biome (cả `?lighting=0` và có lighting); review baseline đã lưu; `docs/POLISH_BASELINE.md` hoàn tất.

## Review Focus

1. **Out-of-bounds crop rectangles in `analyzePngRegions`:** If a sample region `{ x, y, width, height }` partially exceeds image dimensions or has zero pixels after clamping, `analyzePngRegions` must clamp to valid bounds and throw a clear error if the clamped region is empty rather than returning `NaN`. (Pinned in Task 1 unit test).
2. **Achromatic / near-black pixels in `srgbToHslSaturation` and `srgbToCieL`:** Pure black `(0,0,0)`, pure white `(255,255,255)`, and equal-channel grays `(c,c,c)` must return exact `0` saturation (no division by zero) and accurate CIE L\* (`0` and `100`). (Pinned in Task 1 unit test).
3. **Hex and invalid `?seed=` values in `parseVisualQuery`:** `?seed=0x1337c0de`, `?seed=42`, and invalid `?seed=abc` must parse deterministically without returning `NaN` (falling back to default seed `0x1337c0de` on invalid input). (Pinned in Task 2 unit test).
4. **Non-deterministic client `Math.random()` / time drift under `?freeze=1`:** Campfire embers in `MenuScene`, torch flicker in `LightingPipeline`, and particles in `CombatFxManager` must use deterministic time/PRNG when `freeze=1` so two captures of the same scene differ by `< 0.5%` pixels. (Pinned in Task 2 & Task 3 verification).
5. **`?lighting=0` leaving PostFX bloom/contrast/vignette active:** When `?lighting=0` is set, both `lightmapRt` AND `BiomePostFxPipeline` must be disabled on the camera so unlit floor metrics measure pure texture colors without contrast/color-grade distortion. (Pinned in Task 2 & Task 3).

---

### Task 1: Visual Metrics, Color Math (`CIE L*`, HSL `S`), Pixel-Diff & Strip Stitching (`tools/visual-metrics.ts`)

**Files:**
- Modify: `package.json:1-32`
- Create: `tools/visual-metrics.ts`
- Test: `packages/shared/test/visual-metrics.test.ts`

**Interfaces:**
- Consumes: `pngjs`, `pixelmatch`
- Produces:
  - `srgbToCieL(r: number, g: number, b: number): number`
  - `srgbToHslSaturation(r: number, g: number, b: number): number`
  - `SampleRect { name: string; x: number; y: number; width: number; height: number }`
  - `RegionMetrics { meanL: number; p5L: number; p95L: number; deltaL: number; minL: number; maxL: number; meanS: number; contrastWithInkDark: number; sampleCount: number }`
  - `analyzePngBufferRegions(pngBuffer: Buffer, regions: SampleRect[]): Record<string, RegionMetrics>`
  - `comparePngBuffers(bufA: Buffer, bufB: Buffer, maskRects?: SampleRect[]): { diffPixels: number; totalPixels: number; diffRatio: number; diffPngBuffer: Buffer }`
  - `convertPngBufferToGrayscale(pngBuffer: Buffer): Buffer`
  - `stitchPngBuffersHorizontal(buffers: Buffer[]): Buffer`
  - `computeSceneEnvironmentSummary(unlitRegions: Record<string, RegionMetrics>, litRegions: Record<string, RegionMetrics>): { floorMeanL: number; floorDeltaL: number; centerDeltaL: number; floorMeanS: number; contrastWithInkDark: number; minLitFloorL: number; cornerRetentionRatio: number; brazierLightPoolDeltaL: number }`

- [ ] **Step 1: Install `pngjs` and `pixelmatch` devDependencies and update `package.json` scripts**

Add `pngjs`, `@types/pngjs`, `pixelmatch`, `@types/pixelmatch` to root `package.json` devDependencies (`pnpm add -D -w pngjs @types/pngjs pixelmatch @types/pixelmatch`) and update `"e2e"` in `package.json` to `"playwright test --grep-invert @visual"`.

- [ ] **Step 2: Write the failing unit tests in `packages/shared/test/visual-metrics.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import {
  analyzePngBufferRegions,
  comparePngBuffers,
  computeSceneEnvironmentSummary,
  convertPngBufferToGrayscale,
  srgbToCieL,
  srgbToHslSaturation,
  stitchPngBuffersHorizontal,
} from '../../../tools/visual-metrics.js';

function makeTestPng(
  width: number,
  height: number,
  pixelFn: (x: number, y: number) => [number, number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const [r, g, b, a] = pixelFn(x, y);
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

describe('visual-metrics color math & PNG analyzers', () => {
  it('computes accurate CIE L* and HSL saturation S for known reference sRGB colors', () => {
    expect(srgbToCieL(0, 0, 0)).toBeCloseTo(0, 3);
    expect(srgbToCieL(255, 255, 255)).toBeCloseTo(100, 2);
    // INK_DARK #141019 = (20, 16, 25) -> L* ~ 5.25
    const inkL = srgbToCieL(0x14, 0x10, 0x19);
    expect(inkL).toBeGreaterThan(4.5);
    expect(inkL).toBeLessThan(6.0);

    expect(srgbToHslSaturation(0, 0, 0)).toBe(0);
    expect(srgbToHslSaturation(255, 255, 255)).toBe(0);
    expect(srgbToHslSaturation(128, 128, 128)).toBe(0);
    expect(srgbToHslSaturation(255, 0, 0)).toBeCloseTo(1, 5);
  });

  it('analyzes rectangular regions, clamps out-of-bounds rects, and throws on empty regions', () => {
    // Top half #3D4F47 (61, 79, 71), bottom half #303E38 (48, 62, 56)
    const buf = makeTestPng(20, 20, (_x, y) =>
      y < 10 ? [0x3d, 0x4f, 0x47, 255] : [0x30, 0x3e, 0x38, 255],
    );
    const res = analyzePngBufferRegions(buf, [
      { name: 'top', x: 0, y: 0, width: 20, height: 10 },
      { name: 'all', x: -5, y: 0, width: 30, height: 25 },
    ]);
    expect(res.top!.deltaL).toBeCloseTo(0, 3);
    expect(res.top!.meanL).toBeGreaterThan(30);
    expect(res.top!.meanS).toBeLessThan(0.2);
    expect(res.all!.deltaL).toBeGreaterThan(5);
    expect(res.all!.sampleCount).toBe(400);

    expect(() =>
      analyzePngBufferRegions(buf, [{ name: 'outside', x: 50, y: 50, width: 10, height: 10 }]),
    ).toThrow(/empty/i);
  });

  it('compares PNG buffers with optional maskRects and stitches strips / converts grayscale', () => {
    const bufA = makeTestPng(16, 16, () => [40, 60, 80, 255]);
    const bufB = makeTestPng(16, 16, (x, y) =>
      x < 4 && y < 4 ? [250, 20, 20, 255] : [40, 60, 80, 255],
    );

    const unmasked = comparePngBuffers(bufA, bufB);
    expect(unmasked.diffPixels).toBe(16);
    expect(unmasked.diffRatio).toBeCloseTo(16 / 256, 5);

    const masked = comparePngBuffers(bufA, bufB, [
      { name: 'hudMask', x: 0, y: 0, width: 4, height: 4 },
    ]);
    expect(masked.diffPixels).toBe(0);
    expect(masked.diffRatio).toBe(0);

    const grayBuf = convertPngBufferToGrayscale(bufB);
    const grayPng = PNG.sync.read(grayBuf);
    expect(grayPng.data[0]).toBe(grayPng.data[1]);
    expect(grayPng.data[1]).toBe(grayPng.data[2]);

    const stripBuf = stitchPngBuffersHorizontal([bufA, bufB]);
    const stripPng = PNG.sync.read(stripBuf);
    expect(stripPng.width).toBe(32);
    expect(stripPng.height).toBe(16);
  });

  it('computes environment summary metrics from unlit and lit region tables', () => {
    const unlit = {
      floor_all: { meanL: 32, p5L: 27, p95L: 36, deltaL: 9, minL: 26, maxL: 37, meanS: 0.14, contrastWithInkDark: 26.7, sampleCount: 100 },
      center_arena: { meanL: 32, p5L: 29, p95L: 34, deltaL: 5, minL: 28, maxL: 35, meanS: 0.13, contrastWithInkDark: 26.7, sampleCount: 100 },
      corner_tl: { meanL: 32, p5L: 30, p95L: 34, deltaL: 4, minL: 30, maxL: 34, meanS: 0.14, contrastWithInkDark: 26.7, sampleCount: 50 },
    };
    const lit = {
      floor_all: { meanL: 28, p5L: 24, p95L: 32, deltaL: 8, minL: 22, maxL: 33, meanS: 0.14, contrastWithInkDark: 22.7, sampleCount: 100 },
      center_arena: { meanL: 28, p5L: 25, p95L: 30, deltaL: 5, minL: 24, maxL: 31, meanS: 0.13, contrastWithInkDark: 22.7, sampleCount: 100 },
      corner_tl: { meanL: 27.5, p5L: 26, p95L: 29, deltaL: 3, minL: 25, maxL: 29, meanS: 0.14, contrastWithInkDark: 22.2, sampleCount: 50 },
      brazier_pool: { meanL: 39, p5L: 35, p95L: 43, deltaL: 8, minL: 34, maxL: 44, meanS: 0.25, contrastWithInkDark: 33.7, sampleCount: 50 },
    };
    const summary = computeSceneEnvironmentSummary(unlit, lit);
    expect(summary.floorMeanL).toBe(32);
    expect(summary.centerDeltaL).toBe(5);
    expect(summary.cornerRetentionRatio).toBeCloseTo(27.5 / 32, 3);
    expect(summary.brazierLightPoolDeltaL).toBeCloseTo(39 - 28, 3);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ashen-pact/shared test -- visual-metrics` (or `npx vitest run packages/shared/test/visual-metrics.test.ts`)
Expected: FAIL with module `../../../tools/visual-metrics.js` not found.

- [ ] **Step 4: Implement `tools/visual-metrics.ts`**

Implement `srgbToCieL`, `srgbToHslSaturation`, `analyzePngBufferRegions`, `analyzePngFileRegions`, `comparePngBuffers`, `comparePngFiles`, `convertPngBufferToGrayscale`, `stitchPngBuffersHorizontal`, and `computeSceneEnvironmentSummary` in `tools/visual-metrics.ts`. Also add a CLI entry point when invoked directly (`tsx tools/visual-metrics.ts --dir <shotDir>`) that reads a `scene-manifest.json` in `<shotDir>` and outputs `<shotDir>/metrics.json`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/shared/test/visual-metrics.test.ts`
Expected: PASS (4/4 tests passing).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml tools/visual-metrics.ts packages/shared/test/visual-metrics.test.ts
git commit -m "feat(tools): add CIE L*/HSL visual metrics, pixel-diff, and strip stitcher"
```

---

### Task 2: Client Deterministic Visual & Lighting Query Hooks (`?seed=`, `?freeze=1`, `?lighting=0`, `?testHooks=1`)

**Files:**
- Create: `apps/client/src/core/visual-query.ts`
- Modify: `apps/client/src/ui/debug-overlay.ts:130-165`
- Modify: `apps/client/src/scenes/MenuScene.ts:45-160,680-780`
- Modify: `apps/client/src/scenes/GameScene.ts:45-60,340-360,580-650`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts:110-170`
- Modify: `apps/client/src/scenes/ArtGalleryScene.ts:17-65,360-417`
- Modify: `apps/client/src/fx/lighting-pipeline.ts:140-220,274-360`
- Modify: `apps/client/src/fx/combat-fx.ts:124-155`
- Test: `apps/client/test/visual-query.test.ts`

**Interfaces:**
- Consumes: `SeededRandom` from `@ashen-pact/shared`
- Produces:
  - `VisualQueryConfig { seed: number; freeze: boolean; lightingEnabled: boolean; debugParam: boolean | null; testHooksParam: boolean }`
  - `parseVisualQuery(search: string): VisualQueryConfig`
  - `getVisualQueryConfig(): VisualQueryConfig`
  - `getClientFreezeRandom(): () => number` (returns deterministic Mulberry32 `next()` when `freeze` is active, or `Math.random` otherwise; resettable via `resetClientFreezeRandom(seed?: number)`)
  - `window.__GAME_SET_LIGHTING__?: (enabled: boolean) => void`

- [ ] **Step 1: Write the failing unit tests in `apps/client/test/visual-query.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  getClientFreezeRandom,
  parseVisualQuery,
  resetClientFreezeRandom,
} from '../src/core/visual-query.js';

describe('visual-query parser and deterministic client RNG', () => {
  it('parses ?seed= (decimal, hex, invalid fallback), ?freeze=1, ?lighting=0, ?debug=0|1, ?testHooks=1', () => {
    const def = parseVisualQuery('');
    expect(def.seed).toBe(0x1337c0de);
    expect(def.freeze).toBe(false);
    expect(def.lightingEnabled).toBe(true);
    expect(def.debugParam).toBeNull();
    expect(def.testHooksParam).toBe(false);

    const custom = parseVisualQuery('?seed=12345&freeze=1&lighting=0&debug=0&testHooks=1');
    expect(custom.seed).toBe(12345);
    expect(custom.freeze).toBe(true);
    expect(custom.lightingEnabled).toBe(false);
    expect(custom.debugParam).toBe(false);
    expect(custom.testHooksParam).toBe(true);

    const hex = parseVisualQuery('?seed=0xdeadbeef&debug=1');
    expect(hex.seed).toBe(0xdeadbeef);
    expect(hex.debugParam).toBe(true);

    const invalid = parseVisualQuery('?seed=notanumber');
    expect(invalid.seed).toBe(0x1337c0de);
  });

  it('produces identical random sequences when reset with the same seed', () => {
    resetClientFreezeRandom(42);
    const rng1 = getClientFreezeRandom(true);
    const seq1 = [rng1(), rng1(), rng1(), rng1()];

    resetClientFreezeRandom(42);
    const rng2 = getClientFreezeRandom(true);
    const seq2 = [rng2(), rng2(), rng2(), rng2()];

    expect(seq1).toEqual(seq2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/client/test/visual-query.test.ts`
Expected: FAIL with module `../src/core/visual-query.js` not found.

- [ ] **Step 3: Implement `apps/client/src/core/visual-query.ts` and hook into scenes/lighting**

1. Create `apps/client/src/core/visual-query.ts` implementing `parseVisualQuery`, `getVisualQueryConfig`, `resetClientFreezeRandom`, and `getClientFreezeRandom(forceFreeze?: boolean)`.
2. In `apps/client/src/ui/debug-overlay.ts`, initialize `seed: getVisualQueryConfig().seed` and update `state.seed` whenever URL `?seed=` is present.
3. In `MenuScene.ts`, `GameScene.ts`, and `ArtGalleryScene.ts`:
   - On `create()`, call `resetClientFreezeRandom(getVisualQueryConfig().seed)`.
   - Replace `Math.random()` in `MenuScene` (`init()`, `initCampfireEmbers()`, `updateEmbers()`) and `CombatFxManager` (`spawnFrostBreath`, etc.) with `getClientFreezeRandom()()`.
   - When `getVisualQueryConfig().freeze` is `true`, clamp/fix `rawDeltaMs` to `16.6667` (`dtSec = 1 / 60`) in `MenuScene.update`, `GameScene.update`, and `ArtGalleryScene.update`.
   - In `LightingPipeline.ts`:
     - Add `private lightingEnabled = getVisualQueryConfig().lightingEnabled;` and `public setLightingEnabled(enabled: boolean): void`.
     - When `!this.lightingEnabled`, hide `this.lightmapRt` (`this.lightmapRt.setVisible(false)`), detach `BiomePostFxPipeline` from `cameras.main`, and return early from `update()`.
     - When `getVisualQueryConfig().freeze` is `true`, keep `this.elapsedSec` at a fixed value (`1.0`) for torch/mushroom flicker so consecutive screenshots at different ticks have identical light radii/alphas.
   - In `arena-tiles.ts`, expose `window.__GAME_SET_LIGHTING__ = (enabled: boolean) => { this.lighting?.setLightingEnabled(enabled); }` and clean it up on `SHUTDOWN`.

- [ ] **Step 4: Run tests and typecheck to verify**

Run: `npx vitest run apps/client/test/visual-query.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/core/visual-query.ts apps/client/test/visual-query.test.ts apps/client/src/ui/debug-overlay.ts apps/client/src/scenes/MenuScene.ts apps/client/src/scenes/GameScene.ts apps/client/src/scenes/game-scene/arena-tiles.ts apps/client/src/scenes/ArtGalleryScene.ts apps/client/src/fx/lighting-pipeline.ts apps/client/src/fx/combat-fx.ts
git commit -m "feat(client): add deterministic ?seed, ?freeze=1, and ?lighting=0 visual hooks"
```

---

### Task 3: Deterministic Visual Scene Catalog (`visual-scenes.ts`), `@visual` Spec (`visual.spec.ts`), `pnpm shots` & `pnpm perf`

**Files:**
- Create: `tests/e2e/helpers/visual-scenes.ts`
- Create: `tests/e2e/visual.spec.ts`
- Create: `tools/run-shots.ts`
- Create: `tools/run-perf.ts`
- Modify: `package.json:7-20`

**Interfaces:**
- Consumes: `tools/visual-metrics.ts`, `window.__GAME_TRANSPORT__`, `window.__GAME_DEBUG__`, `window.__GAME_SET_LIGHTING__`, `window.__GAME_SET_QUALITY__`, `window.__GAME_STRESS_TEST__`
- Produces:
  - `VISUAL_SCENES: readonly VisualSceneDef[]` covering all scenes in Spec Section 5:
    - Menu: `menu`, `menu-settings`, `menu-join-input`
    - Hub: `hub-solo`, `hub-coop-2p`, `hub-near-statue`, `hub-near-rack`
    - Biome 1: `b1-start-room`, `b1-combat`, `b1-chest-closed-far`, `b1-chest-near`, `b1-weapon-ground-far`, `b1-weapon-ground-mid`, `b1-weapon-ground-near`, `b1-merchant`, `b1-shrine`, `b1-door-locked`, `b1-door-open`, `b1-portal-inactive`, `b1-portal-active`, `b1-dark-interactables`, `b1-poison-swamp`
    - Biome 2 & 3: `b2-start-room`, `b2-combat`, `b3-start-room`, `b3-combat`, `b3-combat-grayscale`, `b3-lava-surface`
    - Bosses: `boss-b1`, `boss-b2`, `boss-b3`, `boss-b1-phase3`, `boss-b2-blizzard`, `boss-b3-phase3`
    - Co-op & Stress: `coop-4p-combat`, `stress-4p`
    - Modals & Typography: `modal-buff`, `modal-victory`, `modal-defeat`, `pause`, `pause-confirm-exit`, `ui-vi-diacritics`
    - Gallery: `gallery-characters`, `gallery-enemies`
    - Variants: `b1-combat-1440p`, `b1-combat-ultrawide`, `b1-combat-1280x1024`, `hub-solo-1440p`, `hub-solo-ultrawide`, `hub-solo-1280x1024`, `b1-combat-low`, `b3-combat-low`, `b1-portal-active-low`, `menu-en`, `menu-settings-en`, `pause-en`, `modal-buff-en`, `modal-victory-en`
  - `pnpm shots -- --phase pN --label before|after|baseline [--scenes a,b] [--verify-freeze]`
  - `pnpm perf` writing `docs/perf-baseline.json` (or `--out <file>`)

- [ ] **Step 1: Create `tests/e2e/helpers/visual-scenes.ts`**

Define `VisualSceneDef` with deterministic setup functions (`setup(page)`), viewport size (default `1920×1080`), URL query (`?seed=1337&freeze=1&debug=0&testHooks=1`), `captureUnlit: boolean` for environment scenes (`b1-start-room`, `b1-combat`, `b1-combat-low`, `b2-start-room`, `b2-combat`, `b3-start-room`, `b3-combat`, `hub-solo`, `boss-b2-blizzard`), `captureStrip: boolean` for animated scenes (`b1-portal-active`, `gallery-characters`), `sampleRects` (`floor_all`, `center_arena`, `corner_tl`, `corner_tr`, `corner_bl`, `corner_br`, `brazier_pool`), and `freezeMaskRects` (masking any dynamic network ping/FPS region if present). Ensure every scene waits at least 45 frames (`sim.step` or `requestAnimationFrame` × 45) after state setup before screenshot capture.

- [ ] **Step 2: Create `tests/e2e/visual.spec.ts` (tagged `@visual`) and `tools/run-shots.ts`**

1. In `tests/e2e/visual.spec.ts`:
   - Read `ASHEN_SHOTS_PHASE` (default `p0`), `ASHEN_SHOTS_LABEL` (default `baseline`), `ASHEN_SHOTS_SCENES` (optional comma-separated filter), and `ASHEN_VERIFY_FREEZE` (`1` to capture a second pass and assert `diffRatio < 0.005` on every scene).
   - Save screenshots to `docs/screenshots/polish-<phase>/<label>/<scene>.png` (plus `<scene>-unlit.png` when `captureUnlit` is true, `<scene>-strip.png` when `captureStrip` is true, and auto-generate `b3-combat-grayscale.png` from `b3-combat.png`).
   - Run `analyzePngBufferRegions` and `computeSceneEnvironmentSummary` to write `docs/screenshots/polish-<phase>/<label>/metrics.json`.
2. In `tools/run-shots.ts`:
   - Parse CLI flags `--phase`, `--label`, `--scenes`, `--verify-freeze` and run ` playwright test tests/e2e/visual.spec.ts`.
3. Add `"shots": "pnpm --filter @ashen-pact/server exec tsx ../../tools/run-shots.ts"` and `"perf": "pnpm --filter @ashen-pact/server exec tsx ../../tools/run-perf.ts"` to root `package.json`.

- [ ] **Step 3: Create `tools/run-perf.ts` (`pnpm perf`)**

Implement `tools/run-perf.ts` using Playwright `chromium.launch({ headless: false, args: ['--use-gl=angle', '--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] })`:
1. Start or reuse local dev server (`http://localhost:5173/?scene=game&seed=1337`).
2. Extract `UNMASKED_RENDERER_WEBGL` via `WEBGL_debug_renderer_info` and fail if it contains `SwiftShader` or `Basic Render Driver`.
3. Warm up 5s, then measure 20s of frame deltas (`requestAnimationFrame`) in normal combat and 20s in `__GAME_STRESS_TEST__(true)` (4P + 80 enemies + 600 bullets) at 1080p High, computing `p50Ms`, `p95Ms`, `avgFpsEquivalent`, and heap memory start/end.
4. Also run a vsync-enabled pass (`headless: false` without `--disable-gpu-vsync --disable-frame-rate-limit`) to record vsync FPS for normal combat (`>= 60` target) and stress test (`>= 58` target).
5. Save JSON results to `docs/perf-baseline.json` (or `--out` path) and print summary table.

- [ ] **Step 4: Verify `pnpm e2e` excludes `@visual` and `pnpm shots` runs on a smoke subset**

Run: `pnpm typecheck && pnpm lint && pnpm shots -- --phase p0 --label smoke --scenes menu,b1-combat --verify-freeze`
Expected: PASS, generating `menu.png`, `b1-combat.png`, `b1-combat-unlit.png`, `metrics.json`, with freeze pixel-diff `< 0.5%`, then clean up `docs/screenshots/polish-p0/smoke`.

- [ ] **Step 5: Commit**

```bash
git add package.json tests/e2e/helpers/visual-scenes.ts tests/e2e/visual.spec.ts tools/run-shots.ts tools/run-perf.ts
git commit -m "feat(e2e): add deterministic visual scene catalog, pnpm shots, and pnpm perf"
```

---

### Task 4: Capture Full P0 Baseline, Run Performance Benchmark, Conduct Visual Review & Write `docs/POLISH_BASELINE.md`

**Files:**
- Create: `docs/screenshots/polish-p0/baseline/` (all scene PNGs + `metrics.json`)
- Create: `docs/perf-baseline.json`
- Create: `docs/screenshots/polish-p0/review-baseline.md`
- Create: `docs/POLISH_BASELINE.md`

**Interfaces:**
- Consumes: `pnpm shots`, `pnpm perf`, `tools/visual-metrics.ts`
- Produces: Full baseline dataset, independent Visual Reviewer report (`review-baseline.md`), and `docs/POLISH_BASELINE.md`

- [ ] **Step 1: Run full baseline capture with `--verify-freeze` and `pnpm perf`**

Run:
1. `pnpm shots -- --phase p0 --label baseline --verify-freeze`
2. `pnpm perf`
Expected: Every scene in Section 5 is captured to `docs/screenshots/polish-p0/baseline/`, freeze pixel-diff is `< 0.5%` on all scenes, `metrics.json` has floor measurements for Biomes 1–3 & Hub (lit & unlit), and `docs/perf-baseline.json` records the hardware GPU renderer and p50/p95 frame times.

- [ ] **Step 2: Dispatch independent Visual Reviewer (`research`, model `pro`) on baseline screenshots**

Controller dispatches a fresh `research` subagent (`model: "pro"`) with paths to `docs/superpowers/specs/2026-10-20-polish-v0.2.0-design.md` (Section 6 rubric & Section 3.5), `docs/ART_GUIDE.md`, `docs/screenshots/polish-p0/baseline/metrics.json`, and the baseline screenshots in `docs/screenshots/polish-p0/baseline/`. Save the Reviewer's complete output to `docs/screenshots/polish-p0/review-baseline.md`.

- [ ] **Step 3: Write `docs/POLISH_BASELINE.md` and update `docs/PROGRESS.md` & `docs/PHASES.md`**

Summarize the baseline GPU performance (`p50`/`p95` frame times, FPS, GPU model), baseline `metrics.json` table (CIE L\*, ΔL\*, HSL S, corner retention, brazier delta for B1/B2/B3/Hub), baseline Visual Reviewer scores (9 rubric criteria), and the Top 15 visual problems by severity with links to the baseline screenshots.

- [ ] **Step 4: Run Phase P0 Gate (`pnpm verify`) and tag `polish-p0`**

Run: `pnpm verify`
Expected: PASS 100% (typecheck, lint, unit tests, build, e2e excluding `@visual`), 0 console errors/warnings. Commit all baseline artifacts and tag `polish-p0`.
