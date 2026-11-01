import { SeededRandom } from '@ashen-pact/shared';

export const DEFAULT_VISUAL_SEED = 0x1337c0de;

export interface VisualQueryConfig {
  seed: number;
  freeze: boolean;
  lightingEnabled: boolean;
  debugParam: boolean | null;
  testHooksParam: boolean;
}

export function parseVisualQuery(search: string): VisualQueryConfig {
  const params = new URLSearchParams(search);

  let seed = DEFAULT_VISUAL_SEED;
  const rawSeed = params.get('seed')?.trim();
  if (rawSeed) {
    const parsed = Number(rawSeed);
    if (Number.isFinite(parsed)) {
      seed = parsed >>> 0;
    }
  }

  const rawFreeze = params.get('freeze')?.trim().toLowerCase();
  const freeze = rawFreeze === '1' || rawFreeze === 'true';

  const rawLighting = params.get('lighting')?.trim().toLowerCase();
  const lightingEnabled = !(rawLighting === '0' || rawLighting === 'false');

  const rawDebug = params.get('debug')?.trim().toLowerCase();
  const debugParam =
    rawDebug === '1' || rawDebug === 'true'
      ? true
      : rawDebug === '0' || rawDebug === 'false'
        ? false
        : null;

  const rawTestHooks = params.get('testHooks')?.trim().toLowerCase();
  const testHooksParam = rawTestHooks === '1' || rawTestHooks === 'true';

  return {
    seed,
    freeze,
    lightingEnabled,
    debugParam,
    testHooksParam,
  };
}

let cachedSearch: string | null = null;
let cachedConfig: VisualQueryConfig | null = null;

export function getVisualQueryConfig(): VisualQueryConfig {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  if (cachedConfig !== null && cachedSearch === search) {
    return cachedConfig;
  }
  cachedSearch = search;
  cachedConfig = parseVisualQuery(search);
  return cachedConfig;
}

let freezeRng = new SeededRandom(DEFAULT_VISUAL_SEED);
const boundFreezeNext = (): number => freezeRng.next();

export function resetClientFreezeRandom(seed: number = getVisualQueryConfig().seed): void {
  freezeRng = new SeededRandom(seed);
}

export function getClientFreezeRandom(forceFreeze?: boolean): () => number {
  const isFreeze = forceFreeze ?? getVisualQueryConfig().freeze;
  return isFreeze ? boundFreezeNext : Math.random;
}

export function getFreezeVisualTimeSec(liveElapsedSec: number, forceFreeze?: boolean): number {
  const isFreeze = forceFreeze ?? getVisualQueryConfig().freeze;
  if (!isFreeze) {
    return liveElapsedSec;
  }
  const stripStepTicks =
    typeof window !== 'undefined'
      ? Number((window as unknown as { __STRIP_STEP_TICKS__?: number }).__STRIP_STEP_TICKS__ ?? 0)
      : 0;
  return 1.0 + (Number.isFinite(stripStepTicks) ? stripStepTicks : 0) * (1 / 60);
}
