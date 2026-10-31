import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  INPUT_BUTTON,
  NetworkTransport,
  WEAPONS,
  WorldSim,
  enLocale,
  encodeWorldSnapshot,
  viLocale,
} from '../src/index.js';

describe('AP2 P0A.1 — Energy Purge, Weapon Cadence Metadata & Replacement Mechanics', () => {
  it('purges energy from CHARACTERS and sets Vanguard armorRegenDelaySec to 3.0s', () => {
    for (const char of Object.values(CHARACTERS)) {
      expect('energy' in char).toBe(false);
    }
    expect(CHARACTERS.vanguard.armorRegenDelaySec).toBe(3.0);
    expect(CHARACTERS.vanguard.passiveDescriptionVi.toLowerCase()).not.toContain('năng lượng');
    expect(CHARACTERS.ranger.skill.descriptionVi.toLowerCase()).not.toContain('năng lượng');
    expect(CHARACTERS.ranger.skill.synergyVi?.toLowerCase()).not.toContain('năng lượng');
    expect(CHARACTERS.elementalist.skill.synergyVi?.toLowerCase()).not.toContain('năng lượng');
  });

  it('purges orphaned tooltip.energyCost key from both en.json and vi.json i18n dictionaries', () => {
    expect('energyCost' in enLocale.ui.tooltip).toBe(false);
    expect('energyCost' in viLocale.ui.tooltip).toBe(false);
  });

  it('purges energyCost from WEAPONS and populates Spec Rev 4 Table 3.3 cadence metadata', () => {
    for (const w of Object.values(WEAPONS)) {
      expect('energyCost' in w).toBe(false);
      expect(['CLIP_RELOAD', 'HEAT_VENT', 'MELEE_COMBO']).toContain(w.cadenceKind);
      expect(typeof w.clipSize).toBe('number');
      expect(typeof w.reloadDurationSec).toBe('number');
      expect(typeof w.heatPerShot).toBe('number');
      expect(w.procCoefficient).toBeGreaterThan(0);
    }

    const expectedTable: Record<
      string,
      {
        cadenceKind: 'CLIP_RELOAD' | 'HEAT_VENT' | 'MELEE_COMBO';
        clipSize: number;
        reloadDurationSec: number;
        heatPerShot: number;
        procCoefficient: number;
      }
    > = {
      knight_sword: {
        cadenceKind: 'MELEE_COMBO',
        clipSize: 0,
        reloadDurationSec: 0,
        heatPerShot: 0,
        procCoefficient: 0.8,
      },
      hunter_crossbow: {
        cadenceKind: 'CLIP_RELOAD',
        clipSize: 4,
        reloadDurationSec: 0.95,
        heatPerShot: 0,
        procCoefficient: 1.0,
      },
      apprentice_staff: {
        cadenceKind: 'HEAT_VENT',
        clipSize: 0,
        reloadDurationSec: 0,
        heatPerShot: 14,
        procCoefficient: 0.75,
      },
      thorn_staff: {
        cadenceKind: 'CLIP_RELOAD',
        clipSize: 5,
        reloadDurationSec: 1.0,
        heatPerShot: 0,
        procCoefficient: 0.75,
      },
      rivet_gun: {
        cadenceKind: 'CLIP_RELOAD',
        clipSize: 6,
        reloadDurationSec: 0.9,
        heatPerShot: 0,
        procCoefficient: 0.55,
      },
      scrap_shotgun: {
        cadenceKind: 'CLIP_RELOAD',
        clipSize: 2,
        reloadDurationSec: 0.85,
        heatPerShot: 0,
        procCoefficient: 0.22,
      },
      gale_smg: {
        cadenceKind: 'HEAT_VENT',
        clipSize: 0,
        reloadDurationSec: 0,
        heatPerShot: 3.0,
        procCoefficient: 0.25,
      },
      frag_launcher: {
        cadenceKind: 'CLIP_RELOAD',
        clipSize: 3,
        reloadDurationSec: 1.1,
        heatPerShot: 0,
        procCoefficient: 0.65,
      },
      tesla_carbine: {
        cadenceKind: 'CLIP_RELOAD',
        clipSize: 8,
        reloadDurationSec: 1.0,
        heatPerShot: 0,
        procCoefficient: 0.6,
      },
      seed_gun: {
        cadenceKind: 'CLIP_RELOAD',
        clipSize: 4,
        reloadDurationSec: 1.0,
        heatPerShot: 0,
        procCoefficient: 0.8,
      },
      tether_staff: {
        cadenceKind: 'HEAT_VENT',
        clipSize: 0,
        reloadDurationSec: 0,
        heatPerShot: 5.5,
        procCoefficient: 0.28,
      },
      focus_laser: {
        cadenceKind: 'HEAT_VENT',
        clipSize: 0,
        reloadDurationSec: 0,
        heatPerShot: 4.5,
        procCoefficient: 0.25,
      },
      emerald_cleaver: {
        cadenceKind: 'MELEE_COMBO',
        clipSize: 0,
        reloadDurationSec: 0,
        heatPerShot: 0,
        procCoefficient: 0.85,
      },
      void_staff: {
        cadenceKind: 'CLIP_RELOAD',
        clipSize: 2,
        reloadDurationSec: 1.05,
        heatPerShot: 0,
        procCoefficient: 1.0,
      },
      berserker_axe: {
        cadenceKind: 'MELEE_COMBO',
        clipSize: 0,
        reloadDurationSec: 0,
        heatPerShot: 0,
        procCoefficient: 0.8,
      },
      solar_archon_staff: {
        cadenceKind: 'HEAT_VENT',
        clipSize: 0,
        reloadDurationSec: 0,
        heatPerShot: 12,
        procCoefficient: 0.65,
      },
      magma_cannon: {
        cadenceKind: 'CLIP_RELOAD',
        clipSize: 3,
        reloadDurationSec: 1.25,
        heatPerShot: 0,
        procCoefficient: 1.0,
      },
      thunder_hammer: {
        cadenceKind: 'MELEE_COMBO',
        clipSize: 0,
        reloadDurationSec: 0,
        heatPerShot: 0,
        procCoefficient: 0.9,
      },
    };

    for (const [id, expected] of Object.entries(expectedTable)) {
      const w = WEAPONS[id];
      expect(w, `missing weapon ${id}`).toBeDefined();
      expect(w?.cadenceKind).toBe(expected.cadenceKind);
      expect(w?.clipSize).toBe(expected.clipSize);
      expect(w?.reloadDurationSec).toBeCloseTo(expected.reloadDurationSec, 3);
      expect(w?.heatPerShot).toBeCloseTo(expected.heatPerShot, 3);
      expect(w?.procCoefficient).toBeCloseTo(expected.procCoefficient, 3);
    }
  });

  it('initializes SimPlayerState with weapon cadence fields and without energy fields', () => {
    const sim = new WorldSim({ seed: 101, spawnInitialWave: false, includeProps: false });
    const p = sim.player;

    expect('energy' in p).toBe(false);
    expect('maxEnergy' in p).toBe(false);
    expect('energyRegenDelayTimer' in p).toBe(false);
    expect('energyRegenAccum' in p).toBe(false);

    expect(p.clipAmmo).toBe(0);
    expect(p.clipMax).toBe(0);
    expect(p.reloadTimer).toBe(0);
    expect(p.reloadDuration).toBe(0);
    expect(p.reloadLockout).toBe(false);
    expect(p.overclockedNextShot).toBe(false);
    expect(p.weaponHeat).toBe(0);
    expect(p.overheatLockTimer).toBe(0);
    expect(p.meleeComboStep).toBe(0);
    expect(p.meleeComboResetTimer).toBe(0);
    expect(p.meleeParryWindowTimer).toBe(0);
    expect(Array.isArray(p.holsterReloadTimers)).toBe(true);
    expect(p.vanguardShieldBonusAdd).toBe(0);
    expect(p.elementalConvergenceTimer).toBe(0);

    sim.selectCharacter(p.id, 'ranger');
    expect(p.clipMax).toBe(4);
    expect(p.clipAmmo).toBe(4);
    expect(p.reloadDuration).toBeCloseTo(0.95, 3);
  });

  it('grants Vanguard shield bullet block +1 clipAmmo (or -15 heat) and +15% additive damage (up to +75%) consumed on next attack', () => {
    const sim = new WorldSim({
      seed: 202,
      spawnInitialWave: false,
      includeProps: false,
      includeTrainingDummy: false,
    });
    const p = sim.player;
    sim.selectCharacter(p.id, 'vanguard');
    p.x = 300;
    p.y = 300;
    p.aimAngle = 0;

    // Give Vanguard a CLIP_RELOAD weapon in active slot with partially depleted clip
    p.weaponSlots[0] = 'hunter_crossbow';
    p.activeWeaponSlot = 0;
    p.clipMax = 4;
    p.clipAmmo = 1;
    p.skillActiveTimer = 3.0;

    // Spawn 6 enemy bullets flying into Vanguard's shield
    for (let i = 0; i < 6; i++) {
      const b = sim.acquireProjectile({
        id: ++sim.nextEntityId,
        ownerId: 999,
        team: 'enemy',
        weaponId: 'goblin_bow',
        x: p.x + 28,
        y: p.y,
        vx: -120,
        vy: 0,
        angle: Math.PI,
        radius: 5,
        damage: 1,
        isCrit: false,
        knockback: 10,
        pierceRemaining: 0,
        bounceRemaining: 0,
        ttlSec: 1.0,
        element: 'none',
        amplifiedByShield: false,
      });
      sim.projectiles.push(b);
    }

    sim.updateProjectiles(1 / 60);

    expect(p.clipAmmo).toBe(4); // refilled +1 per bullet up to clipMax=4
    expect(p.vanguardShieldBonusAdd).toBeCloseTo(0.75, 4); // capped at +75% (5 bullets)

    // Also verify HEAT_VENT weapon heat reduction when blocking with shield
    p.weaponSlots[0] = 'apprentice_staff';
    p.weaponHeat = 40;
    const heatBullet = sim.acquireProjectile({
      id: ++sim.nextEntityId,
      ownerId: 999,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: p.x + 28,
      y: p.y,
      vx: -120,
      vy: 0,
      angle: Math.PI,
      radius: 5,
      damage: 1,
      isCrit: false,
      knockback: 10,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 1.0,
      element: 'none',
      amplifiedByShield: false,
    });
    sim.projectiles.push(heatBullet);
    sim.updateProjectiles(1 / 60);
    expect(p.weaponHeat).toBe(25); // 40 - 15 = 25

    // Now fire ranged weapon and verify vanguardShieldBonusAdd (+75%) amplifies damage and resets to 0
    p.skillActiveTimer = 0; // turn off shield +30% boost to isolate vanguardShieldBonusAdd
    p.weaponSlots[0] = 'hunter_crossbow';
    p.fireCooldownTimer = 0;
    sim.tryFireActiveWeapon(p);

    expect(p.vanguardShieldBonusAdd).toBe(0);
    const volleyEv = sim.events.find((e) => e.kind === 'bullet_volley_spawned');
    expect(volleyEv).toBeDefined();
    if (volleyEv && volleyEv.kind === 'bullet_volley_spawned') {
      expect(volleyEv.damage).toBe(Math.round(WEAPONS.hunter_crossbow!.damage * 1.75));
    }
  });

  it('spawns prey_emblem on killing a Marked enemy and grants Overclocked full reload / 0% heat + -2.0s skill cooldown on pickup', () => {
    const sim = new WorldSim({
      seed: 303,
      spawnInitialWave: false,
      includeProps: false,
      includeTrainingDummy: false,
    });
    const p = sim.player;
    sim.selectCharacter(p.id, 'ranger');
    p.x = 300;
    p.y = 300;
    p.clipMax = 4;
    p.clipAmmo = 1;
    p.reloadTimer = 0.6;
    p.reloadLockout = true;
    p.weaponHeat = 55;
    p.overheatLockTimer = 1.2;
    p.skillCooldownTimer = 5.5;
    p.overclockedNextShot = false;

    const enemy = sim.spawnEnemy('goblin_shooter', 305, 300, true);
    enemy.markedTimer = 4.0;
    enemy.markedByPlayerId = p.id;

    sim.handleEnemyKilled(enemy, p.id);

    // Never drops energy pickups
    expect(sim.pickups.some((pk) => (pk.kind as string) === 'energy')).toBe(false);
    const emblem = sim.pickups.find((pk) => pk.kind === 'prey_emblem');
    expect(emblem).toBeDefined();
    expect(emblem?.x).toBe(enemy.x);
    expect(emblem?.y).toBe(enemy.y);

    // Step pickups so player collects prey_emblem
    sim.updatePickups(1 / 60);

    expect(p.clipAmmo).toBe(4);
    expect(p.reloadTimer).toBe(0);
    expect(p.reloadLockout).toBe(false);
    expect(p.overclockedNextShot).toBe(true);
    expect(p.weaponHeat).toBe(0);
    expect(p.overheatLockTimer).toBe(0);
    expect(p.skillCooldownTimer).toBeCloseTo(3.5, 3);
    expect(
      sim.events.some((ev) => ev.kind === 'pickup_collected' && ev.pickupKind === 'prey_emblem'),
    ).toBe(true);
  });

  it('grants Elemental Convergence (3.0s, instant reload/0% heat, +20% moveSpeed & +20% fireRate) to both primer and trigger players on Co-op Team Combo', () => {
    const sim = new WorldSim({
      seed: 404,
      coopMode: true,
      playerCount: 2,
      spawnInitialWave: false,
      includeProps: false,
      includeTrainingDummy: false,
    });
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'elementalist', 'P2', 2);

    sim.selectCharacter(p1.id, 'ranger');
    p1.clipMax = 4;
    p1.clipAmmo = 0;
    p1.reloadTimer = 0.8;
    p1.reloadLockout = true;
    p2.weaponHeat = 75;
    p2.overheatLockTimer = 1.5;

    const enemy = sim.spawnEnemy('wild_boar', 400, 300, true);
    enemy.hp = 500;
    enemy.maxHp = 500;

    // P1 applies burn primer
    sim.applyDamageToEnemy(enemy, 10, false, 'burn', 0, 0, false, p1.id);
    expect(enemy.lastElementOwnerId).toBe(p1.id);

    // P2 triggers overload with shock
    sim.applyDamageToEnemy(enemy, 10, false, 'shock', 0, 0, false, p2.id);

    expect(p1.elementalConvergenceTimer).toBeCloseTo(3.0, 3);
    expect(p2.elementalConvergenceTimer).toBeCloseTo(3.0, 3);
    expect(p1.clipAmmo).toBe(p1.clipMax);
    expect(p1.reloadTimer).toBe(0);
    expect(p1.reloadLockout).toBe(false);
    expect(p2.weaponHeat).toBe(0);
    expect(p2.overheatLockTimer).toBe(0);

    // Verify +20% fire rate while elementalConvergenceTimer > 0
    const baseFireRate = WEAPONS[p1.weaponSlots[0]!]!.fireRate;
    p1.fireCooldownTimer = 0;
    sim.tryFireActiveWeapon(p1);
    expect(p1.fireCooldownTimer).toBeCloseTo(1 / (baseFireRate * 1.2), 3);

    // Verify timer decays and +20% movement speed is applied during step
    p1.x = 300;
    p1.y = 300;
    p1.vx = 0;
    p1.vy = 0;
    for (let i = 0; i < 15; i++) {
      sim.setPlayerInput({
        seq: i + 1,
        tick: sim.tick + 1,
        moveX: 1,
        moveY: 0,
        aimAngle: 0,
        buttons: 0,
        weaponSlotSelect: null,
      });
      sim.step(1 / 60);
    }
    expect(p1.elementalConvergenceTimer).toBeCloseTo(3.0 - 15 / 60, 2);
    expect(p1.vx).toBeCloseTo(p1.moveSpeed * 1.2, 1);
  });

  it('encodes and decodes weapon cadence & buff fields via QuantizedPlayerSnap and NetworkTransport without energy', () => {
    const hostSim = new WorldSim({ seed: 505, spawnInitialWave: false, includeProps: false });
    const p = hostSim.player;
    p.clipAmmo = 3;
    p.clipMax = 6;
    p.weaponHeat = 42.5;
    p.reloadTimer = 0.45;
    p.reloadDuration = 0.9;
    p.overclockedNextShot = true;
    p.overheatLockTimer = 0.75;
    p.meleeComboStep = 2;
    p.vanguardShieldBonusAdd = 0.45;
    p.elementalConvergenceTimer = 2.4;

    const snap = encodeWorldSnapshot(hostSim, []);
    const pSnap = snap.players[0]!;
    expect('energy' in pSnap).toBe(false);
    expect('maxEnergy' in pSnap).toBe(false);
    expect(pSnap.clipAmmo).toBe(3);
    expect(pSnap.clipMax).toBe(6);
    expect(pSnap.heat10).toBe(425);
    expect(pSnap.reload100).toBe(45);
    expect(pSnap.reloadDur100).toBe(90);
    expect(pSnap.overclock).toBe(true);
    expect(pSnap.overheat100).toBe(75);
    expect(pSnap.comboStep).toBe(2);
    expect(pSnap.vgBonus100).toBe(45);
    expect(pSnap.conv10).toBe(24);

    const clientTransport = new NetworkTransport({ localPlayerId: p.id, localPlayerSlot: 1 });
    clientTransport.receiveSnapshot(snap);
    const cp = clientTransport.getLocalPlayerState();
    expect(cp.clipAmmo).toBe(3);
    expect(cp.clipMax).toBe(6);
    expect(cp.weaponHeat).toBeCloseTo(42.5, 1);
    expect(cp.reloadTimer).toBeCloseTo(0.45, 2);
    expect(cp.reloadDuration).toBeCloseTo(0.9, 2);
    expect(cp.overclockedNextShot).toBe(true);
    expect(cp.overheatLockTimer).toBeCloseTo(0.75, 2);
    expect(cp.meleeComboStep).toBe(2);
    expect(cp.vanguardShieldBonusAdd).toBeCloseTo(0.45, 2);
    expect(cp.elementalConvergenceTimer).toBeCloseTo(2.4, 1);
  });

  it('syncs clipMax, clipAmmo, and reloadDuration when Vanguard equips or picks up a CLIP_RELOAD weapon (rivet_gun) and blocks enemy bullets', () => {
    const sim = new WorldSim({
      seed: 108,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
    });
    sim.selectCharacter(sim.player.id, 'vanguard');
    const p = sim.player;
    p.weaponSlots = ['knight_sword'];
    p.activeWeaponSlot = 0;
    p.x = 300;
    p.y = 300;
    p.aimAngle = 0;

    // Initially wielding knight_sword (MELEE_COMBO -> clipMax = 0)
    expect(p.clipMax).toBe(0);
    expect(p.reloadDuration).toBe(0);

    // Pick up rivet_gun (CLIP_RELOAD, clipSize = 6, reloadDurationSec = 0.90) from world item
    const item = sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: 'rivet_gun',
      rarity: 'common',
      nameVi: WEAPONS.rivet_gun!.nameVi,
      costGold: 0,
      healAmount: 0,
      x: p.x,
      y: p.y,
    });
    expect(sim.pickupOrBuyWorldItem(item, p)).toBe(true);
    expect(p.clipMax).toBe(6);
    expect(p.clipAmmo).toBe(6);
    expect(p.reloadDuration).toBeCloseTo(0.9, 5);

    // Spend 2 rounds -> clipAmmo = 4, then block an enemy bullet with Tường Khiên Hồng Ngọc -> refills to 5 (up to 6)
    p.clipAmmo = 4;
    p.skillActiveTimer = 3.0;
    const bullet = sim.acquireProjectile({
      id: ++sim.nextEntityId,
      ownerId: 999,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: p.x + 28,
      y: p.y,
      vx: -180,
      vy: 0,
      angle: Math.PI,
      radius: 5,
      damage: 2,
      isCrit: false,
      knockback: 20,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 1.5,
      element: 'none',
      amplifiedByShield: false,
    });
    sim.projectiles.push(bullet);
    sim.updateProjectiles(1 / 60);
    expect(p.clipAmmo).toBe(5);

    // Swapping back to slot 0 (knight_sword) and then slot 1 (rivet_gun) via equipWeaponSlot syncs clipMax properly
    sim.equipWeaponSlot(0);
    expect(p.clipMax).toBe(0);
    sim.equipWeaponSlot(1);
    expect(p.clipMax).toBe(6);
    expect(p.reloadDuration).toBeCloseTo(0.9, 5);
  });
});
