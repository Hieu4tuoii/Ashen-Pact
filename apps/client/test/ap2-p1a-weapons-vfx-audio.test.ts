import { describe, expect, it, vi } from 'vitest';
import {
  SHOT_FLAG,
  WorldSim,
  encodeWorldSnapshot,
  type SimEnemyState,
  type SimPlayerState,
  type SimProjectileState,
  type SimSummonState,
  type SimTetherBeamState,
} from '@ashen-pact/shared';
import {
  SFX_PRESETS,
  WEAPON_V2_SFX_PRESETS,
  resolveWeaponShootSfx,
  zzfx,
  type SfxId,
} from '../src/audio/zzfx';
import { resolveProjectileRenderSpec } from '../src/fx/combat-fx-spawners';
import {
  drawBatch1ActiveProjectiles,
  drawEnemyBatch1Indicators,
  drawEnemyEmbeddedArrows,
  drawEnemyParasiticThorns,
  drawSeedGunLifeBlossom,
  drawTetherStaffBeams,
  getWeaponV2OverlayState,
  spawnCrossbowBarbedRipVfx,
  spawnFragLauncherAirburstVfx,
  spawnGaleCycloneVentVfx,
  spawnGaleWindBladeVfx,
  spawnScrapShotgunBlastVfx,
  spawnScrapShotgunShellEjectVfx,
  spawnSeedGunHarvestBloomVfx,
  spawnTetherElectromagneticYankVfx,
  spawnThornBloomVfx,
  spawnThornStaffWhipVfx,
  syncBatch1WeaponRoomEntities,
  updateAndDrawWeaponV2Overlays,
} from '../src/fx/combat-fx-weapons-v2';
import {
  drawEnemyEmbeddedArrows as p1aDrawArrows,
  drawEnemyParasiticThorns as p1aDrawThorns,
  drawSeedGunLifeBlossom as p1aDrawBlossom,
  drawTetherStaffBeams as p1aDrawTethers,
  syncBatch1WeaponRoomEntities as p1aSyncBatch1,
} from '../src/fx/combat-fx-weapons-p1a';

function makeMockGraphics() {
  return {
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    fillRoundedRect: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    fillEllipse: vi.fn().mockReturnThis(),
    fillTriangle: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeRect: vi.fn().mockReturnThis(),
    strokeRoundedRect: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
    strokeEllipse: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    arc: vi.fn().mockReturnThis(),
    closePath: vi.fn().mockReturnThis(),
    fillPath: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
  };
}

function makeMockFx() {
  return {
    spawnHitSparks: vi.fn(),
    spawnFloatingAlert: vi.fn(),
    spawnFloorDecal: vi.fn(),
    spawnChainLightningArc: vi.fn(),
    spawnDashDust: vi.fn(),
    spawnPropBreakBurst: vi.fn(),
  };
}

function makeMockPlayer(overrides: Partial<SimPlayerState> = {}): SimPlayerState {
  const sim = new WorldSim(42);
  return {
    ...sim.player,
    weaponSlots: ['hunter_crossbow', 'thorn_staff'],
    activeWeaponSlot: 0,
    ...overrides,
  };
}

describe('AP2-P1A.4 — Procedural VFX, Entity Indicators, Deployable/Tether Rendering & ZzFX Audio for 7 Batch-1 Weapons', () => {
  describe('1. ZzFX Audio Synthesis Presets & Weapon Shoot Mapping', () => {
    it('registers all 9 P1A Batch-1 weapon ZzFX presets with valid parameters', () => {
      const batch1SfxIds: SfxId[] = [
        'crossbow_rip',
        'thorn_whip',
        'thorn_bloom',
        'scrap_shell_eject',
        'gale_wind_blade',
        'gale_cyclone_vent',
        'frag_airburst',
        'seed_harvest_bloom',
        'tether_em_yank',
      ];
      const registeredIds = zzfx.getPresetIds();
      for (const id of batch1SfxIds) {
        expect(registeredIds).toContain(id);
        expect(WEAPON_V2_SFX_PRESETS[id]).toBeDefined();
        expect(SFX_PRESETS[id]).toBeDefined();
        expect(SFX_PRESETS[id].volume).toBeGreaterThan(0);
        expect(SFX_PRESETS[id].freq).toBeGreaterThan(0);
        expect(SFX_PRESETS[id].decaySec).toBeGreaterThan(0);
      }
    });

    it('resolves distinct shoot SFX for all 7 Batch-1 weapons and their sub-projectiles', () => {
      expect(resolveWeaponShootSfx('hunter_crossbow')).toBe('shoot_bow');
      expect(resolveWeaponShootSfx('thorn_staff')).toBe('thorn_whip');
      expect(resolveWeaponShootSfx('scrap_shotgun')).toBe('shoot_shotgun');
      expect(resolveWeaponShootSfx('gale_smg')).toBe('shoot_smg');
      expect(resolveWeaponShootSfx('gale_smg_wind_blade')).toBe('gale_wind_blade');
      expect(resolveWeaponShootSfx('frag_launcher')).toBe('shoot_launcher');
      expect(resolveWeaponShootSfx('frag_launcher_sub')).toBe('frag_airburst');
      expect(resolveWeaponShootSfx('seed_gun')).toBe('shoot_coop_special');
      expect(resolveWeaponShootSfx('tether_staff')).toBe('shoot_coop_special');
    });

    it('resolves projectile render specs for Batch-1 special projectiles', () => {
      const windBlade = resolveProjectileRenderSpec('gale_smg_wind_blade');
      expect(windBlade.texture).toBe('proj_knight_sword_wave');
      expect(windBlade.tint).toBe(0x2dd4bf);

      const fragSub = resolveProjectileRenderSpec('frag_launcher_sub');
      expect(fragSub.texture).toBe('proj_player_pellet');
      expect(fragSub.tint).toBe(0xf97316);

      const thornWhip = resolveProjectileRenderSpec('thorn_staff');
      expect(thornWhip.texture).toBe('proj_player_poison');
      expect(thornWhip.tint).toBe(0x4ade80);
    });
  });

  describe('2. Enemy Embedded Indicators (Hunter Crossbow stuckArrows 1..4 & Thorn Staff parasiticThorns 1..5)', () => {
    it('renders 1..4 embedded barbed arrows on enemy body and returns clamped count', () => {
      expect(p1aDrawArrows).toBe(drawEnemyEmbeddedArrows);
      const g = makeMockGraphics();
      const baseEnemy: Pick<SimEnemyState, 'id' | 'radius' | 'aimAngle' | 'stuckArrows'> = {
        id: 7,
        radius: 14,
        aimAngle: 0,
        stuckArrows: 0,
      };
      expect(drawEnemyEmbeddedArrows(g as never, 120, 120, baseEnemy, 200, 120, 0.5)).toBe(0);
      expect(g.strokePath).not.toHaveBeenCalled();

      for (const count of [1, 2, 3, 4] as const) {
        const gStep = makeMockGraphics();
        const drawn = drawEnemyEmbeddedArrows(
          gStep as never,
          120,
          120,
          { ...baseEnemy, stuckArrows: count },
          200,
          120,
          0.5,
        );
        expect(drawn).toBe(count);
        // Each arrow draws 5 strokePath segments (dark outline, cyan shaft, white highlight, barbed head, V-fletching)
        expect(gStep.strokePath).toHaveBeenCalledTimes(count * 5);
        expect(gStep.fillCircle).toHaveBeenCalledTimes(count);
      }
    });

    it('renders 1..5 glowing violet-green parasitic thorn buds on enemy body and returns clamped count', () => {
      expect(p1aDrawThorns).toBe(drawEnemyParasiticThorns);
      const g = makeMockGraphics();
      const baseEnemy: Pick<SimEnemyState, 'id' | 'radius' | 'parasiticThorns'> = {
        id: 9,
        radius: 16,
        parasiticThorns: 0,
      };
      expect(drawEnemyParasiticThorns(g as never, 150, 150, baseEnemy, 0.4)).toBe(0);

      for (const count of [1, 2, 3, 4, 5] as const) {
        const gStep = makeMockGraphics();
        const drawn = drawEnemyParasiticThorns(
          gStep as never,
          150,
          150,
          { ...baseEnemy, parasiticThorns: count },
          0.4,
        );
        expect(drawn).toBe(count);
        expect(gStep.strokeCircle).toHaveBeenCalledTimes(2);
        expect(gStep.fillCircle).toHaveBeenCalledTimes(count * 3);
        expect(gStep.strokePath).toHaveBeenCalledTimes(count * 2);
      }

      // Combined enemy indicator helper draws both when present
      const gBoth = makeMockGraphics();
      drawEnemyBatch1Indicators(
        gBoth as never,
        150,
        150,
        { id: 10, radius: 16, aimAngle: 0, stuckArrows: 3, parasiticThorns: 4 },
        220,
        150,
        1.0,
      );
      expect(gBoth.fillCircle).toHaveBeenCalledTimes(3 + 4 * 3);
    });
  });

  describe('3. Room Entities Sync: Seed Gun Life Blossom (r=88px) & Tether Staff Cutting Beams', () => {
    it('renders Seed Gun life_blossom deployable with r=88px toxic spore aura, 8 orbiting motes, and 6 petals', () => {
      expect(p1aDrawBlossom).toBe(drawSeedGunLifeBlossom);
      const g = makeMockGraphics();
      const blossom: Pick<SimSummonState, 'id' | 'x' | 'y' | 'auraRadius'> = {
        id: 0,
        x: 300,
        y: 260,
        auraRadius: 88,
      };
      drawSeedGunLifeBlossom(g as never, blossom, 0);
      // Verify 88px aura circle is filled & stroked
      expect(g.fillCircle).toHaveBeenCalledWith(300, 260, 88);
      expect(g.strokeCircle).toHaveBeenCalledWith(300, 260, 88);
      // 1 aura + 8 motes + 1 base + 6*2 petals + 3 stamen core = 25 fillCircle calls
      expect(g.fillCircle).toHaveBeenCalledTimes(25);
    });

    it('renders Tether Staff cutting plasma/lightning beams and color-coded anchor nodes for all 5 anchor kinds', () => {
      expect(p1aDrawTethers).toBe(drawTetherStaffBeams);
      const g = makeMockGraphics();
      const beams: SimTetherBeamState[] = [
        { id: 1, ownerId: 1, x1: 100, y1: 100, x2: 260, y2: 100, ttlSec: 3.5, targetKind: 'player', targetId: 2 },
        { id: 2, ownerId: 1, x1: 100, y1: 100, x2: 260, y2: 140, ttlSec: 3.5, targetKind: 'summon', targetId: 3 },
        { id: 3, ownerId: 1, x1: 100, y1: 100, x2: 260, y2: 180, ttlSec: 3.5, targetKind: 'prop', targetId: 4 },
        { id: 4, ownerId: 1, x1: 100, y1: 100, x2: 260, y2: 220, ttlSec: 3.5, targetKind: 'enemy', targetId: 5 },
        { id: 5, ownerId: 1, x1: 100, y1: 100, x2: 260, y2: 260, ttlSec: 3.5, targetKind: 'wall', targetId: 0 },
      ];
      const drawn = drawTetherStaffBeams(g as never, beams, 0.5);
      expect(drawn).toBe(5);
      expect(g.strokePath).toHaveBeenCalledTimes(5 * 6);
      expect(g.strokeCircle).toHaveBeenCalledTimes(5 * 2);
    });
  });

  describe('4. All 7 Batch-1 Weapons Procedural VFX Spawners & Transient Overlay Rendering', () => {
    it('spawns and renders all 11 Batch-1 transient procedural VFX shapes and active projectiles', () => {
      expect(p1aSyncBatch1).toBe(syncBatch1WeaponRoomEntities);
      const sceneKey = {};
      const fx = makeMockFx();
      const g = makeMockGraphics();
      const player = makeMockPlayer({
        x: 200,
        y: 200,
        weaponSlots: ['gale_smg', 'hunter_crossbow'],
        activeWeaponSlot: 0,
        fireHoldTimer: 0.6,
      });

      const activeProjectiles: SimProjectileState[] = [
        {
          id: 1,
          ownerId: 1,
          team: 'player',
          weaponId: 'hunter_crossbow',
          x: 240,
          y: 200,
          vx: 500,
          vy: 0,
          angle: 0,
          radius: 5,
          damage: 28,
          ttlSec: 0.5,
          pierceRemaining: 2,
          critChance: 0.25,
          knockback: 100,
          shotFlags: SHOT_FLAG.FINALE_SHOT,
        },
        {
          id: 2,
          ownerId: 1,
          team: 'player',
          weaponId: 'scrap_shotgun',
          x: 230,
          y: 210,
          vx: 420,
          vy: 0,
          angle: 0,
          radius: 4,
          damage: 10,
          ttlSec: 0.2,
          pierceRemaining: 0,
          critChance: 0.1,
          knockback: 80,
          element: 'burn',
          shotFlags: SHOT_FLAG.FINALE_SHOT,
        },
        {
          id: 3,
          ownerId: 1,
          team: 'player',
          weaponId: 'gale_smg_wind_blade',
          x: 260,
          y: 200,
          vx: 560,
          vy: 0,
          angle: 0,
          radius: 14,
          damage: 14,
          ttlSec: 0.4,
          pierceRemaining: 3,
          critChance: 0.1,
          knockback: 90,
        },
        {
          id: 4,
          ownerId: 1,
          team: 'player',
          weaponId: 'frag_launcher',
          x: 320,
          y: 200,
          vx: 300,
          vy: 0,
          angle: 0,
          radius: 8,
          damage: 34,
          ttlSec: 0.6,
          pierceRemaining: 0,
          critChance: 0.1,
          knockback: 140,
          armedForAirburst: true,
        },
        {
          id: 5,
          ownerId: 1,
          team: 'player',
          weaponId: 'frag_launcher_sub',
          x: 340,
          y: 210,
          vx: 200,
          vy: 0,
          angle: 0,
          radius: 6,
          damage: 11,
          ttlSec: 0.2,
          pierceRemaining: 0,
          critChance: 0.1,
          knockback: 60,
        },
      ];

      syncBatch1WeaponRoomEntities(sceneKey, {
        enemies: [],
        projectiles: activeProjectiles,
        summons: [],
        tetherBeams: [
          {
            id: 1,
            ownerId: 1,
            x1: 200,
            y1: 200,
            x2: 340,
            y2: 200,
            ttlSec: 4.0,
            targetKind: 'enemy',
            targetId: 99,
          },
        ],
      });

      // Spawn all 10 Batch-1 weapon VFX triggers (producing 11 transient shape kinds)
      spawnCrossbowBarbedRipVfx(sceneKey, fx as never, 200, 200, [{ x: 310, y: 200 }], 3, 'vi');
      spawnThornStaffWhipVfx(sceneKey, fx as never, 200, 200, 0, true);
      spawnThornBloomVfx(sceneKey, fx as never, 200, 200, [{ x: 320, y: 210 }], 4, 'vi');
      spawnScrapShotgunBlastVfx(sceneKey, fx as never, 200, 200, 0, true);
      spawnScrapShotgunShellEjectVfx(sceneKey, fx as never, 200, 200, 0, 'vi');
      spawnGaleWindBladeVfx(sceneKey, fx as never, 200, 200, 0);
      spawnGaleCycloneVentVfx(sceneKey, fx as never, 200, 200, 96, 'vi');
      spawnFragLauncherAirburstVfx(sceneKey, fx as never, 320, 200, 104, true, 'vi');
      spawnSeedGunHarvestBloomVfx(sceneKey, fx as never, 280, 200, 88, true, 200, 200, 'vi');
      spawnTetherElectromagneticYankVfx(sceneKey, fx as never, 200, 200, 340, 200, 96, 'vi');

      const state = getWeaponV2OverlayState(sceneKey);
      expect(state.shapes).toHaveLength(11);

      updateAndDrawWeaponV2Overlays(
        sceneKey,
        g as never,
        fx as never,
        player,
        [],
        1 / 60,
        0.5,
        'vi',
      );

      expect(g.strokePath).toHaveBeenCalled();
      expect(g.strokeCircle).toHaveBeenCalled();
      expect(g.fillCircle).toHaveBeenCalled();
      expect(fx.spawnFloatingAlert).toHaveBeenCalled();

      // Also verify direct active projectile drawing
      const gProj = makeMockGraphics();
      drawBatch1ActiveProjectiles(gProj as never, activeProjectiles, player, 0.5);
      expect(gProj.strokeCircle).toHaveBeenCalledWith(320, 200, 104);
    });
  });

  describe('5. Snapshot Codec Round-Trip for stuckArrows, parasiticThorns & tetherBeams', () => {
    it('preserves enemy stuckArrows, parasiticThorns, and tetherBeams across quantized network snapshots', () => {
      const sim = new WorldSim(77);
      sim.enemies.push({
        id: 501,
        defId: 'goblin_melee',
        x: 240,
        y: 220,
        vx: 0,
        vy: 0,
        radius: 14,
        hp: 40,
        maxHp: 40,
        shieldArmor: 0,
        maxShieldArmor: 0,
        aiState: 'chase',
        stateTimer: 0,
        attackCooldown: 0,
        telegraphAngle: 0,
        telegraphDurationSec: 0,
        telegraphRadius: 0,
        telegraphLength: 0,
        aimAngle: 0,
        isBoss: false,
        isElite: false,
        eliteModifier: null,
        bossPhase: 1,
        bossBurrowed: false,
        bossTargetX: 0,
        bossTargetY: 0,
        burnTimer: 0,
        chillStacks: 0,
        frozenTimer: 0,
        poisonStacks: 0,
        shockTimer: 0,
        markedTimer: 0,
        superconductTimer: 0,
        rootedTimer: 0,
        stuckArrows: 3,
        parasiticThorns: 4,
      });
      sim.tetherBeams.push({
        id: 88,
        ownerId: sim.player.id,
        x1: 200,
        y1: 200,
        x2: 240,
        y2: 220,
        ttlSec: 3.5,
        targetKind: 'enemy',
        targetId: 501,
      });

      const snap = encodeWorldSnapshot(sim, []);
      const decodedEnemy = snap.enemies.find((e) => e.id === 501);
      expect(decodedEnemy?.stuckArrows).toBe(3);
      expect(decodedEnemy?.parasiticThorns).toBe(4);
      expect(snap.tetherBeams).toHaveLength(1);
      expect(snap.tetherBeams?.[0]?.targetKind).toBe('enemy');
      expect(snap.tetherBeams?.[0]?.targetId).toBe(501);
    });
  });
});
