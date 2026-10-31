import { describe, expect, it, vi } from 'vitest';
import {
  INPUT_BUTTON,
  MAX_DEPLOYABLES_PER_PLAYER,
  MAX_PLAYER_PROJECTILES,
  SIM_STEP_SEC,
  WorldSim,
  triggerSolarArchonSupernovaVent,
  trySpawnHoloDecoyOnReloadOrVent,
} from '../src/index.js';

function createCleanSim(seed = 5100): WorldSim {
  const sim = new WorldSim({
    seed,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
    autoRespawnWaves: false,
  });
  sim.enemies.length = 0;
  sim.projectiles.length = 0;
  sim.pickups.length = 0;
  sim.props.length = 0;
  sim.summons.length = 0;
  sim.skillZones.length = 0;
  sim.magneticRivets.length = 0;
  sim.consumeEvents();
  return sim;
}

describe('AP2 P5.1 — Closure of Remaining P1B & P4A Deferred Minors', () => {
  it('1. berserker_axe Combo Hit 3 reports deflected enemy projectiles in melee_swing.bulletsDestroyed', () => {
    const sim = createCleanSim(5101);
    const p = sim.player;
    sim.selectCharacter(p.id, 'vanguard');
    p.weaponSlots = ['berserker_axe'];
    sim.equipWeaponSlot(0);
    p.x = 200;
    p.y = 260;
    p.aimAngle = 0;
    p.meleeComboStep = 2;
    p.fireCooldownTimer = 0;

    // Berserker Guillotine leaps 96px forward (200 -> 296) and parries up to 3 enemy bullets within parry cone
    for (let i = 0; i < 4; i++) {
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 9501 + i,
          ownerId: 999,
          team: 'enemy',
          weaponId: 'goblin_bow',
          x: 296 + 24 + i * 6,
          y: 260,
          vx: -150,
          vy: 0,
          angle: Math.PI,
          radius: 5,
          damage: 2,
          isCrit: false,
          knockback: 15,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 3.0,
          element: 'none',
          amplifiedByShield: false,
        }),
      );
    }

    sim.consumeEvents();
    sim.tryFireActiveWeapon(p);

    const events = sim.consumeEvents();
    const swingEv = events.find((e) => e.kind === 'melee_swing');
    expect(swingEv).toBeDefined();
    if (swingEv?.kind === 'melee_swing') {
      expect(swingEv.weaponId).toBe('berserker_axe');
      expect(swingEv.bulletsDestroyed).toBe(3);
    }
  });

  it('2. solar_archon_staff Supernova Vent (r=120px) and thunder_hammer Hit 3 finisher record destroyed projectiles via sim.recordDestroyedProjectiles without duplicates', () => {
    const sim = createCleanSim(5102);
    const recordSpy = vi.spyOn(sim, 'recordDestroyedProjectiles');
    const p = sim.player;
    sim.selectCharacter(p.id, 'elementalist');
    p.weaponSlots = ['solar_archon_staff'];
    sim.equipWeaponSlot(0);
    p.x = 200;
    p.y = 260;
    p.aimAngle = 0;
    // Target point at (440, 260) — Supernova radius is r = 120px
    p.aimWorldX = 440;
    p.aimWorldY = 260;
    p.weaponHeat = 85;

    // Bullet A at +35px from Supernova center, Bullet B at +108px (inside r=120px!), Bullet C at +150px (outside r=120px)
    const offsets = [35, 108, 150];
    for (let i = 0; i < offsets.length; i++) {
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 9601 + i,
          ownerId: 998,
          team: 'enemy',
          weaponId: 'goblin_bow',
          x: 440 + offsets[i]!,
          y: 260,
          vx: -120,
          vy: 0,
          angle: Math.PI,
          radius: 5,
          damage: 2,
          isCrit: false,
          knockback: 10,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 3.0,
          element: 'none',
          amplifiedByShield: false,
        }),
      );
    }

    sim.consumeEvents();
    triggerSolarArchonSupernovaVent(sim, p);

    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy).toHaveBeenLastCalledWith([9601, 9602]);
    const supernovaDestroyedEvents = sim
      .consumeEvents()
      .filter((e) => e.kind === 'projectiles_destroyed');
    expect(supernovaDestroyedEvents).toHaveLength(1);
    expect(sim.projectiles.filter((b) => b.team === 'enemy' && b.ttlSec > 0).map((b) => b.id)).toEqual([
      9603,
    ]);

    // Now verify thunder_hammer Hit 3 finisher extra pillar deflections (+120px ahead, r=56px)
    recordSpy.mockClear();
    sim.projectiles.length = 0;
    p.weaponSlots = ['thunder_hammer'];
    sim.equipWeaponSlot(0);
    p.x = 200;
    p.y = 260;
    p.aimAngle = 0;
    p.meleeComboStep = 2;
    p.fireCooldownTimer = 0;

    // Place 2 enemy bullets near pillar center (200 + 120 = 320, 260), outside player's 86px close parry reach
    for (let i = 0; i < 2; i++) {
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 9701 + i,
          ownerId: 997,
          team: 'enemy',
          weaponId: 'goblin_bow',
          x: 320 + i * 12,
          y: 260,
          vx: -120,
          vy: 0,
          angle: Math.PI,
          radius: 5,
          damage: 2,
          isCrit: false,
          knockback: 10,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 3.0,
          element: 'none',
          amplifiedByShield: false,
        }),
      );
    }

    sim.consumeEvents();
    sim.tryFireActiveWeapon(p);

    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy).toHaveBeenLastCalledWith([9701, 9702]);
    const hammerEvents = sim.consumeEvents();
    const hammerDestroyedEvents = hammerEvents.filter((e) => e.kind === 'projectiles_destroyed');
    expect(hammerDestroyedEvents).toHaveLength(1);
    const hammerSwing = hammerEvents.find((e) => e.kind === 'melee_swing');
    if (hammerSwing?.kind === 'melee_swing') {
      expect(hammerSwing.bulletsDestroyed).toBe(2);
    }
  });

  it('3. ancient_mechanism repair enforces MAX_DEPLOYABLES_PER_PLAYER = 8 via enforcePlayerDeployableCap', () => {
    const sim = createCleanSim(5103);
    const p = sim.player;
    sim.selectCharacter(p.id, 'engineer');
    p.x = 300;
    p.y = 260;

    // Fill player's deployable pool to MAX_DEPLOYABLES_PER_PLAYER (5 magnetic rivets + 3 summons = 8)
    for (let i = 0; i < 5; i++) {
      sim.magneticRivets.push({
        id: 8100 + i,
        ownerPlayerId: p.id,
        x: 180 + i * 16,
        y: 220,
        ttlSec: 6.0,
        damage: 14,
        arcDamage: 8,
        tickTimer: 0.4,
      });
    }
    for (let i = 0; i < 3; i++) {
      sim.summons.push({
        id: 8200 + i,
        ownerPlayerId: p.id,
        kind: 'tesla_turret',
        nameVi: 'Trụ Tesla',
        x: 200 + i * 24,
        y: 300,
        radius: 14,
        auraRadius: 190,
        hp: 40,
        maxHp: 40,
        ttlSec: 10.0,
        maxTtlSec: 10.0,
        tickTimer: 0.5,
        healsRemaining: 0,
        charge: 0,
        poisonRoots: false,
        selfDestruct: false,
        rootedEnemyIds: [],
      });
    }

    const totalBefore =
      sim.magneticRivets.filter((r) => r.ownerPlayerId === p.id).length +
      sim.summons.filter((s) => s.ownerPlayerId === p.id).length;
    expect(totalBefore).toBe(MAX_DEPLOYABLES_PER_PLAYER);

    const mech = sim.spawnProp('ancient_mechanism', p.x + 18, p.y);
    expect(mech.repaired).toBeFalsy();

    const interacted = sim.interactWithNearest(p);
    expect(interacted).toBe(true);
    expect(mech.repaired).toBe(true);

    const ownedSummons = sim.summons.filter((s) => s.ownerPlayerId === p.id);
    const ownedRivets = sim.magneticRivets.filter((r) => r.ownerPlayerId === p.id);
    expect(ownedSummons.some((s) => s.kind === 'ancient_turret')).toBe(true);
    expect(ownedSummons.length + ownedRivets.length).toBe(MAX_DEPLOYABLES_PER_PLAYER);
  });

  it('4. holo_decoy_turret expires cleanly when its co-op owner is no longer present instead of falling back to host p1', () => {
    const sim = createCleanSim(5104);
    const p1 = sim.player;
    p1.x = 220;
    p1.y = 260;

    const p2 = sim.addCoopPlayer(2, 'ranger', 'Guest P2', 2);
    p2.x = 360;
    p2.y = 260;
    p2.aimAngle = 0;
    p2.weaponSlots = ['rivet_gun'];
    p2.weaponMutators = { 0: ['mutator_holo_decoy_gun'], 1: [] };

    const decoy = trySpawnHoloDecoyOnReloadOrVent(sim, p2);
    expect(decoy).not.toBeNull();
    expect(decoy!.ownerPlayerId).toBe(2);
    expect(sim.summons.some((s) => s.id === decoy!.id)).toBe(true);

    // Simulate P2 disconnecting mid-3.5s while the decoy summon entry is still present on tick
    sim.simulatedPlayers = sim.simulatedPlayers.filter((pl) => pl.id !== p2.id);
    expect(sim.getPlayerById(2)).toBeUndefined();

    sim.projectiles.length = 0;
    sim.consumeEvents();
    sim.setPlayerInput({
      seq: 1,
      tick: sim.tick + 1,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.NONE,
      weaponSlotSelect: null,
    });

    // Step 45 ticks (0.75s — well past initial 0.25s and 0.55s decoy fire intervals)
    for (let t = 0; t < 45; t++) {
      sim.step(SIM_STEP_SEC);
    }

    // Decoy must have expired cleanly (ttlSec <= 0, hp <= 0, pruned from summons) and fired 0 shots attributed to host p1
    expect(decoy!.ttlSec).toBeLessThanOrEqual(0);
    expect(decoy!.hp).toBe(0);
    expect(sim.summons.some((s) => s.id === decoy!.id)).toBe(false);
    expect(sim.projectiles.filter((b) => b.team === 'player')).toHaveLength(0);
  });

  it('5. solar_archon_staff applies P4A mutators (clusterMortarLob & secondaryInfusedElement) to all 3 converging volley rays at MAX_PLAYER_PROJECTILES = 240 cap', () => {
    const sim = createCleanSim(5105);
    const p = sim.player;
    sim.selectCharacter(p.id, 'elementalist');
    p.weaponSlots = ['solar_archon_staff', 'tesla_carbine'];
    sim.equipWeaponSlot(0);
    p.weaponMutators = {
      0: ['mutator_cluster_mortar', 'mutator_elemental_infusion'],
      1: [],
    };
    p.x = 240;
    p.y = 260;
    p.aimAngle = 0;
    p.aimWorldX = 480;
    p.aimWorldY = 260;
    p.ventEmpoweredNextShot = true;
    p.weaponHeat = 0;
    p.overheatLockTimer = 0;
    p.fireCooldownTimer = 0;

    for (let i = 0; i < MAX_PLAYER_PROJECTILES; i++) {
      sim.projectiles.push(
        sim.acquireProjectile({
          id: 70000 + i,
          ownerId: p.id,
          team: 'player',
          weaponId: 'rivet_gun',
          x: 100 + (i % 20) * 6,
          y: 120 + Math.floor(i / 20) * 6,
          vx: 300,
          vy: 0,
          angle: 0,
          radius: 4,
          damage: 8,
          isCrit: false,
          knockback: 20,
          pierceRemaining: 0,
          bounceRemaining: 0,
          ttlSec: 2.0,
          element: 'none',
          amplifiedByShield: false,
        }),
      );
    }
    expect(sim.projectiles).toHaveLength(MAX_PLAYER_PROJECTILES);

    sim.tryFireActiveWeapon(p);

    expect(sim.projectiles).toHaveLength(MAX_PLAYER_PROJECTILES);
    const solarRays = sim.projectiles.filter((b) => b.weaponId === 'solar_archon_staff');
    expect(solarRays).toHaveLength(3);
    for (const ray of solarRays) {
      expect(ray.clusterMortarLob).toBe(true);
      expect(ray.secondaryInfusedElement).toBe('shock');
    }
  });
});
