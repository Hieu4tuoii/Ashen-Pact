import type Phaser from 'phaser';
import {
  AUTOTILE_EAST,
  AUTOTILE_NORTH,
  AUTOTILE_SOUTH,
  AUTOTILE_WEST,
  SeededRandom,
  WALL_AO_NORTH,
  WALL_AO_NORTH_WEST,
  WALL_AO_WEST,
} from '@ashen-pact/shared';
import { ENV_PALETTE, PALETTE } from './palette.js';
import { outlined, traceRoundedRect } from './primitives.js';
import { registerCanvasTexture } from './texture-baker-canvas.js';
import { TextureBaker } from './texture-baker.js';

export function bakeBiomeTile(
  scene: Phaser.Scene,
  biome: 0 | 1 | 2 | 3,
  variant: number,
  scale: number,
): void {
  const key = TextureBaker.getBiomeTileTextureKey(biome, variant);
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size * scale);
  canvas.height = Math.ceil(size * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const env = ENV_PALETTE[biome] ?? ENV_PALETTE[1];
  const v = ((variant % 8) + 8) % 8;
  const rng = new SeededRandom(`tile_${biome}_${v}`);

  ctx.save();
  ctx.scale(scale, scale);

  // Base floor fill
  ctx.fillStyle = env.floor;
  ctx.fillRect(0, 0, size, size);

  if (v === 0) {
    // Perimeter (distToWall === 1): 1x1 stone slab with mortar lines and subtle hairline crack
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = env.seam;
    ctx.lineWidth = 1.0;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

    ctx.beginPath();
    ctx.moveTo(rng.nextFloat(7, 12), rng.nextFloat(8, 13));
    ctx.lineTo(rng.nextFloat(14, 19), rng.nextFloat(15, 20));
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = env.var;
    for (let i = 0; i < 2; i++) {
      const px = rng.nextFloat(8, 24);
      const py = rng.nextFloat(8, 24);
      ctx.beginPath();
      ctx.ellipse(px, py, 2.0, 1.3, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (v === 1) {
    // Perimeter (distToWall === 1): 2x2 sub-divided stone pavers
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = env.var;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillRect(16, 16, 16, 16);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = env.seam;
    ctx.lineWidth = 1.0;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(16, size);
    ctx.moveTo(0, 16);
    ctx.lineTo(size, 16);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = env.seam;
    ctx.beginPath();
    ctx.arc(8, 24, 1.6, 0, Math.PI * 2);
    ctx.arc(24, 8, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (v === 2) {
    // Perimeter (distToWall === 1): Recessed iron drainage grate
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = env.seam;
    ctx.lineWidth = 1.0;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.52;
    ctx.fillStyle = env.seam;
    ctx.fillRect(8, 8, 16, 16);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.48;
    ctx.strokeStyle = env.wallFront;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const gx of [10.5, 14.2, 17.8, 21.5]) {
      ctx.moveTo(gx, 9);
      ctx.lineTo(gx, 23);
    }
    ctx.stroke();
    ctx.restore();
  } else if (v === 3) {
    // Perimeter (distToWall === 2): Transition slab
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = env.var;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  } else {
    // Center Arena (distToWall > 2, variants 4..7): tone modulation
    const varAlpha = Math.max(0, Math.min(0.6, (v - 4) * 0.2));
    if (varAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = varAlpha;
      ctx.fillStyle = env.var;
      ctx.fillRect(0, 0, size, size);
      ctx.restore();
    }
  }

  // Interlocking ashlar/flagstone mortar joints & -135 deg top-left bevel highlights across all 8 variants (0..7)
  const splitX = 12 + (v % 4) * 3;
  const splitY = 11 + ((v * 3) % 4) * 3;
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = env.seam;
  ctx.lineWidth = 1.3;
  ctx.strokeRect(1, 1, splitX - 2, splitY - 2);
  ctx.strokeRect(splitX, 1, 31 - splitX, splitY - 2);
  ctx.strokeRect(1, splitY, 30, 31 - splitY);

  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = env.rim;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(2, splitY - 2);
  ctx.lineTo(2, 2);
  ctx.lineTo(splitX - 2, 2);
  ctx.moveTo(2, 30);
  ctx.lineTo(2, splitY + 1);
  ctx.lineTo(30, splitY + 1);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
  registerCanvasTexture(scene, key, canvas);
}

/**
 * Bakes neighbor-aware autotiled 3-layer 3D wall tile:
 * - South Cliff Face (cliffH = 12u when !hasS, capBottom = 20u) in ENV.wallFront (deltaL -10 below floor)
 *   with biome-specific multi-course relief
 * - Top Cap (y = 0..capBottom) in ENV.wallTop (deltaL +15 above floor) with raised parapet coping when hasS
 * - Crisp -135 deg directional rim-light (ENV.rim, 1.8u) along exposed North/West edges
 * - INK_DARK (2.2u) outer contour along exposed boundary edges (0 segments on mask === 15)
 */
export function bakeWallTile(
  scene: Phaser.Scene,
  biome: 0 | 1 | 2 | 3,
  mask: number,
  scale: number,
): void {
  const key = TextureBaker.getWallTileTextureKey(biome, mask);
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size * scale);
  canvas.height = Math.ceil(size * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const env = ENV_PALETTE[biome] ?? ENV_PALETTE[1];
  const m = mask & 15;
  const hasN = (m & AUTOTILE_NORTH) !== 0;
  const hasE = (m & AUTOTILE_EAST) !== 0;
  const hasS = (m & AUTOTILE_SOUTH) !== 0;
  const hasW = (m & AUTOTILE_WEST) !== 0;

  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = env.floor;
  ctx.fillRect(0, 0, size, size);

  const padN = hasN ? 0 : 1.1;
  const padW = hasW ? 0 : 1.1;
  const padE = hasE ? 0 : 1.1;
  const cliffH = hasS ? 0 : 12;
  const capBottom = hasS ? size : size - cliffH;

  const capX = padW;
  const capY = padN;
  const capW = size - padW - padE;
  const capH = capBottom - padN;

  // 1. Fill Top Cap (ENV.wallTop, deltaL +15 above floor)
  ctx.fillStyle = env.wallTop;
  ctx.fillRect(capX, capY, capW, capH);

  // 2. Subtle inner stone course on Top Cap in ENV.seam (alpha 0.35)
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = env.seam;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const midCourseY = Math.min(capY + capH - 2, 10);
  if (capY < midCourseY - 2) {
    ctx.moveTo(capX, midCourseY);
    ctx.lineTo(capX + capW, midCourseY);
  }
  ctx.moveTo(16, capY);
  ctx.lineTo(16, Math.min(capY + capH, midCourseY));
  if (capY + capH > midCourseY) {
    ctx.moveTo(8, Math.max(capY, midCourseY));
    ctx.lineTo(8, capY + capH);
    ctx.moveTo(24, Math.max(capY, midCourseY));
    ctx.lineTo(24, capY + capH);
  }
  ctx.stroke();
  ctx.restore();

  // 2b. Raised 2.5D stone parapet coping when m !== 15
  if (m !== 15) {
    ctx.save();
    ctx.fillStyle = env.wallFront;
    if (!hasN) ctx.fillRect(0, 0, 32, 4);
    if (!hasW) ctx.fillRect(0, 0, 4, capBottom);
    if (!hasE) ctx.fillRect(28, 0, 4, capBottom);
    if (!hasN || !hasW) {
      ctx.strokeStyle = env.rim;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (!hasN) {
        ctx.moveTo(0, 2);
        ctx.lineTo(32, 2);
      }
      if (!hasW) {
        ctx.moveTo(2, 0);
        ctx.lineTo(2, capBottom);
      }
      ctx.stroke();
    }
    if (!hasN || !hasW || !hasE) {
      ctx.strokeStyle = env.seam;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      if (!hasN) {
        ctx.moveTo(hasW ? 0 : 4, 4);
        ctx.lineTo(hasE ? 32 : 28, 4);
      }
      if (!hasW) {
        ctx.moveTo(4, hasN ? 0 : 4);
        ctx.lineTo(4, capBottom);
      }
      if (!hasE) {
        ctx.moveTo(28, hasN ? 0 : 4);
        ctx.lineTo(28, capBottom);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. 3D South Cliff Face (cliffH = 12u when !hasS, capBottom = 20u)
  if (!hasS) {
    const cliffY = capBottom;
    ctx.fillStyle = env.wallFront;
    ctx.fillRect(capX, cliffY, capW, cliffH - 1.1);

    // 2u top overhang shadow (y = 20..22)
    ctx.fillStyle = env.shadow;
    ctx.fillRect(capX, cliffY, capW, 2.0);

    // 2 horizontal stone courses (y = 24, 28) + staggered vertical mortar joints in ENV.shadow
    ctx.strokeStyle = env.shadow;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(capX, 24);
    ctx.lineTo(capX + capW, 24);
    ctx.moveTo(capX, 28);
    ctx.lineTo(capX + capW, 28);

    // Course 1 vertical joints (y = 20..24)
    ctx.moveTo(11, cliffY);
    ctx.lineTo(11, 24);
    ctx.moveTo(22, cliffY);
    ctx.lineTo(22, 24);
    // Course 2 staggered vertical joints (y = 24..28)
    ctx.moveTo(7, 24);
    ctx.lineTo(7, 28);
    ctx.moveTo(17, 24);
    ctx.lineTo(17, 28);
    ctx.moveTo(26, 24);
    ctx.lineTo(26, 28);
    // Course 3 vertical joints (y = 28..31)
    ctx.moveTo(12, 28);
    ctx.lineTo(12, size - 1.1);
    ctx.moveTo(23, 28);
    ctx.lineTo(23, size - 1.1);
    ctx.stroke();

    // Subtle stone mortar/crack weathering along ashlar courses (no caution-tape diagonal slashes)
    ctx.save();
    ctx.globalAlpha = 0.25;
    const ox = ((m * 3) % 5) - 2;
    ctx.strokeStyle = env.seam;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(6 + ox, 22.5);
    ctx.lineTo(10 + ox, 22.5);
    ctx.lineTo(11 + ox, 24);
    ctx.moveTo(19 - ox, 26);
    ctx.lineTo(24 - ox, 26);
    ctx.lineTo(25 - ox, 28);
    ctx.stroke();

    if (biome !== 0) {
      const reliefColor =
        biome === 1 ? '#3D5235' : biome === 2 ? '#6F949E' : '#8A342B';
      ctx.globalAlpha = 0.24;
      ctx.strokeStyle = reliefColor;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(12 + ox, 25.5);
      ctx.lineTo(16 + ox, 25.5);
      ctx.moveTo(22 - ox, 29.5);
      ctx.lineTo(27 - ox, 29.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 4. Crisp -135 deg directional rim-light (ENV.rim, 1.8u) along exposed North/West edges
  if (!hasW || !hasN) {
    ctx.beginPath();
    if (!hasW) {
      ctx.moveTo(capX + 1.8, capY + capH - 1);
      ctx.lineTo(capX + 1.8, capY + 1.8);
    }
    if (!hasN) {
      ctx.moveTo(capX + 1.8, capY + 1.8);
      ctx.lineTo(capX + capW - 1, capY + 1.8);
    }
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = env.rim;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // 5. Crisp INK_DARK (2.2u) outer contour ONLY along exposed boundary edges
  ctx.beginPath();
  if (!hasN) {
    ctx.moveTo(capX, capY);
    ctx.lineTo(capX + capW, capY);
  }
  if (!hasW) {
    ctx.moveTo(capX, capY);
    ctx.lineTo(capX, hasS ? size : size - 1.1);
  }
  if (!hasE) {
    ctx.moveTo(capX + capW, capY);
    ctx.lineTo(capX + capW, hasS ? size : size - 1.1);
  }
  if (!hasS) {
    ctx.moveTo(capX, capBottom);
    ctx.lineTo(capX + capW, capBottom);
    ctx.moveTo(capX, size - 1.1);
    ctx.lineTo(capX + capW, size - 1.1);
  }
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = PALETTE.INK_DARK;
  ctx.stroke();

  ctx.restore();
  registerCanvasTexture(scene, key, canvas);
}

export function bakePillarTile(
  scene: Phaser.Scene,
  biome: 0 | 1 | 2 | 3,
  mask: number,
  scale: number,
): void {
  const key = TextureBaker.getPillarTileTextureKey(biome, mask);
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size * scale);
  canvas.height = Math.ceil(size * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const env = ENV_PALETTE[biome] ?? ENV_PALETTE[1];
  const hasN = (mask & AUTOTILE_NORTH) !== 0;
  const hasE = (mask & AUTOTILE_EAST) !== 0;
  const hasS = (mask & AUTOTILE_SOUTH) !== 0;
  const hasW = (mask & AUTOTILE_WEST) !== 0;

  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = env.floor;
  ctx.fillRect(0, 0, size, size);

  const padN = hasN ? 0 : 1.5;
  const padW = hasW ? 0 : 1.5;
  const padE = hasE ? 0 : 1.5;
  const cliffH = hasS ? 0 : 12;
  const capBottom = hasS ? size : size - cliffH;

  const capX = padW;
  const capY = padN;
  const capW = size - padW - padE;
  const capH = capBottom - padN;

  // 1. Monolithic pillar top cap (ENV.wallTop)
  ctx.fillStyle = env.wallTop;
  ctx.fillRect(capX, capY, capW, capH);

  // 2. Stepped capital inner carved frame in ENV.seam (alpha 0.45)
  const inN = hasN ? 0 : capY + 4.5;
  const inW = hasW ? 0 : capX + 4.5;
  const inE = hasE ? size : capX + capW - 4.5;
  const inS = hasS ? size : capY + capH - 4.5;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = env.seam;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (!hasN) {
    ctx.moveTo(inW, inN);
    ctx.lineTo(inE, inN);
  }
  if (!hasW) {
    ctx.moveTo(inW, inN);
    ctx.lineTo(inW, inS);
  }
  if (!hasE) {
    ctx.moveTo(inE, inN);
    ctx.lineTo(inE, inS);
  }
  if (!hasS) {
    ctx.moveTo(inW, inS);
    ctx.lineTo(inE, inS);
  }
  ctx.stroke();
  ctx.restore();

  // 3. Unified central rune medallion ONLY on 2x2 corner quadrants (m = 3, 6, 9, 12) or isolated 1x1 pillar (m = 0);
  //    linear/interior pillar tiles (1, 2, 4, 8, 5, 10, 7, 11, 13, 14, 15) receive a clean rectangular stone course inset.
  const m = mask & 15;
  const isCornerMedallionMask = (hasE !== hasW && hasN !== hasS) || m === 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(capX, capY, capW, capH);
  ctx.clip();

  if (isCornerMedallionMask) {
    const runeCx = hasE && !hasW ? size : hasW && !hasE ? 0 : 16;
    const runeCy = hasS && !hasN ? size : hasN && !hasS ? 0 : 11;

    ctx.beginPath();
    ctx.arc(runeCx, runeCy, 6.8, 0, Math.PI * 2);
    ctx.fillStyle = env.wallFront;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(runeCx, runeCy, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = env.accent;
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();
  } else {
    const rx = hasW ? 4 : capX + 6.5;
    const ry = hasN ? 4 : capY + 6.0;
    const rw = Math.max(4, (hasE ? size - 4 : capX + capW - 6.5) - rx);
    const rh = Math.max(4, (hasS ? capBottom - 4 : capY + capH - 6.0) - ry);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = env.var;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = env.seam;
    ctx.lineWidth = 1.1;
    ctx.strokeRect(rx, ry, rw, rh);
  }
  ctx.restore();

  // 4. 3D South Cliff Face & Base Plinth (cliffH = 12u when !hasS, capBottom = 20u)
  if (!hasS) {
    const cliffY = capBottom;
    ctx.fillStyle = env.wallFront;
    ctx.fillRect(capX, cliffY, capW, cliffH - 1.1);

    // 2u top overhang shadow
    ctx.fillStyle = env.shadow;
    ctx.fillRect(capX, cliffY, capW, 2.0);

    // Stepped base plinth molding at bottom of column shaft
    ctx.fillStyle = env.seam;
    ctx.fillRect(capX, size - 4.0, capW, 2.8);

    // Horizontal courses & vertical fluting lines in ENV.shadow
    ctx.strokeStyle = env.shadow;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(capX, 24);
    ctx.lineTo(capX + capW, 24);
    ctx.moveTo(capX, 28);
    ctx.lineTo(capX + capW, 28);
    ctx.moveTo(10, cliffY);
    ctx.lineTo(10, size - 1.1);
    ctx.moveTo(22, cliffY);
    ctx.lineTo(22, size - 1.1);
    ctx.stroke();
  }

  // 5. Crisp -135 deg directional rim-light (ENV.rim, 1.8u) along exposed North/West edges
  ctx.beginPath();
  if (!hasW) {
    ctx.moveTo(capX + 1.8, capY + capH - 1);
    ctx.lineTo(capX + 1.8, capY + 1.8);
  }
  if (!hasN) {
    ctx.moveTo(capX + 1.8, capY + 1.8);
    ctx.lineTo(capX + capW - 1, capY + 1.8);
  }
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = env.rim;
  ctx.lineCap = 'round';
  ctx.stroke();

  // 6. INK_DARK (2.2u) outer contour ONLY along exposed boundary edges
  ctx.beginPath();
  if (!hasN) {
    ctx.moveTo(capX, capY);
    ctx.lineTo(capX + capW, capY);
  }
  if (!hasW) {
    ctx.moveTo(capX, capY);
    ctx.lineTo(capX, hasS ? size : size - 1.1);
  }
  if (!hasE) {
    ctx.moveTo(capX + capW, capY);
    ctx.lineTo(capX + capW, hasS ? size : size - 1.1);
  }
  if (!hasS) {
    ctx.moveTo(capX, capBottom);
    ctx.lineTo(capX + capW, capBottom);
    ctx.moveTo(capX, size - 1.1);
    ctx.lineTo(capX + capW, size - 1.1);
  }
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = PALETTE.INK_DARK;
  ctx.stroke();

  ctx.restore();
  registerCanvasTexture(scene, key, canvas);
}

export function bakeCrackedWallTile(
  scene: Phaser.Scene,
  biome: 0 | 1 | 2 | 3,
  scale: number,
): void {
  const key = TextureBaker.getCrackedWallTextureKey(biome);
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size * scale);
  canvas.height = Math.ceil(size * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const env = ENV_PALETTE[biome] ?? ENV_PALETTE[1];

  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = env.floor;
  ctx.fillRect(0, 0, size, size);

  outlined(
    ctx,
    {
      fill: env.wallTop,
      shade: env.wallFront,
      highlight: env.rim,
      outlineColor: PALETTE.INK_DARK,
      outlineWidth: 2.2,
    },
    (c) => traceRoundedRect(c, 1.5, 1.5, size - 3, size - 6, 3),
    { cx: 16, cy: 13, rx: 14, ry: 12 },
  );

  // Glowing secret fracture fissures indicating destructible wall
  const traceFissureCracks = (c: CanvasRenderingContext2D) => {
    c.beginPath();
    c.moveTo(7, 5);
    c.lineTo(15, 12);
    c.lineTo(12, 20);
    c.lineTo(22, 25);
    c.moveTo(15, 12);
    c.lineTo(25, 8);
    c.moveTo(12, 20);
    c.lineTo(6, 24);
  };
  traceFissureCracks(ctx);
  ctx.lineWidth = 3.8;
  ctx.strokeStyle = PALETTE.INK_DARK;
  ctx.lineCap = 'round';
  ctx.stroke();

  traceFissureCracks(ctx);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = PALETTE.FLAME_ORANGE;
  ctx.stroke();

  traceFissureCracks(ctx);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = PALETTE.SOLAR_GOLD;
  ctx.stroke();

  ctx.fillStyle = PALETTE.BONE_WHITE;
  ctx.beginPath();
  ctx.arc(15, 12, 1.4, 0, Math.PI * 2);
  ctx.arc(12, 20, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  registerCanvasTexture(scene, key, canvas);
}

/**
 * Bakes directional ambient occlusion / drop-shadow overlay cast by North, West, and North-West walls:
 * - Soft 7u contact shadow (alpha 0.35 -> 0) under North/West walls
 * - Diagonal -135 deg South-East cast shadow (14u, alpha 0.22 -> 0) from wall corners and pillars
 */
export function bakeWallAoOverlay(scene: Phaser.Scene, aoMask: number, scale: number): void {
  const key = TextureBaker.getWallAoTextureKey(aoMask);
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size * scale);
  canvas.height = Math.ceil(size * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.save();
  ctx.scale(scale, scale);

  if (aoMask & WALL_AO_NORTH) {
    const gradN = ctx.createLinearGradient(0, 0, 0, 7);
    gradN.addColorStop(0, 'rgba(11, 9, 14, 0.35)');
    gradN.addColorStop(1, 'rgba(11, 9, 14, 0)');
    ctx.fillStyle = gradN;
    ctx.fillRect(0, 0, size, 7);
  }

  if (aoMask & WALL_AO_WEST) {
    const gradW = ctx.createLinearGradient(0, 0, 7, 0);
    gradW.addColorStop(0, 'rgba(11, 9, 14, 0.35)');
    gradW.addColorStop(1, 'rgba(11, 9, 14, 0)');
    ctx.fillStyle = gradW;
    ctx.fillRect(0, 0, 7, size);
  }

  if ((aoMask & WALL_AO_NORTH_WEST) !== 0 && (aoMask & (WALL_AO_NORTH | WALL_AO_WEST)) === 0) {
    const gradSE = ctx.createLinearGradient(0, 0, 14, 14);
    gradSE.addColorStop(0, 'rgba(11, 9, 14, 0.22)');
    gradSE.addColorStop(1, 'rgba(11, 9, 14, 0)');
    ctx.fillStyle = gradSE;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(14, 0);
    ctx.lineTo(14, 14);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  registerCanvasTexture(scene, key, canvas);
}
