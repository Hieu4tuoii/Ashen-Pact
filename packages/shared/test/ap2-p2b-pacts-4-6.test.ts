import { describe, expect, it } from 'vitest';
import {
  ENEMIES,
  INPUT_BUTTON,
  WEAPONS,
  WorldSim,
  equipPlayerWeaponSlot,
  getCompatibleWeaponMutators,
  scaleRelicDamage,
  triggerEnemyWallSlam,
} from '../src/index.js';

describe('AP2 Phase P2B.3 — Pacts & Relics #4–#6 (pact_volatile_arsenal, pact_ashen_hunted, pact_ricochet_vow)', () => {
  describe('4. pact_volatile_arsenal -> relic_master_forge_seal', () => {
    it('saves pactOriginalWeaponId, morphs weapon within Biome rarity band on room clear / wave spawn / 20s Boss timer, and awakens into relic_master_forge_seal (+1 upgrade level, +1 mutator, optional [E] keep morphed)', () => {
      const sim = new WorldSim({
        seed: 20261101,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
        autoRespawnWaves: false,
      });
      const p = sim.player;
      equipPlayerWeaponSlot(p, 0, 'rivet_gun');
      p.activeWeaponSlot = 0;

      p.pactChoices = ['pact_volatile_arsenal', 'pact_soul_chain'];
      expect(sim.selectAshenPact('pact_volatile_arsenal', p.id)).toBe(true);
      expect(p.activePactId).toBe('pact_volatile_arsenal');
      expect(p.pactOriginalWeaponId).toBe('rivet_gun');

      // Biome 1 morph on room clear -> rarity in ['common', 'uncommon', 'rare'] and different from previous
      sim.currentBiome = 1;
      const room = sim.getCurrentRoom();
      room.type = 'combat';
      room.cleared = false;
      const beforeClearWeapon = p.weaponSlots[0];
      sim.onRoomCleared();
      const afterClearWeapon = p.weaponSlots[0];
      expect(afterClearWeapon).not.toBe(beforeClearWeapon);
      expect(['common', 'uncommon', 'rare']).toContain(WEAPONS[afterClearWeapon].rarity);

      // Biome 2 morph on next wave spawn (wavesSpawned > 1) -> rarity in ['uncommon', 'rare', 'epic']
      sim.currentBiome = 2;
      room.type = 'combat';
      room.cleared = false;
      room.wavesSpawned = 1;
      room.wavesTotal = 2;
      const beforeWaveWeapon = p.weaponSlots[0];
      sim.spawnNextRoomWave();
      const afterWaveWeapon = p.weaponSlots[0];
      expect(afterWaveWeapon).not.toBe(beforeWaveWeapon);
      expect(['uncommon', 'rare', 'epic']).toContain(WEAPONS[afterWaveWeapon].rarity);
      sim.enemies.length = 0;

      // Biome 3 morph during Boss fight every 20.0s -> rarity in ['rare', 'epic', 'legendary']
      sim.currentBiome = 3;
      room.type = 'boss';
      room.cleared = false;
      const boss = sim.spawnEnemy('spore_king', p.x + 250, p.y, true);
      boss.moveSpeed = 0;
      boss.attackCooldownTimer = 999;

      const beforeBossTimerWeapon = p.weaponSlots[0];
      for (let i = 0; i < 20 * 60; i++) {
        sim.step(1 / 60);
      }
      const morphedBossWeapon = p.weaponSlots[0];
      expect(morphedBossWeapon).not.toBe(beforeBossTimerWeapon);
      expect(['rare', 'epic', 'legendary']).toContain(WEAPONS[morphedBossWeapon].rarity);

      // Defeat Boss -> awakens relic_master_forge_seal, restores rivet_gun, +1 upgrade level, +1 compatible mutator
      const prevLevel = p.weaponUpgradeLevels?.[0] ?? 0;
      const prevMutatorsCount = p.weaponMutators?.[0]?.length ?? 0;
      expect(sim.onBossDefeated()).toBe(1);
      expect(p.activePactId).toBeNull();
      expect(p.awakenedRelicIds).toContain('relic_master_forge_seal');
      expect(p.weaponSlots[0]).toBe('rivet_gun');
      expect(p.weaponUpgradeLevels?.[0]).toBe(Math.min(3, prevLevel + 1));

      const attachedMutators = p.weaponMutators?.[0] ?? [];
      expect(attachedMutators.length).toBe(prevMutatorsCount + 1);
      const validForRivet = getCompatibleWeaponMutators('rivet_gun', []);
      expect(validForRivet).toContain(attachedMutators[0]);

      // Optional [E] interaction within 5s after Boss kill lets player keep the last morphed weapon
      expect(p.pactKeepMorphedWeaponId).toBe(morphedBossWeapon);
      expect(p.pactKeepMorphedTimer).toBeGreaterThan(0);
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.INTERACT });
      expect(p.weaponSlots[0]).toBe(morphedBossWeapon);
      expect(p.pactKeepMorphedTimer).toBe(0);
    });
  });

  describe('5. pact_ashen_hunted -> relic_executioner_scythe', () => {
    it('spawns max 1 immortal phasing ashen_executioner in combat rooms (+20% speed & 6s target switch in Co-op), fires burn wave every 2.4s, does not block room clear, and awakens into relic_executioner_scythe', () => {
      const sim = new WorldSim({
        seed: 20261102,
        coopMode: true,
        playerCount: 2,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
        autoRespawnWaves: false,
      });
      const p1 = sim.player;
      const p2 = sim.addCoopPlayer(2, 'ranger', 'Ranger P2', 2);
      p1.x = 220;
      p1.y = 220;
      p2.x = 420;
      p2.y = 220;

      // Verify static enemy definition
      expect(ENEMIES.ashen_executioner).toBeDefined();
      expect(ENEMIES.ashen_executioner.hp).toBe(9999);
      expect(ENEMIES.ashen_executioner.moveSpeed).toBe(98);
      expect(ENEMIES.ashen_executioner.flying).toBe(true);
      expect(ENEMIES.ashen_executioner.role).toBe('stalker');

      // Both players sign pact_ashen_hunted
      p1.pactChoices = ['pact_ashen_hunted', 'pact_soul_chain'];
      p2.pactChoices = ['pact_ashen_hunted', 'pact_soul_chain'];
      expect(sim.selectAshenPact('pact_ashen_hunted', p1.id)).toBe(true);
      expect(sim.selectAshenPact('pact_ashen_hunted', p2.id)).toBe(true);

      // Active combat room with 1 real enemy -> spawns exactly 1 ashen_executioner despite 2 hunted players
      const room = sim.getCurrentRoom();
      room.type = 'combat';
      room.cleared = false;
      room.wavesSpawned = 1;
      room.wavesTotal = 1;
      const realEnemy = sim.spawnEnemy('goblin_shooter', 500, 350, true);
      realEnemy.hp = 300;
      realEnemy.maxHp = 300;
      realEnemy.moveSpeed = 0;
      realEnemy.attackCooldownTimer = 999;

      sim.step(1 / 60);
      const executioners = sim.enemies.filter((e) => e.defId === 'ashen_executioner');
      expect(executioners).toHaveLength(1);
      const exec = executioners[0]!;

      // Immortal against direct damage & Wall-Slam
      sim.applyDamageToEnemy(exec, 5000);
      expect(exec.hp).toBe(9999);
      triggerEnemyWallSlam(sim, exec, undefined, 400);
      expect(exec.hp).toBe(9999);

      // Co-op with 2 hunted players: +20% speed (98 * 1.2 = 117.6) and switches target every 6.0s
      expect(exec.moveSpeed).toBeCloseTo(98 * 1.2, 2);
      const initialTargetId = exec.executionerTargetPlayerId;
      expect([p1.id, p2.id]).toContain(initialTargetId);

      // Step 2.5s -> fires Dark Flame Wave (speed 340, damage 2, element 'burn')
      let sawExecutionerWave = false;
      for (let i = 0; i < 160; i++) {
        p1.hp = p1.maxHp;
        p2.hp = p2.maxHp;
        sim.step(1 / 60);
        if (
          sim.projectiles.some(
            (b) =>
              b.team === 'enemy' &&
              b.weaponId === 'ashen_executioner_wave' &&
              b.element === 'burn' &&
              b.damage === 2 &&
              Math.abs(Math.hypot(b.vx, b.vy) - 340) < 2,
          )
        ) {
          sawExecutionerWave = true;
        }
      }
      expect(sawExecutionerWave).toBe(true);

      // Step past 6.0s total -> target switches to the other hunted player
      for (let i = 0; i < 220; i++) {
        p1.hp = p1.maxHp;
        p2.hp = p2.maxHp;
        sim.step(1 / 60);
      }
      expect(exec.executionerTargetPlayerId).not.toBe(initialTargetId);

      // Killing the only real combat enemy immediately despawns ashen_executioner and does not block room clear
      sim.applyDamageToEnemy(realEnemy, 9999);
      expect(sim.hasActiveCombatEnemies()).toBe(false);
      sim.step(1 / 60);
      expect(sim.enemies.filter((e) => e.defId === 'ashen_executioner')).toHaveLength(0);

      // Awaken into relic_executioner_scythe on Boss defeat
      sim.currentFloor = 2;
      expect(sim.onBossDefeated()).toBe(2);
      expect(p1.awakenedRelicIds).toContain('relic_executioner_scythe');

      // Cross Scythe Strike triggers on SKILL or Wall-Slam (r = 96px, scaleRelicDamage(45, floor), ICD 4.0s) and executes normal enemies <= 20% HP
      const lowEnemy = sim.spawnEnemy('wild_boar', p1.x + 50, p1.y, true);
      lowEnemy.maxHp = 500;
      lowEnemy.hp = 95; // 19% HP (<= 20% execute threshold even before or after hit)
      lowEnemy.moveSpeed = 0;

      const highEnemy = sim.spawnEnemy('wild_boar', p1.x + 60, p1.y + 20, true);
      highEnemy.maxHp = 500;
      highEnemy.hp = 500;
      highEnemy.moveSpeed = 0;

      p1.executionerScytheIcdTimer = 0;
      highEnemy.lastHitPlayerId = p1.id;
      triggerEnemyWallSlam(sim, highEnemy, undefined, 250);
      const expectedScytheDmg = scaleRelicDamage(45, sim.currentFloor);
      expect(lowEnemy.hp).toBe(0); // Executed immediately!
      expect(highEnemy.hp).toBeLessThanOrEqual(500 - expectedScytheDmg);
      expect(p1.executionerScytheIcdTimer).toBeGreaterThan(3.5);

      // Activating SKILL [Q] after ICD expires also triggers Cross Scythe Strike
      p1.executionerScytheIcdTimer = 0;
      p1.skillCooldownTimer = 0;
      p1.skillActiveTimer = 0;
      const hpBeforeSkill = highEnemy.hp;
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.SKILL });
      expect(highEnemy.hp).toBeLessThanOrEqual(hpBeforeSkill - expectedScytheDmg);
      expect(p1.executionerScytheIcdTimer).toBeGreaterThan(3.5);
    });
  });

  describe('6. pact_ricochet_vow -> relic_ancient_geometry_eye', () => {
    it('applies -35% direct hit DMG and +70% bounced / Wall-Slam DMG under pact_ricochet_vow, then awakens into relic_ancient_geometry_eye (-10% direct, +1 Smart Bounce, +55% bounced, +35% Wall-Slam)', () => {
      const sim = new WorldSim({
        seed: 20261103,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
        autoRespawnWaves: false,
      });
      const p = sim.player;
      equipPlayerWeaponSlot(p, 0, 'rivet_gun');
      p.critChance = 0;
      p.x = 250;
      p.y = 250;

      // Baseline Wall-Slam damage without pact
      const dummyEnemyBase = sim.spawnEnemy('wild_boar', 350, 250, true);
      dummyEnemyBase.maxHp = 1000;
      dummyEnemyBase.hp = 1000;
      dummyEnemyBase.lastHitPlayerId = p.id;
      triggerEnemyWallSlam(sim, dummyEnemyBase, undefined, 250);
      const baseSlamLoss = 1000 - dummyEnemyBase.hp;
      expect(baseSlamLoss).toBeGreaterThan(10);
      dummyEnemyBase.hp = 0;
      sim.enemies.length = 0;

      // Sign pact_ricochet_vow
      p.pactChoices = ['pact_ricochet_vow', 'pact_soul_chain'];
      expect(sim.selectAshenPact('pact_ricochet_vow', p.id)).toBe(true);
      expect(p.activePactId).toBe('pact_ricochet_vow');

      // 1) Direct hit (bouncesDone === 0) deals -35% damage (round(9 * 0.65) = 6)
      const directTarget = sim.spawnEnemy('goblin_shooter', 330, 250, true);
      directTarget.maxHp = 200;
      directTarget.hp = 200;
      directTarget.moveSpeed = 0;
      directTarget.attackCooldownTimer = 999;

      p.fireCooldownTimer = 0;
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
      const firedProj = sim.projectiles[sim.projectiles.length - 1]!;
      expect(firedProj).toBeDefined();
      expect(firedProj.bounceRemaining).toBeGreaterThanOrEqual(1);
      expect(firedProj.bouncesDone ?? 0).toBe(0);

      for (let i = 0; i < 20 && sim.projectiles.length > 0; i++) {
        sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      }
      expect(200 - directTarget.hp).toBe(Math.round(9 * 0.65));

      // 2) Bounced hit (bouncesDone >= 1) deals +70% damage (round(9 * 1.70) = 15)
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      const bounceTarget = sim.spawnEnemy('goblin_shooter', 330, 250, true);
      bounceTarget.maxHp = 200;
      bounceTarget.hp = 200;
      bounceTarget.moveSpeed = 0;
      bounceTarget.attackCooldownTimer = 999;

      p.fireCooldownTimer = 0;
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
      const bouncedProj = sim.projectiles[sim.projectiles.length - 1]!;
      bouncedProj.bouncesDone = 1; // simulate after 1 wall/cover bounce
      for (let i = 0; i < 20 && sim.projectiles.length > 0; i++) {
        sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      }
      expect(200 - bounceTarget.hp).toBe(Math.round(9 * 1.7));

      // 3) Wall-Slam under pact_ricochet_vow deals +70% damage
      const pactSlamEnemy = sim.spawnEnemy('wild_boar', 350, 250, true);
      pactSlamEnemy.maxHp = 1000;
      pactSlamEnemy.hp = 1000;
      pactSlamEnemy.lastHitPlayerId = p.id;
      triggerEnemyWallSlam(sim, pactSlamEnemy, undefined, 250);
      expect(1000 - pactSlamEnemy.hp).toBe(Math.round(baseSlamLoss * 1.7));

      // 4) Awaken into relic_ancient_geometry_eye on Boss defeat
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      expect(sim.onBossDefeated()).toBe(1);
      expect(p.activePactId).toBeNull();
      expect(p.awakenedRelicIds).toContain('relic_ancient_geometry_eye');

      // Direct hit under relic_ancient_geometry_eye -> -10% damage (round(9 * 0.90) = 8)
      const relicDirectTarget = sim.spawnEnemy('goblin_shooter', 330, 250, true);
      relicDirectTarget.maxHp = 200;
      relicDirectTarget.hp = 200;
      relicDirectTarget.moveSpeed = 0;
      relicDirectTarget.attackCooldownTimer = 999;

      p.fireCooldownTimer = 0;
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
      for (let i = 0; i < 20 && sim.projectiles.length > 0; i++) {
        sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      }
      expect(200 - relicDirectTarget.hp).toBe(Math.round(9 * 0.9));

      // Bounced hit under relic_ancient_geometry_eye -> +55% damage (round(9 * 1.55) = 14)
      sim.enemies.length = 0;
      sim.projectiles.length = 0;
      const relicBounceTarget = sim.spawnEnemy('goblin_shooter', 330, 250, true);
      relicBounceTarget.maxHp = 200;
      relicBounceTarget.hp = 200;
      relicBounceTarget.moveSpeed = 0;
      relicBounceTarget.attackCooldownTimer = 999;

      p.fireCooldownTimer = 0;
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
      const relicBouncedProj = sim.projectiles[sim.projectiles.length - 1]!;
      relicBouncedProj.bouncesDone = 1;
      for (let i = 0; i < 20 && sim.projectiles.length > 0; i++) {
        sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      }
      expect(200 - relicBounceTarget.hp).toBe(Math.round(9 * 1.55));

      // Wall-Slam under relic_ancient_geometry_eye deals +35% damage
      const relicSlamEnemy = sim.spawnEnemy('wild_boar', 350, 250, true);
      relicSlamEnemy.maxHp = 1000;
      relicSlamEnemy.hp = 1000;
      relicSlamEnemy.lastHitPlayerId = p.id;
      triggerEnemyWallSlam(sim, relicSlamEnemy, undefined, 250);
      expect(1000 - relicSlamEnemy.hp).toBe(Math.round(baseSlamLoss * 1.35));
    });
  });
});
