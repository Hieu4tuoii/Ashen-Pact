import { describe, expect, it } from 'vitest';
import {
  OPPOSITE_DIR,
  TILE_SIZE,
  WorldSim,
  generateDungeonFloor,
  tryBreakCrackedWallNearImpact,
  verifyDungeonConnectivity,
} from '../src/index.js';

describe('AP2 Phase P2A.1 — Dynamic Odd/Even Dungeon Graph & Cracked Wall Secret Rooms', () => {
  it('validates 1,000 consecutive seeds for Odd floors (localFloor=1) and Even floors (localFloor=2) across all 3 Biomes', () => {
    const parentTypesSeen = new Set<string>();
    const wallDirsSeen = new Set<string>();
    let nonNorthStartSecretCount = 0;

    for (let s = 1; s <= 1000; s++) {
      const biome = (((s - 1) % 3) + 1) as 1 | 2 | 3;

      // 1. Odd Floor (floorNumber = 1)
      const oddFloor = generateDungeonFloor(s, 1, biome, 1);
      const vOdd = verifyDungeonConnectivity(oddFloor);
      expect(vOdd.valid).toBe(true);
      expect(vOdd.totalRooms).toBe(10);
      expect(vOdd.reachableCount).toBe(10);
      expect(vOdd.bidirectionalLinks).toBe(true);
      expect(vOdd.hasAllRoomTypes).toBe(true);

      const oddStart = oddFloor.rooms.filter((r) => r.type === 'start');
      const oddShrine = oddFloor.rooms.filter((r) => r.type === 'shrine');
      const oddCombat = oddFloor.rooms.filter((r) => r.type === 'combat');
      const oddChallenge = oddCombat.filter((r) => r.isChallenge);
      const oddNormalCombat = oddCombat.filter((r) => !r.isChallenge);
      const oddTreasure = oddFloor.rooms.filter((r) => r.type === 'treasure');
      const oddMerchant = oddFloor.rooms.filter((r) => r.type === 'merchant');
      const oddPortal = oddFloor.rooms.filter((r) => r.type === 'portal');
      const oddSecret = oddFloor.rooms.filter((r) => r.type === 'secret');

      expect(oddStart.length).toBe(1);
      expect(oddShrine.length).toBe(1);
      expect(oddShrine[0]!.distanceFromStart).toBe(1);
      expect(Object.values(oddStart[0]!.connections)).toContain(oddShrine[0]!.id);
      expect(oddCombat.length).toBe(4);
      expect(oddNormalCombat.length).toBe(3);
      expect(oddChallenge.length).toBe(1);
      expect(oddTreasure.length).toBe(1);
      expect(oddMerchant.length).toBe(1);
      expect(oddPortal.length).toBe(1);
      expect(oddSecret.length).toBe(1);

      const secretRoomOdd = oddSecret[0]!;
      expect(oddFloor.secretRoomId).toBe(secretRoomOdd.id);
      expect(secretRoomOdd.secretWallDir).toBeDefined();
      const parentIdOdd = secretRoomOdd.connections[secretRoomOdd.secretWallDir!];
      expect(parentIdOdd).toBeDefined();
      const parentOdd = oddFloor.rooms[parentIdOdd!]!;
      expect(parentOdd.secretWallDir).toBe(OPPOSITE_DIR[secretRoomOdd.secretWallDir!]);
      expect(parentOdd.connections[parentOdd.secretWallDir!]).toBe(secretRoomOdd.id);
      expect(['treasure', 'merchant', 'combat']).toContain(parentOdd.type);
      if (parentOdd.type === 'combat') {
        const nonSecretConns = Object.values(parentOdd.connections).filter(
          (id) => id !== undefined && id !== secretRoomOdd.id,
        );
        expect(nonSecretConns.length).toBe(1);
      }
      parentTypesSeen.add(parentOdd.type);
      wallDirsSeen.add(parentOdd.secretWallDir!);
      if (!(parentOdd.id === 0 && secretRoomOdd.gx === 3 && secretRoomOdd.gy === 2)) {
        nonNorthStartSecretCount += 1;
      }

      // 2. Even Floor (floorNumber = 2)
      const evenFloor = generateDungeonFloor(s, 2, biome, 1);
      const vEven = verifyDungeonConnectivity(evenFloor);
      expect(vEven.valid).toBe(true);
      expect(vEven.totalRooms).toBe(10);
      expect(vEven.reachableCount).toBe(10);
      expect(vEven.bidirectionalLinks).toBe(true);
      expect(vEven.hasAllRoomTypes).toBe(true);

      expect(evenFloor.rooms.some((r) => r.type === 'shrine')).toBe(false);
      const evenStart = evenFloor.rooms.filter((r) => r.type === 'start');
      const evenCombat = evenFloor.rooms.filter((r) => r.type === 'combat');
      const evenChallenge = evenCombat.filter((r) => r.isChallenge);
      const evenNormalCombat = evenCombat.filter((r) => !r.isChallenge);
      const evenTreasure = evenFloor.rooms.filter((r) => r.type === 'treasure');
      const evenMerchant = evenFloor.rooms.filter((r) => r.type === 'merchant');
      const evenBoss = evenFloor.rooms.filter((r) => r.type === 'boss');
      const evenSecret = evenFloor.rooms.filter((r) => r.type === 'secret');

      expect(evenStart.length).toBe(1);
      expect(evenCombat.length).toBe(5);
      expect(evenNormalCombat.length).toBe(4);
      expect(evenChallenge.length).toBe(1);
      expect(evenTreasure.length).toBe(1);
      expect(evenMerchant.length).toBe(1);
      expect(evenBoss.length).toBe(1);
      expect(evenSecret.length).toBe(1);

      const secretRoomEven = evenSecret[0]!;
      expect(evenFloor.secretRoomId).toBe(secretRoomEven.id);
      expect(secretRoomEven.secretWallDir).toBeDefined();
      const parentIdEven = secretRoomEven.connections[secretRoomEven.secretWallDir!];
      expect(parentIdEven).toBeDefined();
      const parentEven = evenFloor.rooms[parentIdEven!]!;
      expect(parentEven.secretWallDir).toBe(OPPOSITE_DIR[secretRoomEven.secretWallDir!]);
      expect(['treasure', 'merchant', 'combat']).toContain(parentEven.type);
    }

    expect(nonNorthStartSecretCount).toBe(1000);
    expect(parentTypesSeen.has('treasure')).toBe(true);
    expect(parentTypesSeen.has('merchant')).toBe(true);
    expect(parentTypesSeen.has('combat')).toBe(true);
    expect(wallDirsSeen.size).toBe(4);
  });

  it('breaks cracked_wall via Dash-Kick sliding cover prop and unlocks the Secret Room with 1 Rare/Epic chest + 2 Gold Crystal clusters (+30G instanced)', () => {
    const sim = new WorldSim({
      seed: 202610,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Liệp Ưng P2', 2);

    const secretRoom = sim.dungeon.rooms[sim.dungeon.secretRoomId]!;
    expect(secretRoom.type).toBe('secret');
    const parentId = secretRoom.connections[secretRoom.secretWallDir!]!;
    const parentRoom = sim.dungeon.rooms[parentId]!;
    const wallDir = parentRoom.secretWallDir!;

    sim.enterRoom(parentRoom.id);
    if (sim.hasActiveCombatEnemies()) {
      sim.skipCurrentRoomWaves();
    }

    const cwTile = sim.map.getCrackedWallTileForDir(wallDir);
    expect(sim.map.getTile(cwTile.tx, cwTile.ty)).toBe('cracked_wall');

    const secretDoorBefore = sim.doors.find((d) => d.targetRoomId === secretRoom.id)!;
    expect(secretDoorBefore).toBeDefined();
    expect(secretDoorBefore.isSecretPassage).toBe(true);
    expect(secretDoorBefore.locked).toBe(true);

    // Spawn or locate a flippable barricade near the cracked wall, flip it, and Dash-Kick it into the cracked wall
    const wallWorldX = cwTile.tx * TILE_SIZE + 16;
    const wallWorldY = cwTile.ty * TILE_SIZE + 16;
    const inwardX =
      wallDir === 'W' ? wallWorldX + 96 : wallDir === 'E' ? wallWorldX - 96 : wallWorldX;
    const inwardY =
      wallDir === 'N' ? wallWorldY + 96 : wallDir === 'S' ? wallWorldY - 96 : wallWorldY;

    const table = sim.spawnProp('moss_table', inwardX, inwardY);
    expect(sim.flipCoverProp(table, p1)).toBe(true);
    const angleToWall = Math.atan2(wallWorldY - table.y, wallWorldX - table.x);
    expect(sim.kickProp(table, p1, angleToWall)).toBe(true);

    let brokenEventSeen = false;
    for (let i = 0; i < 30; i++) {
      sim.step(1 / 60);
      if (sim.events.some((ev) => ev.kind === 'cracked_wall_broken')) {
        brokenEventSeen = true;
      }
      if (sim.secretWallBroken) break;
    }

    expect(brokenEventSeen).toBe(true);
    expect(sim.secretWallBroken).toBe(true);
    expect(parentRoom.secretWallBroken).toBe(true);
    expect(secretRoom.secretWallBroken).toBe(true);
    expect(secretRoom.discovery).toBe('discovered');
    expect(sim.map.getTile(cwTile.tx, cwTile.ty)).toBe('floor');

    const secretDoorAfter = sim.doors.find((d) => d.targetRoomId === secretRoom.id)!;
    expect(secretDoorAfter.locked).toBe(false);

    // Enter Secret Room and verify 1 Rare/Epic weapon chest + 2 Gold Crystal clusters (+30 Gold instanced per player)
    expect(sim.enterRoom(secretRoom.id, wallDir)).toBe(true);
    expect(sim.chests.length).toBe(1);
    expect(['rare', 'epic']).toContain(sim.chests[0]!.rarity);

    const p1Clusters = sim.pickups.filter((pk) => pk.kind === 'gold' && pk.ownerPlayerId === p1.id);
    const p2Clusters = sim.pickups.filter((pk) => pk.kind === 'gold' && pk.ownerPlayerId === p2.id);
    expect(p1Clusters.length).toBe(2);
    expect(p2Clusters.length).toBe(2);
    expect(p1Clusters.reduce((sum, pk) => sum + pk.amount, 0)).toBe(30);
    expect(p2Clusters.reduce((sum, pk) => sum + pk.amount, 0)).toBe(30);

    const p1GoldBefore = p1.gold;
    const p2GoldBefore = p2.gold;
    for (const pk of p1Clusters) {
      pk.x = p1.x;
      pk.y = p1.y;
    }
    for (const pk of p2Clusters) {
      pk.x = p2.x;
      pk.y = p2.y;
    }
    sim.updatePickups(1 / 60);
    expect(p1.gold).toBe(p1GoldBefore + 30);
    expect(p2.gold).toBe(p2GoldBefore + 30);
  });

  it('breaks cracked_wall via enemy Wall-Slam impact and tryBreakCrackedWallNearImpact', () => {
    const sim = new WorldSim({
      seed: 202611,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });
    const secretRoom = sim.dungeon.rooms[sim.dungeon.secretRoomId]!;
    const parentId = secretRoom.connections[secretRoom.secretWallDir!]!;
    const parentRoom = sim.dungeon.rooms[parentId]!;
    const wallDir = parentRoom.secretWallDir!;

    sim.enterRoom(parentRoom.id);
    sim.enemies.length = 0;

    const cwTile = sim.map.getCrackedWallTileForDir(wallDir);
    expect(sim.map.getTile(cwTile.tx, cwTile.ty)).toBe('cracked_wall');

    const wallWorldX = cwTile.tx * TILE_SIZE + 16;
    const wallWorldY = cwTile.ty * TILE_SIZE + 16;
    const spawnX =
      wallDir === 'W' ? wallWorldX + 42 : wallDir === 'E' ? wallWorldX - 42 : wallWorldX;
    const spawnY =
      wallDir === 'N' ? wallWorldY + 42 : wallDir === 'S' ? wallWorldY - 42 : wallWorldY;

    const enemy = sim.spawnEnemy('goblin_shooter', spawnX, spawnY, true);
    const slamAngle = Math.atan2(wallWorldY - enemy.y, wallWorldX - enemy.x);
    enemy.kbVx = Math.cos(slamAngle) * 320;
    enemy.kbVy = Math.sin(slamAngle) * 320;

    let wallSlamBroken = false;
    for (let i = 0; i < 20; i++) {
      sim.step(1 / 60);
      if (sim.events.some((ev) => ev.kind === 'cracked_wall_broken')) {
        wallSlamBroken = true;
      }
      if (sim.secretWallBroken) break;
    }
    if (!wallSlamBroken) {
      wallSlamBroken = tryBreakCrackedWallNearImpact(sim, wallWorldX, wallWorldY, 56);
    }

    expect(wallSlamBroken).toBe(true);
    expect(sim.secretWallBroken).toBe(true);
    expect(parentRoom.secretWallBroken).toBe(true);
    expect(sim.map.getTile(cwTile.tx, cwTile.ty)).toBe('floor');
  });
});
