import { describe, expect, it } from 'vitest';
import {
  BOSS_MIN_BARRICADES,
  BOSS_MIN_BIOME_TOYS,
  INPUT_BUTTON,
  WorldSim,
  activateBossArmorShell,
  checkSporeKingPillarCrash,
  getBossArmorBreakVulnBonus,
  getBossArmorShellDamageMultiplier,
  triggerBossArmorBreak,
  tryBreakBossArmorWithKickedProp,
} from '../src/index.js';

const SIM_STEP_SEC = 1 / 60;

function createBiome1BossSim(seed = 9201): WorldSim {
  const sim = new WorldSim({
    seed,
    biome: 1,
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

describe('AP2 Phase P3B.2 — Biome 1 Boss spore_king (Mục Vương Nấm Độc — 1-Step Visual Armor Break)', () => {
  it('activates Reinforced Spore Carapace (bossArmorShellActive = true, 70% damage reduction -> x0.30, Supply Drop, charge telegraph) at <= 66% MaxHP (Phase 2) and <= 33% MaxHP (Phase 3)', () => {
    const sim = createBiome1BossSim(9201);
    const boss = sim.getActiveBoss()!;
    expect(boss).toBeDefined();
    expect(boss.defId).toBe('spore_king');

    boss.maxHp = 3000;
    boss.hp = 3000;
    boss.bossPhase = 1;
    boss.bossPhaseTransitionTimer = 0;

    // Clear tactical props in room to verify immediate Boss Supply Drop on shell activation
    sim.props = sim.props.filter(
      (p) => p.kind !== 'moss_table' && p.kind !== 'volatile_spore_pod',
    );
    sim.pendingBossSupplyDrops.length = 0;

    // Measure baseline bullet damage before armor shell is active
    const hpBeforeBaseline = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    const baselineDmg = hpBeforeBaseline - boss.hp;
    expect(baselineDmg).toBe(100);
    expect(getBossArmorShellDamageMultiplier(boss)).toBe(1.0);

    // 1. Damage spore_king to <= 66% MaxHP -> Phase 2 transition activates Reinforced Spore Carapace
    boss.hp = Math.floor(boss.maxHp * 0.66); // 1980
    sim.checkBossPhaseTransitions(boss);

    expect(boss.bossPhase).toBe(2);
    expect(boss.bossArmorPhase66Triggered).toBe(true);
    expect(boss.bossArmorShellActive).toBe(true);
    expect(boss.bossArmorShellReduction).toBeCloseTo(0.7, 5);
    expect(getBossArmorShellDamageMultiplier(boss)).toBeCloseTo(0.3, 5);
    expect(boss.aiState).toBe('telegraph');
    expect(sim.pendingBossSupplyDrops).toHaveLength(
      BOSS_MIN_BARRICADES + BOSS_MIN_BIOME_TOYS,
    );

    // Clear transition invulnerability timer to verify 70% bullet damage reduction (100 * 0.30 = 30)
    boss.bossPhaseTransitionTimer = 0;
    const hpBeforeShellHit = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    const shellDmg = hpBeforeShellHit - boss.hp;
    expect(shellDmg).toBe(Math.round(baselineDmg * 0.3));

    // Break Phase 2 shell, then bring HP to <= 33% MaxHP -> Phase 3 transition re-activates shell
    boss.bossArmorShellActive = false;
    boss.bossArmorShellReduction = 0;
    sim.pendingBossSupplyDrops.length = 0;
    sim.props = sim.props.filter(
      (p) => p.kind !== 'moss_table' && p.kind !== 'volatile_spore_pod',
    );

    boss.hp = Math.floor(boss.maxHp * 0.33); // 990
    sim.checkBossPhaseTransitions(boss);

    expect(boss.bossPhase).toBe(3);
    expect(boss.bossArmorPhase33Triggered).toBe(true);
    expect(boss.bossArmorShellActive).toBe(true);
    expect(boss.bossArmorShellReduction).toBeCloseTo(0.7, 5);
    expect( boss.aiState ).toBe('telegraph');
    expect(sim.pendingBossSupplyDrops).toHaveLength(
      BOSS_MIN_BARRICADES + BOSS_MIN_BIOME_TOYS,
    );
  });

  it('supports 1-Step Armor Break via Dash-Kicking or Melee-Kicking moss_table or volatile_spore_pod into spore_king (shatters shell, 6% MaxHP true damage, 3.5s stun, +40% EnemyVuln -> 1.4x bullet damage)', () => {
    const sim = createBiome1BossSim(9202);
    const boss = sim.getActiveBoss()!;
    boss.maxHp = 3000;
    boss.hp = 1980;
    boss.x = 520;
    boss.y = 320;
    boss.vx = 0;
    boss.vy = 0;
    boss.bossPhase = 2;
    boss.bossPhaseTransitionTimer = 0;
    activateBossArmorShell(sim, boss, 0.7);
    expect(boss.bossArmorShellActive).toBe(true);

    // Case A1: Player Dash-Kicks a moss_table into spore_king
    sim.player.x = 430;
    sim.player.y = 320;
    sim.player.aimAngle = 0;
    const table = sim.spawnProp('moss_table', 462, 320);
    sim.flipCoverProp(table, sim.player);
    expect(sim.kickProp(table, sim.player, 0)).toBe(true);

    const hpBeforeTableBreak = boss.hp;
    const expectedHazardDmg = Math.round(0.06 * boss.maxHp); // 180
    sim.consumeEvents();

    for (let t = 0; t < 15; t++) {
      sim.step(SIM_STEP_SEC);
      if (!boss.bossArmorShellActive) break;
    }

    expect(boss.bossArmorShellActive).toBe(false);
    expect(boss.bossArmorShellReduction).toBe(0);
    expect(hpBeforeTableBreak - boss.hp).toBe(expectedHazardDmg);
    expect(boss.aiState).toBe('stunned');
    expect(boss.stunTimer).toBe(3.5);
    expect(boss.bossArmorBreakVulnTimer).toBe(3.5);
    expect(getBossArmorBreakVulnBonus(boss)).toBeCloseTo(0.4, 5);
    expect(boss.lastCombatText).toBe('SPORE SHELL SHATTERED!');

    const breakEvents = sim.consumeEvents();
    expect(
      breakEvents.some(
        (ev) => ev.kind === 'armor_broken' && ev.targetId === boss.id,
      ),
    ).toBe(true);

    // Verify shooting spore_king during the 3.5s vulnerability window deals 1.4x damage vs baseline
    const hpBeforeVulnShot = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    const vulnShotDmg = hpBeforeVulnShot - boss.hp;
    expect(vulnShotDmg).toBe(140);

    // Step 3.5s (210 ticks) so the vulnerability window expires -> returns to 1.0x baseline damage
    for (let t = 0; t < 210; t++) {
      sim.step(SIM_STEP_SEC);
    }
    expect(boss.bossArmorBreakVulnTimer).toBe(0);
    const hpAfterVulnExpired = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    expect(hpAfterVulnExpired - boss.hp).toBe(100);

    // Case A2: Re-activate shell (Phase 3) and Melee-Kick / Dash-Kick a volatile_spore_pod into spore_king
    boss.x = 520;
    boss.y = 320;
    boss.vx = 0;
    boss.vy = 0;
    activateBossArmorShell(sim, boss, 0.7);
    expect(boss.bossArmorShellActive).toBe(true);

    const pod = sim.spawnProp('volatile_spore_pod', 455, 320);
    sim.player.x = 420;
    sim.player.y = 320;
    sim.player.aimAngle = 0;
    sim.player.weaponSlots = ['knight_sword', 'rivet_gun'];
    sim.player.activeWeaponSlot = 0;
    sim.player.fireCooldownTimer = 0;

    const hpBeforePodBreak = boss.hp;
    // Melee attack kicks the volatile_spore_pod into spore_king
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

    expect(boss.bossArmorShellActive).toBe(false);
    expect(boss.bossArmorShellReduction).toBe(0);
    expect(hpBeforePodBreak - boss.hp).toBe(expectedHazardDmg);
    expect(boss.aiState).toBe('stunned');
    expect(boss.stunTimer).toBe(3.5);
    expect(boss.bossArmorBreakVulnTimer).toBe(3.5);
    expect(typeof tryBreakBossArmorWithKickedProp).toBe('function');
  });

  it('supports 1-Step Armor Break when baiting spore_king charge into an intact rotten_totem_pillar (pillar collapses, shatters shell, 6% MaxHP true damage, 3.5s stun, +40% EnemyVuln)', () => {
    const sim = createBiome1BossSim(9203);
    const boss = sim.getActiveBoss()!;
    boss.maxHp = 3000;
    boss.hp = 1980;
    boss.x = 420;
    boss.y = 320;
    boss.bossPhase = 2;
    boss.bossPhaseTransitionTimer = 0;

    // Place player behind an intact rotten_totem_pillar to bait spore_king's charge
    const pillar = sim.spawnProp('rotten_totem_pillar', 485, 320);
    expect(pillar.state).not.toBe('broken');
    expect(pillar.hp).toBeGreaterThan(0);

    sim.player.x = 560;
    sim.player.y = 320;

    activateBossArmorShell(sim, boss, 0.7);
    expect(boss.bossArmorShellActive).toBe(true);
    expect(boss.aiState).toBe('telegraph');

    // Finish telegraph so spore_king charges along +X into the rotten_totem_pillar
    boss.stateTimer = 0.01;
    boss.telegraphAngle = 0;
    const hpBeforePillarCrash = boss.hp;
    const expectedHazardDmg = Math.round(0.06 * boss.maxHp); // 180

    for (let t = 0; t < 30; t++) {
      sim.step(SIM_STEP_SEC);
      if (!boss.bossArmorShellActive) break;
    }

    expect(pillar.state).toBe('broken');
    expect(pillar.coverState).toBe('fallen');
    expect(pillar.hp).toBe(0);
    expect(boss.bossArmorShellActive).toBe(false);
    expect(boss.bossArmorShellReduction).toBe(0);
    expect(hpBeforePillarCrash - boss.hp).toBe(expectedHazardDmg);
    expect(boss.aiState).toBe('stunned');
    expect(boss.stunTimer).toBe(3.5);
    expect(boss.bossArmorBreakVulnTimer).toBe(3.5);

    // Confirm +40% EnemyVuln (1.4x bullet damage) during the pillar-crash stun window
    const hpBeforeShot = boss.hp;
    sim.applyDamageToEnemy(boss, 100, false, 'none', 0, 0, false, sim.player.id);
    expect(hpBeforeShot - boss.hp).toBe(140);
    expect(typeof checkSporeKingPillarCrash).toBe('function');
    expect(typeof triggerBossArmorBreak).toBe('function');
  });
});
