import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockScene {}
  class MockPostFXPipeline {}
  const phaserStub = {
    Scene: MockScene,
    BlendModes: { NORMAL: 0, ADD: 1, MULTIPLY: 2, SCREEN: 3 },
    Math: { Clamp: (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v)) },
    Renderer: { WebGL: { Pipelines: { PostFXPipeline: MockPostFXPipeline } } },
  };
  return { default: phaserStub, ...phaserStub };
});

import {
  ALL_WEAPON_IDS,
  SHOT_FLAG,
  WEAPONS,
  WorldSim,
  type SimEvent,
} from '@ashen-pact/shared';
import {
  SFX_SAMPLE_CATALOG,
  VOICE_PRIORITY,
  parseWavPcm16,
  resolveEnemyProjectileSfx,
  resolveFootstepSurfaceSfx,
  resolvePickupSfx,
  resolveWeaponAttackSfx,
} from '../src/audio/sfx-catalog';
import {
  SFX_PRESETS,
  ZzfxSynth,
  resolveWeaponShootSfx,
  zzfx,
  type SfxId,
} from '../src/audio/zzfx';
import { handleBatch2WeaponSimEvent } from '../src/fx/combat-fx-weapons-v2';
import { processSimEventsImpl } from '../src/scenes/game-scene/sim-events';

const REPO_ROOT = resolve(__dirname, '../../..');
const PUBLIC_DIR = resolve(__dirname, '../public');
const MANIFEST_PATH = resolve(PUBLIC_DIR, 'sfx/manifest.json');

interface MockBufferSource {
  buffer: AudioBuffer | null;
  playbackRate: { value: number };
  onended: (() => void) | null;
  startedAt: number | null;
  stoppedAt: number | null;
  connectedTo: unknown[];
  connect: (dest: unknown) => unknown;
  start: (when?: number) => void;
  stop: (when?: number) => void;
}

function createMockAudioContext() {
  const createdSources: MockBufferSource[] = [];
  const createdPanners: Array<{ pan: { value: number } }> = [];
  const createdGains: Array<{
    gain: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    };
  }> = [];

  const ctx = {
    state: 'running' as AudioContextState,
    currentTime: 1.0,
    sampleRate: 32000,
    destination: { kind: 'destination' },
    resume: vi.fn().mockResolvedValue(undefined),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
      const chData = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: (c: number) => chData[c]!,
      } as unknown as AudioBuffer;
    }),
    createBufferSource: vi.fn(() => {
      const src: MockBufferSource = {
        buffer: null,
        playbackRate: { value: 1 },
        onended: null,
        startedAt: null,
        stoppedAt: null,
        connectedTo: [],
        connect(dest: unknown) {
          src.connectedTo.push(dest);
          return dest;
        },
        start(when = 0) {
          src.startedAt = when;
        },
        stop(when = 0) {
          src.stoppedAt = when;
          if (src.onended) src.onended();
        },
      };
      createdSources.push(src);
      return src as unknown as AudioBufferSourceNode;
    }),
    createGain: vi.fn(() => {
      const g = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn((dest: unknown) => dest),
      };
      createdGains.push(g);
      return g as unknown as GainNode;
    }),
    createStereoPanner: vi.fn(() => {
      const p = {
        pan: { value: 0 },
        connect: vi.fn((dest: unknown) => dest),
      };
      createdPanners.push(p);
      return p as unknown as StereoPannerNode;
    }),
    createOscillator: vi.fn(() => ({
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    })),
    createBiquadFilter: vi.fn(() => ({
      type: 'bandpass',
      frequency: { value: 1000 },
      Q: { value: 0.9 },
      connect: vi.fn(),
    })),
  };

  return {
    ctx: ctx as unknown as AudioContext,
    createdSources,
    createdPanners,
    createdGains,
  };
}

function makeMockGameScene(sim: WorldSim) {
  return {
    transport: { getSim: () => sim },
    camFocusX: sim.player.x,
    camFocusY: sim.player.y,
    crosshairPulse: 0,
    hudBannerTimer: 0,
    hudBannerTextStr: '',
    invitePanelVisible: false,
    lastHudCharacterId: '',
    lastHubPreviewHash: '',
    lastInvitePanelHash: '',
    enemyRigs: new Map(),
    coopPlayerRigs: new Map(),
    simPlayerRigs: new Map(),
    playerRig: {
      triggerRecoil: vi.fn(),
      triggerMeleeSwing: vi.fn(),
      triggerHitFlash: vi.fn(),
      triggerCastPose: vi.fn(),
      getFacingSign: () => 1 as const,
    },
    triggerPlayerHitDirectionIndicator: vi.fn(),
    triggerRoomClearedBanner: vi.fn(),
    triggerIrisTransition: vi.fn(),
    lighting: {
      spawnTransientLight: vi.fn(),
    },
    fx: {
      spawnMuzzleFlashAndCasing: vi.fn(),
      spawnMeleeSlash: vi.fn(),
      spawnDamagePopup: vi.fn(),
      spawnHitSparks: vi.fn(),
      spawnFloatingAlert: vi.fn(),
      spawnExplosionBurst: vi.fn(),
      spawnPropBreakBurst: vi.fn(),
      spawnStatusBurst: vi.fn(),
      spawnChainLightningArc: vi.fn(),
      spawnDashDust: vi.fn(),
      spawnDashAfterimage: vi.fn(),
      spawnEnemyDeathBurst: vi.fn(),
      spawnGrassRustle: vi.fn(),
      spawnChestOpenBurst: vi.fn(),
      spawnElementalReactionFx: vi.fn(),
      spawnFloorDecal: vi.fn(),
      spawnShaderNova: vi.fn(),
      spawnShaderSlash: vi.fn(),
      spawnShaderCone: vi.fn(),
      spawnShaderLance: vi.fn(),
      spawnShaderDirectional: vi.fn(),
      triggerHitStop: vi.fn(),
      addTrauma: vi.fn(),
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Authentic Free SFX Overhaul — Full Bank, Engine & Gameplay Wiring', () => {
  describe('1. Mastered WAV Bank, Manifest & Attribution Integrity (105 SfxIds / 160 WAVs)', () => {
    it('registers all 105 SfxIds in both SFX_PRESETS and SFX_SAMPLE_CATALOG with zero bullet_graze', () => {
      const presetIds = Object.keys(SFX_PRESETS) as SfxId[];
      const catalogIds = Object.keys(SFX_SAMPLE_CATALOG) as SfxId[];

      expect('bullet_graze' in SFX_PRESETS).toBe(false);
      expect(presetIds.length).toBe(105);
      expect(catalogIds.sort()).toEqual([...presetIds].sort());

      for (const id of presetIds) {
        const preset = SFX_PRESETS[id];
        expect(preset.volume).toBeGreaterThan(0);
        expect(preset.freq).toBeGreaterThan(0);
        expect(preset.decaySec).toBeGreaterThan(0);

        const entry = SFX_SAMPLE_CATALOG[id];
        expect(entry).toBeDefined();
        expect(entry.variations.length).toBeGreaterThanOrEqual(1);
        expect(entry.baseGain).toBeGreaterThan(0);
        expect([1, 2, 3, 4]).toContain(entry.priority);
      }
    });

    it('verifies every WAV file on disk parses via parseWavPcm16 with crisp onset, healthy RMS, zero clipping, and clean tail', () => {
      expect(existsSync(MANIFEST_PATH)).toBe(true);
      const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as {
        sampleRate: number;
        totalSfxIds: number;
        entries: Record<string, { transient: boolean; files: string[] }>;
      };
      expect(manifest.sampleRate).toBe(32000);
      expect(manifest.totalSfxIds).toBe(105);

      for (const [id, entry] of Object.entries(SFX_SAMPLE_CATALOG)) {
        const mfEntry = manifest.entries[id];
        expect(mfEntry, `manifest entry missing for ${id}`).toBeDefined();
        expect(entry.variations).toEqual(mfEntry.files);

        for (const relPath of entry.variations) {
          const fullPath = resolve(PUBLIC_DIR, relPath);
          expect(existsSync(fullPath), `missing WAV file ${fullPath}`).toBe(true);

          const nodeBuf = readFileSync(fullPath);
          const ab = nodeBuf.buffer.slice(
            nodeBuf.byteOffset,
            nodeBuf.byteOffset + nodeBuf.byteLength,
          );
          const decoded = parseWavPcm16(ab);
          expect(decoded, `failed to parse ${relPath}`).not.toBeNull();
          expect(decoded!.sampleRate).toBe(32000);
          expect(decoded!.samples.length).toBeGreaterThan(1000);

          let sumSq = 0;
          let peak = 0;
          for (let i = 0; i < decoded!.samples.length; i++) {
            const a = Math.abs(decoded!.samples[i]!);
            if (a > peak) peak = a;
            sumSq += a * a;
          }
          const rms = Math.sqrt(sumSq / decoded!.samples.length);
          expect(peak, `${relPath} clipped`).toBeLessThan(0.91);
          expect(peak, `${relPath} too quiet peak`).toBeGreaterThan(0.42);
          expect(rms, `${relPath} silent/hollow RMS`).toBeGreaterThan(0.04);

          // Onset latency check (first sample >= 10% of peak)
          let onsetIdx = 0;
          const thresh = peak * 0.1;
          for (let i = 0; i < decoded!.samples.length; i++) {
            if (Math.abs(decoded!.samples[i]!) >= thresh) {
              onsetIdx = i;
              break;
            }
          }
          const onsetMs = (onsetIdx * 1000) / decoded!.sampleRate;
          if (mfEntry.transient) {
            expect(onsetMs, `${relPath} sluggish transient onset`).toBeLessThanOrEqual(3.5);
          } else {
            expect(onsetMs, `${relPath} sluggish stinger onset`).toBeLessThanOrEqual(25);
          }

          // Zero tail click check on final 1.5ms
          const tailLen = Math.max(1, Math.floor(decoded!.sampleRate * 0.0015));
          let tailMax = 0;
          for (let i = decoded!.samples.length - tailLen; i < decoded!.samples.length; i++) {
            tailMax = Math.max(tailMax, Math.abs(decoded!.samples[i]!));
          }
          expect(tailMax, `${relPath} tail pop risk`).toBeLessThanOrEqual(0.0025);
        }
      }
    });

    it('keeps CREDITS.md, docs/CREDITS.md, and LICENSE-THIRD-PARTY.txt synchronized at v2.0.0 with full CC-BY-4.0 & CC0 attribution', () => {
      const rootCredits = readFileSync(resolve(REPO_ROOT, 'CREDITS.md'), 'utf-8');
      const docsCredits = readFileSync(resolve(REPO_ROOT, 'docs/CREDITS.md'), 'utf-8');
      const sfxLicense = readFileSync(resolve(PUBLIC_DIR, 'sfx/LICENSE-THIRD-PARTY.txt'), 'utf-8');

      expect(rootCredits).toBe(docsCredits);
      expect(rootCredits).toContain('v2.0.0');
      expect(rootCredits).not.toContain('0.1.0');
      expect(rootCredits).not.toContain('0.2.1');
      expect(rootCredits).toContain('Oculus Audio Pack 01');
      expect(rootCredits).toContain('Oculus VR, LLC');
      expect(rootCredits).toContain('CC-BY-4.0');
      expect(rootCredits).toContain('Still North Media');
      expect(sfxLicense).toContain('Oculus Audio Pack 01');
      expect(sfxLicense).toContain('CC-BY-4.0');
    });
  });

  describe('2. Bespoke Weapon, Enemy, Pickup & Surface Audio Resolvers', () => {
    it('maps all 18 weapons to distinct bespoke attack SFX while keeping resolveWeaponShootSfx 100% backward-compatible', () => {
      expect(ALL_WEAPON_IDS.length).toBe(18);
      for (const wid of ALL_WEAPON_IDS) {
        expect(WEAPONS[wid]).toBeDefined();
        const attackSfx = resolveWeaponAttackSfx(wid);
        expect(SFX_SAMPLE_CATALOG[attackSfx]).toBeDefined();
      }

      // Bespoke differentiation across all 18 weapons + specials
      expect(resolveWeaponAttackSfx('knight_sword')).toBe('swing_sword');
      expect(resolveWeaponAttackSfx('emerald_cleaver')).toBe('swing_emerald_cleaver');
      expect(resolveWeaponAttackSfx('berserker_axe')).toBe('swing_berserker_axe');
      expect(resolveWeaponAttackSfx('thunder_hammer')).toBe('swing_thunder_hammer');
      expect(resolveWeaponAttackSfx('hunter_crossbow')).toBe('shoot_bow');
      expect(resolveWeaponAttackSfx('rivet_gun')).toBe('shoot_pistol');
      expect(resolveWeaponAttackSfx('rivet_gun', { isFinale: true })).toBe('shoot_rivet_finale');
      expect(resolveWeaponAttackSfx('scrap_shotgun')).toBe('shoot_shotgun');
      expect(resolveWeaponAttackSfx('gale_smg')).toBe('shoot_smg');
      expect(resolveWeaponAttackSfx('tesla_carbine')).toBe('shoot_tesla_carbine');
      expect(resolveWeaponAttackSfx('apprentice_staff')).toBe('shoot_apprentice_staff');
      expect(resolveWeaponAttackSfx('thorn_staff')).toBe('thorn_whip');
      expect(resolveWeaponAttackSfx('solar_archon_staff')).toBe('shoot_solar_staff');
      expect(resolveWeaponAttackSfx('void_staff')).toBe('shoot_void_staff');
      expect(resolveWeaponAttackSfx('focus_laser')).toBe('shoot_laser');
      expect(resolveWeaponAttackSfx('frag_launcher')).toBe('shoot_launcher');
      expect(resolveWeaponAttackSfx('magma_cannon')).toBe('shoot_magma_cannon');
      expect(resolveWeaponAttackSfx('seed_gun')).toBe('shoot_seed_gun');
      expect(resolveWeaponAttackSfx('tether_staff')).toBe('shoot_tether_staff');
      expect(resolveWeaponAttackSfx('knight_sword_parry')).toBe('bullet_deflect');
      expect(resolveWeaponAttackSfx('gale_smg_wind_blade')).toBe('gale_wind_blade');

      // Legacy contract preservation
      expect(resolveWeaponShootSfx('solar_archon_staff')).toBe('shoot_staff');
      expect(resolveWeaponShootSfx('berserker_axe')).toBe('swing_sword');
      expect(resolveWeaponShootSfx('thunder_hammer')).toBe('swing_sword');
      expect(resolveWeaponShootSfx('seed_gun')).toBe('shoot_coop_special');
      expect(resolveWeaponShootSfx('tether_staff')).toBe('shoot_coop_special');
    });

    it('resolves enemy projectile archetypes, pickup kinds, and biome/terrain footsteps accurately', () => {
      expect(resolveEnemyProjectileSfx('goblin_bow')).toBe('shoot_bow');
      expect(resolveEnemyProjectileSfx('welder_arc')).toBe('chain_lightning');
      expect(resolveEnemyProjectileSfx('dwarf_mortar')).toBe('shoot_enemy_heavy');
      expect(resolveEnemyProjectileSfx('titan_slag_wave')).toBe('shoot_enemy_heavy');
      expect(resolveEnemyProjectileSfx('shaman_staff')).toBe('shoot_enemy_magic');
      expect(resolveEnemyProjectileSfx('frost_shard')).toBe('shoot_enemy_magic');
      expect(resolveEnemyProjectileSfx('kryssa_ice_lance')).toBe('shoot_enemy_magic');
      expect(resolveEnemyProjectileSfx('bandit_pistol')).toBe('shoot_pistol');

      expect(resolvePickupSfx('gold')).toBe('pickup');
      expect(resolvePickupSfx('life_seed')).toBe('pickup_health');
      expect(resolvePickupSfx('prey_emblem')).toBe('pickup_energy');

      expect(resolveFootstepSurfaceSfx('water', 1, false)).toBe('footstep_water');
      expect(resolveFootstepSurfaceSfx('poison_swamp', 1, false)).toBe('footstep_water');
      expect(resolveFootstepSurfaceSfx('grass', 1, false)).toBe('footstep_grass');
      expect(resolveFootstepSurfaceSfx('ice', 1, false)).toBe('footstep_ice');
      expect(resolveFootstepSurfaceSfx('none', 2, false)).toBe('footstep_ice');
      expect(resolveFootstepSurfaceSfx('conveyor', 1, false)).toBe('footstep_metal');
      expect(resolveFootstepSurfaceSfx('none', 3, false)).toBe('footstep_metal');
      expect(resolveFootstepSurfaceSfx('none', 3, true)).toBe('footstep_stone');
      expect(resolveFootstepSurfaceSfx('none', 1, false)).toBe('footstep_stone');
    });
  });

  describe('3. Sample-First Hybrid WebAudio Engine (Zero-Autoplay-Warn, Round-Robin, Spatial & 24-Voice Stealing)', () => {
    it('preloads WAV PCM via fetch without constructing AudioContext before user gesture', async () => {
      const synth = new ZzfxSynth();
      const pistolBuf = readFileSync(resolve(PUBLIC_DIR, 'sfx/weapons/shoot_pistol_1.wav'));
      const ab = pistolBuf.buffer.slice(
        pistolBuf.byteOffset,
        pistolBuf.byteOffset + pistolBuf.byteLength,
      );

      const audioCtxSpy = vi.fn();
      vi.stubGlobal('AudioContext', audioCtxSpy);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          arrayBuffer: () => Promise.resolve(ab),
        }),
      );

      await synth.preloadSamples(['shoot_pistol']);
      expect(audioCtxSpy).not.toHaveBeenCalled();
      expect(synth.isSampleLoaded('shoot_pistol')).toBe(true);
      expect(synth.isAudioReady()).toBe(false);
    });

    it('hydrates AudioBuffers synchronously, cycles round-robin variations, applies spatial pan/distance gain, and steals LOW priority voices at 24-voice cap', () => {
      const synth = new ZzfxSynth();
      const { ctx, createdSources, createdPanners, createdGains } = createMockAudioContext();
      synth.setAudioContextForTest(ctx);
      expect(synth.isAudioReady()).toBe(true);

      // Inject 3 distinct sample lengths for shoot_pistol so we can verify round-robin order
      synth.injectDecodedSampleForTest('shoot_pistol', [
        { sampleRate: 32000, samples: new Float32Array(1200).fill(0.25) },
        { sampleRate: 32000, samples: new Float32Array(1400).fill(0.25) },
        { sampleRate: 32000, samples: new Float32Array(1600).fill(0.25) },
      ]);
      synth.injectDecodedSampleForTest('footstep_stone', [
        { sampleRate: 32000, samples: new Float32Array(900).fill(0.2) },
      ]);
      synth.injectDecodedSampleForTest('boss_roar', [
        { sampleRate: 32000, samples: new Float32Array(4000).fill(0.5) },
      ]);

      let fakeNow = 10_000;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        fakeNow += 200;
        return fakeNow;
      });

      synth.play('shoot_pistol', 660, 440, 270, 270);
      synth.play('shoot_pistol', 220, 440, 270, 270);
      synth.play('shoot_pistol', 440, 440, 270, 270);

      expect(createdSources.length).toBe(3);
      const lengths = createdSources.map((s) => s.buffer?.length);
      expect(new Set(lengths).size).toBe(3);
      expect(createdPanners[0]!.pan.value).toBeGreaterThan(0.4);
      expect(createdPanners[1]!.pan.value).toBeLessThan(-0.4);
      expect(createdPanners[2]!.pan.value).toBe(0);
      expect(createdGains[0]!.gain.setValueAtTime).toHaveBeenCalled();

      // Fill remaining slots up to 24 active voices with LOW priority footsteps
      while (createdSources.filter((s) => s.stoppedAt === null).length < 24) {
        synth.play('footstep_stone');
      }
      expect(createdSources.filter((s) => s.stoppedAt === null).length).toBe(24);
      expect(SFX_SAMPLE_CATALOG.footstep_stone.priority).toBe(VOICE_PRIORITY.LOW);
      expect(SFX_SAMPLE_CATALOG.boss_roar.priority).toBe(VOICE_PRIORITY.CRITICAL);

      // Playing CRITICAL boss_roar must evict one LOW voice and keep active <= 24
      synth.play('boss_roar');
      const activeAfterSteal = createdSources.filter((s) => s.stoppedAt === null);
      expect(activeAfterSteal.length).toBe(24);
      expect(activeAfterSteal[activeAfterSteal.length - 1]!.buffer?.length).toBe(4000);
    });
  });

  describe('4. SimEvent & Gameplay Audio Integration', () => {
    it('dispatches bespoke weapon SFX, enemy projectile archetypes, hit_armor, impact_wall, categorized pickups, solar_converge, shaman_heal, grass_rustle & shockwave_slam', () => {
      const sim = new WorldSim(1337);
      const scene = makeMockGameScene(sim);
      const played: SfxId[] = [];
      const playSpy = vi.spyOn(zzfx, 'play').mockImplementation((id: SfxId) => {
        played.push(id);
      });

      // 1) Rivet Gun 6th-shot Finale -> shoot_rivet_finale
      sim.projectiles.push({
        id: 901,
        ownerId: sim.player.id,
        isEnemy: false,
        weaponId: 'rivet_gun',
        x: sim.player.x,
        y: sim.player.y,
        vx: 500,
        vy: 0,
        radius: 5,
        damage: 24,
        ttl: 1,
        pierceLeft: 0,
        bounceLeft: 0,
        element: 'none',
        isCrit: false,
        shotFlags: SHOT_FLAG.FINALE_SHOT,
      } as never);

      processSimEventsImpl.call(scene as never, [
        {
          kind: 'projectile_spawned',
          projectileId: 901,
          weaponId: 'rivet_gun',
          team: 'player',
          x: sim.player.x,
          y: sim.player.y,
          angle: 0,
        },
        {
          kind: 'projectile_spawned',
          projectileId: 902,
          weaponId: 'shaman_staff',
          team: 'enemy',
          x: sim.player.x + 80,
          y: sim.player.y,
          angle: Math.PI,
        },
        {
          kind: 'melee_swing',
          playerId: sim.player.id,
          weaponId: 'thunder_hammer',
          x: sim.player.x,
          y: sim.player.y,
          angle: 0,
          arcRad: 2.2,
          range: 78,
          bulletsDestroyed: 0,
        },
        {
          kind: 'damage_dealt',
          targetId: 501,
          targetKind: 'enemy',
          x: sim.player.x + 40,
          y: sim.player.y,
          amount: 18,
          isCrit: false,
          hitArmor: true,
          element: 'none',
          knockbackX: 1,
          knockbackY: 0,
        },
        {
          kind: 'projectile_impact',
          x: sim.player.x + 120,
          y: sim.player.y,
          angle: 0,
          team: 'player',
          hitWall: true,
          destroyedByMelee: false,
          blockedByShield: false,
          isCrit: false,
        },
        {
          kind: 'pickup_collected',
          pickupKind: 'life_seed',
          amount: 20,
          x: sim.player.x,
          y: sim.player.y,
        },
        {
          kind: 'pickup_collected',
          pickupKind: 'prey_emblem',
          amount: 1,
          x: sim.player.x,
          y: sim.player.y,
        },
        {
          kind: 'item_purchased',
          itemId: 77,
          nameVi: 'Súng Đinh Tán',
          costGold: 0,
          x: sim.player.x,
          y: sim.player.y,
        },
        {
          kind: 'shaman_heal',
          shamanId: 12,
          x: sim.player.x + 60,
          y: sim.player.y,
          radius: 90,
          healedCount: 2,
        },
        {
          kind: 'grass_rustle',
          x: sim.player.x,
          y: sim.player.y,
        },
        {
          kind: 'shockwave_spawned',
          enemyId: 88,
          x: sim.player.x + 100,
          y: sim.player.y,
          maxRadius: 180,
        },
      ]);

      const convergeEvent: SimEvent = {
        kind: 'solar_converge_burst',
        playerId: sim.player.id,
        x: sim.player.x + 90,
        y: sim.player.y,
        radius: 52,
        damage: 16,
      };
      expect(handleBatch2WeaponSimEvent(scene as never, convergeEvent, sim, false, true)).toBe(
        true,
      );

      expect(played).toContain('shoot_rivet_finale');
      expect(played).toContain('shoot_enemy_magic');
      expect(played).toContain('swing_thunder_hammer');
      expect(played).toContain('hit_armor');
      expect(played).toContain('impact_wall');
      expect(played).toContain('pickup_health');
      expect(played).toContain('pickup_energy');
      expect(played).toContain('pickup_weapon');
      expect(played).toContain('shaman_heal');
      expect(played).toContain('grass_rustle');
      expect(played).toContain('shockwave_slam');
      expect(played).toContain('solar_converge');
      playSpy.mockRestore();
    });
  });
});
