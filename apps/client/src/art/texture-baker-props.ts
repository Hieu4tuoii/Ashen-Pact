import type Phaser from 'phaser';
import { PALETTE, type PaletteHex } from './palette.js';
import { outlined, tracePolygon, traceRoundedRect } from './primitives.js';
import { bakeCustomCanvas } from './texture-baker-canvas.js';
import { bakeP1CProps } from './texture-baker-props-p1c.js';

export function bakeProps(scene: Phaser.Scene, scale: number): void {
  bakeP1CProps(scene, scale);
  // 1. Wooden Crate
  bakeCustomCanvas(scene, 'prop_wooden_crate', 36, 36, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.LEATHER_MID,
        shade: PALETTE.LEATHER_DARK,
        highlight: PALETTE.LEATHER_LIGHT,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -13, -13, 26, 26, 3.5),
      { cx: 0, cy: 0, rx: 13, ry: 13 },
    );
    // Cross brace
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(10, 10);
    ctx.moveTo(10, -10);
    ctx.lineTo(-10, 10);
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();
  });

  // 2. Clay Vase
  bakeCustomCanvas(scene, 'prop_clay_vase', 32, 34, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.LEATHER_LIGHT,
        shade: PALETTE.LEATHER_MID,
        highlight: PALETTE.COPPER_LIGHT,
        outlineWidth: 2.5,
      },
      (c) => {
        c.beginPath();
        c.ellipse(0, 2, 10, 11, 0, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 2, rx: 10, ry: 11 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.SOLAR_GOLD,
        shade: PALETTE.BRASS_CORE,
        outlineWidth: 2.0,
      },
      (c) => traceRoundedRect(c, -6.5, -11, 13, 5, 2),
      { cx: 0, cy: -8.5, rx: 6.5, ry: 2.5 },
    );
  });

  // 3. Explosive Barrel
  bakeCustomCanvas(scene, 'prop_explosive_barrel', 36, 38, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.RUBY_CORE,
        shade: PALETTE.RUBY_DARK,
        highlight: PALETTE.CRIMSON_BRIGHT,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -12, -14, 24, 28, 6),
      { cx: 0, cy: 0, rx: 12, ry: 14 },
    );
    // Iron bands
    ctx.fillStyle = PALETTE.STEEL_DARK;
    ctx.fillRect(-11.5, -8, 23, 3);
    ctx.fillRect(-11.5, 5, 23, 3);
    // Glowing hazard core
    ctx.beginPath();
    ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.SOLAR_GOLD;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();
  });

  // 4. Torch Brazier
  bakeCustomCanvas(scene, 'prop_torch_brazier', 34, 38, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_DARK,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.STEEL_LIGHT,
        outlineWidth: 2.4,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 3, 10, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 3, rx: 10, ry: 10 },
    );
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
          { x: -7, y: 3 },
          { x: -4, y: -9 },
          { x: 0, y: -14 },
          { x: 5, y: -8 },
          { x: 7, y: 3 },
        ]),
      { cx: 0, cy: -4, rx: 7, ry: 9 },
    );
  });

  // 5. Bioluminescent Glow Mushroom
  bakeCustomCanvas(scene, 'prop_glow_mushroom', 32, 32, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.LIME_GLOW,
        shade: PALETTE.GOBLIN_GREEN,
        highlight: PALETTE.MINT_LIGHT,
        outlineWidth: 2.2,
      },
      (c) => {
        c.beginPath();
        c.arc(-2, -2, 8.5, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: -2, cy: -2, rx: 8.5, ry: 8.5 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.CYAN_FROST,
        shade: PALETTE.AZURE_CORE,
        highlight: PALETTE.ICE_WHITE,
        outlineWidth: 1.8,
      },
      (c) => {
        c.beginPath();
        c.arc(6, 4, 5.2, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 6, cy: 4, rx: 5.2, ry: 5.2 },
    );
  });

  // 5b. Ancient Mechanism (Engineer repairable turret base)
  bakeCustomCanvas(scene, 'prop_ancient_mechanism', 40, 40, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_DARK,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.STEEL_LIGHT,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -15, -15, 30, 30, 6),
      { cx: 0, cy: 0, rx: 15, ry: 15 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.BRASS_CORE,
        shade: PALETTE.LEATHER_MID,
        highlight: PALETTE.SOLAR_GOLD,
        outlineWidth: 2.0,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 9.5, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 9.5, ry: 9.5 },
    );
    ctx.beginPath();
    ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.CYAN_FROST;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();
  });

  // 5c. Crystal Pillar (Biome 2 Frozen Depths laser-reflecting ice prism)
  bakeCustomCanvas(scene, 'prop_crystal_pillar', 38, 44, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.COBALT_SHADE,
        shade: PALETTE.ABYSS_BLUE,
        highlight: PALETTE.CYAN_FROST,
        outlineWidth: 2.4,
      },
      (c) => traceRoundedRect(c, -13, 4, 26, 12, 4),
      { cx: 0, cy: 10, rx: 13, ry: 6 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.CYAN_FROST,
        shade: PALETTE.AZURE_CORE,
        highlight: PALETTE.ICE_WHITE,
        outlineWidth: 2.4,
      },
      (c) =>
        tracePolygon(c, [
          { x: 0, y: -18 },
          { x: 11, y: -6 },
          { x: 9, y: 11 },
          { x: 0, y: 15 },
          { x: -9, y: 11 },
          { x: -11, y: -6 },
        ]),
      { cx: 0, cy: -1, rx: 11, ry: 16 },
    );
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, 11);
    ctx.strokeStyle = PALETTE.BONE_WHITE;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  });

  // 5d. Co-op Pressure Plates (Inactive & Activated) and Pushable Stone Block
  bakeCustomCanvas(scene, 'prop_pressure_plate_off', 40, 40, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_MID,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.WARM_STONE,
        outlineWidth: 2.2,
      },
      (c) => traceRoundedRect(c, -16, -16, 32, 32, 6),
      { cx: 0, cy: 0, rx: 16, ry: 16 },
    );
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.strokeStyle = PALETTE.ASH_GRAY;
    ctx.lineWidth = 2.0;
    ctx.stroke();
  });

  bakeCustomCanvas(scene, 'prop_pressure_plate_on', 40, 40, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.FOREST_SHADE,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.LIME_GLOW,
        outlineWidth: 2.2,
      },
      (c) => traceRoundedRect(c, -16, -16, 32, 32, 6),
      { cx: 0, cy: 0, rx: 16, ry: 16 },
    );
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.LIME_GLOW;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();
  });

  bakeCustomCanvas(scene, 'prop_push_block', 38, 38, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.WARM_STONE,
        shade: PALETTE.SLATE_MID,
        highlight: PALETTE.BONE_WHITE,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -15, -15, 30, 30, 4),
      { cx: 0, cy: 0, rx: 15, ry: 15 },
    );
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.SOLAR_GOLD;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = PALETTE.INK_DARK;
    ctx.stroke();
  });

  // 5e. Ashen Pact 2.0 Biome 1 Tactical Props (moss_table 3 states, volatile_spore_pod, rotten_totem_pillar)
  bakeCustomCanvas(scene, 'prop_moss_table', 40, 36, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_MID,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.WARM_STONE,
        outlineWidth: 2.4,
      },
      (c) => traceRoundedRect(c, -16, -12, 32, 24, 4),
      { cx: 0, cy: 0, rx: 16, ry: 12 },
    );
    ctx.fillStyle = PALETTE.GOBLIN_GREEN;
    ctx.beginPath();
    ctx.arc(-10, -7, 4.5, 0, Math.PI * 2);
    ctx.arc(9, 6, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.LIME_GLOW;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-12, -5);
    ctx.lineTo(-4, -2);
    ctx.stroke();
  });

  bakeCustomCanvas(scene, 'prop_moss_table_flipped', 42, 40, scale, (ctx) => {
    // Upright thick stone barricade with -135 deg top-left rim highlight & glowing moss veins
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.WARM_STONE,
        outlineWidth: 2.6,
      },
      (c) => traceRoundedRect(c, -17, -15, 34, 30, 3.5),
      { cx: 0, cy: 0, rx: 17, ry: 15 },
    );
    ctx.fillStyle = PALETTE.WARM_STONE;
    ctx.fillRect(-15, -13.5, 30, 4);
    ctx.strokeStyle = PALETTE.LIME_GLOW;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-11, -6);
    ctx.lineTo(-3, 2);
    ctx.lineTo(7, -4);
    ctx.moveTo(-5, 7);
    ctx.lineTo(9, 9);
    ctx.stroke();
  });

  bakeCustomCanvas(scene, 'prop_moss_table_sliding', 42, 38, scale, (ctx) => {
    ctx.save();
    ctx.rotate(-0.14);
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_MID,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.BONE_WHITE,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -16, -13, 32, 26, 3.5),
      { cx: 0, cy: 0, rx: 16, ry: 13 },
    );
    ctx.strokeStyle = PALETTE.LIME_GLOW;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(10, 4);
    ctx.stroke();
    ctx.restore();
  });

  bakeCustomCanvas(scene, 'prop_volatile_spore_pod', 38, 38, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.GOBLIN_GREEN,
        shade: PALETTE.FOREST_SHADE,
        highlight: PALETTE.LIME_GLOW,
        outlineWidth: 2.4,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 1, 13.5, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 1, rx: 13.5, ry: 13.5 },
    );
    for (const [px, py, pr] of [
      [-5, -4, 4.2],
      [6, -2, 3.6],
      [-1, 6, 3.8],
    ] as const) {
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.LIME_GLOW;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = PALETTE.INK_DARK;
      ctx.stroke();
    }
  });

  bakeCustomCanvas(scene, 'prop_rotten_totem_pillar', 40, 48, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.LEATHER_MID,
        shade: PALETTE.LEATHER_DARK,
        highlight: PALETTE.WARM_STONE,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -12, -20, 24, 40, 4.5),
      { cx: 0, cy: 0, rx: 12, ry: 20 },
    );
    ctx.fillStyle = PALETTE.LIME_GLOW;
    ctx.fillRect(-7, -11, 4.5, 3.5);
    ctx.fillRect(2.5, -11, 4.5, 3.5);
    ctx.strokeStyle = PALETTE.GOBLIN_GREEN;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-11, 4);
    ctx.lineTo(11, -2);
    ctx.moveTo(-9, 12);
    ctx.lineTo(9, 9);
    ctx.stroke();
  });

  bakeCustomCanvas(scene, 'prop_rotten_totem_pillar_fallen', 48, 36, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.LEATHER_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.LEATHER_MID,
        outlineWidth: 2.2,
      },
      (c) => traceRoundedRect(c, -19, -9, 38, 18, 4),
      { cx: 0, cy: 0, rx: 19, ry: 9 },
    );
    ctx.strokeStyle = PALETTE.LIME_GLOW;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-12, -3);
    ctx.lineTo(10, 4);
    ctx.stroke();
  });

  // 6. Phase 3 Treasure Chests (5 Rarities, Closed & Open)
  const chestRarities: readonly [string, PaletteHex, PaletteHex, PaletteHex][] = [
    ['common', PALETTE.STEEL_LIGHT, PALETTE.STEEL_DARK, PALETTE.BONE_WHITE],
    ['uncommon', PALETTE.GOBLIN_GREEN, PALETTE.FOREST_SHADE, PALETTE.LIME_GLOW],
    ['rare', PALETTE.AZURE_CORE, PALETTE.COBALT_SHADE, PALETTE.CYAN_FROST],
    ['epic', PALETTE.ELECTRIC_VIOLET, PALETTE.TOXIC_PURPLE, PALETTE.ICE_WHITE],
    ['legendary', PALETTE.SOLAR_GOLD, PALETTE.BRASS_CORE, PALETTE.VOLT_YELLOW],
  ];
  for (const [rarity, trimFill, trimShade, gemColor] of chestRarities) {
    bakeCustomCanvas(scene, `chest_closed_${rarity}`, 42, 36, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: PALETTE.LEATHER_LIGHT,
          outlineWidth: 2.5,
        },
        (c) => traceRoundedRect(c, -15, -11, 30, 22, 5),
        { cx: 0, cy: 0, rx: 15, ry: 11 },
      );
      outlined(
        ctx,
        {
          fill: trimFill,
          shade: trimShade,
          highlight: gemColor,
          outlineWidth: 1.8,
        },
        (c) => traceRoundedRect(c, -15, -3, 30, 5, 2),
        { cx: 0, cy: -0.5, rx: 15, ry: 2.5 },
      );
      outlined(
        ctx,
        {
          fill: gemColor,
          shade: trimFill,
          highlight: PALETTE.BONE_WHITE,
          outlineWidth: 1.8,
        },
        (c) => traceRoundedRect(c, -4, -5, 8, 9, 2.5),
        { cx: 0, cy: -0.5, rx: 4, ry: 4.5 },
      );
    });

    bakeCustomCanvas(scene, `chest_open_${rarity}`, 42, 38, scale, (ctx) => {
      outlined(
        ctx,
        {
          fill: PALETTE.LEATHER_DARK,
          shade: PALETTE.INK_DARK,
          highlight: PALETTE.LEATHER_MID,
          outlineWidth: 2.5,
        },
        (c) => traceRoundedRect(c, -15, -13, 30, 12, 4),
        { cx: 0, cy: -7, rx: 15, ry: 6 },
      );
      outlined(
        ctx,
        {
          fill: PALETTE.LEATHER_MID,
          shade: PALETTE.LEATHER_DARK,
          highlight: trimFill,
          outlineWidth: 2.5,
        },
        (c) => traceRoundedRect(c, -15, -2, 30, 14, 4),
        { cx: 0, cy: 5, rx: 15, ry: 7 },
      );
      outlined(
        ctx,
        {
          fill: gemColor,
          highlight: PALETTE.BONE_WHITE,
          outlineWidth: 1.6,
        },
        (c) => {
          c.beginPath();
          c.ellipse(0, -2, 9, 4, 0, 0, Math.PI * 2);
          c.closePath();
        },
        { cx: 0, cy: -2, rx: 9, ry: 4 },
      );
    });
  }

  // 7. Ashen Pact Altar (Tế Đàn Khế Ước Tro Tàn — Active Crimson-Violet & Used Purified State)
  for (const [key, isUsed] of [
    ['prop_shrine_statue', false],
    ['prop_shrine_statue_used', true],
  ] as const) {
    bakeCustomCanvas(scene, key, 56, 64, scale, (ctx) => {
      // Dark obsidian altar plinth with gold-crimson trim
      outlined(
        ctx,
        {
          fill: PALETTE.SLATE_DARK,
          shade: PALETTE.INK_DEEP,
          highlight: isUsed ? PALETTE.SLATE_MID : PALETTE.RUBY_CORE,
          outlineWidth: 2.5,
        },
        (c) => traceRoundedRect(c, -20, 8, 40, 15, 4),
        { cx: 0, cy: 15, rx: 20, ry: 7.5 },
      );
      // Horned obsidian-violet monolith body
      outlined(
        ctx,
        {
          fill: PALETTE.SLATE_DARK,
          shade: PALETTE.INK_DARK,
          highlight: isUsed ? PALETTE.SLATE_MID : PALETTE.ELECTRIC_VIOLET,
          outlineWidth: 2.5,
        },
        (c) =>
          tracePolygon(c, [
            { x: -13, y: 10 },
            { x: -17, y: -12 },
            { x: -9, y: -24 },
            { x: 0, y: -18 },
            { x: 9, y: -24 },
            { x: 17, y: -12 },
            { x: 13, y: 10 },
          ]),
        { cx: 0, cy: -7, rx: 17, ry: 18 },
      );
      // Central pact sigil core (glowing crimson-gold when active, calm slate-gold when used)
      outlined(
        ctx,
        {
          fill: isUsed ? PALETTE.SLATE_MID : PALETTE.CRIMSON_BRIGHT,
          shade: isUsed ? PALETTE.SLATE_DARK : PALETTE.RUBY_CORE,
          highlight: PALETTE.SOLAR_GOLD,
          outlineWidth: 1.8,
        },
        (c) =>
          tracePolygon(c, [
            { x: 0, y: -14 },
            { x: 7, y: -4 },
            { x: 0, y: 6 },
            { x: -7, y: -4 },
          ]),
        { cx: 0, cy: -4, rx: 7, ry: 10 },
      );
    });
  }

  // 7b. Merchant Shop Display Pedestal Mat ('item_shop_pedestal') for wares with costGold > 0
  bakeCustomCanvas(scene, 'item_shop_pedestal', 38, 24, scale, (ctx) => {
    // Outer braided gold rim
    outlined(
      ctx,
      {
        fill: PALETTE.SOLAR_GOLD,
        shade: PALETTE.BRASS_CORE,
        highlight: PALETTE.BONE_WHITE,
        outlineWidth: 2.0,
      },
      (c) => {
        c.beginPath();
        c.ellipse(0, 1, 16, 8.5, 0, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 1, rx: 16, ry: 8.5 },
    );
    // Inner dark crimson velvet cushion
    outlined(
      ctx,
      {
        fill: PALETTE.RUBY_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.RUBY_CORE,
        outlineWidth: 1.4,
      },
      (c) => {
        c.beginPath();
        c.ellipse(0, 0.5, 12.5, 6.0, 0, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0.5, rx: 12.5, ry: 6.0 },
    );
    // Two gleaming gold coins at front-right corner to unmistakably denote a priced shop ware
    for (const [cx, cy] of [
      [10.5, 5.2],
      [13.8, 3.8],
    ] as const) {
      outlined(
        ctx,
        {
          fill: PALETTE.SOLAR_GOLD,
          shade: PALETTE.BRASS_CORE,
          highlight: PALETTE.BONE_WHITE,
          outlineWidth: 1.3,
        },
        (c) => {
          c.beginPath();
          c.arc(cx, cy, 2.7, 0, Math.PI * 2);
          c.closePath();
        },
        { cx, cy, rx: 2.7, ry: 2.7 },
      );
    }
  });

  // 8. Dungeon Doors (Open & Locked) and Floor Portal
  bakeCustomCanvas(scene, 'door_open', 48, 48, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.FOREST_SHADE,
        shade: PALETTE.MOSS_DARK,
        highlight: PALETTE.LIME_GLOW,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -18, -14, 36, 28, 7),
      { cx: 0, cy: 0, rx: 18, ry: 14 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.LIME_GLOW,
        shade: PALETTE.GOBLIN_GREEN,
        highlight: PALETTE.MINT_LIGHT,
        outlineWidth: 1.6,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 6, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 6, ry: 6 },
    );
  });

  bakeCustomCanvas(scene, 'door_locked', 48, 48, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.STEEL_DARK,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -18, -14, 36, 28, 7),
      { cx: 0, cy: 0, rx: 18, ry: 14 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.RUBY_CORE,
        shade: PALETTE.RUBY_DARK,
        highlight: PALETTE.CRIMSON_BRIGHT,
        outlineWidth: 1.8,
      },
      (c) => traceRoundedRect(c, -12, -3, 24, 6, 2),
      { cx: 0, cy: 0, rx: 12, ry: 3 },
    );
  });

  bakeCustomCanvas(scene, 'portal_active', 64, 64, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.ELECTRIC_VIOLET,
        shade: PALETTE.TOXIC_PURPLE,
        highlight: PALETTE.CYAN_FROST,
        outlineWidth: 2.8,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 22, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 22, ry: 22 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.CYAN_FROST,
        shade: PALETTE.AZURE_CORE,
        highlight: PALETTE.ICE_WHITE,
        outlineWidth: 2.0,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 0, 12, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 0, rx: 12, ry: 12 },
    );
  });

  bakeCustomCanvas(scene, 'item_health_potion', 28, 28, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.CRIMSON_BRIGHT,
        shade: PALETTE.RUBY_CORE,
        highlight: PALETTE.BONE_WHITE,
        outlineWidth: 2.2,
      },
      (c) => {
        c.beginPath();
        c.arc(0, 2, 7.5, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: 2, rx: 7.5, ry: 7.5 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.SOLAR_GOLD,
        shade: PALETTE.BRASS_CORE,
        outlineWidth: 1.6,
      },
      (c) => traceRoundedRect(c, -3.5, -9, 7, 5, 1.5),
      { cx: 0, cy: -6.5, rx: 3.5, ry: 2.5 },
    );
  });

  bakeCustomCanvas(scene, 'prop_shaman_totem', 36, 44, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.FOREST_SHADE,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.GOBLIN_GREEN,
        outlineWidth: 2.4,
      },
      (c) => traceRoundedRect(c, -10, -16, 20, 32, 4),
      { cx: 0, cy: 0, rx: 10, ry: 16 },
    );
    outlined(
      ctx,
      {
        fill: PALETTE.LIME_GLOW,
        shade: PALETTE.GOBLIN_GREEN,
        highlight: PALETTE.ICE_WHITE,
        outlineWidth: 2.0,
      },
      (c) => {
        c.beginPath();
        c.arc(0, -4, 6, 0, Math.PI * 2);
        c.closePath();
      },
      { cx: 0, cy: -4, rx: 6, ry: 6 },
    );
  });
}
