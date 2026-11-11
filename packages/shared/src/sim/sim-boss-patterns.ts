import { findNearestWalkablePoint } from './arena-room-archetypes.js';
import type { SimEnemyState, SimPlayerState } from './world-sim-types.js';
import type { WorldSim } from './world-sim.js';

export function cancelBossProjectileStream(e: SimEnemyState): void {
  e.bossStreamTimer = 0;
  e.bossStreamTickTimer = 0;
  e.bossStreamStep = 0;
}

export function selectNextBossPattern(sim: WorldSim, e: SimEnemyState): number {
  if (e.defId === 'kryssa_ice_queen' && e.bossArmorShellActive) {
    e.bossPatternId = 0;
    return 0;
  }
  if (e.bossPhase === 3 && !e.bossClimaxFiredP3) {
    e.bossClimaxFiredP3 = true;
    e.bossLastPatternId = 4;
    e.bossPatternId = 4;
    if (e.defId === 'spore_king') {
      e.lastCombatText = 'ĐẠI DỊCH BÀO TỬ!';
    } else if (e.defId === 'kryssa_ice_queen') {
      e.lastCombatText = 'BÃO TUYẾT VĨNH CỬU!';
    } else if (e.defId === 'forge_titan') {
      e.lastCombatText = 'LÕI NHIỆT HẠCH QUÁ TẢI!';
    }
    return 4;
  }

  const maxPattern = e.bossPhase === 3 ? 4 : e.bossPhase === 2 ? 3 : 2;
  const count = maxPattern + 1;
  let candidate = (e.bossAttackCycle + (sim.tick & 1)) % count;
  if (candidate === e.bossLastPatternId) {
    candidate = (candidate + 1) % count;
  }
  e.bossLastPatternId = candidate;
  e.bossPatternId = candidate;

  if (e.defId === 'kryssa_ice_queen' && candidate === 1) {
    e.lastCombatText = 'TƯỜNG BĂNG!';
  } else if (e.defId === 'forge_titan' && candidate === 2) {
    e.lastCombatText = 'LỬA QUÉT LÒ RÈN!';
  }
  return candidate;
}

export function updateBossProjectileStream(
  sim: WorldSim,
  e: SimEnemyState,
  dtSec: number,
): void {
  if ((e.bossStreamTimer ?? 0) <= 0) return;

  if (
    e.hp <= 0 ||
    e.aiState === 'stunned' ||
    (e.stunTimer ?? 0) > 0 ||
    (e.bossPhaseTransitionTimer ?? 0) > 0 ||
    e.bossBurrowed ||
    e.bossArmorShellActive ||
    e.frozenTimer > 0
  ) {
    cancelBossProjectileStream(e);
    return;
  }

  e.bossStreamTimer = Math.max(0, (e.bossStreamTimer ?? 0) - dtSec);
  e.bossStreamTickTimer = (e.bossStreamTickTimer ?? 0) - dtSec;
  if (e.bossStreamTickTimer <= 0) {
    const step = (e.bossStreamStep ?? 0) + 1;
    e.bossStreamStep = step;
    const baseAngle = e.bossStreamBaseAngle ?? e.aimAngle;
    const pat = e.bossPatternId ?? 0;

    if (e.defId === 'spore_king') {
      if (pat === 2) {
        e.bossStreamTickTimer = 0.15;
        const arms = 3;
        const armStep = (Math.PI * 2) / arms;
        const spinSign = step % 4 < 2 ? 1 : -1;
        sim.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'spore_spiral_stream',
          x: e.x,
          y: e.y,
          angle: baseAngle + armStep * 0.5 + step * 0.34 * e.strafeSign,
          pelletCount: arms,
          spreadRad: 0,
          radialStepRad: armStep,
          muzzleOffset: e.radius + 6,
          speed: 158,
          damage: e.damage,
          radius: 6.8,
          knockback: 85,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 2.0,
          element: 'poison',
          critChance: 0,
          amplifiedByShield: false,
          seed: sim.rng.nextUint32(),
          bulletShape: step % 2 === 1 ? 'small_orb' : 'orb',
          kinematicMode: 'spiral',
          angularVelRad: 0.08 * spinSign,
        });
      } else if (pat === 3) {
        e.bossStreamTimer = 0;
        sim.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'spore_cluster_dart',
          x: e.x,
          y: e.y,
          angle: baseAngle,
          pelletCount: 2,
          spreadRad: 0.44,
          muzzleOffset: e.radius + 8,
          speed: 172,
          damage: e.damage,
          radius: 6.8,
          knockback: 95,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 1.85,
          element: 'poison',
          critChance: 0,
          amplifiedByShield: false,
          seed: sim.rng.nextUint32(),
          bulletShape: 'small_orb',
        });
      } else if (pat === 4) {
        e.bossStreamTickTimer = 0.16;
        const armStep = Math.PI * 0.5;
        sim.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'spore_miasma_climax',
          x: e.x,
          y: e.y,
          angle: baseAngle + armStep * 0.5 + step * 0.38,
          pelletCount: 4,
          spreadRad: 0,
          radialStepRad: armStep,
          muzzleOffset: e.radius + 8,
          speed: 158,
          damage: e.damage,
          radius: 7.0,
          knockback: 95,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 1.95,
          element: 'poison',
          critChance: 0,
          amplifiedByShield: false,
          seed: sim.rng.nextUint32(),
          bulletShape: 'small_orb',
        });
      }
    } else if (e.defId === 'kryssa_ice_queen') {
      if (pat === 0) {
        e.bossStreamTimer = 0;
        const followCount = e.bossPhase >= 2 ? 5 : 4;
        sim.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'kryssa_ice_beam',
          x: e.x,
          y: e.y,
          angle: baseAngle,
          pelletCount: followCount,
          spreadRad: 0.44,
          muzzleOffset: e.radius + 8,
          speed: 154,
          damage: e.damage,
          radius: 6.8,
          knockback: 95,
          pierceCount: 0,
          bounceCount: 1,
          ttlSec: 1.45,
          element: 'chill',
          critChance: 0,
          amplifiedByShield: false,
          seed: sim.rng.nextUint32(),
          bulletShape: 'lance',
        });
      } else if (pat === 3) {
        e.bossStreamTickTimer = 0.13;
        const armStep = Math.PI * 0.5;
        for (const sign of [1, -1] as const) {
          sim.spawnDeterministicVolley({
            kind: 'bullet_volley_spawned',
            tick: sim.tick,
            ownerId: e.id,
            team: 'enemy',
            weaponId: 'kryssa_prism_vortex',
            x: e.x,
            y: e.y,
            angle: baseAngle + sign * step * 0.22,
            pelletCount: 4,
            spreadRad: 0,
            radialStepRad: armStep,
            muzzleOffset: e.radius + 6,
            speed: 146,
            damage: e.damage,
            radius: 7.0,
            knockback: 85,
            pierceCount: 0,
            bounceCount: 0,
            ttlSec: 1.9,
            element: 'chill',
            critChance: 0,
            amplifiedByShield: false,
            seed: sim.rng.nextUint32(),
            bulletShape: sign === 1 ? 'orb' : 'small_orb',
            kinematicMode: 'spiral',
            angularVelRad: 0.4 * sign,
          });
        }
      } else if (pat === 4) {
        e.bossStreamTickTimer = 0.16;
        const offset = (step % 2 === 0 ? 1 : -1) * 0.14;
        sim.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'kryssa_blizzard_climax',
          x: e.x,
          y: e.y,
          angle: baseAngle + offset,
          pelletCount: 5,
          spreadRad: 0.64,
          muzzleOffset: e.radius + 8,
          speed: 168,
          damage: e.damage,
          radius: 7.8,
          knockback: 95,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 1.85,
          element: 'chill',
          critChance: 0,
          amplifiedByShield: false,
          seed: sim.rng.nextUint32(),
          bulletShape: 'orb',
          alternateBulletShape: 'small_orb',
        });
      }
    } else if (e.defId === 'forge_titan') {
      if (pat === 2) {
        e.bossStreamTickTimer = 0.12;
        const sweepT = Math.min(1, step / 5);
        const sweepOffset = (-0.82 + sweepT * 1.64) * e.strafeSign;
        sim.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'titan_flame_sweep',
          x: e.x,
          y: e.y,
          angle: baseAngle + sweepOffset,
          pelletCount: 3,
          spreadRad: 0.22,
          muzzleOffset: e.radius + 10,
          speed: 166,
          damage: e.damage,
          radius: 7.6,
          knockback: 100,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 1.85,
          element: 'burn',
          critChance: 0,
          amplifiedByShield: false,
          seed: sim.rng.nextUint32(),
          bulletShape: 'orb',
          alternateBulletShape: 'small_orb',
        });
      } else if (pat === 3) {
        e.bossStreamTickTimer = 0.13;
        const spokeStep = (Math.PI * 2) / 8;
        sim.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'titan_crucible_gear',
          x: e.x,
          y: e.y,
          angle: baseAngle + step * 0.18 * e.strafeSign,
          pelletCount: 8,
          spreadRad: 0,
          radialStepRad: spokeStep,
          muzzleOffset: e.radius + 8,
          speed: 156,
          damage: e.damage,
          radius: 7.6,
          knockback: 95,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 1.85,
          element: 'burn',
          critChance: 0,
          amplifiedByShield: false,
          seed: sim.rng.nextUint32(),
          bulletShape: step % 2 === 1 ? 'small_orb' : 'orb',
          kinematicMode: 'spiral',
          angularVelRad: 0.14 * e.strafeSign,
        });
      } else if (pat === 4) {
        e.bossStreamTickTimer = 0.16;
        const spokeStep = (Math.PI * 2) / 8;
        sim.spawnDeterministicVolley({
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: e.id,
          team: 'enemy',
          weaponId: 'titan_meltdown_climax',
          x: e.x,
          y: e.y,
          angle: baseAngle + step * (spokeStep * 0.5),
          pelletCount: 8,
          spreadRad: 0,
          radialStepRad: spokeStep,
          muzzleOffset: e.radius + 8,
          speed: 160,
          damage: e.damage,
          radius: 7.6,
          knockback: 100,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 1.85,
          element: 'burn',
          critChance: 0,
          amplifiedByShield: false,
          seed: sim.rng.nextUint32(),
          bulletShape: 'small_orb',
        });
      }
    }
  }
}

export function executeSporeKingSurfacePattern(
  sim: WorldSim,
  e: SimEnemyState,
  angleToPlayer: number,
  cycle: number,
): void {
  const isLegacyDefault = e.bossPatternId === undefined;
  const pat = e.bossArmorShellActive ? 0 : (e.bossPatternId ?? 0);

  // Summon spore minion on alternate cycles if active non-boss count < 2
  const activeMinions = sim.enemies.filter(
    (m) => !m.isDummy && !m.isBoss && m.defId !== 'spore_guardian' && m.hp > 0,
  ).length;
  if (cycle % 2 === 1 && activeMinions < 2) {
    const minionDef = e.bossPhase >= 2 && cycle % 4 === 3 ? 'spore_bomber' : 'mini_slime';
    const minionPt = findNearestWalkablePoint(sim.map, e.x + 48, e.y + 36, 14, sim.props);
    sim.spawnEnemy(minionDef, minionPt.x, minionPt.y, false);
  }

  if (pat === 0) {
    const ringCount = e.bossPhase === 3 ? 18 : e.bossPhase === 2 ? 16 : 16;
    const ringStep = (Math.PI * 2) / ringCount;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'boss_spore_ring',
      x: e.x,
      y: e.y,
      angle:
        angleToPlayer +
        (cycle % 2 === 1 ? ringStep * 0.5 : isLegacyDefault ? 0 : ringStep * 0.25),
      pelletCount: ringCount,
      spreadRad: 0,
      radialStepRad: ringStep,
      muzzleOffset: e.radius + 6,
      speed: 174,
      alternateSpeedScale: 0.76,
      damage: e.damage,
      radius: 7.0,
      alternateRadiusScale: 0.88,
      knockback: 95,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 2.1,
      element: 'poison',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'orb',
      alternateBulletShape: 'small_orb',
    });

    if (e.bossPhase === 3 && cycle % 2 === 0) {
      sim.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: sim.tick,
        ownerId: e.id,
        team: 'enemy',
        weaponId: 'shaman_staff',
        x: e.x,
        y: e.y,
        angle: angleToPlayer,
        pelletCount: 2,
        spreadRad: 0.44,
        muzzleOffset: 24,
        speed: 188,
        damage: e.damage + 1,
        radius: 6.8,
        knockback: 110,
        pierceCount: 0,
        bounceCount: 0,
        ttlSec: 1.9,
        element: 'poison',
        critChance: 0,
        amplifiedByShield: false,
        seed: sim.rng.nextUint32(),
        bulletShape: 'heavy_orb',
      });
    }
    return;
  }

  if (pat === 1) {
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'spore_crescent_wave',
      x: e.x,
      y: e.y,
      angle: angleToPlayer,
      pelletCount: 2,
      spreadRad: 0.44,
      muzzleOffset: e.radius + 8,
      speed: 194,
      targetSpeed: 138,
      kinematicMode: 'decel',
      kinematicRate: 3.0,
      damage: e.damage,
      radius: 8.4,
      knockback: 105,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 2.0,
      element: 'poison',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'heavy_orb',
    });
    for (const side of [-1, 1] as const) {
      sim.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: sim.tick,
        ownerId: e.id,
        team: 'enemy',
        weaponId: 'spore_thorn_fan',
        x: e.x,
        y: e.y,
        angle: angleToPlayer + side * 0.86,
        pelletCount: 3,
        spreadRad: 0.28,
        muzzleOffset: e.radius + 6,
        speed: 162,
        damage: e.damage,
        radius: 6.8,
        knockback: 90,
        pierceCount: 0,
        bounceCount: 0,
        ttlSec: 1.95,
        element: 'poison',
        critChance: 0,
        amplifiedByShield: false,
        seed: sim.rng.nextUint32(),
        bulletShape: 'small_orb',
      });
    }
    return;
  }

  if (pat === 2) {
    const arms = 3;
    const armStep = (Math.PI * 2) / arms;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'spore_spiral_stream',
      x: e.x,
      y: e.y,
      angle: angleToPlayer + armStep * 0.5,
      pelletCount: arms,
      spreadRad: 0,
      radialStepRad: armStep,
      muzzleOffset: e.radius + 6,
      speed: 158,
      damage: e.damage,
      radius: 6.8,
      knockback: 85,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 2.0,
      element: 'poison',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'orb',
      kinematicMode: 'spiral',
      angularVelRad: 0.08,
    });
    e.bossStreamBaseAngle = angleToPlayer;
    e.bossStreamStep = 0;
    e.bossStreamTickTimer = 0.15;
    e.bossStreamTimer = 0.34;
    return;
  }

  if (pat === 3) {
    const ringCount = 10;
    const ringStep = (Math.PI * 2) / ringCount;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'spore_cluster_orb',
      x: e.x,
      y: e.y,
      angle: angleToPlayer + ringStep * 0.5,
      pelletCount: ringCount,
      spreadRad: 0,
      radialStepRad: ringStep,
      muzzleOffset: e.radius + 8,
      speed: 198,
      targetSpeed: 108,
      kinematicMode: 'decel',
      kinematicRate: 3.2,
      damage: e.damage,
      radius: 8.0,
      knockback: 105,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 2.15,
      element: 'poison',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'heavy_orb',
    });
    e.bossStreamBaseAngle = angleToPlayer;
    e.bossStreamStep = 0;
    e.bossStreamTickTimer = 0.22;
    e.bossStreamTimer = 0.25;
    return;
  }

  // Pattern 4: Phase 3 Climax ("ĐẠI DỊCH BÀO TỬ!")
  e.lastCombatText = 'ĐẠI DỊCH BÀO TỬ!';
  const climaxCount = 14;
  const climaxStep = (Math.PI * 2) / climaxCount;
  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: e.id,
    team: 'enemy',
    weaponId: 'spore_miasma_climax',
    x: e.x,
    y: e.y,
    angle: angleToPlayer + climaxStep * 0.5,
    pelletCount: climaxCount,
    spreadRad: 0,
    radialStepRad: climaxStep,
    muzzleOffset: e.radius + 6,
    speed: 165,
    targetSpeed: 112,
    kinematicMode: 'pulse',
    kinematicRate: 8.0,
    damage: e.damage,
    radius: 7.4,
    knockback: 95,
    pierceCount: 0,
    bounceCount: 0,
    ttlSec: 2.15,
    element: 'poison',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    bulletShape: 'heavy_orb',
    alternateBulletShape: 'orb',
  });
  e.bossStreamBaseAngle = angleToPlayer;
  e.bossStreamStep = 0;
  e.bossStreamTickTimer = 0.16;
  e.bossStreamTimer = 0.36;
}

export function executeKryssaPattern(
  sim: WorldSim,
  e: SimEnemyState,
  targetPlayer: SimPlayerState,
  angleToPlayer: number,
  cycle: number,
): void {
  const isLegacyDefault = e.bossPatternId === undefined;
  const pat = e.bossArmorShellActive ? 0 : (e.bossPatternId ?? 0);

  if (pat === 0) {
    const beamCount = e.bossPhase === 3 || e.bossArmorShellActive ? 5 : e.bossPhase === 2 ? 6 : 5;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'kryssa_ice_beam',
      x: e.x,
      y: e.y,
      angle: angleToPlayer,
      pelletCount: beamCount,
      spreadRad: e.bossArmorShellActive ? 0.1 : cycle % 2 === 0 ? 0.42 : 0.24,
      muzzleOffset: e.radius + 8,
      speed: 188,
      damage: e.damage + (cycle % 3 === 0 ? 1 : 0),
      radius: 7.0,
      knockback: 105,
      pierceCount: 1,
      bounceCount: 3,
      ttlSec: 1.55,
      element: 'chill',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'lance',
    });

    if (!e.bossArmorShellActive && !isLegacyDefault) {
      e.bossStreamBaseAngle = angleToPlayer;
      e.bossStreamStep = 0;
      e.bossStreamTickTimer = 0.18;
      e.bossStreamTimer = 0.22;
    }
  }

  if (pat === 2 || (isLegacyDefault && !e.bossArmorShellActive && cycle % 2 === 1)) {
    const ringCount = e.bossPhase === 3 ? 18 : e.bossPhase === 2 ? 16 : 14;
    const ringStep = (Math.PI * 2) / ringCount;
    const novaParity = (isLegacyDefault ? Math.floor(cycle / 2) : cycle) % 2;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'kryssa_frost_nova',
      x: e.x,
      y: e.y,
      angle: angleToPlayer + (novaParity === 1 ? ringStep * 0.5 : 0),
      pelletCount: ringCount,
      spreadRad: 0,
      radialStepRad: ringStep,
      muzzleOffset: e.radius + 6,
      speed: 162,
      alternateSpeedScale: 0.76,
      damage: e.damage,
      radius: 7.4,
      knockback: 90,
      pierceCount: 0,
      bounceCount: 1,
      ttlSec: 1.85,
      element: 'chill',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'orb',
      alternateBulletShape: 'small_orb',
    });
  } else if (pat === 1) {
    e.lastCombatText = 'TƯỜNG BĂNG!';
    const wallCount = e.bossPhase >= 2 ? 17 : 15;
    const gapStart = cycle % 2 === 0 ? 5 : wallCount - 8;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'kryssa_glacier_wall',
      x: e.x,
      y: e.y,
      angle: angleToPlayer,
      pelletCount: wallCount,
      spreadRad: (Math.PI * 2) / 3,
      muzzleOffset: e.radius + 10,
      speed: 66,
      targetSpeed: 198,
      kinematicMode: 'accel',
      kinematicDelaySec: 0.36,
      kinematicRate: 4.5,
      damage: e.damage,
      radius: 7.6,
      knockback: 95,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 2.15,
      element: 'chill',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'heavy_orb',
      gapIndices: [gapStart, gapStart + 1, gapStart + 2],
    });
  } else if (pat === 3) {
    const armStep = Math.PI * 0.5;
    for (const sign of [1, -1] as const) {
      sim.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: sim.tick,
        ownerId: e.id,
        team: 'enemy',
        weaponId: 'kryssa_prism_vortex',
        x: e.x,
        y: e.y,
        angle: angleToPlayer,
        pelletCount: 4,
        spreadRad: 0,
        radialStepRad: armStep,
        muzzleOffset: e.radius + 6,
        speed: 146,
        damage: e.damage,
        radius: 7.0,
        knockback: 85,
        pierceCount: 0,
        bounceCount: 0,
        ttlSec: 1.9,
        element: 'chill',
        critChance: 0,
        amplifiedByShield: false,
        seed: sim.rng.nextUint32(),
        bulletShape: sign === 1 ? 'orb' : 'small_orb',
        kinematicMode: 'spiral',
        angularVelRad: 0.4 * sign,
      });
    }
    e.bossStreamBaseAngle = angleToPlayer;
    e.bossStreamStep = 0;
    e.bossStreamTickTimer = 0.13;
    e.bossStreamTimer = 0.54;
  } else if (pat === 4) {
    e.lastCombatText = 'BÃO TUYẾT VĨNH CỬU!';
    const ringCount = 16;
    const ringStep = (Math.PI * 2) / ringCount;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'kryssa_blizzard_climax',
      x: e.x,
      y: e.y,
      angle: angleToPlayer,
      pelletCount: ringCount,
      spreadRad: 0,
      radialStepRad: ringStep,
      muzzleOffset: e.radius + 8,
      speed: 196,
      targetSpeed: 104,
      kinematicMode: 'decel',
      kinematicRate: 3.0,
      damage: e.damage,
      radius: 8.8,
      knockback: 95,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 2.25,
      element: 'chill',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'heavy_orb',
    });
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'kryssa_blizzard_climax',
      x: e.x,
      y: e.y,
      angle: angleToPlayer,
      pelletCount: 5,
      spreadRad: 0.64,
      muzzleOffset: e.radius + 8,
      speed: 168,
      damage: e.damage,
      radius: 7.8,
      knockback: 95,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 1.85,
      element: 'chill',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'orb',
      alternateBulletShape: 'small_orb',
    });
    e.bossStreamBaseAngle = angleToPlayer;
    e.bossStreamStep = 0;
    e.bossStreamTickTimer = 0.16;
    e.bossStreamTimer = 0.34;
  }

  // Phase 2+: Refresh Mirror Illusion Clones
  if (e.bossPhase >= 2 && cycle % 3 === 0) {
    sim.spawnKryssaMirrorClones(e);
  }

  // Phase 3: Ice Prison Co-op Mechanic
  if (
    e.bossPhase === 3 &&
    cycle % 3 === 1 &&
    sim.getActivePlayerCount() > 1 &&
    !sim.stressTestActive
  ) {
    sim.encasePlayerInIcePrison(targetPlayer);
  }
}

export function executeForgeTitanPattern(
  sim: WorldSim,
  e: SimEnemyState,
  angleToPlayer: number,
  cycle: number,
): void {
  const isLegacyDefault = e.bossPatternId === undefined;
  const pat = e.bossArmorShellActive
    ? cycle % 2 === 0
      ? 0
      : 1
    : (e.bossPatternId ?? (cycle % 2 === 0 ? 0 : 1));

  sim.map.reverseConveyorDirection();
  sim.events.push({
    kind: 'hit_stop',
    durationMs: 50,
    trauma: 0.52,
  });

  if (pat === 0 || (e.bossPhase === 3 && pat === 4)) {
    sim.shockwaveRings.push({
      id: ++sim.nextPuzzleEntityId,
      sourceEnemyId: e.id,
      x: e.x,
      y: e.y,
      radius: e.radius,
      maxRadius: 360,
      speed: e.bossPhase === 3 ? 212 : 192,
      thickness: 28,
      damage: e.damage,
      hitPlayerIds: [],
    });
  }

  if (e.bossPhase === 3 && cycle >= 14 && cycle <= 18 && sim.getActivePlayerCount() === 1) {
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'titan_slag_wave',
      x: e.x,
      y: e.y,
      angle: angleToPlayer,
      pelletCount: 3,
      spreadRad: 0.24,
      muzzleOffset: e.radius + 10,
      speed: 192,
      damage: e.damage,
      radius: 8.8,
      knockback: 110,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 1.9,
      element: 'burn',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'lance',
    });
  }

  if (pat === 0) {

    const anvilCount = e.bossPhase === 3 ? 18 : e.bossPhase === 2 ? 16 : 14;
    const anvilStep = (Math.PI * 2) / anvilCount;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'titan_anvil_ring',
      x: e.x,
      y: e.y,
      angle: angleToPlayer + (cycle % 2 === 1 ? anvilStep * 0.5 : anvilStep * 0.25),
      pelletCount: anvilCount,
      spreadRad: 0,
      radialStepRad: anvilStep,
      muzzleOffset: e.radius + 8,
      speed: 178,
      targetSpeed: 112,
      kinematicMode: 'decel',
      kinematicRate: 2.6,
      damage: e.damage,
      radius: 8.6,
      knockback: 110,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 2.1,
      element: 'burn',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'heavy_orb',
    });

    if (isLegacyDefault && e.bossPhase === 3) {
      spawnTitanMagmaBarrageVolley(sim, e, angleToPlayer, cycle);
    }
    return;
  }

  if (pat === 1) {
    spawnTitanMagmaBarrageVolley(sim, e, angleToPlayer, cycle);

    if (!isLegacyDefault) {
      sim.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: sim.tick,
        ownerId: e.id,
        team: 'enemy',
        weaponId: 'titan_slag_wave',
        x: e.x,
        y: e.y,
        angle: angleToPlayer,
        pelletCount: 2,
        spreadRad: 0.42,
        muzzleOffset: e.radius + 10,
        speed: 162,
        damage: e.damage,
        radius: 8.0,
        knockback: 105,
        pierceCount: 0,
        bounceCount: 0,
        ttlSec: 1.85,
        element: 'burn',
        critChance: 0,
        amplifiedByShield: false,
        seed: sim.rng.nextUint32(),
        bulletShape: 'heavy_orb',
      });
    } else if (e.bossPhase === 3 && cycle % 2 === 1) {
      const sweepCount = 12;
      const sweepStep = (Math.PI * 2) / sweepCount;
      const sweepParity = Math.floor(cycle / 2) % 2;
      sim.spawnDeterministicVolley({
        kind: 'bullet_volley_spawned',
        tick: sim.tick,
        ownerId: e.id,
        team: 'enemy',
        weaponId: 'titan_flame_sweep',
        x: e.x,
        y: e.y,
        angle: angleToPlayer + (sweepParity === 1 ? sweepStep * 0.5 : 0),
        pelletCount: sweepCount,
        spreadRad: 0,
        radialStepRad: sweepStep,
        muzzleOffset: e.radius + 10,
        speed: 165,
        damage: e.damage,
        radius: 7.6,
        knockback: 110,
        pierceCount: 0,
        bounceCount: 0,
        ttlSec: 1.85,
        element: 'burn',
        critChance: 0,
        amplifiedByShield: false,
        seed: sim.rng.nextUint32(),
        bulletShape: 'orb',
      });
    }
    return;
  }

  if (pat === 2) {
    e.lastCombatText = 'LỬA QUÉT LÒ RÈN!';
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'titan_flame_sweep',
      x: e.x,
      y: e.y,
      angle: angleToPlayer - 0.72 * e.strafeSign,
      pelletCount: 2,
      spreadRad: 0.42,
      muzzleOffset: e.radius + 10,
      speed: 162,
      damage: e.damage,
      radius: 7.4,
      knockback: 100,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 1.85,
      element: 'burn',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'orb',
    });
    e.bossStreamBaseAngle = angleToPlayer;
    e.bossStreamStep = 0;
    e.bossStreamTickTimer = 0.14;
    e.bossStreamTimer = 0.36;
    return;
  }

  if (pat === 3) {
    const spokeStep = (Math.PI * 2) / 8;
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: e.id,
      team: 'enemy',
      weaponId: 'titan_crucible_gear',
      x: e.x,
      y: e.y,
      angle: angleToPlayer + spokeStep * 0.5,
      pelletCount: 8,
      spreadRad: 0,
      radialStepRad: spokeStep,
      muzzleOffset: e.radius + 8,
      speed: 152,
      damage: e.damage,
      radius: 7.4,
      knockback: 95,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 1.85,
      element: 'burn',
      critChance: 0,
      amplifiedByShield: false,
      seed: sim.rng.nextUint32(),
      bulletShape: 'orb',
      kinematicMode: 'spiral',
      angularVelRad: 0.06 * e.strafeSign,
    });
    e.bossStreamBaseAngle = angleToPlayer + spokeStep * 0.5;
    e.bossStreamStep = 0;
    e.bossStreamTickTimer = 0.15;
    e.bossStreamTimer = 0.32;
    return;
  }

  // Pattern 4: Phase 3 Meltdown Climax ("LÕI NHIỆT HẠCH QUÁ TẢI!")
  e.lastCombatText = 'LÕI NHIỆT HẠCH QUÁ TẢI!';
  const barrageCount = 16;
  const barrageStep = (Math.PI * 2) / barrageCount;
  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: e.id,
    team: 'enemy',
    weaponId: 'titan_magma_barrage',
    x: e.x,
    y: e.y,
    angle: angleToPlayer + barrageStep * 0.5,
    pelletCount: barrageCount,
    spreadRad: 0,
    radialStepRad: barrageStep,
    muzzleOffset: e.radius + 8,
    speed: 154,
    damage: e.damage,
    radius: 8.8,
    knockback: 115,
    pierceCount: 0,
    bounceCount: 0,
    ttlSec: 2.0,
    element: 'burn',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    bulletShape: 'heavy_orb',
  });

  const sweepCount = 12;
  const sweepStep = (Math.PI * 2) / sweepCount;
  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: e.id,
    team: 'enemy',
    weaponId: 'titan_flame_sweep',
    x: e.x,
    y: e.y,
    angle: angleToPlayer + sweepStep * 0.25,
    pelletCount: sweepCount,
    spreadRad: 0,
    radialStepRad: sweepStep,
    muzzleOffset: e.radius + 10,
    speed: 92,
    targetSpeed: 185,
    kinematicMode: 'accel',
    kinematicDelaySec: 0.26,
    kinematicRate: 4.3,
    damage: e.damage,
    radius: 7.8,
    knockback: 110,
    pierceCount: 0,
    bounceCount: 0,
    ttlSec: 2.0,
    element: 'burn',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    bulletShape: 'orb',
  });
  e.bossStreamBaseAngle = angleToPlayer + barrageStep * 0.5;
  e.bossStreamStep = 0;
  e.bossStreamTickTimer = 0.18;
  e.bossStreamTimer = 0.22;
}

function spawnTitanMagmaBarrageVolley(
  sim: WorldSim,
  e: SimEnemyState,
  angleToPlayer: number,
  cycle: number,
): void {
  const isLegacyDefault = e.bossPatternId === undefined;
  const barrageCount =
    isLegacyDefault && e.bossPhase === 3 ? 20 : e.bossPhase === 3 ? 18 : 16;
  const barrageStep = (Math.PI * 2) / barrageCount;
  const barrageParity = (e.bossPhase === 3 ? cycle : Math.floor(cycle / 2)) % 2;
  sim.spawnDeterministicVolley({
    kind: 'bullet_volley_spawned',
    tick: sim.tick,
    ownerId: e.id,
    team: 'enemy',
    weaponId: 'titan_magma_barrage',
    x: e.x,
    y: e.y,
    angle: angleToPlayer + (barrageParity === 1 ? barrageStep * 0.5 : 0),
    pelletCount: barrageCount,
    spreadRad: 0,
    radialStepRad: barrageStep,
    muzzleOffset: e.radius + 8,
    speed: 142,
    alternateSpeedScale: 1.32,
    damage: e.damage,
    radius: 8.6,
    alternateRadiusScale: 0.76,
    knockback: 115,
    pierceCount: 0,
    bounceCount: 0,
    ttlSec: 2.05,
    element: 'burn',
    critChance: 0,
    amplifiedByShield: false,
    seed: sim.rng.nextUint32(),
    bulletShape: 'heavy_orb',
    alternateBulletShape: 'small_orb',
  });
}
