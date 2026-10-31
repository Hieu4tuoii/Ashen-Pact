import {
  clamp,
  i18n,
  SECRET_ARENA_DURATION_SEC,
  type SupportedLocale,
  type WorldSim,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../art/palette.js';
import type { GameScene } from '../scenes/GameScene.js';
import { drawStyledPanel } from './components/hud-primitives.js';
import { graphicsSettings } from './graphics-settings.js';
import { computeUiTextResolution, createUiTextStyle, UI_THEME } from './theme.js';

export type SecretArenaHudMode = 'active' | 'victory' | 'expired';

export type SecretArenaSimSlice = Pick<
  WorldSim,
  | 'secretTrialActive'
  | 'secretTrialTimer'
  | 'secretTrialResult'
  | 'secretTrialBannerTimer'
  | 'secretTrialRemainingEnemies'
>;

export interface SecretArenaHudViewModel {
  mode: SecretArenaHudMode;
  isUrgent: boolean;
  titleText: string;
  primaryText: string;
  progressRatio: number;
  remainingSec: number;
  remainingEnemies: number;
  borderColorHex: string;
  borderColorNum: number;
  barColorHex: string;
  barColorNum: number;
  textColorHex: string;
}

const URGENT_THRESHOLD_SEC = 5.0;
const URGENT_ORANGE_HEX = '#F97316';

export function buildSecretArenaHudViewModel(
  sim: SecretArenaSimSlice,
  locale: SupportedLocale = i18n.getLocale(),
): SecretArenaHudViewModel | null {
  const prevLocale = i18n.getLocale();
  if (prevLocale !== locale) i18n.setLocale(locale);
  try {
    if (sim.secretTrialActive) {
      const remainingSec = Math.max(0, sim.secretTrialTimer);
      const remainingEnemies = Math.max(0, Math.round(sim.secretTrialRemainingEnemies));
      const isUrgent = remainingSec <= URGENT_THRESHOLD_SEC;
      const secStr = remainingSec.toFixed(1);
      const progressRatio = clamp(remainingSec / Math.max(0.1, SECRET_ARENA_DURATION_SEC), 0, 1);
      const borderColorHex = isUrgent ? PALETTE.CRIMSON_BRIGHT : PALETTE.ELECTRIC_VIOLET;
      const barColorHex = isUrgent ? URGENT_ORANGE_HEX : PALETTE.SOLAR_GOLD;
      const textColorHex = isUrgent ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE;

      return {
        mode: 'active',
        isUrgent,
        titleText: i18n.t('ui.hud.secretTrial.title'),
        primaryText: i18n.t(
          isUrgent ? 'ui.hud.secretTrial.urgent' : 'ui.hud.secretTrial.countdown',
          { sec: secStr, enemies: remainingEnemies },
        ),
        progressRatio,
        remainingSec,
        remainingEnemies,
        borderColorHex,
        borderColorNum: hexToNum(borderColorHex),
        barColorHex,
        barColorNum: hexToNum(barColorHex),
        textColorHex,
      };
    }

    if (sim.secretTrialBannerTimer > 0 && sim.secretTrialResult === 'victory') {
      const goldHex = PALETTE.SOLAR_GOLD;
      const goldNum = hexToNum(goldHex);
      return {
        mode: 'victory',
        isUrgent: false,
        titleText: i18n.t('ui.hud.secretTrial.title'),
        primaryText: i18n.t('ui.hud.secretTrial.victoryBanner'),
        progressRatio: 1,
        remainingSec: Math.max(0, sim.secretTrialTimer),
        remainingEnemies: 0,
        borderColorHex: goldHex,
        borderColorNum: goldNum,
        barColorHex: goldHex,
        barColorNum: goldNum,
        textColorHex: goldHex,
      };
    }

    if (sim.secretTrialBannerTimer > 0 && sim.secretTrialResult === 'expired') {
      const borderHex = PALETTE.SILVER_BRIGHT;
      const barHex = PALETTE.STEEL_LIGHT;
      return {
        mode: 'expired',
        isUrgent: false,
        titleText: i18n.t('ui.hud.secretTrial.title'),
        primaryText: i18n.t('ui.hud.secretTrial.expiredBanner'),
        progressRatio: 0,
        remainingSec: 0,
        remainingEnemies: 0,
        borderColorHex: borderHex,
        borderColorNum: hexToNum(borderHex),
        barColorHex: barHex,
        barColorNum: hexToNum(barHex),
        textColorHex: PALETTE.SILVER_BRIGHT,
      };
    }

    return null;
  } finally {
    if (prevLocale !== locale) i18n.setLocale(prevLocale);
  }
}

interface SecretArenaHudWidgets {
  container: Phaser.GameObjects.Container;
  graphics: Phaser.GameObjects.Graphics;
  titleText: Phaser.GameObjects.Text;
  primaryText: Phaser.GameObjects.Text;
  lastHash: string;
}

const secretHudByScene = new WeakMap<GameScene, SecretArenaHudWidgets>();

function drawMiniDiamond(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
  col: number,
): void {
  g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
  g.fillTriangle(cx, cy - r - 1, cx - r - 1, cy, cx + r + 1, cy);
  g.fillTriangle(cx, cy + r + 1, cx - r - 1, cy, cx + r + 1, cy);
  g.fillStyle(col, 1);
  g.fillTriangle(cx, cy - r, cx - r, cy, cx + r, cy);
  g.fillTriangle(cx, cy + r, cx - r, cy, cx + r, cy);
}

function getOrCreateSecretArenaHudWidgets(scene: GameScene): SecretArenaHudWidgets | null {
  if (!scene.uiScene || !scene.hudTopCenterContainer) return null;
  const existing = secretHudByScene.get(scene);
  if (existing && existing.container.scene && existing.container.active) {
    return existing;
  }

  const ui = scene.uiScene;
  const uiScale = graphicsSettings.getState().uiScale;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const textRes = computeUiTextResolution(dpr, ui.cameras?.main?.zoom ?? 2, uiScale);

  const container = ui.add.container(0, 8);
  const graphics = ui.add.graphics();
  const titleText = ui.add
    .text(
      0,
      10,
      '',
      createUiTextStyle({
        fontPxAt1080p: 13,
        weight: 800,
        color: PALETTE.ELECTRIC_VIOLET,
        stroke: PALETTE.INK_DEEP,
        strokeThickness: 2.6,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5);

  const primaryText = ui.add
    .text(
      0,
      24,
      '',
      createUiTextStyle({
        fontPxAt1080p: 14,
        weight: 800,
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DEEP,
        strokeThickness: 2.8,
        resolution: textRes,
      }),
    )
    .setOrigin(0.5, 0.5);

  container.add([graphics, titleText, primaryText]);
  container.setVisible(false);
  scene.hudTopCenterContainer.add(container);
  scene.textObjects?.push(titleText, primaryText);

  const created: SecretArenaHudWidgets = {
    container,
    graphics,
    titleText,
    primaryText,
    lastHash: '',
  };
  secretHudByScene.set(scene, created);
  return created;
}

/**
 * Renders the crisp 20.0s Secret Skill Arena countdown bar & victory/expired banners
 * anchored at the top-center of the screen without overlapping player bars or minimap.
 */
export function renderSecretArenaCountdownHud(scene: GameScene): void {
  const widgets = getOrCreateSecretArenaHudWidgets(scene);
  if (!widgets) return;

  const sim = scene.transport.getSim();
  if (scene.fullMapOpen || sim.inHub || sim.runState !== 'playing') {
    if (widgets.container.visible) {
      widgets.graphics.clear();
      widgets.container.setVisible(false);
      widgets.lastHash = '';
    }
    return;
  }

  const vm = buildSecretArenaHudViewModel(sim, i18n.getLocale());
  if (!vm) {
    if (widgets.container.visible) {
      widgets.graphics.clear();
      widgets.container.setVisible(false);
      widgets.lastHash = '';
    }
    return;
  }

  const hasAliveBoss = sim.enemies.some((e) => e.isBoss && e.hp > 0);
  const targetY = hasAliveBoss ? 68 : 8;
  const ratioBucket = Math.round(vm.progressRatio * 200);
  const hash = `${vm.mode}:${vm.isUrgent ? 1 : 0}:${ratioBucket}:${vm.titleText}:${vm.primaryText}:${targetY}`;
  if (hash === widgets.lastHash && widgets.container.visible) {
    return;
  }
  widgets.lastHash = hash;
  widgets.container.setY(targetY);
  widgets.container.setVisible(true);

  const g = widgets.graphics;
  g.clear();

  const panelW = vm.mode === 'active' ? 288 : 332;
  const panelH = vm.mode === 'active' ? 44 : 38;
  const panelX = -panelW * 0.5;
  const panelY = 0;

  drawStyledPanel(g, panelX, panelY, panelW, panelH, {
    fillColor: UI_THEME.panelBgDark,
    fillAlpha: 0.93,
    borderColor: vm.borderColorNum,
    borderWidth: vm.isUrgent || vm.mode === 'victory' ? 2.2 : 1.8,
    radius: UI_THEME.panelRadius.md,
    accentColor: vm.barColorNum,
    accentSide: 'top',
  });

  drawMiniDiamond(g, panelX + 6, panelY + panelH * 0.5, 3.6, vm.borderColorNum);
  drawMiniDiamond(g, panelX + panelW - 6, panelY + panelH * 0.5, 3.6, vm.borderColorNum);

  if (vm.mode === 'active') {
    const barW = panelW - 32;
    const barH = 6.5;
    const barX = -barW * 0.5;
    const barY = 33;

    g.fillStyle(UI_THEME.inkDeep, 0.95);
    g.fillRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);

    const fillW = Math.max(0, barW * vm.progressRatio);
    if (fillW > 0.5) {
      g.fillStyle(vm.barColorNum, 0.96);
      g.fillRoundedRect(barX, barY, fillW, barH, 2.5);
      g.fillStyle(hexToNum(PALETTE.BONE_WHITE), 0.28);
      g.fillRect(barX + 1, barY + 0.8, Math.max(0, fillW - 2), 1.6);
    }

    // 5-second quarter ticks (25%, 50%, 75%)
    g.lineStyle(1, UI_THEME.inkDark, 0.85);
    for (let q = 1; q <= 3; q++) {
      const tx = barX + (barW * q) / 4;
      g.lineBetween(tx, barY, tx, barY + barH);
    }
    g.lineStyle(1.1, vm.borderColorNum, 0.8);
    g.strokeRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);

    widgets.titleText.setY(9.5);
    widgets.primaryText.setY(22.5);
  } else {
    widgets.titleText.setY(10);
    widgets.primaryText.setY(25);
  }

  const titleColor =
    vm.mode === 'victory'
      ? PALETTE.SOLAR_GOLD
      : vm.isUrgent
        ? URGENT_ORANGE_HEX
        : PALETTE.ELECTRIC_VIOLET;
  if (widgets.titleText.text !== vm.titleText) widgets.titleText.setText(vm.titleText);
  widgets.titleText.setColor(titleColor);

  if (widgets.primaryText.text !== vm.primaryText) widgets.primaryText.setText(vm.primaryText);
  widgets.primaryText.setColor(vm.textColorHex);
}
