import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  SHOT_FLAG,
  SIM_STEP_SEC,
  TILE_SIZE,
  WEAPONS,
  WorldSim,
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
  for (let ty = 3; ty < sim.map.rows - 3; ty += 1) {
    for (let tx = 3; tx < sim.map.cols - 3; tx += 1) {
      sim.map.setTile(tx, ty, 'floor');
      sim.map.setSurface(tx, ty, 'none', 0, true);
    }
  }
  sim.consumeEvents();
  return sim;
}

describe('AP2 P1A.1 — Remaining Starter Weapons: hunter_crossbow (Liệp Ưng) & thorn_staff (Mộc Linh)', () => {
  describe('1. hunter_crossbow (CLIP_RELOAD, clip=4, reload=0.95s, 15 DMG / 0.35s hold: 22 DMG pierce>=2 kb=220, procCoeff=1.00)', () => {
    it('matches Spec 4.3 weapon stats and fires 15 DMG tap shot vs 22 DMG charged shot (hold >= 0.35s, pierceCount >= 2, knockback = 220)', () => {
      const wep = WEAPONS.hunter_crossbow!;
      expect(wep).toBeDefined();
      expect(wep.cadenceKind).toBe('CLIP_RELOAD');
      expect(wep.clipSize).toBe(4);
      expect(wep.reloadDurationSec).toBeCloseTo(0.95, 3);
      expect(wep.damage).toBe(15);
      expect(wep.procCoefficient).toBeCloseTo(1.0, 3);

      const sim = createCleanSim(1101);
      const p = sim.player;
      sim.selectCharacter(p.id, 'ranger');
      p.weaponSlots = ['hunter_crossbow'];
      sim.equipWeaponSlot(0);
      p.x = 220;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // 1. Tap shot (hold < 0.35s) -> 15 DMG
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      const tapVolley = sim.consumeEvents().find((e) => e.kind === 'bullet_volley_spawned');
      expect(tapVolley).toBeDefined();
      if (tapVolley?.kind === 'bullet_volley_spawned') {
        expect(tapVolley.damage).toBe(15);
      }
      sim.projectiles.length = 0;

      // 2. Hold trigger >= 0.35s -> fires Charged Piercing Bolt (22 DMG, pierceCount >= 2, knockback = 220)
      p.fireCooldownTimer = 0.4; // hold fire during cooldown for >= 0.35s (24 ticks = 0.40s)
      for (let t = 0; t < 25; t++) {
        sim.setPlayerInput({
          seq: t + 1,
          tick: sim.tick + 1,
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          buttons: INPUT_BUTTON.FIRE,
          weaponSlotSelect: null,
        });
        sim.step(SIM_STEP_SEC);
      }

      const chargedVolley = sim
        .consumeEvents()
        .find((e) => e.kind === 'bullet_volley_spawned' && e.weaponId === 'hunter_crossbow');
      expect(chargedVolley).toBeDefined();
      if (chargedVolley?.kind === 'bullet_volley_spawned') {
        expect(chargedVolley.damage).toBe(22);
        expect(chargedVolley.pierceCount).toBeGreaterThanOrEqual(2);
        expect(chargedVolley.knockback).toBe(220);
      }

      // Verify the charged bolt pierces through 3 lined-up enemies (pierceCount >= 2 means hits up to 3 targets)
      const e1 = sim.spawnEnemy('wild_boar', p.x + 70, p.y, true);
      const e2 = sim.spawnEnemy('wild_boar', p.x + 120, p.y, true);
      const e3 = sim.spawnEnemy('wild_boar', p.x + 170, p.y, true);
      e1.hp = 300;
      e2.hp = 300;
      e3.hp = 300;

      for (let t = 0; t < 25; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }

      expect(e1.hp).toBeLessThan(300);
      expect(e2.hp).toBeLessThan(300);
      expect(e3.hp).toBeLessThan(300);
      expect(e1.stuckArrows).toBe(1);
      expect(e2.stuckArrows).toBe(1);
      expect(e3.stuckArrows).toBe(1);
    });

    it('embeds stuckArrows up to max 4 per target and rips all arrows on Finale Shot or Perfect Reload [R] for 6 DMG * stuckArrows + 30% slow for 1.5s + crossbow_rip event', () => {
      const sim = createCleanSim(1102);
      const p = sim.player;
      sim.selectCharacter(p.id, 'ranger');
      p.weaponSlots = ['hunter_crossbow'];
      sim.equipWeaponSlot(0);
      p.x = 220;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      const targetA = sim.spawnEnemy('spore_guardian', p.x + 75, p.y, true);
      targetA.hp = 600;
      targetA.maxHp = 600;
      const targetB = sim.spawnEnemy('wild_boar', p.x + 120, p.y + 80, true);
      targetB.hp = 600;
      targetB.maxHp = 600;

      // Verify cap at 4 stuck arrows even if hit 5 times (without triggering Finale Shot)
      for (let s = 0; s < 5; s++) {
        p.clipAmmo = 4; // keep clipAmmo > 1 so Finale Shot does not fire yet
        p.fireCooldownTimer = 0;
        p.aimAngle = 0;
        sim.tryFireActiveWeapon(p);
        for (let t = 0; t < 12; t++) {
          sim.updateProjectiles(SIM_STEP_SEC);
        }
      }
      expect(targetA.stuckArrows).toBe(4);

      // Put 2 stuck arrows into targetB as well
      for (let s = 0; s < 2; s++) {
        p.clipAmmo = 4;
        p.fireCooldownTimer = 0;
        p.aimAngle = Math.atan2(targetB.y - p.y, targetB.x - p.x);
        sim.tryFireActiveWeapon(p);
        for (let t = 0; t < 18; t++) {
          sim.updateProjectiles(SIM_STEP_SEC);
        }
      }
      expect(targetB.stuckArrows).toBe(2);

      // 1. Trigger Perfect Reload [R] -> rips 4 arrows from targetA (24 DMG) and 2 arrows from targetB (12 DMG)
      p.clipAmmo = 0;
      p.reloadDuration = 0.95;
      p.reloadTimer = 0.45; // progress = 1 - 0.45/0.95 = 0.526 (inside [0.45, 0.70])
      p.reloadLockout = false;
      const hpABeforeRip = targetA.hp;
      const hpBBeforeRip = targetB.hp;
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

      expect(hpABeforeRip - targetA.hp).toBe(24); // 6 * 4 = 24 DMG
      expect(hpBBeforeRip - targetB.hp).toBe(12); // 6 * 2 = 12 DMG
      expect(targetA.stuckArrows).toBe(0);
      expect(targetB.stuckArrows).toBe(0);
      expect(targetA.chillTimer).toBeGreaterThanOrEqual(1.45);
      expect(targetB.chillTimer).toBeGreaterThanOrEqual(1.45);
      expect(targetA.slowTimer ?? targetA.chillTimer).toBeGreaterThanOrEqual(1.45);

      const ripEvents = sim.consumeEvents().filter((e) => e.kind === 'crossbow_rip');
      expect(ripEvents).toHaveLength(1);
      const ripEv = ripEvents[0]!;
      if (ripEv.kind === 'crossbow_rip') {
        expect(ripEv.playerId).toBe(p.id);
        expect(ripEv.totalArrows).toBe(6);
        expect(ripEv.targetIds).toEqual(expect.arrayContaining([targetA.id, targetB.id]));
      }

      // 2. Now fire full 4-shot clip into targetA -> 4th shot (Finale Shot) embeds 4th arrow and automatically triggers Barbed Rip (4 * 6 = 24 DMG)!
      p.overclockedNextShot = false;
      p.clipAmmo = 4;
      p.aimAngle = 0;
      targetA.chillTimer = 0;
      targetA.slowTimer = 0;

      for (let s = 0; s < 3; s++) {
        p.fireCooldownTimer = 0;
        sim.tryFireActiveWeapon(p);
        for (let t = 0; t < 12; t++) {
          sim.updateProjectiles(SIM_STEP_SEC);
        }
      }
      expect(targetA.stuckArrows).toBe(3);
      expect(p.clipAmmo).toBe(1);

      // Fire 4th shot (Finale Shot)
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      for (let t = 0; t < 12; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }

      expect(targetA.stuckArrows).toBe(0);
      expect(targetA.chillTimer).toBeGreaterThanOrEqual(1.45);
      const finaleEvents = sim.consumeEvents();
      const finaleRipEv = finaleEvents.find((e) => e.kind === 'crossbow_rip');
      expect(finaleRipEv).toBeDefined();
      if (finaleRipEv?.kind === 'crossbow_rip') {
        expect(finaleRipEv.playerId).toBe(p.id);
        expect(finaleRipEv.targetIds).toEqual([targetA.id]);
        expect(finaleRipEv.totalArrows).toBe(4);
      }
      // Verify damage_dealt includes the 24 DMG Barbed Rip hit
      expect(
        finaleEvents.some(
          (e) => e.kind === 'damage_dealt' && e.targetId === targetA.id && e.amount === 24,
        ),
      ).toBe(true);
    });
  });

  describe('2. thorn_staff (CLIP_RELOAD, clip=5, reload=1.00s, 11 DMG, Finale: 17 Poison DMG, fireRate=2.8/s, range=240px, procCoeff=0.75)', () => {
    it('matches Spec 4.3 stats, lashes 240px piercing thorn whip applying Poison + 1 Parasitic Thorn (max 5), and detonates thorns on Perfect Reload [R] for 7 Poison DMG * thorns', () => {
      const wep = WEAPONS.thorn_staff!;
      expect(wep).toBeDefined();
      expect(wep.cadenceKind).toBe('CLIP_RELOAD');
      expect(wep.clipSize).toBe(5);
      expect(wep.reloadDurationSec).toBeCloseTo(1.0, 3);
      expect(wep.damage).toBe(11);
      expect(wep.fireRate).toBeCloseTo(2.8, 3);
      expect(wep.range).toBe(240);
      expect(wep.procCoefficient).toBeCloseTo(0.75, 3);
      expect(wep.element).toBe('poison');

      const sim = createCleanSim(1103);
      const p = sim.player;
      sim.selectCharacter(p.id, 'druid');
      p.weaponSlots = ['thorn_staff'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // Spawn 3 enemies in a line within 240px and 1 enemy outside 240px (at +310px)
      const e1 = sim.spawnEnemy('spore_guardian', p.x + 70, p.y, true);
      const e2 = sim.spawnEnemy('spore_guardian', p.x + 150, p.y, true);
      const e3 = sim.spawnEnemy('spore_guardian', p.x + 230, p.y, true);
      const eOut = sim.spawnEnemy('spore_guardian', p.x + 310, p.y, true);
      for (const e of [e1, e2, e3, eOut]) {
        e.hp = 600;
        e.maxHp = 600;
      }

      // Fire 4 normal lashes -> pierces e1, e2, e3 (11 DMG each), applies Poison, embeds 4 Parasitic Thorns
      for (let s = 0; s < 4; s++) {
        p.fireCooldownTimer = 0;
        sim.tryFireActiveWeapon(p);
        for (let t = 0; t < 15; t++) {
          sim.updateProjectiles(SIM_STEP_SEC);
        }
      }

      expect(e1.parasiticThorns).toBe(4);
      expect(e2.parasiticThorns).toBe(4);
      expect(e3.parasiticThorns).toBe(4);
      expect(eOut.parasiticThorns ?? 0).toBe(0);
      expect(eOut.hp).toBe(600);
      expect(e1.poisonTimer).toBeGreaterThan(0);
      expect(e2.poisonTimer).toBeGreaterThan(0);
      expect(e3.poisonTimer).toBeGreaterThan(0);

      // Verify max 5 parasiticThorns cap per target
      e1.parasiticThorns = 5;
      p.clipAmmo = 4; // non-finale shot
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      for (let t = 0; t < 15; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }
      expect(e1.parasiticThorns).toBe(5);
      expect(e2.parasiticThorns).toBe(5);
      expect(e3.parasiticThorns).toBe(5);

      // Trigger Perfect Reload [R] -> all 5 Parasitic Thorns on each enemy bloom for 7 * 5 = 35 Poison DMG and reset to 0!
      p.clipAmmo = 0;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45; // progress = 0.55 (inside [0.45, 0.70])
      p.reloadLockout = false;
      const e1HpBeforeBloom = e1.hp;
      const e2HpBeforeBloom = e2.hp;
      const e3HpBeforeBloom = e3.hp;

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

      expect(e1HpBeforeBloom - e1.hp).toBe(35);
      expect(e2HpBeforeBloom - e2.hp).toBe(35);
      expect(e3HpBeforeBloom - e3.hp).toBe(35);
      expect(e1.parasiticThorns).toBe(0);
      expect(e2.parasiticThorns).toBe(0);
      expect(e3.parasiticThorns).toBe(0);
    });

    it('5th Finale Shot deals 17 Poison DMG, yanks furthest hit enemy 90px back toward player (supporting Chasm Ring-Out), and blooms all Parasitic Thorns', () => {
      const sim = createCleanSim(1104);
      const p = sim.player;
      sim.selectCharacter(p.id, 'druid');
      p.weaponSlots = ['thorn_staff'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      const nearEnemy = sim.spawnEnemy('wild_boar', p.x + 80, p.y, true);
      nearEnemy.hp = 600;
      nearEnemy.maxHp = 600;
      const farEnemy = sim.spawnEnemy('wild_boar', p.x + 210, p.y, true);
      farEnemy.hp = 600;
      farEnemy.maxHp = 600;

      // Pre-stack 4 Parasitic Thorns on farEnemy (as if hit by shots 1..4)
      farEnemy.parasiticThorns = 4;
      nearEnemy.parasiticThorns = 2;

      // Fire 5th Finale Shot (clipAmmo = 1)
      p.clipAmmo = 1;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      const farXBefore = farEnemy.x;

      sim.tryFireActiveWeapon(p);
      const volleyEv = sim.consumeEvents().find((e) => e.kind === 'bullet_volley_spawned');
      expect(volleyEv).toBeDefined();
      if (volleyEv?.kind === 'bullet_volley_spawned') {
        expect((volleyEv.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT).toBe(SHOT_FLAG.FINALE_SHOT);
        expect(volleyEv.damage).toBe(17);
        expect(volleyEv.element).toBe('poison');
      }

      for (let t = 0; t < 15; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }

      // 1. Furthest enemy was yanked 90px back toward player (and given pull velocity toward player)
      expect(farXBefore - farEnemy.x).toBeCloseTo(90, 0);
      expect(farEnemy.kbVx).toBeLessThan(0);

      // 2. Parasitic Thorns bloomed after Finale Shot (5 thorns on farEnemy -> 35 DMG + 17 Finale DMG = 52 total DMG) and reset to 0
      expect(farEnemy.parasiticThorns).toBe(0);
      expect(nearEnemy.parasiticThorns).toBe(0);
      expect(600 - farEnemy.hp).toBe(17 + 35);
      expect(600 - nearEnemy.hp).toBe(17 + 21); // 2 + 1 = 3 thorns * 7 = 21 DMG

      // 3. Test pulling an enemy across a Chasm tile to trigger Chasm Ring-Out!
      sim.enemies.length = 0;
      const chasmTarget = sim.spawnEnemy('goblin_shooter', p.x + 190, p.y, true);
      chasmTarget.hp = 200;
      chasmTarget.maxHp = 200;

      // Place chasm tiles between (p.x + 96) and (p.x + 160) so pulling 90px from (p.x + 190 -> p.x + 100) lands in chasm!
      const chasmTy = Math.floor(p.y / TILE_SIZE);
      for (let tx = Math.floor((p.x + 96) / TILE_SIZE); tx <= Math.floor((p.x + 160) / TILE_SIZE); tx++) {
        sim.map.setSurface(tx, chasmTy, 'chasm', 999, true);
      }

      p.clipAmmo = 1;
      p.reloadTimer = 0;
      p.overclockedNextShot = false;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();

      sim.tryFireActiveWeapon(p);
      for (let t = 0; t < 15; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }

      expect(chasmTarget.hp).toBe(0);
      const ringOutEv = sim
        .consumeEvents()
        .find((e) => e.kind === 'ring_out' && e.enemyId === chasmTarget.id);
      expect(ringOutEv).toBeDefined();
    });
  });
});
