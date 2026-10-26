import { WEAPONS, WorldSim } from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import {
  drawHudWeaponCadenceBar,
  formatWeaponCadenceHudLabel,
} from '../src/scenes/game-scene/hud-micro-reload-bar.js';

describe('P0A.5 — HUD Weapon Cadence Bar & Labels (CLIP_RELOAD / HEAT_VENT / MELEE_COMBO)', () => {
  it('formats CLIP_RELOAD cadence labels in Vietnamese and English (normal, reload, overclock, finale shot)', () => {
    const sim = new WorldSim(42);
    const p = sim.player;
    const weaponList = Object.values(WEAPONS);
    const clipWeapon = weaponList.find((w) => w.cadenceKind === 'CLIP_RELOAD') ?? weaponList[0];

    p.clipMax = clipWeapon.clipSize;
    p.clipAmmo = clipWeapon.clipSize;
    p.reloadTimer = 0;
    p.overclockedNextShot = false;

    const normalVi = formatWeaponCadenceHudLabel(p, clipWeapon, 'vi');
    expect(normalVi.mode).toBe('CLIP_RELOAD');
    expect(normalVi.barText).toBe(`${clipWeapon.clipSize}/${clipWeapon.clipSize}`);
    expect(normalVi.cardMetaText).toBe(
      `ST ${clipWeapon.damage} · Băng ${clipWeapon.clipSize} (${clipWeapon.reloadDurationSec}s)`,
    );
    expect(normalVi.compareStatText).toBe(
      `Băng: ${clipWeapon.clipSize}v · Nạp: ${clipWeapon.reloadDurationSec}s`,
    );
    expect(normalVi.isFinaleOrSweetSpot).toBe(false);

    const normalEn = formatWeaponCadenceHudLabel(p, clipWeapon, 'en');
    expect(normalEn.barText).toBe(`${clipWeapon.clipSize}/${clipWeapon.clipSize}`);
    expect(normalEn.cardMetaText).toBe(
      `DMG ${clipWeapon.damage} · Clip ${clipWeapon.clipSize} (${clipWeapon.reloadDurationSec}s)`,
    );
    expect(normalEn.compareStatText).toBe(
      `Clip: ${clipWeapon.clipSize} · Reload: ${clipWeapon.reloadDurationSec}s`,
    );

    // Finale shot (clipAmmo === 1)
    p.clipAmmo = 1;
    const finaleVi = formatWeaponCadenceHudLabel(p, clipWeapon, 'vi');
    expect(finaleVi.barText).toBe(`1/${clipWeapon.clipSize}`);
    expect(finaleVi.isFinaleOrSweetSpot).toBe(true);

    // Overclocked next shot
    p.overclockedNextShot = true;
    const overclockVi = formatWeaponCadenceHudLabel(p, clipWeapon, 'vi');
    const overclockEn = formatWeaponCadenceHudLabel(p, clipWeapon, 'en');
    expect(overclockVi.barText).toBe('⚡ QUÁ TẢI');
    expect(overclockEn.barText).toBe('⚡ OVERCLOCK');

    // Reloading
    p.reloadTimer = 0.8;
    const reloadVi = formatWeaponCadenceHudLabel(p, clipWeapon, 'vi');
    const reloadEn = formatWeaponCadenceHudLabel(p, clipWeapon, 'en');
    expect(reloadVi.barText).toBe('NẠP [R]');
    expect(reloadEn.barText).toBe('RELOAD [R]');
  });

  it('formats HEAT_VENT cadence labels in Vietnamese and English (cool, orange zone 65%-95%, overheat lock)', () => {
    const sim = new WorldSim(42);
    const p = sim.player;
    const heatWeapon = Object.values(WEAPONS).find((w) => w.cadenceKind === 'HEAT_VENT');
    expect(heatWeapon).toBeDefined();
    if (!heatWeapon) return;

    p.weaponHeat = 30;
    p.overheatLockTimer = 0;

    const coolVi = formatWeaponCadenceHudLabel(p, heatWeapon, 'vi');
    const coolEn = formatWeaponCadenceHudLabel(p, heatWeapon, 'en');
    expect(coolVi.mode).toBe('HEAT_VENT');
    expect(coolVi.barText).toBe('30% Nhiệt');
    expect(coolEn.barText).toBe('30% Heat');
    expect(coolVi.cardMetaText).toBe(
      `ST ${heatWeapon.damage} · Nhiệt ${heatWeapon.heatPerShot}%/phát`,
    );
    expect(coolEn.cardMetaText).toBe(
      `DMG ${heatWeapon.damage} · Heat ${heatWeapon.heatPerShot}%/shot`,
    );
    expect(coolVi.compareStatText).toBe(`Nhiệt: ${heatWeapon.heatPerShot}%/phát · Xả [R]`);
    expect(coolEn.compareStatText).toBe(`Heat: ${heatWeapon.heatPerShot}%/shot · Vent [R]`);
    expect(coolVi.isFinaleOrSweetSpot).toBe(false);

    // Orange zone (65% - 95%)
    p.weaponHeat = 80;
    const orangeVi = formatWeaponCadenceHudLabel(p, heatWeapon, 'vi');
    const orangeEn = formatWeaponCadenceHudLabel(p, heatWeapon, 'en');
    expect(orangeVi.barText).toBe('80% [R]');
    expect(orangeEn.barText).toBe('80% [R]');
    expect(orangeVi.isFinaleOrSweetSpot).toBe(true);

    // Overheat lock
    p.overheatLockTimer = 1.2;
    const overheatVi = formatWeaponCadenceHudLabel(p, heatWeapon, 'vi');
    const overheatEn = formatWeaponCadenceHudLabel(p, heatWeapon, 'en');
    expect(overheatVi.barText).toBe('QUÁ NHIỆT!');
    expect(overheatEn.barText).toBe('OVERHEAT!');
  });

  it('formats MELEE_COMBO cadence labels in Vietnamese and English (hits 1, 2, and 3 PARRY!)', () => {
    const sim = new WorldSim(42);
    const p = sim.player;
    const meleeWeapon = Object.values(WEAPONS).find((w) => w.cadenceKind === 'MELEE_COMBO');
    expect(meleeWeapon).toBeDefined();
    if (!meleeWeapon) return;

    p.meleeComboStep = 0;
    const hit1Vi = formatWeaponCadenceHudLabel(p, meleeWeapon, 'vi');
    const hit1En = formatWeaponCadenceHudLabel(p, meleeWeapon, 'en');
    expect(hit1Vi.mode).toBe('MELEE_COMBO');
    expect(hit1Vi.barText).toBe('Đòn 1/3');
    expect(hit1En.barText).toBe('Hit 1/3');
    expect(hit1Vi.cardMetaText).toBe(`ST ${meleeWeapon.damage} · Combo 3 đòn`);
    expect(hit1En.cardMetaText).toBe(`DMG ${meleeWeapon.damage} · 3-Hit Combo`);
    expect(hit1Vi.compareStatText).toBe('Combo 3 đòn · Parry Đòn 3');
    expect(hit1En.compareStatText).toBe('3-Hit Combo · Hit 3 Parry');
    expect(hit1Vi.isFinaleOrSweetSpot).toBe(false);

    p.meleeComboStep = 1;
    expect(formatWeaponCadenceHudLabel(p, meleeWeapon, 'vi').barText).toBe('Đòn 2/3');
    expect(formatWeaponCadenceHudLabel(p, meleeWeapon, 'en').barText).toBe('Hit 2/3');

    p.meleeComboStep = 2;
    const hit3Vi = formatWeaponCadenceHudLabel(p, meleeWeapon, 'vi');
    const hit3En = formatWeaponCadenceHudLabel(p, meleeWeapon, 'en');
    expect(hit3Vi.barText).toBe('Đòn 3/3 PARRY!');
    expect(hit3En.barText).toBe('Hit 3/3 PARRY!');
    expect(hit3Vi.isFinaleOrSweetSpot).toBe(true);
  });

  it('draws segmented clip, heat gradient, and 3-hit melee combo cadence bars with distinct palette colors', () => {
    const sim = new WorldSim(42);
    const p = sim.player;
    const fillColors: number[] = [];
    const fillRects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const mockGraphics = {
      fillStyle: (color: number) => {
        fillColors.push(color);
      },
      fillRect: (x: number, y: number, w: number, h: number) => {
        fillRects.push({ x, y, w, h });
      },
    } as unknown as Phaser.GameObjects.Graphics;

    const clipWeapon = Object.values(WEAPONS).find((w) => w.cadenceKind === 'CLIP_RELOAD')!;
    p.clipMax = clipWeapon.clipSize;
    p.clipAmmo = clipWeapon.clipSize;
    p.reloadTimer = 0;
    p.overclockedNextShot = false;
    drawHudWeaponCadenceBar(mockGraphics, p, clipWeapon);
    expect(fillColors).toContain(0xf97316); // Finale shot segment
    expect(fillColors).toContain(0xfacc15); // Normal bullet segment

    // Reloading Golden Window (45% - 70% => x + width * 0.45, width * 0.25)
    fillColors.length = 0;
    fillRects.length = 0;
    p.reloadTimer = (clipWeapon.reloadDurationSec || 1.2) * 0.45; // 55% progress (inside 45% - 70% Golden Window)
    drawHudWeaponCadenceBar(mockGraphics, p, clipWeapon, 66, 44, 96, 7.5);
    expect(fillRects).toContainEqual({
      x: 66 + 96 * 0.45,
      y: 44.5,
      w: 96 * 0.25,
      h: 6.5,
    });
    expect(fillColors[fillColors.length - 1]).toBe(0x38bdf8);

    fillColors.length = 0;
    const heatWeapon = Object.values(WEAPONS).find((w) => w.cadenceKind === 'HEAT_VENT')!;
    p.weaponHeat = 80;
    p.overheatLockTimer = 0;
    drawHudWeaponCadenceBar(mockGraphics, p, heatWeapon);
    expect(fillColors).toContain(0xf97316); // Orange sweet-spot zone

    fillColors.length = 0;
    p.overheatLockTimer = 1.0;
    drawHudWeaponCadenceBar(mockGraphics, p, heatWeapon);
    expect(fillColors).toContain(0xef4444); // Overheat crimson

    fillColors.length = 0;
    const meleeWeapon = Object.values(WEAPONS).find((w) => w.cadenceKind === 'MELEE_COMBO')!;
    p.meleeComboStep = 2;
    drawHudWeaponCadenceBar(mockGraphics, p, meleeWeapon);
    expect(fillColors).toContain(0xfef08a); // Hit 3 Parry gold-white
  });
});
