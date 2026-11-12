import {
  clamp,
  i18n,
  type InteractTargetKind,
  type InteractTargetResult,
  PLAYER_SLOT_COLORS,
  type SimDoorState,
  type SimPlayerState,
   type SupportedLocale,
  WEAPON_RARITY_COLORS,
  type WeaponRarity,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { ENV_PALETTE, hexToNum, PALETTE } from '../../art/palette.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { CHARACTER_THEME_COLORS } from '../../fx/lighting-config.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import type { GameScene } from '../GameScene.js';

/** Smooth fade duration (135ms, within Spec 3.3 120–150ms window) for the single [E] prompt pill. */
export const INTERACT_PROMPT_FADE_SEC = 0.135;

/** Maximum distance (~200u) at which Hub guidance signs are visible. */
export const HUB_GUIDE_MAX_DIST = 200;

/** Maximum distance (~120u) at which door room names are revealed. */
export const DOOR_NAME_MAX_DIST = 120;

/** Vertical offset above player center for co-op teammate nameplates so text never overlaps the head/helmet. */
export const PLAYER_NAMEPLATE_OFFSET_Y = -44;
export const PLAYER_NAMEPLATE_BELOW_OFFSET_Y = 26;

export interface InteractPromptSpec {
  key: string;
  kind: InteractTargetKind;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  highlightRadiusX: number;
  highlightRadiusY: number;
  keycapText: string;
  titleText: string;
  colorHex: string;
  colorNum: number;
  costGold: number;
  hasCoinIcon: boolean;
  priceText: string;
  suppressedByWeaponCard: boolean;
}

export interface InteractPromptFadeState {
  currentTargetKey: string | null;
  alpha: number;
  cachedSpec: InteractPromptSpec | null;
}

export interface InteractPromptPillVisuals {
  container: Phaser.GameObjects.Container;
  bgGraphics: Phaser.GameObjects.Graphics;
  keyText: Phaser.GameObjects.Text;
  titleText: Phaser.GameObjects.Text;
  priceText: Phaser.GameObjects.Text;
  lastHash: string;
  pillWidth: number;
  pillHeight: number;
}

export function createInteractPromptFadeState(): InteractPromptFadeState {
  return {
    currentTargetKey: null,
    alpha: 0,
    cachedSpec: null,
  };
}

const CHEST_RARITY_TITLE_VI: Record<WeaponRarity, string> = {
  common: 'Rương Thường',
  uncommon: 'Rương Tốt',
  rare: 'Rương Hiếm',
  epic: 'Rương Sử Thi',
  legendary: 'Rương Huyền Thoại',
};

const CHEST_RARITY_TITLE_EN: Record<WeaponRarity, string> = {
  common: 'Common Chest',
  uncommon: 'Uncommon Chest',
  rare: 'Rare Chest',
  epic: 'Epic Chest',
  legendary: 'Legendary Chest',
};

function stripLeadingKeyTag(text: string): string {
  return text.replace(/^\[E\]\s*/i, '').trim();
}

export interface ResolveInteractPromptOptions {
  weaponComparisonVisible?: boolean;
  locale?: SupportedLocale;
  keycapText?: string;
}

/**
 * Resolves the single-target interact prompt pill descriptor from the shared `findInteractTarget` result.
 */
export function resolveInteractPromptSpec(
  sim: WorldSim,
  target: InteractTargetResult | null,
  options?: ResolveInteractPromptOptions,
): InteractPromptSpec | null {
  if (!target) return null;

  const locale = options?.locale ?? i18n.getLocale();
  const isEn = locale === 'en';
  const keycapText = options?.keycapText ?? graphicsSettings.getActionKeyLabel('interact');

  switch (target.kind) {
    case 'revive': {
      const colorHex = '#FACC15';
      const titleText = isEn ? `Revive ${target.player.displayName}` : `Cứu ${target.player.displayName}`;
      return {
        key: target.key,
        kind: 'revive',
        x: target.x,
        y: target.y - 26,
        targetX: target.x,
        targetY: target.y,
        highlightRadiusX: 22,
        highlightRadiusY: 18,
        keycapText,
        titleText,
        colorHex,
        colorNum: hexToNum(colorHex),
        costGold: 0,
        hasCoinIcon: false,
        priceText: '',
        suppressedByWeaponCard: false,
      };
    }

    case 'flip_cover':
      return null;

    case 'chest': {
      const colorHex = WEAPON_RARITY_COLORS[target.chest.rarity];
      const titleText = isEn
        ? CHEST_RARITY_TITLE_EN[target.chest.rarity]
        : CHEST_RARITY_TITLE_VI[target.chest.rarity];
      return {
        key: target.key,
        kind: 'chest',
        x: target.x,
        y: target.y - 26,
        targetX: target.x,
        targetY: target.y,
        highlightRadiusX: 24,
        highlightRadiusY: 20,
        keycapText,
        titleText,
        colorHex,
        colorNum: hexToNum(colorHex),
        costGold: 0,
        hasCoinIcon: false,
        priceText: '',
        suppressedByWeaponCard: false,
      };
    }

    case 'world_item': {
      const it = target.item;
      const colorHex = WEAPON_RARITY_COLORS[it.rarity];
      const titleText =
        it.kind === 'weapon' && it.weaponId
          ? i18n.weaponName(it.weaponId, it.nameVi)
          : it.kind === 'health_potion'
            ? isEn
              ? `Health Potion (+${it.healAmount || 3} HP)`
              : it.nameVi
            : it.kind === 'armor_upgrade'
              ? isEn
                ? 'Iron Armor Plate (+2 Max Armor)'
                : it.nameVi
              : it.kind === 'blessing_scroll'
                ? isEn
                  ? 'Action Blessing Scroll'
                  : it.nameVi
                : it.kind === 'weapon_upgrade'
                  ? isEn
                    ? 'Weapon Upgrade Stone (+1 Lv)'
                    : it.nameVi
                  : it.nameVi;
      const costGold = Math.max(0, it.costGold ?? 0);
      const hasCoinIcon = costGold > 0;
      const goldUnit = isEn ? 'Gold' : i18n.t('ui.hud.gold');
      const priceText = hasCoinIcon ? `${costGold} ${goldUnit}` : '';
      const suppressedByWeaponCard =
        Boolean(options?.weaponComparisonVisible) &&
        it.kind === 'weapon' &&
        Boolean(it.weaponId);

      return {
        key: target.key,
        kind: 'world_item',
        x: target.x,
        y: target.y - 26,
        targetX: target.x,
        targetY: target.y,
        highlightRadiusX: 20,
        highlightRadiusY: 16,
        keycapText,
        titleText,
        colorHex,
        colorNum: hexToNum(colorHex),
        costGold,
        hasCoinIcon,
        priceText,
        suppressedByWeaponCard,
      };
    }

    case 'hub_statue': {
      const st = target.statue;
      const isSelected = sim.player.characterId === st.characterId;
      const colorHex = isSelected
        ? PALETTE.LIME_GLOW
        : (CHARACTER_THEME_COLORS[st.characterId] ?? PALETTE.SOLAR_GOLD);
      const charTxt = i18n.getCharacterText(st.characterId);
      const selTag = isEn ? 'Selected' : 'Đang Chọn';
      const titleText = isSelected ? `★ ${charTxt.name} (${selTag})` : charTxt.name;
      return {
        key: target.key,
        kind: 'hub_statue',
        x: target.x,
        y: target.y - 34,
        targetX: target.x,
        targetY: target.y,
        highlightRadiusX: 22,
        highlightRadiusY: 26,
        keycapText,
        titleText,
        colorHex,
        colorNum: hexToNum(colorHex),
        costGold: 0,
        hasCoinIcon: false,
        priceText: '',
        suppressedByWeaponCard: false,
      };
    }

    case 'hub_station': {
      const isCoopBoard = target.station.id === 'coop_board';
      const colorHex = isCoopBoard ? PALETTE.AZURE_CORE : PALETTE.SOLAR_GOLD;
      const promptKey = isCoopBoard
        ? 'ui.sanctuary.coopStationPrompt'
        : 'ui.sanctuary.codexStationPrompt';
      const prevLoc = i18n.getLocale();
      if (prevLoc !== locale) i18n.setLocale(locale);
      let rawPrompt = '';
      try {
        rawPrompt = i18n.t(promptKey);
      } finally {
        if (prevLoc !== locale) i18n.setLocale(prevLoc);
      }
      const coopPanelLabel = graphicsSettings.getActionKeyLabel('coopPanel');
      const strippedPrompt = stripLeadingKeyTag(rawPrompt);
      const titleText = isCoopBoard
        ? strippedPrompt.replace(/\[I\]/g, `[${coopPanelLabel}]`)
        : strippedPrompt;
      return {
        key: target.key,
        kind: 'hub_station',
        x: target.x,
        y: target.y - 34,
        targetX: target.x,
        targetY: target.y,
        highlightRadiusX: isCoopBoard ? 36 : 28,
        highlightRadiusY: isCoopBoard ? 24 : 22,
        keycapText,
        titleText,
        colorHex,
        colorNum: hexToNum(colorHex),
        costGold: 0,
        hasCoinIcon: false,
        priceText: '',
        suppressedByWeaponCard: false,
      };
    }

    case 'ancient_mechanism': {
      const colorHex = PALETTE.SOLAR_GOLD;
      const titleText = isEn ? 'Repair Ancient Mechanism' : 'Sửa Máy Cổ Đại';
      return {
        key: target.key,
        kind: 'ancient_mechanism',
        x: target.x,
        y: target.y - 28,
        targetX: target.x,
        targetY: target.y,
        highlightRadiusX: 22,
        highlightRadiusY: 22,
        keycapText,
        titleText,
        colorHex,
        colorNum: hexToNum(colorHex),
        costGold: 0,
        hasCoinIcon: false,
        priceText: '',
        suppressedByWeaponCard: false,
      };
    }

    case 'daedalus_anvil': {
      const colorHex = PALETTE.SOLAR_GOLD;
      const titleText = isEn ? 'Daedalus Anvil (Mutator)' : 'Đe Rèn Daedalus (Độ Cơ Học)';
      return {
        key: target.key,
        kind: 'daedalus_anvil',
        x: target.x,
        y: target.y - 32,
        targetX: target.x,
        targetY: target.y,
        highlightRadiusX: 24,
        highlightRadiusY: 24,
        keycapText,
        titleText,
        colorHex,
        colorNum: hexToNum(colorHex),
        costGold: 0,
        hasCoinIcon: false,
        priceText: '',
        suppressedByWeaponCard: false,
      };
    }

    case 'upgrade_anvil': {
      const colorHex = PALETTE.SOLAR_GOLD;
      const titleText = isEn ? 'Upgrade Anvil (+1 Lv)' : 'Đe Nâng Cấp (+1 Cấp)';
      const costGold = target.npc.costGold ?? 0;
      const priceText = costGold > 0 ? (isEn ? `${costGold} Gold` : `${costGold} Xu`) : '';
      return {
        key: target.key,
        kind: 'upgrade_anvil',
        x: target.x,
        y: target.y - 32,
        targetX: target.x,
        targetY: target.y,
        highlightRadiusX: 24,
        highlightRadiusY: 24,
        keycapText,
        titleText,
        colorHex,
        colorNum: hexToNum(colorHex),
        costGold,
        hasCoinIcon: costGold > 0,
        priceText,
        suppressedByWeaponCard: false,
      };
    }

    case 'secret_challenge_crystal': {
      const colorHex = PALETTE.ELECTRIC_VIOLET;
      const prevLoc = i18n.getLocale();
      if (prevLoc !== locale) i18n.setLocale(locale);
      let rawPrompt = '';
      try {
        rawPrompt = i18n.t('ui.interact.secretChallengeCrystal');
      } finally {
        if (prevLoc !== locale) i18n.setLocale(prevLoc);
      }
      const titleText = rawPrompt.replace(/^\[E\]\s*/i, '');
      return {
        key: target.key,
        kind: 'secret_challenge_crystal',
        x: target.x,
        y: target.y - 34,
        targetX: target.x,
        targetY: target.y,
        highlightRadiusX: 24,
        highlightRadiusY: 28,
        keycapText,
        titleText,
        colorHex,
        colorNum: hexToNum(colorHex),
        costGold: 0,
        hasCoinIcon: false,
        priceText: '',
        suppressedByWeaponCard: false,
      };
    }

    case 'shrine': {
      const isLegacyAncientShrine =
        target.npc.nameVi === 'Điện Thờ Cổ Đại' &&
        target.npc.costGold === undefined &&
        (target.npc.costHp ?? 0) > 0;
      if (isLegacyAncientShrine) {
        const colorHex = PALETTE.CYAN_FROST;
        const titleText = isEn ? 'Ancient Shrine' : 'Điện Thờ Cổ Đại';
        const costGold = target.npc.costGold ?? 25;
        const costHp = target.npc.costHp ?? 2;
        const priceText = isEn
          ? `${costGold} Gold / ${costHp} HP`
          : `${costGold} Xu / ${costHp} Máu`;
        return {
          key: target.key,
          kind: 'shrine',
          x: target.x,
          y: target.y - 35,
          targetX: target.x,
          targetY: target.y,
          highlightRadiusX: 24,
          highlightRadiusY: 28,
          keycapText,
          titleText,
          colorHex,
          colorNum: hexToNum(colorHex),
          costGold,
          hasCoinIcon: costGold > 0,
          priceText,
          suppressedByWeaponCard: false,
        };
      }

      const colorHex = PALETTE.CRIMSON_BRIGHT;
      const titleText = isEn ? 'Ashen Pact Altar' : 'Tế Đàn Khế Ước Tro Tàn';
      return {
        key: target.key,
        kind: 'shrine',
        x: target.x,
        y: target.y - 35,
        targetX: target.x,
        targetY: target.y,
        highlightRadiusX: 24,
        highlightRadiusY: 28,
        keycapText,
        titleText,
        colorHex,
        colorNum: hexToNum(colorHex),
        costGold: 0,
        hasCoinIcon: false,
        priceText: '',
        suppressedByWeaponCard: false,
      };
    }

    case 'portal': {
      const allReady = sim.inHub ? sim.areAllPlayersReady() : true;
      const colorHex = sim.inHub && allReady ? PALETTE.SOLAR_GOLD : PALETTE.ELECTRIC_VIOLET;
      const rawPortalText = sim.inHub
        ? allReady
          ? i18n.t('ui.hud.portalHubReady')
          : i18n.t('ui.hud.portalHubWait')
        : i18n.t('ui.hud.portalNextFloor');
      const titleText = stripLeadingKeyTag(rawPortalText);
      return {
        key: target.key,
        kind: 'portal',
        x: target.x,
        y: target.y - 38,
        targetX: target.x,
        targetY: target.y,
        highlightRadiusX: 28,
        highlightRadiusY: 28,
        keycapText,
        titleText,
        colorHex,
        colorNum: hexToNum(colorHex),
        costGold: 0,
        hasCoinIcon: false,
        priceText: '',
        suppressedByWeaponCard: false,
      };
    }

    case 'door': {
      const door = target.door;
      const targetRoom = sim.dungeon.rooms.find((r) => r.id === door.targetRoomId);
      const roomLabel = targetRoom
        ? i18n.roomTypeName(targetRoom.type)
        : isEn
          ? 'Room'
          : 'Phòng';
      const colorHex = PALETTE.LIME_GLOW;
      const accentNum = hexToNum(ENV_PALETTE[sim.inHub ? 0 : sim.currentBiome].accent);
      const pillX = door.dir === 'W' ? door.x + 42 : door.dir === 'E' ? door.x - 42 : door.x;
      const pillY = door.dir === 'N' ? door.y + 30 : door.dir === 'S' ? door.y - 24 : door.y - 42;
      return {
        key: target.key,
        kind: 'door',
        x: pillX,
        y: pillY,
        targetX: door.x,
        targetY: door.y,
        highlightRadiusX: 26,
        highlightRadiusY: 26,
        keycapText,
        titleText: `→ ${roomLabel}`,
        colorHex,
        colorNum: accentNum,
        costGold: 0,
        hasCoinIcon: false,
        priceText: '',
        suppressedByWeaponCard: false,
      };
    }
  }
}

/**
 * Advances the `[E]` prompt fade state (`0 -> 1` and `1 -> 0` over `135ms`),
 * retaining `currentTargetKey` for `8u` hysteresis and `cachedSpec` during fade-out.
 */
export function stepInteractPromptFadeState(
  state: InteractPromptFadeState,
  nextSpec: InteractPromptSpec | null,
  dtSec: number,
  fadeDurationSec = INTERACT_PROMPT_FADE_SEC,
): InteractPromptFadeState {
  state.currentTargetKey = nextSpec ? nextSpec.key : null;
  const step = fadeDurationSec > 0 ? Math.max(0, dtSec) / fadeDurationSec : 1;

  if (nextSpec && !nextSpec.suppressedByWeaponCard) {
    state.cachedSpec = nextSpec;
    state.alpha = clamp(state.alpha + step, 0, 1);
  } else if (nextSpec?.suppressedByWeaponCard) {
    state.alpha = 0;
    state.cachedSpec = null;
  } else {
    state.alpha = clamp(state.alpha - step, 0, 1);
    if (state.alpha <= 0) {
      state.alpha = 0;
      state.cachedSpec = null;
    }
  }

  return state;
}

export type DoorLabelMode = 'hidden' | 'lock_icon_only' | 'locked_name' | 'open_name';

export interface DoorLabelState {
  visible: boolean;
  mode: DoorLabelMode;
  text: string;
  colorHex: string;
  alpha: number;
}

/**
 * Resolves door label visibility & text according to Spec 3.3:
 * - Locked door > 120u: compact `'🔒'` icon only (`lock_icon_only`).
 * - Locked door <= 120u: `'🔒 ' + roomLabel` (`locked_name`).
 * - Open door > 120u or active `[E]` pill target: hidden (`hidden`).
 * - Open door <= 120u (when not active `[E]` pill target): `'→ ' + roomLabel` (`open_name`).
 */
export function resolveDoorLabelState(
  door: Pick<SimDoorState, 'locked' | 'x' | 'y'>,
  playerX: number,
  playerY: number,
  roomLabel: string,
  isActiveInteractDoor = false,
): DoorLabelState {
  const dist = Math.hypot(playerX - door.x, playerY - door.y);
  if (door.locked) {
    if (dist <= DOOR_NAME_MAX_DIST) {
      return {
        visible: true,
        mode: 'locked_name',
        text: `🔒 ${roomLabel}`,
        colorHex: PALETTE.CRIMSON_BRIGHT,
        alpha: 0.95,
      };
    }
    return {
      visible: true,
      mode: 'lock_icon_only',
      text: '🔒',
      colorHex: PALETTE.CRIMSON_BRIGHT,
      alpha: 0.85,
    };
  }

  if (isActiveInteractDoor || dist > DOOR_NAME_MAX_DIST) {
    return {
      visible: false,
      mode: 'hidden',
      text: '',
      colorHex: PALETTE.LIME_GLOW,
      alpha: 0,
    };
  }

  return {
    visible: true,
    mode: 'open_name',
    text: `→ ${roomLabel}`,
    colorHex: PALETTE.LIME_GLOW,
    alpha: 0.92,
  };
}

export interface HubGuideVisibilityState {
  visible: boolean;
  alpha: number;
  distance: number;
}

/**
 * Resolves Hub guidance sign visibility within `<= 200u` (`HUB_GUIDE_MAX_DIST`).
 */
export function resolveHubGuideVisibility(
  playerX: number,
  playerY: number,
  signX: number,
  signY: number,
  blocked = false,
): HubGuideVisibilityState {
  const d = Math.hypot(playerX - signX, playerY - signY);
  if (blocked || d > HUB_GUIDE_MAX_DIST) {
    return {
      visible: false,
      alpha: 0,
      distance: d,
    };
  }
  const alpha =
    d <= 160 ? 1 : clamp(1 - ((d - 160) / (HUB_GUIDE_MAX_DIST - 160)) * 0.7, 0.3, 1);
  return {
    visible: true,
    alpha,
    distance: d,
  };
}

export interface PlayerNameplateSpec {
  visible: boolean;
  text: string;
  color: string;
  alpha: number;
  fontSizePxAt1080p: number;
  worldFontSize: string;
  worldScale: number;
  x: number;
  y: number;
  emoteY: number;
}

/**
 * Resolves player overhead nameplate visibility & styling according to Spec 3.3:
 * - Local player (`player.id === localPlayerId`): always hidden (`visible: false`).
 * - Co-op teammates (`player.id !== localPlayerId`): `11.5px` at `1080p` (`worldFontSize: '11.5px'`, `worldScale: 0.5`),
 *   `alpha: 0.75`, slot color (or crimson/cyan when downed/ghost), positioned at `y - 35` above head.
 */
export function resolvePlayerNameplateSpec(params: {
  player: Pick<
    SimPlayerState,
    'id' | 'slot' | 'displayName' | 'lifeState' | 'reviveProgress' | 'downedTimer' | 'ready'
  >;
  localPlayerId: number;
  x: number;
  y: number;
  inHub: boolean;
  stressTestActive?: boolean;
  safeTopY?: number;
}): PlayerNameplateSpec {
  const {
    player: p,
    localPlayerId,
    x,
    y,
    inHub,
    stressTestActive = false,
    safeTopY = 84,
  } = params;

  const placeBelow = y + PLAYER_NAMEPLATE_OFFSET_Y < safeTopY;
  const nameY = placeBelow ? y + PLAYER_NAMEPLATE_BELOW_OFFSET_Y : y + PLAYER_NAMEPLATE_OFFSET_Y;
  const emoteY = placeBelow ? y + 44 : Math.max(safeTopY + 12, y - 60);

  if (stressTestActive || p.id === localPlayerId) {
    return {
      visible: false,
      text: '',
      color: PLAYER_SLOT_COLORS[p.slot],
      alpha: 0,
      fontSizePxAt1080p: 11.5,
      worldFontSize: '11.5px',
      worldScale: 0.5,
      x,
      y: nameY,
      emoteY,
    };
  }

  let statusSuffix = '';
  if (p.lifeState === 'downed') {
    const revPct = Math.round(p.reviveProgress * 100);
    const interactLabel = graphicsSettings.getActionKeyLabel('interact');
    const holdReviveHint =
      interactLabel === 'E'
        ? i18n.t('ui.hud.holdEToRevive')
        : i18n.t('ui.hud.holdEToRevive').replace(/\bE\]/g, `${interactLabel}]`);
    statusSuffix =
      revPct > 0
        ? ` · ${i18n.t('ui.hud.reviving')} ${revPct}%`
        : ` · ${i18n.t('ui.hud.downed')} (${Math.ceil(p.downedTimer)}s) ${holdReviveHint}`;
  } else if (p.lifeState === 'ghost') {
    statusSuffix = ` · ${i18n.t('ui.hud.ghost')}`;
  } else if (inHub && p.ready) {
    statusSuffix = ' · ✓';
  }

  const color =
    p.lifeState === 'downed'
      ? PALETTE.CRIMSON_BRIGHT
      : p.lifeState === 'ghost'
        ? PALETTE.CYAN_FROST
        : PLAYER_SLOT_COLORS[p.slot];

  return {
    visible: true,
    text: `[P${p.slot}] ${p.displayName}${statusSuffix}`,
    color,
    alpha: 0.75,
    fontSizePxAt1080p: 11.5,
    worldFontSize: '11.5px',
    worldScale: 0.5,
    x,
    y: nameY,
    emoteY,
  };
}

/**
 * Updates and renders the single reusable world-space interact rounded-pill prompt container
 * at depth 52 with zero per-frame object allocations.
 */
export function syncWorldInteractPromptPill(
  scene: GameScene,
  dtSec: number,
  activeSpec: InteractPromptSpec | null,
  overlayVisible = false,
): void {
  const sim = scene.transport.getSim();
  const modalOrMapOpen =
    scene.fullMapOpen ||
    scene.pauseModalOpen ||
    (scene.settingsModal?.isOpen() ?? false) ||
    overlayVisible;

  const fadeState = scene.interactPromptState;
  if (modalOrMapOpen) {
    fadeState.currentTargetKey = activeSpec ? activeSpec.key : null;
    fadeState.alpha = 0;
    fadeState.cachedSpec = null;
  } else {
    stepInteractPromptFadeState(fadeState, activeSpec, dtSec);
  }

  const renderSpec = fadeState.cachedSpec;
  if (fadeState.alpha <= 0 || !renderSpec) {
    scene.interactPromptVisuals?.container.setVisible(false);
    return;
  }

  const textRes = TextureBaker.getBakeScale();
  let visuals = scene.interactPromptVisuals;
  if (!visuals) {
    const container = scene.add.container(0, 0).setDepth(52);
    const bgGraphics = scene.add.graphics();
    const keyText = scene.add
      .text(0, 0, renderSpec.keycapText, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '9px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DEEP,
        strokeThickness: 2.2,
        resolution: textRes,
      })
      .setOrigin(0.5, 0.5);
    const titleText = scene.add
      .text(0, 0, '', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '9.5px',
        fontStyle: '800',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DEEP,
        strokeThickness: 2.5,
        resolution: textRes,
      })
      .setOrigin(0, 0.5);
    const priceText = scene.add
      .text(0, 0, '', {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '9.5px',
        fontStyle: '800',
        color: '#FACC15',
        stroke: PALETTE.INK_DEEP,
        strokeThickness: 2.5,
        resolution: textRes,
      })
      .setOrigin(0, 0.5)
      .setVisible(false);

    container.add([bgGraphics, keyText, titleText, priceText]);
    visuals = {
      container,
      bgGraphics,
      keyText,
      titleText,
      priceText,
      lastHash: '',
      pillWidth: 80,
      pillHeight: 20,
    };
    scene.interactPromptVisuals = visuals;
  }

  const hash = `${renderSpec.key}:${renderSpec.keycapText}:${renderSpec.titleText}:${renderSpec.colorHex}:${renderSpec.costGold}:${renderSpec.priceText}:${textRes}`;
  if (hash !== visuals.lastHash) {
    visuals.lastHash = hash;
    visuals.keyText.setResolution(textRes);
    visuals.titleText.setResolution(textRes);
    visuals.priceText.setResolution(textRes);
    visuals.keyText.setText(renderSpec.keycapText);
    visuals.titleText.setText(renderSpec.titleText);
    visuals.titleText.setColor(renderSpec.colorHex);

    const hasPrice = renderSpec.costGold > 0 && renderSpec.priceText.length > 0;
    if (hasPrice) {
      visuals.priceText.setText(renderSpec.priceText);
      visuals.priceText.setVisible(true);
    } else {
      visuals.priceText.setVisible(false);
    }

    const padLeft = 5;
    const chipW = Math.max(14, Math.ceil(visuals.keyText.width + 8));
    const chipH = 14;
    const gapAfterChip = 5;
    const titleW = visuals.titleText.width;
    const priceBlockW = hasPrice ? 6 + 6 + 9 + 4 + visuals.priceText.width : 0;
    const padRight = 6;
    const pillW = Math.ceil(padLeft + chipW + gapAfterChip + titleW + priceBlockW + padRight);
    const pillH = 20;
    visuals.pillWidth = pillW;
    visuals.pillHeight = pillH;

    const leftX = -pillW * 0.5;
    const g = visuals.bgGraphics;
    g.clear();

    // Dark translucent rounded-pill background with rarity/theme border
    g.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.92);
    g.lineStyle(1.5, renderSpec.colorNum, 0.95);
    g.fillRoundedRect(leftX, -pillH * 0.5, pillW, pillH, 6);
    g.strokeRoundedRect(leftX, -pillH * 0.5, pillW, pillH, 6);

    // Keycap chip on the left
    const chipX = leftX + padLeft;
    g.fillStyle(hexToNum(PALETTE.SLATE_MID), 0.98);
    g.lineStyle(1.2, hexToNum(PALETTE.SOLAR_GOLD), 0.98);
    g.fillRoundedRect(chipX, -chipH * 0.5, chipW, chipH, 3.5);
    g.strokeRoundedRect(chipX, -chipH * 0.5, chipW, chipH, 3.5);
    visuals.keyText.setPosition(chipX + chipW * 0.5, 0);

    // Localized object/item name
    const titleX = chipX + chipW + gapAfterChip;
    visuals.titleText.setPosition(titleX, 0);

    // Optional gold cost with separator + golden coin icon
    if (hasPrice) {
      const sepX = titleX + titleW + 6;
      g.lineStyle(1, hexToNum(PALETTE.SLATE_MID), 0.85);
      g.lineBetween(sepX, -5.5, sepX, 5.5);

      const coinCx = sepX + 6 + 4.5;
      g.fillStyle(0xfacc15, 1);
      g.fillCircle(coinCx, 0, 4.5);
      g.lineStyle(1, 0xf59e42, 1);
      g.strokeCircle(coinCx, 0, 4.5);
      g.lineStyle(1, 0xfffbeb, 0.9);
      g.lineBetween(coinCx, -2.2, coinCx, 2.2);

      visuals.priceText.setPosition(coinCx + 4.5 + 4, 0);
    }
  }

  const view = scene.cameras.main.worldView;
  const hasView = view && view.width > 0;
  const bossActive = sim.getActiveBoss() !== null;
  const halfW = visuals.pillWidth * 0.5;
  const halfH = visuals.pillHeight * 0.5;
  const safeTopY = (hasView ? view.y + (bossActive ? 122 : 82) : 82) + halfH;
  const safeBottomY = (hasView ? view.y + view.height - 66 : 474) - halfH;
  const safeLeftX = (hasView ? view.x + 14 : 14) + halfW;
  const safeRightX = (hasView ? view.x + view.width - 14 : 946) - halfW;

  const clampedX =
    safeLeftX > safeRightX ? renderSpec.x : clamp(renderSpec.x, safeLeftX, safeRightX);
  const clampedY =
    safeTopY > safeBottomY ? renderSpec.y : clamp(renderSpec.y, safeTopY, safeBottomY);

  visuals.container.setPosition(clampedX, clampedY);
  visuals.container.setAlpha(fadeState.alpha);
  visuals.container.setVisible(true);
}
