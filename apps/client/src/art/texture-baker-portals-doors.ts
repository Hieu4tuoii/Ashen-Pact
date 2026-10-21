import type Phaser from 'phaser';
import { ENV_PALETTE, PALETTE } from './palette.js';
import { outlined, tracePolygon, traceRoundedRect } from './primitives.js';
import { bakeCustomCanvas } from './texture-baker-canvas.js';

function traceOctagon(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawHexGridPattern(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  cellSize: number,
): void {
  const rowH = cellSize * 0.866;
  ctx.beginPath();
  let rowIdx = 0;
  for (let y = -halfH - cellSize; y <= halfH + cellSize; y += rowH) {
    const xOffset = rowIdx % 2 === 0 ? 0 : cellSize * 0.5;
    for (let x = -halfW - cellSize; x <= halfW + cellSize; x += cellSize) {
      const cx = x + xOffset;
      const cy = y;
      const r = cellSize * 0.48;
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI) / 3 + Math.PI / 6;
        const px = cx + Math.cos(ang) * r;
        const py = cy + Math.sin(ang) * r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    rowIdx++;
  }
  ctx.stroke();
}

export function bakePortalsAndDoors(scene: Phaser.Scene, scale: number): void {
  // 1. Portal Pedestal Base ('portal_pedestal_base', 76x76)
  // Stepped octagonal dark ruin stone dais with -135 deg top-left rim light, SE shadow, and 8 carved rune sockets
  bakeCustomCanvas(scene, 'portal_pedestal_base', 76, 76, scale, (ctx) => {
    // South-East (-135 deg light source -> +45 deg cast shadow) ambient occlusion shadow
    ctx.save();
    ctx.translate(2.5, 3.2);
    traceOctagon(ctx, 33.5);
    ctx.fillStyle = 'rgba(11, 9, 14, 0.42)';
    ctx.fill();
    ctx.restore();

    // Outer stepped stone plinth (#1E2433 / #2D3547) with INK_DARK 2.5u outline
    outlined(
      ctx,
      {
        fill: '#2D3547',
        shade: '#1E2433',
        highlight: '#64708B',
        outlineWidth: 2.5,
      },
      (c) => traceOctagon(c, 32),
      { cx: 0, cy: 0, rx: 32, ry: 32 },
    );

    // Top-left (-135 deg) crisp stone bevel highlight along NW octagon edges
    ctx.beginPath();
    for (let i = 3; i <= 6; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      const x = Math.cos(a) * 29.8;
      const y = Math.sin(a) * 29.8;
      if (i === 3) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Radial masonry joint seams between the 8 stone slabs
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 21.5, Math.sin(a) * 21.5);
      ctx.lineTo(Math.cos(a) * 31.2, Math.sin(a) * 31.2);
      ctx.stroke();
    }

    // Inner raised ritual ring (#3B4559)
    outlined(
      ctx,
      {
        fill: '#3B4559',
        shade: '#1E2433',
        highlight: '#64708B',
        outlineWidth: 2.0,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 23.5, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 23.5, ry: 23.5 },
    );

    // Deep abyssal well recess inside the stone ring
    ctx.beginPath();
    ctx.arc(0, 0, 18.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0E121B';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();

    // 8 recessed rune sockets around the stone ring
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rx = Math.cos(a) * 26.8;
      const ry = Math.sin(a) * 26.8;
      ctx.beginPath();
      ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#141824';
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();
    }
  });

  // 2. Portal Pedestal Engraved Runes ('portal_pedestal_runes', 76x76)
  // Ivory-white base so setTint colors the runes purple, cyan, gold, or slate-blue
  bakeCustomCanvas(scene, 'portal_pedestal_runes', 76, 76, scale, (ctx) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Concentric ritual channel rings
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 22.2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, 29.0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 8 distinct arcane rune glyphs positioned in the 8 sockets
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(26.8, 0);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (i % 2 === 0) {
        // Diamond + inner vertical bar glyph
        ctx.moveTo(0, -2.6);
        ctx.lineTo(2.3, 0);
        ctx.lineTo(0, 2.6);
        ctx.lineTo(-2.3, 0);
        ctx.closePath();
        ctx.moveTo(-2.6, 0);
        ctx.lineTo(2.6, 0);
      } else {
        // Chevron + dot arcane glyph
        ctx.moveTo(-2.2, -2.2);
        ctx.lineTo(2.2, 0);
        ctx.lineTo(-2.2, 2.2);
        ctx.moveTo(0, -2.4);
        ctx.lineTo(0, 2.4);
      }
      ctx.stroke();
      ctx.restore();
    }
  });

  // 3. Portal Vortex Disc ('portal_vortex_disc', 64x64)
  // Used both as the quad texture for PortalVortexPipeline and as the outer rotating spiral on Low quality
  bakeCustomCanvas(scene, 'portal_vortex_disc', 64, 64, scale, (ctx) => {
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    grad.addColorStop(0.35, 'rgba(235, 225, 255, 0.90)');
    grad.addColorStop(0.75, 'rgba(195, 175, 245, 0.72)');
    grad.addColorStop(0.94, 'rgba(155, 130, 225, 0.28)');
    grad.addColorStop(1, 'rgba(120, 90, 200, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();

    // 4 logarithmic spiral arms for crisp Low-quality rotation
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 4; arm++) {
      const baseAngle = (arm * Math.PI) / 2;
      ctx.beginPath();
      for (let step = 0; step <= 28; step++) {
        const t = step / 28;
        const r = 3 + t * 22.5;
        const a = baseAngle + t * Math.PI * 1.45;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = arm % 2 === 0 ? 'rgba(255, 255, 255, 0.88)' : 'rgba(220, 245, 255, 0.65)';
      ctx.lineWidth = 2.8;
      ctx.stroke();
    }

    // Outer luminous vortex ring
    ctx.beginPath();
    ctx.arc(0, 0, 23.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  });

  // 4. Portal Vortex Core ('portal_vortex_core', 44x44)
  // Counter-rotating inner star/spiral core for Low quality & additive core highlight
  bakeCustomCanvas(scene, 'portal_vortex_core', 44, 44, scale, (ctx) => {
    const coreGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 18);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    coreGrad.addColorStop(0.45, 'rgba(235, 252, 255, 0.85)');
    coreGrad.addColorStop(0.85, 'rgba(200, 240, 255, 0.32)');
    coreGrad.addColorStop(1, 'rgba(180, 230, 255, 0.0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    // 6-point arcane star + counter-spiral arcs
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const r = i % 2 === 0 ? 14.5 : 5.8;
      const a = (i * Math.PI) / 6;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  });

  // 5. Portal Energy Ray ('portal_energy_ray', 10x26)
  // Vertical soft-edged energy ray/streak for rising portal particles
  bakeCustomCanvas(scene, 'portal_energy_ray', 10, 26, scale, (ctx) => {
    const rayGrad = ctx.createLinearGradient(0, -11, 0, 11);
    rayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    rayGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.92)');
    rayGrad.addColorStop(0.65, 'rgba(255, 255, 255, 0.88)');
    rayGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // 6. Biome Door Frames: Horizontal N/S ('door_frame_ns_0..3', 68x52) & Vertical E/W ('door_frame_ew_0..3', 52x68)
  for (const biome of [0, 1, 2, 3] as const) {
    const env = ENV_PALETTE[biome];

    // 6a. Horizontal North/South Archway Frame (68x52)
    bakeCustomCanvas(scene, `door_frame_ns_${biome}`, 68, 52, scale, (ctx) => {
      // Drop shadow cast to South-East (-135 deg light source)
      ctx.fillStyle = 'rgba(11, 9, 14, 0.36)';
      traceRoundedRect(ctx, -30, -18, 63, 40, 6);
      ctx.fill();

      // Dark threshold floor recess between the piers
      ctx.fillStyle = env.shadow;
      traceRoundedRect(ctx, -22, -14, 44, 28, 4);
      ctx.fill();

      // Archway lintel bridge connecting left & right piers across top
      outlined(
        ctx,
        {
          fill: env.wallFront,
          shade: env.shadow,
          highlight: env.wallTop,
          outlineWidth: 2.4,
        },
        (c) => traceRoundedRect(c, -26, -21, 52, 12, 4),
        { cx: 0, cy: -15, rx: 26, ry: 6 },
      );

      // Left and Right Stepped Stone Piers (3/4 top cap + south cliff face)
      for (const side of [-1, 1] as const) {
        const px = side * 24;
        // South cliff face of pier
        outlined(
          ctx,
          {
            fill: env.wallFront,
            shade: env.shadow,
            outlineWidth: 2.4,
          },
          (c) => traceRoundedRect(c, px - 7.5, -6, 15, 25, 3),
          { cx: px, cy: 6.5, rx: 7.5, ry: 12.5 },
        );
        // Top cap of pier (lit from -135 deg top-left)
        outlined(
          ctx,
          {
            fill: env.wallTop,
            shade: env.wallFront,
            highlight: env.rim,
            outlineWidth: 2.4,
          },
          (c) => traceRoundedRect(c, px - 8.5, -20, 17, 20, 3.5),
          { cx: px, cy: -10, rx: 8.5, ry: 10 },
        );
        // Top-left (-135 deg) rim bevel on pier cap
        ctx.beginPath();
        ctx.moveTo(px - 6.5, -3);
        ctx.lineTo(px - 6.5, -18);
        ctx.lineTo(px + 6.5, -18);
        ctx.strokeStyle = env.rim;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Recessed lock-lamp socket on pier jamb
        ctx.beginPath();
        ctx.arc(px - side * 2.5, -9, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.INK_DARK;
        ctx.fill();
      }

      // Central Keystone Trapezoid at top of arch
      outlined(
        ctx,
        {
          fill: env.wallTop,
          shade: env.wallFront,
          highlight: env.rim,
          outlineWidth: 2.2,
        },
        (c) =>
          tracePolygon(c, [
            { x: -6.5, y: -23 },
            { x: 6.5, y: -23 },
            { x: 4.5, y: -11 },
            { x: -4.5, y: -11 },
          ]),
        { cx: 0, cy: -17, rx: 6.5, ry: 6 },
      );

      // Biome-specific architectural accent motif on piers
      ctx.fillStyle = env.accent;
      ctx.beginPath();
      ctx.arc(0, -17, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6b. Vertical East/West Archway Frame (52x68)
    // Drawn natively in 3/4 perspective (upper & lower piers with horizontal top caps lit from -135 deg, south cliff faces)
    bakeCustomCanvas(scene, `door_frame_ew_${biome}`, 52, 68, scale, (ctx) => {
      // Drop shadow cast to South-East (-135 deg light source)
      ctx.fillStyle = 'rgba(11, 9, 14, 0.36)';
      traceRoundedRect(ctx, -18, -30, 40, 63, 6);
      ctx.fill();

      // Dark vertical threshold channel between upper and lower piers
      ctx.fillStyle = env.shadow;
      traceRoundedRect(ctx, -14, -22, 28, 44, 4);
      ctx.fill();

      // Side arch span beam connecting upper & lower piers in 3/4 view
      outlined(
        ctx,
        {
          fill: env.wallFront,
          shade: env.shadow,
          highlight: env.wallTop,
          outlineWidth: 2.4,
        },
        (c) => traceRoundedRect(c, -11, -26, 22, 52, 4),
        { cx: 0, cy: 0, rx: 11, ry: 26 },
      );

      // Re-carve inner doorway threshold passage so barrier sits cleanly inside
      ctx.fillStyle = env.shadow;
      traceRoundedRect(ctx, -12, -17, 24, 34, 3);
      ctx.fill();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();

      // Upper (North) Pier and Lower (South) Pier — each with proper 3/4 top cap & south cliff face!
      for (const pierY of [-23, 21] as const) {
        // South cliff face below the top cap (always facing South, never rotated 90 deg!)
        outlined(
          ctx,
          {
            fill: env.wallFront,
            shade: env.shadow,
            outlineWidth: 2.4,
          },
          (c) => traceRoundedRect(c, -17, pierY - 1, 34, 11, 3),
          { cx: 0, cy: pierY + 4.5, rx: 17, ry: 5.5 },
        );
        // Horizontal 3/4 Top Cap lit from -135 deg top-left
        outlined(
          ctx,
          {
            fill: env.wallTop,
            shade: env.wallFront,
            highlight: env.rim,
            outlineWidth: 2.4,
          },
          (c) => traceRoundedRect(c, -18, pierY - 9, 36, 12, 3.5),
          { cx: 0, cy: pierY - 3, rx: 18, ry: 6 },
        );
        // Top-left (-135 deg) rim highlight on pier cap
        ctx.beginPath();
        ctx.moveTo(-16, pierY + 1);
        ctx.lineTo(-16, pierY - 7.2);
        ctx.lineTo(16, pierY - 7.2);
        ctx.strokeStyle = env.rim;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Recessed lock-lamp socket on pier cap
        ctx.beginPath();
        ctx.arc(0, pierY - 3, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.INK_DARK;
        ctx.fill();
      }
    });
  }

  // 7. Door Energy Barriers: Horizontal ('door_barrier_ns', 48x30) & Vertical ('door_barrier_ew', 30x48)
  for (const [key, w, h] of [
    ['door_barrier_ns', 48, 30],
    ['door_barrier_ew', 30, 48],
  ] as const) {
    bakeCustomCanvas(scene, key, w, h, scale, (ctx) => {
      const hw = w * 0.5 - 3;
      const hh = h * 0.5 - 3;

      // Translucent dark crimson forcefield body (#7F1D1D -> #DC2626)
      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(hw, hh));
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.92)');
      grad.addColorStop(0.55, 'rgba(185, 28, 28, 0.84)');
      grad.addColorStop(1, 'rgba(127, 29, 29, 0.76)');

      ctx.save();
      traceRoundedRect(ctx, -hw, -hh, hw * 2, hh * 2, 4);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.clip();

      // Hexagonal energy lattice inside the barrier
      ctx.strokeStyle = 'rgba(254, 202, 202, 0.42)';
      ctx.lineWidth = 1.1;
      drawHexGridPattern(ctx, hw, hh, 7.5);
      ctx.restore();

      // Bright crimson energy frame border
      traceRoundedRect(ctx, -hw, -hh, hw * 2, hh * 2, 4);
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = '#F87171';
      ctx.stroke();

      // Central arcane lock seal emblem
      ctx.beginPath();
      ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(127, 29, 29, 0.92)';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#FCA5A5';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -4.2);
      ctx.lineTo(4.2, 0);
      ctx.lineTo(0, 4.2);
      ctx.lineTo(-4.2, 0);
      ctx.closePath();
      ctx.fillStyle = '#FEF2F2';
      ctx.fill();
    });
  }

  // 8. Unlocked Door Luminous Threshold Veils ('door_open_arch_ns' 48x30, 'door_open_arch_ew' 30x48)
  // Ivory-white soft gradient so setTint colors it with the biome's accent glow when unlocked
  for (const [key, w, h] of [
    ['door_open_arch_ns', 48, 30],
    ['door_open_arch_ew', 30, 48],
  ] as const) {
    bakeCustomCanvas(scene, key, w, h, scale, (ctx) => {
      const hw = w * 0.5 - 3;
      const hh = h * 0.5 - 3;
      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(hw, hh));
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
      grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.34)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

      traceRoundedRect(ctx, -hw, -hh, hw * 2, hh * 2, 5);
      ctx.fillStyle = grad;
      ctx.fill();

      // Soft inner threshold shimmer ring
      ctx.beginPath();
      ctx.ellipse(0, 0, hw * 0.65, hh * 0.65, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });
  }
}
