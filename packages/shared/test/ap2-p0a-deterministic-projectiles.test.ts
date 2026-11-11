import { describe, expect, it } from 'vitest';
import {
  type BulletVolleySpawnEvent,
  INPUT_BUTTON,
  MAX_DEPLOYABLES_PER_PLAYER,
  MAX_ENEMY_PROJECTILES,
  MAX_PLAYER_PROJECTILES,
  MAX_TACTICAL_PROPS_PER_ROOM,
  NetworkTransport,
  SHOT_FLAG,
   type SimEvent,
  WorldSim,
  encodeWorldSnapshot,
} from '../src/index.js';

function makeVolleyEvent(overrides: Partial<BulletVolleySpawnEvent> = {}): BulletVolleySpawnEvent {
  return {
    kind: 'bullet_volley_spawned',
    tick: 1,
    ownerId: 1,
    team: 'player',
    weaponId: 'rivet_gun',
    x: 300,
    y: 260,
    angle: 0,
    pelletCount: 1,
    spreadRad: 0,
    speed: 480,
    damage: 10,
    radius: 5,
    knockback: 20,
    pierceCount: 0,
    bounceCount: 1,
    ttlSec: 2.0,
    element: 'none',
    critChance: 0,
    amplifiedByShield: false,
    seed: 12345,
    ...overrides,
  };
}

describe('AP2 P0A.4 — RELOAD_VENT Input, Deterministic Projectile IDs, Zero-Rubberband Hold & 60Hz Entity Pools', () => {
  it('1. defines INPUT_BUTTON.RELOAD_VENT (1 << 8) and SHOT_FLAG bitflags', () => {
    expect(INPUT_BUTTON.RELOAD_VENT).toBe(1 << 8);
    expect(SHOT_FLAG).toEqual({
      FINALE_SHOT: 1 << 0,
      OVERCLOCKED_SHOT: 1 << 1,
      DYNAMIC_BOUNCE: 1 << 2,
    });
  });

  it('2. assigns deterministic projectile IDs from eventId and pellet index on both Server and Client', () => {
    const serverSim = new WorldSim({
      seed: 4001,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const clientSim = new WorldSim({
      seed: 4001,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });

    expect(serverSim.nextVolleyEventId).toBe(1);

    // First volley without explicit eventId -> auto-increments nextVolleyEventId (1)
    const ev1 = makeVolleyEvent({
      pelletCount: 3,
      spreadRad: 0.2,
      shotFlags: SHOT_FLAG.FINALE_SHOT | SHOT_FLAG.DYNAMIC_BOUNCE,
    });
    serverSim.spawnDeterministicVolley(ev1, true);

    expect(ev1.eventId).toBe(1);
    expect(serverSim.nextVolleyEventId).toBe(2);
    expect(serverSim.projectiles).toHaveLength(3);

    for (let i = 0; i < 3; i++) {
      const expectedId = ((1 & 0x3fffff) << 6) | (i & 0x3f);
      expect(serverSim.projectiles[i]!.id).toBe(expectedId);
      expect(serverSim.projectiles[i]!.shotFlags).toBe(
        SHOT_FLAG.FINALE_SHOT | SHOT_FLAG.DYNAMIC_BOUNCE,
      );
      expect(serverSim.projectiles[i]!.splitGeneration).toBe(0);
      expect(serverSim.projectiles[i]!.awaitingServerRedirectTimer).toBe(0);
    }

    // Second volley -> eventId = 2
    const ev2 = makeVolleyEvent({ pelletCount: 2 });
    serverSim.spawnDeterministicVolley(ev2, true);
    expect(ev2.eventId).toBe(2);
    expect(serverSim.nextVolleyEventId).toBe(3);

    // Client receives ev1 and ev2 (even if client nextEntityId was different) -> exact same IDs
    clientSim.nextEntityId = 9999;
    clientSim.spawnDeterministicVolley(ev1, false);
    clientSim.spawnDeterministicVolley(ev2, false);

    expect(clientSim.projectiles.map((p) => p.id)).toEqual(
      serverSim.projectiles.map((p) => p.id),
    );
  });

  it('3. implements Zero-Rubberband Client Hold in stepClientProjectilesCosmetic when DYNAMIC_BOUNCE hits a wall', () => {
    const clientSim = new WorldSim({
      seed: 4002,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });

    // Spawn a DYNAMIC_BOUNCE projectile right next to the left wall moving left
    const ev = makeVolleyEvent({
      eventId: 10,
      x: 40,
      y: 260,
      angle: Math.PI, // moving left toward x=0 wall
      speed: 600,
      bounceCount: 2,
      shotFlags: SHOT_FLAG.DYNAMIC_BOUNCE,
    });
    clientSim.spawnDeterministicVolley(ev, false);
    const b = clientSim.projectiles[0]!;
    expect(b).toBeDefined();

    // Step until it hits the wall
    for (let step = 0; step < 10; step++) {
      clientSim.stepClientProjectilesCosmetic(1 / 60);
      if ((b.awaitingServerRedirectTimer ?? 0) > 0) break;
    }

    // Instead of bouncing on its own or being destroyed immediately, it holds at wall contact point
    expect(b.ttlSec).toBeGreaterThan(0);
    expect(b.vx).toBe(0);
    expect(b.vy).toBe(0);
    expect(b.awaitingServerRedirectTimer).toBeCloseTo(0.12, 3);
    const heldX = b.x;
    const heldY = b.y;

    // Next tick while awaiting server redirect: stays stationary and counts down timer
    clientSim.stepClientProjectilesCosmetic(0.05);
    expect(b.x).toBe(heldX);
    expect(b.y).toBe(heldY);
    expect(b.awaitingServerRedirectTimer).toBeCloseTo(0.07, 3);
    expect(b.ttlSec).toBeGreaterThan(0);

    // Once 0.12s expires without replacement, projectile expires cleanly
    clientSim.stepClientProjectilesCosmetic(0.08);
    expect(clientSim.projectiles).toHaveLength(0);
  });

  it('4. replaces held projectile in NetworkTransport when bullet_volley_spawned carries replacedProjectileId', () => {
    const serverSim = new WorldSim({
      seed: 4003,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const clientTransport = new NetworkTransport({
      seed: 4003,
      startInHub: false,
      localPlayerId: 1,
      localPlayerSlot: 1,
      wifiProfile: 'off',
    });

    // Spawn initial projectile on client
    const initialEv = makeVolleyEvent({
      eventId: 5,
      shotFlags: SHOT_FLAG.DYNAMIC_BOUNCE,
    });
    clientTransport.getSim().spawnDeterministicVolley(initialEv, false);
    const initialProjId = ((5 & 0x3fffff) << 6) | 0;
    expect(clientTransport.getSim().projectiles.some((p) => p.id === initialProjId)).toBe(true);

    // Server emits replacement volley (e.g. Prism Splitter / Ricochet redirect)
    const redirectEv = makeVolleyEvent({
      eventId: 6,
      pelletCount: 2,
      spreadRad: 0.35,
      shotFlags: SHOT_FLAG.DYNAMIC_BOUNCE,
      replacedProjectileId: initialProjId,
    });
    const snap = encodeWorldSnapshot(serverSim, [redirectEv]);
    clientTransport.receiveSnapshot(snap);

    const activeIds = clientTransport.getSim().projectiles.map((p) => p.id);
    expect(activeIds).not.toContain(initialProjId);
    expect(activeIds).toContain(((6 & 0x3fffff) << 6) | 0);
    expect(activeIds).toContain(((6 & 0x3fffff) << 6) | 1);
  });

  it('5. removes destroyed projectiles in NetworkTransport when projectiles_destroyed event arrives', () => {
    const serverSim = new WorldSim({
      seed: 4004,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const clientTransport = new NetworkTransport({
      seed: 4004,
      startInHub: false,
      localPlayerId: 1,
      localPlayerSlot: 1,
      wifiProfile: 'off',
    });

    const volleyEv = makeVolleyEvent({
      eventId: 12,
      pelletCount: 3,
      spreadRad: 0.25,
    });
    clientTransport.getSim().spawnDeterministicVolley(volleyEv, false);
    const id0 = ((12 & 0x3fffff) << 6) | 0;
    const id1 = ((12 & 0x3fffff) << 6) | 1;
    const id2 = ((12 & 0x3fffff) << 6) | 2;
    expect(clientTransport.getSim().projectiles.map((p) => p.id)).toEqual([id0, id1, id2]);

    const poolBefore = clientTransport.getSim().projectilePool.length;
    const destroyEv: SimEvent = {
      kind: 'projectiles_destroyed',
      ids: [id0, id2],
    };
    const snap = encodeWorldSnapshot(serverSim, [destroyEv]);
    clientTransport.receiveSnapshot(snap);

    expect(clientTransport.getSim().projectiles.map((p) => p.id)).toEqual([id1]);
    expect(clientTransport.getSim().projectilePool.length).toBe(poolBefore + 2);
  });

  it('6. prioritizes bullet_volley_spawned and projectiles_destroyed in encodeWorldSnapshot and raises netEvents cap to 64', () => {
    const sim = new WorldSim({
      seed: 4005,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });

    const spamEvents: SimEvent[] = [];
    for (let i = 0; i < 60; i++) {
      spamEvents.push({
        kind: 'grass_rustle',
        x: 100 + i,
        y: 100,
      });
    }

    const priorityVolley = makeVolleyEvent({
      eventId: 77,
      shotFlags: SHOT_FLAG.OVERCLOCKED_SHOT,
      replacedProjectileId: 1234,
    });
    const priorityDestroyed: SimEvent = {
      kind: 'projectiles_destroyed',
      ids: [444, 555],
    };

    // Put priority events AFTER 60 cosmetic events -> must still be preserved at the front and total cap = 64
    const allEvents: SimEvent[] = [...spamEvents, priorityVolley, priorityDestroyed, ...spamEvents];
    const snap = encodeWorldSnapshot(sim, allEvents);

    expect(snap.events).toHaveLength(64);
    expect(snap.events[0]).toEqual(priorityVolley);
    expect(snap.events[1]).toEqual(priorityDestroyed);
  });

  it('7. enforces separate MAX_PLAYER_PROJECTILES (240) and MAX_ENEMY_PROJECTILES (300) pools without cross-eviction', () => {
    expect(MAX_PLAYER_PROJECTILES).toBe(240);
    expect(MAX_ENEMY_PROJECTILES).toBe(300);
    expect(MAX_TACTICAL_PROPS_PER_ROOM).toBe(16);
    expect(MAX_DEPLOYABLES_PER_PLAYER).toBe(8);

    const sim = new WorldSim({
      seed: 4006,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });

    // Spawn 10 enemy projectiles first
    for (let i = 0; i < 10; i++) {
      sim.spawnDeterministicVolley(
        makeVolleyEvent({
          team: 'enemy',
          ownerId: 99,
          weaponId: 'goblin_bow',
          pelletCount: 1,
        }),
        false,
      );
    }
    const initialEnemyIds = sim.projectiles
      .filter((p) => p.team === 'enemy')
      .map((p) => p.id);
    expect(initialEnemyIds).toHaveLength(10);

    // Spawn 250 player projectiles -> player count caps at 240, oldest 10 player projectiles evicted, all 10 enemy projectiles untouched!
    const spawnedPlayerIds: number[] = [];
    for (let i = 0; i < 250; i++) {
      const ev = makeVolleyEvent({
        team: 'player',
        ownerId: 1,
        pelletCount: 1,
      });
      sim.spawnDeterministicVolley(ev, false);
      spawnedPlayerIds.push(((ev.eventId! & 0x3fffff) << 6) | 0);
    }

    const activePlayerProjs = sim.projectiles.filter((p) => p.team === 'player');
    const activeEnemyProjs = sim.projectiles.filter((p) => p.team === 'enemy');
    expect(activePlayerProjs).toHaveLength(MAX_PLAYER_PROJECTILES);
    expect(activeEnemyProjs.map((p) => p.id)).toEqual(initialEnemyIds);
    expect(activePlayerProjs[0]!.id).toBe(spawnedPlayerIds[10]);
    expect(activePlayerProjs[MAX_PLAYER_PROJECTILES - 1]!.id).toBe(spawnedPlayerIds[249]);

    // Now spawn 300 more enemy projectiles (total 310 enemy projectiles) -> enemy count caps at 300, player projectiles untouched!
    for (let i = 0; i < 300; i++) {
      sim.spawnDeterministicVolley(
        makeVolleyEvent({
          team: 'enemy',
          ownerId: 99,
          weaponId: 'goblin_bow',
          pelletCount: 1,
        }),
        false,
      );
    }

    const activePlayerProjsAfter = sim.projectiles.filter((p) => p.team === 'player');
    const activeEnemyProjsAfter = sim.projectiles.filter((p) => p.team === 'enemy');
    expect(activePlayerProjsAfter).toHaveLength(MAX_PLAYER_PROJECTILES);
    expect(activeEnemyProjsAfter).toHaveLength(MAX_ENEMY_PROJECTILES);
    // First 10 enemy projectiles were evicted
    for (const oldEnemyId of initialEnemyIds) {
      expect(activeEnemyProjsAfter.some((p) => p.id === oldEnemyId)).toBe(false);
    }
  });

  it('8. enforces MAX_TACTICAL_PROPS_PER_ROOM (16) and MAX_DEPLOYABLES_PER_PLAYER (8)', () => {
    const sim = new WorldSim({
      seed: 4007,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });
    sim.addCoopPlayer(2, 'engineer', 'P2', 2);

    // Spawn 20 props -> capped at MAX_TACTICAL_PROPS_PER_ROOM (16)
    for (let i = 0; i < 20; i++) {
      sim.spawnProp('wooden_crate', 100 + i * 20, 200);
    }
    expect(sim.props).toHaveLength(MAX_TACTICAL_PROPS_PER_ROOM);

    // Spawn 10 deployables for player 1 and 2 for player 2 -> P1 capped at 8, P2 untouched at 2
    for (let i = 0; i < 10; i++) {
      sim.spawnSeedGunLifeBlossom(1, 200 + i * 15, 260);
    }
    for (let i = 0; i < 2; i++) {
      sim.spawnSeedGunLifeBlossom(2, 200 + i * 15, 320);
    }
    const p1Summons = sim.summons.filter((s) => s.ownerPlayerId === 1 && s.ttlSec > 0 && s.hp > 0);
    const p2Summons = sim.summons.filter((s) => s.ownerPlayerId === 2 && s.ttlSec > 0 && s.hp > 0);
    expect(p1Summons.length).toBeLessThanOrEqual(MAX_DEPLOYABLES_PER_PLAYER);
    expect(p2Summons).toHaveLength(2);
  });

  it('9. emits projectiles_destroyed event when enemy bullets are destroyed mid-flight by melee, Vanguard shield, or boss phase transition', () => {
    const sim = new WorldSim({
      seed: 4008,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });

    // 9a. Melee swing with knight_sword (Hit 3 Parry Deflect destroys/deflects enemy bullets)
    sim.player.weaponSlots = ['knight_sword'];
    sim.player.activeWeaponSlot = 0;
    sim.player.meleeComboStep = 2;
    sim.player.x = 300;
    sim.player.y = 260;
    sim.player.aimAngle = 0;

    const enemyVolley1 = makeVolleyEvent({
      team: 'enemy',
      ownerId: 99,
      weaponId: 'goblin_bow',
      x: 325,
      y: 260,
      angle: Math.PI,
      pelletCount: 2,
      spreadRad: 0.05,
    });
    sim.spawnDeterministicVolley(enemyVolley1, true);
    const meleeTargetIds = sim.projectiles.map((p) => p.id);
    sim.consumeEvents();

    sim.tryFireActiveWeapon(sim.player);
    const meleeEvents = sim.consumeEvents();
    const meleeDestroyedEv = meleeEvents.find((e) => e.kind === 'projectiles_destroyed');
    expect(meleeDestroyedEv).toBeDefined();
    if (meleeDestroyedEv?.kind === 'projectiles_destroyed') {
      expect(meleeDestroyedEv.ids).toEqual(expect.arrayContaining(meleeTargetIds));
    }

    // 9b. Vanguard shield blocking enemy projectile
    sim.projectiles.length = 0;
    sim.player.characterId = 'vanguard';
    sim.player.skillActiveTimer = 2.0;
    sim.player.aimAngle = 0;
    const enemyVolley2 = makeVolleyEvent({
      team: 'enemy',
      ownerId: 99,
      weaponId: 'goblin_bow',
      x: 332,
      y: 260,
      angle: Math.PI,
      speed: 300,
      pelletCount: 1,
    });
    sim.spawnDeterministicVolley(enemyVolley2, true);
    const shieldTargetId = sim.projectiles[0]!.id;
    sim.consumeEvents();

    sim.updateProjectiles(1 / 60);
    const shieldEvents = sim.consumeEvents();
    const shieldDestroyedEv = shieldEvents.find((e) => e.kind === 'projectiles_destroyed');
    expect(shieldDestroyedEv).toBeDefined();
    if (shieldDestroyedEv?.kind === 'projectiles_destroyed') {
      expect(shieldDestroyedEv.ids).toContain(shieldTargetId);
    }

    // 9c. Boss phase transition clearing nearby enemy projectiles
    sim.player.skillActiveTimer = 0;
    const boss = sim.spawnEnemy('spore_king', 460, 260, true);
    const enemyVolley3 = makeVolleyEvent({
      team: 'enemy',
      ownerId: boss.id,
      weaponId: 'spore_shot',
      x: sim.player.x + 40,
      y: sim.player.y,
      angle: Math.PI,
      pelletCount: 1,
    });
    sim.spawnDeterministicVolley(enemyVolley3, true);
    const bossBulletId = sim.projectiles[0]!.id;
    sim.consumeEvents();

    boss.hp = Math.floor(boss.maxHp * 0.6);
    sim.checkBossPhaseTransitions(boss);
    const bossEvents = sim.consumeEvents();
    const bossDestroyedEv = bossEvents.find((e) => e.kind === 'projectiles_destroyed');
    expect(bossDestroyedEv).toBeDefined();
    if (bossDestroyedEv?.kind === 'projectiles_destroyed') {
      expect(bossDestroyedEv.ids).toContain(bossBulletId);
    }
  });
});
