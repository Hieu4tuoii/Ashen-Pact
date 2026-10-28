import { CHARACTERS } from '../data/characters.js';
import type { CharacterId } from '../data/types.js';
import { WEAPONS } from '../data/weapons.js';
import { clamp, distance } from '../math/vec2.js';
import { INPUT_BUTTON, PLAYER_SLOT_COLORS, type PlayerInputPacket, QUICK_EMOTES_VI, type QuickEmoteId, TILE_SIZE } from '../protocol/messages.js';
import { generateDungeonFloor } from './dungeon-gen.js';
import { PLAYER_RADIUS, REVIVE_HOLD_DURATION_SEC, DRUID_REVIVE_HOLD_DURATION_SEC, type SimWorldItemState, type PingMarkerKind, type SimPingMarker, type SimPlayerState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export function syncActiveWeaponCadenceState(p: SimPlayerState): void {
  const slot = p.activeWeaponSlot ?? 0;
  const activeWepId = p.weaponSlots[slot] ?? p.weaponSlots[0] ?? 'knight_sword';
  const wep = WEAPONS[activeWepId];
  p.clipMax = wep?.clipSize ?? 0;
  p.clipAmmo = p.clipMax;
  if (!Array.isArray(p.weaponSlotClipAmmo)) {
    p.weaponSlotClipAmmo = [p.clipMax, 0];
  } else {
    p.weaponSlotClipAmmo[slot] = p.clipMax;
  }
  if (!Array.isArray(p.weaponSlotHeat)) {
    p.weaponSlotHeat = [0, 0];
  } else {
    p.weaponSlotHeat[slot] = 0;
  }
  p.reloadTimer = 0;
  p.reloadDuration = wep?.reloadDurationSec ?? 0;
  p.reloadLockout = false;
  p.overclockedNextShot = false;
  p.weaponHeat = 0;
  p.overheatLockTimer = 0;
  p.ventCooldownTimer = 0;
  p.meleeComboStep = 0;
  p.meleeComboResetTimer = 0;
  p.meleeParryWindowTimer = 0;
  p.bonusBounceCurrentClip = 0;
  p.parriedCountCurrentWindow = 0;
  p.fireHoldTimer = 0;
  p.crossbowChargeTimer = 0;
}

export function createPlayerStateImpl(this: WorldSim,
  id: number,
  slot: 1 | 2 | 3 | 4,
  characterId: CharacterId,
  x: number,
  y: number,
  displayName?: string,
): SimPlayerState {
  const cDef = CHARACTERS[characterId] ?? CHARACTERS.vanguard;
  const starterWeapons = [cDef.starterWeaponId];
  const starterWep = WEAPONS[starterWeapons[0] ?? 'knight_sword'];
  return {
    id,
    slot,
    characterId,
    displayName: displayName ?? `${cDef.nameVi} P${slot}`,
    colorHex: PLAYER_SLOT_COLORS[slot],
    prevX: x,
    prevY: y,
    x,
    y,
    vx: 0,
    vy: 0,
    kbVx: 0,
    kbVy: 0,
    radius: PLAYER_RADIUS,
    aimAngle: 0,
    hp: cDef.hp,
    maxHp: cDef.hp,
    armor: cDef.armor,
    maxArmor: cDef.armor,
    gold: 0,
    moveSpeed: cDef.moveSpeed,
    armorRegenDelaySec: cDef.armorRegenDelaySec,
    armorRegenPerSec: cDef.armorRegenPerSec,
    armorRegenTimer: 0,
    armorRegenAccum: 0,
    dashTimer: 0,
    dashCooldownTimer: 0,
    dashDirX: 1,
    dashDirY: 0,
    invulnerableTimer: 0,
    hurtFlashTimer: 0,
    weaponSlots: starterWeapons,
    activeWeaponSlot: 0,
    weaponPickupLockTimer: 0,
    fireCooldownTimer: 0,
    recoilTimer: 0,
    clipAmmo: starterWep?.clipSize ?? 0,
    clipMax: starterWep?.clipSize ?? 0,
    reloadTimer: 0,
    reloadDuration: starterWep?.reloadDurationSec ?? 0,
    reloadLockout: false,
    overclockedNextShot: false,
    weaponHeat: 0,
    overheatLockTimer: 0,
    ventCooldownTimer: 0,
    meleeComboStep: 0,
    meleeComboResetTimer: 0,
    meleeParryWindowTimer: 0,
    berserkerBloodlustStacks: 0,
    berserkerBloodlustTimer: 0,
    holsterReloadTimers: [0, 0],
    weaponSlotClipAmmo: [starterWep?.clipSize ?? 0, -1],
    weaponSlotHeat: [0, 0],
    staffShotCounter: 0,
    apprenticeStaffShotCount: 0,
    bonusBounceCurrentClip: 0,
    parriedCountCurrentWindow: 0,
    fireHoldTimer: 0,
    crossbowChargeTimer: 0,
    vanguardShieldBonusAdd: 0,
    elementalConvergenceTimer: 0,
    pollenSpeedBoostTimer: 0,
    seedGunHealIcdTimer: 0,
    seedGunRoomHealsUsed: 0,
    blessingIds: [],
    weaponMutators: { 0: [], 1: [] },
    duoBoonIds: [],
    activePactId: null,
    pactOriginalWeaponId: null,
    awakenedRelicIds: [],
    buffChoices: [],
    pactChoices: [],
    weaponUpgradeLevels: { 0: 0, 1: 0 },
    salvageHoldTimer: 0,
    salvageTargetItemId: 0,
    tookDamageInCurrentRoom: false,
    skillActiveTimer: 0,
    skillCooldownTimer: 0,
    shieldStoredBullets: 0,
    godMode: false,
    lastProcessedSeq: 0,
    activeImbueElement: characterId === 'elementalist' ? 'burn' : 'none',
    burnTimer: 0,
    burnTickTimer: 0,
    chillTimer: 0,
    poisonTimer: 0,
    poisonTickTimer: 0,
    shockTimer: 0,
    surfaceTickTimer: 0,
    grassRustleCooldown: 0,
    lifeState: 'alive',
    downedTimer: 0,
    reviveProgress: 0,
    reviverPlayerId: null,
    ready: false,
    pingMs: 0,
    emoteId: null,
    emoteTimer: 0,
    currentRoomId: this.currentRoomId,
    statsDamageDealt: 0,
    statsDamageTaken: 0,
    statsKills: 0,
    statsRevives: 0,
    statsElementalReactions: 0,
    statsTeamCombos: 0,
  };
}

export function getAllPlayersImpl(this: WorldSim): SimPlayerState[] {
  this.allPlayersScratch.length = 0;
  this.allPlayersScratch.push(this.player);
  if (!this.stressTestActive) {
    for (let i = 0; i < this.simulatedPlayers.length; i++) {
      this.allPlayersScratch.push(this.simulatedPlayers[i]!);
    }
  }
  return this.allPlayersScratch;
}

export function getActivePlayerCountImpl(this: WorldSim): 1 | 2 | 3 | 4 {
  if (this.coopPlayerCountOverride !== null) {
    return this.coopPlayerCountOverride;
  }
  if (this.stressTestActive) {
    return 1;
  }
  const total = clamp(1 + this.simulatedPlayers.length, 1, 4);
  return total as 1 | 2 | 3 | 4;
}

export function setPlayerCountOverrideImpl(this: WorldSim, count: (1 | 2 | 3 | 4) | null): void {
  this.coopPlayerCountOverride = count;
}

export function getPlayerByIdImpl(this: WorldSim, playerId: number): SimPlayerState | undefined {
  if (this.player.id === playerId) return this.player;
  for (let i = 0; i < this.simulatedPlayers.length; i++) {
    const sp = this.simulatedPlayers[i]!;
    if (sp.id === playerId) return sp;
  }
  return undefined;
}

export function getPlayerBySlotImpl(this: WorldSim, slot: 1 | 2 | 3 | 4): SimPlayerState | undefined {
  if (this.player.slot === slot) return this.player;
  for (let i = 0; i < this.simulatedPlayers.length; i++) {
    const sp = this.simulatedPlayers[i]!;
    if (sp.slot === slot) return sp;
  }
  return undefined;
}

export function addCoopPlayerImpl(this: WorldSim,
  slotOrId: 1 | 2 | 3 | 4 | number,
  characterIdOrSlot: CharacterId | (1 | 2 | 3 | 4) = 'vanguard',
  displayNameOrChar?: string,
  idOrName?: number | string,
): SimPlayerState {
  this.coopModeActive = true;
  let slot: 1 | 2 | 3 | 4;
  let characterId: CharacterId;
  let displayName: string | undefined;
  let pid: number;

  if (typeof characterIdOrSlot === 'number') {
    pid = slotOrId;
    slot = clamp(characterIdOrSlot, 1, 4) as 1 | 2 | 3 | 4;
    characterId = (displayNameOrChar as CharacterId | undefined) ?? 'vanguard';
    displayName = typeof idOrName === 'string' ? idOrName : undefined;
  } else {
    slot = clamp(slotOrId, 1, 4) as 1 | 2 | 3 | 4;
    characterId = characterIdOrSlot;
    displayName = displayNameOrChar;
    pid = typeof idOrName === 'number' ? idOrName : slot;
  }

  const cx = this.map.width * 0.5;
  const cy = this.map.height * 0.5;
  const spawnOffsets: Record<1 | 2 | 3 | 4, [number, number]> = {
    1: [-90, 8],
    2: [15, 28],
    3: [-90, 68],
    4: [15, 88],
  };
  const [ox, oy] = spawnOffsets[slot];
  const resolved = this.map.resolveCircleCollision(cx + ox, cy + oy, PLAYER_RADIUS);

  if (slot === 1 && this.player.slot === 1) {
    this.player.id = pid;
    this.applyCharacterToPlayerState(this.player, characterId, displayName);
    this.player.x = resolved.x;
    this.player.y = resolved.y;
    this.player.prevX = resolved.x;
    this.player.prevY = resolved.y;
    return this.player;
  }

  const existingIdx = this.simulatedPlayers.findIndex((p) => p.slot === slot || p.id === pid);
  const state = this.createPlayerState(
    pid,
    slot,
    characterId,
    resolved.x,
    resolved.y,
    displayName,
  );
  if (existingIdx >= 0) {
    this.simulatedPlayers[existingIdx] = state;
  } else {
    this.simulatedPlayers.push(state);
    this.simulatedPlayers.sort((a, b) => a.slot - b.slot);
  }
  this.coopPlayerInputs.set(pid, {
    current: {
      seq: 0,
      tick: this.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
      weaponSlotSelect: null,
    },
    prevButtons: 0,
    latchedButtons: 0,
    latchedWeaponSlot: null,
  });
  return state;
}

export function removeCoopPlayerImpl(this: WorldSim, playerId: number): boolean {
  const idx = this.simulatedPlayers.findIndex((p) => p.id === playerId);
  if (idx < 0) {
    return false;
  }

  const departing = this.simulatedPlayers[idx]!;
  this.simulatedPlayers.splice(idx, 1);
  this.coopPlayerInputs.delete(playerId);

  // Clear any in-progress revive by the departing player
  for (const pl of this.getAllPlayers()) {
    if (pl.reviverPlayerId === playerId) {
      pl.reviverPlayerId = null;
      pl.reviveProgress = 0;
    }
  }

  // Remove any orphaned Ice Prison that was trapping the departing player
  if (departing.icePrisonId) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]!;
      if (e.defId === 'ice_prison' && e.id === departing.icePrisonId) {
        this.enemies.splice(i, 1);
      }
    }
  }

  // Remove summons and skill zones owned by the departing player
  for (let i = this.summons.length - 1; i >= 0; i--) {
    if (this.summons[i]!.ownerPlayerId === playerId) {
      this.summons.splice(i, 1);
    }
  }
  for (let i = this.skillZones.length - 1; i >= 0; i--) {
    if (this.skillZones[i]!.ownerPlayerId === playerId) {
      this.skillZones.splice(i, 1);
    }
  }

  // If the last alive teammate leaves during an active dungeon run while remaining players are downed/ghost
  if (!this.inHub && this.runState === 'playing') {
    const remaining = this.getAllPlayers();
    const anyAlive = remaining.some((p) => p.lifeState === 'alive' && p.hp > 0);
    if (!anyAlive) {
      this.runState = 'defeat';
      for (const p of remaining) {
        p.lifeState = 'ghost';
        p.downedTimer = 0;
        this.events.push({
          kind: 'player_ghost',
          playerId: p.id,
          x: p.x,
          y: p.y,
        });
      }
    }
  } else if (!this.inHub && this.runState === 'buff_choice') {
    const remaining = this.getAllPlayers();
    if (remaining.length > 0 && remaining.every((p) => p.buffChoices.length === 0)) {
      if (this.currentFloor < 6) {
        this.advanceToFloor((this.currentFloor + 1) as 1 | 2 | 3 | 4 | 5 | 6);
      } else {
        this.runState = 'playing';
      }
    }
  }

  return true;
}

export function setCoopPlayerInputImpl(this: WorldSim, playerId: number, input: PlayerInputPacket): void {
  if (playerId === this.player.id) {
    this.setPlayerInput(input);
    if (typeof input.pingWorldX === 'number' && typeof input.pingWorldY === 'number') {
      this.triggerPing(playerId, input.pingWorldX, input.pingWorldY);
    }
    if (input.emoteId) {
      this.triggerEmote(playerId, input.emoteId);
    }
    return;
  }

  const sp = this.getPlayerById(playerId);
  if (!sp) return;
  let entry = this.coopPlayerInputs.get(playerId);
  if (!entry) {
    entry = {
      current: {
        seq: 0,
        tick: this.tick,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      },
      prevButtons: 0,
      latchedButtons: 0,
      latchedWeaponSlot: null,
    };
    this.coopPlayerInputs.set(playerId, entry);
  }
  const newEdges = input.buttons & ~entry.current.buttons;
  entry.latchedButtons |= newEdges;
  if (typeof input.weaponSlotSelect === 'number') {
    entry.latchedWeaponSlot = input.weaponSlotSelect;
  }
  entry.current.seq = input.seq;
  entry.current.tick = input.tick;
  entry.current.moveX = input.moveX;
  entry.current.moveY = input.moveY;
  entry.current.aimAngle = input.aimAngle;
  entry.current.buttons = input.buttons;
  entry.current.weaponSlotSelect = input.weaponSlotSelect ?? null;
  sp.lastProcessedSeq = input.seq;

  if (typeof input.pingWorldX === 'number' && typeof input.pingWorldY === 'number') {
    this.triggerPing(playerId, input.pingWorldX, input.pingWorldY);
  }
  if (input.emoteId) {
    this.triggerEmote(playerId, input.emoteId);
  }
}

export function applyCharacterToPlayerStateImpl(this: WorldSim,
  p: SimPlayerState,
  characterId: CharacterId,
  displayName?: string,
): void {
  const cDef = CHARACTERS[characterId] ?? CHARACTERS.vanguard;
  p.characterId = characterId;
  if (displayName) {
    p.displayName = displayName;
  } else if (/^(Thiết Vệ|Liệp Ưng|Lam Hỏa|Mộc Linh|Bánh Răng|Chiến Hữu|Player) P\d+$/.test(p.displayName)) {
    p.displayName = `${cDef.nameVi} P${p.slot}`;
  }
  p.maxHp = cDef.hp;
  p.hp = cDef.hp;
  p.maxArmor = cDef.armor;
  p.armor = cDef.armor;
  p.moveSpeed = cDef.moveSpeed;
  p.armorRegenDelaySec = cDef.armorRegenDelaySec;
  p.armorRegenPerSec = cDef.armorRegenPerSec;
  const starterWeapons = [cDef.starterWeaponId];
  p.weaponSlots = starterWeapons;
  p.activeWeaponSlot = 0;
  p.weaponPickupLockTimer = 0;
  syncActiveWeaponCadenceState(p);
  p.holsterReloadTimers = [0, 0];
  p.vanguardShieldBonusAdd = 0;
  p.elementalConvergenceTimer = 0;
  p.skillActiveTimer = 0;
  p.skillCooldownTimer = 0;
  p.activeImbueElement = characterId === 'elementalist' ? 'burn' : 'none';
}

export function selectCharacterImpl(this: WorldSim,
  playerId: number,
  characterId: CharacterId,
  allowDuplicateOverride?: boolean,
): boolean {
  if (!CHARACTERS[characterId]) return false;
  const p = this.getPlayerById(playerId);
  if (!p) return false;

  const allowDuplicates = allowDuplicateOverride ?? this.allowDuplicateCharacters;
  if (!allowDuplicates) {
    const all = this.getAllPlayers();
    const takenByOther = all.some(
      (other) => other.id !== playerId && other.characterId === characterId,
    );
    if (takenByOther) {
      return false;
    }
  }

  this.applyCharacterToPlayerState(p, characterId);
  this.events.push({
    kind: 'character_selected',
    playerId: p.id,
    characterId,
    nameVi: CHARACTERS[characterId].nameVi,
  });
  return true;
}

export function togglePlayerReadyImpl(this: WorldSim, playerId: number, ready?: boolean): boolean {
  const p = this.getPlayerById(playerId);
  if (!p) return false;
  p.ready = ready ?? !p.ready;
  return p.ready;
}

export function areAllPlayersReadyImpl(this: WorldSim): boolean {
  const all = this.getAllPlayers();
  return all.length > 0 && all.every((p) => p.ready);
}

export function enterHubImpl(this: WorldSim): void {
  this.inHub = true;
  this.coopModeActive = true;
  this.runState = 'playing';
  this.enemies.length = 0;
  this.projectiles.length = 0;
  this.pickups.length = 0;
  this.props.length = 0;
  this.summons.length = 0;
  this.skillZones.length = 0;
  this.chests.length = 0;
  this.worldItems.length = 0;
  this.npcEntities.length = 0;
  this.doors.length = 0;
  this.hubStatues.length = 0;
  this.flameFissures.length = 0;
  this.pendingMortarStrikes.length = 0;
  this.empBlastVisualRings.length = 0;
  this.pendingBossSupplyDrops.length = 0;

  this.map.configureRoomLayout('start', Number(this.baseSeed), false);
  this.map.clearInteriorForHub();
  const cx = this.map.width * 0.5;
  const cy = this.map.height * 0.5;

  // 5 Character Statues in a staggered 2-row arc at the top-center of the Hub Camp
  // Positioned cleanly between the top-left [P2..P4] HUD cards (cx - 340) and the right Invite Panel (cx + 112)
  const statueCoords: readonly [CharacterId, number, number][] = [
    ['vanguard', cx - 245, cy - 96],
    ['ranger', cx - 185, cy - 182],
    ['elementalist', cx - 125, cy - 96],
    ['druid', cx - 65, cy - 182],
    ['engineer', cx - 5, cy - 96],
  ];
  for (const [cid, sx, sy] of statueCoords) {
    const cDef = CHARACTERS[cid];
    this.hubStatues.push({
      characterId: cid,
      nameVi: cDef.nameVi,
      titleVi: cDef.titleVi,
      x: sx,
      y: sy,
      radius: 24,
    });
  }

  // Central Campfire & Torch Braziers
  this.spawnProp('torch_brazier', cx - 35, cy - 10);
  this.spawnProp('torch_brazier', cx - 210, cy - 35);
  this.spawnProp('torch_brazier', cx + 135, cy - 35);
  this.spawnProp('glow_mushroom', cx - 310, cy + 10);
  this.spawnProp('glow_mushroom', cx + 165, cy + 20);

  // Training Dummy in the Hub (East-center side, left of Invite Panel)
  this.spawnTrainingDummy(cx + 95, cy + 95);

  // Weapon Test Rack (West side — 2x2 staggered grid so [E] labels never overlap)
  const rackWeapons = [
    'hunter_crossbow',
    'apprentice_staff',
    'tesla_carbine',
    'scrap_shotgun',
  ] as const;
  const rackOffsets: readonly [number, number][] = [
    [-320, 48],
    [-195, 48],
    [-320, 118],
    [-195, 118],
  ];
  for (let i = 0; i < rackWeapons.length; i++) {
    const wid = rackWeapons[i]!;
    const wep = WEAPONS[wid];
    if (!wep) continue;
    const [rx, ry] = rackOffsets[i % rackOffsets.length]!;
    this.spawnWorldItem({
      kind: 'weapon',
      weaponId: wep.id,
      rarity: wep.rarity,
      nameVi: wep.nameVi,
      costGold: 0,
      healAmount: 0,
      x: cx + rx,
      y: cy + ry,
      isHubRackItem: true,
    });
  }

  // Hub Expedition Portal at bottom center
  this.portalActive = true;
  this.portalX = cx - 30;
  this.portalY = cy + 142;

  // Position all players around the campfire in a wide vertically-staggered 2x2 formation
  const allPlayers = this.getAllPlayers();
  const offsets: readonly [number, number][] = [
    [-105, 8],
    [-18, 28],
    [-105, 68],
    [-18, 88],
  ];
  for (let i = 0; i < allPlayers.length; i++) {
    const p = allPlayers[i]!;
    const [ox, oy] = offsets[i % offsets.length]!;
    const pos = this.map.resolveCircleCollision(cx + ox, cy + oy, p.radius);
    p.x = pos.x;
    p.y = pos.y;
    p.prevX = pos.x;
    p.prevY = pos.y;
    p.vx = 0;
    p.vy = 0;
    p.lifeState = 'alive';
    p.hp = p.maxHp;
    p.armor = p.maxArmor;
    const activeWep = WEAPONS[p.weaponSlots[p.activeWeaponSlot] ?? p.weaponSlots[0] ?? 'knight_sword'];
    p.clipMax = activeWep?.clipSize ?? 0;
    p.clipAmmo = p.clipMax;
    p.reloadTimer = 0;
    p.reloadDuration = activeWep?.reloadDurationSec ?? 0;
    p.reloadLockout = false;
    p.overclockedNextShot = false;
    p.weaponHeat = 0;
    p.overheatLockTimer = 0;
    p.vanguardShieldBonusAdd = 0;
    p.elementalConvergenceTimer = 0;
    p.buffChoices = [];
    p.pactChoices = [];
    p.ready = false;
  }
}

export function startDungeonRunFromHubImpl(this: WorldSim): void {
  this.inHub = false;
  this.hubStatues.length = 0;
  this.currentFloor = 1;
  this.currentBiome = 1;
  this.map.biome = 1;
  this.runState = 'playing';
  this.teamComboCount = 0;
  this.runStats = {
    floorReached: 1,
    roomsCleared: 0,
    chestsOpened: 0,
    kills: 0,
    elitesKilled: 0,
    bossesKilled: 0,
    damageDealt: 0,
    goldEarned: 0,
    ticksElapsed: 0,
    elementalReactions: 0,
    teamCombos: 0,
  };
  this.roomChestsByRoomId.clear();
  this.roomItemsByRoomId.clear();
  this.initializedRoomIds.clear();
  this.completedPuzzleRoomIds.clear();

  const pCount = this.getActivePlayerCount();
  this.dungeon = generateDungeonFloor(this.baseSeed, 1, 1, pCount);
  this.currentRoomId = this.dungeon.startRoomId;

  const allPlayers = this.getAllPlayers();
  for (const p of allPlayers) {
    p.lifeState = 'alive';
    p.downedTimer = 0;
    p.reviveProgress = 0;
    p.reviverPlayerId = null;
    p.hp = p.maxHp;
    p.armor = p.maxArmor;
    const activeWep = WEAPONS[p.weaponSlots[p.activeWeaponSlot] ?? p.weaponSlots[0] ?? 'knight_sword'];
    p.clipMax = activeWep?.clipSize ?? 0;
    p.clipAmmo = p.clipMax;
    p.reloadTimer = 0;
    p.reloadDuration = activeWep?.reloadDurationSec ?? 0;
    p.reloadLockout = false;
    p.overclockedNextShot = false;
    p.weaponHeat = 0;
    p.overheatLockTimer = 0;
    p.vanguardShieldBonusAdd = 0;
    p.elementalConvergenceTimer = 0;
    p.blessingIds = [];
    p.weaponMutators = { 0: [], 1: [] };
    p.duoBoonIds = [];
    p.activePactId = null;
    p.pactOriginalWeaponId = null;
    p.awakenedRelicIds = [];
    p.buffChoices = [];
    p.pactChoices = [];
    p.weaponUpgradeLevels = { 0: 0, 1: 0 };
    p.salvageHoldTimer = 0;
    p.salvageTargetItemId = 0;
    p.tookDamageInCurrentRoom = false;
    p.ready = false;
    p.currentRoomId = this.currentRoomId;
    p.statsDamageDealt = 0;
    p.statsDamageTaken = 0;
    p.statsKills = 0;
    p.statsRevives = 0;
    p.statsElementalReactions = 0;
    p.statsTeamCombos = 0;
  }

  this.enterRoom(this.dungeon.startRoomId);
}

export function triggerPingImpl(this: WorldSim, playerId: number, worldX: number, worldY: number): SimPingMarker | null {
  const p = this.getPlayerById(playerId);
  if (!p) return null;

  let kind: PingMarkerKind = 'move';
  let labelVi = 'Di chuyển tới đây!';
  let px = clamp(worldX, TILE_SIZE * 1.5, this.map.width - TILE_SIZE * 1.5);
  let py = clamp(worldY, TILE_SIZE * 1.5, this.map.height - TILE_SIZE * 1.5);

  if (p.lifeState === 'downed') {
    kind = 'revive';
    labelVi = 'Cứu tôi!';
    px = p.x;
    py = p.y;
  } else {
    const downedAlly = this.getAllPlayers().find(
      (ally) => ally.lifeState === 'downed' && distance(px, py, ally.x, ally.y) <= 64,
    );
    if (downedAlly) {
      kind = 'revive';
      labelVi = `Cứu ${downedAlly.displayName}!`;
      px = downedAlly.x;
      py = downedAlly.y;
    } else {
      const targetEnemy = this.enemies.find(
        (e) => !e.isDummy && e.hp > 0 && distance(px, py, e.x, e.y) <= 64,
      );
      if (targetEnemy) {
        kind = 'enemy';
        labelVi = `Tập trung: ${targetEnemy.nameVi}!`;
        px = targetEnemy.x;
        py = targetEnemy.y;
      } else {
        const targetItem = this.worldItems.find(
          (it) => !it.pickedUp && distance(px, py, it.x, it.y) <= 64,
        );
        const targetChest = this.chests.find(
          (c) => !c.opened && distance(px, py, c.x, c.y) <= 64,
        );
        if (targetItem) {
          kind = 'loot';
          labelVi = `Vật phẩm: ${targetItem.nameVi}`;
          px = targetItem.x;
          py = targetItem.y;
        } else if (targetChest) {
          kind = 'loot';
          labelVi = 'Rương Vũ Khí ở đây!';
          px = targetChest.x;
          py = targetChest.y;
        }
      }
    }
  }

  // Replace existing ping from the same player so spam doesn't clutter
  const existingIdx = this.pings.findIndex((m) => m.playerId === p.id);
  if (existingIdx >= 0) {
    this.pings.splice(existingIdx, 1);
  }

  const marker: SimPingMarker = {
    id: ++this.nextEntityId,
    playerId: p.id,
    playerSlot: p.slot,
    kind,
    labelVi,
    x: px,
    y: py,
    ttlSec: 4.0,
  };
  this.pings.push(marker);
  this.events.push({
    kind: 'ping_issued',
    pingId: marker.id,
    playerId: p.id,
    playerSlot: p.slot,
    pingKind: kind,
    labelVi,
    x: px,
    y: py,
  });
  return marker;
}

export function triggerEmoteImpl(this: WorldSim, playerId: number, emoteId: QuickEmoteId): boolean {
  const p = this.getPlayerById(playerId);
  const labelVi = QUICK_EMOTES_VI[emoteId];
  if (!p || !labelVi) return false;
  p.emoteId = emoteId;
  p.emoteTimer = 2.5;
  this.events.push({
    kind: 'emote_triggered',
    playerId: p.id,
    emoteId,
    labelVi,
    x: p.x,
    y: p.y,
  });
  return true;
}

export function spawnDroppedWeaponImpl(
  this: WorldSim,
  weaponId: string,
  x: number,
  y: number,
  droppedByPlayerId = this.player.id,
  fromX = x,
  fromY = y,
): SimWorldItemState | null {
  const wep = WEAPONS[weaponId];
  if (!wep) return null;

  const droppedItem = this.spawnWorldItem({
    kind: 'weapon',
    weaponId: wep.id,
    rarity: wep.rarity,
    nameVi: wep.nameVi,
    costGold: 0,
    healAmount: 0,
    x,
    y,
    ownerPlayerId: undefined,
    droppedByPlayerId,
    droppedAtTick: this.tick,
    fromX,
    fromY,
  });

  this.events.push({
    kind: 'weapon_dropped',
    playerId: droppedByPlayerId,
    itemId: droppedItem.id,
    weaponId: wep.id,
    rarity: wep.rarity,
    fromX,
    fromY,
    x,
    y,
  });

  const dropper = this.getPlayerById(droppedByPlayerId);
  if (dropper) {
    dropper.weaponPickupLockTimer = 0.3;
  }

  if (!this.inHub) {
    this.roomItemsByRoomId.set(this.currentRoomId, [...this.worldItems]);
  }

  return droppedItem;
}

export function dropActiveWeaponImpl(this: WorldSim, playerId = this.player.id): SimWorldItemState | null {
  const p = this.getPlayerById(playerId);
  if (!p || p.lifeState !== 'alive' || p.weaponSlots.length <= 1) return null;
  const activeIdx = clamp(p.activeWeaponSlot, 0, p.weaponSlots.length - 1);
  const wid = p.weaponSlots[activeIdx]!;
  const wep = WEAPONS[wid];
  if (!wep) return null;

  p.weaponSlots.splice(activeIdx, 1);
  p.activeWeaponSlot = Math.min(activeIdx, p.weaponSlots.length - 1);
  syncActiveWeaponCadenceState(p);

  const dropX = p.x + Math.cos(p.aimAngle) * 28;
  const dropY = p.y + Math.sin(p.aimAngle) * 28;
  const resolved = this.map.resolveCircleCollision(dropX, dropY, 15);
  const droppedItem = this.spawnDroppedWeapon(wid, resolved.x, resolved.y, p.id, p.x, p.y);
  this.events.push({
    kind: 'weapon_swapped',
    playerId: p.id,
    weaponId: p.weaponSlots[p.activeWeaponSlot]!,
    slot: p.activeWeaponSlot,
  });
  return droppedItem;
}

export function updateCoopDownedAndReviveImpl(this: WorldSim, dtSec: number): void {
  const allPlayers = this.getAllPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const downed = allPlayers[i]!;
    if (downed.lifeState !== 'downed') continue;

    // Find an alive teammate within 64 units holding INTERACT (E) or standing within 46 units
    let reviver: SimPlayerState | null = null;
    for (let j = 0; j < allPlayers.length; j++) {
      const ally = allPlayers[j]!;
      if (ally.id === downed.id || ally.lifeState !== 'alive') continue;
      const d = distance(downed.x, downed.y, ally.x, ally.y);
      if (d <= 64) {
        const allyButtons =
          ally.id === this.player.id
            ? this.currentInput.buttons
            : (this.coopPlayerInputs.get(ally.id)?.current.buttons ?? 0);
        if ((allyButtons & INPUT_BUTTON.INTERACT) !== 0 || (this.botAutoPlayActive && d <= 46)) {
          reviver = ally;
          break;
        }
      }
    }

    if (reviver) {
      downed.reviverPlayerId = reviver.id;
      const requiredSec =
        reviver.characterId === 'druid'
          ? DRUID_REVIVE_HOLD_DURATION_SEC
          : REVIVE_HOLD_DURATION_SEC;
      downed.reviveProgress = Math.min(1, downed.reviveProgress + dtSec / requiredSec);
      if (downed.reviveProgress >= 1) {
        downed.lifeState = 'alive';
        downed.hp = 2;
        downed.armor = Math.min(downed.maxArmor, 2);
        downed.invulnerableTimer = 1.5;
        downed.downedTimer = 0;
        downed.reviveProgress = 0;
        downed.reviverPlayerId = null;
        reviver.statsRevives = (reviver.statsRevives ?? 0) + 1;
        this.events.push({
          kind: 'player_revived',
          playerId: downed.id,
          reviverId: reviver.id,
          x: downed.x,
          y: downed.y,
        });
        continue;
      }
    } else {
      downed.reviverPlayerId = null;
      downed.reviveProgress = Math.max(0, downed.reviveProgress - dtSec * 0.5);
      downed.downedTimer = Math.max(0, downed.downedTimer - dtSec);
      if (downed.downedTimer <= 0) {
        downed.lifeState = 'ghost';
        downed.reviveProgress = 0;
        this.events.push({
          kind: 'player_ghost',
          playerId: downed.id,
          x: downed.x,
          y: downed.y,
        });
      }
    }
  }
}
