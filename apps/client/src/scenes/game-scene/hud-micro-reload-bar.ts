import {
  HEAT_ORANGE_MAX,
  HEAT_ORANGE_MIN,
  PERFECT_RELOAD_WINDOW_MAX,
  PERFECT_RELOAD_WINDOW_MIN,
  WEAPONS,
  clamp,
  type SimPlayerState,
  type WeaponStatsDef,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';

export interface WeaponCadenceHudLabel {
  barText: string;
  cardMetaText: string;
  compareStatText: string;
  mode: 'CLIP_RELOAD' | 'HEAT_VENT' | 'MELEE_COMBO';
  isFinaleOrSweetSpot: boolean;
}

export function formatWeaponCadenceHudLabel(
  p: SimPlayerState,
  wDef: WeaponStatsDef,
  locale: 'vi' | 'en',
): WeaponCadenceHudLabel {
  const mode = wDef.cadenceKind;
  const dmg = wDef.damage;
  const isEn = locale === 'en';

  if (mode === 'HEAT_VENT') {
    const rawHeat = p.weaponHeat ?? 0;
    const heat = Math.round(rawHeat);
    const isOverheated = (p.overheatLockTimer ?? 0) > 0;
    const inSweetSpot = !isOverheated && rawHeat >= 65 && rawHeat <= 95;
    const barText = isOverheated
      ? isEn ? 'OVERHEAT!' : 'QUÁ NHIỆT!'
      : inSweetSpot
        ? `${heat}% [R]`
        : isEn ? `${heat}% Heat` : `${heat}% Nhiệt`;
    const cardMetaText = isEn ? `DMG ${dmg} · Heat ${wDef.heatPerShot}%/shot` : `ST ${dmg} · Nhiệt ${wDef.heatPerShot}%/phát`;
    const compareStatText = isEn ? `Heat: ${wDef.heatPerShot}%/shot · Vent [R]` : `Nhiệt: ${wDef.heatPerShot}%/phát · Xả [R]`;
    return { barText, cardMetaText, compareStatText, mode, isFinaleOrSweetSpot: inSweetSpot };
  }

  if (mode === 'MELEE_COMBO') {
    const step = p.meleeComboStep ?? 0;
    const hitNum = (step % 3) + 1;
    const isParryStep = step === 2;
    const barText = isEn
      ? `Hit ${hitNum}/3${isParryStep ? ' PARRY!' : ''}`
      : `Đòn ${hitNum}/3${isParryStep ? ' PARRY!' : ''}`;
    const cardMetaText = isEn ? `DMG ${dmg} · 3-Hit Combo` : `ST ${dmg} · Combo 3 đòn`;
    const compareStatText = isEn ? '3-Hit Combo · Hit 3 Parry' : 'Combo 3 đòn · Parry Đòn 3';
    return { barText, cardMetaText, compareStatText, mode, isFinaleOrSweetSpot: isParryStep };
  }

  const clipMax = Math.max(1, p.clipMax || wDef.clipSize || 1);
  const clipAmmo = clamp(p.clipAmmo ?? clipMax, 0, clipMax);
  const isReloading = (p.reloadTimer ?? 0) > 0;
  const isOverclocked = Boolean(p.overclockedNextShot);
  const barText = isReloading
    ? isEn ? 'RELOAD [R]' : 'NẠP [R]'
    : isOverclocked
      ? isEn ? '⚡ OVERCLOCK' : '⚡ QUÁ TẢI'
      : `${clipAmmo}/${clipMax}`;
  const cardMetaText = isEn ? `DMG ${dmg} · Clip ${wDef.clipSize} (${wDef.reloadDurationSec}s)` : `ST ${dmg} · Băng ${wDef.clipSize} (${wDef.reloadDurationSec}s)`;
  const compareStatText = isEn ? `Clip: ${wDef.clipSize} · Reload: ${wDef.reloadDurationSec}s` : `Băng: ${wDef.clipSize}v · Nạp: ${wDef.reloadDurationSec}s`;

  return {
    barText,
    cardMetaText,
    compareStatText,
    mode: 'CLIP_RELOAD',
    isFinaleOrSweetSpot: !isReloading && (clipAmmo === 1 || isOverclocked),
  };
}

export function drawHudWeaponCadenceBar(
  g: Phaser.GameObjects.Graphics,
  p: SimPlayerState,
  wDef: WeaponStatsDef,
  x = 66,
  y = 44,
  width = 96,
  height = 7.5,
): void {
  const mode = wDef.cadenceKind;
  g.fillStyle(0x1e293b, 0.9);
  g.fillRect(x - 1, y - 1, width + 2, height + 2);
  g.fillStyle(0x080b10, 0.95);
  g.fillRect(x, y, width, height);

  if (mode === 'HEAT_VENT') {
    const rawHeat = clamp(p.weaponHeat ?? 0, 0, 100);
    const isOverheated = (p.overheatLockTimer ?? 0) > 0 || rawHeat > 95;
    const inOrangeZone = !isOverheated && rawHeat >= 65 && rawHeat <= 95;
    g.fillStyle(0xf97316, 0.24);
    g.fillRect(x + width * 0.65, y + 0.5, width * 0.3, height - 1);

    const fillW = Math.max(0, (rawHeat / 100) * width);
    if (fillW > 0.5) {
      const fillColor = isOverheated
        ? 0xef4444
        : inOrangeZone
          ? 0xf97316
          : rawHeat >= 35
            ? 0xfacc15
            : 0x38bdf8;
      g.fillStyle(fillColor, 0.96);
      g.fillRect(x, y + 0.5, fillW, height - 1);
      g.fillStyle(0xffffff, 0.22);
      g.fillRect(x + 0.5, y + 1, Math.max(1, fillW - 1), 1.2);
    }
    return;
  }

  if (mode === 'MELEE_COMBO') {
    const maxSegments = 3;
    const gap = 2;
    const segW = (width - gap * (maxSegments - 1)) / maxSegments;
    const activeStep = (p.meleeComboStep ?? 0) % 3;
    for (let i = 0; i < maxSegments; i += 1) {
      const sx = x + i * (segW + gap);
      if (i > activeStep) {
        g.fillStyle(0x111520, 0.6);
        g.fillRect(sx, y + 0.5, segW, height - 1);
        continue;
      }
      const isParrySeg = i === 2;
      g.fillStyle(isParrySeg ? 0xfef08a : 0xfacc15, 0.98);
      g.fillRect(sx, y + 0.5, segW, height - 1);
      if (isParrySeg) {
        g.fillStyle(0xffffff, 0.45);
        g.fillRect(sx, y + 0.5, segW, 1.5);
      }
    }
    return;
  }

  const clipMax = Math.max(1, p.clipMax || wDef.clipSize || 1);
  const clipAmmo = clamp(p.clipAmmo ?? clipMax, 0, clipMax);
  const reloadTimer = p.reloadTimer ?? 0;

  if (reloadTimer > 0) {
    const totalReload = Math.max(0.1, wDef.reloadDurationSec || 1.2);
    const progress = clamp(1 - reloadTimer / totalReload, 0, 1);
    g.fillStyle(0x38bdf8, 0.28);
    g.fillRect(x + width * 0.45, y + 0.5, width * 0.25, height - 1);
    const fillW = Math.max(1, progress * width);
    g.fillStyle(progress >= 0.45 && progress <= 0.7 ? 0x38bdf8 : 0xf59e0b, 0.96);
    g.fillRect(x, y + 0.5, fillW, height - 1);
    return;
  }

  const maxSegments = Math.min(8, Math.max(1, clipMax));
  const gap = maxSegments > 1 ? 1.5 : 0;
  const segW = (width - gap * (maxSegments - 1)) / maxSegments;
  const filledSegs = clipAmmo <= 0 ? 0 : Math.max(1, Math.round((clipAmmo / clipMax) * maxSegments));
  for (let i = 0; i < maxSegments; i += 1) {
    const sx = x + i * (segW + gap);
    if (i >= filledSegs) {
      g.fillStyle(0x111520, 0.6);
      g.fillRect(sx, y + 0.5, segW, height - 1);
      continue;
    }
    const segColor = p.overclockedNextShot ? 0x38bdf8 : i === 0 ? 0xf97316 : 0xfacc15;
    g.fillStyle(segColor, 0.98);
    g.fillRect(sx, y + 0.5, segW, height - 1);
    g.fillStyle(0xffffff, 0.22);
    g.fillRect(sx + 0.5, y + 1, Math.max(1, segW - 1), 1.2);
  }
}

export interface MicroReloadBarState {
  visible: boolean;
  mode: 'CLIP_RELOAD' | 'HEAT_VENT' | 'MELEE_COMBO';
  width: 32;
  height: 5;
  borderPx: 1;
  borderColor: number;
  bgColor: number;
  progress: number;
  sweetSpotStart: number;
  sweetSpotEnd: number;
  sweetSpotColor: number;
  fillColor: number;
  cursorColor: number;
  inGoldenWindow: boolean;
  inOrangeZone: boolean;
  lockedOut: boolean;
}

export type MicroBarFeedbackKind = 'perfect_reload' | 'tactical_vent' | 'reload_misfire';

export interface MicroBarFeedbackSpec {
  kind: MicroBarFeedbackKind;
  text: string;
  textColor: string;
  flashColor: number;
  durationSec: number;
}

export function resolveMicroBarFeedbackSpec(
  kind: MicroBarFeedbackKind,
  locale: 'vi' | 'en' = 'vi',
): MicroBarFeedbackSpec {
  const isEn = locale === 'en';
  if (kind === 'perfect_reload') {
    return { kind, text: isEn ? 'PERFECT!' : 'HOÀN HẢO!', textColor: '#FACC15', flashColor: 0xfacc15, durationSec: 0.28 };
  }
  if (kind === 'tactical_vent') {
    return { kind, text: isEn ? 'VENTED!' : 'XẢ ÁP!', textColor: '#38BDF8', flashColor: 0x38bdf8, durationSec: 0.28 };
  }
  return { kind, text: isEn ? 'MISFIRE!' : 'KẸT ĐẠN!', textColor: '#EF4444', flashColor: 0xef4444, durationSec: 0.32 };
}

export function computeMicroReloadBarState(
  p: SimPlayerState,
  wDefArg?: WeaponStatsDef,
): MicroReloadBarState {
  const slots = p.weaponSlots ?? (p as { loadout?: string[] }).loadout ?? ['knight_sword'];
  const activeWepId = slots[p.activeWeaponSlot ?? 0] ?? slots[0] ?? 'knight_sword';
  const wDef = wDefArg ?? WEAPONS[activeWepId] ?? WEAPONS.knight_sword!;
  const mode = wDef.cadenceKind;
  const base = { width: 32 as const, height: 5 as const, borderPx: 1 as const, borderColor: 0x141019, bgColor: 0x0c0a12 };

  if (mode === 'MELEE_COMBO') {
    return {
      ...base,
      visible: false,
      mode: 'MELEE_COMBO',
      progress: 0,
      sweetSpotStart: 0,
      sweetSpotEnd: 0,
      sweetSpotColor: 0,
      fillColor: 0xfacc15,
      cursorColor: 0xffffff,
      inGoldenWindow: false,
      inOrangeZone: false,
      lockedOut: false,
    };
  }

  if (mode === 'HEAT_VENT') {
    const rawHeat = clamp(p.weaponHeat ?? 0, 0, 100);
    const overheated = (p.overheatLockTimer ?? 0) > 0;
    const visible = rawHeat > 0 || overheated;
    const inOrangeZone = !overheated && rawHeat >= HEAT_ORANGE_MIN && rawHeat <= HEAT_ORANGE_MAX;
    const fillColor = overheated ? 0xef4444 : inOrangeZone ? 0xf97316 : rawHeat > HEAT_ORANGE_MAX ? 0xfb7185 : 0x38bdf8;
    return {
      ...base,
      visible,
      mode: 'HEAT_VENT',
      progress: overheated ? 1 : clamp(rawHeat / 100, 0, 1),
      sweetSpotStart: HEAT_ORANGE_MIN / 100,
      sweetSpotEnd: HEAT_ORANGE_MAX / 100,
      sweetSpotColor: 0xf97316,
      fillColor,
      cursorColor: overheated ? 0xfca5a5 : 0xffffff,
      inGoldenWindow: false,
      inOrangeZone,
      lockedOut: overheated,
    };
  }

  const totalReload = Math.max(0.001, p.reloadDuration || wDef.reloadDurationSec || 1.2);
  const reloadTimer = p.reloadTimer ?? 0;
  const visible = reloadTimer > 0 && totalReload > 0;
  const progress = visible ? clamp(1 - reloadTimer / totalReload, 0, 1) : 0;
  const lockedOut = Boolean(p.reloadLockout);
  const inGoldenWindow = visible && !lockedOut && progress >= PERFECT_RELOAD_WINDOW_MIN && progress <= PERFECT_RELOAD_WINDOW_MAX;
  return {
    ...base,
    visible,
    mode: 'CLIP_RELOAD',
    progress,
    sweetSpotStart: PERFECT_RELOAD_WINDOW_MIN,
    sweetSpotEnd: PERFECT_RELOAD_WINDOW_MAX,
    sweetSpotColor: 0xfacc15,
    fillColor: lockedOut ? 0xef4444 : inGoldenWindow ? 0xfacc15 : 0x38bdf8,
    cursorColor: lockedOut ? 0xfca5a5 : 0xffffff,
    inGoldenWindow,
    inOrangeZone: false,
    lockedOut,
  };
}

export function drawFootMicroReloadBar(
  g: Phaser.GameObjects.Graphics,
  footX: number,
  footY: number,
  p: SimPlayerState,
  wDefArg?: WeaponStatsDef,
  flashColor?: number | null,
  flashAlpha = 0,
): MicroReloadBarState {
  const state = computeMicroReloadBarState(p, wDefArg);
  const hasFlash = Boolean(flashColor && flashAlpha > 0.01);
  if (!state.visible && !hasFlash) return state;

  const x = Math.round(footX - state.width * 0.5);
  const y = Math.round(footY);
  const innerX = x + 1;
  const innerY = y + 1;
  const innerW = state.width - 2;
  const innerH = state.height - 2;

  g.fillStyle(state.bgColor, 0.92);
  g.fillRect(x, y, state.width, state.height);

  if (state.visible) {
    const swX = innerX + Math.round(innerW * state.sweetSpotStart);
    const swW = Math.max(2, Math.round(innerW * (state.sweetSpotEnd - state.sweetSpotStart)));
    const fillW = Math.max(1, Math.round(innerW * state.progress));
    if (state.mode === 'CLIP_RELOAD') {
      g.fillStyle(state.fillColor, state.lockedOut ? 0.88 : 0.45);
      g.fillRect(innerX, innerY, fillW, innerH);
      if (!state.lockedOut) {
        g.fillStyle(state.sweetSpotColor, state.inGoldenWindow ? 0.96 : 0.72);
        g.fillRect(swX, innerY, swW, innerH);
      }
      const curX = innerX + Math.min(innerW - 1, Math.max(0, Math.round((innerW - 1) * state.progress)));
      g.fillStyle(state.cursorColor, 1);
      g.fillRect(curX, y, 1.5, state.height);
    } else if (state.mode === 'HEAT_VENT') {
      g.fillStyle(state.sweetSpotColor, state.inOrangeZone ? 0.55 : 0.3);
      g.fillRect(swX, innerY, swW, innerH);
      g.fillStyle(state.fillColor, state.lockedOut ? 0.95 : 0.9);
      g.fillRect(innerX, innerY, fillW, innerH);
    }
  }
  if (hasFlash && flashColor) {
    g.fillStyle(flashColor, clamp(flashAlpha, 0, 1));
    g.fillRect(x, y, state.width, state.height);
  }
  g.lineStyle(state.borderPx, state.lockedOut ? 0xef4444 : state.borderColor, 0.96);
  g.strokeRect(x, y, state.width, state.height);
  return state;
}
