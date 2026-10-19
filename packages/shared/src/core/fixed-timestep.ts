export const SIM_TICK_RATE = 60;
export const SIM_STEP_MS = 1000 / SIM_TICK_RATE;
export const SIM_STEP_SEC = 1 / SIM_TICK_RATE;
export const MAX_ACCUMULATOR_MS = SIM_STEP_MS * 10;

export interface FixedStepResult {
  ticksExecuted: number;
  alpha: number;
  tick: number;
}

/**
 * Fixed 60Hz timestep loop decouples simulation updates from variable display refresh rates (60/120/144Hz).
 * Returns interpolation factor alpha in [0, 1) for smooth rendering between ticks.
 */
export class FixedTimestepLoop {
  private accumulatorMs = 0;
  private currentTick = 0;
  public readonly stepMs: number;

  constructor(tickRate: number = SIM_TICK_RATE) {
    this.stepMs = 1000 / tickRate;
  }

  public step(deltaMs: number, onTick: (dtSec: number, tick: number) => void): FixedStepResult {
    const clampedDelta = Math.max(0, Math.min(deltaMs, MAX_ACCUMULATOR_MS));
    this.accumulatorMs += clampedDelta;

    let ticksExecuted = 0;
    const dtSec = this.stepMs / 1000;

    while (this.accumulatorMs >= this.stepMs) {
      this.currentTick += 1;
      onTick(dtSec, this.currentTick);
      this.accumulatorMs -= this.stepMs;
      ticksExecuted += 1;
    }

    const alpha = this.accumulatorMs / this.stepMs;
    return {
      ticksExecuted,
      alpha,
      tick: this.currentTick,
    };
  }

  public getTick(): number {
    return this.currentTick;
  }

  public getAlpha(): number {
    return this.accumulatorMs / this.stepMs;
  }

  public reset(tick = 0): void {
    this.accumulatorMs = 0;
    this.currentTick = tick;
  }
}
