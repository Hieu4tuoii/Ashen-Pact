import type { BuffId, CharacterId, ElementalReactionId, ElementType, RoomType, WeaponRarity } from '../data/types.js';
import type { PlayerInputPacket, QuickEmoteId } from '../protocol/messages.js';
import type { ArenaMapConfig, SurfaceKind } from './arena-map.js';
import type { PropKind, SummonKind, PingMarkerKind, BulletVolleySpawnEvent } from './world-sim-types.js';

export type SimEvent =
  | BulletVolleySpawnEvent
  | {
      kind: 'projectiles_destroyed';
      ids: number[];
    }
  | {
      kind: 'projectile_spawned';
      projectileId: number;
      weaponId: string;
      team: 'player' | 'enemy';
      x: number;
      y: number;
      angle: number;
    }
  | {
      kind: 'melee_swing';
      playerId: number;
      weaponId: string;
      x: number;
      y: number;
      angle: number;
      arcRad: number;
      range: number;
      bulletsDestroyed: number;
    }
  | {
      kind: 'damage_dealt';
      targetId: number;
      targetKind: 'player' | 'enemy';
      x: number;
      y: number;
      amount: number;
      isCrit: boolean;
      hitArmor: boolean;
      element: ElementType;
      knockbackX: number;
      knockbackY: number;
    }
  | {
      kind: 'projectile_impact';
      x: number;
      y: number;
      angle: number;
      team: 'player' | 'enemy';
      hitWall: boolean;
      destroyedByMelee: boolean;
      blockedByShield: boolean;
      isCrit: boolean;
      element?: ElementType;
    }
  | {
      kind: 'entity_killed';
      entityId: number;
      defId: string;
      x: number;
      y: number;
    }
  | {
      kind: 'dash_started';
      playerId: number;
      x: number;
      y: number;
      dirX: number;
      dirY: number;
    }
  | {
      kind: 'enemy_telegraph';
      enemyId: number;
      defId: string;
      x: number;
      y: number;
      angle: number;
      durationSec: number;
      radius: number;
    }
  | {
      kind: 'explosion';
      x: number;
      y: number;
      radius: number;
      damage: number;
      sourceDefId: string;
    }
  | {
      kind: 'skill_cast';
      playerId: number;
      skillId: string;
      x: number;
      y: number;
      angle: number;
    }
  | {
      kind: 'shield_shockwave';
      playerId: number;
      x: number;
      y: number;
      angle: number;
      storedBullets: number;
      damage: number;
    }
  | {
      kind: 'pickup_collected';
      pickupKind: 'gold' | 'life_seed' | 'prey_emblem';
      amount: number;
      x: number;
      y: number;
    }
  | {
      kind: 'weapon_swapped';
      playerId: number;
      weaponId: string;
      slot: number;
    }
  | {
      kind: 'weapon_dropped';
      playerId: number;
      itemId: number;
      weaponId: string;
      rarity: WeaponRarity;
      fromX: number;
      fromY: number;
      x: number;
      y: number;
    }
  | {
      kind: 'hit_stop';
      durationMs: number;
      trauma: number;
    }
  | {
      kind: 'prop_destroyed';
      propId: number;
      propKind: PropKind;
      x: number;
      y: number;
    }
  | {
      kind: 'cracked_wall_broken';
      tx: number;
      ty: number;
      x: number;
      y: number;
    }
  | {
      kind: 'chain_lightning';
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }
  | {
      kind: 'status_applied';
      targetId: number;
      status: 'burn' | 'chill' | 'frozen' | 'shock' | 'poison' | 'shatter' | 'marked' | 'rooted';
      x: number;
      y: number;
    }
  | {
      kind: 'elemental_reaction';
      reaction: ElementalReactionId;
      x: number;
      y: number;
      targetId: number;
      damage: number;
      isTeamCombo: boolean;
      primerPlayerId: number;
      triggerPlayerId: number;
      convergenceDurationSec?: number;
    }
  | {
      kind: 'summon_spawned';
      summonId: number;
      summonKind: SummonKind;
      ownerPlayerId: number;
      x: number;
      y: number;
    }
  | {
      kind: 'emp_blast';
      x: number;
      y: number;
      radius: number;
      bulletsCleared: number;
    }
  | {
      kind: 'surface_triggered';
      surface: SurfaceKind;
      x: number;
      y: number;
    }
  | {
      kind: 'grass_rustle';
      x: number;
      y: number;
    }
  | {
      kind: 'shaman_heal';
      shamanId: number;
      x: number;
      y: number;
      radius: number;
      healedCount: number;
    }
  | {
      kind: 'boss_spawned';
      enemyId: number;
      nameVi: string;
    }
  | {
      kind: 'boss_phase_changed';
      enemyId: number;
      phase: 1 | 2 | 3;
      x: number;
      y: number;
    }
  | {
      kind: 'room_entered';
      roomId: number;
      roomType: RoomType;
      floorNumber: number;
    }
  | {
      kind: 'room_cleared';
      roomId: number;
      roomType: RoomType;
    }
  | {
      kind: 'chest_opened';
      chestId: number;
      rarity: WeaponRarity;
      weaponId: string;
      x: number;
      y: number;
    }
  | {
      kind: 'item_purchased';
      itemId: number;
      nameVi: string;
      costGold: number;
      x: number;
      y: number;
    }
  | {
      kind: 'shrine_blessing';
      x: number;
      y: number;
      rewardTextVi: string;
    }
  | {
      kind: 'portal_entered';
      floorNumber: number;
    }
  | {
      kind: 'buff_selected';
      buffId: BuffId;
      nameVi: string;
    }
  | {
      kind: 'player_downed';
      playerId: number;
      x: number;
      y: number;
    }
  | {
      kind: 'player_revived';
      playerId: number;
      reviverId: number;
      x: number;
      y: number;
    }
  | {
      kind: 'player_ghost';
      playerId: number;
      x: number;
      y: number;
    }
  | {
      kind: 'players_teleported_to_room';
      roomId: number;
      x: number;
      y: number;
    }
  | {
      kind: 'ping_issued';
      pingId: number;
      playerId: number;
      playerSlot: 1 | 2 | 3 | 4;
      pingKind: PingMarkerKind;
      labelVi: string;
      x: number;
      y: number;
    }
  | {
      kind: 'emote_triggered';
      playerId: number;
      emoteId: QuickEmoteId;
      labelVi: string;
      x: number;
      y: number;
    }
  | {
      kind: 'character_selected';
      playerId: number;
      characterId: CharacterId;
      nameVi: string;
    }
  | {
      kind: 'coop_puzzle_solved';
      roomId: number;
      x: number;
      y: number;
    }
  | {
      kind: 'shockwave_spawned';
      enemyId: number;
      x: number;
      y: number;
      maxRadius: number;
    }
  | {
      kind: 'armor_broken';
      targetKind: 'player' | 'enemy';
      targetId: number;
      playerId?: number;
      x: number;
      y: number;
    }
  | {
      kind: 'wave_started';
      roomId: number;
      waveIndex: number;
      wavesTotal: number;
      isChallenge: boolean;
    }
  | {
      kind: 'boss_enraged';
      enemyId: number;
      enrageLevel: number;
      x: number;
      y: number;
    }
  | {
      kind: 'vengeful_telegraph';
      enemyId: number;
      x: number;
      y: number;
      delaySec: number;
    }
  | {
      kind: 'cover_flipped';
      propId: number;
      playerId: number;
      x: number;
      y: number;
      radius: number;
      bulletsCleared: number;
    }
  | {
      kind: 'prop_kicked';
      propId: number;
      playerId: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
    }
  | {
      kind: 'wall_slam';
      enemyId: number;
      x: number;
      y: number;
      damage: number;
      shattered: boolean;
    }
  | {
      kind: 'ring_out';
      enemyId: number;
      x: number;
      y: number;
      isElite: boolean;
      damage: number;
    }
  | {
      kind: 'perfect_reload';
      playerId: number;
      weaponId: string;
      x: number;
      y: number;
    }
  | {
      kind: 'tactical_vent';
      playerId: number;
      weaponId: string;
      x: number;
      y: number;
    }
  | {
      kind: 'crossbow_rip';
      playerId: number;
      targetIds: number[];
      totalArrows: number;
      x?: number;
      y?: number;
    }
  | {
      kind: 'thorn_bloom';
      playerId: number;
      targetIds: number[];
      totalThorns: number;
      x?: number;
      y?: number;
    }
  | {
      kind: 'focus_laser_beam';
      playerId: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      angle: number;
      width: number;
      damage: number;
      heat: number;
      refractedRays?: Array<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        angle: number;
      }>;
    }
  | {
      kind: 'focus_laser_railgun';
      playerId: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      angle: number;
      width: number;
      damage: number;
      alertTextVi: string;
    }
  | {
      kind: 'void_implosion';
      playerId: number;
      x: number;
      y: number;
      radius: number;
      damage: number;
      swallowedBullets: number;
      triggeredByRelease: boolean;
      alertTextVi?: string;
    }
  | {
      kind: 'melee_parry_deflect';
      playerId: number;
      weaponId: string;
      x: number;
      y: number;
      angle: number;
      deflectedCount: number;
      ids: number[];
    }
  | {
      kind: 'berserker_guillotine_slam';
      playerId: number;
      x: number;
      y: number;
      x2: number;
      y2: number;
      angle: number;
      length: number;
      width: number;
      damage: number;
      alertTextVi: string;
    }
  | {
      kind: 'solar_converge_burst';
      playerId: number;
      x: number;
      y: number;
      radius: number;
      damage: number;
      rayIndex?: number;
    }
  | {
      kind: 'solar_supernova';
      playerId: number;
      x: number;
      y: number;
      radius: number;
      damage: number;
      zoneRadius: number;
      zoneDurationSec: number;
      bulletsCleared: number;
      alertTextVi: string;
    }
  | {
      kind: 'magma_geyser_eruption';
      playerId: number;
      geysers: Array<{
        x: number;
        y: number;
        radius: number;
        damage: number;
      }>;
      damage: number;
      radius: number;
      alertTextVi: string;
    }
  | {
      kind: 'thunder_hammer_pillar';
      playerId: number;
      x: number;
      y: number;
      radius: number;
      damage: number;
      strikes: Array<{
        x: number;
        y: number;
        radius: number;
        damage: number;
      }>;
      deflectedCount: number;
      alertTextVi: string;
    };

export interface WorldSimOptions {
  seed?: string | number;
  mapConfig?: ArenaMapConfig;
  spawnInitialWave?: boolean;
  includeTrainingDummy?: boolean;
  includeProps?: boolean;
  autoRespawnWaves?: boolean;
  autoRevivePlayer?: boolean;
  startInHub?: boolean;
  coopMode?: boolean;
  playerCount?: 1 | 2 | 3 | 4;
  biome?: 1 | 2 | 3;
  campaignMaxFloors?: 2 | 6;
}

export interface CoPlayerInputEntry {
  current: PlayerInputPacket;
  prevButtons: number;
  latchedButtons: number;
  latchedWeaponSlot: number | null;
}
