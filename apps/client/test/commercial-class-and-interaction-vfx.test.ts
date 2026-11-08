import { SHOT_FLAG, WorldSim, type CharacterId, type SimEvent } from '@ashen-pact/shared';
import { describe, expect, it, vi } from 'vitest';

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

import { processSimEventsImpl } from '../src/scenes/game-scene/sim-events.js';
import {
  renderTelegraphsAndShieldImpl,
  withInterpolatedProjectilesAndPlayer,
} from '../src/scenes/game-scene/telegraphs-and-overlays.js';
import {
  drawEngineerTurretChiaroscuro,
  drawInscribedElementalistZone,
  drawRangerPredatorMarkChiaroscuro,
  drawSacredTreeChiaroscuro,
  drawVanguardRubyPhalanxShield,
  spawnClassSkillCastVfx,
  spawnClassSummonSpawnedVfx,
  spawnEngineerEmpBlastVfx,
  spawnVanguardShieldShockwaveVfx,
} from '../src/fx/combat-fx-classes.js';
import { resolveWeaponMuzzleProfile } from '../src/fx/combat-fx-spawners.js';
import { handleBatch2WeaponSimEvent } from '../src/fx/combat-fx-weapons-p1b.js';
import { getWeaponV2OverlayState } from '../src/fx/combat-fx-weapons-v2.js';

function makeMockGraphics() {
  const fillAlphas: number[] = [];
  const lineColors: number[] = [];
  return {
    fillAlphas,
    lineColors,
    fillStyle: vi.fn((_col: number, a = 1) => {
      fillAlphas.push(a);
    }),
    lineStyle: vi.fn((_w: number, col: number) => {
      lineColors.push(col);
    }),
    fillCircle: vi.fn(),
    strokeCircle: vi.fn(),
    fillRoundedRect: vi.fn(),
    strokeRoundedRect: vi.fn(),
    fillRect: vi.fn(),
    fillTriangle: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fillPath: vi.fn(),
    strokePath: vi.fn(),
    lineBetween: vi.fn(),
  };
}

function makeMockFx() {
  return {
    spawnShaderNova: vi.fn(),
    spawnShaderDirectional: vi.fn(),
    spawnShaderSlash: vi.fn(),
    spawnShaderCone: vi.fn(),
    spawnShaderLance: vi.fn(),
    spawnMuzzleFlashAndCasing: vi.fn(),
    spawnMeleeSlash: vi.fn(),
    spawnHitSparks: vi.fn(),
    spawnDamagePopup: vi.fn(),
    spawnFloatingAlert: vi.fn(),
    spawnFloorDecal: vi.fn(),
    spawnChainLightningArc: vi.fn(),
    spawnExplosionBurst: vi.fn(),
    spawnEnemyDeathBurst: vi.fn(),
    spawnPropBreakBurst: vi.fn(),
    spawnStatusBurst: vi.fn(),
    spawnElementalReactionFx: vi.fn(),
    spawnChestOpenBurst: vi.fn(),
    spawnDashDust: vi.fn(),
    spawnDashAfterimage: vi.fn(),
    spawnGrassRustle: vi.fn(),
    addTrauma: vi.fn(),
    triggerHitStop: vi.fn(),
  };
}

describe('Commercial-Grade Class Skills, Summons & Dramatic World/Boss Interaction VFX', () => {
  it('dispatches 5 completely distinct Chiaroscuro shader morphologies across all 5 CharacterIds on skill_cast', () => {
    const characters: CharacterId[] = ['vanguard', 'ranger', 'elementalist', 'druid', 'engineer'];
    const observedKeys = new Set<string>();

    for (const characterId of characters) {
      const fx = makeMockFx();
      const lighting = { spawnTransientLight: vi.fn() };
      spawnClassSkillCastVfx({ lighting }, fx as never, characterId, 320, 240, 0.5, 'burn', false);

      const dirKey = fx.spawnShaderDirectional.mock.calls[0]?.[4] as string | undefined;
      const novaKey = fx.spawnShaderNova.mock.calls[0]?.[3] as string | undefined;
      const chosenKey = dirKey ?? novaKey;
      expect(chosenKey).toBeDefined();
      observedKeys.add(chosenKey!);
      expect(lighting.spawnTransientLight).toHaveBeenCalledTimes(1);
    }

    expect(observedKeys.size).toBe(5);
    expect([...observedKeys].sort()).toEqual([
      'fx_sh_aegis_crest',
      'fx_sh_anvil_storm',
      'fx_sh_arcane_sigil',
      'fx_sh_bloom_briar',
      'fx_sh_falcon_sonic',
    ]);
  });

  it('tints Elementalist arcane sigil distinctly across burn, chill, and shock skill casts', () => {
    const tints = new Set<number>();
    for (const el of ['burn', 'chill', 'shock'] as const) {
      const fx = makeMockFx();
      spawnClassSkillCastVfx({}, fx as never, 'elementalist', 300, 220, 0, el, false);
      const opts = fx.spawnShaderNova.mock.calls[0]?.[4] as { tint?: number } | undefined;
      expect(fx.spawnShaderNova).toHaveBeenCalledWith(
        300,
        220,
        expect.any(Number),
        'fx_sh_arcane_sigil',
        expect.objectContaining({ tint: expect.any(Number) }),
      );
      tints.add(opts!.tint!);
    }
    expect(tints.size).toBe(3);
  });

  it('spawns bespoke morphologies for Vanguard shield_shockwave, Druid/Engineer summons, and Engineer EMP blast', () => {
    const fx = makeMockFx();
    const lighting = { spawnTransientLight: vi.fn() };

    spawnVanguardShieldShockwaveVfx({ lighting }, fx as never, 320, 240, 0.25, 4);
    expect(fx.spawnShaderDirectional).toHaveBeenCalledWith(
      320,
      240,
      expect.any(Number),
      0.25,
      'fx_sh_aegis_crest',
      expect.any(Object),
    );
    expect(fx.spawnShaderCone).toHaveBeenCalledWith(320, 240, expect.any(Number), 0.25);
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(320, 240, expect.any(Number), 'fx_sh_shrapnel_corona');

    fx.spawnShaderNova.mockClear();
    spawnClassSummonSpawnedVfx({ lighting }, fx as never, 'sacred_tree', 400, 260);
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(400, 260, expect.any(Number), 'fx_sh_bloom_briar');

    fx.spawnShaderNova.mockClear();
    spawnClassSummonSpawnedVfx({ lighting }, fx as never, 'tesla_turret', 440, 260);
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(
      440,
      260,
      expect.any(Number),
      'fx_sh_anvil_storm',
      expect.any(Object),
    );

    fx.spawnShaderNova.mockClear();
    spawnEngineerEmpBlastVfx({ lighting }, fx as never, 440, 260, 120);
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(440, 260, 120, 'fx_sh_anvil_storm');
    expect(fx.spawnChainLightningArc.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('wires weaponId muzzle profiles, charged crossbow sonic wake, class skills, bespoke prop explosions, and boss/world drama into processSimEventsImpl', () => {
    const sim = new WorldSim(101);
    sim.player.characterId = 'ranger';
    sim.player.aimAngle = 0.35;

    const proj = sim.acquireProjectile({
      id: 777,
      ownerId: sim.player.id,
      team: 'player',
      weaponId: 'hunter_crossbow',
      x: 310,
      y: 250,
      vx: 600,
      vy: 0,
      radius: 6,
      damage: 45,
      colorHex: '#38BDF8',
      ttlSec: 1.0,
      pierceRemaining: 3,
      shotFlags: SHOT_FLAG.FINALE_SHOT,
    });
    sim.projectiles.push(proj);

    const fx = makeMockFx();
    const mockScene = {
      transport: { getSim: () => sim },
      fx,
      lighting: { spawnTransientLight: vi.fn() },
      playerRig: {
        triggerRecoil: vi.fn(),
        triggerMeleeSwing: vi.fn(),
        triggerCastPose: vi.fn(),
        triggerHitFlash: vi.fn(),
        getFacingSign: () => 1,
      },
      coopPlayerRigs: new Map(),
      simPlayerRigs: new Map(),
      enemyRigs: new Map(),
      camFocusX: 320,
      camFocusY: 240,
      crosshairPulse: 0,
      hudBannerTimer: 0,
      hudBannerTextStr: '',
      triggerRoomClearedBanner: vi.fn(),
      triggerIrisTransition: vi.fn(),
      triggerPlayerHitDirectionIndicator: vi.fn(),
    };

    const events: SimEvent[] = [
      {
        kind: 'projectile_spawned',
        projectileId: 777,
        weaponId: 'hunter_crossbow',
        team: 'player',
        x: 310,
        y: 250,
        angle: 0.35,
      },
      {
        kind: 'skill_cast',
        playerId: sim.player.id,
        skillId: 'predator_mark',
        x: 310,
        y: 250,
        angle: 0.35,
      },
      {
        kind: 'shield_shockwave',
        playerId: sim.player.id,
        x: 320,
        y: 250,
        angle: 0.35,
        storedBullets: 3,
        damage: 60,
      },
      {
        kind: 'summon_spawned',
        summonId: 801,
        summonKind: 'sacred_tree',
        ownerPlayerId: sim.player.id,
        x: 360,
        y: 250,
      },
      {
        kind: 'emp_blast',
        x: 400,
        y: 250,
        radius: 110,
        bulletsCleared: 8,
      },
      {
        kind: 'explosion',
        x: 440,
        y: 250,
        radius: 88,
        damage: 45,
        sourceDefId: 'explosive_barrel',
      },
      {
        kind: 'explosion',
        x: 480,
        y: 250,
        radius: 72,
        damage: 32,
        sourceDefId: 'caustic_spore_pod',
      },
      {
        kind: 'armor_broken',
        targetId: 901,
        targetKind: 'enemy',
        x: 500,
        y: 250,
      } as SimEvent,
      {
        kind: 'shrine_blessing',
        x: 520,
        y: 250,
        rewardTextVi: '+15% Tốc Đánh',
      },
      {
        kind: 'player_revived',
        playerId: sim.player.id,
        reviverId: 2,
        x: 540,
        y: 250,
      } as SimEvent,
      {
        kind: 'boss_phase_changed',
        enemyId: 999,
        phase: 2,
        x: 560,
        y: 250,
      },
      {
        kind: 'boss_enraged',
        enemyId: 999,
        enrageLevel: 1,
        x: 580,
        y: 250,
      } as SimEvent,
    ];

    processSimEventsImpl.call(mockScene as never, events);

    // 1. weaponId forwarded to spawnMuzzleFlashAndCasing so crossbows/staves never drop brass casings
    expect(fx.spawnMuzzleFlashAndCasing).toHaveBeenCalledWith(
      310,
      250,
      0.35,
      false,
      false,
      'hunter_crossbow',
    );
    // 2. Charged crossbow sonic wake + Ranger falcon skill + Vanguard shield shockwave + armor_broken crest
    expect(fx.spawnShaderDirectional).toHaveBeenCalledWith(
      310,
      250,
      expect.any(Number),
      0.35,
      'fx_sh_falcon_sonic',
      expect.any(Object),
    );
    expect(fx.spawnShaderDirectional).toHaveBeenCalledWith(
      320,
      250,
      expect.any(Number),
      0.35,
      'fx_sh_aegis_crest',
      expect.any(Object),
    );
    expect(fx.spawnShaderDirectional).toHaveBeenCalledWith(
      500,
      250,
      expect.any(Number),
      expect.any(Number),
      'fx_sh_aegis_crest',
      expect.any(Object),
    );

    // 3. Bespoke radial morphologies for summons, EMP, barrel, spore pod, shrine, revive, boss phase/enrage
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(360, 250, expect.any(Number), 'fx_sh_bloom_briar');
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(400, 250, 110, 'fx_sh_anvil_storm');
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(440, 250, 88, 'fx_sh_shrapnel_corona');
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(480, 250, 72, 'fx_sh_spore_cloud');
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(
      520,
      250,
      expect.any(Number),
      'fx_sh_arcane_sigil',
      expect.any(Object),
    );
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(
      540,
      250,
      expect.any(Number),
      'fx_sh_bloom_briar',
      expect.any(Object),
    );
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(
      560,
      250,
      expect.any(Number),
      'fx_sh_arcane_sigil',
      expect.any(Object),
    );
    expect(fx.spawnShaderNova).toHaveBeenCalledWith(580, 250, expect.any(Number), 'fx_sh_geyser_plume');
  });

  it('renders Chiaroscuro active class world overlays with <= 0.06 floor fill alpha and #141019 ink outlines', () => {
    const floorG = makeMockGraphics();
    const g = makeMockGraphics();

    drawVanguardRubyPhalanxShield(g as never, 300, 240, 0.2, false, 3, 1.5);
    drawInscribedElementalistZone(
      floorG as never,
      g as never,
      {
        id: 1,
        ownerPlayerId: 1,
        x: 360,
        y: 240,
        radius: 84,
        element: 'burn',
        vortex: true,
        ttlSec: 3.0,
        maxTtlSec: 4.0,
        tickTimer: 0.2,
        damagePerTick: 12,
      } as never,
      60,
    );
    drawSacredTreeChiaroscuro(
      floorG as never,
      g as never,
      {
        id: 2,
        kind: 'sacred_tree',
        ownerPlayerId: 1,
        x: 440,
        y: 240,
        radius: 18,
        auraRadius: 96,
        hp: 100,
        maxHp: 100,
        ttlSec: 6.0,
        maxTtlSec: 8.0,
        tickTimer: 0.3,
        charge: 0,
      } as never,
      60,
    );
    drawEngineerTurretChiaroscuro(
      floorG as never,
      g as never,
      {
        id: 3,
        kind: 'tesla_turret',
        ownerPlayerId: 1,
        x: 520,
        y: 240,
        radius: 16,
        auraRadius: 110,
        hp: 80,
        maxHp: 80,
        ttlSec: 6.0,
        maxTtlSec: 8.0,
        tickTimer: 0.2,
        charge: 75,
      } as never,
      1200,
    );
    drawRangerPredatorMarkChiaroscuro(g as never, 560, 200, 60);

    expect(floorG.fillAlphas.length).toBeGreaterThan(0);
    expect(Math.max(...floorG.fillAlphas)).toBeLessThanOrEqual(0.06);
    expect(g.lineColors).toContain(0x141019);
    expect(floorG.lineColors).toContain(0x141019);
  });

  it('freezes class world overlay animation phases deterministically across differing sim.tick values when visualFreeze is active', () => {
    const sim = new WorldSim(202);
    sim.inHub = false;
    sim.player.characterId = 'vanguard';
    sim.player.skillActiveTimer = 2.0;
    sim.player.shieldStoredBullets = 2;
    sim.skillZones.push({
      id: 11,
      ownerPlayerId: sim.player.id,
      x: 340,
      y: 240,
      radius: 80,
      element: 'shock',
      vortex: true,
      ttlSec: 3,
      maxTtlSec: 4,
      tickTimer: 0.2,
      damagePerTick: 10,
    });
    sim.summons.push(
      {
        id: 21,
        kind: 'sacred_tree',
        ownerPlayerId: sim.player.id,
        x: 420,
        y: 240,
        radius: 18,
        auraRadius: 96,
        hp: 100,
        maxHp: 100,
        ttlSec: 5,
        maxTtlSec: 8,
        tickTimer: 0.2,
        charge: 0,
      },
      {
        id: 22,
        kind: 'tesla_turret',
        ownerPlayerId: sim.player.id,
        x: 500,
        y: 240,
        radius: 16,
        auraRadius: 110,
        hp: 80,
        maxHp: 80,
        ttlSec: 5,
        maxTtlSec: 8,
        tickTimer: 0.2,
        charge: 60,
      },
    );

    const captureAtTick = (tick: number, wallClockMs: number) => {
      sim.tick = tick;
      const g = {
        ...makeMockGraphics(),
        clear: vi.fn(),
        fillEllipse: vi.fn(),
        strokeEllipse: vi.fn(),
      };
      const floorG = {
        ...makeMockGraphics(),
        clear: vi.fn(),
        fillEllipse: vi.fn(),
        strokeEllipse: vi.fn(),
      };
      const scene = {
        visualFreeze: true,
        transport: {
          getSim: () => sim,
          getInterpolatedSimPlayerPos: (pl: { x: number; y: number }) => ({ x: pl.x, y: pl.y }),
          getInterpolatedEnemyPos: (e: { x: number; y: number }) => ({ x: e.x, y: e.y }),
        },
        telegraphGraphics: g,
        groundHazardGraphics: floorG,
        cameras: { main: { worldView: { x: 0, y: 0, width: 800, height: 600 } } },
        fx: { bossKillFlashTimer: 0 },
        time: { now: wallClockMs },
        entityPosScratch: { x: 0, y: 0 },
        camFocusX: 320,
        camFocusY: 240,
        pauseModalOpen: false,
        coopMode: 'solo',
        drawEnemyHealthAndStatusBar: vi.fn(),
      };
      renderTelegraphsAndShieldImpl.call(scene as never, sim.player.x, sim.player.y);
      return {
        gLines: g.lineTo.mock.calls,
        floorCircles: floorG.fillCircle.mock.calls,
        floorLines: floorG.lineTo.mock.calls,
      };
    };

    const snapA = captureAtTick(45, 1111);
    const snapB = captureAtTick(187, 9876);
    expect(snapA.gLines.length).toBeGreaterThan(0);
    expect(snapA.floorLines.length).toBeGreaterThan(0);
    expect(snapA).toEqual(snapB);
  });

  it('routes tesla_turret_self_destruct explosion to fx_sh_anvil_storm with shock sparks instead of burn shrapnel', () => {
    const sim = new WorldSim(303);
    const fx = makeMockFx();
    const mockScene = {
      transport: { getSim: () => sim },
      fx,
      lighting: { spawnTransientLight: vi.fn() },
      coopPlayerRigs: new Map(),
      simPlayerRigs: new Map(),
      enemyRigs: new Map(),
      camFocusX: 320,
      camFocusY: 240,
    };

    processSimEventsImpl.call(mockScene as never, [
      {
        kind: 'explosion',
        x: 410,
        y: 260,
        radius: 105,
        damage: 80,
        sourceDefId: 'tesla_turret_self_destruct',
      },
    ]);

    expect(fx.spawnShaderNova).toHaveBeenCalledWith(410, 260, 105, 'fx_sh_anvil_storm');
    expect(fx.spawnShaderNova).not.toHaveBeenCalledWith(410, 260, 105, 'fx_sh_shrapnel_corona');
    expect(fx.spawnHitSparks).toHaveBeenCalledWith(
      410,
      260,
      0,
      expect.objectContaining({ element: 'shock' }),
    );
  });

  it('resolves Co-op teammate P1B melee_swing combo step from ev.playerId and aligns crossbow/apprentice muzzle tints', () => {
    const sim = new WorldSim(404);
    sim.player.meleeComboStep = 1; // Local P1 is mid-combo (not finisher)
    const teammate = { ...sim.player, id: 2, meleeComboStep: 0 }; // Teammate P2 just wrapped 3rd-hit finisher -> 0
    vi.spyOn(sim, 'getAllPlayers').mockReturnValue([sim.player, teammate]);

    const sceneKey = { camFocusX: 320, camFocusY: 240 };
    handleBatch2WeaponSimEvent(
      sceneKey,
      {
        kind: 'melee_swing',
        playerId: 2,
        weaponId: 'emerald_cleaver',
        x: 360,
        y: 240,
        angle: 0.5,
        arcRad: 1.5,
        range: 74,
        bulletsDestroyed: 0,
      },
      sim,
      false,
      false,
    );

    const state = getWeaponV2OverlayState(sceneKey);
    expect(state.shapes[state.shapes.length - 1]?.count).toBe(0);

    expect(resolveWeaponMuzzleProfile('apprentice_staff').muzzleTint).toBe(0xfdba74);
    expect(resolveWeaponMuzzleProfile('hunter_crossbow').muzzleTint).toBe(0xbae6fd);
  });

  it('temporarily aligns sim.projectiles and sim.player to interpolated coordinates during overlay passes and restores raw sim coordinates afterward', () => {
    const sim = new WorldSim(505);
    sim.player.x = 300;
    sim.player.y = 240;
    sim.projectiles.push({
      id: 77,
      team: 'player',
      weaponId: 'void_anchor_disc',
      x: 400,
      y: 250,
      vx: 180,
      vy: 0,
      radius: 8,
      damage: 20,
      ttl: 1.0,
      pierceCount: 0,
      bounceCount: 0,
      homingStrength: 0,
      element: 'none',
    } as never);

    let observedPlayerX = 0;
    let observedProjX = 0;
    const mockScene = {
      entityPosScratch: { x: 0, y: 0 },
      transport: {
        getSim: () => sim,
        getInterpolatedProjectilePos: (b: { x: number; y: number }, out: { x: number; y: number }) => {
          out.x = b.x + 12.5;
          out.y = b.y - 4.0;
          return out;
        },
      },
    };

    withInterpolatedProjectilesAndPlayer(mockScene as never, sim, 308.5, 242.0, () => {
      observedPlayerX = sim.player.x;
      observedProjX = sim.projectiles[0]!.x;
    });

    expect(observedPlayerX).toBeCloseTo(308.5, 4);
    expect(observedProjX).toBeCloseTo(412.5, 4);
    // Raw simulation state is restored immediately after the overlay pass
    expect(sim.player.x).toBe(300);
    expect(sim.projectiles[0]!.x).toBe(400);
  });
});
