import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { ENV_PALETTE, hexToNum } from '../src/art/palette.js';
import {
  type CoalescedReactionBannerState,
  coalesceElementalReaction,
  computePopupScalePop,
  resolveSpatialPopupCellSlot,
} from '../src/fx/combat-fx.js';
import { clampUiScale as clampUiScaleFromFx } from '../src/fx/graphics-settings.js';
import { shouldShowOffscreenEnemyArrows } from '../src/scenes/game-scene/hud-qol-and-minimap.js';
import {
  computeCircularCooldownGeometry,
  computeKeyChipMetrics,
  computeOffscreenArrowPose,
  computeSegmentedBarGeometry,
  drawCircularCooldown,
  drawKeyChip,
  drawMiniCharacterPortrait,
  drawOffscreenEnemyArrow,
  drawPlayerHitDirectionArc,
  drawSegmentedBar,
  drawStyledPanel,
  drawVectorHudIcon,
} from '../src/ui/components/hud-primitives.js';
import {
  clampUiScale,
  DEFAULT_GRAPHICS_SETTINGS,
  GraphicsSettingsManager,
  parseUiQueryOverrides,
} from '../src/ui/graphics-settings.js';
import {
  clampHudFontPxAt1080p,
  computeUiTextResolution,
  createSceneTextStyle,
  createUiTextStyle,
  getBiomeUiAccent,
  hudFontPxToScenePx,
  UI_THEME,
} from '../src/ui/theme.js';

describe('Phase P9a — Design System, Typography & HUD Primitives', () => {
  describe('UI_THEME tokens & ENV_PALETTE alignment', () => {
    it('grounds panel surface and border tokens directly in ENV_PALETTE[0] slate-dark colors', () => {
      expect(UI_THEME.panelBg).toBe(hexToNum(ENV_PALETTE[0].wallFront));
      expect(UI_THEME.panelBg).toBe(0x2d3547);
      expect(UI_THEME.panelBorder).toBe(hexToNum(ENV_PALETTE[0].wallTop));
      expect(UI_THEME.panelBorder).toBe(0x64708b);
      expect(UI_THEME.panelBgDark).toBe(0x1d2330);
      expect(UI_THEME.panelBgAlpha).toBeGreaterThanOrEqual(0.72);
      expect(UI_THEME.panelBgAlpha).toBeLessThanOrEqual(0.85);
      expect(UI_THEME.minimapBgAlpha).toBe(0.85);
      expect(UI_THEME.panelRadius).toEqual({ sm: 6, md: 8, lg: 10 });
      expect(UI_THEME.spacing).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24 });
    });

    it('provides biome UI accent tokens matched to ENV_PALETTE[0..3]', () => {
      for (const biome of [0, 1, 2, 3] as const) {
        const accent = getBiomeUiAccent(biome);
        const env = ENV_PALETTE[biome];
        expect(accent.accentHex).toBe(env.accent);
        expect(accent.accentNum).toBe(hexToNum(env.accent));
        expect(accent.borderHex).toBe(env.wallTop);
        expect(accent.borderNum).toBe(hexToNum(env.wallTop));
        expect(accent.surfaceHex).toBe(env.wallFront);
        expect(accent.surfaceNum).toBe(hexToNum(env.wallFront));
      }
    });

    it('defines status colors (HP, Armor, Energy, Gold) and weapon rarity colors', () => {
      expect(UI_THEME.status.hp).toBe(0xe84545);
      expect(UI_THEME.status.hpDark).toBe(0xdc2626);
      expect(UI_THEME.status.hpTrail).toBe(0xfca5a5);
      expect(UI_THEME.status.armor).toBe(0xcbd5e1);
      expect(UI_THEME.status.armorDark).toBe(0x94a3b8);
      expect(UI_THEME.status.energy).toBe(0x38bdf8);
      expect(UI_THEME.status.energyDark).toBe(0x0284c7);
      expect(UI_THEME.status.gold).toBe(0xfbbf24);
      expect(UI_THEME.status.goldBright).toBe(0xfde047);

      expect(UI_THEME.rarity.common.hex).toBe('#C7D2E8');
      expect(UI_THEME.rarity.rare.hex).toBe('#38BDF8');
      expect(UI_THEME.rarity.epic.hex).toBe('#A855F7');
      expect(UI_THEME.rarity.legendary.hex).toBe('#FACC15');
    });
  });

  describe('Typography scale, minimum HUD font size >= 13px at 1080p & Vietnamese diacritics', () => {
    it('enforces minimum 13px at 1080p (>= 6.5px in 960x540 HudScene space) for all HUD text', () => {
      expect(UI_THEME.fontSizes1080p).toEqual([12, 13, 14, 16, 20, 28, 40]);
      expect(UI_THEME.minHudFontPxAt1080p).toBe(13);

      expect(clampHudFontPxAt1080p(10)).toBe(13);
      expect(clampHudFontPxAt1080p(12)).toBe(13);
      expect(clampHudFontPxAt1080p(13)).toBe(13);
      expect(clampHudFontPxAt1080p(14)).toBe(14);
      expect(clampHudFontPxAt1080p(20)).toBe(20);

      expect(hudFontPxToScenePx(10)).toBe(6.5);
      expect(hudFontPxToScenePx(13)).toBe(6.5);
      expect(hudFontPxToScenePx(14)).toBe(7);
      expect(hudFontPxToScenePx(16)).toBe(8);
      expect(hudFontPxToScenePx(20)).toBe(10);
      expect(hudFontPxToScenePx(28)).toBe(14);
      expect(hudFontPxToScenePx(40)).toBe(20);
    });

    it('creates Vietnamese diacritic-safe text styles with top padding >= 4px and line-height >= 1.3', () => {
      const style14 = createUiTextStyle({
        fontPxAt1080p: 14,
        weight: 700,
        color: '#F4F1EA',
      });
      expect(style14.fontFamily).toContain('Be Vietnam Pro');
      expect(style14.fontSize).toBe('7px');
      expect(style14.padding.top).toBeGreaterThanOrEqual(4);
      expect(style14.padding.bottom).toBeGreaterThanOrEqual(2);
      const scenePx14 = parseFloat(style14.fontSize);
      const effectiveLineHeightRatio14 = (scenePx14 + style14.lineSpacing) / scenePx14;
      expect(effectiveLineHeightRatio14).toBeGreaterThanOrEqual(1.3);

      // Even if a caller passes 10px at 1080p to createUiTextStyle, it clamps to >= 13px (6.5px scene)
      const clampedStyle = createUiTextStyle({ fontPxAt1080p: 10 });
      expect(parseFloat(clampedStyle.fontSize)).toBeGreaterThanOrEqual(6.5);

      // Non-HUD scene text style allows 12px at 1080p (6px scene) while preserving Vietnamese padding & line-height
      const scene12 = createSceneTextStyle({ fontPxAt1080p: 12, weight: 600 });
      expect(scene12.fontSize).toBe('6px');
      expect(scene12.padding.top).toBeGreaterThanOrEqual(4);
      expect((6 + scene12.lineSpacing) / 6).toBeGreaterThanOrEqual(1.3);
    });

    it('computes crisp DPR and uiScale aware text resolution across 1080p and 1440p', () => {
      expect(computeUiTextResolution(1, 2, 1.0)).toBe(2);
      expect(computeUiTextResolution(1, 2, 1.3)).toBeCloseTo(2.6, 2);
      expect(computeUiTextResolution(1, 2.6667, 1.0)).toBeCloseTo(2.6667, 2);
      expect(computeUiTextResolution(2, 2.6667, 1.3)).toBe(4);
      expect(computeUiTextResolution(1, 1, 0.8)).toBe(2);
    });
  });

  describe('graphicsSettings uiScale (0.80..1.30) & showKeyHints + URL query overrides', () => {
    it('defaults uiScale to 1.0 and showKeyHints to true, clamping uiScale in 0.05 steps', () => {
      expect(DEFAULT_GRAPHICS_SETTINGS.uiScale).toBe(1.0);
      expect(DEFAULT_GRAPHICS_SETTINGS.showKeyHints).toBe(true);

      expect(clampUiScale(0.5)).toBe(0.8);
      expect(clampUiScale(0.8)).toBe(0.8);
      expect(clampUiScale(1.02)).toBe(1.0);
      expect(clampUiScale(1.14)).toBe(1.15);
      expect(clampUiScale(1.3)).toBe(1.3);
      expect(clampUiScale(1.8)).toBe(1.3);

      const mgr = new GraphicsSettingsManager();
      mgr.setUiScale(0.8);
      expect(mgr.getState().uiScale).toBe(0.8);
      mgr.setUiScale(1.3);
      expect(mgr.getState().uiScale).toBe(1.3);
      mgr.setUiScale(0.2);
      expect(mgr.getState().uiScale).toBe(0.8);
      mgr.setShowKeyHints(false);
      expect(mgr.getState().showKeyHints).toBe(false);
    });

    it('parses and applies ?uiScale= and ?keyHints= URL query overrides deterministically', () => {
      expect(parseUiQueryOverrides('?scene=b1-combat-uiscale-80&uiScale=0.8')).toEqual({
        uiScale: 0.8,
      });
      expect(parseUiQueryOverrides('?uiScale=1.3&keyHints=0')).toEqual({
        uiScale: 1.3,
        showKeyHints: false,
      });
      expect(parseUiQueryOverrides('?uiScale=2.5&keyHints=1')).toEqual({
        uiScale: 1.3,
        showKeyHints: true,
      });

      const mgr = new GraphicsSettingsManager();
      mgr.applyUrlQueryOverrides('?uiScale=0.8&keyHints=0');
      expect(mgr.getState().uiScale).toBe(0.8);
      expect(mgr.getState().showKeyHints).toBe(false);
    });
  });

  describe('HUD primitive geometry calculators & drawing helpers', () => {
    it('computes segmented bar geometry with segment rects, filled count, and trailing damage width', () => {
      const geo = computeSegmentedBarGeometry({
        x: 20,
        y: 10,
        width: 120,
        height: 8,
        current: 5,
        max: 8,
        trailingRatio: 0.875,
        maxSegments: 8,
        gap: 2,
      });
      expect(geo.segmentCount).toBe(8);
      expect(geo.segments).toHaveLength(8);
      expect(geo.filledSegments).toBe(5);
      expect(geo.fillRatio).toBeCloseTo(5 / 8, 4);
      expect(geo.trailingWidth).toBeCloseTo(120 * 0.875, 2);
      expect(geo.segments[0]!.x).toBe(20);
      expect(geo.segments[0]!.width).toBeGreaterThan(10);
    });

    it('computes circular cooldown geometry with radial clockwise sweep from -PI/2 and countdown label', () => {
      const readyGeo = computeCircularCooldownGeometry({
        cx: 100,
        cy: 100,
        radius: 16,
        remainingSec: 0,
        totalSec: 8,
        activeSec: 0,
      });
      expect(readyGeo.isReady).toBe(true);
      expect(readyGeo.isActive).toBe(false);
      expect(readyGeo.readyRatio).toBe(1);
      expect(readyGeo.cooldownText).toBe('');

      const cdGeo = computeCircularCooldownGeometry({
        cx: 100,
        cy: 100,
        radius: 16,
        remainingSec: 2.4,
        totalSec: 8,
        activeSec: 0,
      });
      expect(cdGeo.isReady).toBe(false);
      expect(cdGeo.readyRatio).toBeCloseTo(0.7, 3);
      expect(cdGeo.startAngleRad).toBeCloseTo(-Math.PI / 2, 4);
      expect(cdGeo.endAngleRad).toBeGreaterThan(cdGeo.startAngleRad);
      expect(cdGeo.cooldownText).toBe('2.4s');
    });

    it('computes compact keycap chip metrics sized to the key label', () => {
      const chip1 = computeKeyChipMetrics('1', 6.5);
      const chipSpace = computeKeyChipMetrics('Space', 6.5);
      expect(chip1.height).toBeGreaterThanOrEqual(11);
      expect(chipSpace.width).toBeGreaterThan(chip1.width);
      expect(chip1.radius).toBeGreaterThanOrEqual(3);
      expect(clampUiScaleFromFx(0.8)).toBe(0.8);
    });

    it('renders styled panels, segmented bars, key chips, cooldown discs, vector icons, and portraits onto Phaser Graphics', () => {
      const mockGraphics = {
        fillStyle: vi.fn().mockReturnThis(),
        fillRoundedRect: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(),
        fillTriangle: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRoundedRect: vi.fn().mockReturnThis(),
        strokeCircle: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
        beginPath: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        arc: vi.fn().mockReturnThis(),
        closePath: vi.fn().mockReturnThis(),
        fillPath: vi.fn().mockReturnThis(),
      } as unknown as Phaser.GameObjects.Graphics;

      drawStyledPanel(mockGraphics, 10, 10, 140, 48, {
        accentColor: 0x38bdf8,
        accentSide: 'left',
      });
      expect(mockGraphics.fillRoundedRect).toHaveBeenCalled();
      expect(mockGraphics.strokeRoundedRect).toHaveBeenCalled();

      const segGeo = drawSegmentedBar(mockGraphics, {
        x: 16,
        y: 20,
        width: 110,
        height: 8,
        current: 4,
        max: 6,
        trailingRatio: 0.9,
        fillColor: UI_THEME.status.hp,
        fillDarkColor: UI_THEME.status.hpDark,
        trailColor: UI_THEME.status.hpTrail,
        pulseAlert: true,
      });
      expect(segGeo.filledSegments).toBe(4);

      const chip = drawKeyChip(mockGraphics, 24, 36, 'Space', { active: true });
      expect(chip.label).toBe('Space');

      const cd = drawCircularCooldown(mockGraphics, {
        cx: 60,
        cy: 60,
        radius: 14,
        remainingSec: 1.5,
        totalSec: 6,
        accentColor: 0x38bdf8,
        iconKind: 'skill',
      });
      expect(cd.isReady).toBe(false);
      expect(mockGraphics.arc).toHaveBeenCalled();

      for (const kind of [
        'heart',
        'shield',
        'bolt',
        'coin',
        'skull',
        'skill',
        'dash',
        'sword',
        'chest',
        'portal',
        'shrine',
        'merchant',
      ] as const) {
        drawVectorHudIcon(mockGraphics, kind, 40, 40, 6);
      }

      for (const charId of ['vanguard', 'elementalist', 'druid', 'engineer', 'ranger'] as const) {
        drawMiniCharacterPortrait(mockGraphics, charId, 50, 50, 10);
      }
      expect(mockGraphics.strokeCircle).toHaveBeenCalled();
    });
  });

  describe('Coalesced reaction popups (0.4s window), 120px cell cap (<= 3) & combat QoL indicators', () => {
    it('coalesces same-type elemental reactions within a 0.4s window into "HƠI NƯỚC ×3"', () => {
      let state: CoalescedReactionBannerState | null = null;

      state = coalesceElementalReaction(state, 'vaporize', 24, false, 0.4);
      expect(state.count).toBe(1);
      expect(state.totalDamage).toBe(24);
      expect(state.label).toBe('HƠI NƯỚC');

      state.windowTimerSec = 0.25;
      state = coalesceElementalReaction(state, 'vaporize', 24, false, 0.4);
      expect(state.count).toBe(2);
      expect(state.label).toBe('HƠI NƯỚC ×2');

      state.windowTimerSec = 0.22;
      state = coalesceElementalReaction(state, 'vaporize', 24, true, 0.4);
      expect(state.count).toBe(3);
      expect(state.totalDamage).toBe(72);
      expect(state.isTeamCombo).toBe(true);
      expect(state.label).toBe('HƠI NƯỚC ×3');

      // After > 0.4s window expires (windowTimerSec === 0), count resets to 1
      state.windowTimerSec = 0;
      state = coalesceElementalReaction(state, 'vaporize', 30, false, 0.4);
      expect(state.count).toBe(1);
      expect(state.totalDamage).toBe(30);
      expect(state.label).toBe('HƠI NƯỚC');
    });

    it('caps active damage popups at <= 3 per 120px spatial cell and staggers vertical offset by 14px', () => {
      const activePopups: Array<{
        active: boolean;
        x: number;
        y: number;
        originX: number;
        originY: number;
        cellSlotIndex: number;
        age: number;
      }> = [];

      for (let i = 0; i < 4; i++) {
        const spawnX = 520 + i * 8;
        const spawnY = 260;
        const placement = resolveSpatialPopupCellSlot(activePopups, spawnX, spawnY, 120, 3);
        if (placement.evictIndex !== null) {
          activePopups[placement.evictIndex]!.active = false;
        }
        activePopups.push({
          active: true,
          x: spawnX,
          y: spawnY - placement.staggerOffsetY,
          originX: spawnX,
          originY: spawnY,
          cellSlotIndex: placement.slotIndex,
          age: (4 - i) * 0.1,
        });
      }

      const activeInCell = activePopups.filter((p) => p.active);
      expect(activeInCell).toHaveLength(3);
      const distinctY = new Set(activeInCell.map((p) => Math.round(p.y)));
      expect(distinctY.size).toBe(3);
    });

    it('evaluates easeOutBack scale-pop curve for normal vs crit popups', () => {
      const normalStart = computePopupScalePop(0.0, 0.62, 1.0);
      const normalPeak = computePopupScalePop(0.08, 0.62, 1.0);
      const critPeak = computePopupScalePop(0.08, 0.62, 1.32);
      const settled = computePopupScalePop(0.35, 0.62, 1.0);

      expect(normalStart).toBeCloseTo(0.72, 2);
      expect(normalPeak).toBeGreaterThan(1.0);
      expect(critPeak).toBeGreaterThan(normalPeak * 1.25);
      expect(settled).toBeCloseTo(1.0, 2);
    });

    it('shows off-screen enemy directional arrows only when 1 <= aliveNonDummyEnemies <= 3 and clamps to viewport edge', () => {
      expect(shouldShowOffscreenEnemyArrows(0)).toBe(false);
      expect(shouldShowOffscreenEnemyArrows(1)).toBe(true);
      expect(shouldShowOffscreenEnemyArrows(2)).toBe(true);
      expect(shouldShowOffscreenEnemyArrows(3)).toBe(true);
      expect(shouldShowOffscreenEnemyArrows(4)).toBe(false);

      const pose = computeOffscreenArrowPose({
        targetWorldX: 1120,
        targetWorldY: 270,
        camMidX: 480,
        camMidY: 270,
        viewX: 0,
        viewY: 0,
        viewW: 960,
        viewH: 540,
        minScreenX: 36,
        maxScreenX: 924,
        minScreenY: 42,
        maxScreenY: 498,
      });
      expect(pose.isOffscreen).toBe(true);
      expect(pose.ax).toBeCloseTo(924, 2);
      expect(pose.ay).toBeCloseTo(270, 2);
      expect(pose.angleRad).toBeCloseTo(0, 3);

      const mockGraphics = {
        fillStyle: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(),
        fillTriangle: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        beginPath: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        lineTo: vi.fn().mockReturnThis(),
        closePath: vi.fn().mockReturnThis(),
        fillPath: vi.fn().mockReturnThis(),
        arc: vi.fn().mockReturnThis(),
        strokePath: vi.fn().mockReturnThis(),
      } as unknown as Phaser.GameObjects.Graphics;

      drawOffscreenEnemyArrow(mockGraphics, pose.ax, pose.ay, pose.angleRad, true, 1.0);
      expect(mockGraphics.fillPath).toHaveBeenCalled();
      expect(mockGraphics.strokePath).toHaveBeenCalled();

      drawPlayerHitDirectionArc(mockGraphics, 480, 270, 0.35, 0.85, 1.0);
      expect(mockGraphics.arc).toHaveBeenCalled();
    });
  });
});
