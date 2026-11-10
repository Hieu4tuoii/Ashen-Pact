import { describe, expect, it } from 'vitest';
import {
  BOAR_CHARGE_SPEED,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  TILE_SIZE,
  WorldSim,
  computePredictiveLeadAimAngle,
  findGoblinShooterCoverPoint,
  getShamanTotemDamageMultiplier,
  kickSporeBomber,
  spawnShamanTotem,
} from '../src/index.js';

function createCleanBiome1Sim(seed = 4201): WorldSim {
  const sim = new WorldSim({
    seed,
    biome: 1,
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
  sim.player.x = 400;
  sim.player.y = 320;
  sim.player.vx = 0;
  sim.player.vy = 0;
  return sim;
}

describe('AP2-P3A.2: 4 Biome 1 Terrain-Interactive Enemy Behaviors', () => {
  describe('1. goblin_shooter: Cover Seeking + 2 Straight & 1 Predictive Lead Arrow Volley', () => {
    it('seeks cover behind moss_table (opposite side from player) or grass tile within 220px', () => {
      const sim = createCleanBiome1Sim(4201);
      sim.player.x = 380;
      sim.player.y = 320;

      // Spawn a moss_table at (520, 320) and goblin_shooter at (560, 380)
      const table = sim.spawnProp('moss_table', 520, 320);
      const shooter = sim.spawnEnemy('goblin_shooter', 560, 380, true);
      shooter.aiState = 'move';
      shooter.stateTimer = 2.0;
      shooter.attackCooldownTimer = 2.0;

      const coverPt = findGoblinShooterCoverPoint(sim, shooter, sim.player);
      expect(coverPt).not.toBeNull();
      // Opposite side of table (520, 320) from player (380, 320) is at x > 540, y ~ 320
      expect(coverPt!.x).toBeGreaterThan(table.x + 20);
      expect(Math.abs(coverPt!.y - table.y)).toBeLessThan(8);

      // Stepping should move goblin_shooter closer to cover point
      const distBefore = Math.hypot(shooter.x - coverPt!.x, shooter.y - coverPt!.y);
      sim.step(SIM_STEP_SEC);
      const distAfter = Math.hypot(shooter.x - coverPt!.x, shooter.y - coverPt!.y);
      expect(distAfter).toBeLessThan(distBefore);

      // Without moss_table, seeks grass tile within 220px
      sim.props.length = 0;
      const grassTx = 19;
      const grassTy = 10;
      sim.map.setSurface(grassTx, grassTy, 'grass', 0, true);
      const grassCover = findGoblinShooterCoverPoint(sim, shooter, sim.player);
      expect(grassCover).not.toBeNull();
      expect(grassCover!.x).toBeCloseTo(grassTx * TILE_SIZE + TILE_SIZE * 0.5, 1);
      expect(grassCover!.y).toBeCloseTo(grassTy * TILE_SIZE + TILE_SIZE * 0.5, 1);
    });

    it('fires 3 arrows during attack: 2 straight arrows (directAngle +/- 0.11) + 1 predictive lead arrow', () => {
      const sim = createCleanBiome1Sim(4202);
      sim.player.x = 380;
      sim.player.y = 320;
      sim.player.vx = 0;
      sim.player.vy = 200; // Moving downward so predictive lead angle differs from directAngle

      const shooter = sim.spawnEnemy('goblin_shooter', 600, 320, true);
      shooter.aiState = 'telegraph';
      shooter.stateTimer = 0.01; // About to transition to attack and fire
      shooter.telegraphDurationSec = 0.5;

      const directAngle = Math.atan2(sim.player.y - shooter.y, sim.player.x - shooter.x);
      const expectedLeadAngle = computePredictiveLeadAimAngle(shooter, sim.player, 285, 0.35);
      expect(Math.abs(expectedLeadAngle - directAngle)).toBeGreaterThan(0.05);

      sim.setPlayerInput({
        seq: 1,
        tick: sim.tick,
        moveX: 0,
        moveY: 1,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      sim.step(SIM_STEP_SEC);

      const enemyArrows = sim.projectiles.filter(
        (p) => p.team === 'enemy' && p.weaponId === 'goblin_bow',
      );
      expect(enemyArrows.length).toBe(3);

      const angles = enemyArrows.map((p) => Math.atan2(p.vy, p.vx));
      const normDiff = (a: number, b: number) =>
        Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
      const hasLeftStraight = angles.some((a) => normDiff(a, directAngle - 0.11) < 0.04);
      const hasRightStraight = angles.some((a) => normDiff(a, directAngle + 0.11) < 0.04);
      const hasPredictiveLead = angles.some((a) => normDiff(a, expectedLeadAngle) < 0.06);

      expect(hasLeftStraight).toBe(true);
      expect(hasRightStraight).toBe(true);
      expect(hasPredictiveLead).toBe(true);
    });
  });

  describe('2. wild_boar: 410 px/s Charge & Rotten Totem Pillar Self-Collapse Stun', () => {
    it('charges at 410 px/s and collapses rotten_totem_pillar onto itself for >= 48 true hazard damage and 1.5s stun', () => {
      expect(BOAR_CHARGE_SPEED).toBe(410);

      const sim = createCleanBiome1Sim(4203);
      sim.player.x = 340;
      sim.player.y = 320;

      // Place intact rotten_totem_pillar between charging wild_boar and player
      const pillar = sim.spawnProp('rotten_totem_pillar', 520, 320);
      const boar = sim.spawnEnemy('wild_boar', 555, 320, true);
      const hpBefore = boar.hp;

      boar.aiState = 'attack';
      boar.stateTimer = 0.55;
      boar.telegraphAngle = Math.PI; // Charging left toward (520, 320)

      for (let i = 0; i < 6; i++) {
        sim.step(SIM_STEP_SEC);
        if (pillar.coverState === 'fallen') break;
      }

      expect(pillar.coverState).toBe('fallen');
      expect(pillar.state).toBe('broken');
      expect(pillar.hp).toBe(0);
      expect(hpBefore - boar.hp).toBeGreaterThanOrEqual(48);
      expect(boar.stunTimer).toBeGreaterThanOrEqual(1.4);
      expect(boar.aiState).toBe('stunned');
    });
  });

  describe('3. spore_bomber: 0.65s Self-Destruct Telegraph & Dash-Kick / Melee Punt at 520 px/s', () => {
    it('enters 0.65s telegraph near player and can be Dash-Kicked at 520 px/s into enemy ranks to detonate (r=95px) without hurting player', () => {
      const sim = createCleanBiome1Sim(4204);
      sim.player.x = 420;
      sim.player.y = 320;
      const playerHpBefore = sim.player.hp;

      // Spawn spore_bomber within 68px of player
      const bomber = sim.spawnEnemy('spore_bomber', 475, 320, true);
      bomber.aiState = 'move';
      bomber.stateTimer = 1.0;

      // Step once so spore_bomber enters telegraph (0.65s)
      sim.step(SIM_STEP_SEC);
      expect(bomber.aiState).toBe('telegraph');
      expect(bomber.telegraphDurationSec).toBeCloseTo(0.65, 2);

      // Spawn target enemy downrange at (580, 320)
      const targetEnemy = sim.spawnEnemy('green_slime', 580, 320, true);
      targetEnemy.hp = 120;
      targetEnemy.maxHp = 120;
      targetEnemy.aiState = 'idle';
      targetEnemy.stateTimer = 10;
      const targetHpBefore = targetEnemy.hp;

      // Player Dash-Kicks into the telegraphing spore_bomber
      kickSporeBomber(sim, bomber, sim.player, 0);
      expect(bomber.kickedSporeBomber).toBe(true);
      expect(Math.hypot(bomber.kbVx, bomber.kbVy)).toBeCloseTo(520, 1);

      // Step until bomber impacts targetEnemy and detonates
      for (let i = 0; i < 20; i++) {
        sim.step(SIM_STEP_SEC);
        if (bomber.hp <= 0) break;
      }

      expect(bomber.hp).toBe(0);
      expect(targetEnemy.hp).toBeLessThan(targetHpBefore - 40);
      expect(targetEnemy.poisonTimer).toBeGreaterThan(0);
      expect(sim.player.hp).toBe(playerHpBefore);
    });

    it('punts telegraphing spore_bomber backward when hit by player melee swing', () => {
      const sim = createCleanBiome1Sim(4205);
      sim.player.x = 420;
      sim.player.y = 320;
      sim.player.aimAngle = 0;

      const bomber = sim.spawnEnemy('spore_bomber', 458, 320, true);
      bomber.aiState = 'telegraph';
      bomber.stateTimer = 0.65;
      bomber.telegraphDurationSec = 0.65;

      // Player performs melee attack toward bomber (+X)
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

      expect(bomber.kickedSporeBomber).toBe(true);
      expect(Math.hypot(bomber.kbVx, bomber.kbVy)).toBeCloseTo(520, 1);
      expect(bomber.hp).toBeGreaterThan(0); // Survives initial melee strike to fly backward and detonate
    });
  });

  describe('4. goblin_shaman: Ward Totem (shaman_totem) 40% Damage Reduction & 1.2s Stun Backlash', () => {
    it('plants shaman_totem linking to allies within 220px for 40% damage reduction, and stuns linked enemies for 1.2s on totem destruction', () => {
      const sim = createCleanBiome1Sim(4206);
      sim.player.x = 340;
      sim.player.y = 320;

      const shaman = sim.spawnEnemy('goblin_shaman', 560, 320, true);
      const ally = sim.spawnEnemy('green_slime', 620, 340, true);
      ally.hp = 200;
      ally.maxHp = 200;

      // Plant shaman_totem via helper
      const totem = spawnShamanTotem(sim, shaman);
      expect(totem).not.toBeNull();
      expect(totem!.kind).toBe('shaman_totem');
      expect(totem!.hp).toBe(65);
      expect(totem!.radius).toBe(18);

      // Verify 40% damage reduction (multiplier = 0.60) on linked non-boss ally within 220px
      expect(getShamanTotemDamageMultiplier(sim, ally)).toBeCloseTo(0.6, 2);

      const hpBefore = ally.hp;
      sim.applyDamageToEnemy(ally, 100, false, 'none', 0, 0, true, sim.player.id);
      const dmgTakenWithTotem = hpBefore - ally.hp;
      // 100 * 0.6 = 60
      expect(dmgTakenWithTotem).toBe(60);

      // Dash-Kick a flipped moss_table barricade into the shaman_totem
      const table = sim.spawnProp('moss_table', totem!.x - 42, totem!.y);
      table.coverState = 'flipped';
      sim.player.x = table.x - 28;
      sim.player.y = table.y;
      sim.player.aimAngle = 0;
      sim.player.dashTimer = 0.14;
      sim.player.dashDirX = 1;
      sim.player.dashDirY = 0;
      sim.resolvePropMovementCollision(sim.player);

      for (let i = 0; i < 10; i++) {
        sim.step(SIM_STEP_SEC);
        if (totem!.hp <= 0) break;
      }

      expect(totem!.hp).toBe(0);
      expect(totem!.state).toBe('broken');
      expect(ally.stunTimer).toBeGreaterThanOrEqual(1.0);
      expect(ally.aiState).toBe('stunned');
      expect(shaman.stunTimer).toBeGreaterThanOrEqual(1.0);
      expect(shaman.aiState).toBe('stunned');
    });
  });
});
