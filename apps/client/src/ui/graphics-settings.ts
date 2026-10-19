export type GraphicsQualityTier = 'high' | 'medium' | 'low';

export interface QualityPresetBudget {
  tier: GraphicsQualityTier;
  labelVi: string;
  lightmapScale: number;
  enableBloomPostFx: boolean;
  enableProjectileLights: boolean;
  particleBudgetRatio: number;
  ambientCount: number;
  maxDecals: number;
}

export const QUALITY_PRESETS: Record<GraphicsQualityTier, QualityPresetBudget> = {
  high: {
    tier: 'high',
    labelVi: 'Cao',
    lightmapScale: 1.0,
    enableBloomPostFx: true,
    enableProjectileLights: true,
    particleBudgetRatio: 1.0,
    ambientCount: 36,
    maxDecals: 120,
  },
  medium: {
    tier: 'medium',
    labelVi: 'Trung',
    lightmapScale: 0.75,
    enableBloomPostFx: false,
    enableProjectileLights: true,
    particleBudgetRatio: 0.65,
    ambientCount: 18,
    maxDecals: 70,
  },
  low: {
    tier: 'low',
    labelVi: 'Thấp',
    lightmapScale: 0.5,
    enableBloomPostFx: false,
    enableProjectileLights: false,
    particleBudgetRatio: 0.35,
    ambientCount: 0,
    maxDecals: 30,
  },
};

export interface GraphicsSettingsState {
  quality: GraphicsQualityTier;
  autoQuality: boolean;
  screenShakeIntensity: number;
  showDamageNumbers: boolean;
  teammateFxOpacity: number;
}

const STORAGE_KEY = 'ashen_pact_graphics_settings';

/**
 * Manages persistent Graphics Quality settings (High / Medium / Low) in localStorage
 * and automatic quality step-down when sustained FPS drops below threshold.
 */
export class GraphicsSettingsManager {
  private state: GraphicsSettingsState = {
    quality: 'high',
    autoQuality: true,
    screenShakeIntensity: 1.0,
    showDamageNumbers: true,
    teammateFxOpacity: 0.7,
  };

  private lowFpsAccumSec = 0;
  private downgradeCooldownSec = 0;
  public autoDowngradeCount = 0;
  private readonly listeners = new Set<(state: GraphicsSettingsState) => void>();

  constructor() {
    this.loadFromStorage();
  }

  public getState(): Readonly<GraphicsSettingsState> {
    return this.state;
  }

  public getBudget(): QualityPresetBudget {
    return QUALITY_PRESETS[this.state.quality];
  }

  public setQuality(quality: GraphicsQualityTier): void {
    if (this.state.quality === quality) return;
    this.state = { ...this.state, quality };
    this.lowFpsAccumSec = 0;
    this.saveToStorage();
    this.notify();
  }

  public cycleQuality(): GraphicsQualityTier {
    const order: readonly GraphicsQualityTier[] = ['high', 'medium', 'low'];
    const idx = order.indexOf(this.state.quality);
    const next = order[(idx + 1) % order.length] ?? 'high';
    this.setQuality(next);
    return next;
  }

  public setAutoQuality(enabled: boolean): void {
    if (this.state.autoQuality === enabled) return;
    this.state = { ...this.state, autoQuality: enabled };
    this.lowFpsAccumSec = 0;
    this.saveToStorage();
    this.notify();
  }

  public onChange(cb: (state: GraphicsSettingsState) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /**
   * Monitors rolling FPS and automatically downgrades quality (High -> Medium -> Low)
   * if sustained FPS stays below 46 FPS for 2.2 seconds while autoQuality is active.
   */
  public updateAutoQualityMonitor(currentFps: number, dtSec: number): boolean {
    if (this.downgradeCooldownSec > 0) {
      this.downgradeCooldownSec = Math.max(0, this.downgradeCooldownSec - dtSec);
    }

    if (!this.state.autoQuality || this.state.quality === 'low') {
      this.lowFpsAccumSec = 0;
      return false;
    }

    if (currentFps < 46 && this.downgradeCooldownSec <= 0) {
      this.lowFpsAccumSec += dtSec;
      if (this.lowFpsAccumSec >= 2.2) {
        this.lowFpsAccumSec = 0;
        this.downgradeCooldownSec = 3.0;
        this.autoDowngradeCount += 1;
        const nextTier: GraphicsQualityTier =
          this.state.quality === 'high' ? 'medium' : 'low';
        this.setQuality(nextTier);
        return true;
      }
    } else {
      this.lowFpsAccumSec = Math.max(0, this.lowFpsAccumSec - dtSec * 1.5);
    }

    return false;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<GraphicsSettingsState>;
      if (
        parsed.quality === 'high' ||
        parsed.quality === 'medium' ||
        parsed.quality === 'low'
      ) {
        this.state.quality = parsed.quality;
      }
      if (typeof parsed.autoQuality === 'boolean') {
        this.state.autoQuality = parsed.autoQuality;
      }
      if (typeof parsed.screenShakeIntensity === 'number') {
        this.state.screenShakeIntensity = parsed.screenShakeIntensity;
      }
      if (typeof parsed.showDamageNumbers === 'boolean') {
        this.state.showDamageNumbers = parsed.showDamageNumbers;
      }
      if (typeof parsed.teammateFxOpacity === 'number') {
        this.state.teammateFxOpacity = parsed.teammateFxOpacity;
      }
    } catch {
      // Ignore storage read errors in restricted contexts
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage quota errors
    }
  }

  private notify(): void {
    for (const cb of this.listeners) {
      cb(this.state);
    }
  }
}

export const graphicsSettings = new GraphicsSettingsManager();
