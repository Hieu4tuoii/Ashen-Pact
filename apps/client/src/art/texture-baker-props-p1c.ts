import type Phaser from 'phaser';
import { PALETTE } from './palette.js';
import { outlined, tracePolygon, traceRoundedRect } from './primitives.js';
import { bakeCustomCanvas } from './texture-baker-canvas.js';

export function bakeP1CProps(scene: Phaser.Scene, scale: number): void {
  // 1. Biome 2 Barricade: glacial_barricade ('low' | 'flipped' | 'sliding') — Runic Permafrost Obelisk / Cryo Shard Cluster
  bakeCustomCanvas(scene, 'prop_glacial_barricade', 44, 38, scale, (ctx) => {
    // 1. Frozen abyssal permafrost plinth
    outlined(
      ctx,
      {
        fill: PALETTE.ABYSS_BLUE,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.COBALT_SHADE,
        outlineWidth: 2.4,
      },
      (c) =>
        tracePolygon(c, [
          { x: -13, y: -11 },
          { x: 13, y: -11 },
          { x: 19, y: -2 },
          { x: 16, y: 11 },
          { x: 7, y: 14 },
          { x: -7, y: 14 },
          { x: -16, y: 11 },
          { x: -19, y: -2 },
        ]),
      { cx: 0, cy: 2, rx: 19, ry: 13 },
    );

    // 2. Flanking angled secondary frost shards
    outlined(
      ctx,
      {
        fill: PALETTE.COBALT_SHADE,
        shade: PALETTE.ABYSS_BLUE,
        highlight: PALETTE.CYAN_FROST,
        material: 'crystal',
        outlineWidth: 2.1,
      },
      (c) =>
        tracePolygon(c, [
          { x: -17, y: -10 },
          { x: -7, y: -14 },
          { x: -3, y: -2 },
          { x: 3, y: -2 },
          { x: 8, y: -14 },
          { x: 17, y: -9 },
          { x: 14, y: 9 },
          { x: -14, y: 9 },
        ]),
      { cx: 0, cy: -2, rx: 17, ry: 12 },
    );

    // 3. Central multi-faceted hexagonal cryo obelisk
    outlined(
      ctx,
      {
        fill: PALETTE.AZURE_CORE,
        shade: PALETTE.COBALT_SHADE,
        highlight: PALETTE.ICE_WHITE,
        material: 'crystal',
        outlineWidth: 2.5,
      },
      (c) =>
        tracePolygon(c, [
          { x: 0, y: -16 },
          { x: 10, y: -9 },
          { x: 12, y: 3 },
          { x: 7, y: 12 },
          { x: -7, y: 12 },
          { x: -12, y: 3 },
          { x: -10, y: -9 },
        ]),
      { cx: 0, cy: -1, rx: 12, ry: 14 },
    );

    // Internal refraction facet & diamond cryo-rune core
    ctx.fillStyle = PALETTE.CYAN_FROST;
    tracePolygon(ctx, [
      { x: 0, y: -14 },
      { x: 7, y: -7 },
      { x: 0, y: -1 },
      { x: -7, y: -7 },
    ]);
    ctx.fill();

    ctx.fillStyle = PALETTE.ICE_WHITE;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.lineWidth = 1.5;
    tracePolygon(ctx, [
      { x: 0, y: -5 },
      { x: 5, y: 1 },
      { x: 0, y: 7 },
      { x: -5, y: 1 },
    ]);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = PALETTE.ICE_WHITE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.lineTo(0, -15);
    ctx.lineTo(9, -8);
    ctx.moveTo(-10, 3);
    ctx.lineTo(-5, 1);
    ctx.moveTo(10, 3);
    ctx.lineTo(5, 1);
    ctx.stroke();
  });

  bakeCustomCanvas(scene, 'prop_glacial_barricade_flipped', 44, 42, scale, (ctx) => {
    // 1. Heavy hexagonal permafrost base
    outlined(
      ctx,
      {
        fill: PALETTE.ABYSS_BLUE,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.COBALT_SHADE,
        outlineWidth: 2.5,
      },
      (c) =>
        tracePolygon(c, [
          { x: -14, y: -11 },
          { x: 14, y: -11 },
          { x: 19, y: 0 },
          { x: 16, y: 13 },
          { x: 7, y: 16 },
          { x: -7, y: 16 },
          { x: -16, y: 13 },
          { x: -19, y: 0 },
        ]),
      { cx: 0, cy: 3, rx: 19, ry: 14 },
    );

    // 2. Twin outer jagged crystal spires
    outlined(
      ctx,
      {
        fill: PALETTE.COBALT_SHADE,
        shade: PALETTE.ABYSS_BLUE,
        highlight: PALETTE.CYAN_FROST,
        material: 'crystal',
        outlineWidth: 2.2,
      },
      (c) =>
        tracePolygon(c, [
          { x: -18, y: -6 },
          { x: -11, y: -17 },
          { x: -3, y: -8 },
          { x: 3, y: -8 },
          { x: 11, y: -17 },
          { x: 18, y: -6 },
          { x: 15, y: 11 },
          { x: -15, y: 11 },
        ]),
      { cx: 0, cy: -2, rx: 18, ry: 14 },
    );

    // 3. Awakened central Runic Permafrost Obelisk
    outlined(
      ctx,
      {
        fill: PALETTE.AZURE_CORE,
        shade: PALETTE.COBALT_SHADE,
        highlight: PALETTE.ICE_WHITE,
        material: 'crystal',
        outlineWidth: 2.6,
      },
      (c) =>
        tracePolygon(c, [
          { x: 0, y: -18 },
          { x: 9, y: -10 },
          { x: 11, y: 4 },
          { x: 6, y: 13 },
          { x: -6, y: 13 },
          { x: -11, y: 4 },
          { x: -9, y: -10 },
        ]),
      { cx: 0, cy: -2, rx: 11, ry: 15 },
    );

    // Charged prism core & facet ridges
    outlined(
      ctx,
      {
        fill: PALETTE.ICE_WHITE,
        shade: PALETTE.CYAN_FROST,
        outlineWidth: 1.7,
      },
      (c) =>
        tracePolygon(c, [
          { x: 0, y: -8 },
          { x: 6, y: 0 },
          { x: 0, y: 8 },
          { x: -6, y: 0 },
        ]),
      { cx: 0, cy: 0, rx: 6, ry: 8 },
    );

    ctx.strokeStyle = PALETTE.ICE_WHITE;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(0, -8);
    ctx.moveTo(-10, -4);
    ctx.lineTo(-6, 0);
    ctx.moveTo(10, -4);
    ctx.lineTo(6, 0);
    ctx.stroke();
  });

  bakeCustomCanvas(scene, 'prop_glacial_barricade_sliding', 44, 40, scale, (ctx) => {
    ctx.save();
    ctx.rotate(-0.14);

    // 1. Forward-canted permafrost ram hull
    outlined(
      ctx,
      {
        fill: PALETTE.COBALT_SHADE,
        shade: PALETTE.ABYSS_BLUE,
        highlight: PALETTE.CYAN_FROST,
        material: 'crystal',
        outlineWidth: 2.4,
      },
      (c) =>
        tracePolygon(c, [
          { x: -15, y: -12 },
          { x: 8, y: -14 },
          { x: 19, y: -5 },
          { x: 19, y: 5 },
          { x: 8, y: 14 },
          { x: -15, y: 12 },
          { x: -19, y: 4 },
          { x: -19, y: -4 },
        ]),
      { cx: 0, cy: 0, rx: 19, ry: 14 },
    );

    // 2. Leading razor crystal spearhead
    outlined(
      ctx,
      {
        fill: PALETTE.CYAN_FROST,
        shade: PALETTE.AZURE_CORE,
        highlight: PALETTE.ICE_WHITE,
        material: 'crystal',
        outlineWidth: 2.5,
      },
      (c) =>
        tracePolygon(c, [
          { x: -10, y: -9 },
          { x: 6, y: -10 },
          { x: 16, y: 0 },
          { x: 6, y: 10 },
          { x: -10, y: 9 },
          { x: -14, y: 0 },
        ]),
      { cx: 1, cy: 0, rx: 15, ry: 10 },
    );

    // 3. Glowing cryo diamond & frost-wake slipstreams
    ctx.fillStyle = PALETTE.ICE_WHITE;
    tracePolygon(ctx, [
      { x: 2, y: -5 },
      { x: 10, y: 0 },
      { x: 2, y: 5 },
      { x: -5, y: 0 },
    ]);
    ctx.fill();

    ctx.strokeStyle = PALETTE.ICE_WHITE;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(-17, -6);
    ctx.lineTo(-4, -6);
    ctx.moveTo(-17, 6);
    ctx.lineTo(-4, 6);
    ctx.stroke();

    ctx.restore();
  });

  // 2. Biome 2 Shattered Ice Spike Pillar: glacial_spike
  bakeCustomCanvas(scene, 'prop_glacial_spike', 34, 42, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.CYAN_FROST,
        shade: PALETTE.COBALT_SHADE,
        highlight: PALETTE.ICE_WHITE,
        outlineWidth: 2.4,
      },
      (c) =>
        tracePolygon(c, [
          { x: 0, y: -17 },
          { x: 10, y: -2 },
          { x: 8, y: 14 },
          { x: -8, y: 14 },
          { x: -10, y: -2 },
        ]),
      { cx: 0, cy: 0, rx: 10, ry: 16 },
    );
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(0, 11);
    ctx.strokeStyle = PALETTE.ICE_WHITE;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  });

  // 3. Biome 2 Toy: sliding_ice_block
  bakeCustomCanvas(scene, 'prop_sliding_ice_block', 38, 38, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.AZURE_CORE,
        shade: PALETTE.COBALT_SHADE,
        highlight: PALETTE.CYAN_FROST,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -14, -14, 28, 28, 5),
      { cx: 0, cy: 0, rx: 14, ry: 14 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.ICE_WHITE,
        shade: PALETTE.CYAN_FROST,
        outlineWidth: 1.6,
      },
      (c) =>
        tracePolygon(c, [
          { x: 0, y: -7 },
          { x: 7, y: 0 },
          { x: 0, y: 7 },
          { x: -7, y: 0 },
        ]),
      { cx: 0, cy: 0, rx: 7, ry: 7 },
    );
  });

  // 4. Biome 2 Pillar Toy: cryo_prism_pillar
  bakeCustomCanvas(scene, 'prop_cryo_prism_pillar', 42, 48, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_MID,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.STEEL_LIGHT,
        outlineWidth: 2.4,
      },
      (c) => traceRoundedRect(c, -14, 6, 28, 12, 4),
      { cx: 0, cy: 12, rx: 14, ry: 6 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.CYAN_FROST,
        shade: PALETTE.AZURE_CORE,
        highlight: PALETTE.ICE_WHITE,
        outlineWidth: 2.5,
      },
      (c) =>
        tracePolygon(c, [
          { x: 0, y: -20 },
          { x: 12, y: -7 },
          { x: 10, y: 11 },
          { x: 0, y: 15 },
          { x: -10, y: 11 },
          { x: -12, y: -7 },
        ]),
      { cx: 0, cy: -2, rx: 12, ry: 17 },
    );
    ctx.beginPath();
    ctx.arc(0, -3, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.ICE_WHITE;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();
  });

  // 5. Biome 3 Barricade: forge_blast_shield ('low' | 'flipped' | 'sliding') — Magma Core Anvil / Pressurized Dwarven Slag Cylinder
  bakeCustomCanvas(scene, 'prop_forge_blast_shield', 44, 38, scale, (ctx) => {
    // 1. Heavy octagonal Dwarven dark-steel containment hull with horned anvil shoulders
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_DARK,
        shade: PALETTE.FORGE_DARK,
        highlight: PALETTE.STEEL_LIGHT,
        material: 'metal',
        outlineWidth: 2.5,
      },
      (c) =>
        tracePolygon(c, [
          { x: -13, y: -14 },
          { x: 13, y: -14 },
          { x: 19, y: -7 },
          { x: 16, y: 0 },
          { x: 19, y: 7 },
          { x: 13, y: 14 },
          { x: -13, y: 14 },
          { x: -19, y: 7 },
          { x: -16, y: 0 },
          { x: -19, y: -7 },
        ]),
      { cx: 0, cy: 0, rx: 19, ry: 14 },
    );

    // 2. Riveted brass pressure frame
    outlined(
      ctx,
      {
        fill: PALETTE.BRASS_CORE,
        shade: PALETTE.BRONZE_SHADE,
        highlight: PALETTE.COPPER_LIGHT,
        material: 'metal',
        outlineWidth: 2.1,
      },
      (c) =>
        tracePolygon(c, [
          { x: -10, y: -11 },
          { x: 10, y: -11 },
          { x: 14, y: -5 },
          { x: 14, y: 5 },
          { x: 10, y: 11 },
          { x: -10, y: 11 },
          { x: -14, y: 5 },
          { x: -14, y: -5 },
        ]),
      { cx: 0, cy: 0, rx: 14, ry: 11 },
    );

    // 3. Recessed hexagonal incandescent magma furnace core
    outlined(
      ctx,
      {
        fill: PALETTE.MAGMA_RED,
        shade: PALETTE.RUBY_DARK,
        highlight: PALETTE.FLAME_ORANGE,
        outlineWidth: 2.0,
      },
      (c) =>
        tracePolygon(c, [
          { x: -6, y: -7 },
          { x: 6, y: -7 },
          { x: 10, y: 0 },
          { x: 6, y: 7 },
          { x: -6, y: 7 },
          { x: -10, y: 0 },
        ]),
      { cx: 0, cy: 0, rx: 10, ry: 7 },
    );

    // Molten solar heart & thermal vent bars
    ctx.fillStyle = PALETTE.SOLAR_GOLD;
    tracePolygon(ctx, [
      { x: -4, y: -3 },
      { x: 4, y: -3 },
      { x: 6, y: 0 },
      { x: 4, y: 3 },
      { x: -4, y: 3 },
      { x: -6, y: 0 },
    ]);
    ctx.fill();

    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-3, -6);
    ctx.lineTo(-3, 6);
    ctx.moveTo(3, -6);
    ctx.lineTo(3, 6);
    ctx.stroke();

    for (const [rx, ry] of [
      [-11, -8],
      [11, -8],
      [-11, 8],
      [11, 8],
    ] as const) {
      ctx.beginPath();
      ctx.arc(rx, ry, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.SILVER_BRIGHT;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();
    }
  });

  bakeCustomCanvas(scene, 'prop_forge_blast_shield_flipped', 44, 42, scale, (ctx) => {
    // 1. Reinforced octagonal Dwarven blast-anvil hull
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_DARK,
        shade: PALETTE.FORGE_DARK,
        highlight: PALETTE.STEEL_LIGHT,
        material: 'metal',
        outlineWidth: 2.6,
      },
      (c) =>
        tracePolygon(c, [
          { x: -14, y: -16 },
          { x: 14, y: -16 },
          { x: 20, y: -8 },
          { x: 17, y: 0 },
          { x: 20, y: 8 },
          { x: 14, y: 16 },
          { x: -14, y: 16 },
          { x: -20, y: 8 },
          { x: -17, y: 0 },
          { x: -20, y: -8 },
        ]),
      { cx: 0, cy: 0, rx: 20, ry: 16 },
    );

    // 2. Flared brass heat-sink shoulders
    outlined(
      ctx,
      {
        fill: PALETTE.BRASS_CORE,
        shade: PALETTE.BRONZE_SHADE,
        highlight: PALETTE.COPPER_LIGHT,
        material: 'metal',
        outlineWidth: 2.2,
      },
      (c) =>
        tracePolygon(c, [
          { x: -11, y: -13 },
          { x: 11, y: -13 },
          { x: 16, y: -6 },
          { x: 16, y: 6 },
          { x: 11, y: 13 },
          { x: -11, y: 13 },
          { x: -16, y: 6 },
          { x: -16, y: -6 },
        ]),
      { cx: 0, cy: 0, rx: 16, ry: 13 },
    );

    // 3. Blazing overcharged magma furnace aperture
    outlined(
      ctx,
      {
        fill: PALETTE.FLAME_ORANGE,
        shade: PALETTE.MAGMA_RED,
        highlight: PALETTE.SOLAR_GOLD,
        outlineWidth: 2.0,
      },
      (c) =>
        tracePolygon(c, [
          { x: -7, y: -8 },
          { x: 7, y: -8 },
          { x: 11, y: 0 },
          { x: 7, y: 8 },
          { x: -7, y: 8 },
          { x: -11, y: 0 },
        ]),
      { cx: 0, cy: 0, rx: 11, ry: 8 },
    );

    ctx.fillStyle = PALETTE.SOLAR_GOLD;
    tracePolygon(ctx, [
      { x: 0, y: -5 },
      { x: 7, y: 0 },
      { x: 0, y: 5 },
      { x: -7, y: 0 },
    ]);
    ctx.fill();

    ctx.strokeStyle = PALETTE.BONE_WHITE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.moveTo(0, -4);
    ctx.lineTo(0, 4);
    ctx.stroke();
  });

  bakeCustomCanvas(scene, 'prop_forge_blast_shield_sliding', 44, 40, scale, (ctx) => {
    ctx.save();
    ctx.rotate(-0.12);

    // 1. Rocket-ramming octagonal Dwarven slag cylinder
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_DARK,
        shade: PALETTE.FORGE_DARK,
        highlight: PALETTE.STEEL_LIGHT,
        material: 'metal',
        outlineWidth: 2.5,
      },
      (c) =>
        tracePolygon(c, [
          { x: -14, y: -14 },
          { x: 12, y: -14 },
          { x: 19, y: -6 },
          { x: 19, y: 6 },
          { x: 12, y: 14 },
          { x: -14, y: 14 },
          { x: -19, y: 7 },
          { x: -19, y: -7 },
        ]),
      { cx: 0, cy: 0, rx: 19, ry: 14 },
    );

    // 2. Pressurized brass ramming collar
    outlined(
      ctx,
      {
        fill: PALETTE.BRASS_CORE,
        shade: PALETTE.BRONZE_SHADE,
        highlight: PALETTE.COPPER_LIGHT,
        material: 'metal',
        outlineWidth: 2.1,
      },
      (c) =>
        tracePolygon(c, [
          { x: -10, y: -10 },
          { x: 10, y: -10 },
          { x: 15, y: 0 },
          { x: 10, y: 10 },
          { x: -10, y: 10 },
          { x: -14, y: 0 },
        ]),
      { cx: 0, cy: 0, rx: 15, ry: 10 },
    );

    // 3. Surging molten magma core & thermal plasma plumes
    outlined(
      ctx,
      {
        fill: PALETTE.FLAME_ORANGE,
        shade: PALETTE.MAGMA_RED,
        highlight: PALETTE.SOLAR_GOLD,
        outlineWidth: 1.9,
      },
      (c) =>
        tracePolygon(c, [
          { x: -5, y: -6 },
          { x: 7, y: -6 },
          { x: 11, y: 0 },
          { x: 7, y: 6 },
          { x: -5, y: 6 },
          { x: -9, y: 0 },
        ]),
      { cx: 1, cy: 0, rx: 10, ry: 6 },
    );

    ctx.fillStyle = PALETTE.SOLAR_GOLD;
    tracePolygon(ctx, [
      { x: 0, y: -3 },
      { x: 8, y: 0 },
      { x: 0, y: 3 },
      { x: -5, y: 0 },
    ]);
    ctx.fill();

    ctx.strokeStyle = PALETTE.SOLAR_GOLD;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-18, -5);
    ctx.lineTo(-7, -5);
    ctx.moveTo(-18, 5);
    ctx.lineTo(-7, 5);
    ctx.stroke();

    ctx.restore();
  });

  // 6. Biome 3 Mechanism Toy: pneumatic_press (idle & slammed)
  for (const [key, isSlammed] of [
    ['prop_pneumatic_press', false],
    ['prop_pneumatic_press_slammed', true],
  ] as const) {
    bakeCustomCanvas(scene, key, 46, 48, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.STEEL_DARK,
          shade: PALETTE.SLATE_DARK,
          highlight: PALETTE.BRASS_CORE,
          outlineWidth: 2.6,
        },
        (c) => traceRoundedRect(c, -18, -16, 36, 32, 5),
        { cx: 0, cy: 0, rx: 18, ry: 16 },
      );
      outlined(
        ctx,
        {
          fill: isSlammed ? PALETTE.FLAME_ORANGE : PALETTE.BRASS_CORE,
          shade: PALETTE.RUBY_DARK,
          highlight: PALETTE.SOLAR_GOLD,
          outlineWidth: 2.2,
        },
        (c) => {
          c.beginPath();
          c.arc(0, isSlammed ? 2 : -3, 10.5, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 0, cy: isSlammed ? 2 : -3, rx: 10.5, ry: 10.5 },
      );
      ctx.beginPath();
      ctx.arc(0, isSlammed ? 2 : -3, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isSlammed ? PALETTE.SOLAR_GOLD : PALETTE.CRIMSON_BRIGHT;
      ctx.fill();
    });
  }

  // 7. Biome 3 Hazard Toy: slag_crucible
  bakeCustomCanvas(scene, 'prop_slag_crucible', 38, 40, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.BRASS_CORE,
        outlineWidth: 2.5,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 1, 14, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 1, rx: 14, ry: 14 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.FLAME_ORANGE,
        shade: PALETTE.MAGMA_RED,
        highlight: PALETTE.SOLAR_GOLD,
        outlineWidth: 1.8,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 8.5, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 8.5, ry: 8.5 },
    );
  });

  // 8. P2A Daedalus Anvil (`prop_daedalus_anvil`) — Ancient Golden-Rune Forge Anvil + Hammer
  bakeCustomCanvas(scene, 'prop_daedalus_anvil', 48, 46, scale, (ctx) => {
    // Stone & brass base pedestal
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.BRASS_CORE,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -18, 5, 36, 13, 4),
      { cx: 0, cy: 11, rx: 18, ry: 7 },
    );
    // Anvil waist column
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.STEEL_LIGHT,
        outlineWidth: 2.2,
      },
      (c) => traceRoundedRect(c, -10, -4, 20, 12, 3),
      { cx: 0, cy: 2, rx: 10, ry: 6 },
    );
    // Horned anvil top table
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_LIGHT,
        shade: PALETTE.STEEL_DARK,
        highlight: PALETTE.SOLAR_GOLD,
        outlineWidth: 2.6,
      },
      (c) =>
        tracePolygon(c, [
          { x: -21, y: -8 },
          { x: -11, y: -13 },
          { x: 14, y: -13 },
          { x: 20, y: -9 },
          { x: 14, y: -3 },
          { x: -12, y: -3 },
        ]),
      { cx: 0, cy: -8, rx: 20, ry: 6 },
    );
    // Glowing Daedalus solar-gold rune fissure across anvil waist & face
    ctx.strokeStyle = PALETTE.FLAME_ORANGE;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.lineTo(8, -8);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 9);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.SOLAR_GOLD;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(7, -8);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();
    // Resting golden forge hammer on top
    ctx.save();
    ctx.translate(2, -14);
    ctx.rotate(-0.28);
    outlined(
      ctx,
      {
        fill: PALETTE.LEATHER_MID,
        shade: PALETTE.LEATHER_DARK,
        highlight: PALETTE.COPPER_LIGHT,
        outlineWidth: 1.8,
      },
      (c) => traceRoundedRect(c, -2, -1, 13, 3.5, 1.5),
      { cx: 4, cy: 0, rx: 6, ry: 2 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.SOLAR_GOLD,
        shade: PALETTE.FLAME_ORANGE,
        highlight: PALETTE.BONE_WHITE,
        outlineWidth: 2.0,
      },
      (c) => traceRoundedRect(c, -7, -4.5, 8, 9, 2),
      { cx: -3, cy: 0, rx: 4, ry: 4.5 },
    );
    ctx.restore();
  });

  // 9. P2A Upgrade Anvil (`prop_upgrade_anvil`) — Tempered Cyan-Frost Whetstone Anvil
  bakeCustomCanvas(scene, 'prop_upgrade_anvil', 48, 46, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.STEEL_LIGHT,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -17, 5, 34, 13, 4),
      { cx: 0, cy: 11, rx: 17, ry: 7 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_DARK,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.CYAN_FROST,
        outlineWidth: 2.4,
      },
      (c) =>
        tracePolygon(c, [
          { x: -19, y: -7 },
          { x: -10, y: -12 },
          { x: 13, y: -12 },
          { x: 18, y: -7 },
          { x: 12, y: -2 },
          { x: -11, y: -2 },
        ]),
      { cx: 0, cy: -7, rx: 18, ry: 6 },
    );
    // Glowing cyan whetstone crystal bar on top
    outlined(
      ctx,
      {
        fill: PALETTE.CYAN_FROST,
        shade: PALETTE.AZURE_CORE,
        highlight: PALETTE.BONE_WHITE,
        outlineWidth: 1.8,
      },
      (c) => traceRoundedRect(c, -8, -15, 16, 5, 2),
      { cx: 0, cy: -12.5, rx: 8, ry: 3 },
    );
  });

  // 10. Merchant Shop Icons: `item_blessing_scroll` & `item_weapon_upgrade`
  bakeCustomCanvas(scene, 'item_blessing_scroll', 30, 30, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: '#E2D5B5',
        shade: '#B89F72',
        highlight: PALETTE.BONE_WHITE,
        outlineWidth: 2.2,
      },
      (c) => traceRoundedRect(c, -9, -11, 18, 22, 4),
      { cx: 0, cy: 0, rx: 9, ry: 11 },
    );
    ctx.fillStyle = PALETTE.CRIMSON_BRIGHT;
    ctx.beginPath();
    ctx.arc(0, 1, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.SOLAR_GOLD;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  });

  bakeCustomCanvas(scene, 'item_weapon_upgrade', 30, 30, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.CYAN_FROST,
        shade: PALETTE.AZURE_CORE,
        highlight: PALETTE.BONE_WHITE,
        outlineWidth: 2.2,
      },
      (c) =>
        tracePolygon(c, [
          { x: 0, y: -12 },
          { x: 10, y: -3 },
          { x: 6, y: 11 },
          { x: -6, y: 11 },
          { x: -10, y: -3 },
        ]),
      { cx: 0, cy: 0, rx: 10, ry: 11 },
    );
    ctx.fillStyle = PALETTE.SOLAR_GOLD;
    ctx.beginPath();
    ctx.arc(0, -1, 3.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // 11. Phase 4B Secret Skill Arena Crystal (`prop_secret_challenge_crystal` & `_used`)
  bakeCustomCanvas(scene, 'prop_secret_challenge_crystal', 48, 56, scale, (ctx) => {
    // Obsidian octagonal rune pedestal base
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.STEEL_LIGHT,
        outlineWidth: 2.2,
      },
      (c) =>
        tracePolygon(c, [
          { x: -13, y: 12 },
          { x: 13, y: 12 },
          { x: 17, y: 18 },
          { x: 12, y: 23 },
          { x: -12, y: 23 },
          { x: -17, y: 18 },
        ]),
      { cx: 0, cy: 17.5, rx: 16, ry: 5.5 },
    );
    ctx.strokeStyle = PALETTE.SOLAR_GOLD;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-9, 17.5);
    ctx.lineTo(9, 17.5);
    ctx.stroke();

    // Floating prismatic violet-gold obelisk crystal + 2 side shards
    for (const side of [-1, 1] as const) {
      outlined(
        ctx,
        {
          fill: PALETTE.ELECTRIC_VIOLET,
          shade: '#581C87',
          highlight: PALETTE.BONE_WHITE,
          outlineWidth: 1.8,
        },
        (c) =>
          tracePolygon(c, [
            { x: side * 13, y: -6 },
            { x: side * 16.5, y: 0 },
            { x: side * 13.5, y: 7 },
            { x: side * 10.5, y: 1 },
          ]),
        { cx: side * 13.5, cy: 0.5, rx: 3.5, ry: 6.5 },
      );
    }

    outlined(
      ctx,
      {
        fill: PALETTE.ELECTRIC_VIOLET,
        shade: '#4C1D95',
        highlight: PALETTE.BONE_WHITE,
        outlineWidth: 2.3,
      },
      (c) =>
        tracePolygon(c, [
          { x: 0, y: -22 },
          { x: 10, y: -7 },
          { x: 7, y: 7 },
          { x: 0, y: 12 },
          { x: -7, y: 7 },
          { x: -10, y: -7 },
        ]),
      { cx: 0, cy: -5, rx: 10, ry: 17 },
    );

    // Faceted Solar Gold diamond core & ridge line
    ctx.fillStyle = PALETTE.SOLAR_GOLD;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(4.5, -4);
    ctx.lineTo(0, 4);
    ctx.lineTo(-4.5, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.BONE_WHITE;
    ctx.beginPath();
    ctx.arc(0, -4, 1.8, 0, Math.PI * 2);
    ctx.fill();
  });

  bakeCustomCanvas(scene, 'prop_secret_challenge_crystal_used', 48, 56, scale, (ctx) => {
    // Dormant stone pedestal after the 20s trial has been triggered
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.STEEL_DARK,
        outlineWidth: 2.2,
      },
      (c) =>
        tracePolygon(c, [
          { x: -13, y: 12 },
          { x: 13, y: 12 },
          { x: 17, y: 18 },
          { x: 12, y: 23 },
          { x: -12, y: 23 },
          { x: -17, y: 18 },
        ]),
      { cx: 0, cy: 17.5, rx: 16, ry: 5.5 },
    );
    // Settled, unlit slate crystal remnant resting on the pedestal
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.STEEL_LIGHT,
        outlineWidth: 2.0,
      },
      (c) =>
        tracePolygon(c, [
          { x: 0, y: -4 },
          { x: 7.5, y: 5 },
          { x: 5.5, y: 13 },
          { x: -5.5, y: 13 },
          { x: -7.5, y: 5 },
        ]),
      { cx: 0, cy: 5, rx: 7.5, ry: 8.5 },
    );
  });
}
