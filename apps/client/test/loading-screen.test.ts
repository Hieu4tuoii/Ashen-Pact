import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
   computeActiveHeroCount,
  getLoadingStageCopy,
  getLoadingTips,
  LOADING_HERO_CRESTS,
  LOADING_STAGE_ORDER,
  LoadingScreenController,
  resolveInitialLoadingLocale,
} from '../src/ui/loading-screen.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIR = path.resolve(__dirname, '..');

describe('Ashen Pact Loading Screen — UI Controller & First-Paint Markup', () => {
  it('resolves initial loading locale from URL query or saved localStorage settings JSON', () => {
    expect(resolveInitialLoadingLocale('?lang=en', null)).toBe('en');
    expect(resolveInitialLoadingLocale('?lang=vi', '{"language":"en"}')).toBe('vi');
    expect(resolveInitialLoadingLocale('', '{"language":"en","quality":"high"}')).toBe('en');
    expect(resolveInitialLoadingLocale('', '{"language":"vi"}')).toBe('vi');
    expect(resolveInitialLoadingLocale('', 'invalid-json')).toBe('vi');
    expect(resolveInitialLoadingLocale('', null)).toBe('vi');
  });

  it('provides complete bilingual Vietnamese and English stage labels and tactical tips', () => {
    expect(LOADING_STAGE_ORDER.length).toBeGreaterThanOrEqual(6);
    for (const stageId of LOADING_STAGE_ORDER) {
      const viCopy = getLoadingStageCopy(stageId, 'vi');
      const enCopy = getLoadingStageCopy(stageId, 'en');
      expect(viCopy.label.length).toBeGreaterThan(5);
      expect(enCopy.label.length).toBeGreaterThan(5);
      expect(viCopy.detail.length).toBeGreaterThan(5);
      expect(enCopy.detail.length).toBeGreaterThan(5);
      expect(viCopy.targetProgress).toBeGreaterThanOrEqual(10);
      expect(viCopy.targetProgress).toBeLessThanOrEqual(100);
    }

    const viTips = getLoadingTips('vi');
    const enTips = getLoadingTips('en');
    expect(viTips.length).toBeGreaterThanOrEqual(5);
    expect(enTips.length).toBe(viTips.length);
    for (let i = 0; i < viTips.length; i++) {
      expect(viTips[i]!.title.length).toBeGreaterThan(3);
      expect(viTips[i]!.body.length).toBeGreaterThan(20);
      expect(enTips[i]!.title.length).toBeGreaterThan(3);
      expect(enTips[i]!.body.length).toBeGreaterThan(20);
    }
  });

  it('maps loading progress 0..100 to active hero crests across all 5 playable classes', () => {
    expect(LOADING_HERO_CRESTS).toHaveLength(5);
    expect(computeActiveHeroCount(0)).toBe(1);
    expect(computeActiveHeroCount(18)).toBe(1);
    expect(computeActiveHeroCount(35)).toBe(2);
    expect(computeActiveHeroCount(55)).toBe(3);
    expect(computeActiveHeroCount(75)).toBe(4);
    expect(computeActiveHeroCount(92)).toBe(5);
    expect(computeActiveHeroCount(100)).toBe(5);
  });

  it('tracks monotonic stage progress, tip cycling, and completion state in LoadingScreenController', () => {
    const controller = new LoadingScreenController({ locale: 'vi', initialTipIndex: 0 });
    expect(controller.getState().progress).toBeGreaterThanOrEqual(8);
    expect(controller.getState().completed).toBe(false);

    controller.setStage('fonts');
    const afterFonts = controller.getState();
    expect(afterFonts.stage).toBe('fonts');
    expect(afterFonts.progress).toBeGreaterThanOrEqual(24);

    // Monotonic progress guard: lower raw progress never moves the bar backward
    controller.setProgress(10);
    expect(controller.getState().progress).toBe(afterFonts.progress);

    controller.setStage('rigs');
    expect(controller.getState().progress).toBeGreaterThan(afterFonts.progress);

    const firstTip = controller.getCurrentTip().body;
    controller.nextTip();
    expect(controller.getCurrentTip().body).not.toBe(firstTip);

    controller.complete(true);
    expect(controller.getState().progress).toBe(100);
    expect(controller.getState().completed).toBe(true);
    expect(controller.getState().hidden).toBe(true);
  });

  it('embeds instant first-paint loading screen markup and styles in apps/client/index.html', () => {
    const html = fs.readFileSync(path.join(CLIENT_DIR, 'index.html'), 'utf8');
    expect(html).toContain('id="ashen-loading-screen"');
    expect(html).toContain('id="loading-title"');
    expect(html).toContain('id="loading-progress-fill"');
    expect(html).toContain('id="loading-progress-percent"');
    expect(html).toContain('id="loading-stage-label"');
    expect(html).toContain('id="loading-hero-strip"');
    expect(html).toContain('id="loading-tip-card"');
    expect(html).toContain('ASHEN PACT');
    expect(html).toContain('KHẾ ƯỚC TRO TÀN');
  });
});
