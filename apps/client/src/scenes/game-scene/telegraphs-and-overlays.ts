import {
  clamp,
  ENEMIES,
  ENEMY_SPAWN_WARMUP_SEC,
  PLAYER_SLOT_COLORS,
  type SimEnemyState,
  WEAPON_RARITY_COLORS,
} from '@ashen-pact/shared';
import Phaser from 'phaser';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { type GameScene } from '../GameScene.js';

export function renderTelegraphsAndShieldImpl(this: GameScene, playerX: number, playerY: number): void {
  const sim = this.transport.getSim();
  const p = sim.player;
  const isStress = sim.stressTestActive;
  if (isStress && sim.tick % 4 !== 0) {
    return;
  }
  const g = this.telegraphGraphics;
  g.clear();
  const view = this.cameras.main.worldView;
  const hasView = view && view.width > 0;
  const viewLeft = hasView ? view.x - 48 : -9999;
  const viewRight = hasView ? view.x + view.width + 48 : 9999;
  const viewTop = hasView ? view.y - 48 : -9999;
  const viewBottom = hasView ? view.y + view.height + 48 : 9999;
  const hudSafeTop = hasView ? view.y + 72 : 72;
  const hudSafeBottom = hasView ? view.y + view.height - 62 : 478;

  // 0a. Hub Campfire & Statue Pedestals (Doanh Trại)
  if (sim.inHub) {
    for (let i = 0; i < sim.hubStatues.length; i++) {
      const st = sim.hubStatues[i]!;
      const isCurrent = p.characterId === st.characterId;
      g.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.92);
      g.lineStyle(2.5, hexToNum(isCurrent ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD), 0.9);
      g.fillEllipse(st.x, st.y + 12, 42, 18);
      g.strokeEllipse(st.x, st.y + 12, 42, 18);
    }

    // Central Campfire
    const fireX = sim.map.width * 0.5;
    const fireY = sim.map.height * 0.5 + 32;
    const flicker = Math.sin(sim.tick * 0.22) * 3;
    g.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.95);
    g.lineStyle(2, hexToNum(PALETTE.INK_DARK), 1);
    g.fillCircle(fireX, fireY + 4, 18);
    g.strokeCircle(fireX, fireY + 4, 18);
    g.fillStyle(hexToNum(PALETTE.FLAME_ORANGE), 0.85);
    g.fillCircle(fireX, fireY, 12 + flicker * 0.4);
    g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 0.95);
    g.fillCircle(fireX, fireY - 2, 7 - flicker * 0.25);
  }

  // 0b. Rarity Light Pillars for Chests & World Weapon Drops (instanced)
  for (let i = 0; i < sim.chests.length; i++) {
    const ch = sim.chests[i]!;
    const col = hexToNum(WEAPON_RARITY_COLORS[ch.rarity]);
    const beamH = ch.opened ? 72 : 46;
    const beamAlpha = ch.opened ? 0.24 : 0.14;
    g.fillStyle(col, beamAlpha);
    g.fillRect(ch.x - 12, ch.y - beamH, 24, beamH);
    g.lineStyle(2, col, ch.opened ? 0.9 : 0.65);
    g.strokeCircle(ch.x, ch.y + 6, 18);
  }

  for (let i = 0; i < sim.worldItems.length; i++) {
    const it = sim.worldItems[i]!;
    if (it.pickedUp) continue;
    if (it.ownerPlayerId !== undefined && it.ownerPlayerId !== 0 && it.ownerPlayerId !== p.id) {
      continue;
    }
    const col = hexToNum(WEAPON_RARITY_COLORS[it.rarity]);
    g.fillStyle(col, 0.22);
    g.fillRect(it.x - 8, it.y - 54, 16, 54);
    g.lineStyle(2, col, 0.88);
    g.strokeCircle(it.x, it.y + 6, 14);
  }

  // 1. Active Skills & Co-op Downed / Revive Circles for all players
  const allPlayers = sim.getAllPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const pl = allPlayers[i]!;
    let px = pl.x;
    let py = pl.y;
    if (pl.id === p.id) {
      px = playerX;
      py = playerY;
    } else {
      const interp = this.transport.getInterpolatedSimPlayerPos(pl, this.entityPosScratch);
      px = interp.x;
      py = interp.y;
    }

    if (pl.lifeState === 'downed') {
      const pulseR = 24 + Math.sin(sim.tick * 0.2) * 3;
      g.fillStyle(hexToNum(PALETTE.RUBY_DARK), 0.35);
      g.fillCircle(px, py + 4, pulseR);
      g.lineStyle(2.5, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.9);
      g.strokeCircle(px, py + 4, pulseR);

      if (pl.reviveProgress > 0) {
        g.lineStyle(4, hexToNum(PALETTE.LIME_GLOW), 1);
        g.beginPath();
        g.arc(
          px,
          py + 4,
          pulseR + 4,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * clamp(pl.reviveProgress, 0, 1),
          false,
        );
        g.strokePath();
      }
    }

    if (pl.skillActiveTimer > 0) {
      if (pl.characterId === 'vanguard') {
        const halfArc = sim.activeBuffIds.includes('vanguard_fortress')
          ? Math.PI
          : (60 * Math.PI) / 180;
        const startA = pl.aimAngle - halfArc;
        const endA = pl.aimAngle + halfArc;
        const r = sim.activeBuffIds.includes('vanguard_fortress') ? 32 : 38;

        g.lineStyle(7, hexToNum(PALETTE.INK_DARK), 0.85);
        g.beginPath();
        g.arc(px, py, r, startA, endA, false);
        g.strokePath();

        g.lineStyle(4, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.95);
        g.beginPath();
        g.arc(px, py, r, startA, endA, false);
        g.strokePath();

        g.lineStyle(2, hexToNum(PALETTE.SOLAR_GOLD), 0.9);
        g.beginPath();
        g.arc(px, py, r - 4, startA, endA, false);
        g.strokePath();
      }
    }
  }

  // 1a. Phase 5 Elementalist Skill Zones (Vùng Cầu Nguyên Tố + Xoáy Nguyên Tố)
  for (let i = 0; i < sim.skillZones.length; i++) {
    const z = sim.skillZones[i]!;
    if (z.ttlSec <= 0) continue;
    const elHex =
      z.element === 'burn'
        ? PALETTE.FLAME_ORANGE
        : z.element === 'chill'
          ? PALETTE.CYAN_FROST
          : PALETTE.VOLT_YELLOW;
    const col = hexToNum(elHex);
    const pulse = Math.sin(sim.tick * 0.16 + z.id) * 3;

    g.fillStyle(col, 0.15);
    g.fillCircle(z.x, z.y, z.radius + pulse);
    g.lineStyle(2.5, col, 0.88);
    g.strokeCircle(z.x, z.y, z.radius + pulse);

    if (z.vortex) {
      g.lineStyle(1.8, hexToNum(PALETTE.BONE_WHITE), 0.55);
      g.strokeCircle(z.x, z.y, z.radius * 0.62 - pulse);
    }

    // Floating elemental orb core
    g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.9);
    g.fillCircle(z.x, z.y, 11);
    g.fillStyle(col, 0.95);
    g.fillCircle(z.x, z.y, 8);
    g.fillStyle(hexToNum(PALETTE.BONE_WHITE), 0.9);
    g.fillCircle(z.x - 2, z.y - 2, 3);
  }

  // 1b. Phase 5 Summoned Entities (Druid Sacred Tree & Engineer Tesla / Ancient Turrets)
  for (let i = 0; i < sim.summons.length; i++) {
    const sum = sim.summons[i]!;
    if (sum.hp <= 0 || sum.ttlSec <= 0) continue;

    if (sum.kind === 'sacred_tree') {
      const pulse = Math.sin(sim.tick * 0.12 + sum.id) * 3;
      g.fillStyle(hexToNum(PALETTE.LIME_GLOW), 0.12);
      g.fillCircle(sum.x, sum.y, sum.auraRadius + pulse);
      g.lineStyle(2.2, hexToNum(PALETTE.LIME_GLOW), 0.82);
      g.strokeCircle(sum.x, sum.y, sum.auraRadius + pulse);

      // Tree trunk & glowing emerald canopy
      g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
      g.fillCircle(sum.x, sum.y, 20);
      g.fillStyle(hexToNum(PALETTE.LEATHER_MID), 1);
      g.fillRoundedRect(sum.x - 6, sum.y - 4, 12, 18, 3);
      g.fillStyle(hexToNum(PALETTE.GOBLIN_GREEN), 0.98);
      g.fillCircle(sum.x, sum.y - 8, 16);
      g.fillStyle(hexToNum(PALETTE.LIME_GLOW), 0.95);
      g.fillCircle(sum.x - 4, sum.y - 11, 9);
      g.lineStyle(2.5, hexToNum(PALETTE.INK_DARK), 1);
      g.strokeCircle(sum.x, sum.y - 8, 16);
    } else if (sum.kind === 'life_blossom') {
      // Phase 6 Co-op Weapon: Súng Hạt Giống (seed_gun) blooming Life Blossom
      const pulse = Math.sin(sim.tick * 0.18 + sum.id) * 2.5;
      g.fillStyle(hexToNum(PALETTE.MINT_LIGHT), 0.14);
      g.fillCircle(sum.x, sum.y, sum.auraRadius + pulse);
      g.lineStyle(2, hexToNum(PALETTE.LIME_GLOW), 0.85);
      g.strokeCircle(sum.x, sum.y, sum.auraRadius + pulse);

      g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
      g.fillCircle(sum.x, sum.y, 14);
      g.fillStyle(hexToNum(PALETTE.LIME_GLOW), 0.95);
      g.fillCircle(sum.x, sum.y, 11);
      g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 1);
      g.fillCircle(sum.x, sum.y, 5);
    } else {
      // Tesla Turret / Ancient Turret
      const isAncient = sum.kind === 'ancient_turret';
      const auraCol = hexToNum(isAncient ? PALETTE.SOLAR_GOLD : PALETTE.CYAN_FROST);
      g.fillStyle(auraCol, 0.08);
      g.fillCircle(sum.x, sum.y, sum.auraRadius);
      g.lineStyle(1.6, auraCol, 0.55);
      g.strokeCircle(sum.x, sum.y, sum.auraRadius);

      // Turret base + rotating barrel
      g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
      g.fillCircle(sum.x, sum.y, 16);
      g.fillStyle(hexToNum(PALETTE.STEEL_DARK), 1);
      g.fillCircle(sum.x, sum.y, 13);
      g.fillStyle(hexToNum(isAncient ? PALETTE.SOLAR_GOLD : PALETTE.BRASS_CORE), 1);
      g.fillCircle(sum.x, sum.y, 8);

      const barrelAng = this.time.now * 0.002 + sum.id;
      const bx = sum.x + Math.cos(barrelAng) * 16;
      const by = sum.y + Math.sin(barrelAng) * 16;
      g.lineStyle(6, hexToNum(PALETTE.INK_DARK), 1);
      g.beginPath();
      g.moveTo(sum.x, sum.y);
      g.lineTo(bx, by);
      g.strokePath();
      g.lineStyle(3.2, hexToNum(PALETTE.STEEL_LIGHT), 1);
      g.beginPath();
      g.moveTo(sum.x, sum.y);
      g.lineTo(bx, by);
      g.strokePath();

      // EMP Charge Arc around Tesla Turret (Co-op Synergy indicator)
      if (sum.charge > 0) {
        g.lineStyle(3, hexToNum(PALETTE.VOLT_YELLOW), 0.95);
        g.beginPath();
        g.arc(
          sum.x,
          sum.y,
          19,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * clamp(sum.charge / 100, 0, 1),
          false,
        );
        g.strokePath();
      }
    }

    // Mini TTL / HP bar above summon
    const barW = 28;
    const barY = sum.y - 28;
    const ttlRatio = clamp(sum.ttlSec / Math.max(1, sum.maxTtlSec), 0, 1);
    g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.9);
    g.fillRect(sum.x - barW / 2 - 1, barY - 1, barW + 2, 5);
    g.fillStyle(
      hexToNum(
        sum.kind === 'sacred_tree' || sum.kind === 'life_blossom'
          ? PALETTE.LIME_GLOW
          : PALETTE.VOLT_YELLOW,
      ),
      1,
    );
    g.fillRect(sum.x - barW / 2, barY, Math.max(2, barW * ttlRatio), 3);
  }

  // 1c. Contextual Ping World Rings
  for (let i = 0; i < sim.pings.length; i++) {
    const ping = sim.pings[i]!;
    const col = hexToNum(PLAYER_SLOT_COLORS[ping.playerSlot]);
    const waveR = 14 + ((sim.tick * 0.8) % 18);
    g.fillStyle(col, 0.22);
    g.fillCircle(ping.x, ping.y, 12);
    g.lineStyle(2.5, col, 0.95);
    g.strokeCircle(ping.x, ping.y, waveR);
    g.strokeCircle(ping.x, ping.y, 8);
  }

  // 1d. Phase 6 Co-op Dual Pressure Plates & Pushable Stone Blocks
  for (let i = 0; i < sim.pressurePlates.length; i++) {
    const plate = sim.pressurePlates[i]!;
    const isPressed = plate.pressed || sim.coopPuzzleCompleted;
    const plateCol = hexToNum(isPressed ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD);
    g.fillStyle(hexToNum(isPressed ? PALETTE.FOREST_SHADE : PALETTE.SLATE_DARK), 0.92);
    g.lineStyle(2.5, plateCol, 0.95);
    g.fillRoundedRect(plate.x - 18, plate.y - 18, 36, 36, 6);
    g.strokeRoundedRect(plate.x - 18, plate.y - 18, 36, 36, 6);
    g.fillStyle(plateCol, isPressed ? 0.95 : 0.45);
    g.fillCircle(plate.x, plate.y, 8);
  }

  for (let i = 0; i < sim.pushBlocks.length; i++) {
    const blk = sim.pushBlocks[i]!;
    g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.95);
    g.fillRoundedRect(blk.x - 17, blk.y - 17, 34, 34, 5);
    g.fillStyle(hexToNum(PALETTE.WARM_STONE), 1);
    g.lineStyle(2.5, hexToNum(PALETTE.SOLAR_GOLD), 0.95);
    g.fillRoundedRect(blk.x - 15, blk.y - 15, 30, 30, 4);
    g.strokeRoundedRect(blk.x - 15, blk.y - 15, 30, 30, 4);
    g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 0.95);
    g.fillCircle(blk.x, blk.y, 5);
  }

  // 1e. Phase 6 Co-op Tether Staff Energy Beams (tether_staff)
  for (let i = 0; i < sim.tetherBeams.length; i++) {
    const beam = sim.tetherBeams[i]!;
    if (beam.ttlSec <= 0) continue;
    g.lineStyle(7, hexToNum(PALETTE.ELECTRIC_VIOLET), 0.45);
    g.beginPath();
    g.moveTo(beam.x1, beam.y1);
    g.lineTo(beam.x2, beam.y2);
    g.strokePath();

    g.lineStyle(3.2, hexToNum(PALETTE.CYAN_FROST), 0.95);
    g.beginPath();
    g.moveTo(beam.x1, beam.y1);
    g.lineTo(beam.x2, beam.y2);
    g.strokePath();
  }

  // 1f. Phase 6 Boss Forge Titan Expanding Shockwave Rings (Dash through with i-frames!)
  for (let i = 0; i < sim.shockwaveRings.length; i++) {
    const ring = sim.shockwaveRings[i]!;
    g.lineStyle(ring.thickness * 0.55, hexToNum(PALETTE.FLAME_ORANGE), 0.45);
    g.strokeCircle(ring.x, ring.y, ring.radius);
    g.lineStyle(3.5, hexToNum(PALETTE.SOLAR_GOLD), 0.95);
    g.strokeCircle(ring.x, ring.y, ring.radius);
  }

  // 1g. Phase 6 Boss Kryssa Ice Prison Crystalline Cage around encased players
  const allPl = sim.getAllPlayers();
  for (let i = 0; i < allPl.length; i++) {
    const pl = allPl[i]!;
    if ((pl.encasedInIceTimer ?? 0) > 0 && pl.lifeState === 'alive') {
      g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 0.36);
      g.lineStyle(3, hexToNum(PALETTE.ICE_WHITE), 0.95);
      g.fillRoundedRect(pl.x - 19, pl.y - 24, 38, 42, 7);
      g.strokeRoundedRect(pl.x - 19, pl.y - 24, 38, 42, 7);
    }
  }

  // 2. Enemy Spawn Circles, Attack Telegraphs, Boss Burrow Warning, Elite Aura & Mini HP Bars
  let hpBarsDrawn = 0;
  let telegraphsDrawn = 0;
  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0) continue;

    // Boss Phase 2 Burrow Telegraph Circle on floor under target position
    if (e.bossBurrowed) {
      const r = e.telegraphRadius || 84;
      const progress =
        e.telegraphDurationSec > 0 ? 1 - clamp(e.stateTimer / e.telegraphDurationSec, 0, 1) : 1;
      g.fillStyle(hexToNum(PALETTE.CRIMSON_BRIGHT), 0.22 + progress * 0.22);
      g.fillCircle(e.bossTargetX, e.bossTargetY, r * (0.3 + progress * 0.7));
      g.lineStyle(3, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.95);
      g.strokeCircle(e.bossTargetX, e.bossTargetY, r);
      continue;
    }

    const pos = this.transport.getInterpolatedEnemyPos(e, this.entityPosScratch);
    if (pos.x < viewLeft || pos.x > viewRight || pos.y < viewTop || pos.y > viewBottom) {
      continue;
    }

    // 0.8s Magic Summoning Circle on Floor
    if (e.aiState === 'spawning') {
      const progress = 1 - clamp(e.stateTimer / ENEMY_SPAWN_WARMUP_SEC, 0, 1);
      const r = e.radius + 8;
      g.fillStyle(hexToNum(PALETTE.ELECTRIC_VIOLET), 0.22 * progress);
      g.fillCircle(pos.x, pos.y, r * progress);
      g.lineStyle(2.2, hexToNum(PALETTE.ELECTRIC_VIOLET), 0.9);
      g.strokeCircle(pos.x, pos.y, r);
      continue;
    }

    // Directional Front Shield Arc for Ice Golem & Iron Shielder (must flank behind!)
    const eStats = ENEMIES[e.defId];
    if (eStats?.frontShieldReduction && !isStress) {
      const halfArc = Math.PI * 0.4;
      const shieldR = e.radius + 6;
      const shieldHex = e.defId === 'ice_golem' ? PALETTE.CYAN_FROST : PALETTE.STEEL_LIGHT;
      g.lineStyle(5, hexToNum(PALETTE.INK_DARK), 0.88);
      g.beginPath();
      g.arc(pos.x, pos.y, shieldR, e.aimAngle - halfArc, e.aimAngle + halfArc, false);
      g.strokePath();
      g.lineStyle(3, hexToNum(shieldHex), 0.95);
      g.beginPath();
      g.arc(pos.x, pos.y, shieldR, e.aimAngle - halfArc, e.aimAngle + halfArc, false);
      g.strokePath();
    }

    // Boss Overload Stun Ring (Forge Titan when both energy cores are broken)
    if (e.aiState === 'stunned' && e.stateTimer > 0) {
      g.lineStyle(3.5, hexToNum(PALETTE.VOLT_YELLOW), 0.95);
      g.strokeCircle(pos.x, pos.y, e.radius + 10 + Math.sin(sim.tick * 0.3) * 3);
    }

    // Elite Golden-Violet Aura Ring & Shield Barrier
    if (e.isElite && !isStress) {
      g.lineStyle(2.5, hexToNum(PALETTE.SOLAR_GOLD), 0.85);
      g.strokeCircle(pos.x, pos.y + 4, e.radius + 5);
      if (e.shieldArmor > 0) {
        g.lineStyle(2, hexToNum(PALETTE.CYAN_FROST), 0.92);
        g.strokeCircle(pos.x, pos.y, e.radius + 8);
      }
    }

    // Frozen encasement crystal ring
    if (e.frozenTimer > 0 && (!isStress || telegraphsDrawn < 6)) {
      g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 0.28);
      g.fillCircle(pos.x, pos.y, e.radius + 5);
      g.lineStyle(2.2, hexToNum(PALETTE.BONE_WHITE), 0.9);
      g.strokeCircle(pos.x, pos.y, e.radius + 5);
    }

    // Druid Rooted vines ring around enemy feet
    if (e.rootedTimer > 0 && !isStress) {
      g.lineStyle(2.5, hexToNum(PALETTE.LIME_GLOW), 0.92);
      g.strokeEllipse(pos.x, pos.y + 8, e.radius * 2.1, e.radius * 1.1);
    }

    // Superconduct defense-shred aura ring
    if (e.superconductTimer > 0 && !isStress) {
      g.lineStyle(2, hexToNum(PALETTE.ELECTRIC_VIOLET), 0.9);
      g.strokeCircle(pos.x, pos.y, e.radius + 6);
    }

    // Ranger Predator Mark Crosshair above enemy (visible through Fog of War!)
    if (e.markedTimer > 0 && !isStress) {
      const markY = pos.y - (e.isBoss ? 54 : 40);
      g.lineStyle(2.2, hexToNum(PALETTE.SOLAR_GOLD), 0.95);
      g.strokeCircle(pos.x, markY, 6);
      g.beginPath();
      g.moveTo(pos.x - 9, markY);
      g.lineTo(pos.x + 9, markY);
      g.moveTo(pos.x, markY - 9);
      g.lineTo(pos.x, markY + 9);
      g.strokePath();
    }

    // Enemy Attack Telegraphs (Section 3.7: high readability red warning before damage)
    if (e.aiState === 'telegraph' && (!isStress || telegraphsDrawn < 4)) {
      telegraphsDrawn += 1;
      const progress =
        e.telegraphDurationSec > 0 ? 1 - clamp(e.stateTimer / e.telegraphDurationSec, 0, 1) : 1;

      if (e.defId === 'goblin_shooter' || e.defId === 'frost_bat') {
        const spreadRad = (15 * Math.PI) / 180;
        for (const mult of [-1, 0, 1]) {
          const ang = e.telegraphAngle + mult * spreadRad;
          const len = 240;
          const tx = pos.x + Math.cos(ang) * len;
          const ty = pos.y + Math.sin(ang) * len;
          g.lineStyle(2.5, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.45 + progress * 0.5);
          g.beginPath();
          g.moveTo(pos.x, pos.y);
          g.lineTo(tx, ty);
          g.strokePath();
        }
      } else if (
        e.defId === 'kryssa_ice_queen' ||
        e.defId === 'kryssa_clone' ||
        e.defId === 'ice_mage'
      ) {
        const len = e.telegraphLength || 320;
        const tx = pos.x + Math.cos(e.telegraphAngle) * len;
        const ty = pos.y + Math.sin(e.telegraphAngle) * len;
        g.lineStyle(6, hexToNum(PALETTE.CYAN_FROST), 0.35 + progress * 0.35);
        g.beginPath();
        g.moveTo(pos.x, pos.y);
        g.lineTo(tx, ty);
        g.strokePath();
        g.lineStyle(2.2, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.65 + progress * 0.35);
        g.beginPath();
        g.moveTo(pos.x, pos.y);
        g.lineTo(tx, ty);
        g.strokePath();
      } else if (
        e.defId === 'goblin_shaman' ||
        e.defId === 'green_slime' ||
        e.defId === 'mini_slime' ||
        e.defId === 'fire_imp' ||
        e.defId === 'iron_shielder' ||
        e.defId === 'welder_drone'
      ) {
        const len = e.telegraphLength || 160;
        const tx = pos.x + Math.cos(e.telegraphAngle) * len;
        const ty = pos.y + Math.sin(e.telegraphAngle) * len;
        g.lineStyle(2.2, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.5 + progress * 0.45);
        g.beginPath();
        g.moveTo(pos.x, pos.y);
        g.lineTo(tx, ty);
        g.strokePath();
      } else if (e.defId === 'thorn_turret') {
        for (let k = 0; k < 6; k++) {
          const ang = e.telegraphAngle + (k * Math.PI) / 3;
          const len = 180;
          g.lineStyle(2, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.45 + progress * 0.45);
          g.beginPath();
          g.moveTo(pos.x, pos.y);
          g.lineTo(pos.x + Math.cos(ang) * len, pos.y + Math.sin(ang) * len);
          g.strokePath();
        }
      } else if (e.defId === 'wild_boar' || e.defId === 'baby_yeti') {
        const len = e.telegraphLength || 220;
        const halfW = e.radius;
        const cos = Math.cos(e.telegraphAngle);
        const sin = Math.sin(e.telegraphAngle);
        const px = -sin * halfW;
        const py = cos * halfW;

        const p1 = { x: pos.x + px, y: pos.y + py };
        const p2 = { x: pos.x + cos * len + px, y: pos.y + sin * len + py };
        const p3 = { x: pos.x + cos * len - px, y: pos.y + sin * len - py };
        const p4 = { x: pos.x - px, y: pos.y - py };

        g.fillStyle(hexToNum(PALETTE.CRIMSON_BRIGHT), 0.18 + progress * 0.22);
        g.beginPath();
        g.moveTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
        g.lineTo(p3.x, p3.y);
        g.lineTo(p4.x, p4.y);
        g.closePath();
        g.fillPath();

        g.lineStyle(2, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.85);
        g.strokePath();
      } else if (
        e.defId === 'spore_bomber' ||
        e.defId === 'spore_king' ||
        e.defId === 'snow_spirit' ||
        e.defId === 'ice_golem' ||
        e.defId === 'dwarf_cannon' ||
        e.defId === 'coal_golem' ||
        e.defId === 'forge_titan'
      ) {
        const r = e.telegraphRadius || (e.isBoss ? 96 : 68);
        g.fillStyle(hexToNum(PALETTE.CRIMSON_BRIGHT), 0.16 + progress * 0.24);
        g.fillCircle(pos.x, pos.y, r * (0.35 + progress * 0.65));
        g.lineStyle(2.5, hexToNum(PALETTE.CRIMSON_BRIGHT), 0.92);
        g.strokeCircle(pos.x, pos.y, r);
      }
    }

    // Floating HP bar above non-dummy enemies or enemies with active elemental status (clipped to HUD safe bounds)
    const hasStatus =
      e.burnTimer > 0 ||
      e.chillStacks > 0 ||
      e.frozenTimer > 0 ||
      e.poisonStacks > 0 ||
      e.shockTimer > 0 ||
      e.markedTimer > 0 ||
      e.superconductTimer > 0 ||
      e.rootedTimer > 0;
    const barY = pos.y - (e.isBoss ? 44 : 30);
    if (
      barY - 8 >= hudSafeTop &&
      barY + 8 <= hudSafeBottom &&
      ((!e.isDummy && e.hp < e.maxHp) || hasStatus || e.isElite) &&
      (!isStress || hpBarsDrawn < 8)
    ) {
      this.drawEnemyHealthAndStatusBar(g, pos.x, barY, e);
      hpBarsDrawn += 1;
    }
  }
}

export function drawEnemyHealthAndStatusBarImpl(
  this: GameScene,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  e: SimEnemyState,
): void {
  const w = e.isBoss ? 52 : e.isElite ? 36 : 28;
  const h = e.isBoss ? 6 : 5;
  const ratio = clamp(e.hp / e.maxHp, 0, 1);

  g.fillStyle(hexToNum(PALETTE.INK_DARK), 0.9);
  g.fillRoundedRect(x - w / 2 - 1, y - 1, w + 2, h + 2, 2);

  g.fillStyle(
    hexToNum(
      e.frozenTimer > 0
        ? PALETTE.CYAN_FROST
        : e.isElite
          ? PALETTE.SOLAR_GOLD
          : PALETTE.CRIMSON_BRIGHT,
    ),
    1,
  );
  g.fillRoundedRect(x - w / 2, y, Math.max(2, w * ratio), h, 1.5);

  if (e.shieldArmor > 0 && e.maxShieldArmor > 0) {
    const sRatio = clamp(e.shieldArmor / e.maxShieldArmor, 0, 1);
    g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 0.95);
    g.fillRect(x - w / 2, y - 3, Math.max(2, w * sRatio), 2);
  }

  // Elemental status pips above HP bar
  let pipX = x - 12;
  const pipY = y - 6;
  if (e.burnTimer > 0) {
    g.fillStyle(hexToNum(PALETTE.FLAME_ORANGE), 1);
    g.fillCircle(pipX, pipY, 2.5);
    pipX += 6;
  }
  if (e.frozenTimer > 0 || e.chillStacks > 0) {
    g.fillStyle(hexToNum(PALETTE.CYAN_FROST), 1);
    g.fillCircle(pipX, pipY, e.frozenTimer > 0 ? 3.2 : 2.5);
    pipX += 6;
  }
  if (e.shockTimer > 0) {
    g.fillStyle(hexToNum(PALETTE.VOLT_YELLOW), 1);
    g.fillCircle(pipX, pipY, 2.5);
    pipX += 6;
  }
  if (e.poisonStacks > 0) {
    g.fillStyle(hexToNum(PALETTE.TOXIC_PURPLE), 1);
    g.fillCircle(pipX, pipY, 2.5);
    pipX += 6;
  }
  if (e.superconductTimer > 0) {
    g.fillStyle(hexToNum(PALETTE.ELECTRIC_VIOLET), 1);
    g.fillCircle(pipX, pipY, 2.5);
    pipX += 6;
  }
  if (e.markedTimer > 0) {
    g.fillStyle(hexToNum(PALETTE.SOLAR_GOLD), 1);
    g.fillCircle(pipX, pipY, 2.8);
  }
}

export function renderHitboxesIfEnabledImpl(this: GameScene): void {
  const debug = initGlobalDebugState();
  if (!debug.showHitboxes) return;

  const g = this.hitboxGraphics;
  g.clear();
  const sim = this.transport.getSim();

  // Spatial hash 64x64 grid lines
  g.lineStyle(1, 0x38bdf8, 0.18);
  for (let x = 0; x <= sim.map.width; x += 64) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, sim.map.height);
    g.strokePath();
  }
  for (let y = 0; y <= sim.map.height; y += 64) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(sim.map.width, y);
    g.strokePath();
  }

  // Solid wall/pillar AABBs
  g.lineStyle(1.2, 0xfacc15, 0.45);
  for (const box of sim.map.solidBoxes) {
    g.strokeRect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY);
  }

  // Player collision circle
  const pPos = this.transport.getInterpolatedPlayerPos(this.entityPosScratch);
  g.lineStyle(2, 0x4ade80, 0.95);
  g.strokeCircle(pPos.x, pPos.y, sim.player.radius);

  // Props collision circles
  g.lineStyle(1.8, 0xf97316, 0.9);
  for (const prop of sim.props) {
    if (prop.hp > 0) {
      g.strokeCircle(prop.x, prop.y, prop.radius);
    }
  }

  // Enemy collision circles
  g.lineStyle(2, 0xfb7185, 0.95);
  for (const e of sim.enemies) {
    if (e.hp > 0) {
      const ePos = this.transport.getInterpolatedEnemyPos(e, this.entityPosScratch);
      g.strokeCircle(ePos.x, ePos.y, e.radius);
    }
  }

  // Projectile collision circles
  g.lineStyle(1.5, 0x22d3ee, 0.9);
  for (const b of sim.projectiles) {
    const bPos = this.transport.getInterpolatedProjectilePos(b, this.entityPosScratch);
    g.strokeCircle(bPos.x, bPos.y, b.radius);
  }
}
