import { describe, expect, it } from 'vitest';
import {
  INPUT_BUTTON,
  MAX_BOUNCE_COUNT,
  SHOT_FLAG,
  SIM_STEP_SEC,
  TILE_SIZE,
  WorldSim,
  equipPlayerWeaponSlot,
  scaleBlessingDamage,
} from '../src/index.js';

function createCleanArenaSim(seed = 20261029): WorldSim {
  const sim = new WorldSim({
    seed,
    startInHub: false,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
    autoRespawnWaves: false,
  });
  for (let ty = 2; ty < sim.map.rows - 2; ty++) {
    for (let tx = 2; tx < sim.map.cols - 2; tx++) {
      sim.map.setTile(tx, ty, 'floor');
      sim.map.setSurface(tx, ty, 'none', 0, true);
    }
  }
  sim.map.rebuildSolidBoxes();
  sim.props.length = 0;
  sim.enemies.length = 0;
  sim.projectiles.length = 0;
  sim.pickups.length = 0;
  sim.skillZones.length = 0;
  sim.summons.length = 0;
  sim.player.x = 10 * TILE_SIZE + 16;
  sim.player.y = 11 * TILE_SIZE + 16;
  sim.player.aimAngle = 0;
  sim.consumeEvents();
  return sim;
}

describe('AP2 Phase P1D.3 — Group 4 (Geometry & Co-op Bullet Mods) & 10 Character Skill Upgrades', () => {
  it('implements bullet_split_bounce: grants +1 wall bounce (capped at MAX_BOUNCE_COUNT=4), splits gen-0 bullet on first wall/barricade hit into 2 child bullets (gen=1, 70% DMG, ±18° V-angle, DYNAMIC_BOUNCE, replacedProjectileId), and enforces One-Split Rule', () => {
    const sim = createCleanArenaSim(7601);
    const p1 = sim.player;
    p1.blessingIds.push('bullet_split_bounce');
    equipPlayerWeaponSlot(p1, 0, 'rivet_gun'); // base bounceCount = 0

    // Place a vertical wall at tx = 13 (x = 416..448) and another wall behind at tx = 8 (x = 256..288)
    sim.map.setTile(13, 11, 'wall');
    sim.map.setTile(8, 10, 'wall');
    sim.map.setTile(8, 11, 'wall');
    sim.map.setTile(8, 12, 'wall');
    sim.map.rebuildSolidBoxes();

    p1.x = 340;
    p1.y = 11 * TILE_SIZE + 16; // 368
    p1.aimAngle = 0;
    p1.critChance = 0;

    // 1. Fire weapon -> projectile gets +1 bounceRemaining and SHOT_FLAG.DYNAMIC_BOUNCE
    sim.tryFireActiveWeapon(p1);
    expect(sim.projectiles).toHaveLength(1);
    const rootBullet = sim.projectiles[0]!;
    const rootId = rootBullet.id;
    const rootDmg = rootBullet.damage;
    expect(rootBullet.bounceRemaining).toBe(1);
    expect(rootBullet.splitGeneration).toBe(0);
    expect((rootBullet.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).not.toBe(0);

    // Give root bullet 2 bounces so children still have 1 bounce left to test One-Split Rule on second wall
    rootBullet.bounceRemaining = 2;

    // 2. Step until rootBullet hits the wall at tx = 13 -> splits into 2 child bullets
    sim.consumeEvents();
    let splitVolleyEv:
      | { pelletCount: number; replacedProjectileId?: number; shotFlags?: number }
      | undefined;
    for (let t = 0; t < 15; t++) {
      sim.step(SIM_STEP_SEC);
      const evs = sim.consumeEvents();
      const found = evs.find(
        (ev) => ev.kind === 'bullet_volley_spawned' && ev.replacedProjectileId === rootId,
      );
      if (found && found.kind === 'bullet_volley_spawned') {
        splitVolleyEv = found;
        break;
      }
    }

    expect(splitVolleyEv).toBeDefined();
    expect(splitVolleyEv!.pelletCount).toBe(2);
    expect((splitVolleyEv!.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).not.toBe(0);

    const children = sim.projectiles.filter((b) => b.team === 'player');
    expect(children).toHaveLength(2);
    const expectedChildDmg = Math.max(1, Math.round(rootDmg * 0.7));
    for (const c of children) {
      expect(c.splitGeneration).toBe(1);
      expect(c.damage).toBe(expectedChildDmg);
      expect(c.bounceRemaining).toBe(1);
      expect((c.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).not.toBe(0);
    }
    // Verify V-angle separation of ~36 degrees (2 * 18 deg = 0.6283 rad)
    const angleSep = Math.abs(children[0]!.angle - children[1]!.angle);
    expect(angleSep).toBeCloseTo((36 * Math.PI) / 180, 2);

    // 3. One-Split Rule: When a splitGeneration === 1 child bullet hits the wall at tx = 8, it MUST NOT split again!
    for (let t = 0; t < 20; t++) {
      sim.step(SIM_STEP_SEC);
    }
    const afterSecondBounce = sim.projectiles.filter((b) => b.team === 'player');
    expect(afterSecondBounce.length).toBeLessThanOrEqual(2);
    for (const b of afterSecondBounce) {
      expect(b.splitGeneration).toBe(1);
    }

    // 4. Verify bounce cap at MAX_BOUNCE_COUNT = 4
    sim.projectiles.length = 0;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: p1.id,
      team: 'player',
      weaponId: 'tesla_carbine',
      x: p1.x,
      y: p1.y,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 500,
      damage: 20,
      radius: 5,
      knockback: 40,
      pierceCount: 0,
      bounceCount: 4,
      ttlSec: 1.2,
      element: 'shock',
      critChance: 0,
      amplifiedByShield: false,
      seed: 123,
    });
    expect(sim.projectiles[0]!.bounceRemaining).toBe(MAX_BOUNCE_COUNT);
  });

  it('implements bullet_ricochet_boom: triggers Seismic Fire Blast on wall/barricade bounce (base 24 DMG * procCoeff, r=64px, KB=200, ICD=0.20s, burn) knocking nearby enemies into Wall-Slam', () => {
    const sim = createCleanArenaSim(7602);
    sim.currentFloor = 2; // M_floor(2) = 1.22
    const p1 = sim.player;
    p1.blessingIds.push('bullet_ricochet_boom');

    // Place wall at tx = 14 (x = 448..480) and another wall at ty = 9 (y = 288..320) above enemy for Wall-Slam
    sim.map.setTile(14, 11, 'wall');
    sim.map.setTile(13, 9, 'wall');
    sim.map.rebuildSolidBoxes();

    const nearWallEnemy = sim.spawnEnemy('goblin_shooter', 13 * TILE_SIZE + 16, 10 * TILE_SIZE + 14, true);
    nearWallEnemy.hp = 600;
    nearWallEnemy.maxHp = 600;

    // Spawn a bouncing player projectile with procCoefficient = 0.75 heading into wall at tx = 14
    const bullet = sim.acquireProjectile({
      id: 8801,
      ownerId: p1.id,
      team: 'player',
      weaponId: 'rivet_gun',
      x: 14 * TILE_SIZE - 12,
      y: 11 * TILE_SIZE + 8,
      vx: 500,
      vy: 0,
      angle: 0,
      radius: 5,
      damage: 14,
      isCrit: false,
      knockback: 50,
      pierceRemaining: 0,
      bounceRemaining: 2,
      ttlSec: 1.2,
      element: 'none',
      amplifiedByShield: false,
    });
    bullet.procCoefficient = 0.75;
    sim.projectiles.push(bullet);

    sim.consumeEvents();
    sim.step(SIM_STEP_SEC);

    const evs = sim.consumeEvents();
    const boomEv = evs.find(
      (ev) => ev.kind === 'explosion' && ev.sourceDefId === 'bullet_ricochet_boom',
    );
    expect(boomEv).toBeDefined();
    const expectedBoomDmg = Math.max(1, Math.round(scaleBlessingDamage(24, 2) * 0.75));
    if (boomEv && boomEv.kind === 'explosion') {
      expect(boomEv.radius).toBe(64);
      expect(boomEv.damage).toBe(expectedBoomDmg);
    }
    expect(p1.ricochetBoomIcdTimer).toBeCloseTo(0.2, 1);
    expect(nearWallEnemy.burnTimer).toBeGreaterThan(0);
    expect(nearWallEnemy.hp).toBeLessThanOrEqual(600 - expectedBoomDmg);

    // Step a few ticks so the KB=200 blast slams nearWallEnemy into the wall at ty=9
    let slammed = evs.some((ev) => ev.kind === 'wall_slam' && ev.enemyId === nearWallEnemy.id);
    for (let t = 0; t < 8 && !slammed; t++) {
      sim.step(SIM_STEP_SEC);
      if (
        sim
          .consumeEvents()
          .some((ev) => ev.kind === 'wall_slam' && ev.enemyId === nearWallEnemy.id)
      ) {
        slammed = true;
      }
    }
    expect(slammed).toBe(true);

    // Verify 0.20s ICD prevents a second ricochet boom immediately on the next tick
    const bullet2 = sim.acquireProjectile({
      id: 8802,
      ownerId: p1.id,
      team: 'player',
      weaponId: 'rivet_gun',
      x: 14 * TILE_SIZE - 10,
      y: 11 * TILE_SIZE + 8,
      vx: 500,
      vy: 0,
      angle: 0,
      radius: 5,
      damage: 14,
      isCrit: false,
      knockback: 50,
      pierceRemaining: 0,
      bounceRemaining: 1,
      ttlSec: 1.2,
      element: 'none',
      amplifiedByShield: false,
    });
    sim.projectiles.push(bullet2);
    sim.consumeEvents();
    sim.step(SIM_STEP_SEC);
    expect(
      sim
        .consumeEvents()
        .some((ev) => ev.kind === 'explosion' && ev.sourceDefId === 'bullet_ricochet_boom'),
    ).toBe(false);
  });

  it('implements bullet_heavy_pinball: grants +50% Knockback, rebounds Wall-Slammed enemies (kbVx=-preSlamVx*0.85, pinballReboundTimer=0.45), stuns colliding enemies for 0.8s + base 18 billiard DMG, and decays tidalRamTimer & pinballReboundTimer each tick', () => {
    const sim = createCleanArenaSim(7603);
    sim.currentFloor = 2;
    const p1 = sim.player;
    p1.blessingIds.push('bullet_heavy_pinball');

    // Place wall at tx = 14 (x = 448..480)
    sim.map.setTile(14, 11, 'wall');
    sim.map.rebuildSolidBoxes();

    // 1. Check +50% Knockback on enemy hit
    const kbTestEnemy = sim.spawnEnemy('goblin_shooter', 300, 250, true);
    kbTestEnemy.hp = 500;
    kbTestEnemy.maxHp = 500;
    sim.applyDamageToEnemy(kbTestEnemy, 10, false, 'none', 0, 100, false, p1.id);
    expect(kbTestEnemy.kbVx).toBeCloseTo(150, 1); // 100 * 1.50 = 150
    sim.enemies.length = 0;

    // 2. Enemy A gets knocked into wall at tx = 14 -> rebounds backward (-X) and collides with Enemy B
    const enemyA = sim.spawnEnemy('goblin_shooter', 14 * TILE_SIZE - 16, 11 * TILE_SIZE + 16, true);
    enemyA.hp = 600;
    enemyA.maxHp = 600;
    enemyA.lastHitPlayerId = p1.id;
    enemyA.tidalRamTimer = 0.5;
    enemyA.kbVx = 280;
    enemyA.kbVy = 0;

    const enemyB = sim.spawnEnemy('goblin_shooter', 14 * TILE_SIZE - 52, 11 * TILE_SIZE + 16, true);
    enemyB.hp = 600;
    enemyB.maxHp = 600;

    sim.consumeEvents();
    sim.step(SIM_STEP_SEC);

    // Enemy A should have rebounded off the wall with negative kbVx and pinballReboundTimer > 0
    expect(enemyA.kbVx).toBeLessThan(-150);
    expect(enemyA.tidalRamTimer).toBeLessThan(0.5);

    // Step a few ticks so rebounding Enemy A collides with Enemy B
    const hpBBefore = enemyB.hp;
    for (let t = 0; t < 10; t++) {
      sim.step(SIM_STEP_SEC);
    }

    const expectedPinballDmg = scaleBlessingDamage(18, 2);
    expect(enemyB.hp).toBeLessThanOrEqual(hpBBefore - expectedPinballDmg);
    expect(enemyA.stunTimer).toBeGreaterThanOrEqual(0.6);
    expect(enemyB.stunTimer).toBeGreaterThanOrEqual(0.6);
    expect(enemyA.aiState).toBe('stunned');
    expect(enemyB.aiState).toBe('stunned');
  });

  it('implements bullet_coop_arc_relay: shots or melee swings passing within 56px of an Ally, Summon, or Flipped Barricade zap nearest enemy within 180px (base 20 Shock DMG * procCoeff, ICD=0.30s, chain_lightning)', () => {
    const sim = createCleanArenaSim(7604);
    sim.currentFloor = 3;
    const p1 = sim.player;
    p1.blessingIds.push('bullet_coop_arc_relay');
    const p2 = sim.addCoopPlayer(2, 'ranger', 'P2', 2);

    p1.x = 300;
    p1.y = 352;
    p2.x = 380;
    p2.y = 372; // Within 56px of bullet trajectory along y = 352

    const target = sim.spawnEnemy('goblin_shooter', 490, 372, true); // 110px from P2 (<= 180px)
    target.hp = 600;
    target.maxHp = 600;

    // 1. Fire bullet from P1 past P2 (bullet misses target directly along y=330, but passes within 56px of P2 at y=372)
    const bullet = sim.acquireProjectile({
      id: 8901,
      ownerId: p1.id,
      team: 'player',
      weaponId: 'rivet_gun',
      x: 375,
      y: 332,
      vx: 500,
      vy: 0,
      angle: 0,
      radius: 5,
      damage: 12,
      isCrit: false,
      knockback: 40,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 0.5,
      element: 'none',
      amplifiedByShield: false,
    });
    bullet.procCoefficient = 0.8;
    sim.projectiles.push(bullet);

    sim.consumeEvents();
    sim.step(SIM_STEP_SEC);

    const evs = sim.consumeEvents();
    const arcEv = evs.find(
      (ev) => ev.kind === 'chain_lightning' && ev.fromX === p2.x && ev.fromY === p2.y,
    );
    expect(arcEv).toBeDefined();
    const expectedArcDmg = Math.max(1, Math.round(scaleBlessingDamage(20, 3) * 0.8));
    expect(target.hp).toBe(600 - expectedArcDmg);
    expect(target.shockTimer).toBeGreaterThan(0);
    expect(p1.coopArcRelayIcdTimer).toBeCloseTo(0.3, 1);

    // 2. Also verify relay through a Flipped Barricade on melee swing after ICD expires
    p1.coopArcRelayIcdTimer = 0;
    sim.projectiles.length = 0;
    p2.x = 100;
    p2.y = 100; // Move P2 far away
    const table = sim.spawnProp('moss_table', 345, 352);
    sim.flipCoverProp(table, p1);
    target.x = 460;
    target.y = 352;
    const hpBeforeMeleeRelay = target.hp;

    equipPlayerWeaponSlot(p1, 0, 'knight_sword');
    p1.fireCooldownTimer = 0;
    sim.consumeEvents();
    sim.tryFireActiveWeapon(p1);

    const meleeEvs = sim.consumeEvents();
    expect(
      meleeEvs.some(
        (ev) => ev.kind === 'chain_lightning' && ev.fromX === table.x && ev.fromY === table.y,
      ),
    ).toBe(true);
    expect(target.hp).toBe(hpBeforeMeleeRelay - scaleBlessingDamage(20, 3));
  });

  it('implements Vanguard Skill Upgrades: vanguard_bastion_prism (reflects enemy bullets as base 20 Fire DMG player bolts + splits gen-0 ally bullets into 2 rays with One-Split Rule) & vanguard_charge (130px shield rush triggering Wall-Slam)', () => {
    const sim = createCleanArenaSim(7605);
    sim.currentFloor = 2;
    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'vanguard');
    p1.blessingIds.push('vanguard_bastion_prism', 'vanguard_charge');
    const p2 = sim.addCoopPlayer(2, 'ranger', 'P2', 2);

    p1.x = 360;
    p1.y = 368;
    p1.aimAngle = 0;
    p1.skillActiveTimer = 3.5;

    const shooter = sim.spawnEnemy('goblin_shooter', 480, 368, true);
    shooter.hp = 600;
    shooter.maxHp = 600;

    // 1. Enemy bullet hits Vanguard shield -> reflected as player Fire bolt (scaleBlessingDamage(20, 2))
    const enemyBullet = sim.acquireProjectile({
      id: 9001,
      ownerId: shooter.id,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: p1.x + 24,
      y: p1.y,
      vx: -240,
      vy: 0,
      angle: Math.PI,
      radius: 5,
      damage: 2,
      isCrit: false,
      knockback: 10,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 1.5,
      element: 'none',
      amplifiedByShield: false,
    });
    sim.projectiles.push(enemyBullet);

    sim.step(SIM_STEP_SEC);
    const reflectedBolt = sim.projectiles.find(
      (b) => b.team === 'player' && b.weaponId === 'vanguard_bastion_prism',
    );
    expect(reflectedBolt).toBeDefined();
    expect(reflectedBolt!.element).toBe('burn');
    expect(reflectedBolt!.damage).toBe(scaleBlessingDamage(20, 2));
    expect(reflectedBolt!.vx).toBeGreaterThan(0);

    // 2. Ally gen-0 bullet fired through Vanguard's active Bastion Prism shield splits into 2 rays (gen=1, +30% DMG, DYNAMIC_BOUNCE)
    sim.projectiles.length = 0;
    p2.x = 320;
    p2.y = 368;
    const allyBullet = sim.acquireProjectile({
      id: 9002,
      ownerId: p2.id,
      team: 'player',
      weaponId: 'rivet_gun',
      x: p1.x - 10,
      y: p1.y,
      vx: 500,
      vy: 0,
      angle: 0,
      radius: 5,
      damage: 20,
      isCrit: false,
      knockback: 40,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 1.2,
      element: 'none',
      amplifiedByShield: false,
      splitGeneration: 0,
    });
    sim.projectiles.push(allyBullet);
    sim.step(SIM_STEP_SEC);

    const splitRays = sim.projectiles.filter((b) => b.team === 'player' && b.ownerId === p2.id);
    expect(splitRays).toHaveLength(2);
    for (const r of splitRays) {
      expect(r.splitGeneration).toBe(1);
      expect(r.damage).toBe(Math.round(20 * 1.3));
      expect((r.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).not.toBe(0);
    }

    // One-Split Rule check: gen-1 bullet passing through shield does NOT split again
    sim.projectiles.length = 0;
    const gen1Bullet = sim.acquireProjectile({
      id: 9003,
      ownerId: p2.id,
      team: 'player',
      weaponId: 'rivet_gun',
      x: p1.x - 10,
      y: p1.y,
      vx: 500,
      vy: 0,
      angle: 0,
      radius: 5,
      damage: 20,
      isCrit: false,
      knockback: 40,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 1.2,
      element: 'none',
      amplifiedByShield: false,
      splitGeneration: 1,
    });
    sim.projectiles.push(gen1Bullet);
    sim.step(SIM_STEP_SEC);
    expect(sim.projectiles.filter((b) => b.ownerId === p2.id)).toHaveLength(1);

    // 3. vanguard_charge: Reactivating SKILL rushes 130px forward and slams enemies along the path into walls (Wall-Slam)
    sim.projectiles.length = 0;
    sim.map.setTile(17, 11, 'wall'); // Wall at x = 544
    sim.map.rebuildSolidBoxes();
    shooter.x = 460;
    shooter.y = 368;
    const startX = p1.x; // 360

    sim.consumeEvents();
    sim.activateCharacterSkill(p1);
    expect(p1.x).toBeCloseTo(startX + 130, 0);

    let slammed = sim
      .consumeEvents()
      .some((ev) => ev.kind === 'wall_slam' && ev.enemyId === shooter.id);
    for (let t = 0; t < 8 && !slammed; t++) {
      sim.step(SIM_STEP_SEC);
      if (
        sim
          .consumeEvents()
          .some((ev) => ev.kind === 'wall_slam' && ev.enemyId === shooter.id)
      ) {
        slammed = true;
      }
    }
    expect(slammed).toBe(true);
    expect(shooter.burnTimer).toBeGreaterThan(0);
  });

  it('implements Ranger Skill Upgrades: ranger_arrow_volley (wall-impact micro-explosion r=72px dealing base 18 DMG + marking nearby enemies for 6s) & ranger_prey_chain (shares 35% damage & pulls linked marked enemies within 220px by 65% Knockback)', () => {
    const sim = createCleanArenaSim(7606);
    sim.currentFloor = 2;
    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'ranger');
    p1.blessingIds.push('ranger_arrow_volley', 'ranger_prey_chain');

    // Place wall at tx = 14 (x = 448..480)
    sim.map.setTile(14, 11, 'wall');
    sim.map.rebuildSolidBoxes();

    p1.x = 320;
    p1.y = 368;
    p1.aimAngle = 0;

    // Place enemy near wall at (430, 415) — outside arrow direct line y=368, but within r=72px of wall impact at (448, 368)!
    const wallSideEnemy = sim.spawnEnemy('goblin_shooter', 430, 415, true);
    wallSideEnemy.hp = 600;
    wallSideEnemy.maxHp = 600;

    // Spawn a single predator_arrow heading straight into the wall at (448, 368)
    const arrow = sim.acquireProjectile({
      id: 9101,
      ownerId: p1.id,
      team: 'player',
      weaponId: 'predator_arrow',
      x: 438,
      y: 368,
      vx: 680,
      vy: 0,
      angle: 0,
      radius: 6.5,
      damage: 22,
      isCrit: true,
      knockback: 180,
      pierceRemaining: 5,
      bounceRemaining: 0,
      ttlSec: 1.5,
      element: 'none',
      amplifiedByShield: true,
    });
    sim.projectiles.push(arrow);

    sim.consumeEvents();
    sim.step(SIM_STEP_SEC);

    const evs = sim.consumeEvents();
    const arrowBoom = evs.find(
      (ev) => ev.kind === 'explosion' && ev.sourceDefId === 'ranger_arrow_volley',
    );
    expect(arrowBoom).toBeDefined();
    expect(wallSideEnemy.markedTimer).toBeCloseTo(6.0, 1);
    expect(wallSideEnemy.hp).toBeLessThan(600);

    // 2. Test ranger_prey_chain: 35% shared damage + 65% Knockback pull across marked enemies within 220px
    const markedA = sim.spawnEnemy('goblin_shooter', 320, 220, true);
    markedA.hp = 500;
    markedA.maxHp = 500;
    markedA.markedTimer = 6.0;
    markedA.markedByPlayerId = p1.id;

    const markedB = sim.spawnEnemy('goblin_shooter', 460, 220, true); // 140px away (<= 220px)
    markedB.hp = 500;
    markedB.maxHp = 500;
    markedB.markedTimer = 6.0;
    markedB.markedByPlayerId = p1.id;

    // Position P1 right on MarkedA so distance bonus is ~0
    p1.x = 320;
    p1.y = 220;
    const hpABefore = markedA.hp;
    const hpBBefore = markedB.hp;

    sim.applyDamageToEnemy(markedA, 40, false, 'none', 0, 200, false, p1.id);
    const dmgDealtToA = hpABefore - markedA.hp;
    const expectedChainRaw = Math.max(1, Math.round(dmgDealtToA * 0.35));
    // MarkedB also has markedTimer > 0 (1.25x vulnerability), so it takes at least expectedChainRaw
    expect(hpBBefore - markedB.hp).toBeGreaterThanOrEqual(expectedChainRaw);
    expect(markedB.kbVx).toBeCloseTo(markedA.kbVx * 0.65, 1);
  });

  it('implements Elementalist Skill Upgrades: elementalist_vortex (pulls both enemies and circular rolling props within 150px) & elementalist_twin_orbit (spawns 2 Elemental Zones 160px apart linked by Reaction Cutting Beam dealing base 24 DMG/s)', () => {
    const sim = createCleanArenaSim(7607);
    sim.currentFloor = 2;
    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'elementalist');
    p1.blessingIds.push('elementalist_vortex', 'elementalist_twin_orbit');

    p1.x = 300;
    p1.y = 352;
    p1.aimAngle = 0;

    // Activate Elemental Orb -> spawns 2 zones 160px apart (orbEl='burn', nextEl='chill')
    sim.activateCharacterSkill(p1);
    expect(sim.skillZones).toHaveLength(2);
    const z1 = sim.skillZones[0]!;
    const z2 = sim.skillZones[1]!;
    expect(z1.element).toBe('burn');
    expect(z2.element).toBe('chill');
    expect(Math.hypot(z2.x - z1.x, z2.y - z1.y)).toBeCloseTo(160, 0);

    // Place a rolling prop (explosive_barrel) within 150px of z1 and an enemy on the cutting beam midpoint between z1 and z2
    const barrel = sim.spawnProp('explosive_barrel', z1.x + 125, z1.y);
    const initialBarrelDist = Math.hypot(barrel.x - z1.x, barrel.y - z1.y);

    const midX = (z1.x + z2.x) * 0.5;
    const midY = (z1.y + z2.y) * 0.5;
    const beamEnemy = sim.spawnEnemy('goblin_shooter', midX, midY, true);
    beamEnemy.hp = 600;
    beamEnemy.maxHp = 600;

    // Step 32 ticks (~0.53s) so vortex pulls barrel and the 0.5s Reaction Cutting Beam ticks!
    for (let t = 0; t < 32; t++) {
      sim.step(SIM_STEP_SEC);
    }

    const afterBarrelDist = Math.hypot(barrel.x - z1.x, barrel.y - z1.y);
    expect(afterBarrelDist).toBeLessThan(initialBarrelDist - 10);

    const expectedBeamTickDmg = scaleBlessingDamage(12, 2); // 12 DMG per 0.5s = 24 DMG/s
    expect(beamEnemy.hp).toBeLessThanOrEqual(600 - expectedBeamTickDmg);
  });

  it('implements Druid Skill Upgrades: druid_poison_roots (every 1.8s lashes Poison roots yanking enemies in auraRadius into nearest wall for Wall-Slam) & druid_sacred_grove (2 trees + allied bullets passing through canopy gain +1 Smart Bounce)', () => {
    const sim = createCleanArenaSim(7608);
    sim.currentFloor = 2;
    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'druid');
    p1.blessingIds.push('druid_poison_roots', 'druid_sacred_grove');

    // Place a wall at tx = 14, ty = 9 (x = 464, y = 304)
    sim.map.setTile(14, 9, 'wall');
    sim.map.rebuildSolidBoxes();

    p1.x = 340;
    p1.y = 352;
    p1.aimAngle = 0;

    // Plant Sacred Grove (2 trees)
    sim.activateCharacterSkill(p1);
    const trees = sim.summons.filter((s) => s.kind === 'sacred_tree');
    expect(trees).toHaveLength(2);
    const tree = trees[0]!;

    // 1. Allied bullet passing through Sacred Tree canopy gains +1 Smart Bounce (bounceRemaining + 1, passedThroughCoverOrPrism = true, DYNAMIC_BOUNCE)
    const bullet = sim.acquireProjectile({
      id: 9201,
      ownerId: p1.id,
      team: 'player',
      weaponId: 'rivet_gun',
      x: tree.x - 20,
      y: tree.y,
      vx: 500,
      vy: 0,
      angle: 0,
      radius: 5,
      damage: 15,
      isCrit: false,
      knockback: 40,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 1.0,
      element: 'none',
      amplifiedByShield: false,
    });
    sim.projectiles.push(bullet);
    sim.step(SIM_STEP_SEC);
    expect(bullet.bounceRemaining).toBe(1);
    expect(bullet.passedThroughCoverOrPrism).toBe(true);
    expect((bullet.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).not.toBe(0);

    // 2. Place an enemy inside tree's auraRadius near the wall at (14, 9) and advance tree tickTimer (1.8s)
    sim.projectiles.length = 0;
    const rootVictim = sim.spawnEnemy('goblin_shooter', tree.x + 30, 10 * TILE_SIZE + 16, true);
    rootVictim.hp = 600;
    rootVictim.maxHp = 600;
    tree.tickTimer = 0.01;

    sim.consumeEvents();
    sim.step(SIM_STEP_SEC);

    const evs = sim.consumeEvents();
    expect(evs.some((ev) => ev.kind === 'wall_slam' && ev.enemyId === rootVictim.id)).toBe(true);
    expect(rootVictim.poisonTimer).toBeGreaterThan(0);
    expect(rootVictim.hp).toBeLessThan(600 - scaleBlessingDamage(14, 2));
  });

  it('implements Engineer Skill Upgrades: engineer_twin_turrets (Lightning Laser Fence between 2 turrets dealing base 10 Shock DMG & 50% slow) & engineer_self_destruct (reactivating SKILL or expiry charges enemy cluster & explodes for base 45 Fire+Shock DMG, r=130px)', () => {
    const sim = createCleanArenaSim(7609);
    sim.currentFloor = 2;
    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'engineer');
    p1.blessingIds.push('engineer_twin_turrets', 'engineer_self_destruct');

    p1.x = 340;
    p1.y = 352;
    p1.aimAngle = 0;

    // 1. Deploy 2 Tesla Turrets
    sim.activateCharacterSkill(p1);
    const turrets = sim.summons.filter((s) => s.kind === 'tesla_turret');
    expect(turrets).toHaveLength(2);
    const t1 = turrets[0]!;
    const t2 = turrets[1]!;

    // Place an enemy on the laser fence segment between t1 and t2
    const fenceX = (t1.x + t2.x) * 0.5;
    const fenceY = (t1.y + t2.y) * 0.5;
    const fenceEnemy = sim.spawnEnemy('goblin_shooter', fenceX, fenceY, true);
    fenceEnemy.hp = 600;
    fenceEnemy.maxHp = 600;

    sim.consumeEvents();
    for (let t = 0; t < 26; t++) {
      sim.step(SIM_STEP_SEC);
    }

    expect(fenceEnemy.chillTimer).toBeGreaterThanOrEqual(1.0);
    expect(fenceEnemy.hp).toBeLessThanOrEqual(600 - scaleBlessingDamage(10, 2));

    // 2. Place a cluster of enemies 140px away and reactivate SKILL while turrets are active -> kamikaze charge & r=130px blast (base 45 Fire + Shock DMG)
    const clusterEnemy1 = sim.spawnEnemy('goblin_shooter', t1.x + 135, t1.y, true);
    clusterEnemy1.hp = 800;
    clusterEnemy1.maxHp = 800;
    const clusterEnemy2 = sim.spawnEnemy('goblin_shooter', t1.x + 145, t1.y + 18, true);
    clusterEnemy2.hp = 800;
    clusterEnemy2.maxHp = 800;

    sim.consumeEvents();
    sim.activateCharacterSkill(p1);

    const blastEvs = sim
      .consumeEvents()
      .filter((ev) => ev.kind === 'explosion' && ev.sourceDefId === 'tesla_turret_self_destruct');
    expect(blastEvs.length).toBeGreaterThanOrEqual(1);
    const expectedBlastDmg = scaleBlessingDamage(45, 2);
    if (blastEvs[0] && blastEvs[0].kind === 'explosion') {
      expect(blastEvs[0].radius).toBe(130);
      expect(blastEvs[0].damage).toBe(expectedBlastDmg);
    }
    expect(clusterEnemy1.hp).toBeLessThanOrEqual(800 - expectedBlastDmg);
    expect(clusterEnemy2.hp).toBeLessThanOrEqual(800 - expectedBlastDmg);
    expect(clusterEnemy1.burnTimer).toBeGreaterThan(0);
    expect(clusterEnemy1.shockTimer).toBeGreaterThan(0);
  });

  it('verifies 6 consecutive floors of 4-player Co-op blessing drafts (rollPendingBuffChoices) never exhaust the pool or offer duplicate owned cards', () => {
    const sim = createCleanArenaSim(7610);
    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'vanguard');
    const p2 = sim.addCoopPlayer(2, 'ranger', 'P2', 2);
    const p3 = sim.addCoopPlayer(3, 'elementalist', 'P3', 3);
    const p4 = sim.addCoopPlayer(4, 'engineer', 'P4', 4);
    const party = [p1, p2, p3, p4];

    for (let floor = 1; floor <= 6; floor++) {
      sim.rollPendingBuffChoices();
      for (const pl of party) {
        expect(pl.buffChoices).toHaveLength(3);
        // Choices must be unique within the 3 offered cards
        expect(new Set(pl.buffChoices).size).toBe(3);
        // None of the offered choices may already be owned by this player
        for (const choice of pl.buffChoices) {
          expect(pl.blessingIds).not.toContain(choice);
        }
        // Pick one card for this floor
        const picked = pl.buffChoices[floor % pl.buffChoices.length]!;
        sim.applyBuffEffects(picked, pl.id);
        pl.buffChoices = [];
      }
    }

    for (const pl of party) {
      expect(pl.blessingIds).toHaveLength(6);
      expect(new Set(pl.blessingIds).size).toBe(6);
    }
  });
});
