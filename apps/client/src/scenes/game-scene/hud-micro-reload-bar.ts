import { clamp, type SimPlayerState, type WeaponStatsDef } from '@ashen-pact/shared';
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

    let barText: string;
    if (isOverheated) {
      barText = isEn ? 'OVERHEAT!' : 'QUÁ NHIỆT!';
    } else if (inSweetSpot) {
      barText = `${heat}% [R]`;
    } else {
      barText = isEn ? `${heat}% Heat` : `${heat}% Nhiệt`;
    }

    const cardMetaText = isEn
      ? `DMG ${dmg} · Heat ${wDef.heatPerShot}%/shot`
      : `ST ${dmg} · Nhiệt ${wDef.heatPerShot}%/phát`;
    const compareStatText = isEn
      ? `Heat: ${wDef.heatPerShot}%/shot · Vent [R]`
      : `Nhiệt: ${wDef.heatPerShot}%/phát · Xả [R]`;

    return {
      barText,
      cardMetaText,
      compareStatText,
      mode,
      isFinaleOrSweetSpot: inSweetSpot,
    };
  }

  if (mode === 'MELEE_COMBO') {
    const step = p.meleeComboStep ?? 0;
    const hitNum = (step % 3) + 1;
    const isParryStep = step === 2;
    const barText = isEn
      ? `Hit ${hitNum}/3${isParryStep ? ' PARRY!' : ''}`
      : `Đòn ${hitNum}/3${isParryStep ? ' PARRY!' : ''}`;
    const cardMetaText = isEn ? `DMG ${dmg} · 3-Hit Combo` : `ST ${dmg} · Combo 3 đòn`;
    const compareStatText = isEn
      ? '3-Hit Combo · Hit 3 Parry'
      : 'Combo 3 đòn · Parry Đòn 3';

    return {
      barText,
      cardMetaText,
      compareStatText,
      mode,
      isFinaleOrSweetSpot: isParryStep,
    };
  }

  // Default: CLIP_RELOAD
  const clipMax = Math.max(1, p.clipMax || wDef.clipSize || 1);
  const clipAmmo = clamp(p.clipAmmo ?? clipMax, 0, clipMax);
  const isReloading = (p.reloadTimer ?? 0) > 0;
  const isOverclocked = Boolean(p.overclockedNextShot);

  let barText: string;
  if (isReloading) {
    barText = isEn ? 'RELOAD [R]' : 'NẠP [R]';
  } else if (isOverclocked) {
    barText = isEn ? '⚡ OVERCLOCK' : '⚡ QUÁ TẢI';
  } else {
    barText = `${clipAmmo}/${clipMax}`;
  }

  const cardMetaText = isEn
    ? `DMG ${dmg} · Clip ${wDef.clipSize} (${wDef.reloadDurationSec}s)`
    : `ST ${dmg} · Băng ${wDef.clipSize} (${wDef.reloadDurationSec}s)`;
  const compareStatText = isEn
    ? `Clip: ${wDef.clipSize} · Reload: ${wDef.reloadDurationSec}s`
    : `Băng: ${wDef.clipSize}v · Nạp: ${wDef.reloadDurationSec}s`;

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

  // Outer border & dark track background
  g.fillStyle(0x1e293b, 0.9);
  g.fillRect(x - 1, y - 1, width + 2, height + 2);
  g.fillStyle(0x080b10, 0.95);
  g.fillRect(x, y, width, height);

  if (mode === 'HEAT_VENT') {
    const rawHeat = clamp(p.weaponHeat ?? 0, 0, 100);
    const isOverheated = (p.overheatLockTimer ?? 0) > 0 || rawHeat > 95;
    const inOrangeZone = !isOverheated && rawHeat >= 65 && rawHeat <= 95;

    // Highlight sweet-spot vent zone (65% - 95%) on track
    const zoneStartX = x + width * 0.65;
    const zoneW = width * 0.3;
    g.fillStyle(0xf97316, 0.24);
    g.fillRect(zoneStartX, y + 0.5, zoneW, height - 1);

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
      const isFilled = i <= activeStep;
      const isParrySeg = i === 2;
      if (!isFilled) {
        g.fillStyle(0x111520, 0.6);
        g.fillRect(sx, y + 0.5, segW, height - 1);
        continue;
      }
      const col = isParrySeg ? 0xfef08a : 0xfacc15;
      g.fillStyle(col, 0.98);
      g.fillRect(sx, y + 0.5, segW, height - 1);
      if (isParrySeg) {
        g.fillStyle(0xffffff, 0.45);
        g.fillRect(sx, y + 0.5, segW, 1.5);
      }
    }
    return;
  }

  // CLIP_RELOAD
  const clipMax = Math.max(1, p.clipMax || wDef.clipSize || 1);
  const clipAmmo = clamp(p.clipAmmo ?? clipMax, 0, clipMax);
  const reloadTimer = p.reloadTimer ?? 0;

  if (reloadTimer > 0) {
    const totalReload = Math.max(0.1, wDef.reloadDurationSec || 1.2);
    const progress = clamp(1 - reloadTimer / totalReload, 0, 1);
    // Sweet-spot window (45% - 70%) marker
    g.fillStyle(0x38bdf8, 0.28);
    g.fillRect(x + width * 0.45, y + 0.5, width * 0.25, height - 1);
    const fillW = Math.max(1, progress * width);
    const inSweet = progress >= 0.45 && progress <= 0.7;
    g.fillStyle(inSweet ? 0x38bdf8 : 0xf59e0b, 0.96);
    g.fillRect(x, y + 0.5, fillW, height - 1);
    return;
  }

  const maxSegments = Math.min(8, Math.max(1, clipMax));
  const gap = maxSegments > 1 ? 1.5 : 0;
  const segW = (width - gap * (maxSegments - 1)) / maxSegments;
  const filledSegs =
    clipAmmo <= 0 ? 0 : Math.max(1, Math.round((clipAmmo / clipMax) * maxSegments));

  for (let i = 0; i < maxSegments; i += 1) {
    const sx = x + i * (segW + gap);
    if (i >= filledSegs) {
      g.fillStyle(0x111520, 0.6);
      g.fillRect(sx, y + 0.5, segW, height - 1);
      continue;
    }
    const isFinaleSeg = i === 0;
    const segColor = p.overclockedNextShot
      ? 0x38bdf8
      : isFinaleSeg
        ? 0xf97316
        : 0xfacc15;
    g.fillStyle(segColor, 0.98);
    g.fillRect(sx, y + 0.5, segW, height - 1);
    g.fillStyle(0xffffff, 0.22);
    g.fillRect(sx + 0.5, y + 1, Math.max(1, segW - 1), 1.2);
  }
}
