import { PALETTE, type PaletteHex } from './palette.js';

export const STANDARD_OUTLINE_WIDTH = 2.5;
export const INNER_OUTLINE_WIDTH = 1.5;

export interface OutlinedStyle {
  fill: PaletteHex;
  shade?: PaletteHex;
  highlight?: PaletteHex;
  outlineColor?: PaletteHex;
  outlineWidth?: number;
  shadeOffset?: { dx: number; dy: number };
  highlightOffset?: { dx: number; dy: number };
}

export type VectorShapeCommand =
  | {
      kind: 'roundedRect';
      x: number;
      y: number;
      w: number;
      h: number;
      r: number;
      style: OutlinedStyle;
    }
  | {
      kind: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      rotation?: number;
      style: OutlinedStyle;
    }
  | {
      kind: 'circle';
      cx: number;
      cy: number;
      r: number;
      style: OutlinedStyle;
    }
  | {
      kind: 'polygon';
      points: readonly { x: number; y: number }[];
      style: OutlinedStyle;
    }
  | {
      kind: 'bezier';
      start: { x: number; y: number };
      segments: readonly {
        cp1x: number;
        cp1y: number;
        cp2x: number;
        cp2y: number;
        x: number;
        y: number;
      }[];
      close?: boolean;
      style: OutlinedStyle;
    }
  | {
      kind: 'detailStroke';
      points: readonly { x: number; y: number }[];
      color?: PaletteHex;
      width?: number;
      close?: boolean;
    };

export function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function tracePolygon(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  close = true,
): void {
  if (points.length === 0) return;
  const first = points[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    if (pt) ctx.lineTo(pt.x, pt.y);
  }
  if (close) ctx.closePath();
}

/**
 * Core procedural rendering pipeline required by ART_GUIDE.md:
 * 1. Base flat fill from PALETTE
 * 2. Clipped Cel-Shading on bottom-right (light source fixed at top-left -135 deg)
 * 3. Clipped Rim-Light / Highlight on top-left
 * 4. Crisp outer dark outline (default 2.5 world units, INK_DARK #141019)
 */
export function outlined(
  ctx: CanvasRenderingContext2D,
  style: OutlinedStyle,
  tracePath: (c: CanvasRenderingContext2D) => void,
  boundsHint?: { cx: number; cy: number; rx: number; ry: number },
): void {
  const outlineColor = style.outlineColor ?? PALETTE.INK_DARK;
  const outlineWidth = style.outlineWidth ?? STANDARD_OUTLINE_WIDTH;

  ctx.save();

  // 1. Base flat fill
  tracePath(ctx);
  ctx.fillStyle = style.fill;
  ctx.fill();

  // 2. Clipped Cel-Shading & Rim-Light
  if (style.shade || style.highlight) {
    ctx.save();
    tracePath(ctx);
    ctx.clip();

    const cx = boundsHint?.cx ?? 0;
    const cy = boundsHint?.cy ?? 0;
    const rx = Math.max(4, boundsHint?.rx ?? 14);
    const ry = Math.max(4, boundsHint?.ry ?? 14);

    if (style.shade) {
      const sdx = style.shadeOffset?.dx ?? rx * 0.36;
      const sdy = style.shadeOffset?.dy ?? ry * 0.38;
      ctx.beginPath();
      ctx.ellipse(cx + sdx, cy + sdy, rx * 1.08, ry * 1.05, -0.25, 0, Math.PI * 2);
      ctx.fillStyle = style.shade;
      ctx.fill();
    }

    if (style.highlight) {
      const hdx = style.highlightOffset?.dx ?? -rx * 0.34;
      const hdy = style.highlightOffset?.dy ?? -ry * 0.36;
      ctx.beginPath();
      ctx.ellipse(cx + hdx, cy + hdy, rx * 0.48, ry * 0.35, -0.55, 0, Math.PI * 2);
      ctx.fillStyle = style.highlight;
      ctx.fill();
    }

    ctx.restore();
  }

  // 3. Outer crisp vector outline
  if (outlineWidth > 0) {
    tracePath(ctx);
    ctx.lineWidth = outlineWidth;
    ctx.strokeStyle = outlineColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Executes a declarative VectorShapeCommand through the unified outlined() pipeline.
 */
export function renderShapeCommand(
  ctx: CanvasRenderingContext2D,
  cmd: VectorShapeCommand,
): void {
  switch (cmd.kind) {
    case 'roundedRect': {
      outlined(
        ctx,
        cmd.style,
        (c) => traceRoundedRect(c, cmd.x, cmd.y, cmd.w, cmd.h, cmd.r),
        {
          cx: cmd.x + cmd.w / 2,
          cy: cmd.y + cmd.h / 2,
          rx: cmd.w / 2,
          ry: cmd.h / 2,
        },
      );
      break;
    }
    case 'ellipse': {
      outlined(
        ctx,
        cmd.style,
        (c) => {
          c.beginPath();
          c.ellipse(cmd.cx, cmd.cy, cmd.rx, cmd.ry, cmd.rotation ?? 0, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: cmd.cx, cy: cmd.cy, rx: cmd.rx, ry: cmd.ry },
      );
      break;
    }
    case 'circle': {
      outlined(
        ctx,
        cmd.style,
        (c) => {
          c.beginPath();
          c.arc(cmd.cx, cmd.cy, cmd.r, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: cmd.cx, cy: cmd.cy, rx: cmd.r, ry: cmd.r },
      );
      break;
    }
    case 'polygon': {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of cmd.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      outlined(
        ctx,
        cmd.style,
        (c) => tracePolygon(c, cmd.points, true),
        {
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2,
          rx: (maxX - minX) / 2,
          ry: (maxY - minY) / 2,
        },
      );
      break;
    }
    case 'bezier': {
      outlined(
        ctx,
        cmd.style,
        (c) => {
          c.beginPath();
          c.moveTo(cmd.start.x, cmd.start.y);
          for (const seg of cmd.segments) {
            c.bezierCurveTo(seg.cp1x, seg.cp1y, seg.cp2x, seg.cp2y, seg.x, seg.y);
          }
          if (cmd.close !== false) c.closePath();
        },
        { cx: 0, cy: 0, rx: 14, ry: 14 },
      );
      break;
    }
    case 'detailStroke': {
      ctx.save();
      tracePolygon(ctx, cmd.points, cmd.close ?? false);
      ctx.lineWidth = cmd.width ?? INNER_OUTLINE_WIDTH;
      ctx.strokeStyle = cmd.color ?? PALETTE.INK_DARK;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
      break;
    }
  }
}
