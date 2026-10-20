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
import { BIOME_THEMES, PALETTE } from './palette.js';
import { outlined, traceRoundedRect } from './primitives.js';
import { registerCanvasTexture } from './texture-baker-canvas.js';
import { TextureBaker } from './texture-baker.js';

export function bakeBiomeTile(
  scene: Phaser.Scene,
  biome: 1 | 2 | 3,
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

  const theme = BIOME_THEMES[biome];
  const rng = new SeededRandom(`tile_${biome}_${variant}`);

  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = theme.bgDark;
  ctx.fillRect(0, 0, size, size);

  outlined(
    ctx,
    {
      fill: theme.floorBase,
      shade: theme.floorShade,
      outlineColor: PALETTE.INK_DARK,
      outlineWidth: 1.4,
    },
    (c) => traceRoundedRect(c, 1.2, 1.2, size - 2.4, size - 2.4, 3.5),
    { cx: 16, cy: 16, rx: 14, ry: 14 },
  );

  // Top-left rim light bevel
  ctx.beginPath();
  ctx.moveTo(3.5, 24);
  ctx.lineTo(3.5, 3.5);
  ctx.lineTo(24, 3.5);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = theme.floorHighlight;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Seeded procedural floor detail per variant (0..7)
  const detailMode = variant % 4;
  if (detailMode === 0) {
    // Bioluminescent spore / crystal speck
    const cx = rng.nextFloat(9, 23);
    const cy = rng.nextFloat(9, 23);
    ctx.beginPath();
    ctx.arc(cx, cy, rng.nextFloat(1.5, 2.3), 0, Math.PI * 2);
    ctx.fillStyle = theme.accentGlow;
    ctx.fill();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();
  } else if (detailMode === 1) {
    // Jagged stone fracture line
    ctx.beginPath();
    ctx.moveTo(rng.nextFloat(7, 13), rng.nextFloat(7, 13));
    ctx.lineTo(rng.nextFloat(14, 19), rng.nextFloat(14, 19));
    ctx.lineTo(rng.nextFloat(19, 25), rng.nextFloat(12, 23));
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else if (detailMode === 2) {
    // Small moss tuft / stone pebbles
    for (let i = 0; i < 2; i++) {
      const px = rng.nextFloat(8, 24);
      const py = rng.nextFloat(8, 24);
      ctx.beginPath();
      ctx.ellipse(px, py, 2.2, 1.5, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = theme.floorHighlight;
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();
    }
  } else {
    // Subtle recessed stone paver seam
    ctx.strokeStyle = theme.floorShade;
    ctx.lineWidth = 1.0;
    ctx.strokeRect(8, 8, 16, 16);
  }

  ctx.restore();
  registerCanvasTexture(scene, key, canvas);
}

/**
 * Bakes neighbor-aware autotiled wall tile with 2.5D south cliff face and top-left bevels.
 */
export function bakeWallTile(
  scene: Phaser.Scene,
  biome: 1 | 2 | 3,
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

  const hasN = (mask & AUTOTILE_NORTH) !== 0;
  const hasE = (mask & AUTOTILE_EAST) !== 0;
  const hasS = (mask & AUTOTILE_SOUTH) !== 0;
  const hasW = (mask & AUTOTILE_WEST) !== 0;

  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = BIOME_THEMES[biome].floorBase;
  ctx.fillRect(0, 0, size, size);

  const padN = hasN ? 0 : 1.5;
  const padW = hasW ? 0 : 1.5;
  const padE = hasE ? 0 : 1.5;
  // When South is floor (!hasS), expose a 7u tall 3D stone cliff face at the bottom of the wall tile
  const cliffH = hasS ? 0 : 7;
  const padS = hasS ? 0 : cliffH + 1.5;

  const capX = padW;
  const capY = padN;
  const capW = size - padW - padE;
  const capH = size - padN - padS;

  const capColor =
    biome === 2 ? PALETTE.COBALT_SHADE : biome === 3 ? PALETTE.STEEL_DARK : PALETTE.SLATE_MID;
  const bevelLight =
    biome === 2 ? PALETTE.CYAN_FROST : biome === 3 ? PALETTE.COPPER_LIGHT : PALETTE.ASH_GRAY;
  const bevelDark =
    biome === 2 ? PALETTE.ABYSS_BLUE : biome === 3 ? PALETTE.FORGE_DARK : PALETTE.SLATE_DARK;
  const rimStroke =
    biome === 2 ? PALETTE.ICE_WHITE : biome === 3 ? PALETTE.FLAME_ORANGE : PALETTE.WARM_STONE;

  // 1. Fill top stone cap
  ctx.fillStyle = capColor;
  ctx.fillRect(capX, capY, capW, capH);

  // 2. Subtle top-left directional bevel & bottom-right shade
  if (!hasN) {
    ctx.fillStyle = bevelLight;
    ctx.fillRect(capX, capY, capW, 3.2);
  }
  if (!hasW) {
    ctx.fillStyle = bevelLight;
    ctx.fillRect(capX, capY, 3.2, capH);
  }
  if (!hasE) {
    ctx.fillStyle = bevelDark;
    ctx.fillRect(capX + capW - 2.8, capY, 2.8, capH);
  }
  if (!hasS) {
    ctx.fillStyle = bevelDark;
    ctx.fillRect(capX, capY + capH - 2.5, capW, 2.5);
  }

  // 3. Continuous stone block mortar seams across connected wall tiles
  ctx.strokeStyle = bevelDark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (capY < 13 && capY + capH > 15) {
    ctx.moveTo(capX, 14);
    ctx.lineTo(capX + capW, 14);
  }
  ctx.moveTo(16, capY);
  ctx.lineTo(16, Math.min(capY + capH, 14));
  if (capY + capH > 14) {
    ctx.moveTo(8, Math.max(capY, 14));
    ctx.lineTo(8, capY + capH);
    ctx.moveTo(24, Math.max(capY, 14));
    ctx.lineTo(24, capY + capH);
  }
  ctx.stroke();

  // 4. Moss / frost crystal / ember rune accent on wall top
  ctx.beginPath();
  ctx.arc(11, 9, 2.1, 0, Math.PI * 2);
  ctx.fillStyle = BIOME_THEMES[biome].accentGlow;
  ctx.fill();

  // 5. 3D South Cliff Face when South is exposed (!hasS)
  if (!hasS) {
    const cliffY = size - cliffH - 1.5;
    ctx.fillStyle = bevelDark;
    ctx.fillRect(capX, cliffY, capW, cliffH);
    ctx.fillStyle = PALETTE.INK_DEEP;
    ctx.fillRect(capX, cliffY + cliffH - 2, capW, 2);

    // Vertical stone mortar joints on cliff face
    ctx.beginPath();
    ctx.moveTo(11, cliffY + 0.5);
    ctx.lineTo(11, cliffY + cliffH - 0.5);
    ctx.moveTo(22, cliffY + 0.5);
    ctx.lineTo(22, cliffY + cliffH - 0.5);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();
  }

  // 6. Top-left directional rim highlight on exposed N/W edges
  ctx.beginPath();
  if (!hasW) {
    ctx.moveTo(capX + 1.8, capY + capH - 1);
    ctx.lineTo(capX + 1.8, capY + 1.8);
  }
  if (!hasN) {
    ctx.moveTo(capX + 1.8, capY + 1.8);
    ctx.lineTo(capX + capW - 1, capY + 1.8);
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rimStroke;
  ctx.stroke();

  // 7. Crisp dark outlines ONLY along exposed non-connected edges
  ctx.beginPath();
  if (!hasN) {
    ctx.moveTo(capX, capY);
    ctx.lineTo(capX + capW, capY);
  }
  if (!hasW) {
    ctx.moveTo(capX, capY);
    ctx.lineTo(capX, hasS ? size : size - 1.5);
  }
  if (!hasE) {
    ctx.moveTo(capX + capW, capY);
    ctx.lineTo(capX + capW, hasS ? size : size - 1.5);
  }
  if (!hasS) {
    const cliffY = size - cliffH - 1.5;
    // Ridge line between cap and South cliff
    ctx.moveTo(capX, cliffY);
    ctx.lineTo(capX + capW, cliffY);
    // Bottom base outline of South cliff
    ctx.moveTo(capX, size - 1.5);
    ctx.lineTo(capX + capW, size - 1.5);
  }
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = PALETTE.INK_DARK;
  ctx.stroke();

  ctx.restore();
  registerCanvasTexture(scene, key, canvas);
}

export function bakePillarTile(
  scene: Phaser.Scene,
  biome: 1 | 2 | 3,
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

  const hasN = (mask & AUTOTILE_NORTH) !== 0;
  const hasE = (mask & AUTOTILE_EAST) !== 0;
  const hasS = (mask & AUTOTILE_SOUTH) !== 0;
  const hasW = (mask & AUTOTILE_WEST) !== 0;

  ctx.save();
  ctx.scale(scale, scale);

  // Underlying biome floor in exposed margin
  ctx.fillStyle = BIOME_THEMES[biome].floorBase;
  ctx.fillRect(0, 0, size, size);

  const padN = hasN ? 0 : 2;
  const padW = hasW ? 0 : 2;
  const padE = hasE ? 0 : 2;
  const cliffH = hasS ? 0 : 6.5;
  const padS = hasS ? 0 : cliffH + 1.5;

  const capX = padW;
  const capY = padN;
  const capW = size - padW - padE;
  const capH = size - padN - padS;

  const pillarCap =
    biome === 2 ? PALETTE.AZURE_CORE : biome === 3 ? PALETTE.BRASS_CORE : PALETTE.WARM_STONE;
  const pillarHighlight =
    biome === 2 ? PALETTE.ICE_WHITE : biome === 3 ? PALETTE.SOLAR_GOLD : PALETTE.BONE_WHITE;
  const pillarShade =
    biome === 2 ? PALETTE.COBALT_SHADE : biome === 3 ? PALETTE.LEATHER_DARK : PALETTE.ASH_GRAY;

  // 1. Monolithic pillar top surface
  ctx.fillStyle = pillarCap;
  ctx.fillRect(capX, capY, capW, capH);

  // 2. Exposed bevels
  if (!hasN) {
    ctx.fillStyle = pillarHighlight;
    ctx.fillRect(capX, capY, capW, 3.2);
  }
  if (!hasW) {
    ctx.fillStyle = pillarHighlight;
    ctx.fillRect(capX, capY, 3.2, capH);
  }
  if (!hasE) {
    ctx.fillStyle = pillarShade;
    ctx.fillRect(capX + capW - 3, capY, 3, capH);
  }
  if (!hasS) {
    ctx.fillStyle = pillarShade;
    ctx.fillRect(capX, capY + capH - 2.8, capW, 2.8);
  }

  // 3. Carved inner frame on pillar cap
  const inN = hasN ? 0 : capY + 5;
  const inW = hasW ? 0 : capX + 5;
  const inE = hasE ? size : capX + capW - 5;
  const inS = hasS ? size : capY + capH - 5;
  ctx.strokeStyle = PALETTE.SLATE_MID;
  ctx.lineWidth = 1.2;
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

  // 4. Unified central rune medallion at the shared center of a 2x2 pillar (or tile center if 1x1)
  const runeCx = hasE && !hasW ? size : hasW && !hasE ? 0 : 16;
  const runeCy = hasS && !hasN ? size : hasN && !hasS ? 0 : 13;
  ctx.save();
  ctx.beginPath();
  ctx.rect(capX, capY, capW, capH);
  ctx.clip();

  ctx.beginPath();
  ctx.arc(runeCx, runeCy, 7.2, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.SLATE_DARK;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = PALETTE.INK_DARK;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(runeCx, runeCy, 4.4, 0, Math.PI * 2);
  ctx.fillStyle = BIOME_THEMES[biome].accentGlow;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = PALETTE.INK_DARK;
  ctx.stroke();
  ctx.restore();

  // 5. 3D South Cliff Face when !hasS
  if (!hasS) {
    const cliffY = size - cliffH - 1.5;
    ctx.fillStyle = PALETTE.STEEL_DARK;
    ctx.fillRect(capX, cliffY, capW, cliffH);
    ctx.fillStyle = PALETTE.SLATE_DARK;
    ctx.fillRect(capX, cliffY + cliffH - 2, capW, 2);

    // Vertical fluting lines on pillar cliff face
    ctx.beginPath();
    ctx.moveTo(10, cliffY + 0.5);
    ctx.lineTo(10, cliffY + cliffH - 0.5);
    ctx.moveTo(22, cliffY + 0.5);
    ctx.lineTo(22, cliffY + cliffH - 0.5);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();
  }

  // 6. Dark outlines ONLY along exposed edges of the pillar
  ctx.beginPath();
  if (!hasN) {
    ctx.moveTo(capX, capY);
    ctx.lineTo(capX + capW, capY);
  }
  if (!hasW) {
    ctx.moveTo(capX, capY);
    ctx.lineTo(capX, hasS ? size : size - 1.5);
  }
  if (!hasE) {
    ctx.moveTo(capX + capW, capY);
    ctx.lineTo(capX + capW, hasS ? size : size - 1.5);
  }
  if (!hasS) {
    const cliffY = size - cliffH - 1.5;
    ctx.moveTo(capX, cliffY);
    ctx.lineTo(capX + capW, cliffY);
    ctx.moveTo(capX, size - 1.5);
    ctx.lineTo(capX + capW, size - 1.5);
  }
  ctx.lineWidth = 2.0;
  ctx.strokeStyle = PALETTE.INK_DARK;
  ctx.stroke();

  ctx.restore();
  registerCanvasTexture(scene, key, canvas);
}

export function bakeCrackedWallTile(scene: Phaser.Scene, biome: 1 | 2 | 3, scale: number): void {
  const key = TextureBaker.getCrackedWallTextureKey(biome);
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size * scale);
  canvas.height = Math.ceil(size * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.save();
  ctx.scale(scale, scale);

  ctx.fillStyle = PALETTE.INK_DEEP;
  ctx.fillRect(0, 0, size, size);

  outlined(
    ctx,
    {
      fill:
        biome === 2 ? PALETTE.COBALT_SHADE : biome === 3 ? PALETTE.STEEL_DARK : PALETTE.SLATE_MID,
      shade:
        biome === 2 ? PALETTE.ABYSS_BLUE : biome === 3 ? PALETTE.FORGE_DARK : PALETTE.SLATE_DARK,
      highlight:
        biome === 2
          ? PALETTE.CYAN_FROST
          : biome === 3
            ? PALETTE.COPPER_LIGHT
            : PALETTE.WARM_STONE,
      outlineColor: PALETTE.INK_DARK,
      outlineWidth: 2.0,
    },
    (c) => traceRoundedRect(c, 1.5, 1.5, size - 3, size - 6, 3),
    { cx: 16, cy: 13, rx: 14, ry: 12 },
  );

  // Glowing secret fracture fissures indicating destructible wall
  ctx.beginPath();
  ctx.moveTo(8, 5);
  ctx.lineTo(15, 12);
  ctx.lineTo(12, 20);
  ctx.lineTo(21, 25);
  ctx.moveTo(15, 12);
  ctx.lineTo(24, 9);
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = PALETTE.INK_DARK;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.lineWidth = 1.4;
  ctx.strokeStyle = PALETTE.SOLAR_GOLD;
  ctx.stroke();

  ctx.restore();
  registerCanvasTexture(scene, key, canvas);
}

/**
 * Bakes directional ambient occlusion / drop-shadow overlay cast by North, West, and North-West walls.
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
    const gradN = ctx.createLinearGradient(0, 0, 0, 13);
    gradN.addColorStop(0, 'rgba(11, 9, 14, 0.52)');
    gradN.addColorStop(1, 'rgba(11, 9, 14, 0)');
    ctx.fillStyle = gradN;
    ctx.fillRect(0, 0, size, 13);
  }

  if (aoMask & WALL_AO_WEST) {
    const gradW = ctx.createLinearGradient(0, 0, 11, 0);
    gradW.addColorStop(0, 'rgba(11, 9, 14, 0.44)');
    gradW.addColorStop(1, 'rgba(11, 9, 14, 0)');
    ctx.fillStyle = gradW;
    ctx.fillRect(0, 0, 11, size);
  }

  if (aoMask & WALL_AO_NORTH_WEST && !(aoMask & WALL_AO_NORTH) && !(aoMask & WALL_AO_WEST)) {
    const gradNW = ctx.createRadialGradient(0, 0, 1, 0, 0, 13);
    gradNW.addColorStop(0, 'rgba(11, 9, 14, 0.45)');
    gradNW.addColorStop(1, 'rgba(11, 9, 14, 0)');
    ctx.fillStyle = gradNW;
    ctx.fillRect(0, 0, 13, 13);
  }

  ctx.restore();
  registerCanvasTexture(scene, key, canvas);
}
