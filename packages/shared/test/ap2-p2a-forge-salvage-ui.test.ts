import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CORE_WEAPON_MUTATOR_IDS,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  WEAPON_SALVAGE_GOLD,
  WEAPON_SALVAGE_HOLD_SEC,
  WorldSim,
} from '../src/index.js';
import {
  computeWeaponSalvageHudState,
  drawWeaponMutatorEmblem,
  drawWorldWeaponSalvageRing,
  formatDaedalusModalHeader,
  formatMutatorChoiceCardMeta,
  formatWeaponCardSlotTitle,
} from '../../../apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.js';

function createMockGraphics() {
  return {
    fillStyle: vi.fn(),
    fillCircle: vi.fn(),
    fillRect: vi.fn(),
    fillRoundedRect: vi.fn(),
    fillTriangle: vi.fn(),
    fillPath: vi.fn(),
    lineStyle: vi.fn(),
    strokeCircle: vi.fn(),
    strokeRoundedRect: vi.fn(),
    strokePath: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    lineBetween: vi.fn(),
  };
}

describe('AP2 Phase P2A.4 — Daedalus Anvil Modal UI, Salvage Hold Ring & Forge/Cracked-Wall Textures', () => {
  it('formats Daedalus Anvil modal header in Vietnamese and English with active weapon +Lv and mutator count', () => {
    const sim = new WorldSim({
      seed: 9401,
      biome: 1,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.inHub = false;
    sim.player.weaponSlots = ['scrap_shotgun', 'knight_sword'];
    sim.player.activeWeaponSlot = 0;
    sim.player.weaponUpgradeLevels = [2, 0];
    sim.player.weaponMutators = [['mutator_finale_jolt'], []];

    const headerVi = formatDaedalusModalHeader(sim.player, false);
    expect(headerVi.title).toContain('ĐE RÈN CỔ ĐẠI DAEDALUS');
    expect(headerVi.subtitle).toContain('+2');
    expect(headerVi.subtitle).toContain('1/2 Mutator');
    expect(headerVi.upgradeLevel).toBe(2);
    expect(headerVi.attachedCount).toBe(1);

    const headerEn = formatDaedalusModalHeader(sim.player, true);
    expect(headerEn.title).toContain('ANCIENT DAEDALUS ANVIL');
    expect(headerEn.subtitle).toContain('+2');
    expect(headerEn.subtitle).toContain('1/2');
    expect(headerEn.footerHint).toContain('[1] / [2]');
  });

  it('formats all 6 core Weapon Mutator cards with compatibility badges and draws custom vector emblems', () => {
    const g = createMockGraphics();
    for (let i = 0; i < CORE_WEAPON_MUTATOR_IDS.length; i++) {
      const id = CORE_WEAPON_MUTATOR_IDS[i]!;
      const metaVi = formatMutatorChoiceCardMeta(id, i % 2, false);
      const metaEn = formatMutatorChoiceCardMeta(id, i % 2, true);

      expect(metaVi.name.length).toBeGreaterThan(3);
      expect(metaVi.desc.length).toBeGreaterThan(10);
      expect(metaEn.name.length).toBeGreaterThan(3);
      expect(metaEn.desc.length).toBeGreaterThan(10);
      expect(['CLIP / HEAT', 'MELEE COMBO', 'CLIP / HEAT / MELEE']).toContain(
        metaVi.compatibilityBadge,
      );
      expect(metaVi.hotkeyLabel).toBe(`[${(i % 2) + 1}] Chọn`);
      expect(metaEn.hotkeyLabel).toBe(`[${(i % 2) + 1}] Select`);

      drawWeaponMutatorEmblem(g as never, id, 100, 100, 22);
    }
    expect(g.fillCircle).toHaveBeenCalled();
    expect(g.strokeCircle).toHaveBeenCalled();
  });

  it('tracks [X] 0.50s weapon salvage hold progress (0% -> 50% -> 100%) and renders world salvage ring', () => {
    const sim = new WorldSim({
      seed: 9402,
      biome: 2,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.inHub = false;
    sim.worldItems.push({
      id: 777,
      kind: 'weapon',
      weaponId: 'void_reaper',
      rarity: 'legendary',
      x: sim.player.x + 12,
      y: sim.player.y,
    });

    const state0 = computeWeaponSalvageHudState(sim, sim.player, false);
    expect(state0.canSalvage).toBe(true);
    expect(state0.goldValue).toBe(WEAPON_SALVAGE_GOLD.legendary);
    expect(state0.progress).toBe(0);
    expect(state0.percent).toBe(0);
    expect(state0.promptText).toContain(`+${WEAPON_SALVAGE_GOLD.legendary} Vàng`);

    const stateEn = computeWeaponSalvageHudState(sim, sim.player, true);
    expect(stateEn.promptText).toContain(`+${WEAPON_SALVAGE_GOLD.legendary} Gold`);

    // Hold [X] (DROP_WEAPON) for 0.25s (15 ticks = 50% of 0.50s)
    for (let t = 0; t < 15; t++) {
      sim.step({
        seq: t + 1,
        dt: SIM_STEP_SEC,
        moveX: 0,
        moveY: 0,
        aimX: sim.player.x + 40,
        aimY: sim.player.y,
        buttons: INPUT_BUTTON.DROP_WEAPON,
      });
    }

    const state50 = computeWeaponSalvageHudState(sim, sim.player, false);
    expect(state50.canSalvage).toBe(true);
    expect(state50.progress).toBeCloseTo(0.5, 1);
    expect(state50.percent).toBeGreaterThanOrEqual(48);
    expect(state50.percent).toBeLessThanOrEqual(52);

    const g = createMockGraphics();
    drawWorldWeaponSalvageRing(g as never, sim, sim.player, 1.25);
    expect(g.arc).toHaveBeenCalled();

    // Hold [X] for remaining 15 ticks -> weapon is salvaged into +100 Gold
    const goldBefore = sim.player.gold;
    for (let t = 15; t < Math.round(WEAPON_SALVAGE_HOLD_SEC / SIM_STEP_SEC) + 2; t++) {
      sim.step({
        seq: t + 1,
        dt: SIM_STEP_SEC,
        moveX: 0,
        moveY: 0,
        aimX: sim.player.x + 40,
        aimY: sim.player.y,
        buttons: INPUT_BUTTON.DROP_WEAPON,
      });
    }
    expect(sim.player.gold).toBe(goldBefore + WEAPON_SALVAGE_GOLD.legendary);
    expect(computeWeaponSalvageHudState(sim, sim.player, false).canSalvage).toBe(false);
  });

  it('formats weapon card slot titles and verifies forge/cracked-wall textures are baked & wired', () => {
    expect(formatWeaponCardSlotTitle('Súng Trường Lửa', 0, true)).toBe('Súng Trường Lửa');
    expect(formatWeaponCardSlotTitle('Súng Trường Lửa', 2, true)).toBe('Súng Trường Lửa +2');
    expect(formatWeaponCardSlotTitle('Súng Trường Lửa Cổ Đại', 1, false)).toContain('+1');

    const repoRoot = resolve(__dirname, '../../..');
    const bakerPropsSrc = readFileSync(
      resolve(repoRoot, 'apps/client/src/art/texture-baker-props-p1c.ts'),
      'utf8',
    );
    expect(bakerPropsSrc).toContain("'prop_daedalus_anvil'");
    expect(bakerPropsSrc).toContain("'prop_upgrade_anvil'");
    expect(bakerPropsSrc).toContain("'item_blessing_scroll'");
    expect(bakerPropsSrc).toContain("'item_weapon_upgrade'");

    const roomSyncSrc = readFileSync(
      resolve(repoRoot, 'apps/client/src/scenes/game-scene/room-entities-sync.ts'),
      'utf8',
    );
    expect(roomSyncSrc).toContain("'prop_daedalus_anvil'");
    expect(roomSyncSrc).toContain("'prop_upgrade_anvil'");
    expect(roomSyncSrc).toContain("'item_blessing_scroll'");
    expect(roomSyncSrc).toContain("'item_weapon_upgrade'");
  });
});
