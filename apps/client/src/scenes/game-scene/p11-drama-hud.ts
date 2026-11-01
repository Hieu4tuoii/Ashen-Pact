import type Phaser from 'phaser';
import { i18n, type SimEnemyState, WORLD_VIEW_WIDTH } from '@ashen-pact/shared';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import type { GameScene } from '../GameScene.js';

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

  const pulse = 0.5 + 0.5 * Math.sin(sim.tick * 0.22);

  // 1. Vengeful Elite 0.5s Death-Ring Telegraphs (floor layer depth 16, translucent fill)
  if (Array.isArray(sim.pendingVengefulRings)) {
    for (let i = 0; i < sim.pendingVengefulRings.length; i++) {
      const ring = sim.pendingVengefulRings[i]!;
      const ratio = Math.max(0, Math.min(1, 1 - ring.timerSec / 0.5));
      const r = 42;
      floorG.fillStyle(0xa855f7, 0.04 + ratio * 0.04);
      floorG.fillCircle(ring.x, ring.y, r * ratio);
      floorG.lineStyle(2.5, 0xf43f5e, 0.85);
      floorG.strokeCircle(ring.x, ring.y, r);
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        floorG.lineStyle(1.5, 0xfbbf24, 0.75);
        floorG.lineBetween(
          ring.x + Math.cos(ang) * 10,
          ring.y + Math.sin(ang) * 10,
          ring.x + Math.cos(ang) * r,
          ring.y + Math.sin(ang) * r,
        );
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
      floorG.lineStyle(2.5, 0xf97316, 0.85);
      floorG.strokeCircle(e.x, e.y, outerR * (1.2 - ratio * 0.2));
      floorG.fillStyle(0xfbbf24, 0.05 + 0.03 * pulse);
      floorG.fillCircle(e.x, e.y, outerR * 0.75);
    }

    if (!e.isBoss) continue;

    // 3. Boss Phase Transition 1.2s Invulnerable Roar Shield & Shockwave
    const transTimer = Number(e.bossPhaseTransitionTimer ?? 0);
    if (transTimer > 0) {
      const p = 1 - Math.max(0, Math.min(1, transTimer / 1.2));
      const shieldR = e.radius + 22;
      const waveR = e.radius + 24 + p * 180;

      // Expanding bullet-clearing roar shockwave
      g.lineStyle(4, 0xfef08a, 0.9 * (1 - p * 0.5));
      g.strokeCircle(e.x, e.y, waveR);
      g.lineStyle(2, 0xf97316, 0.75);
      g.strokeCircle(e.x, e.y, waveR * 0.72);

      // Invulnerable hexagonal/golden barrier around Boss
      g.fillStyle(0xfef08a, 0.22 + 0.12 * pulse);
      g.fillCircle(e.x, e.y, shieldR);
      g.lineStyle(3.5, 0xffffff, 0.95);
      g.strokeCircle(e.x, e.y, shieldR);

      // 8 radial roar rays
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2 + sim.tick * 0.04;
        g.lineStyle(2.5, 0xfde047, 0.85);
        g.lineBetween(
          e.x + Math.cos(ang) * (e.radius + 6),
          e.y + Math.sin(ang) * (e.radius + 6),
          e.x + Math.cos(ang) * (shieldR + 28),
          e.y + Math.sin(ang) * (shieldR + 28),
        );
      }
    }

    // 4. Boss Soft Enrage (>= 90s) Crimson Aura & Arena Perimeter Pulse
    const eRec = e as unknown as Record<string, unknown>;
    const elapsed = Number(e.bossCombatElapsedSec ?? eRec.bossFightElapsedSec ?? 0);
    const enrageLvl = Number(e.bossEnrageLevel ?? eRec.bossEnrageStacks ?? 0);
    if (elapsed >= 90 || enrageLvl > 0) {
      const lvl = Math.max(1, enrageLvl || Math.floor((elapsed - 90) / 15) + 1);
      const auraR = e.radius + 16 + pulse * 8;
      floorG.fillStyle(0xef4444, 0.05 + Math.min(0.04, lvl * 0.01));
      floorG.fillCircle(e.x, e.y, auraR);
      floorG.lineStyle(3, 0xff2a2a, 0.88);
      floorG.strokeCircle(e.x, e.y, auraR);
      floorG.lineStyle(1.8, 0xfbbf24, 0.78);
      floorG.strokeCircle(e.x, e.y, auraR + 7);

      // Crimson enrage crown spikes above Boss
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2 - sim.tick * 0.06;
        const r1 = e.radius + 8;
        const r2 = auraR + 12;
        g.lineStyle(2.2, 0xef4444, 0.88);
        g.lineBetween(
          e.x + Math.cos(ang) * r1,
          e.y + Math.sin(ang) * r1,
          e.x + Math.cos(ang) * r2,
          e.y + Math.sin(ang) * r2,
        );
      }
    }
  }
}
