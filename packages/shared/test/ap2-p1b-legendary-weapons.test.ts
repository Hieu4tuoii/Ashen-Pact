import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  SIM_STEP_SEC,
  TILE_SIZE,
  WEAPONS,
  WorldSim,
  getSolarMiniSunPositions,
  triggerMagmaCannonGeyserEruption,
  triggerSolarArchonSupernovaVent,
  triggerThunderHammerFinisher,
} from '../src/index.js';

function createCleanSim(seed = 20261027): WorldSim {
  const sim = new WorldSim({
    seed,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
    autoRespawnWaves: false,
  });
  sim.enemies.length = 0;
  sim.projectiles.length = 0;
  sim.props.length = 0;
  sim.summons.length = 0;
  sim.tetherBeams.length = 0;
  for (let ty = 3; ty < sim.map.rows - 3; ty += 1) {
    for (let tx = 3; tx < sim.map.cols - 3; tx += 1) {
      sim.map.setTile(tx, ty, 'floor');
      sim.map.setSurface(tx, ty, 'none', 0, true);
    }
  }
  sim.consumeEvents();
  return sim;
}

describe('AP2 P1B.3 — Legendary Weapons: solar_archon_staff, magma_cannon, thunder_hammer', () => {
  describe('1. solar_archon_staff (Trượng Thái Dương — Legendary, HEAT_VENT, Fire/burn, 15x3 converging rays, 3 Orbiting Mini-Suns 12 DMG / 0.40s ICD, Supernova Vent 68 DMG)', () => {
    it('matches P1B.3 weapon stats and orbits 3 Mini-Suns at radius 48px (angular speed 3.2 rad/s) dealing 12 Fire DMG on contact with 0.40s (24 ticks) per-orb ICD', () => {
      const wep = WEAPONS.solar_archon_staff!;
      expect(wep).toBeDefined();
      expect(wep.rarity).toBe('legendary');
      expect(wep.cadenceKind).toBe('HEAT_VENT');
      expect(wep.damage).toBe(15);
      expect(wep.pelletCount).toBe(3);
      expect(wep.heatPerShot).toBe(12);
      expect(wep.procCoefficient).toBeCloseTo(0.65, 3);
      expect(wep.element).toBe('burn');

      const sim = createCleanSim(4301);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist');
      p.activeImbueElement = 'none';
      p.weaponSlots = ['solar_archon_staff'];
      sim.equipWeaponSlot(0);
      p.x = 320;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = -1; // 0% crit
      p.solarOrbitAngle = 0;

      const initialSuns = getSolarMiniSunPositions(p);
      expect(initialSuns).toHaveLength(3);
      expect(initialSuns[0]!.x).toBeCloseTo(p.x + 48, 2);
      expect(initialSuns[0]!.y).toBeCloseTo(p.y, 2);
      expect(Math.hypot(initialSuns[1]!.x - p.x, initialSuns[1]!.y - p.y)).toBeCloseTo(48, 2);
      expect(Math.hypot(initialSuns[2]!.x - p.x, initialSuns[2]!.y - p.y)).toBeCloseTo(48, 2);

      // Place an immobile enemy right on Orb 0's path at (p.x + 48, p.y)
      const target = sim.spawnEnemy('spore_guardian', p.x + 48, p.y, true);
      target.hp = 500;
      target.maxHp = 500;

      // Step 1 tick: Orb 0 touches target -> deals 12 Fire DMG and applies burn
      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      expect(p.solarOrbitAngle).toBeCloseTo(3.2 * SIM_STEP_SEC, 4);
      expect(500 - target.hp).toBe(12);
      expect(target.burnTimer).toBeGreaterThan(0);

      // Keep Orb 0 on target for the next 20 ticks (< 24 ticks = 0.40s ICD) -> Orb 0 must NOT hit target again yet
      target.burnTimer = 0;
      const hpAfterFirstHit = target.hp;
      for (let t = 0; t < 20; t++) {
        p.solarOrbitAngle = 0;
        sim.step(SIM_STEP_SEC);
      }
      expect(target.hp).toBe(hpAfterFirstHit);

      // Advance 4 more ticks (total >= 24 ticks = 0.40s ICD elapsed) with Orb 0 on target -> hits again for 12 Fire DMG!
      for (let t = 0; t < 4; t++) {
        p.solarOrbitAngle = 0;
        sim.step(SIM_STEP_SEC);
      }
      expect(hpAfterFirstHit - target.hp).toBe(12);
    });

    it('fires 3 converging solar rays from the 3 orbiting Mini-Sun positions that converge at the target point (aimWorldX/Y or playerPos + dir * 240px) and burst in r=52px for 15 Fire DMG per ray (emitting solar_converge_burst & explosion)', () => {
      const sim = createCleanSim(4302);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist');
      p.activeImbueElement = 'none';
      p.weaponSlots = ['solar_archon_staff'];
      sim.equipWeaponSlot(0);
      p.x = 220;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = -1; // 0% crit
      p.solarOrbitAngle = 0;

      const sunsBeforeShot = getSolarMiniSunPositions(p);

      // 1. Default target point when aimWorldX/Y is not set: playerPos + dir * 240px = (460, 260)
      const enemyAtConvergence = sim.spawnEnemy('spore_guardian', p.x + 240, p.y + 28, true); // 28px from (460, 260) -> inside r=52px burst!
      enemyAtConvergence.hp = 600;
      enemyAtConvergence.maxHp = 600;

      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      const rays = sim.projectiles.filter((b) => b.weaponId === 'solar_archon_staff');
      expect(rays).toHaveLength(3);
      for (let k = 0; k < 3; k++) {
        expect(rays[k]!.originX).toBeCloseTo(sunsBeforeShot[k]!.x, 1);
        expect(rays[k]!.originY).toBeCloseTo(sunsBeforeShot[k]!.y, 1);
        expect(rays[k]!.convergeTargetX).toBeCloseTo(p.x + 240, 1);
        expect(rays[k]!.convergeTargetY).toBeCloseTo(p.y, 1);
      }

      // Step projectiles until all 3 rays reach (460, 260) and burst in r=52px
      const burstEvents: Array<{ x: number; y: number; radius: number; damage: number }> = [];
      for (let t = 0; t < 40; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
        for (const ev of sim.consumeEvents()) {
          if (ev.kind === 'solar_converge_burst') {
            burstEvents.push(ev);
          }
        }
        if (sim.projectiles.length === 0) break;
      }

      expect(burstEvents).toHaveLength(3);
      expect(burstEvents[0]!.radius).toBe(52);
      expect(burstEvents[0]!.damage).toBe(15);
      expect(burstEvents[0]!.x).toBeCloseTo(p.x + 240, 0);
      expect(burstEvents[0]!.y).toBeCloseTo(p.y, 0);

      // Enemy within r=52px of the convergence point took 15 * 3 = 45 Fire DMG
      expect(600 - enemyAtConvergence.hp).toBe(45);
      expect(enemyAtConvergence.burnTimer).toBeGreaterThan(0);

      // 2. Explicit cursor target point (aimWorldX, aimWorldY)
      sim.enemies.length = 0;
      p.aimWorldX = p.x + 180;
      p.aimWorldY = p.y - 60;
      p.aimAngle = Math.atan2(p.aimWorldY - p.y, p.aimWorldX - p.x);
      p.weaponHeat = 0;
      p.fireCooldownTimer = 0;

      const cursorEnemy = sim.spawnEnemy('spore_guardian', p.aimWorldX, p.aimWorldY, true);
      cursorEnemy.hp = 600;
      cursorEnemy.maxHp = 600;

      sim.tryFireActiveWeapon(p);
      for (let t = 0; t < 40; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
        if (sim.projectiles.length === 0) break;
      }
      expect(600 - cursorEnemy.hp).toBe(45);
    });

    it('Tactical Vent [R] (Supernova Convergence at 65%–95% Heat) launches all 3 Mini-Suns into target cursor, detonating a 68 Fire DMG Supernova (r=120px, kb=240, clears enemy bullets in r=80px with projectiles_destroyed, emits solar_supernova), resets heat to 0%, and leaves a Solar Fire Zone (r=96px, 3.5s, 12 Fire DMG / 0.5s)', () => {
      const sim = createCleanSim(4303);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist');
      p.activeImbueElement = 'none';
      p.weaponSlots = ['solar_archon_staff'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.aimWorldX = 420;
      p.aimWorldY = 260;
      p.critChance = -1;

      const supernovaEnemy = sim.spawnEnemy('wild_boar', 420 + 80, 260, true); // 80px from target (<= 120px Supernova, and <= 96px Solar Fire Zone)
      supernovaEnemy.hp = 600;
      supernovaEnemy.maxHp = 600;

      // Spawn 2 enemy bullets within r=80px of target (420, 260) -> must be cleared with projectiles_destroyed
      for (let i = 0; i < 2; i++) {
        sim.projectiles.push(
          sim.acquireProjectile({
            id: 9401 + i,
            ownerId: supernovaEnemy.id,
            team: 'enemy',
            weaponId: 'goblin_bow',
            x: 420 + 30 + i * 20,
            y: 260,
            vx: -120,
            vy: 0,
            angle: Math.PI,
            radius: 5,
            damage: 2,
            isCrit: false,
            knockback: 10,
            pierceRemaining: 0,
            bounceRemaining: 0,
            ttlSec: 3.0,
            element: 'none',
            amplifiedByShield: false,
          }),
        );
      }

      p.weaponHeat = 80;
      p.weaponSlotHeat[0] = 80;
      p.overheatLockTimer = 0;
      sim.consumeEvents();

      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      const events = sim.consumeEvents();
      expect(p.weaponHeat).toBe(0);
      expect(p.weaponSlotHeat[0]).toBe(0);
      expect(p.ventCooldownTimer).toBeCloseTo(0.25, 3);

      // Enemy bullets cleared in r=80px
      expect(
        events.some(
          (ev) =>
            ev.kind === 'projectiles_destroyed' &&
            ev.ids.includes(9401) &&
            ev.ids.includes(9402),
        ),
      ).toBe(true);

      // Supernova dealt 68 Fire DMG with heavy knockback (240) and emitted solar_supernova
      expect(600 - supernovaEnemy.hp).toBe(68);
      expect(supernovaEnemy.burnTimer).toBeGreaterThan(0);
      expect(supernovaEnemy.kbVx).toBeGreaterThan(150);

      const supernovaEv = events.find((ev) => ev.kind === 'solar_supernova');
      expect(supernovaEv).toBeDefined();
      if (supernovaEv?.kind === 'solar_supernova') {
        expect(supernovaEv.damage).toBe(68);
        expect(supernovaEv.radius).toBe(120);
        expect(supernovaEv.zoneRadius).toBe(96);
        expect(supernovaEv.zoneDurationSec).toBeCloseTo(3.5, 2);
      }

      // Solar Fire Zone (r=96px, duration=3.5s, 12 DMG Fire / 0.5s) is active at (420, 260)
      expect(sim.solarFireZones).toHaveLength(1);
      const zone = sim.solarFireZones[0]!;
      expect(zone.x).toBeCloseTo(420, 1);
      expect(zone.y).toBeCloseTo(260, 1);
      expect(zone.radius).toBe(96);

      // Place an immobile enemy inside the Solar Fire Zone (r=96px) and step 30 ticks (0.50s) -> takes 12 Fire DMG
      sim.enemies.length = 0;
      const zoneTarget = sim.spawnEnemy('spore_guardian', 420 + 60, 260, true);
      zoneTarget.hp = 500;
      zoneTarget.maxHp = 500;

      sim.setPlayerInput({
        seq: 2,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      for (let t = 0; t < 30; t++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(500 - zoneTarget.hp).toBe(12);
      expect(zoneTarget.burnTimer).toBeGreaterThan(0);

      // Step remaining 180 ticks (total 3.5s = 210 ticks) -> Solar Fire Zone expires
      for (let t = 0; t < 185; t++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(sim.solarFireZones).toHaveLength(0);
      expect(typeof triggerSolarArchonSupernovaVent).toBe('function');
    });
  });

  describe('2. magma_cannon (Pháo Dung Nham — Legendary, CLIP_RELOAD, clip=3, reload=1.25s, Fire/burn, 38 DMG, speed=420, kb=280, pierce=99, procCoeff=1.00)', () => {
    it('matches P1B.3 weapon stats, fires a Molten Magma Boulder (r=20px, 420 px/s, pierce=99, kb=280) that bulldozes enemies into the far wall (triggering mass Wall-Slam) and paints a 48px-wide Molten Magma Trail (3.5s, 10 Fire DMG / 0.5s)', () => {
      const wep = WEAPONS.magma_cannon!;
      expect(wep).toBeDefined();
      expect(wep.rarity).toBe('legendary');
      expect(wep.cadenceKind).toBe('CLIP_RELOAD');
      expect(wep.clipSize).toBe(3);
      expect(wep.reloadDurationSec).toBeCloseTo(1.25, 3);
      expect(wep.damage).toBe(38);
      expect(wep.projectileSpeed).toBe(420);
      expect(wep.knockback).toBe(280);
      expect(wep.pierceCount).toBe(99);
      expect(wep.procCoefficient).toBeCloseTo(1.0, 3);
      expect(wep.element).toBe('burn');

      const sim = createCleanSim(4304);
      const p = sim.player;
      sim.selectCharacter(p.id, 'vanguard');
      p.skillActiveTimer = 0;
      p.activeImbueElement = 'none';
      p.weaponSlots = ['magma_cannon'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = -1;

      // Place a solid wall at tx = 14 (x = 448..480) so the boulder bulldozes enemies into that wall
      const wallTx = 14;
      const wallTy = Math.floor(p.y / TILE_SIZE);
      sim.map.setTile(wallTx, wallTy, 'wall');
      sim.map.setTile(wallTx, wallTy - 1, 'wall');
      sim.map.setTile(wallTx, wallTy + 1, 'wall');

      // Spawn 2 enemies along the trajectory at x=280 and x=340
      const e1 = sim.spawnEnemy('wild_boar', 280, 260, true);
      const e2 = sim.spawnEnemy('goblin_shooter', 340, 260, true);
      e1.hp = 600;
      e1.maxHp = 600;
      e2.hp = 600;
      e2.maxHp = 600;

      p.clipAmmo = 3;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      const boulder = sim.projectiles.find((b) => b.weaponId === 'magma_cannon')!;
      expect(boulder).toBeDefined();
      expect(boulder.radius).toBe(20);
      expect(boulder.damage).toBe(38);
      expect(boulder.pierceRemaining).toBeGreaterThanOrEqual(99);
      expect(Math.hypot(boulder.vx, boulder.vy)).toBeCloseTo(420, 1);

      // Step simulation until the boulder reaches the wall at tx=14 (~38 ticks)
      const wallSlamEnemyIds = new Set<number>();
      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      for (let t = 0; t < 45; t++) {
        sim.step(SIM_STEP_SEC);
        for (const ev of sim.consumeEvents()) {
          if (ev.kind === 'wall_slam') {
            wallSlamEnemyIds.add(ev.enemyId);
          }
        }
        if (boulder.ttlSec <= 0) break;
      }

      // Both enemies were pierced/bulldozed into the far wall and triggered mass Wall-Slam!
      expect(wallSlamEnemyIds.has(e1.id)).toBe(true);
      expect(wallSlamEnemyIds.has(e2.id)).toBe(true);
      expect(e1.hp).toBeLessThan(600 - 38);
      expect(e2.hp).toBeLessThan(600 - 38);

      // Molten Magma Trail (width=48px, duration=3.5s) was painted along the path
      expect(sim.magmaTrails.length).toBeGreaterThan(0);
      expect(sim.magmaTrails[0]!.width).toBe(48);

      // Place an enemy within 24px (width/2) of the magma trail at (310, 260 + 18) and step 30 ticks (0.50s) -> ticks 10 Fire DMG
      sim.enemies.length = 0;
      const trailEnemy = sim.spawnEnemy('spore_guardian', 310, 260 + 18, true);
      trailEnemy.hp = 500;
      trailEnemy.maxHp = 500;
      for (let t = 0; t < 30; t++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(500 - trailEnemy.hp).toBeGreaterThanOrEqual(10);
      expect(trailEnemy.burnTimer).toBeGreaterThan(0);
    });

    it('erupts 4 Magma Geysers (22 Fire DMG each, r=56px, kb=180, emits magma_geyser_eruption) spaced evenly along the active magma trail on both the 3rd Shot (Finale Shot) and Perfect Reload [R]', () => {
      const sim = createCleanSim(4305);
      const p = sim.player;
      sim.selectCharacter(p.id, 'vanguard');
      p.skillActiveTimer = 0;
      p.activeImbueElement = 'none';
      p.weaponSlots = ['magma_cannon'];
      sim.equipWeaponSlot(0);
      p.x = 180;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = -1;

      // Fire Shot 1 and step 25 ticks so an active magma trail is painted from x=198 to ~370
      p.clipAmmo = 3;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      for (let t = 0; t < 25; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }
      sim.projectiles.length = 0;
      expect(sim.magmaTrails.length).toBeGreaterThan(0);

      // Place an enemy along the active magma trail at x=280, y=260
      const trailTarget = sim.spawnEnemy('spore_guardian', 280, 260, true);
      trailTarget.hp = 500;
      trailTarget.maxHp = 500;

      // 1. Fire 3rd Shot (Finale Shot: clipAmmo === 1) -> erupts 4 Magma Geysers along the trail!
      p.clipAmmo = 1;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      const finaleEvs = sim.consumeEvents();
      const geyserEv1 = finaleEvs.find((ev) => ev.kind === 'magma_geyser_eruption');
      expect(geyserEv1).toBeDefined();
      if (geyserEv1?.kind === 'magma_geyser_eruption') {
        expect(geyserEv1.geysers).toHaveLength(4);
        expect(geyserEv1.damage).toBe(22);
        expect(geyserEv1.radius).toBe(56);
      }
      expect(500 - trailTarget.hp).toBe(22);
      expect(trailTarget.burnTimer).toBeGreaterThan(0);

      // 2. Now p.reloadTimer > 0 (1.25s reload after emptying clip). Advance reload into the Perfect Reload [0.45, 0.70] window and press [R]!
      sim.projectiles.length = 0;
      trailTarget.hp = 500;
      p.reloadDuration = 1.25;
      p.reloadTimer = 1.25 * 0.45; // progress = 1 - 0.45 = 0.55 (inside [0.45, 0.70])
      p.reloadLockout = false;
      sim.consumeEvents();

      sim.setPlayerInput({
        seq: 5,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      const reloadEvs = sim.consumeEvents();
      expect(reloadEvs.some((ev) => ev.kind === 'perfect_reload')).toBe(true);
      const geyserEv2 = reloadEvs.find((ev) => ev.kind === 'magma_geyser_eruption');
      expect(geyserEv2).toBeDefined();
      if (geyserEv2?.kind === 'magma_geyser_eruption') {
        expect(geyserEv2.geysers).toHaveLength(4);
      }
      expect(500 - trailTarget.hp).toBe(22);
      expect(typeof triggerMagmaCannonGeyserEruption).toBe('function');
    });
  });

  describe('3. thunder_hammer (Búa Lôi Thần — Legendary, MELEE_COMBO, Shock, 30 -> 34 -> 54 DMG, kb=320, procCoeff=0.90)', () => {
    it('matches P1B.3 weapon stats and executes Hits 1 & 2 (30 DMG, 34 DMG) with heavy knockback=320, launching enemies into walls (Wall-Slam) and kicking tactical props across the room', () => {
      const wep = WEAPONS.thunder_hammer!;
      expect(wep).toBeDefined();
      expect(wep.rarity).toBe('legendary');
      expect(wep.cadenceKind).toBe('MELEE_COMBO');
      expect(wep.damage).toBe(30);
      expect(wep.comboHits).toBe(3);
      expect(wep.comboDamages).toEqual([30, 34, 54]);
      expect(wep.comboKnockbacks).toEqual([320, 320, 320]);
      expect(wep.knockback).toBe(320);
      expect(wep.element).toBe('shock');
      expect(wep.procCoefficient).toBeCloseTo(0.9, 3);
      expect(wep.destroysEnemyBullets).toBe(true);

      const sim = createCleanSim(4306);
      const p = sim.player;
      sim.selectCharacter(p.id, 'vanguard');
      p.skillActiveTimer = 0;
      p.activeImbueElement = 'none';
      p.weaponSlots = ['thunder_hammer'];
      sim.equipWeaponSlot(0);
      p.x = 220;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = -1; // 0% crit

      // Spawn a kickable explosive_barrel and an enemy in front of the player
      const barrel = sim.spawnProp('explosive_barrel', p.x + 60, p.y - 28);
      const target = sim.spawnEnemy('wild_boar', p.x + 52, p.y, true);
      target.hp = 600;
      target.maxHp = 600;

      // Hit 1: 30 DMG Shock + knockback 320 + kicks barrel
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      expect(p.meleeComboStep).toBe(1);
      expect(600 - target.hp).toBe(30);
      expect(target.shockTimer).toBeGreaterThan(0);
      expect(Math.hypot(target.kbVx, target.kbVy)).toBeCloseTo(320, 0);
      expect(target.kbVx).toBeGreaterThan(280);
      expect(barrel.coverState).toBe('sliding');

      // Hit 2: 34 DMG Shock + knockback 320
      sim.projectiles.length = 0;
      p.x = 220;
      p.y = 260;
      target.x = p.x + 52;
      target.y = p.y;
      target.kbVx = 0;
      target.kbVy = 0;
      target.hp = 600;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      expect(p.meleeComboStep).toBe(2);
      expect(600 - target.hp).toBe(34);
      expect(Math.hypot(target.kbVx, target.kbVy)).toBeCloseTo(320, 0);
    });

    it('Hit 3 (Finisher + Parry Deflect 0.18s) plants a Lightning Rod Pillar (3.0s at playerPos + dir * 72px), deflects up to 3 enemy bullets into 760 px/s lightning bolts (projectiles_destroyed & melee_parry_deflect), and calls down 3 massive Lightning Strikes (54 Shock DMG, r=110px, shock + 0.6s stun, emits thunder_hammer_pillar)', () => {
      const sim = createCleanSim(4307);
      const p = sim.player;
      sim.selectCharacter(p.id, 'vanguard');
      p.skillActiveTimer = 0;
      p.activeImbueElement = 'none';
      p.weaponSlots = ['thunder_hammer'];
      sim.equipWeaponSlot(0);
      p.x = 220;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = -1; // 0% crit
      p.meleeComboStep = 2; // Hit 3 Finisher

      const pillarX = p.x + 72; // 292
      const pillarY = p.y; // 260

      // Enemy 1 inside melee cone (at 265, 215) AND Enemy 2 outside 70px melee cone but inside r=110px of Lightning Rod Pillar (at 380, 300; >115px from Enemy 1 so shock chain doesn't cross-hit)
      const closeEnemy = sim.spawnEnemy('wild_boar', 265, 215, true);
      const strikeEnemy = sim.spawnEnemy('goblin_shooter', 380, 300, true);
      closeEnemy.hp = 600;
      closeEnemy.maxHp = 600;
      strikeEnemy.hp = 600;
      strikeEnemy.maxHp = 600;

      // Spawn 4 enemy bullets to verify Hit 3 Parry Deflect caps at 3 deflected lightning bolts (760 px/s)
      for (let i = 0; i < 4; i++) {
        sim.projectiles.push(
          sim.acquireProjectile({
            id: 9501 + i,
            ownerId: strikeEnemy.id,
            team: 'enemy',
            weaponId: 'goblin_bow',
            x: p.x + 42 + i * 6,
            y: p.y,
            vx: -150,
            vy: 0,
            angle: Math.PI,
            radius: 5,
            damage: 2,
            isCrit: false,
            knockback: 15,
            pierceRemaining: 0,
            bounceRemaining: 0,
            ttlSec: 3.0,
            element: 'none',
            amplifiedByShield: false,
          }),
        );
      }

      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      expect(p.meleeComboStep).toBe(0);
      expect(p.meleeParryWindowTimer).toBeCloseTo(0.18, 3);

      // Both closeEnemy and strikeEnemy (in r=110px of pillar) took 54 Shock DMG and 0.6s stun!
      expect(600 - closeEnemy.hp).toBe(54);
      expect(600 - strikeEnemy.hp).toBe(54);
      expect(closeEnemy.shockTimer).toBeGreaterThan(0);
      expect(strikeEnemy.shockTimer).toBeGreaterThan(0);
      expect(closeEnemy.stunTimer).toBeGreaterThanOrEqual(0.6);
      expect(strikeEnemy.stunTimer).toBeGreaterThanOrEqual(0.6);
      expect(strikeEnemy.aiState).toBe('stunned');

      // Up to 3 of the 4 enemy bullets were deflected into 760 px/s lightning bolts
      const remainingEnemyBullets = sim.projectiles.filter(
        (b) => b.team === 'enemy' && b.ttlSec > 0,
      );
      expect(remainingEnemyBullets).toHaveLength(1);
      const deflectedBolts = sim.projectiles.filter(
        (b) => b.team === 'player' && Math.abs(Math.hypot(b.vx, b.vy) - 760) < 1,
      );
      expect(deflectedBolts).toHaveLength(3);

      // Lightning Rod Pillar planted at (pillarX, pillarY) for 3.0s
      expect(sim.lightningPillars).toHaveLength(1);
      const pillar = sim.lightningPillars[0]!;
      expect(pillar.x).toBeCloseTo(pillarX, 1);
      expect(pillar.y).toBeCloseTo(pillarY, 1);
      expect(pillar.ttlSec).toBeCloseTo(3.0, 2);

      const evs = sim.consumeEvents();
      expect(evs.some((e) => e.kind === 'projectiles_destroyed')).toBe(true);
      expect(evs.some((e) => e.kind === 'melee_parry_deflect')).toBe(true);
      const pillarEv = evs.find((e) => e.kind === 'thunder_hammer_pillar');
      expect(pillarEv).toBeDefined();
      if (pillarEv?.kind === 'thunder_hammer_pillar') {
        expect(pillarEv.strikes).toHaveLength(3);
        expect(pillarEv.damage).toBe(54);
        expect(pillarEv.radius).toBe(110);
      }

      // Step 30 ticks (0.50s) -> Lightning Rod Pillar pulses periodic shock damage in r=110px
      sim.projectiles.length = 0;
      const hpBeforePulse = strikeEnemy.hp;
      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      for (let t = 0; t < 30; t++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(strikeEnemy.hp).toBeLessThan(hpBeforePulse);

      // Step remaining 152 ticks (total 3.0s = 180 ticks) -> Lightning Rod Pillar expires
      for (let t = 0; t < 152; t++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(sim.lightningPillars).toHaveLength(0);
      expect(typeof triggerThunderHammerFinisher).toBe('function');
    });
  });
});
