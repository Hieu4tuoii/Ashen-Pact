import { describe, expect, it } from 'vitest';
import {
  BOSS_MIN_BARRICADES,
  BOSS_MIN_BIOME_TOYS,
  INPUT_BUTTON,
  KRYSSA_ARMOR_BREAK_STUN_SEC,
  KRYSSA_ARMOR_REDUCTION,
  WorldSim,
  activateBossArmorShell,
  flipCoverProp,
  getBossArmorBreakVulnBonus,
  getBossArmorShellDamageMultiplier,
  triggerBossArmorBreak,
  tryBreakBossArmorWithKickedProp,
} from '../src/index.js';

const SIM_STEP_SEC = 1 / 60;

function createBiome2BossSim(seed = 9301): WorldSim {
  const sim = new WorldSim({
    seed,
    biome: 2,
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

describe('AP2 Phase P3B.3 — Biome 2 Boss kryssa_ice_queen (Băng Hậu Kryssa — 1-2 Step Visual Armor Break)', () => {
  it('activates Glacial Shield (bossArmorShellActive = true, 75% damage reduction -> x0.25, Supply Drop >= 3 glacial_barricade + >= 2 sliding_ice_block, prepares & fires kryssa_ice_beam) at <= 66% MaxHP (Phase 2) and <= 33% MaxHP (Phase 3)', () => {
    expect(KRYSSA_ARMOR_REDUCTION).toBe(0.75);
    expect(KRYSSA_ARMOR_BREAK_STUN_SEC).toBe(3.0);

    const sim = createBiome2BossSim(9301);
    const boss = sim.getActiveBoss()!;
    expect(boss).toBeDefined();
    expect(boss.defId).toBe('kryssa_ice_queen');

    boss.maxHp = 4000;
    boss.hp = 4000;
    boss.bossPhase = 1;
    boss.bossPhaseTransitionTimer = 0;

    // Remove existing tactical props to verify immediate Supply Drop on shell activation
    sim.props = sim.props.filter(
      (p) => p.kind !== 'glacial_barricade' && p.kind !== 'sliding_ice_block',
    );
    sim.pendingBossSupplyDrops.length = 0;

    // Baseline normal bullet damage before Glacial Shield is active
    const hpBeforeBaseline = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    const baselineDmg = hpBeforeBaseline - boss.hp;
    expect(baselineDmg).toBe(100);
    expect(getBossArmorShellDamageMultiplier(boss)).toBe(1.0);

    // 1. Bring Kryssa HP to <= 66% MaxHP -> Phase 2 transition activates Glacial Shield (75% reduction)
    boss.hp = Math.floor(boss.maxHp * 0.66); // 2640
    sim.checkBossPhaseTransitions(boss);

    expect(boss.bossPhase).toBe(2);
    expect(boss.bossArmorPhase66Triggered).toBe(true);
    expect(boss.bossArmorShellActive).toBe(true);
    expect(boss.bossArmorShellReduction).toBeCloseTo(0.75, 5);
    expect(getBossArmorShellDamageMultiplier(boss)).toBeCloseTo(0.25, 5);
    expect(boss.aiState).toBe('telegraph');
    expect(sim.pendingBossSupplyDrops).toHaveLength(
      BOSS_MIN_BARRICADES + BOSS_MIN_BIOME_TOYS,
    );
    expect(
      sim.pendingBossSupplyDrops.filter((d) => d.propKind === 'glacial_barricade')
        .length,
    ).toBe(BOSS_MIN_BARRICADES);
    expect(
      sim.pendingBossSupplyDrops.filter((d) => d.propKind === 'sliding_ice_block')
        .length,
    ).toBe(BOSS_MIN_BIOME_TOYS);

    // Verify normal bullet damage is reduced by 75% (100 * 0.25 = 25)
    boss.bossPhaseTransitionTimer = 0;
    const hpBeforeShellHit = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    const shellDmg = hpBeforeShellHit - boss.hp;
    expect(shellDmg).toBe(Math.round(baselineDmg * 0.25));

    // Step telegraph completion -> Kryssa fires Extreme Cryo Laser (kryssa_ice_beam) toward the player
    sim.projectiles.length = 0;
    boss.stateTimer = 0.01;
    sim.step(SIM_STEP_SEC);
    const cryoBeams = sim.projectiles.filter(
      (b) => b.team === 'enemy' && b.weaponId === 'kryssa_ice_beam',
    );
    expect(cryoBeams.length).toBeGreaterThanOrEqual(3);

    // 2. Break Phase 2 shield, then bring HP to <= 33% MaxHP -> Phase 3 transition re-activates Glacial Shield
    boss.bossArmorShellActive = false;
    boss.bossArmorShellReduction = 0;
    sim.pendingBossSupplyDrops.length = 0;
    sim.props = sim.props.filter(
      (p) => p.kind !== 'glacial_barricade' && p.kind !== 'sliding_ice_block',
    );

    boss.hp = Math.floor(boss.maxHp * 0.33); // 1320
    sim.checkBossPhaseTransitions(boss);

    expect(boss.bossPhase).toBe(3);
    expect(boss.bossArmorPhase33Triggered).toBe(true);
    expect(boss.bossArmorShellActive).toBe(true);
    expect(boss.bossArmorShellReduction).toBeCloseTo(0.75, 5);
    expect(getBossArmorShellDamageMultiplier(boss)).toBeCloseTo(0.25, 5);
    expect(boss.aiState).toBe('telegraph');
    expect(sim.pendingBossSupplyDrops).toHaveLength(
      BOSS_MIN_BARRICADES + BOSS_MIN_BIOME_TOYS,
    );
  });

  it('Step 1: pressing [E] (flipCoverProp) flips glacial_barricade (coverState === "flipped") to block Kryssa kryssa_ice_beam projectiles aimed at the player behind the barricade and sets prop.cryoChargedByLaser = true', () => {
    const sim = createBiome2BossSim(9302);
    const boss = sim.getActiveBoss()!;
    boss.maxHp = 4000;
    boss.hp = 2640;
    boss.x = 580;
    boss.y = 320;
    boss.vx = 0;
    boss.vy = 0;
    boss.bossPhase = 2;
    boss.bossPhaseTransitionTimer = 0;

    // Remove other props & clones to isolate the Cryo Laser vs Flipped Glacial Barricade test
    sim.props.length = 0;
    sim.enemies = sim.enemies.filter((e) => e.id === boss.id);

    // Place player at (380, 320) and an unflipped glacial_barricade between player and Kryssa at (420, 320)
    const p1 = sim.player;
    p1.x = 380;
    p1.y = 320;
    p1.hp = p1.maxHp;
    p1.armor = p1.maxArmor;
    p1.invulnerableTimer = 0;
    p1.godMode = false;

    const barricade = sim.spawnProp('glacial_barricade', 420, 320);
    expect(barricade.coverState).toBe('low');
    expect(barricade.cryoChargedByLaser).toBeFalsy();

    // Player presses [E] (flipCoverProp) to flip the glacial_barricade
    expect(flipCoverProp(sim, barricade, p1)).toBe(true);
    expect(barricade.coverState).toBe('flipped');
    expect(barricade.blocksEnemyProjectiles).toBe(true);
    barricade.microBlankTimer = 0; // Test physical projectile collision blocking on the flipped barricade

    // Activate Kryssa's Glacial Shield & fire Extreme Cryo Laser (kryssa_ice_beam) aimed at player (angle = Math.PI)
    activateBossArmorShell(sim, boss, 0.75);
    boss.telegraphAngle = Math.PI;
    boss.aimAngle = Math.PI;
    boss.stateTimer = 0.01;
    boss.bossAttackCycle = 0;

    const playerHpBefore = p1.hp;
    const playerArmorBefore = p1.armor;

    // Step simulation so Kryssa fires kryssa_ice_beam and the laser travels into the flipped glacial_barricade
    for (let t = 0; t < 45; t++) {
      p1.x = 380;
      p1.y = 320;
      boss.x = 580;
      boss.y = 320;
      sim.step(SIM_STEP_SEC);
    }

    // Verify the flipped glacial_barricade blocked the laser, charged with cryo energy, and kept the player unharmed!
    expect(barricade.cryoChargedByLaser).toBe(true);
    expect(barricade.hp).toBeGreaterThan(0);
    expect(p1.hp).toBe(playerHpBefore);
    expect(p1.armor).toBe(playerArmorBefore);
  });

  it('Step 2: Dash-Kicking or Melee-Kicking glacial_barricade or sliding_ice_block into kryssa_ice_queen shatters Glacial Shield, deals 6% MaxHP true hazard damage, inflicts 3.0s Freeze/Stun, and applies +40% EnemyVuln (1.4x bullet damage)', () => {
    const sim = createBiome2BossSim(9303);
    const boss = sim.getActiveBoss()!;
    boss.maxHp = 4000;
    boss.hp = 2640;
    boss.x = 520;
    boss.y = 320;
    boss.vx = 0;
    boss.vy = 0;
    boss.bossPhase = 2;
    boss.bossPhaseTransitionTimer = 0;

    sim.enemies = sim.enemies.filter((e) => e.id === boss.id);
    sim.props.length = 0;

    // Case 1 (2-Step): Flip glacial_barricade, charge with laser, then Dash-Kick into kryssa_ice_queen
    activateBossArmorShell(sim, boss, 0.75);
    expect(boss.bossArmorShellActive).toBe(true);

    const barricade = sim.spawnProp('glacial_barricade', 455, 320);
    sim.flipCoverProp(barricade, sim.player);
    barricade.cryoChargedByLaser = true;

    sim.player.x = 420;
    sim.player.y = 320;
    sim.player.aimAngle = 0;
    expect(sim.kickProp(barricade, sim.player, 0)).toBe(true);

    const hpBeforeBarricadeBreak = boss.hp;
    const expectedHazardDmg = Math.round(0.06 * boss.maxHp); // 240
    sim.consumeEvents();

    for (let t = 0; t < 15; t++) {
      sim.step(SIM_STEP_SEC);
      if (!boss.bossArmorShellActive) break;
    }

    expect(boss.bossArmorShellActive).toBe(false);
    expect(boss.bossArmorShellReduction).toBe(0);
    expect(hpBeforeBarricadeBreak - boss.hp).toBe(expectedHazardDmg);
    expect(boss.aiState).toBe('stunned');
    expect(boss.stateTimer).toBe(3.0);
    expect(boss.stunTimer).toBeGreaterThanOrEqual(3.0);
    expect(boss.frozenTimer).toBeGreaterThanOrEqual(3.0);
    expect(boss.bossArmorBreakVulnTimer).toBe(3.0);
    expect(getBossArmorBreakVulnBonus(boss)).toBeCloseTo(0.4, 5);
    expect(boss.lastCombatText).toBe('CRYO SHIELD SHATTERED!');

    const breakEvents = sim.consumeEvents();
    expect(
      breakEvents.some(
        (ev) => ev.kind === 'armor_broken' && ev.targetId === boss.id,
      ),
    ).toBe(true);

    // Verify normal bullet damage during the 3.0s Armor Break window gets +40% EnemyVuln (100 * 1.4 = 140)
    const hpBeforeVulnShot = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    expect(hpBeforeVulnShot - boss.hp).toBe(140);

    // Step 3.0s (180 ticks) so the vulnerability window expires -> returns to 1.0x baseline damage
    for (let t = 0; t < 180; t++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(boss.bossArmorBreakVulnTimer).toBe(0);
    const hpAfterVulnExpired = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    expect(hpAfterVulnExpired - boss.hp).toBe(100);

    // Case 2 (1-Step): Re-activate Glacial Shield and Melee-Kick / Dash-Kick a sliding_ice_block directly into kryssa_ice_queen
    sim.props.length = 0;
    boss.x = 520;
    boss.y = 320;
    boss.vx = 0;
    boss.vy = 0;
    activateBossArmorShell(sim, boss, 0.75);
    expect(boss.bossArmorShellActive).toBe(true);

    const iceBlock = sim.spawnProp('sliding_ice_block', 455, 320);
    sim.player.x = 420;
    sim.player.y = 320;
    sim.player.aimAngle = 0;
    sim.player.weaponSlots = ['knight_sword', 'rivet_gun'];
    sim.player.activeWeaponSlot = 0;
    sim.player.fireCooldownTimer = 0;

    const hpBeforeIceBlockBreak = boss.hp;
    sim.consumeEvents();

    // Melee swing kicks the sliding_ice_block into kryssa_ice_queen
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

    expect(iceBlock.hp).toBe(0);
    expect(boss.bossArmorShellActive).toBe(false);
    expect(boss.bossArmorShellReduction).toBe(0);
    expect(hpBeforeIceBlockBreak - boss.hp).toBe(expectedHazardDmg);
    expect(boss.aiState).toBe('stunned');
    expect(boss.stateTimer).toBe(3.0);
    expect(boss.stunTimer).toBeGreaterThanOrEqual(3.0);
    expect(boss.frozenTimer).toBeGreaterThanOrEqual(3.0);
    expect(boss.bossArmorBreakVulnTimer).toBe(3.0);
    expect(boss.lastCombatText).toBe('CRYO SHIELD SHATTERED!');
    expect(typeof triggerBossArmorBreak).toBe('function');
    expect(typeof tryBreakBossArmorWithKickedProp).toBe('function');
  });
});
