import { describe, expect, it, vi } from 'vitest';
import { WEAPONS, WorldSim, type SimPlayerState } from '@ashen-pact/shared';
import {
  computeMicroReloadBarState,
  drawFootMicroReloadBar,
  resolveMicroBarFeedbackSpec,
} from '../src/scenes/game-scene/hud-micro-reload-bar';
import { TextureBaker } from '../src/art/texture-baker';
import { isBridgeFloorTileOverChasm } from '../src/art/texture-baker-surfaces';
import { SFX_PRESETS, zzfx, type SfxId } from '../src/audio/zzfx';
import { resolveProjectileRenderSpec } from '../src/fx/combat-fx-spawners';
import {
  buildMagneticRivetArcLinks,
  resolveTacticalEventVfxSpec,
} from '../src/fx/combat-fx-weapons-v2';

function makeMockPlayer(overrides: Partial<SimPlayerState> = {}): SimPlayerState {
  const sim = new WorldSim(42);
  return {
    ...sim.player,
    weaponSlots: ['rivet_gun', 'knight_sword'],
    activeWeaponSlot: 0,
    clipAmmo: 6,
    clipMax: 6,
    reloadTimer: 0,
    reloadDuration: 1.2,
    reloadLockout: false,
    overclockedNextShot: false,
    weaponHeat: 0,
    overheatLockTimer: 0,
    ventCooldownTimer: 0,
    meleeComboStep: 0,
    meleeComboResetTimer: 0,
    meleeParryWindowTimer: 0,
    ...overrides,
  };
}

function makeMockGraphics() {
  return {
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    fillRoundedRect: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeRect: vi.fn().mockReturnThis(),
    strokeRoundedRect: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
  };
}

describe('AP2-P0B.5 — 32x5px Foot Micro-Reload Bar, Biome 1 Props/Chasm, Weapon V2 VFX & ZzFX', () => {
  describe('32x5px Foot Micro-Reload Bar (computeMicroReloadBarState & drawFootMicroReloadBar)', () => {
    it('hides the micro-bar completely when active weapon is MELEE_COMBO (knight_sword)', () => {
      const player = makeMockPlayer({
        weaponSlots: ['knight_sword', 'rivet_gun'],
        activeWeaponSlot: 0,
        reloadTimer: 0.6,
        reloadDuration: 1.2,
        weaponHeat: 80,
      });
      const state = computeMicroReloadBarState(player, WEAPONS.knight_sword);
      expect(state.visible).toBe(false);
      expect(state.mode).toBe('MELEE_COMBO');
      expect(state.width).toBe(32);
      expect(state.height).toBe(5);
      expect(state.borderColor).toBe(0x141019);

      const g = makeMockGraphics();
      drawFootMicroReloadBar(g as never, 240, 200, player, WEAPONS.knight_sword);
      expect(g.fillRect).not.toHaveBeenCalled();
    });

    it('computes CLIP_RELOAD state with 45%-70% (#FACC15) Golden Window and cursor progress', () => {
      const idlePlayer = makeMockPlayer({
        weaponSlots: ['rivet_gun', 'knight_sword'],
        activeWeaponSlot: 0,
        reloadTimer: 0,
        reloadDuration: 1.2,
      });
      expect(computeMicroReloadBarState(idlePlayer).visible).toBe(false);

      // 50% reload progress (reloadTimer = 0.6 / 1.2) -> inside [0.45, 0.70] Golden Window
      const sweetPlayer = makeMockPlayer({
        weaponSlots: ['rivet_gun', 'knight_sword'],
        activeWeaponSlot: 0,
        reloadTimer: 0.6,
        reloadDuration: 1.2,
      });
      const sweetState = computeMicroReloadBarState(sweetPlayer);
      expect(sweetState.visible).toBe(true);
      expect(sweetState.mode).toBe('CLIP_RELOAD');
      expect(sweetState.width).toBe(32);
      expect(sweetState.height).toBe(5);
      expect(sweetState.borderColor).toBe(0x141019);
      expect(sweetState.sweetSpotStart).toBeCloseTo(0.45, 5);
      expect(sweetState.sweetSpotEnd).toBeCloseTo(0.7, 5);
      expect(sweetState.sweetSpotColor).toBe(0xfacc15);
      expect(sweetState.progress).toBeCloseTo(0.5, 5);
      expect(sweetState.inGoldenWindow).toBe(true);
      expect(sweetState.lockedOut).toBe(false);

      // Lockout / misfire state -> red tint (0xef4444)
      const misfirePlayer = makeMockPlayer({
        weaponSlots: ['rivet_gun', 'knight_sword'],
        activeWeaponSlot: 0,
        reloadTimer: 0.8,
        reloadDuration: 1.2,
        reloadLockout: true,
      });
      const misfireState = computeMicroReloadBarState(misfirePlayer);
      expect(misfireState.visible).toBe(true);
      expect(misfireState.lockedOut).toBe(true);
      expect(misfireState.inGoldenWindow).toBe(false);
      expect(misfireState.fillColor).toBe(0xef4444);

      const g = makeMockGraphics();
      drawFootMicroReloadBar(g as never, 240, 200, sweetPlayer);
      expect(g.fillRect).toHaveBeenCalled();
      expect(g.strokeRect).toHaveBeenCalledWith(240 - 16, 200, 32, 5);
    });

    it('computes HEAT_VENT state with 65%-95% (#F97316) Orange Zone and overheat flash', () => {
      const coolPlayer = makeMockPlayer({
        weaponSlots: ['apprentice_staff', 'knight_sword'],
        activeWeaponSlot: 0,
        weaponHeat: 0,
        overheatLockTimer: 0,
      });
      expect(computeMicroReloadBarState(coolPlayer).visible).toBe(false);

      const orangeZonePlayer = makeMockPlayer({
        weaponSlots: ['apprentice_staff', 'knight_sword'],
        activeWeaponSlot: 0,
        weaponHeat: 80,
        overheatLockTimer: 0,
      });
      const orangeState = computeMicroReloadBarState(orangeZonePlayer);
      expect(orangeState.visible).toBe(true);
      expect(orangeState.mode).toBe('HEAT_VENT');
      expect(orangeState.sweetSpotStart).toBeCloseTo(0.65, 5);
      expect(orangeState.sweetSpotEnd).toBeCloseTo(0.95, 5);
      expect(orangeState.sweetSpotColor).toBe(0xf97316);
      expect(orangeState.progress).toBeCloseTo(0.8, 5);
      expect(orangeState.inOrangeZone).toBe(true);
      expect(orangeState.lockedOut).toBe(false);

      const overheatedPlayer = makeMockPlayer({
        weaponSlots: ['apprentice_staff', 'knight_sword'],
        activeWeaponSlot: 0,
        weaponHeat: 100,
        overheatLockTimer: 1.1,
      });
      const overheatedState = computeMicroReloadBarState(overheatedPlayer);
      expect(overheatedState.visible).toBe(true);
      expect(overheatedState.lockedOut).toBe(true);
      expect(overheatedState.inOrangeZone).toBe(false);
      expect(overheatedState.fillColor).toBe(0xef4444);
    });

    it('resolves micro-bar feedback floating text and flash colors for perfect_reload, tactical_vent, and reload_misfire', () => {
      const perfect = resolveMicroBarFeedbackSpec('perfect_reload');
      expect(perfect.text).toBe('HOÀN HẢO!');
      expect(perfect.flashColor).toBe(0xfacc15);

      const vent = resolveMicroBarFeedbackSpec('tactical_vent');
      expect(vent.text).toBe('XẢ ÁP!');
      expect(vent.flashColor).toBe(0x38bdf8);

      const misfire = resolveMicroBarFeedbackSpec('reload_misfire');
      expect(misfire.text).toBe('KẸT ĐẠN!');
      expect(misfire.flashColor).toBe(0xef4444);
    });
  });

  describe('Biome 1 Prop State Textures & Chasm / Bridge Surface Detection', () => {
    it('maps moss_table 3 states (low, flipped, sliding), volatile_spore_pod, and rotten_totem_pillar texture keys', () => {
      expect(TextureBaker.getPropTextureKey('moss_table', 'low')).toBe('prop_moss_table');
      expect(TextureBaker.getPropTextureKey('moss_table', 'flipped')).toBe('prop_moss_table_flipped');
      expect(TextureBaker.getPropTextureKey('moss_table', 'sliding')).toBe('prop_moss_table_sliding');
      expect(TextureBaker.getPropTextureKey('volatile_spore_pod')).toBe('prop_volatile_spore_pod');
      expect(TextureBaker.getPropTextureKey('rotten_totem_pillar')).toBe('prop_rotten_totem_pillar');
      expect(TextureBaker.getPropTextureKey('rotten_totem_pillar', 'fallen')).toBe(
        'prop_rotten_totem_pillar_fallen',
      );
    });

    it('detects floor tiles bordering chasm as bridge plank tiles (TWIN_BRIDGES)', () => {
      const grid = {
        width: 5,
        height: 5,
        tiles: Array.from({ length: 25 }, () => ({
          kind: 'floor' as const,
          surface: 'none' as const,
          elevation: 0 as const,
        })),
      };
      grid.tiles[1 * 5 + 2] = { kind: 'floor', surface: 'chasm', elevation: 0 };
      grid.tiles[3 * 5 + 2] = { kind: 'floor', surface: 'chasm', elevation: 0 };

      expect(isBridgeFloorTileOverChasm(grid as never, 2, 2)).toBe(true);
      expect(isBridgeFloorTileOverChasm(grid as never, 0, 0)).toBe(false);
    });
  });

  describe('Weapon V2 VFX & Tactical Event Specs', () => {
    it('builds electric arc web links between magnetic rivets within 180px', () => {
      const rivets = [
        { id: 1, ownerPlayerId: 1, x: 100, y: 100, attachedEnemyId: 10, attachedPropId: null, ttlSec: 2 },
        { id: 2, ownerPlayerId: 1, x: 220, y: 100, attachedEnemyId: 11, attachedPropId: null, ttlSec: 2 },
        { id: 3, ownerPlayerId: 1, x: 500, y: 500, attachedEnemyId: null, attachedPropId: null, ttlSec: 2 },
      ];
      const links = buildMagneticRivetArcLinks(rivets, 180);
      expect(links).toHaveLength(1);
      expect(links[0]!.from.id).toBe(1);
      expect(links[0]!.to.id).toBe(2);
    });

    it('maps knight_sword_wave (240px Crescent Wave) and knight_sword_parry projectile render specs', () => {
      const waveSpec = resolveProjectileRenderSpec('knight_sword_wave');
      expect(waveSpec.texture).toBe('proj_knight_sword_wave');
      expect(waveSpec.scale).toBeGreaterThan(1.1);

      const parrySpec = resolveProjectileRenderSpec('knight_sword_parry');
      expect(parrySpec.tint).toBeDefined();
    });

    it('resolves tactical physics VFX specs (cover_flipped Micro-Blank r=56, wall_slam ĐẬP TƯỜNG!, ring_out RING-OUT!)', () => {
      const flipSpec = resolveTacticalEventVfxSpec('cover_flipped');
      expect(flipSpec.radius).toBe(56);
      expect(flipSpec.ringColor).toBe(0xffffff);

      const wallSlamSpec = resolveTacticalEventVfxSpec('wall_slam');
      expect(wallSlamSpec.floatingText).toBe('ĐẬP TƯỜNG!');

      const ringOutSpec = resolveTacticalEventVfxSpec('ring_out');
      expect(ringOutSpec.floatingText).toBe('RING-OUT!');
    });
  });

  describe('ZzFX Audio Presets (perfect_reload, tactical_vent, flip_cover, wall_slam)', () => {
    it('registers all 4 P0B tactical ZzFX sound effects with valid synthesis presets', () => {
      const requiredIds: SfxId[] = ['perfect_reload', 'tactical_vent', 'flip_cover', 'wall_slam'];
      const presetIds = zzfx.getPresetIds();
      for (const id of requiredIds) {
        expect(presetIds).toContain(id);
        expect(SFX_PRESETS[id]).toBeDefined();
        expect(SFX_PRESETS[id].volume).toBeGreaterThan(0);
        expect(SFX_PRESETS[id].freq).toBeGreaterThan(0);
      }
    });
  });
});
