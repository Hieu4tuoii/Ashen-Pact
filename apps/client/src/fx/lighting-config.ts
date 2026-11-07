import {
  type CharacterId,
  clamp,
  type RoomType,
  type SimChestState,
  type SimDoorState,
  type SimHubStatue,
  type SimNpcState,
  type SimPickupState,
  type SimPropState,
  type SimWorldItemState,
  WEAPON_RARITY_COLORS,
  type WeaponRarity,
  WORLD_VIEW_HEIGHT,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { ENV_PALETTE, hexToNum, PALETTE } from '../art/palette.js';

export interface BiomeLightingEntry {
  readonly ambientColor: number;
  readonly colorGradeTint: [number, number, number];
  readonly vignetteStrength: number;
}

export const BIOME_LIGHTING_CONFIG: {
  readonly 1: BiomeLightingEntry;
  readonly 2: BiomeLightingEntry;
  readonly 3: BiomeLightingEntry;
  readonly hub: BiomeLightingEntry;
} = {
  1: {
    ambientColor: 0xd9e3dd,
    colorGradeTint: [1.02, 0.99, 0.96],
    vignetteStrength: 0.0,
  },
  2: {
    ambientColor: 0xd2e0e8,
    colorGradeTint: [0.95, 1.0, 1.05],
    vignetteStrength: 0.0,
  },
  3: {
    ambientColor: 0xebdbd1,
    colorGradeTint: [1.05, 0.96, 0.92],
    vignetteStrength: 0.0,
  },
  hub: {
    ambientColor: 0xd6dce8,
    colorGradeTint: [0.98, 0.99, 1.03],
    vignetteStrength: 0.0,
  },
};

export const POSTFX_DEFAULTS = {
  contrast: 0.98,
  bloomStrength: 0.14,
  vignetteStrength: 0.0,
} as const;

export function resolveSceneLightingConfig(
  biome: 1 | 2 | 3,
  inHub = false,
  blizzardVeil = false,
): BiomeLightingEntry {
  if (inHub) {
    return BIOME_LIGHTING_CONFIG.hub;
  }
  if (blizzardVeil) {
    return {
      ambientColor: BIOME_LIGHTING_CONFIG[2].ambientColor,
      colorGradeTint: [0.95, 1.0, 1.05],
      vignetteStrength: 0.0,
    };
  }
  return BIOME_LIGHTING_CONFIG[biome];
}

export interface UniformViewportMetrics {
  zoom: number;
  viewW: number;
  viewH: number;
  padX: number;
  padY: number;
  centerMapX: boolean;
  centerMapY: boolean;
}

export function computeUniformViewportMetrics(
  width: number,
  height: number,
  mapWidth?: number,
  mapHeight?: number,
): UniformViewportMetrics {
  const safeW = width > 0 ? width : WORLD_VIEW_WIDTH;
  const safeH = height > 0 ? height : WORLD_VIEW_HEIGHT;
  const zoom = Math.max(0.1, Math.min(safeW / WORLD_VIEW_WIDTH, safeH / WORLD_VIEW_HEIGHT));
  const viewW = safeW / zoom;
  const viewH = safeH / zoom;
  const padX = Math.max(0, (viewW - WORLD_VIEW_WIDTH) * 0.5);
  const padY = Math.max(0, (viewH - WORLD_VIEW_HEIGHT) * 0.5);
  return {
    zoom,
    viewW,
    viewH,
    padX,
    padY,
    centerMapX: typeof mapWidth === 'number' ? viewW >= mapWidth : false,
    centerMapY: typeof mapHeight === 'number' ? viewH >= mapHeight : false,
  };
}

export const CHARACTER_THEME_COLORS: Record<CharacterId, string> = {
  vanguard: PALETTE.CRIMSON_BRIGHT,
  ranger: PALETTE.SOLAR_GOLD,
  elementalist: PALETTE.CYAN_FROST,
  druid: PALETTE.LIME_GLOW,
  engineer: PALETTE.FLAME_ORANGE,
} as const;

export type InteractableLightKind =
  | 'portal'
  | 'chest'
  | 'merchant'
  | 'shrine'
  | 'hub_statue'
  | 'world_item'
  | 'door'
  | 'pickup';

export interface InteractableLightEntry {
  kind: InteractableLightKind;
  x: number;
  y: number;
  radius: number;
  colorNum: number;
  alpha: number;
  secondaryColorNum?: number;
  secondaryRadius?: number;
  secondaryAlpha?: number;
}

export const INTERACTABLE_LIGHT_QUOTA = {
  high: 16,
  medium: 10,
  low: 6,
} as const;

export function getInteractableLightQuota(tier: 'high' | 'medium' | 'low'): number {
  return INTERACTABLE_LIGHT_QUOTA[tier];
}

export interface PopulateInteractableLightsParams {
  tier: 'high' | 'medium' | 'low';
  biome: 1 | 2 | 3;
  inHub?: boolean;
  hubReady?: boolean;
  roomType?: RoomType;
  elapsedSec: number;
  playerId?: number;
  simTick?: number;
  portalActive?: boolean;
  portalX?: number;
  portalY?: number;
  chests?: readonly SimChestState[];
  npcEntities?: readonly SimNpcState[];
  hubStatues?: readonly SimHubStatue[];
  worldItems?: readonly SimWorldItemState[];
  doors?: readonly SimDoorState[];
  pickups?: readonly SimPickupState[];
  secretWallBroken?: boolean;
}

const interactableLightEntryPool: InteractableLightEntry[] = [];

const CHEST_BASE_LIGHT_RADIUS: Record<WeaponRarity, number> = {
  common: 74,
  uncommon: 77,
  rare: 80,
  epic: 84,
  legendary: 86,
};

const WORLD_ITEM_BASE_LIGHT_RADIUS: Record<WeaponRarity, number> = {
  common: 52,
  uncommon: 56,
  rare: 60,
  epic: 65,
  legendary: 68,
};

export function populateInteractableLightsScratch(
  scratch: InteractableLightEntry[],
  params: PopulateInteractableLightsParams,
): number {
  const {
    tier,
    biome,
    inHub = false,
    hubReady = false,
    roomType,
    elapsedSec,
    playerId,
    simTick,
    portalActive = false,
    portalX = 0,
    portalY = 0,
    chests = [],
    npcEntities = [],
    hubStatues = [],
    worldItems = [],
    doors = [],
    pickups = [],
    secretWallBroken = false,
  } = params;

  let count = 0;
  const writeEntry = (
    kind: InteractableLightKind,
    x: number,
    y: number,
    radius: number,
    colorNum: number,
    alpha: number,
    secondaryColorNum?: number,
    secondaryRadius?: number,
    secondaryAlpha?: number,
  ): void => {
    let slot = scratch[count];
    if (!slot) {
      slot = interactableLightEntryPool.pop() ?? {
        kind,
        x: 0,
        y: 0,
        radius: 0,
        colorNum: 0xffffff,
        alpha: 0,
      };
      scratch[count] = slot;
    }
    slot.kind = kind;
    slot.x = x;
    slot.y = y;
    slot.radius = radius;
    slot.colorNum = colorNum;
    slot.alpha = clamp(alpha, 0, 0.35);
    slot.secondaryColorNum = secondaryColorNum;
    slot.secondaryRadius = secondaryRadius;
    slot.secondaryAlpha =
      secondaryAlpha !== undefined ? clamp(secondaryAlpha, 0, 0.35) : undefined;
    count += 1;
  };

  // 1. Floor / Hub Portal (Active purple/cyan, Hub waiting silver/cyan, Hub ready gold, or Dungeon inactive gray-purple)
  if (portalActive) {
    if (inHub && !hubReady) {
      const portalRadius = clamp(136 + 8 * Math.sin(elapsedSec * 2.2), 124, 152);
      writeEntry('portal', portalX, portalY, portalRadius, 0x64748b, 0.26, 0x38bdf8, 72, 0.22);
    } else if (inHub && hubReady) {
      const portalRadius = clamp(164 + 12 * Math.sin(elapsedSec * 2.8), 144, 180);
      writeEntry('portal', portalX, portalY, portalRadius, 0xf59e42, 0.34, 0xfef08a, 88, 0.3);
    } else {
      const portalRadius = clamp(160 + 14 * Math.sin(elapsedSec * 2.8), 140, 180);
      writeEntry('portal', portalX, portalY, portalRadius, 0xa855f7, 0.34, 0x22d3ee, 86, 0.3);
    }
  } else if (!inHub && roomType === 'portal') {
    const inactiveRadius = clamp(96 + 4 * Math.sin(elapsedSec * 1.4), 88, 108);
    writeEntry('portal', portalX, portalY, inactiveRadius, 0x4c3d63, 0.2, 0x6d5b87, 52, 0.16);
  }

  // 2. Unopened Chests (Rarity color, radius 70-90, slow 2s pulse; 0 when opened)
  const pulse2s = Math.sin(elapsedSec * Math.PI);
  for (let i = 0; i < chests.length; i++) {
    const ch = chests[i]!;
    if (ch.opened) continue;
    const baseR = CHEST_BASE_LIGHT_RADIUS[ch.rarity] ?? 76;
    const radius = clamp(baseR + 4 * pulse2s, 70, 90);
    const alpha = clamp(0.29 + 0.05 * pulse2s, 0.22, 0.35);
    const colorNum = hexToNum(WEAPON_RARITY_COLORS[ch.rarity]);
    writeEntry('chest', ch.x, ch.y, radius, colorNum, alpha);
  }

  // 3. NPCs (Merchant gold #F59E42, Shrine cyan #22D3EE when unused, 0 when interacted) & Hub Statues
  for (let i = 0; i < npcEntities.length; i++) {
    const npc = npcEntities[i]!;
    if (npc.kind === 'merchant') {
      writeEntry('merchant', npc.x, npc.y, 90, 0xf59e42, 0.33);
    } else if (npc.kind === 'shrine' && !npc.interacted) {
      const shrinePulse = Math.sin(elapsedSec * 2.4 + npc.id) * 4;
      const shrineRadius = clamp(86 + shrinePulse, 70, 100);
      writeEntry('shrine', npc.x, npc.y, shrineRadius, 0x22d3ee, 0.33);
    }
  }

  if (inHub) {
    for (let i = 0; i < hubStatues.length; i++) {
      const st = hubStatues[i]!;
      const col = hexToNum(CHARACTER_THEME_COLORS[st.characterId] ?? PALETTE.SOLAR_GOLD);
      writeEntry('hub_statue', st.x, st.y, 78, col, 0.3);
    }
  }

  // 4. World Items (Rarity color, radius 50-70)
  for (let i = 0; i < worldItems.length; i++) {
    const it = worldItems[i]!;
    if (it.pickedUp) continue;
    if (
      playerId !== undefined &&
      it.ownerPlayerId !== undefined &&
      it.ownerPlayerId !== 0 &&
      it.ownerPlayerId !== playerId
    ) {
      continue;
    }
    let rx = it.x;
    let ry = it.y;
    if (simTick !== undefined && it.droppedAtTick !== undefined) {
      const ageSec = Math.max(0, (simTick - it.droppedAtTick) / 60);
      if (ageSec < 0.25) {
        const u = clamp(ageSec / 0.25, 0, 1);
        rx = (it.fromX ?? it.x) + (it.x - (it.fromX ?? it.x)) * u;
        ry = (it.fromY ?? it.y) + (it.y - (it.fromY ?? it.y)) * u;
      }
    }
    const baseR = WORLD_ITEM_BASE_LIGHT_RADIUS[it.rarity] ?? 56;
    const radius = clamp(baseR + 2 * Math.sin(elapsedSec * 3.0 + it.id), 50, 70);
    const alpha = it.rarity === 'legendary' || it.rarity === 'epic' ? 0.34 : 0.29;
    const colorNum = hexToNum(WEAPON_RARITY_COLORS[it.rarity]);
    writeEntry('world_item', rx, ry, radius, colorNum, alpha);
  }

  // 5. Room Doors (Locked: dark crimson #DC2626 radius ~62; Open: biome accent radius ~74)
  const openDoorColorNum = hexToNum(ENV_PALETTE[inHub ? 0 : biome].accent);
  for (let i = 0; i < doors.length; i++) {
    const door = doors[i]!;
    if (door.isSecretPassage && door.locked && !secretWallBroken) {
      continue;
    }
    if (door.locked) {
      writeEntry('door', door.x, door.y, 62, 0xdc2626, 0.28);
    } else {
      writeEntry('door', door.x, door.y, 74, openDoorColorNum, 0.28);
    }
  }

  // 6. Floor Pickups (Gold #FACC15, Energy #38BDF8, Life Seed #4ADE80, radius 24-32, ONLY on High quality)
  if (tier === 'high') {
    for (let i = 0; i < pickups.length; i++) {
      const pk = pickups[i]!;
      if (pk.ttlSec <= 0) continue;
      if (
        playerId !== undefined &&
        pk.ownerPlayerId !== undefined &&
        pk.ownerPlayerId !== 0 &&
        pk.ownerPlayerId !== playerId
      ) {
        continue;
      }
      const colorNum =
        pk.kind === 'gold' ? 0xfacc15 : pk.kind === 'prey_emblem' ? 0x38bdf8 : 0x4ade80;
      const radius = pk.kind === 'gold' ? 26 : pk.kind === 'prey_emblem' ? 28 : 30;
      writeEntry('pickup', pk.x, pk.y, radius, colorNum, 0.25);
    }
  }

  while (scratch.length > count) {
    const excess = scratch.pop();
    if (excess) {
      interactableLightEntryPool.push(excess);
    }
  }

  return count;
}

export type ResolveInteractableGlowInput =
  | {
      kind: 'chest';
      rarity: WeaponRarity;
      opened: boolean;
      elapsedSec?: number;
      id?: number;
    }
  | {
      kind: 'world_item';
      rarity: WeaponRarity;
      pickedUp?: boolean;
      costGold?: number;
      elapsedSec?: number;
      id?: number;
    }
  | {
      kind: 'portal';
      active: boolean;
      inHub?: boolean;
      hubReady?: boolean;
      roomType?: RoomType;
      elapsedSec?: number;
    }
  | {
      kind: 'shrine' | 'daedalus_anvil' | 'upgrade_anvil' | 'secret_challenge_crystal';
      interacted: boolean;
      elapsedSec?: number;
      id?: number;
    }
  | {
      kind: 'merchant';
      elapsedSec?: number;
    }
  | {
      kind: 'door';
      locked: boolean;
      biome: 1 | 2 | 3;
      inHub?: boolean;
    }
  | {
      kind: 'hub_statue';
      characterId: CharacterId;
    };

export interface InteractableVisualGlowSpec {
  glowAlpha: number;
  glowRadiusX: number;
  glowRadiusY: number;
  colorNum: number;
  hasRarityBeam: boolean;
  beamColorNum: number;
  beamHeight: number;
  beamWidth: number;
  beamAlpha: number;
  hasSparkles: boolean;
  hasShopPedestal: boolean;
}

export function resolveInteractableVisualGlowSpec(
  input: ResolveInteractableGlowInput,
): InteractableVisualGlowSpec {
  switch (input.kind) {
    case 'chest': {
      if (input.opened) {
        return {
          glowAlpha: 0,
          glowRadiusX: 0,
          glowRadiusY: 0,
          colorNum: hexToNum(WEAPON_RARITY_COLORS[input.rarity]),
          hasRarityBeam: false,
          beamColorNum: 0,
          beamHeight: 0,
          beamWidth: 0,
          beamAlpha: 0,
          hasSparkles: false,
          hasShopPedestal: false,
        };
      }
      const pulse2s = Math.sin((input.elapsedSec ?? 1.0) * Math.PI);
      const baseR =
        input.rarity === 'legendary'
          ? 52
          : input.rarity === 'epic'
            ? 49
            : input.rarity === 'rare'
              ? 46
              : 43;
      const glowRadiusX = baseR + 2 * pulse2s;
      const glowRadiusY = Math.round(glowRadiusX * 0.72);
      const glowAlpha = clamp(0.32 + 0.05 * pulse2s, 0.26, 0.38);
      const hasSparkles =
        input.rarity === 'rare' || input.rarity === 'epic' || input.rarity === 'legendary';
      return {
        glowAlpha,
        glowRadiusX,
        glowRadiusY,
        colorNum: hexToNum(WEAPON_RARITY_COLORS[input.rarity]),
        hasRarityBeam: false,
        beamColorNum: 0,
        beamHeight: 0,
        beamWidth: 0,
        beamAlpha: 0,
        hasSparkles,
        hasShopPedestal: false,
      };
    }

    case 'world_item': {
      if (input.pickedUp) {
        return {
          glowAlpha: 0,
          glowRadiusX: 0,
          glowRadiusY: 0,
          colorNum: hexToNum(WEAPON_RARITY_COLORS[input.rarity]),
          hasRarityBeam: false,
          beamColorNum: 0,
          beamHeight: 0,
          beamWidth: 0,
          beamAlpha: 0,
          hasSparkles: false,
          hasShopPedestal: false,
        };
      }
      const pulse = Math.sin((input.elapsedSec ?? 1.0) * 3.2 + (input.id ?? 0));
      const baseAlpha =
        input.rarity === 'legendary'
          ? 0.35
          : input.rarity === 'epic'
            ? 0.33
            : input.rarity === 'rare'
              ? 0.3
              : 0.28;
      const glowAlpha = clamp(baseAlpha + 0.03 * pulse, 0.26, 0.38);
      const glowRadiusX =
        input.rarity === 'legendary' ? 38 : input.rarity === 'epic' ? 35 : 30;
      const glowRadiusY = Math.round(glowRadiusX * 0.62);
      const hasRarityBeam = input.rarity === 'epic' || input.rarity === 'legendary';
      const beamColorNum = input.rarity === 'legendary' ? 0xfacc15 : 0xc084fc;
      const beamHeight =
        input.rarity === 'legendary' ? 92 : input.rarity === 'epic' ? 76 : 0;
      const beamWidth =
        input.rarity === 'legendary' ? 24 : input.rarity === 'epic' ? 20 : 0;
      const beamAlpha = hasRarityBeam
        ? clamp((input.rarity === 'legendary' ? 0.35 : 0.33) + 0.03 * pulse, 0.28, 0.38)
        : 0;
      return {
        glowAlpha,
        glowRadiusX,
        glowRadiusY,
        colorNum: hexToNum(WEAPON_RARITY_COLORS[input.rarity]),
        hasRarityBeam,
        beamColorNum,
        beamHeight,
        beamWidth,
        beamAlpha,
        hasSparkles: false,
        hasShopPedestal: (input.costGold ?? 0) > 0,
      };
    }

    case 'portal': {
      if (!input.active) {
        if (!input.inHub && input.roomType === 'portal') {
          const pulse = Math.sin((input.elapsedSec ?? 1.0) * 1.4);
          const r = 52 + 2 * pulse;
          return {
            glowAlpha: clamp(0.16 + 0.02 * pulse, 0.13, 0.2),
            glowRadiusX: r,
            glowRadiusY: r,
            colorNum: 0x6d5b87,
            hasRarityBeam: false,
            beamColorNum: 0,
            beamHeight: 0,
            beamWidth: 0,
            beamAlpha: 0,
            hasSparkles: false,
            hasShopPedestal: false,
          };
        }
        return {
          glowAlpha: 0,
          glowRadiusX: 0,
          glowRadiusY: 0,
          colorNum: 0xa855f7,
          hasRarityBeam: false,
          beamColorNum: 0,
          beamHeight: 0,
          beamWidth: 0,
          beamAlpha: 0,
          hasSparkles: false,
          hasShopPedestal: false,
        };
      }
      if (input.inHub && !input.hubReady) {
        const pulse = Math.sin((input.elapsedSec ?? 1.0) * 2.2);
        const r = 64 + 3 * pulse;
        return {
          glowAlpha: clamp(0.24 + 0.02 * pulse, 0.21, 0.27),
          glowRadiusX: r,
          glowRadiusY: r,
          colorNum: 0x38bdf8,
          hasRarityBeam: false,
          beamColorNum: 0,
          beamHeight: 0,
          beamWidth: 0,
          beamAlpha: 0,
          hasSparkles: false,
          hasShopPedestal: false,
        };
      }
      const pulse = Math.sin((input.elapsedSec ?? 1.0) * 2.8);
      const r = 76 + 4 * pulse;
      return {
        glowAlpha: clamp(0.34 + 0.03 * pulse, 0.28, 0.38),
        glowRadiusX: r,
        glowRadiusY: r,
        colorNum: input.inHub && input.hubReady ? 0xf59e42 : 0xa855f7,
        hasRarityBeam: false,
        beamColorNum: 0,
        beamHeight: 0,
        beamWidth: 0,
        beamAlpha: 0,
        hasSparkles: false,
        hasShopPedestal: false,
      };
    }

    case 'shrine':
    case 'daedalus_anvil':
    case 'upgrade_anvil':
    case 'secret_challenge_crystal': {
      const colorNum =
        input.kind === 'daedalus_anvil'
          ? 0xfacc15
          : input.kind === 'secret_challenge_crystal'
            ? 0xa855f7
            : input.kind === 'upgrade_anvil'
              ? 0x38bdf8
              : 0x22d3ee;
      if (input.interacted) {
        return {
          glowAlpha: 0,
          glowRadiusX: 0,
          glowRadiusY: 0,
          colorNum,
          hasRarityBeam: false,
          beamColorNum: 0,
          beamHeight: 0,
          beamWidth: 0,
          beamAlpha: 0,
          hasSparkles: false,
          hasShopPedestal: false,
        };
      }
      const pulse = Math.sin((input.elapsedSec ?? 1.0) * 2.4 + (input.id ?? 0));
      return {
        glowAlpha: clamp(0.32 + 0.03 * pulse, 0.26, 0.38),
        glowRadiusX: 52,
        glowRadiusY: 44,
        colorNum,
        hasRarityBeam: false,
        beamColorNum: 0,
        beamHeight: 0,
        beamWidth: 0,
        beamAlpha: 0,
        hasSparkles: false,
        hasShopPedestal: false,
      };
    }

    case 'merchant': {
      return {
        glowAlpha: 0.3,
        glowRadiusX: 54,
        glowRadiusY: 42,
        colorNum: 0xf59e42,
        hasRarityBeam: false,
        beamColorNum: 0,
        beamHeight: 0,
        beamWidth: 0,
        beamAlpha: 0,
        hasSparkles: false,
        hasShopPedestal: false,
      };
    }

    case 'door': {
      const r = input.locked ? 38 : 48;
      return {
        glowAlpha: input.locked ? 0.27 : 0.3,
        glowRadiusX: r,
        glowRadiusY: r,
        colorNum: input.locked
          ? 0xdc2626
          : hexToNum(ENV_PALETTE[input.inHub ? 0 : input.biome].accent),
        hasRarityBeam: false,
        beamColorNum: 0,
        beamHeight: 0,
        beamWidth: 0,
        beamAlpha: 0,
        hasSparkles: false,
        hasShopPedestal: false,
      };
    }

    case 'hub_statue': {
      return {
        glowAlpha: 0.28,
        glowRadiusX: 46,
        glowRadiusY: 36,
        colorNum: hexToNum(
          CHARACTER_THEME_COLORS[input.characterId] ?? PALETTE.SOLAR_GOLD,
        ),
        hasRarityBeam: false,
        beamColorNum: 0,
        beamHeight: 0,
        beamWidth: 0,
        beamAlpha: 0,
        hasSparkles: false,
        hasShopPedestal: false,
      };
    }
  }
}

export interface InteractHighlightTarget {
  kind:
    | 'hub_statue'
    | 'ancient_mechanism'
    | 'chest'
    | 'world_item'
    | 'shrine'
    | 'daedalus_anvil'
    | 'upgrade_anvil'
    | 'secret_challenge_crystal'
    | 'portal'
    | 'door'
    | 'merchant';
  id: number | string;
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  colorNum: number;
}

export interface ResolveCurrentInteractHighlightParams {
  playerX: number;
  playerY: number;
  playerId?: number;
  weaponPickupLockTimer?: number;
  hasEngineerInParty?: boolean;
  inHub?: boolean;
  hubReady?: boolean;
  biome?: 1 | 2 | 3;
  hubStatues?: readonly SimHubStatue[];
  props?: readonly SimPropState[];
  chests?: readonly SimChestState[];
  worldItems?: readonly SimWorldItemState[];
  npcEntities?: readonly SimNpcState[];
  portalActive?: boolean;
  portalX?: number;
  portalY?: number;
  doors?: readonly SimDoorState[];
}

export function resolveCurrentInteractHighlightTarget(
  params: ResolveCurrentInteractHighlightParams,
): InteractHighlightTarget | null {
  const {
    playerX,
    playerY,
    playerId,
    weaponPickupLockTimer = 0,
    hasEngineerInParty = false,
    inHub = false,
    hubReady = false,
    biome = 1,
    hubStatues = [],
    props = [],
    chests = [],
    worldItems = [],
    npcEntities = [],
    portalActive = false,
    portalX = 0,
    portalY = 0,
    doors = [],
  } = params;

  const interactRange = 64;

  // 0. Hub Character Statues (<= 72u)
  if (inHub) {
    let bestStatue: SimHubStatue | null = null;
    let bestDist = interactRange + 8;
    for (let i = 0; i < hubStatues.length; i++) {
      const statue = hubStatues[i]!;
      const d = Math.hypot(playerX - statue.x, playerY - statue.y);
      if (d <= bestDist) {
        bestDist = d;
        bestStatue = statue;
      }
    }
    if (bestStatue) {
      return {
        kind: 'hub_statue',
        id: bestStatue.characterId,
        x: bestStatue.x,
        y: bestStatue.y,
        radiusX: 22,
        radiusY: 26,
        colorNum: hexToNum(
          CHARACTER_THEME_COLORS[bestStatue.characterId] ?? PALETTE.SOLAR_GOLD,
        ),
      };
    }
  }

  // 0.5 Ancient Mechanism (Engineer Passive, <= 74u)
  if (hasEngineerInParty) {
    for (let i = 0; i < props.length; i++) {
      const prop = props[i]!;
      if (
        prop.kind === 'ancient_mechanism' &&
        !prop.repaired &&
        Math.hypot(playerX - prop.x, playerY - prop.y) <= interactRange + 10
      ) {
        return {
          kind: 'ancient_mechanism',
          id: prop.id,
          x: prop.x,
          y: prop.y,
          radiusX: 22,
          radiusY: 22,
          colorNum: hexToNum(PALETTE.SOLAR_GOLD),
        };
      }
    }
  }

  // 1. Unopened Chests (<= 64u)
  for (let i = 0; i < chests.length; i++) {
    const ch = chests[i]!;
    if (!ch.opened && Math.hypot(playerX - ch.x, playerY - ch.y) <= interactRange) {
      return {
        kind: 'chest',
        id: ch.id,
        x: ch.x,
        y: ch.y,
        radiusX: 24,
        radiusY: 20,
        colorNum: hexToNum(WEAPON_RARITY_COLORS[ch.rarity]),
      };
    }
  }

  // 2. Closest World Item (<= 64u)
  let bestItem: SimWorldItemState | null = null;
  let bestItemDist = interactRange;
  for (let i = 0; i < worldItems.length; i++) {
    const it = worldItems[i]!;
    if (it.pickedUp) continue;
    if (it.kind === 'weapon' && weaponPickupLockTimer > 0) continue;
    if (
      playerId !== undefined &&
      it.ownerPlayerId !== undefined &&
      it.ownerPlayerId !== 0 &&
      it.ownerPlayerId !== playerId
    ) {
      continue;
    }
    const d = Math.hypot(playerX - it.x, playerY - it.y);
    if (d <= bestItemDist) {
      bestItemDist = d;
      bestItem = it;
    }
  }
  if (bestItem) {
    return {
      kind: 'world_item',
      id: bestItem.id,
      x: bestItem.x,
      y: bestItem.y,
      radiusX: 20,
      radiusY: 16,
      colorNum: hexToNum(WEAPON_RARITY_COLORS[bestItem.rarity]),
    };
  }

  // 3. Unused Ancient Shrine / Forge Anvils (<= 72u)
  for (let i = 0; i < npcEntities.length; i++) {
    const npc = npcEntities[i]!;
    const usedByPlayer =
      playerId !== undefined && Array.isArray(npc.usedByPlayerIds)
        ? npc.usedByPlayerIds.includes(playerId)
        : false;
    if (
      (npc.kind === 'shrine' ||
        npc.kind === 'daedalus_anvil' ||
        npc.kind === 'upgrade_anvil' ||
        npc.kind === 'secret_challenge_crystal') &&
      !npc.interacted &&
      !usedByPlayer &&
      Math.hypot(playerX - npc.x, playerY - npc.y) <= interactRange + 8
    ) {
      return {
        kind: npc.kind,
        id: npc.id,
        x: npc.x,
        y: npc.y,
        radiusX: 24,
        radiusY: 28,
        colorNum:
          npc.kind === 'daedalus_anvil'
            ? 0xfacc15
            : npc.kind === 'secret_challenge_crystal'
              ? 0xa855f7
              : npc.kind === 'upgrade_anvil'
                ? 0x38bdf8
                : 0x22d3ee,
      };
    }
  }

  // 4. Active Portal (<= 72u)
  if (portalActive && Math.hypot(playerX - portalX, playerY - portalY) <= interactRange + 8) {
    return {
      kind: 'portal',
      id: 'portal',
      x: portalX,
      y: portalY,
      radiusX: 28,
      radiusY: 28,
      colorNum: inHub && hubReady ? 0xf59e42 : 0xa855f7,
    };
  }

  // 5. Unlocked Doors (<= 72u)
  for (let i = 0; i < doors.length; i++) {
    const door = doors[i]!;
    if (!door.locked && Math.hypot(playerX - door.x, playerY - door.y) <= interactRange + 8) {
      return {
        kind: 'door',
        id: door.dir,
        x: door.x,
        y: door.y,
        radiusX: 26,
        radiusY: 26,
        colorNum: hexToNum(ENV_PALETTE[inHub ? 0 : biome].accent),
      };
    }
  }

  // 6. Merchant (<= 72u)
  for (let i = 0; i < npcEntities.length; i++) {
    const npc = npcEntities[i]!;
    if (
      npc.kind === 'merchant' &&
      Math.hypot(playerX - npc.x, playerY - npc.y) <= interactRange + 8
    ) {
      return {
        kind: 'merchant',
        id: npc.id,
        x: npc.x,
        y: npc.y,
        radiusX: 22,
        radiusY: 26,
        colorNum: 0xf59e42,
      };
    }
  }

  return null;
}
