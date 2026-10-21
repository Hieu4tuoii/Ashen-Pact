import { describe, expect, it } from 'vitest';
import {
  BIOME_SCALING,
  CHARACTERS,
  COOP_SCALING,
  ENEMIES,
  SIM_STEP_SEC,
  WorldSim,
  generateDungeonFloor,
} from '../src/index.js';
import {
  computeBossSoftEnrageScale,
  computeMusicIntensityBoost,
  computeRemainingEnemiesText,
  computeWaveBannerSpec,
  formatSettingsToastMessage,
} from '../../../apps/client/src/scenes/game-scene/p11-drama-hud.js';

describe('Phase P11 — Step 2: Data-Driven Difficulty Levers, Boss Drama & Presentation', () => {
  it('fixes co-op fire rate double-application so attackCooldownTimer decrements by dtSec once', () => {
    const sim1P = new WorldSim({
      seed: 1101,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
      playerCount: 1,
    });
    const sim4P = new WorldSim({
      seed: 1101,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
      playerCount: 4,
    });

    const scale1P = sim1P.getEnemyCooldownScale(false);
    const scale4P = sim4P.getEnemyCooldownScale(false);
    const expectedRatio = 1 / (1 + COOP_SCALING[4].enemyFireRateBonus);
    expect(scale4P / scale1P).toBeCloseTo(expectedRatio, 4);

    // Spawn an enemy and set attackCooldownTimer to 1.0s; after 1 tick it must decrement by SIM_STEP_SEC (not divided by coopCdScale again)
    const e4 = sim4P.spawnEnemy('goblin_shooter', sim4P.player.x + 250, sim4P.player.y, true);
    e4.attackCooldownTimer = 1.0;
    sim4P.step(SIM_STEP_SEC);
    expect(e4.attackCooldownTimer).toBeCloseTo(1.0 - SIM_STEP_SEC, 4);
  });

  it('defines BIOME_SCALING for Biome 1/2/3 and scales normal/elite enemies without inflating kryssa_clone above 30 HP', () => {
    expect(BIOME_SCALING[1]).toBeDefined();
    expect(BIOME_SCALING[2]).toBeDefined();
    expect(BIOME_SCALING[3]).toBeDefined();

    expect(BIOME_SCALING[2].hpMultiplier).toBeGreaterThan(BIOME_SCALING[1].hpMultiplier);
    expect(BIOME_SCALING[3].hpMultiplier).toBeGreaterThan(BIOME_SCALING[2].hpMultiplier);
    expect(BIOME_SCALING[2].cooldownScale).toBeLessThan(BIOME_SCALING[1].cooldownScale);
    expect(BIOME_SCALING[3].cooldownScale).toBeLessThan(BIOME_SCALING[2].cooldownScale);

    const simB2 = new WorldSim({
      seed: 1102,
      biome: 2,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });
    const clone = simB2.spawnEnemy('kryssa_clone', 300, 300, true);
    expect(clone.maxHp).toBeLessThanOrEqual(30);

    const eliteB2 = simB2.spawnEnemy('ice_mage', 340, 300, true, 'fast');
    expect(eliteB2.damage).toBeGreaterThan(ENEMIES.ice_mage.damage);
  });

  it('generates 10 rooms per floor with 4 combat rooms (including 1 Challenge Room) and preserves rooms 0..8 layout', () => {
    const floor1 = generateDungeonFloor(4242, 1, 1, 1);
    expect(floor1.rooms.length).toBe(10);

    const combatRooms = floor1.rooms.filter((r) => r.type === 'combat');
    expect(combatRooms.length).toBe(4);

    const challengeRooms = combatRooms.filter((r) => r.isChallenge);
    expect(challengeRooms.length).toBe(1);
    const challenge = challengeRooms[0]!;
    expect(challenge.id).toBe(9);
    expect(challenge.wavesTotal).toBe(3);
    expect(challenge.chestRarity).toBe('epic');
    for (const wave of challenge.waves) {
      expect(wave.enemies.some((sp) => sp.isElite)).toBe(true);
    }

    const floor2 = generateDungeonFloor(4242, 2, 1, 1);
    const challenge2 = floor2.rooms.find((r) => r.isChallenge)!;
    expect(challenge2.chestRarity).toBe('legendary');

    // Shop prices tightened
    const shop1 = floor1.rooms.find((r) => r.type === 'merchant')!;
    const byKind1 = Object.fromEntries(shop1.shopOffers.map((it) => [it.kind, it.costGold]));
    expect(byKind1.health_potion).toBe(25);
    expect(byKind1.weapon).toBe(40);
    expect(byKind1.armor_upgrade).toBe(45);

    const shop2 = floor2.rooms.find((r) => r.type === 'merchant')!;
    const byKind2 = Object.fromEntries(shop2.shopOffers.map((it) => [it.kind, it.costGold]));
    expect(byKind2.weapon).toBe(60);
  });

  it('triggers overlapping wave early when <= 25% of current wave remains or after 12s (capped at 2 active waves)', () => {
    const sim = new WorldSim({
      seed: 2026,
      spawnInitialWave: false,
      includeTrainingDummy: false,
    });
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat' && !r.isChallenge)!;
    sim.enterRoom(combatRoom.id);

    expect(combatRoom.wavesSpawned).toBe(1);
    const wave1Enemies = sim.enemies.filter((e) => !e.isDummy && e.waveIndex === 1);
    expect(wave1Enemies.length).toBeGreaterThanOrEqual(4);

    // Advance 2.0s so waveElapsedSec >= 1.5s
    for (let i = 0; i < 120; i++) {
      sim.step(SIM_STEP_SEC);
    }

    // Kill all but 1 enemy (1 / 4 = 25% <= 25%)
    for (let i = 1; i < wave1Enemies.length; i++) {
      const e = wave1Enemies[i]!;
      sim.applyDamageToEnemy(e, e.hp + 999, false, 'none', 0, 0);
    }
    sim.consumeEvents();
    sim.step(SIM_STEP_SEC);

    expect(combatRoom.wavesSpawned).toBe(2);
    const events = sim.consumeEvents();
    expect(events.some((ev) => ev.kind === 'wave_started' && ev.waveIndex === 2)).toBe(true);
    const wave2Enemies = sim.enemies.filter((e) => !e.isDummy && e.waveIndex === 2);
    expect(wave2Enemies.length).toBeGreaterThan(0);
    expect(wave2Enemies[0]!.aiState).toBe('spawning');
    expect(wave2Enemies[0]!.stateTimer).toBeGreaterThan(0.5);
  });

  it('supports new Elite modifiers volley (+2 fan projectiles) and vengeful (0.5s telegraph ring -> 8 slow projectiles on death)', () => {
    const sim = new WorldSim({
      seed: 3030,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });

    // 1. Volley elite fires 2 extra projectiles compared to normal shooter
    const normalShooter = sim.spawnEnemy('goblin_shooter', sim.player.x + 180, sim.player.y, true);
    normalShooter.aiState = 'telegraph';
    normalShooter.stateTimer = SIM_STEP_SEC * 0.5;
    sim.step(SIM_STEP_SEC);
    const normalProjCount = sim.projectiles.filter((p) => p.ttlSec > 0 && p.team === 'enemy').length;
    sim.projectiles.length = 0;
    sim.enemies.length = 0;

    const volleyShooter = sim.spawnEnemy(
      'goblin_shooter',
      sim.player.x + 180,
      sim.player.y,
      true,
      'volley',
    );
    volleyShooter.aiState = 'telegraph';
    volleyShooter.stateTimer = SIM_STEP_SEC * 0.5;
    sim.step(SIM_STEP_SEC);
    const volleyProjCount = sim.projectiles.filter((p) => p.ttlSec > 0 && p.team === 'enemy').length;
    expect(volleyProjCount).toBe(normalProjCount + 2);

    // 2. Vengeful elite schedules a 0.5s ring on death and fires 8 slow radial bullets
    sim.projectiles.length = 0;
    sim.enemies.length = 0;
    const vengefulEnemy = sim.spawnEnemy('goblin_shooter', 400, 400, true, 'vengeful');
    sim.consumeEvents();
    sim.applyDamageToEnemy(vengefulEnemy, vengefulEnemy.hp + 999, false, 'none', 0, 0);

    const deathEvents = sim.consumeEvents();
    expect(deathEvents.some((ev) => ev.kind === 'vengeful_telegraph')).toBe(true);
    expect(sim.pendingVengefulRings.length).toBe(1);
    expect(sim.projectiles.filter((p) => p.ttlSec > 0 && p.team === 'enemy').length).toBe(0);

    for (let i = 0; i < 32; i++) {
      sim.step(SIM_STEP_SEC);
    }
    const ringProjectiles = sim.projectiles.filter((p) => p.ttlSec > 0 && p.team === 'enemy');
    expect(ringProjectiles.length).toBe(8);
    for (const p of ringProjectiles) {
      expect(Math.hypot(p.vx, p.vy)).toBeLessThanOrEqual(165);
    }
  });

  it('tightens armorRegenDelaySec (+0.5s) and revives downed co-op allies at 35% HP on room clear', () => {
    expect(CHARACTERS.vanguard.armorRegenDelaySec).toBeCloseTo(3.3, 2);
    expect(CHARACTERS.ranger.armorRegenDelaySec).toBeCloseTo(4.0, 2);
    expect(CHARACTERS.elementalist.armorRegenDelaySec).toBeCloseTo(4.0, 2);
    expect(CHARACTERS.druid.armorRegenDelaySec).toBeCloseTo(4.0, 2);
    expect(CHARACTERS.engineer.armorRegenDelaySec).toBeCloseTo(4.0, 2);

    const sim = new WorldSim({
      seed: 4040,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      coopMode: true,
      playerCount: 2,
    });
    const p2 = sim.addCoopPlayer(2, 2, 'ranger', 'P2');
    const combatRoom = sim.dungeon.rooms.find((r) => r.type === 'combat' && !r.isChallenge)!;
    sim.enterRoom(combatRoom.id);

    p2.lifeState = 'ghost';
    p2.hp = 0;

    // Force final wave and kill all enemies to trigger room clear
    combatRoom.wavesSpawned = combatRoom.wavesTotal;
    for (const e of [...sim.enemies]) {
      if (!e.isDummy) {
        sim.applyDamageToEnemy(e, e.hp + 9999, false, 'none', 0, 0);
      }
    }
    sim.step(SIM_STEP_SEC);

    expect(combatRoom.cleared).toBe(true);
    expect(p2.lifeState).toBe('alive');
    expect(p2.hp).toBe(Math.max(2, Math.ceil(p2.maxHp * 0.35)));
  });

  it('enforces Boss CC resistance, 1.2s phase transition invulnerability + bullet clear + opener, and Soft Enrage after 90s', () => {
    const sim = new WorldSim({
      seed: 5050,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      autoRespawnWaves: false,
    });
    const boss = sim.spawnEnemy('spore_king', 450, 450, true);

    // 1. Freeze CC diminishing returns within 8s window: 0.6s -> 0.3s -> 0.15s
    boss.chillStacks = 2;
    sim.applyElementStatusToEnemy(boss, 'chill', 5);
    expect(boss.frozenTimer).toBeCloseTo(0.6, 2);
    boss.frozenTimer = 0;

    boss.chillStacks = 2;
    sim.applyElementStatusToEnemy(boss, 'chill', 5);
    expect(boss.frozenTimer).toBeCloseTo(0.3, 2);
    boss.frozenTimer = 0;

    boss.chillStacks = 2;
    sim.applyElementStatusToEnemy(boss, 'chill', 5);
    expect(boss.frozenTimer).toBeCloseTo(0.15, 2);
    boss.frozenTimer = 0;

    // 2. Phase transition at <= 66% HP: 1.2s invulnerable, clears bullets within 280u, queues signature opener
    sim.projectiles.push(
      sim.acquireProjectile({
        id: 99001,
        ownerId: sim.player.id,
        x: boss.x + 80,
        y: boss.y,
        vx: 100,
        vy: 0,
        radius: 6,
        damage: 4,
        ttlSec: 2,
        isCrit: false,
        team: 'player',
        weaponId: 'hunter_crossbow',
        angle: 0,
        knockback: 0,
        pierceRemaining: 0,
        bounceRemaining: 0,
        element: 'none',
        amplifiedByShield: false,
      }),
    );
    const dmgToPhase2 = Math.ceil(boss.maxHp * 0.36);
    sim.applyDamageToEnemy(boss, dmgToPhase2, false, 'none', 0, 0);

    expect(boss.bossPhase).toBe(2);
    expect(boss.bossPhaseTransitionTimer).toBeCloseTo(1.2, 2);
    expect(boss.aiState).toBe('telegraph');
    expect(sim.projectiles.length).toBe(0);

    // Invulnerable to normal damage while bossPhaseTransitionTimer > 0
    const hpDuringTransition = boss.hp;
    sim.applyDamageToEnemy(boss, 50, false, 'none', 0, 0);
    expect(boss.hp).toBe(hpDuringTransition);

    // 3. Phase 3 Boss telegraph is NOT interrupted by paralysis elemental reaction
    boss.bossPhaseTransitionTimer = 0;
    boss.bossPhase = 3;
    boss.aiState = 'telegraph';
    boss.stateTimer = 0.7;
    boss.shockTimer = 3.0;
    sim.applyElementStatusToEnemy(boss, 'poison', 5); // triggers paralysis
    expect(boss.aiState).toBe('telegraph');

    // 4. Soft Enrage after 90s: cooldown scale multiplies by 0.93 every 15s down to 0.75
    boss.bossCombatElapsedSec = 89.95;
    boss.bossEnrageLevel = 0;
    sim.consumeEvents();
    sim.step(0.1);
    expect(boss.bossEnrageLevel).toBe(1);
    const enrageEvents = sim.consumeEvents();
    expect(enrageEvents.some((ev) => ev.kind === 'boss_enraged' && ev.enrageLevel === 1)).toBe(
      true,
    );
  });

  it('computes pure HUD and audio helpers in p11-drama-hud.ts accurately', () => {
    expect(computeBossSoftEnrageScale(60)).toBeCloseTo(1.0, 4);
    expect(computeBossSoftEnrageScale(90)).toBeCloseTo(0.93, 4);
    expect(computeBossSoftEnrageScale(105)).toBeCloseTo(0.93 * 0.93, 4);
    expect(computeBossSoftEnrageScale(300)).toBeCloseTo(0.75, 4);

    const bannerNormal = computeWaveBannerSpec(2, 3, false);
    expect(bannerNormal.titleVi).toContain('ĐỢT 2/3');
    const bannerChallenge = computeWaveBannerSpec(1, 3, true);
    expect(bannerChallenge.titleVi).toContain('THỬ THÁCH');

    expect(computeRemainingEnemiesText(5, 2, 3)).toContain('5');
    expect(computeMusicIntensityBoost(0.2, 2, 3)).toBeGreaterThan(0.5);
    expect(formatSettingsToastMessage('fullscreen', 'Toàn màn hình: BẬT')).toContain(
      'Toàn màn hình',
    );
  });
});
