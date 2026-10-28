import { describe, expect, it } from 'vitest';
import {
  ENEMIES,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  WorldSim,
  counterDeflectEnemySlidingIceBlock,
  shatterIceGolemArmor,
  spawnSnowSpiritIceBlockOnDeath,
  tryBabyYetiPushIceBlock,
} from '../src/index.js';

function createCleanBiome2Sim(seed = 5201): WorldSim {
  const sim = new WorldSim({
    seed,
    biome: 2,
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
  sim.player.x = 340;
  sim.player.y = 320;
  sim.player.vx = 0;
  sim.player.vy = 0;
  return sim;
}

describe('AP2-P3A.3: 4 Biome 2 Terrain-Interactive Enemy Behaviors', () => {
  describe('1. snow_spirit: Crystallizes into Intact sliding_ice_block on Death / Detonation', () => {
    it('crystallizes into an intact sliding_ice_block at (e.x, e.y) when killed by player or self-detonating, which the player can Dash-Kick', () => {
      const sim = createCleanBiome2Sim(5201);
      sim.player.x = 360;
      sim.player.y = 320;

      // 1) Killed via applyDamageToEnemy / handleEnemyKilled
      const spirit1 = sim.spawnEnemy('snow_spirit', 450, 320, true);
      sim.applyDamageToEnemy(spirit1, 500, false, 'none', 0, 0, true, sim.player.id);
      expect(spirit1.hp).toBe(0);

      const iceBlock1 = sim.props.find(
        (p) => p.kind === 'sliding_ice_block' && Math.hypot(p.x - 450, p.y - 320) < 4,
      );
      expect(iceBlock1).toBeDefined();
      expect(iceBlock1!.state).toBe('intact');
      expect(iceBlock1!.hp).toBe(120);
      expect(iceBlock1!.maxHp).toBe(120);
      expect(iceBlock1!.radius).toBe(22);

      // Player can Dash-Kick the crystallized sliding_ice_block
      const kicked = sim.kickProp(iceBlock1!, sim.player, 0);
      expect(kicked).toBe(true);
      expect(iceBlock1!.coverState).toBe('sliding');
      expect(Math.hypot(iceBlock1!.vx ?? 0, iceBlock1!.vy ?? 0)).toBeCloseTo(600, 1);

      // 2) Self-detonating via detonateSnowSpirit
      const spirit2 = sim.spawnEnemy('snow_spirit', 560, 260, true);
      sim.detonateSnowSpirit(spirit2);
      const iceBlock2 = sim.props.find(
        (p) => p.kind === 'sliding_ice_block' && Math.hypot(p.x - 560, p.y - 260) < 4,
      );
      expect(iceBlock2).toBeDefined();
      expect(iceBlock2!.state).toBe('intact');
      expect(iceBlock2!.hp).toBe(120);
      expect(iceBlock2!.radius).toBe(22);
      expect(typeof spawnSnowSpiritIceBlockOnDeath).toBe('function');
    });
  });

  describe('2. baby_yeti: Pushes sliding_ice_block at 460 px/s & Player Counter-Deflects at 600 px/s', () => {
    it('moves toward nearby intact sliding_ice_block (r <= 220px), pushes it at 460 px/s (enemyPushed = true), and player Dash-Kick reverses it at 600 px/s for >= 95 shatter damage', () => {
      const sim = createCleanBiome2Sim(5202);
      sim.player.x = 320;
      sim.player.y = 320;

      // Spawn intact sliding_ice_block at (500, 320) and baby_yeti at (545, 320) within 220px
      const iceBlock = sim.spawnProp('sliding_ice_block', 500, 320);
      iceBlock.state = 'intact';
      const yeti = sim.spawnEnemy('baby_yeti', 545, 320, true);
      yeti.hp = 220;
      yeti.maxHp = 220;
      yeti.aiState = 'move';
      yeti.attackCooldownTimer = 2.0;

      expect(typeof tryBabyYetiPushIceBlock).toBe('function');

      // Step simulation until baby_yeti reaches and pushes the ice block
      for (let i = 0; i < 20; i++) {
        sim.step(SIM_STEP_SEC);
        if (iceBlock.enemyPushed) break;
      }

      expect(iceBlock.state).toBe('sliding');
      expect(iceBlock.enemyPushed).toBe(true);
      expect(iceBlock.pushedByEnemyId).toBe(yeti.id);
      expect(Math.hypot(iceBlock.vx ?? 0, iceBlock.vy ?? 0)).toBeCloseTo(460, 1);
      expect(iceBlock.vx ?? 0).toBeLessThan(-400); // Moving left toward player at (320, 320)

      // Now player uses Dash-Kick against the incoming sliding ice block
      sim.player.x = iceBlock.x - 24;
      sim.player.y = iceBlock.y;
      sim.player.aimAngle = 0; // Aiming right back at baby_yeti
      sim.player.dashTimer = 0.16;
      sim.player.dashDirX = 1;
      sim.player.dashDirY = 0;

      const yetiHpBefore = yeti.hp;
      sim.resolvePropMovementCollision(sim.player);

      expect(iceBlock.enemyPushed).toBe(false);
      expect(iceBlock.kickedByPlayerId).toBe(sim.player.id);
      expect(Math.hypot(iceBlock.vx ?? 0, iceBlock.vy ?? 0)).toBeCloseTo(600, 1);
      expect(iceBlock.vx ?? 0).toBeGreaterThan(550); // Reversed right toward baby_yeti

      // Step until the counter-kicked ice block smashes into baby_yeti
      for (let i = 0; i < 15; i++) {
        sim.step(SIM_STEP_SEC);
        if (yeti.hp < yetiHpBefore) break;
      }

      expect(yetiHpBefore - yeti.hp).toBeGreaterThanOrEqual(95);
    });

    it('reverses enemy-pushed sliding_ice_block at 600 px/s when player performs a melee swing / Parry Deflect', () => {
      const sim = createCleanBiome2Sim(5203);
      sim.player.x = 340;
      sim.player.y = 320;
      sim.player.aimAngle = 0;

      const yeti = sim.spawnEnemy('baby_yeti', 520, 320, true);
      yeti.hp = 200;
      yeti.maxHp = 200;
      yeti.aiState = 'idle';
      yeti.stateTimer = 10;

      const iceBlock = sim.spawnProp('sliding_ice_block', 376, 320);
      iceBlock.state = 'sliding';
      iceBlock.coverState = 'sliding';
      iceBlock.blocksMovement = false;
      iceBlock.enemyPushed = true;
      iceBlock.pushedByEnemyId = yeti.id;
      iceBlock.vx = -460;
      iceBlock.vy = 0;

      expect(typeof counterDeflectEnemySlidingIceBlock).toBe('function');

      // Player swings melee (Combo Hit 3 / Parry Deflect)
      sim.player.meleeComboStep = 2;
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

      expect(iceBlock.enemyPushed).toBe(false);
      expect(iceBlock.kickedByPlayerId).toBe(sim.player.id);
      expect(Math.hypot(iceBlock.vx ?? 0, iceBlock.vy ?? 0)).toBeCloseTo(600, 1);
      expect(iceBlock.vx ?? 0).toBeGreaterThan(550);
    });
  });

  describe('3. ice_mage: Cryo Prism Pillar 3-Way Fan Refraction (-25°, 0°, +25°) & Flipped Glacial Barricade Block', () => {
    it('aims at intact cryo_prism_pillar within 320px and refracts its shot into 3 fan enemy projectiles (-25°, 0°, +25° toward player)', () => {
      const sim = createCleanBiome2Sim(5204);
      sim.player.x = 300;
      sim.player.y = 320;

      // Spawn cryo_prism_pillar at (480, 320) and ice_mage at (620, 320) (dist = 140 <= 320)
      const prism = sim.spawnProp('cryo_prism_pillar', 480, 320);
      const mage = sim.spawnEnemy('ice_mage', 620, 320, true);
      mage.aiState = 'telegraph';
      mage.stateTimer = 0.01;
      mage.telegraphDurationSec = 0.55;

      // Step until mage fires and projectile hits prism and refracts into 3 fan projectiles
      let refractedProjectiles = sim.projectiles.filter(
        (b) => b.team === 'enemy' && b.splitGeneration === 1,
      );
      for (let i = 0; i < 30; i++) {
        sim.step(SIM_STEP_SEC);
        refractedProjectiles = sim.projectiles.filter(
          (b) => b.team === 'enemy' && b.splitGeneration === 1,
        );
        if (refractedProjectiles.length === 3) break;
      }

      expect(refractedProjectiles.length).toBe(3);
      const angleToPlayer = Math.atan2(sim.player.y - prism.y, sim.player.x - prism.x);
      const deg25 = (25 * Math.PI) / 180;
      const expectedAngles = [angleToPlayer - deg25, angleToPlayer, angleToPlayer + deg25];
      const normDiff = (a: number, b: number) =>
        Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

      for (const expAng of expectedAngles) {
        expect(refractedProjectiles.some((p) => normDiff(p.angle, expAng) < 0.05)).toBe(true);
      }
    });

    it('blocks ice_mage prism refraction when player flips [E] a glacial_barricade in front of cryo_prism_pillar', () => {
      const sim = createCleanBiome2Sim(5205);
      sim.player.x = 300;
      sim.player.y = 320;

      const prism = sim.spawnProp('cryo_prism_pillar', 460, 320);
      const barricade = sim.spawnProp('glacial_barricade', 520, 320);
      const flipped = sim.flipCoverProp(barricade, sim.player);
      expect(flipped).toBe(true);
      expect(barricade.coverState).toBe('flipped');
      barricade.microBlankTimer = 0;

      const mage = sim.spawnEnemy('ice_mage', 620, 320, true);
      mage.aiState = 'telegraph';
      mage.stateTimer = 0.01;
      mage.telegraphDurationSec = 0.55;

      let everRefractedIntoThree = false;
      for (let i = 0; i < 30; i++) {
        sim.step(SIM_STEP_SEC);
        const refracted = sim.projectiles.filter(
          (b) => b.team === 'enemy' && (b.splitGeneration === 1 || b.hitEntityIds.includes(prism.id)),
        );
        if (refracted.length >= 3) {
          everRefractedIntoThree = true;
        }
      }

      expect(everRefractedIntoThree).toBe(false);
      expect(barricade.hp).toBeLessThan(65);
    });
  });

  describe('4. ice_golem: 75% Frontal Armor Reduction & Instant Armor Shatter on Ice Block Hit or Wall-Slam', () => {
    it('reduces frontal bullet damage by 75% (* 0.25) within |angleDiff| < 1.15 rad, and shatters armor (shieldBrokenTimer = 8.0, stunTimer >= 1.2, >= 70 Shatter damage) when hit by sliding_ice_block or Wall-Slam', () => {
      expect(ENEMIES.ice_golem.frontShieldReduction).toBeCloseTo(0.75, 2);
      expect(typeof shatterIceGolemArmor).toBe('function');

      const sim = createCleanBiome2Sim(5206);
      sim.player.x = 320;
      sim.player.y = 320;

      const golem = sim.spawnEnemy('ice_golem', 500, 320, true);
      golem.hp = 400;
      golem.maxHp = 400;
      golem.aimAngle = Math.PI; // Facing left toward player at (320, 320)

      // 1) Normal frontal bullet hit (hitAngleRad = 0 -> incoming from Math.PI, angleDiff = 0 < 1.15 rad)
      const hpBeforeShot = golem.hp;
      sim.applyDamageToEnemy(golem, 100, false, 'none', 0, 0, false, sim.player.id);
      const frontalDmg = hpBeforeShot - golem.hp;
      expect(frontalDmg).toBe(25); // 75% reduction (* 0.25)

      // 2) Hit by a player-kicked sliding_ice_block -> shatters frontal ice armor immediately
      const iceBlock = sim.spawnProp('sliding_ice_block', 440, 320);
      const hpBeforeIceBlock = golem.hp;
      sim.kickProp(iceBlock, sim.player, 0);

      for (let i = 0; i < 12; i++) {
        sim.step(SIM_STEP_SEC);
        if ((golem.shieldBrokenTimer ?? 0) > 0) break;
      }

      expect(golem.shieldBrokenTimer).toBeGreaterThanOrEqual(7.8);
      expect(golem.stunTimer).toBeGreaterThanOrEqual(1.1);
      expect(golem.aiState).toBe('stunned');
      expect(hpBeforeIceBlock - golem.hp).toBeGreaterThanOrEqual(70);

      // While shieldBrokenTimer > 0, frontal shot deals full 100% damage!
      golem.aiState = 'move';
      golem.frozenTimer = 0;
      const hpAfterBreak = golem.hp;
      sim.applyDamageToEnemy(golem, 100, false, 'none', 0, 0, false, sim.player.id);
      expect(hpAfterBreak - golem.hp).toBe(100);

      // 3) Wall-Slam on a fresh ice_golem also shatters frontal ice armor immediately
      sim.map.setTile(18, 10, 'wall');
      sim.map.rebuildSolidBoxes();
      const golem2 = sim.spawnEnemy('ice_golem', 18 * 32 - 21, 10 * 32 + 16, true);
      golem2.hp = 400;
      golem2.maxHp = 400;
      golem2.aimAngle = 0;
      golem2.attackCooldownTimer = 2.0;
      golem2.kbVx = 260;
      golem2.kbVy = 0;
      const hpBeforeSlam = golem2.hp;

      sim.step(SIM_STEP_SEC);

      expect(golem2.shieldBrokenTimer).toBeCloseTo(8.0, 1);
      expect(golem2.stunTimer).toBeGreaterThanOrEqual(1.2);
      expect(golem2.aiState).toBe('stunned');
      expect(hpBeforeSlam - golem2.hp).toBeGreaterThanOrEqual(70);
    });
  });
});
