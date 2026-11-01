import {
  clamp,
  type CharacterId,
  type ElementType,
  type SimSkillZoneState,
  type SimSummonState,
  type SummonKind,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../art/palette.js';
import type { CombatFxManager } from './combat-fx.js';

export interface ClassFxSceneLightingContext {
  lighting?: {
    spawnTransientLight: (
      x: number,
      y: number,
      radius: number,
      colorHex: string,
      intensity: number,
      durationSec: number,
    ) => void;
  };
}

const COL_INK = 0x141019;
const COL_BONE = 0xfffdf5;

function resolveElementalistSigilPalette(element?: ElementType): {
  tint: number;
  lightHex: string;
  sparkElement: ElementType;
} {
  if (element === 'burn') {
    return { tint: 0xfdba74, lightHex: PALETTE.FLAME_ORANGE, sparkElement: 'burn' };
  }
  if (element === 'chill') {
    return { tint: 0x7dd3fc, lightHex: PALETTE.CYAN_FROST, sparkElement: 'chill' };
  }
  if (element === 'shock') {
    return { tint: 0xfef08a, lightHex: PALETTE.VOLT_YELLOW, sparkElement: 'shock' };
  }
  return { tint: 0xd8b4fe, lightHex: PALETTE.ELECTRIC_VIOLET, sparkElement: 'shock' };
}

/**
 * Spawns bespoke Chiaroscuro active-skill cast VFX across all 5 playable character classes.
 * Every class uses a completely distinct GLSL flipbook silhouette and transient lighting signature.
 */
export function spawnClassSkillCastVfx(
  scene: ClassFxSceneLightingContext,
  fx: CombatFxManager | undefined,
  characterId: CharacterId,
  x: number,
  y: number,
  angleRad: number,
  activeElement?: ElementType,
  isTeammate = false,
): void {
  switch (characterId) {
    case 'vanguard': {
      fx?.spawnShaderDirectional?.(x, y, 72, angleRad, 'fx_sh_aegis_crest', {
        tint: 0xfca5a5,
        ttl: 0.28,
        isTeammate,
      });
      fx?.spawnHitSparks?.(
        x + Math.cos(angleRad) * 24,
        y + Math.sin(angleRad) * 24,
        angleRad,
        { blockedByShield: true, isCrit: true, count: 6, isTeammate },
      );
      scene.lighting?.spawnTransientLight(x, y, 132, PALETTE.CRIMSON_BRIGHT, 0.9, 0.28);
      break;
    }

    case 'ranger': {
      fx?.spawnShaderDirectional?.(x, y, 88, angleRad, 'fx_sh_falcon_sonic', {
        tint: 0xfef08a,
        ttl: 0.28,
        isTeammate,
      });
      fx?.spawnHitSparks?.(
        x + Math.cos(angleRad) * 28,
        y + Math.sin(angleRad) * 28,
        angleRad,
        { isCrit: true, count: 6, isTeammate },
      );
      scene.lighting?.spawnTransientLight(x, y, 138, PALETTE.SOLAR_GOLD, 0.92, 0.28);
      break;
    }

    case 'elementalist': {
      const pal = resolveElementalistSigilPalette(activeElement);
      fx?.spawnShaderNova?.(x, y, 86, 'fx_sh_arcane_sigil', {
        tint: pal.tint,
        ttl: 0.34,
        isTeammate,
      });
      fx?.spawnHitSparks?.(x, y, angleRad, {
        isCrit: true,
        element: pal.sparkElement,
        count: 7,
        isTeammate,
      });
      scene.lighting?.spawnTransientLight(x, y, 148, pal.lightHex, 0.94, 0.32);
      break;
    }

    case 'druid': {
      fx?.spawnShaderNova?.(x, y, 84, 'fx_sh_bloom_briar', {
        ttl: 0.34,
        isTeammate,
      });
      fx?.spawnHitSparks?.(x, y, 0, {
        element: 'poison',
        count: 7,
        isTeammate,
      });
      scene.lighting?.spawnTransientLight(x, y, 142, PALETTE.LIME_GLOW, 0.92, 0.32);
      break;
    }

    case 'engineer': {
      fx?.spawnShaderNova?.(x, y, 78, 'fx_sh_anvil_storm', {
        ttl: 0.3,
        isTeammate,
      });
      fx?.spawnHitSparks?.(x, y, 0, {
        isCrit: true,
        element: 'shock',
        count: 7,
        isTeammate,
      });
      scene.lighting?.spawnTransientLight(x, y, 136, PALETTE.VOLT_YELLOW, 0.92, 0.28);
      break;
    }
  }
}

/**
 * Vanguard Phalanx Shield release shockwave — directional Aegis crest + shock cone + absorbed ordnance shrapnel.
 */
export function spawnVanguardShieldShockwaveVfx(
  scene: ClassFxSceneLightingContext,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  angleRad: number,
  storedBullets = 0,
): void {
  const reachPx = 102 + Math.min(26, Math.max(0, storedBullets) * 4);
  if (fx?.spawnShaderDirectional) {
    fx.spawnShaderDirectional(x, y, reachPx, angleRad, 'fx_sh_aegis_crest', {
      tint: storedBullets > 0 ? 0xfef08a : 0xfca5a5,
      ttl: 0.3,
    });
    fx.spawnShaderCone?.(x, y, 94, angleRad);
    if (storedBullets > 0) {
      fx.spawnShaderNova?.(x, y, 68, 'fx_sh_shrapnel_corona');
    }
    fx.spawnHitSparks?.(
      x + Math.cos(angleRad) * 32,
      y + Math.sin(angleRad) * 32,
      angleRad,
      { isCrit: true, blockedByShield: true, count: 8 },
    );
  } else {
    fx?.spawnExplosionBurst?.(x, y, 90, PALETTE.CRIMSON_BRIGHT);
  }
  scene.lighting?.spawnTransientLight(x, y, 160, PALETTE.CRIMSON_BRIGHT, 0.96, 0.32);
}

/**
 * Bespoke summon materialization VFX for Druid Sacred Tree and Engineer Tesla / Ancient Turrets.
 */
export function spawnClassSummonSpawnedVfx(
  scene: ClassFxSceneLightingContext,
  fx: CombatFxManager | undefined,
  summonKind: SummonKind | string,
  x: number,
  y: number,
): void {
  if (summonKind === 'sacred_tree' || summonKind === 'life_blossom') {
    fx?.spawnShaderNova?.(x, y, 92, 'fx_sh_bloom_briar');
    fx?.spawnHitSparks?.(x, y, 0, { element: 'poison', count: 7 });
    scene.lighting?.spawnTransientLight(x, y, 145, PALETTE.LIME_GLOW, 0.94, 0.35);
    return;
  }

  const isAncient = summonKind === 'ancient_turret';
  fx?.spawnShaderNova?.(x, y, 78, 'fx_sh_anvil_storm', {
    tint: isAncient ? 0xfef08a : 0xffffff,
  });
  fx?.spawnHitSparks?.(x, y, 0, { isCrit: true, element: 'shock', count: 7 });
  scene.lighting?.spawnTransientLight(
    x,
    y,
    140,
    isAncient ? PALETTE.SOLAR_GOLD : PALETTE.VOLT_YELLOW,
    0.94,
    0.35,
  );
}

/**
 * Engineer Co-op Tesla EMP Blast — 6-spoke electromagnetic anvil storm + radial lightning arcs.
 */
export function spawnEngineerEmpBlastVfx(
  scene: ClassFxSceneLightingContext,
  fx: CombatFxManager | undefined,
  x: number,
  y: number,
  radius: number,
): void {
  const effR = Math.max(72, radius);
  if (fx?.spawnShaderNova) {
    fx.spawnShaderNova(x, y, effR, 'fx_sh_anvil_storm');
    const boltReach = effR * 0.92;
    for (let k = 0; k < 4; k += 1) {
      const ang = (k * Math.PI) / 2 + 0.32;
      fx.spawnChainLightningArc?.(
        x + Math.cos(ang) * 16,
        y + Math.sin(ang) * 16,
        x + Math.cos(ang) * boltReach,
        y + Math.sin(ang) * boltReach,
      );
    }
    fx.spawnHitSparks?.(x, y, 0, { isCrit: true, element: 'shock', count: 10 });
  } else {
    fx?.spawnExplosionBurst?.(x, y, effR, PALETTE.VOLT_YELLOW);
  }
  scene.lighting?.spawnTransientLight(x, y, effR * 2, PALETTE.VOLT_YELLOW, 1.0, 0.38);
}

/**
 * Vanguard active Ruby Phalanx Shield overlay with faceted #141019 armor frame, prow chevron, and absorbed-bullet ruby crystals.
 */
export function drawVanguardRubyPhalanxShield(
  g: Phaser.GameObjects.Graphics,
  px: number,
  py: number,
  aimAngle: number,
  isBastionPrism: boolean,
  storedBullets: number,
  clockSec: number,
): void {
  const halfArc = isBastionPrism ? Math.PI : (60 * Math.PI) / 180;
  const startA = aimAngle - halfArc;
  const endA = aimAngle + halfArc;
  const r = isBastionPrism ? 33 : 38;

  // 1. Obsidian armor frame + crimson ruby plate + golden filigree inner crest
  g.lineStyle(8.0, COL_INK, 0.9);
  g.beginPath();
  g.arc(px, py, r, startA, endA, false);
  g.strokePath();

  g.lineStyle(4.4, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.96);
  g.beginPath();
  g.arc(px, py, r, startA, endA, false);
  g.strokePath();

  g.lineStyle(2.0, hexToNum(PALETTE.SOLAR_GOLD), 0.94);
  g.beginPath();
  g.arc(px, py, r - 4, startA, endA, false);
  g.strokePath();

  // 2. Sculpted prow spearhead chevron pointing along aimAngle
  const cos = Math.cos(aimAngle);
  const sin = Math.sin(aimAngle);
  const nx = -sin;
  const ny = cos;
  const prowX = px + cos * (r + 6.5);
  const prowY = py + sin * (r + 6.5);
  const wingBaseX = px + cos * (r - 1.5);
  const wingBaseY = py + sin * (r - 1.5);

  g.lineStyle(4.2, COL_INK, 0.92);
  g.beginPath();
  g.moveTo(wingBaseX + nx * 9, wingBaseY + ny * 9);
  g.lineTo(prowX, prowY);
  g.lineTo(wingBaseX - nx * 9, wingBaseY - ny * 9);
  g.strokePath();

  g.lineStyle(2.0, COL_BONE, 0.98);
  g.beginPath();
  g.moveTo(wingBaseX + nx * 8, wingBaseY + ny * 8);
  g.lineTo(prowX, prowY);
  g.lineTo(wingBaseX - nx * 8, wingBaseY - ny * 8);
  g.strokePath();

  // 3. Orbiting absorbed-bullet ruby charge crystals along the shield rim
  const orbs = clamp(storedBullets, 0, 6);
  for (let i = 0; i < orbs; i += 1) {
    const frac = orbs === 1 ? 0 : (i / (orbs - 1)) * 2 - 1;
    const orbA = isBastionPrism
      ? clockSec * 3.2 + (i * Math.PI * 2) / orbs
      : aimAngle + frac * halfArc * 0.72;
    const ox = px + Math.cos(orbA) * (r + 3.5);
    const oy = py + Math.sin(orbA) * (r + 3.5);
    g.fillStyle(COL_INK, 0.94);
    g.fillCircle(ox, oy, 3.8);
    g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 0.98);
    g.fillCircle(ox, oy, 2.4);
    g.fillStyle(COL_BONE, 1);
    g.fillCircle(ox, oy, 1.1);
  }
}

/**
 * Elementalist active Arcane Zone overlay: depth-16 inscribed rotating hexagram sigil (<= 0.05 fill) + elevated floating elemental core.
 */
export function drawInscribedElementalistZone(
  floorG: Phaser.GameObjects.Graphics,
  g: Phaser.GameObjects.Graphics,
  z: SimSkillZoneState,
  tick: number,
): void {
  const elHex =
    z.element === 'burn'
      ? PALETTE.FLAME_ORANGE
      : z.element === 'chill'
        ? PALETTE.CYAN_FROST
        : PALETTE.VOLT_YELLOW;
  const col = hexToNum(elHex);
  const pulse = Math.sin(tick * 0.16 + z.id) * 2.2;
  const outerR = Math.max(16, z.radius + pulse);
  const innerR = outerR * 0.84;
  const rot = tick * 0.025 + z.id * 0.7;

  // 1. Floor hazard perimeter at depth 16 (strictly <= 0.05 interior fill)
  floorG.fillStyle(col, 0.048);
  floorG.fillCircle(z.x, z.y, outerR);
  floorG.lineStyle(4.0, COL_INK, 0.72);
  floorG.strokeCircle(z.x, z.y, outerR);
  floorG.lineStyle(2.4, col, 0.92);
  floorG.strokeCircle(z.x, z.y, outerR);
  floorG.lineStyle(1.3, COL_BONE, 0.56);
  floorG.strokeCircle(z.x, z.y, innerR);

  // 2. Inscribed 6-point arcane hexagram + cardinal rune ticks on floorG
  for (let tri = 0; tri < 2; tri += 1) {
    const baseA = (tri === 0 ? rot : -rot * 0.8) + (tri * Math.PI) / 3;
    floorG.lineStyle(1.4, tri === 0 ? col : COL_BONE, 0.52);
    floorG.beginPath();
    for (let v = 0; v <= 3; v += 1) {
      const a = baseA + ((v % 3) * Math.PI * 2) / 3;
      const vx = z.x + Math.cos(a) * (outerR * 0.72);
      const vy = z.y + Math.sin(a) * (outerR * 0.72);
      if (v === 0) floorG.moveTo(vx, vy);
      else floorG.lineTo(vx, vy);
    }
    floorG.strokePath();
  }

  for (let k = 0; k < 6; k += 1) {
    const a = rot + (k * Math.PI) / 3;
    floorG.lineStyle(2.2, COL_INK, 0.74);
    floorG.beginPath();
    floorG.moveTo(z.x + Math.cos(a) * innerR, z.y + Math.sin(a) * innerR);
    floorG.lineTo(z.x + Math.cos(a) * outerR, z.y + Math.sin(a) * outerR);
    floorG.strokePath();
    floorG.lineStyle(1.4, COL_BONE, 0.86);
    floorG.beginPath();
    floorG.moveTo(z.x + Math.cos(a) * innerR, z.y + Math.sin(a) * innerR);
    floorG.lineTo(z.x + Math.cos(a) * outerR, z.y + Math.sin(a) * outerR);
    floorG.strokePath();
  }

  if (z.vortex) {
    for (let arm = 0; arm < 3; arm += 1) {
      const a0 = tick * 0.09 + (arm * Math.PI * 2) / 3;
      floorG.lineStyle(1.7, COL_BONE, 0.62);
      floorG.beginPath();
      floorG.arc(z.x, z.y, outerR * 0.56, a0, a0 + 0.95, false);
      floorG.strokePath();
    }
  }

  // 3. Elevated Chiaroscuro elemental focus orb + 2 orbiting micro-runes
  g.fillStyle(COL_INK, 0.94);
  g.fillCircle(z.x, z.y, 11.5);
  g.lineStyle(2.2, COL_INK, 0.96);
  g.strokeCircle(z.x, z.y, 11.5);
  g.fillStyle(col, 0.96);
  g.fillCircle(z.x, z.y, 8.4);
  g.fillStyle(COL_BONE, 0.95);
  g.fillCircle(z.x - 2, z.y - 2, 3.1);

  for (let s = 0; s < 2; s += 1) {
    const sa = tick * 0.14 + s * Math.PI;
    const sx = z.x + Math.cos(sa) * 16.5;
    const sy = z.y + Math.sin(sa) * 16.5;
    g.fillStyle(COL_INK, 0.92);
    g.fillCircle(sx, sy, 3.2);
    g.fillStyle(col, 0.98);
    g.fillCircle(sx, sy, 2.0);
  }
}

/**
 * Druid Sacred Tree summon overlay: depth-16 botanical root-rune perimeter (<= 0.05 fill) + Chiaroscuro emerald canopy & golden spirit fruits.
 */
export function drawSacredTreeChiaroscuro(
  floorG: Phaser.GameObjects.Graphics,
  g: Phaser.GameObjects.Graphics,
  sum: SimSummonState,
  tick: number,
): void {
  const pulse = Math.sin(tick * 0.12 + sum.id) * 2.2;
  const auraR = Math.max(24, sum.auraRadius + pulse);
  const limeCol = hexToNum(PALETTE.LIME_GLOW);
  const emeraldCol = hexToNum(PALETTE.GOBLIN_GREEN);

  floorG.fillStyle(limeCol, 0.048);
  floorG.fillCircle(sum.x, sum.y, auraR);
  floorG.lineStyle(3.8, COL_INK, 0.68);
  floorG.strokeCircle(sum.x, sum.y, auraR);
  floorG.lineStyle(2.2, limeCol, 0.88);
  floorG.strokeCircle(sum.x, sum.y, auraR);

  // 6 perimeter root-petal notches (outer 15% annulus only — center stays crystal clear)
  for (let p = 0; p < 6; p += 1) {
    const a = (p * Math.PI) / 3 + tick * 0.01;
    const r0 = auraR * 0.87;
    const r1 = auraR * 1.02;
    floorG.lineStyle(2.6, COL_INK, 0.72);
    floorG.beginPath();
    floorG.moveTo(sum.x + Math.cos(a - 0.14) * r0, sum.y + Math.sin(a - 0.14) * r0);
    floorG.lineTo(sum.x + Math.cos(a) * r1, sum.y + Math.sin(a) * r1);
    floorG.lineTo(sum.x + Math.cos(a + 0.14) * r0, sum.y + Math.sin(a + 0.14) * r0);
    floorG.strokePath();
    floorG.lineStyle(1.5, limeCol, 0.86);
    floorG.beginPath();
    floorG.moveTo(sum.x + Math.cos(a - 0.14) * r0, sum.y + Math.sin(a - 0.14) * r0);
    floorG.lineTo(sum.x + Math.cos(a) * r1, sum.y + Math.sin(a) * r1);
    floorG.lineTo(sum.x + Math.cos(a + 0.14) * r0, sum.y + Math.sin(a + 0.14) * r0);
    floorG.strokePath();
  }

  // Sculpted Chiaroscuro trunk & 3-lobed emerald canopy + 3 golden spirit fruits
  g.fillStyle(COL_INK, 0.96);
  g.fillCircle(sum.x, sum.y + 2, 19);
  g.fillStyle(hexToNum(PALETTE.LEATHER_MID), 1);
  g.fillRoundedRect(sum.x - 6, sum.y - 4, 12, 18, 3);
  g.lineStyle(2.2, COL_INK, 0.96);
  g.strokeRoundedRect(sum.x - 6, sum.y - 4, 12, 18, 3);

  g.fillStyle(COL_INK, 0.96);
  g.fillCircle(sum.x - 8, sum.y - 6, 11.5);
  g.fillCircle(sum.x + 8, sum.y - 6, 11.5);
  g.fillCircle(sum.x, sum.y - 10, 15.5);

  g.fillStyle(emeraldCol, 0.98);
  g.fillCircle(sum.x - 8, sum.y - 6, 9.2);
  g.fillCircle(sum.x + 8, sum.y - 6, 9.2);
  g.fillCircle(sum.x, sum.y - 10, 13.4);

  g.fillStyle(limeCol, 0.95);
  g.fillCircle(sum.x - 4, sum.y - 12, 7.6);

  for (let f = 0; f < 3; f += 1) {
    const fxOff = f === 0 ? -7 : f === 1 ? 7 : 1;
    const fyOff = f === 2 ? -15 : -6;
    g.fillStyle(COL_INK, 0.94);
    g.fillCircle(sum.x + fxOff, sum.y + fyOff, 3.0);
    g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 0.98);
    g.fillCircle(sum.x + fxOff, sum.y + fyOff, 1.9);
  }
}

/**
 * Engineer Tesla / Ancient Turret overlay: depth-16 calibration ring (<= 0.04 fill) + bolted tripod base, dual-rail coil barrel, and EMP arc gauge.
 */
export function drawEngineerTurretChiaroscuro(
  floorG: Phaser.GameObjects.Graphics,
  g: Phaser.GameObjects.Graphics,
  sum: SimSummonState,
  nowMs: number,
): void {
  const isAncient = sum.kind === 'ancient_turret';
  const auraCol = hexToNum(isAncient ? PALETTE.SOLAR_GOLD : PALETTE.CYAN_FROST);
  const coreCol = hexToNum(isAncient ? PALETTE.SOLAR_GOLD : PALETTE.BRASS_CORE);

  floorG.fillStyle(auraCol, 0.04);
  floorG.fillCircle(sum.x, sum.y, sum.auraRadius);
  floorG.lineStyle(3.0, COL_INK, 0.56);
  floorG.strokeCircle(sum.x, sum.y, sum.auraRadius);
  floorG.lineStyle(1.7, auraCol, 0.68);
  floorG.strokeCircle(sum.x, sum.y, sum.auraRadius);

  // 4 cardinal rangefinder notches on floor perimeter
  for (let k = 0; k < 4; k += 1) {
    const a = (k * Math.PI) / 2;
    floorG.lineStyle(1.8, auraCol, 0.78);
    floorG.beginPath();
    floorG.moveTo(sum.x + Math.cos(a) * (sum.auraRadius - 5), sum.y + Math.sin(a) * (sum.auraRadius - 5));
    floorG.lineTo(sum.x + Math.cos(a) * (sum.auraRadius + 2), sum.y + Math.sin(a) * (sum.auraRadius + 2));
    floorG.strokePath();
  }

  // Tripod steel chassis + 3 stabilization struts
  for (let leg = 0; leg < 3; leg += 1) {
    const la = (leg * Math.PI * 2) / 3 + Math.PI / 6;
    g.lineStyle(5.2, COL_INK, 0.96);
    g.beginPath();
    g.moveTo(sum.x, sum.y);
    g.lineTo(sum.x + Math.cos(la) * 16.5, sum.y + Math.sin(la) * 16.5);
    g.strokePath();
    g.lineStyle(2.6, hexToNum(PALETTE.STEEL_LIGHT), 0.96);
    g.beginPath();
    g.moveTo(sum.x, sum.y);
    g.lineTo(sum.x + Math.cos(la) * 15.5, sum.y + Math.sin(la) * 15.5);
    g.strokePath();
  }

  g.fillStyle(COL_INK, 0.96);
  g.fillCircle(sum.x, sum.y, 15.5);
  g.fillStyle(hexToNum(PALETTE.STEEL_DARK), 1);
  g.fillCircle(sum.x, sum.y, 12.8);
  g.lineStyle(2.2, COL_INK, 0.96);
  g.strokeCircle(sum.x, sum.y, 12.8);
  g.fillStyle(coreCol, 1);
  g.fillCircle(sum.x, sum.y, 7.6);
  g.fillStyle(COL_BONE, 0.96);
  g.fillCircle(sum.x - 1.4, sum.y - 1.4, 2.4);

  // Rotating Tesla coil barrel with incandescent emitter tip
  const barrelAng = nowMs * 0.002 + sum.id;
  const bx = sum.x + Math.cos(barrelAng) * 17.5;
  const by = sum.y + Math.sin(barrelAng) * 17.5;
  g.lineStyle(6.4, COL_INK, 1);
  g.beginPath();
  g.moveTo(sum.x, sum.y);
  g.lineTo(bx, by);
  g.strokePath();
  g.lineStyle(3.2, hexToNum(PALETTE.STEEL_LIGHT), 1);
  g.beginPath();
  g.moveTo(sum.x, sum.y);
  g.lineTo(bx, by);
  g.strokePath();
  g.fillStyle(auraCol, 0.98);
  g.fillCircle(bx, by, 3.1);
  g.fillStyle(COL_BONE, 1);
  g.fillCircle(bx, by, 1.4);

  if (sum.charge > 0) {
    const endA = -Math.PI / 2 + Math.PI * 2 * clamp(sum.charge / 100, 0, 1);
    g.lineStyle(5.0, COL_INK, 0.88);
    g.beginPath();
    g.arc(sum.x, sum.y, 19.5, -Math.PI / 2, endA, false);
    g.strokePath();
    g.lineStyle(2.8, hexToNum(PALETTE.VOLT_YELLOW), 0.98);
    g.beginPath();
    g.arc(sum.x, sum.y, 19.5, -Math.PI / 2, endA, false);
    g.strokePath();
  }
}

/**
 * Ranger Predator Mark overhead falcon-wing reticle (#141019 obsidian outline + solar gold wings + bone-white core).
 */
export function drawRangerPredatorMarkChiaroscuro(
  g: Phaser.GameObjects.Graphics,
  x: number,
  markY: number,
  tick: number,
): void {
  const pulse = Math.sin(tick * 0.22) * 1.2;
  const wingSpan = 10.5 + pulse;
  const goldCol = hexToNum(PALETTE.SOLAR_GOLD);

  g.lineStyle(4.2, COL_INK, 0.92);
  g.strokeCircle(x, markY, 6.2);
  g.beginPath();
  g.moveTo(x - wingSpan, markY - 2.5);
  g.lineTo(x - 4, markY);
  g.moveTo(x + wingSpan, markY - 2.5);
  g.lineTo(x + 4, markY);
  g.moveTo(x, markY - 9.5);
  g.lineTo(x, markY + 9.5);
  g.strokePath();

  g.lineStyle(2.2, goldCol, 0.98);
  g.strokeCircle(x, markY, 6.2);
  g.beginPath();
  g.moveTo(x - wingSpan, markY - 2.5);
  g.lineTo(x - 4, markY);
  g.moveTo(x + wingSpan, markY - 2.5);
  g.lineTo(x + 4, markY);
  g.moveTo(x, markY - 9.5);
  g.lineTo(x, markY + 9.5);
  g.strokePath();

  g.fillStyle(COL_BONE, 0.98);
  g.fillCircle(x, markY, 2.0);
}
