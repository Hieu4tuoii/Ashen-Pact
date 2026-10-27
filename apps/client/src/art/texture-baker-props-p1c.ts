import type Phaser from 'phaser';
import { PALETTE } from './palette.js';
import { outlined, tracePolygon, traceRoundedRect } from './primitives.js';
import { bakeCustomCanvas } from './texture-baker-canvas.js';

export function bakeP1CProps(scene: Phaser.Scene, scale: number): void {
  // 1. Biome 2 Barricade: glacial_barricade ('low' | 'flipped' | 'sliding')
  bakeCustomCanvas(scene, 'prop_glacial_barricade', 42, 36, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.COBALT_SHADE,
        shade: PALETTE.ABYSS_BLUE,
        highlight: PALETTE.CYAN_FROST,
        outlineWidth: 2.4,
      },
      (c) =>
        tracePolygon(c, [
          { x: -16, y: -6 },
          { x: -9, y: -12 },
          { x: 12, y: -11 },
          { x: 17, y: 0 },
          { x: 11, y: 11 },
          { x: -12, y: 11 },
        ]),
      { cx: 0, cy: 0, rx: 16, ry: 11 },
    );
    ctx.strokeStyle = PALETTE.ICE_WHITE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(4, -2);
    ctx.lineTo(11, -6);
    ctx.stroke();
  });

  bakeCustomCanvas(scene, 'prop_glacial_barricade_flipped', 44, 42, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.AZURE_CORE,
        shade: PALETTE.COBALT_SHADE,
        highlight: PALETTE.ICE_WHITE,
        outlineWidth: 2.6,
      },
      (c) =>
        tracePolygon(c, [
          { x: -17, y: 13 },
          { x: -18, y: -6 },
          { x: -10, y: -16 },
          { x: 0, y: -12 },
          { x: 9, y: -17 },
          { x: 18, y: -5 },
          { x: 16, y: 13 },
        ]),
      { cx: 0, cy: -1, rx: 17, ry: 15 },
    );
    ctx.fillStyle = PALETTE.ICE_WHITE;
    ctx.fillRect(-13, -10, 24, 3.5);
    ctx.strokeStyle = PALETTE.CYAN_FROST;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-11, 2);
    ctx.lineTo(-1, -6);
    ctx.lineTo(10, 4);
    ctx.stroke();
  });

  bakeCustomCanvas(scene, 'prop_glacial_barricade_sliding', 44, 40, scale, (ctx) => {
    ctx.save();
    ctx.rotate(-0.14);
    outlined(
      ctx,
      {
        fill: PALETTE.CYAN_FROST,
        shade: PALETTE.AZURE_CORE,
        highlight: PALETTE.ICE_WHITE,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -16, -13, 32, 26, 4),
      { cx: 0, cy: 0, rx: 16, ry: 13 },
    );
    ctx.strokeStyle = PALETTE.ICE_WHITE;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.lineTo(12, -4);
    ctx.moveTo(-10, 4);
    ctx.lineTo(10, 4);
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

  // 5. Biome 3 Barricade: forge_blast_shield ('low' | 'flipped' | 'sliding')
  bakeCustomCanvas(scene, 'prop_forge_blast_shield', 42, 36, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_DARK,
        shade: PALETTE.SLATE_DARK,
        highlight: PALETTE.STEEL_LIGHT,
        outlineWidth: 2.4,
      },
      (c) => traceRoundedRect(c, -16, -12, 32, 24, 3.5),
      { cx: 0, cy: 0, rx: 16, ry: 12 },
    );
    ctx.strokeStyle = PALETTE.BRASS_CORE;
    ctx.lineWidth = 2.0;
    ctx.strokeRect(-12, -8, 24, 16);
    ctx.fillStyle = PALETTE.FLAME_ORANGE;
    ctx.fillRect(-7, -2, 14, 4);
  });

  bakeCustomCanvas(scene, 'prop_forge_blast_shield_flipped', 44, 42, scale, (ctx) => {
    outlined(
      ctx,
      {
        fill: PALETTE.SLATE_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.BRASS_CORE,
        outlineWidth: 2.6,
      },
      (c) => traceRoundedRect(c, -18, -15, 36, 30, 4),
      { cx: 0, cy: 0, rx: 18, ry: 15 },
    );
    ctx.fillStyle = PALETTE.BRASS_CORE;
    ctx.fillRect(-16, -13.5, 32, 4);
    ctx.fillStyle = PALETTE.FLAME_ORANGE;
    ctx.fillRect(-11, -3, 22, 5);
    ctx.fillStyle = PALETTE.SOLAR_GOLD;
    ctx.fillRect(-8, -1.5, 16, 2);
  });

  bakeCustomCanvas(scene, 'prop_forge_blast_shield_sliding', 44, 40, scale, (ctx) => {
    ctx.save();
    ctx.rotate(-0.12);
    outlined(
      ctx,
      {
        fill: PALETTE.STEEL_DARK,
        shade: PALETTE.INK_DARK,
        highlight: PALETTE.FLAME_ORANGE,
        outlineWidth: 2.5,
      },
      (c) => traceRoundedRect(c, -16, -13, 32, 26, 4),
      { cx: 0, cy: 0, rx: 16, ry: 13 },
    );
    ctx.fillStyle = PALETTE.SOLAR_GOLD;
    ctx.fillRect(-11, -4, 22, 8);
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
}
