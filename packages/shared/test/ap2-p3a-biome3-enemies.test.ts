import { describe, expect, it } from 'vitest';
import {
  ENEMIES,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  WorldSim,
  fireDwarfCannonLobbedMortar,
  spawnCoalBombOnDeath,
  stepCoalBombsAndDetonate,
  stepPendingMortarStrikes,
  triggerIronShielderShockArc,
  triggerWelderDroneEmpBlastOnDeath,
} from '../src/index.js';

function createCleanBiome3Sim(seed = 6201): WorldSim {
  const sim = new WorldSim({
    seed,
    biome: 3,
    spawnInitialWave: false,
    includeProps: false,
    includeTrainingDummy: false,
    autoRespawnWaves: false,
  });
  sim.enemies.length = 0;
  sim.props.length = 0;
  sim.projectiles.length = 0;
  sim.chests.length = 0;
  sim.worldItems.length = 0;
  sim.pickups.length = 0;
  sim.npcEntities.length = 0;
  sim.portalActive = false;
  for (let ty = 2; ty < sim.map.rows - 2; ty++) {
    for (let tx = 2; tx < sim.map.cols - 2; tx++) {
      sim.map.setTile(tx, ty, 'floor');
      sim.map.setSurface(tx, ty, 'none', 0, true);
    }
  }
  sim.map.rebuildSolidBoxes();
  sim.player.x = 320;
  sim.player.y = 320;
  sim.player.vx = 0;
  sim.player.vy = 0;
  return sim;
}

describe('AP2-P3A.4: 4 Biome 3 Terrain-Interactive Enemy Behaviors', () => {
  describe('1. coal_golem: Drops 2.0s Fuse coal_bomb on Death, Dash-Kick / Melee-Kick at 560 px/s & r=96px Fire Blast', () => {
    it('drops an intact coal_bomb at (e.x, e.y) with fuseTimer = 2.0 when killed, which player can Dash-Kick at 560 px/s into enemies for >= 85 AoE Fire + burn damage', () => {
      const sim = createCleanBiome3Sim(6201);
      sim.player.x = 340;
      sim.player.y = 320;

      expect(typeof spawnCoalBombOnDeath).toBe('function');
      expect(typeof stepCoalBombsAndDetonate).toBe('function');

      const golem = sim.spawnEnemy('coal_golem', 430, 320, true);
      sim.applyDamageToEnemy(golem, 999, false, 'none', 0, 0, true, sim.player.id);
      expect(golem.hp).toBe(0);

      const coalBomb = sim.props.find(
        (p) => p.kind === 'coal_bomb' && Math.hypot(p.x - 430, p.y - 320) < 4,
      );
      expect(coalBomb).toBeDefined();
      expect(coalBomb!.state).toBe('intact');
      expect(coalBomb!.fuseTimer).toBeCloseTo(2.0, 2);
      expect(coalBomb!.radius).toBe(18);

      // Spawn two ranged enemies downrange at (580, 320) and (610, 355) (within r = 96px of impact)
      const imp1 = sim.spawnEnemy('fire_imp', 580, 320, true);
      imp1.hp = 200;
      imp1.maxHp = 200;
      imp1.aiState = 'idle';
      imp1.stateTimer = 10;

      const imp2 = sim.spawnEnemy('dwarf_cannon', 610, 355, true);
      imp2.hp = 220;
      imp2.maxHp = 220;
      imp2.aiState = 'idle';
      imp2.stateTimer = 10;

      const imp1HpBefore = imp1.hp;
      const imp2HpBefore = imp2.hp;

      // Player Dash-Kicks the coal_bomb at 560 px/s toward the enemy cluster (+X)
      const kicked = sim.kickProp(coalBomb!, sim.player, 0);
      expect(kicked).toBe(true);
      expect(coalBomb!.state).toBe('sliding');
      expect(coalBomb!.coverState).toBe('sliding');
      expect(Math.hypot(coalBomb!.vx ?? 0, coalBomb!.vy ?? 0)).toBeCloseTo(560, 1);

      // Step simulation until coal_bomb impacts imp1 and detonates (r = 96px)
      for (let i = 0; i < 20; i++) {
        sim.step(SIM_STEP_SEC);
        if (coalBomb!.hp <= 0) break;
      }

      expect(coalBomb!.hp).toBe(0);
      expect(coalBomb!.lastCombatText).toBe('COAL BOMB BLAST!');
      expect(imp1HpBefore - imp1.hp).toBeGreaterThanOrEqual(85);
      expect(imp2HpBefore - imp2.hp).toBeGreaterThanOrEqual(85);
      expect(imp1.burnTimer).toBeGreaterThan(0);
      expect(imp2.burnTimer).toBeGreaterThan(0);
      expect(imp2.lastCombatText).toBe('COAL BOMB BLAST!');
    });

    it('supports melee-kicking coal_bomb at 560 px/s and also detonates automatically when 2.0s fuseTimer expires', () => {
      const sim = createCleanBiome3Sim(6202);
      sim.player.x = 340;
      sim.player.y = 320;
      sim.player.aimAngle = 0;

      // 1) Melee-kick test
      const golem1 = sim.spawnEnemy('coal_golem', 372, 320, true);
      sim.applyDamageToEnemy(golem1, 999, false, 'none', 0, 0, true, sim.player.id);
      const bomb1 = sim.props.find((p) => p.kind === 'coal_bomb');
      expect(bomb1).toBeDefined();

      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: INPUT_BUTTON.FIRE,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);
      expect(bomb1!.state).toBe('sliding');
      expect(Math.hypot(bomb1!.vx ?? 0, bomb1!.vy ?? 0)).toBeCloseTo(560, 1);

      // 2) Un-kicked 2.0s fuse expiry detonation test
      const sim2 = createCleanBiome3Sim(6203);
      const golem2 = sim2.spawnEnemy('coal_golem', 520, 320, true);
      sim2.applyDamageToEnemy(golem2, 999, false, 'none', 0, 0, true, sim2.player.id);
      const bomb2 = sim2.props.find((p) => p.kind === 'coal_bomb');
      expect(bomb2).toBeDefined();

      const nearbyEnemy = sim2.spawnEnemy('fire_imp', 575, 320, true);
      nearbyEnemy.hp = 200;
      nearbyEnemy.maxHp = 200;
      nearbyEnemy.moveSpeed = 0;
      nearbyEnemy.aiState = 'idle';
      nearbyEnemy.stateTimer = 10;
      const hpBefore = nearbyEnemy.hp;

      for (let i = 0; i < 122; i++) {
        sim2.step(SIM_STEP_SEC);
        if (bomb2!.hp <= 0) break;
      }

      expect(bomb2!.hp).toBe(0);
      expect(hpBefore - nearbyEnemy.hp).toBeGreaterThanOrEqual(85);
      expect(nearbyEnemy.burnTimer).toBeGreaterThan(0);
    });
  });

  describe('2. iron_shielder: 80% Frontal Bullet Reduction & Rear Cone Lightning Arc on Shock Hit', () => {
    it('reduces frontal normal bullets by 80%, and discharges a rear lightning arc cone (r=160px, ±65°) when hit on the front shield by a shock attack', () => {
      expect(ENEMIES.iron_shielder.frontShieldReduction).toBeCloseTo(0.8, 2);
      expect(typeof triggerIronShielderShockArc).toBe('function');

      const sim = createCleanBiome3Sim(6204);
      sim.player.x = 320;
      sim.player.y = 320;

      const shielder = sim.spawnEnemy('iron_shielder', 480, 320, true);
      shielder.hp = 300;
      shielder.maxHp = 300;
      shielder.aimAngle = Math.PI; // Facing left toward player at (320, 320)

      // Spawn two enemies hiding behind the shielder (to the right, around angle 0 = aimAngle + Math.PI)
      const rearEnemy1 = sim.spawnEnemy('fire_imp', 580, 300, true); // dist ~102 <= 160, well within ±65°
      rearEnemy1.hp = 180;
      rearEnemy1.maxHp = 180;
      rearEnemy1.aiState = 'move';

      const rearEnemy2 = sim.spawnEnemy('dwarf_cannon', 610, 355, true); // dist ~135 <= 160, within ±65°
      rearEnemy2.hp = 200;
      rearEnemy2.maxHp = 200;
      rearEnemy2.aiState = 'move';

      // 1) Normal frontal bullet (element = 'none', hitAngleRad = 0 -> incoming from Math.PI) is reduced by 80%
      const shielderHpBeforeNormal = shielder.hp;
      sim.applyDamageToEnemy(shielder, 100, false, 'none', 0, 0, false, sim.player.id);
      expect(shielderHpBeforeNormal - shielder.hp).toBe(20);
      expect(rearEnemy1.aiState).not.toBe('stunned');

      // 2) Shock attack hitting frontal shield conducts electricity and arcs behind the shield!
      const rear1HpBefore = rearEnemy1.hp;
      const rear2HpBefore = rearEnemy2.hp;
      sim.applyDamageToEnemy(shielder, 40, false, 'shock', 0, 0, false, sim.player.id);

      expect(rear1HpBefore - rearEnemy1.hp).toBeGreaterThanOrEqual(45);
      expect(rear2HpBefore - rearEnemy2.hp).toBeGreaterThanOrEqual(45);
      expect(rearEnemy1.stunTimer).toBeGreaterThanOrEqual(1.4);
      expect(rearEnemy1.aiState).toBe('stunned');
      expect(rearEnemy2.stunTimer).toBeGreaterThanOrEqual(1.4);
      expect(rearEnemy2.aiState).toBe('stunned');

      expect(shielder.stunTimer).toBeGreaterThanOrEqual(1.0);
      expect(shielder.aiState).toBe('stunned');
      expect(shielder.shieldBrokenTimer).toBeGreaterThanOrEqual(3.0);
      expect(shielder.lastCombatText).toBe('SHIELD SHOCK ARC!');
    });
  });

  describe('3. dwarf_cannon: Lobbed Mortar Arcing Over Low Cover (r=56px, timer=0.85s)', () => {
    it('fires a Lobbed Mortar over low/flipped cover, creating a r=56px floor indicator that detonates after 0.85s', () => {
      expect(typeof fireDwarfCannonLobbedMortar).toBe('function');
      expect(typeof stepPendingMortarStrikes).toBe('function');

      const sim = createCleanBiome3Sim(6205);
      sim.player.x = 340;
      sim.player.y = 320;
      sim.player.armor = 0;

      // Place a flipped forge_blast_shield directly between dwarf_cannon and player
      const shieldCover = sim.spawnProp('forge_blast_shield', 450, 320);
      sim.flipCoverProp(shieldCover, sim.player);
      expect(shieldCover.coverState).toBe('flipped');
      shieldCover.microBlankTimer = 0;
      const coverHpBefore = shieldCover.hp;

      const cannon = sim.spawnEnemy('dwarf_cannon', 580, 320, true);
      cannon.aiState = 'telegraph';
      cannon.stateTimer = 0.01;
      cannon.telegraphDurationSec = 0.65;

      // Step 1 tick so dwarf_cannon finishes telegraph and launches the Lobbed Mortar
      sim.step(SIM_STEP_SEC);

      expect(sim.pendingMortarStrikes.length).toBe(1);
      const strike = sim.pendingMortarStrikes[0]!;
      expect(strike.radius).toBe(56);
      expect(strike.maxTimer).toBeCloseTo(0.85, 2);
      expect(strike.timer).toBeCloseTo(0.85, 2);
      expect(Math.hypot(strike.x - sim.player.x, strike.y - sim.player.y)).toBeLessThan(24);

      // Step 30 ticks (0.50s) -> mortar is still in flight, NOT blocked by the flipped cover in the middle
      for (let i = 0; i < 30; i++) {
        sim.step(SIM_STEP_SEC);
      }
      expect(sim.pendingMortarStrikes.length).toBe(1);
      expect(shieldCover.hp).toBe(coverHpBefore);

      // Step remaining 21 ticks (total 51 ticks = 0.85s) -> mortar lands and detonates at (strike.x, strike.y)
      const playerHpBefore = sim.player.hp;
      for (let i = 0; i < 22; i++) {
        sim.step(SIM_STEP_SEC);
        if (sim.pendingMortarStrikes.length === 0) break;
      }

      expect(sim.pendingMortarStrikes.length).toBe(0);
      expect(sim.player.hp).toBeLessThan(playerHpBefore);

      // Verify room transitions clear in-flight pendingMortarStrikes and empBlastVisualRings
      fireDwarfCannonLobbedMortar(sim, cannon, sim.player);
      sim.empBlastVisualRings.push({ x: 320, y: 320, radius: 110, timer: 0.4, maxTimer: 0.4 });
      expect(sim.pendingMortarStrikes.length).toBe(1);
      expect(sim.empBlastVisualRings.length).toBe(1);
      sim.enterRoom(sim.currentRoomId);
      expect(sim.pendingMortarStrikes.length).toBe(0);
      expect(sim.empBlastVisualRings.length).toBe(0);
    });
  });

  describe('4. welder_drone: Crashes & Triggers r=110px EMP Blast on Death (1.5s Stun + Shield Strip)', () => {
    it('triggers an EMP Blast (r=110px) when killed, stripping shieldArmor, setting shieldBrokenTimer >= 5.0, dealing >= 35 shock damage, and stunning enemies for 1.5s', () => {
      expect(typeof triggerWelderDroneEmpBlastOnDeath).toBe('function');

      const sim = createCleanBiome3Sim(6206);
      sim.player.x = 300;
      sim.player.y = 320;

      const drone = sim.spawnEnemy('welder_drone', 520, 320, true);
      const nearby1 = sim.spawnEnemy('iron_shielder', 580, 320, true); // dist = 60 <= 110
      nearby1.hp = 240;
      nearby1.maxHp = 240;
      nearby1.shieldArmor = 24;
      nearby1.maxShieldArmor = 24;

      const nearby2 = sim.spawnEnemy('fire_imp', 460, 360, true); // dist ~72 <= 110
      nearby2.hp = 160;
      nearby2.maxHp = 160;
      nearby2.shieldArmor = 18;
      nearby2.maxShieldArmor = 18;

      const farEnemy = sim.spawnEnemy('coal_golem', 720, 320, true); // dist = 200 > 110
      farEnemy.hp = 250;
      farEnemy.maxHp = 250;
      farEnemy.shieldArmor = 20;

      const hp1Before = nearby1.hp;
      const hp2Before = nearby2.hp;
      const hpFarBefore = farEnemy.hp;

      // Kill welder_drone
      sim.applyDamageToEnemy(drone, 999, true, 'none', 0, 0, true, sim.player.id);
      expect(drone.hp).toBe(0);

      // Nearby enemies within 110px are stripped of shieldArmor, take >= 35 shock damage, and are stunned >= 1.5s
      expect(nearby1.shieldArmor).toBe(0);
      expect(nearby1.shieldBrokenTimer).toBeGreaterThanOrEqual(5.0);
      expect(hp1Before - nearby1.hp).toBeGreaterThanOrEqual(35);
      expect(nearby1.stunTimer).toBeGreaterThanOrEqual(1.5);
      expect(nearby1.aiState).toBe('stunned');
      expect(nearby1.lastCombatText).toBe('EMP BLAST!');

      expect(nearby2.shieldArmor).toBe(0);
      expect(nearby2.shieldBrokenTimer).toBeGreaterThanOrEqual(5.0);
      expect(hp2Before - nearby2.hp).toBeGreaterThanOrEqual(35);
      expect(nearby2.stunTimer).toBeGreaterThanOrEqual(1.5);
      expect(nearby2.aiState).toBe('stunned');
      expect(nearby2.lastCombatText).toBe('EMP BLAST!');

      // Far enemy outside 110px is unaffected
      expect(farEnemy.shieldArmor).toBe(20);
      expect(farEnemy.hp).toBe(hpFarBefore);
      expect(farEnemy.aiState).not.toBe('stunned');
    });
  });
});
