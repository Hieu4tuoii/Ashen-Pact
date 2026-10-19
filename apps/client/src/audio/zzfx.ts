import { clamp, WEAPONS } from '@ashen-pact/shared';
import { graphicsSettings } from '../ui/graphics-settings';

export type SfxId =
  | 'shoot_pistol'
  | 'shoot_shotgun'
  | 'shoot_smg'
  | 'shoot_rifle'
  | 'shoot_bow'
  | 'shoot_staff'
  | 'shoot_laser'
  | 'shoot_launcher'
  | 'shoot_coop_special'
  | 'swing_sword'
  | 'swing_heavy'
  | 'bullet_deflect'
  | 'hit_enemy'
  | 'crit_hit'
  | 'kill_enemy'
  | 'player_hurt'
  | 'armor_break'
  | 'low_hp_heartbeat'
  | 'player_downed'
  | 'player_revived'
  | 'dash'
  | 'telegraph'
  | 'boss_roar'
  | 'boss_phase_change'
  | 'explosion'
  | 'skill_cast'
  | 'skill_vanguard'
  | 'skill_ranger'
  | 'skill_elementalist'
  | 'skill_druid'
  | 'skill_engineer'
  | 'shield_shockwave'
  | 'weapon_swap'
  | 'pickup'
  | 'pickup_energy'
  | 'pickup_health'
  | 'pickup_weapon'
  | 'chest_open'
  | 'door_lock'
  | 'door_open'
  | 'portal_enter'
  | 'prop_break'
  | 'freeze'
  | 'shatter'
  | 'chain_lightning'
  | 'surface_ignite'
  | 'elemental_reaction'
  | 'reaction_vaporize'
  | 'reaction_superconduct'
  | 'reaction_toxic_blast'
  | 'reaction_paralysis'
  | 'reaction_overload'
  | 'team_combo'
  | 'emp_blast'
  | 'ui_hover'
  | 'ui_click'
  | 'ui_victory'
  | 'ui_defeat';

export interface ZzfxPreset {
  volume: number;
  freq: number;
  slide: number;
  attackSec: number;
  decaySec: number;
  noise: number;
  wave: OscillatorType;
  minIntervalMs?: number;
}

export const SFX_PRESETS: Record<SfxId, ZzfxPreset> = {
  shoot_pistol: {
    volume: 0.24,
    freq: 460,
    slide: -280,
    attackSec: 0.004,
    decaySec: 0.09,
    noise: 0.25,
    wave: 'square',
    minIntervalMs: 35,
  },
  shoot_shotgun: {
    volume: 0.32,
    freq: 210,
    slide: -140,
    attackSec: 0.003,
    decaySec: 0.16,
    noise: 0.65,
    wave: 'sawtooth',
    minIntervalMs: 55,
  },
  shoot_smg: {
    volume: 0.18,
    freq: 580,
    slide: -320,
    attackSec: 0.002,
    decaySec: 0.06,
    noise: 0.18,
    wave: 'triangle',
    minIntervalMs: 25,
  },
  shoot_rifle: {
    volume: 0.28,
    freq: 360,
    slide: -240,
    attackSec: 0.003,
    decaySec: 0.13,
    noise: 0.32,
    wave: 'sawtooth',
    minIntervalMs: 45,
  },
  shoot_bow: {
    volume: 0.22,
    freq: 520,
    slide: -190,
    attackSec: 0.006,
    decaySec: 0.11,
    noise: 0.14,
    wave: 'triangle',
    minIntervalMs: 40,
  },
  shoot_staff: {
    volume: 0.24,
    freq: 640,
    slide: 260,
    attackSec: 0.008,
    decaySec: 0.15,
    noise: 0.08,
    wave: 'sine',
    minIntervalMs: 40,
  },
  shoot_laser: {
    volume: 0.2,
    freq: 880,
    slide: -420,
    attackSec: 0.002,
    decaySec: 0.08,
    noise: 0.06,
    wave: 'sawtooth',
    minIntervalMs: 30,
  },
  shoot_launcher: {
    volume: 0.32,
    freq: 165,
    slide: -95,
    attackSec: 0.005,
    decaySec: 0.22,
    noise: 0.58,
    wave: 'sawtooth',
    minIntervalMs: 65,
  },
  shoot_coop_special: {
    volume: 0.26,
    freq: 720,
    slide: 340,
    attackSec: 0.005,
    decaySec: 0.14,
    noise: 0.1,
    wave: 'triangle',
    minIntervalMs: 40,
  },
  swing_sword: {
    volume: 0.24,
    freq: 320,
    slide: 220,
    attackSec: 0.01,
    decaySec: 0.11,
    noise: 0.35,
    wave: 'sine',
    minIntervalMs: 45,
  },
  swing_heavy: {
    volume: 0.3,
    freq: 195,
    slide: -115,
    attackSec: 0.014,
    decaySec: 0.19,
    noise: 0.48,
    wave: 'sawtooth',
    minIntervalMs: 65,
  },
  bullet_deflect: {
    volume: 0.26,
    freq: 980,
    slide: 420,
    attackSec: 0.002,
    decaySec: 0.08,
    noise: 0.05,
    wave: 'triangle',
    minIntervalMs: 25,
  },
  hit_enemy: {
    volume: 0.22,
    freq: 290,
    slide: -160,
    attackSec: 0.002,
    decaySec: 0.07,
    noise: 0.3,
    wave: 'square',
    minIntervalMs: 22,
  },
  crit_hit: {
    volume: 0.3,
    freq: 740,
    slide: 310,
    attackSec: 0.003,
    decaySec: 0.14,
    noise: 0.2,
    wave: 'sawtooth',
    minIntervalMs: 30,
  },
  kill_enemy: {
    volume: 0.28,
    freq: 380,
    slide: -240,
    attackSec: 0.005,
    decaySec: 0.18,
    noise: 0.4,
    wave: 'sawtooth',
    minIntervalMs: 35,
  },
  player_hurt: {
    volume: 0.32,
    freq: 165,
    slide: -95,
    attackSec: 0.004,
    decaySec: 0.2,
    noise: 0.45,
    wave: 'sawtooth',
    minIntervalMs: 60,
  },
  armor_break: {
    volume: 0.36,
    freq: 860,
    slide: -540,
    attackSec: 0.002,
    decaySec: 0.26,
    noise: 0.62,
    wave: 'sawtooth',
    minIntervalMs: 120,
  },
  low_hp_heartbeat: {
    volume: 0.28,
    freq: 78,
    slide: -26,
    attackSec: 0.012,
    decaySec: 0.18,
    noise: 0.08,
    wave: 'sine',
    minIntervalMs: 400,
  },
  player_downed: {
    volume: 0.36,
    freq: 240,
    slide: -170,
    attackSec: 0.008,
    decaySec: 0.36,
    noise: 0.38,
    wave: 'sawtooth',
    minIntervalMs: 150,
  },
  player_revived: {
    volume: 0.32,
    freq: 520,
    slide: 460,
    attackSec: 0.01,
    decaySec: 0.32,
    noise: 0.06,
    wave: 'triangle',
    minIntervalMs: 150,
  },
  dash: {
    volume: 0.2,
    freq: 280,
    slide: 360,
    attackSec: 0.008,
    decaySec: 0.11,
    noise: 0.22,
    wave: 'sine',
    minIntervalMs: 50,
  },
  telegraph: {
    volume: 0.18,
    freq: 520,
    slide: 180,
    attackSec: 0.015,
    decaySec: 0.15,
    noise: 0.05,
    wave: 'triangle',
    minIntervalMs: 55,
  },
  boss_roar: {
    volume: 0.38,
    freq: 130,
    slide: -65,
    attackSec: 0.025,
    decaySec: 0.48,
    noise: 0.68,
    wave: 'sawtooth',
    minIntervalMs: 250,
  },
  boss_phase_change: {
    volume: 0.38,
    freq: 310,
    slide: 290,
    attackSec: 0.015,
    decaySec: 0.42,
    noise: 0.42,
    wave: 'sawtooth',
    minIntervalMs: 250,
  },
  explosion: {
    volume: 0.36,
    freq: 115,
    slide: -80,
    attackSec: 0.005,
    decaySec: 0.32,
    noise: 0.85,
    wave: 'sawtooth',
    minIntervalMs: 55,
  },
  skill_cast: {
    volume: 0.26,
    freq: 440,
    slide: 380,
    attackSec: 0.01,
    decaySec: 0.2,
    noise: 0.1,
    wave: 'triangle',
    minIntervalMs: 60,
  },
  skill_vanguard: {
    volume: 0.28,
    freq: 360,
    slide: 240,
    attackSec: 0.006,
    decaySec: 0.22,
    noise: 0.2,
    wave: 'square',
    minIntervalMs: 60,
  },
  skill_ranger: {
    volume: 0.26,
    freq: 690,
    slide: 410,
    attackSec: 0.004,
    decaySec: 0.18,
    noise: 0.12,
    wave: 'triangle',
    minIntervalMs: 60,
  },
  skill_elementalist: {
    volume: 0.28,
    freq: 540,
    slide: 480,
    attackSec: 0.01,
    decaySec: 0.26,
    noise: 0.22,
    wave: 'sawtooth',
    minIntervalMs: 60,
  },
  skill_druid: {
    volume: 0.26,
    freq: 480,
    slide: 320,
    attackSec: 0.015,
    decaySec: 0.28,
    noise: 0.05,
    wave: 'sine',
    minIntervalMs: 60,
  },
  skill_engineer: {
    volume: 0.28,
    freq: 610,
    slide: -190,
    attackSec: 0.005,
    decaySec: 0.2,
    noise: 0.28,
    wave: 'square',
    minIntervalMs: 60,
  },
  shield_shockwave: {
    volume: 0.32,
    freq: 260,
    slide: -180,
    attackSec: 0.004,
    decaySec: 0.24,
    noise: 0.5,
    wave: 'sawtooth',
    minIntervalMs: 70,
  },
  weapon_swap: {
    volume: 0.18,
    freq: 620,
    slide: 190,
    attackSec: 0.003,
    decaySec: 0.06,
    noise: 0.05,
    wave: 'triangle',
    minIntervalMs: 30,
  },
  pickup: {
    volume: 0.2,
    freq: 820,
    slide: 460,
    attackSec: 0.003,
    decaySec: 0.09,
    noise: 0.0,
    wave: 'sine',
    minIntervalMs: 25,
  },
  pickup_energy: {
    volume: 0.18,
    freq: 920,
    slide: 380,
    attackSec: 0.003,
    decaySec: 0.08,
    noise: 0.02,
    wave: 'triangle',
    minIntervalMs: 25,
  },
  pickup_health: {
    volume: 0.26,
    freq: 560,
    slide: 420,
    attackSec: 0.008,
    decaySec: 0.2,
    noise: 0.04,
    wave: 'sine',
    minIntervalMs: 50,
  },
  pickup_weapon: {
    volume: 0.26,
    freq: 480,
    slide: 310,
    attackSec: 0.005,
    decaySec: 0.16,
    noise: 0.12,
    wave: 'triangle',
    minIntervalMs: 50,
  },
  chest_open: {
    volume: 0.3,
    freq: 420,
    slide: 520,
    attackSec: 0.01,
    decaySec: 0.28,
    noise: 0.1,
    wave: 'triangle',
    minIntervalMs: 80,
  },
  door_lock: {
    volume: 0.28,
    freq: 180,
    slide: -90,
    attackSec: 0.005,
    decaySec: 0.18,
    noise: 0.42,
    wave: 'square',
    minIntervalMs: 80,
  },
  door_open: {
    volume: 0.26,
    freq: 290,
    slide: 240,
    attackSec: 0.01,
    decaySec: 0.22,
    noise: 0.18,
    wave: 'triangle',
    minIntervalMs: 80,
  },
  portal_enter: {
    volume: 0.32,
    freq: 380,
    slide: 560,
    attackSec: 0.02,
    decaySec: 0.36,
    noise: 0.14,
    wave: 'sine',
    minIntervalMs: 120,
  },
  prop_break: {
    volume: 0.26,
    freq: 190,
    slide: -110,
    attackSec: 0.003,
    decaySec: 0.14,
    noise: 0.55,
    wave: 'square',
    minIntervalMs: 35,
  },
  freeze: {
    volume: 0.25,
    freq: 860,
    slide: 340,
    attackSec: 0.005,
    decaySec: 0.16,
    noise: 0.12,
    wave: 'triangle',
    minIntervalMs: 40,
  },
  shatter: {
    volume: 0.34,
    freq: 920,
    slide: -420,
    attackSec: 0.002,
    decaySec: 0.22,
    noise: 0.55,
    wave: 'sawtooth',
    minIntervalMs: 45,
  },
  chain_lightning: {
    volume: 0.28,
    freq: 680,
    slide: -280,
    attackSec: 0.002,
    decaySec: 0.14,
    noise: 0.45,
    wave: 'sawtooth',
    minIntervalMs: 35,
  },
  surface_ignite: {
    volume: 0.24,
    freq: 220,
    slide: 120,
    attackSec: 0.008,
    decaySec: 0.22,
    noise: 0.72,
    wave: 'sawtooth',
    minIntervalMs: 45,
  },
  elemental_reaction: {
    volume: 0.32,
    freq: 620,
    slide: 360,
    attackSec: 0.004,
    decaySec: 0.2,
    noise: 0.35,
    wave: 'sawtooth',
    minIntervalMs: 45,
  },
  reaction_vaporize: {
    volume: 0.3,
    freq: 480,
    slide: 260,
    attackSec: 0.008,
    decaySec: 0.24,
    noise: 0.65,
    wave: 'sine',
    minIntervalMs: 45,
  },
  reaction_superconduct: {
    volume: 0.32,
    freq: 760,
    slide: -380,
    attackSec: 0.003,
    decaySec: 0.22,
    noise: 0.38,
    wave: 'sawtooth',
    minIntervalMs: 45,
  },
  reaction_toxic_blast: {
    volume: 0.34,
    freq: 260,
    slide: -140,
    attackSec: 0.005,
    decaySec: 0.26,
    noise: 0.62,
    wave: 'square',
    minIntervalMs: 45,
  },
  reaction_paralysis: {
    volume: 0.3,
    freq: 820,
    slide: -290,
    attackSec: 0.002,
    decaySec: 0.18,
    noise: 0.42,
    wave: 'triangle',
    minIntervalMs: 45,
  },
  reaction_overload: {
    volume: 0.36,
    freq: 190,
    slide: -110,
    attackSec: 0.004,
    decaySec: 0.28,
    noise: 0.78,
    wave: 'sawtooth',
    minIntervalMs: 45,
  },
  team_combo: {
    volume: 0.36,
    freq: 780,
    slide: 520,
    attackSec: 0.005,
    decaySec: 0.28,
    noise: 0.15,
    wave: 'triangle',
    minIntervalMs: 65,
  },
  emp_blast: {
    volume: 0.35,
    freq: 480,
    slide: -320,
    attackSec: 0.003,
    decaySec: 0.26,
    noise: 0.45,
    wave: 'sawtooth',
    minIntervalMs: 65,
  },
  ui_hover: {
    volume: 0.12,
    freq: 740,
    slide: 120,
    attackSec: 0.002,
    decaySec: 0.035,
    noise: 0.0,
    wave: 'sine',
    minIntervalMs: 25,
  },
  ui_click: {
    volume: 0.2,
    freq: 580,
    slide: 320,
    attackSec: 0.002,
    decaySec: 0.065,
    noise: 0.04,
    wave: 'triangle',
    minIntervalMs: 30,
  },
  ui_victory: {
    volume: 0.34,
    freq: 523.25,
    slide: 523.25,
    attackSec: 0.015,
    decaySec: 0.45,
    noise: 0.04,
    wave: 'triangle',
    minIntervalMs: 200,
  },
  ui_defeat: {
    volume: 0.34,
    freq: 293.66,
    slide: -146.83,
    attackSec: 0.02,
    decaySec: 0.5,
    noise: 0.18,
    wave: 'sawtooth',
    minIntervalMs: 200,
  },
};

export function resolveWeaponShootSfx(weaponId: string): SfxId {
  const w = WEAPONS[weaponId];
  if (!w) return 'shoot_pistol';
  switch (w.category) {
    case 'melee':
      return w.fireRate <= 1.5 ? 'swing_heavy' : 'swing_sword';
    case 'pistol':
      return 'shoot_pistol';
    case 'smg':
      return 'shoot_smg';
    case 'shotgun':
      return 'shoot_shotgun';
    case 'rifle':
      return 'shoot_rifle';
    case 'crossbow':
      return 'shoot_bow';
    case 'staff':
      return 'shoot_staff';
    case 'laser':
      return 'shoot_laser';
    case 'launcher':
      return 'shoot_launcher';
    case 'coop_special':
      return 'shoot_coop_special';
    default:
      return 'shoot_pistol';
  }
}

const MAX_CONCURRENT_VOICES = 12;

/**
 * Procedural Web Audio ZzFX-style synthesizer with random pitch variation (±7%),
 * 2D spatial stereo panning & distance attenuation, voice limiting, per-preset cooldowns,
 * and zero-warning user-activation gating.
 */
export class ZzfxSynth {
  private ctx: AudioContext | null = null;
  private activeVoices = 0;
  private playedCount = 0;
  private lastPlayedId: SfxId | null = null;
  private readonly lastPlayTimeMs = new Map<SfxId, number>();

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

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

  public play(
    id: SfxId,
    worldX?: number,
    cameraCenterX?: number,
    worldY?: number,
    cameraCenterY?: number,
  ): void {
    this.playedCount += 1;
    this.lastPlayedId = id;

    const preset = SFX_PRESETS[id];
    if (!preset) return;

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const minInterval = preset.minIntervalMs ?? 25;
    const prevMs = this.lastPlayTimeMs.get(id) ?? -Infinity;
    if (nowMs - prevMs < minInterval) {
      return;
    }
    this.lastPlayTimeMs.set(id, nowMs);

    const settings = graphicsSettings.getState();
    const effectiveMaster = clamp(settings.masterVolume * settings.sfxVolume, 0, 1);
    if (effectiveMaster <= 0.001) return;

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

    try {
      const now = this.ctx.currentTime;
      const duration = preset.attackSec + preset.decaySec;
      const sampleRate = this.ctx.sampleRate;
      const length = Math.max(64, Math.floor(sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      // Distance attenuation when world coordinates are provided
      let distAtten = 1.0;
      if (typeof worldX === 'number' && typeof cameraCenterX === 'number') {
        const dx = worldX - cameraCenterX;
        const dy =
          typeof worldY === 'number' && typeof cameraCenterY === 'number'
            ? worldY - cameraCenterY
            : 0;
        const dist = Math.hypot(dx, dy);
        distAtten = clamp(1 - dist / 960, 0.22, 1.0);
      }

      // Random pitch variation ±7% (none for UI hover/click to keep UI crisp, ±3% for UI)
      const isUi = id.startsWith('ui_');
      const pitchSpread = isUi ? 0.04 : 0.14;
      const pitchMult = 1 - pitchSpread * 0.5 + Math.random() * pitchSpread;
      const startFreq = preset.freq * pitchMult;
      const endFreq = Math.max(28, (preset.freq + preset.slide) * pitchMult);
      const gainScale = preset.volume * effectiveMaster * distAtten;

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
        data[i] = (osc * (1 - preset.noise * 0.55) + noiseSample) * env * gainScale;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      if (
        typeof worldX === 'number' &&
        typeof cameraCenterX === 'number' &&
        typeof this.ctx.createStereoPanner === 'function'
      ) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = clamp((worldX - cameraCenterX) / 440, -0.88, 0.88);
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

  public getPresetIds(): SfxId[] {
    return Object.keys(SFX_PRESETS) as SfxId[];
  }
}

export const zzfx = new ZzfxSynth();

