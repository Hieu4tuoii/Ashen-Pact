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
  sim.consumeEvents();
  return sim;
}

describe('AP2 P0B.4 — Active Weapon Cadence (CLIP_RELOAD, HEAT_VENT, MELEE_COMBO, Holster) & 4 Representative Weapons', () => {
  describe('1. CLIP_RELOAD Cadence, Finale Shot, Manual Reload & Perfect Reload [R]', () => {
    it('decrements clipAmmo on fire, flags Finale Shot (+50% Additive DMG, 100% element proc, auto-reload), and supports manual [R] reload', () => {
      const sim = createCleanSim(1001);
      const p = sim.player;
      sim.selectCharacter(p.id, 'ranger'); // hunter_crossbow: clipSize = 4, reloadDurationSec = 0.95, dmg = 18
      p.x = 300;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      expect(p.clipMax).toBe(4);
      expect(p.clipAmmo).toBe(4);

      // Fire 1st shot -> clipAmmo becomes 3
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      expect(p.clipAmmo).toBe(3);
      let evs = sim.consumeEvents();
      const firstVolley = evs.find((e) => e.kind === 'bullet_volley_spawned');
      expect(firstVolley).toBeDefined();
      if (firstVolley?.kind === 'bullet_volley_spawned') {
        expect((firstVolley.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT).toBe(0);
        expect(firstVolley.damage).toBe(WEAPONS.hunter_crossbow!.damage);
      }

      // Manual [R] reload when clipAmmo < clipMax and reloadTimer <= 0
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
      expect(p.reloadTimer).toBeGreaterThan(0);
      expect(p.reloadLockout).toBe(false);

      // Finish reload naturally
      sim.setPlayerInput({
        seq: 2,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      for (let i = 0; i < 70; i++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(p.reloadTimer).toBe(0);
      expect(p.clipAmmo).toBe(4);

      // Now set clipAmmo = 1 and fire Finale Shot with thorn_staff (element = 'poison', damage = 9)
      p.weaponSlots[0] = 'thorn_staff';
      sim.equipWeaponSlot(0);
      p.clipAmmo = 1;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();

      const enemy = sim.spawnEnemy('wild_boar', p.x + 60, p.y, true);
      enemy.hp = 300;
      enemy.maxHp = 300;

      sim.tryFireActiveWeapon(p);
      expect(p.clipAmmo).toBe(0);
      expect(p.reloadTimer).toBeCloseTo(WEAPONS.thorn_staff!.reloadDurationSec, 3);
      expect(p.reloadLockout).toBe(false);

      evs = sim.consumeEvents();
      const finaleVolley = evs.find((e) => e.kind === 'bullet_volley_spawned');
      expect(finaleVolley).toBeDefined();
      if (finaleVolley?.kind === 'bullet_volley_spawned') {
        expect((finaleVolley.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT).toBe(SHOT_FLAG.FINALE_SHOT);
        expect(finaleVolley.damage).toBe(Math.round(WEAPONS.thorn_staff!.damage * 1.5));
      }

      // Step projectiles so Finale Shot hits enemy -> 100% elemental proc
      for (let i = 0; i < 15; i++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }
      expect(enemy.poisonTimer).toBeGreaterThan(0);
    });

    it('triggers Perfect Reload on [R] rising edge inside golden window [0.45, 0.70], locks out outside window, and NEVER triggers from FIRE', () => {
      const sim = createCleanSim(1002);
      const p = sim.player;
      sim.selectCharacter(p.id, 'engineer'); // rivet_gun: clipSize = 6, reloadDurationSec = 0.90
      p.x = 300;
      p.y = 260;

      // Put grass tile under player to verify grass pollen boost on Perfect Reload
      const tx = Math.floor(p.x / TILE_SIZE);
      const ty = Math.floor(p.y / TILE_SIZE);
      sim.map.setSurface(tx, ty, 'grass', 999, true);

      // 1. Holding or pressing FIRE during reload in golden window NEVER triggers Perfect Reload
      p.clipAmmo = 0;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45; // progress = 1 - 0.45 / 1.0 = 0.55 (inside golden window!)
      p.reloadLockout = false;
      sim.consumeEvents();

      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.FIRE,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);
      expect(p.reloadTimer).toBeGreaterThan(0);
      expect(p.overclockedNextShot).toBe(false);
      expect(sim.consumeEvents().some((e) => e.kind === 'perfect_reload')).toBe(false);

      // 2. Pressing [R] OUTSIDE golden window (progress = 0.25 < 0.45) sets reloadLockout = true
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.75; // progress = 0.25
      p.reloadLockout = false;
      sim.setPlayerInput({
        seq: 2,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);
      expect(p.reloadLockout).toBe(true);
      expect(p.reloadTimer).toBeGreaterThan(0);
      expect(p.overclockedNextShot).toBe(false);

      // Even if player presses [R] again later when progress enters [0.45, 0.70], reloadLockout blocks it
      sim.setPlayerInput({
        seq: 3,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);
      p.reloadTimer = 0.45; // progress = 0.55
      sim.setPlayerInput({
        seq: 4,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);
      expect(p.reloadTimer).toBeGreaterThan(0);
      expect(p.overclockedNextShot).toBe(false);

      // 3. Pressing [R] INSIDE golden window (0.45 <= progress <= 0.70) finishes reload immediately + overclockedNextShot
      sim.setPlayerInput({
        seq: 5,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      p.clipAmmo = 0;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45; // progress = 0.55
      p.reloadLockout = false;
      p.pollenSpeedBoostTimer = 0;
      sim.consumeEvents();

      sim.setPlayerInput({
        seq: 6,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      expect(p.clipAmmo).toBe(p.clipMax);
      expect(p.reloadTimer).toBe(0);
      expect(p.reloadLockout).toBe(false);
      expect(p.overclockedNextShot).toBe(true);
      expect(p.pollenSpeedBoostTimer).toBeGreaterThan(0);

      const prEvents = sim.consumeEvents();
      const prEv = prEvents.find((e) => e.kind === 'perfect_reload');
      expect(prEv).toBeDefined();
      if (prEv?.kind === 'perfect_reload') {
        expect(prEv.playerId).toBe(p.id);
        expect(prEv.weaponId).toBe('rivet_gun');
      }

      // Next shot consumes overclockedNextShot, sets SHOT_FLAG.OVERCLOCKED_SHOT, and gets +45% Additive DMG
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      expect(p.overclockedNextShot).toBe(false);
      const shotEv = sim.consumeEvents().find((e) => e.kind === 'bullet_volley_spawned');
      expect(shotEv).toBeDefined();
      if (shotEv?.kind === 'bullet_volley_spawned') {
        expect((shotEv.shotFlags ?? 0) & SHOT_FLAG.OVERCLOCKED_SHOT).toBe(
          SHOT_FLAG.OVERCLOCKED_SHOT,
        );
        expect(shotEv.damage).toBe(Math.round(WEAPONS.rivet_gun!.damage * 1.45));
      }
    });
  });

  describe('2. HEAT_VENT Cadence, Orange Heat Zone (+25% Fire Rate & DMG), Overheat (1.10s) & Tactical Vent [R]', () => {
    it('accumulates heat, decays 28%/s when idle, boosts fireRate and damage by +25% in Orange Zone [65, 95], locks for 1.10s at 100%, and vents on [R]', () => {
      const sim = createCleanSim(1003);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist'); // apprentice_staff: heatPerShot = 14, dmg = 11, fireRate = 2.6
      p.x = 300;
      p.y = 260;

      expect(WEAPONS.apprentice_staff!.damage).toBe(11);
      expect(WEAPONS.apprentice_staff!.fireRate).toBeCloseTo(2.6, 3);
      expect(WEAPONS.apprentice_staff!.heatPerShot).toBe(14);

      // 1. Fire once -> weaponHeat increases by 14
      p.weaponHeat = 0;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      expect(p.weaponHeat).toBe(14);
      expect(p.fireCooldownTimer).toBeCloseTo(1 / 2.6, 3);

      // 2. Passive cooling decays at 28%/s when not firing
      p.weaponHeat = 50;
      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      for (let i = 0; i < 30; i++) {
        sim.step(SIM_STEP_SEC); // 0.5s -> decays 14 heat
      }
      expect(p.weaponHeat).toBeCloseTo(36, 1);

      // 3. Orange Heat Zone (65 <= weaponHeat <= 95): +25% fire rate and +25% Additive DMG
      p.weaponHeat = 70;
      p.fireCooldownTimer = 0;
      p.apprenticeStaffShotCount = 0; // ensure normal 1st shot (not 3rd shot large orb)
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      expect(p.fireCooldownTimer).toBeCloseTo(1 / (2.6 * 1.25), 3);
      const orangeVolley = sim.consumeEvents().find((e) => e.kind === 'bullet_volley_spawned');
      expect(orangeVolley).toBeDefined();
      if (orangeVolley?.kind === 'bullet_volley_spawned') {
        expect(orangeVolley.damage).toBe(Math.round(11 * 1.25));
      }

      // 4. Tactical Vent [R] while 65 <= weaponHeat <= 95: resets heat to 0, sets 0.25s vent recovery, emits tactical_vent
      p.weaponHeat = 80;
      p.overheatLockTimer = 0;
      sim.consumeEvents();
      sim.setPlayerInput({
        seq: 2,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);
      expect(p.weaponHeat).toBe(0);
      expect(p.ventCooldownTimer).toBeGreaterThan(0);
      const ventEv = sim.consumeEvents().find((e) => e.kind === 'tactical_vent');
      expect(ventEv).toBeDefined();
      if (ventEv?.kind === 'tactical_vent') {
        expect(ventEv.playerId).toBe(p.id);
        expect(ventEv.weaponId).toBe('apprentice_staff');
      }

      // 5. Overheat (weaponHeat >= 100): locks firing for 1.10s and resets weaponHeat = 0 when lock expires
      p.ventCooldownTimer = 0;
      p.weaponHeat = 92;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p); // 92 + 14 -> 100
      expect(p.weaponHeat).toBe(100);
      expect(p.overheatLockTimer).toBeCloseTo(1.1, 3);

      // Cannot fire while overheatLockTimer > 0
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      expect(sim.consumeEvents().some((e) => e.kind === 'bullet_volley_spawned')).toBe(false);

      // Step 1.15s -> overheatLockTimer expires and resets weaponHeat to 0
      sim.setPlayerInput({
        seq: 3,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      for (let i = 0; i < 70; i++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(p.overheatLockTimer).toBe(0);
      expect(p.weaponHeat).toBe(0);
    });
  });

  describe('3. MELEE_COMBO 3-Hit Cadence, 24px Lunge on Hit 1 & 2, 0.90s Idle Reset & Hit 3 Parry Deflect', () => {
    it('executes 3-hit combo with 24px Lunge on Hit 1 & 2 without destroying enemy bullets, resets after 0.90s idle, and Parry Deflects up to 3 bullets on Hit 3', () => {
      const sim = createCleanSim(1004);
      const p = sim.player;
      sim.selectCharacter(p.id, 'vanguard'); // knight_sword
      p.x = 300;
      p.y = 260;
      p.aimAngle = 0;
      p.skillActiveTimer = 0;

      // Spawn an enemy bullet in front of player for Hit 1 & Hit 2
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 7001,
          ownerId: 99,
          team: 'enemy',
          weaponId: 'goblin_bow',
          x: p.x + 36,
          y: p.y,
          vx: 0,
          vy: 0,
          angle: Math.PI,
          radius: 5,
          damage: 2,
          isCrit: false,
          knockback: 20,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 5.0,
          element: 'none',
          amplifiedByShield: false,
        }),
      );

      // Hit 1 (meleeComboStep: 0 -> 1): 24px Lunge, does NOT destroy enemy bullet
      const xBeforeHit1 = p.x;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      expect(p.x).toBeCloseTo(xBeforeHit1 + 24, 2);
      expect(p.meleeComboStep).toBe(1);
      expect(sim.projectiles.some((b) => b.id === 7001 && b.team === 'enemy' && b.ttlSec > 0)).toBe(
        true,
      );

      // Hit 2 (meleeComboStep: 1 -> 2): 24px Lunge, does NOT destroy enemy bullet
      const xBeforeHit2 = p.x;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      expect(p.x).toBeCloseTo(xBeforeHit2 + 24, 2);
      expect(p.meleeComboStep).toBe(2);
      expect(sim.projectiles.some((b) => b.id === 7001 && b.team === 'enemy' && b.ttlSec > 0)).toBe(
        true,
      );

      // Idle for >= 0.90s resets meleeComboStep back to 0 (Hit 1)
      p.fireCooldownTimer = 0;
      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      for (let i = 0; i < 58; i++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(p.meleeComboStep).toBe(0);

      // Advance back to Hit 3 (meleeComboStep === 2) and test Parry Deflect (up to 3 of 4 enemy bullets deflected at 760 px/s!)
      sim.projectiles.length = 0;
      p.x = 300;
      p.y = 260;
      p.aimAngle = 0;
      p.meleeComboStep = 2;
      p.fireCooldownTimer = 0;

      const enemyBulletIds = [8001, 8002, 8003, 8004];
      for (let i = 0; i < enemyBulletIds.length; i++) {
        sim.projectiles.push(
          sim.acquireProjectile({
            id: enemyBulletIds[i]!,
            ownerId: 99,
            team: 'enemy',
            weaponId: 'goblin_bow',
            x: p.x + 28 + i * 4,
            y: p.y,
            vx: -180,
            vy: 0,
            angle: Math.PI,
            radius: 5,
            damage: 2,
            isCrit: false,
            knockback: 20,
            pierceRemaining: 0,
            bounceRemaining: 0,
            ttlSec: 3.0,
            element: 'none',
            amplifiedByShield: false,
          }),
        );
      }
      sim.consumeEvents();

      sim.tryFireActiveWeapon(p);

      // Hit 3 opens 0.18s Parry Deflect window and adds +0.25s recovery to fireCooldownTimer
      expect(p.meleeParryWindowTimer).toBeCloseTo(0.18, 3);
      expect(p.fireCooldownTimer).toBeCloseTo(1 / WEAPONS.knight_sword!.fireRate + 0.25, 3);
      expect(p.meleeComboStep).toBe(0);

      // Only 3 of the 4 enemy projectiles are deflected; 1 enemy projectile remains
      const remainingEnemyBullets = sim.projectiles.filter(
        (b) => b.team === 'enemy' && b.ttlSec > 0,
      );
      expect(remainingEnemyBullets).toHaveLength(1);

      const deflectedPlayerBullets = sim.projectiles.filter(
        (b) => b.team === 'player' && Math.abs(Math.hypot(b.vx, b.vy) - 760) < 1,
      );
      expect(deflectedPlayerBullets).toHaveLength(3);
      for (const db of deflectedPlayerBullets) {
        expect(db.angle).toBeCloseTo(p.aimAngle, 3);
        expect(db.damage).toBe(24);
      }

      const events = sim.consumeEvents();
      const destroyedEv = events.find((e) => e.kind === 'projectiles_destroyed');
      expect(destroyedEv).toBeDefined();
      if (destroyedEv?.kind === 'projectiles_destroyed') {
        expect(destroyedEv.ids).toHaveLength(3);
      }
    });
  });

  describe('4. Holster Auto-Reload (2.0s)', () => {
    it('automatically refills inactive weapon clip to clipMax and resets heat to 0% after 2.0s in holster', () => {
      const sim = createCleanSim(1005);
      const p = sim.player;
      p.weaponSlots = ['rivet_gun', 'apprentice_staff'];
      sim.equipWeaponSlot(0);

      // Deplete rivet_gun clip to 2
      p.clipAmmo = 2;

      // Swap to slot 1 (apprentice_staff) and build heat to 60
      sim.equipWeaponSlot(1);
      p.weaponHeat = 60;

      // Step for 1.0s (< 2.0s): slot 0 is NOT auto-reloaded yet
      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.FIRE, // keep firing slot 1 so passive cooling doesn't zero heat
        weaponSlotSelect: null,
      });
      for (let i = 0; i < 60; i++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(p.holsterReloadTimers[0]).toBeLessThan(2.0);

      // Step another 1.1s (total > 2.0s): slot 0 holster timer >= 2.0 -> refills slot 0 clip to clipMax (6)
      for (let i = 0; i < 66; i++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(p.holsterReloadTimers[0]).toBeGreaterThanOrEqual(2.0);

      // Swap back to slot 0 -> clipAmmo is full (6), and now slot 1 is in holster with heat > 0
      sim.equipWeaponSlot(0);
      expect(p.clipAmmo).toBe(6);

      // Wait 2.1s on slot 0 -> slot 1 heat resets to 0%
      sim.setPlayerInput({
        seq: 2,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      for (let i = 0; i < 126; i++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(p.holsterReloadTimers[1]).toBeGreaterThanOrEqual(2.0);
      sim.equipWeaponSlot(1);
      expect(p.weaponHeat).toBe(0);
    });
  });

  describe('5. Four Representative Weapons (rivet_gun, apprentice_staff, knight_sword, tesla_carbine)', () => {
    it('rivet_gun: embeds Magnetic Rivets (max 6) and discharges electric arc chains on 6th Finale Shot (5 Shock DMG/rivet) or Perfect Reload (7.5 Shock DMG/rivet)', () => {
      const sim = createCleanSim(1006);
      const p = sim.player;
      sim.selectCharacter(p.id, 'engineer');
      p.weaponSlots = ['rivet_gun'];
      sim.equipWeaponSlot(0);
      p.x = 300;
      p.y = 260;
      p.aimAngle = 0;

      expect(WEAPONS.rivet_gun!.clipSize).toBe(6);
      expect(WEAPONS.rivet_gun!.reloadDurationSec).toBeCloseTo(0.9, 3);
      expect(WEAPONS.rivet_gun!.damage).toBe(9);
      expect(WEAPONS.rivet_gun!.fireRate).toBeCloseTo(3.4, 3);
      expect(WEAPONS.rivet_gun!.procCoefficient).toBeCloseTo(0.55, 3);

      const target1 = sim.spawnEnemy('wild_boar', p.x + 70, p.y, true);
      target1.hp = 500;
      target1.maxHp = 500;
      const target2 = sim.spawnEnemy('wild_boar', p.x + 130, p.y, true);
      target2.hp = 500;
      target2.maxHp = 500;

      // Fire 4 shots into target1 -> embeds 4 Magnetic Rivets
      for (let s = 0; s < 4; s++) {
        p.fireCooldownTimer = 0;
        sim.tryFireActiveWeapon(p);
        for (let t = 0; t < 12; t++) {
          sim.updateProjectiles(SIM_STEP_SEC);
        }
      }
      expect(sim.activeRivets.filter((r) => r.ownerPlayerId === p.id)).toHaveLength(4);

      // Trigger Manual Reload -> Perfect Reload [R] -> discharges all 4 rivets for 4 * 7.5 = 30 Shock DMG and destroys them!
      p.reloadDuration = 0.9;
      p.reloadTimer = 0.45; // progress = 0.50 (inside golden window)
      p.reloadLockout = false;
      const hpBeforePerfectDischarge = target1.hp;
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

      expect(sim.activeRivets.filter((r) => r.ownerPlayerId === p.id)).toHaveLength(0);
      expect(hpBeforePerfectDischarge - target1.hp).toBe(30); // 4 * 7.5 = 30 Shock DMG
      expect(target1.shockTimer).toBeGreaterThan(0);

      // Now fire all 6 shots (shots 1..5 embed 5 rivets, 6th Finale Shot embeds 6th rivet and discharges 6 * 5 = 30 Shock DMG + 15 Finale Shot DMG)
      p.overclockedNextShot = false;
      p.clipAmmo = 6;
      for (let s = 0; s < 5; s++) {
        p.fireCooldownTimer = 0;
        sim.tryFireActiveWeapon(p);
        for (let t = 0; t < 12; t++) {
          sim.updateProjectiles(SIM_STEP_SEC);
        }
      }
      expect(sim.activeRivets.filter((r) => r.ownerPlayerId === p.id)).toHaveLength(5);
      expect(p.clipAmmo).toBe(1);

      // Move 1 rivet onto target2 (within 180px of target1) so arc chain connects target1 and target2!
      sim.activeRivets[0]!.attachedTargetId = target2.id;
      sim.activeRivets[0]!.x = target2.x;
      sim.activeRivets[0]!.y = target2.y;

      const t2HpBeforeFinale = target2.hp;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      for (let t = 0; t < 12; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }

      // All 6 rivets discharged and self-destructed, dealing 6 * 5 = 30 Shock DMG across the arc chain!
      expect(sim.activeRivets.filter((r) => r.ownerPlayerId === p.id)).toHaveLength(0);
      expect(t2HpBeforeFinale - target2.hp).toBe(30);
      expect(sim.consumeEvents().some((e) => e.kind === 'chain_lightning')).toBe(true);
    });

    it('apprentice_staff: cycles burn -> chill -> shock, fires Large Elemental Orb (17 DMG, r=56px) every 3rd shot, and Tactical Vent [R] clears enemy bullets (r=56px) + strikes target (22 DMG, r=72px, 100% element)', () => {
      const sim = createCleanSim(1007);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist');
      p.weaponSlots = ['apprentice_staff'];
      sim.equipWeaponSlot(0);
      p.x = 300;
      p.y = 260;
      p.aimAngle = 0;

      const shotElements: string[] = [];
      const shotDamages: number[] = [];

      for (let s = 0; s < 3; s++) {
        p.weaponHeat = 0; // keep out of orange zone to test base damages (11, 11, 17)
        p.fireCooldownTimer = 0;
        sim.consumeEvents();
        sim.tryFireActiveWeapon(p);
        const vEv = sim.consumeEvents().find((e) => e.kind === 'bullet_volley_spawned');
        expect(vEv).toBeDefined();
        if (vEv?.kind === 'bullet_volley_spawned') {
          shotElements.push(vEv.element);
          shotDamages.push(vEv.damage);
        }
      }

      expect(shotElements).toEqual(['burn', 'chill', 'shock']);
      expect(shotDamages).toEqual([11, 11, 17]);

      // Verify 3rd shot Large Elemental Orb explodes with r = 56px on impact
      const splashTarget = sim.spawnEnemy('wild_boar', p.x + 80, p.y + 40, true); // within 56px of impact at (p.x + 80, p.y)
      splashTarget.hp = 300;
      const directTarget = sim.spawnEnemy('wild_boar', p.x + 80, p.y, true);
      directTarget.hp = 300;
      for (let t = 0; t < 15; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }
      expect(directTarget.hp).toBeLessThan(300);
      expect(splashTarget.hp).toBeLessThan(300);

      // Now test Tactical Vent [R] at 75% heat: clears enemy projectiles within r=56px and fires Triangle Beam (22 DMG, r=72px, 100% element)
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      const ventEnemy = sim.spawnEnemy('wild_boar', p.x + 140, p.y, true);
      ventEnemy.hp = 300;
      ventEnemy.maxHp = 300;

      sim.projectiles.push(
        sim.acquireProjectile({
          id: 9501,
          ownerId: ventEnemy.id,
          team: 'enemy',
          weaponId: 'goblin_bow',
          x: p.x + 40, // within r = 56px of player
          y: p.y,
          vx: -150,
          vy: 0,
          angle: Math.PI,
          radius: 5,
          damage: 2,
          isCrit: false,
          knockback: 20,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 3.0,
          element: 'none',
          amplifiedByShield: false,
        }),
      );

      p.weaponHeat = 75;
      p.overheatLockTimer = 0;
      sim.consumeEvents();

      sim.setPlayerInput({
        seq: 10,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      expect(p.weaponHeat).toBe(0);
      expect(sim.projectiles.filter((b) => b.team === 'enemy' && b.ttlSec > 0)).toHaveLength(0);
      expect(300 - ventEnemy.hp).toBe(22);
      expect(
        ventEnemy.burnTimer > 0 || ventEnemy.chillTimer > 0 || ventEnemy.shockTimer > 0,
      ).toBe(true);
    });

    it('knight_sword: deals 12 -> 14 -> 24 DMG with KB 150/180/260, range 56px, and launches a 240px piercing Crescent Sword Wave on Hit 3', () => {
      const sim = createCleanSim(1008);
      const p = sim.player;
      sim.selectCharacter(p.id, 'vanguard');
      p.weaponSlots = ['knight_sword'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.skillActiveTimer = 0;

      expect(WEAPONS.knight_sword!.damage).toBe(12);
      expect(WEAPONS.knight_sword!.fireRate).toBeCloseTo(2.1, 3);
      expect(WEAPONS.knight_sword!.knockback).toBe(150);
      expect(WEAPONS.knight_sword!.procCoefficient).toBeCloseTo(0.8, 3);

      // Force deterministic non-crit rolls by setting baseCritChance / weapon crit or checking damage_dealt
      const closeEnemy = sim.spawnEnemy('spore_guardian', p.x + 50, p.y, true); // immobile so knockback doesn't push out of range
      closeEnemy.hp = 500;
      closeEnemy.maxHp = 500;

      const farWaveEnemy1 = sim.spawnEnemy('spore_guardian', p.x + 160, p.y, true);
      farWaveEnemy1.hp = 500;
      farWaveEnemy1.maxHp = 500;
      const farWaveEnemy2 = sim.spawnEnemy('spore_guardian', p.x + 220, p.y, true);
      farWaveEnemy2.hp = 500;
      farWaveEnemy2.maxHp = 500;

      // Hit 1 (12 DMG)
      p.x = 200;
      closeEnemy.x = 250; // within 56px after lunge
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      let dmgEv = sim.consumeEvents().find((e) => e.kind === 'damage_dealt' && e.targetId === closeEnemy.id);
      expect(dmgEv).toBeDefined();
      if (dmgEv?.kind === 'damage_dealt') {
        expect(dmgEv.isCrit ? Math.round(12 * 1.5) : 12).toBe(dmgEv.amount);
      }

      // Hit 2 (14 DMG)
      p.x = 200;
      closeEnemy.x = 250;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      dmgEv = sim.consumeEvents().find((e) => e.kind === 'damage_dealt' && e.targetId === closeEnemy.id);
      expect(dmgEv).toBeDefined();
      if (dmgEv?.kind === 'damage_dealt') {
        expect(dmgEv.isCrit ? Math.round(14 * 1.5) : 14).toBe(dmgEv.amount);
      }

      // Hit 3 (24 DMG + 240px piercing Crescent Sword Wave)
      p.x = 200;
      closeEnemy.x = 240;
      farWaveEnemy1.x = 340; // 140px from player
      farWaveEnemy2.x = 410; // 210px from player (within 240px range!)
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      // Step projectiles so the Crescent Sword Wave travels 240px and pierces both far enemies
      for (let t = 0; t < 35; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }
      expect(farWaveEnemy1.hp).toBeLessThan(500);
      expect(farWaveEnemy2.hp).toBeLessThan(500);
    });

    it('tesla_carbine: spawns with DYNAMIC_BOUNCE, triggers Smart Bounce (+35% Additive DMG & replacedProjectileId) after piercing an enemy or passing through flipped Barricade, chains lightning to 3 targets on Finale Shot, and grants +1 bounce on Perfect Reload', () => {
      const sim = createCleanSim(1009);
      const p = sim.player;
      sim.selectCharacter(p.id, 'engineer');
      p.weaponSlots = ['tesla_carbine'];
      sim.equipWeaponSlot(0);

      expect(WEAPONS.tesla_carbine!.clipSize).toBe(8);
      expect(WEAPONS.tesla_carbine!.reloadDurationSec).toBeCloseTo(1.0, 3);
      expect(WEAPONS.tesla_carbine!.damage).toBe(12);
      expect(WEAPONS.tesla_carbine!.pierceCount).toBe(1);
      expect(WEAPONS.tesla_carbine!.bounceCount).toBe(2);
      expect(WEAPONS.tesla_carbine!.procCoefficient).toBeCloseTo(0.6, 3);
      expect(WEAPONS.tesla_carbine!.element).toBe('shock');

      // 1. Shoot through a flipped Barricade toward left wall (x = 32), with an off-axis enemy at (180, 140)
      p.x = 120;
      p.y = 260;
      p.aimAngle = Math.PI; // aiming straight West toward left wall

      const barricade = sim.spawnProp('moss_table', 85, 260);
      sim.flipCoverProp(barricade, p);
      expect(barricade.coverState).toBe('flipped');

      const offAxisEnemy = sim.spawnEnemy('wild_boar', 180, 140, true);
      offAxisEnemy.hp = 400;
      offAxisEnemy.maxHp = 400;

      sim.consumeEvents();
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);

      const initialVolley = sim.consumeEvents().find((e) => e.kind === 'bullet_volley_spawned');
      expect(initialVolley).toBeDefined();
      if (initialVolley?.kind === 'bullet_volley_spawned') {
        expect((initialVolley.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).toBe(
          SHOT_FLAG.DYNAMIC_BOUNCE,
        );
      }
      const initialProjId = sim.projectiles[0]!.id;

      // Step projectiles until the bullet passes through the flipped barricade and hits the West wall
      let smartBounceVolley: Extract<
        ReturnType<typeof sim.consumeEvents>[number],
        { kind: 'bullet_volley_spawned' }
      > | null = null;
      for (let t = 0; t < 25; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
        const evs = sim.consumeEvents();
        const found = evs.find(
          (e) => e.kind === 'bullet_volley_spawned' && e.replacedProjectileId === initialProjId,
        );
        if (found && found.kind === 'bullet_volley_spawned') {
          smartBounceVolley = found;
          break;
        }
      }

      expect(smartBounceVolley).not.toBeNull();
      expect(smartBounceVolley!.damage).toBe(Math.round(12 * 1.35)); // +35% Additive DMG!
      const expectedSmartAngle = Math.atan2(
        offAxisEnemy.y - smartBounceVolley!.y,
        offAxisEnemy.x - smartBounceVolley!.x,
      );
      expect(smartBounceVolley!.angle).toBeCloseTo(expectedSmartAngle, 2);

      // 2. Finale Shot chains lightning to up to 3 targets
      sim.projectiles.length = 0;
      sim.enemies.length = 0;
      p.x = 300;
      p.y = 260;
      p.aimAngle = 0;
      p.clipAmmo = 1; // Finale Shot!

      const e1 = sim.spawnEnemy('wild_boar', 360, 260, true);
      const e2 = sim.spawnEnemy('wild_boar', 410, 280, true);
      const e3 = sim.spawnEnemy('wild_boar', 450, 250, true);
      e1.hp = 300;
      e2.hp = 300;
      e3.hp = 300;

      sim.consumeEvents();
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      for (let t = 0; t < 15; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }
      const finaleEvs = sim.consumeEvents();
      expect(finaleEvs.filter((e) => e.kind === 'chain_lightning').length).toBeGreaterThanOrEqual(
        2,
      );
      expect(e1.hp).toBeLessThan(300);
      expect(e2.hp).toBeLessThan(300);
      expect(e3.hp).toBeLessThan(300);

      // 3. Perfect Reload [R] grants +1 extra wall bounce for the new magazine (bounceCount = 2 + 1 = 3)
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.5; // progress = 0.50
      p.reloadLockout = false;
      sim.setPlayerInput({
        seq: 20,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);
      expect(p.clipAmmo).toBe(8);

      sim.consumeEvents();
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      const boostedVolley = sim.consumeEvents().find((e) => e.kind === 'bullet_volley_spawned');
      expect(boostedVolley).toBeDefined();
      if (boostedVolley?.kind === 'bullet_volley_spawned') {
        expect(boostedVolley.bounceCount).toBe(3); // 2 base + 1 bonus bounce!
      }
    });

    it('emits lungeDx/lungeDy on melee_swing, shifts prevX/prevY for continuous glide interpolation, and does not freeze regular combo hits with 35ms hit_stop', () => {
      const sim = createCleanSim(4109);
      const p = sim.player;
      p.weaponSlots = ['knight_sword'];
      sim.equipWeaponSlot(0);
      p.x = 300;
      p.y = 260;
      p.prevX = 300;
      p.prevY = 260;
      p.vx = 0;
      p.vy = 0;
      p.aimAngle = 0;
      p.critChance = -1; // 0% crit
      p.meleeComboStep = 0;

      const boar = sim.spawnEnemy('wild_boar', 350, 260, true);
      boar.hp = 500;
      boar.maxHp = 500;

      sim.consumeEvents();
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);

      const evs1 = sim.consumeEvents();
      const swing1 = evs1.find((e) => e.kind === 'melee_swing');
      expect(swing1).toBeDefined();
      if (swing1?.kind === 'melee_swing') {
        expect(swing1.lungeDx).toBeCloseTo(24, 2);
        expect(swing1.lungeDy).toBeCloseTo(0, 2);
      }
      // prevX shifted by lungeDx so tick interpolation doesn't snap 24px before client lunge glide
      expect(p.prevX).toBeCloseTo(324, 2);
      // Regular Hit 1 (non-crit, non-finisher) does NOT emit a 35ms simulation-freezing hit_stop
      expect(evs1.some((e) => e.kind === 'hit_stop')).toBe(false);

      // Hit 3 Finisher DOES emit a crisp micro hit_stop (<= 20ms) on enemy hit
      p.meleeComboStep = 2;
      p.fireCooldownTimer = 0;
      boar.x = 340;
      boar.y = 260;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      const evs3 = sim.consumeEvents();
      const hitStop3 = evs3.find((e) => e.kind === 'hit_stop');
      expect(hitStop3).toBeDefined();
      if (hitStop3?.kind === 'hit_stop') {
        expect(hitStop3.durationMs).toBeGreaterThan(0);
        expect(hitStop3.durationMs).toBeLessThanOrEqual(20);
      }
    });
  });
});

