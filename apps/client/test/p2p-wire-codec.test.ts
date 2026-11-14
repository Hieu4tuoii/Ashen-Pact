import {
  type QuantizedEnemySnap,
  type QuantizedWorldSnapshot,
  WorldSim,
  encodeWorldSnapshot,
  quantizeAngle,
  quantizeCoord,
} from '@ashen-pact/shared';
import { describe, expect, it } from 'vitest';
import { P2PSnapshotDecoder, P2PSnapshotEncoder } from '../src/net/p2p-wire-codec.js';

function buildRichFourPlayerCombatSim(): WorldSim {
  const sim = new WorldSim({
    seed: 90901,
    startInHub: false,
    spawnInitialWave: true,
    includeTrainingDummy: false,
  });
  sim.addCoopPlayer(2, 2, 'ranger', 'RangerP2');
  sim.addCoopPlayer(3, 3, 'arcanist', 'MageP3');
  sim.addCoopPlayer(4, 4, 'engineer', 'EngiP4');

  // Populate rich player loadouts, blessings, mutators, boons, relics, pacts, soulChain, salvage
  const p1 = sim.player;
  p1.blessingIds.push('ember_strike', 'chain_arc');
  p1.duoBoonIds.push('inferno_tempest');
  p1.awakenedRelicIds.push('black_crystal');
  p1.activePactId = 'blood_oath';
  p1.pactOriginalWeaponId = 'knight_sword';
  p1.weaponMutators = { 0: ['twin_barrel'], 1: [] };
  p1.weaponUpgradeLevels = { 0: 2, 1: 1 };
  p1.blackCrystalEmpoweredNextShot = true;
  p1.soulChainTargetId = 2;
  p1.soulChainTargetKind = 'player';
  p1.soulChainStretchTimer = 0.45;
  p1.salvageHoldTimer = 0.35;
  p1.salvageTargetItemId = 77;
  p1.emoteId = 'thumbs_up';
  p1.emoteTimer = 1.2;
  p1.statsDamageDealt = 480;
  p1.statsKills = 9;

  // Ensure >= 25 props and >= 12 enemies in the combat snapshot
  while (sim.props.length < 25) {
    const idx = sim.props.length + 1;
    sim.props.push({
      id: 500 + idx,
      kind: idx % 2 === 0 ? 'crate' : 'pillar',
      x: 160 + (idx % 6) * 64,
      y: 160 + Math.floor(idx / 6) * 64,
      radius: 16,
      hp: 30,
      maxHp: 30,
      destructible: idx % 2 === 0,
      explosive: false,
      blocksMovement: true,
      lightRadius: 0,
      lightColorHex: '#000000',
      hitFlashTimer: 0,
      fuseTimer: 0,
      state: 'intact',
    });
  }

  return sim;
}

function enrichCombatSnapshotForRoundTrip(baseSnap: QuantizedWorldSnapshot): QuantizedWorldSnapshot {
  const snap: QuantizedWorldSnapshot = JSON.parse(JSON.stringify(baseSnap)) as QuantizedWorldSnapshot;
  snap.snapshotSeq = 1;

  while (snap.enemies.length < 12) {
    const idx = snap.enemies.length + 1;
    const extraEnemy: QuantizedEnemySnap = {
      id: 900 + idx,
      defId: idx === 12 ? 'warden_boss' : 'skeleton_melee',
      qx: quantizeCoord(240 + idx * 24),
      qy: quantizeCoord(220 + (idx % 4) * 32),
      vx: 65,
      vy: -30,
      qAngle: quantizeAngle(0.5),
      hp: idx === 12 ? 620 : 42,
      maxHp: idx === 12 ? 800 : 50,
      shield: idx % 3 === 0 ? 15 : 0,
      maxShield: idx % 3 === 0 ? 20 : 0,
      ai: idx % 2 === 0 ? 'chase' : 'telegraph',
      st100: 25,
      qTelAngle: quantizeAngle(1.1),
      telRad: idx % 2 === 0 ? 0 : 48,
      telLen: 0,
      elite: idx === 11,
      eliteMod: idx === 11 ? 'fast' : null,
      boss: idx === 12,
      bossPh: idx === 12 ? 2 : 1,
      burrow: false,
      burn10: idx === 1 ? 18 : 0,
      chill: idx === 2 ? 2 : 0,
      froz10: 0,
      shock10: idx === 3 ? 12 : 0,
      poison: 0,
      mark10: idx === 1 ? 20 : 0,
      sc10: 0,
      root10: 0,
      blind10: 0,
      stuckArrows: idx === 2 ? 3 : 0,
      parasiticThorns: 0,
      napalm10: 0,
    };
    snap.enemies.push(extraEnemy);
  }

  snap.chests = [
    {
      id: 1,
      x: 320,
      y: 280,
      opened: false,
      tier: 'rare',
    },
  ];
  snap.worldItems = [
    {
      id: 77,
      x: 352,
      y: 280,
      kind: 'weapon',
      weaponId: 'gale_smg',
      costGold: 0,
    },
  ];
  snap.pickups = [
    { id: 1, kind: 'gold', qx: quantizeCoord(300), qy: quantizeCoord(300), amount: 5 },
    { id: 2, kind: 'life_seed', qx: quantizeCoord(340), qy: quantizeCoord(310), amount: 1, ownerId: 2 },
  ];
  snap.surfaces = [
    [42, 'fire', 25],
    [43, 'oil', 40],
    [88, 'ice', 60],
  ];
  return snap;
}

describe('P2P Wire Codec — Lossless Baseline Delta + Single-MTU Fast Tuple', () => {
  it('round-trips Hub and rich 4-player combat snapshots 100% losslessly', () => {
    const encoder = new P2PSnapshotEncoder();
    const decoder = new P2PSnapshotDecoder();

    // 1. Hub snapshot with statues, stations, and character selection state
    const hubSim = new WorldSim({ seed: 4242, startInHub: true });
    hubSim.addCoopPlayer(2, 2, 'arcanist', 'BanCuaToi');
    const hubSnap = encodeWorldSnapshot(hubSim, [], true, 1700000001000);
    hubSnap.snapshotSeq = 1;

    const encodedHub = encoder.encode(hubSnap);
    expect(encodedHub.baseline).toBeDefined();
    expect(decoder.applyBaseline(encodedHub.baseline!.rev, encodedHub.baseline!.data)).toBeNull();
    const decodedHub = decoder.decodeFast(encodedHub.fast);
    expect(decodedHub).toEqual(hubSnap);

    // 2. Rich 4P combat snapshot with transient mechanics (summons, zones, rivets, tether, pings)
    const combatSim = buildRichFourPlayerCombatSim();
    const combatSnap = enrichCombatSnapshotForRoundTrip(
      encodeWorldSnapshot(combatSim, [], false, 1700000002000),
    );
    combatSnap.snapshotSeq = 2;
    combatSnap.pings = [
      {
        id: 1,
        ownerPlayerId: 1,
        ownerName: 'Host',
        ownerColorHex: '#ffaa44',
        x: 400,
        y: 300,
        ttlSec: 3.5,
      },
    ];
    combatSnap.tetherBeams = [
      {
        ownerPlayerId: 3,
        x1: 300,
        y1: 260,
        x2: 420,
        y2: 260,
        ttlSec: 0.25,
      },
    ];

    const encodedCombat = encoder.encode(combatSnap);
    expect(encodedCombat.baseline).toBeDefined();
    expect(encodedCombat.baseline!.rev).toBe(2);
    expect(
      decoder.applyBaseline(encodedCombat.baseline!.rev, encodedCombat.baseline!.data),
    ).toBeNull();
    const decodedCombat = decoder.decodeFast(encodedCombat.fast);
    expect(decodedCombat).toEqual(combatSnap);
  });

  it('omits unchanged baseline on steady-state combat ticks and shrinks fast frame below 1300 bytes (>= 70% smaller)', () => {
    const encoder = new P2PSnapshotEncoder();
    const decoder = new P2PSnapshotDecoder();

    const sim = buildRichFourPlayerCombatSim();
    const tick1Snap = enrichCombatSnapshotForRoundTrip(
      encodeWorldSnapshot(sim, [], false, 1700000010000),
    );
    tick1Snap.snapshotSeq = 10;
    // Clear transient one-off salvage/emote on tick 1 so steady-state combat reflects normal movement & shooting
    for (const p of tick1Snap.players) {
      p.emoteId = null;
      p.emoteTimer10 = 0;
      p.salvage100 = 0;
      p.salvageItemId = 0;
      p.soulChainTargetId = null;
      p.soulChainTargetKind = null;
      p.soulChainStretchTimer = 0;
    }

    const first = encoder.encode(tick1Snap);
    expect(first.baseline).toBeDefined();
    decoder.applyBaseline(first.baseline!.rev, first.baseline!.data);
    expect(decoder.decodeFast(first.fast)).toEqual(tick1Snap);

    // Next 30Hz snapshot: all 4 players & all 12 enemies move, aim, fire, tick cooldowns & runStats
    const tick2Snap: QuantizedWorldSnapshot = JSON.parse(JSON.stringify(tick1Snap));
    tick2Snap.tick += 2;
    tick2Snap.snapshotSeq = 11;
    tick2Snap.serverTimeMs += 33;
    if (tick2Snap.runStats) {
      tick2Snap.runStats.ticksElapsed += 2;
      tick2Snap.runStats.damageDealt += 36;
    }
    for (const p of tick2Snap.players) {
      p.qx += 48;
      p.qy -= 32;
      p.qAngle = (p.qAngle + 120) & 4095;
      p.clipAmmo = Math.max(0, p.clipAmmo - 1);
      p.fireCd100 = 12;
      p.lastSeq += 2;
    }
    for (const e of tick2Snap.enemies) {
      e.qx -= 24;
      e.qy += 16;
      e.hp = Math.max(1, e.hp - 4);
      e.st100 = Math.max(0, e.st100 - 3);
    }

    const second = encoder.encode(tick2Snap);
    expect(second.baseline).toBeUndefined();

    const fullJsonBytes = JSON.stringify(tick2Snap).length;
    const fastJsonBytes = JSON.stringify(second.fast).length;
    expect(fastJsonBytes).toBeLessThan(1300);
    expect(fastJsonBytes).toBeLessThanOrEqual(fullJsonBytes * 0.3);

    const decodedSecond = decoder.decodeFast(second.fast);
    expect(decodedSecond).toEqual(tick2Snap);
  });

  it('bumps baseline revision whenever props, chests, loadouts, enemies, or room state change', () => {
    const encoder = new P2PSnapshotEncoder();
    const decoder = new P2PSnapshotDecoder();

    const sim = buildRichFourPlayerCombatSim();
    const snap = enrichCombatSnapshotForRoundTrip(
      encodeWorldSnapshot(sim, [], false, 1700000020000),
    );
    snap.snapshotSeq = 1;

    const step1 = encoder.encode(snap);
    expect(step1.baseline?.rev).toBe(1);
    decoder.applyBaseline(step1.baseline!.rev, step1.baseline!.data);
    expect(decoder.decodeFast(step1.fast)).toEqual(snap);

    // 1. Damage a destructible prop
    const propChanged: QuantizedWorldSnapshot = JSON.parse(JSON.stringify(snap));
    propChanged.snapshotSeq = 2;
    propChanged.props[0]!.hp = Math.max(0, propChanged.props[0]!.hp - 10);
    const step2 = encoder.encode(propChanged);
    expect(step2.baseline?.rev).toBe(2);
    decoder.applyBaseline(step2.baseline!.rev, step2.baseline!.data);
    expect(decoder.decodeFast(step2.fast)).toEqual(propChanged);

    // 2. Open chest & grant player blessing
    const loadoutChanged: QuantizedWorldSnapshot = JSON.parse(JSON.stringify(propChanged));
    loadoutChanged.snapshotSeq = 3;
    loadoutChanged.chests[0]!.opened = true;
    loadoutChanged.players[1]!.blessings.push('frost_nova');
    const step3 = encoder.encode(loadoutChanged);
    expect(step3.baseline?.rev).toBe(3);
    decoder.applyBaseline(step3.baseline!.rev, step3.baseline!.data);
    expect(decoder.decodeFast(step3.fast)).toEqual(loadoutChanged);

    // 3. Spawn a new enemy
    const enemySpawned: QuantizedWorldSnapshot = JSON.parse(JSON.stringify(loadoutChanged));
    enemySpawned.snapshotSeq = 4;
    enemySpawned.enemies.push({
      ...enemySpawned.enemies[0]!,
      id: 9999,
      defId: 'cultist_ranged',
    });
    const step4 = encoder.encode(enemySpawned);
    expect(step4.baseline?.rev).toBe(4);
    decoder.applyBaseline(step4.baseline!.rev, step4.baseline!.data);
    expect(decoder.decodeFast(step4.fast)).toEqual(enemySpawned);
  });

  it('buffers an early __fast__ frame arriving before its __base__ revision and rejects stale revisions/sequences', () => {
    const encoder = new P2PSnapshotEncoder();
    const decoder = new P2PSnapshotDecoder();

    const sim = buildRichFourPlayerCombatSim();
    const snap1 = enrichCombatSnapshotForRoundTrip(
      encodeWorldSnapshot(sim, [], false, 1700000030000),
    );
    snap1.snapshotSeq = 1;

    const enc1 = encoder.encode(snap1);
    decoder.applyBaseline(enc1.baseline!.rev, enc1.baseline!.data);
    expect(decoder.decodeFast(enc1.fast)).toEqual(snap1);

    // Room transition -> rev 2
    const snap2: QuantizedWorldSnapshot = JSON.parse(JSON.stringify(snap1));
    snap2.snapshotSeq = 2;
    snap2.tick += 2;
    snap2.currentRoomId += 1;
    snap2.props = snap2.props.slice(0, 5);
    const enc2 = encoder.encode(snap2);
    expect(enc2.baseline?.rev).toBe(2);

    // Simulate UDP fastDc beating SCTP conn: decodeFast(rev 2) arrives BEFORE applyBaseline(rev 2)!
    expect(decoder.decodeFast(enc2.fast)).toBeNull();

    // Now reliable __base__ rev 2 arrives -> immediately yields reconstructed snap2!
    const unlockedSnap2 = decoder.applyBaseline(enc2.baseline!.rev, enc2.baseline!.data);
    expect(unlockedSnap2).toEqual(snap2);

    // Stale rev 1 fast frame or duplicate seq 2 fast frame must be rejected
    expect(decoder.decodeFast(enc1.fast)).toBeNull();
    expect(decoder.decodeFast(enc2.fast)).toBeNull();
  });
});
