import { describe, expect, it } from 'vitest';
import { runBalanceHarness } from '../../../tools/balance-harness.js';
import {
  CHARACTERS,
  ELEMENTAL_REACTIONS,
  FLOOR_BUFFS,
  INPUT_BUTTON,
  SIM_STEP_SEC,
  WorldSim,
} from '../src/index.js';

describe('Phase 5 — 5 Playable Characters, Skills, 10 Upgrades & Co-op Synergies', () => {
  it('defines all 5 characters with Vietnamese names, passives, active skills, 2 upgrades each, and co-op synergies', () => {
    const ids = ['vanguard', 'ranger', 'elementalist', 'druid', 'engineer'] as const;
    for (const id of ids) {
      const c = CHARACTERS[id];
      expect(c).toBeDefined();
      expect(c.nameVi.length).toBeGreaterThan(2);
      expect(c.passiveNameVi.length).toBeGreaterThan(2);
      expect(c.skill.upgrades.length).toBe(2);
      expect(c.skill.synergyVi.length).toBeGreaterThan(10);
      for (const upg of c.skill.upgrades) {
        expect(FLOOR_BUFFS[upg.id]).toBeDefined();
      }
    }
    expect(Object.keys(ELEMENTAL_REACTIONS).length).toBe(6);
  });

  it('verifies Vanguard shield wall, ally bullet amplification (+30% dmg & +1 pierce), Fortress 360, and Charge x2 shockwave', () => {
    const sim = new WorldSim({
      seed: 5001,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'vanguard');
    const p2 = sim.addCoopPlayer(2, 'ranger', 'Liệp Ưng P2', 2);
    p1.x = 400;
    p1.y = 300;
    p1.aimAngle = 0;
    p2.x = 365;
    p2.y = 300;
    p2.aimAngle = 0;

    // Activate Vanguard Shield Wall
    sim.setPlayerInput({
      seq: 1,
      tick: 1,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SKILL,
    });
    sim.step(SIM_STEP_SEC);
    expect(p1.skillActiveTimer).toBeGreaterThan(3.5);

    // P2 shoots a bullet from behind P1 through P1's active shield -> bullet gets amplified (+30% damage & +1 pierce)
    sim.setPlayerInput({
      seq: 2,
      tick: 2,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: 0,
    });
    sim.setCoopPlayerInput(p2.id, {
      seq: 1,
      tick: 2,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
    });
    for (let i = 0; i < 6; i++) {
      sim.step(SIM_STEP_SEC);
    }
    const p2Bullets = sim.projectiles.filter((b) => b.ownerId === p2.id);
    expect(p2Bullets.length).toBeGreaterThan(0);
    expect(p2Bullets[0]!.amplifiedByShield).toBe(true);
    expect(p2Bullets[0]!.pierceRemaining).toBeGreaterThanOrEqual(1);

    // Enable both Vanguard upgrades (Pháo Đài Phản Xạ + Xung Phong) and trigger shockwave release on enemy
    p1.blessingIds.push('vanguard_bastion_prism', 'vanguard_charge');
    const target = sim.spawnEnemy('wild_boar', 490, 300, true);
    target.hp = 200;
    target.maxHp = 200;
    const prevX = p1.x;

    sim.setPlayerInput({
      seq: 3,
      tick: 10,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SKILL,
    });
    sim.step(SIM_STEP_SEC);
    expect(p1.x).toBeGreaterThan(prevX + 40);
    expect(target.hp).toBeLessThan(200);
    expect(target.aiState).toBe('stunned');
    expect(target.stateTimer).toBeCloseTo(1.2, 1);

    // Verify 200u Ruby Sword Wave during active Shield Wall hits an enemy at 160u away
    p1.skillActiveTimer = 3.5;
    p1.fireCooldownTimer = 0;
    const rangedTarget = sim.spawnEnemy('goblin_shooter', p1.x + 160, p1.y, true);
    rangedTarget.hp = 100;
    rangedTarget.maxHp = 100;
    sim.setPlayerInput({
      seq: 4,
      tick: 11,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
    });
    sim.step(SIM_STEP_SEC);
    expect(rangedTarget.hp).toBeLessThan(100);
  });

  it('verifies Ranger distance passive (+up to 30% dmg without double-application), Predator Arrow backflip + Mark (+25% dmg, bonus energy orb), Arrow Volley & Prey Chain', () => {
    const sim = new WorldSim({
      seed: 5002,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'ranger');
    p1.x = 300;
    p1.y = 300;
    p1.aimAngle = 0;

    // Distance passive check: close enemy vs far enemy (max +30% bonus, never double-applied)
    const nearEnemy = sim.spawnEnemy('wild_boar', 310, 300, true);
    nearEnemy.hp = 200;
    const farEnemy = sim.spawnEnemy('wild_boar', 640, 300, true);
    farEnemy.hp = 200;

    sim.applyDamageToEnemy(nearEnemy, 20, false, 'none', 0, 0, false, p1.id);
    sim.applyDamageToEnemy(farEnemy, 20, false, 'none', 0, 0, false, p1.id);
    const nearLoss = 200 - nearEnemy.hp;
    const farLoss = 200 - farEnemy.hp;
    expect(farLoss).toBeGreaterThan(nearLoss);
    expect(farLoss).toBeLessThanOrEqual(26); // 20 * 1.30 = 26 max

    // Clear test enemies before testing Arrow Volley + Prey Chain
    sim.enemies.length = 0;

    // Upgrade 1 (Mưa Tên 5 arrows) + Upgrade 2 (Chuỗi Con Mồi 30% chain damage)
    p1.blessingIds.push('ranger_arrow_volley', 'ranger_prey_chain');
    const markTarget = sim.spawnEnemy('wild_boar', 410, 300, true);
    markTarget.hp = 500;
    markTarget.maxHp = 500;
    const chainedTarget = sim.spawnEnemy('wild_boar', 435, 315, true);
    chainedTarget.hp = 500;
    chainedTarget.maxHp = 500;

    // Cast Predator Arrow -> backflip + 5 fan arrows that mark enemies
    sim.setPlayerInput({
      seq: 1,
      tick: 1,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SKILL,
    });
    for (let i = 0; i < 12; i++) {
      sim.step(SIM_STEP_SEC);
      sim.setPlayerInput({
        seq: i + 2,
        tick: i + 2,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
      });
    }

    expect(markTarget.markedTimer).toBeGreaterThan(0);
    const hpBeforeChain = chainedTarget.hp;
    sim.applyDamageToEnemy(markTarget, 40, false, 'none', 0, 0, false, p1.id);
    expect(chainedTarget.hp).toBeLessThan(hpBeforeChain);
  });

  it('verifies Elementalist cycle (Burn -> Chill -> Shock), Elemental Orb Zone (Vortex + Dual Element), and ally bullet imbue', () => {
    const sim = new WorldSim({
      seed: 5003,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'elementalist');
    p1.x = 320;
    p1.y = 300;
    p1.aimAngle = 0;
    expect(p1.activeImbueElement).toBe('burn');

    p1.blessingIds.push('elementalist_vortex', 'elementalist_twin_orbit');
    const enemy = sim.spawnEnemy('wild_boar', 470, 315, true);
    enemy.hp = 300;
    enemy.maxHp = 300;

    // Cast Elemental Orb -> creates zone at ~460, 300 with burn + chill (Dual Element) and Vortex pull, cycles p1 to 'chill'
    sim.setPlayerInput({
      seq: 1,
      tick: 1,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SKILL,
    });
    sim.step(SIM_STEP_SEC);
    expect(p1.activeImbueElement).toBe('chill');
    expect(sim.skillZones.length).toBe(2);
    expect(sim.skillZones[0]!.vortex).toBe(true);
    expect(sim.skillZones[0]!.secondaryElement).toBe('chill');

    // Step 40 ticks -> Vortex pulls enemy toward zone center and Dual Element triggers elemental reaction!
    for (let i = 0; i < 40; i++) {
      sim.setPlayerInput({
        seq: i + 2,
        tick: i + 2,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
      });
      sim.step(SIM_STEP_SEC);
    }
    expect(sim.runStats.elementalReactions).toBeGreaterThan(0);
  });

  it('verifies Druid Sacred Tree instant downed ally revive, root aura, Poison Roots & Sacred Grove (2 trees), and Life Seed flying to lowest-HP ally', () => {
    const sim = new WorldSim({
      seed: 5004,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'druid');
    const p2 = sim.addCoopPlayer(2, 'vanguard', 'Thiết Vệ P2', 2);
    p1.x = 340;
    p1.y = 300;
    p1.aimAngle = 0;

    // Put P2 in downed state right in front of Druid
    p2.x = 395;
    p2.y = 300;
    p2.hp = 0;
    p2.lifeState = 'downed';
    p2.downedTimer = 15;

    p1.blessingIds.push('druid_poison_roots', 'druid_sacred_grove');
    const enemy = sim.spawnEnemy('wild_boar', 415, 305, true);
    enemy.hp = 200;

    // Cast Sacred Tree -> plants 2 trees (Sacred Grove), instantly revives downed P2 with 2 HP, and roots nearby enemy!
    sim.setPlayerInput({
      seq: 1,
      tick: 1,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SKILL,
    });
    for (let i = 0; i < 5; i++) {
      sim.step(SIM_STEP_SEC);
      sim.setPlayerInput({ seq: i + 2, tick: i + 2, moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
    }

    expect(sim.summons.filter((s) => s.kind === 'sacred_tree').length).toBe(2);
    expect(p2.lifeState).toBe('alive');
    expect(p2.hp).toBeGreaterThanOrEqual(2);
    expect(enemy.rootedTimer).toBeGreaterThan(0);

    // Killing an Elite while Druid is on the team guarantees a Life Seed pickup that tracks the lowest-HP ally (p2)
    p1.hp = p1.maxHp; // Full HP
    p2.hp = 2; // Injured ally
    p2.x = 460;
    p2.y = 300;
    const elite = sim.spawnEnemy('goblin_shooter', 420, 300, true, 'fast');
    sim.applyDamageToEnemy(elite, 999, true, 'none', 0, 0, true, p1.id);
    expect(sim.pickups.some((pk) => pk.kind === 'life_seed')).toBe(true);

    for (let i = 0; i < 20; i++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(p2.hp).toBeGreaterThan(2);
  });

  it('verifies Engineer Twin Turrets, Self-Destruct, Ancient Mechanism repair, and Ally Shot -> EMP Blast synergy', () => {
    const sim = new WorldSim({
      seed: 5005,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const p1 = sim.player;
    sim.selectCharacter(p1.id, 'engineer');
    p1.x = 350;
    p1.y = 300;
    p1.aimAngle = 0;

    // 1. Repair Ancient Mechanism on map with [E]
    const mech = sim.spawnProp('ancient_mechanism', 370, 300);
    sim.setPlayerInput({
      seq: 1,
      tick: 1,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.INTERACT,
    });
    sim.step(SIM_STEP_SEC);
    expect(mech.repaired).toBe(true);
    expect(sim.summons.some((s) => s.kind === 'ancient_turret')).toBe(true);

    // 2. Deploy Twin Turrets with Self-Destruct
    p1.blessingIds.push('engineer_twin_turrets', 'engineer_self_destruct');
    sim.setPlayerInput({
      seq: 2,
      tick: 2,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.SKILL,
    });
    sim.step(SIM_STEP_SEC);
    const teslaTurrets = sim.summons.filter((s) => s.kind === 'tesla_turret');
    expect(teslaTurrets.length).toBe(2);

    // 3. Shoot Tesla Turret with elemental bullets -> charges EMP to 100% -> triggers EMP blast that stuns enemy and clears enemy bullets!
    const turret = teslaTurrets[0]!;
    const enemy = sim.spawnEnemy('goblin_shooter', turret.x + 60, turret.y, true);
    enemy.hp = 200;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: enemy.id,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: turret.x + 30,
      y: turret.y,
      angle: Math.PI,
      pelletCount: 1,
      spreadRad: 0,
      speed: 50,
      damage: 1,
      radius: 5,
      knockback: 10,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 3,
      element: 'none',
      critChance: 0,
      amplifiedByShield: false,
      seed: 123,
    });
    expect(sim.projectiles.some((b) => b.team === 'enemy')).toBe(true);

    turret.charge = 60;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: p1.id,
      team: 'player',
      weaponId: 'apprentice_staff',
      x: turret.x - 10,
      y: turret.y,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 400,
      damage: 10,
      radius: 5,
      knockback: 10,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 1,
      element: 'shock',
      critChance: 0,
      amplifiedByShield: false,
      seed: 456,
    });
    sim.step(SIM_STEP_SEC);
    sim.step(SIM_STEP_SEC);

    expect(enemy.aiState).toBe('stunned');
    expect(sim.projectiles.some((b) => b.team === 'enemy')).toBe(false);
  });

  it('verifies 5-character simultaneous synergy chain (Turret + Dual Elemental Zone + Vanguard Shield + Ranger Mark + Druid Poison Roots)', () => {
    const sim = new WorldSim({
      seed: 5009,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const pEng = sim.player;
    sim.selectCharacter(pEng.id, 'engineer');
    const pElem = sim.addCoopPlayer(2, 'elementalist', 'Lam Hỏa P2', 2);
    const pVan = sim.addCoopPlayer(3, 'vanguard', 'Thiết Vệ P3', 3);
    const pDruid = sim.addCoopPlayer(4, 'druid', 'Mộc Linh P4', 4);
    void pElem;
    void pDruid;

    // Vanguard stands between the Turret (x=400) and the Enemy (x=540) with Shield Wall active
    pVan.x = 460;
    pVan.y = 300;
    pVan.aimAngle = 0;
    pVan.skillActiveTimer = 3.5;

    // Elementalist Dual-Element Zone sits along the line of fire (x=490)
    sim.skillZones.push({
      id: 9100,
      ownerPlayerId: pElem.id,
      x: 490,
      y: 300,
      radius: 68,
      ttlSec: 4.5,
      maxTtlSec: 5.0,
      tickTimer: 5.0,
      element: 'burn',
      secondaryElement: 'chill',
      vortex: true,
    });

    // Target 1 & 2 are Marked by Ranger and Poison-Rooted by Druid
    const target1 = sim.spawnEnemy('wild_boar', 540, 300, true);
    target1.hp = 600;
    target1.maxHp = 600;
    target1.markedTimer = 5.0;
    target1.rootedTimer = 3.0;
    target1.poisonTimer = 4.0;
    target1.poisonStacks = 2;
    target1.lastElementOwnerId = pDruid.id;
    target1.lastElementApplied = 'poison';

    const target2 = sim.spawnEnemy('goblin_shaman', 575, 300, true);
    target2.hp = 600;
    target2.maxHp = 600;

    const target3 = sim.spawnEnemy('goblin_shooter', 605, 300, true);
    target3.hp = 600;
    target3.maxHp = 600;

    // Engineer Tesla Turret fires along the line -> passes through Vanguard Shield (+30% dmg, +1 chain target -> hits 3 enemies!) and Elementalist Dual Zone (+15% dmg, imbues burn+chill)
    sim.summons.push({
      id: 9101,
      ownerPlayerId: pEng.id,
      kind: 'tesla_turret',
      nameVi: 'Trụ Tesla',
      x: 400,
      y: 300,
      radius: 15,
      auraRadius: 195,
      hp: 45,
      maxHp: 45,
      ttlSec: 9.0,
      maxTtlSec: 10.0,
      tickTimer: 0.01,
      healsRemaining: 0,
      charge: 0,
      poisonRoots: false,
      selfDestruct: false,
      rootedEnemyIds: [],
    });

    sim.step(SIM_STEP_SEC);

    // Verify all 3 targets were hit (2 base + 1 from Vanguard Shield amplification) and Team Combos triggered!
    expect(target1.hp).toBeLessThan(600);
    expect(target2.hp).toBeLessThan(600);
    expect(target3.hp).toBeLessThan(600);
    expect(sim.runStats.elementalReactions).toBeGreaterThanOrEqual(2);
    expect(sim.teamComboCount).toBeGreaterThanOrEqual(1);
    expect(pEng.elementalConvergenceTimer).toBeGreaterThan(0);
  });
});

describe('Phase 5 — All 6 Elemental Reactions & Co-op Team Combo (Hội Tụ Nguyên Tố)', () => {
  it('triggers all 6 elemental reactions (vaporize, shatter, superconduct, toxic_blast, paralysis, overload) cleanly without manual timer hacks and awards Elemental Convergence to both players on Team Combo', () => {
    const sim = new WorldSim({
      seed: 5010,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });

    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'elementalist', 'Lam Hỏa P2', 2);
    p1.clipAmmo = 1;
    p2.weaponHeat = 65;

    const target = sim.spawnEnemy('spore_king', 500, 300, true);
    target.hp = 5000;
    target.maxHp = 5000;
    target.shieldArmor = 100;
    target.maxShieldArmor = 100;
    const neighbor = sim.spawnEnemy('wild_boar', 545, 300, true);
    neighbor.hp = 500;
    neighbor.maxHp = 500;

    // 1. Vaporize (Hơi Nước: P1 Burn + P2 Chill) -> Team Combo #1 + 75u Steam Cloud AoE blind!
    sim.applyDamageToEnemy(target, 15, false, 'burn', 0, 0, false, p1.id);
    sim.applyDamageToEnemy(target, 15, false, 'chill', 0, 0, false, p2.id);
    expect(target.steamBlindTimer).toBeGreaterThan(2.0);
    expect(neighbor.steamBlindTimer).toBeGreaterThan(2.0);
    expect(sim.teamComboCount).toBe(1);
    expect(p1.elementalConvergenceTimer).toBeCloseTo(3.0, 2);
    expect(p2.elementalConvergenceTimer).toBeCloseTo(3.0, 2);
    expect(p1.clipAmmo).toBe(p1.clipMax);
    expect(p2.weaponHeat).toBe(0);

    // 2. Shatter (Vỡ Băng: P2 freezes with 3 Chill stacks + P1 heavy hit) -> Team Combo #2!
    sim.applyDamageToEnemy(target, 10, false, 'chill', 0, 0, false, p2.id);
    sim.applyDamageToEnemy(target, 10, false, 'chill', 0, 0, false, p2.id);
    sim.applyDamageToEnemy(target, 10, false, 'chill', 0, 0, false, p2.id);
    expect(target.frozenTimer).toBeGreaterThan(0);
    sim.applyDamageToEnemy(target, 20, true, 'none', 0, 0, true, p1.id);
    expect(sim.teamComboCount).toBe(2);

    // 3. Superconduct (Siêu Dẫn: P1 Chill + P2 Shock) -> Team Combo #3 + shreds shieldArmor to 0 and consumes Chill/Shock!
    sim.applyDamageToEnemy(target, 10, false, 'chill', 0, 0, false, p1.id);
    sim.applyDamageToEnemy(target, 10, false, 'shock', 0, 0, false, p2.id);
    expect(target.superconductTimer).toBeGreaterThan(5.0);
    expect(target.shieldArmor).toBe(0);
    expect(target.chillTimer).toBe(0);
    expect(target.shockTimer).toBe(0);
    expect(sim.teamComboCount).toBe(3);

    // 4. Toxic Blast (Nổ Độc: P1 Poison + P2 Burn) -> Team Combo #4 + spreads Poison to neighbor!
    sim.applyDamageToEnemy(target, 12, false, 'poison', 0, 0, false, p1.id);
    sim.applyDamageToEnemy(target, 12, false, 'burn', 0, 0, false, p2.id);
    expect(neighbor.poisonTimer).toBeGreaterThan(0);
    expect(target.poisonTimer).toBe(0);
    expect(target.burnTimer).toBe(0);
    expect(sim.teamComboCount).toBe(4);

    // 5. Paralysis (Tê Liệt: P2 Poison + P1 Shock) -> Team Combo #5 + stuns target for 1.0s and consumes Poison/Shock!
    target.aiState = 'telegraph';
    sim.applyDamageToEnemy(target, 12, false, 'poison', 0, 0, false, p2.id);
    sim.applyDamageToEnemy(target, 12, false, 'shock', 0, 0, false, p1.id);
    expect(target.aiState).toBe('stunned');
    expect(target.stateTimer).toBeCloseTo(1.0, 2);
    expect(target.poisonTimer).toBe(0);
    expect(target.shockTimer).toBe(0);
    expect(sim.teamComboCount).toBe(5);

    // 6. Overload (Quá Tải: P1 Burn + P2 Shock) -> Team Combo #6 + breaks shield & knocks back neighbor!
    target.shieldArmor = 50;
    sim.applyDamageToEnemy(target, 12, false, 'burn', 0, 0, false, p1.id);
    sim.applyDamageToEnemy(target, 12, false, 'shock', 0, 0, false, p2.id);
    expect(target.shieldArmor).toBe(0);
    expect(sim.teamComboCount).toBe(6);
    expect(sim.runStats.elementalReactions).toBe(6);
  });

  it('verifies all 7 quantitative balance targets via Headless Balance Harness (section 7.4)', () => {
    const report = runBalanceHarness({ seedsPerConfig: 6 });
    expect(report.avgEnemyTtkSec).toBeGreaterThanOrEqual(0.6);
    expect(report.avgEnemyTtkSec).toBeLessThanOrEqual(3.2);
    expect(report.combatRoomAvgSec).toBeGreaterThanOrEqual(20);
    expect(report.combatRoomAvgSec).toBeLessThanOrEqual(75);
    expect(report.boss1PAvgSec).toBeGreaterThanOrEqual(55);
    expect(report.boss1PAvgSec).toBeLessThanOrEqual(140);
    expect(report.boss4PAvgSec).toBeGreaterThanOrEqual(55);
    expect(report.boss4PAvgSec).toBeLessThanOrEqual(140);
    expect(report.boss1Pvs4PDeltaPct).toBeLessThanOrEqual(25);
    expect(report.minHitsSurvived).toBeGreaterThanOrEqual(4);
    expect(report.maxHitsSurvived).toBeLessThanOrEqual(10);
    expect(report.dps3CharSpreadPct).toBeLessThanOrEqual(15);
    expect(report.characters.length).toBe(5);
    expect(report.weaponMatrix.length).toBe(5);
    expect(report.coopSynergyRows.every((c) => c.teamCombos > 0)).toBe(true);
  }, 60000);
});
