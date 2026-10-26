import { describe, expect, it } from 'vitest';
import {
  type ActionBlessingId,
  type AshenPactId,
  type AshenRelicId,
  type BlessingId,
  type DuoBoonId,
  INPUT_BUTTON,
  NetworkTransport,
  type SkillUpgradeId,
  type WeaponMutatorId,
  WorldSim,
  encodeWorldSnapshot,
  hasPlayerBlessing,
} from '../src/index.js';

describe('AP2 P0A.3 — Per-Player Build State & Instanced Gold', () => {
  it('removes global activeBuffIds and pendingBuffChoices from WorldSim and initializes per-player build state', () => {
    const sim = new WorldSim({ seed: 3001, startInHub: true });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Liệp Ưng P2', 2);

    expect('activeBuffIds' in (sim as unknown as Record<string, unknown>)).toBe(false);
    expect('pendingBuffChoices' in (sim as unknown as Record<string, unknown>)).toBe(false);

    for (const pl of [p1, p2]) {
      expect(pl.blessingIds).toEqual([]);
      expect(pl.weaponMutators).toEqual({ 0: [], 1: [] });
      expect(pl.duoBoonIds).toEqual([]);
      expect(pl.activePactId).toBeNull();
      expect(pl.pactOriginalWeaponId).toBeNull();
      expect(pl.awakenedRelicIds).toEqual([]);
      expect(pl.buffChoices).toEqual([]);
      expect(pl.weaponUpgradeLevels).toEqual({ 0: 0, 1: 0 });
      expect(pl.gold).toBe(0);
    }

    // Mutate build state, then startDungeonRunFromHub -> must reset cleanly for all players
    const sampleBlessing: ActionBlessingId = 'table_tech_rocket';
    const sampleSkill: SkillUpgradeId = 'vanguard_bastion_prism';
    const sampleMutator: WeaponMutatorId = 'mutator_finale_jolt';
    const sampleDuo: DuoBoonId = 'duo_superheated_cyclone';
    const samplePact: AshenPactId = 'pact_soul_chain';
    const sampleRelic: AshenRelicId = 'relic_blood_oath_tether';

    p1.blessingIds.push(sampleBlessing, sampleSkill);
    p1.weaponMutators[0]!.push(sampleMutator);
    p1.duoBoonIds.push(sampleDuo);
    p1.activePactId = samplePact;
    p1.pactOriginalWeaponId = 'knight_sword';
    p1.awakenedRelicIds.push(sampleRelic);
    p1.buffChoices.push('vanguard_charge');
    p1.weaponUpgradeLevels = { 0: 2, 1: 1 };

    expect(hasPlayerBlessing(p1, 'table_tech_rocket')).toBe(true);
    expect(hasPlayerBlessing(p2, 'table_tech_rocket')).toBe(false);

    sim.startDungeonRunFromHub();
    for (const pl of [p1, p2]) {
      expect(pl.blessingIds).toEqual([]);
      expect(pl.weaponMutators).toEqual({ 0: [], 1: [] });
      expect(pl.duoBoonIds).toEqual([]);
      expect(pl.activePactId).toBeNull();
      expect(pl.pactOriginalWeaponId).toBeNull();
      expect(pl.awakenedRelicIds).toEqual([]);
      expect(pl.buffChoices).toEqual([]);
      expect(pl.weaponUpgradeLevels).toEqual({ 0: 0, 1: 0 });
    }
  });

  it('rolls independent buffChoices per player without depleting teammates pool and waits for all players before advancing floor', () => {
    const sim = new WorldSim({
      seed: 3002,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      allowDuplicateCharacters: true,
    });
    const p1 = sim.player; // vanguard
    const p2 = sim.addCoopPlayer(2, 'vanguard', 'Thiết Vệ P2', 2);
    const p3 = sim.addCoopPlayer(3, 'ranger', 'Liệp Ưng P3', 3);

    // Give P1 both Vanguard skill upgrades already; P2 must STILL be able to roll Vanguard skill upgrades!
    p1.blessingIds.push('vanguard_bastion_prism', 'vanguard_charge');

    const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal')!;
    sim.enterRoom(portalRoom.id);
    sim.skipCurrentRoomWaves();
    expect(sim.portalActive).toBe(true);
    expect(sim.enterPortal()).toBe(true);
    expect(sim.runState).toBe('buff_choice');
    expect(sim.currentFloor).toBe(1);

    expect(p1.buffChoices).toHaveLength(3);
    expect(p2.buffChoices).toHaveLength(3);
    expect(p3.buffChoices).toHaveLength(3);

    // P1's choices must not contain P1's already-owned blessings
    expect(p1.buffChoices).not.toContain('vanguard_bastion_prism');
    expect(p1.buffChoices).not.toContain('vanguard_charge');

    // P2 (also vanguard, owning neither) must still be offered at least one vanguard skill upgrade!
    expect(
      p2.buffChoices.includes('vanguard_bastion_prism') ||
        p2.buffChoices.includes('vanguard_charge'),
    ).toBe(true);

    // P3 (ranger) must be offered at least one ranger skill upgrade!
    expect(
      p3.buffChoices.includes('ranger_arrow_volley') ||
        p3.buffChoices.includes('ranger_prey_chain'),
    ).toBe(true);

    // P1 selects a buff -> only P1 gets it, floor does NOT advance yet because P2 & P3 haven't chosen
    const p1Choice = p1.buffChoices[0]!;
    const p2Choice = p2.buffChoices[0]!;
    const p3Choice = p3.buffChoices[0]!;

    expect(sim.selectFloorBuff(p1Choice, p1.id)).toBe(true);
    expect(p1.blessingIds).toContain(p1Choice);
    expect(p1.buffChoices).toEqual([]);
    expect(p2.blessingIds).not.toContain(p1Choice);
    expect(p2.buffChoices).toHaveLength(3);
    expect(sim.runState).toBe('buff_choice');
    expect(sim.currentFloor).toBe(1);

    // P2 selects a buff -> floor still waits for P3
    expect(sim.selectFloorBuff(p2Choice, p2.id)).toBe(true);
    expect(p2.blessingIds).toContain(p2Choice);
    expect(p2.buffChoices).toEqual([]);
    expect(sim.runState).toBe('buff_choice');
    expect(sim.currentFloor).toBe(1);

    // P3 selects a buff -> all players have buffChoices.length === 0, so floor advances to Floor 2!
    expect(sim.selectFloorBuff(p3Choice, p3.id)).toBe(true);
    expect(p3.blessingIds).toContain(p3Choice);
    expect(p3.buffChoices).toEqual([]);
    expect(sim.currentFloor).toBe(2);
    expect(sim.runState).toBe('playing');
  });

  it('applies character skill upgrades strictly per-player rather(not globally across teammates)', () => {
    const sim = new WorldSim({
      seed: 3003,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      allowDuplicateCharacters: true,
    });
    const p1 = sim.player; // vanguard WITH vanguard_bastion_prism
    const p2 = sim.addCoopPlayer(2, 'vanguard', 'Thiết Vệ P2', 2); // vanguard WITHOUT vanguard_bastion_prism

    p1.blessingIds.push('vanguard_bastion_prism');
    p1.x = 250;
    p1.y = 250;
    p2.x = 450;
    p2.y = 250;

    sim.activateCharacterSkill(p1);
    sim.activateCharacterSkill(p2);

    // P1 gets +1.5s duration bonus from vanguard_bastion_prism; P2 gets base duration
    expect(p1.skillActiveTimer).toBeGreaterThan(p2.skillActiveTimer + 1.0);
  });

  it('enforces Instanced Gold on enemy kills, chests, secret rooms, and per-player merchant purchases', () => {
    const sim = new WorldSim({
      seed: 3004,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Liệp Ưng P2', 2);

    // 1. Elite enemy kill drops instanced gold pickups for both P1 and P2
    const elite = sim.spawnEnemy('goblin_shooter', 320, 260, true, 'fast');
    sim.applyDamageToEnemy(elite, 9999, true, 'none', 0, 0, true, p1.id);

    const p1GoldPickups = sim.pickups.filter(
      (pk) => pk.kind === 'gold' && pk.ownerPlayerId === p1.id,
    );
    const p2GoldPickups = sim.pickups.filter(
      (pk) => pk.kind === 'gold' && pk.ownerPlayerId === p2.id,
    );
    expect(p1GoldPickups.length).toBeGreaterThan(0);
    expect(p2GoldPickups.length).toBe(p1GoldPickups.length);

    // P1 standing on P2's gold pickup cannot collect P2's gold
    sim.pickups = sim.pickups.filter((pk) => pk.ownerPlayerId === p2.id);
    const targetPickup = sim.pickups[0]!;
    p1.x = targetPickup.x;
    p1.y = targetPickup.y;
    p2.x = targetPickup.x + 400;
    p2.y = targetPickup.y;
    sim.updatePickups(1 / 60);
    expect(p1.gold).toBe(0);
    expect(sim.pickups.length).toBeGreaterThan(0);

    // Move P2 onto P2's gold pickup -> P2 collects it!
    for (const pk of sim.pickups) {
      pk.x = p2.x;
      pk.y = p2.y;
    }
    sim.updatePickups(1 / 60);
    expect(p2.gold).toBeGreaterThan(0);
    expect(p1.gold).toBe(0);

    // 2. Merchant purchase deducts gold ONLY from the purchasing player
    const merchantRoom = sim.dungeon.rooms.find((r) => r.type === 'merchant')!;
    sim.enterRoom(merchantRoom.id);
    const offer = sim.worldItems.find((it) => it.costGold > 0 && !it.pickedUp)!;
    expect(offer).toBeDefined();

    p1.gold = 200;
    p2.gold = 150;
    const cost = offer.costGold;

    expect(sim.pickupOrBuyWorldItem(offer, p1)).toBe(true);
    expect(p1.gold).toBe(200 - cost);
    expect(p2.gold).toBe(150);
  });

  it('synchronizes per-player build state and gold through encodeWorldSnapshot and NetworkTransport', () => {
    const serverSim = new WorldSim({ seed: 3005, startInHub: false, spawnInitialWave: false });
    const p1 = serverSim.player;
    const p2 = serverSim.addCoopPlayer(2, 'elementalist', 'Lam Hỏa P2', 2);

    p1.gold = 85;
    p1.blessingIds = ['vanguard_bastion_prism', 'table_tech_rocket'];
    p1.weaponMutators = { 0: ['mutator_finale_jolt'], 1: [] };
    p1.duoBoonIds = ['duo_magnetic_bastion_ring'];
    p1.activePactId = 'pact_shattered_glass';
    p1.pactOriginalWeaponId = 'knight_sword';
    p1.awakenedRelicIds = ['relic_black_crystal_heart'];
    p1.buffChoices = ['vanguard_charge', 'dash_tidal_ram', 'reload_frost_nova'];

    p2.gold = 140;
    p2.blessingIds = ['elementalist_vortex', 'bullet_split_bounce'];
    p2.weaponMutators = { 0: ['mutator_prism_splitter'], 1: ['mutator_thermal_meltdown'] };
    p2.duoBoonIds = ['duo_superheated_cyclone'];
    p2.activePactId = 'pact_volatile_arsenal';
    p2.pactOriginalWeaponId = 'apprentice_staff';
    p2.awakenedRelicIds = ['relic_master_forge_seal'];
    p2.buffChoices = ['elementalist_twin_orbit', 'dash_venom_wake', 'bullet_ricochet_boom'];

    const snap = encodeWorldSnapshot(serverSim, []);
    expect('activeBuffIds' in (snap as unknown as Record<string, unknown>)).toBe(false);
    expect('pendingBuffChoices' in (snap as unknown as Record<string, unknown>)).toBe(false);

    const clientTransport = new NetworkTransport({
      seed: 3005,
      startInHub: false,
      localPlayerId: 2,
      localPlayerSlot: 2,
      wifiProfile: 'off',
    });
    clientTransport.receiveSnapshot(snap);

    const clientSim = clientTransport.getSim();
    const clientP2 = clientTransport.getLocalPlayerState();
    const clientP1 = clientSim.getPlayerById(1)!;

    expect(clientP2.id).toBe(2);
    expect(clientP2.gold).toBe(140);
    expect(clientP2.blessingIds).toEqual(['elementalist_vortex', 'bullet_split_bounce']);
    expect(clientP2.weaponMutators).toEqual({
      0: ['mutator_prism_splitter'],
      1: ['mutator_thermal_meltdown'],
    });
    expect(clientP2.duoBoonIds).toEqual(['duo_superheated_cyclone']);
    expect(clientP2.activePactId).toBe('pact_volatile_arsenal');
    expect(clientP2.pactOriginalWeaponId).toBe('apprentice_staff');
    expect(clientP2.awakenedRelicIds).toEqual(['relic_master_forge_seal']);
    expect(clientP2.buffChoices).toEqual([
      'elementalist_twin_orbit',
      'dash_venom_wake',
      'bullet_ricochet_boom',
    ]);

    expect(clientP1.id).toBe(1);
    expect(clientP1.gold).toBe(85);
    expect(clientP1.blessingIds).toEqual(['vanguard_bastion_prism', 'table_tech_rocket']);
    expect(clientP1.weaponMutators).toEqual({ 0: ['mutator_finale_jolt'], 1: [] });
    expect(clientP1.duoBoonIds).toEqual(['duo_magnetic_bastion_ring']);
    expect(clientP1.activePactId).toBe('pact_shattered_glass');
    expect(clientP1.pactOriginalWeaponId).toBe('knight_sword');
    expect(clientP1.awakenedRelicIds).toEqual(['relic_black_crystal_heart']);
    expect(clientP1.buffChoices).toEqual(['vanguard_charge', 'dash_tidal_ram', 'reload_frost_nova']);
  });

  it('auto-resolves simulatedPlayers buffChoices in Solo / Local Bot mode (!coopModeActive) when player selects a floor buff', () => {
    const sim = new WorldSim({
      seed: 3006,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    sim.simulatedPlayers = [
      sim.createPlayerState(2, 2, 'ranger', 300, 300, 'Bot P2'),
      sim.createPlayerState(3, 3, 'elementalist', 320, 300, 'Bot P3'),
      sim.createPlayerState(4, 4, 'engineer', 340, 300, 'Bot P4'),
    ];
    expect(sim.coopModeActive).toBe(false);
    expect(sim.simulatedPlayers).toHaveLength(3);

    const portalRoom = sim.dungeon.rooms.find((r) => r.type === 'portal')!;
    sim.enterRoom(portalRoom.id);
    sim.skipCurrentRoomWaves();
    expect(sim.enterPortal()).toBe(true);
    expect(sim.runState).toBe('buff_choice');
    expect(sim.currentFloor).toBe(1);

    expect(sim.player.buffChoices).toHaveLength(3);
    for (const sp of sim.simulatedPlayers) {
      expect(sp.buffChoices).toHaveLength(3);
    }

    const chosen = sim.player.buffChoices[0]!;
    expect(sim.selectFloorBuff(chosen)).toBe(true);
    expect(sim.player.blessingIds).toContain(chosen);
    for (const sp of sim.simulatedPlayers) {
      expect(sp.blessingIds).toHaveLength(1);
      expect(sp.buffChoices).toEqual([]);
    }
    expect(sim.currentFloor).toBe(2);
    expect(sim.runState).toBe('playing');
  });
});
