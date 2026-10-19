import { FixedTimestepLoop } from '../core/fixed-timestep.js';
import { ENEMIES } from '../data/enemies.js';
import type { BuffId, CharacterId, EliteModifier, ElementType } from '../data/types.js';
import { clamp, lerp } from '../math/vec2.js';
import type { SurfaceKind } from '../sim/arena-map.js';
import {
  type EnemyAIState,
  type PlayerLifeState,
  type SimChestState,
  type SimEnemyState,
  type SimEvent,
  type SimHubStatue,
  type SimNpcState,
  type SimPickupState,
  type SimPingMarker,
  type SimPlayerState,
  type SimProjectileState,
  type SimPropState,
  type SimSkillZoneState,
  type SimSummonState,
  type SimWorldItemState,
  WorldSim,
  type WorldSimOptions,
} from '../sim/world-sim.js';
import {
  INPUT_BUTTON,
  type PlayerInputPacket,
  type QuickEmoteId,
  dequantizeAngle,
  dequantizeCoord,
  quantizeAngle,
  quantizeCoord,
} from './messages.js';
import type { ITransport, InterpolatedEntityPos } from './transport.js';
import { WifiSimulator, type WifiProfileId } from './wifi-sim.js';

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
  energy: number;
  maxEnergy: number;
  gold: number;
  dashTimer100: number;
  dashCd100: number;
  skillCd10: number;
  skillAct10: number;
  shieldBullets: number;
  activeSlot: number;
  weaponSlots: string[];
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
  activeBuffIds: BuffId[];
  pendingBuffChoices: BuffId[];
  players: QuantizedPlayerSnap[];
  enemies: QuantizedEnemySnap[];
  projectiles: QuantizedProjectileTuple[];
  props: SimPropState[];
  chests: SimChestState[];
  worldItems: SimWorldItemState[];
  npcEntities: SimNpcState[];
  pickups: Array<{
    id: number;
    kind: 'energy' | 'gold' | 'life_seed';
    qx: number;
    qy: number;
    amount: number;
    ownerId?: number;
  }>;
  pings: SimPingMarker[];
  hubStatues: SimHubStatue[];
  summons?: SimSummonState[];
  skillZones?: SimSkillZoneState[];
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
    energy: p.energy,
    maxEnergy: p.maxEnergy,
    gold: p.gold,
    dashTimer100: Math.round(p.dashTimer * 100),
    dashCd100: Math.round(p.dashCooldownTimer * 100),
    skillCd10: Math.round(p.skillCooldownTimer * 10),
    skillAct10: Math.round(p.skillActiveTimer * 10),
    shieldBullets: p.shieldStoredBullets,
    activeSlot: p.activeWeaponSlot,
    weaponSlots: [...p.weaponSlots],
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

  const netEvents = events
    .filter(
      (ev) =>
        ev.kind !== 'projectile_spawned' &&
        (ev.kind !== 'projectile_impact' || ev.destroyedByMelee || ev.blockedByShield),
    )
    .slice(0, 32);

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
    activeBuffIds: [...sim.activeBuffIds],
    pendingBuffChoices: [...sim.pendingBuffChoices],
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

interface EntityInterpSample {
  timeMs: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
}

export interface NetworkTransportOptions extends WorldSimOptions {
  localPlayerSlot?: 1 | 2 | 3 | 4;
  localPlayerId?: number;
  onSendInput?: (packet: PlayerInputPacket) => void;
  wifiProfile?: WifiProfileId;
}

export interface NetworkTelemetry {
  rttMs: number;
  jitterMs: number;
  interpolationDelayMs: number;
  packetLossPercent: number;
  bytesInPerSec: number;
  bytesOutPerSec: number;
  wifiProfile: WifiProfileId;
  pendingInputs: number;
  allowDuplicateCharacters: boolean;
}

/**
 * NetworkTransport implements ITransport for Phase 4 Authoritative Co-op LAN:
 * - Client-Side Prediction + Smooth Reconciliation for the local player (movement + dash)
 * - Adaptive Entity Interpolation (50-100ms buffer based on measured jitter) for remote players & enemies
 * - Deterministic client-side projectile simulation + immediate cosmetic hit prediction
 * - Integrated WifiSimulator ('off' | 'good' | 'normal' | 'bad')
 * - Real-time bandwidth & latency telemetry
 */
export class NetworkTransport implements ITransport {
  public readonly mode = 'network' as const;
  private readonly sim: WorldSim;
  private readonly loop: FixedTimestepLoop;
  private readonly wifiSim: WifiSimulator;
  private onSendInputCallback?: (packet: PlayerInputPacket) => void;

  private localPlayerId = 1;
  private localPlayerSlot: 1 | 2 | 3 | 4 = 1;
  private allowDuplicateCharacters = false;
  private alpha = 1;

  private latestInput: PlayerInputPacket = {
    seq: 0,
    tick: 0,
    moveX: 0,
    moveY: 0,
    aimAngle: 0,
    buttons: 0,
    weaponSlotSelect: null,
  };

  private readonly pendingInputs: PlayerInputPacket[] = [];
  private reconcileOffsetX = 0;
  private reconcileOffsetY = 0;

  private readonly remotePlayerSamples = new Map<number, EntityInterpSample[]>();
  private readonly enemySamples = new Map<number, EntityInterpSample[]>();
  private readonly pendingEvents: SimEvent[] = [];

  private lastSnapshotRecvMs = 0;
  private rttMs = 8;
  private measuredJitterMs = 2;
  private interpolationDelayMs = 55;

  private bytesInWindow = 0;
  private bytesOutWindow = 0;
  private bandwidthWindowTimerMs = 0;
  private bytesInPerSec = 0;
  private bytesOutPerSec = 0;

  constructor(options: NetworkTransportOptions = {}) {
    this.sim = new WorldSim({
      ...options,
      startInHub: options.startInHub ?? true,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    this.loop = new FixedTimestepLoop(60);
    this.loop.primeForImmediateTick();
    this.alpha = this.loop.getAlpha();

    this.localPlayerId = options.localPlayerId ?? 1;
    this.localPlayerSlot = options.localPlayerSlot ?? 1;
    this.onSendInputCallback = options.onSendInput;
    this.wifiSim = new WifiSimulator(options.wifiProfile ?? 'off');
  }

  public setLocalIdentity(playerId: number, playerSlot: 1 | 2 | 3 | 4): void {
    this.localPlayerId = playerId;
    this.localPlayerSlot = playerSlot;
    this.sim.player.id = playerId;
    this.sim.player.slot = playerSlot;
    const dupIdx = this.sim.simulatedPlayers.findIndex((p) => p.id === playerId);
    if (dupIdx >= 0) {
      const existing = this.sim.simulatedPlayers[dupIdx]!;
      Object.assign(this.sim.player, existing);
      this.sim.simulatedPlayers.splice(dupIdx, 1);
    }
  }

  public getLocalPlayerId(): number {
    return this.localPlayerId;
  }

  public getLocalPlayerSlot(): 1 | 2 | 3 | 4 {
    return this.localPlayerSlot;
  }

  public setOnSendInput(cb: (packet: PlayerInputPacket) => void): void {
    this.onSendInputCallback = cb;
  }

  public setWifiProfile(profile: WifiProfileId): void {
    this.wifiSim.setProfile(profile);
  }

  public getWifiProfile(): WifiProfileId {
    return this.wifiSim.getProfile();
  }

  public triggerManualLagSpike(durationMs = 300): void {
    this.wifiSim.triggerManualLagSpike(durationMs);
  }

  public setRttMs(rttMs: number): void {
    this.rttMs = Math.max(1, Math.round(rttMs));
  }

  public getTelemetry(): NetworkTelemetry {
    const simStats = this.wifiSim.getStats();
    const totalPkts = simStats.packetsSent + simStats.packetsDropped;
    const lossPct = totalPkts > 0 ? (simStats.packetsDropped / totalPkts) * 100 : 0;
    return {
      rttMs: this.rttMs + simStats.currentLatencyMs * 2,
      jitterMs: Math.round(this.measuredJitterMs),
      interpolationDelayMs: Math.round(this.interpolationDelayMs),
      packetLossPercent: Number(lossPct.toFixed(1)),
      bytesInPerSec: this.bytesInPerSec,
      bytesOutPerSec: this.bytesOutPerSec,
      wifiProfile: this.wifiSim.getProfile(),
      pendingInputs: this.pendingInputs.length,
      allowDuplicateCharacters: this.allowDuplicateCharacters,
    };
  }

  public sendInput(input: PlayerInputPacket): void {
    const packet: PlayerInputPacket = {
      ...input,
    };
    this.latestInput = packet;

    // Apply immediately to local player for 0ms client-side prediction
    const localPlayer = this.getLocalPlayerState();
    localPlayer.aimAngle = packet.aimAngle;
    this.sim.setCoopPlayerInput(this.localPlayerId, packet);
    if (this.localPlayerId === this.sim.player.id) {
      this.sim.setPlayerInput(packet);
    }

    this.pendingInputs.push(packet);
    if (this.pendingInputs.length > 120) {
      this.pendingInputs.shift();
    }

    this.bytesOutWindow += 18;
    this.wifiSim.sendOutbound(packet, (deliveredPacket) => {
      this.onSendInputCallback?.(deliveredPacket);
    });
  }

  /**
   * Called when an authoritative 30Hz snapshot arrives from the Host server.
   */
  public receiveSnapshot(snapshot: QuantizedWorldSnapshot): void {
    const bytes = estimateSnapshotBytes(snapshot);
    this.bytesInWindow += bytes;
    if (this.bytesInPerSec === 0) {
      this.bytesInPerSec = bytes * 30;
    }

    this.wifiSim.receiveInbound(snapshot, (deliveredSnap: QuantizedWorldSnapshot) => {
      this.applyAuthoritativeSnapshot(deliveredSnap);
    });
  }

  private applyAuthoritativeSnapshot(snapshot: QuantizedWorldSnapshot): void {
    const nowMs = this.wifiSim.getNowMs();
    if (this.lastSnapshotRecvMs > 0) {
      const intervalMs = nowMs - this.lastSnapshotRecvMs;
      const expectedMs = 1000 / 30;
      const deltaJitter = Math.abs(intervalMs - expectedMs);
      this.measuredJitterMs = this.measuredJitterMs * 0.8 + deltaJitter * 0.2;
      // Adaptive interpolation buffer: 50ms under good LAN, scaling up to 100ms under high jitter
      this.interpolationDelayMs = clamp(50 + this.measuredJitterMs * 1.4, 50, 100);
    }
    this.lastSnapshotRecvMs = nowMs;

    this.allowDuplicateCharacters = snapshot.allowDuplicateCharacters;
    this.sim.allowDuplicateCharacters = snapshot.allowDuplicateCharacters;

    const floorChanged = this.sim.currentFloor !== snapshot.currentFloor;
    const roomChanged =
      this.sim.currentRoomId !== snapshot.currentRoomId ||
      floorChanged ||
      this.sim.inHub !== snapshot.inHub;

    this.sim.tick = snapshot.tick;
    this.sim.inHub = snapshot.inHub;
    this.sim.currentFloor = snapshot.currentFloor;
    if (snapshot.currentBiome) {
      this.sim.currentBiome = snapshot.currentBiome;
    }
    this.sim.currentRoomId = snapshot.currentRoomId;
    this.sim.secretWallBroken = snapshot.secretWallBroken;
    this.sim.activeBuffIds = [...snapshot.activeBuffIds];
    this.sim.pendingBuffChoices = [...snapshot.pendingBuffChoices];

    if (roomChanged) {
      this.remotePlayerSamples.clear();
      this.enemySamples.clear();
      if (snapshot.inHub) {
        this.sim.enterHub();
      } else if (floorChanged) {
        this.sim.advanceToFloor(snapshot.currentFloor);
        if (this.sim.currentRoomId !== snapshot.currentRoomId) {
          this.sim.enterRoom(snapshot.currentRoomId);
        }
      } else {
        this.sim.enterRoom(snapshot.currentRoomId);
      }
    }

    this.sim.runState = snapshot.runState;
    if (snapshot.runStats) {
      this.sim.runStats.floorReached = snapshot.runStats.floorReached;
      this.sim.runStats.roomsCleared = snapshot.runStats.roomsCleared;
      this.sim.runStats.chestsOpened = snapshot.runStats.chestsOpened ?? 0;
      this.sim.runStats.kills = snapshot.runStats.kills;
      this.sim.runStats.elitesKilled = snapshot.runStats.elitesKilled;
      this.sim.runStats.bossesKilled = snapshot.runStats.bossesKilled;
      this.sim.runStats.damageDealt = snapshot.runStats.damageDealt;
      this.sim.runStats.goldEarned = snapshot.runStats.goldEarned;
      this.sim.runStats.ticksElapsed = snapshot.runStats.ticksElapsed;
      this.sim.runStats.elementalReactions = snapshot.runStats.elementalReactions;
      this.sim.runStats.teamCombos = snapshot.runStats.teamCombos;
    }

    this.sim.portalActive = snapshot.portalActive;
    this.sim.portalX = snapshot.portalX;
    this.sim.portalY = snapshot.portalY;

    for (const d of this.sim.doors) {
      d.locked = snapshot.doorsLocked;
    }

    for (const dr of snapshot.discoveredRooms) {
      const rNode = this.sim.dungeon.rooms[dr.id];
      if (rNode) {
        rNode.discovery = dr.discovery;
        rNode.cleared = dr.cleared;
      }
    }

    // Reconcile players (local player predicted + reconciled; remote players buffered for interpolation)
    const activePlayerIds = new Set<number>();
    for (const ps of snapshot.players) {
      activePlayerIds.add(ps.id);
      const authX = dequantizeCoord(ps.qx);
      const authY = dequantizeCoord(ps.qy);
      const authAngle = dequantizeAngle(ps.qAngle);

      let pState: SimPlayerState | undefined;
      if (ps.id === this.localPlayerId) {
        pState = this.sim.player;
        pState.id = ps.id;
        const dupIdx = this.sim.simulatedPlayers.findIndex((p) => p.id === ps.id);
        if (dupIdx >= 0) {
          this.sim.simulatedPlayers.splice(dupIdx, 1);
        }
      } else {
        pState = this.sim.simulatedPlayers.find((p) => p.id === ps.id);
        if (!pState) {
          pState = this.sim.createPlayerState(ps.id, ps.slot, ps.charId, authX, authY, ps.name);
          this.sim.simulatedPlayers.push(pState);
          this.sim.simulatedPlayers.sort((a, b) => a.slot - b.slot);
        }
      }

      pState.slot = ps.slot;
      pState.displayName = ps.name;
      pState.colorHex = ps.color;
      pState.characterId = ps.charId;
      pState.lifeState = ps.life;
      pState.downedTimer = ps.downTimer10 / 10;
      pState.reviveProgress = ps.revProg100 / 100;
      pState.reviverPlayerId = ps.reviverId;
      pState.ready = ps.ready;
      pState.pingMs = ps.pingMs;
      pState.emoteId = ps.emoteId;
      pState.emoteTimer = ps.emoteTimer10 / 10;
      pState.currentRoomId = ps.roomId;
      pState.hp = ps.hp;
      pState.maxHp = ps.maxHp;
      pState.armor = ps.armor;
      pState.maxArmor = ps.maxArmor;
      pState.energy = ps.energy;
      pState.maxEnergy = ps.maxEnergy;
      pState.gold = ps.gold;
      pState.skillCooldownTimer = ps.skillCd10 / 10;
      pState.skillActiveTimer = ps.skillAct10 / 10;
      pState.shieldStoredBullets = ps.shieldBullets;
      pState.activeWeaponSlot = ps.activeSlot;
      pState.weaponSlots = [...ps.weaponSlots];
      pState.fireCooldownTimer = ps.fireCd100 / 100;
      pState.activeImbueElement = ps.imbue;
      pState.lastProcessedSeq = ps.lastSeq;
      pState.statsDamageDealt = ps.stDmg ?? 0;
      pState.statsDamageTaken = ps.stTaken ?? 0;
      pState.statsKills = ps.stKills ?? 0;
      pState.statsRevives = ps.stRevives ?? 0;
      pState.statsElementalReactions = ps.stElem ?? 0;
      pState.statsTeamCombos = ps.stCombo ?? 0;

      if (ps.id === this.localPlayerId) {
        // Local player: Client-Side Prediction + Server Reconciliation
        while (this.pendingInputs.length > 0 && this.pendingInputs[0]!.seq <= ps.lastSeq) {
          this.pendingInputs.shift();
        }

        const prevPredX = pState.x + this.reconcileOffsetX;
        const prevPredY = pState.y + this.reconcileOffsetY;

        pState.x = authX;
        pState.y = authY;
        pState.vx = ps.vx;
        pState.vy = ps.vy;
        pState.dashTimer = ps.dashTimer100 / 100;
        pState.dashCooldownTimer = ps.dashCd100 / 100;

        // Replay unacknowledged local inputs on top of server state
        const replayDt = 1 / 60;
        for (let i = 0; i < this.pendingInputs.length; i++) {
          const inp = this.pendingInputs[i]!;
          const len = Math.hypot(inp.moveX, inp.moveY);
          const nx = len > 0.001 ? inp.moveX / Math.max(1, len) : 0;
          const ny = len > 0.001 ? inp.moveY / Math.max(1, len) : 0;
          const speed = pState.lifeState === 'downed' ? 38 : pState.moveSpeed;
          const nextX = pState.x + nx * speed * replayDt;
          const nextY = pState.y + ny * speed * replayDt;
          const col = this.sim.map.resolveCircleCollision(nextX, nextY, pState.radius);
          pState.x = col.x;
          pState.y = col.y;
        }
        pState.prevX = pState.x;
        pState.prevY = pState.y;

        const errX = prevPredX - pState.x;
        const errY = prevPredY - pState.y;
        const errDist = Math.hypot(errX, errY);

        if (roomChanged || errDist > 96) {
          // Teleport or room transition: snap immediately
          this.reconcileOffsetX = 0;
          this.reconcileOffsetY = 0;
        } else if (errDist > 0.5) {
          // Smoothly blend visual reconciliation offset to zero
          this.reconcileOffsetX = errX;
          this.reconcileOffsetY = errY;
        }
      } else {
        // Remote player: push sample into adaptive interpolation buffer
        pState.prevX = pState.x;
        pState.prevY = pState.y;
        pState.x = authX;
        pState.y = authY;
        pState.vx = ps.vx;
        pState.vy = ps.vy;
        pState.aimAngle = authAngle;
        pState.dashTimer = ps.dashTimer100 / 100;
        pState.dashCooldownTimer = ps.dashCd100 / 100;

        let samples = this.remotePlayerSamples.get(ps.id);
        if (!samples) {
          samples = [];
          this.remotePlayerSamples.set(ps.id, samples);
        }
        samples.push({
          timeMs: nowMs,
          x: authX,
          y: authY,
          vx: ps.vx,
          vy: ps.vy,
          angle: authAngle,
        });
        while (samples.length > 16) {
          samples.shift();
        }
      }
    }

    // Remove disconnected players
    for (let i = this.sim.simulatedPlayers.length - 1; i >= 0; i--) {
      const existing = this.sim.simulatedPlayers[i]!;
      if (!activePlayerIds.has(existing.id) || existing.id === this.localPlayerId) {
        this.sim.simulatedPlayers.splice(i, 1);
        this.remotePlayerSamples.delete(existing.id);
      }
    }

    // Sync enemies + buffer interpolation samples
    const existingEnemiesById = new Map<number, SimEnemyState>();
    for (const e of this.sim.enemies) {
      existingEnemiesById.set(e.id, e);
    }

    const activeEnemyIds = new Set<number>();
    this.sim.enemies = snapshot.enemies.map((es): SimEnemyState => {
      activeEnemyIds.add(es.id);
      const ex = dequantizeCoord(es.qx);
      const ey = dequantizeCoord(es.qy);
      const eAngle = dequantizeAngle(es.qAngle);
      const prev = existingEnemiesById.get(es.id);
      const def = ENEMIES[es.defId];

      let samples = this.enemySamples.get(es.id);
      if (!samples) {
        samples = [];
        this.enemySamples.set(es.id, samples);
      }
      samples.push({
        timeMs: nowMs,
        x: ex,
        y: ey,
        vx: es.vx,
        vy: es.vy,
        angle: eAngle,
      });
      while (samples.length > 16) {
        samples.shift();
      }

      return {
        id: es.id,
        defId: es.defId,
        nameVi: def?.nameVi ?? es.defId,
        role: def?.role ?? 'melee',
        isDummy: es.defId === 'training_dummy',
        isElite: es.elite,
        eliteModifier: es.eliteMod,
        isBoss: es.boss,
        bossPhase: es.bossPh,
        bossAttackCycle: prev?.bossAttackCycle ?? 0,
        bossBurrowed: es.burrow,
        bossTargetX: ex,
        bossTargetY: ey,
        prevX: prev ? prev.x : ex,
        prevY: prev ? prev.y : ey,
        x: ex,
        y: ey,
        vx: es.vx,
        vy: es.vy,
        kbVx: 0,
        kbVy: 0,
        radius: prev?.radius ?? (es.boss ? 28 : 13),
        hp: es.hp,
        maxHp: es.maxHp,
        shieldArmor: es.shield,
        maxShieldArmor: es.maxShield,
        moveSpeed: prev?.moveSpeed ?? def?.moveSpeed ?? 90,
        damage: prev?.damage ?? def?.damage ?? 2,
        aiState: es.ai,
        stateTimer: es.st100 / 100,
        attackCooldownTimer: 0,
        telegraphDurationSec: def?.telegraphSec ?? 0.45,
        telegraphAngle: dequantizeAngle(es.qTelAngle),
        telegraphRadius: es.telRad,
        telegraphLength: es.telLen,
        aimAngle: eAngle,
        hitFlashTimer:
          prev && es.hp < prev.hp ? 0.12 : Math.max(0, (prev?.hitFlashTimer ?? 0) - 0.03),
        burnTimer: es.burn10 / 10,
        burnTickTimer: 0.5,
        chillStacks: es.chill,
        chillTimer: es.chill > 0 ? 2.0 : 0,
        frozenTimer: es.froz10 / 10,
        shockTimer: es.shock10 / 10,
        poisonStacks: es.poison,
        poisonTimer: es.poison > 0 ? 2.0 : 0,
        poisonTickTimer: 0.5,
        markedTimer: (es.mark10 ?? 0) / 10,
        markedByPlayerId: 0,
        superconductTimer: (es.sc10 ?? 0) / 10,
        rootedTimer: (es.root10 ?? 0) / 10,
        steamBlindTimer: (es.blind10 ?? 0) / 10,
        lastElementOwnerId: 0,
        lastElementApplied: 'none',
        regenAccum: 0,
        surfaceTickTimer: 0,
        grassRustleCooldown: 0,
        strafeSign: 1,
      };
    });

    for (const oldId of this.enemySamples.keys()) {
      if (!activeEnemyIds.has(oldId)) {
        this.enemySamples.delete(oldId);
      }
    }

    // Projectiles are simulated deterministically on the client via bullet_volley_spawned events.
    // Only apply explicit snapshot.projectiles if provided (e.g. legacy/custom snapshots).
    if (snapshot.projectiles.length > 0) {
      this.sim.projectiles = snapshot.projectiles.map((pt): SimProjectileState => {
        const px = dequantizeCoord(pt[4]);
        const py = dequantizeCoord(pt[5]);
        return {
          id: pt[0],
          ownerId: pt[1],
          team: pt[2] === 1 ? 'enemy' : 'player',
          weaponId: pt[3],
          prevX: px,
          prevY: py,
          x: px,
          y: py,
          vx: pt[6],
          vy: pt[7],
          angle: dequantizeAngle(pt[8]),
          radius: pt[9] / 10,
          damage: 1,
          isCrit: false,
          knockback: 0,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: pt[10] / 100,
          element: pt[11],
          amplifiedByShield: pt[12] === 1,
          hitEntityIds: [],
        };
      });
    }

    // Sync props, chests, world items, NPCs, pickups, pings, statues, summons, skillZones
    this.sim.props = snapshot.props.map((pr) => ({ ...pr }));
    this.sim.chests = snapshot.chests.map((c) => ({ ...c }));
    this.sim.worldItems = snapshot.worldItems.map((wi) => ({ ...wi }));
    this.sim.npcEntities = snapshot.npcEntities.map((n) => ({ ...n }));
    this.sim.pickups = snapshot.pickups.map((pk) => {
      const x = dequantizeCoord(pk.qx);
      const y = dequantizeCoord(pk.qy);
      return {
        id: pk.id,
        kind: pk.kind,
        prevX: x,
        prevY: y,
        x,
        y,
        vx: 0,
        vy: 0,
        amount: pk.amount,
        ttlSec: 10,
        ownerPlayerId: pk.ownerId,
      };
    });
    this.sim.pings = snapshot.pings.map((pg) => ({ ...pg }));
    this.sim.hubStatues = snapshot.hubStatues.map((st) => ({ ...st }));
    if (snapshot.summons) {
      this.sim.summons = snapshot.summons.map((s) => ({ ...s }));
    }
    if (snapshot.skillZones) {
      this.sim.skillZones = snapshot.skillZones.map((z) => ({ ...z }));
    }
    if (snapshot.teamComboCount !== undefined) {
      this.sim.teamComboCount = snapshot.teamComboCount;
    }

    // Sync dynamic surfaces
    this.sim.map.surfaces.fill('none');
    this.sim.map.surfaceTimers.fill(0);
    for (const [idx, sk, timer10] of snapshot.surfaces) {
      if (idx >= 0 && idx < this.sim.map.surfaces.length) {
        this.sim.map.surfaces[idx] = sk;
        this.sim.map.surfaceTimers[idx] = timer10 / 10;
      }
    }

    for (const ev of snapshot.events) {
      if (ev.kind === 'bullet_volley_spawned') {
        this.sim.spawnDeterministicVolley(ev, false);
        this.pendingEvents.push({
          kind: 'projectile_spawned',
          projectileId: 0,
          weaponId: ev.weaponId,
          team: ev.team,
          x: ev.x,
          y: ev.y,
          angle: ev.angle,
        });
      } else {
        this.pendingEvents.push(ev);
      }
    }
  }

  public step(deltaMs: number): { ticksExecuted: number; alpha: number; tick: number } {
    this.wifiSim.step(deltaMs);

    this.bandwidthWindowTimerMs += deltaMs;
    if (this.bandwidthWindowTimerMs >= 1000) {
      const scale = 1000 / this.bandwidthWindowTimerMs;
      this.bytesInPerSec = Math.round(this.bytesInWindow * scale);
      this.bytesOutPerSec = Math.round(this.bytesOutWindow * scale);
      this.bytesInWindow = 0;
      this.bytesOutWindow = 0;
      this.bandwidthWindowTimerMs = 0;
    }

    const dtSec = Math.min(0.1, deltaMs / 1000);
    // Smooth exponential decay of client reconciliation offset
    const decay = Math.exp(-18 * dtSec);
    this.reconcileOffsetX *= decay;
    this.reconcileOffsetY *= decay;
    if (Math.abs(this.reconcileOffsetX) < 0.05) this.reconcileOffsetX = 0;
    if (Math.abs(this.reconcileOffsetY) < 0.05) this.reconcileOffsetY = 0;

    // Step local player prediction at 60Hz and simulate deterministic projectiles + cosmetic hit prediction
    const res = this.loop.step(deltaMs, (fixedDt) => {
      this.stepLocalPrediction(fixedDt);
    });
    this.alpha = res.alpha;
    return {
      ticksExecuted: res.ticksExecuted,
      alpha: this.alpha,
      tick: this.sim.tick,
    };
  }

  private stepLocalPrediction(dtSec: number): void {
    const localPlayer = this.getLocalPlayerState();
    localPlayer.prevX = localPlayer.x;
    localPlayer.prevY = localPlayer.y;

    const inp = this.latestInput;
    localPlayer.aimAngle = inp.aimAngle;

    if (localPlayer.dashCooldownTimer > 0) {
      localPlayer.dashCooldownTimer = Math.max(0, localPlayer.dashCooldownTimer - dtSec);
    }
    if (localPlayer.dashTimer > 0) {
      localPlayer.dashTimer = Math.max(0, localPlayer.dashTimer - dtSec);
    }

    const wantsDash = (inp.buttons & INPUT_BUTTON.DASH) !== 0;
    if (
      wantsDash &&
      localPlayer.lifeState === 'alive' &&
      localPlayer.dashTimer <= 0 &&
      localPlayer.dashCooldownTimer <= 0
    ) {
      localPlayer.dashTimer = 0.14;
      localPlayer.dashCooldownTimer = 0.55;
      const len = Math.hypot(inp.moveX, inp.moveY);
      const dirX = len > 0.01 ? inp.moveX / len : Math.cos(inp.aimAngle);
      const dirY = len > 0.01 ? inp.moveY / len : Math.sin(inp.aimAngle);
      localPlayer.vx = dirX * 520;
      localPlayer.vy = dirY * 520;
    } else if (localPlayer.dashTimer <= 0) {
      const len = Math.hypot(inp.moveX, inp.moveY);
      const nx = len > 0.001 ? inp.moveX / Math.max(1, len) : 0;
      const ny = len > 0.001 ? inp.moveY / Math.max(1, len) : 0;
      const speed =
        localPlayer.lifeState === 'downed'
          ? 38
          : localPlayer.lifeState === 'ghost'
            ? localPlayer.moveSpeed * 0.85
            : localPlayer.moveSpeed;
      localPlayer.vx = nx * speed;
      localPlayer.vy = ny * speed;
    }

    const nextX = localPlayer.x + localPlayer.vx * dtSec;
    const nextY = localPlayer.y + localPlayer.vy * dtSec;
    const col = this.sim.map.resolveCircleCollision(nextX, nextY, localPlayer.radius);
    localPlayer.x = col.x;
    localPlayer.y = col.y;

    // Deterministically simulate projectiles on client (wall bounce + immediate cosmetic enemy hit prediction)
    this.sim.stepClientProjectilesCosmetic(dtSec);
  }

  public getLocalPlayerState(): SimPlayerState {
    return this.sim.getPlayerById(this.localPlayerId) ?? this.sim.player;
  }

  public getSim(): WorldSim {
    return this.sim;
  }

  public getInterpolationAlpha(): number {
    return this.alpha;
  }

  public getInterpolatedPlayerPos(out?: InterpolatedEntityPos): InterpolatedEntityPos {
    return this.getInterpolatedSimPlayerPos(this.getLocalPlayerState(), out);
  }

  public getInterpolatedSimPlayerPos(
    player: SimPlayerState,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos {
    if (player.id === this.localPlayerId) {
      const x = lerp(player.prevX, player.x, this.alpha) + this.reconcileOffsetX;
      const y = lerp(player.prevY, player.y, this.alpha) + this.reconcileOffsetY;
      if (out) {
        out.x = x;
        out.y = y;
        return out;
      }
      return { x, y };
    }

    const samples = this.remotePlayerSamples.get(player.id);
    return this.interpolateFromSamples(samples, player.x, player.y, out);
  }

  public getInterpolatedEnemyPos(
    enemy: SimEnemyState,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos {
    const samples = this.enemySamples.get(enemy.id);
    return this.interpolateFromSamples(samples, enemy.x, enemy.y, out);
  }

  private interpolateFromSamples(
    samples: EntityInterpSample[] | undefined,
    fallbackX: number,
    fallbackY: number,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos {
    if (!samples || samples.length === 0) {
      if (out) {
        out.x = fallbackX;
        out.y = fallbackY;
        return out;
      }
      return { x: fallbackX, y: fallbackY };
    }

    if (samples.length === 1) {
      const s = samples[0]!;
      if (out) {
        out.x = s.x;
        out.y = s.y;
        return out;
      }
      return { x: s.x, y: s.y };
    }

    const renderTimeMs = this.wifiSim.getNowMs() - this.interpolationDelayMs;
    for (let i = samples.length - 1; i >= 1; i--) {
      const s1 = samples[i]!;
      const s0 = samples[i - 1]!;
      if (renderTimeMs >= s0.timeMs && renderTimeMs <= s1.timeMs) {
        const span = Math.max(1, s1.timeMs - s0.timeMs);
        const t = clamp((renderTimeMs - s0.timeMs) / span, 0, 1);
        const x = lerp(s0.x, s1.x, t);
        const y = lerp(s0.y, s1.y, t);
        if (out) {
          out.x = x;
          out.y = y;
          return out;
        }
        return { x, y };
      }
    }

    const latest = samples[samples.length - 1]!;
    if (renderTimeMs > latest.timeMs) {
      const extrapSec = Math.min(0.04, (renderTimeMs - latest.timeMs) / 1000);
      const x = latest.x + latest.vx * extrapSec;
      const y = latest.y + latest.vy * extrapSec;
      if (out) {
        out.x = x;
        out.y = y;
        return out;
      }
      return { x, y };
    }

    const oldest = samples[0]!;
    if (out) {
      out.x = oldest.x;
      out.y = oldest.y;
      return out;
    }
    return { x: oldest.x, y: oldest.y };
  }

  public getInterpolatedProjectilePos(
    proj: SimProjectileState,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos {
    const x = lerp(proj.prevX, proj.x, this.alpha);
    const y = lerp(proj.prevY, proj.y, this.alpha);
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  }

  public getInterpolatedPickupPos(
    pickup: SimPickupState,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos {
    const x = lerp(pickup.prevX, pickup.x, this.alpha);
    const y = lerp(pickup.prevY, pickup.y, this.alpha);
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  }

  public consumeEvents(): SimEvent[] {
    const localSimEvents = this.sim.consumeEvents();
    if (this.pendingEvents.length === 0 && localSimEvents.length === 0) return [];
    const merged = [...localSimEvents, ...this.pendingEvents];
    this.pendingEvents.length = 0;
    return merged;
  }
}
