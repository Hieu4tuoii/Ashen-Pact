import Phaser from 'phaser';
import { VIETNAMESE_VERIFICATION_STRING } from '@ashen-pact/shared';
import { PALETTE } from '../art/palette.js';
import { TextureBaker } from '../art/texture-baker.js';
import {
  isEffectiveDebugUiEnabled,
  isTestHooksEnabled,
  onDebugFlagsChanged,
} from '../core/debug-flag.js';
import { getVisualQueryConfig } from '../core/visual-query.js';
import { type GraphicsQualityTier, graphicsSettings } from './graphics-settings.js';

export interface GameDebugState {
  fps: number;
  frameTimeMs: number;
  entityCount: number;
  bulletCount: number;
  drawCalls: number;
  pingMs: number;
  tick: number;
  seed: number;
  scene: string;
  animState: 'idle' | 'run';
  playerSlot: 1 | 2 | 3 | 4;
  biome: 1 | 2 | 3;
  dpr: number;
  bakeScale: number;
  overlayVisible: boolean;
  serverConnected: boolean;
  fontsLoaded: boolean;
  vietnameseSampleText: string;
  // Phase 1 Gameplay & Feel telemetry
  playerX: number;
  playerY: number;
  playerVx: number;
  playerVy: number;
  playerHp: number;
  playerMaxHp: number;
  playerArmor: number;
  playerMaxArmor: number;
  playerEnergy: number;
  playerMaxEnergy: number;
  activeWeaponId: string;
  activeWeaponSlot: number;
  godMode: boolean;
  showHitboxes: boolean;
  damagePopupCount: number;
  totalDamagePopupsSpawned: number;
  totalSparksSpawned: number;
  totalHitStopsTriggered: number;
  totalShakesTriggered: number;
  sfxPlayedCount: number;
  lastSfxId: string | null;
  rollingDps: number;
  cameraCenterX: number;
  cameraCenterY: number;
  // Phase 2 Graphics, Lighting & Map Interactions telemetry
  graphicsQuality: GraphicsQualityTier;
  autoQuality: boolean;
  autoDowngradeCount: number;
  activeLightCount: number;
  decalCount: number;
  particleCount: number;
  afterimageCount: number;
  ambientParticleCount: number;
  propCount: number;
  destructiblePropCount: number;
  activeImbueElement: string;
  stressTestActive: boolean;
  heapUsedMb: number;
  // Phase 3 Dungeon, Biome 1 & Boss telemetry
  currentFloor: number;
  currentRoomId: number;
  currentRoomType: string;
  totalRooms: number;
  playerGold: number;
  runState: 'playing' | 'buff_choice' | 'victory' | 'defeat';
  bossActive: boolean;
  bossPhase: number;
  bossHp: number;
  bossMaxHp: number;
  fullMapOpen: boolean;
  botAutoPlayActive: boolean;
  activeBuffs: string[];
  // Phase 4 Co-op LAN & Network telemetry
  coopMode: 'solo' | 'host' | 'join';
  coopRoomId: string | null;
  coopPlayerCount: number;
  inHub: boolean;
  rttMs: number;
  jitterMs: number;
  bandwidthKBps: number;
  interpolationDelayMs: number;
  wifiProfile: 'off' | 'good' | 'normal' | 'bad';
  reconnectToken: string | null;
  hostInviteUrl: string | null;
  lanIps: string[];
  // Phase 5 Characters, Elemental Reactions & Synergy telemetry
  playerCharacterId: string;
  teamComboCount: number;
  elementalReactions: number;
  activeSummonCount: number;
  activeSkillZoneCount: number;
  hubPreviewCharacterId: string | null;
  // Phase 6 Biomes 2 & 3 + Bosses + Co-op Mechanics telemetry
  currentBiome: 1 | 2 | 3;
  bossDefId: string | null;
  blizzardVeilActive: boolean;
  conveyorDirection: 1 | -1;
  pressurePlatesSolved: boolean;
  pressurePlateCount: number;
  shockwaveRingCount: number;
  tetherBeamCount: number;
  galleryPage: number;
  // Phase 7 UI/UX, i18n, Modals, HUD & Dynamic Audio telemetry
  language: 'vi' | 'en';
  pauseModalOpen: boolean;
  settingsModalOpen: boolean;
  controlsModalOpen: boolean;
  creditsModalOpen: boolean;
  weaponComparisonVisible: boolean;
  comparedWeaponId: string | null;
  emoteWheelOpen: boolean;
  irisTransitionProgress: number;
  trailingHpRatio: number;
  trailingArmorRatio: number;
  musicTheme: string;
  musicCombatMix: number;
  mvpAwardsCount: number;
  lastDebugRejected: string | null;
  errors: string[];
  warnings: string[];
}

declare global {
  interface Window {
    __GAME_DEBUG__: GameDebugState;
  }
}

let rawDebugState: GameDebugState | null = null;
let readOnlyDebugProxy: GameDebugState | null = null;
let windowDebugSubscribed = false;

export function syncWindowDebugAccess(): void {
  if (typeof window === 'undefined' || !rawDebugState || !readOnlyDebugProxy) return;
  try {
    Object.defineProperty(window, '__GAME_DEBUG__', {
      configurable: true,
      enumerable: true,
      get: () => (isTestHooksEnabled() ? rawDebugState! : readOnlyDebugProxy!),
      set: () => {
        // Ignore external overwrites of window.__GAME_DEBUG__
      },
    });
  } catch {
    // Ignore defineProperty errors in non-standard environments
  }
}

export function initGlobalDebugState(): GameDebugState {
  if (rawDebugState) {
    if (typeof window !== 'undefined' && window.location.search.includes('seed=')) {
      rawDebugState.seed = getVisualQueryConfig().seed;
    }
    syncWindowDebugAccess();
    return rawDebugState;
  }

  const gState = graphicsSettings.getState();
  const state: GameDebugState = {
    fps: 60,
    frameTimeMs: 16.67,
    entityCount: 0,
    bulletCount: 0,
    drawCalls: 1,
    pingMs: 0,
    tick: 0,
    seed: getVisualQueryConfig().seed,
    scene: 'BootScene',
    animState: 'idle',
    playerSlot: 1,
    biome: 1,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    bakeScale: 4,
    overlayVisible: false,
    serverConnected: false,
    fontsLoaded: false,
    vietnameseSampleText: VIETNAMESE_VERIFICATION_STRING,
    playerX: 0,
    playerY: 0,
    playerVx: 0,
    playerVy: 0,
    playerHp: 8,
    playerMaxHp: 8,
    playerArmor: 6,
    playerMaxArmor: 6,
    playerEnergy: 150,
    playerMaxEnergy: 150,
    activeWeaponId: 'knight_sword',
    activeWeaponSlot: 0,
    godMode: false,
    showHitboxes: false,
    damagePopupCount: 0,
    totalDamagePopupsSpawned: 0,
    totalSparksSpawned: 0,
    totalHitStopsTriggered: 0,
    totalShakesTriggered: 0,
    sfxPlayedCount: 0,
    lastSfxId: null,
    rollingDps: 0,
    cameraCenterX: 480,
    cameraCenterY: 270,
    graphicsQuality: gState.quality,
    autoQuality: gState.autoQuality,
    autoDowngradeCount: graphicsSettings.autoDowngradeCount,
    activeLightCount: 0,
    decalCount: 0,
    particleCount: 0,
    afterimageCount: 0,
    ambientParticleCount: 0,
    propCount: 0,
    destructiblePropCount: 0,
    activeImbueElement: 'none',
    stressTestActive: false,
    heapUsedMb: 0,
    currentFloor: 1,
    currentRoomId: 0,
    currentRoomType: 'start',
    totalRooms: 9,
    playerGold: 0,
    runState: 'playing',
    bossActive: false,
    bossPhase: 1,
    bossHp: 0,
    bossMaxHp: 0,
    fullMapOpen: false,
    botAutoPlayActive: false,
    activeBuffs: [],
    coopMode: 'solo',
    coopRoomId: null,
    coopPlayerCount: 1,
    inHub: false,
    rttMs: 0,
    jitterMs: 0,
    bandwidthKBps: 0,
    interpolationDelayMs: 65,
    wifiProfile: 'off',
    reconnectToken: null,
    hostInviteUrl: null,
    lanIps: [],
    playerCharacterId: 'vanguard',
    teamComboCount: 0,
    elementalReactions: 0,
    activeSummonCount: 0,
    activeSkillZoneCount: 0,
    hubPreviewCharacterId: null,
    currentBiome: 1,
    bossDefId: null,
    blizzardVeilActive: false,
    conveyorDirection: 1,
    pressurePlatesSolved: false,
    pressurePlateCount: 0,
    shockwaveRingCount: 0,
    tetherBeamCount: 0,
    galleryPage: 1,
    language: gState.language,
    pauseModalOpen: false,
    settingsModalOpen: false,
    controlsModalOpen: false,
    creditsModalOpen: false,
    weaponComparisonVisible: false,
    comparedWeaponId: null,
    emoteWheelOpen: false,
    irisTransitionProgress: 0,
    trailingHpRatio: 1,
    trailingArmorRatio: 1,
    musicTheme: 'menu_hub',
    musicCombatMix: 0,
    mvpAwardsCount: 0,
    lastDebugRejected: null,
    errors: [],
    warnings: [],
  };

  rawDebugState = state;
  readOnlyDebugProxy = new Proxy(state, {
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  });

  if (typeof window !== 'undefined') {
    syncWindowDebugAccess();
    if (!windowDebugSubscribed) {
      windowDebugSubscribed = true;
      onDebugFlagsChanged(() => {
        syncWindowDebugAccess();
      });
    }

    const origError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      state.errors.push(args.map((a) => String(a)).join(' '));
      origError(...args);
    };

    const origWarn = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
      state.warnings.push(args.map((a) => String(a)).join(' '));
      origWarn(...args);
    };

    window.addEventListener('error', (ev) => {
      state.errors.push(ev.message || 'Unhandled window error');
    });
    window.addEventListener('unhandledrejection', (ev) => {
      state.errors.push(String(ev.reason || 'Unhandled promise rejection'));
    });
  }

  return state;
}

/**
 * F1 Debug Overlay displaying FPS, frame time, entities, bullets, draw calls, ping, tick, and combat stats.
 */
export class DebugOverlay {
  private readonly scene: Phaser.Scene;
  private readonly uiScene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly textObj: Phaser.GameObjects.Text;
  private readonly frameDeltaSamples: number[] = [];
  private warmupFrames = 0;
  private onKeyDown?: (ev: KeyboardEvent) => void;
  private unsubDebugFlags?: () => void;

  constructor(scene: Phaser.Scene, startVisible = false, uiScene: Phaser.Scene = scene) {
    this.scene = scene;
    this.uiScene = uiScene;
    const state = initGlobalDebugState();
    const canShow = isEffectiveDebugUiEnabled(state.coopMode !== 'solo');
    state.overlayVisible = canShow ? startVisible : false;

    this.container = this.uiScene.add.container(16, 76);
    this.container.setDepth(9999);

    this.bg = this.uiScene.add.graphics();
    this.bg.fillStyle(0x0b090e, 0.92);
    this.bg.lineStyle(2, 0x38bdf8, 0.95);
    this.bg.fillRoundedRect(0, 0, 368, 224, 8);
    this.bg.strokeRoundedRect(0, 0, 368, 224, 8);

    this.textObj = this.uiScene.add.text(12, 10, '', {
      fontFamily: '"Be Vietnam Pro", monospace',
      fontSize: '11px',
      color: PALETTE.BONE_WHITE,
      lineSpacing: 4,
      resolution: Math.min(2, TextureBaker.getBakeScale()),
    });

    this.container.add([this.bg, this.textObj]);
    this.container.setVisible(state.overlayVisible);

    this.unsubDebugFlags = onDebugFlagsChanged(() => {
      if (!isEffectiveDebugUiEnabled(state.coopMode !== 'solo')) {
        state.overlayVisible = false;
        this.container.setVisible(false);
      }
    });

    if (typeof window !== 'undefined') {
      this.onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === 'F1' || ev.code === 'F1') {
          ev.preventDefault();
          if (!this.scene.scene.isActive()) return;
          if (!isEffectiveDebugUiEnabled(state.coopMode !== 'solo')) return;
          state.overlayVisible = !state.overlayVisible;
          this.container.setVisible(state.overlayVisible);
        }
      };
      window.addEventListener('keydown', this.onKeyDown);
    }

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.destroy();
    });
  }

  public refreshResolution(bakeScale: number): void {
    this.textObj.setResolution(Math.min(2, bakeScale));
    this.resetSamples();
  }

  public resetSamples(): void {
    this.frameDeltaSamples.length = 0;
    this.warmupFrames = 0;
  }

  public destroy(): void {
    if (this.onKeyDown && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      this.onKeyDown = undefined;
    }
    if (this.unsubDebugFlags) {
      this.unsubDebugFlags();
      this.unsubDebugFlags = undefined;
    }
  }

  public update(params: {
    entityCount: number;
    bulletCount: number;
    tick: number;
    pingMs?: number;
  }): void {
    const state = initGlobalDebugState();
    if (!isEffectiveDebugUiEnabled(state.coopMode !== 'solo')) {
      state.overlayVisible = false;
      if (this.container.visible) {
        this.container.setVisible(false);
      }
    }
    const loop = this.scene.game.loop;
    const rawDelta = loop.delta > 0 ? loop.delta : 16.67;

    const isHidden = typeof document !== 'undefined' && document.hidden;
    this.warmupFrames += 1;
    // Ignore scene-init/resize warmup frames and background-throttled frames
    if (!isHidden && this.warmupFrames > 10 && rawDelta < 45) {
      this.frameDeltaSamples.push(rawDelta);
      if (this.frameDeltaSamples.length > 30) {
        this.frameDeltaSamples.shift();
      }
    }

    const avgDelta =
      this.frameDeltaSamples.length > 0
        ? this.frameDeltaSamples.reduce((acc, v) => acc + v, 0) / this.frameDeltaSamples.length
        : 16.67;

    const computedFps = Math.min(144, 1000 / Math.max(1, avgDelta));
    state.fps = Math.round(computedFps * 10) / 10;
    state.frameTimeMs = Math.round(avgDelta * 100) / 100;

    if (state.coopMode === 'solo' && !isHidden && this.warmupFrames > 15 && rawDelta < 120) {
      graphicsSettings.updateAutoQualityMonitor(state.fps, Math.min(0.05, rawDelta / 1000));
    }
    const gState = graphicsSettings.getState();
    state.graphicsQuality = gState.quality;
    state.autoQuality = gState.autoQuality;
    state.autoDowngradeCount = graphicsSettings.autoDowngradeCount;

    const perfMem = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
    if (perfMem && typeof perfMem.usedJSHeapSize === 'number') {
      state.heapUsedMb = Math.round((perfMem.usedJSHeapSize / (1024 * 1024)) * 100) / 100;
    }

    state.entityCount = params.entityCount;
    state.bulletCount = params.bulletCount;
    state.tick = params.tick;
    if (params.pingMs !== undefined) {
      state.pingMs = params.pingMs;
    }
    state.scene = this.scene.scene.key;
    state.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    state.bakeScale = TextureBaker.getBakeScale();

    const renderer = this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer & {
      drawCount?: number;
    };
    state.drawCalls =
      typeof renderer?.drawCount === 'number' && renderer.drawCount > 0
        ? renderer.drawCount
        : Math.max(1, Math.ceil(this.scene.children.length / 4));

    if (this.container.visible) {
      const view = this.uiScene.cameras.main.worldView;
      if (view && view.width > 0) {
        this.container.setPosition(view.x + 16, view.y + 76);
      }
      const textInterval = state.stressTestActive ? 30 : 6;
      if (
        this.warmupFrames % textInterval === 1 ||
        this.textObj.text.length === 0 ||
        !this.textObj.text.includes(`Quality[G]: ${state.graphicsQuality.toUpperCase()}`)
      ) {
        this.textObj.setText(
          [
            `[F1] DEBUG OVERLAY — ${state.scene} (${state.coopMode.toUpperCase()} ${state.coopPlayerCount}P)`,
            `FPS: ${state.fps.toFixed(1)} (${state.frameTimeMs.toFixed(2)} ms) | DPS: ${state.rollingDps.toFixed(1)}`,
            `Entities: ${state.entityCount} | Bullets: ${state.bulletCount} | Props: ${state.propCount}`,
            `Quality[G]: ${state.graphicsQuality.toUpperCase()} (Auto:${state.autoQuality ? 'ON' : 'OFF'}) | Lights: ${state.activeLightCount}`,
            `Particles: ${state.particleCount} | Decals: ${state.decalCount} | Heap: ${state.heapUsedMb.toFixed(1)} MB`,
            `Draw Calls: ${state.drawCalls} | Bake: ${state.bakeScale}x (DPR ${state.dpr.toFixed(2)})`,
            `Net[F9]: ${state.wifiProfile.toUpperCase()} | RTT: ${state.rttMs}±${state.jitterMs}ms | BW: ${state.bandwidthKBps}KB/s | Interp: ${state.interpolationDelayMs}ms`,
            `Weapon: ${state.activeWeaponId} (${state.activeImbueElement}) | Stress[F7]: ${state.stressTestActive ? 'ON' : 'OFF'}`,
            `God[F2]: ${state.godMode ? 'ON' : 'OFF'} | Hitbox[F4]: ${state.showHitboxes ? 'ON' : 'OFF'} | Tick: ${state.tick}`,
            `Errors: ${state.errors.length} | Warnings: ${state.warnings.length}`,
          ].join('\n'),
        );
      }
    }
  }
}
