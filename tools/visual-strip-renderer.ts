import { PNG } from 'pngjs';
import type {
  KeyframeTraceRecord,
  RoiResolutionMode,
  ScreenRect,
} from './visual-animation-gates.js';

const FONT_5X7: Record<string, readonly number[]> = {
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  ':': [0x00, 0x04, 0x04, 0x00, 0x04, 0x04, 0x00],
  '|': [0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  '[': [0x0e, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0e],
  ']': [0x0e, 0x02, 0x02, 0x02, 0x02, 0x02, 0x0e],
  '(': [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ')': [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  '+': [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00],
  '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '_': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ',': [0x00, 0x00, 0x00, 0x00, 0x04, 0x04, 0x08],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '%': [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  '@': [0x0e, 0x11, 0x17, 0x15, 0x17, 0x10, 0x0e],
  '★': [0x04, 0x15, 0x0e, 0x1f, 0x0e, 0x15, 0x04],
  'Δ': [0x04, 0x04, 0x0a, 0x0a, 0x11, 0x11, 0x1f],
};

function setPixel(
  png: PNG,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function fillRect(
  png: PNG,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(png.width, Math.floor(x + w));
  const y1 = Math.min(png.height, Math.floor(y + h));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const idx = (py * png.width + px) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
}

function strokeRect(
  png: PNG,
  x: number,
  y: number,
  w: number,
  h: number,
  thickness: number,
  r: number,
  g: number,
  b: number,
): void {
  fillRect(png, x, y, w, thickness, r, g, b);
  fillRect(png, x, y + h - thickness, w, thickness, r, g, b);
  fillRect(png, x, y, thickness, h, r, g, b);
  fillRect(png, x + w - thickness, y, thickness, h, r, g, b);
}

export function drawBitmapString(
  png: PNG,
  text: string,
  startX: number,
  startY: number,
  r: number,
  g: number,
  b: number,
): number {
  let cursorX = Math.floor(startX);
  const y0 = Math.floor(startY);
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i]!;
    const glyph = FONT_5X7[ch] ?? FONT_5X7[' ']!;
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row]!;
      for (let col = 0; col < 5; col++) {
        if ((bits & (1 << (4 - col))) !== 0) {
          setPixel(png, cursorX + col, y0 + row, r, g, b, 255);
        }
      }
    }
    cursorX += 6;
  }
  return cursorX;
}

function buildHeaderTitleText(kf: KeyframeTraceRecord, heroFrameIndex: number): string {
  const isHero = kf.frameIndex === heroFrameIndex;
  const stageStr = kf.customLabel ? `${kf.stage.toUpperCase()}:${kf.customLabel}` : kf.stage.toUpperCase();
  const heroPrefix = isHero ? '★ HERO: ' : '';
  const hitstopTag = kf.hitStopActive ? ' (HITSTOP)' : '';
  return `${kf.frameLabel} [TICK:${kf.simTick} | +${kf.deltaTicks}T] ${heroPrefix}${stageStr}${hitstopTag} | ΔPX:${kf.changedScreenPixels}`;
}

function draw32WorldPxScaleBar(png: PNG, cellRightX: number, cellBottomY: number): void {
  // 32 world px = 64 screen px at cam.zoom = 2.0
  const barW = 64;
  const barX = cellRightX - barW - 10;
  const barY = cellBottomY - 12;
  fillRect(png, barX - 4, barY - 10, barW + 8, 18, 20, 16, 25, 230);
  fillRect(png, barX, barY, barW, 2, 250, 204, 21, 255);
  fillRect(png, barX, barY - 3, 2, 6, 250, 204, 21, 255);
  fillRect(png, barX + barW - 2, barY - 3, 2, 6, 250, 204, 21, 255);
  drawBitmapString(png, '32U=64PX', barX + 8, barY - 9, 250, 204, 21);
}

/**
 * Renders 1:1 Native Pixel ROI sheets (<scene>-roi-1.png, <scene>-roi-2.png[, <scene>-roi-3.png]).
 * Each cell is 640x380 (640x20 top header bar + 640x360 1:1 native pixel crop).
 * 4 cells are arranged in a 2x2 grid -> 1280x760 PNG (< 1536px).
 */
export function renderRoiSheets1to1(
  frameBuffers: readonly Buffer[],
  keyframes: readonly KeyframeTraceRecord[],
  heroFrameIndex: number,
  roiMode: RoiResolutionMode,
): Buffer[] {
  const sourcePngs = frameBuffers.map((b) => PNG.sync.read(b));
  const sheetCount = Math.ceil(keyframes.length / 4);
  const cellW = 640;
  const headerH = 20;
  const cropH = 360;
  const cellH = headerH + cropH; // 380
  const sheetW = cellW * 2; // 1280
  const sheetH = cellH * 2; // 760

  const sheets: Buffer[] = [];
  for (let s = 0; s < sheetCount; s++) {
    const outPng = new PNG({ width: sheetW, height: sheetH });
    fillRect(outPng, 0, 0, sheetW, sheetH, 20, 16, 25, 255);

    for (let localIdx = 0; localIdx < 4; localIdx++) {
      const frameIdx = s * 4 + localIdx;
      if (frameIdx >= keyframes.length || frameIdx >= sourcePngs.length) continue;

      const kf = keyframes[frameIdx]!;
      const srcPng = sourcePngs[frameIdx]!;
      const col = localIdx % 2;
      const row = Math.floor(localIdx / 2);
      const cellX = col * cellW;
      const cellY = row * cellH;

      // 1. Separated 20px top header bar (#141019)
      fillRect(outPng, cellX, cellY, cellW, headerH, 20, 16, 25, 255);
      const isHero = frameIdx === heroFrameIndex;
      const titleText = buildHeaderTitleText(kf, heroFrameIndex);
      const textR = isHero ? 250 : 244;
      const textG = isHero ? 204 : 241;
      const textB = isHero ? 21 : 234;
      const endX = drawBitmapString(outPng, titleText, cellX + 6, cellY + 6, textR, textG, textB);

      if (roiMode !== 'level1_fixed_all') {
        const roiTag = ` ROI@[${Math.round(kf.roiWorldCenter.x)},${Math.round(kf.roiWorldCenter.y)}]`;
        drawBitmapString(outPng, roiTag, endX + 4, cellY + 6, 250, 204, 21);
      }

      // 2. 1:1 Native Pixel Crop (640x360)
      const rx = Math.max(0, Math.min(srcPng.width - cellW, Math.floor(kf.roiRect.x)));
      const ry = Math.max(0, Math.min(srcPng.height - cropH, Math.floor(kf.roiRect.y)));
      for (let py = 0; py < cropH; py++) {
        const srcRowStart = ((ry + py) * srcPng.width + rx) * 4;
        const dstRowStart = ((cellY + headerH + py) * sheetW + cellX) * 4;
        srcPng.data.copy(outPng.data, dstRowStart, srcRowStart, srcRowStart + cellW * 4);
      }

      // 3. Border & optional scale bar for Level 2 / Level 3 fallback
      if (roiMode !== 'level1_fixed_all') {
        draw32WorldPxScaleBar(outPng, cellX + cellW, cellY + cellH);
      }
      if (isHero) {
        strokeRect(outPng, cellX, cellY, cellW, cellH, 2, 250, 204, 21);
      } else {
        strokeRect(outPng, cellX, cellY, cellW, cellH, 1, 60, 52, 74);
      }
    }

    sheets.push(PNG.sync.write(outPng));
  }

  return sheets;
}

/**
 * Downsamples a 1920x1080 PNG into a 480x270 cell using a 4x4 box filter
 * and draws the yellow roiRect outline.
 */
function renderDownsampledCell4x4(
  srcPng: PNG,
  dstPng: PNG,
  dstOffsetX: number,
  dstOffsetY: number,
  roiRect: ScreenRect,
): void {
  const thumbW = 480;
  const thumbH = 270;
  for (let ty = 0; ty < thumbH; ty++) {
    for (let tx = 0; tx < thumbW; tx++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      for (let sy = 0; sy < 4; sy++) {
        const py = Math.min(srcPng.height - 1, ty * 4 + sy);
        for (let sx = 0; sx < 4; sx++) {
          const px = Math.min(srcPng.width - 1, tx * 4 + sx);
          const idx = (py * srcPng.width + px) * 4;
          rSum += srcPng.data[idx]!;
          gSum += srcPng.data[idx + 1]!;
          bSum += srcPng.data[idx + 2]!;
        }
      }
      setPixel(
        dstPng,
        dstOffsetX + tx,
        dstOffsetY + ty,
        rSum >> 4,
        gSum >> 4,
        bSum >> 4,
        255,
      );
    }
  }

  // Draw yellow roiRect box scaled by 1/4
  const rx = Math.round(roiRect.x / 4);
  const ry = Math.round(roiRect.y / 4);
  const rw = Math.round(roiRect.width / 4);
  const rh = Math.round(roiRect.height / 4);
  strokeRect(dstPng, dstOffsetX + rx, dstOffsetY + ry, rw, rh, 2, 250, 204, 21);
}

/**
 * Renders the full-screen overview grid (<scene>-strip.png):
 * - 8 frames -> 4x2 grid (1920x580)
 * - 12 frames -> 4x3 grid (1920x870)
 * Each cell is 480x290 (480x20 header bar + 480x270 4x4 box-filtered thumbnail with yellow roiRect).
 */
export function renderOverviewGridStrip(
  frameBuffers: readonly Buffer[],
  keyframes: readonly KeyframeTraceRecord[],
  heroFrameIndex: number,
): Buffer {
  const sourcePngs = frameBuffers.map((b) => PNG.sync.read(b));
  const cols = 4;
  const rows = keyframes.length > 8 ? 3 : 2;
  const cellW = 480;
  const headerH = 20;
  const thumbH = 270;
  const cellH = headerH + thumbH; // 290
  const outW = cols * cellW; // 1920
  const outH = rows * cellH; // 580 or 870

  const outPng = new PNG({ width: outW, height: outH });
  fillRect(outPng, 0, 0, outW, outH, 20, 16, 25, 255);

  for (let idx = 0; idx < keyframes.length && idx < sourcePngs.length; idx++) {
    const kf = keyframes[idx]!;
    const srcPng = sourcePngs[idx]!;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cellX = col * cellW;
    const cellY = row * cellH;

    fillRect(outPng, cellX, cellY, cellW, headerH, 20, 16, 25, 255);
    const isHero = idx === heroFrameIndex;
    const kPx =
      kf.changedScreenPixels >= 1000
        ? `${(kf.changedScreenPixels / 1000).toFixed(1)}K`
        : `${kf.changedScreenPixels}`;
    const shortTitle = `${kf.frameLabel} [T:${kf.simTick}|+${kf.deltaTicks}] ${isHero ? '★ HERO ' : ''}${kf.stage.toUpperCase()} Δ:${kPx}`;
    drawBitmapString(
      outPng,
      shortTitle,
      cellX + 6,
      cellY + 6,
      isHero ? 250 : 244,
      isHero ? 204 : 241,
      isHero ? 21 : 234,
    );

    renderDownsampledCell4x4(srcPng, outPng, cellX, cellY + headerH, kf.roiRect);
    if (isHero) {
      strokeRect(outPng, cellX, cellY, cellW, cellH, 2, 250, 204, 21);
    } else {
      strokeRect(outPng, cellX, cellY, cellW, cellH, 1, 60, 52, 74);
    }
  }

  return PNG.sync.write(outPng);
}
