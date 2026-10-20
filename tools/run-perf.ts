import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface PerfPassMetrics {
  sampleCount: number;
  durationMs: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  avgFpsEquivalent: number;
  heapStartMb: number;
  heapEndMb: number;
  heapDeltaMb: number;
}

export interface PerfBaselineReport {
  generatedAt: string;
  viewport: { width: number; height: number };
  quality: 'high';
  gpu: {
    vendor: string;
    renderer: string;
    hardwareAccelerated: boolean;
  };
  uncapped: {
    normalCombat: PerfPassMetrics;
    stressCombat: PerfPassMetrics;
  };
  vsync: {
    normalCombatFps: number;
    stressCombatFps: number;
    normalCombatP95Ms: number;
    stressCombatP95Ms: number;
  };
  targets: {
    uncappedNormalP50MaxMs: number;
    uncappedNormalP95MaxMs: number;
    uncappedStressP50MaxMs: number;
    uncappedStressP95MaxMs: number;
    vsyncNormalMinFps: number;
    vsyncStressMinFps: number;
  };
}

interface PerfCliOptions {
  outPath: string;
  warmupMs: number;
  measureMs: number;
  baseUrl: string;
}

function parsePerfArgs(argv: string[]): PerfCliOptions {
  let outPath = path.resolve(ROOT_DIR, 'docs/perf-baseline.json');
  let warmupMs = 5_000;
  let measureMs = 20_000;
  let baseUrl = 'http://localhost:5173';

  const args = argv.filter((arg) => arg !== '--');
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--out' && args[i + 1]) {
      outPath = path.resolve(ROOT_DIR, args[++i]!);
    } else if (arg.startsWith('--out=')) {
      outPath = path.resolve(ROOT_DIR, arg.slice('--out='.length));
    } else if (arg === '--warmup-ms' && args[i + 1]) {
      warmupMs = Number(args[++i]!);
    } else if (arg === '--measure-ms' && args[i + 1]) {
      measureMs = Number(args[++i]!);
    } else if (arg === '--url' && args[i + 1]) {
      baseUrl = args[++i]!;
    }
  }

  return { outPath, warmupMs, measureMs, baseUrl };
}

async function isServerReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function ensureDevServer(baseUrl: string): Promise<ChildProcess | null> {
  if (await isServerReachable(baseUrl)) {
    console.log(`[perf] Reusing existing dev server at ${baseUrl}`);
    return null;
  }

  console.log(`[perf] Starting client dev server for ${baseUrl}...`);
  const devProc = spawn('pnpm --filter @ashen-pact/client dev', {
    cwd: ROOT_DIR,
    stdio: 'ignore',
    shell: true,
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await isServerReachable(baseUrl)) {
      console.log(`[perf] Dev server ready at ${baseUrl}`);
      return devProc;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  stopDevServer(devProc);
  throw new Error(`[perf] Timed out waiting for dev server at ${baseUrl}`);
}

function stopDevServer(proc: ChildProcess | null): void {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore', shell: true });
    } else {
      proc.kill('SIGTERM');
    }
  } catch {
    // ignore cleanup error
  }
}

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (sorted.length - 1) * p;
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const weight = rank - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

function summarizeDeltas(
  deltasMs: number[],
  heapStartMb: number,
  heapEndMb: number,
): PerfPassMetrics {
  const sorted = [...deltasMs].sort((a, b) => a - b);
  const sampleCount = sorted.length;
  const durationMs = sorted.reduce((acc, d) => acc + d, 0);
  const meanMs = sampleCount > 0 ? durationMs / sampleCount : 0;
  const p50Ms = computePercentile(sorted, 0.5);
  const p95Ms = computePercentile(sorted, 0.95);
  const p99Ms = computePercentile(sorted, 0.99);
  const minMs = sorted[0] ?? 0;
  const maxMs = sorted[sorted.length - 1] ?? 0;
  const avgFpsEquivalent = meanMs > 0 ? 1000 / meanMs : 0;

  return {
    sampleCount,
    durationMs: Number(durationMs.toFixed(2)),
    meanMs: Number(meanMs.toFixed(3)),
    p50Ms: Number(p50Ms.toFixed(3)),
    p95Ms: Number(p95Ms.toFixed(3)),
    p99Ms: Number(p99Ms.toFixed(3)),
    minMs: Number(minMs.toFixed(3)),
    maxMs: Number(maxMs.toFixed(3)),
    avgFpsEquivalent: Number(avgFpsEquivalent.toFixed(2)),
    heapStartMb: Number(heapStartMb.toFixed(2)),
    heapEndMb: Number(heapEndMb.toFixed(2)),
    heapDeltaMb: Number((heapEndMb - heapStartMb).toFixed(2)),
  };
}

async function setupActiveCombatInPage(page: Page, baseUrl: string): Promise<{
  vendor: string;
  renderer: string;
}> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${baseUrl}/?scene=game&seed=1337&debug=0&testHooks=1`);
  await page.waitForFunction(
    () => {
      const dbg = (
        window as unknown as {
          __GAME_DEBUG__?: { scene?: string; fontsLoaded?: boolean };
        }
      ).__GAME_DEBUG__;
      return dbg?.scene === 'GameScene' && dbg?.fontsLoaded === true;
    },
    undefined,
    { timeout: 20_000 },
  );

  const gpuInfo = await page.evaluate(() => {
    const win = window as unknown as {
      __GAME_SET_QUALITY__?: (preset: 'high' | 'low') => void;
      __GAME_TRANSPORT__?: {
        getSimulation?: () => {
          step: (dt: number) => void;
          dungeon: {
            rooms: Array<{
              id: string;
              type: string;
              x: number;
              y: number;
              width: number;
              height: number;
            }>;
          };
          getPlayersMap: () => Map<
            string,
            { x: number; y: number; hp: number; maxHp: number }
          >;
        };
      };
    };

    win.__GAME_SET_QUALITY__?.('high');

    // Enter combat room r1 so normal combat has active enemies & AI
    const sim = win.__GAME_TRANSPORT__?.getSimulation?.();
    if (sim) {
      const combatRoom =
        sim.dungeon.rooms.find((r) => r.id === 'r1') ??
        sim.dungeon.rooms.find((r) => r.type === 'combat') ??
        sim.dungeon.rooms[0];
      const player = sim.getPlayersMap().values().next().value;
      if (combatRoom && player) {
        player.x = (combatRoom.x + combatRoom.width / 2) * 32;
        player.y = (combatRoom.y + combatRoom.height / 2) * 32;
        player.maxHp = 999_999;
        player.hp = 999_999;
        sim.step(1 / 60);
      }
    }

    const canvas =
      document.querySelector('canvas') ?? document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) {
      throw new Error('WebGL context unavailable in browser');
    }
    const dbgExt = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbgExt
      ? String(gl.getParameter(dbgExt.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR));
    const renderer = dbgExt
      ? String(gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));

    return { vendor, renderer };
  });

  if (/SwiftShader|Basic Render Driver/i.test(gpuInfo.renderer)) {
    throw new Error(
      `[perf] Software WebGL fallback detected ("${gpuInfo.renderer}"). Hardware GPU acceleration is required for performance benchmarking.`,
    );
  }

  return gpuInfo;
}

async function sampleRafDeltas(
  page: Page,
  warmupMs: number,
  measureMs: number,
): Promise<{ deltasMs: number[]; heapStartMb: number; heapEndMb: number }> {
  return page.evaluate(
    async ({ warmup, measure }) => {
      const getHeapMb = (): number => {
        const perfWithMem = performance as unknown as {
          memory?: { usedJSHeapSize: number };
        };
        return perfWithMem.memory
          ? perfWithMem.memory.usedJSHeapSize / (1024 * 1024)
          : 0;
      };

      // Warmup phase
      await new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (now: number): void => {
          if (now - start >= warmup) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      const heapStartMb = getHeapMb();
      const deltasMs: number[] = [];

      // Measurement phase
      await new Promise<void>((resolve) => {
        let start = 0;
        let last = 0;
        const tick = (now: number): void => {
          if (start === 0) {
            start = now;
            last = now;
            requestAnimationFrame(tick);
            return;
          }
          const dt = now - last;
          last = now;
          if (dt > 0 && dt < 250) {
            deltasMs.push(dt);
          }
          if (now - start >= measure) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      const heapEndMb = getHeapMb();
      return { deltasMs, heapStartMb, heapEndMb };
    },
    { warmup: warmupMs, measure: measureMs },
  );
}

async function runPerfBenchmark(): Promise<void> {
  const options = parsePerfArgs(process.argv.slice(2));
  const devProc = await ensureDevServer(options.baseUrl);

  try {
    console.log('[perf] Pass 1/2: Launching headed Chromium (UNCAPPED frame-time pass)...');
    const uncappedBrowser = await chromium.launch({
      headless: false,
      args: [
        '--use-gl=angle',
        '--use-angle=d3d11',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-gpu-vsync',
        '--disable-frame-rate-limit',
        '--enable-precise-memory-info',
      ],
    });

    let gpuInfo: { vendor: string; renderer: string };
    let uncappedNormal: PerfPassMetrics;
    let uncappedStress: PerfPassMetrics;

    try {
      const page = await uncappedBrowser.newPage();
      gpuInfo = await setupActiveCombatInPage(page, options.baseUrl);
      console.log(`[perf] GPU detected: ${gpuInfo.vendor} | ${gpuInfo.renderer}`);

      console.log(
        `[perf] Measuring uncapped normal combat (${options.warmupMs}ms warmup + ${options.measureMs}ms sample)...`,
      );
      const normalRaw = await sampleRafDeltas(page, options.warmupMs, options.measureMs);
      uncappedNormal = summarizeDeltas(
        normalRaw.deltasMs,
        normalRaw.heapStartMb,
        normalRaw.heapEndMb,
      );

      console.log(
        `[perf] Enabling __GAME_STRESS_TEST__(true) and measuring uncapped stress combat (${options.warmupMs}ms warmup + ${options.measureMs}ms sample)...`,
      );
      await page.evaluate(() => {
        const win = window as unknown as {
          __GAME_STRESS_TEST__?: (enabled: boolean) => void;
        };
        win.__GAME_STRESS_TEST__?.(true);
      });
      const stressRaw = await sampleRafDeltas(page, options.warmupMs, options.measureMs);
      uncappedStress = summarizeDeltas(
        stressRaw.deltasMs,
        stressRaw.heapStartMb,
        stressRaw.heapEndMb,
      );
    } finally {
      await uncappedBrowser.close();
    }

    console.log('[perf] Pass 2/2: Launching headed Chromium (VSYNC 60Hz FPS pass)...');
    const vsyncBrowser = await chromium.launch({
      headless: false,
      args: [
        '--use-gl=angle',
        '--use-angle=d3d11',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--enable-precise-memory-info',
      ],
    });

    let vsyncNormal: PerfPassMetrics;
    let vsyncStress: PerfPassMetrics;

    try {
      const page = await vsyncBrowser.newPage();
      await setupActiveCombatInPage(page, options.baseUrl);

      console.log(
        `[perf] Measuring vsync normal combat (${options.warmupMs}ms warmup + ${options.measureMs}ms sample)...`,
      );
      const normalVsyncRaw = await sampleRafDeltas(
        page,
        options.warmupMs,
        options.measureMs,
      );
      vsyncNormal = summarizeDeltas(
        normalVsyncRaw.deltasMs,
        normalVsyncRaw.heapStartMb,
        normalVsyncRaw.heapEndMb,
      );

      console.log(
        `[perf] Enabling __GAME_STRESS_TEST__(true) and measuring vsync stress combat (${options.warmupMs}ms warmup + ${options.measureMs}ms sample)...`,
      );
      await page.evaluate(() => {
        const win = window as unknown as {
          __GAME_STRESS_TEST__?: (enabled: boolean) => void;
        };
        win.__GAME_STRESS_TEST__?.(true);
      });
      const stressVsyncRaw = await sampleRafDeltas(
        page,
        options.warmupMs,
        options.measureMs,
      );
      vsyncStress = summarizeDeltas(
        stressVsyncRaw.deltasMs,
        stressVsyncRaw.heapStartMb,
        stressVsyncRaw.heapEndMb,
      );
    } finally {
      await vsyncBrowser.close();
    }

    const report: PerfBaselineReport = {
      generatedAt: new Date().toISOString(),
      viewport: { width: 1920, height: 1080 },
      quality: 'high',
      gpu: {
        vendor: gpuInfo.vendor,
        renderer: gpuInfo.renderer,
        hardwareAccelerated: true,
      },
      uncapped: {
        normalCombat: uncappedNormal,
        stressCombat: uncappedStress,
      },
      vsync: {
        normalCombatFps: vsyncNormal.avgFpsEquivalent,
        stressCombatFps: vsyncStress.avgFpsEquivalent,
        normalCombatP95Ms: vsyncNormal.p95Ms,
        stressCombatP95Ms: vsyncStress.p95Ms,
      },
      targets: {
        uncappedNormalP50MaxMs: 6.0,
        uncappedNormalP95MaxMs: 11.0,
        uncappedStressP50MaxMs: 10.0,
        uncappedStressP95MaxMs: 15.0,
        vsyncNormalMinFps: 60,
        vsyncStressMinFps: 58,
      },
    };

    fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
    fs.writeFileSync(options.outPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n=== ASHEN PACT HARDWARE GPU PERFORMANCE SUMMARY ===');
    console.log(`GPU Renderer : ${report.gpu.renderer}`);
    console.log(
      `Uncapped Normal (1080p High) : p50=${uncappedNormal.p50Ms}ms (<=6.0ms), p95=${uncappedNormal.p95Ms}ms (<=11.0ms), eqFPS=${uncappedNormal.avgFpsEquivalent}`,
    );
    console.log(
      `Uncapped Stress (4P+80E+600B): p50=${uncappedStress.p50Ms}ms (<=10.0ms), p95=${uncappedStress.p95Ms}ms (<=15.0ms), eqFPS=${uncappedStress.avgFpsEquivalent}`,
    );
    console.log(
      `Vsync Normal Combat FPS      : ${report.vsync.normalCombatFps} FPS (target >= 60)`,
    );
    console.log(
      `Vsync Stress Combat FPS      : ${report.vsync.stressCombatFps} FPS (target >= 58)`,
    );
    console.log(`Saved report to: ${options.outPath}\n`);
  } finally {
    stopDevServer(devProc);
  }
}

runPerfBenchmark().catch((err: unknown) => {
  console.error('[perf] Benchmark failed:', err);
  process.exit(1);
});
