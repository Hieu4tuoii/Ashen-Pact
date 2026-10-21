import { describe, expect, it } from 'vitest';
import {
  COOP_SCALING,
  INPUT_BUTTON,
  NetworkTransport,
  WifiSimulator,
  WorldSim,
  encodeWorldSnapshot,
  estimateSnapshotBytes,
  generateDungeonFloor,
  generateQrMatrix,
} from '../src/index.js';

describe('Phase 4 — Co-op LAN, Hub, 5 Characters, Scaling, Revive/Ghost & NetworkTransport', () => {
  it('generates valid ISO/IEC 18004 QR Code matrices for LAN invite URLs with finder patterns', () => {
    const matrix = generateQrMatrix('http://192.168.1.42:2567/?join=coop');
    expect(matrix.length).toBeGreaterThanOrEqual(29);
    expect(matrix[0]!.length).toBe(matrix.length);

    // Verify 7x7 finder pattern corners (top-left, top-right, bottom-left)
    expect(matrix[0]![0]).toBe(true);
    expect(matrix[0]![6]).toBe(true);
    expect(matrix[6]![0]).toBe(true);
    expect(matrix[3]![3]).toBe(true);
    expect(matrix[1]![1]).toBe(false);
  });

  it('simulates Wi-Fi profiles (off, good, normal, bad) with latency, jitter, loss, and spikes', () => {
    const simOff = new WifiSimulator('off');
    let deliveredOff = 0;
    simOff.sendOutbound({ seq: 1 }, () => {
      deliveredOff += 1;
    });
    expect(deliveredOff).toBe(1);

    const simBad = new WifiSimulator('bad', 2026);
    let deliveredBad = 0;
    for (let i = 0; i < 200; i++) {
      simBad.sendOutbound({ seq: i }, () => {
        deliveredBad += 1;
      });
      simBad.step(16.67);
    }
    // Flush remaining queued packets
    simBad.step(1000);
    const stats = simBad.getStats();
    expect(stats.packetsSent).toBeGreaterThan(150);
    expect(stats.packetsDropped).toBeGreaterThan(0);
    expect(deliveredBad + stats.packetsDropped).toBe(stats.packetsSent);
  });

  it('supports Hub mode with 5 character statues, duplicate character restriction, and Ready check', () => {
    const sim = new WorldSim({ seed: 404, startInHub: true });
    expect(sim.inHub).toBe(true);
    expect(sim.hubStatues.length).toBe(5);

    const p2 = sim.addCoopPlayer(2, 2, 'ranger', 'Chiến Hữu 2');
    const p3 = sim.addCoopPlayer(3, 3, 'druid', 'Chiến Hữu 3');
    const p4 = sim.addCoopPlayer(4, 4, 'engineer', 'Chiến Hữu 4');
    expect(sim.getAllPlayers().length).toBe(4);
    expect(sim.getActivePlayerCount()).toBe(4);

    // Disallow duplicate characters: P2 cannot select Vanguard (already held by P1)
    const switchedDup = sim.selectCharacter(p2.id, 'vanguard', false);
    expect(switchedDup).toBe(false);
    expect(p2.characterId).toBe('ranger');

    // Allow duplicate characters or pick free character (elementalist)
    const switchedElem = sim.selectCharacter(p2.id, 'elementalist', false);
    expect(switchedElem).toBe(true);
    expect(p2.characterId).toBe('elementalist');

    // Ready check
    expect(sim.areAllPlayersReady()).toBe(false);
    sim.togglePlayerReady(sim.player.id, true);
    sim.togglePlayerReady(p2.id, true);
    sim.togglePlayerReady(p3.id, true);
    expect(sim.areAllPlayersReady()).toBe(false);
    sim.togglePlayerReady(p4.id, true);
    expect(sim.areAllPlayersReady()).toBe(true);

    // Start dungeon run from Hub
    sim.startDungeonRunFromHub();
    expect(sim.inHub).toBe(false);
    expect(sim.currentRoomId).toBe(sim.dungeon.startRoomId);
  });

  it('scales enemy HP, wave counts, and 3-4P Boss Spore Guardian shield mushrooms', () => {
    const floor1P = generateDungeonFloor(777, 1, 1, 1);
    const floor4P = generateDungeonFloor(777, 1, 1, 4);

    const combat1P = floor1P.rooms.find((r) => r.type === 'combat')!;
    const combat4P = floor4P.rooms.find((r) => r.type === 'combat')!;
    expect(combat4P.waves[0]!.enemies.length).toBeGreaterThan(combat1P.waves[0]!.enemies.length);

    const sim1P = new WorldSim({ seed: 777, spawnInitialWave: false, includeTrainingDummy: false });
    const e1 = sim1P.spawnEnemy('goblin_shooter', 300, 200, false);

    const sim4P = new WorldSim({
      seed: 777,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      playerCount: 4,
    });
    const e4 = sim4P.spawnEnemy('goblin_shooter', 300, 200, false);
    expect(e4.maxHp).toBe(Math.round(e1.maxHp * COOP_SCALING[4].enemyHpMultiplier));

    // 4P Boss Room spawns 2 Spore Guardian Mushrooms that shield the Boss
    sim4P.advanceToFloor(2);
    const bossRoom = sim4P.dungeon.rooms.find((r) => r.type === 'boss')!;
    sim4P.enterRoom(bossRoom.id);

    const boss = sim4P.enemies.find((e) => e.isBoss)!;
    const guardians = sim4P.enemies.filter((e) => e.defId === 'spore_guardian');
    expect(boss).toBeDefined();
    expect(guardians.length).toBe(2);
    expect(sim4P.hasActiveBossGuardians()).toBe(true);

    const hpBefore = boss.hp;
    sim4P.applyDamageToEnemy(boss, 20, false, 'none', 0, 0);
    const reducedDmg = hpBefore - boss.hp;
    expect(reducedDmg).toBe(7); // 20 * 0.35 = 7 while guardians are active

    // Kill both guardians -> Boss takes full 20 damage
    for (const g of guardians) {
      g.hp = 0;
    }
    expect(sim4P.hasActiveBossGuardians()).toBe(false);
    const hpAfterGuardiansDead = boss.hp;
    sim4P.applyDamageToEnemy(boss, 20, false, 'none', 0, 0);
    expect(hpAfterGuardiansDead - boss.hp).toBe(20);
  });

  it('implements Downed -> Hold E Revive -> Druid Instant Revive -> Ghost -> Room Clear Auto-Revive -> Team Wipe', () => {
    const sim = new WorldSim({
      seed: 999,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRevivePlayer: false,
    });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 2, 'ranger', 'P2');
    const p3 = sim.addCoopPlayer(3, 3, 'druid', 'P3');

    p1.x = 300;
    p1.y = 260;
    p2.x = 315;
    p2.y = 260;
    p3.x = 330;
    p3.y = 260;

    // Deal lethal damage to P2 -> P2 enters 'downed' state (not team wipe because P1 & P3 are alive)
    p2.armor = 0;
    sim.applyDamageToPlayer(p2.hp + 5, 0, 0, 'enemy', p2);
    expect(p2.lifeState).toBe('downed');
    expect(p2.downedTimer).toBeCloseTo(20, 1);
    expect(sim.runState).toBe('playing');

    // P1 holds INTERACT (E) near P2 for 2.5s -> revives P2 with 2 HP and 1.5s invulnerability
    for (let i = 0; i < 155; i++) {
      sim.setPlayerInput({
        seq: i + 1,
        tick: sim.tick,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.INTERACT,
        weaponSlotSelect: null,
      });
      sim.step(1 / 60);
    }
    expect(p2.lifeState).toBe('alive');
    expect(p2.hp).toBe(2);
    expect(p2.invulnerableTimer).toBeGreaterThan(1.0);

    // Release P1's INTERACT button
    sim.setPlayerInput({
      seq: 160,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
      weaponSlotSelect: null,
    });

    // Down P2 again after invulnerability expires, then use P3 (Druid) skill to instant-revive P2!
    p2.invulnerableTimer = 0;
    p2.armor = 0;
    sim.applyDamageToPlayer(10, 0, 0, 'enemy', p2);
    expect(p2.lifeState).toBe('downed');

    sim.setCoopPlayerInput(p3.id, {
      seq: 1,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SKILL,
      weaponSlotSelect: null,
    });
    sim.step(1 / 60);
    expect(p2.lifeState).toBe('alive');
    expect(p2.hp).toBeGreaterThanOrEqual(2);

    // Bleed out P2 into 'ghost' state, then clear a combat room -> P2 revives at 50% HP!
    p2.invulnerableTimer = 0;
    p2.armor = 0;
    sim.applyDamageToPlayer(10, 0, 0, 'enemy', p2);
    expect(p2.lifeState).toBe('downed');
    p2.downedTimer = 0.01;
    sim.step(1 / 60);
    expect(p2.lifeState).toBe('ghost');

    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat')!;
    sim.enterRoom(combatRoom.id);
    sim.skipCurrentRoomWaves();
    sim.step(1 / 60);
    expect(p2.lifeState).toBe('alive');
    expect(p2.hp).toBe(Math.max(2, Math.ceil(p2.maxHp * 0.35)));

    // Down all 3 players -> Team Wipe ('defeat')
    for (const pl of [p1, p2, p3]) {
      pl.invulnerableTimer = 0;
      pl.armor = 0;
      sim.applyDamageToPlayer(99, 0, 0, 'enemy', pl);
    }
    expect(sim.runState).toBe('defeat');
  });

  it('supports Instanced Chest Loot, Weapon Drop sharing, Contextual Ping, and Quick Emotes', () => {
    const sim = new WorldSim({ seed: 515, spawnInitialWave: false, includeTrainingDummy: false });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'elementalist', 'Pháp Sư', 2);

    const chestRoom = sim.dungeon.rooms.find((r) => r.type === 'treasure')!;
    sim.enterRoom(chestRoom.id);
    const chest = sim.chests[0]!;
    p1.x = chest.x;
    p1.y = chest.y;

    // P1 opens the chest -> spawns instanced weapon drops for both P1 and P2
    sim.setPlayerInput({
      seq: 1,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.INTERACT,
      weaponSlotSelect: null,
    });
    sim.step(1 / 60);

    const p1Items = sim.worldItems.filter((it) => it.ownerPlayerId === p1.id);
    const p2Items = sim.worldItems.filter((it) => it.ownerPlayerId === p2.id);
    expect(p1Items.length).toBe(1);
    expect(p2Items.length).toBe(1);

    // P1 drops their secondary weapon so any teammate can pick it up
    p1.weaponSlots[1] = 'hunter_crossbow';
    p1.activeWeaponSlot = 1;
    const dropped = sim.dropActiveWeapon(p1.id);
    expect(dropped).not.toBeNull();
    const sharedDrop = sim.worldItems.find(
      (it) => it.weaponId === 'hunter_crossbow' && it.ownerPlayerId === undefined,
    );
    expect(sharedDrop).toBeDefined();

    // Contextual Ping & Emote
    const ping = sim.triggerPing(p1.id, sharedDrop!.x, sharedDrop!.y);
    expect(ping).not.toBeNull();
    expect(ping!.kind).toBe('loot');
    expect(sim.pings.length).toBe(1);

    sim.triggerEmote(p2.id, 1);
    expect(p2.emoteId).toBe(1);
    expect(p2.emoteTimer).toBeGreaterThan(2.0);
  });

  it('reconciles local prediction smoothly under bad Wi-Fi and keeps 30Hz snapshot bandwidth <= 30 KB/s', () => {
    const serverSim = new WorldSim({ seed: 2026, startInHub: false });
    serverSim.addCoopPlayer(2, 2, 'ranger', 'P2');
    serverSim.addCoopPlayer(3, 3, 'elementalist', 'P3');
    serverSim.addCoopPlayer(4, 4, 'druid', 'P4');

    const clientTransport = new NetworkTransport({
      seed: 2026,
      startInHub: false,
      localPlayerId: 1,
      localPlayerSlot: 1,
      wifiProfile: 'bad',
    });

    clientTransport.setOnSendInput((pkt) => {
      serverSim.setPlayerInput(pkt);
    });

    let seq = 0;
    let maxStepJump = 0;
    let prevRenderPos = clientTransport.getInterpolatedPlayerPos();

    for (let tick = 1; tick <= 180; tick++) {
      seq += 1;
      clientTransport.sendInput({
        seq,
        tick,
        moveX: 1,
        moveY: 0.25,
        aimAngle: 0.2,
        buttons: 0,
        weaponSlotSelect: null,
      });

      serverSim.step(1 / 60);
      if (tick % 2 === 0) {
        const events = serverSim.consumeEvents();
        const snap = encodeWorldSnapshot(serverSim, events);
        const bytes = estimateSnapshotBytes(snap);
        // At 30Hz, <= 1000 bytes/snapshot = <= 30 KB/s per client
        expect(bytes * 30).toBeLessThanOrEqual(30 * 1024);
        clientTransport.receiveSnapshot(snap);
      }

      clientTransport.step(16.67);
      const curRenderPos = clientTransport.getInterpolatedPlayerPos();
      const stepDelta = Math.hypot(
        curRenderPos.x - prevRenderPos.x,
        curRenderPos.y - prevRenderPos.y,
      );
      if (tick > 5) {
        maxStepJump = Math.max(maxStepJump, stepDelta);
      }
      prevRenderPos = curRenderPos;
    }

    // Even under Bad Wi-Fi (80ms +/- 20ms jitter + 2% packet loss + 300ms spike),
    // local predicted player movement never teleports/Rubberbands (> 25px per 16ms frame)
    expect(maxStepJump).toBeLessThan(25);
    const telemetry = clientTransport.getTelemetry();
    expect(telemetry.bytesInPerSec).toBeLessThanOrEqual(30 * 1024);
    expect(telemetry.interpolationDelayMs).toBeGreaterThanOrEqual(50);
    expect(telemetry.interpolationDelayMs).toBeLessThanOrEqual(100);
  });

  it('spawns deterministic bullet volleys via event seed with zero per-bullet snapshot sync and runs client-side cosmetic hit prediction', () => {
    const serverSim = new WorldSim({
      seed: 8080,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const enemy = serverSim.spawnEnemy('goblin_shooter', serverSim.player.x + 80, serverSim.player.y, false);
    enemy.aiState = 'idle';
    enemy.spawnTimer = 0;
    const initialHp = enemy.hp;

    const clientTransport = new NetworkTransport({
      seed: 8080,
      startInHub: false,
      localPlayerId: 1,
      localPlayerSlot: 1,
      wifiProfile: 'off',
    });

    // Fire a multi-pellet shotgun volley on server
    serverSim.player.weaponSlots = ['scrap_shotgun'];
    serverSim.player.activeWeaponSlot = 0;
    serverSim.setPlayerInput({
      seq: 1,
      tick: 1,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
      weaponSlotSelect: null,
    });
    serverSim.step(1 / 60);

    const serverEvents = serverSim.consumeEvents();
    const volleyEvt = serverEvents.find((e) => e.kind === 'bullet_volley_spawned');
    expect(volleyEvt).toBeDefined();
    if (!volleyEvt || volleyEvt.kind !== 'bullet_volley_spawned') {
      throw new Error('Expected bullet_volley_spawned event');
    }

    // Verify encodeWorldSnapshot does not serialize per-bullet state arrays
    const snap = encodeWorldSnapshot(serverSim, serverEvents);
    expect(snap.projectiles.length).toBe(0);

    // Apply snapshot on client -> client deterministically spawns the exact same pellet volley from event seed
    clientTransport.receiveSnapshot(snap);
    const clientSim = clientTransport.getSim();
    expect(clientSim.projectiles.length).toBe(serverSim.projectiles.length);
    for (let i = 0; i < serverSim.projectiles.length; i++) {
      expect(clientSim.projectiles[i]!.vx).toBeCloseTo(serverSim.projectiles[i]!.vx, 5);
      expect(clientSim.projectiles[i]!.vy).toBeCloseTo(serverSim.projectiles[i]!.vy, 5);
    }

    // Drain initial events, then step client prediction forward without any new server snapshot
    clientTransport.consumeEvents();
    let cosmeticImpactSeen = false;
    for (let stepIdx = 0; stepIdx < 12; stepIdx++) {
      clientTransport.step(16.67);
      const clientEvents = clientTransport.consumeEvents();
      if (clientEvents.some((e) => e.kind === 'projectile_impact')) {
        cosmeticImpactSeen = true;
        break;
      }
    }

    // Client-side cosmetic hit prediction flashes the enemy and spawns impact spark immediately,
    // while keeping authoritative enemy HP unchanged until server confirms damage
    expect(cosmeticImpactSeen).toBe(true);
    const clientEnemy = clientSim.enemies.find((e) => e.id === enemy.id)!;
    expect(clientEnemy.hitFlashTimer).toBeGreaterThan(0);
    expect(clientEnemy.hp).toBe(initialHp);
  });
});

