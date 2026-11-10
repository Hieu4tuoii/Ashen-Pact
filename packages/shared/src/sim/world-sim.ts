import { SeededRandom } from '../core/prng.js';
import { BIOME2_COMBAT_ENEMIES, BIOME3_COMBAT_ENEMIES } from '../data/enemies.js';
import type { AshenPactId, BlessingId, BuffId, CardinalDir, CharacterId, ElementalReactionId, EliteModifier, ElementType, WeaponMutatorId, WeaponRarity } from '../data/types.js';
import { SpatialHashGrid } from '../math/spatial-hash.js';
import type { PlayerInputPacket, QuickEmoteId } from '../protocol/messages.js';
import { ArenaMap, type RoomArchetypeId, type SurfaceKind } from './arena-map.js';
import { type DungeonFloorGraph, type DungeonRoomNode, generateDungeonFloor } from './dungeon-gen.js';
import { PHASE1_SAMPLE_ENEMIES, hasPlayerBlessing, type SecretTrialResult, type PropKind, type SimPropState, type SimSummonState, type SimSkillZoneState, type SimPressurePlateState, type SimPushBlockState, type SimShockwaveRingState, type SimTetherBeamState, type SimMagneticRivetState, type SimFlameFissureState, type SimSolarFireZoneState, type SimMagmaTrailSegmentState, type SimLightningPillarState, type SimDoorState, type SimChestState, type SimWorldItemState, type SimNpcState, type SimHubStatue, type SimPingMarker, type RunSummaryStats, type MvpAwardEntry, type SimPlayerState, type SimEnemyState, type SimProjectileState, type SimPickupState, type BulletVolleySpawnEvent, type SimPendingMortarStrike, type SimEmpBlastVisualRing, type SimPendingBossSupplyDrop } from './world-sim-types.js';
import type { SimEvent, WorldSimOptions, CoPlayerInputEntry } from './world-sim-events.js';
import { createPlayerStateImpl, getAllPlayersImpl, getActivePlayerCountImpl, setPlayerCountOverrideImpl, getPlayerByIdImpl, getPlayerBySlotImpl, addCoopPlayerImpl, removeCoopPlayerImpl, setCoopPlayerInputImpl, applyCharacterToPlayerStateImpl, selectCharacterImpl, togglePlayerReadyImpl, areAllPlayersReadyImpl, enterHubImpl, startDungeonRunFromHubImpl, triggerPingImpl, triggerEmoteImpl, spawnDroppedWeaponImpl, dropActiveWeaponImpl, updateCoopDownedAndReviveImpl } from './sim-coop-hub.js';
import { spawnDefaultArenaPropsImpl, spawnPropImpl, cycleImbueElementImpl, setImbueElementImpl, configureStressTestImpl, topUpStressTestProjectilesImpl, setPlayerInputImpl, getActiveWeaponIdImpl, equipWeaponSlotImpl, cycleWeaponImpl, spawnTrainingDummyImpl, spawnEnemyImpl, spawnBossGuardianMushroomsImpl, hasActiveBossGuardiansImpl, spawnSampleWaveImpl, getCurrentRoomImpl, hasActiveCombatEnemiesImpl, getActiveBossImpl, rollChestRarityImpl, rollRandomWeaponByRaritiesImpl, spawnChestImpl, spawnWorldItemImpl, resolvePropMovementCollisionImpl, updatePropsImpl, damagePropImpl, detonateExplosiveBarrelImpl, applyElementAtWorldPointImpl } from './sim-props-spawning.js';
import { rebuildCurrentRoomDoorsImpl, enterRoomImpl, spawnCoopPressurePlatePuzzleImpl, populateRoomContentsImpl, spawnNextRoomWaveImpl, onRoomClearedImpl, openChestImpl, pickupOrBuyWorldItemImpl } from './sim-dungeon-rooms.js';
import { activateShrineImpl, enterPortalImpl, rollPendingBuffChoicesImpl, applyBuffEffectsImpl, selectFloorBuffImpl, advanceToFloorImpl, advanceToBiomeImpl, skipCurrentRoomWavesImpl, interactWithNearestImpl, updateCurrentRoomProgressionImpl, stepBotAutoPlayImpl, findNextBotDoorImpl, recordDamageHistoryImpl, getRollingDpsImpl, rebuildEnemySpatialGridImpl, rebuildEnemyBulletSpatialGridImpl, updatePickupsImpl, acquirePickupImpl } from './sim-progression-bot.js';
import { updatePlayerImpl, updateSinglePlayerStateImpl, updateSimulatedPlayersImpl, updatePlayerSurfaceAndStatusImpl, tryFireActiveWeaponImpl } from './sim-player.js';
import { activateCharacterSkillImpl, updateSkillZonesAndSummonsImpl, triggerTeslaEmpBlastImpl, releaseVanguardShieldShockwaveImpl } from './sim-skills-mechanics.js';
import { updatePhase6MechanicsImpl, findNearestAlivePlayerImpl, getCoopEnemyCooldownScaleImpl, updateEnemiesImpl, getEnemyCooldownScaleImpl, updateEnemyStatusAndSurfaceImpl, applyDotDamageToEnemyImpl, checkBossPhaseTransitionsImpl } from './sim-enemies-core.js';
import { updateGoblinShooterAIImpl, updateWildBoarAIImpl, updateSporeBomberAIImpl, detonateSporeBomberImpl, updateSlimeAIImpl, updateGoblinShamanAIImpl, updateThornTurretAIImpl, updateBossSporeKingAIImpl, executeBossSporeKingAttackImpl } from './sim-enemies-biome1.js';
import { updateFrostBatAIImpl, updateBabyYetiAIImpl, updateIceMageAIImpl, updateIceGolemAIImpl, updateSnowSpiritAIImpl, detonateSnowSpiritImpl, updateKryssaCloneAIImpl, spawnKryssaMirrorClonesImpl, encasePlayerInIcePrisonImpl, updateBossKryssaAIImpl, executeBossKryssaAttackImpl } from './sim-enemies-biome2.js';
import { updateFireImpAIImpl, updateDwarfCannonAIImpl, updateCoalGolemAIImpl, updateWelderDroneAIImpl, updateIronShielderAIImpl, spawnForgeTitanEnergyCoresImpl, updateBossForgeTitanAIImpl, executeBossForgeTitanAttackImpl, computeMvpAwardsImpl } from './sim-enemies-biome3.js';
import { spawnDeterministicVolleyImpl, spawnSeedGunLifeBlossomImpl, triggerLauncherProjectileExplosionImpl, updateProjectilesImpl, stepClientProjectilesCosmeticImpl, acquireProjectileImpl } from './sim-projectiles.js';
import { applyDamageToEnemyImpl, triggerElementalReactionImpl, handleEnemyKilledImpl, applyElementStatusToEnemyImpl, applyDamageToPlayerImpl } from './sim-combat-damage.js';
import { flipCoverPropImpl, kickPropImpl, updateSlidingPropsImpl } from './sim-tactical-physics.js';
import { updateMagneticRivets } from './sim-weapon-specials.js';
import { selectWeaponMutatorImpl, updateGravitySingularities } from './sim-weapon-mutators.js';
import { purifyAshenPactsOnBossDefeated, selectAshenPactImpl } from './sim-ashen-pacts.js';
import { updateDuoBoons } from './sim-duo-boons.js';
import { resetSecretSkillArenaState, updateSecretSkillArena } from './sim-secret-arena.js';

export * from './world-sim-types.js';
export * from './world-sim-events.js';
export * from './sim-blessings.js';
export * from './sim-tactical-physics.js';
export * from './sim-weapon-cadence.js';
export * from './sim-weapon-specials.js';
export * from './sim-weapon-mutators.js';
export * from './sim-ashen-pacts.js';
export * from './sim-duo-boons.js';
export * from './sim-secret-arena.js';
export * from './sim-secret-and-workshop.js';
export * from './sim-boss-armor-break.js';
export * from './sim-bot-tactical-helpers.js';

export class WorldSim {
  public readonly rng: SeededRandom;
  public readonly map: ArenaMap;
  public readonly enemySpatialGrid = new SpatialHashGrid<SimEnemyState>(64);
  public readonly bulletSpatialGrid = new SpatialHashGrid<SimProjectileState>(64);

  public tick = 0;
  public waveNumber = 0;
  public stressTestActive = false;
  public botAutoPlayActive = false;
  public player: SimPlayerState;
  public simulatedPlayers: SimPlayerState[] = [];
  public enemies: SimEnemyState[] = [];
  public projectiles: SimProjectileState[] = [];
  public pickups: SimPickupState[] = [];
  public props: SimPropState[] = [];
  public summons: SimSummonState[] = [];
  public skillZones: SimSkillZoneState[] = [];
  public teamComboCount = 0;

  // Phase 6 Biomes 2 & 3, Co-op Pressure Plates, Shockwave Rings & Tether Beams
  public currentBiome: 1 | 2 | 3 = 1;
  public campaignMaxFloors: 2 | 6 = 6;
  public pressurePlates: SimPressurePlateState[] = [];
  public pushBlocks: SimPushBlockState[] = [];
  public coopPuzzleCompleted = false;
  public shockwaveRings: SimShockwaveRingState[] = [];
  public tetherBeams: SimTetherBeamState[] = [];
  public magneticRivets: SimMagneticRivetState[] = [];
  public flameFissures: SimFlameFissureState[] = [];
  public solarFireZones: SimSolarFireZoneState[] = [];
  public magmaTrails: SimMagmaTrailSegmentState[] = [];
  public lightningPillars: SimLightningPillarState[] = [];
  public get activeRivets(): SimMagneticRivetState[] {
    return this.magneticRivets;
  }
  public set activeRivets(v: SimMagneticRivetState[]) {
    this.magneticRivets = v;
  }
  public blizzardVeilActive = false;
  public titanCoreWindowTimer = 0;
  public titanFirstCoreBrokenId = 0;
  public nextPuzzleEntityId = 90000;
  public readonly completedPuzzleRoomIds = new Set<number>();

  // Phase 4 Hub & Co-op State
  public inHub = false;
  public coopModeActive = false;
  public allowDuplicateCharacters = false;
  public hubStatues: SimHubStatue[] = [];
  public pings: SimPingMarker[] = [];
  public coopPlayerCountOverride: (1 | 2 | 3 | 4) | null = null;
  public readonly coopPlayerInputs = new Map<number, CoPlayerInputEntry>();

  // Phase 3 Dungeon, Rooms, Chests, Shop, Shrine, Buffs & Run Loop
  public readonly baseSeed: string | number;
  public currentFloor: 1 | 2 | 3 | 4 | 5 | 6 = 1;
  public dungeon: DungeonFloorGraph;
  public currentRoomId = 0;
  public roomArchetype?: RoomArchetypeId;
  public secretWallBroken = false;
  public secretTrialActive = false;
  public secretTrialTimer = 0;
  public secretTrialResult: SecretTrialResult = 'idle';
  public secretTrialBannerTimer = 0;
  public secretTrialRemainingEnemies = 0;
  public secretTrialActivatedTick = -1;
  public doors: SimDoorState[] = [];
  public chests: SimChestState[] = [];
  public worldItems: SimWorldItemState[] = [];
  public npcEntities: SimNpcState[] = [];
  public portalActive = false;
  public portalX = 0;
  public portalY = 0;
  public runState: 'playing' | 'buff_choice' | 'victory' | 'defeat' = 'playing';
  public runStats: RunSummaryStats = {
    kills: 0,
    elitesKilled: 0,
    bossesKilled: 0,
    damageDealt: 0,
    goldEarned: 0,
    roomsCleared: 1,
    chestsOpened: 0,
    floorReached: 1,
    ticksElapsed: 0,
    elementalReactions: 0,
    teamCombos: 0,
  };

  public nextEntityId = 100;
  public nextVolleyEventId = 1;
  public eventsBufferA: SimEvent[] = [];
  public eventsBufferB: SimEvent[] = [];
  public activeEventsBuffer: 'A' | 'B' = 'A';
  public readonly emptyEvents: SimEvent[] = [];
  public prevButtons = 0;
  public latchedButtons = 0;
  public latchedWeaponSlot: number | null = null;
  public currentInput: PlayerInputPacket = {
    seq: 0,
    tick: 0,
    moveX: 0,
    moveY: 0,
    aimAngle: 0,
    buttons: 0,
    weaponSlotSelect: null,
  };

  public readonly autoRespawnWaves: boolean;
  public readonly autoRevivePlayer: boolean;
  public waveRespawnTimer = 0;
  public waveElapsedSec = 0;
  public pendingVengefulRings: {
    id: number;
    ownerId: number;
    x: number;
    y: number;
    timerSec: number;
    damage: number;
  }[] = [];
  public pendingMortarStrikes: SimPendingMortarStrike[] = [];
  public empBlastVisualRings: SimEmpBlastVisualRing[] = [];
  public pendingBossSupplyDrops: SimPendingBossSupplyDrop[] = [];
  public get PendingMortarStrikes(): SimPendingMortarStrike[] { return this.pendingMortarStrikes; }
  public set PendingMortarStrikes(v: SimPendingMortarStrike[]) { this.pendingMortarStrikes = v; }
  public get hazardZones(): SimPendingMortarStrike[] { return this.pendingMortarStrikes; }
  public set hazardZones(v: SimPendingMortarStrike[]) { this.pendingMortarStrikes = v; }
  public get HazardZones(): SimPendingMortarStrike[] { return this.pendingMortarStrikes; }
  public set HazardZones(v: SimPendingMortarStrike[]) { this.pendingMortarStrikes = v; }
  public doorTransitionCooldown = 0;
  public readonly queryEnemyScratch: SimEnemyState[] = [];
  public readonly queryBulletScratch: SimProjectileState[] = [];
  public readonly projectilePool: SimProjectileState[] = [];
  public readonly pickupPool: SimPickupState[] = [];
  public readonly damageHistory: { tick: number; amount: number }[] = [];
  public readonly damageHistoryPool: { tick: number; amount: number }[] = [];
  public readonly roomItemsByRoomId = new Map<number, SimWorldItemState[]>();
  public readonly roomChestsByRoomId = new Map<number, SimChestState[]>();
  public readonly initializedRoomIds = new Set<number>([0]);

  public readonly allPlayersScratch: SimPlayerState[] = [];
  public readonly volleyRng = new SeededRandom(1);

  constructor(options: WorldSimOptions = {}) {
    const seedVal = options.seed ?? 0x1337c0de;
    this.baseSeed = seedVal;
    this.rng = new SeededRandom(seedVal);
    this.coopModeActive = options.coopMode ?? Boolean(options.startInHub);
    if (options.playerCount) {
      this.coopPlayerCountOverride = options.playerCount;
    }
    this.currentBiome = options.biome ?? options.mapConfig?.biome ?? 1;
    this.campaignMaxFloors = options.campaignMaxFloors ?? 6;
    this.currentFloor = this.currentBiome === 1 ? 1 : this.currentBiome === 2 ? 3 : 5;

    const spawnWave = options.startInHub ? false : (options.spawnInitialWave ?? true);
    this.map = new ArenaMap({
      seed: seedVal,
      includeSurfaces: spawnWave,
      biome: this.currentBiome,
      ...options.mapConfig,
    });
    this.autoRespawnWaves = options.autoRespawnWaves ?? false;
    this.autoRevivePlayer = options.autoRevivePlayer ?? true;

    const initialPCount = this.coopPlayerCountOverride ?? 1;
    const floorInBiome: 1 | 2 = this.currentFloor % 2 === 1 ? 1 : 2;
    this.dungeon = generateDungeonFloor(seedVal, floorInBiome, this.currentBiome, initialPCount);
    this.currentRoomId = this.dungeon.startRoomId;

    const startX = this.map.width * 0.35;
    const startY = this.map.height * 0.5;
    this.player = this.createPlayerState(1, 1, 'vanguard', startX, startY);

    if (options.startInHub) {
      this.enterHub();
      return;
    }

    if (options.includeTrainingDummy ?? true) {
      this.spawnTrainingDummy(210, 260);
    }

    if (options.includeProps ?? spawnWave) {
      this.spawnDefaultArenaProps();
    }

    if (spawnWave) {
      this.spawnSampleWave();
    }

    this.rebuildCurrentRoomDoors();
  }

  public get events(): SimEvent[] {
    return this.activeEventsBuffer === 'A' ? this.eventsBufferA : this.eventsBufferB;
  }

  /**
   * Executes a single 60Hz deterministic simulation tick (dtSec = 1/60),
   * or accepts a player input command object and advances one tick.
   */
  public step(
    dtOrCmd:
      | number
      | {
          seq?: number;
          tick?: number;
          clientTick?: number;
          moveX: number;
          moveY: number;
          aimX?: number;
          aimY?: number;
          aimAngle?: number;
          buttons: number;
          weaponSlotSelect?: number | null;
          loadoutSlot?: number | null;
        } = 1 / 60,
  ): void {
    let dtSec = 1 / 60;
    if (typeof dtOrCmd === 'number') {
      dtSec = dtOrCmd;
    } else if (dtOrCmd && typeof dtOrCmd === 'object') {
      const aimAngle =
        typeof dtOrCmd.aimAngle === 'number'
          ? dtOrCmd.aimAngle
          : typeof dtOrCmd.aimX === 'number' && typeof dtOrCmd.aimY === 'number'
            ? Math.atan2(dtOrCmd.aimY - this.player.y, dtOrCmd.aimX - this.player.x)
            : this.player.aimAngle;
      if (typeof dtOrCmd.aimX === 'number' && typeof dtOrCmd.aimY === 'number') {
        this.player.aimWorldX = dtOrCmd.aimX;
        this.player.aimWorldY = dtOrCmd.aimY;
      }
      this.setPlayerInput({
        seq: dtOrCmd.seq ?? this.tick + 1,
        tick: dtOrCmd.tick ?? dtOrCmd.clientTick ?? this.tick + 1,
        moveX: dtOrCmd.moveX,
        moveY: dtOrCmd.moveY,
        aimAngle,
        buttons: dtOrCmd.buttons,
        weaponSlotSelect: dtOrCmd.weaponSlotSelect ?? dtOrCmd.loadoutSlot ?? null,
      });
    }
    this.tick += 1;
    this.runStats.ticksElapsed += 1;
    if (this.doorTransitionCooldown > 0) {
      this.doorTransitionCooldown = Math.max(0, this.doorTransitionCooldown - dtSec);
    }

    // Decay active contextual ping markers
    if (this.pings.length > 0) {
      let pingWrite = 0;
      for (let i = 0; i < this.pings.length; i++) {
        const m = this.pings[i]!;
        m.ttlSec -= dtSec;
        if (m.ttlSec > 0) {
          this.pings[pingWrite++] = m;
        }
      }
      this.pings.length = pingWrite;
    }

    if (this.botAutoPlayActive && !this.stressTestActive) {
      this.stepBotAutoPlay(dtSec);
    }

    // 1. Save previous positions for render interpolation
    this.player.prevX = this.player.x;
    this.player.prevY = this.player.y;
    for (let i = 0; i < this.simulatedPlayers.length; i++) {
      const sp = this.simulatedPlayers[i]!;
      sp.prevX = sp.x;
      sp.prevY = sp.y;
    }
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      e.prevX = e.x;
      e.prevY = e.y;
    }
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i]!;
      p.prevX = p.x;
      p.prevY = p.y;
    }
    for (let i = 0; i < this.pickups.length; i++) {
      const pk = this.pickups[i]!;
      pk.prevX = pk.x;
      pk.prevY = pk.y;
    }

    // 2. Step dynamic elemental surfaces (fire propagation, electrified water decay, ice melt)
    this.map.stepSurfaces(dtSec);

    // 3. Rebuild enemy spatial grid once before player/enemy updates
    this.rebuildEnemySpatialGrid();

    // 4. Update Player & Co-op / Simulated Players
    this.updatePlayer(dtSec);
    if (this.simulatedPlayers.length > 0) {
      this.updateSimulatedPlayers(dtSec);
    }
    if (!this.stressTestActive && (this.coopModeActive || this.simulatedPlayers.length > 0)) {
      this.updateCoopDownedAndRevive(dtSec);
    }

    // 5. Update Destructible Props & Barrel Fuses
    this.updateProps(dtSec);

    // 5.5 Update Phase 5 Skill Zones & Summons + Phase 6 Mechanics
    if (!this.stressTestActive) {
      if (this.skillZones.length > 0 || this.summons.length > 0) {
        this.updateSkillZonesAndSummons(dtSec);
      }
      this.updatePhase6Mechanics(dtSec);
    }

    // 6. Update Enemies, Elemental Status DoTs & AI
    this.updateEnemies(dtSec);

    // 7. Update Projectiles & Collisions (rebuilds enemy spatial grid internally)
    if (this.projectiles.length > 0) {
      this.updateProjectiles(dtSec);
    }
    if (!this.stressTestActive) {
      if (this.magneticRivets.length > 0) {
        updateMagneticRivets(this, dtSec);
      }
      updateGravitySingularities(this, dtSec);
      updateDuoBoons(this, dtSec);
      updateSecretSkillArena(this, dtSec);
    }

    // 9. Update Pickups (Magnet & Collection)
    if (this.pickups.length > 0) {
      this.updatePickups(dtSec);
    }

    // 10. Stress Test top-up or Dungeon Room / Wave progression
    if (this.stressTestActive) {
      const enemyTypes =
        this.currentBiome === 2
          ? BIOME2_COMBAT_ENEMIES
          : this.currentBiome === 3
            ? BIOME3_COMBAT_ENEMIES
            : PHASE1_SAMPLE_ENEMIES;
      while (this.enemies.length < 80) {
        const defId = enemyTypes[this.enemies.length % enemyTypes.length]!;
        const e = this.spawnEnemy(defId, undefined, undefined, true);
        e.hp = 500;
        e.maxHp = 500;
      }
      if (this.projectiles.length < 610) {
        this.topUpStressTestProjectiles(625);
      }
    } else if (!this.inHub) {
      this.updateCurrentRoomProgression(dtSec);
    }

    // Prune old DPS history (> 3 seconds = 180 ticks)
    const minTick = this.tick - 180;
    let firstValidIdx = 0;
    while (
      firstValidIdx < this.damageHistory.length &&
      this.damageHistory[firstValidIdx]!.tick < minTick
    ) {
      this.damageHistoryPool.push(this.damageHistory[firstValidIdx]!);
      firstValidIdx++;
    }
    if (firstValidIdx > 0) {
      let writeIdx = 0;
      for (let i = firstValidIdx; i < this.damageHistory.length; i++) {
        this.damageHistory[writeIdx++] = this.damageHistory[i]!;
      }
      this.damageHistory.length = writeIdx;
    }

    this.prevButtons = this.currentInput.buttons;
    this.latchedButtons = 0;
    this.latchedWeaponSlot = null;
  }

  public consumeEvents(): SimEvent[] {
    const current = this.events;
    if (current.length === 0) return this.emptyEvents;
    if (this.activeEventsBuffer === 'A') {
      this.activeEventsBuffer = 'B';
      this.eventsBufferB.length = 0;
    } else {
      this.activeEventsBuffer = 'A';
      this.eventsBufferA.length = 0;
    }
    return current;
  }

  public drainEvents(): SimEvent[] {
    return this.consumeEvents();
  }

  public createPlayerState(id: number, slot: 1 | 2 | 3 | 4, characterId: CharacterId, x: number, y: number, displayName?: string): SimPlayerState  { return createPlayerStateImpl.call(this, id, slot, characterId, x, y, displayName); }
  public getAllPlayers(): SimPlayerState[]  { return getAllPlayersImpl.call(this); }
  public getActivePlayerCount(): 1 | 2 | 3 | 4  { return getActivePlayerCountImpl.call(this); }
  public setPlayerCountOverride(count: (1 | 2 | 3 | 4) | null): void  { return setPlayerCountOverrideImpl.call(this, count); }
  public getPlayerById(playerId: number): SimPlayerState | undefined  { return getPlayerByIdImpl.call(this, playerId); }
  public getPlayerBySlot(slot: 1 | 2 | 3 | 4): SimPlayerState | undefined  { return getPlayerBySlotImpl.call(this, slot); }
  public addCoopPlayer(slotOrId: 1 | 2 | 3 | 4 | number, characterIdOrSlot: CharacterId | (1 | 2 | 3 | 4) = 'vanguard', displayNameOrChar?: string, idOrName?: number | string): SimPlayerState  { return addCoopPlayerImpl.call(this, slotOrId, characterIdOrSlot, displayNameOrChar, idOrName); }
  public removeCoopPlayer(playerId: number): boolean  { return removeCoopPlayerImpl.call(this, playerId); }
  public setCoopPlayerInput(playerId: number, input: PlayerInputPacket): void  { return setCoopPlayerInputImpl.call(this, playerId, input); }
  public applyCharacterToPlayerState(p: SimPlayerState, characterId: CharacterId, displayName?: string): void  { return applyCharacterToPlayerStateImpl.call(this, p, characterId, displayName); }
  public selectCharacter(playerId: number, characterId: CharacterId, allowDuplicateOverride?: boolean): boolean  { return selectCharacterImpl.call(this, playerId, characterId, allowDuplicateOverride); }
  public togglePlayerReady(playerId: number, ready?: boolean): boolean  { return togglePlayerReadyImpl.call(this, playerId, ready); }
  public areAllPlayersReady(): boolean  { return areAllPlayersReadyImpl.call(this); }
  public enterHub(): void  { resetSecretSkillArenaState(this); return enterHubImpl.call(this); }
  public startDungeonRunFromHub(): void  { return startDungeonRunFromHubImpl.call(this); }
  public triggerPing(playerId: number, worldX: number, worldY: number): SimPingMarker | null  { return triggerPingImpl.call(this, playerId, worldX, worldY); }
  public triggerEmote(playerId: number, emoteId: QuickEmoteId): boolean  { return triggerEmoteImpl.call(this, playerId, emoteId); }
  public spawnDroppedWeapon(weaponId: string, x: number, y: number, droppedByPlayerId = this.player.id, fromX = x, fromY = y): SimWorldItemState | null  { return spawnDroppedWeaponImpl.call(this, weaponId, x, y, droppedByPlayerId, fromX, fromY); }
  public dropActiveWeapon(playerId = this.player.id): SimWorldItemState | null  { return dropActiveWeaponImpl.call(this, playerId); }
  public spawnDefaultArenaProps(): void  { return spawnDefaultArenaPropsImpl.call(this); }
  public spawnProp(kind: PropKind, x: number, y: number): SimPropState  { return spawnPropImpl.call(this, kind, x, y); }
  public cycleImbueElement(): ElementType  { return cycleImbueElementImpl.call(this); }
  public setImbueElement(element: ElementType): void  { return setImbueElementImpl.call(this, element); }
  public configureStressTest(active: boolean): void  { return configureStressTestImpl.call(this, active); }
  public topUpStressTestProjectiles(targetCount: number): void  { return topUpStressTestProjectilesImpl.call(this, targetCount); }
  public setPlayerInput(input: PlayerInputPacket): void  { return setPlayerInputImpl.call(this, input); }
  public getActiveWeaponId(): string  { return getActiveWeaponIdImpl.call(this); }
  public equipWeaponSlot(slotIndex: number): void  { return equipWeaponSlotImpl.call(this, slotIndex); }
  public cycleWeapon(direction = 1): void  { return cycleWeaponImpl.call(this, direction); }
  public spawnTrainingDummy(x: number, y: number): SimEnemyState  { return spawnTrainingDummyImpl.call(this, x, y); }
  public spawnEnemy(defId: string, x?: number, y?: number, skipSpawnWarmup = false, eliteModifier: EliteModifier | null = null): SimEnemyState  { return spawnEnemyImpl.call(this, defId, x, y, skipSpawnWarmup, eliteModifier); }
  public spawnBossGuardianMushrooms(): void  { return spawnBossGuardianMushroomsImpl.call(this); }
  public hasActiveBossGuardians(): boolean  { return hasActiveBossGuardiansImpl.call(this); }
  public spawnSampleWave(): void  { return spawnSampleWaveImpl.call(this); }
  public getCurrentRoom(): DungeonRoomNode  { return getCurrentRoomImpl.call(this); }
  public hasActiveCombatEnemies(): boolean  { return hasActiveCombatEnemiesImpl.call(this); }
  public getActiveBoss(): SimEnemyState | null  { return getActiveBossImpl.call(this); }
  public rebuildCurrentRoomDoors(): void  { return rebuildCurrentRoomDoorsImpl.call(this); }
  public enterRoom(roomId: number, entryDir?: CardinalDir): boolean  { return enterRoomImpl.call(this, roomId, entryDir); }
  public spawnCoopPressurePlatePuzzle(roomId = this.currentRoomId): void  { return spawnCoopPressurePlatePuzzleImpl.call(this, roomId); }
  public populateRoomContents(room: DungeonRoomNode): void  { return populateRoomContentsImpl.call(this, room); }
  public spawnNextRoomWave(): void  { return spawnNextRoomWaveImpl.call(this); }
  public onRoomCleared(room: DungeonRoomNode = this.getCurrentRoom()): void  { return onRoomClearedImpl.call(this, room); }
  public rollChestRarity(bonusTier = 0): WeaponRarity  { return rollChestRarityImpl.call(this, bonusTier); }
  public rollRandomWeaponByRarities(allowedRarities: readonly WeaponRarity[]): string  { return rollRandomWeaponByRaritiesImpl.call(this, allowedRarities); }
  public spawnChest(x: number, y: number, rarity: WeaponRarity, preselectedWeaponId?: string): SimChestState  { return spawnChestImpl.call(this, x, y, rarity, preselectedWeaponId); }
  public spawnWorldItem(init: Omit<SimWorldItemState, 'id' | 'radius' | 'pickedUp'>): SimWorldItemState  { return spawnWorldItemImpl.call(this, init); }
  public openChest(chest: SimChestState): boolean  { return openChestImpl.call(this, chest); }
  public pickupOrBuyWorldItem(item: SimWorldItemState, collector: SimPlayerState = this.player): boolean  { return pickupOrBuyWorldItemImpl.call(this, item, collector); }
  public activateShrine(shrine: SimNpcState, actor: SimPlayerState = this.player): boolean  { return activateShrineImpl.call(this, shrine, actor); }
  public enterPortal(): boolean  { return enterPortalImpl.call(this); }
  public rollPendingBuffChoices(): void  { return rollPendingBuffChoicesImpl.call(this); }
  public hasPlayerBlessing(p: SimPlayerState, id: BlessingId): boolean { return hasPlayerBlessing(p, id); }
  public applyBuffEffects(buffId: BuffId, playerId = this.player.id): void  { return applyBuffEffectsImpl.call(this, buffId, playerId); }
  public selectFloorBuff(buffId: BuffId, playerId = this.player.id): boolean  { return selectFloorBuffImpl.call(this, buffId, playerId); }
  public selectWeaponMutator(mutatorId: WeaponMutatorId, playerId = this.player.id): boolean  { return selectWeaponMutatorImpl(this, mutatorId, playerId); }
  public selectAshenPact(pactIdOrDecline: AshenPactId | 'decline', playerId = this.player.id): boolean  { return selectAshenPactImpl(this, pactIdOrDecline, playerId); }
  public onBossDefeated(): number  { return purifyAshenPactsOnBossDefeated(this); }
  public advanceToFloor(floorNumber: 1 | 2 | 3 | 4 | 5 | 6): void  { return advanceToFloorImpl.call(this, floorNumber); }
  public advanceToBiome(biome: 1 | 2 | 3): void  { return advanceToBiomeImpl.call(this, biome); }
  public skipCurrentRoomWaves(): void  { return skipCurrentRoomWavesImpl.call(this); }
  public interactWithNearest(actor: SimPlayerState | number = this.player): boolean  { return interactWithNearestImpl.call(this, actor); }
  public updateCurrentRoomProgression(dtSec: number): void  { return updateCurrentRoomProgressionImpl.call(this, dtSec); }
  public stepBotAutoPlay(_dtSec: number): void  { return stepBotAutoPlayImpl.call(this, _dtSec); }
  public findNextBotDoor(): SimDoorState | null  { return findNextBotDoorImpl.call(this); }
  public recordDamageHistory(amount: number): void  { return recordDamageHistoryImpl.call(this, amount); }
  public getRollingDps(): number  { return getRollingDpsImpl.call(this); }
  public rebuildEnemySpatialGrid(): void  { return rebuildEnemySpatialGridImpl.call(this); }
  public rebuildEnemyBulletSpatialGrid(): void  { return rebuildEnemyBulletSpatialGridImpl.call(this); }
  public updatePlayer(dtSec: number): void  { return updatePlayerImpl.call(this, dtSec); }
  public updateSinglePlayerState(p: SimPlayerState, inp: PlayerInputPacket, justPressed: number, selectedSlot: number | null, dtSec: number): void  { return updateSinglePlayerStateImpl.call(this, p, inp, justPressed, selectedSlot, dtSec); }
  public activateCharacterSkill(p: SimPlayerState): void  { return activateCharacterSkillImpl.call(this, p); }
  public updateSkillZonesAndSummons(dtSec: number): void  { return updateSkillZonesAndSummonsImpl.call(this, dtSec); }
  public updatePhase6Mechanics(dtSec: number): void  { return updatePhase6MechanicsImpl.call(this, dtSec); }
  public triggerTeslaEmpBlast(turret: SimSummonState): void  { return triggerTeslaEmpBlastImpl.call(this, turret); }
  public updateSimulatedPlayers(dtSec: number): void  { return updateSimulatedPlayersImpl.call(this, dtSec); }
  public updateCoopDownedAndRevive(dtSec: number): void  { return updateCoopDownedAndReviveImpl.call(this, dtSec); }
  public updatePlayerSurfaceAndStatus(p: SimPlayerState, surf: SurfaceKind, dtSec: number): void  { return updatePlayerSurfaceAndStatusImpl.call(this, p, surf, dtSec); }
  public resolvePropMovementCollision(entity: { x: number; y: number; radius: number }): void  { return resolvePropMovementCollisionImpl.call(this, entity); }
  public flipCoverProp(prop: SimPropState, actor: SimPlayerState = this.player): boolean { return flipCoverPropImpl.call(this, prop, actor); }
  public kickProp(prop: SimPropState, actor: SimPlayerState = this.player, customAngle?: number): boolean { return kickPropImpl.call(this, prop, actor, customAngle); }
  public updateSlidingProps(dtSec: number): void { return updateSlidingPropsImpl.call(this, dtSec); }
  public releaseProjectileToPool(proj: SimProjectileState): void { proj.ttlSec = 0; proj.hitEntityIds.length = 0; if (proj.grazedPlayerIds) proj.grazedPlayerIds.length = 0; this.projectilePool.push(proj); }
  public recordDestroyedProjectiles(ids: number[]): void {
    if (ids.length === 0 || this.stressTestActive) return;
    this.events.push({ kind: 'projectiles_destroyed', ids: [...ids] });
  }
  public updateProps(dtSec: number): void  { return updatePropsImpl.call(this, dtSec); }
  public damageProp(prop: SimPropState, amount: number, element: ElementType = 'none'): void  { return damagePropImpl.call(this, prop, amount, element); }
  public detonateExplosiveBarrel(barrel: SimPropState): void  { return detonateExplosiveBarrelImpl.call(this, barrel); }
  public releaseVanguardShieldShockwave(p: SimPlayerState = this.player): void  { return releaseVanguardShieldShockwaveImpl.call(this, p); }
  public tryFireActiveWeapon(p: SimPlayerState = this.player): void  { return tryFireActiveWeaponImpl.call(this, p); }
  public spawnDeterministicVolley(ev: BulletVolleySpawnEvent, emitEvents = true): void  { return spawnDeterministicVolleyImpl.call(this, ev, emitEvents); }
  public findNearestAlivePlayer(x: number, y: number): SimPlayerState  { return findNearestAlivePlayerImpl.call(this, x, y); }
  public getCoopEnemyCooldownScale(): number  { return getCoopEnemyCooldownScaleImpl.call(this); }
  public updateEnemies(dtSec: number): void  { return updateEnemiesImpl.call(this, dtSec); }
  public getEnemyCooldownScale(isBoss: boolean): number  { return getEnemyCooldownScaleImpl.call(this, isBoss); }
  public updateEnemyStatusAndSurface(e: SimEnemyState, surf: SurfaceKind, dtSec: number): void  { return updateEnemyStatusAndSurfaceImpl.call(this, e, surf, dtSec); }
  public applyDotDamageToEnemy(enemy: SimEnemyState, amount: number, element: ElementType, emitEvent = true): void  { return applyDotDamageToEnemyImpl.call(this, enemy, amount, element, emitEvent); }
  public updateGoblinShooterAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateGoblinShooterAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public updateWildBoarAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateWildBoarAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public updateSporeBomberAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateSporeBomberAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public detonateSporeBomber(e: SimEnemyState): void  { return detonateSporeBomberImpl.call(this, e); }
  public updateSlimeAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateSlimeAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public updateGoblinShamanAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateGoblinShamanAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public updateThornTurretAI(e: SimEnemyState, _distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateThornTurretAIImpl.call(this, e, _distToPlayer, angleToPlayer, dtSec); }
  public checkBossPhaseTransitions(e: SimEnemyState): void  { return checkBossPhaseTransitionsImpl.call(this, e); }
  public updateBossSporeKingAI(e: SimEnemyState, targetPlayer: SimPlayerState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateBossSporeKingAIImpl.call(this, e, targetPlayer, distToPlayer, angleToPlayer, dtSec); }
  public executeBossSporeKingAttack(e: SimEnemyState, angleToPlayer: number): void  { return executeBossSporeKingAttackImpl.call(this, e, angleToPlayer); }
  public updateFrostBatAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateFrostBatAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public updateBabyYetiAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateBabyYetiAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public updateIceMageAI(e: SimEnemyState, targetPlayer: SimPlayerState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateIceMageAIImpl.call(this, e, targetPlayer, distToPlayer, angleToPlayer, dtSec); }
  public updateIceGolemAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateIceGolemAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public updateSnowSpiritAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateSnowSpiritAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public detonateSnowSpirit(e: SimEnemyState): void  { return detonateSnowSpiritImpl.call(this, e); }
  public updateKryssaCloneAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateKryssaCloneAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public spawnKryssaMirrorClones(boss: SimEnemyState): void  { return spawnKryssaMirrorClonesImpl.call(this, boss); }
  public encasePlayerInIcePrison(target: SimPlayerState): SimEnemyState | null  { return encasePlayerInIcePrisonImpl.call(this, target); }
  public updateBossKryssaAI(e: SimEnemyState, targetPlayer: SimPlayerState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateBossKryssaAIImpl.call(this, e, targetPlayer, distToPlayer, angleToPlayer, dtSec); }
  public executeBossKryssaAttack(e: SimEnemyState, targetPlayer: SimPlayerState, angleToPlayer: number): void  { return executeBossKryssaAttackImpl.call(this, e, targetPlayer, angleToPlayer); }
  public updateFireImpAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateFireImpAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public updateDwarfCannonAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateDwarfCannonAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public updateCoalGolemAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateCoalGolemAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public updateWelderDroneAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateWelderDroneAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public updateIronShielderAI(e: SimEnemyState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateIronShielderAIImpl.call(this, e, distToPlayer, angleToPlayer, dtSec); }
  public spawnForgeTitanEnergyCores(boss: SimEnemyState): void  { return spawnForgeTitanEnergyCoresImpl.call(this, boss); }
  public updateBossForgeTitanAI(e: SimEnemyState, _targetPlayer: SimPlayerState, distToPlayer: number, angleToPlayer: number, dtSec: number): void  { return updateBossForgeTitanAIImpl.call(this, e, _targetPlayer, distToPlayer, angleToPlayer, dtSec); }
  public executeBossForgeTitanAttack(e: SimEnemyState, angleToPlayer: number): void  { return executeBossForgeTitanAttackImpl.call(this, e, angleToPlayer); }
  public spawnSeedGunLifeBlossom(ownerId: number, x: number, y: number): void  { return spawnSeedGunLifeBlossomImpl.call(this, ownerId, x, y); }
  public triggerLauncherProjectileExplosion(b: SimProjectileState, x: number, y: number): void  { return triggerLauncherProjectileExplosionImpl.call(this, b, x, y); }
  public updateProjectiles(dtSec: number): void  { return updateProjectilesImpl.call(this, dtSec); }
  public stepClientProjectilesCosmetic(dtSec: number): void  { return stepClientProjectilesCosmeticImpl.call(this, dtSec); }
  public applyElementAtWorldPoint(x: number, y: number, element: ElementType, radius = 24): void  { return applyElementAtWorldPointImpl.call(this, x, y, element, radius); }
  public applyDamageToEnemy(enemy: SimEnemyState, amount: number, isCrit: boolean, element: ElementType, hitAngleRad: number, knockback: number, isHeavyAttack = false, attackerPlayerId = this.player.id, isChainDamage = false, procCoefficient = 1.0, isKickedPropHit = false): void  { return applyDamageToEnemyImpl.call(this, enemy, amount, isCrit, element, hitAngleRad, knockback, isHeavyAttack, attackerPlayerId, isChainDamage, procCoefficient, isKickedPropHit); }
  public triggerElementalReaction(enemy: SimEnemyState, reaction: ElementalReactionId, damage: number, primerPlayerId: number, triggerPlayerId: number): void  { return triggerElementalReactionImpl.call(this, enemy, reaction, damage, primerPlayerId, triggerPlayerId); }
  public handleEnemyKilled(enemy: SimEnemyState, killerPlayerId = this.player.id): void  { return handleEnemyKilledImpl.call(this, enemy, killerPlayerId); }
  public applyElementStatusToEnemy(enemy: SimEnemyState, element: ElementType, hitDamage: number, attackerPlayerId = this.player.id): void  { return applyElementStatusToEnemyImpl.call(this, enemy, element, hitDamage, attackerPlayerId); }
  public applyDamageToPlayer(rawDamage: number, hitAngleRad: number, knockback: number, _sourceId = 'enemy', targetPlayer: SimPlayerState = this.player): boolean  { return applyDamageToPlayerImpl.call(this, rawDamage, hitAngleRad, knockback, _sourceId, targetPlayer); }
  public updatePickups(dtSec: number): void  { return updatePickupsImpl.call(this, dtSec); }
  public acquireProjectile(init: Omit<SimProjectileState, 'prevX' | 'prevY' | 'hitEntityIds'>): SimProjectileState  { return acquireProjectileImpl.call(this, init); }
  public acquirePickup(init: Omit<SimPickupState, 'prevX' | 'prevY'>): SimPickupState  { return acquirePickupImpl.call(this, init); }
  public computeMvpAwards(): MvpAwardEntry[]  { return computeMvpAwardsImpl.call(this); }
}
