import type {
  AshenPactId,
  AshenRelicId,
  BlessingId,
  CharacterId,
  DuoBoonId,
  EliteModifier,
  ElementType,
  WeaponMutatorId,
} from '../data/types.js';
import type { SurfaceKind } from '../sim/arena-map.js';
import type {
  EnemyAIState,
  PlayerLifeState,
  SimChestState,
  SimEvent,
  SimHubStatue,
  SimNpcState,
  SimPingMarker,
  SimPressurePlateState,
  SimPropState,
  SimPushBlockState,
  SimSkillZoneState,
  SimSummonState,
  SimWorldItemState,
  WorldSim,
} from '../sim/world-sim.js';
import { type QuickEmoteId, quantizeAngle, quantizeCoord } from './messages.js';

export interface QuantizedPlayerSnap {
  id: number;
  slot: 1 | 2 | 3 | 4;
  name: string;
  color: string;
  charId: CharacterId;
  life: PlayerLifeState;
  downTimer10: number;
  revProg100: number;
  reviverId: number | null;
  ready: boolean;
  pingMs: number;
  emoteId: QuickEmoteId | null;
  emoteTimer10: number;
  roomId: number;
  qx: number;
  qy: number;
  vx: number;
  vy: number;
  qAngle: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  clipAmmo: number;
  clipMax: number;
  heat10: number;
  reload100: number;
  reloadDur100: number;
  overclock: boolean;
  overheat100: number;
  comboStep: 0 | 1 | 2;
  vgBonus100: number;
  conv10: number;
  gold: number;
  dashTimer100: number;
  dashCd100: number;
  skillCd10: number;
  skillAct10: number;
  shieldBullets: number;
  activeSlot: number;
  weaponSlots: string[];
  blessings: BlessingId[];
  mutators: Record<number, WeaponMutatorId[]>;
  duoBoons: DuoBoonId[];
  pact: AshenPactId | null;
  pactOrigWep: string | null;
  relics: AshenRelicId[];
  buffChoices: BlessingId[];
  wepLevels?: Record<number, number>;
  fireCd100: number;
  imbue: ElementType;
  lastSeq: number;
  stDmg?: number;
  stTaken?: number;
  stKills?: number;
  stRevives?: number;
  stElem?: number;
  stCombo?: number;
}

export interface QuantizedEnemySnap {
  id: number;
  defId: string;
  qx: number;
  qy: number;
  vx: number;
  vy: number;
  qAngle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  ai: EnemyAIState;
  st100: number;
  qTelAngle: number;
  telRad: number;
  telLen: number;
  elite: boolean;
  eliteMod: EliteModifier | null;
  boss: boolean;
  bossPh: 1 | 2 | 3;
  burrow: boolean;
  burn10: number;
  chill: number;
  froz10: number;
  shock10: number;
  poison: number;
  mark10?: number;
  sc10?: number;
  root10?: number;
  blind10?: number;
}

/**
 * Compact tuple for active projectiles:
 * [id, ownerId, teamBit(0=player,1=enemy), weaponId, qx, qy, vx, vy, qAngle, radius10, ttl100, element, ampBit]
 */
export type QuantizedProjectileTuple = [
  number,
  number,
  0 | 1,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  ElementType,
  0 | 1,
];

/**
 * Compact tuple for non-none surface cells:
 * [tileIndex, surfaceKind, timer10]
 */
export type QuantizedSurfaceTuple = [number, SurfaceKind, number];

export interface QuantizedWorldSnapshot {
  tick: number;
  serverTimeMs: number;
  seed: string | number;
  inHub: boolean;
  allowDuplicateCharacters: boolean;
  runState: 'playing' | 'buff_choice' | 'victory' | 'defeat';
  currentFloor: 1 | 2 | 3 | 4 | 5 | 6;
  currentBiome?: 1 | 2 | 3;
  currentRoomId: number;
  doorsLocked: boolean;
  secretWallBroken: boolean;
  portalActive: boolean;
  portalX: number;
  portalY: number;
  players: QuantizedPlayerSnap[];
  enemies: QuantizedEnemySnap[];
  projectiles: QuantizedProjectileTuple[];
  props: SimPropState[];
  chests: SimChestState[];
  worldItems: SimWorldItemState[];
  npcEntities: SimNpcState[];
  pickups: Array<{
    id: number;
    kind: 'gold' | 'life_seed' | 'prey_emblem';
    qx: number;
    qy: number;
    amount: number;
    ownerId?: number;
  }>;
  pings: SimPingMarker[];
  hubStatues: SimHubStatue[];
  summons?: SimSummonState[];
  skillZones?: SimSkillZoneState[];
  pressurePlates?: SimPressurePlateState[];
  pushBlocks?: SimPushBlockState[];
  coopPuzzleCompleted?: boolean;
  teamComboCount?: number;
  runStats?: {
    floorReached: number;
    roomsCleared: number;
    chestsOpened: number;
    kills: number;
    elitesKilled: number;
    bossesKilled: number;
    damageDealt: number;
    goldEarned: number;
    ticksElapsed: number;
    elementalReactions: number;
    teamCombos: number;
  };
  surfaces: QuantizedSurfaceTuple[];
  discoveredRooms: Array<{
    id: number;
    discovery: 'hidden' | 'discovered' | 'visited' | 'cleared';
    cleared: boolean;
  }>;
  events: SimEvent[];
}

export function encodeWorldSnapshot(
  sim: WorldSim,
  events: SimEvent[],
  allowDuplicateCharacters = sim.allowDuplicateCharacters,
  serverTimeMs = Date.now(),
): QuantizedWorldSnapshot {
  const allPlayers = sim.getAllPlayers();
  const players: QuantizedPlayerSnap[] = allPlayers.map((p) => ({
    id: p.id,
    slot: p.slot,
    name: p.displayName,
    color: p.colorHex,
    charId: p.characterId,
    life: p.lifeState,
    downTimer10: Math.round(p.downedTimer * 10),
    revProg100: Math.round(p.reviveProgress * 100),
    reviverId: p.reviverPlayerId,
    ready: p.ready,
    pingMs: Math.round(p.pingMs),
    emoteId: p.emoteId,
    emoteTimer10: Math.round(p.emoteTimer * 10),
    roomId: p.currentRoomId,
    qx: quantizeCoord(p.x),
    qy: quantizeCoord(p.y),
    vx: Math.round(p.vx),
    vy: Math.round(p.vy),
    qAngle: quantizeAngle(p.aimAngle),
    hp: p.hp,
    maxHp: p.maxHp,
    armor: p.armor,
    maxArmor: p.maxArmor,
    clipAmmo: p.clipAmmo,
    clipMax: p.clipMax,
    heat10: Math.round(p.weaponHeat * 10),
    reload100: Math.round(p.reloadTimer * 100),
    reloadDur100: Math.round(p.reloadDuration * 100),
    overclock: p.overclockedNextShot,
    overheat100: Math.round(p.overheatLockTimer * 100),
    comboStep: p.meleeComboStep,
    vgBonus100: Math.round(p.vanguardShieldBonusAdd * 100),
    conv10: Math.round(p.elementalConvergenceTimer * 10),
    gold: p.gold,
    dashTimer100: Math.round(p.dashTimer * 100),
    dashCd100: Math.round(p.dashCooldownTimer * 100),
    skillCd10: Math.round(p.skillCooldownTimer * 10),
    skillAct10: Math.round(p.skillActiveTimer * 10),
    shieldBullets: p.shieldStoredBullets,
    activeSlot: p.activeWeaponSlot,
    weaponSlots: [...p.weaponSlots],
    blessings: [...p.blessingIds],
    mutators: {
      0: [...(p.weaponMutators?.[0] ?? [])],
      1: [...(p.weaponMutators?.[1] ?? [])],
    },
    duoBoons: [...p.duoBoonIds],
    pact: p.activePactId,
    pactOrigWep: p.pactOriginalWeaponId,
    relics: [...p.awakenedRelicIds],
    buffChoices: [...p.buffChoices],
    wepLevels: {
      0: p.weaponUpgradeLevels?.[0] ?? 0,
      1: p.weaponUpgradeLevels?.[1] ?? 0,
    },
    fireCd100: Math.round(p.fireCooldownTimer * 100),
    imbue: p.activeImbueElement,
    lastSeq: p.lastProcessedSeq,
    stDmg: Math.round(p.statsDamageDealt ?? 0),
    stTaken: Math.round(p.statsDamageTaken ?? 0),
    stKills: p.statsKills ?? 0,
    stRevives: p.statsRevives ?? 0,
    stElem: p.statsElementalReactions ?? 0,
    stCombo: p.statsTeamCombos ?? 0,
  }));

  const enemies: QuantizedEnemySnap[] = sim.enemies.map((e) => ({
    id: e.id,
    defId: e.defId,
    qx: quantizeCoord(e.x),
    qy: quantizeCoord(e.y),
    vx: Math.round(e.vx),
    vy: Math.round(e.vy),
    qAngle: quantizeAngle(e.aimAngle),
    hp: e.hp,
    maxHp: e.maxHp,
    shield: e.shieldArmor,
    maxShield: e.maxShieldArmor,
    ai: e.aiState,
    st100: Math.round(e.stateTimer * 100),
    qTelAngle: quantizeAngle(e.telegraphAngle),
    telRad: Math.round(e.telegraphRadius),
    telLen: Math.round(e.telegraphLength),
    elite: e.isElite,
    eliteMod: e.eliteModifier,
    boss: e.isBoss,
    bossPh: e.bossPhase,
    burrow: e.bossBurrowed,
    burn10: Math.round(e.burnTimer * 10),
    chill: e.chillStacks,
    froz10: Math.round(e.frozenTimer * 10),
    shock10: Math.round(e.shockTimer * 10),
    poison: e.poisonStacks,
    mark10: Math.round(e.markedTimer * 10),
    sc10: Math.round(e.superconductTimer * 10),
    root10: Math.round(e.rootedTimer * 10),
    blind10: Math.round(e.steamBlindTimer * 10),
  }));

  // Projectiles are spawned deterministically via bullet_volley_spawned events and simulated locally by clients
  const projectiles: QuantizedProjectileTuple[] = [];

  const pickups = sim.pickups.slice(0, 64).map((pk) => ({
    id: pk.id,
    kind: pk.kind,
    qx: quantizeCoord(pk.x),
    qy: quantizeCoord(pk.y),
    amount: pk.amount,
    ownerId: pk.ownerPlayerId,
  }));

  const surfaces: QuantizedSurfaceTuple[] = [];
  for (let i = 0; i < sim.map.surfaces.length; i++) {
    const sk = sim.map.surfaces[i]!;
    if (sk !== 'none') {
      surfaces.push([i, sk, Math.round((sim.map.surfaceTimers[i] ?? 0) * 10)]);
    }
  }

  const discoveredRooms = sim.dungeon.rooms.map((r) => ({
    id: r.id,
    discovery: r.discovery,
    cleared: r.cleared,
  }));

  const priorityEvents: SimEvent[] = [];
  const otherEvents: SimEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;
    if (
      ev.kind === 'projectile_spawned' ||
      (ev.kind === 'projectile_impact' && !ev.destroyedByMelee && !ev.blockedByShield)
    ) {
      continue;
    }
    if (ev.kind === 'bullet_volley_spawned' || ev.kind === 'projectiles_destroyed') {
      priorityEvents.push(ev);
    } else {
      otherEvents.push(ev);
    }
  }
  const netEvents = [...priorityEvents, ...otherEvents].slice(0, 64);

  return {
    tick: sim.tick,
    serverTimeMs,
    seed: sim.baseSeed,
    inHub: sim.inHub,
    allowDuplicateCharacters,
    runState: sim.runState,
    currentFloor: sim.currentFloor,
    currentBiome: sim.currentBiome,
    currentRoomId: sim.currentRoomId,
    doorsLocked: sim.doors.some((d) => d.locked),
    secretWallBroken: sim.secretWallBroken,
    portalActive: sim.portalActive,
    portalX: sim.portalX,
    portalY: sim.portalY,
    players,
    enemies,
    projectiles,
    props: sim.props.map((pr) => ({ ...pr })),
    chests: sim.chests.map((c) => ({ ...c })),
    worldItems: sim.worldItems.map((wi) => ({ ...wi })),
    npcEntities: sim.npcEntities.map((n) => ({ ...n })),
    pickups,
    pings: sim.pings.map((pg) => ({ ...pg })),
    hubStatues: sim.hubStatues.map((st) => ({ ...st })),
    summons: sim.summons.map((s) => ({ ...s })),
    skillZones: sim.skillZones.map((z) => ({ ...z })),
    pressurePlates: sim.pressurePlates.map((p) => ({ ...p })),
    pushBlocks: sim.pushBlocks.map((b) => ({ ...b })),
    coopPuzzleCompleted: sim.coopPuzzleCompleted,
    teamComboCount: sim.teamComboCount,
    runStats: { ...sim.runStats },
    surfaces,
    discoveredRooms,
    events: netEvents,
  };
}

export function estimateSnapshotBytes(snapshot: QuantizedWorldSnapshot): number {
  return (
    36 +
    snapshot.players.length * 48 +
    snapshot.enemies.length * 34 +
    snapshot.projectiles.length * 16 +
    snapshot.pickups.length * 10 +
    snapshot.surfaces.length * 4 +
    snapshot.events.length * 14
  );
}
