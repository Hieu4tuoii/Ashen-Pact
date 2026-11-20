import {
  type ArenaMap,
  CONVEYOR_BELT_SPEED,
  type SimPropState,
  TILE_SIZE,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { ENV_PALETTE, hexToNum, PALETTE } from '../art/palette.js';
import { getFreezeVisualTimeSec, getVisualQueryConfig } from '../core/visual-query.js';
import { graphicsSettings } from '../ui/graphics-settings.js';
import {
  computeTileDistToWall,
  getVisibleFloorDecals,
  isActiveWallTile,
  isExteriorVoidWallTile,
  isProtectedMetricSampleTile,
  type RoomArchitecturePlan,
  type SolidArchitectureDecor,
} from './biome-architecture.js';

export interface WorldClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExteriorVoidRectSpan {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ActiveRowSpan extends ExteriorVoidRectSpan {
  locksHorizontalMerge: boolean;
}

function collectExteriorVoidRowSpans(
  map: ArenaMap,
  preserveSouthEastTileStart: boolean,
): ExteriorVoidRectSpan[] {
  const result: ExteriorVoidRectSpan[] = [];
  const rowSpans: ActiveRowSpan[] = [];

  const pushOrMergeInRow = (
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    locksHorizontalMerge: boolean,
  ): void => {
    if (rw <= 0 || rh <= 0) return;
    if (!locksHorizontalMerge) {
      for (let i = rowSpans.length - 1; i >= 0; i--) {
        const prev = rowSpans[i]!;
        if (
          !prev.locksHorizontalMerge &&
          prev.y === ry &&
          prev.height === rh &&
          prev.x + prev.width === rx
        ) {
          prev.width += rw;
          return;
        }
      }
    }
    rowSpans.push({
      x: rx,
      y: ry,
      width: rw,
      height: rh,
      locksHorizontalMerge,
    });
  };

  for (let ty = 0; ty < map.rows; ty++) {
    rowSpans.length = 0;
    const oy = ty * TILE_SIZE;
    for (let tx = 0; tx < map.cols; tx++) {
      if (!isExteriorVoidWallTile(map, tx, ty)) continue;
      const ox = tx * TILE_SIZE;
      const adjN = ty > 0 && isActiveWallTile(map, tx, ty - 1);
      const adjS = ty + 1 < map.rows && isActiveWallTile(map, tx, ty + 1);
      const adjW = tx > 0 && isActiveWallTile(map, tx - 1, ty);
      const adjE = tx + 1 < map.cols && isActiveWallTile(map, tx + 1, ty);
      const diagNW =
        !adjN && !adjW && tx > 0 && ty > 0 && isActiveWallTile(map, tx - 1, ty - 1);
      const diagNE =
        !adjN &&
        !adjE &&
        tx + 1 < map.cols &&
        ty > 0 &&
        isActiveWallTile(map, tx + 1, ty - 1);
      const diagSW =
        !adjS &&
        !adjW &&
        tx > 0 &&
        ty + 1 < map.rows &&
        isActiveWallTile(map, tx - 1, ty + 1);
      const diagSE =
        !adjS &&
        !adjE &&
        tx + 1 < map.cols &&
        ty + 1 < map.rows &&
        isActiveWallTile(map, tx + 1, ty + 1);

      const inW = adjW ? 6 : 0;
      const inE = adjE ? 6 : 0;
      const inN = adjN || diagNW || diagNE ? 6 : 0;
      const inS = adjS || diagSW || diagSE ? 6 : 0;
      const lockMain = preserveSouthEastTileStart && (adjS || adjE);
      pushOrMergeInRow(
        ox + inW,
        oy + inN,
        TILE_SIZE - inW - inE,
        TILE_SIZE - inN - inS,
        lockMain,
      );

      if (!adjN && (diagNW || diagNE)) {
        const tx0 = ox + (adjW || diagNW ? 6 : 0);
        const tx1 = ox + TILE_SIZE - (adjE || diagNE ? 6 : 0);
        if (tx1 > tx0) {
          pushOrMergeInRow(tx0, oy, tx1 - tx0, 6, lockMain);
        }
      }
      if (!adjS && (diagSW || diagSE)) {
        const bx0 = ox + (adjW || diagSW ? 6 : 0);
        const bx1 = ox + TILE_SIZE - (adjE || diagSE ? 6 : 0);
        if (bx1 > bx0) {
          pushOrMergeInRow(bx0, oy + TILE_SIZE - 6, bx1 - bx0, 6, lockMain);
        }
      }
    }
    for (let i = 0; i < rowSpans.length; i++) {
      const s = rowSpans[i]!;
      result.push({ x: s.x, y: s.y, width: s.width, height: s.height });
    }
  }

  return result;
}

/**
 * Computes exact Exterior Void mask rectangles (preserving all 6px cardinal & diagonal
 * active-wall casing insets) by coalescing contiguous horizontal spans across each row's
 * 6px/20px/6px sub-bands and merging vertically adjacent spans with identical `(x, width)`.
 */
export function mergeExteriorVoidRowSpans(map: ArenaMap): ExteriorVoidRectSpan[] {
  const bandSpans: ExteriorVoidRectSpan[] = [];

  const appendSubBand = (
    bandY: number,
    bandH: number,
    getTileInterval: (tx: number) => readonly [number, number] | null,
  ): void => {
    let runStart = -1;
    let runEnd = -1;
    for (let tx = 0; tx < map.cols; tx++) {
      const iv = getTileInterval(tx);
      if (!iv || iv[1] <= iv[0]) {
        if (runEnd > runStart) {
          bandSpans.push({ x: runStart, y: bandY, width: runEnd - runStart, height: bandH });
          runStart = -1;
          runEnd = -1;
        }
        continue;
      }
      const [x0, x1] = iv;
      if (runEnd > runStart && x0 === runEnd) {
        runEnd = x1;
      } else {
        if (runEnd > runStart) {
          bandSpans.push({ x: runStart, y: bandY, width: runEnd - runStart, height: bandH });
        }
        runStart = x0;
        runEnd = x1;
      }
    }
    if (runEnd > runStart) {
      bandSpans.push({ x: runStart, y: bandY, width: runEnd - runStart, height: bandH });
    }
  };

  interface RowTileFlags {
    isVoid: boolean;
    adjN: boolean;
    adjS: boolean;
    adjW: boolean;
    adjE: boolean;
    diagNW: boolean;
    diagNE: boolean;
    diagSW: boolean;
    diagSE: boolean;
  }
  const rowFlags: RowTileFlags[] = new Array<RowTileFlags>(map.cols);
  for (let tx = 0; tx < map.cols; tx++) {
    rowFlags[tx] = {
      isVoid: false,
      adjN: false,
      adjS: false,
      adjW: false,
      adjE: false,
      diagNW: false,
      diagNE: false,
      diagSW: false,
      diagSE: false,
    };
  }

  for (let ty = 0; ty < map.rows; ty++) {
    let rowHasVoid = false;
    for (let tx = 0; tx < map.cols; tx++) {
      const f = rowFlags[tx]!;
      if (!isExteriorVoidWallTile(map, tx, ty)) {
        f.isVoid = false;
        continue;
      }
      rowHasVoid = true;
      f.isVoid = true;
      f.adjN = ty > 0 && isActiveWallTile(map, tx, ty - 1);
      f.adjS = ty + 1 < map.rows && isActiveWallTile(map, tx, ty + 1);
      f.adjW = tx > 0 && isActiveWallTile(map, tx - 1, ty);
      f.adjE = tx + 1 < map.cols && isActiveWallTile(map, tx + 1, ty);
      f.diagNW = !f.adjN && !f.adjW && tx > 0 && ty > 0 && isActiveWallTile(map, tx - 1, ty - 1);
      f.diagNE =
        !f.adjN && !f.adjE && tx + 1 < map.cols && ty > 0 && isActiveWallTile(map, tx + 1, ty - 1);
      f.diagSW =
        !f.adjS && !f.adjW && tx > 0 && ty + 1 < map.rows && isActiveWallTile(map, tx - 1, ty + 1);
      f.diagSE =
        !f.adjS &&
        !f.adjE &&
        tx + 1 < map.cols &&
        ty + 1 < map.rows &&
        isActiveWallTile(map, tx + 1, ty + 1);
    }
    if (!rowHasVoid) continue;

    const oy = ty * TILE_SIZE;
    // Top 6px sub-band [oy, oy + 6)
    appendSubBand(oy, 6, (tx) => {
      const f = rowFlags[tx]!;
      if (!f.isVoid || f.adjN) return null;
      const ox = tx * TILE_SIZE;
      return [ox + (f.adjW || f.diagNW ? 6 : 0), ox + TILE_SIZE - (f.adjE || f.diagNE ? 6 : 0)];
    });
    // Middle 20px sub-band [oy + 6, oy + 26)
    appendSubBand(oy + 6, TILE_SIZE - 12, (tx) => {
      const f = rowFlags[tx]!;
      if (!f.isVoid) return null;
      const ox = tx * TILE_SIZE;
      return [ox + (f.adjW ? 6 : 0), ox + TILE_SIZE - (f.adjE ? 6 : 0)];
    });
    // Bottom 6px sub-band [oy + 26, oy + 32)
    appendSubBand(oy + TILE_SIZE - 6, 6, (tx) => {
      const f = rowFlags[tx]!;
      if (!f.isVoid || f.adjS) return null;
      const ox = tx * TILE_SIZE;
      return [ox + (f.adjW || f.diagSW ? 6 : 0), ox + TILE_SIZE - (f.adjE || f.diagSE ? 6 : 0)];
    });
  }

  // Coalesce vertically adjacent spans that share identical (x, width)
  const merged: ExteriorVoidRectSpan[] = [];
  for (let i = 0; i < bandSpans.length; i++) {
    const cur = bandSpans[i]!;
    let coalesced = false;
    for (let j = merged.length - 1; j >= 0; j--) {
      const prev = merged[j]!;
      if (prev.y + prev.height < cur.y) {
        // Earlier spans that ended above cur.y can no longer touch cur.y
        continue;
      }
      if (prev.x === cur.x && prev.width === cur.width && prev.y + prev.height === cur.y) {
        prev.height += cur.height;
        coalesced = true;
        break;
      }
    }
    if (!coalesced) {
      merged.push(cur);
    }
  }

  return merged;
}

function rectsIntersectWorld(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  clip: WorldClipRect,
): boolean {
  return (
    ax < clip.x + clip.width &&
    ax + aw > clip.x &&
    ay < clip.y + clip.height &&
    ay + ah > clip.y
  );
}

/**
 * Renders the room's static architectural overlays (pillar South-East cast shadows,
 * flat floor decals on dry tiles, and wall/pillar architectural motifs)
 * onto the arena ground composite canvas.
 */
export function renderBiomeArchitectureToComposite(
  ctx: CanvasRenderingContext2D,
  map: ArenaMap,
  plan: RoomArchitecturePlan,
  cellPx: number,
  clipRectWorld?: WorldClipRect,
): void {
  const scale = cellPx / TILE_SIZE;
  const env = ENV_PALETTE[plan.biome] ?? ENV_PALETTE[1];

  ctx.save();
  if (clipRectWorld) {
    ctx.beginPath();
    ctx.rect(
      clipRectWorld.x * scale,
      clipRectWorld.y * scale,
      clipRectWorld.width * scale,
      clipRectWorld.height * scale,
    );
    ctx.clip();
  }
  ctx.scale(scale, scale);

  // 1. Long South-East (-135 deg key light -> +45 deg SE) cast shadows from 2x2 interior pillars (40-64u)
  for (const shadow of plan.pillarShadows) {
    const px = shadow.pillarTx * TILE_SIZE;
    const py = shadow.pillarTy * TILE_SIZE;
    const pw = shadow.widthTiles * TILE_SIZE;
    const ph = shadow.heightTiles * TILE_SIZE;
    const len = shadow.shadowLengthU;
    const shadowReach = Math.max(len, TILE_SIZE * 2);
    if (
      clipRectWorld &&
      !rectsIntersectWorld(px, py, pw + shadowReach, ph + shadowReach, clipRectWorld)
    ) {
      continue;
    }

    ctx.save();
    ctx.beginPath();
    const maxTy = Math.min(map.rows - 2, shadow.pillarTy + shadow.heightTiles + 1);
    const maxTx = Math.min(map.cols - 2, shadow.pillarTx + shadow.widthTiles + 1);
    for (let ty = shadow.pillarTy; ty <= maxTy; ty++) {
      for (let tx = shadow.pillarTx; tx <= maxTx; tx++) {
        if (
          !map.isSolidTile(tx, ty) &&
          map.getSurface(tx, ty) === 'none' &&
          computeTileDistToWall(map, tx, ty) <= 2 &&
          !isProtectedMetricSampleTile(tx, ty)
        ) {
          ctx.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    ctx.clip();

    const grad = ctx.createLinearGradient(
      px + pw * 0.5,
      py + ph * 0.5,
      px + pw + len * 0.72,
      py + ph + len * 0.72,
    );
    grad.addColorStop(0, `rgba(11, 9, 14, ${shadow.alpha})`);
    grad.addColorStop(1, 'rgba(11, 9, 14, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px + pw, py + 4);
    ctx.lineTo(px + pw + len * 0.72, py + 4 + len * 0.72);
    ctx.lineTo(px + 4 + len * 0.72, py + ph + len * 0.72);
    ctx.lineTo(px + 4, py + ph);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 2. Flat floor decals (only rendered for getVisibleFloorDecals(plan, map))
  const visibleDecals = getVisibleFloorDecals(plan, map);
  for (const decal of visibleDecals) {
    const ox = decal.tx * TILE_SIZE;
    const oy = decal.ty * TILE_SIZE;
    if (clipRectWorld) {
      if (decal.kind === 'sunken_astrolabe') {
        const acx = map.width * 0.5;
        const acy = map.height * 0.5;
        if (!rectsIntersectWorld(acx - 180, acy - 180, 360, 360, clipRectWorld)) {
          continue;
        }
      } else if (
        !rectsIntersectWorld(ox - 4, oy - 4, TILE_SIZE + 8, TILE_SIZE + 8, clipRectWorld)
      ) {
        continue;
      }
    }

    if (decal.kind === 'root_decal_tip') {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.strokeStyle = '#34443D';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (decal.dir === 'N') {
        ctx.moveTo(14, 0);
        ctx.bezierCurveTo(12, 5, 19, 10, 16, 15);
      } else if (decal.dir === 'W') {
        ctx.moveTo(0, 15);
        ctx.bezierCurveTo(5, 13, 10, 19, 15, 16);
      } else {
        ctx.moveTo(TILE_SIZE, 16);
        ctx.bezierCurveTo(TILE_SIZE - 5, 14, TILE_SIZE - 10, 19, TILE_SIZE - 15, 16);
      }
      ctx.stroke();
      ctx.restore();
    } else if (decal.kind === 'stepping_stone') {
      ctx.save();
      ctx.translate(ox + 16, oy + 16);
      const rot = ((decal.variant % 3) - 1) * 0.25;
      ctx.rotate(rot);
      ctx.fillStyle = '#33423B';
      ctx.beginPath();
      ctx.ellipse(-2, 1, 7.2, 4.6, 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#485A51';
      ctx.beginPath();
      ctx.ellipse(-2.5, 0.5, 6.0, 3.6, 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#43584E';
      ctx.beginPath();
      ctx.ellipse(5.5, -2.5, 3.8, 2.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (decal.kind === 'sunken_astrolabe') {
      const centerTx = Math.floor(map.cols / 2);
      const centerTy = Math.floor(map.rows / 2);
      const acx = map.width * 0.5;
      const acy = map.height * 0.5;
      let clearCenterCount = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const tx = centerTx + dx;
          const ty = centerTy + dy;
          if (
            tx > 0 &&
            ty > 0 &&
            tx < map.cols - 1 &&
            ty < map.rows - 1 &&
            !map.isSolidTile(tx, ty) &&
            map.getSurface(tx, ty) === 'none' &&
            computeTileDistToWall(map, tx, ty) > 2
          ) {
            clearCenterCount += 1;
          }
        }
      }
      let minObstacleDistPx = Math.min(acx, acy);
      for (let ty = 1; ty < map.rows - 1; ty++) {
        for (let tx = 1; tx < map.cols - 1; tx++) {
          if (map.isSolidTile(tx, ty) || map.getSurface(tx, ty) !== 'none') {
            const tileCx = (tx + 0.5) * TILE_SIZE;
            const tileCy = (ty + 0.5) * TILE_SIZE;
            const distPx = Math.max(0, Math.hypot(tileCx - acx, tileCy - acy) - TILE_SIZE * 0.5);
            if (distPx < minObstacleDistPx) {
              minObstacleDistPx = distPx;
            }
          }
        }
      }
      if (clearCenterCount < 16 || minObstacleDistPx < 64) {
        continue;
      }

      ctx.save();
      ctx.beginPath();
      for (let ty = 3; ty < map.rows - 3; ty++) {
        for (let tx = 3; tx < map.cols - 3; tx++) {
          if (
            !map.isSolidTile(tx, ty) &&
            map.getSurface(tx, ty) === 'none' &&
            computeTileDistToWall(map, tx, ty) > 2 &&
            !isProtectedMetricSampleTile(tx, ty)
          ) {
            ctx.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }
      ctx.clip();

      const centerW = Math.max(128, (map.cols - 6) * TILE_SIZE);
      const centerH = Math.max(128, (map.rows - 6) * TILE_SIZE);
      const maxOuterR = Math.min(0.45 * Math.min(centerW, centerH), minObstacleDistPx - 8);
      const rScale = Math.min(1, maxOuterR / 165);
      const rings: readonly [number, number, number] = [
        70 * rScale,
        120 * rScale,
        165 * rScale,
      ];

      ctx.globalAlpha = 0.21;
      ctx.strokeStyle = env.seam;
      ctx.lineWidth = 1.5;
      for (const r of rings) {
        ctx.beginPath();
        ctx.arc(acx, acy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Off-center crescent inlay + 8 radial spokes + rune ticks at ring intersections
      ctx.beginPath();
      ctx.arc(acx - 14 * rScale, acy - 10 * rScale, 92 * rScale, 0, Math.PI * 2);
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4;
        ctx.moveTo(acx + Math.cos(ang) * 32 * rScale, acy + Math.sin(ang) * 32 * rScale);
        ctx.lineTo(acx + Math.cos(ang) * rings[2], acy + Math.sin(ang) * rings[2]);

        const rx = acx + Math.cos(ang) * rings[1];
        const ry = acy + Math.sin(ang) * rings[1];
        ctx.moveTo(rx - 3, ry);
        ctx.lineTo(rx, ry - 3);
        ctx.lineTo(rx + 3, ry);
        ctx.lineTo(rx, ry + 3);
        ctx.closePath();
      }
      ctx.stroke();
      ctx.restore();
    } else if (decal.kind === 'grated_heat_channel') {
      // 26u wide (24-28u) recessed basalt channel (#7F6559 bevel + #3B2D29 interior) covered by #241F2E iron grate
      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillStyle = '#7F6559';
      ctx.fillRect(3, 6, 26, 20);
      ctx.fillStyle = '#3B2D29';
      ctx.fillRect(5, 8, 22, 16);
      ctx.save();
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = '#F97316';
      ctx.fillRect(6, 10, 20, 12);
      ctx.restore();

      ctx.strokeStyle = '#241F2E';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(4.5, 7.5, 23, 17);
      ctx.beginPath();
      for (const gx of [8.5, 12.5, 16.5, 20.5, 24.5]) {
        ctx.moveTo(gx, 8);
        ctx.lineTo(gx, 24);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // 3. Solid 3D architectural decor on wall & pillar tiles
  for (const item of plan.solidDecors) {
    if (!map.isSolidTile(item.tx, item.ty)) continue;
    if (
      clipRectWorld &&
      !rectsIntersectWorld(
        item.tx * TILE_SIZE - TILE_SIZE,
        item.ty * TILE_SIZE - 8,
        TILE_SIZE * 3,
        TILE_SIZE * 2 + 8,
        clipRectWorld,
      )
    ) {
      continue;
    }
    drawSolidArchitectureDecor(ctx, item, env);
  }

  ctx.restore();
}

function drawSolidArchitectureDecor(
  ctx: CanvasRenderingContext2D,
  item: SolidArchitectureDecor,
  env: (typeof ENV_PALETTE)[1],
): void {
  const ox = item.tx * TILE_SIZE;
  const oy = item.ty * TILE_SIZE;

  ctx.save();
  ctx.translate(ox, oy);

  switch (item.kind) {
    case 'brazier_pedestal': {
      // Stepped stone pedestal on wall tile with 45-deg wrought-iron bracket arm
      ctx.fillStyle = env.wallFront;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 1.8;
      if (item.dir === 'W' || item.dir === 'E') {
        const isWest = item.dir === 'W';
        const px = isWest ? 6 : 10;
        ctx.fillRect(px, 4, 16, 14);
        ctx.strokeRect(px, 4, 16, 14);

        ctx.fillStyle = env.wallTop;
        ctx.fillRect(px + 2, 5, 12, 10);

        ctx.strokeStyle = env.rim;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(px + 2.5, 14);
        ctx.lineTo(px + 2.5, 5.5);
        ctx.lineTo(px + 13.5, 5.5);
        ctx.stroke();

        const armStartX = 16;
        const armEndX = isWest ? 26 : 6;
        const strutEndX = isWest ? 22 : 10;
        ctx.strokeStyle = PALETTE.SLATE_DARK;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(armStartX, 9);
        ctx.lineTo(armEndX, 16);
        ctx.moveTo(armStartX, 14);
        ctx.lineTo(strutEndX, 14);
        ctx.stroke();

        ctx.fillStyle = PALETTE.SOLAR_GOLD;
        ctx.beginPath();
        ctx.arc(armEndX, 16.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(5, 4, 22, 17);
        ctx.strokeRect(5, 4, 22, 17);

        ctx.fillStyle = env.wallTop;
        ctx.fillRect(7, 5, 18, 12);

        // Top-left (-135 deg) rim light on stepped pedestal cap
        ctx.strokeStyle = env.rim;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(7.5, 16);
        ctx.lineTo(7.5, 5.5);
        ctx.lineTo(24.5, 5.5);
        ctx.stroke();

        // 45-deg wrought-iron hanging bracket arm + diagonal strut
        ctx.strokeStyle = PALETTE.SLATE_DARK;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(12, 10);
        ctx.lineTo(22, 20);
        ctx.moveTo(12, 16);
        ctx.lineTo(18, 16);
        ctx.stroke();

        ctx.fillStyle = PALETTE.SOLAR_GOLD;
        ctx.beginPath();
        ctx.arc(22, 21, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'fluted_column': {
      // Circular fluted stone column drum centered on the 64x48 pillar Top Cap
      ctx.translate(16, 6);
      ctx.fillStyle = env.wallTop;
      ctx.fillRect(-8, 2, 48, 18);
      ctx.beginPath();
      ctx.arc(16, 14, 11.5, 0, Math.PI * 2);
      ctx.fillStyle = env.wallFront;
      ctx.fill();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(16, 13, 9.2, 0, Math.PI * 2);
      ctx.fillStyle = env.wallTop;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();

      // Top-left (-135 deg) crescent rim highlight
      ctx.beginPath();
      ctx.arc(16, 13, 7.6, Math.PI * 0.85, Math.PI * 1.65);
      ctx.strokeStyle = env.rim;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Radial flute notches around drum perimeter
      ctx.strokeStyle = env.seam;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const ang = (k * Math.PI) / 4;
        ctx.moveTo(16 + Math.cos(ang) * 6.2, 13 + Math.sin(ang) * 6.2);
        ctx.lineTo(16 + Math.cos(ang) * 9.0, 13 + Math.sin(ang) * 9.0);
      }
      ctx.stroke();
      break;
    }

    case 'fluted_pilaster': {
      // Half-column fluted pilaster attached to solid wall face
      ctx.fillStyle = env.wallFront;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 1.8;
      ctx.fillRect(8, 6, 16, 18);
      ctx.strokeRect(8, 6, 18 - 2, 18);

      ctx.fillStyle = env.wallTop;
      ctx.fillRect(9.5, 7, 13, 8);

      ctx.strokeStyle = env.rim;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(9.5, 14);
      ctx.lineTo(9.5, 7.5);
      ctx.lineTo(22, 7.5);
      ctx.stroke();

      // Vertical flute channels on pilaster face
      ctx.strokeStyle = env.seam;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (const fx of [12, 16, 20]) {
        ctx.moveTo(fx, 15);
        ctx.lineTo(fx, 23);
      }
      ctx.stroke();
      break;
    }

    case 'forge_anvil': {
      // Heavy blacksmith forge anvil centered on the 64x48 pillar Top Cap (from pillarTx + 1)
      ctx.translate(-16, 6);
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 2.0;

      // Pedestal base + brass clamp
      ctx.fillRect(9, 16, 14, 7);
      ctx.strokeRect(9, 16, 14, 7);
      ctx.fillStyle = PALETTE.BRASS_CORE;
      ctx.fillRect(11, 18, 10, 2.5);

      // Anvil face + tapered horn
      ctx.beginPath();
      ctx.moveTo(4, 12);
      ctx.lineTo(11, 9);
      ctx.lineTo(26, 9);
      ctx.lineTo(25, 15);
      ctx.lineTo(11, 15);
      ctx.closePath();
      ctx.fillStyle = PALETTE.SLATE_DARK;
      ctx.fill();
      ctx.stroke();

      // Top-left (-135 deg) specular steel rim highlight + hardy hole
      ctx.strokeStyle = PALETTE.STEEL_LIGHT;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(5.5, 12);
      ctx.lineTo(11.5, 10);
      ctx.lineTo(24.5, 10);
      ctx.stroke();

      ctx.fillStyle = PALETTE.INK_DARK;
      ctx.fillRect(20, 11, 2.5, 2.5);
      break;
    }

    case 'root_base': {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (item.dir === 'N') {
        ctx.moveTo(8, 5);
        ctx.bezierCurveTo(20, 8, 10, 13, 14, 17);
      } else if (item.dir === 'W') {
        ctx.moveTo(4, 7);
        ctx.bezierCurveTo(12, 15, 22, 9, 28, 13);
      } else {
        ctx.moveTo(28, 7);
        ctx.bezierCurveTo(20, 15, 10, 9, 4, 13);
      }
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 10.5;
      ctx.stroke();

      ctx.strokeStyle = PALETTE.LEATHER_DARK;
      ctx.lineWidth = 6.5;
      ctx.stroke();

      ctx.strokeStyle = PALETTE.LEATHER_MID;
      ctx.lineWidth = 3.8;
      ctx.stroke();

      ctx.fillStyle = PALETTE.GOBLIN_GREEN;
      ctx.beginPath();
      ctx.ellipse(14, 11, 3.8, 2.4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'mushroom_cluster': {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = PALETTE.LIME_GLOW;
      ctx.beginPath();
      ctx.arc(16, 15, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const caps: ReadonlyArray<readonly [number, number, number]> = [
        [13, 15, 3.4],
        [19, 13, 2.8],
        [17, 18, 2.2],
      ];
      for (const [cx, cy, cr] of caps) {
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.LIME_GLOW;
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx - cr * 0.28, cy - cr * 0.28, cr * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.MINT_LIGHT;
        ctx.fill();
      }
      break;
    }

    case 'cliff_vines': {
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(9, 19);
      ctx.quadraticCurveTo(12, 24, 10, 29);
      ctx.moveTo(21, 19);
      ctx.quadraticCurveTo(19, 23, 22, 27);
      ctx.stroke();

      ctx.strokeStyle = PALETTE.GOBLIN_GREEN;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      break;
    }

    case 'ice_alcove': {
      ctx.beginPath();
      ctx.moveTo(7, 29);
      ctx.lineTo(7, 17);
      ctx.arc(16, 17, 9, Math.PI, 0);
      ctx.lineTo(25, 29);
      ctx.closePath();
      ctx.fillStyle = env.shadow;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();

      ctx.fillStyle = PALETTE.CYAN_FROST;
      ctx.beginPath();
      ctx.moveTo(11, 14);
      ctx.lineTo(13, 25);
      ctx.lineTo(15, 14);
      ctx.moveTo(17, 13);
      ctx.lineTo(19.5, 27);
      ctx.lineTo(22, 13);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = env.rim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(12.2, 14.5);
      ctx.lineTo(13, 22);
      ctx.moveTo(18.2, 13.5);
      ctx.lineTo(19.2, 24);
      ctx.stroke();
      break;
    }

    case 'frost_crystal_cluster': {
      const spires: ReadonlyArray<readonly [number, number, number, number]> = [
        [11, 18, 8, 6],
        [17, 20, 18, 4],
        [21, 19, 25, 9],
      ];
      for (const [bx, by, tx, ty] of spires) {
        ctx.beginPath();
        ctx.moveTo(bx - 3, by);
        ctx.lineTo(tx, ty);
        ctx.lineTo(bx + 3, by);
        ctx.closePath();
        ctx.fillStyle = PALETTE.CYAN_FROST;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = PALETTE.INK_DARK;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(bx - 1.5, by - 1);
        ctx.lineTo(tx, ty + 1.5);
        ctx.strokeStyle = PALETTE.ICE_WHITE;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
      break;
    }

    case 'brass_gear_wall': {
      const teeth = item.toothCount ?? 10;
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 1.6;
      ctx.fillRect(3, 13, 26, 5);
      ctx.strokeRect(3, 13, 26, 5);

      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      for (let k = 0; k < teeth; k++) {
        const ang = (k * Math.PI * 2) / teeth + item.variant * 0.2;
        ctx.moveTo(16 + Math.cos(ang) * 4, 15 + Math.sin(ang) * 4);
        ctx.lineTo(16 + Math.cos(ang) * 9.5, 15 + Math.sin(ang) * 9.5);
      }
      ctx.stroke();

      ctx.strokeStyle = PALETTE.BRASS_CORE;
      ctx.lineWidth = 1.9;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(16, 15, 6.8, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.BRONZE_SHADE;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(16, 15, 3.0, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.COPPER_LIGHT;
      ctx.fill();
      break;
    }

    case 'steam_pipe_wall': {
      ctx.fillStyle = PALETTE.STEEL_DARK;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 1.6;
      ctx.fillRect(11, 3, 10, 16);
      ctx.strokeRect(11, 3, 10, 16);

      ctx.fillStyle = PALETTE.STEEL_LIGHT;
      ctx.fillRect(9, 5, 14, 3);
      ctx.fillRect(9, 14, 14, 3);

      ctx.beginPath();
      ctx.arc(16, 11, 4.0, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.BRASS_CORE;
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'wrought_iron_fence': {
      ctx.fillStyle = env.wallFront;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.lineWidth = 1.6;
      if (item.dir === 'W' || item.dir === 'E') {
        const isWest = item.dir === 'W';
        const railX = isWest ? 18 : 9;
        const baseX = isWest ? 20 : 12;
        const tipX = isWest ? 9 : 23;
        const hiBaseX = isWest ? 18 : 14;
        const hiTipX = isWest ? 11 : 21;
        ctx.fillRect(railX, 4, 5, 24);
        ctx.strokeRect(railX, 4, 5, 24);

        for (const sy of [8, 16, 24]) {
          ctx.beginPath();
          ctx.moveTo(baseX, sy - 2.2);
          ctx.lineTo(tipX, sy);
          ctx.lineTo(baseX, sy + 2.2);
          ctx.closePath();
          ctx.fillStyle = PALETTE.SLATE_DARK;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = PALETTE.INK_DARK;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(hiBaseX, sy - 0.8);
          ctx.lineTo(hiTipX, sy);
          ctx.strokeStyle = PALETTE.STEEL_LIGHT;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      } else {
        ctx.fillRect(4, 14, 24, 5);
        ctx.strokeRect(4, 14, 24, 5);

        for (const sx of [8, 16, 24]) {
          ctx.beginPath();
          ctx.moveTo(sx - 2.2, 16);
          ctx.lineTo(sx, 5);
          ctx.lineTo(sx + 2.2, 16);
          ctx.closePath();
          ctx.fillStyle = PALETTE.SLATE_DARK;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = PALETTE.INK_DARK;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(sx - 0.8, 14);
          ctx.lineTo(sx, 7);
          ctx.strokeStyle = PALETTE.STEEL_LIGHT;
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      }
      break;
    }
  }

  ctx.restore();
}

const BLEND_MODE_ADD = 1; // Phaser.BlendModes.ADD
const BIOME_VOID_MASK_TEX_KEY = '__biome_void_mask_tex__';

function fillDiamond(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  r: number,
): void {
  g.fillTriangle(cx - r, cy, cx, cy - r, cx + r, cy);
  g.fillTriangle(cx - r, cy, cx + r, cy, cx, cy + r);
}

function setDepthIfChanged<T extends { depth?: number; setDepth?: (d: number) => T }>(
  obj: T,
  depth: number,
): void {
  if (obj.depth !== depth) {
    obj.setDepth?.(depth);
  }
}

function setVisibleIfChanged<T extends { visible?: boolean; setVisible?: (v: boolean) => T }>(
  obj: T,
  visible: boolean,
): void {
  if (obj.visible !== visible) {
    obj.setVisible?.(visible);
  }
}

function syncGraphicsVisibility(
  g: Phaser.GameObjects.Graphics,
  fallbackHasContent: boolean,
): void {
  const cmdBuf = (g as unknown as { commandBuffer?: unknown[] }).commandBuffer;
  const visible = Array.isArray(cmdBuf) ? cmdBuf.length > 0 : fallbackHasContent;
  setVisibleIfChanged(g, visible);
}

/**
 * Live architectural effects layer (Spec 3.5 & Ruling 2):
 * - Biome 3: Slowly rotating 8-12 tooth brass wall gears (~18 deg/s on High/Medium, static on Low)
 *   and breathing additive lava glow (alpha <= 0.30) through visible grated_heat_channel iron bars.
 * - Common P4 & Braziers: 45-deg wrought-iron hanging bracket arm above each torch_brazier (depth 31, above player)
 *   + small rising embers (<= 3.5px, no dark outline, BlendModes.ADD) and floating warm dust motes (<= 3px) on High/Medium.
 */
export class BiomeArchitectureLiveLayer {
  private readonly scene: Phaser.Scene;
  private readonly gearGraphics: Phaser.GameObjects.Graphics;
  private readonly bracketGraphics: Phaser.GameObjects.Graphics;
  private readonly additiveGraphics: Phaser.GameObjects.Graphics;
  private readonly voidMaskGraphics: Phaser.GameObjects.Graphics;
  private voidMaskImage: Phaser.GameObjects.Image | null = null;
  private voidMaskTexW = 0;
  private voidMaskTexH = 0;
  private plan: RoomArchitecturePlan | null = null;
  private elapsedSec = 1.0;
  private lastBracketSig = '';
  private lastVoidMaskSig = '';
  private gearHadContent = false;
  private bracketHadContent = false;
  private lastHazardMapRevision = -1;
  private readonly scratchHazardIndices: number[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Depth 14: above arenaGroundSprite (depth 2), below entities (depth 22+)
    this.gearGraphics = scene.add.graphics().setDepth(14);
    // Depth 31: above player rig (depth 30), below lightmapRt (depth 34) per Spec 3.5 P4 hanging brazier bracket
    this.bracketGraphics = scene.add.graphics().setDepth(31);
    // Depth 35.5: above lightmapRt (depth 34) with BlendModes.ADD for embers, warm dust motes & heat channel breath
    this.additiveGraphics = scene.add.graphics().setDepth(35.5);
    this.additiveGraphics.setBlendMode(BLEND_MODE_ADD);
    // Depth 36.2: above lightmapRt (34), warmGlowPool (35), and additiveGraphics (35.5)
    // to mask out any light/glow bleed into #0B090E Exterior Void cells while preserving the 6px outer wall casing.
    this.voidMaskGraphics = scene.add.graphics().setDepth(36.2);
  }

  public setPlan(plan: RoomArchitecturePlan): void {
    this.plan = plan;
    this.lastBracketSig = '';
    this.lastVoidMaskSig = '';
    this.lastHazardMapRevision = -1;
  }

  public renderGroundPass(
    ctx: CanvasRenderingContext2D,
    map: ArenaMap,
    tileCompositeScale = 2,
    clipRectWorld?: WorldClipRect,
  ): void {
    if (this.plan) {
      renderBiomeArchitectureToComposite(
        ctx,
        map,
        this.plan,
        TILE_SIZE * tileCompositeScale,
        clipRectWorld,
      );
    }
  }

  public update(params: {
    dtSec: number;
    map: ArenaMap;
    props: readonly SimPropState[];
    lightingEnabled: boolean;
  }): void {
    const { dtSec, map, props, lightingEnabled } = params;
    const quality = graphicsSettings.getState().quality;
    const isLow = quality === 'low';

    if (getVisualQueryConfig().freeze) {
      this.elapsedSec = getFreezeVisualTimeSec(this.elapsedSec);
    } else if (!isLow) {
      this.elapsedSec += dtSec;
    }

    this.additiveGraphics.clear();

    const plan = this.plan;
    if (!plan) {
      if (this.gearHadContent) {
        this.gearGraphics.clear();
        this.gearHadContent = false;
      }
      if (this.lastBracketSig !== '') {
        this.bracketGraphics.clear();
        this.lastBracketSig = '';
        this.bracketHadContent = false;
      }
      if (this.lastVoidMaskSig !== '') {
        this.voidMaskGraphics.clear();
        this.lastVoidMaskSig = '';
      }
      setVisibleIfChanged(this.gearGraphics, false);
      setVisibleIfChanged(this.bracketGraphics, false);
      setVisibleIfChanged(this.additiveGraphics, false);
      setVisibleIfChanged(this.voidMaskGraphics, false);
      if (this.voidMaskImage) {
        setVisibleIfChanged(this.voidMaskImage, false);
      }
      return;
    }

    const voidMaskSig = `${plan.seed}:${map.cols}x${map.rows}:${(map as { roomShape?: string }).roomShape ?? 'rectangle'}:${map.solidBoxes.length}`;
    if (voidMaskSig !== this.lastVoidMaskSig) {
      this.lastVoidMaskSig = voidMaskSig;
      const canBakeVoidCanvas =
        typeof this.scene.textures?.createCanvas === 'function' &&
        typeof this.scene.add?.image === 'function';

      let bakedVoidMask = false;
      if (canBakeVoidCanvas) {
        const mergedSpans = mergeExteriorVoidRowSpans(map);
        if (mergedSpans.length === 0) {
          this.voidMaskGraphics.clear();
          setVisibleIfChanged(this.voidMaskGraphics, false);
          if (this.voidMaskImage) {
            setVisibleIfChanged(this.voidMaskImage, false);
          }
          bakedVoidMask = true;
        } else {
          const needRecreate =
            !this.scene.textures.exists?.(BIOME_VOID_MASK_TEX_KEY) ||
            this.voidMaskTexW !== map.width ||
            this.voidMaskTexH !== map.height;
          if (needRecreate) {
            if (this.voidMaskImage) {
              this.voidMaskImage.destroy();
              this.voidMaskImage = null;
            }
            if (this.scene.textures.exists?.(BIOME_VOID_MASK_TEX_KEY)) {
              this.scene.textures.remove?.(BIOME_VOID_MASK_TEX_KEY);
            }
          }
          const voidTex = needRecreate
            ? this.scene.textures.createCanvas(BIOME_VOID_MASK_TEX_KEY, map.width, map.height)
            : (this.scene.textures.get?.(BIOME_VOID_MASK_TEX_KEY) as
                | Phaser.Textures.CanvasTexture
                | undefined);
          const voidCtx = voidTex?.getContext?.();
          if (voidTex && voidCtx) {
            this.voidMaskTexW = map.width;
            this.voidMaskTexH = map.height;
            voidCtx.clearRect(0, 0, map.width, map.height);
            voidCtx.fillStyle = PALETTE.INK_DEEP;
            for (let i = 0; i < mergedSpans.length; i++) {
              const span = mergedSpans[i]!;
              voidCtx.fillRect(span.x, span.y, span.width, span.height);
            }
            voidTex.refresh?.();
            if (!this.voidMaskImage) {
              this.voidMaskImage = this.scene.add.image(0, 0, BIOME_VOID_MASK_TEX_KEY);
            } else {
              this.voidMaskImage.setTexture?.(BIOME_VOID_MASK_TEX_KEY);
            }
            this.voidMaskImage.setOrigin?.(0, 0);
            this.voidMaskImage.setPosition?.(0, 0);
            setDepthIfChanged(this.voidMaskImage, 36.2);
            setVisibleIfChanged(this.voidMaskImage, true);
            this.voidMaskGraphics.clear();
            setVisibleIfChanged(this.voidMaskGraphics, false);
            bakedVoidMask = true;
          }
        }
      }

      if (!bakedVoidMask) {
        if (this.voidMaskImage) {
          setVisibleIfChanged(this.voidMaskImage, false);
        }
        const fallbackSpans = collectExteriorVoidRowSpans(map, true);
        this.voidMaskGraphics.clear();
        if (fallbackSpans.length > 0) {
          this.voidMaskGraphics.fillStyle(hexToNum(PALETTE.INK_DEEP), 1);
          for (let i = 0; i < fallbackSpans.length; i++) {
            const span = fallbackSpans[i]!;
            this.voidMaskGraphics.fillRect(span.x, span.y, span.width, span.height);
          }
        }
        setVisibleIfChanged(this.voidMaskGraphics, fallbackSpans.length > 0);
      }
    }

    if (this.lastHazardMapRevision !== map.mapRevision) {
      this.lastHazardMapRevision = map.mapRevision;
      this.scratchHazardIndices.length = 0;
      for (let i = 0; i < map.surfaces.length; i++) {
        const s = map.surfaces[i]!;
        if (
          s === 'lava' ||
          s === 'water' ||
          s === 'electrified_water' ||
          s === 'poison_swamp' ||
          s === 'burning_oil' ||
          s === 'burning_grass' ||
          s === 'conveyor'
        ) {
          this.scratchHazardIndices.push(i);
        }
      }
    }
    const activeHazardTiles = this.scratchHazardIndices.length;

    let gearHasDraws = false;
    if (plan.biome === 3 || (activeHazardTiles > 0 && !isLow)) {
      this.gearGraphics.clear();
      this.gearHadContent = true;
    } else if (this.gearHadContent) {
      this.gearGraphics.clear();
      this.gearHadContent = false;
    }

    // 2. Biome 3 Slowly Rotating 8-12 Tooth Brass Wall Gears (~18 deg/s on High/Medium, static on Low)
    if (plan.biome === 3) {
      const rotRad = isLow ? 0 : this.elapsedSec * ((18 * Math.PI) / 180);
      for (let i = 0; i < plan.solidDecors.length; i++) {
        const item = plan.solidDecors[i]!;
        if (item.kind !== 'brass_gear_wall' || !map.isSolidTile(item.tx, item.ty)) continue;

        gearHasDraws = true;
        const cx = item.tx * TILE_SIZE + 16;
        const cy = item.ty * TILE_SIZE + 15;
        const teeth = item.toothCount ?? 10;
        const dirSign = i % 2 === 0 ? 1 : -1;
        const baseAng = item.variant * 0.2 + rotRad * dirSign;

        this.gearGraphics.lineStyle(3.0, hexToNum(PALETTE.INK_DARK), 1);
        for (let k = 0; k < teeth; k++) {
          const ang = baseAng + (k * Math.PI * 2) / teeth;
          this.gearGraphics.lineBetween(
            cx + Math.cos(ang) * 4.2,
            cy + Math.sin(ang) * 4.2,
            cx + Math.cos(ang) * 9.5,
            cy + Math.sin(ang) * 9.5,
          );
        }
        this.gearGraphics.lineStyle(1.9, hexToNum(PALETTE.BRASS_CORE), 1);
        for (let k = 0; k < teeth; k++) {
          const ang = baseAng + (k * Math.PI * 2) / teeth;
          this.gearGraphics.lineBetween(
            cx + Math.cos(ang) * 4.5,
            cy + Math.sin(ang) * 4.5,
            cx + Math.cos(ang) * 9.0,
            cy + Math.sin(ang) * 9.0,
          );
        }
        this.gearGraphics.fillStyle(hexToNum(PALETTE.BRONZE_SHADE), 1);
        this.gearGraphics.lineStyle(1.6, hexToNum(PALETTE.INK_DARK), 1);
        this.gearGraphics.fillCircle(cx, cy, 6.6);
        this.gearGraphics.strokeCircle(cx, cy, 6.6);
        this.gearGraphics.fillStyle(hexToNum(PALETTE.COPPER_LIGHT), 1);
        fillDiamond(this.gearGraphics, cx, cy, 2.8);
      }
    }

    // 2b. Live deterministic surface animations (lava, ice, water, electrified_water, poison_swamp, burning_*, conveyor)
    if (activeHazardTiles > 0 && !isLow) {
      const cam = this.gearGraphics.scene?.cameras?.main;
      const minWx = cam ? cam.scrollX - 48 : -Infinity;
      const maxWx = cam ? cam.scrollX + cam.width + 48 : Infinity;
      const minWy = cam ? cam.scrollY - 48 : -Infinity;
      const maxWy = cam ? cam.scrollY + cam.height + 48 : Infinity;

      for (let idx = 0; idx < activeHazardTiles; idx++) {
        const i = this.scratchHazardIndices[idx]!;
        const tx = i % map.cols;
        const ty = Math.floor(i / map.cols);
        if (tx === 0 || ty === 0 || tx >= map.cols - 1 || ty >= map.rows - 1) continue;
        const wx = tx * TILE_SIZE + 16;
        const wy = ty * TILE_SIZE + 16;
        if (wx < minWx || wx > maxWx || wy < minWy || wy > maxWy) continue;
        const surf = map.surfaces[i]!;
        const h = (tx * 73 + ty * 151) & 15;
        const ox = ((h & 3) - 1.5) * 2.6;
        const oy = (((h >> 2) & 3) - 1.5) * 2.6;
        const phase = this.elapsedSec * 2.5 + tx * 0.7 + ty * 1.1;

        if (surf === 'lava') {
          const r = 1.6 + 0.9 * (0.5 + 0.5 * Math.sin(phase));
          this.gearGraphics.fillStyle(0xfacc15, 0.72);
          fillDiamond(
            this.gearGraphics,
            wx + ox + Math.sin(phase) * 2.5,
            wy + oy + Math.cos(phase) * 2.5,
            r,
          );
          gearHasDraws = true;
        } else if (surf === 'water') {
          const ripR = 2.4 + ((this.elapsedSec * 3.2 + tx * 1.3 + ty * 0.9) % 3.8);
          this.gearGraphics.lineStyle(1.0, 0x7dd3fc, 0.42);
          this.gearGraphics.strokeCircle(wx + ox, wy + oy, ripR);
          gearHasDraws = true;
        } else if (surf === 'electrified_water') {
          const jx = Math.sin(phase * 3) * 4.5;
          this.gearGraphics.lineStyle(1.3, 0x22d3ee, 0.78);
          this.gearGraphics.lineBetween(wx + ox - 5, wy + oy - 3, wx + ox + jx, wy + oy + 3);
          gearHasDraws = true;
        } else if (surf === 'poison_swamp' && ((tx + ty) & 1) === 0) {
          const bubR = 1.4 + 0.9 * (0.5 + 0.5 * Math.cos(phase));
          this.gearGraphics.fillStyle(0x84cc16, 0.62);
          fillDiamond(
            this.gearGraphics,
            wx + ox + Math.cos(phase) * 2.2,
            wy + oy - Math.sin(phase) * 2.2,
            bubR,
          );
          gearHasDraws = true;
        } else if (surf === 'burning_oil' || surf === 'burning_grass') {
          const flameH = 4.2 + Math.sin(phase * 2.2) * 2.2;
          const fx = wx + ox;
          const fy = wy + oy + 2;
          this.gearGraphics.fillStyle(0xfacc15, 0.78);
          this.gearGraphics.fillTriangle(fx - 2.8, fy + 3, fx, fy - flameH, fx + 2.8, fy + 3);
          gearHasDraws = true;
        } else if (surf === 'conveyor') {
          const hasW = map.getSurface(tx - 1, ty) === 'conveyor';
          const hasE = map.getSurface(tx + 1, ty) === 'conveyor';
          const x0 = tx * TILE_SIZE + (hasW ? 0 : 3);
          const x1 = tx * TILE_SIZE + (hasE ? 32 : 29);
          // Cover static baked chevrons with continuous dark slate belt tread before drawing live scrolling chevrons
          this.gearGraphics.fillStyle(0x1e222b, 1);
          this.gearGraphics.fillRect(x0, ty * TILE_SIZE + 5, x1 - x0, 22);

          const dir =
            map.roomArchetype === 'CROSSFIRE_CONVEYORS' && ty >= Math.floor(map.rows / 2)
              ? -map.conveyorDirection
              : map.conveyorDirection;
          const baseScroll =
            (((this.elapsedSec * CONVEYOR_BELT_SPEED * dir) % 16) + 16) % 16;
          this.gearGraphics.lineStyle(1.8, 0xf59e42, 0.88);
          for (const baseOffset of [-8, 8]) {
            const cx = wx + baseOffset + baseScroll - 8;
            if (cx < x0 + 4 || cx > x1 - 4) continue;
            this.gearGraphics.lineBetween(cx - 3 * dir, wy - 5.5, cx + 2.5 * dir, wy);
            this.gearGraphics.lineBetween(cx + 2.5 * dir, wy, cx - 3 * dir, wy + 5.5);
          }
          gearHasDraws = true;
        }
      }
    }

    // 3. P4 45-deg Wrought-Iron Hanging Brazier Brackets (depth 31, above player) & Brazier Embers/Warm Dust Motes
    const orangeNum = hexToNum(PALETTE.FLAME_ORANGE);
    const goldNum = hexToNum(PALETTE.SOLAR_GOLD);
    const ironDarkNum = hexToNum(PALETTE.SLATE_DARK);
    const ironLightNum = hexToNum(PALETTE.STEEL_LIGHT);
    const inkNum = hexToNum(PALETTE.INK_DARK);

    let brazierCount = 0;
    let brazierHash = 0;
    for (let i = 0; i < props.length; i++) {
      const pr = props[i]!;
      if (pr.hp > 0 && pr.kind === 'torch_brazier') {
        brazierCount += 1;
        brazierHash = (brazierHash * 31 + ((pr.x | 0) ^ ((pr.y | 0) << 10))) | 0;
      }
    }
    const bracketSig = `${brazierCount}:${brazierHash}:${map.solidBoxes.length}`;
    if (bracketSig !== this.lastBracketSig) {
      this.lastBracketSig = bracketSig;
      this.bracketGraphics.clear();
      this.bracketHadContent = false;
      for (let i = 0; i < props.length; i++) {
        const pr = props[i]!;
        if (pr.hp <= 0 || pr.kind !== 'torch_brazier') continue;
        const bx = pr.x;
        const by = pr.y;
        const btx = Math.floor(bx / TILE_SIZE);
        const bty = Math.floor(by / TILE_SIZE);
        if (bty <= 0 || !map.isSolidTile(btx, bty - 1)) continue;
        this.bracketGraphics.lineStyle(3.2, inkNum, 0.92);
        this.bracketGraphics.lineBetween(bx + 12, by - 18, bx + 1, by - 7);
        this.bracketGraphics.lineStyle(1.8, ironDarkNum, 1);
        this.bracketGraphics.lineBetween(bx + 12, by - 18, bx + 1, by - 7);
        this.bracketGraphics.lineStyle(1.0, ironLightNum, 0.85);
        this.bracketGraphics.lineBetween(bx + 11, by - 18, bx + 1, by - 8);
        this.bracketHadContent = true;
      }
    }

    let additiveHasDraws = false;
    if (!isLow && lightingEnabled) {
      for (let i = 0; i < props.length; i++) {
        const pr = props[i]!;
        if (pr.hp <= 0 || pr.kind !== 'torch_brazier') continue;
        const bx = pr.x;
        const by = pr.y;

        // Subtle inner flame-core highlight strictly inside the brazier bowl (alphas 0.025 / 0.04)
        this.additiveGraphics.fillStyle(orangeNum, 0.025);
        this.additiveGraphics.fillCircle(bx, by - 8, 5.5);
        this.additiveGraphics.fillStyle(goldNum, 0.04);
        this.additiveGraphics.fillCircle(bx, by - 8, 3.0);
        additiveHasDraws = true;

        // Rising Embers (<= 3.5px diameter -> r <= 1.65px, Earcut-free fillRect, BlendModes.ADD)
        for (let e = 0; e < 4; e++) {
          const cycle = (this.elapsedSec * (0.85 + e * 0.14) + i * 0.37 + e * 0.25) % 1;
          const emberX = bx + Math.sin(this.elapsedSec * 3.2 + i * 1.7 + e * 2.1) * 5.5;
          const emberY = by - 5 - cycle * 26;
          const emberR = 1.65 - cycle * 0.55; // diameter 2.2..3.3px <= 3.5px
          const emberAlpha = (1 - cycle) * 0.72;
          this.additiveGraphics.fillStyle(e % 2 === 0 ? goldNum : orangeNum, emberAlpha);
          this.additiveGraphics.fillRect(
            emberX - emberR,
            emberY - emberR,
            emberR * 2,
            emberR * 2,
          );
        }

        for (let m = 0; m < 5; m++) {
          const ang = i * 1.3 + m * ((Math.PI * 2) / 5) + this.elapsedSec * 0.22;
          const dist = 28 + (m % 3) * 18 + Math.sin(this.elapsedSec * 1.4 + m) * 5;
          const moteX = bx + Math.cos(ang) * dist;
          const moteY = by + Math.sin(ang) * dist * 0.75;
          const mtx = Math.floor(moteX / TILE_SIZE);
          const mty = Math.floor(moteY / TILE_SIZE);
          if (
            mtx < 0 ||
            mty < 0 ||
            mtx >= map.cols ||
            mty >= map.rows ||
            map.isSolidTile(mtx, mty) ||
            isExteriorVoidWallTile(map, mtx, mty)
          ) {
            continue;
          }
          const moteR = 1.1 + (m % 2) * 0.25; // diameter 2.2..2.7px <= 3.0px
          const moteAlpha = 0.18 + 0.12 * Math.sin(this.elapsedSec * 2.1 + i + m); // <= 0.30 <= 0.35
          this.additiveGraphics.fillStyle(goldNum, moteAlpha);
          this.additiveGraphics.fillRect(moteX - moteR, moteY - moteR, moteR * 2, moteR * 2);
        }
      }

      // 4. Biome 3 Breathing Additive Lava Glow through Grated Heat Channel slots (High/Medium only, alpha <= 0.30)
      if (plan.biome === 3) {
        const visibleDecals = getVisibleFloorDecals(plan, map);
        for (let i = 0; i < visibleDecals.length; i++) {
          const decal = visibleDecals[i]!;
          if (decal.kind !== 'grated_heat_channel') continue;
          const pulse =
            0.14 + 0.12 * (0.5 + 0.5 * Math.sin(this.elapsedSec * 2.4 + decal.variant));
          const glowAlpha = Math.min(decal.maxGlowAlpha ?? 0.26, pulse);
          const ox = decal.tx * TILE_SIZE;
          const oy = decal.ty * TILE_SIZE;
          this.additiveGraphics.fillStyle(orangeNum, glowAlpha);
          for (const sx of [6, 10, 14, 18, 22]) {
            this.additiveGraphics.fillRect(ox + sx, oy + 10, 2.0, 12);
          }
          additiveHasDraws = true;
        }
      }

      // 5. Additive Emissive Hazard Spark / Ember Glints above lightmapRt (depth 35.5, BlendModes.ADD)
      if (activeHazardTiles > 0) {
        const cam = this.additiveGraphics.scene?.cameras?.main;
        const minWx = cam ? cam.scrollX - 48 : -Infinity;
        const maxWx = cam ? cam.scrollX + cam.width + 48 : Infinity;
        const minWy = cam ? cam.scrollY - 48 : -Infinity;
        const maxWy = cam ? cam.scrollY + cam.height + 48 : Infinity;

        for (let idx = 0; idx < activeHazardTiles; idx++) {
          const i = this.scratchHazardIndices[idx]!;
          const tx = i % map.cols;
          const ty = Math.floor(i / map.cols);
          if (tx === 0 || ty === 0 || tx >= map.cols - 1 || ty >= map.rows - 1) continue;
          const wx = tx * TILE_SIZE + 16;
          const wy = ty * TILE_SIZE + 16;
          if (wx < minWx || wx > maxWx || wy < minWy || wy > maxWy) continue;
          const surf = map.surfaces[i]!;
          const h = (tx * 73 + ty * 151) & 15;
          const ox = ((h & 3) - 1.5) * 2.6;
          const oy = (((h >> 2) & 3) - 1.5) * 2.6;
          const pulse = 0.08 + 0.05 * (0.5 + 0.5 * Math.sin(this.elapsedSec * 2.8 + tx + ty));
          if (surf === 'lava' || surf === 'burning_oil' || surf === 'burning_grass') {
            this.additiveGraphics.fillStyle(0xf97316, pulse);
            fillDiamond(this.additiveGraphics, wx + ox, wy + oy, 2.6);
            additiveHasDraws = true;
          } else if (surf === 'electrified_water') {
            this.additiveGraphics.fillStyle(0x22d3ee, pulse);
            fillDiamond(this.additiveGraphics, wx + ox, wy + oy, 2.2);
            additiveHasDraws = true;
          } else if (surf === 'poison_swamp' && ((tx + ty) & 1) === 0) {
            this.additiveGraphics.fillStyle(0x84cc16, pulse * 0.85);
            fillDiamond(this.additiveGraphics, wx + ox, wy + oy, 2.2);
            additiveHasDraws = true;
          }
        }
      }
    }

    syncGraphicsVisibility(this.gearGraphics, gearHasDraws);
    syncGraphicsVisibility(this.bracketGraphics, this.bracketHadContent);
    syncGraphicsVisibility(this.additiveGraphics, additiveHasDraws);
  }

  public destroy(): void {
    this.gearGraphics.destroy();
    this.bracketGraphics.destroy();
    this.additiveGraphics.destroy();
    this.voidMaskGraphics.destroy();
    if (this.voidMaskImage) {
      this.voidMaskImage.destroy();
      this.voidMaskImage = null;
    }
    if (this.scene.textures?.exists?.(BIOME_VOID_MASK_TEX_KEY)) {
      this.scene.textures.remove?.(BIOME_VOID_MASK_TEX_KEY);
    }
  }
}
