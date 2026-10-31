import { describe, expect, it, vi } from 'vitest';
import {
  ALL_WEAPON_MUTATOR_IDS,
  CORE_WEAPON_MUTATOR_IDS,
  INPUT_BUTTON,
  MAX_DEPLOYABLES_PER_PLAYER,
  MAX_PELLETS_PER_TRIGGER,
  PHASE4_WEAPON_MUTATOR_IDS,
  WEAPONS,
  WEAPON_MUTATORS,
  WorldSim,
  getCompatibleCoreMutatorsForWeapon,
  getCompatibleWeaponMutators,
  isMutatorCompatibleWithWeapon,
  resolveOffhandWeaponElement,
  scaleBlessingDamage,
} from '../src/index.js';
import {
  drawWeaponMutatorEmblem,
  formatMutatorChoiceCardMeta,
} from '../../../apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.js';

function createArenaSim(seed = 20261029): WorldSim {
  const sim = new WorldSim({
    seed,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
    autoRespawnWaves: false,
  });
  sim.inHub = false;
  return sim;
}

function spawnStaticTarget(sim: WorldSim, x: number, y: number, hp = 5000) {
  const enemy = sim.spawnEnemy('goblin_shooter', x, y, true);
  enemy.hp = hp;
  enemy.maxHp = hp;
  enemy.moveSpeed = 0;
  enemy.attackTimer = 999;
  return enemy;
}

function createMockGraphics() {
  return {
    fillStyle: vi.fn(),
    fillCircle: vi.fn(),
    fillRect: vi.fn(),
    fillRoundedRect: vi.fn(),
    fillTriangle: vi.fn(),
    fillPath: vi.fn(),
    lineStyle: vi.fn(),
    strokeCircle: vi.fn(),
    strokeRoundedRect: vi.fn(),
    strokePath: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    lineBetween: vi.fn(),
  };
}

describe('AP2 Phase P4A.3 — 4 Expanded Daedalus Weapon Mutators (#7–#10) & Forge Modal Emblems', () => {
  it('defines verbatim metadata for Phase 4 mutators (#7–#10) and expands Daedalus Anvil pool to all 10 mutators', () => {
    expect(CORE_WEAPON_MUTATOR_IDS).toHaveLength(6);
    expect(PHASE4_WEAPON_MUTATOR_IDS).toEqual([
      'mutator_holo_decoy_gun',
      'mutator_cluster_mortar',
      'mutator_boomerang_core',
      'mutator_elemental_infusion',
    ]);
    expect(ALL_WEAPON_MUTATOR_IDS).toHaveLength(10);

    expect(WEAPON_MUTATORS.mutator_holo_decoy_gun).toMatchObject({
      id: 'mutator_holo_decoy_gun',
      nameVi: 'Bóng Pháo Ảnh Phản Xạ',
      nameEn: 'Holo-Decoy Gun',
      descVi:
        'Khi Nạp Chuẩn / Xả Nhiệt [R], để lại Bóng Pháo Ảnh (3.5s, tối đa 1 bóng) bắn phụ họa (40% ST) về phía con trỏ chuột.',
      descEn:
        'On Perfect Reload / Vent [R], leave a Holo-Decoy Turret (3.5s, max 1) firing auxiliary shots (40% DMG) toward your cursor.',
      compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
      excludedCategories: ['melee'],
      phase: 4,
    });

    expect(WEAPON_MUTATORS.mutator_cluster_mortar).toMatchObject({
      id: 'mutator_cluster_mortar',
      nameVi: 'Cối Chùm Cầu Vồng',
      nameEn: 'Cluster Mortar Core',
      descVi:
        'Đạn bay cầu vồng vượt qua vật chắn thấp/đã lật và tách thành 3 mảnh nổ phụ khi chạm đích.',
      descEn:
        'Projectiles lob in an arc over cover obstacles and split into 3 secondary cluster blasts on impact.',
      compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
      excludedCategories: ['melee'],
      phase: 4,
    });

    expect(WEAPON_MUTATORS.mutator_boomerang_core).toMatchObject({
      id: 'mutator_boomerang_core',
      nameVi: 'Lõi Cưa Hồi Quy',
      nameEn: 'Boomerang Saw Core',
      descVi:
        'Khi Nạp Chuẩn / Xả Nhiệt [R], phóng lưỡi cưa năng lượng xoay 200px rồi thu về vị trí của bạn (32 ST).',
      descEn:
        'On Perfect Reload / Vent [R], launch a spinning energy sawblade out 200px that returns to you (32 DMG).',
      compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
      excludedCategories: ['melee'],
      phase: 4,
    });

    expect(WEAPON_MUTATORS.mutator_elemental_infusion).toMatchObject({
      id: 'mutator_elemental_infusion',
      nameVi: 'Lõi Truyền Nguyên Tố Kép',
      nameEn: 'Elemental Infusion Core',
      descVi:
        'Vũ khí đang cầm nhận thêm Nguyên tố thứ hai từ vũ khí ở ô còn lại mỗi khi bắn Phát Cuối Băng hoặc Đạn Quá Tải.',
      descEn:
        'Active weapon gains the secondary element from your off-hand weapon on Finale Shot or Overclocked Shot.',
      compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'],
      excludedCategories: ['melee'],
      phase: 4,
    });

    // Core pool stays 5 ranged / 2 melee; expanded pool becomes 9 ranged / 2 melee
    expect(getCompatibleCoreMutatorsForWeapon('tesla_carbine')).toHaveLength(5);
    expect(getCompatibleCoreMutatorsForWeapon('knight_sword')).toHaveLength(2);

    const expandedRanged = getCompatibleWeaponMutators('tesla_carbine');
    expect(expandedRanged).toHaveLength(9);
    for (const p4Id of PHASE4_WEAPON_MUTATOR_IDS) {
      expect(expandedRanged).toContain(p4Id);
      expect(isMutatorCompatibleWithWeapon(p4Id, 'tesla_carbine')).toBe(true);
      expect(isMutatorCompatibleWithWeapon(p4Id, 'gale_smg')).toBe(true);
      expect(isMutatorCompatibleWithWeapon(p4Id, 'knight_sword')).toBe(false);
    }
    expect(getCompatibleWeaponMutators('knight_sword')).toEqual([
      'mutator_gravity_singularity',
      'mutator_shockwave_edge',
    ]);

    // Daedalus Anvil in Treasure Rooms rolls from the expanded 10-mutator pool
    let sawPhase4ChoiceFromAnvil = false;
    for (let s = 0; s < 24; s++) {
      const sim = new WorldSim({
        seed: 91000 + s * 37,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
        autoRespawnWaves: false,
      });
      sim.player.weaponSlots[0] = 'tesla_carbine';
      sim.player.activeWeaponSlot = 0;
      const treasureRoom = sim.dungeon.rooms.find((r) => r.type === 'treasure');
      expect(treasureRoom).toBeDefined();
      sim.enterRoom(treasureRoom!.id);
      const anvil = sim.npcEntities.find((n) => n.kind === 'daedalus_anvil')!;
      sim.player.x = anvil.x;
      sim.player.y = anvil.y + 14;
      expect(sim.interactWithNearest(sim.player.id)).toBe(true);
      const choices = sim.player.mutatorChoices ?? [];
      if (choices.some((c) => (PHASE4_WEAPON_MUTATOR_IDS as readonly string[]).includes(c))) {
        sawPhase4ChoiceFromAnvil = true;
        const picked = choices.find((c) =>
          (PHASE4_WEAPON_MUTATOR_IDS as readonly string[]).includes(c),
        )!;
        expect(sim.selectWeaponMutator(picked, sim.player.id)).toBe(true);
        expect(sim.player.weaponMutators[0]).toContain(picked);
        break;
      }
    }
    expect(sawPhase4ChoiceFromAnvil).toBe(true);
  });

  it('mutator_holo_decoy_gun: spawns 3.5s Holo-Decoy Turret (max 1, deployable-capped) on Perfect Reload / Tactical Vent firing 40% DMG shots toward cursor', () => {
    const sim = createArenaSim(88301);
    const p = sim.player;
    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;

    p.x = cx;
    p.y = cy;
    p.weaponSlots = ['tesla_carbine', 'gale_smg'];
    p.activeWeaponSlot = 0;
    p.weaponMutators = [['mutator_holo_decoy_gun'], ['mutator_holo_decoy_gun']];
    p.critChance = 0;

    // Pre-fill 8 old deployable summons to verify enforcePlayerDeployableCap(sim, p.id, 1)
    for (let i = 0; i < MAX_DEPLOYABLES_PER_PLAYER; i++) {
      sim.summons.push({
        id: 5000 + i,
        kind: 'spore_turret',
        ownerPlayerId: p.id,
        nameVi: 'Ụ thử',
        x: cx - 120 + i * 10,
        y: cy + 90,
        radius: 12,
        hp: 50,
        maxHp: 50,
        ttlSec: 5,
        maxTtlSec: 5,
        tickTimer: 9,
        auraRadius: 120,
        healsRemaining: 0,
        poisonRoots: false,
        selfDestruct: false,
        charge: 0,
        rootedEnemyIds: [],
      });
    }

    // Start reload on tesla_carbine and hit Perfect Reload [R] inside golden window [0.45, 0.70]
    p.clipMax = WEAPONS.tesla_carbine.clipSize;
    p.clipAmmo = 2;
    p.reloadDuration = 1.0;
    p.reloadTimer = 0.48; // progress = 0.52
    p.reloadLockout = false;

    const targetX = cx + 140;
    const targetY = cy - 60;
    const dummy = spawnStaticTarget(sim, targetX, targetY, 5000);
    const hpBefore = dummy.hp;

    sim.step({
      seq: 1,
      moveX: 0,
      moveY: 0,
      aimX: targetX,
      aimY: targetY,
      aimAngle: Math.atan2(targetY - cy, targetX - cx),
      buttons: INPUT_BUTTON.RELOAD_VENT,
    });

    expect(p.overclockedNextShot).toBe(true);
    const decoys = sim.summons.filter((s) => s.kind === 'holo_decoy_turret');
    expect(decoys).toHaveLength(1);
    expect(sim.summons.filter((s) => s.ownerPlayerId === p.id).length).toBeLessThanOrEqual(
      MAX_DEPLOYABLES_PER_PLAYER,
    );
    const firstDecoyId = decoys[0]!.id;
    expect(decoys[0]!.ttlSec).toBeCloseTo(3.5, 1);
    expect(decoys[0]!.radius).toBe(14);
    expect(decoys[0]!.auraRadius).toBe(340);

    // Move player away while keeping cursor aimed at dummy; decoy stays at spawn spot and fires 40% DMG auxiliary shots toward cursor
    p.x = cx - 90;
    p.y = cy + 70;
    const expectedShotDmg = Math.max(1, Math.round(WEAPONS.tesla_carbine.damage * 0.4));
    let sawAuxiliaryProj = false;

    for (let t = 0; t < 65; t++) {
      sim.step({
        seq: t + 2,
        moveX: 0,
        moveY: 0,
        aimX: targetX,
        aimY: targetY,
        aimAngle: Math.atan2(targetY - p.y, targetX - p.x),
        buttons: 0,
      });
      const auxProj = sim.projectiles.find((b) => b.weaponId === 'holo_decoy_shot');
      if (auxProj) {
        sawAuxiliaryProj = true;
        expect(auxProj.damage).toBe(expectedShotDmg);
        expect(auxProj.element).toBe(WEAPONS.tesla_carbine.element);
      }
    }
    expect(sawAuxiliaryProj).toBe(true);
    expect(dummy.hp).toBeLessThan(hpBefore);

    // Switch to slot 1 (HEAT_VENT gale_smg) and Tactical Vent [R]: replaces previous holo_decoy_turret (max 1)
    p.activeWeaponSlot = 1;
    p.weaponHeat = 78;
    p.overheatLockTimer = 0;
    p.ventCooldownTimer = 0;
    sim.step({
      seq: 80,
      moveX: 0,
      moveY: 0,
      aimX: targetX,
      aimY: targetY,
      aimAngle: 0,
      buttons: INPUT_BUTTON.RELOAD_VENT,
    });
    const decoysAfterVent = sim.summons.filter((s) => s.kind === 'holo_decoy_turret');
    expect(decoysAfterVent).toHaveLength(1);
    expect(decoysAfterVent[0]!.id).not.toBe(firstDecoyId);

    // When owner is downed, active holo_decoy_turret falls back to nearest alive enemy within 340px
    p.lifeState = 'downed';
    p.downedTimer = 15;
    const downedHpBefore = dummy.hp;
    for (let t = 0; t < 58; t++) {
      sim.step({ seq: 82 + t, moveX: 0, moveY: 0, aimAngle: Math.PI, buttons: 0 });
    }
    expect(dummy.hp).toBeLessThan(downedHpBefore);
    p.lifeState = 'alive';

    // Step past remaining 3.5s TTL -> decoy expires cleanly
    for (let t = 0; t < 200; t++) {
      sim.step({ seq: 145 + t, moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
    }
    expect(sim.summons.filter((s) => s.kind === 'holo_decoy_turret')).toHaveLength(0);
  });

  it('mutator_cluster_mortar: lobs over cover obstacles without breaking cover, splits into 3 secondary 40%-DMG clusters on impact (per-target cap 2, MAX_PELLETS_PER_TRIGGER = 9 cap, no splitGen 1 re-split)', () => {
    const sim = new WorldSim({
      seed: 88302,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      autoRespawnWaves: false,
      mapConfig: { archetype: 'open_hall' },
    });
    sim.inHub = false;
    const p = sim.player;
    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;

    p.x = cx - 140;
    p.y = cy;
    p.weaponSlots[0] = 'tesla_carbine'; // spreadDeg 2.0, fast 580 px/s
    p.activeWeaponSlot = 0;
    p.weaponMutators[0] = ['mutator_cluster_mortar'];
    p.clipMax = WEAPONS.tesla_carbine.clipSize;
    p.clipAmmo = 6;
    p.critChance = 0;
    p.fireCooldownTimer = 0;

    const dummy = spawnStaticTarget(sim, cx + 60, cy, 5000);
    const dummyHpBefore = dummy.hp;
    const aimAng = Math.atan2(dummy.y - p.y, dummy.x - p.x);

    // Place a flipped moss_table and a glacial_barricade directly on the line between player and enemy
    const flippedTable = sim.spawnProp(
      'moss_table',
      p.x + (dummy.x - p.x) * 0.35,
      p.y + (dummy.y - p.y) * 0.35,
    );
    flippedTable.coverState = 'flipped';
    flippedTable.blocksEnemyProjectiles = true;
    const tableHpBefore = flippedTable.hp;

    const barricade = sim.spawnProp(
      'glacial_barricade',
      p.x + (dummy.x - p.x) * 0.65,
      p.y + (dummy.y - p.y) * 0.65,
    );
    const barricadeHpBefore = barricade.hp;

    // Also place a wooden_crate behind dummy to verify mortar terminates on enemy impact instead of piercing into props behind target
    const rearCrate = sim.spawnProp('wooden_crate', dummy.x + 70, dummy.y);
    const rearCrateHpBefore = rearCrate.hp;

    // Fire 1 lobbed shot straight across both cover props into the dummy
    sim.step({ seq: 1, moveX: 0, moveY: 0, aimAngle: aimAng, buttons: INPUT_BUTTON.FIRE });
    expect(sim.projectiles).toHaveLength(1);
    const lobProj = sim.projectiles[0]!;
    expect(lobProj.clusterMortarLob).toBe(true);
    const baseBulletDmg = lobProj.damage;
    const expectedClusterDmg = Math.max(1, Math.round(baseBulletDmg * 0.4));

    const clusterExplosions: Array<{ x: number; y: number; radius: number; damage: number }> = [];
    for (const ev of sim.drainEvents()) {
      if (ev.kind === 'explosion' && ev.sourceDefId === 'mutator_cluster_mortar') {
        clusterExplosions.push({ x: ev.x, y: ev.y, radius: ev.radius, damage: ev.damage });
      }
    }
    for (let t = 0; t < 95; t++) {
      sim.step({ seq: t + 2, moveX: 0, moveY: 0, aimAngle: aimAng, buttons: 0 });
      for (const ev of sim.drainEvents()) {
        if (ev.kind === 'explosion' && ev.sourceDefId === 'mutator_cluster_mortar') {
          clusterExplosions.push({ x: ev.x, y: ev.y, radius: ev.radius, damage: ev.damage });
        }
      }
    }

    // Cover obstacles were bypassed cleanly in mid-flight and rear crate remained intact
    expect(flippedTable.hp).toBe(tableHpBefore);
    expect(barricade.hp).toBe(barricadeHpBefore);
    expect(rearCrate.hp).toBe(rearCrateHpBefore);

    // 3 secondary cluster blasts triggered at r = 44px with 40% damage, and per-target hit cap kept secondary hits <= 2
    expect(clusterExplosions).toHaveLength(3);
    for (const ex of clusterExplosions) {
      expect(ex.radius).toBe(44);
      expect(ex.damage).toBe(expectedClusterDmg);
    }
    const totalDmgTaken = dummyHpBefore - dummy.hp;
    expect(totalDmgTaken).toBeGreaterThanOrEqual(baseBulletDmg + expectedClusterDmg);
    expect(totalDmgTaken).toBeLessThanOrEqual(baseBulletDmg + expectedClusterDmg * 2);

    // Multi-pellet shotgun volley caps total secondary cluster blasts at MAX_PELLETS_PER_TRIGGER = 9
    sim.enemies = [];
    sim.props = [];
    p.weaponSlots[0] = 'scrap_shotgun'; // 5 pellets * 3 = 15 raw clusters -> must cap at 9!
    p.clipMax = WEAPONS.scrap_shotgun.clipSize;
    p.clipAmmo = 4;
    p.reloadTimer = 0;
    p.fireCooldownTimer = 0;
    p.x = cx - 40;
    p.y = cy;

    let multiPelletClusters = 0;
    sim.drainEvents();
    sim.step({
      seq: 50,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
    });
    for (const ev of sim.drainEvents()) {
      if (ev.kind === 'explosion' && ev.sourceDefId === 'mutator_cluster_mortar') {
        multiPelletClusters += 1;
      }
    }
    for (let t = 0; t < 45; t++) {
      sim.step({ seq: 51 + t, moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      for (const ev of sim.drainEvents()) {
        if (ev.kind === 'explosion' && ev.sourceDefId === 'mutator_cluster_mortar') {
          multiPelletClusters += 1;
        }
      }
    }
    expect(multiPelletClusters).toBe(MAX_PELLETS_PER_TRIGGER);

    // Anti-cascade: a splitGeneration === 1 projectile never splits into cluster mortar blasts
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: p.id,
      team: 'player',
      weaponId: 'rivet_gun',
      x: cx,
      y: cy,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 480,
      damage: 20,
      radius: 5,
      knockback: 40,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 0.05,
      element: 'none',
      critChance: 0,
      amplifiedByShield: false,
      seed: 12345,
      splitGeneration: 1,
      clusterMortarLob: true,
    });
    sim.drainEvents();
    let splitGen1Clusters = 0;
    for (let t = 0; t < 10; t++) {
      sim.step({ seq: 110 + t, moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      for (const ev of sim.drainEvents()) {
        if (ev.kind === 'explosion' && ev.sourceDefId === 'mutator_cluster_mortar') {
          splitGen1Clusters += 1;
        }
      }
    }
    expect(splitGen1Clusters).toBe(0);
  });

  it('mutator_boomerang_core: launches 200px spinning sawblade (32 scaled DMG) on Perfect Reload / Tactical Vent that slices outbound + return and despawns on catch', () => {
    const sim = createArenaSim(88303);
    const p = sim.player;
    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;

    p.x = cx - 100;
    p.y = cy;
    p.weaponSlots[0] = 'tesla_carbine';
    p.activeWeaponSlot = 0;
    p.weaponMutators[0] = ['mutator_boomerang_core'];
    p.critChance = 0;

    // Place enemy 110px ahead (inside 200px outbound range so sawblade hits on outbound AND return)
    const dummy = spawnStaticTarget(sim, p.x + 110, cy, 5000);
    const hpBefore = dummy.hp;

    p.clipMax = WEAPONS.tesla_carbine.clipSize;
    p.clipAmmo = 2;
    p.reloadDuration = 1.0;
    p.reloadTimer = 0.48;
    p.reloadLockout = false;

    sim.step({ seq: 1, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.RELOAD_VENT });

    const saw = sim.projectiles.find((b) => b.weaponId === 'mutator_boomerang_saw');
    expect(saw).toBeDefined();
    const expectedDmg = scaleBlessingDamage(32, sim.currentFloor);
    expect(saw!.damage).toBe(expectedDmg);
    expect(saw!.radius).toBe(16);
    expect(saw!.boomerangPhase).toBe('outbound');
    expect(saw!.element).toBe(WEAPONS.tesla_carbine.element);

    let sawReturningPhase = false;
    let maxTravelDist = 0;
    for (let t = 0; t < 75; t++) {
      sim.step({ seq: t + 2, moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      const activeSaw = sim.projectiles.find((b) => b.weaponId === 'mutator_boomerang_saw');
      if (activeSaw) {
        maxTravelDist = Math.max(maxTravelDist, Math.hypot(activeSaw.x - p.x, activeSaw.y - p.y));
        if (activeSaw.boomerangPhase === 'returning') {
          sawReturningPhase = true;
        }
      }
    }

    expect(sawReturningPhase).toBe(true);
    expect(maxTravelDist).toBeGreaterThanOrEqual(185);
    expect(maxTravelDist).toBeLessThanOrEqual(220);
    // Sliced twice: once outbound + once returning!
    expect(hpBefore - dummy.hp).toBeGreaterThanOrEqual(expectedDmg * 2);
    // Despawned cleanly upon returning to owner
    expect(sim.projectiles.filter((b) => b.weaponId === 'mutator_boomerang_saw')).toHaveLength(0);

    // Client cosmetic 60Hz prediction also flips at 200px and returns cleanly to owner
    const clientSim = createArenaSim(88303);
    clientSim.player.x = p.x;
    clientSim.player.y = p.y;
    clientSim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: 1,
      ownerId: clientSim.player.id,
      team: 'player',
      weaponId: 'mutator_boomerang_saw',
      x: clientSim.player.x,
      y: clientSim.player.y,
      originX: clientSim.player.x,
      originY: clientSim.player.y,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 500,
      damage: expectedDmg,
      radius: 16,
      knockback: 120,
      pierceCount: 12,
      bounceCount: 0,
      ttlSec: 1.4,
      element: 'shock',
      critChance: 0,
      amplifiedByShield: false,
      seed: 777,
      boomerangPhase: 'outbound',
    });
    let clientSawReturn = false;
    for (let t = 0; t < 75; t++) {
      clientSim.stepClientProjectilesCosmetic(1 / 60);
      const cs = clientSim.projectiles.find((b) => b.weaponId === 'mutator_boomerang_saw');
      if (cs?.boomerangPhase === 'returning') {
        clientSawReturn = true;
      }
    }
    expect(clientSawReturn).toBe(true);
    expect(
      clientSim.projectiles.filter((b) => b.weaponId === 'mutator_boomerang_saw'),
    ).toHaveLength(0);
  });

  it('mutator_elemental_infusion: infuses off-hand weapon element on Finale / Overclocked / Vent shots to solo-trigger Elemental Reactions', () => {
    const sim = createArenaSim(88304);
    const p = sim.player;
    const cx = sim.map.width * 0.5;
    const cy = sim.map.height * 0.5;

    p.x = cx - 90;
    p.y = cy;
    // Active slot 0: tesla_carbine (shock), Off-hand slot 1: frag_launcher (burn) -> shock + burn = overload!
    p.weaponSlots = ['tesla_carbine', 'frag_launcher'];
    p.activeWeaponSlot = 0;
    p.weaponMutators = [['mutator_elemental_infusion'], []];
    p.critChance = 0;

    expect(resolveOffhandWeaponElement(p)).toBe('burn');

    const dummy = spawnStaticTarget(sim, cx, cy, 10000);

    // 1) Normal non-finale, non-overclocked shot does NOT infuse off-hand element
    p.clipMax = WEAPONS.tesla_carbine.clipSize;
    p.clipAmmo = 5;
    p.overclockedNextShot = false;
    p.fireCooldownTimer = 0;
    sim.step({ seq: 1, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    expect(sim.projectiles[0]!.secondaryInfusedElement).toBeUndefined();
    sim.projectiles = [];
    dummy.shockTimer = 0;
    dummy.burnTimer = 0;

    // 2) Finale Shot (clipAmmo === 1) infuses 'burn' alongside 'shock' and solo-triggers 'overload' reaction!
    p.clipAmmo = 1;
    p.fireCooldownTimer = 0;
    const reactionsBefore = sim.runStats.elementalReactions;
    let sawOverloadEvent = false;

    sim.drainEvents();
    sim.step({
      seq: 10,
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.FIRE,
    });
    expect(sim.projectiles[0]!.secondaryInfusedElement).toBe('burn');
    for (const ev of sim.drainEvents()) {
      if (ev.kind === 'elemental_reaction' && ev.reaction === 'overload') {
        sawOverloadEvent = true;
      }
    }
    for (let t = 0; t < 20; t++) {
      sim.step({ seq: 11 + t, moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      for (const ev of sim.drainEvents()) {
        if (ev.kind === 'elemental_reaction' && ev.reaction === 'overload') {
          sawOverloadEvent = true;
        }
      }
    }
    expect(sawOverloadEvent).toBe(true);
    expect(sim.runStats.elementalReactions).toBeGreaterThan(reactionsBefore);

    // 3) Overclocked shot after Perfect Reload also infuses off-hand element ('poison' + 'burn' -> 'toxic_blast')
    p.weaponSlots = ['seed_gun', 'frag_launcher'];
    p.activeWeaponSlot = 0;
    p.weaponMutators = [['mutator_elemental_infusion'], []];
    p.clipMax = WEAPONS.seed_gun.clipSize;
    p.clipAmmo = 4;
    p.reloadTimer = 0;
    p.overclockedNextShot = true;
    p.fireCooldownTimer = 0;
    dummy.shockTimer = 0;
    dummy.burnTimer = 0;
    dummy.poisonTimer = 0;
    dummy.poisonStacks = 0;
    const aimToDummy = Math.atan2(dummy.y - p.y, dummy.x - p.x);

    let sawToxicBlastEvent = false;
    sim.drainEvents();
    sim.step({ seq: 40, moveX: 0, moveY: 0, aimAngle: aimToDummy, buttons: INPUT_BUTTON.FIRE });
    expect(sim.projectiles[0]!.secondaryInfusedElement).toBe('burn');
    for (const ev of sim.drainEvents()) {
      if (ev.kind === 'elemental_reaction' && ev.reaction === 'toxic_blast') {
        sawToxicBlastEvent = true;
      }
    }
    for (let t = 0; t < 25; t++) {
      sim.step({ seq: 41 + t, moveX: 0, moveY: 0, aimAngle: aimToDummy, buttons: 0 });
      for (const ev of sim.drainEvents()) {
        if (ev.kind === 'elemental_reaction' && ev.reaction === 'toxic_blast') {
          sawToxicBlastEvent = true;
        }
      }
    }
    expect(sawToxicBlastEvent).toBe(true);

    // 3b) Tactical Vent empowered shot on HEAT_VENT weapon (solar_archon_staff 'burn' + offhand apprentice_staff 'chill' -> 'vaporize')
    sim.projectiles = [];
    p.weaponSlots = ['solar_archon_staff', 'apprentice_staff'];
    p.activeWeaponSlot = 0;
    p.weaponMutators = [['mutator_elemental_infusion'], []];
    p.apprenticeStaffShotCount = 2; // rotation index 1 -> 'chill'
    expect(resolveOffhandWeaponElement(p)).toBe('chill');
    p.ventEmpoweredNextShot = true;
    p.weaponHeat = 20;
    p.overheatLockTimer = 0;
    p.fireCooldownTimer = 0;
    dummy.shockTimer = 0;
    dummy.burnTimer = 0;
    dummy.chillTimer = 0;
    dummy.chillStacks = 0;
    dummy.poisonTimer = 0;

    let sawVentVaporize = false;
    sim.drainEvents();
    sim.step({ seq: 68, moveX: 0, moveY: 0, aimAngle: aimToDummy, buttons: INPUT_BUTTON.FIRE });
    expect(sim.projectiles[0]!.secondaryInfusedElement).toBe('chill');
    for (let t = 0; t < 25; t++) {
      sim.step({ seq: 69 + t, moveX: 0, moveY: 0, aimAngle: aimToDummy, buttons: 0 });
      for (const ev of sim.drainEvents()) {
        if (ev.kind === 'elemental_reaction' && ev.reaction === 'vaporize') {
          sawVentVaporize = true;
        }
      }
    }
    expect(sawVentVaporize).toBe(true);

    // 4) Graceful 3rd melee combo finisher infusion if attached in custom tests ('burn' + 'shock' -> 'overload')
    p.weaponSlots = ['berserker_axe', 'tesla_carbine'];
    p.activeWeaponSlot = 0;
    p.weaponMutators = [['mutator_elemental_infusion'], []];
    p.x = dummy.x - 115; // Berserker 3rd combo Guillotine leaps 96px forward -> lands 19px in front of dummy
    p.y = dummy.y;
    p.meleeComboStep = 2;
    p.meleeComboResetTimer = 1.0;
    p.fireCooldownTimer = 0;
    dummy.shockTimer = 0;
    dummy.burnTimer = 0;
    dummy.chillTimer = 0;
    dummy.chillStacks = 0;
    dummy.poisonTimer = 0;

    let sawMeleeOverload = false;
    sim.drainEvents();
    sim.step({ seq: 100, moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    for (const ev of sim.drainEvents()) {
      if (ev.kind === 'elemental_reaction' && ev.reaction === 'overload') {
        sawMeleeOverload = true;
      }
    }
    expect(sawMeleeOverload).toBe(true);
  });

  it('formats card metadata and draws distinct custom vector emblems in Daedalus Forge modal for all 4 Phase 4 mutators', () => {
    const expectedAccents: Record<(typeof PHASE4_WEAPON_MUTATOR_IDS)[number], string> = {
      mutator_holo_decoy_gun: '#38BDF8',
      mutator_cluster_mortar: '#FB923C',
      mutator_boomerang_core: '#2DD4BF',
      mutator_elemental_infusion: '#C084FC',
    };

    for (let i = 0; i < PHASE4_WEAPON_MUTATOR_IDS.length; i++) {
      const id = PHASE4_WEAPON_MUTATOR_IDS[i]!;
      const metaVi = formatMutatorChoiceCardMeta(id, i % 2, false);
      const metaEn = formatMutatorChoiceCardMeta(id, i % 2, true);

      expect(metaVi.name).toBe(WEAPON_MUTATORS[id].nameVi);
      expect(metaEn.name).toBe(WEAPON_MUTATORS[id].nameEn);
      expect(metaVi.compatibilityBadge).toBe('CLIP / HEAT');
      expect(metaVi.accentHex).toBe(expectedAccents[id]);

      const g = createMockGraphics();
      drawWeaponMutatorEmblem(g as never, id, 120, 120, 22);
      expect(g.fillCircle).toHaveBeenCalled();
      expect(g.strokeCircle).toHaveBeenCalled();
      const usedColors = [
        ...g.fillStyle.mock.calls.map((c) => c[0]),
        ...g.lineStyle.mock.calls.map((c) => c[1]),
      ];
      expect(usedColors).toContain(metaVi.borderColor);
      expect(
        g.fillStyle.mock.calls.length + g.lineStyle.mock.calls.length,
      ).toBeGreaterThanOrEqual(5);
    }
  });
});
