import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  SIM_STEP_SEC,
  TILE_SIZE,
  WEAPONS,
  WorldSim,
  computeFocusLaserBeamWidth,
  computeFocusLaserTickDamage,
  triggerFocusLaserRailgunVent,
  triggerVoidStaffImplosion,
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

describe('AP2 P1B.1 — Rare & Epic Ranged Weapons: focus_laser & void_staff', () => {
  describe('1. focus_laser (Súng Tia Hội Tụ — Rare, HEAT_VENT, Fire/burn, 4 -> 11 DMG / 0.15s, range=520px, procCoeff=0.25)', () => {
    it('matches P1B.1 weapon stats, fires a 520px hitscan laser beam stopped by solid walls, and scales tick damage linearly from 4 at 0% heat to 11 at 95%+ heat every 0.15s', () => {
      const wep = WEAPONS.focus_laser!;
      expect(wep).toBeDefined();
      expect(wep.rarity).toBe('rare');
      expect(wep.cadenceKind).toBe('HEAT_VENT');
      expect(wep.damage).toBe(4);
      expect(wep.cooldownSec).toBeCloseTo(0.15, 3);
      expect(wep.heatPerShot).toBeCloseTo(4.5, 3);
      expect(wep.heatPerSec).toBeCloseTo(30, 3);
      expect(wep.range).toBe(520);
      expect(wep.procCoefficient).toBeCloseTo(0.25, 3);
      expect(wep.element).toBe('burn');

      // Linear damage & width scaling with heat: round(4 + 7 * min(1, heat / 95))
      expect(computeFocusLaserTickDamage(0)).toBe(4);
      expect(computeFocusLaserTickDamage(47.5)).toBe(8);
      expect(computeFocusLaserTickDamage(95)).toBe(11);
      expect(computeFocusLaserTickDamage(100)).toBe(11);
      expect(computeFocusLaserBeamWidth(95)).toBeGreaterThan(computeFocusLaserBeamWidth(0));

      const sim = createCleanSim(4101);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist');
      p.activeImbueElement = 'none';
      p.weaponSlots = ['focus_laser'];
      sim.equipWeaponSlot(0);
      p.x = 160;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      const enemy = sim.spawnEnemy('spore_guardian', p.x + 320, p.y, true);
      enemy.hp = 500;
      enemy.maxHp = 500;

      // 1. At 0% heat -> deals 4 Fire (burn) DMG and adds 4.5 heat
      p.weaponHeat = 0;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      expect(500 - enemy.hp).toBe(4);
      expect(enemy.burnTimer).toBeGreaterThan(0);
      expect(p.weaponHeat).toBeCloseTo(4.5, 3);
      expect(p.fireCooldownTimer).toBeCloseTo(0.15, 3);

      // 2. At 95% heat -> deals 11 Fire (burn) DMG
      enemy.hp = 500;
      p.weaponHeat = 95;
      p.overheatLockTimer = 0;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      expect(500 - enemy.hp).toBe(11);

      // 3. Normal hitscan laser beam is stopped by solid arena walls
      enemy.hp = 500;
      const wallTx = Math.floor((p.x + 160) / TILE_SIZE);
      const wallTy = Math.floor(p.y / TILE_SIZE);
      sim.map.setTile(wallTx, wallTy, 'wall');
      p.weaponHeat = 20;
      p.overheatLockTimer = 0;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);

      expect(enemy.hp).toBe(500);
    });

    it('refracts into 3 fan beams (0 rad, -0.32 rad, +0.32 rad, remaining range 360px) when intersecting a cryo_prism_pillar prop or an active Vanguard shield', () => {
      const sim = createCleanSim(4102);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist');
      p.activeImbueElement = 'none';
      p.weaponSlots = ['focus_laser'];
      sim.equipWeaponSlot(0);
      p.x = 160;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // 1. Refraction via cryo_prism_pillar prop
      const prism = sim.spawnProp('cryo_prism_pillar', p.x + 140, p.y);
      expect(prism.hp).toBeGreaterThan(0);

      const distFromPrism = 220; // <= 360px remaining range
      const eCenter = sim.spawnEnemy(
        'spore_guardian',
        prism.x + Math.cos(0) * distFromPrism,
        prism.y + Math.sin(0) * distFromPrism,
        true,
      );
      const eUp = sim.spawnEnemy(
        'spore_guardian',
        prism.x + Math.cos(-0.32) * distFromPrism,
        prism.y + Math.sin(-0.32) * distFromPrism,
        true,
      );
      const eDown = sim.spawnEnemy(
        'spore_guardian',
        prism.x + Math.cos(0.32) * distFromPrism,
        prism.y + Math.sin(0.32) * distFromPrism,
        true,
      );
      eCenter.hp = 500;
      eUp.hp = 500;
      eDown.hp = 500;

      p.weaponHeat = 0;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      expect(500 - eCenter.hp).toBe(4);
      expect(500 - eUp.hp).toBe(4);
      expect(500 - eDown.hp).toBe(4);

      // 2. Refraction via active Vanguard shield (p.characterId === 'vanguard' && p.skillActiveTimer > 0)
      sim.props.length = 0;
      sim.enemies.length = 0;
      sim.selectCharacter(p.id, 'vanguard');
      p.weaponSlots = ['focus_laser'];
      sim.equipWeaponSlot(0);
      p.x = 160;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;
      p.skillActiveTimer = 2.5;
      p.vanguardShieldBonusAdd = 0;

      const shieldOriginX = p.x + 24;
      const shieldOriginY = p.y;
      const sCenter = sim.spawnEnemy(
        'spore_guardian',
        shieldOriginX + Math.cos(0) * 200,
        shieldOriginY + Math.sin(0) * 200,
        true,
      );
      const sUp = sim.spawnEnemy(
        'spore_guardian',
        shieldOriginX + Math.cos(-0.32) * 200,
        shieldOriginY + Math.sin(-0.32) * 200,
        true,
      );
      const sDown = sim.spawnEnemy(
        'spore_guardian',
        shieldOriginX + Math.cos(0.32) * 200,
        shieldOriginY + Math.sin(0.32) * 200,
        true,
      );
      sCenter.hp = 500;
      sUp.hp = 500;
      sDown.hp = 500;

      p.weaponHeat = 0;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      expect(sCenter.hp).toBeLessThan(500);
      expect(sUp.hp).toBeLessThan(500);
      expect(sDown.hp).toBeLessThan(500);
    });

    it('Tactical Vent [R] in [65, 95] Orange Heat resets heat to 0, sets ventCooldownTimer=0.25, clears enemy bullets in r=56px, and fires a 520px piercing Railgun beam (width=28px, 46 Fire DMG, kb=240, burn) with RAILGUN XẢ ÁP! alert', () => {
      const sim = createCleanSim(4103);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist');
      p.activeImbueElement = 'none';
      p.weaponSlots = ['focus_laser'];
      sim.equipWeaponSlot(0);
      p.x = 160;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // Place a solid wall in the path to verify the Railgun beam pierces full-room (520px)
      const wallTx = Math.floor((p.x + 150) / TILE_SIZE);
      const wallTy = Math.floor(p.y / TILE_SIZE);
      sim.map.setTile(wallTx, wallTy, 'wall');

      // Two enemies along the 520px line (including one offset by 10px <= 14px half-width of 28px beam)
      const e1 = sim.spawnEnemy('wild_boar', p.x + 100, p.y + 8, true);
      const e2 = sim.spawnEnemy('spore_guardian', p.x + 420, p.y - 6, true);
      e1.hp = 500;
      e1.maxHp = 500;
      e2.hp = 500;
      e2.maxHp = 500;

      // Enemy projectile inside r=56px -> must be destroyed
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 9801,
          ownerId: e1.id,
          team: 'enemy',
          weaponId: 'goblin_bow',
          x: p.x + 40,
          y: p.y,
          vx: -100,
          vy: 0,
          angle: Math.PI,
          radius: 5,
          damage: 2,
          isCrit: false,
          knockback: 10,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 2.0,
          element: 'none',
          amplifiedByShield: false,
        }),
      );

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
      expect(
        events.some((ev) => ev.kind === 'projectiles_destroyed' && ev.ids.includes(9801)),
      ).toBe(true);

      expect(500 - e1.hp).toBe(46);
      expect(500 - e2.hp).toBe(46);
      expect(e1.burnTimer).toBeGreaterThan(0);
      expect(e2.burnTimer).toBeGreaterThan(0);
      expect(e1.kbVx).toBeGreaterThan(150);

      const railgunEv = events.find((ev) => ev.kind === 'focus_laser_railgun');
      expect(railgunEv).toBeDefined();
      if (railgunEv?.kind === 'focus_laser_railgun') {
        expect(railgunEv.damage).toBe(46);
        expect(railgunEv.width).toBe(28);
        expect(railgunEv.alertTextVi).toBe('RAILGUN XẢ ÁP!');
      }

      // Direct call to triggerFocusLaserRailgunVent also works deterministically
      p.weaponHeat = 75;
      e1.hp = 500;
      triggerFocusLaserRailgunVent(sim, p);
      expect(p.weaponHeat).toBe(0);
      expect(500 - e1.hp).toBe(46);
    });
  });

  describe('2. void_staff (Trượng Hư Không — Epic, CLIP_RELOAD, clip=2, reload=1.05s, Poison, 12 DMG pulse, 52..88 DMG Implosion)', () => {
    it('matches P1B.1 weapon stats, launches a Black Hole Singularity Orb (320 px/s, 360px range) that pulses every 0.20s (12 ticks) in r=110px to pull non-boss enemies, deal 12 Poison DMG, and swallow enemy projectiles', () => {
      const wep = WEAPONS.void_staff!;
      expect(wep).toBeDefined();
      expect(wep.rarity).toBe('epic');
      expect(wep.cadenceKind).toBe('CLIP_RELOAD');
      expect(wep.clipSize).toBe(2);
      expect(wep.reloadDurationSec).toBeCloseTo(1.05, 3);
      expect(wep.damage).toBe(12);
      expect(wep.projectileSpeed).toBe(320);
      expect(wep.range).toBe(360);
      expect(wep.procCoefficient).toBeCloseTo(1.0, 3);
      expect(wep.element).toBe('poison');

      const sim = createCleanSim(4104);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist');
      p.activeImbueElement = 'none';
      p.weaponSlots = ['void_staff'];
      sim.equipWeaponSlot(0);
      p.x = 180;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // Spawn a non-boss enemy within r=110px of the orb's flight path
      const enemy = sim.spawnEnemy('wild_boar', p.x + 90, p.y + 70, true);
      enemy.hp = 500;
      enemy.maxHp = 500;
      const startDistY = Math.abs(enemy.y - p.y);

      // Spawn 3 enemy bullets along the orb's path within r=110px
      for (let i = 0; i < 3; i++) {
        sim.projectiles.push(
          sim.acquireProjectile({
            id: 9900 + i,
            ownerId: enemy.id,
            team: 'enemy',
            weaponId: 'goblin_bow',
            x: p.x + 60 + i * 15,
            y: p.y + 40,
            vx: 0,
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

      p.clipAmmo = 2;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      const orb = sim.projectiles.find((b) => b.weaponId === 'void_staff')!;
      expect(orb).toBeDefined();
      expect(orb.ttlSec).toBeCloseTo(360 / 320, 3);

      const destroyedBulletIds: number[] = [];
      for (let t = 0; t < 12; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
        for (const ev of sim.consumeEvents()) {
          if (ev.kind === 'projectiles_destroyed') {
            destroyedBulletIds.push(...ev.ids);
          }
        }
      }

      // All 3 enemy bullets were swallowed and recorded in projectiles_destroyed
      expect(orb.swallowedBullets).toBe(3);
      expect(destroyedBulletIds).toEqual(expect.arrayContaining([9900, 9901, 9902]));
      expect(sim.projectiles.filter((b) => b.team === 'enemy')).toHaveLength(0);

      // Non-boss enemy was pulled toward the orb's Y axis and took 12 Poison DMG on the 12th tick (0.20s) pulse
      expect(Math.abs(enemy.y - p.y)).toBeLessThan(startDistY);
      expect(500 - enemy.hp).toBe(12);
      expect(enemy.poisonTimer).toBeGreaterThan(0);
    });

    it('triggers Void Implosion on Hold-and-Release FIRE (after >= 2 ticks in flight) or max range / wall hit, pulling enemies within r=110px (up to 42px) and dealing 52 + 6 * min(6, swallowedBullets) Poison DMG (up to 88 DMG) with HỐ ĐEN SỤP ĐỔ! alert', () => {
      const sim = createCleanSim(4105);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist');
      p.activeImbueElement = 'none';
      p.weaponSlots = ['void_staff'];
      sim.equipWeaponSlot(0);
      p.x = 180;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // 1. Hold FIRE for 4 ticks (>= 2 ticks in flight) to launch and arm the Singularity Orb
      p.clipAmmo = 2;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();

      for (let t = 0; t < 4; t++) {
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

      const orb = sim.projectiles.find((b) => b.weaponId === 'void_staff')!;
      expect(orb).toBeDefined();
      expect(orb.armedForReleaseImplosion).toBe(true);

      // Spawn 8 enemy bullets within r=110px of the orb -> swallows all 8, capping swallowedBullets at 6
      for (let i = 0; i < 8; i++) {
        sim.projectiles.push(
          sim.acquireProjectile({
            id: 9950 + i,
            ownerId: 999,
            team: 'enemy',
            weaponId: 'goblin_bow',
            x: orb.x + 20,
            y: orb.y + 10,
            vx: 0,
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

      // Spawn a non-boss enemy at 85px from the orb (<= 110px radius)
      const enemy = sim.spawnEnemy('wild_boar', orb.x + 85, orb.y, true);
      enemy.hp = 600;
      enemy.maxHp = 600;
      const distBeforeImplosion = Math.hypot(enemy.x - orb.x, enemy.y - orb.y);

      // Release FIRE (buttons = 0) -> triggers Void Implosion!
      sim.consumeEvents();
      sim.setPlayerInput({
        seq: 10,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      const events = sim.consumeEvents();
      const distAfterImplosion = Math.hypot(enemy.x - orb.x, enemy.y - orb.y);

      // Enemy was pulled tightly toward the orb center (~42px pull)
      expect(distBeforeImplosion - distAfterImplosion).toBeGreaterThanOrEqual(30);
      // Deals 52 + 6 * min(6, 8) = 88 Poison DMG
      expect(600 - enemy.hp).toBe(88);
      expect(enemy.poisonTimer).toBeGreaterThan(0);

      const implosionEv = events.find((ev) => ev.kind === 'void_implosion');
      expect(implosionEv).toBeDefined();
      if (implosionEv?.kind === 'void_implosion') {
        expect(implosionEv.damage).toBe(88);
        expect(implosionEv.swallowedBullets).toBe(6);
        expect(implosionEv.alertTextVi).toBe('HỐ ĐEN SỤP ĐỔ!');
      }

      // 2. Verify max-range expiry with 0 swallowed bullets triggers Void Implosion for 52 Poison DMG
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      p.clipAmmo = 2;
      p.reloadTimer = 0;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      const orb2 = sim.projectiles.find((b) => b.weaponId === 'void_staff')!;
      expect(orb2).toBeDefined();

      const endEnemy = sim.spawnEnemy('spore_guardian', p.x + 18 + 360 + 40, p.y, true);
      endEnemy.hp = 500;
      endEnemy.maxHp = 500;

      // Fast-forward orb2 to right before expiry at max range (x = p.x + 18 + 360)
      orb2.x = p.x + 18 + 356;
      orb2.y = p.y;
      orb2.ttlSec = SIM_STEP_SEC * 0.5;
      sim.updateProjectiles(SIM_STEP_SEC);

      expect(500 - endEnemy.hp).toBe(52);
      expect(endEnemy.poisonTimer).toBeGreaterThan(0);
      expect(typeof triggerVoidStaffImplosion).toBe('function');
    });
  });
});
