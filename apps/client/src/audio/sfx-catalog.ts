import { WEAPONS, type SurfaceKind } from '@ashen-pact/shared';
import type { SfxId, ZzfxPreset } from './zzfx.js';

export type BespokeSfxId =
  | 'shoot_rivet_finale'
  | 'shoot_tesla_carbine'
  | 'shoot_apprentice_staff'
  | 'shoot_solar_staff'
  | 'solar_converge'
  | 'shoot_void_staff'
  | 'shoot_magma_cannon'
  | 'shoot_seed_gun'
  | 'shoot_tether_staff'
  | 'swing_emerald_cleaver'
  | 'swing_berserker_axe'
  | 'swing_thunder_hammer'
  | 'reload_start'
  | 'reload_complete'
  | 'hit_armor'
  | 'impact_wall'
  | 'shoot_enemy_magic'
  | 'shoot_enemy_heavy'
  | 'shaman_heal'
  | 'grass_rustle'
  | 'shockwave_slam'
  | 'footstep_stone'
  | 'footstep_grass'
  | 'footstep_water'
  | 'footstep_ice'
  | 'footstep_metal';

export const BESPOKE_SFX_PRESETS: Record<BespokeSfxId, ZzfxPreset> = {
  shoot_rivet_finale: {
    volume: 0.32,
    freq: 520,
    slide: -310,
    attackSec: 0.003,
    decaySec: 0.18,
    noise: 0.34,
    wave: 'sawtooth',
    minIntervalMs: 40,
  },
  shoot_tesla_carbine: {
    volume: 0.28,
    freq: 620,
    slide: -340,
    attackSec: 0.003,
    decaySec: 0.13,
    noise: 0.28,
    wave: 'sawtooth',
    minIntervalMs: 40,
  },
  shoot_apprentice_staff: {
    volume: 0.24,
    freq: 540,
    slide: 190,
    attackSec: 0.005,
    decaySec: 0.13,
    noise: 0.1,
    wave: 'triangle',
    minIntervalMs: 40,
  },
  shoot_solar_staff: {
    volume: 0.26,
    freq: 680,
    slide: 240,
    attackSec: 0.004,
    decaySec: 0.15,
    noise: 0.12,
    wave: 'triangle',
    minIntervalMs: 40,
  },
  solar_converge: {
    volume: 0.32,
    freq: 760,
    slide: 360,
    attackSec: 0.004,
    decaySec: 0.2,
    noise: 0.2,
    wave: 'triangle',
    minIntervalMs: 45,
  },
  shoot_void_staff: {
    volume: 0.28,
    freq: 210,
    slide: -95,
    attackSec: 0.005,
    decaySec: 0.2,
    noise: 0.26,
    wave: 'sawtooth',
    minIntervalMs: 50,
  },
  shoot_magma_cannon: {
    volume: 0.34,
    freq: 145,
    slide: -75,
    attackSec: 0.004,
    decaySec: 0.26,
    noise: 0.56,
    wave: 'sawtooth',
    minIntervalMs: 65,
  },
  shoot_seed_gun: {
    volume: 0.24,
    freq: 590,
    slide: 240,
    attackSec: 0.004,
    decaySec: 0.12,
    noise: 0.14,
    wave: 'sine',
    minIntervalMs: 38,
  },
  shoot_tether_staff: {
    volume: 0.26,
    freq: 660,
    slide: -280,
    attackSec: 0.003,
    decaySec: 0.14,
    noise: 0.22,
    wave: 'square',
    minIntervalMs: 42,
  },
  swing_emerald_cleaver: {
    volume: 0.28,
    freq: 260,
    slide: -130,
    attackSec: 0.005,
    decaySec: 0.16,
    noise: 0.42,
    wave: 'sawtooth',
    minIntervalMs: 45,
  },
  swing_berserker_axe: {
    volume: 0.3,
    freq: 195,
    slide: -98,
    attackSec: 0.005,
    decaySec: 0.19,
    noise: 0.5,
    wave: 'sawtooth',
    minIntervalMs: 50,
  },
  swing_thunder_hammer: {
    volume: 0.32,
    freq: 170,
    slide: -85,
    attackSec: 0.005,
    decaySec: 0.21,
    noise: 0.52,
    wave: 'square',
    minIntervalMs: 55,
  },
  reload_start: {
    volume: 0.2,
    freq: 380,
    slide: -140,
    attackSec: 0.003,
    decaySec: 0.09,
    noise: 0.22,
    wave: 'triangle',
    minIntervalMs: 80,
  },
  reload_complete: {
    volume: 0.24,
    freq: 520,
    slide: 220,
    attackSec: 0.003,
    decaySec: 0.11,
    noise: 0.16,
    wave: 'triangle',
    minIntervalMs: 80,
  },
  hit_armor: {
    volume: 0.26,
    freq: 880,
    slide: -360,
    attackSec: 0.002,
    decaySec: 0.09,
    noise: 0.24,
    wave: 'square',
    minIntervalMs: 28,
  },
  impact_wall: {
    volume: 0.16,
    freq: 320,
    slide: -180,
    attackSec: 0.002,
    decaySec: 0.07,
    noise: 0.45,
    wave: 'triangle',
    minIntervalMs: 35,
  },
  shoot_enemy_magic: {
    volume: 0.22,
    freq: 460,
    slide: 180,
    attackSec: 0.004,
    decaySec: 0.13,
    noise: 0.14,
    wave: 'sine',
    minIntervalMs: 45,
  },
  shoot_enemy_heavy: {
    volume: 0.26,
    freq: 185,
    slide: -90,
    attackSec: 0.004,
    decaySec: 0.18,
    noise: 0.48,
    wave: 'sawtooth',
    minIntervalMs: 55,
  },
  shaman_heal: {
    volume: 0.24,
    freq: 520,
    slide: 280,
    attackSec: 0.008,
    decaySec: 0.22,
    noise: 0.08,
    wave: 'sine',
    minIntervalMs: 90,
  },
  grass_rustle: {
    volume: 0.14,
    freq: 420,
    slide: -120,
    attackSec: 0.004,
    decaySec: 0.08,
    noise: 0.65,
    wave: 'triangle',
    minIntervalMs: 75,
  },
  shockwave_slam: {
    volume: 0.34,
    freq: 130,
    slide: -70,
    attackSec: 0.004,
    decaySec: 0.28,
    noise: 0.56,
    wave: 'sawtooth',
    minIntervalMs: 80,
  },
  footstep_stone: {
    volume: 0.12,
    freq: 240,
    slide: -90,
    attackSec: 0.002,
    decaySec: 0.05,
    noise: 0.42,
    wave: 'triangle',
    minIntervalMs: 70,
  },
  footstep_grass: {
    volume: 0.12,
    freq: 310,
    slide: -110,
    attackSec: 0.003,
    decaySec: 0.055,
    noise: 0.58,
    wave: 'triangle',
    minIntervalMs: 70,
  },
  footstep_water: {
    volume: 0.13,
    freq: 360,
    slide: 90,
    attackSec: 0.003,
    decaySec: 0.065,
    noise: 0.52,
    wave: 'sine',
    minIntervalMs: 70,
  },
  footstep_ice: {
    volume: 0.12,
    freq: 680,
    slide: -210,
    attackSec: 0.002,
    decaySec: 0.05,
    noise: 0.38,
    wave: 'triangle',
    minIntervalMs: 70,
  },
  footstep_metal: {
    volume: 0.13,
    freq: 520,
    slide: -220,
    attackSec: 0.002,
    decaySec: 0.055,
    noise: 0.32,
    wave: 'square',
    minIntervalMs: 70,
  },
};

export const VOICE_PRIORITY = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4,
} as const;

export type VoicePriority = (typeof VOICE_PRIORITY)[keyof typeof VOICE_PRIORITY];

export interface SfxSampleEntry {
  variations: readonly string[];
  baseGain: number;
  pitchJitter: number;
  priority: VoicePriority;
}

export interface DecodedWavPcm {
  sampleRate: number;
  samples: Float32Array;
}

function entry(
  variations: readonly string[],
  baseGain: number,
  priority: VoicePriority,
  pitchJitter = 0.045,
): SfxSampleEntry {
  return { variations, baseGain, pitchJitter, priority };
}

const P = VOICE_PRIORITY;

export const SFX_SAMPLE_CATALOG: Record<SfxId, SfxSampleEntry> = {
  // 1. Player Firearms & Ranged Weapons
  shoot_pistol: entry(
    [
      'sfx/weapons/shoot_pistol_1.wav',
      'sfx/weapons/shoot_pistol_2.wav',
      'sfx/weapons/shoot_pistol_3.wav',
    ],
    0.5,
    P.HIGH,
    0.045,
  ),
  shoot_rivet_finale: entry(['sfx/weapons/shoot_rivet_finale.wav'], 0.62, P.HIGH, 0.03),
  shoot_shotgun: entry(
    [
      'sfx/weapons/shoot_shotgun_1.wav',
      'sfx/weapons/shoot_shotgun_2.wav',
      'sfx/weapons/shoot_shotgun_3.wav',
    ],
    0.62,
    P.HIGH,
    0.04,
  ),
  shoot_smg: entry(
    ['sfx/weapons/shoot_smg_1.wav', 'sfx/weapons/shoot_smg_2.wav', 'sfx/weapons/shoot_smg_3.wav'],
    0.38,
    P.HIGH,
    0.05,
  ),
  shoot_rifle: entry(
    ['sfx/weapons/shoot_rifle_1.wav', 'sfx/weapons/shoot_rifle_2.wav'],
    0.52,
    P.HIGH,
    0.04,
  ),
  shoot_tesla_carbine: entry(
    ['sfx/weapons/shoot_tesla_carbine_1.wav', 'sfx/weapons/shoot_tesla_carbine_2.wav'],
    0.5,
    P.HIGH,
    0.045,
  ),
  shoot_bow: entry(
    ['sfx/weapons/shoot_bow_1.wav', 'sfx/weapons/shoot_bow_2.wav'],
    0.5,
    P.HIGH,
    0.045,
  ),
  shoot_staff: entry(
    ['sfx/weapons/shoot_staff_1.wav', 'sfx/weapons/shoot_staff_2.wav'],
    0.46,
    P.HIGH,
    0.045,
  ),
  shoot_apprentice_staff: entry(
    ['sfx/weapons/shoot_apprentice_staff_1.wav', 'sfx/weapons/shoot_apprentice_staff_2.wav'],
    0.46,
    P.HIGH,
    0.045,
  ),
  shoot_solar_staff: entry(
    ['sfx/weapons/shoot_solar_staff_1.wav', 'sfx/weapons/shoot_solar_staff_2.wav'],
    0.48,
    P.HIGH,
    0.04,
  ),
  solar_converge: entry(['sfx/weapons/solar_converge.wav'], 0.56, P.HIGH, 0.035),
  shoot_void_staff: entry(
    ['sfx/weapons/shoot_void_staff_1.wav', 'sfx/weapons/shoot_void_staff_2.wav'],
    0.52,
    P.HIGH,
    0.04,
  ),
  shoot_laser: entry(
    ['sfx/weapons/shoot_laser_1.wav', 'sfx/weapons/shoot_laser_2.wav'],
    0.38,
    P.HIGH,
    0.04,
  ),
  shoot_launcher: entry(
    ['sfx/weapons/shoot_launcher_1.wav', 'sfx/weapons/shoot_launcher_2.wav'],
    0.58,
    P.HIGH,
    0.04,
  ),
  shoot_magma_cannon: entry(
    ['sfx/weapons/shoot_magma_cannon_1.wav', 'sfx/weapons/shoot_magma_cannon_2.wav'],
    0.62,
    P.HIGH,
    0.035,
  ),
  shoot_coop_special: entry(
    ['sfx/weapons/shoot_coop_special_1.wav', 'sfx/weapons/shoot_coop_special_2.wav'],
    0.46,
    P.HIGH,
    0.045,
  ),
  shoot_seed_gun: entry(
    ['sfx/weapons/shoot_seed_gun_1.wav', 'sfx/weapons/shoot_seed_gun_2.wav'],
    0.46,
    P.HIGH,
    0.05,
  ),
  shoot_tether_staff: entry(
    ['sfx/weapons/shoot_tether_staff_1.wav', 'sfx/weapons/shoot_tether_staff_2.wav'],
    0.48,
    P.HIGH,
    0.045,
  ),

  // 2. Melee Swings
  swing_sword: entry(
    [
      'sfx/weapons/swing_sword_1.wav',
      'sfx/weapons/swing_sword_2.wav',
      'sfx/weapons/swing_sword_3.wav',
    ],
    0.5,
    P.HIGH,
    0.055,
  ),
  swing_heavy: entry(
    ['sfx/weapons/swing_heavy_1.wav', 'sfx/weapons/swing_heavy_2.wav'],
    0.56,
    P.HIGH,
    0.05,
  ),
  swing_emerald_cleaver: entry(
    ['sfx/weapons/swing_emerald_cleaver_1.wav', 'sfx/weapons/swing_emerald_cleaver_2.wav'],
    0.54,
    P.HIGH,
    0.05,
  ),
  swing_berserker_axe: entry(
    ['sfx/weapons/swing_berserker_axe_1.wav', 'sfx/weapons/swing_berserker_axe_2.wav'],
    0.58,
    P.HIGH,
    0.045,
  ),
  swing_thunder_hammer: entry(
    ['sfx/weapons/swing_thunder_hammer_1.wav', 'sfx/weapons/swing_thunder_hammer_2.wav'],
    0.6,
    P.HIGH,
    0.045,
  ),

  // 3. Weapon v2 Specials, Reloads & Tactical Props
  perfect_reload: entry(['sfx/weapons/perfect_reload.wav'], 0.58, P.CRITICAL, 0.02),
  reload_start: entry(['sfx/foley/reload_start.wav'], 0.4, P.NORMAL, 0.03),
  reload_complete: entry(['sfx/foley/reload_complete.wav'], 0.44, P.NORMAL, 0.025),
  tactical_vent: entry(['sfx/weapons/tactical_vent.wav'], 0.54, P.HIGH, 0.035),
  flip_cover: entry(['sfx/world/flip_cover.wav'], 0.56, P.HIGH, 0.04),
  wall_slam: entry(['sfx/combat/wall_slam.wav'], 0.62, P.HIGH, 0.035),
  crossbow_rip: entry(['sfx/weapons/crossbow_rip.wav'], 0.58, P.HIGH, 0.035),
  thorn_whip: entry(
    ['sfx/weapons/thorn_whip_1.wav', 'sfx/weapons/thorn_whip_2.wav'],
    0.48,
    P.HIGH,
    0.05,
  ),
  thorn_bloom: entry(['sfx/weapons/thorn_bloom.wav'], 0.58, P.HIGH, 0.035),
  scrap_shell_eject: entry(['sfx/weapons/scrap_shell_eject.wav'], 0.5, P.HIGH, 0.035),
  gale_wind_blade: entry(['sfx/weapons/gale_wind_blade.wav'], 0.48, P.HIGH, 0.045),
  gale_cyclone_vent: entry(['sfx/weapons/gale_cyclone_vent.wav'], 0.58, P.HIGH, 0.035),
  frag_airburst: entry(['sfx/weapons/frag_airburst.wav'], 0.62, P.HIGH, 0.035),
  seed_harvest_bloom: entry(['sfx/weapons/seed_harvest_bloom.wav'], 0.54, P.HIGH, 0.03),
  tether_em_yank: entry(['sfx/weapons/tether_em_yank.wav'], 0.58, P.HIGH, 0.035),
  focus_laser_hum: entry(['sfx/weapons/focus_laser_hum.wav'], 0.34, P.NORMAL, 0.025),
  focus_laser_railgun: entry(['sfx/weapons/focus_laser_railgun.wav'], 0.66, P.CRITICAL, 0.025),
  void_implosion: entry(['sfx/weapons/void_implosion.wav'], 0.66, P.CRITICAL, 0.025),
  emerald_boomerang: entry(['sfx/weapons/emerald_boomerang.wav'], 0.54, P.HIGH, 0.04),
  berserker_guillotine: entry(['sfx/weapons/berserker_guillotine.wav'], 0.66, P.CRITICAL, 0.03),
  solar_supernova: entry(['sfx/weapons/solar_supernova.wav'], 0.68, P.CRITICAL, 0.025),
  magma_geyser: entry(['sfx/weapons/magma_geyser.wav'], 0.6, P.HIGH, 0.035),
  thunder_pillar: entry(['sfx/weapons/thunder_pillar.wav'], 0.68, P.CRITICAL, 0.025),

  // 4. Combat Impacts, Player Life & Explosions
  bullet_deflect: entry(
    ['sfx/combat/bullet_deflect_1.wav', 'sfx/combat/bullet_deflect_2.wav'],
    0.48,
    P.NORMAL,
    0.055,
  ),
  hit_enemy: entry(
    ['sfx/combat/hit_enemy_1.wav', 'sfx/combat/hit_enemy_2.wav', 'sfx/combat/hit_enemy_3.wav'],
    0.42,
    P.NORMAL,
    0.06,
  ),
  crit_hit: entry(
    ['sfx/combat/crit_hit_1.wav', 'sfx/combat/crit_hit_2.wav'],
    0.54,
    P.HIGH,
    0.045,
  ),
  hit_armor: entry(
    ['sfx/combat/hit_armor_1.wav', 'sfx/combat/hit_armor_2.wav'],
    0.45,
    P.NORMAL,
    0.055,
  ),
  impact_wall: entry(
    ['sfx/combat/impact_wall_1.wav', 'sfx/combat/impact_wall_2.wav'],
    0.26,
    P.LOW,
    0.065,
  ),
  kill_enemy: entry(
    ['sfx/combat/kill_enemy_1.wav', 'sfx/combat/kill_enemy_2.wav'],
    0.52,
    P.NORMAL,
    0.05,
  ),
  player_hurt: entry(
    ['sfx/combat/player_hurt_1.wav', 'sfx/combat/player_hurt_2.wav'],
    0.62,
    P.CRITICAL,
    0.035,
  ),
  armor_break: entry(['sfx/combat/armor_break.wav'], 0.62, P.HIGH, 0.03),
  low_hp_heartbeat: entry(['sfx/combat/low_hp_heartbeat.wav'], 0.56, P.CRITICAL, 0.015),
  player_downed: entry(['sfx/combat/player_downed.wav'], 0.66, P.CRITICAL, 0.02),
  player_revived: entry(['sfx/combat/player_revived.wav'], 0.64, P.CRITICAL, 0.015),
  dash: entry(['sfx/foley/dash_1.wav', 'sfx/foley/dash_2.wav'], 0.42, P.NORMAL, 0.05),
  explosion: entry(
    ['sfx/combat/explosion_1.wav', 'sfx/combat/explosion_2.wav'],
    0.62,
    P.HIGH,
    0.045,
  ),

  // 5. Enemies & Bosses
  telegraph: entry(['sfx/enemies/telegraph.wav'], 0.5, P.HIGH, 0.03),
  boss_roar: entry(
    ['sfx/enemies/boss_roar_1.wav', 'sfx/enemies/boss_roar_2.wav'],
    0.7,
    P.CRITICAL,
    0.025,
  ),
  boss_phase_change: entry(['sfx/enemies/boss_phase_change.wav'], 0.68, P.CRITICAL, 0.02),
  shoot_enemy_magic: entry(
    ['sfx/enemies/shoot_enemy_magic_1.wav', 'sfx/enemies/shoot_enemy_magic_2.wav'],
    0.4,
    P.NORMAL,
    0.05,
  ),
  shoot_enemy_heavy: entry(
    ['sfx/enemies/shoot_enemy_heavy_1.wav', 'sfx/enemies/shoot_enemy_heavy_2.wav'],
    0.48,
    P.NORMAL,
    0.045,
  ),
  shaman_heal: entry(['sfx/enemies/shaman_heal.wav'], 0.46, P.NORMAL, 0.03),
  shockwave_slam: entry(['sfx/enemies/shockwave_slam.wav'], 0.62, P.HIGH, 0.035),

  // 6. Class Skills & Summons
  skill_cast: entry(['sfx/skills/skill_cast.wav'], 0.56, P.HIGH, 0.03),
  skill_vanguard: entry(['sfx/skills/skill_vanguard.wav'], 0.6, P.HIGH, 0.03),
  skill_ranger: entry(['sfx/skills/skill_ranger.wav'], 0.58, P.HIGH, 0.03),
  skill_elementalist: entry(['sfx/skills/skill_elementalist.wav'], 0.58, P.HIGH, 0.03),
  skill_druid: entry(['sfx/skills/skill_druid.wav'], 0.56, P.HIGH, 0.025),
  skill_engineer: entry(['sfx/skills/skill_engineer.wav'], 0.58, P.HIGH, 0.03),
  shield_shockwave: entry(['sfx/skills/shield_shockwave.wav'], 0.62, P.HIGH, 0.03),
  emp_blast: entry(['sfx/skills/emp_blast.wav'], 0.62, P.HIGH, 0.03),

  // 7. Elemental Statuses, Surfaces & Reactions
  freeze: entry(['sfx/elements/freeze.wav'], 0.52, P.HIGH, 0.04),
  shatter: entry(
    ['sfx/elements/shatter_1.wav', 'sfx/elements/shatter_2.wav'],
    0.6,
    P.HIGH,
    0.04,
  ),
  chain_lightning: entry(
    ['sfx/elements/chain_lightning_1.wav', 'sfx/elements/chain_lightning_2.wav'],
    0.5,
    P.HIGH,
    0.05,
  ),
  surface_ignite: entry(['sfx/elements/surface_ignite.wav'], 0.48, P.NORMAL, 0.045),
  elemental_reaction: entry(['sfx/elements/elemental_reaction.wav'], 0.58, P.HIGH, 0.035),
  reaction_vaporize: entry(['sfx/elements/reaction_vaporize.wav'], 0.6, P.HIGH, 0.035),
  reaction_superconduct: entry(['sfx/elements/reaction_superconduct.wav'], 0.6, P.HIGH, 0.035),
  reaction_toxic_blast: entry(['sfx/elements/reaction_toxic_blast.wav'], 0.6, P.HIGH, 0.035),
  reaction_paralysis: entry(['sfx/elements/reaction_paralysis.wav'], 0.58, P.HIGH, 0.035),
  reaction_overload: entry(['sfx/elements/reaction_overload.wav'], 0.64, P.HIGH, 0.035),
  team_combo: entry(['sfx/elements/team_combo.wav'], 0.66, P.CRITICAL, 0.02),

  // 8. Pickups, Chests, Doors, Props, Environment & Footsteps
  weapon_swap: entry(
    ['sfx/foley/weapon_swap_1.wav', 'sfx/foley/weapon_swap_2.wav'],
    0.44,
    P.NORMAL,
    0.035,
  ),
  pickup: entry(['sfx/world/pickup_1.wav', 'sfx/world/pickup_2.wav'], 0.44, P.NORMAL, 0.035),
  pickup_energy: entry(['sfx/world/pickup_energy.wav'], 0.48, P.NORMAL, 0.025),
  pickup_health: entry(['sfx/world/pickup_health.wav'], 0.48, P.NORMAL, 0.025),
  pickup_weapon: entry(['sfx/world/pickup_weapon.wav'], 0.54, P.HIGH, 0.025),
  chest_open: entry(['sfx/world/chest_open.wav'], 0.58, P.HIGH, 0.02),
  door_lock: entry(['sfx/world/door_lock.wav'], 0.54, P.HIGH, 0.025),
  door_open: entry(['sfx/world/door_open.wav'], 0.56, P.HIGH, 0.025),
  portal_enter: entry(['sfx/world/portal_enter.wav'], 0.6, P.HIGH, 0.02),
  prop_break: entry(
    ['sfx/world/prop_break_1.wav', 'sfx/world/prop_break_2.wav'],
    0.48,
    P.NORMAL,
    0.055,
  ),
  grass_rustle: entry(['sfx/foley/grass_rustle.wav'], 0.24, P.LOW, 0.065),
  footstep_stone: entry(
    [
      'sfx/foley/footstep_stone_1.wav',
      'sfx/foley/footstep_stone_2.wav',
      'sfx/foley/footstep_stone_3.wav',
    ],
    0.24,
    P.LOW,
    0.065,
  ),
  footstep_grass: entry(
    [
      'sfx/foley/footstep_grass_1.wav',
      'sfx/foley/footstep_grass_2.wav',
      'sfx/foley/footstep_grass_3.wav',
    ],
    0.24,
    P.LOW,
    0.065,
  ),
  footstep_water: entry(
    [
      'sfx/foley/footstep_water_1.wav',
      'sfx/foley/footstep_water_2.wav',
      'sfx/foley/footstep_water_3.wav',
    ],
    0.26,
    P.LOW,
    0.065,
  ),
  footstep_ice: entry(
    [
      'sfx/foley/footstep_ice_1.wav',
      'sfx/foley/footstep_ice_2.wav',
      'sfx/foley/footstep_ice_3.wav',
    ],
    0.24,
    P.LOW,
    0.065,
  ),
  footstep_metal: entry(
    [
      'sfx/foley/footstep_metal_1.wav',
      'sfx/foley/footstep_metal_2.wav',
      'sfx/foley/footstep_metal_3.wav',
    ],
    0.25,
    P.LOW,
    0.06,
  ),

  // 9. UI & Run Stingers
  ui_hover: entry(['sfx/ui/ui_hover.wav'], 0.24, P.NORMAL, 0.015),
  ui_click: entry(['sfx/ui/ui_click_1.wav', 'sfx/ui/ui_click_2.wav'], 0.42, P.NORMAL, 0.018),
  ui_victory: entry(['sfx/ui/ui_victory.wav'], 0.68, P.CRITICAL, 0),
  ui_defeat: entry(['sfx/ui/ui_defeat.wav'], 0.68, P.CRITICAL, 0),
};

/**
 * Pure TypeScript RIFF WAVE PCM16 decoder.
 * Never constructs AudioContext or OfflineAudioContext, guaranteeing zero browser autoplay console warnings.
 */
export function parseWavPcm16(buffer: ArrayBuffer): DecodedWavPcm | null {
  if (buffer.byteLength < 44) return null;
  const view = new DataView(buffer);
  // 'RIFF' (0x46464952 LE) and 'WAVE' (0x45564157 LE)
  if (view.getUint32(0, true) !== 0x46464952 || view.getUint32(8, true) !== 0x45564157) {
    return null;
  }

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataBytes = 0;

  while (offset + 8 <= buffer.byteLength) {
    const chunkId = view.getUint32(offset, true);
    const chunkSize = view.getUint32(offset + 4, true);
    const bodyStart = offset + 8;
    // 'fmt ' (0x20746d66 LE)
    if (chunkId === 0x20746d66 && bodyStart + 16 <= buffer.byteLength) {
      audioFormat = view.getUint16(bodyStart, true);
      channels = view.getUint16(bodyStart + 2, true);
      sampleRate = view.getUint32(bodyStart + 4, true);
      bitsPerSample = view.getUint16(bodyStart + 14, true);
    } else if (chunkId === 0x61746164) {
      // 'data' (0x61746164 LE)
      dataOffset = bodyStart;
      dataBytes = Math.min(chunkSize, buffer.byteLength - bodyStart);
      break;
    }
    offset = bodyStart + chunkSize + (chunkSize & 1);
  }

  if (
    audioFormat !== 1 ||
    channels < 1 ||
    sampleRate < 4000 ||
    bitsPerSample !== 16 ||
    dataOffset < 0 ||
    dataBytes < 2
  ) {
    return null;
  }

  const frameBytes = channels * 2;
  const frames = Math.floor(dataBytes / frameBytes);
  if (frames <= 0) return null;

  const samples = new Float32Array(frames);
  const inv = 1 / 32768;
  if (channels === 1) {
    for (let i = 0; i < frames; i++) {
      samples[i] = view.getInt16(dataOffset + i * 2, true) * inv;
    }
  } else {
    const chScale = inv / channels;
    for (let i = 0; i < frames; i++) {
      let sum = 0;
      const base = dataOffset + i * frameBytes;
      for (let c = 0; c < channels; c++) {
        sum += view.getInt16(base + c * 2, true);
      }
      samples[i] = sum * chScale;
    }
  }

  return { sampleRate, samples };
}

/**
 * Resolves the bespoke gameplay SfxId for all 18 weapons (plus sub-projectiles & finales),
 * while keeping legacy resolveWeaponShootSfx untouched for backward-compatible unit contracts.
 */
export function resolveWeaponAttackSfx(
  weaponId: string,
  opts?: { isFinale?: boolean },
): SfxId {
  switch (weaponId) {
    case 'knight_sword':
      return 'swing_sword';
    case 'knight_sword_parry':
      return 'bullet_deflect';
    case 'emerald_cleaver':
      return 'swing_emerald_cleaver';
    case 'berserker_axe':
      return 'swing_berserker_axe';
    case 'thunder_hammer':
      return 'swing_thunder_hammer';
    case 'hunter_crossbow':
      return 'shoot_bow';
    case 'rivet_gun':
      return opts?.isFinale ? 'shoot_rivet_finale' : 'shoot_pistol';
    case 'scrap_shotgun':
      return 'shoot_shotgun';
    case 'gale_smg':
      return 'shoot_smg';
    case 'gale_smg_wind_blade':
      return 'gale_wind_blade';
    case 'tesla_carbine':
      return 'shoot_tesla_carbine';
    case 'apprentice_staff':
      return 'shoot_apprentice_staff';
    case 'thorn_staff':
      return 'thorn_whip';
    case 'solar_archon_staff':
      return 'shoot_solar_staff';
    case 'void_staff':
      return 'shoot_void_staff';
    case 'focus_laser':
      return 'shoot_laser';
    case 'frag_launcher':
    case 'frag_launcher_sub':
      return 'shoot_launcher';
    case 'magma_cannon':
      return 'shoot_magma_cannon';
    case 'seed_gun':
      return 'shoot_seed_gun';
    case 'tether_staff':
      return 'shoot_tether_staff';
    default: {
      const w = WEAPONS[weaponId];
      if (!w) return 'shoot_pistol';
      switch (w.category) {
        case 'melee':
          return w.fireRate <= 1.5 ? 'swing_heavy' : 'swing_sword';
        case 'shotgun':
          return 'shoot_shotgun';
        case 'smg':
          return 'shoot_smg';
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
  }
}

export function resolveEnemyProjectileSfx(weaponId: string): SfxId {
  if (weaponId === 'goblin_bow' || weaponId.includes('bow') || weaponId.includes('arrow')) {
    return 'shoot_bow';
  }
  if (weaponId === 'welder_arc' || weaponId.includes('tesla') || weaponId.includes('lightning')) {
    return 'chain_lightning';
  }
  if (
    weaponId === 'dwarf_mortar' ||
    weaponId === 'shielder_slug' ||
    weaponId.startsWith('titan_') ||
    weaponId.includes('mortar') ||
    weaponId.includes('cannon') ||
    weaponId.includes('slag') ||
    weaponId.includes('anvil')
  ) {
    return 'shoot_enemy_heavy';
  }
  if (
    weaponId === 'shaman_staff' ||
    weaponId === 'thorn_burst' ||
    weaponId === 'glacier_spike' ||
    weaponId === 'imp_fireball' ||
    weaponId === 'vengeful_ring' ||
    weaponId.startsWith('frost_') ||
    weaponId.startsWith('kryssa_') ||
    weaponId.startsWith('spore_') ||
    weaponId.startsWith('boss_') ||
    weaponId.includes('magic') ||
    weaponId.includes('orb') ||
    weaponId.includes('shard') ||
    weaponId.includes('spore')
  ) {
    return 'shoot_enemy_magic';
  }
  return 'shoot_pistol';
}

export function resolvePickupSfx(pickupKind: 'gold' | 'life_seed' | 'prey_emblem'): SfxId {
  switch (pickupKind) {
    case 'life_seed':
      return 'pickup_health';
    case 'prey_emblem':
      return 'pickup_energy';
    case 'gold':
    default:
      return 'pickup';
  }
}

export function resolveFootstepSurfaceSfx(
  surface: SurfaceKind,
  currentBiome: number,
  inHub: boolean,
): SfxId {
  switch (surface) {
    case 'water':
    case 'electrified_water':
    case 'poison_swamp':
    case 'oil':
      return 'footstep_water';
    case 'grass':
    case 'burning_grass':
      return 'footstep_grass';
    case 'ice':
      return 'footstep_ice';
    case 'conveyor':
      return 'footstep_metal';
    default:
      if (inHub) return 'footstep_stone';
      if (currentBiome === 2) return 'footstep_ice';
      if (currentBiome === 3) return 'footstep_metal';
      return 'footstep_stone';
  }
}
