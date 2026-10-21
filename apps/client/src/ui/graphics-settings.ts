import { clamp, i18n, type SupportedLocale } from '@ashen-pact/shared';

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
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  fullscreen: boolean;
  language: SupportedLocale;
  uiScale: number;
  showKeyHints: boolean;
}

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettingsState = {
  quality: 'high',
  autoQuality: true,
  screenShakeIntensity: 1.0,
  showDamageNumbers: true,
  teammateFxOpacity: 0.7,
  masterVolume: 0.85,
  musicVolume: 0.7,
  sfxVolume: 0.9,
  fullscreen: false,
  language: 'vi',
  uiScale: 1.0,
  showKeyHints: true,
};

export function clampUiScale(val: number): number {
  if (!Number.isFinite(val)) return 1.0;
  return Math.round(clamp(val, 0.8, 1.3) * 20) / 20;
}

export function parseUiQueryOverrides(search: string): {
  uiScale?: number;
  showKeyHints?: boolean;
} {
  const result: { uiScale?: number; showKeyHints?: boolean } = {};
  if (!search) return result;
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const uiScaleRaw = params.get('uiScale');
  if (uiScaleRaw !== null && uiScaleRaw.trim() !== '') {
    const parsed = Number.parseFloat(uiScaleRaw);
    if (Number.isFinite(parsed)) {
      result.uiScale = clampUiScale(parsed);
    }
  }
  const keyHintsRaw = params.get('keyHints');
  if (keyHintsRaw !== null && keyHintsRaw.trim() !== '') {
    const normalized = keyHintsRaw.trim().toLowerCase();
    if (normalized === '0' || normalized === 'false' || normalized === 'off') {
      result.showKeyHints = false;
    } else if (normalized === '1' || normalized === 'true' || normalized === 'on') {
      result.showKeyHints = true;
    }
  }
  return result;
}

export interface SettingsToastEvent {
  kind: 'fullscreen' | 'auto_quality';
  detailVi: string;
  messageVi: string;
}

const STORAGE_KEY = 'ashen_pact_graphics_settings';

/**
 * Manages persistent Graphics, Audio, Gameplay, UI Scale, and Language settings in localStorage
 * and automatic quality step-down when sustained FPS drops below threshold.
 */
export class GraphicsSettingsManager {
  private state: GraphicsSettingsState = { ...DEFAULT_GRAPHICS_SETTINGS };

  private lowFpsAccumSec = 0;
  private downgradeCooldownSec = 0;
  public autoDowngradeCount = 0;
  private readonly listeners = new Set<(state: GraphicsSettingsState) => void>();
  private readonly toastListeners = new Set<(toast: SettingsToastEvent) => void>();

  constructor() {
    this.loadFromStorage();
    this.applyUrlQueryOverrides();
    i18n.setLocale(this.state.language);
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

  public setScreenShakeIntensity(val: number): void {
    const clamped = Math.round(clamp(val, 0, 1) * 20) / 20;
    if (this.state.screenShakeIntensity === clamped) return;
    this.state = { ...this.state, screenShakeIntensity: clamped };
    this.saveToStorage();
    this.notify();
  }

  public setShowDamageNumbers(enabled: boolean): void {
    if (this.state.showDamageNumbers === enabled) return;
    this.state = { ...this.state, showDamageNumbers: enabled };
    this.saveToStorage();
    this.notify();
  }

  public setTeammateFxOpacity(val: number): void {
    const clamped = Math.round(clamp(val, 0.3, 1.0) * 20) / 20;
    if (this.state.teammateFxOpacity === clamped) return;
    this.state = { ...this.state, teammateFxOpacity: clamped };
    this.saveToStorage();
    this.notify();
  }

  public setMasterVolume(val: number): void {
    const clamped = Math.round(clamp(val, 0, 1) * 20) / 20;
    if (this.state.masterVolume === clamped) return;
    this.state = { ...this.state, masterVolume: clamped };
    this.saveToStorage();
    this.notify();
  }

  public setMusicVolume(val: number): void {
    const clamped = Math.round(clamp(val, 0, 1) * 20) / 20;
    if (this.state.musicVolume === clamped) return;
    this.state = { ...this.state, musicVolume: clamped };
    this.saveToStorage();
    this.notify();
  }

  public setSfxVolume(val: number): void {
    const clamped = Math.round(clamp(val, 0, 1) * 20) / 20;
    if (this.state.sfxVolume === clamped) return;
    this.state = { ...this.state, sfxVolume: clamped };
    this.saveToStorage();
    this.notify();
  }

  public setFullscreen(enabled: boolean): void {
    if (this.state.fullscreen === enabled) return;
    this.state = { ...this.state, fullscreen: enabled };
    this.saveToStorage();
    this.notify();
    this.emitSettingsToast(
      'fullscreen',
      enabled ? 'Toàn màn hình: BẬT' : 'Toàn màn hình: TẮT (Cửa sổ)',
    );
  }

  public setLanguage(language: SupportedLocale): void {
    i18n.setLocale(language);
    if (this.state.language === language) return;
    this.state = { ...this.state, language };
    this.saveToStorage();
    this.notify();
  }

  public toggleLanguage(): SupportedLocale {
    const next: SupportedLocale = this.state.language === 'vi' ? 'en' : 'vi';
    this.setLanguage(next);
    return next;
  }

  public setUiScale(val: number): void {
    const clamped = clampUiScale(val);
    if (this.state.uiScale === clamped) return;
    this.state = { ...this.state, uiScale: clamped };
    this.saveToStorage();
    this.notify();
  }

  public setShowKeyHints(enabled: boolean): void {
    if (this.state.showKeyHints === enabled) return;
    this.state = { ...this.state, showKeyHints: enabled };
    this.saveToStorage();
    this.notify();
  }

  public applyUrlQueryOverrides(search?: string): void {
    const rawSearch =
      search ?? (typeof window !== 'undefined' && window.location ? window.location.search : '');
    const overrides = parseUiQueryOverrides(rawSearch);
    let changed = false;
    if (overrides.uiScale !== undefined && this.state.uiScale !== overrides.uiScale) {
      this.state = { ...this.state, uiScale: overrides.uiScale };
      changed = true;
    }
    if (overrides.showKeyHints !== undefined && this.state.showKeyHints !== overrides.showKeyHints) {
      this.state = { ...this.state, showKeyHints: overrides.showKeyHints };
      changed = true;
    }
    if (changed) {
      this.notify();
    }
  }

  public resetDefaults(): void {
    this.state = { ...DEFAULT_GRAPHICS_SETTINGS };
    i18n.setLocale(this.state.language);
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

  public onToast(cb: (toast: SettingsToastEvent) => void): () => void {
    this.toastListeners.add(cb);
    return () => {
      this.toastListeners.delete(cb);
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
        const nextTier: GraphicsQualityTier = this.state.quality === 'high' ? 'medium' : 'low';
        this.setQuality(nextTier);
        this.emitSettingsToast(
          'auto_quality',
          `Giảm xuống mức ${QUALITY_PRESETS[nextTier].labelVi} để giữ 60 FPS`,
        );
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
      if (parsed.quality === 'high' || parsed.quality === 'medium' || parsed.quality === 'low') {
        this.state.quality = parsed.quality;
      }
      if (typeof parsed.autoQuality === 'boolean') {
        this.state.autoQuality = parsed.autoQuality;
      }
      if (typeof parsed.screenShakeIntensity === 'number') {
        this.state.screenShakeIntensity = clamp(parsed.screenShakeIntensity, 0, 1);
      }
      if (typeof parsed.showDamageNumbers === 'boolean') {
        this.state.showDamageNumbers = parsed.showDamageNumbers;
      }
      if (typeof parsed.teammateFxOpacity === 'number') {
        this.state.teammateFxOpacity = clamp(parsed.teammateFxOpacity, 0.3, 1.0);
      }
      if (typeof parsed.masterVolume === 'number') {
        this.state.masterVolume = clamp(parsed.masterVolume, 0, 1);
      }
      if (typeof parsed.musicVolume === 'number') {
        this.state.musicVolume = clamp(parsed.musicVolume, 0, 1);
      }
      if (typeof parsed.sfxVolume === 'number') {
        this.state.sfxVolume = clamp(parsed.sfxVolume, 0, 1);
      }
      if (typeof parsed.fullscreen === 'boolean') {
        this.state.fullscreen = parsed.fullscreen;
      }
      if (parsed.language === 'vi' || parsed.language === 'en') {
        this.state.language = parsed.language;
      }
      if (typeof parsed.uiScale === 'number') {
        this.state.uiScale = clampUiScale(parsed.uiScale);
      }
      if (typeof parsed.showKeyHints === 'boolean') {
        this.state.showKeyHints = parsed.showKeyHints;
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

  private emitSettingsToast(kind: 'fullscreen' | 'auto_quality', detailVi: string): void {
    const clean = detailVi.trim();
    const messageVi =
      kind === 'fullscreen' ? `🖥 ${clean}` : `⚙ Tự động chỉnh Đồ họa: ${clean}`;
    const payload: SettingsToastEvent = { kind, detailVi: clean, messageVi };
    for (const cb of this.toastListeners) {
      cb(payload);
    }
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__LAST_P11_TOAST__ = messageVi;
      if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('ashen-pact:settings-toast', {
            detail: payload,
          }),
        );
      }
    }
  }
}

export const graphicsSettings = new GraphicsSettingsManager();
