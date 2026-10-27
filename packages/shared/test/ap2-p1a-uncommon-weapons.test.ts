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

describe('AP2 P1A.2 — Uncommon Weapons Trio: scrap_shotgun, gale_smg & frag_launcher', () => {
  describe('1. scrap_shotgun (CLIP_RELOAD, clip=2, reload=0.85s, 5x6=30 DMG, kb=250, procCoeff=0.22)', () => {
    it('matches Spec 4.3 stats, deals x1.35 Point-Blank DMG when dist <= 96px, and knocks enemies into walls for Wall-Slam', () => {
      const wep = WEAPONS.scrap_shotgun!;
      expect(wep).toBeDefined();
      expect(wep.cadenceKind).toBe('CLIP_RELOAD');
      expect(wep.clipSize).toBe(2);
      expect(wep.reloadDurationSec).toBeCloseTo(0.85, 3);
      expect(wep.damage).toBe(5);
      expect(wep.pelletCount).toBe(6);
      expect(wep.damage * wep.pelletCount).toBe(30);
      expect(wep.knockback).toBe(250);
      expect(wep.procCoefficient).toBeCloseTo(0.22, 3);

      const sim = createCleanSim(2101);
      const p = sim.player;
      sim.selectCharacter(p.id, 'engineer');
      p.weaponSlots = ['scrap_shotgun'];
      sim.equipWeaponSlot(0);
      p.x = 240;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // 1. Far target (dist = 150px > 96px) -> normal pellet damage (5 DMG per pellet)
      const farEnemy = sim.spawnEnemy('spore_guardian', p.x + 150, p.y, true);
      farEnemy.hp = 600;
      farEnemy.maxHp = 600;
      farEnemy.radius = 40; // large hitbox to catch all 6 pellets at 150px

      p.clipAmmo = 2;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      for (let t = 0; t < 25; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }
      const farDmgTaken = 600 - farEnemy.hp;
      expect(farDmgTaken).toBe(30); // 6 pellets * 5 DMG = 30 DMG

      // 2. Point-Blank target (dist = 64px <= 96px) near East wall -> x1.35 DMG per pellet (Math.round(5 * 1.35) = 7 DMG * 6 = 42 DMG) + Wall-Slam!
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      const wallTx = 14;
      const wallTy = Math.floor(p.y / TILE_SIZE);
      for (let dy = -1; dy <= 1; dy++) {
        sim.map.setTile(wallTx, wallTy + dy, 'wall');
      }
      const wallWorldX = wallTx * TILE_SIZE; // 448
      p.x = wallWorldX - 88; // 360
      const nearEnemy = sim.spawnEnemy('wild_boar', p.x + 56, p.y, true); // at x = 416 (dist = 56px <= 96px, 32px from wall)
      nearEnemy.hp = 600;
      nearEnemy.maxHp = 600;
      nearEnemy.radius = 22;

      p.clipAmmo = 2; // 1st shot (non-finale)
      p.reloadTimer = 0;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();

      sim.tryFireActiveWeapon(p);
      let wallSlamTriggered = false;
      const pelletHitAmounts: number[] = [];

      for (let t = 0; t < 15; t++) {
        sim.step(SIM_STEP_SEC);
        for (const ev of sim.consumeEvents()) {
          if (ev.kind === 'wall_slam' && ev.enemyId === nearEnemy.id) {
            wallSlamTriggered = true;
          }
          if (
            ev.kind === 'damage_dealt' &&
            ev.targetId === nearEnemy.id &&
            (ev.knockbackX !== 0 || ev.knockbackY !== 0)
          ) {
            pelletHitAmounts.push(ev.amount);
          }
        }
      }

      expect(pelletHitAmounts.length).toBe(6);
      for (const amt of pelletHitAmounts) {
        expect(amt).toBe(Math.round(5 * 1.35)); // 7 DMG per pellet (x1.35 Point-Blank multiplier)
      }
      expect(wallSlamTriggered).toBe(true);
    });

    it('2nd Finale Shot fires red-hot scrap (+50% Additive DMG, applies Burn), and Perfect Reload [R] ejects 2 hot shells forward along aimAngle for 16 Burn DMG + 0.3s stun', () => {
      const sim = createCleanSim(2102);
      const p = sim.player;
      sim.selectCharacter(p.id, 'engineer');
      p.weaponSlots = ['scrap_shotgun'];
      sim.equipWeaponSlot(0);
      p.x = 240;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      const enemy = sim.spawnEnemy('spore_guardian', p.x + 130, p.y, true);
      enemy.hp = 600;
      enemy.maxHp = 600;
      enemy.radius = 36;

      // 1. Fire 2nd shot (Finale Shot, clipAmmo = 1): +50% Additive DMG + Burn status
      p.clipAmmo = 1;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      const volleyEv = sim.consumeEvents().find((e) => e.kind === 'bullet_volley_spawned');
      expect(volleyEv).toBeDefined();
      if (volleyEv?.kind === 'bullet_volley_spawned') {
        expect((volleyEv.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT).toBe(SHOT_FLAG.FINALE_SHOT);
        expect(volleyEv.damage).toBe(Math.round(5 * 1.5)); // 8 DMG per pellet (+50% Additive DMG)
        expect(volleyEv.element).toBe('burn');
      }

      for (let t = 0; t < 20; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }
      expect(enemy.burnTimer).toBeGreaterThan(0);
      expect(600 - enemy.hp).toBe(6 * Math.round(5 * 1.5)); // 6 * 8 = 48 DMG

      // 2. Perfect Reload [R] during reload golden window [0.45, 0.70]:
      // Ejects 2 hot shells forward along p.aimAngle dealing 16 Burn DMG + 0.3s stun (stunTimer >= 0.3)
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      const frontEnemy = sim.spawnEnemy('wild_boar', p.x + 72, p.y, true);
      frontEnemy.hp = 400;
      frontEnemy.maxHp = 400;
      frontEnemy.burnTimer = 0;
      frontEnemy.stunTimer = 0;

      p.clipAmmo = 0;
      p.reloadDuration = 0.85;
      p.reloadTimer = 0.4; // progress = 1 - 0.40/0.85 = 0.529 (inside [0.45, 0.70])
      p.reloadLockout = false;
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

      expect(p.clipAmmo).toBe(2);
      expect(p.reloadTimer).toBe(0);
      expect(p.overclockedNextShot).toBe(true);
      expect(400 - frontEnemy.hp).toBe(16);
      expect(frontEnemy.burnTimer).toBeGreaterThan(0);
      expect(frontEnemy.stunTimer).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('2. gale_smg (HEAT_VENT, 5 DMG, Orange Heat 6.25 DMG, Spin-up 6.0 -> 10.5/s, heatPerShot=3.0%, procCoeff=0.25)', () => {
    it('spins up fire rate linearly from 6.0 to 10.5/s while holding trigger and grants +15% player move speed while spinning up / firing', () => {
      const wep = WEAPONS.gale_smg!;
      expect(wep).toBeDefined();
      expect(wep.cadenceKind).toBe('HEAT_VENT');
      expect(wep.damage).toBe(5);
      expect(wep.heatPerShot).toBeCloseTo(3.0, 3);
      expect(wep.procCoefficient).toBeCloseTo(0.25, 3);

      const sim = createCleanSim(2103);
      const p = sim.player;
      sim.selectCharacter(p.id, 'engineer');
      p.weaponSlots = ['gale_smg'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;

      // Measure baseline move speed without firing
      for (let t = 0; t < 15; t++) {
        sim.setPlayerInput({
          seq: t + 1,
          tick: sim.tick + 1,
          moveX: 1,
          moveY: 0,
          aimAngle: 0,
          buttons: 0,
          weaponSlotSelect: null,
        });
        sim.step(SIM_STEP_SEC);
      }
      const baseSpeedVx = p.vx;
      expect(baseSpeedVx).toBeCloseTo(p.moveSpeed, 1);

      // 1. Start holding FIRE at fireHoldTimer = 0 -> initial fire rate is 6.0/s
      p.weaponHeat = 0;
      p.fireHoldTimer = 0;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      const rateAtStart = 1 / p.fireCooldownTimer;
      expect(rateAtStart).toBeCloseTo(6.0, 2);

      // 2. Mid spin-up (50% of spin-up duration = 0.6s) -> linear midpoint 8.25/s
      p.weaponHeat = 0;
      p.fireHoldTimer = 0.6;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      const rateAtMid = 1 / p.fireCooldownTimer;
      expect(rateAtMid).toBeCloseTo(8.25, 2);

      // 3. Full spin-up (>= 1.2s) -> 10.5/s
      p.weaponHeat = 0;
      p.fireHoldTimer = 1.2;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      const rateAtMax = 1 / p.fireCooldownTimer;
      expect(rateAtMax).toBeCloseTo(10.5, 2);

      // 4. Verify +15% player movement speed while holding FIRE with gale_smg
      p.x = 200;
      for (let t = 0; t < 15; t++) {
        p.weaponHeat = 20; // keep below orange zone & overheat
        sim.setPlayerInput({
          seq: 100 + t,
          tick: sim.tick + 1,
          moveX: 1,
          moveY: 0,
          aimAngle: 0,
          buttons: INPUT_BUTTON.FIRE,
          weaponSlotSelect: null,
        });
        sim.step(SIM_STEP_SEC);
      }
      expect(p.vx).toBeCloseTo(p.moveSpeed * 1.15, 1);
    });

    it('in Orange Heat Zone (65%..95%), deals 6.25 DMG and launches a Piercing Wind Blade (14 DMG, kb=140, pierces enemies) every 6th shot', () => {
      const sim = createCleanSim(2104);
      const p = sim.player;
      sim.selectCharacter(p.id, 'engineer');
      p.weaponSlots = ['gale_smg'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // Fire 6 shots in Orange Heat Zone (start at 65% heat -> 65, 68, 71, 74, 77, 80 all inside [65, 95])
      p.weaponHeat = 65;
      sim.consumeEvents();
      for (let s = 1; s <= 6; s++) {
        p.fireCooldownTimer = 0;
        sim.tryFireActiveWeapon(p);
      }

      const volleys = sim
        .consumeEvents()
        .filter((e) => e.kind === 'bullet_volley_spawned');
      const smgVolleys = volleys.filter(
        (e) => e.kind === 'bullet_volley_spawned' && e.weaponId === 'gale_smg',
      );
      const windBladeVolleys = volleys.filter(
        (e) => e.kind === 'bullet_volley_spawned' && e.weaponId === 'gale_smg_wind_blade',
      );

      expect(smgVolleys).toHaveLength(6);
      if (smgVolleys[0]?.kind === 'bullet_volley_spawned') {
        expect(smgVolleys[0].damage).toBeCloseTo(6.25, 2);
      }
      expect(windBladeVolleys).toHaveLength(1);
      if (windBladeVolleys[0]?.kind === 'bullet_volley_spawned') {
        expect(windBladeVolleys[0].damage).toBe(14);
        expect(windBladeVolleys[0].knockback).toBe(140);
        expect(windBladeVolleys[0].pierceCount).toBeGreaterThanOrEqual(2);
      }

      // Verify the Piercing Wind Blade pierces through multiple lined-up enemies dealing 14 DMG + kb=140
      sim.projectiles.length = 0;
      p.weaponHeat = 70;
      // Fire 5 more orange shots then the 6th shot with 2 lined-up enemies ahead
      for (let s = 1; s <= 5; s++) {
        p.weaponHeat = 70;
        p.fireCooldownTimer = 0;
        sim.tryFireActiveWeapon(p);
      }
      sim.projectiles.length = 0;

      const e1 = sim.spawnEnemy('wild_boar', p.x + 80, p.y, true);
      const e2 = sim.spawnEnemy('wild_boar', p.x + 150, p.y, true);
      e1.hp = 400;
      e2.hp = 400;

      p.weaponHeat = 70;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      // Remove the normal non-piercing bullet so we isolate the Piercing Wind Blade hitting both e1 and e2
      sim.projectiles = sim.projectiles.filter((b) => b.weaponId === 'gale_smg_wind_blade');
      expect(sim.projectiles).toHaveLength(1);

      for (let t = 0; t < 20; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }

      expect(400 - e1.hp).toBe(14);
      expect(400 - e2.hp).toBe(14);
      expect(e1.kbVx).toBeCloseTo(140, 1);
      expect(e2.kbVx).toBeCloseTo(140, 1);
    });

    it('Tactical Vent [R] in Orange Heat explodes Cyclone (r=96px, 24 DMG), destroys nearby enemy bullets, and knocks enemies into walls for Wall-Slam', () => {
      const sim = createCleanSim(2105);
      const p = sim.player;
      sim.selectCharacter(p.id, 'engineer');
      p.weaponSlots = ['gale_smg'];
      sim.equipWeaponSlot(0);

      // Place wall at East side close to enemy
      const wallTx = 14;
      const wallTy = 8;
      for (let dy = -1; dy <= 1; dy++) {
        sim.map.setTile(wallTx, wallTy + dy, 'wall');
      }
      const wallWorldX = wallTx * TILE_SIZE; // 448
      p.x = wallWorldX - 86; // 362
      p.y = wallTy * TILE_SIZE + 16; // 272
      p.aimAngle = 0;

      const nearEnemy = sim.spawnEnemy('wild_boar', p.x + 58, p.y, true); // dist = 58px <= 96px, 28px from wall
      nearEnemy.hp = 500;
      nearEnemy.maxHp = 500;

      // Spawn an enemy projectile at dist = 80px (<= 96px cyclone radius)
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 9701,
          ownerId: nearEnemy.id,
          team: 'enemy',
          weaponId: 'goblin_bow',
          x: p.x - 80,
          y: p.y,
          vx: 120,
          vy: 0,
          angle: 0,
          radius: 5,
          damage: 2,
          isCrit: false,
          knockback: 20,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 2.0,
          element: 'none',
          amplifiedByShield: false,
        }),
      );

      p.weaponHeat = 75;
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

      let destroyedEvSeen = false;
      let cycloneExplosionSeen = false;
      let wallSlamSeen = false;

      for (let t = 0; t < 12; t++) {
        if (t > 0) {
          sim.setPlayerInput({
            seq: t + 1,
            tick: sim.tick + 1,
            moveX: 0,
            moveY: 0,
            aimAngle: 0,
            buttons: 0,
            weaponSlotSelect: null,
          });
        }
        sim.step(SIM_STEP_SEC);
        for (const ev of sim.consumeEvents()) {
          if (ev.kind === 'projectiles_destroyed' && ev.ids.includes(9701)) {
            destroyedEvSeen = true;
          }
          if (
            ev.kind === 'explosion' &&
            ev.sourceDefId === 'gale_smg' &&
            ev.radius === 96 &&
            ev.damage === 24
          ) {
            cycloneExplosionSeen = true;
          }
          if (ev.kind === 'wall_slam' && ev.enemyId === nearEnemy.id) {
            wallSlamSeen = true;
          }
        }
      }

      expect(p.weaponHeat).toBe(0);
      expect(destroyedEvSeen).toBe(true);
      expect(cycloneExplosionSeen).toBe(true);
      expect(wallSlamSeen).toBe(true);
      expect(nearEnemy.hp).toBeLessThan(500 - 24); // 24 Cyclone DMG + Wall-Slam DMG
    });
  });

  describe('3. frag_launcher (CLIP_RELOAD, clip=3, reload=1.10s, main blast 22 Burn DMG r=68px, 5x6 DMG submunitions max 2 per target, procCoeff=0.65/0.20)', () => {
    it('matches Spec 4.3 stats, bounces 1 beat then explodes for 22 Burn DMG (r=68px) + 5x6 DMG submunitions capped at max 2 submunitions per target', () => {
      const wep = WEAPONS.frag_launcher!;
      expect(wep).toBeDefined();
      expect(wep.cadenceKind).toBe('CLIP_RELOAD');
      expect(wep.clipSize).toBe(3);
      expect(wep.reloadDurationSec).toBeCloseTo(1.1, 3);
      expect(wep.damage).toBe(22);
      expect(wep.element).toBe('burn');
      expect(wep.bounceCount).toBe(1);
      expect(wep.procCoefficient).toBeCloseTo(0.65, 3);
      expect(wep.submunitionProcCoefficient).toBeCloseTo(0.2, 3);

      const sim = createCleanSim(2106);
      const p = sim.player;
      sim.selectCharacter(p.id, 'engineer');
      p.weaponSlots = ['frag_launcher'];
      sim.equipWeaponSlot(0);
      p.x = 220;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // Place a wall ahead at x = 352 so grenade bounces 1 beat off the wall then detonates near target
      const wallTx = 11; // 11 * 32 = 352
      const wallTy = Math.floor(p.y / TILE_SIZE);
      sim.map.setTile(wallTx, wallTy, 'wall');

      const enemy = sim.spawnEnemy('spore_guardian', p.x + 88, p.y + 28, true);
      enemy.hp = 600;
      enemy.maxHp = 600;
      enemy.radius = 28;

      p.clipAmmo = 3;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      let mainBlastSeen = false;
      let subVolleySpawnedCount = 0;
      const damageHits: number[] = [];

      for (let t = 0; t < 45; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
        for (const ev of sim.consumeEvents()) {
          if (
            ev.kind === 'explosion' &&
            ev.sourceDefId === 'frag_launcher' &&
            ev.radius === 68 &&
            ev.damage === 22
          ) {
            mainBlastSeen = true;
          }
          if (ev.kind === 'bullet_volley_spawned' && ev.weaponId === 'frag_launcher_sub') {
            subVolleySpawnedCount = ev.pelletCount;
            expect(ev.damage).toBe(6);
          }
          if (ev.kind === 'damage_dealt' && ev.targetId === enemy.id) {
            damageHits.push(ev.amount);
          }
        }
      }

      expect(mainBlastSeen).toBe(true);
      expect(subVolleySpawnedCount).toBe(5);
      // Main explosion deals 22 Burn DMG, and at most 2 submunitions (2 * 6 = 12 DMG) can hit the same target!
      const subHits = damageHits.filter((d) => d === 6);
      expect(subHits.length).toBeLessThanOrEqual(2);
      expect(subHits.length).toBe(2);
      expect(600 - enemy.hp).toBe(22 + 2 * 6); // 34 DMG total (never 22 + 5 * 6 = 52!)
      expect(enemy.burnTimer).toBeGreaterThan(0);
    });

    it('Hold-and-Release Airburst: holding FIRE on shot and releasing FIRE mid-flight triggers Airburst (r=104px) bypassing iron_shielder front shield', () => {
      const sim = createCleanSim(2107);
      const p = sim.player;
      sim.selectCharacter(p.id, 'engineer');
      p.weaponSlots = ['frag_launcher'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // Spawn an iron_shielder facing West (aimAngle = Math.PI) directly toward the player (frontal shield blocks normal frontal shots!)
      const shielder = sim.spawnEnemy('iron_shielder', p.x + 140, p.y + 30, true);
      shielder.hp = 500;
      shielder.maxHp = 500;
      shielder.aimAngle = Math.PI; // facing directly toward player

      // 1. Hold FIRE to launch grenade
      p.clipAmmo = 3;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      for (let t = 0; t < 15; t++) {
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
        shielder.x = p.x + 140;
        shielder.y = p.y + 30;
        shielder.aimAngle = Math.PI;
      }

      // Grenade is currently in flight (~105px east of player, within 104px of shielder at +140,+30)
      const inFlightGrenade = sim.projectiles.find((b) => b.weaponId === 'frag_launcher');
      expect(inFlightGrenade).toBeDefined();

      // 2. Release FIRE (buttons = 0) while grenade is mid-flight -> triggers Airburst (r = 104px) immediately!
      sim.setPlayerInput({
        seq: 20,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });

      let airburstExplosionSeen = false;
      const shielderDamages: Array<{ amount: number; hitArmor: boolean }> = [];

      for (let t = 0; t < 20; t++) {
        if (t > 0) {
          sim.setPlayerInput({
            seq: 20 + t,
            tick: sim.tick + 1,
            moveX: 0,
            moveY: 0,
            aimAngle: 0,
            buttons: 0,
            weaponSlotSelect: null,
          });
        }
        shielder.aimAngle = Math.PI;
        sim.step(SIM_STEP_SEC);
        for (const ev of sim.consumeEvents()) {
          if (
            ev.kind === 'explosion' &&
            ev.sourceDefId === 'frag_launcher' &&
            ev.radius === 104 &&
            ev.damage === 22
          ) {
            airburstExplosionSeen = true;
          }
          if (ev.kind === 'damage_dealt' && ev.targetId === shielder.id && ev.amount >= 6) {
            shielderDamages.push({ amount: ev.amount, hitArmor: ev.hitArmor });
          }
        }
      }

      expect(airburstExplosionSeen).toBe(true);
      // Verify Airburst blast (22 DMG) and submunitions (2 x 6 DMG) bypassed iron_shielder's front shield completely!
      expect(shielderDamages.some((d) => d.amount === 22 && d.hitArmor === false)).toBe(true);
      const unblockedSubHits = shielderDamages.filter(
        (d) => d.amount === 6 && d.hitArmor === false,
      );
      expect(unblockedSubHits).toHaveLength(2);
    });
  });
});
