import { clamp } from '@ashen-pact/shared';

export type SfxId =
  | 'shoot_pistol'
  | 'shoot_shotgun'
  | 'shoot_smg'
  | 'swing_sword'
  | 'bullet_deflect'
  | 'hit_enemy'
  | 'crit_hit'
  | 'kill_enemy'
  | 'player_hurt'
  | 'dash'
  | 'telegraph'
  | 'explosion'
  | 'skill_cast'
  | 'shield_shockwave'
  | 'weapon_swap'
  | 'pickup'
  | 'prop_break'
  | 'freeze'
  | 'shatter'
  | 'chain_lightning'
  | 'surface_ignite'
  | 'elemental_reaction'
  | 'team_combo'
  | 'emp_blast';

interface ZzfxPreset {
  volume: number;
  freq: number;
  slide: number;
  attackSec: number;
  decaySec: number;
  noise: number;
  wave: OscillatorType;
}

const SFX_PRESETS: Record<SfxId, ZzfxPreset> = {
  shoot_pistol: {
    volume: 0.24,
    freq: 460,
    slide: -280,
    attackSec: 0.004,
    decaySec: 0.09,
    noise: 0.25,
    wave: 'square',
  },
  shoot_shotgun: {
    volume: 0.32,
    freq: 210,
    slide: -140,
    attackSec: 0.003,
    decaySec: 0.16,
    noise: 0.65,
    wave: 'sawtooth',
  },
  shoot_smg: {
    volume: 0.18,
    freq: 580,
    slide: -320,
    attackSec: 0.002,
    decaySec: 0.06,
    noise: 0.18,
    wave: 'triangle',
  },
  swing_sword: {
    volume: 0.24,
    freq: 320,
    slide: 220,
    attackSec: 0.01,
    decaySec: 0.11,
    noise: 0.35,
    wave: 'sine',
  },
  bullet_deflect: {
    volume: 0.26,
    freq: 980,
    slide: 420,
    attackSec: 0.002,
    decaySec: 0.08,
    noise: 0.05,
    wave: 'triangle',
  },
  hit_enemy: {
    volume: 0.22,
    freq: 290,
    slide: -160,
    attackSec: 0.002,
    decaySec: 0.07,
    noise: 0.3,
    wave: 'square',
  },
  crit_hit: {
    volume: 0.3,
    freq: 740,
    slide: 310,
    attackSec: 0.003,
    decaySec: 0.14,
    noise: 0.2,
    wave: 'sawtooth',
  },
  kill_enemy: {
    volume: 0.28,
    freq: 380,
    slide: -240,
    attackSec: 0.005,
    decaySec: 0.18,
    noise: 0.4,
    wave: 'sawtooth',
  },
  player_hurt: {
    volume: 0.32,
    freq: 165,
    slide: -95,
    attackSec: 0.004,
    decaySec: 0.2,
    noise: 0.45,
    wave: 'sawtooth',
  },
  dash: {
    volume: 0.2,
    freq: 280,
    slide: 360,
    attackSec: 0.008,
    decaySec: 0.11,
    noise: 0.22,
    wave: 'sine',
  },
  telegraph: {
    volume: 0.18,
    freq: 520,
    slide: 180,
    attackSec: 0.015,
    decaySec: 0.15,
    noise: 0.05,
    wave: 'triangle',
  },
  explosion: {
    volume: 0.36,
    freq: 115,
    slide: -80,
    attackSec: 0.005,
    decaySec: 0.32,
    noise: 0.85,
    wave: 'sawtooth',
  },
  skill_cast: {
    volume: 0.26,
    freq: 440,
    slide: 380,
    attackSec: 0.01,
    decaySec: 0.2,
    noise: 0.1,
    wave: 'triangle',
  },
  shield_shockwave: {
    volume: 0.32,
    freq: 260,
    slide: -180,
    attackSec: 0.004,
    decaySec: 0.24,
    noise: 0.5,
    wave: 'sawtooth',
  },
  weapon_swap: {
    volume: 0.18,
    freq: 620,
    slide: 190,
    attackSec: 0.003,
    decaySec: 0.06,
    noise: 0.05,
    wave: 'triangle',
  },
  pickup: {
    volume: 0.2,
    freq: 820,
    slide: 460,
    attackSec: 0.003,
    decaySec: 0.09,
    noise: 0.0,
    wave: 'sine',
  },
  prop_break: {
    volume: 0.26,
    freq: 190,
    slide: -110,
    attackSec: 0.003,
    decaySec: 0.14,
    noise: 0.55,
    wave: 'square',
  },
  freeze: {
    volume: 0.25,
    freq: 860,
    slide: 340,
    attackSec: 0.005,
    decaySec: 0.16,
    noise: 0.12,
    wave: 'triangle',
  },
  shatter: {
    volume: 0.34,
    freq: 920,
    slide: -420,
    attackSec: 0.002,
    decaySec: 0.22,
    noise: 0.55,
    wave: 'sawtooth',
  },
  chain_lightning: {
    volume: 0.28,
    freq: 680,
    slide: -280,
    attackSec: 0.002,
    decaySec: 0.14,
    noise: 0.45,
    wave: 'sawtooth',
  },
  surface_ignite: {
    volume: 0.24,
    freq: 220,
    slide: 120,
    attackSec: 0.008,
    decaySec: 0.22,
    noise: 0.72,
    wave: 'sawtooth',
  },
  elemental_reaction: {
    volume: 0.32,
    freq: 620,
    slide: 360,
    attackSec: 0.004,
    decaySec: 0.2,
    noise: 0.35,
    wave: 'sawtooth',
  },
  team_combo: {
    volume: 0.36,
    freq: 780,
    slide: 520,
    attackSec: 0.005,
    decaySec: 0.28,
    noise: 0.15,
    wave: 'triangle',
  },
  emp_blast: {
    volume: 0.35,
    freq: 480,
    slide: -320,
    attackSec: 0.003,
    decaySec: 0.26,
    noise: 0.45,
    wave: 'sawtooth',
  },
};

const MAX_CONCURRENT_VOICES = 10;

/**
 * Procedural Web Audio ZzFX-style synthesizer with random pitch variation,
 * spatial stereo panning, voice limiting, and zero-warning user-activation gating.
 */
export class ZzfxSynth {
  private ctx: AudioContext | null = null;
  private activeVoices = 0;
  private playedCount = 0;
  private lastPlayedId: SfxId | null = null;
  private masterVolume = 0.65;

  public unlockOnUserGesture(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return;
    }
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
    } catch {
      this.ctx = null;
    }
  }

  public play(id: SfxId, worldX?: number, cameraCenterX?: number): void {
    this.playedCount += 1;
    this.lastPlayedId = id;

    // Only synthesize Web Audio if user has interacted (prevents Chrome autoplay console warning)
    const userActivated =
      typeof navigator !== 'undefined' &&
      'userActivation' in navigator &&
      Boolean(
        (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }).userActivation
          ?.hasBeenActive,
      );

    if (!this.ctx && userActivated) {
      this.unlockOnUserGesture();
    }
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.activeVoices >= MAX_CONCURRENT_VOICES) return;

    const preset = SFX_PRESETS[id];
    if (!preset) return;

    try {
      const now = this.ctx.currentTime;
      const duration = preset.attackSec + preset.decaySec;
      const sampleRate = this.ctx.sampleRate;
      const length = Math.max(64, Math.floor(sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      // Random pitch variation +-6%
      const pitchMult = 0.94 + Math.random() * 0.12;
      const startFreq = preset.freq * pitchMult;
      const endFreq = Math.max(30, (preset.freq + preset.slide) * pitchMult);

      let phase = 0;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const progress = i / length;
        const env =
          t < preset.attackSec
            ? t / Math.max(0.001, preset.attackSec)
            : Math.pow(1 - (t - preset.attackSec) / Math.max(0.001, preset.decaySec), 1.6);

        const instFreq = startFreq + (endFreq - startFreq) * progress;
        phase += (instFreq * Math.PI * 2) / sampleRate;

        let osc = 0;
        if (preset.wave === 'sine') {
          osc = Math.sin(phase);
        } else if (preset.wave === 'square') {
          osc = Math.sin(phase) >= 0 ? 0.8 : -0.8;
        } else if (preset.wave === 'sawtooth') {
          osc = ((phase / (Math.PI * 2)) % 1) * 2 - 1;
        } else {
          osc = (2 / Math.PI) * Math.asin(Math.sin(phase));
        }

        const noiseSample = (Math.random() * 2 - 1) * preset.noise;
        data[i] =
          (osc * (1 - preset.noise * 0.55) + noiseSample) * env * preset.volume * this.masterVolume;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      if (
        typeof worldX === 'number' &&
        typeof cameraCenterX === 'number' &&
        typeof this.ctx.createStereoPanner === 'function'
      ) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = clamp((worldX - cameraCenterX) / 480, -0.85, 0.85);
        source.connect(panner);
        panner.connect(this.ctx.destination);
      } else {
        source.connect(this.ctx.destination);
      }

      this.activeVoices += 1;
      source.onended = () => {
        this.activeVoices = Math.max(0, this.activeVoices - 1);
      };
      source.start(now);
    } catch {
      // Ignore audio hardware errors in headless environments
    }
  }

  public getPlayedCount(): number {
    return this.playedCount;
  }

  public getLastPlayedId(): SfxId | null {
    return this.lastPlayedId;
  }
}

export const zzfx = new ZzfxSynth();
