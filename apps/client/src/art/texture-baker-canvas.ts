import type Phaser from 'phaser';

export const RIG_PROP_ATLAS_PREFIX = 'atlas_rig_prop_' as const;
const RIG_PROP_ATLAS_PAGE_SIZE = 2048;
const RIG_PROP_ATLAS_GUTTER = 2;

export interface AtlasFrameBinding {
  textureKey: string;
  frameName?: string;
}

interface PackedAtlasEntry {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fallbackCanvas: HTMLCanvasElement;
}

interface FreeAtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AtlasPageTextureHandle {
  add: (
    name: number | string,
    sourceIndex: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => unknown;
  refresh?: () => unknown;
}

interface AtlasPageRecord {
  pageIndex: number;
  textureKey: string;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  freeRects: FreeAtlasRect[];
  entries: PackedAtlasEntry[];
  uploadedTex: AtlasPageTextureHandle | null;
  registeredCount: number;
  dirtyRedraw: boolean;
}

interface RigPropAtlasState {
  scale: number;
  sessionDepth: number;
  deferFlush: boolean;
  supported: boolean;
  pages: AtlasPageRecord[];
  bindings: Map<
    string,
    { textureKey: string; frameName: string; pageIndex: number; x: number; y: number; w: number; h: number }
  >;
  highestUploadedPageCount: number;
}

const atlasStateByTexMgr = new WeakMap<object, RigPropAtlasState>();

function nextPow2(n: number): number {
  let p = 256;
  while (p < n) {
    p <<= 1;
  }
  return p;
}

export function isRigPropAtlasEligibleKey(key: string): boolean {
  return (
    key.startsWith('rig_') ||
    key.startsWith('player_ring_') ||
    key.startsWith('weapon_vec_') ||
    key.startsWith('prop_')
  );
}

function registerStandaloneCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
): void {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  scene.textures.addCanvas(key, canvas);
}

function getOrCreateAtlasState(texMgr: object, scale: number): RigPropAtlasState {
  let state = atlasStateByTexMgr.get(texMgr);
  if (!state) {
    state = {
      scale,
      sessionDepth: 0,
      deferFlush: false,
      supported: true,
      pages: [],
      bindings: new Map(),
      highestUploadedPageCount: 0,
    };
    atlasStateByTexMgr.set(texMgr, state);
  }
  return state;
}

export function beginRigPropAtlasSession(
  scene: Phaser.Scene,
  scale: number,
  options: { reset?: boolean; deferFlush?: boolean } = {},
): void {
  const texMgr = scene?.textures as unknown as object | undefined;
  if (!texMgr || typeof document === 'undefined') return;

  const state = getOrCreateAtlasState(texMgr, scale);
  if ((options.reset && state.sessionDepth === 0) || state.scale !== scale) {
    state.highestUploadedPageCount = Math.max(
      state.highestUploadedPageCount,
      state.pages.length,
    );
    state.scale = scale;
    state.supported = true;
    state.pages = [];
    state.bindings.clear();
  }
  if (options.deferFlush) {
    state.deferFlush = true;
  }
  state.sessionDepth += 1;
}

export function endRigPropAtlasSession(
  scene: Phaser.Scene,
  options: { clearDeferFlush?: boolean } = {},
): void {
  const texMgr = scene?.textures as unknown as object | undefined;
  if (!texMgr) return;
  const state = atlasStateByTexMgr.get(texMgr);
  if (!state) return;

  if (options.clearDeferFlush) {
    state.deferFlush = false;
  }
  state.sessionDepth = Math.max(0, state.sessionDepth - 1);
  if (!state.deferFlush && state.sessionDepth === 0) {
    flushRigPropAtlasPages(scene, state);
  }
}

function createAtlasPage(
  pageIndex: number,
  minSpriteW: number,
  minSpriteH: number,
): AtlasPageRecord | null {
  const width = Math.max(
    RIG_PROP_ATLAS_PAGE_SIZE,
    nextPow2(minSpriteW + RIG_PROP_ATLAS_GUTTER * 2),
  );
  const height = Math.max(
    RIG_PROP_ATLAS_PAGE_SIZE,
    nextPow2(minSpriteH + RIG_PROP_ATLAS_GUTTER * 2),
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof ctx.drawImage !== 'function') {
    return null;
  }
  return {
    pageIndex,
    textureKey: `${RIG_PROP_ATLAS_PREFIX}${pageIndex}`,
    width,
    height,
    canvas,
    ctx,
    freeRects: [
      {
        x: RIG_PROP_ATLAS_GUTTER,
        y: RIG_PROP_ATLAS_GUTTER,
        w: width - RIG_PROP_ATLAS_GUTTER,
        h: height - RIG_PROP_ATLAS_GUTTER,
      },
    ],
    entries: [],
    uploadedTex: null,
    registeredCount: 0,
    dirtyRedraw: false,
  };
}

function findBestFreeRectOnPage(
  freeRects: readonly FreeAtlasRect[],
  reqW: number,
  reqH: number,
): FreeAtlasRect | null {
  let best: FreeAtlasRect | null = null;
  let bestShort = Infinity;
  let bestLong = Infinity;
  for (let i = 0; i < freeRects.length; i++) {
    const r = freeRects[i]!;
    if (r.w < reqW || r.h < reqH) continue;
    const leftoverW = r.w - reqW;
    const leftoverH = r.h - reqH;
    const shortSide = Math.min(leftoverW, leftoverH);
    const longSide = Math.max(leftoverW, leftoverH);
    if (
      shortSide < bestShort ||
      (shortSide === bestShort && longSide < bestLong) ||
      (shortSide === bestShort && longSide === bestLong && (!best || r.y < best.y)) ||
      (shortSide === bestShort &&
        longSide === bestLong &&
        best !== null &&
        r.y === best.y &&
        r.x < best.x)
    ) {
      best = r;
      bestShort = shortSide;
      bestLong = longSide;
    }
  }
  return best;
}

function splitAndPruneFreeRects(
  freeRects: readonly FreeAtlasRect[],
  px: number,
  py: number,
  pw: number,
  ph: number,
): FreeAtlasRect[] {
  const split: FreeAtlasRect[] = [];
  for (let i = 0; i < freeRects.length; i++) {
    const f = freeRects[i]!;
    if (px >= f.x + f.w || px + pw <= f.x || py >= f.y + f.h || py + ph <= f.y) {
      split.push(f);
      continue;
    }
    if (px > f.x) {
      split.push({ x: f.x, y: f.y, w: px - f.x, h: f.h });
    }
    if (px + pw < f.x + f.w) {
      split.push({ x: px + pw, y: f.y, w: f.x + f.w - (px + pw), h: f.h });
    }
    if (py > f.y) {
      split.push({ x: f.x, y: f.y, w: f.w, h: py - f.y });
    }
    if (py + ph < f.y + f.h) {
      split.push({ x: f.x, y: py + ph, w: f.w, h: f.y + f.h - (py + ph) });
    }
  }

  const pruned: FreeAtlasRect[] = [];
  for (let i = 0; i < split.length; i++) {
    const a = split[i]!;
    let contained = false;
    for (let j = 0; j < split.length; j++) {
      if (i === j) continue;
      const b = split[j]!;
      if (b.x <= a.x && b.y <= a.y && b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h) {
        if (
          j < i ||
          b.x < a.x ||
          b.y < a.y ||
          b.x + b.w > a.x + a.w ||
          b.y + b.h > a.y + a.h
        ) {
          contained = true;
          break;
        }
      }
    }
    if (!contained) {
      pruned.push(a);
    }
  }
  return pruned;
}

function packIntoRigPropAtlas(
  state: RigPropAtlasState,
  key: string,
  canvas: HTMLCanvasElement,
): boolean {
  if (!state.supported) return false;
  const cw = canvas.width;
  const ch = canvas.height;
  if (cw <= 0 || ch <= 0) return false;

  const existing = state.bindings.get(key);
  if (existing && existing.w === cw && existing.h === ch) {
    const existingPage = state.pages[existing.pageIndex];
    if (existingPage) {
      existingPage.ctx.clearRect(existing.x, existing.y, cw, ch);
      existingPage.ctx.drawImage(canvas, existing.x, existing.y);
      existingPage.dirtyRedraw = true;
      return true;
    }
  }

  const reqW = cw + RIG_PROP_ATLAS_GUTTER;
  const reqH = ch + RIG_PROP_ATLAS_GUTTER;

  let chosenPage: AtlasPageRecord | undefined;
  let chosenX = 0;
  let chosenY = 0;

  for (let p = 0; p < state.pages.length; p++) {
    const page = state.pages[p]!;
    const bestRect = findBestFreeRectOnPage(page.freeRects, reqW, reqH);
    if (bestRect) {
      chosenPage = page;
      chosenX = bestRect.x;
      chosenY = bestRect.y;
      page.freeRects = splitAndPruneFreeRects(page.freeRects, chosenX, chosenY, reqW, reqH);
      break;
    }
  }

  if (!chosenPage) {
    const nextPage = createAtlasPage(state.pages.length, cw, ch);
    if (!nextPage) {
      state.supported = false;
      return false;
    }
    chosenX = RIG_PROP_ATLAS_GUTTER;
    chosenY = RIG_PROP_ATLAS_GUTTER;
    nextPage.freeRects = splitAndPruneFreeRects(
      nextPage.freeRects,
      chosenX,
      chosenY,
      reqW,
      reqH,
    );
    state.pages.push(nextPage);
    chosenPage = nextPage;
  }

  chosenPage.ctx.drawImage(canvas, chosenX, chosenY);
  chosenPage.entries.push({
    key,
    x: chosenX,
    y: chosenY,
    w: cw,
    h: ch,
    fallbackCanvas: canvas,
  });
  state.bindings.set(key, {
    textureKey: chosenPage.textureKey,
    frameName: key,
    pageIndex: chosenPage.pageIndex,
    x: chosenX,
    y: chosenY,
    w: cw,
    h: ch,
  });
  return true;
}

function flushRigPropAtlasPages(scene: Phaser.Scene, state: RigPropAtlasState): void {
  if (!state.supported) return;

  for (let p = 0; p < state.pages.length; p++) {
    const page = state.pages[p]!;
    if (!page.uploadedTex) {
      if (scene.textures.exists(page.textureKey)) {
        scene.textures.remove(page.textureKey);
      }
      const rawTex = scene.textures.addCanvas(page.textureKey, page.canvas) as unknown as
        | AtlasPageTextureHandle
        | undefined;
      if (!rawTex || typeof rawTex.add !== 'function') {
        if (scene.textures.exists(page.textureKey)) {
          scene.textures.remove(page.textureKey);
        }
        state.supported = false;
        state.bindings.clear();
        for (let fp = 0; fp < state.pages.length; fp++) {
          const fallbackPage = state.pages[fp]!;
          if (fallbackPage.uploadedTex && scene.textures.exists(fallbackPage.textureKey)) {
            scene.textures.remove(fallbackPage.textureKey);
          }
          for (let ei = 0; ei < fallbackPage.entries.length; ei++) {
            const entry = fallbackPage.entries[ei]!;
            registerStandaloneCanvasTexture(scene, entry.key, entry.fallbackCanvas);
          }
        }
        state.pages = [];
        return;
      }
      page.uploadedTex = rawTex;
      page.registeredCount = 0;
      page.dirtyRedraw = false;
    } else if (page.dirtyRedraw || page.registeredCount < page.entries.length) {
      page.uploadedTex.refresh?.();
      page.dirtyRedraw = false;
    }

    for (let i = page.registeredCount; i < page.entries.length; i++) {
      const entry = page.entries[i]!;
      page.uploadedTex.add(entry.key, 0, entry.x, entry.y, entry.w, entry.h);
    }
    page.registeredCount = page.entries.length;
  }

  for (let staleIdx = state.pages.length; staleIdx < state.highestUploadedPageCount; staleIdx++) {
    const staleKey = `${RIG_PROP_ATLAS_PREFIX}${staleIdx}`;
    if (scene.textures.exists(staleKey)) {
      scene.textures.remove(staleKey);
    }
  }
  state.highestUploadedPageCount = state.pages.length;
}

export function resolveRigPropAtlasBinding(
  scene: Phaser.Scene | undefined,
  logicalKey: string,
): AtlasFrameBinding {
  const texMgr = scene?.textures as unknown as
    | ({ exists?: (key: string) => boolean } & object)
    | undefined;
  if (!texMgr) {
    return { textureKey: logicalKey };
  }
  const state = atlasStateByTexMgr.get(texMgr);
  const entry = state?.bindings.get(logicalKey);
  if (!entry) {
    return { textureKey: logicalKey };
  }
  if (typeof texMgr.exists === 'function' && !texMgr.exists(entry.textureKey)) {
    return { textureKey: logicalKey };
  }
  return { textureKey: entry.textureKey, frameName: entry.frameName };
}

export function hasActiveRigPropAtlas(scene: Phaser.Scene | undefined): boolean {
  const texMgr = scene?.textures as unknown as
    | ({ exists?: (key: string) => boolean } & object)
    | undefined;
  if (!texMgr) return false;
  const state = atlasStateByTexMgr.get(texMgr);
  if (!state || !state.supported || state.pages.length === 0) return false;
  for (let i = 0; i < state.pages.length; i++) {
    const pageKey = state.pages[i]!.textureKey;
    if (typeof texMgr.exists === 'function' && !texMgr.exists(pageKey)) {
      return false;
    }
  }
  return true;
}

export function bakeCustomCanvas(
  scene: Phaser.Scene,
  key: string,
  worldW: number,
  worldH: number,
  scale: number,
  drawFn: (ctx: CanvasRenderingContext2D) => void,
): void {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(worldW * scale);
  canvas.height = Math.ceil(worldH * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(worldW / 2, worldH / 2);
  drawFn(ctx);
  ctx.restore();

  registerCanvasTexture(scene, key, canvas);
}

export function registerCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
): void {
  const texMgr = scene?.textures as unknown as object | undefined;
  if (texMgr && isRigPropAtlasEligibleKey(key)) {
    const state = atlasStateByTexMgr.get(texMgr);
    if (state && state.sessionDepth > 0 && state.supported) {
      if (packIntoRigPropAtlas(state, key, canvas)) {
        if (scene.textures.exists(key)) {
          scene.textures.remove(key);
        }
        return;
      }
    }
  }
  registerStandaloneCanvasTexture(scene, key, canvas);
}
