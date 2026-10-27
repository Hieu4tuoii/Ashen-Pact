import { FLOOR_BUFFS, FLOOR_BUFF_LIST } from '../data/enemies.js';
import type { BuffId, CardinalDir } from '../data/types.js';
import { MAX_WEAPON_SLOTS, WEAPONS, estimateWeaponDps } from '../data/weapons.js';
import { approach, distance } from '../math/vec2.js';
import { INPUT_BUTTON } from '../protocol/messages.js';
import { generateDungeonFloor } from './dungeon-gen.js';
import { findNextWalkableWaypoint } from './arena-room-archetypes.js';
import { findInteractTarget } from './interact-target.js';
import { flipCoverProp } from './sim-tactical-physics.js';
import { activateDaedalusAnvilImpl, activateUpgradeAnvilImpl } from './sim-weapon-mutators.js';
import { lerpSpeed, type SimSummonState, type SimDoorState, type SimNpcState, type SimPlayerState, type SimEnemyState, type SimPickupState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export function activateShrineImpl(this: WorldSim, shrine: SimNpcState, actor: SimPlayerState = this.player): boolean {
  if (shrine.kind !== 'shrine' || shrine.interacted || actor.lifeState !== 'alive') return false;
  const costGold = shrine.costGold ?? 40;
  if (actor.gold >= costGold) {
    actor.gold -= costGold;
  } else if (actor.hp > shrine.costHp) {
    actor.hp -= shrine.costHp;
  } else if (!actor.godMode) {
    return false;
  }

  shrine.interacted = true;
  const room = this.getCurrentRoom();
  room.shrineUsed = true;

  for (const p of this.getAllPlayers()) {
    p.armor = p.maxArmor;
    p.clipAmmo = p.clipMax;
    p.reloadTimer = 0;
    p.reloadLockout = false;
    p.weaponHeat = 0;
    p.overheatLockTimer = 0;
  }

  // Also grant the room's shrineBlessingId buff if available
  const blessingId = room.shrineBlessingId as BuffId | null;
  if (blessingId && FLOOR_BUFFS[blessingId] && !actor.blessingIds.includes(blessingId)) {
    this.applyBuffEffects(blessingId, actor.id);
  }

  const buffDef = blessingId ? FLOOR_BUFFS[blessingId] : undefined;
  shrine.dialogueVi = buffDef
    ? `Phước lành Cổ Ngữ: ${buffDef.nameVi} (Hồi đầy Giáp & Đạn)!`
    : 'Phước lành Cổ Ngữ: Hồi đầy Giáp & Đạn!';
  this.events.push({
    kind: 'shrine_blessing',
    x: shrine.x,
    y: shrine.y,
    rewardTextVi: shrine.dialogueVi,
  });
  return true;
}

export function enterPortalImpl(this: WorldSim): boolean {
  if (!this.portalActive) return false;
  if (this.inHub) {
    this.startDungeonRunFromHub();
    return true;
  }
  if (this.currentFloor < 6) {
    if (this.currentFloor >= 2) {
      this.campaignMaxFloors = 6;
    }
    this.runState = 'buff_choice';
    this.rollPendingBuffChoices();
    this.events.push({
      kind: 'portal_entered',
      floorNumber: this.currentFloor,
    });
    return true;
  }
  this.runState = 'victory';
  this.events.push({
    kind: 'portal_entered',
    floorNumber: this.currentFloor,
  });
  return true;
}

export function rollPendingBuffChoicesImpl(this: WorldSim): void {
  for (const p of this.getAllPlayers()) {
    const available: BuffId[] = FLOOR_BUFF_LIST.filter(
      (b) =>
        !p.blessingIds.includes(b.id) &&
        (b.category === 'general' || b.characterId === p.characterId),
    ).map((b) => b.id);
    const choices: BuffId[] = [];

    // Ensure at least 1 character skill upgrade for this player's characterId is offered on floor transition
    const skillUpgrades = available.filter((id) => {
      const def = FLOOR_BUFFS[id];
      return def?.category === 'skill_upgrade' && def.characterId === p.characterId;
    });
    if (skillUpgrades.length > 0) {
      const pickedSkill = this.rng.pick(skillUpgrades);
      choices.push(pickedSkill);
    }

    const rest = available.filter((id) => !choices.includes(id));
    while (choices.length < 3 && rest.length > 0) {
      const idx = this.rng.nextInt(0, rest.length - 1);
      choices.push(rest[idx]!);
      rest.splice(idx, 1);
    }
    if (choices.length < 3) {
      const fallback = FLOOR_BUFF_LIST.map((b) => b.id).filter(
        (id) => !p.blessingIds.includes(id) && !choices.includes(id),
      );
      while (choices.length < 3 && fallback.length > 0) {
        const idx = this.rng.nextInt(0, fallback.length - 1);
        choices.push(fallback[idx]!);
        fallback.splice(idx, 1);
      }
    }
    p.buffChoices = choices;
  }
}

export function applyBuffEffectsImpl(
  this: WorldSim,
  buffId: BuffId,
  playerId = this.player.id,
): void {
  const def = FLOOR_BUFFS[buffId];
  const p = this.getPlayerById(playerId) ?? this.player;
  if (!p || p.blessingIds.includes(buffId)) return;
  p.blessingIds.push(buffId);
  this.events.push({
    kind: 'buff_selected',
    buffId,
    nameVi: def?.nameVi ?? buffId,
  });
}

export function selectFloorBuffImpl(
  this: WorldSim,
  buffId: BuffId,
  playerId = this.player.id,
): boolean {
  if (!buffId) return false;
  const p = this.getPlayerById(playerId) ?? this.player;
  if (!p) return false;
  if (p.buffChoices.length > 0 && !p.buffChoices.includes(buffId) && !FLOOR_BUFFS[buffId]) {
    return false;
  }

  this.applyBuffEffects(buffId, p.id);
  p.buffChoices = [];

  if (!this.coopModeActive && p.id === this.player.id) {
    for (const sp of this.simulatedPlayers) {
      if (sp.buffChoices.length > 0) {
        this.applyBuffEffects(sp.buffChoices[0]!, sp.id);
        sp.buffChoices = [];
      }
    }
  }

  if (this.getAllPlayers().every((pl) => pl.buffChoices.length === 0)) {
    if (this.currentFloor < 6) {
      this.advanceToFloor((this.currentFloor + 1) as 1 | 2 | 3 | 4 | 5 | 6);
    } else {
      this.runState = 'playing';
    }
  }
  return true;
}

export function advanceToFloorImpl(this: WorldSim, floorNumber: 1 | 2 | 3 | 4 | 5 | 6): void {
  for (const pl of this.getAllPlayers()) {
    pl.buffChoices = [];
  }
  this.currentFloor = floorNumber;
  this.currentBiome = floorNumber <= 2 ? 1 : floorNumber <= 4 ? 2 : 3;
  if (floorNumber > 2) {
    this.campaignMaxFloors = 6;
  }
  this.map.biome = this.currentBiome;
  this.runStats.floorReached = Math.max(this.runStats.floorReached, floorNumber);
  this.runState = 'playing';
  this.roomChestsByRoomId.clear();
  this.roomItemsByRoomId.clear();
  this.initializedRoomIds.clear();
  this.completedPuzzleRoomIds.clear();
  this.secretWallBroken = false;
  const floorInBiome: 1 | 2 = floorNumber % 2 === 1 ? 1 : 2;
  this.dungeon = generateDungeonFloor(
    this.baseSeed,
    floorInBiome,
    this.currentBiome,
    this.getActivePlayerCount(),
  );
  this.enterRoom(this.dungeon.startRoomId);
}

export function advanceToBiomeImpl(this: WorldSim, biome: 1 | 2 | 3): void {
  if (biome > 1) {
    this.campaignMaxFloors = 6;
  }
  const targetFloor: 1 | 3 | 5 = biome === 1 ? 1 : biome === 2 ? 3 : 5;
  this.advanceToFloor(targetFloor);
}

export function skipCurrentRoomWavesImpl(this: WorldSim): void {
  const room = this.getCurrentRoom();
  room.wavesSpawned = room.wavesTotal;
  const allPlayers = this.getAllPlayers();
  for (let i = 0; i < this.enemies.length; i++) {
    const e = this.enemies[i]!;
    if (!e.isDummy && e.hp > 0) {
      e.shieldArmor = 0;
      e.bossBurrowed = false;
      const creditPlayer = allPlayers[i % Math.max(1, allPlayers.length)] ?? this.player;
      this.applyDamageToEnemy(e, e.hp * 4, true, 'burn', e.aimAngle, 0, true, creditPlayer.id);
    }
  }
  this.enemies = this.enemies.filter((e) => e.isDummy || e.hp > 0);
  if (!room.cleared) {
    this.onRoomCleared(room);
  } else {
    this.rebuildCurrentRoomDoors();
  }
}

export function interactWithNearestImpl(
  this: WorldSim,
  actorOrId: SimPlayerState | number = this.player,
): boolean {
  const actor =
    typeof actorOrId === 'number' ? (this.getPlayerById(actorOrId) ?? this.player) : actorOrId;
  if (!actor || actor.lifeState !== 'alive') return false;
  const p = actor;
  const target = findInteractTarget(this, p.id);
  if (!target) return false;

  switch (target.kind) {
    case 'revive': {
      target.player.reviverPlayerId = p.id;
      return true;
    }

    case 'flip_cover':
      return flipCoverProp(this, target.prop, p);

    case 'hub_statue':
      return this.selectCharacter(p.id, target.statue.characterId);

    case 'ancient_mechanism': {
      const prop = target.prop;
      prop.repaired = true;
      const summon: SimSummonState = {
        id: ++this.nextEntityId,
        ownerPlayerId: p.id,
        kind: 'ancient_turret',
        nameVi: 'Ụ Pháo Cổ Tự Động',
        x: prop.x,
        y: prop.y,
        radius: 15,
        auraRadius: 210,
        hp: 55,
        maxHp: 55,
        ttlSec: 14.0,
        maxTtlSec: 14.0,
        tickTimer: 0.25,
        healsRemaining: 0,
        charge: 0,
        poisonRoots: false,
        selfDestruct: false,
        rootedEnemyIds: [],
      };
      this.summons.push(summon);
      this.events.push({
        kind: 'summon_spawned',
        summonId: summon.id,
        summonKind: 'ancient_turret',
        ownerPlayerId: p.id,
        x: summon.x,
        y: summon.y,
      });
      return true;
    }

    case 'chest':
      return this.openChest(target.chest);

    case 'world_item': {
      if (this.pickupOrBuyWorldItem(target.item, p)) {
        return true;
      }
      const fallback = findInteractTarget(this, p.id, { requireAffordable: true });
      if (fallback?.kind === 'world_item' && fallback.item.id !== target.item.id) {
        return this.pickupOrBuyWorldItem(fallback.item, p);
      }
      return false;
    }

    case 'shrine':
      return this.activateShrine(target.npc, p);

    case 'daedalus_anvil':
      return activateDaedalusAnvilImpl(this, target.npc, p);

    case 'upgrade_anvil':
      return activateUpgradeAnvilImpl(this, target.npc, p);

    case 'portal':
      if (this.inHub) {
        p.ready = true;
        if (this.areAllPlayersReady() || p.slot === 1) {
          this.startDungeonRunFromHub();
        }
        return true;
      }
      return this.enterPortal();

    case 'door':
      return this.enterRoom(target.door.targetRoomId, target.door.dir);
  }
}

export function updateCurrentRoomProgressionImpl(this: WorldSim, dtSec: number): void {
  const room = this.getCurrentRoom();
  if (room.secretWallDir) {
    const cw = this.map.getCrackedWallTileForDir(room.secretWallDir);
    if (this.map.getTile(cw.tx, cw.ty) === 'floor') {
      this.secretWallBroken = true;
      room.secretWallBroken = true;
    }
  } else if (room.type === 'start' && this.map.getTile(18, 0) === 'floor') {
    this.secretWallBroken = true;
  }

  const hasCombatEnemies = this.hasActiveCombatEnemies();
  const wavesRemaining = !room.cleared && room.wavesSpawned < room.wavesTotal;

  for (let i = 0; i < this.doors.length; i++) {
    const d = this.doors[i]!;
    if (d.isSecretPassage) {
      const targetRoom = this.dungeon.rooms[d.targetRoomId];
      const isWallBroken = Boolean(
        room.secretWallBroken || targetRoom?.secretWallBroken || this.secretWallBroken,
      );
      d.locked = !isWallBroken || hasCombatEnemies || wavesRemaining;
    } else {
      d.locked = hasCombatEnemies || wavesRemaining;
    }
  }

  if (!hasCombatEnemies) {
    if (!room.cleared) {
      if (room.wavesSpawned < room.wavesTotal) {
        this.waveRespawnTimer += dtSec;
        if (this.waveRespawnTimer >= 0.85) {
          this.waveRespawnTimer = 0;
          this.spawnNextRoomWave();
        }
      } else {
        this.onRoomCleared(room);
      }
    } else if (room.type === 'start' && this.autoRespawnWaves && !this.botAutoPlayActive) {
      this.waveRespawnTimer += dtSec;
      if (this.waveRespawnTimer >= 1.5) {
        this.waveRespawnTimer = 0;
        this.spawnSampleWave();
      }
    }
  } else {
    this.waveRespawnTimer = 0;
    if (!room.cleared && (room.type === 'combat' || room.type === 'portal')) {
      this.waveElapsedSec += dtSec;
      if (room.wavesSpawned < room.wavesTotal) {
        const activeWaves = new Set<number>();
        let currentWaveAlive = 0;
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i]!;
          if (e.isDummy || e.hp <= 0) continue;
          const wIdx = e.waveIndex ?? 1;
          activeWaves.add(wIdx);
          if (wIdx === room.wavesSpawned) {
            currentWaveAlive += 1;
          }
        }
        const waveTotal = Math.max(1, room.currentWaveSpawnedCount ?? 4);
        const lowRemaining = currentWaveAlive <= Math.max(1, Math.floor(waveTotal * 0.3));
        const timeExpired = this.waveElapsedSec >= 9.5;
        const minOverlapSec = 1.5;
        if (
          activeWaves.size < 2 &&
          this.waveElapsedSec >= minOverlapSec &&
          (lowRemaining || timeExpired)
        ) {
          this.waveRespawnTimer = 0;
          this.spawnNextRoomWave();
        }
      }
    }
  }
}

export function stepBotAutoPlayImpl(this: WorldSim, _dtSec: number): void {
  const p = this.player;
  p.godMode = true;
  if (p.hp <= 0 || p.lifeState !== 'alive') {
    p.hp = p.maxHp;
    p.armor = p.maxArmor;
    p.lifeState = 'alive';
  }
  p.clipAmmo = p.clipMax;
  p.weaponHeat = 0;

  if (this.inHub) {
    for (const ally of this.getAllPlayers()) {
      ally.ready = true;
    }
    this.startDungeonRunFromHub();
    return;
  }

  if (this.runState === 'buff_choice') {
    for (const pl of this.getAllPlayers()) {
      if (pl.buffChoices.length > 0) {
        this.selectFloorBuff(pl.buffChoices[0]!, pl.id);
      }
    }
    return;
  }
  if (this.runState === 'victory' || this.runState === 'defeat') {
    return;
  }

  // Equip best ranged weapon in slots
  let bestSlot = p.activeWeaponSlot;
  let bestScore = -1;
  for (let s = 0; s < p.weaponSlots.length; s++) {
    const wid = p.weaponSlots[s]!;
    const w = WEAPONS[wid];
    if (!w || w.category === 'melee') continue;
    const score = w.damage * w.fireRate * Math.max(1, w.pelletCount);
    if (score > bestScore) {
      bestScore = score;
      bestSlot = s;
    }
  }
  if (bestSlot !== p.activeWeaponSlot) {
    this.equipWeaponSlot(bestSlot);
  }

  // 1. Fight active non-dummy enemies
  let nearestEnemy: SimEnemyState | null = null;
  let nearestDist = Infinity;
  for (let i = 0; i < this.enemies.length; i++) {
    const e = this.enemies[i]!;
    if (e.isDummy || e.hp <= 0) continue;
    const d = distance(p.x, p.y, e.x, e.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearestEnemy = e;
    }
  }

  if (nearestEnemy) {
    const angleToEnemy = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
    const orbitDir = Math.sin(this.tick * 0.025) >= 0 ? 1 : -1;
    const strafeAng = angleToEnemy + orbitDir * Math.PI * 0.5;
    let moveX = 0;
    let moveY = 0;

    // Steer toward nearby life_seed / prey_emblem / gold pickup when safe
    const nearbyPickup = this.pickups.find(
      (pk) =>
        pk.ttlSec > 0 &&
        (pk.ownerPlayerId === undefined || pk.ownerPlayerId === p.id) &&
        ((pk.kind === 'life_seed' && p.hp < p.maxHp) ||
          pk.kind === 'prey_emblem' ||
          (pk.kind === 'gold' && nearestDist > 130)) &&
        distance(p.x, p.y, pk.x, pk.y) < 220,
    );

    if (nearbyPickup) {
      const wp = findNextWalkableWaypoint(this.map, p.x, p.y, nearbyPickup.x, nearbyPickup.y);
      const pkAng = Math.atan2(wp.y - p.y, wp.x - p.x);
      moveX = Math.cos(pkAng);
      moveY = Math.sin(pkAng);
    } else if (nearestDist > 135) {
      const wp = findNextWalkableWaypoint(this.map, p.x, p.y, nearestEnemy.x, nearestEnemy.y);
      const wpAng = Math.atan2(wp.y - p.y, wp.x - p.x);
      moveX = Math.cos(wpAng) * 0.85 + Math.cos(strafeAng) * 0.55;
      moveY = Math.sin(wpAng) * 0.85 + Math.sin(strafeAng) * 0.55;
    } else if (nearestDist < 85) {
      moveX = -Math.cos(angleToEnemy) * 0.8 + Math.cos(strafeAng) * 0.6;
      moveY = -Math.sin(angleToEnemy) * 0.8 + Math.sin(strafeAng) * 0.6;
    } else {
      moveX = Math.cos(strafeAng);
      moveY = Math.sin(strafeAng);
    }

    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i]!;
      if (prop.hp <= 0 || !prop.blocksMovement) continue;
      const dx = prop.x - p.x;
      const dy = prop.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= p.radius + prop.radius + 24 && dx * moveX + dy * moveY > 0) {
        const side = dx * moveY - dy * moveX >= 0 ? -1 : 1;
        moveX += -moveY * side * 1.25;
        moveY += moveX * side * 1.25;
      }
    }

    // Weave tangentially between incoming enemy radial projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      const b = this.projectiles[i]!;
      if (b.team !== 'enemy' || b.ttlSec <= 0) continue;
      const rx = p.x - b.x;
      const ry = p.y - b.y;
      const d = Math.hypot(rx, ry);
      if (d < 160 && rx * b.vx + ry * b.vy > 0) {
        const spd = Math.hypot(b.vx, b.vy) || 1;
        const nx = -b.vy / spd;
        const ny = b.vx / spd;
        const lat = rx * nx + ry * ny;
        const corridor = p.radius + b.radius + 20;
        if (Math.abs(lat) < corridor) {
          const side = lat >= 0 ? 1 : -1;
          moveX += nx * side * 1.4;
          moveY += ny * side * 1.4;
        }
      }
    }

    let buttons = INPUT_BUTTON.FIRE;
    if (p.skillCooldownTimer <= 0 && p.skillActiveTimer <= 0) {
      buttons |= INPUT_BUTTON.SKILL;
    }
    if (p.dashCooldownTimer <= 0 && nearestDist < 105) {
      buttons |= INPUT_BUTTON.DASH;
    }

    this.setPlayerInput({
      seq: this.tick,
      tick: this.tick,
      moveX,
      moveY,
      aimAngle: angleToEnemy,
      buttons,
      weaponSlotSelect: null,
    });

    // Also drive co-op teammates in botAutoPlay mode so all 4 players fight together!
    for (let i = 0; i < this.simulatedPlayers.length; i++) {
      const sp = this.simulatedPlayers[i]!;
      sp.godMode = true;
      sp.clipAmmo = sp.clipMax;
      sp.weaponHeat = 0;
      const spAng = Math.atan2(nearestEnemy.y - sp.y, nearestEnemy.x - sp.x);
      const spDist = distance(sp.x, sp.y, nearestEnemy.x, nearestEnemy.y);
      const spStrafe = spAng + (i % 2 === 0 ? 1 : -1) * Math.PI * 0.5;
      const spMoveX = spDist > 175 ? Math.cos(spAng) : Math.cos(spStrafe);
      const spMoveY = spDist > 175 ? Math.sin(spAng) : Math.sin(spStrafe);
      this.setCoopPlayerInput(sp.id, {
        seq: this.tick,
        tick: this.tick,
        moveX: spMoveX,
        moveY: spMoveY,
        aimAngle: spAng,
        buttons: INPUT_BUTTON.FIRE | (sp.skillCooldownTimer <= 0 ? INPUT_BUTTON.SKILL : 0),
        weaponSlotSelect: null,
      });
    }
    return;
  }

  const steerBotToPoint = (tx: number, ty: number): void => {
    const wp = findNextWalkableWaypoint(this.map, p.x, p.y, tx, ty);
    const baseAng = Math.atan2(wp.y - p.y, wp.x - p.x);
    let moveX = Math.cos(baseAng);
    let moveY = Math.sin(baseAng);
    let aimAngle = baseAng;
    let buttons = 0;

    for (let i = 0; i < this.props.length; i++) {
      const prop = this.props[i]!;
      if (prop.hp <= 0 || !prop.blocksMovement) continue;
      const dx = prop.x - p.x;
      const dy = prop.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= p.radius + prop.radius + 26 && dx * moveX + dy * moveY > 0) {
        const side = dx * moveY - dy * moveX >= 0 ? -1 : 1;
        const perpX = -moveY * side;
        const perpY = moveX * side;
        moveX += perpX * 1.35;
        moveY += perpY * 1.35;
        if (prop.destructible) {
          aimAngle = Math.atan2(dy, dx);
          buttons |= INPUT_BUTTON.FIRE;
        }
      }
    }

    this.setPlayerInput({
      seq: this.tick,
      tick: this.tick,
      moveX,
      moveY,
      aimAngle,
      buttons,
    });
  };

  // 2. Open unopened chests in current room
  const unopenedChest = this.chests.find((c) => !c.opened);
  if (unopenedChest) {
    const d = distance(p.x, p.y, unopenedChest.x, unopenedChest.y);
    if (d <= 56) {
      this.openChest(unopenedChest);
    } else {
      steerBotToPoint(unopenedChest.x, unopenedChest.y);
    }
    return;
  }

  // 3. Pick up free weapons on the ground (belonging to P1 or shared)
  const freeItem = this.worldItems.find((it) => {
    if (
      it.pickedUp ||
      it.costGold !== 0 ||
      (it.ownerPlayerId !== undefined && it.ownerPlayerId !== 0 && it.ownerPlayerId !== p.id)
    ) {
      return false;
    }
    if (it.kind !== 'weapon' || !it.weaponId || p.weaponSlots.includes(it.weaponId)) {
      return false;
    }
    if (
      it.droppedByPlayerId === p.id &&
      it.droppedAtTick !== undefined &&
      this.tick - it.droppedAtTick < 600
    ) {
      return false;
    }
    if (p.weaponSlots.length >= MAX_WEAPON_SLOTS) {
      const wDef = WEAPONS[it.weaponId];
      if (!wDef) return false;
      const candDps = estimateWeaponDps(it.weaponId);
      if (wDef.category === 'melee') {
        const slot0Def = WEAPONS[p.weaponSlots[0] ?? ''];
        return slot0Def?.category === 'melee' && candDps > estimateWeaponDps(p.weaponSlots[0]!);
      }
      const rangedSlotIdx = p.weaponSlots.length > 1 ? 1 : 0;
      return candDps > estimateWeaponDps(p.weaponSlots[rangedSlotIdx]!);
    }
    return true;
  });
  if (freeItem) {
    const d = distance(p.x, p.y, freeItem.x, freeItem.y);
    if (d <= 56) {
      if (p.weaponSlots.length >= MAX_WEAPON_SLOTS && freeItem.weaponId) {
        const wDef = WEAPONS[freeItem.weaponId];
        const targetSlot = wDef?.category === 'melee' ? 0 : Math.min(1, p.weaponSlots.length - 1);
        this.equipWeaponSlot(targetSlot);
      }
      this.pickupOrBuyWorldItem(freeItem, p);
    } else {
      steerBotToPoint(freeItem.x, freeItem.y);
    }
    return;
  }

  // 4. Activate Shrine if present
  const unusedShrine = this.npcEntities.find((n) => n.kind === 'shrine' && !n.interacted);
  if (unusedShrine) {
    const d = distance(p.x, p.y, unusedShrine.x, unusedShrine.y);
    if (d <= 58) {
      this.activateShrine(unusedShrine, p);
    } else {
      steerBotToPoint(unusedShrine.x, unusedShrine.y);
    }
    return;
  }

  // 5. Enter active portal if in portal/boss room
  if (this.portalActive) {
    const d = distance(p.x, p.y, this.portalX, this.portalY);
    if (d <= 58) {
      this.enterPortal();
    } else {
      steerBotToPoint(this.portalX, this.portalY);
    }
    return;
  }

  // 6. Navigate via BFS to the next uncleared / unvisited room (or portal/boss room)
  const nextDoor = this.findNextBotDoor();
  if (nextDoor && !nextDoor.locked) {
    const d = distance(p.x, p.y, nextDoor.x, nextDoor.y);
    if (d <= 60) {
      this.enterRoom(nextDoor.targetRoomId, nextDoor.dir);
    } else {
      steerBotToPoint(nextDoor.x, nextDoor.y);
    }
  }
}

export function findNextBotDoorImpl(this: WorldSim): SimDoorState | null {
  const unlockedDoors = this.doors.filter((d) => !d.locked);
  if (unlockedDoors.length === 0) return null;

  // BFS from currentRoomId to find shortest path to exitRoomId (portal on Floor 1, boss on Floor 2)
  const queue: { roomId: number; firstDir: CardinalDir }[] = [];
  const visited = new Set<number>([this.currentRoomId]);

  for (const d of unlockedDoors) {
    visited.add(d.targetRoomId);
    queue.push({ roomId: d.targetRoomId, firstDir: d.dir });
  }

  let unvisitedDir: CardinalDir | null = null;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const room = this.dungeon.rooms[curr.roomId];
    if (!room) continue;
    if (curr.roomId === this.dungeon.exitRoomId) {
      return unlockedDoors.find((d) => d.dir === curr.firstDir) ?? unlockedDoors[0]!;
    }
    if (
      unvisitedDir === null &&
      room.discovery !== 'visited' &&
      room.discovery !== 'cleared' &&
      room.type !== 'secret'
    ) {
      unvisitedDir = curr.firstDir;
    }
    for (const nextId of Object.values(room.connections)) {
      if (nextId !== undefined && !visited.has(nextId)) {
        visited.add(nextId);
        queue.push({ roomId: nextId, firstDir: curr.firstDir });
      }
    }
  }

  if (unvisitedDir !== null) {
    return unlockedDoors.find((d) => d.dir === unvisitedDir) ?? unlockedDoors[0]!;
  }
  return unlockedDoors[0]!;
}

export function recordDamageHistoryImpl(this: WorldSim, amount: number): void {
  const last = this.damageHistory[this.damageHistory.length - 1];
  if (last && last.tick === this.tick) {
    last.amount += amount;
    return;
  }
  const entry = this.damageHistoryPool.pop();
  if (entry) {
    entry.tick = this.tick;
    entry.amount = amount;
    this.damageHistory.push(entry);
  } else {
    this.damageHistory.push({ tick: this.tick, amount });
  }
}

export function getRollingDpsImpl(this: WorldSim): number {
  let sum = 0;
  for (let i = 0; i < this.damageHistory.length; i++) {
    sum += this.damageHistory[i]!.amount;
  }
  return Math.round((sum / 3) * 10) / 10;
}

export function rebuildEnemySpatialGridImpl(this: WorldSim): void {
  this.enemySpatialGrid.clear();
  for (let i = 0; i < this.enemies.length; i++) {
    const e = this.enemies[i]!;
    if (e.hp > 0 && e.aiState !== 'spawning' && !e.bossBurrowed) {
      this.enemySpatialGrid.insert(e);
    }
  }
}

export function rebuildEnemyBulletSpatialGridImpl(this: WorldSim): void {
  this.bulletSpatialGrid.clear();
  for (let i = 0; i < this.projectiles.length; i++) {
    const b = this.projectiles[i]!;
    if (b.ttlSec > 0 && b.team === 'enemy') {
      this.bulletSpatialGrid.insert(b);
    }
  }
}

export function updatePickupsImpl(this: WorldSim, dtSec: number): void {
  const allPlayers = this.getAllPlayers();
  for (let i = 0; i < this.pickups.length; i++) {
    const pk = this.pickups[i]!;
    pk.ttlSec -= dtSec;
    if (pk.ttlSec <= 0) continue;

    const magnetRange = pk.kind === 'life_seed' ? 180 : 130;
    let closestPlayer: SimPlayerState | null = null;
    let closestDist = Infinity;
    let bestScore = Infinity;
    for (let pIdx = 0; pIdx < allPlayers.length; pIdx++) {
      const pl = allPlayers[pIdx]!;
      if (pl.lifeState !== 'alive') continue;
      if (pk.ownerPlayerId !== undefined && pk.ownerPlayerId !== pl.id) continue;
      const d = distance(pl.x, pl.y, pk.x, pk.y);
      // Life Seeds prioritize the lowest-HP injured ally within magnetRange (180u)
      const score =
        pk.kind === 'life_seed' && d < magnetRange
          ? (pl.hp < pl.maxHp ? pl.hp * 1000 : 100000) + d
          : 200000 + d;
      if (score < bestScore) {
        bestScore = score;
        closestDist = d;
        closestPlayer = pl;
      }
    }

    if (closestPlayer && closestDist < magnetRange && closestDist > 0.01) {
      const dx = closestPlayer.x - pk.x;
      const dy = closestPlayer.y - pk.y;
      const pullSpeed = lerpSpeed(closestDist, magnetRange, 340);
      pk.vx = approach(pk.vx, (dx / closestDist) * pullSpeed, 1400 * dtSec);
      pk.vy = approach(pk.vy, (dy / closestDist) * pullSpeed, 1400 * dtSec);
    } else {
      const damping = Math.exp(-8 * dtSec);
      pk.vx *= damping;
      pk.vy *= damping;
    }

    pk.x += pk.vx * dtSec;
    pk.y += pk.vy * dtSec;

    if (closestPlayer && closestDist <= closestPlayer.radius + 10) {
      pk.ttlSec = 0;
      if (pk.kind === 'prey_emblem') {
        closestPlayer.clipAmmo = closestPlayer.clipMax;
        closestPlayer.reloadTimer = 0;
        closestPlayer.reloadLockout = false;
        closestPlayer.overclockedNextShot = true;
        closestPlayer.weaponHeat = 0;
        closestPlayer.overheatLockTimer = 0;
        closestPlayer.skillCooldownTimer = Math.max(0, closestPlayer.skillCooldownTimer - 2.0);
      } else if (pk.kind === 'life_seed') {
        if (closestPlayer.hp < closestPlayer.maxHp) {
          closestPlayer.hp = Math.min(closestPlayer.maxHp, closestPlayer.hp + pk.amount);
        } else {
          closestPlayer.armor = Math.min(closestPlayer.maxArmor, closestPlayer.armor + pk.amount);
        }
      } else {
        closestPlayer.gold += pk.amount;
        this.runStats.goldEarned += pk.amount;
      }
      this.events.push({
        kind: 'pickup_collected',
        pickupKind: pk.kind,
        amount: pk.amount,
        x: pk.x,
        y: pk.y,
      });
    }
  }

  let pickupWriteIdx = 0;
  for (let i = 0; i < this.pickups.length; i++) {
    const pk = this.pickups[i]!;
    if (pk.ttlSec > 0) {
      this.pickups[pickupWriteIdx++] = pk;
    } else {
      this.pickupPool.push(pk);
    }
  }
  this.pickups.length = pickupWriteIdx;
}

export function acquirePickupImpl(this: WorldSim, init: Omit<SimPickupState, 'prevX' | 'prevY'>): SimPickupState {
  if (this.pickups.length >= 160) {
    const oldest = this.pickups.shift();
    if (oldest) {
      this.pickupPool.push(oldest);
    }
  }
  const pooled = this.pickupPool.pop();
  if (pooled) {
    pooled.id = init.id;
    pooled.kind = init.kind;
    pooled.prevX = init.x;
    pooled.prevY = init.y;
    pooled.x = init.x;
    pooled.y = init.y;
    pooled.vx = init.vx;
    pooled.vy = init.vy;
    pooled.amount = init.amount;
    pooled.ttlSec = init.ttlSec;
    pooled.ownerPlayerId = init.ownerPlayerId;
    return pooled;
  }
  return {
    ...init,
    prevX: init.x,
    prevY: init.y,
  };
}
