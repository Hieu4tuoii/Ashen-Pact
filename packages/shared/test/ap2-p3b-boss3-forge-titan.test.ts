import { describe, expect, it } from 'vitest';
import {
  BOSS_MIN_BARRICADES,
  BOSS_MIN_BIOME_TOYS,
  FORGE_TITAN_ARMOR_BREAK_STUN_SEC,
  FORGE_TITAN_ARMOR_REDUCTION,
  FORGE_TITAN_BOSS_COAL_BOMB_FUSE_SEC,
  INPUT_BUTTON,
  WorldSim,
  activateBossArmorShell,
  getBossArmorBreakVulnBonus,
  getBossArmorShellDamageMultiplier,
  triggerBossArmorBreak,
  tryBreakBossArmorWithKickedProp,
} from '../src/index.js';

const SIM_STEP_SEC = 1 / 60;

function createBiome3BossSim(seed = 9401): WorldSim {
  const sim = new WorldSim({
    seed,
    biome: 3,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
  });
  const bossRoom =
    sim.dungeon.rooms.find((r) => r.type === 'boss') ?? sim.dungeon.rooms[0]!;
  bossRoom.type = 'boss';
  bossRoom.cleared = false;
  sim.enterRoom(bossRoom.id);
  return sim;
}

describe('AP2 Phase P3B.4 — Biome 3 Boss forge_titan (Titan Lò Rèn — 1-Step Visual Armor Break)', () => {
  it('activates Thermonuclear Armor (bossArmorShellActive = true, 75% damage reduction -> x0.25, Supply Drop >= 3 forge_blast_shield + >= 2 coal_bomb / slag_crucible, and spawns 1-2 coal_bomb props with fuseTimer = 3.5s around Titan) at <= 66% MaxHP (Phase 2) and <= 33% MaxHP (Phase 3)', () => {
    expect(FORGE_TITAN_ARMOR_REDUCTION).toBe(0.75);
    expect(FORGE_TITAN_ARMOR_BREAK_STUN_SEC).toBe(4.0);
    expect(FORGE_TITAN_BOSS_COAL_BOMB_FUSE_SEC).toBe(3.5);

    const sim = createBiome3BossSim(9401);
    const boss = sim.getActiveBoss()!;
    expect(boss).toBeDefined();
    expect(boss.defId).toBe('forge_titan');

    boss.maxHp = 5000;
    boss.hp = 5000;
    boss.bossPhase = 1;
    boss.bossPhaseTransitionTimer = 0;

    // Remove existing tactical props to verify immediate Supply Drop and floor coal_bombs on shell activation
    sim.props = sim.props.filter(
      (p) =>
        p.kind !== 'forge_blast_shield' &&
        p.kind !== 'coal_bomb' &&
        p.kind !== 'slag_crucible',
    );
    sim.pendingBossSupplyDrops.length = 0;

    // Baseline normal bullet damage before Thermonuclear Armor is active
    const hpBeforeBaseline = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    const baselineDmg = hpBeforeBaseline - boss.hp;
    expect(baselineDmg).toBe(100);
    expect(getBossArmorShellDamageMultiplier(boss)).toBe(1.0);

    // 1. Bring Forge Titan HP to <= 66% MaxHP -> Phase 2 transition activates Thermonuclear Armor (75% reduction)
    boss.hp = Math.floor(boss.maxHp * 0.66); // 3300
    sim.checkBossPhaseTransitions(boss);

    expect(boss.bossPhase).toBe(2);
    expect(boss.bossArmorPhase66Triggered).toBe(true);
    expect(boss.bossArmorShellActive).toBe(true);
    expect(boss.bossArmorShellReduction).toBeCloseTo(0.75, 5);
    expect(getBossArmorShellDamageMultiplier(boss)).toBeCloseTo(0.25, 5);
    expect(sim.pendingBossSupplyDrops).toHaveLength(
      BOSS_MIN_BARRICADES + BOSS_MIN_BIOME_TOYS,
    );
    expect(
      sim.pendingBossSupplyDrops.filter((d) => d.propKind === 'forge_blast_shield')
        .length,
    ).toBe(BOSS_MIN_BARRICADES);
    expect(
      sim.pendingBossSupplyDrops.filter(
        (d) => d.propKind === 'coal_bomb' || d.propKind === 'slag_crucible',
      ).length,
    ).toBe(BOSS_MIN_BIOME_TOYS);

    // Verify 1-2 coal_bomb props with fuseTimer = 3.5s were spawned immediately around Titan
    const floorCoalBombsP2 = sim.props.filter(
      (p) => p.kind === 'coal_bomb' && p.hp > 0 && p.state !== 'broken',
    );
    expect(floorCoalBombsP2.length).toBeGreaterThanOrEqual(1);
    expect(floorCoalBombsP2.length).toBeLessThanOrEqual(2);
    for (const bomb of floorCoalBombsP2) {
      expect(bomb.fuseTimer).toBeCloseTo(3.5, 5);
    }

    // Verify normal bullet damage is reduced by 75% (100 * 0.25 = 25)
    boss.bossPhaseTransitionTimer = 0;
    const hpBeforeShellHit = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    const shellDmg = hpBeforeShellHit - boss.hp;
    expect(shellDmg).toBe(Math.round(baselineDmg * 0.25));

    // 2. Break Phase 2 shell, clear props, then bring HP to <= 33% MaxHP -> Phase 3 transition re-activates Thermonuclear Armor
    boss.bossArmorShellActive = false;
    boss.bossArmorShellReduction = 0;
    sim.pendingBossSupplyDrops.length = 0;
    sim.props = sim.props.filter(
      (p) =>
        p.kind !== 'forge_blast_shield' &&
        p.kind !== 'coal_bomb' &&
        p.kind !== 'slag_crucible',
    );

    boss.hp = Math.floor(boss.maxHp * 0.33); // 1650
    sim.checkBossPhaseTransitions(boss);

    expect(boss.bossPhase).toBe(3);
    expect(boss.bossArmorPhase33Triggered).toBe(true);
    expect(boss.bossArmorShellActive).toBe(true);
    expect(boss.bossArmorShellReduction).toBeCloseTo(0.75, 5);
    expect(getBossArmorShellDamageMultiplier(boss)).toBeCloseTo(0.25, 5);
    expect(sim.pendingBossSupplyDrops).toHaveLength(
      BOSS_MIN_BARRICADES + BOSS_MIN_BIOME_TOYS,
    );
    const floorCoalBombsP3 = sim.props.filter(
      (p) => p.kind === 'coal_bomb' && p.hp > 0 && p.state !== 'broken',
    );
    expect(floorCoalBombsP3.length).toBeGreaterThanOrEqual(1);
    expect(floorCoalBombsP3.length).toBeLessThanOrEqual(2);
    for (const bomb of floorCoalBombsP3) {
      expect(bomb.fuseTimer).toBeCloseTo(3.5, 5);
    }
  });

  it('Way A (1-Step Armor Break): Dash-Kicking or Melee-Kicking forge_blast_shield, coal_bomb, or slag_crucible into forge_titan shatters Thermonuclear Armor, deals 6% MaxHP true hazard damage, inflicts 4.0s stun, and applies +40% EnemyVuln (1.4x bullet damage)', () => {
    const sim = createBiome3BossSim(9402);
    const boss = sim.getActiveBoss()!;
    boss.maxHp = 5000;
    boss.hp = 3300;
    boss.x = 520;
    boss.y = 320;
    boss.vx = 0;
    boss.vy = 0;
    boss.bossPhase = 2;
    boss.bossPhaseTransitionTimer = 0;

    sim.enemies = sim.enemies.filter((e) => e.id === boss.id);
    sim.props.length = 0;

    const expectedHazardDmg = Math.round(0.06 * boss.maxHp); // 300

    // --- Subcase A1: Dash-Kick forge_blast_shield into forge_titan ---
    activateBossArmorShell(sim, boss, 0.75);
    sim.props.length = 0; // clear auto-spawned coal_bombs to isolate forge_blast_shield test
    expect(boss.bossArmorShellActive).toBe(true);

    const shield = sim.spawnProp('forge_blast_shield', 455, 320);
    sim.player.x = 420;
    sim.player.y = 320;
    sim.player.aimAngle = 0;
    expect(sim.kickProp(shield, sim.player, 0)).toBe(true);

    const hpBeforeShieldBreak = boss.hp;
    sim.consumeEvents();

    for (let t = 0; t < 15; t++) {
      sim.step(SIM_STEP_SEC);
      if (!boss.bossArmorShellActive) break;
    }

    expect(boss.bossArmorShellActive).toBe(false);
    expect(boss.bossArmorShellReduction).toBe(0);
    expect(hpBeforeShieldBreak - boss.hp).toBe(expectedHazardDmg);
    expect(boss.aiState).toBe('stunned');
    expect(boss.stunTimer).toBe(4.0);
    expect(boss.stateTimer).toBe(4.0);
    expect(boss.vx).toBe(0);
    expect(boss.vy).toBe(0);
    expect(boss.bossArmorBreakVulnTimer).toBe(4.0);
    expect(getBossArmorBreakVulnBonus(boss)).toBeCloseTo(0.4, 5);
    expect(boss.lastCombatText).toBe('THERMAL ARMOR OVERLOAD!');

    const shieldBreakEvents = sim.consumeEvents();
    expect(
      shieldBreakEvents.some(
        (ev) => ev.kind === 'armor_broken' && ev.targetId === boss.id,
      ),
    ).toBe(true);

    // Verify normal bullet damage during the 4.0s Armor Break window gets +40% EnemyVuln (100 * 1.4 = 140)
    const hpBeforeVulnShot = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    expect(hpBeforeVulnShot - boss.hp).toBe(140);

    // Step 4.0s (240 ticks) so the vulnerability window expires -> returns to 1.0x baseline damage
    for (let t = 0; t < 240; t++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(boss.bossArmorBreakVulnTimer).toBe(0);
    const hpAfterVulnExpired = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    expect(hpAfterVulnExpired - boss.hp).toBe(100);

    // --- Subcase A2: Melee-Kick coal_bomb into forge_titan ---
    sim.props.length = 0;
    boss.x = 520;
    boss.y = 320;
    boss.vx = 0;
    boss.vy = 0;
    activateBossArmorShell(sim, boss, 0.75);
    sim.props.length = 0;
    expect(boss.bossArmorShellActive).toBe(true);

    const coalBomb = sim.spawnProp('coal_bomb', 455, 320);
    coalBomb.fuseTimer = 3.5;
    sim.player.x = 420;
    sim.player.y = 320;
    sim.player.aimAngle = 0;
    sim.player.weaponSlots = ['knight_sword', 'rivet_gun'];
    sim.player.activeWeaponSlot = 0;
    sim.player.fireCooldownTimer = 0;

    const hpBeforeCoalBombBreak = boss.hp;
    sim.consumeEvents();

    sim.setPlayerInput({
      seq: 1,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
      weaponSlotSelect: null,
    });

    for (let t = 0; t < 15; t++) {
      sim.step(SIM_STEP_SEC);
      sim.setPlayerInput({
        seq: t + 2,
        tick: sim.tick,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      if (!boss.bossArmorShellActive) break;
    }

    expect(coalBomb.hp).toBe(0);
    expect(boss.bossArmorShellActive).toBe(false);
    expect(boss.bossArmorShellReduction).toBe(0);
    expect(hpBeforeCoalBombBreak - boss.hp).toBe(expectedHazardDmg);
    expect(boss.aiState).toBe('stunned');
    expect(boss.stunTimer).toBe(4.0);
    expect(boss.stateTimer).toBe(4.0);
    expect(boss.vx).toBe(0);
    expect(boss.vy).toBe(0);
    expect(boss.bossArmorBreakVulnTimer).toBe(4.0);
    expect(boss.lastCombatText).toBe('THERMAL ARMOR OVERLOAD!');

    // --- Subcase A3: Melee-Kick / Dash-Kick slag_crucible (molten lava carpet) into forge_titan ---
    sim.props.length = 0;
    boss.x = 520;
    boss.y = 320;
    boss.vx = 0;
    boss.vy = 0;
    activateBossArmorShell(sim, boss, 0.75);
    sim.props.length = 0;
    expect(boss.bossArmorShellActive).toBe(true);

    const crucible = sim.spawnProp('slag_crucible', 455, 320);
    sim.player.x = 420;
    sim.player.y = 320;
    sim.player.aimAngle = 0;
    sim.player.fireCooldownTimer = 0;

    const hpBeforeCrucibleBreak = boss.hp;
    sim.consumeEvents();

    sim.setPlayerInput({
      seq: 30,
      tick: sim.tick,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
      weaponSlotSelect: null,
    });

    for (let t = 0; t < 15; t++) {
      sim.step(SIM_STEP_SEC);
      sim.setPlayerInput({
        seq: 31 + t,
        tick: sim.tick,
        moveX: 0,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      if (!boss.bossArmorShellActive) break;
    }

    expect(crucible.hp).toBe(0);
    expect(boss.bossArmorShellActive).toBe(false);
    expect(boss.bossArmorShellReduction).toBe(0);
    expect(hpBeforeCrucibleBreak - boss.hp).toBe(expectedHazardDmg);
    expect(boss.aiState).toBe('stunned');
    expect(boss.stunTimer).toBe(4.0);
    expect(boss.stateTimer).toBe(4.0);
    expect(boss.vx).toBe(0);
    expect(boss.vy).toBe(0);
    expect(boss.bossArmorBreakVulnTimer).toBe(4.0);
    expect(boss.lastCombatText).toBe('THERMAL ARMOR OVERLOAD!');
    expect(typeof tryBreakBossArmorWithKickedProp).toBe('function');
  });

  it('Way B (1-Step Armor Break via pneumatic_press): triggering a pneumatic_press slam on forge_titan immediately shatters Thermonuclear Armor, deals 6% MaxHP true hazard damage, inflicts 4.0s stun, and applies +40% EnemyVuln', () => {
    const sim = createBiome3BossSim(9403);
    const boss = sim.getActiveBoss()!;
    boss.maxHp = 5000;
    boss.hp = 3300;
    boss.x = 480;
    boss.y = 320;
    boss.vx = 0;
    boss.vy = 0;
    boss.bossPhase = 2;
    boss.bossPhaseTransitionTimer = 0;

    sim.enemies = sim.enemies.filter((e) => e.id === boss.id);
    sim.props.length = 0;

    activateBossArmorShell(sim, boss, 0.75);
    sim.props.length = 0;
    expect(boss.bossArmorShellActive).toBe(true);

    // Spawn a pneumatic_press at (480, 320) where forge_titan stands inside its sensor & crush footprint
    const press = sim.spawnProp('pneumatic_press', 480, 320);
    sim.player.x = 340;
    sim.player.y = 320;

    const hpBeforePressSlam = boss.hp;
    const expectedHazardDmg = Math.round(0.06 * boss.maxHp); // 300
    sim.consumeEvents();

    // Step until the 0.35s windup completes and pneumatic_press slams down onto forge_titan
    for (let t = 0; t < 30; t++) {
      boss.x = 480;
      boss.y = 320;
      sim.step(SIM_STEP_SEC);
      if (!boss.bossArmorShellActive) break;
    }

    expect(press.pressState).toBe('cooldown');
    expect(boss.bossArmorShellActive).toBe(false);
    expect(boss.bossArmorShellReduction).toBe(0);
    expect(hpBeforePressSlam - boss.hp).toBe(expectedHazardDmg);
    expect(boss.aiState).toBe('stunned');
    expect(boss.stunTimer).toBe(4.0);
    expect(boss.stateTimer).toBe(4.0);
    expect(boss.vx).toBe(0);
    expect(boss.vy).toBe(0);
    expect(boss.bossArmorBreakVulnTimer).toBe(4.0);
    expect(getBossArmorBreakVulnBonus(boss)).toBeCloseTo(0.4, 5);
    expect(boss.lastCombatText).toBe('THERMAL ARMOR OVERLOAD!');

    const pressEvents = sim.consumeEvents();
    expect(
      pressEvents.some(
        (ev) => ev.kind === 'armor_broken' && ev.targetId === boss.id,
      ),
    ).toBe(true);

    // Confirm +40% EnemyVuln (1.4x bullet damage) during the 4.0s press-crush stun window
    const hpBeforeShot = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    expect(hpBeforeShot - boss.hp).toBe(140);
    expect(typeof triggerBossArmorBreak).toBe('function');
  });
});
