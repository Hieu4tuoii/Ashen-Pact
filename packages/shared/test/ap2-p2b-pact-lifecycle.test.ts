import { describe, expect, it } from 'vitest';
import {
  ALL_ASHEN_PACT_IDS,
  ALL_ASHEN_RELIC_IDS,
  ASHEN_PACTS,
  ASHEN_RELICS,
  LocalTransport,
  NetworkTransport,
  PACT_TO_RELIC_ID,
  RELIC_TO_PACT_ID,
  WorldSim,
  encodeWorldSnapshot,
  scaleRelicDamage,
} from '../src/index.js';

describe('AP2 Phase P2B.1 — Ashen Pact Altar Lifecycle (1 Altar / Biome) & Boss Purification', () => {
  it('defines 6 Ashen Pacts and 6 Awakened Relics with 1-to-1 mapping and floor scaling', () => {
    expect(ALL_ASHEN_PACT_IDS).toEqual([
      'pact_soul_chain',
      'pact_shattered_glass',
      'pact_searing_trigger',
      'pact_volatile_arsenal',
      'pact_ashen_hunted',
      'pact_ricochet_vow',
    ]);
    expect(ALL_ASHEN_RELIC_IDS).toEqual([
      'relic_blood_oath_tether',
      'relic_black_crystal_heart',
      'relic_perpetual_core',
      'relic_master_forge_seal',
      'relic_executioner_scythe',
      'relic_ancient_geometry_eye',
    ]);

    for (const pactId of ALL_ASHEN_PACT_IDS) {
      const pactDef = ASHEN_PACTS[pactId];
      expect(pactDef).toBeDefined();
      expect(pactDef.id).toBe(pactId);
      expect(pactDef.nameVi.length).toBeGreaterThan(3);
      expect(pactDef.nameEn.length).toBeGreaterThan(3);
      expect(pactDef.curseVi.length).toBeGreaterThan(10);
      expect(pactDef.curseEn.length).toBeGreaterThan(10);

      const relicId = PACT_TO_RELIC_ID[pactId];
      expect(relicId).toBeDefined();
      expect(RELIC_TO_PACT_ID[relicId]).toBe(pactId);

      const relicDef = ASHEN_RELICS[relicId];
      expect(relicDef).toBeDefined();
      expect(relicDef.id).toBe(relicId);
      expect(relicDef.pactId).toBe(pactId);
      expect(relicDef.nameVi.length).toBeGreaterThan(3);
      expect(relicDef.nameEn.length).toBeGreaterThan(3);
      expect(relicDef.descVi.length).toBeGreaterThan(10);
      expect(relicDef.descEn.length).toBeGreaterThan(10);
    }

    expect(scaleRelicDamage(20, 1)).toBe(20);
    expect(scaleRelicDamage(20, 2)).toBe(Math.round(20 * 1.22));
    expect(scaleRelicDamage(45, 6)).toBe(Math.round(45 * (1 + 0.22 * 5)));
  });

  it('spawns Ashen Pact Altar on Odd Floors (1, 3, 5) at distance 1, restores armor/ammo/heat, and supports Decline', () => {
    const sim = new WorldSim({
      seed: 20261027,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    const p = sim.player;

    const shrineRooms = sim.dungeon.rooms.filter((r) => r.type === 'shrine');
    expect(shrineRooms).toHaveLength(1);
    const shrineRoom = shrineRooms[0]!;
    expect(shrineRoom.distanceFromStart).toBe(1);

    sim.enterRoom(shrineRoom.id);
    const shrine = sim.npcEntities.find((n) => n.kind === 'shrine')!;
    expect(shrine).toBeDefined();
    expect(shrine.nameVi).toBe('Tế Đàn Khế Ước Tro Tàn');
    expect(shrine.costGold).toBe(0);
    expect(shrine.costHp).toBe(0);

    // Damage armor, deplete clip, add heat/lockout before interacting
    p.armor = 1;
    p.clipAmmo = 0;
    p.reloadTimer = 0.6;
    p.reloadLockout = true;
    p.weaponHeat = 85;
    p.overheatLockTimer = 0.9;
    const goldBefore = p.gold;
    const hpBefore = p.hp;

    expect(sim.activateShrine(shrine, p)).toBe(true);
    expect(p.gold).toBe(goldBefore);
    expect(p.hp).toBe(hpBefore);
    expect(p.armor).toBe(p.maxArmor);
    expect(p.clipAmmo).toBe(p.clipMax);
    expect(p.reloadTimer).toBe(0);
    expect(p.reloadLockout).toBe(false);
    expect(p.weaponHeat).toBe(0);
    expect(p.overheatLockTimer).toBe(0);

    expect(p.pactChoices).toBeDefined();
    expect(p.pactChoices).toHaveLength(2);
    expect(p.pactChoices![0]).not.toBe(p.pactChoices![1]);
    expect(shrine.usedByPlayerIds).toContain(p.id);
    expect(shrine.interacted).toBe(true);

    // Declining clears pactChoices, leaves activePactId null, and emits shrine_blessing
    sim.consumeEvents();
    expect(sim.selectAshenPact('decline', p.id)).toBe(true);
    expect(p.pactChoices).toEqual([]);
    expect(p.activePactId).toBeNull();
    const declineEvents = sim.consumeEvents();
    expect(
      declineEvents.some(
        (e) => e.kind === 'shrine_blessing' && e.rewardTextVi.includes('Khước từ Khế Ước Tro Tàn'),
      ),
    ).toBe(true);

    // Player cannot re-activate the same Altar after already using it
    expect(sim.activateShrine(shrine, p)).toBe(false);
  });

  it('supports per-player Altar interaction and network synchronization in Co-op', () => {
    const hostTransport = new LocalTransport({
      seed: 90901,
      coopMode: true,
      playerCount: 2,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    const sim = hostTransport.getSim();
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Liệp Ưng P2', 2);

    const shrineRoom = sim.dungeon.rooms.find((r) => r.type === 'shrine')!;
    sim.enterRoom(shrineRoom.id);
    const shrine = sim.npcEntities.find((n) => n.kind === 'shrine')!;

    p1.x = shrine.x;
    p1.y = shrine.y + 18;
    p2.x = shrine.x;
    p2.y = shrine.y - 18;

    // P1 interacts first -> shrine is used by P1, but shrine.interacted is false because P2 hasn't used it yet
    expect(sim.interactWithNearest(p1.id)).toBe(true);
    expect(p1.pactChoices).toHaveLength(2);
    expect(shrine.usedByPlayerIds).toEqual([p1.id]);
    expect(shrine.interacted).toBe(false);

    // P2 interacts second -> shrine.interacted becomes true
    expect(sim.interactWithNearest(p2.id)).toBe(true);
    expect(p2.pactChoices).toHaveLength(2);
    expect(shrine.usedByPlayerIds).toEqual([p1.id, p2.id]);
    expect(shrine.interacted).toBe(true);

    // Encode snapshot and verify client NetworkTransport receives both players' pactChoices
    const sentMessages: Array<{ type: string; payload: unknown }> = [];
    const clientTransport = new NetworkTransport({
      seed: 90901,
      startInHub: false,
      localPlayerId: p2.id,
      localPlayerSlot: 2,
      onSendMessage: (type, payload) => {
        sentMessages.push({ type, payload });
      },
    });
    const snap1 = encodeWorldSnapshot(sim, sim.consumeEvents());
    clientTransport.receiveSnapshot(snap1);

    const clientP2 = clientTransport.getLocalPlayerState();
    expect(clientP2.pactChoices).toEqual(p2.pactChoices);

    // P1 selects via LocalTransport; P2 selects via NetworkTransport
    const p1Chosen = p1.pactChoices![0]!;
    const p2Chosen = p2.pactChoices![1]!;
    expect(hostTransport.selectAshenPact(p1Chosen, p1.id)).toBe(true);
    expect(p1.activePactId).toBe(p1Chosen);
    expect(p1.pactChoices).toEqual([]);

    expect(clientTransport.selectAshenPact(p2Chosen, p2.id)).toBe(true);
    expect(sentMessages).toEqual([{ type: 'select_pact', payload: { pactId: p2Chosen } }]);
    expect(sim.selectAshenPact(p2Chosen, p2.id)).toBe(true);
    expect(p2.activePactId).toBe(p2Chosen);
    expect(p2.pactChoices).toEqual([]);
  });

  it('persists activePactId across Odd->Even Floors and purifies into 3 distinct Awakened Relics upon defeating all 3 Biome Bosses', () => {
    const sim = new WorldSim({
      seed: 202699,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    const p = sim.player;

    const signedPacts: string[] = [];

    for (const biome of [1, 2, 3] as const) {
      const oddFloor = ((biome - 1) * 2 + 1) as 1 | 3 | 5;
      const evenFloor = ((biome - 1) * 2 + 2) as 2 | 4 | 6;

      if (sim.currentFloor !== oddFloor) {
        sim.advanceToFloor(oddFloor);
      }
      expect(sim.currentFloor).toBe(oddFloor);
      expect(sim.currentBiome).toBe(biome);

      const shrineRoom = sim.dungeon.rooms.find((r) => r.type === 'shrine');
      expect(shrineRoom).toBeDefined();
      sim.enterRoom(shrineRoom!.id);
      const shrine = sim.npcEntities.find((n) => n.kind === 'shrine')!;

      expect(sim.activateShrine(shrine, p)).toBe(true);
      expect(p.pactChoices).toHaveLength(2);

      // Verify neither choice was already taken in an earlier biome
      for (const choice of p.pactChoices!) {
        expect(signedPacts).not.toContain(choice);
      }

      const chosenPact = p.pactChoices![0]!;
      sim.consumeEvents();
      expect(sim.selectAshenPact(chosenPact, p.id)).toBe(true);
      expect(p.activePactId).toBe(chosenPact);
      expect(p.pactChoices).toEqual([]);
      signedPacts.push(chosenPact);

      const signEvents = sim.consumeEvents();
      expect(
        signEvents.some(
          (e) => e.kind === 'pact_signed' && e.playerId === p.id && e.pactId === chosenPact,
        ),
      ).toBe(true);

      // Advance to Even Floor (2, 4, 6): activePactId and awakenedRelicIds MUST persist!
      sim.advanceToFloor(evenFloor);
      expect(sim.currentFloor).toBe(evenFloor);
      expect(sim.dungeon.rooms.some((r) => r.type === 'shrine')).toBe(false);
      expect(p.activePactId).toBe(chosenPact);
      expect(p.awakenedRelicIds).toHaveLength(biome - 1);

      // Enter Boss room on Even Floor: activePactId still active during the Boss fight
      const bossRoom = sim.dungeon.rooms.find((r) => r.type === 'boss')!;
      expect(bossRoom).toBeDefined();
      sim.enterRoom(bossRoom.id);
      expect(p.activePactId).toBe(chosenPact);
      expect(sim.getActiveBoss()).not.toBeNull();

      // Defeat the Biome Boss -> purifies activePactId into permanent Awakened Relic!
      sim.consumeEvents();
      sim.skipCurrentRoomWaves();
      const bossClearEvents = sim.consumeEvents();

      const expectedRelicId = PACT_TO_RELIC_ID[chosenPact];
      expect(p.activePactId).toBeNull();
      expect(p.awakenedRelicIds).toContain(expectedRelicId);
      expect(p.awakenedRelicIds).toHaveLength(biome);
      expect(
        bossClearEvents.some(
          (e) =>
            e.kind === 'relic_awakened' &&
            e.playerId === p.id &&
            e.pactId === chosenPact &&
            e.relicId === expectedRelicId,
        ),
      ).toBe(true);
    }

    expect(p.awakenedRelicIds).toHaveLength(3);
    expect(new Set(p.awakenedRelicIds).size).toBe(3);
  });
});
