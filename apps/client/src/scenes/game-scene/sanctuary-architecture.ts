import {
  type CharacterId,
  clamp,
  type HubStationId,
  i18n,
  type InteractTargetResult,
  type SimHubStation,
  type SimHubStatue,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { CHARACTER_THEME_COLORS } from '../../fx/lighting-config.js';

export type SanctuaryZoneId =
  | 'north_gate'
  | 'central_hearth'
  | 'hero_lounge'
  | 'east_coop'
  | 'west_armory'
  | 'southeast_codex';

export interface SanctuaryZoneSpec {
  readonly id: SanctuaryZoneId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SanctuaryRunnerSpec {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

export interface SanctuaryHeroRugSpec {
  readonly characterId: CharacterId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly colorHex: string;
  readonly colorNum: number;
}

export interface SanctuaryRackStandSpec {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SanctuaryStationArchSpec {
  readonly id: HubStationId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SanctuaryArchitectureSpec {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly zones: readonly SanctuaryZoneSpec[];
  readonly northCarpet: SanctuaryRunnerSpec;
  readonly portalDais: {
    readonly x: number;
    readonly y: number;
    readonly outerRadius: number;
    readonly midRadius: number;
    readonly innerRadius: number;
  };
  readonly hearth: {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    readonly astrolabePoints: number;
    readonly benchCount: number;
    readonly benchAnglesRad: readonly [number, number][];
  };
  readonly heroRugs: readonly SanctuaryHeroRugSpec[];
  readonly eastRunner: SanctuaryRunnerSpec;
  readonly coopStation: SanctuaryStationArchSpec;
  readonly westWalkway: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly shootingRange: {
    readonly x: number;
    readonly y: number;
    readonly outerRadius: number;
    readonly rings: readonly [number, number, number];
  };
  readonly rackStands: readonly SanctuaryRackStandSpec[];
  readonly codexStation: SanctuaryStationArchSpec;
}

export interface HeroStationVisualState {
  embodied: boolean;
  rigAlpha: number;
  showActiveBadge: boolean;
}

export type HubWorldClickAction =
  | { kind: 'select_character'; characterId: CharacterId }
  | { kind: 'toggle_coop_board' }
  | { kind: 'open_codex_desk' };

const CANONICAL_HUB_WIDTH = 1152;
const CANONICAL_HUB_HEIGHT = 704;

/**
 * Builds the deterministic 5-Wing Ashen Sanctuary architectural layout spec
 * aligned 1:1 with `WorldSim.enterHub()` coordinates.
 */
export function buildSanctuaryArchitectureSpec(
  mapWidth: number,
  mapHeight: number,
): SanctuaryArchitectureSpec {
  const cx = mapWidth * 0.5;
  const cy = mapHeight * 0.5;
  const ox = cx - CANONICAL_HUB_WIDTH * 0.5;
  const oy = cy - CANONICAL_HUB_HEIGHT * 0.5;

  const northXMin = 532 + ox;
  const northXMax = 620 + ox;
  const northYMin = 122 + oy;
  const northYMax = 352 + oy;

  const eastXMin = 626 + ox;
  const eastXMax = 928 + ox;
  const eastYMin = 330 + oy;
  const eastYMax = 374 + oy;

  const heroCoords: readonly [CharacterId, number, number][] = [
    ['vanguard', 388 + ox, 224 + oy],
    ['ranger', 452 + ox, 160 + oy],
    ['elementalist', 700 + ox, 160 + oy],
    ['druid', 388 + ox, 316 + oy],
    ['engineer', 764 + ox, 224 + oy],
  ];

  const heroRugs: SanctuaryHeroRugSpec[] = heroCoords.map(([characterId, x, y]) => {
    const colorHex = CHARACTER_THEME_COLORS[characterId];
    return {
      characterId,
      x,
      y,
      width: 62,
      height: 50,
      colorHex,
      colorNum: hexToNum(colorHex),
    };
  });

  const rackCoords: readonly [number, number][] = [
    [206 + ox, 404 + oy],
    [326 + ox, 404 + oy],
    [206 + ox, 488 + oy],
    [326 + ox, 488 + oy],
  ];

  const rackStands: SanctuaryRackStandSpec[] = rackCoords.map(([x, y], index) => ({
    index,
    x,
    y,
    width: 48,
    height: 34,
  }));

  const zones: readonly SanctuaryZoneSpec[] = [
    {
      id: 'north_gate',
      x: cx,
      y: 122 + oy,
      width: 224,
      height: 112,
    },
    {
      id: 'central_hearth',
      x: cx,
      y: cy,
      width: 176,
      height: 176,
    },
    {
      id: 'hero_lounge',
      x: cx,
      y: 224 + oy,
      width: 448,
      height: 208,
    },
    {
      id: 'east_coop',
      x: 928 + ox,
      y: 352 + oy,
      width: 256,
      height: 176,
    },
    {
      id: 'west_armory',
      x: 266 + ox,
      y: 356 + oy,
      width: 208,
      height: 340,
    },
    {
      id: 'southeast_codex',
      x: 860 + ox,
      y: 520 + oy,
      width: 176,
      height: 136,
    },
  ];

  return {
    mapWidth,
    mapHeight,
    zones,
    northCarpet: {
      x: northXMin,
      y: northYMin,
      width: northXMax - northXMin,
      height: northYMax - northYMin,
      xMin: northXMin,
      xMax: northXMax,
      yMin: northYMin,
      yMax: northYMax,
    },
    portalDais: {
      x: 576 + ox,
      y: 122 + oy,
      outerRadius: 54,
      midRadius: 43,
      innerRadius: 32,
    },
    hearth: {
      x: 576 + ox,
      y: 352 + oy,
      radius: 46,
      astrolabePoints: 8,
      benchCount: 3,
      benchAnglesRad: [
        [-2.74, -2.04],
        [-1.1, -0.4],
        [1.18, 1.96],
      ],
    },
    heroRugs,
    eastRunner: {
      x: eastXMin,
      y: eastYMin,
      width: eastXMax - eastXMin,
      height: eastYMax - eastYMin,
      xMin: eastXMin,
      xMax: eastXMax,
      yMin: eastYMin,
      yMax: eastYMax,
    },
    coopStation: {
      id: 'coop_board',
      x: 928 + ox,
      y: 352 + oy,
      width: 72,
      height: 48,
    },
    westWalkway: {
      x: 180 + ox,
      y: 196 + oy,
      width: 176,
      height: 324,
    },
    shootingRange: {
      x: 236 + ox,
      y: 236 + oy,
      outerRadius: 44,
      rings: [44, 30, 16],
    },
    rackStands,
    codexStation: {
      id: 'codex_desk',
      x: 860 + ox,
      y: 520 + oy,
      width: 54,
      height: 38,
    },
  };
}

/**
 * Resolves the lounging hero station visual state:
 * - Embodied heroes fade to an astral echo (`rigAlpha: 0.38`) regardless of `allowDuplicates`
 *   and display the localized `"★ Đang hóa thân"` / `"★ Active"` badge.
 * - Unselected heroes lounge at full opacity (`rigAlpha: 1`).
 */
export function resolveHeroStationVisualState(
  characterId: CharacterId,
  activeCharacterIds: readonly CharacterId[],
  _allowDuplicates: boolean,
): HeroStationVisualState {
  const embodied = activeCharacterIds.includes(characterId);
  if (!embodied) {
    return {
      embodied: false,
      rigAlpha: 1,
      showActiveBadge: false,
    };
  }
  return {
    embodied: true,
    rigAlpha: 0.38,
    showActiveBadge: true,
  };
}

export interface SanctuaryHudChromeClickParams {
  inHub: boolean;
  invitePanelVisible: boolean;
  hudX: number;
  hudY: number;
  hudPadX: number;
  hudPadY: number;
  hudUiScale?: number;
  hudHitCount?: number;
}

/**
 * Determines whether a pointerdown in `HudScene` coordinates (`hudX`, `hudY`) hits interactive
 * `HudScene` targets (`hitTestPointer(pointer)`), top/bottom HUD chrome, or the scaled
 * non-interactive Co-op Invite Panel background rect
 * `[960 - 296 * s + hudPadX, 960 - 12 * s + hudPadX] × [144 * s - hudPadY, 426 * s - hudPadY]`.
 */
export function isSanctuaryHudChromeClick(params: SanctuaryHudChromeClickParams): boolean {
  const {
    inHub,
    invitePanelVisible,
    hudX,
    hudY,
    hudPadX,
    hudPadY,
    hudUiScale = 1,
    hudHitCount = 0,
  } = params;

  if (hudHitCount > 0) {
    return true;
  }
  if (hudY < 68 - hudPadY || hudY > 480 + hudPadY) {
    return true;
  }

  const s = hudUiScale > 0 ? hudUiScale : 1;
  if (
    inHub &&
    invitePanelVisible &&
    hudX >= 960 - 296 * s + hudPadX &&
    hudX <= 960 - 12 * s + hudPadX &&
    hudY >= 144 * s - hudPadY &&
    hudY <= 426 * s - hudPadY
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves world-space pointer clicks inside the Sanctuary Hub when no modal or HUD chrome is clicked:
 * - Solo Hub (`coopMode === 'solo'`): within `<= 30u` of a `hubStatue` selects that character.
 * - Any Hub mode: within `<= 34u` of `coop_board` toggles `invitePanelVisible`.
 * - Any Hub mode: within `<= 32u` of `codex_desk` opens `settingsModal.open('settings')`.
 */
export function resolveHubWorldPointerClick(params: {
  inHub: boolean;
  coopMode: 'solo' | 'host' | 'join';
  modalOpen: boolean;
  isClickingHudChrome?: boolean;
  worldX: number;
  worldY: number;
  hubStatues: readonly SimHubStatue[];
  hubStations: readonly SimHubStation[];
}): HubWorldClickAction | null {
  const {
    inHub,
    coopMode,
    modalOpen,
    isClickingHudChrome = false,
    worldX,
    worldY,
    hubStatues,
    hubStations,
  } = params;
  if (!inHub || modalOpen || isClickingHudChrome) {
    return null;
  }

  if (coopMode === 'solo') {
    let bestStatue: SimHubStatue | null = null;
    let bestDist = 30;
    for (let i = 0; i < hubStatues.length; i++) {
      const st = hubStatues[i]!;
      const d = Math.hypot(worldX - st.x, worldY - st.y);
      if (d <= bestDist) {
        bestDist = d;
        bestStatue = st;
      }
    }
    if (bestStatue) {
      return {
        kind: 'select_character',
        characterId: bestStatue.characterId,
      };
    }
  }

  for (let i = 0; i < hubStations.length; i++) {
    const station = hubStations[i]!;
    const maxDist = station.id === 'coop_board' ? 34 : 32;
    const d = Math.hypot(worldX - station.x, worldY - station.y);
    if (d <= maxDist) {
      return station.id === 'coop_board'
        ? { kind: 'toggle_coop_board' }
        : { kind: 'open_codex_desk' };
    }
  }

  return null;
}

export interface HeroLoungeLabelState {
  labelVisible: boolean;
  labelText: string;
  labelColor: string;
  labelAlpha: number;
  subLabelVisible: boolean;
  subLabelText: string;
  subLabelColor: string;
  subLabelAlpha: number;
}

export function resolveHeroLoungeLabelState(params: {
  characterId: CharacterId;
  characterName: string;
  stationVisual: HeroStationVisualState;
  playerX: number;
  playerY: number;
  statueX: number;
  statueY: number;
  modalOrMapOpen: boolean;
  isTargetedStatue: boolean;
}): HeroLoungeLabelState {
  const {
    characterId,
    characterName,
    stationVisual,
    playerX,
    playerY,
    statueX,
    statueY,
    modalOrMapOpen,
    isTargetedStatue,
  } = params;

  const subLabelVisible = stationVisual.showActiveBadge && !modalOrMapOpen;
  const subLabelText = subLabelVisible ? i18n.t('ui.sanctuary.embodiedBadge') : '';

  const dist = Math.hypot(playerX - statueX, playerY - statueY);
  const labelVisible =
    !stationVisual.embodied && !modalOrMapOpen && !isTargetedStatue && dist <= 240;
  const labelAlpha = labelVisible
    ? dist <= 170
      ? 0.78
      : clamp(0.78 * (1 - (dist - 170) / 70), 0.25, 0.78)
    : 0;

  return {
    labelVisible,
    labelText: characterName,
    labelColor: CHARACTER_THEME_COLORS[characterId] ?? PALETTE.SOLAR_GOLD,
    labelAlpha,
    subLabelVisible,
    subLabelText,
    subLabelColor: PALETTE.LIME_GLOW,
    subLabelAlpha: 0.92,
  };
}

export interface SanctuaryGuideSignSpec {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  text: string;
  color: string;
  blocked: boolean;
}

export function resolveSanctuaryGuideSpecs(params: {
  mapWidth: number;
  mapHeight: number;
  rollingDps: number;
  camScrollX: number;
  invitePanelVisible: boolean;
  fullMapOpen: boolean;
  previewOpen: boolean;
  modalOrMapOpen: boolean;
  weaponComparisonVisible: boolean;
  target: InteractTargetResult | null;
}): SanctuaryGuideSignSpec[] {
  const {
    mapWidth,
    mapHeight,
    rollingDps,
    camScrollX,
    invitePanelVisible,
    fullMapOpen,
    previewOpen,
    modalOrMapOpen,
    weaponComparisonVisible,
    target,
  } = params;

  const isEn = i18n.getLocale() === 'en';
  const ox = mapWidth * 0.5 - CANONICAL_HUB_WIDTH * 0.5;
  const oy = mapHeight * 0.5 - CANONICAL_HUB_HEIGHT * 0.5;
  const eastSignX = 928 + ox;
  const codexSignX = 860 + ox;
  const eastBlockedByInvite =
    invitePanelVisible && !fullMapOpen && eastSignX - camScrollX > 560;
  const codexBlockedByInvite =
    invitePanelVisible && !fullMapOpen && codexSignX - camScrollX > 560;

  return [
    {
      x: 576 + ox,
      y: 174 + oy,
      anchorX: 576 + ox,
      anchorY: 174 + oy,
      text: i18n.t('ui.hubGuide.portalSign'),
      color: PALETTE.SOLAR_GOLD,
      blocked: modalOrMapOpen || target?.kind === 'portal',
    },
    {
      x: 576 + ox,
      y: 228 + oy,
      anchorX: 576 + ox,
      anchorY: 228 + oy,
      text: i18n.t('ui.hubGuide.statuesSign'),
      color: PALETTE.CYAN_FROST,
      blocked: previewOpen || modalOrMapOpen,
    },
    {
      x: 266 + ox,
      y: 368 + oy,
      anchorX: 266 + ox,
      anchorY: 368 + oy,
      text: i18n.t('ui.hubGuide.weaponsSign'),
      color: PALETTE.SOLAR_GOLD,
      blocked: previewOpen || modalOrMapOpen || weaponComparisonVisible,
    },
    {
      x: 236 + ox,
      y: 192 + oy,
      anchorX: 236 + ox,
      anchorY: 236 + oy,
      text: isEn
        ? `🎯 Training Dummy · DPS: ${rollingDps.toFixed(1)}`
        : `🎯 Bù Nhìn Tập Bắn · DPS: ${rollingDps.toFixed(1)}`,
      color: PALETTE.LIME_GLOW,
      blocked: modalOrMapOpen,
    },
    {
      x: eastSignX,
      y: 304 + oy,
      anchorX: eastSignX,
      anchorY: 352 + oy,
      text: i18n.t('ui.sanctuary.coopWingSign'),
      color: PALETTE.AZURE_CORE,
      blocked:
        modalOrMapOpen ||
        eastBlockedByInvite ||
        (target?.kind === 'hub_station' && target.station.id === 'coop_board'),
    },
    {
      x: codexSignX,
      y: 480 + oy,
      anchorX: codexSignX,
      anchorY: 520 + oy,
      text: i18n.t('ui.sanctuary.codexWingSign'),
      color: PALETTE.SOLAR_GOLD,
      blocked:
        modalOrMapOpen ||
        codexBlockedByInvite ||
        (target?.kind === 'hub_station' && target.station.id === 'codex_desk'),
    },
  ];
}

const COL_INK_DEEP = hexToNum(PALETTE.INK_DEEP);
const COL_INK_DARK = hexToNum(PALETTE.INK_DARK);
const COL_SLATE_DARK = hexToNum(PALETTE.SLATE_DARK);
const COL_SLATE_MID = hexToNum(PALETTE.SLATE_MID);
const COL_STEEL_DARK = hexToNum(PALETTE.STEEL_DARK);
const COL_STEEL_LIGHT = hexToNum(PALETTE.STEEL_LIGHT);
const COL_BONE_WHITE = hexToNum(PALETTE.BONE_WHITE);
const COL_WARM_STONE = hexToNum(PALETTE.WARM_STONE);
const COL_LEATHER_DARK = hexToNum(PALETTE.LEATHER_DARK);
const COL_LEATHER_MID = hexToNum(PALETTE.LEATHER_MID);
const COL_LEATHER_LIGHT = hexToNum(PALETTE.LEATHER_LIGHT);
const COL_RUBY_DARK = hexToNum(PALETTE.RUBY_DARK);
const COL_RUBY_CORE = hexToNum(PALETTE.RUBY_CORE);
const COL_CRIMSON_BRIGHT = hexToNum(PALETTE.CRIMSON_BRIGHT);
const COL_FLAME_ORANGE = hexToNum(PALETTE.FLAME_ORANGE);
const COL_SOLAR_GOLD = hexToNum(PALETTE.SOLAR_GOLD);
const COL_ABYSS_BLUE = hexToNum(PALETTE.ABYSS_BLUE);
const COL_COBALT_SHADE = hexToNum(PALETTE.COBALT_SHADE);
const COL_AZURE_CORE = hexToNum(PALETTE.AZURE_CORE);
const COL_CYAN_FROST = hexToNum(PALETTE.CYAN_FROST);
const COL_ICE_WHITE = hexToNum(PALETTE.ICE_WHITE);
const COL_ELECTRIC_VIOLET = hexToNum(PALETTE.ELECTRIC_VIOLET);
const COL_FORGE_DARK = hexToNum(PALETTE.FORGE_DARK);
const COL_BRONZE_SHADE = hexToNum(PALETTE.BRONZE_SHADE);
const COL_BRASS_CORE = hexToNum(PALETTE.BRASS_CORE);
const COL_VOLT_YELLOW = hexToNum(PALETTE.VOLT_YELLOW);
const COL_MAGMA_RED = hexToNum(PALETTE.MAGMA_RED);
const COL_COPPER_LIGHT = hexToNum(PALETTE.COPPER_LIGHT);

/**
 * Handcrafted 5-Wing Ashen Sanctuary visual world layer:
 * - `floorGraphics` (`depth: 6`): static carpets, stepped stone portal dais, sunken stone hearth
 *   with inlaid brass 8-point astrolabe & 3 curved timber benches, 5 bespoke class rugs,
 *   East azure-and-brass runner + Co-op Guild Table/Banner, West slate walkway + bullseye rings +
 *   4 Weapon Display Pedestals, and South-East Chronicler's Lectern. Redrawn only when `inHub`,
 *   locale, or map dimensions change.
 * - `dynamicGraphics` (`depth: 33`): smooth deterministic hearth flames & rising embers, portal
 *   threshold rune shimmer, East LAN beacon pulse, and South-East candle flicker driven by `visualTimeSec`.
 */
export class SanctuaryVisualLayer {
  private readonly floorGraphics: Phaser.GameObjects.Graphics;
  private readonly dynamicGraphics: Phaser.GameObjects.Graphics;
  private lastStaticKey = '';
  private cachedSpec: SanctuaryArchitectureSpec | null = null;
  private isShowing = false;

  constructor(scene: Phaser.Scene) {
    this.floorGraphics = scene.add.graphics().setDepth(6);
    this.dynamicGraphics = scene.add.graphics().setDepth(33);
    this.floorGraphics.setVisible(false);
    this.dynamicGraphics.setVisible(false);
  }

  public sync(sim: WorldSim, _dtSec: number, visualTimeSec: number): void {
    if (!sim.inHub || sim.stressTestActive) {
      if (this.isShowing) {
        this.floorGraphics.clear();
        this.dynamicGraphics.clear();
        this.floorGraphics.setVisible(false);
        this.dynamicGraphics.setVisible(false);
        this.lastStaticKey = '';
        this.cachedSpec = null;
        this.isShowing = false;
      }
      return;
    }

    const mapW = sim.map.width;
    const mapH = sim.map.height;
    const locale = i18n.getLocale();
    const staticKey = `${mapW}x${mapH}:${locale}`;

    if (!this.isShowing) {
      this.floorGraphics.setVisible(true);
      this.dynamicGraphics.setVisible(true);
      this.isShowing = true;
    }

    if (staticKey !== this.lastStaticKey || !this.cachedSpec) {
      this.lastStaticKey = staticKey;
      this.cachedSpec = buildSanctuaryArchitectureSpec(mapW, mapH);
      this.drawStaticFloor(this.floorGraphics, this.cachedSpec);
    }

    this.drawDynamicEffects(this.dynamicGraphics, this.cachedSpec, visualTimeSec);
  }

  public destroy(): void {
    this.floorGraphics.destroy();
    this.dynamicGraphics.destroy();
    this.cachedSpec = null;
    this.lastStaticKey = '';
    this.isShowing = false;
  }

  private drawStaticFloor(
    g: Phaser.GameObjects.Graphics,
    spec: SanctuaryArchitectureSpec,
  ): void {
    g.clear();

    this.drawWestArmoryWing(g, spec);
    this.drawEastCoopWingRunner(g, spec);
    this.drawNorthGateCarpetAndDais(g, spec);
    this.drawHeroLoungeRugs(g, spec);
    this.drawCentralHearthAndBenches(g, spec);
    this.drawEastCoopGuildTable(g, spec);
    this.drawSoutheastCodexLectern(g, spec);
  }

  private drawNorthGateCarpetAndDais(
    g: Phaser.GameObjects.Graphics,
    spec: SanctuaryArchitectureSpec,
  ): void {
    const nc = spec.northCarpet;
    const dais = spec.portalDais;

    // 1. Ceremonial North Crimson-and-Gold Carpet Runner (x = 532..620, y = 122..352)
    g.fillStyle(COL_INK_DEEP, 0.36);
    g.fillRect(nc.x - 3, nc.y, nc.width + 6, nc.height + 4);

    g.fillStyle(COL_RUBY_DARK, 0.96);
    g.lineStyle(2, COL_INK_DARK, 1);
    g.fillRect(nc.x, nc.y, nc.width, nc.height);
    g.strokeRect(nc.x, nc.y, nc.width, nc.height);

    // Woven brass & solar-gold double border trim
    g.lineStyle(2, COL_BRASS_CORE, 0.92);
    g.strokeRect(nc.x + 5, nc.y + 4, nc.width - 10, nc.height - 8);
    g.lineStyle(1, COL_SOLAR_GOLD, 0.78);
    g.strokeRect(nc.x + 8, nc.y + 7, nc.width - 16, nc.height - 14);

    // Rich crimson inner velvet field
    g.fillStyle(COL_RUBY_CORE, 0.9);
    g.fillRect(nc.x + 11, nc.y + 10, nc.width - 22, nc.height - 20);

    // Woven golden aisle chevrons & diamond medallions leading North toward the portal
    const centerX = (nc.xMin + nc.xMax) * 0.5;
    for (let cy = nc.yMin + 64; cy <= nc.yMax - 58; cy += 38) {
      g.fillStyle(COL_RUBY_DARK, 0.85);
      g.fillTriangle(centerX, cy - 11, centerX + 14, cy, centerX, cy + 11);
      g.fillTriangle(centerX, cy - 11, centerX - 14, cy, centerX, cy + 11);
      g.lineStyle(1.3, COL_SOLAR_GOLD, 0.72);
      g.lineBetween(centerX, cy - 9, centerX + 12, cy);
      g.lineBetween(centerX + 12, cy, centerX, cy + 9);
      g.lineBetween(centerX, cy + 9, centerX - 12, cy);
      g.lineBetween(centerX - 12, cy, centerX, cy - 9);
      // Northward chevron pointer
      g.lineStyle(1.4, COL_COPPER_LIGHT, 0.55);
      g.lineBetween(centerX - 18, cy + 16, centerX, cy + 8);
      g.lineBetween(centerX + 18, cy + 16, centerX, cy + 8);
    }

    // Carved threshold rune stones across the Northern portal approach
    const thresholdY = dais.y + 58;
    g.fillStyle(COL_SLATE_DARK, 0.95);
    g.lineStyle(1.6, COL_INK_DARK, 1);
    g.fillRoundedRect(centerX - 50, thresholdY - 8, 100, 16, 4);
    g.strokeRoundedRect(centerX - 50, thresholdY - 8, 100, 16, 4);
    for (let rx = -36; rx <= 36; rx += 18) {
      const gx = centerX + rx;
      g.lineStyle(1.4, COL_SOLAR_GOLD, 0.8);
      g.lineBetween(gx - 4, thresholdY, gx + 4, thresholdY);
      g.lineBetween(gx, thresholdY - 4, gx, thresholdY + 4);
    }

    // 2. Stepped Stone Portal Dais at (576, 122)
    g.fillStyle(COL_INK_DEEP, 0.45);
    g.fillCircle(dais.x, dais.y + 4, dais.outerRadius + 4);

    // Outer octagonal / stepped stone base
    g.fillStyle(COL_SLATE_DARK, 0.98);
    g.lineStyle(2.2, COL_INK_DARK, 1);
    g.fillCircle(dais.x, dais.y, dais.outerRadius);
    g.strokeCircle(dais.x, dais.y, dais.outerRadius);

    g.lineStyle(1.5, COL_STEEL_DARK, 0.85);
    g.strokeCircle(dais.x, dais.y, dais.outerRadius - 3);

    // Radial masonry joint lines on outer step
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4 + Math.PI / 8;
      const r0 = dais.midRadius;
      const r1 = dais.outerRadius - 1;
      g.lineStyle(1.3, COL_INK_DARK, 0.8);
      g.lineBetween(
        dais.x + Math.cos(ang) * r0,
        dais.y + Math.sin(ang) * r0,
        dais.x + Math.cos(ang) * r1,
        dais.y + Math.sin(ang) * r1,
      );
    }

    // Middle raised stone step
    g.fillStyle(COL_SLATE_MID, 0.98);
    g.lineStyle(2, COL_INK_DARK, 1);
    g.fillCircle(dais.x, dais.y, dais.midRadius);
    g.strokeCircle(dais.x, dais.y, dais.midRadius);
    g.lineStyle(1.4, COL_STEEL_LIGHT, 0.65);
    g.strokeCircle(dais.x, dais.y, dais.midRadius - 2.5);

    // Inner carved rune ring
    g.fillStyle(COL_INK_DARK, 0.92);
    g.lineStyle(1.8, COL_BRASS_CORE, 0.9);
    g.fillCircle(dais.x, dais.y, dais.innerRadius);
    g.strokeCircle(dais.x, dais.y, dais.innerRadius);

    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4;
      const rx = dais.x + Math.cos(ang) * (dais.midRadius - 6);
      const ry = dais.y + Math.sin(ang) * (dais.midRadius - 6);
      g.fillStyle(k % 2 === 0 ? COL_SOLAR_GOLD : COL_ELECTRIC_VIOLET, 0.78);
      g.fillCircle(rx, ry, 2.2);
    }
  }

  private drawCentralHearthAndBenches(
    g: Phaser.GameObjects.Graphics,
    spec: SanctuaryArchitectureSpec,
  ): void {
    const hx = spec.hearth.x;
    const hy = spec.hearth.y;
    const hr = spec.hearth.radius;

    // Soft outer flagstone apron under the hearth & benches
    g.fillStyle(COL_SLATE_DARK, 0.42);
    g.fillCircle(hx, hy, hr + 44);
    g.lineStyle(1.4, COL_STEEL_DARK, 0.45);
    g.strokeCircle(hx, hy, hr + 44);

    // 3 Curved Warm Timber Benches around the Hearth
    const benchRadii: readonly [number, number, number] = [66, 66, 84];
    for (let bIdx = 0; bIdx < spec.hearth.benchAnglesRad.length; bIdx++) {
      const [a0, a1] = spec.hearth.benchAnglesRad[bIdx]!;
      const bRadius = benchRadii[bIdx] ?? 66;
      this.drawCurvedTimberBench(g, hx, hy, bRadius, a0, a1);
    }

    // Central Sunken Stone Hearth Ring (r = 46)
    g.fillStyle(COL_INK_DEEP, 0.5);
    g.fillCircle(hx, hy + 3, hr + 4);

    // Outer beveled stone curb
    g.fillStyle(COL_STEEL_DARK, 0.98);
    g.lineStyle(2.4, COL_INK_DARK, 1);
    g.fillCircle(hx, hy, hr);
    g.strokeCircle(hx, hy, hr);

    g.lineStyle(1.6, COL_WARM_STONE, 0.72);
    g.strokeCircle(hx, hy, hr - 3);

    // Sunken stone pit interior
    const pitR = hr - 9;
    g.fillStyle(COL_INK_DARK, 0.96);
    g.lineStyle(1.8, COL_INK_DEEP, 1);
    g.fillCircle(hx, hy, pitR);
    g.strokeCircle(hx, hy, pitR);

    g.fillStyle(COL_FORGE_DARK, 0.88);
    g.fillCircle(hx, hy, pitR - 3);

    // Inlaid Brass 8-Point Astrolabe inside & across the hearth ring
    g.lineStyle(1.6, COL_BRASS_CORE, 0.88);
    g.strokeCircle(hx, hy, pitR - 2);
    g.lineStyle(1.2, COL_SOLAR_GOLD, 0.72);
    g.strokeCircle(hx, hy, pitR - 11);

    for (let p = 0; p < spec.hearth.astrolabePoints; p++) {
      const ang = (p * Math.PI * 2) / spec.hearth.astrolabePoints - Math.PI * 0.5;
      const isCardinal = p % 2 === 0;
      const tipR = isCardinal ? hr - 1.5 : hr - 4.5;
      const baseR = 12;
      const spread = isCardinal ? 0.16 : 0.12;

      const tx = hx + Math.cos(ang) * tipR;
      const ty = hy + Math.sin(ang) * tipR;
      const lx = hx + Math.cos(ang - spread) * baseR;
      const ly = hy + Math.sin(ang - spread) * baseR;
      const rx = hx + Math.cos(ang + spread) * baseR;
      const ry = hy + Math.sin(ang + spread) * baseR;

      g.fillStyle(isCardinal ? COL_SOLAR_GOLD : COL_BRASS_CORE, isCardinal ? 0.86 : 0.76);
      g.fillTriangle(tx, ty, lx, ly, rx, ry);
      g.lineStyle(1, COL_INK_DARK, 0.75);
      g.strokeTriangle(tx, ty, lx, ly, rx, ry);
    }

    // Crossing firewood logs & glowing coal bed at hearth center
    g.lineStyle(5, COL_LEATHER_DARK, 0.98);
    g.lineBetween(hx - 14, hy + 8, hx + 14, hy - 6);
    g.lineBetween(hx - 13, hy - 7, hx + 13, hy + 9);
    g.lineStyle(2, COL_BRONZE_SHADE, 0.85);
    g.lineBetween(hx - 11, hy + 6, hx + 11, hy - 5);
    g.fillStyle(COL_MAGMA_RED, 0.85);
    g.fillCircle(hx, hy + 1, 13);
    g.fillStyle(COL_FLAME_ORANGE, 0.9);
    g.fillCircle(hx, hy, 8);
  }

  private drawCurvedTimberBench(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ): void {
    const innerR = radius - 6.5;
    const outerR = radius + 6.5;
    const segments = 8;

    // Drop shadow arc
    g.beginPath();
    for (let i = 0; i <= segments; i++) {
      const a = startAngle + ((endAngle - startAngle) * i) / segments;
      const px = cx + Math.cos(a) * (outerR + 2);
      const py = cy + Math.sin(a) * (outerR + 2) + 3;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    for (let i = segments; i >= 0; i--) {
      const a = startAngle + ((endAngle - startAngle) * i) / segments;
      const px = cx + Math.cos(a) * (innerR - 1);
      const py = cy + Math.sin(a) * (innerR - 1) + 3;
      g.lineTo(px, py);
    }
    g.closePath();
    g.fillStyle(COL_INK_DEEP, 0.45);
    g.fillPath();

    // Warm oak plank body
    g.beginPath();
    for (let i = 0; i <= segments; i++) {
      const a = startAngle + ((endAngle - startAngle) * i) / segments;
      const px = cx + Math.cos(a) * outerR;
      const py = cy + Math.sin(a) * outerR;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    for (let i = segments; i >= 0; i--) {
      const a = startAngle + ((endAngle - startAngle) * i) / segments;
      const px = cx + Math.cos(a) * innerR;
      const py = cy + Math.sin(a) * innerR;
      g.lineTo(px, py);
    }
    g.closePath();
    g.fillStyle(COL_LEATHER_MID, 0.98);
    g.fillPath();
    g.lineStyle(2, COL_INK_DARK, 1);
    g.strokePath();

    // Woodgrain highlight seam along center of bench
    g.beginPath();
    for (let i = 0; i <= segments; i++) {
      const a = startAngle + ((endAngle - startAngle) * i) / segments;
      const px = cx + Math.cos(a) * (radius - 1.2);
      const py = cy + Math.sin(a) * (radius - 1.2);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.lineStyle(1.4, COL_LEATHER_LIGHT, 0.72);
    g.strokePath();

    // Dark wrought-iron end straps & brass rivets
    for (const endA of [startAngle + 0.06, endAngle - 0.06]) {
      const x0 = cx + Math.cos(endA) * innerR;
      const y0 = cy + Math.sin(endA) * innerR;
      const x1 = cx + Math.cos(endA) * outerR;
      const y1 = cy + Math.sin(endA) * outerR;
      g.lineStyle(3, COL_STEEL_DARK, 0.95);
      g.lineBetween(x0, y0, x1, y1);
      g.fillStyle(COL_BRASS_CORE, 0.9);
      g.fillCircle(cx + Math.cos(endA) * radius, cy + Math.sin(endA) * radius, 1.6);
    }
  }

  private drawHeroLoungeRugs(
    g: Phaser.GameObjects.Graphics,
    spec: SanctuaryArchitectureSpec,
  ): void {
    for (let i = 0; i < spec.heroRugs.length; i++) {
      const rug = spec.heroRugs[i]!;
      const rx = rug.x - rug.width * 0.5;
      const ry = rug.y - rug.height * 0.5 + 4;
      const rw = rug.width;
      const rh = rug.height;
      const cx = rug.x;
      const cy = rug.y + 4;

      // Drop shadow
      g.fillStyle(COL_INK_DEEP, 0.4);
      g.fillRoundedRect(rx - 2, ry + 2, rw + 4, rh + 3, 8);

      // Dark woven rug base + crisp ink contour
      g.fillStyle(COL_SLATE_DARK, 0.96);
      g.lineStyle(2, COL_INK_DARK, 1);
      g.fillRoundedRect(rx, ry, rw, rh, 7);
      g.strokeRoundedRect(rx, ry, rw, rh, 7);

      // Class-colored border trim & corner brass studs
      g.lineStyle(2, rug.colorNum, 0.88);
      g.strokeRoundedRect(rx + 4, ry + 4, rw - 8, rh - 8, 5);
      g.fillStyle(COL_INK_DARK, 0.55);
      g.fillRoundedRect(rx + 7, ry + 7, rw - 14, rh - 14, 3);

      for (const [sx, sy] of [
        [rx + 6, ry + 6],
        [rx + rw - 6, ry + 6],
        [rx + 6, ry + rh - 6],
        [rx + rw - 6, ry + rh - 6],
      ] as const) {
        g.fillStyle(COL_SOLAR_GOLD, 0.85);
        g.fillCircle(sx, sy, 1.8);
      }

      // Bespoke class sigil geometry in the center of the rug
      this.drawClassRugSigil(g, rug.characterId, cx, cy, rug.colorNum);
    }
  }

  private drawClassRugSigil(
    g: Phaser.GameObjects.Graphics,
    characterId: CharacterId,
    cx: number,
    cy: number,
    colorNum: number,
  ): void {
    g.lineStyle(1.6, colorNum, 0.78);
    switch (characterId) {
      case 'vanguard': {
        // Kite shield + bastion chevron
        g.beginPath();
        g.moveTo(cx - 10, cy - 10);
        g.lineTo(cx + 10, cy - 10);
        g.lineTo(cx + 9, cy + 2);
        g.lineTo(cx, cy + 12);
        g.lineTo(cx - 9, cy + 2);
        g.closePath();
        g.fillStyle(colorNum, 0.22);
        g.fillPath();
        g.strokePath();
        g.lineBetween(cx - 6, cy + 1, cx, cy - 5);
        g.lineBetween(cx + 6, cy + 1, cx, cy - 5);
        break;
      }
      case 'ranger': {
        // Recurve bow arc + notched predator arrow
        g.beginPath();
        g.arc(cx, cy + 3, 12, -Math.PI * 0.85, -Math.PI * 0.15, false);
        g.strokePath();
        g.lineBetween(cx - 10, cy - 3, cx + 10, cy - 3);
        g.lineBetween(cx, cy + 10, cx, cy - 11);
        g.fillStyle(colorNum, 0.85);
        g.fillTriangle(cx, cy - 13, cx - 4, cy - 7, cx + 4, cy - 7);
        break;
      }
      case 'elementalist': {
        // Arcane hexagram / diamond rune ring
        g.strokeCircle(cx, cy, 11);
        g.fillStyle(colorNum, 0.2);
        g.fillTriangle(cx, cy - 10, cx + 9, cy + 5, cx - 9, cy + 5);
        g.strokeTriangle(cx, cy - 10, cx + 9, cy + 5, cx - 9, cy + 5);
        g.strokeTriangle(cx, cy + 10, cx + 9, cy - 5, cx - 9, cy - 5);
        break;
      }
      case 'druid': {
        // Sacred 4-leaf botanical crest
        g.strokeCircle(cx, cy, 10);
        g.fillStyle(colorNum, 0.26);
        g.fillEllipse(cx, cy - 5, 6, 9);
        g.fillEllipse(cx, cy + 5, 6, 9);
        g.fillEllipse(cx - 5, cy, 9, 6);
        g.fillEllipse(cx + 5, cy, 9, 6);
        g.fillStyle(COL_SOLAR_GOLD, 0.85);
        g.fillCircle(cx, cy, 2.2);
        break;
      }
      case 'engineer': {
        // 8-tooth cogwheel gear + volt core
        g.strokeCircle(cx, cy, 8.5);
        g.fillStyle(colorNum, 0.25);
        g.fillCircle(cx, cy, 5);
        for (let t = 0; t < 8; t++) {
          const ang = (t * Math.PI) / 4;
          g.lineStyle(2.2, colorNum, 0.82);
          g.lineBetween(
            cx + Math.cos(ang) * 8,
            cy + Math.sin(ang) * 8,
            cx + Math.cos(ang) * 12,
            cy + Math.sin(ang) * 12,
          );
        }
        break;
      }
    }
  }

  private drawEastCoopWingRunner(
    g: Phaser.GameObjects.Graphics,
    spec: SanctuaryArchitectureSpec,
  ): void {
    const er = spec.eastRunner;

    g.fillStyle(COL_INK_DEEP, 0.35);
    g.fillRect(er.x, er.y - 2, er.width + 4, er.height + 6);

    // Abyss-blue outer weave + cobalt center runner + brass trim
    g.fillStyle(COL_ABYSS_BLUE, 0.96);
    g.lineStyle(2, COL_INK_DARK, 1);
    g.fillRect(er.x, er.y, er.width, er.height);
    g.strokeRect(er.x, er.y, er.width, er.height);

    g.lineStyle(1.8, COL_BRASS_CORE, 0.9);
    g.strokeRect(er.x + 4, er.y + 4, er.width - 8, er.height - 8);

    g.fillStyle(COL_COBALT_SHADE, 0.72);
    g.fillRect(er.x + 7, er.y + 8, er.width - 14, er.height - 16);

    const midY = (er.yMin + er.yMax) * 0.5;
    for (let rx = er.xMin + 34; rx <= er.xMax - 46; rx += 42) {
      g.lineStyle(1.4, COL_SOLAR_GOLD, 0.7);
      g.lineBetween(rx - 8, midY - 7, rx + 2, midY);
      g.lineBetween(rx - 8, midY + 7, rx + 2, midY);
      g.fillStyle(COL_CYAN_FROST, 0.65);
      g.fillCircle(rx - 12, midY, 2);
    }
  }

  private drawEastCoopGuildTable(
    g: Phaser.GameObjects.Graphics,
    spec: SanctuaryArchitectureSpec,
  ): void {
    const st = spec.coopStation;
    const tx = st.x - st.width * 0.5;
    const ty = st.y - st.height * 0.5;

    // Circular flagstone alcove dais under Guild Table
    g.fillStyle(COL_SLATE_DARK, 0.82);
    g.lineStyle(1.8, COL_BRASS_CORE, 0.72);
    g.fillCircle(st.x + 4, st.y, 50);
    g.strokeCircle(st.x + 4, st.y, 50);

    // Guild Banner Arch behind East edge of table
    const archX = st.x + st.width * 0.5 + 10;
    g.fillStyle(COL_INK_DEEP, 0.45);
    g.fillRect(archX - 3, st.y - 30, 12, 60);
    // Standards & crossbar
    g.lineStyle(3.2, COL_STEEL_DARK, 1);
    g.lineBetween(archX, st.y - 28, archX, st.y + 28);
    g.fillStyle(COL_SOLAR_GOLD, 0.95);
    g.fillCircle(archX, st.y - 29, 3.5);
    g.fillCircle(archX, st.y + 29, 3.5);
    // Hanging swallowtail azure-and-gold guild banner pennant
    g.beginPath();
    g.moveTo(archX + 1, st.y - 22);
    g.lineTo(archX + 18, st.y - 18);
    g.lineTo(archX + 14, st.y);
    g.lineTo(archX + 18, st.y + 18);
    g.lineTo(archX + 1, st.y + 22);
    g.closePath();
    g.fillStyle(COL_AZURE_CORE, 0.95);
    g.fillPath();
    g.lineStyle(1.6, COL_SOLAR_GOLD, 0.92);
    g.strokePath();

    // Ornate Co-op Guild Table shadow & carved oak body
    g.fillStyle(COL_INK_DEEP, 0.5);
    g.fillRoundedRect(tx - 2, ty + 4, st.width + 4, st.height + 3, 6);

    g.fillStyle(COL_LEATHER_DARK, 0.98);
    g.lineStyle(2.2, COL_INK_DARK, 1);
    g.fillRoundedRect(tx, ty, st.width, st.height, 6);
    g.strokeRoundedRect(tx, ty, st.width, st.height, 6);

    g.fillStyle(COL_LEATHER_MID, 0.95);
    g.fillRoundedRect(tx + 4, ty + 4, st.width - 8, st.height - 8, 4);
    g.lineStyle(1.4, COL_BRASS_CORE, 0.88);
    g.strokeRoundedRect(tx + 4, ty + 4, st.width - 8, st.height - 8, 4);

    // Brass corner plates
    for (const [cx, cy] of [
      [tx + 5, ty + 5],
      [tx + st.width - 5, ty + 5],
      [tx + 5, ty + st.height - 5],
      [tx + st.width - 5, ty + st.height - 5],
    ] as const) {
      g.fillStyle(COL_SOLAR_GOLD, 0.9);
      g.fillCircle(cx, cy, 2.2);
    }

    // Unrolled tactical map scroll on tabletop + crimson wax seal
    const mapX = st.x - 16;
    const mapY = st.y - 12;
    g.fillStyle(COL_BONE_WHITE, 0.94);
    g.lineStyle(1.2, COL_LEATHER_DARK, 0.9);
    g.fillRect(mapX, mapY, 30, 24);
    g.strokeRect(mapX, mapY, 30, 24);
    // Scroll rolled edges
    g.fillStyle(COL_WARM_STONE, 0.95);
    g.fillRect(mapX - 2, mapY - 1, 4, 26);
    g.fillRect(mapX + 28, mapY - 1, 4, 26);
    // Route lines & wax seal
    g.lineStyle(1.2, COL_COBALT_SHADE, 0.78);
    g.lineBetween(mapX + 6, mapY + 7, mapX + 16, mapY + 11);
    g.lineBetween(mapX + 16, mapY + 11, mapX + 24, mapY + 6);
    g.fillStyle(COL_CRIMSON_BRIGHT, 0.95);
    g.fillCircle(mapX + 21, mapY + 17, 3);

    // Twin LAN Beacon Crystals mounted on table corners
    for (const cryY of [ty + 9, ty + st.height - 9]) {
      const cryX = tx + 11;
      g.fillStyle(COL_BRASS_CORE, 0.95);
      g.fillCircle(cryX, cryY, 5.5);
      g.fillStyle(COL_AZURE_CORE, 0.96);
      g.lineStyle(1.2, COL_INK_DARK, 1);
      g.fillTriangle(cryX, cryY - 6, cryX + 5, cryY + 2, cryX - 5, cryY + 2);
      g.strokeTriangle(cryX, cryY - 6, cryX + 5, cryY + 2, cryX - 5, cryY + 2);
      g.fillStyle(COL_ICE_WHITE, 0.9);
      g.fillCircle(cryX, cryY - 1.5, 1.8);
    }
  }

  private drawWestArmoryWing(
    g: Phaser.GameObjects.Graphics,
    spec: SanctuaryArchitectureSpec,
  ): void {
    const ww = spec.westWalkway;
    const sr = spec.shootingRange;

    // 1. West Slate Flagstone Walkway framing Shooting Range & Weapon Rack
    g.fillStyle(COL_SLATE_DARK, 0.72);
    g.lineStyle(1.8, COL_INK_DARK, 0.88);
    g.fillRoundedRect(ww.x, ww.y, ww.width, ww.height, 8);
    g.strokeRoundedRect(ww.x, ww.y, ww.width, ww.height, 8);

    g.lineStyle(1.2, COL_STEEL_DARK, 0.55);
    g.strokeRoundedRect(ww.x + 4, ww.y + 4, ww.width - 8, ww.height - 8, 6);

    // Subtle horizontal slate masonry seams + firing-line stripe between range and rack
    for (let sy = ww.y + 56; sy < ww.y + ww.height - 24; sy += 56) {
      g.lineStyle(1, COL_INK_DARK, 0.45);
      g.lineBetween(ww.x + 8, sy, ww.x + ww.width - 8, sy);
    }
    const firingLineY = sr.y + 62;
    g.lineStyle(2, COL_BRASS_CORE, 0.65);
    g.lineBetween(ww.x + 14, firingLineY, ww.x + ww.width - 14, firingLineY);

    // 2. Concentric Painted Bullseye Range Rings at (236, 236)
    const [rOuter, rMid, rInner] = sr.rings;
    g.fillStyle(COL_SLATE_MID, 0.65);
    g.fillCircle(sr.x, sr.y, rOuter);
    g.lineStyle(2.2, COL_BONE_WHITE, 0.55);
    g.strokeCircle(sr.x, sr.y, rOuter);

    g.lineStyle(2.2, COL_CRIMSON_BRIGHT, 0.65);
    g.strokeCircle(sr.x, sr.y, rMid);

    g.fillStyle(COL_RUBY_DARK, 0.55);
    g.fillCircle(sr.x, sr.y, rInner);
    g.lineStyle(2, COL_SOLAR_GOLD, 0.78);
    g.strokeCircle(sr.x, sr.y, rInner);

    // Cardinal rangefinder crosshair ticks
    g.lineStyle(1.4, COL_BONE_WHITE, 0.5);
    g.lineBetween(sr.x - rOuter - 5, sr.y, sr.x - rOuter + 5, sr.y);
    g.lineBetween(sr.x + rOuter - 5, sr.y, sr.x + rOuter + 5, sr.y);
    g.lineBetween(sr.x, sr.y - rOuter - 5, sr.x, sr.y - rOuter + 5);
    g.lineBetween(sr.x, sr.y + rOuter - 5, sr.x, sr.y + rOuter + 5);

    // 3. 4 Dark-Iron & Oak Weapon Display Pedestals at (206/326, 404/488)
    for (let i = 0; i < spec.rackStands.length; i++) {
      const stand = spec.rackStands[i]!;
      const px = stand.x - stand.width * 0.5;
      const py = stand.y - stand.height * 0.5 + 4;

      g.fillStyle(COL_INK_DEEP, 0.48);
      g.fillRoundedRect(px - 2, py + 3, stand.width + 4, stand.height + 2, 5);

      // Dark-iron outer frame
      g.fillStyle(COL_SLATE_DARK, 0.98);
      g.lineStyle(2, COL_INK_DARK, 1);
      g.fillRoundedRect(px, py, stand.width, stand.height, 5);
      g.strokeRoundedRect(px, py, stand.width, stand.height, 5);

      // Warm oak inner bevel
      g.fillStyle(COL_LEATHER_MID, 0.94);
      g.fillRoundedRect(px + 4, py + 4, stand.width - 8, stand.height - 8, 3);

      // Velvet crimson weapon rest cushion
      g.fillStyle(COL_RUBY_DARK, 0.92);
      g.fillRoundedRect(px + 8, py + 7, stand.width - 16, stand.height - 15, 2);

      // Iron corner rivets & front brass plaque
      g.fillStyle(COL_STEEL_LIGHT, 0.85);
      g.fillCircle(px + 4, py + 4, 1.4);
      g.fillCircle(px + stand.width - 4, py + 4, 1.4);
      g.fillStyle(COL_BRASS_CORE, 0.92);
      g.fillRect(stand.x - 8, py + stand.height - 5, 16, 3);
    }
  }

  private drawSoutheastCodexLectern(
    g: Phaser.GameObjects.Graphics,
    spec: SanctuaryArchitectureSpec,
  ): void {
    const cs = spec.codexStation;
    const lx = cs.x - cs.width * 0.5;
    const ly = cs.y - cs.height * 0.5;

    // Warm circular scholar's rug beneath the lectern
    g.fillStyle(COL_INK_DEEP, 0.38);
    g.fillCircle(cs.x, cs.y + 3, 41);
    g.fillStyle(COL_RUBY_DARK, 0.88);
    g.lineStyle(2, COL_INK_DARK, 1);
    g.fillCircle(cs.x, cs.y + 1, 39);
    g.strokeCircle(cs.x, cs.y + 1, 39);
    g.lineStyle(1.6, COL_BRASS_CORE, 0.85);
    g.strokeCircle(cs.x, cs.y + 1, 34);

    // Carved walnut/oak Chronicler's Lectern desk
    g.fillStyle(COL_INK_DEEP, 0.5);
    g.fillRoundedRect(lx - 2, ly + 4, cs.width + 4, cs.height + 2, 5);

    g.fillStyle(COL_LEATHER_DARK, 0.98);
    g.lineStyle(2.2, COL_INK_DARK, 1);
    g.fillRoundedRect(lx, ly, cs.width, cs.height, 5);
    g.strokeRoundedRect(lx, ly, cs.width, cs.height, 5);

    g.fillStyle(COL_LEATHER_MID, 0.95);
    g.fillRoundedRect(lx + 4, ly + 4, cs.width - 8, cs.height - 8, 3);
    g.lineStyle(1.2, COL_BRASS_CORE, 0.82);
    g.strokeRoundedRect(lx + 4, ly + 4, cs.width - 8, cs.height - 8, 3);

    // Open Gold-Leaf Tome centered on the lectern
    const bookW = 28;
    const bookH = 20;
    const bx = cs.x - bookW * 0.5 - 3;
    const by = cs.y - bookH * 0.5;

    // Leather cover & gold-leaf trim
    g.fillStyle(COL_RUBY_CORE, 0.98);
    g.lineStyle(1.5, COL_INK_DARK, 1);
    g.fillRect(bx - 2, by - 2, bookW + 4, bookH + 4);
    g.strokeRect(bx - 2, by - 2, bookW + 4, bookH + 4);

    // Left & right parchment pages
    g.fillStyle(COL_BONE_WHITE, 0.96);
    g.fillRect(bx, by, bookW * 0.5 - 1, bookH);
    g.fillRect(bx + bookW * 0.5 + 1, by, bookW * 0.5 - 1, bookH);

    // Gold-leaf illuminated border & crimson bookmark ribbon
    g.lineStyle(1.2, COL_SOLAR_GOLD, 0.9);
    g.strokeRect(bx + 1, by + 1, bookW - 2, bookH - 2);
    g.fillStyle(COL_SOLAR_GOLD, 0.95);
    g.fillRect(bx + 3, by + 3, 4, 4);
    g.lineStyle(1, COL_SLATE_MID, 0.65);
    g.lineBetween(bx + 3, by + 10, bx + 11, by + 10);
    g.lineBetween(bx + 3, by + 14, bx + 10, by + 14);
    g.lineBetween(bx + 16, by + 6, bx + 25, by + 6);
    g.lineBetween(bx + 16, by + 10, bx + 25, by + 10);
    g.lineBetween(bx + 16, by + 14, bx + 23, by + 14);
    g.lineStyle(2, COL_CRIMSON_BRIGHT, 0.95);
    g.lineBetween(bx + bookW * 0.5, by + bookH - 2, bx + bookW * 0.5 + 2, by + bookH + 6);

    // Brass candlestick & warm wax taper candle at top-right corner of lectern
    const candleX = cs.x + 19;
    const candleY = cs.y - 10;
    g.fillStyle(COL_BRASS_CORE, 0.98);
    g.lineStyle(1.2, COL_INK_DARK, 1);
    g.fillCircle(candleX, candleY + 3, 4.2);
    g.strokeCircle(candleX, candleY + 3, 4.2);
    g.fillStyle(COL_BONE_WHITE, 0.98);
    g.fillRect(candleX - 2, candleY - 5, 4, 8);
  }

  private drawDynamicEffects(
    g: Phaser.GameObjects.Graphics,
    spec: SanctuaryArchitectureSpec,
    visualTimeSec: number,
  ): void {
    g.clear();

    const hx = spec.hearth.x;
    const hy = spec.hearth.y;

    // 1. Central Hearth Roaring Multi-Layered Flames & Rising Embers around (576, 352)
    const hearthPulse = 0.5 + 0.5 * Math.sin(visualTimeSec * 4.6);
    g.fillStyle(COL_FLAME_ORANGE, 0.16 + 0.05 * hearthPulse);
    g.fillCircle(hx, hy - 2, 26 + 3 * hearthPulse);

    for (let t = 0; t < 5; t++) {
      const sway = Math.sin(visualTimeSec * (5.2 + t * 0.7) + t * 1.35) * 3.5;
      const ox = (t - 2) * 4.5;
      const height = (t === 2 ? 24 : t === 1 || t === 3 ? 19 : 14) + Math.cos(visualTimeSec * 6.4 + t) * 2.5;
      const halfW = t === 2 ? 9 : 6.5;

      g.fillStyle(t % 2 === 0 ? COL_FLAME_ORANGE : COL_MAGMA_RED, 0.82);
      g.fillTriangle(
        hx + ox + sway,
        hy - height,
        hx + ox - halfW,
        hy + 4,
        hx + ox + halfW,
        hy + 4,
      );
    }

    const coreSway = Math.sin(visualTimeSec * 7.1) * 2.2;
    g.fillStyle(COL_SOLAR_GOLD, 0.9);
    g.fillTriangle(hx + coreSway, hy - 17, hx - 6, hy + 3, hx + 6, hy + 3);
    g.fillStyle(COL_VOLT_YELLOW, 0.95);
    g.fillCircle(hx + coreSway * 0.4, hy - 3, 4.2 + 0.6 * hearthPulse);

    // Rising deterministic embers around the hearth
    for (let e = 0; e < 8; e++) {
      const cycle = (visualTimeSec * (0.55 + (e % 3) * 0.12) + e * 0.137) % 1;
      const angle = e * 0.82 + Math.sin(visualTimeSec * 1.8 + e) * 0.35;
      const radial = 6 + (e % 4) * 5 + cycle * 12;
      const ex = hx + Math.cos(angle) * radial;
      const ey = hy - 4 - cycle * 38;
      const emberAlpha = clamp(Math.sin(cycle * Math.PI) * 0.85, 0, 0.85);
      const emberR = 1.2 + (1 - cycle) * 1.4;
      g.fillStyle(e % 2 === 0 ? COL_SOLAR_GOLD : COL_FLAME_ORANGE, emberAlpha);
      g.fillCircle(ex, ey, emberR);
    }

    // 2. North Gate Threshold Rune Shimmer at (576, 122)
    const dais = spec.portalDais;
    const runePulse = 0.5 + 0.5 * Math.sin(visualTimeSec * 2.8);
    g.lineStyle(1.5, COL_SOLAR_GOLD, 0.22 + 0.22 * runePulse);
    g.strokeCircle(dais.x, dais.y, dais.midRadius - 6);

    // 3. East Co-op Guild Table Azure Beacon Pulse at (928, 352)
    const coop = spec.coopStation;
    const tx = coop.x - coop.width * 0.5;
    const ty = coop.y - coop.height * 0.5;
    const beaconWave = (visualTimeSec * 0.75) % 1;
    const ringRadius = 10 + beaconWave * 28;
    const ringAlpha = clamp((1 - beaconWave) * 0.42, 0, 0.42);
    g.lineStyle(1.6, COL_CYAN_FROST, ringAlpha);
    g.strokeCircle(coop.x, coop.y, ringRadius);

    const crystalPulse = 0.5 + 0.5 * Math.sin(visualTimeSec * 3.6);
    for (const cryY of [ty + 9, ty + coop.height - 9]) {
      const cryX = tx + 11;
      g.fillStyle(COL_CYAN_FROST, 0.22 + 0.18 * crystalPulse);
      g.fillCircle(cryX, cryY - 1, 7 + 2 * crystalPulse);
    }

    // 4. South-East Chronicler's Lectern Warm Candle Glow at (860, 520)
    const codex = spec.codexStation;
    const candleX = codex.x + 19;
    const candleY = codex.y - 10;
    const candleFlicker = Math.sin(visualTimeSec * 8.4) * 0.5 + Math.cos(visualTimeSec * 5.1) * 0.5;
    const flameTipX = candleX + candleFlicker * 1.4;

    g.fillStyle(COL_SOLAR_GOLD, 0.16 + 0.05 * Math.abs(candleFlicker));
    g.fillCircle(candleX, candleY - 7, 13 + candleFlicker * 1.5);
    g.fillStyle(COL_FLAME_ORANGE, 0.9);
    g.fillTriangle(flameTipX, candleY - 12, candleX - 2.3, candleY - 5, candleX + 2.3, candleY - 5);
    g.fillStyle(COL_VOLT_YELLOW, 0.95);
    g.fillCircle(candleX + candleFlicker * 0.4, candleY - 7, 1.4);
  }
}
