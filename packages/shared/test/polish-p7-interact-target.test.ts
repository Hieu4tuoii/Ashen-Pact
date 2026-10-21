import { describe, expect, it } from 'vitest';
import {
  INTERACT_HYSTERESIS,
  INTERACT_PRIORITY_ORDER,
  INTERACT_RANGE,
  INTERACT_RANGE_OFFSETS,
  SeededRandom,
  WorldSim,
  findInteractTarget,
} from '../src/index.js';

describe('Phase P7 — Shared findInteractTarget & Behavioral Equivalence', () => {
  it('exports INTERACT_RANGE = 64, INTERACT_HYSTERESIS = 8, offsets, and priority order', () => {
    expect(INTERACT_RANGE).toBe(64);
    expect(INTERACT_HYSTERESIS).toBe(8);
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
  });

  it('selects the closest candidate within the same priority group instead of the first array element', () => {
    const sim = new WorldSim({ seed: 7001, spawnInitialWave: false, includeProps: false });
    sim.enemies.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.player.x = 400;
    sim.player.y = 300;

    // Chest A is pushed first at distance 58u, Chest B is pushed second at distance 22u
    const chestFarther = sim.spawnChest(458, 300, 'common', 'rusty_pistol');
    const chestCloser = sim.spawnChest(422, 300, 'epic', 'dragon_breath_shotgun');

    const target = findInteractTarget(sim, sim.player.id);
    expect(target).not.toBeNull();
    expect(target?.kind).toBe('chest');
    if (target?.kind === 'chest') {
      expect(target.chest.id).toBe(chestCloser.id);
      expect(target.key).toBe(`chest:${chestCloser.id}`);
      expect(target.distance).toBeCloseTo(22, 5);
    }

    const acted = sim.interactWithNearest(sim.player);
    expect(acted).toBe(true);
    expect(chestCloser.opened).toBe(true);
    expect(chestFarther.opened).toBe(false);
  });

  it('selects the closest Hub statue and closest Ancient Mechanism when multiple are in range', () => {
    // 1. Hub statues
    const hubSim = new WorldSim({ seed: 7002, startInHub: true });
    const s0 = hubSim.hubStatues[0]!;
    const s1 = hubSim.hubStatues[1]!;
    // Place s0 at 65u and s1 at 24u from player
    hubSim.player.x = 400;
    hubSim.player.y = 300;
    s0.x = 465;
    s0.y = 300;
    s1.x = 424;
    s1.y = 300;

    const statueTarget = findInteractTarget(hubSim, hubSim.player.id);
    expect(statueTarget?.kind).toBe('hub_statue');
    if (statueTarget?.kind === 'hub_statue') {
      expect(statueTarget.statue.characterId).toBe(s1.characterId);
    }
    expect(hubSim.interactWithNearest(hubSim.player)).toBe(true);
    expect(hubSim.player.characterId).toBe(s1.characterId);

    // 2. Ancient mechanisms (requires Engineer in party)
    const mechSim = new WorldSim({ seed: 7003, spawnInitialWave: false, includeProps: false });
    mechSim.enemies.length = 0;
    mechSim.props.length = 0;
    mechSim.player.x = 400;
    mechSim.player.y = 300;
    const mechFar = mechSim.spawnProp('ancient_mechanism', 468, 300);
    const mechNear = mechSim.spawnProp('ancient_mechanism', 430, 300);

    // Without engineer: neither mechanism is eligible
    expect(findInteractTarget(mechSim, mechSim.player.id)).toBeNull();

    // Add alive engineer teammate -> mechNear (30u) is selected over mechFar (68u)
    mechSim.addCoopPlayer(2, 'engineer', 'Engi Ally', 2);
    const mechTarget = findInteractTarget(mechSim, mechSim.player.id);
    expect(mechTarget?.kind).toBe('ancient_mechanism');
    if (mechTarget?.kind === 'ancient_mechanism') {
      expect(mechTarget.prop.id).toBe(mechNear.id);
    }
    expect(mechSim.interactWithNearest(mechSim.player)).toBe(true);
    expect(mechNear.repaired).toBe(true);
    expect(mechFar.repaired).toBe(false);
  });

  it('enforces priority order: chest > world_item > shrine > portal > door even when lower-priority items are closer', () => {
    const sim = new WorldSim({ seed: 7004, spawnInitialWave: false, includeProps: false });
    sim.enemies.length = 0;
    sim.chests.length = 0;
    sim.worldItems.length = 0;
    sim.npcEntities.length = 0;
    sim.doors.length = 0;
    sim.player.x = 500;
    sim.player.y = 300;
    sim.player.gold = 500;

    // Place all candidate categories within their valid range, with lower-priority ones closer
    const targetRoomId = sim.dungeon.rooms.find((r) => r.id !== sim.currentRoomId)?.id ?? 1;
    sim.doors.push({
      dir: 'E',
      x: 505,
      y: 300,
      locked: false,
      targetRoomId,
    });
    sim.portalActive = true;
    sim.portalX = 510;
    sim.portalY = 300;
    sim.npcEntities.push({
      id: ++sim.nextEntityId,
      kind: 'shrine',
      nameVi: 'Điện Thờ',
      dialogueVi: '',
      x: 515,
      y: 300,
      radius: 20,
      interacted: false,
      costHp: 2,
    });
    const item = sim.spawnWorldItem({
      kind: 'health_potion',
      rarity: 'common',
      nameVi: 'Bình Máu',
      costGold: 0,
      healAmount: 3,
      x: 520,
      y: 300,
    });
    const chest = sim.spawnChest(555, 300, 'rare', 'frost_bow');

    // 1. Chest wins at 55u despite world_item/shrine/portal/door being closer
    expect(findInteractTarget(sim)?.key).toBe(`chest:${chest.id}`);
    expect(sim.interactWithNearest()).toBe(true);
    expect(chest.opened).toBe(true);
    // Remove newly spawned chest drop so we test the original world_item next
    sim.worldItems = sim.worldItems.filter((w) => w.id === item.id);

    // 2. World item wins next
    expect(findInteractTarget(sim)?.key).toBe(`world_item:${item.id}`);
    expect(sim.interactWithNearest()).toBe(true);
    expect(item.pickedUp).toBe(true);

    // 3. Shrine wins next
    const shrine = sim.npcEntities[0]!;
    expect(findInteractTarget(sim)?.key).toBe(`shrine:${shrine.id}`);
    expect(sim.interactWithNearest()).toBe(true);
    expect(shrine.interacted).toBe(true);
    sim.worldItems.length = 0; // clear shrine's blessed weapon drop

    // 4. Portal wins over door
    expect(findInteractTarget(sim)?.key).toBe('portal:active');
    sim.portalActive = false;

    // 5. Unlocked door wins last
    expect(findInteractTarget(sim)?.key).toBe('door:E');
  });

  it('respects instanced loot ownerPlayerId and weaponPickupLockTimer', () => {
    const sim = new WorldSim({ seed: 7005, spawnInitialWave: false, includeProps: false });
    sim.enemies.length = 0;
    sim.worldItems.length = 0;
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'P2 Ranger', 2);
    p1.x = 400;
    p1.y = 300;
    p2.x = 400;
    p2.y = 300;

    const p2Item = sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: 'frost_bow',
      rarity: 'rare',
      nameVi: 'Cung Băng Giá',
      costGold: 0,
      healAmount: 0,
      x: 410,
      y: 300,
      ownerPlayerId: p2.id,
    });

    // P1 cannot target P2's instanced drop
    expect(findInteractTarget(sim, p1.id)).toBeNull();
    // P2 can target their own instanced drop
    const targetP2 = findInteractTarget(sim, p2.id);
    expect(targetP2?.key).toBe(`world_item:${p2Item.id}`);

    // If P2 has weaponPickupLockTimer > 0, weapon is skipped
    p2.weaponPickupLockTimer = 0.25;
    expect(findInteractTarget(sim, p2.id)).toBeNull();
  });

  it('applies 8u hysteresis to currentTargetKey so standing on the range boundary never flickers', () => {
    const sim = new WorldSim({ seed: 7006, spawnInitialWave: false, includeProps: false });
    sim.enemies.length = 0;
    sim.chests.length = 0;
    sim.player.x = 400;
    sim.player.y = 300;

    // Place chest at 69u (> 64u base range, <= 64u + 8u hysteresis = 72u)
    const chest = sim.spawnChest(469, 300, 'epic', 'dragon_breath_shotgun');
    const chestKey = `chest:${chest.id}`;

    // Without currentTargetKey, 69u is outside 64u range
    expect(findInteractTarget(sim, sim.player.id)).toBeNull();
    expect(
      findInteractTarget(sim, sim.player.id, { currentTargetKey: 'chest:999999' }),
    ).toBeNull();

    // With matching currentTargetKey, 8u hysteresis keeps the target locked up to 72u
    const lockedTarget = findInteractTarget(sim, sim.player.id, {
      currentTargetKey: chestKey,
    });
    expect(lockedTarget).not.toBeNull();
    expect(lockedTarget?.key).toBe(chestKey);

    // Beyond 72u (e.g. 74u), hysteresis releases the target
    sim.player.x = 395; // distance = 74u
    expect(
      findInteractTarget(sim, sim.player.id, { currentTargetKey: chestKey }),
    ).toBeNull();
  });

  it('behavioral seeded fuzz test: across 36 random layouts, pressing E acts on the exact X = findInteractTarget(sim)', () => {
    for (let trial = 0; trial < 36; trial++) {
      const seed = 88000 + trial * 37;
      const rng = new SeededRandom(seed);
      const inHub = trial % 6 === 0;
      const sim = new WorldSim({
        seed,
        startInHub: inHub,
        spawnInitialWave: false,
        includeProps: false,
      });

      sim.enemies.length = 0;
      sim.chests.length = 0;
      sim.worldItems.length = 0;
      sim.npcEntities.length = 0;
      sim.props.length = 0;
      sim.doors.length = 0;
      sim.portalActive = false;

      const p = sim.player;
      p.x = 480;
      p.y = 280;
      p.gold = 999;
      p.hp = Math.max(1, p.maxHp - 2);
      p.weaponPickupLockTimer = 0;

      if (trial % 4 === 0) {
        sim.selectCharacter(p.id, 'engineer');
      }

      if (inHub) {
        // Randomize Hub statue positions around player
        for (let i = 0; i < sim.hubStatues.length; i++) {
          const st = sim.hubStatues[i]!;
          const dist = rng.nextFloat(18, 120);
          const ang = rng.nextFloat(0, Math.PI * 2);
          st.x = p.x + Math.cos(ang) * dist;
          st.y = p.y + Math.sin(ang) * dist;
        }
      } else {
        // Spawn 0..2 ancient mechanisms
        const mechCount = rng.nextInt(0, 2);
        for (let i = 0; i < mechCount; i++) {
          const dist = rng.nextFloat(20, 110);
          const ang = rng.nextFloat(0, Math.PI * 2);
          const prop = sim.spawnProp(
            'ancient_mechanism',
            p.x + Math.cos(ang) * dist,
            p.y + Math.sin(ang) * dist,
          );
          prop.repaired = rng.next() < 0.3;
        }

        // Spawn 0..3 chests
        const chestCount = rng.nextInt(0, 3);
        for (let i = 0; i < chestCount; i++) {
          const dist = rng.nextFloat(16, 105);
          const ang = rng.nextFloat(0, Math.PI * 2);
          const ch = sim.spawnChest(
            p.x + Math.cos(ang) * dist,
            p.y + Math.sin(ang) * dist,
            'rare',
            'frost_bow',
          );
          ch.opened = rng.next() < 0.25;
        }

        // Spawn 0..4 world items (mix of free, shop, and other-player instanced)
        const itemCount = rng.nextInt(0, 4);
        for (let i = 0; i < itemCount; i++) {
          const dist = rng.nextFloat(14, 100);
          const ang = rng.nextFloat(0, Math.PI * 2);
          const isWeapon = rng.next() < 0.5;
          const ownedByOther = rng.next() < 0.25;
          sim.spawnWorldItem({
            kind: isWeapon ? 'weapon' : 'health_potion',
            weaponId: isWeapon ? 'scrap_shotgun' : undefined,
            rarity: isWeapon ? 'uncommon' : 'common',
            nameVi: isWeapon ? 'Shotgun Phế Liệu' : 'Bình Máu',
            costGold: rng.next() < 0.4 ? 25 : 0,
            healAmount: isWeapon ? 0 : 3,
            x: p.x + Math.cos(ang) * dist,
            y: p.y + Math.sin(ang) * dist,
            ownerPlayerId: ownedByOther ? 99 : undefined,
          });
        }

        // Spawn 0..2 shrines
        const shrineCount = rng.nextInt(0, 2);
        for (let i = 0; i < shrineCount; i++) {
          const dist = rng.nextFloat(20, 105);
          const ang = rng.nextFloat(0, Math.PI * 2);
          sim.npcEntities.push({
            id: ++sim.nextEntityId,
            kind: 'shrine',
            nameVi: 'Điện Thờ Cổ',
            dialogueVi: '',
            x: p.x + Math.cos(ang) * dist,
            y: p.y + Math.sin(ang) * dist,
            radius: 20,
            interacted: rng.next() < 0.3,
            costHp: 2,
          });
        }

        // Active portal
        if (rng.next() < 0.6) {
          sim.portalActive = true;
          const dist = rng.nextFloat(20, 110);
          const ang = rng.nextFloat(0, Math.PI * 2);
          sim.portalX = p.x + Math.cos(ang) * dist;
          sim.portalY = p.y + Math.sin(ang) * dist;
        }

        // Doors
        const otherRoomId =
          sim.dungeon.rooms.find((r) => r.id !== sim.currentRoomId)?.id ?? sim.currentRoomId;
        const dirs = ['N', 'E', 'S', 'W'] as const;
        for (let i = 0; i < 2; i++) {
          const dist = rng.nextFloat(22, 110);
          const ang = rng.nextFloat(0, Math.PI * 2);
          sim.doors.push({
            dir: dirs[i]!,
            x: p.x + Math.cos(ang) * dist,
            y: p.y + Math.sin(ang) * dist,
            locked: rng.next() < 0.35,
            targetRoomId: otherRoomId,
          });
        }
      }

      sim.consumeEvents();
      const expectedTarget = findInteractTarget(sim, p.id);
      const acted = sim.interactWithNearest(p);

      if (!expectedTarget) {
        expect(acted).toBe(false);
        continue;
      }

      expect(acted).toBe(true);
      const events = sim.consumeEvents();

      switch (expectedTarget.kind) {
        case 'hub_statue':
          expect(p.characterId).toBe(expectedTarget.statue.characterId);
          break;
        case 'ancient_mechanism':
          expect(expectedTarget.prop.repaired).toBe(true);
          expect(
            events.some(
              (e) =>
                e.kind === 'summon_spawned' &&
                e.x === expectedTarget.prop.x &&
                e.y === expectedTarget.prop.y,
            ),
          ).toBe(true);
          break;
        case 'chest':
          expect(expectedTarget.chest.opened).toBe(true);
          break;
        case 'world_item':
          expect(expectedTarget.item.pickedUp).toBe(true);
          break;
        case 'shrine':
          expect(expectedTarget.npc.interacted).toBe(true);
          expect(
            events.some(
              (e) =>
                e.kind === 'shrine_blessing' &&
                e.x === expectedTarget.npc.x &&
                e.y === expectedTarget.npc.y,
            ),
          ).toBe(true);
          break;
        case 'portal':
          expect(events.some((e) => e.kind === 'portal_entered') || !sim.inHub).toBe(true);
          break;
        case 'door':
          expect(sim.currentRoomId).toBe(expectedTarget.door.targetRoomId);
          break;
      }
    }
  });
});
