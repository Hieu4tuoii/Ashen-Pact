import { PALETTE, type PaletteHex } from './palette.js';

export const STANDARD_OUTLINE_WIDTH = 2.5;
export const INNER_OUTLINE_WIDTH = 1.5;

export type ShapeMaterialKind = 'metal' | 'cloth' | 'crystal' | 'organic';

export interface OutlinedStyle {
  fill: PaletteHex | string;
  shade?: PaletteHex | string;
  highlight?: PaletteHex | string;
  outlineColor?: PaletteHex | string;
  outlineWidth?: number;
  shadeOffset?: { dx: number; dy: number };
  highlightOffset?: { dx: number; dy: number };
  material?: ShapeMaterialKind;
  rimLight?: boolean;
}

export interface ShapeMaterialProfile {
  material: ShapeMaterialKind;
  softGradientTopLeftAlpha: number;
  softGradientBottomRightAlpha: number;
  rimLightAngleRad: number;
  rimLightAlpha: number;
  rimLightColor: string;
  highlightAlpha: number;
  hasSecondaryGlint: boolean;
}

const METAL_FILL_SET = new Set<string>([
  PALETTE.STEEL_DARK, PALETTE.STEEL_LIGHT, PALETTE.SILVER_BRIGHT,
  PALETTE.BRASS_CORE, PALETTE.BRONZE_SHADE, PALETTE.COPPER_LIGHT,
]);

const CRYSTAL_FILL_SET = new Set<string>([
  PALETTE.CYAN_FROST, PALETTE.ICE_WHITE, PALETTE.ELECTRIC_VIOLET,
  PALETTE.SOLAR_GOLD, PALETTE.LIME_GLOW, PALETTE.MINT_LIGHT,
  PALETTE.VOLT_YELLOW, PALETTE.FLAME_ORANGE, PALETTE.MAGMA_RED,
]);

const ORGANIC_FILL_SET = new Set<string>([
  PALETTE.GOBLIN_GREEN, PALETTE.FOREST_SHADE, PALETTE.MOSS_DARK,
  PALETTE.TOXIC_PURPLE, PALETTE.SKIN_WARM, PALETTE.SKIN_SHADE,
]);

export function resolveShapeMaterialProfile(style: OutlinedStyle): ShapeMaterialProfile {
  let material: ShapeMaterialKind = 'cloth';
  if (style.material) material = style.material;
  else if (METAL_FILL_SET.has(style.fill)) material = 'metal';
  else if (CRYSTAL_FILL_SET.has(style.fill)) material = 'crystal';
  else if (ORGANIC_FILL_SET.has(style.fill)) material = 'organic';

  const highlightAlpha = material === 'crystal' ? 0.92 : material === 'metal' ? 0.88 : 0.52;
  const hasSecondaryGlint = material === 'metal' || material === 'crystal';
  const rimLightAlpha = material === 'crystal' ? 0.62 : material === 'metal' ? 0.58 : 0.52;
  const rimLightColor =
    style.highlight ??
    (material === 'crystal'
      ? PALETTE.ICE_WHITE
      : material === 'metal'
        ? PALETTE.SILVER_BRIGHT
        : PALETTE.BONE_WHITE);

  return {
    material,
    softGradientTopLeftAlpha: 0.14,
    softGradientBottomRightAlpha: 0.28,
    rimLightAngleRad: -Math.PI * 0.75,
    rimLightAlpha,
    rimLightColor,
    highlightAlpha,
    hasSecondaryGlint,
  };
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
 * Core procedural rendering pipeline (Cutout 2.0 Shading):
 * 1. Base flat fill from PALETTE
 * 2. Clipped Layer 1 Soft Directional Gradient (-135 deg top-left -> +45 deg bottom-right)
 * 3. Clipped Layer 2 Cel-Shade crescent on bottom-right
 * 4. Clipped Material-Specific Highlight (metal specular glint, crystal core, cloth/organic soft matte)
 * 5. Clipped Top-Left (-135 deg) Rim-Light Arc inside the silhouette border
 * 6. Crisp outer dark outline (default 2.5 world units, 3.5 for bosses, INK_DARK #141019)
 */
export function outlined(
  ctx: CanvasRenderingContext2D,
  style: OutlinedStyle,
  tracePath: (c: CanvasRenderingContext2D) => void,
  boundsHint?: { cx: number; cy: number; rx: number; ry: number },
): void {
  const outlineColor = style.outlineColor ?? PALETTE.INK_DARK;
  const outlineWidth = style.outlineWidth ?? STANDARD_OUTLINE_WIDTH;
  const profile = resolveShapeMaterialProfile(style);

  ctx.save();

  // 1. Base flat fill
  tracePath(ctx);
  ctx.fillStyle = style.fill;
  ctx.fill();

  // 2. Clipped 2-Layer Shading, Material Highlight & -135 deg Top-Left Rim-Light
  ctx.save();
  tracePath(ctx);
  ctx.clip();

  const cx = boundsHint?.cx ?? 0;
  const cy = boundsHint?.cy ?? 0;
  const rx = Math.max(4, boundsHint?.rx ?? 14);
  const ry = Math.max(4, boundsHint?.ry ?? 14);

  // Layer 1: Soft directional gradient (-135 deg top-left to +45 deg bottom-right)
  if (outlineWidth > 0 || style.shade || style.highlight) {
    const grad = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
    grad.addColorStop(0, `rgba(255, 252, 242, ${profile.softGradientTopLeftAlpha})`);
    grad.addColorStop(0.48, 'rgba(255, 252, 242, 0)');
    grad.addColorStop(1, `rgba(20, 16, 25, ${profile.softGradientBottomRightAlpha})`);
    tracePath(ctx);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Layer 2: Cel-Shade crescent on bottom-right
  if (style.shade) {
    const sdx = style.shadeOffset?.dx ?? rx * 0.36;
    const sdy = style.shadeOffset?.dy ?? ry * 0.38;
    ctx.beginPath();
    ctx.ellipse(cx + sdx, cy + sdy, rx * 1.08, ry * 1.05, -0.25, 0, Math.PI * 2);
    ctx.fillStyle = style.shade;
    ctx.fill();
  }

  // Layer 3: Material-specific highlight
  if (style.highlight) {
    const hdx = style.highlightOffset?.dx ?? -rx * 0.34;
    const hdy = style.highlightOffset?.dy ?? -ry * 0.36;
    ctx.save();
    ctx.globalAlpha = profile.highlightAlpha;
    ctx.fillStyle = style.highlight;

    if (profile.material === 'metal') {
      ctx.beginPath();
      ctx.ellipse(cx + hdx, cy + hdy, rx * 0.54, ry * 0.22, -0.68, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(
        cx + hdx + rx * 0.26,
        cy + hdy - ry * 0.12,
        Math.max(1.1, Math.min(rx, ry) * 0.14),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else if (profile.material === 'crystal') {
      ctx.beginPath();
      ctx.ellipse(cx + hdx * 0.9, cy + hdy * 0.9, rx * 0.5, ry * 0.38, -0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = PALETTE.BONE_WHITE;
      ctx.beginPath();
      ctx.ellipse(cx + hdx * 0.78, cy + hdy * 0.78, rx * 0.22, ry * 0.16, -0.55, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(cx + hdx, cy + hdy, rx * 0.52, ry * 0.38, -0.52, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Layer 4: Top-Left (-135 deg) Rim-Light Arc along inner silhouette edge
  if (outlineWidth >= STANDARD_OUTLINE_WIDTH && style.rimLight !== false) {
    ctx.save();
    ctx.translate(1.3, 1.3);
    tracePath(ctx);
    ctx.lineWidth = outlineWidth + 1.6;
    ctx.strokeStyle = profile.rimLightColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = profile.rimLightAlpha;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

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
export function renderShapeCommand(ctx: CanvasRenderingContext2D, cmd: VectorShapeCommand): void {
  switch (cmd.kind) {
    case 'roundedRect': {
      outlined(ctx, cmd.style, (c) => traceRoundedRect(c, cmd.x, cmd.y, cmd.w, cmd.h, cmd.r), {
        cx: cmd.x + cmd.w / 2,
        cy: cmd.y + cmd.h / 2,
        rx: cmd.w / 2,
        ry: cmd.h / 2,
      });
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
      outlined(ctx, cmd.style, (c) => tracePolygon(c, cmd.points, true), {
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        rx: (maxX - minX) / 2,
        ry: (maxY - minY) / 2,
      });
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
