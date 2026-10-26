import { describe, expect, it } from 'vitest';
import { CHARACTERS, enLocale, i18n, viLocale, WEAPONS, WorldSim } from '../src/index.js';

function collectLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectLeafKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

describe('Phase 7 — i18n Localization & MVP Awards & Armor Break Events', () => {
  it('maintains 100% key parity between vi.json and en.json dictionaries', () => {
    const viKeys = collectLeafKeys(viLocale as unknown as Record<string, unknown>);
    const enKeys = collectLeafKeys(enLocale as unknown as Record<string, unknown>);
    expect(viKeys.length).toBeGreaterThan(80);
    expect(enKeys).toEqual(viKeys);

    // Every character and weapon in shared registry has localized names & descriptions
    for (const charId of Object.keys(CHARACTERS)) {
      expect(viKeys).toContain(`characters.${charId}.name`);
      expect(enKeys).toContain(`characters.${charId}.name`);
    }
    for (const weaponId of Object.keys(WEAPONS)) {
      expect(viKeys).toContain(`weapons.${weaponId}.name`);
      expect(viKeys).toContain(`weapons.${weaponId}.desc`);
      expect(enKeys).toContain(`weapons.${weaponId}.name`);
      expect(enKeys).toContain(`weapons.${weaponId}.desc`);
    }
  });

  it('switches locale dynamically and interpolates parameters accurately', () => {
    i18n.setLocale('vi');
    expect(i18n.getLocale()).toBe('vi');
    expect(i18n.t('menu.playSolo')).toContain('Chơi Đơn');
    expect(i18n.t('modal.victoryTitle', { biome: 'RỪNG MỤC CỔ ĐẠI' })).toBe(
      'CHIẾN THẮNG! CHINH PHỤC RỪNG MỤC CỔ ĐẠI',
    );
    expect(i18n.charName('vanguard', 'Fallback')).toBe('Thiết Vệ');
    expect(i18n.weaponName('rivet_gun', 'Fallback')).toBe('Súng Đinh Tán');
    expect(i18n.biomeName(2)).toBe('Hầm Băng Vĩnh Cửu');
    expect(i18n.roomTypeLabel('hub')).toBe('Doanh Trại');
    expect(i18n.roomTypeLabel('combat')).toBe('Giao Chiến');
    expect(i18n.elementName('burn')).toBe('Hỏa (Cháy)');
    expect(i18n.elementShortName('chill')).toBe('Băng');
    expect(i18n.enemyName('spore_king', 'Fallback')).toBe('Mục Vương Nấm Độc');
    expect(i18n.t('ui.minimap.floorMini', { floor: 1, max: 2, roomType: 'Giao Chiến' })).toBe(
      'T1/2 · Giao Chiến [Tab]',
    );
    expect(
      i18n.t('ui.result.playerRowFormat', {
        dmg: 940,
        taken: 18,
        kills: 34,
        revives: 1,
        elem: 3,
        combo: 2,
      }),
    ).toContain('940');

    i18n.setLocale('en');
    expect(i18n.getLocale()).toBe('en');
    expect(i18n.t('menu.playSolo')).toContain('Solo');
    expect(i18n.t('modal.victoryTitle', { biome: 'ANCIENT ROTWOOD' })).toBe(
      'VICTORY! CONQUERED ANCIENT ROTWOOD',
    );
    expect(i18n.charName('vanguard', 'Fallback')).toBe('Vanguard');
    expect(i18n.weaponName('rivet_gun', 'Fallback')).toBe('Rivet Gun');
    expect(i18n.biomeName(2)).toBe('Frozen Depths');
    expect(i18n.roomTypeLabel('hub')).toBe('Campfire Hub');
    expect(i18n.roomTypeLabel('combat')).toBe('Combat');
    expect(i18n.elementName('burn')).toBe('Fire (Burn)');
    expect(i18n.elementShortName('chill')).toBe('Ice');
    expect(i18n.enemyName('spore_king', 'Fallback')).toBe('Spore King');
    expect(i18n.t('ui.minimap.floorMini', { floor: 1, max: 2, roomType: 'Combat' })).toBe(
      'F1/2 · Combat [Tab]',
    );
    expect(
      i18n.t('ui.result.playerRowFormat', {
        dmg: 940,
        taken: 18,
        kills: 34,
        revives: 1,
        elem: 3,
        combo: 2,
      }),
    ).toContain('DMG: 940');

    // Fallback for unknown key
    expect(i18n.t('nonexistent.deep.key')).toBe('nonexistent.deep.key');

    // Restore default Vietnamese locale
    i18n.setLocale('vi');
  });

  it('computes 4 MVP Awards accurately across 4 Co-op players and handles zero-stat edge cases', () => {
    const sim = new WorldSim(0x7777_0001);
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Cung Thủ P2', 2);
    const p3 = sim.addCoopPlayer(3, 'elementalist', 'Pháp Sư P3', 3);
    const p4 = sim.addCoopPlayer(4, 'druid', 'Hiền Nhân P4', 4);

    // Edge case: all zeros at start of run still returns 4 valid awards
    const initialAwards = sim.computeMvpAwards();
    expect(initialAwards).toHaveLength(4);
    expect(initialAwards.map((a) => a.category)).toEqual([
      'damage',
      'slayer',
      'elemental',
      'medic',
    ]);

    // Populate distinct player achievements
    sim.player.statsDamageDealt = 420;
    p2.statsDamageDealt = 1280; // P2 wins Damage MVP
    p3.statsDamageDealt = 610;
    p4.statsDamageDealt = 310;

    p4.statsRevives = 3; // P4 wins Medic MVP
    p4.statsDamageTaken = 12;

    p3.statsElementalReactions = 9; // P3 wins Elemental MVP
    p3.statsTeamCombos = 4;

    sim.player.statsKills = 28; // P1 wins Slayer MVP
    p2.statsKills = 14;

    const awards = sim.computeMvpAwards();
    const dmgAward = awards.find((a) => a.category === 'damage')!;
    const medicAward = awards.find((a) => a.category === 'medic')!;
    const elemAward = awards.find((a) => a.category === 'elemental')!;
    const slayerAward = awards.find((a) => a.category === 'slayer')!;

    expect(dmgAward.playerSlot).toBe(2);
    expect(dmgAward.value).toBe(1280);

    expect(medicAward.playerSlot).toBe(4);
    expect(medicAward.value).toBe(3);
    expect(medicAward.secondaryValue).toBe(12);

    expect(elemAward.playerSlot).toBe(3);
    expect(elemAward.value).toBe(9);
    expect(elemAward.secondaryValue).toBe(4);

    expect(slayerAward.playerSlot).toBe(1);
    expect(slayerAward.value).toBe(28);
  });

  it('emits armor_broken event when player armor or elite shield armor breaks', () => {
    const sim = new WorldSim(0x7777_0002);
    const startRoom = sim.dungeon.rooms[0]!;
    sim.enterRoom(startRoom.id);
    sim.skipCurrentRoomWaves();
    sim.consumeEvents();

    // 1. Break player armor
    sim.player.godMode = false;
    sim.player.invulnerableTimer = 0;
    sim.player.armor = 2;
    sim.player.hp = 6;

    sim.applyDamageToPlayer(3, 0, 20, 'goblin_shooter', sim.player);

    const eventsAfterPlayerHit = sim.consumeEvents();
    const playerArmorBreak = eventsAfterPlayerHit.find(
      (ev) => ev.kind === 'armor_broken' && ev.targetKind === 'player',
    );
    expect(playerArmorBreak).toBeDefined();
    expect(sim.player.armor).toBe(0);
    expect(sim.player.hp).toBe(5);

    // 2. Break Elite enemy shieldArmor
    const elite = sim.spawnEnemy('goblin_shooter', sim.player.x + 36, sim.player.y, true, 'shield');
    elite.aiState = 'move';
    elite.stateTimer = 0;
    elite.shieldArmor = 3;
    elite.maxShieldArmor = 10;

    sim.applyDamageToEnemy(elite, 5, false, 'none', 0, 10, false, sim.player.id);

    const eventsAfterEliteHit = sim.consumeEvents();
    const eliteArmorBreak = eventsAfterEliteHit.find(
      (ev) => ev.kind === 'armor_broken' && ev.targetKind === 'enemy',
    );
    expect(eliteArmorBreak).toBeDefined();
    expect(elite.shieldArmor).toBe(0);
    expect(sim.player.statsDamageDealt).toBeGreaterThanOrEqual(5);
  });
});
