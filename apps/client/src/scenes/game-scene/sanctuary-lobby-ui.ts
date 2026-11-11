import {
  CHARACTERS,
  type CharacterId,
  clamp,
  i18n,
  VIETNAMESE_VERIFICATION_STRING,
  WORLD_VIEW_WIDTH,
} from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { zzfx } from '../../audio/zzfx.js';
import { isEffectiveDebugUiEnabled } from '../../core/debug-flag.js';
import { getVisualQueryConfig } from '../../core/visual-query.js';
import { drawStyledPanel } from '../../ui/components/hud-primitives.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import {
  applyMenuInputEdit,
  MENU_IP_MAX_LEN,
  MENU_NAME_MAX_LEN,
  MenuDomInputOverlay,
  type MenuInputBoxBounds,
  type MenuInputFieldId,
} from '../../ui/html-input-overlay.js';
import { computeUiTextResolution, createUiTextStyle, UI_THEME } from '../../ui/theme.js';
import type { GameScene, GameSceneInitData } from '../GameScene.js';

export const SANCTUARY_VERSION_BADGE = 'v2.0.0 · LAN';

export const PRESET_NAMES_VI = [
  'Hiệp Sĩ Tro',
  'Cung Thủ Gió',
  'Pháp Sư Lửa',
  'Hiền Nhân Rừng',
  'Kỹ Sư Thép',
] as const;

export const SOLO_COOP_DRAWER_W = 304;
export const SOLO_COOP_DRAWER_H = 212;
export const SOLO_COOP_DRAWER_MARGIN_RIGHT = 12;
export const SOLO_COOP_DRAWER_X = -SOLO_COOP_DRAWER_MARGIN_RIGHT - SOLO_COOP_DRAWER_W;
export const SOLO_COOP_DRAWER_Y = 144;

/**
 * Local coordinates inside `hudTopRightContainer` (origin at `WORLD_VIEW_WIDTH + padX, -padY`)
 * for the Solo Co-op LAN Guild Drawer's Name and IP input boxes.
 */
export const SOLO_COOP_INPUT_LOCAL_BOUNDS: Record<MenuInputFieldId, MenuInputBoxBounds> = {
  name: { cx: -164, cy: 206, w: 280, h: 28 },
  ip: { cx: -164, cy: 260, w: 280, h: 28 },
};

function isTruthyQueryParam(val: string | null): boolean {
  if (!val) return false;
  const trimmed = val.trim().toLowerCase();
  return trimmed !== '' && trimmed !== '0' && trimmed !== 'false';
}

/**
 * Resolves the initial boot scene and `GameSceneInitData` directly into the Living Sanctuary
 * (`{ coopMode: 'solo', startInHub: true }`) while preserving privileged ArtGalleryScene,
 * combat test shortcuts (`?scene=game`, `?biome=...`), and LAN Co-op URL invites.
 */
export function resolveBootGameSceneInitData(
  search: string,
  allowSceneShortcuts: boolean,
): { targetScene: 'GameScene' | 'ArtGalleryScene'; initData?: GameSceneInitData } {
  const params = new URLSearchParams(search);
  const requestedScene = params.get('scene')?.toLowerCase();
  const coopParam = params.get('coop')?.toLowerCase();
  const joinRoomId = params.get('join');
  const hubParam = params.get('hub');
  const galleryParam = params.get('gallery');

  if (requestedScene === 'gallery' || requestedScene === 'artgallery' || galleryParam === '1') {
    if (allowSceneShortcuts) {
      return { targetScene: 'ArtGalleryScene' };
    }
    return { targetScene: 'GameScene', initData: { coopMode: 'solo', startInHub: true } };
  }

  if (requestedScene === 'menu') {
    return { targetScene: 'GameScene', initData: { coopMode: 'solo', startInHub: true } };
  }

  if (coopParam === 'host' || coopParam === 'join' || joinRoomId) {
    return {
      targetScene: 'GameScene',
      initData: {
        coopMode: coopParam === 'host' ? 'host' : 'join',
        roomId: joinRoomId ?? undefined,
        displayName: params.get('name') ?? undefined,
        serverUrl: params.get('server') ?? undefined,
        startInHub: true,
      },
    };
  }

  if (
    allowSceneShortcuts &&
    hubParam !== '1' &&
    (requestedScene === 'game' || params.has('biome'))
  ) {
    return { targetScene: 'GameScene', initData: { coopMode: 'solo', startInHub: false } };
  }

  return { targetScene: 'GameScene', initData: { coopMode: 'solo', startInHub: true } };
}

/**
 * Resolves `GameScene.startInHub` from explicit scene restart/start `initData` first,
 * falling back to URL boot routing only when `data?.startInHub` is omitted.
 */
export function resolveGameSceneStartInHub(
  data: GameSceneInitData | undefined,
  search: string | undefined,
  allowSceneShortcuts: boolean,
): boolean {
  if (typeof data?.startInHub === 'boolean') {
    return data.startInHub;
  }
  if (typeof search === 'string') {
    const bootRoute = resolveBootGameSceneInitData(search, allowSceneShortcuts);
    return bootRoute.initData?.startInHub ?? true;
  }
  return true;
}

/**
 * Returns `false` when automated test/visual-freeze query parameters (`freeze`, `test`, `testHooks`)
 * are truthy so automated suites deterministically spawn on `'vanguard'`.
 */
export function shouldRestoreSavedCharacter(search: string): boolean {
  const params = new URLSearchParams(search);
  if (
    isTruthyQueryParam(params.get('freeze')) ||
    isTruthyQueryParam(params.get('test')) ||
    isTruthyQueryParam(params.get('testHooks'))
  ) {
    return false;
  }
  return true;
}

export function resolveSavedSanctuaryCharacter(search: string): CharacterId | null {
  if (!shouldRestoreSavedCharacter(search)) {
    return null;
  }
  try {
    const raw =
      typeof window !== 'undefined' ? window.localStorage?.getItem('ashen_pact_character') : null;
    if (raw && Object.prototype.hasOwnProperty.call(CHARACTERS, raw)) {
      return raw as CharacterId;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

/**
 * Maps the Solo Co-op Drawer's Name & IP boxes inside `hudTopRightContainer`
 * (`WORLD_VIEW_WIDTH + padX, -padY`, scaled by `uiScale`) into 960x540 design-space bounds.
 */
export function computeSanctuaryCoopInputBounds(
  uiScale: number,
  padX: number,
  padY: number,
): Record<MenuInputFieldId, MenuInputBoxBounds> {
  const s = uiScale > 0 ? uiScale : 1;
  const anchorX = WORLD_VIEW_WIDTH + padX;
  const anchorY = -padY;

  return {
    name: {
      cx: anchorX + SOLO_COOP_INPUT_LOCAL_BOUNDS.name.cx * s,
      cy: anchorY + SOLO_COOP_INPUT_LOCAL_BOUNDS.name.cy * s,
      w: SOLO_COOP_INPUT_LOCAL_BOUNDS.name.w * s,
      h: SOLO_COOP_INPUT_LOCAL_BOUNDS.name.h * s,
    },
    ip: {
      cx: anchorX + SOLO_COOP_INPUT_LOCAL_BOUNDS.ip.cx * s,
      cy: anchorY + SOLO_COOP_INPUT_LOCAL_BOUNDS.ip.cy * s,
      w: SOLO_COOP_INPUT_LOCAL_BOUNDS.ip.w * s,
      h: SOLO_COOP_INPUT_LOCAL_BOUNDS.ip.h * s,
    },
  };
}

export function normalizeServerHostPortDisplay(
  rawUrlOrHostPort: string | undefined,
  fallbackHostPort: string,
): string {
  const trimmed = rawUrlOrHostPort?.trim();
  if (!trimmed) return fallbackHostPort;
  const stripped = trimmed
    .replace(/^wss?:\/\//i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  if (!stripped) return fallbackHostPort;
  return stripped.includes(':') ? stripped : `${stripped}:2567`;
}

export function resolveSanctuaryWsUrl(hostPortOrUrl: string): string {
  const trimmed = hostPortOrUrl.trim();
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed;
  }
  const protocol =
    typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostPort = trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  const normalized = hostPort || '127.0.0.1:2567';
  return `${protocol}//${normalized.includes(':') ? normalized : `${normalized}:2567`}`;
}

export function setSanctuaryKeyboardSuspended(scene: GameScene, suspended: boolean): void {
  const kb = scene.input?.keyboard;
  if (!kb) return;
  if (suspended) {
    if (kb.enabled) {
      kb.resetKeys();
      kb.enabled = false;
      kb.disableGlobalCapture();
    }
  } else {
    if (!kb.enabled) {
      kb.enabled = true;
      kb.enableGlobalCapture();
    }
  }
}

export function mountSanctuaryDomInputs(scene: GameScene): void {
  destroySanctuaryDomInputs(scene);

  const bounds = computeSanctuaryCoopInputBounds(
    scene.currentHudUiScale || 1,
    scene.hudPadX,
    scene.hudPadY,
  );

  const overlay = new MenuDomInputOverlay(
    scene,
    scene.displayName,
    scene.serverHostPort,
    {
      onFocusChange: (field) => {
        scene.menuActiveInput = field;
        initGlobalDebugState().menuActiveInput = field;
        setSanctuaryKeyboardSuspended(scene, field !== null);
        scene.lastInvitePanelHash = '';
      },
      onValueChange: (field, value) => {
        const debug = initGlobalDebugState();
        if (field === 'name') {
          scene.displayName = value;
          debug.menuDisplayName = value;
        } else {
          scene.serverHostPort = value;
          debug.menuServerHostPort = value;
        }
        scene.lastInvitePanelHash = '';
      },
    },
    bounds,
  );
  overlay.setVisible(false);
  scene.sanctuaryDomInputs = overlay;

  if (typeof window !== 'undefined') {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      const activeField = scene.menuActiveInput;
      if (!activeField) return;
      if (typeof document !== 'undefined' && document.activeElement?.tagName === 'INPUT') {
        return;
      }
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        scene.menuActiveInput = null;
        initGlobalDebugState().menuActiveInput = null;
        scene.sanctuaryDomInputs?.focusField(null);
        setSanctuaryKeyboardSuspended(scene, false);
        scene.lastInvitePanelHash = '';
        return;
      }
      const curVal = activeField === 'name' ? scene.displayName : scene.serverHostPort;
      const maxLen = activeField === 'name' ? MENU_NAME_MAX_LEN : MENU_IP_MAX_LEN;
      const action =
        event.key === 'Backspace'
          ? ({ kind: 'backspace' } as const)
          : event.key === 'Delete'
            ? ({ kind: 'delete' } as const)
            : event.key.length === 1 && !event.ctrlKey && !event.metaKey
              ? ({ kind: 'insert', text: event.key } as const)
              : null;
      if (action) {
        event.preventDefault();
        const selStart = action.kind === 'delete' ? 0 : curVal.length;
        const next = applyMenuInputEdit(
          curVal,
          selStart,
          curVal.length,
          action,
          activeField,
          maxLen,
        );
        const debug = initGlobalDebugState();
        if (activeField === 'name') {
          scene.displayName = next.value;
          debug.menuDisplayName = next.value;
        } else {
          scene.serverHostPort = next.value;
          debug.menuServerHostPort = next.value;
        }
        scene.sanctuaryDomInputs?.syncValues(scene.displayName, scene.serverHostPort);
        scene.lastInvitePanelHash = '';
      }
    };
    scene.sanctuaryDomKeydownHandler = onWindowKeyDown;
    window.addEventListener('keydown', onWindowKeyDown);
  }
}

export function destroySanctuaryDomInputs(scene: GameScene): void {
  if (typeof window !== 'undefined' && scene.sanctuaryDomKeydownHandler) {
    window.removeEventListener('keydown', scene.sanctuaryDomKeydownHandler);
    scene.sanctuaryDomKeydownHandler = undefined;
  }
  scene.sanctuaryDomInputs?.destroy();
  scene.sanctuaryDomInputs = undefined;
  scene.menuActiveInput = null;
  initGlobalDebugState().menuActiveInput = null;
  setSanctuaryKeyboardSuspended(scene, false);
}

function clearSavedCoopSessionTokens(): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem('ashen_pact_reconnect_token');
      window.sessionStorage.removeItem('ashen_pact_room_id');
      window.sessionStorage.removeItem('ashen_pact_colyseus_token');
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
}

export function switchSanctuaryCoopMode(
  scene: GameScene,
  nextMode: 'solo' | 'host' | 'join',
): void {
  const effectiveName = scene.displayName.trim() || PRESET_NAMES_VI[0];
  scene.displayName = effectiveName;
  try {
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem('ashen_pact_name', effectiveName);
    }
  } catch {
    // Ignore localStorage restrictions
  }

  destroySanctuaryDomInputs(scene);
  scene.intentionalLeave = true;
  if (scene.room) {
    const activeRoom = scene.room;
    scene.room = undefined;
    void activeRoom.leave().catch(() => {});
  }
  if (nextMode === 'solo' || nextMode === 'host') {
    clearSavedCoopSessionTokens();
  }

  scene.scene.restart({
    coopMode: nextMode,
    startInHub: true,
    displayName: effectiveName,
    serverUrl:
      nextMode === 'solo' ? scene.serverHostPort : resolveSanctuaryWsUrl(scene.serverHostPort),
  });
}

export function exitToSoloSanctuary(scene: GameScene, disconnectReason?: string): void {
  destroySanctuaryDomInputs(scene);
  scene.intentionalLeave = true;
  if (scene.room) {
    const activeRoom = scene.room;
    scene.room = undefined;
    void activeRoom.leave().catch(() => {});
  }
  clearSavedCoopSessionTokens();
  scene.scene.start('GameScene', {
    coopMode: 'solo',
    startInHub: true,
    disconnectReason,
  });
}

export function syncSanctuaryDomInputsLayoutAndVisibility(scene: GameScene): void {
  const sim = scene.transport?.getSim?.();
  if (!sim) return;

  if (!scene.sanctuaryDomInputs) {
    setSanctuaryKeyboardSuspended(scene, false);
    return;
  }

  const debug = initGlobalDebugState();
  const lp = scene.transport.getLocalPlayerState();
  const modalOpen =
    scene.pauseModalOpen ||
    (scene.settingsModal?.isOpen() ?? false) ||
    scene.fullMapOpen ||
    scene.emoteWheelOpen ||
    debug.overlayVisible ||
    (lp.buffChoices?.length ?? 0) > 0 ||
    (lp.mutatorChoices?.length ?? 0) > 0 ||
    (lp.pactChoices?.length ?? 0) > 0;

  const shouldShowInputs =
    sim.inHub &&
    !sim.stressTestActive &&
    scene.coopMode === 'solo' &&
    scene.invitePanelVisible &&
    !modalOpen;

  if (shouldShowInputs) {
    const bounds = computeSanctuaryCoopInputBounds(
      scene.currentHudUiScale || 1,
      scene.hudPadX,
      scene.hudPadY,
    );
    scene.sanctuaryDomInputs.setBounds(bounds);
    scene.sanctuaryDomInputs.syncValues(scene.displayName, scene.serverHostPort);
  }
  scene.sanctuaryDomInputs.setModalBlocked(modalOpen);
  scene.sanctuaryDomInputs.setVisible(shouldShowInputs);
  setSanctuaryKeyboardSuspended(scene, shouldShowInputs && scene.menuActiveInput !== null);
}

export function syncSanctuaryOnStressTest(scene: GameScene, active: boolean): void {
  if (active) {
    scene.invitePanelVisible = false;
    initGlobalDebugState().invitePanelVisible = false;
    scene.lastInvitePanelHash = '__invalid__';
    scene.lastSanctuaryHudHash = '__invalid__';
    if (!scene.updateHubInvitePanel) {
      scene.invitePanelContainer?.removeAll(true);
    }
  }
  scene.updateHubInvitePanel?.();
  if (scene.updateSanctuaryOverlayHud) {
    scene.updateSanctuaryOverlayHud(0);
  } else {
    updateSanctuaryOverlayHudImpl.call(scene, 0);
  }
}

export function updateSanctuaryOverlayHudImpl(this: GameScene, dtSec: number): void {
  const ui = this.uiScene;
  const sim = this.transport.getSim();
  syncSanctuaryDomInputsLayoutAndVisibility(this);

  const frozen = getVisualQueryConfig().freeze;
  if (sim.inHub) {
    this.sanctuaryHubElapsedSec = frozen ? 1.0 : this.sanctuaryHubElapsedSec + dtSec;
  } else {
    this.sanctuaryHubElapsedSec = 0;
  }

  if (this.disconnectReason) {
    if (!frozen) {
      this.disconnectBannerTimer -= dtSec;
      if (this.disconnectBannerTimer <= 0) {
        this.disconnectReason = null;
        this.disconnectBannerTimer = 0;
      }
    }
  }

  const showInHub = sim.inHub && !sim.stressTestActive && !this.fullMapOpen;
  const showDebug = isEffectiveDebugUiEnabled(this.coopMode !== 'solo');
  const debug = initGlobalDebugState();
  const showViFooter = showInHub && showDebug && !debug.hubPreviewCharacterId;
  const locale = i18n.getLocale();

  const plaqueAlpha = showInHub
    ? clamp(1 - ((this.sanctuaryHubElapsedSec - 4) / 1.5) * 0.14, 0.86, 1)
    : 1;
  this.sanctuaryPlaqueContainer?.setAlpha(plaqueAlpha);

  const hudHash = !showInHub
    ? 'hidden'
    : `${locale}:${showDebug ? 1 : 0}:${showViFooter ? 1 : 0}:${this.disconnectReason ?? ''}:${this.hubLoungeAnimOverride ?? 'idle'}:${this.currentHudUiScale}`;

  if (hudHash === this.lastSanctuaryHudHash) return;
  this.lastSanctuaryHudHash = hudHash;

  this.sanctuaryHudContainer?.removeAll(true);
  this.sanctuaryDebugFooterContainer?.removeAll(true);
  this.sanctuaryPlaqueContainer = undefined;

  if (!showInHub || !this.sanctuaryHudContainer) return;

  const textRes = computeUiTextResolution(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    ui.cameras?.main?.zoom || 2,
    this.currentHudUiScale || 1,
  );

  // 1. Compact Sanctuary Arrival Plaque at Top-Center (fades gently to 0.86 alpha after 4s)
  const plaqueContainer = ui.add.container(0, 0);
  plaqueContainer.setAlpha(plaqueAlpha);
  this.sanctuaryPlaqueContainer = plaqueContainer;

  const plaqueW = 416;
  const plaqueH = 34;
  const plaqueX = -plaqueW * 0.5;
  const plaqueY = 6;

  const plaqueBg = ui.add.graphics();
  drawStyledPanel(plaqueBg, plaqueX, plaqueY, plaqueW, plaqueH, {
    fillColor: UI_THEME.panelBgDark,
    fillAlpha: 0.92,
    borderColor: hexToNum(PALETTE.SOLAR_GOLD),
    borderWidth: 1.6,
    radius: UI_THEME.panelRadius.md,
    accentColor: hexToNum(PALETTE.SOLAR_GOLD),
    accentSide: 'top',
  });

  const rawTitle = i18n.t('ui.sanctuary.title').replace(' — ', ' · ');
  const titleTxt = ui.add
    .text(
      plaqueX + 12,
      plaqueY + 11,
      rawTitle,
      createUiTextStyle({
        fontPxAt1080p: 13.5,
        weight: 800,
        color: PALETTE.SOLAR_GOLD,
        resolution: textRes,
      }),
    )
    .setOrigin(0, 0.5);

  const versionTxt = ui.add
    .text(
      plaqueX + plaqueW - 12,
      plaqueY + 11,
      SANCTUARY_VERSION_BADGE,
      createUiTextStyle({
        fontPxAt1080p: 10.5,
        weight: 700,
        color: PALETTE.CYAN_FROST,
        resolution: textRes,
      }),
    )
    .setOrigin(1, 0.5);

  const subtitleTxt = ui.add
    .text(
      0,
      plaqueY + 25,
      i18n.t('ui.sanctuary.subtitle'),
      createUiTextStyle({
        fontPxAt1080p: 10.5,
        weight: 600,
        color: PALETTE.SILVER_BRIGHT,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5);
  if (subtitleTxt.width > plaqueW - 20 && subtitleTxt.width > 0) {
    subtitleTxt.setScale((plaqueW - 20) / subtitleTxt.width);
  }

  plaqueContainer.add([plaqueBg, titleTxt, versionTxt, subtitleTxt]);
  this.sanctuaryHudContainer.add(plaqueContainer);

  // 2. Compact Sanctuary Utility Pill Row beneath Plaque
  interface UtilityPillSpec {
    label: string;
    width: number;
    accentHex: string;
    onClick: () => void;
  }

  const pills: UtilityPillSpec[] = [
    {
      label: '⚙ [O]',
      width: 56,
      accentHex: PALETTE.SLATE_MID,
      onClick: () => {
        if (this.pauseModalOpen || this.settingsModal?.isOpen()) return;
        zzfx.play('ui_click');
        this.settingsModal?.open('settings');
      },
    },
    {
      label: '⌨ [K]',
      width: 56,
      accentHex: PALETTE.SLATE_MID,
      onClick: () => {
        if (this.pauseModalOpen || this.settingsModal?.isOpen()) return;
        zzfx.play('ui_click');
        this.settingsModal?.open('controls');
      },
    },
    {
      label: '★ [C]',
      width: 56,
      accentHex: PALETTE.SLATE_MID,
      onClick: () => {
        if (this.pauseModalOpen || this.settingsModal?.isOpen()) return;
        zzfx.play('ui_click');
        this.settingsModal?.open('credits');
      },
    },
    {
      label: '🌐 [L]',
      width: 56,
      accentHex: PALETTE.FOREST_SHADE,
      onClick: () => {
        if (this.pauseModalOpen || this.settingsModal?.isOpen()) return;
        zzfx.play('ui_click');
        graphicsSettings.toggleLanguage();
        initGlobalDebugState().language = graphicsSettings.getState().language;
        this.invalidateAllHudCaches();
      },
    },
  ];

  if (showDebug) {
    pills.push(
      {
        label: '🎨 Gallery',
        width: 78,
        accentHex: PALETTE.STEEL_DARK,
        onClick: () => {
          if (this.pauseModalOpen || this.settingsModal?.isOpen()) return;
          zzfx.play('ui_click');
          destroySanctuaryDomInputs(this);
          this.scene.start('ArtGalleryScene');
        },
      },
      {
        label: '🏃 Anim',
        width: 68,
        accentHex: PALETTE.GOBLIN_GREEN,
        onClick: () => {
          if (this.pauseModalOpen || this.settingsModal?.isOpen()) return;
          zzfx.play('ui_click');
          const nextState = this.hubLoungeAnimOverride === 'run' ? 'idle' : 'run';
          this.hubLoungeAnimOverride = nextState;
          for (const entry of this.hubStatueRigs.values()) {
            entry.rig.setAnimState(nextState);
          }
          initGlobalDebugState().animState = nextState;
          this.lastSanctuaryHudHash = '';
        },
      },
    );
  }

  const pillGap = 6;
  const pillH = 20;
  const pillY = 44;
  const totalRowW =
    pills.reduce((acc, p) => acc + p.width, 0) + Math.max(0, pills.length - 1) * pillGap;
  let curPillX = -totalRowW * 0.5;

  for (const pill of pills) {
    const px = curPillX;
    const pw = pill.width;
    const pillBg = ui.add.graphics();
    const drawPill = (hover: boolean) => {
      pillBg.clear();
      drawStyledPanel(pillBg, px, pillY, pw, pillH, {
        fillColor: hover ? UI_THEME.panelBgElevated : hexToNum(pill.accentHex),
        fillAlpha: 0.94,
        borderColor: hover ? hexToNum(PALETTE.SOLAR_GOLD) : UI_THEME.panelBorder,
        borderWidth: hover ? 1.5 : 1.2,
        radius: 5,
      });
    };
    drawPill(false);

    const pillTxt = ui.add
      .text(
        px + pw * 0.5,
        pillY + pillH * 0.5,
        pill.label,
        createUiTextStyle({
          fontPxAt1080p: 11.5,
          weight: 700,
          color: PALETTE.BONE_WHITE,
          resolution: textRes,
        }),
      )
      .setOrigin(0.5, 0.5);

    const pillHit = ui.add
      .rectangle(px + pw * 0.5, pillY + pillH * 0.5, pw, pillH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    pillHit.on('pointerover', () => {
      if (this.pauseModalOpen || this.settingsModal?.isOpen()) return;
      drawPill(true);
    });
    pillHit.on('pointerout', () => drawPill(false));
    pillHit.on('pointerdown', pill.onClick);

    this.sanctuaryHudContainer.add([pillBg, pillTxt, pillHit]);
    curPillX += pw + pillGap;
  }

  // 3. Disconnect / Kick / Rejection Notice Banner (click-to-dismiss + 10s auto-clear)
  if (this.disconnectReason) {
    const bannerW = 456;
    const bannerH = 26;
    const bannerX = -bannerW * 0.5;
    const bannerY = 69;

    const bannerBg = ui.add.graphics();
    drawStyledPanel(bannerBg, bannerX, bannerY, bannerW, bannerH, {
      fillColor: 0x2a1016,
      fillAlpha: 0.96,
      borderColor: hexToNum(PALETTE.RUBY_CORE),
      borderWidth: 1.8,
      radius: 6,
      accentColor: hexToNum(PALETTE.RUBY_CORE),
      accentSide: 'left',
    });

    const bannerTxt = ui.add
      .text(
        bannerX + 12,
        bannerY + bannerH * 0.5,
        `⚠ ${this.disconnectReason}`,
        createUiTextStyle({
          fontPxAt1080p: 11.5,
          weight: 700,
          color: PALETTE.BONE_WHITE,
          resolution: textRes,
        }),
      )
      .setOrigin(0, 0.5);
    const maxTextW = bannerW - 38;
    if (bannerTxt.width > maxTextW && bannerTxt.width > 0) {
      bannerTxt.setScale(maxTextW / bannerTxt.width);
    }

    const closeTxt = ui.add
      .text(
        bannerX + bannerW - 10,
        bannerY + bannerH * 0.5,
        '✕',
        createUiTextStyle({
          fontPxAt1080p: 11.5,
          weight: 800,
          color: PALETTE.SILVER_BRIGHT,
          resolution: textRes,
        }),
      )
      .setOrigin(1, 0.5);

    const bannerHit = ui.add
      .rectangle(0, bannerY + bannerH * 0.5, bannerW, bannerH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    bannerHit.on('pointerdown', () => {
      zzfx.play('ui_click');
      this.disconnectReason = null;
      this.disconnectBannerTimer = 0;
      this.lastSanctuaryHudHash = '';
    });

    this.sanctuaryHudContainer.add([bannerBg, bannerTxt, closeTxt, bannerHit]);
  }

  // 4. ?debug=1 Bottom Vietnamese Diacritics Verification Chip (anchored inside hudBottomCenterContainer)
  if (showViFooter && this.sanctuaryDebugFooterContainer) {
    const chipW = 372;
    const chipH = 22;
    const chipX = -104 - chipW * 0.5;
    const chipY = -chipH - 8;

    const chipBg = ui.add.graphics();
    drawStyledPanel(chipBg, chipX, chipY, chipW, chipH, {
      fillColor: UI_THEME.panelBgDark,
      fillAlpha: 0.92,
      borderColor: UI_THEME.panelBorder,
      borderWidth: 1.2,
      radius: 6,
    });

    const chipTxt = ui.add
      .text(
        chipX + chipW * 0.5,
        chipY + chipH * 0.5,
        VIETNAMESE_VERIFICATION_STRING,
        createUiTextStyle({
          fontPxAt1080p: 11.5,
          weight: 700,
          color: PALETTE.BONE_WHITE,
          resolution: textRes,
        }),
      )
      .setOrigin(0.5, 0.5);
    if (chipTxt.width > chipW - 16 && chipTxt.width > 0) {
      chipTxt.setScale((chipW - 16) / chipTxt.width);
    }

    this.sanctuaryDebugFooterContainer.add([chipBg, chipTxt]);
  }
}
