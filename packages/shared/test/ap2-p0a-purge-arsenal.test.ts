import { describe, expect, it } from 'vitest';
import {
  ALL_WEAPON_IDS,
  CHARACTERS,
  type CharacterId,
  FLOOR_BUFFS,
  FLOOR_BUFF_LIST,
  PHASE1_SAMPLE_WEAPONS,
  WEAPONS,
  WorldSim,
  i18n,
} from '../src/index.js';

const EXPECTED_18_WEAPONS = [
  'knight_sword',
  'hunter_crossbow',
  'apprentice_staff',
  'thorn_staff',
  'rivet_gun',
  'scrap_shotgun',
  'gale_smg',
  'frag_launcher',
  'tesla_carbine',
  'seed_gun',
  'tether_staff',
  'focus_laser',
  'emerald_cleaver',
  'void_staff',
  'berserker_axe',
  'solar_archon_staff',
  'magma_cannon',
  'thunder_hammer',
] as const;

const PURGED_6_CLONE_WEAPONS = [
  'rusty_pistol',
  'dual_pistols',
  'venom_smg',
  'frost_bow',
  'frost_scepter',
  'dragon_breath_shotgun',
] as const;

const PURGED_6_STAT_STICK_BUFFS = [
  'vitality_surge',
  'iron_bastion',
  'arcane_wellspring',
  'eagle_precision',
  'gale_reflex',
  'ricochet_mastery',
] as const;

describe('AP2 P0A.2 — Purge 6 Clone Weapons, 6 Stat-Sticks & Starter Weapon Slot Migration', () => {
  it('retains exactly 18 unique weapons in WEAPONS and ALL_WEAPON_IDS and purges the 6 clone weapons', () => {
    expect(ALL_WEAPON_IDS).toHaveLength(18);
    expect(Object.keys(WEAPONS)).toHaveLength(18);
    expect([...ALL_WEAPON_IDS].sort()).toEqual([...EXPECTED_18_WEAPONS].sort());

    for (const purgedId of PURGED_6_CLONE_WEAPONS) {
      expect(ALL_WEAPON_IDS).not.toContain(purgedId);
      expect(WEAPONS[purgedId]).toBeUndefined();
    }

    expect(PHASE1_SAMPLE_WEAPONS).toEqual(['knight_sword', 'rivet_gun']);
  });

  it('purges the 6 flat stat-stick buffs and renames vanguard_bastion_prism and elementalist_twin_orbit', () => {
    const buffIds = FLOOR_BUFF_LIST.map((b) => b.id as string);

    for (const statStickId of PURGED_6_STAT_STICK_BUFFS) {
      expect(buffIds).not.toContain(statStickId);
      expect((FLOOR_BUFFS as Record<string, unknown>)[statStickId]).toBeUndefined();
    }

    expect(buffIds).not.toContain('vanguard_fortress');
    expect(buffIds).not.toContain('elementalist_dual');
    expect(buffIds).toContain('vanguard_bastion_prism');
    expect(buffIds).toContain('elementalist_twin_orbit');

    expect(FLOOR_BUFFS.vanguard_bastion_prism.nameVi).toContain('Pháo Đài Phản Xạ');
    expect(FLOOR_BUFFS.elementalist_twin_orbit.nameVi).toContain('Song Tinh Cắt Không Gian');

    const vanguardUpgradeIds = CHARACTERS.vanguard.skill.upgrades.map((u) => u.id);
    expect(vanguardUpgradeIds).toContain('vanguard_bastion_prism');
    expect(vanguardUpgradeIds).not.toContain('vanguard_fortress');

    const elementalistUpgradeIds = CHARACTERS.elementalist.skill.upgrades.map((u) => u.id);
    expect(elementalistUpgradeIds).toContain('elementalist_twin_orbit');
    expect(elementalistUpgradeIds).not.toContain('elementalist_dual');

    i18n.setLocale('vi');
    for (const purgedWep of PURGED_6_CLONE_WEAPONS) {
      expect(i18n.weaponName(purgedWep, 'Fallback')).toBe('Fallback');
    }
    for (const keptWep of EXPECTED_18_WEAPONS) {
      expect(i18n.weaponName(keptWep, 'Fallback')).not.toBe('Fallback');
    }
    expect(i18n.getBuffText('vanguard_bastion_prism').name).toContain('Pháo Đài Phản Xạ');
    expect(i18n.getBuffText('elementalist_twin_orbit').name).toContain('Song Tinh Cắt Không Gian');
    i18n.setLocale('en');
    expect(i18n.getBuffText('vanguard_bastion_prism').name).toContain('Bastion Prism');
    expect(i18n.getBuffText('elementalist_twin_orbit').name).toContain('Twin Orbit');
    i18n.setLocale('vi');
  });

  it('initializes player weaponSlots with exactly 1 starter weapon in both createPlayerState and applyCharacterToPlayerState', () => {
    const sim = new WorldSim(12345);
    expect(sim.player.weaponSlots).toEqual([CHARACTERS[sim.player.characterId].starterWeaponId]);
    expect(sim.player.weaponSlots).toHaveLength(1);

    const allCharIds: CharacterId[] = ['vanguard', 'ranger', 'elementalist', 'druid', 'engineer'];
    for (const cid of allCharIds) {
      sim.selectCharacter(sim.player.id, cid, true);
      expect(sim.player.weaponSlots).toEqual([CHARACTERS[cid].starterWeaponId]);
      expect(sim.player.weaponSlots).toHaveLength(1);
    }

    const p2 = sim.addCoopPlayer(2, 'ranger', 'P2');
    expect(p2.weaponSlots).toEqual([CHARACTERS.ranger.starterWeaponId]);
    expect(p2.weaponSlots).toHaveLength(1);

    sim.enterHub();
    const rackWeaponItems = sim.worldItems.filter((item) => item.isHubRackItem && item.kind === 'weapon');
    expect(rackWeaponItems.length).toBeGreaterThanOrEqual(4);
    for (const item of rackWeaponItems) {
      expect(item.weaponId).toBeDefined();
      expect(ALL_WEAPON_IDS).toContain(item.weaponId);
      expect(PURGED_6_CLONE_WEAPONS).not.toContain(item.weaponId as (typeof PURGED_6_CLONE_WEAPONS)[number]);
    }
  });
});
