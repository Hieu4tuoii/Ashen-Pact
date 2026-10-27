import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  SIM_STEP_SEC,
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

describe('AP2 P1A.3 — Rare Weapons Pair: seed_gun & tether_staff', () => {
  describe('1. seed_gun (CLIP_RELOAD, clip=4, reload=1.00s, 13 Poison DMG, fireRate=2.4/s, procCoeff=0.80)', () => {
    it('matches Spec 4.3 weapon stats, plants up to 4 Life Buds (replacing oldest on 5th) that tick for 6 Poison DMG/s, and triggers Harvest Bloom (24 Poison DMG + 1.0s Root in r=88px) on Finale Shot & Perfect Reload [R]', () => {
      const wep = WEAPONS.seed_gun!;
      expect(wep).toBeDefined();
      expect(wep.cadenceKind).toBe('CLIP_RELOAD');
      expect(wep.clipSize).toBe(4);
      expect(wep.reloadDurationSec).toBeCloseTo(1.0, 3);
      expect(wep.damage).toBe(13);
      expect(wep.element).toBe('poison');
      expect(wep.fireRate).toBeCloseTo(2.4, 3);
      expect(wep.procCoefficient).toBeCloseTo(0.8, 3);

      const sim = createCleanSim(3101);
      const p = sim.player;
      sim.selectCharacter(p.id, 'druid');
      p.weaponSlots = ['seed_gun'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // 1. Plant 5 Life Buds without triggering Finale Shot -> max 4 active per player (oldest replaced)
      const plantedIds: number[] = [];
      for (let i = 0; i < 5; i++) {
        sim.spawnSeedGunLifeBlossom(p.id, 260 + i * 24, 260);
        const newest = sim.summons[sim.summons.length - 1]!;
        plantedIds.push(newest.id);
      }

      const activeBuds = sim.summons.filter(
        (s) => s.kind === 'life_blossom' && s.ownerPlayerId === p.id && s.hp > 0 && s.ttlSec > 0,
      );
      expect(activeBuds).toHaveLength(4);
      expect(activeBuds.map((b) => b.id)).toEqual(plantedIds.slice(1, 5));
      expect(activeBuds[0]!.auraRadius).toBe(88);

      // 2. Verify a single Life Bud ticks for 6 Poison DMG/s to nearby enemies within r=88px
      sim.summons.length = 0;
      sim.spawnSeedGunLifeBlossom(p.id, 320, 260);
      const budEnemy = sim.spawnEnemy('spore_guardian', 380, 260, true); // dist = 60px <= 88px
      budEnemy.hp = 500;
      budEnemy.maxHp = 500;
      sim.consumeEvents();

      // Advance summon ticks by 1.0s (60 steps of SIM_STEP_SEC)
      for (let t = 0; t < 60; t++) {
        sim.updateSkillZonesAndSummons(SIM_STEP_SEC);
      }
      expect(500 - budEnemy.hp).toBe(6);
      expect(budEnemy.poisonTimer).toBeGreaterThan(0);

      // 3. Verify Perfect Reload [R] in golden window [0.45, 0.70] detonates all active buds for 24 Poison DMG + 1.0s Root (r=88px)
      budEnemy.hp = 500;
      budEnemy.rootedTimer = 0;
      p.clipAmmo = 0;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45; // progress = 1 - 0.45/1.0 = 0.55 (inside [0.45, 0.70])
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

      expect(500 - budEnemy.hp).toBe(24);
      expect(budEnemy.rootedTimer).toBeGreaterThanOrEqual(1.0);
      expect(
        sim.summons.filter(
          (s) => s.kind === 'life_blossom' && s.ownerPlayerId === p.id && s.hp > 0 && s.ttlSec > 0,
        ),
      ).toHaveLength(0);

      // 4. Verify Finale Shot (4th shot in clip) plants bud and immediately blooms all active buds for 24 Poison DMG + 1.0s Root
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      sim.summons.length = 0;
      p.overclockedNextShot = false;

      // Plant 1 bud near targetB (dist = 50px <= 88px), then fire 4th Finale Shot at targetA
      const targetA = sim.spawnEnemy('spore_guardian', p.x + 90, p.y, true);
      targetA.hp = 600;
      targetA.maxHp = 600;
      const targetB = sim.spawnEnemy('wild_boar', p.x + 90, p.y + 150, true);
      targetB.hp = 600;
      targetB.maxHp = 600;
      sim.spawnSeedGunLifeBlossom(p.id, targetB.x, targetB.y);

      p.clipAmmo = 1; // 4th shot in clip -> Finale Shot
      p.reloadTimer = 0;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();
      sim.tryFireActiveWeapon(p);

      for (let t = 0; t < 18; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }

      // Finale Shot direct hit deals Math.round(13 * 1.5) = 20 DMG to targetA, plus 24 DMG from its blooming bud = 44 DMG!
      expect(600 - targetA.hp).toBe(Math.round(13 * 1.5) + 24);
      expect(targetA.rootedTimer).toBeGreaterThanOrEqual(1.0);
      // targetB takes 24 Poison DMG + 1.0s Root from its blooming bud!
      expect(600 - targetB.hp).toBe(24);
      expect(targetB.rootedTimer).toBeGreaterThanOrEqual(1.0);
      expect(
        sim.summons.filter(
          (s) => s.kind === 'life_blossom' && s.ownerPlayerId === p.id && s.hp > 0 && s.ttlSec > 0,
        ),
      ).toHaveLength(0);
    });

    it('enforces the strict anti-exploit Healing Mist rule: 0 heal/armor in empty rooms, +1 Armor & +1 HP on living enemy hit, 12.0s per-player ICD, and max 2 HP heals per room (reset on room change)', () => {
      const sim = createCleanSim(3102);
      const p = sim.player;
      sim.selectCharacter(p.id, 'druid');
      p.weaponSlots = ['seed_gun'];
      sim.equipWeaponSlot(0);
      p.x = 220;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // Damage player HP and Armor so healing and armor gain can be observed
      p.maxHp = 6;
      p.hp = 2;
      p.maxArmor = 5;
      p.armor = 1;
      p.armorRegenTimer = 999; // pause passive armor regen to isolate Healing Mist

      // (a) Empty room bloom (0 living enemies hit): MUST grant 0 HP and 0 Armor!
      sim.enemies.length = 0;
      sim.spawnSeedGunLifeBlossom(p.id, p.x + 40, p.y);
      p.clipAmmo = 0;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45;
      p.reloadLockout = false;
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

      expect(p.hp).toBe(2);
      expect(p.armor).toBe(1);
      expect(p.seedGunRoomHealsUsed ?? 0).toBe(0);
      expect(p.seedGunHealIcdTimer ?? 0).toBe(0);

      // Also verify firing Finale Shot in an empty room grants 0 HP and 0 Armor
      p.overclockedNextShot = false;
      p.clipAmmo = 1;
      p.reloadTimer = 0;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      for (let t = 0; t < 90; t++) {
        sim.updateProjectiles(SIM_STEP_SEC);
      }
      expect(p.hp).toBe(2);
      expect(p.armor).toBe(1);

      // (b) Bloom hitting a living enemy -> grants +1 Armor & +1 HP, sets 12.0s ICD, and increments room heal count to 1
      const enemy = sim.spawnEnemy('spore_guardian', p.x + 60, p.y, true);
      enemy.hp = 2000;
      enemy.maxHp = 2000;
      enemy.attackCooldownTimer = 999;

      sim.spawnSeedGunLifeBlossom(p.id, enemy.x, enemy.y);
      p.clipAmmo = 0;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45;
      p.reloadLockout = false;
      sim.prevButtons = 0;
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

      expect(p.hp).toBe(3); // +1 HP (2 -> 3)
      expect(p.armor).toBe(2); // +1 Armor (1 -> 2)
      expect(p.seedGunRoomHealsUsed).toBe(1);
      expect(p.seedGunHealIcdTimer).toBeGreaterThan(11.9);

      // (c) Immediate 2nd bloom on a living enemy while ICD > 0 (< 12.0s) -> blocked by 12.0s ICD (does NOT heal HP)
      for (let t = 0; t < 180; t++) {
        // Advance 3.0s (ICD still ~9.0s > 0)
        p.armorRegenTimer = 999;
        sim.setPlayerInput({
          seq: 10 + t,
          tick: sim.tick + 1,
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          buttons: 0,
          weaponSlotSelect: null,
        });
        sim.step(SIM_STEP_SEC);
      }
      expect(p.seedGunHealIcdTimer).toBeGreaterThan(8.5);

      sim.spawnSeedGunLifeBlossom(p.id, enemy.x, enemy.y);
      p.clipAmmo = 0;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45;
      p.reloadLockout = false;
      sim.prevButtons = 0;
      sim.setPlayerInput({
        seq: 200,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      expect(p.hp).toBe(3); // Still 3 HP (blocked by 12.0s ICD!)
      expect(p.seedGunRoomHealsUsed).toBe(1);

      // (d) Advance > 12.0s so ICD expires -> 2nd bloom on living enemy heals +1 HP (3 -> 4, roomHealsUsed = 2)
      for (let t = 0; t < 600; t++) {
        // Advance another 10.0s (total > 13.0s)
        p.armorRegenTimer = 999;
        sim.setPlayerInput({
          seq: 300 + t,
          tick: sim.tick + 1,
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          buttons: 0,
          weaponSlotSelect: null,
        });
        sim.step(SIM_STEP_SEC);
      }
      expect(p.seedGunHealIcdTimer).toBe(0);

      sim.spawnSeedGunLifeBlossom(p.id, enemy.x, enemy.y);
      p.clipAmmo = 0;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45;
      p.reloadLockout = false;
      sim.prevButtons = 0;
      sim.setPlayerInput({
        seq: 950,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      expect(p.hp).toBe(4); // 2nd heal in room succeeded (3 -> 4)!
      expect(p.seedGunRoomHealsUsed).toBe(2);

      // Advance > 12.0s again -> 3rd bloom on living enemy in the SAME room is blocked by max 2 heals/room cap!
      for (let t = 0; t < 750; t++) {
        p.armorRegenTimer = 999;
        sim.setPlayerInput({
          seq: 1000 + t,
          tick: sim.tick + 1,
          moveX: 0,
          moveY: 0,
          aimAngle: 0,
          buttons: 0,
          weaponSlotSelect: null,
        });
        sim.step(SIM_STEP_SEC);
      }
      expect(p.seedGunHealIcdTimer).toBe(0);

      sim.spawnSeedGunLifeBlossom(p.id, enemy.x, enemy.y);
      p.clipAmmo = 0;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.45;
      p.reloadLockout = false;
      sim.prevButtons = 0;
      sim.setPlayerInput({
        seq: 1800,
        tick: sim.tick + 1,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.RELOAD_VENT,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      expect(p.hp).toBe(4); // Blocked at 2 heals/room!
      expect(p.seedGunRoomHealsUsed).toBe(2);

      // Entering a new room resets seedGunRoomHealsUsed to 0
      const nextRoom = sim.dungeon.rooms.find((r) => r.id !== sim.currentRoomId)!;
      sim.enterRoom(nextRoom.id);
      expect(p.seedGunRoomHealsUsed).toBe(0);
    });
  });

  describe('2. tether_staff (HEAT_VENT, 11 Shock DMG / 0.25s, heatPerSec=22%/s, range=280px, procCoeff=0.28)', () => {
    it('matches Spec 4.3 weapon stats, anchors within 280px to Prop / Summon / Teammate / First Enemy, and slices enemies along the tether for 11 Shock DMG every 0.25s at 22%/s heat', () => {
      const wep = WEAPONS.tether_staff!;
      expect(wep).toBeDefined();
      expect(wep.cadenceKind).toBe('HEAT_VENT');
      expect(wep.damage).toBe(11);
      expect(wep.element).toBe('shock');
      expect(wep.fireRate).toBeCloseTo(4.0, 3);
      expect(wep.heatPerShot).toBeCloseTo(5.5, 3);
      expect(wep.fireRate * wep.heatPerShot).toBeCloseTo(22, 3);
      expect(wep.range).toBe(280);
      expect(wep.procCoefficient).toBeCloseTo(0.28, 3);

      const sim = createCleanSim(3103);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist');
      p.activeImbueElement = 'none';
      p.weaponSlots = ['tether_staff'];
      sim.equipWeaponSlot(0);
      p.x = 200;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // 1. Anchor to a Flipped Cover Prop (moss_table) at dist = 240px (<= 280px)
      const table = sim.spawnProp('moss_table', p.x + 240, p.y);
      sim.flipCoverProp(table, p);

      // Place 2 enemies intersecting the tether segment between p (200, 260) and table (440, 260)
      const e1 = sim.spawnEnemy('wild_boar', p.x + 90, p.y, true);
      const e2 = sim.spawnEnemy('spore_guardian', p.x + 170, p.y, true);
      e1.hp = 500;
      e1.maxHp = 500;
      e2.hp = 500;
      e2.maxHp = 500;

      // Hold trigger for 1.0s (60 ticks = 4 ticks of 0.25s)
      p.weaponHeat = 0;
      p.fireCooldownTimer = 0;
      sim.consumeEvents();

      for (let t = 0; t < 60; t++) {
        e1.x = p.x + 90;
        e1.y = p.y;
        e2.x = p.x + 170;
        e2.y = p.y;
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

      const beam = sim.tetherBeams.find((b) => b.ownerPlayerId === p.id);
      expect(beam).toBeDefined();
      expect(beam!.targetKind).toBe('prop');
      expect(beam!.targetEntityId).toBe(table.id);
      expect(beam!.x2).toBeCloseTo(table.x, 1);
      expect(beam!.y2).toBeCloseTo(table.y, 1);

      // In 1.0s (4 ticks at 0.25s interval): weaponHeat increases by 4 * 5.5% = 22%, and both enemies take 4 * 11 = 44 Shock DMG!
      expect(p.weaponHeat).toBeCloseTo(22, 2);
      expect(500 - e1.hp).toBe(44);
      expect(500 - e2.hp).toBe(44);
      expect(e1.shockTimer).toBeGreaterThan(0);
      expect(e2.shockTimer).toBeGreaterThan(0);

      // 2. Verify anchoring to First Enemy when no Prop/Summon/Ally is present
      sim.props.length = 0;
      sim.tetherBeams.length = 0;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      const enemyBeam = sim.tetherBeams.find((b) => b.ownerPlayerId === p.id);
      expect(enemyBeam).toBeDefined();
      expect(enemyBeam!.targetKind).toBe('enemy');
      expect(enemyBeam!.targetEntityId).toBe(e1.id);
    });

    it('Tactical Vent [R] in Orange Heat contracts the tether, yanks enemies touching/near the tether toward the anchor point, and triggers a 32 Shock DMG Electromagnetic Blast', () => {
      const sim = createCleanSim(3104);
      const p = sim.player;
      sim.selectCharacter(p.id, 'elementalist');
      p.activeImbueElement = 'none';
      p.weaponSlots = ['tether_staff'];
      sim.equipWeaponSlot(0);
      p.x = 180;
      p.y = 260;
      p.aimAngle = 0;
      p.critChance = 0;

      // Anchor to a prop at (420, 260) (dist = 240px <= 280px)
      const anchorProp = sim.spawnProp('moss_table', 420, 260);
      sim.flipCoverProp(anchorProp, p);

      // Spawn two enemies along the tether line at x = 250 and x = 330
      const enemyA = sim.spawnEnemy('wild_boar', 250, 275, true);
      const enemyB = sim.spawnEnemy('wild_boar', 330, 245, true);
      enemyA.hp = 500;
      enemyA.maxHp = 500;
      enemyB.hp = 500;
      enemyB.maxHp = 500;

      // Establish the tether beam and set heat into Orange Zone (75%)
      p.weaponHeat = 0;
      p.fireCooldownTimer = 0;
      sim.tryFireActiveWeapon(p);
      expect(sim.tetherBeams).toHaveLength(1);

      p.weaponHeat = 75;
      p.overheatLockTimer = 0;
      const hpABeforeVent = enemyA.hp;
      const hpBBeforeVent = enemyB.hp;
      sim.consumeEvents();

      // Press [R] (RELOAD_VENT) to trigger Tactical Vent
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
      expect(events.some((e) => e.kind === 'tactical_vent' && e.weaponId === 'tether_staff')).toBe(
        true,
      );
      const blastEv = events.find(
        (e) => e.kind === 'explosion' && e.sourceDefId === 'tether_staff',
      );
      expect(blastEv).toBeDefined();
      if (blastEv?.kind === 'explosion') {
        expect(blastEv.damage).toBe(32);
        expect(blastEv.x).toBeCloseTo(anchorProp.x, 1);
        expect(blastEv.y).toBeCloseTo(anchorProp.y, 1);
      }

      // Both enemies along the tether were yanked toward the anchor point (420, 260) and hit for 32 Shock DMG!
      expect(Math.hypot(enemyA.x - anchorProp.x, enemyA.y - anchorProp.y)).toBeLessThan(48);
      expect(Math.hypot(enemyB.x - anchorProp.x, enemyB.y - anchorProp.y)).toBeLessThan(48);
      expect(hpABeforeVent - enemyA.hp).toBe(32);
      expect(hpBBeforeVent - enemyB.hp).toBe(32);
      expect(enemyA.shockTimer).toBeGreaterThan(0);
      expect(enemyB.shockTimer).toBeGreaterThan(0);
    });
  });
});
