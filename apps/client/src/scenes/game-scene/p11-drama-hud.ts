import type Phaser from 'phaser';
import { i18n, type SimEnemyState, WORLD_VIEW_WIDTH } from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../../art/palette.js';
import {
  fillTaperedArcRibbon,
  fillTaperedQuadraticBezier,
  strokeCutoutQuadStripFromScratch,
  SCRATCH_PX,
  SCRATCH_PY,
  SCRATCH_HW,
} from '../../fx/tapered-ribbon-builder.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import type { GameScene } from '../GameScene.js';

export function renderBossPhaseInvulnCage(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radiusPx: number,
  elapsedSec: number,
  totalDurationSec = 1.2,
): boolean {
  if (elapsedSec < 0 || elapsedSec >= totalDurationSec) {
    return false;
  }
  const blinkStartSec = totalDurationSec - 0.2;
  if (elapsedSec >= blinkStartSec) {
    const halfCycle = Math.floor((elapsedSec - blinkStartSec) * 32);
    if (halfCycle % 2 !== 0) {
      return false;
    }
  }

  // Draw <= 0.06 inner fill if fillStyle & fillTriangle available
  if (typeof gfx.fillStyle === 'function' && typeof gfx.fillTriangle === 'function') {
    gfx.fillStyle(0xfef08a, 0.04);
    for (let k = 0; k < 6; k++) {
      const a1 = (k / 6) * Math.PI * 2;
      const a2 = ((k + 1) / 6) * Math.PI * 2;
      gfx.fillTriangle(
        x,
        y,
        x + Math.cos(a1) * (radiusPx - 1.4),
        y + Math.sin(a1) * (radiusPx - 1.4),
        x + Math.cos(a2) * (radiusPx - 1.4),
        y + Math.sin(a2) * (radiusPx - 1.4),
      );
    }
  }

  // 7 points for a tight closed hexagon rim (#141019 2.0px border + #F4F1EA 1.4px core)
  for (let k = 0; k < 7; k++) {
    const ang = (k / 6) * Math.PI * 2;
    SCRATCH_PX[k] = x + Math.cos(ang) * radiusPx;
    SCRATCH_PY[k] = y + Math.sin(ang) * radiusPx;
    SCRATCH_HW[k] = 0.7; // 1.4px core width
  }
  strokeCutoutQuadStripFromScratch(
    gfx,
    7,
    hexToNum(PALETTE.BONE_WHITE),
    0.95,
    2.0,
    hexToNum(PALETTE.INK_DARK),
  );
  return true;
}

const UI_FONT_FAMILY = '"Be Vietnam Pro", system-ui, sans-serif';
const HUD_VIEW_W = WORLD_VIEW_WIDTH || 960;

export interface WaveBannerSpec {
  titleVi: string;
  subtitleVi: string;
  accentColor: number;
  accentHex: string;
}

export function computeBossSoftEnrageScale(elapsedSec: number): number {
  if (elapsedSec < 90) return 1.0;
  const steps = Math.floor((elapsedSec - 90) / 15) + 1;
  return Math.max(0.75, Math.pow(0.93, steps));
}

export function computeWaveBannerSpec(
  waveIndex: number,
  wavesTotal: number,
  isChallenge = false,
  locale: 'vi' | 'en' = i18n.getLocale(),
): WaveBannerSpec {
  const safeWave = Math.max(1, waveIndex);
  const safeTotal = Math.max(safeWave, wavesTotal);
  const isEn = locale === 'en';
  if (isChallenge) {
    return {
      titleVi: isEn
        ? `CHALLENGE ROOM — WAVE ${safeWave}/${safeTotal}`
        : `PHÒNG THỬ THÁCH — ĐỢT ${safeWave}/${safeTotal}`,
      subtitleVi: isEn
        ? 'Guaranteed Elite Per Wave · High-Tier Chest Reward'
        : 'Tinh Anh Xuất Hiện Mỗi Đợt · Thưởng Rương Cao Cấp',
      accentColor: 0xfbbf24,
      accentHex: '#FBBF24',
    };
  }
  return {
    titleVi: isEn ? `WAVE ${safeWave}/${safeTotal}` : `ĐỢT ${safeWave}/${safeTotal}`,
    subtitleVi: isEn
      ? safeWave > 1
        ? 'Reinforcements incoming!'
        : 'Eliminate all hostiles!'
      : safeWave > 1
        ? 'Đợt tiếp theo tràn vào chiến trường!'
        : 'Tiêu diệt toàn bộ quái vật!',
    accentColor: 0xf97316,
    accentHex: '#F97316',
  };
}

export function computeRemainingEnemiesText(
  aliveCount: number,
  waveIndex: number,
  wavesTotal: number,
  isChallenge = false,
  locale: 'vi' | 'en' = i18n.getLocale(),
): string {
  const safeCount = Math.max(0, Math.floor(aliveCount));
  const isEn = locale === 'en';
  if (wavesTotal > 1) {
    const prefix = isChallenge ? (isEn ? '★ Challenge · ' : '★ Thử Thách · ') : '';
    return isEn
      ? `${prefix}Wave ${Math.max(1, waveIndex)}/${wavesTotal} · Left: ${safeCount}`
      : `${prefix}Đợt ${Math.max(1, waveIndex)}/${wavesTotal} · Còn: ${safeCount}`;
  }
  return isEn ? `Hostiles left: ${safeCount}` : `Quái còn: ${safeCount}`;
}

export function computeMusicIntensityBoost(
  hpRatio: number,
  bossEnrageLevel: number,
  bossPhase: number,
): number {
  let boost = 0;
  if (hpRatio > 0 && hpRatio <= 0.35) {
    boost += Math.min(0.45, ((0.35 - hpRatio) / 0.35) * 0.45);
  }
  if (bossPhase >= 2) {
    boost += bossPhase >= 3 ? 0.25 : 0.12;
  }
  if (bossEnrageLevel > 0) {
    boost += Math.min(0.45, bossEnrageLevel * 0.14);
  }
  return Math.max(0, Math.min(1, boost));
}

export function formatSettingsToastMessage(
  kind: 'fullscreen' | 'auto_quality',
  detailVi: string,
  locale: 'vi' | 'en' = i18n.getLocale(),
): string {
  const clean = detailVi.trim();
  if (kind === 'fullscreen') {
    return `🖥 ${clean}`;
  }
  return locale === 'en' ? `⚙ Auto Quality: ${clean}` : `⚙ Tự động chỉnh Đồ họa: ${clean}`;
}

export function triggerP11WaveBanner(
  scene: GameScene,
  waveIndex: number,
  wavesTotal: number,
  isChallenge = false,
): void {
  const rec = scene as unknown as Record<string, unknown>;
  const uiScene = ((rec.uiScene ?? rec.hudScene ?? scene) as Phaser.Scene | undefined);
  if (!uiScene || !uiScene.add) return;

  const spec = computeWaveBannerSpec(waveIndex, wavesTotal, isChallenge);
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__LAST_P11_WAVE_BANNER__ = spec.titleVi;
  }

  if (scene && typeof scene === 'object') {
    scene.hudBannerTimer = 0;
    if (scene.waveBannerGraphics) scene.waveBannerGraphics.clear();
    if (scene.waveBannerText) scene.waveBannerText.setVisible(false);
  }

  const prev = rec.__p11WaveBannerContainer as
    | Phaser.GameObjects.Container
    | undefined;
  if (prev) {
    prev.destroy();
  }

  const cx = HUD_VIEW_W * 0.5;
  const cy = 60;
  const container = uiScene.add.container(cx, cy).setDepth(2150);
  rec.__p11WaveBannerContainer = container;

  const bg = uiScene.add.graphics();
  bg.fillStyle(0x090d16, 0.9);
  bg.fillRoundedRect(-150, -20, 300, 40, 7);
  bg.lineStyle(1.8, spec.accentColor, 0.95);
  bg.strokeRoundedRect(-150, -20, 300, 40, 7);

  const title = uiScene.add
    .text(0, -5, spec.titleVi, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '13px',
      fontStyle: 'bold',
      color: spec.accentHex,
      stroke: '#000000',
      strokeThickness: 2.5,
      padding: { top: 3, bottom: 2, left: 4, right: 4 },
    })
    .setOrigin(0.5);

  const sub = uiScene.add
    .text(0, 10, spec.subtitleVi, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '10px',
      color: '#E2E8F0',
      stroke: '#000000',
      strokeThickness: 2,
      padding: { top: 2, bottom: 2, left: 4, right: 4 },
    })
    .setOrigin(0.5);

  container.add([bg, title, sub]);
  container.setAlpha(1);
  container.setScale(1);
  rec.p11WaveBannerContainer = container;
  rec.p11WaveBannerTitleText = title;

  uiScene.tweens.add({
    targets: container,
    alpha: 0,
    y: cy - 8,
    delay: 1450,
    duration: 260,
    ease: 'Sine.easeIn',
    onComplete: () => {
      container.destroy();
    },
  });
}

export function triggerP11SettingsToast(scene: GameScene, messageVi: string): void {
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__LAST_P11_TOAST__ = messageVi;
  }
  const rec = scene as unknown as Record<string, unknown>;
  const uiScene = ((rec.uiScene ?? rec.hudScene ?? scene) as Phaser.Scene | undefined);
  if (!uiScene || !uiScene.add) return;

  const prev = rec.__p11ToastContainer as
    | Phaser.GameObjects.Container
    | undefined;
  if (prev) {
    prev.destroy();
  }

  const cx = HUD_VIEW_W * 0.5;
  const cy = 28;
  const container = uiScene.add.container(cx, cy).setDepth(2400);
  rec.__p11ToastContainer = container;

  const textObj = uiScene.add
    .text(0, 0, messageVi, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#F8FAFC',
      stroke: '#000000',
      strokeThickness: 2.5,
      padding: { top: 3, bottom: 2, left: 4, right: 4 },
    })
    .setOrigin(0.5);

  const w = Math.max(190, textObj.width + 24);
  const bg = uiScene.add.graphics();
  bg.fillStyle(0x0f172a, 0.92);
  bg.fillRoundedRect(-w * 0.5, -13, w, 26, 6);
  bg.lineStyle(1.5, 0x38bdf8, 0.9);
  bg.strokeRoundedRect(-w * 0.5, -13, w, 26, 6);

  container.add([bg, textObj]);
  container.setAlpha(1);
  rec.p11SettingsToastContainer = container;
  rec.p11SettingsToastText = textObj;

  uiScene.tweens.add({
    targets: container,
    alpha: 0,
    delay: 1850,
    duration: 250,
    onComplete: () => container.destroy(),
  });
}

export function bindP11SettingsToastListener(scene: GameScene): void {
  if (!scene || typeof window === 'undefined') return;
  const rec = scene as unknown as Record<string, unknown>;
  if (rec.__p11ToastListenerBound) return;
  rec.__p11ToastListenerBound = true;
  rec.hudScene = rec.uiScene ?? rec.hudScene ?? scene;
  if (rec.hudScene && typeof rec.hudScene === 'object') {
    (rec.hudScene as Record<string, unknown>).triggerWaveBanner = (
      wave: number,
      total: number,
      isChallenge = false,
    ) => {
      triggerP11WaveBanner(scene, wave, total, isChallenge);
    };
  }
  graphicsSettings.onToast((toast) => {
    triggerP11SettingsToast(scene, toast.messageVi);
  });
  window.addEventListener('ashen-pact:settings-toast', (ev: Event) => {
    const customEv = ev as CustomEvent<{
      messageVi?: string;
      kind?: 'fullscreen' | 'auto_quality';
      detailVi?: string;
    }>;
    if (customEv.detail?.messageVi) {
      triggerP11SettingsToast(scene, customEv.detail.messageVi);
    } else if (customEv.detail?.kind && customEv.detail?.detailVi) {
      triggerP11SettingsToast(
        scene,
        formatSettingsToastMessage(customEv.detail.kind, customEv.detail.detailVi),
      );
    }
  });
  window.addEventListener('ashen-pact-settings-toast', (ev: Event) => {
    const customEv = ev as CustomEvent<{
      messageVi?: string;
      kind?: 'fullscreen' | 'auto_quality';
      detailVi?: string;
    }>;
    if (customEv.detail?.messageVi) {
      triggerP11SettingsToast(scene, customEv.detail.messageVi);
    } else if (customEv.detail?.kind && customEv.detail?.detailVi) {
      triggerP11SettingsToast(
        scene,
        formatSettingsToastMessage(customEv.detail.kind, customEv.detail.detailVi),
      );
    }
  });
}

export function updateP11RemainingEnemiesHud(scene: GameScene): void {
  bindP11SettingsToastListener(scene);
  const rec = scene as unknown as Record<string, unknown>;
  const sim = scene?.transport?.getSim?.();
  if (!sim) return;
  const uiScene = ((rec.uiScene ?? rec.hudScene ?? scene) as Phaser.Scene | undefined);
  if (!uiScene || !uiScene.add) return;

  const pillX = HUD_VIEW_W - 12;
  const pillY = 148;
  let pill = rec.__p11RemainingHudText as
    | Phaser.GameObjects.Text
    | undefined;
  if (!pill || !pill.scene) {
    pill = uiScene.add
      .text(pillX, pillY, '', {
        fontFamily: UI_FONT_FAMILY,
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#FDE68A',
        backgroundColor: 'rgba(9, 13, 22, 0.86)',
        padding: { left: 7, right: 7, top: 3, bottom: 3 },
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(1, 0)
      .setDepth(1950)
      .setVisible(false);
    rec.__p11RemainingHudText = pill;
    rec.p11RemainingEnemiesText = pill;
    rec.p11RemainingEnemiesBg = pill;
  }

  if (sim.inHub || scene.fullMapOpen) {
    pill.setVisible(false);
    return;
  }

  const room = sim.getCurrentRoom?.();
  let aliveCombat = 0;
  let hasBoss = false;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (!e.isDummy && e.hp > 0) {
      aliveCombat += 1;
      if (e.isBoss) hasBoss = true;
    }
  }

  if (!room || aliveCombat <= 0 || hasBoss || room.cleared) {
    pill.setVisible(false);
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__P11_REMAINING_HUD_TEXT__ = '';
    }
    return;
  }

  const isChallenge = Boolean(
    room.isChallenge || (room as unknown as Record<string, unknown>).isChallengeRoom,
  );
  const label = computeRemainingEnemiesText(
    aliveCombat,
    room.wavesSpawned || 1,
    room.wavesTotal || 1,
    isChallenge,
  );
  pill.setText(label);
  pill.setColor(isChallenge ? '#FBBF24' : '#FDE68A');
  pill.setPosition(pillX, pillY);
  pill.setVisible(true);
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__P11_REMAINING_HUD_TEXT__ = label;
  }
}

export function drawP11DramaWorldOverlays(scene: GameScene): void {
  const sim = scene?.transport?.getSim?.();
  const g: Phaser.GameObjects.Graphics | undefined = scene?.telegraphGraphics;
  if (!sim || !g) return;
  const floorG: Phaser.GameObjects.Graphics = scene?.groundHazardGraphics ?? g;

  // 1. Vengeful Elite 0.5s Death-Ring Telegraphs (floor layer depth 16, 4 Cutout brackets)
  if (Array.isArray(sim.pendingVengefulRings)) {
    for (let i = 0; i < sim.pendingVengefulRings.length; i++) {
      const ring = sim.pendingVengefulRings[i]!;
      const r = 42;
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * Math.PI * 2;
        fillTaperedArcRibbon(floorG, ring.x, ring.y, r, ang - 0.26, ang + 0.26, 2.4, 0xf43f5e, 0.88, 3, 1.2);
      }
    }
  }

  // 2. Overlapping Wave Summon Rings & Boss Phase Transition / Soft Enrage Auras
  for (let i = 0; i < sim.enemies.length; i++) {
    const e: SimEnemyState = sim.enemies[i]!;
    if (e.hp <= 0) continue;

    // Enhanced Overlapping Wave Summon Ring (waveIndex >= 2)
    if (e.aiState === 'spawning' && (e.waveIndex ?? 1) >= 2) {
      const ratio = Math.max(0, Math.min(1, 1 - e.stateTimer / 0.8));
      const outerR = e.radius + 14;
      const ringR = outerR * (1.2 - ratio * 0.2);
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * Math.PI * 2 + sim.tick * 0.04;
        fillTaperedArcRibbon(floorG, e.x, e.y, ringR, ang - 0.28, ang + 0.28, 2.2, 0xf97316, 0.85, 3, 1.2);
      }
    }

    if (!e.isBoss) continue;

    // 3. Boss Phase Transition 1.2s Invulnerable Roar Hex Cage
    const transTimer = Number(e.bossPhaseTransitionTimer ?? 0);
    if (transTimer > 0) {
      const elapsedSec = Math.max(0, 1.2 - transTimer);
      const cageG = (scene as unknown as { bossOverGraphics?: Phaser.GameObjects.Graphics }).bossOverGraphics ?? g;
      renderBossPhaseInvulnCage(cageG, e.x, e.y, e.radius + 22, elapsedSec, 1.2);
    }

    // 4. Boss Soft Enrage (>= 90s) Crimson Flame Horns (depth 30.8)
    const eRec = e as unknown as Record<string, unknown>;
    const elapsed = Number(e.bossCombatElapsedSec ?? eRec.bossFightElapsedSec ?? 0);
    const enrageLvl = Number(e.bossEnrageLevel ?? eRec.bossEnrageStacks ?? 0);
    if (elapsed >= 90 || enrageLvl > 0) {
      const lvl = Math.max(1, enrageLvl || Math.floor((elapsed - 90) / 15) + 1);
      const hornCount = Math.max(3, Math.min(5, 2 + lvl));
      const bossOverG = (scene as unknown as { bossOverGraphics?: Phaser.GameObjects.Graphics }).bossOverGraphics ?? g;
      const shoulderY = e.y - e.radius * 0.45;
      for (let h = 0; h < hornCount; h++) {
        const u = hornCount > 1 ? h / (hornCount - 1) - 0.5 : 0;
        const x0 = e.x + u * e.radius * 1.35;
        const y0 = shoulderY;
        const cx = x0 + u * 10;
        const cy = y0 - 16 - Math.sin(sim.tick * 0.1 + h) * 4;
        const x2 = x0 + u * 20;
        const y2 = y0 - 28 - Math.sin(sim.tick * 0.12 + h * 1.4) * 6;
        fillTaperedQuadraticBezier(
          bossOverG,
          x0,
          y0,
          cx,
          cy,
          x2,
          y2,
          2.4,
          3.0,
          0.2,
          0xe84545,
          0.95,
          6,
          1.8,
        );
      }
    }
  }
}
