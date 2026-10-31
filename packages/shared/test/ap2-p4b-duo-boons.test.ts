import { describe, expect, it } from 'vitest';
import {
  ALL_BLESSING_IDS,
  ALL_DUO_BOON_IDS,
  CRYO_SHATTER_SPIRE_BASE_DMG,
  CRYO_SHATTER_SPIRE_BLAST_RADIUS,
  CRYO_SHATTER_SPIRE_COUNT,
  CRYO_SHATTER_SPIRE_TTL_SEC,
  DUO_BOONS,
  DUO_BOON_LIST,
  DUO_BOON_SLOT3_UPGRADE_CHANCE,
  type BulletVolleySpawnEvent,
  type DuoBoonId,
  I18nManager,
  INPUT_BUTTON,
  MAGNETIC_BASTION_BASE_DPS,
  MAGNETIC_BASTION_MAX_DIST,
  MAGNETIC_BASTION_WIRE_HALF_WIDTH,
  MAX_CYCLONES_PER_PLAYER,
  MAX_TACTICAL_PROPS_PER_ROOM,
  NAPALM_PLAGUE_BASE_DMG,
  NAPALM_PLAGUE_BLAST_RADIUS,
  NAPALM_PLAGUE_SPREAD_RADIUS,
  NAPALM_PLAGUE_TTL_SEC,
  NetworkTransport,
  PLASMA_OVERLOAD_STAR_BASE_DMG,
  PLASMA_OVERLOAD_STAR_BOUNCES,
  PLASMA_OVERLOAD_STAR_ICD_SEC,
  PLASMA_OVERLOAD_STAR_SPEED,
  SHOT_FLAG,
  SUPERCONDUCT_RAIL_RADIUS,
  SUPERHEATED_CYCLONE_AURA_RADIUS,
  SUPERHEATED_CYCLONE_BASE_DPS,
  SUPERHEATED_CYCLONE_SPEED,
  SUPERHEATED_CYCLONE_TTL_SEC,
  WorldSim,
  collectPlayerOwnedElements,
  distance,
  encodeWorldSnapshot,
  enLocale,
  getEligibleDuoBoonsForPlayer,
  hasPlayerDuoBoon,
  isDuoBoonId,
  scaleBlessingDamage,
  viLocale,
} from '../src/index.js';

function collectLeafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...collectLeafKeys(v, next));
    } else {
      keys.push(next);
    }
  }
  return keys.sort();
}

function createCleanArenaSim(seed = 20261031): WorldSim {
  const sim = new WorldSim({
    seed,
    startInHub: false,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
    autoRespawnWaves: false,
  });
  for (let ty = 0; ty < sim.map.rows; ty++) {
    for (let tx = 0; tx < sim.map.cols; tx++) {
      const isInterior =
        tx >= 2 && tx < sim.map.cols - 2 && ty >= 2 && ty < sim.map.rows - 2;
      sim.map.setTile(tx, ty, isInterior ? 'floor' : 'wall');
      sim.map.setSurface(tx, ty, 'none', 0, true);
    }
  }
  sim.map.rebuildSolidBoxes();
  sim.enemies.length = 0;
  sim.props.length = 0;
  sim.projectiles.length = 0;
  sim.summons.length = 0;
  sim.skillZones.length = 0;
  sim.magneticRivets.length = 0;
  sim.player.x = 420;
  sim.player.y = 260;
  sim.player.prevX = 420;
  sim.player.prevY = 260;
  sim.player.aimAngle = 0;
  sim.consumeEvents();
  return sim;
}

function stepSim(
  sim: WorldSim,
  durationSec: number,
  buttons = 0,
  aimAngle = sim.player.aimAngle,
  moveX = 0,
  moveY = 0,
): void {
  const steps = Math.max(1, Math.round(durationSec * 60));
  for (let i = 0; i < steps; i++) {
    sim.setPlayerInput({
      seq: sim.tick + 1,
      tick: sim.tick + 1,
      moveX,
      moveY,
      aimAngle,
      buttons,
    });
    sim.step(1 / 60);
  }
}

describe('AP2 Phase P4B.1 — 6 Elemental Duo Boons, 35% Slot-3 Unlock & 60Hz Sync', () => {
  it('1. registers all 6 DUO_BOONS, bilingual vi/en i18n keys, and element-pair eligibility (including Physical none mapping)', () => {
    expect(DUO_BOON_SLOT3_UPGRADE_CHANCE).toBe(0.35);
    expect(ALL_DUO_BOON_IDS).toEqual([
      'duo_superheated_cyclone',
      'duo_cryo_shatter_spires',
      'duo_superconduct_rail',
      'duo_napalm_chain_plague',
      'duo_plasma_overload_star',
      'duo_magnetic_bastion_ring',
    ]);
    expect(DUO_BOON_LIST).toHaveLength(6);
    expect(Object.keys(DUO_BOONS)).toHaveLength(6);

    expect(DUO_BOONS.duo_superheated_cyclone.requiredElements).toEqual(['burn', 'chill']);
    expect(DUO_BOONS.duo_cryo_shatter_spires.requiredElements).toEqual(['chill', 'none']);
    expect(DUO_BOONS.duo_superconduct_rail.requiredElements).toEqual(['chill', 'shock']);
    expect(DUO_BOONS.duo_napalm_chain_plague.requiredElements).toEqual(['poison', 'burn']);
    expect(DUO_BOONS.duo_plasma_overload_star.requiredElements).toEqual(['burn', 'shock']);
    expect(DUO_BOONS.duo_magnetic_bastion_ring.requiredElements).toEqual(['shock', 'none']);

    for (const id of ALL_DUO_BOON_IDS) {
      expect(isDuoBoonId(id)).toBe(true);
      const def = DUO_BOONS[id];
      expect(def.id).toBe(id);
      expect(def.nameVi.length).toBeGreaterThan(3);
      expect(def.nameEn.length).toBeGreaterThan(3);
      expect(def.descriptionVi.length).toBeGreaterThan(10);
      expect(def.descriptionEn.length).toBeGreaterThan(10);
      expect(def.primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(def.secondaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(isDuoBoonId('reload_frost_nova')).toBe(false);
    expect(isDuoBoonId('')).toBe(false);

    // 100% leaf-key parity & zero raw key leaks across vi/en
    expect(collectLeafKeys(viLocale)).toEqual(collectLeafKeys(enLocale));
    const i18n = new I18nManager('vi');
    for (const id of ALL_DUO_BOON_IDS) {
      i18n.setLocale('vi');
      expect(i18n.t(`buffs.${id}.name`)).toBe(DUO_BOONS[id].nameVi);
      expect(i18n.t(`buffs.${id}.desc`)).toBe(DUO_BOONS[id].descriptionVi);
      i18n.setLocale('en');
      expect(i18n.t(`buffs.${id}.name`)).toBe(DUO_BOONS[id].nameEn);
      expect(i18n.t(`buffs.${id}.desc`)).toBe(DUO_BOONS[id].descriptionEn);
    }

    // Eligibility checks:
    // (a) Single element only -> empty
    expect(
      getEligibleDuoBoonsForPlayer({
        weaponSlots: ['apprentice_staff'],
        blessingIds: [],
        duoBoonIds: [],
      }),
    ).toEqual([]);

    // (b) Empty / invalid weapon slots do NOT falsely grant 'none' Physical element
    expect(
      Array.from(
        collectPlayerOwnedElements({
          weaponSlots: ['', 'unknown_weapon_id'],
          blessingIds: ['reload_frost_nova'],
        }),
      ),
    ).toEqual(['chill']);
    expect(
      getEligibleDuoBoonsForPlayer({
        weaponSlots: ['', 'unknown_weapon_id'],
        blessingIds: ['reload_frost_nova'],
        duoBoonIds: [],
      }),
    ).toEqual([]);

    // (c) Burn weapon + Chill blessing -> ['duo_superheated_cyclone']
    expect(
      getEligibleDuoBoonsForPlayer({
        weaponSlots: ['apprentice_staff'],
        blessingIds: ['reload_frost_nova'],
        duoBoonIds: [],
      }),
    ).toEqual(['duo_superheated_cyclone']);

    // (d) Physical ('none') weapon + Shock blessing/weapon -> ['duo_magnetic_bastion_ring']
    expect(
      getEligibleDuoBoonsForPlayer({
        weaponSlots: ['hunter_crossbow'],
        blessingIds: ['reload_holster_surge'],
        duoBoonIds: [],
      }),
    ).toEqual(['duo_magnetic_bastion_ring']);

    // (e) Weapon with finaleElement ('rivet_gun': element 'none' + finaleElement 'shock') also unlocks ['duo_magnetic_bastion_ring']
    expect(
      getEligibleDuoBoonsForPlayer({
        weaponSlots: ['rivet_gun'],
        blessingIds: [],
        duoBoonIds: [],
      }),
    ).toEqual(['duo_magnetic_bastion_ring']);

    // (f) Excludes already owned Duo Boons in player.duoBoonIds
    expect(
      getEligibleDuoBoonsForPlayer({
        weaponSlots: ['apprentice_staff'],
        blessingIds: ['reload_frost_nova'],
        duoBoonIds: ['duo_superheated_cyclone'],
      }),
    ).toEqual([]);
  });

  it('2. upgrades slot 3 (choices[2]) to an eligible DuoBoonId ~35% of rolls, keeps slots 0-1 as BlessingIds, and selects into duoBoonIds + 60Hz snapshot (Review Focus #1)', () => {
    const sim = createCleanArenaSim(4401);
    const p = sim.player;
    p.weaponSlots = ['apprentice_staff']; // burn
    p.blessingIds = ['reload_frost_nova']; // chill -> unlocks duo_superheated_cyclone

    let duoSlot3Count = 0;
    const totalRolls = 200;
    for (let i = 0; i < totalRolls; i++) {
      sim.rollPendingBuffChoices();
      expect(p.buffChoices).toHaveLength(3);
      // Slots 0 and 1 MUST always be regular BlessingIds
      expect(isDuoBoonId(p.buffChoices[0]!)).toBe(false);
      expect(isDuoBoonId(p.buffChoices[1]!)).toBe(false);
      expect(ALL_BLESSING_IDS).toContain(p.buffChoices[0]);
      expect(ALL_BLESSING_IDS).toContain(p.buffChoices[1]);

      if (isDuoBoonId(p.buffChoices[2]!)) {
        expect(p.buffChoices[2]).toBe('duo_superheated_cyclone');
        duoSlot3Count++;
      }
      p.buffChoices = [];
    }

    const ratio = duoSlot3Count / totalRolls;
    expect(ratio).toBeGreaterThanOrEqual(0.25);
    expect(ratio).toBeLessThanOrEqual(0.45);

    // Review Focus #1: Selecting a DuoBoonId writes into p.duoBoonIds, NEVER into p.blessingIds, and syncs over NetworkTransport
    sim.currentFloor = 1;
    sim.runState = 'buff_choice';
    p.buffChoices = ['table_tech_rocket', 'dash_venom_wake', 'duo_superheated_cyclone'];
    const selected = sim.selectFloorBuff('duo_superheated_cyclone', p.id);
    expect(selected).toBe(true);
    expect(p.duoBoonIds).toEqual(['duo_superheated_cyclone']);
    expect(hasPlayerDuoBoon(p, 'duo_superheated_cyclone')).toBe(true);
    expect(p.blessingIds).not.toContain('duo_superheated_cyclone');

    // Once owned, future rolls MUST NEVER offer the duplicate Duo Boon
    for (let i = 0; i < 40; i++) {
      sim.rollPendingBuffChoices();
      expect(p.buffChoices).not.toContain('duo_superheated_cyclone');
      p.buffChoices = [];
    }

    // Verify 60Hz snapshot -> NetworkTransport sync of duoBoonIds & buffChoices containing a DuoBoonId
    p.weaponSlots = ['hunter_crossbow', 'tesla_carbine'];
    p.buffChoices = ['table_tech_rocket', 'dash_venom_wake', 'duo_magnetic_bastion_ring'];
    const clientTransport = new NetworkTransport({
      seed: 4401,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      localPlayerId: p.id,
      localPlayerSlot: p.slot,
      wifiProfile: 'off',
    });
    clientTransport.receiveSnapshot(
      encodeWorldSnapshot(sim, sim.consumeEvents(), false, 1000),
    );
    const clientPlayer = clientTransport.getSim().player;
    expect(clientPlayer.duoBoonIds).toEqual(['duo_superheated_cyclone']);
    expect(clientPlayer.buffChoices).toEqual([
      'table_tech_rocket',
      'dash_venom_wake',
      'duo_magnetic_bastion_ring',
    ]);
  });

  it('3. duo_superheated_cyclone: Vaporize spawns a homing superheated_cyclone summon (140 px/s, 4.0s TTL, max 3/player, 14 scaled DPS + Steam Blind)', () => {
    expect(SUPERHEATED_CYCLONE_SPEED).toBe(140);
    expect(SUPERHEATED_CYCLONE_BASE_DPS).toBe(14);
    expect(SUPERHEATED_CYCLONE_TTL_SEC).toBe(4.0);
    expect(SUPERHEATED_CYCLONE_AURA_RADIUS).toBe(56);
    expect(MAX_CYCLONES_PER_PLAYER).toBe(3);

    const sim = createCleanArenaSim(4403);
    sim.currentFloor = 3;
    const p = sim.player;
    p.duoBoonIds = ['duo_superheated_cyclone'];

    // Target 1 primed with Burn; Target 2 stands 140px to the right so cyclone chases it
    const e1 = sim.spawnEnemy('goblin_shooter', 480, 260, true);
    e1.hp = 500;
    e1.maxHp = 500;
    e1.aiState = 'idle';
    e1.stateTimer = 10;
    e1.burnTimer = 2.5;
    e1.lastElementOwnerId = p.id;
    e1.lastElementApplied = 'burn';

    const e2 = sim.spawnEnemy('goblin_shooter', 620, 260, true);
    e2.hp = 600;
    e2.maxHp = 600;
    e2.aiState = 'idle';
    e2.stateTimer = 10;

    // Trigger Vaporize on e1 with Chill hit
    sim.applyElementStatusToEnemy(e1, 'chill', 12, p.id);
    const cyclones = sim.summons.filter((s) => s.kind === 'superheated_cyclone');
    expect(cyclones).toHaveLength(1);
    const cyclone = cyclones[0]!;
    expect(cyclone.ttlSec).toBeCloseTo(SUPERHEATED_CYCLONE_TTL_SEC, 2);
    expect(cyclone.ownerPlayerId).toBe(p.id);

    // Kill/remove e1 so cyclone strictly chases e2 at 140 px/s
    e1.hp = 0;
    sim.enemies.splice(sim.enemies.indexOf(e1), 1);

    const startX = cyclone.x;
    stepSim(sim, 0.5);
    const movedDist = cyclone.x - startX;
    // 0.5s * 140 px/s = 70px
    expect(movedDist).toBeGreaterThan(62);
    expect(movedDist).toBeLessThan(78);

    // Step another 0.75s so cyclone reaches e2 (within 56px aura) and ticks every 0.25s
    const hpBeforeAura = e2.hp;
    stepSim(sim, 0.8);
    const expectedTickDmg = Math.max(
      1,
      Math.round(scaleBlessingDamage(SUPERHEATED_CYCLONE_BASE_DPS, sim.currentFloor) * 0.25),
    );
    expect(hpBeforeAura - e2.hp).toBeGreaterThanOrEqual(expectedTickDmg * 2);
    expect(e2.steamBlindTimer).toBeGreaterThan(0);

    // Cap enforcement: triggering 5 more Vaporizes caps active cyclones at MAX_CYCLONES_PER_PLAYER = 3
    for (let k = 0; k < 5; k++) {
      e2.burnTimer = 2.5;
      e2.lastElementOwnerId = p.id;
      sim.applyElementStatusToEnemy(e2, 'chill', 10, p.id);
    }
    expect(
      sim.summons.filter((s) => s.kind === 'superheated_cyclone' && s.ownerPlayerId === p.id).length,
    ).toBeLessThanOrEqual(MAX_CYCLONES_PER_PLAYER);

    // Expires cleanly after 4.0s TTL
    stepSim(sim, 4.2);
    expect(sim.summons.filter((s) => s.kind === 'superheated_cyclone')).toHaveLength(0);
  });

  it('4. duo_cryo_shatter_spires: Shatter plants 4 safe Cryo Spires (4.0s, blocks enemy bullets, <= 16 props cap) and Dash-Kick detonates without halting dash velocity (Review Focus #3)', () => {
    expect(CRYO_SHATTER_SPIRE_COUNT).toBe(4);
    expect(CRYO_SHATTER_SPIRE_TTL_SEC).toBe(4.0);
    expect(CRYO_SHATTER_SPIRE_BLAST_RADIUS).toBe(80);
    expect(CRYO_SHATTER_SPIRE_BASE_DMG).toBe(34);

    const sim = createCleanArenaSim(4404);
    sim.currentFloor = 2;
    const p = sim.player;
    p.duoBoonIds = ['duo_cryo_shatter_spires'];
    // Place melee player right next to frozen enemy to test anti-stuck clearance!
    p.x = 420;
    p.y = 260;

    const target = sim.spawnEnemy('goblin_shooter', 446, 260, true);
    target.hp = 800;
    target.maxHp = 800;
    target.frozenTimer = 1.5;
    target.lastElementOwnerId = p.id;
    target.aiState = 'idle';
    target.stateTimer = 10;

    // Pre-seed 14 props to verify MAX_TACTICAL_PROPS_PER_ROOM = 16 cap enforcement on a separate check,
    // first verify clean 4 spires spawn safely without overlapping player
    sim.applyDamageToEnemy(target, 20, true, 'none', 0, 50, true, p.id);

    const spires = sim.props.filter((pr) => pr.cryoShatterSpire && pr.hp > 0);
    expect(spires).toHaveLength(4);
    for (const sp of spires) {
      expect(sp.kind).toBe('glacial_spike');
      expect(sp.blocksEnemyProjectiles).toBe(true);
      expect(sp.blocksMovement).toBe(true);
      expect(sp.ttlSec).toBeCloseTo(CRYO_SHATTER_SPIRE_TTL_SEC, 2);
      // Review Focus #3: NEVER traps melee player inside spire hitbox!
      expect(distance(p.x, p.y, sp.x, sp.y)).toBeGreaterThanOrEqual(
        p.radius + sp.radius + 6 - 0.01,
      );
    }

    // Enemy projectile fired into a spire is blocked
    const testSpire = spires[0]!;
    sim.spawnDeterministicVolley(
      {
        kind: 'bullet_volley_spawned',
        tick: sim.tick,
        ownerId: target.id,
        team: 'enemy',
        weaponId: 'enemy_bolt',
        x: testSpire.x - 36,
        y: testSpire.y,
        angle: 0,
        pelletCount: 1,
        spreadRad: 0,
        speed: 360,
        damage: 8,
        radius: 5,
        knockback: 0,
        pierceCount: 0,
        bounceCount: 0,
        ttlSec: 1.0,
        element: 'none',
        critChance: 0,
        amplifiedByShield: false,
        seed: 511,
      },
      true,
    );
    stepSim(sim, 0.16);
    expect(sim.projectiles.filter((b) => b.team === 'enemy')).toHaveLength(0);

    // Position bystander enemy near testSpire and Dash-Kick right through testSpire!
    // Remove other 3 spires so dash line strictly tests dashing straight through testSpire.
    for (const sp of spires) {
      if (sp.id !== testSpire.id) sp.hp = 0;
    }
    testSpire.x = 500;
    testSpire.y = 260;
    p.x = 458;
    p.y = 260;
    p.dashCooldownTimer = 0;
    p.dashTimer = 0;

    const victim = sim.spawnEnemy('goblin_shooter', 535, 260, true);
    victim.hp = 500;
    victim.maxHp = 500;
    victim.aiState = 'idle';
    victim.stateTimer = 10;
    target.x = 750; // move original target out of blast radius

    const victimHpBefore = victim.hp;
    // Dash straight right (+X) across testSpire at x=500
    stepSim(sim, 1 / 60, INPUT_BUTTON.DASH, 0, 1, 0);
    stepSim(sim, 0.14, 0, 0, 1, 0);

    // Spire detonated for scaled 34 Chill DMG + 1.2s freeze, AND player dashed smoothly past x=500 without getting halted!
    expect(testSpire.hp).toBe(0);
    const expectedBlastDmg = scaleBlessingDamage(CRYO_SHATTER_SPIRE_BASE_DMG, sim.currentFloor);
    expect(victimHpBefore - victim.hp).toBeGreaterThanOrEqual(expectedBlastDmg);
    expect(victim.frozenTimer).toBeGreaterThanOrEqual(1.05);
    expect(p.x).toBeGreaterThan(515);

    // Room tactical prop cap check (MAX_TACTICAL_PROPS_PER_ROOM = 16)
    sim.props.length = 0;
    for (let i = 0; i < 14; i++) {
      sim.spawnProp('moss_table', 200 + (i % 7) * 55, 160 + Math.floor(i / 7) * 200);
    }
    target.cryoSpireIcdTimer = 0;
    target.frozenTimer = 1.5;
    sim.applyDamageToEnemy(target, 20, true, 'none', 0, 50, true, p.id);
    expect(sim.props.filter((pr) => pr.hp > 0).length).toBeLessThanOrEqual(
      MAX_TACTICAL_PROPS_PER_ROOM,
    );
  });

  it('5. duo_superconduct_rail: bends off-axis ranged shots within r=100px into Superconducted targets with Zero-Rubberband 60Hz Server/Client sync (Review Focus #4)', () => {
    expect(SUPERCONDUCT_RAIL_RADIUS).toBe(100);

    const serverSim = createCleanArenaSim(4405);
    const clientTransport = new NetworkTransport({
      seed: 4405,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      localPlayerId: 1,
      localPlayerSlot: 1,
      wifiProfile: 'off',
    });
    const clientSim = clientTransport.getSim();
    for (let ty = 0; ty < clientSim.map.rows; ty++) {
      for (let tx = 0; tx < clientSim.map.cols; tx++) {
        const isInterior =
          tx >= 2 && tx < clientSim.map.cols - 2 && ty >= 2 && ty < clientSim.map.rows - 2;
        clientSim.map.setTile(tx, ty, isInterior ? 'floor' : 'wall');
        clientSim.map.setSurface(tx, ty, 'none', 0, true);
      }
    }
    clientSim.map.rebuildSolidBoxes();
    clientSim.enemies.length = 0;
    clientSim.props.length = 0;

    // Player at (260, 260) fires straight right along y = 260.
    // Superconducted enemy sits off-axis at (460, 325) -> perpendicular offset = 65px (<= 100px magnetic rail, well outside direct hit radius!).
    const p = serverSim.player;
    p.duoBoonIds = ['duo_superconduct_rail'];
    p.weaponSlots = ['hunter_crossbow'];
    p.activeWeaponSlot = 0;
    p.clipMax = 4;
    p.clipAmmo = 4;
    p.x = 260;
    p.y = 260;
    p.aimAngle = 0;

    const enemy = serverSim.spawnEnemy('goblin_shooter', 460, 325, true);
    enemy.hp = 400;
    enemy.maxHp = 400;
    enemy.aiState = 'idle';
    enemy.stateTimer = 10;
    enemy.superconductTimer = 5.0;

    // Initial snapshot syncs duoBoonIds & superconducted enemy to PredictedClient
    clientTransport.receiveSnapshot(
      encodeWorldSnapshot(serverSim, serverSim.consumeEvents(), false, 1000),
    );
    expect(clientSim.player.duoBoonIds).toContain('duo_superconduct_rail');
    expect(clientSim.enemies[0]?.superconductTimer).toBeGreaterThan(0);

    // Fire 1 ranged shot straight right (angle = 0) via real weapon cadence
    stepSim(serverSim, 1 / 60, INPUT_BUTTON.FIRE, 0);
    expect(serverSim.projectiles).toHaveLength(1);
    const initialProj = serverSim.projectiles[0]!;
    expect((initialProj.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).not.toBe(0);
    const initialId = initialProj.id;

    // Sync initial shot to client -> identical projectile ID
    clientTransport.receiveSnapshot(
      encodeWorldSnapshot(serverSim, serverSim.consumeEvents(), false, 1016),
    );
    expect(clientSim.projectiles.map((b) => b.id)).toEqual([initialId]);

    // Step client cosmetically until projectile enters r=100px around (460, 325) BEFORE server redirect arrives:
    // Zero-Rubberband Client Hold MUST freeze projectile inside the magnetic rail instead of letting it fly past!
    let clientHeld = false;
    for (let i = 0; i < 20; i++) {
      clientSim.stepClientProjectilesCosmetic(1 / 60);
      const cb = clientSim.projectiles[0];
      if (cb && (cb.awaitingServerRedirectTimer ?? 0) > 0) {
        clientHeld = true;
        expect(cb.vx).toBe(0);
        expect(cb.vy).toBe(0);
        expect(cb.awaitingServerRedirectTimer).toBeLessThanOrEqual(0.12);
        break;
      }
    }
    expect(clientHeld).toBe(true);

    // Now advance server until projectile enters r=100px and emits replacedProjectileId redirect volley
    let redirectEv: BulletVolleySpawnEvent | undefined;
    let snapTimeMs = 1032;
    for (let i = 0; i < 20; i++) {
      serverSim.step(1 / 60);
      snapTimeMs += 16;
      const evs = serverSim.consumeEvents();
      const found = evs.find(
        (ev): ev is BulletVolleySpawnEvent =>
          ev.kind === 'bullet_volley_spawned' && ev.replacedProjectileId === initialId,
      );
      clientTransport.receiveSnapshot(encodeWorldSnapshot(serverSim, evs, false, snapTimeMs));
      if (found) {
        redirectEv = found;
        break;
      }
    }
    expect(redirectEv).toBeDefined();
    expect(redirectEv!.superconductRailRedirected).toBe(true);

    // After receiving redirect snapshot, Server & Client have 100% matching projectile IDs aimed downward toward enemy (vy > 0)!
    expect(serverSim.projectiles).toHaveLength(1);
    expect(clientSim.projectiles.map((b) => b.id)).toEqual(
      serverSim.projectiles.map((b) => b.id),
    );
    expect(serverSim.projectiles[0]!.vy).toBeGreaterThan(100);
    expect(clientSim.projectiles[0]!.vy).toBeCloseTo(serverSim.projectiles[0]!.vy, 3);

    // Finish flight -> off-axis shot strikes enemy directly!
    const hpBeforeHit = enemy.hp;
    for (let i = 0; i < 18; i++) {
      serverSim.step(1 / 60);
      snapTimeMs += 16;
      clientTransport.receiveSnapshot(
        encodeWorldSnapshot(serverSim, serverSim.consumeEvents(), false, snapTimeMs),
      );
    }
    expect(enemy.hp).toBeLessThan(hpBeforeHit);
    expect(clientSim.enemies[0]!.hp).toBe(enemy.hp);
  });

  it('6. duo_napalm_chain_plague: Toxic Blast splashes napalmPlagueTimer=5.0s within 160px (+ napalm10 sync) and slaying afflicted cluster chain-detonates once per enemy without infinite recursion (Review Focus #2)', () => {
    expect(NAPALM_PLAGUE_SPREAD_RADIUS).toBe(160);
    expect(NAPALM_PLAGUE_BLAST_RADIUS).toBe(110);
    expect(NAPALM_PLAGUE_BASE_DMG).toBe(32);
    expect(NAPALM_PLAGUE_TTL_SEC).toBe(5.0);

    const sim = createCleanArenaSim(4406);
    sim.currentFloor = 1;
    const p = sim.player;
    p.duoBoonIds = ['duo_napalm_chain_plague'];

    // Center primer enemy + 5 low-HP enemies clustered within 160px (and < 110px of each other), plus 1 far enemy at 230px
    const primer = sim.spawnEnemy('goblin_shooter', 420, 260, true);
    primer.hp = 300;
    primer.maxHp = 300;
    primer.poisonTimer = 4.0;
    primer.poisonStacks = 2;
    primer.lastElementOwnerId = p.id;
    primer.aiState = 'idle';
    primer.stateTimer = 10;

    const clusterOffsets = [
      [115, 0],
      [135, 25],
      [135, -25],
      [150, 10],
      [150, -10],
    ] as const;
    const cluster = clusterOffsets.map(([dx, dy]) => {
      const m = sim.spawnEnemy('goblin_shooter', 420 + dx, 260 + dy, true);
      m.hp = 18; // low HP so 1 chain blast (32 DMG) kills neighbors -> triggers chain!
      m.maxHp = 60;
      m.aiState = 'idle';
      m.stateTimer = 10;
      return m;
    });

    const farEnemy = sim.spawnEnemy('goblin_shooter', 660, 260, true);
    farEnemy.hp = 100;
    farEnemy.maxHp = 100;
    farEnemy.aiState = 'idle';
    farEnemy.stateTimer = 10;

    // Trigger Toxic Blast on primer (at 115..150px, cluster is outside base 96px toxic_blast splash, inside 160px Napalm spread!)
    sim.applyElementStatusToEnemy(primer, 'burn', 10, p.id);

    for (const m of cluster) {
      expect(m.hp).toBeGreaterThan(0);
      expect(m.napalmPlagueTimer).toBeCloseTo(NAPALM_PLAGUE_TTL_SEC, 2);
    }
    expect(farEnemy.napalmPlagueTimer ?? 0).toBe(0);

    // Verify 60Hz snapshot syncs napalm10 to client
    const clientTransport = new NetworkTransport({
      seed: 4406,
      startInHub: false,
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
      localPlayerId: p.id,
      localPlayerSlot: p.slot,
      wifiProfile: 'off',
    });
    const snap = encodeWorldSnapshot(sim, sim.consumeEvents(), false, 1000);
    const clusterSnap = snap.enemies.find((e) => e.id === cluster[0]!.id);
    expect(clusterSnap?.napalm10).toBe(50);
    clientTransport.receiveSnapshot(snap);
    const syncedCluster0 = clientTransport
      .getSim()
      .enemies.find((e) => e.id === cluster[0]!.id);
    expect(syncedCluster0?.napalmPlagueTimer).toBeCloseTo(5.0, 1);

    // Review Focus #2: Kill 1st afflicted enemy in the 5-enemy cluster -> all 5 die via chain reaction,
    // each enemy detonates EXACTLY ONCE (5 explosion events), zero stack overflow!
    sim.consumeEvents();
    sim.applyDamageToEnemy(cluster[0]!, 50, false, 'none', 0, 0, false, p.id);

    const postChainEvents = sim.consumeEvents();
    const napalmExplosions = postChainEvents.filter(
      (ev) => ev.kind === 'explosion' && ev.sourceDefId === 'duo_napalm_chain_plague',
    );
    expect(cluster.every((m) => m.hp <= 0)).toBe(true);
    expect(cluster.every((m) => m.napalmPlagueDetonated === true)).toBe(true);
    expect(napalmExplosions).toHaveLength(5);
  });

  it('7. duo_plasma_overload_star: Overload fires a piercing Plasma Star (420 px/s, 3 wall bounces, 30 scaled DMG, 0.35s ICD) that NEVER recursively spawns more Plasma Stars (Review Focus #2)', () => {
    expect(PLASMA_OVERLOAD_STAR_SPEED).toBe(420);
    expect(PLASMA_OVERLOAD_STAR_BOUNCES).toBe(3);
    expect(PLASMA_OVERLOAD_STAR_BASE_DMG).toBe(30);
    expect(PLASMA_OVERLOAD_STAR_ICD_SEC).toBe(0.35);

    const sim = createCleanArenaSim(4407);
    // Build a narrow horizontal corridor (interior x in [3..10] -> 108px..396px) so 420px/s star bounces 3+ times quickly!
    for (let ty = 0; ty < sim.map.rows; ty++) {
      for (let tx = 0; tx < sim.map.cols; tx++) {
        const open = tx >= 3 && tx <= 10 && ty >= 5 && ty <= 8;
        sim.map.setTile(tx, ty, open ? 'floor' : 'wall');
      }
    }
    sim.map.rebuildSolidBoxes();

    sim.currentFloor = 2;
    const p = sim.player;
    p.duoBoonIds = ['duo_plasma_overload_star'];
    p.x = 180;
    p.y = 234;
    p.aimAngle = 0;

    // Enemy 1 primed with Burn; Enemy 2 also primed with Burn down the corridor to prove Plasma Star hits do NOT recursively spawn new stars!
    const e1 = sim.spawnEnemy('goblin_shooter', 240, 234, true);
    e1.hp = 900;
    e1.maxHp = 900;
    e1.burnTimer = 2.5;
    e1.lastElementOwnerId = p.id;
    e1.aiState = 'idle';
    e1.stateTimer = 10;

    const e2 = sim.spawnEnemy('goblin_shooter', 330, 234, true);
    e2.hp = 900;
    e2.maxHp = 900;
    e2.burnTimer = 2.5;
    e2.lastElementOwnerId = p.id;
    e2.aiState = 'idle';
    e2.stateTimer = 10;

    // Trigger Overload on e1
    sim.applyElementStatusToEnemy(e1, 'shock', 12, p.id);
    const stars = sim.projectiles.filter((b) => b.weaponId === 'duo_plasma_overload_star');
    expect(stars).toHaveLength(1);
    const star = stars[0]!;
    expect(Math.hypot(star.vx, star.vy)).toBeCloseTo(PLASMA_OVERLOAD_STAR_SPEED, 1);
    expect(star.bounceRemaining).toBe(PLASMA_OVERLOAD_STAR_BOUNCES);
    expect(star.damage).toBe(scaleBlessingDamage(PLASMA_OVERLOAD_STAR_BASE_DMG, sim.currentFloor));

    // Immediate 2nd Overload within 0.35s ICD MUST NOT spawn another star
    e1.burnTimer = 2.5;
    sim.applyElementStatusToEnemy(e1, 'shock', 12, p.id);
    expect(sim.projectiles.filter((b) => b.weaponId === 'duo_plasma_overload_star')).toHaveLength(1);

    // Step across 4 corridor crossings (~2.6s): star pierces e2 (even after ICD expires!), bounces 3 times off walls,
    // disappears on the 4th wall hit, and NEVER spawns a 2nd Plasma Star!
    sim.consumeEvents();
    const e2HpBefore = e2.hp;
    let wallBounceImpacts = 0;
    let totalStarSpawns = 0;
    for (let i = 0; i < 165; i++) {
      sim.step(1 / 60);
      const evs = sim.consumeEvents();
      for (const ev of evs) {
        if (ev.kind === 'projectile_impact' && ev.hitWall) {
          wallBounceImpacts++;
        }
        if (
          ev.kind === 'bullet_volley_spawned' &&
          ev.weaponId === 'duo_plasma_overload_star' &&
          !ev.replacedProjectileId
        ) {
          totalStarSpawns++;
        }
      }
    }

    expect(e2.hp).toBeLessThan(e2HpBefore);
    // 3 wall bounces + 1 final wall impact = 4 wall impacts total, then star is removed
    expect(wallBounceImpacts).toBeGreaterThanOrEqual(4);
    expect(sim.projectiles.filter((b) => b.weaponId === 'duo_plasma_overload_star')).toHaveLength(0);
    // Review Focus #2: Zero recursive new Plasma Star spawns during flight!
    expect(totalStarSpawns).toBe(0);
  });

  it('8. duo_magnetic_bastion_ring: Flipped [E] barricades within <= 220px form an electric arc wire dealing 28 scaled Shock DMG/s; low or > 220px barricades do NOT zap', () => {
    expect(MAGNETIC_BASTION_MAX_DIST).toBe(220);
    expect(MAGNETIC_BASTION_BASE_DPS).toBe(28);
    expect(MAGNETIC_BASTION_WIRE_HALF_WIDTH).toBe(14);

    const sim = createCleanArenaSim(4408);
    sim.currentFloor = 2;
    const p = sim.player;
    p.duoBoonIds = ['duo_magnetic_bastion_ring'];

    // Two moss_table barricades 180px apart (<= 220px), initially 'low', plus a 3rd flipped barricade 260px away (> 220px)
    const tableA = sim.spawnProp('moss_table', 320, 260);
    const tableB = sim.spawnProp('moss_table', 500, 260);
    const tableFar = sim.spawnProp('moss_table', 760, 260);
    tableFar.coverState = 'flipped';
    tableFar.state = 'flipped';

    const enemyBetweenAB = sim.spawnEnemy('goblin_shooter', 410, 260, true);
    enemyBetweenAB.hp = 500;
    enemyBetweenAB.maxHp = 500;
    enemyBetweenAB.stunTimer = 10;

    const enemyBetweenBFar = sim.spawnEnemy('goblin_shooter', 630, 260, true);
    enemyBetweenBFar.hp = 500;
    enemyBetweenBFar.maxHp = 500;
    enemyBetweenBFar.stunTimer = 10;

    // While tableA and tableB are 'low', NO arc wire damage occurs
    stepSim(sim, 0.6);
    expect(enemyBetweenAB.hp).toBe(500);
    expect(enemyBetweenBFar.hp).toBe(500);

    // Player flips tableA with [E], then flips tableB with [E]
    p.x = 320;
    p.y = 292;
    sim.interactWithNearest(p);
    expect(tableA.coverState).toBe('flipped');

    // Only 1 of (A, B) is flipped -> still no arc between A & B
    stepSim(sim, 0.35);
    expect(enemyBetweenAB.hp).toBe(500);

    p.x = 500;
    p.y = 292;
    sim.interactWithNearest(p);
    expect(tableB.coverState).toBe('flipped');

    // Now both tableA and tableB are 'flipped' at 180px (<= 220px):
    // Step 1.05s (4 ticks of 0.25s) -> enemyBetweenAB takes ~28 scaled Shock DMG/s, while enemyBetweenBFar (260px > 220px) takes 0!
    // Move enemies > 115px apart first so Shock's native 115px chain lightning doesn't jump from AB to BFar.
    expect(distance(enemyBetweenAB.x, enemyBetweenAB.y, enemyBetweenBFar.x, enemyBetweenBFar.y)).toBeGreaterThan(150);
    stepSim(sim, 1.05);

    const expectedOneSecDmg = scaleBlessingDamage(MAGNETIC_BASTION_BASE_DPS, sim.currentFloor);
    const dealt = 500 - enemyBetweenAB.hp;
    expect(dealt).toBeGreaterThanOrEqual(Math.round(expectedOneSecDmg * 0.75));
    expect(enemyBetweenAB.shockTimer).toBeGreaterThan(0);
    expect(enemyBetweenBFar.hp).toBe(500);
  });
});
