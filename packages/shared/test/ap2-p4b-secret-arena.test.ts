import { describe, expect, it } from 'vitest';
import {
  I18nManager,
  MAX_TACTICAL_PROPS_PER_ROOM,
  NetworkTransport,
  SECRET_ARENA_BARREL_COUNT,
  SECRET_ARENA_BARRICADE_COUNT,
  SECRET_ARENA_DURATION_SEC,
  SECRET_ARENA_VICTORY_GOLD,
  WEAPONS,
  WorldSim,
  activateSecretChallengeCrystal,
  collectLeafKeys,
  distance,
  enLocale,
  encodeWorldSnapshot,
  findInteractTarget,
  isFlippableBarricadeProp,
  resetSecretSkillArenaState,
  spawnSecretChallengeCrystal,
  updateSecretSkillArena,
  viLocale,
} from '../src/index.js';

function enterUnlockedSecretRoom(sim: WorldSim): number {
  const secretRoom = sim.dungeon.rooms[sim.dungeon.secretRoomId]!;
  const parentId = secretRoom.connections[secretRoom.secretWallDir!]!;
  const parentRoom = sim.dungeon.rooms[parentId]!;
  sim.secretWallBroken = true;
  parentRoom.secretWallBroken = true;
  secretRoom.secretWallBroken = true;
  secretRoom.discovery = 'discovered';
  expect(sim.enterRoom(secretRoom.id, parentRoom.secretWallDir)).toBe(true);
  sim.consumeEvents();
  return secretRoom.id;
}

describe('AP2 Phase P4B.2 — 20s Secret Skill Arena Challenge & Legendary Chest Ascension', () => {
  it('1. populates secret room with Rare/Epic chest, +30G gold clusters, and an uninteracted secret_challenge_crystal recognized by findInteractTarget + bilingual vi/en i18n keys', () => {
    expect(SECRET_ARENA_DURATION_SEC).toBe(20.0);
    expect(SECRET_ARENA_VICTORY_GOLD).toBe(40);
    expect(SECRET_ARENA_BARRICADE_COUNT).toBe(4);
    expect(SECRET_ARENA_BARREL_COUNT).toBe(2);
    expect(typeof spawnSecretChallengeCrystal).toBe('function');
    expect(typeof activateSecretChallengeCrystal).toBe('function');
    expect(typeof updateSecretSkillArena).toBe('function');
    expect(typeof resetSecretSkillArenaState).toBe('function');

    // Bilingual i18n leaf-key parity & non-raw translations
    expect(collectLeafKeys(viLocale).sort()).toEqual(collectLeafKeys(enLocale).sort());
    const viI18n = new I18nManager('vi');
    const enI18n = new I18nManager('en');
    const requiredKeys = [
      'interact.secretChallengeCrystal',
      'hud.secretTrial.title',
      'hud.secretTrial.countdown',
      'hud.secretTrial.urgent',
      'hud.secretTrial.victoryBanner',
      'hud.secretTrial.expiredBanner',
    ];
    for (const key of requiredKeys) {
      expect(viI18n.hasKey(key, 'vi')).toBe(true);
      expect(enI18n.hasKey(key, 'en')).toBe(true);
      expect(viI18n.t(key)).not.toBe(key);
      expect(enI18n.t(key)).not.toBe(key);
    }

    const sim = new WorldSim({
      seed: 420201,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });
    enterUnlockedSecretRoom(sim);

    expect(sim.secretTrialActive).toBe(false);
    expect(sim.secretTrialTimer).toBe(0);
    expect(sim.secretTrialResult).toBe('idle');
    expect(sim.secretTrialRemainingEnemies).toBe(0);

    expect(sim.chests).toHaveLength(1);
    expect(['rare', 'epic']).toContain(sim.chests[0]!.rarity);
    expect(sim.chests[0]!.opened).toBe(false);

    const goldPickups = sim.pickups.filter((pk) => pk.kind === 'gold');
    expect(goldPickups).toHaveLength(2);
    expect(goldPickups.reduce((sum, pk) => sum + pk.amount, 0)).toBe(30);

    const crystals = sim.npcEntities.filter((n) => n.kind === 'secret_challenge_crystal');
    expect(crystals).toHaveLength(1);
    const crystal = crystals[0]!;
    expect(crystal.interacted).toBe(false);

    // Move player right beside the crystal (even while chest is unopened!) -> findInteractTarget selects secret_challenge_crystal
    sim.player.x = crystal.x;
    sim.player.y = crystal.y + 10;
    const target = findInteractTarget(sim, sim.player.id);
    expect(target).not.toBeNull();
    expect(target?.kind).toBe('secret_challenge_crystal');
    if (target?.kind === 'secret_challenge_crystal') {
      expect(target.npc.id).toBe(crystal.id);
    }
  });

  it('2. activates secret_challenge_crystal with [E]: locks doors & chest mid-fight, starts 20.0s timer, spawns 1 Elite wave (all secretTrialEnemy) + 4 biome barricades + 2 explosive barrels within MAX_TACTICAL_PROPS_PER_ROOM = 16', () => {
    const expectedBarricadeByBiome: Record<1 | 2 | 3, string> = {
      1: 'moss_table',
      2: 'glacial_barricade',
      3: 'forge_blast_shield',
    };

    for (const biome of [1, 2, 3] as const) {
      const sim = new WorldSim({
        seed: 420210 + biome,
        biome,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        autoRespawnWaves: false,
      });
      const secretRoomId = enterUnlockedSecretRoom(sim);

      // Pre-fill extra destructible crates to verify MAX_TACTICAL_PROPS_PER_ROOM = 16 cap is strictly respected
      for (let i = 0; i < 10; i++) {
        sim.spawnProp('wooden_crate', 220 + i * 24, 150);
      }

      const crystal = sim.npcEntities.find((n) => n.kind === 'secret_challenge_crystal')!;
      const chest = sim.chests[0]!;
      expect(sim.doors.length).toBeGreaterThan(0);
      expect(sim.doors.every((d) => !d.locked)).toBe(true);

      sim.player.x = crystal.x;
      sim.player.y = crystal.y + 8;
      expect(sim.interactWithNearest(sim.player)).toBe(true);

      // Cannot re-trigger once activated
      expect(crystal.interacted).toBe(true);
      expect(activateSecretChallengeCrystal(sim, crystal, sim.player)).toBe(false);

      expect(sim.secretTrialActive).toBe(true);
      expect(sim.secretTrialTimer).toBe(20.0);
      expect(sim.secretTrialResult).toBe('active');
      expect(sim.doors.every((d) => d.locked)).toBe(true);

      const startedEv = sim.consumeEvents().find((e) => e.kind === 'secret_trial_started');
      expect(startedEv).toBeDefined();
      if (startedEv?.kind === 'secret_trial_started') {
        expect(startedEv.roomId).toBe(secretRoomId);
        expect(startedEv.durationSec).toBe(20.0);
      }

      const combatEnemies = sim.enemies.filter((e) => !e.isDummy && e.hp > 0);
      expect(combatEnemies.length).toBeGreaterThanOrEqual(3);
      expect(combatEnemies.some((e) => e.isElite)).toBe(true);
      expect(combatEnemies.every((e) => e.secretTrialEnemy === true)).toBe(true);
      expect(sim.secretTrialRemainingEnemies).toBe(combatEnemies.length);

      expect(sim.props.length).toBeLessThanOrEqual(MAX_TACTICAL_PROPS_PER_ROOM);
      const barricades = sim.props.filter(
        (p) => p.hp > 0 && isFlippableBarricadeProp(p.kind) && p.coverState === 'low',
      );
      const barrels = sim.props.filter((p) => p.hp > 0 && p.kind === 'explosive_barrel');
      expect(barricades).toHaveLength(SECRET_ARENA_BARRICADE_COUNT);
      expect(barricades.every((p) => p.kind === expectedBarricadeByBiome[biome])).toBe(true);
      expect(barrels).toHaveLength(SECRET_ARENA_BARREL_COUNT);

      // Ruling 2: Chest is locked while secretTrialActive === true so [E] near chest flips barricades instead of opening chest
      expect(sim.openChest(chest)).toBe(false);
      expect(chest.opened).toBe(false);

      // Stand right on top of chest (out of barricade 52px range) -> chest must NOT be targetable mid-trial
      sim.player.x = chest.x;
      sim.player.y = chest.y;
      const onChestTarget = findInteractTarget(sim, sim.player.id);
      expect(onChestTarget?.kind).not.toBe('chest');

      // Place a 'low' barricade 30px from chest and player right between them -> [E] flips barricade, chest stays closed!
      const nearBarricade = barricades[0]!;
      nearBarricade.x = chest.x + 30;
      nearBarricade.y = chest.y;
      sim.player.x = chest.x + 12;
      sim.player.y = chest.y;
      const coverTarget = findInteractTarget(sim, sim.player.id);
      expect(coverTarget?.kind).toBe('flip_cover');
      expect(sim.interactWithNearest(sim.player)).toBe(true);
      expect(nearBarricade.coverState).toBe('flipped');
      expect(chest.opened).toBe(false);
    }
  });

  it('3. ascends unopened secret chest to 100% guaranteed Legendary and awards +40 Gold instanced per player upon < 20.0s victory (Solo & 2P Co-op)', () => {
    for (const coop2P of [false, true]) {
      const sim = new WorldSim({
        seed: coop2P ? 420302 : 420301,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        autoRespawnWaves: false,
      });
      const p1 = sim.player;
      const p2 = coop2P ? sim.addCoopPlayer(2, 'ranger', 'Ranger P2', 2) : null;
      const secretRoomId = enterUnlockedSecretRoom(sim);
      const room = sim.getCurrentRoom();

      // Clear ground gold clusters so pickup magnet doesn't muddy the exact +40G victory reward assertion
      sim.pickups.length = 0;

      const chest = sim.chests[0]!;
      expect(['rare', 'epic']).toContain(chest.rarity);
      const crystal = sim.npcEntities.find((n) => n.kind === 'secret_challenge_crystal')!;
      p1.x = crystal.x;
      p1.y = crystal.y + 8;
      expect(sim.interactWithNearest(p1)).toBe(true);
      sim.consumeEvents();

      // Advance 3.0s (180 ticks) so secretTrialTimer is ~17.0s (> 0)
      for (let t = 0; t < 180; t++) {
        sim.step(1 / 60);
      }
      expect(sim.secretTrialActive).toBe(true);
      expect(sim.secretTrialTimer).toBeGreaterThan(16.5);

      // Defeat all but the last trial enemy, clear dropped kill gold pickups, then slay the final enemy
      const trialEnemies = sim.enemies.filter((e) => e.secretTrialEnemy && e.hp > 0);
      for (let i = 0; i < trialEnemies.length - 1; i++) {
        const e = trialEnemies[i]!;
        e.shieldArmor = 0;
        sim.applyDamageToEnemy(e, e.hp + 999, true, 'none', 0, 0, true, p1.id);
      }
      sim.step(1 / 60);
      expect(sim.secretTrialActive).toBe(true);
      expect(sim.secretTrialRemainingEnemies).toBe(1);

      const lastEnemy = sim.enemies.find((e) => e.secretTrialEnemy && e.hp > 0)!;
      lastEnemy.shieldArmor = 0;
      p1.gold = 100;
      if (p2) p2.gold = 100;
      const runGoldBefore = sim.runStats.goldEarned;
      sim.consumeEvents();

      sim.applyDamageToEnemy(lastEnemy, lastEnemy.hp + 999, true, 'none', 0, 0, true, p1.id);
      // Remove any kill-drop gold pickups before stepping so only the direct +40G trial victory bonus changes pl.gold
      sim.pickups.length = 0;
      sim.step(1 / 60);

      expect(sim.secretTrialActive).toBe(false);
      expect(sim.secretTrialResult).toBe('victory');
      expect(sim.secretTrialBannerTimer).toBeGreaterThan(0);
      expect(sim.secretTrialRemainingEnemies).toBe(0);
      expect(room.secretTrialAttempted).toBe(true);
      expect(room.secretTrialWon).toBe(true);
      expect(sim.doors.every((d) => !d.locked)).toBe(true);

      // +40 Gold instanced per player
      expect(p1.gold).toBe(100 + SECRET_ARENA_VICTORY_GOLD);
      if (p2) {
        expect(p2.gold).toBe(100 + SECRET_ARENA_VICTORY_GOLD);
        expect(sim.runStats.goldEarned).toBe(runGoldBefore + SECRET_ARENA_VICTORY_GOLD * 2);
      } else {
        expect(sim.runStats.goldEarned).toBe(runGoldBefore + SECRET_ARENA_VICTORY_GOLD);
      }

      const resolvedEv = sim.consumeEvents().find((e) => e.kind === 'secret_trial_resolved');
      expect(resolvedEv).toBeDefined();
      if (resolvedEv?.kind === 'secret_trial_resolved') {
        expect(resolvedEv.roomId).toBe(secretRoomId);
        expect(resolvedEv.victory).toBe(true);
        expect(resolvedEv.bonusGold).toBe(SECRET_ARENA_VICTORY_GOLD);
      }

      // 100% guaranteed Legendary chest ascension!
      expect(chest.opened).toBe(false);
      expect(chest.rarity).toBe('legendary');
      expect(room.chestRarity).toBe('legendary');
      expect(WEAPONS[chest.droppedWeaponId]?.rarity).toBe('legendary');

      // Now chest is unlocked and drops instanced Legendary weapon(s)
      expect(sim.openChest(chest)).toBe(true);
      const legendaryDrops = sim.worldItems.filter(
        (it) => it.kind === 'weapon' && !it.pickedUp && it.rarity === 'legendary',
      );
      expect(legendaryDrops).toHaveLength(coop2P ? 2 : 1);
      for (const drop of legendaryDrops) {
        expect(WEAPONS[drop.weaponId!]?.rarity).toBe('legendary');
      }
    }
  });

  it('4. spawns instanced Legendary world weapon drop(s) + +40 Gold when player already opened the Rare/Epic chest BEFORE activating secret_challenge_crystal (Review Focus #5b)', () => {
    const sim = new WorldSim({
      seed: 420401,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'elementalist', 'Elem P2', 2);
    enterUnlockedSecretRoom(sim);

    const chest = sim.chests[0]!;
    expect(['rare', 'epic']).toContain(chest.rarity);

    // Players open the Rare/Epic chest FIRST before touching the crystal
    expect(sim.openChest(chest)).toBe(true);
    expect(chest.opened).toBe(true);
    sim.worldItems.length = 0;
    sim.pickups.length = 0;

    // Now activate secret_challenge_crystal and clear the Elite wave in < 20.0s
    const crystal = sim.npcEntities.find((n) => n.kind === 'secret_challenge_crystal')!;
    p1.x = crystal.x;
    p1.y = crystal.y + 24;
    expect(activateSecretChallengeCrystal(sim, crystal, p1)).toBe(true);

    p1.gold = 50;
    p2.gold = 50;
    for (const e of [...sim.enemies]) {
      if (e.secretTrialEnemy && e.hp > 0) {
        e.shieldArmor = 0;
        sim.applyDamageToEnemy(e, e.hp + 999, true, 'none', 0, 0, true, p1.id);
      }
    }
    sim.pickups.length = 0;
    sim.step(1 / 60);

    expect(sim.secretTrialActive).toBe(false);
    expect(sim.secretTrialResult).toBe('victory');
    expect(chest.rarity).toBe('legendary');
    expect(p1.gold).toBe(50 + SECRET_ARENA_VICTORY_GOLD);
    expect(p2.gold).toBe(50 + SECRET_ARENA_VICTORY_GOLD);

    // Instanced Legendary weapon drops spawned for both P1 and P2 at (chest.x + offsetX, chest.y + 28)
    const legendaryDrops = sim.worldItems.filter(
      (it) => it.kind === 'weapon' && !it.pickedUp && it.rarity === 'legendary',
    );
    expect(legendaryDrops).toHaveLength(2);
    expect(legendaryDrops.some((it) => it.ownerPlayerId === p1.id)).toBe(true);
    expect(legendaryDrops.some((it) => it.ownerPlayerId === p2.id)).toBe(true);
    for (const drop of legendaryDrops) {
      expect(WEAPONS[drop.weaponId!]?.rarity).toBe('legendary');
      expect(distance(drop.x, drop.y, chest.x, chest.y + 28)).toBeLessThanOrEqual(40);
    }
  });

  it('5. harmlessly vanishes remaining secretTrialEnemy (including spore_bomber & vengeful Elite) and enemy projectiles on 20.0s timeout with 0 player damage, 0 free gold, and preserves original Rare/Epic chest (Review Focus #5a)', () => {
    const sim = new WorldSim({
      seed: 420501,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });
    const p1 = sim.player;
    const secretRoomId = enterUnlockedSecretRoom(sim);
    sim.pickups.length = 0;

    const chest = sim.chests[0]!;
    const originalRarity = chest.rarity;
    const originalWeaponId = chest.droppedWeaponId;
    expect(['rare', 'epic']).toContain(originalRarity);

    const crystal = sim.npcEntities.find((n) => n.kind === 'secret_challenge_crystal')!;
    p1.x = crystal.x;
    p1.y = crystal.y + 24;
    expect(activateSecretChallengeCrystal(sim, crystal, p1)).toBe(true);

    // Ensure a spore_bomber and a vengeful Elite are present among secretTrialEnemy
    const bomber = sim.spawnEnemy('spore_bomber', p1.x + 220, p1.y, true);
    bomber.secretTrialEnemy = true;
    const vengefulElite = sim.spawnEnemy('goblin_shooter', p1.x - 220, p1.y, true, 'vengeful');
    vengefulElite.secretTrialEnemy = true;

    // Keep enemies stunned for 19.95s (1197 ticks) so timer counts down near 0 without killing player early
    for (let t = 0; t < 1197; t++) {
      for (const e of sim.enemies) {
        e.stunTimer = 5.0;
      }
      sim.step(1 / 60);
    }
    expect(sim.secretTrialActive).toBe(true);
    expect(sim.secretTrialTimer).toBeGreaterThan(0);
    expect(sim.secretTrialTimer).toBeLessThanOrEqual(0.1);

    // Right before 20.0s expiry: place spore_bomber & vengefulElite directly next to player AND fire an enemy projectile!
    bomber.x = p1.x + 18;
    bomber.y = p1.y;
    bomber.stunTimer = 5.0;
    vengefulElite.x = p1.x - 18;
    vengefulElite.y = p1.y;
    vengefulElite.stunTimer = 5.0;

    const enemyBullet = sim.acquireProjectile({
      id: ++sim.nextEntityId,
      ownerId: vengefulElite.id,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: p1.x,
      y: p1.y - 44,
      vx: 0,
      vy: 60,
      angle: Math.PI * 0.5,
      radius: 5,
      damage: 2,
      isCrit: false,
      knockback: 20,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 3.0,
      element: 'none',
      amplifiedByShield: false,
    });
    sim.projectiles.push(enemyBullet);

    p1.hp = p1.maxHp;
    p1.armor = p1.maxArmor;
    p1.invulnerableTimer = 0;
    p1.gold = 75;
    const killsBefore = sim.runStats.kills;
    const goldEarnedBefore = sim.runStats.goldEarned;
    sim.pickups.length = 0;
    sim.consumeEvents();

    // Step remaining ticks past 20.0s timeout
    for (let t = 0; t < 5; t++) {
      sim.step(1 / 60);
    }

    expect(sim.secretTrialActive).toBe(false);
    expect(sim.secretTrialTimer).toBe(0);
    expect(sim.secretTrialResult).toBe('expired');
    expect(sim.secretTrialRemainingEnemies).toBe(0);

    // 0 trial enemies remain, 0 enemy projectiles remain, 0 damage to player, 0 kill gold awarded!
    expect(sim.enemies.filter((e) => !e.isDummy)).toHaveLength(0);
    expect(sim.projectiles.filter((b) => b.team === 'enemy')).toHaveLength(0);
    expect(sim.pendingVengefulRings).toHaveLength(0);
    expect(p1.hp).toBe(p1.maxHp);
    expect(p1.armor).toBe(p1.maxArmor);
    expect(p1.gold).toBe(75);
    expect(sim.runStats.kills).toBe(killsBefore);
    expect(sim.runStats.goldEarned).toBe(goldEarnedBefore);
    expect(sim.pickups).toHaveLength(0);

    const events = sim.consumeEvents();
    expect(events.some((e) => e.kind === 'explosion')).toBe(false);
    expect(events.some((e) => e.kind === 'vengeful_telegraph')).toBe(false);
    expect(
      events.some(
        (e) => e.kind === 'projectiles_destroyed' && e.ids.includes(enemyBullet.id),
      ),
    ).toBe(true);
    const resolvedEv = events.find((e) => e.kind === 'secret_trial_resolved');
    expect(resolvedEv).toBeDefined();
    if (resolvedEv?.kind === 'secret_trial_resolved') {
      expect(resolvedEv.roomId).toBe(secretRoomId);
      expect(resolvedEv.victory).toBe(false);
      expect(resolvedEv.bonusGold).toBe(0);
    }

    // Doors unlock and original Rare/Epic chest opens normally!
    expect(sim.doors.every((d) => !d.locked)).toBe(true);
    expect(chest.rarity).toBe(originalRarity);
    expect(chest.droppedWeaponId).toBe(originalWeaponId);
    expect(chest.opened).toBe(false);
    expect(sim.openChest(chest)).toBe(true);
    expect(chest.opened).toBe(true);
  });

  it('6. synchronizes secretTrialActive, secretTrialTimer, secretTrialResult, and secretTrialRemainingEnemies via encodeWorldSnapshot -> NetworkTransport client and resets cleanly on room transition', () => {
    const serverSim = new WorldSim({
      seed: 420601,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });
    const clientTransport = new NetworkTransport({
      seed: 420601,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      localPlayerId: serverSim.player.id,
      localPlayerSlot: serverSim.player.slot,
      wifiProfile: 'off',
    });
    const clientSim = clientTransport.getSim();

    const secretRoomId = enterUnlockedSecretRoom(serverSim);
    const crystal = serverSim.npcEntities.find((n) => n.kind === 'secret_challenge_crystal')!;
    expect(activateSecretChallengeCrystal(serverSim, crystal, serverSim.player)).toBe(true);

    // Step server a few ticks and send authoritative snapshot to NetworkTransport client
    for (let i = 0; i < 6; i++) {
      for (const e of serverSim.enemies) e.stunTimer = 5.0;
      serverSim.step(1 / 60);
    }

    const snap = encodeWorldSnapshot(serverSim, serverSim.consumeEvents(), false, 1000);
    expect(snap.secretTrialActive).toBe(true);
    expect(snap.secretTrialResult).toBe('active');
    expect(snap.secretTrialTimer100).toBe(Math.round(serverSim.secretTrialTimer * 100));
    expect(snap.secretTrialRemaining).toBe(serverSim.secretTrialRemainingEnemies);

    clientTransport.receiveSnapshot(snap);

    expect(clientSim.currentRoomId).toBe(secretRoomId);
    expect(clientSim.secretTrialActive).toBe(true);
    expect(clientSim.secretTrialResult).toBe('active');
    expect(clientSim.secretTrialTimer).toBeCloseTo(serverSim.secretTrialTimer, 1);
    expect(clientSim.secretTrialRemainingEnemies).toBe(serverSim.secretTrialRemainingEnemies);
    expect(
      clientSim.npcEntities.find((n) => n.kind === 'secret_challenge_crystal')?.interacted,
    ).toBe(true);

    // Force victory on server and verify sync to client
    for (const e of [...serverSim.enemies]) {
      if (e.secretTrialEnemy && e.hp > 0) {
        e.shieldArmor = 0;
        serverSim.applyDamageToEnemy(e, e.hp + 999, true, 'none', 0, 0, true, serverSim.player.id);
      }
    }
    serverSim.step(1 / 60);
    clientTransport.receiveSnapshot(
      encodeWorldSnapshot(serverSim, serverSim.consumeEvents(), false, 1060),
    );

    expect(clientSim.secretTrialActive).toBe(false);
    expect(clientSim.secretTrialResult).toBe('victory');
    expect(clientSim.secretTrialRemainingEnemies).toBe(0);
    expect(clientSim.secretTrialBannerTimer).toBeGreaterThan(0);
    expect(clientSim.chests[0]?.rarity).toBe('legendary');

    // Leaving room resets transient arena state while remembering room.secretTrialAttempted
    const exitDoor = serverSim.doors[0]!;
    expect(serverSim.enterRoom(exitDoor.targetRoomId, exitDoor.dir)).toBe(true);
    expect(serverSim.secretTrialActive).toBe(false);
    expect(serverSim.secretTrialTimer).toBe(0);
    expect(serverSim.secretTrialResult).toBe('idle');
    expect(serverSim.secretTrialBannerTimer).toBe(0);
    expect(serverSim.secretTrialRemainingEnemies).toBe(0);

    // Re-entering secret room keeps crystal interacted (cannot farm trial)
    expect(serverSim.enterRoom(secretRoomId)).toBe(true);
    const crystalOnReturn = serverSim.npcEntities.find((n) => n.kind === 'secret_challenge_crystal')!;
    expect(crystalOnReturn.interacted).toBe(true);
    expect(activateSecretChallengeCrystal(serverSim, crystalOnReturn, serverSim.player)).toBe(false);
  });
});
