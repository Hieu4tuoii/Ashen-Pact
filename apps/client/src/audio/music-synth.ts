import { approach, clamp } from '@ashen-pact/shared';
import { graphicsSettings } from '../ui/graphics-settings';
import { zzfx } from './zzfx';

export type MusicThemeId =
  | 'menu_hub'
  | 'biome1'
  | 'biome2'
  | 'biome3'
  | 'boss_spore_king'
  | 'boss_kryssa'
  | 'boss_forge_titan';

interface ThemeDefinition {
  id: MusicThemeId;
  bpm: number;
  exploreNotesHz: readonly number[];
  combatNotesHz: readonly number[];
  bassNotesHz: readonly number[];
  exploreWave: OscillatorType;
  combatWave: OscillatorType;
}

const THEME_DEFS: Record<MusicThemeId, ThemeDefinition> = {
  menu_hub: {
    id: 'menu_hub',
    bpm: 92,
    exploreNotesHz: [293.66, 349.23, 440.0, 523.25, 440.0, 392.0, 349.23, 329.63],
    combatNotesHz: [293.66, 440.0, 587.33, 523.25, 440.0, 392.0, 440.0, 523.25],
    bassNotesHz: [146.83, 146.83, 174.61, 196.0],
    exploreWave: 'triangle',
    combatWave: 'sine',
  },
  biome1: {
    id: 'biome1',
    bpm: 112,
    exploreNotesHz: [220.0, 261.63, 293.66, 329.63, 392.0, 329.63, 293.66, 261.63],
    combatNotesHz: [220.0, 329.63, 311.13, 293.66, 261.63, 329.63, 392.0, 440.0],
    bassNotesHz: [110.0, 110.0, 130.81, 146.83],
    exploreWave: 'sine',
    combatWave: 'sawtooth',
  },
  biome2: {
    id: 'biome2',
    bpm: 118,
    exploreNotesHz: [329.63, 392.0, 493.88, 587.33, 659.25, 587.33, 493.88, 392.0],
    combatNotesHz: [329.63, 493.88, 466.16, 392.0, 369.99, 493.88, 587.33, 659.25],
    bassNotesHz: [164.81, 164.81, 196.0, 146.83],
    exploreWave: 'triangle',
    combatWave: 'square',
  },
  biome3: {
    id: 'biome3',
    bpm: 126,
    exploreNotesHz: [196.0, 233.08, 261.63, 293.66, 277.18, 261.63, 233.08, 196.0],
    combatNotesHz: [196.0, 293.66, 277.18, 261.63, 233.08, 293.66, 349.23, 392.0],
    bassNotesHz: [98.0, 98.0, 116.54, 130.81],
    exploreWave: 'triangle',
    combatWave: 'sawtooth',
  },
  boss_spore_king: {
    id: 'boss_spore_king',
    bpm: 146,
    exploreNotesHz: [220.0, 261.63, 311.13, 329.63, 261.63, 311.13, 392.0, 440.0],
    combatNotesHz: [220.0, 440.0, 311.13, 392.0, 329.63, 293.66, 261.63, 311.13],
    bassNotesHz: [110.0, 110.0, 123.47, 130.81],
    exploreWave: 'triangle',
    combatWave: 'sawtooth',
  },
  boss_kryssa: {
    id: 'boss_kryssa',
    bpm: 154,
    exploreNotesHz: [329.63, 493.88, 659.25, 587.33, 493.88, 466.16, 392.0, 493.88],
    combatNotesHz: [659.25, 587.33, 493.88, 466.16, 392.0, 493.88, 587.33, 783.99],
    bassNotesHz: [164.81, 196.0, 146.83, 185.0],
    exploreWave: 'sine',
    combatWave: 'square',
  },
  boss_forge_titan: {
    id: 'boss_forge_titan',
    bpm: 142,
    exploreNotesHz: [146.83, 174.61, 207.65, 220.0, 196.0, 174.61, 164.81, 146.83],
    combatNotesHz: [146.83, 293.66, 207.65, 220.0, 261.63, 207.65, 174.61, 293.66],
    bassNotesHz: [73.42, 73.42, 87.31, 103.83],
    exploreWave: 'sawtooth',
    combatWave: 'sawtooth',
  },
};

export interface MusicStateSnapshot {
  theme: MusicThemeId;
  inCombat: boolean;
  explorationMix: number;
  combatMix: number;
  effectiveVolume: number;
  stepIndex: number;
  notesScheduledCount: number;
}

/**
 * Procedural Web Audio Dynamic Music Sequencer with dual Exploration + Combat layers
 * that smoothly crossfade based on room combat / Boss state.
 */
export class ProceduralMusicManager {
  private currentTheme: MusicThemeId = 'menu_hub';
  private inCombat = false;
  private combatMix = 0;
  private stepTimerSec = 0;
  private stepIndex = 0;
  private notesScheduledCount = 0;
  private paused = false;

  public setPaused(paused: boolean): void {
    this.paused = paused;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public getCurrentTheme(): MusicThemeId {
    return this.currentTheme;
  }

  public getCombatMix(): number {
    return Number(this.combatMix.toFixed(3));
  }

  public getState(): MusicStateSnapshot {
    const s = graphicsSettings.getState();
    const effectiveVolume = clamp(s.masterVolume * s.musicVolume, 0, 1);
    return {
      theme: this.currentTheme,
      inCombat: this.inCombat,
      explorationMix: Number((1 - this.combatMix * 0.55).toFixed(3)),
      combatMix: Number(this.combatMix.toFixed(3)),
      effectiveVolume: Number(effectiveVolume.toFixed(3)),
      stepIndex: this.stepIndex,
      notesScheduledCount: this.notesScheduledCount,
    };
  }

  public getAvailableThemes(): MusicThemeId[] {
    return Object.keys(THEME_DEFS) as MusicThemeId[];
  }

  public resolveBiomeTheme(
    biome: 1 | 2 | 3,
    inHub: boolean,
    activeBossDefId?: string | null,
  ): MusicThemeId {
    if (inHub) return 'menu_hub';
    if (activeBossDefId === 'spore_king') return 'boss_spore_king';
    if (activeBossDefId === 'kryssa_ice_queen') return 'boss_kryssa';
    if (activeBossDefId === 'forge_titan') return 'boss_forge_titan';
    if (biome === 2) return 'biome2';
    if (biome === 3) return 'biome3';
    return 'biome1';
  }

  public update(theme: MusicThemeId, inCombat: boolean, dtSec: number): void {
    if (this.currentTheme !== theme) {
      this.currentTheme = theme;
      this.stepIndex = 0;
      this.stepTimerSec = 0;
    }
    const isBossTheme = theme.startsWith('boss_');
    this.inCombat = inCombat || isBossTheme;

    const targetCombatMix = this.inCombat ? 1.0 : 0.0;
    this.combatMix = approach(this.combatMix, targetCombatMix, dtSec * 0.9);

    if (this.paused) return;

    const def = THEME_DEFS[this.currentTheme];
    const stepDurationSec = 60 / def.bpm / 2; // 8th notes
    this.stepTimerSec += clamp(dtSec, 0, 0.1);

    if (this.stepTimerSec >= stepDurationSec) {
      this.stepTimerSec -= stepDurationSec;
      this.triggerSequencerStep(def, stepDurationSec);
      this.stepIndex = (this.stepIndex + 1) % 16;
    }
  }

  private triggerSequencerStep(def: ThemeDefinition, stepDurationSec: number): void {
    this.notesScheduledCount += 1;

    const settings = graphicsSettings.getState();
    const effectiveVol = clamp(settings.masterVolume * settings.musicVolume, 0, 1);
    if (effectiveVol <= 0.005) return;

    const ctx = zzfx.getAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    try {
      const now = ctx.currentTime;
      const noteIdx = this.stepIndex % def.exploreNotesHz.length;

      // Layer 1: Exploration melodic pad/arpeggio
      const exploreGain = (1 - this.combatMix * 0.45) * 0.055 * effectiveVol;
      if (exploreGain > 0.002 && this.stepIndex % 2 === 0) {
        const freq = def.exploreNotesHz[noteIdx] ?? 293.66;
        this.scheduleTone(
          ctx,
          freq,
          def.exploreWave,
          now,
          stepDurationSec * 1.7,
          exploreGain,
          -0.2,
        );
      }

      // Bass foundation on beats 0, 4, 8, 12
      if (this.stepIndex % 4 === 0) {
        const bassFreq = def.bassNotesHz[(this.stepIndex >> 2) % def.bassNotesHz.length] ?? 110;
        const bassGain = (0.045 + this.combatMix * 0.04) * effectiveVol;
        this.scheduleTone(ctx, bassFreq, 'triangle', now, stepDurationSec * 2.4, bassGain, 0);
      }

      // Layer 2: Combat driving lead & pulse (crossfaded by combatMix)
      if (this.combatMix > 0.08) {
        const combatGain = this.combatMix * 0.052 * effectiveVol;
        const cFreq = def.combatNotesHz[noteIdx] ?? 329.63;
        this.scheduleTone(
          ctx,
          cFreq,
          def.combatWave,
          now,
          stepDurationSec * 0.85,
          combatGain,
          0.22,
        );
      }
    } catch {
      // Ignore WebAudio scheduling errors in headless environments
    }
  }

  private scheduleTone(
    ctx: AudioContext,
    freq: number,
    type: OscillatorType,
    startTime: number,
    durationSec: number,
    peakGain: number,
    pan: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.025, durationSec * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    osc.connect(gain);
    if (typeof ctx.createStereoPanner === 'function' && Math.abs(pan) > 0.01) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -0.8, 0.8);
      gain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      gain.connect(ctx.destination);
    }

    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.02);
  }
}

export const musicManager = new ProceduralMusicManager();
