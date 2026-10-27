import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  OVERHEAT_LOCK_DURATION_SEC,
  WorldSim,
  equipPlayerWeaponSlot,
  getClipReloadGoldenWindow,
  getHeatVentOrangeZone,
  scaleRelicDamage,
} from '../src/index.js';

describe('AP2 Phase P2B.2 — Pacts & Relics #1–#3 (pact_soul_chain, pact_shattered_glass, pact_searing_trigger)', () => {
  describe('1. pact_soul_chain -> relic_blood_oath_tether', () => {
    it('links to nearest alive teammate in Co-op and drains 1 Armor every 2.5s when > 260px without reducing HP', () => {
      const sim = new WorldSim({
        seed: 20261028,
        coopMode: true,
        playerCount: 3,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
        autoRespawnWaves: false,
      });
      const p1 = sim.player;
      const p2 = sim.addCoopPlayer(2, 'ranger', 'Ranger P2', 2);
      const p3 = sim.addCoopPlayer(3, 'elementalist', 'Mage P3', 3);

      p1.x = 200;
      p1.y = 200;
      p2.x = 500; // 300px away (> 260px, nearest teammate)
      p2.y = 200;
      p3.x = 650; // 450px away
      p3.y = 200;

      p1.pactChoices = ['pact_soul_chain', 'pact_shattered_glass'];
      expect(sim.selectAshenPact('pact_soul_chain', p1.id)).toBe(true);
      expect(p1.activePactId).toBe('pact_soul_chain');

      const startHp = p1.hp;
      const startArmor = p1.armor;
      expect(startArmor).toBeGreaterThanOrEqual(2);

      // Step 2.5s (150 ticks at 60Hz) while stretched > 260px -> drains 1 Armor
      for (let i = 0; i < 150; i++) {
        sim.step(1 / 60);
      }
      expect(p1.soulChainTargetId).toBe(p2.id);
      expect(p1.soulChainTargetKind).toBe('player');
      expect(p1.armor).toBe(startArmor - 1);
      expect(p1.hp).toBe(startHp);

      // Even if armor is 0, another 2.5s stretch NEVER reduces HP
      p1.armor = 0;
      for (let i = 0; i < 150; i++) {
        sim.step(1 / 60);
      }
      expect(p1.armor).toBe(0);
      expect(p1.hp).toBe(startHp);

      // Moving within <= 260px resets soulChainStretchTimer to 0
      p2.x = 400; // 200px away
      sim.step(1 / 60);
      expect(p1.soulChainStretchTimer).toBe(0);

      // Awakening relic_blood_oath_tether in Co-op creates a Fire-Shock Laser between p1 and p2 (200px) that burns enemies crossing the line
      expect(sim.onBossDefeated()).toBe(1);
      expect(p1.awakenedRelicIds).toContain('relic_blood_oath_tether');
      const crossingEnemy = sim.spawnEnemy('goblin_shooter', 300, 205, true);
      crossingEnemy.hp = 200;
      crossingEnemy.maxHp = 200;
      crossingEnemy.moveSpeed = 0;
      crossingEnemy.attackCooldownTimer = 999;
      for (let i = 0; i < 15; i++) {
        p1.x = 200;
        p1.y = 200;
        p2.x = 400;
        p2.y = 200;
        crossingEnemy.x = 300;
        crossingEnemy.y = 205;
        sim.step(1 / 60);
      }
      expect(crossingEnemy.hp).toBeLessThan(200);
      expect(crossingEnemy.burnTimer).toBeGreaterThan(0);
      expect(crossingEnemy.shockTimer).toBeGreaterThan(0);
    });

    it('links to alive non-dummy enemy with highest maxHp in Solo, and awakens into relic_blood_oath_tether dealing Fire-Shock Laser damage', () => {
      const sim = new WorldSim({
        seed: 20261029,
        spawnInitialWave: false,
        includeTrainingDummy: true,
        includeProps: false,
        autoRespawnWaves: false,
      });
      const p = sim.player;
      p.x = 250;
      p.y = 250;

      // Training dummy has high HP but must be ignored by pact_soul_chain
      const dummy = sim.enemies.find((e) => e.isDummy)!;
      expect(dummy).toBeDefined();
      dummy.maxHp = 9999;
      dummy.hp = 9999;

      const goblin = sim.spawnEnemy('goblin_shooter', 350, 250, true);
      goblin.maxHp = 40;
      goblin.hp = 40;
      goblin.moveSpeed = 0;
      goblin.attackCooldownTimer = 999;

      const boar = sim.spawnEnemy('wild_boar', 560, 250, true); // 310px away (> 260px)
      boar.maxHp = 120;
      boar.hp = 120;
      boar.moveSpeed = 0;
      boar.attackCooldownTimer = 999;

      p.pactChoices = ['pact_soul_chain', 'pact_searing_trigger'];
      expect(sim.selectAshenPact('pact_soul_chain', p.id)).toBe(true);

      const armorBefore = p.armor;
      for (let i = 0; i < 150; i++) {
        sim.step(1 / 60);
        p.x = 250;
        p.y = 250;
        boar.x = 560;
        boar.y = 250;
      }
      expect(p.soulChainTargetId).toBe(boar.id);
      expect(p.soulChainTargetKind).toBe('enemy');
      expect(p.armor).toBe(armorBefore - 1);

      // Awaken into relic_blood_oath_tether on Boss defeat
      sim.currentFloor = 2;
      expect(sim.onBossDefeated()).toBe(1);
      expect(p.activePactId).toBeNull();
      expect(p.awakenedRelicIds).toContain('relic_blood_oath_tether');
      expect(p.soulChainStretchTimer).toBe(0);

      // Place goblin at (390, 250) -> 140px from player (within 260px) while boar is at 310px (> 260px)
      goblin.x = 390;
      goblin.y = 250;
      goblin.hp = 200;
      goblin.maxHp = 200;

      const expectedTickDmg = Math.max(1, Math.round(scaleRelicDamage(22, sim.currentFloor) * 0.25));
      const goblinHpBefore = goblin.hp;

      // Step 0.25s (15 ticks) -> triggers 1 Fire-Shock laser tether tick on the tethered goblin in Solo
      for (let i = 0; i < 15; i++) {
        p.x = 250;
        p.y = 250;
        goblin.x = 390;
        goblin.y = 250;
        boar.x = 560;
        boar.y = 250;
        sim.step(1 / 60);
      }

      expect(p.soulChainTargetId).toBe(goblin.id);
      expect(p.soulChainTargetKind).toBe('enemy');
      expect(goblin.hp).toBeLessThanOrEqual(goblinHpBefore - expectedTickDmg);
      expect(goblin.burnTimer).toBeGreaterThan(0);
      expect(goblin.shockTimer).toBeGreaterThan(0);
    });
  });

  describe('2. pact_shattered_glass -> relic_black_crystal_heart', () => {
    it('halves maxArmor (min 1) and grants +20% Move Speed, then restores maxArmor (+0.8s regen delay) and empowers next shot after Perfect Reload / Vent [R]', () => {
      const sim = new WorldSim({
        seed: 20261030,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
        autoRespawnWaves: false,
      });
      const p = sim.player;
      equipPlayerWeaponSlot(p, 0, 'rivet_gun');
      p.critChance = 0;
      p.x = 300;
      p.y = 300;

      // Measure baseline horizontal distance walked over 30 ticks
      for (let i = 0; i < 30; i++) {
        sim.step({ moveX: 1, moveY: 0, aimAngle: 0, buttons: 0 });
      }
      const baseDistMoved = p.x - 300;
      expect(baseDistMoved).toBeGreaterThan(20);

      // Reset position/velocity and sign pact_shattered_glass
      p.x = 300;
      p.y = 300;
      p.vx = 0;
      p.vy = 0;
      const origMaxArmor = p.maxArmor; // Vanguard: 5 -> floor(2.5) = 2 (reduction = 3)
      const origRegenDelay = p.armorRegenDelaySec;
      const expectedReducedArmor = Math.max(1, Math.floor(origMaxArmor * 0.5));

      p.pactChoices = ['pact_shattered_glass', 'pact_soul_chain'];
      expect(sim.selectAshenPact('pact_shattered_glass', p.id)).toBe(true);
      expect(p.maxArmor).toBe(expectedReducedArmor);
      expect(p.armor).toBe(expectedReducedArmor);
      expect(p.shatteredGlassArmorReduction).toBe(origMaxArmor - expectedReducedArmor);

      for (let i = 0; i < 30; i++) {
        sim.step({ moveX: 1, moveY: 0, aimAngle: 0, buttons: 0 });
      }
      const pactDistMoved = p.x - 300;
      expect(pactDistMoved).toBeGreaterThan(baseDistMoved * 1.15);

      // Purify on Boss defeat -> relic_black_crystal_heart
      expect(sim.onBossDefeated()).toBe(1);
      expect(p.activePactId).toBeNull();
      expect(p.awakenedRelicIds).toContain('relic_black_crystal_heart');
      expect(p.maxArmor).toBe(origMaxArmor);
      expect(p.armor).toBe(origMaxArmor);
      expect(p.shatteredGlassArmorReduction).toBe(0);
      expect(p.armorRegenDelaySec).toBeCloseTo(origRegenDelay + 0.8, 2);

      // Trigger Perfect Reload [R] -> sets blackCrystalEmpoweredNextShot = true
      p.clipAmmo = 2;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45; // progress = 0.55 (inside Golden Window [0.45, 0.70])
      p.reloadLockout = false;
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.RELOAD_VENT });
      expect(p.blackCrystalEmpoweredNextShot).toBe(true);

      // Spawn an iron_shielder facing the player (aimAngle = Math.PI) so frontal shots normally get reduced
      p.x = 250;
      p.y = 300;
      p.overclockedNextShot = false; // isolate Black Crystal Heart's +65% additive bonus & shield pierce
      const shielder = sim.spawnEnemy('iron_shielder', 340, 300, true);
      shielder.aimAngle = Math.PI;
      shielder.hp = 500;
      shielder.maxHp = 500;

      p.fireCooldownTimer = 0;
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
      expect(p.blackCrystalEmpoweredNextShot).toBe(false);

      const empoweredProj = sim.projectiles[sim.projectiles.length - 1]!;
      expect(empoweredProj).toBeDefined();
      expect(empoweredProj.bypassFrontShield).toBe(true);
      // Rivet gun base damage is 9; with +65% additive bonus -> round(9 * 1.65) = 15
      expect(empoweredProj.damage).toBe(Math.round(9 * 1.65));

      // Step until projectile hits frontal shielder -> deals full unreduced 15 damage!
      const hpBeforeHit = shielder.hp;
      for (let i = 0; i < 20 && sim.projectiles.length > 0; i++) {
        shielder.aimAngle = Math.PI;
        sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      }
      expect(hpBeforeHit - shielder.hp).toBe(empoweredProj.damage);

      // Melee Combo Step 3 also sets blackCrystalEmpoweredNextShot = true, and next melee hit pierces front shield
      equipPlayerWeaponSlot(p, 0, 'knight_sword');
      p.meleeComboStep = 2;
      p.fireCooldownTimer = 0;
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
      expect(p.blackCrystalEmpoweredNextShot).toBe(true);
    });
  });

  describe('3. pact_searing_trigger -> relic_perpetual_core', () => {
    it('drains 1 Armor and adds +0.4s lockout on missed [R] reload or 100% Overheat, then awakens into relic_perpetual_core (+25% Golden Window & 3 Ashen Fire Rockets)', () => {
      const sim = new WorldSim({
        seed: 20261031,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
        autoRespawnWaves: false,
      });
      const p = sim.player;
      equipPlayerWeaponSlot(p, 0, 'rivet_gun');
      p.pactChoices = ['pact_searing_trigger', 'pact_soul_chain'];
      expect(sim.selectAshenPact('pact_searing_trigger', p.id)).toBe(true);

      // 1) Missed [R] reload outside Golden Window -> drains 1 Armor & adds +0.4s lockout
      const startHp = p.hp;
      const startArmor = p.armor;
      p.clipAmmo = 1;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.9; // progress = 0.10 (missed window)
      p.reloadLockout = false;

      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.RELOAD_VENT });
      expect(p.reloadLockout).toBe(true);
      expect(p.armor).toBe(startArmor - 1);
      expect(p.hp).toBe(startHp);
      expect(p.reloadDuration).toBeCloseTo(1.4, 2);
      expect(p.reloadTimer).toBeGreaterThan(1.25);
      expect(p.fireCooldownTimer).toBeGreaterThanOrEqual(0.4 - 1 / 60 - 1e-5);

      // 2) Overheating HEAT_VENT weapon to 100% -> drains 1 Armor & adds +0.4s overheatLockTimer
      equipPlayerWeaponSlot(p, 0, 'focus_laser');
      p.armor = 3;
      p.weaponHeat = 98;
      p.overheatLockTimer = 0;
      p.fireCooldownTimer = 0;

      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
      expect(p.weaponHeat).toBe(100);
      expect(p.armor).toBe(2);
      expect(p.hp).toBe(startHp);
      expect(p.overheatLockTimer).toBeCloseTo(OVERHEAT_LOCK_DURATION_SEC + 0.4, 2);

      // 3) Awaken into relic_perpetual_core on Boss defeat
      const baseClipWin = getClipReloadGoldenWindow(p);
      const baseOrangeWin = getHeatVentOrangeZone(p);
      const baseClipWidth = baseClipWin.max - baseClipWin.min;
      const baseOrangeWidth = baseOrangeWin.max - baseOrangeWin.min;

      sim.currentFloor = 2;
      expect(sim.onBossDefeated()).toBe(1);
      expect(p.activePactId).toBeNull();
      expect(p.awakenedRelicIds).toContain('relic_perpetual_core');

      const relicClipWin = getClipReloadGoldenWindow(p);
      const relicOrangeWin = getHeatVentOrangeZone(p);
      expect(relicClipWin.max - relicClipWin.min).toBeCloseTo(baseClipWidth * 1.25, 4);
      expect(relicOrangeWin.max - relicOrangeWin.min).toBeCloseTo(baseOrangeWidth * 1.25, 4);

      // 4) Perfect Reload [R] launches 3 Ashen Fire Rockets (scaleRelicDamage(20, currentFloor))
      equipPlayerWeaponSlot(p, 0, 'rivet_gun');
      sim.projectiles.length = 0;
      const targetEnemy = sim.spawnEnemy('goblin_shooter', p.x + 140, p.y, true);
      targetEnemy.hp = 300;
      targetEnemy.maxHp = 300;

      p.clipAmmo = 2;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45; // progress = 0.55 (inside Golden Window)
      p.reloadLockout = false;

      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.RELOAD_VENT });
      const rockets = sim.projectiles.filter((proj) => proj.ownerId === p.id && proj.element === 'burn');
      expect(rockets).toHaveLength(3);
      const expectedRocketDmg = scaleRelicDamage(20, sim.currentFloor);
      for (const r of rockets) {
        expect(r.damage).toBe(expectedRocketDmg);
        expect(r.element).toBe('burn');
      }

      // 5) Tactical Vent [R] also launches 3 Ashen Fire Rockets
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 }); // release [R] first
      equipPlayerWeaponSlot(p, 0, 'focus_laser');
      sim.projectiles.length = 0;
      p.weaponHeat = 75;
      p.overheatLockTimer = 0;
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.RELOAD_VENT });
      const ventRockets = sim.projectiles.filter(
        (proj) => proj.ownerId === p.id && proj.weaponId === 'relic_perpetual_core_rocket',
      );
      expect(ventRockets).toHaveLength(3);
    });
  });
});
