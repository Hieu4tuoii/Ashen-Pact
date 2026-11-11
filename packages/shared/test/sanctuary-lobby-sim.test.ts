import { describe, expect, it } from 'vitest';
import {
  INTERACT_PRIORITY_ORDER,
  INTERACT_RANGE,
  INTERACT_RANGE_OFFSETS,
  NetworkTransport,
  TILE_SIZE,
  WorldSim,
  collectLeafKeys,
  decodeWorldSnapshot,
  distance,
  enLocale,
  encodeWorldSnapshot,
  findInteractTarget,
  i18n,
  viLocale,
  type HubStationId,
  type SimHubStation,
} from '../src/index.js';

describe('Task 1 — 5-Wing Ashen Sanctuary Layout, SimHubStation, Snapshot Sync & i18n', () => {
  it('1. initializes 36x22 Sanctuary Hub with all surfaces set to none and exact 5-Wing coordinates', () => {
    const sim = new WorldSim({ seed: 1337, startInHub: true });

    expect(sim.inHub).toBe(true);
    expect(sim.map.cols).toBe(36);
    expect(sim.map.rows).toBe(22);
    expect(sim.map.surfaces.every((s) => s === 'none')).toBe(true);

    // North Expedition Portal
    expect(sim.portalActive).toBe(true);
    expect(sim.portalX).toBe(576);
    expect(sim.portalY).toBe(122);
    expect(
      sim.map.isSolidTile(Math.floor(sim.portalX / TILE_SIZE), Math.floor(sim.portalY / TILE_SIZE)),
    ).toBe(false);

    // 5 Living Hero Lounge Stations (hubStatues)
    const expectedStatues = [
      ['vanguard', 388, 224],
      ['ranger', 452, 160],
      ['elementalist', 700, 160],
      ['druid', 388, 316],
      ['engineer', 764, 224],
    ] as const;
    expect(sim.hubStatues).toHaveLength(5);
    for (const [cid, sx, sy] of expectedStatues) {
      const statue = sim.hubStatues.find((s) => s.characterId === cid);
      expect(statue).toBeDefined();
      expect(statue?.x).toBe(sx);
      expect(statue?.y).toBe(sy);
      expect(statue?.radius).toBe(24);
      expect(
        sim.map.isSolidTile(Math.floor(sx / TILE_SIZE), Math.floor(sy / TILE_SIZE)),
      ).toBe(false);
      expect(distance(sx, sy, sim.portalX, sim.portalY)).toBeGreaterThanOrEqual(125);
    }
    for (let i = 0; i < sim.hubStatues.length; i++) {
      for (let j = i + 1; j < sim.hubStatues.length; j++) {
        const a = sim.hubStatues[i]!;
        const b = sim.hubStatues[j]!;
        expect(distance(a.x, a.y, b.x, b.y)).toBeGreaterThanOrEqual(88);
      }
    }

    // 2 Hub Stations (East Co-op Guild Board & South-East Chronicler's Codex Desk)
    const stations: SimHubStation[] = sim.hubStations;
    expect(stations).toHaveLength(2);
    const coopBoard = stations.find((s) => s.id === ('coop_board' satisfies HubStationId));
    const codexDesk = stations.find((s) => s.id === ('codex_desk' satisfies HubStationId));
    expect(coopBoard).toMatchObject({ id: 'coop_board', x: 928, y: 352, radius: 26 });
    expect(codexDesk).toMatchObject({ id: 'codex_desk', x: 860, y: 520, radius: 24 });
    for (const st of stations) {
      expect(st.nameVi.length).toBeGreaterThan(0);
      expect(
        sim.map.isSolidTile(Math.floor(st.x / TILE_SIZE), Math.floor(st.y / TILE_SIZE)),
      ).toBe(false);
    }

    // Sanctuary Lighting Props (5 torch_brazier + 2 glow_mushroom)
    const braziers = sim.props.filter((p) => p.kind === 'torch_brazier');
    expect(braziers.map((p) => [p.x, p.y])).toEqual([
      [576, 352],
      [476, 128],
      [676, 128],
      [236, 156],
      [884, 276],
    ]);
    const mushrooms = sim.props.filter((p) => p.kind === 'glow_mushroom');
    expect(mushrooms.map((p) => [p.x, p.y])).toEqual([
      [330, 316],
      [920, 536],
    ]);
    for (const p of sim.props) {
      expect(
        sim.map.isSolidTile(Math.floor(p.x / TILE_SIZE), Math.floor(p.y / TILE_SIZE)),
      ).toBe(false);
    }

    // West Training Dummy & 2x2 Weapon Rack
    const dummies = sim.enemies.filter((e) => e.isDummy);
    expect(dummies).toHaveLength(1);
    expect(dummies[0]!.x).toBe(236);
    expect(dummies[0]!.y).toBe(236);
    expect(
      sim.map.isSolidTile(Math.floor(236 / TILE_SIZE), Math.floor(236 / TILE_SIZE)),
    ).toBe(false);

    const rackItems = sim.worldItems.filter((it) => it.isHubRackItem);
    expect(rackItems.map((it) => [it.weaponId, it.x, it.y])).toEqual([
      ['hunter_crossbow', 206, 404],
      ['apprentice_staff', 326, 404],
      ['tesla_carbine', 206, 488],
      ['scrap_shotgun', 326, 488],
    ]);
    for (const it of rackItems) {
      expect(
        sim.map.isSolidTile(Math.floor(it.x / TILE_SIZE), Math.floor(it.y / TILE_SIZE)),
      ).toBe(false);
    }

    // P1 clean unoccluded spawn facing North (-PI/2)
    expect(sim.player.x).toBe(576);
    expect(sim.player.y).toBe(412);
    expect(sim.player.aimAngle).toBeCloseTo(-Math.PI * 0.5, 5);
    expect(findInteractTarget(sim, sim.player.id)).toBeNull();

    // Idle step preserves North facing angle
    sim.step(1 / 60);
    expect(sim.player.aimAngle).toBeCloseTo(-Math.PI * 0.5, 5);

    // Co-op slots 2..4 in Hub spawn at [512, 386], [640, 386], [576, 462] facing North
    const p2 = sim.addCoopPlayer(2, 'ranger', 'P2', 2);
    const p3 = sim.addCoopPlayer(3, 'elementalist', 'P3', 3);
    const p4 = sim.addCoopPlayer(4, 'druid', 'P4', 4);
    expect([p2.x, p2.y]).toEqual([512, 386]);
    expect([p3.x, p3.y]).toEqual([640, 386]);
    expect([p4.x, p4.y]).toEqual([576, 462]);
    expect(p2.aimAngle).toBeCloseTo(-Math.PI * 0.5, 5);
  });

  it('2. resolves hub_station in findInteractTarget with hysteresis & priority, emits hub_station_interacted, and preserves INTERACT constants', () => {
    expect(INTERACT_RANGE_OFFSETS).toEqual({
      hub_statue: 8,
      ancient_mechanism: 10,
      chest: 0,
      world_item: 0,
      shrine: 8,
      portal: 8,
      door: 8,
    });
    expect(INTERACT_PRIORITY_ORDER).toEqual([
      'hub_statue',
      'ancient_mechanism',
      'chest',
      'world_item',
      'shrine',
      'portal',
      'door',
    ]);

    const sim = new WorldSim({ seed: 1337, startInHub: true });
    sim.consumeEvents();

    // Co-op Guild Board at (928, 352) -> player at (928, 382) (d = 30 <= 72)
    sim.player.x = 928;
    sim.player.y = 382;
    const coopTarget = findInteractTarget(sim, sim.player.id);
    expect(coopTarget).not.toBeNull();
    expect(coopTarget?.kind).toBe('hub_station');
    expect(coopTarget?.key).toBe('hub_station:coop_board');
    if (coopTarget?.kind === 'hub_station') {
      expect(coopTarget.station.id).toBe('coop_board');
      expect(coopTarget.distance).toBeCloseTo(30, 5);
    }

    expect(sim.interactWithNearest(sim.player)).toBe(true);
    const coopEvents = sim.consumeEvents();
    expect(coopEvents).toContainEqual({
      kind: 'hub_station_interacted',
      playerId: sim.player.id,
      stationId: 'coop_board',
      x: 928,
      y: 352,
    });

    // Chronicler's Codex Desk at (860, 520) -> player at (860, 548) (d = 28 <= 72)
    sim.player.x = 860;
    sim.player.y = 548;
    const codexTarget = findInteractTarget(sim, sim.player.id);
    expect(codexTarget?.kind).toBe('hub_station');
    expect(codexTarget?.key).toBe('hub_station:codex_desk');
    expect(sim.interactWithNearest(sim.player)).toBe(true);
    const codexEvents = sim.consumeEvents();
    expect(codexEvents).toContainEqual({
      kind: 'hub_station_interacted',
      playerId: sim.player.id,
      stationId: 'codex_desk',
      x: 860,
      y: 520,
    });

    // Hysteresis: base range = INTERACT_RANGE + 8 = 72, hysteresis = +8 => 80
    sim.player.x = 928;
    sim.player.y = 352 + INTERACT_RANGE + 12; // 428 -> d = 76
    expect(findInteractTarget(sim, sim.player.id)).toBeNull();
    expect(
      findInteractTarget(sim, sim.player.id, { currentTargetKey: 'hub_station:coop_board' })?.key,
    ).toBe('hub_station:coop_board');
    sim.player.y = 352 + INTERACT_RANGE + 18; // 434 -> d = 82 (> 80)
    expect(
      findInteractTarget(sim, sim.player.id, { currentTargetKey: 'hub_station:coop_board' }),
    ).toBeNull();

    // Priority: world_item > hub_station > portal
    sim.portalActive = true;
    sim.portalX = 928;
    sim.portalY = 360;
    sim.player.x = 928;
    sim.player.y = 365;
    expect(findInteractTarget(sim, sim.player.id)?.key).toBe('hub_station:coop_board');

    const dropped = sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: 'rivet_gun',
      rarity: 'common',
      nameVi: 'Súng Đinh Tán',
      costGold: 0,
      healAmount: 0,
      x: 928,
      y: 375,
    });
    expect(findInteractTarget(sim, sim.player.id)?.key).toBe(`world_item:${dropped.id}`);
  });

  it('3. clears hubStations and hubStatues when starting a dungeon run or entering a dungeon room', () => {
    const sim = new WorldSim({ seed: 1337, startInHub: true });
    expect(sim.hubStations).toHaveLength(2);
    expect(sim.hubStatues).toHaveLength(5);

    sim.startDungeonRunFromHub();
    expect(sim.inHub).toBe(false);
    expect(sim.hubStations).toHaveLength(0);
    expect(sim.hubStatues).toHaveLength(0);

    // Re-enter Hub then enterRoom directly
    sim.enterHub();
    expect(sim.hubStations).toHaveLength(2);
    sim.enterRoom(sim.dungeon.startRoomId);
    expect(sim.inHub).toBe(false);
    expect(sim.hubStations).toHaveLength(0);
  });

  it('4. round-trips hubStations via encodeWorldSnapshot / decodeWorldSnapshot / NetworkTransport when inHub is true', () => {
    const serverSim = new WorldSim({ seed: 1337, startInHub: true });
    const encoded = encodeWorldSnapshot(serverSim, []);
    expect(encoded.inHub).toBe(true);
    expect(encoded.hubStations).toHaveLength(2);

    const decoded = decodeWorldSnapshot(JSON.stringify(encoded));
    expect(decoded.hubStations).toEqual(serverSim.hubStations);

    const clientTransport = new NetworkTransport({
      seed: 1337,
      startInHub: false,
      localPlayerId: 1,
      localPlayerSlot: 1,
      wifiProfile: 'off',
    });
    expect(clientTransport.getSim().hubStations).toHaveLength(0);

    clientTransport.receiveSnapshot(decoded);
    expect(clientTransport.getSim().inHub).toBe(true);
    expect(clientTransport.getSim().hubStations).toEqual(serverSim.hubStations);

    // Leaving Hub clears hubStations on client too
    serverSim.startDungeonRunFromHub();
    const runSnap = decodeWorldSnapshot(JSON.stringify(encodeWorldSnapshot(serverSim, [])));
    clientTransport.receiveSnapshot(runSnap);
    expect(clientTransport.getSim().inHub).toBe(false);
    expect(clientTransport.getSim().hubStations).toHaveLength(0);
  });

  it('5. provides symmetric ui.sanctuary.* and ui.hubGuide.* i18n keys across VI and EN', () => {
    expect(collectLeafKeys(viLocale)).toEqual(collectLeafKeys(enLocale));

    const requiredSanctuaryKeys = [
      'title',
      'subtitle',
      'coopWingSign',
      'codexWingSign',
      'coopStationPrompt',
      'codexStationPrompt',
      'embodiedBadge',
      'soloCoopChip',
      'soloCoopTitle',
      'leaveCoopBtn',
      'returnSanctuaryConfirmTitle',
      'returnSanctuaryConfirmBody',
      'pauseReturnSanctuary',
    ] as const;

    i18n.setLocale('vi');
    for (const k of requiredSanctuaryKeys) {
      const fullKey = `ui.sanctuary.${k}`;
      expect(i18n.hasKey(fullKey, 'vi')).toBe(true);
      expect(i18n.hasKey(fullKey, 'en')).toBe(true);
      expect(i18n.t(fullKey)).not.toBe(fullKey);
    }
    expect(i18n.t('ui.sanctuary.embodiedBadge')).toBe('★ Đang hóa thân');

    i18n.setLocale('en');
    expect(i18n.t('ui.sanctuary.embodiedBadge')).toBe('★ Active');
    i18n.setLocale('vi');
  });
});
