import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import {
  VISUAL_SCENES,
  type VisualSceneDef,
  installDeterministicRafGate,
  setSceneLightingAndRenderStaticFrame,
  stepDeterministicFrames,
} from './helpers/visual-scenes.js';
import {
  type CapturedAnimatedSceneResult,
  captureAnimatedStripAndHeroScene,
  installSceneStripInstrumentation,
} from './helpers/visual-strip-harness.js';
import {
  analyzePngBufferRegions,
  comparePngBuffers,
  computeSceneEnvironmentSummary,
  convertPngBufferToGrayscale,
  stitchPngBuffersHorizontal,
  type AnimationGatesEvaluationResult,
  type RegionMetrics,
  type SceneEnvironmentSummary,
  type SceneManifestEntry,
} from '../../tools/visual-metrics.js';

interface CapturedSceneBuffers {
  litBuffer: Buffer;
  unlitBuffer?: Buffer;
  stripBuffer?: Buffer;
  animResult?: CapturedAnimatedSceneResult;
}

async function captureSingleSceneOnce(
  page: Page,
  scene: VisualSceneDef,
  capturedBuffers: Map<string, Buffer>,
): Promise<CapturedSceneBuffers> {
  const viewport = scene.viewport ?? { width: 1920, height: 1080 };
  await page.setViewportSize(viewport);

  if (scene.grayscaleFrom && capturedBuffers.has(scene.grayscaleFrom)) {
    const sourceBuffer = capturedBuffers.get(scene.grayscaleFrom)!;
    return {
      litBuffer: convertPngBufferToGrayscale(sourceBuffer),
    };
  }

  await page
    .evaluate(() => {
      const win = window as unknown as {
        __PHASER_GAME__?: { destroy?: (removeCanvas: boolean) => void };
      };
      try {
        win.__PHASER_GAME__?.destroy?.(true);
        win.__PHASER_GAME__ = undefined;
      } catch {
        // Ignore teardown errors
      }
    })
    .catch(() => {});

  await page.goto(scene.url);
  await page.waitForFunction(
    (expected: string) => {
      const dbg = (
        window as unknown as {
          __GAME_DEBUG__?: { scene?: string; fontsLoaded?: boolean };
        }
      ).__GAME_DEBUG__;
      return dbg?.scene === expected && dbg?.fontsLoaded === true;
    },
    scene.expectedScene,
    { timeout: 15_000 },
  );

  // Move mouse cursor to deterministic viewport center
  await page.mouse.move(Math.floor(viewport.width / 2), Math.floor(viewport.height / 2));

  if (scene.captureStrip && scene.expectedScene === 'GameScene') {
    await installSceneStripInstrumentation(page);
  }

  await scene.setup(page);

  if (scene.captureStrip) {
    if (scene.expectedScene !== 'GameScene') {
      const count = scene.frameCount ?? 8;
      const framesPerStep = scene.stripFramesPerStep ?? 4;
      const frameBuffers: Buffer[] = [];
      for (let fIdx = 0; fIdx < count; fIdx += 1) {
        if (fIdx > 0) {
          await stepDeterministicFrames(page, framesPerStep);
        }
        frameBuffers.push(await page.screenshot({ type: 'png' }));
      }
      const heroIdx = Math.min(Math.max(0, scene.heroFrameIndex ?? 0), frameBuffers.length - 1);
      const rawHero = frameBuffers[heroIdx]!;
      const litBuffer = scene.grayscaleFrom
        ? convertPngBufferToGrayscale(rawHero)
        : rawHero;
      const stripBuffer = stitchPngBuffersHorizontal(frameBuffers);
      await page.keyboard.up('KeyT');
      return {
        litBuffer,
        stripBuffer,
      };
    }

    const requiresHardAssert =
      scene.id.startsWith('ap2-') ||
      scene.stripSchedule !== undefined ||
      scene.apexEvent !== undefined;
    const effectiveGateMode: 'WARN_ONLY' | 'HARD_ASSERT' = requiresHardAssert
      ? process.env['ASHEN_ANIM_GATE_MODE'] === 'WARN_ONLY'
        ? 'WARN_ONLY'
        : 'HARD_ASSERT'
      : 'WARN_ONLY';

    const animResult = await captureAnimatedStripAndHeroScene(page, {
      id: scene.id,
      captureUnlit: scene.captureUnlit,
      grayscaleFrom: scene.grayscaleFrom,
      frameCount: scene.frameCount,
      stripFramesPerStep: scene.stripFramesPerStep,
      stripSchedule: scene.stripSchedule,
      heroFrameIndex: scene.heroFrameIndex,
      apexEvent: scene.apexEvent,
      actionRoi: scene.actionRoi,
      assertApexFlash: scene.assertApexFlash,
      gateMode: effectiveGateMode,
      setSceneLightingAndRenderStaticFrame,
    });
    await page.keyboard.up('KeyT');
    return {
      litBuffer: animResult.litBuffer,
      unlitBuffer: animResult.unlitBuffer,
      stripBuffer: animResult.stripBuffer,
      animResult,
    };
  }

  const rawLitBuffer = await page.screenshot({ type: 'png' });
  const litBuffer = scene.grayscaleFrom
    ? convertPngBufferToGrayscale(rawLitBuffer)
    : rawLitBuffer;

  let unlitBuffer: Buffer | undefined;
  if (scene.captureUnlit) {
    await setSceneLightingAndRenderStaticFrame(page, false);
    unlitBuffer = await page.screenshot({ type: 'png' });
    await setSceneLightingAndRenderStaticFrame(page, true);
  }

  await page.keyboard.up('KeyT');

  return {
    litBuffer,
    unlitBuffer,
  };
}

async function captureSingleScene(
  page: Page,
  scene: VisualSceneDef,
  capturedBuffers: Map<string, Buffer>,
): Promise<CapturedSceneBuffers> {
  try {
    return await captureSingleSceneOnce(page, scene, capturedBuffers);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Execution context was destroyed') || msg.includes('Target closed')) {
      return await captureSingleSceneOnce(page, scene, capturedBuffers);
    }
    throw err;
  }
}

test.describe('@visual Deterministic Visual Scene Catalog', () => {
  test.setTimeout(2_700_000);

  test('captures requested visual scenes, computes metrics, and optionally verifies freeze determinism', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    const phase = (process.env['ASHEN_SHOTS_PHASE'] ?? 'p0').trim();
    const label = (process.env['ASHEN_SHOTS_LABEL'] ?? 'baseline').trim();
    const scenesFilterRaw = (process.env['ASHEN_SHOTS_SCENES'] ?? '').trim();
    const verifyFreeze =
      process.env['ASHEN_VERIFY_FREEZE'] === '1' ||
      process.env['ASHEN_VERIFY_FREEZE'] === 'true';

    const requestedIds = scenesFilterRaw
      ? scenesFilterRaw
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : null;

    const selectedScenes: VisualSceneDef[] = requestedIds
      ? requestedIds.map((id) => {
          const found = VISUAL_SCENES.find((s) => s.id === id);
          if (!found) {
            throw new Error(
              `Unknown visual scene id "${id}". Available scenes: ${VISUAL_SCENES.map((s) => s.id).join(', ')}`,
            );
          }
          return found;
        })
      : [...VISUAL_SCENES];

    const shotDir = path.resolve(
      process.cwd(),
      'docs/screenshots',
      phase.startsWith('ap2-') || phase.startsWith('polish-') || phase.startsWith('phase-')
        ? phase
        : `polish-${phase}`,
      label,
    );
    fs.mkdirSync(shotDir, { recursive: true });

    await installDeterministicRafGate(page);

    const capturedPass1 = new Map<string, Buffer>();
    const capturedStripPass1 = new Map<string, Buffer>();
    const capturedAnimPass1 = new Map<string, CapturedAnimatedSceneResult>();
    const manifestEntries: SceneManifestEntry[] = [];
    const metricsOutput: Record<
      string,
      {
        lit?: Record<string, RegionMetrics>;
        unlit?: Record<string, RegionMetrics>;
        summary?: SceneEnvironmentSummary;
        animationGates?: AnimationGatesEvaluationResult;
      }
    > = {};

    for (const scene of selectedScenes) {
      const { litBuffer, unlitBuffer, stripBuffer, animResult } = await captureSingleScene(
        page,
        scene,
        capturedPass1,
      );

      capturedPass1.set(scene.id, litBuffer);
      if (stripBuffer) {
        capturedStripPass1.set(scene.id, stripBuffer);
      }
      if (animResult) {
        capturedAnimPass1.set(scene.id, animResult);
      }

      const litFilename = `${scene.id}.png`;
      fs.writeFileSync(path.join(shotDir, litFilename), litBuffer);

      // Auto-generate b3-combat-grayscale.png whenever b3-combat is captured
      if (scene.id === 'b3-combat') {
        const grayBuf = convertPngBufferToGrayscale(litBuffer);
        capturedPass1.set('b3-combat-grayscale', grayBuf);
        fs.writeFileSync(path.join(shotDir, 'b3-combat-grayscale.png'), grayBuf);
      }

      let unlitFilename: string | undefined;
      if (unlitBuffer) {
        unlitFilename = `${scene.id}-unlit.png`;
        fs.writeFileSync(path.join(shotDir, unlitFilename), unlitBuffer);
      }

      if (stripBuffer) {
        const stripFilename = `${scene.id}-strip.png`;
        fs.writeFileSync(path.join(shotDir, stripFilename), stripBuffer);
      }

      if (animResult) {
        for (const sheet of animResult.roiSheets) {
          fs.writeFileSync(
            path.join(shotDir, `${scene.id}-roi-${sheet.sheetIndex}.png`),
            sheet.pngBuffer,
          );
        }
        fs.writeFileSync(
          path.join(shotDir, `${scene.id}-telemetry-summary.md`),
          animResult.telemetrySummaryMd,
          'utf8',
        );
        fs.writeFileSync(
          path.join(shotDir, `${scene.id}-telemetry.json`),
          JSON.stringify(
            {
              roiMode: animResult.roiMode,
              telemetryInput: animResult.telemetryInput,
              gateReport: animResult.gateReport,
            },
            null,
            2,
          ),
          'utf8',
        );

        metricsOutput[scene.id] = {
          ...(metricsOutput[scene.id] ?? {}),
          animationGates: animResult.gateReport,
        };

        if (animResult.gateReport.mode === 'HARD_ASSERT') {
          expect(
            animResult.gateReport.passed,
            `Animation Gates failed for scene "${scene.id}": ${animResult.gateReport.failedGates.join(' | ')}`,
          ).toBe(true);
        } else if (
          animResult.gateReport.failedGates.length > 0 ||
          animResult.gateReport.warnings.length > 0
        ) {
          process.stdout.write(
            `[WARN_ONLY][${scene.id}] failedGates=${animResult.gateReport.failedGates.join(',')} | ${animResult.gateReport.warnings.join(' | ')}\n`,
          );
        }
      }

      if (scene.sampleRects && scene.sampleRects.length > 0) {
        const litRegions = analyzePngBufferRegions(litBuffer, scene.sampleRects);
        const unlitRegions = unlitBuffer
          ? analyzePngBufferRegions(unlitBuffer, scene.sampleRects)
          : undefined;
        const summary = computeSceneEnvironmentSummary(
          unlitRegions ?? litRegions,
          litRegions,
        );

        metricsOutput[scene.id] = {
          ...(metricsOutput[scene.id] ?? {}),
          lit: litRegions,
          ...(unlitRegions ? { unlit: unlitRegions } : {}),
          summary,
        };

        manifestEntries.push({
          id: scene.id,
          file: litFilename,
          ...(unlitFilename ? { unlitFile: unlitFilename } : {}),
          sampleRects: scene.sampleRects,
        });
      }
    }

    const manifestPath = path.join(shotDir, 'scene-manifest.json');
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ scenes: manifestEntries }, null, 2),
      'utf8',
    );

    const freezeDiffs: Record<
      string,
      {
        diffPixels: number;
        totalPixels: number;
        diffRatio: number;
        roiDiffRatios?: Record<string, number>;
        traceHashMatched?: boolean;
      }
    > = {};

    const metricsPath = path.join(shotDir, 'metrics.json');
    const writeMetricsFile = (): void => {
      fs.writeFileSync(
        metricsPath,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            phase,
            label,
            scenes: metricsOutput,
            ...(verifyFreeze ? { freezeDiffs } : {}),
          },
          null,
          2,
        ),
        'utf8',
      );
    };

    writeMetricsFile();

    if (verifyFreeze) {
      const capturedPass2 = new Map<string, Buffer>();
      for (const scene of selectedScenes) {
        const pass1Buf = capturedPass1.get(scene.id);
        expect(pass1Buf, `Pass 1 buffer missing for scene ${scene.id}`).toBeDefined();

        const pass2 = await captureSingleScene(page, scene, capturedPass2);
        capturedPass2.set(scene.id, pass2.litBuffer);

        const diff = comparePngBuffers(
          pass1Buf!,
          pass2.litBuffer,
          scene.freezeMaskRects,
        );

        const roiDiffRatios: Record<string, number> = {};
        let traceHashMatched: boolean | undefined;

        const pass1Anim = capturedAnimPass1.get(scene.id);
        const pass1Strip = capturedStripPass1.get(scene.id);
        if (pass1Anim && pass2.animResult) {
          traceHashMatched =
            pass1Anim.perTickTraceHash === pass2.animResult.perTickTraceHash;
          expect(
            traceHashMatched,
            `Freeze determinism perTickTrace mismatch for strip scene "${scene.id}"`,
          ).toBe(true);

          for (let sIdx = 0; sIdx < pass1Anim.roiSheets.length; sIdx += 1) {
            const s1 = pass1Anim.roiSheets[sIdx]!;
            const s2 = pass2.animResult.roiSheets[sIdx];
            expect(s2, `Pass 2 ROI sheet ${s1.sheetIndex} missing for ${scene.id}`).toBeDefined();
            const roiDiff = comparePngBuffers(s1.pngBuffer, s2!.pngBuffer);
            const roiKey = `roi-${s1.sheetIndex}`;
            roiDiffRatios[roiKey] = roiDiff.diffRatio;
            if (roiDiff.diffRatio >= 0.005) {
              fs.writeFileSync(
                path.join(shotDir, `${scene.id}-${roiKey}-freeze-pass2.png`),
                s2!.pngBuffer,
              );
              fs.writeFileSync(
                path.join(shotDir, `${scene.id}-${roiKey}-freeze-diff.png`),
                roiDiff.diffPngBuffer,
              );
            }
            expect(
              roiDiff.diffRatio,
              `Freeze determinism failed for "${scene.id}" ${roiKey}: diffRatio=${(roiDiff.diffRatio * 100).toFixed(4)}% exceeds 0.5% threshold`,
            ).toBeLessThan(0.005);
          }
        } else if (pass1Strip && pass2.stripBuffer) {
          const stripDiff = comparePngBuffers(pass1Strip, pass2.stripBuffer);
          roiDiffRatios['strip'] = stripDiff.diffRatio;
          if (stripDiff.diffRatio >= 0.005) {
            fs.writeFileSync(
              path.join(shotDir, `${scene.id}-strip-freeze-pass2.png`),
              pass2.stripBuffer,
            );
            fs.writeFileSync(
              path.join(shotDir, `${scene.id}-strip-freeze-diff.png`),
              stripDiff.diffPngBuffer,
            );
          }
          expect(
            stripDiff.diffRatio,
            `Freeze determinism failed for "${scene.id}" strip: diffRatio=${(stripDiff.diffRatio * 100).toFixed(4)}% exceeds 0.5% threshold`,
          ).toBeLessThan(0.005);
        }

        freezeDiffs[scene.id] = {
          diffPixels: diff.diffPixels,
          totalPixels: diff.totalPixels,
          diffRatio: diff.diffRatio,
          ...(Object.keys(roiDiffRatios).length > 0 ? { roiDiffRatios } : {}),
          ...(traceHashMatched !== undefined ? { traceHashMatched } : {}),
        };

        if (diff.diffRatio >= 0.005) {
          fs.writeFileSync(
            path.join(shotDir, `${scene.id}-freeze-pass2.png`),
            pass2.litBuffer,
          );
          fs.writeFileSync(
            path.join(shotDir, `${scene.id}-freeze-diff.png`),
            diff.diffPngBuffer,
          );
        }

        expect(
          diff.diffRatio,
          `Freeze determinism failed for scene "${scene.id}": diffRatio=${(diff.diffRatio * 100).toFixed(4)}% (${diff.diffPixels}/${diff.totalPixels} pixels) exceeds 0.5% threshold`,
        ).toBeLessThan(0.005);
      }

      writeMetricsFile();
    }

    expect(consoleErrors, 'Expected 0 console errors during visual capture').toEqual([]);
    expect(consoleWarnings, 'Expected 0 console warnings during visual capture').toEqual([]);
  });
});
