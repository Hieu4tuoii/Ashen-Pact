import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  ALL_WEAPON_IDS,
  INPUT_BUTTON,
  WEAPONS,
  WorldSim,
  type SimEvent,
  type SimPlayerState,
} from '@ashen-pact/shared';
import {
  SFX_PRESETS,
  WEAPON_V2_SFX_PRESETS,
  resolveWeaponShootSfx,
  zzfx,
  type SfxId,
} from '../src/audio/zzfx';
import {
  drawBatch2ActiveWeaponOverlays,
  drawBatch2TransientShape,
  getWeaponV2OverlayState,
  handleBatch2WeaponSimEvent,
  syncBatch1WeaponRoomEntities,
  updateAndDrawWeaponV2Overlays,
} from '../src/fx/combat-fx-weapons-v2';
import { AP2_P1B_SCENE_IDS } from '../../../tests/e2e/helpers/visual-scene-ap2-p1b';

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
    spawnExplosionBurst: vi.fn(),
    spawnChainLightningArc: vi.fn(),
    spawnDashDust: vi.fn(),
    spawnPropBreakBurst: vi.fn(),
    spawnShaderNova: vi.fn(),
    spawnShaderSlash: vi.fn(),
    spawnShaderCone: vi.fn(),
    spawnShaderLance: vi.fn(),
    spawnShaderDirectional: vi.fn(),
  };
}

function makeMockScene() {
  return {
    fx: makeMockFx(),
    lighting: {
      spawnTransientLight: vi.fn(),
    },
    camFocusX: 356,
    camFocusY: 270,
  };
}

describe('AP2-P1B.5 — Procedural VFX for 7 Batch-2 Weapons, ArtGallery 18 Weapons & 7 Strip Scenes', () => {
  describe('1. ZzFX Audio Synthesis Presets for 7 Batch-2 Weapons', () => {
    it('registers all 8 Batch-2 weapon ZzFX presets with valid parameters', () => {
      const batch2SfxIds: SfxId[] = [
        'focus_laser_hum',
        'focus_laser_railgun',
        'void_implosion',
        'emerald_boomerang',
        'berserker_guillotine',
        'solar_supernova',
        'magma_geyser',
        'thunder_pillar',
      ];
      const registeredIds = zzfx.getPresetIds();
      for (const id of batch2SfxIds) {
        expect(registeredIds).toContain(id);
        expect(WEAPON_V2_SFX_PRESETS[id]).toBeDefined();
        expect(SFX_PRESETS[id]).toBeDefined();
        expect(SFX_PRESETS[id].volume).toBeGreaterThan(0);
        expect(SFX_PRESETS[id].freq).toBeGreaterThan(0);
        expect(SFX_PRESETS[id].decaySec).toBeGreaterThan(0);
      }
    });

    it('resolves shoot/swing SFX for all 7 Batch-2 weapons', () => {
      expect(resolveWeaponShootSfx('focus_laser')).toBe('shoot_laser');
      expect(resolveWeaponShootSfx('void_staff')).toBe('shoot_staff');
      expect(resolveWeaponShootSfx('emerald_cleaver')).toBe('swing_sword');
      expect(resolveWeaponShootSfx('berserker_axe')).toBe('swing_sword');
      expect(resolveWeaponShootSfx('solar_archon_staff')).toBe('shoot_staff');
      expect(resolveWeaponShootSfx('magma_cannon')).toBe('shoot_launcher');
      expect(resolveWeaponShootSfx('thunder_hammer')).toBe('swing_sword');
    });
  });

  describe('2. Batch-2 SimEvent Chiaroscuro Shader VFX Dispatch & Ground Hazard Routing', () => {
    it('handles all Batch-2 weapon SimEvents, dispatches 1:1 Chiaroscuro shader flipbooks without spammy floating alerts, and renders hollow accents', () => {
      const sim = new WorldSim(42);
      const scene = makeMockScene();
      const g = makeMockGraphics();
      const gGround = makeMockGraphics();
      const playSpy = vi.spyOn(zzfx, 'play');

      const events: SimEvent[] = [
        {
          kind: 'focus_laser_beam',
          playerId: sim.player.id,
          x1: 356,
          y1: 270,
          x2: 488,
          y2: 270,
          angle: 0,
          width: 12,
          heat: 72,
          refractedRays: [
            { x1: 416, y1: 270, x2: 520, y2: 230, angle: -0.35 },
            { x1: 416, y1: 270, x2: 520, y2: 270, angle: 0 },
            { x1: 416, y1: 270, x2: 520, y2: 310, angle: 0.35 },
          ],
        },
        {
          kind: 'focus_laser_railgun',
          playerId: sim.player.id,
          x1: 356,
          y1: 270,
          x2: 876,
          y2: 270,
          angle: 0,
          width: 28,
          damage: 58,
          alertTextVi: 'RAILGUN XẢ ÁP!',
        },
        {
          kind: 'void_implosion',
          playerId: sim.player.id,
          x: 450,
          y: 270,
          radius: 110,
          damage: 70,
          swallowedBullets: 3,
          triggeredByRelease: true,
          alertTextVi: 'HỐ ĐEN SỤP ĐỔ!',
        },
        {
          kind: 'melee_swing',
          playerId: sim.player.id,
          weaponId: 'emerald_cleaver',
          x: 340,
          y: 270,
          angle: 0,
          arcRad: 2.35,
          range: 74,
          bulletsDestroyed: 0,
        },
        {
          kind: 'melee_swing',
          playerId: sim.player.id,
          weaponId: 'berserker_axe',
          x: 340,
          y: 270,
          angle: 0,
          arcRad: 2.35,
          range: 88,
          bulletsDestroyed: 0,
        },
        {
          kind: 'melee_swing',
          playerId: sim.player.id,
          weaponId: 'thunder_hammer',
          x: 340,
          y: 270,
          angle: 0,
          arcRad: 2.35,
          range: 78,
          bulletsDestroyed: 0,
        },
        {
          kind: 'berserker_guillotine_slam',
          playerId: sim.player.id,
          x: 402,
          y: 270,
          x2: 562,
          y2: 270,
          angle: 0,
          length: 160,
          width: 36,
          damage: 52,
          alertTextVi: 'ĐOẠN ĐẦU ĐÀI!',
        },
        {
          kind: 'solar_converge_burst',
          playerId: sim.player.id,
          x: 540,
          y: 266,
          radius: 52,
          damage: 14,
          rayIndex: 0,
        },
        {
          kind: 'solar_supernova',
          playerId: sim.player.id,
          x: 540,
          y: 266,
          radius: 120,
          damage: 68,
          zoneRadius: 96,
          zoneDurationSec: 3.5,
          bulletsCleared: 3,
          alertTextVi: 'SIÊU TÂN TINH HỘI TỤ!',
        },
        {
          kind: 'magma_geyser_eruption',
          playerId: sim.player.id,
          geysers: [
            { x: 380, y: 270, radius: 56, damage: 22 },
            { x: 410, y: 270, radius: 56, damage: 22 },
            { x: 440, y: 270, radius: 56, damage: 22 },
            { x: 470, y: 270, radius: 56, damage: 22 },
          ],
          damage: 22,
          radius: 56,
          alertTextVi: 'VÒI DUNG NHAM PHUN TRÀO!',
        },
        {
          kind: 'thunder_hammer_pillar',
          playerId: sim.player.id,
          x: 420,
          y: 270,
          radius: 110,
          damage: 54,
          strikes: [
            { x: 406, y: 246, radius: 110, damage: 54 },
            { x: 420, y: 270, radius: 110, damage: 54 },
            { x: 406, y: 294, radius: 110, damage: 54 },
          ],
          deflectedCount: 3,
          alertTextVi: 'CỘT LÔI ĐÌNH!',
        },
      ];

      for (const ev of events) {
        const consumed = handleBatch2WeaponSimEvent(scene as never, ev, sim, false, true);
        if (ev.kind === 'melee_swing') {
          expect(consumed).toBe(false);
        } else {
          expect(consumed).toBe(true);
        }
      }

      const state = getWeaponV2OverlayState(scene);
      expect(state.shapes.length).toBeGreaterThanOrEqual(15);

      updateAndDrawWeaponV2Overlays(
        scene,
        g as never,
        scene.fx as never,
        sim.player,
        [],
        1 / 60,
        0.5,
        'vi',
        gGround as never,
      );

      expect(g.strokePath).toHaveBeenCalled();
      expect(gGround.strokeCircle).toHaveBeenCalled();
      expect(g.fillCircle).toHaveBeenCalled();
      expect(playSpy).toHaveBeenCalledWith('emerald_boomerang', 340, 356, 270, 270);
      playSpy.mockRestore();

      expect(scene.fx.spawnShaderLance).toHaveBeenCalled();
      expect(scene.fx.spawnShaderSlash).toHaveBeenCalledWith(
        402,
        270,
        98,
        0,
        'fx_sh_slash_crimson',
        expect.any(Object),
      );
      expect(scene.fx.spawnShaderNova).toHaveBeenCalledWith(450, 270, 110, 'fx_sh_nova_void');
      expect(scene.fx.spawnShaderNova).toHaveBeenCalledWith(402, 270, 76, 'fx_sh_geyser_plume');
      expect(scene.fx.spawnShaderNova).toHaveBeenCalledWith(
        540,
        266,
        52,
        'fx_sh_arcane_sigil',
        expect.objectContaining({ tint: 0xfef08a }),
      );
      expect(scene.fx.spawnShaderNova).toHaveBeenCalledWith(540, 266, 120, 'fx_sh_nova_solar');
      expect(scene.fx.spawnShaderNova).toHaveBeenCalledWith(380, 270, 56, 'fx_sh_geyser_plume');
      expect(scene.fx.spawnShaderNova).toHaveBeenCalledWith(420, 270, 110, 'fx_sh_anvil_storm');
      // Zero spammy mid-combat weapon floating alerts
      expect(scene.fx.spawnFloatingAlert).not.toHaveBeenCalled();
    });

    it('renders active Batch-2 hazards onto groundHazardGraphics (depth: 16, < 0.08 interior fill), 3 orbiting Mini-Suns, Bloodlust aura, and in-flight projectiles', () => {
      const sim = new WorldSim(99);
      const sceneKey = {};
      const g = makeMockGraphics();
      const gGround = makeMockGraphics();

      sim.magmaTrails.push({
        id: 1,
        ownerPlayerId: sim.player.id,
        x1: 356,
        y1: 270,
        x2: 420,
        y2: 270,
        width: 48,
        ttlSec: 3.0,
        maxTtlSec: 3.5,
        tickTimer: 0.5,
        ticksElapsed: 0,
        damage: 10,
      });
      sim.solarFireZones.push({
        id: 2,
        ownerPlayerId: sim.player.id,
        x: 540,
        y: 266,
        radius: 96,
        ttlSec: 3.0,
        maxTtlSec: 3.5,
        tickTimer: 0.5,
        ticksElapsed: 0,
        damage: 12,
      });
      sim.flameFissures.push({
        id: 3,
        ownerPlayerId: sim.player.id,
        x1: 402,
        y1: 270,
        x2: 562,
        y2: 270,
        angle: 0,
        length: 160,
        width: 36,
        ttlSec: 2.2,
        maxTtlSec: 2.5,
        tickTimer: 0.5,
        ticksElapsed: 0,
        damage: 10,
      });
      sim.lightningPillars.push({
        id: 4,
        ownerPlayerId: sim.player.id,
        x: 420,
        y: 270,
        radius: 110,
        ttlSec: 2.5,
        maxTtlSec: 3.0,
        tickTimer: 0.5,
        ticksElapsed: 0,
        damage: 14,
      });

      sim.projectiles.push(
        sim.acquireProjectile({
          id: 101,
          ownerId: sim.player.id,
          team: 'player',
          weaponId: 'void_staff',
          x: 410,
          y: 270,
          vx: 320,
          vy: 0,
          radius: 18,
          damage: 12,
          colorHex: '#A855F7',
          ttlSec: 1.0,
          swallowedBullets: 3,
        }),
        sim.acquireProjectile({
          id: 102,
          ownerId: sim.player.id,
          team: 'player',
          weaponId: 'emerald_cleaver_boomerang',
          x: 450,
          y: 270,
          vx: 0,
          vy: 0,
          radius: 20,
          damage: 32,
          colorHex: '#10B981',
          ttlSec: 1.0,
          boomerangPhase: 'spinning',
        }),
        sim.acquireProjectile({
          id: 103,
          ownerId: sim.player.id,
          team: 'player',
          weaponId: 'magma_cannon',
          x: 430,
          y: 270,
          vx: 420,
          vy: 0,
          radius: 20,
          damage: 38,
          colorHex: '#F97316',
          ttlSec: 1.0,
          }),
        sim.acquireProjectile({
          id: 104,
          ownerId: sim.player.id,
          team: 'player',
          weaponId: 'solar_archon_staff',
          x: 480,
          y: 250,
          vx: 500,
          vy: 0,
          radius: 6,
          damage: 14,
          colorHex: '#FACC15',
          ttlSec: 1.0,
          convergeTargetX: 540,
          convergeTargetY: 266,
        }),
      );

      syncBatch1WeaponRoomEntities(sceneKey, sim);

      const solarPlayer: SimPlayerState = {
        ...sim.player,
        weaponSlots: ['solar_archon_staff', 'berserker_axe'],
        activeWeaponSlot: 0,
        solarOrbitAngle: 0.4,
      };
      drawBatch2ActiveWeaponOverlays(g as never, sim, solarPlayer, 0.5, gGround as never);

      const axePlayer: SimPlayerState = {
        ...sim.player,
        weaponSlots: ['berserker_axe', 'solar_archon_staff'],
        activeWeaponSlot: 0,
        berserkerBloodlustStacks: 4,
      };
      // Fallback when groundG omitted routes to g directly
      drawBatch2ActiveWeaponOverlays(g as never, sim, axePlayer, 0.5);

      expect(g.strokeCircle).toHaveBeenCalledWith(sim.player.x, sim.player.y, 48);
      expect(gGround.fillCircle).toHaveBeenCalledWith(420, 270, 110);
      expect(g.fillCircle).toHaveBeenCalledWith(420, 270, 110);
      for (const [, alpha] of gGround.fillStyle.mock.calls) {
        expect(alpha).toBeLessThanOrEqual(0.08);
      }
      expect(g.strokeCircle).toHaveBeenCalledWith(410, 270, 110);
      expect(g.strokeCircle).toHaveBeenCalledWith(450, 270, 64);
      const gArc = makeMockGraphics();
      expect(
        drawBatch2TransientShape(
          gArc as never,
          {
            kind: 'emerald_cleave_arc',
            x: 340,
            y: 270,
            radius: 88,
            angle: 0,
            color: 0xef4444,
            ttlSec: 0.2,
            maxTtlSec: 0.28,
          },
          0.3,
          0.9,
          0.5,
          0,
        ),
      ).toBe(true);
      expect(gArc.lineStyle).toHaveBeenCalledWith(expect.any(Number), 0xef4444, expect.any(Number));
      expect(gArc.lineStyle).toHaveBeenCalledWith(expect.any(Number), 0xfacc15, expect.any(Number));

      const gHammerArc = makeMockGraphics();
      expect(
        drawBatch2TransientShape(
          gHammerArc as never,
          {
            kind: 'emerald_cleave_arc',
            x: 340,
            y: 270,
            radius: 78,
            angle: 0,
            color: 0x38bdf8,
            ttlSec: 0.2,
            maxTtlSec: 0.28,
          },
          0.3,
          0.9,
          0.5,
          0,
        ),
      ).toBe(true);
      expect(gHammerArc.lineStyle).toHaveBeenCalledWith(expect.any(Number), 0x38bdf8, expect.any(Number));
      expect(gHammerArc.lineStyle).toHaveBeenCalledWith(expect.any(Number), 0xfef08a, expect.any(Number));
    });
  });

  describe('3. ArtGallery 18 Weapons & Zero Purged Weapon References', () => {
    it('defines exactly 18 unique weapons across CLIP_RELOAD, HEAT_VENT, and MELEE_COMBO and renders them in art-gallery-pages.ts', () => {
      expect(ALL_WEAPON_IDS).toHaveLength(18);
      const purged = [
        'iron_revolver',
        'frost_bow',
        'poison_blowgun',
        'homing_wand',
        'venom_fang_dagger',
        'arc_lightning_rifle',
      ];
      for (const pId of purged) {
        expect(ALL_WEAPON_IDS).not.toContain(pId);
        expect(WEAPONS[pId]).toBeUndefined();
      }

      const gallerySource = readFileSync(
        resolve(__dirname, '../src/scenes/art-gallery-pages.ts'),
        'utf8',
      );
      expect(gallerySource).toContain('ALL_WEAPON_IDS');
      expect(gallerySource).toContain('COMBO');
      expect(gallerySource).toContain('NHIỆT');
      expect(gallerySource).toContain('NẠP');
      for (const pId of purged) {
        expect(gallerySource).not.toContain(pId);
      }
    });
  });

  describe('4. Engine 2.6 Strip Scenes Registration & Deterministic Simulation Verification', () => {
    it('exports all 7 ap2-p1b strip scene IDs and verifies deterministic simulation of Berserker Guillotine and Magma Geysers', () => {
      expect(AP2_P1B_SCENE_IDS).toEqual([
        'ap2-wep-laser-railgun',
        'ap2-wep-cleaver-boomerang',
        'ap2-wep-void-implosion',
        'ap2-wep-axe-guillotine',
        'ap2-wep-solar-supernova',
        'ap2-wep-magma-geysers',
        'ap2-wep-hammer-thunder',
      ]);

      // 1. Verify ap2-wep-axe-guillotine 3-hit combo and 96px Guillotine leap + 160px Flame Fissure
      {
        const sim = new WorldSim(1336);
        const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
        sim.enterRoom(room.id);
        sim.skipCurrentRoomWaves();
        sim.enemies.length = 0;
        sim.projectiles.length = 0;
        sim.flameFissures.length = 0;
        Object.assign(sim.player, {
          godMode: true,
          x: 308,
          y: 270,
          aimAngle: 0,
          armor: 0,
          weaponSlots: ['berserker_axe', 'rivet_gun'],
          activeWeaponSlot: 0,
          berserkerBloodlustStacks: 2,
          berserkerBloodlustTimer: 4.0,
          meleeComboStep: 0,
          meleeComboResetTimer: 0,
          fireCooldownTimer: 0,
        });
        for (const [typeId, ex, ey, eliteMod] of [
          ['goblin_shooter', 376, 248, undefined],
          ['wild_boar', 462, 270, 'shield'],
          ['goblin_shaman', 474, 294, undefined],
        ] as const) {
          Object.assign(sim.spawnEnemy(typeId, ex, ey, true, eliteMod), {
            hp: 900,
            maxHp: 900,
            isDummy: false,
            moveSpeed: 0,
            attackCooldownTimer: 99,
            spawnWarmupTimer: 0,
            aiState: 'stunned',
            stateTimer: 8.0,
            stunTimer: 8.0,
          });
        }
        sim.consumeEvents();

        const stepSim = (ticks: number, fireFirstTick = false) => {
          const allEvs: SimEvent[] = [];
          for (let t = 0; t < ticks; t++) {
            sim.step({
              seq: sim.tick + 1,
              moveX: 0,
              moveY: 0,
              aimAngle: 0,
              buttons: fireFirstTick && t === 0 ? INPUT_BUTTON.FIRE : 0,
            });
            allEvs.push(...sim.consumeEvents());
          }
          return allEvs;
        };

        stepSim(2, true);
        stepSim(11);
        stepSim(12);
        stepSim(2, true);
        stepSim(8);
        stepSim(8);
        stepSim(4);
        stepSim(4);
        const apexEvs = stepSim(2, true);
        expect(apexEvs.some((e) => e.kind === 'berserker_guillotine_slam')).toBe(true);
        expect(sim.flameFissures.length).toBe(1);
        expect(sim.player.x - 308).toBe(144);
      }

      // 2. Verify ap2-wep-magma-geysers boulder bulldoze -> Perfect Reload at F5
      {
        const sim = new WorldSim(1336);
        const room = sim.dungeon.rooms.find((r) => r.type === 'combat') ?? sim.dungeon.rooms[0]!;
        sim.enterRoom(room.id);
        sim.skipCurrentRoomWaves();
        sim.enemies.length = 0;
        sim.projectiles.length = 0;
        sim.magmaTrails.length = 0;
        for (let ty = 7; ty <= 9; ty++) {
          for (let tx = 16; tx <= 17; tx++) {
            sim.map.tiles[ty * sim.map.cols + tx] = 'pillar';
          }
        }
        sim.map.rebuildSolidBoxes();
        Object.assign(sim.player, {
          godMode: true,
          x: 356,
          y: 270,
          aimAngle: 0,
          weaponSlots: ['magma_cannon', 'knight_sword'],
          activeWeaponSlot: 0,
          clipMax: 3,
          clipAmmo: 1,
          reloadDuration: 0.5,
          reloadTimer: 0,
          reloadLockout: false,
          fireCooldownTimer: 0,
        });
        const enemy = sim.spawnEnemy('wild_boar', 432, 270, true, 'shield');
        Object.assign(enemy, {
          hp: 900,
          maxHp: 900,
          isDummy: false,
          moveSpeed: 0,
          attackCooldownTimer: 99,
          spawnWarmupTimer: 0,
          aiState: 'stunned',
          stateTimer: 8.0,
          stunTimer: 8.0,
        });
        sim.consumeEvents();

        const stepSim = (ticks: number, btn = 0) => {
          const allEvs: SimEvent[] = [];
          for (let t = 0; t < ticks; t++) {
            sim.step({
              seq: sim.tick + 1,
              moveX: 0,
              moveY: 0,
              aimAngle: 0,
              buttons: t === 0 ? btn : 0,
            });
            allEvs.push(...sim.consumeEvents());
          }
          return allEvs;
        };

        stepSim(2, INPUT_BUTTON.FIRE);
        stepSim(6, 0);
        stepSim(7, 0);
        expect(sim.magmaTrails.length).toBeGreaterThan(0);
        const f5Evs = stepSim(2, INPUT_BUTTON.RELOAD_VENT);
        expect(f5Evs.some((e) => e.kind === 'perfect_reload')).toBe(true);
        expect(f5Evs.some((e) => e.kind === 'magma_geyser_eruption')).toBe(true);
        expect(Math.hypot(enemy.x - 432, enemy.y - 270)).toBeGreaterThanOrEqual(18);
      }
    });
  });
});
