import { describe, expect, it } from 'vitest';
import {
  CORE_WEAPON_MUTATOR_IDS,
  INPUT_BUTTON,
  MAX_PELLETS_PER_TRIGGER,
  SIM_STEP_SEC,
  WEAPONS,
  WEAPON_MUTATORS,
  WorldSim,
  isMutatorCompatibleWithWeapon,
} from '../src/index.js';

function createCombatArenaSim(seed = 20261028): WorldSim {
  return new WorldSim({
    seed,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
    autoRespawnWaves: false,
  });
}

describe('AP2 P2A.2: Treasure Forge Workshop & 6 Core Daedalus Weapon Mutators', () => {
  it('defines 6 Core Weapon Mutators (phase 1) and checks weapon compatibility', () => {
    expect(CORE_WEAPON_MUTATOR_IDS).toHaveLength(6);
    for (const id of CORE_WEAPON_MUTATOR_IDS) {
      const def = WEAPON_MUTATORS[id];
      expect(def).toBeDefined();
      expect(def.phase).toBe(1);
    }

    // Ranged mutators compatible with ranged weapons, shockwave_edge only with melee
    expect(isMutatorCompatibleWithWeapon('mutator_finale_jolt', 'tesla_carbine')).toBe(true);
    expect(isMutatorCompatibleWithWeapon('mutator_finale_jolt', 'gale_smg')).toBe(true);
    expect(isMutatorCompatibleWithWeapon('mutator_finale_jolt', 'knight_sword')).toBe(false);

    expect(isMutatorCompatibleWithWeapon('mutator_shockwave_edge', 'knight_sword')).toBe(true);
    expect(isMutatorCompatibleWithWeapon('mutator_shockwave_edge', 'thunder_hammer')).toBe(true);
    expect(isMutatorCompatibleWithWeapon('mutator_shockwave_edge', 'tesla_carbine')).toBe(false);
  });

  it('spawns 1 weapon chest + daedalus_anvil on Odd floors (1, 3, 5) without pressure-plate puzzle, and attaches up to 2 mutators per weapon slot per player', () => {
    const sim = new WorldSim({
      seed: 77701,
      coopMode: true,
      playerCount: 2,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Ally P2', 2);
    p1.weaponSlots[0] = 'tesla_carbine';
    p2.weaponSlots[0] = 'knight_sword';

    const treasureRoom = sim.dungeon.rooms.find((r) => r.type === 'treasure');
    expect(treasureRoom).toBeDefined();

    sim.enterRoom(treasureRoom!.id);

    // No pressure plates or push blocks spawned automatically in treasure room
    expect(sim.pressurePlates).toHaveLength(0);
    expect(sim.pushBlocks).toHaveLength(0);

    // 1 weapon chest + 1 daedalus_anvil in treasure room
    expect(sim.chests).toHaveLength(1);
    expect(sim.chests[0]!.opened).toBe(false);

    const anvils = sim.npcEntities.filter((n) => n.kind === 'daedalus_anvil');
    expect(anvils).toHaveLength(1);
    const anvil = anvils[0]!;

    // Move Player 1 & Player 2 next to the Daedalus Anvil and interact
    p1.x = anvil.x;
    p1.y = anvil.y + 16;
    p2.x = anvil.x;
    p2.y = anvil.y - 16;

    expect(sim.interactWithNearest(p1.id)).toBe(true);
    expect(p1.mutatorChoices).toBeDefined();
    expect(p1.mutatorChoices).toHaveLength(2);
    for (const choiceId of p1.mutatorChoices!) {
      expect(isMutatorCompatibleWithWeapon(choiceId, 'tesla_carbine')).toBe(true);
    }

    const chosenMutatorP1 = p1.mutatorChoices![0]!;
    expect(sim.selectWeaponMutator(chosenMutatorP1, p1.id)).toBe(true);
    expect(p1.weaponMutators[0]).toEqual([chosenMutatorP1]);
    expect(p1.mutatorChoices).toEqual([]);

    // Player 1 cannot use the same anvil a second time in the same room
    expect(sim.interactWithNearest(p1.id)).toBe(false);

    // Player 2 in Co-op can still independently use the anvil for their melee weapon!
    expect(sim.interactWithNearest(p2.id)).toBe(true);
    expect(p2.mutatorChoices).toBeDefined();
    expect(p2.mutatorChoices!.length).toBeGreaterThanOrEqual(1);
    expect(p2.mutatorChoices).toContain('mutator_shockwave_edge');
    expect(sim.selectWeaponMutator('mutator_shockwave_edge', p2.id)).toBe(true);
    expect(p2.weaponMutators[0]).toEqual(['mutator_shockwave_edge']);

    // Verify 2-mutator cap per weapon slot
    const otherCompatible = CORE_WEAPON_MUTATOR_IDS.filter(
      (id) => id !== chosenMutatorP1 && isMutatorCompatibleWithWeapon(id, 'tesla_carbine'),
    );
    p1.mutatorChoices = [otherCompatible[0]!, otherCompatible[1]!];
    expect(sim.selectWeaponMutator(otherCompatible[0]!, p1.id)).toBe(true);
    expect(p1.weaponMutators[0]).toHaveLength(2);

    // Trying to attach a 3rd mutator to the same slot fails (capped at 2)
    p1.mutatorChoices = [otherCompatible[1]!];
    expect(sim.selectWeaponMutator(otherCompatible[1]!, p1.id)).toBe(false);
    expect(p1.weaponMutators[0]).toHaveLength(2);
  });

  it('spawns 1 weapon chest + upgrade_anvil on Even floors (2, 4, 6) and upgrades weapon level (+1 level = +20% Base DMG)', () => {
    const sim = new WorldSim({
      seed: 77702,
      coopMode: true,
      playerCount: 2,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.advanceToFloor(2); // Floor 2 (even floor)
    expect(sim.currentFloor).toBe(2);

    const p1 = sim.player;
    p1.weaponSlots[0] = 'tesla_carbine';
    p1.activeWeaponSlot = 0;
    p1.critChance = 0;

    const treasureRoom = sim.dungeon.rooms.find((r) => r.type === 'treasure');
    expect(treasureRoom).toBeDefined();
    sim.enterRoom(treasureRoom!.id);

    const anvils = sim.npcEntities.filter((n) => n.kind === 'upgrade_anvil');
    expect(anvils).toHaveLength(1);
    const anvil = anvils[0]!;

    // Fire before upgrade to measure base bullet damage
    p1.x = anvil.x;
    p1.y = anvil.y + 16;
    p1.clipAmmo = 8;
    p1.fireCooldownTimer = 0;
    sim.step({ seq: 1, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    const baseProjDmg = sim.projectiles[0]!.damage;
    sim.projectiles = [];

    // Interact with upgrade_anvil
    expect(p1.weaponUpgradeLevels?.[0] ?? 0).toBe(0);
    expect(sim.interactWithNearest(p1.id)).toBe(true);
    expect(p1.weaponUpgradeLevels?.[0]).toBe(1);

    // Cannot reuse the same upgrade_anvil for Player 1
    expect(sim.interactWithNearest(p1.id)).toBe(false);
    expect(p1.weaponUpgradeLevels?.[0]).toBe(1);

    // Fire after upgrade: +20% Base DMG
    p1.fireCooldownTimer = 0;
    sim.step({ seq: 2, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    const upgradedProjDmg = sim.projectiles[0]!.damage;
    expect(upgradedProjDmg).toBe(Math.round(baseProjDmg * 1.2));
  });

  it('mutator_finale_jolt: +20% fire rate, fires 3-burst (+40% Additive DMG) on Finale Shot or Tactical Vent [R], and recoils 48px backward safely stopping before chasm', () => {
    const sim = createCombatArenaSim(88001);
    const p = sim.player;
    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;

    p.weaponSlots[0] = 'tesla_carbine';
    p.activeWeaponSlot = 0;
    p.weaponMutators[0] = ['mutator_finale_jolt'];
    p.x = cx;
    p.y = cy;

    // 1) Normal shot checks +20% fire rate
    const def = WEAPONS.tesla_carbine!;
    p.clipAmmo = 5;
    p.fireCooldownTimer = 0;
    sim.step({ seq: 1, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    expect(p.fireCooldownTimer).toBeCloseTo(def.cooldownSec! / 1.2, 2);
    const normalDmg = sim.projectiles[0]!.damage;
    sim.projectiles = [];

    // 2) Finale Shot (clipAmmo === 1): fires 3-burst with +40% Additive DMG and recoils 48px backward (-X)
    p.x = cx;
    p.y = cy;
    p.clipAmmo = 1;
    p.fireCooldownTimer = 0;
    sim.step({ seq: 2, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    expect(sim.projectiles.length).toBeGreaterThanOrEqual(3);
    // Finale Shot has base +50% additive + 40% from mutator_finale_jolt = 1.9x normal damage
    expect(sim.projectiles[0]!.damage).toBeGreaterThan(Math.round(normalDmg * 1.6));
    expect(p.x).toBeCloseTo(cx - 48, 0);

    // 3) Chasm safety clamp: place a chasm tile right behind player (-X) and fire Finale Shot aiming +X
    sim.projectiles = [];
    p.x = cx;
    p.y = cy;
    const chasmTx = Math.floor((cx - 28) / 32);
    const chasmTy = Math.floor(cy / 32);
    sim.map.setSurface(chasmTx, chasmTy, 'chasm');
    p.clipAmmo = 1;
    p.reloadTimer = 0;
    p.fireCooldownTimer = 0;
    sim.step({ seq: 3, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    // Player recoiled backward toward -X, but MUST stop before entering the chasm tile!
    expect(sim.map.getSurfaceAtWorld(p.x, p.y)).not.toBe('chasm');
    expect(p.x).toBeGreaterThan((chasmTx + 1) * 32);

    // 4) Tactical Vent [R] on HEAT_VENT weapon also triggers 3-burst + safe recoil
    sim.map.setSurface(chasmTx, chasmTy, 'none');
    sim.projectiles = [];
    p.weaponSlots[0] = 'gale_smg';
    p.x = cx;
    p.y = cy;
    p.weaponHeat = 75; // Orange zone
    p.overheatLockTimer = 0;
    p.ventCooldownTimer = 0;
    sim.step({ seq: 4, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.RELOAD_VENT });
    expect(sim.projectiles.length).toBeGreaterThanOrEqual(3);
    expect(p.x).toBeCloseTo(cx - 48, 0);
  });

  it('mutator_gravity_singularity: Finale Shot or post-Perfect Reload shot turns hit enemy into 1.8s Singularity pulling enemies & explosive props within 140px', () => {
    const sim = createCombatArenaSim(88002);
    const p = sim.player;
    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;

    p.weaponSlots[0] = 'tesla_carbine';
    p.activeWeaponSlot = 0;
    p.weaponMutators[0] = ['mutator_gravity_singularity'];
    p.x = cx - 120;
    p.y = cy;
    p.clipAmmo = 1; // Finale Shot
    p.fireCooldownTimer = 0;

    // Target enemy at (cx, cy)
    const anchorEnemy = sim.spawnEnemy('goblin_shooter', cx, cy, true);
    anchorEnemy.hp = 500;
    anchorEnemy.maxHp = 500;
    anchorEnemy.moveSpeed = 0;

    // Nearby enemy within 140px (at cx, cy - 100)
    const pulledEnemy = sim.spawnEnemy('goblin_shooter', cx, cy - 100, true);
    pulledEnemy.hp = 500;
    pulledEnemy.maxHp = 500;
    pulledEnemy.moveSpeed = 0;

    // Nearby explosive barrel within 140px (at cx, cy + 100)
    const barrel = sim.spawnProp('explosive_barrel', cx, cy + 100);

    // Fire Finale Shot and step until projectile hits anchorEnemy
    sim.step({ seq: 1, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    for (let i = 0; i < 25; i++) {
      sim.step({ seq: i + 2, moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
    }

    expect(anchorEnemy.gravitySingularityTimer ?? 0).toBeGreaterThan(0);

    // Distance from pulledEnemy and barrel to anchorEnemy should decrease significantly
    const distEnemyAfter = Math.hypot(pulledEnemy.x - anchorEnemy.x, pulledEnemy.y - anchorEnemy.y);
    const distBarrelAfter = Math.hypot(barrel.x - anchorEnemy.x, barrel.y - anchorEnemy.y);
    expect(distEnemyAfter).toBeLessThan(85);
    expect(distBarrelAfter).toBeLessThan(85);
  });

  it('mutator_shockwave_edge: +30% melee swing range and fires a 180px shockwave blade (60% DMG) on every swing', () => {
    const sim = createCombatArenaSim(88003);
    const p = sim.player;
    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;

    p.weaponSlots[0] = 'knight_sword';
    p.activeWeaponSlot = 0;
    p.weaponMutators[0] = ['mutator_shockwave_edge'];
    p.x = cx - 100;
    p.y = cy;
    p.fireCooldownTimer = 0;

    const baseRange = WEAPONS.knight_sword!.range ?? 56; // 56px -> +30% = 73px
    const baseDmg = WEAPONS.knight_sword!.damage; // 12

    // Enemy 1 at 65px away (outside base 56px range, inside +30% 73px melee range)
    const closeEnemy = sim.spawnEnemy('goblin_shooter', p.x + 65, p.y, true);
    closeEnemy.hp = 500;
    closeEnemy.maxHp = 500;

    // Enemy 2 at 140px away (outside melee range, inside 180px shockwave blade path)
    const midEnemy = sim.spawnEnemy('goblin_shooter', p.x + 140, p.y, true);
    midEnemy.hp = 500;
    midEnemy.maxHp = 500;

    // Swing melee weapon
    sim.step({ seq: 1, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });

    // Close enemy at 65px (> baseRange 56px) was hit immediately by the +30% extended melee swing!
    expect(65).toBeGreaterThan(baseRange);
    expect(closeEnemy.hp).toBeLessThan(500);

    // A 180px shockwave blade projectile was spawned with 60% damage
    const waveProj = sim.projectiles.find((proj) => proj.weaponId === 'shockwave_edge_blade');
    expect(waveProj).toBeDefined();
    expect(waveProj!.damage).toBe(Math.round(baseDmg * 0.6));

    // Step simulation so shockwave blade travels and hits midEnemy at 140px
    for (let i = 0; i < 20; i++) {
      midEnemy.x = p.x + 140;
      midEnemy.y = p.y;
      sim.step({ seq: i + 2, moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
    }
    expect(midEnemy.hp).toBe(500 - Math.round(baseDmg * 0.6));
  });

  it('mutator_chain_harpoon: Finale Shot or post-Perfect Reload shot yanks hit enemy into nearest flipped cover or wall within 220px and triggers wall_slam', () => {
    const sim = createCombatArenaSim(88004);
    const p = sim.player;
    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;

    p.weaponSlots[0] = 'tesla_carbine';
    p.activeWeaponSlot = 0;
    p.weaponMutators[0] = ['mutator_chain_harpoon'];
    p.x = cx - 120;
    p.y = cy;
    p.clipAmmo = 1; // Finale Shot
    p.fireCooldownTimer = 0;

    // Target enemy at (cx, cy)
    const target = sim.spawnEnemy('goblin_shooter', cx, cy, true);
    target.hp = 500;
    target.maxHp = 500;

    // Flipped cover prop within 220px at (cx, cy - 110)
    const cover = sim.spawnProp('moss_table', cx, cy - 110);
    cover.coverState = 'flipped';
    cover.blocksEnemyProjectiles = true;

    let wallSlamTriggered = false;
    sim.step({ seq: 1, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    for (const ev of sim.drainEvents()) {
      if (ev.kind === 'wall_slam') wallSlamTriggered = true;
    }
    for (let i = 0; i < 15; i++) {
      sim.step({ seq: i + 2, moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      for (const ev of sim.drainEvents()) {
        if (ev.kind === 'wall_slam') wallSlamTriggered = true;
      }
    }

    expect(wallSlamTriggered).toBe(true);
    expect(target.stunTimer).toBeGreaterThan(0);
    expect(Math.hypot(target.x - cx, target.y - (cy - 110))).toBeLessThan(48);
  });

  it('mutator_prism_splitter: reduces pellet damage by 20% (x0.80) and splits shots into 3 rays while strictly respecting MAX_PELLETS_PER_TRIGGER = 9', () => {
    const sim = createCombatArenaSim(88005);
    const p = sim.player;
    p.x = sim.map.width * 0.5;
    p.y = sim.map.height * 0.5;

    // 1) Single-pellet carbine -> 3 rays at 80% damage
    p.weaponSlots[0] = 'tesla_carbine';
    p.activeWeaponSlot = 0;
    p.weaponMutators[0] = [];
    p.clipAmmo = 8;
    p.fireCooldownTimer = 0;
    sim.step({ seq: 1, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    expect(sim.projectiles).toHaveLength(1);
    const baseCarbineDmg = sim.projectiles[0]!.damage;
    sim.projectiles = [];

    p.weaponMutators[0] = ['mutator_prism_splitter'];
    p.fireCooldownTimer = 0;
    sim.step({ seq: 2, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    expect(sim.projectiles).toHaveLength(3);
    expect(sim.projectiles[0]!.damage).toBe(Math.round(baseCarbineDmg * 0.8));
    sim.projectiles = [];

    // 2) Multi-pellet scrap_shotgun (base 6 pellets * 3 = 18 -> strictly clamped to MAX_PELLETS_PER_TRIGGER = 9)
    p.weaponSlots[0] = 'scrap_shotgun';
    p.clipAmmo = 2;
    p.fireCooldownTimer = 0;
    sim.step({ seq: 3, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    expect(sim.projectiles).toHaveLength(MAX_PELLETS_PER_TRIGGER);
    expect(sim.projectiles.length).toBeLessThanOrEqual(9);
  });

  it('mutator_thermal_meltdown: expands Golden Window (0.38..0.77) and Orange Heat Zone (50..95) by +25% and empowered shots bypass front shield', () => {
    const sim = createCombatArenaSim(88006);
    const p = sim.player;
    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;
    p.x = cx - 100;
    p.y = cy;

    // 1) Expanded CLIP_RELOAD Golden Window (progress = 0.40 is outside default 0.45..0.70, inside expanded 0.38..0.77)
    p.weaponSlots[0] = 'tesla_carbine';
    p.activeWeaponSlot = 0;
    p.weaponMutators[0] = ['mutator_thermal_meltdown'];
    p.clipAmmo = 2;
    p.reloadDuration = WEAPONS.tesla_carbine!.reloadDurationSec;
    p.reloadTimer = p.reloadDuration * (1 - 0.4); // progress = 0.40
    p.reloadLockout = false;

    sim.step({ seq: 1, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.RELOAD_VENT });
    expect(p.reloadTimer).toBe(0);
    expect(p.overclockedNextShot).toBe(true);

    // 2) Empowered Overclocked Shot bypasses iron_shielder frontShieldReduction (normally 85% reduction)
    const shielder = sim.spawnEnemy('iron_shielder', cx, cy, true);
    shielder.hp = 500;
    shielder.maxHp = 500;
    shielder.aimAngle = Math.PI; // Facing directly toward player at (cx - 100, cy)

    p.fireCooldownTimer = 0;
    sim.step({ seq: 2, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    const expectedFullOverclockDmg = sim.projectiles[0]!.damage;
    for (let i = 0; i < 15; i++) {
      shielder.x = cx;
      shielder.y = cy;
      shielder.aimAngle = Math.PI;
      sim.step({ seq: i + 3, moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
    }
    expect(500 - shielder.hp).toBe(expectedFullOverclockDmg);

    // 3) Expanded HEAT_VENT Orange Zone (heat = 55 is outside default 65..95, inside expanded 50..95)
    p.weaponSlots[0] = 'gale_smg';
    p.weaponHeat = 55;
    p.overheatLockTimer = 0;
    p.ventCooldownTimer = 0;
    sim.step({ seq: 20, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.RELOAD_VENT });
    expect(p.weaponHeat).toBe(0);
  });
});
