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
  analyzePngBufferRegions,
  comparePngBuffers,
  computeSceneEnvironmentSummary,
  convertPngBufferToGrayscale,
  stitchPngBuffersHorizontal,
  type RegionMetrics,
  type SceneEnvironmentSummary,
  type SceneManifestEntry,
} from '../../tools/visual-metrics.js';

interface CapturedSceneBuffers {
  litBuffer: Buffer;
  unlitBuffer?: Buffer;
  stripBuffer?: Buffer;
}

async function captureSingleScene(
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

  await scene.setup(page);

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

  let stripBuffer: Buffer | undefined;
  if (scene.captureStrip) {
    const stripFrames: Buffer[] = [litBuffer];
    for (let i = 1; i < 8; i++) {
      await stepDeterministicFrames(page, 5);
      const frameBuf = await page.screenshot({ type: 'png' });
      stripFrames.push(frameBuf);
    }
    stripBuffer = stitchPngBuffersHorizontal(stripFrames);
  }

  return {
    litBuffer,
    unlitBuffer,
    stripBuffer,
  };
}

test.describe('@visual Deterministic Visual Scene Catalog', () => {
  test.setTimeout(900_000);

  test('captures requested visual scenes, computes metrics, and optionally verifies freeze determinism', async ({
    page,
  }) => {
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
      `polish-${phase}`,
      label,
    );
    fs.mkdirSync(shotDir, { recursive: true });

    await installDeterministicRafGate(page);

    const capturedPass1 = new Map<string, Buffer>();
    const manifestEntries: SceneManifestEntry[] = [];
    const metricsOutput: Record<
      string,
      {
        lit?: Record<string, RegionMetrics>;
        unlit?: Record<string, RegionMetrics>;
        summary?: SceneEnvironmentSummary;
      }
    > = {};

    for (const scene of selectedScenes) {
      const { litBuffer, unlitBuffer, stripBuffer } = await captureSingleScene(
        page,
        scene,
        capturedPass1,
      );

      capturedPass1.set(scene.id, litBuffer);
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

    const metricsPath = path.join(shotDir, 'metrics.json');
    fs.writeFileSync(
      metricsPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          phase,
          label,
          scenes: metricsOutput,
        },
        null,
        2,
      ),
      'utf8',
    );

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
    }
  });
});
