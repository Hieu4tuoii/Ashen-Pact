import type { ZzfxPreset } from './zzfx.js';

export type WeaponV2SfxId =
  | 'perfect_reload'
  | 'tactical_vent'
  | 'flip_cover'
  | 'wall_slam'
  | 'crossbow_rip'
  | 'thorn_whip'
  | 'thorn_bloom'
  | 'scrap_shell_eject'
  | 'gale_wind_blade'
  | 'gale_cyclone_vent'
  | 'frag_airburst'
  | 'seed_harvest_bloom'
  | 'tether_em_yank'
  | 'focus_laser_hum'
  | 'focus_laser_railgun'
  | 'void_implosion'
  | 'emerald_boomerang'
  | 'berserker_guillotine'
  | 'solar_supernova'
  | 'magma_geyser'
  | 'thunder_pillar';

export const WEAPON_V2_SFX_PRESETS: Record<WeaponV2SfxId, ZzfxPreset> = {
  perfect_reload: {
    volume: 0.28,
    freq: 760,
    slide: 420,
    attackSec: 0.003,
    decaySec: 0.16,
    noise: 0.06,
    wave: 'triangle',
    minIntervalMs: 50,
  },
  tactical_vent: {
    volume: 0.3,
    freq: 420,
    slide: -240,
    attackSec: 0.004,
    decaySec: 0.22,
    noise: 0.55,
    wave: 'sawtooth',
    minIntervalMs: 55,
  },
  flip_cover: {
    volume: 0.32,
    freq: 155,
    slide: -75,
    attackSec: 0.005,
    decaySec: 0.2,
    noise: 0.42,
    wave: 'square',
    minIntervalMs: 60,
  },
  wall_slam: {
    volume: 0.36,
    freq: 120,
    slide: -65,
    attackSec: 0.003,
    decaySec: 0.24,
    noise: 0.58,
    wave: 'sawtooth',
    minIntervalMs: 55,
  },
  crossbow_rip: {
    volume: 0.32,
    freq: 840,
    slide: -460,
    attackSec: 0.002,
    decaySec: 0.2,
    noise: 0.36,
    wave: 'sawtooth',
    minIntervalMs: 45,
  },
  thorn_whip: {
    volume: 0.26,
    freq: 390,
    slide: 310,
    attackSec: 0.006,
    decaySec: 0.14,
    noise: 0.44,
    wave: 'triangle',
    minIntervalMs: 35,
  },
  thorn_bloom: {
    volume: 0.33,
    freq: 310,
    slide: -180,
    attackSec: 0.004,
    decaySec: 0.25,
    noise: 0.58,
    wave: 'square',
    minIntervalMs: 50,
  },
  scrap_shell_eject: {
    volume: 0.34,
    freq: 280,
    slide: -150,
    attackSec: 0.003,
    decaySec: 0.22,
    noise: 0.64,
    wave: 'sawtooth',
    minIntervalMs: 50,
  },
  gale_wind_blade: {
    volume: 0.26,
    freq: 720,
    slide: 360,
    attackSec: 0.003,
    decaySec: 0.13,
    noise: 0.28,
    wave: 'triangle',
    minIntervalMs: 30,
  },
  gale_cyclone_vent: {
    volume: 0.34,
    freq: 510,
    slide: -290,
    attackSec: 0.006,
    decaySec: 0.28,
    noise: 0.68,
    wave: 'sawtooth',
    minIntervalMs: 55,
  },
  frag_airburst: {
    volume: 0.36,
    freq: 175,
    slide: -110,
    attackSec: 0.003,
    decaySec: 0.3,
    noise: 0.78,
    wave: 'sawtooth',
    minIntervalMs: 50,
  },
  seed_harvest_bloom: {
    volume: 0.32,
    freq: 540,
    slide: 380,
    attackSec: 0.008,
    decaySec: 0.28,
    noise: 0.16,
    wave: 'sine',
    minIntervalMs: 55,
  },
  tether_em_yank: {
    volume: 0.35,
    freq: 640,
    slide: -390,
    attackSec: 0.003,
    decaySec: 0.26,
    noise: 0.52,
    wave: 'sawtooth',
    minIntervalMs: 55,
  },
  focus_laser_hum: {
    volume: 0.24,
    freq: 580,
    slide: 140,
    attackSec: 0.004,
    decaySec: 0.14,
    noise: 0.18,
    wave: 'sawtooth',
    minIntervalMs: 65,
  },
  focus_laser_railgun: {
    volume: 0.38,
    freq: 920,
    slide: -640,
    attackSec: 0.002,
    decaySec: 0.32,
    noise: 0.62,
    wave: 'sawtooth',
    minIntervalMs: 55,
  },
  void_implosion: {
    volume: 0.38,
    freq: 210,
    slide: -140,
    attackSec: 0.004,
    decaySec: 0.34,
    noise: 0.72,
    wave: 'square',
    minIntervalMs: 55,
  },
  emerald_boomerang: {
    volume: 0.32,
    freq: 480,
    slide: 260,
    attackSec: 0.004,
    decaySec: 0.22,
    noise: 0.34,
    wave: 'triangle',
    minIntervalMs: 45,
  },
  berserker_guillotine: {
    volume: 0.39,
    freq: 145,
    slide: -85,
    attackSec: 0.002,
    decaySec: 0.32,
    noise: 0.76,
    wave: 'sawtooth',
    minIntervalMs: 55,
  },
  solar_supernova: {
    volume: 0.4,
    freq: 680,
    slide: -420,
    attackSec: 0.003,
    decaySec: 0.36,
    noise: 0.68,
    wave: 'sawtooth',
    minIntervalMs: 60,
  },
  magma_geyser: {
    volume: 0.37,
    freq: 165,
    slide: -95,
    attackSec: 0.003,
    decaySec: 0.3,
    noise: 0.74,
    wave: 'sawtooth',
    minIntervalMs: 50,
  },
  thunder_pillar: {
    volume: 0.4,
    freq: 780,
    slide: -560,
    attackSec: 0.002,
    decaySec: 0.34,
    noise: 0.78,
    wave: 'sawtooth',
    minIntervalMs: 55,
  },
};
