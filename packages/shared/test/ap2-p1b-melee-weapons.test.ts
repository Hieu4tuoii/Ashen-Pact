import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  SIM_STEP_SEC,
  TILE_SIZE,
  WEAPONS,
  WorldSim,
  computeBerserkerAxeFireRateMultiplier,
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

describe('AP2 P1B.2 — Epic Melee Weapons: emerald_cleaver & berserker_axe', () => {
  describe('1. emerald_cleaver (Đại Đao Lục Bảo — Epic, MELEE_COMBO, Poison, 22 -> 26 -> 32 DMG, spread=135°, range=92px, procCoeff=0.85)', () => {
    it('matches P1B.2 weapon stats, executes 3-hit Poison cleave (22 -> 26 -> 32 DMG, kb 180/200/240, range=92px, 135° arc) with safe 24px lunge on Hit 1 & 2, and Parry Deflects up to 3 enemy bullets on Hit 3', () => {
      const wep = WEAPONS.emerald_cleaver!;
      expect(wep).toBeDefined();
      expect(wep.rarity).toBe('epic');
      expect(wep.cadenceKind).toBe('MELEE_COMBO');
      expect(wep.damage).toBe(22);
      expect(wep.comboHits).toBe(3);
      expect(wep.comboDamages).toEqual([22, 26, 32]);
      expect(wep.comboKnockbacks).toEqual([180, 200, 240]);
      expect(wep.spreadDeg).toBe(135);
      expect(wep.range).toBe(92);
      expect(wep.element).toBe('poison');
      expect(wep.procCoefficient).toBeCloseTo(0.85, 3);
      expect(wep.destroysEnemyBullets).toBe(true);

      const sim = createCleanSim(4201);
      const p = sim.player;
      sim.selectCharacter(p.id, 'vanguard');
      p.skillActiveTimer = 0;
      p.activeImbueElement = 'none';
      p.weaponSlots = ['emerald_cleaver'];
      sim.equipWeaponSlot(0);
      p.x = 220;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = -1; // force 0% critChance after adding weapon critChance

      const target = sim.spawnEnemy('spore_guardian', p.x + 80, p.y + 30, true);
      target.hp = 600;
      target.maxHp = 600;

      // Hit 1: 22 DMG Poison + 24px forward lunge
      const xBeforeHit1 = p.x;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      expect(p.x).toBeCloseTo(xBeforeHit1 + 24, 2);
      expect(p.meleeComboStep).toBe(1);
      expect(600 - target.hp).toBe(22);
      expect(target.poisonTimer).toBeGreaterThan(0);

      // Hit 2: 26 DMG Poison + 24px forward lunge, clamped safely against chasm tiles
      target.hp = 600;
      p.x = 220;
      p.y = 260;
      // Place a chasm tile ahead so the 24px lunge must stop safely before the chasm
      const chasmTx = Math.floor((p.x + 28) / TILE_SIZE);
      const chasmTy = Math.floor(p.y / TILE_SIZE);
      sim.map.setSurface(chasmTx, chasmTy, 'chasm', 999, true);

      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);
      expect(sim.map.getSurfaceAtWorld(p.x, p.y)).not.toBe('chasm');
      expect(p.meleeComboStep).toBe(2);
      expect(600 - target.hp).toBe(26);

      // Clear chasm tile for Hit 3
      sim.map.setSurface(chasmTx, chasmTy, 'none', 0, true);
      p.x = 220;
      p.y = 260;
      target.hp = 600;

      // Spawn 4 enemy bullets within cleave range (92px) to test Hit 3 Parry Deflect (caps at 3)
      for (let i = 0; i < 4; i++) {
        sim.projectiles.push(
          sim.acquireProjectile({
            id: 9101 + i,
            ownerId: target.id,
            team: 'enemy',
            weaponId: 'goblin_bow',
            x: p.x + 48 + i * 6,
            y: p.y,
            vx: -160,
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

      // Hit 3: 32 DMG Poison + 0.18s Parry Deflect window + Jade Cleaver Boomerang spawn
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      expect(p.meleeComboStep).toBe(0);
      expect(p.meleeParryWindowTimer).toBeCloseTo(0.18, 3);
      expect(600 - target.hp).toBe(32);

      // Up to 3 of the 4 enemy bullets were deflected at 760 px/s along aimAngle
      const remainingEnemyBullets = sim.projectiles.filter(
        (b) => b.team === 'enemy' && b.ttlSec > 0,
      );
      expect(remainingEnemyBullets).toHaveLength(1);

      const deflectedBullets = sim.projectiles.filter(
        (b) =>
          b.team === 'player' &&
          b.weaponId !== 'emerald_cleaver_boomerang' &&
          Math.abs(Math.hypot(b.vx, b.vy) - 760) < 1,
      );
      expect(deflectedBullets).toHaveLength(3);

      const evs = sim.consumeEvents();
      expect(evs.some((e) => e.kind === 'projectiles_destroyed')).toBe(true);
      expect(evs.some((e) => e.kind === 'melee_parry_deflect')).toBe(true);
    });

    it('Hit 3 throws Jade Cleaver Boomerang (emerald_cleaver_boomerang, 640 px/s up to 280px), spins in place for 0.40s (24 ticks) pulsing 32 Poison DMG in r=56px & deflecting up to 3 enemy bullets, then returns at 680 px/s pulling hit enemies 42px toward player', () => {
      const sim = createCleanSim(4202);
      const p = sim.player;
      sim.selectCharacter(p.id, 'vanguard');
      p.skillActiveTimer = 0;
      p.activeImbueElement = 'none';
      p.weaponSlots = ['emerald_cleaver'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = -1; // 0% crit
      p.meleeComboStep = 2; // Hit 3
      p.fireCooldownTimer = 0;

      // Enemy along outbound/return path at +170px (outside 92px melee swing cone)
      const pathEnemy = sim.spawnEnemy('wild_boar', p.x + 170, p.y, true);
      pathEnemy.hp = 600;
      pathEnemy.maxHp = 600;

      // Enemy near the 280px spin point at (p.x + 315, p.y) -> outside 280px + 20px outbound hit, but inside 280px + 56px spin radius!
      const spinEnemy = sim.spawnEnemy('spore_guardian', p.x + 315, p.y, true);
      spinEnemy.hp = 600;
      spinEnemy.maxHp = 600;

      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      const boomerang = sim.projectiles.find((b) => b.weaponId === 'emerald_cleaver_boomerang')!;
      expect(boomerang).toBeDefined();
      expect(boomerang.damage).toBe(32);
      expect(boomerang.element).toBe('poison');
      expect(boomerang.radius).toBe(20);
      expect(boomerang.pierceRemaining).toBe(99);
      expect(boomerang.boomerangPhase).toBe('outbound');
      expect(Math.hypot(boomerang.vx, boomerang.vy)).toBeCloseTo(640, 1);

      // Step outbound until boomerang reaches 280px (~27 ticks) and enters 'spinning' phase
      let enteredSpinTick = -1;
      for (let t = 0; t < 35; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
        if (boomerang.boomerangPhase === 'spinning') {
          enteredSpinTick = t + 1;
          break;
        }
      }
      expect(enteredSpinTick).toBeGreaterThan(0);
      expect(boomerang.boomerangPhase).toBe('spinning');
      expect(boomerang.x).toBeCloseTo(p.x + 280, 0);

      // Outbound flight hit pathEnemy once for 32 Poison DMG, and did not yet hit spinEnemy
      expect(600 - pathEnemy.hp).toBe(32);
      expect(pathEnemy.poisonTimer).toBeGreaterThan(0);

      // Spawn 4 enemy bullets inside the r=56px spin radius around (boomerang.x, boomerang.y)
      for (let i = 0; i < 4; i++) {
        sim.projectiles.push(
          sim.acquireProjectile({
            id: 9201 + i,
            ownerId: spinEnemy.id,
            team: 'enemy',
            weaponId: 'goblin_bow',
            x: boomerang.x + 24 + i * 5,
            y: boomerang.y,
            vx: -140,
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
      sim.consumeEvents();

      // Step through the 0.40s (24 ticks) spin phase until it transitions to 'returning'
      let spinTicksCount = 0;
      while (boomerang.boomerangPhase === 'spinning' && spinTicksCount < 35) {
        sim.updateProjectiles(SIM_STEP_SEC);
        spinTicksCount += 1;
      }
      expect(spinTicksCount).toBe(24);
      expect(boomerang.boomerangPhase).toBe('returning');

      // Spin phase pulsed 32 Poison DMG to spinEnemy in r=56px and deflected 3 of the 4 enemy bullets at 760 px/s
      expect(spinEnemy.hp).toBeLessThanOrEqual(600 - 32);
      expect(spinEnemy.poisonTimer).toBeGreaterThan(0);

      const spinEvs = sim.consumeEvents();
      expect(spinEvs.some((e) => e.kind === 'projectiles_destroyed')).toBe(true);
      expect(spinEvs.some((e) => e.kind === 'melee_parry_deflect')).toBe(true);
      const remainingEnemyProjs = sim.projectiles.filter(
        (b) => b.team === 'enemy' && b.ttlSec > 0,
      );
      expect(remainingEnemyProjs).toHaveLength(1);

      // Now move player slightly and record pathEnemy position before the return hit
      p.x = 180;
      p.y = 260;
      pathEnemy.x = 340;
      pathEnemy.y = 260;
      const hpBeforeReturn = pathEnemy.hp;
      const xBeforeReturn = pathEnemy.x;

      // Step return flight (680 px/s) until boomerang hits pathEnemy, pulls it 42px toward player, and expires within 24px of player
      for (let t = 0; t < 40; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
        if (boomerang.ttlSec <= 0) break;
      }

      expect(hpBeforeReturn - pathEnemy.hp).toBe(32);
      expect(xBeforeReturn - pathEnemy.x).toBeCloseTo(42, 0);
      expect(boomerang.ttlSec).toBeLessThanOrEqual(0);
    });
  });

  describe('2. berserker_axe (Rìu Chiến Berserker — Epic, MELEE_COMBO, Burn, 24 -> 30 -> 52 DMG, spread=140°, range=66px, procCoeff=0.80)', () => {
    it('matches P1B.2 weapon stats, executes 24 -> 30 -> 52 Burn DMG combo, and stacks Bloodlust (+7% attack speed per hit up to 5 stacks = +35%, decaying after 4.0s, plus +15% at 0 armor = +50% total)', () => {
      const wep = WEAPONS.berserker_axe!;
      expect(wep).toBeDefined();
      expect(wep.rarity).toBe('epic');
      expect(wep.cadenceKind).toBe('MELEE_COMBO');
      expect(wep.damage).toBe(24);
      expect(wep.comboHits).toBe(3);
      expect(wep.comboDamages).toEqual([24, 30, 52]);
      expect(wep.comboKnockbacks).toEqual([190, 210, 240]);
      expect(wep.spreadDeg).toBe(140);
      expect(wep.range).toBe(66);
      expect(wep.element).toBe('burn');
      expect(wep.procCoefficient).toBeCloseTo(0.8, 3);
      expect(wep.destroysEnemyBullets).toBe(true);

      const sim = createCleanSim(4203);
      const p = sim.player;
      sim.selectCharacter(p.id, 'vanguard');
      p.skillActiveTimer = 0;
      p.activeImbueElement = 'none';
      p.weaponSlots = ['berserker_axe'];
      sim.equipWeaponSlot(0);
      p.x = 220;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = -1; // 0% crit
      p.armor = 3;

      const dummy = sim.spawnEnemy('spore_guardian', p.x + 52, p.y, true);
      dummy.hp = 1000;
      dummy.maxHp = 1000;

      // Swinging into empty air does NOT grant Bloodlust stacks
      p.aimAngle = Math.PI;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      expect(p.berserkerBloodlustStacks ?? 0).toBe(0);
      expect(p.fireCooldownTimer).toBeCloseTo(1 / wep.fireRate, 3);

      // Reset combo and swing 3 times into enemy -> verify 24 -> 30 -> 52 Burn DMG and Bloodlust stacks 1 -> 2 -> 3
      p.meleeComboStep = 0;
      p.aimAngle = 0;
      const recordedDamages: number[] = [];
      for (let step = 0; step < 3; step++) {
        p.x = 220;
        p.y = 260;
        dummy.x = p.x + (step === 2 ? 130 : 52); // for Hit 3, player leaps 96px to 316, so dummy at 350 is 34px ahead!
        dummy.y = p.y;
        const hpBefore = dummy.hp;
        p.fireCooldownTimer = 0;
        sim.tryFireActiveWeapon(p);
        recordedDamages.push(hpBefore - dummy.hp);
        expect(p.berserkerBloodlustStacks).toBe(step + 1);
        expect(p.berserkerBloodlustTimer).toBeCloseTo(4.0, 3);
      }
      expect(recordedDamages).toEqual([24, 30, 52]);
      expect(dummy.burnTimer).toBeGreaterThan(0);

      // Hit 3 more times -> stacks cap at 5 (+35% attack speed)
      for (let i = 0; i < 3; i++) {
        p.x = 220;
        p.y = 260;
        p.meleeComboStep = 0;
        dummy.x = p.x + 52;
        p.fireCooldownTimer = 0;
        sim.tryFireActiveWeapon(p);
      }
      expect(p.berserkerBloodlustStacks).toBe(5);
      expect(computeBerserkerAxeFireRateMultiplier(p)).toBeCloseTo(1.35, 3);
      expect(p.fireCooldownTimer).toBeCloseTo(1 / (wep.fireRate * 1.35), 3);

      // When player armor <= 0, gains an extra +15% attack speed -> +50% total (1.50x fireRateMult)
      p.armor = 0;
      expect(computeBerserkerAxeFireRateMultiplier(p)).toBeCloseTo(1.5, 3);
      p.x = 220;
      p.meleeComboStep = 0;
      dummy.x = p.x + 52;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      expect(p.fireCooldownTimer).toBeCloseTo(1 / (wep.fireRate * 1.5), 3);

      // After 4.0s (242 ticks) without hitting an enemy, Bloodlust stacks decay to 0
      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      for (let t = 0; t < 245; t++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(p.berserkerBloodlustTimer).toBe(0);
      expect(p.berserkerBloodlustStacks).toBe(0);
    });

    it('Hit 3 (Guillotine Leap Finisher / Đoạn Đầu Đài) leaps 96px safely (clamped against solid walls & chasm), shatters iron_shielder front shield before dealing 52 Burn DMG, deflects up to 3 bullets, and spawns a 160x36px Flame Fissure (2.5s, 10 Burn DMG / 0.5s)', () => {
      const sim = createCleanSim(4204);
      const p = sim.player;
      sim.selectCharacter(p.id, 'vanguard');
      p.skillActiveTimer = 0;
      p.activeImbueElement = 'none';
      p.weaponSlots = ['berserker_axe'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = -1; // 0% crit

      // 1. Verify 96px Guillotine leap clamps safely before a chasm tile
      const chasmTx = Math.floor((p.x + 64) / TILE_SIZE);
      const chasmTy = Math.floor(p.y / TILE_SIZE);
      sim.map.setSurface(chasmTx, chasmTy, 'chasm', 999, true);
      p.meleeComboStep = 2;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      expect(sim.map.getSurfaceAtWorld(p.x, p.y)).not.toBe('chasm');
      expect(p.x).toBeLessThan(chasmTx * TILE_SIZE);

      // Clear chasm and reset for full Guillotine Slam test
      sim.map.setSurface(chasmTx, chasmTy, 'none', 0, true);
      sim.flameFissures.length = 0;
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.meleeComboStep = 2;
      p.fireCooldownTimer = 0;

      // Spawn an iron_shielder (which normally has 80% frontShieldReduction and shieldArmor) at landing spot + 40px (200 + 96 + 40 = 336) facing the player (aimAngle = Math.PI)
      const shielder = sim.spawnEnemy('iron_shielder', 336, 260, true, 'shield');
      shielder.aimAngle = Math.PI; // facing directly toward player!
      shielder.hp = 500;
      shielder.maxHp = 500;
      shielder.shieldArmor = 60;
      shielder.maxShieldArmor = 60;

      // Also spawn an enemy further down the 160px Flame Fissure at (296 + 130 = 426, 260) outside the 66px melee cleave cone
      const fissureEnemy = sim.spawnEnemy('spore_guardian', 426, 260, true);
      fissureEnemy.hp = 500;
      fissureEnemy.maxHp = 500;

      // Spawn 4 enemy bullets to test Hit 3 Parry Deflect (0.18s window, max 3 deflected)
      for (let i = 0; i < 4; i++) {
        sim.projectiles.push(
          sim.acquireProjectile({
            id: 9301 + i,
            ownerId: shielder.id,
            team: 'enemy',
            weaponId: 'goblin_bow',
            x: 296 + 24 + i * 5,
            y: 260,
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

      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      // Player leaped 96px forward from 200 to 296
      expect(p.x).toBeCloseTo(296, 1);

      // iron_shielder's shield was shattered BEFORE hit (shieldArmor = 0, shieldBrokenTimer = 4.0) and it took the full 52 Burn DMG!
      expect(shielder.shieldArmor).toBe(0);
      expect(shielder.shieldBrokenTimer).toBeCloseTo(4.0, 2);
      expect(500 - shielder.hp).toBe(52);
      expect(shielder.burnTimer).toBeGreaterThan(0);

      // 3 of the 4 enemy bullets were deflected
      expect(sim.projectiles.filter((b) => b.team === 'enemy' && b.ttlSec > 0)).toHaveLength(1);

      // Flame Fissure (160px long, 36px wide, 2.5s duration) was created and berserker_guillotine_slam event emitted
      expect(sim.flameFissures).toHaveLength(1);
      const fissure = sim.flameFissures[0]!;
      expect(fissure.length).toBe(160);
      expect(fissure.width).toBe(36);
      expect(fissure.ttlSec).toBeCloseTo(2.5, 2);

      const slamEvs = sim.consumeEvents();
      const guillotineEv = slamEvs.find((e) => e.kind === 'berserker_guillotine_slam');
      expect(guillotineEv).toBeDefined();
      if (guillotineEv?.kind === 'berserker_guillotine_slam') {
        expect(guillotineEv.alertTextVi).toBe('ĐOẠN ĐẦU ĐÀI!');
        expect(guillotineEv.length).toBe(160);
        expect(guillotineEv.width).toBe(36);
      }

      // Step 30 ticks (0.50s) -> Flame Fissure ticks for 10 Burn DMG on fissureEnemy
      expect(fissureEnemy.hp).toBe(500);
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
      expect(500 - fissureEnemy.hp).toBe(10);
      expect(fissureEnemy.burnTimer).toBeGreaterThan(0);

      // Step remaining 120 ticks (total 2.50s = 150 ticks) -> Flame Fissure expires
      for (let t = 0; t < 122; t++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(sim.flameFissures).toHaveLength(0);
    });
  });
});
