export interface BackgroundTickerHandle {
  stop(): void;
  readonly mode: 'worker' | 'interval';
}

const WORKER_SOURCE = `
let timer = null;
self.onmessage = function(e) {
  const data = e && e.data;
  if (!data) return;
  if (data.cmd === 'start') {
    if (timer !== null) clearInterval(timer);
    timer = setInterval(function() { self.postMessage(0); }, data.ms);
  } else if (data.cmd === 'stop') {
    if (timer !== null) { clearInterval(timer); timer = null; }
  }
};
`;

/**
 * Drives the P2P Host's authoritative 60Hz simulation loop from an inline Blob Web Worker
 * so background-tab throttling (e.g. when the Host Alt-Tabs to Discord/Zalo to paste the invite link)
 * never freezes connected teammates. Cleanly falls back to `setInterval` if `Worker` is unavailable.
 */
export function createBackgroundTicker(
  intervalMs: number,
  onStep: (deltaMs: number) => void,
  nowFn: () => number = () =>
    typeof performance !== 'undefined' ? performance.now() : Date.now(),
): BackgroundTickerHandle {
  let stopped = false;
  let lastNow = nowFn();
  const safeIntervalMs = Math.max(4, Math.round(intervalMs));

  const handleTick = () => {
    if (stopped) return;
    const now = nowFn();
    const rawDelta = now - lastNow;
    lastNow = now;
    const clampedDelta = Math.min(100, Math.max(1, rawDelta));
    onStep(clampedDelta);
  };

  if (
    typeof Worker === 'function' &&
    typeof Blob === 'function' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    try {
      const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const worker = new Worker(blobUrl);
      worker.onmessage = () => {
        handleTick();
      };
      worker.postMessage({ cmd: 'start', ms: safeIntervalMs });

      return {
        mode: 'worker',
        stop() {
          if (stopped) return;
          stopped = true;
          try {
            worker.postMessage({ cmd: 'stop' });
          } catch {
            // Ignore worker shutdown post errors
          }
          worker.onmessage = null;
          worker.terminate();
          if (typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(blobUrl);
          }
        },
      };
    } catch {
      // Fall through to setInterval fallback if CSP or environment blocks Blob Workers
    }
  }

  const timer = globalThis.setInterval(handleTick, safeIntervalMs);
  return {
    mode: 'interval',
    stop() {
      if (stopped) return;
      stopped = true;
      globalThis.clearInterval(timer);
    },
  };
}
