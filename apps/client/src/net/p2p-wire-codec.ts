import type {
  AshenPactId,
  AshenRelicId,
  BlessingId,
  BuffId,
  CharacterId,
  DuoBoonId,
  EliteModifier,
  ElementType,
  EnemyAIState,
  PlayerLifeState,
  QuantizedEnemySnap,
  QuantizedPlayerSnap,
  QuantizedProjectileTuple,
  QuantizedSurfaceTuple,
  QuantizedWorldSnapshot,
  QuickEmoteId,
  SimChestState,
  SimEvent,
  SimHubStation,
  SimHubStatue,
  SimMagneticRivetState,
  SimNpcState,
  SimPingMarker,
  SimPressurePlateState,
  SimPropState,
  SimPushBlockState,
  SimSkillZoneState,
  SimSummonState,
  SimTetherBeamState,
  SimWorldItemState,
  WeaponMutatorId,
} from '@ashen-pact/shared';

export interface P2PPlayerBaseline {
  id: number;
  slot: 1 | 2 | 3 | 4;
  name: string;
  color: string;
  charId: CharacterId;
  maxHp: number;
  maxArmor: number;
  clipMax: number;
  weaponSlots: string[];
  blessings: BlessingId[];
  mutators: Record<number, WeaponMutatorId[]>;
  duoBoons: DuoBoonId[];
  pact: AshenPactId | null;
  pactOrigWep: string | null;
  relics: AshenRelicId[];
  buffChoices: BuffId[];
  mutatorChoices?: WeaponMutatorId[];
  pactChoices?: AshenPactId[];
  wepLevels?: Record<number, number>;
}

export interface P2PEnemyBaseline {
  id: number;
  defId: string;
  maxHp: number;
  maxShield: number;
  elite: boolean;
  eliteMod: EliteModifier | null;
  boss: boolean;
}

export interface P2PSnapshotBaseline {
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
  props: SimPropState[];
  chests: SimChestState[];
  worldItems: SimWorldItemState[];
  npcEntities: SimNpcState[];
  hubStatues: SimHubStatue[];
  hubStations?: SimHubStation[];
  pressurePlates?: SimPressurePlateState[];
  discoveredRooms: Array<{
    id: number;
    discovery: 'hidden' | 'discovered' | 'visited' | 'cleared';
    cleared: boolean;
  }>;
  coopPuzzleCompleted?: boolean;
  secretTrialActive?: boolean;
  secretTrialResult?: 'idle' | 'active' | 'victory' | 'expired';
  /** Bitmask recording whether optional fast-array keys were present on the source snapshot. */
  optArrayMask: number;
  players: P2PPlayerBaseline[];
  enemies: P2PEnemyBaseline[];
}

export interface P2PPlayerFastExtra {
  dt?: number;
  rp?: number;
  rv?: number | null;
  em?: QuickEmoteId | null;
  et?: number;
  vg?: number;
  cv?: number;
  sb?: number;
  scId?: number | null;
  scKind?: 'player' | 'enemy' | null;
  scTimer?: number;
  pkWep?: string | null;
  pkTimer?: number;
  sv100?: number;
  svId?: number;
  /** Bitmask recording explicitly undefined optional fields when omitted on synthetic snapshots. */
  uMask?: number;
}

export type P2PPlayerStatsTuple = [
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];

export type P2PPlayerFastTuple =
  | [
      number, // 0: id
      number, // 1: qx
      number, // 2: qy
      number, // 3: vx
      number, // 4: vy
      number, // 5: qAngle
      number, // 6: hp
      number, // 7: armor
      number, // 8: clipAmmo
      number, // 9: activeSlot
      number, // 10: dashTimer100
      number, // 11: dashCd100
      number, // 12: fireCd100
      number, // 13: reload100
      number, // 14: reloadDur100
      number, // 15: heat10
      number, // 16: overheat100
      number, // 17: skillCd10
      number, // 18: skillAct10
      number, // 19: lastSeq
      number, // 20: pingMs
      number, // 21: gold
      number, // 22: roomId
      number, // 23: flagsBitmask
      P2PPlayerStatsTuple | null, // 24: statsTupleOrNull
    ]
  | [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      P2PPlayerStatsTuple | null,
      P2PPlayerFastExtra, // 25: rare transient player state
    ];

export type P2PEnemyStatusTuple = [
  number, // 0: burn10
  number, // 1: chill
  number, // 2: froz10
  number, // 3: shock10
  number, // 4: poison
  number, // 5: mark10 (-1 = undefined)
  number, // 6: sc10 (-1 = undefined)
  number, // 7: root10 (-1 = undefined)
  number, // 8: blind10 (-1 = undefined)
  number, // 9: stuckArrows (-1 = undefined)
  number, // 10: parasiticThorns (-1 = undefined)
  number, // 11: napalm10 (-1 = undefined)
];

export type P2PEnemyFastTuple =
  | [
      number, // 0: id
      number, // 1: qx
      number, // 2: qy
      number, // 3: vx
      number, // 4: vy
      number, // 5: qAngle
      number, // 6: hp
      number, // 7: shield
      number | EnemyAIState, // 8: aiCode or raw EnemyAIState
      number, // 9: st100
      number, // 10: qTelAngle
      number, // 11: telRad
      number, // 12: telLen
      number, // 13: bossFlags ((bossPh & 3) | (burrow ? 4 : 0))
    ]
  | [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number | EnemyAIState,
      number,
      number,
      number,
      number,
      number,
      P2PEnemyStatusTuple, // 14: non-zero or undefined-aware status tuple
    ];

export type P2PPickupFastTuple =
  | [number, 0 | 1 | 2, number, number, number]
  | [number, 0 | 1 | 2, number, number, number, number];

export type P2PRunStatsTuple = [
  number, // 0: floorReached
  number, // 1: roomsCleared
  number, // 2: chestsOpened
  number, // 3: kills
  number, // 4: elitesKilled
  number, // 5: bossesKilled
  number, // 6: damageDealt
  number, // 7: goldEarned
  number, // 8: ticksElapsed
  number, // 9: elementalReactions
  number, // 10: teamCombos
];

/**
 * [hasExplicitSeq(0|1), teamComboCount(-1=undef), secretTrialTimer100(-1=undef), secretTrialBanner10(-1=undef), secretTrialRemaining(-1=undef)]
 */
export type P2PWorldFastTimersTuple = [0 | 1, number, number, number, number];

export interface P2PWorldFastExtras {
  pg?: SimPingMarker[];
  sm?: SimSummonState[];
  sz?: SimSkillZoneState[];
  pb?: SimPushBlockState[];
  tb?: SimTetherBeamState[];
  mr?: SimMagneticRivetState[];
  pj?: QuantizedProjectileTuple[];
  ev?: SimEvent[];
}

export type P2PFastFrame =
  | [
      number, // 0: baseline rev
      number, // 1: wireSeq
      number, // 2: tick
      number, // 3: serverTimeMs
      P2PWorldFastTimersTuple, // 4: world timers & explicit-seq flag
      P2PRunStatsTuple | null, // 5: runStats tuple
      P2PPlayerFastTuple[], // 6: players
      P2PEnemyFastTuple[], // 7: enemies
      P2PPickupFastTuple[], // 8: pickups
      QuantizedSurfaceTuple[], // 9: surfaces
    ]
  | [
      number,
      number,
      number,
      number,
      P2PWorldFastTimersTuple,
      P2PRunStatsTuple | null,
      P2PPlayerFastTuple[],
      P2PEnemyFastTuple[],
      P2PPickupFastTuple[],
      QuantizedSurfaceTuple[],
      P2PWorldFastExtras, // 10: non-empty transient arrays
    ];

const LIFE_INDEX: Record<PlayerLifeState, number> = {
  alive: 0,
  downed: 1,
  ghost: 2,
};
const LIFE_STATES: readonly PlayerLifeState[] = ['alive', 'downed', 'ghost'];

const ELEMENT_INDEX: Record<ElementType, number> = {
  none: 0,
  burn: 1,
  chill: 2,
  shock: 3,
  poison: 4,
};
const ELEMENTS: readonly ElementType[] = ['none', 'burn', 'chill', 'shock', 'poison'];

const PICKUP_KINDS = ['gold', 'life_seed', 'prey_emblem'] as const;

const AI_INDEX: Record<EnemyAIState, number> = {
  spawning: 0,
  idle: 1,
  move: 2,
  chase: 3,
  telegraph: 4,
  attack: 5,
  cooldown: 6,
  stunned: 7,
};
const AI_STATES: readonly EnemyAIState[] = [
  'spawning',
  'idle',
  'move',
  'chase',
  'telegraph',
  'attack',
  'cooldown',
  'stunned',
];
const AI_TO_CODE = new Map<EnemyAIState, number>(
  Object.entries(AI_INDEX).map(([k, v]) => [k as EnemyAIState, v]),
);
void LIFE_INDEX;
void ELEMENT_INDEX;

const OPT_SUMMONS = 1 << 0;
const OPT_SKILL_ZONES = 1 << 1;
const OPT_PUSH_BLOCKS = 1 << 2;
const OPT_TETHER_BEAMS = 1 << 3;
const OPT_MAGNETIC_RIVETS = 1 << 4;

const PLAYER_UNDEF_SC_ID = 1 << 0;
const PLAYER_UNDEF_SC_KIND = 1 << 1;
const PLAYER_UNDEF_SC_TIMER = 1 << 2;
const PLAYER_UNDEF_PK_WEP = 1 << 3;
const PLAYER_UNDEF_PK_TIMER = 1 << 4;
const PLAYER_UNDEF_SV100 = 1 << 5;
const PLAYER_UNDEF_SV_ID = 1 << 6;

function extractBaseline(snap: QuantizedWorldSnapshot): P2PSnapshotBaseline {
  let optArrayMask = 0;
  if (snap.summons !== undefined) optArrayMask |= OPT_SUMMONS;
  if (snap.skillZones !== undefined) optArrayMask |= OPT_SKILL_ZONES;
  if (snap.pushBlocks !== undefined) optArrayMask |= OPT_PUSH_BLOCKS;
  if (snap.tetherBeams !== undefined) optArrayMask |= OPT_TETHER_BEAMS;
  if (snap.magneticRivets !== undefined) optArrayMask |= OPT_MAGNETIC_RIVETS;

  const players: P2PPlayerBaseline[] = snap.players.map((p) => {
    const base: P2PPlayerBaseline = {
      id: p.id,
      slot: p.slot,
      name: p.name,
      color: p.color,
      charId: p.charId,
      maxHp: p.maxHp,
      maxArmor: p.maxArmor,
      clipMax: p.clipMax,
      weaponSlots: [...p.weaponSlots],
      blessings: [...p.blessings],
      mutators: Object.fromEntries(
        Object.entries(p.mutators).map(([k, v]) => [Number(k), [...v]]),
      ),
      duoBoons: [...p.duoBoons],
      pact: p.pact,
      pactOrigWep: p.pactOrigWep,
      relics: [...p.relics],
      buffChoices: [...p.buffChoices],
    };
    if (p.mutatorChoices !== undefined) base.mutatorChoices = [...p.mutatorChoices];
    if (p.pactChoices !== undefined) base.pactChoices = [...p.pactChoices];
    if (p.wepLevels !== undefined) base.wepLevels = { ...p.wepLevels };
    return base;
  });

  const enemies: P2PEnemyBaseline[] = snap.enemies.map((e) => ({
    id: e.id,
    defId: e.defId,
    maxHp: e.maxHp,
    maxShield: e.maxShield,
    elite: e.elite,
    eliteMod: e.eliteMod,
    boss: e.boss,
  }));

  const baseline: P2PSnapshotBaseline = {
    seed: snap.seed,
    inHub: snap.inHub,
    allowDuplicateCharacters: snap.allowDuplicateCharacters,
    runState: snap.runState,
    currentFloor: snap.currentFloor,
    currentRoomId: snap.currentRoomId,
    doorsLocked: snap.doorsLocked,
    secretWallBroken: snap.secretWallBroken,
    portalActive: snap.portalActive,
    portalX: snap.portalX,
    portalY: snap.portalY,
    props: snap.props.map((pr) => ({
      ...pr,
      ...(pr.hitEnemyIds ? { hitEnemyIds: [...pr.hitEnemyIds] } : {}),
    })),
    chests: snap.chests.map((c) => ({ ...c })),
    worldItems: snap.worldItems.map((wi) => ({ ...wi })),
    npcEntities: snap.npcEntities.map((n) => ({ ...n })),
    hubStatues: snap.hubStatues.map((st) => ({ ...st })),
    discoveredRooms: snap.discoveredRooms.map((r) => ({ ...r })),
    optArrayMask,
    players,
    enemies,
  };

  if (snap.currentBiome !== undefined) baseline.currentBiome = snap.currentBiome;
  if (snap.hubStations !== undefined) {
    baseline.hubStations = snap.hubStations.map((st) => ({ ...st }));
  }
  if (snap.pressurePlates !== undefined) {
    baseline.pressurePlates = snap.pressurePlates.map((pp) => ({ ...pp }));
  }
  if (snap.coopPuzzleCompleted !== undefined) {
    baseline.coopPuzzleCompleted = snap.coopPuzzleCompleted;
  }
  if (snap.secretTrialActive !== undefined) {
    baseline.secretTrialActive = snap.secretTrialActive;
  }
  if (snap.secretTrialResult !== undefined) {
    baseline.secretTrialResult = snap.secretTrialResult;
  }

  return baseline;
}

function encodePlayerFast(p: QuantizedPlayerSnap): P2PPlayerFastTuple {
  const lifeCode = Math.max(0, LIFE_STATES.indexOf(p.life));
  const imbueCode = Math.max(0, ELEMENTS.indexOf(p.imbue));
  let flags = 0;
  if (p.ready) flags |= 1;
  if (p.overclock) flags |= 2;
  if (p.blackCrystalEmpowered === true) flags |= 4;
  if (p.blackCrystalEmpowered === undefined) flags |= 8;
  flags |= (lifeCode & 3) << 4;
  flags |= (p.comboStep & 3) << 6;
  flags |= (imbueCode & 7) << 8;

  const allStatsUndef =
    p.stDmg === undefined &&
    p.stTaken === undefined &&
    p.stKills === undefined &&
    p.stRevives === undefined &&
    p.stElem === undefined &&
    p.stCombo === undefined;
  const statsTuple: P2PPlayerStatsTuple | null = allStatsUndef
    ? null
    : [
        p.stDmg ?? null,
        p.stTaken ?? null,
        p.stKills ?? null,
        p.stRevives ?? null,
        p.stElem ?? null,
        p.stCombo ?? null,
      ];

  let uMask = 0;
  if (p.soulChainTargetId === undefined) uMask |= PLAYER_UNDEF_SC_ID;
  if (p.soulChainTargetKind === undefined) uMask |= PLAYER_UNDEF_SC_KIND;
  if (p.soulChainStretchTimer === undefined) uMask |= PLAYER_UNDEF_SC_TIMER;
  if (p.pactKeepWep === undefined) uMask |= PLAYER_UNDEF_PK_WEP;
  if (p.pactKeepTimer10 === undefined) uMask |= PLAYER_UNDEF_PK_TIMER;
  if (p.salvage100 === undefined) uMask |= PLAYER_UNDEF_SV100;
  if (p.salvageItemId === undefined) uMask |= PLAYER_UNDEF_SV_ID;

  const extra: P2PPlayerFastExtra = {};
  let hasExtra = false;
  if (p.downTimer10 !== 0) {
    extra.dt = p.downTimer10;
    hasExtra = true;
  }
  if (p.revProg100 !== 0) {
    extra.rp = p.revProg100;
    hasExtra = true;
  }
  if (p.reviverId !== null) {
    extra.rv = p.reviverId;
    hasExtra = true;
  }
  if (p.emoteId !== null) {
    extra.em = p.emoteId;
    hasExtra = true;
  }
  if (p.emoteTimer10 !== 0) {
    extra.et = p.emoteTimer10;
    hasExtra = true;
  }
  if (p.vgBonus100 !== 0) {
    extra.vg = p.vgBonus100;
    hasExtra = true;
  }
  if (p.conv10 !== 0) {
    extra.cv = p.conv10;
    hasExtra = true;
  }
  if (p.shieldBullets !== 0) {
    extra.sb = p.shieldBullets;
    hasExtra = true;
  }
  if (p.soulChainTargetId !== undefined && p.soulChainTargetId !== null) {
    extra.scId = p.soulChainTargetId;
    hasExtra = true;
  }
  if (p.soulChainTargetKind !== undefined && p.soulChainTargetKind !== null) {
    extra.scKind = p.soulChainTargetKind;
    hasExtra = true;
  }
  if (p.soulChainStretchTimer !== undefined && p.soulChainStretchTimer !== 0) {
    extra.scTimer = p.soulChainStretchTimer;
    hasExtra = true;
  }
  if (p.pactKeepWep !== undefined && p.pactKeepWep !== null) {
    extra.pkWep = p.pactKeepWep;
    hasExtra = true;
  }
  if (p.pactKeepTimer10 !== undefined && p.pactKeepTimer10 !== 0) {
    extra.pkTimer = p.pactKeepTimer10;
    hasExtra = true;
  }
  if (p.salvage100 !== undefined && p.salvage100 !== 0) {
    extra.sv100 = p.salvage100;
    hasExtra = true;
  }
  if (p.salvageItemId !== undefined && p.salvageItemId !== 0) {
    extra.svId = p.salvageItemId;
    hasExtra = true;
  }
  if (uMask !== 0) {
    extra.uMask = uMask;
    hasExtra = true;
  }

  if (hasExtra) {
    return [
      p.id,
      p.qx,
      p.qy,
      p.vx,
      p.vy,
      p.qAngle,
      p.hp,
      p.armor,
      p.clipAmmo,
      p.activeSlot,
      p.dashTimer100,
      p.dashCd100,
      p.fireCd100,
      p.reload100,
      p.reloadDur100,
      p.heat10,
      p.overheat100,
      p.skillCd10,
      p.skillAct10,
      p.lastSeq,
      p.pingMs,
      p.gold,
      p.roomId,
      flags,
      statsTuple,
      extra,
    ];
  }

  return [
    p.id,
    p.qx,
    p.qy,
    p.vx,
    p.vy,
    p.qAngle,
    p.hp,
    p.armor,
    p.clipAmmo,
    p.activeSlot,
    p.dashTimer100,
    p.dashCd100,
    p.fireCd100,
    p.reload100,
    p.reloadDur100,
    p.heat10,
    p.overheat100,
    p.skillCd10,
    p.skillAct10,
    p.lastSeq,
    p.pingMs,
    p.gold,
    p.roomId,
    flags,
    statsTuple,
  ];
}

function decodePlayerFast(
  base: P2PPlayerBaseline,
  tuple: P2PPlayerFastTuple,
): QuantizedPlayerSnap {
  const flags = tuple[23];
  const life = LIFE_STATES[(flags >> 4) & 3] ?? 'alive';
  const comboStep = (((flags >> 6) & 3) as 0 | 1 | 2);
  const imbue = ELEMENTS[(flags >> 8) & 7] ?? 'none';
  const stats = tuple[24];
  const extra = tuple[25];
  const uMask = extra?.uMask ?? 0;

  const snap: QuantizedPlayerSnap = {
    id: base.id,
    slot: base.slot,
    name: base.name,
    color: base.color,
    charId: base.charId,
    life,
    downTimer10: extra?.dt ?? 0,
    revProg100: extra?.rp ?? 0,
    reviverId: extra && 'rv' in extra ? (extra.rv ?? null) : null,
    ready: (flags & 1) !== 0,
    pingMs: tuple[20],
    emoteId: extra && 'em' in extra ? (extra.em ?? null) : null,
    emoteTimer10: extra?.et ?? 0,
    roomId: tuple[22],
    qx: tuple[1],
    qy: tuple[2],
    vx: tuple[3],
    vy: tuple[4],
    qAngle: tuple[5],
    hp: tuple[6],
    maxHp: base.maxHp,
    armor: tuple[7],
    maxArmor: base.maxArmor,
    clipAmmo: tuple[8],
    clipMax: base.clipMax,
    heat10: tuple[15],
    reload100: tuple[13],
    reloadDur100: tuple[14],
    overclock: (flags & 2) !== 0,
    overheat100: tuple[16],
    comboStep,
    vgBonus100: extra?.vg ?? 0,
    conv10: extra?.cv ?? 0,
    gold: tuple[21],
    dashTimer100: tuple[10],
    dashCd100: tuple[11],
    skillCd10: tuple[17],
    skillAct10: tuple[18],
    shieldBullets: extra?.sb ?? 0,
    activeSlot: tuple[9],
    weaponSlots: [...base.weaponSlots],
    blessings: [...base.blessings],
    mutators: Object.fromEntries(
      Object.entries(base.mutators).map(([k, v]) => [Number(k), [...v]]),
    ),
    duoBoons: [...base.duoBoons],
    pact: base.pact,
    pactOrigWep: base.pactOrigWep,
    relics: [...base.relics],
    buffChoices: [...base.buffChoices],
    fireCd100: tuple[12],
    imbue,
    lastSeq: tuple[19],
  };

  if ((flags & 8) === 0) {
    snap.blackCrystalEmpowered = (flags & 4) !== 0;
  }
  if ((uMask & PLAYER_UNDEF_SC_ID) === 0) {
    snap.soulChainTargetId = extra?.scId ?? null;
  }
  if ((uMask & PLAYER_UNDEF_SC_KIND) === 0) {
    snap.soulChainTargetKind = extra?.scKind ?? null;
  }
  if ((uMask & PLAYER_UNDEF_SC_TIMER) === 0) {
    snap.soulChainStretchTimer = extra?.scTimer ?? 0;
  }
  if ((uMask & PLAYER_UNDEF_PK_WEP) === 0) {
    snap.pactKeepWep = extra?.pkWep ?? null;
  }
  if ((uMask & PLAYER_UNDEF_PK_TIMER) === 0) {
    snap.pactKeepTimer10 = extra?.pkTimer ?? 0;
  }
  if (base.mutatorChoices !== undefined) {
    snap.mutatorChoices = [...base.mutatorChoices];
  }
  if (base.pactChoices !== undefined) {
    snap.pactChoices = [...base.pactChoices];
  }
  if (base.wepLevels !== undefined) {
    snap.wepLevels = { ...base.wepLevels };
  }
  if ((uMask & PLAYER_UNDEF_SV100) === 0) {
    snap.salvage100 = extra?.sv100 ?? 0;
  }
  if ((uMask & PLAYER_UNDEF_SV_ID) === 0) {
    snap.salvageItemId = extra?.svId ?? 0;
  }

  if (stats !== null) {
    if (stats[0] !== null) snap.stDmg = stats[0];
    if (stats[1] !== null) snap.stTaken = stats[1];
    if (stats[2] !== null) snap.stKills = stats[2];
    if (stats[3] !== null) snap.stRevives = stats[3];
    if (stats[4] !== null) snap.stElem = stats[4];
    if (stats[5] !== null) snap.stCombo = stats[5];
  }

  return snap;
}

function encodeEnemyFast(e: QuantizedEnemySnap): P2PEnemyFastTuple {
  const aiCode = AI_TO_CODE.get(e.ai) ?? e.ai;
  const bossFlags = (e.bossPh & 3) | (e.burrow ? 4 : 0);

  const allDefaultStatus =
    e.burn10 === 0 &&
    e.chill === 0 &&
    e.froz10 === 0 &&
    e.shock10 === 0 &&
    e.poison === 0 &&
    e.mark10 === 0 &&
    e.sc10 === 0 &&
    e.root10 === 0 &&
    e.blind10 === 0 &&
    e.stuckArrows === 0 &&
    e.parasiticThorns === 0 &&
    e.napalm10 === 0;

  if (allDefaultStatus) {
    return [
      e.id,
      e.qx,
      e.qy,
      e.vx,
      e.vy,
      e.qAngle,
      e.hp,
      e.shield,
      aiCode,
      e.st100,
      e.qTelAngle,
      e.telRad,
      e.telLen,
      bossFlags,
    ];
  }

  const statusTuple: P2PEnemyStatusTuple = [
    e.burn10,
    e.chill,
    e.froz10,
    e.shock10,
    e.poison,
    e.mark10 ?? -1,
    e.sc10 ?? -1,
    e.root10 ?? -1,
    e.blind10 ?? -1,
    e.stuckArrows ?? -1,
    e.parasiticThorns ?? -1,
    e.napalm10 ?? -1,
  ];

  return [
    e.id,
    e.qx,
    e.qy,
    e.vx,
    e.vy,
    e.qAngle,
    e.hp,
    e.shield,
    aiCode,
    e.st100,
    e.qTelAngle,
    e.telRad,
    e.telLen,
    bossFlags,
    statusTuple,
  ];
}

function decodeEnemyFast(base: P2PEnemyBaseline, tuple: P2PEnemyFastTuple): QuantizedEnemySnap {
  const rawAi = tuple[8];
  const ai: EnemyAIState =
    typeof rawAi === 'number' ? (AI_STATES[rawAi] ?? 'chase') : rawAi;
  const bossFlags = tuple[13];
  const bossPh = ((bossFlags & 3) || 1) as 1 | 2 | 3;
  const burrow = (bossFlags & 4) !== 0;
  const st = tuple[14];

  const enemy: QuantizedEnemySnap = {
    id: base.id,
    defId: base.defId,
    qx: tuple[1],
    qy: tuple[2],
    vx: tuple[3],
    vy: tuple[4],
    qAngle: tuple[5],
    hp: tuple[6],
    maxHp: base.maxHp,
    shield: tuple[7],
    maxShield: base.maxShield,
    ai,
    st100: tuple[9],
    qTelAngle: tuple[10],
    telRad: tuple[11],
    telLen: tuple[12],
    elite: base.elite,
    eliteMod: base.eliteMod,
    boss: base.boss,
    bossPh,
    burrow,
    burn10: st ? st[0] : 0,
    chill: st ? st[1] : 0,
    froz10: st ? st[2] : 0,
    shock10: st ? st[3] : 0,
    poison: st ? st[4] : 0,
  };

  if (!st) {
    enemy.mark10 = 0;
    enemy.sc10 = 0;
    enemy.root10 = 0;
    enemy.blind10 = 0;
    enemy.stuckArrows = 0;
    enemy.parasiticThorns = 0;
    enemy.napalm10 = 0;
  } else {
    if (st[5] >= 0) enemy.mark10 = st[5];
    if (st[6] >= 0) enemy.sc10 = st[6];
    if (st[7] >= 0) enemy.root10 = st[7];
    if (st[8] >= 0) enemy.blind10 = st[8];
    if (st[9] >= 0) enemy.stuckArrows = st[9];
    if (st[10] >= 0) enemy.parasiticThorns = st[10];
    if (st[11] >= 0) enemy.napalm10 = st[11];
  }

  return enemy;
}

const hashF64Scratch = new Float64Array(1);
const hashI32Scratch = new Int32Array(hashF64Scratch.buffer);
const fastHashPairOut: [number, number] = [0, 0];
let hashAcc1 = 0;
let hashAcc2 = 0;

function mixHashInt(v: number): void {
  const iv = v | 0;
  hashAcc1 = Math.imul(hashAcc1 ^ iv, 16777619);
  hashAcc2 = (Math.imul((hashAcc2 + iv) | 0, 0x85ebca6b) ^ (hashAcc2 >>> 13)) | 0;
}

function mixHashFloat(v: number): void {
  hashF64Scratch[0] = v === 0 ? 0 : v;
  mixHashInt(hashI32Scratch[0]!);
  mixHashInt(hashI32Scratch[1]!);
}

function mixHashBool(b: boolean): void {
  mixHashInt(b ? 0x5bd1e995 : 0x1b873593);
}

function mixHashOptBool(b: boolean | undefined): void {
  mixHashInt(b === undefined ? 0x101 : b ? 0x103 : 0x102);
}

function mixHashOptNum(v: number | undefined | null): void {
  if (v === undefined) {
    mixHashInt(0x11111111);
  } else if (v === null) {
    mixHashInt(0x22222222);
  } else {
    mixHashInt(0x33333333);
    mixHashFloat(v);
  }
}

function mixHashStr(s: string): void {
  mixHashInt(s.length);
  for (let i = 0; i < s.length; i++) {
    mixHashInt(s.charCodeAt(i));
  }
}

function mixHashOptStr(s: string | undefined | null): void {
  if (s === undefined) {
    mixHashInt(0x44444444);
  } else if (s === null) {
    mixHashInt(0x55555555);
  } else {
    mixHashInt(0x66666666);
    mixHashStr(s);
  }
}

function mixHashStrArray(arr: readonly string[]): void {
  mixHashInt(arr.length);
  for (let i = 0; i < arr.length; i++) {
    mixHashStr(arr[i]!);
  }
}

function mixHashOptStrArray(arr: readonly string[] | undefined): void {
  if (arr === undefined) {
    mixHashInt(0x77777777);
  } else {
    mixHashInt(0x77777778);
    mixHashStrArray(arr);
  }
}

function baselineFingerprintReplacer(key: string, value: unknown): unknown {
  if (
    key === 'hitFlashTimer' ||
    key === 'fuseTimer' ||
    key === 'ttlSec' ||
    key === 'prismPulseCooldownSec' ||
    key === 'microBlankTimer' ||
    key === 'pressTimer'
  ) {
    return undefined;
  }
  return value;
}

/**
 * Computes a zero-allocation 64-bit structural fingerprint (two 32-bit lanes) over all
 * baseline-owned fields of `snap`, omitting volatile per-tick prop countdown timers so
 * steady-state 30Hz combat frames skip both `extractBaseline` and `JSON.stringify`.
 */
export function computeBaselineFastHash(snap: QuantizedWorldSnapshot): [number, number] {
  hashAcc1 = 0x811c9dc5 | 0;
  hashAcc2 = 0x9e3779b9 | 0;

  let optArrayMask = 0;
  if (snap.summons !== undefined) optArrayMask |= OPT_SUMMONS;
  if (snap.skillZones !== undefined) optArrayMask |= OPT_SKILL_ZONES;
  if (snap.pushBlocks !== undefined) optArrayMask |= OPT_PUSH_BLOCKS;
  if (snap.tetherBeams !== undefined) optArrayMask |= OPT_TETHER_BEAMS;
  if (snap.magneticRivets !== undefined) optArrayMask |= OPT_MAGNETIC_RIVETS;
  mixHashInt(optArrayMask);

  if (typeof snap.seed === 'number') {
    mixHashInt(1);
    mixHashFloat(snap.seed);
  } else {
    mixHashInt(2);
    mixHashStr(String(snap.seed));
  }
  mixHashBool(snap.inHub);
  mixHashBool(snap.allowDuplicateCharacters);
  mixHashStr(snap.runState);
  mixHashInt(snap.currentFloor);
  mixHashOptNum(snap.currentBiome);
  mixHashInt(snap.currentRoomId);
  mixHashBool(snap.doorsLocked);
  mixHashBool(snap.secretWallBroken);
  mixHashBool(snap.portalActive);
  mixHashFloat(snap.portalX);
  mixHashFloat(snap.portalY);
  mixHashOptBool(snap.coopPuzzleCompleted);
  mixHashOptBool(snap.secretTrialActive);
  mixHashOptStr(snap.secretTrialResult);

  // Players baseline fields
  mixHashInt(snap.players.length);
  for (let i = 0; i < snap.players.length; i++) {
    const p = snap.players[i]!;
    mixHashInt(p.id);
    mixHashInt(p.slot);
    mixHashStr(p.name);
    mixHashStr(p.color);
    mixHashStr(p.charId);
    mixHashFloat(p.maxHp);
    mixHashFloat(p.maxArmor);
    mixHashInt(p.clipMax);
    mixHashStrArray(p.weaponSlots);
    mixHashStrArray(p.blessings);
    for (const k in p.mutators) {
      if (Object.prototype.hasOwnProperty.call(p.mutators, k)) {
        mixHashStr(k);
        const list = p.mutators[Number(k)];
        if (list) mixHashStrArray(list);
      }
    }
    mixHashInt(0x1a2b);
    mixHashStrArray(p.duoBoons);
    mixHashOptStr(p.pact);
    mixHashOptStr(p.pactOrigWep);
    mixHashStrArray(p.relics);
    mixHashStrArray(p.buffChoices);
    mixHashOptStrArray(p.mutatorChoices);
    mixHashOptStrArray(p.pactChoices);
    if (p.wepLevels === undefined) {
      mixHashInt(0x2b3c);
    } else {
      mixHashInt(0x2b3d);
      for (const k in p.wepLevels) {
        if (Object.prototype.hasOwnProperty.call(p.wepLevels, k)) {
          mixHashStr(k);
          mixHashOptNum(p.wepLevels[Number(k)]);
        }
      }
    }
  }

  // Enemies baseline fields
  mixHashInt(snap.enemies.length);
  for (let i = 0; i < snap.enemies.length; i++) {
    const e = snap.enemies[i]!;
    mixHashInt(e.id);
    mixHashStr(e.defId);
    mixHashFloat(e.maxHp);
    mixHashFloat(e.maxShield);
    mixHashBool(e.elite);
    mixHashOptStr(e.eliteMod);
    mixHashBool(e.boss);
  }

  // Props baseline fields (excluding continuous volatile countdown timers)
  mixHashInt(snap.props.length);
  for (let i = 0; i < snap.props.length; i++) {
    const pr = snap.props[i]!;
    mixHashInt(pr.id);
    mixHashStr(pr.kind);
    mixHashFloat(pr.x);
    mixHashFloat(pr.y);
    mixHashFloat(pr.radius);
    mixHashFloat(pr.hp);
    mixHashFloat(pr.maxHp);
    mixHashBool(pr.destructible);
    mixHashBool(pr.explosive);
    mixHashBool(pr.blocksMovement);
    mixHashFloat(pr.lightRadius);
    mixHashStr(pr.lightColorHex);
    mixHashOptBool(pr.repaired);
    mixHashOptStr(pr.state);
    mixHashOptStr(pr.coverState);
    mixHashOptNum(pr.linkedShamanId);
    mixHashOptBool(pr.blocksEnemyProjectiles);
    mixHashOptNum(pr.vx);
    mixHashOptNum(pr.vy);
    mixHashOptNum(pr.slideOwnerPlayerId);
    if (pr.hitEnemyIds === undefined) {
      mixHashInt(0x3c4d);
    } else {
      mixHashInt(pr.hitEnemyIds.length);
      for (let j = 0; j < pr.hitEnemyIds.length; j++) {
        mixHashInt(pr.hitEnemyIds[j]!);
      }
    }
    mixHashOptNum(pr.fallAngle);
    mixHashOptNum(pr.microBlankRadius);
    mixHashOptNum(pr.flippedByPlayerId);
    mixHashOptBool(pr.prismAuraActive);
    mixHashOptBool(pr.rocketCharged);
    mixHashOptBool(pr.cryoChargedByLaser);
    mixHashOptNum(pr.bouncesRemaining);
    mixHashOptBool(pr.iceSpeedBoostApplied);
    mixHashOptBool(pr.enemyPushed);
    mixHashOptNum(pr.pushedByEnemyId);
    mixHashOptNum(pr.kickedByPlayerId);
    mixHashOptBool(pr.counterDeflected);
    mixHashOptStr(pr.lastCombatText);
    mixHashOptStr(pr.pressState);
    mixHashOptBool(pr.toxicShrapnelTriggered);
    mixHashOptNum(pr.lastDamagedByPlayerId);
    mixHashOptNum(pr.causticRollRemainingPx);
    mixHashOptNum(pr.ownerPlayerId);
    mixHashOptBool(pr.cryoShatterSpire);
  }

  // Chests
  mixHashInt(snap.chests.length);
  for (let i = 0; i < snap.chests.length; i++) {
    const c = snap.chests[i]! as SimChestState & { tier?: string };
    mixHashInt(c.id);
    mixHashFloat(c.x);
    mixHashFloat(c.y);
    mixHashOptNum(c.radius);
    mixHashOptStr(c.rarity);
    mixHashOptStr(c.tier);
    mixHashBool(c.opened);
    mixHashOptStr(c.droppedWeaponId);
  }

  // World items
  mixHashInt(snap.worldItems.length);
  for (let i = 0; i < snap.worldItems.length; i++) {
    const wi = snap.worldItems[i]!;
    mixHashInt(wi.id);
    mixHashOptStr(wi.kind);
    mixHashOptStr(wi.weaponId);
    mixHashOptStr(wi.rarity);
    mixHashOptStr(wi.nameVi);
    mixHashOptNum(wi.costGold);
    mixHashOptNum(wi.healAmount);
    mixHashFloat(wi.x);
    mixHashFloat(wi.y);
    mixHashOptNum(wi.radius);
    mixHashOptBool(wi.pickedUp);
    mixHashOptStr(wi.offerId);
    mixHashOptNum(wi.ownerPlayerId);
    mixHashOptNum(wi.droppedByPlayerId);
    mixHashOptNum(wi.droppedAtTick);
    mixHashOptNum(wi.fromX);
    mixHashOptNum(wi.fromY);
    mixHashOptBool(wi.isHubRackItem);
  }

  // NPCs
  mixHashInt(snap.npcEntities.length);
  for (let i = 0; i < snap.npcEntities.length; i++) {
    const n = snap.npcEntities[i]!;
    mixHashInt(n.id);
    mixHashStr(n.kind);
    mixHashStr(n.nameVi);
    mixHashStr(n.dialogueVi);
    mixHashFloat(n.x);
    mixHashFloat(n.y);
    mixHashFloat(n.radius);
    mixHashBool(n.interacted);
    mixHashFloat(n.costHp);
    mixHashOptNum(n.costGold);
    if (n.usedByPlayerIds === undefined) {
      mixHashInt(0x4d5e);
    } else {
      mixHashInt(n.usedByPlayerIds.length);
      for (let j = 0; j < n.usedByPlayerIds.length; j++) {
        mixHashInt(n.usedByPlayerIds[j]!);
      }
    }
  }

  // Hub statues & stations
  mixHashInt(snap.hubStatues.length);
  for (let i = 0; i < snap.hubStatues.length; i++) {
    const st = snap.hubStatues[i]!;
    mixHashStr(st.characterId);
    mixHashStr(st.nameVi);
    mixHashStr(st.titleVi);
    mixHashFloat(st.x);
    mixHashFloat(st.y);
    mixHashFloat(st.radius);
  }
  if (snap.hubStations === undefined) {
    mixHashInt(0x5e6f);
  } else {
    mixHashInt(snap.hubStations.length);
    for (let i = 0; i < snap.hubStations.length; i++) {
      const st = snap.hubStations[i]!;
      mixHashStr(st.id);
      mixHashStr(st.nameVi);
      mixHashFloat(st.x);
      mixHashFloat(st.y);
      mixHashFloat(st.radius);
    }
  }

  // Pressure plates
  if (snap.pressurePlates === undefined) {
    mixHashInt(0x6f70);
  } else {
    mixHashInt(snap.pressurePlates.length);
    for (let i = 0; i < snap.pressurePlates.length; i++) {
      const pp = snap.pressurePlates[i]!;
      mixHashInt(pp.id);
      mixHashFloat(pp.x);
      mixHashFloat(pp.y);
      mixHashFloat(pp.radius);
      mixHashBool(pp.pressed);
    }
  }

  // Discovered rooms
  mixHashInt(snap.discoveredRooms.length);
  for (let i = 0; i < snap.discoveredRooms.length; i++) {
    const r = snap.discoveredRooms[i]!;
    mixHashInt(r.id);
    mixHashStr(r.discovery);
    mixHashBool(r.cleared);
  }

  fastHashPairOut[0] = hashAcc1;
  fastHashPairOut[1] = hashAcc2;
  return fastHashPairOut;
}

export class P2PSnapshotEncoder {
  private rev = 0;
  private lastBaseline: P2PSnapshotBaseline | null = null;
  private lastBaselineHash1 = 0;
  private lastBaselineHash2 = 0;
  private lastBaselineFingerprint = '';
  private autoSeq = 0;

  public reset(): void {
    this.rev = 0;
    this.lastBaseline = null;
    this.lastBaselineHash1 = 0;
    this.lastBaselineHash2 = 0;
    this.lastBaselineFingerprint = '';
    this.autoSeq = 0;
  }

  public encode(snap: QuantizedWorldSnapshot): {
    baseline?: { rev: number; data: P2PSnapshotBaseline };
    fast: P2PFastFrame;
  } {
    const [fastH1, fastH2] = computeBaselineFastHash(snap);
    let baselineOut: { rev: number; data: P2PSnapshotBaseline } | undefined;
    if (
      this.lastBaseline === null ||
      fastH1 !== this.lastBaselineHash1 ||
      fastH2 !== this.lastBaselineHash2
    ) {
      const baselineData = extractBaseline(snap);
      const fingerprint = JSON.stringify(baselineData, baselineFingerprintReplacer);
      this.lastBaselineHash1 = fastH1;
      this.lastBaselineHash2 = fastH2;
      if (this.lastBaseline === null || fingerprint !== this.lastBaselineFingerprint) {
        this.rev += 1;
        this.lastBaseline = baselineData;
        this.lastBaselineFingerprint = fingerprint;
        baselineOut = { rev: this.rev, data: baselineData };
      }
    }

    const hasExplicitSeq: 0 | 1 = typeof snap.snapshotSeq === 'number' ? 1 : 0;
    const wireSeq =
      typeof snap.snapshotSeq === 'number'
        ? snap.snapshotSeq
        : ++this.autoSeq;
    if (wireSeq > this.autoSeq) {
      this.autoSeq = wireSeq;
    }

    const timersTuple: P2PWorldFastTimersTuple = [
      hasExplicitSeq,
      snap.teamComboCount ?? -1,
      snap.secretTrialTimer100 ?? -1,
      snap.secretTrialBanner10 ?? -1,
      snap.secretTrialRemaining ?? -1,
    ];

    const runStatsTuple: P2PRunStatsTuple | null = snap.runStats
      ? [
          snap.runStats.floorReached,
          snap.runStats.roomsCleared,
          snap.runStats.chestsOpened,
          snap.runStats.kills,
          snap.runStats.elitesKilled,
          snap.runStats.bossesKilled,
          snap.runStats.damageDealt,
          snap.runStats.goldEarned,
          snap.runStats.ticksElapsed,
          snap.runStats.elementalReactions,
          snap.runStats.teamCombos,
        ]
      : null;

    const playerTuples = snap.players.map(encodePlayerFast);
    const enemyTuples = snap.enemies.map(encodeEnemyFast);
    const pickupTuples: P2PPickupFastTuple[] = snap.pickups.map((pk) => {
      const kindCode = Math.max(0, PICKUP_KINDS.indexOf(pk.kind)) as 0 | 1 | 2;
      return pk.ownerId !== undefined
        ? [pk.id, kindCode, pk.qx, pk.qy, pk.amount, pk.ownerId]
        : [pk.id, kindCode, pk.qx, pk.qy, pk.amount];
    });
    const surfaceTuples: QuantizedSurfaceTuple[] = snap.surfaces.map((s) => [s[0], s[1], s[2]]);

    const extras: P2PWorldFastExtras = {};
    let hasExtras = false;
    if (snap.pings.length > 0) {
      extras.pg = snap.pings.map((pg) => ({ ...pg }));
      hasExtras = true;
    }
    if (snap.summons && snap.summons.length > 0) {
      extras.sm = snap.summons.map((s) => ({ ...s }));
      hasExtras = true;
    }
    if (snap.skillZones && snap.skillZones.length > 0) {
      extras.sz = snap.skillZones.map((z) => ({ ...z }));
      hasExtras = true;
    }
    if (snap.pushBlocks && snap.pushBlocks.length > 0) {
      extras.pb = snap.pushBlocks.map((b) => ({ ...b }));
      hasExtras = true;
    }
    if (snap.tetherBeams && snap.tetherBeams.length > 0) {
      extras.tb = snap.tetherBeams.map((tb) => ({ ...tb }));
      hasExtras = true;
    }
    if (snap.magneticRivets && snap.magneticRivets.length > 0) {
      extras.mr = snap.magneticRivets.map((mr) => ({ ...mr }));
      hasExtras = true;
    }
    if (snap.projectiles.length > 0) {
      extras.pj = snap.projectiles.map((pt) => [...pt] as QuantizedProjectileTuple);
      hasExtras = true;
    }
    if (snap.events.length > 0) {
      extras.ev = [...snap.events];
      hasExtras = true;
    }

    const fast: P2PFastFrame = hasExtras
      ? [
          this.rev,
          wireSeq,
          snap.tick,
          snap.serverTimeMs,
          timersTuple,
          runStatsTuple,
          playerTuples,
          enemyTuples,
          pickupTuples,
          surfaceTuples,
          extras,
        ]
      : [
          this.rev,
          wireSeq,
          snap.tick,
          snap.serverTimeMs,
          timersTuple,
          runStatsTuple,
          playerTuples,
          enemyTuples,
          pickupTuples,
          surfaceTuples,
        ];

    return baselineOut ? { baseline: baselineOut, fast } : { fast };
  }
}

export class P2PSnapshotDecoder {
  private currentRev = 0;
  private currentBaseline: P2PSnapshotBaseline | null = null;
  private playerBaseById = new Map<number, P2PPlayerBaseline>();
  private enemyBaseById = new Map<number, P2PEnemyBaseline>();
  private lastFastSeq = 0;
  private pendingFast: P2PFastFrame | null = null;

  public reset(): void {
    this.currentRev = 0;
    this.currentBaseline = null;
    this.playerBaseById.clear();
    this.enemyBaseById.clear();
    this.lastFastSeq = 0;
    this.pendingFast = null;
  }

  public applyBaseline(rev: number, data: P2PSnapshotBaseline): QuantizedWorldSnapshot | null {
    if (rev <= this.currentRev) {
      return null;
    }
    this.currentRev = rev;
    this.currentBaseline = data;
    this.playerBaseById.clear();
    for (const p of data.players) {
      this.playerBaseById.set(p.id, p);
    }
    this.enemyBaseById.clear();
    for (const e of data.enemies) {
      this.enemyBaseById.set(e.id, e);
    }

    if (this.pendingFast) {
      const pendingRev = this.pendingFast[0];
      if (pendingRev < rev) {
        this.pendingFast = null;
      } else if (pendingRev === rev) {
        const queued = this.pendingFast;
        this.pendingFast = null;
        return this.decodeFast(queued);
      }
    }
    return null;
  }

  public decodeFast(fast: P2PFastFrame): QuantizedWorldSnapshot | null {
    if (!Array.isArray(fast) || fast.length < 10) {
      return null;
    }
    const rev = fast[0];
    const wireSeq = fast[1];

    if (rev < this.currentRev) {
      return null;
    }
    if (rev > this.currentRev || !this.currentBaseline) {
      if (
        !this.pendingFast ||
        rev > this.pendingFast[0] ||
        (rev === this.pendingFast[0] && wireSeq > this.pendingFast[1])
      ) {
        this.pendingFast = fast;
      }
      return null;
    }

    if (wireSeq <= this.lastFastSeq) {
      return null;
    }

    const base = this.currentBaseline;
    const players: QuantizedPlayerSnap[] = [];
    for (const pt of fast[6]) {
      const pBase = this.playerBaseById.get(pt[0]);
      if (!pBase) return null;
      players.push(decodePlayerFast(pBase, pt));
    }

    const enemies: QuantizedEnemySnap[] = [];
    for (const et of fast[7]) {
      const eBase = this.enemyBaseById.get(et[0]);
      if (!eBase) return null;
      enemies.push(decodeEnemyFast(eBase, et));
    }

    this.lastFastSeq = wireSeq;

    const timers = fast[4];
    const rs = fast[5];
    const extras = fast[10];
    const pickups = fast[8].map((pk) => {
      const kind = PICKUP_KINDS[pk[1]] ?? 'gold';
      return pk.length === 6
        ? { id: pk[0], kind, qx: pk[2], qy: pk[3], amount: pk[4], ownerId: pk[5] }
        : { id: pk[0], kind, qx: pk[2], qy: pk[3], amount: pk[4] };
    });

    const snap: QuantizedWorldSnapshot = {
      tick: fast[2],
      serverTimeMs: fast[3],
      seed: base.seed,
      inHub: base.inHub,
      allowDuplicateCharacters: base.allowDuplicateCharacters,
      runState: base.runState,
      currentFloor: base.currentFloor,
      currentRoomId: base.currentRoomId,
      doorsLocked: base.doorsLocked,
      secretWallBroken: base.secretWallBroken,
      portalActive: base.portalActive,
      portalX: base.portalX,
      portalY: base.portalY,
      players,
      enemies,
      projectiles: extras?.pj ? extras.pj.map((pt) => [...pt] as QuantizedProjectileTuple) : [],
      props: base.props.map((pr) => ({
        ...pr,
        ...(pr.hitEnemyIds ? { hitEnemyIds: [...pr.hitEnemyIds] } : {}),
      })),
      chests: base.chests.map((c) => ({ ...c })),
      worldItems: base.worldItems.map((wi) => ({ ...wi })),
      npcEntities: base.npcEntities.map((n) => ({ ...n })),
      pickups,
      pings: extras?.pg ? extras.pg.map((pg) => ({ ...pg })) : [],
      hubStatues: base.hubStatues.map((st) => ({ ...st })),
      surfaces: fast[9].map((s) => [s[0], s[1], s[2]]),
      discoveredRooms: base.discoveredRooms.map((r) => ({ ...r })),
      events: extras?.ev ? [...extras.ev] : [],
    };

    if (timers[0] === 1) {
      snap.snapshotSeq = wireSeq;
    }
    if (base.currentBiome !== undefined) {
      snap.currentBiome = base.currentBiome;
    }
    if (base.hubStations !== undefined) {
      snap.hubStations = base.hubStations.map((st) => ({ ...st }));
    }
    if ((base.optArrayMask & OPT_SUMMONS) !== 0) {
      snap.summons = extras?.sm ? extras.sm.map((s) => ({ ...s })) : [];
    }
    if ((base.optArrayMask & OPT_SKILL_ZONES) !== 0) {
      snap.skillZones = extras?.sz ? extras.sz.map((z) => ({ ...z })) : [];
    }
    if (base.pressurePlates !== undefined) {
      snap.pressurePlates = base.pressurePlates.map((pp) => ({ ...pp }));
    }
    if ((base.optArrayMask & OPT_PUSH_BLOCKS) !== 0) {
      snap.pushBlocks = extras?.pb ? extras.pb.map((b) => ({ ...b })) : [];
    }
    if ((base.optArrayMask & OPT_TETHER_BEAMS) !== 0) {
      snap.tetherBeams = extras?.tb ? extras.tb.map((tb) => ({ ...tb })) : [];
    }
    if ((base.optArrayMask & OPT_MAGNETIC_RIVETS) !== 0) {
      snap.magneticRivets = extras?.mr ? extras.mr.map((mr) => ({ ...mr })) : [];
    }
    if (base.coopPuzzleCompleted !== undefined) {
      snap.coopPuzzleCompleted = base.coopPuzzleCompleted;
    }
    if (timers[1] >= 0) {
      snap.teamComboCount = timers[1];
    }
    if (base.secretTrialActive !== undefined) {
      snap.secretTrialActive = base.secretTrialActive;
    }
    if (timers[2] >= 0) {
      snap.secretTrialTimer100 = timers[2];
    }
    if (base.secretTrialResult !== undefined) {
      snap.secretTrialResult = base.secretTrialResult;
    }
    if (timers[3] >= 0) {
      snap.secretTrialBanner10 = timers[3];
    }
    if (timers[4] >= 0) {
      snap.secretTrialRemaining = timers[4];
    }
    if (rs !== null) {
      snap.runStats = {
        floorReached: rs[0],
        roomsCleared: rs[1],
        chestsOpened: rs[2],
        kills: rs[3],
        elitesKilled: rs[4],
        bossesKilled: rs[5],
        damageDealt: rs[6],
        goldEarned: rs[7],
        ticksElapsed: rs[8],
        elementalReactions: rs[9],
        teamCombos: rs[10],
      };
    }

    return snap;
  }
}
